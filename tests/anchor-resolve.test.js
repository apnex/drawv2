import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from '../model/index.mjs';
import { resolveAnchor } from '../server/anchor.mjs';

/*
B189 -- choosing a free anchor is a rule the server must own.

The server ANSWERS occupancy (`anchors?free=1` filters the grid and returns every free anchor) but
nothing server-side SELECTS one. Nearest-by-distance, the outward walk for a direction, the
zone-bounds filter and the midpoint between two nodes were `cli/verbs.mjs` alone, which is why
`place` costs two round trips and why `plan()` cannot resolve a positional intent op.

These hold the resolver to the behaviour the CLI shipped, so moving the rule cannot quietly change
where a node lands. The load-bearing case is the last one: two intents resolved against a model
advanced between them must choose DIFFERENT anchors, because that is what a drafted set needs and
what two round trips buy today.
*/

function doc(nodes = [], extra = {}) {
	const m = new Model();
	m.load({ nodes, links: [], waypoints: [], zones: [], groups: [], ...extra });
	return m;
}
const NODE = (id, name, x, y) => ({ id, name, type: 'server', x, y });

test('near picks the closest free anchor to the reference', () => {
	const m = doc([NODE('node-aa0001', 'lb-1', 0, 0)]);
	const got = resolveAnchor(m, { near: 'lb-1' });
	assert.ok(got.ok, got.error);
	// one pitch away, not the reference's own cell
	assert.equal(Math.abs(got.x) + Math.abs(got.y), 60, `expected one pitch from origin, got ${got.x},${got.y}`);
});

test('near refuses a reference that is not a node, and names it', () => {
	const m = doc([NODE('node-aa0001', 'lb-1', 0, 0)]);
	const got = resolveAnchor(m, { near: 'ghost' });
	assert.equal(got.ok, false);
	assert.match(got.error, /ghost/, 'the refusal names what was not found');
});

test('an occupied anchor is never chosen', () => {
	// ring the origin: every anchor at one pitch is taken, so the nearest free is further out
	const ring = [];
	let n = 0;
	for (const [dx, dy] of [[60, 0], [-60, 0], [0, 60], [0, -60], [60, 60], [-60, -60], [60, -60], [-60, 60]]) {
		ring.push(NODE(`node-bb${String(++n).padStart(4, '0')}`, `r${n}`, dx, dy));
	}
	const m = doc([NODE('node-aa0001', 'lb-1', 0, 0), ...ring]);
	const got = resolveAnchor(m, { near: 'lb-1' });
	assert.ok(got.ok, got.error);
	const taken = new Set(m.toJSON().nodes.map((e) => `${e.x},${e.y}`));
	assert.ok(!taken.has(`${got.x},${got.y}`), `chose an occupied anchor ${got.x},${got.y}`);
});

test('dir places in the direction asked, not merely nearby', () => {
	const m = doc([NODE('node-aa0001', 'lb-1', 0, 0)]);
	const right = resolveAnchor(m, { near: 'lb-1', dir: 'right' });
	assert.ok(right.ok, right.error);
	assert.deepEqual({ x: right.x, y: right.y }, { x: 60, y: 0 });
	const up = resolveAnchor(m, { near: 'lb-1', dir: 'up' });
	assert.ok(up.ok, up.error);
	assert.deepEqual({ x: up.x, y: up.y }, { x: 0, y: -60 });
});

test('dir steps outward past an occupant rather than giving up', () => {
	const m = doc([NODE('node-aa0001', 'lb-1', 0, 0), NODE('node-cc0001', 'blocker', 60, 0)]);
	const got = resolveAnchor(m, { near: 'lb-1', dir: 'right' });
	assert.ok(got.ok, got.error);
	assert.deepEqual({ x: got.x, y: got.y }, { x: 120, y: 0 }, 'stepped over the blocker, staying right');
});

test('between resolves to a free anchor near the midpoint of two nodes', () => {
	const m = doc([NODE('node-aa0001', 'a', -120, 0), NODE('node-aa0002', 'b', 120, 0)]);
	const got = resolveAnchor(m, { between: ['a', 'b'] });
	assert.ok(got.ok, got.error);
	assert.deepEqual({ x: got.x, y: got.y }, { x: 0, y: 0 }, 'the midpoint itself, being free');
});

test('between refuses when an endpoint is missing', () => {
	const m = doc([NODE('node-aa0001', 'a', -120, 0)]);
	const got = resolveAnchor(m, { between: ['a', 'nope'] });
	assert.equal(got.ok, false);
	assert.match(got.error, /nope/);
});

test('inside confines the choice to the zone bounds', () => {
	const m = doc([NODE('node-aa0001', 'far', 0, 0)],
		{ zones: [{ id: 'zone-dd0001', name: 'dmz', x: 300, y: 120, w: 240, h: 120 }] });
	const got = resolveAnchor(m, { inside: 'dmz' });
	assert.ok(got.ok, got.error);
	assert.ok(got.x >= 300 && got.x <= 540 && got.y >= 120 && got.y <= 240,
		`anchor ${got.x},${got.y} fell outside the zone`);
});

test('inside refuses a zone with no free anchor, and names it', () => {
	// a zone one cell wide, with that cell taken
	const m = doc([NODE('node-aa0001', 'squatter', 300, 120)],
		{ zones: [{ id: 'zone-dd0001', name: 'tight', x: 300, y: 120, w: 0, h: 0 }] });
	const got = resolveAnchor(m, { inside: 'tight' });
	assert.equal(got.ok, false);
	assert.match(got.error, /tight/);
});

test('two intents against an advancing model choose different anchors', () => {
	/*
	The reason this rule has to be server-side at all. A drafted set resolves op 2 against the
	document op 1 already changed; resolving both against the same state picks one anchor twice and
	the whole set is refused for occupancy. Measured on the live estate before this existed:
	`node-aa2222 and node-aa1111 occupy the same anchor (0,-60)`.
	*/
	const m = doc([NODE('node-aa0001', 'lb-1', 0, 0)]);
	const first = resolveAnchor(m, { near: 'lb-1' });
	assert.ok(first.ok, first.error);
	m.put('node', NODE('node-ee0001', 'web-01', first.x, first.y));
	const second = resolveAnchor(m, { near: 'lb-1' });
	assert.ok(second.ok, second.error);
	assert.notDeepEqual({ x: first.x, y: first.y }, { x: second.x, y: second.y },
		'the second intent must see the first and move');
});

test('a full canvas refuses rather than returning an occupied anchor', () => {
	const m = doc([NODE('node-aa0001', 'lb-1', 0, 0)],
		{ zones: [{ id: 'zone-dd0001', name: 'box', x: 0, y: 0, w: 0, h: 0 }] });
	const got = resolveAnchor(m, { inside: 'box' });
	assert.equal(got.ok, false, 'the only cell is taken by lb-1');
});

/*
The wiring, not just the rule. These drive `plan()` so the intent op is proven to resolve inside
the transaction that advances the projection -- which is the property the CLI's two round trips buy
today and the one a drafted set cannot get any other way.
*/
test('plan resolves a place op into a put, against the advancing projection', async () => {
	const { plan } = await import('../server/txn.mjs');
	const m = doc([NODE('node-aa0001', 'lb-1', 0, 0)]);
	const r = plan(m, [
		{ op: 'place', kind: 'node', entity: { id: 'node-bb0001', name: 'web-01', type: 'server' }, at: { near: 'lb-1' } },
		{ op: 'place', kind: 'node', entity: { id: 'node-bb0002', name: 'web-02', type: 'server' }, at: { near: 'lb-1' } },
	]);
	assert.ok(r.ok, r.error);
	const puts = r.ops.filter((o) => o.op === 'put' && o.kind === 'node');
	assert.equal(puts.length, 2, 'both intents became puts');
	assert.notDeepEqual(
		{ x: puts[0].entity.x, y: puts[0].entity.y },
		{ x: puts[1].entity.x, y: puts[1].entity.y },
		'two intents in ONE transaction must not land on one anchor',
	);
});

test('plan refuses an unresolvable place op and names which op failed', async () => {
	const { plan } = await import('../server/txn.mjs');
	const m = doc([NODE('node-aa0001', 'lb-1', 0, 0)]);
	const r = plan(m, [
		{ op: 'place', kind: 'node', entity: { id: 'node-bb0001', name: 'ok', type: 'server' }, at: { near: 'lb-1' } },
		{ op: 'place', kind: 'node', entity: { id: 'node-bb0002', name: 'bad', type: 'server' }, at: { near: 'ghost' } },
	]);
	assert.equal(r.ok, false);
	assert.equal(r.opIndex, 1, 'the second op is named');
	assert.match(r.error, /ghost/);
});
