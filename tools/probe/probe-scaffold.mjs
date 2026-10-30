#!/usr/bin/env node
/*
probe-scaffold -- H26-19. What a probe starts ends with it, even when it is killed, and what it makes to run is removed.

The probes (parity, capture-sample, gesture-sample, rest-sweep) each serve two commits from worktrees of their own, write each side's
documents into a data folder, and drive one headless Chrome on a profile in their output folder. Each started its servers and Chrome
detached and stopped them in a `finally` -- which a probe killed, or ended by `process.exit` inside its `try`, never runs: the servers
and the Chrome ran on, the worktrees stayed registered, and Chrome's lock folder was never removed even when the `finally` ran.

`startProbeScaffold({ root, trees, data, profile })` names the scaffolding before any of it exists, and a warden holds it from then on
(tools/process-tether.mjs): the worktrees and their registration, the data folders, the Chrome profile, and a temporary folder of
Chrome's own -- Chrome makes folders there and leaves them, its lock folder among them (tests/fixtures/chrome.mjs measured 21 from one
Chrome). Answers:
  start(cmd, args, opts)  a process tethered to the probe, stopped by stop() or by the probe's end, however it ends
  launchChrome(flags)     Chrome on the profile, its temporary folder and the port the system gives it (B434); answers the port
  stop()                  every process stopped and waited for, then the scaffolding removed; the report and images stay
A tree a killed run left before this existed is removed and its registration pruned first, so the worktree can be made again.
*/
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnTethered, spawnCleanupWarden } from '../process-tether.mjs';
import { readDevToolsActivePort, removeChromeLockFolder, removeScratchTree } from '../chrome-profile.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const groupAlive = (pgid) => { try { process.kill(-pgid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };

/** Names a probe's worktrees, data folders and Chrome profile, held by a warden from now; see the header for what it answers. */
export function startProbeScaffold({ root, trees = [], data = [], profile = null }) {
	const chromeTemp = profile ? fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-')) : null;
	for (const tree of trees) { try { execFileSync('git', ['worktree', 'remove', '--force', '--force', tree], { cwd: root, stdio: 'ignore' }); } catch { /* none left */ } }
	execFileSync('git', ['worktree', 'prune'], { cwd: root, stdio: 'ignore' });
	spawnCleanupWarden({ chromeProfile: profile, remove: [...data, ...(chromeTemp ? [chromeTemp] : [])], worktrees: trees.map((t) => ({ path: t, repo: root })) });
	const procs = [];
	const start = (cmd, args, opts = {}) => { const p = spawnTethered(cmd, args, { ...opts, stdio: 'ignore' }); procs.push(p); return p; };
	return {
		start,
		async launchChrome(flags) {
			if (!profile) throw new Error('startProbeScaffold: launchChrome needs the profile named when the scaffold was started');
			fs.rmSync(path.join(profile, 'DevToolsActivePort'), { force: true });
			const chrome = start('google-chrome', [...flags, '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'],
				{ env: { ...process.env, TMPDIR: chromeTemp }, chromeProfile: profile, remove: [chromeTemp] });
			return readDevToolsActivePort(profile, { exited: () => chrome.exitCode !== null || chrome.signalCode !== null });
		},
		async stop() {
			for (const p of procs) { try { process.kill(-p.pid, 'SIGTERM'); } catch { /* gone */ } }
			const soft = Date.now() + 5000;
			while (procs.some((p) => groupAlive(p.pid)) && Date.now() < soft) await sleep(50);
			for (const p of procs) { try { process.kill(-p.pid, 'SIGKILL'); } catch { /* gone */ } }
			const hard = Date.now() + 2000;
			while (procs.some((p) => groupAlive(p.pid)) && Date.now() < hard) await sleep(50);
			for (const t of trees) { try { execFileSync('git', ['worktree', 'remove', '--force', '--force', t], { cwd: root, stdio: 'ignore' }); } catch { removeScratchTree(t); } }
			execFileSync('git', ['worktree', 'prune'], { cwd: root, stdio: 'ignore' });
			if (profile) removeChromeLockFolder(profile, chromeTemp);
			for (const p of [profile, chromeTemp, ...data]) if (p) removeScratchTree(p);
		},
	};
}
