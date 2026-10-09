/*
C-f (H19.34; dev/design/unification/CANVAS-PLUGINS.md section 6, acceptance 2: "app/src/ names no plugin's kind beyond a record
that may only fall") -- THE CANVAS NAMES NO PLUGIN'S KIND, BEYOND THE RECORD; AND IT IMPORTS NO PLUGIN, BEYOND THE RECORD.

A plugin brings its kind onto the page as a canvas part (C-a to C-e): what it draws, how it is picked and placed, its handles,
presses, keys and edits, how it reads and what a selection lights. What a canvas module still names is recorded here, by file,
each with its reason, and a count may only fall:
  - the draw-a-link gesture -- the product's shared gesture, the network its judge (D2): its name, its stops and route, the
    facts its judge reads, and the builders of its commit;
  - the clone's naming of a copy -- a device by its type (B187);
  - the composition roots, which compose plugins by design: the page (app/src/main.js), its run-mode list (app/src/run-mode.js),
    and the canvas's own, which attaches the relations index (the occupancy index, the network's rung; R3);
  - two of the simulation's page pieces that live in the canvas folder: the movers and the reveal;
  - the label of the edit a refused drag keeps -- its pipes (`withJudged`).
"Names a kind" is a quoted plugin kind word, or a class selector for one written in a string; "imports a plugin" is an import of
a module a plugin owns -- its folder (devices, network, zones, groups) or, for engine/, the layer manifest's simulation and
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
const KIND_WORD = /'(zones?|groups?|links?|pipes?)'|'[^'\n]*\.(zone|group|link|pipe)\b[^'\n]*'/g;
const PLUGIN_FOLDERS = ['devices', 'network', 'zones', 'groups'];
const pluginOf = (p) => (PLUGIN_FOLDERS.includes(p.split('/')[0]) ? p.split('/')[0] : ['simulation', 'network'].find((l) => (LAYER[l] ?? []).includes(p)) ?? null);
const pluginImports = (file, text) => [...text.matchAll(/^import [^;]*? from '([^']+)'/gm)]
	.map((m) => path.normalize(path.join(path.dirname(file), m[1]))).filter((p) => pluginOf(p));
const canvasModules = () => fs.readdirSync(path.join(root, 'app/src')).filter((f) => f.endsWith('.js')).map((f) => `app/src/${f}`).sort();

// file -> [count, reason]; a count may only fall, and a file not here holds none
const KIND_RECORD = {
	'app/src/commands.js': [8, 'the draw-a-link gesture\'s commit builders -- `routeLink`, `routeLinks`, `chainHop` (D2) -- and the label of the pipes a refused drag keeps'],
	'app/src/input.js': [7, 'the draw-a-link gesture\'s name, the product\'s shared gesture with the network as its judge (D2)'],
	'app/src/recognize.js': [2, 'the press row that opens the draw-a-link gesture, and its gesture name (D2)'],
	'app/src/keymap.js': [1, 'the product\'s `w`, a stop of the draw-a-link gesture (D2)'],
};
const IMPORT_RECORD = {
	'app/src/input.js': [8, 'the draw-a-link gesture (D2): its route, its stops and the facts its judge reads -- the network\'s queries and rules, the situation it reads, the waypoint a stop places'],
	'app/src/commands.js': [2, 'the clone\'s naming of a copy -- a device by its type, a waypoint by its drawn word (B187)'],
	'app/src/main.js': [2, 'the page\'s composition root: it composes the network into the page, as product/ composes the kinds'],
	'app/src/run-mode.js': [2, 'the product page\'s run-mode list: the simulation\'s spawner and tower, the devices plugin\'s panel rows (H17-D7)'],
	'app/src/compose-canvas.js': [1, 'the relations index -- the occupancy index, on the network\'s rung -- attached at the composition root (R3)'],
	'app/src/movers.js': [3, 'the simulation\'s movers, a page piece of the simulation living in the canvas folder'],
	'app/src/reveal.js': [1, 'the simulation\'s reveal, likewise'],
};

test('C-f: no canvas module names a plugin\'s kind or imports a plugin, beyond the record', () => {
	for (const [measure, record, what] of [[(f, t) => (t.match(KIND_WORD) ?? []).length, KIND_RECORD, 'names a plugin\'s kind'],
		[(f, t) => pluginImports(f, t).length, IMPORT_RECORD, 'imports a plugin']]) {
		const seen = {};
		for (const f of canvasModules()) { const n = measure(f, code(f)); if (n) seen[f] = n; }
		for (const [f, n] of Object.entries(seen)) {
			assert.ok(record[f], `${f} ${what} ${n} time(s) and is not recorded -- a plugin brings it as a canvas part instead`);
			assert.ok(n <= record[f][0], `${f}: ${n}, recorded ${record[f][0]} -- RISE`);
			assert.equal(n, record[f][0], `${f}: ${n}, recorded ${record[f][0]} -- FALL: lower the record in this commit, so the progress is written down`);
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
