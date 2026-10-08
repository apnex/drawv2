#!/usr/bin/env node
/*
layers -- H17 K0. The layer manifest: DATA, read by `tools/scan-layers.mjs` and, for their folder
lists, by `scan-dead`, `scan-docrefs`, `scan-twins` and `scan-writers`.

A boundary lives here and nowhere else. The commit that moves a module, splits one or removes an
import edits this file in the same diff, so a reviewer sees the code and the rule move together.
Every value is plain JSON-shaped data (no functions, no regex objects) so a fixture can state a
manifest of the same shape in a `.json` file (`scan-layers --manifest`).

THE LAYERS, and what each may import (ALLOWED). The direction is the point: core knows nothing of
connection (SD11b), the planner knows nothing of the page, and nothing imports a composition root.

  core         anchors in space: the grid, spec, theme, path geometry, render primitives, the
               document store and its taxonomy
  network      the plugin of connection: link rules and references, the relation index. It lives
               in kernel/, model/ and engine/ today and gets its own folder at K13
  planner      the one write: plan, commit, undo, redo, the log, validation, group policy
  canvas       the gesture machine and everything a canvas needs to draw and edit
  chrome       the production page around the canvas: sync, network status, palette, readouts,
               the simulation painters, and the composition root itself
  simulation   movers, spawners, rules, kinds and the situation; production-only
  export       the headless SVG path
  server-only  the server's doors and storage, never served to a browser
  serve        K9: the one static responder (server/static.mjs) -- Node-side, never served to a browser, and the one
               layer both servers may import, the product's (server-only) and the lab's
  cli          the command-line tool
  lab          the lab composition root (K10); `lab/` does not exist yet
  tools, tests may import any layer, and no product layer imports them
*/

export const ALLOWED = {
	core: ['core'],
	network: ['core', 'devices', 'network'],
	zones: ['core', 'zones'],   // O-b1 (H19.19): the zones plugin -- the zone kind; it imports the core and itself
	groups: ['core', 'groups'],   // O-c (H19.20): the groups plugin -- the group kind and its rules; it imports the core and itself
	devices: ['core', 'devices'],   // O-e1 (H19.21; O4): the devices plugin -- whether a device is composed on an anchor; it imports the core and itself
	planner: ['core', 'network', 'planner'],   // O-d (H19.22): it composes nothing, so it imports no plugin
	product: ['core', 'devices', 'network', 'zones', 'groups', 'simulation', 'product'],   // C-a (D3): the network's appearances on the anchor among the product's canvas parts   // O-d (H19.22): the product's composition -- the anchor and the shipped plugins
	canvas: ['core', 'devices', 'network', 'zones', 'groups', 'planner', 'canvas'],
	chrome: ['core', 'devices', 'network', 'zones', 'groups', 'planner', 'product', 'canvas', 'simulation', 'export', 'chrome'],
	simulation: ['core', 'devices', 'network', 'simulation'],
	export: ['core', 'network', 'export'],
	'server-only': ['core', 'devices', 'network', 'zones', 'groups', 'planner', 'product', 'simulation', 'export', 'server-only', 'serve'],
	serve: [],   // K9: it imports nothing but Node's own modules
	// O-d (H19.22): the CLI's reader takes the product's composition (cli/verbs.mjs `modelOf`) from product/, so the interim
	// `planner` allowance O-b1 gave it is gone
	cli: ['core', 'devices', 'network', 'zones', 'groups', 'simulation', 'product', 'cli'],
	lab: ['core', 'devices', 'network', 'zones', 'groups', 'planner', 'product', 'canvas', 'lab', 'serve'],
	tools: ['core', 'devices', 'network', 'zones', 'groups', 'planner', 'product', 'canvas', 'chrome', 'simulation', 'export', 'server-only', 'serve', 'cli', 'tools'],
	tests: ['core', 'devices', 'network', 'zones', 'groups', 'planner', 'product', 'canvas', 'chrome', 'simulation', 'export', 'server-only', 'serve', 'cli', 'tools', 'tests'],
};

// the layers that ship: what L7k calls "the product"
export const PRODUCT_LAYERS = ['core', 'devices', 'network', 'zones', 'groups', 'product', 'planner', 'canvas', 'chrome', 'simulation', 'export', 'server-only', 'serve', 'cli'];

/*
The folders scan-layers walks. A folder with a `layer` gives every module in it that layer, so a new
test or tool needs no entry; every other folder's modules are named one by one in LAYER, so a NEW
module there fails L1 until someone decides where it belongs (review mutant M5 is caught that way).
L1 also fails on any module in the tree that sits outside every folder here and outside UNSCANNED,
which is how a new top-level folder (`planner/`, `network/`, `lab/`) is noticed rather than skipped.
*/
export const FOLDERS = [
	{ dir: 'kernel' },
	{ dir: 'engine' },
	{ dir: 'model' },
	{ dir: 'app/src' },
	{ dir: 'server' },
	{ dir: 'cli' },
	/*
	The network plugin INCUBATED here (ruled 2026-09-28). Its layer is `network`, and production is
	allowed to import that layer -- correctly, permanently -- because today the layer also names code
	inside kernel/, model/ and engine/. So the layer table cannot keep production out of THIS folder
	before promotion; `tests/scan-layers.test.js` holds that as a separate folder rule.
	AMENDED 2026-10-04 (V-a, H18.25; ruled J1): promotion made `network/` a product folder, so the separate folder rule is
	retired; the layer rules judge every edge into the `network` layer, as they judge every other.
	*/
	{ dir: 'planner', layer: 'planner' },   // K4 (H17-D5): the planner, served whole to the lab, never `server/`
	{ dir: 'network', layer: 'network' },
	{ dir: 'zones', layer: 'zones' },   // O-b1 (H19.19): the zones plugin (KINDS-AS-PLUGINS.md)
	{ dir: 'groups', layer: 'groups' },   // O-c (H19.20): the groups plugin (KINDS-AS-PLUGINS.md)
	{ dir: 'devices', layer: 'devices' },   // O-e1 (H19.21): the devices plugin (KINDS-AS-PLUGINS.md section 16)
	{ dir: 'product', layer: 'product' },   // O-d (H19.22): the product's composition
	{ dir: 'lab', layer: 'lab' },   // K10: composition only, held to that by L8
	{ dir: 'tools', layer: 'tools' },
	// the fixture trees are synthetic repositories that break these rules on purpose
	{ dir: 'tests', layer: 'tests', skip: ['tests/fixtures/layers'] },
];

export const UNSCANNED = {
	deploy: 'gitignored: how ONE instance is hosted, not part of the repository (.gitignore says why); a fresh clone has no deploy/',
};

/*
Every module in a folder without a folder layer, by path, under its layer. Placements that are not
obvious from the folder carry their reason; the rest follow the layer descriptions above. Each layer
is a list rather than one key per module so that a module listed under two layers is SEEN (L1): an
object keyed by module keeps the last of two entries silently (the attack's A23).
*/
export const LAYER = {
	core: [
		'kernel/spec.mjs', 'kernel/theme.mjs',
		'kernel/router.mjs',     // path geometry on the grid (rounded turns, snap); its `routeGeometry` name is L5p debt
		'kernel/input-rules.mjs', // the Rules engine: tenants' rows, uniform guards, one match or none (dev/RULES.md section 11); names no tenant
		'kernel/geometry.mjs',   // the grid and cell arithmetic; its link roles and appearance left for the network layer at K13a
		'kernel/renderer.mjs',   // frame and selection primitives the canvas draws with; the SVG scene half left at K11
		'model/model.mjs',       // the document store; its link methods are network debt that K13d moves at the rebuild
		'model/anchors.mjs',     // the bare anchor: how it is stored, asked in one place (F-b, H18.4; F-c, H18.5)
		// the drawn word for an anchor -- waypoint or node (F4); apart, because the planner reads none
		'model/ops.mjs', 'model/shape.mjs', 'model/limits.mjs', 'model/surface.mjs',
		'model/order.mjs',       // K15: the one derivation order, by id (B246)
		'model/stacking.mjs',    // the drawing order as readers compare it -- the canvas, the network's ages (F-d)
		'kernel/palette.mjs',    // every colour value, by name (Material, a neutral ladder, four custom); roles elsewhere name them
	],
	network: [
		// V-a (H18.25, PU22): the network's roles and appearance moved from kernel/ into network/, whose folder layer is this one
		'model/invariants.mjs',   // the document invariants the planner checks
		// S-e (H18.15): the link rules, the link reactions with `linkTenant`, and the pair capacity moved into network/ (G5)
		'engine/relations.mjs', 'engine/store.mjs',        // the maintained reverse indices over the entity graph, link incidence among them
		'engine/ivm.mjs',                                  // the index's generic mechanism; relations.mjs is its only user
		'engine/situation.mjs',  // K5: what is true right now, as a value; O-e1 (H19.21): out of the core, since it names what is under the pointer by the devices plugin's drawn word
	],
	planner: [
		// K4 (H17-D5): the planner is its own folder now, `planner/`, whose folder layer is this one (FOLDERS)
	],
	canvas: [
		'app/src/capture.js', 'app/src/changes.js', 'app/src/commands.js', 'app/src/input-state.js', 'app/src/input.js', 'app/src/keymap.js',
		'app/src/labeledit.js',  // the label editor Input drives for t, F2 and double-click; the lab loads it, and its window reads are L11's canvas ratchet
		'app/src/overlay.js', 'app/src/painter.js', 'app/src/pick.js', 'app/src/recognize.js', 'app/src/releases.js', 'app/src/renderer.js',
		'app/src/selection.js', 'app/src/snap.js', 'app/src/triggers.js',
		'app/src/actions.js',    // every action a binding names, with its label (gesture system stage 6)
		'app/src/tools.js',      // K7: the held tools -- stamp hand, text tool, the hand's ghost; the palette is a view of them
		'app/src/compose-canvas.js', // K8: the canvas half of a page, composed once for the product and the lab
		'app/src/readout.js',    // the readout line: what the cursor, a drag and the selection are -- canvas state, built by composeCanvas
	],
	chrome: [
		'app/src/main.js',       // the production composition root; nothing imports it
		'app/src/clock.js', 'app/src/net.js', 'app/src/spectate.js', 'app/src/sync.js', 'app/src/watchdog.js',
		'app/src/help.js',       // the generated help overlay (gesture system stage 6): draws what the bindings document
		'app/src/run-mode.js',   // K5: run mode's press rows, the product's feature, handed to Input by main.js
		'app/src/palette.js',    // the device palette widget; input.js reaching into it is L2 debt that K6 removes
		'app/src/movers.js', 'app/src/reveal.js', 'app/src/paintloop.js',   // the simulation's painters: production-only, outside the lab
	],
	simulation: [
		'engine/movers.mjs', 'engine/spawners.mjs', 'engine/kinds.mjs', 'engine/rules.mjs',
		'engine/spawn-field.mjs',   // O-e2 (H19.21): the spawner's field, composed onto the anchor
		'engine/spawn-appearance.mjs',   // C-a (H19.29, D3): the spawning mark, composed onto the anchor's drawing
		'model/reveal.mjs',      // the reveal beat's timing; its only product reader is the reveal painter
	],
	export: [
		'kernel/engine.mjs', 'kernel/adapt.mjs',
		'kernel/svg-scene.mjs',  // K11: a resolved scene as one SVG string, for the export door; draws network appearance, so it is not core
		'kernel/fixtures.mjs',   // the spec viewer's reference scenes
		'server/svg.mjs',        // the headless SVG door; it composes the export path and nothing else
	],
	'server-only': [
		'server/anchor.mjs',     // anchor resolution; the store passes it to the planner as its placement edge (K3, PL-4), and it stays 404 (K4)
		'server/app.js', 'server/codes.mjs', 'server/docfile.mjs', 'server/files.mjs', 'server/hub.js', 'server/identity.mjs',
		'server/locks.js', 'server/origin.mjs', 'server/protocol.js', 'server/rest.js', 'server/routes.mjs', 'server/seed.js',
		'server/server.js', 'server/sessionlog.mjs', 'server/store.js',
	],
	serve: ['server/static.mjs'],   // K9: how a file is found inside a folder and sent, for the product's server and the lab's
	cli: ['cli/draw.mjs', 'cli/verbs.mjs'],
};

/*
The composition roots whose closure is DECLARED (L6), and the names each exposes to its callers
(L10 counts those as used). The closure follows static imports, re-exports and literal `import()`.

`page` is the production page. `planner` is the planner entry: `planner/txn.mjs` does not import
`planner/log.mjs`, and the server's door imports both (`server/store.js:21-22`), so the entry has
both roots -- with txn alone, log.mjs would sit outside every L6 and L10 check. The lab root joins
at K10 (L6 hard for it, with `layers`).
*/
export const ENTRIES = {
	page: {
		roots: ['app/src/main.js'],
		modules: [
			'app/src/capture.js', 'app/src/changes.js', 'app/src/clock.js', 'app/src/commands.js', 'app/src/input-state.js', 'app/src/input.js', 'app/src/keymap.js',
			'app/src/actions.js', 'app/src/help.js', 'app/src/run-mode.js', 'app/src/labeledit.js', 'app/src/main.js', 'app/src/movers.js', 'app/src/net.js', 'app/src/overlay.js',
			'app/src/painter.js', 'app/src/paintloop.js', 'app/src/palette.js', 'app/src/pick.js', 'app/src/readout.js',
			'app/src/recognize.js', 'app/src/releases.js', 'app/src/renderer.js', 'app/src/reveal.js', 'app/src/selection.js', 'app/src/snap.js', 'app/src/triggers.js', 'app/src/tools.js', 'app/src/compose-canvas.js',
			'app/src/spectate.js', 'app/src/sync.js', 'app/src/watchdog.js', 'engine/ivm.mjs',
			'engine/kinds.mjs', 'engine/movers.mjs', 'engine/relations.mjs', 'engine/rules.mjs',
			'engine/situation.mjs', 'engine/spawners.mjs', 'engine/store.mjs', 
			'kernel/geometry.mjs', 'network/roles.mjs', 'network/appearance.mjs', 'kernel/input-rules.mjs', 'kernel/renderer.mjs', 'kernel/router.mjs',
			'kernel/spec.mjs', 'kernel/theme.mjs', 'network/link-rules.mjs', 'network/pair-capacity.mjs', 'model/limits.mjs',
			'model/model.mjs', 'model/anchors.mjs', 'model/ops.mjs', 'model/order.mjs', 'model/stacking.mjs',
			'network/kinds.mjs', 'network/pipe-kind.mjs',   // S-b (H18.12, G1): the network's rows
			// V-b (H18.26): the network, composed into the page as into the lab (network/page.mjs) -- routes, pipes, its keys and judge
			'network/page.mjs', 'network/session.mjs', 'network/network.mjs', 'network/view.mjs', 'network/resolve.mjs', 'network/pipes.mjs',
			'network/transit.mjs', 'network/link-reactions.mjs', 'network/keys.mjs', 'network/grammar.mjs', 'network/guide.mjs', 'network/host.mjs',
			// V-d (H18.28; PL-6): the planner, for the page's preview of every commit
			'planner/txn.mjs', 'planner/validate.js', 'planner/edges.mjs', 'model/invariants.mjs',
			'kernel/palette.mjs', 'model/reveal.mjs', 'model/shape.mjs', 'model/surface.mjs',
			'product/kinds.mjs',   // the product's composition (O-d): the anchor and the shipped plugins, with the network's rows
			'zones/zone-kind.mjs', 'zones/zone-extent.mjs', 'zones/make-zone.mjs',   // O-b1 (H19.19): the zones plugin -- its row, extent and factory
			'zones/zone-painter.mjs', 'product/canvas.mjs',   // C-a (H19.29): the zones plugin's painter, and the product's canvas parts
			'groups/group-painter.mjs',   // C-a (H19.29): the groups plugin's painter
			'devices/device-appearance.mjs', 'network/anchor-appearance.mjs', 'engine/spawn-appearance.mjs',   // C-a (D3): the anchor's appearances
			'network/link-painter.mjs', 'network/canvas.mjs',   // C-a (H19.29): the network's link painter and its canvas part
			'groups/group-kind.mjs', 'groups/group-rules.mjs', 'groups/make-group.mjs', 'groups/group-of.mjs',   // O-c (H19.20): the groups plugin
			'devices/device-shapes.mjs', 'devices/anchor-words.mjs', 'devices/make-node.mjs', 'devices/occupancy.mjs',   // O-e1 (H19.21): the devices plugin
			'devices/device-fields.mjs', 'engine/spawn-field.mjs',   // O-e2 (H19.21): the fields composed onto the anchor
			'network/link-queries.mjs',   // K13d (H19.25): the network's link queries, off the Model
			'network/network-queries.mjs',   // Q-a (H19.27): the network's questions over a Model, off the Model
			'network/link-kind.mjs', 'network/link-references.mjs', 'network/transit-offers.mjs',   // S-e (H18.15, G5): the network's link row and its references; H19.10 what each type offers
		],
	},
	lab: {
		roots: ['lab/src/root.js'],
		/*
		K10. The lab's closure is 46 modules, barely under the product page's 50, and that is the
		HONEST starting number rather than a disappointing one: the cuts that shrink it (K2b, K2c,
		K5, K7, K8, K11, K12) have not landed, so the canvas modules it mounts still reach the three
		barrels transitively. The lab's own imports name definers; its dependencies' do not yet.
		The plan's end state is 38 modules, and this list falls as each cut lands.
		K2b (2026-10-01): every importer reads the defining module, so the barrels and the export-only modules they
		dragged in left both closures -- the page 57 to 51 modules, the lab 65 to 55.
		*/
		modules: [
			'lab/src/root.js',
			'network/pipes.mjs',   // the network plugin (incubated from 2026-09-28; a product folder since V-a, J1)
			'network/page.mjs',    // the network composed into a page, the lab's as the product's (V-b)
			'network/pipe-kind.mjs',   // the network's pipe kind, a row of the one shape (H17.22 N-b); the lab composes it from N-c
			'network/kinds.mjs',   // the network's rows: its pipe kind and the transit field it contributes to the node (S-a)
			'network/guide.mjs',
			'network/resolve.mjs',
			'network/view.mjs',    // one derivation per board state (RULESET-AUDIT T2)
			'network/network.mjs', // the one network interface, handed to the Model and the planner (RULESET-AUDIT T1)
			'network/session.mjs', // the network's session state and the order one edit changes it in (RULESET-AUDIT T5)
			'network/keys.mjs',    // the network plugin's own key rows for the Rules engine (dev/RULES.md section 11)
			'network/grammar.mjs', // the network's drag grammar as data, read by the Rules engine (dev/RULES.md section 11)
			'network/transit.mjs', // transit: the per-type table and the session's settings (TRANSIT.md section 12)
			'network/host.mjs',    // the network attached to a page: its choreography around an edit (item 3, 2026-10-01)
			'app/src/capture.js', 'app/src/changes.js', 'app/src/commands.js', 'app/src/input-state.js', 'app/src/input.js', 'app/src/keymap.js', 'app/src/labeledit.js',
			'app/src/overlay.js', 'app/src/painter.js', 'app/src/pick.js', 'app/src/readout.js',
			'app/src/recognize.js', 'app/src/releases.js', 'app/src/renderer.js', 'app/src/selection.js', 'app/src/snap.js', 'app/src/triggers.js', 'app/src/tools.js', 'app/src/compose-canvas.js', 
			'engine/ivm.mjs', 'engine/relations.mjs',
			'engine/situation.mjs', 'engine/store.mjs', 
			'kernel/geometry.mjs', 'network/roles.mjs', 'network/appearance.mjs', 'kernel/input-rules.mjs', 'kernel/renderer.mjs',
			'kernel/router.mjs', 'kernel/spec.mjs', 'kernel/theme.mjs', 'model/invariants.mjs', 'network/link-rules.mjs', 'network/pair-capacity.mjs',
			'model/limits.mjs', 'model/model.mjs', 'model/anchors.mjs', 'model/ops.mjs', 'model/order.mjs', 'model/stacking.mjs', 'kernel/palette.mjs', 'model/shape.mjs',
			'network/link-kind.mjs', 'network/link-references.mjs', 'network/transit-offers.mjs',   // S-e (H18.15, G5): the network's link row and its references; H19.10 what each type offers
			'model/surface.mjs', 'product/kinds.mjs', 'planner/log.mjs', 'planner/txn.mjs', 'planner/validate.js',
			'network/link-reactions.mjs',
			'planner/edges.mjs',   // the planner's edges (PL-4)
			'zones/zone-kind.mjs', 'zones/zone-extent.mjs', 'zones/make-zone.mjs',   // O-b1 (H19.19): the zones plugin -- its row, extent and factory
			'zones/zone-painter.mjs', 'product/canvas.mjs',   // C-a (H19.29): the zones plugin's painter, and the product's canvas parts
			'groups/group-painter.mjs',   // C-a (H19.29): the groups plugin's painter
			'devices/device-appearance.mjs', 'network/anchor-appearance.mjs', 'engine/spawn-appearance.mjs',   // C-a (D3): the anchor's appearances
			'network/link-painter.mjs', 'network/canvas.mjs',   // C-a (H19.29): the network's link painter and its canvas part
			'groups/group-kind.mjs', 'groups/group-rules.mjs', 'groups/make-group.mjs', 'groups/group-of.mjs',   // O-c (H19.20): the groups plugin
			'devices/device-shapes.mjs', 'devices/anchor-words.mjs', 'devices/make-node.mjs', 'devices/occupancy.mjs',   // O-e1 (H19.21): the devices plugin
			'devices/device-fields.mjs', 'engine/spawn-field.mjs',   // O-e2 (H19.21): the fields composed onto the anchor
			'network/link-queries.mjs',   // K13d (H19.25): the network's link queries, off the Model
			'network/network-queries.mjs',   // Q-a (H19.27): the network's questions over a Model, off the Model
		],
	},
	planner: {
		/*
		S-f (H18.16): `planner/kinds.mjs` was a root -- the product's composition, which every composition imports.
		AMENDED 2026-10-08 (O-d, H19.22): it left the planner for product/kinds.mjs, and the planner's own modules import no plugin
		(tests/core-names-no-plugin.test.js). The entry keeps the composition as a root -- the planner and the kinds it is handed,
		as a composition loads them -- so its closure is what it was.
		*/
		roots: ['planner/txn.mjs', 'planner/log.mjs', 'product/kinds.mjs'],
		// `productKinds`: the kinds a composition hands plan and commit, the product's and a plugin's rows (H17.22 N-c)
		surface: { 'planner/txn.mjs': ['plan', 'commit', 'undo', 'redo', 'PHASES'], 'planner/log.mjs': ['Log'], 'product/kinds.mjs': ['productKinds'] },
		modules: [
			'kernel/geometry.mjs', 'kernel/spec.mjs',
			'model/invariants.mjs', 'model/limits.mjs', 'model/model.mjs', 'model/anchors.mjs', 'model/ops.mjs', 'model/order.mjs',
			'model/shape.mjs', 'model/surface.mjs', 'product/kinds.mjs', 'planner/log.mjs', 'planner/txn.mjs', 'planner/validate.js',
			// S-e (H18.15): the planner loads no network module -- the link's references and its straight-pair invariant are the
			// network's row's, handed in with the composition; model/referential.mjs and the pair capacity left its closure
			'planner/edges.mjs',   // the planner's edges (PL-4)
			'zones/zone-kind.mjs', 'zones/zone-extent.mjs',   // O-b1 (H19.19): the zones plugin's row and extent, composed by productKinds; its factory is not loaded
			'groups/group-kind.mjs', 'groups/group-rules.mjs',   // O-c (H19.20): the groups plugin's row and rules; its factory and lookup are not loaded
			'devices/device-fields.mjs', 'engine/spawn-field.mjs',   // O-e2 (H19.21): the device's and the spawner's fields, composed onto the anchor
		],
	},
};

/*
The pages in the tree that load scripts, and the entry each one starts. L6 reads every HTML file: a
page not listed here may carry no script at all, and a listed page's script tags must be exactly
`scripts`, which, resolved against `base` (the folder the site root serves: `server/app.js` serves
the client from app/), must be exactly its entry's roots. An inline script, an inline handler or a
`javascript:` URL is refused outright -- code the page runs that no entry declares.
*/
export const PAGES = {
	'app/index.html': { base: 'app', entry: 'page', scripts: ['/src/main.js'] },
	'lab/index.html': { base: 'lab', entry: 'lab', scripts: ['/src/root.js'] },
};

/*
Per-rule configuration. The scanner owns what a rule MEANS; this says what it applies to.
*/
export const RULES = {
	/*
	The layers that load code by `import` alone. In them the scan refuses every other loader --
	`require`, `createRequire`, `getBuiltinModule`, `eval`, `Function`, `node:module`, `node:vm` --
	and any string, template or regex literal holding import-shaped text, which is either code built
	from a string or a line the tokenizer misread; each hides an edge. Tools and tests are exempt:
	they quote imports in their literals on purpose, and the scanner itself reads node:module.
	*/
	L2: { plain: [...PRODUCT_LAYERS, 'lab'] },
	// C9, as the H17 plan states it: kernel/ and model/ import nothing from each other
	L3: { folders: ['kernel', 'model'] },
	/*
	Both halves are PROXIES for "the core has no notion of connection" (C3): they read names, not
	meaning. `names` is the fixed list the design measured; `pattern` catches a new name the list
	never heard of (review mutant M3, `linkLength`), and says nothing about a link rule named `foo`.
	*/
	L5: {
		layers: ['core'],
		names: ['waypointRole', 'waypointRoles', 'linkFacing', 'linkMarker', 'linkAppearance', 'APPEARANCE_KEYS', 'samePlane', 'linkDash',
			'linkWidth', 'CONTROL_WEIGHT', 'DASH_ON', 'DASH_OFF', 'waypointStyle', 'waypointAnchor', 'waypointJunction', 'waypointLayers',
			'linksOf', 'linksAt', 'linkBetween', 'linksBetween', 'endpointOf', 'pathOf', 'makeLink', 'makeWaypoint', 'junction', 'port', 'path'],
		pattern: 'link|waypoint|route|facing|marker|plane|pipe|flow|junction|via',
	},
	// no module listed in `batch` is reachable from a product root. Empty until the stored-format batch (K17)
	L7: { roots: ['app/src/main.js', 'server/server.js', 'cli/draw.mjs'], batch: [] },
	/*
	The product's kind lists: every top-level `KINDS = [...]` in a product module must equal `kinds`
	exactly, and so must the id grammar's alternation (C3) once the non-entity ids it also accepts
	(`others`) are set aside. Every OTHER line naming all five kinds is a consumer, recorded per file
	in RATCHETS.L7k. That half is a PROXY: it reads a line at a time, so a list split across lines is
	not seen, and it holds each file to a count of such lines rather than to the five.
	*/
	L7k: {
		// F-c (H18.5, P-10): four -- a waypoint is a node with no type
		// S-e (H18.15, G5): three -- the link is the network's kind (network/link-kind.mjs), composed by composing the network
		// O-b1 (H19.19, O1): two -- the zone is the zones plugin's (zones/zone-kind.mjs)
		// O-c (H19.20, O3): one -- the group is the groups plugin's (groups/group-kind.mjs)
		kinds: ['node'],
		/*
		AMENDED by H17.22 N-a (ruled 2026-10-02, amending C3): the id grammar is no longer a literal. Each kind's row carries
		its id check and planner/validate.js builds the grammar from the composition's rows, so there is no regex here to
		pin. What C3 held -- the product's grammar accepts exactly its five kinds -- is held by behaviour instead: the product
		composes exactly `kinds`, and each row accepts its own kind's id and no other's (tests/txn.test.js PL-5,
		tests/spec.test.js B104). The check below stays for any literal grammar a file declares again.
		*/
		grammar: [],
	},
	// `lab/` is composition only. The line budget is declared by K10 with the lab; until then there is no lab to hold to it
	/*
	K10 declared the budget with the lab. MEASURED at 107 code lines across the root and the static
	server, and set at 120 -- the measurement plus a little, not a round number chosen in advance.
	The first guess was 60, which the lab exceeded before it did anything, and that is worth keeping:
	a budget invented before the thing exists measures the guesser rather than the code.

	It is a CEILING on composition, so it should fall as cuts land, not rise. A cut that needs more
	than this is a cut putting logic in the lab, which L8 also bars by refusing an export or a class.

	RAISED to 150 when the fixed boards landed, and the raise is argued rather than assumed. The
	boards are DATA -- four literal op lists -- not logic: they define no rule, and every one is
	applied through the planner, so a board that would not validate is refused exactly as a bad
	edit is. They also cannot be split into a second file, because L8 bars a lab module from
	importing another lab module; the lab is one composition, and that rule is right. So the
	choice was a larger budget or no fixed boards, and a gesture question answered on whatever the
	author happened to draw is not answered at all.
	*/
	/*
	RAISED again, 150 to 180, when the lab began composing the network incubator. What grew is the
	pipe painter (a dozen lines drawing pipes beneath links) and each board's pipe list. The
	painter is composition -- it reads the pipe set and emits elements, defining no rule -- and the
	pipe lists are data. The routing itself lives in network/, which is where the budget should
	NOT be spent: if this ceiling keeps rising, that is the signal something that belongs in the
	incubator is being written in the lab instead.
	*/
	/*
	LOWERED, 180 to 120, when the network's choreography left the lab for network/host.mjs (item 3, 2026-10-02). Both raises
	are spent elsewhere now: the boards are data in lab/seeds.json, and the pipe painter is the attached network's. MEASURED
	at 100 code lines across the root and the static server; 120 is K10's own ceiling, the measurement plus a little again.
	*/
	L8: { dir: 'lab', budget: 120 },
	/*
	A PROXY for criterion 5 (browser restatements of planner rules): it sees a browser module reach
	for a rule's code, and misses a rule re-typed by hand. It reads 2 while the three restated rules
	remain (C10). The H17 plan names the canvas; chrome and the lab run in the same page and read 0
	today, so they are held to the same line.
	*/
	L9: {
		layers: ['canvas', 'chrome', 'lab'],
		primitives: { splitAtBend: 'network/link-rules.mjs', collapseAtWaypoint: 'network/link-rules.mjs', violations: 'model/invariants.mjs', groupAfterRemoval: 'groups/group-rules.mjs' },
	},
	// C2(d): the only two tags, and the layers whose imports make "serves-a-server-door" true
	L10: { tags: ['rebuild-debt', 'serves-a-server-door'], doors: ['server-only'] },
	/*
	Hard in core, network and planner (they take their host by injection); a per-file ratchet in the
	canvas. A host read is `window`, `globalThis`, `self` or `global`, escapes decoded. PROXY: `top`,
	`parent` and `frames` also reach the window, but they are ordinary local names here too
	(planner/log.mjs binds `top`) and the scanner does not resolve scopes, so they are not read.
	*/
	L11: { hard: ['core', 'network', 'planner'], ratchet: ['canvas'] },
};

/*
Today's violations, per site. The scan fails unless each measurement EQUALS its record: a rise is a
new violation, and a fall is progress that must be written down here in the commit that makes it.
When a rule's record empties, delete its keys; the rule stays.

  L2   `importer -> definer`: edges against ALLOWED, judged through barrels, re-exports included.
       K6 removes the palette edge, K5 the situation edge, K3 the anchor edge, and K2c the simulation
       barrel's re-export of the planner's group policy (engine/index.mjs -> planner/policy.mjs)
  L4   `barrel <file>`, one count per name each barrel re-exports (so a barrel that grows is a
       rise), and `importer -> barrel` per import site, static and dynamic. The review counted 125
       lines; 2 of them are kernel/README.md:29 and a comment in kernel/index.mjs:4, so 123 are code:
       81 static and 42 dynamic. K2a-K2c empty it
  L5   `module:name` from RULES.L5.names; L5p from its pattern. Every L5 name and 14 of the 15 L5p
       names are exports of kernel/geometry.mjs, which K13a splits; the fifteenth is routeGeometry
       in kernel/router.mjs. Model's link methods are not exports, so L5 does not see them (K13d)
  L7k  consumer lines per file (see RULES.L7k)
  L9   `module:primitive`: none since V-d -- the browser previews with the planner (PL-6)
  L11  window/globalThis reads per canvas module: the label editor's three
*/

export const RATCHETS = {
	L2: {
	},
	L4: {
		// K2c (2026-10-01): the barrels are deleted, so no barrel import or re-export remains; L4 holds the line at zero
	},
	L5: {
	},
	L5p: {
		'kernel/router.mjs:routeGeometry': 1,
	},
	L7k: {
		// PL-5 lowered model/model.mjs, server/rest.js, server/store.js and planner/validate.js to 0: they read model/shape.mjs
		// F-c (H18.5) lowered cli/verbs.mjs from 11: the waypoint collection left the lists that named all the kinds
		'cli/verbs.mjs': 7,
		'kernel/adapt.mjs': 2,
	},
	// L9 is empty: V-c (H18.27) lowered app/src/input.js:splitAtBend, V-d (H18.28) app/src/commands.js:groupAfterRemoval --
	// the browser keeps no copy of a planner rule; it previews with the planner (PL-6). The rule stays.
	L9: {
	},
	L11: {
		'app/src/labeledit.js': 3,
	},
};

/*
The ratchets as K0 froze them: the most each record may ever say. The scan fails a record above its
ceiling, or a key the ceiling does not hold, so a new violation cannot be excused by raising its
record (the attack's A9). Only a FALL moves RATCHETS; this list does not move at all -- its hash is
pinned in tests/scan-layers.test.js, so widening it means editing that test in the same diff, where
a reviewer sees it. A violation that moves with its module (K4 moves server/ files to planner/) has
a new key, and that commit edits this list and the pinned hash together, deliberately.
*/
/*
K10 ADDED ONE KEY TO THE FROZEN CEILING, and that needs saying rather than slipping through.

The ceiling was frozen at K0 so a ratchet can only fall. The PLAN allows a key to MOVE with its
module; this is not that -- `lab/` did not exist at K0, so its one legal edge (lab -> canvas, for
the readout) has no frozen entry to inherit. A new folder cannot be expressed as a fall.

The guarantee is kept where it matters: no EXISTING key rose, the new key is at 1, and the lab
cannot reach anything the layer direction forbids because L2 still judges every edge. The pinned
sha256 in tests/scan-layers.test.js is updated in this same commit, which is what puts the change
in front of a reviewer.
*/
export const RATCHET_CEILING = {
	L2: {
		'app/src/input.js -> app/src/palette.js': 1,
		'app/src/input.js -> engine/situation.mjs': 1,
		'engine/index.mjs -> engine/policy.mjs': 1,
		'lab/src/root.js -> app/src/readout.js': 1,
		'server/txn.mjs -> server/anchor.mjs': 1,
	},
	L4: {
		'app/src/commands.js -> engine/index.mjs': 1,
		'app/src/commands.js -> model/index.mjs': 1,
		'app/src/input.js -> engine/index.mjs': 1,
		'app/src/input.js -> kernel/index.mjs': 1,
		'app/src/input.js -> model/index.mjs': 1,
		'app/src/labeledit.js -> model/index.mjs': 1,
		'app/src/main.js -> engine/index.mjs': 1,
		'app/src/main.js -> kernel/index.mjs': 1,
		'app/src/main.js -> model/index.mjs': 1,
		'app/src/movers.js -> engine/index.mjs': 1,
		'app/src/movers.js -> kernel/index.mjs': 1,
		'app/src/overlay.js -> model/index.mjs': 1,
		'app/src/painter.js -> kernel/index.mjs': 1,
		'app/src/palette.js -> kernel/index.mjs': 1,
		'app/src/readout.js -> kernel/index.mjs': 1,
		'app/src/readout.js -> model/index.mjs': 1,
		'app/src/renderer.js -> kernel/index.mjs': 1,
		'app/src/snap.js -> kernel/index.mjs': 1,
		'app/src/snap.js -> model/index.mjs': 1,
		'barrel engine/index.mjs': 26,
		'barrel kernel/index.mjs': 57,
		'barrel model/index.mjs': 11,
		'cli/verbs.mjs -> engine/index.mjs': 2,
		'cli/verbs.mjs -> model/index.mjs': 2,
		'engine/situation.mjs -> kernel/index.mjs': 1,
		'engine/spawners.mjs -> kernel/index.mjs': 1,
		'server/anchor.mjs -> kernel/index.mjs': 1,
		'server/anchor.mjs -> model/index.mjs': 1,
		'server/rest.js -> kernel/index.mjs': 1,
		'server/rest.js -> model/index.mjs': 1,
		'server/seed.js -> model/index.mjs': 1,
		'server/store.js -> engine/index.mjs': 1,
		'server/store.js -> kernel/index.mjs': 1,
		'server/store.js -> model/index.mjs': 1,
		'server/svg.mjs -> kernel/index.mjs': 1,
		'server/txn.mjs -> engine/index.mjs': 1,
		'server/txn.mjs -> kernel/index.mjs': 1,
		'server/txn.mjs -> model/index.mjs': 2,
		'server/validate.js -> kernel/index.mjs': 1,
		'server/validate.js -> model/index.mjs': 1,
		'tests/access.test.js -> model/index.mjs': 1,
		'tests/affordance.test.js -> model/index.mjs': 1,
		'tests/anchor-resolve.test.js -> model/index.mjs': 1,
		'tests/boundary.test.js -> model/index.mjs': 1,
		'tests/browser.test.js -> kernel/index.mjs': 1,
		'tests/cli-tool.test.js -> engine/index.mjs': 1,
		'tests/cli-tool.test.js -> model/index.mjs': 1,
		'tests/clock.test.js -> engine/index.mjs': 1,
		'tests/commands.test.js -> kernel/index.mjs': 2,
		'tests/commands.test.js -> model/index.mjs': 2,
		'tests/convergence.test.js -> model/index.mjs': 1,
		'tests/diff-plan.test.js -> model/index.mjs': 1,
		'tests/display.test.js -> kernel/index.mjs': 1,
		'tests/display.test.js -> model/index.mjs': 1,
		'tests/engine.test.js -> engine/index.mjs': 1,
		'tests/engine.test.js -> kernel/index.mjs': 1,
		'tests/engine.test.js -> model/index.mjs': 1,
		'tests/fixtures/client-harness.mjs -> engine/index.mjs': 1,
		'tests/fixtures/client-harness.mjs -> kernel/index.mjs': 1,
		'tests/fixtures/client-harness.mjs -> model/index.mjs': 1,
		'tests/fixtures/plan-reference.mjs -> engine/index.mjs': 1,
		'tests/grid.test.js -> kernel/index.mjs': 1,
		'tests/grid.test.js -> model/index.mjs': 1,
		'tests/history.test.js -> model/index.mjs': 1,
		'tests/model.test.js -> model/index.mjs': 1,
		'tests/movers.test.js -> engine/index.mjs': 1,
		'tests/place-rule.test.js -> engine/index.mjs': 1,
		'tests/place-rule.test.js -> model/index.mjs': 1,
		'tests/renderer.test.js -> kernel/index.mjs': 2,
		'tests/renderer.test.js -> model/index.mjs': 1,
		'tests/replay.test.js -> model/index.mjs': 1,
		'tests/replayloop.test.js -> model/index.mjs': 1,
		'tests/resume.test.js -> model/index.mjs': 1,
		'tests/reveal.test.js -> model/index.mjs': 1,
		'tests/rules.test.js -> engine/index.mjs': 1,
		'tests/rules.test.js -> model/index.mjs': 1,
		'tests/said.test.js -> model/index.mjs': 1,
		'tests/selection.test.js -> model/index.mjs': 1,
		'tests/situation.test.js -> engine/index.mjs': 1,
		'tests/situation.test.js -> kernel/index.mjs': 1,
		'tests/span.test.js -> engine/index.mjs': 1,
		'tests/span.test.js -> kernel/index.mjs': 17,
		'tests/span.test.js -> model/index.mjs': 1,
		'tests/spawn-rule.test.js -> engine/index.mjs': 1,
		'tests/spawn-rule.test.js -> model/index.mjs': 1,
		'tests/sync.test.js -> model/index.mjs': 1,
		'tests/txn.test.js -> kernel/index.mjs': 3,
		'tests/txn.test.js -> model/index.mjs': 1,
		'tests/validate.test.js -> engine/index.mjs': 1,
		'tests/validate.test.js -> kernel/index.mjs': 8,
		'tests/validate.test.js -> model/index.mjs': 5,
	},
	L5: {
		'kernel/geometry.mjs:APPEARANCE_KEYS': 1,
		'kernel/geometry.mjs:CONTROL_WEIGHT': 1,
		'kernel/geometry.mjs:DASH_OFF': 1,
		'kernel/geometry.mjs:DASH_ON': 1,
		'kernel/geometry.mjs:junction': 1,
		'kernel/geometry.mjs:linkAppearance': 1,
		'kernel/geometry.mjs:linkDash': 1,
		'kernel/geometry.mjs:linkFacing': 1,
		'kernel/geometry.mjs:linkMarker': 1,
		'kernel/geometry.mjs:linkWidth': 1,
		'kernel/geometry.mjs:path': 1,
		'kernel/geometry.mjs:port': 1,
		'kernel/geometry.mjs:samePlane': 1,
		'kernel/geometry.mjs:waypointAnchor': 1,
		'kernel/geometry.mjs:waypointJunction': 1,
		'kernel/geometry.mjs:waypointLayers': 1,
		'kernel/geometry.mjs:waypointRole': 1,
		'kernel/geometry.mjs:waypointRoles': 1,
		'kernel/geometry.mjs:waypointStyle': 1,
	},
	L5p: {
		'kernel/geometry.mjs:junction': 1,
		'kernel/geometry.mjs:linkAppearance': 1,
		'kernel/geometry.mjs:linkDash': 1,
		'kernel/geometry.mjs:linkFacing': 1,
		'kernel/geometry.mjs:linkMarker': 1,
		'kernel/geometry.mjs:linkWidth': 1,
		'kernel/geometry.mjs:samePlane': 1,
		'kernel/geometry.mjs:waypoint': 1,
		'kernel/geometry.mjs:waypointAnchor': 1,
		'kernel/geometry.mjs:waypointJunction': 1,
		'kernel/geometry.mjs:waypointLayers': 1,
		'kernel/geometry.mjs:waypointRole': 1,
		'kernel/geometry.mjs:waypointRoles': 1,
		'kernel/geometry.mjs:waypointStyle': 1,
		'kernel/router.mjs:routeGeometry': 1,
	},
	L7k: {
		'cli/verbs.mjs': 11,
		'kernel/adapt.mjs': 2,
		'model/model.mjs': 1,
		'server/rest.js': 1,
		'server/store.js': 1,
		'server/validate.js': 1,
	},
	L9: {
		'app/src/commands.js:groupAfterRemoval': 1,
		'app/src/input.js:splitAtBend': 1,
	},
	L11: {
		'app/src/labeledit.js': 3,
	},
};

/*
L10, export-level minimality (H17-D9), as condition C2 specifies it. For each named entry:

  - an export of a module in the entry's closure that nothing inside the closure imports, and that
    the entry does not expose, is UNUSED, and must be in `list`;
  - a listed name that is no longer unused (it gained a consumer, or left the closure) FAILS, so it
    leaves the list in the same commit that gives it a consumer;
  - a name may join `list` only if it is in `baseline` (the list as K0 froze it), or if it moved
    with its symbol. That half is a PROXY, because a symbol is known by its name: each baseline
    entry whose module no longer exports its name has vacated one place, and the listed entries
    outside the baseline may claim at most as many places per name as were vacated. A new export
    that only shares a baseline spelling (`check`, `render`) claims a place nobody left;
  - each listed name is tagged `rebuild-debt` (paid by the splits and the rebuild, K13d) or
    `serves-a-server-door` (a server-only module imports it, which the scan checks).

The entries are the planner entry and, from K10, the lab root. The production page and the server
are not L10 entries (C2a). `baseline` is frozen: tests/scan-layers.test.js pins its hash, so
editing it means editing that test in the same diff.

Measured at K0: the planner entry loads 31 modules exporting 241 names, 153 of them unused inside
it -- the same 153, name for name, as the brief's export-demand measurement.
*/
export const UNUSED_EXPORTS = {
	planner: {
		/*
		The planner's closure AS K0 FROZE IT, taken from `tools/layers.mjs` at f01772c. Written once and
		never edited: C2(c)'s "a consumer left the closure" is a claim about a transition, and the entry's
		`modules` list above holds only the CURRENT state, so judging a departure from it would ask the
		manifest whether the manifest is right. Frozen here, `departed` stays derivable at every later
		cut -- this list minus today's closure -- for the same reason RATCHET_CEILING is frozen rather
		than recomputed. Its sha256 is pinned in tests/scan-layers.test.js.
		*/
		k0closure: [
			'engine/index.mjs', 'engine/ivm.mjs', 'engine/kinds.mjs', 'engine/movers.mjs', 'engine/policy.mjs',
			'engine/relations.mjs', 'engine/rules.mjs', 'engine/situation.mjs', 'engine/spawners.mjs', 'engine/store.mjs',
			'kernel/adapt.mjs', 'kernel/engine.mjs', 'kernel/geometry.mjs', 'kernel/grc.mjs', 'kernel/index.mjs',
			'kernel/renderer.mjs', 'kernel/router.mjs', 'kernel/spec.mjs', 'kernel/theme.mjs', 'model/index.mjs',
			'model/invariants.mjs', 'model/limits.mjs', 'model/model.mjs', 'model/ops.mjs', 'model/referential.mjs',
			'model/shape.mjs', 'model/surface.mjs', 'server/anchor.mjs', 'server/log.mjs', 'server/txn.mjs', 'server/validate.js',
		],
		/*
		Modules the planner loads that did not EXIST at K0, so cannot be in its frozen closure: PL-3 split the reactions
		out of `planner/txn.mjs` into new files, and PL-4 its edges (dev/design/planner/PLANNER-SYSTEM.md). An arrival is not a departure and
		admits no name; a module that existed at K0 and is missing from the frozen list still fails K2a.
		*/
		// K4 moved the planner's files to `planner/`: paths K0 never knew, so arrivals too (its frozen list names their old places)
		arrived: ['network/link-reactions.mjs', 'product/kinds.mjs', 'planner/edges.mjs', 'model/order.mjs', 'planner/txn.mjs', 'planner/log.mjs', 'planner/validate.js',
			'model/anchors.mjs',   // H18.4 F-b: the bare anchor, asked in one place
			'network/pair-capacity.mjs',   // S-b: the pair rule's one home, split out of model/invariants.mjs
			'zones/zone-kind.mjs', 'zones/zone-extent.mjs',   // O-b1 (H19.19): the zones plugin's row and extent, out of the core and the planner
			'groups/group-kind.mjs', 'groups/group-rules.mjs',   // O-c (H19.20): the groups plugin's row and rules, out of the core and the planner (planner/tenants.mjs moved here)
			'devices/device-fields.mjs', 'engine/spawn-field.mjs'],   // O-e2 (H19.21): the device's and the spawner's fields, out of the planner
		/*
		Names DELETED since K0 rather than moved, by the cut and ruling that deleted them. L10 counts a baseline name its
		module no longer exports as vacated, ready for its new home to claim -- right for a move, wrong for a deletion: a
		deleted name has no home, so any new export spelled the same would take the place (mutant A14, after K12 deleted
		`check`). A retired name vacates nothing, so a later export reusing it is judged as new.
		*/
		retired: [
			// K12, 2026-10-01: the design-rule checker (ruled), its helper, and exports nothing called
			'check', 'grc', 'RULES', 'crossings', 'segmentsOf', 'cellCenter', 'layoutOf', 'oneSelected', 'onSpawner',
		],
		list: {
			'kernel/geometry.mjs': {
				'rebuild-debt': [
					'bboxOf', 'cellOf', 'cellOn',
					'cellPx', 'gridDot', 'group', 'groupHull', 'node', 'px', 'pxOn', 'snapLayout', 'spanExtent',
					'zone'
				],
				'serves-a-server-door': ['anchorAt', 'nearestAnchor'],   // anchorAt: server/anchor.mjs left the planner at PL-4, passed in by the store
			},
			'kernel/spec.mjs': {
				'rebuild-debt': ['derive', 'BEND_R'],   // BEND_R: its consumer, `path`, left geometry for network/appearance.mjs at K13a
			},
			'kernel/theme.mjs': {
				'rebuild-debt': [],
				'serves-a-server-door': [],
			},
			'model/anchors.mjs': {
				// O-e1 (H19.21): isBareEntity left for the devices plugin (devices/device-shapes.mjs), so the debt it carried here is paid
				'rebuild-debt': [],
			},
			'model/model.mjs': {
				'serves-a-server-door': ['Model', 'newId'],
				'rebuild-debt': ['kindOf'],
			},
			'model/surface.mjs': {
				'rebuild-debt': ['SURFACE'],
			},
			'planner/log.mjs': {
				'rebuild-debt': ['LOG_HARD_MAX', 'LOG_MAX'],
			},
			'planner/txn.mjs': {
				'rebuild-debt': ['MAX_OPS'],
			},
			'planner/validate.js': {
				'rebuild-debt': ['validateEntity'],
				'serves-a-server-door': ['DOCUMENT_ID', 'validPrincipal', 'validateDoc', 'validateSelectionIds'],
			},
		},
		baseline: {
			'engine/index.mjs': ['DERIVATIONS', 'MAX_MOVERS_PER_SPAWNER', 'MOVERS', 'TICK_MS', 'TOWERS', 'aimAt',
				'attachRelations', 'combatAt', 'factsAt', 'inReadView', 'makeRelations', 'moverFor', 'moversAt', 'onEndpoint',
				'onOpenGround', 'onSpawner', 'oneSelected', 'positionOf', 'prepareSpawner', 'situationOf', 'spawnersOf', 'tickAt',
				'towerFor', 'worldOf'],
			'engine/kinds.mjs': ['MOVERS', 'TOWERS'],
			'engine/movers.mjs': ['MAX_MOVERS_PER_SPAWNER', 'positionOf'],
			'engine/rules.mjs': ['DERIVATIONS', 'aimAt', 'combatAt', 'factsAt', 'worldOf'],
			'engine/situation.mjs': ['inReadView', 'onEndpoint', 'onOpenGround', 'onSpawner', 'oneSelected', 'situationOf'],
			'engine/store.mjs': ['attachRelations'],
			'kernel/adapt.mjs': ['docToSchema', 'schemaToDoc'],
			'kernel/geometry.mjs': ['APPEARANCE_KEYS', 'CONTROL_WEIGHT', 'DASH_OFF', 'DASH_ON', 'cellCenter', 'cellOn', 'gridDot',
				'junction', 'layoutOf', 'linkDash', 'linkFacing', 'linkMarker', 'linkWidth', 'nearestAnchor', 'port', 'px', 'pxOn',
				'samePlane', 'snapLayout', 'spanExtent', 'waypointAnchor', 'waypointJunction', 'waypointRole', 'waypointStyle'],
			'kernel/grc.mjs': ['RULES', 'crossings'],
			'kernel/index.mjs': ['APPEARANCE_KEYS', 'CONTROL_WEIGHT', 'DASH_OFF', 'DASH_ON', 'DRAW_ORDER', 'GLYPH_BB', 'L_STD',
				'RULES', 'bboxOf', 'cellCenter', 'cellOf', 'cellOn', 'cellPx', 'check', 'contentLayout', 'crossings', 'derive',
				'docToSchema', 'frameRadius', 'frameWidth', 'grc', 'gridDot', 'gridSnap', 'groupHull', 'hexColor', 'isPanel',
				'layoutOf', 'linkAppearance', 'linkDash', 'linkFacing', 'linkMarker', 'linkWidth', 'nearestAnchor', 'px', 'pxOn',
				'render', 'renderContentRegion', 'renderElement', 'renderScene', 'resolve', 'roundedPath', 'samePlane',
				'schemaToDoc', 'selBox', 'sharedDefs', 'showsSockets', 'snapLayout', 'spanExtent', 'waypointAnchor',
				'waypointJunction', 'waypointLayers', 'waypointRole', 'waypointStyle'],
			'kernel/renderer.mjs': ['DRAW_ORDER', 'contentLayout', 'frameRadius', 'frameWidth', 'hexColor', 'isPanel',
				'renderContentRegion', 'renderElement', 'selBox', 'sharedDefs', 'showsSockets'],
			'kernel/theme.mjs': ['KERNEL_CSS', 'faviconSvg'],
			'model/index.mjs': ['CONTENT_VALUE_MAX', 'Model', 'NAME_MAX', 'SPAN_MAX', 'SURFACE', 'kindOf', 'newId'],
			'model/invariants.mjs': ['splitAtBend'],
			'model/model.mjs': ['Model', 'newId'],
			'model/surface.mjs': ['SURFACE'],
			'server/log.mjs': ['LOG_HARD_MAX', 'LOG_MAX'],
			'server/txn.mjs': ['MAX_OPS'],
			'server/validate.js': ['DOCUMENT_ID', 'validPrincipal', 'validateDoc', 'validateEntity', 'validateSelectionIds'],
		},
	},
};

/*
The folder lists of the other scanners, moved here unchanged (K0) so that a new folder is added in
one place. The ORDER is part of each scanner's behaviour (it orders their output), so each list
keeps the order it had in its scanner. L1 checks that every entry is a folder in FOLDERS, and that
scan-dead reads every scanned folder except the tests (which it reads separately, as its TESTS).
*/
export const SCANNER_ROOTS = {
	dead: ['kernel', 'engine', 'model', 'app/src', 'server', 'planner', 'tools', 'cli', 'lab', 'network', 'zones', 'groups', 'devices', 'product'],   // scan-dead PROD: where a consumer counts as production
	deadMethods: ['server', 'planner', 'model', 'engine', 'kernel'],                 // scan-dead METHOD_SCOPE: where a public method must have a caller
	docrefs: ['kernel', 'engine', 'model', 'app/src', 'server', 'planner', 'cli', 'zones', 'groups', 'devices', 'product'],     // scan-docrefs CODE_ROOTS: code whose comments cite paths
	twins: ['kernel', 'engine', 'model', 'app/src', 'server', 'planner'],     // scan-twins ROOTS: where shared arithmetic is compared
	writers: ['server', 'planner', 'model'],     // scan-writers ROOTS: where the one-writer rule is held
};
