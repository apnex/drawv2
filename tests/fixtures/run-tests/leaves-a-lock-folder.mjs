// tests/run-tests.test.js: a planted test that leaves a folder named as Chrome names its lock folder, as a Chrome stopped by SIGTERM does
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('leaves a lock folder in the temporary folder', () => {
	fs.mkdirSync(path.join(os.tmpdir(), '.com.google.Chrome.Pl4nt1'));
});
