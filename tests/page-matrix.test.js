/*
THE BEHAVIOUR MATRIX ON THE PRODUCT PAGE -- P7 (H18.38 to H18.40; dev/design/unification/PAGE-HELD-TO-MATRIX.md; ruled L1, L2).

The lab's runner (tests/fixtures/matrix-runner.mjs) driving the PRODUCT page against a real server: each row's board is a
diagram on the server, committed through REST as the lab commits its seed through its planner; the page opens it at
`/d/<id>`; real mouse and key input drives the page's gesture machine; and the row is held to the LAB'S OWN record (L1) --
one corpus, never written from here. What differs is the page's own nature, named in the prelude and nowhere else: the
authority is the server's document, read through REST, and the notice is the header banner (J3). A step settles when the
page's outbox is answered, since the planner is across a socket rather than in the page.
*/
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { teardown, spawnGroup } from './fixtures/teardown.mjs';
import { NO_CHROME, launchChrome } from './fixtures/chrome.mjs';
import { createTab, inputOf, matrixTests, sleep } from './fixtures/matrix-runner.mjs';
import { pipeEntity } from '../network/pipe-kind.mjs';

const SKIP = NO_CHROME;
const root = path.resolve(import.meta.dirname, '..');
const SEEDS = JSON.parse(fs.readFileSync(path.join(root, 'lab/seeds.json'), 'utf8'));
const CORPUS = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/matrix-corpus.json'), 'utf8'));
let dir, srv, chrome, port, cdp, nonce = 0;
const api = (p, init) => fetch(`http://127.0.0.1:${port}/api/v1${p}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });

before(async () => {
	if (SKIP) return;
	dir = fs.mkdtempSync(path.join(os.tmpdir(), 'page-matrix-'));
	port = 8600 + (process.pid % 200);
	cdp = 9200 + (process.pid % 200);
	srv = spawnGroup('node', ['server/server.js'], { cwd: root, env: { ...process.env, DATA_DIR: dir, PORT: String(port) }, stdio: 'ignore' });
	for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) break; } catch { /* not up yet */ } await sleep(200); }
	chrome = launchChrome({ cdpPort: cdp, profileDir: `${dir}/cdp`, url: 'about:blank' });
	for (let i = 0; i < 80; i++) { try { await (await fetch(`http://127.0.0.1:${cdp}/json/version`)).json(); break; } catch { await sleep(200); } }
});
after(() => teardown([chrome, srv], dir));

const theTab = createTab(() => cdp);

// a row's board, as a diagram on the server: the seed's ops and pipes in ONE commit, as the lab seeds it, so its links are aged alike
async function diagramOf(board) {
	const { id } = await (await api('/diagrams', { method: 'POST', body: JSON.stringify({ name: board || 'empty' }) })).json();
	const seed = SEEDS[board];
	if (board && !seed) throw new Error(`no seed board "${board}" in lab/seeds.json`);   // '' is the empty board; any other name must exist
	if (seed) {
		const { token } = await (await api(`/diagrams/${id}/lock`, { method: 'POST' })).json();
		const ops = [...seed.ops, ...seed.pipes.filter(([a, b]) => a !== b).map(([a, b, laid]) => ({ op: 'put', kind: 'pipe', entity: pipeEntity(a, b, laid) }))];
		const r = await api(`/diagrams/${id}/commit`, { method: 'POST', headers: { 'X-Draw-Lock': token }, body: JSON.stringify({ ops, label: `seed ${board}` }) });
		if (r.status !== 200) throw new Error(`seed ${board} refused by the server: ${await r.text()}`);
		await api(`/diagrams/${id}/lock`, { method: 'DELETE', headers: { 'X-Draw-Lock': token } });
	}
	return id;
}

async function open(board) {
	const t = await theTab();
	t.thrown.length = 0;
	const id = await diagramOf(board);
	const n = ++nonce;
	await t.send('Page.navigate', { url: `http://127.0.0.1:${port}/d/${id}?n=${n}` });
	const ready = `location.search.includes('n=${n}') && !!window.draw && window.draw.sync.hydrated && window.draw.model.state.meta.id === '${id}'`;
	for (let i = 0; i < 100; i++) { if (await t.run(ready).catch(() => false)) break; await sleep(150); }
	if (!(await t.run(ready).catch(() => false))) throw new Error(`the product page never opened ${id} (${board}): ${JSON.stringify(t.thrown)}`);
	await t.run('window.draw.input.setReadOnly(false), 1');
	return {
		run: t.run, close: async () => {}, ...inputOf(t),
		undo: () => t.run('window.draw.history.undo()'),
		redo: () => t.run('window.draw.history.redo()'),
		// until every request the page sent is answered, and the board has settled after it
		settle: async () => {
			await sleep(150);
			for (let i = 0; i < 60; i++) { if (await t.run('window.draw.sync.outbox.every((m) => m.answered)')) break; await sleep(50); }
			await sleep(150);
		},
	};
}

// the product page as `H`: its tab, its network and its input; the authority read from the server; the notice from the banner
const PAGE_PRELUDE = `const id = location.pathname.split('/').pop();
	const doc = await (await fetch('/api/v1/diagrams/' + id)).json();
	const H = { model: window.draw.model, network: window.draw.network, input: window.draw.input,
		authority: { all: (k) => doc[k + 's'] ?? [] }, notice: () => document.getElementById('banner').textContent };`;

/*
SETTLE WAITS FOR THE SERVER'S ANSWER, not for a fixed time. On a local server the answer lands before the snapshot reads, so
no row can show that `settle` waits; here the page's socket is slowed in the page, 600 ms a send, and a delete must still
be read as the server's answer: the outbox answered, and the server's document agreeing with the tab.
*/
test('page matrix: a step settles when the server has answered, however slow the answer', { skip: SKIP }, async () => {
	const p = await open('cross');   // the state routed's board: two links through one anchor, which a click at its centre selects
	await p.run(`(() => { const net = window.draw.net, send = net.send.bind(net); net.send = (c, b) => { setTimeout(() => send(c, b), 600); return true; }; return 1; })()`);
	const before = await p.run(`window.draw.model.all('node').length`);
	await p.click(0, 0);
	await p.key('Delete');
	await p.settle();
	const got = await p.run(`(async () => { const doc = await (await fetch('/api/v1/diagrams/' + location.pathname.split('/').pop())).json();
		const ids = (xs) => xs.map((e) => e.id).sort().join(',');
		return { answered: window.draw.sync.outbox.every((m) => m.answered), nodes: window.draw.model.all('node').length,
			tab: ids(window.draw.model.all('node')), server: ids(doc.nodes) }; })()`);
	assert.equal(got.nodes, before - 1, 'the anchor was deleted');
	assert.equal(got.answered, true, 'every request answered');
	assert.equal(got.server, got.tab, 'and the server holds what the tab shows: the delete arrived before the read');
});

/*
B294 -- a redo pressed before its undo is answered is redone, on the product page against a real server. Pressed in the same
tick, the redo is certain to leave while the undo is on the wire; before the fix the server refused it, every time, and the
page said nothing. UNDO-03 caught it one run in three, its keys only nearly as close.
*/
test('page matrix: B294 -- a redo pressed while its undo is on the wire is redone', { skip: SKIP }, async () => {
	const p = await open('');
	const got = await p.run(`(async () => {
		const d = window.draw, n = d.model.makeNode('host', { x: 0, y: 0 });
		d.history.commit({ label: 'put', entries: [{ op: 'put', kind: 'node', entity: n }] });
		for (let i = 0; i < 40 && !d.sync.outbox.every((m) => m.answered); i++) await new Promise((r) => setTimeout(r, 50));
		d.history.undo(); d.history.redo();
		for (let i = 0; i < 40 && !d.sync.outbox.every((m) => m.answered); i++) await new Promise((r) => setTimeout(r, 50));
		const doc = await (await fetch('/api/v1/diagrams/' + location.pathname.split('/').pop())).json();
		return { tab: d.model.all('node').length, server: doc.nodes.length, banner: document.getElementById('banner').textContent };
	})()`);
	assert.deepEqual({ tab: got.tab, server: got.server }, { tab: 1, server: 1 }, `the node is back on the tab and the server (the banner says "${got.banner}")`);
	assert.doesNotMatch(got.banner, /conflict|moved on/, 'and nothing was refused');
});

/*
B298 -- the network's notice stays in the banner through state emits that have nothing to do with it, and gives way to the
undo offer (D21) when someone else's change lands on top of the log: an older notice must never hide that Ctrl+Z would now
reverse another writer's work.
*/
test('page matrix: B298 -- the network\'s notice survives an unrelated emit, and yields to another writer\'s change', { skip: SKIP }, async () => {
	const p = await open('cross');
	const banner = `document.getElementById('banner').textContent`;
	await p.click(0, 0);
	await p.key('Delete');
	await p.settle();
	const said = await p.run(banner);
	assert.match(said, /^v\d+ delete/, 'the network said what the delete did');
	await p.run(`window.draw.sync.onMessage({ cmd: 'agents', body: { agents: [] } }), window.draw.sync.onMessage({ cmd: 'viewers', body: { viewers: [] } }), 1`);
	assert.equal(await p.run(banner), said, 'an agents and a viewers emit leave it where it was');
	const id = await p.run(`location.pathname.split('/').pop()`);
	const { token } = await (await api(`/diagrams/${id}/lock`, { method: 'POST' })).json();
	await api(`/diagrams/${id}/commit`, { method: 'POST', headers: { 'X-Draw-Lock': token }, body: JSON.stringify({ ops: [{ op: 'set', kind: 'node', id: 'node-000001', patch: { name: 'renamed' } }], label: 'rename' }) });
	await api(`/diagrams/${id}/lock`, { method: 'DELETE', headers: { 'X-Draw-Lock': token } });
	for (let i = 0; i < 40 && !(await p.run(banner)).startsWith('↶'); i++) await sleep(50);
	assert.match(await p.run(banner), /^↶ Ctrl\+Shift\+Backspace undoes 1 change by rest-/, 'another writer on top of the log: the undo offer, not the older notice');
});

// every row, on the product page (X-c, H18.39): `PAGE_MATRIX_ONLY=<id,id>` narrows a run by hand
const only = process.env.PAGE_MATRIX_ONLY?.split(',') ?? null;

matrixTests({ test, name: 'page matrix', skip: SKIP, corpus: CORPUS, driver: { open, theTab, prelude: PAGE_PRELUDE, only } });
