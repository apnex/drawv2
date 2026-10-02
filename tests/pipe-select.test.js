/*
SELECTING AND DELETING A HAND PIPE (H17.22 N-c2; ruled 2026-10-02, N6; B281) -- the four seams, held without a browser.
The lab's matrix rows PIPE-01 to PIPE-05 hold the whole gesture in real Chrome.

  the painter   draws every pipe under its own id, keeps a selected one marked through a repaint, and gives only a HAND
                pipe an invisible hit line naming it (`data-select`), the thinnest link's width
  the pick      an element carrying `data-select` is a mark: its kind read off the id, flagged as a mark
  the press     a press on a mark selects it, and a drag never moves it (app/src/releases.js PRESS_DRAGS)
  the delete    a selected entity the product's cascade does not reach is deleted as itself, first

None of the canvas's seams names a plugin kind; production, which draws no marks, is unchanged.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from '../model/model.mjs';
import { productKinds } from '../planner/kinds.mjs';
import { PIPE_ROW, pipeEntity } from '../network/pipe-kind.mjs';
import { pipeHitAttributes } from '../network/appearance.mjs';
import { linkWidth } from '../kernel/network-appearance.mjs';
import { attachNetwork } from '../network/host.mjs';
import { hitOf } from '../app/src/pick.js';
import { PRESS_DRAGS } from '../app/src/releases.js';
import { deleteSelection } from '../app/src/commands.js';

const A = 'node-00000a', B = 'node-00000b', W = 'waypoint-00000c';
function board() {
	const m = new Model({ kinds: productKinds(PIPE_ROW) });
	m.put('node', { id: A, name: 'A', type: 'router', x: -240, y: 0, shape: 'circle' });
	m.put('node', { id: B, name: 'B', type: 'router', x: 240, y: 0, shape: 'circle' });
	m.put('waypoint', { id: W, name: 'w', x: 0, y: -120 });
	m.put('pipe', pipeEntity(A, W, 'hand'));
	m.put('pipe', pipeEntity(W, B, 'link'));
	return m;
}

test('N-c2: the painter draws each pipe under its id, and gives only a hand pipe a hit line, the thinnest link\'s width', () => {
	const m = board(), drawn = [];
	let selected = [];
	attachNetwork({
		session: { network: {}, takeNotice: () => null, onTransitChange: () => {} },
		model: m, authority: m, renderer: { update: () => {}, reflectSelection: () => {}, render: () => {} },
		selection: { subscribe: () => {}, list: () => selected }, history: { commit: () => {} },
		pipeLayer: { replaceChildren: () => { drawn.length = 0; } }, el: (tag, attrs) => drawn.push(attrs), say: () => {},
	}).paint();
	const hand = pipeEntity(A, W, 'hand').id, link = pipeEntity(W, B, 'link').id;
	assert.deepEqual(drawn.filter((a) => a.id).map((a) => a.id).sort(), [hand, link].sort(), 'every pipe is drawn under its own id');
	const hits = drawn.filter((a) => a.class === 'pipe-hit');
	assert.deepEqual(hits.map((a) => a['data-select']), [hand], 'only the hand pipe can be clicked; a link pipe is never offered');
	assert.equal(hits[0]['stroke-width'], linkWidth({ control: true }), 'its click area is the thinnest link\'s width, so a link drawn over it covers it');
	assert.deepEqual(pipeHitAttributes(), { stroke: 'transparent', 'stroke-width': linkWidth({ control: true }), fill: 'none' });
	selected = [hand];
	attachNetwork({
		session: { network: {}, takeNotice: () => null, onTransitChange: () => {} },
		model: m, authority: m, renderer: { update: () => {}, reflectSelection: () => {}, render: () => {} },
		selection: { subscribe: () => {}, list: () => selected }, history: { commit: () => {} },
		pipeLayer: { replaceChildren: () => { drawn.length = 0; } }, el: (tag, attrs) => drawn.push(attrs), say: () => {},
	}).paint();
	assert.match(drawn.find((a) => a.id === hand).class, /\bselected\b/, 'a repaint keeps a selected pipe marked');
	assert.doesNotMatch(drawn.find((a) => a.id === link).class, /\bselected\b/);
});

test('N-c2: an element naming what a click selects is a mark, its kind read off the id', () => {
	const target = { closest: () => null, classList: { contains: () => false }, dataset: { select: 'pipe-00000a-00000c' } };
	assert.deepEqual(hitOf({ target }), { kind: 'pipe', id: 'pipe-00000a-00000c', mark: true });
	assert.deepEqual(hitOf({ target: { ...target, dataset: {} } }), { kind: 'canvas', id: null }, 'without one, the canvas');
});

test('N-c2: a drag that starts on a mark never moves it, as on a link', () => {
	const [startMove] = PRESS_DRAGS;
	assert.equal(startMove.when({ onLink: false, onMark: true, onWaypoint: false, leftPress: true }), false);
	assert.equal(startMove.when({ onLink: false, onMark: false, onWaypoint: false, leftPress: true }), true, 'a node still moves');
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
