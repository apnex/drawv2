import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeGeometry, roundedPath, pathLength, pointAtDistance } from '../kernel/router.mjs';
import { prepareSpawner, moversAt, positionOf, MAX_MOVERS_PER_SPAWNER } from '../engine/index.mjs';

// H12.1 — one decomposition, two consumers.
// The string and the measurement must be built from the SAME list, or the corner rule exists twice
// and the two copies drift the first time the radius changes.

const L = (pts, close = false) => pathLength(routeGeometry(pts, 20, close));

test('H12.1: a route decomposes into the lines and quadratic corners the path is drawn from', () => {
	const geo = routeGeometry([[0, 0], [200, 0], [200, 200]], 20, false);
	assert.deepEqual(geo.map((g) => g.kind), ['line', 'quad', 'line']);
	// the corner's control point IS the vertex it turns around
	assert.deepEqual(geo[1].c, [200, 0]);
	// and the corner starts and ends `radius` back along each adjacent run
	assert.deepEqual(geo[0].b, [180, 0]);
	assert.deepEqual(geo[1].b, [200, 20]);
});

test('H12.1: a two-point route is one line and carries no corner', () => {
	assert.deepEqual(routeGeometry([[0, 0], [100, 0]], 20, false), [{ kind: 'line', a: [0, 0], b: [100, 0] }]);
});

test('H12.1: a closed route keeps its run home, which the string draws as Z', () => {
	const pts = [[0, 0], [80, 0], [80, 80], [0, 80]];
	const geo = routeGeometry(pts, 20, true);
	// four corners, four connecting runs -- INCLUDING the last one back to the start
	assert.equal(geo.filter((g) => g.kind === 'quad').length, 4);
	assert.equal(geo.filter((g) => g.kind === 'line').length, 4);
	// the traversable list closes the loop; the drawn string ends in Z instead of repeating it
	assert.deepEqual(geo[geo.length - 1].b, geo[0].a);
	assert.ok(roundedPath(pts, 20, true).endsWith(' Z'));
	assert.ok(!roundedPath(pts, 20, true).includes('Z L'));
});

test('H12.1: the radius clamps per corner, so a short run cannot overshoot', () => {
	// a 10px run cannot carry a 20px corner from both ends
	const geo = routeGeometry([[0, 0], [10, 0], [10, 10]], 20, false);
	const quad = geo.find((g) => g.kind === 'quad');
	assert.deepEqual(quad.a, [5, 0]);      // half the adjacent run, not the full radius
	assert.deepEqual(quad.b, [10, 5]);
});

test('H12.1: a corner is SHORTER than going to the vertex and back -- the drawn line is cut', () => {
	// the whole reason measurement cannot use the raw anchor polyline
	const pts = [[0, 0], [200, 0], [200, 200]];
	const polyline = 200 + 200;
	assert.ok(L(pts) < polyline, 'a rounded corner must cut the vertex');
	assert.ok(polyline - L(pts) > 5, `cut should be visible, was ${polyline - L(pts)}`);
});

test('H12.1: length is the sum of the parts, and a degenerate route measures zero', () => {
	assert.equal(L([[0, 0], [100, 0]]), 100);
	assert.equal(L([[0, 0], [0, 300]]), 300);
	assert.equal(pathLength(routeGeometry([[5, 5]], 20, false)), 0);
	assert.equal(pathLength(routeGeometry(null, 20, false)), 0);
});

test('H12.1: sampling walks the route and clamps at both ends rather than returning NaN', () => {
	const geo = routeGeometry([[0, 0], [100, 0]], 20, false);
	assert.deepEqual(pointAtDistance(geo, 25), [25, 0]);
	assert.deepEqual(pointAtDistance(geo, -5), [0, 0]);       // before the start
	assert.deepEqual(pointAtDistance(geo, 999), [100, 0]);    // past the end
	assert.equal(pointAtDistance([], 10), null);
});

test('H12.1: a sample midway round a corner is ON the corner, not at the vertex', () => {
	const geo = routeGeometry([[0, 0], [200, 0], [200, 200]], 20, false);
	const mid = pointAtDistance(geo, pathLength(geo) / 2);
	assert.ok(Math.hypot(mid[0] - 200, mid[1] - 0) > 1, 'must not sit on the vertex');
	assert.ok(mid[0] < 200 + 0.01 && mid[1] > -0.01, 'must stay inside the turn');
});

// ---- H12.3 — the simulation ----

const spawner = (o = {}) => prepareSpawner({
	id: 'waypoint-aaaaaa', pts: [[0, 0], [1000, 0]], since: 0, interval: 1000, speed: 100, ...o,
});

test('H12.3: a prepared spawner carries its own route and length, and stays plain data', () => {
	const s = spawner();
	assert.equal(s.length, 1000);
	assert.equal(s.id, 'waypoint-aaaaaa');
	assert.ok(Array.isArray(s.geo));
});

test('H12.3: a mover is DERIVED -- position is a pure function of the instant', () => {
	const s = [spawner()];
	// armed at 0, 100px/s: at t=1s the first mover has travelled 100px
	assert.deepEqual(moversAt(s, 1000)[0].at, [100, 0]);
	assert.deepEqual(moversAt(s, 3000)[0].at, [300, 0]);
	// and asking twice for the same instant gives the same answer, having stored nothing
	assert.deepEqual(moversAt(s, 3000), moversAt(s, 3000));
});

test('H12.3: departures follow the interval, oldest first', () => {
	const live = moversAt([spawner()], 3500);
	assert.deepEqual(live.map((m) => m.k), [0, 1, 2, 3]);
	assert.deepEqual(live.map((m) => Math.round(m.travelled)), [350, 250, 150, 50]);
});

/*
The live WINDOW is the mechanism, so the window is what these test.

An earlier version of this asserted the same behaviour and named the `travelled > length` inequality
as its subject. Mutation proved it did not bite: the window bound already excludes a consumed mover,
so the inequality is algebraically unreachable and the test was passing for a reason other than the
one it stated. The check survives as a documented float backstop; the tests below target the thing
that actually decides.
*/
test('H12.3: a mover is CONSUMED at the far end, with no destruction step', () => {
	const s = [spawner()];                       // transit = 1000px / 100px/s = 10s
	assert.ok(moversAt(s, 9999).some((m) => m.k === 0), 'still travelling just before arrival');
	assert.ok(!moversAt(s, 10001).some((m) => m.k === 0), 'gone just after');
});

test('H12.3: the live window is EXACT at both edges -- it is what admits and consumes', () => {
	const s = spawner();                         // 1000px, 100px/s, one departure per second
	// at t = 10s exactly, mover 0 has travelled exactly the full length: still admitted, at the end
	const atArrival = moversAt([s], 10_000).find((m) => m.k === 0);
	assert.ok(atArrival, 'a mover exactly at the far end is still live');
	assert.deepEqual(atArrival.at, [1000, 0]);
	// the oldest live mover is always the one whose travel has not yet exceeded the route
	for (const t of [1500, 7300, 10_000, 24_800]) {
		const live = moversAt([s], t);
		assert.ok(live.every((m) => m.travelled >= 0 && m.travelled <= s.length + 1e-9),
			`window admitted a mover off the route at t=${t}`);
	}
});

test('H12.3: the window WIDTH is the transit time -- a longer route holds more movers at once', () => {
	// the property the bound encodes: movers alive = transit / interval, not "everything since armed"
	const short = spawner({ pts: [[0, 0], [500, 0]] });     // transit 5s  -> ~5 alive
	const long = spawner({ pts: [[0, 0], [2000, 0]] });     // transit 20s -> ~20 alive
	assert.equal(moversAt([short], 100_000).length, 6);
	assert.equal(moversAt([long], 100_000).length, 21);
});

test('H12.3: identity is STABLE -- the seam the deviation tier will key on', () => {
	assert.equal(moversAt([spawner()], 1000)[0].id, 'waypoint-aaaaaa#0');
	// the same mover keeps its id as it travels, and as others join ahead of it
	const later = moversAt([spawner()], 5500).find((m) => m.k === 0);
	assert.equal(later.id, 'waypoint-aaaaaa#0');
});

/*
The window is a COST bound, so cost is what this asserts.

An earlier version compared result lengths and called that "costs no more". Mutation showed it did
not bite: breaking the window leaves the answer identical, because the liveness check filters the
surplus. The only observable difference is work done, so the test has to observe work.

The age is chosen from MEASUREMENT, not from a guess. A first attempt used one year and a 500ms
threshold and did not bite, because a skipped loop iteration is cheap: the unwindowed walk over a
year of departures takes 153ms and slid under the bar. Measured on this machine, unwindowed:

  1 year 153ms      10 years 1789ms      100 years 26305ms

Ten years against a 500ms threshold is a 3.5x margin on the failing side, while the windowed path
answers in well under a millisecond at ANY age -- a margin of several hundred times on the passing
side. A hundred years would be safer still and would cost 26 seconds every time it regressed.
*/
test('H12.3: the window bounds WORK -- an ancient spawner costs the same as a fresh one', () => {
	const ancient = spawner({ since: 0 });
	const t = 10 * 365 * 24 * 3600 * 1000;            // armed ten years ago
	const started = process.hrtime.bigint();
	const live = moversAt([ancient], t);
	const ms = Number(process.hrtime.bigint() - started) / 1e6;
	assert.ok(ms < 500, `unwindowed walk detected: ${ms.toFixed(1)}ms for a ten-year-old spawner`);
	// and it is still the RIGHT answer, not a fast wrong one
	assert.deepEqual(live.map((m) => Math.round(m.travelled)), moversAt([spawner({ since: 0 })], 60_000).map((m) => Math.round(m.travelled)));
});

test('H12.3: nothing before the spawner was armed', () => {
	assert.deepEqual(moversAt([spawner({ since: 5000 })], 1000), []);
});

test('H12.3: a spawner that cannot emit is silent rather than infinite', () => {
	for (const bad of [{ interval: 0 }, { interval: -5 }, { speed: 0 }, { speed: -1 }, { pts: [[7, 7]] }]) {
		assert.deepEqual(moversAt([spawner(bad)], 10_000), [], JSON.stringify(bad));
	}
});

test('H12.3: a pathological configuration is CAPPED, so bad numbers look wrong instead of hanging', () => {
	const swarm = spawner({ interval: 1, speed: 1, pts: [[0, 0], [4000, 0]] });
	assert.equal(moversAt([swarm], 1_000_000).length, MAX_MOVERS_PER_SPAWNER);
});

test('H12.3: movers ride the DRAWN line, so a bend never throws one off it', () => {
	const s = spawner({ pts: [[0, 0], [200, 0], [200, 200]] });
	for (const m of moversAt([s], 2000)) {
		// every sample must lie on the rounded route, which is what pointAtDistance guarantees
		assert.deepEqual(m.at, pointAtDistance(s.geo, m.travelled));
	}
	// and the vertex itself is never a mover's position, because the corner cuts it
	const all = [];
	for (let t = 0; t < 4000; t += 37) all.push(...moversAt([s], t));
	assert.ok(all.every((m) => Math.hypot(m.at[0] - 200, m.at[1]) > 0.5), 'no mover sits on the vertex');
});

test('H12.3: positionOf answers for ONE mover without building the set', () => {
	const s = spawner();
	assert.deepEqual(positionOf(s, 0, 1000), [100, 0]);
	assert.equal(positionOf(s, 0, 20_000), null);     // consumed
	assert.equal(positionOf(s, 3, 1000), null);       // not yet departed
});

/*
DOM-freedom is proven by WHERE this runs, not by reading the source for forbidden words.

The first version of this test scanned the function source for `document` and `window`, and failed
the moment a code comment used the English word "window" -- matching prose rather than structure,
which is a mistake this tree has made repeatedly. It also proved less than it claimed: a substring
check cannot tell a reference from a mention.

Everything below executes under Node, where `document` and `window` do not exist. A simulation that
reached for either would throw here rather than pass quietly. That is the proof, and it is free.

The clock is the case that a bare environment does NOT catch, because Node has one. So the clock is
proven behaviourally: hold `t` still while real time moves, and the answer must not move with it.
*/
test('H12.3: the simulation never reads a clock -- real time moves, the answer does not', async () => {
	const s = [spawner()];
	const first = moversAt(s, 4321);
	await new Promise((r) => setTimeout(r, 25));      // real time advances underneath it
	assert.deepEqual(moversAt(s, 4321), first, 'a clock-reader would have drifted');
	// and `t` is genuinely the only thing that moves the answer
	assert.notDeepEqual(moversAt(s, 4322), first);
});

test('H12.3: the simulation runs where there is no DOM at all -- this test IS the proof', () => {
	assert.equal(typeof globalThis.document, 'undefined');
	assert.equal(typeof globalThis.window, 'undefined');
	assert.ok(moversAt([spawner()], 3000).length > 0, 'and it still answers');
});

test('H12.3: two peers with the same document and clock agree, having exchanged nothing', () => {
	// A5 perceptual parity, as a property rather than a protocol
	const a = [spawner()], b = [spawner()];
	for (const t of [0, 137, 999, 4021, 9999]) assert.deepEqual(moversAt(a, t), moversAt(b, t));
});
