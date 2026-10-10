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

const code = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const shift = (h, down) => (down ? h.capture.onKeyDown(key('Shift', { shiftKey: true })) : h.capture.onKeyUp(key('Shift')));
const onDevice = (id, x, y, mod = {}) => pointer(x, y, { target: { tagName: 'g', classList: { contains: () => false }, dataset: {}, closest: (s) => (s.includes('node') ? { id } : null) }, ...mod });

test('C-e: Shift shows the zone grid and letting go hides it; during a move Shift does not show it -- the state under test', () => {
	const h = makeInput();
	try {
		shift(h, true);
		assert.equal(h.svg.classList.contains('zonegrid'), true, 'Shift is the zone-layer key (DESIGN U1)');
		shift(h, false);
		assert.equal(h.svg.classList.contains('zonegrid'), false);
		const [d] = seedNodes(h.model, [[0, 0]]);
		h.capture.onDown(onDevice(d.id, 0, 0, { button: 2, buttons: 2 }));
		h.capture.onMove(onDevice(d.id, 120, 0, { button: 2, buttons: 2 }));
		assert.equal(h.model.get('node', d.id).x, 120, 'a move under way -- its live preview writes the model (B7)');
		shift(h, true);
		assert.equal(h.svg.classList.contains('zonegrid'), false, 'Shift locks the axis mid-move; it raises no grid');
		h.capture.onMove(onDevice(d.id, 180, 0, { button: 2, buttons: 2, shiftKey: true }));
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

// RESTATED at WD-b2 (H19.46): both grids are the layouts plugin's, drawn from the diagram's layout records (tests/layouts-canvas.test.js)
test('C-e: the layouts plugin declares the anchor grid, always shown, and the half-offset grid, shown with Shift', () => {
	const grids = PRODUCT_CANVAS.flatMap((p) => (p.grids ?? []).map((g) => ({ ...g, owner: p.owner })));
	const m = new Model();
	assert.deepEqual(grids.map((g) => [g.owner, g.layer, g.points(m).length, g.r, g.shownWith ?? null, g.cls ?? null]),
		[['layouts', 'grid-nodes', 31 * 17, gridDot().radius, null, null], ['layouts', 'grid-zones', 32 * 18, 5, 'shiftKey', 'zonegrid']]);
	const zone = grids[1].points(m);
	assert.deepEqual([zone[0], zone.at(-1)], [{ x: -930, y: -510 }, { x: 930, y: 510 }], 'the half-offset lattice, edge to edge');
});

test('C-e: the canvas draws and shows no grid of its own', () => {
	assert.doesNotMatch(code('app/src/compose-canvas.js'), /grid-zones|grid-nodes|zonePoints|nodePoints|ZONE_GRID_DOT/);
	assert.doesNotMatch(code('app/src/overlay.js'), /zonegrid|zoneGrid/);
	assert.doesNotMatch(code('app/src/input.js'), /zoneGrid|syncZoneGrid/);
	assert.doesNotMatch(code('app/src/snap.js'), /ZONE_EXT|zonePoints|nodePoints/);
});
