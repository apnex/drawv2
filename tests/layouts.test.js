/*
WD-b1 (H19.45; dev/design/unification/WIDE-DEVICES.md section 12; WD6, WD7) -- EVERY DIAGRAM HOLDS ITS TWO GRIDS, AS STORED
LAYOUTS.

The layouts plugin's row declares the two layouts every document holds (`always`), so a Model holds them from the moment it is
made and completes a document loaded without them; each holds the product's values for its name (WD7), so the planner refuses
an edit that changes one, adds a second of a name, or deletes one. Not selectable, not named, and not an author's work: a fresh
tab counts none of it as work drawn offline.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model, KINDS, plan } from './fixtures/composed.mjs';
import { composeKinds } from '../model/shape.mjs';
import { LAYOUT_TABLE } from '../layouts/layout-table.mjs';
import { STD } from '../kernel/spec.mjs';
import { LAYOUTS } from '../kernel/geometry.mjs';
import { NODE_EXT } from '../model/surface.mjs';

const layouts = (m) => m.all('layout').map((l) => [l.id, l.name, l.pitch, l.offset, l.ext.x, l.ext.y]);
const WANT = [['layout-000001', 'node', 60, 0, 900, 480], ['layout-000002', 'zone', 60, 30, 930, 510]];

test('WD-b1: a fresh Model holds the two layouts, each its own copy', () => {
	const a = new Model(), b = new Model();
	assert.deepEqual(layouts(a), WANT);
	assert.notEqual(a.get('layout', 'layout-000001'), LAYOUT_TABLE[0], 'not the table\'s object');
	a.get('layout', 'layout-000001').ext.x = 1;
	assert.equal(b.get('layout', 'layout-000001').ext.x, 900, 'one Model\'s copy is its own');
	assert.equal(LAYOUT_TABLE[0].ext.x, 900, 'and the table unchanged');
});

test('WD-b1: a document loaded without its layouts is completed; one loaded with them keeps its own', () => {
	const m = new Model();
	m.load({ meta: { id: 'diagram-0c1201', name: 'x' }, nodes: [{ id: 'node-0c1201', name: 'a', x: 0, y: 0 }] });
	assert.deepEqual(layouts(m), WANT);
	assert.equal(m.all('node').length, 1);
	const doc = m.toJSON();
	assert.deepEqual(doc.layouts.map((l) => l.id), ['layout-000001', 'layout-000002'], 'and saved with it');
});

test('WD-b1: the planner refuses a layout deleted, a second of a name added, or a value changed', () => {
	const m = new Model();
	const del = plan(m, [{ op: 'del', kind: 'layout', id: 'layout-000001' }]);
	assert.equal(del.ok, false, 'deleting the node layout');
	assert.match(del.error, /node layout \(layout-000001\) is missing/);
	const second = plan(m, [{ op: 'put', kind: 'layout', entity: { ...structuredClone(LAYOUT_TABLE[0]), id: 'layout-0c1203' } }]);
	assert.equal(second.ok, false, 'a second node layout');
	const changed = plan(m, [{ op: 'set', kind: 'layout', id: 'layout-000002', patch: { pitch: 30 } }]);
	assert.equal(changed.ok, false, 'a changed pitch');
	assert.match(changed.error, /may not vary its grids yet \(WD7\)/);
	const same = plan(m, [{ op: 'put', kind: 'layout', entity: structuredClone(LAYOUT_TABLE[1]) }]);
	assert.equal(same.ok, true, 'putting a layout as it is -- the control');
});

test('WD-b1: a layout is neither selectable nor named; the table is the constants the core and the kernel keep', () => {
	assert.equal(KINDS.selectable.includes('layout'), false);
	assert.equal(KINDS.named.includes('layout'), false);
	assert.deepEqual(LAYOUT_TABLE.map((l) => [l.pitch, l.offset]), [[STD.pitch, LAYOUTS.node.offset], [STD.pitch, LAYOUTS.zone.offset]]);
	assert.deepEqual({ ...LAYOUT_TABLE[0].ext }, { ...NODE_EXT });
});

test('WD-b1: a fresh tab counts nothing as work drawn offline -- the layouts are no author\'s', async () => {
	const { Sync } = await import('../app/src/sync.js');
	const m = new Model();
	assert.equal(Sync.prototype.localEntityCount.call({ model: m }), 0, 'a fresh Model holds its two layouts and no work');
	m.put('node', { id: 'node-0c1202', name: 'a', x: 0, y: 0 });
	assert.equal(Sync.prototype.localEntityCount.call({ model: m }), 1, 'a node is work -- the control');
});

test('WD-b1: an always-held declaration that is not a list of the kind\'s entities, or holds one twice, is refused', () => {
	const row = (always) => ({ kind: 'probe', owner: 'p', collection: 'probes', selectable: false, named: false, anchor: false, composite: [], optional: [], references: [], fields: { id: () => true }, always });
	assert.throws(() => composeKinds([row([{ id: 'node-000001' }])]), /always-held entities are a list of probe entities/);
	assert.throws(() => composeKinds([row([{ id: 'probe-000001' }, { id: 'probe-000001' }])]), /holds an entity always twice/);
});
