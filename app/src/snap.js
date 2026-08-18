/*
Snap — center-origin grid math, ported from client/src/grid.js. The pitch is now SOURCED FROM
THE KERNEL SPEC (STD.pitch) so the UI and the geometry kernel can never disagree on the grid.
Node grid: multiples of pitch from origin. Zone grid: half-cell offset (±pitch/2 + k·pitch).
Extent clamps stay a UI concern (canvas margins).
*/
import { STD, L_STD } from '../../kernel/index.mjs';
// CL3: canvas surface + usable extents come from the sovereign document/ substrate (single source).
// IMPORTED (not a bare re-export) — snapNode/snapZone/grid-points reference NODE_EXT/ZONE_EXT locally.
import { SURFACE, NODE_EXT, ZONE_EXT } from '../../document/index.mjs';
export const GAP = STD.pitch;                     // 60 — from the kernel, not a local literal
export const HALF = GAP / 2;
export const NODE_R = L_STD.frame.ext;            // node frame half-extent — from the kernel spec (20)

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

export function samePos(a, b) { return a.x === b.x && a.y === b.y; }

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
