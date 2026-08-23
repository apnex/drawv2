import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model, newId, kindOf } from '../model/index.mjs';

test('newId produces prefixed 6-hex ids and avoids collisions', () => {
	const id = newId('node');
	assert.match(id, /^node-[0-9a-f]{6}$/);
	const taken = {};
	for (let i = 0; i < 200; i++) {
		const next = newId('link', taken);
		assert.ok(!taken[next]);
		taken[next] = true;
	}
});

test('put/get/set/del roundtrip with change events', () => {
	const model = new Model();
	const events = [];
	model.onChange((action, kind, entity) => events.push([action, kind, entity.id]));

	const node = model.makeNode('host', { x: 0, y: 0 });
	model.put('node', node);
	assert.equal(model.get('node', node.id).type, 'host');

	model.set('node', node.id, { x: 60 });
	assert.equal(model.get('node', node.id).x, 60);
	assert.equal(model.get('node', node.id).y, 0); // patch is a merge

	model.del('node', node.id);
	assert.equal(model.get('node', node.id), undefined);
	assert.deepEqual(events.map((e) => e[0]), ['put', 'set', 'del']);
});

test('set/del on missing entities are no-ops', () => {
	const model = new Model();
	assert.equal(model.set('node', 'node-zzzzzz', { x: 1 }), undefined);
	assert.equal(model.del('node', 'node-zzzzzz'), undefined);
});

test('linksOf and linkBetween find connections both ways', () => {
	const model = new Model();
	const a = model.makeNode('host', { x: 0, y: 0 });
	const b = model.makeNode('router', { x: 60, y: 0 });
	model.put('node', a);
	model.put('node', b);
	const link = model.makeLink(a.id, b.id);
	model.put('link', link);

	assert.equal(model.linksOf(a.id).length, 1);
	assert.equal(model.linksOf(b.id).length, 1);
	assert.equal(model.linkBetween(b.id, a.id).id, link.id);
	assert.equal(model.linkBetween(a.id, 'node-zzzzzz'), undefined);
});

test('nextName counts per prefix without collisions', () => {
	const model = new Model();
	model.put('node', { ...model.makeNode('host', { x: 0, y: 0 }) });
	model.put('node', { ...model.makeNode('host', { x: 60, y: 0 }) });
	const names = model.all('node').map((n) => n.name).sort();
	assert.deepEqual(names, ['host-1', 'host-2']);
	assert.equal(model.nextName('router'), 'router-1');
});

test('groupOf finds membership', () => {
	const model = new Model();
	const a = model.makeNode('host', { x: 0, y: 0 });
	const b = model.makeNode('host', { x: 60, y: 0 });
	model.put('node', a);
	model.put('node', b);
	const group = model.makeGroup([a.id, b.id]);
	model.put('group', group);
	assert.equal(model.groupOf(a.id).id, group.id);
	assert.equal(model.groupOf('node-zzzzzz'), undefined);
});

test('toJSON/load roundtrip preserves the document', () => {
	const model = new Model();
	const a = model.makeNode('host', { x: 0, y: 0 });
	const b = model.makeNode('router', { x: 120, y: 60 });
	model.put('node', a);
	model.put('node', b);
	model.put('link', model.makeLink(a.id, b.id));
	model.put('zone', model.makeZone({ x: -90, y: -90, w: 240, h: 180 }));
	model.put('group', model.makeGroup([a.id, b.id]));
	model.state.meta.name = 'demo';

	const doc = model.toJSON();
	const restored = new Model();
	restored.load(doc);
	assert.deepEqual(restored.toJSON(), doc);
	assert.equal(restored.state.meta.name, 'demo');
	assert.equal(restored.all('node').length, 2);
});

test('node shape is a first-class field, defaults to circle, survives roundtrip', () => {
	const model = new Model();
	const a = model.makeNode('host', { x: 0, y: 0 });
	assert.equal(a.shape, 'circle'); // the frame is independent of the glyph type
	const b = model.makeNode('server', { x: 60, y: 0 }, 'square');
	assert.equal(b.shape, 'square');
	model.put('node', a);
	model.put('node', b);
	const restored = new Model();
	restored.load(model.toJSON());
	assert.equal(restored.get('node', a.id).shape, 'circle');
	assert.equal(restored.get('node', b.id).shape, 'square');
});

// ---- shipped-only coverage (model/model.mjs): waypoint kind + link via[] + kindOf ----

test('waypoint entities are a first-class kind that round-trips put/get + toJSON/load', () => {
	const model = new Model();
	const w = model.makeWaypoint({ x: 60, y: -120 });
	assert.match(w.id, /^waypoint-[0-9a-f]{6}$/);
	model.put('waypoint', w);
	assert.deepEqual(
		[model.get('waypoint', w.id).x, model.get('waypoint', w.id).y],
		[60, -120]
	);
	assert.equal(model.all('waypoint').length, 1);

	const doc = model.toJSON();
	assert.equal(doc.waypoints.length, 1);
	const restored = new Model();
	restored.load(doc);
	assert.deepEqual(
		[restored.get('waypoint', w.id).x, restored.get('waypoint', w.id).y],
		[60, -120],
		'waypoint position survives the persist/restore round-trip'
	);
});

test("a link's via:[waypointId] bend array survives toJSON/load", () => {
	const model = new Model();
	const a = model.makeNode('host', { x: 0, y: 0 });
	const b = model.makeNode('router', { x: 240, y: 0 });
	model.put('node', a);
	model.put('node', b);
	const w = model.makeWaypoint({ x: 120, y: 60 });
	model.put('waypoint', w);
	const link = model.makeLink(a.id, b.id);
	link.via = [w.id]; // route threads through the waypoint pivot
	model.put('link', link);

	const restored = new Model();
	restored.load(model.toJSON());
	assert.deepEqual(restored.get('link', link.id).via, [w.id], 'via[] preserved across round-trip');
	// linksAt finds the link by its via-role reference to the waypoint
	assert.equal(model.linksAt(w.id).length, 1);
	assert.equal(model.linksAt(w.id)[0].id, link.id);
});

test('kindOf derives the kind from the id of each kind', () => {
	const model = new Model();
	const node = model.makeNode('host', { x: 0, y: 0 });
	const wp = model.makeWaypoint({ x: 0, y: 0 });
	const link = model.makeLink(node.id, wp.id);
	const zone = model.makeZone({ x: 30, y: 30, w: 60, h: 60 });
	const group = model.makeGroup([node.id]);
	assert.equal(kindOf(node.id), 'node');
	assert.equal(kindOf(wp.id), 'waypoint');
	assert.equal(kindOf(link.id), 'link');
	assert.equal(kindOf(zone.id), 'zone');
	assert.equal(kindOf(group.id), 'group');
});

/*
pathOf — resolving a ROUTE to a PATH (docs/spec/HIERARCHY.md §0, connection taxonomy).

A route is an ordered list of anchors and carries no coordinates; a path is an ordered list of
coordinates and carries no identity. `link` owns a route (`src`, `via[]`, `dst`); this resolves it.

It lives in `model/` because document owns the entities that carry the coordinates — the kernel
never sees a Model. It returns `[[x,y],…]`, the canonical PATH shape, so the value hands straight to
the kernel's `roundedPath` with no conversion at any consumer. Entities are `{x,y}`; paths are
tuples. Two shapes, one rule.

Before this existed the resolution was hand-rolled at four sites and two of them were wrong (B29):
the data view measured straight-line distance ignoring `via`, and re-plug handles were positioned on
the straight src→dst line.
*/

const linked = () => {
	const m = new Model();
	const a = m.makeNode('host', { x: 0, y: 0 });
	const b = m.makeNode('host', { x: 120, y: 0 });
	const w = m.makeWaypoint({ x: 60, y: 60 });
	[['node', a], ['node', b], ['waypoint', w]].forEach(([k, e]) => m.put(k, e));
	return { m, a, b, w };
};

test('pathOf: a straight link is a two-point path', () => {
	const { m, a, b } = linked();
	const l = m.makeLink(a.id, b.id);
	m.put('link', l);
	assert.deepEqual(m.pathOf(l), [[0, 0], [120, 0]]);
});

test('pathOf: a routed link threads its via anchors in order', () => {
	const { m, a, b, w } = linked();
	const l = { ...m.makeLink(a.id, b.id), via: [w.id] };
	m.put('link', l);
	assert.deepEqual(m.pathOf(l), [[0, 0], [60, 60], [120, 0]], 'src, then every bend, then dst');
});

test('pathOf: a waypoint may be an ENDPOINT, not only a bend', () => {
	const { m, a, w } = linked();
	const l = m.makeLink(a.id, w.id);
	m.put('link', l);
	assert.deepEqual(m.pathOf(l), [[0, 0], [60, 60]], 'an anchor is an anchor — node or waypoint');
});

test('pathOf: a dangling route resolves to nothing, never a partial path', () => {
	const { m, a } = linked();
	const l = m.makeLink(a.id, 'node-dead01');
	m.put('link', l);
	assert.equal(m.pathOf(l), null, 'half a path would render as a line to nowhere');
	const l2 = { ...m.makeLink(a.id, a.id), via: ['waypoint-dead1'] };
	assert.equal(m.pathOf(l2), null, 'a missing BEND is as dangling as a missing end');
});
