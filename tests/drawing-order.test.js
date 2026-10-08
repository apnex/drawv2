/*
H18.6 (F-d) -- EVERY DRAWN ITEM STORES ITS DRAWING ORDER (ruled 2026-10-01, B249: "newest drawn on top", the same for every
peer, stored with the format batch; B10, undo restores an item to its place; B259, a link's age is its order).
dev/design/unification/FORMAT-BATCH.md section 6.
*/
import { test } from 'node:test';
import { makeZone } from '../zones/make-zone.mjs';   // O-b1: the zones plugin's factory
import assert from 'node:assert/strict';
import { Model } from './fixtures/composed.mjs';   // the composition production runs (S-b)
import { nextOrder } from '../model/order.mjs';
import { byDrawingOrder, orderOf } from '../model/stacking.mjs';
import { plan, commit, undo } from './fixtures/composed.mjs';
import { Log } from '../planner/log.mjs';
import { docToSchema } from '../kernel/adapt.mjs';
import { createNetwork } from '../network/network.mjs';
import { productKinds } from '../product/kinds.mjs';
import { PIPE_ROW, pipeEntity } from '../network/pipe-kind.mjs';
import { NETWORK_ROWS } from '../network/kinds.mjs';   // the network's kind and the field it contributes (S-a)
import { makeRenderer } from './fixtures/client-harness.mjs';
import { makeNode, makeWaypoint } from '../devices/make-node.mjs';   // O-e1: the devices plugin's factories

const router = (id, x, extra = {}) => ({ id, name: id, type: 'router', x, y: 0, ...extra });

test('F-d: one comparator -- lower order first, an item without one the oldest, ties by id', () => {
	const list = [{ id: 'c', order: 2 }, { id: 'b', order: 1 }, { id: 'a' }, { id: 'd', order: 2 }];
	assert.deepEqual([...list].sort(byDrawingOrder).map((e) => e.id), ['a', 'b', 'c', 'd']);
	assert.equal(orderOf({}), 0);
	assert.equal(orderOf(undefined), 0);
});

test('F-d: whoever creates an item stamps it one above the highest of its kind -- the Model\'s factories', () => {
	const m = new Model();
	const a = makeNode(m, 'router', { x: 0, y: 0 }); m.put('node', a);
	const w = makeWaypoint(m, { x: 60, y: 0 }); m.put('node', w);
	const l = m.makeLink(a.id, w.id); m.put('link', l);
	const z = makeZone(m, { x: -90, y: -90, w: 180, h: 180 });
	assert.deepEqual([a.order, w.order, l.order, z.order], [1, 2, 1, 1], 'nodes count together, typed or not; each kind its own');
	assert.equal(nextOrder(m, 'node'), 3);
});

test('F-d: the planner gives a creation without an order the next one, as a set after the put it was sent', () => {
	const m = new Model();
	m.put('node', router('node-00000a', 0, { order: 7 }));
	const r = plan(m, [{ op: 'put', kind: 'node', entity: router('node-00000b', 120) }]);
	assert.equal(r.ok, true, r.error);
	assert.deepEqual(r.ops[0].entity, router('node-00000b', 120), 'the put comes back as it was sent, so a tab knows its echo');
	assert.deepEqual(r.ops[1], { op: 'set', kind: 'node', id: 'node-00000b', patch: { order: 8 } }, 'drawn newest');
	const given = plan(m, [{ op: 'put', kind: 'node', entity: router('node-00000c', 240, { order: 3 }) }]);
	assert.equal(given.ops.length, 1, 'an order the creator stamped is kept');
});

test('F-d: a put that replaces an item and omits its order keeps the item\'s own; an unchanged one is still no change', () => {
	const m = new Model();
	m.put('node', router('node-00000a', 0, { order: 4 }));
	const moved = plan(m, [{ op: 'put', kind: 'node', entity: router('node-00000a', 120) }]);
	assert.deepEqual(moved.ops.at(-1), { op: 'set', kind: 'node', id: 'node-00000a', patch: { order: 4 } }, 'it stays where it was in the stack');
	const same = plan(m, [{ op: 'put', kind: 'node', entity: router('node-00000a', 0) }]);
	assert.deepEqual(same.ops, [], 'the same item, its order carried, changes nothing (I6)');
});

test('F-d (B10): undoing a delete puts the item back with its order -- in its place, not on top', () => {
	const m = new Model(), log = new Log(0);
	for (const [id, x, order] of [['node-00000a', 0, 1], ['node-00000b', 120, 2], ['node-00000c', 240, 3]]) m.put('node', router(id, x, { order }));
	assert.equal(commit(m, log, { label: 'del', ops: [{ op: 'del', kind: 'node', id: 'node-00000a' }] }, 'x', 'x').ok, true);
	undo(m, log);
	assert.equal(m.get('node', 'node-00000a').order, 1, 'the oldest comes back the oldest');
	assert.deepEqual([...m.all('node')].sort(byDrawingOrder).map((n) => n.id), ['node-00000a', 'node-00000b', 'node-00000c']);
});

test('F-d (B259): a link\'s age is its order -- the older keeps a contested pipe, whatever its id says', () => {
	const kinds = productKinds(...NETWORK_ROWS);
	const board = (olderId) => {
		const m = new Model({ network: createNetwork(), kinds });
		for (const [id, x, y] of [['node-00000a', -240, 0], ['node-00000b', 240, 0], ['node-00000c', -240, 120], ['node-00000d', 240, 120]]) m.put('node', { id, name: id, type: 'router', x, y });
		m.put('node', { id: 'node-000001', name: 't1', x: -120, y: 60 }); m.put('node', { id: 'node-000002', name: 't2', x: 120, y: 60 });
		for (const [a, b] of [['node-00000a', 'node-000001'], ['node-00000c', 'node-000001'], ['node-000001', 'node-000002'], ['node-000002', 'node-00000b'], ['node-000002', 'node-00000d']]) m.put('pipe', pipeEntity(a, b, 'hand'));
		m.put('link', { id: 'link-00000u', name: 'u', src: 'node-00000a', dst: 'node-00000b', order: olderId === 'u' ? 1 : 2 });
		m.put('link', { id: 'link-00000l', name: 'l', src: 'node-00000c', dst: 'node-00000d', order: olderId === 'l' ? 1 : 2 });
		return m;
	};
	const u = board('u'), l = board('l');
	assert.equal(u.isLinkDown(u.get('link', 'link-00000l')), true, 'u older: l is down');
	assert.equal(l.isLinkDown(l.get('link', 'link-00000u')), true, 'l older: u is down -- the order decides, not the id');
});

test('F-d: the export stacks by the order the canvas stacks by', () => {
	const doc = { meta: { id: 'diagram-000001', name: 'd' }, groups: [],
		nodes: [router('node-00000a', 0, { order: 2 }), router('node-00000b', 120, { order: 1 })],
		links: [], zones: [{ id: 'zone-00000d', name: 'top', x: -90, y: -90, w: 180, h: 180, order: 9 }, { id: 'zone-00000c', name: 'low', x: -90, y: -90, w: 180, h: 180, order: 3 }] };
	const ids = docToSchema(doc).entities.map((e) => e.id);
	assert.deepEqual(ids.filter((i) => i.startsWith('node-')), ['node-00000b', 'node-00000a']);
	assert.deepEqual(ids.filter((i) => i.startsWith('zone-')), ['zone-00000c', 'zone-00000d']);
});

test('F-d (B10): the canvas draws an item put back in its place, and a new one on top', async () => {
	const { svg, restore } = makeRenderer();
	try {
		const { Renderer } = await import('../app/src/renderer.js');
		const m = new Model();
		const r = new Renderer(m, svg);
		const zone = (id, order) => ({ id, name: id, x: -90, y: -90, w: 180, h: 180, order });
		for (const [id, order] of [['zone-00000a', 1], ['zone-00000b', 2], ['zone-00000c', 3]]) m.put('zone', zone(id, order));
		const stack = () => r.layers.zones.children.map((c) => c.getAttribute('id'));
		assert.deepEqual(stack(), ['zone-00000a', 'zone-00000b', 'zone-00000c']);
		m.del('zone', 'zone-00000a');
		m.put('zone', zone('zone-00000a', 1));     // what undo does
		assert.deepEqual(stack(), ['zone-00000a', 'zone-00000b', 'zone-00000c'], 'back in its place, not on top (B10)');
		m.put('zone', zone('zone-00000b', 2));     // a re-put of the middle one
		assert.deepEqual(stack(), ['zone-00000a', 'zone-00000b', 'zone-00000c'], 'a re-render keeps it in place');
		m.put('zone', zone('zone-00000d', 4));
		assert.deepEqual(stack().at(-1), 'zone-00000d', 'the newest on top');
	} finally { restore(); }
});
