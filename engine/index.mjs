// ENGINE — the relational substrate's public surface. Consumers — the
// app/ client AND the server/ — import shared rules from HERE only; modules are implementation
// detail. Born with the pure policy rules; grows rung by rung. Sibling to the spatial kernel/.
export { groupAfterRemoval, collectionCap } from './policy.mjs';
export { attachRelations } from './store.mjs';
export { makeRelations } from './relations.mjs';
export { prepareSpawner, moversAt, positionOf, MAX_MOVERS_PER_SPAWNER } from './movers.mjs';
export { spawnersOf } from './spawners.mjs';
export { situationOf, oneSelected, onEndpoint, inReadView, onSpawner } from './situation.mjs';
