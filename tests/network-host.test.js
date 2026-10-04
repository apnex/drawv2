/*
THE NETWORK ATTACHED TO A PAGE (network/host.mjs) -- its choreography, held without a browser.

The lab's behaviour matrix proves what the board looks like after each gesture; this proves the ORDER the network's hooks
run in, which that outcome depends on and which moved out of the lab root with them: the page's own reconciliation, then
the board settles; a drag that commits nothing settles at once; a refusal settles and says so. Since H17.22 N-c the host
sweeps nothing -- the planner does, in the edit -- and paints the tab's own pipes. Each part is a recording stand-in.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attachNetwork } from '../network/host.mjs';
import { fakeLayer } from './fixtures/fake-svg.mjs';
import { createNetworkSession } from '../network/session.mjs';
import { pipeEntity } from '../network/pipe-kind.mjs';
import { NETWORK_ROWS } from '../network/kinds.mjs';   // the network's kind and the field it contributes (S-a)
import { applyOps } from '../model/ops.mjs';
import { Model } from '../model/model.mjs';
import { attachRelations } from '../engine/store.mjs';
import { cellOf } from '../kernel/geometry.mjs';
import { plan } from '../planner/txn.mjs';
import { productKinds } from '../planner/kinds.mjs';
import { PIPE_ROW } from '../network/pipe-kind.mjs';

function rig({ commits = true, accepts = true } = {}) {
	const calls = [];
	const rec = (name, ret) => (...a) => { calls.push([name, ...a]); return ret; };
	let onChange = null, onTransit = null;
	const session = {
		// each paint reads the board's derivation once -- the rig's sign that a paint happened (the layer is kept, not cleared)
		network: { declaresNoTransit: () => false, stopsAt: () => false, view: { of: () => { calls.push(['paint']); return { route: () => null }; } } },
		takeNotice: () => null,
		judge: rec('judge', { verdict: 'v', commits }),
		answered: (answer, authority, apply) => { calls.push(['answered']); if (accepts) apply(); return accepts; },
		seed: (pipes) => { calls.push(['seed', pipes]); return [{ op: 'put', kind: 'pipe', entity: { id: 'pipe-00000a-00000b' } }]; },
		onTransitChange: (fn) => { onTransit = fn; },
	};
	const model = { onChange: (fn) => { onChange = fn; }, all: (kind) => (kind === 'pipe' ? [] : [{ id: 'link-000001' }]), endpointOf: () => null, get: () => null, isLinkDown: () => false };
	const net = attachNetwork({
		session, model, authority: { all: () => [] },
		renderer: { update: rec('update'), reflectSelection: rec('reflect'), render: rec('render'), watchMode: () => {} },
		selection: { subscribe: () => {}, list: () => [] },
		history: { commit: rec('commit') },
		pipeLayer: fakeLayer().root, el: fakeLayer().el, say: rec('say'),
	});
	return { net, calls, names: () => calls.map((c) => c[0]), onChange: () => onChange, onTransit: () => onTransit };
}

test('the answer: the page reconciles, then the board settles and says so -- sweeping nothing, which the planner did', () => {
	const r = rig();
	assert.equal(r.net.answered({ label: 'link' }, { version: 3 }, () => r.calls.push(['apply'])), true);
	assert.deepEqual(r.names(), ['answered', 'apply', 'paint', 'update', 'reflect', 'say']);
	assert.match(r.calls.at(-1)[1], /^v3 link/);
});

test('undo and redo settle the same way, saying the verb', () => {
	const r = rig();
	r.net.answered({ verb: 'undo' }, { version: 4 }, () => {});
	assert.deepEqual(r.names(), ['answered', 'paint', 'update', 'reflect', 'say']);
	assert.match(r.calls.at(-1)[1], /^v4 undo/);
});

test('a refused answer does not settle in `answered`; the page takes the document back, then `refused` settles and says why', () => {
	const r = rig({ accepts: false });
	assert.equal(r.net.answered({ label: 'link' }, { error: 'no' }, () => {}), false);
	assert.ok(!r.names().includes('paint'), 'nothing settles before the page has reloaded');
	r.net.refused({ error: 'no route' });
	assert.deepEqual(r.names().slice(1), ['paint', 'update', 'reflect', 'say', 'say'], 'settle speaks, then the refusal speaks last');
	assert.equal(r.calls.at(-1)[1], 'refused: no route');
});

test('a drag that commits nothing settles at once, to say why; one that commits waits for the planner', () => {
	const now = rig({ commits: false });
	assert.equal(now.net.judge({ steps: [] }), 'v');
	assert.deepEqual(now.names(), ['judge', 'paint', 'update', 'reflect', 'say']);
	const later = rig({ commits: true });
	later.net.judge({ steps: [] });
	assert.deepEqual(later.names(), ['judge'], 'the answer settles it, when it comes');
});

test('a fixed board: its links aged and its pipes made ops first, then the page commits them with the board, then it is drawn again whole', () => {
	const r = rig();
	const answer = r.net.seed([['node-000001', 'node-000002', 'hand']], (pipeOps) => { r.calls.push(['run', pipeOps]); return { ok: true }; });
	assert.deepEqual(r.names(), ['seed', 'run', 'paint', 'update', 'reflect'], 'and the board is drawn again whole: its links over the pipes it laid');
	assert.deepEqual(r.calls[0], ['seed', [['node-000001', 'node-000002', 'hand']]]);
	assert.deepEqual(r.calls[1][1], [{ op: 'put', kind: 'pipe', entity: { id: 'pipe-00000a-00000b' } }], 'the page commits the session\'s pipe ops');
	assert.deepEqual(answer, { ok: true }, 'and the page\'s answer comes back');
});

test('the pipes repaint on every model change, and a transit change settles', () => {
	const r = rig();
	r.onChange()();
	assert.deepEqual(r.names(), ['paint']);
	r.onTransit()([]);
	assert.ok(r.names().includes('reflect') && r.names().at(-1) === 'say');
});

/*
F-e (H18.7) -- A TRANSIT CHANGE IS AN EDIT: the host commits the session's set of each anchor's transit, as one edit labelled
`transit`, and builds no cut or join of its own -- those are the planner's (network/transit.mjs `transitReactions`). B278's
rule, that a cut asks whether what arrives stops rather than what was declared, is the cut reaction's, held below.
*/
test('F-e: a transit change commits the session\'s edit as given, and no edit of the host\'s own', () => {
	const model = new Model({ kinds: productKinds(...NETWORK_ROWS), network: createNetworkSession().network });   // V-e, J2
	model.put('node', { id: 'node-000003', name: 'P', x: 120, y: -120 });
	const commits = [];
	let onTransit = null;
	attachNetwork({
		session: { network: { stopsAt: () => false, declaresNoTransit: () => false, view: { of: () => ({ route: () => null }) } }, takeNotice: () => 'transit off at P', onTransitChange: (fn) => { onTransit = fn; } },
		model, renderer: { update: () => {}, reflectSelection: () => {}, render: () => {}, watchMode: () => {} },
		selection: { subscribe: () => {}, list: () => [] },
		history: { commit: (c) => commits.push(c) }, ...(() => { const f = fakeLayer(); return { pipeLayer: f.root, el: f.el }; })(), say: () => {},
	});
	const edit = [{ op: 'set', kind: 'node', id: 'node-000003', after: { transit: false } }];
	onTransit(['node-000003'], edit);
	assert.deepEqual(commits, [{ label: 'transit', entries: edit }]);
});

test('B278: the cut asks whether what arrives stops, whatever was declared', async () => {
	const { transitReactions } = await import('../network/transit.mjs');
	const { plan } = await import('../planner/txn.mjs');
	// a stand-in transit where the two questions differ: P stops what arrives, and nothing is declared
	const [cut] = transitReactions({ stopsAt: (id) => id === 'node-000003' }).reactions;
	const model = new Model({ kinds: productKinds(...NETWORK_ROWS), network: createNetworkSession().network });   // V-e, J2
	model.put('node', { id: 'node-000001', name: 'A', type: 'router', x: 0, y: 0, shape: 'circle' });
	model.put('node', { id: 'node-000002', name: 'B', type: 'router', x: 240, y: 0, shape: 'circle' });
	model.put('node', { id: 'node-000003', name: 'P', x: 120, y: -120 });
	model.put('link', { id: 'link-000004', name: 'l', order: 1, src: 'node-000001', dst: 'node-000002', via: ['node-000003'] });
	const r = plan(model, [{ op: 'set', kind: 'node', id: 'node-000003', patch: { transit: true } }], { links: { owner: 'probe', reactions: [cut] }, kinds: productKinds(...NETWORK_ROWS) });
	assert.equal(r.ok, true, r.error);
	assert.equal(r.ops.filter((o) => o.op === 'put' && o.kind === 'link').length, 2, 'declared on, yet what arrives stops: the pinned link is cut in two there');
});

/*
B283 -- A TRANSIT CHANGE AT SEVERAL ANCHORS AT ONCE, each anchor's edit built on the board the ones before it leave. The
director's report (2026-10-02): a link drawn w, w, w, w, its two middle anchors selected, `x` pressed -- each cut was built
against the same board and both committed together, so the second re-ended the original over both pins and a link ended
up down over a pipe another held; turning both back on could not rejoin them.
*/
test('B283: turning transit off at two pins of one link at once makes three straight pieces, and turning them back on rejoins it whole', () => {
	const session = createNetworkSession();
	const model = new Model({ kinds: productKinds(...NETWORK_ROWS), network: session.network });
	attachRelations(model, { cellOf });
	const [S, A, B, E] = ['node-00000a', 'node-00000b', 'node-00000c', 'node-00000d'];
	[[S, -360, 0], [A, -240, -120], [B, -120, 0], [E, 0, -120]].forEach(([id, x, y]) => model.put('node', { id, name: id, x, y }));
	model.put('link', { id: 'link-000001', name: 'l', src: S, dst: E, via: [A, B] });
	for (const [a, b] of [[S, A], [A, B], [B, E]]) model.put('pipe', pipeEntity(a, b, 'link'));
	// the canvas's history and the planner's answer, as the lab's door gives them: the edit planned over the network's tenant,
	// the answer applied, and handed to the host's answer step -- where the transit notice is said (F-e)
	const toOp = (e) => (e.op === 'set' ? { op: 'set', kind: e.kind, id: e.id, patch: e.after } : e.op === 'del' ? { op: 'del', kind: e.kind, id: e.entity.id } : e);
	const commits = [], said = [];
	let net = null;
	net = attachNetwork({
		session, model, renderer: { update: () => {}, reflectSelection: () => {}, render: () => {}, watchMode: () => {} },
		selection: { subscribe: () => {}, list: () => [] },
		history: { commit: (c) => {
			commits.push(c);
			const r = plan(model, c.entries.map(toOp), { links: session.network.links, kinds: productKinds(...NETWORK_ROWS) });
			net.answered(c, { ok: r.ok, error: r.error, version: commits.length, ops: r.ops }, () => applyOps(model, r.ops));
		} },
		...(() => { const f = fakeLayer(); return { pipeLayer: f.root, el: f.el }; })(), say: (t) => said.push(t),
	});
	const anchors = [A, B].map((id) => ({ ...model.get('node', id), kind: 'node' }));
	const shape = () => model.all('link').map((l) => `${l.src}>${l.dst}[${(l.via ?? []).join(',')}]${model.isLinkDown(l) ? ' down' : ''}`).sort();

	session.toggleTransit(anchors);
	assert.equal(commits.length, 1, 'one edit');
	assert.deepEqual(shape(), [`${A}>${B}[]`, `${B}>${E}[]`, `${S}>${A}[]`].sort(), 'three straight pieces, none down');
	assert.equal(model.get('link', 'link-000001').src, S, 'the first piece keeps the id the author drew');
	assert.equal(said.at(-1), `transit off at ${A}, off at ${B} -- 1 link cut into 3 pieces`, 'said when the planner answers, from its ops');

	session.toggleTransit([A, B].map((id) => ({ ...model.get('node', id), kind: 'node' })));
	assert.equal(said.at(-1), `transit on at ${A}, on at ${B} -- 3 pieces joined into 1 link`);
	assert.deepEqual(shape(), [`${S}>${E}[${A},${B}]`], 'turned back on, they join into the one link, pinned at both');
	assert.ok(model.get('link', 'link-000001'), 'with the id it was drawn with');
});
