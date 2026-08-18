// ENGINE — the relational substrate's public surface (see docs/history/PRISMV2-DESIGN.md). Consumers — the
// app/ client AND the server/ — import shared rules from HERE only; modules are implementation
// detail. Born with the pure policy rules; grows rung by rung. Sibling to the spatial kernel/.
export { groupAfterRemoval } from './policy.mjs';
export { attachRelations } from './store.mjs';
export { makeRelations } from './relations.mjs';
