#!/usr/bin/env node
/*
import-map -- H26.1 (dev/design/components/SNAP-GRID.md section 7.6; H26-2). A page's import map is what draw installs, written into
the pages, never typed there.

Draw's own code is served as written, and the components it composes arrive built, each from its own repository's release: Node
finds an installed package by name, and a page maps the name to a file through an import map. This reads draw's @apnex/ dependencies
and each installed package's exports and version (tools/components.mjs), and writes ONE `<script type="importmap">` into each page
the manifest declares (tools/layers.mjs `PAGES`), between its BEGIN and END GENERATED markers (tools/page-regions.mjs), as the
stylesheet and canvas generators write theirs; `--check` fails when a page holds anything else. One entry per export, at
/vendor/<name>@<version>/<file> -- never a trailing-slash prefix, which would map `@apnex/snap-grid/conformance` to a URL with no
`.js` -- served by the vendor mount both servers share (server/static.mjs sendVendored).

It refuses rather than guesses: an exports form it does not support (a condition other than `types` and `default`, a pattern, a
target outside dist/), a vendored file importing a package the map does not name, and a page whose map is not in its <head> before
every module script and every modulepreload, or is not its only import map. scan-layers' L6 admits this one inline script, inside
this region, and refuses every other; this holds what it says.

Usage: node tools/import-map.mjs --check | --write [--root <dir>]
  --root  the tree whose pages, package.json and node_modules are read (a test's copy); the default is this repository
*/
import fs from 'node:fs';
import path from 'node:path';
import { PAGES } from './layers.mjs';
import { importMapOf } from './components.mjs';
import { withRegion } from './regions.mjs';
import { htmlSpans } from './markup.mjs';   // where a page's comments are, so a tag inside one is not read as a tag
import { importMapRegion } from './page-regions.mjs';   // the region, declared once for this and the copy measure

const argOf = (flag) => { const i = process.argv.indexOf(flag); return i > -1 ? process.argv[i + 1] : null; };
const ROOT = argOf('--root') ? path.resolve(argOf('--root')) : path.resolve(import.meta.dirname, '..');
const mode = process.argv[2];
if (mode !== '--check' && mode !== '--write') { console.error('usage: node tools/import-map.mjs --check | --write [--root <dir>]'); process.exit(2); }

const { imports, components, problems } = importMapOf(ROOT);
const region = importMapRegion(imports);
// the tags a page holds outside its comments: [index, tag text]
const tagsOf = (html, re) => { const { comments } = htmlSpans(html); return [...html.matchAll(re)].filter((m) => !comments.some(([a, b]) => m.index >= a && m.index < b)); };
const MODULE = /<script\b[^>]*\btype\s*=\s*["']?module\b[^>]*>|<link\b[^>]*\brel\s*=\s*["']?modulepreload\b[^>]*>/gi;
const IMPORT_MAP = /<script\b[^>]*\btype\s*=\s*["']?importmap\b[^>]*>/gi;

if (!problems.length) {
	for (const page of Object.keys(PAGES)) {
		const file = path.join(ROOT, page), html = fs.readFileSync(file, 'utf8');
		let next;
		try { next = withRegion(html, region, page); } catch (e) { problems.push(e.message); continue; }
		if (next === null) { problems.push(`${page} has no generated import-map region -- add the BEGIN and END markers in its <head>, before its module script, each opening its line`); continue; }
		const at = html.indexOf(region.begin), stop = html.indexOf(region.end, at) + region.end.length;
		if (!(html.indexOf('<head>') >= 0 && html.indexOf('<head>') < at && stop <= html.indexOf('</head>'))) { problems.push(`${page} holds its import map outside its <head>`); continue; }
		if (tagsOf(html, MODULE).some((m) => m.index < stop)) { problems.push(`${page} holds its import map after a module script or a modulepreload -- a module fetched before the map is resolved without it`); continue; }
		if (tagsOf(html, IMPORT_MAP).some((m) => m.index < at || m.index >= stop)) { problems.push(`${page} holds an import map outside its generated region -- a page has one, written here`); continue; }
		if (next === html) continue;
		if (mode === '--write') { fs.writeFileSync(file, next); console.log(`  import-map: wrote ${page}`); }
		else problems.push(`${page} holds another import map than the installed components make -- run node tools/import-map.mjs --write`);
	}
}
if (problems.length) { for (const p of problems) console.error(`  \u2717 ${p}`); console.error(`import-map: FAIL -- ${problems.length} finding(s)`); process.exit(1); }
console.log(`import-map: PASS -- ${Object.keys(PAGES).length} page(s) load the map of ${components.length} installed component(s), ${Object.keys(imports).length} export(s), each at its installed version`);
