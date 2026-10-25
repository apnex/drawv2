/*
H26.2 (dev/design/components/INPUT-BINDING.md section 6.3, the first defect kept; B409) -- ONE PRESS FOR EVERY POINTER, SHOWN IN REAL
CHROME.

Facts carry no pointer id, so the session holds one press for every pointer, as the input state did: a second pointer's press
replaces the first's. During a live link drawn with the mouse, a touch contact -- a pointer of its own, its `button` 0, which the canvas
receives as pointer events (`touch-action: none`) -- presses, and the link, declaring button 0, takes that press; the contact lifts,
and its release, being button 0, commits the link where it lifted, the mouse button still down. The design read this from the code and
named a browser test to show it at H26.2, which keeps it exactly (B409): this is that test, on the product page served by its real
server, in headless Chrome launched through tests/fixtures/chrome.mjs. It passes against the code before the move as after it.
RESTATED at H26.5 (dev/design/components/RELEASES-0.2.md section 4, RD18): the facts carry a pointer id now and input-binding 0.2.0
tells another pointer's moves and release apart by it, but a second pointer's PRESS still replaces the first's -- B409, narrowed to
this case, which passes as before; the mouse's own release after it finds no press and commits nothing. The o:F4 case below shows the
narrowing: a pointer whose press the canvas never saw.
*/
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { teardown, spawnGroup } from './fixtures/teardown.mjs';
import { NO_CHROME, launchChrome } from './fixtures/chrome.mjs';
import { createTab, sleep } from './fixtures/matrix-runner.mjs';
import { productKinds } from '../product/kinds.mjs';

const root = path.resolve(import.meta.dirname, '..');
const free = () => new Promise((resolve) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
const DIAGRAM = '00000000006e0b09';
const doc = {
	meta: { id: DIAGRAM, name: 'two pointers', version: 1, schema: 3 }, layouts: structuredClone(productKinds().always.layout),
	nodes: [{ id: 'node-6e0b01', name: 'a', type: 'host', shape: 'square', x: -360, y: -120, order: 1 },
		{ id: 'node-6e0b02', name: 'b', type: 'host', shape: 'square', x: 360, y: -120, order: 2 }],
	links: [], pipes: [], zones: [], groups: [], selection: [],
};
let dir, procs = [], port, cdp, theTab;

before(async () => {
	if (NO_CHROME) return;
	dir = fs.mkdtempSync(path.join(os.tmpdir(), 'input-binding-browser-'));
	fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
	fs.writeFileSync(path.join(dir, 'data', `${DIAGRAM}.json`), JSON.stringify(doc));
	[port, cdp] = [await free(), await free()];
	procs.push(spawnGroup('node', ['server/server.js'], { cwd: root, env: { PATH: process.env.PATH, HOME: process.env.HOME, PORT: String(port), DATA_DIR: path.join(dir, 'data') }, stdio: 'ignore' }));
	for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) break; } catch { /* not up */ } await sleep(100); }
	procs.push(launchChrome({ cdpPort: cdp, profileDir: path.join(dir, 'profile'), url: 'about:blank' }));
	for (let i = 0; i < 80; i++) { try { await (await fetch(`http://127.0.0.1:${cdp}/json/version`)).json(); break; } catch { await sleep(200); } }
	theTab = createTab(cdp);
});
after(() => teardown(procs, dir));

test('H26.2 (B409 kept): during a link drawn with the mouse, a touch contact\'s press is taken by it, and its release commits the link where it lifted', { skip: NO_CHROME, timeout: 60000 }, async () => {
	const t = await theTab();
	await t.send('Page.navigate', { url: `http://127.0.0.1:${port}/${DIAGRAM}` });
	for (let i = 0; i < 150 && !(await t.run(`!!(window.draw && window.draw.renderer && document.querySelectorAll('#nodes > g').length === 2)`).catch(() => false)); i++) await sleep(100);
	await t.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
	await sleep(300);
	await t.run(`(() => { window.__downs = []; document.addEventListener('pointerdown', (e) => window.__downs.push([e.pointerType, e.pointerId, e.button]), true); return true; })()`);
	const [a, e, f] = await t.run(`(() => { const m = document.getElementById('container').getScreenCTM(); return [m.a, m.e, m.f]; })()`);
	const at = (x, y) => ({ x: x * a + e, y: y * a + f });
	const mouse = (type, p, buttons) => t.send('Input.dispatchMouseEvent', { type, ...p, button: 'left', buttons, clickCount: type === 'mouseMoved' ? 0 : 1 });
	await mouse('mousePressed', at(-360, -120), 1); await sleep(60);
	await mouse('mouseMoved', at(0, -120), 1); await sleep(60);
	await mouse('mouseMoved', at(120, 60), 1); await sleep(60);
	assert.equal(await t.run('window.draw.input.isGesturing()'), true, 'the link is live, drawn by the mouse');
	await t.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...at(360, -120), id: 7 }] }); await sleep(80);
	await t.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(300);
	const afterTouch = await t.run(`JSON.stringify({ links: window.draw.model.all('link').map((l) => [window.draw.model.get('node', l.src)?.name, window.draw.model.get('node', l.dst)?.name]), live: window.draw.input.isGesturing(), downs: window.__downs })`);
	await mouse('mouseReleased', at(120, 60), 0); await sleep(500);
	const got = JSON.parse(afterTouch);
	assert.deepEqual(got.downs.map(([type, , button]) => [type, button]), [['mouse', 0], ['touch', 0]], 'two pointers pressed: the mouse, then a touch contact, both button 0');
	assert.notEqual(got.downs[0][1], got.downs[1][1], 'each its own pointer');
	assert.deepEqual(got.links, [['a', 'b']], 'the contact\'s release committed the link at b, where it lifted, the mouse button still down');
	assert.equal(got.live, false, 'and the link drag ended with it');
	const stored = await (await fetch(`http://127.0.0.1:${port}/api/v1/diagrams/${DIAGRAM}`)).json();
	assert.equal(stored.links.length, 1, 'the mouse\'s own release, after, committed nothing more');
	assert.deepEqual(t.thrown, [], 'nothing threw');
});

/*
H26.5 (dev/design/components/RELEASES-0.2.md section 4, o:F4; RD18) -- ANOTHER POINTER'S MOVE AND RELEASE CHANGE NOTHING, IN REAL CHROME.
The mouse pressed on the footer, beyond the canvas, so the canvas never sees its press; a touch contact presses a and drags, opening a
link; the mouse moves over the canvas and is released over b. Chrome names each pointer by its own `pointerId`, which capture hands
Input (app/src/capture.js), and input-binding 0.2.0 tells the mouse's move and release apart from the press the touch holds: the link
stays live, its press with it, and the touch's own lift over b commits it. Under input-binding 0.1.0 the mouse's release committed the
link where the mouse lifted -- this test fails there, at the link drag still live.
*/
test('H26.5 (o:F4, RD18): a mouse pressed beyond the canvas and released over it while a touch draws a link commits nothing; the touch\'s lift commits the link', { skip: NO_CHROME, timeout: 60000 }, async () => {
	const t = await theTab();
	await t.send('Page.navigate', { url: `http://127.0.0.1:${port}/${DIAGRAM}` });
	for (let i = 0; i < 150 && !(await t.run(`!!(window.draw && window.draw.renderer && document.querySelectorAll('#nodes > g').length === 2)`).catch(() => false)); i++) await sleep(100);
	await t.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
	await sleep(300);
	await t.run(`(() => { window.__ups = []; document.addEventListener('pointerup', (e) => window.__ups.push([e.pointerType, e.pointerId, e.target?.closest?.('#container') ? 'canvas' : 'beyond']), true); return true; })()`);
	const links = () => t.run(`JSON.stringify(window.draw.model.all('link').map((l) => [window.draw.model.get('node', l.src)?.name, window.draw.model.get('node', l.dst)?.name]))`).then(JSON.parse);
	// the board as the file found it: the test before leaves a link a to b, which a second would not be drawn beside
	await t.run(`(() => { const ls = window.draw.model.all('link'); if (ls.length) window.draw.history.commit({ label: 'clear', entries: ls.map((l) => ({ op: 'del', kind: 'link', entity: { ...l } })) }); return true; })()`);
	for (let i = 0; i < 60 && !(await t.run('window.draw.sync.outbox.every((m) => m.answered)')); i++) await sleep(100);
	const before = await links();
	assert.deepEqual(before, [], 'precondition: no link on the board');
	const [a, e, f] = await t.run(`(() => { const m = document.getElementById('container').getScreenCTM(); return [m.a, m.e, m.f]; })()`);
	const at = (x, y) => ({ x: x * a + e, y: y * a + f });
	const footer = await t.run(`(() => { const r = document.getElementById('status').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
	const mouse = (type, p, buttons) => t.send('Input.dispatchMouseEvent', { type, ...p, button: 'left', buttons, clickCount: type === 'mouseMoved' ? 0 : 1 });
	const touch = (type, p) => t.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ ...p, id: 7 }] : [] });

	await mouse('mousePressed', footer, 1); await sleep(60);                 // beyond the canvas
	await touch('touchStart', at(-360, -120)); await sleep(80);
	await touch('touchMove', at(-120, -60)); await sleep(80);
	await touch('touchMove', at(0, 0)); await sleep(80);
	assert.equal(await t.run('window.draw.input.isGesturing()'), true, 'precondition: the touch opened the link drag');
	await mouse('mouseMoved', at(240, -120), 1); await sleep(60);             // the mouse, its button held, over the canvas
	await mouse('mouseMoved', at(360, -120), 1); await sleep(60);
	await mouse('mouseReleased', at(360, -120), 0); await sleep(300);        // and released over b
	const mid = await t.run(`JSON.stringify({ live: window.draw.input.isGesturing(), ups: window.__ups })`).then(JSON.parse);
	assert.deepEqual(mid.ups.map(([type, , where]) => [type, where]), [['mouse', 'canvas']], 'precondition: the mouse\'s release reached the canvas');
	assert.equal(mid.live, true, 'the mouse\'s release, another pointer\'s, ended nothing: the link drag is still live');
	assert.deepEqual(await links(), before, 'and committed nothing');

	await touch('touchMove', at(360, -120)); await sleep(80);
	await touch('touchEnd'); await sleep(400);
	const ups = await t.run('JSON.stringify(window.__ups)').then(JSON.parse);
	assert.notEqual(ups[0][1], ups[1][1], 'each its own pointer, as Chrome named them');
	assert.deepEqual(await links(), [['a', 'b']], 'the touch\'s lift committed the link a to b');
	assert.equal(await t.run('window.draw.input.isGesturing()'), false, 'and the link drag ended with it');
	assert.deepEqual(t.thrown, [], 'nothing threw');
});
