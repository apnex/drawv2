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
RESTATED at H26.8's binding move (dev/design/components/NATIVE-SHAPES.md sections 3.2 and 4.3; NS11; GR6): draw composes each table in
the component's own form -- `openTable({ owner, rows }, ...)` -- and asks it directly, `table.matchInput(input, situation, guards)`, its
`match.row` the declared row, and `table.findOverlaps` at the gate, so each case below asks the table as every call site asks it; and a
refused declaration throws the component's own problems, each `<pointer> <problem>` in the component's order, where the adapter re-worded
them into the old matcher's sentences.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openTable, openGestures, TABLE_DECLARATION } from '../kernel/input-rules.mjs';

const on = (k) => (e) => e.key === k;
const row = (id, key, extra = {}) => ({ id, on: on(key), run: `run-${id}`, ...extra });
const ev = (k) => ({ key: k });
const free = { readOnly: false, helpOpen: false, gesturing: false };
// the row an input means, as every call site reads it -- `matchInput(...).match?.row` -- and null when none, as the old `rule` was
const rowOf = (table, input, situation, guards) => table.matchInput(input, situation, guards).match?.row ?? null;
const claimedBy = (table, input, situation, guards) => table.matchInput(input, situation, guards).claimed;

// RESTATED at H26.2: the table is input-binding's, its entries in `table.rows`, each naming its owner beside the declared row
test('openTable joins tenants and names each row\'s owner', () => {
	const x = row('x', 'x'), y = row('y', 'y');
	const table = openTable({ owner: 'a', rows: [x] }, { owner: 'b', rows: [y] });
	assert.deepEqual(table.rows.map((r) => [r.id, r.owner]), [['x', 'a'], ['y', 'b']]);
	assert.deepEqual(table.rows.map((r) => r.row), [x, y], 'the declared rows themselves, never copies');
	assert.equal(rowOf(table, ev('x'), {}, free), x, 'and the row an input means is the declared row');
	// H26.8 (GR6): every table carries draw's one declaration -- its guards, claim and gesture field
	assert.deepEqual([table.guards, table.claim, table.opens], [TABLE_DECLARATION.guards, TABLE_DECLARATION.claim, TABLE_DECLARATION.opens]);
});

// RESTATED at H26.8 (NS11): the component's own problem, `duplicate-id` at the later row's id, where the adapter said the matcher's sentence
// H26.8's binding move (the verifier's advisory): the declaration every table is opened with is frozen to its depth -- an importer that
// changed it would change the guards of every table opened after
test('TABLE_DECLARATION is frozen to its depth: no importer can change the guards, claim or gesture field later tables are opened with', () => {
	const all = [TABLE_DECLARATION, TABLE_DECLARATION.guards, ...TABLE_DECLARATION.guards, TABLE_DECLARATION.claim, TABLE_DECLARATION.opens];
	assert.deepEqual(all.map((v) => Object.isFrozen(v)), all.map(() => true), 'the declaration, its guards and each guard, the claim and the gesture field');
	assert.throws(() => { TABLE_DECLARATION.guards[0].default = false; }, TypeError, 'a guard cannot be changed');
	assert.throws(() => { TABLE_DECLARATION.guards.push({}); }, TypeError, 'nor a guard added');
	assert.throws(() => { TABLE_DECLARATION.claim.default = false; }, TypeError, 'nor the claim changed');
	const table = openTable({ owner: 'a', rows: [row('m', 'm')] });
	assert.equal(rowOf(table, ev('m'), {}, { ...free, readOnly: true }), null, 'and a table opened after still refuses a mutating row read-only');
});

test('openTable refuses a duplicate id, within a tenant or across two -- the component\'s problem at the later row', () => {
	assert.throws(() => openTable({ owner: 'a', rows: [row('x', 'x'), row('x', 'y')] }), { message: 'input rules refused: /tenants/0/rows/1/id duplicate-id' });
	assert.throws(() => openTable({ owner: 'a', rows: [row('x', 'x')] }, { owner: 'b', rows: [row('x', 'z')] }), { message: 'input rules refused: /tenants/1/rows/0/id duplicate-id' });
	// RESTATED at H26.2's verification (F5): every problem is listed -- RESTATED at H26.8: in the component's order, each at its own pointer
	assert.throws(() => openTable({ owner: 'a', rows: [row('y', 'y'), row('x', 'x')] }, { owner: 'b', rows: [row('x', 'z'), row('y', 'q')] }),
		{ message: 'input rules refused: /tenants/1/rows/0/id duplicate-id, /tenants/1/rows/1/id duplicate-id' },
		'each later twin at its own id, in the component\'s order');
});

/*
H26.2 (section 6.3, inputs nothing in draw produces): a row the component's row form refuses -- an `on` that is no function, a flag
that is no boolean, a `gesture` that is no name -- is refused when the composition loads, naming where it lies, where the matcher read
a flag by its truthiness and threw at the first resolve; and a session declaration that is not one is refused the same way.
RESTATED at H26.2's verification (F5): named as draw names it -- the owner and the row's id, or its place when it has none -- and
every problem listed, never the component's pointer alone.
RESTATED at H26.8 (NS11): named as the component names it, its pointer and its problem, every problem listed.
*/
test('H26.2: a malformed row is refused at load, naming where it lies -- the component\'s pointer and problem -- and so is a malformed session', () => {
	assert.throws(() => openTable({ owner: 'a', rows: [{ id: 'x', on: 'k' }] }), { message: 'input rules refused: /tenants/0/rows/0/on invalid-value' });
	assert.throws(() => openTable({ owner: 'a', rows: [row('x', 'x', { mutates: 1 })] }), { message: 'input rules refused: /tenants/0/rows/0/mutates invalid-value' });
	assert.throws(() => openTable({ owner: 'a', rows: [row('x', 'x', { gesture: '' })] }), { message: 'input rules refused: /tenants/0/rows/0/gesture invalid-value' });
	assert.throws(() => openGestures({ threshold: -1, gestures: [] }), { message: 'gestures refused: /threshold invalid-value' });
	const s = openGestures({ threshold: 4, gestures: [{ name: 'g', engaged: true, button: null }] });
	assert.deepEqual(s.declaration, { threshold: 4, gestures: [{ name: 'g', engaged: true, button: null }] }, 'control: a session opened');
});

// RESTATED at H26.8 (NS11): every problem, each at the component's pointer, in the component's order -- by pointer, then by problem
test('F5: every problem is named, each at its pointer, in the component\'s order -- a duplicate among the rest, where it falls', () => {
	assert.throws(() => openTable({ owner: 'a', rows: [{ id: 'x', on: 'k' }, { on: () => true }] }, { owner: 'b', rows: [row('y', 'y', { duringHelp: 'yes' }), 5] }),
		{ message: 'input rules refused: /tenants/0/rows/0/on invalid-value, /tenants/0/rows/1/id missing-property, /tenants/1/rows/0/duringHelp invalid-value, /tenants/1/rows/1 not-an-object' });
	assert.throws(() => openTable({ owner: 'a', rows: [row('x', 'x')] }, { owner: 'b', rows: [{ id: 'w', on: 3 }, row('x', 'z')] }),
		{ message: 'input rules refused: /tenants/1/rows/0/on invalid-value, /tenants/1/rows/1/id duplicate-id' }, 'a duplicate in its place among the rest');
	let reads = 0;
	const getter = { on: () => true };
	Object.defineProperty(getter, 'id', { get() { reads++; return 'sneaky'; }, enumerable: true });
	assert.throws(() => openTable({ owner: 'a', rows: [getter] }), { message: 'input rules refused: /tenants/0/rows/0/id invalid-value' }, 'an id it cannot read without running code, refused');
	assert.equal(reads, 0, 'and naming the refusal ran no getter');
	const rows = Array.from({ length: 12 }, (_, n) => row(`r${n}`, 'k'));
	rows[2] = { id: 'r2', on: 2 }; rows[10] = { id: 'r10', on: 10 };
	assert.throws(() => openTable({ owner: 'a', rows }), { message: 'input rules refused: /tenants/0/rows/10/on invalid-value, /tenants/0/rows/2/on invalid-value' },
		'in the component\'s order -- its pointers compared by code unit, the tenth row before the second (input-binding IB3)');
	assert.throws(() => openTable({ owner: 'a', rows: [row('x', 'x')] }, { owner: 'b', rows: [row('x', 'y')] }, { owner: 'c', rows: [row('x', 'z')] }),
		{ message: 'input rules refused: /tenants/1/rows/0/id duplicate-id, /tenants/2/rows/0/id duplicate-id' }, 'each later twin named at its own id');
});

/*
F2 (c) (H26.2's verification): a tenant's own form -- an owner that is no name, rules that are no dense list -- is refused at load as
a row's is, naming the tenant; two tenants may share an owner.
RESTATED at H26.8 (NS11): the component's tenant form, `{ owner, rows }`, its problems its own -- an owner missing is `missing-property`,
where the adapter, renaming `rules` to `rows`, handed it present and undefined; and a tenant in the retired form, `rules`, is refused.
*/
test('F2: a tenant whose owner is no name, or whose rows are no dense list of rows alone, is refused at load', () => {
	assert.throws(() => openTable({ owner: '', rows: [row('x', 'x')] }), { message: 'input rules refused: /tenants/0/owner invalid-value' });
	assert.throws(() => openTable({ owner: 'a', rows: [] }, { rows: [row('x', 'x')] }), { message: 'input rules refused: /tenants/1/owner missing-property' }, 'an owner missing');
	assert.throws(() => openTable({ owner: 'a', rows: [row('x', 'x'), , row('y', 'y')] }), { message: 'input rules refused: /tenants/0/rows invalid-value' }, 'a sparse list');   // eslint-disable-line no-sparse-arrays
	assert.throws(() => openTable({ owner: 'a', rows: Object.assign([row('x', 'x')], { extra: 1 }) }), { message: 'input rules refused: /tenants/0/rows invalid-value' }, 'a list with another property');
	assert.throws(() => openTable({ owner: 'a', rows: 'x' }), { message: 'input rules refused: /tenants/0/rows invalid-value' }, 'rows that are no list');
	assert.throws(() => openTable({ owner: 'a', rules: [row('x', 'x')] }), { message: 'input rules refused: /tenants/0/rows missing-property, /tenants/0/rules unknown-property' }, 'a tenant in the retired form');
	assert.deepEqual(openTable({ owner: 'a', rows: [row('x', 'x')] }, { owner: 'a', rows: [row('y', 'y')] }).rows.map((r) => `${r.owner}:${r.id}`), ['a:x', 'a:y'], 'control: two tenants may share an owner');
});

test('the guards are applied uniformly: mutating rows are skipped read-only, and help and gestures admit only rows that say so', () => {
	const table = openTable({ owner: 'a', rows: [
		row('m', 'm'),                                   // mutates by default
		row('v', 'v', { mutates: false }),
		row('h', 'h', { mutates: false, duringHelp: true }),
		row('g', 'g', { duringGesture: true }),
	] });
	assert.equal(rowOf(table, ev('m'), {}, { ...free, readOnly: true }), null, 'a mutating row is inert read-only');
	assert.equal(rowOf(table, ev('v'), {}, { ...free, readOnly: true }).id, 'v');
	assert.equal(rowOf(table, ev('v'), {}, { ...free, helpOpen: true }), null, 'help admits only rows that say so');
	assert.equal(rowOf(table, ev('h'), {}, { ...free, helpOpen: true }).id, 'h');
	assert.equal(rowOf(table, ev('m'), {}, { ...free, gesturing: true }), null, 'a gesture admits only rows that say so');
	assert.equal(rowOf(table, ev('g'), {}, { ...free, gesturing: true }).id, 'g');
});

test('the condition picks the ONE row the input means in this situation', () => {
	const table = openTable({ owner: 'a', rows: [
		row('yes', 'c', { when: (s) => s.ok === true }),
		row('no', 'c', { when: (s) => s.ok === false }),
	] });
	assert.equal(rowOf(table, ev('c'), { ok: true }, free).id, 'yes');
	assert.equal(rowOf(table, ev('c'), { ok: false }, free).id, 'no');
});

test('an unmatched situation means nothing (I6), and the key is still claimed: bind a key and you own it (B47)', () => {
	const table = openTable({ owner: 'a', rows: [row('yes', 'c', { when: (s) => s.ok === true })] });
	const r = table.matchInput(ev('c'), { ok: 'neither' }, free);
	assert.equal(r.match, null);
	assert.equal(r.claimed, true, 'what the key means is the condition\'s to say; that it is ours is the binding\'s');
	assert.equal(claimedBy(table, ev('q'), {}, free), false, 'an unbound key is never claimed');
});

test('a row that opts out of claiming leaves the key unclaimed, and a guard that skips a row skips its claim too', () => {
	const table = openTable({ owner: 'a', rows: [row('o', 'o', { prevent: false }), row('m', 'm')] });
	assert.equal(claimedBy(table, ev('o'), {}, free), false);
	assert.equal(claimedBy(table, ev('m'), {}, { ...free, readOnly: true }), false);
});

test('two rows matching one situation are NEVER resolved by position (Q3): nothing runs, and findOverlaps names them', () => {
	const table = openTable({ owner: 'a', rows: [row('first', 'k')] }, { owner: 'b', rows: [row('second', 'k')] });
	assert.equal(rowOf(table, ev('k'), {}, free), null, 'neither wins by being listed first');
	const k = ev('k'), s = {};
	const found = table.findOverlaps([k, ev('z')], [s], [free]);
	assert.equal(found.length, 1);
	assert.deepEqual(found[0].ids, ['first', 'second']);
	// H26.2: the record names the input, the situation and the guard state it was found in, each the value given (the gate prints them).
	// RESTATED at H26.8: in the component's own words, the fact and the context, where the adapter renamed them input and situation
	assert.deepEqual(Object.keys(found[0]), ['fact', 'context', 'guards', 'ids']);
	assert.ok(found[0].fact === k && found[0].context === s && found[0].guards === free, 'each the value given, by reference');
	assert.deepEqual(openTable({ owner: 'a', rows: [row('only', 'k')] }).findOverlaps([ev('k')], [{}], [free]), []);
});

test('findOverlaps judges each situation and guard state, so rows disjoint by condition are not an overlap', () => {
	const table = openTable({ owner: 'a', rows: [
		row('idle', 'w', { when: (s) => !s.busy, duringGesture: true }),
		row('busy', 'w', { when: (s) => s.busy, duringGesture: true }),
	] });
	assert.deepEqual(table.findOverlaps([ev('w')], [{ busy: true }, { busy: false }], [free, { ...free, gesturing: true }]), []);
});

test('the rows are data the engine does not interpret: a run may be a name or a function a tenant supplies', () => {
	const act = () => 'acted';
	const table = openTable({ owner: 'plugin', rows: [{ id: 'p', on: on('p'), run: act }] });
	assert.equal(rowOf(table, ev('p'), {}, free).run, act);
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
	// H26.7: the network under plugins/, and engine/'s and model/'s simulation modules with it
	assert.doesNotMatch(src, /from '\.\.\/(app|plugins\/(network|simulation)|engine|server|model|lab)\//, 'and it imports no tenant');
	// RESTATED at H26.2: the adapter imports the component, and nothing else
	assert.deepEqual([...src.matchAll(/^import [^;]*? from '([^']+)';/gm)].map((m) => m[1]), ['@apnex/input-binding'], 'it imports input-binding alone');
});

test('a row admitted only while writes are refused: the locked fallback a writer never gets', () => {
	const table = openTable({ owner: 'a', rows: [row('author', 'k'), row('look', 'k', { mutates: false, whileReadOnly: true })] });
	assert.equal(rowOf(table, ev('k'), {}, free).id, 'author', 'a writer gets the authoring row, and the fallback is not admitted');
	assert.equal(rowOf(table, ev('k'), {}, { ...free, readOnly: true }).id, 'look', 'a locked client gets the fallback');
	assert.deepEqual(table.findOverlaps([ev('k')], [{}], [free, { ...free, readOnly: true }]), [], 'disjoint by the guard, in both states');
});
