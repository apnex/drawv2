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

// B316 -- C-d step two gave a link end's hit an id, and the Alt+right delete chord, which matched any hit with an id but a corner
// handle, came to take a press on a link end (it deleted nothing: the id names no entity). A handle's hit is flagged now.
test('B316: Alt+right on a link\'s end handle or a zone\'s corner starts nothing', async () => {
	const { resolveInput } = await import('../kernel/input-rules.mjs');
	const h = makeInput();
	try {
		for (const on of [{ kind: 'lhandle', id: 'src', handle: true }, { kind: 'handle', id: 'se', handle: true }]) {
			const evt = { type: 'down', button: 2, altKey: true, shiftKey: false, ctrlKey: false, metaKey: false, on };
			assert.equal(resolveInput(h.input.pressRules, evt, h.input.situation(), { readOnly: false }).rule, null, `${on.kind}: no row`);
		}
	} finally { h.restore(); }
});

// B317 -- since C-d step two a link end's hit carries an id, and the overlay's hover, which ignored only a corner handle and an
// id-less hit, took a link end handle for an entity named `src`: Ctrl pressed over it asked the model for kind `src`, and threw
test('B317: hovering a link\'s end handle hovers nothing, and Ctrl pressed over it throws nothing', async () => {
	const { key } = await import('./fixtures/client-harness.mjs');
	const h = makeInput();
	try {
		await threeHosts(h);
		h.capture.onHover(endHandle('src', 360, 330), true);
		assert.equal(h.input.overlayUi.hovered, null, 'a handle is no entity to hover');
		assert.doesNotThrow(() => h.capture.onKeyDown(key('Control', { ctrlKey: true })));
	} finally { h.restore(); }
});

// ---- C-d, step four (D4): the press rows read what the plugins' picks say their items are ----

test('C-d: what a press starts follows the plugins\' facts -- a right press moves the placed, a left press draws from an anchor, Ctrl+left clones', async () => {
	const { pressRows, hitFactsOf } = await import('../app/src/recognize.js');
	const { picksOf } = await import('../app/src/pick.js');
	const { placesOf } = await import('../app/src/snap.js');
	const facts = hitFactsOf(picksOf(PRODUCT_CANVAS), placesOf(PRODUCT_CANVAS));
	assert.deepEqual(Object.fromEntries([...facts].map(([w, f]) => [w, [f.placed, f.anchor, f.clones].map(Number).join('')])),
		{ node: '111', link: '001', waypoint: '110', zone: '101' }, 'placed / anchor / clones, per hit word');
	const rows = pressRows(picksOf(PRODUCT_CANVAS), placesOf(PRODUCT_CANVAS));
	assert.deepEqual(rows.find((r) => r.id === 'r-press').input, ['right on node|waypoint|zone']);
	assert.deepEqual(rows.find((r) => r.id === 'link').input, ['left on node|waypoint']);
});

test('C-d: without the zones plugin no press row names a zone', async () => {
	const { pressRows } = await import('../app/src/recognize.js');
	const { picksOf } = await import('../app/src/pick.js');
	const { placesOf } = await import('../app/src/snap.js');
	const without = PRODUCT_CANVAS.filter((p) => p.owner !== 'zones');
	const docs = pressRows(picksOf(without), placesOf(without)).flatMap((r) => r.input ?? []).join(' ');
	assert.doesNotMatch(docs, /zone/);
});

test('C-d: the press rows and the overlay\'s arming name no plugin\'s kind', () => {
	// the shared draw-a-link gesture keeps its own name (D2: the product's gesture, the network's judge); no row tests a kind
	assert.doesNotMatch(code('app/src/recognize.js').replace(/id: 'link'|gesture: 'link'/g, ''), /'node'|'zone'|'link'|'waypoint'/);
	assert.doesNotMatch(code('app/src/overlay.js'), /kind === 'zone'|isTypedEntity\(kind, this\.model/, 'the arming reads the facts (the hover footprint is the coordinate picks\', a later step)');
	assert.doesNotMatch(code('app/src/input.js'), /hit\.kind !== 'zone'|hit\.kind === 'link'|=== 'zone'\) \{/);
});

test('C-d: Ctrl over a hovered device or zone lights the clone; over a waypoint it does not (D4: placed and cloned)', async () => {
	const { key, seedNodes } = await import('./fixtures/client-harness.mjs');
	const { makeWaypoint } = await import('../devices/make-node.mjs');
	const h = makeInput();
	try {
		const [n] = seedNodes(h.model, [[0, 0]]);
		const w = makeWaypoint(h.model, { x: 120, y: 120 }); h.model.put('node', w);
		const over = (word, id) => pointer(0, 0, { target: { tagName: 'g', classList: { contains: () => false }, dataset: {}, closest: (s) => (s.includes(word) ? { id } : null) } });
		const clone = (id) => h.stateCalls('renderer.setState').some(([x, cls, on]) => x === id && cls === 'armed-clone' && on);
		h.capture.onHover(over('node', n.id), true);
		h.capture.onKeyDown(key('Control', { ctrlKey: true }));
		assert.ok(clone(n.id), 'a device');
		h.capture.onHover(over('node', n.id), false);
		h.capture.onHover(over('waypoint', w.id), true);
		h.capture.onKeyDown(key('Control', { ctrlKey: true }));
		assert.ok(!clone(w.id), 'not a waypoint');
	} finally { h.restore(); }
});

test('C-d: a Shift-press on a zone selects it alone -- Shift is the zone\'s layer key, not selection-add', async () => {
	const { seedNodes } = await import('./fixtures/client-harness.mjs');
	const h = makeInput();
	try {
		const [n] = seedNodes(h.model, [[0, 0]]);
		const z = makeZone(h.model, { x: 150, y: 150, w: 120, h: 120 }); h.model.put('zone', z);
		h.selection.set([n.id]);
		const onZone = pointer(200, 200, { shiftKey: true, target: { tagName: 'rect', classList: { contains: () => false }, dataset: {}, closest: (s) => (s.includes('zone') ? { id: z.id } : null) } });
		h.capture.onDown(onZone);
		h.capture.onUp(onZone);
		assert.deepEqual(h.selection.list(), [z.id]);
	} finally { h.restore(); }
});
