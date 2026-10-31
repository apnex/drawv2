/*
H26.1 (dev/design/components/SNAP-GRID.md section 9, A9; section 7.6 "A deploy in flight"; D7; B403) -- A DEPLOY UNDER A PAGE, IN
REAL CHROME: WHAT A PAGE REACHED BY BACK, A RESTORED SESSION AND A COLD LOAD IN FLIGHT EACH DO WHEN THE COMPONENT'S VERSION CHANGES.

D7 lets the browser keep a component's files a year, marked immutable, on two conditions: draw's own files and the page holding the
import map stay `no-store`, so a page reached by Back or a restored session fetches a fresh map; and draw imports components only
statically, so the whole of a component's graph loads with the page and only a cold load in flight across a deploy can ask for a
version the deploy removed. H24.16-1 found Chrome loading Back and a restored session from kept copies without asking, so the first
condition is measured here, not assumed: tested, not assumed (A9).

Each test serves a revision of this tree from a scratch folder through the real server, its component installed as a copy, and
deploys by what a release changes -- the installed version, and the map regenerated for it (tools/import-map.mjs) -- the server
stopped and started again on its port, as a cut-over does. Chrome launches through tests/fixtures/chrome.mjs with a profile of the
test's own.

  Back            a page left for another, then reached by Back after a deploy, is asked again, and its fresh map names the
                  deployed version, every module answered; at one revision, a second visit asks again for draw's files and not
                  for the kept release -- the two cache policies D7 sets, each doing its part
  restored        a browser closed, the server deployed, the browser started again restoring its session: the restored page is
                  asked again, and its map names the deployed version
  in flight       a page fetched from one revision whose modules are asked of the next: the version its map names is not the one
                  the deployed revision holds, a 404, and the page does not start until it is reloaded -- the window B403
                  registers, held so a change to it is seen
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
// H26-19 as amended: each server and Chrome ends with this file, even killed; each folder goes when it ends
import { launchChrome, scratchFolder, spawnTethered, stopGroup } from '@apnex/test-harness';
import { NO_CHROME } from './fixtures/chrome.mjs';
import { sleep } from './fixtures/matrix-runner.mjs';

const root = path.resolve(import.meta.dirname, '..');
const COMPONENT = '@apnex/snap-grid';
const { version: RELEASED } = JSON.parse(fs.readFileSync(path.join(root, 'node_modules', COMPONENT, 'package.json'), 'utf8'));
const DEPLOYED = `${RELEASED}-deployed`;   // the version the deploy installs: what a release changes, the files themselves the same
const free = () => new Promise((resolve) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
const BOOTED = '!!(window.draw && window.draw.renderer)';

// a revision of this tree in a scratch folder: what the server serves, its component a copy a deploy can change, its other packages linked
function revision(dir) {
	const tree = path.join(dir, 'tree');
	for (const f of fs.readdirSync(root)) if (!f.startsWith('.') && !['node_modules', 'dev', 'tests', 'docs'].includes(f)) fs.cpSync(path.join(root, f), path.join(tree, f), { recursive: true });
	for (const pkg of fs.readdirSync(path.join(root, 'node_modules'))) {
		if (pkg === '@apnex') fs.cpSync(path.join(root, 'node_modules', pkg), path.join(tree, 'node_modules', pkg), { recursive: true, dereference: true });
		else if (!pkg.startsWith('.')) { fs.mkdirSync(path.join(tree, 'node_modules'), { recursive: true }); fs.symlinkSync(path.join(root, 'node_modules', pkg), path.join(tree, 'node_modules', pkg)); }
	}
	return tree;
}

// one server for one revision, on a port that outlives it, as a deploy keeps the address and replaces what answers it
function serving(tree, dir, port) {
	let proc = null;
	const start = async () => {
		proc = spawnTethered('node', ['server/server.js'], { cwd: tree, env: { PATH: process.env.PATH, HOME: process.env.HOME, PORT: String(port), DATA_DIR: path.join(dir, 'data') }, stdio: 'ignore' });
		for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) return; } catch { /* not up */ } await sleep(100); }
		throw new Error('the server never answered');
	};
	// the deploy: the server stopped, the release's version installed and the pages' map regenerated for it, the server started again
	const deploy = async (version) => {
		await stopGroup(proc.pid);
		const manifest = path.join(tree, 'node_modules', COMPONENT, 'package.json');
		fs.writeFileSync(manifest, JSON.stringify({ ...JSON.parse(fs.readFileSync(manifest, 'utf8')), version }, null, 2));
		execFileSync(process.execPath, [path.join(tree, 'tools/import-map.mjs'), '--write', '--root', tree], { stdio: 'ignore' });
		await start();
	};
	return { start, deploy, stop: () => stopGroup(proc.pid), url: `http://127.0.0.1:${port}/` };
}

// a Chrome DevTools session on one page target: commands, every response by its path, and what the page threw
async function attach(wsUrl, domains = ['Runtime', 'Network', 'Page']) {
	const { default: WebSocket } = await import('ws');
	const ws = new WebSocket(wsUrl);
	let id = 0;
	const pending = new Map(), handlers = new Map(), responses = [], thrown = [];
	const send = (method, params = {}) => new Promise((resolve) => { const n = ++id; pending.set(n, resolve); ws.send(JSON.stringify({ id: n, method, params })); });
	ws.on('message', (raw) => {
		const m = JSON.parse(raw.toString());
		if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
		if (m.method === 'Network.responseReceived') responses.push({ path: m.params.response.url.replace(/^https?:\/\/[^/]+/, ''), status: m.params.response.status, type: m.params.type });
		if (m.method === 'Runtime.exceptionThrown') thrown.push(String(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text).slice(0, 200));
		if (m.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: true });
		handlers.get(m.method)?.(m.params);
	});
	await new Promise((r) => ws.on('open', r));
	for (const domain of domains) await send(`${domain}.enable`);
	const run = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
	const booted = async (ms = 15000) => { for (const end = Date.now() + ms; Date.now() < end; await sleep(100)) if (await run(BOOTED).catch(() => false)) return true; return false; };
	return { send, run, booted, responses, thrown, on: (method, fn) => handlers.set(method, fn), close: () => ws.close() };
}
const cdpUp = async (cdp) => { for (let i = 0; i < 80; i++) { try { return await (await fetch(`http://127.0.0.1:${cdp}/json/version`)).json(); } catch { await sleep(200); } } throw new Error('Chrome never answered'); };
const pageOn = async (cdp, port) => {
	for (let i = 0; i < 75; i++) {
		const hit = (await (await fetch(`http://127.0.0.1:${cdp}/json/list`)).json()).find((t) => t.type === 'page' && t.url.startsWith(`http://127.0.0.1:${port}/`));
		if (hit) return hit;
		await sleep(200);
	}
	throw new Error(`no page on port ${port}`);
};

// what the loaded page holds and how it came: the version its map names, how it was navigated to, and each file's bytes over the wire
const LOADED = `(() => {
	const map = JSON.parse(document.querySelector('script[type="importmap"]').textContent).imports;
	const nav = performance.getEntriesByType('navigation')[0];
	const files = performance.getEntriesByType('resource').map((e) => ({ path: new URL(e.name).pathname, sent: e.transferSize }));
	return { mapped: map['${COMPONENT}'], how: nav.type, pageSent: nav.transferSize, files };
})()`;
const vendorOf = (version) => `/vendor/${COMPONENT}@${version}/`;
const asked = (files, prefix) => files.filter((f) => f.path.startsWith(prefix));

// a page loaded fresh across a deploy: asked again, its map the deployed version's, the deployed release loaded and the old one not
function assertFresh(got, how) {
	assert.equal(got.how, how, `reached by ${how}`);
	assert.ok(got.pageSent > 0, `the page was asked again, not taken from a kept copy (${got.pageSent} bytes)`);
	assert.equal(got.mapped, `${vendorOf(DEPLOYED)}index.js`, 'its map names the deployed version');
	const deployed = asked(got.files, vendorOf(DEPLOYED));
	assert.ok(deployed.some((f) => f.path.endsWith('/index.js')) && deployed.length >= 4, `the deployed release's graph loaded: ${JSON.stringify(deployed)}`);
	assert.deepEqual(asked(got.files, vendorOf(RELEASED)), [], 'and nothing of the release the deploy removed');
	const own = got.files.find((f) => f.path === '/kernel/geometry.mjs');
	assert.ok(own && own.sent > 0, `draw's own files asked again: ${JSON.stringify(own)}`);
}

test('A9 (D7): a page reached by Back across a deploy is asked again -- its fresh map names the deployed version; at one revision, a second visit asks again for draw\'s files and not for the kept release', { skip: NO_CHROME, timeout: 120000 }, async () => {
	const dir = scratchFolder('deploy-back-');
	const procs = [];
	let side = null, tab = null;
	try {
		const port = await free();
		side = serving(revision(dir), dir, port);
		await side.start();
		const chrome = await launchChrome({ url: side.url });
		procs.push(chrome);
		const cdp = chrome.port;
		await cdpUp(cdp);
		tab = await attach((await pageOn(cdp, port)).webSocketDebuggerUrl);
		assert.equal(await tab.booted(), true, `the page booted at the released version: ${JSON.stringify(tab.thrown)}`);
		assert.equal((await tab.run(LOADED)).mapped, `${vendorOf(RELEASED)}index.js`, 'control: its map names the released version');

		// the mixed policies at one revision: a second visit asks again for draw's files, and takes the release's from its kept copy
		await tab.send('Page.navigate', { url: side.url });
		await sleep(500);
		assert.equal(await tab.booted(), true, 'the second visit booted');
		const again = await tab.run(LOADED);
		assert.equal(again.how, 'navigate');
		const kept = asked(again.files, vendorOf(RELEASED));
		assert.ok(kept.length >= 4 && kept.every((f) => f.sent === 0), `the release's files were kept, not asked again: ${JSON.stringify(kept)}`);
		assert.ok(again.files.find((f) => f.path === '/kernel/geometry.mjs')?.sent > 0, 'draw\'s own files were asked again');

		// left for another page, deployed under it, and reached by Back
		await tab.send('Page.navigate', { url: `${side.url}health` });
		await sleep(500);
		await side.deploy(DEPLOYED);
		const { result: history } = await tab.send('Page.getNavigationHistory');
		await tab.send('Page.navigateToHistoryEntry', { entryId: history.entries[history.currentIndex - 1].id });
		await sleep(500);
		assert.equal(await tab.booted(), true, `the page reached by Back booted: ${JSON.stringify(tab.thrown)}`);
		assertFresh(await tab.run(LOADED), 'back_forward');
		assert.deepEqual(tab.responses.filter((r) => r.status >= 400 && r.path !== '/favicon.ico'), [], 'nothing it asked was refused (the browser\'s own favicon request aside: draw serves none)');
		assert.deepEqual(tab.thrown, [], 'and nothing threw');
	} finally {
		tab?.close();
		await side?.stop();
		for (const chrome of procs) await chrome.close();
	}
});

test('A9 (D7): a session restored across a deploy loads its page afresh -- the restored page asked again, its map naming the deployed version', { skip: NO_CHROME, timeout: 120000 }, async () => {
	const dir = scratchFolder('deploy-restore-');
	const procs = [];
	let side = null;
	try {
		const port = await free();
		side = serving(revision(dir), dir, port);
		await side.start();
		const profileDir = path.join(dir, 'profile');   // this test's own, so a second launch restores the session the first wrote
		const first = await launchChrome({ profile: profileDir, url: side.url });
		procs.push(first);
		let cdp = first.port;
		await cdpUp(cdp);
		const tab = await attach((await pageOn(cdp, port)).webSocketDebuggerUrl);
		assert.equal(await tab.booted(), true, 'the page booted at the released version');
		assert.equal((await tab.run(LOADED)).mapped, `${vendorOf(RELEASED)}index.js`, 'control: its map names the released version');
		await sleep(1500);   // the session is written while the browser runs; closing it at once can leave none to restore
		tab.close();

		// the browser closed, as a person closes it, then the deploy, then the browser started again restoring its session
		const browser = await attach((await cdpUp(cdp)).webSocketDebuggerUrl, []);
		browser.send('Browser.close');
		for (const end = Date.now() + 10000; first.exited() === null && Date.now() < end;) await sleep(50);
		browser.close();
		await first.close();   // its profile is this test's, and is kept
		await side.deploy(DEPLOYED);
		const second = await launchChrome({ profile: profileDir, args: ['--restore-last-session'] });
		procs.push(second);
		cdp = second.port;
		await cdpUp(cdp);
		const restored = await attach((await pageOn(cdp, port)).webSocketDebuggerUrl);
		assert.equal(await restored.booted(), true, `the restored page booted: ${JSON.stringify(restored.thrown)}`);
		assertFresh(await restored.run(LOADED), 'back_forward');
		assert.deepEqual(restored.thrown, [], 'and nothing threw');
		restored.close();
	} finally {
		await side?.stop();
		for (const chrome of procs) await chrome.close();
	}
});

test('A9 (B403): a cold load in flight across a deploy asks the deployed revision for the version its page named -- a 404, and the page does not start until it is reloaded', { skip: NO_CHROME, timeout: 120000 }, async () => {
	const dir = scratchFolder('deploy-inflight-');
	const procs = [];
	let side = null, tab = null;
	try {
		const port = await free();
		side = serving(revision(dir), dir, port);
		await side.start();
		const chrome = await launchChrome();
		procs.push(chrome);
		const cdp = chrome.port;
		await cdpUp(cdp);
		const blank = (await (await fetch(`http://127.0.0.1:${cdp}/json/list`)).json()).find((t) => t.type === 'page');
		tab = await attach(blank.webSocketDebuggerUrl);

		/*
		The window, made to happen: every request is held as it is made. The page itself is let through from the released revision;
		the first file it asks for is held, and the deploy cuts over then, so that file and every one after it is asked of the deployed
		revision -- a page from one revision, its modules from the next.
		*/
		const held = [];
		let cut = null, through = false;
		tab.on('Fetch.requestPaused', (p) => {
			if (through || p.resourceType === 'Document') { tab.send('Fetch.continueRequest', { requestId: p.requestId }); return; }
			held.push(p.requestId);
			cut ??= side.deploy(DEPLOYED).then(async () => {
				through = true;
				for (const requestId of held.splice(0)) await tab.send('Fetch.continueRequest', { requestId });
			});
		});
		await tab.send('Fetch.enable', { patterns: [{ urlPattern: `http://127.0.0.1:${port}/*` }] });
		await tab.send('Page.navigate', { url: side.url });
		for (let i = 0; i < 150 && !cut; i++) await sleep(100);
		assert.ok(cut, 'the page asked for a file, so the deploy cut over beneath it');
		await cut;
		await sleep(3000);
		await tab.send('Fetch.disable');

		const component = tab.responses.filter((r) => r.path.startsWith('/vendor/'));
		assert.deepEqual(component.filter((r) => r.path === `${vendorOf(RELEASED)}index.js`).map((r) => r.status), [404],
			`the page asked the deployed revision for the version its map named, and was refused: ${JSON.stringify(component)}`);
		assert.equal(await tab.run('JSON.parse(document.querySelector(\'script[type="importmap"]\').textContent).imports[\'' + COMPONENT + '\']'), `${vendorOf(RELEASED)}index.js`, 'its map is the released revision\'s');
		assert.ok(tab.responses.some((r) => r.path === '/kernel/geometry.mjs' && r.status === 200), 'draw\'s own files were answered by the deployed revision');
		assert.equal(await tab.run(BOOTED), false, 'and the page did not start');

		// a reload, from the deployed revision alone, starts it
		tab.thrown.length = 0;
		await tab.send('Page.reload');
		await sleep(500);
		assert.equal(await tab.booted(), true, `reloaded, it starts: ${JSON.stringify(tab.thrown)}`);
		assert.equal((await tab.run(LOADED)).mapped, `${vendorOf(DEPLOYED)}index.js`, 'its map now the deployed version\'s');
	} finally {
		tab?.close();
		await side?.stop();
		for (const chrome of procs) await chrome.close();
	}
});
