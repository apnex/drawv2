// The `model/` substrate — public surface. The pure Model (+ id helpers) lives here as a
// SOVEREIGN sibling of engine/ (relations) and kernel/ (geometry): both app/ (composition root main.js)
// and server/ (store.js, seed.js) import it as a peer, so neither peer imports from the other
// (cleanliness #1 — sibling substrates import nothing from each other). Reachable at boot
// (Dockerfile COPY model/) and over HTTP (server/app.js mounts it at /model), like engine/.
// surface.mjs holds the shared canvas/extent magnitudes (CL3) — the single source for client + server.
export { Model, newId, kindOf, projection } from './model.mjs';
export { SURFACE, NODE_EXT, ZONE_EXT } from './surface.mjs';
