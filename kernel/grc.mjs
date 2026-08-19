// GEOMETRY RULE CHECK (the DRC). Consumes a resolved scene; returns per-rule pass/fail with
// the exact geometric reason — every failure must be diagnosable so we can hypothesise a fix.
// The turning-path rules (ortho, attachment, obstacle, overlap) judge every path. A WAYPOINT is a permeable routing anchor: a path may end or
// bend at one (attachment), but it is NOT a solid obstacle (a path threads through it).
import { bboxOf } from './geometry.mjs';
import { segmentsOf } from './router.mjs';

const onGrid = (v, step) => Math.abs(v / step - Math.round(v / step)) < 1e-6;
const frac = (v) => Math.abs(v - Math.round(v)) > 1e-6;
const overlapArea = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const isAxis = ([a, b]) => a[0] === b[0] || a[1] === b[1];

/*
The paths in a scene. This was `wiresOf`, and `wire` was a union type: it existed so the rule
checkers could iterate a `link` element and a `path` element together. Nothing ever constructed a
`link` element (B38), so the union had one live member and the abstraction was pure ceremony over a
filter. Deleting the dead kind collapses it, and frees `link` to mean exactly one thing in this
system — the document entity (HIERARCHY §0).
*/
const pathsOf = (els) => els.filter((el) => el.kind === 'path');

export function grc(elements, V, L) {
	const pitch = V.pitch, sub = pitch / 2, fe = L.frame.ext;
	const paths = pathsOf(elements);
	const out = [];

	// rule 1 — grid-snap / determinism: no fractional coords; node centres on the node grid;
	// port + path waypoints on the sub-grid. (Zone edges ride the ±zone.ext ladder — integer
	// & deterministic but not a clean sub-grid line; that ±29-vs-±30 tension is the deferred
	// `cell-align` consideration, deliberately NOT failed here.)
	const off = [];
	for (const el of elements) {
		if (el.kind === 'path') {
			// no fractional coord anywhere; interior CORNERS (the routing-determinism points)
			// ride the sub-grid; ENDPOINTS are exempt — they attach to a port/edge (which may
			// sit on the ±zone.ext ladder, not the clean cell line) and are gated by `attachment`.
			el.pts.forEach(([x, y], i) => {
				if (frac(x) || frac(y)) { off.push(`path-frac@(${x},${y})`); return; }
				const isEnd = !el.close && (i === 0 || i === el.pts.length - 1);
				if (!isEnd && (!onGrid(x, sub) || !onGrid(y, sub))) off.push(`path-corner-off-grid@(${x},${y})`);
			});
			continue;
		}
		const cs = (el.kind === 'node' || el.kind === 'port' || el.kind === 'waypoint') ? [el.cx, el.cy] : [el.x, el.y, el.x + el.w, el.y + el.h];
		for (const c of cs) if (frac(c)) off.push(`fractional@${c}`);
		if (el.kind === 'node' && (!onGrid(el.cx, pitch) || !onGrid(el.cy, pitch))) off.push(`node-off-grid@(${el.cx},${el.cy})`);
		// a waypoint is a cell-centre anchor → must land on the node grid like a node
		if (el.kind === 'waypoint' && (!onGrid(el.cx, pitch) || !onGrid(el.cy, pitch))) off.push(`waypoint-off-grid@(${el.cx},${el.cy})`);
		// a port rides a container edge: its ALONG-edge coord must be a sub-grid slot, its
		// edge-perpendicular coord is the edge (exempt) → on-sub-grid in AT LEAST one axis.
		if (el.kind === 'port' && !(onGrid(el.cx, sub) || onGrid(el.cy, sub))) off.push(`port-off-grid@(${el.cx},${el.cy})`);
	}
	out.push({ rule: 'grid-snap', pass: off.length === 0, why: off.join(', ') });

	// rule 2 — clearance: forbidden bbox overlaps (node↔node, zone↔zone, node↔port).
	// allowed: group over zone/node (cross-cut), port on a zone/group edge, waypoint anywhere
	// (it's a permeable routing pivot).
	const bb = elements.map((el) => ({ el, b: bboxOf(el, L) })).filter((x) => x.b);
	const forbidden = new Set(['node-node', 'zone-zone', 'node-port']);
	const clashes = [];
	for (let i = 0; i < bb.length; i++) for (let j = i + 1; j < bb.length; j++) {
		const A = bb[i], B = bb[j], pair = [A.el.kind, B.el.kind].sort().join('-');
		if (forbidden.has(pair) && overlapArea(A.b, B.b) > 1e-6) clashes.push(pair);
	}
	out.push({ rule: 'clearance', pass: clashes.length === 0, why: [...new Set(clashes)].join(', ') });

	// rule 3 — attachment: every path's free ENDS coincide with a port/node/junction/waypoint.
	// (closed paths have no free ends.)
	const anchors = elements.filter((el) => el.kind === 'port' || el.kind === 'node' || el.kind === 'junction' || el.kind === 'waypoint').map((el) => [el.cx, el.cy]);
	const at = (x, y) => anchors.some(([ax, ay]) => Math.hypot(ax - x, ay - y) < 1.5);
	const dangling = [];
	for (const w of paths) {
		if (w.close) continue;
		const a = w.pts[0], b = w.pts[w.pts.length - 1];
		if (!at(a[0], a[1])) dangling.push(`(${a[0]},${a[1]})`);
		if (!at(b[0], b[1])) dangling.push(`(${b[0]},${b[1]})`);
	}
	out.push({ rule: 'attachment', pass: dangling.length === 0, why: dangling.join(', ') });

	// rule 4 — reserve (no squish): adjacent zones must not overlap (cell-reserved space)
	const zones = elements.filter((el) => el.kind === 'zone').map((el) => bboxOf(el, L));
	const squish = [];
	for (let i = 0; i < zones.length; i++) for (let j = i + 1; j < zones.length; j++) if (overlapArea(zones[i], zones[j]) > 1e-6) squish.push(`zones[${i},${j}]`);
	out.push({ rule: 'reserve', pass: squish.length === 0, why: squish.join(', ') });

	// rule 5 — ortho: every path segment axis-aligned (no diagonals)
	const diag = [];
	for (const w of paths) for (const s of segmentsOf(w.pts, w.close)) if (!isAxis(s)) diag.push(`(${s[0][0]},${s[0][1]})-(${s[1][0]},${s[1][1]})`);
	out.push({ rule: 'ortho', pass: diag.length === 0, why: diag.join(' ') });

	// rule 6 — obstacle: a path segment must not pass through a NODE's interior unless it
	// attaches there. Nodes are SOLID cell-residents; zones and waypoints are permeable.
	const nodes = elements.filter((el) => el.kind === 'node');
	const attached = (p, nd) => Math.abs(p[0] - nd.cx) <= fe + 1e-6 && Math.abs(p[1] - nd.cy) <= fe + 1e-6;
	const segHitsNode = (s, nd) => {
		const [a, b] = s;
		if (attached(a, nd) || attached(b, nd)) return false;
		const x0 = nd.cx - fe, x1 = nd.cx + fe, y0 = nd.cy - fe, y1 = nd.cy + fe;
		if (a[0] === b[0]) { const X = a[0]; if (X <= x0 || X >= x1) return false; const lo = Math.min(a[1], b[1]), hi = Math.max(a[1], b[1]); return lo < y1 && hi > y0; }
		if (a[1] === b[1]) { const Y = a[1]; if (Y <= y0 || Y >= y1) return false; const lo = Math.min(a[0], b[0]), hi = Math.max(a[0], b[0]); return lo < x1 && hi > x0; }
		return false;
	};
	const hits = [];
	for (const w of paths) for (const s of segmentsOf(w.pts, w.close)) for (const nd of nodes) if (segHitsNode(s, nd)) hits.push(`@(${nd.cx},${nd.cy})`);
	out.push({ rule: 'obstacle', pass: hits.length === 0, why: [...new Set(hits)].join(' ') });

	// rule 7 — overlap: two DISTINCT paths must not run collinear over a shared SPAN. Drawing one
	// path on top of another reads as a single path and is invisible to the crossings metric
	// (which only counts perpendicular hits). Touching at a point is fine (a crossing/junction);
	// a shared segment length is not. This is the rule the routing walk proved was missing.
	const segs = [];
	paths.forEach((w, wi) => segmentsOf(w.pts, w.close).forEach((s) => { if (s[0][0] !== s[1][0] || s[0][1] !== s[1][1]) segs.push({ s, wi }); }));
	const ov = [];
	for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
		if (segs[i].wi === segs[j].wi) continue;
		const a = segs[i].s, b = segs[j].s;
		const aV = a[0][0] === a[1][0], bV = b[0][0] === b[1][0], aH = a[0][1] === a[1][1], bH = b[0][1] === b[1][1];
		if (aV && bV && a[0][0] === b[0][0]) {
			const lo = Math.max(Math.min(a[0][1], a[1][1]), Math.min(b[0][1], b[1][1])), hi = Math.min(Math.max(a[0][1], a[1][1]), Math.max(b[0][1], b[1][1]));
			if (hi - lo > 1e-6) ov.push(`x=${a[0][0]} y[${lo},${hi}]`);
		} else if (aH && bH && a[0][1] === b[0][1]) {
			const lo = Math.max(Math.min(a[0][0], a[1][0]), Math.min(b[0][0], b[1][0])), hi = Math.min(Math.max(a[0][0], a[1][0]), Math.max(b[0][0], b[1][0]));
			if (hi - lo > 1e-6) ov.push(`y=${a[0][1]} x[${lo},${hi}]`);
		}
	}
	out.push({ rule: 'overlap', pass: ov.length === 0, why: [...new Set(ov)].join(' ') });

	return out;
}

export const RULES = ['grid-snap', 'clearance', 'attachment', 'reserve', 'ortho', 'obstacle', 'overlap'];

// crossings metric (informational, NOT a gate — orthogonal crossings are legal in schematics):
// count of intersection points between segments of DIFFERENT paths.
const segCross = (s1, s2) => {
	const [a, b] = s1, [c, d] = s2;
	const v1 = a[0] === b[0], v2 = c[0] === d[0];
	if (v1 === v2) return false;                                   // parallel (both v or both h)
	const [VV, HH] = v1 ? [s1, s2] : [s2, s1];
	const X = VV[0][0], yLo = Math.min(VV[0][1], VV[1][1]), yHi = Math.max(VV[0][1], VV[1][1]);
	const Y = HH[0][1], xLo = Math.min(HH[0][0], HH[1][0]), xHi = Math.max(HH[0][0], HH[1][0]);
	return X > xLo && X < xHi && Y > yLo && Y < yHi;               // strict interior crossing
};
export function crossings(elements) {
	const segs = pathsOf(elements).flatMap((w, wi) => segmentsOf(w.pts, w.close).map((s) => ({ s, wi })));
	let n = 0;
	for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++)
		if (segs[i].wi !== segs[j].wi && segCross(segs[i].s, segs[j].s)) n++;
	return n;
}
