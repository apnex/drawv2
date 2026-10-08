/*
O-c (H19.20; dev/design/unification/KINDS-AS-PLUGINS.md; O3) -- THE GROUP IS THE GROUPS PLUGIN'S KIND, NOT THE CORE'S.

The core composed node and group; the group's storage facts were the core's, its checks, rules and policy the planner's
(planner/kinds.mjs, planner/tenants.mjs, planner/policy.mjs), and the Model made groups (`makeGroup`), found them
(`groupOf`) and selected a member's whole group by name (`expandSelection`). They are the groups plugin's now (groups/),
and the one thing the core does for a group it does for any kind that opts in: a row that GATHERS a list field has the
entity listing an id found (`Model#gathererOf`), and selecting the id selects the whole list -- the 2026-10-02 ruling's
"a group's membership is stated in those terms, not by naming kinds". Nothing a user sees changes; the corpora hold that.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Model } from '../model/model.mjs';
import { CORE_KINDS, composeKinds } from '../model/shape.mjs';
import { commit } from '../planner/txn.mjs';
import { Log } from '../planner/log.mjs';
import { validateDoc } from '../planner/validate.js';
import { KINDS, NETWORK } from './fixtures/composed.mjs';
import { createNetwork } from '../network/network.mjs';
import { createTransit } from '../network/transit.mjs';
import { attachRelations } from '../engine/store.mjs';
import { cellOf } from '../kernel/geometry.mjs';

const code = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const groups = async () => ({ ...(await import('../groups/group-kind.mjs')), ...(await import('../groups/make-group.mjs')), ...(await import('../groups/group-of.mjs')) });
const node = (hex, x) => ({ id: `node-${hex}`, name: `n${hex}`, type: 'host', shape: 'circle', x, y: 0 });
// with the relations index attached, as the page and the lab attach it (app/src/compose-canvas.js) -- a bare Model scans
const model = (kinds = KINDS) => { const m = new Model({ kinds, network: createNetwork(createTransit()) }); attachRelations(m, { cellOf }); return m; };
const without = (field) => composeKinds(KINDS.list.map((k) => KINDS.row(k)).map((r) => {
	if (r.kind !== 'group') return r;
	const { [field]: _, ...rest } = r;
	return rest;
}), `group without ${field}`);

test('O-c: production composes node, zone, group, link, pipe, and selecting a member selects its group -- the state under test', () => {
	assert.deepEqual(KINDS.list, ['node', 'zone', 'group', 'link', 'pipe']);
	const m = model();
	for (const [h, x] of [['0c0001', 0], ['0c0002', 60], ['0c0003', 120]]) m.put('node', node(h, x));
	m.put('group', { id: 'group-0c0004', name: 'g', members: ['node-0c0001', 'node-0c0002'] });
	m.setSelection(['node-0c0001']);
	assert.deepEqual([...m.state.selection].sort(), ['node-0c0001', 'node-0c0002']);
});

test('O-c: the core composes the node alone, and the group row is the groups plugin\'s', async () => {
	assert.deepEqual(CORE_KINDS.list, ['node']);
	const { GROUP_ROWS } = await groups();
	assert.equal(KINDS.row('group'), GROUP_ROWS[0], 'the product composes the plugin\'s row');
	assert.equal(GROUP_ROWS[0].owner, 'groups');
	assert.equal(GROUP_ROWS[0].gathers, 'members');
	assert.equal(GROUP_ROWS[0].tenant.owner, 'groups', 'its rules ride its row (O-a)');
});

test('O-c: the core, the planner and the index name no group', () => {
	// RESTATED at O-d (H19.22): planner/kinds.mjs and planner/policy.mjs are gone -- the planner composes nothing
	for (const f of ['model/shape.mjs', 'model/model.mjs', 'model/invariants.mjs', 'model/surface.mjs', 'planner/txn.mjs', 'planner/validate.js', 'engine/relations.mjs']) {
		assert.doesNotMatch(code(f), /'groups?'|makeGroup|groupOf|GROUPS|groupAfterRemoval/, `${f} names a group`);
	}
	assert.equal(fs.existsSync(new URL('../planner/tenants.mjs', import.meta.url)), false, 'the group\'s rules left the planner');
});

test('O-c: makeGroup and groupOf are the plugin\'s -- minting and finding as the Model did, with and without the index', async () => {
	const { makeGroup, groupOf } = await groups();
	const m = model();
	assert.ok(m.index, 'the index is attached, so the first answers are the index\'s');
	assert.equal(typeof m.makeGroup, 'undefined', 'the Model makes no group');
	assert.equal(typeof m.groupOf, 'undefined', 'and finds none by name');
	m.put('node', node('0c0001', 0)); m.put('node', node('0c0002', 60));
	const g = makeGroup(m, ['node-0c0001', 'node-0c0002']);
	assert.match(g.id, /^group-[0-9a-f]{6}$/);
	assert.deepEqual({ ...g, id: 0 }, { id: 0, name: 'group-1', members: ['node-0c0001', 'node-0c0002'] });
	m.put('group', g);
	assert.equal(groupOf(m, 'node-0c0002')?.id, g.id);
	assert.equal(groupOf(m, 'node-0c0009'), undefined);
	const bare = new Model({ kinds: KINDS, network: createNetwork(createTransit()) });
	bare.load(m.toJSON()); bare.index = null;   // the scan path, as a detached rollback reads it
	assert.equal(groupOf(bare, 'node-0c0001')?.id, g.id, 'the scan agrees with the index');
});

test('O-c: the selection gathers by the row\'s declaration -- a group row that gathers nothing selects a member alone', () => {
	const m = model(without('gathers'));
	for (const [h, x] of [['0c0001', 0], ['0c0002', 60]]) m.put('node', node(h, x));
	m.put('group', { id: 'group-0c0004', name: 'g', members: ['node-0c0001', 'node-0c0002'] });
	m.setSelection(['node-0c0001']);
	assert.deepEqual([...m.state.selection], ['node-0c0001'], 'the Model gathers what a row declares, and names no group');
});

test('O-c: a composition without the groups plugin refuses a group by name, and its index holds without one', () => {
	const kinds = composeKinds(KINDS.list.filter((k) => k !== 'group').map((k) => KINDS.row(k)), 'no groups');
	const doc = { meta: { id: 'diagram-0e0001', name: 'd', version: 0, schema: 2 }, nodes: [], zones: [], links: [], pipes: [], selection: [] };
	assert.equal(validateDoc(doc, { kinds }), null);
	assert.match(validateDoc({ ...doc, groups: [] }, { kinds }), /unknown collection: groups/);
	const m = model(kinds);
	assert.ok(m.index, 'the index is attached');
	m.put('node', node('0c0001', 0));
	m.load(m.toJSON());   // a rebuild of the index, which read every group by name
	m.setSelection(['node-0c0001']);
	assert.deepEqual([...m.state.selection], ['node-0c0001']);
	const r = commit(m, new Log(0), { ops: [{ op: 'put', kind: 'group', entity: { id: 'group-0c0004', name: 'g', members: ['node-0c0001'] } }] }, 'server', 't', { links: NETWORK.links, kinds });
	assert.equal(r.ok, false);
	assert.match(r.error, /group/);
});
