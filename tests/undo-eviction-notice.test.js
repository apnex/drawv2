/*
H30-2 (dev/DECISIONS.md; amends I14 and CS6) -- WHAT THE UNDO LOG EVICTED IS REPORTED TO AGENTS BY THE HISTORY DOOR, AND NOT SHOWN IN THE
BROWSER. The log is bounded first in, first out by design, so its loss is no news to a person: the page's banner ("undo history is full")
is gone, and with it the counts only it read, which the socket carried on every snapshot, `sync`, change and answer. The log still counts
what it evicts, persisted (tests/history.test.js: the eviction itself, the floor, and the counters surviving a restart), and
`GET /api/v1/diagrams/<id>/history` still reports them, so an agent asking how far it can undo is told.

Against a real server on a log that has evicted a person's change -- its counters set as an eviction leaves them.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import WebSocket from 'ws';
import { makeApp } from './fixtures/app.mjs';
import { scratchFolder } from '@apnex/clean-runner';   // H26-19 as amended: removed when this file ends, however it ends

const COUNTS = ['truncated', 'truncatedHuman', 'evicted', 'evictedHuman'];

// a socket whose answers are taken in order of the commands waited for
function connect(port) {
	const ws = new WebSocket(`ws://localhost:${port}/ws`);
	const inbox = [], waiters = [];
	ws.on('message', (data) => {
		const msg = JSON.parse(data.toString());
		const i = waiters.findIndex((w) => w.cmds.includes(msg.cmd));
		if (i !== -1) waiters.splice(i, 1)[0].resolve(msg); else inbox.push(msg);
	});
	return new Promise((resolve, reject) => {
		ws.on('open', () => resolve({
			send: (cmd, body) => ws.send(JSON.stringify({ cmd, body })),
			expect: (...cmds) => {
				const i = inbox.findIndex((m) => cmds.includes(m.cmd));
				if (i !== -1) return Promise.resolve(inbox.splice(i, 1)[0]);
				return new Promise((res, rej) => {
					const timer = setTimeout(() => rej(new Error(`timeout waiting for ${cmds}`)), 3000);
					waiters.push({ cmds, resolve: (m) => { clearTimeout(timer); res(m); } });
				});
			},
			close: () => ws.close(),
		}));
		ws.on('error', reject);
	});
}

test('H30-2: a log that evicted a person\'s change -- the socket carries no count of it to the page, and the history door still reports it', async () => {
	const dataDir = scratchFolder('draw-h30-2-');
	const app = await makeApp({ dataDir, port: 0 });
	try {
		const base = `http://localhost:${app.port}`;
		const id = (await (await fetch(`${base}/api/v1/diagrams`)).json())[0].id;
		const log = app.store.log(id);
		Object.assign(log, { evicted: 3, evictedHuman: 2 });   // what evicting three records, two of them a person's, leaves
		assert.deepEqual([log.truncated, log.truncatedHuman], [true, true], 'precondition: the log reports a person\'s change evicted');

		const page = await connect(app.port);
		try {
			page.send('hello', { diagram: id });
			const snapshot = await page.expect('snapshot');
			page.send('commit', { txnId: 'h30-2-a', diagram: id, label: 'add', ops: [{ op: 'put', kind: 'node', entity: { id: 'node-0302a1', name: 'n', type: 'host', x: 600, y: 600 } }] });
			const commitAck = await page.expect('ack');
			page.send('undo', { txnId: 'h30-2-b', diagram: id, expect: commitAck.body.version });
			const undoAck = await page.expect('ack');
			page.send('resume', { diagram: id, version: undoAck.body.version });
			const sync = await page.expect('sync', 'snapshot');
			assert.deepEqual([snapshot.body.doc?.meta.id, commitAck.body.acked, undoAck.body.acked, sync.cmd], [id, 'h30-2-a', 'h30-2-b', 'sync'], 'precondition: each answer heard');
			for (const [name, body] of [['snapshot', snapshot.body], ['commit ack', commitAck.body], ['undo ack', undoAck.body], ['sync', sync.body]]) {
				assert.deepEqual(COUNTS.filter((k) => k in body), [], `the ${name} carries no count of what the log evicted`);
			}
		} finally { page.close(); }

		const history = await (await fetch(`${base}/api/v1/diagrams/${id}/history`)).json();
		assert.deepEqual(COUNTS.map((k) => history[k]), [true, true, 3, 2], 'the history door reports it to an agent');
	} finally {
		app.close?.();
		fs.rmSync(dataDir, { recursive: true, force: true });
	}
});
