/*
H26.2 (dev/design/components/INPUT-BINDING.md section 4, acceptance steps 3 and 4; section 6.3) -- DRAW ON INPUT-BINDING.

WHAT MOVED, AND WHAT IS LEFT (acceptance step 3), as H26.1's tests/grid-arithmetic-gone.test.js held its own. app/src/triggers.js is
gone; the input state holds no press; kernel/input-rules.mjs is draw's adapter -- its declarations and calls through to the component,
no matching, guard or overlap code of its own; and app/src/input.js assigns no `mode`, holds no `ignoreUp`, decides neither which press
a live gesture takes, nor which release commits it, nor that a press or a lost pointer cancels it, and runs a gesture's body, and a
chain's start, only on an outcome naming that phase, the session private to it. It measures no distance but the link release's
`atStart`, and names the click threshold once -- the "decided once" test of tests/triggers.test.js, restated here as that file went
with its module.

THE EMPTY HANDLE, both answers (acceptance step 4; section 6.3). A handle press whose start finds no entity leaves the handle
gesture live with an empty context -- kept, B410 -- and it is reachable with two pointers: a zone selected, its corner pressed with
Shift held, Shift released with the pointer still down, and the still-drawn handle pressed by a second pointer. That press cancels the
live handle gesture first, whose teardown drops the zone from the selection (H24.3), so the new start finds no zone. What a pointer
cancel then does is the one behaviour, beside the exact threshold, that H26.2 changes: before the move the cancel body throws on the
empty context while the slot still names the gesture, so the gesture stays live, the teardown and onGestureEnd never run, and the
next move throws too; after it, the session has ended the gesture before the body runs and the rest runs in a finally, so the
exception still propagates, the gesture has ended, the teardown and onGestureEnd have run, and the next move follows the idle path.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { Input } from '../app/src/input.js';
import * as adapter from '../kernel/input-rules.mjs';
import { makeInput, key, pointer } from './fixtures/client-harness.mjs';
import { makeZone } from '../plugins/zones/make-zone.mjs';
import { liveGesture } from './fixtures/binding-parity.mjs';
import { PRODUCT_CANVAS } from '../product/canvas.mjs';

// the two answers; the code answers the one NOW names
const ANSWERS = {
	// read from app/src/input.js at 8793699, before the move (tests/fixtures/binding-parity.mjs READ_AT)
	before: {
		started: 'handle',
		cancel: { threw: "Cannot read properties of undefined (reading 'preview')", live: 'handle', teardown: 0, gestureEnd: 0 },
		move: { threw: "Cannot read properties of undefined (reading 'preview')", live: 'handle', idle: false },
	},
	// section 6.3: the cancel outcome first, the body on it, the teardown, onGestureEnd and afterShiftUpPress in a finally
	after: {
		started: 'handle',
		cancel: { threw: "Cannot read properties of undefined (reading 'preview')", live: null, teardown: 1, gestureEnd: 1 },
		move: { threw: null, live: null, idle: true },
	},
};
const NOW = 'after';

const corner = (x, y, m = {}) => pointer(x, y, { ...m, target: { tagName: 'rect', classList: { contains: (c) => c === 'handle' }, dataset: { corner: 'se' }, closest: () => null } });
const thrown = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };

test(`H26.2 (section 6.3; B410 kept): a pointer cancel over the empty handle gesture -- the ${NOW === 'before' ? 'old' : 'new'} answer, both stated`, () => {
	const h = makeInput();
	try {
		const z = makeZone(h.model, { x: -150, y: -150, w: 300, h: 300 });
		h.model.put('zone', z);
		h.selection.set([z.id]);
		let ends = 0;
		h.input.onGestureEnd = () => { ends++; };
		h.capture.onDown(corner(150, 150, { shiftKey: true }));   // the corner pressed with Shift held: the handle gesture, its zone selected
		h.capture.onKeyUp(key('Shift'));                            // Shift released, the pointer still down: the zone goes when the press ends
		h.capture.onDown(corner(150, 150));                         // a second pointer on the still-drawn handle
		assert.deepEqual(h.selection.list(), [], 'the cancel of the live handle gesture dropped the zone (H24.3), before the new start ran');
		const got = { started: liveGesture(h) };
		const torn = () => h.calls.filter((c) => c.name === 'readout.clearTransient').length;
		const before = { teardown: torn(), ends };
		const cancel = thrown(() => h.capture.onCancel(pointer(150, 150, { buttons: 0 })));
		got.cancel = { threw: cancel, live: liveGesture(h), teardown: torn() - before.teardown, gestureEnd: ends - before.ends };
		const idleBefore = h.calls.filter((c) => c.name === 'tools.trackHand').length;
		const move = thrown(() => h.capture.onMove(pointer(200, 200)));
		got.move = { threw: move, live: liveGesture(h), idle: h.calls.filter((c) => c.name === 'tools.trackHand').length > idleBefore };
		assert.deepEqual(got, ANSWERS[NOW]);
		assert.notDeepEqual(ANSWERS.before, ANSWERS.after, 'the two answers differ, as section 6.3 says they do');
	} finally { h.restore(); }
});

// ---- acceptance step 3 ----

const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const INPUT = code(read('app/src/input.js'));
// a method of Input, by name, from its line to its closing brace at one tab
const method = (name) => {
	const at = INPUT.search(new RegExp(`\\n\\t(?:get )?${name.replace('#', '\\#')}\\(`));
	assert.ok(at > 0, `${name} is a method of Input`);
	return INPUT.slice(at, INPUT.indexOf('\n\t}', at + 1));
};
const methods = () => [...INPUT.matchAll(/\n\t(?:get )?(#?[A-Za-z]\w*)\([^)]*\) \{/g)].map((m) => m[1]);

test('H26.2 (acceptance step 3): the triggers are gone, and the input state holds no press', () => {
	assert.equal(fs.existsSync(new URL('../app/src/triggers.js', import.meta.url)), false, 'app/src/triggers.js is deleted');
	for (const f of ['app/src/input.js', 'app/src/input-state.js', 'kernel/input-rules.mjs', 'lab/src/root.js', 'app/src/main.js']) assert.doesNotMatch(read(f), /triggers\.js'/, `${f} imports it nowhere`);
	assert.doesNotMatch(code(read('app/src/input-state.js')), /\bpress\b|travel/, 'the input state holds no press');
});

test('H26.2 (acceptance step 3): kernel/input-rules.mjs holds draw\'s declarations and the calls through, and no matching, guard or overlap code of its own', () => {
	const src = code(read('kernel/input-rules.mjs'));
	assert.deepEqual(Object.keys(adapter).sort(), ['composeRules', 'openGestures', 'overlapsIn', 'resolveInput'], 'its four functions');
	assert.deepEqual([...src.matchAll(/^import [^;]*? from '([^']+)';/gm)].map((m) => m[1]), ['@apnex/input-binding']);
	const body = (name) => src.slice(src.indexOf(`export function ${name}(`), src.indexOf('\n}', src.indexOf(`export function ${name}(`)));
	assert.match(body('composeRules'), /composeBindingTable\(/, 'composed by the component');
	assert.match(body('resolveInput'), /\{\s*const \{ match, claimed \} = table\.matchInput\(input, situation, guards\);\s*return \{ rule: match \? match\.row : null, claimed, match \};\s*$/, 'resolved by the component, the row handed back');
	assert.match(body('overlapsIn'), /return table\.findOverlaps\(inputs, situations, guardStates\)\.map\(/, 'its overlaps the component\'s');
	assert.match(body('openGestures'), /openGestureSession\(declaration\)/, 'its sessions the component\'s');
	assert.doesNotMatch(src, /\.on\(|\.when\(|\bfor \(|\bwhile \(|prevent\s*!==|(readOnly|helpOpen|gesturing)\s*(&&|\|\|)|&&\s*!?\w+\.(mutates|duringHelp|duringGesture|whileReadOnly)/,
		'it calls no predicate, loops over no row, and combines no guard state with a flag');
});

test('H26.2 (acceptance step 3): app/src/input.js assigns no mode, holds no ignoreUp, and decides no taken press, commit or cancel itself', () => {
	assert.doesNotMatch(INPUT, /\bthis\.mode\s*=(?!=)/, 'no `mode` assigned');
	assert.doesNotMatch(INPUT, /ignoreUp/, 'no ignoreUp');
	for (const m of ['press', 'release', 'dispatchUp', 'cancelDrag', '#cancelled']) assert.doesNotMatch(method(m), /\.button\s*[!=]==|this\.mode/, `${m} reads no button and no mode: the session decides`);
	assert.doesNotMatch(method('press'), /cancelDrag\(/, 'a press ends a gesture on the session\'s cancel alone');
	const desc = Object.getOwnPropertyDescriptor(Input.prototype, 'mode');
	assert.equal(typeof desc?.get, 'function', '`mode` is read through a getter over the session');
	assert.equal(desc.set, undefined, 'and is never written');
});

test('H26.2 (acceptance step 3; G7, G9): a body runs only on an outcome naming its phase, and only the lifecycle\'s methods ask the private session', () => {
	const bodies = [...INPUT.matchAll(/GESTURES\[([^\]]+)\]\??\.(start|update|commit|cancel)\b/g)];
	assert.deepEqual(bodies.map((m) => m[2]).sort(), ['cancel', 'commit', 'start', 'update'], 'one dispatch of each phase');
	for (const [, index, phase] of bodies) {
		assert.equal(index, 'outcome.gesture.name', `${phase}: the body of the gesture the outcome names`);
		const holder = methods().find((m) => new RegExp(`GESTURES\\[outcome\\.gesture\\.name\\]\\??\\.${phase}\\b`).test(method(m)));
		assert.match(method(holder), new RegExp(`outcome\\.phase\\s*[!=]==\\s*'${phase}'`), `${phase}: run in ${holder} on an outcome naming it`);
	}
	assert.match(method('chainFrom'), /outcome\.phase !== 'start' && outcome\.phase !== 'become'\) return;[\s\S]*this\.ctx = this\.linkDrag/, 'a chain\'s start runs on the outcome naming it');
	assert.match(INPUT, /\n\t#session;/, 'the session is a private field');
	assert.doesNotMatch(INPUT, /this\.session\b/, 'and no public one');
	const asking = methods().filter((m) => /#session\b/.test(method(m))).sort();
	assert.deepEqual(asking, ['cancelDrag', 'chainFrom', 'constructor', 'escalate', 'isGesturing', 'mode', 'move', 'press', 'release', 'startClone', 'startMove'].sort(),
		'the lifecycle\'s methods alone; a key\'s action reaches the session only through a request (chainFrom, cancelDrag)');
	for (const k of ['onShiftDown', 'onShiftUp', 'onWaypointKey', 'addStop', 'chainThroughNode', 'onHandDigit', 'onEscape']) assert.doesNotMatch(method(k), /#session/, `${k}: working data, no phase`);
});

test('H26.2 (acceptance step 3): decided once -- input.js measures no distance but the link release\'s atStart, and names the threshold once', () => {
	assert.doesNotMatch(INPUT, /Math\.hypot|travelled|box\.w < DRAG_THRESHOLD|dist\(pos, this\.ctx\.start\)/, 'no click measured anywhere else');
	assert.deepEqual([...INPUT.matchAll(/\bdist\(([^)]*)\)/g)].map((m) => m[1]), ['pos, ctx.start'], 'one distance: where a link release landed against its start');
	assert.equal([...INPUT.matchAll(/\bDRAG_THRESHOLD\b/g)].length, 3, 'declared once, read twice');
	assert.match(INPUT, /const DRAG_THRESHOLD = 4;/, 'the threshold the director ruled, in canvas units');
	assert.match(INPUT, /openGestures\(\{ threshold: DRAG_THRESHOLD,/, 'the session decides a drag by it');
	assert.match(INPUT, /atStart: dist\(pos, ctx\.start\) <= DRAG_THRESHOLD/, 'and the link release alone reads it again');
});

/*
F2 (H26.2's verification) -- TWO PRESS ROWS DRAW NEVER WRITES ARE REFUSED WHEN INPUT COMPOSES ITS TABLES, NAMING THE OWNER AND THE ROW.

A press row runs an action or opens a gesture. One holding both ran its action and opened nothing before the move; after it, the
session would start the gesture and Input run the action and return without the start body, every move then throwing on `update`.
And a row opening a gesture the canvas does not declare cancelled the live gesture and jammed Input with an unknown `mode` before the
move; after it, the session would refuse the match and leave the live gesture live. Neither row is in draw, and neither should behave
differently and badly unseen: each is refused at load, as a malformed row is (section 6.3, inputs nothing in draw produces).
*/
const withPresses = (presses) => () => makeInput({ parts: [...PRODUCT_CANVAS, { owner: 'probe', presses }] }).restore();
test('F2: a press row that both runs an action and opens a gesture is refused at load, naming its owner and id', () => {
	assert.throws(withPresses([{ id: 'both', on: () => false, run: 'clearOnClick', gesture: 'marquee' }]),
		{ message: "Input: probe's press row 'both' both runs clearOnClick and opens marquee -- a press row does one" });
	assert.doesNotThrow(withPresses([{ id: 'either', on: () => false, gesture: 'marquee' }, { id: 'or', on: () => false, run: 'clearOnClick' }]),
		'control: a row that opens a gesture, and one that runs an action, compose');
});
test('F2: a press row opening a gesture the canvas does not declare is refused at load, naming its owner and id', () => {
	assert.throws(withPresses([{ id: 'nowhere', on: () => false, gesture: 'lasso' }]),
		{ message: "Input: probe's press row 'nowhere' opens lasso, which is no gesture the canvas declares" });
	assert.throws(withPresses([{ id: 'inherited', on: () => false, gesture: 'toString' }]), /press row 'inherited' opens toString, which is no gesture/, 'a name every object inherits is none either');
	assert.doesNotThrow(() => makeInput().restore(), 'control: the product\'s own press rows compose');
});

/*
F6 (H26.2's verification) -- A CHAIN MID-DRAG IS A BECOME, NOT A CANCEL AND A START. A digit mid-drag chains the link drag on from the
node it places (section 5, step 5): the live gesture becomes the link drag, keeping the row that opened it, where cancelling it and
starting another would leave a gesture of no row. Draw reads no `row`, so nothing it does can tell the two apart; the session can. So
the gesture corpus's chains run in a process of their own whose adapter imports a logging copy of the component
(tests/fixtures/session-spy/), and the outcomes each chain made are read: the digit's hop one become, its row kept, and no cancel; a
Shift-release after the commit, with nothing live, one start of no row.
*/
test('F6: a chain mid-drag becomes the live gesture, its opening row kept, and a chain after a commit starts one -- the session\'s own outcomes', () => {
	const r = spawnSync(process.execPath, ['--import', new URL('./fixtures/session-spy/register.mjs', import.meta.url).href, new URL('./fixtures/session-spy/corpus.mjs', import.meta.url).pathname,
		'link-digit-chain', 'link-shift-chain'], { encoding: 'utf8' });
	assert.equal(r.status, 0, r.stderr);
	const log = JSON.parse(r.stdout);
	const requests = (id) => log[id].filter((o) => ['startGesture', 'becomeGesture', 'cancelGesture'].includes(o.op));
	assert.deepEqual(log['link-digit-chain'].find((o) => o.op === 'pressMatched'), { op: 'pressMatched', phase: 'start', gesture: { name: 'link', row: 'link' } },
		'control: the window sees the session -- the press opened the link drag from its row');
	assert.deepEqual(requests('link-digit-chain'), [{ op: 'becomeGesture', phase: 'become', gesture: { name: 'link', row: 'link' } }], 'the hop: one become, the row kept, no cancel');
	assert.deepEqual(log['link-digit-chain'].at(-1), { op: 'pointerUp', phase: 'commit', gesture: { name: 'link', row: 'link' } }, 'and the release commits the gesture the press opened');
	assert.deepEqual(requests('link-shift-chain'), [{ op: 'startGesture', phase: 'start', gesture: { name: 'link', row: null } }], 'after the commit, nothing live: one start, of no row');
});
