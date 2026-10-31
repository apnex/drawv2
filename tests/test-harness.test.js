/*
H26-19 as amended (B428, H26.10) -- draw's tests run on `@apnex/test-harness`, and nothing of it ships.

H26-19 had draw's gate run its tests in a folder of their own and fail on anything left, with a runner, a tether, a Chrome launcher and
a scratch helper of draw's own; the four components and `input-tester` each needed the same, so the director ruled one shared
component, `test-harness`, which every repository uses in its tests alone, pinned to its release file, so that nothing of it reaches
what the repository ships. What stays draw's own is what the harness's survey says it keeps -- its servers and the lab, its pages,
its `ws` client, its probes' steps and the flags only its harnesses add.

These tests hold draw's use of it: it is pinned as a devDependency by its release file, and it never reaches the image -- installed
with `npm ci --omit=dev`, imported by nothing the image copies (tools/scan-layers.mjs L12 refuses that too), and not served by the
vendor mount, which serves only what `dependencies` names.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const HARNESS = '@apnex/test-harness';
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
const installed = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules', HARNESS, 'package.json'), 'utf8'));

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
