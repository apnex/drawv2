/*
B183 -- the feedback loop the incident actually ran on.

FOUND BY INSTRUMENT, not by reasoning. `draw sessions --events` showed a session opening, hydrating
a diagram, and then committing `delete` / `create node` / `delete` repeatedly 1.1 seconds later --
before any human could have acted. That is not a gesture. It is the outbox replaying.

THE CYCLE. Every snapshot calls `replayOutbox`, which marks the whole outbox unsent and re-sends it.
Each re-send bumps the document version. The change that comes back is ahead of what this tab has
applied, so `applyChange` asks for a resync. The resync delivers a snapshot. The snapshot replays
the outbox. While `durableVersion` was frozen by a write conflict nothing could prune, so the cycle
sustained itself at roughly 130 attempts per second.

WHY IT WAS INVISIBLE FOR A NIGHT. The labels seen were `spawn` / `stop spawning`, which pointed at
the one rule that reads current state -- so I looked at the toggle, repeatedly, and it was innocent.
The toggle was simply what happened to be in the outbox. The opening events were being overwritten
by the flood before any poll could reach them, which is what B182 fixed.

THE RULING ALREADY EXISTED. B148: "durability applied to a command that cannot succeed is a trap".
It was enforced only where the server EXPLICITLY refused. A command replayed forever and never
confirmed durable is the same trap, and it is the one that bit.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Model } from '../model/index.mjs';
import { Selection } from '../app/src/selection.js';
import { Sync } from '../app/src/sync.js';

const src = fs.readFileSync(new URL('../app/src/sync.js', import.meta.url), 'utf8');
const MAX_REPLAYS = Number(src.match(/const MAX_REPLAYS = (\d+);/)[1]);

globalThis.localStorage = globalThis.localStorage || {
	store: new Map(),
	getItem(k) { return this.store.has(k) ? this.store.get(k) : null; },
	setItem(k, v) { this.store.set(k, String(v)); },
	removeItem(k) { this.store.delete(k); },
};

function harness() {
	const sent = [];
	const net = { subscribe() {}, onStatus() {}, isOpen: () => true, send: (cmd, body) => sent.push({ cmd, body }) };
	const model = new Model();
	const selection = new Selection(model);
	const history = { clear() {}, setCounts() {}, state: { version: 0 } };
	const sync = new Sync({ model, net, history, selection });
	sync.hydrated = true;
	return { sent, sync, model };
}

test('B183: a queued change is not replayed forever', () => {
	/*
	The bound, stated as the property that ends the loop. Without it a snapshot always re-sends,
	and a re-send always earns another snapshot.
	*/
	const { sync, sent } = harness();
	sync.outbox.push({ ops: [{ op: 'del', kind: 'node', id: 'node-aa0001' }], label: 'delete', txnId: 't1' });

	for (let i = 0; i < MAX_REPLAYS + 3; i++) sync.replayOutbox({ reapply: false });

	assert.equal(sync.outbox.length, 0, 'an undeliverable change must eventually be abandoned');
	const commits = sent.filter((m) => m.cmd === 'commit').length;
	assert.ok(commits <= MAX_REPLAYS, `sent ${commits} times against a bound of ${MAX_REPLAYS}`);
});

test('B183: giving up is said out loud, never silent', () => {
	// discarding a user's change quietly is the I15 failure this whole arc keeps meeting
	const { sync } = harness();
	sync.outbox.push({ ops: [{ op: 'del', kind: 'node', id: 'node-aa0001' }], label: 'delete', txnId: 't1' });
	for (let i = 0; i < MAX_REPLAYS + 1; i++) sync.replayOutbox({ reapply: false });
	assert.ok(sync.said, 'nothing was said');
	assert.match(String(sync.said.text), /discarded/, `said: ${JSON.stringify(sync.said)}`);
	assert.equal(sync.said.err, true, 'losing a change is not good news and must not read as routine');
});

test('B183: an ordinary reconnect still replays -- the bound must not break recovery', () => {
	/*
	The reason the bound is five rather than one. A tab that drops and reconnects legitimately
	replays its unsent work, and a bound that forbade that would trade a loop for lost edits.
	*/
	const { sync, sent } = harness();
	sync.outbox.push({ ops: [{ op: 'del', kind: 'node', id: 'node-aa0001' }], label: 'delete', txnId: 't1' });
	sync.replayOutbox({ reapply: false });
	assert.equal(sync.outbox.length, 1, 'one reconnect must not discard anything');
	assert.equal(sent.filter((m) => m.cmd === 'commit').length, 1, 'and it must actually be re-sent');
});

test('B183: a change that lands is pruned before it can exhaust its attempts', () => {
	// the healthy path: acknowledged and durable, gone from the outbox, never replayed again
	const { sync } = harness();
	sync.outbox.push({ ops: [{ op: 'del', kind: 'node', id: 'node-aa0001' }], label: 'delete', txnId: 't1', sent: true, version: 7 });
	sync.pruneOutbox(9);
	assert.equal(sync.outbox.length, 0, 'a durable change must leave the outbox');
});

test('B183: the count survives persistence, so a reload cannot reset the bound', () => {
	/*
	The subtle half. The outbox is durable across a reload, so if the attempt count did not persist
	with it, a tab that reloads would reset to zero attempts -- and a reload loop would replay
	forever with a bound that never bites.
	*/
	assert.match(src, /tries/, 'attempts are not tracked at all');
	/*
	Anchored on the METHOD, not the first call site. The first version of this sliced from
	`src.indexOf('persistOutbox()')`, which lands on a CALL -- so it asserted against `this.drain()`
	and reported the feature missing when it was present. Wrong-subject, which is the failure this
	project keeps producing and which its own notes count at eleven occurrences.
	*/
	const persist = src.slice(src.indexOf('\tpersistOutbox() {'));
	const body = persist.slice(0, persist.indexOf('\n\t}'));
	assert.ok(body.length > 40, 'the persistOutbox method was not found -- re-point this assertion');
	/*
	Asserted on the DESTRUCTURING, not on the word appearing somewhere in the method. Dropping
	`tries` from what is written to storage left the earlier version of this test green, because
	`restoreOutbox` still mentioned the word further down the file -- a mutation that survived is
	how that was found.
	*/
	assert.match(body, /\{ ops, label, txnId, tries \}/,
		'the persisted shape omits tries, so a reload resets the bound');
	assert.match(body, /tries: tries \|\| 0/, 'tries is not written with a default, so undefined persists');

	const restore = src.slice(src.indexOf('\trestoreOutbox('));
	const rbody = restore.slice(0, restore.indexOf('\n\t}'));
	assert.match(rbody, /tries/, 'the attempt count is not restored, so a reload resets the bound');
});
