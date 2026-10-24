/*
H26.3 (dev/design/components/INPUT-CAPTURE.md section 4, acceptance step 3; section 5; D9; guardrails G1, G2, G5) -- DRAW'S CAPTURE IS AN
ADAPTER OVER `@apnex/input-capture`.

`app/src/capture.js` exports `captureCanvas` and `emitToHost` and no class; it adds no listener for a pointer, double-click or key event
and reads no field of one -- the component adds those listeners and reads those events, handing the adapter a frozen fact and the
platform's target alone -- its one listener being the B75 menu's; Input's entry points take the input events they took, each in today's
form and key order; and only that module, of the product's, names the component. Each is found by what the code does where it can be:
which module's code adds each listener and reads each field is read off the stack at the moment it happens.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { FOLDERS, PARTS } from '../tools/layers.mjs';
import * as adapter from '../app/src/capture.js';
import { picksOf, regionsOf } from '../app/src/pick.js';
import { PRODUCT_CANVAS } from '../product/canvas.mjs';
import { installDom } from './fixtures/client-harness.mjs';
import { sceneOver } from './fixtures/capture-parity.mjs';   // H26.4: a scene over a surface, whose toDrawing the adapter converts by

/*
RESTATED at H26.3's verification (V5): each path compared as the file system resolves it. Node names a module on the stack by its real
path, so a tree whose node_modules is a symlink -- a worktree linking its root's -- names the component by the link's target, and the
paths are compared only once both sides are resolved.
*/
const real = (p) => { try { return fs.realpathSync(p); } catch { return p; } };
const ROOT = real(path.resolve(import.meta.dirname, '..'));
const HERE = real(fileURLToPath(import.meta.url));
const ADAPTER = real(path.join(ROOT, 'app/src/capture.js'));
const COMPONENT = real(path.join(ROOT, 'node_modules/@apnex/input-capture/dist')) + path.sep;
const COMPONENT_ENTRY = pathToFileURL(real(path.join(ROOT, 'node_modules/@apnex/input-capture/dist/index.js'))).href;

// the module whose code is running where this is called: the first frame of the stack outside this file and the runtime's own
function caller() {
	const frames = new Error().stack.split('\n').slice(1).map((l) => l.match(/\((?:file:\/\/)?([^():]+):\d+:\d+\)|at (?:file:\/\/)?([^():\s]+):\d+:\d+/)).filter(Boolean).map((m) => m[1] ?? m[2]);
	const file = frames.map(real).find((f) => f !== HERE && !f.startsWith('node:'));
	return file?.startsWith(COMPONENT) ? 'component' : file === ADAPTER ? 'adapter' : file ?? 'none';
}

// fakes that record each listener added to them and who added it, and each removal
function fakes() {
	const added = [], removed = [], listeners = new Map();
	const fake = (tag, extra = {}) => ({
		addEventListener(name, l) { added.push([`${tag}:${name}`, caller()]); listeners.set(`${tag}:${name}`, l); },
		removeEventListener(name) { removed.push(`${tag}:${name}`); },
		...extra,
	});
	const svg = fake('svg', { setPointerCapture() {}, getScreenCTM: () => ({ inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) }) });
	return { svg, host: fake('host', { dispatchEvent() { return true; } }), added, removed, listeners };
}

// an event as a recording Proxy: each field read and who read it
function recorded(fields) {
	const reads = [];
	const evt = new Proxy(fields, { get(t, k, r) { if (typeof k === 'string') reads.push([k, caller()]); return Reflect.get(t, k, r); } });
	return { evt, reads };
}

// RESTATED at H26.5 (dev/design/components/RELEASES-0.2.md section 4): and `blur`, the host's focus loss, which draw lists (B413)
const SINK = ['press', 'move', 'release', 'cancelDrag', 'hover', 'double', 'keyDown', 'keyUp', 'leave', 'blur'];
const recordingSink = (got, answer = () => {}) => Object.fromEntries(SINK.map((m) => [m, (...args) => { got.push([m, args]); answer(m, args[0]); }]));
const open = (got = [], answer) => {
	const f = fakes();
	// RESTATED at H26.4 (dev/design/components/VECTOR-SCENE.md appendix B): handed the canvas's scene, as the composition hands it
	const capture = adapter.captureCanvas({ svg: f.svg, scene: sceneOver(f.svg), host: f.host, sink: recordingSink(got, answer), picks: picksOf(PRODUCT_CANVAS), regions: regionsOf(PRODUCT_CANVAS) });
	return { ...f, capture, got };
};

test('H26.3 step 3: app/src/capture.js exports captureCanvas and emitToHost, and no class', () => {
	assert.deepEqual(Object.keys(adapter).sort(), ['captureCanvas', 'emitToHost']);
	for (const [name, f] of Object.entries(adapter)) assert.doesNotMatch(Function.prototype.toString.call(f), /^class\b/, `${name} is no class`);
	assert.doesNotMatch(fs.readFileSync(ADAPTER, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''), /\bclass\b/, 'and the module declares none');
});

// RESTATED at H26.5 (RELEASES-0.2.md section 4): the host's blur, which draw lists, added by the component after its ten (IC4) and before
// the menu's, and removed first of the component's
test('H26.3 step 3: the component adds every pointer, double-click and key listener, in today\'s order; the adapter adds the menu\'s alone, after them', () => {
	const restore = installDom();
	try {
		const o = open();
		assert.deepEqual(o.added, [
			...['pointerleave', 'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'pointerover', 'pointerout', 'dblclick'].map((n) => [`svg:${n}`, 'component']),
			['host:keydown', 'component'], ['host:keyup', 'component'], ['host:blur', 'component'], ['host:contextmenu', 'adapter']]);
		// a frozen { close }, closing both: the component's listeners in reverse, then the menu's; once
		assert.deepEqual(Object.keys(o.capture), ['close']);
		assert.ok(Object.isFrozen(o.capture));
		assert.equal(o.capture.close(), undefined);
		assert.deepEqual(o.removed, ['host:blur', 'host:keyup', 'host:keydown', 'svg:dblclick', 'svg:pointerout', 'svg:pointerover', 'svg:pointercancel', 'svg:pointerup',
			'svg:pointermove', 'svg:pointerdown', 'svg:pointerleave', 'host:contextmenu']);
		o.capture.close();
		assert.equal(o.removed.length, 12, 'a second close calls nothing');
		// and a declaration the component refuses throws as the canvas opens, before any listener is added
		const f = fakes();
		delete f.svg.setPointerCapture;
		assert.throws(() => adapter.captureCanvas({ svg: f.svg, host: f.host, sink: recordingSink([]) }), /^Error: capture: input-capture refused the canvas -- invalid-value at \/surface$/);
		assert.deepEqual(f.added, []);
	} finally { restore(); }
});

/*
H26.3's verification (V4): the menu's listener is the adapter's own, added after the component's capture is open. Should the host refuse
it -- its addEventListener throwing, before or after adding the listener, as a malformed host can and no browser does -- the adapter
takes back what it added: the menu's listener, whose removal is harmless if it was never added, then the component's capture, closed,
removing its ten in reverse; and then throws the host's error, unchanged. So no listener of a canvas that failed to open is left, as
the component holds its own opening (IC3, lifecycle rule 3); one so left makes no fact. RESTATED at H26.5: eleven, the host's blur first.
*/
test('H26.3 (V4): a host that refuses the menu\'s listener leaves nothing listening -- the component closed, the error the host\'s', () => {
	for (const after of [false, true]) {
		const f = fakes();
		const refused = new Error('contextmenu refused');
		const add = f.host.addEventListener;
		f.host.addEventListener = function (name, l) {
			if (name !== 'contextmenu') return add.call(this, name, l);
			if (after) add.call(this, name, l);
			throw refused;
		};
		const got = [];
		let threw = null;
		try { adapter.captureCanvas({ svg: f.svg, host: f.host, sink: recordingSink(got) }); } catch (e) { threw = e; }
		assert.equal(threw, refused, `${after ? 'added, then' : ''} refused: the host's error, unchanged`);
		assert.deepEqual(f.removed, ['host:contextmenu', 'host:blur', 'host:keyup', 'host:keydown', 'svg:dblclick', 'svg:pointerout', 'svg:pointerover', 'svg:pointercancel', 'svg:pointerup',
			'svg:pointermove', 'svg:pointerdown', 'svg:pointerleave'], 'the menu\'s listener, then the component\'s eleven in reverse');
		f.listeners.get('svg:pointerdown')({ ...POINTER });
		f.listeners.get('host:keydown')({ ...KEY });
		assert.deepEqual(got, [], 'a listener left by a platform that ignored a removal makes no fact: the capture is closed');
	}
	// and a removal that throws while it is taken back is attempted past: the host's error is still the one thrown
	const f = fakes();
	const refused = new Error('contextmenu refused');
	const add = f.host.addEventListener, remove = f.host.removeEventListener;
	f.host.addEventListener = function (name, l) { if (name === 'contextmenu') throw refused; return add.call(this, name, l); };
	f.host.removeEventListener = function (name) { remove.call(this, name); throw new Error(`${name} removal refused`); };
	assert.throws(() => adapter.captureCanvas({ svg: f.svg, host: f.host, sink: recordingSink([]) }), (e) => e === refused);
	assert.deepEqual(f.removed.filter((n) => n.startsWith('svg:')).length, 8, 'every removal attempted past the ones that threw');
});

const POINTER = { clientX: 30, clientY: 40, button: 0, buttons: 1, pointerId: 1, pointerType: 'mouse', shiftKey: true, ctrlKey: false, altKey: false, metaKey: false,
	target: { tagName: 'g', classList: { contains: () => false }, dataset: {}, closest: (s) => (s.includes('node') ? { id: 'node-000001' } : null) }, preventDefault() {} };
const KEY = { key: 'Tab', code: 'Tab', repeat: false, shiftKey: false, ctrlKey: true, altKey: false, metaKey: false, target: { tagName: 'BODY', closest: () => null }, preventDefault() {} };
const FORM = {
	press: ['type', 'button', 'key', 'repeat', 'shiftKey', 'ctrlKey', 'altKey', 'metaKey', 'at', 'on', 'region', 'claimed', 'capture'],
	pointer: ['type', 'button', 'key', 'repeat', 'shiftKey', 'ctrlKey', 'altKey', 'metaKey', 'at', 'on', 'claimed', 'capture'],
	keyDown: ['type', 'button', 'key', 'repeat', 'shiftKey', 'ctrlKey', 'altKey', 'metaKey', 'onControl', 'claimed', 'capture'],
	keyUp: ['type', 'button', 'key', 'repeat', 'shiftKey', 'ctrlKey', 'altKey', 'metaKey', 'claimed', 'capture'],
	blur: ['type', 'button', 'key', 'repeat', 'shiftKey', 'ctrlKey', 'altKey', 'metaKey', 'claimed', 'capture'],   // H26.5: a key-up's form
};

test('H26.3 step 3: the adapter reads no field of a pointer or key event -- the component reads each -- and Input\'s entry points take today\'s input events', () => {
	const restore = installDom();
	try {
		const o = open([], (m, e) => { if (m === 'press') { e.claimed = true; e.capture = true; } if (m === 'keyDown') e.claimed = true; });
		const reads = [];
		const fire = (key, fields) => { const r = recorded(fields); o.listeners.get(key)(r.evt); reads.push(...r.reads.map(([f, who]) => [key, f, who])); };
		for (const n of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'pointerover', 'pointerout', 'dblclick', 'pointerleave']) fire(`svg:${n}`, { ...POINTER });
		fire('host:keydown', { ...KEY });
		fire('host:keyup', { ...KEY, key: 'Shift' });
		fire('host:keydown', { ...KEY, target: { tagName: 'INPUT', closest: () => null } });   // typed into a field: dropped
		fire('host:blur', { timeStamp: 7, preventDefault() {} });   // H26.5: the host's focus loss, as a FocusEvent offers it
		assert.deepEqual(reads.filter(([, , who]) => who !== 'component'), [], 'every field of every pointer, key and blur event read by the component, none by the adapter');
		assert.ok(reads.length > 100, `the reads were seen: ${reads.length}`);
		assert.deepEqual(o.got.map(([m, args]) => [m, args.length]), [['press', 1], ['move', 1], ['release', 1], ['cancelDrag', 1], ['hover', 2], ['hover', 2], ['double', 1], ['leave', 0], ['keyDown', 1], ['keyUp', 1], ['blur', 1]],
			'each to the entry point the old capture called, over and out to hover entering and not, the leave with nothing, the typed key to none, the focus loss to blur');
		const [press, move, , , over, out, , , keyDown, keyUp, blur] = o.got.map(([, args]) => args);
		assert.deepEqual(Object.keys(press[0]), FORM.press);
		assert.deepEqual(Object.keys(move[0]), FORM.pointer);
		assert.deepEqual([over[1], out[1]], [true, false]);
		assert.deepEqual(Object.keys(keyDown[0]), FORM.keyDown);
		assert.deepEqual(Object.keys(keyUp[0]), FORM.keyUp);
		assert.deepEqual({ ...press[0], at: { ...press[0].at } }, { type: 'down', button: 0, key: null, repeat: false, shiftKey: true, ctrlKey: false, altKey: false, metaKey: false,
			at: { x: 30, y: 40 }, on: { kind: 'node', id: 'node-000001' }, region: press[0].region, claimed: true, capture: true });
		assert.equal(keyDown[0].onControl, false);
		// H26.5: the blur's input event, every modifier false -- what Input's `blur` hands the arming (RELEASES-0.2.md section 4, item 3)
		assert.deepEqual(Object.keys(blur[0]), FORM.blur);
		assert.deepEqual(blur[0], { type: 'blur', button: 0, key: null, repeat: null, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, claimed: false, capture: false });
	} finally { restore(); }
});

test('H26.3 step 3: the menu is the adapter\'s own listener, reading the target and claiming as B75 says', () => {
	const o = open();
	const menu = (target) => { const r = recorded({ target, preventDefault() {} }); o.listeners.get('host:contextmenu')(r.evt); return r.reads.map(([f, who]) => `${f} ${who}`); };
	assert.deepEqual(menu({ closest: () => null }), ['target adapter', 'target adapter', 'preventDefault adapter'], 'off a field: suppressed');
	assert.deepEqual(menu({ closest: (s) => (s.includes('textarea') ? {} : null) }), ['target adapter', 'target adapter'], 'in a field: the browser keeps it');
});

test('H26.3 step 3 (G5, D9): of the product\'s modules, app/src/capture.js alone names @apnex/input-capture, and it is a canvas module', () => {
	const walk = (d) => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.m?js$/.test(e.name) ? [path.join(d, e.name)] : []));
	const product = FOLDERS.filter((f) => f.dir !== 'tools' && f.dir !== 'tests').flatMap((f) => walk(f.dir));
	assert.ok(product.length > 150, `the product's modules were read: ${product.length}`);
	assert.deepEqual(product.filter((f) => fs.readFileSync(path.join(ROOT, f), 'utf8').includes('@apnex/input-capture')), ['app/src/capture.js']);
	assert.ok(PARTS.canvas.modules.includes('app/src/capture.js'), 'the adapter is the canvas part\'s');
	const compose = fs.readFileSync(path.join(ROOT, 'app/src/compose-canvas.js'), 'utf8');
	assert.match(compose, /import \{ captureCanvas \} from '\.\/capture\.js';/);
	// RESTATED at H26.4 (VECTOR-SCENE.md appendix B): handing the scene, whose toDrawing is capture's conversion
	assert.match(compose, /const listen = \(\) => \(capture \?\?= captureCanvas\(\{ svg, scene, host, sink: input, picks: picksOf\(parts\), regions: regionsOf\(parts\) \}\)\);/,
		'listen() keeps its place, calling captureCanvas where it made the class');
	assert.match(fs.readFileSync(path.join(ROOT, 'app/src/capture.js'), 'utf8'), /toDrawing: \(screen\) => scene\.toDrawing\(screen\),/, 'and the adapter converts by the scene\'s toDrawing');
});

/*
H26.3 step 7 -- the pages load input-capture through their import map (tests/import-map-browser.test.js); the server and the export never
load it, since only the pages compose a canvas. Each module graph is loaded in a process of its own whose every resolution is logged
(tests/fixtures/resolve-log/): the server's app and the export's renderer resolve no file of the component, and the canvas's composition,
the control, resolves its entry.
*/
test('H26.3 step 7: the server and the export load no file of input-capture; the canvas\'s composition does', () => {
	const log = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'resolve-log-')), 'log');
	try {
		const loads = (code) => {
			fs.writeFileSync(log, '');
			const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'NODE_TEST_CONTEXT')), RESOLVE_LOG: log };
			const r = spawnSync(process.execPath, ['--import', './tests/fixtures/resolve-log/register.mjs', '--input-type=module', '-e', code], { cwd: ROOT, env, encoding: 'utf8' });
			assert.equal(r.status, 0, r.stderr);
			return fs.readFileSync(log, 'utf8').split('\n').filter(Boolean);
		};
		const server = loads("await import('./server/app.js'); await import('./server/svg.mjs');");
		assert.ok(server.length > 100 && server.some((u) => u.includes('/@apnex/input-binding/')), `the server's graph was logged: ${server.length} resolution(s)`);
		assert.deepEqual(server.filter((u) => u.includes('/@apnex/input-capture/') || u.endsWith('/app/src/capture.js')), [], 'no file of the component, nor its adapter');
		const page = loads("await import('./app/src/compose-canvas.js');");
		assert.ok(page.includes(COMPONENT_ENTRY), 'the control: the canvas\'s composition loads it');
	} finally { fs.rmSync(path.dirname(log), { recursive: true, force: true }); }
});
