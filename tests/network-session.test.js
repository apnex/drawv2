/*
THE NETWORK SESSION -- step T5 of the ruleset audit (dev/design/unification/RULESET-AUDIT.md, F14).

The lab's composition root held the network's orchestration itself: the pipe set, the link ages, the legs a drag lays
waiting for the planner's answer, the notice that drag set, and the prune and sweep after every edit. The root is
wiring (scan-layers L8), and that was network behaviour living in it -- 178 of its 180-line budget. T5 moves it to one
object in network/, `createNetworkSession`, which owns that state and knows no DOM; the root keeps what it draws.

Held here as behaviour, in Node, where before it could be reached only by driving the page. The lab's browser suite
and the matrix hold the same behaviour end to end, unedited.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from '../model/model.mjs';
import { createNetworkSession } from '../network/session.mjs';

const P = 60;
function board(ids) {
	const m = new Model();
	ids.forEach((id, i) => m.put(id.startsWith('node') ? 'node' : 'waypoint', id.startsWith('node')
		? { id, name: id, type: 'router', x: i * 2 * P, y: 0, shape: 'circle' } : { id, name: id, x: i * 2 * P, y: P }));
	return m;
}
const [A, B, Pn, G] = ['node-00000a', 'node-00000b', 'waypoint-00000c', 'waypoint-00000d'];
const drag = (o) => ({ pins: [], guides: [], placed: [], pressed: { w: false, g: false }, endPressed: false, ...o });
// a pipe is its pair, unordered: the set stores its ends sorted, so the test names them the same way
const pipe = (a, b, kind) => `${[a, b].sort().join('-')}:${kind}`;
const laid = (s) => s.pipes.list().map((p) => pipe(p.a, p.b, p.laid)).sort();
const wLink = drag({ src: A, dst: B, pins: [Pn], placed: [Pn], stops: [A, Pn, B], pressed: { w: true, g: false }, endPressed: 'w' });

test('a drag that makes a link lays NOTHING until the planner accepts it', () => {
	const s = createNetworkSession();
	const { verdict, commits } = s.judge(wLink, []);
	assert.equal(verdict.ok, true);
	assert.equal(commits, true, 'the link is committed next, so its legs wait for the answer');
	assert.deepEqual(laid(s), [], 'nothing laid yet');
});

test('an ACCEPTED answer lays the legs before the tab applies it, and notes ages after', () => {
	const s = createNetworkSession();
	s.judge(wLink, []);
	const authority = board([A, B, Pn]);
	authority.put('link', { id: 'link-000001', name: 'l', src: A, dst: B, via: [Pn] });
	let seen = null;
	const ok = s.answered({ ok: true }, authority, () => { seen = { pipes: laid(s), rank: s.order.rankOf('link-000001') }; });
	assert.equal(ok, true);
	assert.deepEqual(seen.pipes, [pipe(A, Pn, 'link'), pipe(Pn, B, 'link')], 'the link is drawn along its pipes from its first frame');
	assert.equal(seen.rank, Infinity, 'the tab applies before the link is given its age, as the root always did');
	assert.equal(s.order.rankOf('link-000001'), 0, 'and it is given its age once applied');
});

test('a REFUSED answer drops the legs: a link the planner refuses leaves no pipes behind, and nothing is applied', () => {
	const s = createNetworkSession();
	s.judge(wLink, []);
	let applied = false;
	assert.equal(s.answered({ ok: false, error: 'no' }, board([A, B, Pn]), () => { applied = true; }), false);
	assert.equal(applied, false);
	assert.deepEqual(laid(s), []);
	// and the legs are gone for good: the next answer does not lay them
	s.answered({ ok: true }, board([A, B, Pn]), () => {});
	assert.deepEqual(laid(s), []);
});

test('a drag with nothing to commit lays its pipes at once', () => {
	const s = createNetworkSession();
	const { verdict, commits } = s.judge(drag({ src: A, dst: B, guides: [G], stops: [A, G, B], pressed: { w: false, g: true }, endPressed: 'g' }), []);
	assert.equal(verdict.ok, false, 'g alone makes no link');
	assert.equal(commits, false, 'and places no anchor, so nothing is committed');
	assert.deepEqual(laid(s), [pipe(A, G, 'hand'), pipe(G, B, 'hand')]);
});

test('the drag\'s notice is said once, then the fallback returns', () => {
	const s = createNetworkSession();
	s.judge(drag({ src: B, dst: A, stops: [B, A] }), [{ id: 'link-000001', src: A, dst: B }]);
	assert.match(s.takeNotice(), /already joins/);
	assert.equal(s.takeNotice(), null);
});

test('tidy prunes pipes to anchors the authority lost, and sweeps only when asked', () => {
	const s = createNetworkSession();
	s.seed([[A, Pn, 'link'], [Pn, B, 'link'], [A, G, 'hand']], []);
	const authority = board([A, B, Pn]);   // G is gone
	s.tidy(authority, { sweep: false });
	assert.deepEqual(laid(s), [pipe(A, Pn, 'link'), pipe(Pn, B, 'link')], 'the pipe to the gone anchor is not a pipe');
	s.tidy(authority, { sweep: true });
	assert.deepEqual(laid(s), [], 'no link runs over the link pipes, so the sweep takes them');
});

test('the sweep keeps what a link is drawn on', () => {
	const s = createNetworkSession();
	s.seed([[A, Pn, 'link'], [Pn, B, 'link']], ['link-000001']);
	const authority = board([A, B, Pn]);
	authority.put('link', { id: 'link-000001', name: 'l', src: A, dst: B, via: [Pn] });
	s.tidy(authority, { sweep: true });
	assert.deepEqual(laid(s), [pipe(A, Pn, 'link'), pipe(Pn, B, 'link')]);
});

test('the session\'s network reads the session\'s pipes and ages: one object, one state', () => {
	const s = createNetworkSession();
	s.seed([[A, B, 'hand']], ['link-000002', 'link-000001']);
	assert.equal(s.order.rankOf('link-000002'), 0, 'seeded links are as old as they are listed');
	const m = board([A, B]);
	m.put('link', { id: 'link-000001', name: 'l', src: A, dst: B });
	m.put('link', { id: 'link-000002', name: 'm', src: B, dst: A });
	const tab = new Model({ network: s.network });
	tab.load(m.toJSON());
	assert.equal(tab.isLinkDown(tab.get('link', 'link-000002')), false, 'the older link keeps the one pipe');
	assert.deepEqual(tab.blockersOf(tab.get('link', 'link-000001')), ['link-000002'], 'and the younger is held by it');
});
