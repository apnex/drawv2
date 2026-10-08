/*
B242 / H17-D3 -- how the tab that made a change takes the server's answer to it.

The ruling (dev/DECISIONS.md H17-D3 and its CORRECTED banner, condition C4 of the second M7 pass): the
tab applies the server's planned ops that are NOT its own sent ops echoed back, then replays every op
it has applied and not yet had answered. The filter this replaces skipped any planned op whose
op:kind:id the tab had sent, so a derived op sharing a key with one of the tab's -- the sweep's
corrected group trim beside the tab's own trim -- never reached the tab (B242).

C4 asks for two assertions, and they catch different mutants. S2, S3, undo and redo make both,
convergence first, so a failure names which one caught it:
- CONVERGENCE: once every answer is in, the tab's document equals the server's. The mutant "drop the
  replay step" fails it (S3).
- NO OWN-EDIT REGRESSION: after EVERY message the tab receives, it still shows each value its own
  unanswered ops set. The mutant "take the full answer, no replay" converges and fails only this.
  Checked per message because that is the grain a user can see: a browser paints between tasks, and
  one inbound message is one task, so an intermediate value inside one apply is never on screen
  (INFERRED from the browser's event loop, not measured here).
The live-drag cases assert that a drag already under way is not pulled back.

NOT covered, and measured failing on the K1 bench (lab-design/k1/out/probes.txt, P1): a drag of a node
that ALSO has an unanswered op of the tab's own, such as a nudge still in its burst window, when the
answer to an EARLIER request arrives. The replay re-applies the nudge over the drag, which holds until
the next pointer move rewrites it (INFERRED from app/src/input.js updateMove). Today's filter did not
do this; the ruled rule does, because the drag is in no request.

Real code on both ends, so the answer is the one production builds. The tab is a real Model, Changes
and Sync, wired as app/src/main.js wires them; the server is a real Store behind a real protocol
Session, which builds every ack and reversal. Only the socket is replaced, by two queues the test
drains in order -- which is what lets a test hold an answer back while the tab keeps working. The
scenarios S2 and S3 are the brief's (lab-design/brief/instruments/d3-reconcile-rules.mjs); S3's
replug uses the real builder where the brief hand-built the op.
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Model } from '../model/model.mjs';
import { Changes } from '../app/src/changes.js';
import { Sync } from '../app/src/sync.js';
import { createEntity, deleteSelection, renameEntity, replugLink, nudgeSelection, moveEntities } from '../app/src/commands.js';
import { Session } from '../server/protocol.js';
import { OWNER, openStore } from './fixtures/app.mjs';
import { productKinds } from '../product/kinds.mjs';
import { NETWORK_ROWS } from '../network/kinds.mjs';
import { createNetwork as netFor } from '../network/network.mjs';
import { createTransit as transitFor } from '../network/transit.mjs';
const aNetwork = () => netFor(transitFor());   // a Model holding links is given one (V-e, J2)
const PAGE_KINDS = productKinds(...NETWORK_ROWS);

// ---- the two ends, joined by queues the test drains ----

async function world(seed) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-b242-'));
	const store = await openStore(dir);
	const made = store.create('b242', null, OWNER);
	assert.equal(made.ok, true, made.error);
	const id = made.model.state.meta.id;
	const seeded = store.commit(id, { label: 'seed', ops: seed.map(([kind, entity]) => ({ op: 'put', kind, entity })) },
		'server', 'seed', OWNER);
	assert.equal(seeded.ok, true, seeded.error);

	// server end: the real Session, whose replies wait in `down` until the test delivers them
	const down = [];
	const on = {};
	new Session({ readyState: 1, on: (ev, fn) => { on[ev] = fn; }, send: (text) => down.push(JSON.parse(text)) },
		store, null, null, OWNER);
	const toServer = (cmd, body) => on.message(Buffer.from(JSON.stringify({ cmd, body })));

	// tab end: what the tab sends waits in `up` until the test serves it
	const up = [];
	let receive = () => {};
	const net = {
		status: 'open', subscribe: (fn) => { receive = fn; }, onStatus() {}, isOpen: () => true,
		send: (cmd, body) => { up.push({ cmd, body: JSON.parse(JSON.stringify(body)) }); return true; },
	};
	const tab = new Model({ kinds: PAGE_KINDS, attached: { network: aNetwork() }});   // the kinds the product page composes (S-b, G1)
	// a window that never closes by itself: the test closes it, standing in for the 600ms timer
	const changes = new Changes(tab, { coalesceMs: 3_600_000 });
	const sync = new Sync({ model: tab, net, history: changes, selection: { subscribe() {}, list: () => [], has: () => false, add() {} }, onState() {} });
	changes.onCommit((request) => sync.submit(request));          // app/src/main.js:752

	toServer('hello', { diagram: id });
	while (down.length) receive(down.shift());
	assert.equal(sync.hydrated, true, 'the tab loaded the seeded diagram');

	return {
		tab, changes, sync,
		server: () => store.get(id),
		// the server takes everything the tab has sent, in order; returns what it took
		serve() {
			const taken = up.splice(0);
			for (const m of taken) toServer(m.cmd, m.body);
			return taken;
		},
		// the tab receives the next answer, and the check runs on what it now shows
		deliver(check = () => {}) {
			const m = down.shift();
			assert.ok(m, 'an answer was waiting');
			assert.notEqual(m.cmd, 'error', `the server refused: ${m.body?.message}`);
			receive(m);
			check(m);
			return m;
		},
		pendingAnswers: () => down.length,
		close() { changes.flush(); fs.rmSync(dir, { recursive: true, force: true }); },
	};
}

// document equality, as tests/convergence.test.js reads it: the tab learns its version from the wire
// and never stamps its own meta, so meta.version is not part of the claim
const shape = (m) => {
	const d = m.toJSON();
	delete d.meta.version;
	for (const k of ['nodes', 'links', 'zones', 'groups']) d[k] = [...d[k]].sort((p, q) => p.id.localeCompare(q.id));
	return JSON.stringify(d);
};

// Every value the tab's own unanswered ops set, as the tab now shows it. Later ops win, as they will on
// the server. Returns what is wrong, so a failure names the field and both values.
function ownEditsLost(tab, ops) {
	const want = new Map();
	for (const o of ops) {
		const key = `${o.kind}\u0000${o.id ?? o.entity?.id}`;
		if (o.op === 'del') want.set(key, null);
		else if (o.op === 'put') want.set(key, { ...o.entity });
		else if (o.op === 'set') want.set(key, { ...(want.get(key) || {}), ...o.patch });
	}
	const lost = [];
	for (const [key, fields] of want) {
		const [kind, id] = key.split('\u0000');
		const e = tab.get(kind, id);
		if (fields === null) { if (e) lost.push(`${kind} ${id} is back after the tab deleted it`); continue; }
		for (const [f, v] of Object.entries(fields)) {
			if (JSON.stringify(e?.[f]) !== JSON.stringify(v)) lost.push(`${kind} ${id}.${f} shows ${JSON.stringify(e?.[f])}, not ${JSON.stringify(v)}`);
		}
	}
	return lost;
}

const opsOf = (request) => request.body.ops;

// Convergence is asserted before regression, so a failure names which of C4's two assertions killed it.
const CONVERGED = 'CONVERGENCE: the tab\'s document equals the server\'s once every answer is in';
const NO_REGRESSION = 'NO OWN-EDIT REGRESSION: after every message, the tab still showed what its own unanswered ops set';

// ---- the brief's seeds ----

const A = 'node-00000a', B = 'node-00000b', C = 'node-00000c', D = 'node-00000d';
const W = 'node-0000f1', G = 'group-0000e1';
const L1 = 'link-0000a1', L2 = 'link-0000a2', L3 = 'link-0000a3';

// S1/S2: a bend W on the link a-b, and a group holding a, b, c and W. Deleting a cascades the link,
// which orphans W, which the planner sweeps -- and the sweep trims the group again (B241).
const G1 = [
	['node', { id: A, name: 'a', type: 'host', x: 0, y: 0 }],
	['node', { id: B, name: 'b', type: 'host', x: 240, y: 0 }],
	['node', { id: C, name: 'c', type: 'host', x: 480, y: 0 }],
	['node', { id: W, name: 'wp1', x: 120, y: 120 }],
	['link', { id: 'link-0000c1', name: 'l1', src: A, dst: B, via: [W] }],
	['group', { id: G, name: 'g1', members: [A, B, C, W] }],
];
// S3: a three-way junction W. Deleting L3 leaves W with one link in and one out, and the planner
// collapses L1 and L2 into L1 (B215), rewriting L1's ends.
const G3 = [
	['node', { id: A, name: 'a', type: 'host', x: -480, y: 0 }],
	['node', { id: B, name: 'b', type: 'host', x: 480, y: 0 }],
	['node', { id: C, name: 'c', type: 'host', x: 0, y: 360 }],
	['node', { id: D, name: 'd', type: 'host', x: 0, y: -360 }],
	['node', { id: W, name: 'w', x: 0, y: 0 }],
	['link', { id: L1, name: 'l1', src: A, dst: W }],
	['link', { id: L2, name: 'l2', src: W, dst: B }],
	['link', { id: L3, name: 'l3', src: C, dst: W }],
];
const LONE = [
	['node', { id: A, name: 'a', type: 'host', x: 0, y: 0 }],
	['node', { id: B, name: 'b', type: 'host', x: 240, y: 240 }],
	['group', { id: G, name: 'g1', members: [A, B] }],
];

// ---- C4's required cases ----

test('B242 S2: the sweep\'s corrected group trim reaches the tab that sent its own trim, and a later rename survives', async () => {
	const w = await world(G1);
	try {
		w.changes.commit(deleteSelection(w.tab, new Set([A])));
		w.changes.commit(renameEntity('group', G, 'g1', 'renamed'));   // made before the delete is answered
		const [, rename] = w.serve();

		const lost = [];
		const watch = () => lost.push(...ownEditsLost(w.tab, opsOf(rename)));
		w.deliver(watch);
		w.deliver(watch);
		assert.deepEqual(w.tab.get('group', G).members, w.server().get('group', G).members,
			'the tab lists the members the server does, not a waypoint the sweep removed');
		assert.equal(shape(w.tab), shape(w.server()), CONVERGED);
		assert.deepEqual(lost, [], NO_REGRESSION);
	} finally { w.close(); }
});

test('B242 S3: a collapse the server derives lands, and the tab\'s later replug is replayed over it, never reverted', async () => {
	const w = await world(G3);
	try {
		w.changes.commit(deleteSelection(w.tab, new Set([L3])));
		w.changes.commit(replugLink(L1, A, D));                        // re-point L1 before the delete is answered
		const [, replug] = w.serve();

		// the collapse rewrites L1 in the delete's answer, while the tab's replug of L1 is unanswered
		const lost = [];
		const watch = () => lost.push(...ownEditsLost(w.tab, opsOf(replug)));
		w.deliver(watch);
		w.deliver(watch);
		assert.equal(w.server().get('link', L1).dst, D, 'the server holds the replug');
		assert.equal(w.server().get('link', L2), undefined, 'and the collapse');
		assert.equal(shape(w.tab), shape(w.server()), CONVERGED);
		assert.deepEqual(lost, [], NO_REGRESSION);
	} finally { w.close(); }
});

/*
The live-drag case C4 adds (the second pass's d3-live-gesture, S5), through the real builder.

A drag writes the tab's Model directly on every pointer frame (app/src/input.js updateMove) and is in
no request, so no rule can replay it. What protects it is that the answer to the tab's OWN op is not
re-applied. The real nudge sends `{x, y}` and the planner narrows it to the one field that changed
(planner/txn.mjs narrow), so the echo is not byte-identical to what was sent: read literally, "identical"
would re-apply it and pull the node back to where the nudge left it.
*/
test('C4 live drag: the answer to the tab\'s own nudge does not pull back a drag already moving that node', async () => {
	const w = await world(LONE);
	try {
		w.changes.amend(nudgeSelection(w.tab, [A], 1, 0));
		w.changes.flush();                                            // the window's timer, standing in
		w.serve();
		w.tab.set('node', A, { x: 480, y: 0 });                       // a drag in progress: Input writes the model directly
		const ack = w.deliver();
		assert.deepEqual(Object.keys(ack.body.ops[0].patch), ['x'], 'the planner narrowed the echo, which is the case under test');
		assert.equal(w.tab.get('node', A).x, 480, 'the drag holds; the tab did not snap back to the nudge');
	} finally { w.close(); }
});

test('C4 live drag: a node dragged straight after it was placed is not put back when its creation is answered', async () => {
	const N = 'node-0000aa';
	const w = await world(LONE);
	try {
		w.changes.commit(createEntity('node', { id: N, name: 'n', type: 'host', x: 480, y: 480 }));
		w.serve();
		w.tab.set('node', N, { x: 600, y: 360 });                     // dragged before the put is answered
		w.deliver();
		assert.deepEqual([w.tab.get('node', N).x, w.tab.get('node', N).y], [600, 360], 'the drag holds; the put was not re-applied');
	} finally { w.close(); }
});

test('C4 live drag: a derived op arriving mid-drag lands, and the dragged node stays where the pointer has it', async () => {
	const w = await world(G1);
	try {
		w.changes.commit(deleteSelection(w.tab, new Set([A])));
		w.serve();
		w.tab.set('node', C, { x: 600, y: 120 });                     // dragging c while the delete is answered
		w.deliver();
		assert.equal(w.tab.get('node', W), undefined, 'the sweep landed on the tab');
		assert.deepEqual(w.tab.get('group', G).members, w.server().get('group', G).members, 'and so did its group trim');
		assert.deepEqual([w.tab.get('node', C).x, w.tab.get('node', C).y], [600, 120], 'and the drag did not snap back');
	} finally { w.close(); }
});

/*
A burst of nudges is ONE request holding the same key three times (Changes coalesces them). Each of the
tab's ops vouches for one planned op: matched by key alone, the last sent value would stand for all
three, the first two answers would read as the server's and be applied, and the tab would end on the
middle nudge.
*/
test('C4 burst: a coalesced burst\'s answer converges, and does not re-apply the burst over a drag', async () => {
	const w = await world(LONE);
	try {
		for (let i = 0; i < 3; i++) w.changes.amend(nudgeSelection(w.tab, [A], 1, 0));
		w.changes.flush();
		const [burst] = w.serve();
		assert.equal(opsOf(burst).length, 3, 'one request, three ops on one node');
		w.deliver();
		assert.equal(shape(w.tab), shape(w.server()), 'the burst converged');

		for (let i = 0; i < 3; i++) w.changes.amend(nudgeSelection(w.tab, [A], 0, 1));
		w.changes.flush();
		w.serve();
		const start = { ...w.tab.get('node', A) };
		w.tab.set('node', A, { x: 600, y: 360 });                     // a drag starts before the answer
		w.deliver();
		assert.deepEqual([w.tab.get('node', A).x, w.tab.get('node', A).y], [600, 360], 'the drag holds');
		// the drag ends as commitMove ends one: restore, then commit the move
		w.tab.set('node', A, { x: start.x, y: start.y });
		w.changes.commit(moveEntities([{ kind: 'node', id: A, after: { x: 600, y: 360 } }]));
		w.serve();
		w.deliver();
		assert.equal(shape(w.tab), shape(w.server()), 'and the drag\'s own commit converged');
	} finally { w.close(); }
});

/*
Undo and redo answers CAN arrive with the tab's ops still unanswered (READ, not assumed):
- `Changes.undo` and `redo` close the burst window before the verb goes out (app/src/changes.js), and
  the socket is ordered, so every commit made BEFORE Ctrl+Z is answered before the undo is;
- but nothing holds the tab still while the undo is in flight. Input calls `history.undo()` and returns
  (app/src/input.js onUndoKey), and a commit or a nudge made next is applied to the tab at once.
The server applies those after the reversal, so the reversal's answer must be followed by them. Taking
the whole list and stopping, as the ack did, put the node back where the undo left it and kept it
there: the later commit's own echo was then skipped.
*/
test('C4 undo: a commit made after Ctrl+Z and before its answer is replayed over the reversal', async () => {
	const w = await world(LONE);
	try {
		w.changes.commit(moveEntities([{ kind: 'node', id: A, after: { x: 240, y: 0 } }]));
		w.serve(); w.deliver();

		w.changes.undo();
		w.changes.commit(moveEntities([{ kind: 'node', id: A, after: { x: 480, y: 0 } }]));   // before the undo is answered
		const [verb, move] = w.serve();
		assert.equal(verb.cmd, 'undo');

		const lost = [];
		const watch = (m) => lost.push(...ownEditsLost(w.tab, opsOf(move)).map((l) => `after ${m.body.label}: ${l}`));
		assert.equal(w.deliver(watch).body.label, 'undo');
		w.deliver(watch);
		assert.equal(w.server().get('node', A).x, 480);
		assert.equal(shape(w.tab), shape(w.server()), CONVERGED);
		assert.deepEqual(lost, [], NO_REGRESSION);
	} finally { w.close(); }
});

test('C4 redo: a commit made after Ctrl+Y and before its answer is replayed over the redo', async () => {
	const w = await world(LONE);
	try {
		w.changes.commit(moveEntities([{ kind: 'node', id: A, after: { x: 240, y: 0 } }]));
		w.serve(); w.deliver();
		w.changes.undo();
		w.serve(); w.deliver();
		assert.equal(w.tab.get('node', A).x, 0, 'undone');

		w.changes.redo();
		w.changes.commit(moveEntities([{ kind: 'node', id: A, after: { x: 480, y: 0 } }]));
		const [verb, move] = w.serve();
		assert.equal(verb.cmd, 'redo');

		const lost = [];
		const watch = (m) => lost.push(...ownEditsLost(w.tab, opsOf(move)).map((l) => `after ${m.body.label}: ${l}`));
		assert.equal(w.deliver(watch).body.label, 'redo');
		w.deliver(watch);
		assert.equal(shape(w.tab), shape(w.server()), CONVERGED);
		assert.deepEqual(lost, [], NO_REGRESSION);
	} finally { w.close(); }
});

// "Pending" includes the open burst window, which is applied to the tab and not yet submitted.
test('C4 undo: a nudge still in the open burst window survives the reversal\'s answer', async () => {
	const w = await world(LONE);
	try {
		w.changes.commit(moveEntities([{ kind: 'node', id: A, after: { x: 240, y: 0 } }]));
		w.serve(); w.deliver();

		w.changes.undo();
		w.serve();                                                    // the undo leaves; the nudge below has not
		const nudge = nudgeSelection(w.tab, [A], 1, 0);
		w.changes.amend(nudge);
		const nudged = nudge.entries[0].after;

		w.deliver();
		assert.deepEqual([w.tab.get('node', A).x, w.tab.get('node', A).y], [nudged.x, nudged.y],
			'the undo\'s answer did not revert the nudge the window still holds');
		w.changes.flush();
		w.serve(); w.deliver();
		assert.equal(w.server().get('node', A).x, nudged.x);
		assert.equal(shape(w.tab), shape(w.server()), 'the tab converged on the server');
	} finally { w.close(); }
});

// ---- the three readings of "not identical" that the rule's own tests depend on ----

/*
Order. The planner writes a request's ops in order and advances between them, so a derived op can land
on an entity BEFORE the tab's own later op on it (here: the put steals a from the old group, then the
tab's own set trims it further). The tab applied its op before the derived one existed, so on the tab
the derived op would end on top. Once a derived op has written an entity, a later echo on it is taken.
Hand-built, as a client whose builder and planner disagree would send it; no canvas gesture is claimed.
*/
test('order: an echo that follows a derived write on the same entity is applied, so the tab ends where the server does', async () => {
	const X = 'node-00000e', Gold = 'group-0000e2', Gnew = 'group-0000e3';
	const w = await world([
		['node', { id: A, name: 'a', type: 'host', x: 0, y: 0 }],
		['node', { id: B, name: 'b', type: 'host', x: 240, y: 0 }],
		['node', { id: C, name: 'c', type: 'host', x: 480, y: 0 }],
		['node', { id: D, name: 'd', type: 'host', x: 0, y: 240 }],
		['node', { id: X, name: 'x', type: 'host', x: 240, y: 240 }],
		['group', { id: Gold, name: 'gold', members: [A, C, D, X] }],
	]);
	try {
		w.changes.commit({ label: 'group', entries: [
			{ op: 'put', kind: 'group', entity: { id: Gnew, name: 'gnew', members: [A, B] } },
			{ op: 'set', kind: 'group', id: Gold, after: { members: [C, D] } },
		] });
		w.serve();
		const ack = w.deliver();
		assert.deepEqual(ack.body.ops.filter((o) => o.id === Gold).map((o) => o.patch.members), [[C, D, X], [C, D]],
			'the planner wrote the old group twice, the derived steal first -- the shape under test');
		assert.equal(shape(w.tab), shape(w.server()), 'the tab converged on the server');
	} finally { w.close(); }
});

/*
Value. The planner drops an op that changes nothing (planner/txn.mjs narrow, I6), so an op the tab sent
can have no echo at all -- and a derived op on the same entity, of the same kind or another, must not be
taken for the echo it never had. Here the tab restates both groups' members unchanged beside two
deletes; the planner drops the restatements, then trims one group and dissolves the other. Hand-built,
as a client whose builder restates what it does not change would send it; no canvas gesture is claimed.
*/
test('value: a derived trim or dissolve is not taken for the echo of an own op the planner dropped as a no-op', async () => {
	const E = 'node-00000e', H = 'group-0000e4';
	const w = await world([
		['node', { id: A, name: 'a', type: 'host', x: 0, y: 0 }],
		['node', { id: B, name: 'b', type: 'host', x: 240, y: 0 }],
		['node', { id: C, name: 'c', type: 'host', x: 480, y: 0 }],
		['node', { id: D, name: 'd', type: 'host', x: 0, y: 240 }],
		['node', { id: E, name: 'e', type: 'host', x: 240, y: 240 }],
		['group', { id: G, name: 'g1', members: [A, B, C] }],
		['group', { id: H, name: 'h1', members: [D, E] }],
	]);
	try {
		w.changes.commit({ label: 'delete', entries: [
			{ op: 'set', kind: 'group', id: G, after: { members: [A, B, C] } },
			{ op: 'set', kind: 'group', id: H, after: { members: [D, E] } },
			{ op: 'del', kind: 'node', entity: { id: A } },
			{ op: 'del', kind: 'node', entity: { id: D } },
		] });
		w.serve();
		const ack = w.deliver();
		assert.deepEqual(ack.body.ops.filter((o) => o.kind === 'group').map((o) => `${o.op} ${o.id}`), [`set ${G}`, `del ${H}`],
			'the planner dropped both restatements and derived a trim and a dissolve -- the shape under test');
		assert.deepEqual(w.tab.get('group', G)?.members, [B, C], 'the trim landed');
		assert.equal(w.tab.get('group', H), undefined, 'the dissolve landed');
		assert.equal(shape(w.tab), shape(w.server()), 'the tab converged on the server');
	} finally { w.close(); }
});

/*
Entity. An echo is matched on the entity it names, not on its shape: the planner writes a delete's
cascade BEFORE the delete itself (planner/txn.mjs planDel), and every one of those is a `del`. Here the
tab sends only the node's delete and leaves the cascade to the planner, as a client that does not
restate it would; no canvas gesture is claimed (the browser's deleteSelection sends its cascade).
*/
test('entity: a cascade the planner derives is not taken for the echo of the tab\'s own delete of another entity', async () => {
	const L = 'link-0000c2';
	const w = await world([...LONE, ['link', { id: L, name: 'ab', src: A, dst: B }]]);
	try {
		w.changes.commit({ label: 'delete', entries: [{ op: 'del', kind: 'node', entity: { id: A } }] });
		w.serve();
		const ack = w.deliver();
		assert.deepEqual(ack.body.ops.map((o) => `${o.op} ${o.id}`), [`del ${L}`, `del ${G}`, `del ${A}`],
			'the cascade and the dissolve come before the echo -- the shape under test');
		assert.equal(w.tab.get('link', L), undefined, 'the cascaded link is gone from the tab');
		assert.equal(shape(w.tab), shape(w.server()), 'the tab converged on the server');
	} finally { w.close(); }
});

/*
A request the server answered is the server's now, even when the answer changed nothing. A no-op ack
carries no ops and no version, so an answered request cannot be recognised by its version; replaying it
later would put a live drag back where the no-op said the node already was.
*/
test('answered: a request the server answered as a no-op is never replayed as unanswered', async () => {
	const w = await world(LONE);
	try {
		w.changes.commit(moveEntities([{ kind: 'node', id: A, after: { x: 0, y: 0 } }]));   // where it already is
		w.changes.commit(renameEntity('group', G, 'g1', 'renamed'));
		w.serve();
		w.tab.set('node', A, { x: 480, y: 0 });                       // a drag in progress
		assert.equal(w.deliver().body.noop, true, 'the first answer is a no-op, the case under test');
		w.deliver();
		assert.equal(w.tab.get('node', A).x, 480, 'the drag holds; the no-op move was not replayed over it');
		assert.equal(w.pendingAnswers(), 0);
	} finally { w.close(); }
});
