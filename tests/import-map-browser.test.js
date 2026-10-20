/*
H26.1 (dev/design/components/SNAP-GRID.md section 7.6, "Proved by") -- THE PAGES LOAD THROUGH THEIR IMPORT MAP, IN REAL CHROME.

The product page and the lab page, each served by its real server from this tree, loaded in headless Chrome with a profile of its own
(tests/fixtures/chrome.mjs): every module request is answered 200, the page boots, and its one import map resolves the component's
names -- each export the map names asked through the page's own resolution and answered 200 from the vendor mount, the component
working once loaded. No page imports the component yet (the arithmetic moves onto it later in H26.1), so the test asks for it the
way a module of the page will: by its bare name, which only the map can resolve.
*/
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { teardown, spawnGroup } from './fixtures/teardown.mjs';
import { NO_CHROME, launchChrome } from './fixtures/chrome.mjs';   // one launch config for every harness, a profile of this file's own
import { createTab, sleep } from './fixtures/matrix-runner.mjs';   // the one-tab client, recording every request and its answer

const root = path.resolve(import.meta.dirname, '..');
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/@apnex/snap-grid/package.json'), 'utf8'));
const free = () => new Promise((resolve) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
let dir, procs = [], port, labPort, cdp, theTab;

before(async () => {
	if (NO_CHROME) return;
	dir = fs.mkdtempSync(path.join(os.tmpdir(), 'import-map-browser-'));
	[port, labPort, cdp] = [await free(), await free(), await free()];
	const env = { PATH: process.env.PATH, HOME: process.env.HOME };
	procs.push(spawnGroup('node', ['server/server.js'], { cwd: root, env: { ...env, PORT: String(port), DATA_DIR: path.join(dir, 'data') }, stdio: 'ignore' }));
	procs.push(spawnGroup('node', ['lab/server.mjs'], { cwd: root, env: { ...env, PORT: String(labPort) }, stdio: 'ignore' }));
	for (const p of [port, labPort]) for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${p}/health`)).ok) break; } catch { /* not up */ } await sleep(100); }
	procs.push(launchChrome({ cdpPort: cdp, profileDir: path.join(dir, 'profile'), url: 'about:blank' }));
	for (let i = 0; i < 80; i++) { try { await (await fetch(`http://127.0.0.1:${cdp}/json/version`)).json(); break; } catch { await sleep(200); } }
	theTab = createTab(cdp);
});
after(() => teardown(procs, dir));

// load a page in the one tab, wait for it to boot, and hand back every request it made with its answer
async function load(url, booted) {
	const t = await theTab();
	t.thrown.length = 0; t.timeline.length = 0; t.clock.t0 = Date.now();
	await t.send('Page.navigate', { url });
	for (let i = 0; i < 150 && !(await t.run(booted).catch(() => false)); i++) await sleep(100);
	assert.equal(await t.run(booted), true, `${url} never booted: ${JSON.stringify(t.thrown)}`);
	await sleep(300);
	const answered = (at) => {
		const status = new Map(t.timeline.filter((e) => e.ev === 'response').map((e) => [e.id, e.status]));
		return t.timeline.filter((e) => e.ev === 'request' && (!at || e.at >= at)).map((e) => ({ url: e.url, type: e.type, status: status.get(e.id) ?? 'none' }));
	};
	return { t, answered };
}

// what the page's own resolution makes of the component's names: each export imported by name, through the map
const THROUGH_THE_MAP = `(async () => {
	const maps = document.querySelectorAll('script[type="importmap"]');
	const grid = await import('@apnex/snap-grid');
	const kit = await import('@apnex/snap-grid/conformance');
	const opened = grid.openGrid({ shape: 'square', pitch: 60, origin: { x: 0, y: 0 } });
	return { maps: maps.length, ok: opened.ok, point: opened.grid.pointOf(opened.grid.nearest({ x: 61, y: 29 })), kit: kit.checkGridShape(grid.square, []).length };
})()`;

for (const [name, at, booted] of [['the product page', () => `http://127.0.0.1:${port}/`, '!!(window.draw && window.draw.renderer)'], ['the lab page', () => `http://127.0.0.1:${labPort}/?seed=bend`, '!!window.lab']]) {
	test(`H26.1: ${name} loads every module answered 200, and its import map resolves each export of the component from the vendor mount`, { skip: NO_CHROME, timeout: 60000 }, async () => {
		const { t, answered } = await load(at(), booted);
		const modules = answered().filter((r) => r.type === 'Script');
		assert.ok(modules.length > 40, `the page's module graph was loaded, not ${modules.length} script(s)`);
		assert.deepEqual(modules.filter((r) => r.status !== 200), [], 'every module request answered 200');
		assert.deepEqual(t.thrown, [], 'nothing failed while it loaded');
		const mark = Date.now() - t.clock.t0;
		const got = await t.run(THROUGH_THE_MAP);
		assert.deepEqual(got, { maps: 1, ok: true, point: { x: 60, y: 0 }, kit: 0 }, 'one map; both exports resolved by name, and working');
		await sleep(200);
		/*
		RESTATED at H26.1's move (SNAP-GRID.md sections 5 and 7.6): the kernel composes the component, so the page loads its entry while
		it boots, through the map, and a module loaded once is not asked again -- the entry is among the page's own requests, and the kit,
		which no page module imports, is asked of the vendor mount when the check imports it by name.
		*/
		const ownVendored = modules.filter((r) => r.url.startsWith('/vendor/'));
		assert.ok(ownVendored.some((r) => r.url === `/vendor/@apnex/snap-grid@${version}/index.js` && r.status === 200), `index.js loaded with the page from the vendor mount and answered 200: ${JSON.stringify(ownVendored)}`);
		const vendored = answered(mark).filter((r) => r.url.startsWith('/vendor/'));
		assert.ok(vendored.some((r) => r.url === `/vendor/@apnex/snap-grid@${version}/conformance.js` && r.status === 200), `conformance.js asked of the vendor mount and answered 200: ${JSON.stringify(vendored)}`);
		assert.deepEqual(vendored.filter((r) => r.status !== 200), [], 'and every module it imports in turn');
		assert.ok(ownVendored.length + vendored.length >= 4, `the component's own module graph came with it: ${ownVendored.length + vendored.length} request(s)`);
		assert.deepEqual(t.thrown, [], 'nothing failed after');
	});
}
