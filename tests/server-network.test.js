/*
H18.12 (S-b; PROMOTION.md P3, SERVER-COMPOSES-NETWORK.md) -- THE SERVER COMPOSES THE NETWORK: the store's Models hold the
network's rows, and every commit, undo and redo plans with its tenant.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../server/store.js';
import { pipeEntity, pipeId } from '../network/pipe-kind.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sb-'));
const [A, B, W] = ['node-00000a', 'node-00000b', 'node-00000e'];
async function fresh(dir = tmp()) {
	const store = new Store(dir, { flushMs: 3_600_000, authz: false });
	await store.init();
	return { store, dir };
}
const board = [
	{ op: 'put', kind: 'node', entity: { id: A, name: 'A', type: 'router', x: -360, y: 0 } },
	{ op: 'put', kind: 'node', entity: { id: B, name: 'B', type: 'router', x: 360, y: 0 } },
	{ op: 'put', kind: 'node', entity: { id: W, name: 'w', x: 0, y: -120 } },
	{ op: 'put', kind: 'link', entity: { id: 'link-000001', name: 'l', src: A, dst: B, via: [W] } },
	{ op: 'put', kind: 'pipe', entity: pipeEntity(A, W, 'link') },
	{ op: 'put', kind: 'pipe', entity: pipeEntity(W, B, 'link') },
];

test('S-b: a pin deleted over the server deletes its link -- the network\'s rule, P-7 -- and takes its pipes and the waypoint', async () => {
	const { store } = await fresh();
	const id = store.create('sb').model.state.meta.id;
	assert.equal(store.commit(id, { label: 'board', ops: board }).ok, true);
	const r = store.commit(id, { label: 'delete', ops: [{ op: 'del', kind: 'node', id: W }] });
	assert.equal(r.ok, true, r.error);
	const m = store.get(id);
	assert.equal(m.get('link', 'link-000001'), undefined, 'a pinned link lives and dies with its pins (ruled 2026-09-30)');
	assert.deepEqual(m.all('pipe'), [], 'its pipes go with the pin they end at');
});

test('S-b: a document with pipes round-trips through the store -- written, read back at boot, and undone with its pipes (P2\'s deferred exit criterion)', async () => {
	const { store, dir } = await fresh();
	const id = store.create('sb').model.state.meta.id;
	assert.equal(store.commit(id, { label: 'board', ops: board }).ok, true);
	await store.flush(id);
	const again = (await fresh(dir)).store;
	assert.deepEqual(again.get(id).all('pipe').map((p) => p.id).sort(), [pipeId(A, W), pipeId(W, B)].sort(), 'the pipes are the document\'s');
	assert.equal(again.commit(id, { label: 'delete', ops: [{ op: 'del', kind: 'link', id: 'link-000001' }] }).ok, true);
	assert.equal(again.get(id).all('pipe').length, 0, 'the link\'s pipes are swept with it, and its w waypoint (ruled 2026-09-29)');
	assert.equal(again.get(id).get('node', W), undefined);
	assert.equal(again.undo(id).ok, true);
	assert.equal(again.get(id).all('pipe').length, 2, 'one undo restores the link, its waypoint and its pipes');
	assert.ok(again.get(id).get('link', 'link-000001'));
});

test('S-b: the server refuses what the network refuses -- a transit a host does not offer', async () => {
	const { store } = await fresh();
	const id = store.create('sb').model.state.meta.id;
	const r = store.commit(id, { label: 'h', ops: [{ op: 'put', kind: 'node', entity: { id: 'node-00000c', name: 'H', type: 'host', x: 0, y: 120, transit: true } }] });
	assert.equal(r.ok, false);
	assert.match(r.error, /H is a host, which never passes routes/);
});

/*
H18.13 (S-c; ruled 2026-10-03, G2) -- A PINNED LINK LAYS THE LEGS NO PIPES JOIN, from any door; a plain link lays none.
*/
import { Model } from '../model/model.mjs';
import { productKinds } from '../planner/kinds.mjs';
import { NETWORK_ROWS } from '../network/kinds.mjs';
import { createNetwork } from '../network/network.mjs';
import { createTransit } from '../network/transit.mjs';

const nodes = [
	{ op: 'put', kind: 'node', entity: { id: A, name: 'A', type: 'router', x: -360, y: 0 } },
	{ op: 'put', kind: 'node', entity: { id: B, name: 'B', type: 'router', x: 360, y: 0 } },
	{ op: 'put', kind: 'node', entity: { id: W, name: 'w', x: 0, y: -120 } },
];
// the stored document, drawn by the network as the lab draws it: is the link up?
const upIn = (doc, id) => { const m = new Model({ kinds: productKinds(...NETWORK_ROWS), network: createNetwork(createTransit()) }); m.load(doc); return !m.isLinkDown(m.get('link', id)); };

test('S-c: an agent\'s pinned link, with no pipes on the board, lays its legs and comes up', async () => {
	const { store } = await fresh();
	const id = store.create('sc').model.state.meta.id;
	const r = store.commit(id, { label: 'link', ops: [...nodes, { op: 'put', kind: 'link', entity: { id: 'link-000001', name: 'l', src: A, dst: B, via: [W] } }] });
	assert.equal(r.ok, true, r.error);
	assert.deepEqual(store.get(id).all('pipe').map((p) => `${p.id}:${p.laid}`).sort(), [`${pipeId(A, W)}:link`, `${pipeId(W, B)}:link`].sort());
	assert.equal(upIn(store.get(id).toJSON(), 'link-000001'), true);
});

test('S-c: a plain link lays nothing -- "direct links without a key lay no pipe" -- and is down where no way exists', async () => {
	const { store } = await fresh();
	const id = store.create('sc').model.state.meta.id;
	assert.equal(store.commit(id, { label: 'link', ops: [...nodes, { op: 'put', kind: 'link', entity: { id: 'link-000001', name: 'l', src: A, dst: B } }] }).ok, true);
	assert.deepEqual(store.get(id).all('pipe'), []);
	assert.equal(upIn(store.get(id).toJSON(), 'link-000001'), false, 'a named stopgap until P6 gives agents pipe verbs (G2)');
});

test('S-c: a leg that pipes already join lays nothing, even through an anchor whose transit is off -- that link is down by choice (TR-1)', async () => {
	const { store } = await fresh();
	const id = store.create('sc').model.state.meta.id;
	const H = 'node-00000c';
	assert.equal(store.commit(id, { label: 'board', ops: [...nodes,
		{ op: 'put', kind: 'node', entity: { id: H, name: 'h', x: 0, y: 120, transit: false } },
		{ op: 'put', kind: 'pipe', entity: pipeEntity(A, W, 'hand') },
		{ op: 'put', kind: 'pipe', entity: pipeEntity(W, H, 'hand') },
		{ op: 'put', kind: 'pipe', entity: pipeEntity(H, B, 'hand') }] }).ok, true);
	const r = store.commit(id, { label: 'link', ops: [{ op: 'put', kind: 'link', entity: { id: 'link-000001', name: 'l', src: A, dst: B, via: [W] } }] });
	assert.equal(r.ok, true, r.error);
	assert.equal(r.change.ops.some((o) => o.kind === 'pipe'), false, 'W to B is joined, through h');
	assert.equal(upIn(store.get(id).toJSON(), 'link-000001'), false, 'and h stops what arrives: down, as the author made it');
});
