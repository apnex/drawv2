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
the column span available between the two containers (`design/walk/FINDINGS.md`, rung
`3-parallel3`), which is H10.7 and needs geometry this does not attempt.
*/
function straightCapacity(_model, _a, _b) {
	return 1;
}

const isStraight = (l) => !l.via || l.via.length === 0;

/*
Every violated invariant in the document, as sentences. Plural because reporting the first and
stopping would make a caller fix one thing, re-run, and find the next -- and because a scanner or
a repair tool wants the whole set.

Returns [] for a clean document, so a caller reads emptiness as health without a sentinel.
*/
export function violations(model) {
	const out = [];
	const straightByPair = new Map();

	for (const link of model.all('link')) {
		if (!isStraight(link)) continue;
		// unordered: a link from a to b and one from b to a join the same pair
		const key = link.src < link.dst ? `${link.src}|${link.dst}` : `${link.dst}|${link.src}`;
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
	return out;
}
