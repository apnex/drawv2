/*
H26.1 (dev/design/components/SNAP-GRID.md section 4, acceptance step 3; section 5; appendix B) -- DRAW'S GRID ARITHMETIC IS GONE: THE
KERNEL'S, SNAP.JS'S AND THE ZONES PLUGIN'S ROUNDING LEFT FOR SNAP-GRID, AND WHAT ROUNDS OVER A PITCH STILL IS RECORDED, EACH WITH ITS
REASON.

Where a point snaps, which cell it is in and what a span runs through are snap-grid's answers now, asked of the grids the kernel and
the layouts plugin open (`NODE_GRID`, `nodeGridWithin`, `latticeGrids`, `ZONE_GRIDS`). The kernel's arithmetic is deleted, not left
beside it: `px`, `cellOf`, `LAYOUTS`, `onLayout`, `snapLayout`, `cellOn`, `pxOn`, `nearestAnchor`, `anchorAt` and `spanExtent`, with
snap.js's per-axis clamp and half pitch and the zones plugin's `snapZone`. A copy left behind would drift from the grid it copies --
B107 and B111 were exactly that -- so this holds them gone, and holds every product module's `Math.round`, `Math.floor` or
`Math.ceil` over a pitch to the record below: the sites appendix B marks as staying draw's, and one it puts out of H26.1 (B402). A
count may only fall.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as geometry from '../kernel/geometry.mjs';
import { FOLDERS, LAYER } from '../tools/layers.mjs';

const root = path.resolve(import.meta.dirname, '..');
const code = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const DELETED = ['px', 'cellOf', 'LAYOUTS', 'onLayout', 'snapLayout', 'cellOn', 'pxOn', 'nearestAnchor', 'anchorAt', 'spanExtent'];

test('H26.1 (acceptance step 3): the kernel exports none of its grid arithmetic, snap.js holds no clamp or half pitch, the zones plugin no snapZone', () => {
	for (const name of DELETED) assert.equal(name in geometry, false, `kernel/geometry.mjs still exports ${name}`);
	assert.deepEqual(['NODE_GRID', 'latticeGrids', 'nodeGridWithin'].filter((n) => !(n in geometry)), [], 'control: what replaced them is exported');
	assert.doesNotMatch(code('app/src/snap.js'), /\b(clamped|HALF)\b/, 'app/src/snap.js holds `clamped` or `HALF`');
	assert.doesNotMatch(code('zones/zone-gestures.mjs'), /\bsnapZone\b/, 'zones/zone-gestures.mjs holds `snapZone`');
});

// snapNode and snapIn only ask snap-grid: each body is one call of the helper that asks a grid its nearest position and that point
const bodyOf = (text, name) => {
	const at = text.indexOf(`export function ${name}(`);
	assert.ok(at >= 0, `app/src/snap.js has no ${name}`);
	return text.slice(text.indexOf('{', at) + 1, text.indexOf('\n}', at)).trim();
};
test('H26.1 (acceptance step 3): snapNode and snapIn only ask snap-grid -- the point of the nearest position, on the grid of their extent', () => {
	const text = code('app/src/snap.js');
	assert.equal(bodyOf(text, 'snapNode'), 'return pointOn(NODES_WITHIN, pos);');
	assert.equal(bodyOf(text, 'snapIn'), 'return pointOn(place.grid, pos);');
	// RESTATED at H26.1's verification (F6): the helper spans lines now, guarding a point that is not a number; read to its closing `};`
	const helper = text.match(/^const pointOn = ([\s\S]*?)^\};?$/m)?.[1] ?? '';
	assert.match(helper, /grid\.nearest\(pos\)/, 'the helper asks the grid its nearest position');
	assert.match(helper, /grid\.pointOf\(at\)/, 'and that position\'s point');
	assert.doesNotMatch(helper, /Math\.|[-+*/] *\d/, 'and does no arithmetic of its own');
});

/*
A rounding over a pitch: `Math.round`, `Math.floor` or `Math.ceil` whose argument divides by a pitch -- a name ending `pitch` or
`PITCH`, `GAP`, `HALF`, `P`, or a literal 60 or 30, the pitch and the half pitch -- or whose result is multiplied by one. Comments
are not code; the argument is read to its balancing parenthesis.

STRENGTHENED at H26.1's verification (F2): the finder missed `(v-30)%60===0`, `Math.trunc(v/60)`, `Math.round(v/p)*p`, an aliased
`const S=60`, `60*Math.round(v/6e1)` and `/(2*30)`. So the text is first normalised, every spelling of the pitch made one word, and
then read:
  spellings  a name ending `pitch` or `PITCH`, `GAP`, `HALF` or `P`; a number literal whose value is 60 or 30 however written (`6e1`,
             `60.0`, `0x3c`), and a product of two literals that is one (`2*30`); and a name declared as any of these -- `const S =
             60`, `= STD.pitch`, `= GAP`, `{ pitch: S } =` -- and so on, alias of alias, to a fixpoint
  findings   `Math.round`, `floor`, `ceil` or `trunc` whose argument divides by the pitch, or whose result is multiplied by it on
             either side; one whose argument ends dividing by any name X and whose result is multiplied by the same X, a
             quantisation whatever X is called; and each remainder by the pitch, `% 60`, `% pitch`, `% S`
What it cannot see is a pitch reached through a call or an object -- `step()`, `cfg.s` -- which is the reviewer's to find.
*/
const PITCH = '__PITCH__';
const NUM = String.raw`(?<![\w$.])(?:0[xX][0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)(?![\w$.])`;
const NAME = String.raw`(?<![\w$.])(?:[\w$]+\.)*(?:[\w$]*(?:pitch|PITCH)|GAP|HALF|P)(?![\w$])`;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isPitch = (v) => v === 60 || v === 30;
function normalised(text) {
	const product = (m, a, b) => (isPitch(Number(a) * Number(b)) ? PITCH : m);
	let t = text.replace(new RegExp(String.raw`\(\s*(${NUM})\s*\*\s*(${NUM})\s*\)`, 'g'), product)
		.replace(new RegExp(String.raw`(${NUM})\s*\*\s*(${NUM})`, 'g'), product)
		.replace(new RegExp(NUM, 'g'), (m) => (isPitch(Number(m)) ? PITCH : m))
		.replace(new RegExp(NAME, 'g'), PITCH);
	for (let round = 0; round < 8; round++) {
		const aliases = new Set([
			...[...t.matchAll(new RegExp(String.raw`\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*${PITCH}\s*(?=[;,)\n]|$)`, 'g'))].map((m) => m[1]),
			...[...t.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}\s*=/g)].flatMap((m) => [...m[1].matchAll(new RegExp(String.raw`${PITCH}\s*:\s*([A-Za-z_$][\w$]*)`, 'g'))].map((n) => n[1])),
		].filter((a) => a !== PITCH));
		if (!aliases.size) break;
		for (const a of aliases) t = t.replace(new RegExp(String.raw`(?<![\w$.])${esc(a)}(?![\w$])`, 'g'), PITCH);
	}
	return t;
}
const roundingsOverAPitch = (text) => {
	const t = normalised(text), out = [];
	const divides = new RegExp(String.raw`/\s*\(?\s*${PITCH}(?![\w$])`);
	for (const m of t.matchAll(/Math\.(?:round|floor|ceil|trunc)\s*\(/g)) {
		let depth = 1, i = m.index + m[0].length;
		while (i < t.length && depth > 0) depth += t[i] === '(' ? 1 : t[i] === ')' ? -1 : 0, i++;
		const arg = t.slice(m.index + m[0].length, i - 1), after = t.slice(i, i + 80), before = t.slice(Math.max(0, m.index - 80), m.index);
		const by = (x) => new RegExp(String.raw`^\s*\*\s*${esc(x)}(?![\w$])`).test(after) || new RegExp(String.raw`(?<![\w$.])${esc(x)}\s*\*\s*\(?\s*$`).test(before);
		const divisor = arg.match(/\/\s*\(?\s*([A-Za-z_$][\w$.]*)\s*\)?\s*$/)?.[1];   // a name: a literal quantises only as the pitch
		if (divides.test(arg) || by(PITCH) || (divisor && by(divisor))) out.push(t.slice(m.index, i));
	}
	for (const m of t.matchAll(new RegExp(String.raw`%=?\s*\(?\s*${PITCH}(?![\w$])`, 'g'))) out.push(m[0]);
	return out;
};

test('H26.1: the rounding finder finds a rounding over a pitch and passes one that is not -- the control', () => {
	assert.equal(roundingsOverAPitch('const c = Math.round(v / pitch);').length, 1, 'a division by a pitch');
	assert.equal(roundingsOverAPitch('const c = Math.round(v / STD.pitch) + Math.floor((x + 30) / 60);').length, 2, 'the spec\'s pitch, and a literal');
	assert.equal(roundingsOverAPitch('const s = Math.floor(hi / GAP) * GAP, t = Math.ceil(lo / HALF);').length, 2, 'GAP and HALF');
	assert.equal(roundingsOverAPitch('const q = Math.round(v) * PITCH;').length, 1, 'a result multiplied by a pitch');
	assert.equal(roundingsOverAPitch('const c = Math.round(Math.max(a, b) / NODE_GRID.declaration.pitch);').length, 1, 'a nested call, and a declared pitch');
	assert.equal(roundingsOverAPitch('Math.round(n * 10) / 10; Math.floor(ms / 3600000); Math.round(d); Math.ceil(t / TICK_MS); Math.round(x / 600) * 1')
		.length, 0, 'none of these divides by a pitch or multiplies by one');
});

// F2 (H26.1's verification): the six spellings the finder missed, each its own case, and what must still pass
const MISSED = [
	['(v-30)%60===0', 'a remainder over the pitch'],
	['Math.trunc(v/60)', 'Math.trunc, beside round, floor and ceil'],
	['Math.round(v/p)*p', 'a quantisation by any one name, divided by and multiplied by'],
	['const S=60;\nexport const on = (v) => Math.round(v/S);', 'a name declared as the pitch'],
	['60*Math.round(v/6e1)', 'the pitch written before the call, and 60 spelled 6e1'],
	['Math.floor(v/(2*30))', 'the pitch as a product of literals'],
];
test('F2: each spelling the finder missed is found -- a remainder, trunc, a quantisation by a name, an alias, a pitch before the call, a product', () => {
	for (const [code, why] of MISSED) assert.equal(roundingsOverAPitch(code).length, 1, `${why}: ${code}`);
	for (const [code, why, count] of [
		['const s = x % pitch, t = x % GAP;', 'a remainder by a pitch name, twice', 2],
		['const { pitch: Q } = NODE_GRID.declaration;\nconst on = (v) => v % Q === 0;', 'a name destructured from a pitch', 1],
		['const A = STD.pitch;\nconst B = A;\nconst n = Math.ceil(v / B);', 'an alias of an alias', 1],
		['Math.round(v / 60.0); Math.floor(v / 0x3c); Math.ceil(v / 3e1)', 'other spellings of 60 and 30', 3],
		['const k = PITCH * Math.round(v / step);', 'the pitch before the call, whatever it divides by', 1],
	]) assert.equal(roundingsOverAPitch(code).length, count, `${why}: ${code}`);
	for (const code of ['cx % 5 === 0', 'ms % 1000', 'Math.trunc(x)', 'const n = 5;\nconst m = Math.round(v / n);', 'Math.round(n * 100) / 100',
		'const w = Math.round(v / 6) * 10;', "const css = 'calc(100% - 30px)';", 'Math.round(x / 600) * 600 + 0 * 30', 'const step = 2 * 3; Math.round(v / step) * 2']) {
		assert.deepEqual(roundingsOverAPitch(code), [], `no rounding over a pitch: ${code}`);
	}
});

const productModules = () => {
	const walk = (d, skip = []) => fs.readdirSync(path.join(root, d), { withFileTypes: true }).flatMap((e) => {
		const p = path.posix.join(d, e.name);
		if (skip.some((s) => p.startsWith(s))) return [];
		return e.isDirectory() ? walk(p, skip) : /\.m?js$/.test(e.name) ? [p] : [];
	});
	const all = new Set(Object.values(LAYER).flat());
	for (const f of FOLDERS) if (f.layer && !['tools', 'tests'].includes(f.layer)) for (const m of walk(f.dir, f.skip ?? [])) all.add(m);
	return [...all].filter((f) => fs.existsSync(path.join(root, f))).sort();
};

/*
F3 (H26.1's verification) -- AN ANCHOR'S SHAPE IS STATED ONCE, IN THE LATTICE. `{ layout, cx, cy, x, y }` was built twice, in the layouts
plugin for the REST door and inline in server-side placement; two statements of one shape drift. kernel/geometry.mjs's `anchorOn`
builds every anchor the agent door and placement answer, and no other product module writes an object with an anchor's `layout` and
`cx` -- read here as an object literal holding both keys.
*/
const ANCHOR_SHAPE = /\{\s*layout\s*:[^{}]*\bcx\s*:/;
test('F3: an anchor\'s shape is stated once, in the lattice -- every module the door and placement answer through builds it there', () => {
	assert.deepEqual(productModules().filter((f) => ANCHOR_SHAPE.test(code(f))), ['kernel/geometry.mjs']);
	for (const f of ['server/rest.js', 'server/anchor.mjs']) assert.match(code(f), /import \{[^}]*\banchorOn\b[^}]*\} from '\.\.\/kernel\/geometry\.mjs'/, `${f} builds its anchors with the lattice's anchorOn`);
	assert.equal(ANCHOR_SHAPE.test('return { layout: name, cx: p.col, cy: p.row, x, y };'), true, 'control: the shape is seen');
	assert.equal(ANCHOR_SHAPE.test("el('circle', { cx: pt.x, cy: pt.y, r });"), false, 'control: a circle\'s cx is no anchor');
});

// file -> { count, reason, cites }: every product module's rounding over a pitch, by appendix B's row for it
const RECORD = {
	'app/src/snap.js': { count: 2, cites: ['SNAP-GRID.md appendix B'],
		reason: '`clampDelta`: a drag\'s clamp and its quantisation by the declared pitch, which stays draw\'s' },
	'model/surface.mjs': { count: 2, cites: ['SNAP-GRID.md appendix B', 'B400'],
		reason: '`anchorCellsWithin`: the cap on how many things fit, which stays draw\'s; the zone cap kept (section 6.3, B400)' },
	'engine/spawners.mjs': { count: 1, cites: ['SNAP-GRID.md appendix B'],
		reason: 'a route\'s length in pitches, to two places, for the readout: a length read in the declared pitch, which stays' },
	'cli/verbs.mjs': { count: 4, cites: ['B402'],
		reason: 'a zone\'s cell range from literal 30 and 60: out of H26.1, registered (section 5; B402)' },
};

test('H26.1 (acceptance step 3): a rounding over a pitch is found only where the record says, each a site appendix B keeps draw\'s', () => {
	const modules = productModules();
	assert.ok(modules.includes('kernel/geometry.mjs') && modules.includes('app/src/snap.js') && modules.includes('server/rest.js') && modules.includes('cli/verbs.mjs'),
		'control: the product modules are the ones searched');
	const found = {};
	for (const f of modules) { const n = roundingsOverAPitch(code(f)).length; if (n) found[f] = n; }
	for (const [f, n] of Object.entries(found)) {
		assert.ok(RECORD[f], `${f} rounds over a pitch ${n} time(s): ${roundingsOverAPitch(code(f)).join('; ')} -- ask snap-grid, or record why it stays`);
		assert.ok(n <= RECORD[f].count, `${f}: ${n}, recorded ${RECORD[f].count} -- RISE`);
	}
	for (const [f, r] of Object.entries(RECORD)) {
		assert.equal(found[f] ?? 0, r.count, `${f} is recorded at ${r.count} and rounds over a pitch ${found[f] ?? 0} time(s) -- lower the record`);
		assert.ok(r.reason && r.cites.length > 0, `${f}: a recorded site states its reason and cites its row`);
	}
});
