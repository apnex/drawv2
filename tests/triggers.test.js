/*
L2, TRIGGERS -- stage 3 of the gesture system (dev/design/input/GESTURE-SYSTEM.md, section 5.3).

"Was that a click or a drag?" is answered once, from the input state, and every gesture asks it the same way. Ruled
2026-09-30: a click is a release that never travelled more than 4px from its press -- the furthest point counts.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DRAG_THRESHOLD, dragging, releaseTrigger } from '../app/src/triggers.js';
import { initialInputState, track } from '../app/src/input-state.js';

const pressed = (...moves) => moves.reduce((s, [x, y]) => track(s, { type: 'move', at: { x, y } }), track(initialInputState(), { type: 'down', at: { x: 0, y: 0 }, button: 0 }));

test('the threshold is 4px, and a press within it is a click', () => {
	assert.equal(DRAG_THRESHOLD, 4);
	assert.equal(releaseTrigger(pressed()), 'click');
	assert.equal(releaseTrigger(pressed([4, 0])), 'click', 'exactly the threshold is still a click');
	assert.equal(releaseTrigger(pressed([0, 4.01])), 'drop');
});

test('the same movement means the same thing wherever it happens: a 3px diagonal is past the threshold', () => {
	assert.equal(releaseTrigger(pressed([3, 3])), 'drop', 'about 4.24px from the press');
});

test('out and back is a drag: the furthest point counts, not the last', () => {
	const s = pressed([200, 150], [2, 1]);
	assert.equal(dragging(s), true);
	assert.equal(releaseTrigger(s), 'drop');
});

test('no press, no drag', () => {
	assert.equal(dragging(initialInputState()), false);
});

test('decided once: no gesture in app/src/input.js measures a click itself', () => {
	const src = fs.readFileSync(new URL('../app/src/input.js', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
	assert.doesNotMatch(src, /box\.w < DRAG_THRESHOLD|dist\(pos, this\.ctx\.start\)/, 'the marquee box test and the escalation distance are gone');
	const uses = src.split('\n').filter((l) => !l.startsWith('import')).join('\n');
	assert.equal((uses.match(/DRAG_THRESHOLD/g) ?? []).length, 1, 'one use left: the link release asks where a click landed, not whether it was one');
});
