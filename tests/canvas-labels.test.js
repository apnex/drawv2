/*
C-e, step eleven (H19.33; dev/design/unification/CANVAS-PLUGINS.md section 3: "where its label edits") -- WHERE A KIND'S NAME IS
EDITED IS ITS PLUGIN'S TO SAY.

A double-click edits what is under the pointer by what the parts say they edit there, in rank order: the devices plugin's text
box by its whole footprint (its text), then a device by its icon or the strip beneath it (its name), then the zones plugin's zone
by its box (its name). F2 renames among the selection only the kinds a part says are named -- a device, a zone; not a link or a
group. The name editor opens where the part says a kind's label sits -- under a device, centred -- or beside the entity's corner.
Nothing a user sees changes.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeInput, pointer, key, seedNodes } from './fixtures/client-harness.mjs';
import { PRODUCT_CANVAS } from '../product/canvas.mjs';
import { makeZone } from '../plugins/zones/make-zone.mjs';
import { makeTextBox } from '../plugins/devices/make-node.mjs';
import { makeLink } from '../plugins/network/link-queries.mjs';

const code = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const opened = (h) => h.stateCalls('labels.open').map(([kind, id]) => `${kind}:${id}`);
const board = (h) => {
	const [d] = seedNodes(h.model, [[0, 0]]);
	const z = makeZone(h.model, { x: 330, y: 330, w: 240, h: 180 }); h.model.put('zone', z);
	const tb = makeTextBox(h.model, { x: -240, y: -240 }, { cols: 3, rows: 2 }); h.model.put('node', tb);
	return { d, z, tb };
};

// RESTATED 2026-10-15 (H24.1, B264): the zone's double-click is Shift+double-click now -- every zone interaction takes Shift
test('C-e: a double-click edits a device\'s name on its icon or the strip beneath, a zone\'s inside it, a text box\'s text anywhere on it -- the state under test', () => {
	const h = makeInput();
	try {
		const { d, z, tb } = board(h);
		h.capture.onDblClick(pointer(3, 2)); h.capture.onDblClick(pointer(10, 34)); h.capture.onDblClick(pointer(500, 480, { shiftKey: true }));
		assert.deepEqual(opened(h), [`node:${d.id}`, `node:${d.id}`, `zone:${z.id}`]);
		h.capture.onDblClick(pointer(-120, -180));
		assert.deepEqual(h.selection.list(), [tb.id], 'the text box, selected');
		assert.equal(opened(h).length, 3, 'its text, not a name editor');
	} finally { h.restore(); }
});

test('C-e: without the zones plugin a double-click inside a zone edits nothing; without the devices plugin, on a device nothing', () => {
	for (const [owner, at] of [['zones', [500, 480]], ['devices', [3, 2]]]) {
		const h = makeInput({ parts: PRODUCT_CANVAS.filter((p) => p.owner !== owner) });
		try {
			board(h);
			h.capture.onDblClick(pointer(...at));
			assert.deepEqual(opened(h), [], `without ${owner}`);
		} finally { h.restore(); }
	}
});

test('C-e: F2 renames among the selection only the named kinds -- a zone with a link selected is the zone -- the state under test', () => {
	const h = makeInput();
	try {
		const { d, z } = board(h);
		const [e] = seedNodes(h.model, [[240, 0]]);
		const l = makeLink(h.model, d.id, e.id); h.model.put('link', l);
		h.selection.set([l.id, z.id]);
		h.capture.onKeyDown(key('F2'));
		assert.deepEqual(opened(h), [`zone:${z.id}`]);
	} finally { h.restore(); }
});

test('C-e: the devices plugin says a device\'s label sits under it, centred; a waypoint\'s, the canvas default', async () => {
	const { DEVICE_LABELS } = await import('../plugins/devices/device-labels.mjs');
	const at = DEVICE_LABELS.labelAt;
	assert.deepEqual(at({ id: 'node-aa0001', type: 'host', x: 60, y: 120 }), { x: 60, y: 146, centred: true });
	assert.equal(at({ id: 'node-aa0002', x: 60, y: 120 }), null, 'a waypoint: no word from the devices plugin');
});

test('C-e: the canvas holds no double-click target, label placement or F2 filter of its own', () => {
	const input = code('app/src/input.js');
	const edit = input.slice(input.indexOf('\teditUnderPointer(evt) {'), input.indexOf('\n\t}\n', input.indexOf('\teditUnderPointer(evt) {')));
	assert.doesNotMatch(edit, /typedNodes|'zone'|'node'|content === 'text'|inFootprint/);
	assert.doesNotMatch(input, /kindOf\(id\) !== 'link' && kindOf\(id\) !== 'group'/);
	assert.doesNotMatch(code('app/src/labeledit.js'), /drawnKind|drawn === 'node'/);
});

test('C-e: a Tab rename run advances to the next entity of the same drawn kind -- a device to a device, a waypoint to a waypoint', async () => {
	const { LabelEditor } = await import('../app/src/labeledit.js');
	const { setFields, renameEntity } = await import('../app/src/commands.js');   // H26.8's capture move: its two edits, as the composition hands them
	const { makeWaypoint } = await import('../plugins/devices/make-node.mjs');
	const h = makeInput();
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [240, 0]]);
		const w1 = makeWaypoint(h.model, { x: 120, y: 0 }); h.model.put('node', w1);
		const w2 = makeWaypoint(h.model, { x: 120, y: 120 }); h.model.put('node', w2);
		const DEVICE_LABELS = PRODUCT_CANVAS.find((p) => p.owner === 'devices').labels;
		const ed = new LabelEditor({ svg: {}, model: h.model, history: {}, edits: { setFields, rename: renameEntity }, wordOf: DEVICE_LABELS.wordOf });
		assert.equal(ed.neighbor('node', a.id, 1), b.id, 'past the waypoint between them');
		assert.equal(ed.neighbor('node', w1.id, 1), w2.id);
	} finally { h.restore(); }
});

test('C-e: a double-click on a device inside a zone edits the device\'s name -- its rank is before the zone\'s', () => {
	const h = makeInput();
	try {
		const { z } = board(h);
		const [d] = seedNodes(h.model, [[420, 420]]);   // inside the zone
		h.capture.onDblClick(pointer(421, 419));
		assert.deepEqual(opened(h), [`node:${d.id}`]);
		assert.ok(z);
	} finally { h.restore(); }
});

// B321 -- F2 renamed among the selection everything but a link and a group, so a selected pipe (selected by clicking it, a
// plugin's mark) opened a name editor with no place and no name, and a name typed into it was dropped (measured on the page)
test('B321: F2 with a pipe selected opens no name editor', async () => {
	const { pipeEntity } = await import('../plugins/network/pipe-kind.mjs');
	const h = makeInput();
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [240, 0]]);
		const p = pipeEntity(a.id, b.id, 'hand'); h.model.put('pipe', p);
		h.selection.set([p.id]);
		h.capture.onKeyDown(key('F2'));
		assert.deepEqual(opened(h), []);
	} finally { h.restore(); }
});

/*
H24.1 (B264) -- every zone interaction takes Shift, and a double-click was the one that did not.

A zone is an inert backdrop: a press reaches it only with Shift held (plugins/zones/zone-painter.mjs, its pick's `modifier`), so a
plain click or marquee passes through it. The double-click asked the zones plugin's edit (`plugins/zones/zone-labels.mjs`) with no
such test, so a plain double-click anywhere in a zone opened its name editor and selected it -- the gap B264 recorded and
the director ruled closed: "all zone interaction requires shift".

The control is what must not change: a device and a text box inside the zone still edit on a plain double-click, because
their ranks come before the zone's and they are not backdrops.
*/
test('H24.1 (B264): a double-click inside a zone edits its name only with Shift held; a device or text box in it needs none', () => {
	const h = makeInput();
	try {
		const { z } = board(h);
		h.capture.onDblClick(pointer(500, 480));
		assert.deepEqual(opened(h), [], 'a plain double-click inside a zone opens no editor');
		assert.deepEqual(h.selection.list(), [], 'and selects nothing -- it passes through, as a plain press does');

		h.capture.onDblClick(pointer(500, 480, { shiftKey: true }));
		assert.deepEqual(opened(h), [`zone:${z.id}`], 'Shift+double-click edits the zone\'s name');
		assert.deepEqual(h.selection.list(), [z.id], 'and selects it');

		// control: what sits inside the zone is not a backdrop, so it edits without Shift
		const [d] = seedNodes(h.model, [[420, 420]]);
		const tb = makeTextBox(h.model, { x: 360, y: 540 }, { cols: 2, rows: 1 }); h.model.put('node', tb);
		h.capture.onDblClick(pointer(421, 419));
		assert.deepEqual(opened(h), [`zone:${z.id}`, `node:${d.id}`], 'a device inside the zone edits on a plain double-click');
		h.capture.onDblClick(pointer(380, 545));
		assert.deepEqual(h.selection.list(), [tb.id], 'and so does a text box inside it');
	} finally { h.restore(); }
});

/*
H26.6's move 7 (dev/design/components/PAN-ZOOM.md section 3.7, "An open label editor"; appendix A move 7) -- AN OPEN EDITOR FOLLOWS THE VIEW.
While open it listens through the scene's `onView` and is placed again at each view change, neither committing nor cancelling: a name's
editor where the label is on screen, a region's over the region's box with its 15-unit text scaled by the view's scale, where it read
the root's screen scale (`app/src/labeledit.js`); once closed it listens no more. The views set here stand for a pan and a zoom -- the
verbs that set them, and home and fit, join at moves 9 and 10, each through the one `setView` -- on the harness's scene, viewed as the
page's is, whose screen transform is the identity, so a point's place on screen is the view's arithmetic alone (vector-scene VS14).
*/
test('H26.6 move 7: an open label editor follows the view -- a name\'s and a region\'s placed again, the font scaled again, nothing committed; closed, it stops', async () => {
	const { LabelEditor } = await import('../app/src/labeledit.js');
	const h = makeInput();
	const made = document.createElement;
	document.createElement = (t) => Object.assign(made(t), { focus() {}, select() {}, addEventListener() {} });   // what the editor asks of its input
	try {
		const [d] = seedNodes(h.model, [[120, 60]]);
		const panel = { id: 'node-c70001', name: 'p', type: 'host', shape: 'square', x: 300, y: 0, content: [{ at: [0, 0], content: 'text', value: 'a', input: true }] };
		h.model.put('node', panel);
		const contentOf = (e, idx) => PRODUCT_CANVAS.map((p) => p.labels?.content).filter(Boolean).find((c) => c.valueOf(e, idx) != null) ?? null;
		const sent = [];
		const ed = new LabelEditor({ scene: h.scene, model: h.model, history: { commit: (c) => sent.push(c) }, edits: {}, contentOf });
		const at = (style) => [style.left, style.top];
		// a name's editor, beside the corner (no part places a label in this composition's `labelAt`): drawing point 130,66
		ed.open('node', d.id);
		assert.deepEqual(at(ed.input.style), ['130px', '66px'], 'control: opened at the opening view, a unit to a pixel');
		h.scene.setView({ x: -100, y: -50, scale: 2 });   // a zoom in, the drawing point -100,-50 at the root's corner
		assert.deepEqual(at(ed.input.style), ['460px', '232px'], 'placed again: 2 x (130 + 100), 2 x (66 + 50)');
		h.scene.setView({ x: 10, y: 20, scale: 0.5 });     // a zoom out and a pan
		assert.deepEqual(at(ed.input.style), ['60px', '23px'], 'and again: (130 - 10) / 2, (66 - 20) / 2');
		const named = ed.input;
		ed.close(false);
		h.scene.setView({ x: 0, y: 0, scale: 1 });
		assert.deepEqual(at(named.style), ['60px', '23px'], 'closed: it follows no more');
		// a region's editor, over the region's box -- the platform's box for the drawing rect 300,0 to 360,30, through the view
		const rectEl = { getBoundingClientRect: () => { const a = h.scene.toScreen({ x: 300, y: 0 }), b = h.scene.toScreen({ x: 360, y: 30 }); return { left: a.x, top: a.y, width: b.x - a.x, height: b.y - a.y }; } };
		ed.openContent(panel.id, 0, rectEl);
		const box = (style) => [style.left, style.top, style.width, style.height, style.fontSize];
		assert.deepEqual(box(ed.input.style), ['300px', '0px', '60px', '30px', '15px'], 'control: the region\'s box, its text 15 units at a unit to a pixel');
		h.scene.setView({ x: 250, y: -10, scale: 2 });
		assert.deepEqual(box(ed.input.style), ['100px', '20px', '120px', '60px', '30px'], 'placed again over the box, the font scaled by the view\'s scale');
		const region = ed.input;
		ed.close(false);
		h.scene.setView({ x: 0, y: 0, scale: 1 });
		assert.deepEqual(box(region.style), ['100px', '20px', '120px', '60px', '30px'], 'closed: it follows no more');
		assert.deepEqual(sent, [], 'nothing committed by a view change');
		assert.doesNotMatch(code('app/src/labeledit.js'), /getScreenCTM|\bsvg\b/, 'the root\'s screen scale is read no more');
	} finally { document.createElement = made; h.restore(); }
});
