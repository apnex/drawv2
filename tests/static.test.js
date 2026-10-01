/*
K9 (H17, condition C6) -- the one static responder (server/static.mjs): the traversal guard both servers use, held
against the cases a URL-text check misses.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileWithin } from '../server/static.mjs';

const base = path.resolve('/srv/draw/kernel');

test('K9: a file inside its folder resolves; one that walks out of it does not', () => {
	assert.equal(fileWithin(base, '/geometry.mjs'), path.join(base, 'geometry.mjs'));
	assert.equal(fileWithin(base, '/sub/../geometry.mjs'), path.join(base, 'geometry.mjs'), 'a `..` that stays inside is fine');
	assert.equal(fileWithin(base, '/../package.json'), null, 'out of the folder');
	assert.equal(fileWithin(base, '/../../etc/passwd'), null, 'and further out');
});

test('K9: a SIBLING folder that shares the prefix is outside -- the case `startsWith(baseDir)` let through', () => {
	assert.equal(fileWithin(base, '/../kernel2/secret.mjs'), null, '/srv/draw/kernel2 is not inside /srv/draw/kernel');
	assert.equal(fileWithin(base, '/../kernel-old/x.mjs'), null);
	// the product's guard before K9, for the record: it admitted exactly this
	const old = (b, rel) => { const f = path.normalize(path.join(b, rel)); return f.startsWith(b) ? f : null; };
	assert.notEqual(old(base, '/../kernel2/secret.mjs'), null, 'the guard this replaces did let the sibling through');
});

/*
K9 -- THE LAB'S SERVER, over HTTP. It is a no-API service deployed without IAP (lab.apnex.io), so its one way to be
dangerous is to serve a file it should not: the product's store, or anything a traversal reaches. Booted from the working
tree and asked raw, since `fetch` would normalize the `..` away before sending.
*/
test('K9, K4: the lab serves its mounts, the planner whole, and nothing else, however the path is spelled', async () => {
	const { spawnGroup, stopProcess } = await import('./fixtures/teardown.mjs');
	const http = await import('node:http');
	const net = await import('node:net');
	const port = await new Promise((resolve) => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => resolve(p)); }); });
	const root = new URL('../', import.meta.url).pathname;
	const srv = spawnGroup('node', ['lab/server.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
	const ask = (p, method = 'GET') => new Promise((resolve, reject) => {
		const req = http.request({ host: '127.0.0.1', port, path: p, method }, (res) => { res.resume(); resolve({ status: res.statusCode, type: res.headers['content-type'], cache: res.headers['cache-control'] }); });
		req.on('error', reject); req.end();
	});
	try {
		for (let i = 0; i < 50; i++) { try { await ask('/health'); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
		// K4: the planner is served whole from its own folder
		const tokens = await ask('/tokens.css');   // H15.23: the colour registry the stylesheet reads
		assert.equal(tokens.status, 200, 'the lab serves the colour registry');
		assert.match(tokens.type, /^text\/css/);
		for (const p of ['/kernel/geometry.mjs', '/planner/txn.mjs', '/planner/policy.mjs', '/network/network.mjs']) {
			const r = await ask(p);
			assert.equal(r.status, 200, p);
			assert.match(r.type, /^text\/javascript/, p);
			assert.equal(r.cache, 'no-store', p);
		}
		// K4 (H17-D5): `server/` is not served at all -- the store, identity and anchor above all, and its old planner path too
		for (const p of ['/server/store.js', '/server/identity.mjs', '/server/anchor.mjs', '/server/txn.mjs', '/kernel/../server/store.js',
			'/kernel/%2e%2e/server/store.js', '/server/../package.json', '/model/..%2f..%2fpackage.json', '/package.json',
			// encoded separators whose targets EXIST, so only the guard stops them (a surviving mutant found the gap)
			'/model/..%2fpackage.json', '/kernel/..%2fserver%2fstore.js']) {
			assert.equal((await ask(p)).status, 404, `${p} must not be served`);
		}
		assert.equal((await ask('/kernel/geometry.mjs', 'POST')).status, 405, 'and it takes no writes');
	} finally { await stopProcess(srv); }
});
