#!/usr/bin/env node
/*
probe/parity.mjs -- H25.0b (B366). Does a candidate draw exactly what a baseline draws? Two commits, one browser, no tolerance.

H25 moves every copied style rule to its one place and promises no visible change (dev/design/unification/UNIFICATION-COMPLETE.md
section 7, criteria 4 and 5). H25.0's review found the first version of that promise uncheckable: one mode, live documents compared
across days, a tolerance that let a colour drift, and no probe at all (finding 1). So this renders ONE pinned set of documents at
two commits -- each commit served from its own worktree, on its own ports -- in one Chrome, and compares:

  pixels   the canvas of every pinned document and the parity board in the renderer's authoring mode, in edit mode (e) and in
           run mode (r), the movers' layer hidden; each document's served SVG; the favicon; each of the lab's fixed boards
  styles   the computed style of every element on the parity board under each interaction state, each container mode and a
           forced hover on a clickable, the overlay's own boxes, and the page's chrome -- states a screenshot of a still page
           never shows

Any difference fails, and both images are written beside the report.

  node tools/probe/parity.mjs fetch --bucket <bucket> --owner <principal> [--docs DIR]
      a read-only copy of the owner's stored diagrams, pinned by content hash; never written into this public repository
  node tools/probe/parity.mjs compare --baseline <commit> [--candidate <commit>] [--docs DIR] [--out DIR]
      the candidate is the working tree when not named

Each side runs on its own dependencies (H26.1, G8; tools/probe/sides.mjs): a worktree whose lockfile differs from the root's installs
from its own, and before anything is measured each side's servers answer every address its pages' import map names, at the version
installed on that side -- a revision from before the map has nothing to assert.

Not a gate check: it needs Chrome, the docs and minutes. Each H25 stage is held to it, run by an agent that did not build the stage.
Lessons kept from tools/probe/measure.mjs: ports unique per run, every process stopped and waited for, and a step that could
silently do nothing fails instead -- a probe that cannot prove what it photographed produces numbers, not evidence.
*/
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { PARITY_DIAGRAM, parityBoard } from './boards.mjs';
import { ownDependencies, sideProblems } from './sides.mjs';   // H26.1 (G8): each side on its own dependencies, shown before measuring
import { startProbeScaffold } from './probe-scaffold.mjs';   // H26-19: what the probe starts ends with it, even killed; what it makes goes

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const args = process.argv.slice(2);
const flag = (name, fallback = null) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const DOCS = flag('docs', path.join(os.homedir(), '.drawv2-probe', 'docs'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const die = (msg) => { console.error(`  \u2717 ${msg}`); process.exit(1); };

// ---- fetch: the owner's diagrams, copied read-only, each pinned by its content hash
if (args[0] === 'fetch') {
	const bucket = flag('bucket'), owner = flag('owner');
	if (!bucket || !owner) die('fetch needs --bucket and --owner');
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-parity-fetch-'));
	execFileSync('gcloud', ['storage', 'cp', `gs://${bucket}/*.json`, tmp, '--quiet'], { stdio: 'ignore' });
	fs.rmSync(DOCS, { recursive: true, force: true });
	fs.mkdirSync(DOCS, { recursive: true });
	const pinned = {};
	for (const f of fs.readdirSync(tmp)) {
		const buf = fs.readFileSync(path.join(tmp, f));
		let doc; try { doc = JSON.parse(buf); } catch { continue; }
		if (doc?.meta?.owner !== owner) continue;   // another owner's diagram is not read past its owner field
		fs.writeFileSync(path.join(DOCS, f), buf);
		pinned[f] = sha256(buf);
	}
	fs.rmSync(tmp, { recursive: true, force: true });
	fs.writeFileSync(path.join(DOCS, '..', 'pinned.json'), `${JSON.stringify(pinned, null, '\t')}\n`);
	console.log(`  pinned ${Object.keys(pinned).length} diagram(s) in ${DOCS}`);
	process.exit(Object.keys(pinned).length ? 0 : 1);
}
if (args[0] !== 'compare') die('usage: parity.mjs fetch --bucket B --owner P [--docs D] | compare --baseline C [--candidate C] [--docs D] [--out O]');

// ---- compare
const baseline = flag('baseline'), candidate = flag('candidate');
if (!baseline) die('compare needs --baseline <commit>');
const OUT = flag('out') ?? fs.mkdtempSync(path.join(os.tmpdir(), 'draw-parity-'));   // made only when none is named: a default argument made one every run
fs.mkdirSync(OUT, { recursive: true });

// the pinned set, verified: a document changed since it was pinned is a different document, and the comparison would be of nothing
const pinned = JSON.parse(fs.readFileSync(path.join(DOCS, '..', 'pinned.json'), 'utf8'));
for (const [f, h] of Object.entries(pinned)) if (sha256(fs.readFileSync(path.join(DOCS, f))) !== h) die(`${f} is not the document pinned -- fetch again, and compare from a new baseline`);
const docFiles = Object.keys(pinned).sort();
if (!docFiles.length) die(`no pinned documents in ${DOCS}`);
const docs = docFiles.map((f) => JSON.parse(fs.readFileSync(path.join(DOCS, f), 'utf8'))).concat([parityBoard()]);
const seeds = Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'lab/seeds.json'), 'utf8')));

const freePort = () => new Promise((resolve) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); }); });
// the worktrees, the servers' data and Chrome's profile are scaffolding, removed however the probe ends; the report and images stay
const scaffold = startProbeScaffold({
	root: ROOT,
	trees: [['baseline', baseline], ['candidate', candidate]].filter(([, commit]) => commit).map(([name]) => path.join(OUT, `tree-${name}`)),
	data: ['baseline', 'candidate'].map((name) => path.join(OUT, `data-${name}`)),
	profile: path.join(OUT, 'chrome'),
});
const start = scaffold.start;
const until = async (fn, ms, what) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return; } catch { /* not yet */ } await sleep(200); } die(`${what} did not happen within ${ms} ms`); };

async function serve(name, commit) {
	let root = ROOT, deps = 'its own';
	if (commit) {
		root = path.join(OUT, `tree-${name}`);
		execFileSync('git', ['worktree', 'add', '--detach', root, commit], { cwd: ROOT, stdio: 'ignore' });
		// H26.1 (G8): the root's node_modules only when its lockfile is the root's; else its own, from its own lockfile
		deps = ownDependencies(root, ROOT) === 'linked' ? 'linked from the root, its lockfile the same' : 'installed from its own lockfile';
	}
	const data = path.join(OUT, `data-${name}`);
	fs.mkdirSync(data, { recursive: true });
	for (const d of docs) fs.writeFileSync(path.join(data, `${d.meta.id}.json`), JSON.stringify(d));
	const port = await freePort(), labPort = await freePort();
	// a minimal environment: no identity source, so the server runs open as on a laptop, and every diagram's SVG is served
	const env = { PATH: process.env.PATH, HOME: process.env.HOME };
	start('node', ['server/server.js'], { cwd: root, env: { ...env, PORT: String(port), DATA_DIR: data } });
	start('node', ['lab/server.mjs'], { cwd: root, env: { ...env, PORT: String(labPort) } });
	await until(async () => (await fetch(`http://127.0.0.1:${port}/health`)).ok, 20000, `the ${name} server answering`);
	await until(async () => (await fetch(`http://127.0.0.1:${labPort}/health`)).ok, 20000, `the ${name} lab answering`);
	const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
	return { name, root, port, labPort, deps, sha: commit ? sha : `${sha} + working tree` };
}

// ---- one browser for both sides, over the DevTools protocol, on the port the system gives it (B434)
let cdpPort;
let WebSocket;
async function tab(url) {
	const t = await (await fetch(`http://127.0.0.1:${cdpPort}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json();
	const ws = new WebSocket(t.webSocketDebuggerUrl); let id = 0; const pending = new Map();
	ws.on('message', (raw) => { const m = JSON.parse(raw); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
	await new Promise((r) => ws.on('open', r));
	const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
	const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? 'evaluation failed'); return r.result?.result?.value; };
	const key = async (k) => { for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, text: type === 'keyDown' ? k : undefined, key: k, code: `Key${k.toUpperCase()}`, windowsVirtualKeyCode: k.toUpperCase().charCodeAt(0) }); };
	const shot = async (clip) => Buffer.from((await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) })).result.data, 'base64');
	const close = async () => { ws.close(); await fetch(`http://127.0.0.1:${cdpPort}/json/close/${t.id}`); };
	return { send, ev, key, shot, close };
}

// the computed style of every drawn element and every chrome element, as the parity test reads a look (tests/browser.test.js)
const LOOKS = `(() => {
	const P = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'visibility', 'display',
		'font-family', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline', 'color', 'background-color', 'border-top-color', 'cursor', 'pointer-events', 'transform'];
	const out = {};
	const look = (el, key) => { const cs = getComputedStyle(el); out[key] = P.map((p) => cs.getPropertyValue(p)).join('|'); };
	let n = 0;
	// H25.2b (B370): the movers left out, as the pictures leave them out -- the parity board holds a spawner, whose packets in run mode
	// come and go with the clock, and a reading keyed by each element's place would count a packet more on one side as a difference
	for (const el of document.querySelectorAll('#container *')) if (!el.closest('#movers')) look(el, (el.closest('[id]')?.id ?? '') + ' ' + el.tagName + '.' + (el.getAttribute('class') ?? '') + ' #' + (n++));
	n = 0;
	for (const el of document.querySelectorAll('header *, footer *, #palette *')) look(el, 'chrome ' + el.tagName + '#' + el.id + '.' + (el.getAttribute('class') ?? '') + ' #' + (n++));
	return out;
})()`;
const STATES = ['selected', 'hover', 'armed', 'armed-clone', 'linkband', 'replugging', 'blocking', 'on-selected-path', 'spawning', 'ghost', 'under'];
const CONTAINER_MODES = ['labels-off', 'zonegrid', 'edit-mode', 'run-mode'];

async function capture(side) {
	const shots = {}, styles = {};
	const container = (t) => t.ev(`(() => { const r = document.getElementById('container').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()`);
	for (const doc of docs) {
		const t = await tab(`http://127.0.0.1:${side.port}/${doc.meta.id}`);
		const want = doc.nodes.length;
		await until(() => t.ev(`!!(window.draw && window.draw.renderer && document.querySelectorAll('#nodes > g, #waypoints > g').length >= ${want})`), 20000, `${doc.meta.id} drawing on the ${side.name} page`);
		await t.ev(`document.fonts.ready.then(() => { const s = document.createElement('style'); s.textContent = '#movers { display: none !important; }'; document.head.appendChild(s); return 1; })`);
		await sleep(800);
		const clip = await container(t);
		for (const [mode, keyPress] of [['view', null], ['edit', 'e'], ['view', 'e'], ['run', 'r']]) {
			if (keyPress) await t.key(keyPress);
			await until(() => t.ev(`window.draw.renderer.mode === '${mode}'`), 4000, `${doc.meta.id} entering ${mode} mode on the ${side.name} page`);
			await sleep(600);
			if (!(mode === 'view' && keyPress)) shots[`${doc.meta.id} ${mode} mode`] = await t.shot(clip);
		}
		await t.close();
		const svg = await tab(`http://127.0.0.1:${side.port}/${doc.meta.id}.svg`);
		await until(() => svg.ev(`document.documentElement.tagName === 'svg' && document.readyState === 'complete'`), 8000, `${doc.meta.id}.svg opening on the ${side.name} side`);
		await sleep(300);
		shots[`${doc.meta.id} served SVG`] = await svg.shot();
		await svg.close();
	}
	const fav = await tab(`http://127.0.0.1:${side.port}/favicon.svg`);
	await until(() => fav.ev(`document.readyState === 'complete'`), 8000, `the ${side.name} favicon opening`);
	shots.favicon = await fav.shot({ x: 0, y: 0, width: 256, height: 256 });
	await fav.close();
	for (const seed of seeds) {
		const t = await tab(`http://127.0.0.1:${side.labPort}/?seed=${seed}`);
		await until(() => t.ev(`document.querySelectorAll('#nodes > g, #waypoints > g').length > 0`), 15000, `lab seed ${seed} drawing on the ${side.name} side`);
		await sleep(800);
		shots[`lab ${seed}`] = await t.shot(await container(t));
		await t.close();
	}
	// the states, on the parity board: each class set on every entity's root through the renderer, then cleared
	const t = await tab(`http://127.0.0.1:${side.port}/${PARITY_DIAGRAM}`);
	await until(() => t.ev(`!!(window.draw && document.querySelector('[data-head-of]'))`), 20000, `the parity board on the ${side.name} page`);
	await sleep(600);
	styles.plain = await t.ev(LOOKS);
	const roots = `[...document.querySelectorAll('#zones > [id], #groups > [id], #links > [id], #waypoints > [id], #nodes > [id]')].map((e) => e.id)`;
	/*
	H26.8's painters move: the editing states hold a state (window.draw.states, app/src/editing-states.js), the renderer before it. Each
	class is set on the roots not already drawn with it, and let go from those alone: a class an entity's description holds -- the
	spawner's `spawning` -- is its own, and letting it go through the renderer of a revision before the move stripped it from the
	element for every reading after, a difference of the probe's making where the move keeps a description's class apart from the states.
	*/
	const holder = `(window.draw.states || window.draw.renderer)`;
	for (const st of STATES) {
		styles[`state ${st}`] = await t.ev(`(() => { const ids = ${roots}.filter((id) => !document.getElementById(id).classList.contains('${st}')); const s = ${holder}; ids.forEach((id) => s.setState(id, '${st}', true)); const r = ${LOOKS}; ids.forEach((id) => s.setState(id, '${st}', false)); return r; })()`);
	}
	for (const m of CONTAINER_MODES) styles[`container ${m}`] = await t.ev(`(() => { const c = document.getElementById('container'); const had = c.classList.contains('${m}'); c.classList.add('${m}'); const r = ${LOOKS}; if (!had) c.classList.remove('${m}'); return r; })()`);
	styles.overlay = await t.ev(`(() => { const o = document.getElementById('overlay'); const NS = 'http://www.w3.org/2000/svg'; for (const c of ['marquee', 'textbox-preview']) { const r = document.createElementNS(NS, 'rect'); r.setAttribute('class', c); r.setAttribute('data-probe', ''); o.appendChild(r); } const r = ${LOOKS}; o.querySelectorAll('[data-probe]').forEach((e) => e.remove()); return r; })()`);
	await t.key('r');
	await until(() => t.ev(`window.draw.renderer.mode === 'run'`), 4000, `run mode on the ${side.name} parity board`);
	await t.send('DOM.enable'); await t.send('CSS.enable');
	const { root } = (await t.send('DOM.getDocument')).result;
	const hit = (await t.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.clickable' })).result?.nodeId;
	if (!hit) die(`no clickable on the ${side.name} parity board -- the forced hover would measure nothing`);
	await t.send('CSS.forcePseudoState', { nodeId: hit, forcedPseudoClasses: ['hover'] });
	styles['run mode, a clickable hovered'] = await t.ev(LOOKS);
	await t.close();
	return { shots, styles };
}

// ---- a PNG's pixels, for counting what differs: 8-bit RGB or RGBA, not interlaced -- what Chrome writes
function pixels(buf) {
	let pos = 8, w = 0, h = 0, type = 0; const idat = [];
	while (pos < buf.length) {
		const len = buf.readUInt32BE(pos), kind = buf.toString('ascii', pos + 4, pos + 8), body = buf.subarray(pos + 8, pos + 8 + len);
		if (kind === 'IHDR') { w = body.readUInt32BE(0); h = body.readUInt32BE(4); type = body[9]; if (body[8] !== 8 || body[12] !== 0) throw new Error('a PNG this reader cannot decode'); }
		if (kind === 'IDAT') idat.push(body);
		pos += 12 + len;
	}
	const bpp = type === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, out = Buffer.alloc(h * stride);
	for (let y = 0; y < h; y++) {
		const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
		for (let x = 0; x < stride; x++) {
			const a = x >= bpp ? out[y * stride + x - bpp] : 0, b = y ? out[(y - 1) * stride + x] : 0, c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0;
			const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
			const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f];
			out[y * stride + x] = (line[x] + pred) & 255;
		}
	}
	return { w, h, bpp, data: out };
}
function differing(a, b) {
	if (a.equals(b)) return 0;
	const p = pixels(a), q = pixels(b);
	if (p.w !== q.w || p.h !== q.h) return p.w * p.h;
	let n = 0;
	for (let i = 0; i < p.w * p.h; i++) for (let k = 0; k < 3; k++) if (p.data[i * p.bpp + k] !== q.data[i * q.bpp + k]) { n++; break; }
	return n;
}

// ---- run, and stop everything whatever happens
let failed = false;
try {
	({ default: WebSocket } = await import('ws'));
	const sides = [await serve('baseline', baseline), await serve('candidate', candidate)];
	// H26.1 (G8): before measuring, each side serves what its pages' import map names, at the version installed on that side
	for (const side of sides) {
		const { problems, checked } = await sideProblems({ name: side.name, root: side.root, pages: [`http://127.0.0.1:${side.port}/`, `http://127.0.0.1:${side.labPort}/`] });
		if (problems.length) throw new Error(`a side does not serve its own import map -- nothing measured:\n    ${problems.join('\n    ')}`);
		side.components = checked;
		console.log(`  ${side.name} (${side.sha}): dependencies ${side.deps}; ${checked.length ? `its pages' import map names ${checked.join(', ')}, installed, every address answered 200` : 'no import map on its pages -- nothing to assert'}`);
	}
	cdpPort = await scaffold.launchChrome(['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-extensions', '--hide-scrollbars', '--force-device-scale-factor=1',
		'--window-size=1600,1000']);
	await until(async () => (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).ok, 20000, 'Chrome answering');
	const [a, b] = [await capture(sides[0]), await capture(sides[1])];
	const report = { baseline: sides[0].sha, candidate: sides[1].sha, components: Object.fromEntries(sides.map((s) => [s.name, s.components])), documents: docs.length, pixels: {}, styles: {} };
	for (const [k, png] of Object.entries(a.shots)) {
		const n = b.shots[k] ? differing(png, b.shots[k]) : -1;
		report.pixels[k] = n;
		if (n) { const safe = k.replace(/[^\w.-]+/g, '_'); fs.writeFileSync(path.join(OUT, `${safe}.baseline.png`), png); if (b.shots[k]) fs.writeFileSync(path.join(OUT, `${safe}.candidate.png`), b.shots[k]); }
	}
	for (const [k, looks] of Object.entries(a.styles)) {
		const other = b.styles[k] ?? {};
		const diffs = [...new Set([...Object.keys(looks), ...Object.keys(other)])].filter((e) => looks[e] !== other[e]);
		report.styles[k] = diffs.slice(0, 20).map((e) => `${e}: ${looks[e] ?? '(absent)'} -> ${other[e] ?? '(absent)'}`).concat(diffs.length > 20 ? [`... ${diffs.length - 20} more`] : []);
	}
	fs.writeFileSync(path.join(OUT, 'report.json'), `${JSON.stringify(report, null, '\t')}\n`);
	const pixelFaults = Object.entries(report.pixels).filter(([, n]) => n !== 0), styleFaults = Object.entries(report.styles).filter(([, d]) => d.length);
	console.log(`  parity: ${report.baseline} against ${report.candidate}; ${docs.length} document(s), ${Object.keys(report.pixels).length} picture(s), ${Object.keys(report.styles).length} style reading(s)`);
	for (const [k, n] of pixelFaults) console.log(`  \u2717 ${k}: ${n < 0 ? 'missing on the candidate' : `${n} pixel(s) differ`}`);
	for (const [k, d] of styleFaults) console.log(`  \u2717 ${k}: ${d.length} element(s) styled differently, e.g. ${d[0]}`);
	if (Object.keys(report.pixels).length < docs.length * 4 + 1 + seeds.length) { console.log('  \u2717 fewer pictures than documents, modes and boards -- the probe skipped something'); failed = true; }
	if (pixelFaults.length || styleFaults.length) failed = true;
	console.log(failed ? `\n  FAIL -- see ${OUT}/report.json and the images beside it\n` : `  PASS -- no pixel and no computed style differs (${OUT})\n`);
} finally {
	await scaffold.stop();
}
process.exit(failed ? 1 : 0);
