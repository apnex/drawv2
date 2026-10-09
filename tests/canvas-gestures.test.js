/*
C-d, step one (H19.32; dev/design/unification/CANVAS-PLUGINS.md, D2: rows for shared gestures) -- THE ZONE IS DRAWN AND
RESIZED BY THE ZONES PLUGIN'S ROWS OVER THE CANVAS'S SHARED GESTURES.

The canvas held a zone's draw (a press row, a gesture, a release table, an action) and its resize (a gesture reading the
selected zone, the corner arithmetic, the overlay's corner handles). The zones plugin brings a press row opening the shared
BOX gesture -- placed on its grid, previewed by its class, its release making a zone through the host's `create` -- and
handles for the shared HANDLE gesture: where they are, what a drag makes of the zone, the command's label. Nothing a user sees
changes: the gesture corpus holds that.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeInput, pointer } from './fixtures/client-harness.mjs';
import { makeZone } from '../zones/make-zone.mjs';
import { PRODUCT_CANVAS } from '../product/canvas.mjs';

const code = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const canvasAt = (x, y, mod = {}) => pointer(x, y, mod);   // the default target answers no pick: the canvas
const handle = (corner, x, y) => pointer(x, y, { target: { tagName: 'rect', classList: { contains: (c) => c === 'handle' }, dataset: { corner }, closest: () => ({}) } });
const drawBox = (h, from, to) => {
	h.capture.onDown(canvasAt(...from, { shiftKey: true }));
	h.capture.onMove(canvasAt(...to, { shiftKey: true }));
	h.capture.onUp(canvasAt(...to, { shiftKey: true }));
};

test('C-d: Shift and drag on the canvas draws a zone on its grid, selected -- the state under test', () => {
	const h = makeInput();
	try {
		drawBox(h, [0, 0], [180, 120]);
		const [z] = h.model.all('zone');
		assert.ok(z, 'a zone was made');
		assert.deepEqual({ x: z.x, y: z.y, w: z.w, h: z.h }, { x: 30, y: 30, w: 180, h: 120 }, 'on the half-offset grid');
		assert.deepEqual(h.selection.list(), [z.id]);
	} finally { h.restore(); }
});

test('C-d: dragging a selected zone\'s corner resizes it, the opposite corner staying put; a cancelled drag rewinds', () => {
	const h = makeInput();
	try {
		const z = makeZone(h.model, { x: -30, y: -30, w: 120, h: 120 }); h.model.put('zone', z);
		h.selection.set([z.id]);
		h.capture.onDown(handle('se', 90, 90));
		h.capture.onMove(handle('se', 210, 150));
		h.capture.onUp(handle('se', 210, 150));
		const r = h.model.get('zone', z.id);
		assert.deepEqual({ x: r.x, y: r.y, w: r.w, h: r.h }, { x: -30, y: -30, w: 240, h: 180 });
		h.capture.onDown(handle('se', 210, 150));
		h.capture.onMove(handle('se', 330, 150));
		h.input.cancelDrag();
		const c = h.model.get('zone', z.id);
		assert.deepEqual({ w: c.w, h: c.h }, { w: 240, h: 180 }, 'a cancelled drag is a no-op');
	} finally { h.restore(); }
});

test('C-d: without the zones plugin, Shift and drag draws nothing and a zone shows no handles to grab', () => {
	const h = makeInput({ parts: PRODUCT_CANVAS.filter((p) => p.owner !== 'zones') });
	try {
		drawBox(h, [0, 0], [180, 120]);
		assert.equal(h.model.all('zone').length, 0);
		assert.equal(h.input.handles.has('zone'), false);
	} finally { h.restore(); }
});

test('C-d: the canvas holds no zone draw or resize of its own', () => {
	const input = code('app/src/input.js');
	assert.doesNotMatch(input, /zone-rect preview|makeZone|resizeBox|zoneCorners|OPPOSITE_CORNER|createZoneFrom|snapZone/);
	assert.doesNotMatch(code('app/src/recognize.js'), /zone-draw/);
	assert.doesNotMatch(code('app/src/releases.js'), /ZONE_RELEASES|createZoneFrom/);
	// the overlay's handles are the parts' -- its Ctrl clone-arming of a zone is the clone rows', a later step's
	assert.doesNotMatch(code('app/src/overlay.js'), /zoneCorners|kindOf\(id\) !== 'zone'|'corner'/);
	assert.doesNotMatch(code('app/src/snap.js'), /resizeBox|zoneCorners|OPPOSITE_CORNER|snapZone|MIN_ZONE/);
});

test('C-d: a kind\'s handles brought twice are refused when Input is built, naming both', () => {
	const z = PRODUCT_CANVAS.find((p) => p.owner === 'zones');
	assert.throws(() => makeInput({ parts: [...PRODUCT_CANVAS, { owner: 'again', handles: z.handles }] }), /Input: zone's handles are brought by zones and by again/);
});
