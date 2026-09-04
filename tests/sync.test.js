import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from '../model/index.mjs';
import { Selection } from '../app/src/selection.js';
import { Sync } from '../app/src/sync.js';
import fs from 'node:fs';

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

test('B76: the client holds its own principal and hands it to the UI', () => {
	const t = deferrable();
	const m = snap('diagram-aaa001', 1);
	m.body.principal = 'user:someone@apnex.com.au';
	t.recv(m);
	assert.equal(t.sync.principal, 'user:someone@apnex.com.au', 'taken from the snapshot');

	const states = [];
	t.sync.onState = (s) => states.push(s);
	t.sync.emitState({});
	assert.equal(states[0].principal, 'user:someone@apnex.com.au', 'and reaches onState for rendering');

	t.recv(snap('diagram-bbb002', 2));   // a snapshot with no principal field
	assert.equal(t.sync.principal, null, 'absent means absent — never a stale identity from a prior load');
});

/*
B106 -- the two paths that set `appliedVersion` and that the convergence harness cannot reach.

Removing either line leaves every GR6 test green, because that harness never sends a snapshot or a
resume. Unasserted is how B106 survived in the first place, so they are held here: after the model
is set wholesale from the server, an inbound change AT that version must APPLY, not be discarded as
a duplicate and not trigger a resync.
*/
function inbound() {
	let onMsg = () => {};
	const sent = [];
	const net = {
		subscribe(fn) { onMsg = fn; },
		onStatus() {},
		isOpen: () => true,
		send: (cmd, body) => sent.push({ cmd, body }),
	};
	const model = new Model();
	const selection = new Selection(model);
	const history = { clear() {}, setCounts() {}, state: { version: 0 } };
	const sync = new Sync({ model, net, history, selection });
	return { sync, model, sent, send: (m) => onMsg(m) };
}

const NODE = { id: 'node-aa0001', name: 'n', type: 'host', x: 0, y: 0 };

test('B106: a change landing on a freshly snapshotted model is applied, not dropped', () => {
	const h = inbound();
	h.sync.expectLoad = true;
	h.send({ cmd: 'snapshot', body: { doc: new Model().toJSON(), version: 7, mayWrite: true } });
	assert.equal(h.sync.appliedVersion, 7, 'the model IS version 7 after the snapshot');
	h.send({ cmd: 'change', body: { from: 7, version: 8, ops: [{ op: 'put', kind: 'node', entity: NODE }] } });
	assert.equal(h.model.all('node').length, 1, 'the change applied');
	assert.equal(h.sync.appliedVersion, 8);
	assert.ok(!h.sent.some((m) => m.cmd === 'open'), 'and it did not mistake being in step for a gap');
});

test('B106: a change landing after a resume in step is applied, not dropped', () => {
	const h = inbound();
	h.send({ cmd: 'sync', body: { version: 4 } });
	assert.equal(h.sync.appliedVersion, 4, 'resume found us in step at 4');
	h.send({ cmd: 'change', body: { from: 4, version: 5, ops: [{ op: 'put', kind: 'node', entity: NODE }] } });
	assert.equal(h.model.all('node').length, 1, 'the change applied');
	assert.ok(!h.sent.some((m) => m.cmd === 'open'), 'and no resync was requested');
});

/*
B105 -- the client holds agent activity as STATE.

The ruling turns on this. A toast is lost when nobody is watching; a state is still there when the
operator next looks, which is what lets "come and see this" and "may I drive" be two values of one
field instead of two mechanisms. So the client must take it from a snapshot as readily as from an
announcement, and must never merge -- the server sends the whole live set, and merging could only
invent an entry the server did not report.
*/
test('B105: agent activity arrives with a snapshot, so connecting late still shows it', () => {
	const h = inbound();
	assert.deepEqual(h.sync.agents, [], 'nothing until told');
	h.sync.expectLoad = true;
	h.send({ cmd: 'snapshot', body: { doc: new Model().toJSON(), version: 1, mayWrite: true,
		agents: [{ principal: 'agent:planner', diagram: 'diagram-aa0001', since: 1, expiresAt: 2 }] } });
	assert.equal(h.sync.agents.length, 1);
	assert.equal(h.sync.agents[0].diagram, 'diagram-aa0001');
});

test('B105: an announcement REPLACES the list rather than merging into it', () => {
	const h = inbound();
	h.send({ cmd: 'agents', body: { agents: [
		{ principal: 'agent:a', diagram: 'diagram-aa0001' }, { principal: 'agent:b', diagram: 'diagram-aa0002' }] } });
	assert.equal(h.sync.agents.length, 2);

	h.send({ cmd: 'agents', body: { agents: [{ principal: 'agent:a', diagram: 'diagram-aa0001' }] } });
	assert.deepEqual(h.sync.agents.map((a) => a.principal), ['agent:a'],
		'agent:b released its lock -- a merge would keep reporting it forever');

	h.send({ cmd: 'agents', body: { agents: [] } });
	assert.deepEqual(h.sync.agents, [], 'and the workspace can go quiet');
});

test('B105: a malformed agents body leaves the client empty rather than broken', () => {
	const h = inbound();
	h.send({ cmd: 'agents', body: {} });
	assert.deepEqual(h.sync.agents, []);
	h.send({ cmd: 'agents', body: { agents: 'not-a-list' } });
	assert.deepEqual(h.sync.agents, []);
});

test('B105: agent activity reaches the UI through the same state callback as everything else', () => {
	let last = null;
	const net = { subscribe(fn) { net._fn = fn; }, onStatus() {}, isOpen: () => true, send() {} };
	const model = new Model();
	const sync = new Sync({ model, net, history: { clear() {}, setCounts() {}, state: { version: 0 } },
		selection: new Selection(model), onState: (s) => { last = s; } });
	net._fn({ cmd: 'agents', body: { agents: [{ principal: 'agent:planner', diagram: 'diagram-aa0001' }] } });
	assert.ok(last, 'onState fired');
	assert.equal(last.agents.length, 1, 'and carried the agents, beside locked/mayWrite/principal');
	assert.equal(sync.agents, last.agents);
});

/*
B162 / I7 -- the server's EXPANSION of our own transaction has to reach the model.

Our ops are applied optimistically, which is why the ack path used to apply the server's list only
for undo and redo. Then `plan()` began adding ops we never sent: a waypoint the transaction orphaned
is swept in the same step. Those deletions arrived in the ack, were skipped, and the bend stayed on
the canvas -- right on the server, stale in the browser, which is the divergence I7 forbids.

The director found this by deleting a link in the editor and watching the waypoint remain. Every
test I had was server-side, where the sweep works perfectly.
*/
test('B162: an ack applies what the server ADDED, and not what we sent', () => {
	const { model, sync } = harness();
	model.put('node', { id: 'node-aa0001', type: 'host', x: 0, y: 0, name: 'a' });
	model.put('node', { id: 'node-aa0002', type: 'host', x: 180, y: 0, name: 'b' });
	model.put('waypoint', { id: 'waypoint-aa0001', name: 'waypoint-aa0001', x: 60, y: 60 });
	model.put('link', { id: 'link-aa0001', name: 'link-aa0001', src: 'node-aa0001', dst: 'node-aa0002', via: ['waypoint-aa0001'] });

	// what the client sent, and applied optimistically
	const mine = [{ op: 'del', kind: 'link', id: 'link-aa0001' }];
	sync.outbox.push({ ops: mine, label: 'delete', txnId: 't1' });
	model.del('link', 'link-aa0001');

	// what the server answers: our op, plus the sweep it added
	sync.onMessage({ cmd: 'ack', body: { acked: 't1', version: 2, label: 'delete',
		ops: [...mine, { op: 'del', kind: 'waypoint', id: 'waypoint-aa0001' }] } });

	assert.equal(model.get('waypoint', 'waypoint-aa0001'), undefined,
		'the swept bend is gone from the client model too');
});

test('B162: an ack does NOT replay our own ops over later local work', () => {
	const { model, sync } = harness();
	model.put('node', { id: 'node-aa0001', type: 'host', x: 0, y: 0, name: 'a' });

	sync.outbox.push({ ops: [{ op: 'set', kind: 'node', id: 'node-aa0001', patch: { x: 60 } }], label: 'move', txnId: 't1' });
	model.set('node', 'node-aa0001', { x: 60 });
	// the user keeps working while the ack is in flight
	model.set('node', 'node-aa0001', { x: 300 });

	/*
	Replaying the whole list would put the node back at 60 -- an older ack clobbering newer local
	work. Applying only the server's ADDITION is what makes that impossible, and it is why this
	filters against the outbox rather than simply calling applyOps on everything.
	*/
	sync.onMessage({ cmd: 'ack', body: { acked: 't1', version: 2, label: 'move',
		ops: [{ op: 'set', kind: 'node', id: 'node-aa0001', patch: { x: 60 } }] } });

	assert.equal(model.get('node', 'node-aa0001').x, 300, 'the later local edit survives the ack');
});

test('B177: the send stamp is consumed by the snapshot it belongs to', () => {
	/*
	Two tabs on one diagram disagreed about the time by tens of seconds. One armed a spawner and the
	other showed no packets at all; armed the other way, the first showed a route already full of
	packets that had never left the source. Both are one clock disagreement seen from either end.

	The cause was a stamp that outlived its request. `requestSentAt` was set when `hello` left and
	never cleared, so a resync arriving a minute later corrected itself against the start of the
	session and the offset absorbed half the tab's age.

	An unsolicited snapshot has no request behind it. Only clearing lets it say so.
	*/
	const { sync } = harness();
	sync.expectLoad = true;
	sync.requestSentAt = Date.now() - 50;
	sync.applySnapshot({ body: { serverNow: Date.now(), doc: (() => { const m = new Model(); m.state.meta.id = "diagram-aa0001"; return m.toJSON(); })(), version: 1 } });
	assert.equal(sync.requestSentAt, null, 'the stamp must not survive the snapshot that used it');

	// and a second, unsolicited snapshot must therefore fall back to arrival rather than reuse it
	const before = sync.clock.skew().offset;
	sync.applySnapshot({ body: { serverNow: Date.now(), doc: (() => { const m = new Model(); m.state.meta.id = "diagram-aa0001"; return m.toJSON(); })(), version: 2 } });
	assert.ok(Math.abs(sync.clock.skew().offset) < 1000,
		`an unsolicited snapshot skewed the clock to ${sync.clock.skew().offset}ms (was ${before}ms)`);
});

test('B177: every open that expects a snapshot stamps its send time', () => {
	// a resync is the commonest late snapshot, and it was the one path that never stamped
	const src = fs.readFileSync(new URL('../app/src/sync.js', import.meta.url), 'utf8');
	const opens = [...src.matchAll(/this\.net\.send\('open'/g)].length;
	const stamps = [...src.matchAll(/this\.requestSentAt = Date\.now\(\)/g)].length;
	assert.ok(stamps >= opens, `${opens} open(s) send a snapshot-bearing request but only ${stamps} stamp`);
});

test('B178: the snapshot pins the socket revision on the watchdog', () => {
	// the wiring, tested because a ladder nobody feeds is a ladder that silently never fires
	const { sync } = harness();
	const pinned = [];
	sync.watchdog = { pin: (r) => pinned.push(r), retire: () => {}, gap: () => {} };
	sync.expectLoad = true;
	sync.applySnapshot({ body: { serverNow: Date.now(), revision: 'draw-00074-dmh',
		doc: (() => { const m = new Model(); m.state.meta.id = 'diagram-aa0001'; return m.toJSON(); })(), version: 1 } });
	assert.deepEqual(pinned, ['draw-00074-dmh'], 'the revision the socket is pinned to must reach the watchdog');
});

test('B178: a retire message reaches the watchdog and is said out loud', () => {
	const { sync } = harness();
	const retired = [];
	sync.watchdog = { pin: () => {}, retire: (r) => retired.push(r), gap: () => {} };
	sync.onMessage({ cmd: 'retire', body: { reason: 'a newer revision is live' } });
	assert.deepEqual(retired, ['a newer revision is live']);
	assert.match(String(sync.said&&sync.said.text), /newer revision/, 'the operator is told why the page is about to change');
});
