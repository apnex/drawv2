/*
CS5 — the migration, over old-shape fixtures.

The transform is pure and tested here on its own, because the driver's dry run can only prove the
migrated corpus BOOTS — it cannot prove the transform is right about a shape it never sees in the
live corpus (a legacy doc, a doc with a log, a doc whose log is ahead of its recorded version).

All 17 live files predate the log, so `version` will be 0 for every one of them. That is exactly
why the log-bearing cases need fixtures: the live corpus does not exercise them.
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { migrateDoc, invariant } from '../tools/migrate-version.mjs';
import { OWNER, openStore } from './fixtures/app.mjs';

// B112: an unpositioned fixture node gets a DISTINCT anchor derived from its id -- one
// anchor holds one occupant, so two fixtures defaulting to (0,0) is now a real violation.
const _at = (id) => (parseInt(id.slice(-4), 16) % 15 + 1) * 60;
const node = (id, x = null, y = 0) => ({ id, name: id, type: 'host', shape: 'circle', x: x ?? _at(id), y });

// a document in the PRE-CS5 shape: rev, grid, no version, no schema
const oldDoc = (over = {}) => ({
	meta: { id: 'diagram-aa0001', name: 'legacy', rev: 11052, grid: 'center',
	},
	nodes: [node('node-aa0001', 60, 60), node('node-aa0002', -120, 300)],
	waypoints: [],
	links: [{ id: 'link-aa0003', src: 'node-aa0001', dst: 'node-aa0002' }],
	zones: [{ id: 'zone-aa0004', name: 'dmz', x: 30, y: 30, w: 240, h: 180 }],
	groups: [{ id: 'group-aa0005', name: 'g', members: ['node-aa0001', 'node-aa0002'] }],
	selection: ['node-aa0001'],
	...over,
});

test('the render counter is dropped, not renamed — version comes from the LOG', () => {
	const m = migrateDoc(oldDoc(), null);
	assert.equal('rev' in m.meta, false, 'rev is gone');
	assert.equal('grid' in m.meta, false, 'grid is gone');
	assert.equal(m.meta.version, 0, 'a file predating the log starts at 0, NOT at rev 11052');
	assert.equal(m.meta.schema, 1, 'the generation discriminator grid was serving');
	assert.deepEqual(Object.keys(m.meta).sort(), ['id', 'name', 'schema', 'version']);
});

test('version is seeded from the file’s own persisted log', () => {
	const m = migrateDoc(oldDoc(), { version: 42, cursor: 0, evicted: 0, records: [] });
	assert.equal(m.meta.version, 42);
});

test('a log whose top record is ABOVE its recorded version takes the high-water mark', () => {
	// re-minting a live seq would make two records share one number, and undo replays by seq
	const log = { version: 3, cursor: 2, evicted: 0, records: [
		{ seq: 4, from: 3, ops: [], inverse: [] },
		{ seq: 5, from: 4, ops: [], inverse: [] },
	] };
	assert.equal(migrateDoc(oldDoc(), log).meta.version, 5);
});

test('the migration touches NO entity — every collection survives byte-for-byte', () => {
	const before = oldDoc();
	const m = migrateDoc(before, null);
	assert.equal(invariant(m), invariant(before), 'the invariant is unchanged');
	assert.deepEqual(m.nodes, before.nodes);
	assert.deepEqual(m.links, before.links);
	assert.deepEqual(m.zones, before.zones);
	assert.deepEqual(m.groups, before.groups);
	assert.deepEqual(m.selection, before.selection);
});

test('the transform does not mutate its input', () => {
	const before = oldDoc();
	const copy = JSON.parse(JSON.stringify(before));
	migrateDoc(before, null);
	assert.deepEqual(before, copy, 'a dry run and a real run cannot diverge by mutation');
});


test('invariant() CATCHES a mangled coordinate — the failure a count-only check passes', () => {
	const before = oldDoc();
	const mangled = migrateDoc(oldDoc(), null);
	mangled.nodes[0].x = 61;                        // one pixel, one node, out of five entities
	assert.notEqual(invariant(mangled), invariant(before));
});

test('invariant() ignores key order and collection order — a reserialization is not a change', () => {
	const a = oldDoc();
	const b = migrateDoc(oldDoc(), null);
	b.nodes = [...b.nodes].reverse();
	b.nodes[0] = Object.fromEntries(Object.entries(b.nodes[0]).reverse());
	assert.equal(invariant(b), invariant(a));
});

// ---- end to end, through a real Store ----

test('CS5 gate: a migrated corpus boots, and every entity is deep-equal through the new binary', async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-mig-'));
	try {
		const docs = [oldDoc(), oldDoc({ meta: { id: 'diagram-bb0002', name: 'two', rev: 4, grid: 'center', slides: { url: '', presentationId: '', pageId: '' } } })];
		const before = new Map();
		for (const d of docs) {
			before.set(d.meta.id, invariant(d));
			fs.writeFileSync(path.join(dir, `${d.meta.id}.json`), JSON.stringify(migrateDoc(d, null), null, '\t') + '\n');
		}

		const { Store } = await import('../server/store.js');
		const store = await openStore(dir, { flushMs: 3_600_000 });                                  // throws if any file fails the new whitelist
		assert.equal(store.list(OWNER).length, 2);

		for (const { id } of store.list(OWNER)) {
			const loaded = store.get(id).toJSON();
			assert.equal(invariant(loaded), before.get(id), `${id}: every entity survived`);
			assert.equal(loaded.meta.version, store.diagrams.get(id).log.version, 'GR9: meta.version === log.version');
			assert.equal(loaded.meta.schema, 1);
			assert.equal('rev' in loaded.meta, false);
			assert.equal('grid' in loaded.meta, false);
		}
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('CS5 gate: an UNMIGRATED file is a named boot failure, never a silent reseed (GR8/D17)', async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-old-'));
	try {
		const d = oldDoc();
		fs.writeFileSync(path.join(dir, `${d.meta.id}.json`), JSON.stringify(d, null, '\t') + '\n');
		const { Store } = await import('../server/store.js');
		const store = new Store(dir, { flushMs: 3_600_000 });
		await assert.rejects(() => store.init(), /refusing to boot/, 'the old shape is refused, loudly');
		assert.equal(store.diagrams.size, 0, 'and nothing was seeded over it');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
