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
STOPGAP, removed by X-c (H18.39): the rows held on the page so far -- one taking each step the matrix uses (click, key, move,
drag, settle, undo, redo, shiftClick), and one judging the notice. X-c runs every row and deletes this list.
`PAGE_MATRIX_ONLY=<id,id>` narrows a run by hand; `PAGE_MATRIX_ALL=1` runs every row, as X-c will by default.
*/
const HELD_SO_FAR = ['DEL-01', 'DEL-04', 'HEAL-01', 'HEAL-05', 'CAP-06', 'UNDO-03', 'TRN-05'];
const only = process.env.PAGE_MATRIX_ONLY?.split(',') ?? (process.env.PAGE_MATRIX_ALL === '1' ? null : HELD_SO_FAR);

matrixTests({ test, name: 'page matrix', skip: SKIP, corpus: CORPUS, driver: { open, theTab, prelude: PAGE_PRELUDE, only } });
