#!/usr/bin/env node
/*
probe/gesture-sample.mjs -- H26.2 (dev/design/components/INPUT-BINDING.md section 4, acceptance step 5; section 6.3). Do real gestures,
driven in real Chrome, do on the move onto input-binding exactly what they did before it?

The gesture corpus and the side-by-side drive Input through the harness's synthetic events; this drives the product page itself,
served by its real server, with Chrome's own pointer and key events -- dispatched over the DevTools protocol, so the browser makes the
pointer events capture listens to -- on a baseline commit and a candidate, each from its own worktree on its own dependencies
(tools/probe/sides.mjs). Each gesture runs on a fresh copy of one small board, a diagram of its own, and records what it left: the
board as the page holds it, and as the server stored it, entities named by their names or by kind and order of appearance; the
selection; and the trigger the page wrote on each release. The two sides' records must be equal, gesture by gesture.

The sample: a left drag that draws a link; a right drag that moves a device; a Ctrl drag that clones one; a Shift drag on the ground
that draws a zone; a marquee; a zone's corner handle dragged; Escape in the middle of a move; a left press during a chained link,
which the chain takes; and presses released after a travel of 3, exactly 4 and 5 canvas units -- the threshold the director ruled is
4, a travel of exactly 4 a click. The viewport is set so a canvas unit is a CSS pixel, so a travel of exactly 4 is dispatched exactly,
and the page's own pointer coordinates are recorded to show it was. The band section 6.3 changes, a travel within about 10^-15 of
4, lies below what a browser's pointer can be asked for, and is held by input-binding's own tests instead (its IB10, a travel decided
exactly), and in Chrome by tests/import-map-browser.test.js, a travel of exactly 4 a click and one step past it a drop. RESTATED at
H26.8's binding move (dev/design/components/NATIVE-SHAPES.md section 4.3): tests/input-binding-parity.test.js compared the old press with
the session's over that band until its copy, tests/fixtures/pre-binding/, was deleted.

  node tools/probe/gesture-sample.mjs [--baseline <commit>] [--candidate <commit>] [--out DIR]
      the baseline defaults to 7c8215b, the last commit before the move; the candidate is the working tree when not named

Not a gate check: it runs two servers and Chrome. Every process is stopped and waited for and every worktree removed.
*/
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { ownDependencies } from './sides.mjs';
import { productKinds } from '../../product/kinds.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const args = process.argv.slice(2);
const flag = (name, fallback = null) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const baseline = flag('baseline', '7c8215b'), candidate = flag('candidate');
const OUT = flag('out') ?? fs.mkdtempSync(path.join(os.tmpdir(), 'draw-gesture-sample-'));
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VIEW = { width: 1993, height: 1221 };   // the canvas drawn at one CSS pixel to a canvas unit (measured: its screen CTM's scale is 1)

// ---- the board: three devices and a zone on its grid, one copy per gesture ----
const board = (n) => ({
	meta: { id: `00000000006e${String(n).padStart(4, '0')}`, name: `sample ${n}`, version: 1, schema: 3 }, layouts: structuredClone(productKinds().always.layout),
	nodes: [
		{ id: 'node-6e00a1', name: 'a', type: 'host', shape: 'square', x: -360, y: -120, order: 1 },
		{ id: 'node-6e00a2', name: 'b', type: 'host', shape: 'square', x: 360, y: -120, order: 2 },
		{ id: 'node-6e00a3', name: 'c', type: 'host', shape: 'square', x: 0, y: 240, order: 3 },
	],
	links: [], pipes: [], zones: [{ id: 'zone-6e0001', name: 'z', x: 150, y: 150, w: 240, h: 180, order: 1 }], groups: [], selection: [],
});

// ---- the gestures, in canvas coordinates: [kind, x, y, options] ----
const L = { button: 'left' }, R = { button: 'right' };
const SAMPLE = {
	'left drag draws a link': [['down', -360, -120, L], ['move', 0, -120, L], ['move', 360, -120, L], ['up', 360, -120, L]],
	'right drag moves a device': [['down', 0, 240, R], ['move', 60, 270, R], ['move', 120, 300, R], ['up', 120, 300, R]],
	'Ctrl drag clones a device': [['down', -360, -120, { ...L, ctrl: true }], ['move', -360, -60, { ...L, ctrl: true }], ['move', -360, 0, { ...L, ctrl: true }], ['up', -360, 0, { ...L, ctrl: true }]],
	'Shift drag draws a zone': [['down', -630, -450, { ...L, shift: true }], ['move', -540, -400, { ...L, shift: true }], ['move', -450, -330, { ...L, shift: true }], ['up', -450, -330, { ...L, shift: true }]],
	'marquee selects': [['down', -500, -300, L], ['move', 0, -200, L], ['move', 450, 0, L], ['up', 450, 0, L]],
	'zone corner handle resizes': [['down', 270, 240, { ...R, shift: true }], ['up', 270, 240, { ...R, shift: true }],
		['down', 390, 330, { ...L, shift: true }], ['move', 420, 360, { ...L, shift: true }], ['move', 450, 390, { ...L, shift: true }], ['up', 450, 390, { ...L, shift: true }]],
	'Escape mid-move cancels it': [['down', 0, 240, R], ['move', 120, 300, R], ['key', 'Escape'], ['up', 120, 300, R]],
	'a chained link takes the next left press': [['down', -360, -120, L], ['move', 360, -120, L], ['up', 360, -120, { ...L, shift: true }], ['move', 0, 240, null], ['down', 0, 240, L], ['up', 0, 240, L]],
	'a travel of 3 is a click': [['down', -360, -120, L], ['move', -357, -120, L], ['up', -357, -120, L]],
	'a travel of exactly 4 is a click': [['down', -360, -120, L], ['move', -356, -120, L], ['up', -356, -120, L]],
	'a travel of 5 is a drop': [['down', -360, -120, L], ['move', -355, -120, L], ['up', -355, -120, L]],
};

// ---- the two sides ----
const freePort = () => new Promise((resolve) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); }); });
const procs = [], worktrees = [];
async function serve(name, commit) {
	let root = ROOT, deps = 'its own';
	if (commit) {
		root = path.join(OUT, `tree-${name}`);
		execFileSync('git', ['worktree', 'add', '--detach', root, commit], { cwd: ROOT, stdio: 'ignore' });
		worktrees.push(root);
		deps = ownDependencies(root, ROOT) === 'linked' ? 'linked from the root, its lockfile the same' : 'installed from its own lockfile';
	}
	const data = path.join(OUT, `data-${name}`);
	fs.mkdirSync(data, { recursive: true });
	Object.keys(SAMPLE).forEach((_, n) => { const doc = board(n + 1); fs.writeFileSync(path.join(data, `${doc.meta.id}.json`), JSON.stringify(doc)); });
	const port = await freePort();
	procs.push(spawn('node', ['server/server.js'], { cwd: root, env: { PATH: process.env.PATH, HOME: process.env.HOME, PORT: String(port), DATA_DIR: data }, detached: true, stdio: 'ignore' }));
	for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) break; } catch { /* not up */ } await sleep(200); }
	const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
	return { name, port, deps, sha: commit ? sha : `${sha} + working tree` };
}

// ---- one tab over the DevTools protocol ----
const cdpPort = await freePort();
let WebSocket;
async function tab(url) {
	const t = await (await fetch(`http://127.0.0.1:${cdpPort}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json();
	const ws = new WebSocket(t.webSocketDebuggerUrl); let id = 0; const pending = new Map(); const thrown = [];
	ws.on('message', (raw) => {
		const m = JSON.parse(raw);
		if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
		if (m.method === 'Runtime.exceptionThrown') thrown.push(String(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text).slice(0, 200));
	});
	await new Promise((r) => ws.on('open', r));
	const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
	const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? 'evaluation failed'); return r.result?.result?.value; };
	await send('Runtime.enable');
	await send('Emulation.setDeviceMetricsOverride', { ...VIEW, deviceScaleFactor: 1, mobile: false });
	const close = async () => { ws.close(); await fetch(`http://127.0.0.1:${cdpPort}/json/close/${t.id}`); };
	return { send, ev, close, thrown };
}
const MODS = (o = {}) => (o.alt ? 1 : 0) | (o.ctrl ? 2 : 0) | (o.shift ? 8 : 0);
const BUTTONS = { left: 1, right: 2 };
async function drive(t, steps) {
	const [a, d, e, f] = await t.ev(`(() => { const m = document.getElementById('container').getScreenCTM(); return [m.a, m.d, m.e, m.f]; })()`);
	if (a !== 1 || d !== 1) throw new Error(`the canvas is drawn at scale ${a}, not one CSS pixel to a canvas unit`);
	let held = 0;
	for (const [kind, x, y, o] of steps) {
		if (kind === 'key') {
			for (const type of ['keyDown', 'keyUp']) await t.send('Input.dispatchKeyEvent', { type, key: x, code: x, windowsVirtualKeyCode: x === 'Escape' ? 27 : 0 });
		} else {
			const type = { down: 'mousePressed', move: 'mouseMoved', up: 'mouseReleased' }[kind];
			if (kind === 'down') held |= BUTTONS[o.button];
			if (kind === 'up') held &= ~BUTTONS[o.button];
			await t.send('Input.dispatchMouseEvent', { type, x: x * a + e, y: y * d + f, button: kind === 'move' ? (o ? o.button : 'none') : o.button, buttons: held, clickCount: kind === 'move' ? 0 : 1, modifiers: MODS(o ?? {}) });
		}
		await sleep(60);
	}
	await sleep(700);
}

// the page's board and selection, every entity named by its name or by kind and order of appearance; and its pointer facts
const READ = `(() => {
	const doc = window.draw.model.toJSON(), names = new Map(), seen = {};
	const name = (id) => { if (!names.has(id)) { const e = [...doc.nodes, ...doc.links, ...doc.zones].find((x) => x.id === id); const k = id.split('-')[0]; seen[k] = (seen[k] ?? 0) + 1; names.set(id, e?.name && /^[abcz]$/.test(e.name) ? e.name : k + '#' + seen[k]); } return names.get(id); };
	return {
		nodes: doc.nodes.map((n) => [name(n.id), n.type ?? null, n.x, n.y]).sort(),
		links: doc.links.map((l) => [name(l.src), name(l.dst), (l.via ?? []).length]).sort(),
		zones: doc.zones.map((z) => [name(z.id), z.x, z.y, z.w, z.h]).sort(),
		selection: window.draw.selection.list().map(name).sort(),
		facts: window.__facts,
	};
})()`;
// Input's own entry points wrapped, so each press, move and release records the canvas point capture handed it, and each release its trigger
const HOOK = `(() => {
	const i = window.draw.input; window.__facts = [];
	for (const m of ['press', 'move', 'release']) { const f = i[m].bind(i); i[m] = (e) => { try { return f(e); } finally { window.__facts.push([m, e.at.x, e.at.y, m === 'release' ? e.trigger : null]); } }; }
	return true;
})()`;

let failed = false;
try {
	({ default: WebSocket } = await import('ws'));
	const sides = [await serve('baseline', baseline), await serve('candidate', candidate)];
	// launched as tools/probe/parity.mjs launches it: a probe takes no test fixture (L2), and the flags are the harness's own
	procs.push(spawn('google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-extensions', `--remote-debugging-port=${cdpPort}`,
		`--user-data-dir=${path.join(OUT, 'profile')}`, 'about:blank'], { detached: true, stdio: 'ignore' }));
	for (let i = 0; i < 80; i++) { try { await (await fetch(`http://127.0.0.1:${cdpPort}/json/version`)).json(); break; } catch { await sleep(200); } }
	const report = { baseline: sides[0], candidate: sides[1], gestures: {} };
	let n = 0;
	for (const [title, steps] of Object.entries(SAMPLE)) {
		n++;
		const got = [];
		for (const side of sides) {
			const id = board(n).meta.id;
			const t = await tab(`http://127.0.0.1:${side.port}/${id}`);
			for (let i = 0; i < 150 && !(await t.ev(`!!(window.draw && window.draw.renderer && document.querySelectorAll('#nodes > g').length >= 3)`).catch(() => false)); i++) await sleep(100);
			await sleep(400);
			await t.ev(HOOK);
			await drive(t, steps);
			const page = await t.ev(READ);
			const stored = await (await fetch(`http://127.0.0.1:${side.port}/api/v1/diagrams/${id}`)).json();
			got.push({ page, stored: { nodes: stored.nodes.length, links: stored.links.length, zones: stored.zones.map((z) => [z.x, z.y, z.w, z.h]), moved: stored.nodes.map((x) => [x.name, x.x, x.y]).sort() }, thrown: t.thrown });
			await t.close();
		}
		const same = JSON.stringify(got[0]) === JSON.stringify(got[1]);
		if (!same) failed = true;
		report.gestures[title] = { same, baseline: got[0], candidate: got[1] };
		const p = got[1].page;
		console.log(`  ${same ? 'same' : 'DIFFERENT'}  ${title}: ${p.nodes.length} nodes, ${p.links.length} link(s), ${p.zones.map((z) => z.slice(1).join(',')).join(' ')} zone(s), selection [${p.selection.join(' ')}], triggers [${p.facts.filter((x) => x[0] === 'release').map((x) => x[3]).join(' ')}]`);
	}
	const threshold = report.gestures['a travel of exactly 4 is a click'].candidate.page.facts;
	console.log(`  the travel of exactly 4, as the page received it: press at ${threshold[0].slice(1, 3)}, move to ${threshold[1].slice(1, 3)}`);
	fs.writeFileSync(path.join(OUT, 'gesture-sample.json'), `${JSON.stringify(report, null, '\t')}\n`);
	console.log(`  baseline ${sides[0].sha} (${sides[0].deps}); candidate ${sides[1].sha} (${sides[1].deps}); report ${path.join(OUT, 'gesture-sample.json')}`);
	console.log(failed ? '  FAIL -- a gesture did something else on the candidate' : `  PASS -- all ${n} gestures left the same board, selection and triggers on both sides`);
} catch (e) {
	console.error(`  \u2717 ${e.stack}`); failed = true;
} finally {
	for (const p of procs) {
		try { process.kill(-p.pid, 'SIGTERM'); } catch { /* gone */ }
		for (let i = 0; i < 100 && p.exitCode === null && p.signalCode === null; i++) await sleep(50);
		try { process.kill(-p.pid, 'SIGKILL'); } catch { /* gone */ }
	}
	for (const w of worktrees) { try { execFileSync('git', ['worktree', 'remove', '--force', w], { cwd: ROOT, stdio: 'ignore' }); } catch { /* left for git worktree prune */ } }
	for (const f of fs.readdirSync(OUT)) if (f.startsWith('data-') || f === 'profile') fs.rmSync(path.join(OUT, f), { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
