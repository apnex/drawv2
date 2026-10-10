/*
WD-b1 (H19.45; dev/design/unification/WIDE-DEVICES.md sections 12.6 and 13) -- SCHEMA 3: EVERY DIAGRAM HOLDS ITS TWO LAYOUTS,
AND ONE MIGRATION BRINGS A SCHEMA 2 DOCUMENT THERE ON EVERY PATH INTO THE STORE.

Test 8: the migration is pure and idempotent; a schema 2 document -- or one with no `meta.schema`, which is read as schema 2 --
gains exactly the two layouts and `meta.schema` 3, every other entity equal to its source; it runs on every path a whole
document takes into the store (`init`, `restore`, `create`, `#seedFromExamples`, `#loadTemplates`), boot writing a migrated
document back; a schema 1 document is still refused, with B291's sentence. A document posted with schema 3 and no layouts --
a tab from before the change, whose Model drops the collection it does not know -- is completed the same way.

Test 7's makers: the seed and a store's `create` hold the layouts by construction; `validateDoc` requires them.

The way back (finding 6): a down-migration, kept and tested until WD-c, so an image rolled back reads the bucket with every
edit kept -- run over a copy of the bucket by `tools/migrate-down-to-schema-2.mjs`.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { KINDS, validateDoc } from './fixtures/composed.mjs';
import { openStore, OWNER } from './fixtures/app.mjs';
import { Store } from '../server/store.js';
import { fsFiles } from '../server/files.mjs';
import { serialize, parse } from '../server/docfile.mjs';
import { LAYOUT_TABLE } from '../layouts/layout-table.mjs';
import { migrateToSchema3, migrateDownToSchema2 } from '../server/migrate-schema-3.mjs';

const LAYOUTS = structuredClone(LAYOUT_TABLE).map((l) => ({ ...l, ext: { ...l.ext } }));
const tmp = (tag) => fs.mkdtempSync(path.join(os.tmpdir(), `draw-schema3-${tag}-`));
// a second empty data directory inside the first, removed with it
const tmpKept = (dir) => fs.mkdtempSync(path.join(dir, 'second-'));
// `schema` null: a document with no meta.schema at all
const schema2 = (id, schema = 2) => ({
	meta: { id, name: 'before schema 3', version: 4, ...(schema === null ? {} : { schema }), owner: '', grants: {} },
	nodes: [{ id: 'node-0e0001', name: 'a', type: 'host', shape: 'circle', x: 0, y: 0, order: 1 }],
	links: [], pipes: [],
	zones: [{ id: 'zone-0e0001', name: 'z', x: -90, y: -90, w: 180, h: 180, order: 1 }],
	groups: [], selection: [],
});
const older = (id) => ({ meta: { id, name: 'before the cutover', version: 3, schema: 1, owner: '', grants: {} },
	nodes: [], waypoints: [], links: [], zones: [], groups: [], selection: [] });
const layoutsOf = (model) => model.all('layout').map((l) => ({ ...l, ext: { ...l.ext } }));

test('WD-b1 test 8: the migration is pure -- a schema 2 document gains exactly the two layouts and schema 3, the rest equal', () => {
	const src = schema2('diagram-0e0001');
	const before = structuredClone(src);
	const a = migrateToSchema3(src, KINDS), b = migrateToSchema3(src, KINDS);
	assert.deepEqual(src, before, 'its input untouched');
	assert.deepEqual(a, b, 'the same input gives the same output');
	assert.equal(a.migrated, true);
	assert.equal(a.doc.meta.schema, 3);
	assert.deepEqual(a.doc.layouts, LAYOUTS, 'exactly the two layouts, with the product\'s values');
	assert.ok(a.doc.layouts.every((l, i) => l !== LAYOUT_TABLE[i] && l.ext !== LAYOUT_TABLE[i].ext && !Object.isFrozen(l.ext)), 'each a copy of its own, not the table\'s');
	const { layouts: _l, meta, ...rest } = a.doc;
	const { meta: meta0, ...rest0 } = src;
	assert.deepEqual(rest, rest0, 'every other entity equal to its source');
	assert.deepEqual({ ...meta, schema: 2 }, meta0, 'and meta, but for its schema');
	assert.equal(validateDoc(a.doc), null, 'and valid');
	assert.equal(validateDoc(src) === null, false, 'the source is not -- the control');
});

test('WD-b1 test 8: idempotent; no schema is schema 2; schema 3 without its layouts is completed; schema 1 is left for refusal', () => {
	const once = migrateToSchema3(schema2('diagram-0e0001'), KINDS).doc;
	const twice = migrateToSchema3(once, KINDS);
	assert.equal(twice.migrated, false, 'a schema 3 document holding its layouts is not migrated');
	assert.equal(twice.doc, once, 'and passes unchanged, the same object');

	assert.equal('schema' in schema2('diagram-0e0001', null).meta, false, 'no meta.schema -- the state under test');
	const unstamped = migrateToSchema3(schema2('diagram-0e0001', null), KINDS);
	assert.equal(unstamped.migrated, true, 'a document with no meta.schema is read as schema 2');
	assert.equal(unstamped.doc.meta.schema, 3);
	assert.deepEqual(unstamped.doc.layouts, LAYOUTS);

	// a tab from before the change: its Model dropped the collection it does not know, and kept meta.schema 3
	const { layouts: _drop, ...oldTab } = once;
	const completed = migrateToSchema3(oldTab, KINDS);
	assert.equal(completed.migrated, true, 'schema 3 without its layouts is completed');
	assert.deepEqual(completed.doc.layouts, LAYOUTS);
	const half = migrateToSchema3({ ...once, layouts: [once.layouts[1]] }, KINDS).doc;
	assert.deepEqual(half.layouts.map((l) => l.id).sort(), ['layout-000001', 'layout-000002'], 'and one holding one is given the other');

	const one = older('diagram-0e0009');
	assert.deepEqual(migrateToSchema3(one, KINDS), { doc: one, migrated: false }, 'schema 1 is not migrated: the refusal speaks');
});

test('WD-b1: validateDoc requires the two layouts, and the product\'s values in them', () => {
	const doc = migrateToSchema3(schema2('diagram-0e0001'), KINDS).doc;
	assert.match(validateDoc({ ...doc, layouts: doc.layouts.slice(1) }), /node layout \(layout-000001\)/, 'one missing, named');
	assert.match(validateDoc({ ...doc, layouts: [] }), /layout/, 'both missing');
	const moved = { ...doc, layouts: [{ ...doc.layouts[0], offset: 30 }, doc.layouts[1]] };
	assert.match(validateDoc(moved), /may not vary its grids yet \(WD7\)/, 'a value changed');
	assert.equal(validateDoc(doc), null, 'the two, as they are -- the control');
});

test('WD-b1 test 8: boot migrates a schema 2 file and writes it back as schema 3; a schema 1 file is refused, said plainly', async () => {
	const dir = tmp('boot');
	fs.writeFileSync(path.join(dir, 'diagram-0e0002.json'), serialize(schema2('diagram-0e0002'), { version: 4, cursor: 0, evicted: 0, records: [] }));
	fs.writeFileSync(path.join(dir, 'diagram-0e0003.json'), JSON.stringify(older('diagram-0e0003')));
	const said = [], error = console.error, warn = console.warn;
	console.error = console.warn = (...a) => said.push(a.join(' '));
	try {
		// no principal: adopting the ownerless diagram would mark it dirty, and the write-back under test with it
		const s = await openStore(dir, { principal: null });
		const m = s.get('diagram-0e0002');
		assert.ok(m, 'the schema 2 document is loaded');
		assert.deepEqual(layoutsOf(m), LAYOUTS, 'holding its two layouts');
		assert.equal(m.all('node').length, 1, 'and its own entities');
		await s.flushAll();
		const { doc, log } = parse(fs.readFileSync(path.join(dir, 'diagram-0e0002.json'), 'utf8'));
		assert.equal(doc.meta.schema, 3, 'written back as schema 3');
		assert.deepEqual(doc.layouts, LAYOUTS, 'with its layouts');
		assert.equal(log.version, 4, 'its log kept');
		assert.ok(!s.get('diagram-0e0003'), 'the schema 1 document is not loaded');
		assert.ok(said.some((l) => l.includes('diagram-0e0003') && /in schema 1: this version reads schema 3, migrating schema 2 to it, and keeps no migration from schema 1/.test(l)),
			`the reason said where an operator reads: ${said.join(' | ')}`);
	} finally { console.error = error; console.warn = warn; fs.rmSync(dir, { recursive: true, force: true }); }
});

test('WD-b1 test 8: create migrates a schema 2 document and completes an old tab\'s; a new one holds its layouts; the seed too', async () => {
	const dir = tmp('create');
	try {
		const s = await openStore(dir);
		const two = s.create('two', schema2('diagram-0e0004'), OWNER);
		assert.equal(two.ok, true, `a schema 2 document is installed: ${two.error ?? ''}`);
		assert.deepEqual(layoutsOf(two.model), LAYOUTS);
		const { layouts: _drop, ...oldTab } = migrateToSchema3(schema2('diagram-0e0005'), KINDS).doc;
		const tab = s.create('tab', oldTab, OWNER);
		assert.equal(tab.ok, true, `an old tab's schema 3 document without layouts is installed: ${tab.error ?? ''}`);
		assert.deepEqual(layoutsOf(tab.model), LAYOUTS);
		const fresh = s.create('fresh', null, OWNER);
		assert.deepEqual(layoutsOf(fresh.model), LAYOUTS, 'a new diagram holds its layouts');
		const refused = s.create('old', older('diagram-0e0006'), OWNER);
		assert.equal(refused.ok, false, 'schema 1 is refused');
		assert.equal(fresh.model.toJSON().meta.schema, 3);
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
	const { seedDoc } = await import('../server/seed.js');
	const seeded = seedDoc();
	assert.deepEqual(seeded.layouts, LAYOUTS, 'the seed holds its layouts as written');
	assert.equal(seeded.meta.schema, 3);
});

test('WD-b1 test 8: the examples and the templates are migrated on their way in', async () => {
	const dir = tmp('seed'), examples = tmp('examples'), templates = tmp('templates');
	try {
		fs.writeFileSync(path.join(examples, 'diagram-0e0007.json'), JSON.stringify(schema2('diagram-0e0007')));
		fs.writeFileSync(path.join(templates, 'template-0e0008.json'), JSON.stringify(schema2('template-0e0008')));
		// apart: a store seeds its examples only when it holds no template either
		const s = await openStore(dir, { examplesDir: examples });
		const ex = s.get('diagram-0e0007');
		assert.ok(ex, 'the schema 2 example is seeded');
		assert.deepEqual(layoutsOf(ex), LAYOUTS);
		const t = (await openStore(tmpKept(dir), { templatesDir: templates })).get('template-0e0008');
		assert.ok(t, 'the schema 2 template is loaded');
		assert.deepEqual(layoutsOf(t), LAYOUTS);
	} finally { for (const d of [dir, examples, templates]) fs.rmSync(d, { recursive: true, force: true }); }
});

test('WD-b1 test 8: restore migrates a schema 2 generation and writes it back as schema 3', async () => {
	const dir = tmp('restore');
	const real = fsFiles(dir);
	const bin = new Map();
	const files = {
		...real,
		async remove(name, tags) {
			try { bin.set(name, { text: await real.read(name), tags: tags || null }); } catch { /* nothing to keep */ }
			return real.remove(name);
		},
		async recoverable() {
			return [...bin.entries()].map(([name, v]) => ({ name, generation: '7', tags: v.tags, deletedAt: '2026-01-01T00:00:00Z', purgeAt: '2026-01-08T00:00:00Z' }));
		},
		async restore(name) { await real.write(name, bin.get(name).text); bin.delete(name); },
	};
	const s = new Store(dir, { flushMs: 3_600_000, files, authz: false });
	await s.init();
	try {
		const id = s.list(null)[0].id;
		await s.flushAll();
		assert.equal(await s.remove(id, null), null, 'removed');
		// the deleted generation as it was written before schema 3: the way back's own output
		const held = bin.get(`${id}.json`);
		const { doc, log } = parse(held.text);
		held.text = serialize(migrateDownToSchema2(doc, KINDS), log);
		assert.equal(parse(held.text).doc.meta.schema, 2, 'the generation is schema 2 -- the state under test');
		assert.equal(await s.restore(id, null), null, 'restore reports success');
		assert.deepEqual(layoutsOf(s.get(id)), LAYOUTS, 'the diagram is back, holding its layouts');
		await s.flushAll();
		assert.equal(parse(fs.readFileSync(path.join(dir, `${id}.json`), 'utf8')).doc.meta.schema, 3, 'and written back as schema 3');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('WD-b1: the way back -- the down-migration drops the layouts and stamps schema 2, keeping every edit; the round trip is exact', () => {
	const src = schema2('diagram-0e0001');
	const up = migrateToSchema3(src, KINDS).doc;
	const before = structuredClone(up);
	assert.deepEqual(migrateDownToSchema2(up, KINDS), src, 'down after up is the source');
	assert.deepEqual(up, before, 'its input untouched');
	const edited = { ...up, nodes: [...up.nodes, { id: 'node-0e0002', name: 'b', type: 'host', shape: 'circle', x: 60, y: 0, order: 2 }] };
	const down = migrateDownToSchema2(edited, KINDS);
	assert.equal(down.meta.schema, 2);
	assert.equal('layouts' in down, false, 'no layouts collection -- the old image refuses one it does not know (B307)');
	assert.deepEqual(down.nodes.map((n) => n.name), ['a', 'b'], 'the edit made under schema 3 kept');
});

test('WD-b1: tools/migrate-down-to-schema-2.mjs rewrites a bucket copy\'s diagrams as schema 2, logs kept, nothing else touched', () => {
	const dir = tmp('down');
	try {
		const up = migrateToSchema3(schema2('diagram-0e000a'), KINDS).doc;
		const log = { version: 4, cursor: 1, evicted: 0, evictedHuman: 0, records: [{ label: 'one', ops: [], inverse: [] }] };
		fs.writeFileSync(path.join(dir, 'diagram-0e000a.json'), serialize(up, log));
		fs.writeFileSync(path.join(dir, 'other.json'), '{"not":"a diagram"}');
		const run = spawnSync(process.execPath, ['tools/migrate-down-to-schema-2.mjs', dir], { encoding: 'utf8' });
		assert.equal(run.status, 0, run.stderr);
		assert.match(run.stdout, /1 diagram\(s\) rewritten as schema 2/);
		const back = parse(fs.readFileSync(path.join(dir, 'diagram-0e000a.json'), 'utf8'));
		assert.deepEqual(back.doc, schema2('diagram-0e000a'), 'the document as schema 2');
		assert.deepEqual(back.log, log, 'its log kept');
		assert.equal(fs.readFileSync(path.join(dir, 'other.json'), 'utf8'), '{"not":"a diagram"}', 'a file not a diagram\'s left alone');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
