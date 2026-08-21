import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from '../model/index.mjs';
import { Selection } from '../app/src/selection.js';
import { Sync } from '../app/src/sync.js';

// R2: the client forwards a selection (model-state) change to the server on the pulse. Tested with a
// fake net (no browser): construct Sync, clear its auto-pulse, drive flush() manually.
function harness() {
	const sent = [];
	const net = { subscribe() {}, onStatus() {}, isOpen: () => true, send: (cmd, body) => sent.push({ cmd, body }) };
	const model = new Model();
	const selection = new Selection(model);
	// a Changes-shaped stub: Sync reflects the server's authority through it, so a bare
	// { clear() {} } no longer models the collaborator. There is no pulse to clear any more —
	// commits go out on submit; only selection keeps a trailing flush.
	const history = { clear() {}, setCounts() {}, state: { version: 0 } };
	const sync = new Sync({ model, net, history, selection });
	assert.equal(sync.pulse, undefined, 'there is no interval to stop: a commit is not polled');
	sync.hydrated = true;        // forwarding requires hydration
	return { sent, model, selection, sync };
}

test('R2: a selection change forwards a ws select on the next pulse', () => {
	const { sent, model, selection, sync } = harness();
	const n = model.makeNode('router', { x: 0, y: 0 }); model.put('node', n);
	selection.set([n.id]);
	assert.equal(sync.selectionDirty, true, 'selection change marked dirty');
	sync.flush();
	const sel = sent.find((m) => m.cmd === 'select');
	assert.ok(sel, 'a select was forwarded');
	assert.deepEqual(sel.body.ids, [n.id]);
	assert.equal(sync.selectionDirty, false, 'flag cleared after send');
});

test('R2: selection is NOT forwarded while Server-Locked (read-only)', () => {
	const { sent, model, selection, sync } = harness();
	sync.locked = true;
	const n = model.makeNode('router', { x: 0, y: 0 }); model.put('node', n);
	selection.set([n.id]);
	assert.equal(sync.selectionDirty, false, 'locked → change not marked dirty');
	sync.flush();
	assert.ok(!sent.some((m) => m.cmd === 'select'), 'no select forwarded while locked');
});

test('R2: a selection-only change still flushes (empty entity queue)', () => {
	const { sent, model, selection, sync } = harness();
	const n = model.makeNode('router', { x: 0, y: 0 }); model.put('node', n);
	sync.flush();                       // drain the put
	const before = sent.length;
	selection.set([n.id]);              // selection changes, no entity change
	sync.flush();
	assert.equal(sent.length, before + 1, 'the selection-only change flushed');
	assert.equal(sent[sent.length - 1].cmd, 'select');
});

/*
B19 / D12 — inbound changes defer while a gesture is in flight.

D12: "inbound changes apply immediately EXCEPT while `input.mode !== null`, where they queue and
apply on gesture end — otherwise a remote change lands under a live drag preview." Both halves were
built and neither was connected: `deferInbound` is read at sync.js:245 and was assigned nowhere, so
`this.deferred` never filled and `releaseDeferred()` was never called.

That mattered twice over. B7 (preview writes into the shared Model, once per pointer-move frame) has
been recorded as *mitigated by D12's defer rule* since CS3 — mitigated by a rule that was not
running. And GR6's fault (ii) injects a change while a viewer is mid-gesture, so it was exercising a
queue that did not exist: a documented chaos path passing vacuously.
*/

test('B19: a change arriving mid-gesture is queued, not applied under the preview', () => {
	const { sync, model } = harness();
	sync.hydrated = true;
	let gesturing = true;
	sync.deferInbound = () => gesturing;

	const nodeId = 'node-de1e01';
	sync.onMessage({ cmd: 'change', body: { from: sync.changes.state.version, version: sync.changes.state.version + 1,
		ops: [{ op: 'put', kind: 'node', entity: { id: nodeId, name: 'remote', type: 'host', shape: 'circle', x: 60, y: 60 } }] } });

	assert.equal(model.get('node', nodeId), undefined, 'nothing lands while the gesture is live');

	gesturing = false;
	sync.releaseDeferred();
	assert.ok(model.get('node', nodeId), 'and it applies the moment the gesture ends');
});

test('B19: with no gesture in flight, a change applies immediately', () => {
	const { sync, model } = harness();
	sync.hydrated = true;
	sync.deferInbound = () => false;

	const nodeId = 'node-de1e02';
	sync.onMessage({ cmd: 'change', body: { from: sync.changes.state.version, version: sync.changes.state.version + 1,
		ops: [{ op: 'put', kind: 'node', entity: { id: nodeId, name: 'remote', type: 'host', shape: 'circle', x: 0, y: 0 } }] } });
	assert.ok(model.get('node', nodeId), 'the defer rule must not become a delay on the normal path');
});

/*
B60 -- the websocket scheme follows the page, and is not asserted.

`main.js` hardcoded `ws://`. On http://localhost that is correct, which is why every test and every
previous run agreed with it; on https it is blocked as mixed content, so the editor loaded and then
sat empty against a server that was holding the documents. The bug was unreachable by construction
until the first HTTPS deployment, so the fix is a pure function specifically to make it reachable.
*/
import { wsUrl } from '../app/src/net.js';

test('B60: an https page gets wss, and an http page still gets ws', () => {
	assert.equal(wsUrl({ protocol: 'https:', host: 'draw.apnex.io' }), 'wss://draw.apnex.io/ws',
		'a literal ws:// here is blocked as mixed content and the canvas never populates');
	assert.equal(wsUrl({ protocol: 'http:', host: 'localhost:8080' }), 'ws://localhost:8080/ws',
		'local development is unchanged — this is the case the old code got right');
	// a non-default port must survive, since that is how every local instance runs
	assert.equal(wsUrl({ protocol: 'https:', host: 'example.com:8443' }), 'wss://example.com:8443/ws');
});

/*
B71 -- an unsolicited snapshot must not land under a live gesture.

D12 was written for exactly this hazard and covered only the `change` branch. `model.load` fires
the load handler in input.js, which cancels the gesture, and a cancelled link gesture deletes every
waypoint the user placed -- so a lock handoff, a resync, a reclaim or a reconnect that is behind
would erase a route mid-draw, silently. That is the reported symptom: the link fails to connect and
the path clears.

Driven through Sync with a gesture predicate rather than a real Input, because what is under test
is the deferral, not the gesture. B19 already proves bindGestureDefer wires the two together.
*/
function deferrable() {
	const sent = [];
	let recv;
	const net = { status: 'open', subscribe(fn) { recv = fn; }, onStatus() {}, isOpen: () => true,
		send: (cmd, body) => { sent.push({ cmd, body }); return true; } };
	const model = new Model();
	const sync = new Sync({ model, net, history: { clear() {}, setCounts() {}, state: { version: 0 } },
		selection: new Selection(model) });
	let gesturing = false;
	sync.deferInbound = () => gesturing;
	return { sync, model, sent, recv: (m) => recv(m), gesture: (on) => { gesturing = on; } };
}
// built from a real Model rather than hand-rolled: my first version used objects where the
// collections are arrays, and the failure surfaced inside model.load rather than in the assertion
const snap = (id, version) => {
	const doc = new Model().toJSON();
	doc.meta = { ...doc.meta, id, version };
	return { cmd: 'snapshot', body: { doc, diagrams: [], mayWrite: true, locked: false, version } };
};

test('B71: a snapshot arriving mid-gesture is held, not applied under the preview', () => {
	const t = deferrable();
	t.recv(snap('diagram-aaa001', 1));
	assert.equal(t.sync.diagramId, 'diagram-aaa001', 'the first snapshot hydrates normally');

	t.gesture(true);
	t.recv(snap('diagram-bbb002', 2));
	assert.equal(t.sync.diagramId, 'diagram-aaa001', 'the document did NOT change under the gesture');
	assert.ok(t.sync.deferredSnapshot, 'it is held');

	t.gesture(false);
	t.sync.releaseDeferred();
	assert.equal(t.sync.diagramId, 'diagram-bbb002', 'and lands the moment the gesture ends');
	assert.equal(t.sync.deferredSnapshot, null, 'the hold is cleared');
});

test('B71: a held snapshot supersedes held changes, because it is whole state', () => {
	const t = deferrable();
	t.recv(snap('diagram-aaa001', 1));
	t.gesture(true);
	t.recv({ cmd: 'change', body: { version: 2, ops: [] } });
	t.recv(snap('diagram-ccc003', 9));
	assert.equal(t.sync.deferred.length, 1, 'the change queued');
	assert.ok(t.sync.deferredSnapshot, 'and so did the snapshot');

	t.gesture(false);
	t.sync.releaseDeferred();
	assert.equal(t.sync.diagramId, 'diagram-ccc003', 'the snapshot won');
	assert.equal(t.sync.deferred.length, 0, 'and the older deltas were dropped, not replayed onto it');
});

test('B71: a snapshot the user ASKED for is not held — that would feel stuck, not safe', () => {
	const t = deferrable();
	t.recv(snap('diagram-aaa001', 1));
	t.gesture(true);
	t.sync.expectLoad = true;             // set by openDiagram / createDiagram
	t.recv(snap('diagram-ddd004', 3));
	assert.equal(t.sync.diagramId, 'diagram-ddd004', 'a deliberate open lands immediately');
	assert.equal(t.sync.deferredSnapshot, null, 'nothing was held');
});
