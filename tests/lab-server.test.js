/*
H26.5 (the verifier's finding 1) -- THE LAB IS STARTED IN ONE PLACE, AND THAT PLACE WAITS 15 S.

tests/fixtures/lab-server.mjs `startLab` replaced six copies of a spawn and a poll, the shortest waiting 5 s; one copy missed by the
first fix (tests/svgexport.test.js) went on failing under load. So these hold the helper's three outcomes -- answering, exiting first,
never answering in its wait -- and that no test starts `lab/server.mjs` but through it.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { startLab, LAB_START_WAIT_MS } from './fixtures/lab-server.mjs';
import { stopProcess } from './fixtures/teardown.mjs';

const groupGone = (pid) => { try { process.kill(-pid, 0); return false; } catch (e) { return e.code === 'ESRCH'; } };

test('H26.5: startLab answers once the lab answers /health, on a port of its own, waiting up to 15 s', async () => {
	assert.equal(LAB_START_WAIT_MS, 15000, 'the wait tests/browser.test.js gives the product\'s server');
	const lab = await startLab();
	try {
		assert.equal(lab.origin, `http://127.0.0.1:${lab.port}`);
		assert.equal((await fetch(`${lab.origin}/health`)).status, 200);
	} finally { await stopProcess(lab.proc); }
	assert.ok(groupGone(lab.proc.pid), 'and stopProcess stops it, as before');
});

test('H26.5: a lab that exits before answering -- its port taken by a listener that never answers -- rejects at once, naming it', { timeout: 10000 }, async () => {
	// the lab cannot bind, and an ask of the port is accepted and never answered: each ask is bounded, so the exit is seen within a second
	const held = new Set();
	const taken = net.createServer((c) => { held.add(c); c.on('close', () => held.delete(c)); });
	await new Promise((r) => taken.listen(0, '127.0.0.1', r));
	try {
		// raced, so an ask left unbounded fails here rather than holding the file open on the listener's socket
		const outcome = await Promise.race([startLab({ port: taken.address().port }).then(() => 'answered', (e) => e),
			new Promise((r) => setTimeout(() => r('still waiting after 5 s'), 5000))]);
		assert.match(String(outcome), /^Error: startLab: lab\/server\.mjs exited before answering http:\/\/127\.0\.0\.1:\d+\/health/, 'within 5 s, not the 15 s wait');
	} finally { for (const c of held) c.destroy(); await new Promise((r) => taken.close(r)); }
});

test('H26.5: a lab that does not answer within the wait is stopped, and the start rejects naming the wait', async () => {
	const port = await new Promise((r) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const { port: p } = s.address(); s.close(() => r(p)); }); });
	await assert.rejects(startLab({ port, waitMs: 0 }), new RegExp(`^Error: startLab: lab/server\\.mjs did not answer http://127\\.0\\.0\\.1:${port}/health within 0 ms$`));
	// a lab left running would bind its port in about 90 ms and answer; stopped, nothing ever does
	await new Promise((r) => setTimeout(r, 1500));
	await assert.rejects(fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1000) }), 'nothing answers on its port: the lab was stopped');
});

test('H26.5: no test starts lab/server.mjs but through startLab -- a copy with a wait of its own is how the 5 s one was missed', () => {
	const root = path.resolve(import.meta.dirname);
	const files = fs.readdirSync(root, { recursive: true }).filter((f) => /\.(m?js)$/.test(f) && !f.startsWith('fixtures/resolve-log'));
	const starting = files.filter((f) => /spawn\w*\(\s*'node',\s*\[\s*'lab\/server\.mjs'/.test(fs.readFileSync(path.join(root, f), 'utf8')));
	assert.deepEqual(starting, ['fixtures/lab-server.mjs']);
	const callers = files.filter((f) => /\bstartLab\(/.test(fs.readFileSync(path.join(root, f), 'utf8'))).sort();
	assert.deepEqual(callers, ['fixtures/lab-server.mjs', 'import-map-browser.test.js', 'lab-browser.test.js', 'lab-server.test.js', 'probe-sides.test.js', 'static.test.js', 'svgexport.test.js'],
		'the six sites that started it, each through the helper');
});
