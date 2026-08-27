/*
Referential - the cross-entity rules, stated ONCE (B83 / H10.16).

A link's endpoints must exist. A link is not a self-link. Its `via` waypoints exist. A waypoint
belongs to at most one link, in at most one role. A group's members exist.

These were written TWICE inside `server/validate.js`: once incrementally against a live `Model` in
`validateMutation`, once globally against a plain doc in `validateDoc`. Two implementations, two
error vocabularies, two complexity classes, and nothing forcing them to agree. Divergence means a
document the wire refuses can be loaded from disk, or the reverse -- and the two peers then disagree
about what a valid diagram is, which is the failure this whole module exists to make impossible.

WHY AN ACCESS OBJECT AND NOT A MODEL.

B83 posed this as the open design question: `violations(model)` reads `model.all(...)` while
`validateDoc(doc)` holds arrays, with `projection()` as the precedent for either answer. Building a
Model from the doc is the obvious move and it does not work, because it answers only half the
problem. `validateMutation` checks ONE entity against the live model under a post-merge view -- the
entity being written does not exist yet, or exists in its old form. No Model built from a document
can express that. The shareable thing was never the traversal; it is the PREDICATE, and the two
callers keep their own traversals and supply their own lookups.

WHY THESE RULES ARE NOT IN `violations()`, WHICH IS THE OTHER OBVIOUS HOME.

`violations()` is REPORTED and never refused -- `store.js` counts it into `invariantFailures` and
`/health` says `corrupt`, deliberately, so a damaged file still opens and can be repaired. These
rules are REFUSALS: a link pointing at a node that does not exist cannot be rendered or reversed.
Moving them into `violations()` would quietly convert five refusals into five reports. The rules
live here and each caller keeps its own answer to a broken one.

THE ACCESS CONTRACT:

  hasNode(id)       -> boolean
  hasWaypoint(id)   -> boolean
  ownersOf(wpId)    -> iterable of link ids referencing that waypoint in ANY role

`ownersOf` is an INDEX, built once by the caller, and that is a complexity fix as well as a
deduplication. `validateMutation` used to rescan `model.all('link')` for every waypoint in every
link mutation -- a document-wide predicate wearing a per-mutation costume, O(waypoints x links) on
every write. Built once it is O(links), and the document path is unchanged at O(links).
*/

// Index every waypoint reference in a set of links. One pass, and the shape both callers need.
export function waypointOwners(links) {
	const owners = new Map();
	const note = (w, id) => {
		if (!w) return;
		if (!owners.has(w)) owners.set(w, new Set());
		owners.get(w).add(id);
	};
	for (const l of links) {
		note(l.src, l.id);
		note(l.dst, l.id);
		for (const w of Array.isArray(l.via) ? l.via : []) note(w, l.id);
	}
	return owners;
}

/*
One link against everything else. Returns the first failure as a string, or null.

The order is deliberate: existence before identity before occupancy. A self-link between two ids
that do not exist should say the endpoint is missing, because that is the fault the author can act
on, and reporting "self-link" for a pair of typos sends them looking in the wrong place.
*/
export function linkReferential(link, access) {
	const { hasNode, hasWaypoint, ownersOf } = access;
	const exists = (id) => hasNode(id) || hasWaypoint(id);

	if (!exists(link.src)) return `link src does not exist: ${link.src}`;
	if (!exists(link.dst)) return `link dst does not exist: ${link.dst}`;
	if (link.src === link.dst) return `link is a self-link: ${link.src}`;

	const via = Array.isArray(link.via) ? link.via : [];
	for (const w of via) if (!hasWaypoint(w)) return `link via waypoint does not exist: ${w}`;

	// XOR occupancy: a waypoint participates in at most one link, and in one role within it.
	const refs = [link.src, link.dst, ...via].filter(hasWaypoint);
	if (new Set(refs).size !== refs.length) return 'link uses a waypoint in two roles';
	for (const w of refs) {
		for (const other of ownersOf(w)) {
			// a waypoint this link already owns is not a conflict with itself
			if (other !== link.id) return `waypoint already in use by another link: ${w}`;
		}
	}
	return null;
}

// A group's members must exist. Nodes and waypoints both qualify; a group of groups does not.
export function groupReferential(group, access) {
	const { hasNode, hasWaypoint } = access;
	for (const m of Array.isArray(group.members) ? group.members : []) {
		if (!hasNode(m) && !hasWaypoint(m)) return `group member does not exist: ${m}`;
	}
	return null;
}
