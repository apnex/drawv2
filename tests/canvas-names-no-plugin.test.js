/*
C-f (H19.34; dev/design/unification/CANVAS-PLUGINS.md section 6, acceptance 2: "app/src/ names no plugin's kind beyond a record
that may only fall") -- THE CANVAS NAMES NO PLUGIN'S KIND, BEYOND THE RECORD; AND IT IMPORTS NO PLUGIN, BEYOND THE RECORD.

A plugin brings its kind onto the page as a canvas part (C-a to C-e): what it draws, how it is picked and placed, its handles,
presses, keys and edits, how it reads and what a selection lights. What a canvas module still names is recorded here, by file,
each with its reason, and a count may only fall:
  - the draw-a-link gesture -- the product's shared gesture, the network its judge (D2): its name, its stops and route, the
    facts its judge reads, and the builders of its commit (held as B328);
  - the drawn word of what the canvas creates -- a device by its type, for the create label and a clone's name (B187);
  - the composition roots, which compose plugins by design: the page (app/src/main.js), its run-mode list (app/src/run-mode.js),
    and the canvas's own, which attaches the relations index (the occupancy index, the network's rung; R3);
  - two of the simulation's page pieces that live in the canvas folder: the movers and the reveal (held as B329);
  - the label of the edit a refused drag keeps -- its pipes (`withJudged`).
"Names a kind" is a quoted plugin kind word, or a class selector for one written in a string; "imports a plugin" is an import of
a module a plugin owns -- its folder (devices, network, zones, groups, layouts) or, for engine/, the layer manifest's simulation and
network lists. The core's anchor (`node`, `ANCHOR_KINDS`, `BARE_KIND`) is the core's to name; the drawn word `waypoint` has its
own ratchet (tests/bare-anchor.test.js).
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { LAYER } from '../tools/layers.mjs';

const root = path.resolve(import.meta.dirname, '..');
const code = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
// AMENDED WD-b2 (H19.46): the layouts plugin's kind and folder too -- the canvas draws its grids through a part, naming neither
const KIND_WORD = /'(zones?|groups?|links?|pipes?|layouts?)'|'[^'\n]*\.(zone|group|link|pipe|layout)\b[^'\n]*'/g;
const PLUGIN_FOLDERS = ['devices', 'network', 'zones', 'groups', 'layouts'];
const pluginOf = (p) => (PLUGIN_FOLDERS.includes(p.split('/')[0]) ? p.split('/')[0] : ['simulation', 'network'].find((l) => (LAYER[l] ?? []).includes(p)) ?? null);
const pluginImports = (file, text) => [...text.matchAll(/^import [^;]*? from '([^']+)'/gm)]
	.map((m) => path.normalize(path.join(path.dirname(file), m[1]))).filter((p) => pluginOf(p));
const canvasModules = () => fs.readdirSync(path.join(root, 'app/src')).filter((f) => f.endsWith('.js')).map((f) => `app/src/${f}`).sort();

/*
file -> { count, reason, cites, trigger }; a count may only fall, and a file not here holds none.
AMENDED H21.5 (R-b; dev/design/unification/RECORD-GUARDS.md section 3.3): each entry names the ids its reason cites and when it
ends -- `permanent`, a WHEN expression, or the condition in words -- and every cited id must resolve (tools/exceptions.mjs).
*/
const D2_LINK = 'a second plugin must judge or extend a link drag (B328)';
const KIND_RECORD = {
	'app/src/commands.js': { count: 8, cites: ['D2', 'B328'], trigger: D2_LINK,
		reason: 'the draw-a-link gesture\'s commit builders -- `routeLink`, `routeLinks`, `chainHop` -- and the label of the pipes a refused drag keeps' },
	'app/src/input.js': { count: 7, cites: ['D2', 'B328'], trigger: D2_LINK,
		reason: 'the draw-a-link gesture\'s name, the product\'s shared gesture with the network as its judge' },
	'app/src/recognize.js': { count: 2, cites: ['D2', 'B328'], trigger: D2_LINK,
		reason: 'the press row that opens the draw-a-link gesture, and its gesture name' },
	'app/src/keymap.js': { count: 1, cites: ['D2', 'B328'], trigger: D2_LINK,
		reason: 'the product\'s `w`, a stop of the draw-a-link gesture' },
};
const IMPORT_RECORD = {
	'app/src/input.js': { count: 8, cites: ['D2', 'B328'], trigger: D2_LINK,
		reason: 'the draw-a-link gesture: its route, its stops and the facts its judge reads -- the network\'s queries and rules, the situation it reads, the waypoint a stop places' },
	'app/src/commands.js': { count: 2, cites: ['from B187'],
		reason: 'the drawn word of what the canvas creates -- a device by its type, a waypoint by its word (the rule B187 gave) -- for the create label and a clone\'s name',
		trigger: 'the canvas names what it creates through its parts, as it names what it edits (`labels.wordOf`)' },
	'app/src/main.js': { count: 2, cites: [], trigger: 'permanent',
		reason: 'the page\'s composition root: it composes the network into the page, as product/ composes the kinds -- a composition root composes plugins by design' },
	'app/src/run-mode.js': { count: 2, cites: ['H17-D7'], trigger: 'permanent',
		reason: 'the product page\'s run-mode list: the simulation\'s spawner and tower, the devices plugin\'s panel rows -- the product\'s composition' },
	'app/src/compose-canvas.js': { count: 1, cites: ['B332'], trigger: 'the canvas takes the network as a generic plugin, not a slot of its own (B332, H21.8)',
		reason: 'the relations index -- the occupancy index, on the network\'s rung -- attached at the composition root' },
	'app/src/movers.js': { count: 3, cites: ['B329'], trigger: 'WHEN: `absent app/src/movers.js and absent app/src/reveal.js`',
		reason: 'the simulation\'s movers, a page piece of the simulation living in the canvas folder' },
	'app/src/reveal.js': { count: 1, cites: ['B329'], trigger: 'WHEN: `absent app/src/movers.js and absent app/src/reveal.js`',
		reason: 'the simulation\'s reveal, likewise' },
};

test('C-f: no canvas module names a plugin\'s kind or imports a plugin, beyond the record', () => {
	for (const [measure, record, what] of [[(f, t) => (t.match(KIND_WORD) ?? []).length, KIND_RECORD, 'names a plugin\'s kind'],
		[(f, t) => pluginImports(f, t).length, IMPORT_RECORD, 'imports a plugin']]) {
		const seen = {};
		for (const f of canvasModules()) { const n = measure(f, code(f)); if (n) seen[f] = n; }
		for (const [f, n] of Object.entries(seen)) {
			assert.ok(record[f], `${f} ${what} ${n} time(s) and is not recorded -- a plugin brings it as a canvas part instead`);
			assert.ok(n <= record[f].count, `${f}: ${n}, recorded ${record[f].count} -- RISE`);
			assert.equal(n, record[f].count, `${f}: ${n}, recorded ${record[f].count} -- FALL: lower the record in this commit, so the progress is written down`);
		}
		for (const f of Object.keys(record)) assert.ok(seen[f], `${f} is recorded but ${what} no more -- remove it`);
	}
});

test('C-f: the measures see what they are for -- a kind word, a selector string, an import from a plugin\'s folder or the simulation', () => {
	const words = (t) => (t.match(KIND_WORD) ?? []).length;
	assert.equal(words("const k = 'zone'; const s = 'g.link-hit'; const n = 'node'; const w = 'waypoint';"), 2, 'zone and the link selector; the core\'s node and the drawn word are not');
	assert.deepEqual(pluginImports('app/src/x.js', "import { a } from '../../zones/zone-keys.mjs';\nimport { b } from '../../engine/spawn-runs.mjs';\nimport { c } from '../../model/model.mjs';\nimport { d } from './snap.js';"),
		['zones/zone-keys.mjs', 'engine/spawn-runs.mjs']);
});

// H21.5 (R-b): every entry's cited ids resolve and every entry says when it ends (tools/exceptions.mjs)
test('H21.5: the canvas ratchet\'s exceptions cite live work and say when they end', async () => {
	const { exceptionFaults } = await import('../tools/exceptions.mjs');
	const entries = [...Object.entries(KIND_RECORD).map(([f, e]) => ({ where: `KIND_RECORD ${f}`, ...e })),
		...Object.entries(IMPORT_RECORD).map(([f, e]) => ({ where: `IMPORT_RECORD ${f}`, ...e }))];
	assert.deepEqual(exceptionFaults(entries, root), []);
});

