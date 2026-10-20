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
	const helper = text.match(/^const pointOn = (.*)$/m)?.[1] ?? '';
	assert.match(helper, /grid\.nearest\(pos\)/, 'the helper asks the grid its nearest position');
	assert.match(helper, /grid\.pointOf\(at\)/, 'and that position\'s point');
	assert.doesNotMatch(helper, /Math\.|[-+*/] *\d/, 'and does no arithmetic of its own');
});

/*
A rounding over a pitch: `Math.round`, `Math.floor` or `Math.ceil` whose argument divides by a pitch -- a name ending `pitch` or
`PITCH`, `GAP`, `HALF`, `P`, or a literal 60 or 30, the pitch and the half pitch -- or whose result is multiplied by one. Comments
are not code; the argument is read to its balancing parenthesis.
*/
const PITCH_WORD = String.raw`(?:[\w.]*pitch|[\w.]*PITCH|GAP|HALF|P|60|30)\b`;
const roundingsOverAPitch = (text) => {
	const out = [];
	for (const m of text.matchAll(/Math\.(?:round|floor|ceil)\(/g)) {
		let depth = 1, i = m.index + m[0].length;
		while (i < text.length && depth > 0) depth += text[i] === '(' ? 1 : text[i] === ')' ? -1 : 0, i++;
		const arg = text.slice(m.index + m[0].length, i - 1), after = text.slice(i, i + 40);
		if (new RegExp(String.raw`/\s*\(?\s*${PITCH_WORD}`).test(arg) || new RegExp(String.raw`^\s*\*\s*${PITCH_WORD}`).test(after)) out.push(text.slice(m.index, i));
	}
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
