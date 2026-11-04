/*
H26.6's move 12 (dev/design/components/PAN-ZOOM.md section 3.8, "Placement"; PZ9; appendix A's move 12 rows) -- PLACEMENT BY RINGS.
server/anchor.mjs walked the old extent's 527 positions; with no extent each relation searches rings outward from its reference, ties
to the lesser `y` then `x`, ending by the sound stop or once a whole ring lies beyond its domain -- PZ31's bound, or a zone's interior.
`placement-rings.mjs`'s five cases are reproduced through `resolveAnchor` itself, 527 anchors packed nearest each reference as the probe
packs them -- its loop order and its stable sort, so the anchors cut at the 527th distance are the probe's: 13 rings in the open, 21 at
the bound's corner, 264 in a column, a full zone refused, and reading 2's narrow zone. tests/anchor-resolve.test.js and
tests/place-rule.test.js stand unchanged beside these.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from './fixtures/composed.mjs';
import { resolveAnchor } from '../server/anchor.mjs';

const P = 60, B = 1_000_000, CAP = 527;
const inBound = (q) => Math.abs(q.x) <= B && Math.abs(q.y) <= B;
const insideZone = (z) => (q) => q.x > z.x && q.x < z.x + z.w && q.y > z.y && q.y < z.y + z.h && inBound(q);
// the probe's packing: the n admitted points nearest the reference, from a square `span` cells about it, by a stable sort on distance
function packed(ref, admit, n, span) {
	const pts = [];
	const hc = Math.round(ref.x / P), hr = Math.round(ref.y / P);
	for (let dc = -span; dc <= span; dc++) for (let dr = -span; dr <= span; dr++) { const q = { x: (hc + dc) * P, y: (hr + dr) * P }; if (admit(q)) pts.push(q); }
	pts.sort((a, b) => ((a.x - ref.x) ** 2 + (a.y - ref.y) ** 2) - ((b.x - ref.x) ** 2 + (b.y - ref.y) ** 2));
	return pts.slice(0, n);
}
const node = (q, i, name = `n${i}`) => ({ id: `node-${(i + 1).toString(16).padStart(6, '0')}`, name, type: 'server', x: q.x, y: q.y });
function board(points, { ref = null, zones = [] } = {}) {
	const m = new Model();
	m.load({ nodes: points.map((q, i) => node(q, i, ref && q.x === ref.x && q.y === ref.y ? 'ref' : `n${i}`)), links: [], zones, groups: [] });
	return m;
}
const at = (r) => (r.ok ? [r.x, r.y] : r.error);
const ring = (r, ref) => Math.max(Math.abs(r.x - ref.x), Math.abs(r.y - ref.y)) / P;

test('H26.6 move 12, placement-rings.mjs "open": 527 anchors packed nearest a device at the origin -- near answers 780,0, 13 rings out', () => {
	const ref = { x: 0, y: 0 };
	const m = board(packed(ref, inBound, CAP, 40), { ref });
	const r = resolveAnchor(m, { near: 'ref' });
	assert.deepEqual([at(r), ring(r, ref), r.layout, r.cx, r.cy], [[780, 0], 13, 'node', 13, 0], 'the probe\'s point, d2 608,400');
});

test('H26.6 move 12, placement-rings.mjs "corner": near a device at the bound\'s corner, 527 packed nearest it within the bound -- 999120,998700, 21 rings out', () => {
	const ref = { x: 999960, y: 999960 };
	const m = board(packed(ref, inBound, CAP, 40), { ref });
	const r = resolveAnchor(m, { near: 'ref' });
	assert.deepEqual([at(r), ring(r, ref)], [[999120, 998700], 21], 'the probe\'s point, no candidate past the bound');
	assert.ok(r.x <= B && r.y <= B);
});

test('H26.6 move 12, placement-rings.mjs "column": inside a zone one square wide and as tall as the bound, 527 packed about its centre -- 0,-15840, 264 rings out', () => {
	const z = { id: 'zone-0c0001', name: 'column', x: -30, y: -B + 30, w: 60, h: 2 * B - 60 };
	const m = board(packed({ x: 0, y: 0 }, insideZone(z), CAP, 300), { zones: [z] });
	const r = resolveAnchor(m, { inside: 'column' });
	assert.deepEqual([at(r), ring(r, { x: 0, y: 0 })], [[0, -15840], 264], 'kept to the zone, the tie to the lesser y');
});

test('H26.6 move 12, placement-rings.mjs "reading": reading 2\'s narrow zone, 0,60k held for k from -12 to 12 -- 0,-780, 13 rings out', () => {
	const z = { id: 'zone-0c0002', name: 'narrow', x: -30, y: -1590, w: 60, h: 3180 };
	const m = board(Array.from({ length: 25 }, (_, i) => ({ x: 0, y: 60 * (i - 12) })), { zones: [z] });
	assert.deepEqual(at(resolveAnchor(m, { inside: 'narrow' })), [0, -780]);
});

test('H26.6 move 12, placement-rings.mjs "full": a zone of 9 squares, every one held -- refused naming the zone, the search ending at the zone\'s edge', () => {
	const z = { id: 'zone-0c0003', name: 'full', x: -90, y: -90, w: 180, h: 180 };
	const m = board(packed({ x: 0, y: 0 }, insideZone(z), 9, 3), { zones: [z] });
	const t0 = process.hrtime.bigint();
	assert.equal(at(resolveAnchor(m, { inside: 'full' })), 'zone full has no free anchor');
	assert.ok(Number(process.hrtime.bigint() - t0) < 50e6, 'ended at once, not walking the bound');
	// control: one square freed, and it is the answer
	m.del('node', m.all('node').find((n) => n.x === 60 && n.y === 60).id);
	assert.deepEqual(at(resolveAnchor(m, { inside: 'full' })), [60, 60], 'control: the one free square inside');
});

test('H26.6 move 12: a full ring moves the search outward, the tie on the next ring to the lesser y, then the lesser x', () => {
	const ring1 = [[60, 0], [-60, 0], [0, 60], [0, -60], [60, 60], [-60, -60], [60, -60], [-60, 60]].map(([x, y]) => ({ x, y }));
	const m = board([{ x: 0, y: 0 }, ...ring1], { ref: { x: 0, y: 0 } });
	assert.deepEqual(at(resolveAnchor(m, { near: 'ref' })), [0, -120], 'ring 2: of the four at 120, the lesser y');
	m.put('node', node({ x: 0, y: -120 }, 40));
	assert.deepEqual(at(resolveAnchor(m, { near: 'ref' })), [-120, 0], 'then of the lesser y left at 120, the lesser x');
	// and ring 0 free: the reference's own position when it is the midpoint
	const two = board([{ x: -120, y: 0 }, { x: 120, y: 0 }]);
	assert.deepEqual(at(resolveAnchor(two, { between: ['n0', 'n1'] })), [0, 0], 'between, the midpoint itself');
	// a midpoint half a pitch off: 30,0 is as near 0,0 as 60,0, and 0,0 wins on the lesser x
	const half = board([{ x: -120, y: 0 }, { x: 180, y: 0 }]);
	assert.deepEqual(at(resolveAnchor(half, { between: ['n0', 'n1'] })), [0, 0], 'a tie the sound stop does not cut short');
});

test('H26.6 move 12: no candidate lies past PZ31\'s bound, and none is held to the old frame -- near, between, the walk, inside', () => {
	const edge = board([{ x: 999960, y: 0 }, { x: 999900, y: 0 }, { x: 999960, y: -60 }, { x: 999960, y: 60 }, { x: 999900, y: -60 }, { x: 999900, y: 60 }], { ref: { x: 999960, y: 0 } });
	assert.deepEqual(at(resolveAnchor(edge, { near: 'ref' })), [999960, -120], 'near at the bound: never 1,000,020,0, a pitch away -- of the three at two pitches within it, the lesser y');
	assert.equal(at(resolveAnchor(edge, { near: 'ref', dir: 'right' })), 'nothing free to the right of ref', 'the walk stops at the bound');
	const frame = board([{ x: 900, y: 0 }], { ref: { x: 900, y: 0 } });
	assert.deepEqual(at(resolveAnchor(frame, { near: 'ref', dir: 'right' })), [960, 0], 'the walk past the old frame\'s edge, where the old extent stopped it');
	const fifteen = board([{ x: 900, y: 0 }, ...Array.from({ length: 15 }, (_, i) => ({ x: 960 + 60 * i, y: 0 }))], { ref: { x: 900, y: 0 } });
	assert.deepEqual(at(resolveAnchor(fifteen, { near: 'ref', dir: 'right' })), [1860, 0], 'fifteen held: the sixteenth step');
	const blocked = board([{ x: 900, y: 0 }, ...Array.from({ length: 16 }, (_, i) => ({ x: 960 + 60 * i, y: 0 }))], { ref: { x: 900, y: 0 } });
	assert.equal(at(resolveAnchor(blocked, { near: 'ref', dir: 'right' })), 'nothing free to the right of ref', 'sixteen held: at most 16 steps');
	const far = board([{ x: 3000, y: 0 }, { x: 3120, y: 0 }]);
	assert.deepEqual(at(resolveAnchor(far, { between: ['n0', 'n1'] })), [3060, 0], 'between past the old frame');
	const zone = { id: 'zone-0c0004', name: 'out', x: 2970, y: 2550, w: 180, h: 120 };
	assert.deepEqual(at(resolveAnchor(board([], { zones: [zone] }), { inside: 'out' })), [3060, 2580], 'inside a zone past the old frame, nearest its centre');
});
