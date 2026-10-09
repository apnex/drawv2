/*
Snap — center-origin grid math, ported from client/src/grid.js. The pitch is now SOURCED FROM
THE KERNEL SPEC (STD.pitch) so the UI and the geometry kernel can never disagree on the grid.
Node grid: multiples of pitch from origin. Zone grid: half-cell offset (±pitch/2 + k·pitch).
Extent clamps stay a UI concern (canvas margins).
*/
import { STD, L_STD } from '../../kernel/spec.mjs';
import { spanExtent, LAYOUTS, snapLayout } from '../../kernel/geometry.mjs';
// CL3: canvas surface + usable extents come from the sovereign model/ substrate (single source).
// IMPORTED (not a bare re-export) — snapNode/snapZone/grid-points reference NODE_EXT/ZONE_EXT locally.
import { SURFACE, NODE_EXT } from '../../model/surface.mjs';
import { ZONE_EXT } from '../../zones/zone-extent.mjs';   // the zones plugin's extent (O-b1)
import { ANCHOR_KINDS } from '../../model/anchors.mjs';   // the bare anchor, asked in one place (F-b)
export const GAP = STD.pitch;                     // 60 — from the kernel, not a local literal
export const HALF = GAP / 2;
export const NODE_R = L_STD.frame.ext;            // node frame half-extent — from the kernel spec (20)
export { spanExtent };                            // a multi-cell node's px footprint — one owner, in the kernel

// re-export the document-space magnitudes under the names snap.js consumers already use (CANVAS alias)
export { SURFACE as CANVAS, NODE_EXT, ZONE_EXT };

// B111: the GRID comes from the kernel layout, the CLAMP stays here -- canvas margins are a UI
// concern and the pitch is not. This function used to carry the offset itself, which made it one of
// two places the zone grid was defined and the only place it was defined correctly.
function clamped(L, v, min, max) {
	return Math.min(Math.max(snapLayout(L, v), min), max);
}

export function snapNode(pos) {
	return {
		x: clamped(LAYOUTS.node, pos.x, -NODE_EXT.x, NODE_EXT.x),
		y: clamped(LAYOUTS.node, pos.y, -NODE_EXT.y, NODE_EXT.y)
	};
}

export function snapZone(pos) {
	return {
		x: clamped(LAYOUTS.zone, pos.x, -ZONE_EXT.x, ZONE_EXT.x),
		y: clamped(LAYOUTS.zone, pos.y, -ZONE_EXT.y, ZONE_EXT.y)
	};
}


export function resolveBox(p1, p2) {
	return { x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y), w: Math.abs(p2.x - p1.x), h: Math.abs(p2.y - p1.y) };
}

export function pointInBox(pos, box) {
	return pos.x >= box.x && pos.x <= box.x + box.w && pos.y >= box.y && pos.y <= box.y + box.h;
}

export function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

// grid-dot positions for the two visual grids (node grid + half-offset zone grid)
export function nodePoints() {
	const points = [];
	for (let y = -NODE_EXT.y; y <= NODE_EXT.y; y += GAP) for (let x = -NODE_EXT.x; x <= NODE_EXT.x; x += GAP) points.push({ x, y });
	return points;
}
export function zonePoints() {
	const points = [];
	for (let y = -ZONE_EXT.y; y <= ZONE_EXT.y; y += GAP) for (let x = -ZONE_EXT.x; x <= ZONE_EXT.x; x += GAP) points.push({ x, y });
	return points;
}

/*
── DRAG GEOMETRY ─────────────────────────────────────────────────────────────────────────────────
Constrain a proposed movement to the grid and the surface. Lifted from `input.js` at H6.2 with the
bodies unchanged; `this.model` became a parameter. These belong here rather than in a new module
because the duty is already snap.js's — "constrain a position or delta to the grid and the surface"
— and A3 says a concern earns a boundary by being one concern, not by being noticed.
─────────────────────────────────────────────────────────────────────────────────────────────────*/

const MIN_ZONE = GAP;   // a zone is never smaller than one cell

// axis lock (AutoCAD ORTHO): collapse the smaller component so a drag runs true
export function orthoDelta(delta, ortho) {
	if (!ortho) return delta;
	return Math.abs(delta.x) >= Math.abs(delta.y) ? { x: delta.x, y: 0 } : { x: 0, y: delta.y };
}

/*
Clamp a delta so EVERY moved entity stays on the surface — the whole set moves together or the
drag is refused at the edge, so a multi-select never tears apart. Clamps the FOOTPRINT, not the
origin: a multi-cell node's far edge must stay inside the extent too, and the clamped value is
re-quantised to the grid so the group lands on cells rather than against the wall.
*/
// C-c: each moved entity held inside its kind's declared extent by its declared size (`places`, placesOf below)
export function clampDelta(model, moved, delta, places) {
	let minX = -Infinity, maxX = Infinity, minY = -Infinity, maxY = Infinity;
	moved.forEach((m) => {
		const place = places.get(m.kind), entity = model.get(m.kind, m.id);
		if (!place || !entity) return;
		const { w, h } = place.size(entity);
		minX = Math.max(minX, -place.ext.x - m.before.x); maxX = Math.min(maxX, place.ext.x - w - m.before.x);
		minY = Math.max(minY, -place.ext.y - m.before.y); maxY = Math.min(maxY, place.ext.y - h - m.before.y);
	});
	const clampAxis = (v, lo, hi) => {
		if (v < lo) return Math.ceil(lo / GAP) * GAP;
		if (v > hi) return Math.floor(hi / GAP) * GAP;
		return v;
	};
	return { x: clampAxis(delta.x, minX, maxX), y: clampAxis(delta.y, minY, maxY) };
}

/*
The delta a drag should commit: ortho-locked, snapped against the BASE entity (CAD's base point),
then clamped for the whole set. Snapping the base rather than each entity is what keeps a
multi-select rigid — every member moves by one delta, so relative positions are preserved exactly.
*/
export function snappedDelta(model, ctx, pos, ortho, places) {
	const base = ctx.moved.find((m) => m.id === ctx.baseId) || ctx.moved[0];
	const rawDelta = orthoDelta({ x: pos.x - ctx.start.x, y: pos.y - ctx.start.y }, ortho);
	const baseRaw = { x: base.before.x + rawDelta.x, y: base.before.y + rawDelta.y };
	const baseSnapped = snapIn(places.get(base.kind), baseRaw);   // C-c: on the base's own grid, within its own extent
	return clampDelta(model, ctx.moved, { x: baseSnapped.x - base.before.x, y: baseSnapped.y - base.before.y }, places);
}

/*
C-c (H19.31; CANVAS-PLUGINS.md, D1) -- THE PLACED KINDS, declared by the canvas parts that bring them: `places: [{ kind,
layout, ext, size(entity) -> { w, h } }]` -- the kernel layout its grid follows (the node grid, or the zone's half-offset one),
the extent it stays within, and its size beyond one cell, which the clamp holds inside the extent. Moving, duplicating,
cloning and nudging read these rather than asking whether a kind is an anchor or a zone. A layout the kernel lacks, a place
without a size, or a kind placed twice is refused, naming its owner.
*/
export function placesOf(parts) {
	const places = new Map();
	for (const part of parts) {
		for (const p of part.places ?? []) {
			if (!LAYOUTS[p.layout]) throw new Error(`place: ${part.owner}'s place for ${p.kind} names layout ${p.layout}, which the kernel does not have`);
			if (typeof p.size !== 'function') throw new Error(`place: ${part.owner}'s place for ${p.kind} has no size`);
			if (places.has(p.kind)) throw new Error(`place: ${p.kind} is placed by ${places.get(p.kind).owner} and by ${part.owner}`);
			places.set(p.kind, { ...p, owner: part.owner });
		}
	}
	return places;
}

// a point on a placed kind's grid, within its extent
export function snapIn(place, pos) {
	return {
		x: clamped(LAYOUTS[place.layout], pos.x, -place.ext.x, place.ext.x),
		y: clamped(LAYOUTS[place.layout], pos.y, -place.ext.y, place.ext.y)
	};
}

/*
The four corners of a zone, named the way the handles are. B36 — this was written out twice with the
coordinates transposed: overlay.js placed handles at the ACTUAL corners, and input.js listed, for
each handle, the OPPOSITE corner to pin during a resize. Same four expressions, related by a mapping
that existed only in the reader's head.

Splitting it into a corner table plus an explicit OPPOSITE makes that relationship the thing being
stated, instead of something you recover by comparing two literals.
*/
export const zoneCorners = (z) => ({
	nw: { x: z.x,       y: z.y },
	ne: { x: z.x + z.w, y: z.y },
	sw: { x: z.x,       y: z.y + z.h },
	se: { x: z.x + z.w, y: z.y + z.h },
});

// grab a handle, and the corner diagonally across from it is the one that stays put
export const OPPOSITE_CORNER = { nw: 'se', ne: 'sw', sw: 'ne', se: 'nw' };

/*
A zone resize box from the dragged corner and the FIXED one. Enforces a one-cell minimum by pushing
INWARD when the fixed corner sits on an edge — a blind push there would be clamped straight back to
zero width.
*/
export function resizeBox(pos, fixedCorner) {
	const corner = snapZone(pos);
	if (Math.abs(corner.x - fixedCorner.x) < MIN_ZONE) {
		const dir = corner.x >= fixedCorner.x ? 1 : -1;
		corner.x = fixedCorner.x + dir * MIN_ZONE;
		if (corner.x < -ZONE_EXT.x || corner.x > ZONE_EXT.x) corner.x = fixedCorner.x - dir * MIN_ZONE;
	}
	if (Math.abs(corner.y - fixedCorner.y) < MIN_ZONE) {
		const dir = corner.y >= fixedCorner.y ? 1 : -1;
		corner.y = fixedCorner.y + dir * MIN_ZONE;
		if (corner.y < -ZONE_EXT.y || corner.y > ZONE_EXT.y) corner.y = fixedCorner.y - dir * MIN_ZONE;
	}
	const box = resolveBox(fixedCorner, corner);
	return { x: box.x, y: box.y, w: box.w, h: box.h };
}
