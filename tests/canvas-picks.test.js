/*
C-b (H19.30; dev/design/unification/CANVAS-PLUGINS.md, D1) -- WHAT THE POINTER LANDED ON IS ANSWERED BY THE PLUGIN THAT DREW IT.

The picker named every kind -- a device's group, a waypoint's, a zone's (under Shift only), a link and its click twin -- in
product code (app/src/pick.js `hitOf`). A painter or an appearance declares how its element is picked now, the word the hit is
called by and a modifier it is picked under -- the zone, a backdrop, only with Shift held, passing a plain press through to the
canvas (DESIGN U1). The canvas keeps what spans kinds: handles (C-d's), a plugin's mark, the canvas. The hits are what they were:
the gesture corpus holds that.

RESTATED at H26.8's picks move (dev/design/components/NATIVE-SHAPES.md sections 3.2 and 4.7, NS6, GR4; appendix A). A pick is by ITEM:
what the pointer landed on is the item the scene made the target for (`scene.itemOf`), and its drawer -- the painter or winning
appearance the renderer names (`drawerOf`) -- answers by its one pick, `{ word, modifier?, button?, idle?, clones?, mark?, parts?, on? }`;
a mark names no word, and only the shape carrying its attribute answers -- a hand pipe's hit line. A selector or a class is refused.
Which drawer answers where two overlap is which item the platform's hit test finds: the layers' order puts the zones beneath every
other drawn layer, so a device over a zone is the device's element and answers the device, Shift held or not -- where the selector
picker tried the backdrop after every other pick. Each press lands on an element the real renderer drew (`targetOf`), never a stub.
And run mode's regions, read the same way (`regionWith`), each pinned whole for an element of each kind.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { picksOf, hitWith, regionWith } from '../app/src/pick.js';
import { PRODUCT_CANVAS, CANVAS_LAYERS } from '../product/canvas.mjs';
import { makeInput, targetOf, GROUND } from './fixtures/client-harness.mjs';
import { makeNode, makeWaypoint } from '../plugins/devices/make-node.mjs';
import { pipeEntity } from '../plugins/network/pipe-kind.mjs';

const code = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/*
A board drawn by the real renderer: a device over a zone, a second device, a panel with an action region and an input region, a waypoint,
a directed link from the device through the waypoint (its line, head and click twin), a hand pipe and a link pipe -- the zone selected,
so its corner handles are drawn, editing items of the overlay.
*/
function board(fn) {
	const h = makeInput();
	try {
		const put = (kind, e) => { h.model.put(kind, e); return e; };
		const zone = put('zone', { id: 'zone-0b0001', name: 'z', x: -150, y: -150, w: 300, h: 300 });
		const device = put('node', makeNode(h.model, 'host', { x: 0, y: 0 }));
		const other = put('node', makeNode(h.model, 'host', { x: 360, y: 0 }));
		const panel = put('node', { ...makeNode(h.model, 'host', { x: -360, y: 360 }), shape: 'square', span: { cols: 2, rows: 1 },
			content: [{ at: [0, 0], cols: 1, rows: 1, content: 'glyph', glyph: 'router', action: 'help' }, { at: [1, 0], cols: 1, rows: 1, content: 'text', value: 'x', input: true }] });
		const waypoint = put('node', makeWaypoint(h.model, { x: 180, y: 120 }));
		const link = put('link', { id: 'link-0b0001', name: 'l', src: device.id, dst: other.id, via: [waypoint.id], direction: 'forward', order: 1 });
		const hand = put('pipe', pipeEntity(device.id, waypoint.id, 'hand')), laid = put('pipe', pipeEntity(waypoint.id, other.id, 'link'));
		h.selection.set([zone.id]);
		const ids = { zone: zone.id, device: device.id, panel: panel.id, waypoint: waypoint.id, link: link.id, hand: hand.id, laid: laid.id };
		const at = (on) => targetOf(h, on);
		const opts = { scene: h.scene, drawerOf: (id) => h.renderer.drawerOf(id) };
		return fn({ h, ids, at, hit: hitWith(picksOf(PRODUCT_CANVAS), opts), region: regionWith(opts), opts });
	} finally { h.restore(); }
}

test('C-b: the product\'s picks answer a device, a waypoint, a zone under Shift, a link and its twin, a handle and a hand pipe\'s mark -- the state under test', () => board(({ ids, at, hit }) => {
	assert.deepEqual(hit({ target: at(ids.device) }), { kind: 'node', id: ids.device });
	assert.deepEqual(hit({ target: at({ key: ids.device, where: { class: 'label' } }) }), { kind: 'node', id: ids.device }, 'any shape of its item: its label');
	assert.deepEqual(hit({ target: at({ key: ids.waypoint, path: [0, 0] }) }), { kind: 'waypoint', id: ids.waypoint });
	assert.deepEqual(hit({ target: at({ key: ids.zone, where: { class: 'zone-rect' } }), shiftKey: true }), { kind: 'zone', id: ids.zone });
	assert.deepEqual(hit({ target: at({ key: ids.zone, where: { class: 'zone-rect' } }) }), { kind: 'canvas', id: null }, 'a zone passes a plain press through (U1)');
	assert.deepEqual(hit({ target: at(ids.link) }), { kind: 'link', id: ids.link });
	assert.deepEqual(hit({ target: at(`${ids.link}/hit`) }), { kind: 'link', id: ids.link }, 'the click twin takes the click (B268)');
	assert.deepEqual(hit({ target: at(`${ids.link}/head`) }), { kind: 'canvas', id: null }, 'its head is no part its pick names');
	assert.deepEqual(hit({ target: at({ key: 'handles', where: { 'data-corner': 'se' } }) }), { kind: 'handle', id: 'se', handle: true }, 'a handle, flagged (B316)');
	assert.deepEqual(hit({ target: at({ key: ids.hand, where: { 'data-select': true } }) }), { kind: 'pipe', id: ids.hand, mark: true }, 'a hand pipe\'s hit line: its mark');
	assert.deepEqual(hit({ target: at({ key: ids.hand, path: [0, 0] }) }), { kind: 'canvas', id: null }, 'its line carries no `data-select`: open ground to a press');
	assert.deepEqual(hit({ target: at({ key: ids.laid, path: [0, 0] }) }), { kind: 'canvas', id: null }, 'nor does a link pipe, which is never offered');
	assert.deepEqual(hit({ target: at(ids.hand) }), { kind: 'canvas', id: null }, 'nor its group');
	assert.deepEqual(hit({ target: GROUND }), { kind: 'canvas', id: null }, 'what the scene did not make: the canvas');
}));

test('C-b: without the zones plugin a zone is never picked -- the rule is the plugin\'s', () => board(({ ids, at, opts }) => {
	const without = hitWith(picksOf(PRODUCT_CANVAS.filter((p) => p.owner !== 'zones')), opts);
	assert.deepEqual(without({ target: at({ key: ids.zone, where: { class: 'zone-rect' } }), shiftKey: true }), { kind: 'canvas', id: null });
}));

test('C-b: the picker names no plugin\'s kind -- each drawer declares how its element is picked, one pick each', () => {
	assert.doesNotMatch(code('app/src/pick.js'), /g\.node|g\.waypoint|g\.zone|'link(-hit)?'|'node'|'waypoint'|'zone'|'pipe'|data-select|closest\(/);
	const owners = picksOf(PRODUCT_CANVAS).map((p) => `${p.owner}:${p.word ?? (p.mark ? `mark on ${p.on}` : '?')}`);
	// RESTATED at C-d step two: and each handle declaration, by its word; at H26.8's picks move one pick per drawer, and the hand pipe's mark
	assert.deepEqual(owners.sort(), ['devices:node', 'network:lhandle', 'network:link', 'network:mark on data-select', 'network:waypoint', 'zones:handle', 'zones:zone']);
});

test('GR4: a malformed pick is refused when the picks are composed, naming its owner -- a selector, a class, two for a drawer, a word on a mark', () => {
	const part = (picks) => [{ owner: 'p', painters: [{ kind: 'x', layer: 'zones', shapes: () => null, picks }] }];
	assert.throws(() => picksOf(part([{ closest: 'g.x', word: 'x' }])), /pick: p's pick for x names closest -- a pick answers by item/);
	assert.throws(() => picksOf(part([{ self: 'x', word: 'x' }])), /pick: p's pick for x names self -- a pick answers by item/);
	assert.throws(() => picksOf(part([{ word: 'x' }, { word: 'x', parts: ['hit'] }])), /pick: p's x declares 2 picks -- one per drawer/);
	assert.throws(() => picksOf(part([{ mark: true, on: 'data-select', word: 'x' }])), /pick: p's mark for x names a word/);
	assert.throws(() => picksOf(part([{ mark: true }])), /pick: p's mark for x names no attribute its shape carries/);
	assert.throws(() => picksOf(part([{ modifier: 'shiftKey' }])), /pick: p's pick for x names no word/);
});

/*
PRECEDENCE (3.2; a:F11), restated from the backdrop test at H26.8's picks move: an element is one item, so which drawer answers is which
item the platform's hit test finds -- the layers' order, the zones beneath every other drawn layer. A device standing in a zone is its
own element, and answers the device, Shift held or not; the zone answers only on its own element, and only with Shift. The drafting
comparison (off the repository) asked the page's hit test at a grid of points over every record document.
*/
test('precedence: the zones lie beneath every other drawn layer, and a device over a zone answers the device, Shift held or not', () => board(({ ids, at, hit }) => {
	const drawnLayers = CANVAS_LAYERS.filter((l) => !l.startsWith('grid-') && l !== 'snaplayer' && l !== 'overlay');
	assert.equal(drawnLayers[0], 'zones', 'the zones first, beneath every layer the parts draw into');
	for (const shiftKey of [false, true]) assert.deepEqual(hit({ target: at(ids.device), shiftKey }), { kind: 'node', id: ids.device }, `Shift ${shiftKey ? 'held' : 'not held'}: the device`);
	assert.deepEqual(hit({ target: at(ids.zone), shiftKey: true }), { kind: 'zone', id: ids.zone }, 'the zone on its own element');
}));

/*
RUN MODE'S REGIONS, pinned whole (appendix A, the picks move): what `regionWith` answers for an element of each kind -- a device's frame
and label, a panel's action and input regions, a link's line, twin and head, a waypoint, a pipe's hit line, open ground and an editing
item -- each the seven fields the selector reading answered (app/src/capture.js `regionOf` until the move), as the drafting comparison
found over every record document.
*/
test('run mode\'s regions, read by item: every field, for an element of each kind', () => board(({ h, ids, at, region }) => {
	h.renderer.setMode('run');
	const none = { target: null, overTarget: false, action: null, input: null, owner: null, control: false, entity: false };
	const on = (o) => region(at(o));
	assert.deepEqual(on({ key: ids.device, where: { 'data-layer': 'frame' } }), { ...none, entity: true }, 'a device\'s frame');
	assert.deepEqual(on({ key: ids.device, where: { class: 'label' } }), { ...none, entity: true }, 'its label');
	assert.deepEqual(on({ key: ids.panel, where: { 'data-action': 'help' } }), { ...none, action: 'help', owner: ids.panel, control: true, entity: true }, 'a panel\'s action region');
	assert.deepEqual(on({ key: ids.panel, where: { 'data-input': true } }), { ...none, input: 1, owner: ids.panel, control: true, entity: true }, 'its input region, by its index');
	assert.deepEqual(on(ids.link), { ...none, entity: true }, 'a link\'s line');
	assert.deepEqual(on(`${ids.link}/hit`), none, 'its click twin');
	assert.deepEqual(on(`${ids.link}/head`), none, 'its head');
	assert.deepEqual(on({ key: ids.waypoint, path: [0, 0] }), { ...none, target: ids.waypoint, overTarget: true }, 'a waypoint: what a run press aims at');
	assert.deepEqual(region(GROUND), none, 'open ground');
	assert.equal(region(null), null, 'no target to ask');
	h.renderer.setMode('view');
	assert.deepEqual(on({ key: ids.hand, where: { 'data-select': true } }), none, 'a hand pipe\'s hit line (run mode draws no pipe)');
	assert.deepEqual(on({ key: 'handles', where: { 'data-corner': 'se' } }), none, 'an editing item');
}));
