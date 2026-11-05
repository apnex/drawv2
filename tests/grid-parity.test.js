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
import { SWEEP, QUESTIONS, REPLACEMENTS, CLASSES, answersOf, differences, classOf, enc, unboundedAtMove11, unboundedAtMove12, oneRecordAtMove14 } from './fixtures/grid-parity.mjs';

const RECORD = JSON.parse(fs.readFileSync(new URL('./fixtures/grid-parity-record.json', import.meta.url), 'utf8'));
const pick = ({ question, index, old, new: now }) => ({ question, index, old, new: now });
const inputsHash = () => crypto.createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(QUESTIONS).map(([q, d]) => [q, enc(d.inputs())])))).digest('hex');

/*
RESTATED at H26.1's move: the old functions are deleted, so the record is what holds their answers. It was read from them at `readAt`
by tests/fixtures/grid-parity-record.mjs, committed with this test at 2b704b6 and deleted with them, and this test held it to their
live answers until then; what is checked now is that it answers this sweep, every question, every input.
*/
test('H26.1 (acceptance step 4): the record answers the sweep as it stands -- every question, every input, read from the old functions', () => {
	assert.equal(RECORD.inputs, inputsHash(), 'the sweep is the one the record answers');
	assert.equal(RECORD.readAt, 'cee1bb3', 'read at the last commit holding the old arithmetic whole');
	for (const [q, def] of Object.entries(QUESTIONS)) assert.equal(RECORD.old[q].length, def.inputs().length, `${q}: an old answer for every input`);
});

/*
RESTATED at H26.6's move 11 (dev/design/components/PAN-ZOOM.md 5.1 row 11): the old answers held fourteen questions to the old frame --
the point snaps, a zone's corner drag and wrap, a device's size step and span, an anchor's and a zone's fields -- and move 11 holds none of
them to it. So beside the differences recorded with both answers, every difference the extent's removal makes is found live and classed
again from its input and both answers (tests/fixtures/grid-parity.mjs `unboundedAtMove11`): the unbounded lattice's exact answer where the
old one stopped at the frame, a field accepted within PZ31's bound where it was refused past the frame. Any other difference fails, a
recorded one gone fails, and the lists compared are of keys, never the thirteen thousand answers whole.
RESTATED at H26.6's move 12 (PAN-ZOOM.md section 3.8, "Placement"): and placement's answers by rings within the bound, where it walked
the old extent's list -- each such difference judged against a brute-force oracle (`unboundedAtMove12`), its old answer the frame's.
*/
const MOVE_11 = ['snapNode', 'snapIn.node', 'snapIn.zone', 'snapZone', 'zoneResize', 'zoneWrap', 'deviceSizeStep', 'deviceWithinSurface',
	'anchor.x', 'anchor.y', 'zone.x', 'zone.y', 'zone.w', 'zone.h'];
test('H26.1 (acceptance step 4): the replacements answer exactly as the old functions did, -0 told apart, but for the differences recorded with both answers -- and, from H26.6 move 11, the extent\'s removal', () => {
	const found = differences(RECORD.old, answersOf(REPLACEMENTS));
	const recorded = new Map(RECORD.changed.map((d) => [`${d.question}#${d.index}`, d]));
	const live = new Set(found.map((d) => `${d.question}#${d.index}`));
	const asRecorded = (d) => JSON.stringify(recorded.get(`${d.question}#${d.index}`)?.new) === JSON.stringify(d.new) && recorded.has(`${d.question}#${d.index}`);
	const moved = found.filter((d) => !asRecorded(d) && unboundedAtMove11(d));
	const placed = found.filter((d) => !asRecorded(d) && unboundedAtMove12(d));
	// H26.6's move 14: a sweep record of an odd pitch, which no diagram's one grid record can hold, refused (PZ20)
	const oneRecord = found.filter((d) => !asRecorded(d) && oneRecordAtMove14(d));
	assert.deepEqual(oneRecord.map((d) => QUESTIONS.latticePoints.inputs()[d.index].pitch), [25, 7], 'move 14: the two sweep records of an odd pitch, and no other');
	const unexplained = found.filter((d) => !asRecorded(d) && !unboundedAtMove11(d) && !unboundedAtMove12(d) && !oneRecordAtMove14(d)).map((d) => `${d.question} #${d.index} ${JSON.stringify(d.input ?? null)}`);
	assert.deepEqual(unexplained.slice(0, 20), [], `every difference recorded or the extent's removal (${unexplained.length} not)`);
	assert.deepEqual(RECORD.changed.filter((d) => !live.has(`${d.question}#${d.index}`)).map((d) => `${d.question} #${d.index}`), [], 'no recorded difference is gone');
	assert.ok(moved.length > 10000, `the extent's removal reaches the sweep's points beyond the frame: ${moved.length}`);
	assert.deepEqual([...new Set(moved.map((d) => d.question))].sort(), [...MOVE_11].sort(), 'and each of the questions the frame held');
	assert.ok(placed.length >= 40 && placed.some((d) => d.old === 'the canvas is full: every anchor is occupied') && placed.some((d) => typeof d.old === 'string' && d.old.startsWith('nothing free to the')) && placed.some((d) => Array.isArray(d.old)),
		`move 12: placement past the frame -- the full frame answered, a walk past its edge, a nearer point past it (${placed.length})`);
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
	// RESTATED at H26.6's move 11: the extent's removal set aside, as the comparison above sets it aside -- and the planted answer is not it
	const all = differences(RECORD.old, moved).filter((d) => !RECORD.changed.some((c) => c.question === d.question && c.index === d.index));
	const extra = all.filter((d) => !unboundedAtMove11(d) && !unboundedAtMove12(d));
	assert.ok(extra.length >= 1, 'control: a planted difference is found');
	assert.ok(extra.some((d) => d.question === 'snapIn.node' && JSON.stringify(d.new) === '[510,0]'), 'control: the planted one, not the extent\'s removal');
	assert.ok(extra.every((d) => classOf(d) === null), 'control: and no class of 6.3 holds for it');
	// RESTATED at H26.6's move 12: a placement past the frame that is not the nearest free point is no removal of the extent
	const misplaced = answersOf({ ...REPLACEMENTS, resolveAnchor: (i) => (i.board === 0 && i.at.near === 'n3' && !i.at.dir ? ['node', 9, -10, 540, -600] : REPLACEMENTS.resolveAnchor(i)) });
	const wrong = differences(RECORD.old, misplaced).filter((d) => d.question === 'resolveAnchor' && !RECORD.changed.some((c) => c.question === d.question && c.index === d.index) && !unboundedAtMove12(d));
	assert.deepEqual(wrong.map((d) => d.new), [['node', 9, -10, 540, -600]], 'control: a point past the frame two cells out, where one was free one cell out, is not classed');
});
