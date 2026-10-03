/*
THE ONE DERIVATION ORDER -- B246 (H17.6, K15; condition C8 of dev/design/h17/PLAN.md).

Ascending entity id, as JavaScript compares strings. Collections keep insertion order, which differs between peers
holding one document -- two writers insert differently -- so every query that answers links sorts with this: the
Model's own queries (model/model.mjs), the relation index the client and the server attach (engine/relations.mjs), and
the spawners, which take a waypoint's first terminating link in it (engine/spawners.mjs). One comparator, so the three
cannot drift into three orders.

No server-stamped sequence: an order that needed one would be stored state, which is the stored-format batch's business.
`all()` iteration and renderer stacking stay insertion-ordered (F-ORDER, held in dev/BACKLOG.md).
AMENDED 2026-10-03 (F-d, H18.6; B249, B10, B259): the format batch stores it -- see THE DRAWING ORDER, below.
*/
export const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/*
THE DRAWING ORDER -- stored on every node, link and zone as `order`, a positive integer (F-d, H18.6; ruled 2026-10-01,
B249: "newest drawn on top", the same for every peer, stored with the format batch).

Whoever creates an item stamps it one above the highest of its kind: the Model's factories in a tab, the planner for a
creation that arrives without one (an agent's, the CLI's), the migration for a stored document written before it. A peer
that mints the same number at the same moment ties with another, and the tie is broken by id, so every peer still draws
one order. An item without one -- only a hand-made board's, since every stored item has one -- is the OLDEST, 0, so
anything made after it is newer and a board with none is drawn and aged by id, as the network's ages were before
(`createNetwork(() => 0)`). Measured: taking it as the newest made a link the planner had just stamped older than every
unstamped link on the board, and changed which pipe one corpus case swept.

One comparator for every reader that stacks or ages -- model/stacking.mjs, apart because the planner loads this module and
stacks nothing (scan-layers L10): the canvas's layers, the export, and the network's link ages, where a link's age IS its
drawing order (B259) -- the older link keeps a contested pipe (ruled 2026-09-30). Undo restores an item
with its order, so it comes back to its place (B10) and to its age.
*/
// one above the highest order of a kind -- 1 for the first
export const nextOrder = (model, kind) => {
	let top = 0;
	for (const e of model.all(kind)) if (Number.isInteger(e.order) && e.order > top) top = e.order;
	return top + 1;
};
