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
import { installDom, fakeEl } from './fixtures/client-harness.mjs';
import { Model } from './fixtures/composed.mjs';
import { PRODUCT_CANVAS } from '../product/canvas.mjs';
import { LAYOUTS_CANVAS } from '../layouts/layout-canvas.mjs';
import { Grids } from '../app/src/grids.js';
import { placesOf, gridsOf } from '../app/src/snap.js';
import { gridDot } from '../kernel/geometry.mjs';
import { LAYOUT_TABLE } from '../layouts/layout-table.mjs';

const code = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const page = () => {
	const svg = fakeEl('svg', 'canvas');
	svg.byId = { '#grid-nodes': fakeEl('g', 'grid-nodes'), '#grid-zones': fakeEl('g', 'grid-zones') };
	return svg;
};
const dots = (svg, layer) => svg.byId[`#${layer}`].children;
const at = (c) => [Number(c.attrs.cx), Number(c.attrs.cy), Number(c.attrs.r)];
const docWith = (node) => ({ meta: { id: 'diagram-0e0101', name: 'd' }, layouts: [node, structuredClone(LAYOUT_TABLE[1])], nodes: [] });

test('WD-b2 test 9: the grids are drawn from the open diagram\'s records -- every dot on its lattice, within its extent', () => {
	const restore = installDom();
	try {
		const svg = page();
		new Grids({ svg, parts: PRODUCT_CANVAS, model: new Model() });
		const nodes = dots(svg, 'grid-nodes'), zones = dots(svg, 'grid-zones');
		assert.equal(nodes.length, 31 * 17, 'the node grid: the node layout\'s lattice within its extent');
		assert.deepEqual([at(nodes[0]), at(nodes.at(-1))], [[-900, -480, gridDot().radius], [900, 480, gridDot().radius]]);
		assert.equal(zones.length, 32 * 18, 'the zone grid: half a pitch off, edge to edge of its extent');
		assert.deepEqual([at(zones[0]), at(zones.at(-1))], [[-930, -510, 5], [930, 510, 5]]);
	} finally { restore(); }
});

test('WD-b2 test 9: a load redraws the grids from the loaded records; an edit does not redraw them', () => {
	const restore = installDom();
	try {
		const svg = page(), model = new Model();
		new Grids({ svg, parts: PRODUCT_CANVAS, model });
		const first = dots(svg, 'grid-nodes')[0];
		model.put('node', { id: 'node-0e0101', name: 'a', x: 0, y: 0 });
		assert.equal(dots(svg, 'grid-nodes')[0], first, 'an edit leaves the dots as they were');
		// a record no door admits while WD7 holds, loaded straight into the Model: the drawing reads the record, not a constant
		model.load(docWith({ ...structuredClone(LAYOUT_TABLE[0]), pitch: 120 }));
		// the lattice is the multiples of 120 from the origin: -840..840 across (900 is not one), -480..480 down
		assert.equal(dots(svg, 'grid-nodes').length, 15 * 9, 'redrawn at the loaded pitch');
		assert.deepEqual(at(dots(svg, 'grid-nodes')[0]), [-840, -480, gridDot().radius]);
		assert.equal(dots(svg, 'grid-zones').length, 32 * 18, 'the zone grid from its own record, unchanged');
		model.load(docWith(structuredClone(LAYOUT_TABLE[0])));
		assert.equal(dots(svg, 'grid-nodes').length, 31 * 17, 'and back, on the next load');
	} finally { restore(); }
});

test('WD-b2: a diagram lacking a layout record is an error naming it; a page without the zones plugin draws no zone grid', () => {
	const restore = installDom();
	try {
		const lacking = { get: () => undefined, onChange() {} };
		assert.throws(() => new Grids({ svg: page(), parts: PRODUCT_CANVAS, model: lacking }), /the node layout \(layout-000001\) is missing/);
		const svg = page();
		const noZones = PRODUCT_CANVAS.filter((p) => p.owner !== 'zones');
		new Grids({ svg, parts: noZones, model: new Model() });
		assert.equal(dots(svg, 'grid-zones').length, 0, 'nothing places on the zone lattice, so no zone grid');
		assert.equal(dots(svg, 'grid-nodes').length, 31 * 17, 'and the node grid as ever');
		assert.deepEqual(gridsOf(noZones).map((g) => g.layout), ['node']);
		assert.deepEqual(gridsOf(PRODUCT_CANVAS).map((g) => [g.layout, g.layer, g.shownWith ?? null, g.cls ?? null]),
			[['node', 'grid-nodes', null, null], ['zone', 'grid-zones', 'shiftKey', 'zonegrid']], 'how each is shown, keyed by its layout');
	} finally { restore(); }
});

test('WD-b2 test 4: the layouts plugin holds the anchor\'s place and both grids; the product\'s part is composition alone', () => {
	assert.deepEqual(LAYOUTS_CANVAS.places.map((p) => [p.kind, p.layout, p.ext.x, p.ext.y, 'size' in p, p.sizedBy]), [['node', 'node', 900, 480, false, 'parts']],
		'the anchor\'s place, on the node layout, its extent the table\'s, carrying no size of its own: its kind\'s parts size it');
	assert.deepEqual(LAYOUTS_CANVAS.grids.map((g) => g.layout), ['node', 'zone']);
	const product = PRODUCT_CANVAS.find((p) => p.owner === 'the product');
	assert.deepEqual(Object.keys(product).sort(), ['deleteRanks', 'orders', 'owner'], 'the anchor\'s drawing order and its rank in a delete -- composition');
	assert.doesNotMatch(code('product/canvas.mjs'), /\.(span|type|shape|content)\b|spanExtent|NODE_EXT|gridDot/, 'the product reads no device field and draws no grid');
	for (const f of fs.readdirSync(new URL('../layouts/', import.meta.url)).filter((x) => x.endsWith('.mjs'))) {
		for (const [, from] of code(`layouts/${f}`).matchAll(/^import [^;]*? from '([^']+)'/gm)) {
			assert.match(from, /^(\.\/|\.\.\/model\/|\.\.\/kernel\/)/, `layouts/${f} imports ${from} -- the layouts plugin imports the core and itself alone`);
		}
	}
	assert.doesNotMatch(code('layouts/layout-canvas.mjs'), /\.(span|type|shape|content)\b/, 'nor does it read a device field');
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
