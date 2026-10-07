/*
H19.10 (B301, B303; dev/design/unification/DEVICE-JUNCTIONS.md) -- a device that passes routes may be a junction.

Ruled 2026-10-07: a device is an endpoint or a junction by what the network plugin gives it, a junction needing transit on;
Z1, a device pin follows transit's rules only. One predicate, `nodeOffersTransit` (network/transit-offers.mjs), decides
whether a node may be passed, in place of four rules each asking whether it was a bare waypoint.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDoc } from './fixtures/composed.mjs';
import { nodeOffersTransit } from '../network/transit-offers.mjs';

const A = 'node-00000a', B = 'node-00000b', R = 'node-0000c1';
const pinnedThrough = (type) => ({ meta: { id: 'diagram-0d0001', name: 'd', version: 0, schema: 2 },
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
