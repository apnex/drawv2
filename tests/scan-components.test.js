/*
H26.1 (dev/design/components/SNAP-GRID.md section 7.2, G3) -- DRAW'S WORDS NEVER REACH DRAW'S PAGES THROUGH A COMPONENT.

Each component's own gate fails when its source holds a word of a consumer's vocabulary. Draw's gate runs the same check, with draw's
list, over every installed component's dist/ -- code, strings, comments, its declarations and its source maps' inlined sources -- so a
release that leaks draw's words cannot reach draw's pages (tools/scan-components.mjs). The match is the component's own: a candidate is
each run whole, the run with its underscores and hyphens removed, and the run split at case changes, underscores, hyphens and digits,
each with a trailing s or es removed. Planted in a copy of the install, beside the ordinary words a component needs, which pass.
*/
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const TOOL = path.join(ROOT, 'tools/scan-components.mjs');
const run = (root) => spawnSync(process.execPath, [TOOL, ...(root ? ['--root', root] : [])], { encoding: 'utf8' });
const made = [];
after(() => { for (const d of made) fs.rmSync(d, { recursive: true, force: true }); });
function install(edit = () => {}) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-scan-components-'));
	made.push(dir);
	fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(dir, 'package.json'));
	fs.cpSync(path.join(ROOT, 'node_modules/@apnex'), path.join(dir, 'node_modules/@apnex'), { recursive: true });
	edit((f, text) => fs.appendFileSync(path.join(dir, 'node_modules/@apnex/snap-grid/dist', f), text), dir);
	return dir;
}

test('H26.1: every installed component\'s dist/ holds no word of draw\'s -- the real install passes, and a copy of it', () => {
	const r = run(null);
	assert.equal(r.status, 0, r.stdout + r.stderr);
	const files = fs.readdirSync(path.join(ROOT, 'node_modules/@apnex/snap-grid/dist')).length;
	assert.match(r.stdout, new RegExp(`scan-components: PASS -- 1 component\\(s\\), ${files} file\\(s\\)`), 'every file of dist/ read, the maps and declarations among them');
	assert.equal(run(install()).status, 0, 'a copy of the install passes too, so each finding below is its plant alone');
});

test('H26.1: a planted word is found in code, a string, a comment, a declaration and a source map -- whole, split, joined or plural', () => {
	const lines = [
		'const nodeCount = 1;',              // a case change
		'const ZONE_EXT = 2;',               // an underscore
		'const label = "waypoints";',        // a string, plural
		'// a junction-free comment',        // a hyphen, in a comment
		'/* Diagrams drawn */',              // a capital, plural, in a block comment
		'const zone2 = 3;',                  // a digit
		'const drawV2 = 4;',                 // a run, whole
		'const draw_v2 = 5;',                // a run joined: its underscore removed
		'class Spawner {}',                  // a capital
		'const parseURLLink = 6;',           // a run of capitals before a capitalised word
		'const groupRoute = drawMouseKey(bend, zonegrid);',   // ordinary words, and a lower-case run no split can see (controls)
	];
	const dir = install((put) => {
		put('square.js', `\n${lines.join('\n')}\n`);
		put('index.d.ts', '\nexport type AnchorPoint = { x: number };\n');
	});
	const map = path.join(dir, 'node_modules/@apnex/snap-grid/dist/index.js.map');
	fs.writeFileSync(map, JSON.stringify({ version: 3, sources: ['../src/index.ts'], sourcesContent: ['// the transit of a point\n'], mappings: '' }));
	const r = run(dir);
	assert.equal(r.status, 1, r.stdout);
	const found = [...r.stdout.matchAll(/^ {2}(\S+):\d+ {2}"([^"]+)" \(draw: (\w+)\)$/gm)].map((m) => `${path.basename(m[1])} ${m[2]} ${m[3]}`);
	for (const want of ['square.js node node', 'square.js zone zone', 'square.js waypoints waypoint', 'square.js junction junction', 'square.js diagrams diagram',
		'square.js zone zone', 'square.js drawv2 drawv2', 'square.js spawner spawner', 'square.js link link', 'index.d.ts anchor anchor', 'index.js.map transit transit']) {
		assert.ok(found.includes(want), `"${want}" was not found:\n${r.stdout}`);
	}
	assert.equal(found.filter((f) => f === 'square.js zone zone').length, 2, 'ZONE_EXT and zone2, each on its own line');
	assert.equal(found.filter((f) => f === 'square.js drawv2 drawv2').length, 2, 'drawV2 whole, and draw_v2 joined');
	for (const ordinary of ['group', 'route', 'draw', 'mouse', 'key', 'bend', 'zonegrid']) assert.ok(!found.some((f) => f.split(' ')[1] === ordinary), `${ordinary} is no word of draw's`);
	assert.match(r.stdout, /scan-components: FAIL -- \d+ word\(s\) of draw's vocabulary/);
});

test('H26.1: a component draw depends on with nothing installed to read is refused, not passed', () => {
	assert.match(run(install((put, dir) => fs.rmSync(path.join(dir, 'node_modules/@apnex/snap-grid/dist'), { recursive: true }))).stdout + '', /@apnex\/snap-grid has no dist\/ to read -- run npm ci/);
	assert.equal(run(install((put, dir) => fs.rmSync(path.join(dir, 'node_modules/@apnex/snap-grid'), { recursive: true }))).status, 1);
});
