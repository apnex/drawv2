/*
THE ZONES PLUGIN'S KIND -- O-b1 (H19.19; dev/design/unification/KINDS-AS-PLUGINS.md; O1, every kind a plugin's).

A zone is a named box drawn behind the board: it bounds cells, so its edges fall between them, on the grid offset by half a
pitch. It was the core's kind -- its storage facts in model/shape.mjs, its checks and its cap in the planner, its factory on
the Model and its extent on the surface -- and is this plugin's now, whole, as the link is the network's
(plugins/network/link-kind.mjs). The product composes it between the node and the group (product/kinds.mjs `productKinds`), so a
document lists its collections as it always has. Its fields are what they were as the product's row: only the owner moved.
Its extent is zones/zone-extent.mjs and its factory plugins/zones/make-zone.mjs, apart so a composition that plans -- the planner
entry -- loads the row alone (tools/layers.mjs L10).
*/

import { NAME_MAX, COORD_BOUND, ZONE_CAP } from '../../model/limits.mjs';
import { NODE_GRID } from '../../kernel/geometry.mjs';
import { ZONE_GRIDS } from '../layouts/layout-table.mjs';   // H26.1: the zone layout's grids, the layouts plugin's

const ORDER_MAX = Number.MAX_SAFE_INTEGER;
/*
H26.1 (SNAP-GRID.md section 5, appendix B): ON a lattice is snap-grid's exact question, `positionAt`, one axis at a time with the other
held at the origin -- a zone's corner on the zone lattice with no bounds, its width and height on the node lattice, whose origin of 0
makes a length a coordinate. The extent check stays first. It decides exactly where `(v - offset) % pitch` rounded: a corner one
rounding from a zone lattice point, which that accepted, is refused (section 6.3, D1).
*/
const ZONE = ZONE_GRIDS.unbounded, { pitch: PITCH, origin: ZONE_ORIGIN } = ZONE.declaration, { origin: NODE_ORIGIN } = NODE_GRID.declaration;
const onZoneX = (v) => ZONE.positionAt({ x: v, y: ZONE_ORIGIN.y }) !== null;
const onZoneY = (v) => ZONE.positionAt({ x: ZONE_ORIGIN.x, y: v }) !== null;
const wholeCells = (v) => NODE_GRID.positionAt({ x: v, y: NODE_ORIGIN.y }) !== null;
// the checks are LOCAL, as every row's are: the trust boundary is never delegated (model/shape.mjs, B110, B113)
const str = (v, max) => typeof v === 'string' && v.length <= max;
const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const id = (v, kind) => typeof v === 'string' && new RegExp(`^${kind}-[0-9a-f]{6}$`).test(v);

const ZONE_ROW = {
	kind: 'zone',
	owner: 'zones',
	collection: 'zones',
	selectable: true,
	named: true,
	anchor: false,
	composite: [],
	optional: ['order'],
	references: [],
	fields: {
		id: (v) => id(v, 'zone'),
		name: (v) => str(v, NAME_MAX),
		// the zone grid is offset by half a pitch: a zone bounds CELLS, so its edges fall between them
		// H26.6's move 11 (PAN-ZOOM.md section 3.4, 3.8; PZ31): a corner an integer within the bound, on the zone lattice; a side a length,
		// whole cells from one to 2,000,000 -- the bound's span -- its far edge held to the bound by `refers`, below
		x: (v) => int(v, -COORD_BOUND, COORD_BOUND) && onZoneX(v),
		y: (v) => int(v, -COORD_BOUND, COORD_BOUND) && onZoneY(v),
		w: (v) => int(v, PITCH, 2 * COORD_BOUND) && wholeCells(v), // whole cells; minimum one -- no degenerate zones
		h: (v) => int(v, PITCH, 2 * COORD_BOUND) && wholeCells(v),
		order: (v) => int(v, 1, ORDER_MAX),   // the drawing order (F-d)
	},
	// B113: one zone to an anchor cell of its extent -- a backstop against a pathological document, occupancy speaking first
	/*
	B27 (H20.4) -- THE BOX WITHIN THE SURFACE: each field was checked alone, so a zone at x 870, w 1800 reached 2670 against an edge of
	930; the browser's drag held it inside (app/src/snap.js `clampDelta`), and now every door does. Judged on the zone as it would stand.
	RESTATED at H26.6's move 11 (PAN-ZOOM.md section 3.8, "The bound"; PZ31): within the bound, 1,000,000 from the origin, where it was the
	surface; the editor holds it no longer, every door refusing a zone whose far edge lies past it, the sentence naming where it reaches.
	*/
	refers: (z) => (z.x + z.w > COORD_BOUND || z.y + z.h > COORD_BOUND
		? `${z.id} reaches ${z.x + z.w},${z.y + z.h}, past the bound of ${COORD_BOUND} from the origin` : null),
	// H26.11 (H26-21; B400): the zone grid's own positions within its own bounds, 576 -- RESTATED at H26.6's move 11 (PZ8): that number,
	// there being no extent to count (model/limits.mjs ZONE_CAP)
	cap: ZONE_CAP,
};

// the zones plugin's rows, as the network's are NETWORK_ROWS (plugins/network/kinds.mjs)
export const ZONE_ROWS = [ZONE_ROW];
