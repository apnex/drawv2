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
    AMENDED 2026-10-11 (H21, U0): B280 and B308 are closed; what remains is the export door's (B330, held) and the zone
    lattice's name in `LAYOUTS` (B325); the frame and content primitives are the devices plugin's painter's too.
    AMENDED H26.1 (dev/design/components/SNAP-GRID.md section 7.7): the zone lattice's name left the kernel with `LAYOUTS`.
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
import { ALLOWED, FOLDERS, LAYER, PRODUCT_LAYERS } from '../tools/layers.mjs';

const root = path.resolve(import.meta.dirname, '..');
const code = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
// AMENDED U3 (H21.7): every quoting form ('...', "...", `...`), object keys, collection properties (.zones, ...), layout(s),
// and .transit and .glyph; and the remaining product layers, cross-plugin reads, and device type names outside a type's declaration
const PLUGIN_KIND = /(['"`])(zones?|groups?|links?|pipes?|layouts?)\1|\.(zones|groups|links|pipes|layouts)\b(?!\s*\()|(?:^|[{,])\s*(zones?|groups?|links?|pipes?|layouts?)\s*:(?!\s*(?:v\.group|['"`](?:Context|Lifecycle|Writing|Placement|Awareness|Access)['"`]))/gm;
const DEVICE_FIELD = /(?<!\b(?:evt|event|labels\??))\.(type|shape|span|content|spawn|transit|glyph)\b(?!\s*\(|\s*===\s*['"`](?:up|move|down|double|cancel)['"`])/g;
const UNAMBIG_TYPE = /(['"`])(loadbalancer|firewall|vxlan|router)\1|\b(loadbalancer|firewall|vxlan|router)\s*:|\.(loadbalancer|firewall|vxlan|router)\b|glyph-(loadbalancer|firewall|vxlan|router|host|server)\b|GLYPH_BB\.(host|server)\b/g;
const HOST_SERVER_TYPE = /(['"`])(host|server)\1|\b(host|server)\s*:/g;
const deviceTypesIn = (text) => text.split('\n').flatMap((line) => {
	const u = [...line.matchAll(UNAMBIG_TYPE)].map((m) => m[0]);
	const hs = (u.length > 0 || /\b(?:type|glyph)\b[^;\n]*?(?:[:=]|\|\|)|\bmakeNode\s*\(|\b(?:host|server)\s*:\s*Object\.freeze\(/.test(line))
		? [...line.matchAll(HOST_SERVER_TYPE)].map((m) => m[0]) : [];
	return [...u, ...hs];
});

const walk = (d, skip = []) => fs.readdirSync(path.join(root, d), { withFileTypes: true }).flatMap((e) => {
	const p = path.posix.join(d, e.name);
	if (skip.some((s) => p.startsWith(s))) return [];
	return e.isDirectory() ? walk(p, skip) : /\.m?js$/.test(e.name) ? [p] : [];
});
const allLayerOf = () => {
	const map = {};
	for (const [l, files] of Object.entries(LAYER)) for (const f of files) map[f] = l;
	for (const f of FOLDERS) if (f.layer && !['tools', 'tests'].includes(f.layer)) for (const m of walk(f.dir, f.skip ?? [])) map[m] = f.layer;
	return map;
};
const PLUGIN_FOLDERS = ['layouts', 'devices', 'network', 'zones', 'groups'];
const ownerPlugin = (f) => (PLUGIN_FOLDERS.includes(f.split('/')[0]) ? f.split('/')[0] : (LAYER.simulation ?? []).includes(f) ? 'simulation' : null);
const KIND_OWNER = { layout: 'layouts', layouts: 'layouts', zone: 'zones', zones: 'zones', group: 'groups', groups: 'groups', link: 'network', links: 'network', pipe: 'network', pipes: 'network' };
const FIELD_OWNER = { type: 'devices', shape: 'devices', span: 'devices', content: 'devices', glyph: 'devices', transit: 'network', spawn: 'simulation' };
const foreignKindsIn = (f, text) => {
	const own = ownerPlugin(f);
	return [...text.matchAll(PLUGIN_KIND)].map((m) => m[2] || m[3] || m[4]).filter((k) => KIND_OWNER[k] !== own);
};
const foreignFieldsIn = (f, text) => {
	const own = ownerPlugin(f);
	return [...text.matchAll(DEVICE_FIELD)].map((m) => m[1]).filter((k) => FIELD_OWNER[k] !== own);
};

const coreModules = () => LAYER.core;
const plannerModules = () => fs.readdirSync(path.join(root, 'planner')).filter((f) => /\.m?js$/.test(f)).map((f) => `planner/${f}`);

// file -> { count, reason, cites, trigger }; a count may only fall (AMENDED H21.5, R-b: cites resolve, a trigger says when it ends)
const RECORD = {
	// model/model.mjs's 7 -- its link methods -- went to the network at K13d (H19.25, network/link-queries.mjs)
	// RESTATED at H25.5 (B378, D4): the declarative scene helpers `zone`, `group` and `bboxOf` retired with the old scene renderer
	// H26.1 (SNAP-GRID.md section 7.7, appendix B): kernel/geometry.mjs's 4 fell to none -- the zone lattice's offset left for the layouts
	// table and an anchor's layout name for the layouts plugin's `anchorOn` (layouts/layout-records.mjs), with `LAYOUTS` and `anchorAt`
	'kernel/spec.mjs': { count: 2, cites: ['B325'],
		reason: 'the `group:` and `zone:` layout constants in `STD`',
		trigger: 'a diagram varies its grids (B325)' },
};
// and the plugin fields a core or planner module reads, the same way
// H25.5 (B378, D4): empty -- kernel/geometry.mjs's `node()` retired with the old scene renderer
const DEVICE_RECORD = {
};

// U3 (H21.7): every remaining non-canvas product module (`export`, `server-only`, `serve`, `cli`, `lab`, `simulation`, `product`,
// and cross-plugin kind/field reads across `layouts`, `devices`, `network`, `zones`, `groups`, plus `LAYER.network` outside `network/`)
const PRODUCT_KIND_RECORD = {
	'cli/verbs.mjs': { count: 138, cites: ['from B138'],
		reason: 'the CLI\'s standalone verbs over every collection and kind (B138)',
		trigger: 'permanent' },
	'engine/situation.mjs': { count: 2, cites: ['D2'],
		reason: 'the pointer situation naming `link` for the draw-a-link gesture and a selected link (D2)',
		trigger: 'permanent' },
	'engine/spawners.mjs': { count: 2, cites: ['SD11b'],
		reason: 'a spawner record and its movers report naming the `link` its movers ride along (SD11b)',
		trigger: 'permanent' },
	'lab/server.mjs': { count: 3, cites: ['O1', 'WD6'],
		reason: 'the lab static server mounting `/layouts/`, `/zones/` and `/groups/` for the browser',
		trigger: 'permanent' },
	// RESTATED at H25.4 (B376): the layer ids went to product/canvas.mjs CANVAS_LAYERS, which the lab spreads into `NEEDED`
	'lab/src/root.js': { count: 2, cites: ['H17-D1'],
		reason: 'the lab composition root seeding its board\'s pipes (`board.pipes`) and counting them (`model.all(\'pipe\')`)',
		trigger: 'permanent' },
	'layouts/layout-canvas.mjs': { count: 1, cites: ['WD6', 'B325'],
		reason: 'the layouts plugin\'s canvas part naming the `zone` grid record (`layout-000002`, WD6)',
		trigger: 'a diagram varies its grids (B325)' },
	'layouts/layout-table.mjs': { count: 1, cites: ['WD6', 'B325'],
		reason: 'the default `zone` layout record (`layout-000002`) every diagram holds (WD6)',
		trigger: 'a diagram varies its grids (B325)' },
	'product/canvas.mjs': { count: 4, cites: ['H25.4'],
		reason: 'the canvas\'s layers back to front (`CANVAS_LAYERS`): the composition names the layer each plugin draws into -- moved from the lab\'s `NEEDED` and the two pages (H25.4)',
		trigger: 'each canvas part declares where its own layer stacks, so the composition names none' },
	// RAISED at H26.1 (SNAP-GRID.md appendix B, section 7.7), from kernel/geometry.mjs's record, which fell from 4 to none: placement
	// maps snap-grid's positions back to the anchor it answered, `{ layout, cx, cy, x, y }`, consuming the lattice alone, so the node
	// layout's `layout:` the kernel's `anchorAt` stamped is stamped here
	'server/anchor.mjs': { count: 2, cites: ['SD1', 'B325'],
		reason: 'server-side placement resolving `at.inside` against the diagram\'s zones (SD1), and the `layout:` its anchors carry (B325)',
		trigger: 'permanent' },
	'server/app.js': { count: 3, cites: ['O1', 'WD6'],
		reason: 'the product server mounting `/layouts`, `/zones` and `/groups` for the browser',
		trigger: 'permanent' },
	'server/rest.js': { count: 23, cites: ['SD1'],
		reason: 'the REST door\'s per-kind routes, entity summaries, and creation shortcuts',
		trigger: 'the REST door dispatches per-kind routes and summaries through the composition\'s rows' },
	'server/seed.js': { count: 9, cites: ['SD2'],
		reason: 'the seed diagram\'s initial zones, groups, links and pipes',
		trigger: 'permanent' },
	'zones/zone-painter.mjs': { count: 1, cites: ['WD6'],
		reason: 'the zone place row\'s `layout: \'zone\'` key, naming which layout record a zone snaps to (WD6)',
		trigger: 'permanent' },
};

const PRODUCT_FIELD_RECORD = {
	'cli/verbs.mjs': { count: 36, cites: ['from B138'],
		reason: 'the CLI\'s standalone verbs reading `.type`, `.shape`, `.span`, `.content`, `.transit`, `.spawn` and `.glyph` on wire payloads (B138)',
		trigger: 'permanent' },
};

// U3 (H21.7): device type names (`host`, `server`, `loadbalancer`, `firewall`, `vxlan`, `router`) across every product layer
const TYPE_NAME_RECORD = {
	'devices/device-types.mjs': { count: 6, cites: ['U4-1', 'U4-2', 'U4-3'],
		reason: 'the one device-type declaration table (`DEVICE_TYPES`): `host`, `server`, `loadbalancer`, `firewall`, `vxlan`, `router` (U4-1, U4-2, U4-3)',
		trigger: 'permanent' },
	'server/seed.js': { count: 8, cites: ['SD2'],
		reason: 'the seed diagram\'s eight devices (`host`, `router`, `firewall`, `loadbalancer`, three `server`, `vxlan`)',
		trigger: 'permanent' },
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
	// RESTATED at H21.8 (B332, B341): model/invariants.mjs is in core, so the planner imports the core and itself alone
	assert.deepEqual(ALLOWED.planner, ['core', 'planner'], 'the planner may import the core and itself alone');
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
			assert.ok(n <= record[f].count, `${f}: ${n}, recorded ${record[f].count} -- RISE`);
			assert.equal(n, record[f].count, `${f}: ${n}, recorded ${record[f].count} -- FALL: lower the record in this commit`);
		}
		for (const f of Object.keys(record)) assert.ok(seen[f], `${f} is recorded but ${what} no more -- remove it`);
	}
});

// U3 (H21.7): every remaining product layer, cross-plugin reads, and device type names outside a type's declaration
test('U3 (H21.7): no product layer goes unscanned -- foreign kinds, foreign fields and device type names equal their records across every product layer', () => {
	const layerMap = allLayerOf();
	const allProductModules = Object.keys(layerMap).sort();
	const coreAndPlanner = new Set([...coreModules(), ...plannerModules()]);
	const canvasAndChrome = new Set(fs.readdirSync(path.join(root, 'app/src')).filter((f) => f.endsWith('.js')).map((f) => `app/src/${f}`));
	const remainingModules = allProductModules.filter((f) => !coreAndPlanner.has(f) && !canvasAndChrome.has(f));

	// 1. Completeness: the union of core+planner, canvas+chrome, and remainingModules is 100% of product modules across all product layers + lab
	const coveredLayers = new Set([...coreAndPlanner, ...canvasAndChrome, ...remainingModules].map((f) => layerMap[f]));
	for (const l of [...PRODUCT_LAYERS, 'lab']) assert.ok(coveredLayers.has(l), `product layer ${l} is unscanned`);
	assert.equal(coreAndPlanner.size + canvasAndChrome.size + remainingModules.length, allProductModules.length, 'every product module is scanned');

	// 2. Foreign kind words and foreign plugin fields across all remaining product modules (including cross-plugin reads)
	for (const [measure, record, what] of [
		[(f, t) => foreignKindsIn(f, t).length, PRODUCT_KIND_RECORD, 'names a foreign plugin\'s kind'],
		[(f, t) => foreignFieldsIn(f, t).length, PRODUCT_FIELD_RECORD, 'reads a foreign plugin\'s field'],
	]) {
		const seen = {};
		for (const f of remainingModules) { const n = measure(f, code(f)); if (n) seen[f] = n; }
		for (const [f, n] of Object.entries(seen)) {
			assert.ok(record[f], `${f} ${what} ${n} time(s) and is not recorded`);
			assert.ok(n <= record[f].count, `${f}: ${n}, recorded ${record[f].count} -- RISE`);
			assert.equal(n, record[f].count, `${f}: ${n}, recorded ${record[f].count} -- FALL: lower the record in this commit`);
		}
		for (const f of Object.keys(record)) assert.ok(seen[f], `${f} is recorded but ${what} no more -- remove it`);
	}

	// 3. Device type names across EVERY product module (all 16 product layers including lab)
	const seenTypes = {};
	for (const f of allProductModules) { const n = deviceTypesIn(code(f)).length; if (n) seenTypes[f] = n; }
	for (const [f, n] of Object.entries(seenTypes)) {
		assert.ok(TYPE_NAME_RECORD[f], `${f} names a device type ${n} time(s) and is not recorded`);
		assert.ok(n <= TYPE_NAME_RECORD[f].count, `${f}: ${n}, recorded ${TYPE_NAME_RECORD[f].count} -- RISE`);
		assert.equal(n, TYPE_NAME_RECORD[f].count, `${f}: ${n}, recorded ${TYPE_NAME_RECORD[f].count} -- FALL: lower the record in this commit`);
	}
	for (const f of Object.keys(TYPE_NAME_RECORD)) assert.ok(seenTypes[f], `${f} is recorded in TYPE_NAME_RECORD but names no device type -- remove it`);
});

test('U3 (H21.7): the widened measures see every quoting form, object keys, collection properties, cross-plugin reads, and device type names', () => {
	assert.deepEqual(foreignKindsIn('server/x.js', "const a = 'zone'; const b = \"groups\"; const c = `pipe`; const d = doc.layouts; const o = { links: 1 };"),
		['zone', 'groups', 'pipe', 'layouts', 'links']);
	assert.deepEqual(foreignKindsIn('zones/x.mjs', "const own = 'zone'; const foreign = 'link';"), ['link'], 'a plugin may name its own kind, not another\'s');
	assert.deepEqual(foreignFieldsIn('network/x.mjs', "const own = e.transit; const foreign = e.type + e.span;"), ['type', 'span'], 'a plugin may read its own field, not another\'s');
	assert.deepEqual(deviceTypesIn("const a = 'router'; const b = \"firewall\"; const c = `vxlan`; const o = { loadbalancer: 1 }; const g = GLYPH_BB.host; const id = 'glyph-server';\nconst t = { type: 'host', glyph: \"server\" };\nconst ok = { host: window, by: 'server' };"),
		["'router'", '"firewall"', '`vxlan`', 'loadbalancer:', 'GLYPH_BB.host', 'glyph-server', "'host'", '"server"']);
});

// H21.5 (R-b) + U3 (H21.7): every entry's cited ids resolve and every entry says when it ends (tools/exceptions.mjs)
test('H21.5: the core and product ratchets\' exceptions cite live work and say when they end', async () => {
	const { exceptionFaults } = await import('../tools/exceptions.mjs');
	const entries = [
		...Object.entries(RECORD).map(([f, e]) => ({ where: `RECORD ${f}`, ...e })),
		...Object.entries(DEVICE_RECORD).map(([f, e]) => ({ where: `DEVICE_RECORD ${f}`, ...e })),
		...Object.entries(PRODUCT_KIND_RECORD).map(([f, e]) => ({ where: `PRODUCT_KIND_RECORD ${f}`, ...e })),
		...Object.entries(PRODUCT_FIELD_RECORD).map(([f, e]) => ({ where: `PRODUCT_FIELD_RECORD ${f}`, ...e })),
		...Object.entries(TYPE_NAME_RECORD).map(([f, e]) => ({ where: `TYPE_NAME_RECORD ${f}`, ...e })),
	];
	assert.deepEqual(exceptionFaults(entries, root), []);
});

// U4 (H21.3, B282; UNIFICATION-AUDIT.md section 7): adding a seventh device type is one declaration, driving appearance,
// routing, behaviour and the records `/api/v1/types` serves
test('U4 (H21.3): adding a seventh device type in one declaration drives appearance, routing, behaviour and /types, and refuses an unknown pack', async () => {
	const { DEVICE_TYPES } = await import('../devices/device-types.mjs');
	const { composeProductTypes } = await import('../product/types.mjs');
	const { nodeOffersTransit, nodePermitsBend, transitOffersOf } = await import('../network/transit-offers.mjs');
	const { towerFor } = await import('../engine/kinds.mjs');
	try {
		const slices = composeProductTypes({
			...DEVICE_TYPES,
			sentry: Object.freeze({
				map: 'y', box: Object.freeze([-10, -10, 20, 20]), routing: 'transit', behaviour: 'tower',
				svg: '<circle r="8"/>',
			}),
		});
		assert.equal(slices.list.includes('sentry'), true, 'in the palette list');
		assert.deepEqual(slices.bb.sentry, [-10, -10, 20, 20], 'appearance glyph box');
		assert.match(slices.defs, /id="glyph-sentry"/, 'appearance glyph art in defs');
		assert.equal(nodeOffersTransit({ id: 'node-000001', type: 'sentry' }), true, 'routing pack: transit offers junction');
		assert.equal(nodePermitsBend({ id: 'node-000001', type: 'sentry' }), false, 'routing pack: transit forbids bend');
		assert.equal(nodePermitsBend({ id: 'node-000002' }), true, 'control: a bare anchor permits bend');
		assert.deepEqual(transitOffersOf({ id: 'node-000001', type: 'sentry' }), [true, false]);
		assert.deepEqual(towerFor({ id: 'node-000001', type: 'sentry' }), { range: 3, beam: 10, cooldown: 10, damage: 1 }, 'behaviour pack: tower stats');
		assert.equal(towerFor({ id: 'node-000001', type: 'router' }), null, 'control: router has no behaviour pack');
		assert.deepEqual(slices.records().find((r) => r.name === 'sentry'),
			{ name: 'sentry', map: 'y', routing: 'transit', behaviour: 'tower' }, 'served by /api/v1/types');
		assert.throws(() => composeProductTypes({ ...DEVICE_TYPES, bad: { map: 'b', box: [0, 0, 1, 1], routing: 'nope', behaviour: null, svg: '' } }),
			/names routing pack "nope"/, 'an unknown routing pack is refused at composition');
		assert.throws(() => composeProductTypes({ ...DEVICE_TYPES, bad: { map: 'b', box: [0, 0, 1, 1], routing: 'endpoint', behaviour: 'nope', svg: '' } }),
			/names behaviour pack "nope"/, 'an unknown behaviour pack is refused at composition');
	} finally {
		composeProductTypes(DEVICE_TYPES);
	}
});

