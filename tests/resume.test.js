/*
CS4 — `push` is dead.

The command did two unrelated jobs under one name, and both were client-authoritative:

  (a) reconnect resync — the browser sent its whole document and the server took it. A tab that
      had been asleep through an agent's work overwrote it on waking.
  (b) adopt-local-content — if the user drew before the server answered, the browser adopted
      whichever diagram the server happened to name and pushed its own content over the top,
      destroying real content that had nothing to do with that tab. That is B2.

(a) becomes `resume {diagram, version}` — a BELIEF, which the server answers with `sync`, a
snapshot, or a snapshot marked `rewound` (D29). (b) becomes `create {name, doc}`, which can only
ever make a new diagram because the server mints the id (I11).

The outbox is what makes the deletion safe, and it is persisted (D30) so unsent work survives a
tab close and not merely a socket drop.
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Model } from '../document/index.mjs';
import { Store } from '../server/store.js';
import { Session } from '../server/protocol.js';
import { Selection } from '../app/src/selection.js';
import { Changes } from '../app/src/changes.js';
import { Sync } from '../app/src/sync.js';

// the browser API Sync persists its outbox through (D30)
const storage = new Map();
globalThis.localStorage = {
	getItem: (k) => (storage.has(k) ? storage.get(k) : null),
	setItem: (k, v) => storage.set(k, String(v)),
	removeItem: (k) => storage.delete(k),
};

const node = (id, x = 0, y = 0) => ({ id, name: id, type: 'host', shape: 'circle', x, y });

// a document the way the server sends one
function serverDoc(id = 'diagram-aa0001', nodes = []) {
	const m = new Model();
	m.state.meta.id = id;
	m.state.meta.name = 'served';
	nodes.forEach((n) => m.put('node', n));
	return m.toJSON();
}

// one browser: a fake socket that records what goes out and lets a test hand messages in
function tab() {
	const sent = [];
	const net = {
		status: 'open',
		open: true,
		isOpen() { return this.open; },
		subscribe(fn) { this.recv = fn; },
		onStatus(fn) { this.notify = fn; },
		send(cmd, body) { if (!this.open) return false; sent.push({ cmd, body }); return true; },
	};
	const model = new Model();
	const selection = new Selection(model);
	const changes = new Changes(model);
	const states = [];
	const sync = new Sync({ model, net, history: changes, selection, onState: (s) => states.push(s) });
	changes.onCommit((r) => sync.submit(r));
	return { sent, net, model, changes, selection, sync, states };
}

const only = (sent, cmd) => sent.filter((m) => m.cmd === cmd);

// ---- (b) adopt-local-content → create. The data-loss fix. ----

test('B2: content drawn before the server answers lands in a NEW diagram, not over an existing one', () => {
	storage.clear();
	const t = tab();
	// the user draws while the socket is still connecting
	t.model.put('node', node('node-aa0001', 60, 60));
	t.model.put('node', node('node-aa0002', 120, 60));

	// the server finally answers — with a REAL diagram that has its own content
	const existing = serverDoc('diagram-bb0002', [node('node-bb0001', 300, 300)]);
	t.net.recv({ cmd: 'snapshot', body: { doc: existing, diagrams: [], locked: false, version: 7 } });

	assert.equal(only(t.sent, 'push').length, 0, '`push` is gone from the wire entirely');
	const created = only(t.sent, 'create');
	assert.equal(created.length, 1, 'the local work is offered as a NEW diagram');
	assert.deepEqual(created[0].body.doc.nodes.map((n) => n.id), ['node-aa0001', 'node-aa0002']);
	assert.equal(t.sync.hydrated, false, 'and nothing is hydrated until the server answers the create');

	// the local model must NOT have been replaced by the diagram the server happened to name
	assert.equal(t.model.get('node', 'node-aa0001').x, 60, 'the local work still stands');
	assert.equal(t.model.get('node', 'node-bb0001'), undefined, "and the other diagram's content was not adopted");

	// the server mints an id and answers with the new diagram
	const minted = serverDoc('diagram-cc0003', [node('node-aa0001', 60, 60), node('node-aa0002', 120, 60)]);
	t.net.recv({ cmd: 'snapshot', body: { doc: minted, diagrams: [], locked: false, version: 0 } });
	assert.equal(t.sync.diagramId, 'diagram-cc0003');
	assert.equal(t.model.state.meta.id, 'diagram-cc0003', 'the browser is on the diagram its work created');
});

test('B2: a Server-LOCKED diagram is loaded read-only, never offered a create', () => {
	storage.clear();
	const t = tab();
	t.model.put('node', node('node-aa0001', 60, 60));
	const existing = serverDoc('diagram-bb0002', [node('node-bb0001', 300, 300)]);
	t.net.recv({ cmd: 'snapshot', body: { doc: existing, diagrams: [], locked: true, version: 4 } });

	assert.equal(only(t.sent, 'create').length, 0, 'you cannot author into a controlled diagram');
	assert.equal(t.sync.locked, true);
	assert.ok(t.model.get('node', 'node-bb0001'), "the controller's state loaded read-only");
});

// ---- (a) reconnect → resume ----

test('a reconnect sends `resume` with what it believes, never a document', () => {
	storage.clear();
	const t = tab();
	t.net.recv({ cmd: 'snapshot', body: { doc: serverDoc(), diagrams: [], locked: false, version: 5 } });
	t.sent.length = 0;

	t.net.notify('open');                                   // the socket came back
	assert.equal(only(t.sent, 'push').length, 0);
	const resume = only(t.sent, 'resume');
	assert.equal(resume.length, 1);
	assert.deepEqual(resume[0].body, { diagram: 'diagram-aa0001', version: 5 });
});

test('`sync` (in step) keeps the local document and replays the outbox', () => {
	storage.clear();
	const t = tab();
	t.net.recv({ cmd: 'snapshot', body: { doc: serverDoc(), diagrams: [], locked: false, version: 5 } });

	// work committed while the socket is down: applied locally, queued, never sent
	t.net.open = false;
	t.changes.commit({ label: 'create', entries: [{ op: 'put', kind: 'node', entity: node('node-dd0001', 60, 60) }] });
	assert.equal(t.sync.outbox.length, 1);
	assert.ok(t.model.get('node', 'node-dd0001'), 'the local apply stands regardless');

	t.net.open = true;
	t.sent.length = 0;
	t.net.notify('open');
	t.net.recv({ cmd: 'sync', body: { version: 5, canUndo: true, canRedo: false, locked: false } });

	const commits = only(t.sent, 'commit');
	assert.equal(commits.length, 1, 'the queued work went out on reconnect');
	assert.deepEqual(commits[0].body.ops[0].entity.id, 'node-dd0001');
	assert.ok(t.model.get('node', 'node-dd0001'), 'and the local document was never reloaded');
	assert.equal(t.changes.canUndo(), true, 'the server’s authority came through');
});

test('D29: a client AHEAD of the server is TOLD, not silently reverted', () => {
	storage.clear();
	const t = tab();
	t.net.recv({ cmd: 'snapshot', body: { doc: serverDoc(), diagrams: [], locked: false, version: 9 } });
	t.states.length = 0;

	// the server restarted before flushing: it answers resume with less than we hold
	t.net.recv({ cmd: 'snapshot', body: {
		doc: serverDoc(), diagrams: [], locked: false, version: 6, rewound: { from: 9, to: 6 },
	} });

	const told = t.states.find((s) => s.rewound);
	assert.ok(told, 'the readout is handed the rewind');
	assert.deepEqual(told.rewound, { from: 9, to: 6 });
});

test('D28/I16: a rejection reaches the readout WITH the state it needs to render', () => {
	storage.clear();
	const t = tab();
	t.net.recv({ cmd: 'snapshot', body: { doc: serverDoc(), diagrams: [], locked: false, version: 1 } });
	t.changes.commit({ label: 'create', entries: [{ op: 'put', kind: 'node', entity: node('node-ee0001') }] });
	const txnId = t.sync.outbox[0].txnId;
	t.states.length = 0;

	t.net.recv({ cmd: 'error', body: { message: 'commit rejected: bad', code: 'commit-rejected', txnId } });

	const shown = t.states.find((s) => s.error);
	assert.ok(shown, 'the rejection is surfaced, not only logged');
	assert.equal(shown.code, 'commit-rejected');
	assert.ok(shown.meta, 'and carries meta — a bare {error} threw on the way to the readout');
	assert.ok(only(t.sent, 'open').length, 'the refused optimistic apply asks for authoritative state');
});

// ---- D30: the outbox is persisted ----

test('D30: unsent work survives a TAB CLOSE and drains on the next session', () => {
	storage.clear();
	const first = tab();
	first.net.recv({ cmd: 'snapshot', body: { doc: serverDoc(), diagrams: [], locked: false, version: 3 } });
	first.net.open = false;
	first.changes.commit({ label: 'create', entries: [{ op: 'put', kind: 'node', entity: node('node-ff0001', 60, 60) }] });
	assert.ok(storage.has('draw.outbox'), 'the outbox is on disk before the tab dies');

	// the tab closes. A NEW one opens against the same storage and hydrates from scratch.
	const next = tab();
	next.net.recv({ cmd: 'snapshot', body: { doc: serverDoc(), diagrams: [], locked: false, version: 3 } });

	const commits = only(next.sent, 'commit');
	assert.equal(commits.length, 1, 'last session’s unsent work went out');
	assert.equal(commits[0].body.ops[0].entity.id, 'node-ff0001');
	assert.ok(next.model.get('node', 'node-ff0001'), 'and is present locally — the snapshot did not carry it');
});

test('D30: an outbox belonging to ANOTHER diagram is not replayed into this one', () => {
	storage.clear();
	const first = tab();
	first.net.recv({ cmd: 'snapshot', body: { doc: serverDoc('diagram-aa0001'), diagrams: [], locked: false, version: 3 } });
	first.net.open = false;
	first.changes.commit({ label: 'create', entries: [{ op: 'put', kind: 'node', entity: node('node-ff0002') }] });

	assert.ok(storage.has('draw.outbox'), 'the work WAS persisted — what follows tests the filter, not an empty box');

	const next = tab();
	next.net.recv({ cmd: 'snapshot', body: { doc: serverDoc('diagram-zz0009'), diagrams: [], locked: false, version: 0 } });
	assert.equal(only(next.sent, 'commit').length, 0, 'a different diagram gets none of it');

	// control: the SAME record against its own diagram does replay
	const back = tab();
	back.net.recv({ cmd: 'snapshot', body: { doc: serverDoc('diagram-aa0001'), diagrams: [], locked: false, version: 3 } });
	assert.equal(only(back.sent, 'commit').length, 1, 'and its own diagram gets all of it');
});

test('D30: a corrupt persisted outbox costs the replay, never the document', () => {
	storage.clear();
	storage.set('draw.outbox', '{not json');
	const t = tab();
	t.net.recv({ cmd: 'snapshot', body: { doc: serverDoc(), diagrams: [], locked: false, version: 2 } });
	assert.equal(t.sync.hydrated, true, 'the diagram loaded');
	assert.equal(only(t.sent, 'commit').length, 0);

	storage.set('draw.outbox', JSON.stringify({ diagram: 'diagram-aa0001', msgs: [{ ops: 'not-an-array' }, null] }));
	const u = tab();
	u.net.recv({ cmd: 'snapshot', body: { doc: serverDoc(), diagrams: [], locked: false, version: 2 } });
	assert.equal(u.sync.hydrated, true, 'a malformed record is dropped, the document is not');
	assert.equal(only(u.sent, 'commit').length, 0);

	// control: the same envelope, well-formed, DOES replay — the drop above is the shape check
	storage.set('draw.outbox', JSON.stringify({ diagram: 'diagram-aa0001', msgs: [
		{ ops: [{ op: 'put', kind: 'node', entity: node('node-ff0003') }], label: 'create' },
	] }));
	const v = tab();
	v.net.recv({ cmd: 'snapshot', body: { doc: serverDoc(), diagrams: [], locked: false, version: 2 } });
	assert.equal(only(v.sent, 'commit').length, 1);
});

test('D30: undo/redo are NOT persisted — their `expect` is stale the moment the tab closes', () => {
	storage.clear();
	const t = tab();
	t.net.recv({ cmd: 'snapshot', body: { doc: serverDoc(), diagrams: [], locked: false, version: 3 } });
	t.net.open = false;
	t.changes.setCounts({ canUndo: true, version: 3 });
	t.changes.undo();
	assert.equal(t.sync.outbox.length, 1, 'it is queued in memory');
	assert.equal(storage.get('draw.outbox') ?? null, null, 'but nothing verb-shaped was written to disk');

	// control: a commit alongside it IS written, so the absence above is the verb filter
	t.changes.commit({ label: 'create', entries: [{ op: 'put', kind: 'node', entity: node('node-ff0004') }] });
	const saved = JSON.parse(storage.get('draw.outbox'));
	assert.equal(saved.msgs.length, 1, 'only the commit was persisted');
	assert.equal(saved.msgs[0].ops[0].entity.id, 'node-ff0004');
});

// ---- the crash the rewind reply exists for ----

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

test('CS4 gate: a server killed mid-debounce REPORTS the loss — the acked change is never silently reverted', () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-rewind-'));
	try {
		// a long debounce stands in for a process that dies before its flush fires
		const s1 = new Store(dir, { flushMs: 3_600_000 });
		s1.init();
		const id = s1.list()[0].id;
		s1.flushAll();                                       // the seed reaches disk...

		const res = s1.commit(id, { label: 'create', ops: [
			{ op: 'put', kind: 'node', entity: node('node-0a0001', 60, 60) },
		] }, 'client', 'tab-a');
		assert.equal(res.ok, true);
		const acked = res.version;                           // ...and THIS is acked but never flushed

		// the process dies. A new one boots on the same directory.
		const s2 = new Store(dir, { flushMs: 3_600_000 });
		s2.init();
		const reloaded = s2.diagrams.get(id).log.version;
		assert.ok(reloaded < acked, 'the restart really did lose an acked change');
		assert.equal(s2.get(id).get('node', 'node-0a0001'), undefined);

		// the browser reconnects believing `acked` — and is told
		const ws = fakeWs();
		new Session(ws, s2);
		ws.recv('resume', { diagram: id, version: acked });
		const reply = ws.last('snapshot');
		assert.ok(reply, 'a client that is ahead gets the authoritative document');
		assert.deepEqual(reply.body.rewound, { from: acked, to: reloaded });
		assert.equal(ws.last('sync'), undefined, 'and is NOT told it is in step');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('resume: unknown diagram is a typed refusal, and never binds the session', () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-resume-'));
	try {
		const store = new Store(dir, { flushMs: 3_600_000 });
		store.init();
		const ws = fakeWs();
		const session = new Session(ws, store);
		ws.recv('resume', { diagram: 'diagram-ffffff', version: 0 });
		assert.equal(ws.last('error').body.code, 'unknown-diagram');
		assert.equal(session.diagramId, null, 'a refused resume leaves the session unbound');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
