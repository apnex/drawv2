/*
H17 K0 -- scan-layers, driven over fixtures.

Asserting that the real tree passes proves only that the rules agree with today's code. What these
tests prove is that each rule FAILS when it should: every fixture under `tests/fixtures/layers/` is
a tiny synthetic tree with its own manifest (`manifest.json`, the shape of `tools/layers.mjs`).
`clean` passes every rule; each rule's fixture breaks that rule alone. A test asserts the scan exits
1 AND that the rules it fails are exactly the ones intended, so switching a rule's check off turns
its test red rather than leaving a neighbouring rule to catch the fixture by accident.

The review's seven boundary mutants (M1-M7) are here twice: as fixtures, and applied one at a time
to a copy of this repository under the real manifest -- the form the review ran them in. So are the
violations the K0 attack showed passing the first build of this scanner (A1-A24), each fixed and
each held by a fixture below. Every mutant is proven to have landed before its verdict is read,
because an unlanded mutant reads as a pass.
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync, execFile } from 'node:child_process';
import { UNUSED_EXPORTS, SCANNER_ROOTS, FOLDERS, PAGES, RATCHETS, RATCHET_CEILING } from '../tools/layers.mjs';

const root = path.resolve(import.meta.dirname, '..');
const SCANNER = path.join(root, 'tools/scan-layers.mjs');
const FIX = path.join(root, 'tests/fixtures/layers');

function scan(args) {
	try { return { out: execFileSync('node', [SCANNER, ...args], { encoding: 'utf8' }), code: 0 }; }
	catch (e) { return { out: (e.stdout || '') + (e.stderr || ''), code: e.status }; }
}
const fixture = (name) => scan(['--root', path.join(FIX, name), '--manifest', path.join(FIX, name, 'manifest.json')]);
// the rules a scan failed, from its cross-marked finding lines
const failed = (out) => [...new Set([...out.matchAll(/^ {2}\u2717 (L\w+) /gm)].map((m) => m[1]))].sort();

function fails(name, rule, ...needles) {
	const r = fixture(name);
	assert.equal(r.code, 1, `the ${name} fixture must fail the scan:\n${r.out}`);
	assert.deepEqual(failed(r.out), [rule], `the ${name} fixture must fail ${rule} and nothing else:\n${r.out}`);
	for (const n of needles) assert.match(r.out, n);
	return r.out;
}

test('K0: a clean tree passes every rule, recorded ratchets and a lab included', () => {
	const r = scan(['--root', path.join(FIX, 'clean'), '--manifest', path.join(FIX, 'clean', 'manifest.json'), '--verbose']);
	assert.equal(r.code, 0, r.out);
	assert.match(r.out, /PASS/);
	// app/canvas.js names `window` three times and reads the global once: a property and a key are not reads
	assert.match(r.out, /L11 {2}app\/canvas\.js: 1 \(recorded\)\n {9}app\/canvas\.js:6 window\n/);
	// MAX_OPS is listed under a module the baseline never named: it moved with its symbol (C2c)
	assert.match(r.out, /L10 {2}planner planner\/txn\.mjs:MAX_OPS \[rebuild-debt\]/);
	assert.match(r.out, /L6 entry lab: 8 module\(s\)/);
});

test('K0 L1: every module has one layer, and nothing sits outside the scan', () => {
	fails('L1', 'L1',
		/ALLOWED\.tools names 'toolz', which is not a layer/,
		/RULES\.L11\.hard names 'cor', which is not a layer/,
		/RATCHETS\.L12 is not a ratcheted rule/,
		/kernel\/b\.mjs has no layer/,
		/kernel\/twice\.mjs is listed in LAYER under both core and network/,
		/LAYER names 'nolayer', which is not a layer/,
		/model\/m\.mjs is in layer 'nolayer', which ALLOWED does not define/,
		/tools\/t\.mjs has two layers/,
		/LAYER names kernel\/gone\.mjs, which is not a module/,
		/extra\/c\.mjs is outside every folder in FOLDERS/,
		/SCANNER_ROOTS\.dead names nowhere/,
		/model is a scanned folder that scan-dead does not read/,
		/kernel\/missing\.mjs, which is not on disk/);
});

test('K0 L2: an edge against the direction fails, import() included, and a non-literal import() is refused', () => {
	fails('L2', 'L2',
		/kernel\/grid\.mjs -> app\/canvas\.js: 1, recorded 0 -- RISE/,
		/app\/canvas\.js -> app\/main\.js: 1, recorded 0 -- RISE[^\n]*\n\s+app\/canvas\.js:2 import\('\.\/main\.js'\) \(canvas -> chrome\)/,
		/app\/canvas\.js:3 import\(name\) -- a non-literal specifier/);
});

test('K0 L2: an import through a barrel is judged at the module that defines each name', () => {
	const out = fails('L2-barrel', 'L2', /app\/input\.js -> engine\/situation\.mjs: 1, recorded 0/);
	// commands.js reaches the planner's policy through the same barrel, which the canvas may do
	assert.doesNotMatch(out, /commands\.js/);
});

test('K0 L3: kernel/ and model/ import nothing from each other, even core to core, import() included', () => {
	fails('L3', 'L3',
		/kernel\/geometry\.mjs:1 import '\.\.\/model\/limits\.mjs' -- kernel\/ and model\/ import nothing from each other/,
		/kernel\/geometry\.mjs:3 import\('\.\.\/model\/limits\.mjs'\) -- kernel\/ and model\/ import nothing from each other/);
});

test('K0 L4: a barrel is found by structure, importing one is counted, and so is each name it re-exports', () => {
	fails('L4', 'L4', /barrel kernel\/all\.mjs: 1, recorded 0/, /app\/snap\.js -> kernel\/all\.mjs: 1, recorded 0/,
		// a query names the same file: re-pointing an import at `index.mjs?` is not progress (A24)
		/app\/ruler\.js -> kernel\/all\.mjs: 1, recorded 0 -- RISE/,
		// a recorded barrel that grows a re-export is a rise, not the same barrel (A5)
		/barrel kernel\/old\.mjs: 2, recorded 1 -- RISE/);
});

test('K0 L5: core exports no network name from the fixed list, re-exported names included', () => {
	fails('L5', 'L5', /kernel\/geometry\.mjs:port: 1, recorded 0/, /kernel\/index\.mjs:port: 1, recorded 0/);
});

test('K0 L5p: core exports no name matching the network pattern', () => {
	fails('L5p', 'L5p', /kernel\/geometry\.mjs:flowRate: 1, recorded 0/);
});

test('K0 L6: an entry\'s closure equals its declared list, and a layered entry loads only its layers', () => {
	fails('L6', 'L6',
		/entry page loads app\/canvas\.js, which its declared list does not name/,
		/entry page declares app\/gone\.js, which it no longer loads/,
		/entry lab loads kernel\/grid\.mjs \(core\), a layer it may not load/);
});

test('K0 L7: no batch module is reachable from a product root', () => {
	fails('L7', 'L7', /batch module batch\/pipe\.mjs is reachable from the product root app\/main\.js/);
});

test('K0 L7k: the whole id grammar accepts exactly the five kinds, and a new five-kind line must be recorded', () => {
	const out = fails('L7k', 'L7k',
		/planner\/validate\.js:1 ID accepts \[[^\]]*"pipe"[^\]]*\], not exactly the kinds/,
		/planner\/validate\.js: 1, recorded 0 -- RISE: a new line naming all five kinds/,
		// the right first group and a second alternative accepting `pipe-` ids (A6c)
		/planner\/ids\.js:1 ID is \/[^\n]*\|\^pipe-[^\n]*, not exactly \/\^\(<alternation>\)-\[0-9a-f\]\{6\}\$\//,
		/planner\/idsi\.js:1 ID is \/[^\n]*\/i, not exactly/);
	// the first group of ids.js IS the right alternation: only the whole-pattern check catches it
	assert.doesNotMatch(out, /planner\/ids\.js:1 ID accepts/);
});

test('K0 L8: the lab is composition only', () => {
	fails('L8', 'L8',
		/lab\/other\.js:1 import '\.\/lab\.js' imports the lab/,
		/lab\/lab\.js exports exposed/,
		/lab\/lab\.js declares a class/,
		/lab\/ carries 6 code line\(s\), over its budget of 3/);
});

test('K0 L9: a browser module importing a rule primitive is counted, however it takes the name', () => {
	fails('L9', 'L9', /app\/input\.js:splitAtBend: 1, recorded 0/,
		// a namespace destructured, and import() destructured, may read any name (A12a, A12c)
		/app\/select\.js:splitAtBend: 1, recorded 0/, /app\/drag\.js:splitAtBend: 1, recorded 0/,
		// import() is an edge like any other
		/app\/drop\.js:splitAtBend: 1, recorded 0/);
});

test('K0 L10: an unused export must be listed, and only from the frozen baseline (C2c)', () => {
	fails('L10-unlisted', 'L10',
		/planner\/txn\.mjs:EXTRA is exported and unused inside the entry -- give it a consumer or stop exporting it; it may not join the list/,
		/planner\/txn\.mjs:LIMIT is exported and unused inside the entry -- list it \(it is in the frozen K0 baseline/);
});

test('K0 L10: a listed name that gained a consumer fails until it leaves the list (C2b)', () => {
	fails('L10-stale', 'L10', /planner\/txn\.mjs:MAX is listed as unused and is not any more/);
});

test('K0 L10: a name that was never in the baseline may not join the list (C2c)', () => {
	fails('L10-join', 'L10', /planner\/txn\.mjs:MAX is listed but is not in the frozen K0 baseline, and no baseline symbol of that name left its module for it \(0 vacated, 1 claimed\)/);
});

test('K0 L10: every listed name carries one of the two tags, and serves-a-server-door is checked (C2d)', () => {
	fails('L10-tag', 'L10',
		/planner\/txn\.mjs:LIMIT is tagged 'someday'/,
		/planner\/txn\.mjs:MAX is tagged serves-a-server-door and no server-only module imports it/);
});

test('K0 L11: core, network and planner read no host object under any of its names, with no ratchet to excuse it', () => {
	fails('L11', 'L11', /kernel\/grid\.mjs:1 reads globalThis -- a core module takes its host by injection/,
		// an escaped identifier is the name it spells (A7d)
		/kernel\/grid\.mjs:2 reads window -- a core module/,
		// every hard layer, not only the first; and the worker and Node names of the host (A7a, A7b)
		/network\/links\.mjs:1 reads self -- a network module/,
		/planner\/txn\.mjs:1 reads global -- a planner module/);
});

test('K0 ratchet: a count above its record fails as a rise', () => {
	fails('ratchet-rise', 'L2', /app\/input\.js -> app\/palette\.js: 2, recorded 1 -- RISE/);
});

test('K0 ratchet: a count below its record fails until the record is lowered', () => {
	fails('ratchet-fall', 'L2', /app\/input\.js -> app\/palette\.js: 0, recorded 1 -- FALL: lower RATCHETS\.L2/);
});

/*
The K0 attack's defects, one fixture each: violations the first build of this scanner passed. Each
fixture fails its rule alone, with the finding that names the defect, so a check switched off turns
its test red rather than leaving a neighbour to catch the fixture.
*/
test('K0 L1: an edge to a file the scan does not read -- .cjs, .json, .ts -- fails, whatever its extension (A13)', () => {
	fails('L1-target', 'L1',
		/server\/txn\.mjs:1 import '\.\/helper\.cjs' reaches server\/helper\.cjs, which is not a module the scan reads/,
		/server\/txn\.mjs:2 import '\.\/data\.json' reaches server\/data\.json, which is not a module the scan reads/,
		/server\/txn\.mjs:3 import '\.\/typed\.ts' reaches server\/typed\.ts, which is not a module the scan reads/);
});

test('K0 L2: a query or fragment names the same module, and a specifier the scan cannot place is refused (A1, A2)', () => {
	fails('L2-specifier', 'L2',
		/app\/input\.js -> sim\/situation\.mjs: 1, recorded 0 -- RISE[^\n]*\n\s+app\/input\.js:1 import '\.\.\/sim\/situation\.mjs\?v'/,
		/app\/input\.js -> sim\/kinds\.mjs: 1, recorded 0 -- RISE[^\n]*\n\s+app\/input\.js:3 import\('\.\.\/sim\/kinds\.mjs#x'\)/,
		/kernel\/spec\.mjs:1 import '\/sim\/situation\.mjs' -- '[^']*' is an absolute path/,
		/kernel\/spec\.mjs:2 import '\.\.\/\.\.\/outside\/x\.mjs' -- '[^']*' is a relative path that climbs out of the repository/,
		/kernel\/spec\.mjs:3 import 'draw\/sim\/x\.mjs' -- '[^']*' is neither a builtin nor a package that package\.json declares/,
		/kernel\/spec\.mjs:4 import 'https:\/\/example\.test\/x\.mjs' -- '[^']*' is a URL/,
		/kernel\/spec\.mjs:5 import '#internal' -- '[^']*' is a package subpath import/);
});

test('K0 L2: a barrel\'s re-export is an edge, judged by the barrel\'s own layer (A5, A5b)', () => {
	const out = fails('L2-reexport', 'L2',
		/model\/index\.mjs -> model\/invariants\.mjs: 1, recorded 0 -- RISE[^\n]*\n\s+model\/index\.mjs:1 export from '\.\/invariants\.mjs' \(core -> network\)/,
		/model\/index\.mjs -> engine\/situation\.mjs: 1, recorded 0 -- RISE[^\n]*\n\s+model\/index\.mjs:2 export from '\.\.\/engine\/situation\.mjs' \(core -> simulation\)/);
	// the planner taking `violations` through the barrel is planner -> network, which it may do
	assert.doesNotMatch(out, /planner\/txn\.mjs ->/);
});

test('K0 L2: a regex after a condition or a block, and an escaped specifier, do not hide an import() (A15)', () => {
	fails('L2-misread', 'L2',
		/app\/input\.js -> sim\/situation\.mjs: 1, recorded 0 -- RISE[^\n]*\n\s+app\/input\.js:1 import\('\.\.\/sim\/situation\.mjs'\)/,
		/app\/input\.js -> sim\/kinds\.mjs: 1, recorded 0 -- RISE[^\n]*\n\s+app\/input\.js:2 import\('\.\.\/sim\/kinds\.mjs'\)/,
		/app\/input\.js -> sim\/spawn\.mjs: 1, recorded 0 -- RISE[^\n]*\n\s+app\/input\.js:3 import\('\.\.\/sim\/spawn\.mjs'\)/);
});

test('K0 L2: a shipped module loads code by import alone, and holds no import-shaped literal; tools may (A18)', () => {
	const out = fails('L2-loaders', 'L2',
		/planner\/txn\.mjs:1 import 'node:module' -- node:module loads code outside import/,
		/planner\/txn\.mjs:4 import\('node:vm'\) -- node:vm loads code outside import/,
		/planner\/txn\.mjs:2 names createRequire, which loads code outside import/,
		/planner\/txn\.mjs:5 names getBuiltinModule, which loads code outside import/,
		/app\/input\.js:2 names eval, which loads code outside import/,
		/app\/input\.js:3 names Function, which loads code outside import/,
		/app\/input\.js:4 names require, which loads code outside import/,
		/app\/input\.js:1 a string literal holds import-shaped text/);
	assert.doesNotMatch(out, /tools\/t\.mjs/, 'a tools module may read node:module, name eval and quote an import');
});

test('K0 L6: a page loads exactly its entry\'s roots, and carries no inline code (A17)', () => {
	fails('L6-page', 'L6',
		/app\/index\.html:4 an inline <script> is code no entry declares/,
		/app\/index\.html:6 an inline event handler is code no entry declares/,
		/app\/index\.html:7 a javascript: URL is code no entry declares/,
		/app\/index\.html loads \["\/main\.js","\/sim\/situation\.mjs"\], not the \["\/main\.js"\] PAGES declares/,
		/app\/index\.html loads app\/main\.js \+ app\/sim\/situation\.mjs, and entry page's roots are app\/main\.js/,
		/docs\/other\.html:2 loads \/app\/main\.js, and PAGES does not declare the page/,
		/PAGES declares app\/gone\.html, which is not a page in the tree/);
});

test('K0 L10: a new export that only shares a baseline name may not join the list (C2c, A14)', () => {
	const out = fails('L10-borrow', 'L10', /planner\/log\.mjs:LIMIT is listed but is not in the frozen K0 baseline, and no baseline symbol of that name left its module for it \(0 vacated, 1 claimed\)/);
	assert.doesNotMatch(out, /planner\/txn\.mjs:LIMIT/, 'the baseline entry itself stays listable');
});

test('K0 ratchet: a record above its frozen ceiling, or a key the ceiling never held, fails (A9)', () => {
	fails('ratchet-raise', 'L2',
		/app\/input\.js -> app\/palette\.js: recorded 2, above its frozen K0 ceiling of 1 -- RAISED/,
		/app\/input\.js -> app\/tray\.js: recorded 1, a key the frozen K0 ceiling does not hold -- RAISED/);
});

test('K0 ratchet: a manifest that records ratchets must declare the frozen ceiling', () => {
	fails('ratchet-no-ceiling', 'L1', /RATCHETS records violations and RATCHET_CEILING is not declared/);
});

/*
The review's mutants as fixtures. M7 is caught by L2 (core may not import the planner) and not by
L3, because C9 as the H17 plan states it is kernel/ against model/; the review expected L3 there
under the prototype's wider reading, which also covered engine/.
*/
for (const [name, rules] of [
	['M1-core-imports-network-static', ['L2', 'L3']],
	['M2-canvas-imports-sim-dynamic', ['L2']],
	['M3-new-network-symbol-in-core', ['L5p']],
	['M4-new-kind-in-core-literal', ['L7k']],
	['M5-new-barrel', ['L4']],
	['M6-global-reach-into-chrome', ['L11']],
	['M7-model-imports-engine', ['L2']],
]) {
	test(`K0 ${name.slice(0, 2)} (review mutant, fixture): fails ${rules.join(' and ')}`, () => {
		const r = fixture(name);
		assert.equal(r.code, 1, r.out);
		assert.deepEqual(failed(r.out), rules, r.out);
	});
}

/*
The same seven mutations applied to a copy of THIS tree, under the real manifest -- the review's own
method (review/instruments/boundary-mutants.mjs) -- and then the violations the K0 attack showed the
first build passing, in the attack's own shapes. M5 appends its import to snap.js rather than
re-pointing snap.js's barrel import, so it keeps landing after K2b removes that import; the fixture
above keeps the re-pointed shape.

Each mutant gets its own copy (the scanned folders, package.json and the declared pages), and each
copy is scanned by ITS OWN tools/scan-layers.mjs and tools/layers.mjs, so a mutant may edit the
manifest (A9, A14, A23). The unmutated copy must pass first, or every verdict would be measuring
something else, and every edit must land. Some needles name today's code (M4's KINDS line, A5's
imports in txn.mjs, A6c's ID): when a cut changes that line, the mutant fails as INVALID, and the cut
re-points it.
*/
const MAN = 'tools/layers.mjs';
const MUTANTS = [
	{ id: 'M1', rule: 'L2', also: ['L3'], edits: [{ file: 'kernel/spec.mjs', append: "\nimport { violations } from '../model/invariants.mjs';\n" }] },
	{ id: 'M2', rule: 'L2', edits: [{ file: 'app/src/input.js', append: "\nexport async function __m2() { return (await import('../../engine/situation.mjs')).situationOf; }\n" }] },
	{ id: 'M3', rule: 'L5p', edits: [{ file: 'kernel/spec.mjs', append: '\nexport const linkLength = (link) => (link.via ? link.via.length + 1 : 1);\n' }] },
	{ id: 'M4', rule: 'L7k', edits: [{ file: 'model/model.mjs', replace: ["const KINDS = ['node', 'waypoint', 'link', 'zone', 'group'];", "const KINDS = ['node', 'waypoint', 'link', 'zone', 'group', 'pipe'];"] }] },
	{ id: 'M5', rule: 'L4', also: ['L1'], edits: [{ file: 'kernel/all.mjs', create: "export * from './geometry.mjs';\nexport * from './spec.mjs';\n" },
		{ file: 'app/src/snap.js', append: "\nimport { cellOf } from '../../kernel/all.mjs';\n" }] },
	{ id: 'M6', rule: 'L11', edits: [{ file: 'app/src/input.js', append: '\nexport function __m6() { return window.draw.sync.submit({ ops: [] }); }\n' }] },
	{ id: 'M7', rule: 'L2', edits: [{ file: 'model/model.mjs', append: "\nimport { collectionCap } from '../engine/policy.mjs';\n" }] },
	// the attack: a suffix, an absolute path, and a barrel import re-pointed at `index.mjs?` with its record lowered
	{ id: 'A1d', rule: 'L2', edits: [{ file: 'kernel/spec.mjs', append: "\nimport { collectionCap as __c } from '../engine/policy.mjs?v';\n" }] },
	{ id: 'A2', rule: 'L2', edits: [{ file: 'app/src/input.js', append: "\nexport async function __a2() { return (await import('/engine/situation.mjs')).situationOf; }\n" }] },
	{ id: 'A24b', rule: 'L4', edits: [{ file: 'app/src/snap.js', replace: ["from '../../kernel/index.mjs';", "from '../../kernel/index.mjs?';"] },
		{ file: MAN, replace: ["\t\t'app/src/snap.js -> kernel/index.mjs': 1,\n", ''] }] },
	// a record raised with its violation; a new export borrowing a baseline name into the L10 list
	{ id: 'A9', rule: 'L2', edits: [{ file: 'app/src/input.js', append: "\nexport async function __m2() { return (await import('../../engine/situation.mjs')).situationOf; }\n" },
		{ file: MAN, replace: ["'app/src/input.js -> engine/situation.mjs': 1,", "'app/src/input.js -> engine/situation.mjs': 2,"] }] },
	{ id: 'A14', rule: 'L10', edits: [{ file: 'server/log.mjs', append: '\nexport const check = () => 0;\n' },
		{ file: MAN, replace: ["'rebuild-debt': ['LOG_HARD_MAX', 'LOG_MAX'],", "'rebuild-debt': ['LOG_HARD_MAX', 'LOG_MAX', 'check'],"] }] },
	// the second alternative of the id grammar
	{ id: 'A6c', rule: 'L7k', edits: [{ file: 'server/validate.js', replace: ['const ID = /^(node|waypoint|link|zone|group|diagram|template)-[0-9a-f]{6}$/;', 'const ID = /^(node|waypoint|link|zone|group|diagram|template)-[0-9a-f]{6}$|^pipe-[0-9a-f]{6}$/;'] }] },
	// a core barrel forwarding network code, and one forwarding simulation code under a listed name
	{ id: 'A5', rule: 'L2', edits: [{ file: 'model/index.mjs', append: "export { violations } from './invariants.mjs';\n" },
		{ file: 'server/txn.mjs', replace: ["import { projection } from '../model/index.mjs';", "import { projection, violations } from '../model/index.mjs';"] },
		{ file: 'server/txn.mjs', replace: ["import { violations, isStraight, pairKey, collapseAtWaypoint } from '../model/invariants.mjs';", "import { isStraight, pairKey, collapseAtWaypoint } from '../model/invariants.mjs';"] }] },
	{ id: 'A5b', rule: 'L2', edits: [{ file: 'model/index.mjs', append: "export { situationOf } from '../engine/situation.mjs';\n" },
		{ file: MAN, replace: ["'rebuild-debt': ['CONTENT_VALUE_MAX', 'SPAN_MAX', 'SURFACE', 'kindOf'],", "'rebuild-debt': ['CONTENT_VALUE_MAX', 'SPAN_MAX', 'SURFACE', 'kindOf', 'situationOf'],"] }] },
	// a rule primitive taken from a namespace, and from import(), by destructuring
	{ id: 'A12a', rule: 'L9', edits: [{ file: 'app/src/selection.js', append: "\nimport * as __inv from '../../model/invariants.mjs';\nconst { collapseAtWaypoint: __cw } = __inv;\n" }] },
	{ id: 'A12c', rule: 'L9', edits: [{ file: 'app/src/selection.js', append: "\nexport async function __a12() { const m = await import('../../model/invariants.mjs'); const { collapseAtWaypoint } = m; return collapseAtWaypoint; }\n" }] },
	// the host by its other names, and by an escaped name
	{ id: 'A7a', rule: 'L11', edits: [{ file: 'kernel/spec.mjs', append: '\nconst __host = () => self.draw;\n' }] },
	{ id: 'A7b', rule: 'L11', edits: [{ file: 'server/txn.mjs', append: '\nconst __host = () => global.draw;\n' }] },
	{ id: 'A7d', rule: 'L11', edits: [{ file: 'kernel/spec.mjs', append: '\nconst __host = () => \\u0077indow.draw;\n' }] },
	// a regex after `)` that used to hide the import() after it
	{ id: 'A15', rule: 'L2', edits: [{ file: 'app/src/input.js', append: "\nexport async function __a15(ok, s) { if (ok) /'/.test(s); const m = await import(\"../../engine/situation.mjs\"); if (ok) /'/.test(s); return m.situationOf; }\n" }] },
	// loading outside import: createRequire, a .cjs shim, an inline module script
	{ id: 'A18', rule: 'L2', edits: [{ file: 'server/txn.mjs', append: "\nimport { createRequire } from 'node:module';\nconst __req = createRequire(import.meta.url);\nconst __lazy = () => __req('./store.js');\n" }] },
	{ id: 'A13b', rule: 'L1', edits: [{ file: 'server/helper.cjs', create: "module.exports = require('./origin.mjs');\n" },
		{ file: 'server/txn.mjs', append: "\nimport __helper from './helper.cjs';\n" }] },
	{ id: 'A17', rule: 'L6', edits: [{ file: 'app/index.html', replace: ['<script type="module" src="/src/main.js"></script>', '<script type="module" src="/src/main.js"></script>\n\t\t<script type="module">import(\'/engine/situation.mjs\');</script>'] }] },
	// a module listed under a second layer, where its window read would go uncounted
	{ id: 'A23', rule: 'L1', edits: [{ file: MAN, replace: ["'app/src/main.js',       // the production composition root", "'app/src/selection.js', 'app/src/main.js',       // the production composition root"] },
		{ file: 'app/src/selection.js', append: '\nconst __h = () => window.draw;\n' }] },
];

const scanOwn = (dir) => new Promise((done) => {
	execFile('node', [path.join(dir, 'tools/scan-layers.mjs')], { encoding: 'utf8' }, (err, stdout, stderr) => done({ out: stdout + stderr, code: err ? err.code : 0 }));
});

test('K0 M1-M7 and the attack\'s A-mutants (on copies of this tree): each lands and each fails its rule', async () => {
	const base = fs.mkdtempSync(path.join(os.tmpdir(), 'k0-mutants-'));
	try {
		const copy = (to) => {
			for (const f of FOLDERS) {
				fs.cpSync(path.join(root, f.dir), path.join(to, f.dir), {
					recursive: true, filter: (src) => !(f.skip ?? []).some((s) => src === path.join(root, s) || src.startsWith(path.join(root, s) + path.sep)),
				});
			}
			for (const f of ['package.json', ...Object.keys(PAGES)]) fs.cpSync(path.join(root, f), path.join(to, f));
		};
		copy(path.join(base, 'control'));
		const control = await scanOwn(path.join(base, 'control'));
		assert.equal(control.code, 0, `the unmutated copy must pass before any mutant is read:\n${control.out}`);

		const runs = MUTANTS.map((m) => {
			const dir = path.join(base, m.id);
			fs.cpSync(path.join(base, 'control'), dir, { recursive: true });
			for (const e of m.edits) {
				const p = path.join(dir, e.file);
				const before = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
				if (e.replace) assert.ok(before?.includes(e.replace[0]), `${m.id} is INVALID: its needle is gone from ${e.file}`);
				const after = e.create ?? (e.append ? before + e.append : before.replace(e.replace[0], () => e.replace[1]));
				fs.writeFileSync(p, after);
				assert.notEqual(fs.readFileSync(p, 'utf8'), before, `${m.id} did not land in ${e.file}`);
			}
			return scanOwn(dir).then((r) => ({ m, r }));
		});
		for (const { m, r } of await Promise.all(runs)) {
			assert.equal(r.code, 1, `${m.id} was not caught:\n${r.out}`);
			for (const rule of [m.rule, ...(m.also ?? [])]) assert.ok(failed(r.out).includes(rule), `${m.id} must fail ${rule}; it failed ${failed(r.out).join(', ')}:\n${r.out}`);
		}
	} finally { fs.rmSync(base, { recursive: true, force: true }); }
});

/*
C2(c): the L10 list grows only from the baseline K0 froze. The scanner enforces "only from the
baseline"; this pins the baseline itself, so widening it means editing this line in the same diff,
where a reviewer sees it. 153 names: the planner entry's unused exports at K0.
*/
test('K0 L10: the frozen baseline is the one K0 recorded', () => {
	const b = UNUSED_EXPORTS.planner.baseline;
	assert.equal(Object.values(b).flat().length, 153);
	assert.equal(crypto.createHash('sha256').update(JSON.stringify(b)).digest('hex'),
		'04b67fd182df2f695d3856544e7800ee8e88dd79d044247c4f0cd7bfdc603bf9');
});

/*
The ratchet ceiling is pinned the same way. The scanner holds every record at or below it; this
holds the ceiling itself, so a raised ceiling is an edit to this line, in the same diff. At K0 the
ceiling IS the record: 4 L2 edges, 123 barrel imports and 94 barrel re-exports, 19 L5 names, 15
L5p names, 17 L7k consumer lines, 2 L9 sites and 3 canvas host reads.
*/
test('K0 ratchet: the frozen ceiling is the one K0 recorded, and every record sits at or below it', () => {
	assert.equal(crypto.createHash('sha256').update(JSON.stringify(RATCHET_CEILING)).digest('hex'),
		'6995b30f6a3297c025ae2f289906fb602f141987252ce2555b5dd06bb085870f');
	for (const [rule, rec] of Object.entries(RATCHETS)) {
		for (const [key, n] of Object.entries(rec)) assert.ok(n <= (RATCHET_CEILING[rule]?.[key] ?? -1), `RATCHETS.${rule}['${key}'] = ${n} is above its ceiling`);
	}
});

test('K0: the gate runs scan-layers, and the four scanners read their folders from the manifest', () => {
	const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
	assert.match(pkg.scripts.gate, /&& node tools\/scan-layers\.mjs(?: &&|$)/, 'the gate does not run scan-layers');
	for (const [scanner, keys] of [['scan-dead', ['dead', 'deadMethods']], ['scan-docrefs', ['docrefs']], ['scan-twins', ['twins']], ['scan-writers', ['writers']]]) {
		const src = fs.readFileSync(path.join(root, `tools/${scanner}.mjs`), 'utf8');
		assert.match(src, /import \{ SCANNER_ROOTS \} from '\.\/layers\.mjs';/, `${scanner} does not read the manifest`);
		for (const k of keys) {
			assert.ok(src.includes(`SCANNER_ROOTS.${k}`), `${scanner} does not use SCANNER_ROOTS.${k}`);
			assert.ok(Array.isArray(SCANNER_ROOTS[k]) && SCANNER_ROOTS[k].length, `SCANNER_ROOTS.${k} is empty`);
		}
		// a folder list re-typed in the scanner is the drift this move exists to end
		assert.doesNotMatch(src, /^const \w+ = \[\s*'(?:kernel|server|model|engine|app\/src)'/m, `${scanner} still hard-codes a folder list`);
	}
});
