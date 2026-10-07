/*
B242 / H17-D3 on every path by which the server's word reaches the tab.

tests/b242-reconcile.test.js covers the answer to the tab's own request. The ruling's promise is wider:
at every moment the tab shows the server's document with its own unanswered ops on top, so it converges
and no edit of its own is ever reverted, even for a moment. K1's adversarial pass reproduced that promise
failing on the other paths, and each case below is one of its constructions, through real code:

- a resync or a reconnect that restores the persisted outbox on top of the live one;
- a snapshot, or a reload, that re-applies a request the server has already answered;
- a snapshot that drops the open burst window;
- another writer's change landing on a field the tab has an unanswered edit of;
- a change or a snapshot held for a gesture, and an ack applied ahead of it;
- a request lost with the socket, re-sent after a newer one;
- a rate-limited request dropped from the outbox;
- a replayed or no-op ack moving the tab's version;
- the replay itself moving a node a live drag holds;
- a snapshot the tab asked for, loaded under a live drag that then writes its start position into it.

The tab is a real Model, Changes and Sync, wired as app/src/main.js wires them. The server is a real
Store behind real protocol Sessions on a real Hub, so another writer's change is broadcast exactly as in
production. Only the sockets are replaced, by queues the test drains in order, which is what lets a test
hold an answer back, lose one with a socket, or deliver one mid-gesture.
*/

import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Model } from '../model/model.mjs';
import { Changes } from '../app/src/changes.js';
import { Sync, bindGestureDefer } from '../app/src/sync.js';
import { deleteSelection, renameEntity, nudgeSelection, moveEntities } from '../app/src/commands.js';
import { Session } from '../server/protocol.js';
import { Hub } from '../server/hub.js';
import { OWNER, openStore } from './fixtures/app.mjs';
import { makeInput, pointer } from './fixtures/client-harness.mjs';
import { productKinds } from '../planner/kinds.mjs';
import { NETWORK_ROWS } from '../network/kinds.mjs';
import { createNetwork as netFor } from '../network/network.mjs';
import { createTransit as transitFor } from '../network/transit.mjs';
const aNetwork = () => netFor(transitFor());   // a Model holding links is given one (V-e, J2)
const PAGE_KINDS = productKinds(...NETWORK_ROWS);

// the browser storage the outbox persists through (D30); one tab at a time uses it, as one page would.
// A world made with `disk: false` has none, like a private window: nothing is kept or restored.
const disk = new Map();
let diskOn = true;
globalThis.localStorage = {
	getItem: (k) => (diskOn && disk.has(k) ? disk.get(k) : null),
	setItem: (k, v) => { if (diskOn) disk.set(k, String(v)); },
	removeItem: (k) => disk.delete(k),
};
console.warn = () => {};   // Sync logs each refusal; the tests assert on what the tab holds instead

// the messages that carry the document; a session may also announce who is watching
const DOC = new Set(['snapshot', 'change', 'ack', 'error', 'sync']);
const cmds = (msgs) => msgs.filter((m) => DOC.has(m.cmd)).map((m) => m.cmd);

// ---- the world: one tab, the server, and another writer ----

async function world(seed, { tab: given = null, disk: kept = true } = {}) {
	disk.clear();
	diskOn = kept;
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-b242-paths-'));
	let store = await openStore(dir);
	const made = store.create('b242-paths', null, OWNER);
	assert.equal(made.ok, true, made.error);
	const id = made.model.state.meta.id;
	const seeded = store.commit(id, { label: 'seed', ops: seed.map(([kind, entity]) => ({ op: 'put', kind, entity })) },
		'server', 'seed', OWNER);
	assert.equal(seeded.ok, true, seeded.error);
	await store.flushAll();                     // the seed is on disk; nothing after it is, unless a test flushes
	let hub = new Hub();

	// another writer: a bare session on the same hub, whose commits reach the tab as broadcasts
	let other = null;
	const connectOther = () => {
		const on = {};
		new Session({ readyState: 1, on: (ev, fn) => { on[ev] = fn; }, send() {} }, store, hub, null, OWNER);
		other = (cmd, body) => on.message(Buffer.from(JSON.stringify({ cmd, body })));
		other('hello', { diagram: id });
	};
	connectOther();

	// the tab's socket: what it sends waits in `up`, what the server answers waits in `down`
	const up = [], down = [], sent = [];   // `sent`: every message the tab sent, never drained (B304)
	let open = true, receive = () => {}, status = () => {}, server = null;
	const connect = () => {
		const on = {};
		const ws = { readyState: 1, on: (ev, fn) => { on[ev] = fn; }, send: (text) => down.push(JSON.parse(text)) };
		new Session(ws, store, hub, null, OWNER);
		server = { take: (cmd, body) => on.message(Buffer.from(JSON.stringify({ cmd, body }))), close: () => { ws.readyState = 3; on.close?.(); } };
	};
	const net = {
		get status() { return open ? 'open' : 'closed'; },
		subscribe: (fn) => { receive = fn; }, onStatus: (fn) => { status = fn; },
		isOpen: () => open,
		send: (cmd, body) => { if (!open) return false; const m = { cmd, body: JSON.parse(JSON.stringify(body ?? {})) }; up.push(m); sent.push(m); return true; },
	};

	const w = {
		id, up, down, sent,
		// a page: its Model, Changes and Sync, wired as app/src/main.js wires them, hydrated by `hello`
		mount(parts = null) {
			w.tab = parts?.model || new Model({ kinds: PAGE_KINDS, network: aNetwork() });   // the kinds the product page composes (S-b, G1)
			// a window that never closes by itself: a test closes it, standing in for the 600 ms timer
			w.changes = parts?.changes || new Changes(w.tab, { coalesceMs: 3_600_000 });
			w.sync = new Sync({ model: w.tab, net, history: w.changes, selection: parts?.selection || { subscribe() {}, list: () => [] }, onState() {} });
			w.changes.onCommit((request) => w.sync.submit(request));   // app/src/main.js:752
			connect();
			server.take('hello', { diagram: id });
			w.deliverAll();
			assert.equal(w.sync.hydrated, true, 'the page loaded the seeded diagram');
		},
		server: () => store.get(id),
		version: () => store.log(id).version,
		// the server takes everything the tab has sent, in order
		serve() { for (const m of up.splice(0)) server.take(m.cmd, m.body); },
		deliver() { const m = down.shift(); if (m) receive(m); return m; },
		deliverAll() { const got = []; while (down.length) got.push(w.deliver()); return got; },
		// deliver up to and including the next message of this kind
		deliverTo(cmd) { for (;;) { const m = w.deliver(); assert.ok(m, `a ${cmd} was waiting`); if (m.cmd === cmd) return m; } },
		pump() { while (up.length || down.length) { w.serve(); w.deliverAll(); } },
		// another writer commits; the server applies it at once and broadcasts it to the tab
		other: (ops) => other('commit', { ops, label: 'other', txnId: `other-${Math.random().toString(36).slice(2)}` }),
		flush: () => store.flushAll(),
		// the socket drops, losing whatever was in flight either way, and comes back
		reconnect() {
			open = false;
			up.length = 0; down.length = 0;
			server.close();
			connect();
			open = true;
			status('open');
		},
		// the page reloads: a new tab on the same storage and the same server
		reload() {
			up.length = 0; down.length = 0;
			server.close();
			w.mount();
		},
		// the server process dies before its flush and boots again on the same directory
		async restart() {
			store = await openStore(dir);
			hub = new Hub();
			connectOther();
			w.reconnect();
		},
		diff: () => diffDocs(w.tab, store.get(id)),
		close() { w.changes.flush(); fs.rmSync(dir, { recursive: true, force: true }); },
	};
	w.mount(given);
	return w;
}

// which fields differ between the tab and the server, so a failure names them. meta.version is the
// server's stamp alone (tests/convergence.test.js), so it is not compared
function diffDocs(a, b) {
	const out = [];
	for (const kind of ['node', 'link', 'zone', 'group']) {
		const ids = new Set([...a.all(kind), ...b.all(kind)].map((e) => e.id));
		for (const id of [...ids].sort()) {
			const x = a.get(kind, id), y = b.get(kind, id);
			if (!x || !y) { out.push(`${id}: ${x ? 'only on the tab' : 'only on the server'}`); continue; }
			for (const f of new Set([...Object.keys(x), ...Object.keys(y)])) {
				if (JSON.stringify(x[f]) !== JSON.stringify(y[f])) out.push(`${id}.${f}: tab ${JSON.stringify(x[f])}, server ${JSON.stringify(y[f])}`);
			}
		}
	}
	if (a.state.meta.name !== b.state.meta.name) out.push(`meta.name: tab ${a.state.meta.name}, server ${b.state.meta.name}`);
	return out;
}

const CONVERGED = 'CONVERGENCE: the tab\'s document equals the server\'s once every answer is in';

const A = 'node-00000a', B = 'node-00000b', X = 'node-00000c', C = 'node-00000d';
const W = 'node-0000f1', G = 'group-0000e1';
const LONE = [
	['node', { id: A, name: 'a', type: 'host', x: 0, y: 0 }],
	['node', { id: B, name: 'b', type: 'host', x: 240, y: 240 }],
	['node', { id: X, name: 'x', type: 'host', x: -240, y: -240 }],
	['group', { id: G, name: 'g1', members: [A, B] }],
];
// B242's own shape: a bend W on a-b in a group; deleting a sweeps W and trims the group again (B241)
const G1 = [
	['node', { id: A, name: 'a', type: 'host', x: 0, y: 0 }],
	['node', { id: B, name: 'b', type: 'host', x: 240, y: 0 }],
	['node', { id: C, name: 'c', type: 'host', x: 480, y: 0 }],
	['node', { id: W, name: 'wp1', x: 120, y: 120 }],
	['link', { id: 'link-0000c1', name: 'l1', src: A, dst: B, via: [W] }],
	['group', { id: G, name: 'g1', members: [A, B, C, W] }],
];
const move = (id, x, y) => moveEntities([{ kind: 'node', id, after: { x, y } }]);
const set = (kind, id, patch) => [{ op: 'set', kind, id, patch }];
// a move onto an occupied cell: the server refuses it, and the refusal asks for a snapshot
const refusedMove = (w, id, onto) => w.changes.commit(move(id, w.tab.get('node', onto).x, w.tab.get('node', onto).y));

// ---- a snapshot: what the tab re-applies over it ----

test('a resync does not restore a second copy of a request already in the outbox, which every later answer would replay', async () => {
	const w = await world(LONE);
	try {
		w.changes.commit(move(A, 240, 0));                     // answered, and not yet durable
		w.pump();
		const first = w.sync.outbox[0].txnId;
		refusedMove(w, B, A);                                  // refused: the tab resyncs
		w.pump();
		assert.deepEqual(w.sync.outbox.map((m) => m.txnId), [first], 'the snapshot restored no second copy from disk');

		w.changes.commit(move(A, 480, 0));
		w.pump();
		assert.equal(w.server().get('node', A).x, 480, 'the server holds the later move');
		assert.deepEqual(w.diff(), [], CONVERGED);
	} finally { w.close(); }
});

test('a resync does not re-apply a request the server already answered: the sweep\'s group trim stays', async () => {
	const w = await world(G1);
	try {
		w.changes.commit(deleteSelection(w.tab, new Set([A])));   // the sweep removes W and trims G
		w.pump();
		assert.deepEqual(w.diff(), [], 'converged on the delete itself (B242 S2)');
		refusedMove(w, B, C);                                  // any resync while the delete is not yet durable
		w.pump();
		assert.deepEqual(w.tab.get('group', G).members, [B, C], 'the group does not list the swept waypoint again');
		assert.deepEqual(w.diff(), [], CONVERGED);
	} finally { w.close(); }
});

test('a resync does not put back a move that an undo reversed', async () => {
	const w = await world(LONE);
	try {
		w.changes.commit(move(A, 240, 0));
		w.pump();
		const refused = [];
		w.sync.onRefused = (b) => refused.push(b.code);
		w.changes.undo();
		w.changes.undo();                                      // the second waits for the first's answer (B294)
		w.serve();                                             // the first undo lands
		w.other(set('node', X, { name: 'moved-on' }));         // and another writer moves the server past it
		w.pump();                                              // so the second, at the version the first left, is refused
		assert.equal(refused[0], 'version-conflict', 'the second undo was refused -- the resync this test is about followed');   // a second refusal was B295's replay, fixed at H19.15 (its own test, below)
		assert.equal(w.server().get('node', A).x, 0, 'the server undid the move');
		assert.equal(w.server().get('node', X).name, 'moved-on', 'and the other writer\'s change stands: the second undo was refused');
		assert.deepEqual(w.diff(), [], CONVERGED);
	} finally { w.close(); }
});

test('a reload does not re-apply a request the server already answered: its answered state is on disk too', async () => {
	const w = await world(G1);
	try {
		w.changes.commit(deleteSelection(w.tab, new Set([A])));
		w.pump();
		assert.equal(w.sync.outbox.length, 1, 'the answered delete waits on disk until a later ack says it is durable');
		w.reload();
		w.pump();
		assert.deepEqual(w.tab.get('group', G).members, [B, C], 'the reloaded page does not list the swept waypoint again');
		assert.deepEqual(w.diff(), [], CONVERGED);
	} finally { w.close(); }
});

test('D29: an answered request a restarted server lost is the tab\'s own again: re-applied at once and re-sent', async () => {
	const w = await world(LONE);
	try {
		w.changes.commit(move(A, 240, 0));                     // answered, never flushed
		w.pump();
		await w.restart();                                      // the server loses it; `resume` finds the tab ahead
		w.serve();
		assert.ok(w.down.find((m) => m.cmd === 'snapshot')?.body.rewound, 'the server says it lost acked work -- the case under test');
		w.deliverTo('snapshot');
		assert.equal(w.tab.get('node', A).x, 240, 'the tab still shows its own move after the rewound snapshot');
		w.pump();
		assert.equal(w.server().get('node', A).x, 240, 'the re-sent move landed');
		assert.deepEqual(w.diff(), [], CONVERGED);
	} finally { w.close(); }
});

test('a snapshot keeps the nudge the open burst window still holds', async () => {
	const w = await world(LONE);
	try {
		refusedMove(w, B, A);
		w.serve();                                             // refused on the server; the refusal waits
		w.changes.amend(nudgeSelection(w.tab, [X], 1, 0));    // a nudge, its window open
		const nudged = w.tab.get('node', X).x;
		w.deliverTo('error');                                  // the refusal: the tab asks for a snapshot
		w.serve();
		w.deliverTo('snapshot');
		assert.equal(w.tab.get('node', X).x, nudged, 'the tab still shows the nudge its window holds');
		w.changes.flush();                                     // the window's timer
		w.pump();
		assert.equal(w.server().get('node', X).x, nudged, 'the server applied the nudge');
		assert.deepEqual(w.diff(), [], CONVERGED);
	} finally { w.close(); }
});

// ---- another writer's change ----

test('another writer\'s change, applied before the tab\'s unanswered edit of the same field, does not overwrite that edit', async () => {
	const w = await world(LONE);
	try {
		w.changes.commit(move(X, 480, -240));                  // the tab's edit, not yet on the server
		w.other(set('node', X, { x: -480 }));                  // the other writer reaches the server first
		w.serve();
		w.deliverTo('change');
		assert.equal(w.tab.get('node', X).x, 480, 'NO OWN-EDIT REGRESSION: the tab still shows its own unanswered move');
		w.pump();
		assert.equal(w.server().get('node', X).x, 480, 'the server applied the tab\'s move last');
		assert.deepEqual(w.diff(), [], CONVERGED);
	} finally { w.close(); }
});

// ---- messages held for a gesture (D12, B71): the server's order survives the hold ----

function gesture(w) {
	let live = false;
	w.sync.deferInbound = () => live;
	return { start() { live = true; }, end() { live = false; w.sync.releaseDeferred(); } };
}

test('an ack arriving behind a change held for a gesture is held behind it, so the change is not discarded as already seen', async () => {
	const w = await world(LONE);
	const g = gesture(w);
	try {
		w.other(set('node', X, { name: 'renamed-by-other' }));
		w.changes.commit(renameEntity('group', G, 'g1', 'mine'));
		w.serve();
		g.start();
		assert.deepEqual(cmds(w.deliverAll()), ['change', 'ack'], 'the other\'s change, then the answer to the tab\'s rename');
		g.end();
		assert.equal(w.tab.get('node', X).name, 'renamed-by-other', 'the held change landed');
		assert.deepEqual(w.diff(), [], CONVERGED);
	} finally { w.close(); }
});

/*
No disk here: restoring the outbox from disk at the first snapshot used to duplicate it, and the
unanswered duplicate of the pruned rename was then re-applied over the held snapshot, hiding this.
*/
test('acks arriving behind a snapshot held for a gesture are applied after it, not loaded over', async () => {
	const w = await world(LONE, { disk: false });
	const g = gesture(w);
	try {
		refusedMove(w, B, A);
		refusedMove(w, B, A);
		w.serve(); w.deliverAll();                             // two refusals...
		// RESTATED at H19.15: one re-fetch at a time -- two refusals ask for the document ONCE; the second snapshot this test is
		// about, unsolicited, stands for one the server sends unasked (a lock handoff, a reclaim)
		assert.equal(w.up.filter((m) => m.cmd === 'open').length, 1, '...ask for the document once');
		w.sync.net.send('open', { id: w.tab.state.meta.id });
		w.serve();                                             // two snapshots wait
		w.changes.commit(renameEntity('group', G, 'g1', 'mine'));
		w.serve();                                             // answered after both snapshots...
		await w.flush();                                       // ...and durable, so the next answer prunes it
		w.changes.commit(renameEntity('node', A, 'a', 'a2'));
		w.serve();
		w.deliverTo('snapshot');                               // the first: asked for, applied
		g.start();
		// the second counts as unsolicited (the first cleared `expectLoad`) and is held; the acks follow it
		assert.deepEqual(cmds(w.deliverAll()), ['snapshot', 'ack', 'ack'], 'the order under test');
		g.end();
		assert.equal(w.tab.get('group', G).name, 'mine', 'the rename answered after the snapshot survived its load');
		w.pump();
		assert.deepEqual(w.diff(), [], CONVERGED);
	} finally { w.close(); }
});

test('a snapshot the tab asked for, arriving while an answer is held, counts that request answered and does not re-apply it', async () => {
	const w = await world(LONE);
	const g = gesture(w);
	try {
		w.other(set('node', X, { name: 'o1' }));
		w.changes.commit(renameEntity('group', G, 'g1', 'mine'));
		w.serve();
		w.other(set('group', G, { name: 'theirs' }));          // after the tab's rename, on the same field
		refusedMove(w, B, A);
		w.serve();
		g.start();
		assert.deepEqual(cmds(w.deliverAll()), ['change', 'ack', 'change', 'error'], 'a change, the tab\'s answer and a change held; then a refusal');
		w.serve();
		w.deliverTo('snapshot');                               // the snapshot the refusal asked for: loads at once
		g.end();
		w.pump();
		assert.equal(w.server().get('group', G).name, 'theirs');
		assert.deepEqual(w.diff(), [], CONVERGED);
	} finally { w.close(); }
});

// ---- the socket and the server's limits ----

test('a request lost with the socket goes out again ahead of one made while the reconnect is answered', async () => {
	const w = await world(LONE);
	try {
		w.changes.commit(move(A, 240, 0));                     // in flight when the socket drops
		w.reconnect();                                         // lost; `resume` goes out
		w.changes.commit(move(A, 480, 0));                     // the user moves on before `resume` is answered
		w.pump();
		assert.equal(w.server().get('node', A).x, 480, 'the server applied the moves in the order the user made them');
		assert.deepEqual(w.diff(), [], CONVERGED);
	} finally { w.close(); }
});

test('B181: a rate-limited commit stays in the outbox and goes out again when the backoff has passed', async () => {
	const w = await world(LONE);
	mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.now() });
	try {
		for (let i = 0; i < 31; i++) w.changes.commit(renameEntity('node', X, 'x', `n${i}`));   // one past the budget
		w.pump();
		assert.equal(w.server().get('node', X).name, 'n29', 'the thirty-first was refused -- the case under test');
		assert.equal(w.sync.outbox.filter((m) => !m.answered).length, 1, 'and it is still the tab\'s, unanswered');
		mock.timers.tick(6001);                                // the backoff passes
		w.pump();
		assert.equal(w.server().get('node', X).name, 'n30', 'it went out again and landed');
		assert.deepEqual(w.diff(), [], CONVERGED);
	} finally { mock.timers.reset(); w.close(); }
});

// ---- the tab's version ----

/*
RESTATED at H19.15: this made its `replayed` answer by a snapshot re-sending a request already answered, which B295 stopped; a
replayed answer now comes as it does in use -- the request landed and its answer was lost with the socket. B251 (ruled
2026-09-28): the tab then fetches the document again, one `open`; B184's property is unchanged -- the version does not move
back, so the next change in order is applied and asks for nothing more.
*/
test('B184: a replayed answer does not move the tab\'s version back, so the next change in order is applied', async () => {
	const w = await world(LONE);
	try {
		w.changes.commit(move(A, 240, 0));
		w.serve();                                             // it lands...
		w.other(set('node', X, { name: 'o1' }));
		w.reconnect();                                         // ...and its answer is lost with the socket
		w.pump();
		assert.ok(w.sent.some((m) => m.cmd === 'commit' && m.body.txnId === w.sent[0].body.txnId) && w.sent.filter((m) => m.cmd === 'commit').length === 2, 'the move was sent again, unanswered as far as the tab knew');
		assert.equal(w.sync.appliedVersion, w.version(), 'the model is where the server is');
		assert.equal(w.changes.state.version, w.version(), 'and so is the undo counter, or Ctrl+Z expects a stale version');
		const opens = w.sent.filter((m) => m.cmd === 'open').length;
		w.other(set('node', X, { name: 'o2' }));
		w.deliverAll();
		assert.equal(w.sent.filter((m) => m.cmd === 'open').length, opens, 'the next change was taken in order, not answered with a resync');
		assert.equal(w.tab.get('node', X).name, 'o2');
		assert.deepEqual(w.diff(), [], CONVERGED);
	} finally { w.close(); }
});

/*
B251 (H19.15; ruled 2026-09-28, H17-B251) -- A REQUEST WHOSE ANSWER WAS LOST, ANSWERED `replayed`, IS FOLLOWED BY THE DOCUMENT AGAIN.
After a reconnect the tab cannot tell whether a request whose answer was lost reached the server; it keeps showing it and sends
it again. When the server answers `replayed` -- it had landed -- the tab re-fetches, so whatever it re-applied on top of a
document that already held it is replaced by the server's. The K1 fuzz measured 16 such breaks in 300 runs; the sync fuzz 6.
*/
test('B251: a replayed answer to a request the tab did not know had landed asks for the document again', async () => {
	const w = await world(LONE);
	try {
		w.changes.commit(move(A, 240, 0));
		w.serve();
		w.reconnect();
		let replayed = false;
		while (w.up.length || w.down.length) {
			w.serve();
			while (w.down.length) {
				const m = w.deliver();
				if (m.cmd === 'ack' && m.body.replayed) {
					replayed = true;
					assert.equal(w.up.at(-1)?.cmd, 'open', 'the replayed answer is followed by an open');
				}
			}
		}
		assert.ok(replayed, 'answered replayed -- the case under test');
		assert.deepEqual(w.diff(), [], CONVERGED);
	} finally { w.close(); }
});

test('B106: a no-op answer does not reset the tab\'s version, so the next change in order is applied', async () => {
	const w = await world(LONE);
	try {
		w.other(set('node', X, { name: 'o1' }));
		w.pump();
		assert.ok(w.sync.appliedVersion > 0, 'the tab is past version zero');
		w.changes.commit(move(A, 0, 0));                       // where it already is: the server plans nothing
		w.serve();
		assert.equal(w.deliverTo('ack').body.noop, true, 'a no-op answer -- the case under test');
		assert.equal(w.sync.appliedVersion, w.version(), 'the model is where the server is');
		w.other(set('node', X, { name: 'o2' }));
		w.deliverAll();
		assert.deepEqual(w.up.map((m) => m.cmd), [], 'the next change was taken in order, not answered with a resync');
		assert.equal(w.tab.get('node', X).name, 'o2');
	} finally { w.close(); }
});

// ---- live gestures ----

/*
The case K1's first build left open: a node with its OWN unanswered nudge is being dragged when the
answer to an EARLIER request arrives. That answer writes nothing on the node, so nothing of the tab's
there needs replaying, and replaying every pending op put the node back where the nudge had left it,
under the pointer. A drag writes the model directly (app/src/input.js updateMove), as below.
*/
test('C4 live drag: the answer to an earlier request does not snap back a dragged node that has its own unanswered nudge', async () => {
	const w = await world(LONE);
	try {
		w.changes.commit(renameEntity('group', G, 'g1', 'mine'));
		w.serve();                                             // answered; the answer waits
		w.changes.amend(nudgeSelection(w.tab, [A], 1, 0));    // the node's own edit, still in its window
		w.tab.set('node', A, { x: 480, y: 0 });                // then a drag of it, in progress
		w.deliverTo('ack');
		assert.deepEqual([w.tab.get('node', A).x, w.tab.get('node', A).y], [480, 0], 'the drag holds');
	} finally { w.close(); }
});

/*
Through the REAL Input and the real binding. A snapshot the tab asked for loads at once, even under a
live drag (B71), and a gesture does not survive a document swap. Ended AFTER the swap -- by Input's own
load handler -- a cancelled move writes its drag-start position into the document just loaded. Here the
drag starts on the tab's own refused move, so that position is one the server never had.
*/
test('a snapshot the tab asked for, arriving mid-drag, ends the drag first: its start position is not written into the new document', async () => {
	const h = makeInput();
	try {
		const w = await world([
			['node', { id: A, name: 'a', type: 'host', x: 0, y: 0 }],
			['node', { id: B, name: 'b', type: 'host', x: 240, y: 0 }],
		], { tab: { model: h.model, changes: h.history, selection: h.selection } });
		try {
			bindGestureDefer(h.input, w.sync);
			w.changes.commit(move(A, 240, 0));                 // onto b: the server will refuse it
			w.serve();
			const onA = (x) => pointer(x, 0, { button: 2,
				target: { tagName: 'g', classList: { contains: () => false }, dataset: {}, closest: (s) => (s.includes('node') ? { id: A } : null) } });
			h.capture.onDown(onA(240));
			h.capture.onMove(onA(420));                          // a real move gesture, from where the tab shows a
			assert.equal(h.input.isGesturing(), true, 'a drag is live -- the case under test');
			w.deliverTo('error');                              // the refusal: the tab asks for a snapshot
			w.serve();
			w.deliverTo('snapshot');                           // asked for, so it loads at once
			assert.equal(h.input.isGesturing(), false, 'the drag ended');
			assert.equal(w.tab.get('node', A).x, 0, 'the tab shows where the server has a, not where the drag began');
			assert.deepEqual(w.diff(), [], CONVERGED);
		} finally { w.close(); }
	} finally { h.restore(); }
});

/*
P5 V-d (H18.28; PL-6, G4) -- ONE PREVIEW, against the real server. The tab sends intent and previews it with the planner
composed as the page composes it, so the server's cascade shows before the answer, and the answer, reconciled against what
the tab applied, changes nothing. A snapshot after a lost connection re-plans what is still the tab's own on the new board.
*/
const previewing = async () => {
	const { plan } = await import('../planner/txn.mjs');
	const { createNetwork } = await import('../network/network.mjs');
	const { createTransit } = await import('../network/transit.mjs');
	const tenant = createNetwork(createTransit()).links;
	const model = new Model({ kinds: PAGE_KINDS, network: aNetwork() });
	return { model, changes: new Changes(model, { coalesceMs: 3_600_000, preview: (m, ops) => plan(m, ops, { links: tenant, kinds: PAGE_KINDS }) }) };
};
const PINNED = [
	['node', { id: 'node-f10001', name: 'a', type: 'host', shape: 'square', x: -360, y: 0 }],
	['node', { id: 'node-f10002', name: 'b', type: 'host', shape: 'square', x: 360, y: 0 }],
	['node', { id: 'node-f10003', name: 'w', x: 0, y: -120 }],
	['link', { id: 'link-f10004', name: 'l', src: 'node-f10001', dst: 'node-f10002', via: ['node-f10003'] }],
];

test('V-d: a pin deleted on the tab takes its link before the server answers, and the answer changes nothing (G4)', async () => {
	const w = await world(PINNED, { tab: await previewing() });
	try {
		w.changes.commit(deleteSelection(w.tab, new Set(['node-f10003'])));
		assert.deepEqual(w.up.map((m) => m.body.ops), [[{ op: 'del', kind: 'node', id: 'node-f10003' }]], 'the tab sent the delete it was asked for');
		assert.equal(w.tab.get('link', 'link-f10004'), undefined, 'and shows the link gone at once: a pinned link dies with its pin (P-7)');
		w.serve();
		const before = JSON.stringify(w.tab.toJSON().links);
		w.deliverTo('ack');
		assert.equal(JSON.stringify(w.tab.toJSON().links), before, 'the answer, reconciled against what the tab applied, changes nothing');
		assert.deepEqual(w.diff(), [], 'and the tab and the server agree');
	} finally { w.close(); }
});

test('V-d: a snapshot after a lost connection re-plans what is still the tab\'s own on the new board', async () => {
	const w = await world(PINNED, { tab: await previewing() });
	try {
		w.changes.commit(deleteSelection(w.tab, new Set(['node-f10003'])));
		w.reconnect();                              // the delete is lost in flight
		// meanwhile another writer pins a SECOND link at the waypoint: a board the tab's preview never saw
		w.other([{ op: 'put', kind: 'node', entity: { id: 'node-f10005', name: 'c', type: 'host', shape: 'square', x: 0, y: 240 } },
			{ op: 'put', kind: 'link', entity: { id: 'link-f10006', name: 'm', src: 'node-f10001', dst: 'node-f10005', via: ['node-f10003'] } }]);
		w.serve();                                  // the tab's resume, and nothing else: the delete was lost
		w.deliverAll();                             // a snapshot holding the second link
		assert.ok(w.up.some((m) => m.cmd === 'commit'), 'the delete is resent after the snapshot, not yet answered');
		assert.equal(w.tab.get('link', 'link-f10004'), undefined, 're-planned on the snapshot: the first link is gone again, not back');
		assert.equal(w.tab.get('link', 'link-f10006'), undefined, 'and so is the second, which only a re-plan on the new board knows of');
		w.pump();
		assert.deepEqual(w.diff(), [], 'and once the resend is answered, the tab and the server agree');
		assert.equal(w.server().get('link', 'link-f10004'), undefined);
	} finally { w.close(); }
});

test('V-d: the answer to an edit the tab previewed writes nothing to the tab -- it is reconciled against what was applied', async () => {
	// three links at a waypoint; deleting the third leaves two that join -- the join is a `set` on the survivor, which a
	// reconcile against what was SENT (the delete alone) would write again, and the page would draw again
	const w = await world([
		['node', { id: 'node-f20001', name: 'a', type: 'host', shape: 'square', x: -360, y: 0 }],
		['node', { id: 'node-f20002', name: 'b', type: 'host', shape: 'square', x: 360, y: 0 }],
		['node', { id: 'node-f20003', name: 'c', type: 'host', shape: 'square', x: 0, y: 240 }],
		['node', { id: 'node-f20004', name: 'w', x: 0, y: 0 }],
		['link', { id: 'link-f20005', name: 'l1', src: 'node-f20001', dst: 'node-f20004' }],
		['link', { id: 'link-f20006', name: 'l2', src: 'node-f20004', dst: 'node-f20002' }],
		['link', { id: 'link-f20007', name: 'l3', src: 'node-f20003', dst: 'node-f20004' }],
	], { tab: await previewing() });
	try {
		w.changes.commit({ label: 'delete', entries: [{ op: 'del', kind: 'link', entity: { ...w.tab.get('link', 'link-f20007') } }] });
		assert.equal(w.tab.all('link').length, 1, 'the preview joined the two left at the waypoint');
		w.serve();
		const writes = [];
		w.tab.onChange((action, kind, entity) => writes.push(`${action}/${kind}/${entity?.id}`));
		w.deliverTo('ack');
		assert.deepEqual(writes, [], 'the answer is the preview, so applying it writes nothing');
		assert.deepEqual(w.diff(), []);
	} finally { w.close(); }
});

test('V-d: another writer\'s change does not bring back what the tab\'s own unanswered edit removed', async () => {
	const w = await world(PINNED, { tab: await previewing() });
	try {
		w.changes.commit(deleteSelection(w.tab, new Set(['node-f10003'])));   // the link goes with its pin, in the preview
		// before the delete reaches the server, another writer PUTS the link it took -- whole, so applied bare it would bring it back
		w.other([{ op: 'put', kind: 'link', entity: { id: 'link-f10004', name: 'renamed', src: 'node-f10001', dst: 'node-f10002', via: ['node-f10003'] } }]);
		w.deliverAll();
		assert.equal(w.tab.get('link', 'link-f10004'), undefined, 'the tab\'s own consequence stays on top of the change');
		w.pump();
		assert.deepEqual(w.diff(), []);
	} finally { w.close(); }
});

/*
B304 (H19.15; ruled 2026-10-07, "re-fetch") -- A PREVIEW THE SERVER DID NOT CONFIRM IS CORRECTED by fetching the document again.
The tab previews an edit's consequences on its own board; another writer's edit reached the server first, so the server plans
the request on a different board and answers otherwise. Found by the sync fuzz (seed 7): one tab deletes a waypoint, its preview
taking both links ending there; the other writer re-plugs one of them away first; the server deletes only the other, and the
tab kept the re-plugged link deleted for good. Now the answer's mismatch with what the tab applied asks for the document again.
*/
const STAR = [
	['node', { id: 'node-f20001', name: 'a', type: 'host', shape: 'square', x: -360, y: 0 }],
	['node', { id: 'node-f20002', name: 'b', type: 'host', shape: 'square', x: 360, y: 0 }],
	['node', { id: 'node-f20003', name: 'c', type: 'host', shape: 'square', x: 0, y: 240 }],
	['node', { id: 'node-f20004', name: 'w', x: 0, y: -120 }],
	['link', { id: 'link-f20005', name: 'l1', src: 'node-f20001', dst: 'node-f20004' }],
	['link', { id: 'link-f20006', name: 'l2', src: 'node-f20004', dst: 'node-f20002' }],
];

test('B304: a preview the server answered otherwise -- another writer re-plugged a link away first -- is corrected', async () => {
	const w = await world(STAR, { tab: await previewing() });
	try {
		w.changes.commit(deleteSelection(w.tab, new Set(['node-f20004'])));
		assert.equal(w.tab.get('link', 'link-f20006'), undefined, 'the preview takes both links ending at w');
		w.other([{ op: 'set', kind: 'link', id: 'link-f20006', patch: { src: 'node-f20003' } }]);   // the other writer, first
		w.pump();
		assert.ok(w.server().get('link', 'link-f20006'), 'the server kept l2, re-plugged to c -- the case under test');
		assert.deepEqual(w.diff(), [], CONVERGED);
	} finally { w.close(); }
});

test('B304: a preview the server confirms asks for nothing more -- no extra fetch in ordinary use', async () => {
	const w = await world(STAR, { tab: await previewing() });
	try {
		w.changes.commit(deleteSelection(w.tab, new Set(['node-f20004'])));
		w.pump();
		assert.equal(w.up.length + w.down.length, 0, 'settled');
		assert.deepEqual(w.diff(), [], CONVERGED);
		assert.equal(w.sent.filter((m) => m.cmd === 'open').length, 0, 'and no open was sent for it');
	} finally { w.close(); }
});

/*
B295 (H19.15) -- A REQUEST THE SERVER HAS ANSWERED IS NOT SENT AGAIN AT A SNAPSHOT, nor counted toward the replay limit. It
waits in the outbox only until an ack says it is durable (B148); the snapshot holds it -- one that does not, a restarted
server's loss, is made the tab's own again first (D29). Every snapshot re-sent it: an answered undo was refused a second time,
an answered commit drew a `replayed` answer, and each re-send counted toward MAX_REPLAYS, so the re-fetches B304 adds would
have given up more changes (measured by the sync fuzz: give-ups doubled until this).
*/
test('B295: after a resync an undo already answered is not sent again -- one refusal, not two', async () => {
	const w = await world(LONE);
	try {
		w.changes.commit(move(A, 240, 0));
		w.pump();
		const refused = [];
		w.sync.onRefused = (b) => refused.push(b.code);
		w.changes.undo();
		w.changes.undo();
		w.serve();
		w.other(set('node', X, { name: 'moved-on' }));
		w.pump();
		assert.deepEqual(refused, ['version-conflict'], 'the second undo refused once');
		assert.equal(w.sent.filter((m) => m.cmd === 'undo').length, 2, 'and each undo sent once');
		assert.deepEqual(w.diff(), [], CONVERGED);
	} finally { w.close(); }
});

test('B295: an answered commit waiting to be durable is neither re-sent at a snapshot nor counted toward the replay limit', async () => {
	const w = await world(LONE);
	try {
		w.changes.commit(move(A, 240, 0));
		w.pump();
		const entry = w.sync.outbox.find((m) => m.answered);
		assert.ok(entry, 'answered, not yet known durable -- the case under test');
		for (let i = 0; i < 3; i++) { w.sync.requestResync(); w.pump(); }
		assert.equal(w.sent.filter((m) => m.cmd === 'commit').length, 1, 'sent once');
		assert.equal(entry.tries ?? 0, 0, 'and no snapshot counted it');
		assert.deepEqual(w.diff(), [], CONVERGED);
	} finally { w.close(); }
});

test('B304: a no-op answer to a request whose preview did something -- another writer had done it first, its own way -- is corrected', async () => {
	const w = await world(STAR, { tab: await previewing() });
	try {
		w.changes.commit(deleteSelection(w.tab, new Set(['node-f20004'])));   // the tab previews the delete of w and both links
		w.other([{ op: 'del', kind: 'link', id: 'link-f20005' }, { op: 'del', kind: 'link', id: 'link-f20006' }, { op: 'del', kind: 'node', id: 'node-f20004' }]);
		w.other([{ op: 'put', kind: 'link', entity: { id: 'link-f20006', name: 'again', src: 'node-f20001', dst: 'node-f20002' } }]);
		w.serve();
		assert.equal(w.down.find((m) => m.cmd === 'ack')?.body.noop, true, 'the server held it already -- answered no-op');
		w.pump();
		assert.deepEqual(w.diff(), [], CONVERGED);
	} finally { w.close(); }
});

test('B295: after a reload, a request answered before it is not sent again -- it came back from disk answered, not sent', async () => {
	const w = await world(LONE);
	try {
		w.changes.commit(move(A, 240, 0));
		w.pump();
		assert.ok(w.sync.outbox.some((m) => m.answered), 'answered, waiting to be durable -- the case under test');
		w.reload();
		w.pump();
		assert.equal(w.sent.filter((m) => m.cmd === 'commit').length, 1, 'sent once, before the reload');
		assert.deepEqual(w.diff(), [], CONVERGED);
	} finally { w.close(); }
});
