#!/usr/bin/env node
/*
scan-copies -- H25.0 (B365). Every kind of copied fact the tree holds, counted, and each count held to its record.

H22's measure counts the imports a part makes that the target does not allow. A fact written into two places that never import
each other passes it, and drifts: the published SVG kept its own order of layers and its own label rules, and both drifted from
the page unseen until the director looked (B361). This scanner counts those copies -- the measures are tools/copies.mjs -- over
what the manifest declares (tools/layers.mjs: the folders, the parts, the pages, `COPIES`), so a new folder, part, page or
stylesheet is measured without an edit here.

Each count may only fall (`COPIES.record`): a rise is a new copy and fails; a fall is a copy removed, and fails until the record
is lowered in the same commit. H25's later stages lower them; its exit is every count at zero or a ruled exception.

Usage: node tools/scan-copies.mjs [--verbose]
*/

import fs from 'node:fs';
import path from 'node:path';
import { FOLDERS, PARTS, PAGES, COPIES, SCANNER_ROOTS } from './layers.mjs';
import { classesPutOnElements, classesInMarkup, stylesheetsInSource, copiedStyleRules, foreignStyleRules, stylesDrawnByNoPart, copiedLines, modulesNoEntryReaches, styleRulesOf, judgeFindings, judgeExceptions } from './copies.mjs';
import { exceptionFaults } from './exceptions.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const verbose = process.argv.includes('--verbose');
const read = (rel) => { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return null; } };
const exists = (rel) => fs.existsSync(path.join(ROOT, rel)) && fs.statSync(path.join(ROOT, rel)).isFile();
const walk = (dir, ext, out = []) => {
	const abs = path.join(ROOT, dir);
	if (!fs.existsSync(abs)) return out;
	const skip = new Set(FOLDERS.find((f) => f.dir === dir)?.skip ?? []);
	for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
		const rel = `${dir}/${e.name}`;
		if (skip.has(rel) || e.name === 'node_modules') continue;
		if (e.isDirectory()) walk(rel, ext, out); else if (ext.test(e.name)) out.push(rel);
	}
	return out;
};

// the product's folders and the modules in them -- the manifest's folders, less the tools and the tests (SCANNER_ROOTS.copies)
const modules = SCANNER_ROOTS.copies.flatMap((d) => walk(d, /\.m?js$/));
const partOf = (file) => {
	for (const [name, p] of Object.entries(PARTS)) for (const m of p.modules) if (m.endsWith('/') ? file.startsWith(m) : file === m) return name;
	return COPIES.owners[file] ?? null;
};
const isPlugin = (part) => PARTS[part]?.kind === 'plugin';

// ---- the stylesheets: each a page loads, each in a product folder, and each a module exports as CSS text
const sheetFiles = new Set(SCANNER_ROOTS.copies.flatMap((d) => walk(d, /\.css$/)));
for (const [page, { base }] of Object.entries(PAGES)) {
	for (const m of (read(page) ?? '').matchAll(/<link rel="stylesheet" href="([^"]+)"/g)) {
		// its own folder first, then the root, then another page's folder -- the lab serves the product page's sheets (lab/server.mjs)
		const bases = [base, '', ...Object.values(PAGES).map((p) => p.base).filter((b) => b !== base)];
		const found = bases.map((b) => (b ? `${b}${m[1]}` : m[1].replace(/^\//, ''))).find(exists);
		if (!found) throw new Error(`${page} loads ${m[1]}, and no file answers it under any page's folder or the root -- the scan would miss a stylesheet`);
		sheetFiles.add(found);
	}
}
const sheets = [...sheetFiles].sort().map((f) => ({ name: f, owner: partOf(f), css: read(f) }));
for (const f of modules.sort()) for (const t of stylesheetsInSource(read(f))) sheets.push({ name: `${f} ${t.name}`, owner: partOf(f), css: t.css });
const ownerless = sheets.filter((s) => !s.owner).map((s) => s.name);
if (ownerless.length) {
	console.log(`  \u2717 ${ownerless.join(', ')}: a stylesheet no part owns -- name its owner in tools/layers.mjs COPIES.owners`);
	process.exit(1);
}

// ---- the classes each part puts on elements
const drawnBy = new Map();
for (const f of modules) {
	const part = partOf(f);
	if (!part) continue;
	for (const c of classesPutOnElements(read(f))) { if (!drawnBy.has(c)) drawnBy.set(c, new Set()); drawnBy.get(c).add(part); }
}
// and the classes each page's markup writes, credited to the part the page composes for (its entry's root module's part)
for (const [page, { base, scripts }] of Object.entries(PAGES)) {
	const part = partOf(`${base}${scripts[0]}`);
	for (const c of classesInMarkup(read(page) ?? '')) { if (!drawnBy.has(c)) drawnBy.set(c, new Set()); drawnBy.get(c).add(part); }
}
if (!sheets.some((s) => styleRulesOf(s.css).length) || drawnBy.size === 0) {
	console.log('  \u2717 no stylesheet rule or no drawn class was found at all -- the scan is broken, not the tree clean');
	process.exit(1);
}

// ---- the ids a page writes in its markup, and every string a product module quotes -- an id styled and found in neither is dead
const idsWritten = new Set([
	...Object.keys(PAGES).flatMap((p) => [...(read(p) ?? '').matchAll(/\bid="([^"]+)"/g)].map((m) => m[1])),
	...modules.flatMap((f) => [...(read(f) ?? '').matchAll(/(['"`])([a-zA-Z][\w-]*)\1/g)].map((m) => m[2])),
]);

// ---- the five measures
const pagesAndSheets = [...Object.keys(PAGES), ...sheetFiles].sort().map((f) => ({ name: f, text: read(f) }));
const resolve = (from, spec) => {
	const to = spec.startsWith('/') ? spec.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
	return /\.m?js$/.test(to) && exists(to) ? to : null;
};
/*
EACH FINDING IS NAMED BY THE FACT COPIED, not by where it sits: a copied rule by its selector and property, a foreign rule by its
selector, a styled name by itself, a copied line by its pages and text, a module by its path. So moving a rule from one sheet to
another renames nothing -- H25.1 moved the page's plugin rules into the plugins' sheets, and named by sheet each would have read as
one copy removed and another added. Where each sits, and why, is the detail --verbose prints.
*/
const detail = {
	'copied style rules': copiedStyleRules(sheets).map((x) => [x.rule, `${x.rule}  in ${x.in.join(' and ')}`]),
	'foreign style rules': foreignStyleRules(sheets, drawnBy, isPlugin).map((x) => [x.selector, `${x.sheet}: ${x.selector}  -- ${x.classes.join(', ')}`]),
	'styled names nothing draws': stylesDrawnByNoPart(sheets, drawnBy, idsWritten).map((x) => [x.name, `${x.name} in ${x.in.join(', ')}`]),
	'copied lines': copiedLines(pagesAndSheets).flatMap((x) => x.lines.map((l) => [`${x.files[0]} and ${x.files[1]}: ${l}`, `${x.files[0]} and ${x.files[1]}: ${l}`])),
	'modules no entry reaches': modulesNoEntryReaches(COPIES.entries, modules, read, resolve).map((m) => [m, m]),
};
const findings = Object.fromEntries(Object.entries(detail).map(([k, v]) => [k, v.map(([key]) => key)]));
for (const k of Object.keys(findings)) findings[k] = [...new Set(findings[k])].sort();

if (verbose) {
	for (const [k, v] of Object.entries(findings)) {
		console.log(`\n  ${k}: ${v.length}`);
		for (const [key, said] of [...new Map(detail[k])].sort()) console.log(`    ${said}${COPIES.exceptions[k]?.[key] ? '   [ruled exception]' : ''}`);
	}
	// the foreign rules by the plugin whose class each styles -- a rule styling two plugins' classes counts for each (H25.0 review, finding 6)
	const byPlugin = new Map();
	for (const x of foreignStyleRules(sheets, drawnBy, isPlugin)) for (const p of new Set(x.classes.flatMap((c) => c.replace(/^.*\((.*)\)$/, '$1').split(', ')).filter(isPlugin))) {
		const k = `${x.sheet} -> ${p}`; byPlugin.set(k, (byPlugin.get(k) ?? 0) + 1);
	}
	console.log('\n  foreign style rules by sheet and plugin:');
	for (const [k, n] of [...byPlugin].sort()) console.log(`    ${String(n).padStart(3)}  ${k}`);
	console.log('');
}

// the record (the copies today), the ceiling (the copies when H25 opened, frozen; its hash is pinned in tests/scan-copies.test.js)
const RECORD = 'tools/copies-record.json', CEILING = 'tools/copies-ceiling.json';
const record = JSON.parse(read(RECORD) ?? '{}'), ceiling = JSON.parse(read(CEILING) ?? '{}');
const summary = Object.entries(findings).map(([k, v]) => `${k} ${v.length}`).join(', ');
console.log(`  scan-copies: ${sheets.length} stylesheet(s), ${modules.length} module(s), ${drawnBy.size} drawn class(es); ${summary}`);

// --write lowers the record to what is measured, and only lowers it: a new copy is never written in
if (process.argv.includes('--write')) {
	const fresh = Object.entries(findings).flatMap(([k, v]) => v.filter((f) => !(record[k] ?? []).includes(f)).map((f) => `${k}: ${f}`));
	if (fresh.length) {
		for (const f of fresh) console.log(`  \u2717 NEW COPY -- ${f}`);
		console.log(`\n  FAIL -- --write lowers the record and never raises it; remove the new copies first\n`);
		process.exit(1);
	}
	fs.writeFileSync(path.join(ROOT, RECORD), `${JSON.stringify(findings, null, '\t')}\n`);
	console.log(`  wrote ${RECORD}`);
}

// a ruled exception: a copy the director let stand, citing the ruling and saying when it ends -- and a copy that still exists
const ruled = judgeExceptions(findings, COPIES.exceptions);
const verdicts = [
	...judgeFindings(findings, process.argv.includes('--write') ? findings : record, ceiling),
	...ruled.faults,
	...exceptionFaults(ruled.entries, ROOT),
];
if (verdicts.length) {
	for (const v of verdicts) console.log(`  \u2717 ${v}`);
	console.log(`\n  FAIL -- ${verdicts.length} finding(s) off the record (${RECORD}, inside ${CEILING}). Run with --verbose for every copy.\n`);
	process.exit(1);
}
const standing = Object.values(COPIES.exceptions).reduce((n, x) => n + Object.keys(x).length, 0);
console.log(`  PASS -- every copy is on the record and none is new; ${standing} ruled exception(s)\n`);
