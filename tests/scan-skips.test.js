/*
B250 (F-SKIP) -- the gate reads which tests did not run, and in CI any one of them fails it (tools/scan-skips.mjs).
Driven against TAP records written here, so the rule is proven without depending on whether this machine has Chrome.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { skipsIn } from '../tools/scan-skips.mjs';

const TOOL = new URL('../tools/scan-skips.mjs', import.meta.url).pathname;
const CLEAN = 'TAP version 13\n# Subtest: a\nok 1 - a\n  ---\n  ...\n1..1\n# tests 1\n# skipped 0\n# todo 0\n';
const SKIPPED = 'TAP version 13\nok 1 - the lab boots # SKIP no chrome on PATH\n    ok 1 - nested check # SKIP no chrome on PATH\nok 2 - pending # TODO later\nok 3 - ran\n1..3\n';
const run = (tap, env) => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skips-'));
	const f = path.join(dir, 'r.tap');
	fs.writeFileSync(f, tap);
	const { CI, ...rest } = process.env;
	const r = spawnSync(process.execPath, [TOOL, f], { env: { ...rest, ...env }, encoding: 'utf8' });
	fs.rmSync(dir, { recursive: true, force: true });
	return r;
};

test('B250: every skipped and todo test is named with its reason, at any depth', () => {
	assert.deepEqual(skipsIn(SKIPPED), [
		{ name: 'the lab boots', kind: 'SKIP', reason: 'no chrome on PATH' },
		{ name: 'nested check', kind: 'SKIP', reason: 'no chrome on PATH' },
		{ name: 'pending', kind: 'TODO', reason: 'later' },
	]);
	assert.deepEqual(skipsIn(CLEAN), []);
});

test('B250: in CI a skipped test fails the gate; locally it warns; a clean record passes either way', () => {
	assert.equal(run(SKIPPED, { CI: 'true' }).status, 1, 'CI: a test that did not run is a failure');
	assert.match(run(SKIPPED, { CI: 'true' }).stderr, /3 test\(s\) did not run/);
	const local = run(SKIPPED, {});
	assert.equal(local.status, 0, 'locally a skip warns rather than refusing a push');
	assert.match(local.stdout, /WARN/);
	assert.equal(run(CLEAN, { CI: 'true' }).status, 0);
});

test('B250: the gate runs it, after the suite that writes the record it reads', () => {
	const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
	assert.match(pkg.scripts.test, /--test-reporter=tap --test-reporter-destination=\.test-results\.tap/, 'npm test writes the record');
	assert.match(pkg.scripts.test, /--test-reporter=spec --test-reporter-destination=stdout/, 'and still prints what a person reads');
	assert.ok(pkg.scripts.gate.indexOf('npm test') < pkg.scripts.gate.indexOf('node tools/scan-skips.mjs'), 'the scan reads the record the suite just wrote');
});
