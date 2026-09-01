import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Model } from '../model/index.mjs';
import { attachRelations } from '../engine/index.mjs';
import { resolve, renderElement, renderContentRegion, bboxOf, selBox, cellOf, STD, L_STD , isPanel, frameRadius, showsSockets } from '../kernel/index.mjs';
import { docToSchema, schemaToDoc } from '../kernel/adapt.mjs';
import { validateEntity, validateDoc } from '../server/validate.js';
import { createEntity, setContentValue, reshapeNodes } from '../app/src/commands.js';
import { controlBarDoc } from './fixtures/control-bar-doc.mjs';

// W1 — multi-cell span foundation. A node gains an optional span = {cols,rows} (cell counts, default
// 1×1); it anchors at its cell and grows +col/+row. Both absent ⇒ byte-identical to today's 1-cell node.
// These tests pin: kernel geometry/render, the doc↔schema adapter, span-aware occupancy, the server
// gate, and history-clone isolation — and the 1×1 byte-identity that makes the field parity-safe.

const P = STD.pitch;   // 60

// ---- kernel geometry + render ----
test('bboxOf: 1×1 is the 40px frame; a span grows +x/+y from the anchor', () => {
	const { scene } = resolve({ entities: [
		{ id: 'node-000001', kind: 'node', cell: [0, 0], glyph: 'router' },
		{ id: 'node-000002', kind: 'node', cell: [2, 0], span: { cols: [2, 4], rows: [0, 1] }, glyph: 'host' }
	] });
	const one = scene.find((e) => e.id === 'node-000001');
	const span = scene.find((e) => e.id === 'node-000002');
	assert.deepEqual(bboxOf(one), { x: -20, y: -20, w: 40, h: 40 });           // unchanged 1×1
	assert.deepEqual(bboxOf(span), { x: 2 * P - 20, y: -20, w: 40 + 2 * P, h: 40 + 1 * P });  // 3 cols, 2 rows
	assert.equal(one.spanW, undefined, '1×1 carries no span fields (byte-identical element)');
	assert.equal(span.spanW, 2 * P);
	assert.equal(span.spanH, 1 * P);
});

test('renderElement: 1×1 keeps the <use> frame; a span draws a sized rect frame', () => {
	const one = resolve({ entities: [{ id: 'node-000001', kind: 'node', cell: [0, 0], glyph: 'router', sel: true }] }).scene[0];
	const span = resolve({ entities: [{ id: 'node-000002', kind: 'node', cell: [0, 0], span: { cols: [0, 2], rows: [0, 1] }, glyph: 'host', sel: true }] }).scene[0];
	const svgOne = renderElement(one), svgSpan = renderElement(span);
	assert.match(svgOne, /<use href="#m-circle"\/>/);
	assert.ok(!svgOne.includes('<rect class="frame"'), '1×1 uses the frame def, not a rect');
	assert.match(svgSpan, /<rect class="frame" x="-20" y="-20" width="160" height="100" rx="5"\/>/);   // 3×2 footprint
	assert.ok(!svgSpan.includes('#m-'), 'a span node does not reference the 1-cell frame def');
});

test('selBox: default args are byte-identical to the pre-span box; a span extends it', () => {
	assert.equal(selBox(L_STD), selBox(L_STD, 0, 0));                       // 1×1 brackets unchanged
	const one = resolve({ entities: [{ id: 'node-000001', kind: 'node', cell: [0, 0], sel: true }] }).scene[0];
	const span = resolve({ entities: [{ id: 'node-000002', kind: 'node', cell: [0, 0], span: { cols: [0, 2], rows: [0, 1] }, sel: true }] }).scene[0];
	assert.ok(renderElement(one).includes(selBox(L_STD)));
	assert.ok(renderElement(span).includes(selBox(L_STD, 2 * P, 1 * P)));   // brackets wrap the whole footprint
});

// ---- doc ↔ schema adapter ----
test('docToSchema/schemaToDoc round-trip span as cell counts; 1×1 stays span-free', () => {
	const doc = { nodes: [
		{ id: 'node-000003', name: 'p', type: 'host', shape: 'square', x: 2 * P, y: 0, span: { cols: 3, rows: 2 } },
		{ id: 'node-000004', name: 'n', type: 'router', shape: 'circle', x: 0, y: 0 }
	] };
	const sch = docToSchema(doc);
	const span = sch.entities.find((e) => e.id === 'node-000003');
	assert.deepEqual(span.span, { cols: [2, 4], rows: [0, 1] }, 'counts → absolute ranges anchored at the cell');
	const one = sch.entities.find((e) => e.id === 'node-000004');
	assert.ok(!('span' in one), '1×1 emits no span');
	const back = schemaToDoc(sch);
	assert.deepEqual(back.nodes.find((n) => n.id === 'node-000003').span, { cols: 3, rows: 2 });   // ranges → counts
	assert.ok(!('span' in back.nodes.find((n) => n.id === 'node-000004')), '1×1 round-trips span-free (byte-identical)');
});

// ---- span-aware occupancy (R13 index) ----
test('a span node occupies every covered cell; move/resize/del maintain the index', () => {
	const m = new Model(); attachRelations(m, { cellOf });
	const n = m.makeNode('host', { x: 2 * P, y: 0 }); n.span = { cols: 3, rows: 2 }; m.put('node', n);
	for (let c = 2; c <= 4; c++) for (let r = 0; r <= 1; r++) assert.equal(m.occupiedAt({ x: c * P, y: r * P }), true, `covers ${c},${r}`);
	assert.equal(m.occupiedAt({ x: 1 * P, y: 0 }), false, 'left neighbour free');
	assert.equal(m.occupiedAt({ x: 5 * P, y: 0 }), false, 'right neighbour free');
	assert.equal(m.occupiedAt({ x: 2 * P, y: 2 * P }), false, 'below the footprint free');

	m.set('node', n.id, { x: 0, y: 0 });                                    // move anchor → footprint follows
	assert.equal(m.occupiedAt({ x: 4 * P, y: 1 * P }), false, 'old far cell freed');
	assert.equal(m.occupiedAt({ x: 0, y: 0 }), true);
	assert.equal(m.occupiedAt({ x: 2 * P, y: 1 * P }), true, 'new footprint occupied');

	m.set('node', n.id, { span: { cols: 1, rows: 1 } });                    // shrink to 1×1
	assert.equal(m.occupiedAt({ x: 1 * P, y: 0 }), false, 'shrink frees grown cells');
	assert.equal(m.occupiedAt({ x: 0, y: 0 }), true, 'anchor still occupied');

	m.del('node', n.id);
	assert.equal(m.occupiedAt({ x: 0, y: 0 }), false, 'del frees the footprint');
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
	const doc = { meta: { id: 'diagram-000000', name: 'd' },
		nodes: [{ id: 'node-000006', name: 'p', type: 'host', shape: 'square', x: 2 * P, y: 0, span: { cols: 3, rows: 2 } }],
		waypoints: [], links: [], zones: [], groups: [] };
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

test('a content node renders text/glyph/outline/pill; plain node byte-identical', () => {
	const el = resolve({ entities: [{ id: 'node-000020', kind: 'node', cell: [0, 0], span: { cols: [0, 3], rows: [0, 1] }, content: [
		{ at: [0, 0], cols: 1, rows: 1, content: 'text', value: 'name', align: 'left', fill: '#9fb0c0' },
		{ at: [1, 0], cols: 3, rows: 1, content: 'text', value: 'web-tier', align: 'left', outline: true, accent: '#4fc3f7' },
		{ at: [0, 1], cols: 1, rows: 1, content: 'glyph', glyph: 'router' },
		{ at: [1, 1], cols: 3, rows: 1, content: 'text', value: 'online', align: 'center', outline: true, bg: '#aed581', fill: '#101010', rx: 13 }
	] }] }).scene[0];
	const svg = renderElement(el);
	assert.match(svg, /<rect class="frame" x="-20" y="-20" width="220" height="100"/);   // the W1 4×2 frame
	assert.ok(svg.includes('>name<') && svg.includes('>web-tier<') && svg.includes('>online<'));
	assert.match(svg, /stroke="#4fc3f7"/);                  // the value outline
	assert.match(svg, /fill="#aed581"[^>]*/);              // the pill fill
	assert.match(svg, /rx="13"/);                          // the pill radius
	assert.ok(svg.includes('#glyph-router'));              // the glyph region
	const plain = renderElement(resolve({ entities: [{ id: 'node-000021', kind: 'node', cell: [0, 0], glyph: 'router' }] }).scene[0]);
	// the socket left this shape when W4's rule was finally applied to plain nodes too: a clean
	// export carries no edit-mode aid, and the dashed square was one
	assert.ok(plain.includes('<use href="#m-circle"/>') && plain.includes('#glyph-router'), 'no content ⇒ frame and glyph');
	assert.ok(!plain.includes('class="socket"'), 'and no socket, which is an editing aid');
});

test('W4: the socket grid is gated behind the sockets render opt (off by default — clean export)', () => {
	const el = resolve({ entities: [{ id: 'node-000030', kind: 'node', cell: [0, 0], span: { cols: [0, 2], rows: [0, 0] }, content: [{ content: 'text', value: 'x' }] }] }).scene[0];
	assert.equal((renderElement(el).match(/class="socket"/g) || []).length, 0, 'default: no grid (a clean export carries no edit-mode aid)');
	assert.equal((renderElement(el, STD, L_STD, { sockets: true }).match(/class="socket"/g) || []).length, 3, 'opts.sockets: a 3-cell socket grid');

	/*
	The same rule on a PLAIN node, which is the case this test did not cover and so did not hold.
	A panel's grid obeyed `sockets` while every plain node drew its dashed square unconditionally --
	the rule was stated once and enforced on one of the two shapes it named.
	*/
	const bare = resolve({ entities: [{ id: 'node-000031', kind: 'node', cell: [0, 0], glyph: 'router' }] }).scene[0];
	assert.equal((renderElement(bare).match(/class="socket"/g) || []).length, 0, 'default: a plain node carries no socket either');
	assert.equal((renderElement(bare, STD, L_STD, { sockets: true }).match(/class="socket"/g) || []).length, 1, 'opts.sockets: its one socket');
});

// =====================================================================================================
// W5 — run mode + clickable buttons: a content region with `action` is a button; in run mode a click on it
// fires a draw:action event the host wires. The render emits a hit rect (data-action); the gate is safe.
// =====================================================================================================

test('W5: a clickable region renders a transparent hit rect with data-action; the action is gated', () => {
	const el = resolve({ entities: [{ id: 'node-000040', kind: 'node', cell: [0, 0], span: { cols: [0, 1], rows: [0, 0] }, content: [
		{ at: [0, 0], content: 'text', value: 'Save', outline: true, action: 'diagram-new' },
		{ at: [1, 0], content: 'text', value: 'x' }
	] }] }).scene[0];
	const svg = renderElement(el);
	assert.match(svg, /<rect class="clickable" data-action="diagram-new"[^>]*fill="transparent"\/>/);
	assert.equal((svg.match(/class="clickable"/g) || []).length, 1, 'only the region with an action is clickable');
	const base = { id: 'node-000041', name: 'p', type: 'host', shape: 'square', x: 0, y: 0 };
	assert.equal(validateEntity('node', { ...base, content: [{ content: 'text', value: 'x', action: 'slides-push' }] }), null);
	assert.match(validateEntity('node', { ...base, content: [{ content: 'text', action: 'DROP thing' }] }), /node\.content/, 'unsafe action rejected (not [a-z0-9-])');
});

test('W5: the control-bar buttons carry actions and the document stays valid', () => {
	const doc = controlBarDoc();
	const bar = doc.nodes.find((n) => n.id === 'node-ba0001');
	const actions = bar.content.filter((r) => r.action).map((r) => r.action).sort();
	assert.deepEqual(actions, ['diagram-del', 'diagram-new', 'diagram-open', 'help', 'slides-push']);
	assert.equal(validateDoc(doc), null, 'a control bar with clickable buttons is a valid, persistable document');
});

// =====================================================================================================
// W6 — live input editing: a content region marked input:true is editable; in run mode a click opens an
// inline editor; committing writes the value back into the node's content (setContentValue).
// =====================================================================================================

test('W6: an input region renders a data-input hit rect (with its index); validation gates input', () => {
	const el = resolve({ entities: [{ id: 'node-000050', kind: 'node', cell: [0, 0], span: { cols: [0, 2], rows: [0, 0] }, content: [
		{ at: [0, 0], content: 'text', value: 'name', align: 'left' },
		{ at: [1, 0], cols: 2, content: 'text', value: 'v', outline: true, input: true }
	] }] }).scene[0];
	const svg = renderElement(el);
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
	assert.deepEqual(inputs, ['docs…/d/1A', 'scene-1']);
	assert.equal(validateDoc(doc), null);
});

// =====================================================================================================
// A1 (authoring arc) — text boxes: makeTextBox builds a node-with-text-content authored on-canvas
// (hold-t + drag). No new entity kind / no server change — it's a node with span + a text region.
// =====================================================================================================

test('a panel\'s corner follows shape (circle→rx=frame.ext, square→rx=frame.r); plain / span-glyph unchanged', () => {
	const fe = L_STD.frame.ext, fr = L_STD.frame.r;
	const c1 = renderElement(resolve({ entities: [{ id: 'node-00d101', kind: 'node', cell: [0, 0], content: [{ content: 'text', value: 'x' }] }] }).scene[0]);
	assert.match(c1, new RegExp(`<rect class="frame" x="-20" y="-20" width="40" height="40" rx="${fe}"`), 'a circle (default) 1×1 panel = a 40×40 rect rx=20 (== the circle)');
	const cSq = renderElement(resolve({ entities: [{ id: 'node-00d501', kind: 'node', cell: [0, 0], frame: 'square', content: [{ content: 'text', value: 'x' }] }] }).scene[0]);
	assert.match(cSq, new RegExp(`<rect class="frame"[^>]*rx="${fr}"`), 'a SQUARE panel drops to rx=frame.r (5) — what "s" toggles to');
	const c2 = renderElement(resolve({ entities: [{ id: 'node-00d201', kind: 'node', cell: [0, 0], span: { cols: [0, 2], rows: [0, 1] }, content: [{ content: 'text', value: 'x' }] }] }).scene[0]);
	assert.match(c2, new RegExp(`<rect class="frame"[^>]*rx="${fe}"`), 'a multi-cell circle panel rounds to rx=20');
	const spanGlyph = renderElement(resolve({ entities: [{ id: 'node-00d301', kind: 'node', cell: [0, 0], span: { cols: [0, 2], rows: [0, 0] }, glyph: 'router' }] }).scene[0]);
	assert.match(spanGlyph, new RegExp(`<rect class="frame"[^>]*rx="${fr}"`), 'a span node with no content keeps rx=frame.r');
	const plain = renderElement(resolve({ entities: [{ id: 'node-00d401', kind: 'node', cell: [0, 0], glyph: 'router' }] }).scene[0]);
	assert.ok(plain.includes('<use href="#m-circle"/>') && !plain.includes('<rect class="frame"'), 'a 1×1 plain node uses the frame def');
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
	const sch = { entities: [
		{ id: 'node-0000a1', kind: 'node', cell: [0, 0] },
		{ id: 'node-0000a2', kind: 'node', cell: [3, 0], span: { cols: [3, 5], rows: [0, 1] } },   // 3×2 footprint to cell (5,1)
		{ id: 'group-0000c1', kind: 'group', members: ['node-0000a1', 'node-0000a2'] }
	] };
	const g = resolve(sch).scene.find((e) => e.kind === 'group');
	const ge = L_STD.group.ext;
	assert.ok(g.x + g.w >= 5 * P + ge, 'right edge covers the span member’s far cell (300 + ext)');
	assert.ok(g.y + g.h >= 1 * P + ge, 'bottom edge covers the span member’s far row (60 + ext)');
	assert.ok(g.x + g.w > 3 * P + ge + 1, 'the hull reaches past the old anchor-only edge (180 + ext)');
});

test('A1: makeTextBox builds a valid text-box node (span + a single text region); renders via W1/W2', () => {
	const m = new Model();
	const tb = m.makeTextBox({ x: 0, y: 0 }, { cols: 3, rows: 2 });
	assert.deepEqual(tb.span, { cols: 3, rows: 2 });
	assert.equal(tb.content.length, 1);
	assert.equal(tb.content[0].content, 'text');
	assert.deepEqual(tb.content[0].at, [0, 0]);
	assert.equal(tb.content[0].cols, 3);
	assert.equal(validateEntity('node', tb), null, 'a text box passes the server gate (no new validator needed)');
	const el = resolve(docToSchema({ nodes: [tb] })).scene[0];   // production render path
	assert.equal(el.spanW, 2 * P, 'a 3-cell-wide footprint');
	assert.ok(el.content && el.content.length === 1, 'the text region carries through to the kernel');
});

test('renderContentRegion escapes text and wraps a multi-row region into a paragraph', () => {
	assert.ok(renderContentRegion({ content: 'text', value: '<b>&x' }).includes('&lt;b&gt;&amp;x'), 'XSS-safe text');
	const single = renderContentRegion({ at: [0, 0], cols: 1, rows: 1, content: 'text', value: 'hi', align: 'left' });
	assert.match(single, /text-anchor="start"/);
	assert.equal((single.match(/<text/g) || []).length, 1, 'single row ⇒ one line');
	const para = renderContentRegion({ at: [0, 0], cols: 2, rows: 2, content: 'text', value: 'one two three four five six seven' });
	assert.ok((para.match(/<text/g) || []).length >= 2, 'multi-row ⇒ wraps into multiple lines');
});

test('docToSchema/schemaToDoc round-trip content regions (node-local, unchanged)', () => {
	const content = [{ at: [0, 0], cols: 1, rows: 1, content: 'text', value: 'name', align: 'left' }, { at: [1, 0], cols: 3, rows: 1, content: 'text', value: 'r1', outline: true }];
	const doc = { nodes: [{ id: 'node-000022', name: 'p', type: 'host', shape: 'square', x: 0, y: 0, span: { cols: 4, rows: 1 }, content }] };
	const back = schemaToDoc(docToSchema(doc));
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
	assert.equal(bar.content.length, 11, 'the 11 #menu controls as content regions');
	assert.equal(validateEntity('node', bar), null, 'the bar node passes the server gate');
	assert.equal(validateDoc(doc), null, 'the whole control-bar document is valid (real, persistable)');
	// production render path: document → docToSchema → kernel
	const barEl = resolve(docToSchema(doc)).scene.find((e) => e.id === 'node-ba0001');
	assert.equal(barEl.spanW, 23 * P, '24-cell wide footprint');
	const svg = renderElement(barEl);
	assert.match(svg, /<rect class="frame" x="-20" y="-20" width="1420"/);   // 24 cols: 23·60 + 40
	for (const v of ['draw', 'scene-1', 'open ▾', 'slides', 'online']) assert.ok(svg.includes('>' + v + '<'), `renders "${v}"`);
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
test('B38: every element kind the kernel handles is a kind resolve() can emit', () => {
	const src = fs.readFileSync('kernel/renderer.mjs', 'utf8') + fs.readFileSync('kernel/grc.mjs', 'utf8');
	const handled = new Set([...src.matchAll(/kind === '(\w+)'/g)].map((m) => m[1]));

	// What the engine can actually PUT IN A SCENE — read from what resolve() imports from geometry,
	// not from which constructors happen to exist. The distinction is the whole point: a dead
	// constructor still declares its kind, so testing against geometry.mjs would have passed while
	// the dead kind sat there. Measured from the importer, the only thing that can emit.
	const eng = fs.readFileSync('kernel/engine.mjs', 'utf8');
	const imported = eng.match(/import \{([^}]*)\} from '\.\/geometry\.mjs'/)[1];
	const constructible = new Set(imported.split(',').map((n) => n.trim()).filter(Boolean));

	/*
	Two kinds are handled without being emitted by resolve(), and both are DECLARED, not dead:
	`port` and `junction` are `[LOCKED]` in docs/spec/ATOMICS.md (the 10px port, the junction pad,
	parallel-link capacity) and are anchors under the ratified taxonomy. The connection grammar that
	places them is the next design arc; the renderer and GRC already know how to draw and check them.
	Deleting them would delete locked design work, which is a different act from deleting dead code.

	`link` was neither: a straight connection IS a two-point path, so it was superseded rather than
	pending, and it forced `wire` to exist purely to unify a live kind with a dead one.
	*/
	const DECLARED = new Set(['port', 'junction']);
	const dead = [...handled].filter((k) => !constructible.has(k) && !DECLARED.has(k));
	assert.deepEqual(dead, [], `the kernel handles element kinds nothing can construct: ${dead.join(', ')}`);
});

test('B38: a straight connection is a two-point path — no separate element kind needed', () => {
	const sch = { entities: [
		{ id: 'node-000001', kind: 'node', cell: [0, 0] },
		{ id: 'node-000002', kind: 'node', cell: [2, 0] },
	], relations: [{ id: 'link-000001', route: { from: 'node-000001', to: 'node-000002' } }] };
	const { scene } = resolve(sch);
	const wires = scene.filter((e) => e.kind === 'path');
	assert.equal(wires.length, 1);
	assert.equal(wires[0].pts.length, 2, 'straight: two anchors, no bends');
	assert.equal(scene.some((e) => e.kind === 'link'), false, 'and no `link` element is produced');
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
	const mk = (extra) => resolve({ entities: [{ id: 'node-000032', kind: 'node', cell: [0, 0], glyph: 'router', ...extra }] }).scene[0];
	for (const [what, el] of [['plain', mk({})], ['panel', mk({ content: [{ content: 'text', value: 'x' }] })]]) {
		assert.equal(/class="socket"/.test(renderElement(el)), false, `${what}: none by default`);
		assert.equal(/class="socket"/.test(renderElement(el, STD, L_STD, { sockets: true })), true, `${what}: shown when asked`);
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
	const k = await import('../kernel/index.mjs');
	const doc = (closed) => ({
		meta: { id: 'diagram-aa0001', name: 't' },
		nodes: [{ id: 'node-aa0001', type: 'host', x: 0, y: 0, name: 'a' }],
		waypoints: [{ id: 'waypoint-aa0001', x: 120, y: 0 }, { id: 'waypoint-aa0002', x: 60, y: 60 }],
		links: [{ id: 'link-aa0001', src: 'node-aa0001', dst: 'waypoint-aa0001', via: ['waypoint-aa0002'], closed }],
		zones: [], groups: [],
	});
	const roles = (d) => [...k.render(k.docToSchema(d)).matchAll(/class="waypoint (\w+)"/g)].map((m) => m[1]);

	assert.deepEqual(roles(doc(false)), ['endpoint', 'bend'], 'a terminal is an endpoint, a via is a bend');
	assert.deepEqual(roles(doc(true)), ['bend', 'bend'], 'and a RING has no ends — both are corners');
});

test('B162: an endpoint is drawn heavier, on the same footprint as a bend', async () => {
	const k = await import('../kernel/index.mjs');
	const svg = k.render(k.docToSchema({
		meta: { id: 'diagram-aa0001', name: 't' },
		nodes: [{ id: 'node-aa0001', type: 'host', x: 0, y: 0, name: 'a' }],
		waypoints: [{ id: 'waypoint-aa0001', x: 120, y: 0 }, { id: 'waypoint-aa0002', x: 60, y: 60 }],
		links: [{ id: 'link-aa0001', src: 'node-aa0001', dst: 'waypoint-aa0001', via: ['waypoint-aa0002'] }],
		zones: [], groups: [],
	}));
	const drawn = [...svg.matchAll(/class="waypoint (\w+)"><circle[^>]*r="([\d.]+)"[^>]*stroke-width="([\d.]+)"/g)]
		.map(([, role, r, w]) => ({ role, r: Number(r), w: Number(w) }));
	const end = drawn.find((d) => d.role === 'endpoint');
	const bend = drawn.find((d) => d.role === 'bend');
	assert.ok(end && bend, 'both roles are drawn');

	assert.ok(end.w > bend.w * 2, 'the endpoint ring is far heavier — it terminates a line');
	/*
	THE HEAVY RING MUST NOT GROW THE FOOTPRINT. A stroke straddles its radius, so a 5px ring left at
	r=20 would reach 22.5 and an endpoint would visibly bulge past a bend -- closing a path would
	look like it resized its corners. Pulling the radius in by half the stroke puts the endpoint's
	OUTER edge exactly on the frame extent.

	The bend still straddles 20 and so reaches 20.8, half a stroke proud. That is the thin ring's
	own geometry and not worth distorting; what matters is that the heavy one does not exceed it.
	*/
	assert.equal(end.r + end.w / 2, 20, 'the endpoint sits inside the frame extent exactly');
	assert.ok(end.r + end.w / 2 <= bend.r + bend.w / 2, 'and never reaches further out than a bend');
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
	const k = await import('../kernel/index.mjs');
	assert.equal(typeof k.waypointRole, 'function', 'the rule is exported from the kernel');

	// the four cases, asserted on the rule itself rather than through either renderer
	const open = [{ from: 'w1', to: 'w2', via: ['w3'], close: false }];
	const ring = [{ from: 'w1', to: 'w2', via: ['w3'], close: true }];
	assert.equal(k.waypointRole('w1', open), 'endpoint', 'a terminal on an open path');
	assert.equal(k.waypointRole('w3', open), 'bend', 'a via is a corner');
	assert.equal(k.waypointRole('w1', ring), 'bend', 'a RING has no ends');
	assert.equal(k.waypointRole('w9', []), 'bend', 'and an orphan draws plainly');

	/*
	Both renderers must ASK for the role rather than decide it.

	Asserted as the positive only. My first attempt also tried to catch a re-derivation by pattern,
	and matched the client's own `endpoint ? 'endpoint' : 'bend'` -- which is naming a CSS class, not
	deciding a rule. A heuristic that cannot tell labelling from logic reports the correct code as
	the defect, which is worse than not checking.

	What the negative guard cannot do, the shared function does structurally: there is one
	`waypointRole`, and a renderer that stopped calling it would fail the assertion below.
	*/
	const client = fs.readFileSync(new URL('../app/src/renderer.js', import.meta.url), 'utf8');
	const engine = fs.readFileSync(new URL('../kernel/engine.mjs', import.meta.url), 'utf8');
	const routes = fs.readFileSync(new URL('../engine/routes.mjs', import.meta.url), 'utf8');

	/*
	H12.6 re-pointed the client half of this, and the reason is worth keeping.

	The renderer used to call `waypointRole` directly, mapping the model's `src`/`dst`/`closed` into
	the kernel's `from`/`to`/`close` inline. The situation needed the same mapping, which made it a
	twin, so it moved to `engine/routes.mjs` and the renderer now reaches the rule through `roleOf`.

	The PROPERTY was never "calls a particular symbol" -- it is "asks for the role rather than
	deciding it", and that is what is asserted. Pinning to the old name would have reported a
	correct refactor as a defect, which is the same failure this test's own comment warns about
	one paragraph up.
	*/
	assert.match(client, /roleOf\(/, 'the live renderer asks for the role');
	assert.match(routes, /waypointRole\(/, 'and the adapter it asks through reaches the one rule');
	assert.match(engine, /waypointRole\(/, 'as does the kernel');

	// the chain is unbroken in FACT, not merely in text: the adapter must produce the kernel's answer
	const { roleOf } = await import('../engine/routes.mjs');
	assert.equal(roleOf('w1', [{ src: 'w1', dst: 'w2', via: ['w3'], closed: false }]), 'endpoint');
	assert.equal(roleOf('w1', [{ src: 'w1', dst: 'w2', via: ['w3'], closed: true }]), 'bend', 'a ring still has no ends');

	// and the vocabulary is gone from the renderer -- the twin is retired, not merely unused
	assert.doesNotMatch(client, /from:\s*l\.src/, 'the model-to-kernel mapping must not live here again');
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
test('B162: both the create and the update path refresh a link\'s waypoints', () => {
	const src = fs.readFileSync(new URL('../app/src/renderer.js', import.meta.url), 'utf8');
	const calls = (src.match(/this\.refreshWaypointsOf\(/g) || []).length;
	assert.equal(calls, 2, 'render() and update() must BOTH refresh — one of them is the authoring case');
	assert.match(src, /refreshWaypointsOf\(link\)\s*\{/, 'and the refresh is one helper, not two copies');

	// it must cover every role a waypoint can hold on a link, or one of them stays stale
	const body = src.slice(src.indexOf('refreshWaypointsOf(link) {'));
	assert.match(body.slice(0, 400), /link\.src/, 'a src terminal');
	assert.match(body.slice(0, 400), /link\.dst/, 'a dst terminal');
	assert.match(body.slice(0, 400), /link\.via/, 'and the bends');
});

test('B162: an endpoint is opaque so the path terminates on it, a bend stays hollow', async () => {
	const k = await import('../kernel/index.mjs');
	const svg = k.render(k.docToSchema({
		meta: { id: 'diagram-aa0001', name: 't' },
		nodes: [{ id: 'node-aa0001', type: 'host', x: -240, y: 0, name: 'a' }],
		waypoints: [{ id: 'waypoint-aa0001', x: 120, y: 0 }, { id: 'waypoint-aa0002', x: 0, y: -120 }],
		links: [{ id: 'link-aa0001', src: 'node-aa0001', dst: 'waypoint-aa0001', via: ['waypoint-aa0002'] }],
		zones: [], groups: [],
	}));
	const fills = Object.fromEntries([...svg.matchAll(/class="waypoint (\w+)"><circle[^>]*fill="([^"]*)"/g)]
		.map(([, role, fill]) => [role, fill]));
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
	const k = await import('../kernel/index.mjs');
	const end = k.waypointStyle('endpoint', 20);
	const bend = k.waypointStyle('bend', 20);

	assert.ok(end.width > bend.width * 2, 'a pad is far heavier than a corner');
	assert.equal(end.radius + end.width / 2, 20, 'and never grows the footprint');
	assert.equal(end.fill, '#101010', 'opaque, so the path terminates on it');
	assert.equal(bend.fill, 'none', 'hollow, so the path stays visible turning');

	/*
	The guard that matters: neither renderer may decide these again. A second copy would pass every
	behavioural test in this file -- both would be correct on the day it was written -- and then
	drift the first time one side changed.
	*/
	for (const f of ['../app/src/renderer.js', '../kernel/renderer.mjs']) {
		const src = fs.readFileSync(new URL(f, import.meta.url), 'utf8');
		assert.match(src, /waypointStyle\(/, `${f} must ASK for the style`);
		assert.doesNotMatch(src, /endpoint\s*\?\s*5\s*:\s*1\.6/, `${f} restates the stroke weight`);
		assert.doesNotMatch(src, /endpoint\s*\?\s*1\s*:\s*0\.7/, `${f} restates the opacity`);
		assert.doesNotMatch(src, /endpoint\s*\?\s*TOKENS\.panel/, `${f} restates the fill`);
	}
});

test('B162: the two renderers agree, value for value', async () => {
	const k = await import('../kernel/index.mjs');
	// what the export emits, parsed back out of the SVG it produced
	const svg = k.render(k.docToSchema({
		meta: { id: 'diagram-aa0001', name: 't' },
		nodes: [{ id: 'node-aa0001', type: 'host', x: -240, y: 0, name: 'a' }],
		waypoints: [{ id: 'waypoint-aa0001', x: 120, y: 0 }, { id: 'waypoint-aa0002', x: 0, y: -120 }],
		links: [{ id: 'link-aa0001', src: 'node-aa0001', dst: 'waypoint-aa0001', via: ['waypoint-aa0002'] }],
		zones: [], groups: [],
	}));
	const drawn = Object.fromEntries([...svg.matchAll(/class="waypoint (\w+)"><circle[^>]*r="([\d.]+)" fill="([^"]*)"[^>]*stroke-width="([\d.]+)" stroke-opacity="([\d.]+)"/g)]
		.map(([, role, r, fill, w, op]) => [role, { radius: Number(r), fill, width: Number(w), opacity: Number(op) }]));

	// the live renderer sets exactly these attributes from the same call, so comparing the export
	// against the shared source proves both sides emit one set of numbers
	for (const role of ['endpoint', 'bend']) {
		assert.deepEqual(drawn[role], k.waypointStyle(role, 20), `${role} is drawn as the kernel specifies`);
	}
});
