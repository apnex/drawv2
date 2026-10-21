/*
THE TWO GRIDS -- the layouts plugin's table (WD-b1, H19.45; dev/design/unification/WIDE-DEVICES.md section 12; WD6, WD7).

A diagram stores its grids as `layout` entities, two of them, each named and holding its geometry: the pitch, the offset of its
lattice from the origin, and its extent. This is the one table of their values, which every diagram holds unchanged until the
infinite canvas lets a diagram vary them (WD7: "We will chase full programmability of layouts when we go after infinite canvas
and scrolling"). It is built from what the core and the kernel keep where it can be -- the node lattice's pitch and offset
(`kernel/geometry.mjs` `NODE_GRID`'s declaration), the device extent (`model/surface.mjs`) -- and holds the zone extent itself,
which was the zones plugin's (`zones/zone-extent.mjs`, O-b1) and is the zone layout's.

The ids are fixed: ids are a document's own, and a fixed id keeps the migration that adds these records pure.

H26.1 (dev/design/components/SNAP-GRID.md section 5): the zone lattice's offset -- half a pitch, a zone bounding cells -- is stated
here, the zone layout's own, where the kernel held it (`LAYOUTS`); and `ZONE_GRIDS` opens the zone's two grids from its record at
load (`latticeGrids`): `bounded` within the zone extent, for the canvas's snapping, the wrap and the corner steps, and `unbounded`
for field validation and the REST routes. A grid opened from this table and one opened from a diagram's record are the same grid,
since WD7 holds every diagram's records to these values; the day a diagram may vary its grids, every caller asking these must take
its grids from the diagram instead (B325).
*/

import { NODE_GRID, latticeGrids } from '../../kernel/geometry.mjs';
import { NODE_EXT } from '../../model/surface.mjs';

// zones reach within half a cell of the surface's edge -- the zone layout's extent
export const ZONE_EXT = { x: 930, y: 510 };

const { pitch: PITCH, origin: NODE_ORIGIN } = NODE_GRID.declaration;
const ZONE_OFFSET = PITCH / 2;   // a zone bounds cells, so its edges fall between them

export const LAYOUT_TABLE = Object.freeze([
	Object.freeze({ id: 'layout-000001', name: 'node', pitch: PITCH, offset: NODE_ORIGIN.x, ext: Object.freeze({ x: NODE_EXT.x, y: NODE_EXT.y }) }),
	Object.freeze({ id: 'layout-000002', name: 'zone', pitch: PITCH, offset: ZONE_OFFSET, ext: Object.freeze({ x: ZONE_EXT.x, y: ZONE_EXT.y }) }),
]);

export const ZONE_GRIDS = Object.freeze(latticeGrids(LAYOUT_TABLE[1]));
