/*
H26.6's move 11 (dev/design/components/PAN-ZOOM.md section 3.7, "At each level"; PZ12; the director's ruling after move 10, section 9) --
THE LABELS' RULE: a label and its pill hidden where its text, 13 drawing units (kernel/spec.mjs STD.fontSize), would fall under the view
part's LABEL_FLOOR, 5 screen pixels -- on a canvas 1,366 by 535 at 2x and 3x, on one 1,920 by 847 at 3x alone (`zoom-levels.mjs`) -- held in
app/src/view.js beside the other values, one edit to tune; planted at other values, the rule follows them. The renderer's class and the
page's drawing are tests/lab-browser.test.js's; the export draws every label, reading no view (tests/svgexport.test.js unchanged).
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { installDom, fakeEl, sceneOver } from './fixtures/client-harness.mjs';
import { View } from '../app/src/view.js';
import { STD } from '../kernel/spec.mjs';

const SOURCE = fs.readFileSync(new URL('../app/src/view.js', import.meta.url), 'utf8');
const planted = (floor) => new Function(`${SOURCE.replace('const LABEL_FLOOR = 5;', `const LABEL_FLOOR = ${floor};`).replace(/^export /gm, '')}\nreturn View;`)();
function shownAt(ViewClass, w, h) {
	const restore = installDom();
	try {
		const root = fakeEl('svg', 'canvas');
		root.clientWidth = w; root.clientHeight = h;
		const { scene } = sceneOver(root);
		const view = new ViewClass({ scene });
		return [0.5, 1, 2, 3].map((level) => { view.set({ x: 0, y: 0, level }); return view.labelsShown(STD.fontSize); });
	} finally { restore(); }
}

test('H26.6 move 11: a label shows at a level only where its 13 units reach 5 screen pixels -- 1366 wide hidden at 2x and 3x, 1920 wide at 3x alone', () => {
	assert.equal(STD.fontSize, 13, 'a label\'s text, the size the floor is judged against');
	assert.match(SOURCE, /^const LABEL_FLOOR = 5;/m, 'the floor held in view.js, one edit to tune');
	assert.deepEqual(shownAt(View, 1366, 535), [true, true, false, false], '12.9, 6.4, 3.2 and 2.1 pixels');
	assert.deepEqual(shownAt(View, 1920, 847), [true, true, true, false], '20.4, 10.2, 5.1 and 3.4 pixels');
	assert.deepEqual(shownAt(View, 0, 0), [true, true, true, true], 'a root not laid out has no scale: its labels show');
});

// the production gate of moves 9 to 12 (a low): 3.7 hides a label "under 5 screen pixels", so one exactly at the floor shows -- 10 units at a
// scale of a half is 5 pixels, exact in binary64; a hair under, hidden
test('H26.6 move 11, the gate\'s low: a label exactly at the 5 pixel floor shows, and one a hair under it is hidden', () => {
	const restore = installDom();
	try {
		const root = fakeEl('svg', 'canvas');
		root.clientWidth = 1366; root.clientHeight = 535;
		const { scene } = sceneOver(root);
		const view = new View({ scene });
		assert.equal(10 * 0.5, 5, 'control: exactly 5 pixels');
		assert.equal(view.labelsShown(10, 0.5), true, 'at the floor: shown');
		assert.equal(view.labelsShown(10, 0.5 - 2 ** -40), false, 'a hair under: hidden');
		assert.equal(view.labelsShown(13, 5 / 13 + 2 ** -40), true, 'and 13 units at a hair over 5 pixels: shown');
	} finally { restore(); }
});

test('H26.6 move 11: LABEL_FLOOR planted at other values moves the rule with it -- the one edit tunes it', () => {
	assert.deepEqual(shownAt(planted(7), 1366, 535), [true, false, false, false], 'at 7, 1x\'s 6.4 pixels hidden too');
	assert.deepEqual(shownAt(planted(3), 1366, 535), [true, true, true, false], 'at 3, 2x\'s 3.2 shown');
	assert.deepEqual(shownAt(planted(2), 1366, 535), [true, true, true, true], 'at 2, every level shown');
	assert.deepEqual(shownAt(planted(5.2), 1920, 847), [true, true, false, false], 'at 5.2, 1920\'s 2x at 5.1 hidden');
	assert.deepEqual(shownAt(planted(0), 1366, 535), [true, true, true, true], 'at 0, the rule set aside');
});

// the composition's listener judges each view as the scene tells it: the view part writes the scene first and holds its own level after
// (so a throw before the write leaves the view as it was), so the listener reads the scale the scene hands it, never the level held
test('H26.6 move 11: a listener told a view judges that view\'s labels -- the scale the scene hands it, not the view part\'s level, which follows the write', () => {
	const restore = installDom();
	try {
		const root = fakeEl('svg', 'canvas');
		root.clientWidth = 1366; root.clientHeight = 535;
		const { scene } = sceneOver(root);
		const view = new View({ scene }), seen = [];
		scene.onView((visible) => seen.push(view.labelsShown(STD.fontSize, visible.scale)));
		for (const level of [2, 3, 1, 0.5, 2]) view.set({ x: 0, y: 0, level });
		assert.deepEqual(seen, [false, false, true, true, false], 'each view\'s own answer, as it is told');
	} finally { restore(); }
});

// the composition wires it: the renderer's class follows each view the scene tells, and the canvas's sheet hides the label and its pill by it
test('H26.6 move 11: the composition sets the renderer\'s labels-far class on every view, and the canvas\'s sheet hides a label and its pill by it, as labels-off does', () => {
	const compose = fs.readFileSync(new URL('../app/src/compose-canvas.js', import.meta.url), 'utf8');
	assert.match(compose, /const showLabels = \(visible\) => renderer\.setLabelsFar\(!view\.labelsShown\(STD\.fontSize, visible\?\.scale\)\);\n\tscene\.onView\(showLabels\);\n\tshowLabels\(\);/);
	const css = fs.readFileSync(new URL('../app/canvas.css', import.meta.url), 'utf8');
	assert.match(css, /#container\.labels-far \.label, #container\.labels-far \.label-pill \{ display: none; \}/);
	assert.match(fs.readFileSync(new URL('../app/src/renderer.js', import.meta.url), 'utf8'), /setLabelsFar\(far\) \{\n\t\tthis\.svg\?\.classList\.toggle\('labels-far', far\);\n\t\}/, 'the renderer toggles the class');
});
