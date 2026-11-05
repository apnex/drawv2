/*
H26.6's move 15 (dev/design/components/PAN-ZOOM.md section 3.5; PZ1 to PZ4, PZ19, PZ21, PZ29, PZ31; GR4, GR8, GR18; 5.1 row 15; appendix A's
three move 15 rows) -- A SIZE CHANGE, BY LATTICE INDEX.

The grid record's `pitch` is set as any edit and the layouts plugin's reaction moves every anchor and every zone's corners by lattice
index -- each keeps its square, every device its own size, the diagram scaled by the new size over the old, exactly (the director's Q3:
"Keep their square. This was my original intent."). Held here:
  - the oracle: every stored board at 80, 100 and 120 equal, entity by entity, to the drafter's `size-change.expected.json`
    (tests/fixtures/size-change-expected.json, its stored half, copied verbatim -- never the reaction's own code), everything else equal;
  - 60 to 60 changes nothing; 40, 58, 61, 122 and 140 refused naming the range (PZ21, ruled);
  - the lone edit: a request whose result keeps another edit beside the grid refused, a put of the record changing `pitch` alone accepted
    with the set's result, a put changing its `name` refused; PZ31's bound naming the entity and where it would land;
  - GR18, `layout-roundtrip.mjs`'s cases;
  - one commit and one undo; the notice;
  - the doors at 80 and 120 (GR4, GR8): the agent door's commit and its notice, its ops the page's own preview's, the routes and validation
    on the new grid; the CLI's `grid` verb; the page's composition committing the grid field's ops.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Model, plan, commit, undo } from './fixtures/composed.mjs';
import { Log } from '../planner/log.mjs';
import { storedDocuments } from './fixtures/native-record.mjs';
import { sizeChangeNotice, attachGridField } from '../plugins/layouts/size-notice.mjs';
import { makeApp } from './fixtures/app.mjs';
import { makeInput, key, pointer } from './fixtures/client-harness.mjs';
import { scratchFolder } from '@apnex/clean-runner';
import { main } from '../cli/draw.mjs';

const EXPECTED = JSON.parse(fs.readFileSync(new URL('./fixtures/size-change-expected.json', import.meta.url), 'utf8'));
const P = (pitch) => ({ op: 'set', kind: 'layout', id: 'layout-000001', patch: { pitch } });
const setGridOps = (pitch) => [P(pitch)];
const gridEdit = (pitch) => ({ label: `grid ${pitch}`, entries: [{ op: 'set', kind: 'layout', id: 'layout-000001', after: { pitch } }] });   // as the page's history takes it
const gridSizeOf = (m) => m.get('layout', 'layout-000001').pitch;
// a select element, as much of one as the grid field touches
const fakeSelect = () => {
	const doc = { activeElement: null, createElement: () => ({}) };
	const listeners = {};
	return { ownerDocument: doc, options: [], value: '', append(o) { this.options.push(o); }, addEventListener(type, fn) { listeners[type] = fn; }, blur() {}, choose(v) { this.value = String(v); listeners.change(); } };
};
const loaded = (doc) => { const m = new Model(); m.load(structuredClone(doc)); return m; };
// a document with everything a position lives on: a device, a waypoint, a 3 by 2 panel and a zone holding the device
const board = () => {
	const m = new Model();
	m.put('node', { id: 'node-5c0001', name: 'a', type: 'host', shape: 'circle', x: 60, y: 0 });
	m.put('node', { id: 'node-5c0002', name: 'w', x: 240, y: -120 });
	m.put('node', { id: 'node-5c0003', name: 'p', type: 'text', shape: 'square', x: -300, y: 180, span: { cols: 3, rows: 2 }, content: [{ at: [0, 0], cols: 3, rows: 1, content: 'text', value: 'kept' }] });
	m.put('zone', { id: 'zone-5c0001', name: 'z', x: 30, y: -30, w: 60, h: 60 });
	return m;
};
// everything but the positions a size change moves, and the record's pitch
const unmoved = (doc) => JSON.stringify({ ...doc, meta: { ...doc.meta, version: null }, layouts: doc.layouts.map(({ pitch, ...l }) => l), nodes: doc.nodes.map(({ x, y, ...n }) => n), zones: (doc.zones ?? []).map(({ x, y, w, h, ...z }) => z) });

test('H26.6 move 15: every stored board at 80, 100 and 120 equals the drafter\'s oracle, anchor by anchor and zone by zone, and nothing else changes', () => {
	const boards = storedDocuments();
	assert.equal(boards.length, 18, 'control: the 18 stored boards');
	assert.deepEqual(EXPECTED.sizes, [80, 100, 120]);
	for (const [name, doc] of boards) for (const size of EXPECTED.sizes) {
		const want = EXPECTED.documents[name][size], m = loaded(doc), before = m.toJSON();
		const r = commit(m, new Log(), { ops: [P(size)], label: `grid ${size}` }, 'server', 'test');
		assert.equal(r.ok, true, `${name} at ${size}: ${r.error}`);
		const after = m.toJSON();
		assert.deepEqual(Object.fromEntries(after.nodes.map((n) => [n.id, [n.x, n.y]])), want.anchors, `${name} at ${size}: every anchor where the oracle puts it`);
		assert.deepEqual(Object.fromEntries((after.zones ?? []).map((z) => [z.id, [z.x, z.y, z.w, z.h]])), want.zones, `${name} at ${size}: every zone's rect`);
		assert.equal(gridSizeOf(m), size, `${name}: the record's pitch`);
		assert.equal(unmoved(after), unmoved(before), `${name} at ${size}: every other field of every entity as it was -- spans, content, links, pipes, groups`);
		assert.equal(sizeChangeNotice(loaded(doc), r.change).size, size, `${name}: the notice its size`);
	}
});

test('H26.6 move 15: 60 to 60 changes nothing; 40, 58, 61, 122 and 140 are refused naming the range (PZ21, ruled)', () => {
	const m = board(), r = plan(m, [P(60)]);
	assert.equal(r.ok, true);
	assert.deepEqual(r.ops, [], '60 to 60: no op at all');
	for (const size of [40, 58, 61, 122, 140, 0, -60]) {
		const x = plan(m, [P(size)]);
		assert.equal(x.ok, false, `${size} refused`);
		assert.match(x.error, size > 0 ? new RegExp(`the grid size ${size} is refused -- a diagram's grid is an even size from 60 to 120 \\(PZ21\\)`) : /layout\.pitch/, `${size}: named`);
	}
	for (const size of [62, 80, 100, 118, 120]) assert.equal(plan(m, [P(size)]).ok, true, `${size} accepted`);
	const select = fakeSelect();
	attachGridField(select, { model: m, commit: () => [], flash: () => {} });
	const sizes = select.options.map((o) => Number(o.value));
	assert.deepEqual([sizes.length, sizes[0], sizes.at(-1), sizes.every((s) => s % 2 === 0), select.options[10].textContent], [31, 60, 120, true, 'grid 80'], 'the field offers the sizes the row admits');
});

test('H26.6 move 15: a size change moves by index -- devices, waypoints, a panel by its anchor, a zone by its corners -- and keeps every size', () => {
	const m = board();
	assert.equal(commit(m, new Log(), { ops: [P(80)], label: 'grid' }, 'server', 't').ok, true);
	assert.deepEqual(['node-5c0001', 'node-5c0002', 'node-5c0003'].map((id) => [m.get('node', id).x, m.get('node', id).y]), [[80, 0], [320, -160], [-400, 240]], 'each anchor at its index times 80');
	assert.deepEqual(m.get('zone', 'zone-5c0001'), { id: 'zone-5c0001', name: 'z', x: 40, y: -40, w: 80, h: 80 }, 'the zone on the zone lattice of 80, one square still, holding its device');
	assert.deepEqual([m.get('node', 'node-5c0003').span, m.get('node', 'node-5c0003').content[0].value], [{ cols: 3, rows: 2 }, 'kept'], 'the panel its own size in the unit (PZ18)');
});

test('H26.6 move 15: the lone edit -- beside a rename refused; a put of the record changing pitch alone accepted with the set\'s result; a put changing its name refused', () => {
	const rename = plan(board(), [{ op: 'set', kind: 'node', id: 'node-5c0001', patch: { name: 'b' } }, P(80)]);
	assert.equal(rename.ok, false);
	assert.match(rename.error, /a grid size change is an edit of its own -- node b would change beside the grid of 80; set the grid alone, then edit/);
	assert.match(plan(board(), [{ op: 'meta', patch: { name: 'renamed' } }, P(80)]).error ?? '', /a grid size change is an edit of its own -- the diagram's meta would change/, 'a diagram rename beside it');
	assert.match(plan(board(), [{ op: 'put', kind: 'node', entity: { id: 'node-5c0009', name: 'n', type: 'host', x: 120, y: 0 } }, P(80)]).error ?? '', /node n would be made beside the grid of 80/, 'a device made beside it');
	assert.match(plan(board(), [{ op: 'del', kind: 'zone', id: 'zone-5c0001' }, P(80)]).error ?? '', /zone z would be deleted beside the grid of 80/, 'a zone deleted beside it');
	const set = plan(board(), [P(100)]), put = plan(board(), [{ op: 'put', kind: 'layout', entity: { id: 'layout-000001', name: 'grid', pitch: 100 } }]);
	assert.equal(put.ok, true, `a put changing pitch alone: ${put.error}`);
	assert.deepEqual(put.ops.slice(1), set.ops.slice(1), 'its moves the set\'s');
	const viaSet = board(), viaPut = board();
	commit(viaSet, new Log(), { ops: [P(100)] }, 'server', 't');
	const committedPut = commit(viaPut, new Log(), { ops: [{ op: 'put', kind: 'layout', entity: { id: 'layout-000001', name: 'grid', pitch: 100 } }] }, 'server', 't');
	assert.deepEqual(viaPut.toJSON(), viaSet.toJSON(), 'and its result');
	assert.deepEqual(sizeChangeNotice(board(), committedPut.change), sizeChangeNotice(board(), { ops: [P(100)] }), 'and its notice');
	assert.match(plan(board(), [{ op: 'put', kind: 'layout', entity: { id: 'layout-000001', name: 'mesh', pitch: 100 } }]).error ?? '', /layout\.name/, 'a put changing its name refused');
});

test('H26.6 move 15 (PZ31): a size change landing anything past the bound is refused, naming the entity and where it would land', () => {
	const m = board();
	m.put('node', { id: 'node-5c0004', name: 'far', type: 'host', x: 900_000, y: -60 });
	const r = plan(m, [P(120)]);
	assert.equal(r.ok, false);
	assert.match(r.error, /the grid of 120 would put far at 1800000,-120, past the bound of 1000000 from the origin -- a size change multiplies every position by 120 over 60 \(PZ31\)/);
	assert.equal(plan(m, [P(64)]).ok, true, '64: far lands at 960,000, within');
	const z = board();
	z.put('zone', { id: 'zone-5c0002', name: 'wide', x: 599_970, y: -30, w: 60, h: 60 });
	assert.match(plan(z, [P(100)]).error ?? '', /would put wide at 1000050,-50|would put wide at 1000050,50/, 'a zone\'s far edge, past the bound, named');
});

test('H26.6 move 15: an anchor off the old lattice -- which no validated document holds -- is left where it stood, and the result refuses it there', () => {
	const m = board();
	m.put('node', { id: 'node-5c0007', name: 'stray', type: 'host', x: 70, y: 0 });   // straight onto the Model, which validates nothing
	const r = plan(m, [P(80)]);
	assert.equal(r.ok, false);
	assert.match(r.error, /stray at 70,0 would be left off the diagram's grid of 80/, 'named where it stood: the change moves by index, and invents no point for what has none');
});

test('GR18 (H26.6 move 15): layout-roundtrip.mjs\'s cases -- an edit judged against a grid the request restores is refused', () => {
	const at = () => { const m = new Model(); m.put('node', { id: 'node-5c0005', name: 'a', type: 'host', x: 60, y: 0 }); m.put('zone', { id: 'zone-5c0005', name: 'z', x: 30, y: -30, w: 60, h: 60 }); return m; };
	const off = /would be left off the diagram's grid of 60 -- an edit is judged on the grid it is made on, and this request changes the grid around it \(GR18\)/;
	assert.match(plan(at(), [P(80), { op: 'set', kind: 'node', id: 'node-5c0005', patch: { x: 80 } }, P(60)]).error ?? '', off, 'an anchor set to 80 inside a round trip');
	assert.match(plan(at(), [P(80), { op: 'set', kind: 'zone', id: 'zone-5c0005', patch: { x: 40, y: -40, w: 80, h: 80 } }, P(60)]).error ?? '', off, 'a zone\'s edit inside one');
	assert.match(plan(at(), [P(80), { op: 'put', kind: 'node', entity: { id: 'node-5c0006', name: 'n', type: 'host', x: 80, y: 0 } }, P(60)]).error ?? '', off, 'an anchor made inside one');
	const alone = plan(at(), [P(80), P(60)]);
	assert.equal(alone.ok, true, 'a round trip with no other edit');
	const m = at();
	assert.equal(commit(m, new Log(), { ops: [P(80), P(60)] }, 'server', 't').ok, true);
	assert.deepEqual([m.get('node', 'node-5c0005').x, gridSizeOf(m)], [60, 60], 'and it changes nothing');
	assert.equal(plan(at(), [{ op: 'set', kind: 'node', id: 'node-5c0005', patch: { x: 120 } }]).ok, true, 'an anchor set on the grid');
	assert.equal(plan(at(), [P(80)]).ok, true, 'a size change');
});

test('GR8 (H26.6 move 15): a size change is one commit and one undo -- undone, the document is byte for byte what it was', () => {
	const plain = (m) => { const d = m.toJSON(); return JSON.stringify({ ...d, meta: { ...d.meta, version: null } }); };
	const m = board(), before = plain(m), log = new Log();
	const r = commit(m, log, { ops: [P(120)], label: 'grid 120' }, 'server', 't');
	assert.equal(r.ok, true);
	assert.equal(log.records.length, 1, 'one record');
	assert.equal(gridSizeOf(m), 120);
	assert.equal(undo(m, log).ok, true);
	assert.equal(plain(m), before, 'one undo restores every position and the pitch -- the version alone moves on, as any undo\'s');
});

test('H26.6 move 15: the notice -- its size, the old, the factor reduced, and the sentence; none for a change that sets no new grid', () => {
	assert.deepEqual(sizeChangeNotice(board(), { ops: [P(80)] }), { size: 80, from: 60, factor: '4/3', message: 'grid 80: every device, waypoint and zone kept its square -- the diagram scaled by 80/60 (4/3), each device its own size' });
	assert.equal(sizeChangeNotice(board(), { ops: [P(120)] }).factor, '2/1');
	assert.equal(sizeChangeNotice(board(), { ops: [P(60)] }), null, 'the same size');
	assert.equal(sizeChangeNotice(board(), { ops: [{ op: 'set', kind: 'node', id: 'node-5c0001', patch: { x: 120 } }] }), null, 'no grid set');
});

// ---- the doors (GR4 through the doors, GR8) ----

test('GR4, GR8 (H26.6 move 15): the agent door at 80 and 120 -- one commit answered with its notice, its ops the page\'s own preview, the routes and validation on the new grid', async () => {
	const dataDir = scratchFolder('draw-size-change-');
	const app = await makeApp({ dataDir, port: 0 }), base = `http://localhost:${app.port}/api/v1`;
	const h = makeInput();
	try {
		const id = (await (await fetch(`${base}/diagrams`)).json())[0].id;
		const doc = await (await fetch(`${base}/diagrams/${id}`)).json();
		const lock = await (await fetch(`${base}/diagrams/${id}/lock`, { method: 'POST' })).json();
		const send = async (ops) => { const r = await fetch(`${base}/diagrams/${id}/commit`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Draw-Lock': lock.token }, body: JSON.stringify({ ops }) }); return { status: r.status, body: await r.json() }; };
		// the page's own commit of the same request, previewed by its composition, as the grid field commits it
		h.model.load(structuredClone(doc));
		const applied = h.history.commit(gridEdit(80));
		const at80 = await send(setGridOps(80));
		assert.equal(at80.status, 200, JSON.stringify(at80.body));
		assert.deepEqual(at80.body.ops, applied, 'the agent door\'s ops are the page\'s (GR8)');
		assert.deepEqual(at80.body.notice, { size: 80, from: 60, factor: '4/3', message: 'grid 80: every device, waypoint and zone kept its square -- the diagram scaled by 80/60 (4/3), each device its own size' });
		const after = await (await fetch(`${base}/diagrams/${id}`)).json();
		assert.deepEqual(after.nodes.map((n) => [n.x, n.y]), doc.nodes.map((n) => [n.x / 60 * 80, n.y / 60 * 80]), 'every anchor at its index times 80');
		assert.deepEqual(after.nodes.map((n) => [n.x, n.y]), h.model.all('node').map((n) => [n.x, n.y]), 'as the page placed them');
		assert.deepEqual((await (await fetch(`${base}/diagrams/${id}/layouts`)).json()).layouts, [{ id: 'layout-000001', name: 'grid', pitch: 80 }]);
		const near = await (await fetch(`${base}/diagrams/${id}/layouts/node/nearest?x=170&y=50`)).json();
		assert.deepEqual([near.x, near.y], [160, 80], 'nearest on the grid of 80');
		const zoneNear = await (await fetch(`${base}/diagrams/${id}/layouts/zone/nearest?x=170&y=50`)).json();
		assert.deepEqual([zoneNear.x, zoneNear.y], [200, 40], 'and on its zone lattice, half a square off');
		assert.equal((await send([{ op: 'put', kind: 'node', entity: { id: 'node-5c0010', name: 'on', type: 'host', x: 1600, y: 0 } }])).status, 200, 'a device on the grid of 80');
		const off = await send([{ op: 'put', kind: 'node', entity: { id: 'node-5c0011', name: 'off', type: 'host', x: 1620, y: 0 } }]);
		assert.equal(off.status, 422);
		assert.match(off.body.error, /off the diagram's grid of 80/, 'off it, refused naming the grid');
		const at120 = await send(setGridOps(120));
		assert.equal(at120.status, 200);
		assert.deepEqual([at120.body.notice.size, at120.body.notice.from, at120.body.notice.factor], [120, 80, '3/2']);
		const n120 = await (await fetch(`${base}/diagrams/${id}/layouts/node/nearest?x=170&y=50`)).json();
		assert.deepEqual([n120.x, n120.y], [120, 0], 'nearest on the grid of 120');
		for (const size of [40, 140, 61]) {
			const r = await send(setGridOps(size));
			assert.equal(r.status, 422, `${size} refused by the door`);
			assert.match(r.body.error, /an even size from 60 to 120/);
		}
		const beside = await send([...setGridOps(100), { op: 'meta', patch: { name: 'renamed' } }]);
		assert.match(beside.body.error, /a grid size change is an edit of its own/, 'a rename beside it refused');
		// stored at 120: the document loads clean through the store again
		await app.close();
		const again = await makeApp({ dataDir, port: 0 });
		try {
			const back = await (await fetch(`http://localhost:${again.port}/api/v1/diagrams/${id}/layouts`)).json();
			assert.deepEqual(back.layouts, [{ id: 'layout-000001', name: 'grid', pitch: 120 }], 'stored at 120, booted again');
		} finally { await again.close(); }
	} finally { h.restore(); try { await app.close(); } catch { /* closed above */ } fs.rmSync(dataDir, { recursive: true, force: true }); }
});

test('GR4 (H26.6 move 15): the CLI\'s grid verb -- the size, a new size with the route\'s notice, a refused one named', async () => {
	const dataDir = scratchFolder('draw-size-change-cli-'), home = scratchFolder('draw-size-change-home-');
	const app = await makeApp({ dataDir, port: 0 }), host = `http://127.0.0.1:${app.port}`;
	const id = (await (await fetch(`${host}/api/v1/diagrams`)).json())[0].id;
	const run = async (...argv) => { const out = []; await main([...argv, '--diagram', id, '--host', host], { HOME: home }, (s) => out.push(s)); return out.join(''); };
	const refusal = async (fn) => {
		const errs = [], ew = process.stderr.write.bind(process.stderr), exit = process.exit;
		process.stderr.write = (s) => { errs.push(s); return true; };
		process.exit = () => { throw new Error('__exit__'); };
		try { await fn(); } catch (e) { if (e.message !== '__exit__') throw e; } finally { process.stderr.write = ew; process.exit = exit; }
		return errs.join('');
	};
	try {
		assert.match(await run('grid'), /^grid 60\b/, 'the size, a read');
		await run('lock');
		assert.match(await run('grid', '80'), /grid 80: every device, waypoint and zone kept its square -- the diagram scaled by 80\/60 \(4\/3\), each device its own size/);
		const json = JSON.parse(await run('grid', '--json'));
		assert.equal(json.grid, 80);
		assert.equal(JSON.parse(await run('grid', '120', '--json')).notice.factor, '3/2');
		assert.match(await refusal(() => run('grid', '58')), /an even size from 60 to 120/, '58 refused, the range named');
		assert.match(await refusal(() => run('grid', 'big')), /a whole number/);
		assert.match(await run('grid', '120'), /grid 120: unchanged/);
	} finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); fs.rmSync(home, { recursive: true, force: true }); }
});

test('GR4 (H26.6 move 15): the page\'s composition at 80 and 120 -- the grid field\'s commit moves every anchor, and the canvas then works on the new grid', () => {
	for (const size of [80, 120]) {
		const h = makeInput();
		try {
			h.model.put('node', { id: 'node-5c0020', name: 'a', type: 'host', shape: 'circle', x: 120, y: 60 });
			const applied = h.history.commit(gridEdit(size));
			assert.ok(applied.length >= 2, `${size}: the record and the anchor`);
			assert.deepEqual([h.model.get('node', 'node-5c0020').x, h.model.get('node', 'node-5c0020').y, h.input.pitch()], [2 * size, size, size], `${size}: the anchor kept its square`);
			h.selection.set(['node-5c0020']);
			h.capture.onKeyDown(key('ArrowRight'));
			h.history.flush();
			assert.equal(h.model.get('node', 'node-5c0020').x, 3 * size, `${size}: a nudge is a square of the new grid`);
			assert.deepEqual(h.input.snapNode({ x: size + 5, y: -size + 3 }), { x: size, y: -size }, `${size}: a pointer snaps to it`);
			void pointer;
		} finally { h.restore(); }
	}
	// the page wires the field: its sizes, its commit, the notice from its own commit
	const main = fs.readFileSync(new URL('../app/src/main.js', import.meta.url), 'utf8');
	assert.match(main, /attachGridField\(menu\.grid, \{ model, commit: \(edit\) => history\.commit\(edit\), flash: \(text\) => readout\.flash\(text, 4000\) \}\)/, 'the header\'s field commits as any edit and flashes the notice');
	assert.match(fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8'), /<select id="diagram-grid"/, 'the header holds the field');
	assert.match(fs.readFileSync(new URL('../lab/src/root.js', import.meta.url), 'utf8'), /attachGridField\(document\.getElementById\('lab-grid'\), \{ model, commit: \(edit\) => history\.commit\(edit\), flash: say \}\)/, 'and the lab\'s footer');
});

test('PZ29 (H26.6 move 15): the grid field -- its value the model\'s size, a choice committed as the page\'s edit, the notice flashed', () => {
	const h = makeInput();
	try {
		h.model.put('node', { id: 'node-5c0030', name: 'a', type: 'host', shape: 'circle', x: 60, y: 0 });
		const select = fakeSelect(), said = [];
		attachGridField(select, { model: h.model, commit: (edit) => h.history.commit(edit), flash: (text) => said.push(text) });
		assert.equal(select.value, '60', 'the diagram\'s size shown');
		select.choose(100);
		assert.deepEqual([gridSizeOf(h.model), h.model.get('node', 'node-5c0030').x, select.value], [100, 100, '100'], 'committed: the record, the anchor by its index, the field following');
		assert.deepEqual(said, ['grid 100: every device, waypoint and zone kept its square -- the diagram scaled by 100/60 (5/3), each device its own size'], 'the notice flashed');
		assert.deepEqual(h.opsOf(0).map((o) => o.kind), ['layout'], 'the request is the grid alone; the planner moves the rest');
		h.model.set('layout', 'layout-000001', { pitch: 80 });
		assert.equal(select.value, '80', 'the field follows the model -- an undo, another viewer\'s change');
		select.choose(80);
		assert.equal(said.length, 1, 'choosing the size it has flashes nothing');
	} finally { h.restore(); }
});
