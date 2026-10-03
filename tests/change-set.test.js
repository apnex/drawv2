/*
TG-1 (H17.28; PLANNER-SYSTEM.md section 14.2) -- THE CHANGE SET the planner keeps for a transaction: every entity touched,
as it stood before and as it stands after, and which fields differ, however each op was written and whoever emitted it. Read
here by a probe reaction in the last phase, as the transaction-phase reactions will read it from TG-3.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from '../model/model.mjs';
import { plan } from '../planner/txn.mjs';
import { CLASSIC_LINKS } from '../planner/tenants.mjs';
import { PRODUCT_KINDS } from '../planner/kinds.mjs';

// a probe listens to everything: every kind created or deleted, and every field of every kind changed
const EVERYTHING = [{ deleted: PRODUCT_KINDS.list }, { created: PRODUCT_KINDS.list },
	...PRODUCT_KINDS.list.map((kind) => ({ changed: { kind, fields: Object.keys(PRODUCT_KINDS.row(kind).fields) } }))];

const P = 60;
function board() {
	const m = new Model();
	m.put('node', { id: 'node-00000a', name: 'A', type: 'router', x: -6 * P, y: 0, shape: 'circle' });
	m.put('node', { id: 'node-00000b', name: 'B', type: 'router', x: 6 * P, y: 0, shape: 'circle' });
	m.put('link', { id: 'link-00000a', name: 'a', src: 'node-00000a', dst: 'node-00000b', direction: 'forward' });
	return m;
}
// plan with a probe in the join phase, answering the change set it was handed
function changesOf(m, ops) {
	let seen = null;
	const probe = { id: 'probe', phase: 'join', doc: 'test probe', trigger: EVERYTHING, run: ({ changes }) => { seen = changes.list(); } };
	const r = plan(m, ops, { links: { ...CLASSIC_LINKS, reactions: [...CLASSIC_LINKS.reactions, probe] } });
	assert.equal(r.ok, true, r.error);
	// since TG-3 a transaction-phase reaction is called only when its trigger hears a change: no call, no change
	if (seen === null) return {};
	return Object.fromEntries(seen.map((c) => [`${c.kind}:${c.id}`, { created: !c.before, deleted: !c.after, fields: [...c.fields].sort() }]));
}

test('TG-1: a set reports the fields it changed, and only those', () => {
	assert.deepEqual(changesOf(board(), [{ op: 'set', kind: 'link', id: 'link-00000a', patch: { direction: 'reverse', name: 'a' } }]),
		{ 'link:link-00000a': { created: false, deleted: false, fields: ['direction'] } }, 'name was set to what it was: not a change');
});

test('TG-1: a whole-entity put that clears a field reports that field changed', () => {
	const m = board();
	const { direction: _f, ...cleared } = m.get('link', 'link-00000a');
	assert.deepEqual(changesOf(m, [{ op: 'put', kind: 'link', entity: cleared }]), { 'link:link-00000a': { created: false, deleted: false, fields: ['direction'] } });
});

test('TG-1: a create and a delete, and a cascade a reaction emits, are all in it', () => {
	const m = board();
	const got = changesOf(m, [{ op: 'del', kind: 'node', id: 'node-00000a' }, { op: 'put', kind: 'node', entity: { id: 'node-00000c', name: 'C', type: 'router', x: 0, y: 4 * P, shape: 'circle' } }]);
	assert.deepEqual(Object.keys(got).sort(), ['link:link-00000a', 'node:node-00000a', 'node:node-00000c'], 'the link the node\'s cascade deleted is there too');
	assert.equal(got['node:node-00000a'].deleted, true);
	assert.equal(got['link:link-00000a'].deleted, true);
	assert.equal(got['node:node-00000c'].created, true);
});

test('TG-1: an entity created and deleted in one transaction, or put back unchanged, is no change', () => {
	const m = board();
	const c = { id: 'node-00000c', name: 'C', type: 'router', x: 0, y: 4 * P, shape: 'circle' };
	assert.deepEqual(changesOf(m, [{ op: 'put', kind: 'node', entity: c }, { op: 'del', kind: 'node', id: 'node-00000c' }, { op: 'set', kind: 'link', id: 'link-00000a', patch: { name: 'z' } }, { op: 'set', kind: 'link', id: 'link-00000a', patch: { name: 'a' } }]), {});
});

test('TG-1b: a link the join absorbs records what it joined into; nothing else carries succession', () => {
	const m = new Model();
	m.put('node', { id: 'node-00000a', name: 'A', type: 'router', x: -6 * P, y: 0, shape: 'circle' });
	m.put('node', { id: 'node-00000b', name: 'B', type: 'router', x: 6 * P, y: 0, shape: 'circle' });
	m.put('node', { id: 'node-00000e', name: 'E', x: 0, y: -2 * P });
	m.put('link', { id: 'link-00000a', name: 'a', src: 'node-00000a', dst: 'node-00000e', control: true });
	m.put('link', { id: 'link-00000b', name: 'b', src: 'node-00000e', dst: 'node-00000b' });
	let seen = null;
	const probe = { id: 'probe', phase: 'join', doc: 'test probe', trigger: EVERYTHING, run: ({ changes }) => { seen = changes.list(); } };
	// the probe runs after the classic join, in the same phase
	plan(m, [{ op: 'set', kind: 'link', id: 'link-00000b', patch: { control: true } }], { links: { ...CLASSIC_LINKS, reactions: [...CLASSIC_LINKS.reactions, probe] } });
	const b = seen.find((c) => c.id === 'link-00000b'), a = seen.find((c) => c.id === 'link-00000a');
	assert.equal(b.after, null, 'b was absorbed');
	assert.equal(b.into, 'link-00000a', 'into the link it joined');
	assert.equal('into' in a, false, 'the link kept carries no succession');
});
