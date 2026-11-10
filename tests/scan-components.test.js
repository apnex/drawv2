/*
H26.1 (dev/design/components/SNAP-GRID.md section 7.2, G3) -- DRAW'S WORDS NEVER REACH DRAW'S PAGES THROUGH A COMPONENT.

Each component's own gate fails when its source holds a word of a consumer's vocabulary. Draw's gate runs the same check, with draw's
list, over every installed component's dist/ -- code, strings, comments, its declarations and its source maps' inlined sources -- so a
release that leaks draw's words cannot reach draw's pages (tools/scan-components.mjs). The match is the component's own: a candidate is
each run whole, the run with its underscores and hyphens removed, and the run split at case changes, underscores, hyphens and digits,
each with a trailing s or es removed. Planted in a copy of the install, beside the ordinary words a component needs, which pass.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { scratchFolder } from '@apnex/clean-runner';   // H26-19 as amended: removed when this file ends, however it ends

const ROOT = path.resolve(import.meta.dirname, '..');
const TOOL = path.join(ROOT, 'tools/scan-components.mjs');
const run = (root) => spawnSync(process.execPath, [TOOL, ...(root ? ['--root', root] : [])], { encoding: 'utf8' });
// each finding as `<file> <word> <draw's word>`: a source map's finding names where in the map it is (`#/sourcesContent/0`), dropped here
// RESTATED at H26.1's verification (F1): a map is read as JSON, so its findings carry the field they were read from
const FINDING = /^ {2}(\S+):(\d+) {2}"([^"]+)" \(draw: (\w+)\)$/gm;
const foundIn = (stdout) => [...stdout.matchAll(FINDING)].map((m) => `${path.basename(m[1].replace(/#.*$/, ''))} ${m[3]} ${m[4]}`);
function install(edit = () => {}) {
	const dir = scratchFolder('draw-scan-components-');
	fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(dir, 'package.json'));
	fs.cpSync(path.join(ROOT, 'node_modules/@apnex'), path.join(dir, 'node_modules/@apnex'), { recursive: true });
	edit((f, text) => fs.appendFileSync(path.join(dir, 'node_modules/@apnex/snap-grid/dist', f), text), dir);
	return dir;
}

test('H26.1: every installed component\'s dist/ holds no word of draw\'s -- the real install passes, and a copy of it', () => {
	const r = run(null);
	assert.equal(r.status, 0, r.stdout + r.stderr);
	// RESTATED at H26.2 (INPUT-BINDING.md section 7): the second component's dist/ is read unchanged, beside the first's
	// RESTATED at H26.3 (INPUT-CAPTURE.md section 7): and the third's
	// RESTATED at H26.4 (VECTOR-SCENE.md section 7, G3): and the fourth's
	const files = ['snap-grid', 'input-binding', 'input-capture', 'vector-scene'].reduce((n, c) => n + fs.readdirSync(path.join(ROOT, 'node_modules/@apnex', c, 'dist')).length, 0);
	assert.match(r.stdout, new RegExp(`scan-components: PASS -- 4 component\\(s\\), ${files} file\\(s\\)`), 'every file of each dist/ read, the maps and declarations among them');
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
	const found = foundIn(r.stdout);
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

/*
F1 (H26.1's verification) -- A SOURCE MAP IS JSON, AND ITS INLINED SOURCES ARE SOURCE.

Read as raw text, a map's JSON escapes glued `\n` and `\t` onto the word after them -- `\tlink` read as `tlink` -- so the first word of
every inlined source line was missed. A map is parsed: each `sourcesContent` entry is read line by line, as a source file is, and
every other string in it -- `file`, `sourceRoot`, `sources`, `names` -- as text; `mappings` is positions in base64, no text, and a
run of its letters is no word. A map that is not JSON is refused, not passed for want of anything read.
*/
const mapped = (map) => install((put, dir) => fs.writeFileSync(path.join(dir, 'node_modules/@apnex/snap-grid/dist/index.js.map'), typeof map === 'string' ? map : JSON.stringify(map)));
const MAP = (fields) => ({ version: 3, file: 'index.js', sourceRoot: '', sources: ['../src/index.ts'], names: [], mappings: 'AAAA', sourcesContent: [''], ...fields });

test('F1: a word starting an inlined source line is found -- a tab before `link();`, and `node grid line`, each on its second line, each alone', () => {
	for (const [content, word] of [['\n\tlink();', 'link'], ['\nnode grid line', 'node']]) {
		const r = run(mapped(MAP({ sourcesContent: [content] })));
		assert.equal(r.status, 1, `${JSON.stringify(content)} must fail:\n${r.stdout}`);
		const at = [...r.stdout.matchAll(FINDING)].map((m) => `${m[1].replace(/^.*\/dist\//, '')}:${m[2]} ${m[3]}`);
		assert.deepEqual(at, [`index.js.map#/sourcesContent/0:2 ${word}`], 'found on the source\'s own second line, named by the field it is in');
	}
});

test('F1: every other text field of a map is read; its mappings are not text, and a clean map passes -- the controls', () => {
	assert.equal(run(mapped(MAP({ sourcesContent: ['export const tlink = 1;\n\tgroup();'] }))).status, 0, 'a word run together, and an ordinary word, pass');
	assert.equal(run(mapped(MAP({ mappings: 'ANode,AAAA;Zone' }))).status, 0, 'a run of base64 that spells a word is no word');
	for (const [field, value, want] of [['names', ['zoneCount'], 'index.js.map zone zone'], ['sources', ['../src/anchor.ts'], 'index.js.map anchor anchor'], ['file', 'device.js', 'index.js.map device device'], ['x_extra', { note: 'a pipe' }, 'index.js.map pipe pipe']]) {
		const r = run(mapped(MAP({ [field]: value })));
		assert.equal(r.status, 1, `${field} is read`);
		assert.deepEqual(foundIn(r.stdout), [want]);
	}
	const broken = run(mapped('{"version": 3, "sourcesContent": ["node"'));
	assert.equal(broken.status, 1);
	assert.match(broken.stdout, /index\.js\.map is not JSON -- a source map's inlined sources cannot be read/);
});

/*
H31-4 (dev/DECISIONS.md; amends SNAP-GRID.md section 7.2 and G3) -- A SHARED COMPONENT'S ORDINARY USE OF A LISTED WORD PASSES BY AN
ALLOWANCE HELD IN DRAW (tools/scan-components.mjs `VOCABULARY_ALLOWANCES`): per component and word, the lines found when it was made and
the component's own term. A count at or below it passes, a fall said until the allowance is lowered; a rise fails, naming the lines; a
word with none fails as before. Draw's four extracted components take none, and an allowance for a package draw does not take fails. The
match is not touched. Each case on a copy of the install holding a shared component draw takes (`@apnex/peer-fixture`), its table handed
in for the copy (`--allowances`) as draw's own is read for the real tree.
*/
const PEER = '@apnex/peer-fixture';
function withPeer(lines) {
	const dir = install();
	const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
	pkg.dependencies[PEER] = '0.0.0';
	fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg));
	const at = path.join(dir, 'node_modules', ...PEER.split('/'));
	fs.mkdirSync(path.join(at, 'dist'), { recursive: true });
	fs.writeFileSync(path.join(at, 'package.json'), JSON.stringify({ name: PEER, version: '0.0.0' }));
	fs.writeFileSync(path.join(at, 'dist/index.js'), `${lines.join('\n')}\n`);
	return dir;
}
const runWith = (root, table) => {
	const file = path.join(root, 'allowances.json');
	fs.writeFileSync(file, JSON.stringify(table));
	return spawnSync(process.execPath, [TOOL, '--root', root, '--allowances', file], { encoding: 'utf8' });
};
const NODE_LINES = ['// a peer of the network is its node', 'export const nodeOf = (peer) => peer;', 'export const nodes = [];'];
const ALLOW_NODE = (lines) => ({ [PEER]: { node: { lines, term: 'the fixture\'s peer on its network, as AGP names one' } } });

test('H31-4: a shared component\'s word within its allowance passes -- 2 lines allowed, 2 found', () => {
	const r = runWith(withPeer(NODE_LINES.slice(0, 2)), ALLOW_NODE(2));
	assert.equal(r.status, 0, r.stdout);
	assert.match(r.stdout, /scan-components: PASS -- 5 component\(s\), \d+ file\(s\) of dist\/, no word of draw's vocabulary beyond 1 allowance\(s\), 2 line\(s\) allowed/);
});

test('H31-4: a rise past the allowance fails, naming the lines -- 2 allowed, 3 found', () => {
	const r = runWith(withPeer(NODE_LINES), ALLOW_NODE(2));
	assert.equal(r.status, 1, r.stdout);
	assert.match(r.stdout, /@apnex\/peer-fixture\/dist\/index\.js:3 {2}"nodes" \(draw: node\)/, 'the third line named');
	assert.match(r.stdout, /\u2717 @apnex\/peer-fixture "node": 3 line\(s\), allowed 2 -- RISE/);
});

test('H31-4: a fall below the allowance passes and says to lower it -- 2 allowed, 1 found', () => {
	const r = runWith(withPeer(NODE_LINES.slice(1, 2)), ALLOW_NODE(2));
	assert.equal(r.status, 0, r.stdout);
	assert.match(r.stdout, /@apnex\/peer-fixture "node": 1 line\(s\), allowed 2 -- FALL: lower the allowance in this commit, so the progress is written down/);
});

test('H31-4: a word with no allowance still fails, beside one allowed', () => {
	const r = runWith(withPeer([...NODE_LINES.slice(0, 2), 'export const zoneOf = 1;']), ALLOW_NODE(2));
	assert.equal(r.status, 1, r.stdout);
	assert.ok(foundIn(r.stdout).some((f) => f.endsWith(' zone')), r.stdout);
	assert.ok(!foundIn(r.stdout).some((f) => f.endsWith(' node')), 'the allowed word not reported as a finding');
});

test('H31-4: an allowance for a component draw extracted from itself fails -- its own gate carries draw\'s list', () => {
	for (const name of ['@apnex/snap-grid', '@apnex/input-binding', '@apnex/input-capture', '@apnex/vector-scene']) {
		const r = runWith(install(), { [name]: { node: { lines: 1, term: 'none' } } });
		assert.equal(r.status, 1, `${name}: ${r.stdout}`);
		assert.match(r.stdout, new RegExp(`\u2717 an allowance for ${name.replace('/', '\\/')}, a component draw extracted from itself`));
	}
});

test('H31-4: an allowance for a package draw does not take fails, and a malformed one', () => {
	const dead = runWith(install(), { '@apnex/not-taken': { node: { lines: 1, term: 'a peer' } } });
	assert.equal(dead.status, 1, dead.stdout);
	assert.match(dead.stdout, /\u2717 an allowance for @apnex\/not-taken, which draw does not depend on/);
	for (const [entry, why] of [[{ lines: 0, term: 'a peer' }, /lines is not a positive whole number/], [{ lines: 2, term: '' }, /names no term of the component's own/], [{ lines: 2, term: 'a peer', extra: 1 }, /holds a field other than lines and term/]]) {
		const r = runWith(withPeer(NODE_LINES.slice(0, 2)), { [PEER]: { node: entry } });
		assert.equal(r.status, 1, r.stdout);
		assert.match(r.stdout, why);
	}
	const unlisted = runWith(withPeer(NODE_LINES.slice(0, 2)), { [PEER]: { node: { lines: 2, term: 'a peer' }, peer: { lines: 1, term: 'a peer' } } });
	assert.match(unlisted.stdout, /"peer", which is no word of draw's/);
});

test('H31-4: the real tree passes with draw\'s table empty -- its four components clean, no allowance held', () => {
	const r = run(null);
	assert.equal(r.status, 0, r.stdout);
	assert.match(r.stdout, /no word of draw's vocabulary beyond 0 allowance\(s\), 0 line\(s\) allowed/);
});
