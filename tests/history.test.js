/*
CS6 — the surfaces that make a shared undo log usable by a person.

Global undo was the capability CS3 shipped; this is what makes it safe to look at. Three things a
user cannot otherwise know: how far back somebody else's run goes, that the ring dropped work THEY
did, and what moved under them when a write was refused.
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Model } from '../model/index.mjs';
import { Log, LOG_MAX, LOG_HARD_MAX } from '../server/log.mjs';
import { commit, undo } from '../server/txn.mjs';
import { Store } from '../server/store.js';
import { Session } from '../server/protocol.js';

// B112: an unpositioned fixture node gets a DISTINCT anchor derived from its id -- one
// anchor holds one occupant, so two fixtures defaulting to (0,0) is now a real violation.
const _at = (id) => (parseInt(id.slice(-4), 16) % 15 + 1) * 60;
const node = (id, x = null, y = 0) => ({ id, name: id, type: 'host', shape: 'circle', x: x ?? _at(id), y });
const hex = (n) => n.toString(16).padStart(6, '0').slice(-6);

function seeded() {
	const m = new Model();
	const log = new Log(0);
	return { m, log };
}
const put = (m, log, i, by = 'client', actor = 'tab-a') =>
	commit(m, log, { ops: [{ op: 'put', kind: 'node', entity: node(`node-${hex(i)}`, 0, 0) }], label: 'create' }, by, actor);

// ---- D21: undo a RUN ----

test('D21: `undo {to}` reverses a run as ONE transaction — one version bump, not N', () => {
	const { m, log } = seeded();
	for (let i = 1; i <= 5; i++) put(m, log, i);
	assert.equal(m.all('node').length, 5);
	const before = log.version;

	const res = undo(m, log, 2);                       // reverse seq 2..5
	assert.equal(res.ok, true);
	assert.equal(log.version, before + 1, 'ONE version bump for the whole run');
	assert.equal(m.all('node').length, 1, 'four changes reversed');
	assert.ok(m.get('node', `node-${hex(1)}`), 'and seq 1 survives — `to` is inclusive of itself only downward');
	assert.equal(res.ops.length, 4, 'one broadcast carrying every op');
});

test('D21: an unapplied seq is REFUSED, not clamped — an unbounded argument on the destructive verb', () => {
	const { m, log } = seeded();
	for (let i = 1; i <= 3; i++) put(m, log, i);

	for (const bad of [0, -1, 99, 1.5, 'x', null]) {
		if (bad === null) continue;
		const r = undo(m, log, bad);
		assert.equal(r.ok, false, `to=${bad} must be refused`);
		assert.equal(log.version, 3, 'and must write nothing');
	}
	assert.equal(m.all('node').length, 3, 'the document never moved');

	undo(m, log, null);                                 // null still means "the top one"
	assert.equal(m.all('node').length, 2);
});

test('D21: a seq already undone is not a valid target — you cannot undo past the cursor', () => {
	const { m, log } = seeded();
	for (let i = 1; i <= 3; i++) put(m, log, i);
	undo(m, log, 3);                                    // cursor moves below seq 3
	const r = undo(m, log, 3);
	assert.equal(r.ok, false, 'seq 3 is no longer applied');
	assert.match(r.error, /no applied change/);
});

// ---- I14: the eviction floor ----

test('I14: an agent batch cannot evict the human’s newest change out of the ring', () => {
	const { m, log } = seeded();
	put(m, log, 1, 'client', 'tab-a');                  // the human's one change
	const mine = log.records[0];

	for (let i = 2; i <= LOG_MAX + 40; i++) put(m, log, i, 'server', 'agent-1');

	// Eviction is oldest-first and MUST be: undo replays inverses in order, so a hole in the
	// middle of the ring corrupts the chain. There is therefore no evicting "around" the floor —
	// the ring holds its bottom record and grows past the soft cap instead. That is the trade the
	// hard ceiling exists to bound, and it is the right way round: an undo step the user is
	// reaching for costs bytes, not correctness.
	assert.equal(log.records[0], mine, 'the human record is the floor and it held');
	assert.ok(log.records.length > LOG_MAX, 'the ring grew past the soft cap rather than dropping it');
	assert.ok(log.records.length <= LOG_HARD_MAX, 'and stayed under the hard ceiling');
	assert.equal(log.evictedHuman, 0, 'nothing the user authored was dropped');
	assert.equal(log.truncatedHuman, false);
	assert.equal(log.canUndo(), true, 'the point of all of it: Ctrl+Z still reaches their change');
});

test('I14: the hard ceiling overrides the floor, and SAYS SO', () => {
	const { m, log } = seeded();
	put(m, log, 1, 'client', 'tab-a');
	for (let i = 2; i <= LOG_HARD_MAX + 20; i++) put(m, log, i, 'server', 'agent-1');

	assert.ok(log.records.length <= LOG_HARD_MAX + 1, 'the ring stayed bounded — memory wins over an undo step');
	assert.equal(log.evictedHuman, 1, 'the human record went');
	assert.equal(log.truncatedHuman, true, 'and the loss is reported, not silent');
});

test('I14: the floor never holds a ring hostage when the human keeps writing', () => {
	const { m, log } = seeded();
	for (let i = 1; i <= LOG_MAX + 50; i++) put(m, log, i, 'client', 'tab-a');
	assert.ok(log.records.length <= LOG_MAX, 'consecutive human writes evict normally');
	assert.ok(log.evictedHuman > 0, 'and the drop is attributed');
});

test('I14: evictedHuman survives a restart — a loss you cannot see is not a bounded loss', () => {
	const { m, log } = seeded();
	put(m, log, 1, 'client', 'tab-a');
	for (let i = 2; i <= LOG_HARD_MAX + 20; i++) put(m, log, i, 'server', 'agent-1');
	const revived = Log.from(JSON.parse(JSON.stringify(log.toJSON())));
	assert.equal(revived.evictedHuman, log.evictedHuman);
	assert.equal(revived.truncatedHuman, true);
});

// ---- the affordance, end to end ----

function fakeWs() {
	const out = [];
	const handlers = {};
	return {
		readyState: 1, out,
		on(ev, fn) { handlers[ev] = fn; },
		send(text) { out.push(JSON.parse(text)); },
		recv(cmd, body) { handlers.message(Buffer.from(JSON.stringify({ cmd, body }))); },
		last: (cmd) => [...out].reverse().find((m) => m.cmd === cmd),
	};
}

async function live() {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-hist-'));
	const store = new Store(dir, { flushMs: 3_600_000 });
	await store.init();
	return { dir, store, id: store.list()[0].id };
}

test('D21: the server computes the top RUN, so the browser can offer "undo all N by <actor>"', async () => {
	const env = await live();
	try {
		for (let i = 1; i <= 4; i++) {
			env.store.commit(env.id, { ops: [{ op: 'put', kind: 'node', entity: node(`node-${hex(i)}`, 60 * i, 300) }], label: 'create' }, 'server', 'agent-7');
		}
		const ws = fakeWs();
		new Session(ws, env.store);
		ws.recv('hello', { diagram: env.id });
		const top = ws.last('snapshot').body.undoTop;
		assert.equal(top.run, 4, 'four consecutive records by one actor');
		assert.equal(top.actor, 'agent-7');
		assert.equal(top.by, 'server');

		// and `to` is exactly what reverses the run
		ws.recv('undo', { expect: ws.last('snapshot').body.version, to: top.to });
		const ack = ws.last('ack');
		assert.equal(ack.body.ops.length, 4, 'the whole run came back in one transaction');
		assert.equal(ack.body.reversed.actor, 'agent-7', 'attribution: whose change was reversed');
		assert.equal(ack.body.undoTop, null, 'nothing left to undo');
	} finally { fs.rmSync(env.dir, { recursive: true, force: true }); }
});

test('D21: a run STOPS at a different actor — you cannot sweep away someone else’s work with your own', async () => {
	const env = await live();
	try {
		env.store.commit(env.id, { ops: [{ op: 'put', kind: 'node', entity: node('node-aa0001', 60, 300) }] }, 'client', 'tab-a');
		env.store.commit(env.id, { ops: [{ op: 'put', kind: 'node', entity: node('node-aa0002', 120, 300) }] }, 'server', 'agent-7');
		env.store.commit(env.id, { ops: [{ op: 'put', kind: 'node', entity: node('node-aa0003', 180, 300) }] }, 'server', 'agent-7');

		const ws = fakeWs();
		new Session(ws, env.store);
		ws.recv('hello', { diagram: env.id });
		const top = ws.last('snapshot').body.undoTop;
		assert.equal(top.run, 2, "the run is the agent's two, not all three");
		assert.equal(top.actor, 'agent-7');

		ws.recv('undo', { expect: ws.last('snapshot').body.version, to: top.to });
		assert.ok(env.store.get(env.id).get('node', 'node-aa0001'), "tab-a's change is untouched");
		assert.equal(env.store.get(env.id).get('node', 'node-aa0002'), undefined);
	} finally { fs.rmSync(env.dir, { recursive: true, force: true }); }
});

// ---- the 409 recovery body ----

test('a stale `expect` answers with WHAT MOVED, so the caller can reconcile instead of refetching', async () => {
	const { createApp } = await import('../server/app.js');
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-409-'));
	const app = await createApp({ dataDir: dir, secretsDir: dir, port: 0 });
	const base = `http://localhost:${app.port}`;
	try {
		const id = (await (await fetch(`${base}/api/v1/diagrams`)).json())[0].id;
		const token = (await (await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'POST' })).json()).token;
		const h = { 'X-Draw-Lock': token, 'content-type': 'application/json' };
		for (let i = 0; i < 3; i++) {
			await fetch(`${base}/api/v1/diagrams/${id}/nodes`, { method: 'POST', headers: h, body: JSON.stringify({ type: 'host', x: 60 * i, y: 420 }) });
		}

		const res = await fetch(`${base}/api/v1/diagrams/${id}/undo`, { method: 'POST', headers: h, body: JSON.stringify({ expect: 0 }) });
		assert.equal(res.status, 409);
		const body = await res.json();
		assert.equal(body.code, 'version-conflict');
		assert.equal(body.version, 3, 'where the log actually is');
		assert.equal(body.since.length, 3, 'and every change since what you believed');
		assert.ok(body.since.every((r) => r.actor && r.summary), 'who, and what');
		assert.equal(JSON.stringify(body).includes('inverse'), false, 'GR13: inverse never reaches the wire');
		assert.equal(JSON.stringify(body).includes('"ops"'), false, 'nor the raw ops, by default');

		// the labels the high-level verbs now set, so `draw history` is not a column of blanks
		const hist = await (await fetch(`${base}/api/v1/diagrams/${id}/history`)).json();
		assert.ok(hist.records.every((r) => r.label), 'every REST write is labelled');
		assert.equal(hist.records.at(-1).label, 'create node');
		assert.ok(hist.undoLabel, 'and the head is named for the undo affordance');
	} finally { await app.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
