// Commands — the request builders.
//
// These used to test History: apply a command, replay its inverses, assert the model came back.
// Undo moved to the server (see tests/txn.test.js for the inverse round-trip and tests/undo.test.js
// for undo across writers), so what is left to test here is the FORWARD INTENT each builder
// produces, and the cascade closure they keep as a local projection.
//
// The closure is deliberately still here: a disconnected browser must not build a document whose
// links dangle. The server re-derives the same cascade idempotently over these explicit ops.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from '../document/index.mjs';
import { createEntity, moveEntities, deleteSelection, createGroup, ungroupAll,
	setContentValue, reshapeNodes, renameEntity } from '../app/src/commands.js';
import { applyOps } from '../document/ops.mjs';
import { Changes } from '../app/src/changes.js';

const node = (id, x = 0, extra = {}) => ({ id, name: id, type: 'host', shape: 'circle', x, y: 0, ...extra });

function seeded() {
	const m = new Model();
	['node-aa0001', 'node-aa0002', 'node-aa0003'].forEach((id, i) => m.put('node', node(id, i * 60)));
	m.put('link', { id: 'link-aa0004', src: 'node-aa0001', dst: 'node-aa0002' });
	return m;
}

// what Changes does with a command, so a builder can be exercised end-to-end
function apply(model, command) {
	const changes = new Changes(model);
	const sent = [];
	changes.onCommit((r) => sent.push(r));
	changes.commit(command);
	return sent[0] || null;
}

test('every builder emits forward intent only — no entry carries `before`', () => {
	const m = seeded();
	const commands = [
		createEntity('node', node('node-ab0001')),
		moveEntities([{ kind: 'node', id: 'node-aa0001', before: { x: 0, y: 0 }, after: { x: 60, y: 60 } }]),
		deleteSelection(m, new Set(['node-aa0001'])),
		createGroup(m, ['node-aa0001', 'node-aa0002']),
		reshapeNodes(m, ['node-aa0001']),
		renameEntity('node', 'node-aa0001', 'old', 'new'),
		ungroupAll(m, []),
	];
	for (const c of commands) {
		for (const e of c.entries) {
			assert.equal('before' in e, false, `${c.label}: the server derives the inverse`);
		}
	}
});

test('createEntity puts the entity', () => {
	const m = new Model();
	const req = apply(m, createEntity('node', node('node-ba0001')));
	assert.equal(req.label, 'create node');
	assert.deepEqual(req.ops, [{ op: 'put', kind: 'node', entity: node('node-ba0001') }]);
	assert.ok(m.get('node', 'node-ba0001'), 'and it is applied locally');
});

test('moveEntities carries only the destination', () => {
	const m = seeded();
	const req = apply(m, moveEntities([{ kind: 'node', id: 'node-aa0001', before: { x: 0, y: 0 }, after: { x: 120, y: 60 } }]));
	assert.deepEqual(req.ops, [{ op: 'set', kind: 'node', id: 'node-aa0001', patch: { x: 120, y: 60 } }]);
	assert.equal(m.get('node', 'node-aa0001').x, 120);
});

test('deleteSelection keeps the cascade as a local projection', () => {
	const m = seeded();
	const req = apply(m, deleteSelection(m, new Set(['node-aa0001'])));
	assert.equal(m.get('node', 'node-aa0001'), undefined);
	assert.equal(m.get('link', 'link-aa0004'), undefined, 'the link went with its endpoint');
	assert.ok(req.ops.some((o) => o.op === 'del' && o.kind === 'link'), 'and the intent says so explicitly');
	// referential order: dependents first, so a server validating referentially accepts the batch
	const linkAt = req.ops.findIndex((o) => o.kind === 'link');
	const nodeAt = req.ops.findIndex((o) => o.kind === 'node');
	assert.ok(linkAt < nodeAt, 'the link is removed before the node it depends on');
});

test('deleteSelection shrinks a group, and dissolves it below two members', () => {
	const m = seeded();
	m.put('group', { id: 'group-ca0001', name: 'g', members: ['node-aa0001', 'node-aa0002', 'node-aa0003'] });
	apply(m, deleteSelection(m, new Set(['node-aa0003'])));
	assert.deepEqual(m.get('group', 'group-ca0001').members, ['node-aa0001', 'node-aa0002'], 'shrunk');

	apply(m, deleteSelection(m, new Set(['node-aa0002'])));
	assert.equal(m.get('group', 'group-ca0001'), undefined, 'dissolved below two');
});

test('deleting a via-waypoint strips it from every routed link', () => {
	const m = seeded();
	m.put('waypoint', { id: 'waypoint-da0001', x: 60, y: 60 });
	m.set('link', 'link-aa0004', { via: ['waypoint-da0001'] });
	apply(m, deleteSelection(m, new Set(['waypoint-da0001'])));
	assert.equal(m.get('waypoint', 'waypoint-da0001'), undefined);
	assert.deepEqual(m.get('link', 'link-aa0004').via, [], 'the surviving link no longer references it');
});

test('deleting a waypoint ENDPOINT deletes the link rather than stripping it', () => {
	const m = seeded();
	m.put('waypoint', { id: 'waypoint-ea0001', x: 60, y: 60 });
	m.put('link', { id: 'link-ea0002', src: 'node-aa0001', dst: 'waypoint-ea0001' });
	apply(m, deleteSelection(m, new Set(['waypoint-ea0001'])));
	assert.equal(m.get('link', 'link-ea0002'), undefined);
});

test('createGroup steals members, as a local projection of the server rule', () => {
	const m = seeded();
	m.put('group', { id: 'group-fa0001', name: 'a', members: ['node-aa0001', 'node-aa0002', 'node-aa0003'] });
	apply(m, createGroup(m, ['node-aa0002', 'node-aa0003']));
	const membership = m.all('group').flatMap((g) => g.members);
	assert.equal(new Set(membership).size, membership.length, 'no node in two groups');
});

test('createGroup requires at least two endpoints', () => {
	const m = seeded();
	assert.equal(createGroup(m, ['node-aa0001']).entries.length, 0);
	assert.equal(createGroup(m, []).entries.length, 0);
});

test('setContentValue writes one region and does not alias the live array', () => {
	const m = new Model();
	m.put('node', node('node-ga0001', 0, { content: [{ at: [0, 0], content: 'text', value: 'old' }] }));
	const req = apply(m, setContentValue(m, 'node-ga0001', 0, 'new'));
	assert.equal(m.get('node', 'node-ga0001').content[0].value, 'new');
	req.ops[0].patch.content[0].value = 'tampered';
	assert.equal(m.get('node', 'node-ga0001').content[0].value, 'new', 'the op does not alias the model');
});

test('reshapeNodes toggles circle<->square and skips non-nodes', () => {
	const m = seeded();
	m.put('node', node('node-ha0001', 0, { shape: 'square' }));
	const req = apply(m, reshapeNodes(m, ['node-aa0001', 'node-ha0001', 'link-aa0004', 'node-nope']));
	assert.equal(req.ops.length, 2, 'only the two real nodes');
	assert.equal(m.get('node', 'node-aa0001').shape, 'square');
	assert.equal(m.get('node', 'node-ha0001').shape, 'circle');
});

test('ungroupAll removes every named group in one command', () => {
	const m = seeded();
	m.put('group', { id: 'group-ia0001', name: 'a', members: ['node-aa0001', 'node-aa0002'] });
	m.put('group', { id: 'group-ia0002', name: 'b', members: ['node-aa0002', 'node-aa0003'] });
	apply(m, ungroupAll(m, ['group-ia0001', 'group-ia0002']));
	assert.equal(m.all('group').length, 0);
});
