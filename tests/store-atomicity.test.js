// S1b — apply() via prism.commit: the reject-writes-nothing precondition gate. A rejected mutation must
// leave the in-memory model AND the flushed file byte-identical, rev unchanged (the markDirty/rev-on-reject
// leak the design warned about would ship silently without this). Plus: an accepted cascade applies + persists.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../server/store.js';

function freshStore() {
	const dir = mkdtempSync(path.join(os.tmpdir(), 'store-atom-'));
	const store = new Store(dir);
	store.init();                 // empty dir -> seeds one diagram
	const id = store.list()[0].id;
	return { store, dir, id, model: store.get(id) };
}

test('apply: a REJECTED mutation writes NOTHING (model + flushed file byte-identical, rev unchanged)', () => {
	const { store, dir, id, model } = freshStore();
	try {
		store.flush(id);
		const file = path.join(dir, `${id}.json`);
		const fileBefore = readFileSync(file, 'utf8');
		const jsonBefore = JSON.stringify(model.toJSON());
		const revBefore = model.state.meta.rev;

		const err = store.apply(id, { action: 'set', kind: 'node', entity: { id: 'node-ffffff', name: 'x', type: 'host', shape: 'circle', x: 0, y: 0 } });
		assert.match(err, /set on missing entity/);                       // rejected
		assert.equal(JSON.stringify(model.toJSON()), jsonBefore, 'in-memory model unchanged');
		assert.equal(model.state.meta.rev, revBefore, 'rev unchanged');

		store.flush(id);
		assert.equal(readFileSync(file, 'utf8'), fileBefore, 'flushed file byte-identical');
	} finally { rmSync(dir, { recursive: true, force: true }); }
});

test('apply: a validateMutation-rejected mutation also writes nothing (gate error string preserved)', () => {
	const { store, dir, id, model } = freshStore();
	try {
		const revBefore = model.state.meta.rev;
		// a link to a non-existent endpoint — rejected by validateMutation (referential integrity)
		const err = store.apply(id, { action: 'put', kind: 'link', entity: { id: 'link-ffffff', src: 'node-ffffff', dst: 'node-eeeeee' } });
		assert.match(err, /does not exist/);
		assert.equal(model.get('link', 'link-ffffff'), undefined, 'no link created');
		assert.equal(model.state.meta.rev, revBefore, 'rev unchanged');
	} finally { rmSync(dir, { recursive: true, force: true }); }
});

test('apply: an accepted del-node cascade applies atomically (link cascade-deleted) + advances rev', () => {
	const { store, dir, id, model } = freshStore();
	try {
		const nodeId = 'node-aaaaaa';
		assert.equal(store.apply(id, { action: 'put', kind: 'node', entity: { id: nodeId, name: 'a', type: 'host', shape: 'circle', x: 120, y: 120 } }), null);
		const other = model.all('node').find((n) => n.id !== nodeId).id;
		const linkId = 'link-aaaaaa';
		assert.equal(store.apply(id, { action: 'put', kind: 'link', entity: { id: linkId, src: nodeId, dst: other } }), null);

		const revBefore = model.state.meta.rev;
		assert.equal(store.apply(id, { action: 'del', kind: 'node', entity: { id: nodeId } }), null);
		assert.equal(model.get('node', nodeId), undefined, 'node deleted');
		assert.equal(model.get('link', linkId), undefined, 'link cascade-deleted in the same logical mutation');
		assert.ok(model.state.meta.rev > revBefore, 'rev advanced');
	} finally { rmSync(dir, { recursive: true, force: true }); }
});
