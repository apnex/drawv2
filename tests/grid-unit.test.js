/*
H26.6's move 13 (dev/design/components/PAN-ZOOM.md section 3.9, GR4, GR16; 5.1 row 13; appendix A's move 13 rows) -- EVERY READER OF
THE PITCH, AT GRIDS OF 80 AND 120. At 60 the diagram's grid and a device's unit answer alike, so a reader taking one for the other shows
only on a grid of another size. Until move 15 no diagram can be stored at another size -- the layout row's WD7 `refers` refuses any pitch
but 60 at `validateDoc`; from move 14 its pitch field, held at 60 until move 15 -- so each diagram here has its record set straight on the Model, which `model.set` does not validate, and is
then asked through the planner every door shares and through the composition the page builds (tests/fixtures/client-harness.mjs): two
diagrams at once, each answering on its own grid.

Every row of 3.9: creation, the text tool, a chain, the nudge and Ctrl+D, the readout, validation, the occupancy index, placement, the
export and the simulation's reports. A position answers on the diagram's grid; a size answers as at 60 (GR4). Each row's mutant, the grid
exchanged for the unit or the unit for the grid, fails a test here (the move's record in PAN-ZOOM.md appendix B).
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Model, plan, validateDoc } from './fixtures/composed.mjs';
import { makeInput, key, pointer, seedNodes } from './fixtures/client-harness.mjs';
import { resolveAnchor } from '../server/anchor.mjs';
import { svgDocument } from '../server/svg.mjs';
import { moversReport } from '../plugins/simulation/spawners.mjs';
import { moversAt } from '../plugins/simulation/movers.mjs';
import { combatReport } from '../plugins/simulation/rules.mjs';
import { pipeEntity } from '../plugins/network/pipe-kind.mjs';
import { DEVICE_PRESSES } from '../plugins/devices/device-gestures.mjs';
import { LAYOUTS_CANVAS } from '../plugins/layouts/layout-canvas.mjs';
import { ZONE_HANDLE_SPECS } from '../plugins/zones/zone-gestures.mjs';
import { ZONE_SIZE_STEP } from '../plugins/zones/zone-keys.mjs';
import { makeZone } from '../plugins/zones/make-zone.mjs';
import { crosshair } from '../app/src/editing-visuals.js';
import { placesOf, clampDelta } from '../app/src/snap.js';
import { openGrid } from '@apnex/snap-grid';   // H26.6's move 14: a bounded lattice opened here, latticeGrids deleted
import { DEVICES_CANVAS } from '../plugins/devices/device-appearance.mjs';
import { contentLayout } from '../plugins/devices/device-types.mjs';
import { L_STD } from '../kernel/spec.mjs';
import '../product/types.mjs';

const GRIDS = [80, 120];
const onGrid = (v, pitch) => Math.round(v / pitch) * pitch;
const onEntity = (h, id, x, y, mod = {}) => pointer(x, y, { target: h.at(id), ...mod });
// the diagram's grid record set straight on the Model: WD7 refuses any pitch but 60 at validateDoc until move 15
const sized = (m, pitch) => { m.set('layout', 'layout-000001', { pitch }); return m; };
const composed = (pitch) => { const h = makeInput(); sized(h.model, pitch); return h; };

// ---- the composition: creation, a chain, the nudge and Ctrl+D, the readout, the text tool, the occupancy index ----

test('GR4 (move 13): two diagrams composed at once, at 80 and 120 -- creation, a chain, a nudge, Ctrl+D and a move\'s readout each on its own diagram\'s grid', () => {
	const hs = GRIDS.map(composed);
	try {
		for (const [i, h] of hs.entries()) {
			const p = GRIDS[i], other = GRIDS[1 - i];
			assert.equal(h.input.pitch(), p, `${p}: the canvas reads its diagram's square`);
			// creation: the pointer's cell, and a waypoint dropped there ('w' idle)
			assert.deepEqual(h.input.snapNode({ x: 1710, y: 50 }), { x: onGrid(1710, p), y: onGrid(50, p) }, `${p}: a pointer's cell on the diagram's grid`);
			assert.notDeepEqual(h.input.snapNode({ x: 1710, y: 50 }), { x: onGrid(1710, 60), y: onGrid(50, 60) }, `${p}: control -- not the unit's cell`);
			const [a, b] = seedNodes(h.model, [[2 * p, p], [10 * p, 10 * p]]);
			h.capture.onMove(pointer(1710, 50));
			h.capture.onKeyDown(key('w'));
			h.history.flush();
			assert.ok(h.model.all('node').some((n) => n.x === onGrid(1710, p) && n.y === onGrid(50, p) && !n.type), `${p}: the waypoint lands on the diagram's grid`);
			// a move: two squares right, the readout counting squares of the diagram's grid
			h.calls.length = 0;
			h.capture.onDown(onEntity(h, a.id, 2 * p, p, { button: 2, buttons: 2 }));
			h.capture.onMove(pointer(3 * p + 10, p, { buttons: 2 }));
			h.capture.onMove(pointer(4 * p + 10, p + 5, { buttons: 2 }));
			const drags = h.calls.filter((c) => c.name === 'readout.setDrag').map((c) => c.args);
			assert.deepEqual(drags.at(-1), [{ x: 4 * p, y: p }, { x: 2, y: 0 }], `${p}: the readout's cells are the diagram's squares`);
			h.capture.onUp(pointer(4 * p + 10, p + 5, { button: 2, buttons: 0 }));
			h.history.flush();
			assert.deepEqual([h.model.get('node', a.id).x, h.model.get('node', a.id).y], [4 * p, p], `${p}: the move lands two squares on`);
			// the nudge, a square of the diagram's grid
			h.selection.set([a.id]);
			h.capture.onKeyDown(key('ArrowRight'));
			h.history.flush();
			assert.equal(h.model.get('node', a.id).x, 5 * p, `${p}: a nudge steps one square of the diagram's grid`);
			// Ctrl+D with nothing remembered: one square right
			h.input.lastDelta = null;
			h.selection.set([b.id]);
			h.capture.onKeyDown(key('d', { ctrlKey: true }));
			h.history.flush();
			assert.ok(h.model.all('node').some((n) => n.id !== b.id && n.type === 'host' && n.x === 11 * p && n.y === 10 * p), `${p}: Ctrl+D offsets one square of the diagram's grid`);
			// a chain: a link drawn out of b, two stops dropped on the way, landing on a
			const before = new Set(h.model.all('node').map((n) => n.id));
			h.capture.onDown(onEntity(h, b.id, 10 * p, 10 * p));
			h.capture.onMove(pointer(13 * p + 7, 12 * p - 9));
			h.capture.onKeyDown(key('w'));
			h.capture.onMove(pointer(16 * p - 11, 15 * p + 13));
			h.capture.onKeyDown(key('w'));
			h.capture.onMove(pointer(5 * p, p));
			h.capture.onUp(onEntity(h, a.id, 5 * p, p));
			h.history.flush();
			const stops = h.model.all('node').filter((n) => !before.has(n.id)).map((n) => [n.x, n.y]);
			assert.deepEqual(stops, [[13 * p, 12 * p], [16 * p, 15 * p]], `${p}: a chain's stops on the diagram's grid`);
			assert.equal(h.model.all('link').length, 1, `${p}: and its link drawn`);
			// the occupancy index keys each anchor by the diagram's square
			assert.deepEqual(h.model.index.anchorsAt({ x: 13 * p + p / 4, y: 12 * p - p / 4 }), [stops.length && h.model.all('node').find((n) => n.x === 13 * p && n.y === 12 * p).id], `${p}: the index files a stop by its square of ${p}`);
			assert.equal(h.input.pitch(), p, `${p}: and the other diagram, at ${other}, changed nothing here`);
		}
	} finally { for (const h of hs.reverse()) h.restore(); }
});

test('GR4, PZ32 (move 13): the text tool -- a box begun at 160,160 on a diagram at 80 lands there, its counts and its size in the unit; at 120 likewise', () => {
	const unitFrame = (cols, rows) => ({ w: (cols - 1) * 60 + 40, h: (rows - 1) * 60 + 40 });   // a span of the unit through its cells' points, grown by the frame's margin of 20
	const frame = DEVICE_PRESSES.find((r) => r.id === 'tool').box.frame;
	for (const [p, from, to, span] of [[80, [170, 150], [330, 250], { cols: 4, rows: 2 }], [120, [130, 110], [370, 230], { cols: 5, rows: 3 }]]) {
		const h = composed(p);
		try {
			h.capture.onKeyDown(key('t'));
			h.capture.onDown(pointer(...from));
			h.capture.onMove(pointer(...to));
			h.capture.onUp(pointer(...to));
			const tb = h.model.all('node').find((n) => n.type === 'text');
			const a = h.input.snapNode({ x: from[0], y: from[1] }), b = h.input.snapNode({ x: to[0], y: to[1] });
			assert.deepEqual({ x: tb.x, y: tb.y }, a, `${p}: the box's anchor, the lesser corner, on the diagram's grid`);
			assert.equal(a.x % p, 0, `${p}: control -- the corner is the grid's`);
			assert.deepEqual(tb.span, span, `${p}: its counts in the unit, 1 + round(d / 60) on each axis`);
			const f = frame(a, b);
			assert.deepEqual({ w: f.w, h: f.h }, unitFrame(span.cols, span.rows), `${p}: its frame a span of the unit`);
		} finally { h.restore(); }
	}
});

// ---- the dots, a zone's corner drag, its size step and the wrap, the crosshair ----

// RESTATED at H26.6's move 14 (appendix B, move 13's remainder): the zone's dots from the one record too
test('GR4 (moves 13 and 14): the dots -- the device lattice\'s and the zone lattice\'s, half a square off, and a tier\'s, each from the diagram\'s grid record', () => {
	const [dots, zoneDots] = LAYOUTS_CANVAS.grids;
	for (const p of [60, ...GRIDS]) {
		const m = sized(new Model(), p), decl = (g, every) => { const { pitch, origin } = g.lattice(m, every).declaration; return [pitch, origin.x, origin.y]; };
		assert.deepEqual(decl(dots), [p, 0, 0], `${p}: the device lattice's dots`);
		assert.deepEqual(decl(zoneDots), [p, p / 2, p / 2], `${p}: the zone lattice's, half a square off`);
		assert.deepEqual(decl(dots, 5), [5 * p, 0, 0], `${p}: a tier of five squares`);
		assert.deepEqual(decl(zoneDots, 5), [5 * p, p / 2, p / 2], `${p}: and the zone's, through the same origin`);
	}
});

test('GR4 (move 13): a zone on a diagram at 80 and 120 -- its corner drag, its size step and the wrap on the diagram\'s zone lattice, a device\'s bounds in the unit', () => {
	const handle = ZONE_HANDLE_SPECS.find((s) => s.start && s.at);
	for (const p of GRIDS) {
		const m = sized(new Model(), p), half = p / 2;
		const zone = { id: 'zone-ee0001', name: 'z', x: half, y: half, w: 2 * p, h: p };
		const ctx = handle.start(zone, 'se', m);
		assert.deepEqual(handle.at(ctx, { x: half + 4 * p + 9, y: half + 3 * p - 7 }), { x: half, y: half, w: 4 * p, h: 3 * p }, `${p}: a corner dragged lands on the zone lattice`);
		assert.deepEqual(ZONE_SIZE_STEP.step(zone, 1, 1, m), { x: half, y: half, w: 3 * p, h: 2 * p }, `${p}: a size step is a square of the diagram's grid`);
		assert.deepEqual(ZONE_SIZE_STEP.step(zone, 0, -1, m), null, `${p}: and holds a square at least`);
	}
	const h = composed(80);
	try {
		h.model.put('node', { ...PANEL, x: 160, y: 80, span: { cols: 5, rows: 2 } });   // 5 by 2 units: its bounds 160,80 to 400,140 -- in squares of 80, to 480
		h.selection.set([PANEL.id]);
		h.capture.onKeyDown(key('z'));
		h.history.flush();
		const [z] = h.model.all('zone');
		assert.deepEqual({ x: z.x, y: z.y, w: z.w, h: z.h }, { x: 120, y: 40, w: 320, h: 160 }, '80: the wrap encloses the unit\'s bounds grown half a square, on the zone lattice of 80 -- the bounds in squares of 80 would wrap 400 wide');
		assert.ok(makeZone, 'control: the zones plugin\'s factory composed');
	} finally { h.restore(); }
});

test('GR4 (move 13): the crosshair\'s box is a square of the diagram\'s grid, as the composition hands it', () => {
	const shown = [];
	const scene = { put: (layer, id, shapes) => shown.push(shapes), remove() {}, visible: () => ({ region: { x: 0, y: 0, w: 1000, h: 1000 } }), onView() {} };
	let pitch = 80;
	const c = crosshair(scene, () => pitch, { schedule: (fn) => fn() });
	c.show({ x: 160, y: 80 });
	pitch = 120;
	c.show({ x: 240, y: 120 });
	const boxes = shown.flat(Infinity).filter((s) => s?.attrs?.class === 'snapbox').map((s) => s.attrs.width);
	assert.deepEqual(boxes.slice(-2), [80, 120], 'the box a square wide, read at each put');
	const compose = fs.readFileSync(new URL('../app/src/compose-canvas.js', import.meta.url), 'utf8');
	assert.match(compose, /crosshair\(\w+, \(\) => pitchOf\(places, model\)/, 'the composition hands the diagram\'s square');
});

// ---- the planner every door shares: validation ----

const putNode = (m, x, y) => plan(m, [{ op: 'put', kind: 'node', entity: { id: 'node-ee0001', name: 'n', type: 'host', x, y } }]);
const putZone = (m, x, y, w, h) => plan(m, [{ op: 'put', kind: 'zone', entity: { id: 'zone-ee0001', name: 'z', x, y, w, h } }]);
const refusal = (answer) => (answer.ok === false ? String(answer.error) : null);

test('GR4 (move 13): validation -- an anchor and a zone on a diagram\'s grid accepted by the planner, refused on another, the sentence naming the grid', () => {
	const m60 = new Model(), m80 = sized(new Model(), 80), m120 = sized(new Model(), 120);
	assert.equal(refusal(putNode(m80, 160, -80)), null, '80: an anchor at 160,-80 is on its grid');
	assert.match(refusal(putNode(m60, 160, -80)) ?? '', /off the diagram's grid of 60/, '60: and off this one');
	assert.match(refusal(putNode(m120, 160, -80)) ?? '', /off the diagram's grid of 120 -- an anchor sits on a multiple of 120/, '120: and this one');
	assert.equal(refusal(putNode(m120, 240, 360)), null, '120: an anchor at 240,360');
	assert.equal(refusal(putNode(m60, 240, 360)), null, '60: which 60 holds too');
	assert.match(refusal(putNode(m80, 240, 360)) ?? '', /off the diagram's grid of 80/, '80: but not 80');
	// a zone: its corner half a square past a multiple of the pitch, its sides whole squares
	assert.equal(refusal(putZone(m80, 40, -40, 80, 160)), null, '80: corner 40,-40, one square by two');
	assert.match(refusal(putZone(m60, 40, -40, 80, 160)) ?? '', /off the diagram's zone grid -- half a square, 30, past a multiple of 60/, '60: refused');
	assert.match(refusal(putZone(m80, 30, 30, 60, 60)) ?? '', /off the diagram's zone grid -- half a square, 40, past a multiple of 80/, '80: 60\'s zone corner refused');
	assert.match(refusal(putZone(m80, 40, 40, 60, 80)) ?? '', /is 60 by 80, not whole squares of the diagram's grid of 80, one at least/, '80: a side of 60 is no square of 80');
	assert.equal(refusal(putZone(m120, 60, 60, 240, 120)), null, '120: corner 60,60, two squares by one');
	assert.match(refusal(putZone(m120, 60, 60, 180, 120)) ?? '', /not whole squares of the diagram's grid of 120/, '120: three units is no whole square of 120');
	// a set of one field, as a move is, judged on that field
	const moved = sized(new Model(), 80);
	assert.equal(refusal(putNode(moved, 0, 0)), null, 'control: placed');
	moved.put('node', { id: 'node-ee0001', name: 'n', type: 'host', x: 0, y: 0 });
	assert.equal(refusal(plan(moved, [{ op: 'set', kind: 'node', id: 'node-ee0001', patch: { x: 240 } }])), null, '80: a move to x 240');
	assert.match(refusal(plan(moved, [{ op: 'set', kind: 'node', id: 'node-ee0001', patch: { x: 180 } }])) ?? '', /off the diagram's grid of 80/, '80: a move to x 180 refused');
});

// RESTATED at H26.6's move 15: a diagram stored at 80 loads clean, its anchors judged on its own grid
test('GR4 (moves 13 and 15): at load, an anchor is judged on its own document\'s grid -- refused at 60 off its grid, and at 80 accepted on it', () => {
	const doc = (pitch, x) => {
		const m = sized(new Model(), pitch);
		m.put('node', { id: 'node-ee0001', name: 'n', type: 'host', x, y: 0 });
		return { ...m.toJSON(), meta: { id: 'template-ee0001', name: 'g', schema: 4 } };
	};
	const at60 = validateDoc(doc(60, 80));
	assert.match(String(at60), /node-ee0001 lies at 80,0, off the diagram's grid of 60/, '60: an anchor at 80 refused at load');
	assert.equal(validateDoc(doc(60, 120)), null, 'control: 60 holds 120,0');
	assert.equal(validateDoc(doc(80, 80)), null, '80: a document stored at 80, its anchor at 80, loads clean (from move 15)');
	assert.match(String(validateDoc(doc(80, 60))), /node-ee0001 lies at 60,0, off the diagram's grid of 80/, '80: an anchor at 60 refused on it');
});

// ---- placement and the export ----

test('GR4 (move 13): placement -- the free anchor near a device is the next square of the diagram\'s grid, two diagrams at once', () => {
	const boards = [60, ...GRIDS].map((p) => { const m = sized(new Model(), p); m.put('node', { id: 'node-ee0001', name: 'lb', type: 'host', x: 2 * p, y: p }); return [p, m]; });
	const squares = boards.map(([p, m]) => { const got = resolveAnchor(m, { near: 'lb' }); assert.equal(got.ok, true, `${p}: placed`); return { p, x: got.x, y: got.y }; });
	for (const { p, x, y } of squares) {
		assert.deepEqual([x % p, y % p], [0, 0], `${p}: on the diagram's grid`);
		assert.deepEqual([x / p, y / p], [squares[0].x / 60, squares[0].y / 60], `${p}: the same square as 60's, counted in its own`);
	}
});

const PANEL = { id: 'node-ee0002', name: 'panel', type: 'host', shape: 'square', x: 240, y: 240, span: { cols: 3, rows: 2 },
	content: [{ content: 'text', at: [1, 0], cols: 2, rows: 2, value: 'unit' }] };
test('GR4 (move 13): the export -- a 3 by 2 panel\'s frame, sockets, content cells, footprint and bounds identical at 60, 80 and 120', () => {
	const svgAt = (p) => {
		const m = sized(new Model(), p);
		m.put('node', PANEL);
		m.put('node', { id: 'node-ee0003', name: 'h', type: 'host', x: 0, y: 0 });
		return svgDocument({ ...m.toJSON(), meta: { id: 'template-ee0001', name: 'g', schema: 4 } });
	};
	const at60 = svgAt(60);
	assert.match(at60, /viewBox="/, 'control: an svg');
	for (const p of GRIDS) assert.equal(svgAt(p), at60, `${p}: byte for byte 60's -- a device's size is the unit's`);
	// and the canvas's: the anchor's place sizes the panel in the unit on a diagram of any grid
	for (const p of [60, ...GRIDS]) {
		const h = composed(p);
		try {
			h.model.put('node', PANEL);
			assert.deepEqual(h.input.places.get('node').size(h.model.get('node', PANEL.id)), { w: 120, h: 60 }, `${p}: the footprint's span, 3 by 2 units from cell 0,0`);
		} finally { h.restore(); }
	}
});

test('GR4 (move 13): a 3 by 2 panel\'s sockets and content cells a unit apart in its own frame, whatever the diagram\'s grid', () => {
	const device = DEVICES_CANVAS.appearances.find((a) => a.parts?.sockets).parts;
	const sockets = device.sockets(PANEL, { renderOpts: () => ({ sockets: true }) }).map((r) => [r.attrs.x + r.attrs.width / 2, r.attrs.y + r.attrs.height / 2]);
	assert.deepEqual(sockets, [[0, 0], [60, 0], [120, 0], [0, 60], [60, 60], [120, 60]], 'six sockets, a unit apart');
	const SE = L_STD.socket.ext, cell = contentLayout(PANEL.content[0]);
	assert.deepEqual([cell.x0, cell.y0, cell.w, cell.h], [60 - SE, -SE, 60 + 2 * SE, 60 + 2 * SE], 'the content region at cell 1,0, two by two, in the unit');
});

test('GR4 (move 13): a move\'s quantum -- a drag held at a bounded place\'s edge snaps back by the diagram\'s square', () => {
	for (const p of GRIDS) {
		// a footprint a unit wide, so the far edge leaves room for a whole number of the diagram's squares and no multiple of the unit
		const bounded = openGrid({ shape: 'square', pitch: p, origin: { x: 0, y: 0 }, bounds: { min: { x: -5 * p, y: -5 * p }, max: { x: 5 * p, y: 5 * p } } }).grid;
		const places = placesOf([{ owner: 'p', places: [{ kind: 'node', layout: 'node', lattice: () => bounded, size: () => ({ w: 60, h: 60 }) }] }]);
		const m = sized(new Model(), p);
		m.put('node', { id: 'node-ee0001', name: 'n', type: 'host', x: 0, y: 0 });
		const moved = [{ kind: 'node', id: 'node-ee0001', before: { x: 0, y: 0 } }];
		assert.deepEqual(clampDelta(m, moved, { x: 9 * p, y: 9 * p }, places), { x: 4 * p, y: 4 * p }, `${p}: held inside the far edge, ${5 * p - 60} free, by a whole number of its squares`);
		assert.deepEqual(clampDelta(m, moved, { x: -9 * p, y: 2 * p }, places), { x: -5 * p, y: 2 * p }, `${p}: and at the near edge`);
	}
});

// ---- the simulation's reports, in the diagram's squares (PZ19) ----

const arena = (p) => {
	const k = p / 60, m = sized(new Model(), p);
	m.put('node', { id: 'node-aa0001', name: 'node-aa0001', x: 0, y: 0, spawn: { interval: 900, speed: 1.4, kind: 'packet', since: 0 } });
	m.put('node', { id: 'node-aa0002', name: 'node-aa0002', x: 1200 * k, y: 0 });
	m.put('pipe', pipeEntity('node-aa0001', 'node-aa0002', 'link'));
	m.put('link', { id: 'link-aa0003', name: 'link-aa0003', src: 'node-aa0001', dst: 'node-aa0002' });
	m.put('node', { id: 'node-bb0001', type: 'loadbalancer', x: 600 * k, y: 0 });
	return m;
};
test('GR4, PZ19 (move 13): the simulation -- on a diagram scaled square for square, the movers and combat reports equal 60\'s in squares', () => {
	const strip = (r) => ({ ...r, towers: r.towers.map(({ x, y, ...t }) => t) });
	const [m60, ...others] = [60, ...GRIDS].map(arena);
	for (const at of [2_000, 7_500, 30_000]) {
		const movers60 = moversReport(m60, at, null, moversAt), combat60 = strip(combatReport(m60, at));
		assert.equal(movers60.spawners[0].cells, 20, 'control: the route is 20 squares at 60');
		assert.ok(combat60.beams > 0 || combat60.destroyed > 0 || at < 7_500, 'control: the tower engages');
		for (const [i, m] of others.entries()) {
			assert.deepEqual(moversReport(m, at, null, moversAt), movers60, `${GRIDS[i]} at ${at}ms: the movers report, cells, speed, transit and progress, as 60's`);
			assert.deepEqual(strip(combatReport(m, at)), combat60, `${GRIDS[i]} at ${at}ms: the combat report, range in squares, as 60's`);
		}
	}
});

// ---- GR16: no reader asks a fixed lattice where a position lies ----

test('GR16 (move 13): NODE_GRID is named nowhere, and UNIT_GRID is asked only for a span from cell 0,0', () => {
	const files = fs.readdirSync('.', { recursive: true }).filter((f) => /\.(mjs|js)$/.test(f) && !/^(node_modules|dev|tests|\.git)\//.test(f) && !f.includes('/node_modules/'));
	const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
	const asks = [];
	for (const f of files) {
		const code = strip(fs.readFileSync(f, 'utf8'));
		assert.doesNotMatch(code, /\bNODE_GRID\b/, `${f} names NODE_GRID`);
		// each mention: an import, the definition, or an ask -- the ask's method and its first argument read
		for (const m of code.matchAll(/\bUNIT_GRID\b(?!\s*[,}]|\s*=|\s+from|\s*\}\s*from)([^;\n]{0,40})/g)) asks.push([f, m[1]]);
	}
	assert.ok(asks.length >= 3, 'control: the unit\'s readers found');
	for (const [f, a] of asks) assert.match(a, /^\.span\(\{ col: 0, row: 0 \},/, `${f}: UNIT_GRID asked as \`UNIT_GRID${a}\` -- only a span from cell 0,0`);
});
