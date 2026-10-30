#!/usr/bin/env node
/*
run-tests -- H26-19. The suite runs in a temporary folder of its own, and a run that leaves a file, a folder or a process fails.

THE FAULT, as the recorder counted it (2026-10-30): one gate run left 234 entries in its temporary folder -- 25 of Chrome's lock
folders and the rest draw's test folders -- and 4,077 lock folders and about 20,000 test folders had piled up in the gates' temporary
folders, because nothing failed when a test left one. Run through this file, the same suite named 208 folders from 11 test files.

THE RUN FOLDER. So `npm test` -- and with it `npm run gate` and CI -- runs `node --test` through this file, which
  1. removes every run folder in the caller's temporary folder whose runner is gone (its owner file names a pid that is not running,
     or is running as another process), stopping first whatever still names it -- a run killed before it could clean up;
  2. makes `draw-run-XXXXXX` there, with its owner file (`.draw-run-owner`: this pid and its start time), and runs the suite with
     TMPDIR set to it and DRAW_TEST_RUN naming it -- so every folder a test makes, and every lock folder Chrome makes, lands in it;
  3. the suite is tethered to this process (tools/process-tether.mjs): a runner killed takes the suite, and the run folder, with it;
  4. once the suite ends, waits a bounded time for every process that names the run folder -- in its command line, its environment
     (a server handed only PATH, HOME and a DATA_DIR inside it still names it), or its working folder -- and FAILS naming any still
     running, then stops it;
  5. FAILS naming each process a test left running that its tether had to stop (`.draw-run-orphans`, written by the tether);
  6. FAILS naming each entry left in the run folder, with the test files that make a folder by that prefix;
  7. removes the run folder, whatever it found.
The suite's own verdict stands: a failing suite fails the run whether or not it left anything.

Usage: node tools/run-tests.mjs [node --test options and files] -- every argument is handed to `node --test`.

A Chrome makes its lock folder's socket at `<run folder>/chrome-XXXXXX/.com.google.Chrome.XXXXXX/SingletonSocket` -- each Chrome is
given a temporary folder of its own (tests/fixtures/chrome.mjs) -- and Chrome does not start when that path is longer than a socket
address holds (107 characters; measured: a path of 108 stopped it), so the run folder's name is kept short, and a caller's temporary
folder too long for it is named before the suite runs.
*/
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnTethered, processesNaming, processStartTime, processCommandLine, stopProcessesByPid, TEST_RUN_ENV, TEST_RUN_ORPHAN_LOG } from './process-tether.mjs';
import { removeScratchTree, CHROME_LOCK_FOLDER_NAME } from './chrome-profile.mjs';

// the name every run folder starts with, in the caller's temporary folder; tests/run-tests.test.js plants folders by it
const TEST_RUN_FOLDER_PREFIX = 'draw-run-';
// the file in a run folder naming the runner that owns it: `{ pid, start }`, start in clock ticks since boot
const TEST_RUN_OWNER_FILE = '.draw-run-owner';

const ROOT = path.resolve(import.meta.dirname, '..');
const SETTLE_MS = 15000;
const SOCKET_PATH_MAX = 107;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (s) => process.stderr.write(`${s}\n`);

// 1. a run folder whose runner has gone, and what still names it
async function removeStaleRunFolders(base) {
	let entries = [];
	try { entries = fs.readdirSync(base, { withFileTypes: true }); } catch { return; }
	for (const e of entries) {
		if (!e.isDirectory() || !e.name.startsWith(TEST_RUN_FOLDER_PREFIX)) continue;
		const folder = path.join(base, e.name);
		let owner = null;
		try { owner = JSON.parse(fs.readFileSync(path.join(folder, TEST_RUN_OWNER_FILE), 'utf8')); } catch { /* none, or half written */ }
		if (owner && processStartTime(owner.pid) === owner.start) continue;   // its runner is running
		// a folder with no owner file may be a runner's that has not written it yet: only one older than a minute is stale
		if (!owner) { try { if (Date.now() - fs.statSync(folder).mtimeMs < 60000) continue; } catch { continue; } }
		const left = await stopProcessesByPid(processesNaming(folder));
		removeScratchTree(folder);
		say(`run-tests: removed a stale run folder, ${folder} -- its runner${owner ? `, pid ${owner.pid},` : ''} is gone${left.length ? `; pids ${left.join(', ')} would not stop` : ''}`);
	}
}

// the test files that make a folder by the prefix of a leftover's name -- the likely authors, named so the leak is found in one search
function testsMaking(name) {
	const prefix = name.replace(/[A-Za-z0-9]{6}$/, '');
	if (!prefix || prefix === name) return [];
	const found = [];
	const walk = (dir) => {
		let entries = [];
		try { entries = fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }); } catch { return; }
		for (const e of entries) {
			const rel = `${dir}/${e.name}`;
			if (e.isDirectory()) walk(rel);
			else if (/\.m?js$/.test(e.name)) { try { if (fs.readFileSync(path.join(ROOT, rel), 'utf8').includes(`'${prefix}'`)) found.push(rel); } catch { /* unreadable */ } }
		}
	};
	walk('tests');
	return found;
}

function describeEntry(folder, name) {
	const full = path.join(folder, name);
	let kind = 'a file';
	try {
		const st = fs.lstatSync(full);
		if (st.isDirectory()) { let n = 0; try { n = fs.readdirSync(full).length; } catch { /* unreadable */ } kind = `a folder of ${n} entr${n === 1 ? 'y' : 'ies'}`; }
		else if (st.isSymbolicLink()) kind = 'a link';
	} catch { /* removed while being read */ }
	if (CHROME_LOCK_FOLDER_NAME.test(name)) kind += ', named as Chrome names its lock folder -- a Chrome stopped without its removal (tools/chrome-profile.mjs)';
	const by = testsMaking(name);
	return `${name} -- ${kind}${by.length ? `; made by ${by.join(', ')}` : ''}`;
}

async function runTestsInRunFolder(argv) {
	const base = os.tmpdir();
	await removeStaleRunFolders(base);

	const runDir = fs.mkdtempSync(path.join(base, TEST_RUN_FOLDER_PREFIX));
	fs.writeFileSync(path.join(runDir, TEST_RUN_OWNER_FILE), JSON.stringify({ pid: process.pid, start: processStartTime(process.pid) }));
	const socketPath = path.join(runDir, 'chrome-XXXXXX', '.com.google.Chrome.XXXXXX', 'SingletonSocket');   // tests/fixtures/chrome.mjs
	if (socketPath.length > SOCKET_PATH_MAX) say(`run-tests: the run folder ${runDir} is too long for Chrome's lock socket (${socketPath.length} > ${SOCKET_PATH_MAX} characters) -- a browser test will fail to start Chrome; use a shorter TMPDIR`);

	const suite = spawnTethered(process.execPath, ['--test', ...argv], {
		stdio: 'inherit', cwd: process.cwd(), env: { ...process.env, TMPDIR: runDir, [TEST_RUN_ENV]: runDir }, remove: [runDir], report: null,
	});
	// an interrupted runner stops the suite, then still checks and cleans; a runner whose parent has gone is interrupted
	let interrupted = null;
	const interrupt = (signal) => { interrupted ??= signal; try { process.kill(-suite.pid, 'SIGTERM'); } catch { /* ended */ } };
	for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(s, () => interrupt(s));
	const parent = process.ppid;
	setInterval(() => { if (process.ppid !== parent) interrupt('its parent ending'); }, 500).unref();
	const { code, signal } = await new Promise((resolve) => suite.once('exit', (c, s) => resolve({ code: c, signal: s })));

	// 4. what still names the run folder, given time to finish -- a tether removing a profile is one
	let running = processesNaming(runDir);
	const settle = Date.now() + SETTLE_MS;
	while (running.length && Date.now() < settle) { await sleep(100); running = processesNaming(runDir); }
	const stillRunning = running.map((pid) => `pid ${pid}: ${processCommandLine(pid)}`);
	if (running.length) await stopProcessesByPid(running);

	// 5. and 6. what the tethers recorded, and what is left in the folder
	let orphans = [];
	try { orphans = fs.readFileSync(path.join(runDir, TEST_RUN_ORPHAN_LOG), 'utf8').split('\n').filter(Boolean); } catch { /* none */ }
	let names = [];
	try { names = fs.readdirSync(runDir).filter((n) => n !== TEST_RUN_OWNER_FILE && n !== TEST_RUN_ORPHAN_LOG).sort(); } catch { /* gone */ }
	const leftovers = names.map((n) => describeEntry(runDir, n));

	// 7.
	removeScratchTree(runDir);

	const faults = [
		...stillRunning.map((s) => `  a process still running after the suite ended (stopped now) -- ${s}`),
		...orphans.map((s) => `  a process a test left running -- ${s}`),
		...leftovers.map((s) => `  left in the run folder -- ${s}`),
	];
	if (faults.length) {
		say(`\nrun-tests: FAIL -- the run left ${faults.length} thing(s) behind; each test must remove what it makes and stop what it starts (H26-19):`);
		say(faults.join('\n'));
		say(`run-tests: the run folder ${runDir} is removed\n`);
	} else say(`run-tests: nothing left behind -- no process, and nothing in the run folder ${runDir}, now removed`);
	if (interrupted) say(`run-tests: interrupted by ${interrupted}`);
	const suiteFailed = code !== 0 || signal !== null;
	process.exit(suiteFailed ? (code || 1) : faults.length || interrupted ? 1 : 0);
}

await runTestsInRunFolder(process.argv.slice(2));
