// GEOMETRY -- the grid, the grid dot and the group hull.
// Pure geometry: no rendering, no I/O. Consumes the locked spec; everything downstream consumes these primitives.
// H25.5 (B378, D4): the old scene renderer's element helpers (node, zone, group, bboxOf, cellPx) retired with it.
// H26.1 (SNAP-GRID.md section 7.7): the grid's own arithmetic -- px, cellOf, LAYOUTS, onLayout, snapLayout, cellOn, pxOn,
// nearestAnchor, anchorAt and spanExtent -- deleted, its answers snap-grid's, asked of the grids opened below.
import { STD } from './spec.mjs';
import { openGrid } from '@apnex/snap-grid';   // H26.1: the lattice part alone composes the component (tools/layers.mjs COMPONENTS)

/*
H26.1 (dev/design/components/SNAP-GRID.md section 5) -- THE GRIDS, OPENED FROM DECLARATIONS, AND THE ONE PLACE DRAW OPENS ONE.

Where a position lies and which position lies nearest a point are snap-grid's to answer (H26-1, H26-4); what a grid is for --
what is drawn at a position, what may sit there, how a drag is held -- stays draw's. Every grid draw asks is NODE_GRID or is
opened through one of the two functions below, so two parts asking one grid ask one declaration (guardrail G7).

  latticeGrids(record)  a record of the layouts plugin's form, { pitch, offset, ext? }, opened into { bounded, unbounded }: the
                        grid bounded by the extent -- each axis from -ext to ext -- and the grid with no bounds; `bounded` is
                        null for a record with no extent. A record snap-grid refuses throws, naming every problem, so a bad
                        lattice fails where it is opened rather than answering wrongly later
  NODE_GRID             the node lattice with no bounds: the kernel's locked pitch, origin 0 -- the relation index, field
                        validation of positions and lengths, spans, steps and the REST routes ask it
  nodeGridWithin(ext)   the node lattice bounded by an extent the caller holds -- the kernel cannot read model/surface.mjs (C9),
                        so each part needing the node grid within its extent opens it here, every opening equal to the others
*/
export function latticeGrids({ pitch, offset, ext } = {}) {
	const lattice = { shape: 'square', pitch, origin: { x: offset, y: offset } };
	const open = (declaration) => {
		const opened = openGrid(declaration);
		if (!opened.ok) throw new Error(`latticeGrids: the lattice of pitch ${pitch}, offset ${offset}${ext ? `, extent ${ext.x} x ${ext.y}` : ''} is refused -- ${opened.problems.map((p) => `${p.problem} at ${p.pointer || '/'}`).join(', ')}`);
		return opened.grid;
	};
	return {
		bounded: ext === undefined ? null : open({ ...lattice, bounds: { min: { x: -ext?.x, y: -ext?.y }, max: { x: ext?.x, y: ext?.y } } }),
		unbounded: open(lattice),
	};
}
export const NODE_GRID = latticeGrids({ pitch: STD.pitch, offset: 0 }).unbounded;
export const nodeGridWithin = (ext) => latticeGrids({ pitch: NODE_GRID.declaration.pitch, offset: NODE_GRID.declaration.origin.x, ext }).bounded;

/*
H26.1 (SNAP-GRID.md appendix B; F3, H26.1's verification) -- AN ANCHOR, AS THE AGENT DOOR AND PLACEMENT ANSWER IT: a position on a
named layout's grid, carrying the layout's name, its cell and its point, `{ layout, cx, cy, x, y }` -- both representations, so no
consumer does arithmetic, and the layout with them, because a cell alone is ambiguous (B111). The one place the shape is stated: the
REST door's `nearest` and `anchors` routes (server/rest.js) and server-side placement (server/anchor.mjs) build it here, as they did
with `anchorAt` and `nearestAnchor`. The point is the grid's own for the position, never one a caller worked out.
*/
export function anchorOn(name, grid, position) {
	const point = grid.pointOf(position);
	return { layout: name, cx: position.col, cy: position.row, x: point.x, y: point.y };
}

/*
THE GRID DOT. A waypoint does not own it -- a waypoint HIGHLIGHTS it.

Every snap point on the node grid carries this dot, drawn dim at `#202020`. A waypoint sits exactly
on one and draws its OWN circle at the same radius over the top, in the waypoint colour -- shifting
again to green on a selected path, to `#66bb6a` while spawning, to red when armed.

Two physical circles, not one restyled. `#grid-nodes` is painted once at startup and a waypoint
renders into a layer above it, so the brighter dot occludes the dim one rather than recolouring it.
They are kept separate deliberately: reaching out of a waypoint's render to restyle a grid element
would couple two layers that are currently independent. What is shared is the RADIUS, which is the
part that has to agree -- a waypoint sitting a pixel off the grid point it occupies would be a lie
about where it is.

That is why this is `gridDot` rather than `waypointDot`, and why `app/src/main.js` draws the grid
with it. Two literals that both happened to be 2 is an agreement that holds until one is tuned and
nobody notices the other did not move.

It is a function, not a constant, because `DOT_RADIUS` fed the ladder arithmetic while BOTH
renderers drew a hardcoded 2.2 -- the kernel computed spacing for a dot neither of them painted.
Three copies of one number, and the two that mattered were invisible to the guard, which read its
own literal and agreed with the kernel.
*/
// the dot's radius: the floor of the waypoint ring ladder (plugins/network/appearance.mjs, B200), which reads it here
const DOT_RADIUS = 2;
export const gridDot = () => ({ radius: DOT_RADIUS });

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
