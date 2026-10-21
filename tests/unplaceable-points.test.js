/*
F6 (H26.1's verification; dev/design/components/SNAP-GRID.md section 6.2) -- A POINT A GRID CANNOT PLACE THROWS NOWHERE THE OLD
ARITHMETIC DID NOT.

snap-grid answers `null` for a point it cannot place -- a coordinate not finite, or beyond its domain -- and refuses with a TypeError
a point whose `x` or `y` is not a number. The old arithmetic did neither: `Math.round` of NaN is NaN, and it went on. No pointer event
and no validated field is such a point (6.2), so what each site answers for one is not a behaviour anyone sees; that it answers rather
than throws is what keeps a stray value from stopping a gesture or the relation index. Each site guards as `pointOn` does: a point it
cannot place gives a point, a box or a frame of NaN, and the index keys it to no cell.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ZONE_HANDLE_SPECS } from '../plugins/zones/zone-gestures.mjs';
import { DEVICE_PRESSES } from '../plugins/devices/device-gestures.mjs';
import { snapNode, snapIn, placesOf } from '../app/src/snap.js';
import { PRODUCT_CANVAS } from '../product/canvas.mjs';
import { Model } from './fixtures/composed.mjs';
import { attachRelations } from '../engine/store.mjs';
import { NODE_GRID } from '../kernel/geometry.mjs';

// not finite, beyond the domain, not a number, missing
const UNPLACEABLE = [{ x: NaN, y: 0 }, { x: 0, y: Infinity }, { x: 1e300, y: 0 }, { x: 0, y: -(2 ** 60) }, { x: 'a', y: 0 }, { x: undefined, y: 0 }, { y: 0 }];
const allNaN = (o) => Object.values(o).every((v) => (v && typeof v === 'object' ? allNaN(v) : Number.isNaN(v)));
const show = (p) => JSON.stringify(p, (k, v) => (typeof v === 'number' && !Number.isFinite(v) ? String(v) : v === undefined ? 'undefined' : v));

test('F6: a zone corner dragged to, or from, a point the zone grid cannot place gives a box of NaN, never a throw', () => {
	const resize = (fixedCorner, pos) => ZONE_HANDLE_SPECS[0].at({ fixedCorner }, pos);
	assert.deepEqual(resize({ x: -30, y: -30 }, { x: 450, y: 450 }), { x: -30, y: -30, w: 480, h: 480 }, 'control: a corner on the grid');
	for (const p of UNPLACEABLE) {
		let box;
		assert.doesNotThrow(() => { box = resize({ x: -30, y: -30 }, p); }, `dragged to ${show(p)}`);
		assert.ok(allNaN(box) && Object.keys(box).length === 4, `dragged to ${show(p)}: ${show(box)}`);
		assert.doesNotThrow(() => { box = resize(p, { x: 450, y: 450 }); }, `fixed at ${show(p)}`);
		assert.ok(allNaN(box), `fixed at ${show(p)}: ${show(box)}`);
	}
});

test('F6: a text box framed from a point the node grid cannot place gives a frame of NaN, never a throw', () => {
	const frame = DEVICE_PRESSES.find((r) => r.id === 'tool').box.frame;
	assert.deepEqual(frame({ x: 0, y: 0 }, { x: 120, y: 60 }), { x: -20, y: -20, w: 160, h: 100, origin: { x: 0, y: 0 }, cols: 3, rows: 2 }, 'control: two points on the grid');
	for (const p of UNPLACEABLE) {
		for (const [a, b] of [[p, { x: 60, y: 60 }], [{ x: 60, y: 60 }, p]]) {
			let f;
			assert.doesNotThrow(() => { f = frame(a, b); }, `framed from ${show(a)} to ${show(b)}`);
			assert.ok(allNaN(f) && Object.keys(f).length === 7, `framed from ${show(a)} to ${show(b)}: ${show(f)}`);
		}
	}
});

test('F6: a point snapped on a grid it cannot be placed on snaps to NaN, never a throw -- pointOn, the guard the others follow', () => {
	const zone = placesOf(PRODUCT_CANVAS).get('zone');
	assert.deepEqual(snapNode({ x: 14, y: -14 }), { x: 0, y: 0 }, 'control');
	for (const p of UNPLACEABLE) {
		assert.deepEqual(snapNode(p), { x: NaN, y: NaN }, `snapNode ${show(p)}`);
		assert.deepEqual(snapIn(zone, p), { x: NaN, y: NaN }, `snapIn ${show(p)}`);
	}
});

test('F6: the relation index keys a point it cannot place to no cell -- not a number, not finite, beyond the domain, or a nearest answering null', () => {
	const m = new Model(); attachRelations(m, { nearest: NODE_GRID.nearest });
	const anchor = { id: 'node-0f6001', name: 'a', x: 0, y: 0 }; m.put('node', anchor);
	assert.equal(m.index.occupiedAnyAt({ x: 0, y: 0 }), true, 'control: the anchor at the origin is found');
	UNPLACEABLE.forEach((p, i) => {
		const id = `node-0f61${String(i).padStart(2, '0')}`;
		assert.doesNotThrow(() => m.put('node', { id, name: `u${i}`, ...p }), `an entity at ${show(p)} is indexed`);
		assert.equal(m.index.atCell(id), undefined, `${show(p)} is in no cell`);
		assert.equal(m.index.occupiedAnyAt(p), false, `${show(p)} finds no anchor`);
		assert.deepEqual(m.index.anchorsAt(p), [], `${show(p)} holds none`);
	});
	assert.deepEqual(m.index.anchorsAt({ x: 0, y: 0 }), [anchor.id], 'and none of them is filed with the anchor at the origin');

	const none = new Model(); attachRelations(none, { nearest: () => null });
	assert.doesNotThrow(() => none.put('node', { id: 'node-0f6002', name: 'b', x: 60, y: 0 }), 'a nearest answering null for every point');
	assert.equal(none.index.atCell('node-0f6002'), undefined);
	assert.equal(none.index.occupiedAnyAt({ x: 60, y: 0 }), false);
});
