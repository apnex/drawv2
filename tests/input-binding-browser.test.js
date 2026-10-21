/*
H26.2 (dev/design/components/INPUT-BINDING.md section 6.3, the first defect kept; B409) -- ONE PRESS FOR EVERY POINTER, SHOWN IN REAL
CHROME.

Facts carry no pointer id, so the session holds one press for every pointer, as the input state did: a second pointer's press
replaces the first's. During a live link drawn with the mouse, a touch contact -- a pointer of its own, its `button` 0, which the canvas
receives as pointer events (`touch-action: none`) -- presses, and the link, declaring button 0, takes that press; the contact lifts,
and its release, being button 0, commits the link where it lifted, the mouse button still down. The design read this from the code and
named a browser test to show it at H26.2, which keeps it exactly (B409): this is that test, on the product page served by its real
server, in headless Chrome launched through tests/fixtures/chrome.mjs. It passes against the code before the move as after it.
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
