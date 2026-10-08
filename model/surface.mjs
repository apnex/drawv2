// Document-space magnitudes — the SINGLE source for the canvas surface + the usable placement
// extents. Sourced by the client grid (app/src/snap.js) AND the server (validate bound-envelope,
// legacy-migration clamps), so the dimensions are defined exactly once (cleanliness #2).
// DATA ONLY — never a predicate: planner/validate.js sources these magnitudes but keeps its own
// independent bound CHECK local (the trust boundary is never delegated to this module).
export const SURFACE  = { w: 1920, h: 1080, hw: 960, hh: 540 };   // 16:9 canvas; hw/hh = half-extent (center-origin)
export const NODE_EXT = { x: 900, y: 480 };                       // usable node extent (nodes keep a full margin cell)
// the zone extent is the zones plugin's (zones/zone-kind.mjs `ZONE_EXT`, O-b1)
/*
B113 -- the anchor cells within an extent at a pitch: what a positioned kind's cap derives from, one occupant to a cell.
Arithmetic over the grid, which the core keeps (O1), so the node's cap (planner/policy.mjs) and a plugin's (the zone's)
derive one way. It was planner/policy.mjs's `anchors`.
*/
export const anchorCellsWithin = (ext, pitch) => (Math.floor(ext.x / pitch) * 2 + 1) * (Math.floor(ext.y / pitch) * 2 + 1);
