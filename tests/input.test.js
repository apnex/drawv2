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
		let fired = null;
		globalThis.window.dispatchEvent = (e) => { fired = e; return true; };
		h.renderer.mode = 'run';
		const hitEl = { dataset: { action: 'ping' }, closest: () => ({ id: 'node-aa0001' }) };
		const target = { tagName: 'rect', closest: () => hitEl };
		h.input.onDown(pointer(100, 100, { target }));

		assert.ok(fired, 'the action reached the host');
		assert.equal(fired.detail.action, 'ping');
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
