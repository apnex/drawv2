/*
H26.6's move 10 (dev/design/components/PAN-ZOOM.md sections 3.6 and 3.7; PZ6, PZ23, PZ27, PZ28; appendix A's three move 10 rows; GR5) --
THE KEYS, THE REMEMBERED VIEW AND THE WAY HOME, through draw's own composed tables and the real capture (tests/fixtures/client-harness.mjs
`makeInput`, the view part handed in): the view's keys stepping the levels about the canvas's centre, the default, fit and home set
outright; Space's datum set on its release; and the view part's store -- its save bound to a diagram and a view, written half a second
after the view last moved, flushed by a diagram opened, its value read or ignored. The page's own trusted input is tests/browser.test.js's
and tests/lab-browser.test.js's.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeInput, pointer, key, seedNodes, installDom, fakeEl, sceneOver } from './fixtures/client-harness.mjs';
import { View, storedView, nearestLevel } from '../app/src/view.js';
import { DEVICE_OUTLINES } from '../plugins/devices/device-footprint.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const centre = (h) => ({ ...h.view.view });
const near = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const SHIFT0 = [')', { shiftKey: true, code: 'Digit0' }], SHIFT1 = ['!', { shiftKey: true, code: 'Digit1' }];

// ---- the keys (PZ28, 3.7) -- the harness's root is 1920 by 1080, so the default scale is 1 and a level's scale is 1 over it

test('H26.6 move 10: = and - step one level nearer and farther about the canvas\'s centre, nothing past an end; Shift+0 returns to 1x; each claimed, none an edit', () => {
	const h = makeInput({ view: true });
	try {
		h.view.set({ x: 300, y: -120, level: 1 });
		const press = (k, m = {}) => { let claimed = 0; h.capture.onKeyDown(key(k, { ...m, preventDefault() { claimed++; } })); return claimed; };
		const steps = [['=', 0.5], ['=', 0.5], ['-', 1], ['-', 2], ['+', 1], ['-', 2], ['-', 3], ['-', 3]];
		for (const [k, level] of steps) {
			assert.equal(press(k, k === '+' ? { shiftKey: true } : {}), 1, `${k}: claimed`);
			const v = centre(h);
			assert.equal(v.level, level, `${k}: at ${level}x`);
			assert.ok(near(v.x, 300) && near(v.y, -120), `${k}: about the canvas's centre, which holds (${v.x}, ${v.y})`);
			assert.ok(near(h.scene.view().scale, 1 / level), `${k}: the level's scale, never between`);
		}
		assert.equal(press(...SHIFT0), 1);
		assert.deepEqual([centre(h).level, near(centre(h).x, 300), near(centre(h).y, -120)], [1, true, true], 'Shift+0: the default level, about the centre');
		assert.equal(h.commits.length, 0, 'a view is no edit');
	} finally { h.restore(); }
});

test('H26.6 move 10: h and the reticle\'s verb bring the centre to 0,0 at the level as it is, set outright; already home, nothing', () => {
	const h = makeInput({ view: true });
	try {
		h.view.set({ x: 4321, y: -987, level: 3 });
		h.capture.onKeyDown(key('h'));
		assert.deepEqual(centre(h), { x: 0, y: 0, level: 3 }, 'home, the zoom kept (PZ6, ruled)');
		const s = h.scene.view();
		assert.ok(near(s.scale, 1 / 3) && near(s.x, -960 * 3) && near(s.y, -540 * 3), 'cell 0,0 at the canvas\'s centre, at the scale as it was');
		let told = 0;
		const off = h.scene.onView(() => { told++; });
		h.view.home();
		off();
		assert.equal(told, 0, 'already home: no view set');
		h.capture.onKeyDown(key('H', { shiftKey: true }));
		assert.equal(h.commits.length, 0);
	} finally { h.restore(); }
});

// 3.7: fit's bounds are every device's frame, its span included, every zone's rect and every waypoint, labels left out
test('H26.6 move 10: fit\'s bounds are every device\'s frame, span included, every zone and every waypoint', () => {
	const h = makeInput({ view: true });
	try {
		assert.equal(h.input.diagramBounds(), null, 'an empty diagram has no bounds');
		const [round] = seedNodes(h.model, [[600, -60, 'router']]);
		const wide = { ...round, id: 'node-0a0a01', name: 'wide', x: -360, y: 240, shape: 'square', span: { cols: 3, rows: 2 } };
		h.model.put('node', wide);
		h.model.put('node', { id: 'node-0b0b01', name: 'w', x: 900, y: 420 });   // a waypoint: a node with no device
		h.model.put('zone', { id: 'zone-000001', name: 'z', x: -510, y: -330, w: 120, h: 60 });
		const o = DEVICE_OUTLINES.node(wide), r = DEVICE_OUTLINES.node(round).r;
		assert.deepEqual(h.input.diagramBounds(), { x0: -510, y0: Math.min(-330, -60 - r), x1: 900, y1: Math.max(420, 240 + o.y1) },
			'the zone\'s corner, the round device\'s frame, the waypoint\'s point, the wide device\'s spanned frame');
		assert.ok(o.x1 > 60, 'the wide device\'s frame reaches past its anchor by its span');
	} finally { h.restore(); }
});

test('H26.6 move 10: Shift+1 fits the diagram at the nearest level that shows it whole with 24 pixels each side, else at 3x with a flash; an empty diagram fits as it first opens', () => {
	const h = makeInput({ view: true });
	try {
		h.view.set({ x: 500, y: 500, level: 3 });
		h.capture.onKeyDown(key(...SHIFT1));
		assert.deepEqual(centre(h), { x: 0, y: 0, level: 1 }, 'empty: the first opening (PZ7)');
		seedNodes(h.model, [[0, 0, 'router'], [1800, 0, 'router']]);   // a frame 1,840 wide: 1x needs 1,888 of 1,920, so 1x
		h.capture.onKeyDown(key(...SHIFT1));
		assert.deepEqual(centre(h), { x: 900, y: 0, level: 1 }, 'centred, at 1x: 1840 + 48 fits 1920');
		seedNodes(h.model, [[1860, 0, 'router']]);   // 1,900 wide: 1,948 at 1x does not fit, 998 at 2x does
		h.capture.onKeyDown(key(...SHIFT1));
		assert.deepEqual(centre(h), { x: 930, y: 0, level: 2 }, 'the nearest level showing it whole: 2x');
		assert.equal(h.calls.filter((c) => c.name === 'readout.flash').length, 0, 'no flash while a level shows it');
		seedNodes(h.model, [[0, 6000, 'router']]);   // 6,040 tall: 2,013 at 3x, past 1,080
		h.capture.onKeyDown(key(...SHIFT1));
		assert.deepEqual(centre(h), { x: 930, y: 3000, level: 3 }, 'no level shows it: centred at the farthest');
		assert.deepEqual(h.calls.filter((c) => c.name === 'readout.flash').map((c) => c.args[0]), ['the diagram is larger than the farthest zoom: shown at 3x']);
		h.view.set({ x: 930, y: 3000, level: 3 });
		let told = 0;
		const off = h.scene.onView(() => { told++; });
		h.capture.onKeyDown(key(...SHIFT1));
		off();
		assert.equal(told, 0, 'a fit that changes nothing sets nothing');
		assert.equal(h.commits.length, 0);
	} finally { h.restore(); }
});

// ---- Space (PZ27, 3.6) -- the datum pending on its key-down, set on its key-up

const datums = (h) => h.calls.filter((c) => c.name === 'readout.setDatum' && c.args[0]).map((c) => [c.args[0].x, c.args[0].y]);

test('H26.6 move 10: Space\'s datum -- recorded where the pointer is at the key-down, kept through repeats, the pointer\'s moves and Shift, set on the key-up', () => {
	const h = makeInput({ view: true });
	try {
		h.capture.onMove(pointer(1020, 600, { buttons: 0 }));   // drawing (60, 60) through the view part's first opening
		h.capture.onKeyDown(key(' ', { code: 'Space' }));
		h.capture.onMove(pointer(1260, 780, { buttons: 0 }));
		for (let i = 0; i < 3; i++) h.capture.onKeyDown(key(' ', { code: 'Space', repeat: true }));
		h.capture.onKeyDown(key('Shift', { code: 'ShiftLeft', shiftKey: true }));
		h.capture.onKeyUp(key('Shift', { code: 'ShiftLeft' }));
		assert.deepEqual(datums(h), [], 'nothing set while Space is held');
		h.capture.onKeyUp(key(' ', { code: 'Space', shiftKey: true }));
		assert.deepEqual(datums(h), [[60, 60]], 'set on the release, where the key went down -- repeats, moves and Shift changing nothing');
	} finally { h.restore(); }
});

test('H26.6 move 10: a press with Space held that never travels the threshold is no pan, so the release sets the datum; one that does sets none', () => {
	const h = makeInput({ view: true });
	try {
		h.capture.onMove(pointer(1020, 600, { buttons: 0 }));
		h.capture.onKeyDown(key(' ', { code: 'Space' }));
		h.capture.onDown(pointer(1020, 600, { pointerType: 'mouse' }));
		h.capture.onMove(pointer(1023, 600, { pointerType: 'mouse' }));
		h.capture.onUp(pointer(1023, 600, { pointerType: 'mouse', buttons: 0 }));
		h.capture.onKeyUp(key(' ', { code: 'Space' }));
		assert.deepEqual(datums(h), [[60, 60]], 'a sub-threshold drag: no pan, the datum set');
		h.capture.onKeyDown(key(' ', { code: 'Space' }));
		h.capture.onDown(pointer(1020, 600, { pointerType: 'mouse' }));
		h.capture.onMove(pointer(1040, 600, { pointerType: 'mouse' }));
		h.capture.onUp(pointer(1040, 600, { pointerType: 'mouse', buttons: 0 }));
		h.capture.onKeyUp(key(' ', { code: 'Space' }));
		assert.deepEqual(datums(h), [[60, 60]], 'a pan engaged while Space was held: its release sets no datum');
	} finally { h.restore(); }
});

test('H26.6 move 10: focus lost clears the pending datum; Shift+Space clears on its key-down and records nothing; a key-up with nothing pending does nothing', () => {
	const h = makeInput({ view: true });
	try {
		h.capture.onMove(pointer(1020, 600, { buttons: 0 }));
		h.capture.onKeyDown(key(' ', { code: 'Space' }));
		h.capture.onBlur({ timeStamp: 0, preventDefault() {} });
		h.capture.onKeyUp(key(' ', { code: 'Space' }));
		assert.deepEqual(datums(h), [], 'focus lost: nothing set');
		h.capture.onKeyDown(key(' ', { code: 'Space', shiftKey: true }));
		h.capture.onKeyUp(key(' ', { code: 'Space', shiftKey: true }));
		assert.deepEqual(datums(h), [], 'Shift+Space: cleared, nothing pending');
		assert.equal(h.calls.filter((c) => c.name === 'readout.setDatum' && c.args[0] === null).length >= 1, true, 'and the datum cleared on the key-down');
		// a Space typed into a field never reaches the canvas's key-downs (app/src/capture.js), its key-up does: nothing pending, nothing set
		h.capture.onKeyDown(key(' ', { code: 'Space', target: { tagName: 'INPUT' } }));
		h.capture.onKeyUp(key(' ', { code: 'Space', target: { tagName: 'INPUT' } }));
		assert.deepEqual(datums(h), [], 'a key-up after typing in a field: nothing');
	} finally { h.restore(); }
});

test('H26.6 move 10: Space\'s key-up runs while a gesture is live and while help is shown, setting the datum it left pending', () => {
	const h = makeInput({ view: true });
	try {
		const [n0] = seedNodes(h.model, [[0, 0, 'router']]);
		h.capture.onMove(pointer(1080, 600, { buttons: 0 }));
		h.capture.onKeyDown(key(' ', { code: 'Space' }));
		h.capture.onDown(pointer(960, 540, { button: 2, buttons: 2, pointerType: 'mouse', target: h.at(n0.id) }));   // a right press on a device: its move
		h.capture.onMove(pointer(1000, 540, { button: -1, buttons: 2, pointerType: 'mouse', target: h.at(n0.id) }));
		assert.equal(h.input.isGesturing(), true, 'a move live -- no pan');
		h.capture.onKeyUp(key(' ', { code: 'Space' }));
		assert.deepEqual(datums(h), [[120, 60]], 'set while the move is live');
		h.capture.onUp(pointer(1000, 540, { button: 2, buttons: 0, pointerType: 'mouse', target: h.at(n0.id) }));
		h.capture.onKeyDown(key(' ', { code: 'Space' }));
		h.capture.onKeyDown(key('?'));
		assert.equal(h.helpPanel.shown(), true, 'help shown');
		h.capture.onKeyUp(key(' ', { code: 'Space' }));
		assert.equal(datums(h).length, 2, 'set while help is shown');
		assert.equal(h.commits.length, 1, 'the move\'s commit alone: a datum is no edit');
	} finally { h.restore(); }
});

// ---- the remembered view (PZ23, 3.7) -- the view part over a scene of its own, a store and timers of the test's own

function withView(fn, { store = null, w = 1366, h = 535 } = {}) {
	const restore = installDom();
	try {
		const root = fakeEl('svg', 'canvas');
		root.clientWidth = w; root.clientHeight = h;
		const { scene } = sceneOver(root);
		const queued = new Map();
		let n = 0, now = 0;
		const timers = { set: (f, ms) => { queued.set(++n, { f, at: now + ms }); return n; }, clear: (t) => queued.delete(t) };
		const advance = (ms) => { now += ms; for (const [t, q] of [...queued]) if (q.at <= now) { queued.delete(t); q.f(); } };
		fn({ view: new View({ scene, store, timers }), scene, advance, pending: () => queued.size });
	} finally { restore(); }
}
const memory = () => {
	const data = new Map(), writes = [];
	return { data, writes, read: (id) => (data.has(id) ? JSON.parse(data.get(id)) : null), write: (id, value) => { writes.push([id, value]); data.set(id, JSON.stringify(value)); } };
};

test('H26.6 move 10: a view is saved half a second after it last moved, bound to its diagram and to the view as it stood', () => {
	const store = memory();
	withView(({ view, advance }) => {
		view.open('diagram-a');
		assert.deepEqual(store.writes, [], 'opening reads; it writes nothing');
		view.set({ x: 60, y: 0, level: 2 });
		advance(300);
		view.set({ x: 120, y: 0, level: 2 });
		advance(300);
		assert.deepEqual(store.writes, [], 'moved again within the half second: not yet');
		advance(200);
		assert.deepEqual(store.writes, [['diagram-a', { v: 1, x: 120, y: 0, level: 2 }]], 'half a second after the last move, the view as it then stood');
		advance(5000);
		assert.equal(store.writes.length, 1, 'once');
		view.resized();
		advance(1000);
		assert.equal(store.writes.length, 1, 'a resize keeps the view: nothing to save');
	}, { store });
});

test('H26.6 move 10: a switch from A to B to A within the half second keeps each diagram\'s view under its own key', () => {
	const store = memory();
	withView(({ view, advance }) => {
		view.open('diagram-a');
		view.set({ x: 600, y: -300, level: 3 });
		advance(100);
		view.open('diagram-b');
		assert.deepEqual(store.writes, [['diagram-a', { v: 1, x: 600, y: -300, level: 3 }]], 'A\'s save written as B opens, under A');
		assert.deepEqual(view.view, { x: 0, y: 0, level: 1 }, 'B, with nothing remembered, opens as it first does');
		view.set({ x: -60, y: 60, level: 0.5 });
		advance(100);
		view.open('diagram-a');
		assert.deepEqual(store.writes.at(-1), ['diagram-b', { v: 1, x: -60, y: 60, level: 0.5 }], 'B\'s save written as A opens, under B');
		assert.deepEqual(view.view, { x: 600, y: -300, level: 3 }, 'A opens where it was left');
		advance(2000);
		assert.equal(store.writes.length, 2, 'nothing waiting');
		view.open('diagram-a');
		assert.deepEqual(view.view, { x: 600, y: -300, level: 3 }, 'the same diagram again -- a resynchronising snapshot -- keeps the view');
	}, { store });
});

test('H26.6 move 10: the page hiding writes a save still waiting; a template\'s fork keeps the view and is remembered under the fork', () => {
	const store = memory();
	withView(({ view, advance, pending }) => {
		view.open('template-a');
		view.set({ x: 180, y: 0, level: 2 });
		view.flush();
		assert.deepEqual([store.writes, pending()], [[['template-a', { v: 1, x: 180, y: 0, level: 2 }]], 0], 'flushed at once, its timer cleared');
		view.adopt('diagram-f');
		assert.deepEqual(view.view, { x: 180, y: 0, level: 2 }, 'the fork keeps the view the viewer had');
		advance(500);
		assert.deepEqual(store.writes.at(-1), ['diagram-f', { v: 1, x: 180, y: 0, level: 2 }], 'and remembers it under the fork');
	}, { store });
});

test('H26.6 move 10: a remembered value absent, unreadable, of another v or out of range is ignored -- the first opening; a store that throws costs only the memory', () => {
	const bad = [null, undefined, 'x', 7, [], { v: 2, x: 0, y: 0, level: 1 }, { v: 1, x: 1_000_001, y: 0, level: 1 }, { v: 1, x: 0, y: -1_000_001, level: 1 },
		{ v: 1, x: Number.NaN, y: 0, level: 1 }, { v: 1, x: '5', y: 0, level: 1 }, { v: 1, x: 0, y: 0, level: 0 }, { v: 1, x: 0, y: 0, level: -2 },
		{ v: 1, x: 0, y: 0, level: Infinity }, { v: 1, x: 0, y: 0 }, { v: '1', x: 0, y: 0, level: 1 }];
	for (const value of bad) assert.equal(storedView(value), null, `${JSON.stringify(value)}: malformed`);
	assert.deepEqual(storedView({ v: 1, x: 1_000_000, y: -1_000_000, level: 2 }), { x: 1_000_000, y: -1_000_000, level: 2 }, 'the bound itself is within it');
	for (const value of [...bad, 'unparseable']) {
		const store = { read: () => { if (value === 'unparseable') throw new SyntaxError('JSON'); return value; }, write: () => {} };
		withView(({ view }) => {
			view.set({ x: 999, y: 999, level: 3 });
			view.open('diagram-x');
			assert.deepEqual(view.view, { x: 0, y: 0, level: 1 }, `${JSON.stringify(value)}: the diagram opens as it first does`);
		}, { store });
	}
	const throwing = { read: () => { throw new Error('storage blocked'); }, write: () => { throw new Error('quota'); } };
	withView(({ view, advance }) => {
		view.open('diagram-y');
		view.set({ x: 60, y: 60, level: 2 });
		advance(600);
		view.flush();
		view.open('diagram-z');
		assert.deepEqual(view.view, { x: 0, y: 0, level: 1 }, 'a read that throws: the first opening, no error');
		view.zoomOut();
		assert.equal(view.view.level, 2, 'the view works unremembered');
	}, { store: throwing });
});

test('H26.6 move 10: a remembered level not among the presets is read as the nearest by ratio, a tie to the farther, one beyond an end as that end -- after an inner and an outer preset are removed too', () => {
	assert.deepEqual([4, 0.25, 1.2, 2.4, Math.SQRT2, Math.sqrt(6), Math.SQRT1_2].map((l) => nearestLevel(l)), [3, 0.5, 1, 2, 2, 3, 1],
		'4 opens at 3x, 0.25 at 0.5x; the geometric means of two neighbours tie, and go to the farther');
	assert.deepEqual([2, 1.5, 0.75].map((l) => nearestLevel(l, [0.5, 1, 3])), [3, 1, 1], 'the inner 2x removed: 2 is nearer 3 by ratio than 1');
	assert.deepEqual([3, 2.9, 0.4].map((l) => nearestLevel(l, [0.5, 1, 2])), [2, 2, 0.5], 'the outer 3x removed: 3 and beyond open at 2x');
	assert.deepEqual(storedView({ v: 1, x: 5, y: 6, level: 2 }, [0.5, 1, 3]), { x: 5, y: 6, level: 3 });
	const store = { read: () => ({ v: 1, x: 120, y: -60, level: 4 }), write: () => {} };
	withView(({ view, scene }) => {
		view.open('diagram-q');
		assert.deepEqual(view.view, { x: 120, y: -60, level: 3 }, 'a remembered 4 opens at 3x');
		assert.ok(near(scene.view().scale, Math.min(1366 / 1920, 535 / 1080) / 3), 'at 3x\'s scale on this canvas');
	}, { store });
});

test('H26.6 move 10: the lab, handing no store, remembers nothing', () => {
	withView(({ view, advance, pending }) => {
		view.open('diagram-l');
		view.set({ x: 60, y: 60, level: 2 });
		advance(1000);
		view.flush();
		assert.equal(pending(), 0, 'nothing scheduled, nothing written');
	});
});

/*
GR5 (PAN-ZOOM.md section 7) -- THE VIEW IS NEVER IN A DOCUMENT, A COMMIT, A SYNC MESSAGE OR AN EXPORT: the view part imports nothing, so no
commit, sync or store module; the key `draw:view:` is written by the store app/src/main.js makes and nowhere else; no module of the
server, the sync or the export imports the view part; and every verb, driven through the capture, commits nothing and leaves the
document as it was.
*/
test('H26.6 move 10, GR5: the view is in no document, commit, sync message or export -- a source check and the verbs driven', () => {
	const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
	assert.doesNotMatch(read('app/src/view.js').replace(/\/\*[\s\S]*?\*\//g, ''), /^\s*import\b/m, 'the view part imports nothing');
	const walk = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : /\.(m?js)$/.test(e.name) ? [`${dir}/${e.name}`] : []));
	const product = ['app', 'lab', 'server', 'plugins', 'kernel', 'model', 'planner', 'product', 'engine', 'cli'].flatMap(walk);
	assert.deepEqual(product.filter((f) => read(f).includes('draw:view:')), ['app/src/main.js'], 'the key, in the page\'s store alone');
	assert.deepEqual(product.filter((f) => /from ['"][^'"]*\/view\.js['"]/.test(read(f)) && !f.startsWith('app/src/') && !f.startsWith('lab/')), [],
		'no server, planner, model or export module imports the view part');
	assert.doesNotMatch(read('app/src/sync.js'), /from ['"]\.\/view\.js['"]/, 'nor the sync');
	const h = makeInput({ view: true });
	try {
		seedNodes(h.model, [[0, 0, 'router'], [480, 240, 'host']]);
		const doc = JSON.stringify(h.model.toJSON());
		for (const k of ['=', '-', '-', 'h']) h.capture.onKeyDown(key(k));
		h.capture.onKeyDown(key(...SHIFT0)); h.capture.onKeyDown(key(...SHIFT1));
		h.capture.onWheel({ clientX: 500, clientY: 500, button: 0, buttons: 0, shiftKey: false, ctrlKey: true, altKey: false, metaKey: false, deltaX: 0, deltaY: 120, deltaZ: 0, deltaMode: 0, target: { tagName: 'svg' }, preventDefault() {}, stopPropagation() {} });
		assert.notDeepEqual(centre(h), { x: 0, y: 0, level: 1 }, 'control: the view moved');
		assert.deepEqual([h.commits.length, JSON.stringify(h.model.toJSON())], [0, doc], 'no commit, and the document as it was');
	} finally { h.restore(); }
});
