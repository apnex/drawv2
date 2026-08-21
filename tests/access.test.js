/*
H9.1 -- the principal and grant model.

The substrate only, not enforcement. Nothing here asserts that a read-only principal is refused a
write, because nothing refuses it yet: that is H9.3, and claiming it now would be the more
dangerous kind of green test. What is asserted is that the model can express the decision, that
the decision survives a restart, and that it can never be made through the document.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../server/store.js';
import { validateDoc, validateMetaPatch } from '../server/validate.js';
import { createApp } from '../server/app.js';
import { Session } from '../server/protocol.js';
import { Locks } from '../server/locks.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'draw-acl-'));
const OWNER = 'user:owner@apnex.com.au';
const GUEST = 'user:guest@example.com';
const CODE = 'code:k7f3q2';

async function owned() {
	const dir = tmp();
	const s = new Store(dir, { flushMs: 3_600_000 });
	await s.init();
	const id = s.list()[0].id;
	assert.equal(s.setOwner(id, OWNER), null);
	return { s, dir, id };
}

test('H9.1: an unowned diagram grants nobody anything', async () => {
	const dir = tmp();
	try {
		const s = new Store(dir, { flushMs: 3_600_000 });
		await s.init();
		const id = s.list()[0].id;
		assert.equal(s.access(id, OWNER), null, 'every diagram predating H9 is unowned');
		assert.equal(s.access(id, ''), null, 'and an empty principal is not a principal');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('H9.1: the owner has owner access; a grant gives exactly its level', async () => {
	const { s, dir, id } = await owned();
	try {
		assert.equal(s.access(id, OWNER), 'owner');
		assert.equal(s.access(id, GUEST), null, 'a stranger holds nothing by default');

		assert.equal(s.grant(id, GUEST, 'read', OWNER), null);
		assert.equal(s.access(id, GUEST), 'read');

		assert.equal(s.grant(id, CODE, 'write', OWNER), null);
		assert.equal(s.access(id, CODE), 'write', 'a connection code is a principal like any other');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('H9.1: only the owner may grant or revoke', async () => {
	const { s, dir, id } = await owned();
	try {
		assert.equal(s.grant(id, GUEST, 'read', OWNER), null);
		// a write grant is permission over the DIAGRAM, never over who else may reach it
		assert.equal(s.grant(id, CODE, 'write', OWNER), null);
		assert.match(s.grant(id, 'user:x@y.co', 'write', CODE), /only the owner may grant/,
			'a write grantee must not be able to re-share');
		assert.match(s.revoke(id, GUEST, CODE), /only the owner may revoke/);
		assert.match(s.grant(id, 'user:x@y.co', 'read', GUEST), /only the owner may grant/);
		assert.equal(s.access(id, 'user:x@y.co'), null, 'and none of those attempts took effect');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('H9.1: revoke removes access, and revoking twice is not an error', async () => {
	const { s, dir, id } = await owned();
	try {
		s.grant(id, GUEST, 'write', OWNER);
		assert.equal(s.access(id, GUEST), 'write');
		assert.equal(s.revoke(id, GUEST, OWNER), null);
		assert.equal(s.access(id, GUEST), null);
		assert.equal(s.revoke(id, GUEST, OWNER), null, 'idempotent: a retry must not become a failure');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('H9.1: ownership cannot be taken by asking', async () => {
	const { s, dir, id } = await owned();
	try {
		assert.match(s.setOwner(id, GUEST), /already owned/);
		assert.equal(s.access(id, OWNER), 'owner', 'the original owner is unchanged');
		assert.equal(s.access(id, GUEST), null);
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

/*
The property that makes the whole design safe: a grant is not a document change.

If it were, it would live in the log, and undo would restore access for a principal the owner had
just revoked. This asserts the mechanism rather than the intent -- the log must not grow, and the
version must not move.
*/
test('H9.1: granting is NOT a commit, so it leaves no undo record', async () => {
	const { s, dir, id } = await owned();
	try {
		const before = s.log(id).version;
		const depth = s.log(id).records.length;
		s.grant(id, GUEST, 'write', OWNER);
		s.revoke(id, GUEST, OWNER);
		assert.equal(s.log(id).version, before, 'no version bump');
		assert.equal(s.log(id).records.length, depth, 'and nothing appended to the log');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('H9.1: owner and grants survive a restart', async () => {
	const { s, dir, id } = await owned();
	try {
		s.grant(id, GUEST, 'read', OWNER);
		await s.flushAll();

		const again = new Store(dir, { flushMs: 3_600_000 });
		await again.init();
		assert.equal(again.access(id, OWNER), 'owner', 'ownership is durable');
		assert.equal(again.access(id, GUEST), 'read', 'and so is a grant');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('H9.1: a revoked grant does not come back after a restart', async () => {
	const { s, dir, id } = await owned();
	try {
		s.grant(id, GUEST, 'write', OWNER);
		await s.flushAll();
		s.revoke(id, GUEST, OWNER);
		await s.flushAll();

		const again = new Store(dir, { flushMs: 3_600_000 });
		await again.init();
		assert.equal(again.access(id, GUEST), null,
			'a revocation that a reload undoes is not a revocation');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('H9.1: a client cannot grant itself access through a meta patch', () => {
	assert.match(validateMetaPatch({ owner: OWNER }), /not writable/,
		'owner is server-recorded status, never the client\u2019s to send');
	assert.match(validateMetaPatch({ grants: { [GUEST]: 'write' } }), /not writable/);
	assert.equal(validateMetaPatch({ name: 'still fine' }), null, 'the writable surface is unchanged');
});

test('H9.1: the document validator refuses a malformed principal or level', () => {
	const doc = (meta) => ({
		meta: { id: 'diagram-aa0001', name: 't', version: 0, schema: 1, ...meta },
		nodes: [], waypoints: [], links: [], zones: [], groups: [],
	});
	assert.equal(validateDoc(doc({})), null, 'legacy documents carry neither key and still load');
	assert.equal(validateDoc(doc({ owner: OWNER, grants: { [CODE]: 'read' } })), null);
	assert.match(validateDoc(doc({ grants: { 'owner@apnex.com.au': 'read' } })), /invalid grant principal/,
		'an unprefixed principal is refused, not guessed at — guessing is how a code becomes a user');
	assert.match(validateDoc(doc({ grants: { [GUEST]: 'admin' } })), /invalid grant level/);
	assert.match(validateDoc(doc({ owner: 'nope' })), /invalid meta.owner/);
});

/*
The privilege escalation that adding these fields nearly opened.

`install()` serves two callers: `init()` loading our own storage, and `create()` taking a document
off the wire. Adding `owner` and `grants` to the validator makes them legal keys, so without a
trust boundary `create {doc:{meta:{owner:...}}}` would install the caller as owner of the diagram
it just created. Nothing else in the path would have refused it, because the document is valid.
*/
test('H9.1: a created diagram cannot carry its own ownership in from the wire', async () => {
	const dir = tmp();
	try {
		const s = new Store(dir, { flushMs: 3_600_000 });
		await s.init();
		const res = s.create('hostile', {
			meta: { owner: 'user:attacker@evil.example', grants: { 'user:attacker@evil.example': 'write' } },
			nodes: [], waypoints: [], links: [], zones: [], groups: [],
		});
		assert.ok(res.ok, 'the document is otherwise valid, so it is accepted');
		const id = res.model.state.meta.id;
		assert.equal(s.access(id, 'user:attacker@evil.example'), null,
			'but the ownership it claimed was discarded — authorization is never carried by a document');
		assert.equal(res.model.state.meta.owner, '', 'the diagram is unowned, awaiting setOwner');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

/*
H9.2b -- listing is filtered by grant, and only when authorization is on.
*/
const OTHER = 'user:other@example.com';

test('H9.2b: with authz off, list() is unchanged and ignores the principal', async () => {
	const dir = tmp();
	try {
		const s = new Store(dir, { flushMs: 3_600_000 });
		await s.init();
		assert.equal(s.list().length, 1, 'single-tenant behaviour survives untouched');
		assert.equal(s.list(GUEST).length, 1, 'a principal changes nothing while authz is off');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('H9.2b: with authz on, a principal sees only what it holds', async () => {
	const dir = tmp();
	try {
		const s = new Store(dir, { flushMs: 3_600_000, authz: true });
		await s.init();
		const mine = s.list(null);
		assert.equal(mine.length, 0, 'an unowned diagram belongs to nobody and is listed to nobody');

		const id = [...s.diagrams.keys()][0];
		s.setOwner(id, OWNER);
		assert.equal(s.list(OWNER).length, 1, 'the owner sees it');
		assert.equal(s.list(GUEST).length, 0, 'a stranger does not');
		assert.equal(s.list(null).length, 0, 'and neither does an unauthenticated caller');

		s.grant(id, GUEST, 'read', OWNER);
		assert.equal(s.list(GUEST).length, 1, 'a read grant is enough to see that it exists');

		s.revoke(id, GUEST, OWNER);
		assert.equal(s.list(GUEST).length, 0, 'and revoking removes it from view');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

/*
Listing leaks less than reading, and more than nothing.

A missed filter here does not hand over a document's contents, but it does disclose that a diagram
exists and what its owner chose to call it. That is why the filter lives in one place.
*/
test('H9.2b: one principal cannot see another principal\u2019s diagram in the listing', async () => {
	const dir = tmp();
	try {
		const s = new Store(dir, { flushMs: 3_600_000, authz: true });
		await s.init();
		const a = [...s.diagrams.keys()][0];
		s.setOwner(a, OWNER);
		const b = s.create('theirs').model.state.meta.id;
		s.setOwner(b, OTHER);

		assert.deepEqual(s.list(OWNER).map((d) => d.id), [a]);
		assert.deepEqual(s.list(OTHER).map((d) => d.id), [b], 'names do not leak across owners either');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('H9.2b: adopt claims only the unowned, and is idempotent', async () => {
	const dir = tmp();
	try {
		const s = new Store(dir, { flushMs: 3_600_000, authz: true });
		await s.init();
		const keep = s.create('already theirs').model.state.meta.id;
		s.setOwner(keep, OTHER);

		assert.equal(s.adopt(OWNER), 1, 'exactly the one unowned diagram was claimed');
		assert.equal(s.access(keep, OTHER), 'owner', 'an owned diagram is never taken');
		assert.equal(s.adopt(OWNER), 0, 'running it again claims nothing');
		assert.equal(s.list(OWNER).length, 1);
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('H9.2b: createApp turns authorization on and adopts, so the operator is not locked out', async () => {
	const dataDir = path.join(os.tmpdir(), `draw-authz-${Math.random().toString(36).slice(2)}`);
	const app = await createApp({ dataDir, secretsDir: dataDir, port: 0, authz: true, owner: OWNER });
	try {
		assert.ok(app.store.list(OWNER).length > 0, 'the seeded diagram was adopted at boot');
		assert.equal(app.store.list(GUEST).length, 0, 'and nobody else sees it');
	} finally {
		await app.close();
		fs.rmSync(dataDir, { recursive: true, force: true });
	}
});

/*
H9.2c -- the principal reaches the handlers.

`principalOf` is injected rather than signing a real assertion, because what is under test here is
the plumbing, not the verifier: H9.2a already proved the verifier refuses everything it should.
Injecting keeps this test about whether the identity actually arrives at REST and the websocket.
*/
test('H9.2c: REST GET /diagrams returns only what the caller holds', async () => {
	const dataDir = path.join(os.tmpdir(), `draw-rest-authz-${Math.random().toString(36).slice(2)}`);
	let who = OWNER;
	const app = await createApp({
		dataDir, secretsDir: dataDir, port: 0,
		authz: true, owner: OWNER, principalOf: async () => who,
	});
	try {
		const url = `http://127.0.0.1:${app.port}/api/v1/diagrams`;

		const mine = await (await fetch(url)).json();
		assert.equal(mine.length, 1, 'the owner sees the adopted diagram');

		who = GUEST;
		const theirs = await (await fetch(url)).json();
		assert.deepEqual(theirs, [], 'a different principal sees nothing at all');

		who = null;
		const nobody = await (await fetch(url)).json();
		assert.deepEqual(nobody, [], 'and an unidentified caller sees nothing');
	} finally {
		await app.close();
		fs.rmSync(dataDir, { recursive: true, force: true });
	}
});

test('H9.2c: /health reports the true total, deliberately unfiltered', async () => {
	const dataDir = path.join(os.tmpdir(), `draw-health-${Math.random().toString(36).slice(2)}`);
	const app = await createApp({
		dataDir, secretsDir: dataDir, port: 0,
		authz: true, owner: OWNER, principalOf: async () => GUEST,
	});
	try {
		const health = await (await fetch(`http://127.0.0.1:${app.port}/health`)).json();
		assert.equal(health.diagrams, 1,
			'health is an operational signal about the process, not a view of a principal\u2019s data');
	} finally {
		await app.close();
		fs.rmSync(dataDir, { recursive: true, force: true });
	}
});

test('H9.2c: with authz off the principal is ignored, so nothing changes', async () => {
	const dataDir = path.join(os.tmpdir(), `draw-off-${Math.random().toString(36).slice(2)}`);
	const app = await createApp({
		dataDir, secretsDir: dataDir, port: 0, principalOf: async () => null,
	});
	try {
		const list = await (await fetch(`http://127.0.0.1:${app.port}/api/v1/diagrams`)).json();
		assert.equal(list.length, 1, 'an unidentified caller still sees everything when authz is off');
	} finally {
		await app.close();
		fs.rmSync(dataDir, { recursive: true, force: true });
	}
});

/*
H9.3 -- every mutating path refuses a principal without write.

Listing was filtered in H9.2b, which hides a diagram but does not protect it: a principal who knows
an id could still open and change one it holds nothing on. These assert the gate itself, on each of
the seven methods that can alter a diagram, because a gate on six of seven is not a gate.
*/
// the same two shapes persist.test.js uses; local rather than shared, since a test helper
// imported across files is a dependency between tests that nothing declares
const node = (id, x = 0) => ({ id, name: id, type: 'host', shape: 'circle', x, y: 0 });
const put = (kind, entity) => ({ op: 'put', kind, entity });
const put1 = () => ({ label: 'x', ops: [put('node', node('node-ee0001', 60))] });

async function guarded() {
	const dir = tmp();
	const s = new Store(dir, { flushMs: 3_600_000, authz: true });
	await s.init();
	const id = [...s.diagrams.keys()][0];
	s.setOwner(id, OWNER);
	return { s, dir, id };
}

test('H9.3: a stranger cannot mutate by any route', async () => {
	const { s, dir, id } = await guarded();
	try {
		const before = s.log(id).version;
		assert.match(s.commit(id, put1(), 'client', 'a', GUEST).error, /forbidden/);
		assert.match(s.undo(id, null, GUEST).error, /forbidden/);
		assert.match(s.redo(id, GUEST).error, /forbidden/);
		assert.match(s.patchMeta(id, { name: 'stolen' }, GUEST), /forbidden/);
		assert.match(s.setSelection(id, [], GUEST), /forbidden/);
		assert.match(s.bindSlides(id, 'p', 'g', GUEST), /forbidden/);
		assert.match(await s.remove(id, GUEST), /forbidden/);

		assert.equal(s.log(id).version, before, 'and nothing moved');
		assert.equal(s.get(id).state.meta.name, 'example', 'the name is untouched');
		assert.ok(s.get(id), 'the diagram still exists');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('H9.3: a read grant reads but does not write', async () => {
	const { s, dir, id } = await guarded();
	try {
		s.grant(id, GUEST, 'read', OWNER);
		assert.equal(s.list(GUEST).length, 1, 'read means it is visible');
		assert.match(s.commit(id, put1(), 'client', 'a', GUEST).error, /forbidden/,
			'but read is not write, which is the whole point of two levels');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('H9.3: a write grant writes, and the owner always can', async () => {
	const { s, dir, id } = await guarded();
	try {
		s.grant(id, GUEST, 'write', OWNER);
		assert.ok(s.commit(id, put1(), 'client', 'a', GUEST).ok, 'a write grantee may write');
		assert.ok(s.commit(id, { label: 'y', ops: [put('node', node('node-ee0002', 100))] },
			'client', 'b', OWNER).ok, 'and so may the owner');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

/*
The refusal is 403-shaped, not 423-shaped.

A lock says someone else is driving and is worth retrying; this says you may not, ever, until a
grant changes. An agent that confuses them either spins forever or gives up permanently.
*/
test('H9.3: a refusal is marked forbidden, distinct from a lock', async () => {
	const { s, dir, id } = await guarded();
	try {
		const res = s.commit(id, put1(), 'client', 'a', GUEST);
		assert.equal(res.forbidden, true, 'callers can map this to 403 rather than 423');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('H9.3: a caller that forgets the principal is refused, not allowed', async () => {
	const { s, dir, id } = await guarded();
	try {
		assert.match(s.commit(id, put1()).error, /forbidden/,
			'fail-closed: an un-updated call site becomes a visible failure, never a silent hole');
		assert.match(await s.remove(id), /forbidden/);
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('H9.3: with authz off none of this applies, and the tool stays single-tenant', async () => {
	const dir = tmp();
	try {
		const s = new Store(dir, { flushMs: 3_600_000 });
		await s.init();
		const id = [...s.diagrams.keys()][0];
		assert.ok(s.commit(id, put1(), 'client', 'a').ok, 'no principal, no identity, no gate');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

/*
H9.3b -- the refusal reaches the wire as 403.

The store refused from H9.3a, but no handler passed it a principal, so with authorization on the
app would have refused its own owner. This asserts the whole chain: identity in, grant checked,
403 out -- and that the owner is not locked out of their own diagram.
*/
async function live(who) {
	const dataDir = path.join(os.tmpdir(), `draw-403-${Math.random().toString(36).slice(2)}`);
	const app = await createApp({
		dataDir, secretsDir: dataDir, port: 0,
		authz: true, owner: OWNER, principalOf: async () => who(),
	});
	return { app, dataDir, base: `http://127.0.0.1:${app.port}/api/v1` };
}
const body = { ops: [{ op: 'put', kind: 'node', entity: node('node-ff0009', 60) }], label: 'x' };

test('H9.3b: a stranger gets 403 on commit, and the owner still writes', async () => {
	let who = OWNER;
	const { app, dataDir, base } = await live(() => who);
	try {
		const id = (await (await fetch(`${base}/diagrams`)).json())[0].id;
		const tok = (await (await fetch(`${base}/diagrams/${id}/lock`, { method: 'POST' })).json()).token;
		const hdr = { 'Content-Type': 'application/json', 'X-Draw-Lock': tok };

		const ok = await fetch(`${base}/diagrams/${id}/commit`,
			{ method: 'POST', headers: hdr, body: JSON.stringify(body) });
		assert.equal(ok.status, 200, 'the owner is not locked out of their own diagram');

		who = GUEST;
		const no = await fetch(`${base}/diagrams/${id}/commit`,
			{ method: 'POST', headers: hdr, body: JSON.stringify(body) });
		assert.equal(no.status, 403, 'a stranger is refused');
		assert.equal((await no.json()).code, 'forbidden',
			'403 and a code, not 409 or 422 — an agent must not retry this');
	} finally {
		await app.close();
		fs.rmSync(dataDir, { recursive: true, force: true });
	}
});

test('H9.3b: a read grant is refused a write over REST', async () => {
	let who = OWNER;
	const { app, dataDir, base } = await live(() => who);
	try {
		const id = (await (await fetch(`${base}/diagrams`)).json())[0].id;
		assert.equal(app.store.grant(id, GUEST, 'read', OWNER), null);
		const tok = (await (await fetch(`${base}/diagrams/${id}/lock`, { method: 'POST' })).json()).token;

		who = GUEST;
		assert.equal((await (await fetch(`${base}/diagrams`)).json()).length, 1, 'read sees it');
		const no = await fetch(`${base}/diagrams/${id}/commit`, {
			method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Draw-Lock': tok },
			body: JSON.stringify(body),
		});
		assert.equal(no.status, 403, 'and cannot change it');
	} finally {
		await app.close();
		fs.rmSync(dataDir, { recursive: true, force: true });
	}
});

/*
H9.4 -- the write slot is a write capability.

Two routes mutate nothing in the store and so were missed by the H9.3a sweep over the seven
mutating methods: acquiring the server lock, and reclaiming it. Neither writes, both decide who
may. The damage is availability rather than confidentiality (B63): a reader cannot commit through
a lock it holds, because commit checks the ACL independently -- it can only sit in the single
write slot and keep the owner out of it.

Nothing here asserts that a lock knows who holds it, because it does not and need not. Reclaim,
once gated, is the owner's remedy against a lock held by someone since revoked, which is what
makes tracking the holder unnecessary and keeps `locks.js` a state machine over opaque tokens.
*/
test('H9.4: a read grant cannot take the write lock', async () => {
	let who = OWNER;
	const { app, dataDir, base } = await live(() => who);
	try {
		const id = (await (await fetch(`${base}/diagrams`)).json())[0].id;
		assert.equal(app.store.grant(id, GUEST, 'read', OWNER), null);

		who = GUEST;
		const no = await fetch(`${base}/diagrams/${id}/lock`, { method: 'POST' });
		assert.equal(no.status, 403, 'a reader is refused the write slot');
		assert.equal((await no.json()).code, 'forbidden', 'never retry this — 409 would say otherwise');

		who = OWNER;
		const ok = await fetch(`${base}/diagrams/${id}/lock`, { method: 'POST' });
		assert.equal(ok.status, 200, 'and the slot was left free for the owner');
	} finally {
		await app.close();
		fs.rmSync(dataDir, { recursive: true, force: true });
	}
});

test('H9.4: a revoked holder is evicted by the owner reclaiming, not by waiting out the TTL', async () => {
	let who = OWNER;
	const { app, dataDir, base } = await live(() => who);
	try {
		const id = (await (await fetch(`${base}/diagrams`)).json())[0].id;
		assert.equal(app.store.grant(id, GUEST, 'write', OWNER), null);

		who = GUEST;
		const held = await (await fetch(`${base}/diagrams/${id}/lock`, { method: 'POST' })).json();
		assert.ok(held.token, 'a write grant legitimately takes the lock');

		app.store.revoke(id, GUEST, OWNER);
		const gone = await fetch(`${base}/diagrams/${id}/commit`, {
			method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Draw-Lock': held.token },
			body: JSON.stringify(body),
		});
		assert.equal(gone.status, 403, 'revocation bites immediately — the lock buys the write nothing');
		assert.ok(app.locks.verify(id, held.token), 'but the slot is still occupied, which is the real damage');

		app.locks.reclaim(id);
		assert.equal(app.locks.verify(id, held.token), false, 'the owner takes the slot back without a TTL wait');
	} finally {
		await app.close();
		fs.rmSync(dataDir, { recursive: true, force: true });
	}
});

// reclaim is reached over the websocket, so it must be tested there. Asserting it through
// `locks.reclaim` directly would exercise the state machine and skip the gate entirely --
// the check would pass with no authorization in the file at all.
function fakeWs() {
	const out = [];
	const handlers = {};
	return {
		readyState: 1, out,
		on(ev, fn) { handlers[ev] = fn; },
		send(text) { out.push(JSON.parse(text)); },
		recv(cmd, body) { handlers.message(Buffer.from(JSON.stringify({ cmd, body }))); },
		last: (cmd) => [...out].reverse().find((m) => m.cmd === cmd),
	};
}

test('H9.4: a reader cannot reclaim, so it cannot break a legitimate agent\'s lock', async () => {
	const dir = tmp();
	const store = new Store(dir, { flushMs: 3_600_000, authz: true });
	await store.init();
	const id = store.list(OWNER, { all: true })[0]?.id ?? [...store.diagrams.keys()][0];
	store.setOwner(id, OWNER);
	assert.equal(store.grant(id, GUEST, 'read', OWNER), null);

	const locks = new Locks();
	const agent = locks.acquire(id);
	assert.ok(agent.token, 'an agent holds the lock');

	try {
		const rws = fakeWs();
		new Session(rws, store, null, locks, GUEST);
		rws.recv('reclaim', { id });
		assert.equal(rws.last('error')?.body.code, 'forbidden', 'the reader is refused');
		assert.ok(locks.verify(id, agent.token), "and the agent's lock survived");

		const ows = fakeWs();
		new Session(ows, store, null, locks, OWNER);
		ows.recv('reclaim', { id });
		assert.equal(locks.verify(id, agent.token), false, 'the owner still takes the wheel back');
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});
