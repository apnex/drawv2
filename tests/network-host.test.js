/*
THE NETWORK ATTACHED TO A PAGE (network/host.mjs) -- its choreography, held without a browser.

The lab's behaviour matrix proves what the board looks like after each gesture; this proves the ORDER the network's hooks
run in, which that outcome depends on and which moved out of the lab root with them: the answer's pipes are laid, then
the page's own reconciliation, then the board settles; a drag that commits nothing settles at once; a refusal settles and
says so; the sweep runs after an edit and not after undo or redo. Each part is a recording stand-in.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attachNetwork } from '../network/host.mjs';

function rig({ commits = true, accepts = true } = {}) {
	const calls = [];
	const rec = (name, ret) => (...a) => { calls.push([name, ...a]); return ret; };
	let onChange = null, onTransit = null;
	const session = {
		pipes: { list: () => [] },
		network: { declaresNoTransit: () => false },
		tidy: (authority, { sweep }) => calls.push(['tidy', sweep]),
		takeNotice: () => null,
		judge: rec('judge', { verdict: 'v', commits }),
		answered: (answer, authority, apply) => { calls.push(['laid']); apply(); return accepts; },
		seed: rec('seed'),
		onTransitChange: (fn) => { onTransit = fn; },
	};
	const model = { onChange: (fn) => { onChange = fn; }, all: () => [{ id: 'link-000001' }], endpointOf: () => null, get: () => null, isLinkDown: () => false };
	const net = attachNetwork({
		session, model, authority: { all: () => [] },
		renderer: { update: rec('update'), reflectSelection: rec('reflect'), render: rec('render') },
		selection: { subscribe: () => {}, list: () => [] },
		history: { commit: rec('commit') },
		pipeLayer: { replaceChildren: rec('paint') }, el: () => {}, say: rec('say'),
	});
	return { net, calls, names: () => calls.map((c) => c[0]), onChange: () => onChange, onTransit: () => onTransit };
}

test('the answer: the drag\'s pipes are laid, then the page reconciles, then the board settles and says so', () => {
	const r = rig();
	assert.equal(r.net.answered({ label: 'link' }, { version: 3 }, () => r.calls.push(['apply'])), true);
	assert.deepEqual(r.names(), ['laid', 'apply', 'tidy', 'paint', 'update', 'reflect', 'say']);
	assert.deepEqual(r.calls.find((c) => c[0] === 'tidy'), ['tidy', true], 'an edit sweeps');
	assert.match(r.calls.at(-1)[1], /^v3 link/);
});

test('undo and redo settle without sweeping', () => {
	const r = rig();
	r.net.answered({ verb: 'undo' }, { version: 4 }, () => {});
	assert.deepEqual(r.calls.find((c) => c[0] === 'tidy'), ['tidy', false]);
});

test('a refused answer does not settle in `answered`; the page takes the document back, then `refused` settles and says why', () => {
	const r = rig({ accepts: false });
	assert.equal(r.net.answered({ label: 'link' }, { error: 'no' }, () => {}), false);
	assert.ok(!r.names().includes('tidy'), 'nothing settles before the page has reloaded');
	r.net.refused({ error: 'no route' });
	assert.deepEqual(r.names().slice(1), ['tidy', 'paint', 'update', 'reflect', 'say', 'say'], 'settle speaks, then the refusal speaks last');
	assert.equal(r.calls.at(-1)[1], 'refused: no route');
});

test('a drag that commits nothing settles at once, sweeping; one that commits waits for the planner', () => {
	const now = rig({ commits: false });
	assert.equal(now.net.judge({ steps: [] }), 'v');
	assert.deepEqual(now.names(), ['judge', 'tidy', 'paint', 'update', 'reflect', 'say']);
	const later = rig({ commits: true });
	later.net.judge({ steps: [] });
	assert.deepEqual(later.names(), ['judge'], 'the answer settles it, when it comes');
});

test('the pipes repaint on every model change, and a transit change settles', () => {
	const r = rig();
	r.onChange()();
	assert.deepEqual(r.names(), ['paint']);
	r.onTransit()([]);
	assert.ok(r.names().includes('tidy') && r.names().at(-1) === 'say');
});
