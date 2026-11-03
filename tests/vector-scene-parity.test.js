/*
H26.4 (dev/design/components/VECTOR-SCENE.md section 4, acceptance step 4; guardrail G7) -- THE GESTURE CORPUS'S EDITING TREES: the
overlay's, the snap layer's and the grids' trees after every step of the gesture corpus are the trees today's code wrote before H26.4
(tests/fixtures/scene-parity-record.json, `trees`), through the fixture tests/fixtures/scene-parity.mjs.

RESTATED at H26.8's painters move (dev/design/components/NATIVE-SHAPES.md sections 4.2 and 4.5, NS10; appendix A, "delete the copies
and their L4 entries once each assertion of tests/vector-scene-parity.test.js has a named replacement"). This file held the side-by-side:
today's renderer, painter and export kept verbatim at tests/fixtures/pre-scene/ and tests/fixtures/pre-export/, run beside the adapter.
The copies ran the live plugins' painters, which answer shapes since the move, so they went with it once the record the drawing moves
answer to passed under its allowances. Each assertion, and what holds it now:
  the copies kept whole, byte for byte          -- the copies are deleted; nothing remains to keep whole
  every document and change drawn alike, old    -- tests/native-record.test.js: the record of ca492da's drawing, over the 18 stored
  and new, trees, identity, items, glyph          documents and the coverage boards in view, edit and run and every pipe trigger,
  lookups                                         state, mark and change, held under the painters move's allowances; element identity
                                                  is the one thing it does not record (4.2); the towers' glyph lookups went with
                                                  `glyphOf` (T6), the aim a mark the native record holds
  on load each item put once, no patch, no move -- tests/native-shapes.test.js (GR12): every record document loaded in each mode,
                                                  every put making an item, as many as today's, none moved, none patched but a
                                                  tower the movers aim within the load (a mark-only put); and the native record's
                                                  loads from the pipes move
  the five editing visuals drawn alike, old and -- this file: the corpus's editing trees, below, every visual the corpus draws held
  new                                             to the trees today's code wrote; the visuals are untouched by the move
  the export both ways, byte-identical          -- tests/native-record.test.js: every stored document's and coverage board's export
                                                  equal to the bytes ca492da wrote; tests/svgexport.test.js
  the corpus's editing trees                    -- this file, kept
  section 6.3's inputs, both answers            -- each was the old code's answer beside the adapter's: the adapter's, refused as
                                                  vector-scene refuses it, is the component's contract, held by its own suite; the
                                                  two that were the shadow's (a value written as setAttribute did, a change after
                                                  the call) went with the shadow
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readRecord, corpusTrees, compact, treesOpen } from './fixtures/scene-parity.mjs';
import { SCENARIOS, record } from './fixtures/gesture-corpus.mjs';
import { CORPUS_LISTED_APART } from './fixtures/binding-parity.mjs';   // H26.5: the corpus's scenarios input-binding 0.2.0 changes
import { makeInput, dotsOf } from './fixtures/client-harness.mjs';

const RECORD = readRecord();

/*
RESTATED at H26.5 (dev/design/components/RELEASES-0.2.md section 4, GR6, GR7): but for the corpus's one chord, listed apart with both
answers (tests/fixtures/binding-parity.mjs CORPUS_LISTED_APART). Its right button's release, naming 2 while the press that began with 0
is held, now commits the link (B427): the same trees, the state the left's release reached under input-binding 0.1.0 reached a step
earlier, at the right's -- the record's answer, and that one derived from it.
*/
const TREES_LISTED_APART = {
	'link-right-button-release-ignored': (was) => ({ states: was.states, steps: [...was.steps.slice(0, 3), was.steps[4], was.steps[4]] }),
};
/*
RESTATED at H26.6's move 8 (dev/design/components/PAN-ZOOM.md section 3.7; section 7, GR12, as the native record reads it): the crosshair's
line ends and the grids are the view's. Each crosshair line spans what the harness's root shows, `visible()`'s region -- 0 to 1,920 by 0
to 1,080 at a scale of one -- where it spanned the old surface, so its ends are set aside on both sides and held to that region here; the
grids are drawn from the view, so they are held here apart: one drawing at every step of every scenario, no corpus step moving the view
or loading another grid, and that drawing every lattice point the root shows, each full. The overlay, and the crosshair's place, as
recorded.
*/
const isLine = (n) => n.tag === 'LINE' && n.attrs.some(([k, v]) => k === 'class' && v.split(' ').includes('gridline'));
const attr = (n, k) => n.attrs.find(([a]) => a === k)?.[1];
const endsOf = (n) => (attr(n, 'x1') === attr(n, 'x2') ? ['y1', 'y2'] : ['x1', 'x2']);
const endless = (n) => (isLine(n) ? { ...n, attrs: n.attrs.filter(([k]) => !endsOf(n).includes(k)) } : n);
const viewed = (state) => ({ overlay: state.overlay, snaplayer: state.snaplayer.map(endless), grids: 'the view\'s' });
const steps = (trees) => trees.steps.map((i) => trees.states[i]);
test('H26.6 move 8: the corpus\'s harness draws its grids from the view -- every point its root shows, each full', async () => {
	const open = await treesOpen(), h = makeInput();
	try {
		open(h);
		const nodes = dotsOf(h.layers['#grid-nodes']), zones = dotsOf(h.layers['#grid-zones']);
		assert.deepEqual([nodes.length, zones.length], [33 * 19, 32 * 18], 'the lattices over 0..1920 by 0..1080');
		assert.deepEqual([nodes[0], nodes.at(-1), zones[0], zones.at(-1)].map((d) => [d.x, d.y, d.opacity]), [[0, 0, 1], [1920, 1080, 1], [30, 30, 1], [1890, 1050, 1]]);
	} finally { h.restore(); }
});
test('H26.4 (acceptance step 4): the gesture corpus\'s overlay, snap layer and grids are, after every step, the trees today\'s code wrote -- H26.6 move 8: the crosshair\'s ends and the grids the view\'s', { timeout: 120000 }, async () => {
	const open = await treesOpen();
	assert.deepEqual(Object.keys(RECORD.trees).sort(), SCENARIOS.map((s) => s.id).sort(), 'the record holds every scenario');
	assert.deepEqual(Object.keys(TREES_LISTED_APART), Object.keys(CORPUS_LISTED_APART), 'the scenarios listed apart are the binding fixture\'s');
	for (const [id, after] of Object.entries(TREES_LISTED_APART)) assert.notDeepEqual(after(RECORD.trees[id]), RECORD.trees[id], `${id}: its two answers differ`);
	let drawn = 0;
	let lines = 0;
	for (const s of SCENARIOS) {
		const live = steps(compact(corpusTrees(s, { record, open })));
		const was = steps(TREES_LISTED_APART[s.id]?.(RECORD.trees[s.id]) ?? RECORD.trees[s.id]);
		assert.deepEqual(compact(live.map(viewed)), compact(was.map(viewed)), `${s.id}: every step's trees, attributes in order, but the crosshair's ends and the grids`);
		assert.ok(live.every((st) => JSON.stringify(st.grids) === JSON.stringify(live[0].grids)), `${s.id}: one drawing of the grids at every step`);
		for (const n of live.flatMap((st) => st.snaplayer).filter(isLine)) {
			assert.deepEqual(endsOf(n).map((k) => Number(attr(n, k))), endsOf(n)[0] === 'y1' ? [0, 1080] : [0, 1920], `${s.id}: a crosshair line across the root's region`);
			lines++;
		}
		drawn += compact(live).states.filter((st) => st.overlay.length || st.snaplayer.length).length;
	}
	assert.ok(lines > 20, `the corpus draws the crosshair: ${lines} lines`);
	assert.ok(drawn > 100, `the corpus draws on the overlay and the snap layer: ${drawn} states`);
});
