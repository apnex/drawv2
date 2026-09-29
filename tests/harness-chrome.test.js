/*
Every test that drives a real browser launches it through ONE definition: tests/fixtures/chrome.mjs.

The harnesses each carried their own Chrome flags, and they had already diverged: only the lab harness
disabled extensions, because only it had been bitten -- an extension loading at Chrome's startup
cancels in-flight requests, and the lab harness lost about one run in four to it before the cause was
measured (the fixture records how). The product harness escaped only because its page usually
finishes loading first. Timing, not safety.

So the flags have one home, and this holds every harness to it. It SWEEPS the tests directory rather
than naming the three harnesses there are today -- a guard with a file list goes stale the moment a
fourth harness is written (B224), and a fourth harness with its own flags is exactly how the drift
would come back.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromeArgs } from './fixtures/chrome.mjs';

const root = path.resolve(import.meta.dirname, '..');
const FIXTURE = 'tests/fixtures/chrome.mjs';

function testFiles(dir = 'tests') {
	const out = [];
	for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
		const rel = path.join(dir, e.name);
		if (e.isDirectory()) { if (rel !== 'tests/fixtures/layers') out.push(...testFiles(rel)); }
		else if (/\.(m?js)$/.test(e.name)) out.push(rel);
	}
	return out;
}

test('no harness launches Chrome with flags of its own -- only the shared fixture holds them', () => {
	const own = testFiles().filter((f) => f !== FIXTURE && f !== 'tests/harness-chrome.test.js'
		&& /remote-debugging-port/.test(fs.readFileSync(path.join(root, f), 'utf8')));
	assert.deepEqual(own, [], `these launch Chrome with their own flags instead of tests/fixtures/chrome.mjs:\n  ${own.join('\n  ')}`);
});

test('every harness that drives a browser launches it through the fixture', () => {
	const launching = testFiles().filter((f) => /launchChrome\(/.test(fs.readFileSync(path.join(root, f), 'utf8')) && f !== FIXTURE && f !== 'tests/harness-chrome.test.js');
	// the sweep must find the harnesses, or it proves nothing
	assert.ok(launching.length >= 3, `expected the browser harnesses to launch through the fixture, found ${launching.length}: ${launching.join(', ')}`);
});

test('the shared launch disables extensions, and a harness can add to it but not drop it', () => {
	const args = chromeArgs({ cdpPort: 9999, profileDir: '/tmp/x', extra: ['--window-size=1600,1000'], url: 'about:blank' });
	assert.ok(args.includes('--disable-extensions'), 'the flag the flake was traced to');
	assert.ok(args.includes('--headless=new') && args.includes('--no-sandbox'));
	assert.ok(args.includes('--window-size=1600,1000'), 'a harness\'s own extras are kept');
	assert.equal(args.at(-1), 'about:blank', 'the start URL, when given, comes last');
});
