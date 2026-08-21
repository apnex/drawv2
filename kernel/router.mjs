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

// waypoints (px) → SVG path `d` with rounded corners. radius clamps per-corner to half each
// adjacent segment so corners never overshoot or collide on short runs.
export function roundedPath(pts, radius = 20, close = false) {
	if (!pts || pts.length < 2) return '';
	if (pts.length === 2 && !close) return `M${fmt(pts[0])} L${fmt(pts[1])}`;
	const n = pts.length;
	const rAt = (prev, here, next) => Math.min(radius, len(sub(here, prev)) / 2, len(sub(here, next)) / 2);
	let d = '';
	if (close) {
		for (let i = 0; i < n; i++) {
			const prev = pts[(i - 1 + n) % n], here = pts[i], next = pts[(i + 1) % n], r = rAt(prev, here, next);
			d += `${i === 0 ? 'M' : ' L'}${fmt(toward(here, prev, r))} Q${fmt(here)} ${fmt(toward(here, next, r))}`;
		}
		return d + ' Z';
	}
	d = `M${fmt(pts[0])}`;
	for (let i = 1; i < n - 1; i++) {
		const prev = pts[i - 1], here = pts[i], next = pts[i + 1], r = rAt(prev, here, next);
		d += ` L${fmt(toward(here, prev, r))} Q${fmt(here)} ${fmt(toward(here, next, r))}`;
	}
	return d + ` L${fmt(pts[n - 1])}`;
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
