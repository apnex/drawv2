/*
Snap — center-origin grid math, ported from client/src/grid.js. The pitch is now SOURCED FROM
THE KERNEL SPEC (STD.pitch) so the UI and the geometry kernel can never disagree on the grid
(AMENDED H26.1: from the node grid's declaration, NODE_GRID, which the kernel opens from it).
Node grid: multiples of pitch from origin. Zone grid: half-cell offset (±pitch/2 + k·pitch).
Extent clamps stay a UI concern (canvas margins).

H26.1 (dev/design/components/SNAP-GRID.md section 5, appendix B): where a point snaps is snap-grid's answer, asked of a grid
bounded by the extent -- `snapNode` of the node grid within NODE_EXT (`nodeGridWithin`), `snapIn` of the grid its place carries --
each the point of the position nearest the pointer, `pointOf(nearest(pos))`; the snap clamps the INDEX to the bounds, which equals
clamping the snapped coordinate because every extent sits on its lattice (section 2); the per-axis clamp and the half pitch went. What
stays draw's is a drag's clamp and its quantisation by the declared pitch (`clampDelta`), read from NODE_GRID's declaration.
RESTATED at H26.6's move 11 (dev/design/components/PAN-ZOOM.md section 3.8, "The extents"; 5.1 row 11): every snap is on the unbounded
lattices -- `snapNode` the node grid, `snapIn` the grid its place carries, which no extent bounds -- and `clampDelta` holds no edge; the
editor clamps nothing, the planner refusing what lies past PZ31's bound. RESTATED at H26.6's move 12 (5.1 row 12, GR3): the extent's
names -- `CANVAS`, the old 1920 by 1080 surface, and `NODE_EXT` -- are deleted with model/surface.mjs; no reader remained.
*/
import { L_STD } from '../../kernel/spec.mjs';
import { NODE_GRID } from '../../kernel/geometry.mjs';
// AMENDED C-e (H19.33): the grids' points are their parts'. AMENDED WD-b2 (H19.46): both grids are the layouts plugin's
// (plugins/layouts/layout-canvas.mjs), drawn by app/src/grids.js.
import { ANCHOR_KINDS } from '../../model/anchors.mjs';   // the bare anchor, asked in one place (F-b)
export const GAP = NODE_GRID.declaration.pitch;   // 60 -- the node grid's declared pitch: a length a drag, a nudge and a readout step by
export const NODE_R = L_STD.frame.ext;            // node frame half-extent — from the kernel spec (20)

// the point a grid places a pointer at: the position nearest it, as a fresh plain point a caller may keep or change, as it was. A
// point snap-grid cannot place -- a coordinate that is not finite, or beyond its domain, which no pointer event and no validated
// field is (SNAP-GRID.md section 6.2) -- snaps to no point. F6 (H26.1's verification): nor does one whose x or y is not a number, which
// the grid refuses with a TypeError where the old clamp answered NaN: it is asked of no grid
const pointOn = (grid, pos) => {
	const at = pos && typeof pos.x === 'number' && typeof pos.y === 'number' ? grid.nearest(pos) : null, p = at && grid.pointOf(at);
	return p ? { x: p.x, y: p.y } : { x: NaN, y: NaN };
};
// where the palette and every gesture drop a node: the node grid's position nearest the pointer, anywhere (H26.6's move 11)
export function snapNode(pos) {
	return pointOn(NODE_GRID, pos);
}

export function resolveBox(p1, p2) {
	return { x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y), w: Math.abs(p2.x - p1.x), h: Math.abs(p2.y - p1.y) };
}

export function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
// H26.4 (dev/design/components/VECTOR-SCENE.md section 5.3): draw's policy for keeping a hover -- the pointer within a node's frame of an
// entity's origin -- which Input hands the overlay as `near`, so the `editing` part imports none of the canvas's arithmetic
export const nearOrigin = (entity, pos) => dist(entity, pos) <= NODE_R;

/*
── DRAG GEOMETRY ─────────────────────────────────────────────────────────────────────────────────
Constrain a proposed movement to the grid and the surface. Lifted from `input.js` at H6.2 with the
bodies unchanged; `this.model` became a parameter. These belong here rather than in a new module
because the duty is already snap.js's — "constrain a position or delta to the grid and the surface"
— and A3 says a concern earns a boundary by being one concern, not by being noticed.
─────────────────────────────────────────────────────────────────────────────────────────────────*/


// axis lock (AutoCAD ORTHO): collapse the smaller component so a drag runs true
export function orthoDelta(delta, ortho) {
	if (!ortho) return delta;
	return Math.abs(delta.x) >= Math.abs(delta.y) ? { x: delta.x, y: 0 } : { x: 0, y: delta.y };
}

/*
Clamp a delta so EVERY moved entity stays on the surface -- the whole set moves together or the drag is refused at the edge, so a
multi-select never tears apart. RESTATED at H26.6's move 11 (dev/design/components/PAN-ZOOM.md section 3.8, "The extents"): there is no
surface and no edge. A place carries an unbounded grid, so every moved entity may go anywhere and the delta is answered as it is -- a whole
set moving together still, a base-snapped delta (`snappedDelta`) already quantised by the grid; past PZ31's bound the planner refuses the
edit and says why. The function keeps its place in every caller -- a drag, a clone, a duplicate -- a bounded grid, should a place carry
one again, still holding each entity's footprint inside its bounds.
*/
export function clampDelta(model, moved, delta, places) {
	let minX = -Infinity, maxX = Infinity, minY = -Infinity, maxY = Infinity;
	moved.forEach((m) => {
		const place = places.get(m.kind), entity = model.get(m.kind, m.id), bounds = place ? place.grid.declaration.bounds : null;
		if (!place || !entity || !bounds) return;   // move 11: an unbounded grid holds no edge
		const { w, h } = place.size(entity), { min, max } = bounds;
		minX = Math.max(minX, min.x - m.before.x); maxX = Math.min(maxX, max.x - w - m.before.x);
		minY = Math.max(minY, min.y - m.before.y); maxY = Math.min(maxY, max.y - h - m.before.y);
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
AMENDED H26.1 (SNAP-GRID.md section 5, appendix B): a place keeps its `layout` -- the name the grids it draws are matched by -- and
its `ext`, and carries its `grid`, the snap-grid grid bounded by that extent its kind snaps to: the anchor's from `nodeGridWithin`,
the zone's from the layouts plugin's `ZONE_GRIDS`. A place with no grid, or one whose grid's bounds are not its extent, is refused.
AMENDED H26.8's grid move (dev/design/components/NATIVE-SHAPES.md section 3.2, "A place carries its grid alone"; 4.9): a place is
`{ kind, layout, grid, size | sizedBy }`, its extent its grid's `bounds` -- the `ext` it kept beside the grid, and the check that the two
agreed, deleted. A place whose grid has no bounds has no extent to be held in, and is refused, naming its owner.
RESTATED at H26.6's move 11 (dev/design/components/PAN-ZOOM.md section 3.8, "The extents"): a place carries the unbounded lattice its kind
snaps to, so an unbounded grid is accepted; a place with no grid at all is still refused, naming its owner.
*/
/*
WD-b2 (H19.46; dev/design/unification/WIDE-DEVICES.md section 5.1) -- A PLACE'S SIZE COMES FROM ONE SOURCE, WHICH THE PLACE
DECLARES: its own `size`, as the zones plugin's carries a zone's, or `sizedBy: 'parts'` -- its kind's parts size it, as the
devices plugin declares a device's (`sizes`), at most one answering, and none meaning one cell, so a page composed without the
devices plugin draws every anchor one cell (CANVAS-PLUGINS.md: a page without a plugin's part draws none of what it brings).
A place declaring neither, or both, or sized twice -- its own size and a part's, or two parts' -- is refused here, when the canvas
is composed, naming the parts; a sizer answering nothing for an entity means one cell. What a size means stays the place's: for
the anchor, the extent beyond its cell from the cell's centre; for a zone, its whole box from its corner.
*/
export function placesOf(parts) {
	const places = new Map();
	for (const part of parts) {
		for (const p of part.places ?? []) {
			if (!p.grid?.declaration) throw new Error(`place: ${part.owner}'s place for ${p.kind} carries no grid -- a place snaps on the grid it carries`);
			if (places.has(p.kind)) throw new Error(`place: ${p.kind} is placed by ${places.get(p.kind).owner} and by ${part.owner}`);
			places.set(p.kind, { ...p, owner: part.owner });
		}
	}
	for (const [kind, p] of places) {
		const own = typeof p.size === 'function', byParts = p.sizedBy === 'parts';
		if (own === byParts) {
			throw new Error(`place: ${kind} ${own ? `declares both its own size and that its kind's parts size it, in ${p.owner}'s place` : `has no size -- ${p.owner}'s place declares neither its own size nor that its kind's parts size it`}`);
		}
		const sources = [
			...(own ? [{ who: `${p.owner}'s place`, size: p.size }] : []),
			...parts.filter((part) => typeof part.sizes?.[kind] === 'function').map((part) => ({ who: `${part.owner}'s sizes`, size: part.sizes[kind] })),
		];
		if (sources.length > 1) throw new Error(`place: ${kind} is sized by ${sources.map((s) => s.who).join(' and by ')} -- a placed kind takes its size from one source`);
		const size = sources[0]?.size ?? (() => undefined);
		places.set(kind, { ...p, size: (entity) => size(entity) ?? { w: 0, h: 0 } });
	}
	places.wordOf = (kind, e) => parts.map((p) => p.labels?.wordOf?.(kind, e)).find(Boolean) ?? kind;
	places.clonePrefixOf = (kind, e) => parts.map((p) => p.labels?.clonePrefixOf?.(kind, e)).find(Boolean) ?? places.wordOf(kind, e);
	return places;
}

// WD-b2 (H19.46): the grids the page draws -- each a part declares, on a layout some part places a kind on
export function gridsOf(parts) {
	const placed = new Set([...placesOf(parts).values()].map((p) => p.layout));
	return parts.flatMap((p) => (p.grids ?? []).filter((g) => placed.has(g.layout)));
}

// a point on a placed kind's grid: its place's grid, unbounded since H26.6's move 11
export function snapIn(place, pos) {
	return pointOn(place.grid, pos);
}
