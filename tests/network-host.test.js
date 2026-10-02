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
import { Model } from '../model/model.mjs';
import { attachRelations } from '../engine/store.mjs';
import { cellOf } from '../kernel/geometry.mjs';
import { productKinds } from '../planner/kinds.mjs';
import { PIPE_ROW } from '../network/pipe-kind.mjs';

function rig({ commits = true, accepts = true } = {}) {
	const calls = [];
	const rec = (name, ret) => (...a) => { calls.push([name, ...a]); return ret; };
	let onChange = null, onTransit = null;
	const session = {
		network: { declaresNoTransit: () => false, stopsAt: () => false },
		takeNotice: () => null,
		judge: rec('judge', { verdict: 'v', commits }),
		answered: (answer, authority, apply) => { calls.push(['answered']); if (accepts) apply(); return accepts; },
		seed: (pipes, ids) => { calls.push(['seed', pipes, ids]); return [{ op: 'put', kind: 'pipe', entity: { id: 'pipe-00000a-00000b' } }]; },
		onTransitChange: (fn) => { onTransit = fn; },
	};
	const model = { onChange: (fn) => { onChange = fn; }, all: (kind) => (kind === 'pipe' ? [] : [{ id: 'link-000001' }]), endpointOf: () => null, get: () => null, isLinkDown: () => false };
	const net = attachNetwork({
		session, model, authority: { all: () => [] },
		renderer: { update: rec('update'), reflectSelection: rec('reflect'), render: rec('render') },
		selection: { subscribe: () => {}, list: () => [] },
		history: { commit: rec('commit') },
		pipeLayer: { replaceChildren: rec('paint') }, el: () => {}, say: rec('say'),
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
	const answer = r.net.seed([['node-000001', 'node-000002', 'hand']], ['link-000001'], (pipeOps) => { r.calls.push(['run', pipeOps]); return { ok: true }; });
	assert.deepEqual(r.names(), ['seed', 'run', 'paint', 'update', 'reflect'], 'and the board is drawn again whole: its links over the pipes it laid');
	assert.deepEqual(r.calls[0], ['seed', [['node-000001', 'node-000002', 'hand']], ['link-000001']]);
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
B278 -- THE TOGGLE ASKS WHAT EVERY RULE ASKS: whether what arrives at the waypoint now stops there, not whether the author
declared it. A stand-in network where the two differ -- the anchor stops, declaring nothing -- tells the two apart.
*/
test('B278: a transit change cuts the links pinned at a waypoint where what arrives stops, whatever was declared', () => {
	const model = new Model({ kinds: productKinds(PIPE_ROW) });   // the host paints the model's pipes (N-c)
	attachRelations(model, { cellOf });
	model.put('node', { id: 'node-000001', name: 'A', type: 'router', x: 0, y: 0, shape: 'circle' });
	model.put('node', { id: 'node-000002', name: 'B', type: 'router', x: 240, y: 0, shape: 'circle' });
	model.put('waypoint', { id: 'waypoint-000003', name: 'P', x: 120, y: -120 });
	model.put('link', { id: 'link-000004', src: 'node-000001', dst: 'node-000002', via: ['waypoint-000003'] });
	const commits = [];
	let onTransit = null;
	const network = { stopsAt: (id) => id === 'waypoint-000003', declaresNoTransit: () => false };
	attachNetwork({
		session: { pipes: { list: () => [] }, network, tidy: () => {}, takeNotice: () => null, onTransitChange: (fn) => { onTransit = fn; } },
		model, authority: { all: () => [] },
		renderer: { update: () => {}, reflectSelection: () => {}, render: () => {} },
		selection: { subscribe: () => {}, list: () => [] },
		history: { commit: (c) => commits.push(c) }, pipeLayer: { replaceChildren: () => {} }, el: () => {}, say: () => {},
	});
	onTransit(['waypoint-000003']);
	assert.equal(commits.length, 1, 'one commit');
	assert.equal(commits[0].label, 'transit');
	assert.deepEqual(commits[0].entries.map((e) => `${e.op} ${e.entity?.id ?? e.id}`).sort(), ['del link-000004', 'put link-000004', `put ${commits[0].entries.find((e) => e.op === 'put' && e.entity.id !== 'link-000004').entity.id}`].sort(), 'the pinned link cut in two there');
});
