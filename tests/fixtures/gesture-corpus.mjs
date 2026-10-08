/*
THE GESTURE CORPUS -- stage 1 of the gesture system (dev/design/input/GESTURE-SYSTEM.md, section 9).

The safety net the restructuring stands on. Stages 1 to 5 move capture, input state, triggers, bindings and actions out
of `app/src/input.js` and change NO outcome; the input and guide-gesture suites assert what they assert, and this holds
EVERYTHING ELSE a gesture produces, so a change nobody wrote a test for still fails.

Each scenario drives the product's real Input through the harness with synthetic events, and records what crosses a
boundary -- never Input's internals (scan-writers):

  claims      whether each event was claimed (preventDefault), per step, true or false -- how many times is not behaviour
  threw       an event that threw, with its message -- a crash is behaviour too, and is kept until it is fixed on purpose
  commits     every request the gesture sent through `history`, in order
  said        every readout flash
  editor      label-editor opens and closes
  palette     held-tool changes
  host        events handed to the host (`draw:action`)
  judged      the facts a plugin's drag judge was handed
  final       the document's entities and the selection when the scenario ends

Ids are random, so the record is written with each id replaced by its kind and its order of first appearance
(`node#1`, `link#2`); two runs of the same behaviour produce the same record. `Date.now` is pinned while a scenario
runs, since run-mode actions stamp the time.

THE GOLDEN FILE is `tests/fixtures/gesture-corpus.json`, written from the code as it stood when the corpus was made
(`6be0bb5`) and compared by `tests/gesture-corpus.test.js`. It changes only with a behaviour change the director ruled,
in the commit that makes it:

	node tests/fixtures/gesture-corpus.mjs --write
*/
import fs from 'node:fs';
import { makeZone } from '../../zones/make-zone.mjs';   // O-b1: the zones plugin's factory
import { makeInput } from './client-harness.mjs';

const GOLDEN = new URL('./gesture-corpus.json', import.meta.url);

// ---- boards: named entities, so a scenario says `n0`, not an id ----

const BOARDS = {
	empty: () => [],
	pair: () => [['n0', 'node', 0, 0], ['n1', 'node', 360, 0]],
	three: () => [['n0', 'node', 0, 0], ['n1', 'node', 360, 0], ['n2', 'node', 360, 360]],
	straight: () => [['n0', 'node', 0, 0], ['n1', 'node', 360, 0], ['l0', 'link', 'n0', 'n1']],
	bent: () => [['n0', 'node', 0, 0], ['n1', 'node', 360, 0], ['w0', 'waypoint', 180, 120], ['l0', 'link', 'n0', 'n1', ['w0']]],
	// a waypoint no link uses (it was `pinned` until S-d retired the field, H18.14)
	free: () => [['n0', 'node', 0, 0], ['n1', 'node', 360, 0], ['w0', 'waypoint', 180, 120]],
	// on the zone grid, which is offset half a cell (planner/kinds.mjs): seeded at -120 until V-d, which no edit could keep --
	// the preview refused every edit to it, as the server would have (H18.28)
	zone: () => [['z0', 'zone', -150, -150, 300, 300], ['n0', 'node', 0, 0], ['n1', 'node', 360, 0]],
	chain: () => [['n0', 'node', 0, 0], ['n1', 'node', 180, 0], ['n2', 'node', 360, 0]],
};

function seed(h, board) {
	const ids = {};
	for (const [alias, kind, ...a] of BOARDS[board]()) {
		let e;
		if (kind === 'node') e = h.model.makeNode('host', { x: a[0], y: a[1] });
		else if (kind === 'waypoint') e = h.model.makeWaypoint({ x: a[0], y: a[1] });
		else if (kind === 'zone') e = makeZone(h.model, { x: a[0], y: a[1], w: a[2], h: a[3] });
		else { e = h.model.makeLink(ids[a[0]], ids[a[1]]); if (a[2]) e.via = a[2].map((w) => ids[w]); }
		h.model.put(kind === 'waypoint' ? 'node' : kind, e);   // a waypoint is a node with no type (F-c)
		ids[alias] = e.id;
	}
	return ids;
}

// ---- synthetic events, shaped as the harness's are, with a claim counter ----

const MODS = (m = {}) => ({ shiftKey: !!m.shift, ctrlKey: !!m.ctrl, altKey: !!m.alt, metaKey: !!m.meta });

function targetFor(ids, on) {
	const none = { contains: () => false };
	if (!on) return { tagName: 'svg', classList: none, dataset: {}, closest: () => null };
	if (on.handle) return { tagName: 'circle', classList: { contains: (c) => c === 'handle' }, dataset: { end: on.handle }, closest: () => null };
	if (on.corner) return { tagName: 'rect', classList: { contains: (c) => c === 'handle' }, dataset: { corner: on.corner }, closest: () => null };
	const id = ids[on] ?? on;
	const kind = id.split('-')[0];
	return {
		tagName: 'g', id, dataset: {},
		classList: { contains: (c) => kind === 'link' && c === 'link' },
		closest: (sel) => (sel.includes(kind) ? { id } : null),
	};
}

function pointerEvent(ids, x, y, on, m = {}) {
	const ev = { clientX: x, clientY: y, button: m.button ?? 0, buttons: m.up ? 0 : 1, pointerId: 1, ...MODS(m),
		target: targetFor(ids, on), claimed: 0, stopPropagation() {} };
	ev.preventDefault = () => { ev.claimed++; };
	return ev;
}

function keyEvent(k, m = {}) {
	const ev = { key: k, code: k, repeat: false, ...MODS(m), target: { tagName: 'BODY' }, claimed: 0, stopPropagation() {} };
	ev.preventDefault = () => { ev.claimed++; };
	return ev;
}

// ---- the scenarios. Steps: down/move/up/dbl [x, y, on, mods], key/keyup [k, mods], and setup steps ----

const drag = (from, to, onFrom, onTo, mods = {}, hops = []) => [
	['down', ...from, onFrom, mods],
	...hops.flatMap(([k, x, y, on]) => [['move', x, y, on, mods], ['key', k]]),
	['move', ...to, onTo, mods],
	['up', ...to, onTo, { ...mods, up: true }],
];

export const SCENARIOS = [
	// ---- link drags ----
	{ id: 'link-plain', board: 'pair', steps: drag([0, 0], [360, 0], 'n0', 'n1') },
	{ id: 'link-duplicate-straight', board: 'straight', steps: drag([0, 0], [360, 0], 'n0', 'n1') },
	{ id: 'link-w-bend', board: 'pair', steps: drag([0, 0], [360, 0], 'n0', 'n1', {}, [['w', 180, 120]]) },
	{ id: 'link-w-thread-existing', board: 'bent', steps: drag([0, 0], [360, 0], 'n0', 'n1', {}, [['w', 180, 120, 'w0']]) },
	{ id: 'link-w-thread-free', board: 'free', steps: drag([0, 0], [360, 0], 'n0', 'n1', {}, [['w', 180, 120, 'w0']]) },
	{ id: 'link-w-free-cancelled', board: 'free', steps: [['down', 0, 0, 'n0'], ['move', 180, 120, 'w0'], ['key', 'w'], ['key', 'Escape']] },
	{ id: 'link-release-ground-after-w', board: 'pair', steps: [['down', 0, 0, 'n0'], ['move', 180, 120], ['key', 'w'], ['move', 240, 240], ['up', 240, 240, null, { up: true }]] },
	{ id: 'link-release-ground-no-key', board: 'pair', steps: drag([0, 0], [240, 240], 'n0', null) },
	// renamed at P7 X-a (H18.37): the page composes the network, so these record its grammar, not production's old no-op
	{ id: 'link-w-on-node', board: 'three', steps: drag([0, 0], [360, 360], 'n0', 'n2', {}, [['w', 360, 0, 'n1']]) },
	{ id: 'link-g', board: 'pair', steps: drag([0, 0], [360, 0], 'n0', 'n1', {}, [['g', 180, 120]]) },
	{ id: 'link-shift-chain', board: 'three', steps: [['down', 0, 0, 'n0'], ['move', 360, 0, 'n1'], ['up', 360, 0, 'n1', { shift: true, up: true }], ['move', 360, 360, 'n2'], ['down', 360, 360, 'n2'], ['up', 360, 360, 'n2', { up: true }]] },
	{ id: 'link-shift-chain-then-w', board: 'three', steps: [['down', 0, 0, 'n0'], ['move', 360, 0, 'n1'], ['up', 360, 0, 'n1', { shift: true, up: true }], ['move', 480, 180], ['key', 'w'], ['move', 360, 360, 'n2'], ['up', 360, 360, 'n2', { up: true }]] },
	{ id: 'link-digit-chain', board: 'pair', steps: [['down', 0, 0, 'n0'], ['move', 180, 240], ['key', '2'], ['move', 360, 0, 'n1'], ['up', 360, 0, 'n1', { up: true }]] },
	// a drag chained through a node by a digit, released without moving: a click, but NOT a retype of the node just placed
	{ id: 'link-digit-chain-click-keeps-type', board: 'pair', steps: [['hand', 'router'], ['down', 0, 0, 'n0'], ['move', 180, 240], ['key', '2'], ['up', 180, 240, null, { up: true }]] },
	// a click is a release that never travelled more than 4px from its press (ruled 2026-09-30)
	{ id: 'link-out-and-back-is-a-drag', board: 'pair', steps: [['down', 0, 0, 'n0'], ['move', 200, 150], ['move', 2, 1, 'n0'], ['up', 2, 1, 'n0', { up: true }]] },
	{ id: 'marquee-diagonal-over-4px-no-stamp', board: 'empty', steps: [['hand', 'router'], ['down', 120, 120], ['move', 123, 123], ['up', 123, 123, null, { up: true }]] },
	// a chained run is ended by a press that is not the drag's start: on its anchor it selects, elsewhere it ends the run -- unchanged
	{ id: 'link-chain-ended-on-anchor', board: 'three', steps: [['down', 0, 0, 'n0'], ['move', 360, 0, 'n1'], ['up', 360, 0, 'n1', { shift: true, up: true }], ['move', 200, 200], ['move', 360, 0, 'n1'], ['down', 360, 0, 'n1'], ['up', 360, 0, 'n1', { up: true }]] },
	{ id: 'link-chain-ended-elsewhere', board: 'three', steps: [['down', 0, 0, 'n0'], ['move', 360, 0, 'n1'], ['up', 360, 0, 'n1', { shift: true, up: true }], ['move', 600, 300], ['down', 600, 300], ['up', 600, 300, null, { up: true }]] },
	{ id: 'link-right-button-release-ignored', board: 'pair', steps: [['down', 0, 0, 'n0'], ['move', 360, 0, 'n1'], ['up', 360, 0, 'n1', { button: 2, up: true }], ['up', 360, 0, 'n1', { up: true }]] },
	{ id: 'link-to-waypoint-end', board: 'bent', steps: drag([360, 0], [180, 120], 'n1', 'w0') },
	// ---- clicks through the link gesture ----
	{ id: 'click-node-selects', board: 'pair', steps: [['down', 0, 0, 'n0'], ['up', 0, 0, 'n0', { up: true }]] },
	{ id: 'click-node-shift-toggles', board: 'pair', steps: [['select', ['n1']], ['down', 0, 0, 'n0', { shift: true }], ['up', 0, 0, 'n0', { shift: true, up: true }]] },
	{ id: 'click-node-retypes-with-hand', board: 'pair', steps: [['hand', 'router'], ['down', 0, 0, 'n0'], ['up', 0, 0, 'n0', { up: true }]] },
	{ id: 'click-waypoint-selects', board: 'bent', steps: [['down', 180, 120, 'w0'], ['up', 180, 120, 'w0', { up: true }]] },
	// ---- move, clone, delete chord ----
	{ id: 'move-node-right-drag', board: 'pair', steps: drag([0, 0], [120, 60], 'n0', 'n0', { button: 2 }) },
	{ id: 'move-zone-shift-drag', board: 'zone', steps: drag([-60, -60], [0, 60], 'z0', 'z0', { shift: true }) },
	{ id: 'move-link-refused', board: 'straight', steps: drag([180, 0], [180, 120], 'l0', 'l0') },
	{ id: 'move-shift-held-ortho', board: 'pair', steps: [['down', 0, 0, 'n0', { button: 2 }], ['move', 120, 20, 'n0', { button: 2 }], ['key', 'Shift', { shift: true }], ['move', 120, 20, 'n0', { button: 2, shift: true }], ['up', 120, 20, 'n0', { button: 2, shift: true, up: true }]] },
	{ id: 'clone-ctrl-drag', board: 'pair', steps: drag([0, 0], [120, 120], 'n0', 'n0', { ctrl: true }) },
	{ id: 'clone-ctrl-click-toggles', board: 'pair', steps: [['down', 0, 0, 'n0', { ctrl: true }], ['up', 0, 0, 'n0', { ctrl: true, up: true }]] },
	// a click with a little jitter is still a click: a Ctrl+click toggles, it does not clone
	{ id: 'clone-ctrl-click-with-jitter-toggles', board: 'pair', steps: [['down', 0, 0, 'n0', { ctrl: true }], ['move', 2, 2, 'n0', { ctrl: true }], ['up', 2, 2, 'n0', { ctrl: true, up: true }]] },
	{ id: 'clone-ctrl-right-drag', board: 'pair', steps: drag([0, 0], [120, 120], 'n0', 'n0', { ctrl: true, button: 2 }) },
	{ id: 'delete-chord-alt-right', board: 'straight', steps: [['down', 0, 0, 'n0', { alt: true, button: 2 }], ['up', 0, 0, 'n0', { alt: true, button: 2, up: true }]] },
	// ---- canvas: marquee, zone, stamp ----
	{ id: 'marquee-selects', board: 'pair', steps: drag([-60, -60], [420, 60], null, null) },
	{ id: 'shift-drag-canvas-draws-zone-not-marquee', board: 'three', steps: [['select', ['n2']], ...drag([-60, -60], [60, 60], null, null, { shift: true })] },
	{ id: 'marquee-one-end-of-link', board: 'straight', steps: drag([-60, -60], [60, 60], null, null) },
	{ id: 'marquee-both-ends-of-link', board: 'straight', steps: drag([-60, -60], [420, 60], null, null) },
	{ id: 'marquee-click-clears', board: 'pair', steps: [['select', ['n0']], ['down', 600, 300], ['up', 600, 300, null, { up: true }]] },
	{ id: 'marquee-click-stamps-hand', board: 'empty', steps: [['hand', 'router'], ['down', 120, 120], ['up', 120, 120, null, { up: true }]] },
	{ id: 'zone-draw', board: 'empty', steps: drag([0, 0], [240, 180], null, null, { shift: true }) },
	{ id: 'zone-draw-zero', board: 'empty', steps: [['down', 0, 0, null, { shift: true }], ['up', 0, 0, null, { shift: true, up: true }]] },
	// ---- handles ----
	{ id: 'resize-zone-corner', board: 'zone', steps: [['select', ['z0']], ...drag([150, 150], [270, 270], { corner: 'se' }, { corner: 'se' })] },
	{ id: 'replug-straight-to-free-pair', board: 'three', steps: [['link', 'n2', 'n1'], ['selectLast'], ...drag([360, 360], [0, 0], { handle: 'src' }, 'n0')] },
	{ id: 'replug-straight-to-held-pair', board: 'three', steps: [['link', 'n0', 'n1'], ['link', 'n2', 'n1'], ['selectLast'], ...drag([360, 360], [0, 0], { handle: 'src' }, 'n0')] },
	// ---- tools, double click, cancel ----
	{ id: 'text-tool-box', board: 'empty', steps: [['key', 't'], ...drag([0, 0], [120, 60], null, null)] },
	{ id: 'dblclick-node-opens-editor', board: 'pair', steps: [['dbl', 0, 0, 'n0']] },
	{ id: 'escape-cancels-link-drag', board: 'pair', steps: [['down', 0, 0, 'n0'], ['move', 180, 120], ['key', 'w'], ['key', 'Escape']] },
	{ id: 'pointercancel-mid-move', board: 'pair', steps: [['down', 0, 0, 'n0', { button: 2 }], ['move', 120, 60, 'n0', { button: 2 }], ['cancel']] },
	// ---- keys ----
	{ id: 'key-w-idle-then-drag', board: 'pair', steps: [['at', 180, 240], ['key', 'w'], ['down', 180, 240, 'last'], ['move', 360, 0, 'n1'], ['up', 360, 0, 'n1', { up: true }]] },
	{ id: 'key-c-bent', board: 'bent', steps: [['select', ['l0']], ['key', 'c'], ['key', 'c']] },
	{ id: 'key-c-straight', board: 'straight', steps: [['select', ['l0']], ['key', 'c']] },
	{ id: 'key-c-nothing', board: 'straight', steps: [['key', 'c']] },
	{ id: 'key-f-and-k', board: 'straight', steps: [['select', ['l0']], ['key', 'f'], ['key', 'f'], ['key', 'k']] },
	{ id: 'key-l-chain-and-star', board: 'chain', steps: [['select', ['n0', 'n1', 'n2']], ['key', 'l'], ['key', 'z', { ctrl: true }], ['select', ['n0', 'n1', 'n2']], ['key', 'L', { shift: true }]] },
	{ id: 'key-group-ungroup', board: 'pair', steps: [['select', ['n0', 'n1']], ['key', 'g', { ctrl: true }], ['key', 'g', { ctrl: true, shift: true }]] },
	{ id: 'key-delete-and-undo-redo', board: 'straight', steps: [['select', ['n0']], ['key', 'Delete'], ['key', 'z', { ctrl: true }], ['key', 'y', { ctrl: true }], ['key', 'Backspace', { ctrl: true, shift: true }]] },
	{ id: 'key-delete-nothing-selected', board: 'pair', steps: [['key', 'Delete'], ['key', 'Backspace']] },
	{ id: 'key-arrows-nudge-resize', board: 'zone', steps: [['select', ['n0']], ['key', 'ArrowRight'], ['key', 'ArrowRight'], ['select', ['z0']], ['key', 'ArrowDown', { shift: true }]] },
	{ id: 'key-duplicate', board: 'pair', steps: [['select', ['n0']], ['key', 'd', { ctrl: true }]] },
	{ id: 'key-wrap-and-reshape', board: 'pair', steps: [['select', ['n0', 'n1']], ['key', 'z'], ['select', ['n0']], ['key', 's']] },
	{ id: 'key-hand-stamp-pipette', board: 'pair', steps: [['at', 120, 240], ['hand', 'router'], ['key', 'Enter'], ['at', 0, 0], ['key', 'q'], ['key', '3']] },
	{ id: 'key-view-keys', board: 'pair', steps: [['key', 'e'], ['key', 'r'], ['key', 'Tab'], ['at', 60, 60], ['key', ' '], ['key', ' ', { shift: true }], ['key', '?'], ['key', 'Escape'], ['key', 'F9']] },
	{ id: 'key-select-all-with-waypoint', board: 'bent', steps: [['key', 'a', { ctrl: true }]] },
	{ id: 'key-select-all-and-rename', board: 'straight', steps: [['key', 'a', { ctrl: true }], ['select', ['n0']], ['key', 'F2']] },
	{ id: 'key-up-shift-alt', board: 'pair', steps: [['key', 'Shift', { shift: true }], ['keyup', 'Shift'], ['key', 'Alt', { alt: true }], ['keyup', 'Alt']] },
	// ---- read-only and run mode ----
	{ id: 'read-only-refuses', board: 'straight', steps: [['readOnly'], ...drag([0, 0], [360, 0], 'n0', 'n1'), ['select', ['l0']], ['key', 'c'], ['key', 'Delete'], ['key', 'f'], ['key', 'a', { ctrl: true }]] },
	{ id: 'read-only-right-drag-does-not-move', board: 'pair', steps: [['readOnly'], ...drag([0, 0], [120, 60], 'n0', 'n0', { button: 2 })] },
	{ id: 'run-mode-places-tower', board: 'pair', steps: [['mode', 'run'], ['down', 180, 240], ['up', 180, 240, null, { up: true }]] },
	{ id: 'run-mode-action', board: 'pair', steps: [['mode', 'run'], ['down', 0, 0, { action: 'help' }]] },
	// ---- the plugin seam: the network's keys, with a recording judge ----
	{ id: 'plugin-g-accepted', board: 'pair', judge: 'accept', steps: drag([0, 0], [360, 0], 'n0', 'n1', {}, [['g', 180, 120]]) },
	{ id: 'plugin-g-refused-keeps', board: 'pair', judge: 'keep-guides', steps: drag([0, 0], [360, 0], 'n0', 'n1', {}, [['w', 120, 120], ['g', 240, 120]]) },
	{ id: 'plugin-w-on-node', board: 'three', judge: 'accept', steps: drag([0, 0], [360, 360], 'n0', 'n2', {}, [['w', 360, 0, 'n1']]) },
	{ id: 'plugin-duplicate-reaches-judge', board: 'straight', judge: 'refuse', steps: drag([0, 0], [360, 0], 'n0', 'n1') },
	// B263: a run-mode click is the next gesture and not a drag, so the w that placed the source no longer counts (ruled 2026-09-30)
	{ id: 'plugin-source-w-spent-by-run-press', board: 'pair', judge: 'accept', steps: [['at', 180, 240], ['key', 'w'], ['mode', 'run'], ['down', 0, 0, 'n0'], ['up', 0, 0, 'n0', { up: true }], ['mode', 'view'], ['down', 180, 240, 'last'], ['move', 360, 0, 'n1'], ['up', 360, 0, 'n1', { up: true }]] },
	{ id: 'plugin-source-w', board: 'pair', judge: 'accept', steps: [['at', 180, 240], ['key', 'w'], ['down', 180, 240, 'last'], ['move', 360, 0, 'n1'], ['up', 360, 0, 'n1', { up: true }]] },
];

// the targets a `run-mode-action` press needs: an element carrying data-action
function actionTarget(on) {
	const el = { tagName: 'g', dataset: { action: on.action }, classList: { contains: () => false }, closest: () => null };
	return { tagName: 'g', dataset: {}, classList: { contains: () => false }, closest: (sel) => (sel.includes('data-action') ? el : null) };
}

// ---- recording ----

const JUDGES = {
	accept: () => ({ ok: true }),
	refuse: () => ({ ok: false }),
	'keep-guides': (f) => ({ ok: false, keep: f.guides }),
};

// `withHarness(h)`: called with the harness before the board is seeded -- for a test that watches the commits as they pass (V-d)
export function record(scenario, { withHarness = null } = {}) {
	const realNow = Date.now, realRandom = Math.random;
	Date.now = () => 1790000000000;
	/*
	P7 X-a (H18.37): the random ids pinned too, by a sequence seeded from the scenario's id. A pipe's id and the order of its ends
	follow its anchors' hex (network/pipe-kind.mjs), so with random ids two runs of one scenario recorded its pipes in different
	orders, and the record was not a function of behaviour.
	*/
	let state = [...scenario.id].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 2166136261);
	Math.random = () => { state = (state + 0x6d2b79f5) >>> 0; let t = state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
	const judged = [];
	const judge = scenario.judge ? (facts) => { judged.push(facts); return JUDGES[scenario.judge](facts); } : null;
	const h = makeInput(judge ? { routeHook: judge } : {});
	const out = { claims: [], threw: [], commits: h.commits, judged };
	withHarness?.(h);
	try {
		const ids = seed(h, scenario.board);
		let lastLink = null;
		scenario.steps.forEach((step, i) => {
			const [op, ...a] = step;
			const run = (fn) => { try { fn(); } catch (e) { out.threw.push({ step: i, message: e.message }); } };
			const on = (o) => (o === 'last' ? h.selection.list()[0] : o);
			if (op === 'down' || op === 'move' || op === 'up' || op === 'dbl') {
				const [x, y, target, mods] = a;
				const ev = target && target.action ? Object.assign(pointerEvent(ids, x, y, null, mods), { target: actionTarget(target) }) : pointerEvent(ids, x, y, on(target), mods);
				const method = { down: 'onDown', move: 'onMove', up: 'onUp', dbl: 'onDblClick' }[op];
				run(() => h.capture[method](ev));   // through capture, as a browser's events arrive (L0)
				out.claims.push(ev.claimed > 0);
			} else if (op === 'key' || op === 'keyup') {
				const ev = keyEvent(a[0], a[1]);
				run(() => h.capture[op === 'key' ? 'onKeyDown' : 'onKeyUp'](ev));
				out.claims.push(ev.claimed > 0);
			} else if (op === 'cancel') run(() => h.capture.onCancel(pointerEvent(ids, 0, 0, null, { up: true })));
			else if (op === 'select') h.selection.set(a[0].map((x) => ids[x]));
			else if (op === 'selectLast') h.selection.set([lastLink]);
			else if (op === 'link') { const l = h.model.makeLink(ids[a[0]], ids[a[1]]); h.model.put('link', l); lastLink = l.id; }
			else if (op === 'hand') h.tools.setHand(a[0]);
			else if (op === 'readOnly') h.input.setReadOnly(true);
			else if (op === 'mode') h.renderer.mode = a[0];
			else if (op === 'at') run(() => h.capture.onMove(pointerEvent(ids, a[0], a[1], null, { up: true })));
			else throw new Error(`corpus: unknown step ${op}`);
		});
		h.history.flush?.();
		// what the gesture SENT, its intent (V-d): what the tab applied for each is the tab's own, and shows in `final`
		out.commits = h.commits.map(({ applied, ...request }) => request);
		const doc = h.model.toJSON();
		out.said = h.calls.filter((c) => c.name === 'readout.flash').map((c) => c.args[0]);
		out.editor = h.calls.filter((c) => c.name.startsWith('labels.')).map((c) => [c.name, ...c.args.filter((x) => typeof x !== 'object')]);
		out.palette = h.calls.filter((c) => c.name === 'tools.setHand' || c.name === 'tools.setTextTool').map((c) => [c.name, ...c.args]);
		out.host = h.dispatched.map((e) => [e.type, e.detail ?? null]);
		// the record keeps the two words a reader of it uses -- typed nodes and waypoints -- though one kind stores both (F-c)
		out.final = { nodes: doc.nodes.filter((n) => n.type), waypoints: doc.nodes.filter((n) => !n.type), links: doc.links, zones: doc.zones, groups: doc.groups, selection: h.selection.list() };
	} finally {
		h.history.flush?.();
		h.restore();
		Date.now = realNow;
		Math.random = realRandom;
	}
	return canonical(out);
}

// ids by kind and first appearance, so a record is a function of behaviour, not of the random ids a run minted
export function canonical(value, { typed = new Set() } = {}) {
	const text = JSON.stringify(value);
	const seen = new Map(), count = {};
	// F-c: a waypoint is a node with no type, so its id says `node`; it is still named `waypoint#n` here, read off any entity
	// in the record that carries a place and no type, or listed where a drag lists the waypoints it placed, pinned, guided
	// through or bent at -- so the record names what was drawn. `typed`, the ids a caller knows are typed nodes: since H19.10 a
	// link may be pinned through a router, so a `via` lists devices too, and a record that can say which is named truly
	const bare = new Set();
	const WAYPOINT_LISTS = ['placed', 'pins', 'guides', 'via'];
	const find = (v) => {
		if (Array.isArray(v)) return v.forEach(find);
		if (!v || typeof v !== 'object') return;
		if (typeof v.id === 'string' && v.id.startsWith('node-') && 'x' in v && !('type' in v)) bare.add(v.id);
		for (const k of WAYPOINT_LISTS) if (Array.isArray(v[k])) for (const id of v[k]) if (typeof id === 'string' && !typed.has(id)) bare.add(id);
		Object.values(v).forEach(find);
	};
	find(value);
	// an id the record itself shows with a type is a node, wherever else it is listed (H19.10: a pin may be a device)
	const shownTyped = new Set();
	const findTyped = (v) => {
		if (Array.isArray(v)) return v.forEach(findTyped);
		if (!v || typeof v !== 'object') return;
		if (typeof v.id === 'string' && v.id.startsWith('node-') && typeof v.type === 'string') shownTyped.add(v.id);
		Object.values(v).forEach(findTyped);
	};
	findTyped(value);
	for (const id of shownTyped) bare.delete(id);
	const name = (id, stored) => {
		const kind = bare.has(id) ? 'waypoint' : stored;
		if (!seen.has(id)) { count[kind] = (count[kind] ?? 0) + 1; seen.set(id, `${kind}#${count[kind]}`); }
		return seen.get(id);
	};
	// P7 X-a: a pipe's id is its two ends' hex (network/pipe-kind.mjs), so it is named by its ends' names, in one pass with them
	return JSON.parse(text.replace(/\bpipe-([0-9a-f]{6})-([0-9a-f]{6})\b|\b(node|waypoint|link|zone|group)-[0-9a-f]{6}\b/g, (id, lo, hi, stored) => (
		lo ? `pipe(${name(`node-${lo}`, 'node')},${name(`node-${hi}`, 'node')})` : name(id, stored))));
}

export const readGolden = () => JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1] && process.argv[2] === '--write') {
	const golden = Object.fromEntries(SCENARIOS.map((s) => [s.id, record(s)]));
	fs.writeFileSync(GOLDEN, `${JSON.stringify(golden, null, '\t')}\n`);
	console.log(`gesture corpus: wrote ${SCENARIOS.length} scenarios to ${GOLDEN.pathname}`);
}
