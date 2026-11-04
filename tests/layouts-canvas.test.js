/*
WD-b2 (H19.46; dev/design/unification/WIDE-DEVICES.md sections 5.1, 6 and 12.4-12.6) -- THE CANVAS READS THE LAYOUTS.

Test 9: the grids are drawn from the open diagram's layout records -- each dot on its record's lattice, within its record's
extent -- and redrawn when a diagram is loaded, never on an edit; a diagram lacking a record is an error naming it. How a grid
is shown -- its page layer, its dot, that the zone grid shows while Shift is held -- is the layouts plugin's code, keyed by the
layout's name; a grid is drawn only where some part places a kind on its lattice, so a page without the zones plugin draws no
zone grid.

Test 4: the layouts plugin holds the anchor's place and both grids; the product's part is composition alone -- it reads no
device field -- and the layouts plugin imports no other plugin.

Test 6: a place's size comes from one source, which the place declares -- its own `size`, as the zone's place carries it, or
`sizedBy: 'parts'`, its kind's parts sizing it, as the devices plugin declares a device's from its span, at most one answering
and none meaning one cell; a sizer answering nothing means one cell; a place declaring neither or both, or sized twice, is
refused when the canvas is composed, naming the parts (the design's rule as built -- section 5.1, AMENDED at WD-b2).
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { installDom, fakeEl, sceneOver, dotsOf } from './fixtures/client-harness.mjs';
import { Model } from './fixtures/composed.mjs';
import { PRODUCT_CANVAS } from '../product/canvas.mjs';
import { LAYOUTS_CANVAS } from '../plugins/layouts/layout-canvas.mjs';
import { Grids } from '../app/src/grids.js';
import { placesOf, gridsOf } from '../app/src/snap.js';
import { gridDot } from '../kernel/geometry.mjs';
import { LAYOUT_TABLE } from '../plugins/layouts/layout-table.mjs';

const code = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
// RESTATED at H26.4 (dev/design/components/VECTOR-SCENE.md appendix B): the canvas's scene over a fake root, its layers found by id --
// each grid one item of its layer -- where the page's two grid layers were made here
const page = () => sceneOver(fakeEl('svg', 'canvas'));
const docWith = (node) => ({ meta: { id: '00000000000e0101', name: 'd' }, layouts: [node, structuredClone(LAYOUT_TABLE[1])], nodes: [] });

/*
RESTATED at H26.6's move 8 (dev/design/components/PAN-ZOOM.md section 3.7, PZ24): a grid is drawn from the view -- every lattice point the
canvas shows and the margin's beyond it, one path of round zero-length strokes per tier -- where every point within the record's
extent was drawn at load. Here no view part is composed, so every dot is full at its drawing radius over the fake root's 1,920 by 1,080
at a scale of one, with the margin the look hands; tests/grids-view.test.js holds the levels, the tiers and the bound.
*/
const LOOK = () => ({ tiers: [{ every: 1, opacity: 1 }], dotScale: null, margin: 32 });
// every point of a lattice of `pitch` through `o` in the closed rect -- an independent count, a pitch at a time
const brute = (pitch, o, x0, y0, x1, y1) => {
	const out = [];
	for (let y = o + Math.ceil((y0 - o) / pitch) * pitch; y <= y1; y += pitch) for (let x = o + Math.ceil((x0 - o) / pitch) * pitch; x <= x1; x += pitch) out.push({ x, y });
	return out;
};
const xy = (d) => ({ x: d.x, y: d.y });

test('WD-b2 test 9: the grids are drawn from the open diagram\'s records -- H26.6 move 8: every dot of its lattice the canvas shows and its margin', () => {
	const restore = installDom();
	try {
		const { svg, scene } = page();
		new Grids({ scene, grids: gridsOf(PRODUCT_CANVAS), model: new Model(), look: LOOK });   // H26.8's grid move: handed its grids, as the composition hands them
		const nodes = dotsOf(svg.byId['#grid-nodes']), zones = dotsOf(svg.byId['#grid-zones']);
		assert.deepEqual(nodes.map(xy), brute(60, 0, -32, -32, 1952, 1112), 'the node grid: its record\'s lattice over 0..1920 by 0..1080 grown by 32 pixels, row by row');
		assert.deepEqual(zones.map(xy), brute(60, 30, -32, -32, 1952, 1112), 'the zone grid: half a pitch off, over the same area');
		assert.deepEqual([nodes.length, zones.length], [33 * 19, 34 * 20], 'the zone lattice reaching a column and a row further, at -30');
		assert.ok(nodes.every((d) => d.width === 2 * gridDot().radius && d.opacity === 1), 'each node dot full, its stroke the diameter of the grid dot at a scale of one');
		assert.ok(zones.every((d) => d.width === 10), 'each zone dot 10 across');
	} finally { restore(); }
});

test('WD-b2 test 9: a load redraws the grids from the loaded records; an edit does not redraw them', () => {
	const restore = installDom();
	try {
		const { svg, scene } = page(), model = new Model();
		new Grids({ scene, grids: gridsOf(PRODUCT_CANVAS), model, look: LOOK });
		const first = svg.byId['#grid-nodes'].children[0];
		model.put('node', { id: 'node-0e0101', name: 'a', x: 0, y: 0 });
		assert.equal(svg.byId['#grid-nodes'].children[0], first, 'an edit leaves the dots as they were');
		// a record no door admits while WD7 holds, loaded straight into the Model: the drawing reads the record, not a constant
		model.load(docWith({ ...structuredClone(LAYOUT_TABLE[0]), pitch: 120 }));
		assert.deepEqual(dotsOf(svg.byId['#grid-nodes']).map(xy), brute(120, 0, -32, -32, 1952, 1112), 'redrawn at the loaded pitch');
		assert.equal(dotsOf(svg.byId['#grid-zones']).length, 34 * 20, 'the zone grid from its own record, unchanged');
		model.load(docWith(structuredClone(LAYOUT_TABLE[0])));
		assert.equal(dotsOf(svg.byId['#grid-nodes']).length, 33 * 19, 'and back, on the next load');
	} finally { restore(); }
});

test('WD-b2: a diagram lacking a layout record is an error naming it; a page without the zones plugin draws no zone grid', () => {
	const restore = installDom();
	try {
		const lacking = { get: () => undefined, onChange() {} };
		assert.throws(() => new Grids({ scene: page().scene, grids: gridsOf(PRODUCT_CANVAS), model: lacking, look: LOOK }), /the node layout \(layout-000001\) is missing/);
		const { svg, scene } = page();
		const noZones = PRODUCT_CANVAS.filter((p) => p.owner !== 'zones');
		new Grids({ scene, grids: gridsOf(noZones), model: new Model(), look: LOOK });
		assert.equal(dotsOf(svg.byId['#grid-zones']).length, 0, 'nothing places on the zone lattice, so no zone grid');
		assert.equal(dotsOf(svg.byId['#grid-nodes']).length, 33 * 19, 'and the node grid as ever');
		assert.deepEqual(gridsOf(noZones).map((g) => g.layout), ['node']);
		assert.deepEqual(gridsOf(PRODUCT_CANVAS).map((g) => [g.layout, g.layer, g.shownWith ?? null, g.cls ?? null]),
			[['node', 'grid-nodes', null, null], ['zone', 'grid-zones', 'shiftKey', 'zonegrid']], 'how each is shown, keyed by its layout');
	} finally { restore(); }
});

test('WD-b2 test 4: the layouts plugin holds the anchor\'s place and both grids; the product\'s part is composition alone', () => {
	// RESTATED at H26.8's grid move (NATIVE-SHAPES.md section 3.2): the place carries its grid alone, its extent the grid's bounds
	assert.deepEqual(LAYOUTS_CANVAS.places.map((p) => [p.kind, p.layout, 'ext' in p, 'size' in p, p.sizedBy]), [['node', 'node', false, false, 'parts']],
		'the anchor\'s place, on the node layout, keeping no extent beside its grid, carrying no size of its own: its kind\'s parts size it');
	// RESTATED at H26.1 (SNAP-GRID.md section 5): and the node grid bounded by that extent, which it snaps to -- the table's. RESTATED at
	// H26.6's move 11 (PAN-ZOOM.md section 3.8, "The extents"): the node grid with no bounds, the table's record's lattice unbounded
	assert.deepEqual(LAYOUTS_CANVAS.places[0].grid.declaration, { shape: 'square', pitch: 60, origin: { x: 0, y: 0 } }, 'the node lattice, no bounds');
	assert.deepEqual(LAYOUTS_CANVAS.grids.map((g) => g.layout), ['node', 'zone']);
	const product = PRODUCT_CANVAS.find((p) => p.owner === 'the product');
	assert.deepEqual(Object.keys(product).sort(), ['deleteRanks', 'orders', 'owner'], 'the anchor\'s drawing order and its rank in a delete -- composition');
	assert.doesNotMatch(code('product/canvas.mjs'), /\.(span|type|shape|content)\b|spanExtent|NODE_EXT|gridDot/, 'the product reads no device field and draws no grid');
	for (const f of fs.readdirSync(new URL('../plugins/layouts/', import.meta.url)).filter((x) => x.endsWith('.mjs'))) {
		for (const [, from] of code(`plugins/layouts/${f}`).matchAll(/^import [^;]*? from '([^']+)'/gm)) {
			assert.match(from, /^(\.\/|\.\.\/\.\.\/model\/|\.\.\/\.\.\/kernel\/)/, `plugins/layouts/${f} imports ${from} -- the layouts plugin imports the core and itself alone`);
		}
	}
	assert.doesNotMatch(code('plugins/layouts/layout-canvas.mjs'), /\.(span|type|shape|content)\b/, 'nor does it read a device field');
});

test('WD-b2 test 6: a device\'s place size is its span\'s extent, a waypoint\'s one cell; a zone\'s place keeps its own size', () => {
	const places = placesOf(PRODUCT_CANVAS);
	const node = places.get('node'), zone = places.get('zone');
	assert.deepEqual(node.size({ id: 'node-0e0102', type: 'host', x: 0, y: 0, span: { cols: 3, rows: 2 } }), { w: 120, h: 60 }, 'a 3x2 panel');
	assert.deepEqual(node.size({ id: 'node-0e0103', type: 'host', x: 0, y: 0 }), { w: 0, h: 0 }, 'a device of one cell');
	assert.deepEqual(node.size({ id: 'node-0e0104', x: 0, y: 0 }), { w: 0, h: 0 }, 'a waypoint: the sizer answers nothing, one cell');
	assert.deepEqual(zone.size({ id: 'zone-0e0101', x: 30, y: 30, w: 240, h: 180 }), { w: 240, h: 180 });
	assert.equal(typeof PRODUCT_CANVAS.find((p) => p.owner === 'devices').sizes?.node, 'function', 'the devices plugin declares a device\'s size');
});

test('WD-b2 test 6: a place declaring no source or two, or sized twice, is refused when the canvas is composed, naming the parts', () => {
	const anchorPlace = (patch) => PRODUCT_CANVAS.map((p) => (p.owner === 'layouts' ? { ...p, places: p.places.map((pl) => ({ ...pl, ...patch })) } : p));
	assert.throws(() => placesOf(anchorPlace({ sizedBy: undefined })), /node has no size -- layouts's place declares neither its own size nor that its kind's parts size it/);
	assert.throws(() => placesOf(anchorPlace({ size: () => ({ w: 0, h: 0 }) })), /node declares both its own size and that its kind's parts size it, in layouts's place/);
	assert.throws(() => placesOf(anchorPlace({ sizedBy: undefined, size: () => ({ w: 0, h: 0 }) })), /node is sized by layouts's place and by devices's sizes/);
	assert.throws(() => placesOf([...PRODUCT_CANVAS, { owner: 'probe', sizes: { node: () => ({ w: 0, h: 0 }) } }]), /node is sized by devices's sizes and by probe's sizes/);
	assert.throws(() => placesOf([...PRODUCT_CANVAS, { owner: 'probe', sizes: { zone: () => ({ w: 0, h: 0 }) } }]), /zone is sized by zones's place and by probe's sizes/);
	assert.equal(placesOf(PRODUCT_CANVAS).size, 2, 'the product\'s composition: one source each -- the control');
});

test('WD-b2 test 6: without the devices plugin no part sizes the anchor, so every anchor is one cell', () => {
	const node = placesOf(PRODUCT_CANVAS.filter((p) => p.owner !== 'devices')).get('node');
	assert.deepEqual(node.size({ id: 'node-0e0105', type: 'host', x: 0, y: 0, span: { cols: 3, rows: 2 } }), { w: 0, h: 0 }, 'a panel\'s span is the devices plugin\'s to read');
});
