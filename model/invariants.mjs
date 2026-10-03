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

AMENDED 2026-10-03 (S-b, H18.12): the link rules -- splitting, joining, pair holders -- moved to model/link-rules.mjs, and
the pair capacity to model/pair-capacity.mjs; this module keeps the document invariants the planner checks.

Sovereign: imports nothing. `model/` is the substrate both the server and the browser already
depend on, so the rule has one home and neither side restates it.
*/

import { ANCHOR_KINDS } from './anchors.mjs';   // the bare anchor, asked in one place (F-b)
import { straightCapacity, isStraight, pairKey } from './pair-capacity.mjs';   // the pair rule's one home (S-b)

/*
Every violated invariant in the document, as sentences. Plural because reporting the first and
stopping would make a caller fix one thing, re-run, and find the next -- and because a scanner or
a repair tool wants the whole set.

Returns [] for a clean document, so a caller reads emptiness as health without a sentinel.
*/
export function violations(model, { groupAfterRemoval = null, facts = false } = {}) {
	/*
	B271 -- each violation has an IDENTITY (its rule and subject) and a MEASURE, as well as its sentence. The planner's
	backstop refuses a transaction for a violation it introduces or worsens; comparing sentences, which embed counts,
	refused a partial repair (three straight links on a pair losing one read as a new violation). `facts` returns
	{ key, measure, sentence }; by default the sentences, for the store's boot report.
	*/
	const found = [];
	const out = { push: (sentence, key = sentence, measure = 1) => found.push({ key, measure, sentence }) };
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
			if (held && held !== g.id) out.push(`${m} is a member of both ${held} and ${g.id}`, `two-groups:${m}`);
			else owner.set(m, g.id);
		}
	}

	/*
	B85 -- a group holds at least two distinct members.

	The threshold is NOT restated here. `planner/policy.mjs` declares itself the single authority
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
			if (distinct.length !== members.length) out.push(`${g.id} lists the same member twice`, `repeated-member:${g.id}`);
			if (groupAfterRemoval(distinct, () => false).dissolve) {
				out.push(`${g.id} holds ${distinct.length} member(s), too few to be a group`, `too-few:${g.id}`);
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
			out.push(`${links.length} straight links between ${a} and ${b}, which may carry ${cap}`, `straight-pair:${a}|${b}`, links.length - cap);   // the excess: worse if links grow or capacity shrinks
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
	question only while every entity is on-grid, which `planner/validate.js` now enforces at the
	boundary; comparing px states the property itself rather than depending on that one holding, and
	two entities somehow 30px apart are reported rather than collapsed into one cell the way
	`cellOf` would collapse them.
	*/
	const at = new Map();
	for (const kind of [...ANCHOR_KINDS]) {
		for (const e of model.all(kind)) {
			const key = `${e.x},${e.y}`;
			const held = at.get(key);
			if (held) out.push(`${e.id} and ${held} occupy the same anchor (${e.x},${e.y})`, `occupied:${[e.id, held].sort().join('|')}`);
			else at.set(key, e.id);
		}
	}

	return facts ? found : found.map((f) => f.sentence);
}
