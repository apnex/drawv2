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
let lockToken = null;   // shared between the two tests that write, so they renew rather than race

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
		/*
		The tower sits BESIDE the route, two cells off, not on it.

		On the line a bearing can only ever be 0 or 180, and since a tower tracks the LEADING target
		it is almost always the eastern one -- so the angle never moves and a turret welded at zero
		would pass. The first version of this fixture did exactly that and the test passed standalone
		by luck, then failed in the full suite. Beside the path the bearing sweeps a wide arc as a
		packet goes by, which is both the honest test and how a player actually places one.
		*/
		nodes: [{ id: 'node-ba0004', name: 'lb', type: 'loadbalancer', x: 6 * PITCH, y: 2 * PITCH, shape: 'circle' }],
		waypoints: [
			// `since` must be a real stamp: the validator floors it at 2020-09 and a document it refuses is
		// SKIPPED, not reported -- which is how the first fixture vanished without a word
		wp('waypoint-ba0002', 0, 0, { interval: 600, speed: 2, kind: 'packet', since: Date.now() - 60_000 }),
			wp('waypoint-ba0003', 12 * PITCH, 0),
		],
		links: [{ id: 'link-ba0005', name: 'link-ba0005', src: 'waypoint-ba0002', dst: 'waypoint-ba0003' }],
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
	assert.equal(b.y1, 2 * PITCH);
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

/*
H14.8/B191 -- a beat must unfurl for a viewer who is ALREADY watching.

This is the defect that reached the director's screen. `txn.commit` recorded the reveal and
`changeBody` did not forward it, so a browser holding the page applied the ops and painted every
entity at once. The SNAPSHOT path carried it, which is the worst possible shape: reload and it
unfurls, watch it happen and it does not.

No unit test could have caught it. The derivation, the model round trip and the CLI were each
tested and each correct; the gap was the websocket broadcast BETWEEN them. Only a real browser
receiving a real broadcast spans that, which is what this harness is for -- and the reason the
observation gap is fixed here rather than only the forwarding.

Asserted on the DOM rather than on a timing: the entities exist (the ops applied) and the ones the
beat has not reached carry `data-unrevealed`. A test that waited a second and counted what was
visible would be a test about setInterval.
*/
test('H14.8/B191: a beat commits to a WATCHING page and the entities are withheld', { skip: SKIP }, async () => {
	assert.ok(booted?.loaded, 'precondition: the fixture document loaded');

	/*
	The write slot, taken the way the CLI takes it. The page itself is a reader here and holds no
	lock, but the gate refuses an unlocked write outright -- the first run of this test reported
	HTTP 423 and would have read as "the beat did not unfurl" if the precondition had not been
	asserted before the measurement.
	*/
	const lockRes = await fetch(`http://127.0.0.1:${port}/api/v1/diagrams/${DIAGRAM}/lock`, { method: 'POST' });
	assert.ok(lockRes.ok, `precondition: the write slot was taken (HTTP ${lockRes.status})`);
	const { token } = await lockRes.json();
	assert.ok(token, 'precondition: the lock answered with a token');
	lockToken = token;   // the H14.12 test below renews this rather than competing for a new one

	// commit a beat over the wire, exactly as the CLI does, while this page is open
	const res = await fetch(`http://127.0.0.1:${port}/api/v1/diagrams/${DIAGRAM}/commit`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', 'x-draw-lock': token },
		body: JSON.stringify({
			ops: [
				{ op: 'put', kind: 'node', entity: { id: 'node-be0001', name: 'beat-a', type: 'server', x: 300, y: 300 } },
				{ op: 'put', kind: 'node', entity: { id: 'node-be0002', name: 'beat-b', type: 'server', x: 360, y: 300 } },
				{ op: 'put', kind: 'node', entity: { id: 'node-be0003', name: 'beat-c', type: 'server', x: 420, y: 300 } },
			],
			label: 'beat', pace: 1200, caption: 'the unfurl',
		}),
	});
	assert.ok(res.ok, `precondition: the commit was accepted (HTTP ${res.status})`);

	// the ops applied, so all three entities are in the DOM -- the reveal hides, it does not create
	const present = await until(tab, `document.getElementById('node-be0003') ? 1 : 0`, 6000);
	assert.ok(present, 'the third entity reached the page at all');

	/*
	The assertion the director made by eye. With a 4000ms interval, the first entity is revealed at
	the origin and the third is four seconds behind it -- so a page that received the reveal marks
	the later ones, and a page that did not marks nothing and shows everything at once.
	*/
	const withheld = await until(tab,
		`document.querySelectorAll('[data-unrevealed]').length`, 5000);
	assert.ok(Number(withheld) > 0,
		'entities the beat has not reached must carry data-unrevealed -- all three appeared at once');

	// and the caption reached its channel
	const caption = await until(tab, `document.getElementById('beat-caption')?.textContent || ''`, 4000);
	assert.match(String(caption), /the unfurl/, 'the caption reached the status bar');
});

/*
The caption is centred on the CANVAS, not on the footer -- a cosmetic request with arithmetic in it.

`#status` is a sibling of `#content`, so it spans the palette rail too. A caption centred on the bar
therefore sits half a rail-width left of the drawing it narrates, and it drifts as the readout beside
it changes length -- which happens on every pointer move. Pinned to `50% + (rail + border) / 2`
instead, single-sourced from the same custom properties the rail itself uses.

Measured rather than eyeballed, because the whole claim is a number: the two centres must agree, and
"looks about right" is what the half-pixel border error would have survived.
*/
test('H14.4: the beat caption is centred on the canvas, not on the footer', { skip: SKIP }, async () => {
	assert.ok(booted?.loaded, 'precondition: the fixture document loaded');
	await tab.eval(`document.getElementById('beat-caption').textContent = 'a caption long enough to have a width'`);
	const got = JSON.parse(await until(tab, `JSON.stringify((() => {
		const cap = document.getElementById('beat-caption').getBoundingClientRect();
		const svg = document.getElementById('container').getBoundingClientRect();
		return { off: Math.round(((cap.left + cap.width / 2) - (svg.left + svg.width / 2)) * 10) / 10,
			font: parseFloat(getComputedStyle(document.getElementById('beat-caption')).fontSize) };
	})())`, 4000));
	assert.ok(Math.abs(got.off) <= 1, `caption centre is ${got.off}px from the canvas centre`);
	/*
	Pinned to the ruled size rather than a floor. `>= 16` passed at 15, 17 and 19 alike, so it
	asserted "bigger than the readout" and not the size that was actually chosen -- and the size IS
	the decision here, arrived at by the director looking at it twice. A floor would let the next
	edit drift it back down and stay green.
	*/
	assert.equal(got.font, 19, `the caption is ruled at 19px, got ${got.font}px`);
	const readout = Number(await tab.eval(
		`parseFloat(getComputedStyle(document.getElementById('readout-bottom')).fontSize)`));
	assert.ok(got.font > readout, `and must outrank the readout beside it (${readout}px)`);
});

/*
H14.12 -- a link is DRAWN, not faded. Asserted in a browser because the claim is about the DOM.

The trace is a dash-offset animating to zero. Mid-flight the offset is somewhere between the path
length and nothing, which is the whole property: a link that faded would have no dasharray at all,
and one that simply appeared would sit at offset 0 from the first frame.
*/
test('H14.12: a link traces rather than fading, and a node does not', { skip: SKIP }, async () => {
	assert.ok(booted?.loaded, 'precondition: the fixture document loaded');
	/*
	The B191 test above already holds the write slot for this diagram, and a second acquire answers
	409. Re-acquiring with the SAME token renews it rather than competing (B140), which is what a
	second test against one fixture should do -- taking a fresh lock would make the two tests race
	on run order.
	*/
	const lockRes = await fetch(`http://127.0.0.1:${port}/api/v1/diagrams/${DIAGRAM}/lock`,
		{ method: 'POST', headers: lockToken ? { 'x-draw-lock': lockToken } : {} });
	assert.ok(lockRes.ok, `precondition: the write slot (HTTP ${lockRes.status})`);
	const { token } = await lockRes.json();

	const res = await fetch(`http://127.0.0.1:${port}/api/v1/diagrams/${DIAGRAM}/commit`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', 'x-draw-lock': token },
		body: JSON.stringify({
			ops: [
				{ op: 'put', kind: 'node', entity: { id: 'node-fa0001', name: 'ta', type: 'server', x: -600, y: 420 } },
				{ op: 'put', kind: 'node', entity: { id: 'node-fa0002', name: 'tb', type: 'server', x: 600, y: 420 } },
				{ op: 'put', kind: 'link', entity: { id: 'link-fa0001', name: 'tl', src: 'node-fa0001', dst: 'node-fa0002' } },
			],
			label: 'trace', pace: 250, caption: 'tracing',
		}),
	});
	assert.ok(res.ok, `precondition: the commit was accepted (HTTP ${res.status})`);

	// the link is the third entity, so it is revealed last -- wait until it has been
	const armed = await until(tab, `(() => {
		const el = document.getElementById('link-fa0001');
		if (!el) return 0;
		return el.style.strokeDasharray ? 1 : 0;
	})()`, 12000);
	assert.ok(armed, 'the link carries a stroke-dasharray, so it is being drawn rather than faded');

	const dashed = await tab.eval(`(() => {
		const el = document.getElementById('link-fa0001');
		return JSON.stringify({ arr: parseFloat(el.style.strokeDasharray), trans: el.style.transition });
	})()`);
	const got = JSON.parse(dashed);
	assert.ok(got.arr > 0, `the dash is the path length, got ${got.arr}`);
	assert.match(got.trans, /stroke-dashoffset/, 'and the transition animates the offset');

	// a node has no dasharray -- it fades
	const nodeArr = await tab.eval(
		`document.getElementById('node-fa0001')?.style.strokeDasharray || ''`);
	assert.equal(nodeArr, '', 'a node is faded, not traced');

	/*
	And the fade is the ruled 500ms, read from the STYLESHEET rather than from the constant beside
	it. `FADE_MS` has no JS consumer -- the transition is CSS -- so a test that only read the export
	would pass while the stylesheet said something else entirely, which is the split-brain the two
	files' cross-references exist to prevent.
	*/
	const fade = await tab.eval(
		`getComputedStyle(document.getElementById('node-fa0001')).transitionDuration`);
	assert.equal(String(fade).trim(), '0.5s', `a node fades in the ruled 500ms, got ${fade}`);
});

/*
B197: the favicon is GENERATED from the kernel glyph, and its geometry is centred.

The previous client shipped a hand-maintained `favicon.svg` whose arrow path was byte-identical to
`#glyph-router` in GLYPH_DEFS. Two files owning one drawing is the twin problem, and a favicon is
the asset least likely to be looked at again -- so the copy would drift in silence.

The geometry assertions are the useful half. A favicon that serves 200 with valid XML and renders
nothing looks identical to a working one from the server's side, which is exactly what happened
while this was being built: HTTP status and `xml.parse` both passed on an icon painting 10 pixels.
The numbers below come from GLYPH_BB, which states that the router occupies 30x30 user units
centred on the origin after `.icon`'s own scale -- so a 32-unit viewBox centred on 0 frames it with
one unit of margin, and the ring radius is half the glyph extent.
*/
test('B197/B204: the favicon composes a node exactly as the canvas does', async () => {
	const { faviconSvg, GLYPH_BB } = await import('../kernel/theme.mjs');
	const { STD, L_STD } = await import('../kernel/spec.mjs');
	const svg = faviconSvg();

	assert.match(svg, /href="#glyph-router"/, 'the favicon must USE the kernel glyph, not restate it');
	assert.match(svg, /<defs id="defs">/, 'the glyph defs must be embedded or the href resolves to nothing');
	assert.match(svg, /width="32" height="32"/, 'an SVG with no intrinsic size collapses in an <img>');

	/*
	B204 -- the three things that were wrong, each from inventing the composition instead of copying
	renderEl. The fill one is the reason this is asserted structurally rather than by eye: `.hollow`
	resolves `var(--fill, #ffffff)` and only `.node` supplies `--fill`, so omitting that one class
	rendered the router's centre WHITE on a dark tab -- while the icon still served 200, parsed as
	valid XML, and referenced the right glyph.
	*/
	assert.match(svg, /<g class="node">/,
		'without .node the --fill variable is unset and .hollow falls back to #ffffff');
	assert.match(svg, new RegExp(`<circle class="frame" r="${L_STD.frame.ext}"/>`),
		'the frame must be the node frame at the layout extent, not a ring invented here');
	assert.doesNotMatch(svg, /class="ring"/, 'the hand-rolled ring class is what this replaced');

	// the glyph is FITTED to its own bounding box in a nested svg, as renderEl does -- not scaled
	// by a constant, which is what `.icon` would have done
	const [bx, by, bw, bh] = GLYPH_BB.router;
	assert.match(svg, new RegExp(`viewBox="${bx} ${by} ${bw} ${bh}"`), 'the glyph must be fitted to its bounding box');
	assert.match(svg, new RegExp(`width="${STD.socket}" height="${STD.socket}"`), 'in the socket-sized box a node uses');

	// the viewBox must clear the frame's own stroke, or the ring is clipped by its weight
	const box = svg.match(/viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)"/);
	assert.ok(Math.abs(Number(box[1])) > L_STD.frame.ext,
		`the viewBox must extend past the frame radius or its stroke is cut, got ${box[1]}`);
});

/*
B198: nothing on the canvas is selectable text.

The director reported text boxes highlighting during a drag that never passed over them. That is
Chrome's default: an SVG `<text>` is selectable, and a sweep across the canvas selects every text
node between the anchor and the focus in DOCUMENT order -- so a box in a far corner lights up
because it happens to sit between two elements the pointer did cross.

The rule is asserted on a `<text>` with NO class. `.label` and `.data-tag` each carried
`user-select: none` individually and `.content-text`, added later, did not, so a per-class test
would have passed throughout the period the defect existed. An unclassed element is the only probe
that distinguishes "every current class remembered" from "the surface is covered".
*/
test('B198: canvas text cannot be selected by a drag, including a class nobody has written yet', { skip: SKIP }, async () => {
	assert.equal(booted.loaded, true, 'precondition: fixture loaded');

	const styles = await until(tab, `(() => {
		const svg = document.getElementById('container');
		if (!svg) return null;
		const probe = document.createElementNS('http://www.w3.org/2000/svg', 'text');
		probe.textContent = 'probe';
		svg.appendChild(probe);
		const read = (el) => { const cs = getComputedStyle(el); return cs.userSelect || cs.webkitUserSelect; };
		const out = { unclassed: read(probe), root: read(svg) };
		for (const cls of ['content-text', 'label', 'data-tag']) {
			const el = svg.querySelector('.' + cls);
			if (el) out[cls] = read(el);
		}
		probe.remove();
		return JSON.stringify(out);
	})()`);

	const got = JSON.parse(styles);
	assert.equal(got.root, 'none', 'the canvas root must not be selectable');
	assert.equal(got.unclassed, 'none',
		'a <text> with no class is selectable -- the rule is per-class, so the next text element reintroduces the bug');
	for (const [cls, value] of Object.entries(got)) {
		assert.equal(value, 'none', `${cls} is selectable and would highlight during a rubber-band drag`);
	}
});

/*
B199: the LIVE canvas draws the anchor on an endpoint, not just the export.

`tests/span.test.js` proves the kernel's numbers and the SVG export's emission. Neither can see
`app/src/renderer.js`, which builds DOM rather than a string -- so making the endpoint branch skip
the anchor passes that whole file. Measured: that exact mutation left 949 tests green.

This is the B191 shape again. Every layer correct, the composition unverified, and the gap sits
precisely where no existing test can reach. The fixture's link runs waypoint -> waypoint, so one
endpoint is guaranteed on screen.
*/
test('B199: an endpoint on the live canvas draws the anchor beneath its pad', { skip: SKIP }, async () => {
	assert.equal(booted.loaded, true, 'precondition: fixture loaded');

	const shape = await until(tab, `(() => {
		const g = document.querySelector('#waypoints .waypoint.endpoint');
		if (!g) return null;
		const circles = [...g.querySelectorAll('circle')]
			.map((c) => ({ cls: c.getAttribute('class'), r: Number(c.getAttribute('r')) }))
			.filter((c) => c.cls !== 'select-box');
		return JSON.stringify(circles);
	})()`);

	const circles = JSON.parse(shape);
	const anchor = circles.find((c) => c.cls === 'wp-anchor');
	const pad = circles.find((c) => c.cls === 'wp-ring');
	const dot = circles.find((c) => c.cls === 'wp-dot');

	assert.ok(anchor, 'the endpoint has no anchor ring -- it is drawing its pad INSTEAD of the anchor, which is B199');
	assert.ok(pad, 'the endpoint pad is missing');
	assert.ok(dot, 'the centre dot is missing');
	assert.ok(anchor.r > pad.r, `the anchor must sit outside the pad, got anchor=${anchor.r} pad=${pad.r}`);
});

/*
B201: the whole waypoint disc is grabbable, not just its outermost stroke.

`pointer-events: all` sat on `.wp-ring`, which was right while the pad WAS the outer ring at r=20.
B199 put the anchor outside it and nothing moved the rule, leaving a dead band between the pad's
ink edge (16.5) and the anchor's 2px stroke: clicking at 17-18px from centre hit the bare svg. The
director found it as "clicking the endpoint fails to arm spawner", which is what a dead zone looks
like from the outside -- the click lands, it just lands on nothing.

Probed by hit-testing at measured offsets rather than by reading CSS. `pointer-events` resolves
against paint, fill and stacking order together, so the computed value on one element does not
tell you what a click at a given point will reach.
*/
test('B201: a click anywhere inside the anchor reaches the waypoint', { skip: SKIP }, async () => {
	assert.equal(booted.loaded, true, 'precondition: fixture loaded');

	const probe = await until(tab, `(() => {
		/*
		The waypoint FURTHEST from any node. A socket rect is painted on the grid around every node
		and sits above the waypoint layer, so probing near one reports the socket and says nothing
		about what the waypoint catches -- which is exactly what the first version of this measured.
		*/
		const g = document.querySelector('#waypoints .waypoint.endpoint');
		if (!g) return null;
		const box = g.getBoundingClientRect();
		const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
		/*
		Probe by ELEMENTS AT POINT, not the topmost one. A socket rect is painted on the grid around
		every node and a link runs through the waypoint, and both can sit above it -- so asking what
		is on top reports the overlay and says nothing about whether the waypoint catches the click.
		What matters is whether the waypoint is IN the hit stack at that point, which is what decides
		if a click can reach it at all.
		*/
		const stack = (dy) => document.elementsFromPoint(cx, cy + dy)
			.map((e) => e.getAttribute('class') || e.tagName)
			.find((c) => typeof c === 'string' && c.startsWith('wp-')) || 'NOTHING';
		const at = stack;
		/*
		OFFSETS ARE IN SCREEN PIXELS, and the canvas has a viewBox -- 1920 user units drawn into
		however wide the window is -- so a radius of 20 user units is NOT 20px on screen. Probing at
		raw user-unit offsets lands outside the waypoint and reports NOTHING, which reads exactly
		like the defect under test. The anchor's own rendered box gives the conversion.
		*/
		const rpx = box.height / 2;                    // the anchor's on-screen radius
		const u = rpx / 20;                            // screen px per user unit
		return JSON.stringify({
			scale: Number(u.toFixed(3)),
			pad: at(8 * u), dead: at(17.5 * u), rim: at(19.5 * u), outside: at(26 * u),
		});
	})()`);

	const hit = JSON.parse(probe);
	const inside = (v) => typeof v === 'string' && v.startsWith('wp-');

	assert.ok(inside(hit.pad), `a click on the pad must reach the waypoint, got ${hit.pad}`);
	assert.ok(inside(hit.dead),
		`the band between the pad and the anchor is dead -- a click there hit ${hit.dead}, which is why an endpoint stopped arming`);
	assert.ok(inside(hit.rim), `a click just inside the anchor must reach the waypoint, got ${hit.rim}`);
	assert.ok(!inside(hit.outside), `a click well outside the anchor must NOT hit it, got ${hit.outside}`);
});

/*
B202: run mode does not draw the anchor, and the pad survives it.

An anchor says "a link can reach this grid point" -- a statement to someone placing things, not to
someone watching. Run mode is the presentation surface and the anchor is scaffolding belonging to
the one underneath.

Two halves, and the second is why this is a browser test rather than a CSS assertion. The anchor
carries `pointer-events: all` for the entire waypoint (B201), so hiding it also removes the grab
target. That is intended -- dragging a waypoint while the diagram runs is an authoring gesture
leaking into run mode -- but the ENDPOINT PAD must keep catching clicks, because arming a spawner
is a run-mode action. Hiding the wrong layer, or hiding it with something that kills the whole
group's hit-testing, would pass a style check and break arming.
*/
test('B202: run mode hides the anchor and keeps the pad clickable', { skip: SKIP }, async () => {
	assert.equal(booted.loaded, true, 'precondition: fixture loaded');

	const probe = await until(tab, `(() => {
		const svg = document.getElementById('container');
		const g = document.querySelector('#waypoints .waypoint.endpoint');
		if (!svg || !g) return null;
		const box = g.getBoundingClientRect();
		const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
		const was = svg.classList.contains('run-mode');

		const read = () => {
			const anchor = g.querySelector('.wp-anchor'), pad = g.querySelector('.wp-ring');
			// the anchor's box collapses once hidden, so the scale comes from the PAD, which stays
			const u = (pad.getBoundingClientRect().height / 2) / 14;
			const hit = (r) => document.elementsFromPoint(cx, cy + r * u)
				.map((e) => e.getAttribute('class') || e.tagName)
				.find((c) => typeof c === 'string' && c.startsWith('wp-')) || 'NOTHING';
			return { anchor: getComputedStyle(anchor).display, pad: getComputedStyle(pad).display, padHit: hit(8) };
		};

		svg.classList.remove('run-mode');
		const author = read();
		svg.classList.add('run-mode');
		const run = read();
		svg.classList.toggle('run-mode', was);
		return JSON.stringify({ author, run });
	})()`);

	const { author, run } = JSON.parse(probe);

	assert.notEqual(author.anchor, 'none', 'the anchor must be drawn while authoring -- it is the placement aid');
	assert.equal(run.anchor, 'none', 'run mode still draws the anchor');

	assert.notEqual(run.pad, 'none', 'the endpoint pad must survive run mode -- a spawner has to stay visible');
	assert.ok(run.padHit.startsWith('wp-'),
		`the pad must still catch a click in run mode or a spawner cannot be armed, got ${run.padHit}`);
});

/*
B202: in run mode a bend leaves only the grid dot behind.

With the anchor hidden, a bend was still marking itself with a bright centre dot -- the same
authoring claim the anchor made. A bend is a corner the route turns, and in run mode the turn is
already visible in the path itself.

The dot is UNCOVERED rather than removed: `#grid-nodes` paints a dim #202020 circle at every snap
point and a waypoint draws its own at the same radius one layer above, occluding it (B200). So the
assertion worth making is not "the bend has no dot" but "the bend's own dot is gone AND the grid
still draws one there" -- otherwise hiding it would leave a hole, which is a different defect that
looks identical in a display check.

An endpoint keeps its dot: `.spawning` and `.armed` recolour precisely that circle, so hiding it
would remove the only signal that a spawner is live.
*/
test('B202: run mode unhighlights a bend, and keeps the endpoint dot that shows spawn state', { skip: SKIP }, async () => {
	assert.equal(booted.loaded, true, 'precondition: fixture loaded');

	const probe = await until(tab, `(() => {
		const svg = document.getElementById('container');
		const end = document.querySelector('#waypoints .waypoint.endpoint');
		if (!svg || !end) return null;
		/*
		The fixture's link runs waypoint to waypoint with no via, so it has no bend and reshaping
		it would disturb the tests that share it. The rule under test is a CSS selector matching
		the .bend .wp-dot selector, so a representative bend proves it: same classes, same structure,
		appended to the same layer so it inherits the same cascade. Removed before returning.
		*/
		const bend = document.createElementNS('http://www.w3.org/2000/svg', 'g');
		bend.setAttribute('class', 'waypoint bend');
		const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
		dot.setAttribute('class', 'wp-dot');
		bend.appendChild(dot);
		document.getElementById('waypoints').appendChild(bend);
		const was = svg.classList.contains('run-mode');
		const read = () => ({
			bendDot: getComputedStyle(bend.querySelector('.wp-dot')).display,
			endDot: getComputedStyle(end.querySelector('.wp-dot')).display,
			endPad: getComputedStyle(end.querySelector('.wp-ring')).display,
		});
		svg.classList.remove('run-mode');
		const author = read();
		svg.classList.add('run-mode');
		const run = read();
		svg.classList.toggle('run-mode', was);
		bend.remove();
		// the grid must still be drawing dots, or "unhighlighted" is really "deleted"
		const grid = document.querySelectorAll('#grid-nodes circle').length;
		const gridR = grid ? document.querySelector('#grid-nodes circle').getAttribute('r') : null;
		return JSON.stringify({ author, run, grid, gridR });
	})()`);

	const { author, run, grid, gridR } = JSON.parse(probe);

	assert.notEqual(author.bendDot, 'none', 'a bend must show its dot while authoring');
	assert.equal(run.bendDot, 'none', 'run mode still highlights a bend');

	assert.notEqual(run.endDot, 'none', 'the endpoint dot must survive -- spawning and armed recolour it');
	assert.notEqual(run.endPad, 'none', 'the endpoint pad must survive run mode');

	assert.ok(grid > 0, 'the node grid draws no dots -- a hidden bend dot would leave a hole, not the grid');
	assert.equal(Number(gridR), 2, `the grid dot must be the same radius the bend was lit at, got ${gridR}`);
});

/*
B219: the caption is as wide as the canvas, and never wider.

It was capped at `52ch` -- about 595px -- so a long beat narration ellipsised at roughly half the
available width. The cap existed to keep it off the readout, and that collision turned out to be
largely theoretical: a readout line is `cursor 4,3` or `spine-1 4,3`, around 80px, which mostly
sits under the 72px rail rather than over the drawing.

Asserted as a RELATIONSHIP to the canvas rather than against a pixel count. The caption describes
the drawing, so the drawing is its limit -- and both the width and the centring derive from
`--rail`, so a rail change must move and resize it together. A literal would pass until someone
changed the rail and then be silently wrong.
*/
test('B219: the caption spans the canvas and stays inside it', { skip: SKIP }, async () => {
	assert.equal(booted.loaded, true, 'precondition: fixture loaded');

	const probe = await until(tab, `(() => {
		const cap = document.getElementById('beat-caption');
		const svg = document.getElementById('container');
		if (!cap || !svg) return null;
		/*
		LONG ENOUGH TO OVERFLOW THE VIEWPORT, not merely long. A caption that fits proves nothing
		about containment: with no cap at all it would still sit inside the canvas, so the
		assertion would pass on a stylesheet that had lost the rule. Measured -- 600 characters at
		19px cannot fit any window this harness opens.
		*/
		const was = cap.textContent;
		cap.textContent = 'the spine layer accepts every leaf uplink '.repeat(15);
		const c = cap.getBoundingClientRect(), s = svg.getBoundingClientRect();
		const out = {
			capMax: getComputedStyle(cap).maxWidth,
			capW: Math.round(c.width), capX: Math.round(c.x), capR: Math.round(c.x + c.width),
			svgX: Math.round(s.x), svgR: Math.round(s.x + s.width),
		};
		cap.textContent = was;
		return JSON.stringify(out);
	})()`);

	const g = JSON.parse(probe);

	assert.ok(g.capX >= g.svgX - 1, `the caption starts inside the canvas: ${g.capX} vs ${g.svgX}`);
	assert.ok(g.capR <= g.svgR + 1, `and ends inside it: ${g.capR} vs ${g.svgR}`);

	/*
	The cap must be DERIVED, not a number. `52ch` was the old value and the thing this replaced; a
	fixed px or ch cap cannot track the rail, so the caption would stop matching the canvas the
	moment the rail moved.
	*/
	assert.doesNotMatch(g.capMax, /ch$/, 'the cap must not be a character count -- it cannot track the canvas');
	assert.ok(g.capW > 600,
		`a long caption must use the canvas, not ellipsise at half of it -- got ${g.capW}px, the old cap was ~595`);

	// and the overflowing caption is ELLIPSISED at the canvas edge rather than spilling past it
	assert.equal(g.capW, g.svgR - g.svgX,
		`an overlong caption must fill the canvas exactly, not overrun it -- got ${g.capW} against a canvas of ${g.svgR - g.svgX}`);
});

/*
H15.6 / B226: the arrowhead must actually PAINT, not merely be referenced.

The marker reached the exported SVG and the canvas both carried `marker-end`, and the director
could not see an arrow. Attribute presence is not visibility -- `fill="context-stroke"` resolves
against the referencing element's stroke, and the canvas strokes its links from a STYLESHEET rather
than from a stroke attribute. Whether that counts as context is the whole question, and no amount
of reading the DOM answers it.

So this asks the browser for PIXELS. `getBBox` on the rendered marker would say the shape exists;
only a readback says it has colour on the canvas the director is looking at.
*/
test('B226: a declared link paints an arrowhead the user can see', { skip: SKIP }, async () => {
	assert.equal(booted.loaded, true, 'precondition: fixture loaded');
	const painted = await tab.eval(`(async () => {
		const svg = document.querySelector('#container svg') || document.querySelector('svg');
		const link = document.querySelector('#links .link');
		if (!link) return { err: 'no link in the fixture' };
		link.setAttribute('marker-end', 'url(#flow-end)');
		// the marker must exist in the document the page actually loaded
		const def = document.querySelector('#flow-end');
		if (!def) return { err: 'no #flow-end marker defined on the page' };
		const head = def.querySelector('path');
		const fill = getComputedStyle(head).fill;
		// serialise just this link and rasterise it, so the readback is of the REAL stroke
		const box = link.getBBox();
		const one = '<svg xmlns="http://www.w3.org/2000/svg" width="' + Math.ceil(box.width + 40) + '" height="' + Math.ceil(box.height + 40) + '">'
			+ new XMLSerializer().serializeToString(document.querySelector('#kdefs svg') || document.createElementNS('http://www.w3.org/2000/svg','svg'))
			+ '<g transform="translate(' + (20 - box.x) + ',' + (20 - box.y) + ')">' + new XMLSerializer().serializeToString(link) + '</g></svg>';
		const img = new Image();
		const url = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(one)));
		await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('raster failed')); img.src = url; });
		const c = document.createElement('canvas');
		c.width = img.width; c.height = img.height;
		const ctx = c.getContext('2d');
		ctx.drawImage(img, 0, 0);
		const d = ctx.getImageData(0, 0, c.width, c.height).data;
		let lit = 0;
		for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0) lit += 1;
		// control: does a marker with a LITERAL fill paint, in the same rasterisation?
		const lit2 = await (async () => {
			const two = one.replace('fill="context-stroke"', 'fill="#4fc3f7"');
			const im2 = new Image();
			await new Promise((res, rej) => { im2.onload = res; im2.onerror = rej; im2.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(two))); });
			const c2 = document.createElement('canvas'); c2.width = im2.width; c2.height = im2.height;
			c2.getContext('2d').drawImage(im2, 0, 0);
			const dd = c2.getContext('2d').getImageData(0, 0, c2.width, c2.height).data;
			let n = 0; for (let i = 0; i < dd.length; i += 4) if (dd[i + 3] > 0) n += 1;
			return n;
		})();
		return { fill, lit, lit2, w: c.width, h: c.height };
	})()`);
	assert.ok(!painted.err, `precondition: ${painted.err || 'ok'}`);
	/*
	THE CONTROL IS THE POINT. `lit2` rasterises the same link with a LITERAL fill, so a zero in
	`lit` cannot be blamed on the harness, the serialisation or the canvas -- only on the paint.
	That control is what turned "I cannot see the arrow" into a measurement.
	*/
	assert.ok(painted.lit2 > 0, 'control: a literal fill must paint, or this test measures nothing');
	assert.ok(painted.lit > 0, 'the arrowhead must PAINT -- an attribute that resolves to nothing is not a picture');
});
