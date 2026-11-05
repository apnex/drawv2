/*
S2 (the production gate of H26.6's moves 9 to 12; dev/design/components/PAN-ZOOM.md section 3.8, "The bound": "the `view` part holds the
view's centre within the bound") -- THE VIEW'S CENTRE HELD WITHIN PZ31'S BOUND. The gate's reproduction: twelve wheel steps from x 999,000
at 3x took the centre to 1,033,006; the view saved there was refused on reload (`storedView`), and the viewer reopened silently at 0,0.
Now the view part's one write holds each axis of the centre to +-1,000,000 -- a wheel, a drag, a pinch, a key and a view set outright --
so a view saved at the bound is the view reopened. On the view part over a scene, a store and timers of the test's own.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, fakeEl, sceneOver } from './fixtures/client-harness.mjs';
import { View, storedView } from '../app/src/view.js';

function withView(fn, store) {
	const restore = installDom();
	try {
		const root = fakeEl('svg', 'canvas');
		root.clientWidth = 1366; root.clientHeight = 535;
		const { scene } = sceneOver(root);
		const queued = [];
		const timers = { set: (f) => { queued.push(f); return queued.length; }, clear: () => {} };
		fn({ view: new View({ scene, store, timers }), scene, settle: () => { for (const f of queued.splice(0)) f(); } });
	} finally { restore(); }
}
const memory = () => {
	const data = new Map();
	return { data, read: (id) => (data.has(id) ? JSON.parse(data.get(id)) : null), write: (id, value) => data.set(id, JSON.stringify(value)) };
};
// the centre the scene shows, from its top-left corner and scale
const shown = (scene) => { const { region } = scene.visible(); return { x: region.x + region.w / 2, y: region.y + region.h / 2 }; };

test('S2: twelve wheel steps from x 999,000 at 3x stop at the bound, and the view saved there reopens there, not at 0,0', () => {
	const store = memory();
	withView(({ view, scene, settle }) => {
		view.open('diagram-a');
		view.set({ x: 999_000, y: 0, level: 3 });
		for (let i = 0; i < 12; i++) view.scrollPan(1000, 0, 0);
		assert.deepEqual(view.view, { x: 1_000_000, y: 0, level: 3 }, 'the centre held at 1,000,000, where it went to 1,033,006');
		assert.ok(Math.abs(shown(scene).x - 1_000_000) < 1e-6, 'and the scene shows that centre');
		settle();
		const saved = store.read('diagram-a');
		assert.deepEqual([saved, storedView(saved)], [{ v: 1, x: 1_000_000, y: 0, level: 3 }, { x: 1_000_000, y: 0, level: 3 }], 'saved at the bound, and read back as valid');
	}, store);
	withView(({ view }) => {
		view.open('diagram-a');
		assert.deepEqual(view.view, { x: 1_000_000, y: 0, level: 3 }, 'reopened where it was left -- not silently at 0,0');
	}, store);
});

test('S2: every way the view moves holds its centre within the bound, on both axes and both signs -- a drag, a pinch, a key, a view set outright', () => {
	withView(({ view }) => {
		view.set({ x: -999_990, y: 999_990, level: 3 });
		view.dragPan(4000, -4000);
		assert.deepEqual(view.view, { x: -1_000_000, y: 1_000_000, level: 3 }, 'a drag past both edges, held at each');
		view.set({ x: 2_000_000, y: -5e9, level: 1 });
		assert.deepEqual(view.view, { x: 1_000_000, y: -1_000_000, level: 1 }, 'a view set past the bound, held');
		view.set({ x: 999_999, y: 0, level: 1 });
		view.pinchZoom({ x: 1300, y: 260 }, -100, 0);
		assert.ok(view.view.level === 0.5 && view.view.x <= 1_000_000, `a pinch about a point near the edge keeps the centre within (${view.view.x})`);
		view.set({ x: 1_000_000, y: 0, level: 0.5 });
		view.zoomOut();
		assert.deepEqual(view.view, { x: 1_000_000, y: 0, level: 1 }, 'a key about the centre at the bound');
		view.set({ x: 999_000, y: -999_000, level: 1 });
		assert.deepEqual(view.view, { x: 999_000, y: -999_000, level: 1 }, 'control: within the bound, as set');
	});
});
