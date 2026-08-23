import { test } from 'node:test';
import { LAYOUTS, onLayout, snapLayout, cellOn, pxOn, nearestAnchor, anchorAt, STD } from '../kernel/index.mjs';
import assert from 'node:assert/strict';
import * as snap from '../app/src/snap.js';
import { CANVAS, GAP, NODE_EXT, ZONE_EXT, spanExtent, snapNode, snapZone, resolveBox, pointInBox, dist, nodePoints } from '../app/src/snap.js';
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

/*
spanExtent — a node's footprint beyond its 1×1 frame, in px. One owner.

`(span.cols - 1) * pitch` had FIVE spellings: `spanPx` in the renderer and `spanExt` in input were
the same function under two names, and readout and onDblClick each inlined it again. `scan-twins`
could not see them — they are one-liners, below its `MIN_LINES` floor, which is a real limitation of
that detector and the reason this one needed a human. The two remaining `span` computations are
genuinely different and stay: `engine/relations.mjs` keys CELLS, `kernel/adapt.mjs` builds cell
RANGES. Same field, different questions.

Takes the span, not the entity: the kernel has no business knowing what an entity looks like.
*/
test('spanExtent: a 1×1 node has no extent beyond its frame', () => {
	assert.deepEqual(spanExtent(undefined), { sw: 0, sh: 0 }, 'absent span = a plain node');
	assert.deepEqual(spanExtent({ cols: 1, rows: 1 }), { sw: 0, sh: 0 });
});

test('spanExtent: extent is the cells BEYOND the first, in px', () => {
	assert.deepEqual(spanExtent({ cols: 2, rows: 1 }), { sw: GAP, sh: 0 });
	assert.deepEqual(spanExtent({ cols: 1, rows: 3 }), { sw: 0, sh: 2 * GAP });
	assert.deepEqual(spanExtent({ cols: 4, rows: 4 }), { sw: 3 * GAP, sh: 3 * GAP });
});

test('spanExtent: the far edge of a span lands on the node grid', () => {
	// the property the footprint maths exists for: anchor + extent is itself a grid point, so a
	// multi-cell node's far edge is snappable and a marquee over it is exact
	for (const cols of [1, 2, 5, 12]) {
		const { sw } = spanExtent({ cols, rows: 1 });
		assert.equal(sw % GAP, 0, `cols=${cols} lands off-grid`);
	}
});

/*
B111 -- the two grids have ONE owner, and a layout is what an anchor comes from.

The kernel knew only the node grid: cellOf and cellPx are both offset zero. The half-pitch offset
zones use lived in app/src/snap.js, and B110 added a second copy to server/validate.js -- two
restatements of a rule the kernel did not hold, in the same session that fixed B107 for being
exactly that.
*/
test('B111: the kernel holds both grids, and they differ only by the offset', () => {
	assert.equal(LAYOUTS.node.offset, 0);
	assert.equal(LAYOUTS.zone.offset, STD.pitch / 2, 'a zone bounds cells, so its edges fall between them');
});

test('B111: onLayout separates the two grids rather than conflating them', () => {
	assert.equal(onLayout(LAYOUTS.node, 240), true);
	assert.equal(onLayout(LAYOUTS.node, 270), false);
	// -780 is ON the node grid and OFF the zone grid: the exact mistake made by hand during B110
	assert.equal(onLayout(LAYOUTS.node, -780), true);
	assert.equal(onLayout(LAYOUTS.zone, -780), false);
	assert.equal(onLayout(LAYOUTS.zone, -750), true);
});

test('B111: an anchor carries both representations, so no consumer does arithmetic', () => {
	const a = nearestAnchor(LAYOUTS.node, 270, -150);
	assert.deepEqual(a, { layout: 'node', cx: 5, cy: -2, x: 300, y: -120 });
	assert.equal(onLayout(LAYOUTS.node, a.x), true, 'an anchor is on-grid by construction');

	const z = nearestAnchor(LAYOUTS.zone, -780, -390);
	assert.deepEqual(z, { layout: 'zone', cx: -13, cy: -7, x: -750, y: -390 });
	assert.equal(onLayout(LAYOUTS.zone, z.x), true);
});

test('B111: the layout travels with the anchor, because a cell index alone is ambiguous', () => {
	// the same cell resolves to different pixels on the two grids -- an anchor without its layout
	// cannot be turned back into a position
	assert.notEqual(anchorAt(LAYOUTS.node, 4, 0).x, anchorAt(LAYOUTS.zone, 4, 0).x);
	assert.equal(anchorAt(LAYOUTS.node, 4, 0).x, 240);
	assert.equal(anchorAt(LAYOUTS.zone, 4, 0).x, 270);
});

test('B111: a round trip through cell and back is the identity, on either grid', () => {
	for (const L of [LAYOUTS.node, LAYOUTS.zone]) {
		for (const v of [-900, -750, -60, 0, 60, 300, 900]) {
			const on = snapLayout(L, v);
			assert.equal(pxOn(L, cellOn(L, on)), on, `${L.name}: ${on} did not survive px->cell->px`);
		}
	}
});
