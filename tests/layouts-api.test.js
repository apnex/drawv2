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
import { makeApp } from './fixtures/app.mjs';
import { Model } from './fixtures/composed.mjs';
import { LAYOUT_TABLE } from '../plugins/layouts/layout-table.mjs';
import { layoutRecords } from '../plugins/layouts/layout-records.mjs';
import { scratchFolder } from '@apnex/clean-runner';   // H26-19 as amended: removed when this file ends, however it ends

const RECORDS = structuredClone(LAYOUT_TABLE).map((l) => ({ ...l, ext: { ...l.ext } }));
let app, base, dataDir;
before(async () => {
	dataDir = scratchFolder('draw-layouts-api-');
	app = await makeApp({ dataDir, port: 0 });
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

/*
H26.11 (H26-21; B399, dev/DECISIONS.md) -- EACH LAYOUT LISTS ITS OWN GRID'S POSITIONS WITHIN THAT GRID'S OWN BOUNDS, row then column. Both
lists walked the node extent's index range, each index placed on its layout's grid, so the zone list ran x -870 to 930 and y -450 to 510:
the zone lattice's column at -930 and row at -510, where zones sit, were missing, and its right edge held where its left did not. The
zone list is the zone grid's 576 positions now; the node list is its 527, byte for byte as before, built here from the lattice itself --
x -900 to 900 and y -480 to 480 a pitch apart, an occupied anchor carrying its node -- and compared as the bytes the route answers.
*/
const lattice = (layout, x0, x1, y0, y1, offset) => {
	const out = [];
	for (let y = y0; y <= y1; y += 60) for (let x = x0; x <= x1; x += 60) out.push({ layout, cx: (x - offset) / 60, cy: (y - offset) / 60, x, y });
	return out;
};
test('H26.11: the zone list is the zone grid\'s 576 positions within its own bounds; the node list its 527, byte for byte', async () => {
	const id = await firstId();
	const zone = (await get(`/api/v1/diagrams/${id}/layouts/zone/anchors`)).body;
	assert.deepEqual([zone.layout, zone.count, zone.anchors.length], ['zone', 576, 576], 'the zone grid within its bounds: 32 columns by 18 rows');
	assert.deepEqual(zone.anchors, lattice('zone', -930, 930, -510, 510, 30), 'every position, row then column, from -930,-510 to 930,510');
	assert.deepEqual([zone.anchors[0], zone.anchors.at(-1)], [{ layout: 'zone', cx: -16, cy: -9, x: -930, y: -510 }, { layout: 'zone', cx: 15, cy: 8, x: 930, y: 510 }], 'its first and last');
	assert.equal(zone.anchors.filter((a) => a.x === -930).length, 18, 'the column at x -930, one to a row');
	assert.equal(zone.anchors.filter((a) => a.y === -510).length, 32, 'the row at y -510, one to a column');
	const free = (await get(`/api/v1/diagrams/${id}/layouts/zone/anchors?free=1`)).body;
	assert.deepEqual([free.count, free.anchors], [576, zone.anchors], 'free=1 as now: no node or waypoint sits on a zone position');
	// the node list: the bytes the route answers, against the lattice built here and the board's nodes on it
	const doc = (await get(`/api/v1/diagrams/${id}`)).body;
	const at = new Map(doc.nodes.map((n) => [`${n.x},${n.y}`, n.id]));
	assert.ok(at.size > 0, 'control: the board has nodes on anchors');
	const nodes = lattice('node', -900, 900, -480, 480, 0).map((a) => (at.has(`${a.x},${a.y}`) ? { ...a, occupant: at.get(`${a.x},${a.y}`) } : a));
	const text = await (await fetch(`${base}/api/v1/diagrams/${id}/layouts/node/anchors`)).text();
	assert.equal(text, JSON.stringify({ layout: 'node', count: 527, anchors: nodes }, null, '\t') + '\n', 'the node list, byte for byte, as the route writes it');
	const freeText = await (await fetch(`${base}/api/v1/diagrams/${id}/layouts/node/anchors?free=1`)).text();
	const unoccupied = nodes.filter((a) => !a.occupant);
	assert.equal(freeText, JSON.stringify({ layout: 'node', count: unoccupied.length, anchors: unoccupied }, null, '\t') + '\n', 'and its free anchors, byte for byte');
});

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
	// RESTATED at H26.11 (H26-21; B399): the zone grid's own positions within its own bounds, 32 by 18, where it listed the node extent's 31 by 17
	assert.equal(z.count, 32 * 18, 'one anchor to each position of the zone grid within its bounds');
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
