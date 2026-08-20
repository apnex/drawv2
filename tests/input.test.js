/*
Characterization of the keyboard command surface — B23 / H2.1, and Stage 0 of H6.

Every assertion here is at the COMMIT BOUNDARY: what ops does this input emit? Nothing reads
`input.mode` or `input.ctx`, and `tools/scan-writers.mjs` fails the gate if anything starts to.
That constraint is what lets these tests survive H6 untouched — `Changes.onCommit` is sovereign to
how a gesture was produced (D4), so rewriting `onDown`/`onMove`/`onUp` into a gesture table at H6.4
cannot move them. A test reading internal state would break there, and the net built to ENABLE the
decomposition would become a tax on it.

These are characterization tests, not specifications: they record what the surface does today so a
refactor can prove it unchanged. Where today's behaviour is a known defect it is marked `todo` with
its row, never asserted as correct and never written around.
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeInput, key, pointer, seedNodes } from './fixtures/client-harness.mjs';
import { validateEntity } from '../server/validate.js';
import { bindGestureDefer } from '../app/src/sync.js';
import * as commands from '../app/src/commands.js';
import { KEYMAP, resolveKey } from '../app/src/keymap.js';
import { GAP, NODE_EXT } from '../app/src/snap.js';
import { Palette } from '../app/src/palette.js';
import { fakeEl } from './fixtures/client-harness.mjs';

const opKinds = (ops) => ops.map((o) => `${o.op}/${o.kind ?? ''}`);

// ---- the surface, as it behaves today ----

test('Delete emits ONE change deleting the selection', () => {
	const h = makeInput();
	try {
		const [a] = seedNodes(h.model, [[0, 0]]);
		h.selection.set([a.id]);
		h.input.onKeyDown(key('Delete'));

		const c = h.soleCommit();
		assert.equal(c.label, 'delete');
		assert.deepEqual(opKinds(c.ops), ['del/node']);
		assert.equal(c.ops[0].id, a.id);
	} finally { h.restore(); }
});

test('deleting a node carries its links in the SAME change — the cascade is one undo step', () => {
	const h = makeInput();
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [60, 0]]);
		h.model.put('link', h.model.makeLink(a.id, b.id));
		h.selection.set([a.id]);
		h.input.onKeyDown(key('Delete'));

		const ops = h.soleCommit().ops;
		assert.deepEqual(opKinds(ops), ['del/link', 'del/node'], 'the link goes first: undo replays reversed, and the server validates referentially');
	} finally { h.restore(); }
});

test('Ctrl+G groups the selection in one change', () => {
	const h = makeInput();
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [60, 0]]);
		h.selection.set([a.id, b.id]);
		h.input.onKeyDown(key('g', { ctrlKey: true }));

		const c = h.soleCommit();
		assert.deepEqual(opKinds(c.ops), ['put/group']);
		assert.deepEqual([...c.ops[0].entity.members].sort(), [a.id, b.id].sort());
	} finally { h.restore(); }
});

test('Z wraps the selection in one fitted zone', () => {
	const h = makeInput();
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [60, 0]]);
		h.selection.set([a.id, b.id]);
		h.input.onKeyDown(key('z'));

		const c = h.soleCommit();
		assert.deepEqual(opKinds(c.ops), ['put/zone']);
		const z = c.ops[0].entity;
		assert.ok(z.x <= -30 && z.y <= -30 && z.w >= 120, `the zone encloses both nodes: ${JSON.stringify(z)}`);
	} finally { h.restore(); }
});

test('L chains the selected nodes pairwise in one change', () => {
	const h = makeInput();
	try {
		const [a, b, c] = seedNodes(h.model, [[0, 0], [60, 0], [120, 0]]);
		h.selection.set([a.id, b.id, c.id]);
		h.input.onKeyDown(key('l'));

		const ops = h.soleCommit().ops;
		assert.deepEqual(opKinds(ops), ['put/link', 'put/link'], 'a 3-node chain is 2 links, one change');
	} finally { h.restore(); }
});

test('L skips a pair that is already linked — no duplicate', () => {
	const h = makeInput();
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [60, 0]]);
		h.model.put('link', h.model.makeLink(a.id, b.id));
		h.selection.set([a.id, b.id]);
		h.input.onKeyDown(key('l'));
		assert.equal(h.commits.length, 0, 'nothing to do is not a change');
	} finally { h.restore(); }
});

test('Ctrl+D duplicates the selection at the remembered pitch', () => {
	const h = makeInput();
	try {
		const [a] = seedNodes(h.model, [[0, 0]]);
		h.selection.set([a.id]);
		h.input.onKeyDown(key('d', { ctrlKey: true }));

		const c = h.soleCommit();
		assert.deepEqual(opKinds(c.ops), ['put/node']);
		assert.equal(c.ops[0].entity.x, 60, 'default pitch is one cell right');
		assert.notEqual(c.ops[0].entity.id, a.id, 'a clone is a new entity');
	} finally { h.restore(); }
});

test('Ctrl+A selects without committing — selection is not a change', () => {
	const h = makeInput();
	try {
		seedNodes(h.model, [[0, 0], [60, 0]]);
		h.input.onKeyDown(key('a', { ctrlKey: true }));
		assert.equal(h.selection.size(), 2);
		assert.equal(h.commits.length, 0);
	} finally { h.restore(); }
});

// ---- the Server-Locked gate (B18's neighbourhood) ----

test('while Server-Locked, mutation keys emit nothing', () => {
	const h = makeInput({ readOnly: true });
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [60, 0]]);
		h.selection.set([a.id, b.id]);
		for (const k of [key('Delete'), key('Backspace'), key('z'), key('l'), key('g', { ctrlKey: true }), key('d', { ctrlKey: true })]) {
			h.input.onKeyDown(k);
		}
		assert.equal(h.commits.length, 0, 'a read-only client must not apply locally what it cannot send');
	} finally { h.restore(); }
});

test('while Server-Locked, selection still works — inspection is not mutation', () => {
	const h = makeInput({ readOnly: true });
	try {
		seedNodes(h.model, [[0, 0], [60, 0]]);
		h.input.onKeyDown(key('a', { ctrlKey: true }));
		assert.equal(h.selection.size(), 2);
		assert.equal(h.commits.length, 0);
	} finally { h.restore(); }
});

// ---- B14: three advertised gestures that throw. Marked, never written around. ----

test('B14: an arrow nudge emits one move change', () => {
	const h = makeInput();
	try {
		const [a] = seedNodes(h.model, [[0, 0]]);
		h.selection.set([a.id]);
		h.input.onKeyDown(key('ArrowRight'));
		h.history.flush();   // D11's window is open until it closes; nothing reaches the wire before

		const c = h.soleCommit();
		assert.deepEqual(opKinds(c.ops), ['set/node']);
		assert.equal(c.ops[0].patch.x, 60);
	} finally { h.restore(); }
});

test('B14: a burst of nudges coalesces into ONE change', () => {
	const h = makeInput();
	try {
		const [a] = seedNodes(h.model, [[0, 0]]);
		h.selection.set([a.id]);
		for (let i = 0; i < 5; i++) h.input.onKeyDown(key('ArrowRight'));
		assert.equal(h.commits.length, 0, 'mid-burst, nothing has gone out yet');
		h.history.flush();

		assert.equal(h.commits.length, 1, 'five keystrokes, one undo step');
		assert.equal(h.soleCommit().ops.length, 5, 'five sets inside it, applied in order');
		assert.equal(h.model.get('node', a.id).x, 300);
	} finally { h.restore(); }
});

test('B14: Shift+arrow resizes the lone selected zone', () => {
	const h = makeInput();
	try {
		const z = h.model.makeZone({ x: -30, y: -30, w: 120, h: 120 });
		h.model.put('zone', z);
		h.selection.set([z.id]);
		h.input.onKeyDown(key('ArrowRight', { shiftKey: true }));
		h.history.flush();

		const c = h.soleCommit();
		assert.deepEqual(opKinds(c.ops), ['set/zone']);
		assert.equal(c.ops[0].patch.w, 180);
	} finally { h.restore(); }
});

/*
B18 + B37 — the read-only gate is POSITIONAL, not semantic.

Server-Locked is enforced by a bare `if (this.readOnly) return;` partway down `onDown` (:213) and
partway down `onKeyDown` (:1444). Whether a verb is gated therefore depends on where its branch
happens to sit in the ladder, not on whether it mutates. That produces both errors at once:

  B18  three MUTATION paths sit ABOVE their guard and run while locked — run-mode content edit,
       the text tool's press, and `t` arming the text tool. Each applies locally and is then
       dropped by Sync (sync.js:62): permanent silent divergence, no resync, no notice.
  B37  two INSPECTION verbs sit BELOW their guard and are wrongly blocked — Ctrl+A and Space/datum
       — though SCOPE decision 5 promises "selection, the data view, and the readout still work".
       Tab/dataview sits in front of the guard and does work, which is the proof that position, and
       nothing else, is deciding.

Fixed together in H3.1 because they are one edit in two directions. The durable fix is H6's keymap
table, where each entry declares whether it mutates and the gate filters on the flag.
*/

test('B18: while Server-Locked, a run-mode click must not reach the label editor', () => {
	const h = makeInput({ readOnly: true });
	try {
		h.renderer.mode = 'run';
		const hitEl = { dataset: { input: '', idx: '0' }, closest: () => ({ id: 'node-aa0001' }), querySelector: () => null };
		const target = { tagName: 'rect', closest: () => hitEl };
		h.input.onDown(pointer(100, 100, { target }));
		assert.equal(h.called('labels.openContent'), false, 'a locked client must not open an editor whose commit it cannot send');
	} finally { h.restore(); }
});

test('B18: while Server-Locked, the text tool cannot be armed', () => {
	const h = makeInput({ readOnly: true });
	try {
		h.input.onKeyDown(key('t'));
		h.input.onDown(pointer(0, 0));
		h.input.onUp(pointer(0, 0));
		assert.equal(h.commits.length, 0, 'a locked client must not author a text box');
		assert.equal(h.model.all('node').length, 0, 'and must not apply one locally either');
	} finally { h.restore(); }
});

test('B37: while Server-Locked, Space still sets a datum — the readout is not a mutation', () => {
	const h = makeInput({ readOnly: true });
	try {
		h.input.onMove(pointer(60, 60));
		h.input.onKeyDown(key(' '));
		assert.equal(h.called('readout.setDatum'), true, 'SCOPE decision 5: the readout still works while locked');
		assert.equal(h.commits.length, 0, 'and it commits nothing, because a datum is not a change');
	} finally { h.restore(); }
});

test('Input constructs with no readout/palette/dataview — the null objects are TOTAL', () => {
	// Pins the defect the harness found on its first run: the defaults advertised these as optional
	// and then threw on readout.signed/dims/flash, so Ctrl+D was unreachable without a real readout.
	const h = makeInput({ bare: true });
	try {
		const [a] = seedNodes(h.model, [[0, 0]]);
		h.selection.set([a.id]);
		assert.doesNotThrow(() => h.input.onKeyDown(key('d', { ctrlKey: true })));
		assert.equal(h.commits.length, 1);
	} finally { h.restore(); }
});

test('while Server-Locked, a run-mode ACTION still fires — it commits nothing', () => {
	// The other half of B18's run-mode split, and the guard against "fixed" meaning "blocked
	// everything". Firing `draw:action` dispatches to the host and mutates no document, so it is
	// inspection and stays live. Blocking it would be B37 all over again, in a new place.
	const h = makeInput({ readOnly: true });
	try {
		h.renderer.mode = 'run';
		const hitEl = { dataset: { action: 'ping' }, closest: () => ({ id: 'node-aa0001' }) };
		const target = { tagName: 'rect', closest: () => hitEl };
		h.input.onDown(pointer(100, 100, { target }));

		// B45 — the host is injected now, so this reads the real outbound boundary instead of
		// monkey-patching globalThis mid-test
		assert.equal(h.dispatched.length, 1, 'the action reached the host');
		assert.equal(h.dispatched[0].detail.action, 'ping');
		assert.equal(h.dispatched[0].detail.id, 'node-aa0001');
		assert.equal(h.commits.length, 0, 'and changed nothing');
	} finally { h.restore(); }
});

test('unlocked, the same three paths still work — the gate is a gate, not a wall', () => {
	// The regression guard for H3.1. Three `!this.readOnly` clauses were added; each could have
	// broken the normal path instead of only the locked one, which would trade B18 for a new B37.
	{	// run-mode inline edit
		const h = makeInput();
		try {
			h.renderer.mode = 'run';
			const hitEl = { dataset: { input: '', idx: '0' }, closest: () => ({ id: 'node-aa0001' }), querySelector: () => null };
			h.input.onDown(pointer(100, 100, { target: { tagName: 'rect', closest: () => hitEl } }));
			assert.equal(h.called('labels.openContent'), true, 'run-mode editing works when unlocked');
		} finally { h.restore(); }
	}
	{	// the text tool arms and authors a box
		const h = makeInput();
		try {
			h.input.onKeyDown(key('t'));
			h.input.onDown(pointer(0, 0));
			h.input.onUp(pointer(0, 0));
			assert.equal(h.commits.length, 1, 'the text tool authors when unlocked');
			assert.deepEqual(opKinds(h.soleCommit().ops), ['put/node']);
		} finally { h.restore(); }
	}
});

test('B14: Shift+arrow grows the lone selected node span — the W1 authoring gesture', () => {
	const h = makeInput();
	try {
		const [n] = seedNodes(h.model, [[0, 0]]);
		h.selection.set([n.id]);
		h.input.onKeyDown(key('ArrowRight', { shiftKey: true }));
		h.input.onKeyDown(key('ArrowDown', { shiftKey: true }));
		h.history.flush();

		const c = h.soleCommit();
		assert.equal(c.label, 'resize');
		assert.deepEqual(c.ops.at(-1).patch.span, { cols: 2, rows: 2 }, 'two presses, one change, cumulative span');
	} finally { h.restore(); }
});

test('D11: a burst does NOT span a selection change', () => {
	// Preserved deliberately. Input used to hold its own coalescing state and null it on selection
	// change; rewiring onto Changes.amend would have dropped that silently, folding two different
	// entity sets into one undoable change. The seam moved into Changes.flush() with the window.
	const h = makeInput();
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [0, 60]]);
		h.selection.set([a.id]);
		h.input.onKeyDown(key('ArrowRight'));
		h.selection.set([b.id]);          // closes the window
		h.input.onKeyDown(key('ArrowRight'));
		h.history.flush();

		assert.equal(h.commits.length, 2, 'two entities nudged across a selection change is two undo steps');
		assert.equal(h.opsOf(0)[0].id, a.id);
		assert.equal(h.opsOf(1)[0].id, b.id);
	} finally { h.restore(); }
});

/*
B30 — cloning a routed link silently straightens it.

`cloneClosure` seeds only node|zone, so waypoints are never cloned, and it rebuilds a cloned link
as `{id, src, dst}` — dropping `via` and `closed`. Ctrl+drag or Ctrl+D over a multi-hop route
therefore produces straight links, with no warning and no readout flash. A route is part of the
link's meaning, so this is silent loss of authored intent, not a cosmetic difference.

Note the trap in the fix: `validate.js` allows a waypoint exactly `{id, x, y}`. The seed loop stamps
`copy.name = nextName(...)` on everything it clones, so adding waypoints to it naively invents a
field the server rejects — the clone would apply locally and then be refused on the wire.
*/

const routed = (h) => {
	const [a, b] = seedNodes(h.model, [[0, 0], [120, 0]]);
	const w = h.model.makeWaypoint({ x: 60, y: 60 });
	h.model.put('waypoint', w);
	const link = { ...h.model.makeLink(a.id, b.id), via: [w.id] };
	h.model.put('link', link);
	return { a, b, w, link };
};

test('B30: duplicating a routed link keeps its route', () => {
	const h = makeInput();
	try {
		const { a, b, w } = routed(h);
		h.selection.set([a.id, b.id]);
		h.input.onKeyDown(key('d', { ctrlKey: true }));

		const ops = h.soleCommit().ops;
		const link = ops.find((o) => o.kind === 'link')?.entity;
		assert.ok(link, 'the link was cloned');
		assert.equal(link.via?.length, 1, 'the clone kept its bend');
		assert.notEqual(link.via[0], w.id, 'and the bend is the CLONED waypoint, not the original');

		const wp = ops.filter((o) => o.kind === 'waypoint').map((o) => o.entity);
		assert.equal(wp.length, 1, 'the via waypoint was pulled into the closure');
		assert.deepEqual(Object.keys(wp[0]).sort(), ['id', 'x', 'y'], 'a waypoint is {id,x,y} — a clone must not invent a name');
	} finally { h.restore(); }
});

test('B30: a closed route stays closed when duplicated', () => {
	const h = makeInput();
	try {
		const { a, b } = routed(h);
		const link = h.model.all('link')[0];
		h.model.set('link', link.id, { closed: true });
		h.selection.set([a.id, b.id]);
		h.input.onKeyDown(key('d', { ctrlKey: true }));

		const clone = h.soleCommit().ops.find((o) => o.kind === 'link')?.entity;
		assert.equal(clone.closed, true, '`closed` is authored state and travels with the clone');
	} finally { h.restore(); }
});

test('B30: an explicitly selected waypoint is cloned', () => {
	const h = makeInput();
	try {
		const { w } = routed(h);
		h.selection.set([w.id]);
		h.input.onKeyDown(key('d', { ctrlKey: true }));

		const ops = h.soleCommit().ops;
		assert.equal(ops.length, 1);
		assert.equal(ops[0].kind, 'waypoint', 'a waypoint is selectable, so it is duplicable');
		assert.notEqual(ops[0].entity.id, w.id);
	} finally { h.restore(); }
});

test('B30: every entity a clone emits passes the SERVER validator', () => {
	// The trap this fix had to avoid, checked across the real boundary rather than by inspection.
	// The seed loop used to stamp a name on everything it cloned; a waypoint admits only {id,x,y},
	// so a naive fix would have applied locally and then been refused on the wire — the exact
	// silent-divergence shape B18 was about, arriving from the other direction.
	const h = makeInput();
	try {
		const { a, b } = routed(h);
		h.model.set('link', h.model.all('link')[0].id, { closed: true });
		h.selection.set([a.id, b.id]);
		h.input.onKeyDown(key('d', { ctrlKey: true }));

		for (const op of h.soleCommit().ops) {
			assert.equal(op.op, 'put');
			assert.equal(validateEntity(op.kind, op.entity), null, `${op.kind} ${op.entity.id} was rejected: ${validateEntity(op.kind, op.entity)}`);
		}
	} finally { h.restore(); }
});

/*
B19 — the WIRING, not the mechanism.

The two sync.test.js cases set `deferInbound` by hand and always passed: the mechanism was never
broken. What was missing was the connection, and a loose property assignment at the composition root
is precisely the thing that gets forgotten — it was, for two milestones, while B7's row recorded the
rule as its mitigation and GR6's fault (ii) exercised a queue that did not exist.

So this drives the REAL Input through the REAL binding. It fails if `bindGestureDefer` stops being
called with both directions, which no test of the mechanism alone can detect.
*/
test('B19: bindGestureDefer connects a live gesture to the inbound queue, both directions', () => {
	const h = makeInput();
	try {
		const released = [];
		const fakeSync = { deferInbound: null, releaseDeferred: () => released.push(1) };
		bindGestureDefer(h.input, fakeSync);

		assert.equal(typeof fakeSync.deferInbound, 'function', 'sync must be able to ASK whether a gesture is live');
		assert.equal(fakeSync.deferInbound(), false, 'idle: nothing to defer');

		seedNodes(h.model, [[0, 0]]);
		h.input.onDown(pointer(0, 0));                       // marquee — a real in-flight gesture
		h.input.onMove(pointer(120, 120));
		assert.equal(fakeSync.deferInbound(), true, 'mid-gesture: inbound must queue');
		assert.equal(released.length, 0, 'and nothing has been released yet');

		h.input.onUp(pointer(120, 120));
		assert.equal(fakeSync.deferInbound(), false, 'the gesture is over');
		assert.ok(released.length >= 1, 'and the queue was released — the other direction of the binding');
	} finally { h.restore(); }
});

test('B19: a cancelled gesture releases the queue too — Escape must not strand it', () => {
	const h = makeInput();
	try {
		const released = [];
		bindGestureDefer(h.input, { deferInbound: null, releaseDeferred: () => released.push(1) });
		seedNodes(h.model, [[0, 0]]);
		h.input.onDown(pointer(0, 0));
		h.input.cancelDrag();
		assert.ok(released.length >= 1, 'however a gesture ends, the deferred changes must land');
	} finally { h.restore(); }
});

/*
B42 — a tool armed BEFORE the lock survives it.

H3.1 made the Server-Locked gate semantic by hoisting inspection verbs above it and gating the
mutation ones. It gated `t` — the key that ARMS the text tool — but not the `textTool` branch in
onDown, which sits above the read-only gate. So the sequence "arm the tool, then get locked" walks
straight past it: a text box is authored, applied locally, and dropped by Sync (sync.js:62).
Permanent silent divergence, which is the exact failure B18 was about.

Found by AUDITING the recognizer for docs/spec/INPUT.md rather than by a test failing — the ordered
branches of onDown were written out as a table, and this one was visibly above a gate it depends on.
That is the argument for the recognizer being a table: the ordering is the thing that is wrong, and
in a 167-line ladder the ordering is invisible.

The positional fix was incomplete in precisely the way positional fixes always are.
*/
test('B42: a text tool armed before the lock does not survive it', () => {
	const h = makeInput();
	try {
		h.input.onKeyDown(key('t'));       // armed while editable
		h.input.setReadOnly(true);         // an agent takes the lock
		h.input.onDown(pointer(0, 0));
		h.input.onUp(pointer(0, 0));

		assert.equal(h.commits.length, 0, 'a locked client must not author a text box');
		assert.equal(h.model.all('node').length, 0, 'and must not apply one locally either');
	} finally { h.restore(); }
});

test('B42: the tool is still armable, and still works, once control is reclaimed', () => {
	const h = makeInput();
	try {
		h.input.onKeyDown(key('t'));
		h.input.setReadOnly(true);
		h.input.setReadOnly(false);        // the human reclaims
		h.input.onKeyDown(key('t'));       // re-arm — the lock disarmed it, so this is a fresh arm
		h.input.onDown(pointer(0, 0));
		h.input.onUp(pointer(0, 0));
		assert.equal(h.commits.length, 1, 'a gate is a gate, not a wall');
	} finally { h.restore(); }
});

/*
H6.4 — the gesture table drives the full lifecycle, not just `start`.

Escalation is the SECOND gate point (INPUT.md §4): a press is not yet a mutation, so `press` is
`mutates:false` and the read-only decision has to be made again when the drag begins. One flag
cannot know whether you are about to drag.

These drive real pointer sequences through the table — down, move past the threshold, up — because
the escalation is the one part of the recognizer's contract that a single event cannot exercise.
*/
const onEntity = (id, x, y, mod = {}) => pointer(x, y, {
	target: { tagName: 'g', classList: { contains: () => false }, dataset: {}, closest: (s) => (s.includes('node') ? { id } : null) },
	...mod,
});

test('H6.4: a right-drag escalates pending → move and commits the transition', () => {
	const h = makeInput();
	try {
		const [a] = seedNodes(h.model, [[0, 0]]);
		h.input.onDown(onEntity(a.id, 0, 0, { button: 2 }));
		h.input.onMove(onEntity(a.id, 180, 0, { button: 2 }));
		h.input.onUp(onEntity(a.id, 180, 0, { button: 2 }));

		assert.equal(h.commits.length, 1, 'one drag is one change');
		assert.equal(h.model.get('node', a.id).x, 180, 'and it landed on the grid');
	} finally { h.restore(); }
});

test('H6.4: Ctrl+right-drag escalates clone-pending → clone', () => {
	const h = makeInput();
	try {
		const [a] = seedNodes(h.model, [[0, 0]]);
		h.input.onDown(onEntity(a.id, 0, 0, { button: 2, ctrlKey: true }));
		h.input.onMove(onEntity(a.id, 180, 0, { button: 2, ctrlKey: true }));
		h.input.onUp(onEntity(a.id, 180, 0, { button: 2, ctrlKey: true }));

		assert.equal(h.commits.length, 1);
		assert.equal(h.model.all('node').length, 2, 'the original stayed, the copy landed');
	} finally { h.restore(); }
});

test('H6.4: while Server-Locked a press still selects, but the drag never escalates', () => {
	const h = makeInput({ readOnly: true });
	try {
		const [a] = seedNodes(h.model, [[0, 0]]);
		h.input.onDown(onEntity(a.id, 0, 0));
		assert.ok(h.selection.has(a.id), 'click-select survives the gate — SCOPE decision 5');

		h.input.onMove(onEntity(a.id, 180, 0));
		h.input.onUp(onEntity(a.id, 180, 0));
		assert.equal(h.commits.length, 0, 'but the escalation is refused');
		assert.equal(h.model.get('node', a.id).x, 0, 'and nothing moved, even locally');
	} finally { h.restore(); }
});

/*
H6.4 — commit and cancel join the table, so a gesture's whole lifecycle is one entry.

B43 is the reason this matters. `dispatchUp` ended with a trailing `onGestureEnd()` that only
`resize` could reach, because all fourteen other branches returned early. Correctness by "every
branch remembers to return" is not correctness; `onUp`'s `finally` now owns the hook alone.
*/
const handle = (corner, x, y) => pointer(x, y, {
	target: { tagName: 'circle', classList: { contains: (c) => c === 'handle' }, dataset: { corner }, closest: () => null },
});

test('B43: a resize commit fires the gesture-end hook exactly once', () => {
	const h = makeInput();
	try {
		const z = h.model.makeZone({ x: 0, y: 0, w: 300, h: 300 });
		h.model.put('zone', z);
		h.selection.set([z.id]);

		h.input.onDown(handle('se', 300, 300));
		let fired = 0;
		h.input.onGestureEnd = () => fired++;
		h.input.onMove(handle('se', 480, 480));
		// the live preview moved, so the handle genuinely armed a resize — this test is not vacuous
		assert.equal(h.model.get('zone', z.id).w, 510, 'the grabbed handle is dragging the zone');
		h.input.onUp(handle('se', 480, 480));

		assert.equal(fired, 1, 'D12 fires once per gesture — a double replay is the latent bug');
		assert.equal(h.model.get('zone', z.id).w, 510, 'and the resize committed');
		assert.equal(h.commits.length, 1);
	} finally { h.restore(); }
});

test('H6.4: a cancelled resize restores the pre-drag geometry', () => {
	const h = makeInput();
	try {
		const z = h.model.makeZone({ x: 0, y: 0, w: 300, h: 300 });
		h.model.put('zone', z);
		h.selection.set([z.id]);

		h.input.onDown(handle('se', 300, 300));
		h.input.onMove(handle('se', 480, 480));
		assert.equal(h.model.get('zone', z.id).w, 510, 'the live preview writes the shared Model (B7)');

		h.input.cancelDrag();
		assert.equal(h.model.get('zone', z.id).w, 300, 'and a cancel rewinds it');
		assert.equal(h.commits.length, 0, 'with nothing in history');

		// the gesture is really over, not merely rewound: further movement must not resize
		h.input.onMove(handle('se', 600, 600));
		assert.equal(h.model.get('zone', z.id).w, 300, 'a dead gesture does not track the pointer');
	} finally { h.restore(); }
});

test('H6.4: a right-button release during link mode does not commit a segment', () => {
	const h = makeInput();
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [180, 0]]);
		h.input.onDown(onEntity(a.id, 0, 0));
		h.input.onMove(onEntity(b.id, 180, 0));
		h.input.onUp(onEntity(b.id, 180, 0, { button: 2 }));
		assert.equal(h.model.all('link').length, 0, 'a stray right-release commits no segment');

		// and the gesture is still LIVE, not silently dead: the real release still lands the link
		h.input.onUp(onEntity(b.id, 180, 0, { button: 0 }));
		assert.equal(h.model.all('link').length, 1, 'the left release ends the link normally');
		assert.equal(h.model.linkBetween(a.id, b.id) ? 1 : 0, 1, 'between the two nodes dragged');
	} finally { h.restore(); }
});

/*
B44 / H6.2 Tier B — every committed action comes from a builder.

These assert the two invariants commands.js states at the top of itself and, until now, only stated:
no entry carries `before` (changes.js drops it; the server derives the inverse from its own
pre-state), and a `put` entry never aliases the live store. Both were violated by commands built
inline, and neither violation was observable by running the app — which is why the enforcement is a
scanner and these tests cover the behaviour the migration had to preserve.
*/
test('B44: no builder emits a `before` — the wire drops it and the server derives the inverse', () => {
	const h = makeInput();
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [180, 0]]);
		const z = h.model.makeZone({ x: 0, y: 0, w: 300, h: 300 });
		h.model.put('zone', z);
		const link = h.model.makeLink(a.id, b.id);
		h.model.put('link', link);

		const built = [
			commands.resizeZone(z.id, { x: 0, y: 0, w: 9, h: 9 }),
			commands.resizeNodeSpan(a.id, { cols: 2, rows: 3 }),
			commands.replugLink(link.id, a.id, b.id),
			commands.retypeNode(a.id, 'host'),
			commands.toggleClosed(link),
			commands.renameDocument('x'),
			commands.bindSlides('u'),
			commands.linkNodes(h.model, [a.id, b.id], false),
			commands.routeLink([], link),
		];
		for (const cmd of built) {
			for (const e of cmd.entries) {
				assert.ok(!('before' in e), `${cmd.label} still carries before`);
			}
		}
	} finally { h.restore(); }
});

test('B44: a put builder deep-copies `via`, so history never aliases the live link', () => {
	const live = { id: 'link-x', src: 'a', dst: 'b', via: ['w1', 'w2'] };

	const routed = commands.routeLink([], live);
	live.via.push('w3');
	assert.equal(routed.entries[0].entity.via.length, 2, 'routeLink must not alias the live via array');

	// cloneEntities is the other builder handed entities it did not create. It was the ONE put
	// builder still spreading them shallowly until H6.11.
	const cloned = commands.cloneEntities([{ kind: 'link', entity: live }]);
	live.via.push('w4');
	assert.equal(cloned.entries[0].entity.via.length, 3, 'cloneEntities must not alias it either');
});

test('B44: the migrated commands still do their jobs', () => {
	const h = makeInput();
	try {
		const [a, b, c] = seedNodes(h.model, [[0, 0], [180, 0], [360, 0]]);

		h.selection.set([a.id, b.id, c.id]);
		h.input.linkSelectedNodes(false);
		assert.equal(h.model.all('link').length, 2, 'chain wires n1-n2, n2-n3');

		const link = h.model.all('link')[0];
		h.model.set('link', link.id, { via: ['w1'] });
		h.selection.set([link.id]);
		h.input.toggleClosePath();
		assert.equal(h.model.get('link', link.id).closed, true, 'C closes a multi-hop route');
		h.input.toggleClosePath();
		assert.equal(h.model.get('link', link.id).closed, false, 'and re-opens it');
	} finally { h.restore(); }
});

/*
B45 — Input's collaborators all arrive through its constructor, including the host surface.

The point is composability, not purity for its own sake: a module that reaches for `window` can only
be tested by installing a fake global, and can only ever run in one kind of page. These assert the
injected surface is genuinely the one used, so the seal is behavioural and not just a scanner rule.
*/
test('B45: keyboard listeners bind to the injected host, not a global', () => {
	const bound = [];
	const host = { addEventListener: (t) => bound.push(t), removeEventListener() {}, dispatchEvent() { return true; } };
	const h = makeInput({ host });
	try {
		assert.deepEqual(bound.sort(), ['keydown', 'keyup'], 'both key listeners went to the host it was given');
	} finally { h.restore(); }
});

test('B45: the help element is the injected one — not a second lookup of the same id', () => {
	const h = makeInput();
	try {
		assert.equal(h.input.help, h.help, 'one owner of #help, and it is the composition root');
		h.input.onKeyDown(key('?', { shiftKey: true }));
		assert.equal(h.help.hidden, false, 'and toggling help acts on that very element');
	} finally { h.restore(); }
});

/*
B36 remainder — one crosshair, one corner table.

The crosshair defect was never visible: Overlay and Palette each built their own on #snaplayer, and
the only reason two were never drawn at once is that onDown happens to call palette.hideHand() before
starting a gesture. Correct by remembering, not by construction — B43's shape exactly. This asserts
the shared instance, because that is what makes a second one impossible rather than merely absent.
*/
test('B36: Overlay and Palette share ONE crosshair, so #snaplayer has a single owner', () => {
	const h = makeInput();
	try {
		const layer = h.layers['#snaplayer'];
		assert.equal(layer.children.length, 0, 'nothing drawn at rest');

		// the PALETTE path: an armed stamp hand tracks the snapped cell
		const palette = new Palette({
			container: fakeEl('div'), svg: h.svg, model: h.model,
			history: h.history, selection: h.selection, snap: h.snap,
		});
		palette.setHand('host');
		palette.trackHand({ x: 0, y: 0 }, false);
		const oneCrosshair = layer.children.filter((c) => c.tagName !== 'G').length;
		assert.ok(oneCrosshair > 0, 'the palette drew a crosshair, or this test proves nothing');

		// the INPUT path, on the same layer, without the palette having hidden its own first.
		// Two owners put two crosshairs here; one owner moves the one that exists.
		h.input.overlayUi.crosshair.show({ x: 180, y: 180 });
		assert.equal(
			layer.children.filter((c) => c.tagName !== 'G').length, oneCrosshair,
			'still exactly one crosshair — Overlay and Palette are driving the same instance',
		);
	} finally { h.restore(); }
});

test('B36: a zone resize pins the corner opposite the grabbed handle', () => {
	const h = makeInput();
	try {
		const z = h.model.makeZone({ x: 0, y: 0, w: 300, h: 300 });
		h.model.put('zone', z);
		h.selection.set([z.id]);

		// grab NW and drag it outward past the origin; SE must not move
		h.input.onDown(handle('nw', 0, 0));
		h.input.onMove(handle('nw', -180, -180));
		h.input.onUp(handle('nw', -180, -180));

		const after = h.model.get('zone', z.id);
		assert.equal(after.x + after.w, 300, 'the SE corner stayed put in x');
		assert.equal(after.y + after.h, 300, 'and in y');
		assert.ok(after.x < 0, 'while NW followed the pointer');
	} finally { h.restore(); }
});

/*
B48 — the keymap resolves the INTENT, not just the key.

`plain()` deliberately ignores Shift, so five bindings used to match one entry and re-branch inside
their handler. The table therefore under-reported its own key surface, and in one case said
something false: `redo` matched only Ctrl+Y, while Ctrl+Shift+Z matched `undo` and was redirected to
redo in the handler. A reader of the table concluded Ctrl+Shift+Z undoes.

That matters because the table's whole value is being readable as the complete key surface — B42 was
found by writing a ladder out as a table and seeing what the ordering hid. These tests pin each
Shift variant to its own verb so the split cannot silently re-merge.
*/
test('B48: Ctrl+Shift+Z redoes — the table no longer says it undoes', () => {
	const h = makeInput();
	try {
		h.input.onKeyDown(key('z', { ctrlKey: true, shiftKey: true }));
		assert.deepEqual(h.commits.map((c) => c.verb), ['redo']);

		h.reset();
		h.input.onKeyDown(key('z', { ctrlKey: true }));
		assert.deepEqual(h.commits.map((c) => c.verb), ['undo'], 'and plain Ctrl+Z still undoes');

		h.reset();
		h.input.onKeyDown(key('y', { ctrlKey: true }));
		assert.deepEqual(h.commits.map((c) => c.verb), ['redo'], 'Ctrl+Y remains the other route to redo');
	} finally { h.restore(); }
});

test('B48: Shift+L stars from the first selection; plain L chains', () => {
	for (const [star, expected] of [[false, 'chain'], [true, 'star']]) {
		const h = makeInput();
		try {
			const [a, b, c] = seedNodes(h.model, [[0, 0], [180, 0], [360, 0]]);
			h.selection.set([a.id, b.id, c.id]);
			h.input.onKeyDown(key('l', { shiftKey: star }));

			assert.equal(h.soleCommit().label, expected);
			assert.equal(h.model.all('link').length, 2, 'two links either way');
			// the topology is the point: a star has both links touching the FIRST node
			const touchingA = h.model.all('link').filter((l) => l.src === a.id || l.dst === a.id).length;
			assert.equal(touchingA, star ? 2 : 1, `${expected} wires the right shape`);
		} finally { h.restore(); }
	}
});

test('B48: Ctrl+Shift+G ungroups; Ctrl+G groups', () => {
	const h = makeInput();
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [180, 0]]);
		h.selection.set([a.id, b.id]);

		h.input.onKeyDown(key('g', { ctrlKey: true }));
		assert.equal(h.soleCommit().label, 'group');
		assert.equal(h.model.all('group').length, 1);

		h.reset();
		h.selection.set([a.id, b.id]);
		h.input.onKeyDown(key('g', { ctrlKey: true, shiftKey: true }));
		assert.equal(h.soleCommit().label, 'ungroup');
		assert.equal(h.model.all('group').length, 0, 'the group is gone, not re-made');
	} finally { h.restore(); }
});

/*
B48's actual defect was never behavioural — Ctrl+Shift+Z always redid. What was wrong is that the
TABLE said otherwise: the keystroke matched the entry named `undo`, and the handler quietly
redirected. The three tests above are regression guards for the split and pass either way; this is
the one that fails on the pre-split table, because the thing being fixed is whether a rule's id
tells the truth about what the keystroke does.
*/
test('B48: the matched rule NAMES the verb — the table is readable as the key surface', () => {
	const cases = [
		[' ',         {},                            'datum'],
		[' ',         { shiftKey: true },            'datum-clear'],
		['ArrowLeft', {},                            'nudge'],
		['ArrowLeft', { shiftKey: true },            'resize-step'],
		['l',         {},                            'chain'],
		['l',         { shiftKey: true },            'star'],
		['z',         { ctrlKey: true },             'undo'],
		['z',         { ctrlKey: true, shiftKey: true }, 'redo'],
		['y',         { ctrlKey: true },             'redo'],
		['g',         { ctrlKey: true },             'group'],
		['g',         { ctrlKey: true, shiftKey: true }, 'ungroup'],
	];
	const ctx = { readOnly: false, helpOpen: false, gesturing: false };
	for (const [k, mod, id] of cases) {
		const rule = resolveKey(key(k, mod), ctx);
		assert.ok(rule, `${id}: nothing matched`);
		assert.equal(rule.id, id, `${JSON.stringify(mod)}+${k} must resolve to '${id}', got '${rule.id}'`);
	}
});

test('B48: splitting kept the table unambiguous — still exactly one overlapping pair', () => {
	// The ordering claim in keymap.js is that Ctrl+Shift+Backspace is the ONLY keystroke matching
	// more than one entry. Four new entries could have broken that, so it is re-enumerated rather
	// than assumed — the same discipline that found the claim was wrong the first time.
	const keys = [' ', 'Escape', 'Tab', 'Enter', 'Delete', 'Backspace', 'F2', '/', '?', 'Shift', 'Alt', 'Control',
		...'abcdefghijklmnopqrstuvwxyz', ...'1234567',
		'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
	const mods = [{}, { shiftKey: true }, { ctrlKey: true }, { ctrlKey: true, shiftKey: true },
		{ altKey: true }, { metaKey: true }];
	const overlaps = [];
	for (const k of keys) {
		for (const m of mods) {
			const e = key(k, m);
			const hits = KEYMAP.filter((r) => r.when(e, {}));
			if (hits.length > 1) overlaps.push(`${JSON.stringify(m)}+${k} -> ${hits.map((h) => h.id).join('/')}`);
		}
	}
	assert.deepEqual(overlaps, [
		'{"ctrlKey":true,"shiftKey":true}+Backspace -> undo-run/delete',
	], 'exactly one ordered pair, and it is the D21 one keymap.js documents');
});

/*
B47 — `preventDefault` is a property of the binding, declared once, not repeated in 17 handlers.

The defect was not the repetition. It was that six handlers omitted the call and nothing recorded
whether that was a decision or a lapse — going back to the pre-H6.4 ladder, none of them ever had
it and no comment said why. A table field makes every non-prevention deliberate and visible.

`prevent: false` carries two distinct legitimate reasons, and this pins both so neither can be
"tidied" into the other: Escape must let the browser exit fullscreen, while five handlers claim
their key only on the path that acts — a runtime condition a static table cannot see.
*/
test('B47: the dispatcher claims a bound key by default', () => {
	const h = makeInput();
	try {
		let prevented = 0;
		const press = (k, mod = {}) => {
			const e = key(k, mod);
			e.preventDefault = () => { prevented++; };
			h.input.onKeyDown(e);
			return prevented;
		};
		prevented = 0; press('z', { ctrlKey: true });
		assert.equal(prevented, 1, 'Ctrl+Z is ours');
		prevented = 0; press('s');
		assert.equal(prevented, 1, "'s' is ours too — it used to silently let the browser act");
		prevented = 0; press('F9');
		assert.equal(prevented, 0, 'an UNBOUND key is never claimed');
	} finally { h.restore(); }
});

test('B47: Escape stays the browser\'s — the one binding that must not be claimed', () => {
	const h = makeInput();
	try {
		let prevented = 0;
		const e = key('Escape');
		e.preventDefault = () => { prevented++; };
		h.input.onKeyDown(e);
		assert.equal(prevented, 0, 'exiting fullscreen and cancelling an IME composition are the browser\'s');
	} finally { h.restore(); }
});

test('B47: a conditional claimer prevents only on the path that acts', () => {
	const h = makeInput();
	try {
		const press = () => {
			let n = 0;
			const e = key('Delete');
			e.preventDefault = () => { n++; };
			h.input.onKeyDown(e);
			return n;
		};
		h.selection.clear();
		assert.equal(press(), 0, 'nothing selected: Delete was not ours to take');

		const [a] = seedNodes(h.model, [[0, 0]]);
		h.selection.set([a.id]);
		assert.equal(press(), 1, 'with a selection it acts, so it claims the key');
	} finally { h.restore(); }
});

test('B47: every entry declares prevent, or inherits the safe default', () => {
	const optOut = KEYMAP.filter((r) => r.prevent === false).map((r) => r.id).sort();
	assert.deepEqual(optOut, ['alt', 'control', 'dataview', 'delete', 'escape', 'stamp', 'waypoint'],
		'the opt-outs are a closed, reviewed set — a new one has to be argued for here');
	for (const r of KEYMAP) {
		assert.ok(r.prevent === undefined || r.prevent === false,
			`${r.id}: prevent is opt-out only; true is the default and stating it is noise`);
	}
});

/*
B46 (pure half) — four builders that COMPUTE moved to commands.js.

They are testable directly now, which is the point: each takes a model and a selection and answers
"what change does this intent produce", with no Input, no event and no gesture state. They self-guard
and return empty entries, because `Changes.commit`/`amend` both no-op on an empty command — that is
what lets the call sites be one line.
*/
test('B46: wrapSelection fits a zone to the selection, and yields nothing for a link-only one', () => {
	const h = makeInput();
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [180, 180]]);
		const cmd = commands.wrapSelection(h.model, [a.id, b.id]);
		const zone = cmd.entries[0].entity;
		assert.ok(zone.x < 0 && zone.y < 0, 'the box snaps OUT past the nodes');
		assert.ok(zone.x + zone.w > 180 && zone.y + zone.h > 180, 'and encloses the far one');

		const link = h.model.makeLink(a.id, b.id);
		h.model.put('link', link);
		assert.equal(commands.wrapSelection(h.model, [link.id]).entries.length, 0,
			'a link has no x — nothing to wrap');
		assert.equal(commands.wrapSelection(h.model, []).entries.length, 0);
	} finally { h.restore(); }
});

test('B46: nudgeSelection clamps at the canvas edge and yields nothing when it cannot move', () => {
	const h = makeInput();
	try {
		const [a] = seedNodes(h.model, [[0, 0]]);
		const cmd = commands.nudgeSelection(h.model, [a.id], 1, 0);
		assert.equal(cmd.entries[0].after.x, GAP, 'one cell right');

		// park it ON the node extent — note that is NODE_EXT, not CANVAS.hw: the canvas is wider than
		// the area a node may occupy, and clamping to the wrong one reads as a passing test that
		// proves nothing (from CANVAS.hw the clamp pulls the node BACK, a perfectly real change).
		h.model.set('node', a.id, { x: NODE_EXT.x });
		assert.equal(commands.nudgeSelection(h.model, [a.id], 1, 0).entries.length, 0,
			'clamped flat against the edge — no change, so no command');
		assert.equal(commands.nudgeSelection(h.model, [a.id], -1, 0).entries.length, 1,
			'but it can still come back the other way');
	} finally { h.restore(); }
});

test('B46: the two Shift+arrow builders self-guard, so exactly one ever acts', () => {
	const h = makeInput();
	try {
		const [n] = seedNodes(h.model, [[0, 0]]);
		const z = h.model.makeZone({ x: 0, y: 0, w: 300, h: 300 });
		h.model.put('zone', z);

		assert.equal(commands.resizeNodeStep(h.model, [z.id], 1, 0).entries.length, 0, 'zone selected: node builder is silent');
		assert.equal(commands.resizeZoneStep(h.model, [z.id], 1, 0).entries.length, 1, 'zone builder acts');

		assert.equal(commands.resizeZoneStep(h.model, [n.id], 1, 0).entries.length, 0, 'node selected: zone builder is silent');
		assert.equal(commands.resizeNodeStep(h.model, [n.id], 1, 0).entries[0].after.span.cols, 2, 'node builder grows the span');

		assert.equal(commands.resizeZoneStep(h.model, [z.id, n.id], 1, 0).entries.length, 0, 'a MIXED selection resizes nothing');
	} finally { h.restore(); }
});

/*
B46 (allocating half) — a scratch projection replaces the eager put.

Three builders had to write into the LIVE model as they worked, for two different reasons that look
the same from the call site: `newId` and `nextName` read the namespace to stay unique, and
`linkBetween` reads it to skip an existing pair. Both break for sibling k when k-1 is not there yet.
`model/projection()` — the planner's own trick, promoted — gives the batch a namespace containing
itself, so nothing real is touched until the command is committed.
*/
test('B46: cloneSubgraph names siblings uniquely and touches nothing real', () => {
	const h = makeInput();
	try {
		const ns = seedNodes(h.model, [[0, 0], [180, 0], [360, 0]]);
		const before = h.model.all('node').length;

		const { clones } = commands.cloneSubgraph(h.model, ns.map((n) => n.id));
		const names = clones.map((c) => c.entity.name);
		assert.equal(new Set(names).size, 3, `siblings must not collide, got ${JSON.stringify(names)}`);
		assert.equal(new Set(clones.map((c) => c.entity.id)).size, 3, 'nor may their ids');
		assert.equal(h.model.all('node').length, before, 'and the live model is untouched');
	} finally { h.restore(); }
});

test('B46: cloneSubgraph carries a route and gives it its OWN bends', () => {
	const h = makeInput();
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [360, 0]]);
		const wp = h.model.makeWaypoint({ x: 180, y: 60 });
		h.model.put('waypoint', wp);
		const link = { ...h.model.makeLink(a.id, b.id), via: [wp.id], closed: true };
		h.model.put('link', link);

		const { clones } = commands.cloneSubgraph(h.model, [a.id, b.id]);
		const copy = clones.find((c) => c.kind === 'link').entity;
		assert.equal(copy.closed, true, 'the closed flag is authored geometry, not decoration');
		assert.equal(copy.via.length, 1);
		assert.notEqual(copy.via[0], wp.id, 'the bend is the copy\'s own — sharing it is invalid');
		assert.ok(clones.some((c) => c.kind === 'waypoint'), 'so the waypoint was pulled into the set');
	} finally { h.restore(); }
});

test('B46: linkNodes will not author the same pair twice within one batch', () => {
	const h = makeInput();
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [180, 0]]);
		// a-b then b-a: the second is the same pair, and only a projection that already holds the
		// first can see that. Against the live model it needs an eager put; against nothing at all
		// it authors a duplicate.
		const cmd = commands.linkNodes(h.model, [a.id, b.id, a.id], false);
		assert.equal(cmd.entries.length, 1, 'one link, not two');

		h.history.commit(cmd);
		assert.equal(commands.linkNodes(h.model, [a.id, b.id], false).entries.length, 0,
			'and an ALREADY committed pair is still skipped');
	} finally { h.restore(); }
});

test('B46: a routed link commits once, with its bend, and lands selected', () => {
	// commitRoute's eager put was removed as redundant; this drives the whole gesture so that
	// "redundant" is a measured claim rather than an absence of coverage.
	const h = makeInput();
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [360, 0]]);
		const at = (id, x, y) => pointer(x, y, {
			target: { tagName: 'g', classList: { contains: () => false }, dataset: {}, closest: (s) => (s.includes('node') ? { id } : null) },
		});
		h.input.onDown(at(a.id, 0, 0));
		h.input.onMove(at(a.id, 180, 60));
		h.input.onKeyDown(key('w'));            // drop a bend mid-route
		h.input.onMove(at(b.id, 360, 0));
		h.input.onUp(at(b.id, 360, 0));

		assert.equal(h.commits.length, 1, 'waypoint + link are ONE undo step');
		assert.equal(h.soleCommit().label, 'route');
		const link = h.model.all('link')[0];
		assert.equal(h.model.all('link').length, 1);
		assert.equal(link.via.length, 1, 'the bend rode along');
		assert.equal(h.model.all('waypoint').length, 1);
		assert.ok(h.selection.has(link.id), 'and the route is selected');
	} finally { h.restore(); }
});
