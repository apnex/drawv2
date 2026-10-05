/*
B294 -- a redo pressed before its undo is answered was refused, and the page said nothing.

Undo and redo carry `expect`: the version the tab stood at when the key was pressed, so the server refuses to reverse a change
the person never saw. A redo pressed while the undo was still on the wire carried the version from BEFORE the undo, which
the undo itself had moved past, so the server refused it as a version conflict and the redo was lost. The lab could not show
it: its planner answers in the page, before the next key. Found by P7 X-b, the matrix on the product page (UNDO-03).

The rule: a verb whose turn comes while an earlier request is on the wire waits for that request's answer, and goes out
stamped with the version the answer carried -- "the version I stood at", where the tab stands once its own earlier request
lands. Anyone else's write in between still moves the server past it, and is still refused. A verb waiting behind a request
the server REFUSED is premised on it, so it is dropped with the refusal, and said.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from '../model/model.mjs';
import { Changes } from '../app/src/changes.js';
import { Sync } from '../app/src/sync.js';

function harness() {
	let onMsg = () => {};
	const sent = [];
	const net = { subscribe(fn) { onMsg = fn; }, onStatus() {}, isOpen: () => true, send(cmd, body) { sent.push({ cmd, ...body }); return true; } };
	const model = new Model();
	const changes = new Changes(model);
	const states = [];
	const sync = new Sync({ model, net, history: changes, selection: { subscribe() {}, list: () => [], set() {} }, onState: (s) => states.push(s) });
	changes.onCommit((req) => sync.submit(req));
	onMsg({ cmd: 'sync', body: { version: 5, canUndo: true, canRedo: false } });
	return { sync, changes, sent, states, receive: (msg) => onMsg(msg) };
}

test('B294: a redo pressed before its undo is answered waits, and goes out at the version the undo left', () => {
	const h = harness();
	h.changes.undo();
	h.changes.redo();
	assert.deepEqual(h.sent.map((m) => m.cmd), ['undo'], 'the redo waits while the undo is on the wire');
	assert.equal(h.sent[0].expect, 5, 'the undo expects the version the tab stood at');
	h.receive({ cmd: 'ack', body: { acked: h.sent[0].txnId, version: 6, ops: [], canUndo: false, canRedo: true } });
	assert.deepEqual(h.sent.map((m) => m.cmd), ['undo', 'redo'], 'the undo answered, the redo goes out');
	assert.equal(h.sent[1].expect, 6, 'expecting the version the undo left, not the one before it');
});

test('B294: a redo waiting behind an undo the server refused is dropped with it, and said', () => {
	const h = harness();
	h.changes.undo();
	h.changes.redo();
	h.receive({ cmd: 'error', body: { txnId: h.sent[0].txnId, code: 'version-conflict', message: 'the document moved on' } });
	assert.deepEqual(h.sent.filter((m) => m.cmd === 'undo' || m.cmd === 'redo').map((m) => m.cmd), ['undo'], 'the redo, premised on the undo, never goes out (the refusal\'s resync may)');
	assert.equal(h.sync.outbox.filter((m) => m.verb).length, 0, 'and is not left waiting');
	assert.match(h.states.at(-1).error, /the document moved on.*redo/, 'the refusal says the redo went with it');
});

test('B294: a verb with nothing on the wire goes out at once, as before', () => {
	const h = harness();
	h.changes.undo();
	assert.deepEqual(h.sent.map((m) => [m.cmd, m.expect]), [['undo', 5]]);
});
