/*
H26.2 (dev/design/components/INPUT-BINDING.md section 4, acceptance steps 3 and 4; section 6.3) -- DRAW ON INPUT-BINDING.

THE EMPTY HANDLE, both answers (acceptance step 4; section 6.3). A handle press whose start finds no entity leaves the handle
gesture live with an empty context -- kept, B409 -- and it is reachable with two pointers: a zone selected, its corner pressed with
Shift held, Shift released with the pointer still down, and the still-drawn handle pressed by a second pointer. That press cancels the
live handle gesture first, whose teardown drops the zone from the selection (H24.3), so the new start finds no zone. What a pointer
cancel then does is the one behaviour, beside the exact threshold, that H26.2 changes: before the move the cancel body throws on the
empty context while the slot still names the gesture, so the gesture stays live, the teardown and onGestureEnd never run, and the
next move throws too; after it, the session has ended the gesture before the body runs and the rest runs in a finally, so the
exception still propagates, the gesture has ended, the teardown and onGestureEnd have run, and the next move follows the idle path.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeInput, key, pointer } from './fixtures/client-harness.mjs';
import { makeZone } from '../zones/make-zone.mjs';
import { liveGesture } from './fixtures/binding-parity.mjs';

// the two answers; the code answers the one NOW names
const ANSWERS = {
	// read from app/src/input.js at 97d9bd0, before the move (tests/fixtures/binding-parity.mjs READ_AT)
	before: {
		started: 'handle',
		cancel: { threw: "Cannot read properties of undefined (reading 'preview')", live: 'handle', teardown: 0, gestureEnd: 0 },
		move: { threw: "Cannot read properties of undefined (reading 'preview')", live: 'handle', idle: false },
	},
	// section 6.3: the cancel outcome first, the body on it, the teardown, onGestureEnd and afterShiftUpPress in a finally
	after: {
		started: 'handle',
		cancel: { threw: "Cannot read properties of undefined (reading 'preview')", live: null, teardown: 1, gestureEnd: 1 },
		move: { threw: null, live: null, idle: true },
	},
};
const NOW = 'before';

const corner = (x, y, m = {}) => pointer(x, y, { ...m, target: { tagName: 'rect', classList: { contains: (c) => c === 'handle' }, dataset: { corner: 'se' }, closest: () => null } });
const thrown = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };

test(`H26.2 (section 6.3; B409 kept): a pointer cancel over the empty handle gesture -- the ${NOW === 'before' ? 'old' : 'new'} answer, both stated`, () => {
	const h = makeInput();
	try {
		const z = makeZone(h.model, { x: -150, y: -150, w: 300, h: 300 });
		h.model.put('zone', z);
		h.selection.set([z.id]);
		let ends = 0;
		h.input.onGestureEnd = () => { ends++; };
		h.capture.onDown(corner(150, 150, { shiftKey: true }));   // the corner pressed with Shift held: the handle gesture, its zone selected
		h.capture.onKeyUp(key('Shift'));                            // Shift released, the pointer still down: the zone goes when the press ends
		h.capture.onDown(corner(150, 150));                         // a second pointer on the still-drawn handle
		assert.deepEqual(h.selection.list(), [], 'the cancel of the live handle gesture dropped the zone (H24.3), before the new start ran');
		const got = { started: liveGesture(h) };
		const torn = () => h.calls.filter((c) => c.name === 'readout.clearTransient').length;
		const before = { teardown: torn(), ends };
		const cancel = thrown(() => h.capture.onCancel(pointer(150, 150, { buttons: 0 })));
		got.cancel = { threw: cancel, live: liveGesture(h), teardown: torn() - before.teardown, gestureEnd: ends - before.ends };
		const idleBefore = h.calls.filter((c) => c.name === 'tools.trackHand').length;
		const move = thrown(() => h.capture.onMove(pointer(200, 200)));
		got.move = { threw: move, live: liveGesture(h), idle: h.calls.filter((c) => c.name === 'tools.trackHand').length > idleBefore };
		assert.deepEqual(got, ANSWERS[NOW]);
		assert.notDeepEqual(ANSWERS.before, ANSWERS.after, 'the two answers differ, as section 6.3 says they do');
	} finally { h.restore(); }
});
