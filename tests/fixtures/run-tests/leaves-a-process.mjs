// tests/run-tests.test.js: a planted test that starts a process outside every fixture, detached, and leaves it running
import { test } from 'node:test';
import { spawn } from 'node:child_process';

test('starts a process of its own and leaves it running', () => {
	const p = spawn('sleep', ['600'], { detached: true, stdio: 'ignore' });
	process.stdout.write(`planted pid ${p.pid}\n`);
	p.unref();
});
