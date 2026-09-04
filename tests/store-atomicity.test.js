// S1b — apply() via prism.commit: the reject-writes-nothing precondition gate. A rejected mutation must
// leave the in-memory model AND the flushed file byte-identical, rev unchanged (the markDirty/rev-on-reject
// leak the design warned about would ship silently without this). Plus: an accepted cascade applies + persists.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { OWNER, openStore } from './fixtures/app.mjs';

async function freshStore() {
	const dir = mkdtempSync(path.join(os.tmpdir(), 'store-atom-'));
	const store = await openStore(dir);                 // empty dir -> seeds one diagram
	const id = store.list(OWNER)[0].id;
	return { store, dir, id, model: store.get(id) };
}

test('commit: a REJECTED mutation writes NOTHING (model + flushed file byte-identical, version unchanged)', async () => {
	const { store, dir, id, model } = await freshStore();
	try {
		await store.flush(id);
		const file = path.join(dir, `${id}.json`);
		const fileBefore = readFileSync(file, 'utf8');
		const jsonBefore = JSON.stringify(model.toJSON());
		const versionBefore = model.state.meta.version;

		const res = store.commit(id, { ops: [{ op: 'set', kind: 'node', id: 'node-ffffff', patch: { name: 'x', type: 'host', shape: 'circle', x: 0, y: 0 } }] }, 'server', null, OWNER);
		assert.equal(res.ok, false);
		assert.match(res.error, /set on missing entity/);                 // rejected
		assert.equal(JSON.stringify(model.toJSON()), jsonBefore, 'in-memory model unchanged');
		assert.equal(model.state.meta.version, versionBefore, 'version unchanged');

		await store.flush(id);
		assert.equal(readFileSync(file, 'utf8'), fileBefore, 'flushed file byte-identical');
	} finally { rmSync(dir, { recursive: true, force: true }); }
});

test('commit: a validateMutation-rejected mutation also writes nothing (gate error string preserved)', async () => {
	const { store, dir, id, model } = await freshStore();
	try {
		const versionBefore = model.state.meta.version;
		// a link to a non-existent endpoint — rejected by validateMutation (referential integrity)
		const res = store.commit(id, { ops: [{ op: 'put', kind: 'link', entity: { id: 'link-ffffff', name: 'link-ffffff', src: 'node-ffffff', dst: 'node-eeeeee' } }] }, 'server', null, OWNER);
		assert.equal(res.ok, false);
		assert.match(res.error, /does not exist/);
		assert.equal(model.get('link', 'link-ffffff'), undefined, 'no link created');
		assert.equal(model.state.meta.version, versionBefore, 'version unchanged');
	} finally { rmSync(dir, { recursive: true, force: true }); }
});

test('commit: an accepted del-node cascade applies atomically (link cascade-deleted) + advances version', async () => {
	const { store, dir, id, model } = await freshStore();
	try {
		const nodeId = 'node-aaaaaa';
		assert.equal(store.commit(id, { ops: [{ op: 'put', kind: 'node', entity: { id: nodeId, name: 'a', type: 'host', shape: 'circle', x: 120, y: 120 } }] }, 'server', null, OWNER).ok, true);
		const other = model.all('node').find((n) => n.id !== nodeId).id;
		const linkId = 'link-aaaaaa';
		assert.equal(store.commit(id, { ops: [{ op: 'put', kind: 'link', entity: { id: linkId, name: linkId, src: nodeId, dst: other } }] }, 'server', null, OWNER).ok, true);

		const versionBefore = model.state.meta.version;
		assert.equal(store.commit(id, { ops: [{ op: 'del', kind: 'node', id: nodeId }] }, 'server', null, OWNER).ok, true);
		assert.equal(model.get('node', nodeId), undefined, 'node deleted');
		assert.equal(model.get('link', linkId), undefined, 'link cascade-deleted in the same logical mutation');
		assert.ok(model.state.meta.version > versionBefore, 'version advanced');
	} finally { rmSync(dir, { recursive: true, force: true }); }
});
