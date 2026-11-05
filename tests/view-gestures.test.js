/*
H26.6's move 9 (dev/design/components/PAN-ZOOM.md section 3.6, appendix A's four move 9 rows; PZ5, PZ12, PZ17, PZ27; GR6, GR9) -- THE
GESTURES AS ROWS, through draw's own composed tables and, live, through the real capture (tests/fixtures/client-harness.mjs `makeInput`,
the page's composition): the view's rows asked before the press table in every mode; the pan rows a mouse's press alone, a pan only past
4 screen pixels, the pointer taken then; the session measured on the screen; the wheel's two rows, the pinch stepping a level per 100
normalised pixels about the pointer and a wheel without Ctrl never zooming. The page's own trusted input is tests/lab-browser.test.js's.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeInput, pointer, key, seedNodes, GROUND } from './fixtures/client-harness.mjs';
import { VIEW_RULES } from '../app/src/recognize.js';
import { stepZoom, normalisedDelta, viewFrameMeter } from '../app/src/view.js';

const blank = { target: null, overTarget: false, action: null, input: null, owner: null, control: false, entity: false };
const MODS = ['shiftKey', 'ctrlKey', 'altKey', 'metaKey'];
const mouse = (x, y, mod = {}) => pointer(x, y, { pointerType: 'mouse', ...mod });
// a wheel event as the platform's WheelEvent reaches capture: no pointer id, a delta in its unit
const wheel = (x, y, deltaY, mod = {}) => {
	const ev = { clientX: x, clientY: y, button: 0, buttons: 0, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, deltaX: 0, deltaY, deltaZ: 0, deltaMode: 0,
		target: GROUND, claimed: 0, stopPropagation() {}, ...mod };
	ev.preventDefault = () => { ev.claimed++; };
	return ev;
};
const centre = (h) => ({ x: h.view.view.x, y: h.view.view.y, level: h.view.view.level });
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));

/*
GR9 -- `right-button.mjs` AS A TEST (PAN-ZOOM.md 5.1, move 9's guard; PZ5): the probe's match space, a `down` on open ground and on a zone
for buttons 0 to 4, every one of the 16 combinations of Shift, Ctrl, Alt and Meta, writable or locked, a hand held or not, view, edit and
run -- the press table in view and edit, run mode's in run -- for a mouse, a pen and a touch. The press and run tables answer exactly what
the probe recorded before the move (`right-button.out.json`, A and B), for every pointer; the view's rows take a mouse's middle press
anywhere and its right press on open ground, in every case, and nothing else -- no pen's, no touch's, no other button, and on a zone no
right press. A left press is `pan-space`'s only while Space is held.
*/
const TODAY = {
	canvas: { 0: { 'product:marquee': 64, 'zones:zone-draw': 32, 'product:place-tower': 32, 'product:marquee-locked': 32 }, 1: {}, 2: {}, 3: {}, 4: {} },
	zone: { 0: { 'zones:zone-draw': 32, 'product:place-tower': 32 }, 1: {}, 2: { 'product:r-press': 32, 'product:r-clone': 16, 'product:chord': 32, 'product:r-press-locked': 48 }, 3: {}, 4: {} },
};
function sweep(kind, id, pointerType, spaceHeld = false) {
	const tables = {}, view = {};
	for (const readOnly of [false, true]) for (const hand of [null, 'router']) for (const mode of ['view', 'edit', 'run']) {
		const h = makeInput({ readOnly });
		try {
			if (hand) h.tools.setHand(hand);
			h.renderer.setMode(mode);
			const table = mode === 'run' ? h.input.runRules : h.input.pressRules;
			for (const button of [0, 1, 2, 3, 4]) for (let m = 0; m < 16; m++) {
				const mods = Object.fromEntries(MODS.map((k, i) => [k, !!(m & (1 << i))]));
				const fact = Object.freeze({ type: 'down', at: { x: 0, y: 0 }, screen: { x: 0, y: 0 }, hit: { kind, id, region: blank }, focus: null, button, buttons: 1 << [0, 2, 1, 3, 4][button],
					pointerId: 1, pointerType, key: null, code: null, repeat: null, ...mods, deltaX: null, deltaY: null, deltaZ: null, deltaMode: null, time: 0 });
				const { match } = table.matchInput(fact, h.input.situation(), { readOnly });
				tables[button] ??= {};
				if (match) { const r = `${match.owner}:${match.row.id}`; tables[button][r] = (tables[button][r] ?? 0) + 1; }
				const v = h.input.viewRules.matchInput(fact, { live: false, openGround: kind === 'canvas', spaceHeld }, { readOnly, gesturing: false }).match;
				view[button] ??= {};
				if (v) view[button][v.id] = (view[button][v.id] ?? 0) + 1;
			}
		} finally { h.restore(); }
	}
	return { tables, view };
}

test('H26.6 move 9, GR9: right-button.mjs as a test -- on open ground a mouse\'s middle and right buttons match the pan rows alone; a pen\'s, a touch\'s and every other button and kind as today', () => {
	for (const pointerType of ['mouse', 'pen', 'touch']) {
		const ground = sweep('canvas', null, pointerType), zone = sweep('zone', 'zone-000001', pointerType);
		assert.deepEqual(ground.tables, TODAY.canvas, `${pointerType} on open ground: the press and run tables as the probe recorded them`);
		assert.deepEqual(zone.tables, TODAY.zone, `${pointerType} on a zone: the press and run tables as the probe recorded them`);
		const mousePans = pointerType === 'mouse';
		assert.deepEqual(ground.view, { 0: {}, 1: mousePans ? { 'pan-middle': 192 } : {}, 2: mousePans ? { 'pan-right': 192 } : {}, 3: {}, 4: {} }, `${pointerType} on open ground: the view's rows`);
		assert.deepEqual(zone.view, { 0: {}, 1: mousePans ? { 'pan-middle': 192 } : {}, 2: {}, 3: {}, 4: {} }, `${pointerType} on a zone: the middle press pans anywhere; the right press is the zone's`);
	}
	assert.deepEqual(sweep('canvas', null, 'mouse', true).view[0], { 'pan-space': 192 }, 'a mouse\'s left press while Space is held is pan-space\'s, in every case');
	assert.deepEqual(sweep('canvas', null, 'pen', true).view[0], {}, 'a pen\'s is not');
});

// GR9's live sequences, the probe's C through the real capture, with the view part handed in: what each committed, selected, claimed, took
function live(steps, { at = [[0, 0, 'router'], [240, 0, 'router']] } = {}) {
	const h = makeInput({ view: true });
	try {
		seedNodes(h.model, at);
		const before = JSON.stringify(h.model.toJSON()), view0 = centre(h);
		const claims = [];
		for (const [op, x, y, mod] of steps) {
			const ev = op === 'onKeyDown' || op === 'onKeyUp' ? key(x, y) : op === 'onBlur' ? { timeStamp: 0, preventDefault() {} } : mouse(x, y, mod);
			let claimed = 0; ev.preventDefault = () => { claimed++; };
			h.capture[op](ev);
			claims.push(claimed > 0);
		}
		return { commits: h.commits.length, modelChanged: JSON.stringify(h.model.toJSON()) !== before, selection: h.selection.list().length, gesturing: h.input.isGesturing(), claims, takes: h.takes.length, view0, view: centre(h) };
	} finally { h.restore(); }
}

test('H26.6 move 9, GR9 live: a right drag on open ground pans and commits nothing; a selection box the right button joins completes as today; Alt and right there does nothing', () => {
	const dragged = live([['onDown', 600, 400, { button: 2, buttons: 2 }], ['onMove', 700, 400, { button: -1, buttons: 2 }], ['onMove', 800, 450, { button: -1, buttons: 2 }], ['onUp', 800, 450, { button: 2, buttons: 0 }]]);
	assert.deepEqual([dragged.commits, dragged.modelChanged, dragged.selection, dragged.gesturing, dragged.takes], [0, false, 0, false, 1], 'a pan: no edit, nothing selected, the pointer taken once');
	assert.deepEqual(dragged.claims, [false, false, false, false], 'the press is not claimed -- a right click stays as today');
	// engaged at the first move, 100 pixels on; the view then followed the next, 100 by 50, at the 1x scale of the harness's 1920 by 1080 root
	assert.deepEqual([dragged.view.x - dragged.view0.x, dragged.view.y - dragged.view0.y, dragged.view.level], [-100, -50, 1], 'the drawing followed the pointer from where the pan engaged');
	const box = live([['onDown', -300, -200, { button: 0, buttons: 1 }], ['onMove', -100, -100, { button: -1, buttons: 1 }], ['onMove', 0, 0, { button: 2, buttons: 3 }], ['onMove', 1300, 600, { button: -1, buttons: 3 }],
		['onMove', 1300, 600, { button: 2, buttons: 1 }], ['onUp', 1300, 600, { button: 0, buttons: 0 }]]);
	assert.deepEqual([box.commits, box.selection, box.gesturing, box.view], [0, 2, false, box.view0], 'the box selects both devices, as today; the view never moved');
	const alt = live([['onDown', 600, 400, { button: 2, buttons: 2, altKey: true }], ['onUp', 600, 400, { button: 2, buttons: 0, altKey: true }]]);
	assert.deepEqual([alt.commits, alt.modelChanged, alt.selection, alt.view, alt.takes], [0, false, 0, alt.view0, 0], 'Alt and a right click on open ground: nothing, as today');
	const altDrag = live([['onDown', 600, 400, { button: 2, buttons: 2, altKey: true }], ['onMove', 640, 400, { button: -1, buttons: 2, altKey: true }], ['onMove', 700, 400, { button: -1, buttons: 2, altKey: true }]]);
	assert.equal(altDrag.view.x - altDrag.view0.x, -60, 'a right drag with Alt on open ground pans, where it did nothing (5.1 move 9\'s named change)');
});

// 3.6, `pan-right` (PZ5, U1): open ground is the canvas, a zone pressed without Shift among it -- its pick is Shift's, so the press passes
// through to the canvas -- and with Shift held the right press is the zone's own, as today: it selects the zone, the view still
test('H26.6 move 9: a right drag on a zone pressed without Shift pans, as open ground; with Shift it is the zone\'s own right press, the view still', () => {
	for (const shiftKey of [false, true]) {
		const h = makeInput({ view: true });
		try {
			h.model.put('zone', { id: 'zone-000001', name: 'z', x: -150, y: -150, w: 300, h: 300 });
			const v0 = centre(h), target = h.at('zone-000001');
			// the harness's root at 1x, 1920 by 1080, centre 0,0: drawing (40, 60), inside the zone, is screen (1000, 600)
			h.capture.onDown(mouse(1000, 600, { button: 2, buttons: 2, shiftKey, target }));
			h.capture.onMove(mouse(1010, 600, { button: -1, buttons: 2, shiftKey, target }));
			h.capture.onMove(mouse(1050, 630, { button: -1, buttons: 2, shiftKey, target }));
			h.capture.onUp(mouse(1050, 630, { button: 2, buttons: 0, shiftKey, target }));
			if (!shiftKey) assert.deepEqual([centre(h), h.selection.list()], [{ x: v0.x - 40, y: v0.y - 30, level: 1 }, []], 'no Shift: the zone passes through, and the right drag pans');
			else assert.deepEqual([centre(h), h.selection.list()], [v0, ['zone-000001']], 'Shift: the zone\'s right press -- it is selected -- and the view still');
		} finally { h.restore(); }
	}
});

// appendix A move 9: the composed tables driven with a pen's barrel button, a touch, a right and a middle press travelling 3 and then 5 screen
// pixels, a two-button chord, and a pan cancelled by focus loss
test('H26.6 move 9: a pen\'s barrel button and a touch pan nothing, as today -- the pen\'s right drag does nothing, the touch\'s drag is the selection box', () => {
	const pen = live([['onDown', 600, 400, { button: 2, buttons: 2, pointerType: 'pen' }], ['onMove', 700, 450, { button: -1, buttons: 2, pointerType: 'pen' }], ['onUp', 700, 450, { button: 2, buttons: 0, pointerType: 'pen' }]]);
	assert.deepEqual([pen.commits, pen.selection, pen.view, pen.takes], [0, 0, pen.view0, 0]);
	const touch = live([['onDown', -300, -200, { pointerType: 'touch' }], ['onMove', 1300, 600, { pointerType: 'touch' }], ['onUp', 1300, 600, { pointerType: 'touch', buttons: 0 }]]);
	assert.deepEqual([touch.selection, touch.view, touch.takes], [2, touch.view0, 1], 'the touch\'s drag selected both devices, its pointer taken at the press as a marquee\'s is');
});

for (const [button, buttons] of [[2, 2], [1, 4]]) {
	test(`H26.6 move 9: a ${button === 2 ? 'right' : 'middle'} press travelling 3 screen pixels is no pan -- nothing live, nothing taken -- and at 5 the pan engages, the pointer taken then`, () => {
		const h = makeInput({ view: true });
		try {
			const v0 = centre(h);
			h.capture.onDown(mouse(600, 400, { button, buttons }));
			h.capture.onMove(mouse(603, 400, { button: -1, buttons }));
			assert.deepEqual([h.input.isGesturing(), h.takes.length, centre(h)], [false, 0, v0], '3 pixels: no gesture in progress, the pointer not taken, the view still');
			h.capture.onMove(mouse(600, 405, { button: -1, buttons }));
			assert.deepEqual([h.input.isGesturing(), h.takes, centre(h)], [true, [1], v0], '5 pixels from the press: the pan in progress, the pointer taken, the view not yet moved');
			h.capture.onMove(mouse(640, 435, { button: -1, buttons }));
			assert.deepEqual(centre(h), { x: v0.x - 40, y: v0.y - 30, level: 1 }, 'then the drawing follows the pointer\'s travel on screen over the scale');
			h.capture.onUp(mouse(640, 435, { button, buttons: 0 }));
			assert.deepEqual([h.input.isGesturing(), h.commits.length, centre(h)], [false, 0, { x: v0.x - 40, y: v0.y - 30, level: 1 }], 'the release commits nothing and leaves the view');
			h.capture.onDown(mouse(600, 400, { button, buttons }));
			h.capture.onUp(mouse(602, 401, { button, buttons: 0 }));
			assert.deepEqual([h.input.isGesturing(), h.commits.length, h.takes.length, centre(h)], [false, 0, 1, { x: v0.x - 40, y: v0.y - 30, level: 1 }], 'a click -- under the threshold -- does nothing and takes nothing');
		} finally { h.restore(); }
	});
}

test('H26.6 move 9: a two-button chord -- a selection box the right button joins, and a pan the left joins -- each completes as its first press began it', () => {
	const box = live([['onDown', -300, -200, { button: 0, buttons: 1 }], ['onMove', -280, -200, { button: -1, buttons: 1 }], ['onMove', -280, -200, { button: 2, buttons: 3 }], ['onMove', 1300, 600, { button: -1, buttons: 3 }],
		['onMove', 1300, 600, { button: 0, buttons: 2 }], ['onUp', 1300, 600, { button: 2, buttons: 0 }]]);
	assert.deepEqual([box.selection, box.gesturing, box.view], [2, false, box.view0], 'the chord\'s last release, of the right button, commits the box (IB11)');
	const panned = live([['onDown', 600, 400, { button: 2, buttons: 2 }], ['onMove', 620, 400, { button: -1, buttons: 2 }], ['onMove', 620, 400, { button: 0, buttons: 3 }], ['onMove', 650, 400, { button: -1, buttons: 3 }],
		['onMove', 650, 400, { button: 2, buttons: 1 }], ['onUp', 650, 400, { button: 0, buttons: 0 }]]);
	assert.deepEqual([panned.commits, panned.selection, panned.gesturing, panned.view.x - panned.view0.x], [0, 0, false, -30], 'the left button joining a pan is a move, never a press: the pan ends at the last release');
});

test('H26.6 move 9: a pan cancelled by focus loss leaves the view where the pan had it, and the moves after it pan nothing', () => {
	const h = makeInput({ view: true });
	try {
		const v0 = centre(h);
		h.capture.onDown(mouse(600, 400, { button: 1, buttons: 4 }));
		h.capture.onMove(mouse(610, 400, { button: -1, buttons: 4 }));
		h.capture.onMove(mouse(650, 420, { button: -1, buttons: 4 }));
		assert.equal(h.input.isGesturing(), true, 'the pan in progress');
		h.capture.onBlur({ timeStamp: 0, preventDefault() {} });
		assert.deepEqual([h.input.isGesturing(), centre(h)], [false, { x: v0.x - 40, y: v0.y - 20, level: 1 }], 'cancelled, the view kept');
		h.capture.onMove(mouse(900, 600, { button: -1, buttons: 4 }));
		h.capture.onUp(mouse(900, 600, { button: 1, buttons: 0 }));
		assert.deepEqual([h.input.isGesturing(), h.commits.length, centre(h)], [false, 0, { x: v0.x - 40, y: v0.y - 20, level: 1 }]);
	} finally { h.restore(); }
});

// PZ27's interplay (3.6): Space held (the session told the keys held, IB14) makes a left press pan-space's; RESTATED at H26.6's move 10 --
// the datum is recorded pending on Space's key-down and set on its key-up only when no pan engaged while it was held
test('H26.6 move 9, restated at move 10: Space held and a left drag pans and sets no datum on release; a click with Space held does nothing; a tap sets the datum; released, a left drag is the selection box again', () => {
	const h = makeInput({ view: true });
	try {
		seedNodes(h.model, [[0, 0, 'router'], [240, 0, 'router']]);
		const v0 = centre(h), datums = () => h.calls.filter((c) => c.name === 'readout.setDatum' && c.args[0]).length;
		h.capture.onMove(mouse(960, 540, { buttons: 0 }));
		h.capture.onKeyDown(key(' ', { code: 'Space' }));
		assert.equal(datums(), 0, 'nothing set on the key-down: pending');
		h.capture.onDown(mouse(600, 400));
		h.capture.onMove(mouse(660, 400));
		h.capture.onMove(mouse(700, 450));
		h.capture.onUp(mouse(700, 450, { buttons: 0 }));
		assert.deepEqual([h.selection.list().length, h.commits.length, centre(h)], [0, 0, { x: v0.x - 40, y: v0.y - 50, level: 1 }], 'a pan, nothing selected');
		const [first] = h.model.all('node');
		h.selection.set([first.id]);
		h.capture.onDown(mouse(600, 400));
		h.capture.onUp(mouse(600, 400, { buttons: 0 }));
		assert.deepEqual([h.selection.list(), h.input.isGesturing()], [[first.id], false], 'a click with Space held does nothing -- the click on open ground no longer clears the selection (3.6, PZ27)');
		h.capture.onKeyUp(key(' ', { code: 'Space' }));
		assert.equal(datums(), 0, 'a pan engaged while Space was held: its release sets no datum');
		h.capture.onKeyDown(key(' ', { code: 'Space' }));
		h.capture.onKeyUp(key(' ', { code: 'Space' }));
		assert.equal(datums(), 1, 'a tap -- no pan -- sets the datum on release');
		h.capture.onDown(mouse(0, 0));
		h.capture.onMove(mouse(1900, 1000));
		h.capture.onUp(mouse(1900, 1000, { buttons: 0 }));
		assert.deepEqual([h.selection.list().length, centre(h)], [2, { x: v0.x - 40, y: v0.y - 50, level: 1 }], 'Space released: the selection box, the view still');
	} finally { h.restore(); }
});

/*
appendix A move 9: a click, a returning drag and a chained link at scale 0.495 -- today's fit on a 1,366 window -- and at 2, each with a
panned origin, through the real capture, the harness's scene set to the view directly so a fact's `screen` and `at` differ. A press on a
device draws a link; its release at the start selects it as a click only when it travelled no more than 4 SCREEN pixels: 3 at 0.495 --
6.06 drawing units, a drag before the move -- is a click; 5 at 2 -- 2.5 units, a click before -- is a drag. A drag that returns to its start
is a drop, decided by the moves before the release, never where it lands. A link chained through a digit restarts the press from the
chain's start on the screen (`chainFrom` handing `toScreen`), so a move of 2 pixels after it is still a click.
*/
for (const scale of [0.495, 2]) {
	const view = { x: -1234.5, y: 567.25, scale };
	const onScreen = (p) => ({ x: (p.x - view.x) * scale, y: (p.y - view.y) * scale });
	const withView = (fn) => {
		const h = makeInput();
		try {
			const [a, b] = seedNodes(h.model, [[0, 600, 'router'], [480, 600, 'router']]);
			h.scene.setView(view);
			fn(h, a, b);
		} finally { h.restore(); }
	};
	test(`H26.6 move 9: at scale ${scale} with a panned origin, a click, a returning drag and a chained link are decided on the screen`, () => {
		withView((h, a) => {
			const s = onScreen(a), t = h.at(a.id);
			h.capture.onDown(pointer(s.x, s.y, { target: t }));
			h.capture.onMove(pointer(s.x + 3, s.y, { target: t }));
			h.capture.onUp(pointer(s.x + 3, s.y, { target: t, buttons: 0 }));
			assert.deepEqual([h.selection.list(), h.commits.length], [[a.id], 0], '3 screen pixels: a click, which selects the device');
		});
		withView((h, a) => {
			const s = onScreen(a), t = h.at(a.id);
			h.capture.onDown(pointer(s.x, s.y, { target: t }));
			h.capture.onMove(pointer(s.x + 5, s.y, { target: t }));
			h.capture.onUp(pointer(s.x + 5, s.y, { target: t, buttons: 0 }));
			assert.deepEqual([h.selection.list(), h.commits.length], [[], 0], '5 screen pixels: a drag released on its own device, discarded');
		});
		withView((h, a) => {
			const s = onScreen(a), t = h.at(a.id);
			h.capture.onDown(pointer(s.x, s.y, { target: t }));
			h.capture.onMove(pointer(s.x + 10, s.y + 10));
			h.capture.onMove(pointer(s.x, s.y, { target: t }));
			h.capture.onUp(pointer(s.x, s.y, { target: t, buttons: 0 }));
			assert.deepEqual([h.selection.list(), h.commits.length], [[], 0], 'a drag returning to its start: a drop, discarded -- not a click');
		});
		withView((h, a, b) => {
			const s = onScreen(a), mid = onScreen({ x: 240, y: 600 });
			h.capture.onDown(pointer(s.x, s.y, { target: h.at(a.id) }));
			h.capture.onMove(pointer(mid.x, mid.y));
			h.capture.onKeyDown(key('1'));   // a device placed under the pointer, the drag chained on from it
			const placed = h.model.all('node').find((n) => n.id !== a.id && n.id !== b.id);
			assert.ok(placed, 'the digit placed a device and chained on from it');
			h.capture.onMove(pointer(mid.x + 2, mid.y));
			h.capture.onUp(pointer(mid.x + 2, mid.y, { target: h.at(placed.id), buttons: 0 }));
			assert.deepEqual(h.selection.list(), [placed.id], 'the chain restarted from its start on the screen: 2 pixels after it, its release a click on the device it chained from');
		});
	});
}

// appendix A move 9: no drawing-unit threshold left in draw (a source check) -- the session measured on the screen, the link release's
// atStart on screen points, the palette's tile click on client pixels
test('H26.6 move 9: no drawing-unit threshold is left in draw -- the session measured on the screen, atStart and the palette\'s click on screen points', () => {
	const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
	const input = read('app/src/input.js'), palette = read('app/src/palette.js');
	assert.doesNotMatch(input, /DRAG_THRESHOLD/, 'the drawing-unit constant is gone');
	assert.match(input, /openGestures\(\{ threshold: PRESS_THRESHOLD_PIXELS, measure: 'screen',/, 'the one session, measured on the screen');
	assert.match(input, /atStart: dist\(evt\.screen, ctx\.screenStart\) <= PRESS_THRESHOLD_PIXELS/, 'the link release compares screen points');
	assert.match(input, /from: this\.scene\.toScreen\(pos\)/, 'a chain restarts from a screen point');
	assert.equal((input.match(/PRESS_THRESHOLD_PIXELS/g) ?? []).length, 3, 'named once, read by the session and by atStart alone');
	assert.match(palette, /Math\.hypot\(evt\.clientX - sx, evt\.clientY - sy\) < CLICK_SLOP/, 'the palette\'s tile click on client pixels');
	for (const f of fs.readdirSync(new URL('../app/src/', import.meta.url)).filter((n) => n.endsWith('.js'))) {
		assert.doesNotMatch(read(`app/src/${f}`), /threshold:\s*[A-Z_]+(?![\s\S]{0,40}measure: 'screen')/, `${f}: no session opened on drawing units`);
	}
});

/*
GR6 (AG-2) through the capture: a wheel without Ctrl never zooms -- deltas of every unit and sign, horizontal and vertical, in every mode and
mid-gesture -- and is claimed, the page never scrolled; the left drag on open ground stays the selection box (above, and the live box).
*/
test('H26.6 move 9, GR6: a wheel without Ctrl never zooms -- it pans, by its normalised deltas over the scale, and is claimed', () => {
	const h = makeInput({ view: true });
	try {
		for (const mode of ['view', 'edit', 'run']) {
			h.renderer.setMode(mode);
			for (const deltaMode of [0, 1, 2]) for (const [dx, dy] of [[0, 120], [0, -3], [57, 0], [-1, 1], [0, 2000]]) {
				const v0 = centre(h), ev = wheel(700, 300, dy, { deltaX: dx, deltaMode, shiftKey: dx === 57 });
				h.capture.onWheel(ev);
				const unit = [1, 40, 1080][deltaMode];
				assert.equal(ev.claimed, 1, 'claimed: the page neither scrolls nor zooms');
				assert.deepEqual(centre(h), { x: v0.x + dx * unit, y: v0.y + dy * unit, level: v0.level }, `${mode}, deltaMode ${deltaMode}, ${dx}, ${dy}: panned, never zoomed`);
			}
		}
		h.renderer.setMode('view');
		h.capture.onDown(mouse(-300, -200));
		h.capture.onMove(mouse(-100, -100));
		const v0 = centre(h), ev = wheel(700, 300, 100);
		h.capture.onWheel(ev);
		assert.deepEqual([h.input.isGesturing(), ev.claimed, centre(h)], [true, 1, { ...v0, y: v0.y + 100 }], 'mid-gesture too: the box stays live, the wheel pans');
		const unknown = wheel(700, 300, 100, { deltaMode: 7 });
		h.capture.onWheel(unknown);
		assert.deepEqual([unknown.claimed, centre(h)], [1, { ...v0, y: v0.y + 100 }], 'a unit not reported: claimed, the view kept');
	} finally { h.restore(); }
});

/*
appendix A move 9 (revision 6, PZ12): the pinch and Ctrl and the wheel accumulating the normalised delta and stepping one level per 100
pixels about the pointer -- a slow pinch and a fast one each step one level per threshold; the point under the pointer holds at every
level; no view lies between levels. 3.6's accumulator by its cases: one fact of 250 from 0.5x steps twice, keeping 50; two of 125 step as
one of 250; the other sign first sets it to 0; at an end what remains is dropped; three lines are 120 pixels.
*/
test('H26.6 move 9: the accumulator, by 3.6\'s cases', () => {
	assert.deepEqual(stepZoom(0, 0, 250), { index: 2, acc: 50, steps: 2 }, 'one fact of 250 from 0.5x: to 2x, keeping 50');
	const half = stepZoom(0, 0, 125);
	assert.deepEqual(stepZoom(half.index, half.acc, 125), { index: 2, acc: 50, steps: 1 }, 'two of 125 end as one of 250');
	assert.deepEqual(stepZoom(1, 60, -30), { index: 1, acc: -30, steps: 0 }, 'the other sign sets it to 0 first');
	assert.deepEqual(stepZoom(3, 0, 450), { index: 3, acc: 0, steps: 0 }, 'at the farthest level what remains that way is dropped');
	assert.deepEqual(stepZoom(1, 0, -250), { index: 0, acc: 0, steps: 1 }, 'past the nearest, dropped');
	assert.deepEqual([normalisedDelta(3, 1, 535), normalisedDelta(120, 0, 535), normalisedDelta(1, 2, 535), normalisedDelta(1, null, 535), normalisedDelta(1, 2, 0)], [120, 120, 535, null, null]);
});

test('H26.6 move 9: a slow pinch and a fast one each step one level per 100 pixels about the pointer, the point under it held at every level, no view between levels', () => {
	for (const [name, facts] of [['slow', Array(40).fill(5)], ['fast', [100, 100]], ['lines', [3, 2]]]) {
		const h = makeInput({ view: true });
		try {
			const at = { x: 1500, y: 200 }, levels = [], held = [];
			const under = () => h.scene.toDrawing(at);
			const p0 = under();
			for (const d of facts) {
				h.capture.onWheel(wheel(at.x, at.y, d, { ctrlKey: true, deltaMode: name === 'lines' ? 1 : 0 }));
				levels.push(h.view.view.level);
				held.push(h.view.pinchHeld());
				const p = under();
				assert.ok(near(p.x, p0.x) && near(p.y, p0.y), `${name}: the drawing point under the pointer held (${JSON.stringify(p)} against ${JSON.stringify(p0)})`);
				assert.ok([0.5, 1, 2, 3].includes(h.view.view.level) && near(h.scene.view().scale, (1 / h.view.view.level)), `${name}: at a level, never between`);
			}
			assert.deepEqual([...new Set([1, ...levels])], [1, 2, 3], `${name}: out one level per 100 pixels, 1x to 3x`);
			assert.equal(held.at(-1), 0, `${name}: 200 pixels from 1x, both crossed`);
			if (name === 'slow') assert.equal(levels.indexOf(2), 19, 'slow: the step at the twentieth fact of 5, its 100th pixel');
			h.capture.onWheel(wheel(at.x, at.y, -250, { ctrlKey: true }));
			assert.equal(h.view.view.level, 1, `${name}: back in, two levels for 250, 50 held`);
			assert.equal(h.view.pinchHeld(), -50);
			h.capture.onDown(mouse(600, 400, { button: 1, buttons: 4 }));
			h.capture.onMove(mouse(620, 400, { button: -1, buttons: 4 }));
			h.capture.onMove(mouse(640, 400, { button: -1, buttons: 4 }));
			assert.equal(h.view.pinchHeld(), 0, `${name}: a drag's pan, a view the wheel did not set, sets the held pixels to 0`);
		} finally { h.restore(); }
	}
});

test('H26.6 move 9: the view\'s rows, as 3.6 states them -- five, none mutating, the pan rows a mouse\'s press alone and unclaimed, the wheel\'s claimed and live mid-gesture', () => {
	assert.deepEqual(VIEW_RULES.map((r) => [r.id, r.mutates, r.prevent ?? true, r.duringGesture ?? false, r.pans ?? null]), [
		['scroll-pan', false, true, true, null], ['pinch-zoom', false, true, true, null],
		['pan-middle', false, false, false, 'pan-middle'], ['pan-right', false, false, false, 'pan-right'], ['pan-space', false, false, false, 'pan-space'],
	]);
});

/*
PZ11's figure (app/src/view.js `viewFrameMeter`, the lab's footer): each view the scene tells timed to the third animation frame after it --
RESTATED at the production gate of moves 9 to 12 (S1): the second until then, a frame short of pan-cost.mjs, on which PZ11's 50 was set --
a view told while one waits not timed again; the median and 90th percentile by nearest rank; reset by the page's button. On a scene and a
host of the test's own -- a clock it sets, frames it runs.
*/
test('H26.6 move 9, PZ11: the frame meter times each view to the third frame after it -- as pan-cost.mjs, from the move 9 to 12 gate -- once per frame, its median and 90th percentile by nearest rank, reset', () => {
	const listeners = [], queued = [], said = [];
	let now = 0;
	const scene = { onView: (fn) => { listeners.push(fn); return () => listeners.splice(listeners.indexOf(fn), 1); } };
	const host = { performance: { now: () => now }, requestAnimationFrame: (fn) => queued.push(fn) };
	const frame = (at) => { now = at; for (const fn of queued.splice(0)) fn(); };
	const tell = (at) => { now = at; for (const fn of [...listeners]) fn(); };
	const meter = viewFrameMeter({ scene, host, shown: (text) => said.push(text) });
	assert.deepEqual([meter.figures(), said.at(-1)], [{ steps: 0, median: null, p90: null }, 'view frames: pan to measure']);
	tell(100); tell(104);
	frame(105);
	assert.equal(meter.figures().steps, 0, 'the first frame after the view, the one drawing it: not timed');
	frame(122);
	assert.equal(meter.figures().steps, 0, 'the second: not yet -- the old meter stopped here, a frame short of pan-cost.mjs');
	frame(139);
	assert.deepEqual(meter.figures(), { steps: 1, median: 39, p90: 39 }, 'timed to the third frame, from the first view told; the second view, told while it waited for its drawing frame, not timed again');
	assert.equal(said.at(-1), 'view frames: 1 step, median 39.0 ms, 90th percentile 39.0 ms (PZ11: within 50, as pan-cost.mjs times a step -- to the second frame after the one drawing it)');
	// a step a frame is timed every frame: one told after the last one's drawing frame waits on its own
	meter.reset();
	tell(200); frame(201); tell(210); frame(218); tell(220); frame(235); frame(252); frame(269);
	assert.deepEqual(meter.figures(), { steps: 3, median: 42, p90: 49 }, 'three steps a frame apart, each timed: 35, 42 and 49 ms');
	meter.reset();
	assert.deepEqual([meter.figures().steps, said.at(-1)], [0, 'view frames: pan to measure'], 'reset');
	for (let i = 1; i <= 10; i++) { tell(1000 * i); frame(1000 * i + 1); frame(1000 * i + 2); frame(1000 * i + 10 * i); }
	assert.deepEqual(meter.figures(), { steps: 10, median: 50, p90: 90 }, 'ten steps of 10 to 100 ms: the 5th and the 9th by nearest rank');
	meter.close();
	tell(20000); frame(20001); frame(20017); frame(20034);
	assert.equal(meter.figures().steps, 10, 'closed: no longer listening');
});
