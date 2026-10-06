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
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { teardown } from './fixtures/teardown.mjs';
import { NO_CHROME, launchChrome } from './fixtures/chrome.mjs';   // one launch config for every harness
import { pipeEntity } from '../network/pipe-kind.mjs';   // V-b's board lays its pipes as the network names them

const SKIP = NO_CHROME;
const PITCH = 60;
const DIAGRAM = 'diagram-ba0001';
// K8: the same fixture under its own id, which no other test edits, so its tests see the page as it boots (K7 found the lock;
// K8's first full run found an earlier test's link)
const K8_DIAGRAM = 'diagram-c80001';
// V-b (H18.26): the network on the product page, on a board of its own, so no other test sees its pipes or edits
const NET_DIAGRAM = 'diagram-fe0001';   // sorts after the harness's: the shared tab opens the first diagram
function networkBoard() {
	const host = (id, x, y) => ({ id, name: id.slice(-2), type: 'host', shape: 'square', x, y });
	return {
		meta: { id: NET_DIAGRAM, name: 'network', version: 1, schema: 2 },
		nodes: [host('node-ab00a1', -360, 0), host('node-ab00a2', 360, 0), { id: 'node-ab00f1', name: 'f', x: 0, y: -240 },
			host('node-ab00c1', -360, 240), host('node-ab00c2', 360, 240)],
		links: [
			// up, routed through f -- a waypoint its stops never name -- over two hand pipes
			{ id: 'link-ab0001', name: 'routed', src: 'node-ab00a1', dst: 'node-ab00a2', order: 1 },
			// down: no pipe joins c and d
			{ id: 'link-ab0002', name: 'down', src: 'node-ab00c1', dst: 'node-ab00c2', order: 2 },
		],
		pipes: [pipeEntity('node-ab00a1', 'node-ab00f1', 'hand'), pipeEntity('node-ab00a2', 'node-ab00f1', 'hand')],
		zones: [], groups: [], selection: [],
	};
}
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
	const wp = (id, x, y, spawn) => ({ id, name: id, x, y, ...(spawn ? { spawn } : {}) });   // a waypoint: a node with no type, named (B187)
	return {
		meta: { id: DIAGRAM, name: 'harness', version: 1, schema: 2 },
		/*
		The tower sits BESIDE the route, two cells off, not on it.

		On the line a bearing can only ever be 0 or 180, and since a tower tracks the LEADING target
		it is almost always the eastern one -- so the angle never moves and a turret welded at zero
		would pass. The first version of this fixture did exactly that and the test passed standalone
		by luck, then failed in the full suite. Beside the path the bearing sweeps a wide arc as a
		packet goes by, which is both the honest test and how a player actually places one.
		*/
		// the two waypoints are nodes with no type (F-c)
		nodes: [{ id: 'node-ba0004', name: 'lb', type: 'loadbalancer', x: 6 * PITCH, y: 2 * PITCH, shape: 'circle', order: 1 },
			// `since` must be a real stamp: the validator floors it at 2020-09 and a document it refuses is
		// SKIPPED, not reported -- which is how the first fixture vanished without a word
		{ ...wp('node-ba0002', 0, 0, { interval: 600, speed: 2, kind: 'packet', since: Date.now() - 60_000 }), order: 2 },
			{ ...wp('node-ba0003', 12 * PITCH, 0), order: 3 },
		],
		links: [{ id: 'link-ba0005', name: 'link-ba0005', src: 'node-ba0002', dst: 'node-ba0003', order: 1 }],
		// stored complete, as the migration once completed it (B291): the link's leg its pipe, each node its order
		pipes: [pipeEntity('node-ba0002', 'node-ba0003', 'link')],
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
			// a NAMED key (Escape) has its own code and no text; a printable one is its character (K7 added the named case)
			const NAMED = { Escape: 27 };
			for (const type of ['keyDown', 'keyUp']) {
				await send('Input.dispatchKeyEvent', NAMED[k]
					? { type, key: k, code: k, windowsVirtualKeyCode: NAMED[k] }
					: { type, text: type === 'keyDown' ? k : undefined, key: k, code: `Key${k.toUpperCase()}`, windowsVirtualKeyCode: k.toUpperCase().charCodeAt(0) });
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
	fs.writeFileSync(path.join(dir, `${K8_DIAGRAM}.json`), JSON.stringify({ ...fixture(), meta: { ...fixture().meta, id: K8_DIAGRAM, name: 'k8' } }));
	fs.writeFileSync(path.join(dir, `${NET_DIAGRAM}.json`), JSON.stringify(networkBoard()));
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

	// the shared launch config (tests/fixtures/chrome.mjs); the window size is this harness's own, because its clicks depend on it
	chrome = launchChrome({ cdpPort: cdp, profileDir: `${dir}/cdp`, extra: ['--window-size=1600,1000'] });
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
	const loaded = await until(tab, `document.getElementById('node-ba0002') ? 1 : 0`, 6000);
	const movers = await until(tab, `document.querySelectorAll('[data-mover]').length`, 8000);
	booted = { inRun: !!inRun, loaded: !!loaded, movers: Number(movers) || 0 };
});

// B238 -- both processes write into `dir` as they shut down (Chrome its profile, the server its
// debounced diagram flush), so the directory is removed only once both have exited.
after(() => teardown([chrome, srv], dir));

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

	// AMENDED 2026-10-04 (R-c): the harness runs in run mode, which draws the run picture -- no anchor -- so this reads the
	// waypoint in view mode, where the anchor is the authoring aid it asserts, and puts the mode back
	const shape = await until(tab, `(() => {
		const was = window.draw.renderer.mode;
		window.draw.renderer.setMode('view');
		const g = document.querySelector('#waypoints .waypoint.endpoint');
		const circles = g ? [...g.querySelectorAll('circle')]
			.map((c) => ({ cls: c.getAttribute('class'), r: Number(c.getAttribute('r')) }))
			.filter((c) => c.cls !== 'select-box') : null;
		window.draw.renderer.setMode(was);
		return circles && JSON.stringify(circles);
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
		// AMENDED 2026-10-04 (R-c): run mode DRAWS the run picture (kernel RUN_PICTURE) rather than hiding by stylesheet, so this
		// switches the real mode and reads what is drawn -- the waypoint's element is re-made on the switch, so found each time
		const r = window.draw.renderer, was = r.mode;
		if (!document.querySelector('#waypoints .waypoint.endpoint')) return null;
		const read = () => {
			const g = document.querySelector('#waypoints .waypoint.endpoint');
			const box = g.getBoundingClientRect();
			const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
			const anchor = g.querySelector('.wp-anchor'), pad = g.querySelector('.wp-ring');
			const u = (pad.getBoundingClientRect().height / 2) / 14;
			const hit = (r) => document.elementsFromPoint(cx, cy + r * u)
				.map((e) => e.getAttribute('class') || e.tagName)
				.find((c) => typeof c === 'string' && c.startsWith('wp-')) || 'NOTHING';
			return { anchor: anchor ? getComputedStyle(anchor).display : 'none', pad: getComputedStyle(pad).display, padHit: hit(8) };
		};
		r.setMode('view');
		const author = read();
		r.setMode('run');
		const run = read();
		r.setMode(was);
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
		if (!document.querySelector('#waypoints .waypoint.endpoint')) return null;
		/*
		The fixture's link runs waypoint to waypoint with no via, so it has no bend and reshaping
		it would disturb the tests that share it. AMENDED 2026-10-04 (R-c): run mode now DRAWS the run picture rather than
		hiding a dot by stylesheet, so the bend must be one the renderer draws -- a waypoint no link touches draws as a bend.
		Put into this tab's model only (a direct model write reaches no server, B16), and deleted before returning.
		*/
		const r = window.draw.renderer, m = window.draw.model, was = r.mode;
		m.put('node', { id: 'node-fe0b01', name: 'probe-bend', x: 840, y: -420 });
		const read = () => {
			const bend = document.getElementById('node-fe0b01'), end = document.querySelector('#waypoints .waypoint.endpoint');
			const bendDot = bend.querySelector('.wp-dot');
			return {
				bendDot: bendDot ? getComputedStyle(bendDot).display : 'none',
				endDot: getComputedStyle(end.querySelector('.wp-dot')).display,
				endPad: getComputedStyle(end.querySelector('.wp-ring')).display,
			};
		};
		r.setMode('view');
		const author = read();
		r.setMode('run');
		const run = read();
		r.setMode(was);
		m.del('node', 'node-fe0b01');
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
B228: the arrowhead must survive an UPDATE, not only a create.

The first press of `f` drew an arrow and every press after it drew nothing. `render` sets the
marker; `update` sets only `d`, so a link that already had DOM kept whatever marker it was created
with -- which for a link created undeclared is none at all, forever.

B218 was this shape one branch over: create and update refreshed a waypoint's role, delete did not.
Here create is right and update is wrong. The lesson each time is the same -- a rule wired into one
branch of `handle` is wired into none of the others.

Driven through the REAL dispatch rather than by calling render directly, because the defect lives
in which branch runs.
*/
test('B228: cycling flow changes the marker every time, not only the first', { skip: SKIP }, async () => {
	assert.equal(booted.loaded, true, 'precondition: fixture loaded');
	const seen = await tab.eval(`(() => {
		const app = window.draw;
		const r = app && app.renderer;
		const model = app && app.model;
		if (!r || !model) return { err: 'no app handle' };
		const link = model.all('link')[0];
		if (!link) return { err: 'no link' };
		const markerOf = () => {
			const el = document.getElementById(link.id);
			if (!el) return 'MISSING';
			return el.getAttribute('marker-end') || el.getAttribute('marker-start') || 'none';
		};
		// THE REAL GESTURE. Selecting the link and pressing f is what the director does, and it is
		// the only path that exercises the command, the history commit and the renderer together.
		app.selection.set([link.id]);
		const sel = app.selection.list();
		const out = [markerOf()];
		const trace = [];
		for (let i = 0; i < 3; i += 1) {
			const before = String(model.get('link', link.id).direction);
			app.input.onDirectionKey();
			const after = String(model.get('link', link.id).direction);
			trace.push(before + '->' + after);
			out.push(markerOf());
		}
		return { out, trace, sel, said: app.readout && app.readout.flashMsg, flow: String(model.get('link', link.id).direction) };
	})()`);
	assert.ok(!seen.err, `precondition: ${seen.err || 'ok'}`);
	assert.equal(seen.out[1], 'url(#flow-end)', 'forward must show the end marker after an update');
	assert.equal(seen.out[2], 'url(#flow-start)', 'reverse must SWAP it, not keep the old one');
	assert.equal(seen.out[3], 'none', 'and clearing must remove it rather than leave the last one');
});

/*
B229: the readout carries the direction as STATE, not as a receipt that expires.

A selected link read `a <-> b` with a hardcoded arrow whichever way it flowed, and cycling `f`
flashed the answer for 1200ms before reverting. So the author had to remember where they were in
the cycle, or press again to find out -- which changes the thing they were asking about.

The selection line already re-renders on selection and on any change to the selected entity, so
putting the bar there makes it follow the document with no timer at all.
*/
test('B229: the selection line says which way a selected link flows, and keeps saying it', { skip: SKIP }, async () => {
	assert.equal(booted.loaded, true, 'precondition: fixture loaded');
	const seen = await tab.eval(`(() => {
		const app = window.draw;
		const link = app.model.all('link')[0];
		if (!link) return { err: 'no link' };
		app.selection.set([link.id]);
		const line = () => document.getElementById('readout-bottom').textContent;
		const bars = [];
		for (let i = 0; i < 3; i += 1) {
			app.input.onDirectionKey();
			bars.push(line());
		}
		// and it must SURVIVE -- re-render with no further gesture and it still says the same thing
		app.readout.render();
		return { bars, after: line() };
	})()`);
	assert.ok(!seen.err, `precondition: ${seen.err || 'ok'}`);
	assert.match(seen.bars[0], />>>/, 'forward reads as >>>');
	assert.match(seen.bars[1], /<<</, 'reverse reads as <<<');
	assert.match(seen.bars[2], /<->/, 'and undeclared reads as symmetric rather than as nothing');
	assert.match(seen.after, /<->/, 'the line is STATE -- a re-render with no gesture says the same thing');
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

/*
H15.15 / B226's lesson: the dash must PAINT, and the gesture must reach it.

The arrowhead passed every attribute check while painting nothing, so a plane flag that merely
appears in the DOM is not evidence of anything. This drives the real gesture -- select, press k --
and then rasterises the link to count lit pixels against a solid control.

A dashed line paints STRICTLY FEWER pixels than the same line solid. That is the measurement: not
that an attribute is present, but that the ink changed.
*/
test('H15.15: pressing k dashes the selected link, visibly', { skip: SKIP }, async () => {
	assert.equal(booted.loaded, true, 'precondition: fixture loaded');
	const seen = await tab.eval(`(async () => {
		const app = window.draw;
		const link = app.model.all('link')[0];
		if (!link) return { err: 'no link' };
		app.selection.set([link.id]);

		const lit = async () => {
			const el = document.getElementById(link.id);
			const box = el.getBBox();
			// the canvas strokes .link from the STYLESHEET, so a serialised path carries no colour
			// and rasterises to nothing. Inline the computed stroke, or the readback measures the
			// absence of CSS rather than the presence of a dash.
			const cs = getComputedStyle(el);
			const clone = el.cloneNode(true);
			clone.setAttribute('stroke', cs.stroke);
			const one = '<svg xmlns="http://www.w3.org/2000/svg" width="' + Math.ceil(box.width + 40) + '" height="' + Math.ceil(box.height + 40) + '">'
				+ '<g transform="translate(' + (20 - box.x) + ',' + (20 - box.y) + ')">' + new XMLSerializer().serializeToString(clone) + '</g></svg>';
			const img = new Image();
			await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(one))); });
			const c = document.createElement('canvas');
			c.width = img.width; c.height = img.height;
			c.getContext('2d').drawImage(img, 0, 0);
			const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
			let n = 0;
			for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0) n += 1;
			return n;
		};

		const before = { attr: document.getElementById(link.id).getAttribute('stroke-dasharray'), px: await lit() };
		app.input.onPlaneKey();
		const dashed = { attr: document.getElementById(link.id).getAttribute('stroke-dasharray'), px: await lit(), control: app.model.get('link', link.id).control, said: document.getElementById('readout-bottom').textContent };
		app.input.onPlaneKey();
		const back = { attr: document.getElementById(link.id).getAttribute('stroke-dasharray'), px: await lit(), control: app.model.get('link', link.id).control };
		return { before, dashed, back, saidAfter: document.getElementById('readout-bottom').textContent };
	})()`);
	assert.ok(!seen.err, `precondition: ${seen.err || 'ok'}`);

	assert.equal(seen.before.attr, null, 'an ordinary link starts solid');
	assert.equal(seen.dashed.control, true, 'k marks the link control plane in the document');
	assert.ok(seen.dashed.px > 0 && seen.before.px > 0, 'control: both states must paint SOMETHING, or this measures nothing');
	assert.ok(seen.dashed.px < seen.before.px,
		`a dashed line must paint fewer pixels than a solid one -- solid ${seen.before.px}, dashed ${seen.dashed.px}`);

	/*
	NOTE ON WHAT THIS DOES AND DOES NOT REACH. Clearing goes through a `put`, because removing a key
	needs a whole-entity op -- so the second press re-renders and never exercises the UPDATE branch.
	Deleting `removeAttribute('stroke-dasharray')` therefore leaves this test green.

	That branch is guarded at source level in tests/span.test.js instead, which does catch it. Said
	plainly here because a pixel test that looks like it covers the removal path and does not is
	worse than no test: it is the shape B226 and B230 both had.
	*/
	// pressing again must REMOVE the dash, not strand it (B228)
	assert.equal(seen.back.control, undefined, 'the second press returns the link to the data plane');
	assert.equal(seen.back.attr, null, 'and the attribute is removed rather than left behind');
	assert.equal(seen.back.px, seen.before.px, 'so the ink returns to exactly what it was');

	// the readout is STATE, so it must say [control] WHILE the link is control plane and stop
	// saying it the moment it is not -- measured at both instants rather than at the end
	assert.match(seen.dashed.said, /\[control\]/, 'the readout names the plane while the link is on it');
	assert.doesNotMatch(seen.saidAfter, /\[control\]/, 'and stops naming it the moment the link returns to data');
});

/*
B235: a DERIVED weight must be what the browser draws, not what CSS overrides.

`frameWidth` set stroke-width as a presentation attribute; `.frame` set it as a CSS rule. CSS wins,
so the canvas drew 2.1 while the exported SVG -- which carries no stylesheet -- drew 1. The thin
panel frame was live in the export and invisible on screen.

The agent verified the EXPORT, found 1, and reported the change as live. That is the failure this
test exists to prevent: an attribute is not ink, and a presentation attribute in particular is only
a DEFAULT that any matching rule silently beats.

So this asserts getComputedStyle -- what the browser resolved -- rather than what the DOM was told.
*/
test('B235: the panel frame the browser DRAWS is the derived one', { skip: SKIP }, async () => {
	assert.equal(booted.loaded, true, 'precondition: fixture loaded');
	const seen = await tab.eval(`(() => {
		const app = window.draw;
		const tb = app.model.makeTextBox({ x: 300, y: 300 }, { cols: 3, rows: 1 });
		tb.content[0].value = 'panel';
		app.model.put('node', tb);
		app.renderer.handle('put', 'node', tb);
		const panel = document.getElementById(tb.id).querySelector('.frame');
		// a plain 1x1 node draws its frame as a <use> of a shared def -- the THIRD route a frame
		// reaches the screen by, and the one that took its weight from the stylesheet that is gone
		const use = document.querySelector('#nodes .node:not([data-content]) [data-layer="frame"]');
		const plain = use && (use.tagName === 'use' ? document.querySelector(use.getAttribute('href')) : use);
		return {
			panelAttr: panel.getAttribute('stroke-width'),
			panelDrawn: parseFloat(getComputedStyle(panel).strokeWidth),
			plainDrawn: plain ? parseFloat(getComputedStyle(plain).strokeWidth) : null,
		};
	})()`);

	assert.equal(seen.panelAttr, '1', 'precondition: the renderer derived a 1-unit frame');
	assert.equal(seen.panelDrawn, 1,
		`the BROWSER must draw what was derived -- it drew ${seen.panelDrawn}, so something overrides the attribute`);

	// and a plain node is unchanged, so the fix did not simply delete the weight for everything
	assert.ok(seen.plainDrawn > seen.panelDrawn,
		`a plain node must stay heavier than a panel -- plain ${seen.plainDrawn}, panel ${seen.panelDrawn}`);
});

/*
B236: a LABEL is one size, on the canvas and in the export alike.

B234 gave the kernel a label path and sized it from `STD.fontSize`. The canvas had been drawing
labels all along, sized by `.label { font-size: 15px }` in the client stylesheet -- a rule the
kernel has never seen. So the two pictures disagreed the moment the export learned to draw labels,
and my own fix an hour earlier introduced it.

The same shape as B235 in the opposite direction: canvas heavier, export lighter, one size with two
authorities. Asserted on the COMPUTED style, because B235 was missed by checking an attribute.
*/
test('B236: a node label is the ruled size, and the browser draws that size', { skip: SKIP }, async () => {
	assert.equal(booted.loaded, true, 'precondition: fixture loaded');
	const seen = await tab.eval(`(() => {
		const lbl = document.querySelector('#nodes .label');
		if (!lbl) return { err: 'no label in the fixture' };
		return { drawn: parseFloat(getComputedStyle(lbl).fontSize), attr: lbl.getAttribute('font-size') };
	})()`);
	assert.ok(!seen.err, `precondition: ${seen.err || 'ok'}`);

	const { STD } = await import('../kernel/spec.mjs');
	assert.equal(seen.drawn, STD.fontSize,
		`the canvas must draw a label at the ruled size -- it drew ${seen.drawn}, the kernel exports ${STD.fontSize}`);

	/*
	THE ATTRIBUTE IS ASSERTED SEPARATELY, and the reason is worth recording.

	Removing the CSS rule alone happens to leave the browser default at 13px -- the same number the
	spec rules -- so a mutation that stops the client emitting the size is INVISIBLE to the computed
	check. Measured, not assumed: attribute null, computed 13px.

	That coincidence is not a rule. It would break the moment `fontSize` changed, and the canvas
	would drift back from the export silently. So the size must be emitted, not merely observed.
	*/
	assert.equal(Number(seen.attr), STD.fontSize,
		'the client must EMIT the size -- relying on a browser default that happens to match is not an authority');
});

/*
STAGE 6 of the gesture system -- the help overlay is GENERATED from the bindings (RULES I4). Asserted on the real page:
the hand-written table is gone, and what is drawn is what the tables document, including the drift the hand-written rows
had (they offered `7` as the waypoint, and a Tab "data view").
*/
test('the help overlay is generated from the bindings, in the real page', { skip: SKIP }, async () => {
	const seen = await tab.eval(`(() => {
		const card = document.getElementById('help-card');
		const cells = [...card.querySelectorAll('#help-rows td:first-child')].map((td) => td.textContent);
		return { sections: [...card.querySelectorAll('#help-rows h3')].map((h) => h.textContent), rows: cells.length,
			undo: cells.includes('Ctrl+Z'), tab: [...card.querySelectorAll('#help-rows tr')].find((tr) => tr.firstChild.textContent === 'Tab')?.lastChild.textContent ?? null,
			seven: cells.some((c) => /\\b7\\b/.test(c)), outside: document.querySelectorAll('#help-card > table').length };
	})()`);
	assert.deepEqual(seen.sections, ['keys', 'pointer', 'when a gesture ends', 'run mode']);
	assert.ok(seen.rows > 50, `every documented binding is a line: ${seen.rows}`);
	assert.equal(seen.undo, true);
	assert.equal(seen.tab, 'show or hide names', 'Tab says what it does now, not the deleted data view');
	assert.equal(seen.seven, false, 'no `7`: B146 took the waypoint off the digits');
	assert.equal(seen.outside, 0, 'no hand-written table left in the card');
});

/*
K7 (H17) -- EQUIVALENCE, held across the move of the held tools out of the palette and Input into a Tools module. Written
and green before the move, unchanged after it: what a person sees (the tile that lights up, the text-tool cursor) and the
lock's rule (B42: a lock releases every armed tool; B18: nothing arms while locked). Real keys, the real page. Run mode is
left first: the stamp hand is an authoring tool.
*/
/*
Each K7 test starts from WRITE ACCESS and puts back the lock state it found: earlier tests in this file take the server
lock through REST, which leaves this page read-only -- where a digit rightly arms nothing (found when the full file ran
and the filtered run did not).
*/
async function withWriteAccess(body) {
	const was = await tab.eval(`window.draw.input.readOnly`);
	await tab.eval(`window.draw.input.setReadOnly(false), 1`);
	if (await tab.eval(`document.querySelector('#container').classList.contains('run-mode')`)) await tab.key('r');
	try { await body(); } finally { await tab.eval(`window.draw.input.setReadOnly(${!!was}), 1`); }
}

test('K7: a digit lights its palette tile, the same digit or Escape puts it out, and t arms the text tool', { skip: SKIP }, () => withWriteAccess(async () => {
	const held = () => tab.eval(`[...document.querySelectorAll('.palette-item.held')].map((t) => t.dataset.type).join(',')`);
	assert.equal(await held(), '', 'nothing is held to begin with');
	await tab.key('2');
	assert.equal(await held(), 'server', 'the second digit holds the second type, and its tile shows it');
	await tab.key('2');
	assert.equal(await held(), '', 'the same digit lets it go');
	await tab.key('3');
	assert.equal(await held(), 'loadbalancer');
	await tab.key('Escape');
	assert.equal(await held(), '', 'Escape lets it go');
	await tab.key('t');
	assert.equal(await tab.eval(`document.getElementById('container').classList.contains('texttool')`), true, 't arms the text tool, and the canvas shows it');
	await tab.key('t');
	assert.equal(await tab.eval(`document.getElementById('container').classList.contains('texttool')`), false, 'and t again disarms it');
}));

test('K7: a lock releases every armed tool, and nothing arms while it holds (B42, B18)', { skip: SKIP }, () => withWriteAccess(async () => {
	const held = () => tab.eval(`document.querySelectorAll('.palette-item.held').length`);
	const textTool = () => tab.eval(`document.getElementById('container').classList.contains('texttool')`);
	await tab.key('4');
	await tab.key('t');
	assert.equal(await held(), 1);
	assert.equal(await textTool(), true);
	await tab.eval(`window.draw.input.setReadOnly(true), 1`);   // the path the lock takes (app/src/main.js applyAccess)
	assert.equal(await held(), 0, 'the lock released the hand');
	assert.equal(await textTool(), false, 'and the text tool');
	await tab.key('1');
	await tab.key('t');
	assert.equal(await held(), 0, 'nothing arms while locked');
	assert.equal(await textTool(), false);
}));

/*
K8 (H17) -- EQUIVALENCE, held across moving the canvas half of app/src/main.js into `composeCanvas`. Written and green
before the move, unchanged after it, each on a FRESH tab so nothing an earlier test did is in the way:

  the DOM the page boots into -- every layer, the defs, the grid, the palette, the fixture's entities -- compared with a
  snapshot recorded from the code before the move (tests/fixtures/k8-dom.json; K8_WRITE=1 re-records it);

  Escape DURING A SIDEBAR DRAG cancels the drag and is spent there -- it does not also put down the held hand -- which
  holds only while the palette's key listener is registered before the canvas's. Construction order is behaviour.
*/
async function freshTab() {
	const t = await attach(`http://127.0.0.1:${port}/d/${K8_DIAGRAM}`);   // the deep link: the page reads /d/<id>, not ?diagram=
	await until(t, `document.getElementById('node-ba0002') ? 1 : 0`, 8000);
	await t.eval(`window.draw.input.setReadOnly(false), 1`);   // earlier tests hold the server lock (see K7)
	return t;
}

test('K8: the page boots into the same DOM -- layers, defs, grid, palette and entities', { skip: SKIP }, async () => {
	const t = await freshTab();
	try {
		const snapshot = JSON.parse(await t.eval(`JSON.stringify({
			defs: document.getElementById('kdefs').innerHTML,
			layers: [...document.querySelectorAll('#container g[id]')].filter((g) => !['movers', 'overlay', 'snaplayer'].includes(g.id)).map((g) => [g.id, g.children.length]),
			grid: ['grid-nodes', 'grid-zones'].map((id) => { const g = document.getElementById(id); return [g.children.length, g.firstElementChild && g.firstElementChild.outerHTML]; }),
			palette: [...document.querySelectorAll('.palette-item')].map((i) => [i.dataset.type, i.getAttribute('class')]),
			entities: ['zones', 'groups', 'links', 'waypoints', 'nodes'].map((id) => [...document.getElementById(id).querySelectorAll('[id]')].map((e) => e.id + ' ' + (e.getAttribute('class') || '')).sort()),
		})`));
		const GOLDEN = new URL('./fixtures/k8-dom.json', import.meta.url);
		if (process.env.K8_WRITE) fs.writeFileSync(GOLDEN, `${JSON.stringify(snapshot, null, '\t')}\n`);
		assert.deepEqual(snapshot, JSON.parse(fs.readFileSync(GOLDEN, 'utf8')));
		assert.ok(snapshot.entities.flat().length > 3 && snapshot.grid[0][0] > 100, 'the snapshot holds a booted page, not an empty one');
	} finally { t.ws.close(); }
});

test('K8: Escape during a sidebar drag cancels the drag and is spent there -- the held hand stays', { skip: SKIP }, async () => {
	const t = await freshTab();
	try {
		await t.key('2');
		assert.equal(await t.eval(`window.draw.tools.hand`), 'server', 'a hand is held');
		const [tx, ty] = JSON.parse(await t.eval(`JSON.stringify((() => { const r = document.querySelector('.palette-item[data-type="host"]').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })())`));
		const [cx, cy] = JSON.parse(await t.eval(`JSON.stringify((() => { const r = document.getElementById('container').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })())`));
		await t.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: tx, y: ty });
		await t.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: tx, y: ty, button: 'left', clickCount: 1, buttons: 1 });
		await t.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx, y: cy, button: 'left', buttons: 1 });
		assert.equal(await t.eval(`!!(window.draw.palette.drag && window.draw.palette.drag.ghost)`), true, 'a tile is being dragged onto the canvas');
		await t.key('Escape');
		assert.equal(await t.eval(`window.draw.palette.drag`), null, 'Escape cancelled the sidebar drag');
		assert.equal(await t.eval(`window.draw.tools.hand`), 'server', 'and was spent there: the held hand is still held');
		await t.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx, y: cy, button: 'left', clickCount: 1 });
	} finally { t.ws.close(); }
});

/*
H15.23 (B255) -- the colour registry reaches the page. Every colour the stylesheet uses is now a `var(--tok-...)` read
from app/tokens.css, so a page that failed to load that file would lose every colour at once and still boot. Read off the
real page's computed styles: a link draws the link token, a label the label token, the page the page token.
*/
test('H15.23: the colours the page draws come from the registry, generated from kernel/theme.mjs', { skip: SKIP }, async () => {
	const t = await freshTab();
	try {
		const { TOKENS, CHROME } = await import('../kernel/theme.mjs');
		const rgb = (hex) => { const h = hex.replace('#', ''); const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h; return `rgb(${parseInt(f.slice(0, 2), 16)}, ${parseInt(f.slice(2, 4), 16)}, ${parseInt(f.slice(4, 6), 16)})`; };
		const got = JSON.parse(await t.eval(`JSON.stringify({
			token: getComputedStyle(document.documentElement).getPropertyValue('--tok-link').trim(),
			link: getComputedStyle(document.querySelector('#links .link')).stroke,
			label: getComputedStyle(document.querySelector('#nodes .label')).fill,
			page: getComputedStyle(document.body).backgroundColor,
		})`));
		assert.equal(got.token, TOKENS.link, 'app/tokens.css is loaded and carries the table');
		assert.equal(got.link, rgb(TOKENS.link), 'a link draws the link token');
		assert.equal(got.label, rgb(TOKENS.label), 'a label draws the label token');
		assert.equal(got.page, rgb(CHROME.page), 'the page draws the page token');
	} finally { t.ws.close(); }
});

/*
V-b (H18.26; PROMOTION.md P5's exit criterion) -- THE PRODUCT PAGE COMPOSES THE NETWORK, as the lab does: links drawn along their
routes over pipes, a down link drawn down and saying why in the header banner (ruled J3), `g` laying a hand pipe that heals a
down link (the lab matrix's HEAL-02, on the page), and `x` turning an anchor's transit off -- each answered by the real
server's planner and settled on the page.
*/
test('V-b: the product page draws routes and pipes, says why a link is down, and g and x work there', { skip: SKIP }, async () => {
	const t = await attach(`http://127.0.0.1:${port}/d/${NET_DIAGRAM}`);
	try {
		await until(t, `document.getElementById('node-ab00a1') ? 1 : 0`, 8000);
		await t.eval(`window.draw.input.setReadOnly(false), 1`);
		const state = () => t.eval(`JSON.stringify((() => { const m = window.draw.model, l = (id) => m.get('link', id);
			return { routed: m.pathOf(l('link-ab0001')), downs: m.all('link').filter((x) => m.isLinkDown(x)).map((x) => x.id).sort(),
				under: document.querySelectorAll('#pipes .pipe-of.under').length, pipes: m.all('pipe').map((p) => p.id + ':' + p.laid).sort(),
				downMark: document.getElementById('link-ab0002')?.hasAttribute('data-down') ?? null,
				routedMark: document.getElementById('link-ab0001')?.hasAttribute('data-down') ?? null, fTransit: m.get('node', 'node-ab00f1').transit ?? null }; })())`).then(JSON.parse);

		let s = await state();
		assert.deepEqual(s.routed, [[-360, 0], [0, -240], [360, 0]], 'the routed link is drawn up through f, its route');
		assert.equal(s.under, 2, 'the two pipes it runs over are under it');
		assert.deepEqual(s.downs, ['link-ab0002'], 'the link with no pipe is down');
		assert.equal(s.downMark, true, 'and drawn down');

		await t.eval(`window.draw.selection.set(['link-ab0002']), 1`);
		assert.match(await until(t, `(document.getElementById('banner').textContent.includes('is down') && document.getElementById('banner').textContent) || ''`, 4000),
			/link-ab0002 is down/, 'a selected down link says why, in the banner');

		// HEAL-02: drag from c to d, press g on d, release -- g lays the pipe by hand and makes no link, and the down link heals
		await t.eval(`window.draw.selection.clear(), 1`);
		const screen = (x, y) => t.eval(`JSON.stringify((() => { const m = document.getElementById('container').getScreenCTM(); return [m.a * ${x} + m.e, m.d * ${y} + m.f]; })())`).then(JSON.parse);
		const mouse = async (type, x, y, buttons) => { const [sx, sy] = await screen(x, y); await t.send('Input.dispatchMouseEvent', { type, x: sx, y: sy, button: 'left', buttons, clickCount: 1 }); await sleep(30); };
		await mouse('mouseMoved', -360, 240, 0);
		await mouse('mousePressed', -360, 240, 1);
		await mouse('mouseMoved', 0, 240, 1);
		await mouse('mouseMoved', 360, 240, 1);
		await t.key('g');
		await mouse('mouseReleased', 360, 240, 0);
		// the pipe is applied at once; the healed link's mark follows the answer, when the board settles -- so wait for both
		await until(t, `window.draw.model.all('pipe').some((p) => p.laid === 'hand' && p.a === 'node-ab00c1') && !document.getElementById('link-ab0002')?.hasAttribute('data-down') ? 1 : 0`, 6000);
		s = await state();
		assert.ok(s.pipes.includes(`${pipeEntity('node-ab00c1', 'node-ab00c2', 'hand').id}:hand`), `g laid the hand pipe from c to d: ${s.pipes}`);
		assert.deepEqual(s.downs, [], 'and the down link healed over it');
		// the link itself did not change, only the pipes under it: the page redraws it because the board SETTLES after the answer
		assert.equal(s.downMark, false, 'drawn up again on the page -- the board settled after the answer');
		assert.equal(await t.eval(`window.draw.model.all('link').length`), 2, 'g made no link');

		// x on f: its transit off, so no route passes it -- the routed link has no other way, and is down
		await t.eval(`window.draw.selection.set(['node-ab00f1']), 1`);
		await t.key('x');
		// the tab applies the edit at once; the mark follows the server's answer, when the board settles -- so wait for the mark
		await until(t, `window.draw.model.get('node', 'node-ab00f1').transit === false && document.getElementById('link-ab0001')?.hasAttribute('data-down') ? 1 : 0`, 6000);
		s = await state();
		assert.equal(s.fTransit, false, 'x turned f\'s transit off, through the server');
		assert.deepEqual(s.downs, ['link-ab0001'], 'and the link that ran through f is down');
		assert.equal(s.routedMark, true, 'drawn down on the page');
	} finally { t.ws.close(); }
});

/*
P5 V-d (H18.28; G4, PL-6) -- THE PRODUCT PAGE PREVIEWS: a pin deleted takes its link in the same script turn the delete is
committed in, before any answer can arrive over the socket; the request carries the delete alone; and the server's answer
leaves the tab where the preview put it.
*/
test('V-d: on the product page a deleted pin takes its link before the server answers', { skip: SKIP }, async () => {
	const t = await attach(`http://127.0.0.1:${port}/d/${NET_DIAGRAM}`);
	try {
		await until(t, `document.getElementById('node-ab00a1') ? 1 : 0`, 8000);
		await t.eval(`window.draw.input.setReadOnly(false), 1`);
		// a waypoint, and a link pinned at it, through the server
		await t.eval(`(() => { const m = window.draw.model; const w = m.makeWaypoint({ x: 0, y: 360 });
			window.draw.history.commit({ label: 'pin', entries: [{ op: 'put', kind: 'node', entity: w }, { op: 'put', kind: 'link', entity: { ...m.makeLink('node-ab00c1', 'node-ab00c2'), via: [w.id] } }] });
			window.__pin = w.id; return 1; })()`);
		await until(t, `window.draw.sync.outbox.every((m) => m.answered) ? 1 : 0`, 6000);
		const pinned = await t.eval(`window.draw.model.all('link').find((l) => (l.via || []).includes(window.__pin))?.id ?? null`);
		assert.ok(pinned, 'precondition: a link is pinned at the waypoint');
		const now = JSON.parse(await t.eval(`JSON.stringify((() => {
			window.draw.history.commit({ label: 'delete', entries: [{ op: 'del', kind: 'node', entity: { ...window.draw.model.get('node', window.__pin) } }] });
			const sent = window.draw.sync.outbox.at(-1);
			return { linkNow: !!window.draw.model.get('link', '${pinned}'), sent: sent.ops, answered: !!sent.answered };
		})())`));
		assert.equal(now.answered, false, 'no answer has arrived yet');
		assert.equal(now.linkNow, false, 'and the link is already gone: the preview deleted it with its pin (P-7)');
		assert.deepEqual(now.sent.map((o) => `${o.op}/${o.kind}`), ['del/node'], 'the request is the delete alone');
		await until(t, `window.draw.sync.outbox.every((m) => m.answered) ? 1 : 0`, 6000);
		assert.equal(await t.eval(`!!window.draw.model.get('link', '${pinned}')`), false, 'and the answer leaves it gone');
	} finally { t.ws.close(); }
});
