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

const exited = (p) => p.exitCode !== null || p.signalCode !== null;

export async function stopProcess(proc, graceMs = 5000) {
	if (!proc || proc.pid === undefined || exited(proc)) return;
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
