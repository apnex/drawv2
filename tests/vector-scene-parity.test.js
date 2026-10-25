/*
H26.4 (dev/design/components/VECTOR-SCENE.md section 4, acceptance step 4; sections 6.2 and 6.3; guardrails G4, G6, G7) -- DRAW'S
DRAWING, OLD AND NEW, SIDE BY SIDE: BEFORE ANYTHING IS DELETED, AND ON EVERY GATE AFTER.

Draw moves its drawing onto vector-scene and changes nothing any input of its pages produces, keeping every element it keeps. So today's
renderer and painter, kept verbatim at tests/fixtures/pre-scene/app/src/, run beside the adapter over every document the repository
stores -- its templates -- the parity board and the lab's boards, through what a page does -- a load, a put, a set and a delete of every kind, a head
gained and lost, selections, hover and arming, each mode, labels, the real reveal and the real towers -- with the platform's measure
handed to both sides and without; after every step the trees are equal, element for element and attribute for attribute in order, the
same elements kept and made afresh, each kept one at its former place, the scene's items are what stands under its layers, and the
towers look their glyphs up alike. Today's five editing visuals and the native ones run side by side the same way. The export runs
both ways, today's server/svg.mjs kept verbatim at tests/fixtures/pre-export/, byte-identical for every one of those documents; the
stored diagrams, a server's data and outside the repository, go through the same side-by-side by the fixture's `--docs`. The gesture corpus's overlay, snap layer and grids are, after every step, the trees
today's code wrote; and each input section 6.3 lists is held with both answers. The fixture, tests/fixtures/scene-parity.mjs, says
what each side is and where the old code is kept.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { READ_AT, MOVED, ORIGINALS, fileSha, readRecord, boards, pageSideBySide, VISUAL_SEQUENCES, visualSideBySide, OLD, NEW,
	corpusTrees, compact, treesOpen, edgeAnswers, EDGES } from './fixtures/scene-parity.mjs';
import { SCENARIOS, record } from './fixtures/gesture-corpus.mjs';
import { CORPUS_LISTED_APART } from './fixtures/binding-parity.mjs';   // H26.5: the corpus's scenarios input-binding 0.2.0 changes

const RECORD = readRecord();
const BOARDS = boards();

test('H26.4: today\'s renderer, painter and export are kept whole -- each copy the file as it stood at READ_AT, byte for byte', () => {
	for (const o of ORIGINALS) {
		assert.equal(fileSha(o.copy), o.sha256, `${o.copy} is ${o.file} as it stood at ${READ_AT}`);
		if (!MOVED) assert.equal(fileSha(o.file), o.sha256, `before the move, ${o.file} is still the original`);
	}
	assert.equal(RECORD.readAt, READ_AT, 'the record was written at READ_AT');
});

test('H26.4 (acceptance step 4): over every document, today\'s renderer and the adapter draw alike after every step -- trees, identity, items and glyph lookups', { timeout: 120000 }, () => {
	const names = BOARDS.map(([name]) => name);
	assert.equal(names.filter((n) => n.startsWith('templates/')).length, 4, 'every template the repository stores');
	assert.ok(names.includes('the parity board') && names.filter((n) => n.startsWith('lab ')).length === 13, 'the parity board and the lab\'s thirteen boards');
	let steps = 0, glyphs = 0;
	const reached = new Map();
	for (const [name, doc] of BOARDS) {
		for (const measure of [false, true]) {
			const run = pageSideBySide(name, doc, { measure });
			const differ = run.steps.filter(([, found]) => found.length);
			assert.deepEqual(differ.slice(0, 2), [], `${name}${measure ? ', measured' : ''}: ${differ.length} of ${run.steps.length} steps differ`);
			assert.equal(run.glyphs.A, run.glyphs.B, `${name}: the towers look their glyphs up as often through the shadow as today (o:F10)`);
			steps += run.steps.length; glyphs += run.glyphs.A;
			for (const [label] of run.steps) reached.set(label, (reached.get(label) ?? 0) + 1);
		}
	}
	// the documents reach what the side-by-side must cover, or a pass proves nothing of it -- measured at READ_AT: 1752 steps, a head
	// gained 84 times, 124 reveals, 158 glyph lookups, and every kind deleted and put back
	assert.ok(steps > 1700, `${steps} steps`);
	const n = (label) => reached.get(label) ?? 0;
	assert.ok(n('direct a link forward') >= 80 && n('reveal shows') >= 120 && glyphs > 150, `heads gained ${n('direct a link forward')}, reveals ${n('reveal shows')}, glyph lookups ${glyphs}`);
	for (const kind of ['link', 'node', 'zone', 'group', 'pipe']) assert.ok(n(`delete a ${kind}`) > 0 && n(`put the ${kind} back`) > 0, `a ${kind} deleted and put back`);
	// H26.4 (F1, F5): a pipe the network draws, selected, hovered, armed and cleared -- a hand pipe on every document, a link's pipe where one is
	assert.equal(n('a hand pipe put'), BOARDS.length * 2, 'a hand pipe on every document');
	assert.ok(n('select a pipe') > BOARDS.length * 2 && n('clear its hover and arming') === n('select a pipe'), `pipes selected ${n('select a pipe')} times`);
});

/*
a:F10: revision 1's adapter put every new item twice, 515 moves beyond its items on load. On load each put makes an item: none patches one
or moves one. Puts beyond the items the load ends with are the items a link's creation removes and makes afresh -- the waypoints at its
ends, whose roles it changes (B218), drawn afresh as today's renderer draws them afresh -- which the side-by-side holds to today's.
*/
test('H26.4 (acceptance step 4): on load the adapter puts each item once, with no patch and no move (a:F10)', () => {
	let made = 0, items = 0;
	for (const [name, doc] of BOARDS) {
		const run = pageSideBySide(name, doc);
		assert.deepEqual({ patch: run.loadKinds.patch, move: run.loadKinds.move }, { patch: 0, move: 0 }, `${name}: no put on load patches or moves an item`);
		assert.equal(run.loadKinds.new, run.loadPuts, `${name}: every put on load makes an item`);
		made += run.loadKinds.new; items += run.loadItems;
	}
	assert.ok(items > 200 && made >= items, `${made} item(s) made for the ${items} the loads end with`);
});

test('H26.4 (acceptance step 4): today\'s five editing visuals and the native ones draw alike after every call, the same elements kept', () => {
	let calls = 0;
	for (const [name, sequence] of Object.entries(VISUAL_SEQUENCES)) {
		const differ = visualSideBySide(sequence).filter(([, found]) => found.length);
		assert.deepEqual(differ, [], `${name}: every call alike`);
		calls += sequence.length;
	}
	assert.ok(calls > 50, `${calls} calls`);
});

test('H26.4 (acceptance step 4, G6): the export runs both ways, byte-identical for every document -- today\'s, kept verbatim, and the scene\'s', () => {
	let bytes = 0;
	for (const [name, doc] of BOARDS) {
		const before = OLD.svgDocument(structuredClone(doc)), after = NEW.svgDocument(structuredClone(doc));
		assert.equal(after, before, `${name}: the scene's export writes today's bytes`);
		bytes += after.length;
	}
	assert.ok(bytes > 100000, `the documents drew something to compare: ${bytes} bytes`);
});

/*
RESTATED at H26.5 (dev/design/components/RELEASES-0.2.md section 4, GR6, GR7): but for the corpus's one chord, listed apart with both
answers (tests/fixtures/binding-parity.mjs CORPUS_LISTED_APART). Its right button's release, naming 2 while the press that began with 0
is held, now commits the link (B427): the same trees, the state the left's release reached under input-binding 0.1.0 reached a step
earlier, at the right's -- the record's answer, and that one derived from it.
*/
const TREES_LISTED_APART = {
	'link-right-button-release-ignored': (was) => ({ states: was.states, steps: [...was.steps.slice(0, 3), was.steps[4], was.steps[4]] }),
};
test('H26.4 (acceptance step 4): the gesture corpus\'s overlay, snap layer and grids are, after every step, the trees today\'s code wrote', { timeout: 120000 }, async () => {
	const open = await treesOpen();
	assert.deepEqual(Object.keys(RECORD.trees).sort(), SCENARIOS.map((s) => s.id).sort(), 'the record holds every scenario');
	assert.deepEqual(Object.keys(TREES_LISTED_APART), Object.keys(CORPUS_LISTED_APART), 'the scenarios listed apart are the binding fixture\'s');
	for (const [id, after] of Object.entries(TREES_LISTED_APART)) assert.notDeepEqual(after(RECORD.trees[id]), RECORD.trees[id], `${id}: its two answers differ`);
	let drawn = 0;
	for (const s of SCENARIOS) {
		const live = compact(corpusTrees(s, { record, open }));
		assert.deepEqual(live, TREES_LISTED_APART[s.id]?.(RECORD.trees[s.id]) ?? RECORD.trees[s.id], `${s.id}: every step's trees, attributes in order`);
		drawn += live.states.filter((st) => st.overlay.length || st.snaplayer.length).length;
	}
	assert.ok(drawn > 100, `the corpus draws on the overlay and the snap layer: ${drawn} states`);
});

/*
Section 6.3's inputs, which nothing in draw produces: each held with both answers -- the old from today's renderer and painter, kept
verbatim, the new from the adapter and the native visuals -- and each difference of the kind its bullet says. A class ending
`-control`, and `after-the-call` and `shadow-writes-as-the-platform`, mark inputs beside a bullet that both answer alike, showing where
its line runs.
*/
const PUT = /^put: /;
const CLASSES = {
	// bullet 1: an attribute name not of VS5's form, refused when put, where setAttribute wrote it
	'attribute-form': (o, n) => Array.isArray(o.answered) && n.threw === 'TypeError' && PUT.test(n.message),
	// bullet 1: a value neither a string nor a finite number, refused when put, where `NaN` was written "NaN" -- by a native visual
	'attribute-value': (o, n) => JSON.stringify(o.answered).includes('"NaN"') && n.threw === 'TypeError' && PUT.test(n.message),
	// beside bullet 1: a painter's value goes through the shadow, which writes it as setAttribute did, so "NaN" still
	'shadow-writes-as-the-platform': (o, n) => JSON.stringify(o) === JSON.stringify(n) && JSON.stringify(n).includes('"NaN"'),
	// bullet 2: a tag not of VS5's form
	'tag-form': (o, n) => Array.isArray(o.answered) && n.threw === 'TypeError' && PUT.test(n.message),
	// bullet 3: shapes nested more than 32 deep; and 32, alike
	nesting: (o, n) => Array.isArray(o.answered) && n.threw === 'TypeError' && PUT.test(n.message),
	'nesting-control': (o, n) => JSON.stringify(o) === JSON.stringify(n),
	// bullet 4: a conversion the root cannot answer throws Errors' Error, where toCanvas threw a TypeError or answered a number not finite
	conversion: (o, n) => (o.threw === 'TypeError' || /"(NaN|-?Infinity)"/.test(JSON.stringify(o.answered))) && n.threw === 'Error' && /^toDrawing: /.test(n.message),
	'conversion-control': (o, n) => JSON.stringify(o) === JSON.stringify(n),
	// bullet 5: a root that refuses to take a layer leaves none behind and throws, where the markup held them
	'root-refuses': (o, n) => o.answered?.layers === 11 && n.threw === 'Error' && n.left === 1,
	// bullet 6: a change after the call with no renderer call to follow reaches the page at once, as today
	'after-the-call': (o, n) => JSON.stringify(o) === JSON.stringify(n) && JSON.stringify(n).includes('["width","2"]'),
};
test('H26.4 (section 6.3): each input 6.3 lists answers differently, of the kind its bullet says, both answers held -- and the inputs beside each alike', () => {
	const live = edgeAnswers();
	assert.deepEqual(Object.keys(RECORD.edges), Object.keys(EDGES), 'the record holds every case, in order');
	for (const [id, answer] of Object.entries(live)) {
		assert.deepEqual(answer, RECORD.edges[id], `${id}: both answers are the ones the record holds`);
		assert.ok(CLASSES[answer.class]?.(answer.old, answer.new), `${id} answers as a ${answer.class} case does:\nold ${JSON.stringify(answer.old)}\nnew ${JSON.stringify(answer.new)}`);
	}
	assert.deepEqual([...new Set(Object.values(live).map((a) => a.class))].sort(), Object.keys(CLASSES).sort(), 'every class held by a case');
});
