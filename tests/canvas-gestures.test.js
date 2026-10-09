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

// ---- C-d, step two: the link's end handles and re-plug, the network's handles over the shared handle gesture ----

const endHandle = (end, x, y) => pointer(x, y, { target: { tagName: 'circle', classList: { contains: (c) => c === 'handle' }, dataset: { end }, closest: () => null } });
const threeHosts = async (h) => {
	const { seedNodes } = await import('./fixtures/client-harness.mjs');
	const { makeLink } = await import('../network/link-queries.mjs');
	const [n0, n1, n2] = seedNodes(h.model, [[0, 0], [360, 0], [360, 360]]);
	const l = makeLink(h.model, n2.id, n1.id); h.model.put('link', l);
	h.selection.set([l.id]);
	return { n0, n1, n2, l };
};

test('C-d: dragging a selected link\'s src handle onto a device re-plugs it there; a cancelled drag changes nothing', async () => {
	const h = makeInput();
	try {
		const { n0, n1, n2, l } = await threeHosts(h);
		h.capture.onDown(endHandle('src', 360, 330));
		h.capture.onMove(pointer(200, 0));
		h.input.cancelDrag();
		assert.deepEqual([h.model.get('link', l.id).src, h.model.get('link', l.id).dst], [n2.id, n1.id], 'cancelled: as it was');
		h.capture.onDown(endHandle('src', 360, 330));
		h.capture.onMove(pointer(30, 0));
		h.capture.onUp(pointer(0, 0));
		assert.deepEqual([h.model.get('link', l.id).src, h.model.get('link', l.id).dst], [n0.id, n1.id], 're-plugged onto the device released on');
	} finally { h.restore(); }
});

test('C-d: without the network\'s part a link has no handles, and a press on one does nothing', async () => {
	const h = makeInput({ parts: PRODUCT_CANVAS.filter((p) => p.owner !== 'network') });
	try {
		const { n2, l } = await threeHosts(h);
		assert.equal(h.input.handles.has('link'), false);
		h.capture.onDown(endHandle('src', 360, 330));
		h.capture.onUp(pointer(0, 0));
		assert.equal(h.model.get('link', l.id).src, n2.id);
	} finally { h.restore(); }
});

test('C-d: the canvas holds no link handle or re-plug of its own; the handle gesture commits nothing itself', () => {
	const input = code('app/src/input.js');
	assert.doesNotMatch(input, /replugTo|'lhandle'|replugLink|\breplug: \{/);
	assert.doesNotMatch(code('app/src/recognize.js'), /lhandle|id: 'resize'/);
	assert.doesNotMatch(code('app/src/releases.js'), /REPLUG_RELEASES/);
	assert.doesNotMatch(code('app/src/overlay.js'), /pathOf|'end'|'link'/);
	assert.doesNotMatch(code('app/src/pick.js'), /dataset\.end|dataset\.corner|'lhandle'|'handle' \}/);
	const slot = input.slice(input.indexOf('\thandle: {'), input.indexOf('\n\t},', input.indexOf('\thandle: {')));
	assert.doesNotMatch(slot, /history\.commit/, 'its end is the declaring plugin\'s release rows');
});

test('C-d: a re-plug marks its link while the end is dragged, and a cancel unmarks it', async () => {
	const h = makeInput();
	try {
		const { l } = await threeHosts(h);
		const marks = () => h.stateCalls('renderer.setState').filter(([id, cls]) => id === l.id && cls === 'replugging').map(([, , on]) => on);
		h.capture.onDown(endHandle('src', 360, 330));
		h.capture.onMove(pointer(200, 0));
		assert.deepEqual(marks(), [true], 'marked while dragged');
		h.input.cancelDrag();
		assert.deepEqual(marks(), [true, false], 'unmarked by the cancel');
	} finally { h.restore(); }
});

// ---- C-d, step three: the text box, the devices plugin's row over the shared box gesture ----

test('C-d: with the text tool held, a drag makes a text panel over the cells it spans, selected; the tool is released', async () => {
	const { key } = await import('./fixtures/client-harness.mjs');
	const h = makeInput();
	try {
		h.capture.onKeyDown(key('t'));
		h.capture.onDown(pointer(0, 0));
		h.capture.onMove(pointer(120, 60));
		h.capture.onUp(pointer(120, 60));
		const [tb] = h.model.all('node');
		assert.ok(tb, 'a panel was made');
		assert.deepEqual({ type: tb.type, x: tb.x, y: tb.y, span: tb.span }, { type: 'text', x: 0, y: 0, span: { cols: 3, rows: 2 } });
		assert.deepEqual(h.selection.list(), [tb.id]);
		assert.equal(h.tools.textTool, false, 'one panel per arm');
	} finally { h.restore(); }
});

test('C-d: without the devices plugin\'s part, a press with the text tool held makes nothing', async () => {
	const { key } = await import('./fixtures/client-harness.mjs');
	const h = makeInput({ parts: PRODUCT_CANVAS.filter((p) => p.owner !== 'devices') });
	try {
		h.capture.onKeyDown(key('t'));
		h.capture.onDown(pointer(0, 0));
		h.capture.onUp(pointer(0, 0));
		assert.equal(h.model.all('node').length, 0);
	} finally { h.restore(); }
});

test('C-d: the canvas holds no text box of its own', () => {
	const input = code('app/src/input.js');
	assert.doesNotMatch(input, /textbox-preview|makeTextBox|frameSpan|\btextbox: \{/);
	assert.doesNotMatch(code('app/src/recognize.js'), /gesture: 'textbox'|id: 'tool'/);
});

test('C-d: the text box\'s frame shows once the pointer moves -- not at the press; the zone\'s box shows at once', async () => {
	const { key } = await import('./fixtures/client-harness.mjs');
	const h = makeInput();
	try {
		const preview = (cls) => h.input.overlay.children.find((c) => (c.getAttribute('class') || '').includes(cls));
		h.capture.onKeyDown(key('t'));
		h.capture.onDown(pointer(60, 60));
		assert.equal(Number(preview('textbox-preview').getAttribute('width')), 0, 'not yet');
		h.capture.onMove(pointer(180, 60));
		assert.ok(Number(preview('textbox-preview').getAttribute('width')) > 0, 'once it moves');
		h.input.cancelDrag();
		h.tools.setTextTool(false);   // a cancel keeps the tool held; released, the canvas's Shift-press is the zone's
		h.capture.onDown(pointer(0, 0, { shiftKey: true }));
		assert.equal(Number(preview('zone-rect').getAttribute('x')), 30, 'the zone\'s, at once, on its grid');
		h.input.cancelDrag();
	} finally { h.restore(); }
});
