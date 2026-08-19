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
import { makeInput, key, seedNodes } from './fixtures/client-harness.mjs';

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

test('while Server-Locked, selection still works — inspection is not mutation', { todo: 'B37 — Ctrl+A sits behind the blanket readOnly guard; fixed at H3.1' }, () => {
	const h = makeInput({ readOnly: true });
	try {
		seedNodes(h.model, [[0, 0], [60, 0]]);
		h.input.onKeyDown(key('a', { ctrlKey: true }));
		assert.equal(h.selection.size(), 2);
		assert.equal(h.commits.length, 0);
	} finally { h.restore(); }
});

// ---- B14: three advertised gestures that throw. Marked, never written around. ----

test('B14: an arrow nudge emits one move change', { todo: 'B14 — throws on this.history.stack; fixed at H3.3' }, () => {
	const h = makeInput();
	try {
		const [a] = seedNodes(h.model, [[0, 0]]);
		h.selection.set([a.id]);
		h.input.onKeyDown(key('ArrowRight'));

		const c = h.soleCommit();
		assert.deepEqual(opKinds(c.ops), ['set/node']);
		assert.equal(c.ops[0].patch.x, 60);
	} finally { h.restore(); }
});

test('B14: a burst of nudges coalesces into ONE change', { todo: 'B14 — D11 window unwired; fixed at H3.3' }, () => {
	const h = makeInput();
	try {
		const [a] = seedNodes(h.model, [[0, 0]]);
		h.selection.set([a.id]);
		for (let i = 0; i < 5; i++) h.input.onKeyDown(key('ArrowRight'));

		assert.equal(h.commits.length, 1, 'five keystrokes, one undo step');
		assert.equal(h.model.get('node', a.id).x, 300);
	} finally { h.restore(); }
});

test('B14: Shift+arrow resizes the lone selected zone', { todo: 'B14 — throws on this.history.stack; fixed at H3.3' }, () => {
	const h = makeInput();
	try {
		const z = h.model.makeZone({ x: -30, y: -30, w: 120, h: 120 });
		h.model.put('zone', z);
		h.selection.set([z.id]);
		h.input.onKeyDown(key('ArrowRight', { shiftKey: true }));

		const c = h.soleCommit();
		assert.deepEqual(opKinds(c.ops), ['set/zone']);
		assert.equal(c.ops[0].patch.w, 180);
	} finally { h.restore(); }
});
