#!/usr/bin/env node
/*
stylesheets -- H25.1 (B366, D1). The stylesheets a page loads are the composition's, written into the pages, never typed there.

A plugin brings its look as it brings its painters: its canvas part names its stylesheets, and product/canvas.mjs
`PAGE_STYLESHEETS` lists them in order -- the colour registry, the core's primitives, each part's sheets in the order the parts
compose, the page's own last. This writes that list into each page the manifest declares (tools/layers.mjs `PAGES`), between
its BEGIN and END GENERATED markers, and `--check` fails when a page lists anything else -- so the pages cannot drift from the
composition, nor from each other (mission-kit P3: one master, the others generated, the round trip gated). Before H25.1 each page
typed its own list, and the two differed only in their comments.

Usage: node tools/stylesheets.mjs --check | --write
*/
import fs from 'node:fs';
import path from 'node:path';
import { PAGES } from './layers.mjs';
import { PAGE_STYLESHEETS } from '../product/canvas.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const mode = process.argv[2];
if (mode !== '--check' && mode !== '--write') { console.error('usage: node tools/stylesheets.mjs --check | --write'); process.exit(2); }

// a sheet's address: a page's own folder is the root it is served from, every other folder is mounted under its name
const href = (file) => (file.startsWith('app/') ? `/${file.slice('app/'.length)}` : `/${file}`);
const BEGIN = '<!-- BEGIN GENERATED: stylesheets. Run node tools/stylesheets.mjs --write; do not edit by hand (product/canvas.mjs PAGE_STYLESHEETS). -->';
const END = '<!-- END GENERATED: stylesheets -->';

const missing = PAGE_STYLESHEETS.filter((f) => !fs.existsSync(path.join(ROOT, f)));
if (missing.length) { console.error(`  stylesheets: ${missing.join(', ')} -- named by the composition and no file`); process.exit(1); }

const problems = [];
for (const page of Object.keys(PAGES)) {
	const file = path.join(ROOT, page), html = fs.readFileSync(file, 'utf8');
	const at = html.indexOf(BEGIN), end = html.indexOf(END);
	if (at < 0 || end < at) { problems.push(`${page} has no generated stylesheet region -- add the BEGIN and END markers where its sheets load`); continue; }
	const indent = html.slice(html.lastIndexOf('\n', at) + 1, at);
	const region = [BEGIN, ...PAGE_STYLESHEETS.map((f) => `<link rel="stylesheet" href="${href(f)}">`), END].join(`\n${indent}`);
	const next = html.slice(0, at) + region + html.slice(end + END.length);
	if (next === html) continue;
	if (mode === '--write') { fs.writeFileSync(file, next); console.log(`  stylesheets: wrote ${page}`); }
	else problems.push(`${page} lists other stylesheets than the composition -- run node tools/stylesheets.mjs --write`);
}
if (problems.length) { for (const p of problems) console.error(`  \u2717 ${p}`); console.error(`stylesheets: FAIL -- ${problems.length} finding(s)`); process.exit(1); }
console.log(`stylesheets: PASS -- ${Object.keys(PAGES).length} page(s) load the composition's ${PAGE_STYLESHEETS.length} stylesheets, in its order`);
