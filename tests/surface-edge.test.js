/*
B27 (H20.4) -- ONE SURFACE EDGE AT EVERY DOOR.

Each field was checked alone, never the extent they make together: a zone at x 870 with w 1800 reached 2670 px against an edge of
930, and a 64 x 64 panel at the edge reached 4680 against 900 -- admitted by the planner at every door, while the browser's drag held
both inside (app/src/snap.js `clampDelta`). A content region was never checked against its own panel, so one could sit wholly outside
it. The rules are now each kind's own: the zones plugin holds a zone's box within the zone extent, the devices plugin a device's span
within the node extent and each content region within its span -- for a put, and for a set judged on the entity as it would stand.
Nothing stored is refused: 0 of 226 zones, 549 devices and 186 regions in production's 38 diagrams, the templates, the lab's boards and
3,529 recorded entities (MEASURED 2026-10-10).

In the browser the panel resize key (Shift+arrow) now grows a span up to the edge and shrinks it down to its content, as the zone's
already stopped at the edge -- so no keypress meets the rule.
RESTATED at H26.6's move 11 (dev/design/components/PAN-ZOOM.md section 3.8, "The bound"; PZ31; 5.1 row 11; appendix A's move 11 rows) --
PZ31'S BOUND AT EVERY DOOR, where the surface's edge was: an anchor's x and y, and a zone's corner and far edge, within 1,000,000 of the
origin, refused past it by the planner every door shares -- a put and a set, the document door, the agent door's REST commit and the CLI
-- on the grid of 60 an anchor at 999,960 accepted and at 1,000,020 refused; a device's span bounded by nothing of its own, its content
within it as before; and the panel resize key growing a span past the old edge to the span cap, its content still its floor.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Model, plan, validateDoc, heldLayouts } from './fixtures/composed.mjs';
import { makeApp } from './fixtures/app.mjs';
import { makeInput, key, seedNodes } from './fixtures/client-harness.mjs';
import { DEVICE_SIZE_STEP } from '../plugins/devices/device-size.mjs';
import { scratchFolder } from '@apnex/clean-runner';   // H26-19 as amended: removed when this file ends, however it ends
import path from 'node:path';
import { main as cli } from '../cli/draw.mjs';   // H26.6's move 11: the CLI's door

const zone = (patch = {}) => ({ id: 'zone-0b2701', name: 'z', x: 750, y: 330, w: 180, h: 180, ...patch });   // to the edge exactly: 930, 510
const panel = (patch = {}) => ({ id: 'node-0b2701', name: 'p', type: 'host', shape: 'square', x: 780, y: 360, span: { cols: 3, rows: 3 }, ...patch });   // 900, 480
const region = (at, cols, rows) => ({ at, cols, rows, content: 'text', value: 'x' });
const put = (m, kind, entity) => plan(m, [{ op: 'put', kind, entity }]);
const set = (m, kind, id, patch) => plan(m, [{ op: 'set', kind, id, patch }]);

test('B27, restated at H26.6 move 11: a zone reaching past PZ31\'s bound is refused, put or set; past the old edge, or to the bound exactly, admitted', () => {
	const m = new Model();
	assert.equal(put(m, 'zone', zone()).ok, true, 'to the old edge exactly');
	assert.equal(put(new Model(), 'zone', zone({ x: 870, w: 1800 })).ok, true, 'the row\'s own case, reaching 2670: past the old edge, admitted');
	const atBound = zone({ x: 999_810, y: -999_990, w: 180, h: 1_999_980 });
	assert.equal(put(new Model(), 'zone', atBound).ok, true, 'to the bound exactly: far edge 999,990, a corner at -999,990');
	const wide = put(new Model(), 'zone', { ...atBound, w: 240 });
	assert.equal(wide.ok, false, 'a cell past the bound');
	assert.match(wide.error, /zone-0b2701 reaches 1000050,999990, past the bound of 1000000 from the origin/);
	assert.equal(put(new Model(), 'zone', zone({ x: -1_000_050 })).ok, false, 'a corner past the bound');
	m.put('zone', atBound);
	assert.equal(set(m, 'zone', 'zone-0b2701', { w: 240 }).ok, false, 'grown past it');
	assert.equal(set(m, 'zone', 'zone-0b2701', { x: 999_870 }).ok, false, 'moved past it, its width kept');
	assert.equal(set(m, 'zone', 'zone-0b2701', { x: 999_750 }).ok, true, 'moved inward -- the control');
});

test('B27, restated at H26.6 move 11: an anchor within PZ31\'s bound is admitted, past it refused, put or set; a device\'s span reaches as far as it likes', () => {
	for (const [x, y, ok] of [[999_960, 0, true], [1_000_020, 0, false], [-999_960, 0, true], [-1_000_020, 0, false], [0, 999_960, true], [0, 1_000_020, false], [0, -999_960, true], [0, -1_000_020, false]]) {
		const r = put(new Model(), 'node', { id: 'node-0b2702', name: 'w', x, y });
		assert.equal(r.ok, ok, `an anchor at ${x},${y}`);
		if (!ok) assert.match(r.error, new RegExp(`invalid value for node\\.${x ? 'x' : 'y'}`));
	}
	assert.equal(put(new Model(), 'node', panel({ span: { cols: 4, rows: 3 } })).ok, true, 'a span past the old edge, admitted');
	assert.equal(put(new Model(), 'node', panel({ x: 999_960, y: 999_960, span: { cols: 64, rows: 64 } })).ok, true, 'the row\'s own case at the bound: a 64x64 panel\'s footprint past it, derived and bounded by nothing of its own');
	const m = new Model();
	m.put('node', panel());
	assert.equal(set(m, 'node', 'node-0b2701', { x: 1_000_020 }).ok, false, 'moved past the bound');
	assert.equal(set(m, 'node', 'node-0b2701', { x: 999_960, span: { cols: 64, rows: 64 } }).ok, true, 'moved to it, its span grown');
});

test('B27: a content region outside its panel is refused, put or set -- a shrink that would leave one outside included', () => {
	const m = new Model();
	assert.equal(put(m, 'node', panel({ content: [region([0, 0], 3, 3)] })).ok, true, 'a region filling the panel -- the control');
	const out = put(new Model(), 'node', panel({ content: [region([2, 0], 2, 1)] }));
	assert.equal(out.ok, false, 'a region a column past the panel');
	assert.match(out.error, /node-0b2701's content region at \[2,0\], 2x1, falls outside its 3x3 span/);
	assert.match(put(new Model(), 'node', (({ span: _none, ...one }) => ({ ...one, x: 0, y: 0, content: [region([1, 0], 1, 1)] }))(panel())).error ?? '', /region at \[1,0\], 1x1, falls outside its 1x1 span/, 'a device of one cell holds a region at its one cell only');
	m.put('node', panel({ content: [region([0, 0], 3, 3)] }));
	assert.equal(set(m, 'node', 'node-0b2701', { span: { cols: 2, rows: 3 } }).ok, false, 'a shrink leaving the region outside');
	assert.equal(set(m, 'node', 'node-0b2701', { content: [region([0, 0], 3, 4)] }).ok, false, 'a region grown past its panel');
});

test('B27, restated at H26.6 move 11: a document holding an anchor or a zone past PZ31\'s bound is refused at the document door -- create, boot, restore', () => {
	const doc = (patch) => ({ meta: { id: '00000000000b2701', name: 'd' }, layouts: heldLayouts(), nodes: [], zones: [], links: [], pipes: [], groups: [], ...patch });
	assert.equal(validateDoc(doc({ zones: [zone({ w: 240 }), { ...zone({ id: 'zone-0b2702', x: -990, y: -570 }) }], nodes: [panel({ span: { cols: 4, rows: 3 } }), { id: 'node-0b2703', name: 'w', x: 999_960, y: -999_960 }] })), null,
		'past the old edges and to the bound -- admitted');
	assert.match(validateDoc(doc({ zones: [zone({ x: 999_870, w: 240 })] })), /past the bound of 1000000 from the origin/);
	assert.match(validateDoc(doc({ nodes: [{ id: 'node-0b2703', name: 'w', x: 1_000_020, y: 0 }] })) ?? '', /node/, 'an anchor past the bound');
	assert.match(validateDoc(doc({ nodes: [panel({ content: [region([3, 0], 1, 1)] })] })), /falls outside its 3x3 span/);
});

test('B27, restated at H26.6 move 11: the agent door\'s REST commit and the CLI\'s each admit an anchor at 999,960 and refuse one at 1,000,020, and refuse a zone past the bound, naming it', async () => {
	const dir = scratchFolder('draw-edge-'), home = scratchFolder('draw-edge-home-');
	const app = await makeApp({ dataDir: dir, port: 0 });
	try {
		const base = `http://localhost:${app.port}`;
		const id = (await (await fetch(`${base}/api/v1/diagrams`)).json())[0].id;
		const lock = await (await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'POST' })).json();
		const commit = (ops) => fetch(`${base}/api/v1/diagrams/${id}/commit`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Draw-Lock': lock.token }, body: JSON.stringify({ ops }) });
		assert.equal((await commit([{ op: 'put', kind: 'node', entity: { id: 'node-0b2711', name: 'far', x: 999_960, y: 0 } }])).status, 200, 'REST: an anchor at 999,960');
		const past = await commit([{ op: 'put', kind: 'node', entity: { id: 'node-0b2712', name: 'too-far', x: 1_000_020, y: 0 } }]);
		assert.notEqual(past.status, 200, 'REST: one at 1,000,020 refused');
		assert.match((await past.json()).error, /invalid value for node\.x/);
		const r = await commit([{ op: 'put', kind: 'zone', entity: zone({ x: 999_870, w: 240 }) }]);
		assert.notEqual(r.status, 200);
		assert.match((await r.json()).error, /zone-0b2701 reaches 1000110,510, past the bound of 1000000 from the origin/);
		await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'DELETE', headers: { 'X-Draw-Lock': lock.token } });
		// the CLI's door: `draw commit --ops`, through the same route
		const out = [], errs = [];
		const run = async (...argv) => { out.length = 0; await cli([...argv, '--host', `http://127.0.0.1:${app.port}`], { HOME: home }, (t) => out.push(t)); return out.join(''); };
		const ops = (o) => { const f = path.join(home, `ops-${errs.length}-${Math.random().toString(36).slice(2)}.json`); fs.writeFileSync(f, JSON.stringify({ ops: o })); return f; };
		await run('lock', '--diagram', id);
		assert.match(await run('commit', '--diagram', id, '--ops', ops([{ op: 'put', kind: 'node', entity: { id: 'node-0b2721', name: 'cli-far', x: 0, y: -999_960 } }])), /^v\d+/, 'CLI: an anchor at 0,-999,960');
		const ew = process.stderr.write.bind(process.stderr), exit = process.exit;
		process.stderr.write = (t) => { errs.push(String(t)); return true; };
		process.exit = () => { throw new Error('__exit__'); };
		try { await run('commit', '--diagram', id, '--ops', ops([{ op: 'put', kind: 'node', entity: { id: 'node-0b2722', name: 'cli-too-far', x: 0, y: -1_000_020 } }])); } catch (e) { if (e.message !== '__exit__') throw e; } finally { process.stderr.write = ew; process.exit = exit; }
		assert.match(errs.join(''), /invalid value for node\.y/, 'CLI: one at 0,-1,000,020 refused, the planner\'s reason shown');
		await run('unlock', '--diagram', id).catch(() => {});
	} finally { await app.close(); fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(home, { recursive: true, force: true }); }
});

test('B27, restated at H26.6 move 11: in the browser the panel resize key grows a span past the old edge to the span cap and shrinks it down to its content', () => {
	const arrow = (k) => key(k, { shiftKey: true });
	const h = makeInput();
	try {
		const [d] = seedNodes(h.model, [[780, 360, 'host']]);
		h.model.set('node', d.id, { span: { cols: 3, rows: 3 }, content: [region([0, 0], 2, 2)] });
		h.selection.set([d.id]);
		h.capture.onKeyDown(arrow('ArrowRight'));
		assert.deepEqual(h.model.get('node', d.id).span, { cols: 4, rows: 3 }, 'at the old edge: a column more, past it');
		for (let i = 0; i < 4; i++) h.capture.onKeyDown(arrow('ArrowLeft'));
		assert.deepEqual(h.model.get('node', d.id).span, { cols: 2, rows: 3 }, 'shrunk to its content, two columns, and no further');
		h.capture.onKeyDown(arrow('ArrowUp'));
		assert.deepEqual(h.model.get('node', d.id).span, { cols: 2, rows: 2 }, 'a row less, to its content');
		// the key proposes no step the planner would refuse -- not merely a step the planner then refuses
		const at = h.model.get('node', d.id);
		assert.deepEqual(DEVICE_SIZE_STEP.step({ ...at, span: { cols: 3, rows: 3 } }, 1, 0), { span: { cols: 4, rows: 3 } }, 'a column past the old edge is proposed');
		assert.equal(DEVICE_SIZE_STEP.step({ ...at, span: { cols: 64, rows: 64 } }, 1, 1), null, 'none past the span cap');
		assert.equal(DEVICE_SIZE_STEP.step(at, 0, -1), null, 'no row below the content is proposed');
		assert.equal(DEVICE_SIZE_STEP.step(at, -1, 0), null, 'no column below the content is proposed');
	} finally { h.restore(); }
});
