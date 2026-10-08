/*
THE PIPE KIND (network/pipe-kind.mjs) -- the network plugin's own kind, held in the planner one stage before the lab
composes it (H17.22 N-b; ruled 2026-10-02, N1, N2, N5, N6).

Its id is its two anchors' hex, lower first; its row refuses an id that does not match its ends, ends that do not exist
or are not stored lower first, and a hand pipe becoming a link pipe; and the network's reactions take an anchor's pipes
with it and sweep link pipes no link runs over, as one undoable edit. tests/planner-corpus.test.js holds the reactions to
the session's prune and sweep across every network case.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeKinds } from '../model/shape.mjs';
import { Model } from './fixtures/composed.mjs';   // the composition production runs (S-b)
import { attachRelations } from '../engine/store.mjs';
import { cellOf } from '../kernel/geometry.mjs';
import { applyOps } from '../model/ops.mjs';
import { productKinds } from '../product/kinds.mjs';
const PRODUCT_KINDS = productKinds();   // the product's own kinds; the export went at S-f with the defaults it served
import { commit, plan, undo } from './fixtures/composed.mjs';
import { Log } from '../planner/log.mjs';
import { createNetwork } from '../network/network.mjs';
import { PIPE_ROW, pipeId, pipeEntity } from '../network/pipe-kind.mjs';
import { LINK_ROW } from '../network/link-kind.mjs';

const KINDS = composeKinds([...PRODUCT_KINDS.list.map((k) => PRODUCT_KINDS.row(k)), LINK_ROW, PIPE_ROW], 'a test');   // the link is the network's (S-e)
const A = 'node-00000a', B = 'node-00000b', W = 'node-00000c';

function board() {
	const m = new Model({ kinds: KINDS });
	attachRelations(m, { cellOf });
	m.put('node', { id: A, name: 'A', type: 'router', x: -240, y: 0, shape: 'circle' });
	m.put('node', { id: B, name: 'B', type: 'router', x: 240, y: 0, shape: 'circle' });
	m.put('node', { id: W, name: 'w', x: 0, y: -120 });
	const network = createNetwork();
	return { m, log: new Log(), opts: { links: network.links, kinds: KINDS } };
}
const putPipe = (x, y, laid) => ({ op: 'put', kind: 'pipe', entity: pipeEntity(x, y, laid) });

test('N-b: a pipe\'s id is its two anchors\' hex, lower first, whichever way it is asked', () => {
	assert.equal(pipeId(W, A), 'pipe-00000a-00000c');
	assert.equal(pipeId(A, W), 'pipe-00000a-00000c');
	assert.deepEqual(pipeEntity(W, A, 'hand'), { id: 'pipe-00000a-00000c', a: A, b: W, laid: 'hand' });
});

test('N-b: the row accepts a pipe between two anchors, and refuses one its ends do not make', () => {
	// laid by hand, so the sweep keeps it with no link over it
	const { m, log, opts } = board();
	const try1 = (op) => commit(m, log, { ops: [op] }, 'test', 'test', opts);
	assert.equal(try1(putPipe(A, W, 'hand')).ok, true);
	assert.equal(try1({ op: 'put', kind: 'pipe', entity: { id: 'pipe-00000a-00000b', a: A, b: W, laid: 'link' } }).error, 'pipe id pipe-00000a-00000b is not the one its ends make, pipe-00000a-00000c');
	assert.equal(try1({ op: 'put', kind: 'pipe', entity: { id: 'pipe-00000a-00000c', a: W, b: A, laid: 'link' } }).error, `pipe ends are stored lower hex first, and are two anchors: ${W}, ${A}`);
	assert.equal(try1({ op: 'put', kind: 'pipe', entity: { id: 'pipe-00000a-00000a', a: A, b: A, laid: 'link' } }).error, `pipe ends are stored lower hex first, and are two anchors: ${A}, ${A}`);
	assert.equal(try1(putPipe(A, 'node-0000ff', 'link')).error, 'pipe end does not exist: node-0000ff');
	assert.equal(try1({ op: 'put', kind: 'pipe', entity: { ...pipeEntity(A, B, 'link'), laid: 'drawn' } }).error, 'invalid value for pipe.laid');
	assert.equal(try1({ op: 'put', kind: 'pipe', entity: { ...pipeEntity(A, B, 'link'), name: 'p' } }).error, 'unknown field pipe.name', 'a pipe is not named (N5)');
	assert.equal(try1({ op: 'set', kind: 'pipe', id: pipeId(A, W), patch: { b: B } }).error, 'pipe id pipe-00000a-00000c is not the one its ends make, pipe-00000a-00000b', 'its ends never change');
});

test('N-b: a link pipe laid by hand becomes a hand pipe; a hand pipe never becomes a link pipe', () => {
	const { m, log, opts } = board();
	// a link pipe stays only while a link runs over it, so the link is laid with it
	const link = { op: 'put', kind: 'link', entity: { id: 'link-00000d', name: 'l', src: A, dst: B, via: [W] } };
	assert.equal(commit(m, log, { ops: [link, putPipe(A, W, 'link'), putPipe(W, B, 'link')] }, 'test', 'test', opts).ok, true);
	assert.equal(commit(m, log, { ops: [{ op: 'set', kind: 'pipe', id: pipeId(A, W), patch: { laid: 'hand' } }] }, 'test', 'test', opts).ok, true);
	assert.equal(m.get('pipe', pipeId(A, W)).laid, 'hand');
	assert.equal(commit(m, log, { ops: [{ op: 'set', kind: 'pipe', id: pipeId(A, W), patch: { laid: 'link' } }] }, 'test', 'test', opts).error, 'a pipe laid by hand stays a hand pipe: pipe-00000a-00000c');
});

test('N-b: deleting an anchor takes its pipes, hand pipes too, in the same edit -- and undo brings them back', () => {
	const { m, log, opts } = board();
	assert.equal(commit(m, log, { ops: [putPipe(A, W, 'hand'), putPipe(W, B, 'hand'), putPipe(A, B, 'hand')] }, 'test', 'test', opts).ok, true);
	const res = commit(m, log, { ops: [{ op: 'del', kind: 'node', id: W }] }, 'test', 'test', opts);
	assert.equal(res.ok, true);
	assert.deepEqual(m.all('pipe').map((p) => p.id), [pipeId(A, B)]);
	assert.equal(undo(m, log, null, opts).ok, true);
	assert.deepEqual(m.all('pipe').map((p) => p.id).sort(), [pipeId(A, B), pipeId(A, W), pipeId(B, W)].sort(), 'undo restores the pipes with the anchor');
});

test('N-b: an edit sweeps link pipes no link runs over, keeps hand pipes, and the sweep is undone with it', () => {
	const { m, log, opts } = board();
	const link = { id: 'link-00000d', name: 'l', src: A, dst: B, via: [W] };
	assert.equal(commit(m, log, { ops: [{ op: 'put', kind: 'link', entity: link }, putPipe(A, W, 'link'), putPipe(W, B, 'link'), putPipe(A, B, 'hand')] }, 'test', 'test', opts).ok, true);
	assert.equal(m.all('pipe').length, 3, 'its pipes are in use, so nothing is swept');
	const res = plan(m, [{ op: 'del', kind: 'link', id: link.id }], opts);
	assert.equal(res.ok, true);
	const after = new Model({ kinds: KINDS });
	after.load(m.toJSON());
	applyOps(after, res.ops);
	assert.deepEqual(after.all('pipe').map((p) => p.id), [pipeId(A, B)], 'the link pipes went with the last link; the hand pipe stays');
	assert.equal(after.get('node', W), undefined, 'and the pin went with them: no hand pipe held it');
	applyOps(after, res.inverse);
	assert.equal(after.all('pipe').length, 3, 'undo restores the swept pipes');
});

test('N-d: a link crossing a pipe in either direction is using it -- the sweep keeps it', () => {
	// held by the session's pipe set until N-d deleted it; a pipe has no direction, so a route stepping b to a uses a-b
	const { m, log, opts } = board();
	const back = { id: 'link-00000e', name: 'back', src: B, dst: A, via: [W] };
	assert.equal(commit(m, log, { ops: [{ op: 'put', kind: 'link', entity: back }, putPipe(A, W, 'link'), putPipe(W, B, 'link')] }, 'test', 'test', opts).ok, true);
	assert.equal(commit(m, log, { ops: [{ op: 'put', kind: 'node', entity: { id: 'node-00000f', name: 'F', type: 'router', x: 0, y: 240, shape: 'circle' } }] }, 'test', 'test', opts).ok, true, 'any edit sweeps');
	assert.deepEqual(m.all('pipe').map((p) => p.id).sort(), [pipeId(A, W), pipeId(B, W)].sort(), 'both pipes stay: B to A runs them backwards, and still runs them');
});

// AMENDED 2026-10-03 (S-b): the product composes the network now; a composition WITHOUT its rows refuses a pipe
test('N-b: a composition without the network\'s rows refuses a pipe', async () => {
	const { Model: Bare } = await import('../model/model.mjs');
	const { plan: bare } = await import('../planner/txn.mjs');
	const { linkTenant } = await import('../network/link-reactions.mjs');
	assert.equal(bare(new Bare({ kinds: PRODUCT_KINDS }), [putPipe(A, B, 'hand')], { links: linkTenant({ owner: 't', keepsOrphan: () => false, says: {} }), kinds: PRODUCT_KINDS }).error, 'unknown kind: pipe');
});
