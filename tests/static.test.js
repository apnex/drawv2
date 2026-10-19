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
		for (const p of ['/kernel/geometry.mjs', '/planner/txn.mjs', '/planner/log.mjs', '/network/network.mjs']) {
			const r = await ask(p);
			assert.equal(r.status, 200, p);
			assert.match(r.type, /^text\/javascript/, p);
			assert.equal(r.cache, 'no-store', p);   // never kept (H24.16-1): a kept module runs stale after Back or a restore
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

/*
B386 (H24.16, H24.16-1) -- the responder sends a file compressed, and never lets the browser keep it.

Every file went uncompressed, so each visit downloaded the page's files at full size. A file now goes brotli or gzip as the request
accepts, the same bytes once decoded, and stays `no-store`: the first build let the browser keep files and ask on every use, and
its verification found Chrome running the old modules after a deploy when the page is reached by Back or a restored session, which
do not ask. RESTATED (H24.16-1): the test of keeping is now the test of never keeping. Driven through the responder itself, over a
folder of the test's own, so a changed file can be shown served at once.
*/
async function responder() {
	const fs = await import('node:fs');
	const os = await import('node:os');
	const http = await import('node:http');
	const { sendFile } = await import('../server/static.mjs');
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-static-'));
	const server = http.createServer((req, res) => sendFile(req, res, fileWithin(dir, new URL(req.url, 'http://x').pathname)));
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const ask = (p, headers = {}, method = 'GET') => new Promise((resolve, reject) => {
		const req = http.request({ host: '127.0.0.1', port: server.address().port, path: p, method, headers }, (res) => {
			const parts = []; res.on('data', (c) => parts.push(c)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(parts) }));
		});
		req.on('error', reject); req.end();
	});
	return { dir, ask, write: (name, text) => fs.writeFileSync(path.join(dir, name), text), close: () => new Promise((r) => server.close(r)) };
}
const MODULE = `// a module large enough to be worth compressing\n${'export const word = "compressible";\n'.repeat(200)}`;

test('B386: a file goes brotli or gzip as the request accepts -- the same bytes decoded -- and as it is when nothing is accepted', async () => {
	const zlib = await import('node:zlib');
	const r = await responder();
	try {
		r.write('m.mjs', MODULE);
		const br = await r.ask('/m.mjs', { 'Accept-Encoding': 'gzip, deflate, br' });
		assert.equal(br.headers['content-encoding'], 'br', 'brotli when the request accepts it');
		assert.equal(zlib.brotliDecompressSync(br.body).toString(), MODULE, 'and it decodes to the file');
		assert.ok(br.body.length < MODULE.length / 4, 'much smaller than the file');
		const gz = await r.ask('/m.mjs', { 'Accept-Encoding': 'gzip' });
		assert.equal(gz.headers['content-encoding'], 'gzip', 'gzip when that is what it accepts');
		assert.equal(zlib.gunzipSync(gz.body).toString(), MODULE);
		for (const refusing of ['br;q=0, gzip', 'br;Q=0, gzip', 'br;q=0.0, gzip']) {
			assert.equal((await r.ask('/m.mjs', { 'Accept-Encoding': refusing })).headers['content-encoding'], 'gzip', `"${refusing}" refuses brotli`);
		}
		const plain = await r.ask('/m.mjs');
		assert.equal(plain.headers['content-encoding'], undefined, 'nothing accepted, nothing encoded');
		assert.equal(plain.body.toString(), MODULE);
		for (const res of [br, gz, plain]) {
			assert.match(res.headers['content-type'], /^text\/javascript/);
			assert.equal(res.headers.vary, 'Accept-Encoding', 'a cache keeps one copy per coding');
			assert.equal(Number(res.headers['content-length']), res.body.length);
		}
	} finally { await r.close(); }
});

test('B386: text of every kind is compressed, a small file and a picture are sent as they are', async () => {
	const r = await responder();
	try {
		const svg = `<svg xmlns="http://www.w3.org/2000/svg">${'<rect width="1" height="1"/>'.repeat(60)}</svg>`;
		const json = JSON.stringify({ rows: Array.from({ length: 80 }, (_, i) => ({ i, word: 'compressible' })) });
		r.write('a.svg', svg); r.write('a.json', json); r.write('a.css', `.x { color: red; }\n`.repeat(60));
		r.write('small.mjs', 'export const x = 1;\n'); r.write('a.png', Buffer.alloc(4096, 7));
		for (const f of ['a.svg', 'a.json', 'a.css']) assert.equal((await r.ask(`/${f}`, { 'Accept-Encoding': 'br' })).headers['content-encoding'], 'br', f);
		const small = await r.ask('/small.mjs', { 'Accept-Encoding': 'br' });
		assert.equal(small.headers['content-encoding'], undefined, 'a file under 512 bytes is not worth compressing');
		assert.equal(small.body.toString(), 'export const x = 1;\n');
		assert.equal((await r.ask('/a.png', { 'Accept-Encoding': 'br' })).headers['content-encoding'], undefined, 'a picture is not text');
	} finally { await r.close(); }
});

test('B386: a file is never kept -- no-store on every answer, no tag to ask with, and a changed file served at once', async () => {
	const zlib = await import('node:zlib');
	const r = await responder();
	try {
		r.write('m.mjs', MODULE);
		const first = await r.ask('/m.mjs', { 'Accept-Encoding': 'br' });
		assert.equal(first.headers['cache-control'], 'no-store', 'never kept: a kept module is run stale after Back or a restore');
		assert.equal(first.headers.etag, undefined, 'no tag, so nothing invites a browser to keep it');
		const asked = await r.ask('/m.mjs', { 'Accept-Encoding': 'br', 'If-None-Match': '*' });
		assert.equal(asked.status, 200, 'a request that asks whether it changed is answered in full');
		assert.ok(asked.body.length > 0);
		const changed = MODULE.replace('compressible', 'Compressible');   // the same length, written at once
		r.write('m.mjs', changed);
		const after = await r.ask('/m.mjs', { 'Accept-Encoding': 'br' });
		assert.equal(zlib.brotliDecompressSync(after.body).toString(), changed, 'the new content, never the coding of the old');
		assert.equal((await r.ask('/m.mjs')).body.toString(), changed, 'and as it is');
	} finally { await r.close(); }
});

test('B386: HEAD carries the headers and no body; a missing file is never kept', async () => {
	const r = await responder();
	try {
		r.write('m.mjs', MODULE);
		const head = await r.ask('/m.mjs', { 'Accept-Encoding': 'br' }, 'HEAD');
		assert.equal(head.status, 200);
		assert.equal(head.headers['content-encoding'], 'br');
		assert.equal(head.headers['cache-control'], 'no-store');
		assert.equal(head.body.length, 0);
		const missing = await r.ask('/nothing.mjs');
		assert.equal(missing.status, 404);
		assert.equal(missing.headers['cache-control'], 'no-store', 'a 404 is not kept');
	} finally { await r.close(); }
});
