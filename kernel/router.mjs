// ROUTER — paths as grid waypoints → rounded-corner SVG. Hand-routed for now: the engineer
// lays waypoints (cell centres / placed Waypoints), the router snaps them to the grid and
// renders the turns; an auto-router (later) populates the SAME waypoint list, so nothing
// downstream changes.
//
// Lifted from prism `NPath.buildCorner` (.refs/prism/model/factories/NPath.js): each interior
// waypoint becomes `L<entry> Q<corner> <exit>` — a quadratic Bézier with the vertex as the
// control point. Re-expressed here as a PURE function (no DOM, no grid-scale baked in) and
// hardened with per-corner radius clamping (prism's version could overshoot short segments).
//
// Determinism payoff: integer grid waypoints + axis-aligned segments + integer radius ⇒ every
// emitted coordinate is an integer. One schema → one exact path.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const len = (v) => Math.hypot(v[0], v[1]);
const scl = (v, s) => [v[0] * s, v[1] * s];
const r3 = (n) => { const v = Math.round(n * 1e3) / 1e3; return Object.is(v, -0) ? 0 : v; };
const fmt = (p) => `${r3(p[0])} ${r3(p[1])}`;

// the point `r` from `from` toward `to` (clamped to the segment length)
function toward(from, to, r) {
	const d = sub(to, from), l = len(d);
	if (l === 0) return from.slice();
	return add(from, scl(d, Math.min(r, l) / l));
}

/*
The TRAVERSABLE geometry of a route: the ordered lines and quadratic corners a rounded path is
actually made of. `{ kind: 'line', a, b }` and `{ kind: 'quad', a, c, b }`, where `c` is the
control point (the vertex the corner turns around).

ONE decomposition, TWO consumers. `roundedPath` emits the SVG string from this list, and
`pathLength` / `pointAtDistance` measure and sample the same list. The alternative -- a second
copy of the corner rule for anything that needs to travel the line -- is an undeclared twin of
the exact arithmetic scan-twins exists to catch, and the two copies would drift the first time
the radius rule changed.

It matters more than it looks. BEND_R is 20 on a 40px grid, so a consumer that walked the raw
anchor polyline instead would swing wide of the DRAWN line by up to ~8px at every bend -- a
visible departure from the very line it is supposed to be following.
*/
export function routeGeometry(pts, radius = 20, close = false) {
	if (!pts || pts.length < 2) return [];
	if (pts.length === 2 && !close) return [{ kind: 'line', a: pts[0], b: pts[1] }];
	const n = pts.length;
	const rAt = (prev, here, next) => Math.min(radius, len(sub(here, prev)) / 2, len(sub(here, next)) / 2);
	const out = [];
	const lineTo = (a, b) => { out.push({ kind: 'line', a, b }); };
	if (close) {
		let first = null, cursor = null;
		for (let i = 0; i < n; i++) {
			const prev = pts[(i - 1 + n) % n], here = pts[i], next = pts[(i + 1) % n], r = rAt(prev, here, next);
			const in_ = toward(here, prev, r), out_ = toward(here, next, r);
			if (cursor) lineTo(cursor, in_); else first = in_;
			out.push({ kind: 'quad', a: in_, c: here, b: out_ });
			cursor = out_;
		}
		lineTo(cursor, first);   // the closing run home. roundedPath draws this one as `Z`.
		return out;
	}
	let cursor = pts[0];
	for (let i = 1; i < n - 1; i++) {
		const prev = pts[i - 1], here = pts[i], next = pts[i + 1], r = rAt(prev, here, next);
		const in_ = toward(here, prev, r), out_ = toward(here, next, r);
		lineTo(cursor, in_);
		out.push({ kind: 'quad', a: in_, c: here, b: out_ });
		cursor = out_;
	}
	lineTo(cursor, pts[n - 1]);
	return out;
}

// waypoints (px) → SVG path `d` with rounded corners. radius clamps per-corner to half each
// adjacent segment so corners never overshoot or collide on short runs.
export function roundedPath(pts, radius = 20, close = false) {
	const geo = routeGeometry(pts, radius, close);
	if (!geo.length) return '';
	// A closed path's final run home is drawn by `Z`, so the string skips that segment while the
	// traversable list keeps it -- a mover still has to walk it.
	const upto = close ? geo.length - 1 : geo.length;
	let d = `M${fmt(geo[0].a)}`;
	for (let i = 0; i < upto; i++) {
		const g = geo[i];
		d += g.kind === 'line' ? ` L${fmt(g.b)}` : ` Q${fmt(g.c)} ${fmt(g.b)}`;
	}
	return close ? d + ' Z' : d;
}

/*
Measuring and sampling a route, for anything that TRAVELS it.

A quadratic corner is flattened into `QUAD_STEPS` chords rather than solved in closed form. The
closed form exists; flattening is chosen because it is deterministic in the same way on every
peer, and determinism is what lets two browsers and the server agree on where a thing is without
exchanging a single message about it. At radius 20 the error is far below a pixel.
*/
const QUAD_STEPS = 16;
const quadAt = (a, c, b, t) => {
	const u = 1 - t;
	return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
};

// the length of one primitive, in px
function segLength(g) {
	if (g.kind === 'line') return len(sub(g.b, g.a));
	let total = 0, prev = g.a;
	for (let i = 1; i <= QUAD_STEPS; i++) {
		const p = quadAt(g.a, g.c, g.b, i / QUAD_STEPS);
		total += len(sub(p, prev));
		prev = p;
	}
	return total;
}

// total travel distance along a route, in px
export function pathLength(geo) {
	let total = 0;
	for (const g of geo) total += segLength(g);
	return total;
}

// the point `d` px along a route. Clamps at both ends, so a caller that has not yet checked
// whether its traveller is still alive gets the start or the finish rather than a NaN.
export function pointAtDistance(geo, d) {
	if (!geo || !geo.length) return null;
	if (!(d > 0)) return geo[0].a.slice();
	let left = d;
	for (const g of geo) {
		const L = segLength(g);
		if (left > L) { left -= L; continue; }
		if (g.kind === 'line') {
			return L === 0 ? g.b.slice() : toward(g.a, g.b, left);
		}
		let prev = g.a, walked = 0;
		for (let i = 1; i <= QUAD_STEPS; i++) {
			const p = quadAt(g.a, g.c, g.b, i / QUAD_STEPS), step = len(sub(p, prev));
			if (walked + step >= left) return step === 0 ? p : toward(prev, p, left - walked);
			walked += step;
			prev = p;
		}
		return g.b.slice();
	}
	const last = geo[geo.length - 1];
	return last.b.slice();
}

// ---- grid snapping (hand-routed waypoints land exactly on the grid) ----
const snap1 = (v, step) => Math.round(v / step) * step;
export const gridSnap = (pts, step) => pts.map(([x, y]) => [snap1(x, step), snap1(y, step)]);

// segments of a waypoint list, for ortho / crossing checks
export function segmentsOf(pts, close = false) {
	const segs = [];
	for (let i = 0; i < pts.length - 1; i++) segs.push([pts[i], pts[i + 1]]);
	if (close && pts.length > 2) segs.push([pts[pts.length - 1], pts[0]]);
	return segs;
}
