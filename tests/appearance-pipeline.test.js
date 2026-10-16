/*
C-a, step three (H19.29; D3, the appearance pipeline's composition half, ruled 2026-09-22) -- AN ANCHOR IS DRAWN BY THE
APPEARANCES ITS PLUGINS BRING, COMPOSING OR COMPETING BY RULE.

The renderer drew an anchor with two branches of its own -- a device, and a waypoint -- and chose between them by asking
whether a device is composed. Each plugin brings appearances for the anchor now: the devices plugin its device, the network
its marks (the endpoint pad, junction rings, a waypoint's transit ring) and its transit ring over a device, the simulation its
spawning mark. An appearance declares, per derived state, whether it composes -- drawn alongside the others -- or competes, the
highest-ranked alone drawn; parts land in an ordered list of named layers, and the competitors in an ordered list of named
ranks (the ruling's caution against an integer priority). So a device emits no marks because the device outranks them, not
because the renderer branched -- and reversing the ranks draws the marks instead. The elements are what the renderer built:
the K8 DOM corpus and tests/appearance.test.js hold that.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Model } from './fixtures/composed.mjs';
import { Renderer } from '../app/src/renderer.js';
import { makeRenderer, classesIn } from './fixtures/client-harness.mjs';

const code = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const canvas = async () => (await import('../product/canvas.mjs')).PRODUCT_CANVAS;
const DEVICE = { id: 'node-0e3001', name: 'r', type: 'router', shape: 'circle', x: 0, y: 0, transit: false };
const WAYPOINT = { id: 'node-0e3002', name: 'w', x: 120, y: 120 };
const draw = (parts, fn) => {
	const { svg, restore } = makeRenderer();
	try {
		const m = new Model();
		new Renderer(m, svg, { parts });
		m.put('node', DEVICE); m.put('node', WAYPOINT);
		const el = (id) => svg.ownerDocument.getElementById(id);
		fn({ el, frame: (id) => el(id)?.querySelector('[data-layer="frame"]')?.getAttribute?.('data-layer') === 'frame', inLayer: (layer, id) => svg.querySelector(`#${layer}`).children.some((c) => c.getAttribute('id') === id), classes: (id) => (el(id) ? [...el(id).getAttribute('class').split(' '), ...classesIn(el(id))] : []) });
	} finally { restore(); }
};

test('C-a: a device draws its frame and glyph with the network\'s transit ring and no marks; a waypoint its marks -- the state under test', async () => {
	draw(await canvas(), ({ classes, inLayer, frame }) => {
		assert.ok(inLayer('nodes', DEVICE.id) && inLayer('waypoints', WAYPOINT.id));
		assert.ok(frame(DEVICE.id), 'a device draws its frame');
		assert.ok(classes(DEVICE.id).includes('wp-transit'), 'the transit ring composes over the device');
		assert.ok(!classes(DEVICE.id).includes('wp-anchor'), 'the network\'s marks are not emitted on a device');
		assert.ok(classes(WAYPOINT.id).includes('wp-anchor'), 'a waypoint draws its marks');
	});
});

test('C-a: each plugin brings its appearances, and the product composes them with the anchor\'s order', async () => {
	const parts = await canvas();
	const { DEVICES_CANVAS } = await import('../devices/device-appearance.mjs');
	const { NETWORK_CANVAS } = await import('../network/canvas.mjs');   // RESTATED at C-a step four: the network's whole part
	const { SIMULATION_CANVAS } = await import('../engine/spawn-appearance.mjs');
	assert.deepEqual(DEVICES_CANVAS.appearances.map((a) => a.id), ['device']);
	assert.deepEqual(NETWORK_CANVAS.appearances.map((a) => a.id), ['marks', 'transit']);
	assert.deepEqual(SIMULATION_CANVAS.appearances.map((a) => a.id), ['spawning']);
	for (const p of [DEVICES_CANVAS, NETWORK_CANVAS, SIMULATION_CANVAS]) assert.ok(parts.includes(p));
	const order = parts.find((p) => p.orders?.node).orders.node;
	assert.deepEqual(order.ranks, ['device', 'marks'], 'the device outranks the marks');
});

test('C-a: the rule decides, not a branch -- with the ranks reversed, a device is drawn by the network\'s marks', async () => {
	const parts = (await canvas()).map((p) => (p.orders?.node ? { ...p, orders: { node: { ...p.orders.node, ranks: ['marks', 'device'] } } } : p));
	draw(parts, ({ classes, inLayer, frame }) => {
		assert.ok(inLayer('waypoints', DEVICE.id), 'drawn among the waypoints');
		assert.ok(classes(DEVICE.id).includes('wp-anchor'));
		assert.ok(!frame(DEVICE.id), 'and not as a device');
	});
});

test('C-a: a composition without the network draws a device without its ring, and no waypoint', async () => {
	draw((await canvas()).filter((p) => p.owner !== 'network'), ({ el, classes }) => {
		assert.ok(el(DEVICE.id), 'the device is the devices plugin\'s');
		assert.ok(!classes(DEVICE.id).includes('wp-transit'), 'its transit ring is the network\'s');
		assert.equal(el(WAYPOINT.id), null, 'a waypoint\'s marks are the network\'s');
	});
});

test('C-a: the renderer draws no device and no waypoint of its own', () => {
	assert.doesNotMatch(code('app/src/renderer.js'), /nodeLook|NODE_PARTS|waypointLook|waypointLayers|waypointRolesIn|contentDom|layerCircle|showsSockets|typedNodes|bareAnchors\b|spanSig|contentSig/);
});

test('C-a: a malformed appearance or order is refused when the canvas is built, naming its owner', async () => {
	const parts = await canvas();
	const refused = (extra, re) => {
		const { svg, restore } = makeRenderer();
		try { assert.throws(() => new Renderer(new Model(), svg, { parts: [...parts, extra] }), re); } finally { restore(); }
	};
	refused({ owner: 'p', appearances: [{ id: 'x', kind: 'node', state: () => 'x', composes: false }] }, /Renderer: p's appearance x competes and names no root/);
	refused({ owner: 'p', appearances: [{ id: 'y', kind: 'node', state: () => 'y', composes: true, parts: { nowhere() {} } }] }, /Renderer: p's appearance y draws into layer nowhere, which the order for node does not list/);
	refused({ owner: 'p', appearances: [{ id: 'z', kind: 'zone', state: () => 'z', composes: true }] }, /Renderer: p's appearance z is for zone, for which no part orders appearances/);
	refused({ owner: 'p', appearances: [{ id: 'marks', kind: 'node', state: () => 'm', composes: true }] }, /Renderer: appearance marks is brought by network and by p/);
	refused({ owner: 'p', orders: { node: { layers: [], ranks: [] } } }, /Renderer: the order for node is declared by the product and by p/);
});

/*
RESTATED at H24.9 (B362). B331 (H21.8) drew the network's junction ring over a device that the graph makes a junction, building
the 2026-09-22 ruling's "the ring composes over the frame"; the director saw it across the middle of the glyph and ruled no mark
on a device (`dev/DECISIONS.md` H24.9). So a device is drawn by its glyph alone, a junction or not, as it is when one link ends
at it. The role is still the graph's: the junction a device is still reads as one. A waypoint junction keeps its ring, and a
device whose transit is off keeps its transit ring, which still composes over the device.
*/
test('H24.9 (B362): a device the graph makes a junction draws no junction mark -- three links ending at it, or one pinned through it -- in authoring, in run mode and in the export; a waypoint junction keeps its ring', async () => {
	const parts = await canvas();
	const { waypointRolesIn } = await import('../network/roles.mjs');
	const { svgDocument } = await import('../server/svg.mjs');
	const { pipeEntity } = await import('../network/pipe-kind.mjs');
	const { heldLayouts } = await import('./fixtures/composed.mjs');
	const node = (id, name, type, x, y, more = {}) => ({ id, name, ...(type ? { type, shape: 'circle' } : {}), x, y, ...more });
	const NODES = [
		node('node-0e3010', 'r', 'router', 0, 0), node('node-0e3011', 'a', 'host', -120, 0), node('node-0e3012', 'b', 'host', 120, 0),
		node('node-0e3013', 'f', 'firewall', 0, 240), node('node-0e3014', 'c', 'host', -120, 240), node('node-0e3015', 'd', 'host', 0, 360),
		node('node-0e3016', 'w', null, 240, 240), node('node-0e3017', 't', 'router', 240, 0, { transit: false }),
	];
	const LINKS = [
		{ id: 'link-0e3020', name: 'l1', src: 'node-0e3011', dst: 'node-0e3010' },
		{ id: 'link-0e3021', name: 'l2', src: 'node-0e3011', dst: 'node-0e3012', via: ['node-0e3010'] },   // pinned through r
		{ id: 'link-0e3022', name: 'l3', src: 'node-0e3014', dst: 'node-0e3013' },   // three end at f
		{ id: 'link-0e3023', name: 'l4', src: 'node-0e3015', dst: 'node-0e3013' },
		{ id: 'link-0e3024', name: 'l5', src: 'node-0e3013', dst: 'node-0e3016' },
		{ id: 'link-0e3025', name: 'l6', src: 'node-0e3015', dst: 'node-0e3016' },   // three end at w
		{ id: 'link-0e3026', name: 'l7', src: 'node-0e3012', dst: 'node-0e3016' },
		{ id: 'link-0e3027', name: 'l8', src: 'node-0e3012', dst: 'node-0e3017' },   // one ends at t, whose transit is off
	];
	const { svg, restore } = makeRenderer();
	try {
		const m = new Model();
		const r = new Renderer(m, svg, { parts });
		for (const n of NODES) m.put('node', n);
		for (const l of LINKS) m.put('link', l);
		const drawn = (id) => classesIn(svg.ownerDocument.getElementById(id));
		// the state under test: the graph makes both devices junctions, and the waypoint too
		for (const id of ['node-0e3010', 'node-0e3013', 'node-0e3016']) assert.ok(waypointRolesIn(m, id).includes('junction'), `precondition: the graph makes ${id} a junction`);
		for (const mode of ['edit', 'run']) {
			r.setMode(mode);
			assert.equal(drawn('node-0e3010').includes('wp-junction'), false, `${mode}: a router a link is pinned through draws no junction mark`);
			assert.equal(drawn('node-0e3013').includes('wp-junction'), false, `${mode}: a firewall three links end at draws no junction mark`);
			assert.equal(drawn('node-0e3016').includes('wp-junction'), true, `${mode}: control -- a waypoint three links end at keeps its junction ring`);
			assert.equal(drawn('node-0e3017').includes('wp-transit'), true, `${mode}: control -- a device whose transit is off keeps its transit ring, composed over it`);
		}
		assert.equal(drawn('node-0e3010').includes('wp-anchor'), false, 'and a device draws no waypoint anchor ring');
	} finally { restore(); }
	// and the export, which draws what view mode draws (H24.8)
	const exported = svgDocument({
		meta: { id: '0000000000000e30', name: 'h24-9', version: 0, schema: 3 }, layouts: heldLayouts(), nodes: NODES, links: LINKS,
		pipes: LINKS.flatMap((l) => { const s = [l.src, ...(l.via ?? []), l.dst]; return s.slice(1).map((b, i) => pipeEntity(s[i], b, 'link')); }),
		zones: [], groups: [], selection: [],
	});
	// the export writes a waypoint's circles without their classes (server/svg.mjs `serializeNode`), so a ring is known by its radius
	const { waypointJunction } = await import('../network/appearance.mjs');
	const ring = new RegExp(`<circle[^>]*\\br="${waypointJunction().radius}"`);
	const group = (id) => { const at = exported.indexOf(`<g id="${id}"`); return exported.slice(at, exported.indexOf('</g>', at + 1)); };
	assert.match(group('node-0e3016'), ring, 'control: the export draws the waypoint junction\'s ring');
	for (const id of ['node-0e3010', 'node-0e3013']) assert.doesNotMatch(group(id), ring, `the export draws no junction mark on ${id}`);
});

