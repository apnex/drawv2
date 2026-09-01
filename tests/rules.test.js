/*
H12.16 — the derivation surface.

A rule is a pure function of `(world, tick)` returning facts. It decides nothing, mutates nothing,
sends nothing. Everything asserted here is a property two peers must agree on WITHOUT exchanging a
message, because that agreement is the whole design: if it holds, a third client joining recomputes
and is in step; if it fails once under combat, the disagreement folds forward and never heals.

So the tests are weighted towards determinism rather than towards balance. A tower that kills too
slowly is a number; a tower that kills a different creep on two machines is the end of the model.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from '../model/index.mjs';
import { worldOf, combatAt, factsAt, DERIVATIONS, tickAt, TICK_MS } from '../engine/index.mjs';
import { TOWERS, MOVERS } from '../engine/kinds.mjs';

function board({ towers = [[600, 0]], speed = 1.4, interval = 900 } = {}) {
	const m = new Model();
	m.put('waypoint', { id: 'waypoint-aa0001', x: 0, y: 0, spawn: { interval, speed, kind: 'packet', since: 0 } });
	m.put('waypoint', { id: 'waypoint-aa0002', x: 1200, y: 0 });
	m.put('link', { id: 'link-aa0003', src: 'waypoint-aa0001', dst: 'waypoint-aa0002' });
	towers.forEach(([x, y], i) => m.put('node', { id: `node-bb00${i}1`, type: 'loadbalancer', x, y }));
	return m;
}

test('H12.16: the document stores no game numbers -- range, rate and damage come from the KIND', () => {
	const m = board();
	const node = m.get('node', 'node-bb0001');
	for (const banned of ['range', 'period', 'damage', 'tower']) {
		assert.equal(node[banned], undefined, `${banned} must not be on the entity -- B172's lesson`);
	}
	assert.ok(TOWERS.loadbalancer.range > 0, 'it comes from the kind table instead');
	assert.equal(worldOf(m).towers[0].range, TOWERS.loadbalancer.range);
});

test('H12.16: a tick is absolute, so peers need no origin to agree on', () => {
	// derived from the instant alone: two peers that never spoke compute the same index
	assert.equal(tickAt(0), 0);
	assert.equal(tickAt(TICK_MS - 1), 0);
	assert.equal(tickAt(TICK_MS), 1);
	assert.equal(tickAt(1788256105475), Math.floor(1788256105475 / TICK_MS));
});

test('H12.16: a rule returns FACTS and mutates nothing', () => {
	const m = board();
	const w = worldOf(m);
	const before = JSON.stringify(w);
	const alive = combatAt(w, 30_000).alive;
	const facts = factsAt(w, 100, alive);
	assert.equal(JSON.stringify(w), before, 'the world is untouched by asking');
	for (const f of facts) assert.equal(typeof f.kind, 'string', 'a fact names what it is');
});

test('H12.16: firing is DERIVED -- same board, same instant, same answer, every time', () => {
	const a = combatAt(worldOf(board()), 30_000);
	const b = combatAt(worldOf(board()), 30_000);
	assert.deepEqual([...a.dead.entries()].sort(), [...b.dead.entries()].sort());
	assert.deepEqual(a.alive.map((m) => m.id), b.alive.map((m) => m.id));
});

/*
The determinism that would be fatal to lose.

Two peers must pick the SAME target. Progress is a number both derive, and the id breaks a tie, so
the answer cannot depend on array order -- which is the one thing that legitimately differs between
two runtimes iterating a document.
*/
test('H12.16: target selection does not depend on the order movers arrive in', () => {
	const w = worldOf(board());
	const alive = combatAt(w, 30_000).alive;
	const forward = factsAt(w, 300, alive);
	const backward = factsAt(w, 300, [...alive].reverse());
	assert.deepEqual(forward, backward, 'reversing the input must not change who is shot');
});

test('H12.16: towers are iterated in a fixed order whatever the document says', () => {
	const m = board({ towers: [[600, 0], [300, 0], [900, 0]] });
	const ids = worldOf(m).towers.map((t) => t.id);
	assert.deepEqual(ids, [...ids].sort(), 'sorted, so two peers fire them in the same sequence');
});

test('H12.16: range is inclusive and measured in CELLS, in exact integer arithmetic', () => {
	// a tower at the origin, range 3 cells = 180px at a 60px pitch. 180 is in, 181 is out.
	const m = new Model();
	m.put('waypoint', { id: 'waypoint-aa0001', x: 0, y: 0, spawn: { interval: 100000, speed: 0.1, kind: 'packet', since: 0 } });
	m.put('waypoint', { id: 'waypoint-aa0002', x: 1200, y: 0 });
	m.put('link', { id: 'link-aa0003', src: 'waypoint-aa0001', dst: 'waypoint-aa0002' });
	m.put('node', { id: 'node-bb0001', type: 'loadbalancer', x: 0, y: 0 });
	const w = worldOf(m);
	const at = (x) => factsAt(w, 0, [{ id: 'waypoint-aa0001#0', progress: 0.5, at: [x, 0] }]);
	assert.equal(at(TOWERS.loadbalancer.range * 60).length, 1, 'exactly at range: in');
	assert.equal(at(TOWERS.loadbalancer.range * 60 + 1).length, 0, 'one pixel beyond: out');
});

test('H12.16: a creep dies when its hit points run out, and stays dead', () => {
	const strong = { ...TOWERS.loadbalancer };
	TOWERS.loadbalancer = { range: 3, period: 2, damage: 1 };
	try {
		const c = combatAt(worldOf(board()), 30_000);
		assert.ok(c.dead.size > 0, 'a tower that out-damages the flow kills');
		for (const id of c.dead.keys()) {
			assert.ok(!c.alive.some((m) => m.id === id), 'a dead mover is not also alive');
		}
	} finally { TOWERS.loadbalancer = strong; }
});

test('H12.16: hit points come from the mover KIND, not from the spawner', () => {
	assert.ok(MOVERS.packet.hp > 0);
	const m = board();
	assert.equal(m.get('waypoint', 'waypoint-aa0001').spawn.hp, undefined, 'not stored on the spawner');
});

test('H12.16: a second tower kills strictly more -- the defence curve is real', () => {
	const one = combatAt(worldOf(board({ towers: [[600, 0]] })), 30_000);
	const two = combatAt(worldOf(board({ towers: [[600, 0], [300, 0]] })), 30_000);
	assert.ok(two.dead.size > one.dead.size, `two towers must beat one: ${two.dead.size} vs ${one.dead.size}`);
});

/*
The cost the director accepted, asserted as a bound rather than described.

Damage accumulates, so state at a tick is history and cannot be jumped to. What keeps that from
growing without limit is that nothing which departed before the oldest living mover can still be
alive -- so the fold starts at the longest transit, not at the beginning of time.
*/
test('H12.16: the fold is bounded by transit, not by how long the diagram has existed', () => {
	const w = worldOf(board());
	const young = Date.now();
	const started = process.hrtime.bigint();
	combatAt(w, young + 365 * 24 * 3600 * 1000);           // a year of spawning
	const ms = Number(process.hrtime.bigint() - started) / 1e6;
	assert.ok(ms < 500, `a year-old board folded in ${ms.toFixed(1)}ms -- unbounded replay detected`);
});

test('H12.16: no rule writes -- the surface is read-only by construction', () => {
	// the boundary that keeps parity free. A rule that mutated would create state nobody else
	// derived, and agreement would then need a protocol rather than arithmetic.
	for (const r of DERIVATIONS) {
		const src = r.facts.toString();
		for (const banned of ['\.put(', '\.set(', '\.del(', 'commit', 'history']) {
			assert.ok(!src.includes(banned), `rule ${r.id} appears to mutate via ${banned}`);
		}
	}
});

/*
The four gaps mutation found, after twelve tests that all passed.

Recorded rather than quietly patched, because the pattern is now measured at ten occurrences: a test
that is green and wrong, where the assertion is fine and simply never reaches the thing it is about.
Every one of these was written believing it covered the line below it.
*/

test('H12.16: range is measured in BOTH axes -- the y term is load-bearing', () => {
	// the original test put every tower and mover on y=0, so `dx*dx + dy*dy` would have passed
	// with the y term deleted, or subtracted. Range is a circle; a test on one axis cannot see that.
	const m = new Model();
	m.put('waypoint', { id: 'waypoint-aa0001', x: 0, y: 0, spawn: { interval: 100000, speed: 0.1, kind: 'packet', since: 0 } });
	m.put('waypoint', { id: 'waypoint-aa0002', x: 1200, y: 0 });
	m.put('link', { id: 'link-aa0003', src: 'waypoint-aa0001', dst: 'waypoint-aa0002' });
	m.put('node', { id: 'node-bb0001', type: 'loadbalancer', x: 300, y: 180 });
	const w = worldOf(m);
	const at = (x, y) => factsAt(w, 0, [{ id: 'waypoint-aa0001#0', progress: 0.5, at: [x, y] }]).length;
	const R = TOWERS.loadbalancer.range * 60;
	assert.equal(at(300, 180), 1, 'on top of the tower');
	assert.equal(at(300, 180 + R), 1, 'due south at exactly range -- pure y, dx is zero');
	assert.equal(at(300, 180 + R + 1), 0, 'one pixel further south');
	assert.equal(at(300 + R, 180), 1, 'due east at exactly range -- pure x, dy is zero');
	// a 3-4-5 triangle: 108px east, 144px south is exactly 180px away. Only a true circle admits it.
	assert.equal(at(300 + 108, 180 + 144), 1, 'diagonal at exactly range');
	assert.equal(at(300 + 109, 180 + 145), 0, 'just outside the same diagonal');
});

test('H12.16: a tower shoots the mover FURTHEST along, not merely a consistent one', () => {
	// the order-independence test could not see this: it reversed the input and compared two runs of
	// the SAME comparator, so any policy at all would have satisfied it.
	const w = worldOf(board());
	const near = { id: 'waypoint-aa0001#1', progress: 0.10, at: [600, 0] };
	const far = { id: 'waypoint-aa0001#2', progress: 0.90, at: [600, 0] };
	const mid = { id: 'waypoint-aa0001#3', progress: 0.50, at: [600, 0] };
	for (const order of [[near, far, mid], [far, mid, near], [mid, near, far]]) {
		const f = factsAt(w, 0, order);
		assert.equal(f.length, 1, 'one shot, one target');
		assert.equal(f[0].target, far.id, 'the one about to escape');
	}
});

test('H12.16: it takes exactly hp/damage hits to kill -- not one more, not one fewer', () => {
	// `left <= 0` degraded to `left < 0` survived: deaths still happened, just a shot late. Asserting
	// that something dies cannot distinguish three hits from four.
	const w = worldOf(board());
	const spec = TOWERS.loadbalancer;
	const need = Math.ceil(MOVERS.packet.hp / spec.damage);
	const target = { id: 'waypoint-aa0001#0', progress: 0.5, at: [600, 0] };
	let hp = MOVERS.packet.hp, shots = 0;
	while (hp > 0) { hp -= factsAt(w, 0, [target])[0].damage; shots++; }
	assert.equal(shots, need, `${MOVERS.packet.hp}hp against ${spec.damage} damage is ${need} shots`);
	assert.equal(hp, 0, 'and lands exactly on zero rather than overshooting');
});

test('H12.16: the reported hits belong to the tick asked for', () => {
	// `hits` was returned by combatAt and asserted by nothing at all.
	TOWERS.loadbalancer = { range: 3, period: 1, damage: 1 };
	try {
		const w = worldOf(board());
		/*
		Sampled rather than asserted at one instant, because the first draft of this test guessed an
		instant and failed -- correctly. A tower at this rate kills everything that enters range, so
		most ticks have no living target at all and an empty `hits` is the right answer. Asserting on
		a single arbitrary tick was asserting on the spawn phase.
		*/
		let seen = 0;
		for (let t = 29_000; t <= 30_000; t += TICK_MS) {
			const c = combatAt(w, t);
			for (const h of c.hits) assert.equal(h.tick, c.tick, 'no stale hits from earlier ticks leak out');
			if (c.hits.length) seen++;
		}
		assert.ok(seen > 0, 'across a second of fire the tower hit something at least once');
	} finally { TOWERS.loadbalancer = { range: 3, period: 5, damage: 1 }; }
});

test('H12.16: death lands exactly on zero hit points, in combatAt itself', () => {
	/*
	The test above proved the arithmetic and pinned nothing: it did the subtraction in its own body,
	so `left <= 0` inside the fold was never executed by it. Degrading that threshold to `left < 0`
	survived -- creeps still died, one shot later, and every assertion still held.

	This asserts against the fold's own record. Where damage divides hit points evenly a corpse must
	show exactly 0; a threshold demanding strictly-negative would leave -1 behind.
	*/
	TOWERS.loadbalancer = { range: 3, period: 2, damage: 1 };
	try {
		const c = combatAt(worldOf(board()), 30_000);
		assert.ok(c.dead.size > 0, 'something died, or this test proves nothing');
		for (const id of c.dead.keys()) {
			assert.equal(c.hp.get(id), 0, `${id} died on exactly zero, not overshot`);
		}
	} finally { TOWERS.loadbalancer = { range: 3, period: 5, damage: 1 }; }
});
