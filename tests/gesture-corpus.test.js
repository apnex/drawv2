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

/*
H26.6's move 10 (dev/design/components/PAN-ZOOM.md section 5.1 row 10, its guard: "the gesture corpus but its Space scenario, its new record
named") -- THE SPACE SCENARIO'S NEW RECORD, AND ITS DIFFERENCE. `key-view-keys` gained Space's release and the view's five keys (=, -,
Shift+0, Shift+1, h), and the record a `datum`, each datum set by its step and point, written only when one is set, so every other scenario
records byte for byte as it did. The scenario under the code before the move (a77dbe6), recorded with the same fixture, answered the claims
and the datum below; under move 10 the datum is set on Space's release, a step later, and the five keys are claimed, nothing else differing.
*/
test('H26.6 move 10: the Space scenario\'s record differs from the code before the move only in the datum\'s step and the five view keys claimed', () => {
	const BEFORE = { claims: [true, true, true, true, false, true, false, false, false, false, false, true, false, false], datum: [[4, 60, 60]] };
	const now = golden['key-view-keys'];
	assert.deepEqual(now.datum, [[5, 60, 60]], 'the datum set at step 5, Space\'s release, where the press at step 4 set it');
	const keys = [6, 7, 8, 9, 10];   // the claims of =, -, Shift+0, Shift+1 and h -- the scenario's 'at' step makes no claim
	assert.deepEqual(keys.map((i) => [BEFORE.claims[i], now.claims[i]]), keys.map(() => [false, true]), 'the view\'s five keys, unbound before, claimed');
	assert.deepEqual(now.claims.filter((c, i) => !keys.includes(i)), BEFORE.claims.filter((c, i) => !keys.includes(i)), 'every other claim as before');
	assert.deepEqual([now.commits, now.said, now.threw], [[], [], []], 'no edit, nothing said, nothing thrown');
	assert.equal(Object.values(golden).filter((r) => 'datum' in r).length, 1, 'no other scenario sets a datum, so no other record gained one');
});

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
