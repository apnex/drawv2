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
AMENDED 2026-10-04 (S-e, H18.15): both moved on into network/, the plugin that owns the link (G5), and the straight-pair
invariant with them, as the link row's own (`invariants`); this module asks each composed kind's row for its invariant.
AMENDED 2026-10-08 (O-a, H19.18): the group's two -- no node in two groups (B82), two distinct members (B85) -- went the
same way, to the group row (planner/kinds.mjs); what stays is the anchor capability's own, one occupant to an anchor (B112).

Sovereign: imports nothing. `model/` is the substrate both the server and the browser already
depend on, so the rule has one home and neither side restates it.
*/

import { ANCHOR_KINDS } from './anchors.mjs';   // the bare anchor, asked in one place (F-b)

/*
Every violated invariant in the document, as sentences. Plural because reporting the first and
stopping would make a caller fix one thing, re-run, and find the next -- and because a scanner or
a repair tool wants the whole set.

Returns [] for a clean document, so a caller reads emptiness as health without a sentinel.
*/
export function violations(model, { facts = false, ...rest } = {}) {
	// O-a: the group policy is the group row's to ask now; an option this no longer reads is refused, never ignored
	const stray = Object.keys(rest);
	if (stray.length) throw new Error(`violations: unknown option ${stray.join(', ')} -- a kind's invariants ride its row since O-a (H19.18)`);
	/*
	B271 -- each violation has an IDENTITY (its rule and subject) and a MEASURE, as well as its sentence. The planner's
	backstop refuses a transaction for a violation it introduces or worsens; comparing sentences, which embed counts,
	refused a partial repair (three straight links on a pair losing one read as a new violation). `facts` returns
	{ key, measure, sentence }; by default the sentences, for the store's boot report.
	*/
	const found = [];
	const out = { push: (sentence, key = sentence, measure = 1) => found.push({ key, measure, sentence }) };

	/*
	S-e (H18.15) -- EACH KIND'S OWN INVARIANT, from its row (model/shape.mjs `invariants`), in the order the composition lists
	its kinds. The link's straight-pair rule (B81) was written here, in the core; it is the network's now, beside the link's
	row (network/link-kind.mjs), and a composition without the network checks no links.
	*/
	for (const kind of model.kinds.list) model.kinds.row(kind).invariants?.(model, out.push);

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
