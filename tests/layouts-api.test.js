/*
WD-b1 test 11 (H19.45; WD8, dev/design/unification/WIDE-DEVICES.md section 13) -- THE AGENT API'S LAYOUTS ARE THE DIAGRAM'S
RECORDS.

`GET /diagrams/<id>/layouts` answers with the diagram's two layout records -- id, name, pitch, offset and extent -- where it
answered with the kernel's two names; `/layouts/<name>/nearest` and `/layouts/<name>/anchors` keep their answers; a write to
a layout through the commit door is refused while WD7 holds, naming the layout. The records are read loudly: a diagram
lacking one is an error naming it, never the kernel's names put in its place.
*/
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeApp } from './fixtures/app.mjs';
import { Model } from './fixtures/composed.mjs';
import { LAYOUT_TABLE } from '../layouts/layout-table.mjs';
import { layoutRecords } from '../layouts/layout-records.mjs';

const RECORDS = structuredClone(LAYOUT_TABLE).map((l) => ({ ...l, ext: { ...l.ext } }));
let app, base, dataDir;
before(async () => {
	dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-layouts-api-'));
	app = await makeApp({ dataDir, secretsDir: dataDir, port: 0 });
	base = `http://localhost:${app.port}`;
});
after(async () => {
	await app.close();
	fs.rmSync(dataDir, { recursive: true, force: true });
});
const get = async (p) => {
	const res = await fetch(base + p);
	return { status: res.status, body: await res.json().catch(() => null) };
};
const firstId = async () => (await get('/api/v1/diagrams')).body[0].id;

test('WD-b1 test 11: GET /diagrams/<id>/layouts serves the diagram\'s two records, with the product\'s values', async () => {
	const id = await firstId();
	const r = await get(`/api/v1/diagrams/${id}/layouts`);
	assert.equal(r.status, 200);
	assert.deepEqual(r.body, { layouts: RECORDS }, 'exactly the two records: id, name, pitch, offset and extent');
	assert.deepEqual(r.body.layouts.map((l) => l.name), ['node', 'zone'], 'named as the grid routes name them');
});

test('WD-b1 test 11: the grid routes answer as before -- nearest on the node grid, every anchor of the zone grid', async () => {
	const id = await firstId();
	const n = (await get(`/api/v1/diagrams/${id}/layouts/node/nearest?x=270&y=-150`)).body;
	assert.deepEqual({ layout: n.layout, cx: n.cx, cy: n.cy, x: n.x, y: n.y }, { layout: 'node', cx: 5, cy: -2, x: 300, y: -120 });
	const z = (await get(`/api/v1/diagrams/${id}/layouts/zone/anchors`)).body;
	assert.equal(z.layout, 'zone');
	assert.equal(z.count, 31 * 17, 'one anchor to a cell of the node extent, as before');
	assert.ok(z.anchors.every((a) => (a.x - 30) % 60 === 0 && (a.y - 30) % 60 === 0), 'on the zone lattice, half a pitch off');
	const unknown = await get(`/api/v1/diagrams/${id}/layouts/sideways/anchors`);
	assert.equal(unknown.status, 404);
	assert.equal(unknown.body.code, 'unknown-layout');
});

test('WD-b1 test 11: a write to a layout is refused while WD7 holds, naming it; the records are unchanged', async () => {
	const id = await firstId();
	const lock = await (await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'POST' })).json();
	const commit = async (ops) => {
		const r = await fetch(`${base}/api/v1/diagrams/${id}/commit`, {
			method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Draw-Lock': lock.token }, body: JSON.stringify({ ops }) });
		return { status: r.status, body: await r.json().catch(() => null) };
	};
	try {
		const set = await commit([{ op: 'set', kind: 'layout', id: 'layout-000002', patch: { pitch: 30 } }]);
		assert.notEqual(set.status, 200, 'a changed pitch is refused');
		assert.match(set.body.error, /layout-000002/, 'naming the layout');
		assert.match(set.body.error, /WD7/);
		const del = await commit([{ op: 'del', kind: 'layout', id: 'layout-000001' }]);
		assert.notEqual(del.status, 200, 'a deleted layout is refused');
		assert.match(del.body.error, /layout-000001/, 'naming the layout');
		const node = await commit([{ op: 'put', kind: 'node', entity: { id: 'node-1a0001', name: 'control', type: 'host', x: 840, y: 420 } }]);
		assert.equal(node.status, 200, `a node is written through the same door -- the control: ${node.body?.error ?? ''}`);
	} finally {
		await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'DELETE', headers: { 'X-Draw-Lock': lock.token } });
	}
	assert.deepEqual((await get(`/api/v1/diagrams/${id}/layouts`)).body, { layouts: RECORDS }, 'and the records are as they were');
});

test('WD-b1: the records are read loudly -- a diagram lacking one is an error naming it, not the kernel\'s names', () => {
	const m = new Model();
	assert.deepEqual(layoutRecords(m), RECORDS, 'in the table\'s order, each a plain copy');
	const lacking = { all: (k) => (k === 'layout' ? [m.get('layout', 'layout-000002')] : []), get: (k, id) => (id === 'layout-000002' ? m.get(k, id) : undefined) };
	assert.throws(() => layoutRecords(lacking), /the node layout \(layout-000001\) is missing -- every diagram holds its two layouts/);
});
