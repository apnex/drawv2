/*
H26.2 (dev/design/components/INPUT-BINDING.md section 4, acceptance steps 3 and 4; section 6.3) -- DRAW ON INPUT-BINDING.

WHAT MOVED, AND WHAT IS LEFT (acceptance step 3), as H26.1's tests/grid-arithmetic-gone.test.js held its own. app/src/triggers.js is
gone; the input state holds no press; kernel/input-rules.mjs is draw's adapter -- its declarations and calls through to the component,
no matching, guard or overlap code of its own (RESTATED at H26.8: its declaration and two openings, the tables asked directly); and app/src/input.js assigns no `mode`, holds no `ignoreUp`, decides neither which press
a live gesture takes, nor which release commits it, nor that a press or a lost pointer cancels it, and runs a gesture's body, and a
chain's start, only on an outcome naming that phase, the session private to it. It measures no distance but the link release's
`atStart`, and names the click threshold once -- the "decided once" test of tests/triggers.test.js, restated here as that file went
with its module.

THE EMPTY HANDLE (acceptance step 4; section 6.3). A handle press whose start finds no entity left the handle gesture live with an
empty context -- kept, B410 -- reachable with two pointers: a zone selected, its corner pressed with Shift held, Shift released with the
pointer still down, and the still-drawn handle pressed by a second pointer. That press cancels the live handle gesture first, whose
teardown drops the zone from the selection (H24.3), so the new start finds no zone. H26.2 changed only what a pointer cancel of that
empty gesture did, both answers stated here until H27.3 (B410) ended the gesture at the start instead, so no empty gesture is left for
a cancel to meet; the test of that ending replaces them, below.
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
import { FOLDERS } from '../tools/layers.mjs';   // H26.8: the product's folders, read for the retired translation

// RESTATED at H26.8's picks move: the selected zone's corner handle the overlay drew (`h.at`), picked by item -- `h` the test's harness
const corner = (h, x, y, m = {}) => pointer(x, y, { ...m, target: h.at({ key: 'handles', where: { 'data-corner': 'se' } }) });
const thrown = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };

/*
H27.3 (B410): A HANDLE PRESS THAT FINDS NO ENTITY ENDS AT ONCE. The two-pointer reproduction above, through the capture -- a zone's corner
pressed with Shift held, Shift released with the pointer down, the still-drawn handle pressed by a second pointer, whose start finds no
selected zone -- and a re-plugged link's fixed end gone, its end handle still drawn: each press ends its gesture at once, so no move and
no release throws, nothing is committed, no gesture is left live, and the next press is the idle path's.
*/
test('H27.3 (B410): a handle press that finds no entity ends at once -- no move or release throws, nothing is committed, no gesture left live', async () => {
	const { seedNodes } = await import('./fixtures/client-harness.mjs');
	const { makeLink } = await import('../plugins/network/link-queries.mjs');
	const h = makeInput();
	try {
		const z = makeZone(h.model, { x: -150, y: -150, w: 300, h: 300 });
		h.model.put('zone', z);
		h.selection.set([z.id]);
		h.capture.onDown(corner(h, 150, 150, { shiftKey: true }));
		h.capture.onKeyUp(key('Shift'));
		const second = thrown(() => h.capture.onDown(corner(h, 150, 150)));   // the second pointer on the still-drawn handle
		assert.deepEqual([second, h.selection.list()], [null, []], 'the press answered, the zone dropped before the start ran (H24.3)');
		assert.equal(liveGesture(h), null, 'the start found no zone: its gesture ended at once, none left live');
		h.reset();
		assert.equal(thrown(() => h.capture.onMove(pointer(200, 200))), null, 'a move does not throw');
		assert.equal(thrown(() => h.capture.onUp(pointer(200, 200, { buttons: 0 }))), null, 'nor the release');
		assert.deepEqual([h.commits.length, liveGesture(h)], [0, null], 'nothing committed, nothing live');
		assert.deepEqual(['x', 'y', 'w', 'h'].map((k) => h.model.get('zone', z.id)[k]), [-150, -150, 300, 300], 'the zone as it was');
	} finally { h.restore(); }
	const g = makeInput();
	try {
		const [a, b] = seedNodes(g.model, [[0, 0], [240, 0]]);
		const link = makeLink(g.model, a.id, b.id);
		g.model.put('link', link);
		g.selection.set([link.id]);
		const end = g.at({ key: 'handles', where: { 'data-end': 'src' } });
		assert.ok(end, 'control: the link\'s end handle is drawn');
		g.model.del('node', b.id);   // its fixed end gone, straight from the Model, the handle still drawn
		const press = thrown(() => g.capture.onDown(pointer(20, 0, { target: end })));
		assert.deepEqual([press, liveGesture(g)], [null, null], 'a re-plug whose fixed end is gone ends at once');
		g.reset();
		assert.equal(thrown(() => g.capture.onMove(pointer(120, 60))), null, 'a move does not throw');
		assert.equal(thrown(() => g.capture.onUp(pointer(120, 60, { buttons: 0 }))), null, 'nor the release');
		assert.equal(g.commits.length, 0, 'nothing committed');
	} finally { g.restore(); }
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

/*
RESTATED at H26.8's binding move (dev/design/components/NATIVE-SHAPES.md sections 3.1, 3.2 and 4.3; GR6; NS11): the module translates
nothing -- it exports draw's declaration, `openTable` and `openGestures` alone; `openTable` hands the component draw's declaration and the
tenants exactly as given, `{ owner, rows }`, renaming nothing, and throws the component's problems unchanged; and no call site reads a
translated answer, each asking the component's table itself.
*/
test('H26.2 (acceptance step 3; H26.8 GR6): kernel/input-rules.mjs exports the declaration, openTable and openGestures alone, and translates nothing', () => {
	const src = code(read('kernel/input-rules.mjs'));
	assert.deepEqual(Object.keys(adapter).sort(), ['TABLE_DECLARATION', 'openGestures', 'openTable'], 'the declaration and the two openings');
	assert.deepEqual([...src.matchAll(/^import [^;]*? from '([^']+)';/gm)].map((m) => m[1]), ['@apnex/input-binding']);
	const body = (name) => src.slice(src.indexOf(`export function ${name}(`), src.indexOf('\n}', src.indexOf(`export function ${name}(`)));
	assert.match(body('openTable'), /^export function openTable\(\.\.\.tenants\) \{\s*const opened = composeBindingTable\(\{ \.\.\.TABLE_DECLARATION, tenants \}\);\s*if \(opened\.ok\) return opened\.table;\s*throw new Error\(`input rules refused: \$\{opened\.problems\.map\(\(p\) => `\$\{p\.pointer \|\| '\/'\} \$\{p\.problem\}`\)\.join\(', '\)\}`\);\s*$/,
		'composed by the component from draw\'s declaration and the tenants as given; a refusal its problems, unchanged');
	assert.match(body('openGestures'), /openGestureSession\(declaration\)/, 'its sessions the component\'s');
	assert.deepEqual(Object.keys(adapter.TABLE_DECLARATION), ['guards', 'claim', 'opens'], 'the declaration: draw\'s guards, claim and gesture field, no tenant');
	// no product module asks a translated answer: the tables are asked as the component answers
	const product = FOLDERS.filter((f) => f.dir !== 'tools' && f.dir !== 'tests').flatMap((f) => {
		const walk = (dir) => fs.readdirSync(new URL(`../${dir}`, import.meta.url), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : /\.m?js$/.test(e.name) ? [`${dir}/${e.name}`] : []));
		return walk(f.dir);
	});
	assert.ok(product.length > 150, `the product's modules were read: ${product.length}`);
	assert.deepEqual(product.filter((f) => /\b(composeRules|resolveInput|overlapsIn)\b/.test(code(read(f)))), [], 'no module names the retired translation');
	assert.deepEqual(product.filter((f) => /\bopenTable\(/.test(code(read(f))) && !f.endsWith('kernel/input-rules.mjs')).sort(), ['app/src/input.js', 'plugins/network/grammar.mjs'],
		'Input\'s tables and the network\'s grammar composed through openTable');
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
		// RESTATED at H26.8's capture move (NATIVE-SHAPES.md section 3.2, NS7): handed the host for an editing gesture, Input for its own
		assert.match(INPUT, new RegExp(`GESTURES\\[outcome\\.gesture\\.name\\]\\??\\.${phase}\\??\\.?\\(this\\.#subjectOf\\(outcome\\.gesture\\.name\\)`), `${phase}: its subject the host or Input, by the gesture`);
		const holder = methods().find((m) => new RegExp(`GESTURES\\[outcome\\.gesture\\.name\\]\\??\\.${phase}\\b`).test(method(m)));
		assert.match(method(holder), new RegExp(`outcome\\.phase\\s*[!=]==\\s*'${phase}'`), `${phase}: run in ${holder} on an outcome naming it`);
	}
	assert.match(method('chainFrom'), /outcome\.phase !== 'start' && outcome\.phase !== 'become'\) return;[\s\S]*this\.ctx = this\.linkDrag/, 'a chain\'s start runs on the outcome naming it');
	assert.match(INPUT, /\n\t#session;/, 'the session is a private field');
	assert.doesNotMatch(INPUT, /this\.session\b/, 'and no public one');
	const asking = methods().filter((m) => /#session\b/.test(method(m))).sort();
	// RESTATED at H26.6's move 9 (PAN-ZOOM.md section 3.6): `#viewAsked` reads whether a gesture is live and Space is held, for the view's
	// rows; `keyDown`, `keyUp` and `blur` tell the session the keys held (IB14) -- no phase -- and `blur` cancels a live pan by a request.
	// RESTATED at H27.4 (B447): `leave`, the pointer off the canvas, ends a pan row's press still waiting as a lost pointer -- no gesture live,
	// so no phase -- and drops the keys held (IB14)
	assert.deepEqual(asking, ['#viewAsked', 'blur', 'cancelDrag', 'chainFrom', 'constructor', 'escalate', 'isGesturing', 'keyDown', 'keyUp', 'leave', 'mode', 'move', 'press', 'release', 'startClone', 'startMove'].sort(),
		'the lifecycle\'s methods alone; a key\'s action reaches the session only through a request (chainFrom, cancelDrag)');
	for (const k of ['onShiftDown', 'onShiftUp', 'onWaypointKey', 'addStop', 'chainThroughNode', 'onHandDigit', 'onEscape']) assert.doesNotMatch(method(k), /#session/, `${k}: working data, no phase`);
});

test('H26.2 (acceptance step 3): decided once -- input.js measures no distance but the link release\'s atStart, and names the threshold once', () => {
	assert.doesNotMatch(INPUT, /Math\.hypot|travelled|box\.w < DRAG_THRESHOLD|dist\(pos, this\.ctx\.start\)/, 'no click measured anywhere else');
	// RESTATED at H26.6's move 9 (PAN-ZOOM.md section 3.2, PZ17): in screen pixels, the session measured on the screen and the link
	// release comparing the release's screen point with the drag's screen start (tests/view-gestures.test.js holds the behaviour)
	assert.deepEqual([...INPUT.matchAll(/\bdist\(([^)]*)\)/g)].map((m) => m[1]), ['evt.screen, ctx.screenStart'], 'one distance: where a link release landed against its start, on the screen');
	assert.equal([...INPUT.matchAll(/\bPRESS_THRESHOLD_PIXELS\b/g)].length, 3, 'declared once, read twice');
	assert.match(INPUT, /const PRESS_THRESHOLD_PIXELS = 4;/, 'the threshold the director ruled, in screen pixels since H26.6\'s move 9');
	assert.match(INPUT, /openGestures\(\{ threshold: PRESS_THRESHOLD_PIXELS, measure: 'screen',/, 'the session decides a drag by it, on the screen');
	assert.match(INPUT, /atStart: dist\(evt\.screen, ctx\.screenStart\) <= PRESS_THRESHOLD_PIXELS/, 'and the link release alone reads it again');
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
	// RESTATED at H26.5 (RELEASES-0.2.md section 4, a:F1): the press is resolved in one call, and its outcome names the start
	assert.deepEqual(log['link-digit-chain'].find((o) => o.op === 'resolvePress'), { op: 'resolvePress', phase: 'start', gesture: { name: 'link', row: 'link' } },
		'control: the window sees the session -- the press opened the link drag from its row');
	assert.equal(log['link-digit-chain'].some((o) => o.op === 'pressMatched'), false, 'and draw calls pressMatched itself no more');
	assert.deepEqual(requests('link-digit-chain'), [{ op: 'becomeGesture', phase: 'become', gesture: { name: 'link', row: 'link' } }], 'the hop: one become, the row kept, no cancel');
	assert.deepEqual(log['link-digit-chain'].at(-1), { op: 'pointerUp', phase: 'commit', gesture: { name: 'link', row: 'link' } }, 'and the release commits the gesture the press opened');
	assert.deepEqual(requests('link-shift-chain'), [{ op: 'startGesture', phase: 'start', gesture: { name: 'link', row: null } }], 'after the commit, nothing live: one start, of no row');
});
