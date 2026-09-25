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
import { teardown, spawnGroup } from './fixtures/teardown.mjs';

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

test('B238: a process that never started is not waited on', { timeout: 10000 }, async () => {
	// a spawn failure has no pid and delivers 'error', never 'exit' -- and it arrives on the NEXT
	// tick, so tearing down in the same tick used to wait on an exit that could not come
	const dir = scratch();
	const ghost = spawn('/nonexistent/draw-no-such-binary', [], { stdio: 'ignore' });
	ghost.on('error', () => {});             // the spawn error is expected; unhandled, it would crash the file
	await teardown([ghost], dir);
	assert.equal(fs.existsSync(dir), false);
});

/*
B238, corrected: a CHILD that outlives its parent and keeps writing -- what failed CI after the first fix.

The stand-in leader starts a child in its own process group and exits at once on SIGTERM. The child
writes into the directory every 50ms, and on SIGTERM keeps writing for 300ms before it exits, the way
Chrome's network service flushes its state. Waiting for the leader alone removes the directory while
the child is still writing, and the child recreates it.
*/
function family(dir) {
	const childScript = `
		const fs = require('node:fs'); const dir = ${JSON.stringify(dir)};
		const write = () => { try { fs.mkdirSync(dir + '/Default', { recursive: true }); fs.writeFileSync(dir + '/Default/State', String(Date.now())); } catch {} };
		const tick = setInterval(write, 50);
		process.on('SIGTERM', () => setTimeout(() => { clearInterval(tick); write(); process.exit(0); }, 300));
		setTimeout(() => process.exit(0), 3000);          // never an orphan past the test
		write(); process.stdout.write('child-ready\\n');   // only once the handler is installed and it is writing
	`;
	const leaderScript = `
		const { spawn } = require('node:child_process');
		const child = spawn(process.execPath, ['-e', ${JSON.stringify(childScript)}], { stdio: ['ignore', 'pipe', 'ignore'] });
		process.on('SIGTERM', () => process.exit(0));
		setInterval(() => {}, 1000);
		// ready only when the CHILD says so: signalled any earlier, it dies of the default action
		// before its shutdown flush, and the test passes without exercising the case it names
		child.stdout.once('data', () => process.stdout.write('ready ' + child.pid + '\\n'));
	`;
	const leader = spawnGroup(process.execPath, ['-e', leaderScript], { stdio: ['ignore', 'pipe', 'ignore'] });
	spawned.push(leader);
	const ready = new Promise((resolve) => leader.stdout.once('data', (d) => resolve(Number(String(d).split(' ')[1]))));
	return { leader, ready };
}
const gone = async (pid, ms = 5000) => {
	const end = Date.now() + ms;
	while (Date.now() < end) { try { process.kill(pid, 0); } catch { return true; } await new Promise((r) => setTimeout(r, 50)); }
	return false;
};

test('B238: a child that outlives its parent is waited on too, and nothing recreates the directory', { timeout: 15000 }, async () => {
	const dir = scratch();
	const { leader, ready } = family(dir);
	const childPid = await ready;
	const t0 = Date.now();
	await teardown([leader], dir);
	assert.ok(Date.now() - t0 >= 250, 'the teardown waited through the child\'s shutdown flush rather than killing it before it began');
	assert.ok(await gone(childPid), 'the child finished');
	assert.equal(fs.existsSync(dir), false,
		'the directory came back: the teardown removed it while a child of the stopped process was still writing');
});
