/*
The lab's door, driven in REAL Chrome against the REAL modules the lab serves.

Four defects reached the deployed lab in one session and every one passed the gate: the door read
`answer.ops` where commit() returns `change.ops`, so it applied nothing; an import named the wrong
module, so the page threw at load; the image lacked `network/`, so the plugin 404'd; and undo went to
`commit()`, which refused it. Each was invisible to a check that reads source. Each was obvious the
moment the page ran.

So this runs the page. It boots `lab/server.mjs` from the working tree, loads a seeded board, and
drives the commit seam through `window.lab` -- the planner answers in the page, and what the tab
shows afterwards is what is asserted.

It does not replace looking at the deployed service: the image can still differ from the working
tree (C5 is the guard for that). It closes the gap between "the source says so" and "the page does".
*/
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { teardown, spawnGroup } from './fixtures/teardown.mjs';

const CHROME = ['google-chrome', 'chromium', 'chromium-browser']
	.find((c) => { try { execFileSync('which', [c], { stdio: 'pipe' }); return true; } catch { return false; } });
const SKIP = !CHROME && 'no chrome on PATH';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const root = path.resolve(import.meta.dirname, '..');

let dir, srv, chrome, port, cdp;

before(async () => {
	if (SKIP) return;
	dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-browser-'));
	port = 8400 + (process.pid % 200);
	cdp = 9800 + (process.pid % 200);
	srv = spawnGroup('node', ['lab/server.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
	for (let i = 0; i < 60; i++) {
		try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) break; } catch { /* not up yet */ }
		await sleep(200);
	}
	/*
	--disable-extensions IS THE FIX FOR THIS FILE'S FLAKE, and it was found by measurement, not guessed.

	About one run in four, a page never booted. A full event timeline of a failing load showed the page
	firing DOMContentLoaded and load at 31ms -- a successful load fires them at about 81ms, after all 56
	module requests -- and cancelling every request still in flight in that same millisecond. A stopped
	load, not a slow one. A reproduction with no in-page actions stopped loads too, always at the same
	ELAPSED time -- 2.31 to 2.34 seconds after launch -- whatever the navigation count.

	Chrome's own log named the candidate: at startup it installs an extension from this machine's system
	external_extensions.json, in the background. Loading an extension that can observe requests makes
	Chrome rebuild the request machinery of open pages, and whatever is in flight is cut off. Measured
	over 20 launches each: 8 stopped loads in 500 with extensions on, 0 in 500 with this flag.

	Two hypotheses were tested and REFUTED first, and are recorded so nobody re-runs them: Node closing
	idle keep-alive sockets (no change), and opening and closing a tab per test (one tab made it worse).
	*/
	chrome = spawnGroup(CHROME, ['--headless=new', `--remote-debugging-port=${cdp}`, '--no-sandbox', '--disable-gpu',
		'--disable-extensions', `--user-data-dir=${dir}/cdp`, 'about:blank'], { stdio: 'ignore' });
	for (let i = 0; i < 80; i++) {
		try { await (await fetch(`http://127.0.0.1:${cdp}/json/version`)).json(); break; } catch { await sleep(200); }
	}
});
after(() => teardown([chrome, srv], dir));

/*
ONE TAB for the whole file, navigated per test -- the product harness's pattern (tests/browser.test.js),
which this file should have copied from the start (M6, author from exemplar).

The first version opened a tab per test and closed it after. That was flaky: about one run in five, a
page never booted, and the recorded evidence was a single module request ABORTED with no failed
response and no exception -- a request cancelled, not a request failed. Closing a tab and opening the
next within milliseconds lets Chrome reuse the dying tab's renderer; cutting that lifecycle out removes
the cause instead of widening a wait around it.

Each navigation carries a NONCE, and readiness requires it: without it the check could read the
previous test's page, still current for an instant after the navigation is issued, and pass on it.
*/
let tab = null, nonce = 0;
async function theTab() {
	if (tab) return tab;
	const t = await (await fetch(`http://127.0.0.1:${cdp}/json/new?about:blank`, { method: 'PUT' })).json();
	const { default: WebSocket } = await import('ws');
	const ws = new WebSocket(t.webSocketDebuggerUrl);
	let id = 0; const pending = new Map(); const thrown = []; const requests = new Map(); const timeline = []; const clock = { t0: Date.now() };
	const PATH = (u) => String(u ?? '').replace(/^https?:\/\/[^/]+/, '');
	ws.on('message', (raw) => {
		const m = JSON.parse(raw.toString());
		// FULL TIMELINE of the current navigation, for diagnosing a load that fails (dumped only then)
		if (m.method) {
			const at = Date.now() - clock.t0, p = m.params ?? {};
			if (m.method === 'Network.requestWillBeSent') timeline.push({ at, ev: 'request', id: p.requestId, url: PATH(p.request.url), type: p.type });
			else if (m.method === 'Network.responseReceived') timeline.push({ at, ev: 'response', id: p.requestId, status: p.response.status });
			else if (m.method === 'Network.loadingFinished') timeline.push({ at, ev: 'finished', id: p.requestId });
			else if (m.method === 'Network.loadingFailed') timeline.push({ at, ev: 'FAILED', id: p.requestId, url: requests.get(p.requestId), error: p.errorText, canceled: p.canceled, blocked: p.blockedReason ?? null });
			else if (m.method.startsWith('Page.') || m.method.startsWith('Target.') || m.method.startsWith('Inspector.')
				|| m.method === 'Runtime.executionContextCreated' || m.method === 'Runtime.executionContextDestroyed' || m.method === 'Runtime.exceptionThrown') {
				timeline.push({ at, ev: m.method, detail: JSON.stringify(p).slice(0, 180) });
			}
		}
		if (m.method === 'Runtime.exceptionThrown') thrown.push(String(m.params?.exceptionDetails?.exception?.description ?? m.params?.exceptionDetails?.text).slice(0, 200));
		if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') thrown.push(`console: ${m.params.entry.text.slice(0, 200)}`);
		if (m.method === 'Network.requestWillBeSent') requests.set(m.params.requestId, m.params.request.url.replace(/^https?:\/\/[^/]+/, ''));
		if (m.method === 'Network.loadingFailed' && !m.params.blockedReason) thrown.push(`request failed: ${m.params.errorText} (${requests.get(m.params.requestId) ?? '?'})`);
		if (m.method === 'Network.responseReceived' && m.params.response.status !== 200 && m.params.type !== 'Document') {
			thrown.push(`response ${m.params.response.status} (${m.params.response.url.replace(/^https?:\/\/[^/]+/, '')})`);
		}
		if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
	});
	await new Promise((r) => ws.on('open', r));
	const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
	const run = async (expression) => {
		const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
		if (res.result?.exceptionDetails) throw new Error(String(res.result.exceptionDetails.exception?.description).slice(0, 300));
		return res.result?.result?.value;
	};
	await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable');
	await send('Page.enable'); await send('Page.setLifecycleEventsEnabled', { enabled: true });
	tab = { ws, send, run, thrown, requests, timeline, clock };
	return tab;
}

// navigate the one tab to a seeded board and hand back an evaluator that runs in it
async function open(seed, { block = [] } = {}) {
	const t = await theTab();
	t.thrown.length = 0; t.requests.clear(); t.timeline.length = 0; t.clock.t0 = Date.now();
	await t.send('Network.setBlockedURLs', { urls: block });
	const n = ++nonce;
	await t.send('Page.navigate', { url: `http://127.0.0.1:${port}/?seed=${seed}&n=${n}` });
	const isReady = `location.search.includes('n=${n}') && !!window.lab`;
	for (let i = 0; i < 100; i++) { if (await t.run(isReady).catch(() => false)) break; await sleep(150); }
	const ready = !!(await t.run(isReady).catch(() => false));
	/*
	A page that never became ready is reported AS THAT, with its state and everything that failed while
	it loaded -- not left for a later assertion to fail on, which is how this first surfaced: as
	"getComputedStyle: parameter 1 is not an Element", fifteen seconds in, naming a symptom.
	*/
	if (!ready && !block.length) {
		const state = await t.run(`JSON.stringify({ readyState: document.readyState, href: location.href,
			notice: document.getElementById('lab-notice')?.textContent ?? null })`).catch((e) => String(e));
		const dump = path.join(os.tmpdir(), `lab-flake-${process.pid}-${n}.json`);
		fs.writeFileSync(dump, JSON.stringify({ seed, n, state, timeline: t.timeline }, null, 1));
		throw new Error(`the lab page at ?seed=${seed} never became ready: ${state}; while loading: ${JSON.stringify(t.thrown)}; timeline: ${dump}`);
	}
	return { run: t.run, ready, close: async () => {} };
}

/*
The door tests prove the PLANNER's cascade and sweep reach the tab, so they clear the board's pipes
first. Since pipes count as references, a hand pipe legitimately holds a waypoint the sweep would
otherwise take -- a separate rule with its own test below, and mixing the two would let either one
hide a failure in the other.
*/
const CLEAR_PIPES = `lab.pipes.list().forEach((x) => lab.pipes.remove(x.a, x.b))`;

// the tab's document, counted -- the thing the author actually sees
const COUNTS = `({ nodes: Object.keys(lab.model.state.nodes).length, waypoints: Object.keys(lab.model.state.waypoints).length,
	links: Object.keys(lab.model.state.links).length, notice: document.getElementById('lab-notice').textContent })`;

test('the lab boots, and a seeded board arrives through the planner', { skip: SKIP }, async () => {
	const p = await open('bend');
	try {
		assert.equal(p.ready, true, 'the page never exposed its handle: it failed to boot, which is how the wrong-import defect looked');
		const c = await p.run(COUNTS);
		assert.deepEqual([c.nodes, c.waypoints, c.links], [2, 1, 1], `the bend board did not arrive: ${JSON.stringify(c)}`);
		assert.equal(await p.run('lab.authority.all("link").length'), 1, 'the AUTHORITY model must hold the board too -- the planner is what put it there');
	} finally { await p.close(); }
});

test('a delete through the door shows the planner\'s cascade and sweep in the tab', { skip: SKIP }, async () => {
	const p = await open('bend');
	try {
		await p.run(CLEAR_PIPES);
		// A `del` entry carries the whole ENTITY, not its id -- Changes needs it to build the undo.
		// delete node A. The tab alone would remove A and nothing else; the PLANNER also takes the link
		// whose end A was, and sweeps the bend that link left orphaned. Seeing those two in the tab is
		// the proof that the answer came back and was applied -- the defect was a door that did neither.
		await p.run(`lab.history.commit({ label: 'delete', entries: [{ op: 'del', kind: 'node', entity: lab.model.get('node', 'node-000001') }] })`);
		const c = await p.run(COUNTS);
		assert.equal(c.links, 0, `the planner's cascade never reached the tab: ${JSON.stringify(c)}`);
		assert.equal(c.waypoints, 0, `the planner's sweep never reached the tab: ${JSON.stringify(c)}`);
		assert.doesNotMatch(c.notice, /refused/, `the delete was refused: ${c.notice}`);
	} finally { await p.close(); }
});

test('undo and redo work in the lab, as H17-D8 promises', { skip: SKIP }, async () => {
	const p = await open('bend');
	try {
		await p.run(CLEAR_PIPES);
		await p.run(`lab.history.commit({ label: 'delete', entries: [{ op: 'del', kind: 'node', entity: lab.model.get('node', 'node-000001') }] })`);
		await p.run('lab.history.undo()');
		let c = await p.run(COUNTS);
		assert.doesNotMatch(c.notice, /refused/, `undo was refused -- the defect this test was written for: ${c.notice}`);
		assert.deepEqual([c.nodes, c.waypoints, c.links], [2, 1, 1], `undo did not restore the board: ${JSON.stringify(c)}`);

		await p.run('lab.history.redo()');
		c = await p.run(COUNTS);
		assert.deepEqual([c.nodes, c.waypoints, c.links], [1, 0, 0], `redo did not re-apply the delete and its cascade: ${JSON.stringify(c)}`);
	} finally { await p.close(); }
});

test('on the cross board, an unpinned link is drawn along its route through the bare centre', { skip: SKIP }, async () => {
	const p = await open('cross');
	try {
		// neither link pins the centre, yet the only pipes run through it -- so each is drawn as
		// three points bending there, where a straight link would be two. This is what `g` stands on.
		const path_ = await p.run(`lab.model.pathOf(lab.model.get('link', 'link-000001'))`);
		assert.equal(path_.length, 3, `the link was drawn straight, not routed over the pipes: ${JSON.stringify(path_)}`);
		assert.deepEqual(path_[1], [0, 0], 'and its middle point is the centre anchor');
		assert.equal(await p.run(`lab.model.get('link', 'link-000001').via`), undefined, 'while the link itself pins nothing');
	} finally { await p.close(); }
});

/*
THE COMPARE BOARD -- what the gesture actually decides, shown by a landing.

Left, both links PIN the centre (the `w` shape); right, both only PASS it over the pipes (the `g`
shape). Drawn, the two look alike: a pin is a bend, not a termination -- the lab's first seeds claimed
otherwise and were corrected after measuring waypointRoles. The difference appears when a link LANDS
on a centre: the landing cuts the pinned pair, making a junction, and crosses the guided pair.

The landing is committed through the product's own `commitRoute`, so the cut is the product's own
split rule (B210/B213), run in the page.
*/
const land = (from, to) => `lab.input.commitRoute({ src: lab.model.get('waypoint', '${from}'), placed: [] }, '${to}', [])`;
const roleOf = (id) => `[...document.getElementById('${id}').classList].filter((c) => c !== 'waypoint')`;

test('compare: a landing CUTS the links that pin the centre, and the centre becomes a junction', { skip: SKIP }, async () => {
	const p = await open('compare');
	try {
		assert.deepEqual(await p.run(roleOf('waypoint-000001')), ['bend'], 'before the landing, the pinned centre is a bend, not a junction');
		await p.run(land('waypoint-000003', 'waypoint-000001'));
		assert.ok((await p.run(roleOf('waypoint-000001'))).includes('junction'), 'after it, the pinned pair was cut there: a junction');
		const ending = await p.run(`lab.authority.all('link').filter((l) => l.src === 'waypoint-000001' || l.dst === 'waypoint-000001').length`);
		assert.equal(ending, 5, 'two pinned links cut in two, plus the landing: five links end at the centre');
	} finally { await p.close(); }
});

test('compare: a landing CROSSES the links that only pass the centre, and they stay whole', { skip: SKIP }, async () => {
	const p = await open('compare');
	try {
		await p.run(land('waypoint-000004', 'waypoint-000002'));
		assert.ok(!(await p.run(roleOf('waypoint-000002'))).includes('junction'), 'the guided centre must NOT become a junction');
		for (const id of ['link-000003', 'link-000004']) {
			const l = await p.run(`lab.authority.get('link', '${id}')`);
			assert.ok(l, `${id} was cut -- a link that only passes a point is not connected to a landing there`);
			const path_ = await p.run(`lab.model.pathOf(lab.model.get('link', '${id}'))`);
			assert.deepEqual(path_[1], [480, 0], `${id} still runs through the centre over the pipes`);
		}
	} finally { await p.close(); }
});

/*
THE ROUTE HOOK -- `g`'s whole-route check and its pipes, in the page.
*/
test('the route hook refuses a guide the fewest-pipes route would skip, names it, and lays nothing', { skip: SKIP }, async () => {
	const p = await open('cross');
	try {
		const before = await p.run('lab.pipes.list().length');
		// A to B through C and D: three pipes, while A-centre-B over the pipes is two. The route
		// would ignore both guides, so committing it would draw a link that ignores what was drawn.
		const v = await p.run(`lab.routeHook({ src: 'node-000001', dst: 'node-000002', pins: [],
			guides: ['node-000003', 'node-000004'], stops: ['node-000001', 'node-000003', 'node-000004', 'node-000002'] })`);
		assert.equal(v.ok, false);
		assert.match(await p.run(`document.getElementById('lab-notice').textContent`), /node-000003/, 'the refusal names the skipped guide');
		assert.equal(await p.run('lab.pipes.list().length'), before, 'a refused route lays no pipes');
	} finally { await p.close(); }
});

test('an accepted route lays its pipes only once the planner accepts the link, and the sweep takes it back', { skip: SKIP }, async () => {
	const p = await open('cross');
	try {
		const before = await p.run('lab.pipes.list().length');
		// A straight to D: a new one-pipe leg, shorter than A-centre-D, so the route takes it
		const v = await p.run(`lab.routeHook({ src: 'node-000001', dst: 'node-000004', pins: [], guides: [], stops: ['node-000001', 'node-000004'] })`);
		assert.equal(v.ok, true, v.reason);
		assert.equal(await p.run('lab.pipes.list().length'), before, 'nothing is laid by the check itself');

		await p.run(`lab.input.commitRoute({ src: lab.model.get('node', 'node-000001'), placed: [] }, 'node-000004', [])`);
		assert.equal(await p.run('lab.pipes.list().length'), before + 1, 'the planner accepted the link, so its leg is laid');
		assert.equal(await p.run(`lab.pipes.list().find((x) => x.a === 'node-000001' && x.b === 'node-000004').laid`), 'link');

		// delete that link: its pipe was laid WITH it, and no other link uses it, so it goes (2026-09-27)
		const id = await p.run(`lab.authority.all('link').find((l) => l.src === 'node-000001' && l.dst === 'node-000004').id`);
		await p.run(`lab.history.commit({ label: 'delete', entries: [{ op: 'del', kind: 'link', entity: lab.model.get('link', '${id}') }] })`);
		assert.equal(await p.run('lab.pipes.list().length'), before, 'a pipe laid with a link goes once no link remains on it');
	} finally { await p.close(); }
});

test('pipes an author laid hold an anchor the sweep would take, and a pipe to a deleted anchor goes', { skip: SKIP }, async () => {
	const p = await open('bend');
	try {
		// bend: A -- w -- B, the link pinned at w, hand pipes A-w and w-B. Delete A: the planner takes
		// the link, and would sweep w as the bend it left -- but w still has a hand pipe to B, so it is
		// structure, not debris (pipes count as references). The pipe A-w has lost an end, so it goes.
		await p.run(`lab.history.commit({ label: 'delete', entries: [{ op: 'del', kind: 'node', entity: lab.model.get('node', 'node-000001') }] })`);
		const c = await p.run(COUNTS);
		assert.equal(c.links, 0, 'the link went with its end');
		assert.equal(c.waypoints, 1, 'w survives: its hand pipe to B still references it');
		assert.deepEqual(await p.run(`lab.pipes.list().map((x) => [x.a, x.b].join('-'))`), ['node-000002-waypoint-000005'],
			'the pipe to the deleted node is pruned; the author\'s pipe to B remains');
	} finally { await p.close(); }
});

/*
THE DIRECTOR'S TWO REPORTS, 2026-09-29, asserted on what is SEEN.

Pipes looked black. The gate had checked that pipes were drawn -- eight of them -- and never what
colour they came out: `currentColor` inherited black, 1.1:1 on the canvas. So this reads the COMPUTED
stroke, and asserts two rules rather than a hex literal: it is the plugin's one colour, and it is
visible against the canvas it is drawn on.

Moving a centre anchor moved its pipes and left the links routed through it behind. The model's path
was right all along -- asking `pathOf` would have passed -- so this reads the DRAWN path, the `d` the
author actually sees.
*/
test('pipes are drawn in the plugin\'s one colour, and it is visible on the canvas', { skip: SKIP }, async () => {
	const p = await open('cross');
	try {
		const seen = await p.run(`(async () => {
			const { pipeAttributes } = await import('/network/appearance.mjs');
			const PIPE_STROKE = pipeAttributes('hand').stroke;   // through the painter's own door
			const line = document.querySelector('#pipes line');
			const cs = getComputedStyle(line);
			const rgb = (s) => s.match(/\\d+/g).slice(0, 3).map(Number);
			const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
			const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
				return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
			const canvas = rgb(getComputedStyle(document.getElementById('canvas')).fill);
			const stroke = rgb(cs.stroke);
			const [hi, lo] = [lum(stroke), lum(canvas)].sort((x, y) => y - x);
			return { stroke, token: hex(PIPE_STROKE), opacity: Number(cs.opacity), contrast: (hi + 0.05) / (lo + 0.05) };
		})()`);
		assert.deepEqual(seen.stroke, seen.token, "the pipe must be drawn in the plugin's colour -- one authority, not a stylesheet's currentColor");
		assert.equal(seen.opacity, 1, 'solid, so the contrast on screen is the contrast measured');
		assert.ok(seen.contrast >= 4.5, `a pipe must be visible on the canvas: ${seen.contrast.toFixed(1)}:1 (the defect was 1.1:1)`);
	} finally { await p.close(); }
});

test('moving an anchor redraws the links ROUTED through it, not only the links that name it', { skip: SKIP }, async () => {
	const p = await open('cross');
	try {
		const drawn = `document.getElementById('link-000001').getAttribute('d')`;
		assert.match(await p.run(drawn), /Q0 0/, 'before: the link bends at the centre, where it is');
		// move the centre, which link-000001 routes through without naming it
		await p.run(`lab.history.commit({ label: 'move', entries: [{ op: 'set', kind: 'waypoint', id: 'waypoint-000005', after: { x: 120, y: 60 } }] })`);
		assert.match(await p.run(drawn), /Q120 60/,
			"after: the DRAWN link must bend at the centre's new place -- the pipes followed, and the link must too");
	} finally { await p.close(); }
});

/*
The same defect's third face: a link's drawn route also depends on the PIPE SET, which lives outside
the model -- so a new pipe that makes a shortcut never told the renderer, and existing links kept
drawing the longer way. Found while fixing the anchor-move report, before the director met it.
*/
test('a new pipe that changes an existing link\'s route redraws that link', { skip: SKIP }, async () => {
	const p = await open('cross');
	try {
		const drawn = `document.getElementById('link-000001').getAttribute('d')`;
		const notice = `document.getElementById('lab-notice').textContent`;
		assert.match(await p.run(drawn), /Q0 0/, 'before: link-000001 runs A-centre-B');
		/*
		Draw A to C, then C to B -- legal links, unlike a second straight A-B, which the planner refuses
		(B72) and which the first version of this test drew, so it measured a refusal and called it a
		redraw failure. Their legs lay A-C and C-B, a second two-pipe way from A to B, and the router
		breaks ties by sorted id (node-000003 before waypoint-000005), so link-000001's route becomes
		A-C-B without the link itself being touched.
		*/
		for (const [a, b] of [['node-000001', 'node-000003'], ['node-000003', 'node-000002']]) {
			assert.equal((await p.run(`lab.routeHook({ src: '${a}', dst: '${b}', pins: [], guides: [], stops: ['${a}', '${b}'] })`)).ok, true);
			await p.run(`lab.input.commitRoute({ src: lab.model.get('node', '${a}'), placed: [] }, '${b}', [])`);
			assert.doesNotMatch(await p.run(notice), /refused/, `the ${a}-${b} link was refused, so this would measure a refusal`);
		}
		assert.match(await p.run(drawn), /Q0 -240/, 'after: the existing link must be redrawn along its new route, through C');
	} finally { await p.close(); }
});

test('moving a NODE redraws the links routed through it, too', { skip: SKIP }, async () => {
	const p = await open('cross');
	try {
		// re-lay the pipes so link-000001 (A to B) routes through node C, which it does not name
		await p.run(`lab.pipes.list().forEach((x) => lab.pipes.remove(x.a, x.b)); lab.pipes.lay('node-000001', 'node-000003', 'hand'); lab.pipes.lay('node-000003', 'node-000002', 'hand')`);
		await p.run(`lab.history.commit({ label: 'move', entries: [{ op: 'set', kind: 'node', id: 'node-000003', after: { x: 60, y: -300 } }] })`);
		assert.match(await p.run(`document.getElementById('link-000001').getAttribute('d')`), /Q60 -300/,
			"the drawn link must follow the node it routes through, not only the nodes it names");
	} finally { await p.close(); }
});

/*
A failed seed fetch must not kill the page. The gate met this as a flake -- `fetch('/seeds.json')` failing
about one page in 130 -- and because the fetch was a top-level await, one failure rejected the whole
module and left the lab dead. Here the failure is produced ON PURPOSE by blocking the URL, so the
robustness is tested every run instead of once in a hundred and thirty.
*/
test('a seed that cannot be fetched is reported, and the lab still works', { skip: SKIP }, async () => {
	const p = await open('cross', { block: ['*seeds.json'] });
	try {
		assert.equal(p.ready, true, 'the page must come up without its board');
		assert.match(await p.run(`document.getElementById('lab-notice').textContent`), /could not be loaded/,
			'and say why the board is missing');
	} finally { await p.close(); }
});
