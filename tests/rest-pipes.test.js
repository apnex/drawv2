// P6 W-a (H18.31) -- REST serves the network's pipes like any composed collection: list, read, lay by hand, delete.
// dev/design/unification/AGENTS-LAY-PIPES.md, stage W-a.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeApp } from './fixtures/app.mjs';
import { pipeId } from '../network/pipe-kind.mjs';

let app, dataDir, base, id, token;
const H = () => ({ 'Content-Type': 'application/json', 'X-Draw-Lock': token });
const api = (p, init) => fetch(`${base}/api/v1/diagrams/${id}${p}`, init);
const json = async (p) => (await api(p)).json();

before(async () => {
	dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-rest-pipes-'));
	app = await makeApp({ dataDir, secretsDir: dataDir, port: 0 });
	base = `http://127.0.0.1:${app.port}`;
	id = (await (await fetch(`${base}/api/v1/diagrams`)).json())[0].id;
	token = (await (await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'POST' })).json()).token;
	// two hosts, a waypoint above them, and a plain link between the hosts -- down, since no pipe joins them (G2)
	const r = await api('/commit', { method: 'POST', headers: H(), body: JSON.stringify({ ops: [
		{ op: 'put', kind: 'node', entity: { id: 'node-e10001', name: 'a', type: 'host', shape: 'square', x: -360, y: 240 } },
		{ op: 'put', kind: 'node', entity: { id: 'node-e10002', name: 'b', type: 'host', shape: 'square', x: 360, y: 240 } },
		{ op: 'put', kind: 'node', entity: { id: 'node-e100f0', name: 'w', x: 0, y: 360 } },
		{ op: 'put', kind: 'link', entity: { id: 'link-e10003', name: 'l', src: 'node-e10001', dst: 'node-e10002' } }] }) });
	assert.equal(r.status, 200);
});
after(async () => { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });

test('W-a: POST /pipes {a, b} lays a hand pipe, its id the network\'s, and a down link heals over it', async () => {
	assert.equal((await json('/links/link-e10003/path')).down, true, 'precondition: the plain link is down');
	const r = await api('/pipes', { method: 'POST', headers: H(), body: JSON.stringify({ a: 'node-e10002', b: 'node-e10001' }) });
	assert.equal(r.status, 200, await r.clone().text());
	const want = pipeId('node-e10001', 'node-e10002');
	assert.equal((await r.json()).id, want, 'the id is the one its ends make, in either order');
	assert.deepEqual(await json(`/pipes/${want}`), { id: want, a: 'node-e10001', b: 'node-e10002', laid: 'hand' }, 'laid by hand, its ends lower hex first');
	assert.ok((await json('/pipes')).some((p) => p.id === want), 'and listed, beside the seeded diagram\'s own');
	assert.equal((await json('/links/link-e10003/path')).down, false, 'the link heals over it');
});

test('W-a: the planner refuses a pipe to an anchor that does not exist, or a second pipe on one pair', async () => {
	const missing = await api('/pipes', { method: 'POST', headers: H(), body: JSON.stringify({ a: 'node-e10001', b: 'node-e1ffff' }) });
	assert.equal(missing.status, 422);
	assert.match((await missing.json()).error, /pipe end does not exist/);
	const before = (await json('/pipes')).length;
	await api('/pipes', { method: 'POST', headers: H(), body: JSON.stringify({ a: 'node-e10001', b: 'node-e10002' }) });
	assert.equal((await json('/pipes')).length, before, 'one pipe per pair: laying it again lays nothing new');
	const self = await api('/pipes', { method: 'POST', headers: H(), body: JSON.stringify({ a: 'node-e10001', b: 'node-e10001' }) });
	assert.equal(self.status, 422, 'a pipe joins two anchors');
});

test('W-a: DELETE /pipes/<id> removes it, and the link it held goes down again', async () => {
	const want = pipeId('node-e10001', 'node-e10002');
	const r = await api(`/pipes/${want}`, { method: 'DELETE', headers: H() });
	assert.equal(r.status, 200);
	assert.equal((await api(`/pipes/${want}`)).status, 404);
	assert.equal((await json('/links/link-e10003/path')).down, true);
});

test('W-a: REST serves every collection the store composes, and only those', async () => {
	for (const c of ['nodes', 'links', 'zones', 'groups', 'pipes']) assert.equal((await api(`/${c}`)).status, 200, c);
	assert.equal((await api('/waypoints')).status, 404, 'waypoints are nodes since F-c');
	assert.equal((await api('/probes')).status, 404);
});
