/*
TG-4 (H17.28; PLANNER-SYSTEM.md section 14.5) -- DISPATCH BY INDEX: a change is offered only to the reactions listening to
its kind, and a transaction-phase reaction is called only when its trigger hears a change. `plan` answers `called`, the
reactions it called, so what an edit costs is measured rather than assumed. In the network composition, as the lab runs.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from '../model/model.mjs';
import { plan } from '../planner/txn.mjs';
import { productKinds } from '../planner/kinds.mjs';
import { PIPE_ROW, pipeEntity } from '../network/pipe-kind.mjs';
import { createNetwork } from '../network/network.mjs';
import { CASES, composeCase } from './fixtures/planner-corpus.mjs';

const P = 60, KINDS = productKinds(PIPE_ROW);
function board() {
	const m = new Model({ kinds: KINDS });
	m.put('node', { id: 'node-00000a', name: 'A', type: 'router', x: -6 * P, y: 0, shape: 'circle' });
	m.put('node', { id: 'node-00000b', name: 'B', type: 'router', x: 6 * P, y: 0, shape: 'circle' });
	m.put('node', { id: 'node-00000e', name: 'E', x: 0, y: -2 * P });
	m.put('zone', { id: 'zone-00000a', name: 'Z', x: -90, y: -90, w: 180, h: 180 });
	m.put('link', { id: 'link-00000a', name: 'a', src: 'node-00000a', dst: 'node-00000b', via: ['node-00000e'] });
	for (const [a, b] of [['node-00000a', 'node-00000e'], ['node-00000e', 'node-00000b']]) m.put('pipe', pipeEntity(a, b, 'link'));
	return m;
}
const calls = (ops) => {
	const r = plan(board(), ops, { links: createNetwork().links, kinds: KINDS });
	assert.equal(r.ok, true, r.error);
	return r.called;
};

test('TG-4: an edit that touches only a zone calls no reaction at all', () => {
	assert.deepEqual(calls([{ op: 'set', kind: 'zone', id: 'zone-00000a', patch: { x: 30 } }]), []);
});

test('TG-4: a rename calls nothing, and a plane change calls only the join', () => {
	assert.deepEqual(calls([{ op: 'set', kind: 'link', id: 'link-00000a', patch: { name: 'renamed' } }]), []);
	assert.deepEqual(calls([{ op: 'set', kind: 'link', id: 'link-00000a', patch: { control: true } }]), ['link-join']);
});

// F-c (H18.5): a waypoint is a node with no type, so `node-links` hears its delete as well, and does nothing with it -- each
// clear reaction acts on its own shape of node (model/link-reactions.mjs)
test('TG-4: deleting a pin calls what listens to a waypoint deleted, and then what its consequences wake', () => {
	assert.deepEqual(calls([{ op: 'del', kind: 'node', id: 'node-00000e' }]),
		['node-links', 'waypoint-links', 'pipe-cascade', 'group-trim', 'stranded-links', 'orphan-sweep', 'link-join', 'pipe-sweep']);
});

test('TG-4: over the planner corpus, dispatch calls far fewer reactions than calling every one would', () => {
	let called = 0, composed = 0;
	for (const c of CASES) {
		const { model, options } = composeCase(c);
		const r = plan(model, structuredClone(c.ops), options);
		if (!r.ok) continue;
		called += r.called.length;
		// every transaction-phase reaction once per transaction, and every per-op reaction once per op the plan applied
		const reactions = (options.links?.reactions ?? []).length + 2;
		composed += reactions * Math.max(1, r.ops.length);
	}
	assert.ok(called < composed / 2, `called ${called} reactions where calling every one per op would be ${composed}`);
});
