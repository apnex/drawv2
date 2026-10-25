/*
H26.5 (dev/design/components/RELEASES-0.2.md section 4, "`input-binding` `0.2.0`: B427 fixed, another pointer told apart, the press
resolved in one call"; RD8, RD14, RD18) -- A CHORD'S LAST RELEASE COMMITS THE LINK, AND ANOTHER POINTER'S MOVE OR RELEASE CHANGES NOTHING.

B427: draw declares its link gesture for button 0 (app/src/input.js GESTURES.link), and input-binding 0.1.0 committed a gesture only on
a release naming its declared button. A platform delivers a chord's presses and releases after the first as moves, so the release that
ends a press names the LAST button released: a link drag, the right button pressed and the left released, then the right released, left
the link live under 0.1.0. From 0.2.0 the press records the button that began it, and a release commits the gesture that button declares
(IB11) -- the link commits where the pointer lifted.

o:F4 (RD18): a mouse button pressed beyond the canvas, a touch press opening a link, and the mouse's release over the canvas. Under 0.1.0
the session held one press for every pointer, so the mouse's button-0 release committed the link the touch began, where the mouse
lifted, and released the remote changes queued behind it. From 0.2.0 the facts' `pointerId` (app/src/capture.js) tells the pointers
apart: another pointer's move or release answers `otherPointer`, and Input returns at once on it -- `move` before `track`, `release`
before `dispatchUp` and the teardown that calls `onGestureEnd` and `afterShiftUpPress` -- so the link, its press and the queue survive,
and the touch's own release commits the link with its own trigger, the queue released only after that commit.

Each was first reproduced failing against input-binding 0.1.0, then held fixed. tests/b242-reconcile-paths.test.js holds o:F4 again with
a real server and another writer's change queued.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeInput, pointer, seedNodes } from './fixtures/client-harness.mjs';
import { bindGestureDefer } from '../app/src/sync.js';

const overNode = (id, x, y, mod = {}) => pointer(x, y, { target: { tagName: 'g', classList: { contains: () => false }, dataset: {}, closest: (s) => (s.includes('node') ? { id } : null) }, ...mod });
const links = (h) => h.commits.flatMap((c) => (c.ops ?? []).filter((o) => o.kind === 'link' && o.op === 'put').map((o) => [o.entity.src, o.entity.dst]));
// every release Input took, with the trigger it wrote back -- 'unwritten' where it wrote none
const triggersOf = (h) => {
	const seen = [], real = h.input.release.bind(h.input);
	h.input.release = (e) => { try { return real(e); } finally { seen.push([e.pointerId, 'trigger' in e ? e.trigger : 'unwritten']); } };
	return seen;
};

test('B427: a link drag, the right button pressed and the left released, then the right released -- the link commits where it lifted', () => {
	const h = makeInput();
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [360, 0]]);
		h.capture.onDown(overNode(a.id, 0, 0, { button: 0, buttons: 1 }));
		h.capture.onMove(overNode(a.id, 120, 0, { button: -1, buttons: 1 }));
		assert.equal(h.input.isGesturing(), true, 'precondition: the left press opened the link drag');
		h.capture.onMove(overNode(b.id, 360, 0, { button: 2, buttons: 3 }));   // the right button pressed: a move, as the platform delivers a chord
		h.capture.onMove(overNode(b.id, 360, 0, { button: 0, buttons: 2 }));   // the left released: a move too
		h.capture.onUp(overNode(b.id, 360, 0, { button: 2, buttons: 0 }));     // the right released: the release that ends the press names 2
		assert.equal(h.input.isGesturing(), false, 'the link drag ended');
		assert.deepEqual(links(h), [[a.id, b.id]], 'and committed, a to b, where the pointer lifted');
	} finally { h.restore(); }
});

test('B427 control: the right button pressed and released as moves, then the left released -- the link commits, as it always did', () => {
	const h = makeInput();
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [360, 0]]);
		h.capture.onDown(overNode(a.id, 0, 0, { button: 0, buttons: 1 }));
		h.capture.onMove(overNode(a.id, 120, 0, { button: -1, buttons: 1 }));
		h.capture.onMove(overNode(b.id, 360, 0, { button: 2, buttons: 3 }));
		h.capture.onMove(overNode(b.id, 360, 0, { button: 2, buttons: 1 }));
		h.capture.onUp(overNode(b.id, 360, 0, { button: 0, buttons: 0 }));
		assert.deepEqual([h.input.isGesturing(), links(h)], [false, [[a.id, b.id]]]);
	} finally { h.restore(); }
});

// o:F4's opening: three devices, the queue bound to a recording sync, and a touch press on a opening the link drag
function touchLink() {
	const h = makeInput();
	const [a, b, c] = seedNodes(h.model, [[0, 0], [360, 0], [0, 360]]);
	const released = [];
	bindGestureDefer(h.input, { deferInbound: null, releaseDeferred: () => released.push(links(h).length) });
	const seen = triggersOf(h);
	const touch = (id, x, y, m = {}) => overNode(id, x, y, { pointerId: 2, pointerType: 'touch', ...m });
	const mouse = (id, x, y, m = {}) => overNode(id, x, y, { pointerId: 1, pointerType: 'mouse', ...m });
	h.capture.onDown(touch(a.id, 0, 0));
	h.capture.onMove(touch(a.id, 120, 120));
	assert.equal(h.input.isGesturing(), true, 'precondition: the touch opened the link drag');
	return { h, a, b, c, released, seen, touch, mouse };
}

test('o:F4 (RD18): the mouse, pressed beyond the canvas, moves over it while a touch drags a link -- not tracked, and nothing drawn', () => {
	const { h, b, mouse } = touchLink();
	try {
		const at = h.input.state.pointer.at;
		h.reset();
		h.capture.onMove(mouse(b.id, 360, 0));
		assert.equal(h.input.state.pointer.at, at, 'another pointer\'s move is not tracked: the pointer is still the touch\'s');
		assert.deepEqual(h.calls.map((x) => x.name), [], 'and draws nothing -- no preview, no hand, no readout, no hover');
	} finally { h.restore(); }
});

test('o:F4 (RD18): the mouse released over the canvas while a touch drags a link -- nothing committed, the link live, the queue held', () => {
	const { h, b, released, mouse } = touchLink();
	try {
		h.capture.onUp(mouse(b.id, 360, 0, { buttons: 0 }));
		assert.deepEqual([links(h), released], [[], []], 'nothing committed, and the queue not released');
		assert.equal(h.input.isGesturing(), true, 'the link drag is still live, so a remote change arriving now still waits');
	} finally { h.restore(); }
});

test('o:F4 (RD18): after the mouse\'s move and release, the touch\'s own release commits the link with its own trigger, the queue released after it', () => {
	const { h, a, b, c, released, seen, touch, mouse } = touchLink();
	try {
		h.capture.onMove(mouse(b.id, 360, 0));
		h.capture.onUp(mouse(b.id, 360, 0, { buttons: 0 }));
		h.capture.onMove(touch(c.id, 0, 360));
		h.capture.onUp(touch(c.id, 0, 360, { buttons: 0 }));
		assert.deepEqual(links(h), [[a.id, c.id]], 'the touch\'s release committed the link, a to c, where the touch lifted');
		assert.deepEqual(seen, [[1, 'unwritten'], [2, 'drop']], 'with its own trigger: the touch\'s press survived the mouse\'s release, so its travel made a drop; the mouse\'s release wrote nothing back');
		assert.deepEqual(released, [1], 'and the queue was released once, after the commit');
		assert.equal(h.input.isGesturing(), false, 'the link drag ended with it');
	} finally { h.restore(); }
});
