// CS3 — undo is a server capability, so it reaches across writers.
//
// The defect this closes: undo lived only in the browser, and any REST write broadcast a snapshot
// which cleared the tab's stack. Ctrl+Z could not reverse an agent's change; it could only lose
// your own. These tests are the proof of the remedy, including the race that would make the
// remedy unreliable.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.js';
import { Locks } from '../server/locks.js';

let app, base, dataDir;

const j = async (u, o) => {
	const r = await fetch(`${base}${u}`, o);
	return { status: r.status, body: await r.json().catch(() => null) };
};

test.before(async () => {
	dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-undo-'));
	app = await createApp({ dataDir, secretsDir: dataDir, port: 0 });
	base = `http://localhost:${app.port}`;
});
test.after(() => { app?.close?.(); fs.rmSync(dataDir, { recursive: true, force: true }); });

const first = async () => (await j('/api/v1/diagrams')).body[0].id;
const lock = async (id) => (await j(`/api/v1/diagrams/${id}/lock`, { method: 'POST' })).body.token;
const nodes = async (id) => (await j(`/api/v1/diagrams/${id}`)).body.nodes.length;

test('an agent write is undoable — the capability the browser-only stack could not provide', async () => {
	const id = await first();
	const token = await lock(id);
	const before = await nodes(id);

	await j(`/api/v1/diagrams/${id}/nodes`, { method: 'POST',
		headers: { 'X-Draw-Lock': token, 'content-type': 'application/json' },
		body: JSON.stringify({ type: 'host', x: 0, y: 300 }) });
	assert.equal(await nodes(id), before + 1, 'the agent wrote');

	const { version } = (await j(`/api/v1/diagrams/${id}/history`)).body;
	const undo = await j(`/api/v1/diagrams/${id}/undo`, { method: 'POST',
		headers: { 'X-Draw-Lock': token, 'content-type': 'application/json' },
		body: JSON.stringify({ expect: version }) });
	assert.equal(undo.status, 200);
	assert.equal(await nodes(id), before, "the agent's change is reversed");
	await j(`/api/v1/diagrams/${id}/lock`, { method: 'DELETE', headers: { 'X-Draw-Lock': token } });
});

test('D14/GR11: undo without expect is refused — its target is implicit', async () => {
	const id = await first();
	const token = await lock(id);
	await j(`/api/v1/diagrams/${id}/nodes`, { method: 'POST',
		headers: { 'X-Draw-Lock': token, 'content-type': 'application/json' },
		body: JSON.stringify({ type: 'host', x: 60, y: 300 }) });

	const bare = await j(`/api/v1/diagrams/${id}/undo`, { method: 'POST',
		headers: { 'X-Draw-Lock': token, 'content-type': 'application/json' }, body: '{}' });
	assert.equal(bare.status, 400);
	assert.equal(bare.body.code, 'expect-required');
	assert.ok(Number.isInteger(bare.body.version), 'and it tells you the version you needed');

	const stale = await j(`/api/v1/diagrams/${id}/undo`, { method: 'POST',
		headers: { 'X-Draw-Lock': token, 'content-type': 'application/json' },
		body: JSON.stringify({ expect: bare.body.version - 1 }) });
	assert.equal(stale.status, 409);
	assert.equal(stale.body.code, 'version-conflict');
	await j(`/api/v1/diagrams/${id}/lock`, { method: 'DELETE', headers: { 'X-Draw-Lock': token } });
});

test('D22/GR11: the remedy cannot be raced — reclaim holds the diagram against a retry loop', () => {
	let t = 1000;
	const locks = new Locks({ holdMs: 500, now: () => t });
	assert.ok(locks.acquire('d').token, 'the agent holds it');

	locks.reclaim('d');
	assert.equal(locks.locked('d'), false, 'the human took the wheel');

	const retry = locks.acquire('d');
	assert.equal(retry.held, true, 'an immediate re-acquire is REFUSED');
	assert.ok(retry.retryAfter > 0, 'and told when to try again');

	t += 600;
	assert.ok(locks.acquire('d').token, 'after the hold lapses the agent may contend again');
});

test("D22: the human's own commit ends the hold early", () => {
	let t = 1000;
	const locks = new Locks({ holdMs: 30000, now: () => t });
	locks.acquire('d');
	locks.reclaim('d');
	assert.equal(locks.acquire('d').held, true);
	locks.releaseHold('d');                       // as a ws commit does
	assert.ok(locks.acquire('d').token, 'the agent may contend once the human has acted');
});

test('GR13: history is readable without a lock, and inverse never reaches the wire', async () => {
	const id = await first();
	const token = await lock(id);
	await j(`/api/v1/diagrams/${id}/nodes`, { method: 'POST',
		headers: { 'X-Draw-Lock': token, 'content-type': 'application/json' },
		body: JSON.stringify({ type: 'host', x: 120, y: 300 }) });
	await j(`/api/v1/diagrams/${id}/lock`, { method: 'DELETE', headers: { 'X-Draw-Lock': token } });

	const h = await j(`/api/v1/diagrams/${id}/history`);      // no lock held
	assert.equal(h.status, 200);
	assert.ok(h.body.records.length > 0);
	assert.ok(!JSON.stringify(h.body).includes('inverse'), 'the undo material stays server-side');
	assert.ok(h.body.records.every((r) => typeof r.actor === 'string'), 'every record carries its actor');
	assert.ok(h.body.records.every((r) => typeof r.summary === 'string'), 'and a server-derived summary');

	const verbose = await j(`/api/v1/diagrams/${id}/history?verbose=1`);
	assert.ok(verbose.body.records.every((r) => Array.isArray(r.ops)), 'verbose adds ops');
	assert.ok(!JSON.stringify(verbose.body).includes('inverse'), 'but never inverse, under any query');
});

test('an agent can discover lock state without attempting a write', async () => {
	const id = await first();
	const open = await j(`/api/v1/diagrams/${id}/lock`);
	assert.equal(open.status, 200);
	assert.equal(open.body.owner, 'client');

	const token = await lock(id);
	assert.equal((await j(`/api/v1/diagrams/${id}/lock`)).body.owner, 'server');
	await j(`/api/v1/diagrams/${id}/lock`, { method: 'DELETE', headers: { 'X-Draw-Lock': token } });
});

test('the lock 200 hydrates the agent: version, canUndo, logDepth, truncated', async () => {
	const id = await first();
	const r = await j(`/api/v1/diagrams/${id}/lock`, { method: 'POST' });
	assert.equal(r.status, 200);
	for (const k of ['token', 'expiresAt', 'version', 'canUndo', 'canRedo', 'logDepth', 'truncated']) {
		assert.ok(k in r.body, `the lock body carries ${k}`);
	}
	await j(`/api/v1/diagrams/${id}/lock`, { method: 'DELETE', headers: { 'X-Draw-Lock': r.body.token } });
});
