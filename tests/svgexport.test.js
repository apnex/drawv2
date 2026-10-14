/*
`GET /d/<id>.svg` — the diagram as a downloadable, self-contained SVG.

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

test('GET /d/<id>.svg serves an SVG document, not the editor page', async () => {
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

test('/d/<id> without the suffix still serves the editor — the deep link is unchanged', async () => {
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
