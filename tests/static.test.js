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
	const { stopProcess } = await import('./fixtures/teardown.mjs');
	const { startLab } = await import('./fixtures/lab-server.mjs');   // H26.5: started and waited for in one place
	const http = await import('node:http');
	const { proc: srv, port } = await startLab();
	const ask = (p, method = 'GET') => new Promise((resolve, reject) => {
		const req = http.request({ host: '127.0.0.1', port, path: p, method }, (res) => { res.resume(); resolve({ status: res.statusCode, type: res.headers['content-type'], cache: res.headers['cache-control'] }); });
		req.on('error', reject); req.end();
	});
	try {
		// K4: the planner is served whole from its own folder
		const tokens = await ask('/tokens.css');   // H15.23: the colour registry the stylesheet reads
		assert.equal(tokens.status, 200, 'the lab serves the colour registry');
		assert.match(tokens.type, /^text\/css/);
		for (const p of ['/kernel/geometry.mjs', '/planner/txn.mjs', '/planner/log.mjs', '/plugins/network/network.mjs']) {
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
H26.7 (H26-7; the verifier's V9) -- the lab mounts the plugins once, '/plugins/' on plugins/, bounded by fileWithin as every mount is:
a module of each of the six plugins is served; a plugin folder that is not there, an old root address and a walk out of plugins/,
sent raw, are each a 404.
*/
test('H26.7: the lab serves every plugin from /plugins/, and nothing else there -- an absent plugin, an old root, a walk out', async () => {
	const { stopProcess } = await import('./fixtures/teardown.mjs');
	const { startLab } = await import('./fixtures/lab-server.mjs');   // H26.5: started and waited for in one place
	const http = await import('node:http');
	const { proc: srv, port } = await startLab();
	const ask = (p) => new Promise((resolve, reject) => {
		const req = http.request({ host: '127.0.0.1', port, path: p, method: 'GET' }, (res) => { res.resume(); resolve({ status: res.statusCode, type: res.headers['content-type'] }); });
		req.on('error', reject); req.end();
	});
	try {
		for (const p of ['/plugins/layouts/layout-table.mjs', '/plugins/devices/device-types.mjs', '/plugins/network/link-head.mjs',
			'/plugins/zones/zone-painter.mjs', '/plugins/groups/group-kind.mjs', '/plugins/simulation/kinds.mjs']) {
			const r = await ask(p);
			assert.equal(r.status, 200, p);
			assert.match(r.type, /^text\/javascript/, p);
		}
		assert.equal((await ask('/plugins/simulation/simulation.css')).status, 200, 'and a plugin\'s stylesheet');
		assert.equal((await ask('/plugins/nowhere/x.mjs')).status, 404, 'a plugin folder that is not there');
		for (const p of ['/layouts/layout-table.mjs', '/devices/device-types.mjs', '/network/link-head.mjs', '/zones/zone-painter.mjs', '/groups/group-kind.mjs',
			'/engine/kinds.mjs', '/engine/simulation.css', '/model/reveal.mjs']) assert.equal((await ask(p)).status, 404, `${p}, an old root address`);
		for (const p of ['/plugins/../server/store.js', '/plugins/%2e%2e/server/store.js', '/plugins/..%2fserver%2fstore.js', '/plugins/..%2Fpackage.json',
			'/plugins/network/../../server/store.js', '/plugins/network/%2e%2e/%2e%2e/package.json', '/plugins/network/..%2f..%2fpackage.json',
			'/plugins/..%5cpackage.json', '/plugins/%2fetc%2fpasswd', '/plugins/server/store.js', '/plugins/package.json', '/plugins/', '/plugins/network/']) {
			assert.equal((await ask(p)).status, 404, `${p} is outside plugins/`);
		}
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
	return { dir, ask, write: (name, text) => fs.writeFileSync(path.join(dir, name), text),
		backdate: (name, when) => fs.utimesSync(path.join(dir, name), when, when),
		close: () => new Promise((r) => server.close(() => { fs.rmSync(dir, { recursive: true, force: true }); r(); })) };
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
		assert.equal(zlib.brotliDecompressSync(asked.body).toString(), MODULE, 'the kept coding, decoded, is the file');
		for (let i = 0; i < 2; i++) assert.equal(zlib.gunzipSync((await r.ask('/m.mjs', { 'Accept-Encoding': 'gzip' })).body).toString(), MODULE, 'and so is the other, made and then kept');
		const changed = MODULE.replace('compressible', 'Compressible');   // the same length, and the old modified time put back
		const when = new Date(Date.now() - 60_000);
		r.backdate('m.mjs', when);
		await r.ask('/m.mjs', { 'Accept-Encoding': 'br' });
		r.write('m.mjs', changed);
		r.backdate('m.mjs', when);
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

/*
H26.1 (dev/design/components/SNAP-GRID.md section 7.6, D7) -- THE VENDOR MOUNT: a component's built files, at the version installed,
kept by the browser for a year.

A page maps `@apnex/snap-grid` to `/vendor/@apnex/snap-grid@<version>/index.js` (tools/import-map.mjs), and one responder both servers
call in a line (server/static.mjs sendVendored) serves it from node_modules/@apnex/snap-grid/dist/ -- only for a package draw depends
on, only at the version installed; any other name, version or file is a 404, as every mount answers. Its address carries the version,
and a release is never replaced, so a kept file is never the wrong one: these, and only these, are sent `immutable`, a year (D7);
draw's own files and the page that holds the map stay `no-store` (H24.16-1). Driven over a tree of the test's own, so a package
installed and not depended on, and one installed at another version, can be shown refused.
*/
const KEPT = 'public, max-age=31536000, immutable';
async function vendorTree() {
	const fs = await import('node:fs');
	const os = await import('node:os');
	const http = await import('node:http');
	const { sendFile, sendVendored } = await import('../server/static.mjs');
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-vendor-'));
	const put = (f, text) => { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), text); };
	put('package.json', JSON.stringify({ dependencies: { '@apnex/kit': 'https://example.invalid/kit-1.2.3.tgz', ws: '^8' } }));
	put('node_modules/@apnex/kit/package.json', JSON.stringify({ name: '@apnex/kit', version: '1.2.3' }));
	put('node_modules/@apnex/kit/dist/index.js', MODULE);
	put('node_modules/@apnex/kit/dist/sub/deep.js', 'export const deep = 1;\n');
	put('node_modules/@apnex/kit/dist/index.js.map', '{"version":3,"sources":[],"mappings":""}');
	put('node_modules/@apnex/kit/README.md', 'outside dist\n');
	put('node_modules/@apnex/stray/package.json', JSON.stringify({ name: '@apnex/stray', version: '0.1.0' }));   // installed, not depended on
	put('node_modules/@apnex/stray/dist/index.js', 'export const stray = 1;\n');
	put('node_modules/ws/package.json', JSON.stringify({ name: 'ws', version: '8.21.0' }));
	put('node_modules/ws/index.js', 'module.exports = 1;\n');
	put('own/own.mjs', MODULE);
	const server = http.createServer((req, res) => { if (sendVendored(req, res, root)) return; sendFile(req, res, fileWithin(path.join(root, 'own'), new URL(req.url, 'http://x').pathname)); });
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	// sent as written: `fetch` would resolve the dot segments before they reach the server
	const ask = (p, headers = {}, method = 'GET') => new Promise((resolve, reject) => {
		const req = http.request({ host: '127.0.0.1', port: server.address().port, path: p, method, headers }, (res) => {
			const parts = []; res.on('data', (c) => parts.push(c)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(parts) }));
		});
		req.on('error', reject); req.end();
	});
	return { ask, close: () => new Promise((r) => server.close(() => { fs.rmSync(root, { recursive: true, force: true }); r(); })) };
}

test('H26.1: the vendor mount serves a component draw depends on at its installed version, kept a year, compressed as any file', async () => {
	const zlib = await import('node:zlib');
	const v = await vendorTree();
	try {
		const br = await v.ask('/vendor/@apnex/kit@1.2.3/index.js', { 'Accept-Encoding': 'br' });
		assert.equal(br.status, 200);
		assert.match(br.headers['content-type'], /^text\/javascript/, 'a module, as a module');
		assert.equal(br.headers['cache-control'], KEPT, 'kept a year, immutable: its address changes with its content (D7)');
		assert.equal(br.headers['content-encoding'], 'br', 'compressed as sendFile compresses every file');
		assert.equal(zlib.brotliDecompressSync(br.body).toString(), MODULE);
		assert.equal(br.headers.vary, 'Accept-Encoding');
		const deep = await v.ask('/vendor/@apnex/kit@1.2.3/sub/deep.js');
		assert.deepEqual([deep.status, deep.headers['cache-control'], deep.body.toString()], [200, KEPT, 'export const deep = 1;\n'], 'a file in a folder of dist/');
		const map = await v.ask('/vendor/@apnex/kit@1.2.3/index.js.map');
		assert.deepEqual([map.status, map.headers['content-type']], [200, 'application/json; charset=utf-8'], 'a source map, as JSON');
		const head = await v.ask('/vendor/@apnex/kit@1.2.3/index.js', {}, 'HEAD');
		assert.deepEqual([head.status, head.headers['cache-control'], head.body.length], [200, KEPT, 0]);
		// draw's own files are never kept (H24.16-1), and neither is a refusal (control)
		const own = await v.ask('/own.mjs');
		assert.deepEqual([own.status, own.headers['cache-control']], [200, 'no-store'], 'a file outside the vendor mount stays no-store');
	} finally { await v.close(); }
});

test('H26.1: the vendor mount answers 404 for any other name, version or file, however the path is spelled, and keeps no refusal', async () => {
	const v = await vendorTree();
	try {
		for (const p of [
			'/vendor/@apnex/kit@1.2.4/index.js', '/vendor/@apnex/kit@1.2/index.js', '/vendor/@apnex/kit@latest/index.js',   // another version
			'/vendor/@apnex/stray@0.1.0/index.js',   // installed, and not a package draw depends on
			'/vendor/@apnex/none@1.0.0/index.js', '/vendor/ws@8.21.0/index.js', '/vendor/@other/kit@1.2.3/index.js',   // no such component
			'/vendor/@apnex/kit@1.2.3/README.md', '/vendor/@apnex/kit@1.2.3/package.json', '/vendor/@apnex/kit@1.2.3/missing.js',   // not in dist/
			'/vendor/@apnex/kit@1.2.3/', '/vendor/@apnex/kit@1.2.3', '/vendor/@apnex/kit@1.2.3/sub', '/vendor/', '/vendor/@apnex/kit',
			'/vendor/@apnex/kit@1.2.3/../package.json', '/vendor/@apnex/kit@1.2.3/../../package.json', '/vendor/@apnex/kit@1.2.3/%2e%2e/package.json',
			'/vendor/@apnex/kit@1.2.3/%2E%2E/%2e%2e/%2e%2e/package.json', '/vendor/@apnex/kit@1.2.3/..%2fpackage.json', '/vendor/@apnex/kit@1.2.3/sub/..%2f..%2fREADME.md',
			'/vendor/@apnex/kit@1.2.3//index.js', '/vendor//@apnex/kit@1.2.3/index.js', '/vendor/@apnex/kit@1.2.3/sub//deep.js',
			'/vendor/@apnex/kit@1.2.3/..\\package.json', '/vendor/@apnex/kit@1.2.3\\..\\..\\package.json', '/vendor/@apnex/kit@1.2.3/index.js%00',
			'/vendor/@apnex/kit@1.2.3/%2fetc%2fpasswd', '/vendor/@apnex/..%2fstray@0.1.0/index.js', '/vendor/@apnex/kit@1.2.3/sub/%2e%2e/%2e%2e/README.md',
		]) {
			const r = await v.ask(p);
			assert.equal(r.status, 404, `${p} answered ${r.status}`);
			assert.equal(r.headers['cache-control'], 'no-store', `${p}: a refusal is never kept`);
		}
		// a dot segment is resolved before the mount decides, as the URL parser reads it for every handler (H24.13): one that stays in
		// dist/ is the file it names (control)
		for (const p of ['/vendor/@apnex/kit@1.2.3/sub/./deep.js', '/vendor/@apnex/kit@1.2.3/sub/../sub/deep.js', '/vendor/@apnex/kit@1.2.3/sub/%2e/deep.js']) assert.equal((await v.ask(p)).status, 200, p);
	} finally { await v.close(); }
});

test('H26.1: the lab serves the installed component on the vendor mount, kept a year, and nothing else there; its own files stay no-store', async () => {
	const fs = await import('node:fs');
	const { stopProcess } = await import('./fixtures/teardown.mjs');
	const { startLab } = await import('./fixtures/lab-server.mjs');   // H26.5: started and waited for in one place
	const http = await import('node:http');
	const root = new URL('../', import.meta.url).pathname;
	const { version } = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/@apnex/snap-grid/package.json'), 'utf8'));
	const { proc: srv, port } = await startLab();
	const ask = (p) => new Promise((resolve, reject) => {
		const req = http.request({ host: '127.0.0.1', port, path: p }, (res) => { res.resume(); resolve({ status: res.statusCode, type: res.headers['content-type'], cache: res.headers['cache-control'] }); });
		req.on('error', reject); req.end();
	});
	try {
		for (const f of ['index.js', 'conformance.js']) {
			const r = await ask(`/vendor/@apnex/snap-grid@${version}/${f}`);
			assert.deepEqual([r.status, r.cache], [200, KEPT], f);
			assert.match(r.type, /^text\/javascript/, f);
		}
		for (const p of [`/vendor/@apnex/snap-grid@9.${version}/index.js`, '/vendor/@apnex/nothing@0.1.0/index.js', `/vendor/@apnex/snap-grid@${version}/../package.json`,
			`/vendor/@apnex/snap-grid@${version}/%2e%2e/package.json`, `/vendor/@apnex/snap-grid@${version}/..%2fpackage.json`, `/vendor/@apnex/snap-grid@${version}/CONTRACT.md`]) {
			assert.equal((await ask(p)).status, 404, p);
		}
		const own = await ask('/src/root.js');
		assert.deepEqual([own.status, own.cache], [200, 'no-store'], 'the lab\'s own module is never kept');
		assert.equal((await ask('/')).cache, 'no-store', 'nor the page that holds the map, so a page reached by Back fetches a fresh map (D7)');
	} finally { await stopProcess(srv); }
});
