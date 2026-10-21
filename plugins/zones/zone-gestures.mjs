/*
THE ZONES PLUGIN'S GESTURES -- C-d, step one (H19.32; dev/design/unification/CANVAS-PLUGINS.md, D2: rows for shared gestures).

A zone is drawn with the canvas's shared BOX gesture -- Shift and drag on the canvas, a preview rect snapped to the zone's
half-offset grid -- and a released box with an area makes a zone. It is resized with the shared HANDLE gesture: four corner
handles on a lone selected zone, the corner diagonally across from the grabbed one staying put. The rows, the handles and
the arithmetic were the canvas's (app/src/recognize.js `zone-draw`, app/src/releases.js `ZONE_RELEASES`, app/src/input.js
`GESTURES.zone` and `resize`, app/src/overlay.js, app/src/snap.js `resizeBox`, `zoneCorners`); they are the zones plugin's
now, and the canvas runs the shared gestures they name. Nothing a user sees changes: the gesture corpus holds that.
*/

import { ZONE_GRIDS } from '../layouts/layout-table.mjs';   // H26.1: the zone layout's grids, the layouts plugin's
import { makeZone } from './make-zone.mjs';

// H26.1 (SNAP-GRID.md section 5): a zone's corners lie on the zone grid -- offset by half a pitch, a zone bounding cells -- within the
// zone extent, the grid bounded by it
const ZONE_GRID = ZONE_GRIDS.bounded;

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
H26.1 (SNAP-GRID.md appendix B): the dragged corner is the zone grid's position nearest the pointer; where it shares the fixed corner's
column -- on the zone lattice, the only way the two can lie under a pitch apart -- it is the fixed corner's neighbour, `next(fixed,
'+x')`, or `next(fixed, '-x')` where there is none at the extent's edge; the same for rows. The box is the span of the two corners.
F6 (H26.1's verification): a corner the zone grid cannot place -- a coordinate not a number, not finite or beyond its domain, which
no pointer and no stored zone is -- gives a box of NaN, as the old arithmetic's NaN did, where asking the grid would throw.
*/
const positionOn = (grid, p) => (p && typeof p.x === 'number' && typeof p.y === 'number' ? grid.nearest(p) : null);
function resizeBox(pos, fixedCorner) {
	const dragged = positionOn(ZONE_GRID, pos), fixed = positionOn(ZONE_GRID, fixedCorner);
	if (!dragged || !fixed) return { x: NaN, y: NaN, w: NaN, h: NaN };
	const corner = {
		col: dragged.col === fixed.col ? (ZONE_GRID.next(fixed, '+x') ?? ZONE_GRID.next(fixed, '-x')).col : dragged.col,
		row: dragged.row === fixed.row ? (ZONE_GRID.next(fixed, '+y') ?? ZONE_GRID.next(fixed, '-y')).row : dragged.row,
	};
	const { through } = ZONE_GRID.span(fixed, corner);
	return { x: through.x, y: through.y, w: through.w, h: through.h };
}

// the zone's draw: Shift and left-drag on the canvas, with no tool held, opens the shared box gesture on the zone's grid --
// H24.5: on an existing zone too, which the left button no longer takes (zone-painter.mjs: a zone is pressed with the right),
// so a zone can be drawn over or inside another
const ZONE_DRAW = {
	id: 'zone-draw', input: ['Shift+left on canvas|zone'], mutates: true, doc: 'draw a zone',
	on: (e) => e.button === 0 && (e.on.kind === 'canvas' || e.on.kind === 'zone') && e.shiftKey,
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
