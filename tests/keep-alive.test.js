/*
B164 (H20.2) -- A TEST'S REQUEST MUST NOT MEET THE SERVER CLOSING THE CONNECTION IT WAS SENT ON.

`B32: DELETE removes a diagram` failed once with `UND_ERR_SOCKET: other side closed`, on a pooled connection that had already
carried 893 bytes of answers. The cause, reproduced here: a test's server and its client share one process, and the client
reuses an idle connection. When the process stalls after the client has sent on it and before the server has read the request,
the event loop's next turn runs its timers before it reads -- and the server's idle timer, due by then, closes a connection that
holds an unread request. The row had guessed a server torn down mid-test; none is, in that test.

Every server a test makes holds an idle connection for a minute (tests/fixtures/app.mjs `testApp`), so the stall that could do
this must outlast any test's patience. Production keeps Node's default: no client shares its process, and its log holds no such
close (two 500s in 30 days, both 360 s timeouts, MEASURED 2026-10-10).
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { makeApp, TEST_KEEP_ALIVE_MS } from './fixtures/app.mjs';

const stall = (ms) => { const until = Date.now() + ms; while (Date.now() < until) { /* the machine is busy */ } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const REQUEST = 'GET / HTTP/1.1\r\nHost: x\r\n\r\n';

// a request on a connection idle `idle` ms, the process stalling `stallMs` the moment it is sent: answered, or closed unanswered
async function sentThenStalled(server, idle, stallMs) {
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const sock = net.connect(server.address().port, '127.0.0.1');
	sock.on('error', () => {});
	await new Promise((r) => sock.on('connect', r));
	let got = '', gone = false;
	sock.on('data', (d) => { got += d; });
	const closed = new Promise((r) => sock.on('close', () => { gone = true; r(false); }));
	// polls until answered or the connection is gone -- a poll left running would hold the process open
	const answer = () => (async () => { while (!got.includes('ok') && !gone) await sleep(5); return !gone || got.includes('ok'); })();
	sock.write(REQUEST);
	await answer();
	got = '';
	await sleep(idle);
	// sent from the end of a turn, then stalled: the next turn runs its timers before it reads, as a test's continuation does
	await new Promise((r) => setImmediate(() => { sock.write(REQUEST); stall(stallMs); r(); }));
	const answered = await Promise.race([answer(), closed]);
	sock.destroy();
	server.close();
	return answered;
}
const plain = (keepAliveTimeout) => {
	const s = http.createServer((req, res) => res.end('ok'));
	s.keepAliveTimeout = keepAliveTimeout;
	return s;
};

test('B164: a request sent on an idle connection, then a stall past the server\'s idle timeout, is closed unanswered -- the race', async () => {
	assert.equal(await sentThenStalled(plain(1000), 500, 2000), false, 'an idle timeout of 1 s (closing at 2): the request is lost');
	assert.equal(await sentThenStalled(plain(1000), 500, 0), true, 'with no stall it is answered -- the control');
	assert.equal(await sentThenStalled(plain(TEST_KEEP_ALIVE_MS), 500, 2000), true, 'and a minute\'s idle timeout answers it through the same stall');
});

test('B164: every server a test makes holds an idle connection for a minute, and no test makes one around the fixture', async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-keepalive-'));
	const app = await makeApp({ dataDir: dir, secretsDir: dir, port: 0 });
	try {
		assert.equal(app.server.keepAliveTimeout, TEST_KEEP_ALIVE_MS);
	} finally {
		await app.close();
		fs.rmSync(dir, { recursive: true, force: true });
	}
	const around = fs.readdirSync(new URL('./', import.meta.url)).filter((f) => f.endsWith('.test.js'))
		.filter((f) => /^import \{[^}]*\bcreateApp\b[^}]*\} from '\.\.\/server\/app\.js'/m.test(fs.readFileSync(new URL(f, import.meta.url), 'utf8')));
	assert.deepEqual(around, [], 'a test file making a server imports it through tests/fixtures/app.mjs (`makeApp`, `testApp`)');
});
