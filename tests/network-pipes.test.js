/*
The incubated pipe router -- network/pipes.mjs -- against the three rulings it implements.

Each test states the RULING and asserts its consequence, rather than asserting a route literal. A
router test that pins "A,B,C,D" breaks when an equally valid tie is resolved differently, which
teaches nothing; one that asserts "no route is shorter than this one" holds for every correct router
and fails for every wrong one.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pipeKey, route, routeLink, assignRoutes, preferredRoute, blockersOf } from '../network/pipes.mjs';

const pipes = (...pairs) => pairs.map(([a, b]) => ({ a, b }));

test('SD7: a pipe is its pair, so A-B and B-A are one pipe', () => {
	assert.equal(pipeKey('A', 'B'), pipeKey('B', 'A'), 'the pair must key the same whichever end was drawn first');
	assert.notEqual(pipeKey('A', 'B'), pipeKey('A', 'C'));
});

test('SD9: a route takes the FEWEST pipes, not the shortest length', () => {
	// two ways from A to D: A-B-D is two pipes, A-C1-C2-C3-D is four. Lengths are not involved at
	// all, which is the point -- SD9 ruled pipe count, against the proposer's recommendation.
	const net = pipes(['A', 'B'], ['B', 'D'], ['A', 'C1'], ['C1', 'C2'], ['C2', 'C3'], ['C3', 'D']);
	const r = route(net, 'A', 'D');
	assert.equal(r.length - 1, 2, `the route must take the fewest pipes; it took ${r.length - 1}`);
	assert.deepEqual([r[0], r.at(-1)], ['A', 'D']);
});

test('SD9: every route found is as short as any possible route', () => {
	// asserted as a PROPERTY over a lattice, so it holds for every correct router and fails for
	// every wrong one, however ties happen to resolve
	const net = [];
	const id = (x, y) => `${x},${y}`;
	for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) {
		if (x < 4) net.push({ a: id(x, y), b: id(x + 1, y) });
		if (y < 4) net.push({ a: id(x, y), b: id(x, y + 1) });
	}
	for (const [to, manhattan] of [['4,4', 8], ['2,3', 5], ['4,0', 4], ['0,0', 0]]) {
		const r = route(net, '0,0', to);
		assert.equal(r.length - 1, manhattan, `0,0 to ${to} is ${manhattan} pipes on a lattice; the router took ${r.length - 1}`);
	}
});

test('two peers holding the same pipes find the SAME route, whatever order they learned them in', () => {
	// A5 depends on this: a tie broken by insertion order lets two browsers disagree about where a
	// link runs while agreeing about every stored fact
	const net = pipes(['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'D']);   // two equal ways, a genuine tie
	const forward = route(net, 'A', 'D');
	const reversed = route([...net].reverse(), 'A', 'D');
	assert.deepEqual(reversed, forward, 'pipe order must not decide a tie');
});

test('no route is null, and a link with a leg that has no route is DOWN, not partial', () => {
	const net = pipes(['A', 'B'], ['C', 'D']);   // two islands
	assert.equal(route(net, 'A', 'D'), null);
	// ruled 2026-09-25, "down, and heals": a route that stops halfway is no route
	assert.equal(routeLink(net, { src: 'A', dst: 'D' }), null);
});

test('a link routes through its pins in order, each leg the fewest pipes', () => {
	// intent is ends plus pinned vias (ruled 2026-09-26); between pins the route is derived
	const net = pipes(['A', 'B'], ['B', 'C'], ['C', 'D'], ['A', 'D']);
	assert.deepEqual(routeLink(net, { src: 'A', dst: 'D' }), ['A', 'D'], 'unpinned: the one-pipe way');
	const pinned = routeLink(net, { src: 'A', dst: 'D', via: ['C'] });
	assert.ok(pinned.includes('C'), 'pinned at C: the route must pass C, even though A-D is shorter');
});

/*
PIPES CARRY ONE LINK EACH, FOR NOW -- ruled 2026-09-30 (dev/DECISIONS.md, "Pipes carry one link each, for now").
  1. a pipe carries at most one link, and the limit is one function, `pipeCapacity`
  2. a pipe laid with a link carries only the link whose ends and pins it joins
  3. the older link keeps a contested hand-laid pipe
So a link's route depends on the others, and `assignRoutes` is the one place that shares the pipes out.
*/
const hand = (a, b) => ({ a, b, laid: 'hand' });
const withLink = (a, b) => ({ a, b, laid: 'link' });
// the trunk board: A and C both reach t1, B and D both leave t2, and t1-t2 is the one trunk
const TRUNK = [hand('A', 't1'), hand('C', 't1'), hand('t1', 't2'), hand('t2', 'B'), hand('t2', 'D')];
const UPPER = { id: 'link-u', src: 'A', dst: 'B' }, LOWER = { id: 'link-l', src: 'C', dst: 'D' };

test('a pipe carries one link: the OLDER link keeps a contested hand pipe, and the younger is down', () => {
	const upperOlder = assignRoutes(TRUNK, [LOWER, UPPER], { rankOf: (id) => (id === 'link-u' ? 0 : 1) });
	assert.deepEqual(upperOlder.get('link-u'), ['A', 't1', 't2', 'B'], 'the older link runs the trunk');
	assert.equal(upperOlder.get('link-l'), null, 'the younger has no way left, so it is down');
	// the same board with the ages swapped: age decides, not id or list order
	const lowerOlder = assignRoutes(TRUNK, [UPPER, LOWER], { rankOf: (id) => (id === 'link-l' ? 0 : 1) });
	assert.deepEqual(lowerOlder.get('link-l'), ['C', 't1', 't2', 'D']);
	assert.equal(lowerOlder.get('link-u'), null);
});

test('no pipe is ever carried by two links', () => {
	const routes = assignRoutes(TRUNK, [UPPER, LOWER, { id: 'link-x', src: 'A', dst: 'D' }]);
	const on = new Map();
	for (const [id, r] of routes) if (r) for (let i = 0; i < r.length - 1; i++) { const k = pipeKey(r[i], r[i + 1]); on.set(k, [...(on.get(k) ?? []), id]); }
	assert.ok(on.size > 0, 'something must be routed, or this proves nothing');
	for (const [k, ids] of on) assert.equal(ids.length, 1, `${k} carries ${ids.join(' and ')}`);
});

test('the limit is ONE function (pipeCapacity, 1), and raising it is the one change concurrent links need', () => {
	const one = assignRoutes(TRUNK, [UPPER, LOWER]);
	assert.equal([one.get('link-u'), one.get('link-l')].filter(Boolean).length, 1, 'by default the limit is one: the trunk carries one of the two links');
	const shared = assignRoutes(TRUNK, [UPPER, LOWER], { capacity: () => 2 });
	assert.ok(shared.get('link-u') && shared.get('link-l'), 'at two, both links run the trunk -- the algorithm reads the limit rather than assuming one');
});

test('a pipe laid WITH a link carries only the link whose ends and pins it joins', () => {
	const laid = [withLink('A', 'w'), withLink('w', 'B')];
	const pinned = { id: 'link-p', src: 'A', dst: 'B', via: ['w'] }, free = { id: 'link-f', src: 'A', dst: 'B' };
	const both = assignRoutes(laid, [free, pinned], { rankOf: (id) => (id === 'link-f' ? 0 : 1) });
	assert.deepEqual(both.get('link-p'), ['A', 'w', 'B'], 'its own legs carry the pinned link -- even though the other is older');
	assert.equal(both.get('link-f'), null, 'the unpinned link may not use them: they join none of its stops');
	// HEAL-05 in miniature: once the pinned link is gone, its leftover pipes carry NOTHING, so nothing heals over them
	assert.equal(assignRoutes(laid, [free]).get('link-f'), null, 'a deleted link\'s pipes are no way for another link, so they are swept and leave no trace');
});

test('the preferred route ignores who holds a pipe; the BLOCKERS are the links holding a pipe on it', () => {
	const rankOf = (id) => (id === 'link-u' ? 0 : 1);
	assert.deepEqual(preferredRoute(TRUNK, LOWER), ['C', 't1', 't2', 'D'], 'the way the lower link would take if nobody held anything');
	assert.deepEqual(blockersOf(TRUNK, [UPPER, LOWER], 'link-l', { rankOf }), ['link-u'], 'the upper link holds the trunk the lower one wants');
	assert.deepEqual(blockersOf(TRUNK, [UPPER, LOWER], 'link-u', { rankOf }), [], 'a link that is up has no blockers');
	const cut = { id: 'link-c', src: 'C', dst: 'Z' };
	assert.deepEqual(blockersOf(TRUNK, [UPPER, cut], 'link-c', { rankOf }), [], 'a link down because no way exists at all is blocked by nobody');
});

test('a link with no rank is the NEWEST, so a link being drawn yields to every link already there', () => {
	const routes = assignRoutes(TRUNK, [LOWER, UPPER], { rankOf: (id) => (id === 'link-l' ? 0 : Infinity) });
	assert.ok(routes.get('link-l') && !routes.get('link-u'));
});
