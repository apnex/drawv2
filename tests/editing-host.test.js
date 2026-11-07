/*
H26.8's capture move (dev/design/components/NATIVE-SHAPES.md section 3.2, the editing gestures and the host; NS7; GR7, GR13) -- THE
EDITING GESTURES RUN WITH A HOST ALONE.

The five generic gestures' bodies and the marquee left app/src/input.js for app/src/editing-gestures.js, each phase handed the frozen
host Input makes in place of Input. These hold that move:
  - the host Input hands is frozen and holds exactly section 3.2's members;
  - every phase of every body runs with a host alone -- no Input -- each verb acting on the context its phase holds: `press`,
    `escalate`, `drag` and `retarget`, the verbs of `start` and `update`, on the host's CURRENT context, which a `start` opens or an
    `update` is handed; `endRetarget`, `act`, `commitMove` and `commitClone`, the verbs of `commit` and `cancel`, on the context the phase
    is handed, the host's current one `{}` there, so a body reaching a current-context verb in a commit or a cancel fails (GR13);
  - through Input, a handle's retarget committed and cancelled -- its preview removed and its drag state cleared each way -- and a move
    and a marquee committed, so a verb of Input's that read its current context in a commit, where Input holds `{}`, fails here too;
  - app/src/editing-gestures.js reads nothing but its parameters, its own declarations and its imports, which are the document's and
    its own part's alone (GR7).
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { EDITING_GESTURES } from '../app/src/editing-gestures.js';
import { PARTS } from '../tools/layers.mjs';
import { lex } from '../tools/js-tokens.mjs';
import { makeInput, pointer, key, seedNodes } from './fixtures/client-harness.mjs';
import { makeZone } from '../plugins/zones/make-zone.mjs';
import { snapNode } from '../app/src/snap.js';

const ROOT = path.resolve(import.meta.dirname, '..');
// section 3.2's host table, member by member, in its order
const HOST_MEMBERS = ['model', 'selection', 'scene', 'hideCrosshair', 'showHandles', 'showBox', 'showLink', 'setState', 'factsOf', 'handleOf',
	'holding', 'anchorAt', 'decide', 'act', 'press', 'escalate', 'drag', 'retarget', 'endRetarget', 'commitMove', 'commitClone', 'cellName', 'boxOf'];
const PHASE_ORDER = ['start', 'update', 'commit', 'cancel'];

test('the editing gestures are the five generic bodies and the marquee, and Input\'s own table keeps link and box', async () => {
	assert.deepEqual(Object.keys(EDITING_GESTURES), ['move', 'clone', 'pending', 'clone-pending', 'handle', 'marquee']);
	const { GESTURES } = await import('../app/src/input.js');
	// RESTATED at H26.6's move 9 (PAN-ZOOM.md section 3.6): the three pan gestures, Input's own, declared after them
	assert.deepEqual(Object.keys(GESTURES), ['move', 'clone', 'pending', 'clone-pending', 'handle', 'link', 'box', 'marquee', 'pan-middle', 'pan-right', 'pan-space'], 'the session\'s declaration, in its order');
	for (const name of Object.keys(EDITING_GESTURES)) assert.equal(GESTURES[name], EDITING_GESTURES[name], `${name}: Input dispatches the editing gesture's own slot`);
});

test('the host Input hands an editing gesture is frozen and holds exactly the host table\'s members', () => {
	const h = makeInput();
	const real = EDITING_GESTURES.marquee.start;
	let host = null;
	EDITING_GESTURES.marquee.start = (...a) => { host = a[0]; return real(...a); };
	try {
		h.capture.onDown(pointer(-600, -400));
		assert.ok(host, 'control: the marquee started on open ground');
		assert.equal(Object.isFrozen(host), true, 'frozen');
		assert.deepEqual(Object.keys(host), HOST_MEMBERS, 'exactly section 3.2\'s members');
		assert.deepEqual([host.model, host.selection, host.scene], [h.model, h.selection, h.scene], 'the values Input holds');
		h.input.cancelDrag();
	} finally { EDITING_GESTURES.marquee.start = real; h.restore(); }
});

/*
A HOST ALONE: every member recorded, the current-context verbs reading the host's current context and refusing `{}` -- what a commit's
and a cancel's host holds -- and the handed-context verbs refusing any context but the phase's own.
*/
function hostAlone() {
	const calls = [];
	const state = { current: {}, phaseCtx: null };
	const rec = (name, answer) => (...args) => { calls.push(name); return typeof answer === 'function' ? answer(...args) : answer; };
	const live = (verb) => {
		if (!Object.keys(state.current).length) throw new Error(`GR13: ${verb} read the current context, which a commit or a cancel holds as {}`);
		return state.current;
	};
	const handed = (verb, ctx) => { if (ctx !== state.phaseCtx) throw new Error(`GR13: ${verb} was handed a context other than its phase's`); };
	const scene = new Proxy({}, { get: (t, k) => (...a) => calls.push(`scene.${String(k)}:${a[0]}`) });
	const model = { set: rec('model.set'), del: rec('model.del'), get: rec('model.get', (kind, id) => ({ id, kind, name: id })), endpointOf: rec('model.endpointOf', (id) => ({ id, name: id, x: 0, y: 0 })) };
	const FACTS = { node: { placed: true, anchor: true, clones: true }, link: {}, zone: { placed: true, modifier: 'shiftKey' } };
	const HANDLES = {
		corner: { kind: 'zone', preview: 'reshape', start: () => ({ before: { x: 0, y: 0, w: 60, h: 60 } }), at: () => ({ w: 120 }), released: () => ({ resized: true }) },
		end: { kind: 'link', preview: 'retarget', targets: ['node'], dragState: 'replugging', start: () => ({ fixedId: 'node-000002', end: 'src' }), released: (ctx, target) => ({ onto: target?.id ?? null }) },
	};
	const host = Object.freeze({
		model, selection: { list: rec('selection.list', () => ['zone-000001', 'link-000001']), clear: rec('selection.clear') }, scene,
		hideCrosshair: rec('hideCrosshair'), showHandles: rec('showHandles'), showBox: rec('showBox'), showLink: rec('showLink'), setState: rec('setState'),
		factsOf: rec('factsOf', (w) => FACTS[w]), handleOf: rec('handleOf', (w) => HANDLES[w]), holding: rec('holding', null),
		anchorAt: rec('anchorAt', () => ({ id: 'node-000003', name: 'c' })), decide: rec('decide', (table) => ({ id: table })), act: rec('act'),
		press: (hit, pos, shift) => { calls.push('press'); state.current = { hit, start: pos, shift }; return state.current; },
		escalate: (pos, evt, table) => { calls.push(`escalate:${table}:${live('escalate').hit.kind}`); },
		drag: () => { calls.push(`drag:${live('drag').moved.length}`); },
		retarget: (target) => { calls.push('retarget'); live('retarget').target = target?.id ?? null; },
		endRetarget: (ctx) => { calls.push('endRetarget'); handed('endRetarget', ctx); },
		commitMove: (ctx) => { calls.push('commitMove'); handed('commitMove', ctx); },
		commitClone: (ctx) => { calls.push('commitClone'); handed('commitClone', ctx); },
		cellName: rec('cellName', 'A1'), boxOf: rec('boxOf', (a, b) => ({ x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y })),
	});
	assert.deepEqual(Object.keys(host), HOST_MEMBERS, 'control: the host alone is the table\'s');
	return { host, calls, state };
}

const POS = { x: 120, y: 60 }, EVT = Object.freeze({ type: 'up', button: 0, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false });
// each body's phases, run as Input runs them: a start's answer kept as the current context; an update handed it; a commit and a cancel
// handed the gesture's context, the host's current one `{}`
function runPhases(name, { hit, ctx: opened = null, outcome = { phase: 'commit', trigger: 'drop' } }) {
	const slot = EDITING_GESTURES[name];
	const phases = PHASE_ORDER.filter((p) => typeof slot[p] === 'function');
	const out = {};
	for (const phase of phases) {
		const { host, calls, state } = hostAlone();
		// a context as its start opens it, with this host -- its previews this host's scene's -- or as an escalation makes it
		const ctx = opened ? structuredCloneish(opened) : slot.start(host, hit, POS, EVT, { id: name });
		if (phase !== 'start') calls.length = 0;
		if (phase === 'start') { /* run above */ } else if (phase === 'update') { state.current = ctx; slot.update(host, ctx, POS, EVT); }
		else { state.current = {}; state.phaseCtx = ctx; phase === 'commit' ? slot.commit(host, ctx, POS, EVT, outcome) : slot.cancel(host, ctx); }
		out[phase] = calls;
	}
	return out;
}
// a context's own fields copied, its functions and previews kept: each phase starts from the same context
const structuredCloneish = (ctx) => Object.fromEntries(Object.entries(ctx).map(([k, v]) => [k, Array.isArray(v) ? v.map((x) => ({ ...x })) : v]));

const moving = () => ({ hit: { kind: 'node', id: 'node-000001' }, start: { x: 0, y: 0 }, orthoActive: false, moved: [{ kind: 'node', id: 'node-000001', before: { x: 0, y: 0 } }] });

// RESTATED at H28.5 (B7): a move's and a clone's cancel write no model -- the frames wrote the gesture's preview, which Input drops
test('GR13: every phase of every editing body runs with a host alone, each verb on the context its phase holds', () => {
	assert.deepEqual(runPhases('move', { ctx: moving() }), {
		update: ['drag:1'], commit: ['hideCrosshair', 'commitMove'], cancel: ['hideCrosshair'],
	});
	assert.deepEqual(runPhases('clone', { ctx: { ...moving(), clones: [{ kind: 'node', entity: { id: 'node-000009' } }] } }), {
		update: ['drag:1'], commit: ['hideCrosshair', 'commitClone'], cancel: ['selection.clear', 'hideCrosshair'],
	});
	assert.deepEqual(runPhases('pending', { hit: { kind: 'node', id: 'node-000001' } }), {
		start: ['press'], update: ['factsOf', 'factsOf', 'factsOf', 'escalate:pressDrag:node'],   // Shift not held: no fact asked at the press
	});
	assert.deepEqual(runPhases('clone-pending', { hit: { kind: 'node', id: 'node-000001' } }), {
		start: [], update: ['escalate:cloneDrag:node'], commit: ['model.get', 'decide', 'act'],
	});
	assert.deepEqual(runPhases('handle', { hit: { kind: 'corner', id: 'se' } }), {
		start: ['handleOf', 'selection.list', 'model.get'], update: ['model.set', 'showBox'], commit: ['model.set', 'decide', 'act', 'showHandles'], cancel: ['model.set'],
	}, 'a reshape');
	assert.deepEqual(runPhases('handle', { hit: { kind: 'end', id: 'src' } }), {
		start: ['handleOf', 'selection.list', 'model.get', 'model.endpointOf', 'setState', 'scene.put:overlay', 'scene.put:overlay'],
		update: ['anchorAt', 'scene.put:overlay', 'retarget', 'showLink'],
		commit: ['endRetarget', 'anchorAt', 'decide', 'act', 'showHandles'], cancel: ['endRetarget'],
	}, 'a retarget');
	assert.deepEqual(runPhases('marquee', { hit: { kind: 'canvas', id: null }, outcome: { phase: 'commit', trigger: 'click' } }), {
		start: ['scene.put:overlay'], update: ['boxOf', 'scene.put:overlay'], commit: ['scene.remove:overlay', 'boxOf', 'holding', 'decide', 'act'], cancel: ['scene.remove:overlay'],
	});
});

test('GR13: a commit\'s or a cancel\'s host holds a current context of {}, so a body reaching a current-context verb there fails', () => {
	const { host, state } = hostAlone();
	state.current = {};
	const ctx = moving();
	state.phaseCtx = ctx;
	assert.throws(() => host.drag(POS, false), /GR13: drag read the current context/, 'the control: drag in a commit fails');
	assert.throws(() => host.retarget(null, 'x'), /GR13: retarget read the current context/);
	assert.throws(() => host.escalate(POS, EVT, 'pressDrag', {}, 'move'), /GR13: escalate read the current context/);
	assert.throws(() => host.commitMove({}, POS, false), /GR13: commitMove was handed a context other than its phase's/, 'and a handed-context verb its phase\'s alone');
	assert.doesNotThrow(() => EDITING_GESTURES.move.commit(host, ctx, POS));
});

// ---- through Input ----

const endHandle = (h, end, x, y) => pointer(x, y, { target: h.at({ key: 'handles', where: { 'data-end': end } }) });
async function threeHosts(h) {
	const { makeLink } = await import('../plugins/network/link-queries.mjs');
	const [n0, n1, n2] = seedNodes(h.model, [[0, 0], [360, 0], [360, 360]]);
	const l = makeLink(h.model, n2.id, n1.id); h.model.put('link', l);
	h.selection.set([l.id]);
	return { n0, n1, n2, l };
}
const previews = (h) => h.drawn('#overlay', 'link-live').length;

test('GR13 through Input: a handle\'s retarget committed and cancelled -- its preview removed, its drag state cleared, each way', async () => {
	const h = makeInput();
	try {
		const { n0, n1, n2, l } = await threeHosts(h);
		const marked = () => h.states.classesOf(l.id).includes('replugging');
		// cancelled, by Escape mid-drag
		h.capture.onDown(endHandle(h, 'src', 360, 330));
		h.capture.onMove(pointer(200, 0));
		assert.deepEqual([previews(h), marked()], [1, true], 'control: dragged, a preview line and the link marked');
		h.capture.onKeyDown(key('Escape'));
		assert.deepEqual([previews(h), marked()], [0, false], 'cancelled: no preview, no drag state');
		h.capture.onMove(pointer(220, 0));
		assert.deepEqual([previews(h), marked()], [0, false], 'and no gesture left live: a further move draws nothing');
		assert.deepEqual([h.model.get('link', l.id).src, h.model.get('link', l.id).dst], [n2.id, n1.id], 'and the link as it was');
		// committed, released on a device
		h.capture.onDown(endHandle(h, 'src', 360, 330));
		h.capture.onMove(pointer(30, 0));
		assert.deepEqual([previews(h), marked()], [1, true], 'control: dragged again');
		h.capture.onUp(pointer(0, 0, { buttons: 0 }));
		assert.deepEqual([previews(h), marked()], [0, false], 'committed: no preview, no drag state');
		assert.deepEqual([h.model.get('link', l.id).src, h.model.get('link', l.id).dst], [n0.id, n1.id], 'and re-plugged onto the device released on');
	} finally { h.restore(); }
});

/*
Move 6's verification (should-fix 3) -- THREE HOST MEMBERS REACH THE COLLABORATORS THE TABLE NAMES, WITH THEIR ARGUMENTS. GR13 above runs
each body on a host of recorders, so a member wired to the wrong thing, or to nothing, passed it: `showBox` is the readout's box, `cellName`
draw's snapped cell, and `retarget` hands Input its excluded id -- the fixed end, which a dragged end never hovers. Each read through Input,
from what the readout was told and what the editing states hold.
*/
test('the host\'s showBox, cellName and retarget reach the readout, the snapped cell and the states, each with its arguments, during a drag', async () => {
	const h = makeInput();
	try {
		// showBox: a zone's corner dragged, the readout told the box the live preview wrote
		const z = makeZone(h.model, { x: -30, y: -30, w: 120, h: 120 }); h.model.put('zone', z);
		h.selection.set([z.id]);
		const corner = (x, y) => pointer(x, y, { target: h.at({ key: 'handles', where: { 'data-corner': 'se' } }) });
		h.capture.onDown(corner(90, 90));
		h.reset();
		h.capture.onMove(corner(210, 150));
		assert.deepEqual(h.stateCalls('readout.setBox'), [[{ x: -30, y: -30, w: 240, h: 180 }]], 'the readout\'s box, the reshaped zone\'s');
		h.capture.onUp(corner(210, 150));
		// cellName and retarget: a link's source end dragged, its destination the fixed end
		const { n0, n1 } = await threeHosts(h);
		h.capture.onDown(endHandle(h, 'src', 360, 360));
		h.reset();
		h.capture.onMove(pointer(-300, 200));
		assert.deepEqual(h.stateCalls('readout.setLink'), [[n1.name, h.input.snapNode({ x: -300, y: 200 })]], 'over open ground: the fixed end\'s name and the snapped cell');
		h.reset();
		h.capture.onMove(pointer(360, 0, { target: h.at(n1.id) }));
		assert.equal(h.states.classesOf(n1.id).includes('hover'), false, 'over the fixed end: never hovered, the id excluded');
		assert.deepEqual(h.stateCalls('states.setState').filter(([id]) => id === n1.id), [], 'and no state set on it');
		assert.deepEqual(h.stateCalls('readout.setLink'), [[n1.name, h.input.snapNode({ x: 360, y: 0 })]], 'its cell named, as over ground');
		h.capture.onMove(pointer(0, 0, { target: h.at(n0.id) }));
		assert.deepEqual(h.states.classesOf(n0.id), ['hover'], 'control: over another device, hovered');
		h.capture.onKeyDown(key('Escape'));
	} finally { h.restore(); }
});

test('GR13 through Input: a move and a marquee committed, each verb of a commit handed the gesture\'s context while Input holds {}', () => {
	const h = makeInput();
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [360, 0]]);
		h.capture.onDown(pointer(0, 0, { target: h.at(a.id), button: 2, buttons: 2 }));
		h.capture.onMove(pointer(120, 60, { target: h.at(a.id), button: -1, buttons: 2 }));
		h.capture.onUp(pointer(120, 60, { button: 2, buttons: 0 }));
		assert.deepEqual([h.model.get('node', a.id).x, h.model.get('node', a.id).y], [120, 60], 'the move committed where it was released');
		h.capture.onDown(pointer(-600, -400));
		h.capture.onMove(pointer(600, 400));
		assert.equal(h.drawn('#overlay', 'marquee').length, 1, 'control: dragged, its preview drawn');
		h.capture.onUp(pointer(600, 400, { buttons: 0 }));
		assert.deepEqual(h.selection.list().sort(), [a.id, b.id].sort(), 'the marquee selected what it spanned');
		assert.equal(h.drawn('#overlay', 'marquee').length, 0, 'and its preview removed');
	} finally { h.restore(); }
});

// ---- the source: what the module reads ----

/*
GR7, GR13 -- app/src/editing-gestures.js reads nothing but its parameters, its own declarations and its imports, and imports from the
document and its own part alone. Every name the module reads -- an identifier that is no property's name and no object key -- is declared
in it (an import, a const, a parameter) or a word of the language; `this` is refused.
*/
const KEYWORDS = new Set(['import', 'from', 'export', 'const', 'let', 'return', 'if', 'else', 'null', 'true', 'false', 'undefined', 'typeof', 'new', 'of', 'in']);
test('GR7, GR13: app/src/editing-gestures.js imports the document and its own part alone, and reads nothing but its parameters and imports', () => {
	const file = 'app/src/editing-gestures.js';
	const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
	const imports = [...src.matchAll(/^import \{([^}]*)\} from '([^']+)';/gm)].map((m) => ({ names: m[1].split(',').map((n) => n.trim()), to: path.posix.normalize(path.posix.join('app/src', m[2])) }));
	const ownPart = new Set([...PARTS.editing.modules, ...PARTS.document.modules]);
	assert.ok(imports.length >= 1, 'control: the imports were read');
	for (const i of imports) assert.ok(ownPart.has(i.to), `${i.to}: imported from neither the editing part nor the document`);
	assert.deepEqual(PARTS.editing.consumes, ['document'], 'and the part consumes the document alone');
	const tokens = lex(src);
	const declared = new Set(imports.flatMap((i) => i.names));
	for (let k = 0; k < tokens.length; k++) {
		const t = tokens[k], prev = tokens[k - 1], next = tokens[k + 1];
		if (t.type !== 'id') continue;
		if (prev?.type === 'id' && ['const', 'let'].includes(prev.value)) declared.add(t.value);
		if (next?.type === 'p' && next.value === '=>') declared.add(t.value);   // a lone arrow parameter
	}
	// every parameter list of an arrow, and every name a destructuring const declares
	for (let k = 0; k < tokens.length; k++) {
		if (tokens[k].type === 'p' && tokens[k].value === '=>' && tokens[k - 1]?.value === ')') {
			let depth = 0, j = k - 1;
			for (; j >= 0; j--) { if (tokens[j].value === ')') depth++; else if (tokens[j].value === '(') { depth--; if (depth === 0) break; } }
			for (const p of tokens.slice(j + 1, k - 1)) if (p.type === 'id') declared.add(p.value);
		}
		if (tokens[k].type === 'id' && ['const', 'let'].includes(tokens[k].value) && tokens[k + 1]?.value === '{') {
			for (let j = k + 2; tokens[j] && tokens[j].value !== '}'; j++) if (tokens[j].type === 'id') declared.add(tokens[j].value);
		}
	}
	const read = new Set();
	for (let k = 0; k < tokens.length; k++) {
		const t = tokens[k], prev = tokens[k - 1], next = tokens[k + 1];
		if (t.type !== 'id' || KEYWORDS.has(t.value)) continue;
		if (prev?.type === 'p' && (prev.value === '.' || prev.value === '?.')) continue;   // a property's name
		if (next?.type === 'p' && next.value === ':' && prev?.type === 'p' && ['{', ','].includes(prev.value)) continue;   // an object's key
		read.add(t.value);
	}
	assert.ok(read.has('host') && read.has('kindOf') && read.has('previewRect'), `control: the names read were found: ${[...read].join(', ')}`);
	assert.equal(read.has('this'), false, 'no `this`');
	const undeclared = [...read].filter((n) => !declared.has(n));
	assert.deepEqual(undeclared, [], `names the module reads but neither declares nor imports: ${undeclared.join(', ')}`);
});
