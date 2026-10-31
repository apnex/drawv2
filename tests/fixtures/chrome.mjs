/*
Whether a test can drive a real browser here -- the one skip reason every harness gives when it cannot.

Every Chrome a test or a probe starts is launched by `@apnex/headless-chromium`'s `launchChrome` (H26-19 as amended): headless, on the
port the system gives it, in a launch folder of its own that holds its profile and its lock folder and goes when it is closed or its
starter dies, tethered so it never outlives the test, with the flags the six repositories share. A harness passes only what is
genuinely its own (`args`: a window size its clicks depend on, `--font-render-hinting=none`) and a start URL.

The shared flags include the one draw measured its need for, `--disable-extensions` (2026-09-29): the lab harness flaked about one run in
four, a page never booting, because Chrome installed an extension from this machine's system external_extensions.json at startup and
loading it cut off every request in flight -- 8 stopped loads in 500 with extensions on, 0 in 500 with the flag. tests/harness-chrome.test.js
holds that headless-chromium still passes it.

Before H26-19 as amended this file held draw's own launch -- its flags, its port and its profile -- one definition for three harnesses
whose copies had drifted (only the lab harness had disabled extensions); that definition now lives in headless-chromium, for six repositories.
*/
import { findChrome } from '@apnex/headless-chromium';

// the Chrome headless-chromium would launch -- $CHROME, else the first Chrome-family browser on PATH -- or null
export const CHROME = findChrome();

export const NO_CHROME = !CHROME && 'no chrome on PATH';
