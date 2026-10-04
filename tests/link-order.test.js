/*
B246 (H17.6, K15) -- ONE DERIVATION ORDER, BY ID. Two peers holding the same document can hold its links in different
orders, because each collection keeps insertion order and two writers insert differently. Every query that answers
links answered in that order, and `spawnersOf` took the FIRST terminating link at a spawn waypoint -- so two peers could
animate different links from one document (MEASURED by the H17 review: sameDocumentAsSets true, sameOrderEverywhere
false).

The comparator is stated (C8): ascending entity id, as JavaScript compares strings. No server-stamped sequence: an order
that needed one would be stored state, which is the stored-format batch's business. Each query is asked of two Models
holding one document inserted in opposite orders, with the relation index attached (as the client and the server run)
and without it (the Model's own fallback), and every answer must be the same, in the same order.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from './fixtures/composed.mjs';   // the network's kinds, the link among them (S-e)
import { attachRelations } from '../engine/store.mjs';
import { cellOf } from '../kernel/geometry.mjs';
import { spawnersOf } from '../engine/spawners.mjs';

const N = (i) => `node-00000${i}`, W = (i) => `node-0000e${i}`   /* a waypoint: a node with no type (F-c) */, L = (h) => `link-${h}`;
const entities = [
	['node', { id: N(1), name: 'a', type: 'router', x: -240, y: 0, shape: 'circle' }],
	['node', { id: N(2), name: 'b', type: 'router', x: 240, y: 0, shape: 'circle' }],
	['node', { id: W(3), name: 's', x: 0, y: -120, spawn: { interval: 1000, speed: 2, kind: 'packet', since: 1700000000000 } }],
	['node', { id: W(4), name: 'r', x: 0, y: 120 }],
	['node', { id: W(5), name: 't', x: 0, y: 240, spawn: { interval: 1000, speed: 2, kind: 'packet', since: 1700000000000 } }],
	// three links at the spawn waypoint s and two joining a and b, with ids out of insertion order on purpose
	['link', { id: L('00000f'), name: 'f', src: W(3), dst: N(1) }],
	['link', { id: L('00000a'), name: 'a', src: W(3), dst: N(2) }],
	['link', { id: L('00000c'), name: 'c', src: N(1), dst: N(2), via: [W(4)] }],
	['link', { id: L('00000b'), name: 'b', src: N(2), dst: N(1) }],
	['link', { id: L('00000e'), name: 'e', src: W(5), dst: N(2) }],
	['link', { id: L('00000d'), name: 'd', src: N(1), dst: W(5) }],
];
function peer(order, indexed) {
	const m = new Model();
	if (indexed) attachRelations(m, { cellOf });
	// reversed whole: the waypoints too, or the spawners' own order is never put to the test (a surviving mutant found this)
	const list = order === 'forward' ? entities : [...entities].reverse();
	for (const [kind, e] of list) m.put(kind, structuredClone(e));
	return m;
}
const ids = (links) => (Array.isArray(links) ? links.map((l) => l.id) : links?.id);
const answers = (m) => ({
	linksOf: [N(1), N(2)].map((n) => ids(m.linksOf(n))),
	linksAt: [W(3), W(4), W(5)].map((w) => ids(m.linksAt(w))),
	linkBetween: ids(m.linkBetween(N(1), N(2))),
	linksBetween: ids(m.linksBetween(N(1), N(2))),
	spawnersOf: spawnersOf(m).map((s) => [s.id, s.link]),
});

test('B246: every peer answers the link queries in one order, by id, whatever order it inserted in', () => {
	const peers = [['forward', true], ['reversed', true], ['forward', false], ['reversed', false]].map(([o, i]) => answers(peer(o, i)));
	for (const p of peers.slice(1)) assert.deepEqual(p, peers[0], 'two peers holding one document answer alike');
	const sorted = (xs) => [...xs].sort();
	assert.deepEqual(peers[0].linksOf[0], sorted(peers[0].linksOf[0]), 'and the order is ascending id');
	assert.deepEqual(peers[0].linksAt[0], [L('00000a'), L('00000f')]);
	assert.deepEqual(peers[0].linksBetween, [L('00000b'), L('00000c')]);
	assert.equal(peers[0].linkBetween, L('00000b'), 'the link between two points is the lowest id among them');
	assert.deepEqual(peers[0].spawnersOf, [[W(3), L('00000a')], [W(5), L('00000d')]], 'a spawner takes its lowest-id terminating link, and spawners come in id order');
});
