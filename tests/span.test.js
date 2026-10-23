import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Model, heldLayouts } from './fixtures/composed.mjs';   // the network's kinds, the link among them (S-e)
import { attachRelations } from '../engine/store.mjs';
import { selBox, showsSockets } from '../kernel/renderer.mjs';
import { isPanel, frameRadius } from '../plugins/devices/device-types.mjs';
import { NODE_GRID } from '../kernel/geometry.mjs';   // H26.1: the relation index is injected the node grid's nearest (it was cellOf)
import { spanThrough } from '../plugins/devices/device-footprint.mjs';   // H26.1: what a span runs through, snap-grid's span on the node grid (it was spanExtent)
import { STD, L_STD } from '../kernel/spec.mjs';
import { svgDocument } from '../server/svg.mjs';   // H25.5 (B378, D4): the real export renderer
import { COMPOSED_KINDS, readModel } from '../product/types.mjs';
import { PRODUCT_CANVAS } from '../product/canvas.mjs';
import { Renderer } from '../app/src/renderer.js';
import { makeRenderer } from './fixtures/client-harness.mjs';
import { validateEntity, validateDoc } from './fixtures/composed.mjs';   // the network's kinds, as the store validates (S-e)
import { createEntity } from '../app/src/commands.js';
// RESTATED at C-e step twelve (H19.33): a panel's region is the devices plugin's to edit; run as the label editor commits it
import { contentCommand as setContentValue } from './fixtures/plugin-edits.mjs';
// RESTATED at C-e step six (D5): `s` is the devices plugin's row; the reshape is run as the row runs it
import { reshapeCommand as reshapeNodes } from './fixtures/plugin-edits.mjs';
import { controlBarDoc } from './fixtures/control-bar-doc.mjs';
import { makeNode, makeTextBox } from '../plugins/devices/make-node.mjs';   // O-e1: the devices plugin's factories
import { occupiedAt } from '../plugins/devices/occupancy.mjs';   // O-e1: which device or waypoint is on a cell

// W1 — multi-cell span foundation. A node gains an optional span = {cols,rows} (cell counts, default
// 1×1); it anchors at its cell and grows +col/+row. Both absent ⇒ byte-identical to today's 1-cell node.
// These tests pin: kernel geometry/render, the doc↔schema adapter, span-aware occupancy, the server
// gate, and history-clone isolation — and the 1×1 byte-identity that makes the field parity-safe.

const P = STD.pitch;   // 60

// H25.5 (B378, D4): helpers driving the real export renderer (server/svg.mjs svgDocument) and the real client Renderer
const renderNodesSvg = (nodes, extra = {}) => svgDocument({ meta: { id: '0000000000000001', name: 'd' }, nodes, links: [], zones: [], groups: [], ...extra }).split('</defs>').pop();
const groupSvg = (svg, id) => { const at = svg.indexOf(`<g id="${id}"`); return svg.slice(at, svg.indexOf('</g>', at + 1) + 4); };
const renderNodeSvg = (node) => groupSvg(renderNodesSvg([node]), node.id);

// ---- kernel geometry + render (RESTATED at H25.5, B378, D4: driven through spanExtent and the real renderer) ----
// RESTATED at H26.1 (SNAP-GRID.md appendix B): through the devices plugin's `spanThrough` -- `span(...).through` on the node grid
test('bboxOf: 1×1 is the 40px frame; a span grows +x/+y from the anchor', () => {
	assert.deepEqual(spanThrough(undefined), { sw: 0, sh: 0 });
	assert.deepEqual(spanThrough({ cols: 3, rows: 2 }), { sw: 2 * P, sh: 1 * P });
	const svg = renderNodesSvg([
		{ id: 'node-000001', name: 'r', type: 'router', shape: 'circle', x: 0, y: 0 },
		{ id: 'node-000002', name: 'h', type: 'host', shape: 'square', x: 2 * P, y: 0, span: { cols: 3, rows: 2 } },
	]);
	assert.doesNotMatch(groupSvg(svg, 'node-000001'), /data-span=/, '1x1 carries no span attribute');
	assert.match(groupSvg(svg, 'node-000002'), /data-span="3x2".*<rect [^>]*class="frame" x="-20" y="-20" width="160" height="100"/);
});

test('renderElement: 1×1 keeps the <use> frame; a span draws a sized rect frame', () => {
	const svgOne = renderNodeSvg({ id: 'node-000001', name: 'r', type: 'router', shape: 'circle', x: 0, y: 0 });
	const svgSpan = renderNodeSvg({ id: 'node-000002', name: 'h', type: 'host', shape: 'square', x: 0, y: 0, span: { cols: 3, rows: 2 } });
	assert.match(svgOne, /<use [^>]*href="#m-circle"\/>/);
	assert.ok(!svgOne.includes('class="frame"'), '1×1 uses the frame def, not a rect');
	assert.match(svgSpan, /<rect [^>]*class="frame" x="-20" y="-20" width="160" height="100" rx="5"/);   // 3×2 footprint
	assert.ok(!svgSpan.includes('#m-'), 'a span node does not reference the 1-cell frame def');
});

test('selBox: default args are byte-identical to the pre-span box; a span extends it', () => {
	assert.equal(selBox(L_STD), selBox(L_STD, 0, 0));                       // 1×1 brackets unchanged
	const { svg, scene, restore } = makeRenderer();
	try {
		const m = new Model();
		new Renderer(m, svg, { parts: PRODUCT_CANVAS, scene });
		m.put('node', { id: 'node-000001', name: 'r', type: 'router', shape: 'circle', x: 0, y: 0 });
		m.put('node', { id: 'node-000002', name: 'h', type: 'host', shape: 'square', x: 2 * P, y: 0, span: { cols: 3, rows: 2 } });
		const selOf = (id) => svg.byId['#nodes'].children.find((g) => g.attrs.id === id).children.find((c) => c.attrs.class === 'select-box').attrs.d;
		assert.equal(selOf('node-000001'), selBox(L_STD));
		assert.equal(selOf('node-000002'), selBox(L_STD, 2 * P, 1 * P));    // brackets wrap the whole footprint
	} finally { restore(); }
});

// ---- readModel / export span fidelity (RESTATED at H25.5, B378, D4: replaces docToSchema/schemaToDoc round-trip) ----
test('docToSchema/schemaToDoc round-trip span as cell counts; 1×1 stays span-free', () => {
	const doc = { meta: { id: '0000000000000001', name: 'd' }, nodes: [
		{ id: 'node-000003', name: 'p', type: 'host', shape: 'square', x: 2 * P, y: 0, span: { cols: 3, rows: 2 } },
		{ id: 'node-000004', name: 'n', type: 'router', shape: 'circle', x: 0, y: 0 }
	], links: [], zones: [], groups: [] };
	const back = readModel(doc, COMPOSED_KINDS).toJSON();
	assert.deepEqual(back.nodes.find((n) => n.id === 'node-000003').span, { cols: 3, rows: 2 });
	assert.ok(!('span' in back.nodes.find((n) => n.id === 'node-000004')), '1×1 round-trips span-free (byte-identical)');
});

// ---- span-aware occupancy (R13 index) ----
// RESTATED at WD-a (H19.44; WD2 revisited, B323): a wide device occupies its anchor's cell alone -- the index keyed every
// cell its span covers, a rule only the browser tab held; every door now holds one anchor to a point
test('a span node occupies its anchor\'s cell alone; move/resize/del maintain the index', () => {
	const m = new Model(); attachRelations(m, { nearest: NODE_GRID.nearest });
	const n = makeNode(m, 'host', { x: 2 * P, y: 0 }); n.span = { cols: 3, rows: 2 }; m.put('node', n);
	assert.equal(occupiedAt(m, { x: 2 * P, y: 0 }), true, 'its anchor');
	for (const [c, r] of [[3, 0], [4, 0], [2, 1], [3, 1], [4, 1]]) assert.equal(occupiedAt(m, { x: c * P, y: r * P }), false, `covered ${c},${r} free`);

	m.set('node', n.id, { x: 0, y: 0 });                                    // move -> the anchor's cell follows
	assert.equal(occupiedAt(m, { x: 2 * P, y: 0 }), false, 'old anchor cell freed');
	assert.equal(occupiedAt(m, { x: 0, y: 0 }), true, 'new anchor cell occupied');

	m.set('node', n.id, { span: { cols: 1, rows: 1 } });                    // a resize leaves the anchor where it is
	assert.equal(occupiedAt(m, { x: 0, y: 0 }), true, 'anchor still occupied');

	m.del('node', n.id);
	assert.equal(occupiedAt(m, { x: 0, y: 0 }), false, 'del frees it');
});

// ---- server gate ----
test('validateEntity accepts an optional span; rejects malformed; 1×1 (no span) still validates', () => {
	const base = { id: 'node-000005', name: 'p', type: 'host', shape: 'square', x: 2 * P, y: 0 };
	assert.equal(validateEntity('node', { ...base, span: { cols: 3, rows: 2 } }), null);
	assert.equal(validateEntity('node', { ...base, span: { cols: 1, rows: 1 } }), null);
	assert.equal(validateEntity('node', base), null, '1×1 node with no span passes full validation');
	assert.match(validateEntity('node', { ...base, span: { cols: 0, rows: 2 } }), /invalid value for node\.span/);
	assert.match(validateEntity('node', { ...base, span: { cols: 3.5, rows: 2 } }), /invalid value for node\.span/);
	assert.match(validateEntity('node', { ...base, span: { cols: 3, rows: 2, z: 1 } }), /invalid value for node\.span/);
	assert.match(validateEntity('node', { ...base, span: [3, 2] }), /invalid value for node\.span/);
	assert.match(validateEntity('node', { ...base, span: { cols: 200, rows: 2 } }), /invalid value for node\.span/);
});

test('validateDoc accepts a document containing a span node', () => {
	// RESTATED at WD-b1 (H19.45): a document holds its two layouts (tests/fixtures/composed.mjs `heldLayouts`)
	const doc = { meta: { id: '0000000000000000', name: 'd' }, layouts: heldLayouts(),
		nodes: [{ id: 'node-000006', name: 'p', type: 'host', shape: 'square', x: 2 * P, y: 0, span: { cols: 3, rows: 2 } }],
		links: [], zones: [], groups: [] };
	assert.equal(validateDoc(doc), null);
});

// ---- history isolation ----
test('command clone deep-copies span (history never aliases the live span object)', () => {
	const node = { id: 'node-000007', name: 'p', type: 'host', shape: 'square', x: 2 * P, y: 0, span: { cols: 3, rows: 2 } };
	const cmd = createEntity('node', node);
	node.span.cols = 99;                                                    // mutate the live entity
	assert.equal(cmd.entries[0].entity.span.cols, 3, 'the command holds its own span copy');
});

// =====================================================================================================
// W2 — content regions: a node carries content (text|glyph in its socket grid), rendered by the kernel
// (the reversal of "kernel defers labels"). Mode-independent / static; editing is the parked layer.
// =====================================================================================================

// RESTATED at H25.5 (B378, D4): driven through the real export renderer and the real client Renderer
test('a content node renders text/glyph/outline/pill; plain node byte-identical', () => {
	const svg = renderNodeSvg({ id: 'node-000020', name: '', type: 'host', shape: 'square', x: 0, y: 0, span: { cols: 4, rows: 2 }, content: [
		{ at: [0, 0], cols: 1, rows: 1, content: 'text', value: 'name', align: 'left', fill: '#9fb0c0' },
		{ at: [1, 0], cols: 3, rows: 1, content: 'text', value: 'web-tier', align: 'left', outline: true, accent: '#4fc3f7' },
		{ at: [0, 1], cols: 1, rows: 1, content: 'glyph', glyph: 'router' },
		{ at: [1, 1], cols: 3, rows: 1, content: 'text', value: 'online', align: 'center', outline: true, bg: '#aed581', fill: '#101010', rx: 13 }
	] });
	assert.match(svg, /<rect [^>]*class="frame" x="-20" y="-20" width="220" height="100"/);   // the W1 4×2 frame
	assert.ok(svg.includes('>name<') && svg.includes('>web-tier<') && svg.includes('>online<'));
	assert.match(svg, /stroke="#4fc3f7"/);                  // the value outline
	assert.match(svg, /fill="#aed581"[^>]*/);              // the pill fill
	assert.match(svg, /rx="13"/);                          // the pill radius
	assert.ok(svg.includes('#glyph-router'));              // the glyph region
	const plain = renderNodeSvg({ id: 'node-000021', name: '', type: 'router', shape: 'circle', x: 0, y: 0 });
	assert.ok(plain.includes('href="#m-circle"') && plain.includes('#glyph-router'), 'no content ⇒ frame and glyph');
	assert.ok(!plain.includes('class="socket"'), 'and no socket, which is an editing aid');
});

test('W4: the socket grid is gated behind the sockets render opt (off by default — clean export)', () => {
	const panel = { id: 'node-000030', name: '', type: 'host', shape: 'square', x: 0, y: 0, span: { cols: 3, rows: 1 }, content: [{ content: 'text', value: 'x' }] };
	const bare = { id: 'node-000031', name: '', type: 'router', shape: 'circle', x: 240, y: 0 };
	assert.equal((renderNodeSvg(panel).match(/class="socket"/g) || []).length, 0, 'default: no grid (a clean export carries no edit-mode aid)');
	assert.equal((renderNodeSvg(bare).match(/class="socket"/g) || []).length, 0, 'default: a plain node carries no socket either');
	const { svg, scene, restore } = makeRenderer();
	try {
		const m = new Model();
		const r = new Renderer(m, svg, { parts: PRODUCT_CANVAS, scene });
		r.setMode('edit');
		m.put('node', panel);
		m.put('node', bare);
		const socketsIn = (id) => svg.byId['#nodes'].children.find((g) => g.attrs.id === id).children.filter((c) => c.attrs.class === 'socket').length;
		assert.equal(socketsIn('node-000030'), 3, 'edit mode: a 3-cell socket grid');
		assert.equal(socketsIn('node-000031'), 1, 'edit mode: its one socket');
	} finally { restore(); }
});

// =====================================================================================================
// W5 — run mode + clickable buttons: a content region with `action` is a button; in run mode a click on it
// fires a draw:action event the host wires. The render emits a hit rect (data-action); the gate is safe.
// =====================================================================================================

test('W5: a clickable region renders a transparent hit rect with data-action; the action is gated', () => {
	const svg = renderNodeSvg({ id: 'node-000040', name: '', type: 'host', shape: 'square', x: 0, y: 0, span: { cols: 2, rows: 1 }, content: [
		{ at: [0, 0], content: 'text', value: 'Save', outline: true, action: 'diagram-new' },
		{ at: [1, 0], content: 'text', value: 'x' }
	] });
	assert.match(svg, /<rect class="clickable" data-action="diagram-new"[^>]*fill="transparent"\/>/);
	assert.equal((svg.match(/class="clickable"/g) || []).length, 1, 'only the region with an action is clickable');
	const base = { id: 'node-000041', name: 'p', type: 'host', shape: 'square', x: 0, y: 0 };
	// RESTATED (H24.11, B380): any safe action name serves; the one here belonged to a deleted feature
	assert.equal(validateEntity('node', { ...base, content: [{ content: 'text', value: 'x', action: 'diagram-open' }] }), null);
	assert.match(validateEntity('node', { ...base, content: [{ content: 'text', action: 'DROP thing' }] }), /node\.content/, 'unsafe action rejected (not [a-z0-9-])');
});

test('W5: the control-bar buttons carry actions and the document stays valid', () => {
	const doc = controlBarDoc();
	const bar = doc.nodes.find((n) => n.id === 'node-ba0001');
	const actions = bar.content.filter((r) => r.action).map((r) => r.action).sort();
	// RESTATED (H24.11, B380): the fixture's push button went with the deleted feature it pushed to
	assert.deepEqual(actions, ['diagram-del', 'diagram-new', 'diagram-open', 'help']);
	assert.equal(validateDoc(doc), null, 'a control bar with clickable buttons is a valid, persistable document');
});

// =====================================================================================================
// W6 — live input editing: a content region marked input:true is editable; in run mode a click opens an
// inline editor; committing writes the value back into the node's content (setContentValue).
// =====================================================================================================

test('W6: an input region renders a data-input hit rect (with its index); validation gates input', () => {
	const svg = renderNodeSvg({ id: 'node-000050', name: '', type: 'host', shape: 'square', x: 0, y: 0, span: { cols: 3, rows: 1 }, content: [
		{ at: [0, 0], content: 'text', value: 'name', align: 'left' },
		{ at: [1, 0], cols: 2, content: 'text', value: 'v', outline: true, input: true }
	] });
	assert.match(svg, /<rect class="clickable" data-input="" data-idx="1"[^>]*fill="transparent"\/>/);
	const base = { id: 'node-000051', name: 'p', type: 'host', shape: 'square', x: 0, y: 0 };
	assert.equal(validateEntity('node', { ...base, content: [{ content: 'text', value: 'x', input: true }] }), null);
	assert.match(validateEntity('node', { ...base, content: [{ content: 'text', input: 'yes' }] }), /node\.content/, 'input must be boolean');
});

test('W6: setContentValue writes the new value into the region and is history-isolated', () => {
	const m = new Model();
	const n = { id: 'node-000052', name: 'p', type: 'host', shape: 'square', x: 0, y: 0, content: [
		{ at: [0, 0], content: 'text', value: 'a' }, { at: [1, 0], content: 'text', value: 'b', input: true }
	] };
	m.put('node', n);
	const cmd = setContentValue(m, n.id, 1, 'edited');
	assert.equal(cmd.entries[0].after.content[1].value, 'edited');
	assert.equal(cmd.entries[0].after.content[0].value, m.get('node', n.id).content[0].value, 'untouched regions carry through unchanged');
	assert.notEqual(cmd.entries[0].after.content, n.content, 'the snapshot does not alias the live content array');
	assert.equal(n.content[1].value, 'b', 'the live node is untouched until the command applies');
});

test('W6: the control-bar input values are editable (input:true)', () => {
	const doc = controlBarDoc();
	const bar = doc.nodes.find((n) => n.id === 'node-ba0001');
	const inputs = bar.content.filter((r) => r.input).map((r) => r.value).sort();
	// RESTATED (H24.11, B380): the second input held the address of a deleted feature, and went with its mentions
	assert.deepEqual(inputs, ['scene-1']);
	assert.equal(validateDoc(doc), null);
});

// =====================================================================================================
// A1 (authoring arc) — text boxes: makeTextBox builds a node-with-text-content authored on-canvas
// (hold-t + drag). No new entity kind / no server change — it's a node with span + a text region.
// =====================================================================================================

test('a panel\'s corner follows shape (circle→rx=frame.ext, square→rx=frame.r); plain / span-glyph unchanged', () => {
	const fe = L_STD.frame.ext, fr = L_STD.frame.r;
	const c1 = renderNodeSvg({ id: 'node-00d101', name: '', type: 'host', shape: 'circle', x: 0, y: 0, content: [{ content: 'text', value: 'x' }] });
	assert.match(c1, new RegExp(`<rect [^>]*class="frame" x="-20" y="-20" width="40" height="40" rx="${fe}"`), 'a circle (default) 1×1 panel = a 40×40 rect rx=20 (== the circle)');
	const cSq = renderNodeSvg({ id: 'node-00d501', name: '', type: 'host', shape: 'square', x: 0, y: 0, content: [{ content: 'text', value: 'x' }] });
	assert.match(cSq, new RegExp(`<rect [^>]*class="frame"[^>]*rx="${fr}"`), 'a SQUARE panel drops to rx=frame.r (5) — what "s" toggles to');
	const c2 = renderNodeSvg({ id: 'node-00d201', name: '', type: 'host', shape: 'circle', x: 0, y: 0, span: { cols: 3, rows: 2 }, content: [{ content: 'text', value: 'x' }] });
	assert.match(c2, new RegExp(`<rect [^>]*class="frame"[^>]*rx="${fe}"`), 'a multi-cell circle panel rounds to rx=20');
	const spanGlyph = renderNodeSvg({ id: 'node-00d301', name: '', type: 'router', shape: 'circle', x: 0, y: 0, span: { cols: 3, rows: 1 } });
	assert.match(spanGlyph, new RegExp(`<rect [^>]*class="frame"[^>]*rx="${fr}"`), 'a span node with no content keeps rx=frame.r');
	const plain = renderNodeSvg({ id: 'node-00d401', name: '', type: 'router', shape: 'circle', x: 0, y: 0 });
	assert.ok(plain.includes('href="#m-circle"') && !plain.includes('class="frame"'), 'a 1×1 plain node uses the frame def');
});

test('reshapeNodes toggles node frame shape (circle<->square), undoable-shaped, skips non-nodes', () => {
	const m = new Model();
	const a = { id: 'node-00aa01', name: '', type: 'router', shape: 'circle', x: 0, y: 0 };
	const b = { id: 'node-00bb01', name: '', type: 'host', shape: 'square', x: 60, y: 0 };
	m.put('node', a); m.put('node', b);
	const cmd = reshapeNodes(m, [a.id, b.id, 'zone-00cc01']);   // the non-node id is skipped
	assert.equal(cmd.entries.length, 2, 'only the two nodes');
	const ea = cmd.entries.find((e) => e.id === a.id), eb = cmd.entries.find((e) => e.id === b.id);
	// forward intent only — the inverse is the server's to derive from the pre-state
	assert.deepEqual(ea.after, { shape: 'square' }, 'circle toggles to square');
	assert.deepEqual(eb.after, { shape: 'circle' }, 'square toggles to circle');
	assert.equal('before' in ea, false, 'no entry carries a before-state any more');
});

test('span-aware group hull: the hull encloses a multi-cell member\'s full footprint (not just its anchor)', () => {
	const svg = renderNodesSvg([
		{ id: 'node-0000a1', name: 'a', type: 'host', shape: 'square', x: 0, y: 0 },
		{ id: 'node-0000a2', name: 'b', type: 'host', shape: 'square', x: 3 * P, y: 0, span: { cols: 3, rows: 2 } },
	], { groups: [{ id: 'group-0000c1', name: 'g', members: ['node-0000a1', 'node-0000a2'] }] });
	const m = svg.match(/<rect class="group-hull"[^>]*x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"/);
	const [, x, y, w, h] = m.map(Number);
	const ge = L_STD.group.ext;
	assert.ok(x + w >= 5 * P + ge, 'right edge covers the span member’s far cell (300 + ext)');
	assert.ok(y + h >= 1 * P + ge, 'bottom edge covers the span member’s far row (60 + ext)');
	assert.ok(x + w > 3 * P + ge + 1, 'the hull reaches past the old anchor-only edge (180 + ext)');
});

test('A1: makeTextBox builds a valid text-box node (span + a single text region); renders via W1/W2', () => {
	const m = new Model();
	const tb = makeTextBox(m, { x: 0, y: 0 }, { cols: 3, rows: 2 });
	assert.deepEqual(tb.span, { cols: 3, rows: 2 });
	assert.equal(tb.content.length, 1);
	assert.equal(tb.content[0].content, 'text');
	assert.deepEqual(tb.content[0].at, [0, 0]);
	assert.equal(tb.content[0].cols, 3);
	assert.equal(validateEntity('node', tb), null, 'a text box passes the server gate (no new validator needed)');
	const svg = renderNodeSvg({ ...tb, content: [{ ...tb.content[0], value: 'hello' }] });
	assert.match(svg, /data-span="3x2".*<rect [^>]*class="frame" x="-20" y="-20" width="160" height="100"/, 'a 3-cell-wide footprint');
	assert.ok(svg.includes('>hello<'), 'the text region renders through the production path');
});

test('renderContentRegion escapes text and wraps a multi-row region into a paragraph', () => {
	const regionSvg = (r) => renderNodeSvg({ id: 'node-000090', name: '', type: 'text', shape: 'square', x: 0, y: 0, span: { cols: 3, rows: 3 }, content: [r] });
	assert.ok(regionSvg({ content: 'text', value: '<b>&x' }).includes('&lt;b&gt;&amp;x'), 'XSS-safe text');
	const single = regionSvg({ at: [0, 0], cols: 1, rows: 1, content: 'text', value: 'hi', align: 'left' });
	assert.match(single, /text-anchor="start"/);
	assert.equal((single.match(/<text/g) || []).length, 1, 'single row ⇒ one line');
	const para = regionSvg({ at: [0, 0], cols: 2, rows: 2, content: 'text', value: 'one two three four five six seven' });
	assert.ok((para.match(/<text/g) || []).length >= 2, 'multi-row ⇒ wraps into multiple lines');
});

test('docToSchema/schemaToDoc round-trip content regions (node-local, unchanged)', () => {
	const content = [{ at: [0, 0], cols: 1, rows: 1, content: 'text', value: 'name', align: 'left' }, { at: [1, 0], cols: 3, rows: 1, content: 'text', value: 'r1', outline: true }];
	const doc = { meta: { id: '0000000000000001', name: 'd' }, nodes: [{ id: 'node-000022', name: 'p', type: 'host', shape: 'square', x: 0, y: 0, span: { cols: 4, rows: 1 }, content }], links: [], zones: [], groups: [] };
	const back = readModel(doc, COMPOSED_KINDS).toJSON();
	assert.deepEqual(back.nodes[0].content, content);
});

test('validateEntity gates content regions (accepts valid; rejects malformed; plain node still valid)', () => {
	const base = { id: 'node-000023', name: 'p', type: 'host', shape: 'square', x: 0, y: 0 };
	assert.equal(validateEntity('node', { ...base, content: [{ content: 'text', value: 'hi', align: 'left' }] }), null);
	assert.equal(validateEntity('node', { ...base, content: [{ content: 'glyph', glyph: 'router', at: [1, 0], cols: 1, rows: 1 }] }), null);
	assert.equal(validateEntity('node', { ...base, content: [{ content: 'text', value: 'x', outline: true, bg: '#aed581', rx: 13 }] }), null);
	assert.equal(validateEntity('node', base), null, 'no content ⇒ still valid (1×1 plain node)');
	assert.match(validateEntity('node', { ...base, content: [{ content: 'bogus' }] }), /invalid value for node\.content/);
	assert.match(validateEntity('node', { ...base, content: [{ content: 'text', bg: 'red' }] }), /node\.content/, 'non-hex colour rejected');
	assert.match(validateEntity('node', { ...base, content: [{ content: 'glyph', glyph: 'BAD!' }] }), /node\.content/, 'unsafe glyph rejected');
	assert.match(validateEntity('node', { ...base, content: [{ content: 'text', align: 'middle' }] }), /node\.content/, 'bad align rejected');
	assert.match(validateEntity('node', { ...base, content: [{ content: 'text', zzz: 1 }] }), /node\.content/, 'unknown region key rejected');
	assert.match(validateEntity('node', { ...base, content: 'nope' }), /node\.content/, 'content must be an array');
});

test('command clone deep-copies content (history never aliases regions)', () => {
	const node = { id: 'node-000024', name: 'p', type: 'host', shape: 'square', x: 0, y: 0, content: [{ at: [1, 0], content: 'text', value: 'hi' }] };
	const cmd = createEntity('node', node);
	node.content[0].value = 'X'; node.content[0].at[0] = 9;                  // mutate the live entity
	assert.equal(cmd.entries[0].entity.content[0].value, 'hi');
	assert.equal(cmd.entries[0].entity.content[0].at[0], 1, 'the region offset array is its own copy');
});

// =====================================================================================================
// W3 — panel / control-bar AS a diagram: a COMPOSITION of W1 (span) + W2 (content), no new primitives.
// The control bar document, rendered through the production path (docToSchema → kernel resolve/render).
// =====================================================================================================

test('W3: the control bar is ONE panel + content regions, rendered by the real kernel', () => {
	const doc = controlBarDoc();
	const bar = doc.nodes.find((n) => n.id === 'node-ba0001');
	assert.deepEqual(bar.span, { cols: 24, rows: 1 }, 'ONE panel (the locked control-bar decision)');
	// RESTATED (H24.11, B380): 8 regions, the three of a deleted feature's cluster gone with its mentions
	assert.equal(bar.content.length, 8, 'the 8 #menu controls as content regions');
	assert.equal(validateEntity('node', bar), null, 'the bar node passes the server gate');
	assert.equal(validateDoc(doc), null, 'the whole control-bar document is valid (real, persistable)');
	// production render path: server/svg.mjs svgDocument
	const svg = groupSvg(svgDocument(doc).split('</defs>').pop(), 'node-ba0001');
	assert.match(svg, /data-span="24x1"/, '24-cell wide footprint');
	assert.match(svg, /<rect [^>]*class="frame" x="-20" y="-20" width="1420"/);   // 24 cols: 23·60 + 40
	for (const v of ['draw', 'scene-1', 'open ▾', 'online']) assert.ok(svg.includes('>' + v + '<'), `renders "${v}"`);
	assert.match(svg, /rx="13"/);                          // the status pill
	assert.match(svg, /fill="#aed581"/);                  // brand text / pill fill
});

/*
B38 — the kernel's element vocabulary has no dead kinds.

`geometry.mjs` exported a `link` element (`{kind:'link', x1,y1,x2,y2}`) that **nothing anywhere
constructed**: `resolve()` emits node, waypoint, zone, group and path, never link. Four consumers
handled the kind regardless — two in the renderer, two in the GRC — and `wire` existed for the sole
purpose of unifying a LIVE kind (`path`) with a DEAD one so the rule-checkers could iterate both.

A straight line is a two-point path, so nothing was lost by deleting it, and deleting it frees the
word `link` to mean exactly one thing: the document entity. That was the only genuine cross-layer
name collision in the system (HIERARCHY §0, connection taxonomy).

This asserts the property rather than the absence, so a NEW dead kind fails the same way.
*/
// RESTATED at H25.5 (B378, D4): with the old scene renderer retired, the kernel's renderer and geometry modules branch on no
// element `kind` at all -- each plugin's painter draws its own kind
test('B38: every element kind the kernel handles is a kind resolve() can emit', () => {
	const src = fs.readFileSync('kernel/renderer.mjs', 'utf8') + fs.readFileSync('kernel/geometry.mjs', 'utf8');
	const handled = [...src.matchAll(/kind === '(\w+)'/g)].map((m) => m[1]);
	assert.deepEqual(handled, [], 'the kernel branches on no element kind');
});

test('B38: a straight connection is a two-point path — no separate element kind needed', () => {
	const svg = renderNodesSvg([
		{ id: 'node-000001', name: 'a', type: 'host', shape: 'circle', x: 0, y: 0 },
		{ id: 'node-000002', name: 'b', type: 'host', shape: 'circle', x: 2 * P, y: 0 },
	], { links: [{ id: 'link-000001', name: 'l', src: 'node-000001', dst: 'node-000002' }] });
	assert.match(svg, /<g id="link-000001"><path d="M0 0 L120 0" class="link"/, 'straight: a two-point path');
	assert.doesNotMatch(svg, /<line\b/, 'and no separate line element');
});

/*
The visual decisions have one home, so the two renderers cannot disagree about them.

There are two renderers deliberately -- the kernel emits strings for headless export, the client
reconciles DOM incrementally so a drag does not rebuild the scene -- and their EMISSION cannot
reasonably be shared. Their RULES can be, and were not: the same three judgements were written
twice, and the socket one drifted far enough that every exported SVG carried an editing aid.

scan-twins could not have caught it. It looks for shared ARITHMETIC, and the arithmetic was already
shared; what was duplicated is which element exists and when.
*/
test('W4: isPanel, frameRadius and showsSockets are the single home of each decision', () => {
	const panel = { content: [{ content: 'text', value: 'x' }], frame: 'circle' };
	const square = { content: [{ content: 'text', value: 'x' }], frame: 'square' };
	const plain = { glyph: 'router' };

	assert.equal(isPanel(panel), true);
	assert.equal(isPanel(plain), false);
	assert.equal(isPanel(undefined), false, 'a missing entity is not a panel, rather than a crash');

	// a panel's corner follows its shape; a plain node always takes the sharp radius
	assert.equal(frameRadius(panel, L_STD), L_STD.frame.ext);
	assert.equal(frameRadius(square, L_STD), L_STD.frame.r);
	assert.equal(frameRadius(plain, L_STD), L_STD.frame.r);

	// the client says yes by being in edit mode, the exporter by passing the opt -- one rule
	assert.equal(showsSockets({}), false, 'a clean export carries no editing aid');
	assert.equal(showsSockets({ sockets: true }), true);
});

test('W4: both node shapes obey showsSockets, which is what drifted', () => {
	const mk = (extra) => ({ id: 'node-000032', name: '', type: 'router', shape: 'circle', x: 0, y: 0, ...extra });
	for (const [what, node] of [['plain', mk({})], ['panel', mk({ content: [{ content: 'text', value: 'x' }] })]]) {
		assert.equal(/class="socket"/.test(renderNodeSvg(node)), false, `${what}: none by default`);
		const { svg, scene, restore } = makeRenderer();
		try {
			const m = new Model(), r = new Renderer(m, svg, { parts: PRODUCT_CANVAS, scene });
			r.setMode('edit');
			m.put('node', node);
			assert.equal(svg.byId['#nodes'].children.find((g) => g.attrs.id === 'node-000032').children.some((c) => c.attrs.class === 'socket'), true, `${what}: shown when asked`);
		} finally { restore(); }
	}
});

/*
B162 -- a waypoint's ROLE is derived in the kernel, so both renderers agree without either
restating the rule.

A bend is a light ring: the path turns here. An endpoint is a copper-trace pad -- a heavy ring in
the link colour, near the weight of the path, because a line TERMINATES here rather than passing
through. The engine reads the role off `schema.relations`, which the live canvas and the SVG export
both resolve, so neither has to know the rule.

Nothing is stored. Closing a path changes how its corners draw because a ring HAS no ends, and that
falls out of the derivation rather than out of a rewrite.
*/
test('B162: the kernel derives bend from endpoint, and closing a path flips it', async () => {
	const doc = (closed) => ({
		meta: { id: '0000000000aa0001', name: 't' },
		nodes: [{ id: 'node-aa0001', type: 'host', x: 0, y: 0, name: 'a' }, { id: 'node-ea0001', name: 'node-ea0001', x: 120, y: 0 }, { id: 'node-ea0002', name: 'node-ea0002', x: 60, y: 60 }],
		links: [{ id: 'link-aa0001', name: 'link-aa0001', src: 'node-aa0001', dst: 'node-ea0001', via: ['node-ea0002'], closed }],
		zones: [], groups: [],
	});
	const roles = (d) => [...svgDocument(d).matchAll(/class="waypoint (\w+)"/g)].map((m) => m[1]);

	assert.deepEqual(roles(doc(false)), ['endpoint', 'bend'], 'a terminal is an endpoint, a via is a bend');
	assert.deepEqual(roles(doc(true)), ['bend', 'bend'], 'and a RING has no ends — both are corners');
});

test('B199: every waypoint draws the anchor, and an endpoint adds a pad inside it', async () => {
	const { waypointStyle } = await import('../plugins/network/appearance.mjs');
	const svg = svgDocument({
		meta: { id: '0000000000aa0001', name: 't' },
		nodes: [{ id: 'node-aa0001', type: 'host', x: 0, y: 0, name: 'a' }, { id: 'node-ea0001', name: 'node-ea0001', x: 120, y: 0 }, { id: 'node-ea0002', name: 'node-ea0002', x: 60, y: 60 }],
		links: [{ id: 'link-aa0001', name: 'link-aa0001', src: 'node-aa0001', dst: 'node-ea0001', via: ['node-ea0002'] }],
		zones: [], groups: [],
	});
	/*
	AMENDED 2026-10-04 (R-c, H18.21; H2 refined): the export draws the RUN PICTURE, which leaves out the anchor ring and a bend's
	dot (kernel RUN_PICTURE). So the export is held to that, and the whole composition -- what the canvas draws while
	authoring -- is read from the one layer list both renderers walk.
	*/
	const exported = Object.fromEntries([...svg.matchAll(/class="waypoint (\w+)">(.*?)<\/g>/g)].map(([, role, body]) => [role, [...body.matchAll(/<circle[^>]*?r="([\d.]+)"/g)].map((m) => Number(m[1]))]));
	const { waypointLayers } = await import('../plugins/network/appearance.mjs');
	assert.deepEqual(exported.bend, [], 'the export draws nothing at a bend: the corner is in the path');
	assert.deepEqual(exported.endpoint, waypointLayers(['endpoint'], 20, null, null, { run: true }).map((l) => l.radius), 'and an endpoint as the run picture has it');
	assert.ok(!exported.endpoint.includes(20), 'with no anchor ring');
	// the authoring composition, from the layer list the canvas walks
	const circlesOf = (roles) => waypointLayers(roles, 20).map((l) => ({ r: l.radius, w: l.width ?? 0 }));
	const end = { circles: circlesOf(['endpoint']) }, bend = { circles: circlesOf([]) };

	/*
	A BEND IS ITS ANCHOR. It adds no layer, so it draws exactly two circles: the ring at the extent
	and the centre dot. An endpoint draws three -- the same anchor, its pad, and the dot.
	*/
	assert.equal(bend.circles.length, 2, 'a bend is the anchor and the dot, nothing more');
	assert.equal(end.circles.length, 3, 'an endpoint adds a pad on top of the anchor');

	const anchorOf = (g) => g.circles.find((c) => c.r === 20);
	assert.ok(anchorOf(bend), 'the bend draws the anchor ring at the extent');
	assert.ok(anchorOf(end), 'the ENDPOINT draws the anchor too -- this is the whole point of B199');
	assert.deepEqual(anchorOf(end), anchorOf(bend), 'and it is the same anchor, not a similar one');

	const pad = end.circles.find((c) => c.r === waypointStyle('endpoint', 20).radius);
	assert.ok(pad, 'the endpoint pad is drawn');
	assert.ok(pad.w > anchorOf(end).w * 2, 'the pad is far heavier -- a line terminates on it');

	/*
	THE PAD MUST CLEAR THE ANCHOR. A stroke straddles its radius, so the pad's ink reaches
	`r + w/2` and the anchor's inner ink edge is `20 - 1.6/2 = 19.2`. The pad used to end at exactly
	20.0, which is INSIDE that band -- reinstating the anchor without moving the pad would have
	fused them into one smudged ring, which is why the two numbers are coupled.
	*/
	const clearance = (20 - anchorOf(end).w / 2) - (pad.r + pad.w / 2);
	assert.ok(clearance > 1, `the pad must leave clear ground inside the anchor, got ${clearance}`);
});

/*
B162 -- the bend/endpoint rule has ONE definition, and both renderers call it.

The live editor and the SVG export are deliberately separate renderers (B28): one keeps addressable
DOM for a person editing, the other produces a finished document. What must not differ is the RULE,
and it did -- the role landed in `resolve()`, which only the export walks, so the download drew
endpoints correctly while the canvas drew everything as a bend. Checking the export said it worked.

This is the twin guard: if either renderer grows its own copy of the rule, or stops calling the
shared one, this fails.
*/
test('B162: one rule, consumed by the client renderer and the kernel alike', async () => {
	const { waypointRole } = await import('../plugins/network/roles.mjs');
	assert.equal(typeof waypointRole, 'function', 'the rule is exported from the kernel');

	// the four cases, asserted on the rule itself rather than through either renderer
	const open = [{ src: 'w1', dst: 'w2', via: ['w3'], closed: false }];
	const ring = [{ src: 'w1', dst: 'w2', via: ['w3'], closed: true }];
	assert.equal(waypointRole('w1', open), 'endpoint', 'a terminal on an open path');
	assert.equal(waypointRole('w3', open), 'bend', 'a via is a corner');
	assert.equal(waypointRole('w1', ring), 'bend', 'a RING has no ends');
	assert.equal(waypointRole('w9', []), 'bend', 'and an orphan draws plainly');

	/*
	Both renderers must ASK for the role rather than decide it.

	Asserted as the positive only. My first attempt also tried to catch a re-derivation by pattern,
	and matched the client's own `endpoint ? 'endpoint' : 'bend'` -- which is naming a CSS class, not
	deciding a rule. A heuristic that cannot tell labelling from logic reports the correct code as
	the defect, which is worse than not checking.

	What the negative guard cannot do, the shared function does structurally: there is one
	`waypointRole`, and a renderer that stopped calling it would fail the assertion below.
	*/
	// RESTATED at C-a (H19.29, D3): the anchor's drawing is the plugins' appearances now -- the network's marks, the devices plugin's device
	const client = fs.readFileSync(new URL('../plugins/network/anchor-appearance.mjs', import.meta.url), 'utf8');
	// RESTATED at H25.5 (B378, D4): the export drives the real Renderer over the same parts (server/svg.mjs), and waypointRolesIn
	// in plugins/network/roles.mjs delegates to waypointRoles
	const rolesMod = fs.readFileSync(new URL('../plugins/network/roles.mjs', import.meta.url), 'utf8');

	/*
	B166 settled the vocabulary this used to need translating.

	The renderer once mapped the model's `src`/`dst`/`closed` into a kernel that said
	`from`/`to`/`close`. That translation existed twice, and `close` versus `closed` failed
	silently -- a wrong guess is undefined, undefined is falsy, so a ring reported ends and simply
	drew wrong. The kernel now speaks one vocabulary and both adapters are gone, so a model link
	goes straight to the rule.

	The PROPERTY asserted is unchanged and is the only thing that ever mattered: both renderers ASK
	for the role rather than deciding it.
	*/
	// B277: the live renderer asks through `waypointRolesIn`, the same rule handed its model, so the anchor's transit is read
	assert.match(client, /waypointRolesIn\(/, 'the live renderer asks for the role SET (B209), in its model (B277)');
	assert.match(rolesMod, /waypointRoles\(/, 'which delegates to waypointRoles');

	// B166 -- a model link is accepted by the rule DIRECTLY, with nothing translating on the way
	assert.equal(waypointRole('w1', [{ src: 'w1', dst: 'w2', via: ['w3'], closed: false }]), 'endpoint');
	assert.equal(waypointRole('w1', [{ src: 'w1', dst: 'w2', via: ['w3'], closed: true }]), 'bend', 'a ring still has no ends');

	// and no translation may reappear anywhere -- this is the whole point of the unification
	for (const [label, src] of [['renderer', client], ['network roles', rolesMod]]) {
		assert.doesNotMatch(src, /from:\s*\w+\.src/, `${label} must not re-introduce the mapping`);
	}
});

/*
B162 -- a link change redraws its waypoints, on BOTH the create and the update path.

A waypoint's role is derived from the links touching it, so creating or re-routing a link changes
how its terminals draw. The renderer only rewrote the link's own path, so a waypoint kept whatever
ring it was first drawn with.

Invisible on a fresh load -- every link already exists and the initial render is right -- so the
export looked correct and so did any reloaded page. It only showed while AUTHORING: place a
waypoint, link to it, and nothing redrew it. That is what the director hit, twice.

And fixing only `update` left the common case broken: a NEW link is exactly what turns a lone
waypoint into an endpoint, and a new link goes through `render`. Both call the same helper now.
*/
test('B162/B218: create, update AND delete refresh a link\'s waypoints', () => {
	// RESTATED at C-a step four (H19.29): the link is drawn by the network's painter now (plugins/network/link-painter.mjs): the painter names the waypoints to
	// redraw once (`redraws`), and the renderer runs a painter's redraws from create, update AND delete -- what this counted as three
	// call sites of one helper
	const painter = fs.readFileSync(new URL('../plugins/network/link-painter.mjs', import.meta.url), 'utf8');
	const renderer = fs.readFileSync(new URL('../app/src/renderer.js', import.meta.url), 'utf8');
	assert.equal((renderer.match(/this\.redrawAfter\(kind, entity\)/g) || []).length, 3, 'render(), update() and the del branch must ALL refresh');
	assert.match(renderer, /this\.remove\(entity\.id\);\n\t\t\tthis\.redrawAfter\(kind, entity\);/, 'the delete branch refreshes from the DELETED entity -- the model no longer knows what it touched');
	// it must cover every role a waypoint can hold on a link, or one of them stays stale
	const body = painter.slice(painter.indexOf('	redraws: (link'));
	assert.match(body.slice(0, 400), /link\.src/, 'a src terminal');
	assert.match(body.slice(0, 400), /link\.dst/, 'a dst terminal');
	assert.match(body.slice(0, 400), /link\.via/, 'and the bends');
});

test('B162: an endpoint is opaque so the path terminates on it, a bend stays hollow', async () => {
	const { waypointAnchor, waypointStyle } = await import('../plugins/network/appearance.mjs');
	const svg = svgDocument({
		meta: { id: '0000000000aa0001', name: 't' },
		nodes: [{ id: 'node-aa0001', type: 'host', x: -240, y: 0, name: 'a' }, { id: 'node-ea0001', name: 'node-ea0001', x: 120, y: 0 }, { id: 'node-ea0002', name: 'node-ea0002', x: 0, y: -120 }],
		links: [{ id: 'link-aa0001', name: 'link-aa0001', src: 'node-aa0001', dst: 'node-ea0001', via: ['node-ea0002'] }],
		zones: [], groups: [],
	});
	/*
	B199 -- read the LAST ring in the group, not the first. Every waypoint now opens with the anchor,
	which is hollow by definition, so matching the first circle reported `none` for both roles and
	said the pad had stopped being opaque when it had not moved at all.
	*/
	/*
	B200 -- ask for the ring by RADIUS, not by position. "The last ring" was a fair reading of the
	sub-type layer while an endpoint drew one, and it silently started reporting the preview junction
	the moment a second layer stacked on top. The radius comes from the kernel, so this names the pad
	itself rather than wherever it happens to sit in the group.
	*/
	const want = { endpoint: waypointStyle('endpoint', 20).radius, bend: waypointAnchor(20).radius };
	const fills = Object.fromEntries([...svg.matchAll(/class="waypoint (\w+)">(.*?)<\/g>/g)].map(([, role, body]) => {
		const ring = [...body.matchAll(/<circle[^>]*?r="([\d.]+)"[^>]*?fill="([^"]*)"[^>]*?\/>/g)]
			.find((m) => Number(m[1]) === want[role]);
		return [role, ring?.[2]];
	}));
	// AMENDED 2026-10-04 (R-c): the export draws the run picture, where a bend draws nothing at all; while authoring, the
	// canvas draws it as its anchor, read from the one layer list the canvas walks
	const { waypointLayers } = await import('../plugins/network/appearance.mjs');
	assert.equal(fills.bend, undefined, 'the export draws no ring at a bend');
	fills.bend = waypointLayers([], 20).find((l) => l.radius === want.bend).fill;
	/*
	The pad hides the trace beneath it, which is what makes a line read as TERMINATING rather than
	passing under. A bend must stay hollow for the opposite reason: the path goes through it and has
	to be visible doing so. `TOKENS.panel` is the theme's own "canvas / opaque-centre fill", already
	used by the `junction` element for exactly this.
	*/
	assert.equal(fills.endpoint, '#101010', 'the endpoint is filled with the canvas colour');
	assert.equal(fills.bend, 'none', 'and the bend is not filled at all');
});

/*
B162 -- the waypoint's STYLE has one owner, as its ROLE does.

`waypointRole` fixed the rule and left the drawing duplicated: both renderers had inlined the same
four decisions -- stroke weight, radius, fill, opacity. Change the pad weight in one and the canvas
and the export diverge in silence, which is exactly the failure this pair produced twice while it
was being built.

Not a new idea. `L_STD`, `TOKENS`, `contentLayout`, `groupHull` and `roundedPath` already work this
way and the client imports every one of them: the kernel owns the numbers, each renderer owns only
its emission. The waypoint style was the outlier.
*/
test('B162: the waypoint style has one owner, and neither renderer restates it', async () => {
	const { waypointAnchor, waypointStyle } = await import('../plugins/network/appearance.mjs');
	const end = waypointStyle('endpoint', 20);
	const bend = waypointStyle('bend', 20);

	const anchor = waypointAnchor(20);

	assert.ok(end.width > bend.width * 2, 'a pad is far heavier than a corner');
	assert.equal(end.fill, '#101010', 'opaque, so the path terminates on it');
	assert.equal(bend.fill, 'none', 'hollow, so the path stays visible turning');

	/*
	B199 -- a bend IS the anchor, value for value. That is not a coincidence worth asserting for its
	own sake: it is what makes "a bend adds no layer" true rather than approximately true, and if
	the two ever diverge one of them has quietly become a sub-type nobody named.
	*/
	assert.deepEqual(bend, anchor, 'a bend is exactly the anchor, with nothing added');
	assert.ok(end.radius + end.width / 2 < anchor.radius - anchor.width / 2,
		'the pad must sit clear INSIDE the anchor rather than on top of its ink');

	/*
	The guard that matters: neither renderer may decide these again. A second copy would pass every
	behavioural test in this file -- both would be correct on the day it was written -- and then
	drift the first time one side changed.
	*/
	// RESTATED at H25.5 (B378, D4): both the canvas and the export draw through plugins/network/anchor-appearance.mjs
	for (const f of ['../plugins/network/anchor-appearance.mjs']) {
		const src = fs.readFileSync(new URL(f, import.meta.url), 'utf8');
		assert.match(src, /waypointLayers\(/, `${f} must ASK for the layer list (B209), not restate which role draws what`);
		assert.doesNotMatch(src, /endpoint\s*\?\s*5\s*:\s*1\.6/, `${f} restates the stroke weight`);
		assert.doesNotMatch(src, /endpoint\s*\?\s*1\s*:\s*0\.7/, `${f} restates the opacity`);
		assert.doesNotMatch(src, /endpoint\s*\?\s*TOKENS\.panel/, `${f} restates the fill`);
	}
});

test('B162: the two renderers agree, value for value', async () => {
	const { waypointAnchor, waypointStyle } = await import('../plugins/network/appearance.mjs');
	// what the export emits, parsed back out of the SVG it produced
	const svg = svgDocument({
		meta: { id: '0000000000aa0001', name: 't' },
		nodes: [{ id: 'node-aa0001', type: 'host', x: -240, y: 0, name: 'a' }, { id: 'node-ea0001', name: 'node-ea0001', x: 120, y: 0 }, { id: 'node-ea0002', name: 'node-ea0002', x: 0, y: -120 }],
		links: [{ id: 'link-aa0001', name: 'link-aa0001', src: 'node-aa0001', dst: 'node-ea0001', via: ['node-ea0002'] }],
		zones: [], groups: [],
	}).split('</defs>').pop();
	/*
	B199 -- the SUB-TYPE layer is the last ring in the group, because the anchor is drawn first for
	every role. Matching the first circle compared the export's anchor against the kernel's endpoint
	style and failed on a change that had kept both sides in perfect agreement.
	*/
	const target = { endpoint: waypointStyle('endpoint', 20).radius, bend: waypointAnchor(20).radius };
	const drawn = Object.fromEntries([...svg.matchAll(/class="waypoint (\w+)">(.*?)<\/g>/g)].map(([, role, body]) => {
		// B200 -- by radius, not by position: a stacked preview layer made "last" the wrong ring
		const m = [...body.matchAll(/<circle[^>]*?r="([\d.]+)" fill="([^"]*)"[^>]*?stroke-width="([\d.]+)" stroke-opacity="([\d.]+)"[^>]*?\/>/g)]
			.find((x) => Number(x[1]) === target[role]);
		return [role, m && { radius: Number(m[1]), fill: m[2], width: Number(m[3]), opacity: Number(m[4]) }];
	}));

	/*
	AMENDED 2026-10-04 (R-c, H18.21; H2 refined): the export draws the run picture -- no anchor ring, nothing at a bend -- so the
	anchor is not in it to compare; the canvas and the export are held to the same run picture by tests/run-picture.test.js.
	*/
	assert.equal(drawn.bend, undefined, 'the export draws no ring at a bend');
	assert.equal([...svg.matchAll(new RegExp(`r="${waypointAnchor(20).radius}"`, 'g'))].length, 0, 'nor any anchor ring');

	// the live renderer sets exactly these attributes from the same call, so comparing the export
	// against the shared source proves both sides emit one set of numbers
	assert.deepEqual(drawn.endpoint, waypointStyle('endpoint', 20), 'endpoint is drawn as the kernel specifies');
});

/*
B200 -- the layers are a nested ladder of whole numbers, and the dot belongs to the GRID.

Two rules, and the second is the one with teeth.

The ladder: every layer is a concentric ring, strictly nested, with clear ground between each band
of INK -- edge to edge, not centre to centre, because a stroke straddles its radius. The gaps are
3.5 / 3.0 / 2.5 rather than uniform. That is deliberate: the director chose whole radii and widths
and let the gaps absorb the remainder, after the three candidates were rendered at 1:1 and the
difference judged imperceptible at canvas scale. Asserting uniformity here would re-impose the
constraint that was just traded away, so what is asserted is nesting and legibility.

The dot: a waypoint does not own its centre dot, it HIGHLIGHTS the grid dot underneath. Same
radius, brighter fill. This is checked by reading `app/src/main.js`, which draws the node grid,
because the alternative is two literals that agree until one is tuned -- and that had already
happened three times over, with `DOT_RADIUS` feeding the ladder while both renderers painted a
hardcoded 2.2 that nothing could see.
*/
test('B200: the waypoint layers nest, on whole numbers, with the grid dot at the centre', async () => {
	const { gridDot } = await import('../kernel/geometry.mjs');
	const { waypointAnchor, waypointJunction, waypointStyle } = await import('../plugins/network/appearance.mjs');

	/*
	The junction rung is RESERVED rather than exported -- nothing draws it yet, and an export with no
	consumer is what scan-dead rejects. Its numbers are still load-bearing: the whole-number scheme
	depends on 7/3 fitting between the dot and the pad, so the reservation is read from the kernel
	source and checked in place. If it is ever deleted as unused, this fails and says why.
	*/
	/*
	The junction rung is RESERVED rather than exported -- nothing draws it, and an export with no
	consumer is what scan-dead rejects. Its numbers stay load-bearing: the whole-number scheme
	depends on 7/3 fitting between the dot and the pad, and the clearances either side were chosen
	against it. Read from source, so deleting it as unused fails here and says which layer lost its
	geometry.
	*/
	// B209 -- the rung is a drawn layer now, not a reservation read out of source text
	const junction = waypointJunction();

	const bands = [
		['dot', 0, gridDot().radius],
		...[['junction', junction], ['endpoint', waypointStyle('endpoint', 20)], ['anchor', waypointAnchor(20)]]
			.map(([name, st]) => [name, st.radius - st.width / 2, st.radius + st.width / 2]),
	];

	for (let i = 1; i < bands.length; i++) {
		const gap = bands[i][1] - bands[i - 1][2];
		assert.ok(gap > 0, `${bands[i][0]} overlaps ${bands[i - 1][0]}: ink starts at ${bands[i][1]}, previous ends ${bands[i - 1][2]}`);
		assert.ok(gap >= 2, `${bands[i][0]} is only ${gap}px clear of ${bands[i - 1][0]} -- too close to read as separate rings`);
	}

	// whole numbers were the point of the exercise; fractions are how the old ladder got 6.7 and 13.7
	for (const [name, st] of [['junction', junction], ['endpoint', waypointStyle('endpoint', 20)], ['anchor', waypointAnchor(20)]]) {
		assert.equal(st.radius % 1, 0, `${name} radius ${st.radius} is not a whole number`);
		assert.equal(st.width % 1, 0, `${name} width ${st.width} is not a whole number`);
	}
	assert.equal(gridDot().radius % 1, 0, 'the grid dot radius is not a whole number');

	/*
	WEIGHT CARRIES MEANING. A heavy ring says a line terminates here; the equal-weight variant was
	rejected for making the junction and the endpoint read as peers.
	*/
	assert.ok(waypointStyle('endpoint', 20).width > junction.width,
		'the endpoint pad must stay heavier than the junction ring');
});

test('B200: the node grid and the waypoint centre are one dot, from one source', async () => {
	const { gridDot } = await import('../kernel/geometry.mjs');
	// K8: the grid is drawn by the one canvas composition (app/src/compose-canvas.js), for the product page and the lab
	// RESTATED at C-e step thirteen (H19.33): it draws each part's declared grid -- the anchor grid is the product's, declared
	// with its dot in product/canvas.mjs, which is where the radius is now read
	// RESTATED at WD-b2 (H19.46): both grids are the layouts plugin's, its node grid's dot declared in plugins/layouts/layout-canvas.mjs
	const main = fs.readFileSync(new URL('../plugins/layouts/layout-canvas.mjs', import.meta.url), 'utf8');
	// RESTATED at C-a (H19.29, D3): the anchor's drawing is the plugins' appearances now -- the network's marks, the devices plugin's device
	const renderer = fs.readFileSync(new URL('../plugins/network/anchor-appearance.mjs', import.meta.url), 'utf8');
	// RESTATED at H25.5 (B378, D4): server/svg.mjs drives the real Renderer over PRODUCT_CANVAS, which includes plugins/network/anchor-appearance.mjs
	const exportDoor = fs.readFileSync(new URL('../server/svg.mjs', import.meta.url), 'utf8');

	assert.match(main, /gridDot\(\)\.radius/, 'the node grid must draw the kernel dot, not a literal of its own');
	assert.match(renderer, /waypointLayers\(/, 'the waypoint centre comes from the kernel layer list');
	// RESTATED at H26.4 (dev/design/components/VECTOR-SCENE.md appendix B): over the scene it opens with no root, the root being none
	assert.match(exportDoor, /new Renderer\(model, null, \{ parts: PRODUCT_CANVAS, scene \}\)/, 'the SVG export drives the same Renderer and parts');

	/*
	B224 -- THE GUARD NAMED THREE FILES, AND A FOURTH WAS ADDED.

	This loop used to carry a literal list: main.js, renderer.js, kernel/renderer.mjs. It was
	correct about all three and blind to `app/src/painter.js`, which hardcoded the placement
	ghost at stroke-width 1.6 and dot radius 2.2 against the kernel's 2 and 2, and drew the
	ENDPOINT class at the ANCHOR's radius. B200 is the defect this test exists to prevent, and
	it recurred in the one file the test did not know about.

	So the list is gone. Every JS source that draws is swept, and a new drawing file is covered
	the moment it exists rather than when somebody remembers to add it here.
	*/
	const drawing = [];
	// RESTATED at H25.5 (B378): sweep the plugins' folders too, where the appearances now live
	for (const dir of ['../app/src', '../kernel', '../plugins/network', '../plugins/devices', '../plugins/zones', '../plugins/groups', '../plugins/layouts']) {
		const base = new URL(`${dir}/`, import.meta.url);
		for (const f of fs.readdirSync(base)) {
			if (!f.endsWith('.js') && !f.endsWith('.mjs')) continue;
			drawing.push([`${dir}/${f}`, fs.readFileSync(new URL(f, base), 'utf8')]);
		}
	}
	assert.ok(drawing.length >= 20, `the sweep must actually reach the tree -- found ${drawing.length} file(s)`);

	const LADDER = { 'dot radius': /r[:=]\s*"?2\.2"?/, 'anchor width': /['"]?stroke-width['"]?\s*[:=]\s*"?1\.6"?/ };
	for (const [name, src] of drawing) {
		for (const [what, pattern] of Object.entries(LADDER)) {
			assert.doesNotMatch(src, pattern, `${name} carries a hardcoded ${what} -- the ladder has one source`);
		}
	}
	assert.equal(gridDot().radius, 2, 'the dot is 2 -- the value the node grid already drew');
});

/*
B209: the layer LIST, and a junction that can be drawn.

Two changes and one property. `waypointLayers(roles, ext)` owns which sub-type draws what, so both
renderers walk one list instead of branching per role -- adding a sub-type is a change there rather
than in the canvas and the export both, which is the twin B162 exists to prevent.

And `endpointAt` now offers ANY waypoint, not only a free one. A bend always carries a link, so the
gesture that makes a junction was refused at the pointer before the validator ever saw it. B207
relaxed the validator; without this the feature is still undrawable.
*/
test('B209: each role combination draws its own layers, in both renderers', async () => {
	const { waypointLayers } = await import('../plugins/network/appearance.mjs');

	const cases = [
		['bend', [], ['wp-anchor', 'wp-dot']],
		['endpoint', ['endpoint'], ['wp-anchor', 'wp-ring', 'wp-dot']],
		['junction', ['junction'], ['wp-anchor', 'wp-junction', 'wp-dot']],
		// B211 -- a junction supersedes an endpoint, so the pair never occurs; kept as a layer-order
		// assertion in case a future sub-type does combine with the pad
		['both, if ever combined', ['junction', 'endpoint'], ['wp-anchor', 'wp-ring', 'wp-junction', 'wp-dot']],
	];
	for (const [why, roles, want] of cases) {
		assert.deepEqual(waypointLayers(roles, 20).map((l) => l.cls), want, why);
	}

	// the anchor is the floor and the dot the centre, whatever the roles
	for (const [, roles] of cases) {
		const ls = waypointLayers(roles, 20).map((l) => l.cls);
		assert.equal(ls[0], 'wp-anchor', 'the anchor is always drawn first -- it is the floor');
		assert.equal(ls[ls.length - 1], 'wp-dot', 'the dot is always last, so no opaque pad buries it');
	}

	/*
	The EXPORT draws what the list says. A T renders four circles and carries both role names as
	classes; a cross renders three and has no pad, because nothing terminates there.
	*/
	const doc = (links) => ({
		meta: { id: '0000000000aa0001', name: 't' },
		nodes: [{ id: 'node-aa0001', type: 'host', x: -120, y: 0, name: 'a' }, { id: 'node-aa0002', type: 'host', x: 120, y: 0, name: 'b' },
			{ id: 'node-aa0003', type: 'host', x: 0, y: 120, name: 'c' }, { id: 'node-aa0004', type: 'host', x: 0, y: -120, name: 'd' },
			{ id: 'node-ea0001', name: 'w', x: 0, y: 0 }],
		links, zones: [], groups: [],
	});
	const bend = [{ id: 'link-aa0001', name: 'l', src: 'node-aa0001', dst: 'node-aa0002', via: ['node-ea0001'] }];
	const drawn = (links) => {
		const m = svgDocument(doc(links)).match(/<g class="waypoint ([^"]*)">(.*?)<\/g>/s);
		return { cls: m[1], circles: (m[2].match(/<circle/g) || []).length };
	};

	// AMENDED 2026-10-04 (R-c; H2 refined): the export draws the run picture -- no anchor ring, and nothing at a bend
	assert.deepEqual(drawn(bend), { cls: 'bend', circles: 0 }, 'a bend draws nothing: its corner is in the path');
	/*
	B211 -- threading does not make a junction, and a junction shows only its own ring.
	*/
	assert.deepEqual(drawn([...bend, { id: 'link-aa0002', name: 'm', src: 'node-aa0003', dst: 'node-aa0004', via: ['node-ea0001'] }]),
		{ cls: 'bend', circles: 0 }, 'two links THREADED through one point is two bends, not a junction');
	// B214 -- THREE terminations is the smallest meet; two is a bend, a fan, or a terminus reached twice
	assert.deepEqual(drawn([{ id: 'link-aa0001', name: 'l', src: 'node-aa0001', dst: 'node-ea0001' },
		{ id: 'link-aa0002', name: 'm', src: 'node-ea0001', dst: 'node-aa0002' },
		{ id: 'link-aa0003', name: 'n', src: 'node-aa0003', dst: 'node-ea0001' }]),
		{ cls: 'junction', circles: 2 }, 'three terminations is a junction, and it draws the ring rather than the pad -- and its dot');
});

test('B209: a waypoint that already has links is a valid link target', async () => {
	// RESTATED at C-e step three (H19.33): `endpointAt` left app/src/pick.js -- a link end grabs what the network says a waypoint
	// covers (plugins/network/anchor-points.mjs), and the old slice would have passed against a file that no longer holds it
	const src = fs.readFileSync(new URL('../app/src/pick.js', import.meta.url), 'utf8');
	const points = fs.readFileSync(new URL('../plugins/network/anchor-points.mjs', import.meta.url), 'utf8');
	// RESTATED at H22.1 (B349): plugins/network/anchor-points.mjs filters by its own `nodePermitsBend` rather than importing `bareAnchors` from devices/
	assert.match(points, /word: 'waypoint', of: \(model\) => model\.all\('node'\)\.filter\(nodePermitsBend\), grabs: near/, 'every waypoint is grabbed, the declaration as read');
	assert.doesNotMatch(points, /waypointFree|free/i,
		'a link end must be offered a waypoint that already carries a link, or a junction cannot be DRAWN');
	// B211 -- and starting a link from one is the same question, so the predicate is gone entirely
	assert.doesNotMatch(src, /export const waypointFree/,
		'waypointFree has no caller: a junction must be startable from a bend, so every waypoint is a valid source');
});

/*
B210: the mid-drag path admits an occupied waypoint, and the split rides on the commit.

Three code paths have to agree for a junction to be drawable, and each refused independently at
some point: the validator (B207), `endpointAt` (B209), and this one -- `dropRouteWaypoint`, which
threads a waypoint when `w` is pressed mid-drag and used to bail on anything already carrying a
link. Restoring that bail passes every other test in the suite, which is why this exists.

The split is asserted to happen in `commitRoute` rather than here: until the button comes up there
is no link to make a junction with, and splitting on touch would cut a route the author might
still be drawing through.
*/
test('B210: pressing w on an occupied bend threads it, and the split happens on commit', () => {
	const src = fs.readFileSync(new URL('../app/src/input.js', import.meta.url), 'utf8');

	// sliced on the METHOD DEFINITIONS -- `updateLinkPreview(pos)` also appears as a call site
	// hundreds of lines earlier, which made the first version of this slice empty and vacuous
	// the drag-step verb is `addStop` since T3 (dev/RULES.md section 11); it was `dropRouteWaypoint`. The slice must not
	// start at -1 when a name moves, or it would read nothing and pass vacuously -- hence the guard
	const from = src.indexOf('\taddStop({ key, pin, nodes = false }) {');
	assert.ok(from > 0, 'the drag-step verb is where this test looks for it');
	const drop = src.slice(from, src.indexOf('\tupdateLinkPreview(pos) {'));
	assert.doesNotMatch(drop, /if \(!waypointFree\(/,
		'addStop must not refuse an occupied waypoint -- that is how a junction is threaded');
	assert.match(drop, /ctx\.via\.push\(existing\.id\)/, 'it threads the existing waypoint like any other');
	assert.doesNotMatch(drop, /splitAtBend|splitsFor/,
		'nothing may split mid-drag -- the route is still being drawn and there is no link yet');

	// H17.22 N-c: commitRoute also takes the entries a drag judge adds; the slice must find it, or it reads nothing
	const at = src.indexOf('\tcommitRoute(ctx, dstId, via, extra = []) {');
	assert.ok(at > 0, 'commitRoute is where this test looks for it');
	const commit = src.slice(at, src.indexOf('\tcleanupRoute(ctx) {'));
	// AMENDED 2026-10-04 (V-c, H18.27): the split is the planner's (`junction-cut`), in the same transaction as the link, so one
	// drag is still one undo -- the drag sends the link alone
	assert.doesNotMatch(commit, /splitsFor|splitAtBend/, 'the browser computes no split');
	assert.match(commit, /routeLink\(ctx\.placed, link\)/, 'it commits the placed anchors and the link');
	assert.match(fs.readFileSync(new URL('../plugins/network/network.mjs', import.meta.url), 'utf8'), /id: 'junction-cut'/, 'and the planner cuts');
});

/*
B212: a junction is OPAQUE, because links end at it rather than passing through.

The ring was hollow on the reasoning that a junction means "these links are connected", so the
paths should stay visible running through. B211 voided that -- a junction is terminations only, and
nothing passes through one. Hollow showed every link's tail crossing underneath and meeting at a
point none of them reaches.

The endpoint pad already fills for exactly this reason, so the two now agree: a circle a line STOPS
at is opaque, and a circle a line passes through is not.
*/
test('B212: the junction ring masks what is behind it, as the endpoint pad does', async () => {
	const { waypointLayers } = await import('../plugins/network/appearance.mjs');

	const fillOf = (roles, cls) => waypointLayers(roles, 20).find((l) => l.cls === cls).fill;

	assert.notEqual(fillOf(['junction'], 'wp-junction'), 'none',
		'a junction must be opaque -- links END at it, and a hollow ring shows their tails crossing underneath');
	assert.equal(fillOf(['junction'], 'wp-junction'), fillOf(['endpoint'], 'wp-ring'),
		'and it masks with the same fill the endpoint pad uses -- both say "a line stops here"');

	/*
	The ANCHOR stays hollow, and that is the other half of the rule. A bend is a path TURNING, and
	the path has to stay visible doing it -- an opaque anchor would break every route it bends,
	making a corner read as a gap.
	*/
	assert.equal(fillOf([], 'wp-anchor'), 'none', 'the anchor is hollow: a bend shows the path turning through it');

	// emitted, not just computed
	const svg = svgDocument({
		meta: { id: '0000000000aa0001', name: 't' },
		nodes: [{ id: 'node-aa0001', type: 'host', x: -120, y: 0, name: 'a' }, { id: 'node-aa0002', type: 'host', x: 120, y: 0, name: 'b' }, { id: 'node-ea0001', name: 'w', x: 0, y: 0 }],
		links: [{ id: 'link-aa0001', name: 'l', src: 'node-aa0001', dst: 'node-ea0001' },
			{ id: 'link-aa0002', name: 'm', src: 'node-ea0001', dst: 'node-aa0002' },
			{ id: 'link-aa0003', name: 'n', src: 'node-aa0002', dst: 'node-ea0001' }],
		zones: [], groups: [],
	});
	const ring = svg.match(/class="waypoint junction">.*?<circle[^>]*r="7"[^>]*fill="([^"]*)"/s);
	assert.ok(ring, 'the junction ring is drawn');
	assert.notEqual(ring[1], 'none', 'and it is emitted opaque, not merely computed so');
});

/*
H15.6: the arrowhead is DERIVED from `flow`, and it is one rule both renderers read.

Direction is the first appearance that follows from a declaration rather than from a type, so it is
the first real test of the pipeline ruled in DECISIONS.md: derived state in, one resolution out,
consumed by every renderer without any of them deciding again.

`linkMarker` answers which end carries the head, in the ONE vocabulary both the canvas and the SVG
export can emit. An undeclared link has no head, because it asserts nothing.
*/
test('H15.6: the arrowhead follows the declaration, from one source', async () => {
	const { linkFacing } = await import('../plugins/network/roles.mjs');
	const { linkMarker } = await import('../plugins/network/appearance.mjs');

	assert.equal(linkMarker({ id: 'l', src: 'a', dst: 'b' }), null,
		'an undeclared link carries no head -- it asserts no direction to point');
	assert.equal(linkMarker({ id: 'l', src: 'a', dst: 'b', direction: 'forward' }), 'end',
		'a forward flow points at the stored dst, which is the path END');
	assert.equal(linkMarker({ id: 'l', src: 'a', dst: 'b', direction: 'reverse' }), 'start',
		'a reversed flow points at the stored src, which is the path START');

	/*
	AND IT AGREES WITH `linkFacing`, because they are two readings of one field and this tree has
	paid for that shape repeatedly. The head belongs at whichever end the flow ARRIVES at.
	*/
	for (const direction of ['forward', 'reverse']) {
		const link = { id: 'l', src: 'a', dst: 'b', direction };
		const head = linkMarker(link);
		const arrivesAt = head === 'end' ? link.dst : link.src;
		assert.equal(linkFacing(link, arrivesAt), 'in',
			'the head must sit where the flow arrives, or the picture contradicts the model');
	}

	/*
	H15.9 -- these asserted that each renderer CALLS `linkMarker`. They now go through
	`linkAppearance`, which answers the whole question at once, so the sub-call is gone from both.

	The property was never "this function is called" -- it was that the two renderers cannot
	disagree. The pipeline enforces that more strongly than a call check did, because there is now
	one answer rather than two call sites that happen to ask the same thing.
	*/
	// RESTATED at H25.5 (B378, D4): both the canvas and the export draw links through plugins/network/link-painter.mjs
	const clientRenderer = fs.readFileSync(new URL('../plugins/network/link-painter.mjs', import.meta.url), 'utf8');
	assert.match(clientRenderer, /linkAppearance\(/, 'the link painter derives appearance in one call');

	/*
	AND IT MUST SURVIVE EVERY DOOR TO THE EXPORT, which is where this first shipped broken.

	`flow` reached the document and the canvas, and the marker DEFINITIONS reached the exported
	SVG -- but `docToSchema` built the route without the field, so the export defined two markers
	and used neither. A picture that silently disagrees with the document is the worst outcome
	available here, and the deploy that found it was green on 984 tests.

	So this drives the real export end to end rather than checking that a function exists.
	*/
	const mk = (direction) => ({
		nodes: [{ id: 'node-aa0001', name: 'a', type: 'host', x: -60, y: 0 }, { id: 'node-aa0002', name: 'b', type: 'host', x: 60, y: 0 }],
		zones: [], groups: [],
		links: [{ id: 'link-aa0001', name: 'l', src: 'node-aa0001', dst: 'node-aa0002', ...(direction === undefined ? {} : { direction }) }],
	});
	/*
	RESTATED 2026-10-16 (H24.6, B356): the head is no marker now but a shape of its own, drawn by the network's link painter, and
	the export is the product's own -- server/svg.mjs drives the real Renderer, as run mode does (H2). The property is unchanged:
	the declaration reaches the exported picture, at the end the flow arrives at, and an undeclared link exports no head.
	kernel/svg-scene.mjs, the declarative scene the tests render, draws no head at all, and is no longer asked.
	*/
	const { heldLayouts } = await import('./fixtures/composed.mjs');
	const { pipeEntity } = await import('../plugins/network/pipe-kind.mjs');
	const exportOf = (direction) => {
		const doc = mk(direction);
		return svgDocument({ meta: { id: '0000000000aa0001', name: 'h', version: 1, schema: 3 }, layouts: heldLayouts(), selection: [],
			nodes: doc.nodes.map((n, i) => ({ ...n, order: i + 1 })), links: doc.links.map((l) => ({ ...l, order: 1 })),
			pipes: [pipeEntity('node-aa0001', 'node-aa0002', 'link')], zones: [], groups: [] });
	};
	const headTipX = (svg) => Number((svg.match(/<path class="link-head"[^>]* d="M(-?[\d.]+) /) || [])[1]);
	assert.ok(headTipX(exportOf('forward')) > 30, 'a forward flow must reach the exported picture, its head at the dst end (x 60)');
	assert.ok(headTipX(exportOf('reverse')) < -30, 'and a reversed one must point the other way, at the src end (x -60)');
	assert.doesNotMatch(exportOf(undefined), /class="link-head"/, 'an undeclared link must export no head at all');

	// RESTATED at H25.5 (B378, D4): readModel carries the direction field unchanged
	const back = readModel({ meta: { id: '0000000000aa0001', name: 'h' }, ...mk('reverse') }, COMPOSED_KINDS).toJSON();
	assert.equal(back.links[0].direction, 'reverse', 'readModel must not lose the declaration');
});

/*
H15.15: the dash must reach the EXPORT and survive an UPDATE.

Both halves are here because both were defects for the arrowhead, one rung ago. B225: the marker
was defined in the export and referenced by nothing, because `docToSchema` dropped the field.
B228: the marker was set on create and not on update, so the first press worked and none after it.

The plane is the same shape of field travelling the same five doors, so it is guarded at the two
that failed rather than trusted because the code looks right.
*/
test('H15.15: a control link exports dashed, round-trips, and survives an update', async () => {
	const { linkDash, linkWidth } = await import('../plugins/network/appearance.mjs');
	const { pipeEntity } = await import('../plugins/network/pipe-kind.mjs');
	const mk = (control) => ({
		meta: { id: '0000000000aa0001', name: 'd' },
		nodes: [{ id: 'node-aa0001', name: 'a', type: 'host', x: -60, y: 0 }, { id: 'node-aa0002', name: 'b', type: 'host', x: 60, y: 0 }],
		zones: [], groups: [],
		links: [{ id: 'link-aa0001', name: 'l', src: 'node-aa0001', dst: 'node-aa0002', ...(control ? { control: true } : {}) }],
		pipes: [pipeEntity('node-aa0001', 'node-aa0002', 'link')],
	});

	/*
	The pattern is asserted as a RELATIONSHIP, not as a literal. H15.16 made a control link thinner
	and the dash scales with the stroke, so `6 6` became `3.6 3.6` -- a pinned number would have
	failed for a change that was entirely correct, and the property was never the number.
	*/
	const ctrlW = linkWidth({ id: 'l', control: true });
	const pattern = linkDash({ id: 'l', control: true }, ctrlW);
	assert.match(svgDocument(mk(true)).split('</defs>').pop(), new RegExp(`stroke-dasharray="${pattern}"`),
		'a control link must reach the exported path dashed, at the pattern its own width derives');
	assert.notEqual(pattern.split(' ')[0], pattern.split(' ')[1],
		'the dash is LONGER than the gap -- equal parts read as a row of squares rather than a dashed line');
	assert.match(svgDocument(mk(true)).split('</defs>').pop(), new RegExp(`stroke-width="${ctrlW}"`),
		'and thinner than a data link, by the same rule the canvas reads');
	assert.doesNotMatch(svgDocument(mk(false)).split('</defs>').pop(), /stroke-dasharray/,
		'and an ordinary data link must carry no dash attribute at all');
	assert.equal(readModel(mk(true), COMPOSED_KINDS).toJSON().links[0].control, true,
		'readModel must not lose the plane -- that was B225');

	// the dash is DERIVED, by one rule, and scales with the stroke rather than carrying its own number
	/*
	The pattern SCALES with the stroke, so it is asserted as a ratio rather than as two numbers.
	These were literals -- '6 6' and '10 10' -- and both broke when the dash was lengthened, for a
	change that was entirely correct. A literal here tests the value; the ratio tests the rule.
	*/
	assert.equal(linkDash({ id: 'l' }, 6), null, 'absence of the field is absence of the dash');
	/*
	ASSERTED AGAINST THE RULING, not against the constants.

	The first version computed its expectation from `DASH_ON` and `DASH_OFF`, so it agreed with
	whatever those happened to say -- halving the gap passed. That is the shape of B232 and B233,
	where a guard read the code instead of the rule and the defect shipped green.

	What is RULED is the relationship: the pattern scales with the stroke, the dash is longer than
	the gap, and the gap is wide enough to read as a gap. The numbers may move within that.
	*/
	const at = (w) => linkDash({ id: 'l', control: true }, w).split(' ').map(Number);
	const [on6, off6] = at(6);
	const [on12, off12] = at(12);
	assert.equal(on12, on6 * 2, 'the dash SCALES with the stroke, so it is a ratio rather than a size');
	assert.equal(off12, off6 * 2, 'and so does the gap');
	assert.ok(on6 > off6, 'the dash is longer than the gap, or the line reads as separate marks');
	assert.ok(off6 >= on6 / 2, 'and the gap is at least half the dash, or the dashes crowd together');

	/*
	H15.9 -- the dash is no longer set by name in either renderer; it arrives inside the appearance
	object. So what must be true has changed shape: the UPDATE path must apply the SAME derivation
	create uses, over the DECLARED key set, so a key a previous state set is removed rather than
	stranded. That is B228's property, now enforced by the key set instead of by remembering.
	*/
	// RESTATED at C-a step four (H19.29) and H25.5 (B378, D4): both the canvas and the export draw links through plugins/network/link-painter.mjs
	const clientRenderer = fs.readFileSync(new URL('../plugins/network/link-painter.mjs', import.meta.url), 'utf8');
	const updateBranch = clientRenderer.slice(clientRenderer.indexOf('\tupdate(link, dom'));
	// RESTATED 2026-10-16 (H24.6): the assembly is fed whether the link carries a head, and both branches derive the head the same way
	assert.match(updateBranch, /lookOf\(model, link, head\)/, 'the UPDATE path must re-derive through the same assembly create uses, not patch by hand');
	assert.match(updateBranch, /headOf\(model, link, points, outlineOf\)/, 'and the head by the same derivation');
	const createBranch = clientRenderer.slice(clientRenderer.indexOf('\tcreate(link'), clientRenderer.indexOf('\tupdate(link, dom'));
	assert.match(createBranch, /const head = headOf\(model, link, points, outlineOf\), look = lookOf\(model, link, head\)/, 'and CREATE must use both too, or the two can disagree');
	assert.match(createBranch, /class: 'link'[^\n]*\.\.\.look/, 'and emit it');
	assert.match(clientRenderer, /const lookOf = \(model, link, head\) => linkAppearance\(link, LINK_W, \{ down: isLinkDown\(model, link\), headed: !!head \}\)/,
		'the assembly is the one derivation, fed the down state and whether it carries a head');
	assert.match(updateBranch, /APPEARANCE_KEYS/,
		'and iterate the DECLARED keys, so a key it no longer sets is removed rather than stranded');
});

/*
H15.16: the control plane reads THINNER -- the link and the endpoint ring alike.

Director's adjustment. A control-plane link is dashed and slightly thinner than a data link, and an
endpoint where control-plane links terminate carries a thinner ring for the same reason: the plane
should be legible at a glance without reading the dash pattern.

The width is DERIVED from the plane, exactly as the dash is, so one rule answers both and neither
renderer decides for itself. The ring needs the links to know which plane it serves, which is why
`waypointLayers` takes them -- a role set alone cannot say.
*/
test('H15.16: a control link and its endpoint ring are thinner than a data one', async () => {
	const { linkWidth, waypointLayers } = await import('../plugins/network/appearance.mjs');
	const { L_STD, STD } = await import('../kernel/spec.mjs');

	// the LINK
	assert.ok(linkWidth({ id: 'l', control: true }) < linkWidth({ id: 'l' }),
		'a control link must be thinner than a data link');
	assert.equal(linkWidth({ id: 'l' }), STD.linkW, 'and a data link is unchanged -- the default is the baseline');

	// the ENDPOINT RING, derived from what terminates there
	const ext = L_STD.frame.ext;
	const ringOf = (links) => waypointLayers(['endpoint'], ext, links).find((l) => l.cls === 'wp-ring');
	const data = ringOf([{ id: 'a', src: 'x', dst: 'w' }]);
	const ctrl = ringOf([{ id: 'a', src: 'x', dst: 'w', control: true }]);
	assert.ok(ctrl.width < data.width, 'a control endpoint ring must be thinner than a data one');
	assert.equal(ctrl.radius, data.radius, 'and the SAME size -- only the weight carries the plane');

	/*
	MIXED IS DATA. An endpoint where both planes terminate is not "half control", and thinning it
	would claim something the graph does not say. Only an all-control terminus reads as control.
	*/
	const mixed = ringOf([{ id: 'a', src: 'x', dst: 'w', control: true }, { id: 'b', src: 'w', dst: 'y' }]);
	assert.equal(mixed.width, data.width, 'a mixed terminus reads as data -- it is not partly control');

	// the default keeps every existing caller correct: no links passed means the data weight
	assert.equal(waypointLayers(['endpoint'], ext).find((l) => l.cls === 'wp-ring').width, data.width,
		'omitting the links must not change what a waypoint has always drawn');
});

/*
H15.18: a text panel is drawn LIGHTER -- a 1-unit frame and smaller text.

Director's adjustment. A text panel is a caption on the drawing rather than a component in it, so it
should not carry the same weight as a node. Both numbers are DERIVED and live in the spec, for the
same reason the link weight does: they were literals in two renderers, and a value written twice
disagrees the moment one is changed.

Units are the SVG user space the whole spec uses -- the same unit as `linkW: 6` and `pitch: 60` --
not pixels or points. A stroke stays proportional to the drawing under zoom, which is correct.
*/
test('H15.18: a text panel has a 1-unit frame and 13-unit text, from one source', async () => {
	const { frameWidth } = await import('../plugins/devices/device-types.mjs');
	const { STD } = await import('../kernel/spec.mjs');

	const panel = { id: 'node-aa0001', type: 'text', content: [{ at: [0, 0], cols: 1, rows: 1, content: 'text', value: 'hi' }] };
	const plain = { id: 'node-aa0002', type: 'host' };

	assert.equal(frameWidth(panel), 1, 'a text panel frame is ONE unit -- lighter than a component');
	assert.equal(frameWidth(plain), STD.frameW, 'and a plain node keeps the ruled weight');
	assert.ok(frameWidth(panel) < frameWidth(plain), 'the panel is the lighter of the two');

	assert.equal(STD.fontSize, 13, 'the ruled default text size');

	/*
	BOTH RENDERERS READ THE RULE, not a literal of their own. Font size 15 was written into
	kernel/renderer.mjs and app/src/renderer.js independently, and the frame weight into two
	stylesheets -- which is the B121 and B200 shape, and why this is derived at all.
	*/
	// RESTATED at H25.5 (B378, D4): both the canvas and the export draw devices through plugins/devices/device-appearance.mjs
	const clientRenderer = fs.readFileSync(new URL('../plugins/devices/device-appearance.mjs', import.meta.url), 'utf8');
	assert.match(clientRenderer, /frameWidth\(/, 'plugins/devices/device-appearance.mjs must derive the frame weight rather than hardcode it');
	assert.doesNotMatch(clientRenderer, /'font-size':\s*15|font-size="15"/, 'plugins/devices/device-appearance.mjs still carries a literal font size');

	// and the EXPORT carries the thin frame, or a saved diagram disagrees with the canvas
	const doc = {
		meta: { id: '0000000000aa0001', name: 'd' },
		nodes: [{ ...panel, name: 't', shape: 'square', x: 0, y: 0, span: { cols: 2, rows: 1 } }],
		links: [], zones: [], groups: [],
	};
	assert.match(svgDocument(doc).split('</defs>').pop(), /stroke-width="1"/,
		'the exported panel frame must be thin too -- CSS alone would leave the export heavy');
});

/*
B234: the exported SVG must carry node and zone LABELS.

Adding `.svg` to a diagram URL returned a picture with no text at all, however many named nodes and
zones the document held. Two causes in series, and either alone would have been enough:

  `docToSchema` dropped `name`, so the label never reached the scene
  the kernel renderer had no label branch, so it could not have drawn one that did

The old "kernel defers labels" decision was reversed at W2 for CONTENT REGIONS and never extended to
the names a node or a zone carries. So the reversal was half-done, and the export has been silently
unlabelled since -- invisible because the canvas draws its own labels from app/src/renderer.js.

A picture that disagrees with the canvas is the class B225 and B226 both were, which is why this
asserts the rendered OUTPUT rather than that a function is called.
*/
test('B234: an exported node and zone carry their names', async () => {
	// RESTATED at H25.5 (B378, D4): driven through the real export (server/svg.mjs svgDocument)
	const doc = {
		meta: { id: '0000000000aa0001', name: 'd' },
		nodes: [{ id: 'node-aa0001', name: 'spine1', type: 'router', shape: 'circle', x: 0, y: 0 }],
		zones: [{ id: 'zone-aa0001', name: 'core', x: -120, y: -120, w: 240, h: 240 }],
		links: [], groups: [],
	};
	const svg = svgDocument(doc).split('</defs>').pop();
	assert.match(svg, />spine1</, 'the exported node must show its name');
	assert.match(svg, />core</, 'and the exported zone must show its name');

	// an UNNAMED entity draws nothing rather than an empty text element
	const bare = svgDocument({
		meta: { id: '0000000000aa0001', name: 'd' },
		nodes: [{ id: 'node-aa0002', name: '', type: 'router', shape: 'circle', x: 0, y: 0 }],
		zones: [], links: [], groups: [],
	}).split('</defs>').pop();
	assert.doesNotMatch(bare, /<text/, 'an unnamed node emits no text element at all');

	// the name is ESCAPED
	const nasty = svgDocument({
		meta: { id: '0000000000aa0001', name: 'd' },
		nodes: [{ id: 'node-aa0003', name: 'a<b&c', type: 'router', shape: 'circle', x: 0, y: 0 }],
		zones: [], links: [], groups: [],
	}).split('</defs>').pop();
	assert.doesNotMatch(nasty, /a<b&c/, 'a name carrying markup must be escaped, not emitted raw');
	assert.match(nasty, /a&lt;b&amp;c/, 'and escaped correctly');
});

/*
H15.9: ONE derivation per entity, and both renderers emit what it returns.

The appearance of a link was four separate questions -- marker, width, dash, and the attribute
assembly that turns them into a path -- each answered independently and each assembled twice, once
on create and once on update. Every defect in the H15 ledger lived in that gap:

  B225  the adapter dropped a field, so one renderer had nothing to derive from
  B226  an attribute was emitted that resolved to no paint
  B228  create set the marker and update did not
  B234  the name never reached the scene, and no renderer could have drawn it

`linkAppearance` answers the whole question at once and returns ATTRIBUTES, not advice. A caller
emits them; it does not decide anything. That is what makes create and update the same code, and
what makes the canvas and the export unable to disagree.

The defence is structural rather than a new guard: there is no longer a second place to forget.
*/
test('H15.9: linkAppearance is the whole answer, and it is attributes rather than advice', async () => {
	const { APPEARANCE_KEYS, linkAppearance } = await import('../plugins/network/appearance.mjs');
	const { STD } = await import('../kernel/spec.mjs');

	const plain = linkAppearance({ id: 'l', src: 'a', dst: 'b' });
	assert.equal(plain['stroke-width'], STD.linkW, 'a data link takes the ruled width');
	assert.ok(!('stroke-dasharray' in plain), 'and carries NO dash key -- absent, not null');
	assert.ok(!('marker-end' in plain) && !('marker-start' in plain), 'and no head');

	const ctrl = linkAppearance({ id: 'l', src: 'a', dst: 'b', control: true, direction: 'forward' }, STD.linkW, { headed: true });
	assert.ok(ctrl['stroke-width'] < plain['stroke-width'], 'a control link is thinner');
	assert.match(ctrl['stroke-dasharray'], /^[\d.]+ [\d.]+$/, 'and dashed, as a ready attribute value');
	/*
	RESTATED 2026-10-16 (H24.6, B356): the head was a marker attribute here (`marker-end`, `marker-start`). It is a shape of its own
	now (plugins/network/link-head.mjs), so the line carries no head attribute at all; what the line owes a head is SQUARE caps, so no
	round cap pokes into it -- except a down link's, whose dots need round ones.
	*/
	assert.ok(!('marker-end' in ctrl) && !('marker-start' in ctrl), 'a directed line carries no marker: its head is drawn apart');
	assert.equal(ctrl['stroke-linecap'], 'butt', 'and a line carrying a head has square caps');
	assert.ok(!('stroke-linecap' in plain), 'control: a line without one states no cap');
	assert.equal(linkAppearance({ id: 'l', direction: 'forward' }, STD.linkW, { headed: true, down: true })['stroke-linecap'], 'round',
		'and a down link keeps the round caps its dots need');

	/*
	THE KEY SET IS THE WHOLE ANSWER. An update must be able to remove what a previous state set,
	and it can only do that if it knows every key this function could ever produce. Returning
	`undefined` for an absent value would make that impossible to distinguish from "unchanged".
	*/
	assert.ok(Array.isArray(APPEARANCE_KEYS) && APPEARANCE_KEYS.length > 0,
		'the caller must be able to ask which keys to clear');
	for (const key of Object.keys(ctrl)) {
		assert.ok(APPEARANCE_KEYS.includes(key), `${key} is emitted but not declared -- an update could not remove it`);
	}

	// RESTATED at C-a step four (H19.29) and H25.5 (B378, D4): both the canvas and the export draw links through plugins/network/link-painter.mjs
	const clientRenderer = fs.readFileSync(new URL('../plugins/network/link-painter.mjs', import.meta.url), 'utf8');
	assert.match(clientRenderer, /linkAppearance\(/, 'plugins/network/link-painter.mjs must derive a link\'s appearance in one call');
	assert.doesNotMatch(clientRenderer, /linkMarker\(|linkDash\(|linkWidth\(/,
		'plugins/network/link-painter.mjs still asks the sub-questions directly, so there are two ways to draw a link');
	// H24.6: and the head is one call too -- which end and how wide are the appearance's answers, asked inside it
	assert.match(clientRenderer, /linkHeadOf\(/, 'the painter derives a head in one call');
});

/*
A DOWN link -- one with no route right now, which heals when a route returns (ruled 2026-09-25) -- is
drawn DOTTED, as the director described it (2026-09-29): "a dotted/control like link directly between
the source and dest node would indicate 'ready to heal'".

What is RULED is the relationship, so that is what is asserted: a DOT is a zero-length dash with a round
cap (without the cap it draws nothing), spaced in stroke widths so it scales with the line, and it is
not the control dash -- which a down link must not be mistaken for. A down control link keeps its
thinner weight, so its plane stays legible while it is down.
*/
test('a DOWN link is dotted: round dots spaced in stroke widths, never the control dash', async () => {
	const { APPEARANCE_KEYS, linkAppearance } = await import('../plugins/network/appearance.mjs');   // the module itself, not the barrel (L4 ratchets barrel imports)
	const dots = (link, w, extra) => linkAppearance(link, w, { down: true, ...extra });
	const plain = { id: 'l', src: 'a', dst: 'b' };

	const down = dots(plain, 6);
	const [on, gap] = down['stroke-dasharray'].split(' ').map(Number);
	assert.equal(on, 0, 'a dot is a zero-length dash');
	assert.ok(gap > 6, `spaced wider than the dot, or the dots touch and read as a solid line (${gap})`);
	assert.equal(down['stroke-linecap'], 'round', 'and a ROUND cap, without which a zero-length dash draws nothing');
	assert.equal(Number(dots(plain, 12)['stroke-dasharray'].split(' ')[1]), gap * 2, 'the spacing scales with the stroke');

	const ctrl = { ...plain, control: true };
	const ctrlDown = dots(ctrl, 6);
	assert.equal(ctrlDown['stroke-width'], linkAppearance(ctrl, 6)['stroke-width'], 'a down control link keeps its thinner weight');
	assert.notEqual(ctrlDown['stroke-dasharray'], linkAppearance(ctrl, 6)['stroke-dasharray'], 'and is dotted, not dashed');

	/*
	ORANGE, as well as dotted (2026-09-29). Link colour lives in the stylesheet beside .link.selected and .link.armed,
	and a stylesheet cannot read the model -- so the derivation marks the state, and the stylesheet colours it.
	*/
	assert.equal(down['data-down'], '', 'a down link carries the mark the stylesheet colours');
	const up = linkAppearance(plain, 6);
	assert.ok(!('stroke-linecap' in up) && !('stroke-dasharray' in up) && !('data-down' in up), 'a live link carries none of the down keys -- absent, not null');
	assert.deepEqual(linkAppearance(plain, 6, { down: false }), up, 'and "not down" is exactly the live look');
	for (const key of Object.keys(ctrlDown)) {
		assert.ok(APPEARANCE_KEYS.includes(key), `${key} is emitted when down but not declared -- healing could not remove it`);
	}
});

/*
The transit ring -- ruled 2026-09-28. An anchor whose author declared `transit: false` keeps apart what reaches it, and
says so with a dashed ring.

AMENDED 2026-10-02: IT TAKES THE JUNCTION'S PLACE. A non-transiting anchor is never a junction (B277), so the ring is drawn
on the junction's rung -- its radius and its width, dashed, light red. Asserted as RELATIONSHIPS rather than literals, as
before: the rule is "the junction's ring, dashed, each dash at least as long as the stroke is thick", not "radius 7".
*/
test('the transit ring sits where the junction would, at its radius and width, dashed, clear of the endpoint ring', async () => {
	const { waypointLayers, waypointJunction } = await import('../plugins/network/appearance.mjs');
	const ext = 12;

	const all = waypointLayers(['endpoint'], ext, null, { transit: false });
	const ring = all.find((l) => l.cls === 'wp-transit');
	assert.ok(ring, 'an anchor declared non-transiting must draw a ring');
	const junction = waypointJunction();
	const endpoint = all.find((l) => l.cls === 'wp-ring');

	assert.equal(ring.radius, junction.radius, 'on the junction\'s rung: a non-transiting anchor never draws a junction');
	assert.equal(ring.width, junction.width, 'at the junction ring\'s width too, chosen by eye (2026-10-02)');
	assert.ok(ring.dash, 'still dashed (2026-10-02)');
	const [dash, gap] = String(ring.dash).split(/\s+/).map(Number);
	assert.ok(dash >= ring.width, `each dash (${dash}) at least as long as the stroke is thick (${ring.width}), or the ring reads as ticks`);
	// fitted (2026-10-02): the ring is measured as a whole number of periods, so every dash is equal, none cut short
	const periods = ring.pathLength / (dash + gap);
	assert.ok(Number.isInteger(periods) && periods >= 1, `the ring divides into whole periods, not ${periods}`);
	const drawn = dash * (2 * Math.PI * ring.radius) / ring.pathLength;
	assert.ok(Math.abs(drawn - dash) / dash < 0.1, `each dash as drawn (${drawn.toFixed(2)}) within a tenth of the target (${dash})`);
	assert.equal(ring.fill, 'none', 'unfilled: the endpoint pad masks a waypoint\'s centre, and a fill would blank a node\'s glyph');
	const span = (l) => [l.radius - l.width / 2, l.radius + l.width / 2];
	assert.ok(span(ring)[1] < span(endpoint)[0], `the transit ring (to ${span(ring)[1]}) must clear the endpoint ring (from ${span(endpoint)[0]})`);
});

test('the transit ring draws only when the author declared it, at any link count', async () => {
	const { waypointLayers } = await import('../plugins/network/appearance.mjs');
	const has = (roles, opts) => waypointLayers(roles, 12, null, opts).some((l) => l.cls === 'wp-transit');

	assert.equal(has(['endpoint'], { transit: false }), true, 'declared, one link: the mark shows');
	assert.equal(has([], { transit: false }), true,
		'declared with NO links: the mark still shows -- pre-declaration must be visible, or allowing it buys nothing');
	assert.equal(has(['junction'], { transit: false }), true, 'declared, many links');

	assert.equal(has(['endpoint'], { transit: true }), false, 'transiting: nothing to say');
	assert.equal(has(['endpoint'], {}), false, 'undeclared: the author declared nothing, so nothing draws');
});

test('the transit ring takes its colour from the network\'s role over the palette, not a literal', async () => {
	// the ring is the network plugin's, so its role is too (plugins/network/appearance.mjs, ruled 2026-10-01)
	const { NETWORK_COLOURS, waypointLayers } = await import('../plugins/network/appearance.mjs');
	const { colour } = await import('../kernel/palette.mjs');
	const ring = waypointLayers([], 20, null, { transit: false }).find((l) => l.cls === 'wp-transit');
	assert.equal(ring.stroke, colour(NETWORK_COLOURS.transitRing), 'drawn in the network\'s transit-ring role');
	/*
	CODE, not prose. The first version of this read the whole file and failed on two hex values
	inside a comment describing the grid dot -- a guard that cannot tell documentation from an
	instruction will be switched off rather than obeyed. Comments are stripped first, so the
	assertion is about what the module DOES.
	*/
	const src = fs.readFileSync(new URL('../plugins/network/appearance.mjs', import.meta.url), 'utf8')
		.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
	assert.doesNotMatch(src, /#[0-9a-fA-F]{6}/, 'the network appearance carries no colour value in code; the palette is the authority (B255)');
});

/*
The transit ring is never painted over -- the director's report (2026-09-30): cutting a link at a non-transiting anchor
makes it an endpoint, and the endpoint ring's opaque fill, drawn after the transit ring, hid it. Composed means both are
seen (ruled 2026-09-28), so no filled layer wide enough to cover radius 10 may come after it.
*/
test('the transit ring is drawn after every filled layer that would cover it', async () => {
	const { waypointLayers } = await import('../plugins/network/appearance.mjs');
	for (const roles of [['endpoint'], ['junction'], ['endpoint', 'junction'], []]) {
		const all = waypointLayers(roles, 20, null, { transit: false });
		const at = all.findIndex((l) => l.cls === 'wp-transit');
		const ring = all[at];
		const covers = all.slice(at + 1).filter((l) => (l.fill === 'solid' || (l.fill && l.fill !== 'none')) && l.radius + (l.width ?? 0) / 2 > ring.radius - ring.width / 2);
		assert.deepEqual(covers.map((l) => l.cls), [], `${roles.join('+') || 'bend'}: painted over the transit ring`);
	}
});

/*
AN EVEN DASH (kernel/renderer.mjs `evenDash`, 2026-10-02): asked for a dash and gap in real units, it lays a whole number of
periods around a closed shape -- the count nearest to fitting -- and measures the shape as exactly that long, so the dashes
are equal and only slightly off the target. Every renderer emits what it answers: the canvas and the export draw one layer
list, so a fitted ring is fitted in both.
*/
test('evenDash fits a whole number of dashes, nearest the target, at least one', async () => {
	const { evenDash } = await import('../kernel/renderer.mjs');
	assert.deepEqual(evenDash(2 * Math.PI * 7, 4, 2), { dash: '4 2', pathLength: 42, count: 7 }, 'the transit ring: 44 long, seven periods of six');
	assert.deepEqual(evenDash(2 * Math.PI * 7, 5, 3), { dash: '5 3', pathLength: 40, count: 5 });
	assert.equal(evenDash(10, 4, 2).count, 2, '1.67 periods rounds to two');
	assert.equal(evenDash(2, 4, 2).count, 1, 'a shape shorter than one period still draws one dash');
	for (const [r, d, g] of [[7, 4, 2], [14, 3, 2], [20, 6, 3], [3, 1, 1]]) {
		const len = 2 * Math.PI * r, f = evenDash(len, d, g);
		assert.ok(Math.abs(len / f.pathLength - 1) <= (d + g) / 2 / f.pathLength + 1e-9, `r=${r}: stretched by at most half a period`);
	}
});

test('a fitted dash is drawn as fitted, by the canvas and the export alike', async () => {
	const { waypointLayers } = await import('../plugins/network/appearance.mjs');
	const ring = waypointLayers([], 20, null, { transit: false }).find((l) => l.cls === 'wp-transit');
	assert.ok(ring.pathLength, 'the transit ring carries its fitted length');
	// RESTATED at C-a (H19.29, D3): the anchor's drawing is the plugins' appearances now -- the network's marks, the devices plugin's device
	// RESTATED at H25.5 (B378, D4): both the canvas and the export draw through plugins/network/anchor-appearance.mjs
	const canvas = fs.readFileSync(new URL('../plugins/network/anchor-appearance.mjs', import.meta.url), 'utf8');
	assert.match(canvas, /pathLength: l\.pathLength/, 'the anchor appearance emits it for the canvas and the export alike');
});
