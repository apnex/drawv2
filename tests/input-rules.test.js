/*
THE RULES ENGINE -- kernel/input-rules.mjs, step T3 of the ruleset audit (dev/RULES.md section 11).

A neutral core with tenants (P4): the engine owns the mechanism -- joining tenants' rows, applying the guards, finding
the one row an input means in a situation -- and names nothing any tenant is about. The product brings its key table;
a plugin brings its own rows. The director's rulings bind it (2026-09-30): a rule sees the selection and what the
current gesture step is on (Q1); two rows matching one situation is always a failure, never resolved by position (Q3);
the situation is plain data (Q4).
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { composeRules, resolveInput, overlapsIn } from '../kernel/input-rules.mjs';

const on = (k) => (e) => e.key === k;
const row = (id, key, extra = {}) => ({ id, on: on(key), run: `run-${id}`, ...extra });
const ev = (k) => ({ key: k });
const free = { readOnly: false, helpOpen: false, gesturing: false };

test('composeRules joins tenants and stamps each row with its owner', () => {
	const table = composeRules({ owner: 'a', rules: [row('x', 'x')] }, { owner: 'b', rules: [row('y', 'y')] });
	assert.deepEqual(table.map((r) => [r.id, r.owner]), [['x', 'a'], ['y', 'b']]);
});

test('composeRules refuses a duplicate id, within a tenant or across two', () => {
	assert.throws(() => composeRules({ owner: 'a', rules: [row('x', 'x'), row('x', 'y')] }), /x/);
	assert.throws(() => composeRules({ owner: 'a', rules: [row('x', 'x')] }, { owner: 'b', rules: [row('x', 'z')] }), /x.*a.*b|x.*b.*a/);
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
	const found = overlapsIn(table, [ev('k'), ev('z')], [{}], [free]);
	assert.equal(found.length, 1);
	assert.deepEqual(found[0].ids, ['first', 'second']);
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
});

test('a row admitted only while writes are refused: the locked fallback a writer never gets', () => {
	const table = composeRules({ owner: 'a', rules: [row('author', 'k'), row('look', 'k', { mutates: false, whileReadOnly: true })] });
	assert.equal(resolveInput(table, ev('k'), {}, free).rule.id, 'author', 'a writer gets the authoring row, and the fallback is not admitted');
	assert.equal(resolveInput(table, ev('k'), {}, { ...free, readOnly: true }).rule.id, 'look', 'a locked client gets the fallback');
	assert.deepEqual(overlapsIn(table, [ev('k')], [{}], [free, { ...free, readOnly: true }]), [], 'disjoint by the guard, in both states');
});
