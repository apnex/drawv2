/*
Server-Locked control plane: the sovereign Locks state machine (unit, with an
injected clock) + the REST write surface end-to-end against a real server.
*/

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Locks } from '../server/locks.js';
import http from 'node:http';
import WebSocket from 'ws';
import { createApp } from '../server/app.js';

// ---- Locks unit (injected clock, no timers) ----

test('Locks: acquire mints a token and marks locked', () => {
	const locks = new Locks();
	assert.equal(locks.locked('d1'), false);
	const a = locks.acquire('d1');
	assert.ok(a.token && a.expiresAt);
	assert.equal(locks.locked('d1'), true);
});

test('Locks: a second acquire is refused while held', () => {
	const locks = new Locks();
	locks.acquire('d1');
	assert.equal(locks.acquire('d1'), null);
});

test('Locks: verify only accepts the live holder token', () => {
	const locks = new Locks();
	const { token } = locks.acquire('d1');
	assert.equal(locks.verify('d1', token), true);
	assert.equal(locks.verify('d1', 'wrong'), false);
	assert.equal(locks.verify('d1', ''), false);
	assert.equal(locks.verify('d2', token), false);
});

test('Locks: TTL expiry frees the lock (lazy) and lets re-acquire', () => {
	let now = 1000;
	const locks = new Locks({ ttlMs: 100, now: () => now });
	const { token } = locks.acquire('d1');
	now = 1050;
	assert.equal(locks.locked('d1'), true);   // still inside TTL
	now = 1101;
	assert.equal(locks.locked('d1'), false);  // lapsed
	assert.equal(locks.verify('d1', token), false);
	assert.ok(locks.acquire('d1'));           // a fresh controller can take it
});

test('Locks: heartbeat extends the TTL for the holder only', () => {
	let now = 0;
	const locks = new Locks({ ttlMs: 100, now: () => now });
	const { token } = locks.acquire('d1');
	now = 90;
	assert.equal(locks.heartbeat('d1', token), true);  // refreshes to now+100 = 190
	assert.equal(locks.heartbeat('d1', 'wrong'), false);
	now = 150;
	assert.equal(locks.locked('d1'), true);   // would have lapsed at 100 without the beat
});

test('Locks: release needs the token; reclaim is unconditional', () => {
	const locks = new Locks();
	const { token } = locks.acquire('d1');
	assert.equal(locks.release('d1', 'wrong'), false);
	assert.equal(locks.release('d1', token), true);
	assert.equal(locks.locked('d1'), false);
	// reclaim drops any lock with no token (the human override)
	locks.acquire('d1');
	locks.reclaim('d1');
	assert.equal(locks.locked('d1'), false);
});

test('Locks: sweep removes lapsed locks and reports their ids', () => {
	let now = 0;
	const locks = new Locks({ ttlMs: 100, now: () => now });
	locks.acquire('a'); locks.acquire('b');
	now = 200;
	const swept = locks.sweep().sort();
	assert.deepEqual(swept, ['a', 'b']);
	assert.equal(locks.locked('a'), false);
});

test('Locks: a lapsed lock reads free but survives for sweep to report (no strand race)', () => {
	// reading the lock as free must NOT delete it — otherwise sweep returns []
	// and viewers are never told a crashed controller's lock has freed
	let now = 0;
	const locks = new Locks({ ttlMs: 100, now: () => now });
	locks.acquire('a');
	now = 200;
	assert.equal(locks.locked('a'), false);  // a viewer's snapshot reads it free
	assert.equal(locks.verify('a', 'x'), false);
	assert.deepEqual(locks.sweep(), ['a']);  // still reported, so owner:client broadcasts
});

// ---- REST write surface end-to-end ----

let app, dataDir, base;
const H = (token) => ({ 'Content-Type': 'application/json', ...(token ? { 'X-Draw-Lock': token } : {}) });

before(async () => {
	dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-lock-'));
	app = await createApp({ dataDir, secretsDir: dataDir, port: 0 });
	base = `http://127.0.0.1:${app.port}`;
});
after(async () => {
	await app.close();
	fs.rmSync(dataDir, { recursive: true, force: true });
});

const did = async () => (await (await fetch(`${base}/api/v1/diagrams`)).json())[0].id;

test('REST: writes are refused until the lock is acquired (423)', async () => {
	const id = await did();
	const r = await fetch(`${base}/api/v1/diagrams/${id}/nodes`, {
		method: 'POST', headers: H(), body: JSON.stringify({ type: 'host', x: 60, y: 60 })
	});
	assert.equal(r.status, 423);
});

test('REST: lock → apply (low-level) → release round-trip', async () => {
	const id = await did();
	const lock = await (await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'POST' })).json();
	assert.ok(lock.token);

	// a second controller cannot acquire
	const second = await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'POST' });
	assert.equal(second.status, 409);

	const before = (await (await fetch(`${base}/api/v1/diagrams/${id}/nodes`)).json()).length;
	const r = await fetch(`${base}/api/v1/diagrams/${id}/commit`, {
		method: 'POST', headers: H(lock.token),
		body: JSON.stringify({ ops: [{ op: 'put', kind: 'node',
			entity: { id: 'node-abc123', name: 'srv', type: 'server', x: 120, y: 120 } }] })
	});
	assert.equal(r.status, 200);
	const after = (await (await fetch(`${base}/api/v1/diagrams/${id}/nodes`)).json()).length;
	assert.equal(after, before + 1);

	const rel = await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'DELETE', headers: H(lock.token) });
	assert.equal(rel.status, 200);
	// writes refused again after release
	assert.equal((await fetch(`${base}/api/v1/diagrams/${id}/commit`, {
		method: 'POST', headers: H(lock.token), body: JSON.stringify({ ops: [{ op: 'put', kind: 'node', entity: {} }] })
	})).status, 423);
});

test('REST: a write with a wrong/absent token is 403', async () => {
	const id = await did();
	const lock = await (await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'POST' })).json();
	try {
		assert.equal((await fetch(`${base}/api/v1/diagrams/${id}/nodes`, {
			method: 'POST', headers: H('bogus'), body: JSON.stringify({ type: 'host', x: 0, y: 0 })
		})).status, 403);
		assert.equal((await fetch(`${base}/api/v1/diagrams/${id}/nodes`, {
			method: 'POST', headers: H(), body: JSON.stringify({ type: 'host', x: 0, y: 0 })
		})).status, 403);
	} finally {
		await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'DELETE', headers: H(lock.token) });
	}
});

test('REST: high-level verbs create / patch / delete a node', async () => {
	const id = await did();
	const lock = await (await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'POST' })).json();
	try {
		// create
		const c = await fetch(`${base}/api/v1/diagrams/${id}/nodes`, {
			method: 'POST', headers: H(lock.token), body: JSON.stringify({ type: 'router', x: -60, y: 0 })
		});
		assert.equal(c.status, 200);
		const newId = (await c.json()).id;
		assert.ok(newId.startsWith('node-'));
		let node = await (await fetch(`${base}/api/v1/diagrams/${id}/nodes/${newId}`)).json();
		assert.equal(node.x, -60);

		// patch
		const p = await fetch(`${base}/api/v1/diagrams/${id}/nodes/${newId}`, {
			method: 'PATCH', headers: H(lock.token), body: JSON.stringify({ x: 120, y: 60 })
		});
		assert.equal(p.status, 200);
		node = await (await fetch(`${base}/api/v1/diagrams/${id}/nodes/${newId}`)).json();
		assert.equal(node.x, 120);
		assert.equal(node.y, 60);

		// delete
		const d = await fetch(`${base}/api/v1/diagrams/${id}/nodes/${newId}`, {
			method: 'DELETE', headers: H(lock.token)
		});
		assert.equal(d.status, 200);
		assert.equal((await fetch(`${base}/api/v1/diagrams/${id}/nodes/${newId}`)).status, 404);
	} finally {
		await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'DELETE', headers: H(lock.token) });
	}
});

test('REST: an acked write is already on disk (flush-before-ack — no debounce window)', async () => {
	const id = await did();
	const lock = await (await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'POST' })).json();
	try {
		const c = await fetch(`${base}/api/v1/diagrams/${id}/nodes`, {
			method: 'POST', headers: H(lock.token), body: JSON.stringify({ type: 'host', x: 300, y: -480 })
		});
		assert.equal(c.status, 200);
		const newId = (await c.json()).id;
		// read disk IMMEDIATELY — no sleep. A one-shot REST/agentic caller has no re-push backstop,
		// so the ack must mean durable: without flush-before-ack this node would still be in the
		// ~200ms debounce window and absent from disk here.
		const onDisk = JSON.parse(fs.readFileSync(path.join(dataDir, `${id}.json`), 'utf8'));
		assert.ok(onDisk.nodes.some((n) => n.id === newId), 'acked REST write is on disk before any debounce flush');
	} finally {
		await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'DELETE', headers: H(lock.token) });
	}
});

test('REST: node shape is settable on create + patch (independent of type); bad shape is 422', async () => {
	const id = await did();
	const lock = await (await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'POST' })).json();
	try {
		// create a square node
		const c = await fetch(`${base}/api/v1/diagrams/${id}/nodes`, {
			method: 'POST', headers: H(lock.token), body: JSON.stringify({ type: 'host', shape: 'square', x: 0, y: 60 })
		});
		assert.equal(c.status, 200);
		const newId = (await c.json()).id;
		let node = await (await fetch(`${base}/api/v1/diagrams/${id}/nodes/${newId}`)).json();
		assert.equal(node.shape, 'square');

		// reframe via PATCH — the glyph (type) is untouched
		const p = await fetch(`${base}/api/v1/diagrams/${id}/nodes/${newId}`, {
			method: 'PATCH', headers: H(lock.token), body: JSON.stringify({ shape: 'circle' })
		});
		assert.equal(p.status, 200);
		node = await (await fetch(`${base}/api/v1/diagrams/${id}/nodes/${newId}`)).json();
		assert.equal(node.shape, 'circle');
		assert.equal(node.type, 'host');

		// an unknown shape is refused
		const bad = await fetch(`${base}/api/v1/diagrams/${id}/nodes`, {
			method: 'POST', headers: H(lock.token), body: JSON.stringify({ type: 'host', shape: 'triangle', x: 0, y: 120 })
		});
		assert.equal(bad.status, 422);
	} finally {
		await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'DELETE', headers: H(lock.token) });
	}
});

test('REST: an invalid mutation is rejected (422) and persists nothing', async () => {
	const id = await did();
	const lock = await (await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'POST' })).json();
	try {
		const before = (await (await fetch(`${base}/api/v1/diagrams/${id}/nodes`)).json()).length;
		const r = await fetch(`${base}/api/v1/diagrams/${id}/nodes`, {
			method: 'POST', headers: H(lock.token), body: JSON.stringify({ type: 'host', x: 99999, y: 0 })
		});
		assert.equal(r.status, 422); // off-canvas → validation refuses
		const after = (await (await fetch(`${base}/api/v1/diagrams/${id}/nodes`)).json()).length;
		assert.equal(after, before);
	} finally {
		await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'DELETE', headers: H(lock.token) });
	}
});

test('REST: a malformed group body is refused, not a crash (server stays up)', async () => {
	const id = await did();
	const lock = await (await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'POST' })).json();
	try {
		// non-iterable members would throw in makeGroup's spread — must be guarded
		const r = await fetch(`${base}/api/v1/diagrams/${id}/groups`, {
			method: 'POST', headers: H(lock.token), body: JSON.stringify({ members: 5 })
		});
		assert.ok(r.status === 422 || r.status === 500, `got ${r.status}`);
		// the server is still alive and serving afterward
		assert.equal((await fetch(`${base}/health`)).status, 200);
		// the low-level apply path is guarded by validation too
		const r2 = await fetch(`${base}/api/v1/diagrams/${id}/commit`, {
			method: 'POST', headers: H(lock.token),
			body: JSON.stringify({ ops: [{ op: 'put', kind: 'group', entity: { id: 'group-aaaaaa', name: 'g', members: 7 } }] })
		});
		assert.equal(r2.status, 422);
		assert.equal((await fetch(`${base}/health`)).status, 200);
	} finally {
		await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'DELETE', headers: H(lock.token) });
	}
});

test('REST: a write whose token was released mid-flight is refused at commit', async () => {
	// commitWrite re-verifies the token (closes the read-body TOCTOU window)
	const id = await did();
	const lock = await (await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'POST' })).json();
	// release the lock, THEN apply with the now-stale token: must be refused (423)
	await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'DELETE', headers: H(lock.token) });
	const before = (await (await fetch(`${base}/api/v1/diagrams/${id}/nodes`)).json()).length;
	const r = await fetch(`${base}/api/v1/diagrams/${id}/commit`, {
		method: 'POST', headers: H(lock.token),
		body: JSON.stringify({ ops: [{ op: 'put', kind: 'node', entity: { id: 'node-zzzzzz', name: 'x', type: 'host', x: 0, y: 0 } }] })
	});
	assert.equal(r.status, 423);
	const after = (await (await fetch(`${base}/api/v1/diagrams/${id}/nodes`)).json()).length;
	assert.equal(after, before);
});

test('REST: lock + apply persists to disk (survives via the store)', async () => {
	const id = await did();
	const lock = await (await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'POST' })).json();
	await fetch(`${base}/api/v1/diagrams/${id}/zones`, {
		method: 'POST', headers: H(lock.token), body: JSON.stringify({ x: -90, y: -90, w: 180, h: 120 })
	});
	await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'DELETE', headers: H(lock.token) });
	await app.store.flushAll();
	const onDisk = JSON.parse(fs.readFileSync(path.join(dataDir, `${id}.json`), 'utf8'));
	assert.ok(onDisk.zones.some((z) => z.w === 180 && z.h === 120));
});

/*
B24 — the body reader must always settle, and must not corrupt what it reads.

Three defects lived in five lines of `readJson`:

  (1) On the size trip it called `req.destroy()` and resolved NOTHING. `'end'` does not fire on a
      destroyed request and `'error'` is not guaranteed, so the promise never settled, the `await`
      in handleWrite never continued, and the closure leaked. A7's named `Blocked Actor` — an actor
      paused indefinitely with no resume path — and the router's `.catch()` could not fire, because
      nothing ever rejected.
  (2) `buf += chunk` decodes each Buffer independently, so a multibyte character split across a
      chunk boundary becomes U+FFFD. A CJK node name landing near a chunk edge is silently mangled.
  (3) The cap counted decoded CHARACTERS, not bytes.

A destroyed socket is also not an actionable signal (A7): the caller cannot tell "too large" from
"the network died", so it cannot know whether to retry or to shrink. Oversize now answers 413.
*/
test('B24: an oversize body answers 413 instead of hanging the request forever', async () => {
	const id = await did();
	const lock = await (await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'POST' })).json();
	try {
		const huge = JSON.stringify({ type: 'host', x: 60, y: 60, name: 'x'.repeat(2 * 1024 * 1024) });
		const answered = await Promise.race([
			fetch(`${base}/api/v1/diagrams/${id}/nodes`, { method: 'POST', headers: H(lock.token), body: huge })
				.then((r) => r.status).catch((e) => `threw:${e.cause?.code || e.name}`),
			new Promise((r) => setTimeout(() => r('HUNG'), 4000)),
		]);
		assert.notEqual(answered, 'HUNG', 'the request never settled — the promise leaked');
		assert.equal(answered, 413, 'and it says WHY, so the caller knows to shrink rather than retry');
	} finally {
		await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'DELETE', headers: H(lock.token) });
	}
});

test('B24: a multibyte name split across chunk boundaries is not mangled', async () => {
	const id = await did();
	const lock = await (await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'POST' })).json();
	try {
		// The low-level /commit verb, because POST /nodes MINTS the name server-side and would
		// never carry the string under test. And the split is DELIBERATE rather than left to a
		// 64 KiB boundary: we cut one 3-byte character in half across two socket writes, which is
		// the exact condition `buf += chunk` decoded to U+FFFD.
		const name = '設計図';
		const payload = Buffer.from(JSON.stringify({ ops: [{ op: 'put', kind: 'node',
			entity: { id: 'node-c24001', name, type: 'host', shape: 'circle', x: 180, y: 180 } }] }), 'utf8');
		const mid = payload.indexOf(Buffer.from('設', 'utf8')) + 1;   // one byte into a 3-byte character
		assert.ok(mid > 1 && mid < payload.length, 'the split lands inside a multibyte character');

		const status = await new Promise((resolve, reject) => {
			const r = http.request(`${base}/api/v1/diagrams/${id}/commit`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'X-Draw-Lock': lock.token, 'Content-Length': payload.length }
			}, (rs) => { rs.resume(); rs.on('end', () => resolve(rs.statusCode)); });
			r.on('error', reject);
			r.write(payload.subarray(0, mid));            // first half of the character
			setTimeout(() => r.end(payload.subarray(mid)), 20);   // second half, a separate 'data' event
		});
		assert.equal(status, 200, 'the write was accepted');

		const node = await (await fetch(`${base}/api/v1/diagrams/${id}/nodes/node-c24001`)).json();
		assert.equal(node.name, name, 'the name survived the split intact');
		assert.ok(!node.name.includes('\uFFFD'), 'no replacement characters');
	} finally {
		await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'DELETE', headers: H(lock.token) });
	}
});

/*
H4a — `expect` on REST forward writes (B16), and the reversal payload (B17).

D14 makes `expect` optional on forward writes and mandatory on undo/redo. On REST it was neither:
`commitWrite` built `{ops, label}` and discarded everything else, so a body `expect` was **silently
ignored**. An agent believing it held a compare-and-swap held nothing, and would overwrite another
writer's change while thinking it was protected. Low likelihood today (the CLI is read-only and the
browser uses the websocket), high consequence the moment a second writer exists.

It travels as a HEADER, not a body key, because a forward write's body IS an entity payload —
`POST /nodes -d '{"type":"host"}'` — and a reserved `expect` key there would collide with field
validation. undo/redo keep the body form: their body is control, not payload. One statable rule:
control fields ride the body only where the body is control.
*/

const withExpect = (token, expect) => ({ ...H(token), ...(expect === undefined ? {} : { 'X-Draw-Expect': String(expect) }) });

test('B16: a matching X-Draw-Expect lets the write through', async () => {
	const id = await did();
	const lock = await (await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'POST' })).json();
	try {
		const v = (await (await fetch(`${base}/api/v1/diagrams/${id}`)).json()).meta.version;
		const r = await fetch(`${base}/api/v1/diagrams/${id}/nodes`, {
			method: 'POST', headers: withExpect(lock.token, v), body: JSON.stringify({ type: 'host', x: 60, y: 60 }) });
		assert.equal(r.status, 200);
	} finally { await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'DELETE', headers: H(lock.token) }); }
});

test('B16: a STALE X-Draw-Expect is refused, and writes nothing', async () => {
	const id = await did();
	const lock = await (await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'POST' })).json();
	try {
		const before = await (await fetch(`${base}/api/v1/diagrams/${id}`)).json();
		const r = await fetch(`${base}/api/v1/diagrams/${id}/nodes`, {
			method: 'POST', headers: withExpect(lock.token, before.meta.version - 1), body: JSON.stringify({ type: 'host', x: 120, y: 120 }) });
		assert.equal(r.status, 409, 'a stale precondition is a conflict, not a silent success');

		const after = await (await fetch(`${base}/api/v1/diagrams/${id}`)).json();
		assert.equal(after.meta.version, before.meta.version, 'I1 — a rejected write changes nothing');
		assert.equal(after.nodes.length, before.nodes.length);
	} finally { await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'DELETE', headers: H(lock.token) }); }
});

test('B16: no X-Draw-Expect still writes — it is OPTIONAL on forward writes (D14)', async () => {
	const id = await did();
	const lock = await (await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'POST' })).json();
	try {
		const r = await fetch(`${base}/api/v1/diagrams/${id}/nodes`, {
			method: 'POST', headers: H(lock.token), body: JSON.stringify({ type: 'host', x: 360, y: -480 }) });
		assert.equal(r.status, 200, 'a curl one-liner must still work');
	} finally { await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'DELETE', headers: H(lock.token) }); }
});

test('B17: the REST reversal payload carries undoTop, like the websocket one', async () => {
	const id = await did();
	const lock = await (await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'POST' })).json();
	try {
		await fetch(`${base}/api/v1/diagrams/${id}/nodes`, { method: 'POST', headers: H(lock.token), body: JSON.stringify({ type: 'host', x: 240, y: 240 }) });
		const v = (await (await fetch(`${base}/api/v1/diagrams/${id}`)).json()).meta.version;
		const r = await fetch(`${base}/api/v1/diagrams/${id}/undo`, {
			method: 'POST', headers: H(lock.token), body: JSON.stringify({ expect: v }) });
		const body = await r.json();
		assert.equal(r.status, 200);
		assert.ok('undoTop' in body, 'a viewer needs undoTop to keep its "undo all N by <actor>" affordance current');
	} finally { await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'DELETE', headers: H(lock.token) }); }
});

/*
H4b — /commit speaks the transaction vocabulary (B16), and selection is an event (B34).

/commit was named for the websocket's `commit` and documented as "the transaction vocabulary the
websocket uses", but it took a single legacy `{action, kind, entity}` mutation. Two consequences:
the ws shape `{ops:[…]}` answered 422, and MULTI-OP TRANSACTIONS were unreachable over REST — an
agent had to issue N round trips, each one a window another writer could interleave, which is the
exact hazard `undo {to}` exists to mitigate.

Replaced, not aliased. X1's own words: "the old path is gone rather than aliased, because an alias
is a second surface to keep true."
*/

test('B16: POST /commit takes {ops} — the vocabulary the websocket uses', async () => {
	const id = await did();
	const lock = await (await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'POST' })).json();
	try {
		const r = await fetch(`${base}/api/v1/diagrams/${id}/commit`, {
			method: 'POST', headers: H(lock.token),
			body: JSON.stringify({ ops: [{ op: 'put', kind: 'node', entity: { id: 'node-c0de01', name: 'n', type: 'host', shape: 'circle', x: 300, y: 300 } }], label: 'create node' }) });
		assert.equal(r.status, 200);
		assert.equal((await r.json()).label, 'create node');
	} finally { await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'DELETE', headers: H(lock.token) }); }
});

test('B16: a multi-op transaction is ONE change and ONE version bump', async () => {
	const id = await did();
	const lock = await (await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'POST' })).json();
	try {
		const before = (await (await fetch(`${base}/api/v1/diagrams/${id}`)).json()).meta.version;
		const ops = [
			{ op: 'put', kind: 'node', entity: { id: 'node-c0de02', name: 'a', type: 'host', shape: 'circle', x: 360, y: 0 } },
			{ op: 'put', kind: 'node', entity: { id: 'node-c0de03', name: 'b', type: 'host', shape: 'circle', x: 420, y: 0 } },
			{ op: 'put', kind: 'link', entity: { id: 'link-c0de04', src: 'node-c0de02', dst: 'node-c0de03' } },
		];
		const r = await fetch(`${base}/api/v1/diagrams/${id}/commit`, {
			method: 'POST', headers: H(lock.token), body: JSON.stringify({ ops, label: 'wire pair' }) });
		assert.equal(r.status, 200);
		const body = await r.json();
		assert.equal(body.ops.length, 3, 'three ops travelled as one transaction');
		assert.equal(body.version, before + 1, 'one version bump, not three — no window for an interleave');
	} finally { await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'DELETE', headers: H(lock.token) }); }
});

test('B16: the legacy {action,kind,entity} shape is REFUSED, not silently aliased', async () => {
	const id = await did();
	const lock = await (await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'POST' })).json();
	try {
		const r = await fetch(`${base}/api/v1/diagrams/${id}/commit`, {
			method: 'POST', headers: H(lock.token),
			body: JSON.stringify({ action: 'put', kind: 'node', entity: { id: 'node-c0de05', name: 'x', type: 'host', shape: 'circle', x: 0, y: 0 } }) });
		assert.equal(r.status, 400, 'an alias is a second surface to keep true (X1)');
		assert.equal((await r.json()).code, 'ops-required');
	} finally { await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'DELETE', headers: H(lock.token) }); }
});

test('B34: setting the selection over REST broadcasts a selection EVENT, not the whole document', async () => {
	// Observed through a real websocket client, so this exercises the actual fan-out rather than a
	// stubbed hub. Selection is the highest-frequency, lowest-information write in the system: an
	// agent sweeping focus used to re-transmit the entire document per step (A12 Projection, not
	// dump). D7 had already ruled the server broadcasts a change, not a snapshot; this was the one
	// write path that never got the memo.
	const id = await did();
	const lock = await (await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'POST' })).json();
	const ws = new WebSocket(`ws://127.0.0.1:${app.port}/ws`);
	const seen = [];
	await new Promise((r) => ws.on('open', r));
	ws.on('message', (d) => seen.push(JSON.parse(d.toString())));
	ws.send(JSON.stringify({ cmd: 'hello', body: { diagram: id } }));
	await new Promise((r) => setTimeout(r, 120));
	seen.length = 0;
	try {
		const nodes = await (await fetch(`${base}/api/v1/diagrams/${id}/nodes`)).json();
		const ids = nodes.slice(0, 1).map((n) => n.id);
		const r = await fetch(`${base}/api/v1/diagrams/${id}/selection`, {
			method: 'PUT', headers: H(lock.token), body: JSON.stringify({ ids }) });
		assert.equal(r.status, 200);
		await new Promise((res) => setTimeout(res, 120));

		assert.deepEqual(seen.map((m) => m.cmd), ['selection'], 'one lean event, not a document');
		assert.deepEqual(seen[0].body.ids, ids);
		assert.ok(seen[0].body.actor, 'and it says WHO — a viewer watching an agent needs attribution');
	} finally {
		ws.close();
		await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'DELETE', headers: H(lock.token) });
	}
});

/*
B102: `expiresAt` must read a LIVE lock, not the map.

A lapsed lock stays in the map until the sweep runs, and the sweep's cadence is deliberately not
load-bearing anywhere else -- `_live` is what makes that true. Reading the map directly would work
in every test that releases cleanly and report a stale instant exactly when an agent is waiting on
it, which is the only situation this field exists for.
*/
test('B102: expiresAt reports null for a lapsed lock the sweep has not collected', () => {
	let now = 1000;
	const locks = new Locks({ ttlMs: 100, now: () => now });
	const got = locks.acquire('diagram-aaaaaa');
	assert.equal(locks.expiresAt('diagram-aaaaaa'), got.expiresAt, 'held: the instant it lapses');
	assert.equal(locks.expiresAt('diagram-aaaaaa'), 1100);

	now = 1101;                                   // lapsed, and nothing has swept it
	assert.equal(locks.locked('diagram-aaaaaa'), false, 'no longer held');
	assert.equal(locks.expiresAt('diagram-aaaaaa'), null,
		'a lapsed lock has no expiry to wait for -- reporting one would strand the waiter');
});

test('B102: expiresAt is null for a diagram that was never locked', () => {
	const locks = new Locks();
	assert.equal(locks.expiresAt('diagram-bbbbbb'), null);
});

/*
B105 -- `activity()` is what the agent indicator reads, so it must report WHO and must forget.

Both halves survived a mutant against the REST tests: authorization is off there, so `principal` is
null either way and dropping it changed nothing observable, and nothing exercised a lapsed lock.
*/
test('B105: activity names the principal holding each lock', () => {
	const locks = new Locks();
	locks.acquire('diagram-aa0001', 'agent:planner');
	locks.acquire('diagram-aa0002', 'agent:scribe');
	const seen = locks.activity();
	assert.deepEqual(seen.map((a) => [a.principal, a.diagram]).sort(),
		[['agent:planner', 'diagram-aa0001'], ['agent:scribe', 'diagram-aa0002']]);
	assert.ok(seen.every((a) => typeof a.since === 'number' && typeof a.expiresAt === 'number'));
});

test('B105: an unnamed holder is reported as null, not omitted', () => {
	// authorization off: there IS no principal, and a blank indicator in the configuration a single
	// operator runs would be the whole feature missing
	const locks = new Locks();
	locks.acquire('diagram-aa0001');
	assert.deepEqual(locks.activity().map((a) => a.principal), [null]);
});

test('B105: a lapsed lock leaves activity without anything noticing the agent died', () => {
	let now = 1000;
	const locks = new Locks({ ttlMs: 100, now: () => now });
	locks.acquire('diagram-aa0001', 'agent:planner');
	assert.equal(locks.activity().length, 1);

	now = 1101;                                   // lapsed, and no sweep has run
	assert.deepEqual(locks.activity(), [],
		'derived from the live locks, so an abandoned one stops being reported by itself');
});

test('B105: activity is ordered by when each lock was taken', () => {
	let now = 1000;
	const locks = new Locks({ now: () => now });
	locks.acquire('diagram-aa0002', 'agent:second');
	now = 2000;
	locks.acquire('diagram-aa0001', 'agent:first');
	assert.deepEqual(locks.activity().map((a) => a.diagram), ['diagram-aa0002', 'diagram-aa0001'],
		'oldest first: a stable order beats whichever the Map happens to hold');
});

/*
B115 -- a lock that LAPSES must tell the same people an explicit release tells.

Every other test in this suite releases its lock, so expiry was untested, and B105's announcement
was wired to acquire and release only. The result was live: the pushed agent list went stale while
the REST read stayed correct, and the indicator kept reporting an agent that had timed out.
*/
test('B115: a lapsed lock announces the agent list, not only the per-diagram lock', async () => {
	const { sweepLocks } = await import('../server/app.js');
	let now = 1000;
	const locks = new Locks({ ttlMs: 100, now: () => now });
	const sent = { broadcast: [], announce: [] };
	const hub = {
		broadcast: (id, cmd, body) => sent.broadcast.push({ id, cmd, body }),
		announce: (cmd, body) => sent.announce.push({ cmd, body }),
	};

	locks.acquire('diagram-aa0001', 'agent:planner');
	assert.deepEqual(sweepLocks(locks, hub), [], 'nothing lapsed yet');
	assert.equal(sent.announce.length, 0, 'and a sweep that frees nothing says nothing');

	now = 1101;
	assert.deepEqual(sweepLocks(locks, hub), ['diagram-aa0001']);
	assert.equal(sent.broadcast.length, 1, 'viewers of that diagram learn it is editable');
	assert.equal(sent.broadcast[0].cmd, 'lock');
	assert.equal(sent.announce.length, 1, 'and EVERY session learns the agent stopped -- this was the defect');
	assert.equal(sent.announce[0].cmd, 'agents');
	assert.deepEqual(sent.announce[0].body.agents, [], 'the whole live set, which is now empty');
});

test('B115: one announcement per sweep, not one per freed diagram', () => {
	// the body is the entire live set, so a second send would repeat the first exactly
	let now = 1000;
	const locks = new Locks({ ttlMs: 100, now: () => now });
	const sent = [];
	const hub = { broadcast: () => {}, announce: (cmd, body) => sent.push(body) };
	locks.acquire('diagram-aa0001', 'agent:a');
	locks.acquire('diagram-aa0002', 'agent:b');
	now = 1101;
	return import('../server/app.js').then(({ sweepLocks }) => {
		assert.equal(sweepLocks(locks, hub).length, 2, 'both lapsed');
		assert.equal(sent.length, 1, 'and were announced once');
	});
});
