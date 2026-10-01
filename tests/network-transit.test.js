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
