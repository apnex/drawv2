import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as snap from '../app/src/snap.js';
import { CANVAS, GAP, NODE_EXT, ZONE_EXT, snapNode, snapZone, resolveBox, pointInBox, dist, nodePoints } from '../app/src/snap.js';
import { SURFACE, NODE_EXT as DOC_NODE_EXT, ZONE_EXT as DOC_ZONE_EXT } from '../model/index.mjs';

// Grid math lives in app/src/snap.js (shipped). The center-origin geometry was ported from the
// retired client/src/grid.js; as of CL3 the canvas surface + usable extents are single-sourced
// from the sovereign model/ substrate (re-exported under the names snap.js consumers use).

test('the grid is center-origin with a true center point', () => {
	assert.deepEqual(snapNode({ x: 0, y: 0 }), { x: 0, y: 0 });
	assert.deepEqual(snapNode({ x: 14, y: -14 }), { x: 0, y: 0 });
	const points = nodePoints();
	assert.ok(points.some((p) => p.x === 0 && p.y === 0), 'origin is a node point');
	assert.equal(points.length, 31 * 17, 'odd x odd grid');
});

test('snapNode rounds to multiples of the gap', () => {
	assert.deepEqual(snapNode({ x: 31, y: -29 }), { x: 60, y: 0 });
	assert.deepEqual(snapNode({ x: 31, y: -31 }), { x: 60, y: -60 });
	assert.deepEqual(snapNode({ x: -595, y: 242 }), { x: -600, y: 240 });
});

test('snapNode clamps to the usable extents', () => {
	assert.deepEqual(snapNode({ x: -5000, y: -5000 }), { x: -NODE_EXT.x, y: -NODE_EXT.y });
	assert.deepEqual(snapNode({ x: 99999, y: 99999 }), { x: NODE_EXT.x, y: NODE_EXT.y });
	assert.equal(NODE_EXT.x, 900);
	assert.equal(NODE_EXT.y, 480);
});

test('snapZone rounds to the half-cell-offset grid', () => {
	assert.deepEqual(snapZone({ x: 0, y: 0 }), { x: 30, y: 30 });
	assert.deepEqual(snapZone({ x: -45, y: 50 }), { x: -30, y: 30 });
	assert.equal(Math.abs(snapZone({ x: 311, y: 0 }).x - 30) % GAP, 0);
});

test('snapZone clamps to zone extents', () => {
	assert.deepEqual(snapZone({ x: -5000, y: 99999 }), { x: -ZONE_EXT.x, y: ZONE_EXT.y });
	assert.equal(ZONE_EXT.x, 930);
	assert.equal(ZONE_EXT.y, 510);
});

test('canvas extents are symmetric halves', () => {
	assert.equal(CANVAS.hw * 2, CANVAS.w);
	assert.equal(CANVAS.hh * 2, CANVAS.h);
});

test('resolveBox normalizes any corner pair', () => {
	assert.deepEqual(resolveBox({ x: 100, y: 200 }, { x: -40, y: -80 }), { x: -40, y: -80, w: 140, h: 280 });
	assert.deepEqual(resolveBox({ x: 0, y: 0 }, { x: 0, y: 0 }), { x: 0, y: 0, w: 0, h: 0 });
});

test('pointInBox is inclusive of edges', () => {
	const box = { x: -30, y: -30, w: 60, h: 60 };
	assert.ok(pointInBox({ x: -30, y: -30 }, box));
	assert.ok(pointInBox({ x: 30, y: 30 }, box));
	assert.ok(!pointInBox({ x: 31, y: 0 }, box));
});

test('dist is euclidean', () => {
	assert.equal(dist({ x: 0, y: 0 }, { x: -3, y: 4 }), 5);
});

// ---- shipped-only additions ----

test('CL3 single-source: snap re-exports the model/ surface + extents (no divergent copy)', () => {
	// identical object references prove snap.js does not own a parallel literal (cleanliness #2)
	assert.equal(snap.CANVAS, SURFACE, 'CANVAS aliases the document SURFACE object');
	assert.equal(snap.NODE_EXT, DOC_NODE_EXT, 'NODE_EXT is the document object');
	assert.equal(snap.ZONE_EXT, DOC_ZONE_EXT, 'ZONE_EXT is the document object');
	assert.deepEqual(snap.CANVAS, { w: 1920, h: 1080, hw: 960, hh: 540 });
	assert.deepEqual(snap.NODE_EXT, { x: 900, y: 480 });
	assert.deepEqual(snap.ZONE_EXT, { x: 930, y: 510 });
});
