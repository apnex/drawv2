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
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Model, plan, validateDoc, heldLayouts } from './fixtures/composed.mjs';
import { makeApp } from './fixtures/app.mjs';
import { makeInput, key, seedNodes } from './fixtures/client-harness.mjs';
import { DEVICE_SIZE_STEP } from '../devices/device-size.mjs';

const zone = (patch = {}) => ({ id: 'zone-0b2701', name: 'z', x: 750, y: 330, w: 180, h: 180, ...patch });   // to the edge exactly: 930, 510
const panel = (patch = {}) => ({ id: 'node-0b2701', name: 'p', type: 'host', shape: 'square', x: 780, y: 360, span: { cols: 3, rows: 3 }, ...patch });   // 900, 480
const region = (at, cols, rows) => ({ at, cols, rows, content: 'text', value: 'x' });
const put = (m, kind, entity) => plan(m, [{ op: 'put', kind, entity }]);
const set = (m, kind, id, patch) => plan(m, [{ op: 'set', kind, id, patch }]);

test('B27: a zone reaching past the surface\'s edge is refused, put or set; one reaching it exactly is admitted', () => {
	const m = new Model();
	assert.equal(put(m, 'zone', zone()).ok, true, 'to the edge exactly -- the control');
	const wide = put(m, 'zone', zone({ w: 240 }));
	assert.equal(wide.ok, false, 'a cell wider');
	assert.match(wide.error, /zone-0b2701 reaches 990,510, past the surface's edge at 930,510/);
	assert.equal(put(m, 'zone', zone({ h: 240 })).ok, false, 'a cell taller');
	assert.equal(put(new Model(), 'zone', zone({ x: 870, w: 1800 })).ok, false, 'the row\'s own case, reaching 2670');
	m.put('zone', zone());
	assert.equal(set(m, 'zone', 'zone-0b2701', { w: 240 }).ok, false, 'grown past it');
	assert.equal(set(m, 'zone', 'zone-0b2701', { x: 810 }).ok, false, 'moved past it, its width kept');
	assert.equal(set(m, 'zone', 'zone-0b2701', { x: 690 }).ok, true, 'moved inward -- the control');
});

test('B27: a device whose span reaches past the edge is refused, put or set; a waypoint has no span to reach', () => {
	const m = new Model();
	assert.equal(put(m, 'node', panel()).ok, true, 'a 3x3 panel to the edge exactly -- the control');
	const wide = put(new Model(), 'node', panel({ span: { cols: 4, rows: 3 } }));
	assert.equal(wide.ok, false, 'a column more');
	assert.match(wide.error, /node-0b2701's 4x3 span reaches 960,480, past the surface's edge at 900,480/);
	assert.equal(put(new Model(), 'node', panel({ x: 900, y: 480, span: { cols: 64, rows: 64 } })).ok, false, 'the row\'s own case, reaching 4680');
	m.put('node', panel());
	assert.equal(set(m, 'node', 'node-0b2701', { span: { cols: 3, rows: 4 } }).ok, false, 'grown past it');
	assert.equal(set(m, 'node', 'node-0b2701', { x: 840 }).ok, false, 'moved past it, its span kept');
	assert.equal(put(new Model(), 'node', { id: 'node-0b2702', name: 'w', x: 900, y: 480 }).ok, true, 'a waypoint on the last cell');
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

test('B27: a document holding a zone or a panel past the edge is refused at the document door -- create, boot, restore', () => {
	const doc = (patch) => ({ meta: { id: 'diagram-0b2701', name: 'd' }, layouts: heldLayouts(), nodes: [], zones: [], links: [], pipes: [], groups: [], ...patch });
	assert.equal(validateDoc(doc({ zones: [zone(), { ...zone({ id: 'zone-0b2702', x: -930, y: -510 }) }] })), null, 'within the edges -- the control');
	assert.match(validateDoc(doc({ zones: [zone({ w: 240 })] })), /past the surface's edge/);
	assert.match(validateDoc(doc({ nodes: [panel({ span: { cols: 4, rows: 3 } })] })), /past the surface's edge/);
	assert.match(validateDoc(doc({ nodes: [panel({ content: [region([3, 0], 1, 1)] })] })), /falls outside its 3x3 span/);
});

test('B27: an agent\'s commit through REST is refused, naming the zone and the edge', async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-edge-'));
	const app = await makeApp({ dataDir: dir, secretsDir: dir, port: 0 });
	try {
		const base = `http://localhost:${app.port}`;
		const id = (await (await fetch(`${base}/api/v1/diagrams`)).json())[0].id;
		const lock = await (await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'POST' })).json();
		const r = await fetch(`${base}/api/v1/diagrams/${id}/commit`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Draw-Lock': lock.token },
			body: JSON.stringify({ ops: [{ op: 'put', kind: 'zone', entity: zone({ x: 870, w: 1800 }) }] }) });
		const body = await r.json();
		assert.notEqual(r.status, 200);
		assert.match(body.error, /zone-0b2701 reaches 2670,510, past the surface's edge at 930,510/);
		await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'DELETE', headers: { 'X-Draw-Lock': lock.token } });
	} finally { await app.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('B27: in the browser the panel resize key grows a span up to the edge and shrinks it down to its content', () => {
	const arrow = (k) => key(k, { shiftKey: true });
	const h = makeInput();
	try {
		const [d] = seedNodes(h.model, [[780, 360, 'host']]);
		h.model.set('node', d.id, { span: { cols: 3, rows: 3 }, content: [region([0, 0], 2, 2)] });
		h.selection.set([d.id]);
		h.capture.onKeyDown(arrow('ArrowRight'));
		assert.deepEqual(h.model.get('node', d.id).span, { cols: 3, rows: 3 }, 'at the edge: no column more');
		for (let i = 0; i < 3; i++) h.capture.onKeyDown(arrow('ArrowLeft'));
		assert.deepEqual(h.model.get('node', d.id).span, { cols: 2, rows: 3 }, 'shrunk to its content, two columns, and no further');
		h.capture.onKeyDown(arrow('ArrowUp'));
		assert.deepEqual(h.model.get('node', d.id).span, { cols: 2, rows: 2 }, 'a row less, to its content');
		// the key proposes no step the planner would refuse -- not merely a step the planner then refuses
		const at = h.model.get('node', d.id);
		assert.equal(DEVICE_SIZE_STEP.step({ ...at, span: { cols: 3, rows: 3 } }, 1, 0), null, 'no column past the edge is proposed');
		assert.equal(DEVICE_SIZE_STEP.step(at, 0, -1), null, 'no row below the content is proposed');
		assert.equal(DEVICE_SIZE_STEP.step(at, -1, 0), null, 'no column below the content is proposed');
		const [e] = seedNodes(h.model, [[0, 0, 'host']]);
		h.selection.set([e.id]);
		h.capture.onKeyDown(arrow('ArrowRight'));
		assert.deepEqual(h.model.get('node', e.id).span, { cols: 2, rows: 1 }, 'in open ground it grows a column -- the control');
	} finally { h.restore(); }
});
