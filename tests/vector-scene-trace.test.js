/*
H26.4 (dev/design/components/VECTOR-SCENE.md acceptance step 5, D12, section 6.2) -- THE REVEAL'S TRACE, TODAY'S RENDERER AGAINST THE
ADAPTER, IN REAL CHROME.

The reveal is unchanged (plugins/simulation/reveal-painter.mjs): its `show` measures the line with `getTotalLength`, writes its inline
style and forces a layout between two states, so the second is a transition from the first. Through the adapter it runs on the shadow's
nodes, which the page's measure and settle answer: the same `d` measured by draw's own probe, the style written into the `style`
attribute and put at once, and the page's style settled by asking the root its box. So a page holds two same-origin frames, each a
document of its own with the page's stylesheets -- today's renderer on the page's markup, kept verbatim, and the adapter on a scene
opened on the bare root -- driven alike; for every mode the reveal has, at sampled times, both frames' computed stroke-dasharray,
stroke-dashoffset, opacity and visibility, their inline dash and transition as the CSSOM reads them, and each frame's pixels must be
equal, and the layers' trees and kept elements after each mode. The two frames must draw alike before any trace, or the run proves
nothing. Chrome launches through tests/fixtures/chrome.mjs on a port and a profile of this file's own.
*/
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import http from 'node:http';
import path from 'node:path';
import { teardown } from './fixtures/teardown.mjs';
import { NO_CHROME, launchChrome } from './fixtures/chrome.mjs';
import { createTab, sleep } from './fixtures/matrix-runner.mjs';
import { PAGE_STYLESHEETS, CANVAS_LAYERS, CANVAS_VIEWBOX } from '../product/canvas.mjs';
import { parityBoard } from '../tools/probe/boards.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
/*
The parity board (tools/probe/boards.mjs), which the repository holds, its first link made a control link: an undirected link over a pipe,
drawn solid with no head, and a control link, dashed -- the two lines a trace draws differently -- and a ring added on the page.
*/
const BOARD = parityBoard(), SOLID = 'link-fa0005', CONTROL = 'link-fa0001', RING = 'link-a00001';
BOARD.links = BOARD.links.map((l) => (l.id === CONTROL ? (({ direction, ...rest }) => ({ ...rest, control: true }))(l) : l));
const DOC = JSON.stringify(BOARD);
const T = [0, 1, 60, 125, 250, 375, 450, 499, 500, 750];
const W = 960, H = 540;
const free = () => new Promise((resolve) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

// each installed component by its one export path, from the tree's node_modules, as the vendor mount serves it to the pages
const component = (name) => { const p = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/@apnex', name, 'package.json'), 'utf8')); const e = p.exports['.']; return `/node_modules/@apnex/${name}/${(typeof e === 'string' ? e : e.default).replace(/^\.\//, '')}`; };
const IMPORTS = JSON.stringify({ imports: Object.fromEntries(['snap-grid', 'input-binding', 'input-capture', 'vector-scene'].map((n) => [`@apnex/${n}`, component(n)])) });
const sidePage = (which) => `<!doctype html><html><head><meta charset="utf-8"><script type="importmap">${IMPORTS}</script>
${PAGE_STYLESHEETS.map((s) => `<link rel="stylesheet" href="/${s}">`).join('\n')}
<style>html,body{margin:0;overflow:hidden;background:#fff} #container{position:absolute;left:0;top:0;width:${W}px;height:${H}px;display:block}</style></head><body>
<svg id="container" viewBox="${CANVAS_VIEWBOX}" xmlns="http://www.w3.org/2000/svg"><rect id="canvas" x="-960" y="-540" width="1920" height="1080"/>${which === 'old' ? CANVAS_LAYERS.map((id) => `<g id="${id}"></g>`).join('') : ''}</svg>
<script type="module" src="/tests/fixtures/scene-trace-side.mjs?which=${which}"></script></body></html>`;
// the two frames at one place, one shown at a time, so the two are rasterized alike
const TOP = `<!doctype html><html><head><style>html,body{margin:0;background:#fff} iframe{position:absolute;left:0;top:0;border:0;width:${W}px;height:${H}px}</style></head><body>
<iframe id="a" src="/side.html?which=old"></iframe><iframe id="b" src="/side.html?which=new" style="visibility:hidden"></iframe></body></html>`;

let dir, server, procs = [], tab;
before(async () => {
	if (NO_CHROME) return;
	dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vector-scene-trace-'));
	server = http.createServer((req, res) => {
		const u = new URL(req.url, 'http://x');
		const page = u.pathname === '/top.html' ? TOP : u.pathname === '/side.html' ? sidePage(u.searchParams.get('which')) : null;
		if (page !== null) { res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' }); res.end(page); return; }
		if (u.pathname === '/favicon.ico') { res.writeHead(200, { 'content-type': 'image/x-icon' }); res.end(); return; }   // what Chrome asks of any page
		const file = path.join(ROOT, path.normalize(decodeURIComponent(u.pathname)));
		if (!file.startsWith(`${ROOT}${path.sep}`) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
		res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
		res.end(fs.readFileSync(file));
	});
	const httpPort = await free();
	await new Promise((r) => server.listen(httpPort, '127.0.0.1', r));
	const cdp = await free();
	procs.push(launchChrome({ cdpPort: cdp, profileDir: path.join(dir, 'profile'), extra: ['--font-render-hinting=none', '--force-color-profile=srgb'], url: 'about:blank' }));
	for (let i = 0; i < 80; i++) { try { await (await fetch(`http://127.0.0.1:${cdp}/json/version`)).json(); break; } catch { await sleep(200); } }
	tab = await createTab(cdp)();
	await tab.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
	await tab.send('Page.navigate', { url: `http://127.0.0.1:${httpPort}/top.html` });
	for (let i = 0; i < 200 && !(await tab.run('!!(frames[0]?.side && frames[1]?.side)').catch(() => false)); i++) await sleep(100);
});
after(async () => { if (server) server.close(); await teardown(procs, dir); });

test('H26.4 (acceptance step 5, D12): the reveal\'s trace through the shadow is today\'s in Chrome -- computed values, inline style and pixels at sampled times, in every mode', { skip: NO_CHROME, timeout: 600000 }, async () => {
	assert.equal(await tab.run('!!(frames[0]?.side && frames[1]?.side)'), true, `both frames booted: ${JSON.stringify(tab.thrown)}`);
	const shot = async (frame) => {
		await tab.run(`(async () => { document.getElementById('a').style.visibility = ${frame === 0 ? "'visible'" : "'hidden'"}; document.getElementById('b').style.visibility = ${frame === 1 ? "'visible'" : "'hidden'"};
			await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))); return true; })()`);
		return (await tab.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: W, height: H, scale: 1 } })).result.data;
	};
	const both = (expr) => tab.run(`Promise.all([frames[0].side.${expr}, frames[1].side.${expr}])`);
	const op = (name, a) => tab.run(`(() => { frames[0].side.op(${JSON.stringify(name)}, ${JSON.stringify(a)}); frames[1].side.op(${JSON.stringify(name)}, ${JSON.stringify(a)}); return true; })()`);
	// a run of operations in ONE task: one evaluation, each frame's operations called synchronously, nothing read or sampled between (o:F4)
	const sameTask = (...ops) => tab.run(`(() => { for (const i of [0, 1]) { const s = frames[i].side; ${ops.map(([n, a]) => `s.op(${JSON.stringify(n)}, ${JSON.stringify(a)});`).join(' ')} } return true; })()`);
	const load = async () => { await both(`load(${JSON.stringify(DOC)})`); await both('frame()'); };
	const out = { samples: 0, computed: [], pixels: [], trees: [], styleAt: [] };
	// the layers' trees and kept elements alike, attribute for attribute in order -- but for where a style the CSSOM set stands among an
	// element's attributes, which Chrome decides when the attribute is first read (tests/fixtures/scene-trace-side.mjs `ser`)
	const trees = async (mode) => {
		const [a, b] = await both('snapshot()');
		if (a.exact === b.exact) return;
		if (a.apart === b.apart) { out.styleAt.push(mode); return; }
		let i = 0; while (a.apart[i] === b.apart[i]) i++;
		out.trees.push([mode, a.apart.slice(Math.max(0, i - 160), i + 160), b.apart.slice(Math.max(0, i - 160), i + 160)]);
	};
	const compare = async (mode, id, times) => {
		for (const t of times) {
			const [a, b] = await both(`sample(${JSON.stringify(id)}, ${t})`);
			await both('frame()');
			const [pa, pb] = [await shot(0), await shot(1)];
			out.samples++;
			if (JSON.stringify(a) !== JSON.stringify(b)) out.computed.push([mode, t, a, b]);
			if (pa !== pb) out.pixels.push([mode, t]);
		}
		await trees(mode);
	};
	await load();
	await both('snapshot()');
	assert.equal(await shot(0), await shot(1), 'control: the two frames draw alike before any trace');
	const lengths = { solid: await both(`length(${JSON.stringify(SOLID)})`), control: await both(`length(${JSON.stringify(CONTROL)})`) };
	assert.ok(lengths.solid[0] > 0 && lengths.solid[0] === lengths.solid[1] && lengths.control[0] === lengths.control[1], `the lines measure alike: ${JSON.stringify(lengths)}`);

	// an open solid link, a dashed control link, a closed directed ring whose line is offset; each hidden, then shown
	await op('hide', { id: SOLID }); await op('show', { id: SOLID }); await compare('open solid link', SOLID, T);
	await load(); await op('hide', { id: CONTROL }); await op('show', { id: CONTROL }); await compare('dashed control link', CONTROL, T);
	const ring = async () => {
		for (const [id, x, y] of [['waypoint-a00001', -600, -420], ['waypoint-a00002', -360, -420], ['waypoint-a00003', -360, -180], ['waypoint-a00004', -600, -180]]) await op('put', { kind: 'node', entity: { id, x, y } });
		await op('put', { kind: 'link', entity: { id: RING, src: 'waypoint-a00001', dst: 'waypoint-a00004', via: ['waypoint-a00002', 'waypoint-a00003'], closed: true, direction: 'forward' } });
		await both('frame()');
	};
	await load(); await ring();
	const offset = await both(`attribute(${JSON.stringify(RING)}, 'stroke-dashoffset')`);
	assert.ok(offset[0] !== null && offset[0] === offset[1], `the ring's line is offset alike: ${JSON.stringify(offset)}`);
	await op('hide', { id: RING }); await op('show', { id: RING }); await compare('closed directed ring', RING, T);
	// velocity mode, which nothing sets today: the duration is the measured length over the speed
	await load(); await op('trace', { cfg: { mode: 'velocity', pxPerMs: 0.5 } });
	await op('hide', { id: SOLID }); await op('show', { id: SOLID });
	const ms = lengths.solid[0] / 0.5;
	await compare('velocity mode', SOLID, [0, ms * 0.25, ms * 0.5, ms * 0.99, ms, ms + 200]);
	// hidden mid-flight, sampled hidden, shown again: the trace begun again
	await load(); await op('hide', { id: SOLID }); await op('show', { id: SOLID });
	await compare('mid-flight, before the hide', SOLID, [200]);
	await op('hide', { id: SOLID }); await compare('hidden mid-flight', SOLID, [200, 300]);
	await op('show', { id: SOLID }); await compare('shown again after a mid-flight hide', SOLID, T);
	// a second trace after the first ended, hide and show in two tasks
	await load(); await op('hide', { id: SOLID }); await op('show', { id: SOLID }); await compare('first trace, to its end', SOLID, [500, 750]);
	await op('hide', { id: SOLID }); await op('show', { id: SOLID }); await compare('traced again, hide and show in two tasks', SOLID, T);
	// in ONE task (o:F4): a first trace's hide and show; after a completed trace, a hide and a show; a whole second trace begun in the
	// same task as the first; and a show hidden again -- each on a solid link and on the closed directed ring
	for (const [id, prep] of [[SOLID, async () => {}], [RING, ring]]) {
		const tag = id === SOLID ? 'solid link' : 'closed ring';
		await load(); await prep();
		await sameTask(['hide', { id }], ['show', { id }]); await compare(`${tag}: first trace, hide and show in one task`, id, T);
		await both('finish()'); await compare(`${tag}: the first trace completed`, id, [0]);
		await sameTask(['hide', { id }], ['show', { id }]); await compare(`${tag}: after a completed trace, hide and show in one task`, id, T);
		await load(); await prep();
		await sameTask(['hide', { id }], ['show', { id }], ['hide', { id }], ['show', { id }]); await compare(`${tag}: a second trace in the same task as the first`, id, T);
		await load(); await prep();
		await sameTask(['hide', { id }], ['show', { id }], ['hide', { id }]); await compare(`${tag}: shown and hidden again in one task`, id, [0, 250, 750]);
	}
	// the route changes mid-flight: the line keeps its element and its inline style, as today (the painter's update writes `d`)
	const doc = JSON.parse(DOC), src = doc.nodes.find((n) => n.id === doc.links.find((l) => l.id === SOLID).src);
	await load(); await op('hide', { id: SOLID }); await op('show', { id: SOLID }); await compare('before the route changes', SOLID, [200]);
	await op('set', { kind: 'node', id: src.id, patch: { x: src.x - 240 } }); await compare('route changed mid-flight', SOLID, [200, 300, 500, 750]);
	// the link gains a head mid-flight: its line kept, its trace running on (o:F5)
	await load(); await op('hide', { id: SOLID }); await op('show', { id: SOLID }); await compare('before the head', SOLID, [200]);
	await op('set', { kind: 'link', id: SOLID, patch: { direction: 'forward' } }); await compare('head gained mid-flight', SOLID, [200, 300, 500, 750]);
	// a node fades rather than traces
	await load(); await op('hide', { id: doc.nodes[0].id }); await both('finish()'); await op('show', { id: doc.nodes[0].id }); await compare('a node fades', doc.nodes[0].id, T);

	assert.ok(out.samples >= 140, `${out.samples} samples`);
	assert.deepEqual(out.computed.slice(0, 2), [], `${out.computed.length} samples computed or inline unalike`);
	assert.deepEqual(out.pixels, [], 'every sample\'s pixels alike');
	assert.deepEqual(out.trees, [], 'the layers\' trees and kept elements alike after every mode');
	// the style's place differs only where a hide follows a show in the one task, before anything reads the line's attributes: the old
	// side's style attribute is made at that first read, after the hide's `data-unrevealed`; the shadow's when the show set it, before
	assert.deepEqual(out.styleAt, ['solid link: shown and hidden again in one task', 'closed ring: shown and hidden again in one task'],
		'the inline style\'s place among the attributes differs exactly where Chrome makes the attribute after another was added');
	assert.deepEqual(tab.thrown, [], 'nothing failed');
});
