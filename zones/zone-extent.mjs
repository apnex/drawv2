/*
THE ZONE EXTENT -- the zones plugin's (O-b1, H19.19): how far a zone may reach, read by its row's checks (zones/zone-kind.mjs)
and by the canvas's zone snapping (app/src/snap.js). It was model/surface.mjs's, beside the node extent, which stays the core's.
*/
// zones reach within half a cell of the surface's edge
export const ZONE_EXT = { x: 930, y: 510 };

