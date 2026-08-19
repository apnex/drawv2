/*
Snap — center-origin grid math, ported from client/src/grid.js. The pitch is now SOURCED FROM
THE KERNEL SPEC (STD.pitch) so the UI and the geometry kernel can never disagree on the grid.
Node grid: multiples of pitch from origin. Zone grid: half-cell offset (±pitch/2 + k·pitch).
Extent clamps stay a UI concern (canvas margins).
*/
import { STD, L_STD, spanExtent } from '../../kernel/index.mjs';
// CL3: canvas surface + usable extents come from the sovereign model/ substrate (single source).
// IMPORTED (not a bare re-export) — snapNode/snapZone/grid-points reference NODE_EXT/ZONE_EXT locally.
import { SURFACE, NODE_EXT, ZONE_EXT } from '../../model/index.mjs';
export const GAP = STD.pitch;                     // 60 — from the kernel, not a local literal
export const HALF = GAP / 2;
export const NODE_R = L_STD.frame.ext;            // node frame half-extent — from the kernel spec (20)
export { spanExtent };                            // a multi-cell node's px footprint — one owner, in the kernel

// re-export the document-space magnitudes under the names snap.js consumers already use (CANVAS alias)
export { SURFACE as CANVAS, NODE_EXT, ZONE_EXT };

function snapTo(v, gap, off, min, max) {
	const snapped = (Math.round((v - off) / gap) * gap) + off;
	return Math.min(Math.max(snapped, min), max);
}

export function snapNode(pos) {
	return {
		x: snapTo(pos.x, GAP, 0, -NODE_EXT.x, NODE_EXT.x),
		y: snapTo(pos.y, GAP, 0, -NODE_EXT.y, NODE_EXT.y)
	};
}

export function snapZone(pos) {
	return {
		x: snapTo(pos.x, GAP, HALF, -ZONE_EXT.x, ZONE_EXT.x),
		y: snapTo(pos.y, GAP, HALF, -ZONE_EXT.y, ZONE_EXT.y)
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
export function clampDelta(model, moved, delta) {
	let minX = -Infinity, maxX = Infinity, minY = -Infinity, maxY = Infinity;
	moved.forEach((m) => {
		if (m.kind === 'node' || m.kind === 'waypoint') {
			const n = m.kind === 'node' ? model.get('node', m.id) : null;
			const { sw, sh } = spanExtent(n && n.span);
			minX = Math.max(minX, -NODE_EXT.x - m.before.x); maxX = Math.min(maxX, NODE_EXT.x - sw - m.before.x);
			minY = Math.max(minY, -NODE_EXT.y - m.before.y); maxY = Math.min(maxY, NODE_EXT.y - sh - m.before.y);
		} else {
			const entity = model.get('zone', m.id);
			if (!entity) return;
			minX = Math.max(minX, -ZONE_EXT.x - m.before.x); maxX = Math.min(maxX, ZONE_EXT.x - entity.w - m.before.x);
			minY = Math.max(minY, -ZONE_EXT.y - m.before.y); maxY = Math.min(maxY, ZONE_EXT.y - entity.h - m.before.y);
		}
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
export function snappedDelta(model, ctx, pos, ortho) {
	const base = ctx.moved.find((m) => m.id === ctx.baseId) || ctx.moved[0];
	const rawDelta = orthoDelta({ x: pos.x - ctx.start.x, y: pos.y - ctx.start.y }, ortho);
	const baseRaw = { x: base.before.x + rawDelta.x, y: base.before.y + rawDelta.y };
	const baseSnapped = base.kind === 'zone' ? snapZone(baseRaw) : snapNode(baseRaw);
	return clampDelta(model, ctx.moved, { x: baseSnapped.x - base.before.x, y: baseSnapped.y - base.before.y });
}

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
