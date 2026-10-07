/*
H19.13 (U-a; dev/design/unification/SYNC-HARDENING.md) -- THE SYNC FUZZ, held to its oracles.

The K1 fuzz, ported onto the composition production runs (tests/fixtures/sync-fuzz.mjs over tests/fixtures/sync-world.mjs):
two tabs and a real server, seeded random edits -- the network's among them -- reconnects, drags, undo, flushes. Here: that a
run replays exactly from its seed; that each quiescent oracle reports the fault it exists for, planted; and a bounded set of
seeds on which no tab ends apart from the server. The transient oracles (SHADOW, REGRESSION) are measured at U-b, not
asserted yet: until then a count of them is information, not a verdict.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runSeed } from './fixtures/sync-fuzz.mjs';

const QUIESCENT = ['DIVERGE', 'INVALID', 'ROUTE', 'STUCK'];
const kinds = (res) => [...new Set(res.all.map((v) => v.kind))].sort();
const quiescentFaults = (res) => res.all.filter((v) => QUIESCENT.includes(v.kind));

test('U-a: a run replays exactly from its seed -- the same events, the same verdict', async () => {
	const a = await runSeed(7, { steps: 120 }), b = await runSeed(7, { steps: 120 });
	assert.deepEqual(a.log, b.log, 'the event log');
	assert.deepEqual(kinds(a), kinds(b), 'and what the oracles said');
	assert.ok(a.log.length > 120, 'and it did work');
});

test('U-a: a tab planted apart from the server at quiescence is reported, naming the entity', async () => {
	const res = await runSeed(3, { steps: 80, plant: (w) => { const t = w.tabs[1]; const n = t.model.all('node')[0]; t.model.set('node', n.id, { name: 'planted' }); } });
	const d = res.all.find((v) => v.kind === 'DIVERGE');
	assert.ok(d, 'DIVERGE reported');
	assert.equal(d.tab, 1);
	assert.match(d.detail, /name/, 'naming the field');
});

test('U-a: an invalid document on the server is reported', async () => {
	const res = await runSeed(3, { steps: 80, plant: (w) => {
		w.store.get(w.id).put('link', { id: 'link-0000ee', name: 'planted', src: 'node-000001', dst: 'node-0000ff' });
	} });
	const bad = res.all.find((v) => v.kind === 'INVALID');
	assert.ok(bad, 'INVALID reported');
	assert.match(bad.detail, /does not exist/);
});

test('U-a: a change the tab committed and never had answered is reported', async () => {
	const res = await runSeed(3, { steps: 80, plant: (w) => { w.tabs[0].units.push({ ops: [], txn: 'planted', state: 'pending', label: 'planted' }); } });
	assert.ok(res.all.some((v) => v.kind === 'STUCK' && v.tab === 0), 'STUCK reported for tab 0');
});

test('U-a: a converged tab drawing a link otherwise than the server is reported', async () => {
	const res = await runSeed(3, { steps: 80, plant: (w) => { w.tabs[0].model.pathOf = () => [[0, 0], [60, 0]]; } });
	const r = res.all.find((v) => v.kind === 'ROUTE');
	assert.ok(r, 'ROUTE reported');
	assert.equal(r.tab, 0);
});

/*
THE GATE'S BOUND (H19.17, U-e): fixed seeds in each profile the measurement ran, every one held to the quiescent oracles -- no tab
apart from the server, no invalid document, no link drawn otherwise, nothing a tab committed left unanswered -- and to no change
given up as undeliverable (B252). At H19.16 these held over 600 runs a profile; here a bounded set keeps every later change to
them on every push. A failure prints the seed and the profile that replay it.
*/
const PROFILES = [
	{ name: 'default', flags: [], from: 2000, runs: 30 },
	{ name: 'undo-heavy', flags: ['--undo-weight', '12'], from: 2100, runs: 20 },
	{ name: 'two tabs on one storage', flags: ['--shared-storage'], from: 2200, runs: 20 },
	{ name: 'no reconnects', flags: ['--no-reconnect'], from: 2300, runs: 15 },
	{ name: 'ordinary edits only', flags: ['--no-reconnect', '--no-undo', '--no-network'], from: 2400, runs: 15 },
];
for (const p of PROFILES) {
	test(`U-e, ${p.name}: ${p.runs} seeded runs -- no tab ends apart, invalid, drawn otherwise or unanswered, and no change given up`, async () => {
		const failures = [];
		for (let seed = p.from; seed < p.from + p.runs; seed++) {
			const res = await runSeed(seed, { steps: 160, flags: p.flags });
			for (const v of quiescentFaults(res)) failures.push(`seed ${seed}: ${v.kind} tab${v.tab} ${v.detail.slice(0, 200)}`);
			const lost = res.stats['B183 changes abandoned'] ?? 0;
			if (lost) failures.push(`seed ${seed}: ${lost} change(s) given up as undeliverable`);
		}
		assert.deepEqual(failures, [], `replay any with: node tests/fixtures/sync-fuzz.mjs --trace <seed> ${p.flags.join(' ')}`);
	});
}
