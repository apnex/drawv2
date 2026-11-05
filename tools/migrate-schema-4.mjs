#!/usr/bin/env node
/*
H26.6's move 14 (dev/design/components/PAN-ZOOM.md section 3.4, "The migration, once"; PZ14; GR13; appendix A's second and third move 14
rows) -- THE MIGRATION, SCHEMA 3 TO 4, run once on production's documents in a freeze, as WD9 ran schema 3's (deploy/DEPLOY.md,
"WD-b1 executed"; the move 14 runbook beside it).

Each document's two layouts, which every readable document holds at the table's values, become the one grid record,
`{ id: 'layout-000001', name: 'grid', pitch: 60 }`, and `meta.schema` 3 becomes 4; no other byte of the file changes (GR13). A file is
written as the store writes it (server/docfile.mjs `serialize`: the document tab-indented, its log compact, a closing newline), so the
migrated file is the original re-serialized with those two values replaced -- and that is checked against a second construction made
from the original's text alone, its layouts block and meta block replaced and nothing else, so the serializer is not trusted to say
what it changed. A file that is not schema 3, holds other layouts, or is not byte for byte what the store would write is refused,
naming why, and nothing is written for it.

Not in the image (the Dockerfile copies no tools/), so the deployed version reads schema 4 alone and carries no migration (WD9). It is
in the tree because the move's own function migrates the pinned production copies, read-only at schema 3, in memory wherever a probe
loads them into a schema 4 tree (tools/probe/parity.mjs), and tests/migrate-schema-4.test.js holds it.

  node tools/migrate-schema-4.mjs migrate <from-dir> <to-dir>
      every document file in <from-dir> -- a diagram (<16 hex>.json) or a template (template-<6 hex>.json) -- migrated into <to-dir>,
      which must be empty or absent; any other file (access.json, codes.json) is named and left where it is
  node tools/migrate-schema-4.mjs verify <from-dir> <to-dir>
      each migrated file checked against the original (the two values alone changed, by the second construction), then every one
      loaded through this tree's store -- run it from a worktree of the commit being deployed -- over a scratch copy, diagrams as its
      data, templates as its templates, the other files beside them: each loaded clean, no file skipped, no invariant reported,
      nothing marked to be written back, and the store's own serialization of each byte for byte the migrated file; PASS or FAIL,
      exit 0 or 1
*/
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { pathToFileURL } from 'node:url';
import { serialize, parse } from '../server/docfile.mjs';

// schema 3's two records, exactly as the layouts table held them (WD7 held every diagram to them)
export const SCHEMA_3_LAYOUTS = [
	{ id: 'layout-000001', name: 'node', pitch: 60, offset: 0, ext: { x: 900, y: 480 } },
	{ id: 'layout-000002', name: 'zone', pitch: 60, offset: 30, ext: { x: 930, y: 510 } },
];
const SCHEMA_4_LAYOUTS = [{ id: 'layout-000001', name: 'grid', pitch: 60 }];
const DIAGRAM_FILE = /^[0-9a-f]{16}\.json$/, TEMPLATE_FILE = /^template-[0-9a-f]{6}\.json$/;
const isDocumentFile = (f) => DIAGRAM_FILE.test(f) || TEMPLATE_FILE.test(f);

// a value at depth 1 of a tab-indented object: its own lines after the first indented one tab further
const atDepth1 = (value) => JSON.stringify(value, null, '\t').split('\n').join('\n\t');
const once = (text, needle) => text.split(needle).length - 1;

/*
The second construction (GR13): the original text with its `"layouts": [...]` member and its `"meta": {...}` member replaced, each found
exactly once as the store writes them, and nothing else touched. The migration's output must equal it.
*/
function expectedText(text, doc) {
	const oldLayouts = `\t"layouts": ${atDepth1(doc.layouts)}`, newLayouts = `\t"layouts": ${atDepth1(SCHEMA_4_LAYOUTS)}`;
	const oldMeta = `\t"meta": ${atDepth1(doc.meta)}`, newMeta = `\t"meta": ${atDepth1({ ...doc.meta, schema: 4 })}`;
	if (once(text, oldLayouts) !== 1) return { ok: false, error: 'its layouts are not written once as the store writes them' };
	if (once(text, oldMeta) !== 1) return { ok: false, error: 'its meta is not written once as the store writes it' };
	return { ok: true, text: text.replace(oldLayouts, () => newLayouts).replace(oldMeta, () => newMeta) };
}

// one file's text, migrated -- or refused, naming why
export function migrateText(text) {
	let doc, log;
	try { ({ doc, log } = parse(text)); } catch (e) { return { ok: false, error: `not JSON: ${e.message}` }; }
	if (!doc?.meta || typeof doc.meta !== 'object') return { ok: false, error: 'no meta -- not a document' };
	if (doc.meta.schema !== 3) return { ok: false, error: `meta.schema is ${JSON.stringify(doc.meta.schema)}, not 3` };
	if (!isDeepStrictEqual(doc.layouts, SCHEMA_3_LAYOUTS)) return { ok: false, error: `its layouts are not schema 3's two at the table's values: ${JSON.stringify(doc.layouts)}` };
	if (serialize(doc, log) !== text) return { ok: false, error: 'it is not byte for byte what the store writes, so no byte could be kept as it is' };
	const migrated = { ...doc, meta: { ...doc.meta, schema: 4 }, layouts: structuredClone(SCHEMA_4_LAYOUTS) };   // each key where it was
	const out = serialize(migrated, log);
	const expected = expectedText(text, doc);
	if (!expected.ok) return expected;
	if (expected.text !== out) return { ok: false, error: 'the migrated file differs from the original in more than its layouts and its schema' };
	return { ok: true, text: out };
}

const documentFiles = (dir) => fs.readdirSync(dir).filter(isDocumentFile).sort();

function migrateDir(from, to) {
	if (fs.existsSync(to) && fs.readdirSync(to).length) throw new Error(`${to} is not empty -- migrate into a new folder`);
	const files = documentFiles(from), others = fs.readdirSync(from).filter((f) => !isDocumentFile(f)).sort();
	const refused = [];
	const out = files.map((f) => [f, migrateText(fs.readFileSync(path.join(from, f), 'utf8'))]);
	for (const [f, r] of out) if (!r.ok) refused.push(`${f}: ${r.error}`);
	if (refused.length) return { ok: false, files: files.length, refused, others };   // nothing written: the run is all or none
	fs.mkdirSync(to, { recursive: true });
	for (const [f, r] of out) fs.writeFileSync(path.join(to, f), r.text);
	return { ok: true, files: files.length, refused, others };
}

/*
Verify: the migrated folder against the original, then through the store of the tree to be deployed. The store is booted over a scratch
copy, never the folder itself, and with a flush interval no run reaches, so nothing it holds is written; that it would write nothing is
read from it -- no entry dirty -- and its own serialization of each document, which a flush would write, is compared with the file.
*/
async function verifyDir(from, to) {
	const problems = [];
	const files = documentFiles(from), migrated = documentFiles(to);
	if (!isDeepStrictEqual(files, migrated)) problems.push(`the folders hold different documents: ${files.length} before, ${migrated.length} after`);
	let entities = 0;
	for (const f of files.filter((x) => migrated.includes(x))) {
		const before = fs.readFileSync(path.join(from, f), 'utf8'), after = fs.readFileSync(path.join(to, f), 'utf8');
		const { doc } = parse(before);
		const expected = expectedText(before, doc);
		if (!expected.ok) problems.push(`${f}: ${expected.error}`);
		else if (expected.text !== after) problems.push(`${f}: more changed than its layouts and its schema`);
		const a = parse(after).doc;
		if (a.meta?.schema !== 4 || !isDeepStrictEqual(a.layouts, SCHEMA_4_LAYOUTS)) problems.push(`${f}: not schema 4 with the one grid record`);
		for (const [k, v] of Object.entries(a)) if (Array.isArray(v) && k !== 'layouts' && k !== 'selection') entities += v.length;
	}
	// through the store: diagrams as its data, templates as its templates, the other files of the original beside the diagrams
	const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-schema-4-verify-'));
	const data = path.join(scratch, 'data'), templates = path.join(scratch, 'templates');
	fs.mkdirSync(data); fs.mkdirSync(templates);
	const diagrams = migrated.filter((f) => DIAGRAM_FILE.test(f)), shipped = migrated.filter((f) => TEMPLATE_FILE.test(f));
	for (const f of diagrams) fs.copyFileSync(path.join(to, f), path.join(data, f));
	for (const f of shipped) fs.copyFileSync(path.join(to, f), path.join(templates, f));
	for (const f of fs.readdirSync(from).filter((x) => !isDocumentFile(x) && fs.statSync(path.join(from, x)).isFile())) fs.copyFileSync(path.join(from, f), path.join(data, f));
	const said = [];
	const { warn, error } = console;
	console.warn = (...a) => said.push(a.join(' ')); console.error = (...a) => said.push(a.join(' '));
	let store;
	try {
		const { Store } = await import('../server/store.js');   // this tree's store: run the tool from the tree being deployed
		store = new Store(data, { flushMs: 3_600_000, templatesDir: shipped.length ? templates : null });
		await store.init();
		if (store.diagrams.size !== diagrams.length) problems.push(`the store loaded ${store.diagrams.size} of ${diagrams.length} diagram(s)`);
		if (store.templates.size !== shipped.length) problems.push(`the store loaded ${store.templates.size} of ${shipped.length} template(s)`);
		for (const [id, entry] of store.diagrams) {
			if (entry.dirty) problems.push(`${id}.json: the store would write it back at boot`);
			if (entry.invariantFailures) problems.push(`${id}.json: loaded with ${entry.invariantFailures} invariant violation(s)`);
			// a file written with no log (none the store flushed) is compared as its document alone, the half the store read from it
			const text = fs.readFileSync(path.join(to, entry.file), 'utf8'), logged = parse(text).log !== null;
			if (serialize(entry.model.toJSON(), logged ? entry.log : null) !== text) problems.push(`${id}.json: the store's own serialization differs from the migrated file`);
		}
		for (const f of diagrams) if (fs.readFileSync(path.join(data, f), 'utf8') !== fs.readFileSync(path.join(to, f), 'utf8')) problems.push(`${f}: the store's boot rewrote it`);
	} catch (e) {
		problems.push(`the store refused to boot: ${e.message}`);
	} finally {
		console.warn = warn; console.error = error;
		for (const entry of store?.diagrams?.values() ?? []) if (entry.timer) clearTimeout(entry.timer);
		fs.rmSync(scratch, { recursive: true, force: true });
	}
	for (const line of said) problems.push(`the store said: ${line}`);
	return { ok: problems.length === 0, files: files.length, diagrams: diagrams.length, templates: shipped.length, entities, problems };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	const [verb, from, to] = process.argv.slice(2);
	if (!['migrate', 'verify'].includes(verb) || !from || !to) {
		console.error('usage: node tools/migrate-schema-4.mjs migrate <from-dir> <to-dir> | verify <from-dir> <to-dir>');
		process.exit(2);
	}
	if (verb === 'migrate') {
		const r = migrateDir(from, to);
		for (const f of r.others) console.log(`  left as it is (not a document): ${f}`);
		for (const why of r.refused) console.log(`  \u2717 ${why}`);
		console.log(r.ok ? `migrate: ${r.files} document(s) migrated into ${to}` : `migrate: REFUSED -- ${r.refused.length} of ${r.files} document(s); nothing written`);
		process.exit(r.ok ? 0 : 1);
	}
	const r = await verifyDir(from, to);
	for (const p of r.problems) console.log(`  \u2717 ${p}`);
	console.log(`verify: ${r.ok ? 'PASS' : 'FAIL'} -- ${r.files} document(s), ${r.diagrams} diagram(s) and ${r.templates} template(s) through this tree's store, ${r.entities} entities otherwise equal`);
	process.exit(r.ok ? 0 : 1);
}
