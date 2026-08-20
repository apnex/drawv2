/*
GR12 — a fanout failure can never fail the primary transaction.

This guardrail had no test. The try/catch was in the code and the claim was in the spec, and nothing
connected them: a refactor that hoisted the try outside the loop, or dropped it for an `await`, would
have shipped green. A guardrail nothing exercises is prose.

The hazard is specific. After CS3 the Hub is the ONLY channel by which a viewer learns anything, and
broadcast happens AFTER the transaction is applied, logged and flushed. So a dead socket at fanout
time can do two things it must never do: silence the OTHER viewers, and turn a committed write into
a 500 for the writer who already has their change on disk.
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hub } from '../server/hub.js';
import { createApp } from '../server/app.js';
import { WebSocket } from 'ws';
import net from 'node:net';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// the narrow duck-typed Session the Hub speaks: { diagramId, send(cmd, body) }
function viewer(diagramId, { throws = false } = {}) {
	const got = [];
	return {
		diagramId, got,
		send(cmd, body) {
			if (throws) throw new Error('socket is gone');
			got.push({ cmd, body });
		},
	};
}

test('GR12: one dead socket cannot silence the other viewers', () => {
	const hub = new Hub();
	const before = viewer('diagram-aa0001');
	const dead = viewer('diagram-aa0001', { throws: true });
	const after = viewer('diagram-aa0001');
	[before, dead, after].forEach((v) => hub.add(v));

	hub.broadcast('diagram-aa0001', 'change', { seq: 1 });

	assert.equal(before.got.length, 1, 'the viewer ahead of the dead one got it');
	// the one that matters: iteration CONTINUED past the throw. A try/catch hoisted outside the
	// loop would leave this at 0 and every later viewer permanently blind.
	assert.equal(after.got.length, 1, 'and so did the viewer AFTER it');
});

test('GR12: a fanout failure never propagates to the caller — the write is already durable', () => {
	const hub = new Hub();
	hub.add(viewer('diagram-aa0001', { throws: true }));
	assert.doesNotThrow(() => hub.broadcast('diagram-aa0001', 'change', { seq: 1 }),
		'a committed, flushed transaction must not become a 500 because a socket died after it');
});

test('GR12: every session can be dead and broadcast still returns', () => {
	const hub = new Hub();
	for (let i = 0; i < 5; i++) hub.add(viewer('diagram-aa0001', { throws: true }));
	assert.doesNotThrow(() => hub.broadcast('diagram-aa0001', 'change', { seq: 1 }));
});

test('GR12: fanout is scoped to the diagram, and skips the originator', () => {
	const hub = new Hub();
	const origin = viewer('diagram-aa0001');
	const peer = viewer('diagram-aa0001');
	const elsewhere = viewer('diagram-bb0002');
	[origin, peer, elsewhere].forEach((v) => hub.add(v));

	hub.broadcast('diagram-aa0001', 'change', { seq: 1 }, origin);

	assert.equal(peer.got.length, 1);
	assert.equal(origin.got.length, 0, 'the originator already applied it locally');
	assert.equal(elsewhere.got.length, 0, 'another diagram hears nothing');
});

test('GR12: a removed session stops receiving — a closed socket is not a permanent throw source', () => {
	const hub = new Hub();
	const v = viewer('diagram-aa0001');
	hub.add(v);
	hub.remove(v);
	hub.broadcast('diagram-aa0001', 'change', { seq: 1 });
	assert.equal(v.got.length, 0);
});

/*
B54 - liveness. A session leaves the Hub on `close`, which covers every disconnect that produces a
TCP FIN. A peer that vanishes WITHOUT one never sends it, so the socket sat at readyState OPEN
forever while the client reconnected beside it.

The half-open peer here is a raw TCP socket that completes the WebSocket handshake and then simply
never answers. That matters: pausing a `ws` client also blinds it to its own eviction, so the first
two versions of this test reported a leak that was really a measurement error. A raw socket stays
readable and can observe the server hanging up on it.
*/
test('B54: a peer that stops answering is evicted; one that answers is not', async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-ka-'));
	const app = await createApp({ dataDir: dir, port: 0, host: '127.0.0.1', pingMs: 40 });
	try {
		const silent = net.connect(app.port, '127.0.0.1');
		let hungUp = false;
		silent.on('close', () => { hungUp = true; });
		silent.on('error', () => {});
		await new Promise((r) => silent.on('connect', r));
		silent.write('GET /ws HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
			+ `Sec-WebSocket-Key: ${crypto.randomBytes(16).toString('base64')}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
		await new Promise((r) => silent.once('data', r));      // 101 Switching Protocols

		const healthy = new WebSocket(`ws://127.0.0.1:${app.port}/ws`);
		await new Promise((r) => healthy.on('open', r));

		await new Promise((r) => setTimeout(r, 400));           // ~10 ping rounds

		assert.equal(hungUp, true, 'the half-open peer was never evicted - it would hold a session and an fd forever');
		assert.equal(healthy.readyState, 1, 'a client that pongs must survive the sweep, or liveness is a disconnect bug');
		healthy.terminate();
	} finally {
		await app.close();
	}
});
