#!/usr/bin/env node
/*
probe/capture-sample.mjs -- H26.3 (dev/design/components/INPUT-CAPTURE.md section 4, acceptance step 5; sections 6.2 and 6.3). Does real
input, driven in real Chrome, reach Input as it did before the move onto input-capture, and is each platform event's default
prevented as it was?

tools/probe/gesture-sample.mjs holds what eleven gestures leave; this holds what every event was on the way. The product page, served by
its real server from a baseline commit and a candidate, each from its own worktree on its own dependencies (tools/probe/sides.mjs), is
driven in one headless Chrome of this probe's own -- its own profile and port -- with trusted input over the DevTools protocol: mouse
drags on and off the canvas, a hover leaving it, a right press on the canvas and on a field, a double click opening a label editor and
typing into its field, Shift held and released, Escape, Tab on the canvas and on a header button, Delete and Ctrl+Z, a chained link, and
touch drags. Each scenario runs on a fresh copy of one small board and records, on each side: the board as the page holds it and as the
server stored it, the selection, the canvas's classes and the zone grid's visibility; every input event Input was handed, field for field
in its key order -- `at` as its x and y -- with what Input wrote back (`claimed`, `capture`, `trigger`); and every platform event's
`defaultPrevented`, read once its dispatch has ended by a window listener registered before the page's own. The two sides' records must
be equal, scenario by scenario. What `at` is on each side is reported apart: the conversion's own `DOMPoint` before the move, a frozen
`{ x, y }` record of the same numbers after it (section 6.2).
AMENDED at H26.3's verification (V7): a boundary event Chrome fires while it processes a pointer capture -- the pointerout and
pointerover it fires as the press that took the pointer is processed (before its `gotpointercapture`, as measured), and those after
a `lostpointercapture`, each reaching Input as a hover -- carries the `button` of whichever pointer event Chrome processes the capture
with, the press's or release's or the next move's, as its timing falls; so a hover arriving after a press that took the pointer, or
after a capture was lost, and before Input's next press, move, release, cancel or double click, has its `button` recorded as
`capture-boundary` on both sides. Nothing in draw reads a hover's `button` (app/src/input.js `hover`, app/src/overlay.js), and the
side-by-side holds it field for field over synthetic events (tests/input-capture-parity.test.js). The report counts them.
And a boundary event Chrome repeats on its own clock -- the pointerover it fires again when the drawing under a still pointer is
redrawn, as a committed link redraws its end device, early or late as the redraw falls -- reaches Input as a hover identical to the
one before it, with nothing between, and changes nothing there; such a repeat is folded into the one before, in Input's events and
in the platform's alike, and the report counts the repeats folded on each side apart from what is compared.

  node tools/probe/capture-sample.mjs [--baseline <commit>] [--candidate <commit>] [--out DIR]
      the baseline defaults to 87d206b, the last commit before the move; the candidate is the working tree when not named

Not a gate check: it runs two servers and Chrome. Every process is stopped and waited for and every worktree removed.
*/
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import os from 'node:os';
import { ownDependencies } from './sides.mjs';
import { productKinds } from '../../product/kinds.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const args = process.argv.slice(2);
const flag = (name, fallback = null) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const OLD = flag('baseline', '87d206b'), NEW = flag('candidate');
const OUT = flag('out') ?? fs.mkdtempSync(path.join(os.tmpdir(), 'draw-capture-sample-'));
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VIEW = { width: 1993, height: 1221 };
const freePort = () => new Promise((resolve) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); }); });

const board = (n) => ({
	meta: { id: `00000000006f${String(n).padStart(4, '0')}`, name: `compare ${n}`, version: 1, schema: 3 },
	layouts: structuredClone(productKinds().always.layout),
	nodes: [
		{ id: 'node-6f00a1', name: 'a', type: 'host', shape: 'square', x: -360, y: -120, order: 1 },
		{ id: 'node-6f00a2', name: 'b', type: 'host', shape: 'square', x: 360, y: -120, order: 2 },
		{ id: 'node-6f00a3', name: 'c', type: 'router', shape: 'circle', x: 0, y: 240, order: 3 },
	],
	links: [], pipes: [], zones: [{ id: 'zone-6f0001', name: 'z', x: 150, y: 150, w: 240, h: 180, order: 1 }], groups: [], selection: [],
});

// steps: [kind, ...]; mouse coordinates in canvas units, `page` coordinates in CSS pixels
const L = { button: 'left' }, R = { button: 'right' };
const SCENARIOS = {
	'left drag draws a link, released on b': [['down', -360, -120, L], ['move', 0, -120, L], ['move', 360, -120, L], ['up', 360, -120, L]],
	'left drag from a, released off the canvas (over the header)': [['down', -360, -120, L], ['move', -200, -300, L], ['pmove', 400, 20, L], ['pup', 400, 20, L]],
	'right drag moves c off the canvas and back': [['down', 0, 240, R], ['move', 60, 300, R], ['pmove', 1980, 900, R], ['move', 120, 300, R], ['up', 120, 300, R]],
	'a hover crossing off the canvas and back (leave)': [['move', 0, 0, null], ['move', 300, -120, null], ['pmove', 300, 15, null], ['move', 360, -120, null]],
	'right press and release on the canvas: the menu suppressed': [['down', 0, 0, R], ['up', 0, 0, R]],
	'right press on the diagram name field: the menu kept': [['pdown', '#diagram-name', R], ['pup', '#diagram-name', R]],
	// the pointer moved off the device before typing: a device redrawn under a still pointer has Chrome fire a pointerover on its own clock,
	// which would race the keys
	'double click on b opens its label editor; typing a name and Enter commits it': [['down', 360, -120, L], ['up', 360, -120, L], ['dbl', 360, -120], ['wait', 300], ['move', 0, -420, null], ['wait', 200], ['type', 'q1'], ['key', 'Enter']],
	'typing into the label editor, Shift held for a capital, Escape cancels': [['dbl', -360, -120], ['wait', 300], ['move', 0, -420, null], ['wait', 200], ['shiftDown'], ['type', 'Q'], ['shiftUp'], ['key', 'Escape']],
	'Shift held over the zone, then released': [['move', 270, 240, null], ['shiftDown'], ['move', 280, 250, null, { shift: true }], ['shiftUp'], ['move', 290, 250, null]],
	'Escape mid-move cancels it': [['down', 0, 240, R], ['move', 120, 300, R], ['key', 'Escape'], ['up', 120, 300, R]],
	'a click selects a, Tab toggles the labels, Delete removes it, Ctrl+Z restores it': [['down', -360, -120, L], ['up', -360, -120, L], ['key', 'Tab'], ['key', 'Delete'], ['key', 'z', { ctrl: true }]],
	'Tab with focus on a header button is the browser\'s': [['focus', '#help-btn'], ['key', 'Tab']],
	'a touch drag from a to b': [['touch', [[-360, -120], [-200, -120], [0, -120], [200, -120], [360, -120]]]],
	'a touch drag on the ground draws a marquee over c': [['touch', [[-200, 150], [-100, 200], [100, 300], [200, 330]]]],
	'w chains a link through a waypoint, the next press ends it on c': [['down', -360, -120, L], ['move', 0, 60, L], ['key', 'w'], ['move', 0, 240, L], ['up', 0, 240, L]],
};

const procs = [], trees = [];
async function serve(name, commit) {
	let root = ROOT, deps = 'its own';
	if (commit) {
		root = path.join(OUT, `tree-${name}`);
		execFileSync('git', ['worktree', 'add', '--detach', root, commit], { cwd: ROOT, stdio: 'ignore' });
		trees.push(root);
		deps = ownDependencies(root, ROOT) === 'linked' ? 'linked from the root, its lockfile the same' : 'installed from its own lockfile';
	}
	const data = path.join(OUT, `data-${name}`);
	fs.rmSync(data, { recursive: true, force: true }); fs.mkdirSync(data, { recursive: true });
	Object.keys(SCENARIOS).forEach((_, n) => { const doc = board(n + 1); fs.writeFileSync(path.join(data, `${doc.meta.id}.json`), JSON.stringify(doc)); });
	const port = await freePort();
	procs.push(spawn('node', ['server/server.js'], { cwd: root, env: { PATH: process.env.PATH, HOME: process.env.HOME, PORT: String(port), DATA_DIR: data }, detached: true, stdio: 'ignore' }));
	for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) break; } catch { /* not up */ } await sleep(200); }
	const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
	return { name, port, deps, sha: commit ? sha : `${sha} + working tree` };
}

const cdpPort = await freePort();
let WebSocket;
async function tab(url) {
	const t = await (await fetch(`http://127.0.0.1:${cdpPort}/json/new?about:blank`, { method: 'PUT' })).json();
	const ws = new WebSocket(t.webSocketDebuggerUrl); let id = 0; const pending = new Map(); const thrown = [];
	ws.on('message', (raw) => {
		const m = JSON.parse(raw);
		if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
		if (m.method === 'Runtime.exceptionThrown') thrown.push(String(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text).slice(0, 200));
	});
	await new Promise((r) => ws.on('open', r));
	const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
	const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? 'evaluation failed'); return r.result?.result?.value; };
	await send('Runtime.enable'); await send('Page.enable');
	await send('Emulation.setDeviceMetricsOverride', { ...VIEW, deviceScaleFactor: 1, mobile: false });
	// every platform event's defaultPrevented, read once its dispatch has ended; registered before the page's own scripts
	await send('Page.addScriptToEvaluateOnNewDocument', { source: `
		window.__platform = [];
		for (const type of ['pointerdown','pointermove','pointerup','pointercancel','pointerover','pointerout','pointerleave','dblclick','keydown','keyup','contextmenu','click','mousedown','touchstart','touchmove','touchend']) {
			window.addEventListener(type, (e) => { const rec = [type, e.target && (e.target.id || e.target.tagName), e.pointerType ?? null, e.key ?? null]; setTimeout(() => { rec.push(e.defaultPrevented); window.__platform.push(rec); }, 0); }, { capture: true });
		}
		// V7: a pointer capture taken or lost -- the boundary events Chrome fires with it carry a button of its timing's choosing
		window.__captureEdge = false;
		for (const type of ['gotpointercapture', 'lostpointercapture']) window.addEventListener(type, () => { window.__captureEdge = true; }, { capture: true });` });
	await send('Page.navigate', { url });
	const close = async () => { ws.close(); await fetch(`http://127.0.0.1:${cdpPort}/json/close/${t.id}`); };
	return { send, ev, close, thrown };
}
const MODS = (o = {}) => (o.alt ? 1 : 0) | (o.ctrl ? 2 : 0) | (o.shift ? 8 : 0);
const BUTTONS = { left: 1, right: 2 };
const VK = { Escape: 27, Enter: 13, Tab: 9, Delete: 46, Shift: 16, z: 90, w: 87 };
async function drive(t, steps) {
	const [a, d, e, f] = await t.ev(`(() => { const m = document.getElementById('container').getScreenCTM(); return [m.a, m.d, m.e, m.f]; })()`);
	const at = (x, y) => [x * a + e, y * d + f];
	let held = 0, shift = false;
	const mouse = async (type, x, y, o) => {
		if (type === 'mousePressed') held |= BUTTONS[o.button];
		if (type === 'mouseReleased') held &= ~BUTTONS[o.button];
		await t.send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? (o ? o.button : 'none') : o.button, buttons: held, clickCount: type === 'mouseMoved' ? 0 : 1, modifiers: MODS({ ...(o ?? {}), shift: shift || o?.shift }) });
	};
	const key = async (k, o = {}) => {
		for (const type of ['keyDown', 'keyUp']) await t.send('Input.dispatchKeyEvent', { type, key: k, code: k.length === 1 ? `Key${k.toUpperCase()}` : k, windowsVirtualKeyCode: VK[k] ?? 0, modifiers: MODS({ ...o, shift }) });
	};
	for (const [kind, ...s] of steps) {
		if (kind === 'down' || kind === 'move' || kind === 'up') await mouse({ down: 'mousePressed', move: 'mouseMoved', up: 'mouseReleased' }[kind], ...at(s[0], s[1]), s[3] ? { ...(s[2] ?? {}), ...s[3] } : s[2]);
		else if (kind === 'pdown' || (kind === 'pup' && typeof s[0] === 'string')) {
			const [x, y] = await t.ev(`(() => { const r = document.querySelector('${s[0]}').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
			await mouse(kind === 'pdown' ? 'mousePressed' : 'mouseReleased', x, y, s[1]);
		} else if (kind === 'pmove' || kind === 'pup') await mouse(kind === 'pmove' ? 'mouseMoved' : 'mouseReleased', s[0], s[1], s[2]);
		else if (kind === 'dbl') {
			const [x, y] = at(s[0], s[1]);
			for (const [type, count] of [['mousePressed', 1], ['mouseReleased', 1], ['mousePressed', 2], ['mouseReleased', 2]]) await t.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: count });
		} else if (kind === 'key') await key(s[0], s[1]);
		else if (kind === 'shiftDown') { shift = true; await t.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16, modifiers: 8 }); }
		else if (kind === 'shiftUp') { shift = false; await t.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16, modifiers: 0 }); }
		else if (kind === 'type') { for (const ch of s[0]) { await t.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ch, code: `Key${ch.toUpperCase()}`, text: ch, unmodifiedText: ch.toLowerCase(), modifiers: MODS({ shift }) }); await t.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch, code: `Key${ch.toUpperCase()}`, modifiers: MODS({ shift }) }); } }
		else if (kind === 'focus') await t.ev(`document.querySelector('${s[0]}').focus(), true`);
		else if (kind === 'wait') await sleep(s[0]);
		else if (kind === 'touch') {
			await t.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
			const pts = s[0].map(([x, y]) => at(x, y));
			await t.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pts[0][0], y: pts[0][1], id: 1 }] });
			for (const [x, y] of pts.slice(1)) { await sleep(40); await t.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] }); }
			await sleep(40); await t.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
			await t.send('Emulation.setTouchEmulationEnabled', { enabled: false });
		}
		await sleep(60);
	}
	await sleep(700);
}

// Input's entry points wrapped: every input event it was handed, as text, `at` as x and y, after Input returned (claimed, capture, trigger)
const HOOK = `(() => {
	const i = window.draw.input; window.__input = []; window.__atShape = new Set();
	for (const m of ['press', 'move', 'release', 'cancelDrag', 'hover', 'double', 'keyDown', 'keyUp', 'leave']) {
		const f = i[m].bind(i);
		i[m] = (e, ...more) => {
			// V7: a hover after a press that took the pointer, or after a capture changed, before the next pointer event of Input's own,
			// is a capture's boundary event
			const pointer = ['press', 'move', 'release', 'cancelDrag', 'double'].includes(m);
			if (pointer) window.__captureEdge = false;
			const boundary = m === 'hover' && window.__captureEdge;
			const before = e ? JSON.stringify(Object.fromEntries(Object.entries(e).map(([k, v]) => [k, k === 'at' ? [v.x, v.y] : boundary && k === 'button' ? 'capture-boundary' : v]))) : null;
			if (e && e.at) window.__atShape.add((Object.isFrozen(e.at) ? 'frozen ' : '') + (Object.getPrototypeOf(e.at)?.constructor?.name ?? 'null') + ' ' + Object.keys(e.at).join(','));
			try { return f(e, ...more); } finally {
				window.__input.push([m, before, more, e ? [e.claimed, e.capture, e.trigger ?? null] : null]);
				if (pointer && e?.capture) window.__captureEdge = true;   // the press took the pointer: Chrome's boundary events follow
			}
		};
	}
	return true;
})()`;
const READ = `(() => {
	// V7: a hover identical to the one before it, nothing between, is a boundary event Chrome repeated: folded into it; and the platform's
	const input = window.__input.filter((x, k, all) => !(k && x[0] === 'hover' && JSON.stringify(x) === JSON.stringify(all[k - 1])));
	const raw = window.__platform.map((r) => r.join(' '));
	const platform = raw.filter((x, k) => !(k && /^pointer(over|out) /.test(x) && x === raw[k - 1]));
	const doc = window.draw.model.toJSON(), names = new Map(), seen = {};
	const name = (id) => { if (!names.has(id)) { const e = [...doc.nodes, ...doc.links, ...doc.zones].find((x) => x.id === id); const k = id.split('-')[0]; seen[k] = (seen[k] ?? 0) + 1; names.set(id, e?.name && /^[abcz]$/.test(e.name) ? e.name : k + '#' + seen[k]); } return names.get(id); };
	const c = document.getElementById('container');
	return {
		nodes: doc.nodes.map((n) => [name(n.id), n.name, n.type ?? null, n.x, n.y]).sort(),
		links: doc.links.map((l) => [name(l.src), name(l.dst), (l.via ?? []).map(name)]).sort(),
		zones: doc.zones.map((z) => [name(z.id), z.x, z.y, z.w, z.h]).sort(),
		selection: window.draw.selection.list().map(name).sort(),
		container: [...c.classList].sort(), zoneGrid: getComputedStyle(document.getElementById('grid-zones')).visibility,
		editor: !!document.querySelector('#label-editor:not([hidden]), input.label-editor') , active: document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : null,
		input, triggers: input.filter((x) => x[0] === 'release').map((x) => x[3][2]), boundary: input.filter((x) => x[0] === 'hover' && x[1].includes('"capture-boundary"')).length,
		platform, repeats: [window.__input.length - input.length, window.__platform.length - platform.length],
	};
})()`;

let failed = false;
try {
	({ default: WebSocket } = await import('ws'));
	const sides = [await serve('baseline', OLD), await serve('candidate', NEW)];
	procs.push(spawn('google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-extensions', `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${path.join(OUT, 'profile')}`, 'about:blank'], { detached: true, stdio: 'ignore' }));
	for (let i = 0; i < 80; i++) { try { await (await fetch(`http://127.0.0.1:${cdpPort}/json/version`)).json(); break; } catch { await sleep(200); } }
	const report = { sides, scenarios: {} };
	let n = 0;
	for (const [title, steps] of Object.entries(SCENARIOS)) {
		n++;
		const got = [];
		for (const side of sides) {
			const id = board(n).meta.id;
			const t = await tab(`http://127.0.0.1:${side.port}/${id}`);
			for (let i = 0; i < 150 && !(await t.ev(`!!(window.draw && window.draw.renderer && document.querySelectorAll('#nodes > g').length >= 3)`).catch(() => false)); i++) await sleep(100);
			await sleep(500);
			await t.ev(HOOK);
			await t.ev('window.__platform.length = 0, true');
			await drive(t, steps);
			const page = await t.ev(READ);
			const atShape = await t.ev('[...window.__atShape]');
			const stored = await (await fetch(`http://127.0.0.1:${side.port}/api/v1/diagrams/${id}`)).json();
			got.push({ page, stored: { nodes: stored.nodes.map((x) => [x.name, x.type ?? null, x.x, x.y]).sort(), links: stored.links.length, zones: stored.zones.map((z) => [z.x, z.y, z.w, z.h]) }, thrown: t.thrown, atShape });
			await t.close();
		}
		const strip = (g) => ({ ...g, atShape: undefined, page: { ...g.page, repeats: undefined } });
		const same = JSON.stringify(strip(got[0])) === JSON.stringify(strip(got[1]));
		if (!same) failed = true;
		report.scenarios[title] = { same, baseline: got[0], candidate: got[1] };
		const p = got[1].page;
		const prevented = p.platform.filter((x) => x.endsWith(' true')).map((x) => x.split(' ')[0]);
		console.log(`  ${same ? 'same' : 'DIFFERENT'}  ${title}: ${p.input.length} input event(s) [${[...new Set(p.input.map((x) => x[0]))].join(' ')}], ${p.platform.length} platform event(s), prevented [${[...new Set(prevented)].join(' ')}], triggers [${p.triggers.join(' ')}], selection [${p.selection.join(' ')}], links ${p.links.length}, thrown ${got[1].thrown.length}, capture-boundary hovers ${p.boundary}, repeats folded ${got.map((g) => g.page.repeats.join('+')).join(' / ')}`);
	}
	const shapes = Object.values(report.scenarios).map((s) => [s.baseline.atShape, s.candidate.atShape]);
	console.log(`  at, as Input received it -- baseline: ${[...new Set(shapes.flatMap((s) => s[0]))].join('; ')}; candidate: ${[...new Set(shapes.flatMap((s) => s[1]))].join('; ')}`);
	fs.writeFileSync(path.join(OUT, 'capture-sample.json'), `${JSON.stringify(report, null, '\t')}\n`);
	console.log(`  baseline ${sides[0].sha} (${sides[0].deps}); candidate ${sides[1].sha} (${sides[1].deps}); report ${path.join(OUT, 'capture-sample.json')}`);
	console.log(failed ? '  FAIL -- a scenario differs' : `  PASS -- all ${n} scenarios alike on both sides`);
} catch (e) { console.error(`  \u2717 ${e.stack}`); failed = true; } finally {
	for (const p of procs) {
		try { process.kill(-p.pid, 'SIGTERM'); } catch { /* gone */ }
		for (let i = 0; i < 100 && p.exitCode === null && p.signalCode === null; i++) await sleep(50);
		try { process.kill(-p.pid, 'SIGKILL'); } catch { /* gone */ }
	}
	for (const w of trees) { try { execFileSync('git', ['worktree', 'remove', '--force', w], { cwd: ROOT, stdio: 'ignore' }); } catch { /* left for git worktree prune */ } }
	for (const f of fs.readdirSync(OUT)) if (f.startsWith('data-') || f === 'profile') fs.rmSync(path.join(OUT, f), { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
