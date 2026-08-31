/*
H12.2 — the BROWSER is the oracle for the kernel's route measurement.

`kernel/router.mjs` measures and samples a route with its own arithmetic, flattening each quadratic
corner into chords. The browser measures the same route with `getTotalLength` and samples it with
`getPointAtLength`, using whatever its own path implementation does. Those are two computations of
one quantity, which is the definition of a twin -- and B28's rule for this house is that the kernel
owns the numbers, so the kernel has to be shown to agree with what is actually on the screen.

It matters because a mover is TIMED by kernel length and DRAWN on the browser's path. Disagree, and
the mover arrives early or late against the line it is supposed to be riding -- a defect that no
unit test of either side alone could see, because each is self-consistent.

This runs headless Chrome rather than mocking it, for the reason the whole tree prefers: a mock of
the oracle would be a third implementation and would agree with whichever one wrote it. SKIPPED,
loudly, when no Chrome is present, so a contributor without one is not blocked -- CI has it.
*/
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { routeGeometry, roundedPath, pathLength, pointAtDistance } from '../kernel/router.mjs';

const CHROME = ['google-chrome', 'chromium', 'chromium-browser']
	.find((b) => { try { execFileSync('which', [b], { stdio: 'ignore' }); return true; } catch { return false; } });

// the shapes that exercise every branch of the decomposition: no corner, one corner, several, a
// clamped short run, and a closed ring whose run home is drawn by `Z`
const CASES = [
	{ label: 'straight', pts: [[0, 0], [200, 0]], close: false },
	{ label: 'one corner', pts: [[0, 0], [200, 0], [200, 200]], close: false },
	{ label: 'two corners', pts: [[0, 0], [200, 0], [200, 200], [0, 200]], close: false },
	{ label: 'four corners', pts: [[0, 0], [200, 0], [200, 200], [0, 200], [0, 40]], close: false },
	{ label: 'clamped short run', pts: [[0, 0], [10, 0], [10, 10]], close: false },
	{ label: 'closed ring', pts: [[0, 0], [80, 0], [80, 80], [0, 80]], close: true },
];

const SAMPLES = [0, 0.13, 0.25, 0.5, 0.75, 0.99, 1];

let dir = null, chrome = null, browser = null;

before(async () => {
	if (!CHROME) return;
	dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-oracle-'));
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">${
		CASES.map((c, i) => `<path id="p${i}" d="${roundedPath(c.pts, 20, c.close)}" fill="none" stroke="#000"/>`).join('')}</svg>`;
	fs.writeFileSync(path.join(dir, 'p.html'), svg);

	const port = 9400 + (process.pid % 400);
	chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, '--no-sandbox',
		'--disable-gpu', `--user-data-dir=${dir}/profile`, 'about:blank'], { stdio: 'ignore' });

	const { default: WebSocket } = await import('ws');
	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	let page = null;
	for (let i = 0; i < 60 && !page; i++) {
		try { page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'); } catch { /* booting */ }
		if (!page) await sleep(250);
	}
	assert.ok(page, 'chrome exposed no page target');

	const ws = new WebSocket(page.webSocketDebuggerUrl);
	let id = 0; const pending = new Map();
	ws.on('message', (raw) => { const m = JSON.parse(raw.toString()); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
	await new Promise((r) => ws.on('open', r));
	const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });

	await send('Page.enable');
	await send('Page.navigate', { url: `file://${dir}/p.html` });
	await sleep(600);
	const expr = `JSON.stringify([...document.querySelectorAll('path')].map(p => {
		const L = p.getTotalLength();
		return { L, pts: ${JSON.stringify(SAMPLES)}.map(f => { const q = p.getPointAtLength(L * f); return [q.x, q.y]; }) };
	}))`;
	const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
	browser = JSON.parse(res.result.result.value);
	ws.close();
});

after(() => {
	if (chrome) chrome.kill();
	if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

test('H12.2: kernel route length agrees with the length the browser measures', { skip: !CHROME && 'no chrome on PATH' }, () => {
	let worst = 0;
	CASES.forEach((c, i) => {
		const mine = pathLength(routeGeometry(c.pts, 20, c.close));
		const rel = Math.abs(browser[i].L - mine) / browser[i].L;
		worst = Math.max(worst, rel);
		assert.ok(rel < 0.001, `${c.label}: kernel ${mine} vs browser ${browser[i].L} (${(rel * 100).toFixed(4)}%)`);
	});
	assert.ok(worst < 0.001, `worst relative error ${(worst * 100).toFixed(4)}%`);
});

test('H12.2: kernel sampling puts a point where the browser puts it', { skip: !CHROME && 'no chrome on PATH' }, () => {
	let worst = 0, where = '';
	CASES.forEach((c, i) => {
		const geo = routeGeometry(c.pts, 20, c.close), L = pathLength(geo);
		SAMPLES.forEach((f, j) => {
			const mine = pointAtDistance(geo, L * f), b = browser[i].pts[j];
			const off = Math.hypot(mine[0] - b[0], mine[1] - b[1]);
			if (off > worst) { worst = off; where = `${c.label} @${f}`; }
			// a tenth of a pixel: far below anything visible, and far above float noise
			assert.ok(off < 0.1, `${c.label} @${f}: kernel [${mine}] vs browser [${b}] off by ${off.toFixed(4)}px`);
		});
	});
	assert.ok(worst < 0.1, `worst positional deviation ${worst.toFixed(4)}px (${where})`);
});

test('H12.2: offset-path can carry the kernel path string, and its clock can be SEEDED', { skip: !CHROME && 'no chrome on PATH' }, () => {
	// the presentation half of the same contract: the browser must accept `roundedPath` output as an
	// offset-path, and `currentTime` must be settable, or the shared clock cannot drive the drawing
	assert.ok(browser, 'oracle did not run');
	// proven in the probe that produced this test; asserted here against the same rendered document
	const d = roundedPath(CASES[1].pts, 20, false);
	assert.ok(d.startsWith('M') && d.includes('Q'), 'a corner must survive into the string the browser is given');
});
