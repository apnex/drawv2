/*
H26.8's picks move (dev/design/components/NATIVE-SHAPES.md section 3.2; reading 3, o:F2; appendix A, the picks move) -- A HAND PIPE'S MARK
KEEPS TODAY'S MEANING. The pipe painter declares its pick, a mark naming no word, `{ mark: true, on: 'data-select' }`, and
app/src/recognize.js `hitFactsOf` takes no mark pick, as it takes no handle -- so the press rows, the overlay's facts and the generated help
see a mark only through `hit.mark`, the locked fallback included. The design measured it on a copy of the tree before the move
(~/taceng/drawv2-eval-runs/h26-native-shapes/probes/pipe-mark-recognition.mjs): taken as a drawn word, the pipe changed 8 locked presses
and added two help lines. Held here as a test: every press on a hand pipe's mark -- each button, every combination of Shift, Ctrl and
Alt, locked or not, a tool held or not, 64 in all -- matches the row that probe recorded of production, and the press table composed
with the mark's pick documents exactly the help lines of the table composed without it.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeInput } from './fixtures/client-harness.mjs';
import { picksOf } from '../app/src/pick.js';
import { pressRows, hitFactsOf } from '../app/src/recognize.js';
import { placesOf } from '../app/src/snap.js';
import { PRODUCT_CANVAS } from '../product/canvas.mjs';
import { pipeEntity } from '../plugins/network/pipe-kind.mjs';

// the row a press matched, recorded of production by the design's probe, per case
const TODAY = {
	'writer no tool left': 'press/pending', 'writer no tool left+Shift': 'press/pending', 'writer no tool left+Ctrl': null, 'writer no tool left+Shift+Ctrl': null, 'writer no tool left+Alt': 'press/pending', 'writer no tool left+Shift+Alt': 'press/pending', 'writer no tool left+Ctrl+Alt': null, 'writer no tool left+Shift+Ctrl+Alt': null, 'writer no tool right': null, 'writer no tool right+Shift': null, 'writer no tool right+Ctrl': null, 'writer no tool right+Shift+Ctrl': null, 'writer no tool right+Alt': 'chord/deleteUnderCursor', 'writer no tool right+Shift+Alt': 'chord/deleteUnderCursor', 'writer no tool right+Ctrl+Alt': 'chord/deleteUnderCursor', 'writer no tool right+Shift+Ctrl+Alt': 'chord/deleteUnderCursor',
	'writer hand left': 'press/pending', 'writer hand left+Shift': 'press/pending', 'writer hand left+Ctrl': null, 'writer hand left+Shift+Ctrl': null, 'writer hand left+Alt': 'press/pending', 'writer hand left+Shift+Alt': 'press/pending', 'writer hand left+Ctrl+Alt': null, 'writer hand left+Shift+Ctrl+Alt': null, 'writer hand right': null, 'writer hand right+Shift': null, 'writer hand right+Ctrl': null, 'writer hand right+Shift+Ctrl': null, 'writer hand right+Alt': 'chord/deleteUnderCursor', 'writer hand right+Shift+Alt': 'chord/deleteUnderCursor', 'writer hand right+Ctrl+Alt': 'chord/deleteUnderCursor', 'writer hand right+Shift+Ctrl+Alt': 'chord/deleteUnderCursor',
	'locked no tool left': 'press/pending', 'locked no tool left+Shift': 'press/pending', 'locked no tool left+Ctrl': null, 'locked no tool left+Shift+Ctrl': null, 'locked no tool left+Alt': 'press/pending', 'locked no tool left+Shift+Alt': 'press/pending', 'locked no tool left+Ctrl+Alt': null, 'locked no tool left+Shift+Ctrl+Alt': null, 'locked no tool right': null, 'locked no tool right+Shift': null, 'locked no tool right+Ctrl': null, 'locked no tool right+Shift+Ctrl': null, 'locked no tool right+Alt': null, 'locked no tool right+Shift+Alt': null, 'locked no tool right+Ctrl+Alt': null, 'locked no tool right+Shift+Ctrl+Alt': null,
	'locked hand left': 'press/pending', 'locked hand left+Shift': 'press/pending', 'locked hand left+Ctrl': null, 'locked hand left+Shift+Ctrl': null, 'locked hand left+Alt': 'press/pending', 'locked hand left+Shift+Alt': 'press/pending', 'locked hand left+Ctrl+Alt': null, 'locked hand left+Shift+Ctrl+Alt': null, 'locked hand right': null, 'locked hand right+Shift': null, 'locked hand right+Ctrl': null, 'locked hand right+Shift+Ctrl': null, 'locked hand right+Alt': null, 'locked hand right+Shift+Alt': null, 'locked hand right+Ctrl+Alt': null, 'locked hand right+Shift+Ctrl+Alt': null,
};
const blank = { target: null, overTarget: false, action: null, input: null, owner: null, control: false, entity: false };
// the parts as they were before the move: the pipe painter declaring no pick
const WITHOUT_MARK = PRODUCT_CANVAS.map((p) => (p.owner !== 'network' ? p : { ...p, painters: p.painters.map((x) => (x.kind === 'pipe' ? { ...x, picks: [] } : x)) }));

test('a press on a hand pipe\'s mark -- each button and modifier, locked or not, a tool held or not -- matches the row it matched before the move', () => {
	const id = pipeEntity('node-00000a', 'node-00000c', 'hand').id, got = {};
	for (const readOnly of [false, true]) for (const hand of [null, 'router']) {
		const h = makeInput({ readOnly });
		try {
			if (hand) h.tools.setHand(hand);
			for (const button of [0, 2]) for (let mods = 0; mods < 8; mods++) {
				const evt = { type: 'down', button, key: undefined, repeat: false, shiftKey: !!(mods & 1), ctrlKey: !!(mods & 2), altKey: !!(mods & 4), metaKey: false,
					at: { x: 0, y: 0 }, on: { kind: 'pipe', id, mark: true }, pointerId: 1, region: blank, claimed: false, capture: false };
				const row = h.input.pressRules.matchInput(evt, h.input.situation(), { readOnly }).match?.row;
				got[`${readOnly ? 'locked' : 'writer'} ${hand ? 'hand' : 'no tool'} ${button ? 'right' : 'left'}${mods & 1 ? '+Shift' : ''}${mods & 2 ? '+Ctrl' : ''}${mods & 4 ? '+Alt' : ''}`] = row
					? `${row.id}${row.gesture ? `/${row.gesture}` : ''}${row.run ? `/${row.run}` : ''}` : null;
			}
		} finally { h.restore(); }
	}
	assert.equal(Object.keys(got).length, 64);
	assert.deepEqual(got, TODAY);
});

test('the mark\'s pick is taken by no fact and changes no help line: the press table with it documents what the table without it does', () => {
	assert.ok(picksOf(PRODUCT_CANVAS).some((p) => p.mark && p.on === 'data-select'), 'control: the pipe painter declares its mark');
	assert.deepEqual([...hitFactsOf(picksOf(PRODUCT_CANVAS), placesOf(PRODUCT_CANVAS))], [...hitFactsOf(picksOf(WITHOUT_MARK), placesOf(WITHOUT_MARK))], 'the same facts, word for word');
	const help = (parts) => pressRows(picksOf(parts), placesOf(parts)).flatMap((r) => r.input ?? []);
	assert.deepEqual(help(PRODUCT_CANVAS), help(WITHOUT_MARK), 'line for line');
	assert.ok(help(PRODUCT_CANVAS).length > 8, 'control: the help lines were read');
});
