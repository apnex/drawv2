/*
L0, CAPTURE -- stage 1 of the gesture system (dev/design/input/GESTURE-SYSTEM.md, section 5.1, invariant G1).

Capture is the only code that reads a browser event. It turns each one into an INPUT EVENT -- plain data -- hands it to
the input layers, and then does on the real event what they asked for and cannot do themselves: claim it, and take the
pointer. These hold that contract, and G1 itself: the input layers read no DOM.
RESTATED at H26.3 (dev/design/components/INPUT-CAPTURE.md section 5, appendix B): capture is draw's adapter over input-capture, which
reads each event into a fact and does what its reply asks; the adapter makes draw's input event from the fact. So these build it
through the harness's captureDispatch, calling the listeners the component and the adapter added, over fakes that gain the
removeEventListener the component requires; the reading of each field is the component's own tests', and these hold draw's side.
RESTATED at H26.8's capture move (dev/design/components/NATIVE-SHAPES.md section 3.2, Facts; GR5): the adapter makes no input event any
more -- the input layers are handed input-capture's fact itself, frozen, with its reply, which they ask at once -- so these hold the fact
each sink receives, what draw's `hit` and `focus` answer into it, and the reply's claim and capture; and GR5 below, that Input writes
nothing on a fact.
*/
// RESTATED at C-b (H19.30): what a press lands on is answered by the plugins' picks, which the page hands Capture
import { picksOf } from '../app/src/pick.js';
import { PRODUCT_CANVAS } from '../product/canvas.mjs';
const PICKS = picksOf(PRODUCT_CANVAS);
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeInput, pointer, key, seedNodes, captureDispatch as dispatchWith } from './fixtures/client-harness.mjs';
import { SCENARIOS, record } from './fixtures/gesture-corpus.mjs';
import { Input } from '../app/src/input.js';
import { sceneOver } from './fixtures/capture-parity.mjs';
// RESTATED at H26.4 (dev/design/components/VECTOR-SCENE.md section 5.1): the adapter converts by the canvas's scene, so each surface is
// handed a scene over itself, which calls the surface's own getScreenCTM as toCanvas did
// H26.8's picks move: or the scene a test's renderer drew into, with its drawers, so a press is picked and read by item
const captureDispatch = (args) => dispatchWith({ scene: sceneOver(args.svg), ...args });

// a sink that records what it is handed, and optionally claims or captures. RESTATED at H26.5 (dev/design/components/RELEASES-0.2.md
// section 4): and `blur`, the host's focus loss, which draw lists (B413). RESTATED at H26.8's capture move: handed the fact and its reply,
// it asks the reply, as Input does
function probe({ claim = false, capture = false } = {}) {
	const got = [];
	const take = (name) => (fact, reply) => { got.push([name, fact]); if (claim) reply.claim(); if (capture) reply.takePointer(); };
	return { got, sink: { press: take('press'), move: take('move'), release: take('release'), cancelDrag: take('cancel'),
		hover: take('hover'), double: take('double'), keyDown: take('keyDown'), keyUp: take('keyUp'), leave: take('leave'), blur: take('blur') } };
}
const quietSvg = () => { const s = { calls: [], addEventListener() {}, removeEventListener() {}, setPointerCapture: (id) => s.calls.push(id), getScreenCTM: () => ({ inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) }) }; return s; };
const quietHost = () => ({ addEventListener() {}, removeEventListener() {} });
// the fact a sink is handed for one DOM event -- seen as the input layers see it, through capture
function seen(svg, method, evt, drawn = {}) {
	const { got, sink } = probe();
	// RESTATED at C-f: and the parts' run-mode regions; at H26.8's picks move read by item, from the drawn scene and its drawers
	captureDispatch({ svg, host: quietHost(), sink, picks: PICKS, ...drawn })[method](evt);
	return got[0][1];
}

// RESTATED at H26.8's capture move: the fact itself, frozen, what it is on and its region in draw's `hit`
test('a fact is plain data, frozen: it survives JSON unchanged, and its hit carries what the gestures read', () => {
	const h = makeInput();
	try {
		const [n] = seedNodes(h.model, [[0, 0]]);
		// RESTATED at H26.8's picks move: on the device's element the renderer drew, picked by item
		const e = seen(h.svg, 'onDown', pointer(60, 30, { target: h.at(n.id), shiftKey: true, button: 2 }), { scene: h.scene, drawerOf: (id) => h.renderer.drawerOf(id) });
		assert.equal(Object.isFrozen(e), true, 'input-capture\'s fact, frozen');
		assert.deepEqual(JSON.parse(JSON.stringify(e)), e, 'no functions, no elements, no event');
		assert.equal(e.shiftKey, true);
		assert.equal(e.button, 2);
		assert.deepEqual(e.at, { x: 60, y: 30 });
		assert.deepEqual({ kind: e.hit.kind, id: e.hit.id }, { kind: 'node', id: n.id });
		assert.deepEqual(Object.keys(e.hit), ['kind', 'id', 'region'], 'what it is on, then its region -- no other field');
		assert.equal(e.hit.region.entity, true, 'a press carries what run mode asks about');
		assert.equal(e.focus, null, 'a pointer fact has no focus');
	} finally { h.restore(); }
});

test('H26.5 (RD18): every pointer\'s fact carries its pointerId for input-binding -- null when the event\'s is no safe integer; a key\'s null', () => {
	const methods = [['onDown'], ['onMove'], ['onUp'], ['onCancel'], ['onHover', true], ['onHover', false], ['onDblClick']];
	const at = (pointerId) => methods.map(([m, entering]) => {
		const { got, sink } = probe();
		const c = captureDispatch({ svg: quietSvg(), host: quietHost(), sink, picks: PICKS });
		const evt = { clientX: 0, clientY: 0, target: {}, preventDefault() {}, ...(pointerId === undefined ? {} : { pointerId }) };
		if (m === 'onHover') c[m](evt, entering); else c[m](evt);
		return got[0][1].pointerId;
	});
	assert.deepEqual(at(7), [7, 7, 7, 7, 7, 7, 7], 'the platform\'s pointer, on every pointer event');
	for (const odd of [undefined, 1.5, '7', -0.5, 2 ** 53]) assert.deepEqual(at(odd), Array(7).fill(null), `pointerId ${String(odd)}: none`);
	assert.equal(seen(quietSvg(), 'onKeyDown', key('c')).pointerId, null, 'a key\'s fact names no pointer, as it has no at');   // H26.8: the fact's null
});

// RESTATED at H26.8's picks move: a target is asked by item -- an object the scene did not make is open ground, every field empty -- and
// none at all gives no region; a page's pointer event always has an element for its target, as it always had one to ask
test('no target to ask gives no region -- run mode places nothing then, as before; one the scene did not make is open ground', () => {
	assert.equal(seen(quietSvg(), 'onDown', { clientX: 0, clientY: 0, target: null, preventDefault() {} }).hit.region, null);
	assert.deepEqual(seen(quietSvg(), 'onDown', { clientX: 0, clientY: 0, target: {}, preventDefault() {} }).hit.region,
		{ target: null, overTarget: false, action: null, input: null, owner: null, control: false, entity: false });
});

test('what the input layers ask for is done on the real event: a claim is preventDefault, a capture takes the pointer', () => {
	const svg = quietSvg();
	const { sink } = probe({ claim: true, capture: true });
	const c = captureDispatch({ svg, host: quietHost(), sink, picks: PICKS });
	let prevented = 0;
	c.onDown({ clientX: 0, clientY: 0, pointerId: 7, target: {}, preventDefault: () => { prevented++; } });
	assert.equal(prevented, 1);
	assert.deepEqual(svg.calls, [7]);
	const { sink: quiet } = probe();
	let untouched = 0;
	captureDispatch({ svg: quietSvg(), host: quietHost(), sink: quiet }).onDown({ clientX: 0, clientY: 0, pointerId: 7, target: {}, preventDefault: () => { untouched++; } });
	assert.equal(untouched, 0, 'nothing asked, nothing done');
});

test('keys typed into a field never reach the input layers; key-ups and other keys do', () => {
	const { got, sink } = probe();
	const c = captureDispatch({ svg: quietSvg(), host: quietHost(), sink });
	for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) c.onKeyDown(key('c', { target: { tagName } }));
	assert.deepEqual(got, []);
	c.onKeyDown(key('c'));
	c.onKeyUp(key('Shift', { target: { tagName: 'INPUT' } }));
	assert.deepEqual(got.map(([n, e]) => [n, e.key]), [['keyDown', 'c'], ['keyUp', 'Shift']]);
});

test('a key says whether focus is on a control, which Tab must leave to the browser', () => {
	const onButton = { tagName: 'BUTTON', closest: (s) => (s.includes('button') ? {} : null) };
	assert.equal(seen(quietSvg(), 'onKeyDown', key('Tab', { target: onButton })).focus.onControl, true);   // H26.8: the fact's focus
	assert.equal(seen(quietSvg(), 'onKeyDown', key('Tab')).focus.onControl, false);
});

/*
Move 6's verification (should-fix 1) -- INPUT TAKES THE POINTER ON A PRESS THAT STARTS A GESTURE, AND ON NO OTHER EVENT. Since the move the
take is asked of the reply at once (IC8), where the old capture took it after Input returned; the platform refuses a synthetic pointer, so a
take and its absence answered alike, and a press that took nothing passed. The harness records each take before refusing it (`h.takes`).
*/
test('Input takes the pointer once, its own id, on a press that starts a gesture -- not on a press no row matches, a move or a release', () => {
	const h = makeInput();
	try {
		const [a] = seedNodes(h.model, [[0, 0]]);
		const took = (f) => { const n = h.takes.length; f(); return h.takes.slice(n); };
		assert.deepEqual(took(() => h.capture.onDown(pointer(0, 0, { target: h.at(a.id), pointerId: 5 }))), [5], 'a left press on a device, the link gesture starting: taken, its pointer');
		assert.deepEqual(took(() => h.capture.onMove(pointer(40, 0, { target: h.at(a.id), pointerId: 5 }))), [], 'its move takes nothing');
		assert.deepEqual(took(() => h.capture.onUp(pointer(40, 0, { buttons: 0, pointerId: 5 }))), [], 'nor its release');
		assert.deepEqual(took(() => h.capture.onDown(pointer(-600, -600, { pointerId: 6 }))), [6], 'a left press on open ground, the marquee starting: taken');
		h.capture.onUp(pointer(-600, -600, { buttons: 0, pointerId: 6 }));
		assert.deepEqual(took(() => h.capture.onDown(pointer(-600, -600, { button: 2, buttons: 2, pointerId: 7 }))), [], 'a right press on open ground, which no row matches: nothing taken');
		h.capture.onUp(pointer(-600, -600, { button: 2, buttons: 0, pointerId: 7 }));
		assert.deepEqual(took(() => h.capture.onDown(pointer(-600, -600, { button: 1, buttons: 4, pointerId: 8 }))), [], 'nor a middle press');
		h.capture.onUp(pointer(-600, -600, { button: 1, buttons: 0, pointerId: 8 }));
		assert.deepEqual(h.takes, [5, 6], 'two takes in all');
	} finally { h.restore(); }
});

/*
Move 6's verification (should-fix 2) -- TAB THROUGH CAPTURE, BY WHERE FOCUS IS. Tab shows or hides the names only while the canvas holds
focus, and is claimed only then, so on a toolbar control it traverses the page (B47): the fact's `focus`, draw's own answer, read before
anything is claimed. Driven through capture, the claim the reply makes is the real event's preventDefault.
*/
test('Tab through capture: on a control, nothing claimed and the names untouched; off one, claimed once and the names toggled', () => {
	const h = makeInput();
	try {
		const toggles = () => h.calls.filter((c) => c.name === 'renderer.toggleLabels').length;
		const onButton = { tagName: 'BUTTON', closest: (s) => (s.includes('button') ? {} : null) };
		let claimed = 0;
		h.capture.onKeyDown(key('Tab', { target: onButton, preventDefault: () => { claimed++; } }));
		assert.deepEqual([claimed, toggles()], [0, 0], 'focus on a button: the key left to the browser, the names as they were');
		h.capture.onKeyDown(key('Tab', { preventDefault: () => { claimed++; } }));
		assert.deepEqual([claimed, toggles()], [1, 1], 'focus off any control: claimed, and the names toggled');
	} finally { h.restore(); }
});

test('H26.5 (B413): the host\'s focus loss reaches the input layers\' blur, as plain data with every modifier false, and takes no pointer', () => {
	const svg = quietSvg();
	const { got, sink } = probe({ capture: true });
	const c = captureDispatch({ svg, host: quietHost(), sink });
	c.onBlur({ timeStamp: 3, preventDefault() {} });
	assert.deepEqual(got.map(([n]) => n), ['blur']);
	const [[, e]] = got;
	assert.deepEqual(JSON.parse(JSON.stringify(e)), e, 'no functions, no elements, no event');
	assert.deepEqual([e.shiftKey, e.ctrlKey, e.altKey, e.metaKey], [false, false, false, false], 'what Input hands the arming: nothing held');
	assert.deepEqual(svg.calls, [], 'a capture asked of a focus loss takes nothing: its fact names no pointer');
});

test('B75: the context menu is suppressed everywhere but a field -- the browser\'s question, answered in capture', () => {
	const c = captureDispatch({ svg: quietSvg(), host: quietHost(), sink: probe().sink });
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

// RESTATED at H26.8's picks move: on the click twin the renderer drew for a link, its `hit` item
test('B268: a press on a link\'s hit twin is a press on the link', () => {
	const h = makeInput();
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [360, 0]]);
		h.model.put('link', { id: 'link-000001', name: 'l', src: a.id, dst: b.id });
		const e = seen(h.svg, 'onDown', pointer(180, 0, { target: h.at('link-000001/hit') }), { scene: h.scene, drawerOf: (id) => h.renderer.drawerOf(id) });
		assert.deepEqual({ kind: e.hit.kind, id: e.hit.id }, { kind: 'link', id: 'link-000001' });
	} finally { h.restore(); }
});

/*
H26.8's capture move (dev/design/components/NATIVE-SHAPES.md section 3.2, Facts; GR5) -- INPUT RECEIVES INPUT-CAPTURE'S FACT ITSELF,
FROZEN, AND WRITES NOTHING ON IT. Every scenario of the gesture corpus is driven through the product's Input, each entry point capture
routes to watched: the fact it is handed is input-capture's, frozen, its properties in the component's order, with a reply; and when the scenario
ends, every fact Input was handed -- its `hit` and `focus`, draw's own answers, among it -- reads as it did when it arrived. A write on
the fact itself throws, Input's module being strict; one on its `hit` is found here.
RESTATED at move 6's verification (should-fix 4): `hit`, `focus` and `hit.region` are compared by their own keys, where JSON compared
them -- every key, a string or a symbol, enumerable or not, with its value, so a function, a symbol or an `undefined` written on one is
seen, as JSON saw none of them; each object by identity too, so one replaced by its copy is seen; what `region` holds -- the element
pressed, its entity, the page's to change -- by identity alone.
*/
const OWN_DEPTH = 2;   // hit, then region, its own keys; what region holds by identity
function ownEntries(v, at = '', depth = 0) {
	if (v === null || typeof v !== 'object' || depth === OWN_DEPTH) return [[at, typeof v, v]];
	const out = [[at, 'object', v, Object.isFrozen(v), Object.getPrototypeOf(v)]];
	for (const k of Reflect.ownKeys(v)) {
		const d = Object.getOwnPropertyDescriptor(v, k);
		const name = `${at}[${typeof k === 'symbol' ? 'symbol ' : ''}${String(k)}]`;
		if ('value' in d) out.push(...ownEntries(d.value, name, depth + 1).map((e) => [...e, d.enumerable, d.writable]));
		else out.push([name, 'accessor', d.get, d.set, d.enumerable]);
	}
	return out;
}
const ownOf = (fact) => [...ownEntries(fact.hit, 'hit'), ...ownEntries(fact.focus, 'focus'), ...ownEntries(fact.hit?.region, 'region', 1)];
// the first entry that differs, by Object.is, or null when none
function ownChange(was, now) {
	for (let i = 0; i < Math.max(was.length, now.length); i++) {
		const a = was[i], b = now[i];
		const said = (e) => (e ? `${e[0]} = ${String(e[2])}` : 'absent');
		if (!a || !b || a.length !== b.length || a.some((x, j) => !Object.is(x, b[j]))) return `${said(a)} -> ${said(b)}`;
	}
	return null;
}
test('GR5: Input is handed each fact itself, frozen, with its reply, and writes nothing on it -- over the whole corpus', () => {
	const ENTRIES = ['press', 'move', 'release', 'cancelDrag', 'hover', 'leave', 'double', 'keyDown', 'keyUp', 'blur'];
	const real = Object.fromEntries(ENTRIES.map((m) => [m, Input.prototype[m]]));
	let handed = [];
	const writes = [];   // a write on the frozen fact throws in Input's strict module; the corpus records a throw, so it is caught here too
	for (const m of ENTRIES) {
		Input.prototype[m] = function (fact, reply, ...rest) {
			if (reply !== undefined) handed.push({ m, fact, reply, was: JSON.stringify(fact), own: ownOf(fact) });
			try { return real[m].call(this, fact, reply, ...rest); } catch (e) {
				if (e instanceof TypeError && /read only|read-only|not extensible|Cannot (?:assign|add|define)/i.test(e.message)) writes.push(`${m}: ${e.message}`);
				throw e;
			}
		};
	}
	let facts = 0;
	try {
		for (const s of SCENARIOS) {
			handed = [];
			record(s);
			for (const { m, fact, reply, was, own } of handed) {
				assert.equal(Object.isFrozen(fact), true, `${s.id}: ${m} was handed a frozen fact`);
				assert.deepEqual(Object.keys(fact).slice(0, 5), ['type', 'at', 'screen', 'hit', 'focus'], `${s.id}: ${m} was handed input-capture's fact, in its own order`);
				assert.equal(typeof reply.claim === 'function' && typeof reply.takePointer === 'function', true, `${s.id}: and its reply`);
				assert.equal(JSON.stringify(fact), was, `${s.id}: ${m}'s fact, its hit and focus among it, as it arrived`);
				assert.equal(ownChange(own, ownOf(fact)), null, `${s.id}: ${m}'s hit, focus and region, every own key, as they arrived`);
			}
			facts += handed.length;
		}
	} finally { for (const m of ENTRIES) Input.prototype[m] = real[m]; }
	assert.deepEqual(writes, [], 'no write on a fact was attempted');
	assert.ok(facts > 300, `control: the corpus hands Input its facts (${facts})`);
});
