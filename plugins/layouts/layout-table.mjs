/*
THE TWO GRIDS -- the layouts plugin's table (WD-b1, H19.45; dev/design/unification/WIDE-DEVICES.md section 12; WD6, WD7).

A diagram stores its grids as `layout` entities, two of them, each named and holding its geometry: the pitch, the offset of its
lattice from the origin, and its extent. This is the one table of their values, which every diagram holds unchanged until the
infinite canvas lets a diagram vary them (WD7: "We will chase full programmability of layouts when we go after infinite canvas
and scrolling"). It is built from what the kernel keeps where it can be -- the node lattice's pitch and offset (`kernel/geometry.mjs`
`NODE_GRID`'s declaration) -- and holds each record's extent as the value stored, the zone's once the zones plugin's
(`zones/zone-extent.mjs`, O-b1).

The ids are fixed: ids are a document's own, and a fixed id keeps the migration that adds these records pure.

H26.1 (dev/design/components/SNAP-GRID.md section 5): the zone lattice's offset -- half a pitch, a zone bounding cells -- is stated
here, the zone layout's own, where the kernel held it (`LAYOUTS`); and `ZONE_GRIDS` opens the zone's two grids from its record at
load (`latticeGrids`): `bounded` within the zone extent, for the canvas's snapping, the wrap and the corner steps, and `unbounded`
for field validation and the REST routes. A grid opened from this table and one opened from a diagram's record are the same grid,
since WD7 holds every diagram's records to these values; the day a diagram may vary its grids, every caller asking these must take
its grids from the diagram instead (B325). RESTATED at H26.6's move 13 (PAN-ZOOM.md section 3.4): that day came -- every caller takes
the diagram's lattices from its record (layout-records.mjs `latticesOf`, kernel/geometry.mjs `diagramLattices`), and `ZONE_GRIDS` went.
*/

import { STD } from '../../kernel/spec.mjs';

/*
H26.6's move 12 (dev/design/components/PAN-ZOOM.md 5.1 row 12, GR3): the records' `ext` is stored data, every schema 3 diagram holding it,
and bounds nothing -- the device extent came from model/surface.mjs and the zone extent was this module's own until model/surface.mjs,
`NODE_EXT` and `ZONE_EXT` were deleted; the values stand in the two records alone until move 14 makes the record one, holding no extent.
The table itself is read by the layout row and the records alone (plugins/layouts/layout-kind.mjs, layout-records.mjs), and by
the diagram's lattices (`latticesOf`); the routes and the canvas ask those.
*/

// H26.6's move 13 (PAN-ZOOM.md section 3.4): every schema 3 diagram's grid, 60 -- the grid's size held equal to the unit's until move 15
// lets a diagram choose it (PZ21), so read here as the record's own value, not as the unit
const PITCH = STD.pitch, NODE_ORIGIN = { x: 0, y: 0 };
const ZONE_OFFSET = PITCH / 2;   // a zone bounds cells, so its edges fall between them

export const LAYOUT_TABLE = Object.freeze([
	Object.freeze({ id: 'layout-000001', name: 'node', pitch: PITCH, offset: NODE_ORIGIN.x, ext: Object.freeze({ x: 900, y: 480 }) }),
	Object.freeze({ id: 'layout-000002', name: 'zone', pitch: PITCH, offset: ZONE_OFFSET, ext: Object.freeze({ x: 930, y: 510 }) }),
]);

