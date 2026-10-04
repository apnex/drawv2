// P4 R-c (H18.21; ruled H2, refined 2026-10-04) -- run mode and the SVG download are ONE rendering, decided in one place in code
// (kernel/network-appearance.mjs RUN_PICTURE): the canvas in run mode and the export draw the same picture, and the export
// draws each link along its route, a down link with the canvas's down look (H1). CONSUMERS-ROUTE.md, stage R-c.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Model } from './fixtures/composed.mjs';
import { Renderer } from '../app/src/renderer.js';
import { makeRenderer } from './fixtures/client-harness.mjs';
import { fakeLayer } from './fixtures/fake-svg.mjs';
import { svgDocument } from '../server/svg.mjs';
import { readModel } from '../network/read-model.mjs';
import { attachNetwork } from '../network/host.mjs';
import { pipeEntity } from '../network/pipe-kind.mjs';
import { RUN_PICTURE, waypointLayers, downStroke } from '../kernel/network-appearance.mjs';
import { TOKENS } from '../kernel/theme.mjs';

/*
One board with every waypoint shape: an endpoint (e), a bend (b), a junction (j, three links end there), and a waypoint whose
transit is off (t). Links have their pipes, so each is up and drawn along its stops.
*/
const doc = () => ({
	meta: { id: 'diagram-000001', name: 'd', version: 0, schema: 2 },
	nodes: [
		{ id: 'node-0000a1', name: 'a', type: 'host', shape: 'square', x: -360, y: 0 },
		{ id: 'node-0000a2', name: 'c', type: 'host', shape: 'square', x: 360, y: 0 },
		{ id: 'node-0000a3', name: 'd', type: 'host', shape: 'square', x: 0, y: 240 },
		{ id: 'node-0000e1', name: 'e', x: -360, y: -240 },
		{ id: 'node-0000b1', name: 'b', x: -120, y: -120 },
		{ id: 'node-0000c1', name: 'j', x: 0, y: 0 },
		{ id: 'node-0000d1', name: 't', x: 360, y: -240, transit: false },
	],
	links: [
		{ id: 'link-000001', name: 'l1', src: 'node-0000e1', dst: 'node-0000c1', via: ['node-0000b1'] },
		{ id: 'link-000002', name: 'l2', src: 'node-0000a2', dst: 'node-0000c1' },
		{ id: 'link-000003', name: 'l3', src: 'node-0000a3', dst: 'node-0000c1' },
		{ id: 'link-000004', name: 'l4', src: 'node-0000a1', dst: 'node-0000d1' },
	],
	pipes: [['node-0000b1', 'node-0000e1'], ['node-0000b1', 'node-0000c1'], ['node-0000a2', 'node-0000c1'], ['node-0000a3', 'node-0000c1'], ['node-0000a1', 'node-0000d1']]
		.map(([x, y]) => pipeEntity(x, y, 'link')),
	zones: [], groups: [], selection: [],
});

// the radii of the circles each waypoint draws, in drawing order -- from the canvas's DOM
const canvasWaypoints = (mode) => {
	const { svg, restore } = makeRenderer();
	try {
		// a Model that draws with the network, as the lab's does and the product page's will at P5 (G1) -- the transit ring is the
		// network's answer (`declaresNoTransit`), so a Model without one draws none
		const m = readModel(doc());
		const r = new Renderer(m, svg);
		r.renderAll?.();
		for (const e of m.all('node')) if (!e.type) r.render('node', e);
		r.setMode(mode);
		const layer = svg.byId['#waypoints'];
		return Object.fromEntries(layer.children.filter((g) => /\bwaypoint\b/.test(g.attrs.class || ''))
			.map((g) => [g.attrs.id, g.children.filter((c) => c.tagName === 'CIRCLE').map((c) => Number(c.attrs.r))]));
	} finally { restore(); }
};
// and from the export's SVG
const exportWaypoints = () => Object.fromEntries([...svgDocument(doc()).matchAll(/<g id="(node-[0-9a-f]{6})"><g class="waypoint[^"]*">(.*?)<\/g><\/g>/g)]
	.map(([, id, body]) => [id, [...body.matchAll(/<circle[^>]*?r="([\d.]+)"/g)].map((m) => Number(m[1]))]));

test('R-c: the canvas in run mode and the download draw every waypoint alike -- one rendering', () => {
	const run = canvasWaypoints('run'), exported = exportWaypoints();
	assert.deepEqual(Object.keys(exported).sort(), ['node-0000b1', 'node-0000c1', 'node-0000d1', 'node-0000e1']);
	assert.deepEqual(run, exported, 'each waypoint draws the same circles in run mode and in the download');
	assert.deepEqual(exported['node-0000b1'], [], 'a bend draws nothing');
	assert.ok(exported['node-0000e1'].length > 0 && exported['node-0000c1'].length > 0 && exported['node-0000d1'].length > 0, 'an endpoint, a junction and the transit ring are drawn');
});

test('R-c: authoring draws the whole waypoint -- the run picture leaves out the anchor ring and a bend\'s dot, and nothing else', () => {
	const view = canvasWaypoints('view'), run = canvasWaypoints('run');
	const anchor = waypointLayers([], 20)[0].radius;
	for (const id of Object.keys(view)) {
		assert.ok(view[id].includes(anchor), `${id} draws its anchor ring while authoring`);
		assert.ok(!run[id].includes(anchor), `${id} draws none in run mode`);
	}
	assert.equal(view['node-0000b1'].length, 2, 'a bend while authoring: its anchor and its dot');
	for (const id of ['node-0000e1', 'node-0000c1', 'node-0000d1']) assert.equal(run[id].length, view[id].length - 1, `${id} loses only its anchor ring`);
});

test('R-c: what is left out is decided in one place -- no stylesheet hides authoring geometry in run mode', () => {
	assert.equal(RUN_PICTURE.pipes, false);
	for (const f of ['app/style.css', 'network/network.css']) {
		const css = fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
		assert.doesNotMatch(css, /\.run-mode\s+[^{]*\.(wp-anchor|wp-dot|pipe|pipe-hit)\b/, `${f} hides a layer in run mode, a second place deciding the picture`);
	}
});

test('R-c: run mode draws no pipe, and leaving it draws them again', () => {
	const m = new Model();
	m.put('node', { id: 'node-00000a', name: 'A', type: 'router', x: -240, y: 0, shape: 'circle' });
	m.put('node', { id: 'node-00000c', name: 'w', x: 0, y: -120 });
	m.put('pipe', pipeEntity('node-00000a', 'node-00000c', 'hand'));
	const f = fakeLayer(), watchers = [];
	const renderer = { mode: 'view', update: () => {}, reflectSelection: () => {}, render: () => {}, watchMode: (fn) => watchers.push(fn) };
	attachNetwork({
		session: { network: { view: { of: () => ({ route: () => null }) } }, takeNotice: () => null, onTransitChange: () => {} },
		model: m, renderer, selection: { subscribe: () => {}, list: () => [] }, history: { commit: () => {} },
		pipeLayer: f.root, el: f.el, say: () => {},
	});
	const lines = () => f.all().filter((n) => n.tag === 'line' && n.parent).length;
	for (const fn of watchers) fn('view');
	assert.equal(lines() > 0, true, 'authoring draws the hand pipe');
	renderer.mode = 'run'; for (const fn of watchers) fn('run');
	assert.equal(lines(), 0, 'run mode draws none -- so none can be clicked');
	renderer.mode = 'view'; for (const fn of watchers) fn('view');
	assert.equal(lines() > 0, true, 'and leaving run mode draws it again');
});

// ---- the download's links (H1) ----

test('R-c: the download draws each link along its route over pipes, and a down link down', () => {
	const d = doc();
	// a plain link from a to c whose only way is up through f, a waypoint its stops never name
	d.nodes.push({ id: 'node-0000f1', name: 'f', x: 0, y: -240 });
	d.links.push({ id: 'link-000005', name: 'l5', src: 'node-0000a1', dst: 'node-0000a2' });   // a plain link: no pipe joins a and c
	d.pipes.push(pipeEntity('node-0000a1', 'node-0000f1', 'hand'), pipeEntity('node-0000a2', 'node-0000f1', 'hand'));
	const svg = svgDocument(d);
	const pathOf = (id) => svg.match(new RegExp(`<g id="${id}"><path d="([^"]*)"([^>]*)/>`))?.slice(1);
	const [routed, attrs] = pathOf('link-000005');
	assert.match(routed, /^M-360 0 L.* Q0 -240 .* L360 0$/, 'l5 is drawn up through f, its route, turning at f -- not straight from a to c');
	assert.doesNotMatch(attrs, /stroke-dasharray/, 'an up link is solid');
	assert.match(attrs, new RegExp(`stroke="${TOKENS.link}"`));
	// take f's pipes away: l5 has no way, so it is down -- drawn straight through its stops, dotted and orange
	d.pipes = d.pipes.filter((p) => !p.id.includes('0000f1'));
	const [down, downAttrs] = svgDocument(d).match(/<g id="link-000005"><path d="([^"]*)"([^>]*)\/>/).slice(1);
	assert.equal(down, 'M-360 0 L360 0', 'drawn along its intent, straight');
	assert.match(downAttrs, /stroke-dasharray="0 /, 'dotted');
	assert.match(downAttrs, new RegExp(`stroke="${downStroke()}"`), 'and in the down colour, which the file carries itself');
});

test('R-c: a ring is drawn closed once -- its route\'s return to its start is the drawing closing itself', async () => {
	const { render } = await import('../server/svg.mjs');
	const { docToSchema } = await import('../kernel/adapt.mjs');
	const ring = {
		meta: { id: 'diagram-000001', name: 'd' },
		nodes: [{ id: 'node-0000b1', name: 'p', x: -120, y: 0 }, { id: 'node-0000b2', name: 'q', x: 120, y: 0 }, { id: 'node-0000b3', name: 'r', x: 0, y: -180 }],
		links: [{ id: 'link-000001', name: 'l', src: 'node-0000b1', dst: 'node-0000b3', via: ['node-0000b2'], closed: true }],
		pipes: [['node-0000b1', 'node-0000b2'], ['node-0000b2', 'node-0000b3'], ['node-0000b1', 'node-0000b3']].map(([x, y]) => pipeEntity(x, y, 'link')),
	};
	const d = (svg) => svg.match(/<g id="link-000001"><path d="([^"]*)"/)[1];
	// its route runs along its stops, so it is drawn exactly as its stops draw it
	assert.equal(d(svgDocument(ring)), d(render(docToSchema(ring))));
});
