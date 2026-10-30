/*
H26-19 -- a process a test or a probe starts ends with the process that started it, even when that one is killed by SIGKILL
(tools/process-tether.mjs).

A headless Chrome and two draw servers were found running after a verifier's session was cut off: the harness that started them was
killed before its `after` hook, and a SIGKILL runs no handler. The kill test below does what that session's end did -- it starts a
harness that launches Chrome and both servers through the fixtures every harness uses, SIGKILLs it, and holds that within a bounded
wait no process naming its folder is left, every group it started is gone, and Chrome's profile and the lock folder Chrome makes in
the temporary folder are removed. Before the tether, the same test found Chrome and both servers still running.

The rest pin what a caller sees while the starter lives, which must not change: the command's exit code or signal, its output, its
group stopped by one signal; and the warden that removes a probe's worktree once the probe is gone.
*/
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnTethered, processesNaming } from '../tools/process-tether.mjs';
import { CHROME_LOCK_FOLDER_NAME } from '../tools/chrome-profile.mjs';
import { NO_CHROME } from './fixtures/chrome.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const made = [];
after(() => { for (const d of made) fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
const scratch = (prefix) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); made.push(d); return d; };
const groupGone = (pgid) => { try { process.kill(-pgid, 0); return false; } catch (e) { return e.code === 'ESRCH'; } };
const exitOf = (p) => new Promise((resolve) => p.once('exit', (code, signal) => resolve({ code, signal })));
async function until(fn, ms) { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await sleep(50); } return fn(); }

// a starter that runs `body` (an ES module source) with this run's report turned off -- what it leaves is meant to be cleaned
function starter(body, env = {}) {
	const child = spawn(process.execPath, ['--input-type=module', '-e', body], { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, DRAW_TEST_RUN: '', ...env } });
	const ready = new Promise((resolve, reject) => {
		let out = '';
		child.stdout.on('data', (d) => { out += d; const m = out.match(/^ready (.*)\n/m); if (m) resolve(JSON.parse(m[1])); });
		child.once('exit', (code, signal) => reject(new Error(`the starter ended before it was ready (${code ?? signal}): ${out}`)));
	});
	return { child, ready };
}
const url = (rel) => JSON.stringify(new URL(rel, import.meta.url).href);

test('H26-19: a harness killed by SIGKILL leaves no Chrome, no server, no profile and no lock folder behind', { skip: NO_CHROME, timeout: 60000 }, async () => {
	// the harness's folder names every process it starts: Chrome's profile and the server's data are in it, the lab is handed its name.
	// Not a temporary folder of its own: one level deeper and Chrome's lock socket no longer fits a socket address (tools/run-tests.mjs)
	const { child, ready } = starter(`
		import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
		const { launchChrome, chromeDebugPort } = await import(${url('./fixtures/chrome.mjs')});
		const { spawnGroup } = await import(${url('./fixtures/teardown.mjs')});
		const { startLab } = await import(${url('./fixtures/lab-server.mjs')});
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'h-'));
		const chrome = launchChrome({ profileDir: path.join(dir, 'profile'), url: 'about:blank' });
		const cdp = await chromeDebugPort(chrome);
		const lab = await startLab({ env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: os.tmpdir(), HARNESS_DIR: dir } });
		const net = await import('node:net');
		const port = await new Promise((resolve) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
		const srv = spawnGroup('node', ['server/server.js'], { env: { PATH: process.env.PATH, HOME: process.env.HOME, PORT: String(port), DATA_DIR: path.join(dir, 'data') }, stdio: 'ignore' });
		for (let i = 0; i < 150; i++) { try { if ((await fetch('http://127.0.0.1:' + port + '/health')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
		process.stdout.write('ready ' + JSON.stringify({ dir, cdp, groups: [chrome.pid, lab.proc.pid, srv.pid], lock: fs.readlinkSync(path.join(dir, 'profile', 'SingletonSocket')) }) + '\\n');
		setInterval(() => {}, 1000);
	`);
	try {
		const { dir, cdp, groups, lock } = await ready;
		made.push(dir);   // the harness's own folder, which nothing but its teardown would have removed
		const lockFolder = path.dirname(lock), chromeTemp = path.dirname(lockFolder);
		assert.match(path.basename(lockFolder), CHROME_LOCK_FOLDER_NAME, 'control: Chrome made its lock folder');
		assert.match(path.basename(chromeTemp), /^chrome-/, 'control: in the temporary folder the fixture gave Chrome');
		assert.ok((await fetch(`http://127.0.0.1:${cdp}/json/version`)).ok, 'control: Chrome answers on the port the system gave it');
		assert.deepEqual(groups.map(groupGone), [false, false, false], 'control: Chrome, the lab and the server run while the harness does');
		assert.ok(processesNaming(dir).length >= 6, 'control: the processes -- three, each with its tether -- are found by the folder they name');

		child.kill('SIGKILL');
		await exitOf(child);
		const clear = await until(() => processesNaming(dir).length === 0 && groups.every(groupGone), 15000);
		const left = processesNaming(dir).map((pid) => `${pid}: ${fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').replace(/\0/g, ' ').slice(0, 120)}`);
		assert.ok(clear, `processes outlived the harness killed by SIGKILL:\n  ${left.join('\n  ')}`);
		const gone = [lockFolder, chromeTemp, path.join(dir, 'profile')];
		assert.ok(await until(() => gone.every((p) => !fs.existsSync(p)), 5000), `left behind: ${gone.filter((p) => fs.existsSync(p)).join(', ')}`);
	} finally { child.kill('SIGKILL'); }   // a failed control must not leave the harness holding this file open
});

test('H26-19: while its starter lives, a tethered command\'s exit code, output and signal are the caller\'s to see', { timeout: 15000 }, async () => {
	const coded = spawnTethered(process.execPath, ['-e', 'process.stdout.write("said"); process.exit(3)'], { stdio: ['ignore', 'pipe', 'inherit'] });
	let out = ''; coded.stdout.on('data', (d) => { out += d; });
	assert.deepEqual(await exitOf(coded), { code: 3, signal: null }, 'the command\'s exit code');
	assert.equal(out, 'said', 'the command\'s output, through the tether');

	const held = spawnTethered(process.execPath, ['-e', 'process.stdout.write("up\\n"); setInterval(() => {}, 1000)'], { stdio: ['ignore', 'pipe', 'inherit'] });
	await new Promise((resolve) => held.stdout.once('data', resolve));
	process.kill(-held.pid, 'SIGTERM');   // the group, as tests/fixtures/teardown.mjs stops one
	assert.deepEqual(await exitOf(held), { code: null, signal: 'SIGTERM' }, 'a group signalled ends as the command ended, of the signal');
	assert.ok(await until(() => groupGone(held.pid), 3000), 'and nothing of the group is left');
});

test('H26-19: what a tethered command starts in its group ends when the command does', { timeout: 15000 }, async () => {
	const t = spawnTethered('sh', ['-c', 'sleep 600 & echo $!; exit 0'], { stdio: ['ignore', 'pipe', 'inherit'] });
	const grandchild = await new Promise((resolve) => t.stdout.once('data', (d) => resolve(Number(String(d).trim()))));
	assert.deepEqual(await exitOf(t), { code: 0, signal: null });
	assert.ok(await until(() => { try { process.kill(grandchild, 0); return false; } catch { return true; } }, 7000), 'the sleep the shell left in its group is stopped');
});

test('H26-19: a warden removes a git worktree, and its registration, once the process that made it is killed', { timeout: 30000 }, async () => {
	const repo = scratch('tw-');
	const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
	git('init', '-q'); git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'one');
	const tree = path.join(repo, 'tree-side');
	const { child, ready } = starter(`
		const { spawnCleanupWarden } = await import(${url('../tools/process-tether.mjs')});
		const { execFileSync } = await import('node:child_process');
		spawnCleanupWarden({ worktrees: [{ path: ${JSON.stringify(tree)}, repo: ${JSON.stringify(repo)} }] });
		execFileSync('git', ['worktree', 'add', '-q', '--detach', ${JSON.stringify(tree)}], { cwd: ${JSON.stringify(repo)}, stdio: 'ignore' });
		process.stdout.write('ready {}\\n');
		setInterval(() => {}, 1000);
	`);
	try {
		await ready;
		assert.ok(fs.existsSync(tree) && git('worktree', 'list').includes(tree), 'control: the worktree is made and registered');
		child.kill('SIGKILL');
		await exitOf(child);
		assert.ok(await until(() => !fs.existsSync(tree) && !git('worktree', 'list').includes(tree), 15000),
			`the worktree outlived the process killed by SIGKILL: ${git('worktree', 'list')}`);
	} finally { child.kill('SIGKILL'); }
});
