/*
`GET /<id>.svg` — the diagram as a downloadable, self-contained SVG (`/d/<id>.svg` until H23).

This closes B28 by PROMOTION rather than deletion. `app/src/schema.js` was flagged as dead ("not in
the production path") and `KERNEL_CSS` as a dead export; both were in fact the two halves of a
capability that was never wired up. The kernel renderer's duty is to produce a complete SVG document
for a NON-BROWSER caller — it just had no door. The client renderer keeps its own, different duty:
live, individually addressable elements for a person editing. Neither is redundant.

The load-bearing detail is `xmlns`. Inside an HTML page the browser infers the SVG namespace, which
is why the editor works without it. Served standalone as image/svg+xml the document is parsed as
XML, which has no implicit namespace — so without the attribute a browser shows a parse failure
instead of the diagram, and only opening the URL would ever reveal it.
*/

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeApp } from './fixtures/app.mjs';

let app, base, dataDir;
before(async () => {
	dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-svg-'));
	app = await makeApp({ dataDir, secretsDir: dataDir, port: 0 });
	base = `http://127.0.0.1:${app.port}`;
});
after(async () => {
	await app.close();
	fs.rmSync(dataDir, { recursive: true, force: true });
});

const firstId = async () => (await (await fetch(`${base}/api/v1/diagrams`)).json())[0].id;

// CORRECTED 2026-10-15 (H23): the title read `/d/<id>.svg`; the body has fetched `/<id>.svg` since 2d78eef
test('GET /<id>.svg serves an SVG document, not the editor page', async () => {
	const id = await firstId();
	const r = await fetch(`${base}/${id}.svg`);
	assert.equal(r.status, 200);
	assert.match(r.headers.get('content-type'), /image\/svg\+xml/);
	const body = await r.text();
	assert.match(body, /^<svg/, 'the body is the image itself, not an HTML page wrapping one');
});

test('the exported SVG declares xmlns — without it a browser renders nothing', async () => {
	const id = await firstId();
	const body = await (await fetch(`${base}/${id}.svg`)).text();
	assert.match(body, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/,
		'served as image/svg+xml the document is parsed as XML, and XML has no implicit namespace');
});

test('the exported SVG is SELF-CONTAINED — every referenced id is defined in the file', async () => {
	const id = await firstId();
	const body = await (await fetch(`${base}/${id}.svg`)).text();
	assert.match(body, /<defs/, 'the glyph artwork travels with it');
	assert.match(body, /<style/, 'so do the styles — a download has no stylesheet to reach for');

	const referenced = [...new Set([...body.matchAll(/href="#([\w-]+)"/g)].map((m) => m[1]))];
	const defined = new Set([...body.matchAll(/id="([\w-]+)"/g)].map((m) => m[1]));
	assert.ok(referenced.length > 0, 'the fixture actually references glyphs');
	assert.deepEqual(referenced.filter((r) => !defined.has(r)), [], 'no dangling href — the file must stand alone');
});

test('the exported SVG carries the diagram, not an empty canvas', async () => {
	const id = await firstId();
	const doc = await (await fetch(`${base}/api/v1/diagrams/${id}`)).json();
	const body = await (await fetch(`${base}/${id}.svg`)).text();
	assert.ok(doc.nodes.length > 0, 'the seed diagram has nodes');
	for (const n of doc.nodes) assert.ok(body.includes(n.id), `node ${n.id} is missing from the export`);
});

test('an unknown diagram id is a 404, not the editor and not a blank image', async () => {
	const r = await fetch(`${base}/0000000000000000.svg`);
	assert.equal(r.status, 404);
});

// CORRECTED 2026-10-15 (H23): the title read `/d/<id>`; the body has fetched `/<id>` since 2d78eef
test('/<id> without the suffix still serves the editor — the deep link is unchanged', async () => {
	const id = await firstId();
	const r = await fetch(`${base}/${id}`);
	assert.equal(r.status, 200);
	assert.match(r.headers.get('content-type') || '', /text\/html/);
});

test('H23: a private diagram answers 404 to an unauthenticated SVG request; publishing it serves the SVG with safe headers, and draw publish toggles both ways', async () => {
	const { createApp } = await import('../server/app.js');
	const { main } = await import('../cli/draw.mjs');
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-h23-'));
	const home = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-h23-home-'));
	let currentPrincipal = 'user:owner@example.com';
	const srv = await createApp({
		dataDir: dir, secretsDir: dir, port: 0, authz: true, owner: 'user:owner@example.com',
		principalOf: async () => currentPrincipal,
	});
	const url = `http://127.0.0.1:${srv.port}`;
	const runCli = async (...argv) => {
		const out = [];
		await main([...argv, '--host', url], { HOME: home }, (s) => out.push(s));
		return out.join('');
	};
	try {
		const id = (await (await fetch(`${url}/api/v1/diagrams`)).json())[0].id;
		assert.match(id, /^[0-9a-f]{16}$/, 'a diagram id is 16 lowercase hex digits');

		// 1. Private by default: unauthenticated caller gets 404 (not 403, so private diagram existence does not leak), while authenticated non-owner gets 403
		currentPrincipal = null;
		const anonPrivate = await fetch(`${url}/${id}.svg`);
		assert.equal(anonPrivate.status, 404, 'unauthenticated request to a private diagram returns 404');

		currentPrincipal = 'user:stranger@example.com';
		const strangerPrivate = await fetch(`${url}/${id}.svg`);
		assert.equal(strangerPrivate.status, 403, 'authenticated non-owner without grant gets 403');
		const strangerPublish = await fetch(`${url}/api/v1/diagrams/${id}/public`, {
			method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ public: true }),
		});
		assert.equal(strangerPublish.status, 403, 'only the owner may publish');

		// 2. Owner publishes via `draw publish`: unauthenticated caller now receives 200 with safe headers
		currentPrincipal = 'user:owner@example.com';
		const pubOut = JSON.parse(await runCli('publish', '--diagram', id, '--json'));
		assert.equal(pubOut.public, true);
		assert.equal(pubOut.url, `${url}/${id}.svg`);

		currentPrincipal = null;
		const anonPublic = await fetch(`${url}/${id}.svg`);
		assert.equal(anonPublic.status, 200, 'published diagram is served without IAP/credentials');
		assert.match(anonPublic.headers.get('content-type') || '', /image\/svg\+xml/);
		assert.equal(anonPublic.headers.get('x-robots-tag'), 'noindex, nofollow');
		assert.equal(anonPublic.headers.get('content-security-policy'), "default-src 'none'; style-src 'unsafe-inline'");
		assert.equal(anonPublic.headers.get('cross-origin-resource-policy'), 'cross-origin');
		assert.match(await anonPublic.text(), /^<svg/);

		// 3. Owner turns publish off via `draw publish --off`: unauthenticated caller gets 404 again
		currentPrincipal = 'user:owner@example.com';
		const offOut = JSON.parse(await runCli('publish', '--off', '--diagram', id, '--json'));
		assert.equal(offOut.public, false);

		currentPrincipal = null;
		assert.equal((await fetch(`${url}/${id}.svg`)).status, 404, 'unpublishing restores 404 for unauthenticated callers');
	} finally {
		await new Promise((r) => srv.server.close(r));
		fs.rmSync(dir, { recursive: true, force: true });
		fs.rmSync(home, { recursive: true, force: true });
	}
});

/*
B351 (H23) -- a published SVG link is a capability URL, so its id comes from the platform's cryptographic source.

H23's design named `crypto.randomBytes(8)`, and `2d78eef` shipped two `Math.random` halves inside `model/model.mjs` instead.
The server is the only minter (`server/store.js` `create`), so the id is drawn there, and the core -- which may not read
its host (scan-layers L11) -- refuses to mint one rather than quietly answering with a weaker id.

The control is `Math.random` pinned to 0.5: an id still derived from it reads `8000000080000000`, which is what this test saw before the fix.
*/
test('B351 (H23): the server mints a diagram id from crypto.randomBytes(8), redraws a taken one, and the model refuses to mint one', async () => {
	const crypto = (await import('node:crypto')).default;
	const { Store } = await import('../server/store.js');
	const { newId } = await import('../model/model.mjs');
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-b351-'));
	const store = new Store(dir, { authz: false });
	await store.init();
	const realBytes = crypto.randomBytes;
	const realRandom = Math.random;
	const drawn = [];
	const queue = [Buffer.from('0123456789abcdef', 'hex'), Buffer.from('0123456789abcdef', 'hex'), Buffer.from('fedcba9876543210', 'hex')];
	try {
		Math.random = () => 0.5;
		crypto.randomBytes = (n, ...rest) => {
			if (rest.length || !queue.length) return realBytes(n, ...rest);
			drawn.push(n);
			return queue.shift();
		};
		const a = store.create('a');
		assert.equal(a.ok, true, a.error);
		assert.equal(a.model.state.meta.id, '0123456789abcdef', 'the id is the hex of the bytes crypto.randomBytes returned');
		const b = store.create('b');
		assert.equal(b.ok, true, b.error);
		assert.equal(b.model.state.meta.id, 'fedcba9876543210', 'a taken id is drawn again rather than reused');
		assert.deepEqual(drawn, [8, 8, 8], 'each draw asks for exactly 8 bytes -- 64 bits, 16 hex digits');
	} finally {
		crypto.randomBytes = realBytes;
		Math.random = realRandom;
		fs.rmSync(dir, { recursive: true, force: true });
	}
	assert.throws(() => newId('diagram'), /server\/store\.js/, 'the model refuses to mint a diagram id, and names who does');
	assert.match(newId('node'), /^node-[0-9a-f]{6}$/, 'control: entity ids still mint in the model');
});

/*
H25.2 (B366, D3) -- THE EXPORT AND THE FAVICON ARE STYLED BY THE PAGE'S OWN STYLESHEETS. They carried two copies of their own,
KERNEL_CSS and EXPORT_CSS, and the export wrote a link's colour and a label's fill itself; the copies drifted unseen (B361). Now
their style is every sheet the page loads but its chrome and the colour registries (server/svg.mjs `drawingStyle`), each colour
token written in. Three promises are held here: no chrome rule rides along -- a file pasted inline into another page must not
restyle it; every `var()` left has a literal fallback, so a renderer that resolves no custom property still draws it; and the
export writes no colour of its own, so the page's rules are the only statement of a look.
*/
test('H25.2: the export is styled by the page\'s drawing sheets -- no chrome rule, every var() with a literal fallback, no colour of its own -- and so is the favicon', async () => {
	const { drawingStyle } = await import('../server/svg.mjs');
	const { PAGE_STYLESHEETS, CHROME_STYLESHEETS } = await import('../product/canvas.mjs');
	const id = await firstId();
	const body = await (await fetch(`${base}/${id}.svg`)).text();
	const style = body.match(/<style>([\s\S]*?)<\/style>/)[1].trim();
	assert.equal(style, drawingStyle(), 'the file carries the drawing style whole');
	const selectors = style.split('\n').map((r) => r.slice(0, r.indexOf(' {')));
	assert.ok(selectors.includes('.label') && selectors.includes('.frame') && selectors.includes('.zone-rect') && selectors.includes('.link'), 'control: the plugins\', the core\'s and the canvas\'s rules are in it');
	const chrome = fs.readFileSync(new URL(`../${CHROME_STYLESHEETS[0]}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
	const chromeSelectors = [...chrome.matchAll(/([^{}]+)\{/g)].map((m) => m[1].trim().replace(/\s+/g, ' '));
	assert.ok(chromeSelectors.includes('html, body') && chromeSelectors.length > 50, 'control: the chrome has rules of its own');
	assert.deepEqual(selectors.filter((s) => chromeSelectors.includes(s) || /^(html|body|header|button|input)\b/.test(s)), [], 'not one of them rides along');
	assert.deepEqual([...style.matchAll(/var\(([^)]*)\)/g)].map((m) => m[0]).filter((v) => !v.includes(',')), [], 'every var() keeps a literal fallback');
	assert.doesNotMatch(style, /var\(--tok-/, 'every colour token is written in');
	assert.ok(PAGE_STYLESHEETS.includes('app/canvas.css'), 'control: the canvas\'s sheet is one the page loads');
	assert.match(body, /<rect id="canvas" x="[-\d.]+" y="[-\d.]+" width="[\d.]+" height="[\d.]+"\/>/, 'the ground is the canvas, coloured by the canvas\'s rule');
	const lines = [...body.matchAll(/<g id="link-[^"]*"><path d="[^"]*"( class="link"[^>]*)>/g)];
	assert.ok(lines.length > 0, 'control: the file draws links, each a group named by its id with its line first');
	for (const m of lines) assert.doesNotMatch(m[1], / stroke="/, 'a line carries no stroke of the export\'s own');
	for (const m of body.matchAll(/<text class="label[^"]*"[^>]*>/g)) assert.doesNotMatch(m[0], / fill="/, 'a name carries no fill of the export\'s own');
	const favicon = await (await fetch(`${base}/favicon.svg`)).text();
	assert.equal(favicon.match(/<style>([\s\S]*?)<\/style>/)[1].trim(), drawingStyle(), 'the favicon is styled by the same sheets');
});

// H25.2 (B366): every sheet a page lists is served -- by the product's server and by the lab's. The lab served the product page's
// sheets from a list typed in lab/server.mjs, and the canvas's sheet, split out at H25.2, was not on it: the parity probe found the
// lab's canvas drawn at another size. Both servers now answer from the composition's list, and this asks each for each sheet.
test('H25.2: every stylesheet the pages list is served, by the product\'s server and by the lab\'s', async () => {
	const { PAGE_STYLESHEETS } = await import('../product/canvas.mjs');
	const { spawn } = await import('node:child_process');
	const net = await import('node:net');
	const port = await new Promise((r) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
	const lab = spawn('node', ['lab/server.mjs'], { cwd: path.resolve(import.meta.dirname, '..'), env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
	try {
		for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) break; } catch { /* not up */ } await new Promise((r) => setTimeout(r, 100)); }
		const hrefs = PAGE_STYLESHEETS.map((f) => (f.startsWith('app/') ? `/${f.slice(4)}` : `/${f}`));
		assert.ok(hrefs.includes('/canvas.css') && hrefs.includes('/zones/zones.css'), 'control: the list holds the page\'s own sheets and the plugins\'');
		for (const h of hrefs) {
			for (const [who, origin] of [['the product', base], ['the lab', `http://127.0.0.1:${port}`]]) {
				const r = await fetch(`${origin}${h}`);
				assert.equal(r.status, 200, `${who} serves ${h}`);
				assert.match(r.headers.get('content-type') ?? '', /text\/css/, `${who} serves ${h} as a stylesheet`);
			}
		}
		assert.equal((await fetch(`http://127.0.0.1:${port}/nope.css`)).status, 404, 'control: the lab serves no sheet the list does not name');
	} finally { lab.kill(); }
});
