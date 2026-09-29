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
