/*
H28.5 (B7, the move and the clone; dev/DECISIONS.md H28-1) -- A MOVE'S AND A CLONE'S PREVIEW, DRAWN OFF THE SHARED MODEL.

A move wrote each selected entity's position into the live Model every frame and rewound it at the commit or the cancel; a clone put its
copies into the live Model at its start and deleted them on a cancel, its commit planned on a Model already holding them. Both write a
throwaway projection of the live Model now, made at the gesture's start, which the renderer draws from until the gesture ends: the live
Model holds what is stored until the commit applies the edit through the planner, as every edit is applied.

Through the capture and the real renderer and planner, as a person drags: what the live Model holds, what the page draws, and what is
committed.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeInput, key, pointer, seedNodes } from './fixtures/client-harness.mjs';
import { makeLink } from '../plugins/network/link-queries.mjs';
import { makeZone } from '../plugins/zones/make-zone.mjs';
import { makeWaypoint } from '../plugins/devices/make-node.mjs';

const RIGHT = { button: 2, buttons: 2 };
const CLONE = { button: 2, buttons: 2, ctrlKey: true };
const on = (h, id, x, y, mod) => pointer(x, y, { target: h.at(id), ...mod });
const drawnAt = (h, id) => h.at(id).getAttribute('transform');
const at = (h, id) => { const e = h.model.get('node', id); return e && [e.x, e.y]; };
// every node the page draws, by id -- the scene's items, whose keys name their entities
const drawnNodes = (h) => [...new Set(h.scene.layers.filter((l) => !l.foreign).flatMap((l) => h.scene.items(l.name)).map((i) => i.key.split('/')[0]))]
	.filter((id) => id.startsWith('node-')).sort();
const shapeOf = (h, id) => JSON.stringify(h.renderer.ownShapeOf(id));

test('H28.5 (B7): a move\'s frames are drawn from its preview -- the node and the link at it -- the live Model as stored until the release commits it', () => {
	const h = makeInput();
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [360, 0]]);
		const l = makeLink(h.model, a.id, b.id); h.model.put('link', l);
		const route = shapeOf(h, l.id);
		h.capture.onDown(on(h, a.id, 0, 0, RIGHT));
		h.capture.onMove(on(h, a.id, 120, 120, RIGHT));
		assert.deepEqual(at(h, a.id), [0, 0], 'the live Model holds the node where it is stored');
		assert.equal(drawnAt(h, a.id), 'translate(120,120)', 'and the page draws it where the drag has it');
		assert.notEqual(shapeOf(h, l.id), route, 'the link at it drawn from the preview too');
		assert.equal(h.commits.length, 0, 'nothing committed mid-drag');
		h.capture.onUp(on(h, a.id, 120, 120, { button: 2, buttons: 0 }));
		assert.deepEqual([h.commits.length, at(h, a.id), drawnAt(h, a.id)], [1, [120, 120], 'translate(120,120)'], 'the release commits the move, drawn where it is stored');
	} finally { h.restore(); }
});

test('H28.5 (B7): a clone\'s copies are its preview\'s alone, drawn and shown selected, until the release stores them and the selection takes them', () => {
	const h = makeInput();
	try {
		const [a] = seedNodes(h.model, [[0, 0]]);
		h.capture.onDown(on(h, a.id, 0, 0, CLONE));
		h.capture.onMove(on(h, a.id, 180, 0, CLONE));
		const copy = drawnNodes(h).find((id) => id !== a.id);
		assert.ok(copy, 'the copy is drawn');
		assert.deepEqual(h.model.all('node').map((n) => n.id), [a.id], 'and the live Model holds the original alone');
		assert.deepEqual([drawnAt(h, copy), h.states.classesOf(copy).includes('selected'), h.states.classesOf(a.id).includes('selected')], ['translate(180,0)', true, false],
			'the copy drawn where the drag has it, and shown selected in the original\'s place');
		h.capture.onUp(on(h, a.id, 180, 0, { ...CLONE, buttons: 0 }));
		assert.deepEqual([h.commits.length, at(h, copy), h.selection.list()], [1, [180, 0], [copy]], 'the release stores the copy, and the selection takes it');
	} finally { h.restore(); }
});

test('H28.5 (B7): a cancelled move or clone leaves nothing its preview alone held -- no copy drawn or stored, the moved node and its link drawn as stored', () => {
	const h = makeInput();
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [360, 0]]);
		const l = makeLink(h.model, a.id, b.id); h.model.put('link', l);
		const route = shapeOf(h, l.id);
		h.capture.onDown(on(h, a.id, 0, 0, RIGHT));
		h.capture.onMove(on(h, a.id, 120, 120, RIGHT));
		assert.equal(drawnAt(h, a.id), 'translate(120,120)', 'control: dragged');
		h.capture.onKeyDown(key('Escape'));
		assert.deepEqual([drawnAt(h, a.id), shapeOf(h, l.id), at(h, a.id), h.commits.length], ['translate(0,0)', route, [0, 0], 0], 'the move cancelled: drawn as stored');

		h.capture.onDown(on(h, a.id, 0, 0, CLONE));
		h.capture.onMove(on(h, a.id, 180, 120, CLONE));
		const copy = drawnNodes(h).find((id) => id !== a.id && id !== b.id);
		assert.ok(copy, 'control: a copy drawn');
		h.capture.onKeyDown(key('Escape'));
		assert.deepEqual(drawnNodes(h), [a.id, b.id].sort(), 'the clone cancelled: no copy drawn');
		assert.deepEqual([h.model.all('node').length, h.renderer.ownShapeOf(copy), h.states.classesOf(copy), h.selection.list(), h.commits.length], [2, null, [], [], 0],
			'none stored, none shown selected, the selection empty as it ended before, nothing committed');
	} finally { h.restore(); }
});

test('H28.5 (B7): a change landing on the live Model mid-move is not written over by the next frame, and the release commits the move on top of it', () => {
	const h = makeInput();
	try {
		const [a, , c] = seedNodes(h.model, [[0, 0], [360, 0], [0, 240]]);
		h.capture.onDown(on(h, a.id, 0, 0, RIGHT));
		h.capture.onMove(on(h, a.id, 120, 0, RIGHT));
		// another writer's changes, applied as they would be with the hold off -- the moved node moved, and another
		h.model.set('node', a.id, { x: 0, y: 360 });
		h.model.set('node', c.id, { x: 60, y: 240 });
		h.capture.onMove(on(h, a.id, 180, 0, RIGHT));
		assert.deepEqual([at(h, a.id), at(h, c.id)], [[0, 360], [60, 240]], 'the live Model keeps what landed: no frame wrote over it');
		assert.equal(drawnAt(h, a.id), 'translate(180,0)', 'and the page still draws the moved node where the drag has it');
		h.capture.onUp(on(h, a.id, 180, 0, { button: 2, buttons: 0 }));
		assert.deepEqual([h.commits.length, at(h, a.id), at(h, c.id)], [1, [180, 0], [60, 240]], 'the move commits on top, and the other change stands');
		assert.deepEqual([drawnAt(h, a.id), drawnAt(h, c.id)], ['translate(180,0)', 'translate(60,240)'], 'each drawn as stored once the preview ends');
	} finally { h.restore(); }
});

/*
The clone's refusals, as before: a copy dropped on a cell another node holds is refused by the planner (B112) -- nothing stored, nothing
left drawn, the selection holding no copy -- and every positioned copy, a copied bend with its link, moves with the drag (B311).
*/
test('H28.5 (B7): a copy dropped on an occupied cell is refused (B112) and leaves nothing; a copied bend moves with its link (B311)', () => {
	const h = makeInput();
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [180, 0]]);
		h.capture.onDown(on(h, a.id, 0, 0, CLONE));
		h.capture.onMove(on(h, a.id, 180, 0, CLONE));
		h.capture.onUp(on(h, a.id, 180, 0, { ...CLONE, buttons: 0 }));
		assert.deepEqual([h.commits.length, h.commits[0].ops.length, h.commits[0].applied], [1, 1, []], 'the copy\'s put sent, and refused here by the planner, as before');
		// before H28.5 the refused copy stayed in the live Model, selected, on the cell it was refused, until the server's refusal resynced
		assert.deepEqual(h.model.all('node').map((n) => n.id).sort(), [a.id, b.id].sort(), 'refused: no copy stored');
		assert.deepEqual([drawnNodes(h), h.selection.list()], [[a.id, b.id].sort(), []], 'none drawn, none selected');
	} finally { h.restore(); }

	const g = makeInput();
	try {
		const [a, b] = seedNodes(g.model, [[0, 0], [360, 0]]);
		const w = makeWaypoint(g.model, { x: 180, y: 120 }); g.model.put('node', w);
		g.model.put('link', { ...makeLink(g.model, a.id, b.id), via: [w.id] });
		g.selection.set([a.id, b.id]);
		g.capture.onDown(on(g, a.id, 0, 0, CLONE));
		g.capture.onMove(on(g, a.id, 0, 240, CLONE));
		g.capture.onUp(on(g, a.id, 0, 240, { ...CLONE, buttons: 0 }));
		const copied = g.model.all('link').find((l) => l.src !== a.id);
		assert.ok(copied, 'the link copied with its ends');
		assert.deepEqual([at(g, copied.src), at(g, copied.dst), at(g, copied.via[0])], [[0, 240], [360, 240], [180, 360]], 'its ends and its own bend moved by the drag');
	} finally { g.restore(); }
});

test('H28.5 (B7): a lone zone\'s handles ride its preview mid-move, and stand where it is stored after a cancel', () => {
	const h = makeInput();
	try {
		const z = makeZone(h.model, { x: 150, y: 150, w: 120, h: 120 }); h.model.put('zone', z);
		h.selection.set([z.id]);
		const corner = () => Number(h.at({ key: 'handles', where: { 'data-corner': 'se' } }).getAttribute('x'));
		const rest = corner();
		const press = (x, y, mod = {}) => pointer(x, y, { target: h.at({ key: z.id, where: { class: 'zone-rect' } }), button: 2, buttons: 2, shiftKey: true, ...mod });
		h.capture.onDown(press(200, 200));
		h.capture.onMove(press(320, 200));
		assert.deepEqual([corner() - rest, h.model.get('zone', z.id).x], [120, 150], 'the corner rides the zone drawn moved, the live Model as stored');
		h.capture.onKeyDown(key('Escape'));
		assert.equal(corner(), rest, 'and stands where the zone is stored once cancelled');
	} finally { h.restore(); }
});
