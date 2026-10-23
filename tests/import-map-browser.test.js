/*
H26.1 (dev/design/components/SNAP-GRID.md section 7.6, "Proved by") -- THE PAGES LOAD THROUGH THEIR IMPORT MAP, IN REAL CHROME.

The product page and the lab page, each served by its real server from this tree, loaded in headless Chrome with a profile of its own
(tests/fixtures/chrome.mjs): every module request is answered 200, the page boots, and its one import map resolves the component's
names -- each export the map names asked through the page's own resolution and answered 200 from the vendor mount, the component
working once loaded. No page imports the component yet (the arithmetic moves onto it later in H26.1), so the test asks for it the
way a module of the page will: by its bare name, which only the map can resolve.
AMENDED H26.2 (dev/design/components/INPUT-BINDING.md acceptance step 7): both pages load both components with themselves now --
snap-grid through the lattice, input-binding through the rules part -- each graph answered 200 from the vendor mount, and each export
of both resolved by name and working, input-binding deciding an exact travel in Chrome.
AMENDED H26.3 (dev/design/components/INPUT-CAPTURE.md acceptance step 7): and the third, input-capture, resolved by its one name and
working in Chrome -- a capture opened on an element of the page, a constructed pointer event and key event dispatched on it made into
facts, the page refusing the synthetic pointer so takePointer answers false, and nothing made once closed.
AMENDED H26.4 (dev/design/components/VECTOR-SCENE.md acceptance step 7): and the fourth, vector-scene, resolved by its one name and
working in Chrome -- a scene opened on an <svg> of the page, an item put and the element of one of its shapes mapped back to it, a
screen point converted through the root's screen transform and back, and the root left as found once closed.
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
const binding = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/@apnex/input-binding/package.json'), 'utf8')).version;   // H26.2
const capture = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/@apnex/input-capture/package.json'), 'utf8')).version;   // H26.3
const scene = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/@apnex/vector-scene/package.json'), 'utf8')).version;   // H26.4
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
	// H26.2: the second component, by its one name -- a session decides a travel of exactly the threshold a click, one step past it a drop
	const ib = await import('@apnex/input-binding');
	const session = ib.openGestureSession({ threshold: 4, gestures: [] }).session;
	const exact = [4, 4 + 2 ** -50].map((x) => { session.pointerDown({ at: { x: 0, y: 0 }, button: 0 }); session.pointerMove({ at: { x, y: 0 } }); return session.pointerUp({ button: 0 }).trigger; });
	// H26.3: the third, by its one name -- a capture on an element of the page, whose constructed events become facts, a claim prevents
	// the default, the page refuses the synthetic pointer, and a closed capture makes nothing
	const ic = await import('@apnex/input-capture');
	const el = document.createElement('div');
	document.body.append(el);
	const facts = [], taken = [];
	const capture = ic.openCapture({ surface: el, keys: el, toDrawing: (s) => ({ x: s.x / 2, y: s.y / 2 }), hit: (t) => t === el, focus: (t) => t === el,
		deliver: (fact, reply) => { facts.push(fact); if (fact.type === 'down') taken.push(reply.takePointer()); if (fact.type === 'key-down') reply.claim(); } });
	el.dispatchEvent(new PointerEvent('pointerdown', { clientX: 10, clientY: 20, button: 0, buttons: 1, pointerId: 7, pointerType: 'mouse', shiftKey: true }));
	const kd = new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', cancelable: true });
	el.dispatchEvent(kd);
	capture.capture.close();
	el.dispatchEvent(new PointerEvent('pointermove', { clientX: 1, clientY: 1 }));
	el.remove();
	const cap = { exports: Object.keys(ic).sort(), facts: facts.map((f) => [f.type, f.at, f.screen, f.hit, f.focus, f.button, f.pointerId, f.pointerType, f.key, f.code, f.shiftKey, Object.isFrozen(f)]),
		taken, prevented: kd.defaultPrevented };
	// H26.4: the fourth, by its one name -- a scene on an <svg> of the page, 200 px showing 100 units: an item put, the element of its
	// nested shape mapped back to it, a screen point converted and back, and the root left as found once closed
	const vs = await import('@apnex/vector-scene');
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.setAttribute('viewBox', '0 0 100 100');
	svg.style.cssText = 'position: fixed; left: 0; top: 0; width: 200px; height: 200px; margin: 0; padding: 0; border: 0';
	document.body.append(svg);
	const sc = vs.openScene({ root: svg, layers: [{ name: 'shown', attrs: { id: 'vs-shown' } }, { name: 'drawn', foreign: true }] }).scene;
	sc.put('shown', 'item', [{ tag: 'rect', attrs: { x: 1, y: 2, width: 3, height: 4 } }, { tag: 'g', children: [{ tag: 'circle', attrs: { r: 5 } }] }]);
	const drawing = sc.toDrawing({ x: 20, y: 40 });
	const shown = { exports: Object.keys(vs).sort(), item: sc.itemOf(svg.querySelector('#vs-shown circle')), layers: [...svg.children].map((c) => c.getAttribute('id')),
		elements: svg.querySelector('#vs-shown').children.length, drawing, back: sc.toScreen(drawing) };
	sc.close();
	shown.left = svg.children.length;
	svg.remove();
	return { maps: maps.length, ok: opened.ok, point: opened.grid.pointOf(opened.grid.nearest({ x: 61, y: 29 })), kit: kit.checkGridShape(grid.square, []).length,
		binding: Object.keys(ib).sort(), exact, capture: cap, scene: shown };
})()`;

for (const [name, at, booted] of [['the product page', () => `http://127.0.0.1:${port}/`, '!!(window.draw && window.draw.renderer)'], ['the lab page', () => `http://127.0.0.1:${labPort}/?seed=bend`, '!!window.lab']]) {
	test(`H26.1, H26.2, H26.3, H26.4: ${name} loads every module answered 200, and its import map resolves each export of all four components from the vendor mount`, { skip: NO_CHROME, timeout: 60000 }, async () => {
		const { t, answered } = await load(at(), booted);
		const modules = answered().filter((r) => r.type === 'Script');
		assert.ok(modules.length > 40, `the page's module graph was loaded, not ${modules.length} script(s)`);
		assert.deepEqual(modules.filter((r) => r.status !== 200), [], 'every module request answered 200');
		assert.deepEqual(t.thrown, [], 'nothing failed while it loaded');
		const mark = Date.now() - t.clock.t0;
		const got = await t.run(THROUGH_THE_MAP);
		const capturing = { exports: ['openCapture'], taken: [false], prevented: true,
			facts: [['down', { x: 5, y: 10 }, { x: 10, y: 20 }, true, null, 0, 7, 'mouse', null, null, true, true], ['key-down', null, null, null, true, null, null, null, 'a', 'KeyA', false, true]] };
		// H26.4: the scene's item, its nested shape at path [1, 0]; a 200 px root over 100 units halves a screen point, and doubles it back
		const showing = { exports: ['openScene'], item: { layer: 'shown', key: 'item', path: [1, 0] }, layers: ['vs-shown', null], elements: 2, drawing: { x: 10, y: 20 }, back: { x: 20, y: 40 }, left: 0 };
		assert.deepEqual(got, { maps: 1, ok: true, point: { x: 60, y: 0 }, kit: 0, binding: ['composeBindingTable', 'openGestureSession'], exact: ['click', 'drop'], capture: capturing, scene: showing },
			'one map; each export of the four components resolved by name, and working -- the exact travel decided in Chrome, BigInt and all; a real event made a fact; a shape shown and found');
		await sleep(200);
		/*
		RESTATED at H26.1's move (SNAP-GRID.md sections 5 and 7.6): the kernel composes the component, so the page loads its entry while
		it boots, through the map, and a module loaded once is not asked again -- the entry is among the page's own requests, and the kit,
		which no page module imports, is asked of the vendor mount when the check imports it by name.
		*/
		const ownVendored = modules.filter((r) => r.url.startsWith('/vendor/'));
		assert.ok(ownVendored.some((r) => r.url === `/vendor/@apnex/snap-grid@${version}/index.js` && r.status === 200), `index.js loaded with the page from the vendor mount and answered 200: ${JSON.stringify(ownVendored)}`);
		// RESTATED at H26.2's move: the rules part composes input-binding, so it too loads with the page, its whole graph from the mount
		const bindingFiles = ownVendored.filter((r) => r.url.startsWith(`/vendor/@apnex/input-binding@${binding}/`));
		assert.ok(bindingFiles.some((r) => r.url.endsWith('/index.js')) && bindingFiles.length >= 6 && bindingFiles.every((r) => r.status === 200),
			`input-binding's graph loaded with the page from the vendor mount, every file answered 200: ${JSON.stringify(bindingFiles)}`);
		const vendored = answered(mark).filter((r) => r.url.startsWith('/vendor/'));
		assert.ok(vendored.some((r) => r.url === `/vendor/@apnex/snap-grid@${version}/conformance.js` && r.status === 200), `conformance.js asked of the vendor mount and answered 200: ${JSON.stringify(vendored)}`);
		// RESTATED at H26.3's move: the canvas part composes input-capture, so it too loads with the page, its whole graph from the mount
		const captureFiles = ownVendored.filter((r) => r.url.startsWith(`/vendor/@apnex/input-capture@${capture}/`));
		assert.ok(captureFiles.some((r) => r.url.endsWith('/index.js')) && captureFiles.length >= 7 && captureFiles.every((r) => r.status === 200),
			`input-capture's graph loaded with the page from the vendor mount, every file answered 200: ${JSON.stringify(captureFiles)}`);
		// RESTATED at H26.4's move: the renderer part composes vector-scene, so it too loads with the page, its whole graph from the mount
		const sceneFiles = ownVendored.filter((r) => r.url.startsWith(`/vendor/@apnex/vector-scene@${scene}/`));
		assert.ok(sceneFiles.some((r) => r.url.endsWith('/index.js')) && sceneFiles.length >= 6 && sceneFiles.every((r) => r.status === 200),
			`vector-scene's graph loaded with the page from the vendor mount, every file answered 200: ${JSON.stringify(sceneFiles)}`);
		assert.deepEqual(vendored.filter((r) => r.status !== 200), [], 'and every module it imports in turn');
		assert.ok(ownVendored.length + vendored.length >= 4, `the component's own module graph came with it: ${ownVendored.length + vendored.length} request(s)`);
		assert.deepEqual(t.thrown, [], 'nothing failed after');
	});
}
