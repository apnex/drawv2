/*
The incubated whole-route check for `g` -- network/guide.mjs.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkGuidedRoute, pipeAnchors, routesOf, isStranded } from '../network/guide.mjs';

const pipes = (...pairs) => pairs.map(([a, b]) => ({ a, b, laid: 'hand' }));

test('a guided route that passes its guide is accepted, and says which pipes to lay', () => {
	// A to B through guide G, with no pipes yet: the drag lays A-G and G-B, and the fewest-pipes
	// route over them runs through G
	const v = checkGuidedRoute([], { src: 'A', dst: 'B', pins: [], guides: ['G'], stops: ['A', 'G', 'B'] });
	assert.equal(v.ok, true, v.reason);
	assert.deepEqual(v.route, ['A', 'G', 'B']);
	assert.deepEqual(v.legs.map((l) => `${l.a}-${l.b}`), ['A-G', 'G-B']);
});

test('a guide the fewest-pipes route would skip is REFUSED, and the refusal names it', () => {
	// an A-B pipe already exists, so the route A->B is one pipe and never visits G. Committing would
	// make a link that ignores what the author drew; the director's whole-route commit refuses it.
	const v = checkGuidedRoute(pipes(['A', 'B']), { src: 'A', dst: 'B', pins: [], guides: ['G'], stops: ['A', 'G', 'B'] });
	assert.equal(v.ok, false);
	assert.match(v.reason, /\bG\b/, 'the refusal must name the guide it skipped, or the author cannot see why');
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

test('a refusal on a TIE says it is a tie, not that a shorter way exists', () => {
	// A-X-B already exists (two pipes); the drawn A-G-B is two pipes too, and the router's tie order picks X
	const v = checkGuidedRoute(pipes(['A', 'X'], ['X', 'B']), { src: 'A', dst: 'B', pins: [], guides: ['Z'], stops: ['A', 'Z', 'B'] });
	assert.equal(v.ok, false);
	assert.match(v.reason, /just as short/);
	assert.doesNotMatch(v.reason, /shorter way/);
});

test('a refusal on a genuinely shorter way says so, with both lengths', () => {
	const v = checkGuidedRoute(pipes(['A', 'B']), { src: 'A', dst: 'B', pins: [], guides: ['G'], stops: ['A', 'G', 'B'] });
	assert.match(v.reason, /a shorter way exists \(1 pipe, against the 2 drawn\)/);
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
	// S-P1-P2-P3-E with P2 deleted: the link now pins P1 and P3, and the pipes to P2 died with it
	const chain = [{ a: 'S', b: 'P1', laid: 'link' }, { a: 'P1', b: 'P2', laid: 'link' }, { a: 'P2', b: 'P3', laid: 'link' }, { a: 'P3', b: 'E', laid: 'link' }];
	const after = model(['S', 'P1', 'P3', 'E']);
	assert.equal(isStranded(chain, { src: 'S', dst: 'E', via: ['P1', 'P3'] }, after), true,
		'the only way P1 to P3 ran through P2, which is gone -- its pipes must not count');
	assert.equal(isStranded(chain, { src: 'S', dst: 'E', via: ['P1', 'P3'] }, model(['S', 'P1', 'P2', 'P3', 'E'])), false,
		'the same pipes with P2 still standing are a way');
});

test('a link with another way over surviving pipes is not stranded -- it re-routes (ruled 2026-09-26)', () => {
	const detour = [...pipes(['A', 'w'], ['w', 'B']), { a: 'A', b: 'x', laid: 'link' }, { a: 'x', b: 'B', laid: 'link' }];
	assert.equal(isStranded(detour, { src: 'A', dst: 'B', via: [] }, model(['A', 'B', 'x'])), false,
		'A-x-B survives, laid with another link or not: routed over it, this link carries it');
});
