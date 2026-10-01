/*
THE ONE DERIVATION ORDER -- B246 (H17.6, K15; condition C8 of dev/design/h17/PLAN.md).

Ascending entity id, as JavaScript compares strings. Collections keep insertion order, which differs between peers
holding one document -- two writers insert differently -- so every query that answers links sorts with this: the
Model's own queries (model/model.mjs), the relation index the client and the server attach (engine/relations.mjs), and
the spawners, which take a waypoint's first terminating link in it (engine/spawners.mjs). One comparator, so the three
cannot drift into three orders.

No server-stamped sequence: an order that needed one would be stored state, which is the stored-format batch's business.
`all()` iteration and renderer stacking stay insertion-ordered (F-ORDER, held in dev/BACKLOG.md).
*/
export const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
