/*
THE RULES ENGINE -- kernel/input-rules.mjs, step T3 of the ruleset audit (dev/RULES.md section 11).

A neutral core with tenants (P4): the engine owns the mechanism -- joining tenants' rows, applying the guards, finding
the one row an input means in a situation -- and names nothing any tenant is about. The product brings its key table;
a plugin brings its own rows. The director's rulings bind it (2026-09-30): a rule sees the selection and what the
current gesture step is on (Q1); two rows matching one situation is always a failure, never resolved by position (Q3);
the situation is plain data (Q4).

RESTATED at H26.2 (dev/design/components/INPUT-BINDING.md section 5, appendix B): kernel/input-rules.mjs is draw's adapter over
input-binding, which holds the mechanism and its own tests (IB3 to IB8). What stays here holds draw's side of it: the guards, the
claim and the field draw declares, each case below asked through the adapter as every call site asks it; the refusals at load; and
the neutrality of the adapter's text.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { composeRules, resolveInput, overlapsIn, openGestures } from '../kernel/input-rules.mjs';

const on = (k) => (e) => e.key === k;
const row = (id, key, extra = {}) => ({ id, on: on(key), run: `run-${id}`, ...extra });
const ev = (k) => ({ key: k });
const free = { readOnly: false, helpOpen: false, gesturing: false };

// RESTATED at H26.2: the table is input-binding's, its entries in `table.rows`, each naming its owner beside the declared row
test('composeRules joins tenants and names each row\'s owner', () => {
	const x = row('x', 'x'), y = row('y', 'y');
	const table = composeRules({ owner: 'a', rules: [x] }, { owner: 'b', rules: [y] });
	assert.deepEqual(table.rows.map((r) => [r.id, r.owner]), [['x', 'a'], ['y', 'b']]);
	assert.deepEqual(table.rows.map((r) => r.row), [x, y], 'the declared rows themselves, never copies');
	assert.equal(resolveInput(table, ev('x'), {}, free).rule, x, 'and the row an input means is the declared row');
});

test('composeRules refuses a duplicate id, within a tenant or across two -- the message the matcher always gave', () => {
	assert.throws(() => composeRules({ owner: 'a', rules: [row('x', 'x'), row('x', 'y')] }), { message: "input rule 'x' is brought by both a and a -- an id names one row" });
	assert.throws(() => composeRules({ owner: 'a', rules: [row('x', 'x')] }, { owner: 'b', rules: [row('x', 'z')] }), { message: "input rule 'x' is brought by both a and b -- an id names one row" });
	assert.throws(() => composeRules({ owner: 'a', rules: [row('y', 'y'), row('x', 'x')] }, { owner: 'b', rules: [row('x', 'z'), row('y', 'q')] }),
		{ message: "input rule 'x' is brought by both a and b -- an id names one row" }, 'the first twice in table order, as the matcher met it');
});

/*
H26.2 (section 6.3, inputs nothing in draw produces): a row the component's row form refuses -- an `on` that is no function, a flag
that is no boolean, a `gesture` that is no name -- is refused when the composition loads, naming where it lies, where the matcher read
a flag by its truthiness and threw at the first resolve; and a session declaration that is not one is refused the same way.
*/
test('H26.2: a malformed row is refused at load, naming its place, and so is a malformed session', () => {
	assert.throws(() => composeRules({ owner: 'a', rules: [{ id: 'x', on: 'k' }] }), { message: 'input rules refused: /tenants/0/rows/0/on invalid-value' });
	assert.throws(() => composeRules({ owner: 'a', rules: [row('x', 'x', { mutates: 1 })] }), { message: 'input rules refused: /tenants/0/rows/0/mutates invalid-value' });
	assert.throws(() => composeRules({ owner: 'a', rules: [row('x', 'x', { gesture: '' })] }), { message: 'input rules refused: /tenants/0/rows/0/gesture invalid-value' });
	assert.throws(() => openGestures({ threshold: -1, gestures: [] }), { message: 'gestures refused: /threshold invalid-value' });
	const s = openGestures({ threshold: 4, gestures: [{ name: 'g', engaged: true, button: null }] });
	assert.deepEqual(s.declaration, { threshold: 4, gestures: [{ name: 'g', engaged: true, button: null }] }, 'control: a session opened');
});

test('the guards are applied uniformly: mutating rows are skipped read-only, and help and gestures admit only rows that say so', () => {
	const table = composeRules({ owner: 'a', rules: [
		row('m', 'm'),                                   // mutates by default
		row('v', 'v', { mutates: false }),
		row('h', 'h', { mutates: false, duringHelp: true }),
		row('g', 'g', { duringGesture: true }),
	] });
	assert.equal(resolveInput(table, ev('m'), {}, { ...free, readOnly: true }).rule, null, 'a mutating row is inert read-only');
	assert.equal(resolveInput(table, ev('v'), {}, { ...free, readOnly: true }).rule.id, 'v');
	assert.equal(resolveInput(table, ev('v'), {}, { ...free, helpOpen: true }).rule, null, 'help admits only rows that say so');
	assert.equal(resolveInput(table, ev('h'), {}, { ...free, helpOpen: true }).rule.id, 'h');
	assert.equal(resolveInput(table, ev('m'), {}, { ...free, gesturing: true }).rule, null, 'a gesture admits only rows that say so');
	assert.equal(resolveInput(table, ev('g'), {}, { ...free, gesturing: true }).rule.id, 'g');
});

test('the condition picks the ONE row the input means in this situation', () => {
	const table = composeRules({ owner: 'a', rules: [
		row('yes', 'c', { when: (s) => s.ok === true }),
		row('no', 'c', { when: (s) => s.ok === false }),
	] });
	assert.equal(resolveInput(table, ev('c'), { ok: true }, free).rule.id, 'yes');
	assert.equal(resolveInput(table, ev('c'), { ok: false }, free).rule.id, 'no');
});

test('an unmatched situation means nothing (I6), and the key is still claimed: bind a key and you own it (B47)', () => {
	const table = composeRules({ owner: 'a', rules: [row('yes', 'c', { when: (s) => s.ok === true })] });
	const r = resolveInput(table, ev('c'), { ok: 'neither' }, free);
	assert.equal(r.rule, null);
	assert.equal(r.claimed, true, 'what the key means is the condition\'s to say; that it is ours is the binding\'s');
	assert.equal(resolveInput(table, ev('q'), {}, free).claimed, false, 'an unbound key is never claimed');
});

test('a row that opts out of claiming leaves the key unclaimed, and a guard that skips a row skips its claim too', () => {
	const table = composeRules({ owner: 'a', rules: [row('o', 'o', { prevent: false }), row('m', 'm')] });
	assert.equal(resolveInput(table, ev('o'), {}, free).claimed, false);
	assert.equal(resolveInput(table, ev('m'), {}, { ...free, readOnly: true }).claimed, false);
});

test('two rows matching one situation are NEVER resolved by position (Q3): nothing runs, and overlapsIn names them', () => {
	const table = composeRules({ owner: 'a', rules: [row('first', 'k')] }, { owner: 'b', rules: [row('second', 'k')] });
	assert.equal(resolveInput(table, ev('k'), {}, free).rule, null, 'neither wins by being listed first');
	const k = ev('k'), s = {};
	const found = overlapsIn(table, [k, ev('z')], [s], [free]);
	assert.equal(found.length, 1);
	assert.deepEqual(found[0].ids, ['first', 'second']);
	// H26.2: the record names the input, the situation and the guard state it was found in, each the value given (the gate prints them)
	assert.deepEqual(Object.keys(found[0]), ['input', 'situation', 'guards', 'ids']);
	assert.ok(found[0].input === k && found[0].situation === s && found[0].guards === free, 'each the value given, by reference');
	assert.deepEqual(overlapsIn(composeRules({ owner: 'a', rules: [row('only', 'k')] }), [ev('k')], [{}], [free]), []);
});

test('overlapsIn judges each situation and guard state, so rows disjoint by condition are not an overlap', () => {
	const table = composeRules({ owner: 'a', rules: [
		row('idle', 'w', { when: (s) => !s.busy, duringGesture: true }),
		row('busy', 'w', { when: (s) => s.busy, duringGesture: true }),
	] });
	assert.deepEqual(overlapsIn(table, [ev('w')], [{ busy: true }, { busy: false }], [free, { ...free, gesturing: true }]), []);
});

test('the rows are data the engine does not interpret: a run may be a name or a function a tenant supplies', () => {
	const act = () => 'acted';
	const table = composeRules({ owner: 'plugin', rules: [{ id: 'p', on: on('p'), run: act }] });
	assert.equal(resolveInput(table, ev('p'), {}, free).rule.run, act);
});

/*
NEUTRALITY, held by reading the source (P4): a core that "just adds" one tenant's word for convenience has started to
become that tenant's code. The layer scan (L5) reads identifiers; this reads everything -- comments and strings too,
where a leak begins.
*/
test('the engine names no tenant: no product or plugin vocabulary anywhere in its text', () => {
	const src = fs.readFileSync(new URL('../kernel/input-rules.mjs', import.meta.url), 'utf8');
	const TENANT = /\b(links?|nodes?|waypoints?|anchors?|pipes?|guides?|routes?|routing|network|zones?|groups?|flows?|spawn\w*|towers?|pins?|pinned|via|keymap|canvas|selection|drag\w*|close[ds]?)\b/gi;
	const found = [...new Set((src.match(TENANT) ?? []).map((w) => w.toLowerCase()))];
	assert.deepEqual(found, [], `tenant words in the core: ${found.join(', ')}`);
	assert.doesNotMatch(src, /from '\.\.\/(app|network|engine|server|model|lab)\//, 'and it imports no tenant');
	// RESTATED at H26.2: the adapter imports the component, and nothing else
	assert.deepEqual([...src.matchAll(/^import [^;]*? from '([^']+)';/gm)].map((m) => m[1]), ['@apnex/input-binding'], 'it imports input-binding alone');
});

test('a row admitted only while writes are refused: the locked fallback a writer never gets', () => {
	const table = composeRules({ owner: 'a', rules: [row('author', 'k'), row('look', 'k', { mutates: false, whileReadOnly: true })] });
	assert.equal(resolveInput(table, ev('k'), {}, free).rule.id, 'author', 'a writer gets the authoring row, and the fallback is not admitted');
	assert.equal(resolveInput(table, ev('k'), {}, { ...free, readOnly: true }).rule.id, 'look', 'a locked client gets the fallback');
	assert.deepEqual(overlapsIn(table, [ev('k')], [{}], [free, { ...free, readOnly: true }]), [], 'disjoint by the guard, in both states');
});
