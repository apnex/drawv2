# draw -- Anchors and grid layouts

The vocabulary an agent uses to say WHERE, and the rule that makes an invalid where impossible to express.

This is a design of record for a slice that is not built yet.\
It exists because the alternative was deciding a kernel change and a naming collision inside a commit message.

---

## Why

B110 made an off-grid coordinate a refusal instead of a silent corruption, and that is worth having, but it only rejects.\
An agent still computes pixels, still has to know the pitch is 60, and still has to know that zones use an offset the node grid does not.\
It got both wrong on the first attempt, and so did the author of B110 while repairing it by hand.

The fix for a rule that is easy to break is not a better error message.\
It is a vocabulary in which the broken thing cannot be said.

`model/invariants.mjs` already states this, and states it about this exact failure.\
Its opening paragraph records that putting *one straight link per pair* in the two authoring sites left `set` unbound by it, and concludes that a caller which does not pass through the guard is not bound by the guard.\
Snapping in `app/src/snap.js` is that sentence again with the agent door as the unbound caller.

---

## An anchor is a grid position

An anchor is a place.\
It is named either by reference to an entity or by position on a grid, and the two are the same kind of thing -- this is why `model/model.mjs` already resolves a link route over anchors and already admits *a cell coord as a free anchor*.

That existing meaning is not a collision to be avoided.\
It is the same concept arriving from the other direction, and the term stays one term.

An anchor carries both the cell and the pixels it resolves to:
```text
{ layout: 'node', cx: 4, cy: -2, x: 240, y: -120, occupant: 'node-aa0001' }
```

The pixels are present so that a consumer never multiplies, and the cell is present so that a consumer never divides.\
`occupant` is the node currently at that anchor, or `null`.

---

## Two layouts, and the kernel owns both

The kernel today knows one grid: `cellOf` is `Math.round(v / pitch)` and `cellPx` is `cx * pitch`, both offset zero.\
That is the node grid, and it is the only one -- the half-pitch offset that zones use appears in `app/src/snap.js` and, since B110, again in `server/validate.js` (**B111**).

A layout is a named origin and pitch, and there are two:
```text
node    offset 0            nodes and waypoints sit ON cells
zone    offset pitch / 2    zones BOUND cells, so their edges fall between them
```

Naming them is what removes the duplicate.\
`snap.js` and `validate.js` both source a layout rather than each restating the offset, and an agent asking where a zone may sit stops getting an answer from the node grid.

Layouts live in the kernel for this slice.\
Programmable or per-document layouts are wanted later and are not this slice; putting them in the document now would duplicate a truth the kernel already holds and let a document drift from it.

---

## One anchor holds one node

An anchor has at most one occupant, and the rule belongs in `model/invariants.mjs` beside the ones already there.

Nothing enforces it today -- the model accepts two nodes at identical coordinates without complaint -- and yet the live estate holds zero collisions across 146 entities, because a human dragging a node can see the one already there.\
That is the same shape as the grid rule: an invariant everybody relies on, true only because the one path able to break it had a human watching.

`violations()` is the right home and not merely an available one.\
It is consulted by the transaction planner against the state a transaction would PRODUCE rather than per operation, so a batch may transiently collide and end valid.\
It reports only what a transaction INTRODUCES, so a document that somehow holds a collision can still be repaired rather than being refused for the condition the repair exists to remove.

That second property answers a problem this document previously worried about.\
A load-time check would brick an existing document; an introduced-only invariant cannot, which is why the estate being clean is reassuring rather than load-bearing.

Grid alignment stays where B110 put it, and the split is deliberate.\
`server/validate.js` answers *is this entity well-formed on its own* -- shape, range, and now pitch -- at the trust boundary, where a per-field refusal names the field an agent got wrong.\
`model/invariants.mjs` answers *is this document consistent*, which is a question no single entity can be asked, and occupancy is that kind of question.

---

## The surface

The routes an agent would use:
```text
GET  /api/v1/diagrams/<id>/layouts
GET  /api/v1/diagrams/<id>/layouts/<name>/anchors?free=1
GET  /api/v1/diagrams/<id>/layouts/<name>/nearest?x=<px>&y=<px>
```

`nearest` answers the question that started this: give me somewhere legal near here.\
`anchors?free=1` answers the other half -- where may I put something that is not already taken -- and it is the R13 occupancy index projected, not a new computation.

An agent that uses these never writes a coordinate it derived.

---

## Deliberately not in this slice

Hierarchical layouts, where a zone emits its own grid and an anchor is relative to it.\
Anchors are absolute here.\
Nesting needs a design exercise of its own, because a relative anchor has to say what it is relative to, and every consumer then has to resolve it.

Programmable layouts, per document or per zone.

Layer 2 placement -- *below `app-1`*, *inside zone `core`*, *these three in a row*.\
That is the level at which an agent stops expressing geometry at all, and it is the reason to get this vocabulary right rather than merely correct.

---

## Open

Whether a waypoint occupies an anchor, or only a node does.\
The R13 index already keys both by cell, so the index says yes and the sentence above says node.\
A waypoint sharing a node's anchor is meaningless rather than harmful, which argues for one occupant of either kind, but it should be ruled rather than assumed.
