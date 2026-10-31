/*
H26.1 (dev/design/components/SNAP-GRID.md section 7.6, guardrail G8) -- EACH SIDE OF THE PARITY PROBE RUNS ON ITS OWN DEPENDENCIES, AND IS
SHOWN TO BEFORE ANYTHING IS MEASURED.

tools/probe/parity.mjs serves a baseline and a candidate commit each from its own worktree, and linked the root's node_modules into
every one -- which would run a revision pinned to one component version on another's files, and answer its page's map with a 404.
So a worktree whose lockfile differs from the root's installs from its own (tools/probe/sides.mjs ownDependencies), and before it
measures, the probe asks each side's servers for every address its pages' import map names, and holds the version the map names to
the version installed on that side (sideProblems); a revision from before the map has nothing to assert. Not the probe itself -- it
needs Chrome, the pinned documents and minutes -- but the two steps it now takes, each driven here beside a control.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { ownDependencies, sideProblems } from '../tools/probe/sides.mjs';
import { scratchFolder } from '@apnex/clean-runner';   // H26-19 as amended: removed when this file ends, however it ends

const ROOT = path.resolve(import.meta.dirname, '..');
const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/@apnex/snap-grid/package.json'), 'utf8'));
const scratch = () => scratchFolder('draw-probe-sides-');

test('H26.1 (G8): a worktree whose lockfile is the root\'s links the root\'s node_modules; one whose lockfile differs installs from its own', () => {
	const root = scratch(), same = scratch(), other = scratch(), installs = [];
	fs.writeFileSync(path.join(root, 'package-lock.json'), '{"lockfileVersion":3,"packages":{"node_modules/@apnex/snap-grid":{"version":"0.1.0"}}}');
	fs.mkdirSync(path.join(root, 'node_modules'));
	fs.copyFileSync(path.join(root, 'package-lock.json'), path.join(same, 'package-lock.json'));
	fs.writeFileSync(path.join(other, 'package-lock.json'), '{"lockfileVersion":3,"packages":{}}');
	const install = (dir) => installs.push(dir);
	assert.equal(ownDependencies(same, root, install), 'linked', 'the same lockfile: the same dependencies, linked');
	assert.equal(fs.readlinkSync(path.join(same, 'node_modules')), path.join(root, 'node_modules'));
	assert.deepEqual(installs, [], 'and nothing installed');
	assert.equal(ownDependencies(other, root, install), 'installed', 'another lockfile: its own dependencies');
	assert.deepEqual(installs, [other], 'installed in the worktree, from its own lockfile');
	assert.equal(fs.existsSync(path.join(other, 'node_modules')), false, 'never the root\'s, linked');
	const none = scratch();
	assert.equal(ownDependencies(none, root, install), 'installed', 'a revision with no lockfile is not the root\'s either');
});

// a side's two servers, as the probe asks them: each page, and every address its import map names
async function fakeSide({ html, vendor = 200 }) {
	const asked = [];
	const server = http.createServer((req, res) => {
		asked.push(req.url);
		if (req.url === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(html); }
		res.writeHead(req.url.startsWith('/vendor/') ? vendor : 404); res.end();
	});
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	return { page: `http://127.0.0.1:${server.address().port}/`, asked, close: () => new Promise((r) => server.close(r)) };
}
const pageWith = (imports) => `<!DOCTYPE html><html><head>\n<script type="importmap">\n${JSON.stringify({ imports }, null, '\t')}\n</script>\n<script type="module" src="/src/main.js"></script></head></html>`;

test('H26.1 (G8): before measuring, each side answers every address its pages\' map names, at the version installed on that side', async () => {
	const at = (v) => ({ '@apnex/snap-grid': `/vendor/@apnex/snap-grid@${v}/index.js`, '@apnex/snap-grid/conformance': `/vendor/@apnex/snap-grid@${v}/conformance.js` });
	const good = await fakeSide({ html: pageWith(at(version)) });
	const stale = await fakeSide({ html: pageWith(at('9.9.9')), vendor: 404 });
	const before = await fakeSide({ html: '<!DOCTYPE html><html><head><script type="module" src="/src/main.js"></script></head></html>' });
	const twice = await fakeSide({ html: pageWith(at(version)) + pageWith(at(version)) });
	try {
		const ok = await sideProblems({ name: 'candidate', root: ROOT, pages: [good.page] });
		assert.deepEqual(ok.problems, [], 'the map names what is installed, and the side serves it (control)');
		assert.deepEqual(ok.checked, [`@apnex/snap-grid@${version}`], 'and says which version it held');
		assert.ok(good.asked.includes(`/vendor/@apnex/snap-grid@${version}/index.js`) && good.asked.includes(`/vendor/@apnex/snap-grid@${version}/conformance.js`), 'every address asked of the side\'s own server');
		const bad = await sideProblems({ name: 'baseline', root: ROOT, pages: [stale.page] });
		assert.ok(bad.problems.some((p) => /baseline: its page's map names @apnex\/snap-grid@9\.9\.9, and @apnex\/snap-grid@[\d.]+ is installed on that side/.test(p)), bad.problems.join('\n'));
		assert.ok(bad.problems.some((p) => /baseline: \/vendor\/@apnex\/snap-grid@9\.9\.9\/index\.js answered 404/.test(p)), bad.problems.join('\n'));
		const none = await sideProblems({ name: 'baseline', root: ROOT, pages: [before.page] });
		assert.deepEqual(none, { problems: [], checked: [] }, 'a revision before the map has nothing to assert');
		assert.ok((await sideProblems({ name: 'candidate', root: ROOT, pages: [twice.page] })).problems.some((p) => /holds 2 import maps/.test(p)));
		const empty = scratch();
		assert.ok((await sideProblems({ name: 'baseline', root: empty, pages: [good.page] })).problems.some((p) => /none is installed on that side/.test(p)), 'a side with nothing installed');
	} finally { await Promise.all([good, stale, before, twice].map((s) => s.close())); }
});

test('H26.1 (G8): this tree\'s two real servers pass the check the probe makes of a side -- the product page and the lab page', { timeout: 60000 }, async () => {
	const { spawnTethered, stopGroup } = await import('@apnex/clean-runner');   // H26-19 as amended: each server ends with this file
	const { startLab } = await import('./fixtures/lab-server.mjs');   // H26.5 (the verifier's finding 1): started and waited for in one place
	const free = () => new Promise((resolve) => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => resolve(p)); }); });
	const port = await free();
	const data = scratch();
	const env = { PATH: process.env.PATH, HOME: process.env.HOME };
	const procs = [spawnTethered('node', ['server/server.js'], { cwd: ROOT, env: { ...env, PORT: String(port), DATA_DIR: data }, stdio: 'ignore' })];
	try {
		const lab = await startLab({ env });
		procs.push(lab.proc);
		const labPort = lab.port;
		for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) break; } catch { /* not up */ } await new Promise((r) => setTimeout(r, 100)); }
		const r = await sideProblems({ name: 'candidate', root: ROOT, pages: [`http://127.0.0.1:${port}/`, `http://127.0.0.1:${labPort}/`] });
		// RESTATED at H26.2: the map names the second component, input-binding, which each server answers at its installed version
		const binding = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/@apnex/input-binding/package.json'), 'utf8')).version;
		// RESTATED at H26.3: and the third, input-capture
		const capture = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/@apnex/input-capture/package.json'), 'utf8')).version;
		// RESTATED at H26.4: and the fourth, vector-scene
		const scene = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/@apnex/vector-scene/package.json'), 'utf8')).version;
		assert.deepEqual(r, { problems: [], checked: [`@apnex/input-binding@${binding}`, `@apnex/input-capture@${capture}`, `@apnex/snap-grid@${version}`, `@apnex/vector-scene@${scene}`] });
	} finally { for (const p of procs) await stopGroup(p.pid); }
});
