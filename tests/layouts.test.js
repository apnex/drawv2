/*
WD-b1 (H19.45; dev/design/unification/WIDE-DEVICES.md section 12; WD6, WD7) -- EVERY DIAGRAM HOLDS ITS TWO GRIDS, AS STORED
LAYOUTS.

The layouts plugin's row declares the two layouts every document holds (`always`), so a Model holds them from the moment it is
made and completes a document loaded without them; each holds the product's values for its name (WD7), so the planner refuses
an edit that changes one, adds a second of a name, or deletes one. Not selectable, not named, and not an author's work: a fresh
tab counts none of it as work drawn offline.
RESTATED at H26.6's move 14 (dev/design/components/PAN-ZOOM.md section 3.4; PZ14, PZ20, PZ21; GR7) -- ONE STORED GRID: the row of one
entity, `{ id: 'layout-000001', name: 'grid', pitch }`, any other field refused, `pitch` even and held at 60 until move 15; the zone
lattice's origin half the stored pitch, never stored; WD7's refusal and the second record gone.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model, KINDS, plan, validateDoc } from './fixtures/composed.mjs';
import { composeKinds } from '../model/shape.mjs';
import { diagramLattices } from '../kernel/geometry.mjs';
import { LAYOUT_ROWS } from '../plugins/layouts/layout-kind.mjs';
const GRID_RECORD = LAYOUT_ROWS[0].always[0];   // the row's own record

const layouts = (m) => m.all('layout').map((l) => JSON.stringify(l));
const WANT = [JSON.stringify({ id: 'layout-000001', name: 'grid', pitch: 60 })];

test('WD-b1, restated at H26.6 move 14: a fresh Model holds the one grid record, its own copy', () => {
	const a = new Model(), b = new Model();
	assert.deepEqual(layouts(a), WANT);
	assert.notEqual(a.get('layout', 'layout-000001'), GRID_RECORD, 'not the row\'s object');
	a.get('layout', 'layout-000001').pitch = 1;
	assert.equal(b.get('layout', 'layout-000001').pitch, 60, 'one Model\'s copy is its own');
	assert.equal(GRID_RECORD.pitch, 60, 'and the row\'s unchanged');
});

test('WD-b1, restated at H26.6 move 14: a document loaded without its grid is completed; one loaded with it keeps its own', () => {
	const m = new Model();
	m.load({ meta: { id: '00000000000c1201', name: 'x' }, nodes: [{ id: 'node-0c1201', name: 'a', x: 0, y: 0 }] });
	assert.deepEqual(layouts(m), WANT);
	assert.equal(m.all('node').length, 1);
	assert.deepEqual(m.toJSON().layouts, [{ id: 'layout-000001', name: 'grid', pitch: 60 }], 'and saved with it');
});

test('GR7 (H26.6 move 14): a record carrying any field but id, name and pitch is refused -- the zone lattice\'s origin is never stored', () => {
	const m = new Model();
	const put = (entity) => plan(m, [{ op: 'put', kind: 'layout', entity }]);
	for (const [field, value] of [['offset', 30], ['offset', 0], ['ext', { x: 900, y: 480 }], ['origin', { x: 0, y: 0 }], ['zone', 30]]) {
		const r = put({ id: 'layout-000001', name: 'grid', pitch: 60, [field]: value });
		assert.equal(r.ok, false, `a record carrying ${field}`);
		assert.match(r.error, new RegExp(`unknown field layout\\.${field}`), `refused naming ${field}`);
	}
	assert.equal(put({ id: 'layout-000001', name: 'grid', pitch: 60 }).ok, true, 'the record as it is -- the control');
	assert.match(plan(m, [{ op: 'set', kind: 'layout', id: 'layout-000001', patch: { offset: 30 } }]).error, /unknown field layout\.offset/, 'set as well as put');
	// the zone lattice is half the stored pitch, always: opened from the pitch alone
	for (const pitch of [60, 80, 120]) assert.deepEqual(diagramLattices({ pitch }).zone.declaration.origin, { x: pitch / 2, y: pitch / 2 }, `${pitch}: the zone lattice half a square off`);
});

// RESTATED at H26.6's move 15 (PAN-ZOOM.md 3.5; PZ21, ruled): opened -- an even size from 60 to 120, a whole number outside it refused
// naming the range, anything that is not a whole number refused by the field
test('PZ20, PZ21 (H26.6 moves 14 and 15): the pitch is an even size from 60 to 120 -- held at 60 until move 15 opened it', () => {
	const m = new Model();
	const setPitch = (pitch) => plan(m, [{ op: 'set', kind: 'layout', id: 'layout-000001', patch: { pitch } }]);
	for (const pitch of [60, 62, 80, 100, 120]) assert.equal(setPitch(pitch).ok, true, `${pitch} accepted`);
	for (const pitch of [61, 59, 58, 122, 30, 240]) assert.match(setPitch(pitch).error ?? '', new RegExp(`the grid size ${pitch} is refused -- a diagram's grid is an even size from 60 to 120 \\(PZ21\\)`), `${pitch} refused naming the range`);
	for (const pitch of [0, -60, 60.5, '60', null]) assert.match(setPitch(pitch).error ?? '', /invalid value for layout\.pitch/, `${JSON.stringify(pitch)} refused by the field`);
});

test('WD-b1, restated at H26.6 move 14: the planner refuses the grid deleted, a second record, another name; WD7\'s refusal is gone', () => {
	const m = new Model();
	const del = plan(m, [{ op: 'del', kind: 'layout', id: 'layout-000001' }]);
	assert.equal(del.ok, false, 'deleting the grid');
	assert.match(del.error, /the diagram's grid \(layout-000001\) is missing -- every diagram holds it/);
	for (const id of ['layout-000002', 'layout-0c1203']) assert.match(plan(m, [{ op: 'put', kind: 'layout', entity: { id, name: 'grid', pitch: 60 } }]).error ?? '', new RegExp(`${id}: a diagram holds one grid, layout-000001 -- no other layout`), `a second record, ${id}`);
	for (const name of ['node', 'zone', 'Grid']) assert.match(plan(m, [{ op: 'set', kind: 'layout', id: 'layout-000001', patch: { name } }]).error ?? '', /invalid value for layout\.name/, `named ${name}`);
	assert.doesNotMatch(String(plan(m, [{ op: 'set', kind: 'layout', id: 'layout-000001', patch: { pitch: 80 } }]).error), /WD7/, 'no sentence of WD7\'s is left');
	// a whole document holding schema 3's two layouts is refused at load
	const two = { meta: { id: '00000000000c1204', name: 'x', version: 0, schema: 4 }, layouts: [{ id: 'layout-000001', name: 'node', pitch: 60, offset: 0, ext: { x: 900, y: 480 } }, { id: 'layout-000002', name: 'zone', pitch: 60, offset: 30, ext: { x: 930, y: 510 } }], nodes: [] };
	assert.match(String(validateDoc(two)), /layout/, 'schema 3\'s two records in a document are refused');
});

test('WD-b1: a layout is neither selectable nor named', () => {
	assert.equal(KINDS.selectable.includes('layout'), false);
	assert.equal(KINDS.named.includes('layout'), false);
	assert.equal(KINDS.cap?.layout ?? 1, 1, 'and one at most');
});

test('WD-b1: a fresh tab counts nothing as work drawn offline -- the layouts are no author\'s', async () => {
	const { Sync } = await import('../app/src/sync.js');
	const m = new Model();
	assert.equal(Sync.prototype.localEntityCount.call({ model: m }), 0, 'a fresh Model holds its grid and no work');
	m.put('node', { id: 'node-0c1202', name: 'a', x: 0, y: 0 });
	assert.equal(Sync.prototype.localEntityCount.call({ model: m }), 1, 'a node is work -- the control');
});

test('WD-b1: an always-held declaration that is not a list of the kind\'s entities, or holds one twice, is refused', () => {
	const row = (always) => ({ kind: 'probe', owner: 'p', collection: 'probes', selectable: false, named: false, anchor: false, composite: [], optional: [], references: [], fields: { id: () => true }, always });
	assert.throws(() => composeKinds([row([{ id: 'node-000001' }])]), /always-held entities are a list of probe entities/);
	assert.throws(() => composeKinds([row([{ id: 'probe-000001' }, { id: 'probe-000001' }])]), /holds an entity always twice/);
});
