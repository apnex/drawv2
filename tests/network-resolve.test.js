/*
The incubated path resolver -- network/resolve.mjs -- through the real Model interface.

Driven through `new Model({ network: createNetwork(...) })` -- the one object the lab composes (RULESET-AUDIT T1) -- rather than by calling the resolver directly, because the
interface is the thing being proven: a resolver that works in isolation but receives the wrong
arguments from the Model would pass a direct test and fail in the lab.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from '../model/model.mjs';
import { createNetwork } from '../network/network.mjs';
import { preferredRoute } from '../network/pipes.mjs';
import { productKinds } from '../planner/kinds.mjs';
import { PIPE_ROW, pipeEntity, pipeId } from '../network/pipe-kind.mjs';
import { NETWORK_ROWS } from '../network/kinds.mjs';   // the network's kind and the field it contributes (S-a)

/*
H17.22 N-d: the network reads the model's own pipes, so each board is a model composed with the network's pipe kind, and
`pipesIn(m)` lays and removes pipes in it -- the session's pipe set these tests drove is deleted.
*/
const KINDS = productKinds(...NETWORK_ROWS);
const model = () => new Model({ network: createNetwork(), kinds: KINDS });   // links aged by their stored order (F-d)
const pipesIn = (m) => ({
	lay: (a, b, laid = 'hand') => { if (!m.get('pipe', pipeId(a, b))) m.put('pipe', pipeEntity(a, b, laid)); },
	remove: (a, b) => m.del('pipe', pipeId(a, b)),
	list: () => m.all('pipe'),
});

// A and B are far apart; the only pipes run A -> w -> B, around the straight line
function board() {
	const m = model();
	m.put('node', { id: 'node-00000a', name: 'A', type: 'router', x: 0, y: 0, shape: 'circle' });
	m.put('node', { id: 'node-00000b', name: 'B', type: 'router', x: 240, y: 0, shape: 'circle' });
	m.put('node', { id: 'node-e0000c', name: 'w', x: 120, y: 120 });
	return m;
}
const LINK = { id: 'link-00000d', name: 'l', src: 'node-00000a', dst: 'node-00000b' };

test('with pipes, an UNPINNED link is drawn along its route over them, not straight', () => {
	const m = board(), s = pipesIn(m);
	s.lay('node-00000a', 'node-e0000c');
	s.lay('node-e0000c', 'node-00000b');
	const path = m.pathOf(LINK);
	// the link has no via at all, yet it passes w -- because the only pipes go that way. This is
	// the property `g` depends on: an anchor can shape a route without being pinned in the link.
	assert.deepEqual(path, [[0, 0], [120, 120], [240, 0]]);
});

test('with NO pipes a link has no route: it is DOWN, drawn straight between its ends', () => {
	/*
	This test used to hold the opposite -- "an empty pipe layer is a board not yet laid, not a board of
	unroutable links" -- and the director's report is why it changed (2026-09-29). Deleting the anchor the
	cross board's links ran through removed its last four pipes; the links had LOST their route, and the
	no-pipes exception drew them as live. In the lab every link is laid with its pipes, so an empty pipe
	layer is never a board not yet laid. No pipes is simply no route.
	*/
	const m = model();
	m.put('node', { id: 'node-00000a', name: 'A', type: 'router', x: 0, y: 0, shape: 'circle' });
	m.put('node', { id: 'node-00000b', name: 'B', type: 'router', x: 240, y: 0, shape: 'circle' });
	assert.deepEqual(m.pathOf(LINK), [[0, 0], [240, 0]], 'drawn directly between its source and destination');
	assert.equal(m.isLinkDown(LINK), true, 'and DOWN, so it is drawn as ready to heal rather than as live');
});

test('a DOWN link (a leg with no route) defers rather than drawing half a path', () => {
	const m = board();
	pipesIn(m).lay('node-00000a', 'node-e0000c');   // pipes from A reach w, and stop
	assert.deepEqual(m.pathOf(LINK), [[0, 0], [240, 0]],
		'a route that stops halfway is no route (2026-09-25, down and heals)');
});

test('the resolver reads the pipe set LIVE, so removing a pipe changes the drawn route', () => {
	// a resolver holding a snapshot would draw links along pipes that no longer exist -- a second
	// authority for the pipe set, which is the defect family this programme exists to end
	const m = board(), s = pipesIn(m);
	s.lay('node-00000a', 'node-e0000c');
	s.lay('node-e0000c', 'node-00000b');
	assert.equal(m.pathOf(LINK).length, 3);
	s.remove('node-e0000c', 'node-00000b');
	assert.deepEqual(m.pathOf(LINK), [[0, 0], [240, 0]], 'with the route broken, the link is down and drawn straight');
});

test('the network\'s linksRoutedThrough names a link routed THROUGH an anchor it does not name', async () => {
	// the director's defect: moving the centre moved its pipes but not the links routed through it,
	// because only the incidence index (ends and pins) was asked
	const m = model(), s = pipesIn(m);
	s.lay('node-00000a', 'node-e0000c');
	s.lay('node-e0000c', 'node-00000b');
	m.put('node', { id: 'node-00000a', name: 'A', type: 'router', x: 0, y: 0, shape: 'circle' });
	m.put('node', { id: 'node-00000b', name: 'B', type: 'router', x: 240, y: 0, shape: 'circle' });
	m.put('node', { id: 'node-e0000c', name: 'w', x: 120, y: 120 });
	m.put('link', LINK);
	assert.deepEqual(m.linksRoutedThrough('node-e0000c').map((l) => l.id), [LINK.id],
		'the link has no via, yet its route passes w -- so moving w affects it');
	s.remove('node-e0000c', 'node-00000b');
	assert.deepEqual(m.linksRoutedThrough('node-e0000c'), [], 'with the route broken it no longer passes w');
});

/*
WHERE A LINK IS DRAWN AND WHETHER IT IS DOWN come from ONE route, so they cannot disagree.

A link drawn along a route while its down state says it has none -- or drawn straight and called up --
is two authorities for one fact, the defect family this programme exists to end. Checked against the
router itself, over every subset of a small pipe universe, rather than against cases picked by hand.
*/
test('the resolver and the down state agree with the router for every pipe set: routed exactly when not down', () => {
	const A = 'node-00000a', B = 'node-00000b', W = 'node-e0000c';
	const universe = [[A, W], [W, B], [A, B]];
	const at = { [A]: [0, 0], [B]: [240, 0], [W]: [120, 120] };
	let checked = 0;
	for (let mask = 0; mask < 1 << universe.length; mask++) {
		const m = model(), s = pipesIn(m);
		universe.forEach(([a, b], i) => { if (mask & (1 << i)) s.lay(a, b, 'link'); });
		m.put('node', { id: A, name: 'A', type: 'router', x: 0, y: 0, shape: 'circle' });
		m.put('node', { id: B, name: 'B', type: 'router', x: 240, y: 0, shape: 'circle' });
		m.put('node', { id: W, name: 'w', x: 120, y: 120 });
		for (const link of [LINK, { ...LINK, via: [W] }]) {
			// a link the model does not hold is routed alone, over the pipes it may use (2026-09-30: a pipe laid
			// with a link carries only the link whose stops it joins)
			const route = preferredRoute(s.list(), link);
			assert.equal(m.isLinkDown(link), route === null, `pipes ${mask.toString(2)}, via ${link.via ?? '-'}: down exactly when the router finds no route`);
			const want = route ? route.map((id) => at[id]) : [link.src, ...(link.via ?? []), link.dst].map((id) => at[id]);
			assert.deepEqual(m.pathOf(link), want, 'drawn along the route when there is one, along its intent when down');
			checked++;
		}
	}
	assert.equal(checked, 16, 'every subset, both links');
});

test('down is read LIVE: removing the last way takes a link down, and laying one back heals it', () => {
	const m = model(), s = pipesIn(m);
	s.lay('node-00000a', 'node-e0000c');
	s.lay('node-e0000c', 'node-00000b');
	// the anchors the pipes join are in the model: a pipe to an anchor the model lacks is no way (RULESET-AUDIT F10)
	m.put('node', { id: 'node-00000a', name: 'A', type: 'router', x: 0, y: 0, shape: 'circle' });
	m.put('node', { id: 'node-00000b', name: 'B', type: 'router', x: 240, y: 0, shape: 'circle' });
	m.put('node', { id: 'node-e0000c', name: 'w', x: 120, y: 120 });
	assert.equal(m.isLinkDown(LINK), false);
	s.remove('node-e0000c', 'node-00000b');
	assert.equal(m.isLinkDown(LINK), true, 'no way left: down');
	s.lay('node-e0000c', 'node-00000b', 'hand');
	assert.equal(m.isLinkDown(LINK), false, 'a way returns: it heals, with nothing stored to undo');
});

/*
ONE LINK PER PIPE (2026-09-30): where a link is drawn, whether it is down, and what blocks it all come from
the one assignment -- so a link blocked by another is drawn along its intent, called down, and names its blocker.
*/
test('the Model\'s companions answer from the one assignment: a blocked link is down and names its blocker', async () => {
	const m = model(), s = pipesIn(m);
	for (const [a, b] of [['node-00000a', 'node-000001'], ['node-00000c', 'node-000001'], ['node-000001', 'node-000002'], ['node-000002', 'node-00000b'], ['node-000002', 'node-00000d']]) s.lay(a, b, 'hand');
	for (const [id, x, y] of [['node-00000a', -480, -180], ['node-00000b', 480, -180], ['node-00000c', -480, 180], ['node-00000d', 480, 180]]) m.put('node', { id, name: id, type: 'router', x, y, shape: 'circle' });
	m.put('node', { id: 'node-000001', name: 't1', x: -240, y: 0 });
	m.put('node', { id: 'node-000002', name: 't2', x: 240, y: 0 });
	// the upper link is the older: its drawing order is lower (F-d) -- where the session's record once said so
	const upper = { id: 'link-00000u', name: 'u', order: 1, src: 'node-00000a', dst: 'node-00000b' }, lower = { id: 'link-00000l', name: 'l', order: 2, src: 'node-00000c', dst: 'node-00000d' };
	m.put('link', upper); m.put('link', lower);
	assert.deepEqual(m.pathOf(upper), [[-480, -180], [-240, 0], [240, 0], [480, -180]], 'the older link runs the trunk');
	assert.equal(m.isLinkDown(lower), true, 'the younger one is down');
	assert.deepEqual(m.pathOf(lower), [[-480, 180], [480, 180]], 'and drawn along its intent, straight between its ends');
	assert.deepEqual(m.blockersOf(lower), ['link-00000u'], 'and it names the link holding its way');
	assert.deepEqual(m.blockersOf(upper), [], 'a link that is up is blocked by nobody');
});

/*
F11 (RULESET-AUDIT) -- after `w` on a node mid-drag, the live preview stopped following the cursor. The preview is a link
the model does not hold, whose stops may be nodes (the network's `stop-on-node`, network/keys.mjs). With no way over
the pipes the network fell back to the straight polyline, which admits only waypoints as bends -- a node stop made it
null, and the preview froze where it was. Production's straight polyline is untouched: its bends are always waypoints.
*/
test('F11: a preview whose stops include a node is drawn through it, with no way over the pipes', () => {
	const m = model();
	m.put('node', { id: 'node-00000a', name: 'A', type: 'router', x: 0, y: 0, shape: 'circle' });
	m.put('node', { id: 'node-00000b', name: 'B', type: 'router', x: 240, y: 0, shape: 'circle' });
	// as Input draws it: the source entity, every stop drawn so far, and the cursor as a free position
	const preview = { src: m.get('node', 'node-00000a'), via: ['node-00000b'], dst: { x: 240, y: 120 } };
	assert.deepEqual(m.pathOf(preview), [[0, 0], [240, 0], [240, 120]], 'through the node stop, on to the cursor');
	assert.equal(m.pathOf({ ...preview, via: ['node-00000z'] }), null, 'a stop that does not exist is still no path');
});
