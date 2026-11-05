/*
H26.6's move 14 (dev/design/components/PAN-ZOOM.md section 3.4, "The migration, once"; PZ14; GR13; appendix A's second and third move 14
rows) -- THE MIGRATION, SCHEMA 3 TO 4, AS THE FREEZE RUNS IT (tools/migrate-schema-4.mjs; deploy/DEPLOY.md, the move 14 runbook).

Its two verbs are run as the runbook runs them, on folders made here: schema 3 documents written as the store writes them -- a diagram
with its log, one without a log, a template -- beside an access file and a codes file, which are not documents. `migrate` changes the two
layouts into the one grid record and `meta.schema` 3 into 4 and nothing else (GR13), refuses a file it cannot migrate exactly and then
writes nothing; `verify` passes the folder it made and fails one where any other byte moved, naming the file. The tree's four templates,
migrated by the tool, are held to it: each, taken back to schema 3 by the inverse of those two replacements, migrates to itself byte for
byte. The rehearsal on the pinned production copies and its record are the move's, outside the repository (PAN-ZOOM.md appendix B).
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { scratchFolder } from '@apnex/clean-runner';   // H26-19 as amended: removed when this file ends, however it ends
import { serialize } from '../server/docfile.mjs';
import { migrateText, SCHEMA_3_LAYOUTS } from '../tools/migrate-schema-4.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const TOOL = path.join(ROOT, 'tools/migrate-schema-4.mjs');
const run = (...args) => spawnSync(process.execPath, [TOOL, ...args], { cwd: ROOT, encoding: 'utf8' });
const ONE = [{ id: 'layout-000001', name: 'grid', pitch: 60 }];

// a schema 3 document as production holds one: meta first, its layouts, its entities, written by the store with its log
const schema3 = (id, extra = {}) => ({
	meta: { id, name: 'a diagram', version: 7, schema: 3, owner: 'user:someone@example.com', grants: { 'agent:planner': 'write' }, public: false,
		plugins: ['layouts', 'zones', 'groups', 'devices', 'the simulation', 'the network'] },
	layouts: structuredClone(SCHEMA_3_LAYOUTS),
	nodes: [{ id: 'node-0e4001', name: 'a', type: 'host', shape: 'circle', x: 0, y: 0, order: 1 }, { id: 'node-0e4002', name: 'b', type: 'router', shape: 'square', x: 240, y: -120, order: 2 }],
	zones: [{ id: 'zone-0e4001', name: 'z', x: -90, y: -90, w: 180, h: 180, order: 1 }],
	groups: [], links: [], pipes: [], selection: [],
	...extra,
});
const LOG = { version: 7, cursor: 0, evicted: 0, evictedHuman: 0, records: [] };

test('H26.6 move 14 (GR13): one file migrated -- the two layouts become the one record and meta.schema 4, no other line of it changed', () => {
	const before = serialize(schema3('00000000000e4001'), LOG);
	const r = migrateText(before);
	assert.equal(r.ok, true, r.error);
	assert.equal(r.text, serialize({ ...schema3('00000000000e4001'), meta: { ...schema3('00000000000e4001').meta, schema: 4 }, layouts: ONE }, LOG), 'the store\'s own serialization of the migrated document');
	const a = before.split('\n'), b = r.text.split('\n');
	const removed = a.filter((l) => !b.includes(l)), added = b.filter((l) => !a.includes(l));
	assert.deepEqual(added.map((l) => l.trim()), ['"schema": 4,', '"name": "grid",', '"pitch": 60'], 'the lines added: the schema and the one record\'s name and pitch');
	assert.ok(removed.some((l) => l.includes('"layout-000002"')) && removed.some((l) => l.includes('"offset"')), 'the second record and the offsets went');
	const at = (lines, needle) => lines.findIndex((l) => l.includes(needle));
	assert.deepEqual(a.slice(at(a, '"nodes"')), b.slice(at(b, '"nodes"')), 'every line from the entities on, the log included, as it was');
	assert.deepEqual(a.slice(0, at(a, '"schema"')), b.slice(0, at(b, '"schema"')), 'and every line before the schema');
});

test('H26.6 move 14: a file the migration cannot make exactly is refused, naming why -- not schema 3, other layouts, not as the store writes it', () => {
	const ok = schema3('00000000000e4002');
	const refusal = (text) => migrateText(text).error ?? '';
	assert.match(refusal(serialize({ ...ok, meta: { ...ok.meta, schema: 4 }, layouts: ONE }, LOG)), /meta\.schema is 4, not 3/, 'already schema 4: not migrated twice');
	assert.match(refusal(serialize({ ...ok, meta: { ...ok.meta, schema: 2 } }, LOG)), /meta\.schema is 2/, 'schema 2');
	assert.match(refusal(serialize({ ...ok, layouts: [{ ...SCHEMA_3_LAYOUTS[0], pitch: 80 }, SCHEMA_3_LAYOUTS[1]] }, LOG)), /not schema 3's two at the table's values/, 'a pitch other than the table\'s');
	assert.match(refusal(serialize({ ...ok, layouts: [SCHEMA_3_LAYOUTS[0]] }, LOG)), /not schema 3's two/, 'one layout of the two');
	assert.match(refusal(JSON.stringify(ok)), /not byte for byte what the store writes/, 'compact JSON: no byte could be kept as it was');
	assert.match(refusal(`${serialize(ok, LOG)}\n`), /not byte for byte what the store writes/, 'a trailing line more');
	assert.match(refusal('{ "meta": '), /not JSON/, 'a broken file');
	assert.match(refusal(serialize({ nodes: [] }, null)), /no meta/, 'no meta');
	assert.equal(migrateText(serialize(ok, null)).ok, true, 'a document without a log -- a template -- is migrated (the control)');
});

test('H26.6 move 14: migrate and verify on a folder as the freeze runs them -- documents migrated, other files named and left, verify PASS through the store', () => {
	const dir = scratchFolder('draw-schema4-tool-'), from = path.join(dir, 'backup'), to = path.join(dir, 'migrated');
	fs.mkdirSync(from);
	fs.writeFileSync(path.join(from, '00000000000e4003.json'), serialize(schema3('00000000000e4003'), LOG));
	fs.writeFileSync(path.join(from, '00000000000e4004.json'), serialize(schema3('00000000000e4004', { nodes: [] }), null));
	fs.writeFileSync(path.join(from, 'template-0e4005.json'), serialize({ ...schema3('template-0e4005'), meta: { id: 'template-0e4005', name: 't', version: 0, schema: 3 } }, null));
	fs.writeFileSync(path.join(from, 'access.json'), `${JSON.stringify({ 'user:someone@example.com': { 'user:other@example.com': 'read' } }, null, '\t')}\n`);
	fs.writeFileSync(path.join(from, 'codes.json'), `${JSON.stringify({ agents: {}, codes: {} }, null, '\t')}\n`);
	const m = run('migrate', from, to);
	assert.equal(m.status, 0, m.stdout + m.stderr);
	assert.match(m.stdout, /migrate: 3 document\(s\) migrated/);
	assert.match(m.stdout, /left as it is \(not a document\): access\.json/);
	assert.deepEqual(fs.readdirSync(to).sort(), ['00000000000e4003.json', '00000000000e4004.json', 'template-0e4005.json'], 'the documents alone written');
	const v = run('verify', from, to);
	assert.equal(v.status, 0, v.stdout + v.stderr);
	assert.match(v.stdout, /verify: PASS -- 3 document\(s\), 2 diagram\(s\) and 1 template\(s\) through this tree's store/);
	assert.equal(run('migrate', from, to).status, 1, 'a second run into the same folder is refused -- it must be new');
	// a migrated file with one more byte moved: verify fails, naming it
	const file = path.join(to, '00000000000e4003.json');
	fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('"name": "b"', '"name": "B"'));
	const bad = run('verify', from, to);
	assert.equal(bad.status, 1);
	assert.match(bad.stdout, /00000000000e4003\.json: more changed than its layouts and its schema/);
	assert.match(bad.stdout, /verify: FAIL/);
	// a migrated file left at schema 3: the store refuses it, and verify says so
	fs.writeFileSync(file, fs.readFileSync(path.join(from, '00000000000e4003.json')));
	const old = run('verify', from, to);
	assert.equal(old.status, 1);
	assert.match(old.stdout, /the store said: .*00000000000e4003\.json.*written in schema 3/);
	fs.rmSync(dir, { recursive: true, force: true });
});

test('H26.6 move 14: a folder holding one file the migration refuses is refused whole -- nothing written', () => {
	const dir = scratchFolder('draw-schema4-refused-'), from = path.join(dir, 'backup'), to = path.join(dir, 'migrated');
	fs.mkdirSync(from);
	fs.writeFileSync(path.join(from, '00000000000e4006.json'), serialize(schema3('00000000000e4006'), LOG));
	fs.writeFileSync(path.join(from, '00000000000e4007.json'), JSON.stringify(schema3('00000000000e4007')));
	const m = run('migrate', from, to);
	assert.equal(m.status, 1);
	assert.match(m.stdout, /00000000000e4007\.json: it is not byte for byte what the store writes/);
	assert.match(m.stdout, /REFUSED -- 1 of 2 document\(s\); nothing written/);
	assert.equal(fs.existsSync(to), false, 'no folder made');
	fs.rmSync(dir, { recursive: true, force: true });
});

test('GR13 (H26.6 move 14): the tree\'s four templates are schema 4, each exactly what the migration makes of its schema 3 self', () => {
	const dir = path.join(ROOT, 'templates'), files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
	assert.equal(files.length, 4, 'control: the four templates');
	const oneBlock = `\t"layouts": ${JSON.stringify(ONE, null, '\t').split('\n').join('\n\t')}`, twoBlock = `\t"layouts": ${JSON.stringify(SCHEMA_3_LAYOUTS, null, '\t').split('\n').join('\n\t')}`;
	for (const f of files) {
		const now = fs.readFileSync(path.join(dir, f), 'utf8');
		const doc = JSON.parse(now);
		assert.deepEqual([doc.meta.schema, doc.layouts], [4, ONE], `${f}: schema 4, the one record`);
		assert.equal(now.split(oneBlock).length, 2, `${f}: the one record written once, as the store writes it`);
		const before = now.replace(oneBlock, () => twoBlock).replace('\t\t"schema": 4', '\t\t"schema": 3');
		const r = migrateText(before);
		assert.equal(r.ok, true, `${f}: ${r.error}`);
		assert.equal(r.text, now, `${f}: migrated from its schema 3 self, byte for byte itself`);
	}
});
