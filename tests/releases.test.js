/*
WHAT A GESTURE MEANS WHEN IT ENDS -- stage 5 of the gesture system (dev/design/input/GESTURE-SYSTEM.md, section 9).

The release handlers decided in `if`s; now each gesture hands its facts to the Rules engine, a row of app/src/releases.js
says what they mean, and a named action on Input does it. Behaviour is unchanged, proven the strong way: each old
decision is copied below as an oracle, and for every combination of the facts a row reads, the rows choose the same
outcome.

Also held here: acceptance test 3 (no meaning left in the release slots or the actions), test 4 (read-only is the
engine's guard and nothing else's), and test 6 (B245 -- a cancelled drag keeps a waypoint's pin).
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LINK_RELEASES, MARQUEE_RELEASES, CTRL_CLICKS, REPLUG_RELEASES, ZONE_RELEASES, PRESS_DRAGS, CLONE_DRAGS } from '../app/src/releases.js';
import { composeRules, resolveInput, overlapsIn } from '../kernel/input-rules.mjs';
import { makeInput, key, pointer, seedNodes } from './fixtures/client-harness.mjs';
import { makeWaypoint } from '../devices/make-node.mjs';   // O-e1: the devices plugin's factories

const table = (rules) => composeRules({ owner: 'product', rules });
const UP = { type: 'up' };
const choose = (t, facts, readOnly = false) => resolveInput(t, UP, facts, { readOnly }).rule?.run ?? 'nothing';

// every combination of the named boolean facts, with extra fields fixed
function combos(names, extra = {}) {
	const out = [];
	for (let n = 0; n < 2 ** names.length; n++) out.push(Object.fromEntries([...names.map((k, i) => [k, !!(n & (1 << i))]), ...Object.entries(extra)]));
	return out;
}

// ---- the link release ----

// the oracle: app/src/input.js's link release at 72c502c, its decisions in order
function oldLink(r) {
	if (r.dst && r.srcAlive && !r.dstIsSrc && (r.admitted || (r.judged && !r.shift))) {
		return r.validTarget && r.shift && !r.hasVia ? 'commitDrawnLinkAndChain' : 'commitDrawnLink';
	}
	if (r.validTarget && r.shift && !r.hasVia) return 'chainOnFromTarget';
	if (r.srcAlive && !r.hasVia && r.click && r.atStart) {
		if (r.srcIsNode && r.hand && r.hand !== 'waypoint' && !r.chained && !r.shift && !r.ctrl && !r.alt && !r.handIsSrcType) return 'retypeClicked';
		if (r.pressShift) return 'toggleClicked';
		return r.srcSelected ? 'focusClicked' : 'selectClicked';
	}
	return 'discardDrawnLink';
}
const LINK_FACTS = ['dst', 'dstIsSrc', 'srcAlive', 'validTarget', 'hasVia', 'admitted', 'judged', 'click', 'atStart',
	'shift', 'ctrl', 'alt', 'pressShift', 'srcIsNode', 'handIsSrcType', 'chained', 'srcSelected'];

test('the link release chooses what the old handler did, for every combination of its facts', () => {
	const t = table(LINK_RELEASES);
	let n = 0;
	const differ = [];
	for (const hand of [null, 'router', 'waypoint']) for (const r of combos(LINK_FACTS, { hand })) {
		n++;
		const was = oldLink(r), now = choose(t, r);
		if (was !== now && differ.length < 5) differ.push(`${JSON.stringify(r)}: ${now}, was ${was}`);
	}
	assert.equal(n, 2 ** 17 * 3);
	assert.deepEqual(differ, []);
});

test('the link release is complete and disjoint: every case is exactly one row, since the old handler always did something', () => {
	const t = table(LINK_RELEASES);
	const cases = combos(LINK_FACTS, { hand: 'router' });
	assert.deepEqual(overlapsIn(t, [UP], cases, [{}]), []);
	assert.equal(cases.filter((r) => choose(t, r) === 'nothing').length, 0);
});

// ---- the marquee release ----

function oldMarquee(r) {
	if (r.click) {
		if (r.hand && !r.shift && !r.ctrl && !r.alt) return 'stampClicked';
		return r.shift ? 'nothing' : 'clearOnClick';
	}
	return r.shift ? 'addInBox' : 'selectInBox';
}

test('the marquee release chooses what the old handler did, for every combination of its facts', () => {
	const t = table(MARQUEE_RELEASES);
	const cases = combos(['click', 'hand', 'shift', 'ctrl', 'alt']);
	assert.deepEqual(cases.filter((r) => choose(t, r) !== oldMarquee(r)).map((r) => JSON.stringify(r)), []);
	assert.deepEqual(overlapsIn(t, [UP], cases, [{}]), []);
});

// ---- the smaller ones ----

test('a Ctrl+click toggles what it pressed while that still exists; a replug retargets only where the pair has room; a zone needs area', () => {
	assert.equal(choose(table(CTRL_CLICKS), { exists: true }), 'toggleCtrlClicked');
	assert.equal(choose(table(CTRL_CLICKS), { exists: false }), 'nothing');
	for (const r of combos(['retargets', 'admitted'])) assert.equal(choose(table(REPLUG_RELEASES), r), r.retargets && r.admitted ? 'replugTo' : 'nothing');
	assert.equal(choose(table(ZONE_RELEASES), { area: true }), 'createZoneFrom');
	assert.equal(choose(table(ZONE_RELEASES), { area: false }), 'nothing');
});

test('a press becomes a move except on a link, on a left press on a waypoint (B203), or on a locked client -- by the guard', () => {
	const t = table(PRESS_DRAGS);
	const MOVE = { type: 'move' };
	for (const r of combos(['onLink', 'onWaypoint', 'leftPress'])) {
		const want = !r.onLink && !(r.onWaypoint && r.leftPress) ? 'startMove' : 'nothing';
		assert.equal(resolveInput(t, MOVE, r, { readOnly: false }).rule?.run ?? 'nothing', want, JSON.stringify(r));
		assert.equal(resolveInput(t, MOVE, r, { readOnly: true }).rule, null, 'a locked press never becomes a drag');
	}
	assert.equal(resolveInput(table(CLONE_DRAGS), MOVE, {}, { readOnly: false }).rule.run, 'startClone');
});

// ---- acceptance test 3: the release slots hand over facts, and the actions decide nothing ----

const INPUT_SRC = fs.readFileSync(new URL('../app/src/input.js', import.meta.url), 'utf8');
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const method = (name) => { const i = INPUT_SRC.indexOf(`\n\t${name}(`); assert.ok(i > 0, `${name} is a method of Input`); return code(INPUT_SRC.slice(i, INPUT_SRC.indexOf('\n\t}', i))); };

/*
The release actions only. `startMove` and `startClone` -- what a drag becomes -- are lifecycle as much as action: they
gather what moves, or clone what was grabbed (selecting it first when it was not selected), and that logic is unchanged
by this stage; the rows decide WHETHER a drag becomes one, which is the meaning that moved.
*/
test('acceptance 3: every release a table decides names an action that exists, and the actions read no situation', () => {
	for (const r of [PRESS_DRAGS, CLONE_DRAGS].flat()) assert.equal(typeof method(r.run), 'string');
	const rows = [LINK_RELEASES, MARQUEE_RELEASES, CTRL_CLICKS, REPLUG_RELEASES, ZONE_RELEASES].flat();
	for (const r of rows) {
		const body = method(r.run);
		assert.doesNotMatch(body, /\bevt\b|shiftKey|ctrlKey|altKey|\.trigger\b|selection\.has|state\.chained|readOnly/, `${r.run} decides nothing -- its row did`);
	}
});

test('acceptance 3: the link, marquee, Ctrl+click, replug and zone releases commit nothing and select nothing themselves', () => {
	const slots = code(INPUT_SRC.slice(INPUT_SRC.indexOf('const GESTURES = {'), INPUT_SRC.indexOf('\n};', INPUT_SRC.indexOf('const GESTURES = {'))));
	for (const name of ['link', "'clone-pending'", 'replug', 'zone', 'marquee']) {
		const at = slots.indexOf(`\t${name}: {`);
		const commit = slots.slice(slots.indexOf('commit:', at), slots.indexOf('cancel:', at) > 0 && slots.indexOf('cancel:', at) < slots.indexOf('\t},', at) ? slots.indexOf('cancel:', at) : slots.indexOf('update:', at));
		assert.match(commit, /i\.decide\(/, `${name}: its release asks the engine`);
		assert.doesNotMatch(commit, /history\.commit|selection\.(set|toggle|add|clear)/, `${name}: its release performs nothing itself`);
	}
});

// ---- acceptance test 4: read-only is the engine's guard ----

test('acceptance 4: the input layers test read-only nowhere but the engine\'s guard -- and the lock itself', () => {
	// K7: the lock is told to the held tools (`tools.readOnly = on`), which the palette reads; the palette is not Input's
	const lines = code(INPUT_SRC).split('\n').filter((l) => /readOnly/.test(l));
	const allowed = /readOnly: this\.readOnly|this\.readOnly = (false|on)|this\.readOnly === on|tools\.readOnly = on|textTool: false, readOnly: false,|\{ readOnly = false|readOnly: this\.readOnly,/;
	assert.deepEqual(lines.filter((l) => !allowed.test(l)).map((l) => l.trim()), []);
});

test('acceptance 4: a locked client\'s drag from a node does not become a move', () => {
	const h = makeInput({ readOnly: true });
	try {
		const [n] = seedNodes(h.model, [[0, 0]]);
		const on = (x, y, m = {}) => pointer(x, y, { button: 2, ...m, target: { tagName: 'g', classList: { contains: () => false }, dataset: {}, closest: (s) => (s.includes('node') ? { id: n.id } : null) } });
		h.capture.onDown(on(0, 0)); h.capture.onMove(on(120, 60)); h.capture.onUp(on(120, 60, { buttons: 0 }));
		assert.deepEqual([h.model.get('node', n.id).x, h.commits.length], [0, 0]);
	} finally { h.restore(); }
});

// ---- acceptance test 6: B245 ----
// AMENDED 2026-10-04 (S-d, H18.14): `pinned` is retired, so threading a free waypoint has no pin to clear -- the drag commits the
// link and nothing else, and a cancelled drag commits nothing. B245's unpin entry went with the field.

test('acceptance 6, B245: threading a free waypoint commits the link alone, and a cancelled drag commits nothing', () => {
	const drive = (finish) => {
		const h = makeInput();
		const [a, b] = seedNodes(h.model, [[0, 0], [360, 0]]);
		const w = makeWaypoint(h.model, { x: 180, y: 120 });
		h.model.put('node', w);
		const over = (id, x, y) => pointer(x, y, { target: { tagName: 'g', classList: { contains: () => false }, dataset: {}, closest: (s) => (s.includes(id.split('-')[0]) ? { id } : null) } });
		h.capture.onDown(over(a.id, 0, 0)); h.capture.onMove(over(w.id, 180, 120)); h.capture.onKeyDown(key('w'));
		finish(h, over, b);
		return { h, w };
	};
	const done = drive((h, over, b) => { h.capture.onMove(over(b.id, 360, 0)); h.capture.onUp(over(b.id, 360, 0)); });
	try {
		assert.equal(done.h.commits.length, 1);
		// AMENDED 2026-10-04 (P7 X-a): the page's drag judge lays the link's pipes into each stop, in the same commit (N-c)
		assert.deepEqual(done.h.commits[0].ops.map((o) => `${o.op}/${o.kind}`), ['put/link', 'put/pipe', 'put/pipe'], 'the link, threaded through the waypoint, its pipes, and no set');
		assert.deepEqual(done.h.commits[0].ops[0].entity.via, [done.w.id]);
		assert.equal('pinned' in done.h.model.get('node', done.w.id), false);
	} finally { done.h.restore(); }
	const cancelled = drive((h) => h.capture.onKeyDown(key('Escape')));
	try {
		assert.equal(cancelled.h.commits.length, 0, 'nothing was committed');
	} finally { cancelled.h.restore(); }
});
