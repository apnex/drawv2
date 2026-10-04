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

It also EXECUTES THE BEHAVIOUR MATRIX (dev/design/unification/BEHAVIOUR-MATRIX.json): every lab gesture
permutation, its intended rule and whether it holds, one row each -- see the section at the end of this
file. A gesture rule belongs in a row there, not in a new hand-written test here.
*/
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { teardown, spawnGroup } from './fixtures/teardown.mjs';
import { NO_CHROME, launchChrome } from './fixtures/chrome.mjs';   // one launch config for every harness
import { canonical } from './fixtures/gesture-corpus.mjs';   // ids by kind and first appearance, as the gesture corpus writes them

const SKIP = NO_CHROME;
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
	// the shared launch config -- including --disable-extensions, and the measurement that found it: tests/fixtures/chrome.mjs
	chrome = launchChrome({ cdpPort: cdp, profileDir: `${dir}/cdp`, url: 'about:blank' });
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
	// a fixed viewport, so canvas coordinates map to the same screen pixels on every run
	await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
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
	/*
	REAL INPUT, in canvas coordinates. Driving the door through `window.lab` proved the planner and the
	composition; it could not prove the GESTURE, and the director's reports came from real drags and real
	key presses. These dispatch genuine mouse and key events through Chrome at the screen pixels the
	canvas's own transform gives, so a test exercises the product's gesture machine end to end.
	*/
	const screen = (x, y) => t.run(`(() => { const m = document.getElementById('container').getScreenCTM(); return [m.a * ${x} + m.e, m.d * ${y} + m.f]; })()`);
	const mouse = async (type, x, y, buttons = 0) => {
		const [sx, sy] = await screen(x, y);
		await t.send('Input.dispatchMouseEvent', { type, x: sx, y: sy, button: 'left', buttons, clickCount: 1 });
		await sleep(20);
	};
	const key = async (k) => {
		const code = k.length === 1 ? `Key${k.toUpperCase()}` : k;
		const vk = k === 'Delete' ? 46 : k.toUpperCase().charCodeAt(0);
		for (const type of ['keyDown', 'keyUp']) {
			await t.send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, ...(type === 'keyDown' && k.length === 1 ? { text: k } : {}) });
		}
		await sleep(30);
	};
	// a drag from one point to another, pressing a key at each listed stop on the way
	const drag = async (from, to, hops = []) => {
		await mouse('mousePressed', from[0], from[1], 1);
		for (const [k, x, y] of hops) { await mouse('mouseMoved', x, y, 1); await key(k); }
		await mouse('mouseMoved', to[0], to[1], 1);
		await mouse('mouseReleased', to[0], to[1], 0);
		await sleep(150);
	};
	const click = async (x, y) => { await mouse('mousePressed', x, y, 1); await mouse('mouseReleased', x, y, 0); await sleep(60); };
	// a Shift-click, for adding to the selection: CDP's modifiers bit 8 is Shift
	const shiftClick = async (x, y) => {
		const [sx, sy] = await screen(x, y);
		for (const type of ['mousePressed', 'mouseReleased']) { await t.send('Input.dispatchMouseEvent', { type, x: sx, y: sy, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1, modifiers: 8 }); await sleep(20); }
		await sleep(60);
	};
	return { run: t.run, ready, close: async () => {}, mouse, key, drag, click, shiftClick };
}

/*
The door tests prove the PLANNER's cascade and sweep reach the tab, so they clear the board's pipes
first. Since pipes count as references, a hand pipe legitimately holds a waypoint the sweep would
otherwise take -- a separate rule with its own test below, and mixing the two would let either one
hide a failure in the other.
*/
/*
PIPES ARE ENTITIES since H17.22 N-c, in both models, changed only through the planner. So a test lays and removes them as
an author's edit does -- a commit through the door -- with the page's own pipe kind making the entities, never a second
copy of its id rule here. `pipesIn(body)` runs `body` with `lay`, `clear`, `pipes` and `has` in scope.
*/
const PIPES = `const { pipeId, pipeEntity } = await import('/network/pipe-kind.mjs');
	const pipes = () => lab.authority.all('pipe').map(({ a, b, laid }) => ({ a, b, laid }));
	const has = (x, y) => !!lab.authority.get('pipe', pipeId(x, y));
	const commitPipes = (entries) => { if (entries.length) lab.history.commit({ label: 'pipes', entries }); };
	const lay = (list) => commitPipes(list.map(([a, b, laid]) => { const had = lab.model.get('pipe', pipeId(a, b));
		return !had ? { op: 'put', kind: 'pipe', entity: pipeEntity(a, b, laid) } : laid === 'hand' && had.laid !== 'hand' ? { op: 'set', kind: 'pipe', id: had.id, after: { laid: 'hand' } } : null; }).filter(Boolean));
	const clear = () => commitPipes(lab.model.all('pipe').map((x) => ({ op: 'del', kind: 'pipe', entity: { ...x } })));`;
const pipesIn = (body) => `(async () => { ${PIPES} ${body} })()`;
const CLEAR_PIPES = pipesIn('clear();');

// the tab's document, counted -- the thing the author actually sees
const COUNTS = `({ nodes: Object.values(lab.model.state.nodes).filter((n) => !!n.type).length, waypoints: Object.values(lab.model.state.nodes).filter((n) => !n.type).length,
	links: Object.keys(lab.model.state.links).length, notice: document.getElementById('lab-notice').textContent })`;

test('the lab boots, and a seeded board arrives through the planner', { skip: SKIP }, async () => {
	const p = await open('bend');
	try {
		assert.equal(p.ready, true, 'the page never exposed its handle: it failed to boot, which is how the wrong-import defect looked');
		const c = await p.run(COUNTS);
		assert.deepEqual([c.nodes, c.waypoints, c.links], [2, 1, 1], `the bend board did not arrive: ${JSON.stringify(c)}`);
		assert.equal(await p.run('lab.authority.all("link").length'), 1, 'the AUTHORITY model must hold the board too -- the planner is what put it there');
		// ONE network (RULESET-AUDIT T1): the tab's Model holds the very object whose link tenant the planner is handed
		// (PL-3); AMENDED 2026-10-04 (V-e, J2): the authority holds it too -- a Model holding links is given the network
		assert.equal(await p.run('lab.model.network === lab.network && lab.network.links.owner === "network links"'), true, 'the tab must draw from the network the planner judges with');
		assert.equal(await p.run('lab.authority.network === lab.network'), true, 'and the authority holds the same one');
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
const land = (from, to) => `lab.input.commitRoute({ src: lab.model.get('node', '${from}'), placed: [] }, '${to}', [])`;
const roleOf = (id) => `[...document.getElementById('${id}').classList].filter((c) => c !== 'waypoint')`;

test('compare: a landing CUTS the links that pin the centre, and the centre becomes a junction', { skip: SKIP }, async () => {
	const p = await open('compare');
	try {
		assert.deepEqual(await p.run(roleOf('node-000011')), ['bend'], 'before the landing, the pinned centre is a bend, not a junction');
		await p.run(land('node-000013', 'node-000011'));
		assert.ok((await p.run(roleOf('node-000011'))).includes('junction'), 'after it, the pinned pair was cut there: a junction');
		const ending = await p.run(`lab.authority.all('link').filter((l) => l.src === 'node-000011' || l.dst === 'node-000011').length`);
		assert.equal(ending, 5, 'two pinned links cut in two, plus the landing: five links end at the centre');
	} finally { await p.close(); }
});

test('compare: a landing CROSSES the links that only pass the centre, and they stay whole', { skip: SKIP }, async () => {
	const p = await open('compare');
	try {
		await p.run(land('node-000014', 'node-000012'));
		assert.ok(!(await p.run(roleOf('node-000012'))).includes('junction'), 'the guided centre must NOT become a junction');
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
test('the route hook accepts a g route the link will not follow, names the guides skipped, and lays nothing itself', { skip: SKIP }, async () => {
	const p = await open('detour');
	try {
		const before = await p.run(`lab.authority.all('pipe').length`);
		/*
		n1 to n2 through w7 then w6: three pipes, while n1-w6-n2 is two once the legs are laid, so the link will not
		pass w7. This was a refusal until 2026-09-30, when the director ruled "Link runs the shorter way": the link is
		made on the shorter way and the path drawn is kept as its alternate. The pinned uplink's own pipes carry only
		it, so the shorter way is judged over hand pipes.
		*/
		const v = await p.run(`lab.routeHook({ src: 'node-000001', dst: 'node-000002', pins: [], placed: [],
			guides: ['node-000007', 'node-000006'], stops: ['node-000001', 'node-000007', 'node-000006', 'node-000002'],
			pressed: { w: true, g: true }, endPressed: 'w' })`);   // a w drag with g hops: only w makes a link (2026-09-30)
		assert.equal(v.ok, true, v.notice);
		assert.deepEqual(v.skipped, ['node-000007'], 'the guide the link will not pass is named');
		assert.equal(await p.run(`lab.authority.all('pipe').length`), before, 'the check lays nothing: its pipes ride in the link\'s commit (N-c)');
	} finally { await p.close(); }
});

test('an accepted route\'s pipes ride in its link\'s commit, and the sweep takes them back', { skip: SKIP }, async () => {
	const p = await open('cross');
	try {
		const before = await p.run(`lab.authority.all('pipe').length`);
		// A straight to D: a new one-pipe leg, shorter than A-centre-D, so the route takes it
		// w pressed at D: only w lays a pipe WITH a link, and a key at the end lays the pipe into it (2026-09-30)
		const v = await p.run(`lab.routeHook({ src: 'node-000001', dst: 'node-000004', pins: [], guides: [], placed: [], stops: ['node-000001', 'node-000004'], pressed: { w: true, g: false }, endPressed: 'w' })`);
		assert.equal(v.ok, true, v.notice);
		assert.equal(await p.run(`lab.authority.all('pipe').length`), before, 'nothing is laid by the check itself');
		assert.deepEqual(v.entries.map((e) => [e.op, e.kind, e.entity.a, e.entity.b, e.entity.laid]), [['put', 'pipe', 'node-000001', 'node-000004', 'link']], 'its leg is an entry for the link\'s commit');

		// Input adds the judge's entries to the drag's own commit (N-c), here asked directly
		await p.run(`lab.input.commitRoute({ src: lab.model.get('node', 'node-000001'), placed: [] }, 'node-000004', [], ${JSON.stringify(v.entries)})`);
		assert.equal(await p.run(`lab.authority.all('pipe').length`), before + 1, 'the planner accepted the link, its leg with it');
		assert.equal(await p.run(`lab.authority.all('pipe').find((x) => x.a === 'node-000001' && x.b === 'node-000004').laid`), 'link');

		// delete that link: its pipe was laid WITH it, and no other link uses it, so it goes (2026-09-27)
		const id = await p.run(`lab.authority.all('link').find((l) => l.src === 'node-000001' && l.dst === 'node-000004').id`);
		await p.run(`lab.history.commit({ label: 'delete', entries: [{ op: 'del', kind: 'link', entity: lab.model.get('link', '${id}') }] })`);
		assert.equal(await p.run(`lab.authority.all('pipe').length`), before, 'a pipe laid with a link goes once no link remains on it');
	} finally { await p.close(); }
});

test('pipes an author laid hold an anchor the sweep would take, and a pipe to a deleted anchor goes', { skip: SKIP }, async () => {
	const p = await open('bend');
	try {
		// bend: A -- w -- B, the link pinned at w. Its seed pipes are the link's own legs, laid WITH it (seeds
		// carry the lifetime their gesture gives, ruled 2026-09-29), so the author lays w-B again BY HAND --
		// which promotes it (the session's `pipeEntries`; the pipe row refuses the reverse). Delete A: the planner takes the link, and would sweep w as
		// the bend it left -- but w still has a hand pipe to B, so it is structure, not debris (pipes count as
		// references). The pipe A-w has lost an end, so it goes.
		await p.run(pipesIn(`lay([['node-000005', 'node-000002', 'hand']]);`));
		await p.run(`lab.history.commit({ label: 'delete', entries: [{ op: 'del', kind: 'node', entity: lab.model.get('node', 'node-000001') }] })`);
		const c = await p.run(COUNTS);
		assert.equal(c.links, 0, 'the link went with its end');
		assert.equal(c.waypoints, 1, 'w survives: its hand pipe to B still references it');
		assert.deepEqual(await p.run(`lab.authority.all('pipe').map((x) => [x.a, x.b].sort().join('-'))`), ['node-000002-node-000005'],
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
		// a pipe no link runs over -- the cross board's are all under its links, and those are not drawn (2026-10-02)
		await p.run(pipesIn(`lay([['node-000001', 'node-000003', 'hand']]);`));
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
		await p.run(`lab.history.commit({ label: 'move', entries: [{ op: 'set', kind: 'node', id: 'node-000005', after: { x: 120, y: 60 } }] })`);
		assert.match(await p.run(drawn), /Q120 60/,
			"after: the DRAWN link must bend at the centre's new place -- the pipes followed, and the link must too");
	} finally { await p.close(); }
});

/*
The same defect's third face -- a link's drawn route depends on the PIPE SET, which lives outside the model, so
a change there must still redraw the links it moves -- is held by matrix row CAP-04: deleting the link that holds
the trunk frees it, and the blocked link must be DRAWN along it. The test that stood here made its route change by
letting a link run over two other links' pipes, which a pipe carrying one link forbids (ruled 2026-09-30).
*/
test('moving a NODE redraws the links routed through it, too', { skip: SKIP }, async () => {
	const p = await open('cross');
	try {
		// re-lay the pipes so link-000001 (A to B) routes through node C, which it does not name
		await p.run(pipesIn(`clear(); lay([['node-000001', 'node-000003', 'hand'], ['node-000003', 'node-000002', 'hand']]);`));
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

/*
WHICH LINK IS OLDER is stored, not inferred (ruled 2026-09-30: "the older link keeps a contested hand-laid pipe"; F-d, B259):
a link's age is its drawing order, stamped when it is made and restored by undo -- in the document, so the tab and the
planner's model agree on it, and a reload keeps it. It was the door's session record until H18.6. Asserted on the page,
since the stamping is the page's and the planner's.
*/
test('a drawn link is given its age when it is made, the same in the tab and the planner, and keeps it through delete and undo', { skip: SKIP }, async () => {
	const p = await open('cross');
	const ages = (id) => `[lab.model.get('link', '${id}')?.order ?? null, lab.authority.get('link', '${id}')?.order ?? null]`;
	try {
		// the seed's links are aged as they load, in the order listed
		const [one] = await p.run(ages('link-000001')), [two] = await p.run(ages('link-000002'));
		assert.ok(Number.isInteger(one) && two > one, `a loaded board is aged in the order it lists its links: ${one}, ${two}`);
		await p.drag([-360, 0], [0, 240], [['w', -240, 120]]);   // A to D, pinned below the centre: a new link
		const id = await p.run(`lab.authority.all('link').find((l) => l.src === 'node-000001' && l.dst === 'node-000004')?.id ?? null`);
		assert.ok(id, 'the drag must make a link, or this proves nothing');
		const [tab, held] = await p.run(ages(id));
		assert.ok(Number.isInteger(tab) && tab > two, `the new link is aged, and younger than the seed's links: ${tab}`);
		assert.equal(held, tab, 'and the planner holds the same age');
		await p.run(`lab.history.commit({ label: 'delete', entries: [{ op: 'del', kind: 'link', entity: lab.model.get('link', '${id}') }] })`);
		await p.run('lab.history.undo()');
		assert.deepEqual(await p.run(ages(id)), [tab, tab], 'undo gives it back its age, in both');
	} finally { await p.close(); }
});

/*
B257 -- the lab's sweep keeps the pipes a link is DRAWN on. The older link sorts last by id, so an id-order sweep and the
age-order drawing disagree about who runs over the free w pipe W1-W2; the younger link is drawn over C-x-y-D, and an
id-order sweep deleted those pipes at the next edit. Built through the door with fixed ids, so the orders are known.
*/
test('B257: an edit keeps the pipes a link is drawn on, whichever order ids sort in', { skip: SKIP }, async () => {
	const p = await open('');
	try {
		const wp = (id, x, y) => `{ op: 'put', kind: 'node', entity: { id: '${id}', name: '${id}', x: ${x}, y: ${y} } }`;
		const lk = (id, s, d) => `{ op: 'put', kind: 'link', entity: { id: '${id}', name: '${id}', src: '${s}', dst: '${d}' } }`;
		const put = (label, entries) => p.run(`lab.history.commit({ label: '${label}', entries: [${entries.join(', ')}] })`);
		await put('anchors', [wp('node-00000a', -480, -120), wp('node-00000b', 480, -120), wp('node-00000c', -480, 240), wp('node-00000d', 480, 240),
			wp('node-0000e1', -120, 0), wp('node-0000e2', 120, 0), wp('node-0000f1', -120, 360), wp('node-0000f2', 120, 360)]);
		await put('older', [lk('link-0000ff', 'node-00000a', 'node-00000b')]);      // aged first, sorts last by id
		await put('younger', [lk('link-000001', 'node-00000c', 'node-00000d')]);
		// the pipes, once both links exist -- a link pipe with no link on it is swept, as ruled
		await p.run(pipesIn(`lay([['node-0000e1','node-0000e2','link'], ['node-00000a','node-0000e1','hand'], ['node-0000e2','node-00000b','hand'],
			['node-00000c','node-0000e1','hand'], ['node-0000e2','node-00000d','hand'], ['node-00000c','node-0000f1','link'],
			['node-0000f1','node-0000f2','link'], ['node-0000f2','node-00000d','link']]);`));
		await put('unrelated', [wp('node-000099', 600, 420)]);                          // any edit settles, and sweeps
		assert.equal(await p.run(pipesIn(`return ['node-00000c|node-0000f1', 'node-0000f1|node-0000f2', 'node-0000f2|node-00000d']
			.filter((k) => has(...k.split('|'))).length;`)), 3, 'the pipes the younger link is drawn on survive the sweep');
		assert.match(await p.run(`document.getElementById('link-000001').getAttribute('d')`), /Q-120 360/, 'and it is drawn over them, by age');
		assert.equal(await p.run(`lab.model.isLinkDown(lab.model.get('link', 'link-0000ff'))`), false, 'while the older link keeps the free w pipe');
	} finally { await p.close(); }
});

/*
THE SEEDS ARE BOARDS A HAND COULD DRAW -- ruled 2026-09-29, "Yes, as the gesture would".

A pipe joining two consecutive stops of a PINNED link's intent (its ends and pins, in order) is what `w` lays,
and goes with its link; any other pipe is what `g` or a hand lays, and stays. A seed that loaded every
pipe as hand-laid behaved as no drawn board can: deleting a link's end left its bend and a pipe standing.
Checked as a RULE over every board, so a new board is held to it without anyone listing it here.
*/
/*
F11 (RULESET-AUDIT) -- after `w` on a node mid-drag the live preview stopped following the cursor: a node stop made the
straight polyline null, so the preview froze where the node was pressed. Real Chrome, real input, the drawn `d` read.
*/
test('F11: after w on a node mid-drag, the live preview still follows the cursor', { skip: SKIP }, async () => {
	const p = await open('cross');
	try {
		const live = `document.querySelector('#overlay path.link-live')?.getAttribute('d') ?? null`;
		await p.mouse('mousePressed', -360, 0, 1);
		await p.mouse('mouseMoved', 0, -240, 1);
		await p.key('w');                                  // on node-000003: a stop, never a pin (network/keys.mjs)
		await p.mouse('mouseMoved', 240, -240, 1);
		const first = await p.run(live);
		await p.mouse('mouseMoved', 240, -120, 1);
		const second = await p.run(live);
		await p.mouse('mouseReleased', 240, -120, 0);
		assert.match(first ?? '', /240[ ,]-240$/, `the preview ends at the cursor: ${first}`);
		assert.match(second ?? '', /240[ ,]-120$/, `and follows it: ${second}`);
	} finally { await p.close(); }
});

/*
B268 -- A DOWN LINK IS SELECTED WHEREVER IT IS CLICKED. It is drawn dotted, and the browser hit-tests a stroke's dashes,
not its gaps: measured live, 10 of 29 clicks along a down link selected it, the rest reaching the pipe beneath. Each link
now has an invisible twin, the same path and width with no dash, which takes the click for it -- the visual unchanged.
*/
test('B268: every click along a down link selects it, and the link still looks the same', { skip: SKIP }, async () => {
	const p = await open('cross');
	try {
		await p.run(`lab.history.commit({ label: 'delete', entries: [{ op: 'del', kind: 'node', entity: lab.model.get('node', 'node-000005') }] })`);
		await p.run(settle);
		const look = await p.run(`(() => { const cs = getComputedStyle(document.getElementById('link-000001')); return { dash: cs.strokeDasharray, cap: cs.strokeLinecap, stroke: cs.stroke }; })()`);
		assert.notEqual(look.dash, 'none', 'precondition: the link is down, drawn dotted');
		let hits = 0, tries = 0;
		for (let x = -300; x <= -100; x += 7) {
			await p.click(600, 400);
			await p.click(x, 0);
			tries++;
			if ((await p.run('lab.input.selection.list()')).includes('link-000001')) hits++;
		}
		assert.equal(hits, tries, `${hits} of ${tries} clicks along the down link selected it`);
		const after = await p.run(`(() => { const cs = getComputedStyle(document.getElementById('link-000001')); return { dash: cs.strokeDasharray, cap: cs.strokeLinecap, stroke: cs.stroke }; })()`);
		assert.deepEqual(after, { ...look, stroke: after.stroke }, 'still dotted, with the same caps -- only its colour follows the selection');
	} finally { await p.close(); }
});

test('B268: the click area is the link\'s own width -- a click just beside a solid link does not select it', { skip: SKIP }, async () => {
	const p = await open('cross');
	try {
		const w = await p.run(`parseFloat(getComputedStyle(document.getElementById('link-000001')).strokeWidth)`);
		await p.click(600, 400);
		await p.click(-200, w / 2 + 3);
		assert.deepEqual(await p.run('lab.input.selection.list()'), [], 'beside it: nothing');
		await p.click(-200, 0);
		assert.deepEqual(await p.run('lab.input.selection.list()'), ['link-000001'], 'on it: the link');
	} finally { await p.close(); }
});

/*
The transit ring is SEEN on a cut anchor, not only drawn -- the director's report (2026-09-30): after a cut, the anchor is
an endpoint, and the endpoint ring's fill hid the transit ring. Measured in the page: at the ring's own radius, the
topmost element is the ring.
*/
test('a transit ring stays visible when its anchor becomes an endpoint', { skip: SKIP }, async () => {
	const p = await open('transit-pin');
	try {
		await p.click(0, -120);
		await p.key('x');
		const top = await p.run(`(() => {
			const g = document.getElementById('node-000005');
			const ring = g.querySelector('.wp-transit');
			const kids = [...g.children];
			return { endpoint: !!g.querySelector('.wp-ring'), after: kids.indexOf(ring) > kids.indexOf(g.querySelector('.wp-ring')) };
		})()`);
		assert.equal(top.endpoint, true, 'precondition: the cut made the anchor an endpoint');
		assert.equal(top.after, true, 'the transit ring is painted above the endpoint ring, not hidden under its fill');
	} finally { await p.close(); }
});

test('every seed pipe carries the lifetime its gesture would give it', () => {
	const boards = JSON.parse(fs.readFileSync(new URL('../lab/seeds.json', import.meta.url), 'utf8'));
	const named = Object.entries(boards).filter(([name]) => !name.startsWith('_'));
	assert.ok(named.length >= 5, 'the sweep must find the boards');
	let checked = 0;
	for (const [name, board] of named) {
		// only w lays a pipe WITH a link (2026-09-30, "Each drag action does one thing"): a link with no pin laid none
		const links = board.ops.map((o) => o.entity).filter((e) => e && e.id.startsWith('link-') && (e.via ?? []).length);
		const legs = new Set();
		for (const l of links) {
			const stops = [l.src, ...(l.via ?? []), l.dst];
			for (let i = 0; i < stops.length - 1; i++) legs.add([stops[i], stops[i + 1]].sort().join('|'));
		}
		for (const pipe of board.pipes) {
			assert.equal(pipe.length, 3, `${name}: ${JSON.stringify(pipe)} must state its lifetime, not default to one`);
			const want = legs.has([pipe[0], pipe[1]].sort().join('|')) ? 'link' : 'hand';
			assert.equal(pipe[2], want, `${name}: ${pipe[0]}-${pipe[1]} is ${want === 'link' ? 'a leg of a link, laid with it' : 'no leg of any link, laid by hand'}`);
			checked++;
		}
	}
	assert.ok(checked >= 20, `the rule must have checked the pipes, not passed on none (${checked})`);
});

/*
THE BEHAVIOUR MATRIX, EXECUTED -- dev/design/unification/BEHAVIOUR-MATRIX.json.

The director, 2026-09-29: "Let's make sure we are durably capturing our intended rules in for each of these
test permutations in a matrix somewhere, such that we can refine and iterate on behaviours in a deliberate
fashion". So every lab gesture permutation is a ROW of one data file, and this runs them all. The row is the
specification and this is the only code that turns it into a verdict (mission-kit A2, P5): changing a
behaviour is an edit to its row, and nothing here changes. Eleven tests that stated these rules by hand were
folded into rows when this was built, so each rule is stated once.

HOW A ROW IS JUDGED:
  - its STATE's board is opened and set up, and the state's own checks must pass first -- so a delete row
    cannot pass on a board whose setup silently drew nothing
  - its steps run with REAL INPUT, the way the director's reports were found
  - the UNIVERSAL INVARIANTS must hold, whatever the row is about
  - a built row must meet every check; a TODO row must still MISS one, so the day the lab meets it the gate
    says to promote it, and the matrix's status column can never lag the code
  - an OPEN row has no checks of its own, since nothing is ruled, but it runs and the invariants hold on it

THE VOCABULARY LIVES HERE AND ONLY HERE. The matrix may use no step or check this file does not implement,
and must list exactly the invariants this file checks -- asserted against these live maps rather than by
reading source, and shown to catch planted drift (P5).
*/
const MATRIX = JSON.parse(fs.readFileSync(new URL('../dev/design/unification/BEHAVIOUR-MATRIX.json', import.meta.url), 'utf8'));
const settle = `new Promise((r) => setTimeout(r, 200))`;

// every step a row may take, each performed with real input through the canvas's own transform
const STEP = {
	click: (p, x, y) => p.click(x, y),
	shiftClick: (p, x, y) => p.shiftClick(x, y),
	move: (p, x, y) => p.mouse('mouseMoved', x, y),
	key: (p, k) => p.key(k),
	drag: (p, from, to, hops) => p.drag(from, to, hops),
	undo: (p) => p.run('lab.history.undo()'),   // the path Ctrl+Z takes
	redo: (p) => p.run('lab.history.redo()'),   // the path Ctrl+Shift+Z takes
	settle: (p) => p.run(settle),
};

// what the page shows, gathered once: the authority, the tab, the canvas as COMPUTED, and the notice
const SNAPSHOT = `(() => {
	const drawn = (el) => {
		const cs = getComputedStyle(el);
		const dash = cs.strokeDasharray === 'none' ? [] : cs.strokeDasharray.split(/[ ,]+/).map(parseFloat);
		// a zero-length dash with a round cap is a DOT; without the round cap it draws nothing at all
		return { d: el.getAttribute('d') || '', stroke: cs.stroke, dotted: dash.length >= 2 && dash[0] === 0 && dash[1] > 0 && cs.strokeLinecap === 'round' };
	};
	const shape = (l) => ({ id: l.id, src: l.src, dst: l.dst, via: l.via ?? [] });
	return {
		notice: document.getElementById('lab-notice').textContent,
		links: lab.authority.all('link').map((l) => ({ ...shape(l), down: lab.model.isLinkDown(l) })),
		// how many links are control links (B284: a cut keeps the plane)
		controls: lab.authority.all('link').filter((l) => l.control).length,
		tabLinks: lab.model.all('link').map(shape),
		anchors: lab.authority.all('node').filter((n) => !n.type).map((w) => ({ id: w.id, x: w.x, y: w.y })),
		tabAnchors: lab.model.all('node').filter((n) => !n.type).map((w) => w.id),
		alive: lab.authority.all('node').map((e) => e.id),   // every anchor, typed or not (F-c)
		// pipes are entities in both models since N-c: what the planner holds, and whether the tab holds the same (I1)
		pipes: lab.authority.all('pipe').map(({ a, b, laid }) => ({ a, b, laid })),
		// whether the tab holds exactly the authority's pipes -- a verdict, not the ids, which carry minted anchors' random hex
		// the pipes drawn, and the pipes an up link runs over -- from the network's own routes (2026-10-02: one is never the other)
		// SEEN, not merely present: a pipe under a link stays in the page, hidden (2026-10-02)
		// Chrome's checkVisibility() does not look up through a hidden SVG group, so the ancestors are walked here
		drawnPipes: [...document.querySelectorAll('#pipes line.pipe')].filter((l) => { for (let n = l; n && n.id !== 'container'; n = n.parentElement) if (getComputedStyle(n).display === 'none') return false; return true; }).map((l) => l.id).sort(),
		pipeElements: [...document.querySelectorAll('#pipes .pipe-of')].map((g) => g.getAttribute('data-pipe')).sort(),
		underLinks: (() => { const v = lab.network.view.of(lab.model), on = new Set();
			for (const l of lab.model.all('link')) { const r = v.route(l.id); if (r) for (let i = 0; i < r.length - 1; i++) on.add([r[i], r[i + 1]].sort().join('|')); }
			return lab.model.all('pipe').filter((p) => on.has([p.a, p.b].sort().join('|'))).map((p) => p.id).sort(); })(),
		allPipes: lab.model.all('pipe').map((p) => p.id).sort(),
		pipesAgree: JSON.stringify(lab.model.all('pipe').map((p) => p.id).sort()) === JSON.stringify(lab.authority.all('pipe').map((p) => p.id).sort()),
		tabPipeCount: lab.model.all('pipe').length,
		// a selected pipe spelled by its two ends (N-c2): its id is made of a minted anchor's random hex, which the corpus's
		// canonical numbering cannot see, while the ends are anchor ids it numbers like any other
		selected: lab.input.selection.list().map((id) => { const p = id.startsWith('pipe-') && lab.model.get('pipe', id); return p ? \`pipe:\${p.a}:\${p.b}\` : id; }),
		// what declares transit off on the canvas: each drawn transit ring, by the anchor or node it marks, and how it looks
		rings: [...document.querySelectorAll('.wp-transit')].map((c) => { const cs = getComputedStyle(c); return { id: c.closest('g[id]').id, stroke: cs.stroke, dashed: cs.strokeDasharray !== 'none', fitted: Number(c.getAttribute('pathLength')) || null }; }),
		// what each waypoint IS (B277): its roles as drawn -- the class and the rings -- and as Input judges it, the two readers
		waypointRoles: [...document.querySelectorAll('#waypoints g.waypoint')].map((g) => ({ id: g.id,
			drawn: [...g.classList].filter((c) => c === 'endpoint' || c === 'junction'), junctionRing: !!g.querySelector('.wp-junction'),
			endpointRing: !!g.querySelector('.wp-ring'), transitOff: !!g.querySelector('.wp-transit'), judged: lab.input.situation(g.id).target?.roles ?? null })),
		// every stretch an UP link is drawn along, as the pair of points it joins -- from what is drawn, not from the assignment
		stretches: lab.model.all('link').filter((l) => !lab.model.isLinkDown(l)).map((l) => {
			const pts = lab.model.pathOf(l) ?? [];
			return { id: l.id, keys: pts.slice(1).map((q, i) => [pts[i].join(','), q.join(',')].sort().join('|')) };
		}),
		paths: Object.fromEntries([...document.querySelectorAll('#links path.link')].map((el) => [el.id, drawn(el)])),
	};
})()`;

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const byId = (xs) => [...xs].sort((a, b) => (a.id < b.id ? -1 : 1));
const ids = (xs) => xs.map((x) => x.id ?? x).join(',') || 'none';

// what must hold after EVERY row, ruled or not -- each true, or a sentence saying what broke
const INVARIANT = {
	I1: (s) => (same(byId(s.links.map(({ down, ...l }) => l)), byId(s.tabLinks)) && same([...s.tabAnchors].sort(), s.anchors.map((a) => a.id).sort()) && s.pipesAgree)
		|| `the tab holds links ${ids(s.tabLinks)}, ${s.tabAnchors.length} anchors and ${s.tabPipeCount} pipes; the authority holds ${ids(s.links)}, ${s.anchors.length} and ${s.pipes.length}${s.pipesAgree ? '' : ', and the pipes differ'}`,
	I2: (s) => {
		const wrong = s.links.filter((l) => s.paths[l.id] && s.paths[l.id].dotted !== l.down);
		return !wrong.length || wrong.map((l) => `${l.id} is ${l.down ? 'down but drawn solid' : 'up but drawn dotted'}`).join('; ');
	},
	I3: (s) => (same(Object.keys(s.paths).sort(), s.links.map((l) => l.id).sort()) && Object.values(s.paths).every((p) => p.d))
		|| `the canvas draws ${ids(Object.keys(s.paths))} where ${ids(s.links)} exist`,
	I4: (s) => {
		const dangling = s.pipes.filter((x) => !s.alive.includes(x.a) || !s.alive.includes(x.b));
		return !dangling.length || `pipes to missing anchors: ${dangling.map((x) => `${x.a}-${x.b}`).join(', ')}`;
	},
	I5: (s, thrown) => !thrown.length || `the page threw: ${thrown.join('; ')}`,
	I6: (s) => {
		const on = new Map();
		for (const { id, keys } of s.stretches) for (const k of new Set(keys)) on.set(k, [...(on.get(k) ?? []), id]);
		const stacked = [...on].filter(([, ids]) => ids.length > 1);
		return !stacked.length || stacked.map(([k, ids]) => `${ids.join(' and ')} are both drawn along ${k}`).join('; ');
	},
	// 2026-10-02: a pipe is drawn exactly when no up link runs over it
	I8: (s) => {
		const want = s.allPipes.filter((id) => !s.underLinks.includes(id));
		if (!same(s.pipeElements, s.allPipes)) return `${s.pipeElements.length} pipe elements in the page for ${s.allPipes.length} pipes: one each, kept, hidden or not`;
		return same(s.drawnPipes, want) || `seen pipes ${s.drawnPipes.length}, where the pipes no up link runs over are ${want.length}`;
	},
	// B277: transit off admits endpoints only -- no junction class, no junction ring, and Input never judges one
	I7: (s) => {
		const wrong = s.waypointRoles.filter((w) => w.transitOff && (w.junctionRing || w.drawn.includes('junction') || (w.judged ?? []).includes('junction')));
		return !wrong.length || wrong.map((w) => `${w.id} declares transit off and is a junction: ${JSON.stringify(w)}`).join('; ');
	},
};

// a link a check names: its id, or "only" when exactly one link exists
const select = (s, sel) => (sel === 'only' ? (s.links.length === 1 ? s.links[0] : null) : s.links.find((l) => l.id === sel) ?? null);
const laid = (s, kind) => s.pipes.filter((x) => x.laid === kind).length;
const rgb = (hex) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
// a point in a drawn path, as a whole number pair: "240 300" must not match inside "-240 300"
const passes = (d, [x, y]) => new RegExp(`(^|[A-Za-z ])${x} ${y}(?![\\d.])`).test(d);
const fateOf = (s, id) => { const l = s.links.find((x) => x.id === id); return !l ? 'gone' : l.down ? 'down' : 'up'; };

// every check a row or state may make -- each true, or a sentence saying what the page shows instead
const CHECK = {
	links: (s, n) => s.links.length === n || `${s.links.length} links, not ${n}`,
	anchors: (s, n) => s.anchors.length === n || `${s.anchors.length} anchors, not ${n}`,
	down: (s, n) => s.links.filter((l) => l.down).length === n || `${s.links.filter((l) => l.down).length} links down, not ${n}`,
	pipes: (s, want) => (typeof want === 'number'
		? s.pipes.length === want || `${s.pipes.length} pipes, not ${want}`
		: (laid(s, 'hand') === want.hand && laid(s, 'link') === want.link)
			|| `${laid(s, 'hand')} pipes by hand and ${laid(s, 'link')} with a link, not ${want.hand} and ${want.link}`),
	linkState: (s, want) => {
		const wrong = Object.entries(want).filter(([id, fate]) => fateOf(s, id) !== fate);
		return !wrong.length || wrong.map(([id, fate]) => `${id} is ${fateOf(s, id)}, not ${fate}`).join('; ');
	},
	pins: (s, want) => {
		const wrong = Object.entries(want).filter(([sel, n]) => select(s, sel)?.via.length !== n);
		return !wrong.length || wrong.map(([sel, n]) => `${sel} pins ${select(s, sel)?.via.length ?? 'nothing -- no such link'}, not ${n}`).join('; ');
	},
	straight: (s, want) => {
		const wrong = Object.entries(want).filter(([sel, d]) => s.paths[select(s, sel)?.id]?.d !== d);
		return !wrong.length || wrong.map(([sel, d]) => `${sel} is drawn "${s.paths[select(s, sel)?.id]?.d}", not "${d}"`).join('; ');
	},
	through: (s, want) => {
		const wrong = Object.entries(want).filter(([sel, pts]) => { const d = s.paths[select(s, sel)?.id]?.d ?? ''; return !pts.every((pt) => passes(d, pt)); });
		return !wrong.length || wrong.map(([sel, pts]) => `${sel} is drawn "${s.paths[select(s, sel)?.id]?.d}", which does not pass ${JSON.stringify(pts)}`).join('; ');
	},
	linksBetween: (s, want) => {
		const n = (a, b) => s.links.filter((l) => (l.src === a && l.dst === b) || (l.src === b && l.dst === a)).length;
		const wrong = Object.entries(want).filter(([pair, k]) => n(...pair.split('|')) !== k);
		return !wrong.length || wrong.map(([pair, k]) => `${n(...pair.split('|'))} links join ${pair}, not ${k}`).join('; ');
	},
	keptAt: (s, pts) => pts.every(([x, y]) => s.anchors.some((a) => a.x === x && a.y === y))
		|| `no anchor at ${JSON.stringify(pts.filter(([x, y]) => !s.anchors.some((a) => a.x === x && a.y === y)))}`,
	notice: (s, re) => new RegExp(re).test(s.notice) || `the notice says "${s.notice}", which does not match /${re}/`,
	noticeNot: (s, re) => !new RegExp(re).test(s.notice) || `the notice says "${s.notice}", which must not match /${re}/`,
	refused: (s, want) => /refused/.test(s.notice) === want || `the notice says "${s.notice}", which is ${want ? 'not ' : ''}a refusal`,
	stroke: (s, want) => {
		const wrong = Object.entries(want).filter(([id, hex]) => s.paths[id]?.stroke !== rgb(hex));
		return !wrong.length || wrong.map(([id, hex]) => `${id} is stroked ${s.paths[id]?.stroke ?? '(not drawn)'}, not ${hex}`).join('; ');
	},
	rings: (s, ids) => same(s.rings.map((r) => r.id).sort(), [...ids].sort()) || `the rings mark ${s.rings.map((r) => r.id).join(',') || 'nothing'}, not ${ids.join(',') || 'nothing'}`,
	// what a waypoint is, the same as drawn and as judged; an endpoint carries the endpoint ring, a junction the junction ring
	roles: (s, want) => {
		const wrong = Object.entries(want).filter(([id, roles]) => {
			const w = s.waypointRoles.find((x) => x.id === id);
			return !w || !same(w.drawn, roles) || !same(w.judged, roles)
				|| w.endpointRing !== roles.includes('endpoint') || w.junctionRing !== roles.includes('junction');
		});
		return !wrong.length || wrong.map(([id, roles]) => `${id} is ${JSON.stringify(s.waypointRoles.find((x) => x.id === id) ?? 'not drawn')}, not ${roles.join(' and ')}`).join('; ');
	},
	// dashed, light red (Red 200), on the junction's rung -- ruled 2026-10-02; it was light orange until then
	ringLook: (s) => (s.rings.length > 0 && s.rings.every((r) => r.stroke === rgb('#ef9a9a') && r.dashed && r.fitted)) || `the rings are drawn ${JSON.stringify(s.rings)}, not dashed in #ef9a9a and fitted to the ring`,
	// the selection is exactly the one down link -- for a board whose links are drawn by gestures, so their ids are not known
	selectedDown: (s, want) => { const down = s.links.filter((l) => l.down).map((l) => l.id); return (down.length === 1 && same([...s.selected], down)) === want || `the selection is ${s.selected.join(',') || 'empty'}, and the down links are ${down.join(',') || 'none'}`; },
	// the kinds of what is selected -- for an id the gesture minted, which a row cannot name (H17.22 N-c2)
	selectedKinds: (s, kinds) => same(s.selected.map((id) => id.split(/[-:]/)[0]).sort(), [...kinds].sort()) || `the selection is ${s.selected.join(',') || 'empty'}, not of kinds ${kinds.join(',')}`,
	controls: (s, n) => s.controls === n || `${s.controls} control links, not ${n}`,
	selected: (s, ids) => same([...s.selected].sort(), [...ids].sort()) || `the selection is ${ids.length ? s.selected.join(',') || 'empty' : s.selected.join(',')}, not ${ids.join(',')}`,
	downStroke: (s, hex) => {
		const down = s.links.filter((l) => l.down);
		const wrong = down.filter((l) => s.paths[l.id]?.stroke !== rgb(hex));
		return (down.length > 0 && !wrong.length) || (down.length ? `down links are stroked ${wrong.map((l) => s.paths[l.id]?.stroke).join(', ')}, not ${hex}` : 'no link is down to show the colour');
	},
};

// every step, check and invariant the matrix names that this file does not perform
function matrixProblems(m) {
	const out = [];
	const steps = (where, list) => { for (const [verb] of list ?? []) if (!(verb in STEP)) out.push(`${where}: there is no step "${verb}"`); };
	const checks = (where, expect) => { for (const key of Object.keys(expect ?? {})) if (!(key in CHECK)) out.push(`${where}: there is no check "${key}"`); };
	for (const [name, st] of Object.entries(m.states)) { steps(`state ${name}`, st.setup); checks(`state ${name}`, st.expect); }
	for (const r of m.rows) { steps(r.id, r.steps); checks(r.id, r.expect); }
	const declared = Object.keys(m.invariants).sort(), checked = Object.keys(INVARIANT).sort();
	if (!same(declared, checked)) out.push(`the matrix declares invariants ${declared.join(',')}; this file checks ${checked.join(',')}`);
	return out;
}

test('the matrix uses only steps and checks this runner performs, and declares exactly the invariants it checks', () => {
	assert.deepEqual(matrixProblems(MATRIX), [], 'a step, check or invariant the runner does not implement would be silently skipped');
	// THE GUARD CAN FAIL: drift planted in a copy is caught, not waved through (P5)
	const planted = structuredClone(MATRIX);
	planted.rows[0].steps.push(['teleport', 0, 0]);
	planted.rows[0].expect.colour = 'red';
	planted.invariants.I9 = 'a promise nothing checks';
	const found = matrixProblems(planted).join('\n');
	for (const drift of ['teleport', 'colour', 'I9']) assert.match(found, new RegExp(drift), `planted drift "${drift}" must be reported`);
});

const judge = (checks, s) => Object.entries(checks).map(([key, want]) => CHECK[key](s, want)).filter((r) => r !== true);
const perform = async (p, steps) => { for (const [verb, ...args] of steps) await STEP[verb](p, ...args); };

/*
THE MATRIX CORPUS -- stage 1 of the gesture system (dev/design/input/GESTURE-SYSTEM.md, section 9).

Each row's own checks say what the row is ABOUT. The whole snapshot after its steps -- links, what is drawn and how,
pipes, anchors, selection, the notice -- is frozen as well, ids canonical, in tests/fixtures/matrix-corpus.json, so a
restructuring that changes anything a row's checks do not name still fails here. Written from the code as it stood when
the corpus was made; rewritten only with a ruled behaviour change, by `CORPUS_WRITE=1 node --test tests/lab-browser.test.js`.
*/
const MATRIX_CORPUS = new URL('./fixtures/matrix-corpus.json', import.meta.url);
const WRITING_CORPUS = process.env.CORPUS_WRITE === '1';
const matrixCorpus = WRITING_CORPUS || !fs.existsSync(MATRIX_CORPUS) ? {} : JSON.parse(fs.readFileSync(MATRIX_CORPUS, 'utf8'));
const written = {};
/*
The snapshot in corpus form: ids canonical, and each pipe written with its ends in canonical order. The pipe set stores
a pipe's ends sorted by id, and ids are random, so which end prints first is not behaviour -- a pipe is its pair. Every
id is numbered before the pipes appear in the snapshot, so orienting them afterwards cannot shift the numbering.
*/
const corpusForm = (s) => {
	// the drawn and occupied pipe lists carry pipe ids, made of minted anchors' random hex; I8 judges them, so they are counted here
	const { drawnPipes, underLinks, allPipes, pipeElements, ...rest } = s;
	const c = canonical({ ...rest, drawnPipes: drawnPipes.length });
	c.pipes = c.pipes.map((q) => { const [a, b] = [q.a, q.b].sort(); return { ...q, a, b }; });
	return c;
};
after(() => { if (WRITING_CORPUS && Object.keys(written).length) fs.writeFileSync(MATRIX_CORPUS, `${JSON.stringify(written, null, '\t')}\n`); });

for (const row of MATRIX.rows) {
	const state = MATRIX.states[row.state];
	const standing = row.standing === 'open' ? 'OPEN' : row.built === 'yes' ? row.standing : `TODO, ${row.standing}`;
	test(`matrix ${row.id} [${standing}] ${row.state} x ${row.gesture}: ${row.does}`, { skip: SKIP }, async () => {
		const p = await open(state.board);
		const t = await theTab();
		try {
			await perform(p, [...state.setup, ['settle']]);
			const unset = judge(state.expect, await p.run(SNAPSHOT));
			// a TODO row may stand on a state the lab cannot reach yet -- that is part of what is still missing
			if (row.built === 'todo' && unset.length) return;
			assert.deepEqual(unset, [], `the board is not in state "${row.state}" after its setup, so ${row.id} would prove nothing: ${unset.join('; ')}`);
			await perform(p, [...row.steps, ['settle']]);
			const s = await p.run(SNAPSHOT);
			// the whole board, frozen -- checked AFTER the row's own checks, so a failing row says what it is about first
			const corpus = () => {
				if (WRITING_CORPUS) written[row.id] = corpusForm(s);
				else assert.deepEqual(corpusForm(s), matrixCorpus[row.id], `${row.id}: the board after its steps differs from the matrix corpus -- a change its own checks do not name`);
			};
			const broken = Object.entries(INVARIANT).map(([id, holds]) => { const r = holds(s, t.thrown); return r === true ? null : `${id}: ${r}`; }).filter(Boolean);
			if (row.standing === 'open') {
				assert.deepEqual(broken, [], `${row.id} waits for a ruling, but the universal invariants hold on every row`);
				corpus();
				return;
			}
			const missed = [...broken, ...judge(row.expect, s)];
			if (row.built === 'yes') assert.deepEqual(missed, [], `${row.id} does not do what the matrix intends:\n  ${missed.join('\n  ')}`);
			else assert.ok(missed.length > 0, `${row.id} now does what the matrix intends -- promote it to "built": "yes" and drop its "today"`);
			corpus();
		} finally { await p.close(); }
	});
}

/*
IN RUN (READ) MODE PIPES ARE NOT DRAWN, like the anchor ring -- the director, 2026-10-02. Read on the page: with `r` on, no
pipe and no pipe's click area is displayed; with it off again, they are.
*/
test('in run mode pipes are hidden, as anchors are, and come back when it ends', { skip: SKIP }, async () => {
	const p = await open('cross');
	try {
		await p.run(pipesIn(`lay([['node-000001', 'node-000003', 'hand']]);`));   // a free pipe, drawn in the edit view
		const shown = `[...document.querySelectorAll('#pipes line')].filter((l) => { for (let n = l; n && n.id !== 'container'; n = n.parentElement) if (getComputedStyle(n).display === 'none') return false; return true; }).length`;
		const anchors = `[...document.querySelectorAll('.wp-anchor')].filter((c) => getComputedStyle(c).display !== 'none').length`;
		assert.ok(await p.run(shown) > 0, 'drawn before');
		await p.click(600, 400);
		await p.key('r');
		assert.equal(await p.run(shown), 0, 'run mode: no pipe drawn or clickable');
		assert.equal(await p.run(anchors), 0, 'as no anchor ring is');
		await p.key('r');
		assert.ok(await p.run(shown) > 0, 'and back when run mode ends');
	} finally { await p.close(); }
});

/*
P5 V-d (H18.28; PL-6) -- the lab's tab PREVIEWS each commit with the planner, as the product page does, and reconciles the
in-page answer against what it applied: so the answer to an edit it previewed writes nothing to the tab. A join is the case
that shows it -- a `set` on the surviving link, which a reconcile against what was SENT (the delete alone) writes again.
*/
test('V-d: the lab previews a commit, and its answer writes nothing more to the tab', { skip: SKIP }, async () => {
	const p = await open('bend');
	try {
		const got = JSON.parse(await p.run(`(() => {
			const m = lab.model, ids = (k) => m.all(k).map((e) => e.id);
			const a = m.makeNode('host', { x: -360, y: 240 }); const b = m.makeNode('host', { x: 360, y: 240 }); const c = m.makeNode('host', { x: 0, y: 420 });
			const w = m.makeWaypoint({ x: 0, y: 240 });
			lab.history.commit({ label: 'seed', entries: [a, b, c].map((e) => ({ op: 'put', kind: 'node', entity: e })).concat([{ op: 'put', kind: 'node', entity: w }]) });
			const l1 = m.makeLink(a.id, w.id); lab.history.commit({ label: 'l1', entries: [{ op: 'put', kind: 'link', entity: l1 }] });
			const l2 = m.makeLink(w.id, b.id); lab.history.commit({ label: 'l2', entries: [{ op: 'put', kind: 'link', entity: l2 }] });
			const l3 = m.makeLink(c.id, w.id); lab.history.commit({ label: 'l3', entries: [{ op: 'put', kind: 'link', entity: l3 }] });
			const writes = [];
			m.onChange((action, kind, e) => { if (kind === 'link' && e?.id === l1.id && action === 'set') writes.push(action); });
			lab.history.commit({ label: 'delete', entries: [{ op: 'del', kind: 'link', entity: { ...m.get('link', l3.id) } }] });
			return JSON.stringify({ writes, joined: !m.get('link', l2.id) && m.get('link', l1.id)?.dst === b.id, agree: JSON.stringify(ids('link').sort()) === JSON.stringify(lab.authority.all('link').map((e) => e.id).sort()) });
		})()`));
		assert.equal(got.joined, true, 'the two left at the waypoint joined');
		assert.deepEqual(got.writes, ['set'], 'the survivor was set ONCE, by the preview -- the answer wrote nothing more');
		assert.equal(got.agree, true, 'and the tab and the authority agree');
	} finally { await p.close(); }
});
