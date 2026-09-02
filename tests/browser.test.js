/*
H13.8 — the browser harness, and the discharge of B170.

WHY THIS EXISTS. Three separate gaps had one cause. The laser shipped with no test. Every visual
defect in the deviation tier was found by the director rather than by the suite. And B170 -- a
synthetic `KeyboardEvent` or pointer event that fails silently, so the assertion is fine and never
reaches the thing it is about -- has been held for three sessions with a remedy nobody had built.

The remedy is REAL INPUT. `Input.dispatchKeyEvent` and `Input.dispatchMouseEvent` enter at the
browser's own input pipeline, so the application cannot tell them from a person. That is the
difference from `new PointerEvent(...)` dispatched by page script, which this tree has now watched
fail twice while reporting a clean result about nothing.

EVERY STAGE ASSERTS BEFORE THE NEXT. Both probe faults found while building this were of one kind:
a beautiful measurement of a thing that never happened. The first never entered run mode because a
selector was guessed; the second clicked a mid-route waypoint, which the arm rule correctly refuses,
and then reported that the peer never saw the change. Neither was a defect and both looked like one.
So the harness refuses to measure until it has proved the precondition, and says which one failed.

WHAT IT DELIBERATELY DOES NOT ASSERT. Nothing about timing, and nothing that needs a mover to be at
a particular place at a particular instant. Those belong to `tests/movers.test.js`, which answers
them with arithmetic and no browser. What only a browser can answer is whether the DOM ends up in
the shape the design claims, and that is all this asks.
*/
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = ['google-chrome', 'chromium', 'chromium-browser']
	.find((c) => { try { execFileSync('which', [c], { stdio: 'pipe' }); return true; } catch { return false; } });

const SKIP = !CHROME && 'no chrome on PATH';
const PITCH = 60;
const DIAGRAM = 'diagram-ba0001';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let dir = null, srv = null, chrome = null, tab = null, port = 0, cdp = 0, booted = null;

/*
A purpose-built board, not the director's diagram.

One straight route with a wide margin of empty ground beside it, one tower placed dead on the line
at a known cell, and a spawner already armed. Straight so nothing depends on corner geometry, wide
so the placement test has somewhere to click that is genuinely unoccupied, and pre-armed so movers
exist without the harness having to arm them first.
*/
function fixture() {
	const wp = (id, x, y, spawn) => ({ id, x, y, ...(spawn ? { spawn } : {}) });
	return {
		meta: { id: DIAGRAM, name: 'harness', version: 1 },
		nodes: [{ id: 'node-ba0004', name: 'lb', type: 'loadbalancer', x: 6 * PITCH, y: 0, shape: 'circle' }],
		waypoints: [
			// `since` must be a real stamp: the validator floors it at 2020-09 and a document it refuses is
		// SKIPPED, not reported -- which is how the first fixture vanished without a word
		wp('waypoint-ba0002', 0, 0, { interval: 600, speed: 2, kind: 'packet', since: Date.now() - 60_000 }),
			wp('waypoint-ba0003', 12 * PITCH, 0),
		],
		links: [{ id: 'link-ba0005', src: 'waypoint-ba0002', dst: 'waypoint-ba0003' }],
		zones: [], groups: [], selection: [],
	};
}

async function attach(url) {
	for (let i = 0; i < 80; i++) {
		try { await (await fetch(`http://127.0.0.1:${cdp}/json/list`)).json(); break; } catch { await sleep(250); }
	}
	const t = await (await fetch(`http://127.0.0.1:${cdp}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json();
	const { default: WebSocket } = await import('ws');
	const ws = new WebSocket(t.webSocketDebuggerUrl);
	let id = 0; const pending = new Map();
	ws.on('message', (raw) => {
		const m = JSON.parse(raw.toString());
		if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
	});
	await new Promise((r) => ws.on('open', r));
	const send = (method, params = {}) => new Promise((r) => {
		const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params }));
	});
	return {
		ws, send,
		async eval(expression) {
			const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
			if (res.result?.exceptionDetails) throw new Error(String(res.result.exceptionDetails.exception?.description).slice(0, 200));
			return res.result?.result?.value;
		},
		async key(k) {
			for (const type of ['keyDown', 'keyUp']) {
				await send('Input.dispatchKeyEvent', { type, text: type === 'keyDown' ? k : undefined,
					key: k, code: `Key${k.toUpperCase()}`, windowsVirtualKeyCode: k.toUpperCase().charCodeAt(0) });
			}
		},
		async click(x, y) {
			for (const type of ['mousePressed', 'mouseReleased']) {
				await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1, buttons: 1 });
			}
		},
	};
}

// poll until a condition holds, so nothing here depends on a guessed delay
async function until(tabRef, expr, ms = 8000) {
	const deadline = Date.now() + ms;
	let last = null;
	while (Date.now() < deadline) {
		last = await tabRef.eval(expr);
		if (last) return last;
		await sleep(150);
	}
	return last;
}

before(async () => {
	if (SKIP) return;
	dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-harness-'));
	fs.writeFileSync(path.join(dir, `${DIAGRAM}.json`), JSON.stringify(fixture()));
	port = 8200 + (process.pid % 300);
	cdp = 9600 + (process.pid % 300);

	srv = spawn('node', ['server/server.js'], {
		env: { ...process.env, DATA_DIR: dir, PORT: String(port) },
		stdio: 'pipe', cwd: path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'),
	});
	for (let i = 0; i < 60; i++) {
		try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) break; } catch { /* not up */ }
		await sleep(250);
	}

	chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${cdp}`, '--no-sandbox',
		'--disable-gpu', '--window-size=1600,1000', `--user-data-dir=${dir}/cdp`], { stdio: 'ignore' });
	tab = await attach(`http://127.0.0.1:${port}/?diagram=${DIAGRAM}`);
	await sleep(4000);

	/*
	The preconditions, proved once and recorded. Every test below reads `booted`; if the harness
	never got into a state where the thing under test could happen, the tests say THAT rather than
	reporting a confident false negative.
	*/
	await tab.key('r');
	const inRun = await until(tab, `document.querySelector('#container')?.classList.contains('run-mode') || false`, 4000);
	/*
	Did the FIXTURE load at all? Asked separately, because the first run of this harness reported
	"no packets appeared for an armed spawner" -- which reads as a defect in the mover pipeline and
	was in fact an id containing a non-hex character. The validator refused every entity and the
	document vanished, exactly as `server/store.js` documents. A harness that cannot tell a missing
	fixture from broken behaviour will eventually accuse the code of something the test did.
	*/
	const loaded = await until(tab, `document.getElementById('waypoint-ba0002') ? 1 : 0`, 6000);
	const movers = await until(tab, `document.querySelectorAll('[data-mover]').length`, 8000);
	booted = { inRun: !!inRun, loaded: !!loaded, movers: Number(movers) || 0 };
});

after(() => {
	try { chrome?.kill(); } catch { /* already gone */ }
	try { srv?.kill(); } catch { /* already gone */ }
	if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

test('H13.8/B170: real key input reaches the app -- run mode entered by pressing r', { skip: SKIP }, () => {
	// the B170 discharge, stated as its own test. A synthetic KeyboardEvent does not do this.
	assert.equal(booted.inRun, true, 'pressing r did not enter run mode');
});

test('H13.8: the fixture document actually loaded', { skip: SKIP }, () => {
	// stated first and on its own, so every failure below can be read as behaviour rather than setup
	assert.equal(booted.loaded, true, 'the harness diagram is not on screen -- fixture or validator, not behaviour');
});

test('H13.8: an armed spawner puts packets in the DOM', { skip: SKIP }, () => {
	assert.equal(booted.loaded, true, 'precondition: fixture loaded');
	assert.equal(booted.inRun, true, 'precondition: run mode');
	assert.ok(booted.movers > 0, 'no [data-mover] elements appeared for an armed spawner');
});

test('H13.8: the beam is drawn OVER the packets, not behind them', { skip: SKIP }, async () => {
	/*
	Fully deterministic and the reason this file earns its runtime: document order IS the visual,
	and it needs no timing at all. The director reported a beam that stopped at the packet's edge;
	the cause was the packet drawing on top of it, so the line was occluded from the near edge in.
	*/
	assert.equal(booted.loaded, true, 'precondition: fixture loaded');
	assert.equal(booted.inRun, true, 'precondition: run mode');
	const order = await until(tab, `(() => {
		const l = document.querySelector('#movers');
		if (!l) return null;
		const kids = [...l.children].map(c => c.getAttribute('class'));
		const p = kids.indexOf('packets'), b = kids.indexOf('beams');
		return JSON.stringify({ kids, p, b });
	})()`);
	assert.ok(order, 'the movers layer never appeared');
	const { kids, p, b } = JSON.parse(order);
	assert.ok(p >= 0, `no packets group: ${kids}`);
	assert.ok(b >= 0, `no beams group: ${kids}`);
	assert.ok(b > p, `beams must come after packets in document order, got packets@${p} beams@${b}`);
});

test('H13.8: a firing tower draws a beam anchored on itself', { skip: SKIP }, async () => {
	// the laser had no test at all. This asserts the end the simulation controls -- the tower end --
	// because the far end is a moving target and asserting where it is would be asserting a moment.
	assert.equal(booted.loaded, true, 'precondition: fixture loaded');
	assert.equal(booted.inRun, true, 'precondition: run mode');
	const beam = await until(tab, `(() => {
		const b = document.querySelector('.beam');
		if (!b) return null;
		return JSON.stringify({ x1: +b.getAttribute('x1'), y1: +b.getAttribute('y1'),
			x2: +b.getAttribute('x2'), y2: +b.getAttribute('y2') });
	})()`, 12000);
	assert.ok(beam, 'no .beam element appeared while a tower had packets in range');
	const b = JSON.parse(beam);
	assert.equal(b.x1, 6 * PITCH, 'the beam starts at the tower');
	assert.equal(b.y1, 0);
	assert.ok(b.x2 !== b.x1 || b.y2 !== b.y1, 'the beam has length -- it reaches a target');
});

test('H13.8: the beam layer cannot eat a placement press', { skip: SKIP }, async () => {
	// play places towers by pressing open ground, and a beam sweeping under the cursor must not
	// intercept it. Asserted as computed style rather than as a click, so it cannot flake on aim.
	assert.equal(booted.loaded, true, 'precondition: fixture loaded');
	assert.equal(booted.inRun, true, 'precondition: run mode');
	const pe = await tab.eval(`(() => { const g = document.querySelector('#movers .beams');
		return g ? getComputedStyle(g).pointerEvents : null; })()`);
	assert.equal(pe, 'none', 'the beams group must be transparent to pointer input');
});

test('H13.8: pressing open ground in run mode places a tower', { skip: SKIP }, async () => {
	/*
	The rule that carries the whole "only placement travels" claim, driven by a real mouse press.
	Several points are tried because a cell can be occupied in the MODEL while looking empty on
	screen, and one sample cannot tell a broken rule from a taken cell -- which is exactly the
	false conclusion the first version of this probe reached.
	*/
	assert.equal(booted.loaded, true, 'precondition: fixture loaded');
	assert.equal(booted.inRun, true, 'precondition: run mode');
	const ids = () => tab.eval(`JSON.stringify([...document.querySelectorAll('#nodes .node')].map(n => n.id).sort())`);
	const before = JSON.parse(await ids());

	const spots = JSON.parse(await tab.eval(`(() => {
		const b = document.querySelector('#container').getBoundingClientRect();
		const out = [];
		for (let x = b.x + 100; x < b.x + b.width - 100; x += 90) {
			for (let y = b.y + 100; y < b.y + b.height - 100; y += 90) {
				const el = document.elementFromPoint(x, y);
				if (el && el.closest && !el.closest('.node,.zone,.link,.group,.waypoint')) out.push([x, y]);
			}
		}
		return JSON.stringify(out);
	})()`));
	assert.ok(spots.length, 'no visually-empty ground on the canvas -- fixture problem, not a defect');

	let placed = [];
	for (const [x, y] of spots.slice(0, 12)) {
		await tab.click(x, y);
		await sleep(350);
		placed = JSON.parse(await ids()).filter((i) => !before.includes(i));
		if (placed.length) break;
	}
	assert.ok(placed.length, `no tower placed across ${Math.min(spots.length, 12)} open points`);
});

test('H13.8/H13.2: a turret rotates to face what it is tracking', { skip: SKIP }, async () => {
	/*
	The only assertion in this file that would have caught a purely visual defect before the
	director did. The `loadbalancer` glyph's middle arrow points east at rest, so a rotation of 0
	means "aiming east" and any other value means the turret has turned.

	The fixture puts the tower ON the route with packets flowing past it in both directions relative
	to the tower's centre, so the bearing must move -- a turret welded at 0 would pass a test that
	only checked the attribute exists.
	*/
	assert.equal(booted.loaded, true, 'precondition: fixture loaded');
	assert.equal(booted.inRun, true, 'precondition: run mode');

	const read = `(() => { const n = document.getElementById('node-ba0004');
		const g = n && n.querySelector('[data-layer="glyph"]');
		return g && g.dataset.aim !== undefined ? g.dataset.aim : null; })()`;

	const first = await until(tab, read, 12000);
	assert.ok(first !== null, 'the turret never took a bearing while packets were in range');

	// and it TRACKS: sampled until the bearing differs, because a target crossing the tower sweeps it
	const deadline = Date.now() + 12000;
	const seen = new Set([first]);
	while (Date.now() < deadline && seen.size < 2) {
		await sleep(200);
		const now = await tab.eval(read);
		if (now !== null) seen.add(now);
	}
	assert.ok(seen.size > 1, `the bearing never changed: only ever ${[...seen].join(', ')}`);

	// the rotation is actually applied, not merely recorded
	const transform = await tab.eval(`document.getElementById('node-ba0004').querySelector('[data-layer="glyph"]').getAttribute('transform')`);
	assert.match(String(transform), /^rotate\(-?\d+\)$/, `expected a rotate transform, got ${transform}`);
});
