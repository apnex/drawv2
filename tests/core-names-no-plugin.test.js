/*
O-d (H19.22; dev/design/unification/KINDS-AS-PLUGINS.md; O1, O3, O4) -- THE CORE AND THE PLANNER NAME NO KIND BUT THE ANCHOR, AND
THE PRODUCT'S COMPOSITION IS ITS OWN.

The arc's exit, as O4 restated it: "The core holds only the anchor". Zones, groups, devices, spawners and the network are
plugins composed onto it or beside it, and the product composes them in one place (product/kinds.mjs) -- not in the planner,
which composes nothing and imports no plugin, and not in a reader (O-b1). The anchor's storage row is the core's; its checks
read the grid, which model/ may not import (C9), so the product composes them onto it, as the planner did.

What still names a plugin's kind in a core module is recorded below, each with its reason, and may only fall:
  - (model/model.mjs's link methods were recorded here until K13d, H19.25, moved them to the network);
  - the kernel's drawing words for a zone and a group, and its drawing of a device's frame and content regions -- the
    canvas's half of B280, which B308 designs (O3).
And one plugin field is read below the plugins, the occupancy index's `span` (engine/relations.mjs `cellsOf`), the network's
rung, not the core's: a wide device's footprint until B282 makes it several anchors (O4; section 16.3, corrected).
AMENDED WD-a (H19.44; WD1, WD2 revisited): ended -- a wide device is one anchor and the index keys it by its own cell, so no
module below the plugins reads `span` (held by tests/wide-devices.test.js).
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CORE_KINDS } from '../model/shape.mjs';
import { ALLOWED, LAYER } from '../tools/layers.mjs';

const root = path.resolve(import.meta.dirname, '..');
const code = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const PLUGIN_KIND = /'(zones?|groups?|links?|pipes?)'/g;
const DEVICE_FIELD = /\.(type|shape|span|content|spawn)\b/g;
const coreModules = () => LAYER.core;
const plannerModules = () => fs.readdirSync(path.join(root, 'planner')).filter((f) => /\.m?js$/.test(f)).map((f) => `planner/${f}`);

// file -> [count, reason]; a count may only fall, and a file not here holds none
const RECORD = {
	// model/model.mjs's 7 -- its link methods -- went to the network at K13d (H19.25, network/link-queries.mjs)
	'kernel/geometry.mjs': [5, 'the canvas\'s zone grid and the zone and group drawing elements -- B308, the canvas\'s half'],
};
// and the device fields a core module reads, the same way
const DEVICE_RECORD = {
	'kernel/renderer.mjs': [3, 'the canvas\'s frame and content-region drawing primitives (`shape`, `content`) -- B308, the canvas\'s half'],
};

test('O-d: the product composes layout, node, zone, group, link, pipe from the core\'s anchor and the plugins, in product/kinds.mjs', async () => {
	const { productKinds } = await import('../product/kinds.mjs');
	const { NETWORK_ROWS } = await import('../network/kinds.mjs');
	const k = productKinds(...NETWORK_ROWS);
// RESTATED at WD-b1 (H19.45; WD6): the layouts plugin's kind is composed first -- a document lists its grids before what sits on them
	assert.deepEqual(k.list, ['layout', 'node', 'zone', 'group', 'link', 'pipe']);
	assert.equal(k.checked, true);
});

test('O-d: the core holds the anchor\'s storage row alone; its checks are composed by the product, since they read the grid (C9)', async () => {
	assert.deepEqual(CORE_KINDS.list, ['node']);
	assert.equal(CORE_KINDS.checked, false, 'model/ may not import the grid (kernel/), so the core\'s row carries storage facts only');
	const { productKinds } = await import('../product/kinds.mjs');
	const node = productKinds().row('node');
	assert.deepEqual(Object.keys(node.fields).filter((f) => productKinds().contributed('node', f) === null).sort(), ['id', 'name', 'order', 'x', 'y'], 'the anchor\'s own fields');
	assert.equal(typeof node.cap, 'number');
});

test('O-d: the planner composes nothing and imports no plugin', () => {
	assert.equal(fs.existsSync(path.join(root, 'planner/kinds.mjs')), false, 'the product\'s composition left the planner');
	assert.equal(fs.existsSync(path.join(root, 'planner/policy.mjs')), false, 'and the cap arithmetic it held went with the kinds it capped');
	assert.deepEqual(ALLOWED.planner, ['core', 'network', 'planner'], 'the planner may import the core, the network\'s rung and itself');
	for (const f of plannerModules()) assert.doesNotMatch(code(f), /from '\.\.\/(zones|groups|devices|product|engine)\//, `${f} imports a plugin`);
	assert.equal(ALLOWED.cli.includes('planner'), false, 'the CLI\'s interim allowance is gone: it reads with the product\'s composition');
});

test('O-d: no core or planner module names a plugin\'s kind or reads a device\'s field, beyond the record', () => {
	for (const [pattern, record, what] of [[PLUGIN_KIND, RECORD, 'names a plugin\'s kind'], [DEVICE_FIELD, DEVICE_RECORD, 'reads a device\'s field']]) {
		const seen = {};
		for (const f of [...coreModules(), ...plannerModules()]) {
			const n = (code(f).match(pattern) ?? []).length;
			if (n) seen[f] = n;
		}
		for (const [f, n] of Object.entries(seen)) {
			assert.ok(record[f], `${f} ${what} ${n} time(s) and is not recorded`);
			assert.ok(n <= record[f][0], `${f}: ${n}, recorded ${record[f][0]} -- RISE`);
			assert.equal(n, record[f][0], `${f}: ${n}, recorded ${record[f][0]} -- FALL: lower the record in this commit`);
		}
		for (const f of Object.keys(record)) assert.ok(seen[f], `${f} is recorded but ${what} no more -- remove it`);
	}
});
