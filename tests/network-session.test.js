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

const P = 60;
const KINDS = productKinds(PIPE_ROW);
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

test('an accepted answer is applied by the page, and the link is aged after it; a refused one applies nothing', () => {
	const s = createNetworkSession();
	const authority = board([A, B, Pn]);
	authority.put('link', { id: 'link-000001', name: 'l', src: A, dst: B, via: [Pn] });
	let rankWhenApplied = null;
	assert.equal(s.answered({ ok: true }, authority, () => { rankWhenApplied = s.order.rankOf('link-000001'); }), true);
	assert.equal(rankWhenApplied, Infinity, 'the tab applies before the link is given its age');
	assert.equal(s.order.rankOf('link-000001'), 0, 'and it is aged once applied');
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

test('a fixed board: its links aged as listed, and its pipes handed back as ops for the board\'s own commit', () => {
	const s = createNetworkSession();
	const ops = s.seed([[A, B, 'hand'], [B, Pn, 'link'], [A, A, 'hand']], ['link-000002', 'link-000001']);
	assert.equal(s.order.rankOf('link-000002'), 0, 'seeded links are as old as they are listed');
	assert.deepEqual(ops, [{ op: 'put', kind: 'pipe', entity: pipeEntity(A, B, 'hand') }, { op: 'put', kind: 'pipe', entity: pipeEntity(B, Pn, 'link') }], 'a pipe from an anchor to itself is no pipe');
});

test('the session\'s network reads the model\'s pipes and the session\'s ages: one object', () => {
	const s = createNetworkSession();
	s.seed([], ['link-000002', 'link-000001']);
	const m = board([A, B], [[A, B, 'hand']]);
	m.put('link', { id: 'link-000001', name: 'l', src: A, dst: B });
	m.put('link', { id: 'link-000002', name: 'm', src: B, dst: A });
	const tab = new Model({ network: s.network, kinds: KINDS });
	tab.load(m.toJSON());
	assert.equal(tab.isLinkDown(tab.get('link', 'link-000002')), false, 'the older link keeps the one pipe');
	assert.deepEqual(tab.blockersOf(tab.get('link', 'link-000001')), ['link-000002'], 'and the younger is held by it');
});
