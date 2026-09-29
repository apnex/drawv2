/*
The incubated whole-route check for `g` -- network/guide.mjs.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkGuidedRoute, pipeAnchors, routesOf } from '../network/guide.mjs';

const pipes = (...pairs) => pairs.map(([a, b]) => ({ a, b, laid: 'hand' }));

test('a guided route that passes its guide is accepted, and says which pipes to lay', () => {
	// A to B through guide G, with no conduit yet: the drag lays A-G and G-B, and the fewest-pipes
	// route over them runs through G
	const v = checkGuidedRoute([], { src: 'A', dst: 'B', pins: [], guides: ['G'], stops: ['A', 'G', 'B'] });
	assert.equal(v.ok, true, v.reason);
	assert.deepEqual(v.route, ['A', 'G', 'B']);
	assert.deepEqual(v.legs.map((l) => `${l.a}-${l.b}`), ['A-G', 'G-B']);
});

test('a guide the fewest-pipes route would skip is REFUSED, and the refusal names it', () => {
	// A-B conduit already exists, so the route A->B is one pipe and never visits G. Committing would
	// make a link that ignores what the author drew; the director's whole-route commit refuses it.
	const v = checkGuidedRoute(pipes(['A', 'B']), { src: 'A', dst: 'B', pins: [], guides: ['G'], stops: ['A', 'G', 'B'] });
	assert.equal(v.ok, false);
	assert.match(v.reason, /\bG\b/, 'the refusal must name the guide it skipped, or the author cannot see why');
});

test('legs touching a guide are laid BY HAND; the rest WITH THE LINK', () => {
	// T4: a guide's conduit outlives the link, because the author chose that geometry
	const v = checkGuidedRoute([], { src: 'A', dst: 'B', pins: ['P'], guides: ['G'], stops: ['A', 'P', 'G', 'B'] });
	assert.equal(v.ok, true, v.reason);
	const laid = Object.fromEntries(v.legs.map((l) => [`${l.a}-${l.b}`, l.laid]));
	assert.deepEqual(laid, { 'A-P': 'link', 'P-G': 'hand', 'G-B': 'hand' });
});

test('the check is PURE: it lays nothing in the conduit it was given', () => {
	// the caller lays the legs only after the planner accepts the link, so a refused link leaves no
	// pipes behind -- which holds only if this function does not lay them itself
	const conduit = pipes(['X', 'Y']);
	const before = JSON.stringify(conduit);
	checkGuidedRoute(conduit, { src: 'A', dst: 'B', pins: [], guides: ['G'], stops: ['A', 'G', 'B'] });
	assert.equal(JSON.stringify(conduit), before);
});

test('pipeAnchors names every anchor a pipe touches', () => {
	assert.deepEqual([...pipeAnchors(pipes(['A', 'B'], ['B', 'C']))].sort(), ['A', 'B', 'C']);
});

test('a DOWN link keeps its own drawn legs when pipes are swept, so it can heal onto them', () => {
	// with no conduit at all the link has no route; its intent legs must still count as in use
	const r = routesOf([], [{ src: 'A', dst: 'B', via: ['P'] }]);
	assert.deepEqual(r, [['A', 'P', 'B']]);
});

test('a pipe references its anchors only while both ends exist', () => {
	// judged against the model the planner hands the provider: a pipe whose other end this very
	// transaction deletes must not shelter the survivor from the sweep
	const ids = pipeAnchors(pipes(['A', 'B'], ['B', 'C']), (id) => id !== 'A');
	assert.deepEqual([...ids].sort(), ['B', 'C']);
});
