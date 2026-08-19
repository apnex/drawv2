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
