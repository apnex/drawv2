/*
The incubated pipe router -- network/pipes.mjs -- against the three rulings it implements.

Each test states the RULING and asserts its consequence, rather than asserting a route literal. A
router test that pins "A,B,C,D" breaks when an equally valid tie is resolved differently, which
teaches nothing; one that asserts "no route is shorter than this one" holds for every correct router
and fails for every wrong one.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pipeKey, route, routeLink } from '../network/pipes.mjs';

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
