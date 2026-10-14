/*
B307 (H19.6) -- A DOCUMENT CARRYING A COLLECTION ITS COMPOSITION CANNOT HOLD IS REFUSED, NOT DROPPED.

The validator checked every collection it knew and ignored the rest, and the Model writes back only the collections its kinds
name, so a document with one more was accepted and lost it at the next save: an agent posting the old shape -- `waypoints`,
with no `meta.schema` -- was answered "created" and its waypoints were gone; a peer composed without a plugin would drop that
plugin's kind the same way. GR8: a document that cannot be told apart from a valid one must be refused. This is the refusal
SD12 rules for a document needing a plugin a peer lacks, held by the composition itself; SD12's stored plugin list stays
deferred (B248).
*/
import { heldLayouts } from './fixtures/composed.mjs';   // WD-b1: the two layouts a schema 3 document holds
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDoc } from '../planner/validate.js';
import { productKinds } from '../product/kinds.mjs';
import { NETWORK_ROWS } from '../network/kinds.mjs';
import { makeApp } from './fixtures/app.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PAGE = productKinds(...NETWORK_ROWS), CORE = productKinds();
// RESTATED at WD-b1 (H19.45): schema 3 -- a document holds its two layouts (tests/fixtures/composed.mjs `heldLayouts`)
const doc = (extra = {}) => ({ meta: { id: '00000000000e0001', name: 'd', version: 0, schema: 3 }, layouts: heldLayouts(),
	nodes: [{ id: 'node-0e0001', name: 'a', x: 0, y: 0 }], links: [], pipes: [], zones: [], groups: [], selection: [], ...extra });

test('B307: every collection the composition holds, the selection and a reveal are a valid document', () => {
	assert.equal(validateDoc(doc(), { kinds: PAGE }), null);
});

test('B307: a collection the composition does not hold is refused, named -- not accepted and dropped', () => {
	assert.match(validateDoc(doc({ gizmos: [{ id: 'gizmo-0e0001' }] }), { kinds: PAGE }), /unknown collection: gizmos/);
	assert.match(validateDoc(doc({ waypoints: [] }), { kinds: PAGE }), /unknown collection: waypoints/, 'the old shape too, even empty');
});

test('B307: a plugin\'s collection on a composition without the plugin is refused -- SD12\'s refusal, by the composition', () => {
	const { pipes, links, ...core } = doc();
	assert.equal(validateDoc(core, { kinds: CORE }), null, 'what the core holds');
	assert.match(validateDoc({ ...core, pipes: [] }, { kinds: CORE }), /unknown collection: pipes/);
});

test('B307: an agent posting the old shape -- waypoints, no schema -- is refused, saying why, where it was told "created"', async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-b307-'));
	const app = await makeApp({ dataDir: dir, secretsDir: dir, port: 0 });
	try {
		const r = await fetch(`http://localhost:${app.port}/api/v1/diagrams`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'agent', doc: { meta: { name: 'agent' }, nodes: [{ id: 'node-0e0001', name: 'r1', type: 'router', x: 0, y: 0 }],
				waypoints: [{ id: 'waypoint-0e0002', name: 'w', x: 120, y: 0 }], links: [] } }) });
		const body = await r.json();
		assert.notEqual(r.status, 201, `refused, not created: ${JSON.stringify(body).slice(0, 200)}`);
		assert.match(JSON.stringify(body), /unknown collection: waypoints/);
	} finally { await app.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('B248 (SD12): each document lists the plugins its composition needs, a peer lacking a listed plugin refuses the document, and changing the list is an undoable edit', async () => {
	const { Model, commit, undo } = await import('./fixtures/composed.mjs');
	const { Log } = await import('../planner/log.mjs');
	const m = new Model();
	m.state.meta.id = '00000000000e0001';
	assert.deepEqual(m.toJSON().meta.plugins, ['layouts', 'zones', 'groups', 'devices', 'the simulation', 'the network'],
		'a document lists the plugins its composition brings (SD12)');
	// A peer composed without the network refuses a document that lists 'the network'
	const { pipes: _p, links: _l, ...coreDoc } = m.toJSON();
	assert.match(validateDoc(coreDoc, { kinds: CORE }), /unsupported plugin: the network/,
		'a peer lacking a plugin the document lists refuses it (SD12)');
	assert.match(validateDoc(doc({ meta: { ...doc().meta, plugins: ['layouts', 'quantum-router'] } }), { kinds: PAGE }), /unsupported plugin: quantum-router/,
		'an unknown plugin in meta.plugins is refused');
	// Changing the plugin list is an undoable meta edit (SD12)
	const log = new Log();
	const res = commit(m, log, { ops: [{ op: 'meta', patch: { plugins: ['layouts', 'devices'] } }], label: 'trim plugins' });
	assert.equal(res.ok, true, res.error);
	assert.deepEqual(m.state.meta.plugins, ['layouts', 'devices']);
	const back = undo(m, log);
	assert.equal(back.ok, true);
	assert.deepEqual(m.state.meta.plugins, ['layouts', 'zones', 'groups', 'devices', 'the simulation', 'the network'],
		'undo restores the previous plugin list');
});

