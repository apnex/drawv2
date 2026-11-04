// Document-space magnitudes — the SINGLE source for the canvas surface + the usable placement
// extents. Sourced by the client grid (app/src/snap.js) AND the server (validate bound-envelope,
// legacy-migration clamps), so the dimensions are defined exactly once (cleanliness #2).
// DATA ONLY — never a predicate: planner/validate.js sources these magnitudes but keeps its own
// independent bound CHECK local (the trust boundary is never delegated to this module).
export const SURFACE  = { w: 1920, h: 1080, hw: 960, hh: 540 };   // 16:9 canvas; hw/hh = half-extent (center-origin)
export const NODE_EXT = { x: 900, y: 480 };                       // usable node extent (nodes keep a full margin cell)
// the zone extent is the layouts plugin's (plugins/layouts/layout-table.mjs `ZONE_EXT`, WD-b1; O-b1 had it the zones plugin's)
// B113's `anchorCellsWithin` -- the anchor cells within an extent at a pitch, by the node grid's form -- went at H26.11 (H26-21): each
// positioned kind's cap counts its own grid's positions within its bounds (kernel/geometry.mjs `positionsWithin`)
// RESTATED at H26.6's move 11 (dev/design/components/PAN-ZOOM.md section 3.8): no validation reads this module -- an anchor and a zone are
// held to PZ31's bound (model/limits.mjs `COORD_BOUND`), the caps are numbers (`ANCHOR_CAP`, `ZONE_CAP`), `positionsWithin` is
// server/rest.js's -- and `ZONE_EXT` is the layout table's alone, unexported; the names here stay for their readers until move 12
