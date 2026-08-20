/*
The shipped example corpus.

`examples/` is tracked; `diagrams/` is not. The store REWRITES a diagram file on every edit, so a
tracked runtime directory shows a diff whenever anyone uses the app — and on Cloud Run that
directory is a mounted bucket, so the two were always different things. First boot copies one into
the other.

`examplesDir` is INJECTED rather than discovered, which is why these tests must pass it explicitly:
a store that went looking for a sibling directory would seed differently depending on where it was
constructed from, and every other test in this suite would silently start booting the whole shipped
corpus. No count is named here on purpose: the corpus is curated, and a number in prose goes stale
the first time it is.
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from '../server/store.js';
import { validateDoc } from '../server/validate.js';

const EXAMPLES = fileURLToPath(new URL('../examples', import.meta.url));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'draw-ex-'));

test('every shipped example validates against the CURRENT schema', () => {
	const files = fs.readdirSync(EXAMPLES).filter((f) => f.endsWith('.json'));
	assert.ok(files.length > 0, 'the corpus is not empty');
	for (const f of files) {
		const doc = JSON.parse(fs.readFileSync(path.join(EXAMPLES, f), 'utf8'));
		assert.equal(validateDoc(doc), null, `${f} must load on the binary that ships with it`);
		assert.equal(f, `${doc.meta.id}.json`, `${f}: filename must match meta.id`);
	}
});

test('no example carries a Slides binding — shipped content must not point at a private deck', () => {
	for (const f of fs.readdirSync(EXAMPLES).filter((f) => f.endsWith('.json'))) {
		const { meta } = JSON.parse(fs.readFileSync(path.join(EXAMPLES, f), 'utf8'));
		assert.deepEqual(meta.slides, { url: '', presentationId: '', pageId: '' }, `${f} leaks a deck binding`);
	}
});

test('an example starts clean: version 0, no log, nothing to undo', () => {
	for (const f of fs.readdirSync(EXAMPLES).filter((f) => f.endsWith('.json'))) {
		const doc = JSON.parse(fs.readFileSync(path.join(EXAMPLES, f), 'utf8'));
		assert.equal(doc.meta.version, 0, `${f}: an example has no history`);
		assert.equal('log' in doc, false, `${f}: no log block — nobody wants a stranger's undo stack`);
	}
});

test('first boot copies the corpus into an empty data dir, and it PERSISTS', async () => {
	const dir = tmp();
	try {
		const store = new Store(dir, { flushMs: 3_600_000, examplesDir: EXAMPLES });
		await store.init();
		const shipped = fs.readdirSync(EXAMPLES).filter((f) => f.endsWith('.json')).length;
		assert.equal(store.list().length, shipped, 'every example loaded');
		assert.equal(fs.readdirSync(dir).length, 0, 'nothing written yet — the flush is debounced');

		await store.flushAll();
		assert.equal(fs.readdirSync(dir).filter((f) => f.endsWith('.json')).length, shipped,
			'seeding is a CREATION: the examples are now the data dir, not a live reference to the repo');

		// second boot loads from the data dir; the examples are not consulted again
		const again = new Store(dir, { flushMs: 3_600_000, examplesDir: EXAMPLES });
		await again.init();
		assert.equal(again.list().length, shipped);
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a user who deletes an example does NOT get it back on the next boot', async () => {
	const dir = tmp();
	try {
		const store = new Store(dir, { flushMs: 3_600_000, examplesDir: EXAMPLES });
		await store.init();
		await store.flushAll();
		const victim = store.list()[0].id;
		assert.equal(await store.remove(victim), null);
		await store.flushAll();

		const again = new Store(dir, { flushMs: 3_600_000, examplesDir: EXAMPLES });
		await again.init();
		assert.equal(again.list().some((d) => d.id === victim), false,
			'seeding is FIRST BOOT only — a re-seeding store would resurrect deleted work forever');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('without examplesDir the store seeds the single programmatic example — every other test is unaffected', async () => {
	const dir = tmp();
	try {
		const store = new Store(dir, { flushMs: 3_600_000 });
		await store.init();
		assert.equal(store.list().length, 1, 'the injected dependency really is opt-in');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a malformed example is skipped, not fatal — a packaging bug must not block a first run', async () => {
	const dir = tmp();
	const badExamples = tmp();
	try {
		for (const f of fs.readdirSync(EXAMPLES).filter((f) => f.endsWith('.json')).slice(0, 3)) {
			fs.copyFileSync(path.join(EXAMPLES, f), path.join(badExamples, f));
		}
		fs.writeFileSync(path.join(badExamples, 'diagram-bad001.json'), '{ not json');

		const store = new Store(dir, { flushMs: 3_600_000, examplesDir: badExamples });
		await assert.doesNotReject(() => store.init());
		assert.equal(store.list().length, 3, 'the good ones loaded');

		// and if NONE load, the programmatic seed still guarantees a non-empty store
		const allBad = tmp();
		fs.writeFileSync(path.join(allBad, 'diagram-bad002.json'), '{ not json');
		const dir2 = tmp();
		const s2 = new Store(dir2, { flushMs: 3_600_000, examplesDir: allBad });
		await s2.init();
		assert.equal(s2.list().length, 1, 'fell back to the programmatic seed — never an empty store');
		fs.rmSync(allBad, { recursive: true, force: true });
		fs.rmSync(dir2, { recursive: true, force: true });
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
		fs.rmSync(badExamples, { recursive: true, force: true });
	}
});

test('D17/GR8 is NOT weakened: a broken DATA dir still refuses to boot, examples or not', async () => {
	const dir = tmp();
	try {
		fs.writeFileSync(path.join(dir, 'diagram-aa0001.json'), '{ not json');
		const store = new Store(dir, { flushMs: 3_600_000, examplesDir: EXAMPLES });
		await assert.rejects(() => store.init(), /refusing to boot/,
			'user data that cannot be read is an outage; seeding examples over it would be data loss');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
