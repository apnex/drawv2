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
		body: JSON.stringify({ action: 'put', kind: 'node',
			entity: { id: 'node-abc123', name: 'srv', type: 'server', x: 120, y: 120 } })
	});
	assert.equal(r.status, 200);
	const after = (await (await fetch(`${base}/api/v1/diagrams/${id}/nodes`)).json()).length;
	assert.equal(after, before + 1);

	const rel = await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'DELETE', headers: H(lock.token) });
	assert.equal(rel.status, 200);
	// writes refused again after release
	assert.equal((await fetch(`${base}/api/v1/diagrams/${id}/commit`, {
		method: 'POST', headers: H(lock.token), body: JSON.stringify({ action: 'put', kind: 'node', entity: {} })
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
			method: 'POST', headers: H(lock.token), body: JSON.stringify({ type: 'host', x: 300, y: 180 })
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
			body: JSON.stringify({ action: 'put', kind: 'group', entity: { id: 'group-aaaaaa', name: 'g', members: 7 } })
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
		body: JSON.stringify({ action: 'put', kind: 'node', entity: { id: 'node-zzzzzz', name: 'x', type: 'host', x: 0, y: 0 } })
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
	app.store.flushAll();
	const onDisk = JSON.parse(fs.readFileSync(path.join(dataDir, `${id}.json`), 'utf8'));
	assert.ok(onDisk.zones.some((z) => z.w === 180 && z.h === 120));
});
