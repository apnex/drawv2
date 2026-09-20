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
	const { hasNode, hasWaypoint } = access;
	const exists = (id) => hasNode(id) || hasWaypoint(id);

	if (!exists(link.src)) return `link src does not exist: ${link.src}`;
	if (!exists(link.dst)) return `link dst does not exist: ${link.dst}`;
	if (link.src === link.dst) return `link is a self-link: ${link.src}`;

	const via = Array.isArray(link.via) ? link.via : [];
	for (const w of via) if (!hasWaypoint(w)) return `link via waypoint does not exist: ${w}`;

	const refs = [link.src, link.dst, ...via].filter(hasWaypoint);
	return selfConflict(link, refs) || duplicateThroughBend(link, via, access);
}

/*
ONE LINK naming one waypoint twice, across its own `src`, `dst` and `via`.

The route would visit a point twice and the geometry is undefined -- there is no answer to what
shape the path takes. Per-link: it needs no knowledge of any other link, which is what separates it
from the check below.

This half is NOT the junction and does not relax. Split out on 2026-09-19 because it had been
sharing a comment and a code block with the half that does, and "XOR occupancy" named both at once:
`docs/spec/ATOMICS.md` records the reconstruction, and the pre-existing test corpus already told
them apart as "one waypoint in two roles on one link" against "one waypoint shared by two links".
*/
function selfConflict(link, refs) {
	return new Set(refs).size !== refs.length ? 'link uses a waypoint in two roles' : null;
}

/*
TWO LINKS meeting at one waypoint -- ALLOWED. That is a junction.

This replaced `sharedWithAnotherLink`, which refused it outright and was the half of the old rule
that had to move: every topology a junction is made of was rejected here. A waypoint carrying more
than two path DIRECTIONS is a junction, derived rather than declared, and the derivation is
`waypointRole`'s business rather than the validator's -- what is checked here is only whether the
document is well-formed enough to derive from.

WHAT IS STILL REFUSED is the degenerate case the relaxation exposes: two links that bend at the
same waypoint AND carry the same endpoint pair. Two identical routes stacked through one corner are
visually indistinguishable, separately editable, and mean nothing that one link does not.

The pair is compared UNORDERED, so `a<->b` and `b<->a` are the same pair -- a link drawn in the
opposite direction is the same duplicate, and comparing ordered would let it through.

Only BENDS are tested, and both exclusions have a reason.

Two links both TERMINATING at one waypoint is a star -- a junction, legal however many arrive.

A same-pair link that does NOT bend at this point is a different shape on the canvas: one detours
through the waypoint, the other does not, so they are distinguishable and neither is invisible.
Whether a SECOND STRAIGHT one may exist is `straightCapacity` in `model/invariants.mjs`, which caps
straight links between a pair at one for the same reason this function exists -- two straight links
between one pair render along the identical path. That is an invariant rather than a referential
check, so it is enforced in a different layer and reported differently; it is named here so the two
rules are not mistaken for one.
*/
const pairKey = (l) => [l.src, l.dst].sort().join('\u0000');

function duplicateThroughBend(link, via, access) {
	const { ownersOf, linkById } = access;
	/*
	THROWS rather than skipping. Both callers supply this, and a third that forgot would otherwise
	disable the duplicate rule in silence -- the document would validate, the duplicate would be
	stored, and nothing would say so. A trust-boundary check that can be switched off by omission is
	the defect class this repo has spent the most time closing.
	*/
	if (!linkById) throw new Error('linkReferential: access.linkById is required for the duplicate-bend check');
	for (const w of via) {
		for (const otherId of ownersOf(w)) {
			if (otherId === link.id) continue;
			const other = linkById(otherId);
			if (!other || !(Array.isArray(other.via) ? other.via : []).includes(w)) continue;
			if (pairKey(other) === pairKey(link)) {
				return `two links with the same endpoints bend at the same waypoint: ${w}`;
			}
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
