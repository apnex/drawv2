/*
H14.2 -- a draft is a DESTINATION, not a mode.

The verb never changes meaning; only where the op lands, and that is named in the command. A write
with `--draft` accumulates locally and reaches no server; `draw commit` sends the accumulated set as
ONE transaction with one version bump and one undo entry.

Driven through `main` against a real server, because the tool speaks only HTTP and imports nothing
from `server/` -- testing it in process would be testing something the agent never runs.

The load-bearing assertions are the two that no unit test can reach:

  - a drafted write must not touch the server (the whole point is one call, not N)
  - two drafted `place near` ops must land on DIFFERENT anchors, which only holds because the ops
    carry INTENT and the server resolves each against the projection plan() advances between them.
    Resolving client-side against one pre-draft snapshot picks the same anchor twice, and the set
    is refused whole -- measured on the live estate before this existed.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeApp } from './fixtures/app.mjs';
import { main } from '../cli/draw.mjs';

let app, host, dataDir, home;

async function boot() {
	dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-draft-'));
	home = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-dhome-'));
	app = await makeApp({ dataDir, secretsDir: dataDir, port: 0 });
	host = `http://127.0.0.1:${app.port}`;
}
const run = async (...argv) => {
	const out = [];
	await main([...argv, '--host', host], { HOME: home }, (s) => out.push(s));
	return out.join('');
};
async function captureExit(fn) {
	const errs = [];
	const ew = process.stderr.write.bind(process.stderr);
	const exit = process.exit;
	process.stderr.write = (s) => { errs.push(s); return true; };
	process.exit = () => { throw new Error('__exit__'); };
	try { await fn(); } catch (e) { if (e.message !== '__exit__') throw e; }
	finally { process.stderr.write = ew; process.exit = exit; }
	return errs.join('');
}
const version = async (id) => {
	const list = JSON.parse(await run('diagrams', '--json'));
	return list.find((d) => d.id === id).version;
};

test('a draft accumulates locally, and commits as ONE transaction', async () => {
	await boot();
	try {
		const id = (await run('create', 'draft-one')).trim();
		await run('lock', '--diagram', id);
		await run('add', 'server', 'at', '0,0', '--name', 'lb-1', '--diagram', id);
		const before = await version(id);

		// three drafted writes -- none of them may reach the server
		await run('place', 'server', 'near', 'lb-1', '--name', 'web-01', '--draft', '--diagram', id);
		await run('place', 'server', 'near', 'lb-1', '--name', 'web-02', '--draft', '--diagram', id);
		await run('place', 'server', 'near', 'lb-1', '--name', 'web-03', '--draft', '--diagram', id);
		assert.equal(await version(id), before, 'a drafted write must not change the document');

		const staged = JSON.parse(await run('draft', 'show', '--json'));
		assert.equal(staged.ops.length, 3, 'three ops staged');

		await run('commit', '--diagram', id);
		assert.equal(await version(id), before + 1, 'the whole draft is ONE version bump');

		const doc = JSON.parse(await run('dump', '--diagram', id, '--json'));
		const names = doc.nodes.map((n) => n.name).sort();
		assert.deepEqual(names, ['lb-1', 'web-01', 'web-02', 'web-03']);
	} finally { await app.close(); }
});

test('drafted place ops resolve to DIFFERENT anchors, because the server resolves the intent', async () => {
	await boot();
	try {
		const id = (await run('create', 'draft-anchor')).trim();
		await run('lock', '--diagram', id);
		await run('add', 'server', 'at', '0,0', '--name', 'lb-1', '--diagram', id);
		await run('place', 'server', 'near', 'lb-1', '--name', 'a', '--draft', '--diagram', id);
		await run('place', 'server', 'near', 'lb-1', '--name', 'b', '--draft', '--diagram', id);
		await run('commit', '--diagram', id);

		const doc = JSON.parse(await run('dump', '--diagram', id, '--json'));
		const a = doc.nodes.find((n) => n.name === 'a');
		const b = doc.nodes.find((n) => n.name === 'b');
		assert.ok(a && b, 'both landed');
		assert.notDeepEqual({ x: a.x, y: a.y }, { x: b.x, y: b.y },
			'two intents in one set must not share an anchor');
	} finally { await app.close(); }
});

test('one undo removes the whole set, not the last op in it', async () => {
	await boot();
	try {
		const id = (await run('create', 'draft-undo')).trim();
		await run('lock', '--diagram', id);
		await run('add', 'server', 'at', '0,0', '--name', 'lb-1', '--diagram', id);
		await run('place', 'server', 'near', 'lb-1', '--name', 'x', '--draft', '--diagram', id);
		await run('place', 'server', 'near', 'lb-1', '--name', 'y', '--draft', '--diagram', id);
		await run('commit', '--diagram', id);
		assert.equal(JSON.parse(await run('dump', '--diagram', id, '--json')).nodes.length, 3);

		const v = await version(id);
		await run('undo', '--expect', String(v), '--diagram', id);
		const after = JSON.parse(await run('dump', '--diagram', id, '--json'));
		assert.equal(after.nodes.length, 1, 'one undo removed both drafted nodes');
		assert.equal(after.nodes[0].name, 'lb-1');
	} finally { await app.close(); }
});

test('a write with no --draft still applies immediately, so the verb never changed meaning', async () => {
	await boot();
	try {
		const id = (await run('create', 'draft-direct')).trim();
		await run('lock', '--diagram', id);
		await run('add', 'server', 'at', '0,0', '--name', 'lb-1', '--diagram', id);
		const before = await version(id);
		await run('place', 'server', 'near', 'lb-1', '--name', 'now', '--diagram', id);
		assert.equal(await version(id), before + 1, 'an undrafted write applies at once');
	} finally { await app.close(); }
});

test('draft show reports what is staged, and discard empties it', async () => {
	await boot();
	try {
		const id = (await run('create', 'draft-show')).trim();
		await run('lock', '--diagram', id);
		await run('add', 'server', 'at', '0,0', '--name', 'lb-1', '--diagram', id);

		const empty = JSON.parse(await run('draft', 'show', '--json'));
		assert.equal(empty.ops.length, 0, 'nothing staged to begin with');

		await run('place', 'server', 'near', 'lb-1', '--name', 'q', '--draft', '--diagram', id);
		assert.equal(JSON.parse(await run('draft', 'show', '--json')).ops.length, 1);

		await run('draft', 'discard');
		assert.equal(JSON.parse(await run('draft', 'show', '--json')).ops.length, 0, 'discard emptied it');

		// committing an empty draft REFUSES rather than sending an empty transaction: an agent
		// that thinks it staged something must be told it did not, not handed a silent success
		const refusal = await captureExit(() => run('commit', '--diagram', id));
		assert.match(refusal, /nothing staged/);
	} finally { await app.close(); }
});

test('a drafted write reports the running count, because silence is the failure mode', async () => {
	await boot();
	try {
		const id = (await run('create', 'draft-count')).trim();
		await run('lock', '--diagram', id);
		await run('add', 'server', 'at', '0,0', '--name', 'lb-1', '--diagram', id);
		const first = await run('place', 'server', 'near', 'lb-1', '--name', 'c1', '--draft', '--diagram', id);
		assert.match(first, /1 op/, `a drafted write must say what it staged, got: ${first.trim()}`);
		const second = await run('place', 'server', 'near', 'lb-1', '--name', 'c2', '--draft', '--diagram', id);
		assert.match(second, /2 ops/, `the count must accumulate, got: ${second.trim()}`);
	} finally { await app.close(); }
});

test('a committed draft is cleared, so the next commit cannot re-apply it', async () => {
	/*
	M4 of the mutation pass survived without this: nothing proved the draft empties. A draft left
	behind is re-sent by the next `commit`, which duplicates every entity in it -- and because the
	ops carry intent, the duplicates resolve to fresh anchors and look deliberate.
	*/
	await boot();
	try {
		const id = (await run('create', 'draft-clear')).trim();
		await run('lock', '--diagram', id);
		await run('add', 'server', 'at', '0,0', '--name', 'lb-1', '--diagram', id);
		await run('place', 'server', 'near', 'lb-1', '--name', 'once', '--draft', '--diagram', id);
		await run('commit', '--diagram', id);

		assert.equal(JSON.parse(await run('draft', 'show', '--json')).ops.length, 0, 'the draft emptied');
		const after = JSON.parse(await run('dump', '--diagram', id, '--json'));
		assert.equal(after.nodes.length, 2, 'lb-1 and one placement');

		const refusal = await captureExit(() => run('commit', '--diagram', id));
		assert.match(refusal, /nothing staged/, 'a second commit has nothing to send');
		assert.equal(JSON.parse(await run('dump', '--diagram', id, '--json')).nodes.length, 2,
			'and the document did not grow');
	} finally { await app.close(); }
});
