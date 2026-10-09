/*
POINTER BINDINGS ON THE RULES ENGINE -- stage 4 of the gesture system (dev/design/input/GESTURE-SYSTEM.md, section 9).

Which gesture a press starts was `RECOGNIZE`, an ordered table resolved by FIRST MATCH and filtered by read-only: 14
pairs of its rows could match the same press, and the order decided. It is now rows of the Rules engine, like the
keys, and no row wins by position (Q3). The read-only filter was load-bearing -- a locked click on a node falls past
`link` to `press` and still selects -- so the locked fallbacks are rows of their own, admitted only while writes are
refused: a GUARD, since a condition may not test authority (RULES I5).

BEHAVIOUR IS UNCHANGED, proven the strong way: the old table and its resolver are copied below as an oracle, and for
every hit, button, modifier set, held tool and read-only state the engine must start the same gesture.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RECOGNIZE, DOUBLE_CLICKS } from '../app/src/recognize.js';
import { PRODUCT_CANVAS } from '../product/canvas.mjs';
import { KEY_RELEASES } from '../app/src/keymap.js';
import { RUN_PRESSES } from '../app/src/run-mode.js';
import { composeRules, resolveInput, overlapsIn } from '../kernel/input-rules.mjs';
import { makeInput, key } from './fixtures/client-harness.mjs';

// ---- the oracle: app/src/recognize.js at 1900fef, rows and resolver as they were ----
const L = (e) => e.button === 0;
const R = (e) => e.button === 2;
const entity = (h) => h.kind === 'node' || h.kind === 'zone' || h.kind === 'link';
const selectable = (h) => entity(h) || h.kind === 'waypoint';
const OLD = [
	{ id: 'tool',      mutates: true,  when: (h, e, c) => L(e) && !!c.tool,                        gesture: 'textbox' },
	{ id: 'chord',     mutates: true,  when: (h, e) => R(e) && e.altKey && h.id && h.kind !== 'handle', run: 'deleteUnderCursor' },
	{ id: 'r-clone',   mutates: true,  when: (h, e) => R(e) && e.ctrlKey && (h.kind === 'node' || h.kind === 'zone' || h.kind === 'waypoint'), gesture: 'clone-pending' },
	{ id: 'r-press',   mutates: false, when: (h, e) => R(e) && (h.kind === 'node' || h.kind === 'zone' || h.kind === 'waypoint'), gesture: 'pending' },
	{ id: 'resize',    mutates: true,  when: (h, e) => L(e) && h.kind === 'handle',                gesture: 'resize' },
	{ id: 'replug',    mutates: true,  when: (h, e) => L(e) && h.kind === 'lhandle',               gesture: 'replug' },
	{ id: 'l-clone',   mutates: true,  when: (h, e) => L(e) && e.ctrlKey && entity(h),             gesture: 'clone-pending' },
	{ id: 'link',      mutates: true,  when: (h, e) => L(e) && (h.kind === 'node' || h.kind === 'waypoint'), gesture: 'link' },
	{ id: 'zone-draw', mutates: true,  when: (h, e) => L(e) && h.kind === 'canvas' && e.shiftKey, gesture: 'zone' },
	{ id: 'press',     mutates: false, when: (h, e) => L(e) && selectable(h),                     gesture: 'pending' },
	{ id: 'marquee',   mutates: false, when: (h, e) => L(e) && h.kind === 'canvas',                gesture: 'marquee' },
];
// a hit as the old table received it: a corner handle as now, a link end with its end and no id, neither flagged
const oldHit = (h) => (h.kind === 'lhandle' ? { kind: 'lhandle', end: h.id } : h.handle ? { kind: h.kind, id: h.id } : h);
function oldResolve(hit, evt, ctx) {
	for (const r of OLD) {
		if (r.mutates && ctx.readOnly) continue;
		if (r.when(hit, evt, ctx)) return r;
	}
	return null;
}
// RESTATED at C-d step one (H19.32): the zone's draw is the zones plugin's row over the shared box gesture, its release the row's own: a box placed for zones is what the old table called the zone gesture
// RESTATED at C-d step two (H19.32): a handle's press opens the shared handle gesture from the declaring plugin's row -- named, as the old table named the gesture, by the row's id (resize, replug)
// RESTATED at C-d step three: the text box is the devices plugin's row over the box gesture too -- each shared gesture's row named
// by the gesture the old table started
const OLD_NAME = { 'zone-draw': 'zone', tool: 'textbox', resize: 'resize', replug: 'replug' };
const outcome = (r) => (r ? (r.gesture ? `gesture:${OLD_NAME[r.id] ?? r.gesture}` : `run:${r.run}`) : 'nothing');

// ---- every press worth distinguishing ----
const HITS = [{ kind: 'canvas', id: null }, { kind: 'node', id: 'node-000001' }, { kind: 'waypoint', id: 'node-e00001' },
	{ kind: 'zone', id: 'zone-000001' }, { kind: 'link', id: 'link-000001' }, { kind: 'handle', id: 'se', handle: true }, { kind: 'lhandle', id: 'src', handle: true }];   // C-d: a handle's hit carries the handle as its id, flagged
const MODSETS = [];
for (const shiftKey of [false, true]) for (const ctrlKey of [false, true]) for (const altKey of [false, true]) MODSETS.push({ shiftKey, ctrlKey, altKey, metaKey: false });
const PRESSES = HITS.flatMap((on) => [0, 1, 2].flatMap((button) => MODSETS.map((m) => ({ type: 'down', button, on, ...m }))));
const SITUATIONS = [{ tool: false }, { tool: true }];
const GUARDS = [{ readOnly: false }, { readOnly: true }];
// the press rows as the page composes them: the product's and each canvas part's (C-d)
const PRESS_TABLE = composeRules({ owner: 'product', rules: RECOGNIZE }, ...PRODUCT_CANVAS.map((p) => ({ owner: p.owner, rules: p.presses ?? [] })));

/*
ONE STATE IS UNREACHABLE, and is left out rather than given rows: a tool held on a locked client. Locking releases a held
tool, and a locked client cannot arm one (B42, B18 -- the next test drives both through the product). The old table
answered it by falling through; no rows here stand for a state the product cannot be in (A11).
*/
const reachable = (g, s) => !(g.readOnly && s.tool);

test('a tool is never held on a locked client: locking releases it, and a locked client cannot arm one', () => {
	const h = makeInput();
	try {
		h.capture.onKeyDown(key('t'));
		assert.equal(h.tools.textTool, true, 'armed while writes are allowed');
		h.input.setReadOnly(true);
		assert.equal(h.tools.textTool, false, 'released by the lock (B42)');
		h.capture.onKeyDown(key('t'));
		assert.equal(h.tools.textTool, false, 'and not armable while locked (B18)');
	} finally { h.restore(); }
});

test('the pointer table starts exactly the gesture the old ordered table did, for every press, tool and lock', () => {
	const differ = [];
	for (const g of GUARDS) for (const s of SITUATIONS) for (const e of PRESSES) {
		if (!reachable(g, s)) continue;
		// CORRECTED at B316: the old table saw a link end's hit with no id ({ kind: 'lhandle', end }) -- C-d step two gave the old side
		// the new shape, and so hid that the delete chord came to match a link end's handle
		const was = outcome(oldResolve(oldHit(e.on), e, { readOnly: g.readOnly, tool: s.tool }));
		const now = outcome(resolveInput(PRESS_TABLE, e, s, g).rule);
		if (was !== now) differ.push(`${JSON.stringify(g)} tool=${s.tool} ${e.on.kind} b${e.button} ${JSON.stringify({ s: e.shiftKey, c: e.ctrlKey, a: e.altKey })}: ${now}, was ${was}`);
	}
	assert.equal(PRESSES.length, 168, '7 hits x 3 buttons x 8 modifier sets, in each of 3 reachable tool and lock states');
	assert.deepEqual(differ, []);
});

test('Q3: no press matches two pointer rows, in any tool or lock state -- the 14 overlapping pairs are gone', () => {
	const found = overlapsIn(PRESS_TABLE, PRESSES, SITUATIONS, GUARDS).map((o) => `${JSON.stringify(o.guards)} ${o.input.on.kind} b${o.input.button} -> ${o.ids.join('/')}`);
	assert.deepEqual(found, []);
	let pairs = 0;
	for (let i = 0; i < OLD.length; i++) for (let j = i + 1; j < OLD.length; j++) {
		if (PRESSES.some((e) => [false, true].some((tool) => OLD[i].when(e.on, e, { tool }) && OLD[j].when(e.on, e, { tool })))) pairs++;
	}
	assert.equal(pairs, 14, 'the old table had 14 pairs a single press could match');
});

test('the locked fallbacks are admitted only while writes are refused: a guard, not a condition', () => {
	const locked = RECOGNIZE.filter((r) => r.whileReadOnly);
	assert.deepEqual(locked.map((r) => r.id).sort(), ['marquee-locked', 'press-locked', 'r-press-locked']);
	for (const r of locked) assert.equal(r.mutates, false, `${r.id}: a locked client may only select`);
	for (const r of RECOGNIZE) assert.doesNotMatch(String(r.when ?? ''), /readOnly/, `${r.id}: a condition never tests authority (RULES I5)`);
});

test('a double click is a binding: it edits a label, and a locked client does not', () => {
	const t = composeRules({ owner: 'product', rules: DOUBLE_CLICKS });
	assert.equal(resolveInput(t, { type: 'double' }, {}, { readOnly: false }).rule.id, 'edit-label');
	assert.equal(resolveInput(t, { type: 'double' }, {}, { readOnly: true }).rule, null, 'refused by the guard, not by the handler');
});

test('key releases are bindings, and each key release matches one row', () => {
	const t = composeRules({ owner: 'product', rules: KEY_RELEASES });
	const ids = (k) => resolveInput(t, { type: 'key-up', key: k }, {}, {}).rule?.id ?? null;
	assert.equal(ids('Shift'), 'shift-up');
	assert.equal(ids('Alt'), 'arming-up');
	assert.equal(ids('Control'), 'arming-up');
	assert.equal(ids('a'), null);
});

test('run mode\'s presses are rows too, and no run-mode press matches two of them, locked or not', () => {
	const t = composeRules({ owner: 'product', rules: RUN_PRESSES });
	const region = (o) => ({ waypoint: null, overWaypoint: false, action: null, input: null, node: null, control: false, entity: false, ...o });
	const presses = [region({}), region({ waypoint: 'node-e00001', overWaypoint: true }), region({ action: 'help', control: true }),
		region({ input: 0, node: 'node-000001', control: true, entity: true }), region({ entity: true }), null]
		.flatMap((r) => [0, 2].map((button) => ({ type: 'down', button, region: r, on: { kind: 'canvas' } })));
	const endpoint = { mode: 'run', target: { kind: 'waypoint', id: 'node-e00001', roles: ['endpoint'] } };
	const bend = { mode: 'run', target: { kind: 'waypoint', id: 'node-e00001', roles: [] } };
	const ground = { mode: 'run', target: null };
	assert.deepEqual(overlapsIn(t, presses, [endpoint, bend, ground], GUARDS), []);
	const id = (r, s, g) => resolveInput(t, { type: 'down', button: 0, region: r }, s, g).rule?.id ?? null;
	assert.equal(id(region({ action: 'help', control: true }), ground, { readOnly: true }), 'fire-action', 'an action fires on a locked client: it commits nothing');
	assert.equal(id(region({ waypoint: 'node-e00001', overWaypoint: true }), endpoint, { readOnly: true }), null, 'arming is refused by the guard');
	assert.equal(id(region({}), ground, { readOnly: true }), null, 'so is placing a tower');
});

