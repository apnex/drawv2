/*
L1, INPUT STATE -- stage 2 of the gesture system (dev/design/input/GESTURE-SYSTEM.md, section 5.2, invariant G2).

What the input has done is one plain value, reduced by a pure function from input events and the notes actions leave
for the next gesture. The same stream always yields the same state, which is what lets a gesture be replayed exactly.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { initialInputState, track } from '../app/src/input-state.js';

const deepFreeze = (o) => { Object.values(o).forEach((v) => v && typeof v === 'object' && deepFreeze(v)); return Object.freeze(o); };
const at = (x, y) => ({ x, y });

test('the input state is plain data', () => {
	const s = initialInputState();
	assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
	assert.deepEqual(s, { pointer: { at: null }, armed: { placed: null, source: null }, chained: false, press: null });
});

test('track is pure: it never changes what it is given, and the same input gives the same output', () => {
	const s = deepFreeze(track(track(initialInputState(), { type: 'armed', id: 'waypoint-000001' }), { type: 'chained' }));
	for (const e of [{ type: 'down', at: at(1, 2), button: 0 }, { type: 'move', at: at(3, 4) }, { type: 'leave' }, { type: 'armed', id: 'w' }, { type: 'chained' }, { type: 'up', at: at(0, 0) }]) {
		const ev = deepFreeze({ ...e });
		assert.doesNotThrow(() => track(s, ev), `${e.type}: it wrote into a frozen state or event`);
		assert.deepEqual(track(s, ev), track(s, ev));
	}
});

test('a press moves the pointer, hands the armed w over and clears it, and ends a chain', () => {
	let s = track(initialInputState(), { type: 'armed', id: 'waypoint-000001' });
	s = track(s, { type: 'chained' });
	s = track(s, { type: 'down', at: at(60, 0), button: 0 });
	assert.deepEqual(s, { pointer: { at: at(60, 0) }, armed: { placed: null, source: 'waypoint-000001' }, chained: false, press: { at: at(60, 0), travelled: 0 } });
	s = track(s, { type: 'down', at: at(0, 0), button: 2 });
	assert.deepEqual(s.armed, { placed: null, source: null }, 'every press spends it: the next press hands over nothing');
});

test('a move moves the pointer and nothing else; leaving the canvas forgets where it was', () => {
	const armed = track(track(initialInputState(), { type: 'armed', id: 'w' }), { type: 'chained' });
	const moved = track(armed, { type: 'move', at: at(5, 6) });
	assert.deepEqual(moved, { ...armed, pointer: { at: at(5, 6) } });
	assert.deepEqual(track(moved, { type: 'leave' }), { ...armed, pointer: { at: null } });
});

test('events it does not track leave the state as it was -- the very same value', () => {
	const s = track(initialInputState(), { type: 'move', at: at(1, 1) });
	for (const type of ['up', 'cancel', 'double', 'over', 'out', 'key-down', 'key-up']) assert.equal(track(s, { type }), s, `${type}, with no press in progress`);
});

test('G2: a recorded stream replays to the same state, however it is folded', () => {
	const stream = [{ type: 'move', at: at(0, 0) }, { type: 'armed', id: 'waypoint-000001' }, { type: 'down', at: at(0, 0), button: 0 },
		{ type: 'move', at: at(60, 0) }, { type: 'chained' }, { type: 'up', at: at(60, 0) }, { type: 'move', at: at(120, 60) }];
	const whole = stream.reduce(track, initialInputState());
	assert.deepEqual(stream.reduce(track, initialInputState()), whole, 'twice, the same');
	assert.deepEqual(stream.slice(4).reduce(track, stream.slice(0, 4).reduce(track, initialInputState())), whole, 'in two parts, the same');
});

test('G2: the reducer reads no clock, no randomness, no DOM and no instance -- only its arguments', () => {
	const src = fs.readFileSync(new URL('../app/src/input-state.js', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
	assert.doesNotMatch(src, /\bDate\b|Math\.random|\bdocument\b|\bwindow\b|\bthis\b|\bimport\b/);
});

/*
STAGE 3 -- the press, which the click and drag triggers read (app/src/triggers.js). Ruled 2026-09-30: a click is a
release that never travelled more than the threshold from its press, so the FURTHEST point counts.
*/
test('a press records where it began and the furthest it has travelled; a release or a cancel ends it', () => {
	let s = track(initialInputState(), { type: 'down', at: at(0, 0), button: 0 });
	s = track(s, { type: 'move', at: at(30, 40) });
	s = track(s, { type: 'move', at: at(1, 1) });
	assert.equal(s.press.travelled, 50, 'out 50 and back: the furthest counts');
	assert.equal(track(s, { type: 'up', at: at(1, 1) }).press, null);
	assert.equal(track(s, { type: 'cancel' }).press, null);
	assert.equal(track(initialInputState(), { type: 'move', at: at(9, 9) }).press, null, 'a move with no press starts none');
});

test('a chain begins a new drag where it happens: a press still held measures its travel from there', () => {
	let s = track(initialInputState(), { type: 'down', at: at(0, 0), button: 0 });
	s = track(s, { type: 'move', at: at(180, 240) });
	s = track(s, { type: 'chained', at: at(180, 240) });
	assert.deepEqual(s.press, { at: at(180, 240), travelled: 0 });
	assert.equal(track(initialInputState(), { type: 'chained', at: at(5, 5) }).press, null, 'with no press held, a chain starts none');
});

