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
  cli          the command-line tool
  lab          the lab composition root (K10); `lab/` does not exist yet
  tools, tests may import any layer, and no product layer imports them
*/

export const ALLOWED = {
	core: ['core'],
	network: ['core', 'network'],
	planner: ['core', 'network', 'planner'],
	canvas: ['core', 'network', 'planner', 'canvas'],
	chrome: ['core', 'network', 'planner', 'canvas', 'simulation', 'export', 'chrome'],
	simulation: ['core', 'network', 'simulation'],
	export: ['core', 'network', 'export'],
	'server-only': ['core', 'network', 'planner', 'simulation', 'export', 'server-only'],
	cli: ['core', 'network', 'simulation', 'cli'],
	lab: ['core', 'network', 'planner', 'canvas', 'lab'],
	tools: ['core', 'network', 'planner', 'canvas', 'chrome', 'simulation', 'export', 'server-only', 'cli', 'tools'],
	tests: ['core', 'network', 'planner', 'canvas', 'chrome', 'simulation', 'export', 'server-only', 'cli', 'tools', 'tests'],
};

// the layers that ship: what L7k calls "the product"
export const PRODUCT_LAYERS = ['core', 'network', 'planner', 'canvas', 'chrome', 'simulation', 'export', 'server-only', 'cli'];

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
	The network plugin INCUBATES here (ruled 2026-09-28). Its layer is `network`, and production is
	allowed to import that layer -- correctly, permanently -- because today the layer also names code
	inside kernel/, model/ and engine/. So the layer table cannot keep production out of THIS folder
	before promotion; `tests/scan-layers.test.js` holds that as a separate folder rule.
	*/
	{ dir: 'network', layer: 'network' },
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
		'kernel/geometry.mjs',   // the grid and cell arithmetic; its link roles and appearance are network code until K13a splits it (L5, L5p)
		'kernel/renderer.mjs',   // frame and selection primitives the canvas draws with; the SVG scene half leaves at K11
		'model/model.mjs',       // the document store; its link methods are network debt that K13d moves at the rebuild
		'model/ops.mjs', 'model/shape.mjs', 'model/limits.mjs', 'model/surface.mjs',
		'model/index.mjs',       // a barrel (L4) over core modules only; deleted at K2c
	],
	network: [
		'model/invariants.mjs', 'model/referential.mjs',   // the link rules and references; to network/ at K13b
		'engine/relations.mjs', 'engine/store.mjs',        // the maintained reverse indices over the entity graph, link incidence among them
		'engine/ivm.mjs',                                  // the index's generic mechanism; relations.mjs is its only user
	],
	planner: [
		'server/txn.mjs', 'server/log.mjs', 'server/validate.js',
		'engine/policy.mjs',     // group policy the planner applies (groupAfterRemoval, collectionCap); moves with the planner at K4
	],
	canvas: [
		'app/src/changes.js', 'app/src/commands.js', 'app/src/input.js', 'app/src/keymap.js',
		'app/src/labeledit.js',  // the label editor Input drives for t, F2 and double-click; the lab loads it, and its window reads are L11's canvas ratchet
		'app/src/overlay.js', 'app/src/painter.js', 'app/src/pick.js', 'app/src/recognize.js', 'app/src/renderer.js',
		'app/src/selection.js', 'app/src/snap.js',
	],
	chrome: [
		'app/src/main.js',       // the production composition root; nothing imports it
		'app/src/clock.js', 'app/src/net.js', 'app/src/readout.js', 'app/src/spectate.js', 'app/src/sync.js', 'app/src/watchdog.js',
		'app/src/palette.js',    // the device palette widget; input.js reaching into it is L2 debt that K6 removes
		'app/src/movers.js', 'app/src/reveal.js', 'app/src/paintloop.js',   // the simulation's painters: production-only, outside the lab
	],
	simulation: [
		'engine/movers.mjs', 'engine/spawners.mjs', 'engine/kinds.mjs', 'engine/rules.mjs', 'engine/situation.mjs',
		'model/reveal.mjs',      // the reveal beat's timing; its only product reader is the reveal painter
		'engine/index.mjs',      // a barrel (L4) with no code of its own; importers are judged at each name's definer; deleted at K2c
	],
	export: [
		'kernel/engine.mjs', 'kernel/adapt.mjs',
		'kernel/grc.mjs',        // the rule checker behind check()
		'kernel/fixtures.mjs',   // the spec viewer's reference scenes
		'kernel/index.mjs',      // a barrel (L4) that also defines render() and check(), which compose the export path; deleted at K2c
		'server/svg.mjs',        // the headless SVG door; it composes the export path and nothing else
	],
	'server-only': [
		'server/anchor.mjs',     // anchor resolution; the planner imports it today (L2 debt that K3 removes by injection), and it stays 404 (K4)
		'server/app.js', 'server/codes.mjs', 'server/docfile.mjs', 'server/files.mjs', 'server/hub.js', 'server/identity.mjs',
		'server/locks.js', 'server/origin.mjs', 'server/protocol.js', 'server/rest.js', 'server/routes.mjs', 'server/seed.js',
		'server/server.js', 'server/sessionlog.mjs', 'server/store.js',
	],
	cli: ['cli/draw.mjs', 'cli/verbs.mjs'],
};

/*
The composition roots whose closure is DECLARED (L6), and the names each exposes to its callers
(L10 counts those as used). The closure follows static imports, re-exports and literal `import()`.

`page` is the production page. `planner` is the planner entry: `server/txn.mjs` does not import
`server/log.mjs`, and the server's door imports both (`server/store.js:21-22`), so the entry has
both roots -- with txn alone, log.mjs would sit outside every L6 and L10 check. The lab root joins
at K10 (L6 hard for it, with `layers`).
*/
export const ENTRIES = {
	page: {
		roots: ['app/src/main.js'],
		modules: [
			'app/src/changes.js', 'app/src/clock.js', 'app/src/commands.js', 'app/src/input.js', 'app/src/keymap.js',
			'app/src/labeledit.js', 'app/src/main.js', 'app/src/movers.js', 'app/src/net.js', 'app/src/overlay.js',
			'app/src/painter.js', 'app/src/paintloop.js', 'app/src/palette.js', 'app/src/pick.js', 'app/src/readout.js',
			'app/src/recognize.js', 'app/src/renderer.js', 'app/src/reveal.js', 'app/src/selection.js', 'app/src/snap.js',
			'app/src/spectate.js', 'app/src/sync.js', 'app/src/watchdog.js', 'engine/index.mjs', 'engine/ivm.mjs',
			'engine/kinds.mjs', 'engine/movers.mjs', 'engine/policy.mjs', 'engine/relations.mjs', 'engine/rules.mjs',
			'engine/situation.mjs', 'engine/spawners.mjs', 'engine/store.mjs', 'kernel/adapt.mjs', 'kernel/engine.mjs',
			'kernel/geometry.mjs', 'kernel/grc.mjs', 'kernel/index.mjs', 'kernel/renderer.mjs', 'kernel/router.mjs',
			'kernel/spec.mjs', 'kernel/theme.mjs', 'model/index.mjs', 'model/invariants.mjs', 'model/limits.mjs',
			'model/model.mjs', 'model/ops.mjs', 'model/reveal.mjs', 'model/shape.mjs', 'model/surface.mjs',
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
		*/
		modules: [
			'lab/src/root.js',
			'network/pipes.mjs',   // the incubating plugin (ruled 2026-09-28)
			'network/pipeset.mjs',
			'network/guide.mjs',
			'network/resolve.mjs',
			'app/src/changes.js', 'app/src/commands.js', 'app/src/input.js', 'app/src/keymap.js', 'app/src/labeledit.js',
			'app/src/overlay.js', 'app/src/painter.js', 'app/src/palette.js', 'app/src/pick.js', 'app/src/readout.js',
			'app/src/recognize.js', 'app/src/renderer.js', 'app/src/selection.js', 'app/src/snap.js', 'engine/index.mjs',
			'engine/ivm.mjs', 'engine/kinds.mjs', 'engine/movers.mjs', 'engine/policy.mjs', 'engine/relations.mjs',
			'engine/rules.mjs', 'engine/situation.mjs', 'engine/spawners.mjs', 'engine/store.mjs', 'kernel/adapt.mjs',
			'kernel/engine.mjs', 'kernel/geometry.mjs', 'kernel/grc.mjs', 'kernel/index.mjs', 'kernel/renderer.mjs',
			'kernel/router.mjs', 'kernel/spec.mjs', 'kernel/theme.mjs', 'model/index.mjs', 'model/invariants.mjs',
			'model/limits.mjs', 'model/model.mjs', 'model/ops.mjs', 'model/referential.mjs', 'model/shape.mjs',
			'model/surface.mjs', 'server/anchor.mjs', 'server/log.mjs', 'server/txn.mjs', 'server/validate.js',
		],
	},
	planner: {
		roots: ['server/txn.mjs', 'server/log.mjs'],
		surface: { 'server/txn.mjs': ['plan', 'commit', 'undo', 'redo'], 'server/log.mjs': ['Log'] },
		modules: [
			'engine/policy.mjs',
			'kernel/geometry.mjs', 'kernel/spec.mjs', 'kernel/theme.mjs',
			'model/invariants.mjs', 'model/limits.mjs', 'model/model.mjs', 'model/ops.mjs', 'model/referential.mjs',
			'model/shape.mjs', 'model/surface.mjs', 'server/anchor.mjs', 'server/log.mjs', 'server/txn.mjs', 'server/validate.js',
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
		kinds: ['node', 'waypoint', 'link', 'zone', 'group'],
		// the WHOLE pattern is fixed: `^(` + the alternation + `)` + `rest`, with no flags
		grammar: [{ file: 'server/validate.js', name: 'ID', others: ['diagram', 'template'], rest: '-[0-9a-f]{6}$' }],
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
	pipe painter (a dozen lines drawing conduit beneath links) and each board's conduit list. The
	painter is composition -- it reads the pipe set and emits elements, defining no rule -- and the
	conduit lists are data. The routing itself lives in network/, which is where the budget should
	NOT be spent: if this ceiling keeps rising, that is the signal something that belongs in the
	incubator is being written in the lab instead.
	*/
	L8: { dir: 'lab', budget: 180 },
	/*
	A PROXY for criterion 5 (browser restatements of planner rules): it sees a browser module reach
	for a rule's code, and misses a rule re-typed by hand. It reads 2 while the three restated rules
	remain (C10). The H17 plan names the canvas; chrome and the lab run in the same page and read 0
	today, so they are held to the same line.
	*/
	L9: {
		layers: ['canvas', 'chrome', 'lab'],
		primitives: { splitAtBend: 'model/invariants.mjs', collapseAtWaypoint: 'model/invariants.mjs', violations: 'model/invariants.mjs', groupAfterRemoval: 'engine/policy.mjs' },
	},
	// C2(d): the only two tags, and the layers whose imports make "serves-a-server-door" true
	L10: { tags: ['rebuild-debt', 'serves-a-server-door'], doors: ['server-only'] },
	/*
	Hard in core, network and planner (they take their host by injection); a per-file ratchet in the
	canvas. A host read is `window`, `globalThis`, `self` or `global`, escapes decoded. PROXY: `top`,
	`parent` and `frames` also reach the window, but they are ordinary local names here too
	(server/log.mjs binds `top`) and the scanner does not resolve scopes, so they are not read.
	*/
	L11: { hard: ['core', 'network', 'planner'], ratchet: ['canvas'] },
};

/*
Today's violations, per site. The scan fails unless each measurement EQUALS its record: a rise is a
new violation, and a fall is progress that must be written down here in the commit that makes it.
When a rule's record empties, delete its keys; the rule stays.

  L2   `importer -> definer`: edges against ALLOWED, judged through barrels, re-exports included.
       K6 removes the palette edge, K5 the situation edge, K3 the anchor edge, and K2c the simulation
       barrel's re-export of the planner's group policy (engine/index.mjs -> engine/policy.mjs)
  L4   `barrel <file>`, one count per name each barrel re-exports (so a barrel that grows is a
       rise), and `importer -> barrel` per import site, static and dynamic. The review counted 125
       lines; 2 of them are kernel/README.md:29 and a comment in kernel/index.mjs:4, so 123 are code:
       81 static and 42 dynamic. K2a-K2c empty it
  L5   `module:name` from RULES.L5.names; L5p from its pattern. Every L5 name and 14 of the 15 L5p
       names are exports of kernel/geometry.mjs, which K13a splits; the fifteenth is routeGeometry
       in kernel/router.mjs. Model's link methods are not exports, so L5 does not see them (K13d)
  L7k  consumer lines per file (see RULES.L7k)
  L9   `module:primitive`: input.js reaches splitAtBend, commands.js groupAfterRemoval (K18b)
  L11  window/globalThis reads per canvas module: the label editor's three
*/

export const RATCHETS = {
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
						'server/rest.js -> kernel/index.mjs': 1,
		'server/rest.js -> model/index.mjs': 1,
		'server/seed.js -> model/index.mjs': 1,
		'server/store.js -> engine/index.mjs': 1,
		'server/store.js -> kernel/index.mjs': 1,
		'server/store.js -> model/index.mjs': 1,
		'server/svg.mjs -> kernel/index.mjs': 1,
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
		list: {
			'kernel/geometry.mjs': {
				'rebuild-debt': [
					'APPEARANCE_KEYS', 'CONTROL_WEIGHT', 'DASH_OFF', 'DASH_ON', 'bboxOf', 'cellCenter', 'cellOf', 'cellOn',
					'cellPx', 'gridDot', 'group', 'groupHull', 'junction', 'layoutOf', 'linkAppearance', 'linkDash', 'linkFacing',
					'linkMarker', 'linkWidth', 'node', 'path', 'port', 'px', 'pxOn', 'samePlane', 'snapLayout', 'spanExtent',
					'waypoint', 'waypointAnchor', 'waypointJunction', 'waypointLayers', 'waypointRole', 'waypointRoles',
					'waypointStyle', 'zone'
				],
				'serves-a-server-door': ['nearestAnchor'],
			},
			'kernel/spec.mjs': {
				'rebuild-debt': ['derive'],
			},
			'kernel/theme.mjs': {
				'rebuild-debt': ['GLYPH_BB', 'GLYPH_DEFS', 'KERNEL_CSS'],
				'serves-a-server-door': ['faviconSvg'],
			},
			'model/invariants.mjs': {
				'rebuild-debt': ['splitAtBend'],
			},
			'model/model.mjs': {
				'serves-a-server-door': ['Model', 'newId'],
				'rebuild-debt': ['kindOf'],
			},
			'model/surface.mjs': {
				'rebuild-debt': ['SURFACE'],
			},
			'server/log.mjs': {
				'rebuild-debt': ['LOG_HARD_MAX', 'LOG_MAX'],
			},
			'server/txn.mjs': {
				'rebuild-debt': ['MAX_OPS'],
			},
			'server/validate.js': {
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
	dead: ['kernel', 'engine', 'model', 'app/src', 'server', 'tools', 'cli', 'lab', 'network'],   // scan-dead PROD: where a consumer counts as production
	deadMethods: ['server', 'model', 'engine', 'kernel'],                        // scan-dead METHOD_SCOPE: where a public method must have a caller
	docrefs: ['kernel', 'engine', 'model', 'app/src', 'server', 'cli'],         // scan-docrefs CODE_ROOTS: code whose comments cite paths
	twins: ['kernel', 'engine', 'model', 'app/src', 'server'],                  // scan-twins ROOTS: where shared arithmetic is compared
	writers: ['server', 'model'],                                                // scan-writers ROOTS: where the one-writer rule is held
};
