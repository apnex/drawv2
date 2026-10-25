/*
H26.5 (dev/design/components/RELEASES-0.2.md section 4, "`input-capture` `0.2.0`: B413 fixed"; RD14) -- A FOCUS LOSS CLEARS WHAT SHIFT,
ALT AND CONTROL LEFT, AND NOTHING ELSE.

B413: nothing listened for `blur`, so a key released while the page lacked focus made no key-up -- Shift released elsewhere left the
zone grid shown and a zone H24.3 drops still selected, and Alt or Control released elsewhere left a delete or clone affordance armed.
Draw now lists `blur` (app/src/capture.js), and Input's `blur` runs what those releases would have run, as far as delivered input can
have activated it: Shift's whole cleanup (`onShiftUp`) when Shift is OWED -- set by Shift's own key-down and by every pointer or key
event Input is handed whose `shiftKey` is true, cleared only when `onShiftUp` runs -- and the arming's (`onArmingUp`) with the blur's
event, whose modifiers are all false. It cancels no gesture and ends no press: a drag continues across a focus change, as it did.

Each case is driven through the harness's capture, the focus loss the host's `blur` (tests/fixtures/client-harness.mjs `onBlur`), so
each B413 case reproduces the defect against input-capture 0.1.0 -- which adds no blur listener, so the focus loss reaches nothing --
and holds it fixed after. The two controls hold what must not change: zones Ctrl+A selected with no Shift held stay selected across a
focus loss (B352), and Shift pressed and released while typing leaves nothing owed.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeInput, key, pointer, seedNodes } from './fixtures/client-harness.mjs';
import { makeZone } from '../plugins/zones/make-zone.mjs';

// the key source's focus loss, as a browser's FocusEvent offers it to a capture: a time and a preventDefault, no modifier
const focusLost = (h) => h.capture.onBlur({ timeStamp: 1, preventDefault() {}, stopPropagation() {} });
const shiftDown = (h, mod = {}) => h.capture.onKeyDown(key('Shift', { code: 'ShiftLeft', shiftKey: true, ...mod }));
const shiftUp = (h, mod = {}) => h.capture.onKeyUp(key('Shift', { code: 'ShiftLeft', ...mod }));
const inField = { target: { tagName: 'INPUT', closest: () => null } };   // a key typed into a field: capture drops its key-down (app/src/capture.js)
const onZone = (z, x, y, mod = {}) => pointer(x, y, { target: { tagName: 'rect', classList: { contains: () => false }, dataset: {}, closest: (s) => (s.includes('zone') ? { id: z.id } : null) }, ...mod });
const rightOnZone = (z, x, y, mod = {}) => onZone(z, x, y, { button: 2, buttons: 2, ...mod });   // H24.5: a zone is pressed with the right button
const overNode = (id, x, y, mod = {}) => pointer(x, y, { target: { tagName: 'g', closest: () => ({ id }) }, ...mod });
const onGround = (x, y, mod = {}) => pointer(x, y, mod);
const gridShown = (h) => h.svg.classList.contains('zonegrid');
// whether the renderer was last told to mark `id` armed -- replayed from what Input told the renderer, the boundary these assert at
const armedNow = (h, id) => h.calls.reduce((on, c) => {
	if (c.name === 'renderer.setState' && c.args[0] === id && c.args[1] === 'armed') return !!c.args[2];
	if (c.name === 'renderer.clearState' && c.args[0] === id && c.args.slice(1).includes('armed')) return false;
	return on;
}, false);
const board = (h) => {
	const [n] = seedNodes(h.model, [[-300, 0]]);
	const z = makeZone(h.model, { x: 150, y: 150, w: 120, h: 120 }); h.model.put('zone', z);
	return { n, z };
};

test('B413: Shift held, focus lost, Shift released elsewhere -- the zone grid is hidden and the Shift-picked zone deselected', () => {
	const h = makeInput();
	try {
		const { z } = board(h);
		shiftDown(h);
		h.capture.onDown(rightOnZone(z, 200, 200, { shiftKey: true }));
		h.capture.onUp(rightOnZone(z, 200, 200, { shiftKey: true }));
		assert.deepEqual([gridShown(h), h.selection.list()], [true, [z.id]], 'precondition: Shift shows the zone grid, and Shift+right click selects the zone');
		focusLost(h);
		assert.equal(gridShown(h), false, 'the focus loss stands in for the Shift release the canvas never saw: the grid hidden');
		assert.deepEqual(h.selection.list(), [], 'and the zone dropped, as H24.3 drops it when Shift is released');
		// Shift's own release never arrives; the next press and release of Shift behave as ever
		shiftDown(h);
		assert.equal(gridShown(h), true, 'Shift pressed again shows the grid');
		shiftUp(h);
		assert.equal(gridShown(h), false);
	} finally { h.restore(); }
});

test('B413: the same, with a pointer event whose shiftKey is false between the Shift press and the focus loss -- still owed', () => {
	const h = makeInput();
	try {
		const { z } = board(h);
		shiftDown(h);
		h.capture.onDown(rightOnZone(z, 200, 200, { shiftKey: true }));
		h.capture.onUp(rightOnZone(z, 200, 200, { shiftKey: true }));
		h.capture.onMove(onGround(400, 400));   // a pointer event saying Shift is up: it hides the grid, and the zone stays selected
		assert.deepEqual([gridShown(h), h.selection.list()], [false, [z.id]], 'precondition: the event hid the grid and left the zone selected');
		focusLost(h);
		assert.deepEqual(h.selection.list(), [], 'the cleanup was owed since Shift went down, whatever a later event said: the zone dropped');
	} finally { h.restore(); }
});

test('B413: Shift held before the page had focus, a Shift+right click on a zone, its release, then the focus loss', () => {
	const h = makeInput();
	try {
		const { z } = board(h);
		h.capture.onDown(rightOnZone(z, 200, 200, { shiftKey: true }));   // no Shift key-down ever reached the canvas
		h.capture.onUp(rightOnZone(z, 200, 200, { shiftKey: true }));
		assert.deepEqual([gridShown(h), h.selection.list()], [true, [z.id]], 'precondition: the press showed the grid and selected the zone');
		focusLost(h);
		assert.deepEqual([gridShown(h), h.selection.list()], [false, []], 'the events carrying Shift owed its cleanup: grid hidden, zone dropped');
	} finally { h.restore(); }
});

test('B413: Shift pressed while typing in a field, its key-down dropped, then a Shift-press on the canvas and the focus loss', () => {
	const h = makeInput();
	try {
		const { z } = board(h);
		shiftDown(h, inField);
		assert.equal(gridShown(h), false, 'precondition: the key-down typed into a field reached nothing');
		h.capture.onDown(rightOnZone(z, 200, 200, { shiftKey: true }));
		h.capture.onUp(rightOnZone(z, 200, 200, { shiftKey: true }));
		assert.deepEqual([gridShown(h), h.selection.list()], [true, [z.id]], 'precondition: the Shift-press showed the grid and selected the zone');
		focusLost(h);
		assert.deepEqual([gridShown(h), h.selection.list()], [false, []], 'grid hidden, zone dropped');
	} finally { h.restore(); }
});

test('B413: Alt held over a node, focus lost -- the node is disarmed; and Control\'s clone arming likewise', () => {
	const h = makeInput();
	try {
		const { n } = board(h);
		h.capture.onHover(overNode(n.id, -300, 0), true);
		h.capture.onKeyDown(key('Alt', { code: 'AltLeft', altKey: true }));
		assert.equal(armedNow(h, n.id), true, 'precondition: Alt over the node arms it to delete');
		focusLost(h);
		assert.equal(armedNow(h, n.id), false, 'the focus loss stands in for Alt\'s release: the node disarmed');
		h.capture.onKeyDown(key('Control', { code: 'ControlLeft', ctrlKey: true }));
		assert.ok(h.stateCalls('renderer.setState').some(([id, cls, on]) => id === n.id && cls === 'armed-clone' && on), 'precondition: Control over the node arms it to clone');
		h.reset();
		focusLost(h);
		assert.ok(h.stateCalls('renderer.clearState').some(([id, ...classes]) => id === n.id && classes.includes('armed-clone')), 'and the clone affordance goes, as Control\'s release would take it');
	} finally { h.restore(); }
});

/*
H26.5's verification: Shift AND Alt held over a device, then the focus loss -- both cleanups, item 1's and item 3's, in one focus loss.
Shift's cleanup disarms only a hovered zone, never a device, so a blur running one cleanup or the other -- Shift's when owed, else the
arming's -- leaves the device armed; each case above holds one key alone, and could not tell.
*/
test('B413: Shift and Alt held over a device, focus lost -- the zone grid is hidden AND the device disarmed', () => {
	const h = makeInput();
	try {
		const { n } = board(h);
		shiftDown(h);
		h.capture.onHover(overNode(n.id, -300, 0, { shiftKey: true }), true);
		h.capture.onKeyDown(key('Alt', { code: 'AltLeft', altKey: true, shiftKey: true }));
		assert.deepEqual([gridShown(h), armedNow(h, n.id)], [true, true], 'precondition: Shift shows the zone grid, and Alt over the device arms it');
		focusLost(h);
		assert.deepEqual([gridShown(h), armedNow(h, n.id)], [false, false], 'both releases the canvas never saw stood in for: the grid hidden and the device disarmed');
	} finally { h.restore(); }
});

test('B413 (section 4, item 1): Shift owed while a press owns the pointer -- the zone stays selected until the press ends, then drops', () => {
	const h = makeInput();
	try {
		const { z } = board(h);
		shiftDown(h);
		h.capture.onDown(rightOnZone(z, 200, 200, { shiftKey: true }));
		h.capture.onMove(rightOnZone(z, 260, 200, { shiftKey: true }));
		h.capture.onMove(rightOnZone(z, 320, 200, { shiftKey: true }));
		focusLost(h);
		assert.deepEqual(h.selection.list(), [z.id], 'mid-drag the zone stays selected: the drag owns the pointer, and the focus loss cancelled nothing');
		// RESTATED at H26.5's verification: no check of the grid here. The drag's own moves hid it before the focus loss -- an assertion that
		// it was hidden passed on the old release too -- so a focus loss hiding it cannot be seen mid-drag; the tests above hold it at rest
		h.capture.onMove(rightOnZone(z, 380, 200));
		h.capture.onUp(rightOnZone(z, 380, 200));
		assert.notEqual(h.model.get('zone', z.id).x, 150, 'the drag went on across the focus loss and moved the zone');
		assert.deepEqual(h.selection.list(), [], 'and once it ended, Shift up, the zone is dropped (shiftUpPending, afterShiftUpPress)');
	} finally { h.restore(); }
});

test('B413: every pointer or key event Input is handed with shiftKey true owes Shift\'s cleanup; the same events without it owe none', () => {
	// the middle button, which no press row takes: a press and a release that change nothing but what they carry
	const events = {
		press: (h, s) => h.capture.onDown(onGround(420, -360, { button: 1, buttons: 4, shiftKey: s })),
		release: (h, s) => h.capture.onUp(onGround(420, -360, { button: 1, buttons: 0, shiftKey: s })),
		move: (h, s) => h.capture.onMove(onGround(420, -360, { buttons: 0, shiftKey: s })),
		hover: (h, s) => h.capture.onHover(onGround(420, -360, { shiftKey: s }), true),
		double: (h, s) => h.capture.onDblClick(onGround(420, -360, { shiftKey: s })),
		cancel: (h, s) => h.capture.onCancel(onGround(420, -360, { shiftKey: s })),
		keyDown: (h, s) => h.capture.onKeyDown(key('F9', { shiftKey: s })),
		keyUp: (h, s) => h.capture.onKeyUp(key('F9', { shiftKey: s })),
		/*
		H26.5's input-binding move (the verifier's V6, V7): ANOTHER POINTER's move and release, while pointer 1 holds a middle press that
		carries no Shift. The session ignores them and Input returns at once (RD18) -- but Shift is the keyboard's, whichever pointer's
		event says it is held, so each still owes Shift's cleanup: the marking comes before the return.
		*/
		'another pointer\'s move': (h, s) => {
			h.capture.onDown(onGround(420, -360, { button: 1, buttons: 4, pointerId: 1 }));
			h.capture.onMove(onGround(300, -300, { buttons: 1, pointerId: 2, pointerType: 'touch', shiftKey: s }));
		},
		'another pointer\'s release': (h, s) => {
			h.capture.onDown(onGround(420, -360, { button: 1, buttons: 4, pointerId: 1 }));
			h.capture.onUp(onGround(300, -300, { buttons: 0, pointerId: 2, pointerType: 'touch', shiftKey: s }));
		},
	};
	for (const [name, fire] of Object.entries(events)) {
		for (const shift of [true, false]) {
			const h = makeInput();
			try {
				const { n, z } = board(h);
				h.capture.onKeyDown(key('a', { ctrlKey: true }));   // Ctrl+A takes the zones too, no Shift held (B352)
				assert.deepEqual(h.selection.list().sort(), [n.id, z.id].sort(), `${name}: precondition, Ctrl+A selects the device and the zone`);
				fire(h, shift);
				assert.deepEqual(h.selection.list().sort(), [n.id, z.id].sort(), `${name}: the event alone changes no selection`);
				focusLost(h);
				if (shift) assert.deepEqual(h.selection.list(), [n.id], `${name} with Shift: owed, so the focus loss drops the zone`);
				else assert.deepEqual(h.selection.list().sort(), [n.id, z.id].sort(), `${name} without Shift: nothing owed, the zone kept`);
			} finally { h.restore(); }
		}
	}
});

test('B413: Shift\'s own key-down owes its cleanup whatever its event says, as onShiftDown shows the grid whatever it says', () => {
	const h = makeInput();
	try {
		const { n } = board(h);
		h.capture.onKeyDown(key('a', { ctrlKey: true }));
		shiftDown(h, { shiftKey: false });   // a key-down of Shift whose shiftKey is false: the row is the key's, not the flag's
		assert.equal(gridShown(h), true, 'precondition: Shift\'s row ran');
		focusLost(h);
		assert.deepEqual([gridShown(h), h.selection.list()], [false, [n.id]], 'owed: the grid hidden, Ctrl+A\'s zone dropped as Shift\'s release drops it');
	} finally { h.restore(); }
});

test('B413: the obligation is cleared only when Shift\'s cleanup runs -- once a focus loss ran it, the next owes nothing', () => {
	const h = makeInput();
	try {
		const { n, z } = board(h);
		shiftDown(h);
		focusLost(h);
		h.capture.onKeyDown(key('a', { ctrlKey: true }));
		focusLost(h);
		assert.deepEqual(h.selection.list().sort(), [n.id, z.id].sort(), 'the first focus loss ran the cleanup and cleared what was owed: Ctrl+A\'s zone kept');
		shiftDown(h); shiftUp(h);
		h.capture.onKeyDown(key('a', { ctrlKey: true }));
		focusLost(h);
		assert.deepEqual(h.selection.list().sort(), [n.id, z.id].sort(), 'Shift\'s own release ran it too: nothing owed after');
	} finally { h.restore(); }
});

test('B413: a focus loss cancels no gesture and ends no press -- a move and a link drag go on across it and commit', () => {
	const h = makeInput();
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [360, 0]]);
		h.capture.onDown(overNode(a.id, 0, 0, { button: 2, buttons: 2 }));
		h.capture.onMove(overNode(a.id, 120, 0, { button: 2, buttons: 2 }));
		focusLost(h);
		h.capture.onMove(overNode(a.id, 180, 0, { button: 2, buttons: 2 }));
		h.capture.onUp(overNode(a.id, 180, 0, { button: 2, buttons: 0 }));
		assert.equal(h.model.get('node', a.id).x, 180, 'the move went on across the focus loss, and its release committed it');
		h.reset();
		h.capture.onDown(overNode(a.id, 180, 0));
		h.capture.onMove(overNode(a.id, 240, 0));
		focusLost(h);
		h.capture.onMove(overNode(b.id, 360, 0));
		h.capture.onUp(overNode(b.id, 360, 0, { buttons: 0 }));
		assert.ok(h.commits.some((c) => (c.ops ?? []).some((o) => o.kind === 'link' && o.op === 'put')), 'the link drag went on and its release made the link');
	} finally { h.restore(); }
});

test('B413 control: zones Ctrl+A selected with no Shift held stay selected across a focus loss (B352)', () => {
	const h = makeInput();
	try {
		const { n, z } = board(h);
		h.capture.onKeyDown(key('a', { ctrlKey: true }));
		focusLost(h);
		assert.deepEqual(h.selection.list().sort(), [n.id, z.id].sort(), 'nothing of Shift was owed: the zone stays until Shift is next released');
	} finally { h.restore(); }
});

test('B413 control: Shift pressed and released while typing leaves nothing owed', () => {
	const h = makeInput();
	try {
		const { n, z } = board(h);
		shiftDown(h, inField);   // dropped: typed into a field
		shiftUp(h, inField);     // a key-up reaches Input, typing or not, and runs Shift's release as ever
		h.capture.onKeyDown(key('a', { ctrlKey: true }));
		focusLost(h);
		assert.deepEqual(h.selection.list().sort(), [n.id, z.id].sort(), 'nothing owed: Ctrl+A\'s zone kept');
	} finally { h.restore(); }
});
