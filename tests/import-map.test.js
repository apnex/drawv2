/*
H26.1 (dev/design/components/SNAP-GRID.md section 7.6) -- THE PAGES' IMPORT MAP, GENERATED FROM WHAT IS INSTALLED.

Draw's own code is served as written, and the components it composes arrive built from their own repositories (H26-2): Node finds
an installed package by name, and a page maps the name to a file through an import map. tools/import-map.mjs writes that map into
each page the manifest declares, between generated markers, from draw's @apnex/ dependencies and each installed package's exports
and version -- one entry per export, never a trailing-slash prefix -- and the gate runs it with --check, as it runs the stylesheet
and canvas generators. It refuses rather than guesses: an exports form it does not support, and a vendored file importing a package
the map does not name. Each refusal is planted in a copy of the pages and the installed package, beside a control that passes.
*/
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PAGES, COPIES } from '../tools/layers.mjs';
import { markersOf } from '../tools/regions.mjs';
import { PAGE_REGIONS, importMapRegion } from '../tools/page-regions.mjs';
import { importMapOf } from '../tools/components.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const TOOL = path.join(ROOT, 'tools/import-map.mjs');
const run = (root, mode = '--check') => spawnSync(process.execPath, [TOOL, mode, ...(root ? ['--root', root] : [])], { encoding: 'utf8' });
const read = (root, f) => fs.readFileSync(path.join(root, f), 'utf8');
const installed = JSON.parse(read(ROOT, 'node_modules/@apnex/snap-grid/package.json'));
const binding = JSON.parse(read(ROOT, 'node_modules/@apnex/input-binding/package.json'));   // H26.2: the second component draw installs
const capture = JSON.parse(read(ROOT, 'node_modules/@apnex/input-capture/package.json'));   // H26.3: and the third

// a copy of what the generator reads: the declared pages, package.json, and the installed components -- each case edits its own
const made = [];
after(() => { for (const d of made) fs.rmSync(d, { recursive: true, force: true }); });
function tree(edit = () => {}) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-import-map-'));
	made.push(dir);
	for (const f of ['package.json', ...Object.keys(PAGES)]) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.copyFileSync(path.join(ROOT, f), path.join(dir, f)); }
	fs.cpSync(path.join(ROOT, 'node_modules/@apnex'), path.join(dir, 'node_modules/@apnex'), { recursive: true });
	edit({
		dir,
		page: (f, change) => { const before = read(dir, f), after = change(before); assert.notEqual(after, before, `the edit to ${f} did not land`); fs.writeFileSync(path.join(dir, f), after); },
		manifest: (change) => { const p = path.join(dir, 'node_modules/@apnex/snap-grid/package.json'); const pkg = JSON.parse(fs.readFileSync(p, 'utf8')); change(pkg); fs.writeFileSync(p, JSON.stringify(pkg)); },
		dist: (f, change) => { const p = path.join(dir, 'node_modules/@apnex/snap-grid/dist', f); fs.writeFileSync(p, change(fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '')); },
	});
	return dir;
}
const refused = (dir, ...needles) => {
	const r = run(dir);
	assert.equal(r.status, 1, `the generator must refuse this tree:\n${r.stdout}${r.stderr}`);
	for (const n of needles) assert.match(r.stdout + r.stderr, n);
	return r.stdout + r.stderr;
};
const region = PAGE_REGIONS.importmap;

test('H26.1: each page holds the one import map the installed components make, in its <head> before any module -- the control', () => {
	const r = run(null);
	assert.equal(r.status, 0, r.stdout + r.stderr);
	const base = `/vendor/@apnex/snap-grid@${installed.version}/`;
	// RESTATED at H26.2 (dev/design/components/INPUT-BINDING.md section 7): input-binding's one export path, `.`, is one line more
	// RESTATED at H26.3 (dev/design/components/INPUT-CAPTURE.md section 7): and input-capture's one export path, `.`, one more again
	assert.deepEqual(importMapOf(ROOT).imports, { '@apnex/input-binding': `/vendor/@apnex/input-binding@${binding.version}/index.js`,
		'@apnex/input-capture': `/vendor/@apnex/input-capture@${capture.version}/index.js`,
		'@apnex/snap-grid': `${base}index.js`, '@apnex/snap-grid/conformance': `${base}conformance.js` },
		'one entry per export of each installed release, at its version -- the conformance kit a URL ending .js, never a trailing-slash prefix');
	assert.deepEqual({ begin: region.begin, end: region.end }, markersOf('importmap', COPIES.generated.importmap), 'the region the manifest names');
	for (const page of Object.keys(PAGES)) {
		const html = read(ROOT, page), at = html.indexOf(region.begin), to = html.indexOf(region.end);
		const indent = html.slice(html.lastIndexOf('\n', at) + 1, at);
		assert.equal(html.slice(at, to + region.end.length), [region.begin, ...region.lines, region.end].join(`\n${indent}`), `${page}: the region holds the generated map and nothing else`);
		assert.ok(html.indexOf('<head>') < at && to < html.indexOf('</head>'), `${page}: in its <head>`);
		assert.ok(to < html.indexOf('<script type="module"'), `${page}: before its module script`);
		assert.equal([...html.matchAll(/<script type="importmap">/g)].length, 1, `${page}: its only import map`);
		const map = JSON.parse(html.slice(html.indexOf('<script type="importmap">', at) + '<script type="importmap">'.length, html.indexOf('</script>', at)));
		assert.deepEqual(map, { imports: importMapOf(ROOT).imports }, `${page}: the map a browser parses`);
		assert.ok(Object.keys(map.imports).every((k) => !k.endsWith('/')), 'no prefix entry');
	}
	assert.equal(run(tree()).status, 0, 'a copy of the pages and the install passes too, so every refusal below is its edit alone');
});

test('H26.1: a hand-edited map is refused, naming the page, and --write restores it', () => {
	const dir = tree(({ page }) => page('app/index.html', (h) => h.replace(`snap-grid@${installed.version}/index.js`, 'snap-grid@9.9.9/index.js')));
	refused(dir, /app\/index\.html holds another import map than the installed components make -- run node tools\/import-map\.mjs --write/);
	assert.equal(run(dir, '--write').status, 0);
	assert.equal(run(dir).status, 0, 'written from what is installed');
	assert.equal(read(dir, 'app/index.html'), read(ROOT, 'app/index.html'));
});

test('H26.1: a page with no region, one outside its <head>, or one after a module script or a modulepreload is refused', () => {
	refused(tree(({ page }) => page('lab/index.html', (h) => h.replace(region.begin, '<!-- moved -->'))), /lab\/index\.html has no generated import-map region/);
	const block = (h) => { const a = h.indexOf(region.begin), b = h.indexOf(region.end) + region.end.length; return [h.slice(0, a) + h.slice(b), h.slice(a, b)]; };
	refused(tree(({ page }) => page('app/index.html', (h) => { const [rest, r] = block(h); return rest.replace('<body>', `<body>\n\t\t${r}`); })), /app\/index\.html holds its import map outside its <head>/);
	refused(tree(({ page }) => page('app/index.html', (h) => h.replace('<title>draw</title>', '<title>draw</title>\n\t\t<script type="module" src="/src/early.js"></script>'))),
		/app\/index\.html holds its import map after a module script or a modulepreload/);
	refused(tree(({ page }) => page('lab/index.html', (h) => h.replace('<title>draw lab</title>', '<title>draw lab</title>\n\t\t<link rel="modulepreload" href="/src/root.js">'))),
		/lab\/index\.html holds its import map after a module script or a modulepreload/);
	refused(tree(({ page }) => page('lab/index.html', (h) => h.replace('</body>', '\t<script type="importmap">{ "imports": {} }</script>\n\t</body>'))),
		/lab\/index\.html holds an import map outside its generated region/);
	// a module script AFTER the region is where it belongs: the page's own (control)
	assert.equal(run(tree(({ page }) => page('app/index.html', (h) => h.replace('</head>', '\t<link rel="modulepreload" href="/src/main.js">\n\t</head>')))).status, 0, 'a modulepreload after the map is fine');
});

test('H26.1: an exports form the map does not support is refused rather than guessed -- a condition, a pattern, a target outside dist/', () => {
	const cases = [
		[(p) => { p.exports['.'] = { types: './dist/index.d.ts', import: './dist/index.js', default: './dist/index.js' }; }, /exports its root under the condition\(s\) import/],
		[(p) => { p.exports['./*'] = './dist/*.js'; }, /exports \.\/\* as a pattern/],
		[(p) => { p.exports['./conformance'] = { types: './dist/conformance.d.ts', default: './src/conformance.js' }; }, /exports \.\/conformance as \.\/src\/conformance\.js, outside dist\//],
		[(p) => { p.exports['./conformance'] = './dist/../conformance.js'; }, /outside dist\//],
		[(p) => { p.exports['./shapes/'] = './dist/'; }, /a subpath is \.\/<name>, never a folder/],
		[(p) => { p.exports['./gone'] = './dist/gone.js'; }, /exports \.\/gone as \.\/dist\/gone\.js, which it does not hold/],
		[(p) => { delete p.exports; }, /declares its exports as nothing/],
	];
	for (const [edit, needle] of cases) refused(tree(({ manifest }) => manifest(edit)), needle);
	// a plain string target, and a { types, default } pair, are what it supports (controls)
	assert.equal(run(tree(({ manifest }) => manifest((p) => { p.exports['./conformance'] = './dist/conformance.js'; }))).status, 0, 'a string target');
});

test('H26.1: a vendored file that imports a package the map does not name is refused; one importing an export the map names is not', () => {
	refused(tree(({ dist }) => dist('square.js', (s) => `import { x } from "@apnex/elsewhere";\n${s}`)),
		/@apnex\/snap-grid's dist\/square\.js imports '@apnex\/elsewhere', a package the import map does not name/);
	refused(tree(({ dist }) => dist('square.js', (s) => `import "node:fs";\n${s}`)), /imports 'node:fs' -- an address the import map does not resolve/);
	refused(tree(({ dist }) => dist('index.js', (s) => `${s}\nexport { y } from "../outside.js";\n`)), /imports '\.\.\/outside\.js', outside dist\//);
	refused(tree(({ dist }) => dist('index.js', (s) => `${s}\nconst later = () => import("left-pad");\n`)), /imports 'left-pad', a package the import map does not name/);
	assert.equal(run(tree(({ dist }) => dist('square.js', (s) => `import "@apnex/snap-grid/conformance";\n${s}`))).status, 0, 'an export the map names is resolvable (control)');
	// read from compiler output: a JSDoc example and a line comment import nothing; a multi-line import does, and an indented one
	const out = refused(tree(({ dist }) => dist('square.js', (s) => `/**\n * import { openGrid } from "@apnex/nowhere";\n */\n// import "elsewhere";\nimport {\n\tb,\n} from "./b.js";\n\texport { c } from "./c.js";\n${s}`)),
		/dist\/square\.js imports '\.\/b\.js', which dist\/ does not hold/, /dist\/square\.js imports '\.\/c\.js', which dist\/ does not hold/);
	assert.doesNotMatch(out, /nowhere|elsewhere/, 'what a comment quotes is not an import');
});

test('H26.1: a component draw depends on and has not installed is refused, by name', () => {
	refused(tree(({ dir }) => fs.rmSync(path.join(dir, 'node_modules/@apnex/snap-grid'), { recursive: true })), /@apnex\/snap-grid is a dependency and is not installed -- run npm ci/);
});

test('H26.1: the region the copy measure trusts is the one the generator writes -- one definition, from the same install', () => {
	assert.deepEqual(region, importMapRegion(importMapOf(ROOT).imports));
	assert.match(read(ROOT, 'tools/import-map.mjs'), /importMapRegion\(imports\)/, 'the generator writes the region from that definition');
	assert.equal(read(ROOT, 'tools/import-map.mjs').split('\n')[0], '#!/usr/bin/env node');
});
