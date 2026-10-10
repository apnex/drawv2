/*
THE ZONES PLUGIN'S GESTURES -- C-d, step one (H19.32; dev/design/unification/CANVAS-PLUGINS.md, D2: rows for shared gestures).

A zone is drawn with the canvas's shared BOX gesture -- Shift and drag on the canvas, a preview rect snapped to the zone's
half-offset grid -- and a released box with an area makes a zone. It is resized with the shared HANDLE gesture: four corner
handles on a lone selected zone, the corner diagonally across from the grabbed one staying put. The rows, the handles and
the arithmetic were the canvas's (app/src/recognize.js `zone-draw`, app/src/releases.js `ZONE_RELEASES`, app/src/input.js
`GESTURES.zone` and `resize`, app/src/overlay.js, app/src/snap.js `resizeBox`, `zoneCorners`); they are the zones plugin's
now, and the canvas runs the shared gestures they name. Nothing a user sees changes: the gesture corpus holds that.
*/

import { STD } from '../kernel/spec.mjs';
import { LAYOUTS, snapLayout } from '../kernel/geometry.mjs';
import { ZONE_EXT } from '../layouts/layout-table.mjs';   // WD-b1: the zone layout's extent, the layouts plugin's
import { makeZone } from './make-zone.mjs';

const MIN_ZONE = STD.pitch;   // a zone is at least one cell (B86), the pitch the kernel's

// a point on the zone grid -- offset by half a pitch, a zone bounding cells -- within the zone extent
function snapZone(pos) {
	const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
	return {
		x: clamp(snapLayout(LAYOUTS.zone, pos.x), -ZONE_EXT.x, ZONE_EXT.x),
		y: clamp(snapLayout(LAYOUTS.zone, pos.y), -ZONE_EXT.y, ZONE_EXT.y)
	};
}
// the box two corners span (app/src/snap.js `resolveBox`, restated: a plugin imports no canvas code)
const boxOf = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) });

/*
The four corners of a zone, named the way the handles are. B36 — this was written out twice with the
coordinates transposed: overlay.js placed handles at the ACTUAL corners, and input.js listed, for
each handle, the OPPOSITE corner to pin during a resize. Same four expressions, related by a mapping
that existed only in the reader's head.

Splitting it into a corner table plus an explicit OPPOSITE makes that relationship the thing being
stated, instead of something you recover by comparing two literals.
*/
const zoneCorners = (z) => ({
	nw: { x: z.x,       y: z.y },
	ne: { x: z.x + z.w, y: z.y },
	sw: { x: z.x,       y: z.y + z.h },
	se: { x: z.x + z.w, y: z.y + z.h },
});

// grab a handle, and the corner diagonally across from it is the one that stays put
const OPPOSITE_CORNER = { nw: 'se', ne: 'sw', sw: 'ne', se: 'nw' };

/*
A zone resize box from the dragged corner and the FIXED one. Enforces a one-cell minimum by pushing
INWARD when the fixed corner sits on an edge — a blind push there would be clamped straight back to
zero width.
*/
function resizeBox(pos, fixedCorner) {
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
	const box = boxOf(fixedCorner, corner);
	return { x: box.x, y: box.y, w: box.w, h: box.h };
}

// the zone's draw: Shift and left-drag on the canvas, with no tool held, opens the shared box gesture on the zone's grid
const ZONE_DRAW = {
	id: 'zone-draw', input: ['Shift+left on canvas'], mutates: true, doc: 'draw a zone',
	on: (e) => e.button === 0 && e.on.kind === 'canvas' && e.shiftKey,
	when: (s) => !s.tool,
	gesture: 'box',
	box: {
		place: 'zone',
		preview: 'zone-rect preview',
		// what a released box means: with an area, a zone over it, made and selected
		releases: [{ id: 'create-zone', mutates: true, on: (e) => e.type === 'up', when: (r) => r.area, run: (host, box) => host.create('zone', (model) => makeZone(model, box)) }],
	},
};

// a lone selected zone's corner handles, and what dragging one does -- RESHAPED live, the box its readout
const ZONE_HANDLES = {
	kind: 'zone',
	word: 'handle',   // what a press on one is called -- a corner handle
	key: 'corner',    // the dataset key a handle carries -- the hit's id (app/src/pick.js)
	rx: 2,
	points: (zone) => zoneCorners(zone),
	preview: 'reshape',
	// the corner diagonally across from the grabbed one stays put
	start: (zone, handle) => ({ fixedCorner: zoneCorners(zone)[OPPOSITE_CORNER[handle]], before: { x: zone.x, y: zone.y, w: zone.w, h: zone.h } }),
	at: (ctx, pos) => resizeBox(pos, ctx.fixedCorner),
	// what the release found: whether the box changed, and the box
	released: (ctx, after) => ({ changed: Object.keys(after).some((k) => after[k] !== ctx.before[k]), after }),
	releases: [{ id: 'resize', mutates: true, on: (e) => e.type === 'up', when: (r) => r.changed, run: (host, d) => host.set('resize', 'zone', d.id, d.after) }],
};

// a press on a corner handle opens the shared handle gesture -- handles are drawn ON TOP, so they win over what is beneath
const ZONE_RESIZE = {
	id: 'resize', input: ['left on handle'], context: 'a zone selected', mutates: true, doc: 'resize the zone',
	on: (e) => e.button === 0 && e.on.kind === ZONE_HANDLES.word,
	when: (s) => !s.tool,
	gesture: 'handle',
};

export const ZONE_PRESSES = [ZONE_DRAW, ZONE_RESIZE];
export const ZONE_HANDLE_SPECS = [ZONE_HANDLES];
