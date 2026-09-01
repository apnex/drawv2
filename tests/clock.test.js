/*
H12.4 — one agreed clock.

The property under test is PARITY, not accuracy. It does not matter whether the shared instant is
the true time; it matters that two peers holding the same document compute the same mover position
from it. So the tests below put two clocks on machines whose own clocks disagree, and assert they
converge -- which is the thing a per-machine `Date.now()` cannot do.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Clock } from '../app/src/clock.js';
import { prepareSpawner, moversAt } from '../engine/index.mjs';

// a machine whose wall clock is wrong by `skewMs`, without touching the real one
const onMachine = (skewMs, fn) => {
	const real = Date.now;
	Date.now = () => real.call(Date) + skewMs;
	try { return fn(); } finally { Date.now = real; }
};

test('H12.4: an unseeded clock is the local one, and says so', () => {
	const c = new Clock();
	assert.equal(c.skew().seeded, false);
	assert.equal(c.skew().offset, 0);
	assert.ok(Math.abs(c.now() - Date.now()) < 50);
});

test('H12.4: seeding adopts the server instant, and reports that it did', () => {
	const c = new Clock();
	const server = Date.now() + 30_000;              // a server 30s ahead of this machine
	assert.equal(c.seed(server), true);
	assert.equal(c.skew().seeded, true);
	assert.ok(Math.abs(c.now() - server) < 50, 'now() must follow the server, not the machine');
});

test('H12.4: an absent or malformed stamp leaves the clock local rather than broken', () => {
	for (const bad of [undefined, null, NaN, 'now', Infinity]) {
		const c = new Clock();
		assert.equal(c.seed(bad), false, String(bad));
		assert.equal(c.skew().seeded, false);
		assert.ok(Math.abs(c.now() - Date.now()) < 50, 'must fall back to the local clock');
	}
});

test('H12.4: the round trip is CORRECTED for, not ignored', () => {
	// a request that left 200ms ago, answered by a server whose instant matches ours exactly.
	// Uncorrected, the offset would read as -200ms and the clock would run that far behind.
	const c = new Clock();
	const sentAt = Date.now() - 200;
	c.seed(Date.now(), sentAt);
	// symmetric-path assumption puts the server's stamp half a round trip after the send, so the
	// residual is about half the trip rather than all of it
	assert.ok(Math.abs(c.skew().offset) < 120, `over-corrected or uncorrected: ${c.skew().offset}`);
	assert.ok(Math.abs(c.skew().offset) > 20, `expected a visible half-trip residual, got ${c.skew().offset}`);
});

test('H12.4: a nonsense send time is ignored rather than trusted', () => {
	const c = new Clock();
	c.seed(Date.now(), Date.now() + 60_000);          // "sent" in the future
	assert.ok(Math.abs(c.now() - Date.now()) < 50, 'a future send time must not skew the clock');
});

test('H12.4: TWO peers whose machine clocks disagree still agree on the instant', () => {
	// the whole point. One laptop is 45s fast, the other 2min slow; the server is the truth.
	const server = 1_700_000_000_000;
	const a = onMachine(45_000, () => { const c = new Clock(); c.seed(server); return c; });
	const b = onMachine(-120_000, () => { const c = new Clock(); c.seed(server); return c; });
	const ta = onMachine(45_000, () => a.now());
	const tb = onMachine(-120_000, () => b.now());
	assert.ok(Math.abs(ta - tb) < 50, `peers disagree by ${Math.abs(ta - tb)}ms`);
});

test('H12.4: and therefore they draw the mover in the SAME PLACE', () => {
	// parity stated as the thing a person would actually notice
	const server = 1_700_000_000_000;
	const spawner = prepareSpawner({ id: 'waypoint-aaaaaa', pts: [[0, 0], [1000, 0]], since: server - 4000, interval: 1000, speed: 1.4 });
	const a = onMachine(45_000, () => { const c = new Clock(); c.seed(server); return c; });
	const b = onMachine(-120_000, () => { const c = new Clock(); c.seed(server); return c; });
	const seen = (clock, skew) => onMachine(skew, () => moversAt([spawner], clock.now()).map((m) => m.k));
	assert.deepEqual(seen(a, 45_000), seen(b, -120_000));

	// and WITHOUT the shared clock they would not -- the check that this test is worth running
	const rawA = onMachine(45_000, () => moversAt([spawner], Date.now()).map((m) => m.k));
	const rawB = onMachine(-120_000, () => moversAt([spawner], Date.now()).map((m) => m.k));
	assert.notDeepEqual(rawA, rawB, 'unseeded peers must visibly disagree, or this proves nothing');
});
