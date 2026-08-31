// ENGINE — resolves a declarative SCHEMA (logical, cell-placed) into a flat SCENE (resolved
// px primitives) ready for the renderer and the GRC. The deterministic core: one schema → one
// scene. Containers are placed from CELL coords; routes thread cell-CENTRE anchors.
//
// ── SCHEMA ──────────────────────────────────────────────────────────────────────────────
// {
//   variant: 'standard',                         // optional (only `standard` for now)
//   entities: [
//     { id, kind:'node',     cell:[cx,cy], span?:{cols:[c0,c1],rows:[r0,r1]}, content?:[region…], frame?, glyph?, sel? },
//       (cell = the ORIGIN cell — glyph centre; span = the multi-cell footprint, absent ⇒ 1×1;
//        content = regions in the socket grid: { at:[col,row], cols, rows, content:'text'|'glyph', value/glyph, align?, outline?, bg?, rx?, fill? })
//     { id, kind:'waypoint', cell:[cx,cy] },                      // a placeable routing pivot
//     { id, kind:'zone',     span:{cols:[c0,c1], rows:[r0,r1]} }, // node-cell span → ladder hull
//     { id, kind:'group',    members:[ids] },                     // hugs its member nodes
//   ],
//   relations: [
//     { id?, route:{ from:ref, to:ref, via:[ref,…], radius?, close? } },   // hand-routed path
//   ],
// Each resolved scene element carries its source `id` (entity id, or relation/route id for a
// path) so an interactive host can map scene → DOM for hit-testing and state classes.
// }
// A route `ref` is an ENTITY id (node/waypoint → its cell centre) or a CELL coord [cx,cy]
// (→ that cell's centre). Bends therefore land on cell centres, on-grid by construction; a
// placed Waypoint makes a bend visible (and inscribes the r=20 turn), a bare [cx,cy] is a free
// bend. ONE anchor per cell = the centre. Parallel/mechanism realizers are a future additive
// layer (kept in design/sim), deliberately out of this kernel cut.
import { STD, derive, BEND_R } from './spec.mjs';
import { cellPx, node, waypoint, zone, group, path, groupHull } from './geometry.mjs';
import { gridSnap } from './router.mjs';

const VARIANTS = { standard: STD };
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

export function resolve(schema) {
	const V = VARIANTS[schema.variant || 'standard'];
	const L = derive(V);
	const ze = L.zone.ext, ge = L.group.ext;
	const byId = {};
	const scene = [];

	// 1 — nodes (cell → px centre)
	for (const e of schema.entities || []) {
		if (e.kind !== 'node') continue;
		const [cx, cy] = cellPx(e.cell, V);
		const o = { frame: e.frame, glyph: e.glyph, sel: e.sel };
		// a multi-cell footprint → px extent beyond a 1×1 frame, from the origin cell (+x/+y); 1×1 span → 0 → omitted.
		if (e.span) { o.spanW = (e.span.cols[1] - e.span.cols[0]) * V.pitch; o.spanH = (e.span.rows[1] - e.span.rows[0]) * V.pitch; }
		const el = node(cx, cy, o);
		if (e.content) el.content = e.content;   // W2 content regions (text/glyph in the socket grid) — pass through to the renderer
		el.id = e.id;
		byId[e.id] = { e, el, cx, cy, kind: 'node' };
		scene.push(el);
	}

	/*
	2 — waypoints (cell → px centre): placeable routing anchors.

	Their ROLE is derived here, from the relations this schema already carries, and never read off
	the document. A waypoint in a route's `via` is a BEND; one at its `from`/`to` is an ENDPOINT; one
	at the from/to of a CLOSED route is a bend again, because a ring has no ends. Deriving it means
	closing a path changes how its corners draw with nothing rewritten and nothing to fall out of
	step -- and the SVG export gets the same answer, because it resolves the same schema.
	*/
	const endpoints = new Set();
	const bends = new Set();
	for (const r of schema.relations || []) {
		const rt = r.route;
		if (!rt) continue;
		for (const v of rt.via || []) bends.add(v);
		// a ring has no ends, so a closed route's terminals are corners like any other
		if (rt.close) { bends.add(rt.from); bends.add(rt.to); }
		else { endpoints.add(rt.from); endpoints.add(rt.to); }
	}
	for (const e of schema.entities || []) {
		if (e.kind !== 'waypoint') continue;
		const [cx, cy] = cellPx(e.cell, V);
		// a bend wins: threaded through a route it is a corner, whatever else it also terminates
		const el = waypoint(cx, cy, bends.has(e.id) ? 'bend' : (endpoints.has(e.id) ? 'endpoint' : 'bend'));
		el.id = e.id;
		byId[e.id] = { e, el, cx, cy, kind: 'waypoint' };
		scene.push(el);
	}

	// 3 — zones (cell span → ladder hull at ±zone.ext around the spanned node cells)
	for (const e of schema.entities || []) {
		if (e.kind !== 'zone') continue;
		const cols = range(e.span.cols[0], e.span.cols[1]).map((c) => c * V.pitch);
		const rows = range(e.span.rows[0], e.span.rows[1]).map((r) => r * V.pitch);
		const left = cols[0] - ze, right = cols[cols.length - 1] + ze, top = rows[0] - ze, bot = rows[rows.length - 1] + ze;
		const el = zone(left, top, right - left, bot - top);
		el.id = e.id;
		byId[e.id] = { e, el, kind: 'zone', cx: (left + right) / 2, cy: (top + bot) / 2 };
		scene.push(el);
	}

	// 4 — groups (hug member node centres at ±group.ext)
	for (const e of schema.entities || []) {
		if (e.kind !== 'group') continue;
		const ms = e.members.map((id) => byId[id]).filter(Boolean);
		const hull = groupHull(ms.map((m) => ({ x: m.cx, y: m.cy, w: m.el.spanW || 0, h: m.el.spanH || 0 })), ge);   // span-aware: enclose multi-cell footprints
		if (!hull) continue;                         // no resolvable members → no hull (avoids ±Infinity)
		const el = group(hull.x, hull.y, hull.w, hull.h);
		el.id = e.id;
		byId[e.id] = { e, el, kind: 'group', cx: hull.x + hull.w / 2, cy: hull.y + hull.h / 2 };
		scene.push(el);
	}

	// 5 — relations (manual routing only for now)
	for (const r of schema.relations || []) {
		if (r.route) {
			const p = resolveRoute(r.route, byId, V);
			if (!p) continue;                        // dangling ref → skip this route, don't crash the render
			const rid = r.id ?? r.route.id;          // carry a link/route id through for DOM mapping
			if (rid != null) p.id = rid;
			scene.push(p);
			continue;
		}
		// (mechanism/parallel relations are a future additive layer — ignored here)
	}

	return { V, L, scene, byId };
}

// a hand-routed path: from/to/via are entity ids (→ centre) or cell coords [cx,cy] (→ centre).
// Bends land on cell centres; the path is snapped to the sub-grid and rounded at the locked r.
function resolveRoute(rt, byId, V) {
	const anchor = (ref) => {
		if (Array.isArray(ref)) return cellPx(ref, V);
		const b = byId[ref];
		return b ? [b.cx, b.cy] : null;            // unresolved entity ref
	};
	const pts = [rt.from, ...(rt.via || []), rt.to].map(anchor);
	if (pts.some((p) => p == null)) return null;   // a dangling route degrades to nothing, never throws
	return path(gridSnap(pts, V.pitch / 2), { radius: rt.radius ?? BEND_R, close: !!rt.close });
}
