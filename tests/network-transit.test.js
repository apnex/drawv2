/*
TRANSIT, stage X1 -- the value and the mark (dev/design/unification/TRANSIT.md section 12; ruled 2026-09-28, TR-6, TR-7).

`x` flips each selected anchor's transit on its own; a type offering no choice is refused and named; only a declaration
draws the ring. Held here on the session, in Node; the lab's matrix rows TRN-01 to TRN-05 hold the same in real Chrome.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNetworkSession } from '../network/session.mjs';
import { networkInput } from '../network/keys.mjs';
import { composeRules, resolveInput } from '../kernel/input-rules.mjs';

const wp = { id: 'waypoint-000001', kind: 'waypoint', type: null, name: 'w1' };
const node = (type, n = 2) => ({ id: `node-00000${n}`, kind: 'node', type, name: `${type}-${n}` });

test('a bare anchor passes by default; x turns its transit off, which it declares, and x again turns it back on', () => {
	const s = createNetworkSession();
	assert.equal(s.network.declaresNoTransit(wp.id), false, 'nothing declared, nothing marked');
	s.toggleTransit([wp]);
	assert.equal(s.network.declaresNoTransit(wp.id), true);
	assert.match(s.takeNotice(), /transit off at w1/);
	s.toggleTransit([wp]);
	assert.equal(s.network.declaresNoTransit(wp.id), false, 'two states: back to the default, declaring nothing');
	assert.match(s.takeNotice(), /transit on at w1/);
});

test('the table, as ruled (TR-6): routers, firewalls and vxlans offer the choice; load balancers, servers and hosts do not', () => {
	for (const type of ['router', 'firewall', 'vxlan']) {
		const s = createNetworkSession();
		s.toggleTransit([node(type)]);
		assert.equal(s.network.declaresNoTransit('node-000002'), true, `${type} offers the choice`);
	}
	for (const type of ['loadbalancer', 'server', 'host', 'text']) {
		const s = createNetworkSession();
		s.toggleTransit([node(type)]);
		assert.equal(s.network.declaresNoTransit('node-000002'), false, `${type} offers none, so nothing is declared and no ring drawn`);
		assert.match(s.takeNotice(), new RegExp(`is a ${type}, which never passes routes`));
	}
});

test('many at once, each flipped on its own, with the refused named beside the flipped', () => {
	const s = createNetworkSession();
	s.toggleTransit([wp]);
	s.takeNotice();
	s.toggleTransit([wp, node('router'), node('host', 3)]);
	assert.equal(s.network.declaresNoTransit(wp.id), false, 'the anchor came back on');
	assert.equal(s.network.declaresNoTransit('node-000002'), true, 'the router went off');
	assert.equal(s.takeNotice(), 'transit on at w1, off at router-2; host-3 is a host, which never passes routes -- its transit stays off');
});

test('only anchors are flipped; a selection with none changes nothing and tells no one', () => {
	const s = createNetworkSession();
	const heard = [];
	s.onTransitChange((ids) => heard.push(ids));
	s.toggleTransit([{ id: 'link-000001', kind: 'link', type: null, name: 'l' }]);
	assert.deepEqual(heard, []);
	assert.equal(s.takeNotice(), null);
	s.toggleTransit([wp, node('host')]);
	assert.deepEqual(heard, [[wp.id]], 'watchers hear the anchors that changed, not the refused');
});

test('x means transit only with an anchor or node selected, and never mid-drag', () => {
	const t = composeRules({ owner: 'network', rules: networkInput(() => ({})).keys });
	const sel = (kinds) => ({ selection: { size: kinds.length, ids: [], kinds, bends: null }, gesture: null, step: null });
	const x = { key: 'x', shiftKey: false, ctrlKey: false, altKey: false, metaKey: false };
	assert.equal(resolveInput(t, x, sel(['waypoint']), {}).rule?.id, 'transit');
	assert.equal(resolveInput(t, x, sel(['link', 'node']), {}).rule?.id, 'transit');
	assert.equal(resolveInput(t, x, sel(['link']), {}).rule, null);
	assert.equal(resolveInput(t, x, sel(['waypoint']), { gesturing: true }).rule, null, 'a declaration, not a drag step');
	assert.equal(resolveInput(t, { ...x, ctrlKey: true }, sel(['waypoint']), {}).rule, null);
});

/*
X2 -- routing stops at a non-transiting anchor (TR-1, TR-4, TR-6). Every router takes the one predicate, so where a link
is drawn, whether it is down, what a drag would make and why a link is down all agree.
*/
import { route, assignRoutes } from '../network/pipes.mjs';
import { judgeDrag } from '../network/guide.mjs';
import { whyDown } from '../network/resolve.mjs';
import { Model } from '../model/model.mjs';

const hand = (...pairs) => pairs.map(([a, b]) => ({ a, b, laid: 'hand' }));

test('a route never passes a blocked anchor, but may begin or end at one', () => {
	const pipes = hand(['A', 'X'], ['X', 'B'], ['A', 'p'], ['p', 'q'], ['q', 'B']);
	assert.deepEqual(route(pipes, 'A', 'B'), ['A', 'X', 'B']);
	assert.deepEqual(route(pipes, 'A', 'B', (id) => id !== 'X'), ['A', 'p', 'q', 'B'], 'the long way round');
	assert.deepEqual(route(pipes, 'A', 'X', (id) => id !== 'X'), ['A', 'X'], 'ending there is allowed');
	assert.deepEqual(route(pipes, 'X', 'B', (id) => id !== 'X'), ['X', 'B'], 'and so is beginning there');
	assert.equal(route(hand(['A', 'X'], ['X', 'B']), 'A', 'B', (id) => id !== 'X'), null, 'no other way: no route');
});

// a board in a real Model, composed as the lab composes it
function board() {
	const s = createNetworkSession();
	const m = new Model({ network: s.network });
	const put = (kind, e) => m.put(kind, e);
	put('node', { id: 'node-00000a', name: 'A', type: 'router', x: -360, y: 0, shape: 'circle' });
	put('node', { id: 'node-00000b', name: 'B', type: 'router', x: 360, y: 0, shape: 'circle' });
	put('node', { id: 'node-00000c', name: 'H', type: 'host', x: 0, y: 0, shape: 'circle' });
	put('waypoint', { id: 'waypoint-00000d', name: 'w', x: 0, y: -240 });
	put('link', { id: 'link-000001', name: 'l', src: 'node-00000a', dst: 'node-00000b' });
	s.seed([['node-00000a', 'node-00000c', 'hand'], ['node-00000c', 'node-00000b', 'hand'], ['node-00000a', 'waypoint-00000d', 'hand'], ['waypoint-00000d', 'node-00000b', 'hand']], ['link-000001']);
	return { s, m, link: m.get('link', 'link-000001') };
}
const W = { id: 'waypoint-00000d', kind: 'waypoint', type: null, name: 'w' };

test('a host never passes a route (TR-6): the link takes the way over the bare anchor', () => {
	const { m, link } = board();
	assert.deepEqual(m.pathOf(link), [[-360, 0], [0, -240], [360, 0]]);
	assert.equal(m.isLinkDown(link), false);
});

test('turning the anchor off downs the link and says why; turning it on heals it (TR-1, TR-4)', () => {
	const { s, m, link } = board();
	s.toggleTransit([W]);
	assert.equal(m.isLinkDown(link), true, 'the host blocks one way and the anchor the other');
	assert.equal(whyDown(m, [link.id], s.network), 'link-000001 is down: its way passes w, whose transit is off -- it heals when transit is turned back on');
	s.toggleTransit([W]);
	assert.equal(m.isLinkDown(link), false);
});

test('a link blocked only by a host names the host', () => {
	const { s, m, link } = board();
	m.del('waypoint', 'waypoint-00000d');
	assert.equal(m.isLinkDown(link), true);
	assert.equal(whyDown(m, [link.id], s.network), 'link-000001 is down: its way passes H, a host, which never passes routes');
});

test('a link the model does not hold yet is routed around blocked anchors too', () => {
	const { m } = board();
	const preview = { src: 'node-00000a', via: [], dst: 'node-00000b' };
	assert.deepEqual(m.pathOf(preview), [[-360, 0], [0, -240], [360, 0]]);
});

test('a drag is judged with the same stops: a plain link drawn A to B runs over the anchor, not the host', () => {
	const { s, m } = board();
	m.del('link', 'link-000001');
	const drag = { src: 'node-00000a', dst: 'node-00000b', pins: [], guides: [], placed: [], stops: ['node-00000a', 'node-00000b'], pressed: { w: false, g: false }, endPressed: false };
	const v = s.judge(drag, [], m).verdict;
	assert.deepEqual(v.route, ['node-00000a', 'waypoint-00000d', 'node-00000b']);
	assert.equal(judgeDrag(s.pipes.list(), drag, { links: [] }).route.length, 3, 'with no stops given, the shortest way is found -- the host and the anchor tie');
	assert.deepEqual(assignRoutes(s.pipes.list(), [{ id: 'l', ...drag }], { passes: (id) => id !== 'node-00000c' && id !== 'waypoint-00000d' }).get('l'), null, 'and with both blocked, no way');
});

/*
X3 -- pins and guides at a non-transiting anchor (TR-2, TR-2b, TR-3).
*/
import { cutAt, joinAt } from '../network/transit.mjs';
import { applyOps } from '../model/ops.mjs';
import { makeInput, pointer, key, seedNodes } from './fixtures/client-harness.mjs';

function pinned() {
	const m = new Model();
	m.put('node', { id: 'node-00000a', name: 'A', type: 'router', x: -360, y: 0, shape: 'circle' });
	m.put('node', { id: 'node-00000b', name: 'B', type: 'router', x: 360, y: 0, shape: 'circle' });
	m.put('waypoint', { id: 'waypoint-00000p', name: 'P', x: 0, y: -120 });
	m.put('waypoint', { id: 'waypoint-00000q', name: 'Q', x: 120, y: -120 });
	m.put('link', { id: 'link-000001', name: 'l', src: 'node-00000a', dst: 'node-00000b', via: ['waypoint-00000p', 'waypoint-00000q'] });
	return m;
}
// a command's entries as the ops applyOps takes (`after` is the command spelling of `patch`)
const apply = (m, cmd) => applyOps(m, cmd.entries.map((e) => (e.op === 'set' ? { op: 'set', kind: e.kind, id: e.id, patch: e.after } : e.op === 'del' ? { op: 'del', kind: e.kind, id: e.entity.id } : e)));

test('cutAt divides a link bending at the waypoint into two ending there; the src half keeps the id, the pins split between them', () => {
	const m = pinned();
	const cmd = cutAt(m, 'waypoint-00000p');
	assert.equal(cmd.cut, 1);
	apply(m, cmd);
	const links = m.all('link').map((l) => [l.src, l.dst, l.via ?? []]);
	assert.deepEqual(m.get('link', 'link-000001') && [m.get('link', 'link-000001').src, m.get('link', 'link-000001').dst], ['node-00000a', 'waypoint-00000p']);
	assert.deepEqual(links.sort(), [['node-00000a', 'waypoint-00000p', []], ['waypoint-00000p', 'node-00000b', ['waypoint-00000q']]].sort());
	assert.equal(cutAt(m, 'waypoint-00000p'), null, 'nothing bends there now: nothing to cut');
});

test('joinAt merges the two links left ending at the waypoint, restoring the link the author drew', () => {
	const m = pinned();
	apply(m, cutAt(m, 'waypoint-00000p'));
	apply(m, joinAt(m, 'waypoint-00000p'));
	assert.equal(m.all('link').length, 1);
	assert.deepEqual(m.get('link', 'link-000001').via, ['waypoint-00000p', 'waypoint-00000q']);
	assert.equal(joinAt(m, 'waypoint-00000q'), null, 'a bend, not two ends: nothing to join');
});

test('joinAt declines where more than two links meet: a junction stays a junction', () => {
	const m = pinned();
	apply(m, cutAt(m, 'waypoint-00000p'));
	m.put('node', { id: 'node-00000c', name: 'C', type: 'router', x: 0, y: -360, shape: 'circle' });
	m.put('link', { id: 'link-000009', name: 'x', src: 'node-00000c', dst: 'waypoint-00000p' });
	assert.equal(joinAt(m, 'waypoint-00000p'), null);
});

const drag = (o) => ({ pins: [], guides: [], placed: [], pressed: { w: true, g: false }, endPressed: false, srcKey: false, ...o });

test('a w on a stop that does not pass cuts the drawn link there: the judge names the cut and lays every leg', () => {
	const v = judgeDrag([], drag({ src: 'R', dst: 'H', pins: ['P'], stops: ['R', 'P', 'H'] }), { links: [], passes: (id) => id !== 'P', nameOf: (id) => id.toLowerCase() });
	assert.equal(v.ok, true);
	assert.deepEqual(v.cutAt, ['P']);
	assert.deepEqual(v.legs.map((l) => `${l.a}-${l.b}:${l.laid}`), ['R-P:link', 'P-H:link']);
	assert.equal(v.notice, 'cut at p, whose transit is off -- 2 links');
	assert.equal(judgeDrag([], drag({ src: 'R', dst: 'H', pins: ['P'], stops: ['R', 'P', 'H'] }), { links: [] }).cutAt, undefined, 'without transit, nothing is cut');
});

test('a drag cut in pieces makes every piece or none: a piece refused refuses the drag', () => {
	const held = { id: 'link-1', src: 'P', dst: 'H' };   // P-H is joined already by an unpinned link
	const v = judgeDrag([], drag({ src: 'R', dst: 'H', pins: ['P'], stops: ['R', 'P', 'H'] }), { links: [held], passes: (id) => id !== 'P' });
	assert.equal(v.ok, false);
	assert.match(v.notice, /already joins/);
});

test('a g the route skips because its transit is off is named as such (TR-3)', () => {
	const pipes = [{ a: 'A', b: 'G', laid: 'hand' }, { a: 'G', b: 'B', laid: 'hand' }, { a: 'A', b: 'x', laid: 'hand' }, { a: 'x', b: 'y', laid: 'hand' }, { a: 'y', b: 'B', laid: 'hand' }];
	const v = judgeDrag(pipes, drag({ src: 'A', dst: 'B', guides: ['G'], stops: ['A', 'G', 'B'], pressed: { w: true, g: true } }), { links: [], passes: (id) => id !== 'G' });
	assert.deepEqual(v.route, ['A', 'x', 'y', 'B']);
	assert.match(v.notice, /not through G, whose transit is off/);
});

test('Input commits the pieces a judge names as ONE edit, pinned between the cuts', () => {
	// the judge cuts at the first pin it is handed -- as the network's judge cuts at a pin whose transit is off
	const h = makeInput({ routeHook: (facts) => ({ ok: true, cutAt: [facts.pins[0]] }) });
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [360, 0]]);
		const over = (id, x, y) => pointer(x, y, { target: { tagName: 'g', classList: { contains: () => false }, dataset: {}, closest: (s) => (s.includes(id.split('-')[0]) ? { id } : null) } });
		h.capture.onDown(over(a.id, 0, 0)); h.capture.onMove(pointer(120, 120)); h.capture.onKeyDown(key('w'));
		const cut = h.model.all('waypoint')[0].id;
		h.capture.onMove(pointer(240, 120)); h.capture.onKeyDown(key('w'));
		h.capture.onMove(over(b.id, 360, 0)); h.capture.onUp(over(b.id, 360, 0));
		assert.equal(h.commits.length, 1, 'one edit');
		const links = h.model.all('link').map((l) => [l.src === a.id ? 'a' : l.src === cut ? 'cut' : '?', l.dst === b.id ? 'b' : l.dst === cut ? 'cut' : '?', (l.via ?? []).length]);
		assert.deepEqual(links.sort(), [['a', 'cut', 0], ['cut', 'b', 1]].sort());
	} finally { h.restore(); }
});
