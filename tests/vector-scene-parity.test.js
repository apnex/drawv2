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
