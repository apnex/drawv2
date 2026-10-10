/*
O-b1 (H19.19; dev/design/unification/KINDS-AS-PLUGINS.md) -- THE ZONE IS THE ZONES PLUGIN'S KIND, NOT THE CORE'S.

The core composed three kinds, node, zone and group; the zone's storage facts were the core's (model/shape.mjs), its checks
and its cap the planner's (planner/kinds.mjs, planner/policy.mjs), its factory the Model's (`makeZone`) and its extent the
surface's (`ZONE_EXT`). They are the zones plugin's now (zones/zone-kind.mjs), composed where the product is composed,
between the node and the group so a document lists its collections as before. And the reader composes nothing of its own:
it reads a document with the kinds its caller composed -- the O1 claim that three ways of composing kinds become one.
Nothing a user sees changes; the corpora hold that.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Model } from '../model/model.mjs';
import { CORE_KINDS, composeKinds } from '../model/shape.mjs';
import { commit } from '../planner/txn.mjs';
import { Log } from '../planner/log.mjs';
import { validateDoc } from '../planner/validate.js';
import { KINDS, NETWORK, heldLayouts } from './fixtures/composed.mjs';
import { createNetwork } from '../network/network.mjs';
import { createTransit } from '../network/transit.mjs';

const code = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const zones = async () => ({ ...(await import('../zones/zone-kind.mjs')), ...(await import('../zones/make-zone.mjs')) });

test('O-b1: production composes node, zone, group, link, pipe -- the state under test, unchanged', () => {
// RESTATED at WD-b1 (H19.45; WD6): the layouts plugin's kind is composed first -- a document lists its grids before what sits on them
	assert.deepEqual(KINDS.list, ['layout', 'node', 'zone', 'group', 'link', 'pipe']);
});

test('O-b1: the core composes no zone, and the zone row is the zones plugin\'s', async () => {
	// RESTATED at O-c (H19.20): the group left the core too -- the node alone is the core's
	assert.deepEqual(CORE_KINDS.list, ['node']);
	const { ZONE_ROWS } = await zones();
	assert.equal(KINDS.row('zone'), ZONE_ROWS[0], 'the product composes the plugin\'s row');
	assert.equal(ZONE_ROWS[0].owner, 'zones');
});

test('O-b1: the core and the planner name no zone -- no literal, no factory, no extent', () => {
	// RESTATED at O-d (H19.22): planner/kinds.mjs and planner/policy.mjs are gone -- the planner composes nothing; every planner module is held
	for (const f of ['model/shape.mjs', 'model/model.mjs', 'model/surface.mjs', ...fs.readdirSync(new URL('../planner/', import.meta.url)).filter((n) => /\.m?js$/.test(n)).map((n) => `planner/${n}`)]) {
		assert.doesNotMatch(code(f), /'zones?'|makeZone|ZONE_EXT|zoneExt/, `${f} names a zone`);
	}
});

test('O-b1: makeZone is the plugin\'s, and mints a zone as the Model did -- a fresh id, the next name, the next order', async () => {
	const { makeZone } = await zones();
	const m = new Model({ kinds: KINDS, attached: { network: createNetwork(createTransit()) }});
	assert.equal(typeof m.makeZone, 'undefined', 'the Model makes no zone');
	const z = makeZone(m, { x: 30, y: 30, w: 60, h: 60 });
	assert.match(z.id, /^zone-[0-9a-f]{6}$/);
	assert.deepEqual({ ...z, id: 0 }, { id: 0, name: 'zone-1', order: 1, x: 30, y: 30, w: 60, h: 60 });
});

test('O-b1: a composition without the zones plugin refuses a zone by name -- validator, planner and Model', () => {
	const kinds = composeKinds(KINDS.list.filter((k) => k !== 'zone').map((k) => KINDS.row(k)), 'no zones');
	// RESTATED at WD-b1 (H19.45): schema 3 -- a document holds its two layouts (tests/fixtures/composed.mjs `heldLayouts`)
	const doc = { meta: { id: 'diagram-0e0001', name: 'd', version: 0, schema: 3 }, layouts: heldLayouts(), nodes: [], groups: [], links: [], pipes: [], selection: [] };
	assert.equal(validateDoc(doc, { kinds }), null, 'the rest holds');
	assert.match(validateDoc({ ...doc, zones: [] }, { kinds }), /unknown collection: zones/);
	const m = new Model({ kinds, attached: { network: createNetwork(createTransit()) }});
	const r = commit(m, new Log(0), { ops: [{ op: 'put', kind: 'zone', entity: { id: 'zone-0e0002', name: 'z', x: 30, y: 30, w: 60, h: 60 } }] }, 'server', 't', { links: NETWORK.links, kinds });
	assert.equal(r.ok, false);
	assert.match(r.error, /zone/);
	assert.throws(() => m.put('zone', { id: 'zone-0e0002' }), /zone/);
});

test('O-b1: the reader reads with its caller\'s kinds, and composes none of its own', async () => {
	const { readModel } = await import('../network/read-model.mjs');
	const doc = { meta: { id: 'diagram-0e0001', name: 'd' }, nodes: [], zones: [{ id: 'zone-0e0003', name: 'z', x: 30, y: 30, w: 60, h: 60 }], groups: [], links: [], pipes: [] };
	assert.throws(() => readModel(doc), /readModel: no kinds/);
	assert.equal(readModel(doc, KINDS).all('zone').length, 1, 'with the caller\'s, the zone is held');
	assert.doesNotMatch(code('network/read-model.mjs'), /composeKinds|CORE_ROWS/);
});
