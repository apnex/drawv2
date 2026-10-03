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
import { applyOps } from '../model/ops.mjs';

const wp = { id: 'node-000001', kind: 'node', type: null, name: 'w1' };
const node = (type, n = 2) => ({ id: `node-00000${n}`, kind: 'node', type, name: `${type}-${n}` });

/*
F-e (H18.7): `x` is an EDIT now -- the session hands over a set of each anchor's `transit`, and the value lives on the anchor.
`toggleIn` does what the page does with it: hands the session the anchors as the model holds them, and applies the edit.
*/
const asOp = (e) => (e.op === 'set' ? { op: 'set', kind: e.kind, id: e.id, patch: e.after } : e);
function transitModel(entities) {
	const s = createNetworkSession();
	const m = new Model({ network: s.network, kinds: KINDS });
	entities.forEach((e, i) => { const { kind: _k, type, ...rest } = e; m.put('node', { ...rest, ...(type ? { type, shape: 'circle' } : {}), x: 120 * i, y: 0 }); });
	return { s, m };
}
function toggleIn(s, m, ids) {
	let edit = null;
	const off = s.onTransitChange((_ids, entries) => { edit = entries; });
	s.toggleTransit(ids.map((id) => ({ ...(m.get('node', id) ?? m.get('link', id)), kind: id.split('-')[0] })));
	if (edit?.length) applyOps(m, edit.map(asOp));
	return edit;
}

test('a bare anchor passes by default; x turns its transit off, which it declares and stores, and x again turns it back on', () => {
	const { s, m } = transitModel([wp]);
	assert.equal(m.declaresNoTransit(wp.id), false, 'nothing declared, nothing marked');
	const off = toggleIn(s, m, [wp.id]);
	assert.deepEqual(off, [{ op: 'set', kind: 'node', id: wp.id, after: { transit: false } }], 'the edit stores the choice on the anchor');
	assert.equal(m.get('node', wp.id).transit, false);
	assert.equal(m.declaresNoTransit(wp.id), true);
	assert.match(s.takeNotice(), /transit off at w1/);
	const on = toggleIn(s, m, [wp.id]);
	assert.equal(on[0].op, 'put', 'back to the default is a whole put without the field -- a clearing set would leave undefined (B220)');
	assert.equal('transit' in m.get('node', wp.id), false, 'two states: back to the default, storing and declaring nothing');
	assert.match(s.takeNotice(), /transit on at w1/);
});

test('the table, as ruled (TR-6): routers, firewalls and vxlans offer the choice; load balancers, servers and hosts do not', () => {
	for (const type of ['router', 'firewall', 'vxlan']) {
		const { s, m } = transitModel([node(type)]);
		toggleIn(s, m, ['node-000002']);
		assert.equal(m.declaresNoTransit('node-000002'), true, `${type} offers the choice`);
	}
	for (const type of ['loadbalancer', 'server', 'host', 'text']) {
		const { s, m } = transitModel([node(type)]);
		assert.equal(toggleIn(s, m, ['node-000002']).length, 0, `${type} offers none, so there is nothing to store`);
		assert.equal(m.declaresNoTransit('node-000002'), false, `${type} offers none, so nothing is declared and no ring drawn`);
		assert.match(s.takeNotice(), new RegExp(`is a ${type}, which never passes routes`));
	}
});

test('many at once, each flipped on its own, with the refused named beside the flipped', () => {
	const { s, m } = transitModel([wp, node('router'), node('host', 3)]);
	toggleIn(s, m, [wp.id]);
	s.takeNotice();
	toggleIn(s, m, [wp.id, 'node-000002', 'node-000003']);
	assert.equal(m.declaresNoTransit(wp.id), false, 'the anchor came back on');
	assert.equal(m.declaresNoTransit('node-000002'), true, 'the router went off');
	assert.equal(s.takeNotice(), 'transit on at w1, off at router-2; host-3 is a host, which never passes routes -- its transit stays off');
});

test('only anchors are flipped; a selection with none changes nothing and tells no one', () => {
	const s = createNetworkSession();
	const heard = [];
	s.onTransitChange((ids, entries) => heard.push([ids, entries.length]));
	s.toggleTransit([{ id: 'link-000001', kind: 'link', type: null, name: 'l' }]);
	assert.deepEqual(heard, []);
	assert.equal(s.takeNotice(), null);
	s.toggleTransit([wp, node('host')]);
	assert.deepEqual(heard, [[[wp.id], 1]], 'watchers hear the anchors that changed and their one edit, not the refused');
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
import { createNetwork } from '../network/network.mjs';
import { productKinds } from '../planner/kinds.mjs';
import { PIPE_ROW } from '../network/pipe-kind.mjs';

// pipes are entities since H17.22 N-c: a board's model holds the network's pipe kind, and a fixed board's pipes go into it
const KINDS = productKinds(PIPE_ROW);
const lay = (s, m, pipes) => { for (const op of s.seed(pipes)) m.put('pipe', op.entity); };

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
	const m = new Model({ network: s.network, kinds: KINDS });
	const put = (kind, e) => m.put(kind, e);
	put('node', { id: 'node-00000a', name: 'A', type: 'router', x: -360, y: 0, shape: 'circle' });
	put('node', { id: 'node-00000b', name: 'B', type: 'router', x: 360, y: 0, shape: 'circle' });
	put('node', { id: 'node-00000c', name: 'H', type: 'host', x: 0, y: 0, shape: 'circle' });
	put('node', { id: 'node-00000d', name: 'w', x: 0, y: -240 });
	put('link', { id: 'link-000001', name: 'l', src: 'node-00000a', dst: 'node-00000b' });
	lay(s, m, [['node-00000a', 'node-00000c', 'hand'], ['node-00000c', 'node-00000b', 'hand'], ['node-00000a', 'node-00000d', 'hand'], ['node-00000d', 'node-00000b', 'hand']]);
	return { s, m, link: m.get('link', 'link-000001') };
}
const W = { id: 'node-00000d', kind: 'node', type: null, name: 'w' };

test('a host never passes a route (TR-6): the link takes the way over the bare anchor', () => {
	const { m, link } = board();
	assert.deepEqual(m.pathOf(link), [[-360, 0], [0, -240], [360, 0]]);
	assert.equal(m.isLinkDown(link), false);
});

test('turning the anchor off downs the link and says why; turning it on heals it (TR-1, TR-4)', () => {
	const { s, m, link } = board();
	toggleIn(s, m, [W.id]);
	assert.equal(m.isLinkDown(link), true, 'the host blocks one way and the anchor the other');
	assert.equal(whyDown(m, [link.id], s.network), 'link-000001 is down: its way passes w, whose transit is off -- it heals when transit is turned back on');
	toggleIn(s, m, [W.id]);
	assert.equal(m.isLinkDown(link), false);
});

test('a link blocked only by a host names the host', () => {
	const { s, m, link } = board();
	m.del('node', 'node-00000d');
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
	assert.deepEqual(v.route, ['node-00000a', 'node-00000d', 'node-00000b']);
	assert.equal(judgeDrag(m.all('pipe'), drag, { links: [] }).route.length, 3, 'with no stops given, the shortest way is found -- the host and the anchor tie');
	assert.deepEqual(assignRoutes(m.all('pipe'), [{ id: 'l', ...drag }], { passes: (id) => id !== 'node-00000c' && id !== 'node-00000d' }).get('l'), null, 'and with both blocked, no way');
});

/*
X3 -- pins and guides at a non-transiting anchor (TR-2, TR-2b, TR-3).
*/
import { plan } from '../planner/txn.mjs';
import { createTransit } from '../network/transit.mjs';
import { makeInput, pointer, key, seedNodes } from './fixtures/client-harness.mjs';

/*
F-e: the cut and the join are the PLANNER'S, set off by a change of a waypoint's `transit` (network/transit.mjs
`transitReactions`; the join is `link-join`, woken by it). Held by planning that change over the network's own tenant.
*/
const NET = createNetwork(createTransit());
function pinned() {
	const m = new Model({ network: NET, kinds: KINDS });
	m.put('node', { id: 'node-00000a', name: 'A', type: 'router', x: -360, y: 0, shape: 'circle' });
	m.put('node', { id: 'node-00000b', name: 'B', type: 'router', x: 360, y: 0, shape: 'circle' });
	m.put('node', { id: 'node-0000f1', name: 'P', x: 0, y: -120 });
	m.put('node', { id: 'node-0000f2', name: 'Q', x: 120, y: -120 });
	m.put('link', { id: 'link-000001', name: 'l', order: 1, src: 'node-00000a', dst: 'node-00000b', via: ['node-0000f1', 'node-0000f2'] });
	return m;
}
// set each anchor's transit, as `x` does, and apply what the planner answers
const transitOf = (m, sets) => {
	const r = plan(m, sets.map(([id, on]) => (on ? { op: 'put', kind: 'node', entity: (({ transit: _t, ...e }) => e)(m.get('node', id)) } : { op: 'set', kind: 'node', id, patch: { transit: false } })), { links: NET.links, kinds: KINDS });
	assert.equal(r.ok, true, r.error);
	applyOps(m, r.ops);
	return r;
};
const shape = (m) => m.all('link').map((l) => [l.src, l.dst, l.via ?? []]).sort();

test('turning a waypoint off cuts the link bending there into two ending there; the src half keeps the id and its order, the new half is newest', () => {
	const m = pinned();
	const r = transitOf(m, [['node-0000f1', false]]);
	assert.deepEqual([m.get('link', 'link-000001').src, m.get('link', 'link-000001').dst, m.get('link', 'link-000001').order], ['node-00000a', 'node-0000f1', 1]);
	assert.deepEqual(shape(m), [['node-00000a', 'node-0000f1', []], ['node-0000f1', 'node-00000b', ['node-0000f2']]].sort());
	const piece = m.all('link').find((l) => l.id !== 'link-000001');
	assert.equal(piece.order, 2, 'the new piece is drawn newest');
	assert.match(piece.name, /^link-\d+$/, 'and named, as every link is (B187)');
	assert.deepEqual(r.called.filter((id) => id === 'transit-cut'), ['transit-cut']);
	const again = plan(m, [{ op: 'put', kind: 'node', entity: m.get('node', 'node-0000f2') }], { links: NET.links, kinds: KINDS });
	assert.deepEqual(again.ops, [], 'an edit that does not change transit cuts nothing');
});

test('the piece a cut mints has the same id on every peer: derived from the link and the waypoint, never drawn at random', () => {
	const ids = [pinned(), pinned()].map((m) => { transitOf(m, [['node-0000f1', false]]); return m.all('link').map((l) => l.id).sort(); });
	assert.deepEqual(ids[0], ids[1]);
});

test('turning it back on joins the two left ending there, restoring the link the author drew -- and undo would do as much', () => {
	const m = pinned();
	transitOf(m, [['node-0000f1', false]]);
	const r = transitOf(m, [['node-0000f1', true]]);
	assert.equal(m.all('link').length, 1);
	assert.deepEqual(m.get('link', 'link-000001').via, ['node-0000f1', 'node-0000f2']);
	assert.ok(r.ops.some((o) => o.op === 'del' && o.kind === 'link' && o.into === 'link-000001'), 'the join names what the piece joined into');
});

test('a junction stays a junction: turning transit back on joins nothing where more than two links meet', () => {
	const m = pinned();
	transitOf(m, [['node-0000f1', false]]);
	m.put('node', { id: 'node-00000c', name: 'C', type: 'router', x: 0, y: -360, shape: 'circle' });
	m.put('link', { id: 'link-000009', name: 'x', src: 'node-00000c', dst: 'node-0000f1' });
	transitOf(m, [['node-0000f1', true]]);
	assert.equal(m.all('link').length, 3);
});

test('the network refuses a transit a type does not offer -- from any door, the CLI and REST included (TR-6)', () => {
	const m = pinned();
	m.put('node', { id: 'node-0000f3', name: 'H', type: 'host', x: 0, y: 240, shape: 'circle' });
	const r = plan(m, [{ op: 'set', kind: 'node', id: 'node-0000f3', patch: { transit: true } }], { links: NET.links, kinds: KINDS });
	assert.equal(r.ok, false);
	assert.match(r.error, /H is a host, which never passes routes/);
	assert.equal(plan(m, [{ op: 'set', kind: 'node', id: 'node-0000f3', patch: { transit: false } }], { links: NET.links, kinds: KINDS }).ok, true, 'off is what it offers');
	const retype = plan(m, [{ op: 'set', kind: 'node', id: 'node-00000a', patch: { transit: true } }, { op: 'set', kind: 'node', id: 'node-00000a', patch: { type: 'server' } }], { links: NET.links, kinds: KINDS });
	assert.equal(retype.ok, false, 'nor may a retype leave a node holding a value its new type does not offer');
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
		const cut = h.model.all('node').filter((n) => !n.type)[0].id;
		h.capture.onMove(pointer(240, 120)); h.capture.onKeyDown(key('w'));
		h.capture.onMove(over(b.id, 360, 0)); h.capture.onUp(over(b.id, 360, 0));
		assert.equal(h.commits.length, 1, 'one edit');
		const links = h.model.all('link').map((l) => [l.src === a.id ? 'a' : l.src === cut ? 'cut' : '?', l.dst === b.id ? 'b' : l.dst === cut ? 'cut' : '?', (l.via ?? []).length]);
		assert.deepEqual(links.sort(), [['a', 'cut', 0], ['cut', 'b', 1]].sort());
	} finally { h.restore(); }
});

/*
X4 -- two links left at a waypoint join only where its transit is on (TR-5): a condition inside the network tenant's
join reaction (PL-3; it was the hook `joinsAt`). And X5, folded in: the type table holds for routing as for the
toggle -- each type in it, as a node a link's only way runs through.
*/
test('X4: the network lets two links join at a waypoint only where its transit is on', () => {
	const joined = (off) => {
		const { s, m } = board();
		// a junction at w: A -> w, w -> B, w -> H; deleting w -> H leaves two links meeting at w
		m.put('link', { id: 'link-000002', name: 'aw', src: 'node-00000a', dst: 'node-00000d' });
		m.put('link', { id: 'link-000003', name: 'wb', src: 'node-00000d', dst: 'node-00000b' });
		m.put('link', { id: 'link-000004', name: 'wh', src: 'node-00000d', dst: 'node-00000c' });
		if (off) toggleIn(s, m, [W.id]);
		const r = plan(m, [{ op: 'del', kind: 'link', id: 'link-000004' }], { links: s.network.links, kinds: KINDS });
		assert.equal(r.ok, true);
		return r.ops.some((o) => o.op === 'set' && o.kind === 'link' && 'src' in o.patch);
	};
	assert.equal(joined(false), true, 'transit on: the two links join into one');
	assert.equal(joined(true), false, 'transit off: what arrives stops, so they stay two');
});

test('X5: every type routes as the table says -- routers, firewalls and vxlans pass; load balancers, servers and hosts do not', () => {
	for (const [type, passes] of [['router', true], ['firewall', true], ['vxlan', true], ['loadbalancer', false], ['server', false], ['host', false]]) {
		const s = createNetworkSession();
		const m = new Model({ network: s.network, kinds: KINDS });
		m.put('node', { id: 'node-00000a', name: 'A', type: 'router', x: -360, y: 0, shape: 'circle' });
		m.put('node', { id: 'node-00000b', name: 'B', type: 'router', x: 360, y: 0, shape: 'circle' });
		m.put('node', { id: 'node-00000c', name: 'M', type, x: 0, y: 0, shape: 'circle' });
		m.put('link', { id: 'link-000001', name: 'l', src: 'node-00000a', dst: 'node-00000b' });
		lay(s, m, [['node-00000a', 'node-00000c', 'hand'], ['node-00000c', 'node-00000b', 'hand']]);
		assert.equal(m.isLinkDown(m.get('link', 'link-000001')), !passes, `${type} ${passes ? 'passes' : 'never passes'} a route`);
	}
});

/*
B278 -- ONE QUESTION, `stopsAt`: does what arrives at this anchor stop there. Declared off, or of a type that offers only
off -- the set routing keys on (`blockedIn`), asked of one anchor. It differs from the declaration exactly where a type
offers no choice: a host stops what arrives and declares nothing, so it draws no ring.
*/
test('B278: stopsAt answers, anchor by anchor, what routing blocks -- and differs from the declaration only where a type offers no choice', () => {
	const s = createNetworkSession();
	const m = new Model({ network: s.network, kinds: KINDS });
	m.put('node', { id: wp.id, name: 'w1', x: 0, y: 0 });
	for (const [n, type] of [[2, 'router'], [3, 'host'], [4, 'firewall'], [5, 'server']]) m.put('node', { id: `node-00000${n}`, name: `${type}-${n}`, type, x: 120 * n, y: 0, shape: 'circle' });
	toggleIn(s, m, [wp.id, 'node-000004']);
	const anchors = [wp.id, 'node-000002', 'node-000003', 'node-000004', 'node-000005'];
	const blocked = s.network.view.of(m);
	for (const id of anchors) assert.equal(s.network.stopsAt(id, m), !blocked.passes(id), `${id}: stopsAt and routing agree`);
	assert.deepEqual(anchors.filter((id) => s.network.stopsAt(id, m)), [wp.id, 'node-000003', 'node-000004', 'node-000005']);
	assert.deepEqual(anchors.filter((id) => s.network.declaresNoTransit(id, m)), [wp.id, 'node-000004'], 'the host and the server stop, and declare nothing');
	assert.equal(s.network.stopsAt('node-00000f', m), false, 'an id the model does not hold is no anchor, and stops nothing');
});

test('B278: the planner refuses a join where what arrives stops, whatever was declared', () => {
	// a stand-in transit where the two questions differ: w stops what arrives, and nothing is declared
	const transit = { declaredOff: () => false, blockedIn: () => ['node-00000d'], stopsAt: (id) => id === 'node-00000d' };
	const network = createNetwork(transit);
	const m = new Model({ network, kinds: KINDS });
	m.put('node', { id: 'node-00000a', name: 'A', type: 'router', x: -360, y: 0, shape: 'circle' });
	m.put('node', { id: 'node-00000b', name: 'B', type: 'router', x: 360, y: 0, shape: 'circle' });
	m.put('node', { id: 'node-00000c', name: 'H', type: 'host', x: 0, y: 0, shape: 'circle' });
	m.put('node', { id: 'node-00000d', name: 'w', x: 0, y: -240 });
	m.put('link', { id: 'link-000002', name: 'aw', src: 'node-00000a', dst: 'node-00000d' });
	m.put('link', { id: 'link-000003', name: 'wb', src: 'node-00000d', dst: 'node-00000b' });
	m.put('link', { id: 'link-000004', name: 'wh', src: 'node-00000d', dst: 'node-00000c' });
	const r = plan(m, [{ op: 'del', kind: 'link', id: 'link-000004' }], { links: network.links, kinds: KINDS });
	assert.equal(r.ok, true);
	assert.equal(r.ops.some((o) => o.op === 'set' && o.kind === 'link' && 'src' in o.patch), false, 'they stay two');
});

/*
B283's notice, reworded at the director's word (2026-10-02): how many links the author DREW were cut, and into how many
pieces -- a piece an earlier cut made is traced back to its drawn link, so one link cut at two pins is "1 link cut into 3
pieces", not "2 links cut in two".
*/
test('a transit change counts the drawn links it cut and the pieces they became, and the pieces it joined', async () => {
	const { transitSummary } = await import('../network/transit.mjs');
	const [S, A, B, E, F] = ['node-e0000a', 'node-e0000b', 'node-e0000c', 'node-00000d', 'node-00000e'];
	const fresh = (links) => {
		const m = new Model({ network: NET, kinds: KINDS });
		[[S, -360, 0], [A, -240, -120], [B, -120, 0], [E, 0, -120], [F, 120, 0]].forEach(([id, x, y]) => m.put('node', { id, name: id, x, y }));
		links.forEach((l, i) => m.put('link', { order: i + 1, ...l }));
		return m;
	};
	const one = { id: 'link-000001', name: 'l', src: S, dst: E, via: [A, B] };
	const summary = (m, sets) => transitSummary(transitOf(m, sets).ops);
	assert.deepEqual(summary(fresh([one]), [[A, false]]).cut, { links: 1, pieces: 2 });
	assert.deepEqual(summary(fresh([one]), [[A, false], [B, false]]).cut, { links: 1, pieces: 3 }, 'one drawn link, cut twice');
	assert.deepEqual(summary(fresh([one, { id: 'link-000002', name: 'k', src: F, dst: E, via: [A] }]), [[A, false], [B, false]]).cut, { links: 2, pieces: 5 }, 'two drawn links: three pieces and two');
	// and back: the pieces of one cut link, joined at both waypoints, are three pieces into one link
	const m = fresh([one]);
	transitOf(m, [[A, false], [B, false]]);
	const back = summary(m, [[A, true], [B, true]]);
	assert.deepEqual(back.joined, { links: 1, pieces: 3 }, 'three pieces joined into one link');
	assert.equal(back.cut, null);
	assert.equal(m.all('link').length, 1, 'and the link the author drew is whole again');
});

/*
B284 -- the director's report (2026-10-02): a link drawn w, w, w, made a control link with k, then split with x -- one half
regressed to data. A cut keeps a link's declarations, its plane and its direction, on both halves.
*/
test('B284: transit\'s cut keeps the control plane and the direction on both halves', () => {
	const m = new Model({ network: NET, kinds: KINDS });
	['a', 'b', 'c'].forEach((h, i) => m.put('node', { id: `node-e0000${h}`, name: h, x: i * 120, y: 0 }));
	m.put('link', { id: 'link-000001', name: 'l', order: 1, src: 'node-e0000a', dst: 'node-e0000c', via: ['node-e0000b'], control: true, direction: 'reverse' });
	transitOf(m, [['node-e0000b', false]]);
	assert.equal(m.all('link').length, 2);
	for (const l of m.all('link')) assert.deepEqual([l.control, l.direction], [true, 'reverse'], `${l.id} keeps both`);
	// and back: the two control halves join into the one control link -- a control half beside a data half never could (H15.15)
	transitOf(m, [['node-e0000b', true]]);
	assert.deepEqual(m.all('link').map((l) => [l.id, l.control, l.direction, l.via]), [['link-000001', true, 'reverse', ['node-e0000b']]], 'one control link, as drawn');
	m.put('link', { id: 'link-000002', name: 'k', order: 2, src: 'node-e0000a', dst: 'node-e0000c', via: ['node-e0000b'] });
	m.del('link', 'link-000001');
	transitOf(m, [['node-e0000b', false]]);
	for (const l of m.all('link')) assert.ok(!('control' in l) && !('direction' in l), 'an undeclared link stays undeclared: no field is invented');
});

test('F-e: only a waypoint turned OFF is cut -- a change that leaves what arrives passing cuts nothing', () => {
	const m = pinned();
	const r = transitOf(m, [['node-0000f1', true]]);   // a put without the field: the default, on
	assert.equal(r.ops.filter((o) => o.kind === 'link').length, 0);
	const said = plan(m, [{ op: 'set', kind: 'node', id: 'node-0000f1', patch: { transit: true } }], { links: NET.links, kinds: KINDS });
	assert.equal(said.ok, true);
	assert.equal(said.ops.filter((o) => o.kind === 'link').length, 0, 'declared on, explicitly: the link still bends there');
});

test('F-e: a host may store the off it always has, and declares nothing by it -- no ring (TR-6)', () => {
	const m = pinned();
	m.put('node', { id: 'node-0000f3', name: 'H', type: 'host', x: 0, y: 240, shape: 'circle', transit: false });
	assert.equal(m.declaresNoTransit('node-0000f3'), false, 'a type with no choice declares nothing');
	assert.equal(m.stopsAt('node-0000f3'), true, 'and still stops what arrives');
	m.put('node', { id: 'node-0000f4', name: 'R', type: 'router', x: 120, y: 240, shape: 'circle', transit: false });
	assert.equal(m.declaresNoTransit('node-0000f4'), true, 'a router that chose off declares it');
});
