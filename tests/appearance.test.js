/*
H15.9 -- UPDATE EQUALS RENDER, for every kind and every kind of change (B230).

A renderer has two branches, create (`render`) and update (`update`), and every appearance defect of its kind -- B218,
B228 -- was a fact wired into one and not the other. The appearance pipeline makes that structural; this holds it.

TWO SEPARATE DOMs, and that is the whole design. B230 records four attempts that came out vacuous because the reference
render ran in the same document and repaired the element before the comparison read it. Here world A renders the entity
as it was and then takes the change as an UPDATE, as a live tab does; world B renders the changed entity FRESH. Each is
serialized in its own document, and the two must be identical, element by element.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from '../model/model.mjs';
import { attachRelations } from '../engine/store.mjs';
import { cellOf } from '../kernel/geometry.mjs';
import { Renderer } from '../app/src/renderer.js';
import { makeRenderer } from './fixtures/client-harness.mjs';

// a subtree as plain data: tag, attributes, text and children, in order
const ser = (n) => ({ tag: n.tagName, attrs: Object.fromEntries(Object.entries(n.attrs || {}).sort()), text: n.textContent ?? null, kids: (n.children || []).map(ser) });
// every layer, each element keyed by its id (or its place, for an id-less twin), so a re-render's new position is not a difference
const snapshot = (svg) => Object.fromEntries(['zones', 'groups', 'links', 'waypoints', 'nodes'].map((l) =>
	[l, Object.fromEntries(svg.byId[`#${l}`].children.map((c, i) => [c.attrs.id || `${c.attrs.class}#${c.attrs['data-link'] ?? i}`, ser(c)]))]));

function world(board, change) {
	const { svg, restore } = makeRenderer();
	try {
		const m = new Model(); attachRelations(m, { cellOf });
		new Renderer(m, svg);
		for (const [kind, e] of board) m.put(kind, structuredClone(e));
		if (change) for (const [kind, id, patch] of change) m.set(kind, id, patch);
		return snapshot(svg);
	} finally { restore(); }
}
// A: the board, then the change as updates. B: the board with the change already in it, rendered fresh.
function equivalent(board, change) {
	const after = board.map(([kind, e]) => [kind, { ...e, ...Object.assign({}, ...change.filter(([k, id]) => k === kind && id === e.id).map(([, , p]) => p)) }]);
	assert.deepEqual(world(board, change), world(after, null));
}

const N = (o = {}) => ['node', { id: 'node-a00001', name: 'router-1', type: 'router', shape: 'circle', x: 0, y: 0, ...o }];
const N2 = ['node', { id: 'node-a00002', name: 'host-2', type: 'host', shape: 'circle', x: 360, y: 0 }];
const W = (o = {}) => ['waypoint', { id: 'waypoint-a00003', name: 'w', x: -240, y: 120, ...o }];
const L = ['link', { id: 'link-a00004', name: 'l', src: 'waypoint-a00003', dst: 'node-a00001' }];
const Z = (o = {}) => ['zone', { id: 'zone-a00005', name: 'dmz', x: -330, y: -210, w: 600, h: 420, ...o }];
const G = ['group', { id: 'group-a00006', name: 'g', members: ['node-a00001', 'node-a00002'] }];
const PANEL = N({ content: [{ content: 'text', at: [0, 0], cols: 2, rows: 1, value: 'hello' }], span: { cols: 2, rows: 1 } });

const CASES = {
	'node moved': [[N()], [['node', 'node-a00001', { x: 120, y: 60 }]]],
	'node renamed': [[N()], [['node', 'node-a00001', { name: 'a-much-longer-name' }]]],
	'node retyped': [[N()], [['node', 'node-a00001', { type: 'firewall' }]]],
	'node reshaped': [[N()], [['node', 'node-a00001', { shape: 'square' }]]],
	'panel reshaped': [[PANEL], [['node', 'node-a00001', { shape: 'square' }]]],
	'panel moved': [[PANEL], [['node', 'node-a00001', { x: 120 }]]],
	'node grown to a span': [[N()], [['node', 'node-a00001', { span: { cols: 2, rows: 2 } }]]],
	'zone moved': [[Z()], [['zone', 'zone-a00005', { x: -270, y: -150 }]]],
	'zone resized': [[Z()], [['zone', 'zone-a00005', { w: 720, h: 300 }]]],
	'zone renamed': [[Z()], [['zone', 'zone-a00005', { name: 'core-network' }]]],
	'group member moved': [[N(), N2, G], [['node', 'node-a00002', { x: 480, y: 120 }]]],
	'waypoint moved': [[N(), W(), L], [['waypoint', 'waypoint-a00003', { x: -360, y: 0 }]]],
	'waypoint armed': [[N(), W(), L], [['waypoint', 'waypoint-a00003', { spawn: { interval: 1000, speed: 2, kind: 'packet', since: 1700000000000 } }]]],
	'lone waypoint moved': [[W()], [['waypoint', 'waypoint-a00003', { x: 0, y: 240 }]]],
	'link declared': [[N(), W(), L], [['link', 'link-a00004', { direction: 'forward' }]]],
};

for (const [name, [board, change]] of Object.entries(CASES)) {
	test(`H15.9: update equals render -- ${name}`, () => equivalent(board, change));
}

/*
WHAT THE LOOK SAYS, held directly. The two-document comparison sees a fact wired into one branch; a fact both branches
lose alike -- a label that stops showing its name everywhere -- it cannot see, and nothing else in the suite did (a
mutant dropping every label's text survived it). So the names are read off the drawing itself.
*/
test('H15.9: a node and a zone draw their names, and a rename redraws them', () => {
	const labelOf = (snap, layer, id) => {
		const find = (n) => (n.attrs.class || '').split(' ').includes('label') ? n.text : n.kids.map(find).find((t) => t != null) ?? null;
		return find(snap[layer][id]);
	};
	const before = world([N(), Z()], null);
	assert.equal(labelOf(before, 'nodes', 'node-a00001'), 'router-1');
	assert.equal(labelOf(before, 'zones', 'zone-a00005'), 'dmz');
	const after = world([N(), Z()], [['node', 'node-a00001', { name: 'edge' }], ['zone', 'zone-a00005', { name: 'core' }]]);
	assert.equal(labelOf(after, 'nodes', 'node-a00001'), 'edge');
	assert.equal(labelOf(after, 'zones', 'zone-a00005'), 'core');
});
