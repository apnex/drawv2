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
import { Session, snapshotBody } from '../server/protocol.js';
import { Locks } from '../server/locks.js';
import { Model } from '../model/index.mjs';
import { Selection } from '../app/src/selection.js';
import { Sync } from '../app/src/sync.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'draw-acl-'));
const OWNER = 'user:owner@apnex.com.au';
const GUEST = 'user:guest@example.com';
const AGENT = 'agent:planner';
const CODE = 'agent:k7f3q2';

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
	// B70: this asserted `store.list(OWNER)` directly, which never touches identity -- it passed
	// against a deployment where every request resolved to nobody, which is the exact state that
	// then shipped. "Not locked out" has to be observed through a request or it means nothing.
	let who = OWNER;
	const app = await createApp({
		dataDir, secretsDir: dataDir, port: 0, authz: true, owner: OWNER,
		principalOf: async () => who,
	});
	const base = `http://127.0.0.1:${app.port}/api/v1`;
	try {
		assert.ok(app.store.list(OWNER).length > 0, 'the seeded diagram was adopted at boot');
		assert.ok((await (await fetch(`${base}/diagrams`)).json()).length > 0,
			'and the operator reaches it over HTTP, not merely in the store');
		who = GUEST;
		assert.deepEqual(await (await fetch(`${base}/diagrams`)).json(), [], 'and nobody else sees it');
	} finally {
		await app.close();
		fs.rmSync(dataDir, { recursive: true, force: true });
	}
});

test('B70: authz with no identity source refuses to start, rather than refusing everyone', async () => {
	const dataDir = path.join(os.tmpdir(), `draw-b70-${Math.random().toString(36).slice(2)}`);
	await assert.rejects(
		() => createApp({ dataDir, secretsDir: dataDir, port: 0, authz: true, owner: OWNER }),
		/no way to identify anyone/,
		'the combination that shipped is now unconstructable',
	);
	fs.rmSync(dataDir, { recursive: true, force: true });
});

/*
B70 was an argument tested but not passed: `authz: Boolean(audience)` with no `audience` alongside
it. The defect was a missing property in an object literal, invisible to every test because all of
them call createApp directly, so this reads the wiring itself -- the only artefact that was wrong.

H9.25 changed what has to hold. `audience` is gone, and the durable invariant is that the switch
and the identity come from ONE value, because B70 was those two disagreeing. scan-wiring (H9.16)
does not cover this: its rule is that a root binding named P must be passed as P, and the binding
here is `source` while the parameter is `principalOf`.
*/
test('B70/H9.25: the switch and the identity come from one value in the real wiring', async () => {
	const src = fs.readFileSync(new URL('../server/server.js', import.meta.url), 'utf8');
	const call = src.slice(src.indexOf('createApp({'));
	const args = call.slice(0, call.indexOf('})') + 1);

	const authz = /authz:\s*([^,}]+)/.exec(args);
	const principal = /principalOf:\s*([^,}]+)/.exec(args);
	assert.ok(authz, 'authz is passed');
	assert.ok(principal, 'principalOf is PASSED, not merely consulted — that was the B70 shape');
	assert.match(authz[1], /source/, 'the switch derives from the identity source');
	assert.match(principal[1], /source/, 'and so does the identity, so the two cannot disagree');
	assert.doesNotMatch(args, /audience/,
		'and the app is no longer handed an IAP-shaped argument at all (H9.25)');
});

/*
H9.25/B93 -- authorization must not be a shadow of one authentication mechanism.

`canRead` and `canWrite` return true when `authz` is off, and `authz` was `Boolean(IAP_AUDIENCE)`.
So "replace the authentication mechanism" and "open every diagram to everyone" were the same edit.
The structural claim of the repair is that the application no longer knows what IAP is: asserted
against the source, because it is a claim about coupling and nothing observable at runtime would
show it.
*/
test('H9.25: the app does not know which authentication mechanism produced the principal', () => {
	const app = fs.readFileSync(new URL('../server/app.js', import.meta.url), 'utf8');
	assert.doesNotMatch(app, /iapIdentity/,
		'app.js must not name the mechanism — server.js resolves a source and hands in principalOf');
	assert.match(app, /domainGate/, 'it still composes the allowlist, which is policy rather than mechanism');

	const server = fs.readFileSync(new URL('../server/server.js', import.meta.url), 'utf8');
	assert.doesNotMatch(server, /authz:\s*Boolean\(audience\)/,
		'the switch is no longer spelled as the presence of an IAP audience');
	assert.match(server, /bucket && !source/,
		'and the boot guard demands an identity SOURCE, not that one product is configured');
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
// B112: an unpositioned fixture node gets a DISTINCT anchor derived from its id -- one
// anchor holds one occupant, so two fixtures defaulting to (0,0) is now a real violation.
const _at = (id) => (parseInt(id.slice(-4), 16) % 15 + 1) * 60;
const node = (id, x = null) => ({ id, name: id, type: 'host', shape: 'circle', x: x ?? _at(id), y: 0 });
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
		assert.ok(s.commit(id, { label: 'y', ops: [put('node', node('node-ee0002', 120))] },
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

/*
H9.3c -- the UI stops offering what the server will refuse.

Two ends, tested separately because they fail separately. The server must put the decision on the
wire, and the client must act on it. A test that only checked the client against a hand-built
snapshot would pass with the server sending nothing at all, which is exactly the fixture drift
that six existing tests turned out to have.

`mayWrite` is deliberately not folded into `locked`. Server-Locked means someone else is driving
and the indicator offers "click to take back"; reclaim is itself a write capability (B64), so a
reader offered that button would be offered the one remedy certain to be refused.
*/
test('H9.3c: the snapshot carries the same write predicate the server refuses with', async () => {
	const dir = tmp();
	const store = new Store(dir, { flushMs: 3_600_000, authz: true });
	await store.init();
	const id = [...store.diagrams.keys()][0];
	store.setOwner(id, OWNER);
	assert.equal(store.grant(id, GUEST, 'read', OWNER), null);
	try {
		const forOwner = snapshotBody(store.get(id), store, null, OWNER);
		const forReader = snapshotBody(store.get(id), store, null, GUEST);
		assert.equal(forOwner.mayWrite, true, 'the owner is told it may write');
		assert.equal(forReader.mayWrite, false, 'the reader is told it may not');
		// the point of reusing canWrite rather than re-deriving: one rule, so no drift
		assert.equal(forReader.mayWrite, store.canWrite(id, GUEST),
			'the wire value IS the enforcement predicate, not a second opinion');
		assert.equal(forReader.locked, false, 'and it is not disguised as Server-Locked');
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test('H9.3c: a client told mayWrite:false sends no write, and is not offered reclaim', () => {
	const sent = [];
	const net = {
		status: 'open', subscribe(fn) { this.recv = fn; }, onStatus() {},
		isOpen: () => true, send: (cmd, body) => { sent.push({ cmd, body }); return true; },
	};
	const model = new Model();
	const selection = new Selection(model);
	const states = [];
	const sync = new Sync({ model, net, history: { clear() {}, setCounts() {}, state: { version: 0 } },
		selection, onState: (s) => states.push(s) });

	const doc = model.toJSON();
	net.recv({ cmd: 'snapshot', body: { doc, diagrams: [], mayWrite: false, locked: false, version: 1 } });
	assert.equal(sync.mayWrite, false, 'the client took the server at its word');
	assert.equal(sync.readOnly, true, 'and treats itself as read-only');
	assert.equal(sync.locked, false, 'without pretending someone else is driving');

	const before = sent.length;
	sync.submit({ ops: [{ op: 'put', kind: 'node', entity: node('node-ff0011', 60) }], label: 'x' });
	sync.flush();
	assert.equal(sent.length, before, 'no commit reached the wire — nothing for the server to 403');

	sync.rename('renamed');
	assert.equal(sent.filter((m) => m.cmd === 'rename' || m.cmd === 'meta').length, 0, 'nor a rename');

	// the indicator is its own state, so the reclaim branch in main.js is never reached
	const last = states[states.length - 1];
	assert.equal(last.mayWrite, false, 'the UI is given the fact it needs to render read-only');
});

test('H9.3c/B65: the creator owns what it creates, and can write it immediately', async () => {
	const dir = tmp();
	const store = new Store(dir, { flushMs: 3_600_000, authz: true });
	await store.init();
	try {
		// through the protocol, because the defect was a caller dropping the principal, not the
		// store lacking the ability to record one — calling store.create directly would pass
		// against the broken wiring
		const ws = fakeWs();
		new Session(ws, store, null, new Locks(), GUEST);
		ws.recv('create', { name: 'mine' });
		const id = ws.last('snapshot')?.body.doc.meta.id;
		assert.ok(id, 'a diagram was minted');
		assert.equal(store.get(id).state.meta.owner, GUEST, 'the creator is recorded as owner');
		assert.equal(store.canWrite(id, GUEST), true, 'and is not locked out of it');
		assert.equal(ws.last('snapshot').body.mayWrite, true, 'the client is told so in the same breath');

		// the ownership came from the session, so it cannot be claimed by asking for it
		const ws2 = fakeWs();
		new Session(ws2, store, null, new Locks(), 'user:thief@example.com');
		ws2.recv('create', { name: 'theirs', doc: { ...store.get(id).toJSON(), meta: { ...store.get(id).toJSON().meta, owner: GUEST } } });
		const id2 = ws2.last('snapshot')?.body.doc.meta.id;
		assert.equal(store.get(id2).state.meta.owner, 'user:thief@example.com',
			'an owner named in the document is ignored — H9.1 cleanMeta still holds');
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

/*
H9.8 integration. The obvious version of this test does not work: assert that a stranger on a
disallowed domain sees an empty list, and it passes with the allowlist deleted, because a
stranger has no grants either way. It measured default-deny and called it a domain check.

The property that distinguishes them is that the allowlist runs BEFORE the grant lookup and so
overrides one. A principal holding an explicit write grant, on a domain not on the list, must
still be nobody -- that outcome is impossible under grants alone.
*/
test('H9.8: the allowlist overrides an explicit grant, because it runs first', async () => {
	const INTRUDER = 'user:someone@notapnex.com.au';
	let who = OWNER;
	const dataDir = path.join(os.tmpdir(), `draw-dom-${Math.random().toString(36).slice(2)}`);
	const app = await createApp({
		dataDir, secretsDir: dataDir, port: 0,
		authz: true, owner: OWNER, principalOf: async () => who,
		domains: ['apnex.com.au'],
	});
	const base = `http://127.0.0.1:${app.port}/api/v1`;
	try {
		const id = [...app.store.diagrams.keys()][0];
		// deliberately granted, so nothing about the grant model can explain a refusal
		assert.equal(app.store.grant(id, INTRUDER, 'write', OWNER), null);
		assert.equal(app.store.canWrite(id, INTRUDER), true, 'the grant is real and would suffice');

		const tok = (await (await fetch(`${base}/diagrams/${id}/lock`, { method: 'POST' })).json()).token;

		who = INTRUDER;
		assert.deepEqual(await (await fetch(`${base}/diagrams`)).json(), [],
			'a granted principal on a lookalike domain never becomes that principal');
		const no = await fetch(`${base}/diagrams/${id}/commit`, {
			method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Draw-Lock': tok },
			body: JSON.stringify(body),
		});
		assert.equal(no.status, 403, 'and the grant it holds does not save it');

		// control: the same grant on an allowed domain does work, so the refusal is the domain
		const GUEST_OK = 'user:guest@apnex.com.au';
		assert.equal(app.store.grant(id, GUEST_OK, 'write', OWNER), null);
		who = GUEST_OK;
		const yes = await fetch(`${base}/diagrams/${id}/commit`, {
			method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Draw-Lock': tok },
			body: JSON.stringify(body),
		});
		assert.equal(yes.status, 200, 'identical grant, allowed domain, admitted');
	} finally {
		await app.close();
		fs.rmSync(dataDir, { recursive: true, force: true });
	}
});

/*
B67 -- reads are gated too.

H9 gated writes, listing, and locks, and left the document open. The asymmetry survived because
`snapshotBody` filters `diagrams` three lines below where it returns `doc`, so an unauthorized
payload sat beside an authorized one and looked checked. Live, that produced the exact symptom
that exposed it: a diagram rendered in the editor while the dropdown listing it was empty.

Five paths, because "the read gate" was five separate omissions and fixing four is not fixing it.
*/
async function ownedStore() {
	const dir = tmp();
	const store = new Store(dir, { flushMs: 3_600_000, authz: true });
	await store.init();
	const id = [...store.diagrams.keys()][0];
	store.setOwner(id, OWNER);
	return { dir, store, id };
}

test('B67: ws open and hello refuse a diagram the principal cannot read', async () => {
	const { dir, store, id } = await ownedStore();
	try {
		const ws = fakeWs();
		new Session(ws, store, null, new Locks(), GUEST);

		ws.recv('open', { id });
		assert.equal(ws.last('error')?.body.code, 'forbidden', 'open is refused');
		assert.equal(ws.last('snapshot'), undefined, 'and no document was sent');

		ws.recv('hello', {});
		assert.equal(ws.last('snapshot'), undefined,
			'hello with no readable diagram sends nothing — store.first no longer leaks whichever came first');
		assert.match(ws.last('error').body.message, /no diagrams available/);

		// control: the owner still gets both
		const ows = fakeWs();
		new Session(ows, store, null, new Locks(), OWNER);
		ows.recv('hello', {});
		assert.equal(ows.last('snapshot')?.body.doc.meta.id, id, 'the owner is unaffected');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('B67: snapshotBody refuses outright, so a future caller cannot reintroduce the hole', async () => {
	const { dir, store, id } = await ownedStore();
	try {
		assert.throws(() => snapshotBody(store.get(id), store, null, GUEST), /may not read/,
			'defence in depth: the payload builder will not build an unauthorized payload');
		assert.doesNotThrow(() => snapshotBody(store.get(id), store, null, OWNER));
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('B67: REST document, history and the SVG rendering are all gated', async () => {
	let who = OWNER;
	const dataDir = path.join(os.tmpdir(), `draw-b67-${Math.random().toString(36).slice(2)}`);
	const app = await createApp({
		dataDir, secretsDir: dataDir, port: 0,
		authz: true, owner: OWNER, principalOf: async () => who,
	});
	const root = `http://127.0.0.1:${app.port}`;
	try {
		const id = [...app.store.diagrams.keys()][0];
		assert.equal((await fetch(`${root}/api/v1/diagrams/${id}`)).status, 200, 'the owner reads it');
		assert.equal((await fetch(`${root}/d/${id}.svg`)).status, 200, 'and renders it');

		who = GUEST;
		assert.equal((await fetch(`${root}/api/v1/diagrams/${id}`)).status, 403, 'the document is refused');
		assert.equal((await fetch(`${root}/api/v1/diagrams/${id}/log`)).status, 403,
			'and so is its history — a log describes content the caller may not know about');
		// ACCESS.md: a representation is not a permission. An SVG is the whole document.
		assert.equal((await fetch(`${root}/d/${id}.svg`)).status, 403, 'and so is the image');

		// a read grant is enough to read, which is what distinguishes this from the write gate
		assert.equal(app.store.grant(id, GUEST, 'read', OWNER), null);
		assert.equal((await fetch(`${root}/api/v1/diagrams/${id}`)).status, 200, 'a read grant reads');
	} finally {
		await app.close();
		fs.rmSync(dataDir, { recursive: true, force: true });
	}
});

/*
B76 -- the client is told which principal it is.

The gap was sharp rather than merely missing: `snapshotBody` ships the whole document, so the
browser already held `meta.owner` and the entire `meta.grants` map. It could enumerate every
principal with access to a diagram and could not tell which one it was. `mayWrite` answers what
may I do and was never intended to answer who am I.
*/
test('B76: the snapshot names the principal, and it is the principal not an email', async () => {
	const dir = tmp();
	const store = new Store(dir, { flushMs: 3_600_000, authz: true });
	await store.init();
	const id = [...store.diagrams.keys()][0];
	store.setOwner(id, OWNER);
	assert.equal(store.grant(id, GUEST, 'read', OWNER), null);
	try {
		const mine = snapshotBody(store.get(id), store, null, OWNER);
		assert.equal(mine.principal, OWNER, 'namespaced, so the client never parses an identity');
		assert.match(mine.principal, /^user:/, 'the prefix rides along — user: and agent: must stay distinct');

		// the distinguishing property: the document already carried every principal, so this must
		// tell them apart rather than merely be present
		assert.ok(mine.doc.meta.grants[GUEST], 'the doc names the guest to everyone who can read it');
		assert.equal(snapshotBody(store.get(id), store, null, GUEST).principal, GUEST,
			'and the guest is told it is the guest, not the owner');

		const off = new Store(tmp(), { flushMs: 3_600_000 });
		await off.init();
		const anon = snapshotBody(off.get([...off.diagrams.keys()][0]), off, null, null);
		assert.equal(anon.principal, null, 'with authz off there is no principal, and none is invented');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

/*
H9.4b -- a principal is an IDENTITY; a connection code is a CREDENTIAL for one.

`code:` used to be a principal, which made the credential and the identity the same object and
caused three problems that each looked independent: revoking a code destroyed an owner and
orphaned what it held, rotating one lost every grant made to the old value, and a code could not
be reused across diagrams because the code WAS the grant. ACCESS.md's 2026-08-21 amendment rules
the split; this is the grammar half of it.

The grammar is asserted rather than the regex, because the point is which strings the system will
and will not accept as an identity, and narrowing a grammar later is the change you cannot make.
*/
const principalDoc = (owner) => ({
	meta: { id: 'diagram-aa0001', name: 't', version: 0, schema: 1, owner },
	nodes: [], waypoints: [], links: [], zones: [], groups: [],
});
const acceptsPrincipal = (p) => validateDoc(principalDoc(p)) === null;

test('H9.4b: an agent identity is a principal and a bare code is not', () => {
	assert.equal(acceptsPrincipal('agent:planner'), true, 'an agent identity is a principal');
	assert.equal(acceptsPrincipal('user:a@b.co'), true, 'so is a Google identity');
	assert.equal(acceptsPrincipal('code:k7f3q2'), false,
		'a code is NOT — it authenticates as an identity, it is not one');
	assert.equal(acceptsPrincipal('planner'), false, 'and an unprefixed string is refused rather than guessed');
});

test('H9.4b: the agent grammar refuses what would make two identities look like one', () => {
	assert.equal(acceptsPrincipal('agent:Planner'), false,
		'uppercase is refused — agent:Planner and agent:planner as distinct principals is a confusion attack');
	assert.equal(acceptsPrincipal('agent:a:b'), false, 'a colon is refused, so the namespace prefix stays unambiguous');
	assert.equal(acceptsPrincipal('agent:'), false, 'an empty name is not a name');
	assert.equal(acceptsPrincipal('agent:-lead'), false, 'a leading hyphen is refused; the DNS label shape is the model');
	assert.equal(acceptsPrincipal(`agent:${'a'.repeat(63)}`), true, '63 characters is the bound');
	assert.equal(acceptsPrincipal(`agent:${'a'.repeat(64)}`), false, 'and 64 is past it');
	assert.equal(acceptsPrincipal('agent:ci-planner-2'), true, 'hyphens and digits inside are fine');
});

/*
H9.4d/B90 -- authorization was enforced everywhere and administrable nowhere.

`grant`, `revoke` and `setOwner` had 29 call sites and every one was in this file, so the deployed
system's only reachable state was "one person owns everything" and no request could change it. The
model was complete and unreachable. These tests drive the surface that makes it reachable, over
HTTP, because a store-level test is what let the gap survive an entire milestone.
*/
async function grantable() {
	let who = OWNER;
	const dataDir = path.join(os.tmpdir(), `draw-grants-${Math.random().toString(36).slice(2)}`);
	const app = await createApp({
		dataDir, secretsDir: dataDir, port: 0,
		authz: true, owner: OWNER, principalOf: async () => who,
	});
	const id = [...app.store.diagrams.keys()][0];
	return {
		app, dataDir, id,
		as: (p) => { who = p; },
		base: `http://127.0.0.1:${app.port}/api/v1/diagrams/${id}`,
		close: async () => { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); },
	};
}

test('H9.4d: an owner can grant and revoke over HTTP, and the grant actually takes effect', async () => {
	const t = await grantable();
	try {
		const grant = await fetch(`${t.base}/grants`, {
			method: 'POST', body: JSON.stringify({ principal: GUEST, level: 'write' }),
		});
		assert.equal(grant.status, 200, 'the owner may grant');
		assert.deepEqual((await grant.json()).grants, { [GUEST]: 'write' }, 'and is told the resulting state');

		t.as(GUEST);
		assert.equal(t.app.store.canWrite(t.id, GUEST), true,
			'the grant is not decoration — the guest may now write');
		assert.equal((await (await fetch(`${t.base}`)).status), 200, 'and may read the diagram');

		t.as(OWNER);
		const revoke = await fetch(`${t.base}/grants/${encodeURIComponent(GUEST)}`, { method: 'DELETE' });
		assert.equal(revoke.status, 200, 'and may revoke');
		assert.deepEqual((await revoke.json()).grants, {}, 'leaving nothing behind');
		assert.equal(t.app.store.canRead(t.id, GUEST), false, 'the guest is out again');
	} finally { await t.close(); }
});

test('H9.4d: only the owner may administer access, and a reader cannot grant themselves more', async () => {
	const t = await grantable();
	try {
		await fetch(`${t.base}/grants`, { method: 'POST', body: JSON.stringify({ principal: GUEST, level: 'read' }) });
		t.as(GUEST);
		const escalate = await fetch(`${t.base}/grants`, {
			method: 'POST', body: JSON.stringify({ principal: GUEST, level: 'write' }),
		});
		assert.equal(escalate.status, 403, 'a reader cannot promote itself to a writer');
		assert.equal(t.app.store.canWrite(t.id, GUEST), false, 'and the attempt changed nothing');

		const evict = await fetch(`${t.base}/grants/${encodeURIComponent(OWNER)}`, { method: 'DELETE' });
		assert.equal(evict.status, 403, 'nor revoke anyone else');
		assert.equal(t.app.store.canWrite(t.id, OWNER), true, 'the owner still owns it');
	} finally { await t.close(); }
});

/*
The corruption path this surface would have opened.

Grants bypass `commit()` on purpose -- undo restoring access for a principal just revoked would be
a security failure -- so they bypass its validation too, and `validateDoc` was the only thing that
judged a grant principal. Harmless while nothing could write one. The moment the route exists, a
malformed principal persists and the diagram REFUSES TO LOAD at the next boot, which is a write
that breaks a document at some unrelated restart. Asserted end to end, through a real reload.
*/
test('H9.4d: a malformed principal is refused at the write, not discovered at the next boot', async () => {
	const t = await grantable();
	try {
		for (const bad of ['garbage', 'user:', 'agent:UPPER', '', 'user:a@b.co extra']) {
			const res = await fetch(`${t.base}/grants`, {
				method: 'POST', body: JSON.stringify({ principal: bad, level: 'read' }),
			});
			assert.equal(res.status, 422, `refused at the write: ${JSON.stringify(bad)}`);
		}
		assert.equal((await fetch(`${t.base}/grants`, {
			method: 'POST', body: JSON.stringify({ principal: GUEST, level: 'admin' }),
		})).status, 422, 'and an invented level is refused too');
	} finally { await t.close(); }
});

/*
And this is what that refusal is worth, proven rather than asserted.

The companion test above cannot demonstrate the stakes: removing the validation makes it fail at
the write, so an assertion about reloading afterwards never runs against a genuinely bad document
and is decoration. The consequence needs its own proof, so this bypasses the route entirely and
writes the malformed grant straight into the model -- which is exactly what the route would have
done without the check -- then flushes and boots a second Store over the same directory.

The document does not come back. Not "loads with the grant dropped": D17/GR8 turns a data dir whose
every candidate failed into a boot refusal, so one bad grant on the only diagram is an outage at
some later restart, arbitrarily far from the request that caused it.
*/
test('H9.4d: an UNVALIDATED grant would make the diagram unloadable, which is why it is refused', async () => {
	const t = await grantable();
	try {
		const meta = t.app.store.get(t.id).state.meta;
		meta.grants = { ...meta.grants, garbage: 'read' };
		t.app.store.markDirty(t.id);
		await t.app.store.flush(t.id);

		const reloaded = new Store(t.dataDir, { flushMs: 3_600_000, authz: true });
		await assert.rejects(() => reloaded.init(), /refusing to boot/,
			'one malformed grant, and the diagram is gone at the next restart');
	} finally { await t.close(); }
});

test('H9.4d: administering access is not lock-gated, because revoking is urgent exactly then', async () => {
	const t = await grantable();
	try {
		const lock = await fetch(`${t.base}/lock`, { method: 'POST' });
		assert.equal(lock.status, 200, 'somebody is driving');
		const res = await fetch(`${t.base}/grants`, {
			method: 'POST', body: JSON.stringify({ principal: GUEST, level: 'read' }),
		});
		assert.equal(res.status, 200, 'the owner can still change access mid-session — not 423');
	} finally { await t.close(); }
});

/*
H9.4c -- a grant may name an OWNER, not only a diagram.

ACCESS.md lifted the collection-scope deferral because agent-created diagrams made it untenable: if
an agent may create, the human needs access to what it creates and the agent to what the human
creates, and per-diagram grants put a person in the loop for every one of them. A workspace is the
set of diagrams owned by a principal -- no new entity, one fallback in access().
*/
test('H9.4c: a workspace grant reaches every diagram that owner holds, including new ones', async () => {
	const t = await grantable();
	try {
		const res = await fetch(`http://127.0.0.1:${t.app.port}/api/v1/workspace/grants`, {
			method: 'POST', body: JSON.stringify({ principal: GUEST, level: 'write' }),
		});
		assert.equal(res.status, 200, 'the caller grants on their own workspace');
		assert.deepEqual((await res.json()).grants, { [GUEST]: 'write' });

		assert.equal(t.app.store.canWrite(t.id, GUEST), true,
			'and it reaches a diagram with no grant of its own');

		// the reason the deferral was lifted: a diagram that did not exist when the grant was made
		const created = t.app.store.create('later', null, OWNER);
		assert.equal(created.ok, true, 'created');
		const freshId = created.model.state.meta.id;
		assert.equal(t.app.store.canWrite(freshId, GUEST), true,
			'a diagram created AFTER the grant is reached too — that is what makes it a workspace');

		// and it is scoped to that owner, not global
		t.app.store.get(freshId).state.meta.owner = 'user:someone@else.co';
		assert.equal(t.app.store.canRead(freshId, GUEST), false,
			'a diagram owned by somebody else is untouched by this grant');
	} finally { await t.close(); }
});

/*
The precedence trap, which is the part most likely to be believed wrong.

ACCESS.md says FALLBACK, not union: a grant naming the diagram wins. That is what allows narrowing
a workspace grant on one diagram -- and it means removing the diagram entry does not remove access,
it returns the principal to the workspace level. Encoding "revoked" as "the row is gone" would be
B80 again, describing the mechanism rather than the permission, so the response says what remains.
*/
test('H9.4c: a diagram grant overrides a workspace grant, and revoking it does NOT remove access', async () => {
	const t = await grantable();
	const api = `http://127.0.0.1:${t.app.port}/api/v1`;
	try {
		await fetch(`${api}/workspace/grants`, { method: 'POST', body: JSON.stringify({ principal: GUEST, level: 'write' }) });
		await fetch(`${t.base}/grants`, { method: 'POST', body: JSON.stringify({ principal: GUEST, level: 'read' }) });
		assert.equal(t.app.store.access(t.id, GUEST), 'read',
			'the narrower diagram grant wins — fallback, not union');

		const revoked = await fetch(`${t.base}/grants/${encodeURIComponent(GUEST)}`, { method: 'DELETE' });
		const body = await revoked.json();
		assert.deepEqual(body.grants, {}, 'the diagram entry is gone');
		assert.equal(body.effective, 'write',
			'but access is NOT — the response says so rather than leaving it to be discovered');
		assert.equal(t.app.store.canWrite(t.id, GUEST), true, 'and it is genuinely still there');

		const gone = await fetch(`${api}/workspace/grants/${encodeURIComponent(GUEST)}`, { method: 'DELETE' });
		assert.equal(gone.status, 200);
		assert.equal(t.app.store.canRead(t.id, GUEST), false, 'revoking the workspace grant does remove it');
	} finally { await t.close(); }
});

test('H9.4c: you administer your own workspace and no other', async () => {
	const t = await grantable();
	const api = `http://127.0.0.1:${t.app.port}/api/v1`;
	try {
		await fetch(`${api}/workspace/grants`, { method: 'POST', body: JSON.stringify({ principal: GUEST, level: 'write' }) });
		t.as(GUEST);
		// there is no owner in the path, so the guest's POST can only touch the guest's own
		// workspace -- granting on the owner's is unrepresentable, not merely refused
		const OTHER = 'user:someone@notapnex.com.au';
		await fetch(`${api}/workspace/grants`, { method: 'POST', body: JSON.stringify({ principal: OTHER, level: 'write' }) });
		assert.deepEqual(t.app.store.workspaceGrants(OWNER), { [GUEST]: 'write' },
			"the owner's workspace is untouched by anything the guest can say");
		assert.deepEqual(t.app.store.workspaceGrants(GUEST), { [OTHER]: 'write' },
			'the guest changed only their own');
		assert.deepEqual((await (await fetch(`${api}/workspace/grants`)).json()).grants, { [OTHER]: 'write' },
			'and GET answers for the caller, never for everyone');
	} finally { await t.close(); }
});

test('H9.4c: workspace grants survive a restart, and a corrupt file is a boot refusal', async () => {
	const t = await grantable();
	const api = `http://127.0.0.1:${t.app.port}/api/v1`;
	try {
		await fetch(`${api}/workspace/grants`, { method: 'POST', body: JSON.stringify({ principal: GUEST, level: 'read' }) });

		const again = new Store(t.dataDir, { flushMs: 3_600_000, authz: true });
		await again.init();
		assert.deepEqual(again.workspaceGrants(OWNER), { [GUEST]: 'read' }, 'durable across a restart');

		// D17/GR8: a file we cannot read means we do not know who may reach what, and serving
		// anyway is the plausible-complete-and-wrong state. Dropping the grants would be quieter
		// and worse — agents would lose access with no event to point at.
		fs.writeFileSync(path.join(t.dataDir, 'access.json'), '{ not json');
		await assert.rejects(() => new Store(t.dataDir, { flushMs: 3_600_000, authz: true }).init(),
			/refusing to boot/, 'unreadable is a refusal, not a silent empty map');

		fs.writeFileSync(path.join(t.dataDir, 'access.json'), JSON.stringify({ [OWNER]: { [GUEST]: 'admin' } }));
		await assert.rejects(() => new Store(t.dataDir, { flushMs: 3_600_000, authz: true }).init(),
			/invalid level/, 'and an invented level is refused, never narrowed to read');
	} finally { await t.close(); }
});

/*
H9.21 -- an agent may create a diagram, and owns it.

The last piece of the agent-first ruling that does not need a decision from the director. Creating
is what makes an agent a participant rather than a guest: until now every diagram had to be made by
a person in a browser, so a human was on the critical path for each one.
*/
test('H9.21: a create over REST is owned by the caller, and the caller can write it at once', async () => {
	const t = await grantable();
	const api = `http://127.0.0.1:${t.app.port}/api/v1/diagrams`;
	try {
		t.as(AGENT);
		const res = await fetch(api, { method: 'POST', body: JSON.stringify({ name: 'by an agent' }) });
		assert.equal(res.status, 201, 'created');
		const { id, doc } = await res.json();
		assert.equal(doc.meta.owner, AGENT, 'the creator owns it');
		assert.equal(doc.meta.name, 'by an agent');
		assert.equal(t.app.store.canWrite(id, AGENT), true,
			'and can write immediately — B65 was exactly this failing');

		// the response saves a round trip: an agent needs the minted id to do anything next
		assert.match(id, /^diagram-[0-9a-f]{6}$/, 'the id is minted and returned');
		assert.equal(t.app.store.canRead(id, OWNER), false,
			'and the human does NOT get it for free — a grant is still how access happens');
	} finally { await t.close(); }
});

test('H9.21: the id is minted by the server, never taken from the body', async () => {
	const t = await grantable();
	const api = `http://127.0.0.1:${t.app.port}/api/v1/diagrams`;
	try {
		// B2: a caller-chosen id would let offline work land on top of an existing diagram. I11 makes
		// `create` the one whole-document path, and it can only ever create.
		const before = t.app.store.get(t.id).state.meta.name;
		const res = await fetch(api, {
			method: 'POST',
			body: JSON.stringify({ doc: { meta: { id: t.id, name: 'impostor' }, nodes: [], links: [], zones: [], groups: [], waypoints: [] } }),
		});
		assert.equal(res.status, 201);
		const { id } = await res.json();
		assert.notEqual(id, t.id, 'a body id is ignored — this is how B2 stays fixed');
		assert.equal(t.app.store.get(t.id).state.meta.name, before,
			'and the existing diagram is untouched — read before, rather than a name assumed here');
	} finally { await t.close(); }
});

test('H9.21: an unidentified caller cannot create when authorization is on', async () => {
	const t = await grantable();
	const api = `http://127.0.0.1:${t.app.port}/api/v1/diagrams`;
	try {
		t.as(null);
		const res = await fetch(api, { method: 'POST', body: JSON.stringify({ name: 'anonymous' }) });
		assert.equal(res.status, 403, 'no identity, no diagram — it would be owned by nobody');
		assert.equal(t.app.store.total(), 1, 'and nothing was created');
	} finally { await t.close(); }
});

/*
B98 -- the store gets a bound, because this route is the first on which a PROGRAM creates.

MAX_COLLECTION is per kind per diagram and says so. Nothing capped the store, which was tolerable
while creating meant a person pressing a button. A retry loop around a call that looked like it
failed does not pace itself, and the cost lands on boot: init() reads and validates every diagram,
on a service at minScale=1 where a boot failure is an outage rather than a slow page.
*/
test('B98: the store refuses past MAX_DIAGRAMS, and refuses before writing anything', async () => {
	const t = await grantable();
	const api = `http://127.0.0.1:${t.app.port}/api/v1/diagrams`;
	try {
		const cap = Number(process.env.MAX_DIAGRAMS) || 500;
		while (t.app.store.total() < cap) {
			assert.equal(t.app.store.create(`filler-${t.app.store.total()}`, null, OWNER).ok, true);
		}
		const res = await fetch(api, { method: 'POST', body: JSON.stringify({ name: 'one too many' }) });
		assert.equal(res.status, 507, 'a full store is not a malformed request — it says so with its own code');
		assert.equal((await res.json()).code, 'diagram-cap');
		assert.equal(t.app.store.total(), cap, 'and the refusal cost nothing: no id minted, no entry added');
	} finally { await t.close(); }
});

/*
Ownership cannot be forged, asserted because a mutant proved it was only claimed.

The route comment said ownership comes from the authenticated principal and never from the body.
Changing it to `body?.owner || principal` failed nothing, so the sentence was doing the work a test
should. Both spellings are covered: a top-level `owner`, and one smuggled inside `doc.meta`, which
is the path `cleanMeta`'s trusted flag exists to close (H9.1) and the one an attacker would reach
for second.
*/
test('H9.21: ownership comes from the identity, and a body cannot override it', async () => {
	const t = await grantable();
	const api = `http://127.0.0.1:${t.app.port}/api/v1/diagrams`;
	try {
		t.as(AGENT);
		const top = await fetch(api, { method: 'POST', body: JSON.stringify({ name: 'a', owner: OWNER }) });
		const a = await top.json();
		assert.equal(a.doc.meta.owner, AGENT, 'a top-level owner in the body is ignored');

		const nested = await fetch(api, {
			method: 'POST',
			body: JSON.stringify({ doc: { meta: { name: 'b', owner: OWNER }, nodes: [], links: [], zones: [], groups: [], waypoints: [] } }),
		});
		const b = await nested.json();
		assert.equal(b.doc.meta.owner, AGENT,
			'and so is one inside doc.meta — cleanMeta refuses an owner off the wire');

		assert.equal(t.app.store.canWrite(a.id, OWNER), false, 'the named victim gained nothing');
		assert.equal(t.app.store.canWrite(b.id, OWNER), false);
	} finally { await t.close(); }
});

/*
First boot in production, where access.json does not exist -- H9.4c.

The absent case is handled by catching the read, and every other test proves that on disk, where a
missing file throws ENOENT. Production is GCS, which throws a different error from a different
place, and "absent" being a THROW rather than an empty answer is a contract this code depends on
without owning. If a backend ever answered a missing object with null instead, JSON.parse would
throw and the catch above it would not be reached: the store would refuse to boot, on first deploy,
for every deployment that has never used a workspace grant. That is worth a test rather than a read
of the adapter.
*/
test('H9.4c: a backend that reports a missing access.json the way GCS does still boots', async () => {
	const asked = [];
	const files = {
		async list() { return []; },
		async read(name) { asked.push(name); throw new Error(`no such object: ${name}`); },
		async write() {}, async remove() {},
	};
	const s = new Store('/nonexistent/gcs-like', { flushMs: 3_600_000, files, authz: true });
	await s.init();
	assert.ok(asked.includes('access.json'), 'it did look for the file — otherwise this proves nothing');
	assert.equal(s.workspace.size, 0, 'and absent means no workspace grants, not a refusal');
	assert.equal(s.total(), 1, 'the store is usable');
});

/*
H9.28/B33 -- a cross-site websocket upgrade is refused.

The gate CORS cannot provide. A handshake has no preflight, so any page may attempt one, and the
browser attaches our cookies to it: the identity boundary would then resolve a real principal for a
request its owner never made. Driven over a live server, because the defect was in the upgrade path
and a unit test of the policy function would not have proven the server consults it.
*/
import { originPolicy } from '../server/origin.mjs';
import { WebSocket } from 'ws';

const dialWs = (port, origin) => new Promise((resolve) => {
	const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, origin ? { origin } : {});
	ws.on('open', () => { ws.close(); resolve('open'); });
	ws.on('error', () => resolve('refused'));
});

test('H9.28: the websocket refuses an origin it does not know, and admits the one that served it', async () => {
	const dataDir = path.join(os.tmpdir(), `draw-origin-${Math.random().toString(36).slice(2)}`);
	const app = await createApp({ dataDir, secretsDir: dataDir, port: 0, authz: true, owner: OWNER,
		principalOf: async () => OWNER });
	try {
		const host = `127.0.0.1:${app.port}`;
		assert.equal(await dialWs(app.port, `http://${host}`), 'open',
			'the editor connects to the host that served it — this must keep working');
		assert.equal(await dialWs(app.port, null), 'open',
			'no Origin is not a browser, and a non-browser carries no victim cookie');
		assert.equal(await dialWs(app.port, 'https://evil.example'), 'refused',
			'a stranger page cannot open a socket that would carry the victim\'s session');
		assert.equal(await dialWs(app.port, 'not a url'), 'refused', 'and an unparseable origin is not trusted');
	} finally {
		await app.close();
		fs.rmSync(dataDir, { recursive: true, force: true });
	}
});

test('H9.28: ALLOW_ORIGINS admits a named origin, and nothing else', async () => {
	const allowed = originPolicy('https://studio.example, https://Other.Example/');
	assert.equal(allowed('https://studio.example', 'draw.apnex.io'), true, 'a listed origin passes');
	assert.equal(allowed('https://other.example', 'draw.apnex.io'), true,
		'case and a trailing slash are normalised, so a configuration typo is not a silent denial');
	assert.equal(allowed('https://evil.example', 'draw.apnex.io'), false, 'an unlisted one does not');
	assert.equal(allowed('https://draw.apnex.io', 'draw.apnex.io'), true, 'same-origin needs no configuration');
	assert.equal(allowed('https://draw.apnex.io.evil.example', 'draw.apnex.io'), false,
		'and a lookalike host is refused — the match is on the parsed host, never a prefix');
});

test('H9.28: no response advertises a wildcard CORS origin', async () => {
	const dataDir = path.join(os.tmpdir(), `draw-cors-${Math.random().toString(36).slice(2)}`);
	const app = await createApp({ dataDir, secretsDir: dataDir, port: 0, authz: true, owner: OWNER,
		principalOf: async () => OWNER });
	try {
		const id = [...app.store.diagrams.keys()][0];
		for (const p of [`/api/v1/diagrams`, `/api/v1/diagrams/${id}`, `/d/${id}.svg`, '/health']) {
			const res = await fetch(`http://127.0.0.1:${app.port}${p}`);
			assert.equal(res.headers.get('access-control-allow-origin'), null,
				`${p} must not answer a wildcard origin`);
		}
	} finally {
		await app.close();
		fs.rmSync(dataDir, { recursive: true, force: true });
	}
});

/*
H9.5 -- connection codes: the credential half of the identity split.

A code is not a principal (H9.4b). It authenticates AS an agent, so rotating or revoking one leaves
everything that agent owns untouched -- which is the whole reason the split was worth making.
*/
import { mintCode as freshCode, formatCode, hashCode } from '../server/codes.mjs';

const codesApi = (t) => `http://127.0.0.1:${t.app.port}/api/v1/workspace/codes`;

test('H9.5: a code is shown once, hashed at rest, and never appears again', async () => {
	const t = await grantable();
	try {
		const res = await fetch(codesApi(t), { method: 'POST', body: JSON.stringify({ agent: AGENT }) });
		assert.equal(res.status, 201);
		const { id, code } = await res.json();
		assert.match(code, /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/,
			'Crockford base32, grouped for transcription');

		const listed = await (await fetch(codesApi(t))).json();
		assert.deepEqual(listed.codes.map((c) => c.id), [id], 'the code is listed by id');
		assert.equal(JSON.stringify(listed).includes(code.replace(/-/g, '')), false,
			'and the plaintext is NOT in the listing');

		const stored = JSON.stringify([...t.app.store.codes]);
		assert.equal(stored.includes(code.replace(/-/g, '')), false, 'nor at rest — only its hash');
		assert.ok(stored.includes(hashCode(code)), 'which is what the store actually holds');
	} finally { await t.close(); }
});

/*
B99 -- the rule without which the whole scheme is theatre.

An agent name is global. If two principals may mint against it, the second obtains a credential
that authenticates as the identity the first granted access to. No check is defective; the rule is
simply absent. Asserted through the surface rather than the store, because the surface is where a
second principal would arrive.
*/
test('B99: the first mint claims the agent, and nobody else may mint against it', async () => {
	const t = await grantable();
	try {
		assert.equal((await fetch(codesApi(t), { method: 'POST', body: JSON.stringify({ agent: AGENT }) })).status, 201);
		assert.equal(t.app.store.claimantOf(AGENT), OWNER, 'the name is claimed by whoever minted first');

		t.as(GUEST);
		const stolen = await fetch(codesApi(t), { method: 'POST', body: JSON.stringify({ agent: AGENT }) });
		assert.equal(stolen.status, 403,
			'a second principal cannot mint a credential for an identity somebody else holds');
		assert.deepEqual((await (await fetch(codesApi(t))).json()).codes, [],
			'and sees none of the claimant\'s codes');

		// a DIFFERENT name is free — the rule constrains impersonation, not participation
		assert.equal((await fetch(codesApi(t), { method: 'POST', body: JSON.stringify({ agent: 'agent:other' }) })).status, 201);
	} finally { await t.close(); }
});

test('H9.5: revoking is per code, so rotation never leaves a window with no valid code', async () => {
	const t = await grantable();
	try {
		const first = await (await fetch(codesApi(t), { method: 'POST', body: JSON.stringify({ agent: AGENT }) })).json();
		const second = await (await fetch(codesApi(t), { method: 'POST', body: JSON.stringify({ agent: AGENT }) })).json();
		assert.equal(t.app.store.codes.size, 2, 'several may coexist — that is what makes rotation seamless');

		const after = await (await fetch(`${codesApi(t)}/${first.id}`, { method: 'DELETE' })).json();
		assert.deepEqual(after.codes.map((c) => c.id), [second.id], 'the old one is gone, the new one stands');

		// and the claim survives, so nobody can acquire the name by waiting out the last code
		await fetch(`${codesApi(t)}/${second.id}`, { method: 'DELETE' });
		assert.equal(t.app.store.codes.size, 0);
		assert.equal(t.app.store.claimantOf(AGENT), OWNER, 'revoking every code does NOT release the name');
	} finally { await t.close(); }
});

test('H9.5: codes survive a restart, and a corrupt file is a boot refusal', async () => {
	const t = await grantable();
	try {
		const { id } = await (await fetch(codesApi(t), { method: 'POST', body: JSON.stringify({ agent: AGENT }) })).json();
		const again = new Store(t.dataDir, { flushMs: 3_600_000, authz: true });
		await again.init();
		assert.deepEqual(again.listCodes(OWNER).map((c) => c.id), [id], 'durable across a restart');
		assert.equal(again.claimantOf(AGENT), OWNER, 'and so is the claim');

		// a code whose agent nobody claims would authenticate as an unowned identity
		fs.writeFileSync(path.join(t.dataDir, 'codes.json'),
			JSON.stringify({ agents: {}, codes: { [hashCode(freshCode())]: { id: 'x', agent: AGENT } } }));
		await assert.rejects(() => new Store(t.dataDir, { flushMs: 3_600_000, authz: true }).init(),
			/unclaimed agent/, 'an orphaned code is refused rather than loaded');
	} finally { await t.close(); }
});

test('H9.5: the alphabet excludes the characters a human confuses, and folds them on input', () => {
	for (let i = 0; i < 200; i++) {
		assert.equal(/[ILOU]/.test(freshCode()), false, 'I, L, O and U never appear — that is the point of Crockford');
	}
	const code = freshCode();
	assert.equal(hashCode(formatCode(code)), hashCode(code), 'the display hyphens are cosmetic');
	assert.equal(hashCode(code.toLowerCase()), hashCode(code), 'and case is folded');
	assert.equal(hashCode('OI' + code.slice(2)), hashCode('01' + code.slice(2)),
		'a code typed with O for 0 and I for 1 still authenticates');
});

/*
H9.6 -- /connect/v1: the door an agent can reach, and the code that opens it.

End to end over HTTP, because every piece of this was individually correct before and the agent
still could not do anything: the grant (H9.4c), the credential (H9.5) and the identity (H9.4b) only
become a capability when a request carrying a code resolves to the agent the grant names.
*/
async function connected() {
	let who = OWNER;
	const dataDir = path.join(os.tmpdir(), `draw-connect-${Math.random().toString(36).slice(2)}`);
	const app = await createApp({ dataDir, secretsDir: dataDir, port: 0, authz: true, owner: OWNER,
		// IAP resolves the human; the bearer source is composed in by createApp itself
		principalOf: async (h) => (h.authorization ? null : who) });
	const id = [...app.store.diagrams.keys()][0];
	const mint = await app.store.mintCode(AGENT, OWNER);
	return { app, dataDir, id, code: mint.code,
		base: `http://127.0.0.1:${app.port}`,
		as: (p) => { who = p; },
		close: async () => { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); } };
}
const bearer = (code) => ({ headers: { authorization: `Bearer ${code}` } });

test('H9.6: a code opens /connect/v1 as the agent it was minted for, and the grant decides', async () => {
	const t = await connected();
	try {
		// no grant yet: the agent authenticates fine and is entitled to nothing
		const before = await (await fetch(`${t.base}/connect/v1/diagrams`, bearer(t.code))).json();
		assert.deepEqual(before, [], 'authenticated, and default-deny still applies');

		await fetch(`${t.base}/api/v1/workspace/grants`, {
			method: 'POST', body: JSON.stringify({ principal: AGENT, level: 'write' }),
		});
		const after = await (await fetch(`${t.base}/connect/v1/diagrams`, bearer(t.code))).json();
		assert.equal(after.length, 1, 'the workspace grant reaches the agent through the code');

		const doc = await fetch(`${t.base}/connect/v1/diagrams/${t.id}`, bearer(t.code));
		assert.equal(doc.status, 200, 'and it can read the diagram');
		assert.equal(t.app.store.canWrite(t.id, AGENT), true, 'with the write the grant gave it');
	} finally { await t.close(); }
});

test('H9.6: a wrong, absent or revoked code is nobody — never an error', async () => {
	const t = await connected();
	try {
		await fetch(`${t.base}/api/v1/workspace/grants`, {
			method: 'POST', body: JSON.stringify({ principal: AGENT, level: 'write' }),
		});
		t.as(null);   // no IAP identity either, so the code is the only thing that can speak

		assert.deepEqual(await (await fetch(`${t.base}/connect/v1/diagrams`, bearer('WRONGWRONGWRONG1'))).json(), [],
			'a wrong code is nobody, not a 500');
		assert.deepEqual(await (await fetch(`${t.base}/connect/v1/diagrams`)).json(), [],
			'and no header at all is nobody');
		assert.equal((await fetch(`${t.base}/connect/v1/diagrams/${t.id}`, bearer('WRONGWRONGWRONG1'))).status, 403);

		assert.equal((await (await fetch(`${t.base}/connect/v1/diagrams`, bearer(t.code))).json()).length, 1, 'the real one works');
		const [live] = t.app.store.listCodes(OWNER);
		await t.app.store.revokeCode(live.id, OWNER);
		assert.deepEqual(await (await fetch(`${t.base}/connect/v1/diagrams`, bearer(t.code))).json(), [],
			'and stops the moment it is revoked — no restart, no sweep');
	} finally { await t.close(); }
});

test('H9.6: an expired code stops working at the instant it lapses', async () => {
	const t = await connected();
	try {
		const past = new Date(Date.now() - 1000).toISOString();
		const r = await t.app.store.mintCode('agent:temp', OWNER, { expires: past });
		assert.equal(r.ok, true);
		assert.equal(t.app.store.agentForCode(r.code), null, 'checked on presentation, not by a sweep');
		assert.equal(t.app.store.agentForCode(t.code), AGENT, 'and an unexpired one is unaffected');
	} finally { await t.close(); }
});

/*
The prefix authorizes nothing, which is what makes routing a path around IAP safe.

If `/connect` were a privilege rather than a door, a load-balancer mistake would be a breach. It is
not: authentication happens before the router and authorization after it, on the principal alone.
*/
test('H9.6: /connect/v1 grants nothing by itself, and is the same surface as /api/v1', async () => {
	const t = await connected();
	try {
		t.as(null);
		for (const p of ['/connect/v1/diagrams/' + t.id, '/api/v1/diagrams/' + t.id]) {
			assert.equal((await fetch(t.base + p)).status, 403, `${p} refuses an unauthenticated caller`);
		}
		// and the same request, through either door, gets the same answer
		t.as(OWNER);
		const viaApi = await (await fetch(`${t.base}/api/v1/diagrams/${t.id}`)).json();
		t.as(null);
		await fetch(`${t.base}/api/v1/workspace/grants`, { method: 'POST', body: JSON.stringify({ principal: AGENT, level: 'read' }) })
			.catch(() => {});
		t.as(OWNER);
		await fetch(`${t.base}/api/v1/workspace/grants`, { method: 'POST', body: JSON.stringify({ principal: AGENT, level: 'read' }) });
		t.as(null);
		const viaConnect = await (await fetch(`${t.base}/connect/v1/diagrams/${t.id}`, bearer(t.code))).json();
		assert.deepEqual(viaConnect, viaApi, 'one implementation behind both prefixes');
	} finally { await t.close(); }
});

/*
Bearer only, asserted because a mutant proved it was only claimed.

ACCESS.md rules out a query parameter and the reason is specific: query strings are logged by
proxies, kept in browser history and pasted into bug reports, so a credential in one has already
leaked. Accepting a second channel "for convenience" is how that happens, and a comment saying so
stops nobody. Widening `bearerIdentity` to read a custom header failed no test until this one.
*/
test('H9.6: a code is honoured ONLY as a Bearer token, never a query or a stray header', async () => {
	const t = await connected();
	try {
		await fetch(`${t.base}/api/v1/workspace/grants`, {
			method: 'POST', body: JSON.stringify({ principal: AGENT, level: 'write' }),
		});
		t.as(null);
		const plain = t.code.replace(/-/g, '');
		const denied = [
			[`/connect/v1/diagrams?code=${plain}`, {}],
			[`/connect/v1/diagrams?access_token=${plain}`, {}],
			['/connect/v1/diagrams', { headers: { 'x-code': plain } }],
			['/connect/v1/diagrams', { headers: { 'x-api-key': plain } }],
			['/connect/v1/diagrams', { headers: { authorization: plain } }],
			['/connect/v1/diagrams', { headers: { authorization: `Token ${plain}` } }],
		];
		for (const [p, init] of denied) {
			assert.deepEqual(await (await fetch(t.base + p, init)).json(), [],
				`${p} ${JSON.stringify(init.headers || {})} must not authenticate`);
		}
		assert.equal((await (await fetch(`${t.base}/connect/v1/diagrams`, bearer(t.code))).json()).length, 1,
			'and the one supported channel still works — otherwise this passes for the wrong reason');
	} finally { await t.close(); }
});

/*
B100 -- what an agent creates belongs to whoever authorised the agent.

The director drew a diagram through /connect/v1 on the live deployment and then could not see it:
owned by `agent:planner` with no grants, so it was filtered out of their listing, refused as a
document, and refused as an SVG. Work nobody could reach, in a bucket they owned. ACCESS.md
required access in BOTH directions and only the human-to-agent half was built.

Ruled as ownership rather than a reciprocal grant, and the tests below are written against the
reason for that rather than the mechanism: a grant would have left the agent owning the diagram
and therefore holding its access list.
*/
test('B100: a diagram an agent creates is owned by the human who claimed the agent', async () => {
	const t = await connected();
	try {
		await t.app.store.grantOwner(OWNER, AGENT, 'write');
		const made = await fetch(`${t.base}/connect/v1/diagrams`, {
			method: 'POST', ...bearer(t.code),
			headers: { ...bearer(t.code).headers, 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'agent-made' }),
		});
		assert.equal(made.status, 201);
		const { id, doc } = await made.json();

		assert.equal(doc.meta.owner, OWNER, 'the claimant owns it, not the agent that made it');
		assert.equal(doc.meta.grants[AGENT], 'write', 'and the agent keeps write on its own work');

		// the symptom, stated as the director met it: can the human SEE it
		const listed = (await (await fetch(`${t.base}/api/v1/diagrams`)).json()).map((d) => d.id);
		assert.ok(listed.includes(id), 'it appears in the human listing -- this is the whole defect');
		assert.equal((await fetch(`${t.base}/api/v1/diagrams/${id}`)).status, 200, 'and reads');
		assert.equal((await fetch(`${t.base}/d/${id}.svg`)).status, 200, 'and renders');

		// and the agent has not been locked out of what it just made
		assert.equal((await fetch(`${t.base}/connect/v1/diagrams/${id}`, bearer(t.code))).status, 200);
	} finally { await t.close(); }
});

test('B100: the human OWNS it, so the human can revoke the agent from it', async () => {
	/*
	This is why the ruling was ownership and not a reciprocal grant. Under a grant the agent would
	still have owned the diagram, so this revoke would have been the instrument overruling the
	person who authorised it -- and the human could not have cut access to work done on their
	behalf, on their own deployment.
	*/
	const t = await connected();
	try {
		const made = await fetch(`${t.base}/connect/v1/diagrams`, {
			method: 'POST', ...bearer(t.code),
			headers: { ...bearer(t.code).headers, 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'agent-made' }),
		});
		const { id } = await made.json();
		assert.equal((await fetch(`${t.base}/connect/v1/diagrams/${id}`, bearer(t.code))).status, 200);

		const cut = await fetch(`${t.base}/api/v1/diagrams/${id}/grants/${encodeURIComponent(AGENT)}`,
			{ method: 'DELETE' });
		assert.equal(cut.status, 200, 'the owner may revoke -- and the owner is the human');

		const after = await fetch(`${t.base}/connect/v1/diagrams/${id}`, bearer(t.code));
		assert.equal(after.status, 403, 'the agent is out of the diagram it created');
	} finally { await t.close(); }
});

test('B100: a human creating a diagram still owns it outright, with no grant to anyone', async () => {
	// ownerFor must be identity for a non-agent principal: no claim exists, so nothing resolves
	const t = await connected();
	try {
		const made = await fetch(`${t.base}/api/v1/diagrams`, {
			method: 'POST', headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'human-made' }),
		});
		const { doc } = await made.json();
		assert.equal(doc.meta.owner, OWNER);
		assert.deepEqual(doc.meta.grants, {}, 'no self-grant, and nobody else added');
	} finally { await t.close(); }
});
