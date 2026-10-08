/*
O-a (H19.18; dev/design/unification/KINDS-AS-PLUGINS.md) -- THE PLANNER WIRES NO TENANT, AND THE CORE'S INVARIANTS NAME NO KIND.

The group's rules were the planner's and the core's: its tenant appended to every composition (planner/txn.mjs), its two
invariants -- no node in two groups (B82), a group holds two distinct members (B85) -- written in model/invariants.mjs. They
ride the group's row now, as its checks do: a row may carry its tenant, and its invariants, so a kind and its rules are
composed together or not at all. The first step of B280 (O1: every kind a plugin's), proven before zones and groups move.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Model } from '../model/model.mjs';
import { composeKinds } from '../model/shape.mjs';
import { commit } from '../planner/txn.mjs';
import { Log } from '../planner/log.mjs';
import { violations } from '../model/invariants.mjs';
import { KINDS, NETWORK } from './fixtures/composed.mjs';
import { createNetwork } from '../network/network.mjs';
import { createTransit } from '../network/transit.mjs';

const code = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const put = (kind, entity) => ({ op: 'put', kind, entity });
const node = (id, x) => ({ id, name: id, type: 'host', shape: 'circle', x, y: 0 });

// the production composition, its group row stripped of the rules it brings
function withoutGroupRules() {
	const rows = KINDS.list.map((k) => KINDS.row(k)).map((r) => {
		if (r.kind !== 'group') return r;
		const { tenant, invariants, ...bare } = r;
		return bare;
	});
	return composeKinds(rows, 'groups without their rules');
}

// four nodes, a group of the first three, then a second group of the last three -- overlapping on two
function overlap(kinds) {
	const m = new Model({ kinds, attached: { network: createNetwork(createTransit()) }}), log = new Log(0);
	const opts = { links: NETWORK.links, kinds };
	commit(m, log, { ops: [-180, -60, 60, 180].map((x, i) => put('node', node(`node-ab000${i + 1}`, x))) }, 'server', 't', opts);
	commit(m, log, { ops: [put('group', { id: 'group-ac0001', name: 'A', members: ['node-ab0001', 'node-ab0002', 'node-ab0003'] })] }, 'server', 't', opts);
	const r = commit(m, log, { ops: [put('group', { id: 'group-ac0002', name: 'B', members: ['node-ab0002', 'node-ab0003', 'node-ab0004'] })] }, 'server', 't', opts);
	return { m, r, members: m.all('group').flatMap((g) => g.members) };
}

test('O-a: with the group row as production composes it, a second group steals the overlap -- the state under test', () => {
	const { r, members } = overlap(KINDS);
	assert.equal(r.ok, true);
	assert.equal(new Set(members).size, members.length, 'no node in two groups');
});

test('O-a: a group row that brings no rules runs none -- the planner appends no tenant, the core checks no group', () => {
	const { r, m, members } = overlap(withoutGroupRules());
	assert.equal(r.ok, true, `nothing refuses: ${r.error ?? ''}`);
	assert.notEqual(new Set(members).size, members.length, 'nothing stole the overlap: the steal rides the row');
	assert.deepEqual(violations(m), [], 'and nothing reports it: the invariant rides the row');
});

test('O-a: the group row carries its tenant and its invariants; the planner and the core\'s invariants name neither', () => {
	assert.equal(KINDS.row('group').tenant?.owner, 'groups');
	assert.equal(typeof KINDS.row('group').invariants, 'function');
	assert.deepEqual(KINDS.tenants.map((t) => t.owner), ['groups'], 'the composition\'s tenants, from its rows');
	const txn = code('planner/txn.mjs'), inv = code('model/invariants.mjs');
	assert.doesNotMatch(txn, /tenants\.mjs|\bGROUPS\b|groupAfterRemoval/, 'the planner imports no tenant and no group policy');
	assert.doesNotMatch(inv, /'group'|groupAfterRemoval/, 'the core\'s invariants name no group');
});

test('O-a: a row\'s tenant is checked when the composition is built', () => {
	const rows = KINDS.list.map((k) => KINDS.row(k));
	const bad = rows.map((r) => (r.kind === 'group' ? { ...r, tenant: { owner: 'groups' } } : r));
	assert.throws(() => composeKinds(bad, 't'), /kind group: its tenant is \{ owner, reactions \}/);
});
