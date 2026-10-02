/*
THE PLANNER CORPUS, replayed -- stage PL-1 of the planner as a sovereign system (dev/design/planner/PLANNER-SYSTEM.md).

Every case in tests/fixtures/planner-corpus.mjs is planned by the real `plan()` and must produce exactly the result
frozen in tests/fixtures/planner-corpus.json: the ops and the inverse of an accepted request, or the error and opIndex
of a refused one. Stages PL-2 to PL-5 change no outcome, so this stays green through all of them; a stage that changes
a result has changed behaviour, and must say so and be ruled.

Its reach is MEASURED, not listed: the generated cases must fire the stranded pass, the orphan sweep and the join, in
the composition each belongs to, often enough that a restructuring which broke one could not pass by luck. And undo of
every accepted plan must restore the board (PR8; collection order aside, which is B10).
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CASES, record, readGolden, GENERATED_PER_COMPOSITION, compareModelPipes } from './fixtures/planner-corpus.mjs';
import { CLASSIC_LINKS } from '../planner/tenants.mjs';

const golden = readGolden();
const runs = new Map(CASES.map((c) => [c.id, record(c)]));
const generated = (compose) => CASES.filter((c) => c.compose === compose && c.id.includes('/gen-'));

test('the corpus and its golden file name the same cases', () => {
	assert.deepEqual(CASES.map((c) => c.id).sort(), Object.keys(golden).sort());
	assert.equal(new Set(CASES.map((c) => c.id)).size, CASES.length, 'ids are unique');
});

// the named cases one by one, so a failure names the rule
for (const c of CASES.filter((x) => !x.id.includes('/gen-'))) {
	test(`planner corpus: ${c.id}`, () => {
		assert.deepEqual(runs.get(c.id).golden, golden[c.id]);
	});
}

// the generated cases per composition, naming the first that differ and whether its input or its result moved
for (const compose of ['production', 'network']) {
	test(`planner corpus: ${GENERATED_PER_COMPOSITION} generated ${compose} requests replay exactly`, () => {
		const moved = generated(compose).filter((c) => JSON.stringify(runs.get(c.id).golden) !== JSON.stringify(golden[c.id]));
		const say = moved.slice(0, 5).map((c) => `${c.id}: ${runs.get(c.id).golden.input === golden[c.id].input ? 'the result changed' : 'the INPUT changed (the generator moved)'}`);
		assert.equal(moved.length, 0, say.join('\n'));
		if (moved.length) assert.deepEqual(runs.get(moved[0].id).golden, golden[moved[0].id]);
	});
}

test('undo of every accepted plan restores the board', () => {
	const bad = CASES.filter((c) => runs.get(c.id).reach.undoRestores === false).map((c) => c.id);
	assert.deepEqual(bad, []);
});

/*
THE REACH, counted over the generated cases. The floors sit well under what the corpus reaches when it was written
(production: sweep 45, join 38; network: stranded 96, sweep 145, join 34, join skipped 46 -- of 1000 each), so they
fail on a pass that stopped firing, not on a tuned generator.
*/
test('the generated cases reach the stranded pass, the sweep and the join, in each composition', () => {
	const count = (compose, f) => generated(compose).filter((c) => f(runs.get(c.id))).length;
	const floors = {
		production: { swept: 30, joined: 25, multiOpAccepted: 300, refused: 200 },
		network: { stranded: 60, swept: 100, joined: 20, joinDeclined: 30, multiOpAccepted: 300, refused: 200 },
	};
	const measure = {
		stranded: (r) => r.reach.stranded > 0,
		swept: (r) => r.reach.swept > 0,
		joined: (r) => r.reach.joined > 0,
		joinDeclined: (r) => r.reach.joinSkipped > 0,
		multiOpAccepted: (r) => r.golden.result.ok && r.golden.result.ops.length > 1,
		refused: (r) => r.reach.refused,
	};
	for (const [compose, f] of Object.entries(floors)) {
		for (const [name, floor] of Object.entries(f)) {
			const n = count(compose, measure[name]);
			assert.ok(n >= floor, `${compose}: ${name} in ${n} generated cases, under the floor of ${floor}`);
		}
	}
	assert.ok(!CLASSIC_LINKS.reactions.some((r) => r.phase === 'stranded'), 'production strands nothing: its tenant has no stranded pass');
});

test('the named cases fire the pass each is named for', () => {
	const r = (id) => runs.get(id).reach;
	assert.ok(r('network/stranded-pin-deleted').stranded > 0);
	assert.equal(r('production/stranded-pin-deleted').stranded, 0, 'production strands nothing');
	assert.ok(r('production/sweep-bend-released').swept > 0);
	assert.equal(r('network/sweep-sheltered-by-hand-pipe').swept, 0, 'a hand pipe shelters its anchor');
	assert.ok(r('production/join-at-junction').joined > 0);
	assert.equal(r('network/join-off-transit').joined, 0, 'no join where transit is off (TR-5)');
	assert.equal(r('production/join-off-transit').joined, 1, 'production has no transit, and joins');
	for (const id of ['production/join-declined-duplicate-bend', 'production/join-declined-self-conflict']) {
		assert.equal(r(id).joined, 0, `${id}: declined`);
		assert.equal(r(id).joinSkipped, 1, `${id}: and counted as skipped`);
	}
});

/*
H17.22 N-b -- PIPES IN THE MODEL CHANGE NOTHING BUT WHERE PIPES LIVE. Every network case, named and generated, planned
again with its pipes as entities of the network's `pipe` kind and the planner's own pipe reactions (network/network.mjs):
the same verdict, the same ops and inverse on everything but pipes, exactly the pipes the session's prune and sweep leave,
and undo restores the pipes with everything else -- which the session never could (UNDO-01).
*/
test('N-b: every network case makes the same edit with its pipes in the model, leaves the pipes the session would, and undoes them', () => {
	const strip = (ops) => ops.filter((o) => o.kind !== 'pipe');
	const wrong = [];
	let accepted = 0, pipeOps = 0;
	for (const c of CASES.filter((x) => x.compose === 'network')) {
		const r = compareModelPipes(c);
		const say = (why) => wrong.push(`${c.id}: ${why}`);
		if (r.session.ok !== r.withPipes.ok) { say(`the session ${r.session.ok ? 'accepts' : 'refuses'} and the model ${r.withPipes.ok ? 'accepts' : `refuses: ${r.withPipes.error}`}`); continue; }
		if (!r.session.ok) { if (r.session.error !== r.withPipes.error || r.session.opIndex !== r.withPipes.opIndex) say(`refused differently: ${r.session.error} / ${r.withPipes.error}`); continue; }
		accepted++;
		pipeOps += r.withPipes.ops.length - strip(r.withPipes.ops).length;
		if (JSON.stringify(strip(r.withPipes.ops)) !== JSON.stringify(r.session.ops)) say('its ops differ beyond pipes');
		if (JSON.stringify(strip(r.withPipes.inverse)) !== JSON.stringify(r.session.inverse)) say('its inverse differs beyond pipes');
		if (JSON.stringify(r.got) !== JSON.stringify(r.expected)) say(`leaves pipes ${r.got.join(' ')} where the session leaves ${r.expected.join(' ')}`);
		if (!r.undoRestores) say('undo does not restore it, pipes included');
	}
	assert.deepEqual(wrong.slice(0, 8), [], `${wrong.length} case(s) differ`);
	// and the comparison is not vacuous: plenty accepted, and the reactions changed pipes in many of them
	assert.ok(accepted > 500, `${accepted} accepted network cases`);
	assert.ok(pipeOps > 300, `${pipeOps} pipe ops made by the planner's reactions`);
});
