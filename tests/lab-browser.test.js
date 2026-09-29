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
	chrome = spawnGroup(CHROME, ['--headless=new', `--remote-debugging-port=${cdp}`, '--no-sandbox', '--disable-gpu',
		`--user-data-dir=${dir}/cdp`, 'about:blank'], { stdio: 'ignore' });
	for (let i = 0; i < 80; i++) {
		try { await (await fetch(`http://127.0.0.1:${cdp}/json/version`)).json(); break; } catch { await sleep(200); }
	}
});
after(() => teardown([chrome, srv], dir));

// open a page on a seeded board and hand back an evaluator that runs in it
async function open(seed) {
	const t = await (await fetch(`http://127.0.0.1:${cdp}/json/new?${encodeURIComponent(`http://127.0.0.1:${port}/?seed=${seed}`)}`, { method: 'PUT' })).json();
	const { default: WebSocket } = await import('ws');
	const ws = new WebSocket(t.webSocketDebuggerUrl);
	let id = 0; const pending = new Map();
	ws.on('message', (raw) => { const m = JSON.parse(raw.toString()); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
	await new Promise((r) => ws.on('open', r));
	const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
	const run = async (expression) => {
		const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
		if (res.result?.exceptionDetails) throw new Error(String(res.result.exceptionDetails.exception?.description).slice(0, 300));
		return res.result?.result?.value;
	};
	for (let i = 0; i < 60; i++) { if (await run('!!window.lab').catch(() => false)) break; await sleep(150); }
	const ready = await run('!!window.lab');
	return { run, ready, close: () => ws.close() };
}

/*
The door tests prove the PLANNER's cascade and sweep reach the tab, so they clear the board's conduit
first. Since pipes count as references, a hand pipe legitimately holds a waypoint the sweep would
otherwise take -- a separate rule with its own test below, and mixing the two would let either one
hide a failure in the other.
*/
const CLEAR_CONDUIT = `lab.pipes.list().forEach((x) => lab.pipes.remove(x.a, x.b))`;

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
	} finally { p.close(); }
});

test('a delete through the door shows the planner\'s cascade and sweep in the tab', { skip: SKIP }, async () => {
	const p = await open('bend');
	try {
		await p.run(CLEAR_CONDUIT);
		// A `del` entry carries the whole ENTITY, not its id -- Changes needs it to build the undo.
		// delete node A. The tab alone would remove A and nothing else; the PLANNER also takes the link
		// whose end A was, and sweeps the bend that link left orphaned. Seeing those two in the tab is
		// the proof that the answer came back and was applied -- the defect was a door that did neither.
		await p.run(`lab.history.commit({ label: 'delete', entries: [{ op: 'del', kind: 'node', entity: lab.model.get('node', 'node-000001') }] })`);
		const c = await p.run(COUNTS);
		assert.equal(c.links, 0, `the planner's cascade never reached the tab: ${JSON.stringify(c)}`);
		assert.equal(c.waypoints, 0, `the planner's sweep never reached the tab: ${JSON.stringify(c)}`);
		assert.doesNotMatch(c.notice, /refused/, `the delete was refused: ${c.notice}`);
	} finally { p.close(); }
});

test('undo and redo work in the lab, as H17-D8 promises', { skip: SKIP }, async () => {
	const p = await open('bend');
	try {
		await p.run(CLEAR_CONDUIT);
		await p.run(`lab.history.commit({ label: 'delete', entries: [{ op: 'del', kind: 'node', entity: lab.model.get('node', 'node-000001') }] })`);
		await p.run('lab.history.undo()');
		let c = await p.run(COUNTS);
		assert.doesNotMatch(c.notice, /refused/, `undo was refused -- the defect this test was written for: ${c.notice}`);
		assert.deepEqual([c.nodes, c.waypoints, c.links], [2, 1, 1], `undo did not restore the board: ${JSON.stringify(c)}`);

		await p.run('lab.history.redo()');
		c = await p.run(COUNTS);
		assert.deepEqual([c.nodes, c.waypoints, c.links], [1, 0, 0], `redo did not re-apply the delete and its cascade: ${JSON.stringify(c)}`);
	} finally { p.close(); }
});

test('on the cross board, an unpinned link is drawn along its route through the bare centre', { skip: SKIP }, async () => {
	const p = await open('cross');
	try {
		// neither link pins the centre, yet the only conduit runs through it -- so each is drawn as
		// three points bending there, where a straight link would be two. This is what `g` stands on.
		const path_ = await p.run(`lab.model.pathOf(lab.model.get('link', 'link-000001'))`);
		assert.equal(path_.length, 3, `the link was drawn straight, not routed over the pipes: ${JSON.stringify(path_)}`);
		assert.deepEqual(path_[1], [0, 0], 'and its middle point is the centre anchor');
		assert.equal(await p.run(`lab.model.get('link', 'link-000001').via`), undefined, 'while the link itself pins nothing');
	} finally { p.close(); }
});

/*
THE COMPARE BOARD -- what the gesture actually decides, shown by a landing.

Left, both links PIN the centre (the `w` shape); right, both only PASS it over the conduit (the `g`
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
	} finally { p.close(); }
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
			assert.deepEqual(path_[1], [480, 0], `${id} still runs through the centre over the conduit`);
		}
	} finally { p.close(); }
});

/*
THE ROUTE HOOK -- `g`'s whole-route check and its conduit, in the page.
*/
test('the route hook refuses a guide the fewest-pipes route would skip, names it, and lays nothing', { skip: SKIP }, async () => {
	const p = await open('cross');
	try {
		const before = await p.run('lab.pipes.list().length');
		// A to B through C and D: three pipes, while A-centre-B over the conduit is two. The route
		// would ignore both guides, so committing it would draw a link that ignores what was drawn.
		const v = await p.run(`lab.routeHook({ src: 'node-000001', dst: 'node-000002', pins: [],
			guides: ['node-000003', 'node-000004'], stops: ['node-000001', 'node-000003', 'node-000004', 'node-000002'] })`);
		assert.equal(v.ok, false);
		assert.match(await p.run(`document.getElementById('lab-notice').textContent`), /node-000003/, 'the refusal names the skipped guide');
		assert.equal(await p.run('lab.pipes.list().length'), before, 'a refused route lays no conduit');
	} finally { p.close(); }
});

test('an accepted route lays its conduit only once the planner accepts the link, and the sweep takes it back', { skip: SKIP }, async () => {
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
	} finally { p.close(); }
});

test('conduit an author laid holds an anchor the sweep would take, and a pipe to a deleted anchor goes', { skip: SKIP }, async () => {
	const p = await open('bend');
	try {
		// bend: A -- w -- B, the link pinned at w, hand conduit A-w and w-B. Delete A: the planner takes
		// the link, and would sweep w as the bend it left -- but w still has hand conduit to B, so it is
		// structure, not debris (pipes count as references). The pipe A-w has lost an end, so it goes.
		await p.run(`lab.history.commit({ label: 'delete', entries: [{ op: 'del', kind: 'node', entity: lab.model.get('node', 'node-000001') }] })`);
		const c = await p.run(COUNTS);
		assert.equal(c.links, 0, 'the link went with its end');
		assert.equal(c.waypoints, 1, 'w survives: its hand conduit to B still references it');
		assert.deepEqual(await p.run(`lab.pipes.list().map((x) => [x.a, x.b].join('-'))`), ['node-000002-waypoint-000005'],
			'the pipe to the deleted node is pruned; the author\'s conduit to B remains');
	} finally { p.close(); }
});
