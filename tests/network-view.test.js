/*
ONE DERIVATION PER BOARD STATE -- network/view.mjs, step T2 of the ruleset audit (dev/design/unification/RULESET-AUDIT.md).

Where each link runs, whether it is down, what blocks it, which links pass an anchor and which pipes are in use
are one question about the board. The audit MEASURED it answered 9 to 15 times per edit, in two orders, and two of
those answers disagreeing deleted pipes a link was drawn on (B257). So the network view works the board out once
and every consumer reads that one derivation -- the two properties below are the whole of the contract.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNetworkView } from '../network/view.mjs';

const hand = (a, b) => ({ a, b, laid: 'hand' });
// a mutable board: the pipe list, which anchors exist, the links, and each link's age
function board() {
	const b = {
		pipes: [hand('A', 'w'), hand('w', 'B'), hand('C', 'w'), hand('w', 'D')],
		anchors: new Set(['A', 'B', 'C', 'D', 'w']),
		links: [{ id: 'link-1', src: 'A', dst: 'B' }, { id: 'link-2', src: 'C', dst: 'D' }],
		ages: new Map([['link-1', 0], ['link-2', 1]]),
	};
	b.set = { list: () => b.pipes };
	b.model = { get: (kind, id) => (kind === 'link' ? b.links.find((l) => l.id === id) : b.anchors.has(id) ? { id } : undefined), all: () => b.links };
	b.net = createNetworkView(() => b.set.list(), (id) => b.ages.get(id) ?? Infinity);
	return b;
}

test('an unchanged board is worked out ONCE: every question reads the same derivation', () => {
	const b = board();
	const first = b.net.of(b.model);
	assert.equal(b.net.of(b.model), first, 'asked again, the same derivation answers');
	assert.deepEqual(first.route('link-1'), ['A', 'w', 'B']);
	assert.equal(first.isDown('link-2'), false);
	// a second model holding the same board -- the authority beside the tab -- shares it too
	const twin = { get: b.model.get, all: () => b.links.map((l) => ({ ...l })) };
	assert.equal(b.net.of(twin), first, 'two models holding one board share one derivation');
});

test('the derivation FOLLOWS every change it depends on', () => {
	const changes = [
		['a pipe laid', (b) => { b.pipes.push(hand('A', 'B')); }],
		['a pipe removed', (b) => { b.pipes.splice(1, 1); }],
		['a pipe re-laid by hand', (b) => { b.pipes[0] = { ...b.pipes[0], laid: 'link' }; }],
		['an anchor gone', (b) => { b.anchors.delete('w'); }],
		['a link added', (b) => { b.links.push({ id: 'link-3', src: 'A', dst: 'D' }); }],
		['a link re-pinned', (b) => { b.links[0] = { ...b.links[0], via: ['w'] }; }],
		['a link re-ended', (b) => { b.links[0] = { ...b.links[0], dst: 'D' }; }],
		['an age noted', (b) => { b.ages.set('link-2', -1); }],
	];
	for (const [what, change] of changes) {
		const b = board();
		const before = b.net.of(b.model);
		change(b);
		assert.notEqual(b.net.of(b.model), before, `after ${what}, the board must be worked out again`);
	}
});

test('a pipe to an anchor the model lacks is no way: the view reads only pipes both of whose ends exist', () => {
	const b = board();
	b.anchors.delete('w');   // the pipes through w remain in the set until the next prune
	const view = b.net.of(b.model);
	assert.equal(view.route('link-1'), null, 'no route through an anchor that is gone');
	assert.equal(view.isDown('link-1'), true, 'so the link is down -- drawn and reported alike (RULESET-AUDIT F10)');
});

test('the view answers every question the network asks of a board', () => {
	const b = board();
	b.links.push({ id: 'link-3', src: 'C', dst: 'B' });   // wants C-w, which link-2 holds, and w-B, which link-1 holds
	const view = b.net.of(b.model);
	assert.deepEqual(view.blockers('link-3'), ['link-1', 'link-2'], 'blockers: every link holding a pipe of its way');
	assert.deepEqual(view.through('w').sort(), ['link-1', 'link-2'], 'the links routed through an anchor, by id');
	assert.deepEqual(view.inUse().map((r) => r.join('-')), ['A-w-B', 'C-w-D', 'C-B'], 'what the sweep keeps: each route, or a down link\'s own legs');
});
