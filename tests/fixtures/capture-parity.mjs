/*
H26.3 (dev/design/components/INPUT-CAPTURE.md section 4, acceptance step 4; sections 6.2 and 6.3; guardrail G7) -- DRAW'S CAPTURE, OLD AND
NEW, SIDE BY SIDE. The fixture of tests/input-capture-parity.test.js.

Draw's inputs must reach Input as they did, field for field and in the same key order, and the platform must be asked what it was asked:
the same `preventDefault` and `setPointerCapture` calls. Three comparisons hold it, each driving the old capture and the adapter with the
same events, each side over fakes of its own:

  generated   seeded streams of events shaped as a browser makes them -- pointer events with finite coordinates, an integer button, a
              pointer id but on a double click, each kind of target the canvas meets; key events of every kind of key and target; the
              context menu -- handed to a sink that claims, takes the pointer on a press and throws as Input may; no difference allowed
  the edges   the inputs section 6.3 lists, which nothing in draw produces, each run on both sides and its two answers held in
              capture-parity-edges.json, every difference classed by the 6.3 bullet it is -- and, since H26.3's verification, each
              class of input found outside 6.3's bullets, held the same way (V1)
  the tests   every event the gesture corpus and the 24 test files driving the canvas hand the harness, in a child run with
              DRAW_CAPTURE_PARITY naming a folder: the harness's capture is then `dualCapture`, which drives the real side with the
              real Input and the other with a sink replaying what Input wrote and threw, and records each comparison there

THE OLD CODE is kept whole, verbatim, in tests/fixtures/pre-capture/capture.js -- app/src/capture.js as it stood at READ_AT, held to its
SHA-256, its two imports answered by shims beside it -- so the old side runs on every gate after the move. THE NEW SIDE is the adapter:
tests/fixtures/capture-adapter.js until the move, which moved that very file to app/src/capture.js, and that module since, through the
harness's captureDispatch.

  node tests/fixtures/capture-parity.mjs --write     writes the edges' record from the code as it stands -- before the move only
  node tests/fixtures/capture-parity.mjs --add       after it: writes the cases the record lacks into its `verification` section,
                                                     refusing to change the answers of any case it holds (a case's class may move)
*/
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Capture as OldCapture } from './pre-capture/capture.js';
import { captureDispatch, installDom } from './client-harness.mjs';   // the adapter, app/src/capture.js, through the harness (H26.3's move)
import { picksOf, regionsOf } from '../../app/src/pick.js';
import { PRODUCT_CANVAS } from '../../product/canvas.mjs';

export const READ_AT = '7d71be6';   // the last commit holding draw's capture whole
export const MOVED = true;          // the move flipped it, with the new side's import
const root = new URL('../../', import.meta.url);
const sha256 = (url) => crypto.createHash('sha256').update(fs.readFileSync(url)).digest('hex');
export const ORIGINAL = {
	file: 'app/src/capture.js', copy: 'pre-capture/capture.js', sha256: '78c82c3cbd1530164866fe80d276ab7cea2dbf515569b9e1b5240285e5d4577b',
	copySha: () => sha256(new URL('pre-capture/capture.js', import.meta.url)),
	liveSha: () => (fs.existsSync(new URL('app/src/capture.js', root)) ? sha256(new URL('app/src/capture.js', root)) : null),
};
export const EDGE_RECORD = new URL('./capture-parity-edges.json', import.meta.url);

// ---- the two sides: each answers the harness's nine methods over the fakes it is handed ----

const METHODS = ['onDown', 'onMove', 'onUp', 'onCancel', 'onHover', 'onDblClick', 'onKeyDown', 'onKeyUp', 'onContextMenu'];
export const oldSide = (args) => { const c = new OldCapture(args); return Object.fromEntries(METHODS.map((m) => [m, (...a) => c[m](...a)])); };
export const newSide = (args) => captureDispatch(args);

// ---- what one side did with one event ----

// a value as text, key order kept, and what JSON loses named: undefined, -0, NaN, the infinities, a function
const text = (v) => JSON.stringify(v, (_, x) => (x === undefined ? '#undefined' : Object.is(x, -0) ? '#-0' : typeof x === 'number' && !Number.isFinite(x) ? `#${x}`
	: typeof x === 'function' ? '#function' : typeof x === 'bigint' ? `#${x}n` : typeof x === 'symbol' ? '#symbol' : x));
const named = (e) => (e === null ? null : e instanceof Error ? `${e.constructor.name}: ${e.message}` : `thrown ${typeof e}`);

/*
Fakes of one side's own, over the harness's or a test's: the surface and host answer as the given ones do -- the screen transform,
anything else a reader asks -- but their listeners, and the pointer they are asked to take, are recorded. `pass` hands an added listener
on to the given object as well, so a test's own host still sees what the real side adds (B45); the other side's adds stay its own.
`setPointerCapture` is the given one's when it has one, and otherwise throws as a call of a missing method does -- the platform refusing
a synthetic pointer, which the old capture swallowed and the reply answers false.
*/
function sideFakes(svg, host, pass) {
	const asked = [];
	const listeners = [], byName = new Map();
	const over = (given, tag) => Object.create(given, {
		addEventListener: { writable: true, configurable: true, value(name, l) { listeners.push(`${tag}:${name}`); byName.set(`${tag}:${name}`, l); return pass && typeof given.addEventListener === 'function' ? given.addEventListener(name, l) : undefined; } },
		removeEventListener: { writable: true, configurable: true, value(name, l) { return pass && typeof given.removeEventListener === 'function' ? given.removeEventListener(name, l) : undefined; } },
	});
	const surface = over(svg, 'svg');
	Object.defineProperty(surface, 'setPointerCapture', { writable: true, configurable: true, value(id) {
		asked.push(arguments.length ? [id] : []);
		if (typeof svg.setPointerCapture === 'function') return svg.setPointerCapture(id);
		throw new TypeError('svg.setPointerCapture is not a function');
	} });
	return { surface, host: over(host, 'host'), asked, listeners, byName };
}

// an event of one side's own: the given one's fields as they stand, its prototype kept, its preventDefault a spy -- handing the call on to
// the given one when `pass`, so a test's own counter still counts the real side's claims; a preventDefault that is no function is kept
function sideEvent(evt, pass, prevented) {
	if (!evt || typeof evt !== 'object') return evt;
	const copy = Object.create(Object.getPrototypeOf(evt), Object.getOwnPropertyDescriptors(evt));
	const given = Object.getOwnPropertyDescriptor(evt, 'preventDefault') ?? null;
	if (given && 'value' in given && typeof given.value === 'function') {
		Object.defineProperty(copy, 'preventDefault', { ...given, value(...a) { prevented.n++; return pass ? Reflect.apply(given.value, evt, a) : undefined; } });
	} else if (!given && typeof evt.preventDefault === 'function') {
		const inherited = evt.preventDefault;
		Object.defineProperty(copy, 'preventDefault', { writable: true, configurable: true, enumerable: false, value(...a) { prevented.n++; return pass ? Reflect.apply(inherited, evt, a) : undefined; } });
	}
	return copy;
}

/*
A sink that records what it is handed, as Input would receive it, and then does what `answer` says for the k-th call: write `claimed`
and `capture` and throw. The real side's sink is Input itself, wrapped (`tee`): what Input wrote and threw becomes the other side's answer.
*/
const SINK = ['press', 'move', 'release', 'cancelDrag', 'hover', 'double', 'keyDown', 'keyUp', 'leave'];
function recordingSink(handed, answer) {
	return Object.fromEntries(SINK.map((name) => [name, (...args) => {
		const k = handed.length;
		handed.push({ route: name, args: text(args.slice(1)), event: args.length ? text(args[0]) : '#none' });
		const a = answer(k, name, args[0]);
		if (a && args[0] && typeof args[0] === 'object') { args[0].claimed = a.claimed; args[0].capture = a.capture; }
		if (a && a.threw) throw a.threw;
		return undefined;
	}]));
}
function tee(input, handed, wrote) {
	return Object.fromEntries(SINK.map((name) => [name, (...args) => {
		handed.push({ route: name, args: text(args.slice(1)), event: args.length ? text(args[0]) : '#none' });
		let threw = null;
		try { return input[name](...args); } catch (e) { threw = e; throw e; } finally {
			wrote.push({ claimed: args[0]?.claimed, capture: args[0]?.capture, threw });
		}
	}]));
}

// one side's answer to one event: what Input was handed, the platform's calls, and what propagated
const answerOf = (handed, prevented, asked, threw) => ({ handed, prevented: prevented.n, asked: text(asked), threw: named(threw), thrownIdentity: threw });
export function sameAnswer(a, b) {
	return text(a.handed) === text(b.handed) && a.prevented === b.prevented && a.asked === b.asked
		&& (a.thrownIdentity === b.thrownIdentity || (a.thrownIdentity !== null && b.thrownIdentity !== null && a.threw === b.threw));
}
const bare = ({ thrownIdentity, ...a }) => a;   // eslint-disable-line no-unused-vars

// ---- the tests' events: the harness's capture, when DRAW_CAPTURE_PARITY names a folder ----

// the real side: today's capture until the move, the adapter through the harness's dispatch since; the other side, the old copy
export function parityCapture(args, folder = process.env.DRAW_CAPTURE_PARITY) {
	return folder ? dualCapture({ ...args, real: newSide, other: oldSide, folder }) : null;
}

/*
`real` drives the real Input, as the harness does without this; `other` is driven after it with the same event, its sink replaying
what Input wrote and threw on each call. What the real side threw propagates to the test, so the test sees what it always saw; each
comparison is appended to `<folder>/<pid>.jsonl`, the differences with both answers.
*/
export function dualCapture({ svg, host, sink, picks, regions, real, other, folder }) {
	const realFakes = sideFakes(svg, host, true), otherFakes = sideFakes(svg, host, false);
	const handedReal = [], wrote = [], handedOther = [];
	const realSide = real({ svg: realFakes.surface, host: realFakes.host, sink: tee(sink, handedReal, wrote), picks, regions });
	const otherSide = other({ svg: otherFakes.surface, host: otherFakes.host, sink: recordingSink(handedOther, (k) => wrote[k] ?? null), picks, regions });
	const file = path.join(folder, `${process.pid}.jsonl`);
	const where = path.basename(process.argv[1] ?? '?');
	const out = {};
	for (const m of METHODS) {
		out[m] = (evt, ...more) => {
			handedReal.length = 0; wrote.length = 0; handedOther.length = 0;
			realFakes.asked.length = 0; otherFakes.asked.length = 0;
			const pr = { n: 0 }, po = { n: 0 };
			let threwReal = null, threwOther = null, result;
			try { result = realSide[m](sideEvent(evt, true, pr), ...more); } catch (e) { threwReal = e; }
			try { otherSide[m](sideEvent(evt, false, po), ...more); } catch (e) { threwOther = e; }
			const a = answerOf([...handedReal], pr, [...realFakes.asked], threwReal), b = answerOf([...handedOther], po, [...otherFakes.asked], threwOther);
			const equal = sameAnswer(a, b);
			const line = { where, m, route: a.handed.map((h) => h.route), claimed: wrote.some((w) => w.claimed), capture: wrote.some((w) => w.capture), threw: threwReal !== null, equal };
			if (!equal) Object.assign(line, { real: bare(a), other: bare(b), event: text(evt) });
			fs.appendFileSync(file, `${JSON.stringify(line)}\n`);
			if (threwReal !== null) throw threwReal;
			return result;
		};
	}
	return out;
}

// ---- the generated events ----

// a seeded generator, so a stream is a function of its seed
export function prng(seed) {
	let s = seed >>> 0;
	const next = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
	return { next, pick: (xs) => xs[Math.floor(next() * xs.length)], chance: (p) => next() < p };
}

// every kind of target the canvas meets, from what the parts' picks and regions read: a factory, so each event holds its own
const none = { contains: () => false };
export const TARGETS = {
	canvas: () => ({ tagName: 'svg', classList: none, dataset: {}, closest: () => null }),
	node: () => ({ tagName: 'g', id: 'node-000001', classList: none, dataset: {}, closest: (s) => (s.includes('node') ? { id: 'node-000001' } : null) }),
	waypoint: () => ({ tagName: 'circle', id: '', classList: none, dataset: {}, closest: (s) => (s.includes('waypoint') ? { id: 'node-000002' } : null) }),
	linkTwin: () => ({ tagName: 'path', id: '', classList: { contains: (k) => k === 'link-hit' }, dataset: { link: 'link-000001' }, closest: () => null }),
	link: () => ({ tagName: 'g', id: 'link-000003', classList: { contains: (k) => k === 'link' }, dataset: {}, closest: (s) => (s.includes('link') ? { id: 'link-000003' } : null) }),
	zone: () => ({ tagName: 'rect', id: '', classList: none, dataset: {}, closest: (s) => (s.includes('zone') ? { id: 'zone-000004' } : null) }),
	endHandle: () => ({ tagName: 'circle', classList: { contains: (k) => k === 'handle' }, dataset: { end: 'src' }, closest: () => null }),
	cornerHandle: () => ({ tagName: 'rect', classList: { contains: (k) => k === 'handle' }, dataset: { corner: 'se' }, closest: () => null }),
	mark: () => ({ tagName: 'path', id: '', classList: none, dataset: { select: 'pipe-000001-000002' }, closest: () => null }),
	action: () => { const owner = { id: 'node-000005' }; const c = { dataset: { action: 'toggle' }, closest: (s) => (s ? owner : null) }; return { tagName: 'rect', classList: none, dataset: {}, closest: (s) => (s.includes('data-action') ? c : s.includes('node') ? owner : null) }; },
	input: () => { const c = { dataset: { input: '', idx: '2' }, closest: () => ({ id: 'node-000006' }) }; return { tagName: 'text', classList: none, dataset: {}, closest: (s) => (s.includes('data-action') ? c : null) }; },
	unaskable: () => ({}),
	body: () => ({ tagName: 'BODY', closest: () => null }),
	field: () => ({ tagName: 'INPUT', closest: (s) => (s.includes('input') ? {} : null) }),
	textarea: () => ({ tagName: 'TEXTAREA', closest: (s) => (s.includes('textarea') ? {} : null) }),
	select: () => ({ tagName: 'SELECT', closest: (s) => (s.includes('select') ? {} : null) }),
	button: () => ({ tagName: 'BUTTON', closest: (s) => (s.includes('button') ? {} : null) }),
	tabbable: () => ({ tagName: 'DIV', closest: (s) => (s.includes('[tabindex]') ? {} : null) }),
	editable: () => ({ tagName: 'DIV', closest: (s) => (s.includes('contenteditable') ? {} : null) }),
	bareKeyTarget: () => ({ tagName: 'BODY' }),
	/*
	Targets whose `closest` throws for one question, which no browser's does: each shows a question asked on exactly the events it was
	asked on -- run mode's on a press alone, the control test on a key-down not typed into a field alone, the field test on a key-down.
	*/
	regionThrows: () => ({ tagName: 'g', classList: none, dataset: {}, closest: (s) => { if (s.includes('data-action')) throw new Error('closest: run mode asked'); return null; } }),
	fieldThrows: () => ({ tagName: 'INPUT', closest: () => { throw new Error('closest: asked of a field'); } }),
	controlThrows: () => ({ tagName: 'BODY', closest: (s) => { if (s.includes('[tabindex]')) throw new Error('closest: the control test asked'); return null; } }),
	pickThrows: () => ({ tagName: 'g', classList: none, dataset: {}, closest: () => { throw new Error('closest: the hit test asked'); } }),
};
const POINTER_TARGETS = ['canvas', 'node', 'waypoint', 'linkTwin', 'link', 'zone', 'endHandle', 'cornerHandle', 'mark', 'action', 'input', 'unaskable', 'regionThrows', 'pickThrows'];
const KEY_TARGETS = ['body', 'bareKeyTarget', 'field', 'textarea', 'select', 'button', 'tabbable', 'editable', 'unaskable', 'canvas', 'fieldThrows', 'controlThrows'];
const KEYS = ['a', 'w', 'x', 'g', 'z', 'Shift', 'Control', 'Alt', 'Meta', 'Escape', 'Tab', 'Enter', 'Delete', 'Backspace', 'F2', '/', '?', '1', '7', ' ', 'ArrowLeft', 'Dead', ''];
const TRUTHY = [true, false, 1, 0, undefined, '', 'yes'];

// one event shaped as a browser makes it: `kind` the harness's method
export function browserEvent(r, method) {
	const mods = Object.fromEntries(['shiftKey', 'ctrlKey', 'altKey', 'metaKey'].map((m) => [m, r.chance(0.6) ? r.next() < 0.3 : r.pick(TRUTHY)]));
	if (method === 'onKeyDown' || method === 'onKeyUp') {
		const k = r.pick(KEYS);
		return { key: k, code: r.chance(0.8) ? `Key${k}` : undefined, repeat: r.pick(TRUTHY), ...mods, target: TARGETS[r.pick(KEY_TARGETS)](), preventDefault() {}, stopPropagation() {} };
	}
	if (method === 'onContextMenu') return { clientX: 3, clientY: 4, button: 2, target: TARGETS[r.pick([...KEY_TARGETS, ...POINTER_TARGETS])](), preventDefault() {} };
	const coord = () => r.pick([0, 60, -120, 37.5, 1919, -0.25, 3e3]);
	const evt = { clientX: coord(), clientY: coord(), button: r.pick([0, 0, 0, 1, 2, -1, 3, 4]), buttons: r.pick([0, 1, 2, 3, 4]),
		...(method === 'onDblClick' ? {} : { pointerId: r.pick([1, 2, 7]), pointerType: r.pick(['mouse', 'pen', 'touch']) }),
		...mods, target: TARGETS[r.pick(POINTER_TARGETS)](), preventDefault() {}, stopPropagation() {} };
	if (r.chance(0.1)) delete evt.button;   // the harness's events sometimes omit it, which both read as 0
	return evt;
}

// what a generated sink does on its k-th call: claims, takes the pointer on a press as Input does, and throws, before or after writing
export function sinkAnswers(r) {
	return (k, route) => ({ claimed: r.chance(0.5), capture: route === 'press' && r.chance(0.6), threw: r.chance(0.12) ? new Error(`input threw on ${route}`) : null });
}

// a screen transform that is no identity, so where a point lies in the drawing is a conversion, not a copy
const SCALED = { a: 0.5, b: 0, c: 0, d: 0.5, e: -40, f: 20 };
export const screenSvg = (ctm = () => ({ ...SCALED, inverse: () => SCALED })) => ({ getScreenCTM: ctm, addEventListener() {}, removeEventListener() {} });
export const quietHost = () => ({ addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } });

// one event through one side, over fresh fakes: its answer
export function runOne(side, method, evt, answers, { svg = screenSvg(), host = quietHost(), more = [] } = {}) {
	const f = sideFakes(svg, host, false);
	const handed = [], prevented = { n: 0 };
	let threw = null;
	try {
		const s = side({ svg: f.surface, host: f.host, sink: recordingSink(handed, answers), picks: picksOf(PRODUCT_CANVAS), regions: regionsOf(PRODUCT_CANVAS) });
		// the leave, which the harness's nine methods do not drive: the listener each side added for it, called as the platform calls it
		if (method === 'onLeave') f.byName.get('svg:pointerleave')(sideEvent(evt, false, prevented));
		else s[method](sideEvent(evt, false, prevented), ...more);
	} catch (e) { threw = e; }
	return answerOf(handed, prevented, f.asked, threw);
}

export const GENERATED = { seed: 0x1d2b3c, streams: 40, length: 60 };
const GEN_METHODS = ['onDown', 'onMove', 'onUp', 'onCancel', 'onHover', 'onDblClick', 'onKeyDown', 'onKeyUp', 'onContextMenu', 'onLeave'];

// the generated streams through both sides: every comparison, and the differences
export function generatedComparisons({ seed, streams, length } = GENERATED) {
	const restore = installDom();
	try {
		const rows = [];
		for (let s = 0; s < streams; s++) {
			const r = prng(seed + s);
			for (let i = 0; i < length; i++) {
				const method = r.pick(GEN_METHODS);
				const evt = browserEvent(r, method);
				const more = method === 'onHover' ? [r.chance(0.5)] : [];
				// the same answers on both sides, drawn once
				const drawn = [];
				const answers = (k, route) => (drawn[k] ??= sinkAnswers(r)(k, route));
				const old = runOne(oldSide, method, evt, answers, { more });
				const neu = runOne(newSide, method, evt, (k) => drawn[k] ?? null, { more });
				rows.push({ method, route: old.handed.map((h) => h.route), claimed: drawn.some((d) => d?.claimed), capture: drawn.some((d) => d?.capture), threw: drawn.some((d) => d?.threw),
					equal: sameAnswer(old, neu), old: bare(old), neu: bare(neu), event: text(evt) });
			}
		}
		return rows;
	} finally { restore(); }
}

// ---- section 6.3's inputs, which nothing in draw produces: each case on both sides, its two answers held ----

const ok = () => ({ clientX: 30, clientY: 40, button: 0, buttons: 1, pointerId: 1, pointerType: 'mouse', shiftKey: false, ctrlKey: false, altKey: false, metaKey: false,
	target: TARGETS.canvas(), preventDefault() {} });
const okKey = () => ({ key: 'a', code: 'KeyA', repeat: false, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, target: TARGETS.body(), preventDefault() {} });
const claimAll = () => ({ claimed: true, capture: false, threw: null });
const captureAll = () => ({ claimed: false, capture: true, threw: null });
const quiet = () => ({ claimed: false, capture: false, threw: null });
const getterThrows = (base, field) => Object.defineProperty(base, field, { enumerable: true, configurable: true, get() { throw new Error(`${field} getter`); } });
// an event whose `target` answers each read with the next of `targets` (the last thereafter), counting its reads in `__reads`
const targetPerRead = (base, ...targets) => {
	const counted = { n: 0 };
	Object.defineProperty(base, '__reads', { value: counted, enumerable: false });
	return Object.defineProperty(base, 'target', { enumerable: true, configurable: true, get() { counted.n++; return targets[Math.min(counted.n, targets.length) - 1](); } });
};

/*
Each case names the 6.3 bullet it holds (`class`), what it drives, and the answers: the sink's, and the side's fakes when they are not the
ordinary ones. A case of the class `none` holds an input both sides answer alike, beside a bullet's, to show where the bullet's line runs.
The classes outside 6.3's bullets, which H26.3's verification found (V1), follow the bullets', each said where its cases are.
*/
export const EDGES = [
	// 6.3, bullet 1: a pointer event whose coordinates are not finite numbers
	{ id: 'coords-absent', class: 'coordinates', method: 'onDown', evt: () => { const e = ok(); delete e.clientX; delete e.clientY; return e; }, answers: quiet },
	{ id: 'coords-nan', class: 'coordinates', method: 'onMove', evt: () => ({ ...ok(), clientX: NaN }), answers: quiet },
	{ id: 'coords-string', class: 'coordinates', method: 'onUp', evt: () => ({ ...ok(), clientY: '40' }), answers: quiet },
	{ id: 'coords-infinite', class: 'coordinates', method: 'onDblClick', evt: () => ({ ...ok(), clientX: Infinity }), answers: quiet },
	// bullet 2: a button neither absent, null nor a safe integer
	{ id: 'button-fraction', class: 'button', method: 'onDown', evt: () => ({ ...ok(), button: 1.5 }), answers: quiet },
	{ id: 'button-string', class: 'button', method: 'onUp', evt: () => ({ ...ok(), button: '0' }), answers: quiet },
	{ id: 'button-null', class: 'none', method: 'onDown', evt: () => ({ ...ok(), button: null }), answers: quiet },
	// bullet 3: a preventDefault that is no function, or whose reading throws; and an event field whose reading throws
	{ id: 'prevent-absent-unclaimed', class: 'preventDefault', method: 'onDown', evt: () => { const e = ok(); delete e.preventDefault; return e; }, answers: quiet },
	{ id: 'prevent-absent-claimed', class: 'preventDefault', method: 'onKeyDown', evt: () => { const e = okKey(); delete e.preventDefault; return e; }, answers: claimAll },
	{ id: 'prevent-getter-throws', class: 'preventDefault', method: 'onMove', evt: () => getterThrows(ok(), 'preventDefault'), answers: quiet },
	{ id: 'key-event-primitive', class: 'preventDefault', method: 'onKeyUp', evt: () => 'keyup', answers: quiet },
	// a field the old capture never read before delivering whose reading throws -- refused now, delivered then: the bullet's "whose reading
	// throws" read as any field's (`field-read`)
	{ id: 'pointerId-getter-throws', class: 'field-read', method: 'onDown', evt: () => getterThrows(ok(), 'pointerId'), answers: captureAll },
	{ id: 'buttons-getter-throws', class: 'field-read', method: 'onMove', evt: () => getterThrows(ok(), 'buttons'), answers: quiet },
	{ id: 'code-getter-throws', class: 'field-read', method: 'onKeyDown', evt: () => getterThrows(okKey(), 'code'), answers: quiet },
	// bullet 4: another family's fields
	{ id: 'pointer-carries-key', class: 'other-family', method: 'onDown', evt: () => ({ ...ok(), key: 'x', repeat: true }), answers: quiet },
	{ id: 'key-carries-button', class: 'other-family', method: 'onKeyDown', evt: () => ({ ...okKey(), button: 2 }), answers: quiet },
	// bullet 5: a press Input captures, carrying no pointer id
	{ id: 'capture-no-pointerId', class: 'no-pointerId', method: 'onDown', evt: () => { const e = ok(); delete e.pointerId; return e; }, answers: captureAll },
	{ id: 'double-no-pointerId-claimed', class: 'none', method: 'onDblClick', evt: () => { const e = ok(); delete e.pointerId; return e; }, answers: claimAll },
	// bullet 6: a conversion answering no finite point; a leave while the canvas has no screen transform
	{ id: 'conversion-nan', class: 'conversion', method: 'onMove', evt: ok, answers: quiet, svg: () => screenSvg(() => ({ inverse: () => ({ a: NaN, b: 0, c: 0, d: 1, e: 0, f: 0 }) })) },
	{ id: 'leave-no-transform', class: 'conversion', method: 'leave', evt: ok, answers: quiet, svg: () => screenSvg(() => null) },
	{ id: 'move-no-transform', class: 'none', method: 'onMove', evt: ok, answers: quiet, svg: () => screenSvg(() => null) },
	// bullet 7: a key that is not a string
	{ id: 'key-number', class: 'key', method: 'onKeyDown', evt: () => ({ ...okKey(), key: 5 }), answers: quiet },
	{ id: 'key-absent', class: 'none', method: 'onKeyUp', evt: () => { const e = okKey(); delete e.key; return e; }, answers: quiet },
	// bullet 8: a surface or key source lacking a method the component reads
	{ id: 'surface-no-setPointerCapture', class: 'surface', method: 'open', svg: () => ({ getScreenCTM: () => null, addEventListener() {}, removeEventListener() {} }), bareSurface: true },
	{ id: 'surface-no-removeEventListener', class: 'surface', method: 'open', svg: () => ({ getScreenCTM: () => null, addEventListener() {}, setPointerCapture() {} }), bareSurface: true },
	{ id: 'host-no-removeEventListener', class: 'surface', method: 'open', host: () => ({ addEventListener() {} }) },
	// bullet 9: an addEventListener that throws as the capture opens -- the component's, or since H26.3's verification (V4) the adapter's
	// own menu listener, after which the adapter closes the open capture
	{ id: 'add-throws-at-keydown', class: 'opening', method: 'open', throwAt: 'keydown' },
	{ id: 'add-throws-at-contextmenu', class: 'opening', method: 'open', throwAt: 'contextmenu' },

	/*
	OUTSIDE 6.3'S BULLETS (H26.3's verification, V1): inputs nothing in draw produces, answered differently, of a kind no bullet names.

	`refused-both` -- an event refused before anything is delivered on both sides, on every listener but pointerleave's (whose old
	listener read nothing; `leave-refused` below): a getter of a field the old capture read before delivery throwing -- the old capture
	rethrows the getter's own error, the component throws its TypeError naming the event and the field -- or a null or primitive event,
	which the old capture failed on reading, with the runtime's TypeError, and the component refuses as no object.
	*/
	{ id: 'button-getter-throws', class: 'refused-both', method: 'onDown', evt: () => getterThrows(ok(), 'button'), answers: quiet },
	{ id: 'target-getter-throws', class: 'refused-both', method: 'onUp', evt: () => getterThrows(ok(), 'target'), answers: quiet },
	{ id: 'key-getter-throws', class: 'refused-both', method: 'onKeyUp', evt: () => getterThrows(okKey(), 'key'), answers: quiet },
	{ id: 'typed-target-getter-throws', class: 'refused-both', method: 'onKeyDown', evt: () => getterThrows(okKey(), 'target'), answers: quiet },
	{ id: 'event-null', class: 'refused-both', method: 'onDown', evt: () => null, answers: quiet },
	{ id: 'event-primitive', class: 'refused-both', method: 'onDown', evt: () => 'pointerdown', answers: quiet },
	{ id: 'key-event-null', class: 'refused-both', method: 'onKeyUp', evt: () => null, answers: quiet },
	// `pointerId-not-integer` -- a press Input captures whose pointerId is present and no safe integer: the old capture asked the platform
	// to take that very value, the component's reply asks nothing (bullet 5 names an absent pointerId alone)
	{ id: 'capture-string-pointerId', class: 'pointerId-not-integer', method: 'onDown', evt: () => ({ ...ok(), pointerId: '1' }), answers: captureAll },
	{ id: 'capture-fraction-pointerId', class: 'pointerId-not-integer', method: 'onDown', evt: () => ({ ...ok(), pointerId: 1.5 }), answers: captureAll },
	{ id: 'capture-nan-pointerId', class: 'pointerId-not-integer', method: 'onDown', evt: () => ({ ...ok(), pointerId: NaN }), answers: captureAll },
	{ id: 'capture-null-pointerId', class: 'pointerId-not-integer', method: 'onDown', evt: () => ({ ...ok(), pointerId: null }), answers: captureAll },
	// `target-read-twice` -- a target getter answering differently at each read: the old capture read it more than once and acted on
	// each answer (a press's hit from the first, its run-mode region from the second; a key-down's field test from the second), the
	// component reads it once and hands that one target to both functions; `reads` holds each side's count
	{ id: 'press-target-per-read', class: 'target-read-twice', method: 'onDown', evt: () => targetPerRead(ok(), TARGETS.node, TARGETS.action), answers: quiet, reads: true },
	{ id: 'key-target-per-read', class: 'target-read-twice', method: 'onKeyDown', evt: () => targetPerRead(okKey(), TARGETS.body, TARGETS.field), answers: quiet, reads: true },
	{ id: 'move-target-per-read', class: 'none', method: 'onMove', evt: () => targetPerRead(ok(), TARGETS.node, TARGETS.action), answers: quiet, reads: true },
	// `leave-refused` -- a pointerleave the component refuses: the old listener called leave() and read nothing of the event, the component
	// reads it and throws before delivering
	{ id: 'leave-null', class: 'leave-refused', method: 'onLeave', evt: () => null, answers: quiet },
	{ id: 'leave-getter-throws', class: 'leave-refused', method: 'onLeave', evt: () => getterThrows(ok(), 'clientY'), answers: quiet },
	{ id: 'leave-button-fraction', class: 'leave-refused', method: 'onLeave', evt: () => ({ ...ok(), button: 1.5 }), answers: quiet },
	{ id: 'leave-ordinary', class: 'none', method: 'onLeave', evt: ok, answers: quiet },
	// `typed-refused` -- a key-down typed into a field that the component refuses: the old capture dropped it before reading anything else,
	// the component judges the event before the adapter's field test runs, and throws
	{ id: 'typed-no-preventDefault', class: 'typed-refused', method: 'onKeyDown', evt: () => { const e = { ...okKey(), target: TARGETS.field() }; delete e.preventDefault; return e; }, answers: quiet },
	{ id: 'typed-key-number', class: 'none', method: 'onKeyDown', evt: () => ({ ...okKey(), key: 5, target: TARGETS.field() }), answers: quiet },
];

// the listeners a side added, and its answer to opening, over fakes that may lack a method or throw on one add
function openOne(side, c) {
	const added = [], removed = [];
	const surface = c.svg ? c.svg() : { getScreenCTM: () => null, setPointerCapture() {} };
	const host = c.host ? c.host() : { dispatchEvent() { return true; } };
	for (const [obj, tag] of [[surface, 'svg'], [host, 'host']]) {
		if (c.bareSurface && tag === 'svg') {
			const add = obj.addEventListener, remove = obj.removeEventListener;
			if (add) obj.addEventListener = (n) => { added.push(`${tag}:${n}`); return add(); };
			if (remove) obj.removeEventListener = (n) => { removed.push(`${tag}:${n}`); return remove(); };
			continue;
		}
		if (c.host && tag === 'host') { obj.addEventListener = (n) => { added.push(`${tag}:${n}`); }; continue; }
		obj.addEventListener = (n) => { added.push(`${tag}:${n}`); if (n === c.throwAt) throw new Error(`addEventListener ${n} refused`); };
		obj.removeEventListener = (n) => { removed.push(`${tag}:${n}`); };
	}
	let threw = null;
	try { side({ svg: surface, host, sink: recordingSink([], () => null), picks: [], regions: {} }); } catch (e) { threw = e; }
	const left = [...removed];
	const listening = added.filter((n) => { const i = left.indexOf(n); if (i < 0) return true; left.splice(i, 1); return false; });
	return { handed: [], prevented: 0, asked: text({ added, removed, listening }), threw: named(threw) };
}

// the leave: the old capture's pointerleave listener and the new one's, called directly, over fakes that record them
function leaveOne(side, c) {
	const ls = new Map();
	const svg = c.svg(), host = quietHost();
	svg.addEventListener = (n, l) => ls.set(n, l); svg.setPointerCapture = () => {};
	host.addEventListener = (n, l) => ls.set(`host:${n}`, l);
	const handed = [];
	let threw = null;
	try {
		side({ svg, host, sink: recordingSink(handed, () => null), picks: picksOf(PRODUCT_CANVAS), regions: regionsOf(PRODUCT_CANVAS) });
		ls.get('pointerleave')(c.evt());
	} catch (e) { threw = e; }
	return { handed, prevented: 0, asked: text([]), threw: named(threw) };
}

// each case's two answers, as JSON holds them
export function edgeAnswers() {
	const restore = installDom();
	try {
		const out = {};
		for (const c of EDGES) {
			const [o, n] = [oldSide, newSide].map((side) => {
				if (c.method === 'open') return openOne(side, c);
				if (c.method === 'leave') return leaveOne(side, c);
				const evt = c.evt();
				const answer = bare(runOne(side, c.method, evt, c.answers, { svg: c.svg ? c.svg() : screenSvg() }));
				return c.reads ? { ...answer, reads: evt.__reads.n } : answer;
			});
			out[c.id] = { class: c.class, method: c.method, equal: text(o) === text(n), old: o, new: n };
		}
		return out;
	} finally { restore(); }
}

// the record's two sections: `edges`, read from the code before the move, and `verification`, the cases H26.3's verification added after it
export const VERIFICATION_READ = 'after the move: the old side from tests/fixtures/pre-capture/capture.js, the new from app/src/capture.js as H26.3\'s verification left it';
export const recordOf = (record, id) => record.edges[id] ?? record.verification?.edges?.[id];

const running = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (running && process.argv.includes('--write')) {
	if (MOVED) { console.error('capture-parity: the record is read from the code before the move -- use --add'); process.exit(1); }
	fs.writeFileSync(EDGE_RECORD, `${JSON.stringify({ readAt: READ_AT, edges: edgeAnswers() }, null, '\t')}\n`);
	console.log(`capture-parity: wrote ${path.relative(process.cwd(), new URL(EDGE_RECORD).pathname)}, ${EDGES.length} case(s)`);
}
if (running && process.argv.includes('--add')) {
	const record = JSON.parse(fs.readFileSync(EDGE_RECORD, 'utf8'));
	const live = edgeAnswers();
	const verification = { read: VERIFICATION_READ, edges: {} };
	const same = (a, b) => text([a.method, a.equal, a.old, a.new]) === text([b.method, b.equal, b.old, b.new]);
	for (const [id, held] of Object.entries(record.edges)) {
		if (!live[id]) { console.error(`capture-parity: the record holds ${id}, which no case drives`); process.exit(1); }
		if (!same(live[id], held)) { console.error(`capture-parity: ${id} answers otherwise than the record, read before the move, holds`); process.exit(1); }
		held.class = live[id].class;
	}
	for (const [id, answer] of Object.entries(live)) {
		if (record.edges[id]) continue;
		const held = record.verification?.edges?.[id];
		if (held && !same(answer, held)) { console.error(`capture-parity: ${id} answers otherwise than the record holds`); process.exit(1); }
		verification.edges[id] = answer;
	}
	fs.writeFileSync(EDGE_RECORD, `${JSON.stringify({ readAt: record.readAt, edges: record.edges, verification }, null, '\t')}\n`);
	console.log(`capture-parity: ${Object.keys(verification.edges).length} case(s) in the verification section, ${Object.keys(record.edges).length} read before the move`);
}
