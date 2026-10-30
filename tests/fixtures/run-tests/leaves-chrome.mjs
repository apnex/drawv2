// tests/run-tests.test.js: a planted test that launches Chrome through the fixture and never stops it -- it ends, and Chrome runs on
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { launchChrome, chromeDebugPort } from '../chrome.mjs';

test('launches Chrome and never stops it', async () => {
	const chrome = launchChrome({ profileDir: fs.mkdtempSync(path.join(os.tmpdir(), 'planted-profile-')), url: 'about:blank' });
	await chromeDebugPort(chrome);
	// held by nothing in this process, so the file ends with its Chrome still running
	chrome.unref();
	chrome.tetherLine.unref();
});
