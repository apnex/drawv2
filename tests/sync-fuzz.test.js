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
A BOUNDED SET OF SEEDS, every profile's edits on: no tab ends apart from the server, the server's document stays valid, every
tab draws what the server draws, and nothing a tab committed is left unanswered. U-e sets the gate's final bound.
*/
test('U-a: over 20 seeded runs no tab ends apart from the server, invalid, drawn otherwise, or with a change unanswered', async () => {
	const failures = [];
	for (let seed = 1000; seed < 1020; seed++) {
		const res = await runSeed(seed, { steps: 160 });
		for (const v of quiescentFaults(res)) failures.push(`seed ${seed}: ${v.kind} tab${v.tab} ${v.detail.slice(0, 200)}`);
	}
	assert.deepEqual(failures, [], `replay any with: node tests/fixtures/sync-fuzz.mjs --trace <seed>`);
});
