/*
The incubated whole-route check for `g` -- network/guide.mjs.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkGuidedRoute, pipeAnchors, routesOf, isStranded } from '../network/guide.mjs';
import { assignRoutes } from '../network/pipes.mjs';

const pipes = (...pairs) => pairs.map(([a, b]) => ({ a, b, laid: 'hand' }));

test('a guided route that passes its guide is accepted, and says which pipes to lay', () => {
	// A to B through guide G, with no pipes yet: the drag lays A-G and G-B, and the fewest-pipes
	// route over them runs through G
	const v = checkGuidedRoute([], { src: 'A', dst: 'B', pins: [], guides: ['G'], stops: ['A', 'G', 'B'] });
	assert.equal(v.ok, true, v.reason);
	assert.deepEqual(v.route, ['A', 'G', 'B']);
	assert.deepEqual(v.legs.map((l) => `${l.a}-${l.b}`), ['A-G', 'G-B']);
});


test('legs touching a guide are laid BY HAND; the rest WITH THE LINK', () => {
	// T4: a guide's pipes outlive the link, because the author chose that geometry
	const v = checkGuidedRoute([], { src: 'A', dst: 'B', pins: ['P'], guides: ['G'], stops: ['A', 'P', 'G', 'B'] });
	assert.equal(v.ok, true, v.reason);
	const laid = Object.fromEntries(v.legs.map((l) => [`${l.a}-${l.b}`, l.laid]));
	assert.deepEqual(laid, { 'A-P': 'link', 'P-G': 'hand', 'G-B': 'hand' });
});

test('the check is PURE: it lays nothing in the pipes it was given', () => {
	// the caller lays the legs only after the planner accepts the link, so a refused link leaves no
	// pipes behind -- which holds only if this function does not lay them itself
	const existing = pipes(['X', 'Y']);
	const before = JSON.stringify(existing);
	checkGuidedRoute(existing, { src: 'A', dst: 'B', pins: [], guides: ['G'], stops: ['A', 'G', 'B'] });
	assert.equal(JSON.stringify(existing), before);
});



test('a DOWN link keeps its own drawn legs when pipes are swept, so it can heal onto them', () => {
	// with no pipes at all the link has no route; its intent legs must still count as in use
	const r = routesOf([], [{ src: 'A', dst: 'B', via: ['P'] }]);
	assert.deepEqual(r, [['A', 'P', 'B']]);
});

// a minimal model: which anchors exist, and which links it holds
const model = (anchors, links = []) => ({
	get: (kind, id) => (anchors.includes(id) ? { id } : undefined),
	all: (kind) => (kind === 'link' ? links : []),
});

test('a HAND pipe references its anchors while both exist, with or without a link', () => {
	assert.deepEqual([...pipeAnchors(pipes(['A', 'B'], ['B', 'C']), model(['A', 'B', 'C']))].sort(), ['A', 'B', 'C']);
});

test('a pipe references its anchors only while both ends exist', () => {
	// judged against the model the planner hands over: a pipe whose other end this transaction deletes
	// must not shelter the survivor from the sweep
	assert.deepEqual([...pipeAnchors(pipes(['A', 'B'], ['B', 'C']), model(['B', 'C']))].sort(), ['B', 'C']);
});

test('a pipe laid WITH A LINK references its anchors only while a link in that model runs over it', () => {
	// the director's defect: deleting a w-chain link left its pins, sheltered by its own dying pipes
	const laidWithLink = [{ a: 'A', b: 'P', laid: 'link' }, { a: 'P', b: 'B', laid: 'link' }];
	const link = { src: 'A', dst: 'B', via: ['P'] };
	assert.ok(pipeAnchors(laidWithLink, model(['A', 'P', 'B'], [link])).has('P'), 'before the delete, the link runs over them');
	assert.ok(!pipeAnchors(laidWithLink, model(['A', 'P', 'B'], [])).has('P'), 'after it, they carry no link and shelter nothing');
});



test('a refused drag keeps its guides and their hand pipes, and drops what existed only for the link', async () => {
	const { keptOnRefusal } = await import('../network/guide.mjs');
	// A -> P (w, placed) -> G (g, placed) -> B, refused
	const verdict = { ok: false, legs: [{ a: 'A', b: 'P', laid: 'link' }, { a: 'P', b: 'G', laid: 'hand' }, { a: 'G', b: 'B', laid: 'hand' }] };
	const k = keptOnRefusal(verdict, { guides: ['G'], placed: ['P', 'G'] });
	assert.deepEqual(k.keep, ['G'], 'the guide survives');
	assert.deepEqual(k.legs.map((l) => `${l.a}-${l.b}`), ['G-B'],
		'its hand pipe to B survives; P-G does not, because P -- placed only for the refused link -- is going');
	assert.deepEqual(k.placedKept, ['G'], 'and G is new, so its pipe waits for the planner to accept it');
});

/*
A LINK LEFT WITH NO WAY after losing a pin is deleted whole -- ruled 2026-09-29. Asked, for a w-chain
S-P1-P2-P3-E with P2 deleted, the director chose "Delete the whole link" over "Stay, shown down".

`isStranded` answers "no way" for the planner, judged over the pipes that SURVIVE in the model it is
handed: a pipe to an anchor this edit deletes is not a pipe (SD7), so it can give no way. A pipe laid
with another link still counts -- a link routed over it would carry it, so the sweep would keep it.
*/
test('a link is stranded when no route over the SURVIVING pipes runs through its pins to its ends', () => {
	// S-P1-P2-P3-E built with g hops, so its pipes are hand-laid; P2 is then deleted, and the link pins P1 and P3
	const chain = pipes(['S', 'P1'], ['P1', 'P2'], ['P2', 'P3'], ['P3', 'E']);
	const link = { src: 'S', dst: 'E', via: ['P1', 'P3'] };
	assert.equal(isStranded(chain, link, model(['S', 'P1', 'P3', 'E'])), true, 'the only way P1 to P3 ran through P2, which is gone -- its pipes must not count');
	assert.equal(isStranded(chain, link, model(['S', 'P1', 'P2', 'P3', 'E'])), false, 'the same pipes with P2 still standing are a way');
	// a pipe laid WITH a link carries only the link whose stops it joins (2026-09-30): pipes laid for P2 are no way for a link that no longer pins it
	const laidForP2 = chain.map((x) => ({ ...x, laid: 'link' }));
	assert.equal(isStranded(laidForP2, link, model(['S', 'P1', 'P2', 'P3', 'E'])), true, 'P1-P2 and P2-P3 join none of its stops now, so they carry nothing for it');
});

test('another way over hand pipes re-routes the link (2026-09-26); a way laid with another link is no way (2026-09-30)', () => {
	assert.equal(isStranded(pipes(['A', 'x'], ['x', 'B']), { src: 'A', dst: 'B', via: [] }, model(['A', 'B', 'x'])), false, 'A-x-B by hand is a way');
	const theirs = [{ a: 'A', b: 'x', laid: 'link' }, { a: 'x', b: 'B', laid: 'link' }];
	assert.equal(isStranded(theirs, { src: 'A', dst: 'B', via: [] }, model(['A', 'B', 'x'])), true, 'pipes laid with another link carry only it');
});

test('a way HELD by another link still counts: the link stays, down and blocked, rather than being deleted whole', () => {
	// the proposer's reading, recorded 2026-09-30: a held way is a way that is full, not a way that is gone
	const trunk = pipes(['A', 't'], ['t', 'B']);
	const holder = { id: 'link-h', src: 'A', dst: 'B' };
	assert.equal(isStranded(trunk, { id: 'link-y', src: 'A', dst: 'B', via: [] }, model(['A', 't', 'B'], [holder])), false);
});

/*
THE g CHECK UNDER ONE LINK PER PIPE (2026-09-30). The link being drawn is the NEWEST, so it routes over what
every existing link leaves free; the refusal names the link holding its way; a drag whose pipes an older DOWN
link takes says it healed that link; and a drag that would move an existing link is refused.
*/
const X = (id, src, dst, via) => ({ id, src, dst, ...(via ? { via } : {}) });

test('a way the existing links hold is no way for the new one: it goes the way drawn', () => {
	const board = pipes(['A', 'w'], ['w', 'B'], ['C', 'w'], ['w', 'D']);
	const v = checkGuidedRoute(board, { src: 'A', dst: 'C', guides: ['g'], stops: ['A', 'g', 'C'] }, { links: [X('link-1', 'A', 'B'), X('link-2', 'C', 'D')] });
	assert.equal(v.ok, true, v.reason);
	assert.deepEqual(v.route, ['A', 'g', 'C'], 'A-w-C is two pipes, but both carry a link');
});

test('when the new link\'s way is held, the refusal names the link holding it', () => {
	const trunk = pipes(['A', 't1'], ['C', 't1'], ['t1', 't2'], ['t2', 'B'], ['t2', 'D']);
	const v = checkGuidedRoute(trunk, { src: 'A', dst: 'B', pins: ['t1'], stops: ['A', 't1', 'B'] }, { links: [X('link-1', 'A', 'B'), X('link-2', 'C', 'D')], rankOf: (id) => (id === 'link-1' ? 0 : 1) });
	assert.equal(v.ok, false);
	assert.match(v.reason, /held by link-1/);
});

test('a drag whose pipes an older DOWN link takes HEALS it, and says so rather than refusing', () => {
	const v = checkGuidedRoute([], { src: 'A', dst: 'B', guides: ['g'], stops: ['A', 'g', 'B'] }, { links: [X('link-1', 'A', 'B')] });
	assert.equal(v.ok, false, 'no second link is made');
	assert.deepEqual(v.heals, ['link-1'], 'the down link that takes the drawn way is named');
});

test('a drag that would MOVE an existing link is refused, and names it', () => {
	// X runs A-p-q-B by hand. A new link A-r-C, guided through the existing anchor r, lays A-r -- with r-B
	// already there, that is a shorter way for X, which is older and would take it; the new link would still
	// find A-s-r-C. So the drag is valid on its own terms and moves X: refused (2026-09-30).
	const board = pipes(['A', 'p'], ['p', 'q'], ['q', 'B'], ['r', 'B'], ['A', 's'], ['s', 'r']);
	const x = X('link-x', 'A', 'B');
	assert.deepEqual(assignRoutes(board, [x]).get('link-x'), ['A', 'p', 'q', 'B'], 'before: X runs A-p-q-B');
	const v = checkGuidedRoute(board, { src: 'A', dst: 'C', guides: ['r'], stops: ['A', 'r', 'C'] }, { links: [x] });
	assert.equal(v.ok, false);
	assert.match(v.reason, /move link-x/);
	assert.deepEqual(v.moves, ['link-x']);
});

/*
A g ROUTE THE LINK WOULD NOT FOLLOW IS ACCEPTED -- ruled 2026-09-30, reversing the refusal the whole-route check
made. The director drew S to E with g hops to make an alternate path while an older free path was shorter, and
the link was refused. Asked what should happen, the director chose "Link runs the shorter way": the link is made,
runs the fewest-pipes way, and the path drawn is kept as its alternate. The notice says which way, and why.
*/
test('a g route the link would not follow is ACCEPTED: it runs the shorter way, and names the guides it skips', () => {
	const v = checkGuidedRoute(pipes(['A', 'B']), { src: 'A', dst: 'B', pins: [], guides: ['G'], stops: ['A', 'G', 'B'] });
	assert.equal(v.ok, true, v.reason);
	assert.deepEqual(v.route, ['A', 'B'], 'the link runs the one-pipe way');
	assert.deepEqual(v.skipped, ['G'], 'and the guide it does not pass is named');
	assert.match(v.note, /a shorter way \(1 pipe, against the 2 drawn\)/);
	assert.match(v.note, /kept as its alternate/);
});

test('on a TIE the note says the way taken is just as short, not shorter', () => {
	const v = checkGuidedRoute(pipes(['A', 'X'], ['X', 'B']), { src: 'A', dst: 'B', pins: [], guides: ['Z'], stops: ['A', 'Z', 'B'] });
	assert.equal(v.ok, true);
	assert.match(v.note, /just as short/);
	assert.doesNotMatch(v.note, /shorter/);
});

test('the director\'s case: an alternate path drawn beside a shorter free one makes the link, on the shorter way', () => {
	const old = pipes(['S', 'G1'], ['G1', 'G2'], ['G2', 'E']);   // what a deleted w,g,g,g link left behind
	const v = checkGuidedRoute(old, { src: 'S', dst: 'E', guides: ['H1', 'H2', 'H3', 'H4'], stops: ['S', 'H1', 'H2', 'H3', 'H4', 'E'] });
	assert.equal(v.ok, true, v.reason);
	assert.deepEqual(v.route, ['S', 'G1', 'G2', 'E'], 'the link runs the old three-pipe path');
	assert.deepEqual(v.legs.map((l) => l.laid), ['hand', 'hand', 'hand', 'hand', 'hand'], 'and the five pipes drawn are laid by hand, as its alternate');
});

test('a drawn g route the link DOES follow carries no note', () => {
	const v = checkGuidedRoute([], { src: 'A', dst: 'B', guides: ['G'], stops: ['A', 'G', 'B'] });
	assert.equal(v.ok, true);
	assert.equal(v.note, undefined);
});
