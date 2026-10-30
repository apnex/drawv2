#!/usr/bin/env node
/*
process-tether -- H26-19. A process a test or a probe starts ends with the process that started it, even when that one is killed.

THE FAULT. A harness starts Chrome and a server as process groups of their own and stops them in its `after` hook or a `finally`.
A harness killed before that -- a session cut off, a tool call timed out, `kill -9` -- runs neither, and the groups, detached, outlive
it: a headless Chrome and two draw servers were found running after a verifier's session was cut off. tests/fixtures/teardown.mjs
then killed the groups from the harness's own `exit` and signal handlers, which a SIGKILL never runs (N1, H26.4).

THE TETHER. So nothing is started directly. `spawnTethered(cmd, args, opts)` starts THIS FILE as the leader of a process group of
its own, holding one end of a pipe whose other end only the starting process holds, and the tether starts the command in its group.
When the starting process ends, however it ends, the kernel closes its end and the tether reads end-of-file -- then it stops the
whole group (SIGTERM, then SIGKILL past a grace), stops whatever still names what it was asked to remove (Chrome's crash handler
leaves the group; a server's working folder is a worktree), and removes those paths: Chrome's lock folder, read from the profile
before the profile goes (tools/chrome-profile.mjs), the profile, scratch folders, git worktrees and their registration. Under
tools/run-tests.mjs it also records that it had to, so the run fails naming the test that left its process running.

WHILE THE STARTER LIVES the tether changes nothing a caller sees: the command's stdin, stdout and stderr are the tether's, which
are the caller's; a signal to the group reaches the command, and the tether, which holds SIGTERM, SIGINT and SIGHUP, waits for it
and ends as it ended -- the same exit code, or the same signal. What the command started in its group is stopped when it ends.
`child.pid` is the group's id, so a caller stops everything with one `process.kill(-child.pid, signal)`, as before. With no command
the tether is a warden: it only waits, and removes its paths once its starter is gone (`spawnCleanupWarden`).

Linux only: it reads /proc, as tests/fixtures/teardown.mjs already assumes process groups. The suite and CI run on Linux.
*/
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromeLockFolderOf, removeScratchTree } from './chrome-profile.mjs';

const TETHER_SCRIPT = fileURLToPath(import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The environment variable naming the run folder of tools/run-tests.mjs; a tether reports into it. */
export const TEST_RUN_ENV = 'DRAW_TEST_RUN';
/** The file in a run folder where a tether records a process its starter left running. */
export const TEST_RUN_ORPHAN_LOG = '.draw-run-orphans';

// ---- the processes on this machine, read from /proc

function processStat(pid) {
	try {
		const s = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
		const f = s.slice(s.lastIndexOf(')') + 2).split(' ');
		return { state: f[0], ppid: Number(f[1]), pgrp: Number(f[2]), start: f[19] };
	} catch { return null; }
}
function livePids() {
	return fs.readdirSync('/proc').filter((e) => /^\d+$/.test(e)).map(Number)
		.filter((pid) => { const st = processStat(pid); return st && st.state !== 'Z' && st.state !== 'X'; });
}
const readOr = (file, fallback) => { try { return fs.readFileSync(file, 'utf8'); } catch { return fallback; } };

/** A process's start time in clock ticks since boot, or null when it is gone: a pid with a different start is another process. */
export function processStartTime(pid) {
	return processStat(pid)?.start ?? null;
}

/** A process's command line, NUL separators turned to spaces, at most `max` characters. */
export function processCommandLine(pid, max = 200) {
	const s = readOr(`/proc/${pid}/cmdline`, '').replace(/\0/g, ' ').trim();
	return s.length > max ? `${s.slice(0, max)}...` : s;
}

/**
 * Every live process but this one whose command line or environment names `target`, or whose working folder is in it -- the
 * processes that write there. Chrome's `--user-data-dir`, a server's `DATA_DIR`, a run's `TMPDIR`, a worktree a server runs in.
 */
export function processesNaming(target, { exclude = [] } = {}) {
	const skip = new Set([process.pid, 1, ...exclude]);
	return livePids().filter((pid) => {
		if (skip.has(pid)) return false;
		if (readOr(`/proc/${pid}/cmdline`, '').includes(target) || readOr(`/proc/${pid}/environ`, '').includes(target)) return true;
		try { const cwd = fs.readlinkSync(`/proc/${pid}/cwd`); return cwd === target || cwd.startsWith(`${target}/`); } catch { return false; }
	});
}

/** Stops each process: SIGTERM, then SIGKILL to any still alive after `graceMs`; resolves once none is left, or 2 s after the SIGKILL. */
export async function stopProcessesByPid(pids, graceMs = 3000) {
	const alive = () => pids.filter((pid) => { const st = processStat(pid); return st && st.state !== 'Z'; });
	for (const pid of alive()) { try { process.kill(pid, 'SIGTERM'); } catch { /* gone */ } }
	const soft = Date.now() + graceMs;
	while (alive().length && Date.now() < soft) await sleep(50);
	for (const pid of alive()) { try { process.kill(pid, 'SIGKILL'); } catch { /* gone */ } }
	const hard = Date.now() + 2000;
	while (alive().length && Date.now() < hard) await sleep(50);
	return alive();
}

// ---- the starting side

const tmpdirOf = (env) => (env.TMPDIR || env.TMP || env.TEMP || '/tmp').replace(/(.)\/+$/, '$1');
const heldLines = new Set();   // the starting end of each tether's pipe, held for as long as its tether runs

/**
 * Starts `cmd` tethered to this process: it, and everything it starts in its group, ends when this process ends, even by SIGKILL.
 * Answers the tether's ChildProcess -- its pid is the group's id, its exit is the command's, its stdio the command's.
 *   stdio          as spawn's, at most three entries: fd 3 is the tether's own
 *   chromeProfile  a Chrome profile: on the starter's end its lock folder and then the profile are removed
 *   remove         paths removed on the starter's end, once nothing naming them is left running
 *   worktrees      [{ path, repo }]: git worktrees removed, their registration with them, on the starter's end
 *   report         a run folder (tools/run-tests.mjs) to record into when the command was left running; the run's own by default
 */
export function spawnTethered(cmd, args = [], { stdio = 'pipe', chromeProfile = null, remove = [], worktrees = [], report = process.env[TEST_RUN_ENV] || null, ...spawnOptions } = {}) {
	const io = typeof stdio === 'string' ? [stdio, stdio, stdio] : [...stdio];
	if (io.length > 3) throw new Error(`spawnTethered: stdio names at most three entries, fd 3 is the tether's own -- given ${JSON.stringify(stdio)}`);
	while (io.length < 3) io.push('pipe');
	const env = spawnOptions.env ?? process.env;
	const spec = {
		cmd, args,
		chromeProfile: chromeProfile && path.resolve(chromeProfile),
		remove: remove.map((p) => path.resolve(p)),
		worktrees: worktrees.map((w) => ({ path: path.resolve(w.path), repo: path.resolve(w.repo) })),
		tmpdir: tmpdirOf(env), report,
		starter: process.pid, starterArgs: [...process.execArgv, ...process.argv.slice(1)].join(' ').replace(/\s+/g, ' ').slice(0, 200),
	};
	const child = spawn(process.execPath, [TETHER_SCRIPT, JSON.stringify(spec)], { ...spawnOptions, env, stdio: [...io, 'pipe'], detached: true });
	const line = child.stdio[3];
	if (line) {
		line.on('error', () => { /* the tether has gone; its exit says how */ });
		heldLines.add(line);
		child.once('exit', () => heldLines.delete(line));
		child.tetherLine = line;
	}
	return child;
}

/** Starts a tether with no command: it holds nothing open in this process, and removes its paths once this process has ended. */
export function spawnCleanupWarden({ chromeProfile = null, remove = [], worktrees = [] } = {}) {
	const warden = spawnTethered(null, [], { stdio: 'ignore', chromeProfile, remove, worktrees, report: null });
	warden.unref();
	warden.tetherLine?.unref();
	return warden;
}

// ---- the tether itself

async function runTether(spec) {
	const HELD = ['SIGTERM', 'SIGINT', 'SIGHUP'];
	const hold = () => { /* the group's signal is for the command: the tether waits for it, and ends as it ended */ };
	for (const s of HELD) process.on(s, hold);

	let starterGone = false, ended = null, finished = false, lockFolder = null;
	const groupMembers = () => livePids().filter((pid) => pid !== process.pid && processStat(pid)?.pgrp === process.pid);

	// the lock folder is read as soon as Chrome links it, so it is known even if the profile is gone by the time it is needed
	if (spec.chromeProfile) {
		const look = setInterval(() => { lockFolder = chromeLockFolderOf(spec.chromeProfile, spec.tmpdir); if (lockFolder) clearInterval(look); }, 100);
		look.unref();
		setTimeout(() => clearInterval(look), 60000).unref();
	}

	const cleanUp = async () => {
		const lock = spec.chromeProfile ? (lockFolder ?? chromeLockFolderOf(spec.chromeProfile, spec.tmpdir)) : null;
		const targets = [spec.chromeProfile, ...spec.worktrees.map((w) => w.path), ...spec.remove].filter(Boolean);
		for (const t of targets) await stopProcessesByPid(processesNaming(t));
		if (lock) removeScratchTree(lock);
		if (spec.chromeProfile) removeScratchTree(spec.chromeProfile);
		for (const w of spec.worktrees) {
			try { execFileSync('git', ['worktree', 'remove', '--force', '--force', w.path], { cwd: w.repo, stdio: 'ignore' }); } catch { removeScratchTree(w.path); }
			try { execFileSync('git', ['worktree', 'prune'], { cwd: w.repo, stdio: 'ignore' }); } catch { /* not a repository any more */ }
		}
		for (const r of spec.remove) removeScratchTree(r);
	};

	const finish = () => {
		if (finished) return;
		finished = true;
		if (starterGone || !ended) process.exit(0);
		for (const s of HELD) process.removeListener(s, hold);
		if (ended.signal) {
			try { process.kill(process.pid, ended.signal); } catch { /* not a signal this process can raise */ }
			setTimeout(() => process.exit(128 + (os.constants.signals[ended.signal] ?? 0)), 200);
			return;
		}
		process.exit(ended.code ?? 1);
	};

	const command = spec.cmd ? spawn(spec.cmd, spec.args, { stdio: ['inherit', 'inherit', 'inherit', 'ignore'] }) : null;
	if (command) {
		command.on('error', (e) => {
			process.stderr.write(`process-tether: could not start ${spec.cmd}: ${e.message}\n`);
			if (!ended) { ended = { code: 127, signal: null }; finish(); }
		});
		command.on('exit', async (code, signal) => {
			ended = { code, signal };
			try {
				await stopProcessesByPid(groupMembers(), 5000);   // what the command started in its group ends with it
				if (starterGone) await cleanUp();
			} finally { finish(); }
		});
	}

	const onStarterGone = async () => {
		if (starterGone) return;
		starterGone = true;
		if (command && !ended) {
			if (spec.report) {
				const line = `${spec.starterArgs} (pid ${spec.starter}) ended with \`${[spec.cmd, ...spec.args].join(' ').slice(0, 160)}\` still running; its tether stopped it\n`;
				try { fs.appendFileSync(path.join(spec.report, TEST_RUN_ORPHAN_LOG), line); } catch { /* the run folder is gone: the run has ended */ }
			}
			try { process.kill(-process.pid, 'SIGTERM'); } catch { /* the group is gone */ }
			setTimeout(() => { try { command.kill('SIGKILL'); } catch { /* gone */ } }, 3000).unref();
			return;   // the command's exit handler stops the rest of the group, cleans up and ends the tether
		}
		if (!command) { try { await cleanUp(); } finally { finish(); } }
		// a command already ended: its exit handler is stopping the group, sees the starter gone and cleans up
	};

	const line = new net.Socket({ fd: 3, readable: true, writable: false });
	line.on('data', () => { /* the starter never writes; only the end matters */ });
	line.on('end', onStarterGone);
	line.on('close', onStarterGone);
	line.on('error', onStarterGone);
	// a second witness: a starter that has gone leaves this process to another parent
	setInterval(() => { if (process.ppid !== spec.starter) onStarterGone(); }, 500).unref();
}

if (process.argv[1] && path.resolve(process.argv[1]) === TETHER_SCRIPT) runTether(JSON.parse(process.argv[2]));
