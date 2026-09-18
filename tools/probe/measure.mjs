/*
probe/measure.mjs -- render the REAL page and measure where its text paints.

WHY THIS EXISTS, and why its first two versions lied.

The first served a stub bar written by hand, so it measured an invention rather than the product.
The second served `app/` but used FIXED ports -- and a stale Chrome from an earlier run was still
listening on one, so `json/new` attached to a tab holding the OLD page. Every CSS variant then
measured byte-identical, which I read as "the change had no effect" instead of "I am photographing
the same stale page". Three commits and a revert were justified by that.

So the ports are unique per run, the teardown is verified, and every step that could silently do
nothing now fails loudly instead. A probe that cannot prove it is looking at the current page is
worse than no probe, because it produces numbers.

  node tools/probe/measure.mjs        # -> PNG + per-control geometry
  python3 tools/probe/ink.py          # -> where the glyphs actually paint

Not a gate check: it needs Chrome and its output is a number a person reads.
*/
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const OUT = process.env.PROBE_OUT || path.join(os.tmpdir(), `draw-probe-${process.pid}`);

const CHROME = ['google-chrome', 'chromium', 'chromium-browser']
	.find((c) => { try { execFileSync('which', [c], { stdio: 'pipe' }); return true; } catch { return false; } });
if (!CHROME) { console.error('no chrome on PATH'); process.exit(1); }

// unique per run. A fixed port is how the second version came to attach to a stale browser.
const PORT = 20000 + (process.pid % 20000);
const CDP = 40000 + (process.pid % 20000);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', path.join(ROOT, 'app')],
	{ stdio: 'ignore' });
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${CDP}`, '--no-sandbox',
	'--disable-gpu', '--window-size=1400,900', `--user-data-dir=${OUT}/cdp`,
	'--force-device-scale-factor=1'], { stdio: 'ignore' });

let code = 0;
try {
	// the page must be reachable before the browser is asked for it
	let up = false;
	for (let i = 0; i < 40 && !up; i++) {
		try { up = (await fetch(`http://127.0.0.1:${PORT}/index.html`)).ok; } catch { await sleep(150); }
	}
	if (!up) throw new Error(`the static server never came up on ${PORT}`);

	let ver = null;
	for (let i = 0; i < 40 && !ver; i++) {
		try { ver = await (await fetch(`http://127.0.0.1:${CDP}/json/version`)).json(); } catch { await sleep(150); }
	}
	if (!ver) throw new Error(`chrome never came up on ${CDP}`);

	const tab = await (await fetch(`http://127.0.0.1:${CDP}/json/new?http://127.0.0.1:${PORT}/index.html`,
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
	const evalIn = async (expr) => {
		const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
		if (r?.exceptionDetails) throw new Error(`page threw: ${r.exceptionDetails.text}`);
		return r?.result?.value;
	};

	// wait for the controls themselves, not for a guessed delay
	let n = 0;
	for (let i = 0; i < 60 && !n; i++) {
		n = await evalIn(`document.querySelectorAll('#menu [id]').length`);
		if (!n) await sleep(200);
	}
	if (!n) throw new Error('no controls in #menu -- the page did not load');

	/*
	PROOF that this browser is looking at the stylesheet on disk right now, not a cached or stale
	one. A sentinel is written into the file, read back through the cascade, then removed -- if the
	value does not arrive, every number below would describe some other page and the run aborts.
	*/
	const css = path.join(ROOT, 'app/style.css');
	const before = fs.readFileSync(css, 'utf8');
	const token = `${Date.now()}`;
	fs.writeFileSync(css, `${before}\n#menu { --probe-sentinel: "${token}"; }\n`);
	let seen = null;
	try {
		for (let i = 0; i < 40 && seen !== token; i++) {
			await send('Page.reload', { ignoreCache: true });
			await sleep(400);
			seen = await evalIn(
				`getComputedStyle(document.getElementById('menu')).getPropertyValue('--probe-sentinel').replace(/"/g,'').trim()`);
		}
	} finally { fs.writeFileSync(css, before); }
	if (seen !== token) throw new Error('the browser is not reading the stylesheet on disk -- stale page');
	await send('Page.reload', { ignoreCache: true });
	await sleep(600);

	await evalIn(`(() => {
		document.getElementById('agents').textContent = 'unlocked';   // same text in all three, so a glyph difference cannot masquerade as a layout one
		document.getElementById('whoami').textContent = 'unlocked';
		document.getElementById('lockstate').textContent = 'unlocked';
		document.getElementById('lockstate').className = 'lock-unlocked';
		return 1;
	})()`);
	await sleep(300);

	const boxes = await evalIn(`JSON.stringify([...document.querySelectorAll('#menu [id]')].map(e=>{
		const r=e.getBoundingClientRect(); const cs=getComputedStyle(e);
		return {id:e.id,x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),
			lh:cs.lineHeight,fs:cs.fontSize,disp:cs.display,pad:cs.paddingTop+'/'+cs.paddingBottom};
	}))`).then(JSON.parse);

	const shot = (await send('Page.captureScreenshot', { format: 'png' })).data;
	fs.writeFileSync(path.join(OUT, 'bar.png'), Buffer.from(shot, 'base64'));
	fs.writeFileSync(path.join(OUT, 'boxes.json'), JSON.stringify(boxes, null, '\t'));
	console.log(`  verified live stylesheet, ${boxes.length} controls`);
	console.log(`  ${OUT}/bar.png`);
	for (const b of boxes) {
		if (!['agents', 'whoami', 'lockstate', 'diagram-name'].includes(b.id)) continue;
		console.log(`  ${b.id.padEnd(13)} y=${String(b.y).padStart(3)} h=${b.h}  lh=${String(b.lh).padStart(7)} fs=${b.fs}  ${b.disp}  pad ${b.pad}`);
	}
	ws.close();
} catch (e) {
	console.error(`  probe failed: ${e.message}`);
	code = 1;
} finally { chrome.kill('SIGKILL'); srv.kill('SIGKILL'); }
process.exit(code);
