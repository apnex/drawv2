/*
C-a (H19.29; dev/design/unification/CANVAS-PLUGINS.md, D1) -- A PLUGIN BRINGS THE PAINTER THAT DRAWS ITS KIND.

The renderer drew every kind with branches of its own -- a zone's group, rect, label pill and label built in `draw`, its look
applied in `update`, its layer chosen in `stackOf`, its turn taken in `syncAll`. A plugin hands the page a canvas part now,
`{ owner, painters }`, and a painter names its kind, the layer it draws into and whether it is stacked by drawing order, and
creates and updates its kind's elements through a kit the renderer hands it -- a plugin imports no canvas code. The renderer
dispatches to the composed painters and keeps what spans kinds. Zones first; groups, devices and links follow. The elements a
zone draws are what they were: the corpora hold that.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Model } from './fixtures/composed.mjs';
import { Renderer } from '../app/src/renderer.js';
import { makeRenderer, classesIn } from './fixtures/client-harness.mjs';

const code = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const ZONE = { id: 'zone-0c0a01', name: 'dmz', x: 30, y: 30, w: 120, h: 60 };
const parts = async () => (await import('../product/canvas.mjs')).PRODUCT_CANVAS;
const drawn = async (renderParts) => {
	const { svg, restore } = makeRenderer();
	try {
		const m = new Model();
		const r = renderParts === undefined ? new Renderer(m, svg) : new Renderer(m, svg, { parts: renderParts });
		m.put('zone', ZONE);
		const g = svg.ownerDocument.getElementById(ZONE.id);
		return { g, classes: g ? classesIn(g) : [], r };
	} finally { restore(); }
};

test('C-a: the product\'s canvas draws a zone -- its group, rect, label pill and label', async () => {
	const { g, classes } = await drawn(await parts());
	assert.ok(g, 'drawn');
	for (const c of ['zone', 'zone-rect', 'label-pill', 'label']) assert.ok(classes.includes(c), `with ${c}`);
});

test('C-a: a canvas composed without the zones plugin draws no zone', async () => {
	const { g } = await drawn([]);
	assert.equal(g, null, 'no painter for the kind, no element');
});

test('C-a: the zones plugin brings the zone\'s painter, and the renderer names no zone', async () => {
	const { ZONES_CANVAS } = await import('../zones/zone-painter.mjs');
	assert.equal(ZONES_CANVAS.owner, 'zones');
	assert.deepEqual(ZONES_CANVAS.painters.map((p) => [p.kind, p.layer, p.stacked]), [['zone', 'zones', true]]);
	assert.ok((await parts()).includes(ZONES_CANVAS), 'the product composes it');
	assert.doesNotMatch(code('app/src/renderer.js'), /'zones?'|zoneLook|ZONE_/, 'the renderer draws no zone of its own');
});

test('C-a: a malformed canvas part is refused when the canvas is built, naming its owner', async () => {
	const { svg, restore } = makeRenderer();
	try {
		const m = new Model();
		assert.throws(() => new Renderer(m, svg, { parts: [{ owner: 'p', painters: [{ kind: 'zone', layer: 'zones' }] }] }), /Renderer: p's painter for zone has no create/);
		// a page with no such layer -- the harness's svg answers any selector with a fresh element, so a bare one stands in
		const page = { querySelector: () => null };
		assert.throws(() => new Renderer(m, page, { parts: [{ owner: 'p', painters: [{ kind: 'zone', layer: 'nowhere', create() {}, update() {} }] }] }), /Renderer: p's painter for zone draws into #nowhere, which the page does not have/);
		const z = (await parts()).find((p) => p.owner === 'zones');   // RESTATED at D3: the product's order part comes first now
		assert.throws(() => new Renderer(m, svg, { parts: [z, { ...z, owner: 'again' }] }), /Renderer: zone is painted by zones and by again/);
	} finally { restore(); }
});

// ---- the group (C-a, step two): its hull, drawn by the groups plugin's painter, following its members ----

const NODES = [
	{ id: 'node-0c0b01', name: 'a', type: 'host', shape: 'circle', x: 0, y: 0 },
	{ id: 'node-0c0b02', name: 'b', type: 'host', shape: 'circle', x: 120, y: 0 },
];
const GROUP = { id: 'group-0c0b03', name: 'g', members: ['node-0c0b01', 'node-0c0b02'] };
const grouped = (renderParts) => {
	const { svg, restore } = makeRenderer();
	const m = new Model();
	const r = new Renderer(m, svg, { parts: renderParts });
	for (const n of NODES) m.put('node', n);
	m.put('group', GROUP);
	const hull = () => { const g = svg.ownerDocument.getElementById(GROUP.id); return g ? g.querySelector('.group-hull') : null; };
	return { m, r, hull, restore };
};

test('C-a: the product\'s canvas draws a group\'s hull around its members, and moves it when a member moves', async () => {
	const { m, hull, restore } = grouped(await parts());
	try {
		assert.ok(hull(), 'drawn');
		const before = hull().getAttribute('width');
		m.set('node', 'node-0c0b02', { x: 240 });
		assert.notEqual(hull().getAttribute('width'), before, 'the hull follows its member');
	} finally { restore(); }
});

test('C-a: a canvas composed without the groups plugin draws no group', async () => {
	const { hull, restore } = grouped((await parts()).filter((p) => p.owner !== 'groups'));
	try { assert.equal(hull(), null); } finally { restore(); }
});

test('C-a: the groups plugin brings the group\'s painter, and the renderer names no group', async () => {
	const { GROUPS_CANVAS } = await import('../groups/group-painter.mjs');
	assert.equal(GROUPS_CANVAS.owner, 'groups');
	assert.deepEqual(GROUPS_CANVAS.painters.map((p) => [p.kind, p.layer, p.stacked]), [['group', 'groups', false]]);
	assert.ok((await parts()).includes(GROUPS_CANVAS));
	assert.doesNotMatch(code('app/src/renderer.js'), /'groups?'|groupOf|groupBox|groupLook|GROUP_/, 'the renderer draws no group of its own');
});

test('C-a: a group none of whose members resolves loses its hull on its next update -- the painter asks for its removal', async () => {
	const { m, hull, restore } = grouped(await parts());
	try {
		assert.ok(hull(), 'drawn while its members stand');
		for (const n of NODES) m.del('node', n.id);   // the model alone, no planner to trim the group
		m.set('group', GROUP.id, { name: 'g2' });
		assert.equal(hull(), null, 'no member, no hull');
	} finally { restore(); }
});

// B314 -- C-a step one returned from `draw` for a painted kind before re-applying the session states, so a selected zone put
// again (undo, redo, an answer) lost its selected look until the selection next changed
test('B314: a selected zone drawn again keeps its selected look', async () => {
	const { svg, restore } = makeRenderer();
	try {
		const m = new Model();
		const r = new Renderer(m, svg, { parts: await parts() });
		m.put('zone', ZONE);
		r.reflectSelection([ZONE.id]);
		const selected = () => svg.ownerDocument.getElementById(ZONE.id).classList.contains('selected');
		assert.equal(selected(), true, 'selected');
		m.put('zone', { ...ZONE, name: 'dmz-2' });
		assert.equal(selected(), true, 'and still, once drawn again');
	} finally { restore(); }
});

// B315 -- the reveal marks an entity through `renderer.byId`, which searched the renderer's own layers; each painter took its
// kind's layer off that list, so a zone (from C-a step one) and a group (step two) could no longer be withheld by a beat
test('B315: the renderer finds the element of every drawn kind, a painted one or an appearance\'s included', async () => {
	const { svg, restore } = makeRenderer();
	try {
		const m = new Model();
		const r = new Renderer(m, svg, { parts: await parts() });
		m.put('zone', ZONE);
		for (const n of NODES) m.put('node', n);
		m.put('group', GROUP);
		m.put('node', { id: 'node-0c0b09', name: 'w', x: 240, y: 240 });
		// by its id: the harness answers an unmatched selector with a stand-in element, so finding something proves nothing
		for (const id of [ZONE.id, GROUP.id, NODES[0].id, 'node-0c0b09']) assert.equal(r.byId(id)?.getAttribute('id'), id, `${id} found`);
	} finally { restore(); }
});

// ---- the link (C-a, step four): drawn by the network's painter, with its invisible click twin, redrawing its waypoints ----

const LINKED = [
	['node', { id: 'node-0c0c01', name: 'a', type: 'host', shape: 'circle', x: 0, y: 0 }],
	['node', { id: 'node-0c0c02', name: 'w', x: 120, y: 0 }],
	['link', { id: 'link-0c0c03', name: 'l', src: 'node-0c0c01', dst: 'node-0c0c02' }],
];
const linked = (renderParts, fn) => {
	const { svg, restore } = makeRenderer();
	try {
		const m = new Model();
		const r = new Renderer(m, svg, { parts: renderParts });
		for (const [k, e] of LINKED) m.put(k, e);
		const twins = () => svg.querySelector('#links').children.filter((c) => c.getAttribute('data-link') === 'link-0c0c03');
		fn({ m, r, el: (id) => svg.ownerDocument.getElementById(id), twins });
	} finally { restore(); }
};

test('C-a: the product\'s canvas draws a link with its click twin, and a link deleted re-derives the waypoint it ended at', async () => {
	linked(await parts(), ({ m, el, twins }) => {
		assert.ok(el('link-0c0c03'), 'drawn');
		assert.equal(twins().length, 1, 'with its invisible click twin (B268)');
		assert.ok(el('node-0c0c02').getAttribute('class').split(' ').includes('endpoint'), 'the waypoint it ends at is an endpoint');
		m.del('link', 'link-0c0c03');
		assert.equal(twins().length, 0, 'the twin goes with it');
		assert.ok(!el('node-0c0c02').getAttribute('class').split(' ').includes('endpoint'), 'and the waypoint is a bend again (B218)');
	});
});

test('C-a: a canvas composed without the network\'s painter draws no link', async () => {
	const { NETWORK_APPEARANCES } = await import('../network/anchor-appearance.mjs');
	const without = (await parts()).map((p) => (p.owner === 'network' ? { owner: 'network', appearances: NETWORK_APPEARANCES } : p));
	linked(without, ({ el, twins }) => {
		assert.equal(el('link-0c0c03'), null);
		assert.equal(twins().length, 0);
	});
});

test('C-a: the network brings the link\'s painter, and the renderer draws no link of its own', async () => {
	const { NETWORK_CANVAS } = await import('../network/canvas.mjs');
	assert.equal(NETWORK_CANVAS.owner, 'network');
	assert.deepEqual(NETWORK_CANVAS.painters.map((p) => [p.kind, p.layer, p.stacked]), [['link', 'links', true]]);
	assert.ok((await parts()).includes(NETWORK_CANVAS));
	// its selection reflections -- a selected path lit, the links blocking a down link -- are session decorations, C-e's
	assert.doesNotMatch(code('app/src/renderer.js'), /linkPath|linkAppearance|APPEARANCE_KEYS|hitOf|hitTwin|refreshWaypointsOf|roundedPath|'link-hit'/, 'the renderer draws no link of its own');
});

test('C-a: a link put back in its place keeps its click twin just after it (B268, F-d)', async () => {
	const { svg, restore } = makeRenderer();
	try {
		const m = new Model();
		new Renderer(m, svg, { parts: await parts() });
		for (const [k, e] of LINKED.slice(0, 2)) m.put(k, e);
		m.put('node', { id: 'node-0c0c04', name: 'b', type: 'host', shape: 'circle', x: 0, y: 120 });
		const l1 = { id: 'link-0c0c05', name: 'l1', src: 'node-0c0c01', dst: 'node-0c0c02', order: 1 };
		const l2 = { id: 'link-0c0c06', name: 'l2', src: 'node-0c0c04', dst: 'node-0c0c02', order: 2 };
		m.put('link', l1); m.put('link', l2);
		const stack = () => svg.querySelector('#links').children.map((c) => c.getAttribute('id') || `twin:${c.getAttribute('data-link')}`);
		assert.deepEqual(stack(), [l1.id, `twin:${l1.id}`, l2.id, `twin:${l2.id}`]);
		m.del('link', l1.id); m.put('link', l1);   // what undo does
		assert.deepEqual(stack(), [l1.id, `twin:${l1.id}`, l2.id, `twin:${l2.id}`], 'back in its place, its twin with it');
	} finally { restore(); }
});
