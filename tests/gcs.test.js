/*
The GCS adapter against a fake `fetch` -- B6.

What this can and cannot show is worth stating, because the distinction is the one this project
keeps getting wrong. A fake `fetch` proves the adapter speaks the protocol I BELIEVE GCS speaks: it
cannot tell me that belief is right. Only a real bucket can do that, and `tools/gcs-probe.mjs` does
it against `gs://diagrams.apnex.io`, outside the gate because CI has no credentials.

So these tests are about the logic the probe cannot easily force -- pagination, a 412, a 503 storm,
token caching -- and the probe is about the protocol these cannot verify. Neither is sufficient.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gcsFiles, metadataToken } from '../server/files.mjs';

const ok = (body, headers = {}) => ({
	ok: true, status: 200,
	json: async () => body,
	text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
	headers: { get: (k) => headers[k.toLowerCase()] ?? null },
});
const err = (status, body = '') => ({
	ok: false, status,
	json: async () => ({}), text: async () => body,
	headers: { get: () => null },
});
const tok = async () => 'test-token';

test('B6: list follows pagination — a single page would lose documents silently', async () => {
	const calls = [];
	const f = async (url) => {
		calls.push(url);
		if (!url.includes('pageToken')) return ok({ items: [{ name: 'a.json', generation: '1' }], nextPageToken: 'PAGE2' });
		return ok({ items: [{ name: 'b.json', generation: '7' }] });   // no token -> last page
	};
	const files = gcsFiles('bkt', { fetch: f, token: tok });
	assert.deepEqual(await files.list(), ['a.json', 'b.json']);
	assert.equal(calls.length, 2, 'it asked for the second page');
	assert.ok(calls[1].includes('pageToken=PAGE2'));
});

test('B6: an empty bucket omits `items` entirely, and that is not a crash', async () => {
	const files = gcsFiles('bkt', { fetch: async () => ok({}), token: tok });
	assert.deepEqual(await files.list(), [], 'a bucket with nothing in it lists as nothing');
});

test('B6: a write is conditional — first on non-existence, then on the generation it last saw', async () => {
	const seen = [];
	const f = async (url) => {
		seen.push(url);
		// discriminate on the UPLOAD host: the list URL also contains "/o?", and keying on that
		// made this fake answer both calls with the upload body -- the fake was wrong, not the code
		if (url.startsWith('https://storage.googleapis.com/upload/')) return ok({ generation: '42' });
		return ok({ items: [{ name: 'x.json', generation: '41' }] });    // list
	};
	const files = gcsFiles('bkt', { fetch: f, token: tok });

	await files.write('new.json', '{}');
	assert.ok(seen.at(-1).includes('ifGenerationMatch=0'), 'an unseen name must not clobber: create-only');

	await files.list();                       // learns x.json is at generation 41
	await files.write('x.json', '{}');
	assert.ok(seen.at(-1).includes('ifGenerationMatch=41'), 'a known name swaps against what it read');

	await files.write('new.json', '{}');      // the earlier write returned generation 42
	assert.ok(seen.at(-1).includes('ifGenerationMatch=42'), 'the generation from its own write carries forward');
});

test('B6: a 412 throws and does NOT self-heal — silently winning that race is the data loss', async () => {
	let attempts = 0;
	const f = async () => { attempts++; return err(412, 'conditionNotMet'); };
	const files = gcsFiles('bkt', { fetch: f, token: tok });
	await assert.rejects(() => files.write('x.json', '{}'), /write conflict/);
	assert.equal(attempts, 1, '412 is not retryable: retrying would just overwrite a newer generation');
});

test('B6: 503 is retried with backoff; 403 is not — one is GCS, the other is us', async () => {
	let n = 0;
	const waits = [];
	const flaky = gcsFiles('bkt', {
		fetch: async () => (++n < 3 ? err(503) : ok({ items: [] })),
		token: tok, backoffMs: 1, sleep: async (ms) => { waits.push(ms); },
	});
	assert.deepEqual(await flaky.list(), []);
	assert.equal(n, 3, 'it kept trying through the 503s');
	assert.equal(waits.length, 2, 'and slept between attempts');

	let m = 0;
	const denied = gcsFiles('bkt', { fetch: async () => { m++; return err(403, 'forbidden'); }, token: tok, sleep: async () => {} });
	await assert.rejects(() => denied.list(), /403/);
	assert.equal(m, 1, 'a permission error is not a blip — retrying hides it');
});

test('B6: retries are bounded, so a permanent 503 fails instead of hanging forever', async () => {
	let n = 0;
	const files = gcsFiles('bkt', { fetch: async () => { n++; return err(503); }, token: tok, retries: 2, sleep: async () => {} });
	await assert.rejects(() => files.list(), /503/);
	assert.equal(n, 3, 'the initial attempt plus exactly `retries` more');
});

test('B6: read maps 404 to a named absence, and remove treats it as success', async () => {
	const files = gcsFiles('bkt', { fetch: async () => err(404), token: tok });
	await assert.rejects(() => files.read('gone.json'), /no such object: gone.json/);
	await files.remove('gone.json');   // idempotent: the seam promises absence is success
});

test('B6: the token is cached until it nearly expires, not fetched per request', async () => {
	let fetches = 0;
	let clock = 1_000_000;
	const f = async () => { fetches++; return ok({ access_token: `t${fetches}`, expires_in: 3600 }); };
	const get = metadataToken({ fetch: f, now: () => clock });

	assert.equal(await get(), 't1');
	assert.equal(await get(), 't1');
	assert.equal(fetches, 1, 'a second caller reuses it');

	clock += 3500 * 1000;                        // inside the hour, outside the 60s margin
	assert.equal(await get(), 't1', 'still valid');
	clock += 100 * 1000;                         // now within the margin
	assert.equal(await get(), 't2', 'renewed before it could expire mid-request');
});

test('B6: every request carries the bearer token', async () => {
	let auth = null;
	const files = gcsFiles('bkt', { fetch: async (_u, init) => { auth = init.headers.Authorization; return ok({ items: [] }); }, token: tok });
	await files.list();
	assert.equal(auth, 'Bearer test-token');
});

/*
The selection itself, not just the adapter.

`server.js` decides which backend the process gets from one environment variable, and that decision
is the most consequential one it makes. An adapter nothing can select is not wired, so this asserts
the branch both ways rather than trusting that reading the code was enough.
*/
import { createApp } from '../server/app.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('B6: createApp accepts an injected backend, and uses it instead of the disk', async () => {
	const mem = new Map();
	const files = {
		async list() { return [...mem.keys()]; },
		async read(n) { if (!mem.has(n)) throw new Error(`no such object: ${n}`); return mem.get(n); },
		async write(n, t) { mem.set(n, t); },
		async remove(n) { mem.delete(n); },
	};
	const dataDir = path.join(os.tmpdir(), `draw-nodisk-${Math.random().toString(36).slice(2)}`);
	const app = await createApp({ dataDir, secretsDir: dataDir, port: 0, files });
	try {
		await app.store.flushAll();
		assert.ok(mem.size > 0, 'the seed went to the injected backend');
		// the data dir may exist (secrets/examples paths resolve there) but must hold no diagram
		const onDisk = fs.existsSync(dataDir) ? fs.readdirSync(dataDir).filter((f) => f.endsWith('.json')) : [];
		assert.deepEqual(onDisk, [], 'and nothing was written to the filesystem');
	} finally {
		await app.close();
		fs.rmSync(dataDir, { recursive: true, force: true });
	}
});

test('B6: with no backend injected the app still uses the disk — the default is unchanged', async () => {
	const dataDir = path.join(os.tmpdir(), `draw-disk-${Math.random().toString(36).slice(2)}`);
	const app = await createApp({ dataDir, secretsDir: dataDir, port: 0 });
	try {
		await app.store.flushAll();
		const onDisk = fs.readdirSync(dataDir).filter((f) => f.endsWith('.json'));
		assert.ok(onDisk.length > 0, 'the filesystem default survives the new option');
	} finally {
		await app.close();
		fs.rmSync(dataDir, { recursive: true, force: true });
	}
});

test('B6: an unreachable metadata server is a sentence, not an undici stack trace', async () => {
	// this is what `fetch` actually throws off-GCP: the reason is two levels down in `cause`
	const boom = Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error('getaddrinfo ENOTFOUND metadata.google.internal'), { code: 'ENOTFOUND' }) });
	const get = metadataToken({ fetch: async () => { throw boom; } });
	await assert.rejects(() => get(), (e) => {
		assert.match(e.message, /not running on Google Cloud/, 'it names the actual cause');
		assert.match(e.message, /Unset BUCKET/, 'and the remedy');
		assert.doesNotMatch(e.message, /undici|captureStackTrace/, 'without leaking internals');
		return true;
	});
});
