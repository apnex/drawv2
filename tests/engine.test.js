import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from '../model/index.mjs';
import { attachRelations } from '../engine/index.mjs';
import { cellOf, px, STD } from '../kernel/index.mjs';

// R5 — the engine stages `atCell` (a logical cell EDB atom) off the entity, via the kernel's
// single-sourced px→cell primitive. These are the FIRST suite tests over the app/src + engine +
// kernel substrate (the rest of the suite targets the legacy client/ + server/).

test('cellOf is the inverse of px() and rounds to the nearest cell', () => {
	for (const c of [-15, -1, 0, 1, 7, 16]) assert.equal(cellOf(px(c)), c);
	assert.equal(cellOf(0), 0);
	assert.equal(cellOf(STD.pitch / 2 - 1), 0);          // just below the half-cell boundary
	assert.equal(cellOf(STD.pitch / 2 + 1), 1);          // just above
	assert.equal(cellOf(STD.pitch / 2), 1);              // exact half-cell tie rounds up (Math.round)
	assert.equal(cellOf(-STD.pitch), -1);
	assert.ok(Object.is(cellOf(-STD.pitch / 2), 0));     // signed zero normalized: -0 → +0 (no "-0" cell key)
});

function seeded() {
	const m = new Model();
	attachRelations(m, { cellOf });                      // inject px→cell; sets m.index = the maintained relations
	const n = m.makeNode('router', { x: 120, y: -60 }); m.put('node', n);
	const w = m.makeWaypoint({ x: 0, y: 180 });          m.put('waypoint', w);
	const l = m.makeLink(n.id, w.id);                    m.put('link', l);
	const z = m.makeZone({ x: 30, y: 30, w: 60, h: 60 }); m.put('zone', z);
	const g = m.makeGroup([n.id]);                       m.put('group', g);
	return { m, n, w, l, z, g };
}

test('atCell derives [cellOf(x), cellOf(y)] for the cell-placed kinds', () => {
	const { m, n, w } = seeded();
	assert.deepEqual(m.index.atCell(n.id), [cellOf(n.x), cellOf(n.y)]);
	assert.deepEqual(m.index.atCell(n.id), [2, -1]);     // 120/60, -60/60
	assert.deepEqual(m.index.atCell(w.id), [cellOf(w.x), cellOf(w.y)]);
	assert.deepEqual(m.index.atCell(w.id), [0, 3]);
});

test('atCell is undefined for non-placed kinds and unknown ids', () => {
	const { m, l, z, g } = seeded();
	assert.equal(m.index.atCell(l.id), undefined);
	assert.equal(m.index.atCell(z.id), undefined);
	assert.equal(m.index.atCell(g.id), undefined);
	assert.equal(m.index.atCell('node-deadbe'), undefined);
});

test('atCell is non-authoritative: it stores nothing on the entity (off-entity)', () => {
	const { m, n } = seeded();
	const before = JSON.stringify(m.get('node', n.id));
	m.index.atCell(n.id);
	assert.equal(JSON.stringify(m.get('node', n.id)), before);   // no field leaked onto the doc entity
	assert.ok(!('atCell' in m.get('node', n.id)));
	const wire = m.toJSON();                                     // and the persisted/wire shape never carries it
	assert.ok(wire.nodes.every((nd) => !('atCell' in nd)));
});

test('atCell is derived, not cached: it tracks a move with no index maintenance', () => {
	const { m, n } = seeded();
	m.set('node', n.id, { x: 300, y: 0 });               // a position set: occupancy index follows; atCell re-derives on read
	assert.deepEqual(m.index.atCell(n.id), [5, 0]);      // re-derived from the new px on the next read
});

test('atCell normalizes signed zero (an entity on a negative half-cell yields +0, not -0)', () => {
	const m = new Model();
	attachRelations(m, { cellOf });
	const n = m.makeNode('router', { x: -30, y: 0 });    // -30/60 = -0.5 → Math.round = -0 before normalization
	m.put('node', n);
	const [cx, cy] = m.index.atCell(n.id);
	assert.ok(Object.is(cx, 0) && Object.is(cy, 0));     // not -0 — so a future occupied(cell) key won't split
});

// ---- R13: the eager occupied(cell) index + occupancy queries (px point → cell) ----

test('occupiedAt is node-only; occupiedAnyAt includes waypoints', () => {
	const { m, n, w } = seeded();
	assert.equal(m.occupiedAt({ x: n.x, y: n.y }), true);          // a node rests here
	assert.equal(m.occupiedAnyAt({ x: n.x, y: n.y }), true);
	assert.equal(m.occupiedAt({ x: w.x, y: w.y }), false);         // a waypoint is NOT node-occupancy
	assert.equal(m.occupiedAnyAt({ x: w.x, y: w.y }), true);       // but it is any-occupancy
	assert.equal(m.occupiedAt({ x: 600, y: 480 }), false);         // empty cell
	assert.equal(m.occupiedAnyAt({ x: 600, y: 480 }), false);
});

test('occupancy index === px-scan fallback for grid-snapped points (parity)', () => {
	const withIndex = seeded().m;                                  // engine attached → index path
	const scan = new Model();                                      // detached → scan path (index === null)
	scan.put('node', scan.makeNode('router', { x: 120, y: -60 }));
	scan.put('waypoint', scan.makeWaypoint({ x: 0, y: 180 }));
	assert.equal(scan.index, null);
	for (const p of [{ x: 120, y: -60 }, { x: 0, y: 180 }, { x: 600, y: 0 }]) {
		assert.equal(withIndex.occupiedAt(p), scan.occupiedAt(p), `occupiedAt parity @ ${p.x},${p.y}`);
		assert.equal(withIndex.occupiedAnyAt(p), scan.occupiedAnyAt(p), `occupiedAnyAt parity @ ${p.x},${p.y}`);
	}
});

test('occupancy is maintained eagerly across put / set / del', () => {
	const m = new Model(); attachRelations(m, { cellOf });
	const n = m.makeNode('router', { x: 0, y: 0 }); m.put('node', n);
	assert.equal(m.occupiedAt({ x: 0, y: 0 }), true);
	m.set('node', n.id, { x: 120, y: 0 });                        // move one cell over
	assert.equal(m.occupiedAt({ x: 0, y: 0 }), false, 'old cell freed');
	assert.equal(m.occupiedAt({ x: 120, y: 0 }), true, 'new cell occupied');
	m.del('node', n.id);
	assert.equal(m.occupiedAt({ x: 120, y: 0 }), false, 'del frees the cell');
});

test('Set<id> buckets keep legal at-rest co-occupancy correct (no premature eviction)', () => {
	const m = new Model(); attachRelations(m, { cellOf });
	const a = m.makeNode('router', { x: 60, y: 60 }); m.put('node', a);
	const b = m.makeNode('host', { x: 60, y: 60 });   m.put('node', b);   // two nodes, one cell (move/nudge don't gate)
	assert.equal(m.occupiedAt({ x: 60, y: 60 }), true);
	m.del('node', a.id);
	assert.equal(m.occupiedAt({ x: 60, y: 60 }), true, 'still occupied by the sibling');
	m.del('node', b.id);
	assert.equal(m.occupiedAt({ x: 60, y: 60 }), false, 'empty only when the last leaves');
});

test('occupancy rebuilds on document load with no carry-over', () => {
	const m = new Model(); attachRelations(m, { cellOf });
	m.put('node', m.makeNode('router', { x: 240, y: 120 }));
	assert.equal(m.occupiedAt({ x: 240, y: 120 }), true);
	m.load({ meta: { id: '' }, nodes: [{ id: 'node-ffff01', type: 'host', x: -120, y: -60 }], waypoints: [], links: [], zones: [], groups: [] });
	assert.equal(m.occupiedAt({ x: 240, y: 120 }), false, 'prior document cleared');
	assert.equal(m.occupiedAt({ x: -120, y: -60 }), true, 'loaded document indexed');
});

test('waypointAt resolves the waypoint entity at a cell (index path)', () => {
	const { m, w } = seeded();
	assert.equal(m.waypointAt({ x: w.x, y: w.y })?.id, w.id);
	assert.equal(m.waypointAt({ x: 600, y: 600 }), undefined);
});

test('waypointAt resolves co-occupancy in collection order (parity with the old find)', () => {
	const m = new Model(); attachRelations(m, { cellOf });
	const w1 = m.makeWaypoint({ x: 60, y: 0 }); m.put('waypoint', w1);
	const w2 = m.makeWaypoint({ x: 60, y: 0 }); m.put('waypoint', w2);   // legal stack — move/nudge don't gate
	assert.equal(m.waypointAt({ x: 60, y: 0 })?.id, w1.id, 'first in collection order, like the old all().find');
});

test('makeRelations fails fast without an injected cellOf', () => {
	assert.throws(() => attachRelations(new Model()), /cellOf/);   // cellOf is mandatory since R13
});

// ---- S2 parity oracle: the two snapshot-diff hard cases NOT previously exercised THROUGH THE INDEX
//      (engine.test.js only diffed occupancy; incidence-via-change + membership-reassign ran scan-only).
//      These gate the engine/ivm.mjs extraction: a maintainIndex that drops the snapshot-diff or the
//      single-value re-ownership guard goes red here. ----

test('incidence snapshot-diff: a link via-change reroutes linksAt (index === scan)', () => {
	const m = new Model();
	const { detach } = attachRelations(m, { cellOf });
	const n1 = m.makeNode('host', { x: 0, y: 0 }); m.put('node', n1);
	const n2 = m.makeNode('host', { x: 300, y: 0 }); m.put('node', n2);
	const w1 = m.makeWaypoint({ x: 60, y: 0 }); m.put('waypoint', w1);
	const w2 = m.makeWaypoint({ x: 120, y: 0 }); m.put('waypoint', w2);
	const l = { ...m.makeLink(n1.id, n2.id), via: [w1.id] }; m.put('link', l);
	m.set('link', l.id, { via: [w2.id] });   // ONE set delivers only the new link — the snapshot-diff hard case
	const idxW1 = m.linksAt(w1.id).map((x) => x.id), idxW2 = m.linksAt(w2.id).map((x) => x.id);   // index path
	detach();                                                              // SAME model, same ids → scan path (the oracle)
	assert.equal(m.index, null);
	assert.deepEqual(idxW1, m.linksAt(w1.id).map((x) => x.id), 'linksAt(w1) index === scan');
	assert.deepEqual(idxW2, m.linksAt(w2.id).map((x) => x.id), 'linksAt(w2) index === scan');
	assert.deepEqual(idxW1, []);              // w1 lost the link (old ref removed by the diff)
	assert.deepEqual(idxW2, [l.id]);         // w2 gained it (new ref added)
});

test('membership re-ownership: a member reassigned (add-to-B before remove-from-A) stays owned (index === scan)', () => {
	const m = new Model();
	const { detach } = attachRelations(m, { cellOf });
	const ids = [];
	for (let i = 0; i < 4; i++) { const n = m.makeNode('host', { x: i * 60, y: 0 }); m.put('node', n); ids.push(n.id); }
	const [a, b, c, d] = ids;
	const A = m.makeGroup([a, b]); m.put('group', A);
	const B = m.makeGroup([c, d]); m.put('group', B);
	m.set('group', B.id, { members: [c, d, a] });   // B owns `a` FIRST
	m.set('group', A.id, { members: [b] });          // A drops `a` — the guard must NOT un-own it (it's B's now)
	const idxOwner = m.groupOf(a)?.id;                                     // index path
	detach();                                                              // SAME model → scan path (the oracle)
	assert.equal(m.index, null);
	assert.equal(idxOwner, m.groupOf(a)?.id, 'groupOf(a) index === scan');
	assert.equal(idxOwner, B.id);            // owned by B, NOT undefined
});
