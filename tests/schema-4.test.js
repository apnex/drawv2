/*
WD-b1 (H19.45; dev/design/unification/WIDE-DEVICES.md sections 12.6 and 13; WD9) -- SCHEMA 3: EVERY DIAGRAM HOLDS ITS TWO
LAYOUTS, AND THE STORE KEEPS NO MIGRATION.

Every path a whole document takes into the store (`init`, `restore`, `create`, `#seedFromExamples`, `#loadTemplates`) completes
one lacking its layouts -- an agent's, a tab's from before schema 3 whose Model dropped the collection it did not know -- and
refuses an older schema, 2 as well as 1, with one sentence: production's documents were migrated once, during the deploy's
freeze, by the migration as tested at 9643c99, and the director ruled that none is carried (WD9: "Lets do a full-forward deploy
- no legacy carried"). Boot and restore write a completed document back. Test 7's makers: the seed and a store's `create` hold
the layouts by construction; `validateDoc` requires them.
RESTATED at H26.6's move 14 (dev/design/components/PAN-ZOOM.md section 3.4; PZ14; GR13), and renamed from tests/schema-3.test.js -- SCHEMA
4: every diagram holds its ONE grid record, `{ id: 'layout-000001', name: 'grid', pitch: 60 }`, completed on every door as the two
layouts were, and the store keeps no migration: production's documents are migrated once in a freeze by tools/migrate-schema-4.mjs, which
the image does not carry (WD9's form), so a schema 3 document is refused with the sentence schema 2's was.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { KINDS, validateDoc } from './fixtures/composed.mjs';
import { openStore, OWNER } from './fixtures/app.mjs';
import { Store } from '../server/store.js';
import { fsFiles } from '../server/files.mjs';
import { serialize, parse } from '../server/docfile.mjs';
import { completeAlwaysHeld } from '../model/shape.mjs';
import { LAYOUT_ROWS } from '../plugins/layouts/layout-kind.mjs';
const GRID_RECORD = LAYOUT_ROWS[0].always[0];   // the row's own record
import { scratchFolder } from '@apnex/clean-runner';   // H26-19 as amended: removed when this file ends, however it ends

const LAYOUTS = [{ id: 'layout-000001', name: 'grid', pitch: 60 }];   // H26.6's move 14: the one grid record
// schema 3's two layouts, as every schema 3 document held them
const SCHEMA_3 = [{ id: 'layout-000001', name: 'node', pitch: 60, offset: 0, ext: { x: 900, y: 480 } }, { id: 'layout-000002', name: 'zone', pitch: 60, offset: 30, ext: { x: 930, y: 510 } }];
const tmp = (tag) => scratchFolder(`draw-schema4-${tag}-`);
// a second empty data directory inside the first, removed with it
const tmpKept = (dir) => fs.mkdtempSync(path.join(dir, 'second-'));
// a schema 4 document without its grid -- as an agent writes one, or a tab whose Model dropped the collection holds one; `schema` null: none at all
const lacking = (id, schema = 4) => ({
	meta: { id, name: 'without its layouts', version: 4, ...(schema === null ? {} : { schema }), owner: '', grants: {} },
	nodes: [{ id: 'node-0e0001', name: 'a', type: 'host', shape: 'circle', x: 0, y: 0, order: 1 }],
	links: [], pipes: [],
	zones: [{ id: 'zone-0e0001', name: 'z', x: -90, y: -90, w: 180, h: 180, order: 1 }],
	groups: [], selection: [],
});
const layoutsOf = (model) => model.all('layout').map((l) => ({ ...l }));
const SAID = (n) => new RegExp(`written in schema ${n}, an older format: this version reads schema 4 only and keeps no migration`);

test('WD-b1, restated at H26.6 move 14: completion is pure -- the grid record added as a copy of its own, the rest equal; a whole document passes as the same object', () => {
	const src = lacking('00000000000e0001');
	const before = structuredClone(src);
	const done = completeAlwaysHeld(src, KINDS);
	assert.deepEqual(src, before, 'its input untouched');
	assert.deepEqual(done.layouts, LAYOUTS, 'exactly the one record, at 60');
	assert.ok(done.layouts[0] !== GRID_RECORD && !Object.isFrozen(done.layouts[0]), 'a copy of its own, not the row\'s');
	const { layouts: _l, ...rest } = done;
	assert.deepEqual(rest, src, 'every other entity equal to its source, meta included');
	assert.equal(completeAlwaysHeld(done, KINDS), done, 'a document holding them passes as the same object');
	const old = { ...src, layouts: structuredClone(SCHEMA_3) };
	assert.equal(completeAlwaysHeld(old, KINDS), old, 'one holding schema 3\'s two is left as it is, for the validator to refuse -- nothing migrates it');
	const odd = { ...src, layouts: 'not a list' };
	assert.equal(completeAlwaysHeld(odd, KINDS), odd, 'a collection that is not a list is left for the validator');
});

test('WD-b1, restated at H26.6 move 14: validateDoc requires the one grid record, and refuses schema 3\'s two', () => {
	const doc = completeAlwaysHeld(lacking('00000000000e0001'), KINDS);
	assert.match(validateDoc({ ...doc, layouts: [] }), /\(layout-000001\) is missing/, 'missing, named');
	assert.match(validateDoc({ ...doc, layouts: [{ ...doc.layouts[0], offset: 30 }] }), /unknown field layout\.offset/, 'a stored offset (GR7)');
	assert.match(validateDoc({ ...doc, layouts: structuredClone(SCHEMA_3) }), /layout/, 'schema 3\'s two records');
	assert.match(validateDoc({ ...doc, meta: { ...doc.meta, schema: 3 } }), /unsupported meta.schema: 3/, 'a schema 3 one is not a schema 4 one');
	assert.equal(validateDoc(doc), null, 'the one, as it is -- the control');
});

test('WD-b1, restated at H26.6 move 14: boot completes a file lacking its grid and writes it back; a schema 3 file is refused, said plainly, and left as it was', async () => {
	const dir = tmp('boot');
	fs.writeFileSync(path.join(dir, '00000000000e0002.json'), serialize(lacking('00000000000e0002'), { version: 4, cursor: 0, evicted: 0, records: [] }));
	fs.writeFileSync(path.join(dir, '00000000000e0003.json'), JSON.stringify({ ...lacking('00000000000e0003', 3), layouts: SCHEMA_3 }));
	const said = [], error = console.error, warn = console.warn;
	console.error = console.warn = (...a) => said.push(a.join(' '));
	try {
		// no principal: adopting the ownerless diagram would mark it dirty, and the write-back under test with it
		const s = await openStore(dir, { principal: null });
		const m = s.get('00000000000e0002');
		assert.ok(m, 'the document lacking its layouts is loaded');
		assert.deepEqual(layoutsOf(m), LAYOUTS, 'holding its grid record');
		assert.equal(m.all('node').length, 1, 'and its own entities');
		await s.flushAll();
		const { doc, log } = parse(fs.readFileSync(path.join(dir, '00000000000e0002.json'), 'utf8'));
		assert.deepEqual(doc.layouts, LAYOUTS, 'written back with its layouts');
		assert.equal(doc.meta.schema, 4);
		assert.equal(log.version, 4, 'its log kept');
		assert.ok(!s.get('00000000000e0003'), 'the schema 3 document is not loaded -- no migration is kept');
		assert.ok(said.some((l) => l.includes('00000000000e0003') && SAID(3).test(l)), `the reason said where an operator reads: ${said.join(' | ')}`);
		assert.equal(JSON.parse(fs.readFileSync(path.join(dir, '00000000000e0003.json'), 'utf8')).meta.schema, 3, 'and its file is left as it was');
	} finally { console.error = error; console.warn = warn; fs.rmSync(dir, { recursive: true, force: true }); }
});

test('WD-b1, restated at H26.6 move 14: create completes a document lacking its grid, with or without a schema; refuses schema 3; a new one holds it; the seed too', async () => {
	const dir = tmp('create');
	try {
		const s = await openStore(dir);
		const tab = s.create('tab', lacking('00000000000e0004'), OWNER);
		assert.equal(tab.ok, true, `a schema 4 document without its grid is installed: ${tab.error ?? ''}`);
		assert.deepEqual(layoutsOf(tab.model), LAYOUTS);
		const bare = s.create('bare', lacking('00000000000e0005', null), OWNER);
		assert.equal(bare.ok, true, `one with no meta.schema is installed: ${bare.error ?? ''}`);
		assert.deepEqual(layoutsOf(bare.model), LAYOUTS);
		const fresh = s.create('fresh', null, OWNER);
		assert.deepEqual(layoutsOf(fresh.model), LAYOUTS, 'a new diagram holds its layouts');
		assert.equal(fresh.model.toJSON().meta.schema, 4);
		const three = s.create('three', { ...lacking('00000000000e0006', 3), layouts: structuredClone(SCHEMA_3) }, OWNER);
		assert.equal(three.ok, false, 'schema 3 is refused');
		assert.match(three.error, SAID(3));
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
	const { seedDoc } = await import('../server/seed.js');
	const seeded = seedDoc();
	assert.deepEqual(seeded.layouts, LAYOUTS, 'the seed holds its layouts as written');
	assert.equal(seeded.meta.schema, 4);
});

test('WD-b1: the examples and the templates are completed on their way in', async () => {
	const dir = tmp('seed'), examples = tmp('examples'), templates = tmp('templates');
	try {
		fs.writeFileSync(path.join(examples, '00000000000e0007.json'), JSON.stringify(lacking('00000000000e0007')));
		fs.writeFileSync(path.join(templates, 'template-0e0008.json'), JSON.stringify(lacking('template-0e0008')));
		// apart: a store seeds its examples only when it holds no template either
		const s = await openStore(dir, { examplesDir: examples });
		const ex = s.get('00000000000e0007');
		assert.ok(ex, 'the example is seeded');
		assert.deepEqual(layoutsOf(ex), LAYOUTS);
		const t = (await openStore(tmpKept(dir), { templatesDir: templates })).get('template-0e0008');
		assert.ok(t, 'the template is loaded');
		assert.deepEqual(layoutsOf(t), LAYOUTS);
	} finally { for (const d of [dir, examples, templates]) fs.rmSync(d, { recursive: true, force: true }); }
});

test('WD-b1, restated at H26.6 move 14: restore completes a generation lacking its grid and writes it back; a schema 3 generation is refused, said plainly', async () => {
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
		const second = s.create('second', null, null).model.state.meta.id;
		await s.flushAll();
		// the first generation lacking its grid; the second, schema 3
		assert.equal(await s.remove(id, null), null, 'removed');
		const held = bin.get(`${id}.json`);
		const { doc, log } = parse(held.text);
		const { layouts: _drop, ...without } = doc;
		held.text = serialize(without, log);
		assert.equal('layouts' in parse(held.text).doc, false, 'the generation lacks its layouts -- the state under test');
		assert.equal(await s.restore(id, null), null, 'restore reports success');
		assert.deepEqual(layoutsOf(s.get(id)), LAYOUTS, 'the diagram is back, holding its layouts');
		await s.flushAll();
		assert.deepEqual(parse(fs.readFileSync(path.join(dir, `${id}.json`), 'utf8')).doc.layouts, LAYOUTS, 'and written back with them');

		assert.equal(await s.remove(second, null), null, 'the second removed');
		const old = bin.get(`${second}.json`);
		const parsed = parse(old.text);
		old.text = serialize({ ...parsed.doc, meta: { ...parsed.doc.meta, schema: 3 }, layouts: structuredClone(SCHEMA_3) }, parsed.log);
		assert.match(await s.restore(second, null), SAID(3), 'a schema 3 generation is refused, said plainly');
		assert.ok(!s.get(second), 'and not loaded');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// RESTATED at H26.6's move 14 (WD9's form): and the schema 4 migration is a tool the image does not carry, imported by no shipped module
test('WD9: the store carries no migration -- none of the schema 3 migration\'s files is left, and nothing imports one; the schema 4 migration is not in the image', () => {
	for (const gone of ['server/migrate-schema-3.mjs', 'tools/migrate-down-to-schema-2.mjs']) {
		assert.equal(fs.existsSync(new URL(`../${gone}`, import.meta.url)), false, `${gone} is not carried (WD9)`);
	}
	const store = fs.readFileSync(new URL('../server/store.js', import.meta.url), 'utf8');
	assert.equal(/import[^;]*migrat/i.test(store), false, 'the store imports no migration');
	const dockerfile = fs.readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
	const copied = [...dockerfile.matchAll(/^COPY\s+(\S+)/gm)].map((m) => m[1]);
	assert.ok(copied.includes('server/') && copied.includes('templates/'), 'control: the image\'s folders read');
	assert.equal(copied.some((c) => c.startsWith('tools')), false, 'the image copies no tools/, so tools/migrate-schema-4.mjs is not in it');
	for (const dir of copied.filter((c) => c.endsWith('/'))) {
		for (const f of fs.readdirSync(new URL(`../${dir}`, import.meta.url), { recursive: true }).filter((x) => /\.m?js$/.test(x))) {
			const code = fs.readFileSync(new URL(`../${dir}${f}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
			assert.doesNotMatch(code, /migrate-schema-4/, `${dir}${f} imports no migration`);
		}
	}
});
