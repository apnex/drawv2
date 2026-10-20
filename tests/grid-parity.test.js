/*
H26.1 (dev/design/components/SNAP-GRID.md section 4, acceptance step 4; section 6; guardrail G6) -- DRAW'S GRID ARITHMETIC, OLD AND
NEW, SIDE BY SIDE: BEFORE ANYTHING IS DELETED, EACH OLD FUNCTION AND ITS REPLACEMENT ANSWER ONE SWEEP, AND DIFFER ONLY AS 6.3 RULES.

Draw's grids must not move by a pixel and its REST answers must not change by a byte, except where section 6.3 says they change.
tests/fixtures/grid-parity.mjs holds the sweep -- coordinates of both signs, lattice points of both grids and their neighbouring
doubles, ties, cell edges and points one rounding from them, fractions, -0, tiny and huge magnitudes -- and the questions every old
function and its replacement are asked over it, on the node grid and the zone grid, each bounded and unbounded. The old answers are
recorded in tests/fixtures/grid-parity-record.json, read from the old functions themselves (tests/fixtures/grid-parity-record.mjs);
so is every difference the replacements make, with BOTH answers and the 6.3 class it belongs to -- the record of what H26.1 changes,
executable. Each recorded difference is classed again here from its input and its two answers, by an exact rational oracle where
the class is exactness; an unrecorded difference fails, and so does a recorded one that no longer appears.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { SWEEP, QUESTIONS, REPLACEMENTS, CLASSES, answersOf, differences, classOf, enc } from './fixtures/grid-parity.mjs';
import { OLD } from './fixtures/grid-parity-record.mjs';   // the old functions, while they exist

const RECORD = JSON.parse(fs.readFileSync(new URL('./fixtures/grid-parity-record.json', import.meta.url), 'utf8'));
const pick = ({ question, index, old, new: now }) => ({ question, index, old, new: now });
const inputsHash = () => crypto.createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(QUESTIONS).map(([q, d]) => [q, enc(d.inputs())])))).digest('hex');

test('H26.1 (acceptance step 4): the record is the old functions\' own answers, over the sweep as it stands', () => {
	assert.equal(RECORD.inputs, inputsHash(), 'the sweep is the one the record answers');
	const old = answersOf(OLD);
	for (const q of Object.keys(QUESTIONS)) assert.deepEqual(old[q], RECORD.old[q], `${q}: the record holds the old function's answers`);
});

test('H26.1 (acceptance step 4): the replacements answer exactly as the old functions did, -0 told apart, but for the differences recorded with both answers', () => {
	const found = differences(RECORD.old, answersOf(REPLACEMENTS));
	assert.deepEqual(found.map(pick), RECORD.changed.map(pick), 'every difference is recorded, each with the old and the new answer, and no recorded one is gone');
});

test('H26.1 (section 6.3): every recorded difference is one section 6.3 rules -- classed again from its input and both answers', () => {
	assert.ok(RECORD.changed.length > 0, 'control: the sweep reaches the changes 6.3 names, or it proves nothing about them');
	const byClass = {};
	for (const d of RECORD.changed) {
		assert.ok(CLASSES.includes(d.class), `${d.question} #${d.index}: ${d.class} is no class of section 6.3`);
		assert.equal(classOf(d), d.class, `${d.question} #${d.index} (${JSON.stringify(d.input)}): judged again, its class holds`);
		assert.deepEqual(d.input, enc(QUESTIONS[d.question].inputs()[d.index]), `${d.question} #${d.index}: its input is the sweep's`);
		(byClass[d.class] ??= new Set()).add(d.question);
	}
	assert.deepEqual(Object.keys(byClass).sort(), [...CLASSES].sort(), 'each class 6.3 names is reached by the sweep');
	// the node grid, origin 0, never rounds onto a tie: no answer of its differs but past 2^49 (the I10 corpus found the same)
	for (const q of ['cellOf', 'snapLayout.node', 'cellOn.node', 'snapNode', 'snapIn.node', 'anchor.x', 'anchor.y', 'zone.w', 'zone.h', 'spanExtent', 'frameSpan', 'deviceSizeStep', 'deviceWithinSurface', 'latticePoints', 'zoneWrap', 'anchorAt.node', 'anchorAt.zone', 'pxOn.node', 'pxOn.zone']) {
		assert.deepEqual(RECORD.changed.filter((d) => d.question === q && d.class !== 'beyond-2^49').map((d) => d.index), [], `${q}: no difference`);
	}
});

// the cases section 6.3 measured, each held with both answers
const entry = (question, match) => RECORD.changed.find((d) => d.question === question && match(d.input));
test('H26.1 (section 6.3): the changes 6.3 measured are recorded with both answers', () => {
	const pointer = entry('snapIn.zone', (i) => i.x === -60 - 2 ** -47);
	assert.deepEqual([pointer.old[0], pointer.new[0]], [-30, -90], 'on the zone grid a pointer at x = -60 - 2^-47 snaps to -90, where draw snapped it to -30');
	assert.deepEqual(pick(entry('snapZone', (i) => i.x === -60 - 2 ** -47 && i.y === pointer.input.y)).old, pointer.old, 'the zone drag\'s own snap, likewise');
	const zone = entry('zone.x', (v) => v === -30 + 2 ** -48);
	assert.deepEqual([zone.old, zone.new], [true, false], 'a zone stored at x = -30 + 2^-48, which draw\'s check accepted, is refused');
	const walk = entry('resolveAnchor', (i) => i.at.near === 'off' && i.at.dir === 'right');
	assert.deepEqual([walk.old, walk.new], [['node', 3, 0, 180, 0], 'nothing free to the right of off'], 'the walk from a node at x = 1e-14 found x = 180, and finds nothing');
	const inherited = entry('layoutNamed', (n) => n === 'constructor');
	assert.deepEqual([inherited.old, inherited.new], ['Object', null], 'a layout named `constructor` answered as `Object`; it is unknown');
	const garbled = entry('nearestAnchor.node', (i) => i.x === Number.MAX_SAFE_INTEGER && i.y === 0);
	assert.deepEqual([garbled.old[2], garbled.new], [9007199254741020, 'refused'], 'x = 9007199254740991 answered a garbled x; it is refused');
	const edge = entry('nearestAnchor.zone', (i) => i.x === 2 ** 50 && i.y === 2 ** 50);
	assert.deepEqual([edge.old[2], edge.new], [1125899906842650, 'refused'], 'x = 2^50 on the zone grid, refused before the domain\'s edge could move it');
	const kept = RECORD.old['nearestAnchor.zone'][QUESTIONS['nearestAnchor.zone'].inputs().findIndex((i) => i.x === 2 ** 49 && i.y === 2 ** 49)];
	assert.equal(RECORD.changed.some((d) => d.question === 'nearestAnchor.zone' && d.input.x === 2 ** 49 && d.input.y === 2 ** 49), false, 'a coordinate of exactly 2^49 is accepted, and answered as before');
	assert.ok(Array.isArray(kept), 'control: it is in the sweep');
});

test('H26.1 (acceptance step 4): the sweep covers both grids, bounded and unbounded, both signs, -0 and the domain\'s edge -- and the comparison tells -0 from 0', () => {
	assert.ok(SWEEP.coords.some((v) => Object.is(v, -0)) && SWEEP.coords.includes(0), '-0 and 0 are both swept');
	assert.ok(SWEEP.domain.length > 2000 && SWEEP.points.length > 2000, `${SWEEP.domain.length} coordinates and ${SWEEP.points.length} points`);
	for (const v of [-60 - 2 ** -47, -30 + 2 ** -48, 2 ** 49, 2 ** 50, -(2 ** 50), 1e-300, 930, -930, 900, -900, 510, -480]) assert.ok(SWEEP.coords.includes(v), `${v} is swept`);
	const grids = new Set(Object.values(QUESTIONS).map((d) => d.grid?.join(':')).filter(Boolean));
	assert.deepEqual([...grids].sort(), ['0:60', '30:60'], 'the node grid and the zone grid');
	for (const q of ['snapNode', 'snapIn.zone', 'snapZone', 'zoneResize', 'zoneWrap']) assert.ok(QUESTIONS[q].inputs().length > 300, `${q}: the bounded grids`);
	for (const q of ['cellOf', 'snapLayout.zone', 'nearestAnchor.node', 'nearestAnchor.zone']) assert.ok(QUESTIONS[q].inputs().length > 2000, `${q}: the unbounded grids`);
	assert.equal(differences({ cellOf: ['-0'] }, { cellOf: [0] }).length, 1, 'control: -0 and 0 are different answers');
	assert.equal(differences({ cellOf: [0] }, { cellOf: [0] }).length, 0, 'control: equal answers are no difference');
	// and the comparison bites: one replacement answer moved by a pitch at one input is a difference no class holds
	const moved = answersOf({ ...REPLACEMENTS, 'snapIn.node': (p) => (p.x === 450 && p.y === 0 ? [510, 0] : REPLACEMENTS['snapIn.node'](p)) });
	const extra = differences(RECORD.old, moved).filter((d) => !RECORD.changed.some((c) => c.question === d.question && c.index === d.index));
	assert.ok(extra.length >= 1, 'control: a planted difference is found');
	assert.ok(extra.every((d) => classOf(d) === null), 'control: and no class of 6.3 holds for it');
});
