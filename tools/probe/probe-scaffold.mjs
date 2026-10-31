#!/usr/bin/env node
/*
probe-scaffold -- H26-19, as amended. What a probe starts ends with it, even when it is killed, and what it makes to run is removed.

The probes (parity, capture-sample, gesture-sample, rest-sweep) each serve two commits from worktrees of their own, write each side's
documents into a data folder, and drive one headless Chrome. Each started its servers and Chrome detached and stopped them in a
`finally` -- which a probe killed, or ended by `process.exit` inside its `try`, never runs: the servers and the Chrome ran on, the
worktrees stayed registered, and Chrome's lock folder was never removed even when the `finally` ran.

`startProbeScaffold({ root, trees, data, chrome })` names the scaffolding before any of it exists, and a warden of clean-runner's
(`@apnex/clean-runner` `spawnWarden`) holds it from then on: once the probe has ended, however it ended, the warden stops whatever names
it, removes each worktree and prunes its registration -- `git worktree` as its cleanup commands -- and removes the worktrees and the data
folders. Answers:
  start(cmd, args, opts)  a process tethered to the probe (`spawnTethered`), stopped by stop() or by the probe's end, however it ends
  launchChrome(args)      the harness's Chrome, with the probe's own flags: on the port the system gives it, its profile and lock folder
                          in a launch folder of its own that goes when it is closed or the probe dies; answers the port
  stop()                  every process stopped and waited for, Chrome closed, then the scaffolding removed; the report and images stay
A tree a killed run left before this existed is removed and its registration pruned first, so the worktree can be made again.
*/
import { execFileSync } from 'node:child_process';
import { spawnTethered, spawnWarden, stopGroup } from '@apnex/clean-runner';
import { launchChrome } from '@apnex/headless-chromium';
import fs from 'node:fs';

const removeTree = (p) => fs.rmSync(p, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });

/** Names a probe's worktrees and data folders, held by a warden from now; see the header for what it answers. */
export function startProbeScaffold({ root, trees = [], data = [] }) {
	const worktreeCleanup = [
		...trees.map((tree) => ({ command: 'git', args: ['worktree', 'remove', '--force', '--force', tree], cwd: root })),
		{ command: 'git', args: ['worktree', 'prune'], cwd: root },
	];
	for (const { command, args, cwd } of worktreeCleanup) { try { execFileSync(command, args, { cwd, stdio: 'ignore' }); } catch { /* none left */ } }
	spawnWarden({ remove: [...trees, ...data], cleanupCommands: worktreeCleanup });
	const procs = [], chromes = [];
	const start = (cmd, args, opts = {}) => { const p = spawnTethered(cmd, args, { ...opts, stdio: 'ignore' }); procs.push(p); return p; };
	return {
		start,
		async launchChrome(args) {
			const chrome = await launchChrome({ args });
			chromes.push(chrome);
			return chrome.port;
		},
		async stop() {
			for (const chrome of chromes) await chrome.close();
			for (const p of procs) await stopGroup(p.pid);
			for (const { command, args, cwd } of worktreeCleanup) { try { execFileSync(command, args, { cwd, stdio: 'ignore' }); } catch { /* removed already */ } }
			for (const p of [...trees, ...data]) removeTree(p);
		},
	};
}
