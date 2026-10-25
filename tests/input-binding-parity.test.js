/*
H26.2 (dev/design/components/INPUT-BINDING.md section 4, acceptance step 4; section 6; guardrail G5) -- DRAW'S MATCHER, PRESS AND
GESTURE LIFECYCLE, OLD AND NEW, SIDE BY SIDE: BEFORE ANYTHING IS DELETED, AND ON EVERY GATE AFTER.

Draw moves its matcher and its gesture lifecycle onto input-binding and changes no behaviour but the two section 6.3 names: a travel
within about 10^-15 of the threshold decided exactly, and a throwing cancel body ending its gesture (tests/input-binding-move.test.js
holds the second). So every table draw composes answers through the old matcher and the adapter alike, on the product page's
composition and the lab's; the old press and the session's agree over generated streams but for the recorded differences of the
first kind, each held with both answers and classed again here; and over every scenario of the gesture corpus, the same body runs for
each input and the same gesture is live after it as the record read from the code before the move says. The fixture,
tests/fixtures/binding-parity.mjs, says what each side is and where the old code is kept.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { READ_AT, MOVED, ORIGINALS, OLD, NEW, tenantsOf, idsOf, tablesOf, GRAMMAR, COMPOSITIONS, withInput, SWEEPS, compareMatcher, grammarAgrees,
	STREAMS, SEED, THRESHOLD, pressStreams, pressDifferences, classOf, lifecycleOf, PRESS_RECORD, LIFECYCLE_RECORD,
	LISTED_APART, CORPUS_LISTED_APART, lifecycleOfSteps } from './fixtures/binding-parity.mjs';
import { SCENARIOS } from './fixtures/gesture-corpus.mjs';
import { helpSections } from '../app/src/help.js';

const readJson = (url) => JSON.parse(fs.readFileSync(url, 'utf8'));

test('H26.2: the old matcher, press and triggers are kept whole -- each copy is the original at READ_AT, byte for byte', () => {
	for (const o of ORIGINALS) {
		assert.equal(o.copySha(), o.sha256, `tests/fixtures/${o.copy} is ${o.file} as it stood at ${READ_AT}`);
		if (!MOVED) assert.equal(o.liveSha(), o.sha256, `before the move, ${o.file} is still the original`);
	}
	assert.equal(readJson(PRESS_RECORD).readAt, READ_AT, 'the press record was read at READ_AT');
	assert.equal(readJson(LIFECYCLE_RECORD).readAt, READ_AT, 'and so was the lifecycle record');
});

const TABLE_NAMES = ['keys', 'presses', 'double', 'key-releases', 'run', 'link', 'marquee', 'ctrlClick', 'pressDrag', 'cloneDrag', 'zone-draw', 'tool', 'handle:zone', 'handle:link'];
for (const [composition, opts] of COMPOSITIONS) {
	test(`H26.2: on the ${composition}'s composition, every table answers through the old matcher and the adapter alike -- row id and claim`, () => withInput(opts, (h) => {
		const tables = tablesOf(h.input);
		assert.deepEqual(Object.keys(tables).sort(), [...TABLE_NAMES].sort(), 'the fourteen tables an Input composes, section 2.2');
		for (const name of TABLE_NAMES) {
			const tenants = tenantsOf(tables[name]);
			assert.deepEqual(idsOf(OLD.composeRules(...tenants)), idsOf(tables[name]), `${name}: the tenants are the ones the Input composed, in its order`);
			assert.deepEqual(idsOf(NEW.composeRules(...tenants)), idsOf(tables[name]), `${name}: and the adapter composes them alike`);
			const r = compareMatcher(tenants, SWEEPS[name]);
			assert.deepEqual(r.differ, [], `${name}: every answer equal`);
			assert.deepEqual(r.foreign, [], `${name}: the adapter hands back the row it was given`);
			assert.deepEqual(r.overlaps.now, r.overlaps.old, `${name}: the same overlaps, as the gate reads them`);
			assert.ok(r.asked > 0, `${name}: asked something`);
		}
		assert.equal(idsOf(tables.run).length, composition === 'lab' ? 0 : 4, 'the lab composes no run mode, the page its four rows');
	}));
}

test('H26.2: the network\'s drag grammar answers through both, and its own composition answers as the adapter does', () => {
	for (const name of Object.keys(GRAMMAR)) {
		const r = compareMatcher(GRAMMAR[name], SWEEPS[name]);
		assert.deepEqual([r.differ, r.foreign], [[], []], `${name}: every answer equal`);
		assert.deepEqual(r.overlaps.now, r.overlaps.old);
		assert.ok(r.asked > 0);
	}
	assert.deepEqual(grammarAgrees(), [], 'plugins/network/grammar.mjs kindOf and pipeFor answer the one row the sweep finds');
});

test('H26.2: a table built to overlap, to claim and to refuse answers alike -- the control that the comparison can see a difference', () => {
	const on = (k) => (e) => e.key === k;
	const tenants = [{ owner: 'a', rules: [{ id: 'first', on: on('k'), run: 'x' }, { id: 'quiet', on: on('q'), prevent: false, run: 'x' },
		{ id: 'help', on: on('h'), mutates: false, duringHelp: true, run: 'x' }, { id: 'locked', on: on('l'), mutates: false, whileReadOnly: true, run: 'x' }] },
	{ owner: 'b', rules: [{ id: 'second', on: on('k'), run: 'x' }, { id: 'cond', on: on('c'), when: (s) => s.ok, run: 'x' }] }];
	const facts = ['k', 'q', 'h', 'l', 'c', 'z'].map((key) => ({ key }));
	const sweeps = [{ facts, contexts: [{ ok: true }, { ok: false }], guards: [{}, { readOnly: true }, { helpOpen: true }, { gesturing: true }] }];
	const r = compareMatcher(tenants, sweeps);
	assert.deepEqual([r.differ, r.foreign], [[], []]);
	assert.equal(r.overlaps.old.length, 2, 'k hits two rows in each context when no guard refuses them');
	assert.deepEqual(r.overlaps.now, r.overlaps.old);
	const lying = { ...NEW, resolveInput: (t, f, c, g) => { const a = NEW.resolveInput(t, f, c, g); return f.key === 'q' ? { ...a, claimed: !a.claimed } : a; } };
	const o = OLD.composeRules(...tenants), n = lying.composeRules(...tenants);
	assert.notEqual(OLD.resolveInput(o, { key: 'q' }, {}, {}).claimed, lying.resolveInput(n, { key: 'q' }, {}, {}).claimed, 'a claim told otherwise is a difference');
});

test('H26.2 (section 6.3, D7): the old press and the session\'s agree over generated streams but for the recorded differences, each the exact threshold\'s', () => {
	const rec = readJson(PRESS_RECORD);
	assert.deepEqual([rec.streams, rec.seed, rec.threshold], [STREAMS, SEED, THRESHOLD], 'the streams the record answers');
	const streams = pressStreams();
	const found = pressDifferences(streams);
	assert.deepEqual(found, rec.differences.map(({ stream, output, old, new: now }) => ({ stream, output, old, new: now })), 'every difference recorded with both answers, and no recorded one gone');
	assert.ok(found.length > 0, 'the streams cross the band where the arithmetic rounds, so the comparison is not vacuous');
	for (const d of found) {
		const c = classOf(streams[d.stream], d.output);
		assert.equal(c.class, 'exact-threshold', `stream ${d.stream} output ${d.output}: a move within 10^-14 of the threshold judged two ways`);
		assert.equal(d.new, c.exactAnswer, `stream ${d.stream} output ${d.output}: the session answers the exact distance`);
	}
	const moves = streams.flat().filter(([op]) => op === 'move').length, ups = streams.flat().filter(([op]) => op === 'up').length;
	assert.ok(moves > 10000 && ups > 2000, `asked ${moves} moves and ${ups} releases`);
});

// RESTATED at H26.5 (dev/design/components/RELEASES-0.2.md section 4, GR7): but for the corpus's one chord, listed apart with both answers
test('H26.2 (acceptance step 4): over every scenario of the gesture corpus, the same body runs for each input and the same gesture is live after it', () => {
	const rec = readJson(LIFECYCLE_RECORD).scenarios;
	assert.deepEqual(Object.keys(rec).sort(), SCENARIOS.map((s) => s.id).sort(), 'every scenario recorded, those acceptance step 4 added among them');
	const differ = [];
	for (const s of SCENARIOS) {
		const now = lifecycleOf(s);
		const expected = CORPUS_LISTED_APART[s.id]?.after ?? rec[s.id];
		if (JSON.stringify(now) !== JSON.stringify(expected)) differ.push(`${s.id}: ${JSON.stringify(now)}, was ${JSON.stringify(expected)}`);
	}
	assert.deepEqual(differ, []);
	for (const [id, { after }] of Object.entries(CORPUS_LISTED_APART)) {
		assert.ok(rec[id], `${id}: listed apart, and in the corpus`);
		assert.notDeepEqual(after, rec[id], `${id}: its two answers differ -- the record's, read before the move, and input-binding 0.2.0's`);
	}
	const bodies = new Set(Object.values(rec).flat().flatMap((step) => step.split('>')[0].split(',').filter(Boolean)));
	for (const b of ['link.start', 'link.update', 'link.commit', 'link.cancel', 'move.update', 'move.commit', 'move.cancel', 'clone.update', 'clone.commit', 'clone.cancel',
		'pending.start', 'pending.update', "clone-pending.start", 'clone-pending.commit', 'handle.start', 'handle.update', 'handle.commit', 'handle.cancel',
		'box.start', 'box.update', 'box.commit', 'box.cancel', 'marquee.start', 'marquee.update', 'marquee.commit', 'marquee.cancel', 'chainFrom', 'startMove', 'startClone']) {
		assert.ok(bodies.has(b), `the corpus runs ${b} somewhere, so the record can see it`);
	}
});

/*
The help overlay is generated from the tables an input resolves against (D13), and moving the tables onto input-binding must not move a
line of it: its sections, on the page's composition and the lab's, as the old code generated them -- recorded at 7c8215b, whose product
code is 8793699's -- 37 key lines, 12 pointer lines, 7 release lines and the page's 4 run-mode lines (acceptance step 5).
*/
test('H26.2 (acceptance step 5; D13): the help overlay\'s sections are line for line those the old code generated, on the page and in the lab', () => {
	const rec = readJson(new URL('./fixtures/binding-parity-help.json', import.meta.url));
	for (const [composition, opts] of COMPOSITIONS) withInput(opts, (h) => assert.deepEqual(helpSections(h.input.bindings()), rec.sections[composition], composition));
	assert.deepEqual(rec.sections.page.map((s) => s.lines.length), [37, 12, 7, 4]);
	assert.deepEqual(rec.sections.lab.map((s) => s.lines.length), [37, 12, 7]);
});

/*
H26.5 (dev/design/components/RELEASES-0.2.md section 4, GR7; RD14, RD18) -- THE CHORD AND TWO-POINTER SEQUENCES, LISTED APART WITH BOTH
ANSWERS. Outside the corpus, whose facts name one pointer and whose releases name the button that began the press: each sequence's
lifecycle under input-binding 0.1.0, read before the move, and under 0.2.0, which the code answers now. Each pair differs only where the
release rule (B427) or another pointer (RD18) says it does: the chord's last release commits, and another pointer's move and release run
nothing, the press's own pointer going on to commit.
*/
test('H26.5 (GR7): the chord and two-pointer sequences are listed apart, each answering 0.2.0\'s lifecycle, its 0.1.0 answer kept beside it', () => {
	assert.deepEqual(LISTED_APART.map((s) => s.kind).sort(), ['chord', 'two-pointer', 'two-pointer']);
	for (const s of LISTED_APART) {
		assert.deepEqual(lifecycleOfSteps(s.steps), s.after, `${s.id}: ${s.why}`);
		assert.equal(s.before.length, s.steps.length, `${s.id}: an answer for each input, before`);
		assert.notDeepEqual(s.before, s.after, `${s.id}: the two answers differ`);
		const changed = s.before.map((b, i) => (b === s.after[i] ? null : i)).filter((i) => i !== null);
		const other = s.steps.map(([, , , , f], i) => (f.pointerId !== undefined && f.pointerId !== s.steps[0][4].pointerId ? i : null)).filter((i) => i !== null);
		if (s.kind === 'two-pointer') {
			for (const i of other) assert.match(s.after[i], /^>/, `${s.id}: step ${i}, another pointer's, runs nothing`);
			assert.ok(changed.every((i) => i >= other[0]), `${s.id}: nothing changes before the other pointer's first event`);
		} else assert.deepEqual(changed, [s.steps.length - 1], `${s.id}: the last release alone answers otherwise -- it commits`);
	}
});
