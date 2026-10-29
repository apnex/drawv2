/*
SELECTING AND DELETING A HAND PIPE (H17.22 N-c2; ruled 2026-10-02, N6; B281) -- the four seams, held without a browser.
The lab's matrix rows PIPE-01 to PIPE-05 hold the whole gesture in real Chrome.

  the painter   draws every pipe under its own id, keeps a selected one marked through a repaint, and gives only a HAND
                pipe an invisible hit line naming it (`data-select`), the thinnest link's width
  the pick      an element carrying `data-select` is a mark: its kind read off the id, flagged as a mark
  the press     a press on a mark selects it, and a drag never moves it (app/src/releases.js PRESS_DRAGS)
  the delete    a selected entity the product's cascade does not reach is deleted as itself, first

None of the canvas's seams names a plugin kind; production, which draws no marks, is unchanged.
RESTATED at H26.8's pipes move (dev/design/components/NATIVE-SHAPES.md section 4.6; appendix A, a:F4): the painter is the network's pipe
painter (plugins/network/pipe-painter.mjs), drawn by the renderer over the product's canvas parts -- `net.paint()` restated to the
renderer's own schedule -- and a selected pipe is marked through the editing states, as the page marks it.
*/
// RESTATED at C-e step eight (H19.33; D5): the network commits its transit edit through `edit`, which the composition backs
// with the canvas's generic builder -- so each test's commit sees the command `editOf` builds, as the page's history does
import { editOf } from '../app/src/commands.js';
import { isLinkDown } from '../plugins/network/network-queries.mjs';   // Q-a: the network's questions
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from '../model/model.mjs';
import { productKinds } from '../product/kinds.mjs';
import { PIPE_ROW, pipeEntity } from '../plugins/network/pipe-kind.mjs';
import { NETWORK_ROWS } from '../plugins/network/kinds.mjs';   // the network's kind and the field it contributes (S-a)
import { pipeHitAttributes } from '../plugins/network/appearance.mjs';
import { linkWidth } from '../plugins/network/appearance.mjs';
import { picksOf, hitWith } from '../app/src/pick.js';
import { Renderer } from '../app/src/renderer.js';
import { EditingStates } from '../app/src/editing-states.js';
import { makeRenderer } from './fixtures/client-harness.mjs';
import { PRODUCT_CANVAS } from '../product/canvas.mjs';
// RESTATED at C-b (H19.30): the picker is composed from the plugins' picks; a mark is still the canvas's own rule
const hitOf = hitWith(picksOf(PRODUCT_CANVAS));
import { PRESS_DRAGS } from '../app/src/releases.js';
import { deleteSelection } from '../app/src/commands.js';
import { createNetwork as netFor } from '../plugins/network/network.mjs';
import { createTransit as transitFor } from '../plugins/network/transit.mjs';
const aNetwork = () => netFor(transitFor());   // a Model holding links is given one (V-e, J2)

const A = 'node-00000a', B = 'node-00000b', W = 'node-00000c';
// the pipes drawn as the page draws them: the renderer over the product's canvas parts and a scene, the editing states beside it
function drawn(m, test) {
	const { svg, scene, restore } = makeRenderer();
	try {
		const states = new EditingStates({ model: m, parts: PRODUCT_CANVAS });
		const r = new Renderer(m, svg, { parts: PRODUCT_CANVAS, scene, states });
		r.syncAll();
		const group = (id) => scene.items('pipes').find((it) => it.key === id)?.shapes[0] ?? null;
		return test({ r, states, scene, group, element: (id) => svg.ownerDocument.getElementById(id) });
	} finally { restore(); }
}
function board() {
	const m = new Model({ kinds: productKinds(...NETWORK_ROWS), attached: { network: aNetwork() }});
	m.put('node', { id: A, name: 'A', type: 'router', x: -240, y: 0, shape: 'circle' });
	m.put('node', { id: B, name: 'B', type: 'router', x: 240, y: 0, shape: 'circle' });
	m.put('node', { id: W, name: 'w', x: 0, y: -120 });
	m.put('pipe', pipeEntity(A, W, 'hand'));
	m.put('pipe', pipeEntity(W, B, 'link'));
	return m;
}

test('N-c2: the painter draws each pipe under its id, and gives only a hand pipe a hit line, the thinnest link\'s width', () => drawn(board(), ({ states, scene, group }) => {
	const hand = pipeEntity(A, W, 'hand').id, link = pipeEntity(W, B, 'link').id;
	const lines = () => scene.items('pipes').flatMap((it) => it.shapes[0].children).filter((c) => c.attrs.id);
	assert.deepEqual(lines().map((n) => n.attrs.id).sort(), [hand, link].sort(), 'every pipe is drawn under its own id');
	const hits = scene.items('pipes').flatMap((it) => it.shapes[0].children).filter((c) => c.attrs.class === 'pipe-hit');
	assert.deepEqual(hits.map((n) => n.attrs['data-select']), [hand], 'only the hand pipe can be clicked; a link pipe is never offered');
	assert.equal(hits[0].attrs['stroke-width'], String(linkWidth({ control: true })), 'its click area is the thinnest link\'s width, so a link drawn over it covers it');
	assert.deepEqual(pipeHitAttributes(), { stroke: 'transparent', 'stroke-width': linkWidth({ control: true }), fill: 'none' });
	states.reflect([hand]);
	assert.match(group(hand).children[0].attrs.class, /\bselected\b/, 'a selected pipe is marked on its line');
	assert.doesNotMatch(group(link).children[0].attrs.class, /\bselected\b/);
}));

test('a repaint keeps a selected pipe marked: its end moved, the pipe described again', () => {
	const m = board(), hand = pipeEntity(A, W, 'hand').id;
	drawn(m, ({ states, group }) => {
		states.reflect([hand]);
		m.set('node', W, { x: 60, y: -60 });
		assert.deepEqual([group(hand).children[0].attrs.x2, group(hand).children[0].attrs.y2], ['60', '-60'], 'described again with its end');
		assert.match(group(hand).children[0].attrs.class, /\bselected\b/, 'and still marked selected');
	});
});

/*
ONE ELEMENT PER PIPE, KEPT (the director, 2026-10-02): a repaint updates elements in place and makes none; an anchor moved
moves its pipe's element; a pipe deleted takes its element; a pipe laid again by hand gains its hit line. RESTATED at the pipes move: the
scene keeps each element a description patches (vector-scene's VS7), so the renderer's put keeps the pipe's elements as the drawer did.
*/
test('the painter keeps one element per pipe across paints, updating it in place, and removes it only with its pipe', () => {
	const m = board(), hand = pipeEntity(A, W, 'hand').id, link = pipeEntity(W, B, 'link').id;
	drawn(m, ({ r, scene, element }) => {
		assert.equal(scene.items('pipes').length, 2, 'one item per pipe: two groups, each with its line, the hand pipe\'s with its hit line');
		const line = element(hand);
		r.setMode('edit'); r.setMode('view');
		assert.equal(element(hand), line, 'a mode change describes the pipe again and keeps its element');
		m.set('node', W, { x: 60, y: -60 });
		assert.equal(element(hand), line, 'the same element');
		assert.deepEqual([line.getAttribute('x2'), line.getAttribute('y2')], ['60', '-60'], 'moved with its anchor, in place');
		m.del('pipe', hand);
		assert.equal(line.parentNode.parentNode, null, 'a deleted pipe takes its element: its group, line and all, out of the page');
		assert.equal(scene.items('pipes').some((it) => it.key === hand), false, 'and its hit line, with its item');
		m.set('pipe', link, { laid: 'hand' });
		assert.ok(scene.items('pipes').find((it) => it.key === link).shapes[0].children.some((c) => c.attrs['data-select'] === link), 'a link pipe laid again by hand gains its hit line');
	});
});

test('N-c2: an element naming what a click selects is a mark, its kind read off the id', () => {
	const target = { closest: () => null, classList: { contains: () => false }, dataset: { select: 'pipe-00000a-00000c' } };
	assert.deepEqual(hitOf({ target }), { kind: 'pipe', id: 'pipe-00000a-00000c', mark: true });
	assert.deepEqual(hitOf({ target: { ...target, dataset: {} } }), { kind: 'canvas', id: null }, 'without one, the canvas');
});

test('N-c2: a drag that starts on a mark never moves it, as on a link', () => {
	const [startMove] = PRESS_DRAGS;
	// RESTATED at C-d step four (D4): the facts are named for what they say -- not placed, an anchor whose left press draws a link
	assert.equal(startMove.when({ unplaced: false, onMark: true, linksOnLeft: false, leftPress: true }), false);
	assert.equal(startMove.when({ unplaced: false, onMark: false, linksOnLeft: false, leftPress: true }), true, 'a node still moves');
});

test('N-c2: a selected entity the cascade does not reach is deleted as itself, first, so undo restores it last', () => {
	const m = board();
	const hand = pipeEntity(A, W, 'hand').id;
	const cmd = deleteSelection(m, new Set([hand, A]));
	assert.deepEqual(cmd.entries[0], { op: 'del', kind: 'pipe', entity: m.get('pipe', hand) });
	assert.ok(cmd.entries.some((e) => e.op === 'del' && e.kind === 'node' && e.entity.id === A), 'and the product\'s own cascade runs as before');
	assert.equal(cmd.entries.filter((e) => e.op === 'del' && e.entity.id === A).length, 1, 'nothing is deleted twice');
	assert.equal(deleteSelection(m, new Set(['pipe-0000ff-0000fe'])).entries.length, 0, 'an id that names nothing deletes nothing');
});

/*
A PIPE A LINK RUNS OVER IS NOT DRAWN (the director, 2026-10-02): hidden exactly where an UP link's route runs, read off the
network's derivation; a free pipe, and a down link's own legs, are drawn.
*/
test('the painter marks hidden every pipe an up link runs over, keeping it in the page, and no other', async () => {
	const { createNetworkSession } = await import('../plugins/network/session.mjs');
	const session = createNetworkSession();
	const m = new Model({ kinds: productKinds(...NETWORK_ROWS), attached: { network: session.network }});
	const C = 'node-00000d', D = 'node-00000e';
	for (const [id, x] of [[A, -240], [B, 240], [C, -240], [D, 240]]) m.put('node', { id, name: id, type: 'router', x, y: id === C || id === D ? 240 : 0, shape: 'circle' });
	m.put('node', { id: W, name: 'w', x: 0, y: -120 });
	m.put('link', { id: 'link-000001', name: 'up', src: A, dst: B, via: [W] });
	for (const [a, b, laid] of [[A, W, 'link'], [W, B, 'link'], [A, C, 'hand']]) m.put('pipe', pipeEntity(a, b, laid));
	m.put('link', { id: 'link-000002', name: 'down', src: C, dst: D });   // no way: down
	drawn(m, ({ scene }) => {
		assert.equal(isLinkDown(m, m.get('link', 'link-000002')), true);
		const groups = scene.items('pipes').map((it) => it.shapes[0]);
		assert.equal(groups.length, 3, 'every pipe has its item in the page');
		const hidden = groups.filter((g) => g.attrs.class.includes('under')).map((g) => g.attrs['data-pipe']).sort();
		assert.deepEqual(hidden, [pipeEntity(A, W, 'link').id, pipeEntity(W, B, 'link').id].sort(), 'the up link\'s two pipes are marked hidden; the free hand pipe is not');
	});
});
