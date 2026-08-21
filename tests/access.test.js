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
