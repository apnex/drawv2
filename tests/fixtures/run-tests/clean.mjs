// tests/run-tests.test.js: a planted test that removes the folder it makes and stops the process it starts -- the control
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnGroup, teardown } from '../teardown.mjs';

test('makes a folder and starts a process, then removes and stops both', async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'planted-clean-'));
	fs.writeFileSync(path.join(dir, 'made'), 'made');
	await teardown([spawnGroup('sleep', ['600'], { stdio: 'ignore' })], dir);
});
