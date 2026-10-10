/*
THE TWO GRIDS -- the layouts plugin's table (WD-b1, H19.45; dev/design/unification/WIDE-DEVICES.md section 12; WD6, WD7).

A diagram stores its grids as `layout` entities, two of them, each named and holding its geometry: the pitch, the offset of its
lattice from the origin, and its extent. This is the one table of their values, which every diagram holds unchanged until the
infinite canvas lets a diagram vary them (WD7: "We will chase full programmability of layouts when we go after infinite canvas
and scrolling"). It is built from the constants the core and the kernel keep where it can be -- the pitch (`kernel/spec.mjs`),
the lattices' offsets (`kernel/geometry.mjs` `LAYOUTS`), the device extent (`model/surface.mjs`) -- and holds the zone extent
itself, which was the zones plugin's (`zones/zone-extent.mjs`, O-b1) and is the zone layout's.

The ids are fixed: ids are a document's own, and a fixed id keeps the migration that adds these records pure.
*/

import { STD } from '../kernel/spec.mjs';
import { LAYOUTS } from '../kernel/geometry.mjs';
import { NODE_EXT } from '../model/surface.mjs';

// zones reach within half a cell of the surface's edge -- the zone layout's extent
export const ZONE_EXT = { x: 930, y: 510 };

export const LAYOUT_TABLE = Object.freeze([
	Object.freeze({ id: 'layout-000001', name: 'node', pitch: STD.pitch, offset: LAYOUTS.node.offset, ext: Object.freeze({ x: NODE_EXT.x, y: NODE_EXT.y }) }),
	Object.freeze({ id: 'layout-000002', name: 'zone', pitch: STD.pitch, offset: LAYOUTS.zone.offset, ext: Object.freeze({ x: ZONE_EXT.x, y: ZONE_EXT.y }) }),
]);
