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
import { createApp } from '../server/app.js';

let app, base, dataDir;
before(async () => {
	dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-svg-'));
	app = await createApp({ dataDir, secretsDir: dataDir, port: 0 });
	base = `http://127.0.0.1:${app.port}`;
});
after(async () => {
	await app.close();
	fs.rmSync(dataDir, { recursive: true, force: true });
});

const firstId = async () => (await (await fetch(`${base}/api/v1/diagrams`)).json())[0].id;

test('GET /d/<id>.svg serves an SVG document, not the editor page', async () => {
	const id = await firstId();
	const r = await fetch(`${base}/d/${id}.svg`);
	assert.equal(r.status, 200);
	assert.match(r.headers.get('content-type'), /image\/svg\+xml/);
	const body = await r.text();
	assert.match(body, /^<svg/, 'the body is the image itself, not an HTML page wrapping one');
});

test('the exported SVG declares xmlns — without it a browser renders nothing', async () => {
	const id = await firstId();
	const body = await (await fetch(`${base}/d/${id}.svg`)).text();
	assert.match(body, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/,
		'served as image/svg+xml the document is parsed as XML, and XML has no implicit namespace');
});

test('the exported SVG is SELF-CONTAINED — every referenced id is defined in the file', async () => {
	const id = await firstId();
	const body = await (await fetch(`${base}/d/${id}.svg`)).text();
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
	const body = await (await fetch(`${base}/d/${id}.svg`)).text();
	assert.ok(doc.nodes.length > 0, 'the seed diagram has nodes');
	for (const n of doc.nodes) assert.ok(body.includes(n.id), `node ${n.id} is missing from the export`);
});

test('an unknown diagram id is a 404, not the editor and not a blank image', async () => {
	const r = await fetch(`${base}/d/diagram-000000.svg`);
	assert.equal(r.status, 404);
});

test('/d/<id> without the suffix still serves the editor — the deep link is unchanged', async () => {
	const id = await firstId();
	const r = await fetch(`${base}/d/${id}`);
	assert.equal(r.status, 200);
	assert.match(r.headers.get('content-type') || '', /text\/html/);
});
