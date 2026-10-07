/*
B302 (H19.11) -- NO REACTION COMMITS WHAT A REQUESTED WRITE COULD NOT.

A requested op is validated before it is applied (planner/txn.mjs `planOne`, `validateMutation`); an op a reaction emits was
applied as it came, and only the document invariants were checked after. So a reaction emitting a link the referential rules
refuse -- B301's ring, opened with routers among its bends -- was planned, answered and SAVED, and the store skipped the
diagram at its next boot. The guard: every entity a reaction wrote is held to the rules a requested write meets, on the
result, and the edit is refused, naming the reaction, if one fails -- unless it failed them before this edit too, so a
document that somehow reached a bad state can still be repaired (as the invariants are judged, B271).
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from '../model/model.mjs';
import { plan } from '../planner/txn.mjs';
import { createNetwork } from '../network/network.mjs';
import { createTransit } from '../network/transit.mjs';
import { productKinds } from '../planner/kinds.mjs';
import { NETWORK_ROWS } from '../network/kinds.mjs';

const KINDS = productKinds(...NETWORK_ROWS);
const NET = createNetwork(createTransit());
const A = 'node-00000a', B = 'node-00000b', P = 'node-0000f1';
const board = () => {
	const m = new Model({ network: NET, kinds: KINDS });
	m.put('node', { id: A, name: 'A', type: 'router', x: -240, y: 0, shape: 'circle' });
	m.put('node', { id: B, name: 'B', type: 'router', x: 240, y: 0, shape: 'circle' });
	m.put('node', { id: P, name: 'P', x: 0, y: -120 });
	m.put('link', { id: 'link-000001', name: 'l', order: 1, src: A, via: [P], dst: B });
	return m;
};
// the network's tenant with one more reaction, `rogue`, which writes `bad(doc)` whenever a node is renamed
const withRogue = (bad) => ({ links: { ...NET.links, reactions: [...NET.links.reactions, {
	id: 'rogue', phase: 'reshape', trigger: { changed: { kind: 'node', fields: ['name'] } }, doc: 'a test reaction that writes what no requested write could',
	run: ({ doc }, emit) => emit(bad(doc)),
}] }, kinds: KINDS });
const rename = [{ op: 'set', kind: 'node', id: P, patch: { name: 'P2' } }];

test('B302: a reaction writing a link to a node that does not exist is refused, naming the reaction', () => {
	const r = plan(board(), rename, withRogue(() => [{ op: 'put', kind: 'link', entity: { id: 'link-000002', name: 'x', order: 2, src: A, dst: 'node-0000ee' } }]));
	assert.equal(r.ok, false, 'refused');
	assert.match(r.error, /rogue/, 'naming the reaction');
	assert.match(r.error, /does not exist/, 'and saying what is wrong');
});

test('B302: B301\'s shape -- a link with routers among its bends -- is refused, not saved', () => {
	const r = plan(board(), rename, withRogue((doc) => [{ op: 'put', kind: 'link', entity: { ...doc.get('link', 'link-000001'), src: P, via: [B, A], dst: P } }]));
	assert.equal(r.ok, false, 'refused');
	assert.match(r.error, /rogue/);
});

test('B302: a reaction that writes something valid is untouched', () => {
	const r = plan(board(), rename, withRogue((doc) => [{ op: 'set', kind: 'link', id: 'link-000001', patch: { name: 'renamed' } }]));
	assert.equal(r.ok, true, r.error);
});

test('B302: an entity already failing the rules before the edit does not lock the document -- a reaction may still touch it', () => {
	const m = board();
	m.put('link', { id: 'link-000003', name: 'old', order: 3, src: A, via: [B], dst: P });   // stored before the rule, bypassing validation
	const r = plan(m, rename, withRogue(() => [{ op: 'set', kind: 'link', id: 'link-000003', patch: { name: 'touched' } }]));
	assert.equal(r.ok, true, r.error);
});
