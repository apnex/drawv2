// GEOMETRY — the grid (cell↔px) + the resolved element vocabulary + bboxOf. Pure geometry:
// no rendering, no I/O. Consumes the locked spec; everything downstream (engine, renderer,
// grc, router) consumes these primitives.
//
// Coordinate model: CELLS = the logical integer grid (center-origin). PX = resolved canvas
// units (cell · pitch). The single per-cell ANCHOR is the cell CENTRE (cellCenter) — routes
// thread cell centres; a Waypoint is a placeable anchor that bends a path between cells.
import { TOKENS } from './theme.mjs';
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

/*
LAYOUTS -- the named grids, and the one place either of them is defined.

There are two, and until now the kernel knew only the first. `cellOf` and `cellPx` are both offset
zero, which is the NODE grid; the half-pitch offset that ZONES use lived in `app/src/snap.js` and,
after B110, in `server/validate.js` as well (B111). Two restatements of a rule the kernel did not
hold, and a mistake the author of B110 duly made by hand while migrating a document.

A zone is offset because it BOUNDS cells rather than sitting on one, so its edges fall between them.
That is the whole of the difference, and naming it here is what lets a caller ask a layout instead
of remembering an offset.

An ANCHOR is a grid position. The term is deliberate and already this file's: the header calls the
cell centre the single per-cell anchor, and `model/model.mjs` already resolves a link route over
anchors while admitting a bare cell coord as a free one. A grid position and a route endpoint are
the same concept reached from two directions, so they keep one word.

Kernel-owned for now. Programmable or per-document layouts are wanted later; storing them in a
document today would duplicate a truth this module holds and let the two drift.
*/
export const LAYOUTS = {
	node: { name: 'node', offset: 0 },                  // nodes and waypoints sit ON cells
	zone: { name: 'zone', offset: STD.pitch / 2 },      // zones bound cells, so their edges fall between
};

export const layoutOf = (name) => LAYOUTS[name] || null;

// is a resolved coordinate ON this layout's grid
export const onLayout = (L, v, V = STD) => Number.isFinite(v) && (v - L.offset) % V.pitch === 0;

// the nearest legal coordinate on this layout (one axis)
export const snapLayout = (L, v, V = STD) => Math.round((v - L.offset) / V.pitch) * V.pitch + L.offset;

// px -> cell index on this layout (one axis); `+ 0` normalizes -0 so a cell never splits into two keys
export const cellOn = (L, v, V = STD) => Math.round((v - L.offset) / V.pitch) + 0;

// cell index -> px on this layout (one axis)
export const pxOn = (L, c, V = STD) => c * V.pitch + L.offset;

/*
The anchor nearest a resolved point, carrying BOTH representations.

The pixels are present so no consumer multiplies and the cell is present so no consumer divides --
the two arithmetic steps that produced every off-grid entity this vocabulary exists to prevent.
`layout` travels with it because the same cell index resolves to different pixels on the two grids,
so an anchor without its layout is ambiguous.
*/
export const nearestAnchor = (L, x, y, V = STD) => ({
	layout: L.name,
	cx: cellOn(L, x, V), cy: cellOn(L, y, V),
	x: snapLayout(L, x, V), y: snapLayout(L, y, V),
});

export const anchorAt = (L, cx, cy, V = STD) => ({
	layout: L.name, cx, cy, x: pxOn(L, cx, V), y: pxOn(L, cy, V),
});

// ---- element constructors (px coords, center-origin) ----
// The RESOLVED primitives — a flat scene is a list of these.
// A node anchors at (cx,cy) = its origin-cell centre. spanW/spanH are the px EXTENT BEYOND a 1×1
// frame (a multi-cell footprint grows +x/+y from the origin); both 0 ⇒ today's 1-cell node, and
// the fields are omitted so a 1×1 node element stays byte-identical. (W1 — multi-cell span foundation.)
export const node = (cx, cy, o = {}) => {
	const n = { kind: 'node', cx, cy, frame: o.frame || 'circle', glyph: o.glyph || 'router', sel: !!o.sel };
	if (o.spanW) n.spanW = o.spanW;
	if (o.spanH) n.spanH = o.spanH;
	return n;
};
/*
waypoint: a placeable 40px-circle routing pivot. A path bends through its centre with r=20, so the
bend is inscribed exactly in the circle. Permeable (not a routing obstacle).

`role` is DERIVED by the engine from the relations, never stored on the document: a waypoint in a
route's `via` is a BEND, one at its `from`/`to` is an ENDPOINT, and one at the from/to of a CLOSED
route is a bend again, because a ring has no ends. Carrying it on the element rather than deciding
in the renderer is what lets the live canvas and the SVG export agree without either restating the
rule -- they both consume this.
*/
export const waypoint = (cx, cy, role = 'bend') => ({ kind: 'waypoint', cx, cy, role });

/*
The bend/endpoint rule, in ONE place, because two renderers need the same answer.

The live editor builds addressable DOM for a person editing; the kernel builds a finished SVG for
everyone else. B28 ruled that split deliberate and it stands -- but the RULE for what a waypoint is
must not be duplicated across it, or the export and the canvas disagree and only one of them gets
looked at. That happened: the role landed in `resolve()`, which the client never calls.

Takes the LINKS TOUCHING this waypoint, which both callers already hold -- the kernel from
`schema.relations`, the client from the engine's maintained `linksAt` index. Each supplies its own
shape; neither restates the rule.

  in a route's via        -> bend, the path turns here
  at from/to, open route  -> endpoint, a line terminates here
  at from/to, CLOSED      -> bend, because a ring has no ends
  touched by nothing      -> bend, drawn plainly; the sweep will take it
*/
/*
How a waypoint of each role is DRAWN, beside the rule for what it is.

The two renderers are deliberately separate (B28) -- one keeps addressable DOM for a person editing,
the other emits a finished SVG string -- but they had each inlined the same four decisions: stroke
weight, radius, fill and opacity. Change the pad weight in one and the canvas and the export diverge
in silence, which is exactly the failure this pair produced twice while it was being built.

The kernel owns the numbers and each renderer owns only its emission. That is not a new idea here:
`L_STD`, `TOKENS`, `contentLayout`, `groupHull` and `roundedPath` already work this way and the
client imports every one of them. The waypoint style was the outlier.

B199 -- a waypoint is an ANCHOR, and a sub-type is an additive layer on top of it.

  anchor    a light hollow ring at the full extent, plus the centre dot. EVERY waypoint has one,
            whatever it does, because the anchor is what a waypoint IS -- a grid point a link can
            reach. It is not a style a role selects; it is the floor.
  endpoint  adds a heavy opaque pad INSIDE the anchor. The line still runs to the centre and the
            pad's fill masks it, so the path appears to terminate on the pad exactly as before.
  bend      adds nothing. The path turning is the whole rendering, and what a bend looked like was
            always just the anchor -- that is now stated rather than coincidental.

B200 -- THE LAYERS ARE A LADDER OF CONCENTRIC RINGS, on whole numbers.

Sub-types are expected to multiply, and a waypoint may carry several at once, so the layers have to
read as distinct rings when drawn together. Separation is measured between bands of INK, edge to
edge rather than centre to centre -- a stroke straddles its radius, so two rings can be far apart
by radius and still touch.

  layer     radius  width   ink            clear gap before it
  dot          2    solid    0.0 -  2.0
  junction     7      3      5.5 -  8.5    3.5
  endpoint    14      5     11.5 - 16.5    3.0
  anchor      20      2     19.0 - 21.0    2.5

EVERY RADIUS AND WIDTH IS A WHOLE NUMBER, and the gaps absorb the remainder instead. The first cut
of this rule fixed the gaps at exactly 3.0 and derived the radii, which produced 6.7 and 13.7 from
an inherited dot of 2.2 and an inherited anchor stroke of 1.6. Those two values were sediment --
the old bend's weight and the original dot size -- and deriving from them spread their awkwardness
through every layer that came after.

The director inverted it: pick round radii, let the gaps land where they land. 3.5 / 3.0 / 2.5 is
not uniform, and at canvas scale the difference is not perceptible -- the three variants were
rendered at 1:1 and compared before this was chosen.

Weight still carries meaning. The endpoint pad at 5 stays heavier than the junction ring at 3,
because a heavy ring says a line TERMINATES here; an equal-weight variant was rejected for making
the two rings read as peers.

A future sub-type takes a rung by the same arithmetic: choose a whole radius and width, keep the
ink clear of its neighbours. What the rule does NOT survive is a layer that is not a concentric
ring -- a square or a glyph has no single ink band, and that is a decision between the shape and
the ladder rather than something to solve here.
*/
const ANCHOR_WIDTH = 2;
const ANCHOR_OPACITY = 0.7;
const DOT_RADIUS = 2;
const JUNCTION_RADIUS = 7;
const JUNCTION_WIDTH = 3;
const ENDPOINT_RADIUS = 14;
const ENDPOINT_WIDTH = 5;

export const waypointStyle = (role, ext) => {
	const endpoint = role === 'endpoint';
	return {
		// the sub-type layer: what this waypoint adds to the anchor. `null` for a plain bend.
		width: endpoint ? ENDPOINT_WIDTH : ANCHOR_WIDTH,
		radius: endpoint ? ENDPOINT_RADIUS : ext,
		fill: endpoint ? TOKENS.panel : 'none',
		opacity: endpoint ? 1 : ANCHOR_OPACITY,
	};
};

/*
The anchor every waypoint draws, beneath whatever its sub-type adds.

Identical to what `waypointStyle('bend', ext)` returns, and that is the point rather than a
duplication: a bend adds no layer, so a bend IS its anchor. Naming it separately means an endpoint
can draw one too without asking for the style of a role it does not have.
*/
export const waypointAnchor = (ext) => ({
	radius: ext,
	width: ANCHOR_WIDTH,
	fill: 'none',
	opacity: ANCHOR_OPACITY,
});

/*
The junction ring -- the sub-type between the dot and the endpoint pad.

Hollow, because a junction says "these links are connected here" rather than "a line stops here",
and the path must stay visible running through it. That is the same reasoning the `junction`
ELEMENT already carries in the kernel renderer, which uses an opaque centre for a different job:
that one is a tie-point drawn instead of a waypoint, this one is a layer drawn on top of one.
*/
/*
THE GRID DOT. A waypoint does not own it -- a waypoint HIGHLIGHTS it.

Every snap point on the node grid carries this dot, drawn dim at `#202020`. A waypoint sits exactly
on one, and what it adds is brightness: the same circle at the same radius in the waypoint colour,
shifting again to green on a selected path, to `#66bb6a` while spawning, to red when armed. The
rings compose around a mark that was already on the canvas.

That is why this is `gridDot` rather than `waypointDot`, and why `app/src/main.js` draws the grid
with it. Two literals that both happened to be 2 is an agreement that holds until one is tuned and
nobody notices the other did not move.

It is a function, not a constant, because `DOT_RADIUS` fed the ladder arithmetic while BOTH
renderers drew a hardcoded 2.2 -- the kernel computed spacing for a dot neither of them painted.
Three copies of one number, and the two that mattered were invisible to the guard, which read its
own literal and agreed with the kernel.
*/
export const gridDot = () => ({ radius: DOT_RADIUS });

export const waypointJunction = () => ({
	radius: JUNCTION_RADIUS,
	width: JUNCTION_WIDTH,
	fill: 'none',
	opacity: 1,
});

/*
PREVIEW SCAFFOLDING -- remove with B200.

The junction sub-type has no model behind it yet: nothing sets it, nothing reads it, and no
document can carry one. The director asked to SEE the ring against the other layers before the
behaviour is designed, so this flag draws it on every endpoint purely so the ladder can be judged
on screen at working zoom.

It is a constant rather than a config value on purpose. A flag someone can switch at runtime is a
feature with an off switch; this is a line of code with a deletion date, and the guard below pins
the real composition so that deleting it cannot quietly change what a waypoint is.
*/
export const PREVIEW_JUNCTION_ON_ENDPOINTS = true;

export const waypointRole = (id, touching) => {
	let endpoint = false;
	for (const t of touching || []) {
		if ((t.via || []).includes(id)) return 'bend';          // threaded: a corner, whatever else
		if (t.src === id || t.dst === id) {
			if (t.closed) return 'bend';                          // a ring has no ends
			endpoint = true;
		}
	}
	return endpoint ? 'endpoint' : 'bend';
};
export const zone = (x, y, w, h) => ({ kind: 'zone', x, y, w, h });
export const group = (x, y, w, h) => ({ kind: 'group', x, y, w, h });
export const port = (cx, cy, o = {}) => ({ kind: 'port', cx, cy, style: o.style || 'square', size: o.size || 10 });
export const junction = (cx, cy) => ({ kind: 'junction', cx, cy });       // a tap point on a trunk
// path = a routed polyline through grid waypoints (px). The router renders it with rounded
// corners; GRC validates its turns. `pts` = [[x,y], …]; radius defaults to the locked bend.
export const path = (pts, o = {}) => ({ kind: 'path', pts, radius: o.radius ?? BEND_R, closed: !!o.closed });

// bounding box of an element (px). null for links/paths — they're lines, checked by endpoint.
export function bboxOf(el, L = L_STD) {
	if (el.kind === 'node' || el.kind === 'waypoint') { const e = L.frame.ext; return { x: el.cx - e, y: el.cy - e, w: 2 * e + (el.spanW || 0), h: 2 * e + (el.spanH || 0) }; }
	if (el.kind === 'port') return { x: el.cx - el.size / 2, y: el.cy - el.size / 2, w: el.size, h: el.size };
	if (el.kind === 'junction') return { x: el.cx - 6, y: el.cy - 6, w: 12, h: 12 };   // connection-pad footprint
	if (el.kind === 'zone' || el.kind === 'group') return { x: el.x, y: el.y, w: el.w, h: el.h };
	return null;
}

/*
A node's footprint BEYOND its 1×1 frame, in px — the extent a multi-cell span adds on +x/+y.

One owner. This was five spellings of `(span.cols - 1) * pitch`: `spanPx` in the client renderer and
`spanExt` in input were the same function under two names, and the readout and the double-click
hit-test each inlined it again. `tools/scan-twins.mjs` cannot see one-liners — they fall below its
MIN_LINES floor — so this is the class of duplication a detector will not find and a reader must.

Takes the SPAN, not the entity: the kernel has no business knowing an entity's shape. Two other
`span` computations are deliberately NOT folded in, because they answer different questions with the
same field — `engine/relations.mjs` keys occupied CELLS, `kernel/adapt.mjs` builds cell RANGES.
*/
export const spanExtent = (span, V = STD) => ({
	sw: span ? (span.cols - 1) * V.pitch : 0,
	sh: span ? (span.rows - 1) * V.pitch : 0
});

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
