/*
Policy — pure, shared invariant + cascade RULES over the entity graph. No DOM, no Model
binding: every rule takes plain inputs so BOTH consumers apply the SAME rule — the client
(app/, building ordered + invertible command entries for undo) and the server (server/,
applying idempotent mutations as the safety net). The first tenant of the engine/ substrate; it grows as later rungs land (negation/aggregate invariants, the
cascade controller). Until then this is a small, behaviour-identical extraction.
*/

// A group after some members are removed: the survivors, and whether it must DISSOLVE
// (< 2 members ⇒ no longer a group). The single authority for the dissolve/trim threshold,
// shared by the delete cascade (client + server) and group-member stealing. `isRemoved` is a
// predicate over member ids so callers supply their own removed-set (a Set, a single id, …).
export function groupAfterRemoval(members, isRemoved) {
	const remaining = members.filter((m) => !isRemoved(m));
	return { remaining, dissolve: remaining.length < 2 };
}

/*
B113 -- how many of a kind one diagram may hold. The single authority for the number.

It was stated twice at 2000: `server/txn.mjs` refuses a mutation past it, `server/validate.js`
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
const anchors = (ext, pitch) => (Math.floor(ext.x / pitch) * 2 + 1) * (Math.floor(ext.y / pitch) * 2 + 1);

export function collectionCap({ nodeExt, zoneExt, pitch }) {
	return {
		node: anchors(nodeExt, pitch), waypoint: anchors(nodeExt, pitch), zone: anchors(zoneExt, pitch),
		link: 2000, group: 2000,
	};
}
