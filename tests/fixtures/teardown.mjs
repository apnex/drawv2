/*
B238 -- stop the processes that write into a scratch directory, THEN remove it.

`proc.kill()` sends a signal and returns at once. Chrome keeps writing its profile while it shuts
down, and the test server flushes every debounced diagram write on SIGTERM -- both into the very
directory the teardown removes next. So `rmSync` raced a live writer, and on a slower machine it
lost: `ENOTEMPTY: directory not empty, rmdir '.../cdp/Default'` failed the gate job on ten
consecutive pushes while every real test passed.

WAIT FOR THE EXIT, not for a guessed delay. A process that has already exited is not signalled
again. One that ignores SIGTERM is escalated to SIGKILL after `graceMs`, so a wedged browser cannot
hang the suite -- A7's Blocked Actor, one layer down.

`maxRetries` stays as a backstop, not as the fix: Node retries ENOTEMPTY with a linear backoff, which
covers an entry CREATED while the removal is walking the tree. It does not cover a descendant that
outlives its parent and keeps writing -- that recreates the directory after the removal has finished,
silently. None was observed for Chrome; covering it would mean spawning detached and signalling the
process group. (Corrected at review: this first said the retries cover a grandchild "still closing a
file", which on Linux never blocks a removal.)

A process that never STARTED is not waited on. A spawn failure (ENOENT, EACCES) arrives on the next
tick as 'error' and never as 'exit', and a process with no pid cannot be signalled, so waiting for its
exit would never settle (found at review).
*/
import fs from 'node:fs';
import { spawnTethered } from '../../tools/process-tether.mjs';
import { chromeLockFolderOf, removeScratchTree } from '../../tools/chrome-profile.mjs';

const exited = (p) => p.exitCode !== null || p.signalCode !== null;

/*
B238, CORRECTED 2026-09-25 -- waiting for Chrome's MAIN process was not enough.

The first green CI run after the fix was one sample. The next push failed the same way: ENOTEMPTY on
`profile/Default` after the main process had exited AND the removal had retried for 5.5 seconds. A
Chrome child -- its network service writes `Network Persistent State` there -- outlived the parent and
kept writing, which is the descendant case the review had named and this file had recorded as not
observed.

Measured locally before this was written: started as the leader of its own process group, headless
Chrome puts 12 of its 14 processes in that group, including every process that writes the profile. The
two crash handlers detach into sessions of their own and exited within a second of the group dying.

So a browser is spawned as a GROUP (`spawnGroup`), and stopping it signals every member and waits until
none is left before the directory is touched. Not portable to Windows, which this suite does not run on.
*/
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const groupAlive = (pgid) => {
	try { process.kill(-pgid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
};

/*
The verifier's N1 (H26.4): a harness stopped before its `after` hook runs -- the runner cancelling a file, Ctrl-C, a kill sent to the
test process -- never stopped its groups, and being detached they outlived it: a Chrome and its servers left running. This file then
killed each group still standing from the process's `exit` and signal handlers, which a SIGKILL never runs.

H26-19: so a group is started TETHERED (tools/process-tether.mjs): its leader is a tether holding a pipe only this process holds, and
when this process ends -- by exit, a signal, or SIGKILL -- the tether stops the group and removes the Chrome profile, lock folder and
temporary folder it was given. The pid is still the group's id and the group is still stopped the same way; nothing here runs at exit any more, so a
process signalled dies of the signal as it would have (tests/teardown.test.js N1, H26-19).
*/
export function spawnGroup(cmd, args, opts = {}) {
	const child = spawnTethered(cmd, args, opts);
	child.drawGroup = true;
	return child;
}

// a Chrome's lock folder is read before it is stopped, and removed once it has, with the temporary folder it was given: Chrome
// leaves both behind (tools/chrome-profile.mjs, tests/fixtures/chrome.mjs). The profile stays: a harness may launch on it again.
async function stopGroup(proc, graceMs) {
	const lock = proc.chromeProfile ? chromeLockFolderOf(proc.chromeProfile, proc.chromeTemp) : null;
	await stopGroupNow(proc.pid, graceMs);
	if (proc.chromeProfile) {
		const folder = lock ?? chromeLockFolderOf(proc.chromeProfile, proc.chromeTemp);
		if (folder) removeScratchTree(folder);
	}
	if (proc.chromeTemp) removeScratchTree(proc.chromeTemp);
}
async function stopGroupNow(pgid, graceMs) {
	if (!groupAlive(pgid)) return;
	try { process.kill(-pgid, 'SIGTERM'); } catch { /* already gone */ }
	const soft = Date.now() + graceMs;
	while (groupAlive(pgid) && Date.now() < soft) await sleep(50);
	if (!groupAlive(pgid)) return;
	try { process.kill(-pgid, 'SIGKILL'); } catch { /* already gone */ }
	// bounded even after SIGKILL: a member the kernel has not yet reaped still answers kill(0)
	const hard = Date.now() + 2000;
	while (groupAlive(pgid) && Date.now() < hard) await sleep(50);
}

export async function stopProcess(proc, graceMs = 5000) {
	if (!proc || proc.pid === undefined) return;
	if (proc.drawGroup) return stopGroup(proc, graceMs);
	if (exited(proc)) return;
	const done = new Promise((resolve) => { proc.once('exit', resolve); proc.once('error', resolve); });
	try { proc.kill('SIGTERM'); } catch { /* already gone */ }
	const timer = setTimeout(() => { try { proc.kill('SIGKILL'); } catch { /* already gone */ } }, graceMs);
	await done;
	clearTimeout(timer);
}

export async function teardown(procs, dir, graceMs) {
	for (const p of procs) await stopProcess(p, graceMs);
	if (dir) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
