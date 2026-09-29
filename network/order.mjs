/*
The order links were made in -- which link is OLDER, for the incubating network plugin.

Ruled 2026-09-30: "the older link keeps a contested hand-laid pipe" (dev/DECISIONS.md, "Pipes carry one link
each, for now"). Link ids are random (model/model.mjs `newId`), so nothing on the page says which link came
first, and ordering by id would be a lottery -- measured: it drew 2.8% of accepted drags differently after
commit than their check showed. So the order is RECORDED.

SESSION STATE, like the pipe set, and for the same reason: it is stored in the document only in the one format
batch, last (survey F6). A reload starts the seeds in the order they are listed, which is the order they claim.

NEVER FORGETS. A deleted link keeps its rank, so undoing the delete gives it back its place rather than making
it the newest -- which would let a younger link it once outranked take its way.
*/
export function createLinkOrder() {
	const rank = new Map();
	return {
		// rank every id not seen before, in the order given
		note(ids) { for (const id of ids) if (!rank.has(id)) rank.set(id, rank.size); },
		// smaller is older; a link never noted is the newest of all
		rankOf: (id) => (rank.has(id) ? rank.get(id) : Infinity),
	};
}
