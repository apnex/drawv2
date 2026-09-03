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

/*
B184 -- the construction that closes the loop, rather than bounding it.

MAX_REPLAYS is a circuit breaker: it stops the fire and still loses the work. What was missing is
the ability for either side to answer "did this already land?" -- the client renamed a commit on
every attempt and the server remembered nothing, so a replay was indistinguishable from new work.

Stable identity plus server memory makes the PROTOCOL idempotent, not merely the ops. The second
attempt terminates on an acknowledgement instead of becoming a second transaction, so the cycle
cannot form and the bound becomes a backstop.
*/

test('B184: a commit keeps its identity across a restore', () => {
	/*
	The client half. `restoreOutbox` used to renumber everything it restored, so the same intent
	arrived under a new name every time -- which is precisely why the server could not recognise it.
	*/
	const { sync } = harness();
	localStorage.setItem('draw.outbox', JSON.stringify({
		diagram: 'diagram-aa0001',
		msgs: [{ ops: [{ op: 'del', kind: 'node', id: 'node-aa0001' }], label: 'delete', txnId: 'abc123-7', tries: 2 }],
	}));
	sync.restoreOutbox('diagram-aa0001');
	assert.equal(sync.outbox.length, 1);
	assert.equal(sync.outbox[0].txnId, 'abc123-7', 'the id must survive the restore unchanged');
	assert.equal(sync.outbox[0].tries, 2, 'and so must the attempt count');
});

test('B184: two different changes never share an id', () => {
	// a counter alone restarts at zero on reload, so two sessions of one tab would collide
	const { sync } = harness();
	sync.submit({ ops: [{ op: 'del', kind: 'node', id: 'node-aa0001' }], label: 'a' });
	sync.submit({ ops: [{ op: 'del', kind: 'node', id: 'node-aa0002' }], label: 'b' });
	const ids = sync.outbox.map((m) => m.txnId);
	assert.equal(new Set(ids).size, ids.length, `ids collided: ${ids}`);
	const other = harness().sync;
	other.submit({ ops: [{ op: 'del', kind: 'node', id: 'node-aa0003' }], label: 'c' });
	assert.notEqual(other.outbox[0].txnId, ids[0], 'two sessions minted the same id');
});

test('B184: a legacy record without an id is adopted, never dropped', () => {
	/*
	Caught by an existing D30 assertion, and the catch was right. A record written before stable ids
	is well-formed pending work; discarding it would trade a loop for lost changes, which is the
	worse defect.
	*/
	const { sync } = harness();
	localStorage.setItem('draw.outbox', JSON.stringify({
		diagram: 'diagram-aa0001',
		msgs: [{ ops: [{ op: 'del', kind: 'node', id: 'node-aa0001' }], label: 'delete' }],
	}));
	sync.restoreOutbox('diagram-aa0001');
	assert.equal(sync.outbox.length, 1, 'a legacy record must still replay');
	assert.ok(sync.outbox[0].txnId, 'and must be given an identity for every attempt after this one');
});

test('B184: being told a commit was a replay retires it', () => {
	/*
	Recognising a replay server-side only helps if the client acts on being told. Without this the
	entry stays, replays on the next snapshot, is recognised again, and stays again -- the loop
	surviving the fix that was supposed to end it.
	*/
	const { sync } = harness();
	sync.outbox.push({ ops: [{ op: 'del', kind: 'node', id: 'node-aa0001' }], label: 'delete', txnId: 'x-1', sent: true });
	sync.onMessage({ cmd: 'ack', body: { acked: 'x-1', replayed: true, version: 12, durableVersion: 12 } });
	assert.equal(sync.outbox.length, 0, 'a replayed commit must leave the outbox on its acknowledgement');
});

test('B184: the server applies a repeated commit ONCE and answers with the original version', async () => {
	/*
	The server half, against the real store. This is the property that makes the protocol idempotent:
	the ops were always idempotent, so the DOCUMENT converged -- but every replay was still a new
	transaction, a new version and a new broadcast, which is what gave a peer a reason to resync and
	closed the loop.
	*/
	const os = await import('node:os');
	const path = await import('node:path');
	const { Store } = await import('../server/store.js');
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-b184-'));
	try {
		const store = new Store(dir, { flushMs: 5, authz: false });
		await store.init();
		/*
		The id comes from the created MODEL. `create` answers `{ ok, model }` and carries no `id`, so
		an earlier draft fell back to the first key in the map -- a different, seeded diagram -- and
		asserted replay behaviour against a document it had never committed to. Wrong-subject again.
		*/
		const created = store.create({ name: 'idem' }, null);
		assert.equal(created.ok, true, 'the fixture diagram was not created');
		const id = created.model.state.meta.id;
		const node = { id: 'node-bb0001', name: 'n', type: 'host', shape: 'circle', x: 60, y: 60 };
		const req = { ops: [{ op: 'put', kind: 'node', entity: node }], label: 'create node', txnId: 'stable-1' };

		const first = store.commit(id, req, 'client', 's-a', null);
		assert.equal(first.ok, true, `first commit refused: ${first.error}`);
		const v1 = store.diagrams.get(id).model.state.meta.version;

		const second = store.commit(id, req, 'client', 's-a', null);
		assert.equal(second.ok, true, 'a replay must be accepted, not refused');
		assert.equal(second.replayed, true, 'and must be recognised AS a replay');
		assert.equal(second.change, null, 'a replay must produce no new change to broadcast');
		assert.equal(store.diagrams.get(id).model.state.meta.version, v1,
			'the version moved, so the replay became a second transaction -- the loop is still possible');
		// `first.version` is the log's version after the commit. `change` carries `seq` and `from`
		// and no `version` at all -- an assumption that cost two rounds here and one in the store.
		assert.equal(second.version, first.version,
			'the replay must answer with the version it originally produced');

		/*
		The control: genuinely new work must still land. Placed at a DIFFERENT anchor, because the
		first draft put a second node on the same coordinates and the occupancy rule refused it --
		so the control proved nothing and reported it as a failure of the replay logic.
		*/
		const other = store.commit(id, { ops: [{ op: 'put', kind: 'node',
			entity: { ...node, id: 'node-bb0002', x: 180, y: 180 } }], label: 'create node', txnId: 'stable-2' }, 'client', 's-a', null);
		assert.equal(other.ok, true, `new work refused: ${other.error}`);
		assert.ok(store.diagrams.get(id).model.state.meta.version > v1, 'new work must still advance the version');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
