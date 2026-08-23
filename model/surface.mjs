// Document-space magnitudes — the SINGLE source for the canvas surface + the usable placement
// extents. Sourced by the client grid (app/src/snap.js) AND the server (validate bound-envelope,
// legacy-migration clamps), so the dimensions are defined exactly once (cleanliness #2).
// DATA ONLY — never a predicate: server/validate.js sources these magnitudes but keeps its own
// independent bound CHECK local (the trust boundary is never delegated to this module).
export const SURFACE  = { w: 1920, h: 1080, hw: 960, hh: 540 };   // 16:9 canvas; hw/hh = half-extent (center-origin)
export const NODE_EXT = { x: 900, y: 480 };                       // usable node extent (nodes keep a full margin cell)
export const ZONE_EXT = { x: 930, y: 510 };                       // usable zone extent (zones reach within half a cell)
