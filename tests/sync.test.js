import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from '../document/index.mjs';
import { Selection } from '../app/src/selection.js';
import { Sync } from '../app/src/sync.js';

// R2: the client forwards a selection (model-state) change to the server on the pulse. Tested with a
// fake net (no browser): construct Sync, clear its auto-pulse, drive flush() manually.
function harness() {
	const sent = [];
	const net = { subscribe() {}, onStatus() {}, isOpen: () => true, send: (cmd, body) => sent.push({ cmd, body }) };
	const model = new Model();
	const selection = new Selection(model);
	const sync = new Sync({ model, net, history: { clear() {} }, selection });
	clearInterval(sync.pulse);   // drive flush() manually; don't leave the interval running
	sync.hydrated = true;        // forwarding requires hydration
	return { sent, model, selection, sync };
}

test('R2: a selection change forwards a ws select on the next pulse', () => {
	const { sent, model, selection, sync } = harness();
	const n = model.makeNode('router', { x: 0, y: 0 }); model.put('node', n);
	selection.set([n.id]);
	assert.equal(sync.selectionDirty, true, 'selection change marked dirty');
	sync.flush();
	const sel = sent.find((m) => m.cmd === 'select');
	assert.ok(sel, 'a select was forwarded');
	assert.deepEqual(sel.body.ids, [n.id]);
	assert.equal(sync.selectionDirty, false, 'flag cleared after send');
});

test('R2: selection is NOT forwarded while Server-Locked (read-only)', () => {
	const { sent, model, selection, sync } = harness();
	sync.locked = true;
	const n = model.makeNode('router', { x: 0, y: 0 }); model.put('node', n);
	selection.set([n.id]);
	assert.equal(sync.selectionDirty, false, 'locked → change not marked dirty');
	sync.flush();
	assert.ok(!sent.some((m) => m.cmd === 'select'), 'no select forwarded while locked');
});

test('R2: a selection-only change still flushes (empty entity queue)', () => {
	const { sent, model, selection, sync } = harness();
	const n = model.makeNode('router', { x: 0, y: 0 }); model.put('node', n);
	sync.flush();                       // drain the put
	const before = sent.length;
	selection.set([n.id]);              // selection changes, no entity change
	sync.flush();
	assert.equal(sent.length, before + 1, 'the selection-only change flushed');
	assert.equal(sent[sent.length - 1].cmd, 'select');
});
