/*
H26.8's trace move (B422; dev/design/components/NATIVE-SHAPES.md section 5, NS4; GR10) -- THE REVEAL'S TRACE, DECLARED, IN REAL CHROME.

REWRITTEN at the move. Until it, this ran today's renderer, kept verbatim, beside the adapter, each tracing as production traced -- an
inline dash, a forced layout, a transition (H26.4, acceptance step 5). The trace is declared now: the line carries `data-trace`, a name
alternated per line, and its measured length and duration as custom properties, which the simulation's stylesheet runs as one animation;
the reveal takes them away at its end. Two frames of tests/fixtures/trace-page.mjs, each the page's canvas as the page composes it with
the real reveal, hold it:
  sampled    frame a traces a line by today's technique, the reference; frame b by the real reveal; both paused at the same instants of
             the trace, and once past its end before the reveal's pass, and each frame's pixels compared, over an open solid link, a
             dashed control link, a dotted down link, a closed directed ring whose line is offset, and velocity mode -- then each run
             past its end: frame b's line drawn as an untraced line is, frame a's still one dash its whole length wherever its own dash
             is another (B422)
  lifecycle  frame b's reveal, its loop and its clock real and unpaused, through each event of section 5's table
  a pipe     selected, hovered and armed on the composed page -- the selected look the canvas marks on an id it did not draw (F1)
Chrome launches through tests/fixtures/chrome.mjs on a port and a profile of this file's own.
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
import { PAGE_STYLESHEETS, CANVAS_VIEWBOX } from '../product/canvas.mjs';
import { board, IDS } from './fixtures/trace-record.mjs';   // the record's board: the parity board, a control link, a closed ring
import { pipeEntity } from '../plugins/network/pipe-kind.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DOWN = 'link-fa0006';   // the parity board's down link, dotted
const BOARD = board(), DOC = JSON.stringify(BOARD);
const FRACTIONS = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 0.999];
const W = 960, H = 540;
const free = () => new Promise((resolve) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

// each installed component by its one export path, from the tree's node_modules, as the vendor mount serves it to the pages
const component = (name) => { const p = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/@apnex', name, 'package.json'), 'utf8')); const e = p.exports['.']; return `/node_modules/@apnex/${name}/${(typeof e === 'string' ? e : e.default).replace(/^\.\//, '')}`; };
const IMPORTS = JSON.stringify({ imports: Object.fromEntries(['snap-grid', 'input-binding', 'input-capture', 'vector-scene'].map((n) => [`@apnex/${n}`, component(n)])) });
const SIDE = `<!doctype html><html><head><meta charset="utf-8"><script type="importmap">${IMPORTS}</script>
${PAGE_STYLESHEETS.map((s) => `<link rel="stylesheet" href="/${s}">`).join('\n')}
<style>html,body{margin:0;overflow:hidden;background:#fff} #container{position:absolute;left:0;top:0;width:${W}px;height:${H}px;display:block}</style></head><body>
<svg id="container" viewBox="${CANVAS_VIEWBOX}" xmlns="http://www.w3.org/2000/svg"><rect id="canvas" x="-960" y="-540" width="1920" height="1080"/></svg>
<script type="module" src="/tests/fixtures/trace-page.mjs"></script></body></html>`;
// the two frames at one place, one shown at a time, so the two are rasterized alike
const TOP = `<!doctype html><html><head><style>html,body{margin:0;background:#fff} iframe{position:absolute;left:0;top:0;border:0;width:${W}px;height:${H}px}</style></head><body>
<iframe id="a" src="/side.html"></iframe><iframe id="b" src="/side.html" style="visibility:hidden"></iframe></body></html>`;

let dir, server, procs = [], tab;
before(async () => {
	if (NO_CHROME) return;
	dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vector-scene-trace-'));
	server = http.createServer((req, res) => {
		const u = new URL(req.url, 'http://x');
		const page = u.pathname === '/top.html' ? TOP : u.pathname === '/side.html' ? SIDE : null;
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

/*
A picture of one frame, painted whole: both hidden for two frames, then the one shown. A frame left shown repaints only what a change
dirties, and after a dash runs out Chrome leaves a few edge pixels of the stroke as they were (measured at the move, for today's trace as
for the declared one alike: up to 45 pixels, by up to 16 of 255, gone at the next whole paint) -- so a picture is never taken of a frame
already shown.
*/
const shot = async (frame) => {
	await tab.run(`(async () => { const two = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
		document.getElementById('a').style.visibility = 'hidden'; document.getElementById('b').style.visibility = 'hidden'; await two();
		document.getElementById(${frame === 0 ? "'a'" : "'b'"}).style.visibility = 'visible'; await two(); return true; })()`);
	return (await tab.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: W, height: H, scale: 1 } })).result.data;
};
const at = (frame, expr) => tab.run(`frames[${frame}].side.${expr}`);
const both = (expr) => tab.run(`Promise.all([frames[0].side.${expr}, frames[1].side.${expr}])`);
const op = (frame, name, a) => at(frame, `op(${JSON.stringify(name)}, ${JSON.stringify(a)})`);

test('H26.8 (NS4): the declared trace draws today\'s trace at every sampled instant, and after it the line is its own again where today\'s is not (B422)', { skip: NO_CHROME, timeout: 600000 }, async () => {
	assert.equal(await tab.run('!!(frames[0]?.side && frames[1]?.side)'), true, `both frames booted: ${JSON.stringify(tab.thrown)}`);
	await both(`load(${JSON.stringify(DOC)})`); await both('frame()');
	const untraced = await shot(1);
	assert.equal(await shot(0), untraced, 'control: the two frames draw alike before any trace');
	const CASES = [
		['an open solid link', IDS.solid, null, false],
		['a dashed control link', IDS.control, null, true],
		['a dotted down link', DOWN, null, true],
		['a closed directed ring, its line offset', IDS.ring, null, true],
		['velocity mode', IDS.solid, { mode: 'velocity', pxPerMs: 0.5 }, false],
	];
	const out = { samples: 0, pixels: [], computed: [], after: [] };
	for (const [name, id, cfg, ownDash] of CASES) {
		await both(`load(${JSON.stringify(DOC)})`); await both('frame()');
		const own = await at(1, `read(${JSON.stringify(id)})`);
		assert.ok(ownDash ? own.dash !== 'none' : own.dash === 'none', `${name}: precondition, its own dash ${own.dash}`);
		// frame a by today's technique; frame b by the real reveal, its clock frozen at the show so no pass ends the trace mid-sample
		const { len, ms } = await at(0, `today(${JSON.stringify(id)}, ${JSON.stringify(cfg)})`);
		await at(1, `freeze(frames[1].side.now())`);
		await op(1, 'trace', { cfg });
		await tab.run(`(() => { frames[1].side.op('hide', { id: ${JSON.stringify(id)} }); frames[1].side.op('show', { id: ${JSON.stringify(id)} }); return true; })()`);
		const b = await at(1, `read(${JSON.stringify(id)})`);
		assert.equal(b.style, `--trace-len: ${len}; --trace-ms: ${ms}ms`, `${name}: the trace's length and duration, measured by draw's probe as today's measured the line`);
		for (const f of FRACTIONS) {
			await both(`seek(${f * ms})`); await both('frame()');
			const [ra, rb] = await both(`read(${JSON.stringify(id)})`);
			if (ra.dash !== rb.dash || ra.offset !== rb.offset) out.computed.push([name, f, ra.dash, ra.offset, rb.dash, rb.offset]);
			if ((await shot(0)) !== (await shot(1))) out.pixels.push([name, f]);
			out.samples++;
		}
		// past its end, frame b's clock still frozen so no pass has taken it away: the whole dash held, as today's finished transition
		// leaves it (the stylesheet's fill, both) -- the window between the animation's end and the reveal's pass
		await both(`seek(${ms * 1.25})`); await both('frame()');
		const [pa, pb] = await both(`read(${JSON.stringify(id)})`);
		if (pa.dash !== pb.dash || pa.offset !== pb.offset) out.computed.push([name, 'past its end', pa.dash, pa.offset, pb.dash, pb.offset]);
		if ((await shot(0)) !== (await shot(1))) out.pixels.push([name, 'past its end']);
		/*
		Past the end, traced again from a fresh load and run unpaused -- an animation paused and sought through the API is the script's to
		end, no longer the stylesheet's, so a sample's is not the one an end is read from: today's transition run out, and the declared
		trace ended by a pass of the reveal at show + ms, its clock the frame's own.
		*/
		await both(`load(${JSON.stringify(DOC)})`); await both('frame()');
		await at(1, 'thaw()');
		await at(0, `today(${JSON.stringify(id)}, ${JSON.stringify(cfg)})`);
		await tab.run(`(() => { frames[1].side.op('hide', { id: ${JSON.stringify(id)} }); frames[1].side.op('show', { id: ${JSON.stringify(id)} }); return true; })()`);
		await sleep(ms + 200);
		await op(1, 'paint');
		await both('frame()');
		const [ea, eb] = await both(`read(${JSON.stringify(id)})`);
		out.after.push({ name, today: ea.dash, now: eb.dash, own: own.dash, trace: eb.trace, style: eb.style, animations: eb.animations.length,
			nowPixels: (await shot(1)) === untraced, todayPixels: (await shot(0)) === untraced });
		await op(1, 'trace', { cfg: null });
	}
	assert.equal(out.samples, CASES.length * FRACTIONS.length);
	assert.deepEqual(out.computed, [], 'every sample\'s computed dash and offset alike in both frames');
	assert.deepEqual(out.pixels, [], 'every sample\'s pixels alike in both frames');
	for (const a of out.after) {
		assert.deepEqual([a.trace, a.style, a.animations], [null, null, 0], `${a.name}: its trace ended, nothing of it left on the line`);
		assert.equal(a.now, a.own, `${a.name}: drawn with its own dash after`);
		assert.ok(a.nowPixels, `${a.name}: drawn as the untraced line is, pixel for pixel`);
	}
	// the control, and B422 shown: today's trace leaves the whole length as one dash, so a line whose own dash is another stays unlike it
	for (const a of out.after.filter((x) => CASES.find(([n]) => n === x.name)[3])) {
		assert.notEqual(a.today, a.own, `${a.name}: today's trace leaves its dash behind (B422)`);
		assert.ok(!a.todayPixels, `${a.name}: and today's line is drawn unlike the untraced one`);
	}
	assert.deepEqual(tab.thrown, [], 'nothing failed');
});

test('H26.8 (section 5, GR10): the real reveal and its loop, unpaused, through every event of the trace\'s lifecycle', { skip: NO_CHROME, timeout: 300000 }, async () => {
	const B = 1, id = IDS.solid;
	const read = (x = id) => at(B, `read(${JSON.stringify(x)})`);
	const load = async (doc = DOC) => { await at(B, 'thaw()'); await at(B, `load(${JSON.stringify(doc)})`); await at(B, 'frame()'); };
	const beat = (after, ids, interval = 0) => tab.run(`(() => { const s = frames[${B}].side; s.op('record', { record: { origin: s.now() + ${after}, beats: [{ interval: ${interval}, ids: ${JSON.stringify(ids)} }] } }); return true; })()`);
	const tracing = async (x = id) => { for (let i = 0; i < 60; i++) { if ((await read(x)).trace) return true; await sleep(25); } return false; };
	const ended = async (x = id) => { for (let i = 0; i < 120; i++) { if (!(await read(x)).trace) return true; await sleep(25); } return false; };
	const steps = [];
	const check = (label, ok, got) => { steps.push(label); assert.ok(ok, `${label}: ${JSON.stringify(got)}`); };

	// a pass of the loop ends every trace past its instant; the loop runs while a record is held
	await load();
	await op(B, 'trace', { cfg: null });
	const own = (await read(IDS.control)).dash;
	await beat(100, [IDS.control]);
	check('a beat reveals the control link, traced', await tracing(IDS.control), await read(IDS.control));
	const mid = await read(IDS.control);
	check('its trace: a name, its length and duration as custom properties, the dash its length', /^[ab]$/.test(mid.trace) && mid.style === `--trace-len: ${mid.length}; --trace-ms: 500ms` && Math.abs(parseFloat(mid.dash) - mid.length) < 0.5, mid);
	check('ended by a pass of the loop at its instant', await ended(IDS.control), await read(IDS.control));
	const done = await read(IDS.control);
	check('nothing of it left, the line its own dash again', done.style === null && done.animations.length === 0 && done.dash === own, { done, own });
	check('the loop runs on while the record is held', (await at(B, 'loop()')).running, await at(B, 'loop()'));

	// the record gone: showAll shows what was withheld, links traced; the loop runs until those end, then stops
	await load();
	await beat(60000, [id, IDS.control]);
	await sleep(150);
	check('withheld by a beat far off', (await read()).unrevealed && (await read(IDS.control)).unrevealed, await read());
	await op(B, 'record', { record: null });
	check('the record gone: each shown, traced', /^[ab]$/.test((await read()).trace) && /^[ab]$/.test((await read(IDS.control)).trace), [await read(), await read(IDS.control)]);
	check('and the loop runs with no record, two traces running', JSON.stringify(await at(B, 'loop()')) === JSON.stringify({ running: true, traces: 2 }), await at(B, 'loop()'));
	await ended(); await ended(IDS.control); await sleep(150);
	check('their ends reached, the loop stops', JSON.stringify(await at(B, 'loop()')) === JSON.stringify({ running: false, traces: 0 }), await at(B, 'loop()'));

	// a hide ends the trace and withholds the line; the next show takes the other name; a hide and a show in one task restart it
	await load();
	await op(B, 'trace', { cfg: { mode: 'duration', ms: 3000 } });
	await beat(50, [id]);
	await tracing(); await sleep(400);
	const first = (await read()).trace;
	const other = (name) => (name === 'a' ? 'b' : 'a');
	await at(B, `keep(${JSON.stringify(id)})`);
	await beat(60000, [id]);
	const hidden = await read();
	check('a hide mid-trace ends it and withholds the line', hidden.trace === null && hidden.style === null && hidden.unrevealed && hidden.animations.length === 0, hidden);
	await beat(-1, [id]);
	const again = await read();
	check('the next show takes the other name, the animation begun again', again.trace === other(first) && again.animations.length === 1 && again.animations[0].time < 200 && !(await at(B, `same(${JSON.stringify(id)})`)), again);
	await sleep(400); await at(B, `keep(${JSON.stringify(id)})`);
	const restarted = JSON.parse(await tab.run(`(() => { const s = frames[${B}].side; s.op('hide', { id: ${JSON.stringify(id)} }); s.op('show', { id: ${JSON.stringify(id)} }); return JSON.stringify({ r: s.read(${JSON.stringify(id)}) }); })()`)).r;
	await at(B, 'frame()');
	const runs = await read();
	check('a hide and a show in one task: the name changed, a new animation from its start', restarted.trace === other(again.trace) && runs.animations[0].time < 200 && !(await at(B, `same(${JSON.stringify(id)})`)), { restarted, runs });
	await op(B, 'trace', { cfg: null });

	// the line described again, its trace unchanged: nothing written, the animation runs on -- a mode change each way among them
	await load();
	await op(B, 'trace', { cfg: { mode: 'duration', ms: 4000 } });
	await beat(50, [id]); await tracing(); await sleep(300);
	await at(B, `keep(${JSON.stringify(id)})`); await at(B, `watch(${JSON.stringify(id)})`);
	await op(B, 'set', { kind: 'link', id, patch: { name: 'renamed' } });
	await op(B, 'mode', { mode: 'edit' }); await at(B, 'frame()'); await op(B, 'mode', { mode: 'view' });
	await sleep(300);
	const written = await at(B, `writes(${JSON.stringify(id)})`);
	check('described again and a mode change each way: the trace not written, the animation the same and running on', !written.includes('style') && !written.includes('data-trace')
		&& (await at(B, `same(${JSON.stringify(id)})`)) && (await read()).animations[0].time > 500, { written, r: await read() });
	await at(B, `unwatch(${JSON.stringify(id)})`);

	// a route changed mid-trace: on a model change, its length written in the same task; on the network's settle, on the next pass
	const src = BOARD.nodes.find((n) => n.id === BOARD.links.find((l) => l.id === id).src);
	await at(B, `keep(${JSON.stringify(id)})`);
	const moved = JSON.parse(await tab.run(`(() => { const s = frames[${B}].side; s.op('set', { kind: 'node', id: ${JSON.stringify(src.id)}, patch: { x: ${src.x - 240} } }); return JSON.stringify(s.read(${JSON.stringify(id)})); })()`));
	check('a model change: the new route\'s length written in the same task, the animation the same', moved.style === `--trace-len: ${moved.length}; --trace-ms: 4000ms` && (await at(B, `same(${JSON.stringify(id)})`)), moved);
	await at(B, 'frame()');
	const keptTime = await read();
	check('and it draws the same fraction of the new line, its time running on', Math.abs(parseFloat(keptTime.dash) - moved.length) < 0.5 && keptTime.animations[0].time > 500, keptTime);
	const settled = JSON.parse(await tab.run(`(() => { const s = frames[${B}].side; s.op('settle', { id: ${JSON.stringify(src.id)}, patch: { x: ${src.x - 480} } }); return JSON.stringify(s.read(${JSON.stringify(id)})); })()`));
	check('the network\'s settle redrawing it: not yet written in that task', settled.style === `--trace-len: ${moved.length}; --trace-ms: 4000ms` && settled.length !== moved.length, settled);
	await at(B, 'frame()'); await sleep(150);
	const next = await read();
	check('written on the next pass of the loop, the animation the same', next.style === `--trace-len: ${next.length}; --trace-ms: 4000ms` && next.length === settled.length && (await at(B, `same(${JSON.stringify(id)})`)), next);
	await op(B, 'trace', { cfg: null });

	// the entity removed mid-trace: its trace and marks go with it; the reveal's entry ends on its instant, writing nothing -- an undo
	// drawing it afresh among them
	await load();
	await beat(50, [id]); await tracing(); await sleep(100);
	const held = BOARD.links.find((l) => l.id === id);
	await op(B, 'del', { kind: 'link', id });
	await sleep(50);
	check('removed mid-trace: no line, the entry running to its instant', (await read()) === null && (await at(B, 'loop()')).traces === 1, await at(B, 'loop()'));
	await op(B, 'put', { kind: 'link', entity: held });
	await at(B, `watch(${JSON.stringify(id)})`);
	const fresh = await read();
	check('an undo draws it afresh: no trace on the line drawn afresh', fresh.trace === null && fresh.style === null, fresh);
	await sleep(600);
	check('the entry ended on its instant, writing nothing to the line', (await at(B, `writes(${JSON.stringify(id)})`)).length === 0 && (await at(B, 'loop()')).traces === 0, await at(B, `writes(${JSON.stringify(id)})`));
	await at(B, `unwatch(${JSON.stringify(id)})`);

	// a load mid-trace: the trace and marks go with the lines; the entry ends on its instant, writing nothing; the load's sync re-marks
	// what the new record withholds
	await load();
	await beat(50, [id]); await tracing(); await sleep(100);
	const withheld = { ...BOARD, reveal: { origin: Date.now() + 60000, beats: [{ interval: 0, ids: [IDS.control] }] } };
	await at(B, `load(${JSON.stringify(JSON.stringify(withheld))})`);
	await at(B, `watch(${JSON.stringify(id)})`);
	const loaded = [await read(), await read(IDS.control)];
	check('loaded mid-trace: the line drawn afresh, no trace; what the new record withholds marked', loaded[0].trace === null && loaded[0].style === null && loaded[1].unrevealed, loaded);
	await sleep(600);
	check('the entry ended on its instant, writing nothing to the line drawn afresh', (await at(B, `writes(${JSON.stringify(id)})`)).length === 0 && (await at(B, 'loop()')).traces === 0, await at(B, `writes(${JSON.stringify(id)})`));
	await at(B, `unwatch(${JSON.stringify(id)})`);

	// the 100 ms tick: a hide writes nothing while its mark stands
	await load();
	await beat(60000, [id]); await sleep(150);
	await at(B, `watch(${JSON.stringify(id)})`);
	await sleep(600);
	check('withheld through six ticks and their frames: not one write to the line', (await at(B, `writes(${JSON.stringify(id)})`)).length === 0 && (await at(B, 'loop()')).running, await at(B, `writes(${JSON.stringify(id)})`));
	await at(B, `unwatch(${JSON.stringify(id)})`);
	await op(B, 'record', { record: null });

	assert.equal(steps.length, 23, 'each event of the lifecycle asked');
	assert.deepEqual(tab.thrown, [], 'nothing failed');
});

/*
H26.4 (F1, F5), RESTATED at H26.8's trace move -- A PIPE SELECTED, ON THE COMPOSED PAGE. plugins/network/host.mjs draws each pipe's line in
its own layer under the pipe's id, so the canvas's selection, hover and arming reach it. Until the move, today's renderer, kept verbatim,
marked it in a frame beside the adapter's and the two were compared; that frame went with tests/fixtures/scene-trace-side.mjs, so this
holds the marks themselves: the line's class after each step, and its stroke as computed, another colour while selected.
*/
test('H26.4 (F1): a hand pipe selected, hovered and armed is marked on the composed page -- its class, and its stroke as computed', { skip: NO_CHROME, timeout: 120000 }, async () => {
	const HAND = pipeEntity('node-fa00a3', 'node-fa00a5', 'hand');
	const doc = { ...BOARD, pipes: [...(BOARD.pipes ?? []), HAND] };
	const B = 1;
	await at(B, `load(${JSON.stringify(JSON.stringify(doc))})`); await at(B, 'frame()');
	const lineOf = async () => { await at(B, 'frame()'); return at(B, `lineOf(${JSON.stringify(HAND.id)})`); };
	const loaded = await lineOf();
	assert.ok(loaded, 'the pipe\'s line is drawn');
	await op(B, 'select', { ids: [HAND.id] });
	const selected = await lineOf();
	await op(B, 'state', { id: HAND.id, cls: 'hover', on: true });
	const hovered = await lineOf();
	await op(B, 'state', { id: HAND.id, cls: 'armed', on: true });
	const armed = await lineOf();
	await op(B, 'clear', { id: HAND.id, classes: ['hover', 'armed', 'armed-clone'] });
	const cleared = await lineOf();
	await op(B, 'select', { ids: [] });
	const deselected = await lineOf();
	const tokens = (x) => x.class.split(/\s+/).filter((c) => ['selected', 'hover', 'armed'].includes(c)).sort();
	assert.deepEqual([loaded, selected, hovered, armed, cleared, deselected].map(tokens), [[], ['selected'], ['hover', 'selected'], ['armed', 'hover', 'selected'], ['selected'], []],
		'each mark set and cleared on the pipe\'s line');
	assert.notEqual(selected.stroke, loaded.stroke, 'the selected pipe is drawn in another colour');
	assert.equal(deselected.stroke, loaded.stroke, 'and its own again once deselected');
	assert.deepEqual(tab.thrown, [], 'nothing failed');
});
