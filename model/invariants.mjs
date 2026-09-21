/*
invariants — properties a document must hold, expressed once.

A rule enforced at call sites is a convention. H10.9 put "one straight link per pair" in the two
drag sites in `app/src/input.js`, which is where a link is authored, and B81 showed what that
leaves out: `set` is a first-class op, so a commit over either transport can clear a link's `via`
and produce the state the rule forbids without going near those sites. A caller that does not pass
through the guard is not bound by it.

So the rule moves here, and the transaction planner consults it once against the state a
transaction would produce. Two consequences worth stating, because both are deliberate:

  - It is checked on the RESULT, not per operation. A batch may transiently violate and end valid
    -- deleting a straight link and clearing another link's route in one transaction is legal, and
    a per-op check would refuse it for a state that never becomes durable.
  - It is a backstop, not the primary mechanism. The waypoint cascade already removes a link that
    would be left colliding (B81 ruling (b)), so a well-formed operation never reaches this check
    in a failing state. What reaches it is the path nobody thought about.

Sovereign: imports nothing. `model/` is the substrate both the server and the browser already
depend on, so the rule has one home and neither side restates it.
*/

/*
How many straight links a pair of endpoints may carry.

Constant today, and deliberately a FUNCTION rather than a constant so it does not have to become
one later. The intended end state is a capacity resolved from the kinds of the endpoints -- a node
kind carrying a configurable number of connections, adjustable at runtime by an operator or over
the API -- and that is out of scope. What is in scope is that the limit already has exactly one
place to be resolved, so introducing configuration is a change to this function's body rather than
a hunt through call sites.

Straight links are the constrained resource because two of them between the same pair render along
the identical path: the second is invisible and indistinguishable from a no-op. Routed links carry
distinct bends and fan out, so they are not limited here. The designed end state caps those too, by
the column span available between the two containers (`dev/design/walk/FINDINGS.md`, rung
`3-parallel3`), which is H10.7 and needs geometry this does not attempt.
*/
function straightCapacity(_model, _a, _b) {
	return 1;
}

/*
The vocabulary the rules are written in, exported for the same reason the rules live here (B84).

`straightCapacity` was made sovereign and these were left private, so every caller re-derived
them: `pairKey` was hand-written three times and "is this link straight" had six spellings, three
of them negated. Re-deriving a predicate slightly differently is precisely the failure B81 was
filed for, so the module that owns the rule owns the words it is written in.

`pairKey` orders the endpoints because a link from a to b joins the same pair as one from b to a;
callers that key a Map on a pair need that and would otherwise each remember to sort.
*/
export const isStraight = (l) => !l.via || l.via.length === 0;
export const pairKey = (l) => (l.src < l.dst ? `${l.src}|${l.dst}` : `${l.dst}|${l.src}`);

/*
B210 -- SPLIT a link at one of its bends, so that linking to a bend makes a junction.

A junction is a MEET: links converge at a point and are CONNECTED there. A link merely bending
through is not meeting anything, so two links crossing at one waypoint would be a crossing rather
than a junction -- a different thing, and one the grid cannot currently express at all.

Rather than admit that case and name it, the topology CHANGES when a junction forms: the link that
bends is cut in two, and both halves terminate at the waypoint. Three links now end there, which is
a meet by construction rather than by convention. "Two links bending through one point" therefore
cannot arise.

Returns the two halves' SHAPES, without ids -- minting those belongs to the caller, which knows the
collection. The original link is replaced rather than mutated into one half: both halves are new,
so nothing holds a stale reference to a route that no longer exists.

The `via` list divides at the split index and the remainder carries to each side, so a link with
several bends keeps the ones on either side of the cut.

REFUSES rather than guessing in two cases. A closed ring has no ends and cutting one is undefined.
A link whose `src` or `dst` is already the split waypoint would produce a self-link -- that state
cannot exist today, because `selfConflict` refuses a waypoint in two roles on one link, so this is
an assertion about the caller rather than a case to handle.
*/
/*
B213 -- COLLAPSE the inverse: two links meeting at a waypoint are a BEND, not a junction.

Ruled by the director: a junction cannot exist with one link in and one link out. That shape is a
path passing THROUGH the point, which is exactly what a bend is, so the document should say so --
`a->w` plus `w->b` becomes `a->b via [w]`.

THE SRC-SIDE ID WINS, meaning the link whose `dst` is the waypoint: it carries the route's original
start, so after a split it is the half that kept the original id. Rejoining therefore restores the
id the author drew, and split-then-collapse is a round trip rather than a churn of identities.

REQUIRES ONE IN AND ONE OUT. Two links both pointing away from a waypoint is not a path through
anything -- it is two routes starting at the same place, a fan rather than a bend -- so there is no
src side and nothing to collapse. Same for two both pointing in.

Returns the merged link, or null when the pair does not describe a path through the point.
*/
export function collapseAtWaypoint(inbound, outbound, waypointId) {
	if (!inbound || !outbound || inbound.id === outbound.id) return null;
	if (inbound.closed || outbound.closed) return null;
	if (inbound.dst !== waypointId || outbound.src !== waypointId) return null;
	if (inbound.src === outbound.dst) return null;              // would be a self-link
	const via = [...(inbound.via || []), waypointId, ...(outbound.via || [])];
	return { ...inbound, src: inbound.src, dst: outbound.dst, via };
}

export function splitAtBend(link, waypointId) {
	if (link.closed) return null;                       // a ring has no ends to cut toward
	if (link.src === waypointId || link.dst === waypointId) return null;   // would be a self-link
	const via = Array.isArray(link.via) ? link.via : [];
	const at = via.indexOf(waypointId);
	if (at === -1) return null;                         // not a bend of this link
	const half = (src, dst, v) => ({ src, dst, ...(v.length ? { via: v } : {}) });
	return [half(link.src, waypointId, via.slice(0, at)), half(waypointId, link.dst, via.slice(at + 1))];
}

/*
Every violated invariant in the document, as sentences. Plural because reporting the first and
stopping would make a caller fix one thing, re-run, and find the next -- and because a scanner or
a repair tool wants the whole set.

Returns [] for a clean document, so a caller reads emptiness as health without a sentinel.
*/
export function violations(model, { groupAfterRemoval = null } = {}) {
	const out = [];
	const straightByPair = new Map();

	/*
	B82 -- no entity is a member of two groups.

	The rule already existed, in `planPut`, as a repair: putting a group STEALS overlapping members
	from any other. But a repair attached to one op kind is not a property of the document, and
	`planSet` has no group handling at all, so a `set` patching `members` walked past it. The
	document that results does not merely look wrong, it MEANS different things to the two peers:
	the client's relational index declares membership single-valued and answers last-write-wins,
	while the server has no index and falls back to a first-match scan. `groupOf` drives selection
	expansion and the renderer hull, so a click selects one thing in the browser and another on the
	server, and neither is wrong by its own reading.
	*/
	const owner = new Map();
	for (const g of model.all('group')) {
		for (const m of new Set(g.members || [])) {
			const held = owner.get(m);
			if (held && held !== g.id) out.push(`${m} is a member of both ${held} and ${g.id}`);
			else owner.set(m, g.id);
		}
	}

	/*
	B85 -- a group holds at least two distinct members.

	The threshold is NOT restated here. `engine/policy.mjs` declares itself the single authority
	for it, and `model/` and `engine/` are sovereign peers -- neither imports the other -- so the
	rule is injected by the composition point that already depends on both, exactly as `cellOf` is
	injected into `attachRelations` so that engine imports no kernel. Asking whether a group would
	dissolve with NOTHING removed is the same question as whether it is under the minimum, phrased
	in the vocabulary that owns the number.

	Skipped rather than guessed when no policy is supplied: a caller that cannot provide the rule
	gets the checks that need no rule, and never a threshold this file invented.
	*/
	if (groupAfterRemoval) {
		for (const g of model.all('group')) {
			const members = g.members || [];
			const distinct = [...new Set(members)];
			if (distinct.length !== members.length) out.push(`${g.id} lists the same member twice`);
			if (groupAfterRemoval(distinct, () => false).dissolve) {
				out.push(`${g.id} holds ${distinct.length} member(s), too few to be a group`);
			}
		}
	}

	for (const link of model.all('link')) {
		if (!isStraight(link)) continue;
		// unordered: a link from a to b and one from b to a join the same pair
		const key = pairKey(link);
		const seen = straightByPair.get(key) || [];
		seen.push(link);
		straightByPair.set(key, seen);
	}

	for (const [key, links] of straightByPair) {
		const [a, b] = key.split('|');
		const cap = straightCapacity(model, a, b);
		if (links.length > cap) {
			out.push(`${links.length} straight links between ${a} and ${b}, which may carry ${cap}`);
		}
	}
	/*
	B112 -- one anchor holds one occupant.

	An anchor is a grid position, and `engine/relations.mjs` already keys occupancy by cell as an
	eager index -- so the index has always ASSUMED this while nothing enforced it. `Model#put` takes
	two nodes at identical coordinates without complaint.

	A waypoint counts, because a waypoint IS a node for placement (ruled 2026-08-23): it sits on the
	same grid, the same index keys it, and a bend hidden underneath a node is not a diagram anyone
	can read.

	The live estate held zero collisions across 146 entities when this was written, and only because
	the one path able to break it -- a human dragging -- has eyes on the result. The agent door has
	no such check, and B110 stopped it writing OFF the grid without stopping it writing ON TOP of
	something.

	Compared as resolved coordinates rather than cell indices, deliberately. The two are the same
	question only while every entity is on-grid, which `server/validate.js` now enforces at the
	boundary; comparing px states the property itself rather than depending on that one holding, and
	two entities somehow 30px apart are reported rather than collapsed into one cell the way
	`cellOf` would collapse them.
	*/
	const at = new Map();
	for (const kind of ['node', 'waypoint']) {
		for (const e of model.all(kind)) {
			const key = `${e.x},${e.y}`;
			const held = at.get(key);
			if (held) out.push(`${e.id} and ${held} occupy the same anchor (${e.x},${e.y})`);
			else at.set(key, e.id);
		}
	}

	return out;
}
