/*
THE NETWORK SESSION -- step T5 of the ruleset audit (dev/design/unification/RULESET-AUDIT.md, F14), as H17.22 N-c left it.

The lab's composition root held the network's orchestration itself; T5 moved it to one object in network/,
`createNetworkSession`, which owns the network's session state and knows no DOM. N-c moved the PIPES out of it into the
models (the network's `pipe` kind): the session now judges a drag into ENTRIES -- the pipes it lays, for the drag's own
commit -- notes link ages once the planner answers, and hands a fixed board's pipes over as ops. The prune and the sweep
are the planner's (tests/network-pipe-kind.test.js), so nothing here lays or removes a pipe.

Held here as behaviour, in Node. The lab's browser suite and the matrix hold the same end to end.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from '../model/model.mjs';
import { productKinds } from '../planner/kinds.mjs';
import { createNetworkSession } from '../network/session.mjs';
import { PIPE_ROW, pipeEntity, pipeId } from '../network/pipe-kind.mjs';
import { NETWORK_ROWS } from '../network/kinds.mjs';   // the network's kind and the field it contributes (S-a)

const P = 60;
const KINDS = productKinds(...NETWORK_ROWS);
function board(ids, pipes = []) {
	const m = new Model({ kinds: KINDS });
	ids.forEach((id, i) => m.put(id.startsWith('node') ? 'node' : 'waypoint', id.startsWith('node')
		? { id, name: id, type: 'router', x: i * 2 * P, y: 0, shape: 'circle' } : { id, name: id, x: i * 2 * P, y: P }));
	for (const [a, b, laid] of pipes) m.put('pipe', pipeEntity(a, b, laid));
	return m;
}
const [A, B, Pn, G] = ['node-00000a', 'node-00000b', 'node-00000c', 'node-00000d'];
const drag = (o) => ({ pins: [], guides: [], placed: [], pressed: { w: false, g: false }, endPressed: false, ...o });
const wLink = drag({ src: A, dst: B, pins: [Pn], placed: [Pn], stops: [A, Pn, B], pressed: { w: true, g: false }, endPressed: 'w' });
const puts = (entries) => entries.map((e) => (e.op === 'put' ? `put ${e.entity.id}:${e.entity.laid}` : `${e.op} ${e.id} ${JSON.stringify(e.after)}`)).sort();

test('a drag that makes a link lays nothing itself: its pipes are entries for the link\'s own commit', () => {
	const s = createNetworkSession();
	const m = board([A, B, Pn]);
	const { verdict, commits } = s.judge(wLink, [], m);
	assert.equal(verdict.ok, true);
	assert.equal(commits, true);
	assert.deepEqual(puts(verdict.entries), [`put ${pipeId(A, Pn)}:link`, `put ${pipeId(B, Pn)}:link`], 'its two legs, for the link\'s commit');
	assert.equal(m.all('pipe').length, 0, 'and nothing is laid by judging');
});

test('a drag\'s entries change only what the pipes do not already say: a pipe it repeats is left, a link pipe laid by hand is made a hand pipe', () => {
	const s = createNetworkSession();
	const guided = drag({ src: A, dst: B, guides: [G], stops: [A, G, B], pressed: { w: false, g: true }, endPressed: 'g' });
	const { verdict, commits } = s.judge(guided, [], board([A, B, G], [[A, G, 'link'], [G, B, 'hand']]));
	assert.equal(verdict.ok, false, 'g alone makes no link');
	assert.equal(commits, true, 'but it lays a pipe, so its entries are committed alone');
	assert.deepEqual(puts(verdict.entries), [`set ${pipeId(A, G)} {"laid":"hand"}`], 'A-G becomes a hand pipe; G-B is already one');
	const none = s.judge(guided, [], board([A, B, G], [[A, G, 'hand'], [G, B, 'hand']]));
	assert.deepEqual([none.commits, none.verdict.entries], [false, []], 'with nothing to change, nothing is committed at all');
});

// F-d (H18.6): a link's age is its stored drawing order, so an answer ages nothing -- the page applies it and that is all
test('an accepted answer is applied by the page; a refused one applies nothing', () => {
	const s = createNetworkSession();
	const authority = board([A, B, Pn]);
	authority.put('link', { id: 'link-000001', name: 'l', src: A, dst: B, via: [Pn] });
	let applied0 = false;
	assert.equal(s.answered({ ok: true }, authority, () => { applied0 = true; }), true);
	assert.equal(applied0, true);
	let applied = false;
	assert.equal(s.answered({ ok: false, error: 'no' }, authority, () => { applied = true; }), false);
	assert.equal(applied, false);
});

test('the drag\'s notice is said once, then the fallback returns', () => {
	const s = createNetworkSession();
	s.judge(drag({ src: B, dst: A, stops: [B, A] }), [{ id: 'link-000001', src: A, dst: B }], board([A, B]));
	assert.match(s.takeNotice(), /already joins/);
	assert.equal(s.takeNotice(), null);
});

// its links are aged by the drawing order the planner stamps, as listed (F-d) -- tests/drawing-order.test.js holds that
test('a fixed board: its pipes handed back as ops for the board\'s own commit', () => {
	const s = createNetworkSession();
	const ops = s.seed([[A, B, 'hand'], [B, Pn, 'link'], [A, A, 'hand']]);
	assert.deepEqual(ops, [{ op: 'put', kind: 'pipe', entity: pipeEntity(A, B, 'hand') }, { op: 'put', kind: 'pipe', entity: pipeEntity(B, Pn, 'link') }], 'a pipe from an anchor to itself is no pipe');
});

test('the session\'s network reads the model\'s pipes and its links\' stored ages: one object', () => {
	const s = createNetworkSession();
	const m = board([A, B], [[A, B, 'hand']]);
	// link-000002 is the older by its drawing order, though its id sorts later (F-d)
	m.put('link', { id: 'link-000001', name: 'l', order: 2, src: A, dst: B });
	m.put('link', { id: 'link-000002', name: 'm', order: 1, src: B, dst: A });
	const tab = new Model({ network: s.network, kinds: KINDS });
	tab.load(m.toJSON());
	assert.equal(tab.isLinkDown(tab.get('link', 'link-000002')), false, 'the older link keeps the one pipe');
	assert.deepEqual(tab.blockersOf(tab.get('link', 'link-000001')), ['link-000002'], 'and the younger is held by it');
});

/*
F-d (H18.6): the drag judge ages links by their stored drawing order, as the canvas does -- so what it says heals is what
the canvas will draw healed. Two links contest one trunk; a g drag lays a pipe giving the lower one a way of its own, so both
can be up after it. Which one it heals is the one the trunk was denied to -- the younger by drawing order, whatever the ids.
*/
test('the drag judge ages links by their stored order: a g drag heals whichever of two contesting links is the younger', () => {
	const [a, b, c, d, t1, t2] = ['node-0000a1', 'node-0000b1', 'node-0000c1', 'node-0000d1', 'node-0000e1', 'node-0000e2'];
	const judged = (lowerOrder) => {
		const s = createNetworkSession();
		const m = new Model({ kinds: KINDS });
		for (const [id, x, y] of [[a, -4 * P, -2 * P], [b, 4 * P, -2 * P], [c, -4 * P, 2 * P], [d, 4 * P, 2 * P]]) m.put('node', { id, name: id, type: 'router', x, y });
		m.put('node', { id: t1, name: 't1', x: -2 * P, y: 0 }); m.put('node', { id: t2, name: 't2', x: 2 * P, y: 0 });
		for (const [x, y] of [[a, t1], [c, t1], [t1, t2], [t2, b], [t2, d]]) m.put('pipe', pipeEntity(x, y, 'hand'));
		const links = [{ id: 'link-0000f1', name: 'upper', src: a, dst: b, order: 3 - lowerOrder }, { id: 'link-0000f2', name: 'lower', src: c, dst: d, order: lowerOrder }];
		for (const l of links) m.put('link', l);
		s.judge(drag({ src: c, dst: d, stops: [c, d], pressed: { w: false, g: true }, endPressed: 'g' }), links, m);
		return s.takeNotice();
	};
	assert.match(judged(2), /; link-0000f2 healed$/, 'the lower link is the younger: it was the one down, and it heals');
	assert.match(judged(1), /; link-0000f1 healed$/, 'the upper link is the younger: it was the one down, and it heals');
});
