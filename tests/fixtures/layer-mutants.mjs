/*
H31-6 (dev/DECISIONS.md) -- the K0 mutants' definitions and runner, moved out of tests/scan-layers.test.js so their record-free runs can
sit in a file of their own (tests/scan-layers-mutants.test.js), run by the full gate alone, while the three runs that copy the records in
-- V7, V0 and VF -- stay in tests/scan-layers.test.js, run by the records gate too. This module names no record: the records are handed
in by the test that copies them.
*/
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { FOLDERS, PAGES, MOVED, SCANNER_ROOTS } from '../../tools/layers.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const failed = (out) => [...new Set([...out.matchAll(/^ {2}\u2717 (L\w+) /gm)].map((m) => m[1]))].sort();

export const MAN = 'tools/layers.mjs';
/*
H26.5: THE FALSIFIERS' OWN VERBATIM FIXTURE, planted in a copy with its entry: a copy importing a name through each of two shims, each shim
re-exporting a live module's name and nothing else -- the form RULES.L4.verbatim admits (tools/scan-layers.mjs L4). V1 to V9 each break
one part of it; the control VF plants it whole, and must pass.
*/
export const VF = 'tests/fixtures/verbatim-falsifier';
export const VERBATIM = [
	{ file: `${VF}/copy.js`, create: "// a module kept verbatim: its relative imports answered by the shims beside it\nimport { hitWith } from './pick.js';\nimport { el } from './painter.js';\nexport const copied = [hitWith, el];\n" },
	{ file: `${VF}/pick.js`, create: "// a shim: the one name the copy imports from './pick.js', re-exported from the live module\nexport { hitWith } from '../../../app/src/pick.js';\n" },
	{ file: `${VF}/painter.js`, create: "export { el } from '../../../app/src/painter.js';\n" },
	{ file: MAN, replace: ['\tL4: { verbatim: [\n', `\tL4: { verbatim: [\n\t\t{ copy: '${VF}/copy.js', shims: ['${VF}/painter.js', '${VF}/pick.js'], cites: ['H26-14', 'H26.5'], reason: 'the falsifiers\\' own copy and shims', trigger: 'the falsifiers are restated' },\n`] },
];
// H26-19 as amended: an @apnex/ package declared among the devDependencies alone, as `clean-runner` and `headless-chromium` are
export const DEV_ONLY = { file: 'package.json', replace: ['"devDependencies": {\n', '"devDependencies": {\n\t\t"@apnex/dev-only": "https://example.invalid/dev-only.tgz",\n'] };
export const MUTANTS = [
	// RESTATED at H21.8 (B341): model/invariants.mjs is core now, so M1 imports model/ (L3) and network/ (L2)
	{ id: 'M1', rule: 'L2', also: ['L3'], edits: [{ file: 'kernel/spec.mjs', append: "\nimport { violations } from '../model/invariants.mjs';\nimport { splitAtBend } from '../plugins/network/link-rules.mjs';\n" }] },
	// K5: the situation is core now, so a canvas reaching the SIMULATION is shown with the movers
	{ id: 'M2', rule: 'L2', edits: [{ file: 'app/src/input.js', append: "\nexport async function __m2() { return (await import('../../plugins/simulation/movers.mjs')).moversAt; }\n" }] },
	{ id: 'M3', rule: 'L5p', edits: [{ file: 'kernel/spec.mjs', append: '\nexport const linkLength = (link) => (link.via ? link.via.length + 1 : 1);\n' }] },
	// PL-5: the kind list's one literal is model/shape.mjs's table now, so the planted sixth kind goes there
	{ id: 'M4', rule: 'L7k', edits: [{ file: 'model/shape.mjs', replace: ["const KINDS = ['node'];", "const KINDS = ['node', 'waypoint', 'link', 'zone', 'group', 'pipe'];"] }] },
	// RESTATED at H26.1: the planted imports name `gridDot`, the kernel's `cellOf` being deleted (SNAP-GRID.md section 5)
	{ id: 'M5', rule: 'L4', also: ['L1'], edits: [{ file: 'kernel/all.mjs', create: "export * from './geometry.mjs';\nexport * from './spec.mjs';\n" },
		{ file: 'app/src/snap.js', append: "\nimport { gridDot } from '../../kernel/all.mjs';\n" }] },
	{ id: 'M6', rule: 'L11', edits: [{ file: 'app/src/input.js', append: '\nexport function __m6() { return window.draw.sync.submit({ ops: [] }); }\n' }] },
	{ id: 'M7', rule: 'L2', edits: [{ file: 'model/model.mjs', append: "\nimport { Log } from '../planner/log.mjs';\n" }] },
	// the attack: a suffix, an absolute path, and a barrel import re-pointed at `index.mjs?` with its record lowered
	{ id: 'A1d', rule: 'L2', edits: [{ file: 'kernel/spec.mjs', append: "\nimport { Log as __c } from '../planner/log.mjs?v';\n" }] },
	{ id: 'A2', rule: 'L2', edits: [{ file: 'app/src/input.js', append: "\nexport async function __a2() { return (await import('/plugins/simulation/movers.mjs')).moversAt; }\n" }] },
	// K2c: no barrel is left to re-point, so the attack plants one and imports it through a suffix; the new file also fails L1
	{ id: 'A24b', rule: 'L4', also: ['L1'], edits: [{ file: 'kernel/index.mjs', create: "export { gridDot } from './geometry.mjs';\n" },
		{ file: 'app/src/snap.js', append: "\nimport { gridDot as __c } from '../../kernel/index.mjs?';\n" }] },
	// a record raised with its violation; a new export borrowing a baseline name into the L10 list
	// the L2 records are empty since the readout joined the canvas; the attack re-adds a retired edge twice and records it
	// at 2, above the frozen ceiling of 1 -- a record raised with its violation
	{ id: 'A9', rule: 'L2', edits: [{ file: 'lab/src/root.js', append: "\nimport('../../app/src/palette.js');\nimport('../../app/src/palette.js');\n" },
		{ file: MAN, replace: ["\tL2: {\n\t},", "\tL2: {\n\t\t'lab/src/root.js -> app/src/palette.js': 2,\n\t},"] }] },
	{ id: 'A14', rule: 'L10', edits: [{ file: 'planner/log.mjs', append: '\nexport const check = () => 0;\n' },
		{ file: MAN, replace: ["'rebuild-debt': ['LOG_HARD_MAX', 'LOG_MAX'],", "'rebuild-debt': ['LOG_HARD_MAX', 'LOG_MAX', 'check'],"] }] },
	// the second alternative of the id grammar
	// A6c RETIRED by H17.22 N-a: it widened the id grammar's literal in planner/validate.js, and there is no literal now --
	// each kind's row carries its id check. Its attack, a sixth kind the product's grammar accepts, is caught by
	// tests/txn.test.js PL-5 and tests/spec.test.js B104, which hold the product's composition to exactly five rows each
	// accepting only its own kind (planted and caught when the literal went).
	// a core barrel forwarding network code, and one forwarding simulation code under a listed name
	// K2c: with the barrels gone, a core module that starts forwarding network code IS a new barrel, so it fails L4 too
	// RESTATED at H21.8 (B341): model/invariants.mjs is core now, so A5 forwards from plugins/network/link-rules.mjs
	{ id: 'A5', rule: 'L2', also: ['L4'], edits: [{ file: 'model/limits.mjs', append: "export { splitAtBend } from '../plugins/network/link-rules.mjs';\n" }] },
	/*
	K2a: the second edit is gone. It existed only to keep L10 quiet -- `model/index.mjs` was in the
	planner's unused list, so a new re-export there needed listing too, or the mutant would have
	failed two rules and `fails` asserts exactly one. K2a took every barrel out of the planner
	closure, so the barrel is no longer listed and the re-export alone is the mutant.
	*/
	{ id: 'A5b', rule: 'L2', also: ['L4'], edits: [{ file: 'model/limits.mjs', append: "export { moversAt } from '../plugins/simulation/movers.mjs';\n" }] },
	// a rule primitive taken from a namespace, and from import(), by destructuring
	{ id: 'A12a', rule: 'L9', edits: [{ file: 'app/src/selection.js', append: "\nimport * as __inv from '../../model/invariants.mjs';\nconst { collapseAtWaypoint: __cw } = __inv;\n" }] },
	{ id: 'A12c', rule: 'L9', edits: [{ file: 'app/src/selection.js', append: "\nexport async function __a12() { const m = await import('../../model/invariants.mjs'); const { collapseAtWaypoint } = m; return collapseAtWaypoint; }\n" }] },
	// the host by its other names, and by an escaped name
	{ id: 'A7a', rule: 'L11', edits: [{ file: 'kernel/spec.mjs', append: '\nconst __host = () => self.draw;\n' }] },
	{ id: 'A7b', rule: 'L11', edits: [{ file: 'planner/txn.mjs', append: '\nconst __host = () => global.draw;\n' }] },
	{ id: 'A7d', rule: 'L11', edits: [{ file: 'kernel/spec.mjs', append: '\nconst __host = () => \\u0077indow.draw;\n' }] },
	// a regex after `)` that used to hide the import() after it
	{ id: 'A15', rule: 'L2', edits: [{ file: 'app/src/input.js', append: "\nexport async function __a15(ok, s) { if (ok) /'/.test(s); const m = await import(\"../../plugins/simulation/movers.mjs\"); if (ok) /'/.test(s); return m.moversAt; }\n" }] },
	// loading outside import: createRequire, a .cjs shim, an inline module script
	{ id: 'A18', rule: 'L2', edits: [{ file: 'planner/txn.mjs', append: "\nimport { createRequire } from 'node:module';\nconst __req = createRequire(import.meta.url);\nconst __lazy = () => __req('./store.js');\n" }] },
	{ id: 'A13b', rule: 'L1', edits: [{ file: 'server/helper.cjs', create: "module.exports = require('./origin.mjs');\n" },
		{ file: 'planner/txn.mjs', append: "\nimport __helper from './helper.cjs';\n" }] },
	{ id: 'A17', rule: 'L6', edits: [{ file: 'app/index.html', replace: ['<script type="module" src="/src/main.js"></script>', '<script type="module" src="/src/main.js"></script>\n\t\t<script type="module">import(\'/engine/situation.mjs\');</script>'] }] },
	// a module listed under a second layer, where its window read would go uncounted
	{ id: 'A23', rule: 'L1', edits: [{ file: MAN, replace: ["'app/src/main.js',       // the production composition root", "'app/src/selection.js', 'app/src/main.js',       // the production composition root"] },
		{ file: 'app/src/selection.js', append: '\nconst __h = () => window.draw;\n' }] },
	// U3 (H21.7): L7k scans the lab too, not only PRODUCT_LAYERS
	{ id: 'U3', rule: 'L7k', edits: [{ file: 'lab/src/root.js', append: "\nconst __u3 = ['nodes', 'waypoints', 'links', 'zones', 'groups'];\n" }] },
	/*
	H26.1 (SNAP-GRID.md section 7.6) -- L6 admits exactly one inline script: the import map inside its generated region (the generator's
	--check holds what it says, tools/import-map.mjs). A second map in the region, one outside it, a map whose markers are gone, and an
	inline module beside the map are each refused. Read from the page as written: no node_modules in the copy, none needed.
	*/
	{ id: 'IM1', rule: 'L6', needle: /app\/index\.html:\d+ an import map outside the generated region, or a second one/, edits: [{ file: 'app/index.html', replace: ['</script>\n\t\t<!-- END GENERATED: importmap -->', '</script>\n\t\t<script type="importmap">{ "imports": {} }</script>\n\t\t<!-- END GENERATED: importmap -->'] }] },
	{ id: 'IM2', rule: 'L6', needle: /lab\/index\.html:\d+ an import map outside the generated region, or a second one/, edits: [{ file: 'lab/index.html', replace: ['</body>', '\t<script type="importmap">{ "imports": {} }</script>\n\t</body>'] }] },
	{ id: 'IM3', rule: 'L6', needle: /app\/index\.html:\d+ an import map outside the generated region, or a second one/, edits: [{ file: 'app/index.html', replace: ['\t\t<!-- END GENERATED: importmap -->\n', ''] }] },
	{ id: 'IM5', rule: 'L6', needle: /app\/index\.html:\d+ an import map outside the generated region, or a second one/, edits: [{ file: 'app/index.html', replace: ['\t\t<script type="importmap">\n', '\t\t<script type="importmap" data-typed="by hand">\n'] }] },
	{ id: 'IM4', rule: 'L6', needle: /lab\/index\.html:\d+ an inline <script> is code no entry declares/, edits: [{ file: 'lab/index.html', replace: ['\t\t<script type="importmap">\n', '\t\t<script type="module">import \'/src/early.js\';</script>\n\t\t<script type="importmap">\n'] }] },
	/*
	H26.1 (SNAP-GRID.md section 7.7, D7) -- L12: a component is imported by the parts COMPONENTS names alone, the package and its subpaths
	alike, and never by a dynamic import, anywhere -- the whole of a component's graph loads with the page. An @apnex/ dependency with
	no entry in COMPONENTS is refused, so a component cannot arrive without saying who may import it.
	*/
	{ id: 'C1', rule: 'L12', needle: /model\/model\.mjs:\d+ import '@apnex\/snap-grid' -- part document may not import the component @apnex\/snap-grid/, edits: [{ file: 'model/model.mjs', append: "\nimport { openGrid as __og } from '@apnex/snap-grid';\n" }] },
	{ id: 'C2', rule: 'L12', needle: /plugins\/zones\/zone-keys\.mjs:\d+ import '@apnex\/snap-grid\/conformance' -- part zones may not import the component @apnex\/snap-grid/, edits: [{ file: 'plugins/zones/zone-keys.mjs', append: "\nimport { checkGridShape as __k } from '@apnex/snap-grid/conformance';\n" }] },
	{ id: 'C3', rule: 'L12', needle: /kernel\/geometry\.mjs:\d+ import\('@apnex\/snap-grid'\) -- a component is imported statically \(D7\)/, edits: [{ file: 'kernel/geometry.mjs', append: "\nconst __d7 = async () => (await import('@apnex/snap-grid')).openGrid;\n" }] },
	{ id: 'C4', rule: 'L12', needle: /tools\/__d7\.mjs:\d+ import\('@apnex\/snap-grid\/conformance'\) -- a component is imported statically \(D7\)/, edits: [{ file: 'tools/__d7.mjs', create: "#!/usr/bin/env node\nconst __d7 = async () => (await import('@apnex/snap-grid/conformance')).checkGridShape;\n" }] },
	{ id: 'C5', rule: 'L12', needle: /package\.json depends on @apnex\/other, which COMPONENTS does not declare/, edits: [{ file: 'package.json', replace: ['"ws": "^8.21.0"', '"@apnex/other": "https://example.invalid/other.tgz",\n\t\t"ws": "^8.21.0"'] }] },
	// H26-19 as amended: a devDependency is the tests' tooling and never ships, so a module of a folder that ships may not import it
	{ id: 'DV1', rule: 'L12', needle: /kernel\/geometry\.mjs:\d+ import '@apnex\/dev-only' -- @apnex\/dev-only is a devDependency, the tests' tooling, which never ships/,
		edits: [DEV_ONLY, { file: 'kernel/geometry.mjs', append: "\nimport { tool as __dev } from '@apnex/dev-only';\n" }] },
	{ id: 'C6', rule: 'L12', needle: /COMPONENTS declares @apnex\/snap-grid, which package\.json does not depend on/, edits: [{ file: 'package.json', replace: ['"@apnex/snap-grid": "', '"@apnex/snap-grid-renamed": "'] }] },
	{ id: 'C7', rule: 'L12', needle: /COMPONENTS\.@apnex\/snap-grid lets part latice import it, and PARTS holds no such part/, edits: [{ file: MAN, replace: ["'@apnex/snap-grid': { parts: ['lattice'],", "'@apnex/snap-grid': { parts: ['latice'],"] }] },
	/*
	H26.7 (H26-7): the frozen K0 closure keeps the paths K0 knew (RU2), and a module it dropped that moved is read where it is now
	(tools/layers.mjs MOVED). `BEND_R` is listed because engine/spawners.mjs, which the closure dropped, imports it; with that file's
	move unrecorded, its import is unreadable and the listing is refused for want of a departure.
	*/
	{ id: 'P1', rule: 'L10', needle: /kernel\/spec\.mjs:BEND_R is listed but is not in the frozen K0 baseline, no baseline symbol of that name left its module for it \(0 vacated, 1 claimed\), and its module is not one the closure dropped/,
		edits: [{ file: MAN, replace: ["'engine/spawners.mjs': 'plugins/simulation/spawners.mjs',", ''] }] },
	// H26.7: model/'s reveal module, moved to plugins/simulation/, stays on model/'s side of C9 (RULES.L3) -- reading the grid is L3's to refuse
	{ id: 'P2', rule: 'L3', needle: /plugins\/simulation\/reveal\.mjs:\d+ import '\.\.\/\.\.\/kernel\/spec\.mjs' -- kernel\/ and model\/ \(with plugins\/simulation\/reveal\.mjs\) import nothing from each other/,
		edits: [{ file: 'plugins/simulation/reveal.mjs', append: "\nimport { STD as __std } from '../../kernel/spec.mjs';\n" }] },
	/*
	H26.7 (the verifier's V2): L1 holds MOVED, through which L10 reads the frozen closure. P3 is the verifier's mutant -- a key at a
	live path the planner loads, moved to a module outside the closure, so L10 counted it departed and admitted a refused listing;
	P4 to P7 each break one of the table's rules alone.
	*/
	{ id: 'P3', rule: 'L1', needle: /MOVED names model\/limits\.mjs, which the planner loads \(model\/limits\.mjs\)/,
		edits: [{ file: MAN, replace: ["'engine/simulation.css': 'plugins/simulation/simulation.css',", "'engine/simulation.css': 'plugins/simulation/simulation.css', 'model/limits.mjs': 'app/src/main.js',"] }] },
	{ id: 'P4', rule: 'L1', needle: /MOVED names app\/src\/main\.js, which is in the tree -- a moved path is gone from its old place/,
		edits: [{ file: MAN, replace: ["'engine/simulation.css': 'plugins/simulation/simulation.css',", "'engine/simulation.css': 'plugins/simulation/simulation.css', 'app/src/main.js': 'app/src/main.js',"] }] },
	{ id: 'P5', rule: 'L1', needle: /MOVED moves engine\/kinds\.mjs to plugins\/simulation\/kind\.mjs, which is not in the tree/,
		edits: [{ file: MAN, replace: ["'engine/kinds.mjs': 'plugins/simulation/kinds.mjs',", "'engine/kinds.mjs': 'plugins/simulation/kind.mjs',"] }] },
	{ id: 'P6', rule: 'L1', needle: /MOVED moves engine\/kinds\.mjs to plugins\/simulation\/rules\.mjs, another file name -- a move keeps the name/,
		edits: [{ file: MAN, replace: ["'engine/kinds.mjs': 'plugins/simulation/kinds.mjs',", "'engine/kinds.mjs': 'plugins/simulation/rules.mjs',"] }] },
	{ id: 'P7', rule: 'L1', needle: /MOVED moves zones\/ to plugins\/zones\/zone-kind\.mjs -- a folder moves to a folder, a file to a file/,
		edits: [{ file: MAN, replace: ["'zones/': 'plugins/zones/',", "'zones/': 'plugins/zones/zone-kind.mjs',"] }] },
	// and each half of that rule alone: a folder written without its slash, and a file written with one
	{ id: 'P8', rule: 'L1', needle: /MOVED moves zones\/ to plugins\/zones -- a folder moves to a folder, a file to a file/,
		edits: [{ file: MAN, replace: ["'zones/': 'plugins/zones/',", "'zones/': 'plugins/zones',"] }] },
	{ id: 'P9', rule: 'L1', needle: /MOVED moves zones\/ to plugins\/zones\/zone-kind\.mjs\/ -- a folder moves to a folder, a file to a file/,
		edits: [{ file: MAN, replace: ["'zones/': 'plugins/zones/',", "'zones/': 'plugins/zones/zone-kind.mjs/',"] }] },
	/*
	H26.7's second verification (R2-1): a scanner's list reaches every path MOVED took out of a folder it names, and scan-writers' names
	a module for that alone. P10 is the verifier's narrowing, model/ to one of its files, which origin/main refused; P11 adds a module
	beside its folder; P12 drops the reveal module, which model/ held; P13 drops the simulation's folder from scan-dead's method scope,
	which engine/ and model/ held for it.
	*/
	{ id: 'P10', rule: 'L1', needle: /SCANNER_ROOTS\.writers names model\/ops\.mjs, which is not a folder in FOLDERS, nor a module MOVED took out of a folder the list names/,
		edits: [{ file: MAN, replace: ["writers: ['server', 'planner', 'model', 'plugins/simulation/reveal.mjs'],", "writers: ['server', 'planner', 'model/ops.mjs', 'plugins/simulation/reveal.mjs'],"] }] },
	{ id: 'P11', rule: 'L1', needle: /SCANNER_ROOTS\.writers names model\/ops\.mjs, which is not a folder in FOLDERS, nor a module MOVED took out/,
		edits: [{ file: MAN, replace: ["writers: ['server', 'planner', 'model', 'plugins/simulation/reveal.mjs'],", "writers: ['server', 'planner', 'model', 'model/ops.mjs', 'plugins/simulation/reveal.mjs'],"] }] },
	{ id: 'P12', rule: 'L1', needle: /SCANNER_ROOTS\.writers no longer reaches plugins\/simulation\/reveal\.mjs, which MOVED took out of a folder it names/,
		edits: [{ file: MAN, replace: ["writers: ['server', 'planner', 'model', 'plugins/simulation/reveal.mjs'],", "writers: ['server', 'planner', 'model'],"] }] },
	{ id: 'P13', rule: 'L1', needle: /SCANNER_ROOTS\.deadMethods no longer reaches plugins\/simulation\/kinds\.mjs, which MOVED took out of a folder it names/,
		edits: [{ file: MAN, replace: ["deadMethods: ['server', 'planner', 'model', 'engine', 'kernel', 'plugins/simulation'],", "deadMethods: ['server', 'planner', 'model', 'engine', 'kernel'],"] }] },
	/*
	H26.3's verification (V6): L4's one named exception, RULES.L4.verbatim -- a verbatim copy and its shims. V1 drops the entries, and the
	shims are barrels again; V2 has another test module import a shim; V3 has a shim declare a name of its own; V4 one import a module; V5
	names a product module as a copy; V6 names a shim the copy does not import; V7 cites an id nothing holds, in a copy holding the records
	the cites resolve against; V8 names a file that is no module; V9 names no shim.
	RESTATED at H26.5 (dev/design/components/RELEASES-0.2.md section 4): against a fixture of their own -- VERBATIM, a copy and two shims
	each run plants with its entry -- since the capture oracle they were written against left with the parity mode it served.
	*/
	{ id: 'V1', rule: 'L4', needle: /barrel tests\/fixtures\/verbatim-falsifier\/pick\.js: 1, recorded 0 -- RISE/, edits: [...VERBATIM, { file: MAN, replace: ["L4: { verbatim: [", "L4: { verbatim: [] || ["] }] },
	{ id: 'V2', rule: 'L4', needle: /tests\/__v2\.mjs -> tests\/fixtures\/verbatim-falsifier\/pick\.js: 1, recorded 0 -- RISE/,
		edits: [...VERBATIM, { file: 'tests/__v2.mjs', create: "import { hitWith } from './fixtures/verbatim-falsifier/pick.js';\nexport const __v2 = hitWith;\n" }] },
	{ id: 'V3', rule: 'L4', needle: /tests\/fixtures\/verbatim-falsifier\/pick\.js is no shim/, edits: [...VERBATIM, { file: `${VF}/pick.js`, append: 'export const extra = 1;\n' }] },
	{ id: 'V4', rule: 'L4', needle: /tests\/fixtures\/verbatim-falsifier\/painter\.js is no shim/, edits: [...VERBATIM, { file: `${VF}/painter.js`, append: "import '../../../app/src/pick.js';\n" }] },
	{ id: 'V5', rule: 'L4', needle: /names app\/src\/capture\.js, a module of layer canvas -- a verbatim copy and its shims are tests' alone/,
		edits: [...VERBATIM, { file: MAN, replace: [`{ copy: '${VF}/copy.js',`, "{ copy: 'app/src/capture.js',"] }] },
	{ id: 'V6', rule: 'L4', needle: /tests\/fixtures\/verbatim-falsifier\/copy\.js imports no tests\/fixtures\/verbatim-falsifier\/stray\.js -- a stale shim/,
		edits: [...VERBATIM, { file: `${VF}/stray.js`, create: "export { hitWith } from '../../../app/src/pick.js';\n" },
			{ file: MAN, replace: [`'${VF}/pick.js'], cites:`, `'${VF}/pick.js', '${VF}/stray.js'], cites:`] }] },
	// and an entry naming a file that is no module, or no shim at all
	{ id: 'V8', rule: 'L4', needle: /names tests\/fixtures\/verbatim-falsifier\/gone\.js, which is not a module in the scan/,
		edits: [...VERBATIM, { file: MAN, replace: [`'${VF}/pick.js'], cites:`, `'${VF}/pick.js', '${VF}/gone.js'], cites:`] }] },
	{ id: 'V9', rule: 'L4', needle: /RULES\.L4\.verbatim tests\/fixtures\/verbatim-falsifier\/copy\.js names no shim/,
		edits: [...VERBATIM, { file: MAN, replace: [`shims: ['${VF}/painter.js', '${VF}/pick.js'],`, 'shims: [],'] }] },
];

/*
The controls beside the mutants: edits that must PASS the scan, so a rule that refused everything would be seen. H26.1 L12: the lattice
imports the component, the package and a subpath, and a test may too -- tools and tests are no part, and may import any layer.
*/
export const CONTROLS = [
	{ id: 'C0', edits: [{ file: 'kernel/geometry.mjs', append: "\nimport { openGrid as __og } from '@apnex/snap-grid';\n" },
		{ file: 'kernel/spec.mjs', append: "\nimport { checkGridShape as __k } from '@apnex/snap-grid/conformance';\n" },
		{ file: 'tests/__c0.test.js', create: "import { openGrid } from '@apnex/snap-grid';\nexport const __c0 = openGrid;\n" }] },
	// H26-19 as amended: an @apnex/ devDependency is no component -- COMPONENTS declares none -- and a test and a tool may import it
	{ id: 'DV0', edits: [DEV_ONLY, { file: 'tests/__dv0.test.js', create: "import { tool } from '@apnex/dev-only';\nexport const __dv0 = tool;\n" },
		{ file: 'tools/__dv0.mjs', create: "#!/usr/bin/env node\nimport { tool } from '@apnex/dev-only';\nexport const __dv0 = tool;\n" }] },
];

// a copy of the tree scan-layers reads: every folder it scans and the pages it names (the mutants below each run in one)
export const copyTree = (to) => {
	for (const f of FOLDERS) {
		fs.cpSync(path.join(root, f.dir), path.join(to, f.dir), {
			recursive: true, filter: (src) => !(f.skip ?? []).some((s) => src === path.join(root, s) || src.startsWith(path.join(root, s) + path.sep)),
		});
	}
	for (const f of ['package.json', ...Object.keys(PAGES)]) fs.cpSync(path.join(root, f), path.join(to, f));
};

export const scanOwn = (dir) => new Promise((done) => {
	execFile('node', [path.join(dir, 'tools/scan-layers.mjs')], { encoding: 'utf8' }, (err, stdout, stderr) => done({ out: stdout + stderr, code: err ? err.code : 0 }));
});


/*
Each run on its own copy of the unmutated control, which must pass first, or every verdict would be measuring something else; every
edit must land; a mutant must fail its rule (and any `also`) for its own reason, a control must pass. Shared by the record-free runs
(tests/scan-layers-mutants.test.js) and the runs that copy the records in (tests/scan-layers.test.js).
*/
export async function runMutants(base, list) {
	copyTree(path.join(base, 'control'));
	const control = await scanOwn(path.join(base, 'control'));
	assert.equal(control.code, 0, `the unmutated copy must pass before any mutant is read:\n${control.out}`);
	const runs = list.map((m) => {
		const dir = path.join(base, m.id);
		fs.cpSync(path.join(base, 'control'), dir, { recursive: true });
		for (const e of m.edits) {
			const p = path.join(dir, e.file);
			const before = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
			if (e.replace) assert.ok(before?.includes(e.replace[0]), `${m.id} is INVALID: its needle is gone from ${e.file}`);
			const after = e.create ?? (e.append ? before + e.append : before.replace(e.replace[0], () => e.replace[1]));
			fs.mkdirSync(path.dirname(p), { recursive: true });   // H26.3 (V6): a created file may sit in a folder the copy lacks
			fs.writeFileSync(p, after);
			assert.notEqual(fs.readFileSync(p, 'utf8'), before, `${m.id} did not land in ${e.file}`);
		}
		return scanOwn(dir).then((r) => ({ m, r }));
	});
	for (const { m, r } of await Promise.all(runs)) {
		if (!m.rule) { assert.equal(r.code, 0, `${m.id}, a control, must pass:\n${r.out}`); continue; }
		assert.equal(r.code, 1, `${m.id} was not caught:\n${r.out}`);
		for (const rule of [m.rule, ...(m.also ?? [])]) assert.ok(failed(r.out).includes(rule), `${m.id} must fail ${rule}; it failed ${failed(r.out).join(', ')}:\n${r.out}`);
		if (m.needle) assert.match(r.out, m.needle, `${m.id} must be refused for its own reason`);
	}
}
