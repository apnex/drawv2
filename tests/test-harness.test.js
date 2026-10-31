/*
H26-19 as amended (B428, H26.10) -- draw's tests run on `@apnex/test-harness`, and nothing of it ships.

H26-19 had draw's gate run its tests in a folder of their own and fail on anything left, with a runner, a tether, a Chrome launcher and
a scratch helper of draw's own; the four components and `input-tester` each needed the same, so the director ruled one shared
component, `test-harness`, which every repository uses in its tests alone, pinned to its release file, so that nothing of it reaches
what the repository ships. What stays draw's own is what the harness's survey says it keeps -- its servers and the lab, its pages,
its `ws` client, its probes' steps and the flags only its harnesses add.

These tests hold draw's use of it: the suite runs under its runner; it is pinned as a devDependency by its release file; it never reaches
the image -- installed with `npm ci --omit=dev`, imported by nothing the image copies (tools/scan-layers.mjs L12 refuses that too), and
not served by the vendor mount, which serves only what `dependencies` names; and what draw's own fixtures start through it -- Chrome,
the lab, the product's server and a scratch folder -- ends with a harness killed by SIGKILL, leaving nothing. The harness's own tests
hold its rules (its CONTRACT.md, TH1 to TH8); this last one holds that draw's fixtures use them, as the kill that found a Chrome and two
servers running after a verifier's session was cut off would.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { processesNaming } from '@apnex/test-harness';
import { NO_CHROME } from './fixtures/chrome.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const HARNESS = '@apnex/test-harness';
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
const installed = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules', HARNESS, 'package.json'), 'utf8'));

test('H26-19 as amended: `npm test` -- and with it the gate and CI -- runs the suite under the harness\'s runner', () => {
	assert.match(pkg.scripts.test, /^test-harness run /, 'the runner gives the run a folder of its own and fails on anything left');
	assert.doesNotMatch(pkg.scripts.test, /--test-force-exit/, 'no forced exit: on Node.js 22 it can drop a file\'s reported results while the run still passes (found switching snap-grid; draw counted the same 2,644 either way)');
	assert.match(pkg.scripts.test, / tests\/\*\.test\.js$/, 'every test file');
	assert.ok(pkg.scripts.gate.split(/\s*&&\s*/).includes('npm test'), 'the gate runs it');
	assert.equal(installed.bin?.['test-harness'], 'dist/cli.js', 'the command is the installed harness\'s own');
	for (const gone of ['tools/run-tests.mjs', 'tools/process-tether.mjs', 'tools/chrome-profile.mjs', 'tests/fixtures/teardown.mjs']) assert.equal(fs.existsSync(path.join(ROOT, gone)), false, `${gone}, draw's copy, is deleted`);
});

test('H26-19 as amended: the harness is a devDependency, pinned by its release file and its hash', () => {
	const spec = pkg.devDependencies?.[HARNESS];
	const v = installed.version;
	assert.equal(spec, `https://github.com/apnex/test-harness/releases/download/v${v}/apnex-test-harness-${v}.tgz`, 'named by the release file of the version installed');
	assert.equal(pkg.dependencies?.[HARNESS], undefined, 'and not among what draw runs on');
	const entry = lock.packages[`node_modules/${HARNESS}`];
	assert.equal(entry.resolved, spec, 'the lockfile resolves the same file');
	assert.match(entry.integrity, /^sha512-[A-Za-z0-9+/]{86}==$/, 'and pins its hash, so `npm ci` refuses any other');
	assert.equal(entry.dev, true, 'as a development dependency');
});

test('H26-19 as amended: nothing of the harness reaches the image -- installed without dev dependencies, imported by nothing it copies', () => {
	const dockerfile = fs.readFileSync(path.join(ROOT, 'Dockerfile'), 'utf8');
	const installs = dockerfile.split('\n').filter((l) => /^RUN\b.*\bnpm (ci|install)\b/.test(l));
	assert.deepEqual(installs, ['RUN npm ci --omit=dev'], 'the image installs once, leaving out the dev dependencies');
	const copied = [...dockerfile.matchAll(/^COPY (\S+)\/ \S+$/gm)].map((m) => m[1]);
	assert.ok(copied.length >= 5 && copied.includes('server') && copied.includes('app'), `control: the folders the image copies are read: ${copied}`);
	const naming = [];
	const walk = (dir) => {
		for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
			const rel = `${dir}/${e.name}`;
			if (e.isDirectory()) walk(rel);
			else if (fs.readFileSync(path.join(ROOT, rel), 'utf8').includes(HARNESS)) naming.push(rel);
		}
	};
	for (const dir of copied) walk(dir);
	assert.deepEqual(naming, [], 'no file the image copies names the harness');
});

test('H26-19 as amended: the vendor mount does not serve the harness, though it is installed beside the components', async () => {
	const { sendVendored } = await import('../server/static.mjs');
	const server = http.createServer((req, res) => { if (!sendVendored(req, res)) { res.writeHead(500); res.end(); } });
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const at = (p) => fetch(`http://127.0.0.1:${server.address().port}${p}`).then((r) => r.status);
	try {
		const component = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/@apnex/snap-grid/package.json'), 'utf8')).version;
		assert.equal(await at(`/vendor/@apnex/snap-grid@${component}/index.js`), 200, 'control: a component draw runs on is served');
		assert.ok(fs.existsSync(path.join(ROOT, 'node_modules', HARNESS, 'dist/index.js')), 'control: the harness is installed');
		assert.equal(await at(`/vendor/${HARNESS}@${installed.version}/index.js`), 404, 'the harness is not');
	} finally { server.close(); }
});

/*
H26-19's kill test, restated on the harness: a harness that launched Chrome, the lab and the product's server and made a scratch folder,
through the fixtures every browser test uses, is killed by SIGKILL -- which runs no handler of its own -- and within a bounded wait no
process naming its folder or Chrome's launch folder is left, every group it started is gone, and the launch folder (the profile and the
lock folder in it) and the scratch folder are removed. Against e3833cd's fixtures the same harness left 16 processes running 10 s after
the kill, with the lock folder and the profile; against draw's own tether, nothing ran on but its scratch folder stayed.
*/
const groupGone = (pgid) => { try { process.kill(-pgid, 0); return false; } catch (e) { return e.code === 'ESRCH'; } };
async function until(fn, ms) { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 50)); } return fn(); }
const LOCK_FOLDER = /^\.?com\.google\.Chrome\.[A-Za-z0-9]{6}$/;

test('H26-19 as amended: a harness killed by SIGKILL leaves no Chrome, no server and no folder behind', { skip: NO_CHROME, timeout: 60000 }, async () => {
	const body = `
		import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import net from 'node:net';
		import { launchChrome, scratchFolder, spawnTethered } from '@apnex/test-harness';
		import { startLab } from ${JSON.stringify(new URL('./fixtures/lab-server.mjs', import.meta.url).href)};
		const dir = scratchFolder('h-');
		const chrome = await launchChrome();
		const base = { PATH: process.env.PATH, HOME: process.env.HOME };
		const lab = await startLab({ env: { ...base, TMPDIR: os.tmpdir(), HARNESS_DIR: dir } });
		const port = await new Promise((resolve) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
		const srv = spawnTethered('node', ['server/server.js'], { env: { ...base, PORT: String(port), DATA_DIR: path.join(dir, 'data') } });
		for (let i = 0; i < 150; i++) { try { if ((await fetch('http://127.0.0.1:' + port + '/health')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
		process.stdout.write('ready ' + JSON.stringify({ dir, port, cdp: chrome.port, folder: chrome.folder, groups: [chrome.pid, lab.proc.pid, srv.pid] }) + '\\n');
		setInterval(() => {}, 1000);
	`;
	// its run report turned off: what it leaves is meant for its tethers and its warden to clean, not a fault of this run
	const child = spawn(process.execPath, ['--input-type=module', '-e', body], { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, TEST_HARNESS_RUN: '' } });
	try {
		const { dir, port, cdp, folder, groups } = await new Promise((resolve, reject) => {
			let out = '';
			child.stdout.on('data', (d) => { out += d; const m = out.match(/^ready (.*)\n/m); if (m) resolve(JSON.parse(m[1])); });
			child.once('exit', (code, signal) => reject(new Error(`the harness ended before it was ready (${code ?? signal}): ${out}`)));
		});
		assert.ok(fs.readdirSync(folder).some((n) => LOCK_FOLDER.test(n)), 'control: Chrome made its lock folder, in its launch folder');
		assert.ok((await fetch(`http://127.0.0.1:${cdp}/json/version`)).ok, 'control: Chrome answers on the port the system gave it');
		assert.ok((await fetch(`http://127.0.0.1:${port}/health`)).ok, 'control: the product\'s server answers');
		assert.deepEqual(groups.map(groupGone), [false, false, false], 'control: Chrome, the lab and the server run while the harness does');
		assert.ok(processesNaming(dir).length >= 2 && processesNaming(folder).length >= 1, 'control: they are found by the folders they name');

		child.kill('SIGKILL');
		await new Promise((r) => (child.exitCode !== null || child.signalCode !== null ? r() : child.once('exit', r)));
		const running = () => [...new Set([...processesNaming(dir), ...processesNaming(folder)])];
		const clear = await until(() => running().length === 0 && groups.every(groupGone), 15000);
		assert.ok(clear, `processes outlived the harness killed by SIGKILL: ${running().map((pid) => `${pid}: ${fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').replace(/\0/g, ' ').slice(0, 120)}`).join('; ')}`);
		assert.ok(await until(() => !fs.existsSync(folder) && !fs.existsSync(dir), 5000), `left behind: ${[folder, dir].filter((p) => fs.existsSync(p)).join(', ')}`);
	} finally { child.kill('SIGKILL'); }   // a failed control must not leave the harness holding this file open
});
