/*
H26.2 (dev/design/components/INPUT-BINDING.md section 4, acceptance step 4; section 6; guardrail G5) -- DRAW'S GESTURE LIFECYCLE AND ITS
HELP, AS THE CODE BEFORE THE MOVE ONTO INPUT-BINDING RAN AND WROTE THEM, ON EVERY GATE.

Draw moved its matcher and its gesture lifecycle onto input-binding and changed no behaviour but the two section 6.3 names. Over every
scenario of the gesture corpus, the same body runs for each input and the same gesture is live after it as the record read from the
code before the move says; and the help overlay is line for line what the old code generated. The fixture,
tests/fixtures/binding-parity.mjs, says what each record is.
RESTATED at H26.8's binding move (dev/design/components/NATIVE-SHAPES.md sections 4.1 to 4.3, NS10): the lifecycle and the help alone,
the move's guard -- each record pinned byte for byte below. The matcher's and the press's comparisons with the old code, kept at
tests/fixtures/pre-binding/, went with it: draw composes its tables in input-binding's own form, and the adapter they compared is gone.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { READ_AT, COMPOSITIONS, withInput, lifecycleOf, LIFECYCLE_RECORD, HELP_RECORD, LISTED_APART, CORPUS_LISTED_APART, lifecycleOfSteps } from './fixtures/binding-parity.mjs';
import { SCENARIOS } from './fixtures/gesture-corpus.mjs';
import { helpSections } from '../app/src/help.js';

const readJson = (url) => JSON.parse(fs.readFileSync(url, 'utf8'));

// H26.8 (section 4.1): the records the binding move answers to, byte for byte as they were committed -- never regenerated
test('H26.8 (section 4.1): the lifecycle and help records are byte-identical to the ones the code before the move wrote', () => {
	const sha256 = (url) => crypto.createHash('sha256').update(fs.readFileSync(url)).digest('hex');
	assert.equal(sha256(LIFECYCLE_RECORD), '04cf5c8ed9ea0f3d26f26b8967e7a3c00671330fb5d49f4718e9e2da713e29c7', 'tests/fixtures/binding-parity-lifecycle.json');
	assert.equal(sha256(HELP_RECORD), '53de8f6823d1baaa4d4aabada7540d8a84a44ba8d435c89665b86fa4f4e48732', 'tests/fixtures/binding-parity-help.json');
	assert.equal(readJson(LIFECYCLE_RECORD).readAt, READ_AT, 'the lifecycle record was read at READ_AT');
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
RESTATED at H26.6's move 9 (dev/design/components/PAN-ZOOM.md appendix A, move 9) -- THE RECORD'S ONE DIFFERENCE, NAMED: a section of its
own, `the view`, after `pointer`, listing the view's five rows (app/src/recognize.js VIEW_RULES), on the page and in the lab alike; every
other section line for line the record's. The record itself stays byte for byte as committed (the test above), its difference named here.
RESTATED at H26.6's move 10 (PAN-ZOOM.md section 3.7, PZ28; 3.6, PZ27) -- AND THE KEYS' TWO: the view's five keys, five lines after `Tab`'s
(app/src/keymap.js), and Space's line saying the datum is set on release; every other key line the record's, in its order.
*/
const VIEW_KEY_LINES = [
	{ inputs: ['=', '+'], label: 'zoom one level in, about the centre', context: null },
	{ inputs: ['-'], label: 'zoom one level out, about the centre', context: null },
	{ inputs: ['Shift+0'], label: 'back to the default zoom, 1x', context: null },
	{ inputs: ['Shift+1'], label: 'fit the whole diagram, at the nearest zoom that shows it', context: null },
	{ inputs: ['h'], label: 'home: the centre to 0, 0, the zoom kept', context: null },
];
const SPACE_LINE = { before: 'set the datum at the pointer', after: 'set the datum where the pointer is, on release; held with a left drag it pans instead' };
// the record's keys section as move 10 makes it: the five view-key lines after Tab's, Space's label the new one
const keysNow = (keys) => {
	const lines = keys.lines.map((l) => (l.inputs[0] === 'Space' && l.label === SPACE_LINE.before ? { ...l, label: SPACE_LINE.after } : l));
	const tab = lines.findIndex((l) => l.inputs[0] === 'Tab');
	return { ...keys, lines: [...lines.slice(0, tab + 1), ...VIEW_KEY_LINES, ...lines.slice(tab + 1)] };
};
const VIEW_SECTION = { title: 'the view', lines: [
	{ inputs: ['the wheel, or a two-finger scroll'], label: 'pan the view, in every mode; the wheel never zooms', context: null },
	{ inputs: ['a pinch', 'Ctrl + the wheel'], label: 'zoom one level out or in about the pointer', context: null },
	{ inputs: ['middle-drag anywhere'], label: 'pan the view once the press travels 4 pixels; a click does nothing', context: null },
	{ inputs: ['right-drag the canvas'], label: 'pan the view once the press travels 4 pixels; a click does nothing', context: 'open ground: a zone without Shift among it' },
	{ inputs: ['Space + left-drag anywhere'], label: 'pan the view once the press travels 4 pixels; a click does nothing', context: null },
] };
test('H26.2 (acceptance step 5; D13): the help overlay\'s sections are line for line those the old code generated, on the page and in the lab -- H26.6 move 9\'s view section and move 10\'s keys the differences', () => {
	const rec = readJson(HELP_RECORD);
	for (const [composition, opts] of COMPOSITIONS) withInput(opts, (h) => {
		const now = helpSections(h.input.bindings()), at = now.findIndex((s) => s.title === 'the view');
		assert.equal(now[at - 1].title, 'pointer', `${composition}: the view's section follows the pointer's`);
		assert.deepEqual(now[at], VIEW_SECTION, `${composition}: the view's section, the named difference`);
		assert.deepEqual(now.filter((s, i) => i !== at), rec.sections[composition].map((s) => (s.title === 'keys' ? keysNow(s) : s)), `${composition}: every other section the record's, the keys' two differences aside`);
		assert.equal(rec.sections[composition][0].lines.filter((l) => l.label === SPACE_LINE.before).length, 1, `${composition}: the record's Space line, the one restated`);
	});
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
