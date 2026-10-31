/*
Every test and probe that drives a real browser launches it through ONE definition: `@apnex/headless-chromium`'s `launchChrome`.

The harnesses each carried their own Chrome flags, and they had already diverged: only the lab harness disabled extensions, because
only it had been bitten -- an extension loading at Chrome's startup cancels in-flight requests, and the lab harness lost about one run
in four to it before the cause was measured (tests/fixtures/chrome.mjs records how). The product harness escaped only because its page
usually finishes loading first. Timing, not safety. So the flags had one home, tests/fixtures/chrome.mjs; since H26-19 as amended that
home is a component shared by the six repositories, headless-chromium since its second amendment, and this holds draw to it.

It SWEEPS the tests and the tools rather than naming the harnesses there are today -- a guard with a file list goes stale the moment
another harness is written (B224), and one with its own flags or its own launch is exactly how the drift, or a Chrome outliving its
test, would come back. And it launches one, to hold that headless-chromium still passes the flag draw measured its need for, and the one
that keeps a headless Chrome from rewriting the user's login keyring.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { processesNaming } from '@apnex/clean-runner';
import { launchChrome } from '@apnex/headless-chromium';
import { NO_CHROME } from './fixtures/chrome.mjs';

const root = path.resolve(import.meta.dirname, '..');

function sourceFiles(dir) {
	const out = [];
	for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
		const rel = path.join(dir, e.name);
		if (e.isDirectory()) { if (rel !== 'tests/fixtures/layers') out.push(...sourceFiles(rel)); }
		else if (/\.(m?js)$/.test(e.name)) out.push(rel);
	}
	return out;
}
const SWEPT = [...sourceFiles('tests'), ...sourceFiles('tools')].filter((f) => f !== 'tests/harness-chrome.test.js');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

test('no test or probe launches Chrome itself -- no debugging port, no Chrome binary named, outside the harness', () => {
	const own = SWEPT.filter((f) => /remote-debugging-port|['"](?:google-chrome|chromium)(?:-stable|-browser)?['"]/.test(read(f)));
	assert.deepEqual(own, [], `these launch Chrome themselves instead of through @apnex/headless-chromium:\n  ${own.join('\n  ')}`);
});

test('every harness and probe that drives a browser launches it through the harness', () => {
	const launching = SWEPT.filter((f) => /(?<![.\w])launchChrome\(/.test(read(f)));   // a probe scaffold's own method aside
	// the sweep must find the harnesses, or it proves nothing
	assert.ok(launching.length >= 8, `expected the browser harnesses and probes to launch Chrome, found ${launching.length}: ${launching.join(', ')}`);
	const elsewhere = launching.filter((f) => !/import \{[^}]*\blaunchChrome\b[^}]*\} from '@apnex\/headless-chromium'/.test(read(f)));
	assert.deepEqual(elsewhere, [], `these call a launchChrome that is not the harness's:\n  ${elsewhere.join('\n  ')}`);
});

test('the harness launches Chrome with extensions disabled and its secrets kept in its profile, a harness\'s own flags added', { skip: NO_CHROME, timeout: 30000 }, async () => {
	const chrome = await launchChrome({ args: ['--window-size=1600,1000'] });
	try {
		// Chrome writes its process titles over its arguments, joined by spaces, so its processes are found by the launch folder their
		// profile lies in -- a path the profile's `/` follows -- and a command line is read either way
		const main = processesNaming(chrome.folder).map((pid) => fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').replace(/\0/g, ' ').trim().split(' '))
			.find((argv) => argv.includes('--headless=new') && !argv.some((a) => a.startsWith('--type=') || a.endsWith('tether-main.js')));
		assert.ok(main, 'control: Chrome\'s browser process is found by its launch folder');
		assert.ok(main.includes('--disable-extensions'), 'the flag the lab harness\'s flake was traced to (tests/fixtures/chrome.mjs)');
		assert.ok(main.includes('--password-store=basic'), 'and the one that keeps Chrome off the user\'s login keyring');
		assert.ok(main.includes('--window-size=1600,1000'), 'a harness\'s own flags are kept');
	} finally { await chrome.close(); }
});
