/*
Policy — pure, shared invariant + cascade RULES over the entity graph. No DOM, no Model
binding: every rule takes plain inputs so BOTH consumers apply the SAME rule — the client
(app/, building ordered + invertible command entries for undo) and the server (server/,
applying idempotent mutations as the safety net). The first tenant of the engine/ substrate; it grows as later rungs land (negation/aggregate invariants, the
cascade controller). Until then this is a small, behaviour-identical extraction.
*/

import { anchorCellsWithin } from '../model/surface.mjs';   // the grid's cell count, the core's (O-b1)

/*
B113 -- how many of a kind one diagram may hold. The single authority for the number.

It was stated twice at 2000: `planner/txn.mjs` refuses a mutation past it, `planner/validate.js`
refuses a document carrying more. Two enforcement points is correct and deliberate -- one guards the
wire, one guards what loads -- but two NUMBERS is not, and they had begun to diverge the moment one
of them became derived.

DERIVED for a positioned kind, because B112 caps those at one entity per anchor and a flat 2000
became unreachable: the node grid holds 527 anchors, so occupancy refused at 528 and the constant
could never fire. A limit that cannot be reached is a claim the code makes and cannot keep.

Occupancy remains the tighter rule and still speaks first: nodes and waypoints share one anchor
pool, so their combined total is 527 while each cap here is 527 alone. This is a cheap per-collection
backstop against a pathological document, not the real constraint.

2000 stands for the unpositioned kinds, which have no anchors and for which it is still reachable.
*/
// AMENDED 2026-10-08 (O-b1): the zone's cap is its row's own (zones/zone-kind.mjs), derived as the node's is
export function collectionCap({ nodeExt, pitch }) {
	return {
		node: anchorCellsWithin(nodeExt, pitch),   // one occupant per anchor cell, typed or not (F-c)
		// the group's 2000 is its row's own since O-c (groups/group-kind.mjs), as the link's is since S-e
	};
}
