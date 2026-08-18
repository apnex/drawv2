import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from '../document/index.mjs';
import { History, createEntity, moveEntities, deleteSelection, createGroup, ungroup } from '../app/src/commands.js';

// Tests over the SHIPPED command layer (app/src/commands.js) + the sovereign document Model
// (document/index.mjs). commands.js imports groupAfterRemoval from the engine at module level
// (the engine-backed dissolve/trim threshold) — no engine injection is needed, and History wraps
// the bare Model exactly as app/src/main.js wires it (`new History(model)`).

function fixture() {
	const model = new Model();
	const history = new History(model);
	const a = model.makeNode('host', { x: -120, y: 0 });
	const b = model.makeNode('router', { x: 0, y: 0 });
	const c = model.makeNode('server', { x: 120, y: 0 });
	[a, b, c].forEach((n) => history.commit(createEntity('node', n)));
	const link = model.makeLink(a.id, b.id);
	history.commit(createEntity('link', link));
	return { model, history, a, b, c, link };
}

test('createEntity is undoable and redoable', () => {
	const { model, history, a } = fixture();
	assert.ok(model.get('node', a.id));
	history.undo(); // link
	history.undo(); // node c
	history.undo(); // node b
	history.undo(); // node a
	assert.equal(model.all('node').length, 0);
	assert.ok(!history.canUndo());
	history.redo();
	assert.ok(model.get('node', a.id));
});

test('moveEntities applies after-state and undoes to before-state', () => {
	const { model, history, a } = fixture();
	history.commit(moveEntities([{ kind: 'node', id: a.id, before: { x: -120, y: 0 }, after: { x: -60, y: 60 } }]));
	assert.equal(model.get('node', a.id).x, -60);
	history.undo();
	assert.equal(model.get('node', a.id).x, -120);
	history.redo();
	assert.equal(model.get('node', a.id).y, 60);
});

test('deleteSelection cascades links and restores them on undo', () => {
	const { model, history, a, link } = fixture();
	history.commit(deleteSelection(model, new Set([a.id])));
	assert.equal(model.get('node', a.id), undefined);
	assert.equal(model.get('link', link.id), undefined, 'link touching deleted node cascades');
	history.undo();
	assert.ok(model.get('node', a.id));
	assert.ok(model.get('link', link.id));
});

test('deleteSelection shrinks groups and dissolves below 2 members', () => {
	const { model, history, a, b, c } = fixture();
	history.commit(createGroup(model, [a.id, b.id, c.id]));
	const group = model.all('group')[0];

	// deleting one member shrinks the group
	history.commit(deleteSelection(model, new Set([c.id])));
	assert.deepEqual(model.get('group', group.id).members.sort(), [a.id, b.id].sort());

	// deleting another dissolves it (1 member would remain)
	history.commit(deleteSelection(model, new Set([b.id])));
	assert.equal(model.get('group', group.id), undefined);

	// undo restores the 2-member group, then the 3-member group
	history.undo();
	assert.deepEqual(model.get('group', group.id).members.sort(), [a.id, b.id].sort());
	history.undo();
	assert.equal(model.get('group', group.id).members.length, 3);
});

test('createGroup steals members from existing groups', () => {
	const { model, history, a, b, c } = fixture();
	history.commit(createGroup(model, [a.id, b.id]));
	const first = model.all('group')[0];
	history.commit(createGroup(model, [b.id, c.id]));
	// first group dropped below 2 members -> dissolved
	assert.equal(model.get('group', first.id), undefined);
	assert.equal(model.all('group').length, 1);
	assert.deepEqual(model.all('group')[0].members.sort(), [b.id, c.id].sort());
	history.undo();
	assert.ok(model.get('group', first.id), 'undo restores the stolen-from group');
});

test('createGroup requires at least 2 endpoints', () => {
	const { model, history, a } = fixture();
	const before = model.all('group').length;
	const stackBefore = history.stack.length;
	history.commit(createGroup(model, [a.id]));
	assert.equal(model.all('group').length, before, 'no group created from a single endpoint');
	assert.equal(history.stack.length, stackBefore, 'an empty command is not pushed to history');
});

test('ungroup removes and undo restores', () => {
	const { model, history, a, b } = fixture();
	history.commit(createGroup(model, [a.id, b.id]));
	const group = model.all('group')[0];
	history.commit(ungroup(model, group.id));
	assert.equal(model.all('group').length, 0);
	history.undo();
	assert.deepEqual(model.get('group', group.id).members.sort(), [a.id, b.id].sort());
});

test('new commits drop the redo tail', () => {
	const { model, history } = fixture();
	const d = model.makeNode('host', { x: 300, y: 300 });
	history.commit(createEntity('node', d));
	history.undo();
	assert.ok(history.canRedo());
	const e = model.makeNode('host', { x: 360, y: 360 });
	history.commit(createEntity('node', e));
	assert.ok(!history.canRedo());
	assert.equal(model.get('node', d.id), undefined);
});

test('history is bounded', () => {
	const model = new Model();
	const history = new History(model, 5);
	for (let i = 0; i < 10; i++) {
		history.commit(createEntity('node', model.makeNode('host', { x: -300 + i * 60, y: 0 })));
	}
	assert.equal(history.stack.length, 5);
	for (let i = 0; i < 10; i++) history.undo(); // only 5 undoable, no throw
	assert.equal(model.all('node').length, 5);
});

// ---- shipped-only coverage ----

// a routed link threads through one or more waypoints in its `via` array. Deleting a waypoint that
// is used ONLY as a via bend (not an endpoint) must strip it from every surviving link's via — the
// doc may never reference a missing waypoint — and undo must restore both the waypoint and the via.
test('deleting a via-waypoint strips it from every routed link and undo restores both', () => {
	const { model, history, a, b, link } = fixture();
	const w = model.makeWaypoint({ x: -60, y: 60 });
	history.commit(createEntity('waypoint', w));
	// route the existing a->b link through w (w is a via bend, NOT an endpoint)
	model.set('link', link.id, { via: [w.id] });
	assert.deepEqual(model.get('link', link.id).via, [w.id]);

	history.commit(deleteSelection(model, new Set([w.id])));
	assert.equal(model.get('waypoint', w.id), undefined, 'via-waypoint deleted');
	assert.ok(model.get('link', link.id), 'the link itself survives — w was only a bend, not an endpoint');
	assert.deepEqual(model.get('link', link.id).via, [], 'waypoint stripped from the link via');

	history.undo();
	assert.ok(model.get('waypoint', w.id), 'waypoint restored on undo');
	assert.deepEqual(model.get('link', link.id).via, [w.id], 'via restored on undo (after the waypoint exists again)');
	assert.equal(model.get('link', link.id).src, a.id);
	assert.equal(model.get('link', link.id).dst, b.id);
});

// deleting a NODE that a routed link passes through (a link endpoint, where the link also has via
// bends) cascades the whole link — carrying its via away intact — and undo restores the link with
// its full via, while the bend-waypoints themselves are untouched by the delete.
test('deleting a node cascades a routed link and restores its via intact', () => {
	const { model, history, a, b, link } = fixture();
	const w1 = model.makeWaypoint({ x: -60, y: 60 });
	const w2 = model.makeWaypoint({ x: -30, y: 90 });
	history.commit(createEntity('waypoint', w1));
	history.commit(createEntity('waypoint', w2));
	model.set('link', link.id, { via: [w1.id, w2.id] });

	history.commit(deleteSelection(model, new Set([a.id])));
	assert.equal(model.get('node', a.id), undefined, 'endpoint node deleted');
	assert.equal(model.get('link', link.id), undefined, 'routed link cascades with its endpoint');
	// the bend-waypoints are NOT in the selection — they ride away with the link, untouched in the store
	assert.ok(model.get('waypoint', w1.id), 'bend-waypoint survives the cascade (carried by the link, not deleted)');
	assert.ok(model.get('waypoint', w2.id));

	history.undo();
	assert.ok(model.get('node', a.id), 'node restored');
	const restored = model.get('link', link.id);
	assert.ok(restored, 'link restored');
	assert.deepEqual(restored.via, [w1.id, w2.id], 'the routed via is restored intact');
});

// the engine-backed dissolve threshold (groupAfterRemoval, imported from ../engine) governs groups
// of ANY endpoint kind — nodes OR waypoints. Deleting a waypoint member of a 2-member group drops it
// below the threshold, dissolving the group; undo restores the whole group.
test('engine-backed dissolve: deleting a waypoint member dissolves a 2-member group', () => {
	const { model, history, a } = fixture();
	const w = model.makeWaypoint({ x: -60, y: 60 });
	history.commit(createEntity('waypoint', w));

	history.commit(createGroup(model, [a.id, w.id]));   // a group spanning a node + a waypoint endpoint
	const group = model.all('group')[0];
	assert.ok(group, 'group created over 2 endpoints');
	assert.deepEqual(group.members.sort(), [a.id, w.id].sort());

	history.commit(deleteSelection(model, new Set([w.id])));
	assert.equal(model.get('group', group.id), undefined, 'remaining 1 member < 2 → engine dissolves the group');
	assert.equal(model.get('waypoint', w.id), undefined);

	history.undo();
	assert.equal(model.get('waypoint', w.id) && true, true, 'waypoint restored');
	assert.deepEqual(model.get('group', group.id).members.sort(), [a.id, w.id].sort(), 'group restored with both members');
});
