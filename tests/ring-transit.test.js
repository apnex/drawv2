/*
B299 -- turning transit off at a waypoint a closed ring is pinned at opens the ring there (ruled 2026-10-07).

TR-2 cuts an open link at a pin whose transit goes off, so it ends there. A ring was skipped -- "a ring has no ends to cut
toward" -- and the edit did nothing to it: found by the director on production, on the arrow template, a ring through six
waypoints. Ruled: the ring OPENS at that waypoint into one link that starts there, runs round every other stop and ends
there again (a LOOP), the waypoint its endpoint; turning transit back on closes it into a ring again; undo restores it.
The drawing does not move: the loop runs the ring's own legs, its closing leg among them.
*/
import { pathOf, isLinkDown } from '../network/network-queries.mjs';   // Q-a: the network's questions
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from '../model/model.mjs';
import { applyOps } from '../model/ops.mjs';
import { plan } from '../planner/txn.mjs';
import { createNetwork } from '../network/network.mjs';
import { createTransit } from '../network/transit.mjs';
import { productKinds } from '../product/kinds.mjs';
import { NETWORK_ROWS } from '../network/kinds.mjs';
import { pipeEntity } from '../network/pipe-kind.mjs';
import { waypointRolesIn } from '../network/roles.mjs';
import { validateDoc } from './fixtures/composed.mjs';

const KINDS = productKinds(...NETWORK_ROWS);
const NET = createNetwork(createTransit());
const A = 'node-00000a', P = 'node-0000f1', Q = 'node-0000f2', B = 'node-00000b';
// a ring A -> P -> Q -> B -> A over the pipes of its legs, the closing leg B-A among them
function ring() {
	const m = new Model({ attached: { network: NET }, kinds: KINDS });
	m.put('node', { id: A, name: 'A', x: -240, y: 0 });
	m.put('node', { id: P, name: 'P', x: 0, y: -120 });
	m.put('node', { id: Q, name: 'Q', x: 240, y: 0 });
	m.put('node', { id: B, name: 'B', x: 0, y: 120 });
	m.put('link', { id: 'link-000001', name: 'ring', order: 1, src: A, via: [P, Q], dst: B, closed: true, direction: 'forward' });
	for (const [a, b] of [[A, P], [P, Q], [Q, B], [B, A]]) m.put('pipe', pipeEntity(a, b, 'link'));
	return m;
}
const transit = (m, sets) => {
	const r = plan(m, sets.map(([id, on]) => (on ? { op: 'put', kind: 'node', entity: (({ transit: _t, ...e }) => e)(m.get('node', id)) } : { op: 'set', kind: 'node', id, patch: { transit: false } })), { links: NET.links, kinds: KINDS });
	assert.equal(r.ok, true, r.error);
	applyOps(m, r.ops);
	return r;
};
const stops = (l) => [l.src, ...(l.via ?? []), l.dst];

test('B299: transit off at a ring\'s pin opens the ring there -- one loop starting and ending at it, the drawing unmoved', () => {
	const m = ring(), before = pathOf(m, m.get('link', 'link-000001'));
	transit(m, [[P, false]]);
	assert.equal(m.all('link').length, 1, 'still one link');
	const l = m.get('link', 'link-000001');
	assert.deepEqual(stops(l), [P, Q, B, A, P], 'it starts at P, runs round every other stop in the ring\'s order, and ends at P');
	assert.equal(!!l.closed, false, 'open');
	assert.deepEqual([l.order, l.direction, l.name], [1, 'forward', 'ring'], 'its id, order, name and declarations kept');
	assert.equal(isLinkDown(m, l), false, 'and up');
	const points = (path) => [...new Set(path.map(String))].sort();   // a loop's path names P at both ends; a ring's, once
	assert.deepEqual(points(pathOf(m, l)), points(before), 'drawn through the same points: the ring\'s own legs');
	assert.deepEqual(waypointRolesIn(m, P), ['endpoint'], 'P is its endpoint, never a junction');
	const d = m.toJSON();
	assert.equal(validateDoc({ ...d, meta: { ...d.meta, id: 'diagram-0f0002', name: 'ring' } }), null, 'and the document is valid');
});

test('B299: turning it back on closes it into a ring again, through P', () => {
	const m = ring();
	transit(m, [[P, false]]);
	assert.equal(!!m.get('link', 'link-000001').closed, false, 'opened first -- else closing it again proves nothing');
	transit(m, [[P, true]]);
	const l = m.get('link', 'link-000001');
	assert.equal(l.closed, true, 'a ring again');
	assert.equal(new Set(stops(l)).size, 4, 'through each stop once');
	assert.ok(stops(l).includes(P), 'P among them');
	assert.equal(waypointRolesIn(m, P).includes('endpoint'), false, 'and P no longer an end');
	assert.equal(isLinkDown(m, l), false);
});

test('B299: undo restores the ring exactly', () => {
	const m = ring(), was = structuredClone(m.get('link', 'link-000001'));
	const r = transit(m, [[P, false]]);
	assert.ok(r.ops.some((o) => o.kind === 'link'), 'the edit changed the ring -- else undoing it proves nothing');
	applyOps(m, r.inverse);
	assert.deepEqual(m.get('link', 'link-000001'), was);
});

test('B299: two of a ring\'s pins off in one edit -- opened at the first, cut at the second: two links, each ending at both', () => {
	const m = ring();
	transit(m, [[P, false], [B, false]]);
	assert.equal(m.all('link').length, 2);
	const ends = m.all('link').map((l) => [l.src, l.dst].sort().join('|')).sort();
	assert.deepEqual(ends, [[B, P].sort().join('|'), [B, P].sort().join('|')], 'both run between P and B, one each way round');
	assert.equal(m.all('link').filter((l) => l.closed).length, 0);
});

test('B299: a loop is valid only open and round two or more other stops; a closed one, or one round a single stop, is a self-link', () => {
	const doc = (link) => ({ meta: { id: 'diagram-0f0001', name: 'l', version: 0, schema: 2 },
		nodes: [A, P, Q].map((id, i) => ({ id, name: id, x: i * 120, y: 0 })), links: [{ id: 'link-0f0001', name: 'l', ...link }],
		pipes: [], zones: [], groups: [], selection: [] });
	assert.equal(validateDoc(doc({ src: A, via: [P, Q], dst: A })), null, 'open, round two stops: a loop');
	assert.match(validateDoc(doc({ src: A, via: [P, Q], dst: A, closed: true })), /self-link/, 'closed: no');
	assert.match(validateDoc(doc({ src: A, via: [P], dst: A })), /self-link/, 'round one stop it would draw back over itself');
	assert.match(validateDoc(doc({ src: A, dst: A })), /self-link/, 'nothing between: no');
	assert.match(validateDoc(doc({ src: A, via: [P, A], dst: A })), /self-link|two roles/, 'naming its end again among its stops: no');
});

test('B299: the transit edit says what it did to the ring -- opened, or closed again', async () => {
	const { transitSummary } = await import('../network/transit.mjs');
	const m = ring();
	const off = transitSummary(transit(m, [[P, false]]).ops);
	assert.deepEqual([off.opened, off.closed, off.cut], [1, 0, null], 'opened, and nothing cut');
	const on = transitSummary(transit(m, [[P, true]]).ops);
	assert.deepEqual([on.opened, on.closed, on.joined], [0, 1, null], 'closed again, and nothing joined');
});

/*
B300 -- the pieces of a ring cut at two waypoints rejoin when transit returns, whatever the order (the director, testing the
fix on the arrow: "no longer re-joins into corners"). The two links ran between P and B, one each way round; turning B back
on joined nothing, since the join refused a result beginning and ending at one anchor. A loop may come of a join now, and a
loop whose end passes what arrives closes into a ring -- a loop exists only while its end's transit is off.
*/
const cutTwice = () => { const m = ring(); transit(m, [[P, false]]); transit(m, [[B, false]]); assert.equal(m.all('link').length, 2, 'cut into two -- the state under test'); return m; };
const isRing = (m) => m.all('link').length === 1 && m.all('link')[0].closed === true && new Set(stops(m.all('link')[0])).size === 4;

test('B300: B back on joins the two pieces into one loop, still ending at P, whose transit is off', () => {
	const m = cutTwice();
	transit(m, [[B, true]]);
	assert.equal(m.all('link').length, 1, 'joined at B');
	const l = m.all('link')[0];
	assert.deepEqual([l.src, l.dst, !!l.closed], [P, P, false], 'a loop at P');
	assert.ok(stops(l).includes(B), 'B a corner again');
});

test('B300: then P back on closes it -- the ring is whole', () => {
	const m = cutTwice();
	transit(m, [[B, true]]);
	transit(m, [[P, true]]);
	assert.ok(isRing(m), JSON.stringify(m.all('link')));
});

test('B300: in the other order, P on then B on, the ring is whole', () => {
	const m = cutTwice();
	transit(m, [[P, true]]);
	assert.equal(m.all('link').length, 1, 'joined at P, a loop at B');
	transit(m, [[B, true]]);
	assert.ok(isRing(m), JSON.stringify(m.all('link')));
});

test('B300: both back on in one edit, the ring is whole', () => {
	const m = cutTwice();
	transit(m, [[P, true], [B, true]]);
	assert.ok(isRing(m), JSON.stringify(m.all('link')));
	assert.equal(isLinkDown(m, m.all('link')[0]), false);
});

/*
B301, restated at H19.10 (ruled 2026-10-07, "A device is an endpoint or a junction"): a ring through routers whose transit is on
passes them as junctions, so it opens like any ring -- the routers pins of the loop. Until H19.10 such a ring was left as it
was, since a pin had to be a waypoint and opening it would have saved a document the validator refused.
*/
test('B301, H19.10: a ring whose ends are routers opens at its waypoint, the routers pinned through, and the document stays valid', () => {
	const m = new Model({ attached: { network: NET }, kinds: KINDS });
	m.put('node', { id: A, name: 'A', type: 'router', x: -240, y: 0, shape: 'circle' });
	m.put('node', { id: P, name: 'P', x: 0, y: -120 });
	m.put('node', { id: B, name: 'B', type: 'router', x: 240, y: 0, shape: 'circle' });
	m.put('link', { id: 'link-000001', name: 'ring', order: 1, src: A, via: [P], dst: B, closed: true });
	for (const [a, b] of [[A, P], [P, B], [B, A]]) m.put('pipe', pipeEntity(a, b, 'link'));
	transit(m, [[P, false]]);
	const l = m.get('link', 'link-000001');
	assert.deepEqual([l.src, l.via, l.dst, !!l.closed], [P, [B, A], P, false], 'opened at P, through B and A');
	const d = m.toJSON();
	assert.equal(validateDoc({ ...d, meta: { ...d.meta, id: 'diagram-0f0003', name: 'r' } }), null, 'and the document valid');
});
