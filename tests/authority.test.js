/*
H13.11 — a write conflict is proof, and proof must have a consequence.

`server/files.mjs` already refuses to overwrite when another writer holds a newer generation, and
says in a comment that it is deliberately not self-healing. That refusal is the strongest signal in
the system: it is not a flaky disk, it is arithmetic. Another process owns this document.

Until now the store counted it, logged it, rescheduled, and tried again -- forever -- while going on
serving its own clients as though it were the only instance. Measured in production on 2026-09-02:
3203 failures against one diagram, `/health` degraded, and two tabs disagreeing about whether a
tower existed.

What these tests pin is the DISTINCTION. A transient write error still deserves B4's retry; a
conflict must not get one, because no number of retries can win it. The two shared a path, and they
need opposite responses.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../server/store.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/*
A files backend that fails on demand.

Modelled on the real one's contract rather than mocked loosely: `write` throws the exact message
`gcsFiles` raises, because that string is what the store now discriminates on. If the backend ever
rewords it, this fixture keeps passing and production stops retiring -- so the wording is asserted
against the real source in the last test of this file.
*/
function backend({ failWith = null } = {}) {
	const store = new Map();
	const writes = [];
	return {
		files: {
			async list() { return [...store.keys()]; },
			async read(name) {
				if (!store.has(name)) throw new Error(`no such object: ${name}`);
				return store.get(name);
			},
			async write(name, text) {
				writes.push(name);
				if (failWith) throw new Error(failWith);
				store.set(name, text);
			},
			async remove(name) { store.delete(name); },
		},
		writes,
		seed(name, text) { store.set(name, text); },
	};
}

async function storeWith(opts, files, lost) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-auth-'));
	const s = new Store(dir, {
		flushMs: 5, files, authz: false,
		onLostAuthority: (id, reason) => lost.push([id, reason]),
		...opts,
	});
	await s.init();
	return { s, dir };
}

test('H13.11: a write conflict reports the loss exactly once and stops retrying', async () => {
	const lost = [];
	const b = backend({ failWith: 'gcs write conflict for diagram-aa0001.json: another writer holds a newer generation (expected 7)' });
	const { s, dir } = await storeWith({}, b.files, lost);
	try {
		const created = await s.create({ name: 'victim' }, null);
		const id = created?.id || created?.model?.state?.meta?.id || [...s.diagrams.keys()][0];
		assert.ok(id, 'the store minted no diagram to lose');

		await sleep(200);                       // long enough for several retries at flushMs 5
		/*
		Counted PER DIAGRAM, not overall. The first draft asserted a single report and found two,
		because the store holds more than the diagram this test created and each one loses its own
		authority separately. That is the correct behaviour -- losing one document says nothing
		about another -- so the assertion was the wrong shape, not the guard.
		*/
		const mine = lost.filter(([lostId]) => lostId === id);
		assert.equal(mine.length, 1, `expected exactly one report for ${id}, got ${mine.length} of ${lost.length}`);
		assert.match(mine[0][1], /another instance/);
		assert.equal(new Set(lost.map(([i]) => i)).size, lost.length, 'a diagram was reported lost more than once');

		const after = b.writes.length;
		await sleep(200);
		assert.equal(b.writes.length, after, 'the store is still retrying a write it cannot win');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('H13.11: an ordinary write failure is still retried -- the two are not the same', async () => {
	/*
	The distinction this change turns on. B4 made a failed flush recover by rescheduling, and that is
	right for a disk that hiccups. Treating every failure as a lost lease would retire clients over
	a transient error and turn a recoverable moment into a forced reload for everyone.
	*/
	const lost = [];
	const b = backend({ failWith: 'gcs write failed for diagram-aa0001.json: 503 backend unavailable' });
	const { s, dir } = await storeWith({}, b.files, lost);
	try {
		await s.create({ name: 'flaky' }, null);
		await sleep(200);
		assert.equal(lost.length, 0, 'a 503 is not proof of another writer');
		const seen = b.writes.length;
		await sleep(150);
		assert.ok(b.writes.length > seen, 'a transient failure must keep retrying');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('H13.11: a healthy store reports no loss and keeps writing', async () => {
	const lost = [];
	const b = backend();
	const { s, dir } = await storeWith({}, b.files, lost);
	try {
		await s.create({ name: 'fine' }, null);
		await sleep(150);
		assert.equal(lost.length, 0);
		assert.ok(b.writes.length > 0, 'nothing was ever written');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('H13.11: the store discriminates on the message the backend actually raises', () => {
	/*
	The fixture above invents a string, and a fixture that invents its own contract proves nothing
	about production. This reads both real files and checks they still agree: `files.mjs` raises the
	phrase, `store.js` tests for it. If either is reworded alone, retirement silently stops.
	*/
	const files = fs.readFileSync(new URL('../server/files.mjs', import.meta.url), 'utf8');
	const store = fs.readFileSync(new URL('../server/store.js', import.meta.url), 'utf8');
	assert.match(files, /write conflict for \$\{name\}/, 'files.mjs no longer raises the phrase store.js matches');
	assert.match(store, /\/write conflict\/\.test\(err\.message\)/, 'store.js no longer discriminates the conflict');
});

test('H13.11: the hub retires only the sessions on the affected diagram', async () => {
	// losing one document says nothing about the others, and a reload nobody needed is a defect
	const { Hub } = await import('../server/hub.js');
	const hub = new Hub();
	const got = [];
	const session = (diagramId, tag) => ({ diagramId, send: (cmd, body) => got.push([tag, cmd, body?.reason]) });
	hub.sessions.add(session('diagram-aa0001', 'a'));
	hub.sessions.add(session('diagram-aa0001', 'b'));
	hub.sessions.add(session('diagram-bb0002', 'elsewhere'));

	const told = hub.retire('diagram-aa0001', 'another instance is writing this diagram');
	assert.equal(told, 2);
	assert.deepEqual(got.map((g) => g[0]).sort(), ['a', 'b']);
	assert.deepEqual([...new Set(got.map((g) => g[1]))], ['retire']);
	assert.match(got[0][2], /another instance/, 'the client is told why it is being replaced');
});
