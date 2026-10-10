/*
H19.10 (B301, B303; dev/design/unification/DEVICE-JUNCTIONS.md) -- a device that passes routes may be a junction.

Ruled 2026-10-07: a device is an endpoint or a junction by what the network plugin gives it, a junction needing transit on;
Z1, a device pin follows transit's rules only. One predicate, `nodeOffersTransit` (network/transit-offers.mjs), decides
whether a node may be passed, in place of four rules each asking whether it was a bare waypoint.
*/
import { isLinkDown } from '../network/network-queries.mjs';   // Q-a: the network's questions
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDoc, heldLayouts } from './fixtures/composed.mjs';
import { nodeOffersTransit } from '../network/transit-offers.mjs';

const A = 'node-00000a', B = 'node-00000b', R = 'node-0000c1';
// RESTATED at WD-b1 (H19.45): schema 3 -- a document holds its two layouts (tests/fixtures/composed.mjs `heldLayouts`)
const pinnedThrough = (type) => ({ meta: { id: 'diagram-0d0001', name: 'd', version: 0, schema: 3 }, layouts: heldLayouts(),
	nodes: [{ id: A, name: 'A', type: 'host', shape: 'circle', x: -240, y: 0 }, { id: B, name: 'B', type: 'host', shape: 'circle', x: 240, y: 0 },
		{ id: R, name: 'R', x: 0, y: -120, ...(type ? { type, shape: 'circle' } : {}) }],
	links: [{ id: 'link-000001', name: 'l', src: A, via: [R], dst: B }], pipes: [], zones: [], groups: [], selection: [] });

test('Z-a: a link may be pinned through a node whose type offers transit -- a waypoint, a router, a firewall, a vxlan', () => {
	for (const type of [null, 'router', 'firewall', 'vxlan']) assert.equal(validateDoc(pinnedThrough(type)), null, `${type ?? 'a waypoint'} may be passed`);
});

test('Z-a: through a node that never passes routes, it is refused, naming the node and its type', () => {
	for (const type of ['host', 'server', 'loadbalancer']) assert.match(validateDoc(pinnedThrough(type)), new RegExp(`never passes routes: R is a ${type}`), type);
});

test('Z-a: one node in two roles of one link is refused whatever its kind -- a device as its end and its pin', () => {
	const d = pinnedThrough('router');
	d.nodes[0].type = 'router';   // A may be passed too, so what is refused is its second role
	d.links[0].via = [R, A];
	assert.match(validateDoc(d), /two roles/);
});

test('Z-a: whether a node offers transit is the plugin\'s table, read through one predicate', () => {
	assert.deepEqual(['router', 'firewall', 'vxlan', 'loadbalancer', 'server', 'host', 'textbox'].map((type) => nodeOffersTransit({ id: R, type })), [true, true, true, false, false, false, false]);
	assert.equal(nodeOffersTransit({ id: R }), true, 'a bare waypoint');
	assert.equal(nodeOffersTransit(undefined), false, 'nothing');
});

// ---- Z-b: transit at a device, and at every door ----
import { Model } from '../model/model.mjs';
import { applyOps } from '../model/ops.mjs';
import { plan } from '../planner/txn.mjs';
import { createNetwork } from '../network/network.mjs';
import { createTransit } from '../network/transit.mjs';
import { productKinds } from '../product/kinds.mjs';
import { NETWORK_ROWS } from '../network/kinds.mjs';
import { pipeEntity } from '../network/pipe-kind.mjs';

const KINDS = productKinds(...NETWORK_ROWS);
const NET = createNetwork(createTransit());
const H = 'node-00000c', W1 = 'node-0000f1', W2 = 'node-0000f2', W3 = 'node-0000f3';
// hosts A and B, a router R between them; a link A -> R -> B pinned through R, over its legs' pipes
function throughRouter() {
	const m = new Model({ attached: { network: NET }, kinds: KINDS });
	m.put('node', { id: A, name: 'A', type: 'host', shape: 'circle', x: -240, y: 0 });
	m.put('node', { id: B, name: 'B', type: 'host', shape: 'circle', x: 240, y: 0 });
	m.put('node', { id: R, name: 'R', type: 'router', shape: 'circle', x: 0, y: -120 });
	m.put('link', { id: 'link-000001', name: 'l', order: 1, src: A, via: [R], dst: B });
	for (const [a, b] of [[A, R], [R, B]]) m.put('pipe', pipeEntity(a, b, 'link'));
	return m;
}
const edit = (m, ops) => { const r = plan(m, ops, { links: NET.links, kinds: KINDS }); assert.equal(r.ok, true, r.error); applyOps(m, r.ops); return r; };
const off = (id) => ({ op: 'set', kind: 'node', id, patch: { transit: false } });
const on = (m, id) => ({ op: 'put', kind: 'node', entity: (({ transit: _t, ...e }) => e)(m.get('node', id)) });
const shape = (m) => m.all('link').map((l) => [l.src, l.via ?? [], l.dst].join(' ')).sort();

test('Z-b: transit off at a router a link is pinned through cuts it there -- two links ending at the router', () => {
	const m = throughRouter();
	edit(m, [off(R)]);
	assert.deepEqual(shape(m), [`${A}  ${R}`, `${R}  ${B}`]);
	assert.equal(m.all('link').filter((l) => isLinkDown(m, l)).length, 0, 'both up');
});

test('Z-b: back on, one link through the router again; undo restores it exactly', () => {
	const m = throughRouter(), was = structuredClone(m.get('link', 'link-000001'));
	edit(m, [off(R)]);
	edit(m, [on(m, R)]);
	assert.deepEqual(shape(m), [`${A} ${R} ${B}`], 'rejoined through R');
	const n = throughRouter();
	const r = edit(n, [off(R)]);
	applyOps(n, r.inverse);
	assert.deepEqual(n.get('link', 'link-000001'), was, 'undo');
});

test('Z-b (Z1): links an author drew to a router never merge when its transit returns -- only a cut\'s pieces rejoin', () => {
	const m = throughRouter();
	m.del('link', 'link-000001');
	m.put('link', { id: 'link-000002', name: 'a', order: 2, src: A, dst: R });
	m.put('link', { id: 'link-000003', name: 'b', order: 3, src: R, dst: B });
	m.put('node', { ...m.get('node', R), transit: false });
	edit(m, [on(m, R)]);
	assert.deepEqual(shape(m), [`${A}  ${R}`, `${R}  ${B}`], 'still two links ending at R');
});

test('Z-b (Z1): deleting one of three links ending at a router joins nothing', () => {
	const m = throughRouter();
	m.del('link', 'link-000001');
	m.put('node', { id: H, name: 'C', type: 'host', shape: 'circle', x: 0, y: 120 });
	for (const [i, s] of [[2, A], [3, B], [4, H]]) m.put('link', { id: `link-00000${i}`, name: `l${i}`, order: i, src: s, dst: R });
	edit(m, [{ op: 'del', kind: 'link', id: 'link-000004' }]);
	assert.deepEqual(shape(m), [`${A}  ${R}`, `${B}  ${R}`]);
});

test('Z-b: transit off at a waypoint of a ring through a router opens the ring there, the router a pin of the loop; back on, whole', () => {
	const m = new Model({ attached: { network: NET }, kinds: KINDS });
	m.put('node', { id: R, name: 'R', type: 'router', shape: 'circle', x: 0, y: 0 });
	for (const [id, x, y] of [[W1, 240, -120], [W2, 360, 0], [W3, 240, 120]]) m.put('node', { id, name: id.slice(-2), x, y });
	m.put('link', { id: 'link-000001', name: 'ring', order: 1, src: R, via: [W1, W2], dst: W3, closed: true });
	for (const [a, b] of [[R, W1], [W1, W2], [W2, W3], [W3, R]]) m.put('pipe', pipeEntity(a, b, 'link'));
	edit(m, [off(W2)]);
	const l = m.get('link', 'link-000001');
	assert.deepEqual([l.src, l.via, l.dst, !!l.closed], [W2, [W3, R, W1], W2, false], 'opened at W2, R passed as a pin');
	assert.equal(isLinkDown(m, l), false);
	edit(m, [on(m, W2)]);
	assert.equal(m.get('link', 'link-000001').closed, true, 'a ring again');
});

test('Z-b: deleting a router deletes the links pinned through it, as a pin\'s deletion does (P-7)', () => {
	const m = throughRouter();
	edit(m, [{ op: 'del', kind: 'node', id: R }]);
	assert.equal(m.all('link').length, 0);
});

test('Z-b (B303): a link written pinned through a waypoint whose transit is off arrives cut there, from any door', () => {
	const m = new Model({ attached: { network: NET }, kinds: KINDS });
	m.put('node', { id: A, name: 'A', type: 'router', shape: 'circle', x: -240, y: 0 });
	m.put('node', { id: B, name: 'B', type: 'router', shape: 'circle', x: 240, y: 0 });
	m.put('node', { id: W1, name: 'P', x: 0, y: -120, transit: false });
	edit(m, [{ op: 'put', kind: 'link', entity: { id: 'link-000001', name: 'l', src: A, via: [W1], dst: B } }]);
	assert.deepEqual(shape(m), [`${A}  ${W1}`, `${W1}  ${B}`], 'two links ending at P, never one passing it');
});

test('Z-b (B303): and through a router whose transit is off', () => {
	const m = throughRouter();
	m.del('link', 'link-000001');
	m.put('node', { ...m.get('node', R), transit: false });
	edit(m, [{ op: 'put', kind: 'link', entity: { id: 'link-000005', name: 'l', src: A, via: [R], dst: B } }]);
	assert.deepEqual(shape(m), [`${A}  ${R}`, `${R}  ${B}`]);
});
