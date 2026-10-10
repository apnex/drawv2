/*
WD-b1 (H19.45; dev/design/unification/WIDE-DEVICES.md sections 12.6 and 13; WD9) -- SCHEMA 3: EVERY DIAGRAM HOLDS ITS TWO
LAYOUTS, AND THE STORE KEEPS NO MIGRATION.

Every path a whole document takes into the store (`init`, `restore`, `create`, `#seedFromExamples`, `#loadTemplates`) completes
one lacking its layouts -- an agent's, a tab's from before schema 3 whose Model dropped the collection it did not know -- and
refuses an older schema, 2 as well as 1, with one sentence: production's documents were migrated once, during the deploy's
freeze, by the migration as tested at 9643c99, and the director ruled that none is carried (WD9: "Lets do a full-forward deploy
- no legacy carried"). Boot and restore write a completed document back. Test 7's makers: the seed and a store's `create` hold
the layouts by construction; `validateDoc` requires them.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { KINDS, validateDoc } from './fixtures/composed.mjs';
import { openStore, OWNER } from './fixtures/app.mjs';
import { Store } from '../server/store.js';
import { fsFiles } from '../server/files.mjs';
import { serialize, parse } from '../server/docfile.mjs';
import { completeAlwaysHeld } from '../model/shape.mjs';
import { LAYOUT_TABLE } from '../layouts/layout-table.mjs';

const LAYOUTS = structuredClone(LAYOUT_TABLE).map((l) => ({ ...l, ext: { ...l.ext } }));
const tmp = (tag) => fs.mkdtempSync(path.join(os.tmpdir(), `draw-schema3-${tag}-`));
// a second empty data directory inside the first, removed with it
const tmpKept = (dir) => fs.mkdtempSync(path.join(dir, 'second-'));
// a schema 3 document without its layouts -- as an agent writes one, or a tab from before schema 3 holds one; `schema` null: none at all
const lacking = (id, schema = 3) => ({
	meta: { id, name: 'without its layouts', version: 4, ...(schema === null ? {} : { schema }), owner: '', grants: {} },
	nodes: [{ id: 'node-0e0001', name: 'a', type: 'host', shape: 'circle', x: 0, y: 0, order: 1 }],
	links: [], pipes: [],
	zones: [{ id: 'zone-0e0001', name: 'z', x: -90, y: -90, w: 180, h: 180, order: 1 }],
	groups: [], selection: [],
});
const layoutsOf = (model) => model.all('layout').map((l) => ({ ...l, ext: { ...l.ext } }));
const SAID = (n) => new RegExp(`written in schema ${n}, an older format: this version reads schema 3 only and keeps no migration`);

test('WD-b1: completion is pure -- the two layouts added as copies of their own, the rest equal; a whole document passes as the same object', () => {
	const src = lacking('diagram-0e0001');
	const before = structuredClone(src);
	const done = completeAlwaysHeld(src, KINDS);
	assert.deepEqual(src, before, 'its input untouched');
	assert.deepEqual(done.layouts, LAYOUTS, 'exactly the two layouts, with the product\'s values');
	assert.ok(done.layouts.every((l, i) => l !== LAYOUT_TABLE[i] && l.ext !== LAYOUT_TABLE[i].ext && !Object.isFrozen(l.ext)), 'each a copy of its own, not the table\'s');
	const { layouts: _l, ...rest } = done;
	assert.deepEqual(rest, src, 'every other entity equal to its source, meta included');
	assert.equal(completeAlwaysHeld(done, KINDS), done, 'a document holding them passes as the same object');
	const half = completeAlwaysHeld({ ...src, layouts: [LAYOUTS[1]] }, KINDS);
	assert.deepEqual(half.layouts.map((l) => l.id).sort(), ['layout-000001', 'layout-000002'], 'one holding one is given the other');
	const odd = { ...src, layouts: 'not a list' };
	assert.equal(completeAlwaysHeld(odd, KINDS), odd, 'a collection that is not a list is left for the validator');
});

test('WD-b1: validateDoc requires the two layouts, and the product\'s values in them', () => {
	const doc = completeAlwaysHeld(lacking('diagram-0e0001'), KINDS);
	assert.match(validateDoc({ ...doc, layouts: doc.layouts.slice(1) }), /node layout \(layout-000001\)/, 'one missing, named');
	assert.match(validateDoc({ ...doc, layouts: [] }), /layout/, 'both missing');
	const moved = { ...doc, layouts: [{ ...doc.layouts[0], offset: 30 }, doc.layouts[1]] };
	assert.match(validateDoc(moved), /may not vary its grids yet \(WD7\)/, 'a value changed');
	assert.match(validateDoc({ ...doc, meta: { ...doc.meta, schema: 2 } }), /unsupported meta.schema: 2/, 'a schema 2 one is not a schema 3 one');
	assert.equal(validateDoc(doc), null, 'the two, as they are -- the control');
});

test('WD-b1: boot completes a file lacking its layouts and writes it back; a schema 2 file is refused, said plainly, and left as it was', async () => {
	const dir = tmp('boot');
	fs.writeFileSync(path.join(dir, 'diagram-0e0002.json'), serialize(lacking('diagram-0e0002'), { version: 4, cursor: 0, evicted: 0, records: [] }));
	fs.writeFileSync(path.join(dir, 'diagram-0e0003.json'), JSON.stringify(lacking('diagram-0e0003', 2)));
	const said = [], error = console.error, warn = console.warn;
	console.error = console.warn = (...a) => said.push(a.join(' '));
	try {
		// no principal: adopting the ownerless diagram would mark it dirty, and the write-back under test with it
		const s = await openStore(dir, { principal: null });
		const m = s.get('diagram-0e0002');
		assert.ok(m, 'the document lacking its layouts is loaded');
		assert.deepEqual(layoutsOf(m), LAYOUTS, 'holding its two layouts');
		assert.equal(m.all('node').length, 1, 'and its own entities');
		await s.flushAll();
		const { doc, log } = parse(fs.readFileSync(path.join(dir, 'diagram-0e0002.json'), 'utf8'));
		assert.deepEqual(doc.layouts, LAYOUTS, 'written back with its layouts');
		assert.equal(doc.meta.schema, 3);
		assert.equal(log.version, 4, 'its log kept');
		assert.ok(!s.get('diagram-0e0003'), 'the schema 2 document is not loaded -- no migration is kept');
		assert.ok(said.some((l) => l.includes('diagram-0e0003') && SAID(2).test(l)), `the reason said where an operator reads: ${said.join(' | ')}`);
		assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'diagram-0e0003.json'), 'utf8')).meta.schema, 2, 'and its file is left as it was');
	} finally { console.error = error; console.warn = warn; fs.rmSync(dir, { recursive: true, force: true }); }
});

test('WD-b1: create completes a document lacking its layouts, with or without a schema; refuses schema 2; a new one holds them; the seed too', async () => {
	const dir = tmp('create');
	try {
		const s = await openStore(dir);
		const tab = s.create('tab', lacking('diagram-0e0004'), OWNER);
		assert.equal(tab.ok, true, `a schema 3 document without layouts is installed: ${tab.error ?? ''}`);
		assert.deepEqual(layoutsOf(tab.model), LAYOUTS);
		const bare = s.create('bare', lacking('diagram-0e0005', null), OWNER);
		assert.equal(bare.ok, true, `one with no meta.schema is installed: ${bare.error ?? ''}`);
		assert.deepEqual(layoutsOf(bare.model), LAYOUTS);
		const fresh = s.create('fresh', null, OWNER);
		assert.deepEqual(layoutsOf(fresh.model), LAYOUTS, 'a new diagram holds its layouts');
		assert.equal(fresh.model.toJSON().meta.schema, 3);
		const two = s.create('two', lacking('diagram-0e0006', 2), OWNER);
		assert.equal(two.ok, false, 'schema 2 is refused');
		assert.match(two.error, SAID(2));
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
	const { seedDoc } = await import('../server/seed.js');
	const seeded = seedDoc();
	assert.deepEqual(seeded.layouts, LAYOUTS, 'the seed holds its layouts as written');
	assert.equal(seeded.meta.schema, 3);
});

test('WD-b1: the examples and the templates are completed on their way in', async () => {
	const dir = tmp('seed'), examples = tmp('examples'), templates = tmp('templates');
	try {
		fs.writeFileSync(path.join(examples, 'diagram-0e0007.json'), JSON.stringify(lacking('diagram-0e0007')));
		fs.writeFileSync(path.join(templates, 'template-0e0008.json'), JSON.stringify(lacking('template-0e0008')));
		// apart: a store seeds its examples only when it holds no template either
		const s = await openStore(dir, { examplesDir: examples });
		const ex = s.get('diagram-0e0007');
		assert.ok(ex, 'the example is seeded');
		assert.deepEqual(layoutsOf(ex), LAYOUTS);
		const t = (await openStore(tmpKept(dir), { templatesDir: templates })).get('template-0e0008');
		assert.ok(t, 'the template is loaded');
		assert.deepEqual(layoutsOf(t), LAYOUTS);
	} finally { for (const d of [dir, examples, templates]) fs.rmSync(d, { recursive: true, force: true }); }
});

test('WD-b1: restore completes a generation lacking its layouts and writes it back; a schema 2 generation is refused, said plainly', async () => {
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
		// the first generation lacking its layouts; the second, schema 2
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
		old.text = serialize({ ...parsed.doc, meta: { ...parsed.doc.meta, schema: 2 } }, parsed.log);
		assert.match(await s.restore(second, null), SAID(2), 'a schema 2 generation is refused, said plainly');
		assert.ok(!s.get(second), 'and not loaded');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('WD9: the store carries no migration -- none of the schema 3 migration\'s files is left, and nothing imports one', () => {
	for (const gone of ['server/migrate-schema-3.mjs', 'tools/migrate-down-to-schema-2.mjs']) {
		assert.equal(fs.existsSync(new URL(`../${gone}`, import.meta.url)), false, `${gone} is not carried (WD9)`);
	}
	const store = fs.readFileSync(new URL('../server/store.js', import.meta.url), 'utf8');
	assert.equal(/import[^;]*migrat/i.test(store), false, 'the store imports no migration');
});
