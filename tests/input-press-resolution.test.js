/*
H26.5 (dev/design/components/RELEASES-0.2.md section 4, "the press resolved in one call"; RD19, GR7; input-binding's IB15) -- DRAW'S
POLICY WHERE resolvePress PUTS IT.

Input's press is now one call, `resolvePress(evt, { match, cancelled })`, which holds the order draw wrote out by hand -- the press made,
`match` asked only of a press the live gesture did not take, the live gesture cancelled when the match means something, then the
start -- and calls draw's code where its policy sits. The corpus's lifecycle comparison (tests/input-binding-parity.test.js) holds that
the same gesture bodies run in the same order; these hold the rest of the press body, as it was before the move:
- a press the live gesture does not take closes an open label editor, committing it, and hides the hand -- whether or not a row means it;
- a press the live gesture takes -- a chain's left press -- does neither, `match` never asked;
- the teardown of a gesture the press cancels is handed the press's own event, so H24.3's drop asks whether Shift is held at that press;
- in run mode the session holds the press too, taken or not, so its release is a click or a drop by its travel.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeInput, key, pointer, seedNodes } from './fixtures/client-harness.mjs';
import { makeZone } from '../plugins/zones/make-zone.mjs';

// RESTATED at H26.8's picks move: the element the harness's renderer drew (`h.at`), picked by item, where a stand-in answered selectors
const onNode = (h, id, x, y, mod = {}) => pointer(x, y, { target: h.at(id), ...mod });
const onZone = (h, z, x, y, mod = {}) => pointer(x, y, { target: h.at({ key: z.id, where: { class: 'zone-rect' } }), ...mod });
const named = (h, name) => h.calls.filter((c) => c.name === name).map((c) => c.args);

test('H26.5 (IB15): a press the live gesture does not take closes an open label editor, committing it, and hides the hand -- a row meaning it or none', () => {
	for (const [what, evt] of [['a press a row means: the ground, a marquee', pointer(300, 300)], ['a press no row means: the middle button', pointer(300, 300, { button: 1, buttons: 4 })]]) {
		const h = makeInput();
		try {
			h.labels.isOpen = () => true;
			h.capture.onDown(evt);
			assert.deepEqual(named(h, 'labels.close'), [[true]], `${what}: the editor closed, its edit committed`);
			assert.equal(named(h, 'tools.hideHand').length, 1, `${what}: and the hand hidden`);
		} finally { h.restore(); }
	}
});

test('H26.5 (IB15): a press the live gesture takes -- a chain\'s left press -- neither closes the label editor nor hides the hand', () => {
	const h = makeInput();
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [360, 0]]);
		h.capture.onDown(onNode(h, a.id, 0, 0));
		h.capture.onMove(onNode(h, b.id, 360, 0));
		h.capture.onUp(onNode(h, b.id, 360, 0, { shiftKey: true }));   // the link a-b, and a chain on from b
		assert.equal(h.input.isGesturing(), true, 'precondition: a chain is live');
		h.labels.isOpen = () => true;
		h.reset();
		h.capture.onDown(pointer(360, 360));                        // the chain's own press: the link declares the left button
		assert.deepEqual([named(h, 'labels.close'), named(h, 'tools.hideHand')], [[], []], 'the press taken: no match asked, nothing closed or hidden');
		assert.equal(h.input.isGesturing(), true, 'and the chain goes on');
	} finally { h.restore(); }
});

test('H26.5 (IB15): the teardown of a gesture the press cancels is handed the press\'s event -- Shift held at that press keeps a zone H24.3 would drop', () => {
	for (const shiftKey of [true, false]) {
		const h = makeInput();
		try {
			const z = makeZone(h.model, { x: 150, y: 150, w: 120, h: 120 }); h.model.put('zone', z);
			h.capture.onKeyDown(key('Shift', { code: 'ShiftLeft', shiftKey: true }));
			h.capture.onDown(onZone(h, z, 200, 200, { button: 2, buttons: 2, shiftKey: true }));   // Shift+right on the zone: it is picked
			h.capture.onMove(onZone(h, z, 260, 200, { button: -1, buttons: 2, shiftKey: true }));
			assert.deepEqual([h.selection.list(), h.input.isGesturing()], [[z.id], true], 'precondition: the zone picked, and its drag live');
			h.capture.onKeyUp(key('Shift', { code: 'ShiftLeft' }));   // Shift released while the drag owns the pointer: the zone owed a drop
			assert.deepEqual(h.selection.list(), [z.id], 'precondition: kept while the drag lasts (shiftUpPending)');
			h.capture.onDown(pointer(-600, -400, { shiftKey }));      // a press a row means, on the ground, cancels the drag
			assert.deepEqual(h.selection.list(), shiftKey ? [z.id] : [], shiftKey ? 'Shift held at the press: the zone kept' : 'Shift not held at the press: the zone dropped');
		} finally { h.restore(); }
	}
});

test('H26.5 (IB15): in run mode the session holds the press too, so its release is a drop by its travel', () => {
	const h = makeInput();
	try {
		h.renderer.setMode('run');
		const seen = [], real = h.input.release.bind(h.input);
		h.input.release = (e) => { try { return real(e); } finally { seen.push(e.trigger); } };
		h.capture.onDown(pointer(300, 300));
		h.capture.onMove(pointer(340, 300));
		h.capture.onUp(pointer(340, 300, { buttons: 0 }));
		h.capture.onDown(pointer(300, 300));
		h.capture.onUp(pointer(300, 300, { buttons: 0 }));
		assert.deepEqual(seen, ['drop', 'click'], 'a press that travelled is a drop, one that did not a click');
	} finally { h.restore(); }
});
