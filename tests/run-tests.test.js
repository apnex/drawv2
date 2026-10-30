/*
H26-19 -- a run that leaves a file, a folder or a process fails, naming it, and leaves nothing (tools/run-tests.mjs).

One gate run left 234 entries in its temporary folder, and thousands had piled up, because nothing failed when a test left one. So
`npm test` runs the suite in a run folder of its own and fails on what is left. Each test here plants a test file that leaves one
thing -- a folder, a folder named as Chrome's lock folder, a Chrome launched through the fixture and never stopped, a process started
outside every fixture -- runs the runner on it, and holds that the run fails naming that thing, that nothing of it survives the run,
and that the run folder is gone. A planted test that removes and stops what it makes is the control: the runner passes it. And a run
folder whose runner is gone -- killed before it could clean up -- is removed by the next run's start, with what still runs in it,
while a running runner's folder is left alone.

Each runner here is tethered to this file's process (tools/process-tether.mjs), so this file killed takes it, and its run, with it.
*/
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnTethered, processStartTime, processesNaming } from '../tools/process-tether.mjs';
import { NO_CHROME } from './fixtures/chrome.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const RUNNER = path.join(ROOT, 'tools/run-tests.mjs');
const PLANTED = (name) => path.join(ROOT, 'tests/fixtures/run-tests', name);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const made = [];
after(() => { for (const d of made) fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
const scratch = (prefix) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); made.push(d); return d; };
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

// the runner on `files`, with `base` as its caller's temporary folder; answers its exit code and everything it printed. Not as a
// test file's child: node --test inside a test file runs no files at all (NODE_TEST_CONTEXT), and a run of nothing leaves nothing
function runRunner(files, base) {
	const env = { ...process.env, TMPDIR: base };
	delete env.NODE_TEST_CONTEXT;
	return new Promise((resolve) => {
		const p = spawnTethered(process.execPath, [RUNNER, '--test-reporter=tap', ...files], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], env });
		let out = '';
		p.stdout.on('data', (d) => { out += d; });
		p.stderr.on('data', (d) => { out += d; });
		p.once('exit', (code) => resolve({ code, out }));
	});
}
const runFolders = (base) => fs.readdirSync(base).filter((n) => n.startsWith('draw-run-'));

test('H26-19: a run whose tests remove and stop what they make passes, and leaves nothing -- the control', { timeout: 60000 }, async () => {
	const base = scratch('rt-');
	const { code, out } = await runRunner([PLANTED('clean.mjs')], base);
	assert.match(out, /^ok 1 - makes a folder and starts a process, then removes and stops both$/m, `control: the planted test ran: ${out}`);
	assert.equal(code, 0, out);
	assert.match(out, /run-tests: nothing left behind/);
	assert.deepEqual(fs.readdirSync(base), [], 'the run folder is removed');
});

test('H26-19: a test that leaves a folder fails the run, which names the folder and removes it', { timeout: 60000 }, async () => {
	const base = scratch('rt-');
	const { code, out } = await runRunner([PLANTED('leaves-a-folder.mjs')], base);
	assert.match(out, /^ok 1 - makes a folder and leaves it$/m, `control: the planted test ran, and passed: ${out}`);
	assert.equal(code, 1, out);
	assert.match(out, /run-tests: FAIL/);
	assert.match(out, /left in the run folder -- planted-leak-[A-Za-z0-9]{6} -- a folder of 1 entry/, 'named, with what it holds');
	assert.deepEqual(fs.readdirSync(base), [], 'and removed with the run folder');
});

test('H26-19: a test that leaves a Chrome lock folder fails the run, which names it', { timeout: 60000 }, async () => {
	const base = scratch('rt-');
	const { code, out } = await runRunner([PLANTED('leaves-a-lock-folder.mjs')], base);
	assert.match(out, /^ok 1 - leaves a lock folder in the temporary folder$/m, `control: the planted test ran, and passed: ${out}`);
	assert.equal(code, 1, out);
	assert.match(out, /left in the run folder -- \.com\.google\.Chrome\.Pl4nt1 -- a folder of 0 entries, named as Chrome names its lock folder/);
	assert.deepEqual(fs.readdirSync(base), []);
});

test('H26-19: a test that leaves a process of its own running fails the run, which names it and stops it', { timeout: 90000 }, async () => {
	const base = scratch('rt-');
	const { code, out } = await runRunner([PLANTED('leaves-a-process.mjs')], base);
	const pid = Number(out.match(/planted pid (\d+)/)?.[1]);
	assert.ok(pid > 0, `control: the planted test started its process: ${out}`);
	assert.equal(code, 1, out);
	assert.match(out, new RegExp(`a process still running after the suite ended \\(stopped now\\) -- pid ${pid}: sleep 600`));
	assert.equal(alive(pid), false, 'and it is stopped');
	assert.deepEqual(fs.readdirSync(base), []);
});

test('H26-19: a test that leaves its Chrome running fails the run, which names the test and the Chrome; nothing of it survives', { skip: NO_CHROME, timeout: 90000 }, async () => {
	// Chrome's lock socket must fit a socket address (tools/run-tests.mjs), and a run folder inside this run's is one level too deep
	// on a long TMPDIR -- so this runner's caller's folder is the one this run was given, and its run folder sits beside this one
	const base = process.env.DRAW_TEST_RUN && os.tmpdir() === process.env.DRAW_TEST_RUN ? path.dirname(os.tmpdir()) : os.tmpdir();
	const before = new Set(runFolders(base));
	const { code, out } = await runRunner([PLANTED('leaves-chrome.mjs')], base);
	assert.match(out, /^ok 1 - launches Chrome and never stops it$/m, `control: the planted test ran, and passed: ${out}`);
	assert.equal(code, 1, out);
	assert.match(out, /a process a test left running -- \S*tests\/fixtures\/run-tests\/leaves-chrome\.mjs \(pid \d+\) ended with `\S*chrome --headless=new/);
	const theirs = runFolders(base).filter((n) => !before.has(n));
	assert.deepEqual(theirs, [], 'the run folder is removed');
	const chromes = spawnSync('pgrep', ['-f', 'planted-profile-'], { encoding: 'utf8' }).stdout.trim();
	assert.equal(chromes, '', 'no Chrome of the planted test is running');
});

test('H26-19: a run folder whose runner is gone is removed when the next run starts, with what still runs in it; a live one is not', { timeout: 60000 }, async () => {
	const base = scratch('rt-');
	const plant = (name, owner) => {
		const folder = path.join(base, name);
		fs.mkdirSync(folder);
		fs.writeFileSync(path.join(folder, '.draw-run-owner'), JSON.stringify(owner));
		fs.writeFileSync(path.join(folder, 'left'), 'left');
		return folder;
	};
	const gonePid = Number(spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8' }).stdout);
	const dead = plant('draw-run-Dead01', { pid: gonePid, start: '1' });
	const reused = plant('draw-run-Reuse1', { pid: process.pid, start: '0' });   // a pid now another process's: its start differs
	const live = plant('draw-run-Live01', { pid: process.pid, start: processStartTime(process.pid) });
	const straggler = spawn('sleep', ['600'], { cwd: dead, detached: true, stdio: 'ignore' });   // a process of the killed run, in its folder
	straggler.unref();
	await sleep(100);
	assert.deepEqual(processesNaming(dead), [straggler.pid], 'control: the straggler is found by the folder it runs in');

	const { code, out } = await runRunner([PLANTED('clean.mjs')], base);
	assert.match(out, /^ok 1 - makes a folder and starts a process/m, `control: the planted test ran: ${out}`);
	assert.equal(code, 0, out);
	assert.match(out, new RegExp(`removed a stale run folder, ${dead.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} -- its runner, pid ${gonePid}, is gone`));
	assert.match(out, /removed a stale run folder, \S*draw-run-Reuse1/);
	assert.equal(fs.existsSync(dead), false, 'the dead runner\'s folder is removed');
	assert.equal(fs.existsSync(reused), false, 'and the folder of a runner whose pid is now another process\'s');
	assert.equal(alive(straggler.pid), false, 'with the process still running in it');
	assert.equal(fs.existsSync(live), true, 'a running runner\'s folder is left alone');
	try { process.kill(straggler.pid, 'SIGKILL'); } catch { /* stopped, as asserted */ }
});
