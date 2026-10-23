/*
H24.6 (B356) -- A DIRECTED LINK'S HEAD, drawn as a shape of its own (docs/spec/ATOMICS.md "Arrowheads", "The design, as ruled").

The head was an SVG marker at the path's last point, the anchor's centre, so it lay under the device it pointed at: on a 6 px
link a wedge of 6-7 px showed, and on a 3.6 px control link none of it. The rulings: the line still runs to the centre and the
tip sits on the anchor's outline (H24.6-1); the head is 4 line widths long, never under 18 px (H24.6-2); hollow, outlined at
4 px, the outline's outer edge on the anchor's outline, its inside clear and the line broken beneath it (H24.6-2b); the
link's colour in every state (H24.6-3, held in tests/browser.test.js); nothing along the line (H24.6-4).

The geometry is held exactly here; then the product's own export (server/svg.mjs, which drives the real Renderer and the
network's link painter, as the canvas does) is held at every kind of anchor.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headLength, HEAD_OUTLINE, outlineDistance, linkHead } from '../plugins/network/link-head.mjs';
import { svgDocument } from '../server/svg.mjs';
import { heldLayouts } from './fixtures/composed.mjs';
import { pipeEntity } from '../plugins/network/pipe-kind.mjs';

const CIRCLE = { form: 'circle', r: 20 };
const SQUARE = { form: 'rect', x0: -20, y0: -20, x1: 20, y1: 20 };
const BACK = (HEAD_OUTLINE / 2) / Math.sin(Math.atan(0.5));   // how far the outline's centre line sits behind its outer tip
const near = (a, b, why, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${why}: ${a} is not ${b}`);

test('H24.6-2: a head is 4 line widths long and never under 18 px; its outline is 4 px', () => {
	assert.equal(headLength(6), 24, 'a 6 px data link: 24');
	assert.equal(headLength(3.6), 18, 'a 3.6 px control link: the 18 px floor, not 14.4');
	assert.equal(HEAD_OUTLINE, 4);
});

test('H24.6-1: the distance from an anchor\'s centre to its outline, along a direction', () => {
	near(outlineDistance(CIRCLE, { x: 1, y: 0 }), 20, 'a circle, along an axis');
	near(outlineDistance(CIRCLE, { x: Math.SQRT1_2, y: Math.SQRT1_2 }), 20, 'a circle, on a diagonal');
	near(outlineDistance(SQUARE, { x: -1, y: 0 }), 20, 'a square, along an axis');
	near(outlineDistance(SQUARE, { x: Math.SQRT1_2, y: Math.SQRT1_2 }), 28.284, 'a square, to its corner');
	near(outlineDistance({ form: 'rect', x0: -20, y0: -20, x1: 140, y1: 80 }, { x: 1, y: 0 }), 140, 'a 3 x 2 device, to its far side');
	near(outlineDistance(undefined, { x: 0, y: 1 }), 20, 'no outline declared: the network\'s own anchor ring, 20');
});

test('H24.6-1, -2b: a forward head\'s tip is on the destination\'s outline, and the line is broken beneath it', () => {
	const h = linkHead({ points: [[-300, 0], [0, 0]], which: 'end', width: 6, outlines: { start: CIRCLE, end: CIRCLE } });
	assert.deepEqual(h.tip, [-20, 0], 'the tip on the outline, 20 px from the centre');
	assert.equal(h.length, 24);
	// RESTATED 2026-10-16 (H24.6, the director: the leg past the head is "attached to the head of the arrow"): the line is drawn FROM the
	// head's base outward, and the leg into the anchor is a piece of its own starting under the head's solid tip, so each begins at the head
	assert.equal(h.lineD, 'M-43 0 L-300 0', 'the line starts 1 px into the head\'s base and runs out to the far end');
	assert.equal(h.legD, 'M-27 0 L0 0', 'the leg starts 7 px inside the tip -- under solid ink at least as wide as the line -- and runs to the centre');
	assert.equal(h.legOffset, -7, 'and its dash pattern, if any, begins at the tip');
	assert.equal(h.headD, `M${(-20 - BACK).toFixed(3).replace(/\.?0+$/, '')} 0 L-42 8.764 L-42 -8.764 Z`, 'the outline\'s centre line: its outer edge touches the tip');
});

test('H24.6-1: a reverse head sits at the source, and the line is broken there', () => {
	const h = linkHead({ points: [[-300, 0], [0, 0]], which: 'start', width: 6, outlines: { start: CIRCLE, end: CIRCLE } });
	assert.deepEqual(h.tip, [-280, 0]);
	assert.equal(h.lineD, 'M-257 0 L0 0', 'from the head\'s base out to the far end');
	assert.equal(h.legD, 'M-273 0 L-300 0', 'and the leg from inside the tip into the source');
});

test('H24.6-1: a head follows the line\'s last straight run -- a diagonal into a square stops at its corner side, a wide device from its far side', () => {
	const d = linkHead({ points: [[-120, -60], [0, 0]], which: 'end', width: 6, outlines: { start: CIRCLE, end: SQUARE } });
	near(d.tip[0], -20, 'a diagonal into a square: x'); near(d.tip[1], -10, 'and y -- on the square\'s side, 22.36 px out');
	const w = linkHead({ points: [[400, 0], [0, 0]], which: 'end', width: 6, outlines: { start: CIRCLE, end: { form: 'rect', x0: -20, y0: -20, x1: 140, y1: 80 } } });
	assert.deepEqual(w.tip, [140, 0], 'into a 3 x 2 device from the right: on its right side, not its first cell');
	assert.equal(w.lineD, 'M163 0 L400 0');
	assert.equal(w.legD, 'M147 0 L0 0', 'the leg runs on beneath the device to its first cell');
});

test('H24.6-2: a head shrinks to fit a short last run rather than bending round a corner -- a bend one cell before a device', () => {
	const h = linkHead({ points: [[-300, -60], [0, -60], [0, 0]], which: 'end', width: 6, outlines: { start: CIRCLE, end: CIRCLE } });
	assert.equal(h.length, 20, '40 px of straight run after the bend, 20 of it inside the outline: a 20 px head, not 24');
	assert.equal(h.lineD, 'M0 -39 L0 -40 Q0 -60 -20 -60 L-300 -60', 'drawn from the head back round the bend');
	assert.equal(h.legD, 'M0 -27 L0 0');
});

test('H24.6-1: a closed ring carries its head where it closes, at its first anchor, from either side', () => {
	const ring = [[0, 0], [240, 0], [240, 240], [0, 240]];
	const f = linkHead({ points: ring, closed: true, which: 'end', width: 6, outlines: { start: CIRCLE, end: CIRCLE } });
	assert.deepEqual(f.tip, [0, 20], 'forward: on the closing run, arriving from below');
	assert.equal(f.lineD, 'M0 27 L0 20 Q0 0 20 0 L220 0 Q240 0 240 20 L240 220 Q240 240 220 240 L20 240 Q0 240 0 220 L0 43',
		'one piece: from inside the tip, round the ring in the flow\'s direction, back to the head\'s base');
	assert.equal(f.legD, null, 'a ring has no leg: the line itself goes on past the tip');
	assert.equal(f.lineOffset, -7, 'and its dash pattern begins at the tip');
	const r = linkHead({ points: ring, closed: true, which: 'start', width: 6, outlines: { start: CIRCLE, end: CIRCLE } });
	assert.deepEqual(r.tip, [20, 0], 'reverse: on the first run, arriving from the right');
	assert.equal(r.lineD, 'M27 0 L20 0 Q0 0 0 20 L0 220 Q0 240 20 240 L220 240 Q240 240 240 220 L240 20 Q240 0 220 0 L43 0');
	assert.ok(!/[ZM].*M/.test(f.lineD + ' ' + r.lineD.slice(1)) && !/Z/.test(f.lineD + r.lineD), 'one open piece each, no closepath');
});

test('H24.6: the leg starts under the head\'s solid tip, where the ink is at least as wide as the line, so they read as one', () => {
	const SOLID = HEAD_OUTLINE / Math.sin(Math.atan(0.5));   // the apex is solid ink this far behind the tip (8.94)
	for (const w of [6, 3.6]) {
		const h = linkHead({ points: [[-300, 0], [0, 0]], which: 'end', width: w, outlines: {} });
		const tuck = -h.legOffset;
		assert.ok(tuck / 2 >= w / 2, `w ${w}: the head is ${tuck} px wide ${tuck} px behind its tip, at least the line's ${w}`);
		assert.ok(tuck < SOLID, `w ${w}: and still inside the solid apex (${SOLID.toFixed(2)} px), so the hollow inside stays clear`);
		assert.equal(Number(h.legD.match(/^M(-?[\d.]+)/)[1]), -20 - tuck, 'the leg starts there');
	}
});

test('H24.6: an undeclared link has no head', () => {
	assert.equal(linkHead({ points: [[-300, 0], [0, 0]], which: null, width: 6, outlines: {} }), null);
});

// ---- the product's export, at every kind of anchor ----

const P = 60;
const host = (id, cx, cy, extra = {}) => ({ id, name: id.slice(-2), type: 'host', shape: 'circle', x: cx * P, y: cy * P, ...extra });
const wp = (id, cx, cy) => ({ id, name: id.slice(-2), x: cx * P, y: cy * P });
const BOARD = {
	nodes: [
		host('node-c00001', -6, 0), host('node-c00002', 0, 0),                                   // round device
		host('node-c00003', -6, 2), host('node-c00004', 0, 2, { shape: 'square' }),              // square device
		host('node-c00005', 8, 4), host('node-c00006', 0, 4, { span: { cols: 3, rows: 2 } }),    // wide device, from its far side
		host('node-c00007', -6, 7), wp('node-c00008', 0, 7),                                     // endpoint waypoint
		host('node-c00009', -6, 9), host('node-c0000a', 0, 9),                                   // control link
		host('node-c0000b', -6, 11), host('node-c0000c', 0, 11),                                 // reverse
		host('node-c0000d', -6, 13), host('node-c0000e', 0, 13),                                 // undeclared
		host('node-c0000f', -6, 15), host('node-c00010', 0, 15),                                 // down: no pipe
	],
	links: [
		{ id: 'link-c00001', name: 'round', src: 'node-c00001', dst: 'node-c00002', direction: 'forward' },
		{ id: 'link-c00002', name: 'square', src: 'node-c00003', dst: 'node-c00004', direction: 'forward' },
		{ id: 'link-c00003', name: 'wide', src: 'node-c00005', dst: 'node-c00006', direction: 'forward' },
		{ id: 'link-c00004', name: 'endpoint', src: 'node-c00007', dst: 'node-c00008', direction: 'forward' },
		{ id: 'link-c00005', name: 'control', src: 'node-c00009', dst: 'node-c0000a', direction: 'forward', control: true },
		{ id: 'link-c00006', name: 'reverse', src: 'node-c0000b', dst: 'node-c0000c', direction: 'reverse' },
		{ id: 'link-c00007', name: 'plain', src: 'node-c0000d', dst: 'node-c0000e' },
		{ id: 'link-c00008', name: 'down', src: 'node-c0000f', dst: 'node-c00010', direction: 'forward' },
	],
};
function exported() {
	const links = BOARD.links.map((l, i) => ({ ...l, order: i + 1 }));
	const doc = { meta: { id: '0000000000c10001', name: 'heads', version: 1, schema: 3 }, layouts: heldLayouts(),
		nodes: BOARD.nodes.map((n, i) => ({ ...n, order: i + 1 })), links,
		pipes: links.filter((l) => l.name !== 'down').map((l) => pipeEntity(l.src, l.dst, 'link')), zones: [], groups: [], selection: [] };
	return svgDocument(doc);
}
const headsIn = (svg) => [...svg.matchAll(/<path class="link-head"([^>]*)\/>/g)].map((m) => {
	const at = (k) => (m[1].match(new RegExp(` ${k}="([^"]*)"`)) || [])[1] ?? null;
	const [x, y] = at('d').match(/^M(-?[\d.]+) (-?[\d.]+)/).slice(1).map(Number);
	return { of: at('data-head-of'), tipC: [x, y], d: at('d'), width: at('stroke-width'), stroke: at('stroke'), down: at('data-down') !== null };
});

test('H24.6: the export draws a hollow head at every kind of anchor, its tip on the outline, and no marker', () => {
	const svg = exported();
	assert.doesNotMatch(svg, /marker-(end|start)|<marker /, 'the SVG marker is retired');
	const heads = Object.fromEntries(headsIn(svg).map((h) => [h.of, h]));
	assert.deepEqual(Object.keys(heads).sort(), ['link-c00001', 'link-c00002', 'link-c00003', 'link-c00004', 'link-c00005', 'link-c00006', 'link-c00008'],
		'every directed link has one head, and the undeclared link none');
	const tip = (id, x, y, why) => { near(heads[id].tipC[0], x, `${why}: x`); near(heads[id].tipC[1], y, `${why}: y`); };
	tip('link-c00001', -20 - BACK, 0, 'a round device');
	tip('link-c00002', -20 - BACK, 120, 'a square device');
	tip('link-c00003', 140 + BACK, 240, 'a 3 x 2 device reached from its far side');
	tip('link-c00004', -20 - BACK, 420, 'an endpoint waypoint\'s outer ring');
	tip('link-c00006', -360 + 20 + BACK, 660, 'a reverse link: at its source');
	for (const h of Object.values(heads)) assert.equal(h.width, '4', `${h.of}: a 4 px outline`);
	const base = (h) => Number(h.d.match(/ L(-?[\d.]+) /)[1]);
	near(heads['link-c00001'].tipC[0] - base(heads['link-c00001']), 24 - BACK - 2, 'a data link\'s head: 24 long');
	near(heads['link-c00005'].tipC[0] - base(heads['link-c00005']), 18 - BACK - 2, 'a control link\'s head: 18 long');
	assert.equal(heads['link-c00008'].down, true, 'a down link\'s head is marked down');
	assert.notEqual(heads['link-c00008'].stroke, heads['link-c00001'].stroke, 'and takes the down colour, not the link colour');
	// RESTATED 2026-10-16 (H24.6): drawn from the head's base outward, the leg a piece of its own (`.link-leg`) from inside the tip
	assert.match(svg, /<g id="link-c00001"><path d="M-43 0 L-360 0"[^>]* stroke-linecap="butt"/,
		'the line starts at the head\'s base, with square ends so no cap shows inside it');
	const legs = Object.fromEntries([...svg.matchAll(/<path class="link-leg"([^>]*)\/>/g)].map((m) => [m[1].match(/ data-leg-of="([^"]*)"/)[1], m[1]]));
	assert.deepEqual(Object.keys(legs).sort(), Object.keys(heads).sort(), 'every head has its leg');
	assert.match(legs['link-c00001'], / d="M-27 0 L0 0"/, 'a data link\'s leg, from under the tip to the centre');
	assert.match(legs['link-c00005'], / stroke-dasharray="[\d.]+ [\d.]+"/, 'a control link\'s leg is dashed like its line');
	assert.match(legs['link-c00005'], / stroke-dashoffset="-4.6"/, 'and its first dash starts at the tip, 4.6 px into it');
	assert.match(svg, /<g id="link-c00005"><path d="M-37 540 L-360 540"/, 'the control line starts at its head\'s base, where its first dash begins');
	assert.match(svg, /<g id="link-c00007"><path d="M-360 780 L0 780"/, 'control: an undeclared link is one unbroken line');
});

/*
A head goes where its link goes: deleted with it, and kept straight after it when links are restacked by drawing order -- the
stylesheet colours a head from the element just before it, so a head that drifted from its link would take another's colour.
*/
test('H24.6: a head is deleted with its link, and stays straight after it when the links are restacked', async () => {
	const { Model } = await import('./fixtures/composed.mjs');
	const { attachRelations } = await import('../engine/store.mjs');
	const { NODE_GRID } = await import('../kernel/geometry.mjs');
	const { Renderer } = await import('../app/src/renderer.js');
	const { makeRenderer } = await import('./fixtures/client-harness.mjs');
	const { PRODUCT_CANVAS } = await import('../product/canvas.mjs');
	const { svg, scene, restore } = makeRenderer();
	try {
		const m = new Model(); attachRelations(m, { nearest: NODE_GRID.nearest });
		new Renderer(m, svg, { parts: PRODUCT_CANVAS, scene });
		const n = (id, x, y) => m.put('node', { id, name: id.slice(-2), type: 'host', shape: 'circle', x, y });
		n('node-d00001', -360, 0); n('node-d00002', 0, 0); n('node-d00003', -360, 120); n('node-d00004', 0, 120);
		m.put('link', { id: 'link-d00001', name: 'a', src: 'node-d00001', dst: 'node-d00002', direction: 'forward', order: 1 });
		m.put('link', { id: 'link-d00002', name: 'b', src: 'node-d00003', dst: 'node-d00004', direction: 'forward', order: 2 });
		const layer = () => svg.byId['#links'].children.map((c) => c.attrs.id || `${c.attrs.class}:${c.attrs['data-head-of'] ?? c.attrs['data-leg-of'] ?? c.attrs['data-link']}`);
		assert.deepEqual(layer(), ['link-d00001', 'link-head:link-d00001', 'link-leg:link-d00001', 'link-hit:link-d00001', 'link-d00002', 'link-head:link-d00002', 'link-leg:link-d00002', 'link-hit:link-d00002']);
		m.set('link', 'link-d00001', { order: 3 });   // drawn last now: restacked above the other
		assert.deepEqual(layer(), ['link-d00002', 'link-head:link-d00002', 'link-leg:link-d00002', 'link-hit:link-d00002', 'link-d00001', 'link-head:link-d00001', 'link-leg:link-d00001', 'link-hit:link-d00001'],
			'restacked, each head still straight after its own link');
		m.del('link', 'link-d00002');
		assert.deepEqual(layer(), ['link-d00001', 'link-head:link-d00001', 'link-leg:link-d00001', 'link-hit:link-d00001'], 'deleted, its head and leg go with it');
	} finally { restore(); }
});
