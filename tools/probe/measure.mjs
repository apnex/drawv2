/*
probe/measure.mjs -- screenshot the menu bar, so placement is SEEN rather than derived.

Three rounds of fix-deploy-look cost an hour on a two-pixel misalignment, and every in-browser
assertion tried before this one measured a BOX: a Range reports the line box, and `align-items:
center` centres that whether or not the glyphs sit right inside it. Removing the fix left those
tests passing, which is a test agreeing with itself. Pixels cannot do that.

Serves the REAL `app/style.css` rather than a copy, because a probe that measures a duplicate is
measuring whatever the duplicate drifted to. The page is a stub of the bar's markup -- the smallest
thing that exercises the rules under test, with no server, no document and no network.

  node tools/probe/measure.mjs        # -> a PNG and the control boxes
  python3 tools/probe/ink.py          # -> where the text actually paints, per control

Not a gate check and not a test: it needs Chrome, it writes a file, and its output is a number a
person reads. The durable form of what it finds belongs in a comment beside the CSS it explains.
*/
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const OUT = process.env.PROBE_OUT || path.join(os.tmpdir(), 'draw-probe');

const CHROME = ['google-chrome', 'chromium', 'chromium-browser']
	.find((c) => { try { execFileSync('which', [c], { stdio: 'pipe' }); return true; } catch { return false; } });
if (!CHROME) { console.error('no chrome on PATH'); process.exit(1); }

// a fresh serve directory each run, with the LIVE stylesheet linked in rather than copied
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.copyFileSync(path.join(HERE, 'bar.html'), path.join(OUT, 'bar.html'));
fs.copyFileSync(path.join(ROOT, 'app/style.css'), path.join(OUT, 'style.css'));

const PORT = 8477, CDP = 9911;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', OUT], { stdio: 'ignore' });
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${CDP}`, '--no-sandbox',
	'--disable-gpu', '--window-size=1200,120', `--user-data-dir=${OUT}/cdp`,
	'--force-device-scale-factor=1'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let code = 0;
try {
	await sleep(2500);
	const tab = await (await fetch(`http://127.0.0.1:${CDP}/json/new?http://127.0.0.1:${PORT}/bar.html`,
		{ method: 'PUT' })).json();
	const { default: WS } = await import('ws');
	const ws = new WS(tab.webSocketDebuggerUrl);
	await new Promise((r) => ws.on('open', r));
	let id = 0;
	const send = (m, p = {}) => new Promise((r) => {
		const i = ++id;
		ws.on('message', function h(d) { const j = JSON.parse(d); if (j.id === i) { ws.off('message', h); r(j.result); } });
		ws.send(JSON.stringify({ id: i, method: m, params: p }));
	});
	await sleep(1200);

	const boxes = JSON.parse((await send('Runtime.evaluate', {
		expression: `JSON.stringify([...document.querySelectorAll('#menu [id]')].map(e=>{
			const r=e.getBoundingClientRect();
			return {id:e.id,x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)};
		}))`, returnByValue: true,
	})).result.value);

	const shot = (await send('Page.captureScreenshot', { format: 'png' })).data;
	fs.writeFileSync(path.join(OUT, 'bar.png'), Buffer.from(shot, 'base64'));
	fs.writeFileSync(path.join(OUT, 'boxes.json'), JSON.stringify(boxes, null, '\t'));
	console.log(`  ${OUT}/bar.png`);
	for (const b of boxes) console.log(`  ${b.id.padEnd(12)} x=${b.x} y=${b.y} w=${b.w} h=${b.h}`);
	ws.close();
} catch (e) {
	console.error(`  probe failed: ${e.message}`);
	code = 1;
} finally {
	chrome.kill();
	srv.kill();
}
process.exit(code);
