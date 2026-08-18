// GEOMETRY — the grid (cell↔px) + the resolved element vocabulary + bboxOf. Pure geometry:
// no rendering, no I/O. Consumes the locked spec; everything downstream (engine, renderer,
// grc, router) consumes these primitives.
//
// Coordinate model: CELLS = the logical integer grid (center-origin). PX = resolved canvas
// units (cell · pitch). The single per-cell ANCHOR is the cell CENTRE (cellCenter) — routes
// thread cell centres; a Waypoint is a placeable anchor that bends a path between cells.
import { STD, L_STD, BEND_R } from './spec.mjs';

// ---- the grid: cell (logical, integer) ↔ px (resolved, center-origin) ----
export const px = (cell, V = STD) => cell * V.pitch;                       // one axis
export const cellPx = ([cx, cy], V = STD) => [cx * V.pitch, cy * V.pitch];
export const cellCenter = (cell, V = STD) => cellPx(cell, V);              // the one anchor per cell
// px → cell (one axis): the inverse of px(). Rounds a resolved coordinate to its nearest logical
// cell index; the `+ 0` normalizes signed zero (-0 → +0) so a cell never splits into "-0"/"0" keys.
// The SINGLE source for px→cell — used by the schema adapter (rendering/validation) and, INJECTED,
// by the engine to derive its staged `atCell` cell projection (R5).
export const cellOf = (v, V = STD) => Math.round(v / V.pitch) + 0;

// ---- element constructors (px coords, center-origin) ----
// The RESOLVED primitives — a flat scene is a list of these.
// A node anchors at (cx,cy) = its origin-cell centre. spanW/spanH are the px EXTENT BEYOND a 1×1
// frame (a multi-cell footprint grows +x/+y from the anchor); both 0 ⇒ today's 1-cell node, and
// the fields are omitted so a 1×1 node element stays byte-identical. (W1 — multi-cell span foundation.)
export const node = (cx, cy, o = {}) => {
	const n = { kind: 'node', cx, cy, frame: o.frame || 'circle', glyph: o.glyph || 'router', sel: !!o.sel };
	if (o.spanW) n.spanW = o.spanW;
	if (o.spanH) n.spanH = o.spanH;
	return n;
};
// waypoint: a placeable 40px-circle routing pivot. A path bends through its centre with r=20,
// so the bend is inscribed exactly in the circle. Permeable (not a routing obstacle).
export const waypoint = (cx, cy) => ({ kind: 'waypoint', cx, cy });
export const zone = (x, y, w, h) => ({ kind: 'zone', x, y, w, h });
export const group = (x, y, w, h) => ({ kind: 'group', x, y, w, h });
export const port = (cx, cy, o = {}) => ({ kind: 'port', cx, cy, style: o.style || 'square', size: o.size || 10 });
export const link = (x1, y1, x2, y2) => ({ kind: 'link', x1, y1, x2, y2 });
export const junction = (cx, cy) => ({ kind: 'junction', cx, cy });       // a tap point on a trunk
// path = a routed polyline through grid waypoints (px). The router renders it with rounded
// corners; GRC validates its turns. `pts` = [[x,y], …]; radius defaults to the locked bend.
export const path = (pts, o = {}) => ({ kind: 'path', pts, radius: o.radius ?? BEND_R, close: !!o.close });

// bounding box of an element (px). null for links/paths — they're lines, checked by endpoint.
export function bboxOf(el, L = L_STD) {
	if (el.kind === 'node' || el.kind === 'waypoint') { const e = L.frame.ext; return { x: el.cx - e, y: el.cy - e, w: 2 * e + (el.spanW || 0), h: 2 * e + (el.spanH || 0) }; }
	if (el.kind === 'port') return { x: el.cx - el.size / 2, y: el.cy - el.size / 2, w: el.size, h: el.size };
	if (el.kind === 'junction') return { x: el.cx - 6, y: el.cy - 6, w: 12, h: 12 };   // connection-pad footprint
	if (el.kind === 'zone' || el.kind === 'group') return { x: el.x, y: el.y, w: el.w, h: el.h };
	return null;
}

// group hull = bbox of member CENTRES padded by `ext` on all sides. centres = [{x,y},…];
// null for no members (avoids ±Infinity). One authority shared by the engine (resolve) and the
// live renderer so the two group-hull computations never drift.
export function groupHull(members, ext) {
	if (!members.length) return null;
	// members carry a footprint {x, y, w?, h?} (w/h default 0 ⇒ a point — byte-identical to the old
	// centres-only hull). A multi-cell node passes w/h = its span extent so its FAR edge is enclosed.
	const x = Math.min(...members.map((m) => m.x)) - ext;
	const y = Math.min(...members.map((m) => m.y)) - ext;
	const right = Math.max(...members.map((m) => m.x + (m.w || 0))) + ext;
	const bottom = Math.max(...members.map((m) => m.y + (m.h || 0))) + ext;
	return { x, y, w: right - x, h: bottom - y };
}
