// tests/run-tests.test.js: a planted test that makes a folder and never removes it
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('makes a folder and leaves it', () => {
	fs.writeFileSync(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'planted-leak-')), 'made'), 'made');
});
