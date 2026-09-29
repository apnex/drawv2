/*
The incubated pipe set -- network/pipeset.mjs -- against SD7 and the 2026-09-27 lifetime ruling.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPipeSet } from '../network/pipeset.mjs';

test('SD7: laying a pipe that exists is the same pipe, not a second one, whichever end is first', () => {
	const s = createPipeSet();
	assert.equal(s.lay('A', 'B'), true);
	assert.equal(s.lay('B', 'A'), false, 'B-A is A-B');
	assert.equal(s.list().length, 1);
});

test('a pipe never joins an anchor to itself', () => {
	const s = createPipeSet();
	assert.equal(s.lay('A', 'A'), false);
	assert.equal(s.list().length, 0);
});

test('lifetime: a pipe laid WITH A LINK goes once no link runs over it', () => {
	const s = createPipeSet();
	s.lay('A', 'B', 'link');
	s.lay('B', 'C', 'link');
	const removed = s.sweep([['A', 'B']]);   // one link remains, over A-B only
	assert.deepEqual(removed.length, 1, 'B-C carries no link and must go');
	assert.ok(s.has('A', 'B'), 'A-B still carries a link and must stay');
	assert.ok(!s.has('B', 'C'));
});

test('lifetime: a pipe laid BY HAND stays with no link on it', () => {
	// "Only pipes manually placed remain without links" -- the director's words, 2026-09-27
	const s = createPipeSet();
	s.lay('A', 'B', 'hand');
	assert.deepEqual(s.sweep([]), [], 'no link remains anywhere, and the hand pipe must survive');
	assert.ok(s.has('A', 'B'));
});

test('laying by hand PROMOTES a link pipe, and a link never demotes a hand pipe', () => {
	// the asymmetry is the point: the author placing a pipe deliberately makes it theirs, but a link
	// merely passing over a hand pipe must not make it disposable, or deleting that link would
	// remove geometry the author chose
	const s = createPipeSet();
	s.lay('A', 'B', 'link');
	s.lay('A', 'B', 'hand');
	assert.deepEqual(s.sweep([]), [], 'promoted to hand, it survives with no link');

	const t = createPipeSet();
	t.lay('C', 'D', 'hand');
	t.lay('C', 'D', 'link');
	assert.deepEqual(t.sweep([]), [], 'a link laying over a hand pipe must not demote it');
});

test('a route using a pipe in EITHER direction counts as using it', () => {
	const s = createPipeSet();
	s.lay('A', 'B', 'link');
	assert.deepEqual(s.sweep([['B', 'A']]), [], 'traversed B to A is still A-B in use');
});

test('SD7: a pipe with a deleted end is pruned, hand pipes included', () => {
	// a pipe IS its pair; a pipe to nothing would shelter its surviving end from the sweep forever
	const s = createPipeSet();
	s.lay('A', 'B', 'hand'); s.lay('B', 'C', 'hand');
	const removed = s.prune((id) => id !== 'A');   // A was deleted
	assert.equal(removed.length, 1);
	assert.ok(!s.has('A', 'B') && s.has('B', 'C'));
});
