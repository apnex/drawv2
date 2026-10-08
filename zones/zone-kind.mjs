/*
THE ZONES PLUGIN'S KIND -- O-b1 (H19.19; dev/design/unification/KINDS-AS-PLUGINS.md; O1, every kind a plugin's).

A zone is a named box drawn behind the board: it bounds cells, so its edges fall between them, on the grid offset by half a
pitch. It was the core's kind -- its storage facts in model/shape.mjs, its checks and its cap in the planner, its factory on
the Model and its extent on the surface -- and is this plugin's now, whole, as the link is the network's
(network/link-kind.mjs). The product composes it between the node and the group (product/kinds.mjs `productKinds`), so a
document lists its collections as it always has. Its fields are what they were as the product's row: only the owner moved.
Its extent is zones/zone-extent.mjs and its factory zones/make-zone.mjs, apart so a composition that plans -- the planner
entry -- loads the row alone (tools/layers.mjs L10).
*/

import { NAME_MAX } from '../model/limits.mjs';
import { anchorCellsWithin } from '../model/surface.mjs';
import { LAYOUTS, onLayout } from '../kernel/geometry.mjs';
import { STD } from '../kernel/spec.mjs';
import { ZONE_EXT } from './zone-extent.mjs';

const ORDER_MAX = Number.MAX_SAFE_INTEGER;
const PITCH = STD.pitch;
// the checks are LOCAL, as every row's are: the trust boundary is never delegated (model/shape.mjs, B110, B113)
const str = (v, max) => typeof v === 'string' && v.length <= max;
const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const id = (v, kind) => typeof v === 'string' && new RegExp(`^${kind}-[0-9a-f]{6}$`).test(v);
const onGrid = (name, v) => onLayout(LAYOUTS[name], v);

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
		x: (v) => num(v, -ZONE_EXT.x, ZONE_EXT.x) && onGrid('zone', v),
		y: (v) => num(v, -ZONE_EXT.y, ZONE_EXT.y) && onGrid('zone', v),
		w: (v) => num(v, PITCH, 2 * ZONE_EXT.x) && onGrid('node', v), // whole cells; minimum one -- no degenerate zones
		h: (v) => num(v, PITCH, 2 * ZONE_EXT.y) && onGrid('node', v),
		order: (v) => int(v, 1, ORDER_MAX),   // the drawing order (F-d)
	},
	// B113: one zone to an anchor cell of its extent -- a backstop against a pathological document, occupancy speaking first
	cap: anchorCellsWithin(ZONE_EXT, PITCH),
};

// the zones plugin's rows, as the network's are NETWORK_ROWS (network/kinds.mjs)
export const ZONE_ROWS = [ZONE_ROW];
