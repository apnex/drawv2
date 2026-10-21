/*
H26.2 (dev/design/components/INPUT-BINDING.md section 4, acceptance step 4; section 6) -- DRAW'S MATCHER, ITS PRESS AND ITS GESTURE
LIFECYCLE, OLD AND NEW, SIDE BY SIDE. The fixture of tests/input-binding-parity.test.js.

Draw's inputs must mean what they meant, row for row, and its gestures must run what they ran. Three comparisons hold it:

  the matcher    the old matcher and the adapter over input-binding compose every table section 2.2 lists -- the keys, the presses,
                 the double click, the key releases, run mode, the five release tables, the two box releases, the two handle
                 releases, and the network's drag grammar -- from the tenants the product page's Input and the lab's compose, and
                 answer the facts, situations and guard states draw's tests enumerate, every answer's row id and claim compared
  the press      the old press (the input state's travel and the triggers) and the session's, over generated streams of presses,
                 moves, releases, lost pointers and chain restarts, every move's drag and every release's trigger compared; the
                 differences are those section 6.3 lists -- a travel within about 10^-15 of the 4-unit threshold, decided now by the
                 exact distance where Math.hypot's rounding decided it -- each held with both answers in binding-parity-press.json
  the lifecycle  over every scenario of the gesture corpus, which gesture body ran for each input and which gesture was live after
                 it, recorded from the code before the move in binding-parity-lifecycle.json and replayed after it

THE OLD CODE is kept whole, verbatim, in tests/fixtures/pre-binding/ -- kernel/input-rules.mjs, app/src/input-state.js and
app/src/triggers.js as they stood at READ_AT, each held to its SHA-256 -- so the old side of the matcher and the press runs on every
gate after the move, as tests/pointer-bindings.test.js keeps the old press table as its oracle. The old lifecycle is the whole of
app/src/input.js, which no copy can stand in for, so it is a record. THE NEW SIDE is the adapter: tests/fixtures/binding-adapter.mjs
until the move, which moved that very file to kernel/input-rules.mjs, and that module since.

  node tests/fixtures/binding-parity.mjs --write     writes both records from the code as it stands -- before the move only
*/
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as OLD_RULES from './pre-binding/input-rules.mjs';
import * as OLD_STATE from './pre-binding/input-state.js';
import * as OLD_TRIGGERS from './pre-binding/triggers.js';
import * as ADAPTER from '../../kernel/input-rules.mjs';   // the adapter, the file this fixture held as binding-adapter.mjs until the move
import { makeInput } from './client-harness.mjs';
import { SCENARIOS, record } from './gesture-corpus.mjs';
import { Input, GESTURES } from '../../app/src/input.js';
import { DRAG_KINDS, LEGS, kindOf, pipeFor } from '../../network/grammar.mjs';
import { DEVICE_HAND } from '../../devices/device-hand.mjs';

export const READ_AT = '8793699';   // the last commit holding draw's matcher, press and lifecycle whole
export const MOVED = true;          // the move flipped it, with the new side's import
const root = new URL('../../', import.meta.url);
const sha256 = (url) => crypto.createHash('sha256').update(fs.readFileSync(url)).digest('hex');
export const ORIGINALS = [
	{ file: 'kernel/input-rules.mjs', copy: 'pre-binding/input-rules.mjs', sha256: '9b785e1ea775fc30950a323eb4592b33bc04ce7476b494ce4d06293a5b21a7e2' },
	{ file: 'app/src/input-state.js', copy: 'pre-binding/input-state.js', sha256: 'a7c68a7e55cb5fdefd564322c1e7510151e0cd8e0d6c3ac405973efd43cd0dc5' },
	{ file: 'app/src/triggers.js', copy: 'pre-binding/triggers.js', sha256: '1ba1742360d3fed39168701adf240e450fa3c3582651d69832171c4ce33c4eb1' },
].map((o) => ({ ...o, copySha: () => sha256(new URL(o.copy, import.meta.url)), liveSha: () => (fs.existsSync(new URL(o.file, root)) ? sha256(new URL(o.file, root)) : null) }));

export const OLD = OLD_RULES;
export const NEW = ADAPTER;

// ---- the matcher ----

/*
A composed table's tenants, in table order: the component's table and its declared rows, or the old matcher's array of copies. A
copy carries the defaults the old matcher stamped on it, so a flag holding its default is taken off -- `mutates` true, the other three
false -- and the new side's own defaults are asked wherever a row does not state otherwise; a row that stated a default answers alike.
*/
const STAMPED = { mutates: true, duringHelp: false, duringGesture: false, whileReadOnly: false };
const unstamped = (row) => Object.fromEntries(Object.entries(row).filter(([k, v]) => !(k in STAMPED && STAMPED[k] === v)));
export function tenantsOf(table) {
	const entries = Array.isArray(table) ? table.map(({ owner, ...row }) => ({ owner, row: unstamped(row) })) : table.rows.map((e) => ({ owner: e.owner, row: e.row }));
	const out = [];
	for (const { owner, row } of entries) {
		if (out.at(-1)?.owner !== owner) out.push({ owner, rules: [] });
		out.at(-1).rules.push(row);
	}
	return out;
}
// a composed table's rows, `owner:id`, in table order
export const idsOf = (table) => (Array.isArray(table) ? table.map((r) => `${r.owner}:${r.id}`) : table.rows.map((e) => `${e.owner}:${e.id}`));

// the tables an Input composes, by the names section 2.2 gives them, and the network's drag grammar as network/grammar.mjs composes it
export function tablesOf(input) {
	return {
		keys: input.keyRules, presses: input.pressRules, double: input.doubleRules, 'key-releases': input.releaseRules, run: input.runRules,
		...input.meaningRules,
	};
}
export const GRAMMAR = { 'grammar-kinds': [{ owner: 'network', rules: DRAG_KINDS }], 'grammar-legs': [{ owner: 'network', rules: LEGS }] };

// the product page's Input and the lab's, as the harness composes them: the lab is the page with no run mode (lab/src/root.js)
export const COMPOSITIONS = [['page', {}], ['lab', { runRules: [] }]];
export function withInput(opts, fn) {
	const h = makeInput(opts);
	try { return fn(h); } finally { h.restore(); }
}

// ---- what draw's tests enumerate, table by table ----

const combos = (names, extra = {}) => {
	const out = [];
	for (let n = 0; n < 2 ** names.length; n++) out.push(Object.fromEntries([...names.map((k, i) => [k, !!(n & (1 << i))]), ...Object.entries(extra)]));
	return out;
};
// every guard state draw hands, and every one it could: none, and each combination of its three states
export const GUARD_STATES = [{}, ...Array.from({ length: 8 }, (_, n) => ({ readOnly: !!(n & 1), helpOpen: !!(n & 2), gesturing: !!(n & 4) }))];
const LOCKS = [{ readOnly: false }, { readOnly: true }];
const MODSETS = combos(['shiftKey', 'ctrlKey', 'altKey'], { metaKey: false });
// tests/input.test.js's keys and modifier sets, as capture makes a key event (app/src/capture.js inputEvent)
const KEYS = [' ', 'Escape', 'Tab', 'Enter', 'Delete', 'Backspace', 'F2', 'F9', '/', '?', 'Shift', 'Alt', 'Control',
	...'abcdefghijklmnopqrstuvwxyz', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', ...'1234567', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
const KEY_MODS = [{}, { shiftKey: true }, { ctrlKey: true }, { ctrlKey: true, shiftKey: true }, { altKey: true }, { metaKey: true }];
const keyEvent = (type, key, m, repeat = false) => ({ type, button: 0, key, repeat, shiftKey: !!m.shiftKey, ctrlKey: !!m.ctrlKey, altKey: !!m.altKey, metaKey: !!m.metaKey,
	...(type === 'key-down' ? { onControl: false } : {}), claimed: false, capture: false });
const sit = (selection = { size: 0, ids: [], kinds: [], bends: null }, gesture = null, step = null) => ({ selection, gesture, step });
// tests/input.test.js's situations, and a gesture of every name the canvas runs, over each step
const KEY_SITUATIONS = [
	sit(),
	sit({ size: 1, ids: ['link-000001'], kinds: ['link'], bends: 0 }),
	sit({ size: 1, ids: ['link-000001'], kinds: ['link'], bends: 2 }),
	sit({ size: 1, ids: ['node-000001'], kinds: ['node'], bends: null }),
	sit({ size: 1, ids: ['zone-000001'], kinds: ['zone'], bends: null }),
	sit({ size: 2, ids: ['link-000001', 'node-000001'], kinds: ['link', 'node'], bends: null }),
	...Object.keys(GESTURES).flatMap((g) => ['node', 'waypoint', 'ground'].map((step) => sit(undefined, g, step))),
];
// tests/pointer-bindings.test.js's hits, every hit word the parts declare, a plugin's mark, and both handles
const HITS = [{ kind: 'canvas', id: null }, ...['node', 'waypoint', 'zone', 'link'].flatMap((kind) => [{ kind, id: `${kind}-000001` }, { kind, id: `${kind}-000002`, mark: true }]),
	{ kind: 'handle', id: 'se', handle: true }, { kind: 'lhandle', id: 'src', handle: true }];
const press = (on, button, m, region = null) => ({ type: 'down', button, key: null, repeat: false, ...m, at: { x: 0, y: 0 }, on, region, claimed: false, capture: false });
// tests/pointer-bindings.test.js's run-mode presses and situations, and a view-mode one
const region = (o) => ({ target: null, overTarget: false, action: null, input: null, owner: null, control: false, entity: false, ...o });
const RUN_REGIONS = [region({}), region({ target: 'node-e00001', overTarget: true }), region({ action: 'help', control: true }),
	region({ input: 0, owner: 'node-000001', control: true, entity: true }), region({ entity: true }), null];
const RUN_SITUATIONS = [{ mode: 'run', target: { kind: 'waypoint', id: 'node-e00001', roles: ['endpoint'] } },
	{ mode: 'run', target: { kind: 'waypoint', id: 'node-e00001', roles: [] } }, { mode: 'run', target: null }, { mode: 'view', target: null }];
const UP = { type: 'up' }, MOVE = { type: 'move' }, CANCEL = { type: 'cancel' };
const LINK_FACTS = ['dst', 'dstIsSrc', 'srcAlive', 'validTarget', 'hasVia', 'admitted', 'judged', 'click', 'atStart',
	'shift', 'ctrl', 'alt', 'pressShift', 'srcIsNode', 'handIsSrcType', 'chained', 'srcSelected'];
const releases = (names) => ({ facts: [UP, MOVE, CANCEL], contexts: combos(names), guards: GUARD_STATES });
const HOPS = [];
for (const [a, b, dst] of [['x', 'x', 'x'], ['x', 'y', 'y'], ['x', 'y', 'z'], ['y', 'x', 'y']]) for (const count of [2, 3]) for (const endPressed of [false, 'w', 'g'])
	for (const f of combos(['srcW', 'pipesOnly', 'guidedA', 'guidedB'])) HOPS.push({ a, b, dst, count, endPressed, ...f });

// each table's sweep -- one or several { facts, contexts, guards }, every combination asked
export const SWEEPS = {
	keys: [{ facts: KEYS.flatMap((k) => KEY_MODS.flatMap((m) => [keyEvent('key-down', k, m), keyEvent('key-down', k, m, true)])), contexts: KEY_SITUATIONS, guards: GUARD_STATES }],
	presses: [{ facts: HITS.flatMap((on) => [0, 1, 2].flatMap((b) => MODSETS.map((m) => press(on, b, m)))), contexts: [{ tool: false }, { tool: true }], guards: GUARD_STATES }],
	double: [{ facts: [{ type: 'double', button: 0 }, { type: 'down', button: 0 }, keyEvent('key-down', 'Enter', {})], contexts: [{}], guards: GUARD_STATES }],
	'key-releases': [{ facts: KEYS.flatMap((k) => KEY_MODS.map((m) => keyEvent('key-up', k, m))), contexts: KEY_SITUATIONS, guards: GUARD_STATES }],
	run: [{ facts: RUN_REGIONS.flatMap((r) => [0, 2].map((b) => press({ kind: 'canvas', id: null }, b, MODSETS[0], r))), contexts: RUN_SITUATIONS, guards: GUARD_STATES }],
	// tests/releases.test.js's every combination of the link release's facts, over each item the hand can hold and none
	link: [{ facts: [UP], contexts: [null, ...DEVICE_HAND.items].flatMap((hand) => combos(LINK_FACTS, { hand })), guards: LOCKS },
		{ facts: [MOVE, CANCEL], contexts: combos(LINK_FACTS, { hand: null }), guards: LOCKS }],
	marquee: [releases(['click', 'hand', 'shift', 'ctrl', 'alt'])],
	ctrlClick: [releases(['exists'])],
	pressDrag: [releases(['unplaced', 'onMark', 'linksOnLeft', 'leftPress'])],
	cloneDrag: [releases([])],
	'zone-draw': [releases(['area'])],
	tool: [releases(['area'])],
	'handle:zone': [releases(['changed'])],
	'handle:link': [releases(['retargets', 'admitted'])],
	'grammar-kinds': [{ facts: combos(['w', 'g']).map((pressed) => ({ pressed })), contexts: [null], guards: GUARD_STATES }],
	'grammar-legs': [{ facts: HOPS, contexts: [null], guards: GUARD_STATES }],
};

const answer = (r) => `${r.rule ? r.rule.id : '-'}${r.claimed ? '+' : ''}`;
// both sides compose the tenants and answer the sweep; the new side must hand back the very row it was given
export function compareMatcher(tenants, sweeps) {
	const o = OLD.composeRules(...tenants), n = NEW.composeRules(...tenants);
	const given = new Set(tenants.flatMap((t) => t.rules));
	let asked = 0;
	const differ = [], foreign = [];
	for (const { facts, contexts, guards } of sweeps) for (const g of guards) for (const c of contexts) for (const f of facts) {
		asked++;
		const a = OLD.resolveInput(o, f, c, g), b = NEW.resolveInput(n, f, c, g);
		if (answer(a) !== answer(b) && differ.length < 5) differ.push({ fact: f, context: c, guards: g, was: answer(a), now: answer(b) });
		if (b.rule && !given.has(b.rule) && foreign.length < 5) foreign.push(b.rule.id);
	}
	const overlaps = (m, t) => sweeps.flatMap((s) => m.overlapsIn(t, s.facts, s.contexts, s.guards).map((x) => `${JSON.stringify(x.guards)} ${x.ids.join('/')}`));
	return { asked, differ, foreign, overlaps: { old: overlaps(OLD, o), now: overlaps(NEW, n) } };
}
// the grammar's own composition answers as the sweep's new side does: kindOf and pipeFor return the run of the one row
export function grammarAgrees() {
	const kinds = NEW.composeRules(...GRAMMAR['grammar-kinds']), legs = NEW.composeRules(...GRAMMAR['grammar-legs']);
	const bad = [];
	for (const f of SWEEPS['grammar-kinds'][0].facts) if (kindOf(f) !== NEW.resolveInput(kinds, f, null, {}).rule.run) bad.push(JSON.stringify(f));
	for (const h of HOPS) if (pipeFor(h) !== NEW.resolveInput(legs, h, null, {}).rule.run.pipe) bad.push(JSON.stringify(h));
	return bad;
}

// ---- the press ----

export const THRESHOLD = 4;   // canvas units a press may travel and still be a click, ruled 2026-09-30
export const STREAMS = 4000, SEED = 0x26200;
const rng = (seed) => { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
/*
Streams of presses, moves, releases, lost pointers and chain restarts. A move is near the threshold by construction -- a travel of
4 units times (1 + k 2^-52), k from -8 to 8, at a random angle, from a random origin anywhere on the drawing and far off it -- or on
an axis, or a quarter-unit lattice point, or far out and back; so the band where the arithmetic rounds is crossed often, and the
ordinary decisions are asked too.
*/
export function pressStreams(n = STREAMS, seed = SEED) {
	const r = rng(seed), out = [];
	const at = () => ({ x: (r() - 0.5) * (r() < 0.2 ? 2e6 : 4000), y: (r() - 0.5) * (r() < 0.2 ? 2e6 : 4000) });
	for (let s = 0; s < n; s++) {
		const steps = [];
		let origin = null;
		for (let i = 0, len = 3 + Math.floor(r() * 12); i < len; i++) {
			const p = r();
			if (!origin || p < 0.12) { origin = at(); steps.push(['down', origin.x, origin.y]); continue; }
			if (p < 0.2) { steps.push(['up']); origin = null; continue; }
			if (p < 0.23) { steps.push(['cancel']); origin = null; continue; }
			if (p < 0.27) { origin = at(); steps.push(['chained', origin.x, origin.y]); continue; }
			const q = r();
			let x, y;
			if (q < 0.6) { const k = Math.floor(r() * 17) - 8, th = r() * 2 * Math.PI, d = THRESHOLD * (1 + k * 2 ** -52); x = origin.x + d * Math.cos(th); y = origin.y + d * Math.sin(th); }
			else if (q < 0.75) { const k = Math.floor(r() * 5) - 2; x = origin.x + (r() < 0.5 ? 1 : -1) * (THRESHOLD + k * 2 ** -50); y = origin.y; }
			else if (q < 0.9) { x = origin.x + (Math.floor(r() * 41) - 20) / 4; y = origin.y + (Math.floor(r() * 41) - 20) / 4; }
			else { x = origin.x + (r() - 0.5) * 400; y = origin.y + (r() - 0.5) * 400; }
			steps.push(['move', x, y]);
		}
		out.push(steps);
	}
	return out;
}
// the old press: the input state's travel and the triggers, a move answering whether the press is a drag, a release its trigger
export function oldPress(steps) {
	let state = OLD_STATE.initialInputState();
	const out = [];
	for (const [op, x, y] of steps) {
		if (op === 'down' || op === 'move' || op === 'chained') state = OLD_STATE.track(state, { type: op, at: { x, y } });
		if (op === 'move') out.push(OLD_TRIGGERS.dragging(state));
		if (op === 'up') out.push(OLD_TRIGGERS.releaseTrigger(state));
		if (op === 'up' || op === 'cancel') state = OLD_STATE.track(state, { type: op });
	}
	return out;
}
// the session's: one gesture, engaged and taking no press, so a chain restart starts or becomes it as draw's chain does
export function newPress(steps) {
	const s = NEW.openGestures({ threshold: THRESHOLD, gestures: [{ name: 'g', engaged: true, button: null }] });
	const out = [];
	for (const [op, x, y] of steps) {
		if (op === 'down') s.pointerDown({ at: { x, y }, button: 0 });
		else if (op === 'move') { s.pointerMove({ at: { x, y } }); out.push(s.state.press?.beyond === true); }
		else if (op === 'up') out.push(s.pointerUp({ button: 0 }).trigger);
		else if (op === 'cancel') s.pointerLost();
		else if (op === 'chained') (s.state.gesture ? s.becomeGesture : s.startGesture)({ gesture: 'g', from: { x, y } });
	}
	return out;
}
export function pressDifferences(streams = pressStreams()) {
	const out = [];
	streams.forEach((steps, stream) => {
		const was = oldPress(steps), now = newPress(steps);
		was.forEach((v, i) => { if (v !== now[i]) out.push({ stream, output: i, old: v, new: now[i] }); });
	});
	return out;
}

// the exact value of a binary64, as a BigInt scaled by 2^1074 -- read from its bits, sharing nothing with the component
const SCALE = 1074n;
function exact(v) {
	const b = new DataView(new ArrayBuffer(8));
	b.setFloat64(0, v);
	const hi = b.getUint32(0), lo = b.getUint32(4), e = (hi >>> 20) & 0x7ff;
	let m = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
	if (e) m |= 1n << 52n;
	const shift = BigInt(Math.max(e, 1) - 1075) + SCALE;
	const mag = shift >= 0n ? m << shift : m >> -shift;
	return hi >>> 31 ? -mag : mag;
}
// a move's exact verdict and Math.hypot's, from a press's origin: the oracle the differences are classed by
export function verdicts(from, to) {
	const dx = exact(to.x) - exact(from.x), dy = exact(to.y) - exact(from.y), t = BigInt(THRESHOLD) << SCALE;
	const hyp = Math.hypot(to.x - from.x, to.y - from.y);
	return { exactBeyond: dx * dx + dy * dy > t * t, hypotBeyond: hyp > THRESHOLD, hypot: hyp };
}
/*
A difference is section 6.3's -- the exact threshold -- when some move of the press it lies in, from that press's origin, is judged
by Math.hypot one way and by the exact distance the other, Math.hypot's distance within 10^-14 of the threshold, and the session's
answer is the exact one. Every difference the streams make is classed so, or fails.
*/
export function classOf(steps, output) {
	let origin = null, beyondExact = false, crossing = false, k = -1;
	for (const [op, x, y] of steps) {
		if (op === 'down' || op === 'chained') { if (op === 'down' || origin) { origin = { x, y }; beyondExact = false; crossing = false; } }
		if (op === 'move' && origin) {
			const v = verdicts(origin, { x, y });
			if (v.exactBeyond !== v.hypotBeyond && Math.abs(v.hypot - THRESHOLD) < 1e-14) crossing = true;
			beyondExact ||= v.exactBeyond;
		}
		if (op === 'move' || op === 'up') k++;
		if (k === output) {
			const exactAnswer = op === 'move' ? beyondExact : beyondExact ? 'drop' : 'click';
			return crossing ? { exactAnswer, class: 'exact-threshold' } : { exactAnswer, class: null };
		}
		if (op === 'up' || op === 'cancel') origin = null;
	}
	return { exactAnswer: undefined, class: null };
}

// ---- the lifecycle ----

// which gesture is live: the name Input hands its key rows as the situation's gesture, read off one key no row binds
export function liveGesture(h) {
	let seen;
	const real = Input.prototype.situation;
	Input.prototype.situation = function (targetId, gesture) { seen = gesture ?? null; return real.call(this, targetId, gesture); };
	try { h.input.keyDown(keyEvent('key-down', '\u0000', {})); } finally { Input.prototype.situation = real; }
	return seen;
}
// every gesture body, and each of Input's methods that starts a chain or becomes a gesture, logged as it runs
function spied(log) {
	const undo = [];
	for (const [name, slot] of Object.entries(GESTURES)) for (const phase of ['start', 'update', 'commit', 'cancel']) {
		const f = slot[phase];
		if (typeof f !== 'function') continue;
		slot[phase] = function (...a) { log.push(`${name}.${phase}`); return f.apply(this, a); };
		undo.push(() => { slot[phase] = f; });
	}
	for (const m of ['chainFrom', 'startMove', 'startClone']) {
		const f = Input.prototype[m];
		Input.prototype[m] = function (...a) { log.push(m); return f.apply(this, a); };
		undo.push(() => { Input.prototype[m] = f; });
	}
	return () => undo.reverse().forEach((u) => u());
}
// a scenario's lifecycle: for each step, the bodies that ran and the gesture live after it, `ran>live`
export function lifecycleOf(scenario) {
	const log = [], steps = [];
	const restore = spied(log);
	try { record(scenario, { afterStep: (h) => { steps.push(`${log.splice(0).join(',')}>${liveGesture(h) ?? '-'}`); } }); } finally { restore(); }
	return steps;
}

export const PRESS_RECORD = new URL('./binding-parity-press.json', import.meta.url);
export const LIFECYCLE_RECORD = new URL('./binding-parity-lifecycle.json', import.meta.url);

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1] && process.argv[2] === '--write') {
	if (MOVED) throw new Error('binding-parity: the records are read from the code before the move, and the move has been made');
	const streams = pressStreams();
	const differences = pressDifferences(streams).map((d) => ({ ...d, ...classOf(streams[d.stream], d.output) }));
	fs.writeFileSync(PRESS_RECORD, `${JSON.stringify({ readAt: READ_AT, streams: STREAMS, seed: SEED, threshold: THRESHOLD, differences }, null, '\t')}\n`);
	const scenarios = Object.fromEntries(SCENARIOS.map((s) => [s.id, lifecycleOf(s)]));
	fs.writeFileSync(LIFECYCLE_RECORD, `${JSON.stringify({ readAt: READ_AT, scenarios }, null, '\t')}\n`);
	console.log(`binding-parity: ${differences.length} press difference(s) over ${STREAMS} streams; ${SCENARIOS.length} scenarios' lifecycles`);
}
