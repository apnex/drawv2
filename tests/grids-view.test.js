/*
H26.6's move 8 (dev/design/components/PAN-ZOOM.md section 3.7, "The grid at each level"; PZ24, PZ13, GR2; section 5.1 row 8; appendix A
move 8) -- THE GRIDS AND THE CROSSHAIR FROM THE VIEW, through draw's own view part and grids part on a root of the size the design
measured -- the canvas 1,366 by 535 and 1,920 by 847 on screen, its default scale the old frame's fit -- each view set at a level
(`View.set`) and each redraw run when the scene has told it (the grids' `schedule`, here a queue flushed by hand, since the scene may not
be written while it tells, vector-scene VS17).

Held: `dots-in-view.mjs`'s draw rows at the origin -- the dots listed over the area drawn and each tier's dots within `visible()`, both
grids, every level, both canvases -- and over panning, every dot drawn equal to an independent listing of the tiers at each of a
period's placements, its counts within the design's most; the translation check, the zone grid's counts the device grid's moved half a
square; each dot's tier by its own indices, the zone grid's from its first corner; a canvas whose finest tier stands under 4 pixels apart
drawing every tier; the overflow cases -- a faded tier left out past 10,000, the finest first, and the full tier thinned at the origin;
a pan within the margin drawing nothing, one leaving it, a level and a scale each drawing again; a dot's size on screen the same at
every level and today's at 1x, and with `GRID_DOT_LEVEL` planted at 2 every dot half of it; the values named in view.js alone; and the
crosshair across `visible()`, put again for a new view.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { installDom, fakeEl, sceneOver, dotsOf } from './fixtures/client-harness.mjs';
import { Model } from './fixtures/composed.mjs';
import { PRODUCT_CANVAS } from '../product/canvas.mjs';
import { Grids } from '../app/src/grids.js';
import { View, viewFrames } from '../app/src/view.js';
import { crosshair } from '../app/src/editing-visuals.js';
import { gridsOf } from '../app/src/snap.js';
import { gridDot } from '../kernel/geometry.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const LEVELS = [0.5, 1, 2, 3];
const R = { node: gridDot().radius, zone: 5 };
const ORIGIN = { node: 0, zone: 30 };
const LAYER = { node: '#grid-nodes', zone: '#grid-zones' };

// a page of `w` by `h` screen pixels: its scene, the view part, and the grids drawn from it, each redraw queued until flushed
function pageOf(w, h, ViewOf = View) {
	const root = fakeEl('svg', 'canvas');
	root.clientWidth = w; root.clientHeight = h;
	const { svg, scene } = sceneOver(root);
	const view = new ViewOf({ scene });
	const queue = [], schedule = (fn) => queue.push(fn);
	const grids = new Grids({ scene, grids: gridsOf(PRODUCT_CANVAS), model: new Model(), look: () => view.gridLook(), schedule });
	const flush = () => { let n = 0; while (queue.length) { queue.shift()(); n++; } return n; };
	const set = (v) => { view.set(v); flush(); };
	// a view set afresh: drawn at a far place first, so the grids draw for this one whether or not it lies within the margin
	const fresh = (v) => { set({ ...v, x: v.x + 1e5 }); set(v); };
	const dots = (grid) => dotsOf(svg.byId[LAYER[grid]]);
	return { svg, scene, view, grids, flush, set, fresh, dots, schedule };
}
const inside = (r) => (d) => d.x >= r.x && d.x <= r.x + r.w && d.y >= r.y && d.y <= r.y + r.h;
// each tier's dots within the region, a dot's tier by its opacity -- the tiers' opacities differ at every level
const perTier = (dots, tiers, r) => tiers.map((t) => dots.filter((d) => d.opacity === t.opacity && inside(r)(d)).length);
// the tier a lattice point takes, by its indices on its own lattice: the first whose `every` divides both
const tierOf = (tiers, col, row) => tiers.findIndex((t) => col % t.every === 0 && row % t.every === 0);
// every point of a grid in a closed rect with its tier's opacity, a pitch at a time -- the independent listing
function listing(grid, tiers, a) {
	const o = ORIGIN[grid], out = [];
	for (let row = Math.ceil((a.y - o) / 60); o + row * 60 <= a.y + a.h; row++) {
		for (let col = Math.ceil((a.x - o) / 60); o + col * 60 <= a.x + a.w; col++) out.push({ x: o + col * 60, y: o + row * 60, opacity: tiers[tierOf(tiers, col, row)].opacity });
	}
	return out;
}
const key = (d) => `${d.x},${d.y},${d.opacity}`;

// dots-in-view.mjs's draw rows at the origin (PAN-ZOOM.md 3.7): per grid, per level, the dots listed and each tier's within visible()
const AT_ORIGIN = {
	'1366 by 535': { node: { 0.5: [275, [207]], 1: [1029, [855]], 2: [3977, [207, 3160]], 3: [8845, [65, 1798, 5672]] },
		zone: { 0.5: [240, [220]], 1: [960, [828]], 2: [3840, [207, 3105]], 3: [8640, [65, 1798, 5589]] } },
	'1920 by 847': { node: { 0.5: [189, [189]], 1: [817, [779]], 2: [3315, [189, 2808]], 3: [7493, [65, 1582, 5118]] },
		zone: { 0.5: [220, [200]], 1: [840, [720]], 2: [3192, [189, 2763]], 3: [7308, [65, 1582, 4941]] } },
};
// and the most over panning, each tier's within visible() and the dots listed, both grids alike
const MOST = {
	'1366 by 535': { 0.5: [275, [230]], 1: [1029, [874]], 2: [3977, [230, 3197]], 3: [8845, [84, 1867, 5727]] },
	'1920 by 847': { 0.5: [220, [210]], 1: [860, [779]], 2: [3315, [210, 2854]], 3: [7493, [78, 1676, 5118]] },
};
const CANVASES = { '1366 by 535': [1366, 535], '1920 by 847': [1920, 847] };

test('H26.6 move 8: at the origin each grid draws dots-in-view.mjs\'s rows -- the dots listed with the margin, each tier\'s in view -- at every level, on both canvases', () => {
	const restore = installDom();
	try {
		for (const [name, [w, h]] of Object.entries(CANVASES)) {
			const p = pageOf(w, h);
			for (const level of LEVELS) {
				p.set({ x: 0, y: 0, level });
				const { tiers } = p.view.gridLook(), r = p.scene.visible().region;
				for (const grid of ['node', 'zone']) {
					const dots = p.dots(grid), [listed, inView] = AT_ORIGIN[name][grid][level];
					assert.deepEqual([dots.length, perTier(dots, tiers, r)], [listed, inView], `${name}, the ${grid} grid at ${level}x`);
				}
			}
		}
	} finally { restore(); }
});

test('H26.6 move 8: over panning, every dot drawn is the tiers\' independent listing over the area drawn, and no count passes the design\'s most', () => {
	const restore = installDom();
	try {
		for (const [name, [w, h]] of Object.entries(CANVASES)) {
			const p = pageOf(w, h);
			for (const level of [1, 2, 3]) {
				p.set({ x: 0, y: 0, level });
				const { tiers, margin } = p.view.gridLook(), period = tiers[0].every * 60;
				// the corner stepped across one period of the tiers' pattern on both axes, in steps that meet no line of the grid alike
				for (let i = 0; i < 7; i++) {
					const dx = (period * i) / 7 + 3.5, dy = (period * ((i * 3) % 7)) / 7 + 1.25;
					p.fresh({ x: dx, y: dy, level });
					const { region: r, scale } = p.scene.visible(), m = margin / scale;
					const area = { x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m };
					for (const grid of ['node', 'zone']) {
						const got = p.dots(grid).map(key).sort(), want = listing(grid, tiers, area).map(key).sort();
						assert.deepEqual(got, want, `${name}, the ${grid} grid at ${level}x, the centre at ${dx}, ${dy}`);
						const [most, mostTier] = MOST[name][level];
						assert.ok(got.length <= most && perTier(p.dots(grid), tiers, r).every((n, k) => n <= mostTier[k]), `${name} ${grid} ${level}x: within the design's most`);
					}
				}
			}
		}
	} finally { restore(); }
});

test('H26.6 move 8: a lattice and a view shifted together keep every tier\'s count -- the zone grid\'s the device grid\'s moved half a square', () => {
	const restore = installDom();
	try {
		const p = pageOf(1366, 535);
		for (const level of [2, 3]) {
			for (const [dx, dy] of [[0, 0], [17, 45], [133, -71]]) {
				p.fresh({ x: dx, y: dy, level });
				const { tiers } = p.view.gridLook(), node = p.dots('node'), r = p.scene.visible().region;
				p.fresh({ x: dx + 30, y: dy + 30, level });
				const zone = p.dots('zone'), rz = p.scene.visible().region;
				assert.deepEqual(perTier(zone, tiers, rz), perTier(node, tiers, r), `${level}x at ${dx}, ${dy}: each tier's count in view`);
				assert.equal(zone.length, node.length, 'and the dots listed');
			}
		}
	} finally { restore(); }
});

test('H26.6 move 8: each dot takes the first tier whose every divides both its indices -- the zone grid\'s counted from its first corner, half a square off', () => {
	const restore = installDom();
	try {
		const p = pageOf(1366, 535);
		for (const level of [2, 3]) {
			p.set({ x: 37, y: -11, level });
			const { tiers } = p.view.gridLook();
			for (const grid of ['node', 'zone']) {
				for (const d of p.dots(grid)) {
					const col = (d.x - ORIGIN[grid]) / 60, row = (d.y - ORIGIN[grid]) / 60;
					assert.equal(d.opacity, tiers[tierOf(tiers, col, row)].opacity, `${grid} ${level}x: the dot at ${d.x}, ${d.y}`);
				}
			}
			const full = p.dots('zone').find((d) => d.opacity === 1);
			assert.ok((full.x - 30) % (tiers[0].every * 60) === 0 && (full.y - 30) % (tiers[0].every * 60) === 0, 'a full zone dot on its own lattice\'s coarsest tier, from 30');
		}
		p.set({ x: 0, y: 0, level: 3 });
		const row = p.dots('node').filter((d) => d.y === 0 && d.x >= 0 && d.x <= 600).sort((a, b) => a.x - b.x).map((d) => d.opacity);
		assert.deepEqual(row, [1, 0.25, 0.5, 0.25, 0.5, 0.25, 0.5, 0.25, 0.5, 0.25, 1], 'a row through a full dot at 3x: full, 25, 50, 25, ..., 25, full');
		assert.ok(p.dots('node').filter((d) => d.y === 60).every((d) => d.opacity === 0.25), 'an odd row all at 25%');
	} finally { restore(); }
});

test('H26.6 move 8: a canvas whose finest tier stands under 4 pixels apart still draws every tier', () => {
	const restore = installDom();
	try {
		const p = pageOf(346, 195);
		p.set({ x: 0, y: 0, level: 3 });
		const { tiers, margin } = p.view.gridLook(), { region: r, scale } = p.scene.visible();
		assert.ok(60 * scale < 4, `control: its squares ${60 * scale} pixels apart`);
		const m = margin / scale, area = { x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m };
		assert.deepEqual(p.dots('node').map(key).sort(), listing('node', tiers, area).map(key).sort(), 'every dot of every tier, no tier left out by spacing');
		assert.deepEqual([...new Set(p.dots('node').map((d) => d.opacity))].sort(), [0.25, 0.5, 1]);
	} finally { restore(); }
});

/*
dots-in-view.mjs's overflow cases (3.7): a view at a scale of one over exactly the positions named, no margin, the level's tiers -- at 1x
100 by 100 drawn whole and 101 by 100 at every second; at 3x 101 by 100 leaving out the 25% tier, 201 by 200 the 50% too, the full tier
exactly 100 by 100 drawn whole and 101 by 100 at every second of it, the origin drawn in each -- and, the move's verifier's S2, at 3x the
finest tier listing exactly 10,000, 100 by 100, drawn whole, every tier kept.
*/
test('H26.6 move 8: past 10,000 a faded tier is left out, the finest first, and the full tier alone is thinned at the origin -- the overflow cases', () => {
	const restore = installDom();
	try {
		const tiersAt = (level) => { const p = pageOf(1366, 535); p.set({ x: 0, y: 0, level }); return p.view.gridLook().tiers; };
		const cases = [
			[1, 100, 100, [10000], 1], [1, 101, 100, [2550], 2],
			[3, 100, 100, [100, 2400, 7500], 1],   // the move's verifier, S2: the finest tier listing exactly 10,000, drawn whole
			[3, 101, 100, [110, 2440, 0], 1], [3, 201, 200, [420, 0, 0], 1], [3, 991, 991, [10000, 0, 0], 1], [3, 1001, 991, [2550, 0, 0], 2],
		];
		for (const [level, cols, rows, want, stride] of cases) {
			const tiers = tiersAt(level);
			const root = fakeEl('svg', 'canvas');
			root.clientWidth = (cols - 1) * 60; root.clientHeight = (rows - 1) * 60;
			const { svg, scene } = sceneOver(root);
			new Grids({ scene, grids: gridsOf(PRODUCT_CANVAS).filter((g) => g.layout === 'node'), model: new Model(), look: () => ({ tiers, dotScale: null, margin: 0 }) });
			const dots = dotsOf(svg.byId['#grid-nodes']);
			assert.deepEqual(tiers.map((t) => dots.filter((d) => d.opacity === t.opacity).length), want, `${level}x over ${cols} by ${rows}`);
			assert.ok(dots.some((d) => d.x === 0 && d.y === 0), 'the origin drawn');
			if (stride > 1) assert.ok(dots.every((d) => (d.x / 60) % stride === 0 && (d.y / 60) % stride === 0), 'at every second, from the origin');
		}
	} finally { restore(); }
});

test('H26.6 move 8: a pan within the margin draws nothing again; leaving it, another level, or another scale does', () => {
	const restore = installDom();
	try {
		const p = pageOf(1366, 535);
		p.set({ x: 0, y: 0, level: 1 });
		const item = () => p.svg.byId['#grid-nodes'].children[0];
		const first = item();
		p.set({ x: 25, y: -20, level: 1 });   // under 32 pixels at a scale of about 0.5: 50 and 40 units would leave it
		assert.equal(item(), first, 'within the margin: nothing drawn again');
		p.set({ x: 200, y: 0, level: 1 });
		assert.notEqual(item(), first, 'leaving it: drawn again');
		const second = item();
		p.set({ x: 200, y: 0, level: 2 });
		assert.notEqual(item(), second, 'another level: drawn again');
		const third = item();
		p.scene.setView({ ...p.scene.view(), scale: p.scene.view().scale * 1.5 });   // a scale the view part did not set
		p.flush();
		assert.notEqual(item(), third, 'another scale: drawn again');
		// views told many times before one redraw run draw once
		p.view.set({ x: 1000, y: 0, level: 1 }); p.view.set({ x: 2000, y: 0, level: 1 }); p.view.set({ x: 3000, y: 0, level: 1 });
		assert.equal(p.flush(), 1, 'three views told, one redraw asked');
	} finally { restore(); }
});

/*
The move's verifier, S1: a pan across the margin's edge, in each of the four directions, at every level -- a step within the margin, the
grid drawn before still covering the view, then one past it, the grid drawn again -- the whole grid in view after each step: every dot
the tiers place within visible(), and none missing at the edge the pan exposed.
*/
test('H26.6 move 8: a pan across the margin\'s edge, up, down, left or right, at every level, leaves the whole grid in view after each step', () => {
	const restore = installDom();
	try {
		const p = pageOf(1366, 535);
		const whole = (what) => {
			const { tiers } = p.view.gridLook(), r = p.scene.visible().region;
			for (const grid of ['node', 'zone']) {
				assert.deepEqual(p.dots(grid).filter(inside(r)).map(key).sort(), listing(grid, tiers, r).map(key).sort(), `${what}: the ${grid} grid whole in view`);
			}
		};
		for (const level of LEVELS) {
			for (const [dirX, dirY, way] of [[0, -1, 'up'], [0, 1, 'down'], [-1, 0, 'left'], [1, 0, 'right']]) {
				p.fresh({ x: 7, y: 3, level });
				const { scale } = p.scene.visible(), { margin } = p.view.gridLook();
				const step = (0.75 * margin) / scale;   // three quarters of the margin: one step within it, two past it
				const item = p.svg.byId['#grid-nodes'].children[0];
				p.set({ x: 7 + dirX * step, y: 3 + dirY * step, level });
				assert.equal(p.svg.byId['#grid-nodes'].children[0], item, `${level}x, ${way}: within the margin, nothing drawn again`);
				whole(`${level}x, ${way}, within the margin`);
				p.set({ x: 7 + 2 * dirX * step, y: 3 + 2 * dirY * step, level });
				assert.notEqual(p.svg.byId['#grid-nodes'].children[0], item, `${level}x, ${way}: past the margin, drawn again`);
				whole(`${level}x, ${way}, past the margin`);
			}
		}
	} finally { restore(); }
});

/*
The move's verifier, L2: a view the view part sets is drawn as it is set -- the composition hands the view part `settled`, which runs what
the scene's listeners asked as soon as the scene has finished telling the view -- so a resize's view, set in the browser after that frame's
animation callbacks, is drawn before the frame is painted. Here `settled` runs the queue the grids asked of, as app/src/compose-canvas.js
wires it; a view set on the scene by anything else waits for the queue.
*/
test('H26.6 move 8: a view the view part sets is drawn as it is set -- no frame waited for -- and one set on the scene waits', () => {
	const restore = installDom();
	try {
		const root = fakeEl('svg', 'canvas');
		root.clientWidth = 1366; root.clientHeight = 535;
		const { svg, scene } = sceneOver(root);
		const asked = [], run = () => { for (const fn of asked.splice(0)) fn(); };
		const view = new View({ scene, settled: run });
		new Grids({ scene, grids: gridsOf(PRODUCT_CANVAS), model: new Model(), look: () => view.gridLook(), schedule: (fn) => asked.push(fn) });
		const whole = () => { const { tiers } = view.gridLook(), r = scene.visible().region; return dotsOf(svg.byId['#grid-nodes']).filter(inside(r)).map(key).sort().join() === listing('node', tiers, r).map(key).sort().join(); };
		for (const level of LEVELS) {
			view.set({ x: 5000, y: -3000, level });
			assert.deepEqual([asked.length, whole()], [0, true], `${level}x: drawn as the view was set, nothing left asked`);
		}
		root.clientWidth = 1900; root.clientHeight = 900;   // the root resized, as the page tells the view part
		view.resized();
		assert.deepEqual([asked.length, whole()], [0, true], 'a resize: drawn as the view was set again');
		scene.setView({ ...scene.view(), x: scene.view().x + 4000 });
		assert.deepEqual([asked.length, whole()], [1, false], 'a view set on the scene alone: the redraw asked, not yet run');
		run();
		assert.equal(whole(), true, 'and whole once it runs');
	} finally { restore(); }
});

/*
The move 8 verifier's second folds (S2, L1) -- THE VIEW'S FRAMES (app/src/view.js `viewFrames`): what the scene's listeners ask is run
once per asking, the queue emptied, and a frame asked again for the next; and each asked redraw runs whatever another throws, the error
still thrown when the queue has run.
*/
test('H26.6 move 8: the view\'s frames run each asked redraw once, empty the queue, and ask a frame again for the next', () => {
	const frames = [], ran = [];
	const { ask, run } = viewFrames((fn) => frames.push(fn));
	ask(() => ran.push('a')); ask(() => ran.push('b'));
	assert.deepEqual([frames.length, ran], [1, []], 'two asked, one frame asked, nothing run yet');
	frames.shift()();
	assert.deepEqual(ran, ['a', 'b'], 'the frame runs each, in order');
	run();
	assert.deepEqual(ran, ['a', 'b'], 'and empties the queue: run again, nothing runs twice');
	ask(() => ran.push('c'));
	assert.equal(frames.length, 1, 'the next ask asks a frame again');
	run();   // the view part's settled, before the frame
	assert.deepEqual(ran, ['a', 'b', 'c'], 'run at once, as a view the view part set is');
	frames.shift()();
	assert.deepEqual(ran, ['a', 'b', 'c'], 'the frame then finds nothing');
	ask(() => ran.push('d'));
	assert.equal(frames.length, 1, 'and another ask asks a frame again');
});

test('H26.6 move 8: one asked redraw throwing leaves the others theirs, the error thrown once the queue has run', () => {
	const { ask, run } = viewFrames(() => {});
	const ran = [], boom = new Error('the node layout is missing');
	ask(() => { throw boom; }); ask(() => ran.push('after'));
	assert.throws(() => run(), (e) => e === boom, 'the one error, as it was thrown');
	assert.deepEqual(ran, ['after'], 'the redraw after it ran');
	ask(() => { throw new Error('one'); }); ask(() => { throw new Error('two'); }); ask(() => ran.push('last'));
	assert.throws(() => run(), (e) => e instanceof AggregateError && e.errors.length === 2, 'two errors, both thrown together');
	assert.deepEqual(ran, ['after', 'last']);
});

// L1, as the verifier drove it: the node layout record removed, a view set throws; once the record returns, the crosshair follows views again
test('H26.6 move 8: a grid that cannot be drawn throws from the view it fails, and the crosshair asked beside it still follows the next view', () => {
	const restore = installDom();
	try {
		const root = fakeEl('svg', 'canvas');
		root.clientWidth = 1366; root.clientHeight = 535;
		const { svg, scene } = sceneOver(root);
		const { ask, run } = viewFrames(() => {});
		const view = new View({ scene, settled: run });
		const model = new Model();
		new Grids({ scene, grids: gridsOf(PRODUCT_CANVAS), model, look: () => view.gridLook(), schedule: ask });   // first, as the composition makes them
		const snap = crosshair(scene, 60, { schedule: ask });
		const ends = () => svg.byId['#snaplayer'].children.filter((c) => c.tagName === 'LINE').map((c) => Number(c.attrs.y1));
		snap.show({ x: 120, y: -60 });
		const record = model.get('layout', 'layout-000001');
		model.del('layout', 'layout-000001');
		assert.throws(() => view.set({ x: 2000, y: 0, level: 2 }), /the diagram's grid \(layout-000001\) is missing/, 'the grid\'s failure surfaces from the view set -- the one record\'s sentence from H26.6 move 14');
		assert.equal(ends()[0], scene.visible().region.y, 'the crosshair asked beside it followed that view all the same');
		model.put('layout', record);
		view.set({ x: -3000, y: 900, level: 3 });
		assert.equal(ends()[0], scene.visible().region.y, 'and the next, the record back');
		const r = scene.visible().region;
		assert.ok(dotsOf(svg.byId['#grid-nodes']).some(inside(r)), 'the grid drawn again');
	} finally { restore(); }
});

/*
The move 8 verifier's second fold, S1: a canvas narrowed at one scale -- 1,920 by 535 to 1,366 by 535, the old frame fitting by its height
on both -- lists again, so at 3x the 25% tier the bound left out on the wider canvas returns on the narrower: the design's rows for the
1,366 canvas, here through the view part and the grids part as the page composes them.
*/
test('H26.6 move 8: at 3x, a canvas narrowed from 1920 by 535 to 1366 by 535 draws again, the tier the bound left out restored', () => {
	const restore = installDom();
	try {
		const root = fakeEl('svg', 'canvas');
		root.clientWidth = 1920; root.clientHeight = 535;
		const { svg, scene } = sceneOver(root);
		const { ask, run } = viewFrames(() => {});
		const view = new View({ scene, settled: run });
		new Grids({ scene, grids: gridsOf(PRODUCT_CANVAS), model: new Model(), look: () => view.gridLook(), schedule: ask });
		view.set({ x: 0, y: 0, level: 3 });
		const { tiers } = view.gridLook(), count = () => { const r = scene.visible().region; return ['#grid-nodes', '#grid-zones'].map((id) => perTier(dotsOf(svg.byId[id]), tiers, r)); };
		assert.equal(count()[0][2], 0, 'control: on the 1,920 canvas at 3x the 25% tier is left out by the bound');
		root.clientWidth = 1366;
		view.resized();
		assert.deepEqual(count(), [[65, 1798, 5672], [65, 1798, 5589]], 'narrowed: every tier, as the design counts the 1,366 canvas at 3x');
	} finally { restore(); }
});

test('H26.6 move 8: a dot keeps on screen at every level the size it has at 1x -- today\'s -- and GRID_DOT_LEVEL planted at 2 halves every dot', () => {
	const restore = installDom();
	try {
		for (const [w, h, node, zone] of [[1366, 535, 1.98, 4.95], [1920, 847, 3.14, 7.84]]) {
			const p = pageOf(w, h), fit = Math.min(w / 1920, h / 1080);
			for (const level of LEVELS) {
				p.set({ x: 0, y: 0, level });
				for (const [grid, across] of [['node', node], ['zone', zone]]) {
					const widths = new Set(p.dots(grid).map((d) => d.width));
					assert.deepEqual([...widths], [2 * R[grid] * fit], `${w} by ${h}, ${grid} at ${level}x: one diameter on screen, its drawing radius at the default scale`);
					assert.equal(Math.round(2 * R[grid] * fit * 100) / 100, across, 'the design\'s figure');
				}
			}
		}
		// the one edit: view.js with GRID_DOT_LEVEL 2, every dot shown at the size its drawing radius has at 2x -- half (3.7's rule)
		const src = fs.readFileSync(path.join(ROOT, 'app/src/view.js'), 'utf8');
		assert.equal(src.match(/const GRID_DOT_LEVEL = 1;/g)?.length, 1, 'control: the value, once');
		// view.js imports nothing, so its source, the value planted, is run as a function answering its class
		const Planted = new Function(`${src.replace('const GRID_DOT_LEVEL = 1;', 'const GRID_DOT_LEVEL = 2;').replace(/^export /gm, '')}\nreturn View;`)();
		const p = pageOf(1366, 535, Planted), fit = 535 / 1080;
		for (const level of LEVELS) {
			p.set({ x: 0, y: 0, level });
			assert.deepEqual([...new Set(p.dots('node').map((d) => d.width))], [R.node * fit], `planted at 2, the node dot at ${level}x half its 1x size`);
			assert.deepEqual([...new Set(p.dots('zone').map((d) => d.width))], [R.zone * fit], `and the zone dot`);
		}
	} finally { restore(); }
});

test('H26.6 move 8: GRID_TIERS, GRID_DOT_LEVEL and GRID_MARGIN are named in view.js alone, and GRID_FLOOR nowhere', () => {
	const product = (dir) => fs.readdirSync(path.join(ROOT, dir), { recursive: true }).filter((f) => /\.m?js$/.test(f)).map((f) => path.join(dir, f));
	const files = ['app', 'kernel', 'model', 'engine', 'planner', 'plugins', 'product', 'server', 'lab', 'cli'].flatMap(product);
	assert.ok(files.includes('app/src/view.js') && files.includes('app/src/grids.js'), 'control: the product modules');
	for (const name of ['GRID_TIERS', 'GRID_DOT_LEVEL', 'GRID_MARGIN']) {
		assert.deepEqual(files.filter((f) => fs.readFileSync(path.join(ROOT, f), 'utf8').includes(name)), ['app/src/view.js'], `${name}: view.js alone`);
	}
	assert.deepEqual(files.filter((f) => fs.readFileSync(path.join(ROOT, f), 'utf8').includes('GRID_FLOOR')), [], 'GRID_FLOOR: nowhere');
});

test('H26.6 move 8: the crosshair spans what the canvas shows, and is put again across a new view once the scene has told it', () => {
	const restore = installDom();
	try {
		const root = fakeEl('svg', 'canvas');
		root.clientWidth = 1366; root.clientHeight = 535;
		const { svg, scene } = sceneOver(root);
		new View({ scene });
		const queue = [];
		const snap = crosshair(scene, 60, { schedule: (fn) => queue.push(fn) });
		const lines = () => svg.byId['#snaplayer'].children.filter((c) => c.tagName === 'LINE').map((c) => ['x1', 'y1', 'x2', 'y2'].map((k) => Number(c.attrs[k])));
		snap.show({ x: 120, y: -60 });
		const r = scene.visible().region;
		assert.deepEqual(lines(), [[120, r.y, 120, r.y + r.h], [r.x, -60, r.x + r.w, -60]], 'across visible(), through the point');
		scene.setView({ x: -5000, y: 300, scale: 0.25 });
		assert.equal(queue.length, 1, 'the new view asks one put');
		queue.shift()();
		const r2 = scene.visible().region;
		assert.deepEqual(lines(), [[120, r2.y, 120, r2.y + r2.h], [r2.x, -60, r2.x + r2.w, -60]], 'put again across the new view');
		snap.hide();
		scene.setView({ x: 0, y: 0, scale: 1 });
		assert.deepEqual([queue.length, lines()], [0, []], 'hidden: nothing asked, nothing drawn');
	} finally { restore(); }
});
