/*
THE ACCEPTANCE CASE OF THE RULES SYSTEM -- one key, two meanings, chosen by the situation and not by a handler.

dev/RULES.md section 9 set the bar: "one row expresses both, and no handler body contains an `if`". Its example was
fill, which does not exist (`f` is flow, H15.6); the director ruled `c` in its place (2026-09-30), because `c` already
meant two things and decided which inside its handler:

  ONE link with a bend selected      c closes it, or opens it again
  ONE link without a bend selected   c says "close needs a multi-hop route", and changes nothing
  anything else                      c means nothing

Behaviour is unchanged. What moved is WHERE the decision lives: two rows in the product's table, over the situation,
and handlers that ask nothing.
*/
import { makeLink } from '../network/link-queries.mjs';   // K13d: the network's link queries
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeInput, key, seedNodes } from './fixtures/client-harness.mjs';
import { KEYMAP } from '../app/src/keymap.js';
import { Input } from '../app/src/input.js';
import { nodeAt, occupiedAt } from '../app/src/pick.js';
import { snapNode, GAP, NODE_EXT } from '../app/src/snap.js';
import { makeNode, makeWaypoint } from '../devices/make-node.mjs';   // O-e1: the devices plugin's factories

function board(bends) {
	const h = makeInput();
	const [a, b] = seedNodes(h.model, [[0, 0], [360, 0]]);
	const link = makeLink(h.model, a.id, b.id);
	if (bends) { const w = makeWaypoint(h.model, { x: 180, y: 120 }); h.model.put('node', w); link.via = [w.id]; }
	h.model.put('link', link);
	return { h, link };
}
const pressC = (h) => { let claimed = 0; const e = key('c'); e.preventDefault = () => { claimed++; }; h.capture.onKeyDown(e); return claimed; };
const flashes = (h) => h.calls.filter((c) => c.name === 'readout.flash').map((c) => c.args[0]);

test('one link WITH a bend: c closes it, and c again opens it', () => {
	const { h, link } = board(true);
	try {
		h.selection.set([link.id]);
		assert.equal(pressC(h), 1, 'the key is ours');
		assert.equal(h.model.get('link', link.id).closed, true);
		pressC(h);
		assert.equal(h.model.get('link', link.id).closed, false);
		assert.deepEqual(flashes(h), ['path closed', 'path open']);
	} finally { h.restore(); }
});

test('one link WITHOUT a bend: c says why, and changes nothing', () => {
	const { h, link } = board(false);
	try {
		h.selection.set([link.id]);
		const before = h.commits.length;
		assert.equal(pressC(h), 1, 'the key is still ours: bind a key and you own it (B47)');
		assert.equal(h.commits.length, before, 'nothing committed');
		assert.equal(h.model.get('link', link.id).closed, undefined);
		assert.deepEqual(flashes(h), ['✗ close needs a multi-hop route']);
	} finally { h.restore(); }
});

test('anything else selected -- nothing, a node, two things: c means nothing', () => {
	const { h, link } = board(true);
	try {
		for (const sel of [[], [link.src], [link.id, link.src]]) {
			h.selection.set(sel);
			const before = h.commits.length;
			pressC(h);
			assert.equal(h.commits.length, before, `selection ${JSON.stringify(sel)}: nothing committed`);
		}
		assert.deepEqual(flashes(h), [], 'and nothing said');
	} finally { h.restore(); }
});

test('the two meanings are two ROWS, and the handlers they name ask nothing', () => {
	const rows = KEYMAP.filter((r) => r.on(key('c')));
	assert.deepEqual(rows.map((r) => r.id).sort(), ['close', 'close-refused']);
	assert.ok(rows.every((r) => typeof r.when === 'function'), 'each chosen by a condition over the situation');
	for (const r of rows) {
		const body = String(Input.prototype[r.run]) + String(r.run === 'onCloseKey' ? Input.prototype.toggleClosePath : '');
		assert.doesNotMatch(body, /\bif\s*\(/, `${r.run} decides nothing -- its row did`);
	}
});

/*
THE STEP'S GEOMETRY -- what `Input#stepUnderPointer` relies on to call a step 'node' without changing production.

Production's `w` mid-drag threads a waypoint at the snapped cell, else refuses a cell a node occupies, else places a
bend. The step says 'node' when the pointer is over a node's footprint. That is safe only if a pointer over a node
always snaps to a cell the node occupies: a footprint runs between grid points, and its margin is under half a pitch.
*/
test('a pointer anywhere over a node snaps to a cell that node occupies, whatever its span', () => {
	const h = makeInput();
	try {
		// on the canvas, where a node can be -- snapping clamps to it -- and one against its far corner, so the clamp is probed too
		const placed = [[null, -10 * GAP, -2 * GAP], [{ cols: 2, rows: 1 }, -4 * GAP, -2 * GAP], [{ cols: 3, rows: 2 }, 3 * GAP, -2 * GAP],
			[{ cols: 2, rows: 2 }, NODE_EXT.x - GAP, NODE_EXT.y - GAP]];
		for (const [span, x, y] of placed) {
			const n = makeNode(h.model, 'host', { x, y });
			if (span) n.span = span;
			h.model.put('node', n);
		}
		let probed = 0;
		for (const n of h.model.all('node')) {
			for (let dx = -40; dx <= 3 * GAP + 40; dx += 3) for (let dy = -40; dy <= 2 * GAP + 40; dy += 3) {
				const pos = { x: n.x + dx, y: n.y + dy };
				if (nodeAt(h.model, pos)?.id !== n.id) continue;
				probed++;
				assert.ok(occupiedAt(h.model, snapNode(pos)), `pointer at ${pos.x},${pos.y} over ${n.id} snaps to a cell it does not occupy`);
			}
		}
		assert.ok(probed > 100, 'the probe actually covered the footprints');
	} finally { h.restore(); }
});

/*
THE PLUGIN SEAM on Input -- what a composition may add: its own key rows, and a judge of a finished link drag. Anything
else is refused, and so is a second judge, which would need a precedence (Q3). A plugin's row acts through ONE verb
the product declares, never through Input itself.
*/
test('Input refuses a plugin with anything but owner, keys and judgeDrag, and a second judge', () => {
	assert.throws(() => makeInput({ plugins: [{ owner: 'x', keys: [], hook: () => {} }] }), /hook/);
	assert.throws(() => makeInput({ plugins: [{ keys: [] }] }), /owner/);
	assert.throws(() => makeInput({ plugins: [{ owner: 'a', judgeDrag: () => ({}) }, { owner: 'b', judgeDrag: () => ({}) }] }), /a, b/);
	assert.throws(() => makeInput({ plugins: [{ owner: 'a', keys: [{ id: 'close', on: () => false, run: 'x' }] }] }), /close/, 'and an id the product already uses');
});

test('a plugin\'s row is handed the host\'s declared verbs, not Input -- and the selection as plain data', () => {
	let handed = null;
	const h = makeInput({ plugins: [{ owner: 'probe', keys: [{ id: 'probe', mutates: false, on: (e) => e.key === 'F9', run: (host) => { handed = host; } }] }] });
	try {
		h.capture.onKeyDown(key('F9'));
		assert.ok(handed, 'the row ran');
		assert.deepEqual(Object.keys(handed), ['addStop', 'selected']);
		assert.notEqual(handed, h.input);
		const [n] = seedNodes(h.model, [[0, 0, 'router']]);
		h.selection.set([n.id]);
		// each selected entity's fields, with its kind -- a plugin reads the fields it owns (the network, transit: F-e)
		assert.deepEqual(handed.selected(), [{ ...h.model.get('node', n.id), kind: 'node' }]);
		assert.notEqual(handed.selected()[0], h.model.get('node', n.id), 'a copy, never the entity itself');
		assert.deepEqual(JSON.parse(JSON.stringify(handed.selected())), handed.selected(), 'plain data, never an entity or an element');
	} finally { h.restore(); }
});
