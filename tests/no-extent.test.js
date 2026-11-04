/*
H26.6's move 12 (dev/design/components/PAN-ZOOM.md section 7, GR2 and GR3; 5.1 row 12's guard) -- THE SOURCE CHECKS: NO GRID LISTED WHOLE,
NO EXTENT REMAINING. Read over every product module's code, its comments taken out, so a sentence recording what went is not a use:
  GR2  no grid is listed whole -- every `inView` call holds a region from `visible()` or an asked area and a `max` of at most 10,000 --
       and `positionsWithin` and `nodeGridWithin` are gone
  GR3  `SURFACE`, `NODE_EXT`, `ZONE_EXT` and `CANVAS_VIEWBOX` are named nowhere; the old frame's numbers -- 900, 480, 930, 510, 960, 540,
       1920, 1080 -- appear as no bound, each place they still appear recorded with what it is; `LAYOUT_TABLE` is held to the layout row
       and its records (and the table's own module) until move 14 deletes it. The numeric limits kept are listed: the caps 527 and 576,
       and PZ31's bound
Behind them, behaviour: tests/extents-gone.test.js (the editor past each old edge), tests/anchors-area.test.js and
tests/placement-rings.test.js (the agent door and placement with no extent's list).
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const PRODUCT = ['app', 'plugins', 'product', 'server', 'kernel', 'model', 'planner', 'cli', 'engine', 'lab'];
const walk = (d) => fs.readdirSync(path.join(root, d), { withFileTypes: true })
	.flatMap((e) => (e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(path.join(d, e.name))) : /\.(m?js|css|html)$/.test(e.name) ? [path.join(d, e.name)] : []));
const MODULES = PRODUCT.flatMap(walk).sort();
// a module's code, its comments taken out -- block comments, and line comments not inside a URL's `://`
const code = (f) => fs.readFileSync(path.join(root, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, '');
const named = (re) => MODULES.filter((f) => re.test(code(f)));

test('H26.6 move 12, GR2: no grid is listed whole -- positionsWithin and nodeGridWithin are named nowhere, and no module exports them', async () => {
	assert.ok(MODULES.length > 150 && MODULES.includes('server/rest.js') && MODULES.includes('cli/verbs.mjs'), `control: the product's modules are read (${MODULES.length})`);
	assert.deepEqual(named(/\b(positionsWithin|nodeGridWithin)\b/), [], 'named in no product module\'s code');
	for (const [f, m] of [['kernel/geometry.mjs', await import('../kernel/geometry.mjs')], ['server/rest.js', await import('../server/rest.js')]]) {
		assert.deepEqual(['positionsWithin', 'nodeGridWithin'].filter((n) => n in m), [], `${f} exports neither`);
	}
});

/*
Every `inView` call in draw, by module, with where its region comes from; each passes `max` a constant of that module, at most 10,000. A
new call fails here until it is recorded, its region named.
*/
const IN_VIEW = {
	'app/src/grids.js': { calls: 2, region: /const visible = this\.scene\.visible\(\)/, from: 'the scene\'s visible() view, grown by the margin, and the two strips through the lattice\'s origin that count it (PZ24)' },
	'server/rest.js': { calls: 1, region: /function areaAsked\(params, grid\)/, from: 'the area an anchors request asks, clipped to PZ31\'s bound (PZ9)' },
};
test('H26.6 move 12, GR2: every inView call holds a region from visible() or an asked area, and a max of at most 10,000', () => {
	const seen = {};
	for (const f of MODULES) { const n = (code(f).match(/\.inView\(/g) ?? []).length; if (n) seen[f] = n; }
	assert.deepEqual(Object.keys(seen).sort(), Object.keys(IN_VIEW).sort(), 'every module asking inView, and only those, recorded');
	for (const [f, r] of Object.entries(IN_VIEW)) {
		const text = code(f);
		assert.equal(seen[f], r.calls, `${f}: ${r.calls} call(s)`);
		assert.match(text, r.region, `${f}: its region, ${r.from}`);
		const maxes = [...text.matchAll(/\.inView\([^;]*?\{ max: (\w+) \}/g)].map((m) => m[1]);
		assert.equal(maxes.length, r.calls, `${f}: each call passes { max: <constant> }`);
		for (const name of maxes) {
			const value = Number(text.match(new RegExp(`const ${name} = (\\d+);`))?.[1]);
			assert.ok(Number.isInteger(value) && value <= 10000, `${f}: max ${name} is ${value}, at most 10,000`);
		}
	}
});

test('H26.6 move 12, GR3: SURFACE, NODE_EXT, ZONE_EXT and CANVAS_VIEWBOX are named nowhere in product code, and model/surface.mjs is gone', () => {
	assert.deepEqual(named(/\b(SURFACE|NODE_EXT|ZONE_EXT|CANVAS_VIEWBOX)\b/), [], 'no product module\'s code names an extent');
	assert.equal(fs.existsSync(path.join(root, 'model/surface.mjs')), false, 'model/surface.mjs deleted');
	assert.deepEqual(named(/model\/surface\.mjs/), [], 'and nothing imports it');
});

/*
Where the old frame's numbers still appear in product code, each with what it is -- none a bound. A new appearance fails until it is
recorded here, which is where it would have to say it bounds nothing.
*/
const FRAME_NUMBERS = /(?<![\w.#$-])(900|480|930|510|960|540|1920|1080)(?![\w.])/g;
const FRAME_RECORD = {
	'app/src/view.js': [['1920', '1080'], 'the old frame whole, the default level fits in the canvas (PZ7) -- a zoom, not a bound'],
	'plugins/layouts/layout-table.mjs': [['900', '480', '930', '510'], 'the two schema 3 records\' stored `ext`, data every diagram holds until move 14 makes the record one'],
	'plugins/simulation/spawn-runs.mjs': [['900'], 'a spawner\'s default interval, 900 milliseconds'],
	'cli/verbs.mjs': [['900', '900'], '`draw spawn`\'s default interval, 900 milliseconds, in its flag\'s help and its default'],
	'server/seed.js': [['540'], 'the seed board\'s web-tier zone, 540 units tall'],
};
test('H26.6 move 12, GR3: the old frame\'s numbers appear as no bound -- each place they appear recorded with what it is', () => {
	const seen = {};
	for (const f of MODULES) { const found = [...code(f).matchAll(FRAME_NUMBERS)].map((m) => m[1]); if (found.length) seen[f] = found; }
	assert.deepEqual(Object.fromEntries(Object.entries(seen).sort()), Object.fromEntries(Object.entries(FRAME_RECORD).map(([f, [n]]) => [f, n]).sort()), 'only where recorded, and each as often');
	assert.match(code('app/src/view.js'), /const FIRST_FRAME = \{ w: 1920, h: 1080 \};/, 'view.js: the default level\'s frame');
	assert.equal(code('plugins/layouts/layout-table.mjs').match(/ext: Object\.freeze\(\{ x: \d+, y: \d+ \}\)/g).length, 2, 'the table: two records\' extents');
	// the numeric limits kept, each where it is held
	const limits = code('model/limits.mjs');
	assert.match(limits, /export const COORD_BOUND = 1_000_000;/, 'PZ31\'s bound');
	assert.match(limits, /export const ANCHOR_CAP = 527;/, 'the anchor cap');
	assert.match(limits, /export const ZONE_CAP = 576;/, 'the zone cap');
});

test('H26.6 move 12, GR3: LAYOUT_TABLE is held to the layout row and its records -- the routes and the canvas ask their lattices', () => {
	assert.deepEqual(named(/\bLAYOUT_TABLE\b/), ['plugins/layouts/layout-kind.mjs', 'plugins/layouts/layout-records.mjs', 'plugins/layouts/layout-table.mjs'], 'its own module, the row, the records');
});
