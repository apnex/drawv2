/*
B1 (the production gate of H26.6's moves 9 to 12; dev/design/components/PAN-ZOOM.md section 3.6, appendix B) -- A PAN'S PRESS RELEASED
WHERE THE CANVAS DOES NOT HEAR IT. A pan row's press takes no pointer until it travels 4 screen pixels, so a middle, right or Space and
left press made just inside the canvas and released over the header was never heard: the waiting pan and the session's press stayed
held, and the next hover -- no button down -- travelled the threshold and panned the view, in every mode; in run mode each click placed a
tower while the view slid, Escape alone ending it. Now a move of the press's pointer holding none of the buttons the press was last heard
holding ends the press as a lost pointer, and cancels a live pan the same way. Through draw's real Input and capture on the gesture
harness: the press, the release left unheard -- no event reaches the canvas -- then the hover and run mode's clicks. A chord the canvas
heard keeps IB11: the pan ends at its last release. Trusted input in Chrome is tests/browser.test.js's and tests/lab-browser.test.js's.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeInput, pointer, key } from './fixtures/client-harness.mjs';

const mouse = (x, y, mod = {}) => pointer(x, y, { pointerType: 'mouse', ...mod });
const centre = (h) => ({ x: h.view.view.x, y: h.view.view.y, level: h.view.view.level });
const PRESSES = [['right', 2, 2], ['middle', 1, 4], ['Space and left', 0, 1]];
const pressed = (h, button, buttons) => {
	if (button === 0) h.capture.onKeyDown(key(' ', { code: 'Space' }));
	h.capture.onDown(mouse(600, 6, { button, buttons }));   // 6 pixels inside the canvas's top edge
	h.capture.onMove(mouse(600, 4, { button: -1, buttons }));   // toward the header, under the threshold -- the last the canvas hears
	if (button === 0) h.capture.onKeyUp(key(' ', { code: 'Space' }));
};

for (const [name, button, buttons] of PRESSES) {
	for (const mode of ['edit', 'run']) {
		test(`B1: a ${name} press released over the header, unheard -- the next hover leaves the view still, nothing live, in ${mode} mode`, () => {
			const h = makeInput({ view: true });
			try {
				if (mode === 'run') h.renderer.setMode('run');
				const v0 = centre(h);
				pressed(h, button, buttons);
				// the release lands on the header: nothing reaches the canvas; then the pointer comes back, no button down
				h.capture.onMove(mouse(600, 60, { button: -1, buttons: 0 }));
				h.capture.onMove(mouse(800, 160, { button: -1, buttons: 0 }));
				assert.deepEqual([centre(h), h.input.isGesturing(), h.takes.length], [v0, false, 0], 'the view still, no pan live, the pointer not taken');
			} finally { h.restore(); }
		});
	}

	test(`B1: in run mode, after a ${name} press released unheard, two clicks each place a tower and the view stays still`, () => {
		// the two clicks, made in run mode on a harness that held no press first: where their towers land with the view still
		const clicks = (h) => {
			for (const [x, y] of [[242, 118], [482, 238]]) {
				h.capture.onMove(mouse(x - 100, y - 100, { button: -1, buttons: 0 }));
				h.capture.onMove(mouse(x, y, { button: -1, buttons: 0 }));
				h.capture.onDown(mouse(x, y, { button: 0, buttons: 1 }));
				h.capture.onUp(mouse(x, y, { button: 0, buttons: 0 }));
			}
			return h.model.all('node').filter((n) => n.type === 'loadbalancer').map((n) => [n.x, n.y]);
		};
		const control = makeInput({ view: true });
		let want;
		try { control.renderer.setMode('run'); want = clicks(control); } finally { control.restore(); }
		assert.equal(want.length, 2, 'control: two towers, on two cells');
		const h = makeInput({ view: true });
		try {
			h.renderer.setMode('run');
			const v0 = centre(h);
			pressed(h, button, buttons);
			assert.deepEqual([clicks(h), centre(h)], [want, v0], 'a tower at each click, where it lands with no press held, the view still');
		} finally { h.restore(); }
	});
}

test('B1: a live pan whose release goes unheard is cancelled by the next move holding none of its buttons, the view left where the pan had it', () => {
	for (const [name, button, buttons] of PRESSES) {
		const h = makeInput({ view: true });
		try {
			const v0 = centre(h);
			if (button === 0) h.capture.onKeyDown(key(' ', { code: 'Space' }));
			h.capture.onDown(mouse(600, 400, { button, buttons }));
			h.capture.onMove(mouse(610, 400, { button: -1, buttons }));
			h.capture.onMove(mouse(650, 420, { button: -1, buttons }));
			if (button === 0) h.capture.onKeyUp(key(' ', { code: 'Space' }));
			assert.equal(h.input.isGesturing(), true, `${name}: the pan live`);
			h.capture.onMove(mouse(900, 600, { button: -1, buttons: 0 }));
			assert.deepEqual([h.input.isGesturing(), centre(h)], [false, { x: v0.x - 40, y: v0.y - 20, level: 1 }], `${name}: cancelled by the move with no button, the view where the pan had it`);
			h.capture.onMove(mouse(1000, 700, { button: -1, buttons: 0 }));
			assert.deepEqual([centre(h), h.commits.length], [{ x: v0.x - 40, y: v0.y - 20, level: 1 }, 0], `${name}: and the hovers after it pan nothing`);
		} finally { h.restore(); }
	}
});

test('B1: a chord the canvas heard keeps IB11 -- the left button joining a right pan holds it past the right\'s release, the pan ending at the last release', () => {
	const h = makeInput({ view: true });
	try {
		const v0 = centre(h);
		h.capture.onDown(mouse(600, 400, { button: 2, buttons: 2 }));
		h.capture.onMove(mouse(620, 400, { button: -1, buttons: 2 }));
		h.capture.onMove(mouse(620, 400, { button: 0, buttons: 3 }));   // the left joins, heard
		h.capture.onMove(mouse(630, 400, { button: 2, buttons: 1 }));   // the right released, heard as a chord's move
		h.capture.onMove(mouse(660, 400, { button: -1, buttons: 1 }));
		assert.deepEqual([h.input.isGesturing(), centre(h).x - v0.x], [true, -40], 'the left still held: the pan goes on');
		h.capture.onUp(mouse(660, 400, { button: 0, buttons: 0 }));
		assert.deepEqual([h.input.isGesturing(), h.commits.length], [false, 0], 'the last release ends it');
	} finally { h.restore(); }
});

test('B1, controls: a pan released where the canvas hears it is as before, and another pointer\'s move ends no press', () => {
	const h = makeInput({ view: true });
	try {
		const v0 = centre(h);
		h.capture.onDown(mouse(600, 400, { button: 2, buttons: 2 }));
		h.capture.onMove(mouse(603, 400, { button: -1, buttons: 2 }));
		h.capture.onMove(mouse(700, 400, { pointerId: 9, pointerType: 'touch', button: -1, buttons: 0 }));   // another pointer, holding nothing
		h.capture.onMove(mouse(640, 400, { button: -1, buttons: 2 }));
		assert.deepEqual([h.input.isGesturing(), centre(h).x - v0.x], [true, 0], 'the press still waited, and engaged at the threshold');
		h.capture.onMove(mouse(680, 400, { button: -1, buttons: 2 }));
		h.capture.onUp(mouse(680, 400, { button: 2, buttons: 0 }));
		assert.deepEqual([h.input.isGesturing(), centre(h).x - v0.x], [false, -40], 'released, heard: the pan as before');
	} finally { h.restore(); }
});
