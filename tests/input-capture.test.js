/*
L0, CAPTURE -- stage 1 of the gesture system (dev/design/input/GESTURE-SYSTEM.md, section 5.1, invariant G1).

Capture is the only code that reads a browser event. It turns each one into an INPUT EVENT -- plain data -- hands it to
the input layers, and then does on the real event what they asked for and cannot do themselves: claim it, and take the
pointer. These hold that contract, and G1 itself: the input layers read no DOM.
*/
// RESTATED at C-b (H19.30): what a press lands on is answered by the plugins' picks, which the page hands Capture
import { picksOf, regionsOf } from '../app/src/pick.js';
import { PRODUCT_CANVAS } from '../product/canvas.mjs';
const PICKS = picksOf(PRODUCT_CANVAS);
const REGIONS = regionsOf(PRODUCT_CANVAS);   // C-f: run mode's regions, the parts'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeInput, pointer, key, seedNodes, installDom } from './fixtures/client-harness.mjs';
import { Capture } from '../app/src/capture.js';

// a sink that records what it is handed, and optionally claims or captures
function probe({ claim = false, capture = false } = {}) {
	const got = [];
	const take = (name) => (e) => { got.push([name, e]); if (claim) e.claimed = true; if (capture) e.capture = true; };
	return { got, sink: { press: take('press'), move: take('move'), release: take('release'), cancelDrag: take('cancel'),
		hover: take('hover'), double: take('double'), keyDown: take('keyDown'), keyUp: take('keyUp'), leave: take('leave') } };
}
const quietSvg = () => { const s = { calls: [], addEventListener() {}, setPointerCapture: (id) => s.calls.push(id), getScreenCTM: () => ({ inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) }) }; return s; };
const quietHost = { addEventListener() {} };
// the input event a sink is handed for one DOM event -- seen as the input layers see it, through a Capture
function seen(svg, method, evt) {
	const { got, sink } = probe();
	new Capture({ svg, host: quietHost, sink, picks: PICKS, regions: REGIONS })[method](evt);   // RESTATED at C-f: and the parts' run-mode regions
	return got[0][1];
}

test('an input event is plain data: it survives JSON unchanged, and carries the DOM\'s names for what gestures read', () => {
	const h = makeInput();
	try {
		const [n] = seedNodes(h.model, [[0, 0]]);
		const target = { tagName: 'g', classList: { contains: () => false }, dataset: {}, closest: (s) => (s.includes('node') ? { id: n.id } : null) };
		const e = seen(h.svg, 'onDown', pointer(60, 30, { target, shiftKey: true, button: 2 }));
		assert.deepEqual(JSON.parse(JSON.stringify(e)), e, 'no functions, no elements, no event');
		assert.equal(e.shiftKey, true);
		assert.equal(e.button, 2);
		assert.deepEqual(e.at, { x: 60, y: 30 });
		assert.deepEqual(e.on, { kind: 'node', id: n.id });
		assert.equal(e.region.entity, true, 'a press carries what run mode asks about');
	} finally { h.restore(); }
});

test('a target that cannot be asked gives no region -- run mode places nothing then, as before', () => {
	const e = seen(quietSvg(), 'onDown', { clientX: 0, clientY: 0, target: {}, preventDefault() {} });
	assert.equal(e.region, null);
});

test('what the input layers ask for is done on the real event: a claim is preventDefault, a capture takes the pointer', () => {
	const svg = quietSvg();
	const { sink } = probe({ claim: true, capture: true });
	const c = new Capture({ svg, host: quietHost, sink, picks: PICKS });
	let prevented = 0;
	c.onDown({ clientX: 0, clientY: 0, pointerId: 7, target: {}, preventDefault: () => { prevented++; } });
	assert.equal(prevented, 1);
	assert.deepEqual(svg.calls, [7]);
	const { sink: quiet } = probe();
	let untouched = 0;
	new Capture({ svg: quietSvg(), host: quietHost, sink: quiet }).onDown({ clientX: 0, clientY: 0, pointerId: 7, target: {}, preventDefault: () => { untouched++; } });
	assert.equal(untouched, 0, 'nothing asked, nothing done');
});

test('keys typed into a field never reach the input layers; key-ups and other keys do', () => {
	const { got, sink } = probe();
	const c = new Capture({ svg: quietSvg(), host: quietHost, sink });
	for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) c.onKeyDown(key('c', { target: { tagName } }));
	assert.deepEqual(got, []);
	c.onKeyDown(key('c'));
	c.onKeyUp(key('Shift', { target: { tagName: 'INPUT' } }));
	assert.deepEqual(got.map(([n, e]) => [n, e.key]), [['keyDown', 'c'], ['keyUp', 'Shift']]);
});

test('a key says whether focus is on a control, which Tab must leave to the browser', () => {
	const onButton = { tagName: 'BUTTON', closest: (s) => (s.includes('button') ? {} : null) };
	assert.equal(seen(quietSvg(), 'onKeyDown', key('Tab', { target: onButton })).onControl, true);
	assert.equal(seen(quietSvg(), 'onKeyDown', key('Tab')).onControl, false);
});

test('B75: the context menu is suppressed everywhere but a field -- the browser\'s question, answered in capture', () => {
	const c = new Capture({ svg: quietSvg(), host: quietHost, sink: probe().sink });
	const menu = (target) => { let n = 0; c.onContextMenu({ target, preventDefault: () => { n++; } }); return n; };
	assert.equal(menu({ closest: () => null }), 1, 'on the canvas: suppressed');
	assert.equal(menu({ closest: (s) => (s.includes('textarea') ? {} : null) }), 0, 'in a field: the browser keeps it');
});

/*
G1 -- the input layers read no DOM. Checked on the source with comments removed, since a comment may name what the code
must not do. `ctx.target` is gesture state (the drop target's id), not an event target.
*/
test('G1: app/src/input.js reads no DOM event and touches no DOM API -- that is capture\'s', () => {
	const src = fs.readFileSync(new URL('../app/src/input.js', import.meta.url), 'utf8')
		.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
	const DOM = /preventDefault|\bevt\.target\b|\be\.target\b|\.closest\(|\.dataset\b|classList|setPointerCapture|ownerDocument|\bdocument\.|activeElement|addEventListener|querySelector|\.hidden\b|\btoCanvas\(|\bhitOf\(|clientX|pointerId|CustomEvent|getScreenCTM/g;
	const found = [...new Set(src.match(DOM) ?? [])];
	assert.deepEqual(found, [], `DOM reads left in the input layers: ${found.join(', ')}`);
});

test('B268: a press on a link\'s hit twin is a press on the link', () => {
	const restore = installDom();
	try {
	const svg = { addEventListener() {}, setPointerCapture() {}, getScreenCTM: () => ({ inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) }) };
	const got = [];
	const sink = new Proxy({}, { get: () => (e) => got.push(e) });
	const c = new Capture({ svg, host: { addEventListener() {} }, sink, picks: PICKS });
	const twin = { tagName: 'path', id: '', dataset: { link: 'link-000001' }, classList: { contains: (k) => k === 'link-hit' }, closest: () => null };
	c.onDown({ clientX: 0, clientY: 0, button: 0, target: twin, preventDefault() {} });
	assert.deepEqual(got[0].on, { kind: 'link', id: 'link-000001' });
	} finally { restore(); }
});
