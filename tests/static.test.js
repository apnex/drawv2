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
			// RESTATED (H24.16, B386): kept and asked about on every use, where it was never kept -- still never served stale
			assert.equal(r.cache, 'no-cache', p);
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
B386 (H24.16) -- the responder sends a file compressed, and lets the browser keep it while checking for changes.

Every file went uncompressed and `no-store`, so each visit downloaded the page's 134 modules again, about 974 KB. A file now goes
brotli or gzip as the request accepts, the same bytes once decoded; it carries an ETag and `no-cache`, so the browser keeps it and
asks each time whether it changed, and an unchanged file is answered 304 with no body -- a deploy still reaches every tab at once,
because the question is always asked. Driven through the responder itself, over a folder of the test's own, so a changed file
can be shown changing its tag.
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
		const refusedBr = await r.ask('/m.mjs', { 'Accept-Encoding': 'br;q=0, gzip' });
		assert.equal(refusedBr.headers['content-encoding'], 'gzip', 'a coding the request refuses with q=0 is not sent');
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

test('B386: the browser keeps a file and asks whether it changed -- 304 while it has not, the new file once it has', async () => {
	const r = await responder();
	try {
		r.write('m.mjs', MODULE);
		const first = await r.ask('/m.mjs', { 'Accept-Encoding': 'br' });
		assert.equal(first.headers['cache-control'], 'no-cache', 'kept, and asked about on every use -- never served stale');
		const tag = first.headers.etag;
		assert.match(tag, /^"[^"]+"$/, 'a strong tag');
		const again = await r.ask('/m.mjs', { 'Accept-Encoding': 'br', 'If-None-Match': tag });
		assert.equal(again.status, 304, 'unchanged: 304');
		assert.equal(again.body.length, 0, 'with no body');
		assert.equal(again.headers.etag, tag);
		assert.equal((await r.ask('/m.mjs', { 'Accept-Encoding': 'gzip', 'If-None-Match': `W/${tag}` })).status, 304, 'the same file in another coding, asked weakly, is unchanged too');
		assert.equal((await r.ask('/m.mjs', { 'If-None-Match': '"something-else"' })).status, 200, 'a tag it does not hold is answered in full (control)');

		r.write('m.mjs', `${MODULE}// changed by a deploy\n`);
		const changed = await r.ask('/m.mjs', { 'If-None-Match': tag });
		assert.equal(changed.status, 200, 'changed: answered in full');
		assert.notEqual(changed.headers.etag, tag, 'under a new tag');
		assert.match(changed.body.toString(), /changed by a deploy/);
	} finally { await r.close(); }
});

test('B386: HEAD carries the headers and no body; a missing file is still never kept', async () => {
	const r = await responder();
	try {
		r.write('m.mjs', MODULE);
		const head = await r.ask('/m.mjs', { 'Accept-Encoding': 'br' }, 'HEAD');
		assert.equal(head.status, 200);
		assert.equal(head.headers['content-encoding'], 'br');
		assert.ok(head.headers.etag);
		assert.equal(head.body.length, 0);
		const missing = await r.ask('/nothing.mjs');
		assert.equal(missing.status, 404);
		assert.equal(missing.headers['cache-control'], 'no-store', 'a 404 is not kept');
	} finally { await r.close(); }
});
