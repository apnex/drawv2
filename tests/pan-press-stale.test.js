/*
H27.4 (B447, draw's half; dev/design/components/PAN-ZOOM.md section 3.6, appendix B) -- A STALE PAN PRESS NO LONGER PANS. After B1
(`5e536f9`) a pan press released where the canvas does not hear it ends at the next move holding none of its buttons; batch 1's targeted
check found two edge cases left, each panning until release where production before H26.6 did nothing:
  1. a pan press -- right, middle, or Space and left -- made just inside the canvas and released over the header, then the same button
     pressed again over the header and dragged in: the moves the canvas hears hold that button, so the old press carried on as the pan;
  2. a left drag after a stale Space press: Space pressed over the canvas, the pointer gone over the page's chrome, Space released there
     unheard, and a left drag on open ground back on the canvas, `pan-space`'s by the hold the canvas last saw.
Through draw's real Input and capture on the gesture harness: the platform's events as Chrome sends them -- the pointer's leave as it
crosses the canvas's edge, nothing at all for a press or a release over the header -- then the drag the canvas hears.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeInput, pointer, key } from './fixtures/client-harness.mjs';

const mouse = (x, y, mod = {}) => pointer(x, y, { pointerType: 'mouse', ...mod });
const centre = (h) => ({ x: h.view.view.x, y: h.view.view.y, level: h.view.view.level });
const SPACE = (mod = {}) => key(' ', { code: 'Space', ...mod });
const PRESSES = [['right', 2, 2], ['middle', 1, 4], ['Space and left', 0, 1]];

for (const mode of ['edit', 'run']) {
	test(`H27.4 (B447 case 1): a pan press released over the header, then the same button pressed there and dragged in, pans nothing, in ${mode} mode`, () => {
		for (const [name, button, buttons] of PRESSES) {
			const h = makeInput({ view: true });
			try {
				if (mode === 'run') h.renderer.setMode('run');
				const v0 = centre(h);
				if (button === 0) h.capture.onKeyDown(SPACE());
				h.capture.onDown(mouse(600, 6, { button, buttons }));         // 6 pixels inside the canvas's top edge
				h.capture.onMove(mouse(600, 4, { button: -1, buttons }));     // toward the header, under the threshold
				h.capture.onLeave(mouse(600, -2, { button: -1, buttons }));   // across the edge: the last the canvas hears of the press
				// released over the header, and the same button pressed there again: neither reaches the canvas
				if (button === 0) h.capture.onKeyUp(SPACE());
				// dragged back in, the button held: each move the canvas hears holds it
				h.capture.onHover(mouse(600, 2, { button: -1, buttons }), true);
				for (const [x, y] of [[600, 10], [620, 60], [700, 160]]) h.capture.onMove(mouse(x, y, { button: -1, buttons }));
				assert.deepEqual([centre(h), h.input.isGesturing(), h.takes.length], [v0, false, 0], `${name}: the view still, no pan live, the pointer not taken`);
				h.capture.onUp(mouse(700, 160, { button, buttons: 0 }));
				assert.deepEqual([centre(h), h.input.isGesturing(), h.commits.length], [v0, false, 0], `${name}: its release on the canvas pans nothing, commits nothing`);
			} finally { h.restore(); }
		}
	});
}

test('H27.4 (B447 case 1): Space held throughout -- a Space and left press released over the header, left pressed again there and dragged in -- pans nothing', () => {
	const h = makeInput({ view: true });
	try {
		const v0 = centre(h);
		h.capture.onKeyDown(SPACE());
		h.capture.onDown(mouse(600, 6, { button: 0, buttons: 1 }));
		h.capture.onMove(mouse(600, 4, { button: -1, buttons: 1 }));
		h.capture.onLeave(mouse(600, -2, { button: -1, buttons: 1 }));
		for (const [x, y] of [[600, 10], [620, 60], [700, 160]]) h.capture.onMove(mouse(x, y, { button: -1, buttons: 1 }));
		assert.deepEqual([centre(h), h.input.isGesturing()], [v0, false], 'the press the canvas did not hear begin carries on no pan');
		h.capture.onUp(mouse(700, 160, { button: 0, buttons: 0 }));
		h.capture.onKeyUp(SPACE());
	} finally { h.restore(); }
});

test('H27.4 (B447 case 2): Space pressed over the canvas and released unheard while the pointer was away -- a left drag back on open ground draws the selection box, no pan', () => {
	const h = makeInput({ view: true });
	try {
		const v0 = centre(h);
		h.capture.onMove(mouse(600, 300, { button: -1, buttons: 0 }));
		h.capture.onKeyDown(SPACE());                                     // Space pressed over the canvas, heard
		h.capture.onLeave(mouse(600, -2, { button: -1, buttons: 0 }));    // the pointer off over the page's chrome; Space released there, unheard
		h.capture.onHover(mouse(600, 2, { button: -1, buttons: 0 }), true);
		h.capture.onMove(mouse(600, 300, { button: -1, buttons: 0 }));
		h.capture.onDown(mouse(600, 300, { button: 0, buttons: 1 }));
		h.capture.onMove(mouse(620, 320, { button: -1, buttons: 1 }));
		h.capture.onMove(mouse(700, 400, { button: -1, buttons: 1 }));
		assert.deepEqual([centre(h), h.takes.length > 0], [v0, true], 'the view still: the press is the selection box\'s, the pointer taken for it');
		assert.equal(h.input.mode, 'marquee', 'the left drag on open ground is the selection box, as production made it');
		h.capture.onUp(mouse(700, 400, { button: 0, buttons: 0 }));
		assert.deepEqual([centre(h), h.input.isGesturing()], [v0, false]);
	} finally { h.restore(); }
});

test('H27.4 (B447): the controls -- Space held over the canvas pans a left drag; held across a leave, its repeat seen again on the canvas, it pans', () => {
	for (const [name, away] of [['never away', false], ['away and back, its repeat heard', true]]) {
		const h = makeInput({ view: true });
		try {
			const v0 = centre(h);
			h.capture.onMove(mouse(600, 300, { button: -1, buttons: 0 }));
			h.capture.onKeyDown(SPACE());
			if (away) {
				h.capture.onLeave(mouse(600, -2, { button: -1, buttons: 0 }));
				h.capture.onHover(mouse(600, 2, { button: -1, buttons: 0 }), true);
				h.capture.onMove(mouse(600, 300, { button: -1, buttons: 0 }));
				h.capture.onKeyDown(SPACE({ repeat: true }));   // Space still held: the platform's repeat, heard on the canvas again
			}
			h.capture.onDown(mouse(600, 300, { button: 0, buttons: 1 }));
			h.capture.onMove(mouse(610, 300, { button: -1, buttons: 1 }));
			h.capture.onMove(mouse(650, 320, { button: -1, buttons: 1 }));
			assert.deepEqual([h.input.isGesturing(), centre(h)], [true, { x: v0.x - 40, y: v0.y - 20, level: 1 }], `${name}: the pan live, the drawing following the pointer`);
			h.capture.onUp(mouse(650, 320, { button: 0, buttons: 0 }));
			h.capture.onKeyUp(SPACE());
		} finally { h.restore(); }
	}
	// a pan press that stays on the canvas pans as before, and a leave with no press changes nothing of the hover
	const h = makeInput({ view: true });
	try {
		const v0 = centre(h);
		h.capture.onLeave(mouse(600, -2, { button: -1, buttons: 0 }));
		h.capture.onDown(mouse(600, 300, { button: 1, buttons: 4 }));
		h.capture.onMove(mouse(610, 300, { button: -1, buttons: 4 }));
		h.capture.onMove(mouse(650, 320, { button: -1, buttons: 4 }));
		assert.deepEqual([h.input.isGesturing(), centre(h)], [true, { x: v0.x - 40, y: v0.y - 20, level: 1 }], 'a middle drag on the canvas pans');
		h.capture.onUp(mouse(650, 320, { button: 1, buttons: 0 }));
	} finally { h.restore(); }
});
