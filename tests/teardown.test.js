/*
B238 -- a teardown must not race the process it is tearing down.

The gate job failed on ten consecutive pushes with `ENOTEMPTY ... rmdir '.../cdp/Default'` while
every real test passed. The browser harnesses killed Chrome and removed its profile directory in the
next statement; Chrome was still writing that profile as it shut down.

The stand-in below does what Chrome does: on SIGTERM it keeps writing into the directory for a
moment, then exits. A teardown that does not wait for the exit either fails on the removal or
returns while the writer is alive and lets it recreate the directory afterwards -- which is the
second test's assertion, and the one the old inline teardown fails.
*/
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { teardown } from './fixtures/teardown.mjs';

// A child that writes into `dir` during shutdown, and optionally ignores SIGTERM altogether.
// It prints `ready` only once its handler is installed: signalled any earlier, it would die of the
// default action without writing, and the test would pass for the wrong reason.
function writer(dir, { ignoreTerm = false } = {}) {
	const script = `
		const fs = require('node:fs');
		const dir = ${JSON.stringify(dir)};
		process.on('SIGTERM', () => {
			if (${ignoreTerm}) return;
			setTimeout(() => {
				fs.mkdirSync(dir + '/Default', { recursive: true });
				fs.writeFileSync(dir + '/Default/Preferences', 'written during shutdown');
				process.exit(0);
			}, 300);
		});
		setInterval(() => {}, 1000);
		process.stdout.write('ready\\n');
	`;
	const child = spawn(process.execPath, ['-e', script], { stdio: ['ignore', 'pipe', 'ignore'] });
	spawned.push(child);
	const ready = new Promise((resolve) => child.stdout.once('data', resolve));
	return { child, ready };
}

// If the helper regresses, a child it failed to stop must not keep this file's process alive: the
// suite has to FAIL, not hang. Measured: with the old inline teardown in place, the SIGTERM-ignoring
// writer outlived the run and the test process never exited.
const spawned = [];
after(() => { for (const c of spawned) if (c.exitCode === null && c.signalCode === null) c.kill('SIGKILL'); });

const scratch = () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-teardown-'));
	fs.mkdirSync(path.join(dir, 'Default'));
	fs.writeFileSync(path.join(dir, 'Default', 'Preferences'), 'before');
	return dir;
};
const exitOf = (p) => (p.exitCode !== null || p.signalCode !== null)
	? Promise.resolve() : new Promise((resolve) => p.once('exit', resolve));

test('B238: teardown returns only after the writer has exited', { timeout: 10000 }, async () => {
	const dir = scratch();
	const { child, ready } = writer(dir);
	await ready;
	await teardown([child], dir);
	assert.ok(child.exitCode !== null || child.signalCode !== null,
		'teardown resolved while the process it was stopping was still alive');
});

test('B238: nothing recreates the directory after teardown', { timeout: 10000 }, async () => {
	const dir = scratch();
	const { child, ready } = writer(dir);
	await ready;
	await teardown([child], dir);
	await exitOf(child);                   // let a writer that outlived the teardown finish writing
	assert.equal(fs.existsSync(dir), false,
		'the directory came back: the teardown removed it while the writer was still shutting down');
});

test('B238: a writer that ignores SIGTERM is escalated rather than waited on forever', { timeout: 10000 }, async () => {
	const dir = scratch();
	const { child, ready } = writer(dir, { ignoreTerm: true });
	await ready;
	await teardown([child], dir, 300);
	assert.equal(child.signalCode, 'SIGKILL', 'a process ignoring SIGTERM must be killed, not waited on');
	assert.equal(fs.existsSync(dir), false);
});

test('B238: an already-exited process is not an error', { timeout: 10000 }, async () => {
	const dir = scratch();
	const { child, ready } = writer(dir);
	await ready;
	child.kill('SIGKILL');
	await exitOf(child);
	await teardown([child, null], dir);
	assert.equal(fs.existsSync(dir), false);
});
