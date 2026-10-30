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

/*
The verifier's N1 (H26.4): lab-browser and page-matrix were found leaving a Chrome and their servers running. Each spawns them as groups and
stops them in its `after` hook -- but a test process stopped before that hook runs (the runner cancelling a file, Ctrl-C, a kill sent to
it) never ran it, and the groups, detached, outlived it. So the fixture keeps every group it spawned, and a process that exits, or is
stopped by SIGTERM, SIGINT or SIGHUP, kills each one still standing first; a signal is then raised again, so the process still dies of it.
A SIGKILL can be caught by nothing, and is not claimed -- H26-19: the groups are now tethered (tools/process-tether.mjs), so this holds
with nothing run at exit at all, and tests/process-tether.test.js holds the SIGKILL case.
*/
function harness(how) {
	const fixture = JSON.stringify(new URL('./fixtures/teardown.mjs', import.meta.url).href);
	const script = `
		const { spawnGroup } = await import(${fixture});
		const group = spawnGroup('sh', ['-c', 'sleep 600 & sleep 600 & wait'], { stdio: 'ignore' });
		process.stdout.write(group.pid + ' ready\\n');
		${how === 'exit' ? "setTimeout(() => process.exit(0), 200);" : 'setInterval(() => {}, 1000);'}
	`;
	// its groups are left for the tether to stop, as this test intends: not reported into the run as a leak (tools/run-tests.mjs)
	return spawn(process.execPath, ['--input-type=module', '-e', script], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, DRAW_TEST_RUN: '' } });
}
const groupGone = (pgid) => { try { process.kill(-pgid, 0); return false; } catch (e) { return e.code === 'ESRCH'; } };
for (const how of ['SIGTERM', 'SIGINT', 'exit']) {
	test(`N1: a harness ${how === 'exit' ? 'exiting before its teardown' : `stopped by ${how} before its teardown`} leaves none of its groups behind`, { timeout: 15000 }, async () => {
		const child = harness(how);
		const pgid = await new Promise((resolve, reject) => {
			let out = '';
			child.stdout.on('data', (d) => { out += d; const m = out.match(/^(\d+) ready/); if (m) resolve(Number(m[1])); });
			child.once('exit', () => reject(new Error(`the harness exited before it was ready: ${out}`)));
		});
		try {
			assert.equal(groupGone(pgid), false, 'control: the group stands while its harness runs');
			const exited = new Promise((resolve) => child.once('exit', (code, signal) => resolve({ code, signal })));
			if (how !== 'exit') child.kill(how);
			const end = await exited;
			assert.deepEqual(end, how === 'exit' ? { code: 0, signal: null } : { code: null, signal: how }, 'the harness ends as it would have, of the signal if signalled');
			for (let i = 0; i < 40 && !groupGone(pgid); i++) await new Promise((r) => setTimeout(r, 50));
			assert.equal(groupGone(pgid), true, 'and its group with it');
		} finally { try { process.kill(-pgid, 'SIGKILL'); } catch { /* gone */ } try { child.kill('SIGKILL'); } catch { /* gone */ } }
	});
}
