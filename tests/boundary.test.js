// CS3 — the browser's commit boundary.
//
// The defect: app/src/sync.js subscribed to model.onChange, which is the RENDER signal. Live drag
// state is written into the shared model on every pointer-move frame, so a 4-second 3-node drag
// produced ~60 server transactions. Sync now subscribes to Changes, so an uncommitted preview
// cannot reach the wire at all.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from '../model/index.mjs';
import { Changes } from '../app/src/changes.js';

// B112: an unpositioned fixture node gets a DISTINCT anchor derived from its id -- one
// anchor holds one occupant, so two fixtures defaulting to (0,0) is now a real violation.
const _at = (id) => (parseInt(id.slice(-4), 16) % 15 + 1) * 60;
const node = (id, x = null) => ({ id, name: id, type: 'host', shape: 'circle', x: x ?? _at(id), y: 0 });
const seed = (m, ids) => ids.forEach((id, i) => m.put('node', node(id, i * 60)));

// what main.js does: history.onCommit((request) => sync.submit(request))
function wired({ coalesceMs = 600, now = () => Date.now() } = {}) {
	const model = new Model();
	const changes = new Changes(model, { coalesceMs, now });
	const sent = [];
	changes.onCommit((request) => sent.push(request));
	return { model, changes, sent };
}

test('a drag writes to the model every frame and sends NOTHING until it commits', () => {
	const { model, changes, sent } = wired();
	seed(model, ['node-aa0001', 'node-aa0002', 'node-aa0003']);
	const ids = ['node-aa0001', 'node-aa0002', 'node-aa0003'];

	// 60 frames x 3 entities — exactly what input.js does during a 4s drag at 15fps
	for (let frame = 0; frame < 60; frame++) {
		ids.forEach((id, i) => model.set('node', id, { x: i * 60 + frame, y: frame }));
	}
	assert.equal(sent.length, 0, 'not one preview frame reached the wire');

	// the gesture ends: ONE command carrying the final position of each entity
	changes.commit({ label: 'move', entries: ids.map((id, i) => ({ op: 'set', kind: 'node', id, after: { x: i * 60 + 59, y: 59 } })) });

	assert.equal(sent.length, 1, 'a 3-node drag is exactly ONE request');
	assert.equal(sent[0].ops.length, 3, 'carrying one op per entity');
	assert.equal(sent[0].label, 'move');
});

test('an abandoned gesture sends nothing at all', () => {
	const { model, changes, sent } = wired();
	seed(model, ['node-ab0001']);
	for (let f = 0; f < 20; f++) model.set('node', 'node-ab0001', { x: f * 10 });
	// the user presses Escape — no commit
	assert.equal(sent.length, 0, 'the server never saw a gesture that was cancelled');
});

test('the forward intent travels; the inverse does not', () => {
	const { model, changes, sent } = wired();
	seed(model, ['node-ac0001']);
	changes.commit({ label: 'move', entries: [
		{ op: 'set', kind: 'node', id: 'node-ac0001', before: { x: 0 }, after: { x: 120 } },
	] });
	const op = sent[0].ops[0];
	assert.deepEqual(op, { op: 'set', kind: 'node', id: 'node-ac0001', patch: { x: 120 } });
	assert.equal('before' in op, false, 'the server derives the inverse from the pre-state');
});

test('a commit applies locally first — the gesture must feel instant', () => {
	const { model, changes } = wired();
	seed(model, ['node-ad0001']);
	changes.commit({ label: 'move', entries: [{ op: 'set', kind: 'node', id: 'node-ad0001', after: { x: 300 } }] });
	assert.equal(model.get('node', 'node-ad0001').x, 300, 'applied without waiting for the server');
});

test('put and del entries convert to ops', () => {
	const { changes, sent } = wired();
	changes.commit({ label: 'create', entries: [{ op: 'put', kind: 'node', entity: node('node-ae0001') }] });
	assert.deepEqual(sent[0].ops[0], { op: 'put', kind: 'node', entity: node('node-ae0001') });

	changes.commit({ label: 'delete', entries: [{ op: 'del', kind: 'node', entity: node('node-ae0001') }] });
	assert.deepEqual(sent[1].ops[0], { op: 'del', kind: 'node', id: 'node-ae0001' });
});

test('an empty command is not a change', () => {
	const { changes, sent } = wired();
	changes.commit({ label: 'nothing', entries: [] });
	changes.commit(null);
	assert.equal(sent.length, 0);
});

// ---- the nudge coalesce window ----

test('a burst of nudges is ONE change, not one per keystroke', () => {
	let t = 0;
	const { model, changes, sent } = wired({ coalesceMs: 600, now: () => t });
	seed(model, ['node-af0001']);
	for (let k = 0; k < 5; k++) {
		t += 100;                                   // inside the window
		changes.amend({ label: 'nudge', entries: [{ op: 'set', kind: 'node', id: 'node-af0001', after: { x: k * 60 } }] });
	}
	assert.equal(sent.length, 0, 'the window is still open');
	t += 700;
	changes.commit({ label: 'move', entries: [{ op: 'set', kind: 'node', id: 'node-af0001', after: { x: 999 } }] });
	assert.equal(sent.length, 2, 'the window closed, then the new command');
	assert.equal(sent[0].label, 'nudge');
	assert.equal(sent[0].ops.length, 5, 'five keystrokes, one change');
});

test('a burst of a DIFFERENT label closes the open window rather than joining it', () => {
	let t = 0;
	const { model, changes, sent } = wired({ coalesceMs: 600, now: () => t });
	seed(model, ['node-ba0001']);
	changes.amend({ label: 'nudge', entries: [{ op: 'set', kind: 'node', id: 'node-ba0001', after: { x: 60 } }] });
	t += 50;
	changes.amend({ label: 'resize', entries: [{ op: 'set', kind: 'node', id: 'node-ba0001', after: { span: { cols: 2, rows: 1 } } }] });
	assert.equal(sent.length, 1, 'the nudge window closed when the shape changed');
	assert.equal(sent[0].label, 'nudge');
});

test('undo and redo ask the server, carrying the version they believe', () => {
	const { changes, sent } = wired();
	changes.setCounts({ canUndo: true, canRedo: true, version: 7 });
	changes.undo();
	assert.deepEqual(sent[0], { verb: 'undo', expect: 7 });
	changes.redo();
	assert.deepEqual(sent[1], { verb: 'redo', expect: 7 });
});

test('undo flushes an open window first, so the burst is undoable as itself', () => {
	let t = 0;
	const { model, changes, sent } = wired({ coalesceMs: 600, now: () => t });
	seed(model, ['node-bb0001']);
	changes.amend({ label: 'nudge', entries: [{ op: 'set', kind: 'node', id: 'node-bb0001', after: { x: 60 } }] });
	changes.undo();
	assert.equal(sent.length, 2);
	assert.equal(sent[0].label, 'nudge', 'the burst was committed before the undo asked');
	assert.equal(sent[1].verb, 'undo');
});

test('canUndo/canRedo reflect the SERVER, not a local stack', () => {
	const { changes } = wired();
	assert.equal(changes.canUndo(), false);
	changes.commit({ label: 'x', entries: [{ op: 'put', kind: 'node', entity: node('node-bc0001') }] });
	assert.equal(changes.canUndo(), false, 'a local commit does not presume the server accepted it');
	changes.setCounts({ canUndo: true });
	assert.equal(changes.canUndo(), true, 'the ack is what makes it true');
});

test('clear() no longer destroys undo history — that was the defect', () => {
	const { changes } = wired();
	changes.setCounts({ canUndo: true, version: 3 });
	changes.clear();                                // what a snapshot used to trigger
	assert.equal(changes.canUndo(), true, 'an authoritative snapshot does not wipe undo any more');
	assert.equal(changes.state.version, 3);
});
