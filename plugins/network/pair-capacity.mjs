/*
PAIR CAPACITY -- how many straight links a pair of endpoints may carry, and the words that rule is written in. Its own module
since S-b (H18.12): the planner's document invariant (model/invariants.mjs `violations`) reads it, and so do the link rules
(model/link-rules.mjs `pairHolders`) -- which are the network's, and which the planner no longer loads. One home for the
number, which tests/pair-capacity.test.js raises in a copy of the tree to drive every site that reads it.
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
export function straightCapacity(_model, _a, _b) {
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

PRIVATE AGAIN since T4 (RULESET-AUDIT): every caller that used these words used them to decide the pair rule, and now
asks `pairHolders` instead, so the words went back to the one module that writes the rule.
*/
export const isStraight = (l) => !l.via || l.via.length === 0;
export const pairKey = (l) => (l.src < l.dst ? `${l.src}|${l.dst}` : `${l.dst}|${l.src}`);
