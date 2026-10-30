/*
How every test that drives a real browser launches Chrome -- ONE definition, for every harness.

Three harnesses (tests/browser.test.js, tests/lab-browser.test.js, tests/route-oracle.test.js) each
carried their own copy of the browser detection and their own flag list. They had already diverged:
only the lab harness disabled extensions, because only it had been bitten. That is the defect family
this programme keeps meeting -- one fact, several authorities, drifting until one of them is wrong --
so the flags live here and a test holds every harness to launching through this file.

WHY --disable-extensions, found by measurement (2026-09-29). The lab harness flaked about one run in
four: a page never booted. A full event timeline showed the failing load firing DOMContentLoaded and
load at 31ms -- a good load fires them at about 81ms, after all 56 module requests -- and cancelling
every request still in flight in the same millisecond. A reproduction with no in-page actions stopped
loads too, always 2.31-2.34 seconds after launch, whatever the navigation count. At startup Chrome
installs an extension from this machine's system external_extensions.json; loading an extension that
can observe requests makes it rebuild the request machinery of open pages, cutting off whatever is in
flight. Twenty launches each: 8 stopped loads in 500 with extensions on, 0 in 500 with this flag.
Refuted first: Node's idle keep-alive timeout, and opening a tab per test.

The product harness had not flaked, only because its page usually finishes loading before the 2.3s
mark. That is timing, not safety -- so it takes the same flag rather than waiting to meet the same
failure.

A harness adds only what is genuinely its own (a window size its clicks depend on, a start URL); the
shared flags are not repeated anywhere else.
*/
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnGroup } from './teardown.mjs';
import { readDevToolsActivePort } from '../../tools/chrome-profile.mjs';

// the first Chrome-family browser on PATH, or undefined -- a test skips, with a reason, when there is none
export const CHROME = ['google-chrome', 'chromium', 'chromium-browser']
	.find((c) => { try { execFileSync('which', [c], { stdio: 'pipe' }); return true; } catch { return false; } });

export const NO_CHROME = !CHROME && 'no chrome on PATH';

// the flags every harness launches with; a debugging port of 0 lets the system give one (B434), read with chromeDebugPort
export function chromeArgs({ cdpPort = 0, profileDir, extra = [], url = null }) {
	return [
		'--headless=new',
		`--remote-debugging-port=${cdpPort}`,
		'--no-sandbox',
		'--disable-gpu',
		'--disable-extensions',   // see above: an extension loading at startup cancels in-flight requests
		`--user-data-dir=${profileDir}`,
		...extra,
		...(url ? [url] : []),
	];
}

/*
Launch Chrome in its own process group, so teardown can stop it and everything it spawned.

H26-19: A TEMPORARY FOLDER OF ITS OWN. Chrome makes folders directly in its temporary folder, named as its lock folder is
(`.com.google.Chrome.XXXXXX`), and leaves them: measured 2026-10-31, the lab harness's one Chrome left 21 more, empty, beside its lock
folder, during the matrix rows -- none of them named by the profile, and several Chromes of a run sharing one temporary folder, so
none could be told whose. So each Chrome is given `chrome-XXXXXX` in the temporary folder as its own, and it goes when Chrome is
stopped (tests/fixtures/teardown.mjs), the lock folder inside it. Short, because Chrome's lock socket must fit a socket address
(tools/run-tests.mjs).

The group is tethered to this process (tools/process-tether.mjs), so a harness killed before its teardown still ends its Chrome and
has its profile, its lock folder and its temporary folder removed. A port left from an earlier launch on the same profile is removed
first, so chromeDebugPort cannot read a port that is no longer this Chrome's.
*/
export function launchChrome(opts) {
	const profile = path.resolve(opts.profileDir);
	fs.rmSync(path.join(profile, 'DevToolsActivePort'), { force: true });
	const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-'));
	const chrome = spawnGroup(CHROME, chromeArgs(opts), { stdio: 'ignore', env: { ...process.env, TMPDIR: temp }, chromeProfile: profile, remove: [temp] });
	chrome.chromeProfile = profile;
	chrome.chromeTemp = temp;
	return chrome;
}

// the debugging port a Chrome launched on port 0 was given (B434): the first line Chrome writes to its profile's DevToolsActivePort
export function chromeDebugPort(chrome, waitMs = 20000) {
	return readDevToolsActivePort(chrome.chromeProfile, { waitMs, exited: () => chrome.exitCode !== null || chrome.signalCode !== null });
}
