/*
H26.5 (the verifier's finding 1) -- THE LAB'S SERVER, STARTED AND WAITED FOR IN ONE PLACE.

Six tests start `lab/server.mjs` -- tests/static.test.js three times, tests/svgexport.test.js, tests/lab-browser.test.js,
tests/import-map-browser.test.js and tests/probe-sides.test.js -- and each polled its `/health` for as long as it chose: 5 s, 10 s or
12 s. The lab answers in about 90 ms idle; beside the whole suite on eight cores it was measured at a median of 228 ms and a worst of
6.4 s, so the 5 s copies failed with ECONNREFUSED whenever the scheduler put a heavy file beside them -- retiring the capture parity
test at H26.5 changed which files those were, and the failures became frequent. One wait now, as long as tests/browser.test.js gives the
product's server: 15 s.

`startLab({ env, port })` spawns the lab as a process group of its own (tests/fixtures/teardown.mjs `spawnGroup`, so a test process
stopped early stops it too), on `port` or a free one, with `env` -- the caller's whole environment by default, as most sites passed it --
and resolves once `/health` answers 200. Answers `{ proc, port, origin }`; `proc` is stopped by `stopProcess` or `teardown` as before.
A lab that exits first, or never answers within the wait, is stopped and the start rejects naming which -- never a test left to fail
later on a refused connection.
*/
import net from 'node:net';
import path from 'node:path';
import { spawnGroup, stopProcess } from './teardown.mjs';

export const LAB_START_WAIT_MS = 15000;
const ROOT = path.resolve(import.meta.dirname, '..', '..');
const freePort = () => new Promise((resolve) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function startLab({ env = process.env, port = null, waitMs = LAB_START_WAIT_MS } = {}) {
	const at = port ?? await freePort();
	const proc = spawnGroup('node', ['lab/server.mjs'], { cwd: ROOT, env: { ...env, PORT: String(at) }, stdio: 'ignore' });
	const origin = `http://127.0.0.1:${at}`;
	const until = Date.now() + waitMs;
	while (Date.now() < until) {
		if (proc.exitCode !== null || proc.signalCode !== null) {
			await stopProcess(proc);
			throw new Error(`startLab: lab/server.mjs exited before answering ${origin}/health (code ${proc.exitCode}, signal ${proc.signalCode})`);
		}
		// each ask bounded, so a listener that accepts and never answers cannot hold the start past its wait
		try { if ((await fetch(`${origin}/health`, { signal: AbortSignal.timeout(1000) })).ok) return { proc, port: at, origin }; } catch { /* not up */ }
		await sleep(100);
	}
	await stopProcess(proc);
	throw new Error(`startLab: lab/server.mjs did not answer ${origin}/health within ${waitMs} ms`);
}
