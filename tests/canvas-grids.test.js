/*
C-e, step thirteen (H19.33; dev/design/unification/CANVAS-PLUGINS.md section 3: "a plugin may bring a grid layer and when it
shows") -- THE GRIDS ARE DECLARED BY WHAT PLACES ON THEM.

A part declares its grid -- the page layer its dots go into, the points, the dot's radius, and, for a grid that is not always
shown, the modifier that shows it and the class that does: the product's anchor grid always shown, the zones plugin's
half-offset grid while Shift is held and no move or clone is under way. The canvas draws each part's dots and shows each grid by
its declaration; `zonePoints`, `nodePoints`, the zone grid's dot and `Input#syncZoneGrid` (which had no caller) left the canvas.
Nothing a user sees changes: the K8 DOM corpus records both grids' dots.
*/
import { Model } from './fixtures/composed.mjs';   // WD-b2: a grid reads the diagram's layout record
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeInput, key, pointer, seedNodes } from './fixtures/client-harness.mjs';
import { PRODUCT_CANVAS } from '../product/canvas.mjs';
import { gridDot } from '../kernel/geometry.mjs';
import { PARTS } from '../tools/layers.mjs';

const code = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const shift = (h, down) => (down ? h.capture.onKeyDown(key('Shift', { shiftKey: true })) : h.capture.onKeyUp(key('Shift')));
// RESTATED at H26.8's picks move: the element the harness's renderer drew (`h.at`), picked by item, where a stand-in answered selectors
const onDevice = (h, id, x, y, mod = {}) => pointer(x, y, { target: h.at(id), ...mod });

test('C-e: Shift shows the zone grid and letting go hides it; during a move Shift does not show it -- the state under test', () => {
	const h = makeInput();
	try {
		shift(h, true);
		assert.equal(h.svg.classList.contains('zonegrid'), true, 'Shift is the zone-layer key (DESIGN U1)');
		shift(h, false);
		assert.equal(h.svg.classList.contains('zonegrid'), false);
		const [d] = seedNodes(h.model, [[0, 0]]);
		h.capture.onDown(onDevice(h, d.id, 0, 0, { button: 2, buttons: 2 }));
		h.capture.onMove(onDevice(h, d.id, 120, 0, { button: 2, buttons: 2 }));
		// RESTATED at H28.5 (B7): the move's frames are drawn from its preview, the live Model left as stored
		assert.deepEqual([h.at(d.id).getAttribute('transform'), h.model.get('node', d.id).x], ['translate(120,0)', 0], 'a move under way -- drawn moved');
		shift(h, true);
		assert.equal(h.svg.classList.contains('zonegrid'), false, 'Shift locks the axis mid-move; it raises no grid');
		h.capture.onMove(onDevice(h, d.id, 180, 0, { button: 2, buttons: 2, shiftKey: true }));
		assert.equal(h.svg.classList.contains('zonegrid'), false, 'nor does the pointer moving on with Shift held');
		h.input.cancelDrag();
	} finally { h.restore(); }
});

test('C-e: without the zones plugin Shift shows no grid', () => {
	const h = makeInput({ parts: PRODUCT_CANVAS.filter((p) => p.owner !== 'zones') });
	try {
		shift(h, true);
		assert.equal(h.svg.classList.contains('zonegrid'), false);
	} finally { h.restore(); }
});

// RESTATED at WD-b2 (H19.46): both grids are the layouts plugin's, drawn from the diagram's layout records (tests/layouts-canvas.test.js).
// RESTATED at H26.6's move 8 (PAN-ZOOM.md section 3.7, PZ24): each answers its lattice, unbounded, drawn from the view -- the node lattice
// through the origin, the half-offset one half a square from it -- and a tier's, `every` times its pitch through the same origin
test('C-e: the layouts plugin declares the anchor grid, always shown, and the half-offset grid, shown with Shift', () => {
	const grids = PRODUCT_CANVAS.flatMap((p) => (p.grids ?? []).map((g) => ({ ...g, owner: p.owner })));
	const m = new Model();
	assert.deepEqual(grids.map((g) => [g.owner, g.layer, g.lattice(m).declaration, g.r, g.shownWith ?? null, g.cls ?? null]),
		[['layouts', 'grid-nodes', { shape: 'square', pitch: 60, origin: { x: 0, y: 0 } }, gridDot().radius, null, null],
			['layouts', 'grid-zones', { shape: 'square', pitch: 60, origin: { x: 30, y: 30 } }, 5, 'shiftKey', 'zonegrid']]);
	assert.deepEqual(grids.map((g) => g.lattice(m, 10).declaration), [{ shape: 'square', pitch: 600, origin: { x: 0, y: 0 } }, { shape: 'square', pitch: 600, origin: { x: 30, y: 30 } }],
		'a tier\'s lattice, ten squares a step, through each grid\'s own origin');
	assert.equal(grids[0].lattice(m, 4), grids[0].lattice(m, 4), 'opened once for its pitch and origin');
});

test('C-e: the canvas draws and shows no grid of its own', () => {
	assert.doesNotMatch(code('app/src/compose-canvas.js'), /grid-zones|grid-nodes|zonePoints|nodePoints|ZONE_GRID_DOT/);
	assert.doesNotMatch(code('app/src/overlay.js'), /zonegrid|zoneGrid/);
	assert.doesNotMatch(code('app/src/input.js'), /zoneGrid|syncZoneGrid/);
	assert.doesNotMatch(code('app/src/snap.js'), /ZONE_EXT|zonePoints|nodePoints/);
	// RESTATED at H26.8's grid move (NATIVE-SHAPES.md section 3.2): the composition hands the grids part the grids the places snap to.
	// RESTATED at H26.6's move 8: and the view part's values for its level, and its once-a-frame redraw
	assert.match(code('app/src/compose-canvas.js'), /new Grids\(\{ scene, grids: gridsOf\(parts\), model, look: \(\) => view\.gridLook\(\), schedule: frame \}\)/, 'the composition asks gridsOf and hands Grids its grids and its look');
});

/*
H26.8's grid move (dev/design/components/NATIVE-SHAPES.md sections 3.1 to 3.3, 4.9; GR7, GR8) -- THE GRIDS, A PART OF THEIR OWN: app/src/grids.js,
`kind: 'host'`, by H26-10 and H26-16, consuming nothing, and the canvas consuming it, so the edge runs one way. It is handed its grids, so
it asks no place, reads no part and imports nothing outside its part -- nothing at all.
*/
test('H26.8: PARTS.grids holds app/src/grids.js, consumes nothing, imports nothing, and the canvas consumes it', () => {
	const g = PARTS.grids;
	assert.ok(g, 'the part is declared');
	assert.deepEqual([g.duty, g.kind, g.by, g.modules, g.consumes], ['Draw the grids places snap to', 'host', ['H26-10', 'H26-16'], ['app/src/grids.js'], []]);
	assert.ok(PARTS.canvas.consumes.includes('grids') && !PARTS.canvas.modules.includes('app/src/grids.js'), 'the canvas consumes it, and holds it no longer');
	assert.ok(!PARTS.renderer.consumes.includes('grids') && !g.consumes.includes('canvas'), 'the edge one way: neither the renderer nor the grids consume back');
	const grids = code('app/src/grids.js');
	assert.doesNotMatch(grids, /\bimport\b/, 'GR7: it imports nothing');
	assert.match(grids, /constructor\(\{ scene, grids, model, look = NO_VIEW, schedule = /, 'handed the scene, its grids, the model, the view\'s look and its schedule');
	assert.doesNotMatch(grids, /\bparts\b|places|gridsOf/, 'and asks no part for its grids');
});
