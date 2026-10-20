#!/usr/bin/env node
/*
probe/rest-sweep.mjs -- H26.1 (dev/design/components/SNAP-GRID.md section 4, acceptance step 5; section 6.3). Are the agent door's
grid answers byte-identical before and after the move onto snap-grid, but for what section 6.3 rules?

Each side is one commit served from its own worktree on its own dependencies (tools/probe/sides.mjs), its server holding one pinned
board -- the parity board (tools/probe/boards.mjs) with a device at each corner of the node extent -- and both are asked the same
sweep of `GET .../layouts/<name>/nearest?x=&y=` and `GET .../layouts/<name>/anchors[?free=1]`: both layouts, the names every object
inherits, an unknown name; coordinates of both signs, ties, the extents' edges, fractions, -0, tiny and huge magnitudes to 2^49, 2^50
and past 2^53, what is not finite, what is not a number, a coordinate missing; seeded random points; and every coordinate the
side-by-side sweep recorded for `nearestAnchor` (tests/fixtures/grid-parity-record.json). Each answer is compared by status and by
its bytes, a node's id named by its stored name -- the board's ids are the same on both sides, so this changes nothing but is said.

A difference passes only as one class section 6.3 rules, judged again here from the query and both answers:

  inherited-name   a name an object inherits answered before -- 200, or 422 for a malformed query -- and is unknown, 404, after
                   (B401)
  beyond-2^49      a finite coordinate past 2^49 answered before and is refused 422 after, naming the limit (D1)
  rounding         a coordinate decided by a rounding: the answer after is the exact nearest position, by rational arithmetic
                   over the double as written, and the answer before is not (D1)

Anything else is unexplained, and the probe fails. Before it sweeps, the classifier is shown each class and a difference it must not
pass, so a classifier that passes everything cannot report a clean sweep.

  node tools/probe/rest-sweep.mjs [--baseline <commit>] [--candidate <commit>] [--out DIR]
      the baseline defaults to e9c1b62, the last commit before H26.1 moved anything; the candidate is the working tree when not named

Not a gate check: it installs a side's dependencies from its own lockfile and runs two servers. Every process is stopped and waited
for and every worktree removed; the report is left in --out.
*/
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { PARITY_DIAGRAM, parityBoard } from './boards.mjs';
import { ownDependencies } from './sides.mjs';   // H26.1 (G8): each side on its own dependencies

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const args = process.argv.slice(2);
const flag = (name, fallback = null) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const baseline = flag('baseline', 'e9c1b62'), candidate = flag('candidate');
const OUT = flag('out', fs.mkdtempSync(path.join(os.tmpdir(), 'draw-rest-sweep-')));
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LIMIT = 2 ** 49;
const LIMIT_REFUSAL = `nearest requires x and y within 2^49 (${LIMIT}) in magnitude`;

// ---- the exact nearest index: a double is n / 2^k exactly, and the position nearest it rounds (v - origin) / pitch half up
function fraction(v) {
	const view = new DataView(new ArrayBuffer(8));
	view.setFloat64(0, v);
	const hi = view.getUint32(0), lo = view.getUint32(4), biased = (hi >>> 20) & 0x7ff;
	const sign = hi >>> 31 ? -1n : 1n;
	let mantissa = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
	if (biased) mantissa |= 1n << 52n;
	const e = (biased || 1) - 1075;
	return e >= 0 ? { n: sign * (mantissa << BigInt(e)), d: 1n } : { n: sign * mantissa, d: 1n << BigInt(-e) };
}
const floorDiv = (a, b) => { const q = a / b; return a % b !== 0n && (a < 0n) !== (b < 0n) ? q - 1n : q; };
const exactIndex = (v, origin, pitch) => {
	const { n, d } = fraction(v), p = BigInt(pitch);
	return floorDiv(2n * (n - BigInt(origin) * d) + p * d, 2n * p * d);
};

// ---- the classifier: one query and both answers, a 6.3 class or null
const INHERITED = (name) => name in Object.prototype && !['node', 'zone'].includes(name);
// a body is a JSON value: the server indents what it sends, so a refusal is judged by what it says rather than its spacing
const says = (body, value) => { try { return JSON.stringify(JSON.parse(body)) === JSON.stringify(value); } catch { return false; } };
function classOf(q, before, after, lattices) {
	if (before.status === after.status && before.body === after.body) return 'same';
	// an inherited name answered before -- 200, or 422 for a query it then read -- and is refused for the name now, before its query
	if (INHERITED(q.name) && [200, 422].includes(before.status) && after.status === 404
		&& says(after.body, { error: `unknown layout: ${q.name}`, code: 'unknown-layout' })) return 'inherited-name';
	if (q.route !== 'nearest') return null;
	const x = Number(q.x ?? null), y = Number(q.y ?? null);
	if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
	if (Math.max(Math.abs(x), Math.abs(y)) > LIMIT) {
		return before.status === 200 && after.status === 422 && says(after.body, { error: LIMIT_REFUSAL, code: 'bad-query' }) ? 'beyond-2^49' : null;
	}
	const L = lattices[q.name];
	if (!L || before.status !== 200 || after.status !== 200) return null;
	const was = JSON.parse(before.body), now = JSON.parse(after.body);
	const exact = [exactIndex(x, L.offset, L.pitch), exactIndex(y, L.offset, L.pitch)];
	const on = (a) => BigInt(a.cx) === exact[0] && BigInt(a.cy) === exact[1];
	const placed = (a) => a.x === L.offset + L.pitch * a.cx && a.y === L.offset + L.pitch * a.cy && a.layout === q.name;
	return on(now) && placed(now) && !on(was) ? 'rounding' : null;
}

// shown each class, and a difference it must not pass, before it judges anything
function classifierProblems() {
	const L = { node: { pitch: 60, offset: 0 }, zone: { pitch: 60, offset: 30 } };
	const ok = (body) => ({ status: 200, body: JSON.stringify(body) });
	const cases = [
		['same', { name: 'node', route: 'nearest', x: '61', y: '0' }, ok({ layout: 'node', cx: 1 }), ok({ layout: 'node', cx: 1 })],
		['inherited-name', { name: 'constructor', route: 'anchors' }, ok({ layout: 'Object' }), { status: 404, body: '{"error":"unknown layout: constructor","code":"unknown-layout"}' }],
		['beyond-2^49', { name: 'zone', route: 'nearest', x: String(2 ** 50), y: '0' }, ok({}), { status: 422, body: JSON.stringify({ error: LIMIT_REFUSAL, code: 'bad-query' }) }],
		['rounding', { name: 'zone', route: 'nearest', x: '0', y: '-5e-324' },
			ok({ layout: 'zone', cx: 0, cy: 0, x: 30, y: 30, occupant: null }), ok({ layout: 'zone', cx: 0, cy: -1, x: 30, y: -30, occupant: null })],
		[null, { name: 'node', route: 'nearest', x: '61', y: '0' }, ok({ layout: 'node', cx: 1, cy: 0, x: 60, y: 0 }), ok({ layout: 'node', cx: 2, cy: 0, x: 120, y: 0 })],
		[null, { name: 'zone', route: 'nearest', x: '0', y: '-5e-324' },
			ok({ layout: 'zone', cx: 0, cy: -1, x: 30, y: -30, occupant: null }), ok({ layout: 'zone', cx: 0, cy: 0, x: 30, y: 30, occupant: null })],
		[null, { name: 'node', route: 'nearest', x: String(2 ** 49), y: '0' }, ok({}), { status: 422, body: JSON.stringify({ error: LIMIT_REFUSAL, code: 'bad-query' }) }],
		[null, { name: 'toString', route: 'nearest', x: '0', y: '0' }, ok({}), { status: 404, body: '{"error":"unknown layout: elsewhere","code":"unknown-layout"}' }],
		[null, { name: 'zone', route: 'anchors', free: null }, ok({ layout: 'zone' }), { status: 404, body: '{"error":"unknown layout: zone","code":"unknown-layout"}' }],
		[null, { name: 'node', route: 'anchors' }, ok({ count: 527 }), ok({ count: 526 })],
	];
	return cases.flatMap(([want, q, before, after], i) => { const got = classOf(q, before, after, L); return got === want ? [] : [`case ${i}: classed ${got}, expected ${want}`]; });
}

// ---- the sweep
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function queries() {
	const out = [];
	const nearest = (name, x, y) => out.push({ name, route: 'nearest', x, y });
	const num = (v) => (Object.is(v, -0) ? '-0' : String(v));
	const coords = [0, -0, 1, -1, 14, 15, 16, 29, 30, 31, -29, -30, -31, 45, 59, 60, 61, 89, 90, 91, -89, -90, -91, 0.5, -0.5, 29.5, 30.5,
		29.999999999999996, 30.000000000000004, 89.99999999999999, -60 - 2 ** -47, -30 + 2 ** -48, 30 - 2 ** -47, 90 + 2 ** -46, 1e-300, -1e-300,
		5e-324, -5e-324, 270, -150, -780, -390, 450, 480, 510, -480, -510, 870, 900, 930, 960, -870, -900, -930, -960, 990, 1000, -1000, 4980, 5000,
		-5000, 1e6, -1e6, 2 ** 40, 2 ** 48 + 30, 2 ** 49 - 1, 2 ** 49, -(2 ** 49), 2 ** 49 + 1, -(2 ** 49) - 1, 2 ** 49 + 30, 2 ** 50 - 30, 2 ** 50,
		-(2 ** 50), 2 ** 52 + 1, 2 ** 53, 2 ** 53 + 2, 1e17, 1e300, -1e300, Number.MAX_VALUE].map(num);
	const words = ['Infinity', '-Infinity', 'NaN', 'abc', '', '1e999', '0x10', ' 60 ', '6e1', '+30', '1_000'];
	for (const name of ['node', 'zone']) {
		for (const v of [...coords, ...words]) { nearest(name, v, '0'); nearest(name, '0', v); }
		for (const v of coords.slice(0, 40)) nearest(name, v, v);
		nearest(name, undefined, '60'); nearest(name, '60', undefined); nearest(name, undefined, undefined);
		const r = rng(name === 'node' ? 0x2611 : 0x2612);
		for (let i = 0; i < 200; i++) nearest(name, String(Math.round(r() * 2400 - 1200)), String(Math.round(r() * 1400 - 700)));
		for (let i = 0; i < 200; i++) nearest(name, String((r() - 0.5) * 2400), String((r() - 0.5) * 1400));
		for (const free of [null, '1', 'true', '0']) out.push({ name, route: 'anchors', free });
	}
	const record = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/grid-parity-record.json'), 'utf8'));
	for (const d of record.changed.filter((c) => c.question.startsWith('nearestAnchor.'))) nearest(d.question.split('.')[1], num(d.input.x), num(d.input.y));
	for (const name of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf', 'isPrototypeOf', 'toLocaleString', 'hexagon', 'Node', 'NODE']) {
		nearest(name, '0', '0'); nearest(name, '270', '-150'); nearest(name, 'abc', '0');
		for (const free of [null, '1']) out.push({ name, route: 'anchors', free });
	}
	return out;
}
const pathOf = (q) => {
	const query = new URLSearchParams();
	if (q.route === 'nearest') { if (q.x !== undefined) query.set('x', q.x); if (q.y !== undefined) query.set('y', q.y); }
	else if (q.free !== null) query.set('free', q.free);
	const s = query.toString();
	return `/api/v1/diagrams/${PARITY_DIAGRAM}/layouts/${encodeURIComponent(q.name)}/${q.route}${s ? `?${s}` : ''}`;
};

// the pinned board: the parity board, and a device at each corner of the node extent, so the extents' edges are occupied
function board() {
	const b = parityBoard();
	const corners = [[-900, -480], [900, -480], [-900, 480], [900, 480]];
	b.nodes.push(...corners.map(([x, y], i) => ({ id: `node-fe000${i + 1}`, name: `corner-${i + 1}`, type: 'host', shape: 'square', x, y, order: 100 + i })));
	return b;
}

// ---- the two sides
const freePort = () => new Promise((resolve) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); }); });
const procs = [], worktrees = [];
async function serve(name, commit) {
	let root = ROOT, deps = 'its own';
	if (commit) {
		root = path.join(OUT, `tree-${name}`);
		execFileSync('git', ['worktree', 'add', '--detach', root, commit], { cwd: ROOT, stdio: 'ignore' });
		worktrees.push(root);
		deps = ownDependencies(root, ROOT) === 'linked' ? 'linked from the root, its lockfile the same' : 'installed from its own lockfile';
	}
	const data = path.join(OUT, `data-${name}`);
	fs.mkdirSync(data, { recursive: true });
	const doc = board();
	fs.writeFileSync(path.join(data, `${doc.meta.id}.json`), JSON.stringify(doc));
	const port = await freePort();
	const p = spawn('node', ['server/server.js'], { cwd: root, env: { PATH: process.env.PATH, HOME: process.env.HOME, PORT: String(port), DATA_DIR: data }, detached: true, stdio: 'ignore' });
	procs.push(p);
	for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) break; } catch { /* not up */ } await sleep(200); }
	const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
	return { name, port, deps, sha: commit ? sha : `${sha} + working tree` };
}
async function stopAll() {
	for (const p of procs) {
		try { process.kill(-p.pid, 'SIGTERM'); } catch { /* gone */ }
		for (let i = 0; i < 100 && p.exitCode === null && p.signalCode === null; i++) await sleep(50);
		try { process.kill(-p.pid, 'SIGKILL'); } catch { /* gone */ }
	}
	for (const w of worktrees) { try { execFileSync('git', ['worktree', 'remove', '--force', w], { cwd: ROOT, stdio: 'ignore' }); } catch { /* left for git worktree prune */ } }
	for (const f of fs.readdirSync(OUT)) if (f.startsWith('data-')) fs.rmSync(path.join(OUT, f), { recursive: true, force: true });
}

const ask = async (side, p) => { const r = await fetch(`http://127.0.0.1:${side.port}${p}`); return { status: r.status, body: await r.text() }; };
// a node's id, named by its stored name: the same on both sides for the pinned board, and said rather than assumed
const named = (body, names) => body.replace(/"(node-[0-9a-f]{6})"/g, (m, id) => (names[id] ? `"<${names[id]}>"` : m));

let failed = false;
try {
	const problems = classifierProblems();
	if (problems.length) { console.error(`  \u2717 the classifier is wrong before it judges anything:\n    ${problems.join('\n    ')}`); failed = true; throw new Error('classifier'); }
	const sides = [await serve('baseline', baseline), await serve('candidate', candidate)];
	const names = {}, lattices = {};
	for (const side of sides) {
		const doc = await ask(side, `/api/v1/diagrams/${PARITY_DIAGRAM}`);
		if (doc.status !== 200) { console.error(`  \u2717 the ${side.name} side does not hold the pinned board (${doc.status})`); failed = true; throw new Error('board'); }
		names[side.name] = Object.fromEntries(JSON.parse(doc.body).nodes.map((n) => [n.id, n.name]));
	}
	for (const l of JSON.parse((await ask(sides[1], `/api/v1/diagrams/${PARITY_DIAGRAM}/layouts`)).body).layouts) lattices[l.name] = { pitch: l.pitch, offset: l.offset };
	const sweep = queries(), counts = {}, unexplained = [], changed = [];
	let occupied = 0;   // answers naming what holds the anchor: the sweep asked of occupied anchors, not only of empty ones
	for (const q of sweep) {
		const p = pathOf(q);
		const [before, after] = await Promise.all(sides.map((s) => ask(s, p)));
		before.body = named(before.body, names.baseline); after.body = named(after.body, names.candidate);
		if (after.body.includes('"occupant": "<') || after.body.includes('"occupant":"<')) occupied++;
		const c = classOf(q, before, after, lattices) ?? 'UNEXPLAINED';
		const key = `${q.route} ${c}`;
		counts[key] = (counts[key] ?? 0) + 1;
		if (c === 'UNEXPLAINED') unexplained.push({ path: p, before, after });
		else if (c !== 'same') changed.push({ path: p, class: c, before, after });
	}
	if (!occupied) { console.error('  \u2717 no answer named an occupant -- the board was not read, and the sweep proves nothing about occupancy'); failed = true; }
	const report = { baseline: sides[0], candidate: sides[1], queries: sweep.length, occupied, counts, changed, unexplained };
	fs.writeFileSync(path.join(OUT, 'rest-sweep.json'), `${JSON.stringify(report, null, '\t')}\n`);
	console.log(`  baseline ${sides[0].sha} (${sides[0].deps}); candidate ${sides[1].sha} (${sides[1].deps})`);
	console.log(`  ${sweep.length} queries, ${occupied} of them answered naming an occupant:`);
	for (const [k, n] of Object.entries(counts).sort()) console.log(`    ${k.padEnd(28)} ${n}`);
	for (const u of unexplained.slice(0, 20)) console.log(`  \u2717 ${u.path}\n      before ${u.before.status} ${u.before.body.slice(0, 160)}\n      after  ${u.after.status} ${u.after.body.slice(0, 160)}`);
	console.log(`  report: ${path.join(OUT, 'rest-sweep.json')}`);
	if (unexplained.length) failed = true;
	console.log(failed ? `  FAIL -- ${unexplained.length} difference(s) section 6.3 does not rule` : '  PASS -- every answer is byte-identical, or differs only as section 6.3 rules');
} catch (e) {
	if (!failed) { console.error(`  \u2717 ${e.stack}`); failed = true; }
} finally {
	await stopAll();
}
process.exit(failed ? 1 : 0);
