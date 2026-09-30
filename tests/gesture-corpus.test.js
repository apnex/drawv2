/*
THE GESTURE CORPUS, replayed -- stage 1 of the gesture system (dev/design/input/GESTURE-SYSTEM.md, section 9).

Every scenario in tests/fixtures/gesture-corpus.mjs is driven through the product's real Input and must produce exactly
the record frozen in tests/fixtures/gesture-corpus.json: the claims, the commits, what was said, the editor and palette
calls, the host events, the plugin facts, and the final document and selection. Stages 1 to 5 change no outcome, so
this stays green through all of them; a stage that changes a record has changed behaviour, and must say so and be
ruled.

Its coverage is MEASURED, not listed: every key verb the product's table names must be invoked by some scenario, or the
net has a hole a refactor could fall through.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS, record, readGolden } from './fixtures/gesture-corpus.mjs';
import { KEYMAP } from '../app/src/keymap.js';
import { Input } from '../app/src/input.js';

const golden = readGolden();

test('the corpus and its golden file name the same scenarios', () => {
	assert.deepEqual(SCENARIOS.map((s) => s.id).sort(), Object.keys(golden).sort());
	assert.equal(new Set(SCENARIOS.map((s) => s.id)).size, SCENARIOS.length, 'ids are unique');
});

for (const s of SCENARIOS) {
	test(`corpus: ${s.id}`, () => {
		assert.deepEqual(record(s), golden[s.id]);
	});
}

test('every key verb in the product table is exercised by the corpus', () => {
	const verbs = [...new Set(KEYMAP.map((r) => r.run))];
	const hit = new Set();
	const saved = {};
	for (const v of verbs) {
		saved[v] = Input.prototype[v];
		Input.prototype[v] = function (...a) { hit.add(v); return saved[v].apply(this, a); };
	}
	try { for (const s of SCENARIOS) record(s); } finally { for (const v of verbs) Input.prototype[v] = saved[v]; }
	assert.deepEqual(verbs.filter((v) => !hit.has(v)), [], 'key verbs no scenario reaches');
});
