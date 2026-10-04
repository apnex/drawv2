// H18.3 (F-a) -- the schema 2 migration: one pure function, keyed on what it repairs, run on every path a document enters
// the store by (dev/design/unification/FORMAT-BATCH.md section 5; ruled 2026-10-03, F1 to F4).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { migrateFormatBatch, MIGRATION_TARGET } from '../server/migrate.mjs';
import { SCHEMA } from '../model/shape.mjs';
import { validateDoc } from '../planner/validate.js';
import { Store } from '../server/store.js';
import { serialize, parse } from '../server/docfile.mjs';
import { openStore, OWNER } from './fixtures/app.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'draw-migrate-'));

// a schema 1 document as the estate holds it: two declared directions, one undeclared link
const schema1 = (id = 'diagram-a1a1a1') => ({
	meta: { id, name: 'old', version: 3, schema: 1 },
	nodes: [
		{ id: 'node-a00001', name: 'a', type: 'host', shape: 'circle', x: 60, y: -480 },
		{ id: 'node-a00002', name: 'b', type: 'host', shape: 'circle', x: 300, y: -480 },
		{ id: 'node-a00003', name: 'c', type: 'host', shape: 'circle', x: 540, y: -480 },
	],
	waypoints: [],
	links: [
		{ id: 'link-a00001', name: 'link-1', src: 'node-a00001', dst: 'node-a00002', flow: true },
		{ id: 'link-a00002', name: 'link-2', src: 'node-a00002', dst: 'node-a00003', flow: false },
		{ id: 'link-a00003', name: 'link-3', src: 'node-a00001', dst: 'node-a00003' },
	],
	zones: [], groups: [], selection: [],
});

// a persisted log block with three readable records, the last at seq 3
const log1 = () => ({
	version: 3, cursor: 3, evicted: 2, evictedHuman: 1,
	records: [1, 2, 3].map((seq) => ({ seq, from: seq - 1, at: seq, by: 'client', actor: 'a', label: 'flow forward',
		ops: [{ op: 'set', kind: 'link', id: 'link-a00001', after: { flow: true } }],
		inverse: [{ op: 'set', kind: 'link', id: 'link-a00001', after: { flow: false } }] })),
});

// ---- the function ----

test('F-a: the migration targets the document generation the rest of the tree writes', () => {
	assert.equal(SCHEMA, 2, 'the document generation is 2');
	assert.equal(MIGRATION_TARGET, SCHEMA, 'the migration lands documents in the generation the validator accepts');
});

test('F-a: a declared direction is renamed, as ruled in F1: true is forward, false is reverse, absent stays absent', () => {
	const { doc } = migrateFormatBatch(schema1(), null);
	const [one, two, three] = doc.links;
	assert.equal(one.direction, 'forward');
	assert.equal(two.direction, 'reverse');
	assert.ok(!('direction' in three), 'an undeclared link declares nothing afterwards either');
	for (const l of doc.links) assert.ok(!('flow' in l), `${l.id} carries no flow field`);
});

test('F-a: undo history is truncated (P-6) -- records dropped, the version kept', () => {
	const { log } = migrateFormatBatch(schema1(), log1());
	assert.deepEqual(log.records, [], 'no record survives the migration');
	assert.equal(log.version, 3, 'the log keeps its version, so the next commit mints 4');
	assert.equal(log.cursor, 0, 'nothing to undo, nothing to redo');
});

test('F-a: the version kept is the high-water mark -- a log whose records run past its version keeps the higher', () => {
	const stale = { ...log1(), version: 1 };
	assert.equal(migrateFormatBatch(schema1(), stale).log.version, 3, 'the top record seq 3 outranks a recorded version of 1');
});

test('F-a: the document is stamped schema 2, and every step is named in what the function reports', () => {
	const { doc, steps } = migrateFormatBatch(schema1(), log1());
	assert.equal(doc.meta.schema, 2);
	assert.deepEqual(steps, ['history', 'anchors', 'order', 'pipes', 'direction', 'schema']);   // pipes since S-d
});

test('F-a: pure -- the input document and log are untouched', () => {
	const doc = schema1(), log = log1();
	const before = JSON.stringify([doc, log]);
	migrateFormatBatch(doc, log);
	assert.equal(JSON.stringify([doc, log]), before);
});

test('F-a: idempotent -- a migrated document passes through unchanged, its log kept whole', () => {
	const once = migrateFormatBatch(schema1(), log1());
	const later = { ...once.log, records: log1().records };   // history made after the migration
	const twice = migrateFormatBatch(once.doc, later);
	assert.deepEqual(twice.steps, [], 'nothing left to repair');
	assert.deepEqual(twice.doc, once.doc);
	assert.equal(twice.log, later, 'a schema 2 log is not truncated again');
});

test('F-a: a doc with no log migrates with no log', () => {
	assert.equal(migrateFormatBatch(schema1(), null).log, null);
});

// ---- the validator takes schema 2 alone ----

test('F-a: the validator takes schema 2 and the renamed field, and refuses schema 1 and the old field', () => {
	const { doc } = migrateFormatBatch(schema1(), null);
	assert.equal(validateDoc(doc), null, 'a migrated document is valid');
	assert.match(validateDoc({ ...doc, meta: { ...doc.meta, schema: 1 } }), /schema/, 'schema 1 enters only through the migration');
	const withFlow = structuredClone(doc); withFlow.links[0].flow = true;
	assert.ok(validateDoc(withFlow), 'a schema 2 document carrying flow is refused');
	const sideways = structuredClone(doc); sideways.links[0].direction = 'sideways';
	assert.ok(validateDoc(sideways), 'a direction is forward or reverse');
	const boolean = structuredClone(doc); boolean.links[0].direction = true;
	assert.ok(validateDoc(boolean), 'a direction is a word, not the old boolean');
});

// ---- every path into the store ----

test('F-a: boot migrates a schema 1 file, truncates its log, and writes it back', async () => {
	const dir = tmp();
	fs.writeFileSync(path.join(dir, 'diagram-a1a1a1.json'), serialize(schema1(), log1()));
	// a bare Store, not openStore: adopting an unowned diagram marks it dirty too, which would hide a migration not written back
	const store = new Store(dir, { flushMs: 3_600_000 });
	await store.init();
	const entry = store.diagrams.get('diagram-a1a1a1');
	assert.ok(entry, 'the schema 1 file loads');
	assert.equal(entry.model.state.meta.schema, 2);
	assert.equal(entry.model.get('link', 'link-a00001').direction, 'forward');
	assert.equal(entry.log.records.length, 0, 'its history starts at the migration');
	assert.equal(entry.log.version, 3);
	assert.ok(entry.dirty, 'the migrated file is written back');
	await store.flush('diagram-a1a1a1');
	const { doc, log } = parse(fs.readFileSync(path.join(dir, 'diagram-a1a1a1.json'), 'utf8'));
	assert.equal(doc.meta.schema, 2);
	assert.equal(doc.links[1].direction, 'reverse');
	assert.deepEqual(log.records, []);
});

test('F-a: create migrates a schema 1 document off the wire -- an open tab from before the cutover', async () => {
	const store = await openStore(tmp());
	const made = store.create('posted', schema1(), OWNER);
	assert.ok(made.ok, made.error);
	const model = made.model;
	assert.equal(model.state.meta.schema, 2);
	assert.equal(model.get('link', 'link-a00002').direction, 'reverse');
});

test('F-a: a template is migrated as it loads -- templates skipped the loader before', async () => {
	const templates = tmp();
	const t = schema1('template-a1a1a1');
	fs.writeFileSync(path.join(templates, 'template-a1a1a1.json'), JSON.stringify(t));
	const store = new Store(tmp(), { flushMs: 3_600_000, templatesDir: templates });
	await store.init();
	const model = store.templates.get('template-a1a1a1');
	assert.ok(model, 'the schema 1 template loads');
	assert.equal(model.state.meta.schema, 2);
	assert.equal(model.get('link', 'link-a00001').direction, 'forward');
});

test('F-a: an example is migrated as it seeds', async () => {
	const examples = tmp();
	fs.writeFileSync(path.join(examples, 'diagram-a1a1a1.json'), JSON.stringify(schema1()));
	const store = await openStore(tmp(), { examplesDir: examples });
	const entry = store.diagrams.get('diagram-a1a1a1');
	assert.ok(entry, 'the schema 1 example seeds');
	assert.equal(entry.model.get('link', 'link-a00001').direction, 'forward');
});

test('F-a: every document the store validates was admitted first -- the restore path included, which no fs test reaches', () => {
	const src = fs.readFileSync(new URL('../server/store.js', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
	const count = (re) => (src.match(re) || []).length;
	assert.equal(count(/\bshedRetired\(/g), 2, 'the old repairs are called only by admit (one definition, one call)');
	// one admit per validation -- boot, examples, create, templates, restore -- and the programmatic seed, which needs none (F-d)
	assert.equal(count(/\badmit\(/g) - 2, count(/\bvalidateDoc\(/g), 'one admit per validation: boot, examples, create, templates, restore');
});

// ---- the dry run (tools/migrate-schema.mjs) -- its checks shown able to fail ----

test('F-a dry run: canonical sets aside exactly the ruled changes, and sees any other', async () => {
	const { canonical } = await import('../tools/migrate-schema.mjs');
	const source = schema1();
	const { doc } = migrateFormatBatch(source, null);
	assert.equal(canonical(doc), canonical(source), 'the rename and the generation are set aside');
	const moved = structuredClone(doc); moved.nodes[0].x = 120;
	assert.notEqual(canonical(moved), canonical(source), 'a moved node is a difference');
	const swapped = structuredClone(doc); swapped.links[0].direction = 'reverse';
	assert.notEqual(canonical(swapped), canonical(source), 'a direction migrated the wrong way round is a difference');
	const dropped = structuredClone(doc); delete dropped.links[1].direction;
	assert.notEqual(canonical(dropped), canonical(source), 'a declaration lost is a difference');
});

test('F-a dry run: a directory of schema 1 files passes, through a real store boot, and the directory is untouched', async () => {
	const { dryRun } = await import('../tools/migrate-schema.mjs');
	const dir = tmp();
	fs.writeFileSync(path.join(dir, 'diagram-a1a1a1.json'), serialize(schema1(), log1()));
	fs.writeFileSync(path.join(dir, 'diagram-b2b2b2.json'), serialize(schema1('diagram-b2b2b2'), null));
	const before = fs.readFileSync(path.join(dir, 'diagram-a1a1a1.json'), 'utf8');
	const r = await dryRun(dir, { say: () => {} });
	assert.deepEqual(r.problems, []);
	assert.equal(r.booted, 2);
	assert.deepEqual(r.ran, { history: 1, renumber: 0, anchors: 2, order: 2, split: 0, pipes: 2, unpin: 0, direction: 2, schema: 2 });
	assert.equal(r.directions, 4);
	assert.equal(r.records, 3);
	assert.equal(fs.readFileSync(path.join(dir, 'diagram-a1a1a1.json'), 'utf8'), before, 'the dry run never writes the data directory');
});

test('F-a dry run: a file the store refuses is reported, not skipped quietly', async () => {
	const { dryRun } = await import('../tools/migrate-schema.mjs');
	const dir = tmp();
	fs.writeFileSync(path.join(dir, 'diagram-a1a1a1.json'), serialize(schema1(), null));
	const bad = schema1('diagram-b2b2b2'); bad.links[0].flow = 'sideways';
	fs.writeFileSync(path.join(dir, 'diagram-b2b2b2.json'), serialize(bad, null));
	const r = await dryRun(dir, { say: () => {} });
	assert.ok(r.problems.some((p) => /booted 1 diagram\(s\) of 2/.test(p)), r.problems.join('; '));
	assert.ok(r.problems.some((p) => /diagram-b2b2b2: did not boot/.test(p)));
});

// ---- F-c (H18.5): waypoints become nodes with no type (P-10) ----

// a schema 1 document with two waypoints, one sharing its hex with a node, referenced from every place a document names one
const withWaypoints = () => ({
	meta: { id: 'diagram-c1c1c1', name: 'anchors', version: 1, schema: 1 },
	nodes: [{ id: 'node-0000aa', name: 'a', type: 'host', x: 0, y: 0 }, { id: 'node-0000bb', name: 'b', type: 'host', x: 240, y: 0 }],
	waypoints: [
		{ id: 'waypoint-0000aa', name: 'clash', x: 120, y: 60, pinned: true },          // its hex is node-0000aa's
		{ id: 'waypoint-0000cc', name: 'spawner', x: -60, y: 0, spawn: { interval: 900, speed: 1.4, kind: 'packet', since: 1790000000000 } },
	],
	links: [
		{ id: 'link-0000dd', name: 'l1', src: 'node-0000aa', dst: 'node-0000bb', via: ['waypoint-0000aa'] },
		{ id: 'link-0000ee', name: 'l2', src: 'waypoint-0000cc', dst: 'node-0000aa' },
	],
	zones: [],
	groups: [{ id: 'group-0000ff', name: 'g', members: ['node-0000bb', 'waypoint-0000aa'] }],
	selection: ['waypoint-0000aa'],
	reveal: { origin: 1790000000000, beats: [{ interval: 250, ids: ['waypoint-0000cc', 'link-0000ee'] }] },
});

// AMENDED 2026-10-04 (S-d, H18.14): the pin no longer rides -- the `unpin` step drops it, and `pipes` lays the links' legs
test('F-c: each waypoint joins the nodes after them, with no type, keeping its hex, name, place, pin and spawner', () => {
	const { doc, steps } = migrateFormatBatch(withWaypoints(), null);
	assert.deepEqual(steps, ['renumber', 'anchors', 'order', 'pipes', 'unpin', 'schema']);
	assert.equal('waypoints' in doc, false, 'the collection is gone');
	assert.deepEqual(doc.nodes.map((n) => n.id).slice(0, 2), ['node-0000aa', 'node-0000bb'], 'the nodes first, untouched');
	const spawner = doc.nodes.find((n) => n.name === 'spawner');
	assert.equal(spawner.id, 'node-0000cc', 'a waypoint keeps its hex');
	assert.equal('type' in spawner, false);
	assert.equal(spawner.spawn.interval, 900, 'its spawner rides with it');
	assert.equal('pinned' in doc.nodes.find((n) => n.name === 'clash'), false, 'its pin is dropped at S-d (P-5 corrected)');
	assert.equal(validateDoc(doc), null, 'and the result is a valid schema 2 document');
});

test('F-c: a waypoint whose hex a node holds is renumbered to the next free hex, and every reference follows it', () => {
	const { doc } = migrateFormatBatch(withWaypoints(), null);
	const moved = doc.nodes.find((n) => n.name === 'clash').id;
	assert.equal(moved, 'node-0000ab', 'the next hex above its own that nothing holds');
	assert.deepEqual(doc.links[0].via, [moved], 'a bend');
	assert.equal(doc.links[1].src, 'node-0000cc', 'an end');
	assert.deepEqual(doc.groups[0].members, ['node-0000bb', moved], 'a group member');
	assert.deepEqual(doc.selection, [moved], 'the stored selection');
	assert.deepEqual(doc.reveal.beats[0].ids, ['node-0000cc', 'link-0000ee'], 'a reveal beat');
	assert.equal(doc.links[0].src, 'node-0000aa', 'and the node that held the hex keeps it');
});

test('F-c: renumbering skips a hex any anchor holds, and is the same every time it runs', () => {
	const source = withWaypoints();
	source.nodes.push({ id: 'node-0000ab', name: 'squatter', type: 'host', x: 360, y: 0 });
	const once = migrateFormatBatch(source, null).doc, again = migrateFormatBatch(source, null).doc;
	assert.equal(once.nodes.find((n) => n.name === 'clash').id, 'node-0000ac', 'past the next hex, which a node holds');
	assert.deepEqual(once, again, 'deterministic: the dry run and the real run agree');
});

test('F-c: a document stamped 2 that still holds waypoints loses its undo records too -- they name a kind that is gone', () => {
	const doc = { ...withWaypoints(), meta: { ...withWaypoints().meta, schema: 2 } };
	const log = { version: 5, cursor: 1, evicted: 0, evictedHuman: 0, records: [{ seq: 5, from: 4, at: 1, by: 'client', actor: 'a', label: 'x',
		ops: [{ op: 'put', kind: 'waypoint', entity: { id: 'waypoint-0000cc', name: 'spawner', x: 0, y: 0 } }], inverse: [] }] };
	const out = migrateFormatBatch(doc, log);
	assert.equal(out.steps[0], 'history');
	assert.deepEqual(out.log.records, []);
	assert.equal(out.log.version, 5);
});

test('F-c: idempotent -- a migrated document passes through unchanged', () => {
	const once = migrateFormatBatch(withWaypoints(), null).doc;
	const twice = migrateFormatBatch(once, null);
	assert.deepEqual(twice.steps, []);
	assert.deepEqual(twice.doc, once);
});

test('F-c dry run: the waypoint map is found by name and place, so a renumbering that lost a reference is a difference', async () => {
	const { canonical, waypointMap } = await import('../tools/migrate-schema.mjs');
	const source = withWaypoints();
	const { doc } = migrateFormatBatch(source, null);
	const map = waypointMap(source, doc);
	assert.equal(map.size, 2);
	assert.equal(canonical(doc), canonical(source, map));
	const lost = structuredClone(doc); lost.groups[0].members = ['node-0000bb', 'node-0000aa'];   // pointed at the node instead
	assert.notEqual(canonical(lost), canonical(source, map));
	const moved = structuredClone(doc); moved.nodes[3].x = 0;
	assert.notEqual(canonical(moved), canonical(source, waypointMap(source, moved)), 'a waypoint moved is found as no node, and differs');
});

// ---- F-c: the node row keeps the line the kind boundary kept ----

test('F-c: whether a node has a type is fixed when it is made, and each shape keeps its own fields', async () => {
	const { plan } = await import('./fixtures/composed.mjs');
	const { Model } = await import('./fixtures/composed.mjs');
	const m = new Model();
	m.put('node', { id: 'node-0000aa', name: 'r', type: 'router', x: 0, y: 0 });
	m.put('node', { id: 'node-0000bb', name: 'w', x: 120, y: 0 });
	const refused = (ops, re) => { const r = plan(m, ops); assert.equal(r.ok, false, JSON.stringify(ops)); assert.match(r.error, re); };
	refused([{ op: 'set', kind: 'node', id: 'node-0000bb', patch: { type: 'router' } }], /type is fixed when it is made/);
	refused([{ op: 'put', kind: 'node', entity: { id: 'node-0000aa', name: 'r', x: 0, y: 0 } }], /type is fixed when it is made/);
	refused([{ op: 'set', kind: 'node', id: 'node-0000aa', patch: { pinned: true } }], /unknown field node.pinned/);   // retired at S-d
	refused([{ op: 'set', kind: 'node', id: 'node-0000aa', patch: { spawn: { interval: 900, speed: 1.4, kind: 'packet', since: Date.now() } } }], /a typed node has no spawn/);
	refused([{ op: 'set', kind: 'node', id: 'node-0000bb', patch: { shape: 'square' } }], /a waypoint \(a node with no type\) has no shape/);
	refused([{ op: 'put', kind: 'node', entity: { id: 'node-0000cc', name: 'p', x: 240, y: 0, span: { cols: 2, rows: 1 } } }], /has no span/);
	assert.equal(plan(m, [{ op: 'set', kind: 'node', id: 'node-0000aa', patch: { type: 'firewall' } }]).ok, true, 'a typed node may change its type');
	refused([{ op: 'set', kind: 'node', id: 'node-0000bb', patch: { pinned: true } }], /unknown field node.pinned/);   // a waypoint too, since S-d
	assert.equal(validateDoc({ meta: { id: 'diagram-0000dd', name: 'd' }, nodes: [{ id: 'node-0000aa', name: 'r', type: 'router', x: 0, y: 0, spawn: { interval: 900, speed: 1.4, kind: 'packet', since: Date.now() } }] })?.includes('a typed node has no spawn'), true, 'and a stored one is refused at load');
});

test('F-c: a link bends only at a waypoint -- a typed node in a via is refused, as a node id there always was', async () => {
	const { plan } = await import('./fixtures/composed.mjs');
	const { Model } = await import('./fixtures/composed.mjs');
	const m = new Model();
	for (const [id, x] of [['node-0000aa', 0], ['node-0000bb', 240], ['node-0000cc', 120]]) m.put('node', { id, name: id, type: 'host', x, y: 0 });
	const r = plan(m, [{ op: 'put', kind: 'link', entity: { id: 'link-0000dd', name: 'l', src: 'node-0000aa', dst: 'node-0000bb', via: ['node-0000cc'] } }]);
	assert.equal(r.ok, false);
	assert.match(r.error, /link via waypoint does not exist: node-0000cc/);
});

test('F-c: an unnamed old waypoint is named around the names its fellow waypoints already hold', async () => {
	const dir = tmp();
	const doc = withWaypoints();
	doc.waypoints[0].name = 'waypoint-1';
	delete doc.waypoints[1].name;
	fs.writeFileSync(path.join(dir, 'diagram-c1c1c1.json'), serialize(doc, null));
	const store = new Store(dir, { flushMs: 3_600_000 });
	await store.init();
	const names = store.diagrams.get('diagram-c1c1c1').model.all('node').filter((n) => !n.type).map((n) => n.name).sort();
	assert.deepEqual(names, ['waypoint-1', 'waypoint-2'], 'not a second waypoint-1');
});

test('F-d dry run: the order check sees an item left without one, a reordering, and an order that moved', async () => {
	const { orderProblem } = await import('../tools/migrate-schema.mjs');
	const source = withWaypoints();
	const { doc } = migrateFormatBatch(source, null);
	const { waypointMap } = await import('../tools/migrate-schema.mjs');
	const map = waypointMap(source, doc);
	assert.equal(orderProblem(source, doc, map), null);
	const missing = structuredClone(doc); delete missing.links[0].order;
	assert.match(orderProblem(source, missing, map), /without a drawing order/);
	const swapped = structuredClone(doc); [swapped.nodes[0].order, swapped.nodes[1].order] = [swapped.nodes[1].order, swapped.nodes[0].order];
	assert.match(orderProblem(source, swapped, map), /out of the order they were listed in/);
	const kept = structuredClone(source); kept.zones = [{ id: 'zone-0000ab', name: 'z', x: -90, y: -90, w: 180, h: 180, order: 7 }];
	const keptDoc = migrateFormatBatch(kept, null).doc; keptDoc.zones[0].order = 8;
	assert.match(orderProblem(kept, keptDoc, waypointMap(kept, keptDoc)), /changed its drawing order/);
});
