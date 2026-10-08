/*
H18.8 (F-f; P-3, ruled 2026-10-03) -- A RING'S CLOSING LEG IS ROUTED LIKE ANY LEG, over a pipe laid with it.
dev/design/unification/FORMAT-BATCH.md section 6.
*/
import { pathOf, isLinkDown } from '../network/network-queries.mjs';   // Q-a: the network's questions
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from '../model/model.mjs';
import { plan, commit, undo } from '../planner/txn.mjs';
import { Log } from '../planner/log.mjs';
import { applyOps } from '../model/ops.mjs';
import { routeLink } from '../network/pipes.mjs';
import { createNetwork } from '../network/network.mjs';
import { createTransit } from '../network/transit.mjs';
import { productKinds } from '../product/kinds.mjs';
import { PIPE_ROW, pipeEntity, pipeId } from '../network/pipe-kind.mjs';
import { NETWORK_ROWS } from '../network/kinds.mjs';   // the network's kind and the field it contributes (S-a)

const KINDS = productKinds(...NETWORK_ROWS);
const NET = createNetwork(createTransit());
const [A, B, W] = ['node-00000a', 'node-00000b', 'node-00000e'];

// the lab's `bend` board: A to B, pinned at w above the middle, laid with its two legs
function bend() {
	const m = new Model({ attached: { network: NET }, kinds: KINDS });
	m.put('node', { id: A, name: 'A', type: 'router', x: -360, y: 0 });
	m.put('node', { id: B, name: 'B', type: 'router', x: 360, y: 0 });
	m.put('node', { id: W, name: 'w', x: 0, y: -120 });
	m.put('link', { id: 'link-000001', name: 'l', order: 1, src: A, dst: B, via: [W] });
	m.put('pipe', pipeEntity(A, W, 'link'));
	m.put('pipe', pipeEntity(W, B, 'link'));
	return m;
}
const close = (m, closed) => {
	const r = plan(m, [{ op: 'set', kind: 'link', id: 'link-000001', patch: { closed } }], { links: NET.links, kinds: KINDS });
	assert.equal(r.ok, true, r.error);
	applyOps(m, r.ops);
	return r;
};

test('F-f: a ring\'s stops return to its start, and its route takes the closing leg over a pipe -- down without one', () => {
	const ring = { src: A, dst: B, via: [W], closed: true };
	const legs = [{ a: A, b: W }, { a: W, b: B }];
	assert.equal(routeLink(legs, ring), null, 'no pipe from its end back to its start: the ring is down');
	assert.deepEqual(routeLink([...legs, { a: B, b: A }], ring), [A, W, B, A]);
	assert.deepEqual(routeLink(legs, { ...ring, closed: false }), [A, W, B], 'an open link is routed as it was');
});

test('F-f: closing a link lays its closing pipe in the same edit, and the ring is up over it, drawn closed with no point twice', () => {
	const m = bend();
	const r = close(m, true);
	assert.deepEqual(r.ops.filter((o) => o.kind === 'pipe'), [{ op: 'put', kind: 'pipe', entity: pipeEntity(A, B, 'link') }]);
	const ring = m.get('link', 'link-000001');
	assert.equal(isLinkDown(m, ring), false);
	assert.deepEqual(pathOf(m, ring), [[-360, 0], [0, -120], [360, 0]], 'the drawing closes itself from B back to A');
});

test('F-f: the closing pipe is kept while the ring runs over it, and swept when the ring is opened', () => {
	const m = bend();
	close(m, true);
	const unrelated = plan(m, [{ op: 'set', kind: 'node', id: W, patch: { name: 'w2' } }], { links: NET.links, kinds: KINDS });
	assert.equal(unrelated.ops.some((o) => o.kind === 'pipe'), false, 'an edit elsewhere sweeps nothing: the ring is using it');
	const opened = close(m, false);
	assert.deepEqual(opened.ops.filter((o) => o.kind === 'pipe'), [{ op: 'del', kind: 'pipe', id: pipeId(A, B) }], 'opened, nothing runs over it');
	assert.equal(isLinkDown(m, m.get('link', 'link-000001')), false);
});

test('F-f: a closing pair a pipe already joins lays nothing -- a hand pipe there carries the closing leg', () => {
	const m = bend();
	m.put('pipe', pipeEntity(A, B, 'hand'));
	const r = close(m, true);
	assert.equal(r.ops.some((o) => o.kind === 'pipe'), false);
	assert.equal(isLinkDown(m, m.get('link', 'link-000001')), false);
});

test('F-f: undoing the close takes the closing pipe back with it', () => {
	const m = bend(), log = new Log(0);
	assert.equal(commit(m, log, { label: 'close path', ops: [{ op: 'set', kind: 'link', id: 'link-000001', patch: { closed: true } }] }, 'x', 'x', { links: NET.links, kinds: KINDS }).ok, true);
	assert.ok(m.get('pipe', pipeId(A, B)));
	undo(m, log, null, { kinds: KINDS });
	assert.equal(m.get('pipe', pipeId(A, B)), undefined);
	assert.ok(!m.get('link', 'link-000001').closed, 'and the link is open again');
});

test('F-f: a down ring keeps the closing pipe it would heal onto, as a down link keeps its own legs (ruled 2026-09-27)', () => {
	const m = bend();
	close(m, true);
	m.put('node', { id: 'node-00000f', name: 'H', type: 'host', x: 0, y: 120 });
	// the ring goes down: its pin's pipe to B is taken away by hand, so no way remains
	const r = plan(m, [{ op: 'del', kind: 'pipe', id: pipeId(W, B) }], { links: NET.links, kinds: KINDS });
	assert.equal(r.ok, true, r.error);
	applyOps(m, r.ops);
	assert.equal(isLinkDown(m, m.get('link', 'link-000001')), true);
	assert.ok(m.get('pipe', pipeId(A, B)), 'its closing pipe stays: it is one of the legs the ring heals onto');
});

test('F-f: a ring has first call on its closing pipe, ahead of an older link that only passes over it', () => {
	const m = bend();
	close(m, true);
	// an older link from X to B, whose only way runs X-A-B: the closing pipe is the ring's own leg, and only on X's way
	m.put('node', { id: 'node-00000c', name: 'X', type: 'router', x: -360, y: 240 });
	m.put('pipe', pipeEntity('node-00000c', A, 'hand'));
	m.put('link', { id: 'link-000000', name: 'old', order: 0, src: 'node-00000c', dst: B });
	assert.equal(isLinkDown(m, m.get('link', 'link-000001')), false, 'the ring keeps its closing leg (rule 2: first call on its own legs)');
	assert.equal(isLinkDown(m, m.get('link', 'link-000000')), true, 'and the older link, with no other way, is down');
});

test('S-c: link-legs reads what each change is (TG-3) -- a link renamed is not re-pinned, and lays nothing', () => {
	const m = new Model({ attached: { network: NET }, kinds: KINDS });
	m.put('node', { id: A, name: 'A', type: 'router', x: -360, y: 0 });
	m.put('node', { id: B, name: 'B', type: 'router', x: 360, y: 0 });
	m.put('node', { id: W, name: 'w', x: 0, y: -120 });
	const link = { id: 'link-000001', name: 'l', order: 1, src: A, dst: B, via: [W] };
	m.put('link', link);   // a board whose pinned link has no pipes: down
	const legs = NET.links.reactions.find((r) => r.id === 'link-legs');
	const emitted = [];
	legs.run({ doc: m, matches: [{ kind: 'link', id: link.id, before: link, after: { ...link, name: 'k' }, fields: new Set(['name']) }] }, (ops) => emitted.push(...ops));
	assert.deepEqual(emitted, [], 'handed a rename, as the shadow hands every change, it lays nothing');
	legs.run({ doc: m, matches: [{ kind: 'link', id: link.id, before: { ...link, via: [] }, after: link, fields: new Set(['via']) }] }, (ops) => emitted.push(...ops));
	assert.equal(emitted.length, 2, 're-pinned, it lays both legs');
});
