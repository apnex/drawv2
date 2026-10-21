/*
H26.1 (dev/design/components/SNAP-GRID.md section 4, acceptance step 4; section 6) -- THE SIDE-BY-SIDE SWEEP: draw's old grid
arithmetic against what replaces it, over one sweep of points and positions, both grids, bounded and unbounded, -0 told apart.

Draw's grids must not move by a pixel, and its REST answers must not change by a byte, beyond what section 6.3 rules. So every old
function is asked the questions its replacement is asked, over the same inputs, and the two answer lists are compared answer for
answer; where they differ, the difference is recorded with both answers and the 6.3 class it belongs to, and checked to be one --
by an exact rational oracle where the class is exactness. The old answers were read once from the old functions, while they
existed, into tests/fixtures/grid-parity-record.json; tests/grid-parity.test.js holds the replacements to that record.

  SWEEP        the inputs, generated here and never by hand: coordinates of both signs -- integers, lattice points of both grids
               and their neighbouring doubles, ties, cell edges and points one rounding from them, fractions, -0, tiny and huge
               magnitudes up to and past 2^50 -- points paired from them, positions, spans, layout records, selections, corners,
               devices and boards
  QUESTIONS    each question: the inputs it is asked over, and what an answer is, as JSON
  answersOf    one implementation's answers to every question, encoded (a -0 written "-0", NaN and the infinities by name)
  differences  where two answer lists differ, input by input
  exact        the oracle: a double's exact nearest, on, floor and ceiling on a lattice, by BigInt over its exact value
  CLASSES      the 6.3 classes a difference may belong to, each with the check that it does
*/

const P = 60, HALF = 30;                         // draw's pitch and the zone lattice's offset, as the old code held them
const NODE_EXT = { x: 900, y: 480 }, ZONE_EXT = { x: 930, y: 510 };

// ---- the neighbouring doubles of a double
const f64 = new Float64Array(1), i64 = new BigInt64Array(f64.buffer);
const nextUp = (v) => { if (Number.isNaN(v) || v === Infinity) return v; if (v === 0) return Number.MIN_VALUE; f64[0] = v; i64[0] += v > 0 ? 1n : -1n; return f64[0]; };
const nextDown = (v) => -nextUp(-v);
// a seeded generator, so the sweep is the same on every run (mulberry32)
function seeded(seed) {
	let a = seed >>> 0;
	return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const key = (v) => (Object.is(v, -0) ? '-0' : String(v));
const unique = (list) => { const seen = new Set(); return list.filter((v) => { const k = key(v); if (seen.has(k)) return false; seen.add(k); return true; }); };

// ---- the coordinates
function coordinates() {
	const out = [0, -0, Number.MIN_VALUE, -Number.MIN_VALUE, 1e-300, -1e-300, 1e-14, -1e-14, 0.5, -0.5, 1e-9, -1e-9];
	for (let v = -1981; v <= 1981; v += 7) out.push(v);                         // integers of both signs, every seventh
	for (let k = -40; k <= 40; k++) {
		for (const base of [k * P, k * P + HALF]) {                              // lattice points of both grids, and each one's cell edges
			out.push(base, nextUp(base), nextDown(base), base + 0.5, base - 0.5, base + 1e-9, base - 1e-9, base + 0.25, base - 0.75);
			for (const n of [44, 46, 47, 48, 49, 50, 52]) out.push(base + 2 ** -n, base - 2 ** -n);   // one rounding from either, and less
		}
	}
	for (const e of [450, 480, 510, 870, 900, 930, 960, 990, 1020]) for (const s of [1, -1]) { const v = s * e; out.push(v, v + 1, v - 1, nextUp(v), nextDown(v), v + 0.5, v - 0.5); }
	for (const big of [2 ** 40, 2 ** 48 + 30, 2 ** 49 - 1, 2 ** 49, 2 ** 49 + 1, 2 ** 49 + 30, 2 ** 50 - 61, 2 ** 50 - 30, 2 ** 50 - 1, 2 ** 50, nextUp(2 ** 50), 2 ** 50 + 30, 2 ** 51, 2 ** 53, Number.MAX_SAFE_INTEGER, 1e300]) out.push(big, -big);
	const r = seeded(0x26d1);
	for (let i = 0; i < 400; i++) out.push(Math.round((r() * 4000 - 2000) * 1e6) / 1e6);   // fractions anywhere on the surface and past it
	for (let i = 0; i < 100; i++) out.push((r() * 2 - 1) * 2 ** (r() * 52));               // magnitudes of every size
	return unique(out);
}
const COORDS = coordinates();
const inDomain = (v) => Number.isFinite(v) && Math.abs(v) <= 2 ** 50;
const DOMAIN = COORDS.filter(inDomain);
// points: each coordinate paired with another, and a cross of the coordinates that matter most -- the axes are independent in both
const KEYS = unique([0, -0, 29, 30, 31, -29, -30, -31, 59.999, 60, 89.5, 90, -90, 450, 480, 510, -480, -510, 899, 900, 901, 929, 930, 931, -900, -930, 1500, -1500, 1e-300, -60 - 2 ** -47, -30 + 2 ** -48]);
const POINTS = [...DOMAIN.map((x, i) => ({ x, y: DOMAIN[(i * 7 + 3) % DOMAIN.length] })), ...KEYS.flatMap((x) => KEYS.map((y) => ({ x, y })))];

export const SWEEP = {
	coords: COORDS,
	domain: DOMAIN,
	points: POINTS,
	// REST queries: the points, and every coordinate against 0 -- non-finite and past the domain among them
	queries: [...POINTS, ...COORDS.filter((v) => !inDomain(v)).flatMap((v) => [{ x: v, y: 0 }, { x: 0, y: v }]), ...[2 ** 49, 2 ** 49 + 1, -(2 ** 49) - 1, 2 ** 50].map((v) => ({ x: v, y: v })),
		{ x: NaN, y: 0 }, { x: 0, y: Infinity }, { x: -Infinity, y: 0 }],
	// what a field's check is handed: numbers of every kind, and things that are not numbers
	values: [...COORDS, NaN, Infinity, -Infinity, '60', null, true, {}, [], 'x'],
	indices: unique([...Array.from({ length: 121 }, (_, i) => i - 60), 2 ** 20, -(2 ** 20), 2 ** 40, -(2 ** 40), Math.floor((2 ** 50 - 30) / 60), -Math.floor((2 ** 50 - 30) / 60)]),
	spans: [undefined, null, ...Array.from({ length: 64 }, (_, i) => ({ cols: i + 1, rows: 64 - i })), { cols: 1, rows: 1 }, { cols: 3, rows: 2 }, { cols: 32, rows: 18 }],
};

// lattice points of the node grid within its extent, and a sample of pairs of them: the corners a text box spans
const nodeLattice = [];
for (let y = -NODE_EXT.y; y <= NODE_EXT.y; y += P) for (let x = -NODE_EXT.x; x <= NODE_EXT.x; x += P) nodeLattice.push({ x, y });
{
	const r = seeded(0x51d3);
	const pick = () => nodeLattice[Math.floor(r() * nodeLattice.length)];
	SWEEP.framePairs = [...nodeLattice.slice(0, 40).map((a, i) => [a, nodeLattice[nodeLattice.length - 1 - i]]), ...Array.from({ length: 400 }, () => [pick(), pick()]),
		...nodeLattice.filter((_, i) => i % 9 === 0).map((a) => [a, a])];
	// a device on a lattice point, its span and content, and a step -- the size step's inputs
	const spans = [undefined, { cols: 1, rows: 1 }, { cols: 2, rows: 3 }, { cols: 5, rows: 1 }, { cols: 16, rows: 9 }, { cols: 64, rows: 64 }];
	SWEEP.sizeSteps = [];
	for (let i = 0; i < 300; i++) {
		const at = pick(), span = spans[Math.floor(r() * spans.length)];
		const content = r() < 0.3 ? [{ content: 'text', value: 'x', at: [1, 0], cols: 2, rows: 2 }] : undefined;
		SWEEP.sizeSteps.push({ node: { id: 'node-00000a', type: 'host', x: at.x, y: at.y, ...(span ? { span } : {}), ...(content ? { content } : {}) }, dx: Math.floor(r() * 3) - 1, dy: Math.floor(r() * 3) - 1 });
	}
	for (const at of [{ x: 900, y: 480 }, { x: -900, y: -480 }, { x: 840, y: 420 }]) for (const [dx, dy] of [[1, 1], [-1, -1], [1, 0], [0, 1]]) SWEEP.sizeSteps.push({ node: { id: 'node-00000a', type: 'host', x: at.x, y: at.y, span: { cols: 1, rows: 1 } }, dx, dy });
	// a device's span against the surface's edge: within it, reaching it, past it
	SWEEP.devices = [];
	for (let i = 0; i < 300; i++) {
		const at = pick(), cols = 1 + Math.floor(r() * 40), rows = 1 + Math.floor(r() * 30);
		SWEEP.devices.push({ id: 'node-00000a', type: 'host', x: at.x, y: at.y, span: { cols, rows } });
	}
	SWEEP.devices.push({ id: 'node-00000a', type: 'host', x: 900, y: 480 }, { id: 'node-00000a', type: 'host', x: 840, y: 420, span: { cols: 2, rows: 2 } },
		{ id: 'node-00000a', type: 'host', x: 840, y: 420, span: { cols: 3, rows: 2 } }, { id: 'node-00000a', type: 'host', x: -900, y: -480, span: { cols: 31, rows: 17 } },
		{ id: 'node-00000a', type: 'host', x: -900, y: -480, span: { cols: 32, rows: 17 } }, { id: 'node-00000a', type: 'host', x: 0, y: 0, span: { cols: 2, rows: 1 }, content: [{ content: 'text', value: 'x', at: [1, 0] }] });
}
// zone lattice points within its extent: the fixed corners a zone resize holds, and the pointer positions dragged against them
{
	const zoneLattice = [];
	for (let y = -ZONE_EXT.y; y <= ZONE_EXT.y; y += P) for (let x = -ZONE_EXT.x; x <= ZONE_EXT.x; x += P) zoneLattice.push({ x, y });
	const r = seeded(0x20e5);
	const corners = [{ x: -930, y: -510 }, { x: 930, y: 510 }, { x: 930, y: -510 }, { x: -930, y: 510 }, { x: 30, y: 30 }, { x: -30, y: 90 }, ...Array.from({ length: 30 }, () => zoneLattice[Math.floor(r() * zoneLattice.length)])];
	const near = (c) => [c, { x: c.x + 1, y: c.y - 1 }, { x: c.x + 29, y: c.y + 31 }, { x: c.x - 31, y: c.y - 29 }, { x: c.x + 60, y: c.y }, { x: c.x, y: c.y - 60 }, { x: c.x + 2000, y: c.y }, { x: c.x, y: c.y - 2000 }];
	SWEEP.resizes = corners.flatMap((fixed) => [...near(fixed), ...POINTS.filter((_, i) => i % 97 === 0)].map((pos) => ({ fixed, pos })));
	// a selection's bounds within the zone extent -- the wrap is given nothing else: its entities sit on the lattices, sized in whole cells
	SWEEP.wraps = [];
	const ends = [-930, -900, -870, -510, -480, -450, -60, -30, 0, 30, 60, 450, 480, 510, 870, 900, 930];
	for (let i = 0; i < 400; i++) {
		const xs = [ends[Math.floor(r() * ends.length)], (Math.floor(r() * 31) - 15) * P].sort((a, b) => a - b);
		const ys = [ends[Math.floor(r() * ends.length)], (Math.floor(r() * 17) - 8) * P].sort((a, b) => a - b);
		SWEEP.wraps.push({ x: xs[0], y: ys[0], x2: xs[1], y2: ys[1] });
	}
	for (const b of [{ x: 0, y: 0, x2: 0, y2: 0 }, { x: -930, y: -510, x2: 930, y2: 510 }, { x: -900, y: -480, x2: 900, y2: 480 }, { x: 60, y: 60, x2: 60, y2: 60 }, { x: 30, y: 30, x2: 90, y2: 90 }]) SWEEP.wraps.push(b);
}
// layout records: draw's two, and others of other pitches, offsets and extents -- the drawn grid reads whatever record it is handed
SWEEP.records = [
	{ name: 'node', pitch: 60, offset: 0, ext: { x: 900, y: 480 } }, { name: 'zone', pitch: 60, offset: 30, ext: { x: 930, y: 510 } },
	{ name: 'node', pitch: 40, offset: 0, ext: { x: 400, y: 200 } }, { name: 'zone', pitch: 25, offset: 10, ext: { x: 260, y: 130 } },
	{ name: 'node', pitch: 7, offset: 3, ext: { x: 50, y: 31 } }, { name: 'zone', pitch: 60, offset: 30, ext: { x: 60, y: 30 } },
	{ name: 'node', pitch: 100, offset: 0, ext: { x: 99, y: 99 } },
];
// boards for the placement part: devices on the node lattice, a zone, and references on it and off it
SWEEP.boards = (() => {
	const r = seeded(0xb0a2);
	const boards = [];
	for (let b = 0; b < 12; b++) {
		const nodes = [];
		const count = b === 11 ? 527 : 2 + Math.floor(r() * 40);
		const taken = new Set();
		for (let i = 0; nodes.length < count && i < 5000; i++) {
			const at = b === 11 ? nodeLattice[nodes.length] : nodeLattice[Math.floor(r() * nodeLattice.length)];
			if (taken.has(`${at.x},${at.y}`)) continue;
			taken.add(`${at.x},${at.y}`);
			nodes.push({ id: `node-${(nodes.length + 1).toString(16).padStart(6, '0')}`, name: `n${nodes.length + 1}`, type: r() < 0.8 ? 'host' : undefined, x: at.x, y: at.y });
		}
		boards.push({ nodes, zones: [{ id: 'zone-000001', name: 'z', x: -330, y: -150, w: 360, h: 240 }] });
	}
	boards.push({ nodes: [{ id: 'node-000001', name: 'off', type: 'host', x: 1e-14, y: 0 }, { id: 'node-000002', name: 'on', type: 'host', x: 120, y: 0 }], zones: [] });
	return boards;
})();
SWEEP.asks = (board) => {
	const named = board.nodes.filter((n) => n.type).map((n) => n.name);
	const out = [{ inside: 'z' }, { inside: 'nope' }, {}];
	for (const name of named.slice(0, 6)) {
		out.push({ near: name });
		for (const dir of ['right', 'left', 'up', 'down']) out.push({ near: name, dir });
	}
	if (named.length > 1) out.push({ between: [named[0], named[1]] });
	return out;
};
SWEEP.names = ['node', 'zone', 'constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__', 'isPrototypeOf', 'nope', ''];

// ---- what an answer is, as JSON: a -0 is "-0", NaN and the infinities by name
export const enc = (v) => {
	if (typeof v === 'number') return Object.is(v, -0) ? '-0' : Number.isNaN(v) ? 'NaN' : v === Infinity ? 'Infinity' : v === -Infinity ? '-Infinity' : v;
	if (Array.isArray(v)) return v.map(enc);
	if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)]));
	return v === undefined ? null : v;
};

/*
THE QUESTIONS. Each names its inputs and the shape of its answer; an implementation answers each with a function of the same
signature. `grid` names the grid a question asks for the oracle: [origin, pitch], and `axis` how a point input reduces to a
coordinate for it.
*/
export const QUESTIONS = {
	'cellOf': { inputs: () => SWEEP.domain, grid: [0, P] },                         // the relation index's key, one axis
	'snapLayout.node': { inputs: () => SWEEP.domain, grid: [0, P] },
	'snapLayout.zone': { inputs: () => SWEEP.domain, grid: [HALF, P] },
	'cellOn.node': { inputs: () => SWEEP.domain, grid: [0, P] },
	'cellOn.zone': { inputs: () => SWEEP.domain, grid: [HALF, P] },
	'pxOn.node': { inputs: () => SWEEP.indices },
	'pxOn.zone': { inputs: () => SWEEP.indices },
	'anchor.x': { inputs: () => SWEEP.values, grid: [0, P] },                        // the anchor's field checks (product/kinds.mjs)
	'anchor.y': { inputs: () => SWEEP.values, grid: [0, P] },
	'zone.x': { inputs: () => SWEEP.values, grid: [HALF, P] },                       // the zone's (plugins/zones/zone-kind.mjs)
	'zone.y': { inputs: () => SWEEP.values, grid: [HALF, P] },
	'zone.w': { inputs: () => SWEEP.values, grid: [0, P] },
	'zone.h': { inputs: () => SWEEP.values, grid: [0, P] },
	'nearestAnchor.node': { inputs: () => SWEEP.queries, grid: [0, P] },             // the REST nearest route's answer
	'nearestAnchor.zone': { inputs: () => SWEEP.queries, grid: [HALF, P] },
	'anchorAt.node': { inputs: () => SWEEP.indices.map((c, i) => ({ cx: c, cy: SWEEP.indices[(i * 5 + 1) % SWEEP.indices.length] })) },
	'anchorAt.zone': { inputs: () => SWEEP.indices.map((c, i) => ({ cx: c, cy: SWEEP.indices[(i * 5 + 1) % SWEEP.indices.length] })) },
	'spanExtent': { inputs: () => SWEEP.spans },
	'snapNode': { inputs: () => SWEEP.points, grid: [0, P] },
	'snapIn.node': { inputs: () => SWEEP.points, grid: [0, P] },
	'snapIn.zone': { inputs: () => SWEEP.points, grid: [HALF, P] },
	'snapZone': { inputs: () => SWEEP.points, grid: [HALF, P] },
	'zoneResize': { inputs: () => SWEEP.resizes, grid: [HALF, P] },
	'zoneWrap': { inputs: () => SWEEP.wraps },
	'latticePoints': { inputs: () => SWEEP.records },
	'frameSpan': { inputs: () => SWEEP.framePairs },
	'deviceSizeStep': { inputs: () => SWEEP.sizeSteps },
	'deviceWithinSurface': { inputs: () => SWEEP.devices },
	'resolveAnchor': { inputs: () => SWEEP.boards.flatMap((board, b) => SWEEP.asks(board).map((at) => ({ board: b, at }))) },
	'layoutNamed': { inputs: () => SWEEP.names },
};

// a question whose answers are all true or false is written as one string of 1s and 0s; every other as a list
const BITS = new Set(['anchor.x', 'anchor.y', 'zone.x', 'zone.y', 'zone.w', 'zone.h']);
export function answersOf(impl) {
	const out = {};
	for (const [q, def] of Object.entries(QUESTIONS)) {
		const answers = def.inputs().map((input) => enc(impl[q](input)));
		out[q] = BITS.has(q) ? answers.map((a) => (a === true ? '1' : a === false ? '0' : '?')).join('') : answers;
	}
	return out;
}
const answerAt = (q, list, i) => (BITS.has(q) ? (list[i] === '1' ? true : list[i] === '0' ? false : list[i]) : list[i]);

// where two answer lists differ: [{ question, index, old, new }]
export function differences(old, now) {
	const out = [];
	for (const q of Object.keys(QUESTIONS)) {
		const a = old[q] ?? [], b = now[q] ?? [];
		for (let i = 0; i < Math.max(a.length, b.length); i++) {
			const x = answerAt(q, a, i), y = answerAt(q, b, i);
			if (JSON.stringify(x) !== JSON.stringify(y)) out.push({ question: q, index: i, old: x, new: y });
		}
	}
	return out;
}

/*
THE ORACLE: a double's exact value is an integer times a power of two, so (v - origin) / pitch is a ratio of integers, and its
nearest index -- half toward the greater, as Math.round rounds --, whether it is an integer, and its floor and ceiling are
exact in BigInt, with no rounding anywhere.
*/
function ratio(v, origin, pitch) {
	f64[0] = v;
	const bits = i64[0], sign = bits < 0n ? -1n : 1n, e = Number((bits >> 52n) & 0x7ffn), frac = bits & 0xfffffffffffffn;
	const m = e === 0 ? frac : frac | (1n << 52n), exp = (e === 0 ? 1 : e) - 1075;
	// v = sign * m * 2^exp; scale everything by 2^s so it is an integer
	const s = exp < 0 ? -exp : 0, V = sign * m * (exp >= 0 ? 1n << BigInt(exp) : 1n), S = 1n << BigInt(s);
	return { num: V - BigInt(origin) * S, den: BigInt(pitch) * S };   // (v - origin) / pitch = num / den, den > 0
}
const floorDiv = (a, b) => (a >= 0n ? a / b : -((-a + b - 1n) / b));
// a double's unit in the last place, as a power of two: 2^ulpExp(x)
const ulpExp = (x) => { f64[0] = Math.abs(x); const e = Number((i64[0] >> 52n) & 0x7ffn); return (e === 0 ? 1 : e) - 1075; };
export const exact = {
	nearest: (v, origin, pitch) => { const { num, den } = ratio(v, origin, pitch); return Number(floorDiv(2n * num + den, 2n * den)) + 0; },
	on: (v, origin, pitch) => { const { num, den } = ratio(v, origin, pitch); return num % den === 0n; },
	floor: (v, origin, pitch) => { const { num, den } = ratio(v, origin, pitch); return Number(floorDiv(num, den)) + 0; },
	ceil: (v, origin, pitch) => { const { num, den } = ratio(v, origin, pitch); return -Number(floorDiv(-num, den)) + 0; },
	// whether v lies within n roundings -- n units in the last place of v or of the origin, the greater -- of a lattice point or a
	// cell edge, the half-pitch marks of the lattice; all in BigInt, so a mark is never missed by the arithmetic that judges it
	nearMark: (v, origin, pitch, n = 4) => {
		const { num, den } = ratio(v, origin, pitch);                 // (v - origin) / pitch
		const k = floorDiv(4n * num + den, 2n * den);                 // the nearest half-pitch mark, in half pitches
		const off = (2n * num - k * den) < 0n ? k * den - 2n * num : 2n * num - k * den;   // |v - origin - k p / 2| * 2 den / p
		const u = Math.max(ulpExp(v), ulpExp(origin));                // the rounding: 2^u
		// off * p / (2 den) <= n 2^u
		const lhs = off * BigInt(pitch), rhs = 2n * den * BigInt(n);
		return u >= 0 ? lhs <= rhs * (1n << BigInt(u)) : lhs * (1n << BigInt(-u)) <= rhs;
	},
};

/*
THE CLASSES OF SECTION 6.3, "Changed by H26.1" -- the only differences allowed, each with what makes an entry one:
  rounding        a coordinate within one rounding of a cell's edge or a lattice point is decided exactly (D1): the replacement's
                  answer is the oracle's, the old one is not, and the coordinate lies within a few roundings of an edge or a point
  beyond-2^49     the REST nearest route answers a coordinate beyond 2^49 in magnitude 422 bad-query (D1) -- and it is the only door
                  that asks an unbounded grid for one: the canvas and the field checks ask within the extent, so the unbounded grid's
                  own answers beyond 2^49, which near 2^50 snap-grid clamps to its domain, reach no one
  inherited-name  a layout named by an inherited property is unknown, 404, where it answered 200 with nulls (B401)
  off-lattice-walk  the anchor walk from a reference off the lattice finds nothing, where float addition could round onto an
                  anchor (D1) -- no stored node is off the lattice, its fields being validated on it
*/
export const CLASSES = ['rounding', 'beyond-2^49', 'inherited-name', 'off-lattice-walk'];

/*
THE REPLACEMENTS -- each question asked of the product as it is now: the functions appendix B moved onto snap-grid, on the grids
section 5 opens (kernel/geometry.mjs `NODE_GRID` and `nodeGridWithin`, plugins/layouts/layout-table.mjs `ZONE_GRIDS`). RESTATED at H26.1's
move: when the old answers were recorded these were the same questions asked of snap-grid grids opened from their declarations in
this file, and the product, moved, must answer as they did -- the record's differences are theirs.

Where a site's question sits inside a route or an index rather than a function, it is asked of the grid that site asks: the relation
index's key (`cellOf` was injected; NODE_GRID's `nearest` is), the REST nearest and anchors routes (their bytes are compared whole
by tools/probe/rest-sweep.mjs), and the routes' layout lookup.
*/
import { NODE_GRID } from '../../kernel/geometry.mjs';
import { LAYOUT_TABLE, ZONE_GRIDS } from '../../plugins/layouts/layout-table.mjs';
import { snapNode, snapIn, placesOf } from '../../app/src/snap.js';
import { PRODUCT_CANVAS } from '../../product/canvas.mjs';
import { productKinds } from '../../product/kinds.mjs';
import { ZONE_HANDLE_SPECS } from '../../plugins/zones/zone-gestures.mjs';
import { ZONE_KEYS } from '../../plugins/zones/zone-keys.mjs';
import { LAYOUTS_CANVAS } from '../../plugins/layouts/layout-canvas.mjs';
import { DEVICE_PRESSES } from '../../plugins/devices/device-gestures.mjs';
import { DEVICE_SIZE_STEP } from '../../plugins/devices/device-size.mjs';
import { DEVICE_FIELDS } from '../../plugins/devices/device-fields.mjs';
import { spanThrough } from '../../plugins/devices/device-footprint.mjs';
import { resolveAnchor } from '../../server/anchor.mjs';

const ZONE = ZONE_GRIDS.unbounded;
const K = productKinds(), anchorField = K.row('node').fields, zoneField = K.row('zone').fields;
const places = placesOf(PRODUCT_CANVAS);
const pointOn = (grid, p) => grid.pointOf(grid.nearest(p));
const LIMIT = 2 ** 49;   // the REST nearest route's refusal (section 6.3, D1; server/rest.js)
const restNearest = (grid, p) => {
	if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || Math.abs(p.x) > LIMIT || Math.abs(p.y) > LIMIT) return 'refused';
	const n = grid.nearest(p), at = grid.pointOf(n);
	return [n.col, n.row, at.x, at.y];
};
const STUB = { freshId: () => 'zone-000001', nextName: () => 'z', nextOrder: () => 1 };   // what the zone factory asks of a Model
const boardModel = (b) => ({ all: (kind) => (kind === 'node' ? b.nodes : kind === 'zone' ? b.zones : []) });
const fakeModel = (record) => ({ get: (kind, id) => (kind === 'layout' ? { id, ...record } : undefined) });
const xy = (p) => [p.x, p.y];

export const REPLACEMENTS = {
	'cellOf': (v) => NODE_GRID.nearest({ x: v, y: 0 }).col,
	'snapLayout.node': (v) => pointOn(NODE_GRID, { x: v, y: 0 }).x,
	'snapLayout.zone': (v) => pointOn(ZONE, { x: v, y: HALF }).x,
	'cellOn.node': (v) => NODE_GRID.nearest({ x: v, y: 0 }).col,
	'cellOn.zone': (v) => ZONE.nearest({ x: v, y: HALF }).col,
	'pxOn.node': (c) => NODE_GRID.pointOf({ col: c, row: 0 }).x,
	'pxOn.zone': (c) => ZONE.pointOf({ col: c, row: 0 }).x,
	'anchor.x': (v) => anchorField.x(v),
	'anchor.y': (v) => anchorField.y(v),
	'zone.x': (v) => zoneField.x(v),
	'zone.y': (v) => zoneField.y(v),
	'zone.w': (v) => zoneField.w(v),
	'zone.h': (v) => zoneField.h(v),
	'nearestAnchor.node': (p) => restNearest(NODE_GRID, p),
	'nearestAnchor.zone': (p) => restNearest(ZONE, p),
	'anchorAt.node': ({ cx, cy }) => { const at = NODE_GRID.pointOf({ col: cx, row: cy }); return ['node', cx, cy, at.x, at.y]; },
	'anchorAt.zone': ({ cx, cy }) => { const at = ZONE.pointOf({ col: cx, row: cy }); return ['zone', cx, cy, at.x, at.y]; },
	'spanExtent': (span) => ((e) => [e.sw, e.sh])(spanThrough(span)),
	'snapNode': (p) => xy(snapNode(p)),
	'snapIn.node': (p) => xy(snapIn(places.get('node'), p)),
	'snapIn.zone': (p) => xy(snapIn(places.get('zone'), p)),
	'snapZone': (p) => xy(snapIn(places.get('zone'), p)),   // the zone drag's own snap is its place's, since snapZone went
	'zoneResize': ({ fixed, pos }) => ((b) => [b.x, b.y, b.w, b.h])(ZONE_HANDLE_SPECS[0].at({ fixedCorner: fixed }, pos)),
	'zoneWrap': (b) => {
		let box = null;
		ZONE_KEYS.find((k) => k.id === 'wrap').run({ selectionBounds: () => b, create: (kind, make) => { box = make(STUB); }, flash: () => {}, dims: () => '' });
		return box && [box.x, box.y, box.w, box.h];
	},
	'latticePoints': (record) => LAYOUTS_CANVAS.grids.find((g) => g.layout === record.name).points(fakeModel(record)).flatMap((p) => [p.x, p.y]),
	'frameSpan': ([a, b]) => ((f) => [f.x, f.y, f.w, f.h, f.origin.x, f.origin.y, f.cols, f.rows])(DEVICE_PRESSES.find((r) => r.id === 'tool').box.frame(a, b)),
	'deviceSizeStep': ({ node, dx, dy }) => ((s) => (s ? [s.span.cols, s.span.rows] : null))(DEVICE_SIZE_STEP.step(node, dx, dy)),
	'deviceWithinSurface': (n) => DEVICE_FIELDS.refers(n, null, n, null),
	'resolveAnchor': ({ board, at }) => ((r) => (r.ok ? [r.layout, r.cx, r.cy, r.x, r.y] : r.error))(resolveAnchor(boardModel(SWEEP.boards[board]), at)),
	'layoutNamed': (name) => LAYOUT_TABLE.find((l) => l.name === name)?.name ?? null,
};

/*
WHICH 6.3 CLASS A DIFFERENCE BELONGS TO, or null when none holds -- judged from the input and both answers, never from a list: the
generator classes each difference it records, and the test classes each again.
*/
const EXTENTS = { [`${0}`]: NODE_EXT, [`${HALF}`]: ZONE_EXT };
const BOUNDED = new Set(['snapNode', 'snapIn.node', 'snapIn.zone', 'snapZone', 'zoneResize']);
const coordinatesOf = (input) => (typeof input === 'number' ? [input] : input && typeof input.x === 'number' ? [input.x, input.y] : input && input.pos ? [input.pos.x, input.pos.y] : []);
// the exact answer to a point question: per axis the oracle's nearest index, clamped to the offered range when the grid is bounded
function exactPoint(question, input, [origin, pitch]) {
	const ext = EXTENTS[`${origin}`];
	return ['x', 'y'].map((axis) => {
		let i = exact.nearest(input[axis], origin, pitch);
		if (BOUNDED.has(question)) i = Math.min(Math.max(i, exact.ceil(-ext[axis], origin, pitch)), exact.floor(ext[axis], origin, pitch));
		return i;
	});
}
export function classOf(d) {
	const def = QUESTIONS[d.question], input = def.inputs()[d.index];
	if (d.question === 'layoutNamed') return typeof input === 'string' && !LAYOUT_TABLE.some((l) => l.name === input) && input in Object.prototype && d.new === null && d.old !== null ? 'inherited-name' : null;
	if (d.question.startsWith('nearestAnchor.') && d.new === 'refused' && d.old !== 'refused') return Math.abs(input.x) > LIMIT || Math.abs(input.y) > LIMIT ? 'beyond-2^49' : null;
	if (d.question === 'resolveAnchor') {
		const ref = SWEEP.boards[input.board].nodes.find((n) => n.name === input.at.near);
		return ref && input.at.dir && !(exact.on(ref.x, 0, P) && exact.on(ref.y, 0, P)) && d.new === `nothing free to the ${input.at.dir} of ${input.at.near}` && Array.isArray(d.old) ? 'off-lattice-walk' : null;
	}
	// the unbounded grids beyond 2^49: only the REST nearest route asks them a coordinate that large, and it refuses one (422)
	if (['cellOf', 'snapLayout.node', 'snapLayout.zone', 'cellOn.node', 'cellOn.zone'].includes(d.question) && Math.abs(input) > LIMIT) return 'beyond-2^49';
	if (!def.grid) return null;
	const [origin, pitch] = def.grid;
	if (!coordinatesOf(input).some((v) => Number.isFinite(v) && exact.nearMark(v, origin, pitch))) return null;
	// and the replacement's answer is the exact one
	const q = d.question, now = d.new;
	if (q === 'cellOf' || q.startsWith('cellOn.')) return now === exact.nearest(input, origin, pitch) ? 'rounding' : null;
	if (q.startsWith('snapLayout.')) return now === origin + pitch * exact.nearest(input, origin, pitch) ? 'rounding' : null;
	if (['anchor.', 'zone.'].some((p) => q.startsWith(p))) return now === exact.on(input, origin, pitch) && d.old === true ? 'rounding' : null;
	if (q.startsWith('nearestAnchor.')) { const [i, j] = exactPoint(q, input, def.grid); return Array.isArray(now) && now[0] === i && now[1] === j ? 'rounding' : null; }
	if (BOUNDED.has(q) && q !== 'zoneResize') { const [i, j] = exactPoint(q, input, def.grid); return now[0] === origin + pitch * i && now[1] === origin + pitch * j ? 'rounding' : null; }
	if (q === 'zoneResize') return 'rounding';   // the corner the drag snaps to, near a mark: its exactness is held by snapZone's own entries
	return null;
}
