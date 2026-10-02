/*
The incubated whole-route check for `g` -- network/guide.mjs.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judgeDrag, pipeAnchors } from '../network/guide.mjs';
import { assignRoutes, deriveNetwork } from '../network/pipes.mjs';
import { createNetworkView } from '../network/view.mjs';

// a network view over a plain pipe list, as the lab builds one over its pipe set
const viewOver = (list, rankOf) => createNetworkView(() => list, rankOf);

const pipes = (...pairs) => pairs.map(([a, b]) => ({ a, b, laid: 'hand' }));

/*
JUDGING A FINISHED DRAG -- ruled 2026-09-30, "Each drag action does one thing" (dev/DECISIONS.md).

The director: "the very next action decides what it is - a "w", a "g", or a plain "mouse-up" on another anchor".
  - any w: a link, pinned at each w anchor, routing between pins over the pipes
  - g and no w: anchors and pipes by hand, and NO link
  - neither: a link that lays no pipes -- "must use existing infra"
  - a link with no free way is made DOWN ("Made, but down"), naming what holds its way
Each action lays at most the pipe INTO its own stop; a plain release lays none (the proposer's reading).
*/
const X = (id, src, dst, via) => ({ id, src, dst, ...(via ? { via } : {}) });
const drag = (o) => ({ pins: [], guides: [], placed: [], pressed: { w: false, g: false }, endPressed: false, ...o });
const laid = (v) => v.legs.map((l) => `${l.a}-${l.b}:${l.laid}`);

test('a drag with only g lays pipes by hand and makes NO link', () => {
	const v = judgeDrag([], drag({ src: 'A', dst: 'B', guides: ['G'], placed: ['G'], stops: ['A', 'G', 'B'], pressed: { w: false, g: true }, endPressed: 'g' }));
	assert.equal(v.ok, false, 'no link is made');
	assert.deepEqual(laid(v), ['A-G:hand', 'G-B:hand'], 'g on the end laid the last pipe too');
	assert.deepEqual(v.keep, ['G'], 'the anchors it placed are kept');
	assert.match(v.notice, /2 pipes laid/);
	assert.doesNotMatch(v.notice, /refused/, 'nothing was refused: laying pipes is what g does');
});

test('in a drag that lays only pipes, a release on an anchor lays the last pipe into it (2026-09-30)', () => {
	// the director: "mouse up, after a previous g, on an anchor - also constructs the pipe" -- "Only in g-only drags"
	const v = judgeDrag([], drag({ src: 'A', dst: 'B', guides: ['G'], placed: ['G'], stops: ['A', 'G', 'B'], pressed: { w: false, g: true }, endPressed: false }));
	assert.deepEqual(laid(v), ['A-G:hand', 'G-B:hand'], 'a pipe can end at a node without g on the final hop');
	assert.match(v.notice, /2 pipes laid/);
});

test('a release lays the final pipe after ANY key; only a drag that pressed no key lays none (2026-09-30)', () => {
	// "If penultimate hop was a key (g or w) - final pipe is laid. Direct links without a key lay no pipe."
	const afterG = judgeDrag([], drag({ src: 'A', dst: 'B', pins: ['P'], guides: ['G'], stops: ['A', 'P', 'G', 'B'], pressed: { w: true, g: true }, endPressed: false }));
	assert.deepEqual(laid(afterG), ['A-P:link', 'P-G:hand', 'G-B:hand'], 'a link drag whose last key was g: laid by hand');
	assert.deepEqual(judgeDrag([], drag({ src: 'A', dst: 'B', stops: ['A', 'B'] })).legs, [], 'a plain drag: no pipe');
});

test('a plain drag makes a link and lays NO pipes: it runs over the pipes already there', () => {
	const v = judgeDrag(pipes(['A', 'x'], ['x', 'B']), drag({ src: 'A', dst: 'B', stops: ['A', 'B'] }));
	assert.equal(v.ok, true);
	assert.deepEqual(v.legs, []);
	assert.deepEqual(v.route, ['A', 'x', 'B']);
	assert.equal(v.notice, undefined, 'a link that runs as expected needs no word');
});

test('a link with no free way is made DOWN, and the answer names what holds its way', () => {
	const trunk = pipes(['A', 't1'], ['C', 't1'], ['t1', 't2'], ['t2', 'B'], ['t2', 'D']);
	const held = judgeDrag(trunk, drag({ src: 'C', dst: 'D', stops: ['C', 'D'] }), { links: [X('link-1', 'A', 'B')] });
	assert.equal(held.ok, true, 'made -- the director chose "Made, but down"');
	assert.equal(held.route, null, 'with no way, so it is down');
	assert.deepEqual(held.blockers, ['link-1']);
	// no sentence of its own: the new link is selected, and a selected down link says why (resolve.mjs whyDown)
	assert.equal(held.notice, undefined);
	const none = judgeDrag([], drag({ src: 'C', dst: 'D', stops: ['C', 'D'] }));
	assert.equal(none.ok, true);
	assert.deepEqual(none.blockers, [], 'no way at all: blocked by nobody');
});

test('a plain drag between a pair an unpinned link already joins makes nothing, and says so', () => {
	const v = judgeDrag([], drag({ src: 'B', dst: 'A', stops: ['B', 'A'] }), { links: [X('link-1', 'A', 'B')] });
	assert.equal(v.ok, false);
	assert.deepEqual(v.legs, []);
	assert.match(v.notice, /already joins/);
});

test('w pins the link: legs into pressed stops are laid WITH it, and legs touching a g anchor BY HAND', () => {
	const mixed = { src: 'A', dst: 'B', pins: ['P'], guides: ['G'], stops: ['A', 'P', 'G', 'B'], pressed: { w: true, g: true } };
	const ended = judgeDrag([], drag({ ...mixed, endPressed: 'w' }));
	assert.equal(ended.ok, true);
	assert.deepEqual(laid(ended), ['A-P:link', 'P-G:hand', 'G-B:hand']);
	assert.deepEqual(laid(judgeDrag([], drag({ ...mixed, endPressed: false }))), ['A-P:link', 'P-G:hand', 'G-B:hand'], 'released on B after g: the last pipe is laid by hand (2026-09-30)');
	assert.deepEqual(laid(judgeDrag([], drag({ ...mixed, endPressed: 'g' }))), ['A-P:link', 'P-G:hand', 'G-B:hand'], 'g on the end lays it by hand');
	const pinned = { src: 'A', dst: 'B', pins: ['P'], stops: ['A', 'P', 'B'], pressed: { w: true, g: true } };
	assert.deepEqual(laid(judgeDrag([], drag({ ...pinned, endPressed: 'g' }))), ['A-P:link', 'P-B:hand'], 'g on the end of a w link lays that last pipe by hand, to outlive the link');
	assert.deepEqual(laid(judgeDrag([], drag({ ...pinned, endPressed: 'w' }))), ['A-P:link', 'P-B:link'], 'w on the end lays it with the link');
});

test('a w link released on its destination after w lays the last pipe too, with the link (2026-09-30)', () => {
	// the director: "if the penultimate hop before a mouse-up is a "w", then the pipe should be added"
	const v = judgeDrag(pipes(['P', 'x'], ['x', 'B']), drag({ src: 'A', dst: 'B', pins: ['P'], stops: ['A', 'P', 'B'], pressed: { w: true, g: false } }));
	assert.deepEqual(laid(v), ['A-P:link', 'P-B:link']);
	assert.deepEqual(v.route, ['A', 'P', 'B'], 'and the link runs over the pipe it laid, the fewest-pipes way');
});

test('judging is PURE: it lays nothing in the pipes it was given', () => {
	const existing = pipes(['A', 'X']);
	const snapshot = JSON.stringify(existing);
	judgeDrag(existing, drag({ src: 'A', dst: 'B', guides: ['G'], stops: ['A', 'G', 'B'], pressed: { w: true, g: true }, endPressed: 'w' }));
	assert.equal(JSON.stringify(existing), snapshot);
});

/*
ONE LINK PER PIPE (2026-09-30) holds for every drag: the drawn link is the newest, so it routes over what the links
already there leave free, and a link drag that would move one of them is refused.
*/
test('the drawn link is the newest: a way the links already there hold is no way for it', () => {
	const board = pipes(['A', 'w'], ['w', 'B'], ['C', 'w'], ['w', 'D']);
	const v = judgeDrag(board, drag({ src: 'A', dst: 'C', guides: ['g'], stops: ['A', 'g', 'C'], pressed: { w: true, g: true }, endPressed: 'w' }), { links: [X('link-1', 'A', 'B'), X('link-2', 'C', 'D')] });
	assert.equal(v.ok, true, v.notice);
	assert.deepEqual(v.route, ['A', 'g', 'C'], 'A-w-C is two pipes, but both carry a link');
});

test('a g drag whose pipes an older DOWN link takes: the link heals, and the notice says so', () => {
	const v = judgeDrag([], drag({ src: 'A', dst: 'B', guides: ['g'], placed: ['g'], stops: ['A', 'g', 'B'], pressed: { w: false, g: true }, endPressed: 'g' }), { links: [X('link-1', 'A', 'B')] });
	assert.equal(v.ok, false, 'g makes no link');
	assert.match(v.notice, /link-1 healed/);
});

test('a link drag that would MOVE an existing link is refused, and names it', () => {
	// X runs A-p-q-B by hand. A w link A-r-C through the existing anchor r lays A-r -- with r-B already there, a
	// shorter way for X, which is older and would take it; the new link would still find A-s-r-C.
	const board = pipes(['A', 'p'], ['p', 'q'], ['q', 'B'], ['r', 'B'], ['A', 's'], ['s', 'r']);
	const x = X('link-x', 'A', 'B');
	assert.deepEqual(assignRoutes(board, [x]).get('link-x'), ['A', 'p', 'q', 'B'], 'before: X runs A-p-q-B');
	const v = judgeDrag(board, drag({ src: 'A', dst: 'C', guides: ['r'], stops: ['A', 'r', 'C'], pressed: { w: true, g: true }, endPressed: 'w' }), { links: [x] });
	assert.equal(v.ok, false);
	assert.match(v.notice, /would move link-x/);
	assert.deepEqual(v.moves, ['link-x']);
});

/*
g HOPS INSIDE A w DRAG the link would not follow (2026-09-30, "Link runs the shorter way"): the link runs the shorter
way, the path drawn is kept as its alternate, and the notice says which way and why.
*/
test('in a w drag, a g hop the link will not pass: it runs the shorter way, names the hop, keeps the path', () => {
	const v = judgeDrag(pipes(['A', 'B']), drag({ src: 'A', dst: 'B', guides: ['G'], stops: ['A', 'G', 'B'], pressed: { w: true, g: true }, endPressed: 'w' }));
	assert.equal(v.ok, true, v.notice);
	assert.deepEqual(v.route, ['A', 'B']);
	assert.deepEqual(v.skipped, ['G']);
	assert.match(v.notice, /a shorter way \(1 pipe, against the 2 drawn\)/);
	assert.match(v.notice, /kept as its alternate/);
});

test('on a TIE the notice says the way taken is just as short, not shorter', () => {
	const v = judgeDrag(pipes(['A', 'X'], ['X', 'B']), drag({ src: 'A', dst: 'B', guides: ['Z'], stops: ['A', 'Z', 'B'], pressed: { w: true, g: true }, endPressed: 'w' }));
	assert.equal(v.ok, true);
	assert.match(v.notice, /just as short/);
	assert.doesNotMatch(v.notice, /shorter/);
});

test('a DOWN link keeps its own drawn legs when pipes are swept, so it can heal onto them', () => {
	// with no pipes at all the link has no route; its intent legs must still count as in use
	const r = deriveNetwork([], [{ id: 'link-k', src: 'A', dst: 'B', via: ['P'] }]).inUse();
	assert.deepEqual(r, [['A', 'P', 'B']]);
});

// a minimal model: which anchors exist, and which links it holds
const model = (anchors, links = []) => ({
	get: (kind, id) => (anchors.includes(id) ? { id } : undefined),
	all: (kind) => (kind === 'link' ? links : []),
});

test('a HAND pipe references its anchors while both exist, with or without a link', () => {
	assert.deepEqual([...pipeAnchors(viewOver(pipes(['A', 'B'], ['B', 'C'])), model(['A', 'B', 'C']))].sort(), ['A', 'B', 'C']);
});

test('a pipe references its anchors only while both ends exist', () => {
	// judged against the model the planner hands over: a pipe whose other end this transaction deletes
	// must not shelter the survivor from the sweep
	assert.deepEqual([...pipeAnchors(viewOver(pipes(['A', 'B'], ['B', 'C'])), model(['B', 'C']))].sort(), ['B', 'C']);
});

test('a pipe laid WITH A LINK references its anchors only while a link in that model runs over it', () => {
	// the director's defect: deleting a w-chain link left its pins, sheltered by its own dying pipes
	const laidWithLink = [{ a: 'A', b: 'P', laid: 'link' }, { a: 'P', b: 'B', laid: 'link' }];
	const link = { src: 'A', dst: 'B', via: ['P'] };
	assert.ok(pipeAnchors(viewOver(laidWithLink), model(['A', 'P', 'B'], [link])).has('P'), 'before the delete, the link runs over them');
	assert.ok(!pipeAnchors(viewOver(laidWithLink), model(['A', 'P', 'B'], [])).has('P'), 'after it, they carry no link and shelter nothing');
});




test('a refused link drag keeps its g anchors and their hand pipes, and drops what existed only for the link', () => {
	// X runs A-p-q-B by hand. A w drag A -g G- -w P- then g on B lays a hand path A-G-P-B, three pipes, which ties X's
	// own way and wins the tie ('G' sorts before 'p'): X would move, so the drag is refused (2026-09-30). What it
	// placed for the refused link alone -- the w anchor P -- goes, and so does every pipe to it (a pipe is its pair);
	// the g anchor G and its hand pipe to A are kept (the refused-g ruling of 2026-09-29).
	const x = X('link-x', 'A', 'B');
	const v = judgeDrag(pipes(['A', 'p'], ['p', 'q'], ['q', 'B']), drag({ src: 'A', dst: 'B', pins: ['P'], guides: ['G'], placed: ['G', 'P'],
		stops: ['A', 'G', 'P', 'B'], pressed: { w: true, g: true }, endPressed: 'g' }), { links: [x] });
	assert.equal(v.ok, false);
	assert.deepEqual(v.moves, ['link-x'], 'refused because it would move X');
	assert.deepEqual(v.keep, ['G'], 'the g anchor survives; the w anchor does not');
	assert.deepEqual(laid(v), ['A-G:hand'], 'its hand pipe to A survives; the pipes to P go with P');
	assert.match(v.notice, /g anchors and their pipes are kept/);
});

test('the w that placed the source lays the final pipe WITH the link; a g in the drag cancels it (2026-09-30)', () => {
	const single = judgeDrag([], drag({ src: 'S', dst: 'P', stops: ['S', 'P'], srcKey: 'w' }));
	assert.equal(single.ok, true, 'a link drag');
	assert.deepEqual(laid(single), ['S-P:link'], '"w, drag, release": the final pipe, with the link');
	const withG = judgeDrag([], drag({ src: 'S', dst: 'E', guides: ['G'], placed: ['G'], stops: ['S', 'G', 'E'], pressed: { w: false, g: true }, srcKey: 'w' }));
	assert.equal(withG.ok, false, 'a g in the drag cancels the source w: pipes only');
	assert.deepEqual(laid(withG), ['S-G:hand', 'G-E:hand']);
});

/*
B257 -- THE SWEEP WORKS ROUTES OUT AS DRAWING DOES. `routesOf` assigned routes in id order while drawing assigned them by
age; once any link could use a free w pipe (2026-09-30), the two disagreed about which pipes were in use, and the sweep
deleted pipes a link was drawn on. MEASURED on this board: the id-order sweep removed C-x, x-y and y-D.
*/
test('B257: the sweep and the reference check work routes out by age, exactly as drawing does', () => {
	const l = (a, b) => ({ a, b, laid: 'link' });
	const board = [l('W1', 'W2'), ...pipes(['A', 'W1'], ['W2', 'B'], ['C', 'W1'], ['W2', 'D']), l('C', 'x'), l('x', 'y'), l('y', 'D')];
	const older = X('link-z', 'A', 'B'), younger = X('link-a', 'C', 'D');   // the older sorts LAST by id
	const rankOf = (id) => (id === 'link-z' ? 0 : 1);
	const drawn = assignRoutes(board, [older, younger], { rankOf });
	assert.deepEqual(drawn.get('link-a'), ['C', 'x', 'y', 'D'], 'drawn by age, the younger link runs C-x-y-D');
	const net = viewOver(board, rankOf), everything = model(['A', 'B', 'C', 'D', 'W1', 'W2', 'x', 'y'], [older, younger]);
	const used = new Set(net.of(everything).inUse().flatMap((r) => r.slice(1).map((b, i) => [r[i], b].sort().join('|'))));
	for (const k of ['C|x', 'x|y', 'D|y']) assert.ok(used.has(k), `the sweep must count ${k} as in use: a link is drawn on it`);
	const refs = pipeAnchors(net, everything);
	assert.ok(refs.has('x') && refs.has('y'), 'and the reference check must hold the anchors it runs through');
});

/*
F12 (RULESET-AUDIT) -- a verdict carries only what something reads. `heals` rode on every verdict and nothing read it:
the one place a heal matters, a pipes-only drag, says it in the notice. A field nobody reads is a second answer
waiting to disagree with the first.
*/
test('F12: a verdict carries only what a consumer reads', () => {
	const READ = new Set(['ok', 'legs', 'keep', 'route', 'blockers', 'moves', 'skipped', 'notice']);
	const board = pipes(['A', 'p'], ['p', 'q'], ['q', 'B'], ['r', 'B'], ['A', 's'], ['s', 'r']);
	const verdicts = [
		judgeDrag([], drag({ src: 'A', dst: 'B', guides: ['g'], placed: ['g'], stops: ['A', 'g', 'B'], pressed: { w: false, g: true }, endPressed: 'g' }), { links: [X('link-1', 'A', 'B')] }),
		judgeDrag([], drag({ src: 'B', dst: 'A', stops: ['B', 'A'] }), { links: [X('link-1', 'A', 'B')] }),
		judgeDrag(board, drag({ src: 'A', dst: 'C', guides: ['r'], stops: ['A', 'r', 'C'], pressed: { w: true, g: true }, endPressed: 'w' }), { links: [X('link-x', 'A', 'B')] }),
		judgeDrag([], drag({ src: 'C', dst: 'D', stops: ['C', 'D'] })),
		judgeDrag(pipes(['A', 'x'], ['x', 'B']), drag({ src: 'A', dst: 'B', stops: ['A', 'B'] })),
		judgeDrag(pipes(['A', 'x'], ['x', 'B'], ['A', 'g'], ['g', 'y'], ['y', 'z'], ['z', 'B']), drag({ src: 'A', dst: 'B', guides: ['g'], stops: ['A', 'g', 'B'], pressed: { w: false, g: true }, endPressed: false })),
	];
	for (const v of verdicts) {
		const unread = Object.keys(v).filter((k) => !READ.has(k));
		assert.deepEqual(unread, [], `a verdict carries ${unread.join(', ')}, which nothing reads`);
	}
});
