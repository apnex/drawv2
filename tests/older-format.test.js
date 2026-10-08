/*
B291 (H19.3) -- a document written before the cutover is refused at every door, and said plainly.

Every stored document became schema 2 at the cutover (P9), so the migration that admitted older ones is deleted (ruled
2026-10-07: the pre-cutover backups are records, not a rollback). What reaches the store in the older format now -- a file
in the data directory, a document posted to `create`, a deleted diagram's older generation brought back by `restore` --
is refused with one sentence naming the cutover, rather than the validator's bare "unsupported meta.schema".
*/
import { test } from 'node:test';
import { KINDS } from './fixtures/composed.mjs';   // O-b1: a reader is handed its caller's kinds
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openStore, OWNER } from './fixtures/app.mjs';

// a document as the estate stored it before the cutover: schema 1, its waypoints kept apart
const older = (id) => ({ meta: { id, name: 'before the cutover', version: 3, schema: 1, owner: '', grants: {} },
	nodes: [{ id: 'node-0d0001', name: 'a', type: 'host', shape: 'circle', x: 0, y: 0 }],
	waypoints: [{ id: 'waypoint-0d0002', name: 'w', x: 120, y: 0 }], links: [], zones: [], groups: [], selection: [] });
const current = (id) => ({ meta: { id, name: 'after the cutover', version: 0, schema: 2, owner: '', grants: {} },
	nodes: [], links: [], pipes: [], zones: [], groups: [], selection: [] });
const SAID = /written before the cutover, in schema 1: this version reads schema 2 only and keeps no migration/;

test('B291: a stored file from before the cutover is skipped at boot, with the reason said; the rest load', async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-older-'));
	fs.writeFileSync(path.join(dir, 'diagram-0d0001.json'), JSON.stringify(older('diagram-0d0001')));
	fs.writeFileSync(path.join(dir, 'diagram-0d0002.json'), JSON.stringify(current('diagram-0d0002')));
	const said = [], error = console.error, warn = console.warn;
	console.error = console.warn = (...a) => said.push(a.join(' '));
	try {
		const s = await openStore(dir);
		assert.ok(!s.get('diagram-0d0001'), 'the older document is not loaded');
		assert.ok(s.get('diagram-0d0002'), 'the current one is');
		assert.ok(said.some((l) => l.includes('diagram-0d0001') && SAID.test(l)), `the reason is said where an operator reads: ${said.join(' | ')}`);
		assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'diagram-0d0001.json'), 'utf8')).meta.schema, 1, 'and its file is left as it was');
	} finally { console.error = error; console.warn = warn; fs.rmSync(dir, { recursive: true, force: true }); }
});

test('B291: create refuses a document in the older format, saying so; a current one is installed', async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-older-create-'));
	try {
		const s = await openStore(dir);
		const refused = s.create('old', older('diagram-0d0003'), OWNER);
		assert.equal(refused.ok, false, 'refused');
		assert.match(refused.error, SAID);
		const made = s.create('new', current('diagram-0d0004'), OWNER);
		assert.equal(made.ok, true, `a current document is installed: ${made.error ?? ''}`);
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

/*
The server's own seed -- the example made on a store's first boot -- was written without pipes or drawing orders, and the
migration filled them in on the way in. With the migration gone it must be stored complete, or every seeded link comes up
down: found at H19.3 when the browser harness's fixture, written the same way, lost its packets.
*/
test('B291: the seed diagram is written complete -- valid, every item ordered, every link up', async () => {
	const { seedDoc } = await import('../server/seed.js');
	const { readModel, linkReading } = await import('../network/read-model.mjs');
	const { validateDoc } = await import('./fixtures/composed.mjs');
	const doc = seedDoc();
	assert.equal(validateDoc(doc), null, 'valid as it stands');
	for (const k of ['nodes', 'links', 'zones']) assert.ok(doc[k].every((e) => Number.isInteger(e.order)), `every ${k.slice(0, -1)} has its drawing order`);
	const m = readModel(doc, KINDS);
	assert.deepEqual(m.all('link').filter((l) => linkReading(m, l).down).map((l) => l.name), [], 'and no link is down');
});
