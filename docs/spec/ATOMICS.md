# draw - geometry & interaction ATOMICS

Living record of the foundational visual + interaction decisions, resolved *before* any routing engine.\
Mockups that drove these: `dev/design/sim/handles.mjs` and `dev/design/sim/atomics.mjs`.\
That sandbox is superseded by `kernel/` and no longer runnable -- the citations are provenance, recording what each decision was made against, not tools to reach for.\
Tags: **[LOCKED] / [OPEN] / [DEFERRED] / [OUT OF SCOPE]**.

## Pixel spec - variant `standard` [LOCKED 2026-06-15, graduated here 2026-09-19]

**`kernel/spec.mjs` is the authority.**\
It holds the four parameters and DERIVES the ladder from them -- `L_STD = derive(STD)` -- so the extents below are a computation, not a list.\
This section states what that computation is and why the parameters are what they are; where a number here and the kernel disagree, the kernel is right and this is stale.

**Budget equation** (per cell, one axis):

> **pitch = node + 18 + gutter**   -- the 18 is the ladder, 3px x 3 steps, each side

That equation is the reason `standard` is a VARIANT rather than the only possible geometry.\
Other variants change the parameters and re-derive; nothing else in the model moves.

| param | value |
|-------|-------|
| grid pitch | **60** -- the coordinate lattice; node centres define the space, everything routes around it |
| node | **40** (+/-20, `NODE_R 20`) |
| ladder step | **3px** -- frame -> selection -> group -> zone |
| zone gutter | **2px** between adjacent zones (1px each side of the cell boundary) |
| socket (glyph box) | **26px** (+/-13) |

**Derived:** frame +/-20 - selection +/-23 - group +/-26 - zone +/-29 (cell extent 58 within pitch 60, giving the 2px gutter).\
**Rounded radii:** 5 / 8 / 11 / 14 (frame / sel / group / zone), tracking the +3 gap.
Calibrated on a SQUARE node, because a circle hides the corner gap.\
Also: linkW 6, selArm 10.

- **selection** = corner brackets, 10px arms, rounded.
- **group** = `bbox(member node frames) + 6`, a CONTINUOUS rounded rect rather than brackets, so it stays distinct from selection.
  The gutter never touches it: a group's edges face the zone's outer edges, never the inter-zone gutter.
- **zone** = a cell-extent region (58 within pitch 60), translucent fill plus stroke -- an AREA, against the outline frames -- edges on the cell grid, backmost.
  The gutter lives only on shared inner edges between adjacent zones; outer edges stay on the cell boundary so group-to-zone clearance stays 3px.

**Socket = fixed 26px square** (+/-13), the glyph container.\
Sized just inside the inscribed square of the r20 circle: the true inscribed square is `r*sqrt(2) = 28.28`, and 26 leaves roughly 1px so even boxy glyphs clear the ring -- corners at `13*sqrt(2) = 18.4`, inside the ring's inner edge.\
**Every glyph normalises to it** -- centre its bbox, scale max-dimension to 26 -- so glyph size is ONE number and is identical for circle and square frames.\
The glyph is frame-shape-independent.

That normalisation is what B205 turned out to be about: a palette tile scaled the art by a constant instead of fitting it to this box, so six glyphs rendered at six wrong sizes.

**Z-order** (back to front): zone fill -> links -> group -> node frame -> glyph -> selection.

**Connection markers:** **port** = 10px square, green (`#aed581`).
The **junction pad** -- 10px square, blue (`#4fc3f7`), opaque centre, stroke 2.6 -- is drawv1 residue and is superseded by the waypoint junction sub-type below; it is unreachable from any document, because the validator's id grammar has no `junction`.

---

## Routed-corner radius [LOCKED] = 20 (= node radius)
A bend uses **radius = node radius (20)**, as in prism.\
Property (verified): the rounded corner is exactly **inscribed** in a node placed at the turn vertex - the curve's endpoints land on the frame (r20) and the arc stays inside. r<20 under-fills the node, r>20 over-fills it.\
Harmonises traces with node footprints.

---

## Crossing vs junction [LOCKED]
- **Connected** -> the **junction pad** (hollow blue square, opaque centre, 10px).
- **Crossing (not connected)** -> **vertical wins**: the vertical wire is continuous, unmodified,
  on top; the **horizontal breaks with a tunnel-GAP** (not an arc). A **faint tunnel line** bridges
  the gap for continuity - blue, **half link-width (3)**, **half opacity (0.5)** (RailRoute-style).

---

## Attachment (link -> node) [LOCKED - dual mode]
- **Face-locked** -> when a link is locked to a specific face, a **port** (green square) marks that
  face (+/-20).
- **Centre** -> otherwise the link connects to the node **centre** with **no port** (the stub is
  occluded by the filled frame, which renders on top).
- **Gesture (Q1 for nodes):** hover a node -> grab handles appear on the 4 faces (+/-20) -> drag to a
  target. Locking to a face yields a port; dropping to centre yields no port. (So Q1-node == Q3,
  and the +/-29/+/-30 question never touches node endpoints.)

---

## Container-edge handle (group / zone) [OPEN]
The *only* place +/-29 vs +/-30 bites.\
A container's edge handle/port sits on either:
- **A - hull (+/-29)** - port on the visible outline; the lane does a ~1px stub to reach it (already
  GRC-exempt). Reads as "attached to the zone".
- **B - cell line (+/-30)** - one lattice for content + routing; the port floats ~1px *outside* the
  hull (30 > 29), looking slightly detached.
Open observation: cell-line alignment (B) lets **two adjacent zones share one handle** on the common cell line - possibly desirable; use case TBD.\
**Unresolved - revisit with use cases.**

---

## Routing fabric / auto-routing [OUT OF SCOPE - for now]
The cell-as-conduit fabric and auto-routing are **deferred**.\
Resolve the visual geometry of **manual** links first.\
Future intent: routing may be enabled only **inside a zone** (scoped routing regions), not on every cell.

---

## Manual-link routing [PARTIAL]
Manual links are orthogonal, rounded at **r=20**, on the 30/60 grid; they attach per the dual-mode rule and the crossing/junction convention.\
Parallel-link capacity is settled (below).
**Still open:** the manual waypoint-laying affordance; bundled-vs-individual link rendering.

---

## Parallel-link capacity [LOCKED]
Parallel links attach via PORTS spaced along the attach boundary's face, centred, at a **4px gap** (10px port + 4px = 14px centre-to-centre).\
The COUNT per face is capped by the boundary, because the outer port must clear the ADJACENT face's outer port at the corner:
- **Node face (+/-20): 2 ports per face** (outer +/-7). 3 cannot fit a 40px face AND clear the corner on
  a multi-face fan - proven: 3-on-all-faces overlaps at any gap (floor +/-10 = zero clearance).
- **Group hull (+/-26): 3 ports per CELL of face length** (single-cell hub -> 3 per face, outer +/-14,
  corners ~12px clear). An N-cell group face holds ~3N. **More cells = more room.**
- **Hub principle:** a high-fan-out node is wrapped in a GROUP; links attach to the group hull, which
  has the boundary length a bare node face lacks. Beyond capacity -> more cells / a wider group.
Mockups: `dev/design/sim/star.mjs` (5x5: node +/-20 vs single-cell group +/-26) - `dev/design/sim/parallel.mjs`.

---

## Labels & direction [DIRECTION DESIGNED 2026-09-22, labels still deferred]
Link/node **labels** remain deferred until routing and handle mechanics are locked - they layer on top of the substrate and must not constrain it.

Link **direction** is no longer deferred.\
The condition this deferral named has been met: handle mechanics locked with the junction, and routing is specified below.\
See "Declared direction and the collapse matrix".

---
## Waypoint sub-types: the junction [BUILT 2026-09-19, one part open]

A waypoint is an **anchor** -- a grid point a link can reach -- and sub-types are additive layers on top of it (B199).\
`endpoint` and `junction` are the sub-types; a **bend adds nothing**, so it is the absence of one rather than a third.

The legacy `junction` kind in `kernel/geometry.mjs` is drawv1 residue -- a 10px square tie point, unreachable from any document because the validator's id grammar has no `junction`.\
Superseded by this, not extended.

### What a junction is

A **MEET**: links converge at one grid point and are connected.\
Symmetric -- no trunk, no taps, no parent link.

**Terminations only, and more than two of them.**\
A link merely bending through a point is not meeting anything there, so threading is invisible to the count -- and that case cannot arise anyway, because landing on a bend SPLITS it.

Two terminations is one of three shapes and none is a meet.\
One in and one out is a path passing THROUGH, which is a bend.\
Two arrivals, or two departures, is a terminus that something else also reaches or leaves from.\
Three is the smallest place routes converge.

That keeps the role rule and the collapse rule in agreement: of the three 2-link shapes only in-and-out is expressible as a single bending link, and that is exactly the one `collapseAtWaypoint` accepts.\
So no waypoint reads as a junction nothing will collapse, and none collapses out from under a role still claiming it.

**Deleting a link never deletes what it terminated at.**\
Not the node at one end, and not a waypoint at the other.\
A waypoint a link ENDED at survives losing it and falls back to a plain anchor -- the ring and the grid dot, no sub-type layer, because `waypointRoles` returns the empty set for a waypoint with no links.

A BEND is different and still goes.\
It exists only to shape a path, so with no path it is debris that still renders and still holds its anchor.\
That is what the sweep was written for -- 64 bends left over from one deleted ring -- and its reasoning never extended to a terminus.

**The collapse is the split's inverse, and lives in the server planner.**\
When a write leaves a waypoint with one link in and one out, the two rejoin into a single link bending through it and the INBOUND link's id survives -- the same id the split kept, so split-then-delete is a round trip back to the route the author drew.

In `server/txn.mjs`, beside the orphan sweep that solves the same shape of problem and already carries the scope rule it needs: only waypoints THIS transaction touched.

It reacts to a link being REMOVED, never to one being added.\
A collapse answers a shape left behind, and only a removal can leave one -- scoping it to any touched link collapsed two links into a bend the moment the second was drawn, so a two-link terminus could not be built at all.\
It was first written in the client's delete command, where it could not see undo or redo -- those are computed server-side and never run a client command -- nor the CLI and REST doors.\
One rule, one place, every door.

Engine semantics are intended but unspecified.\
A junction is a place a mover could plausibly choose a path, which makes it a routing decision point rather than only a visual claim.\
The specifics are owed before anything in `engine/` reads it.

### Roles are a set

`waypointRoles(id, touching)` returns the sub-types that apply, because three cases carry two at once -- a waypoint where three links terminate is a junction AND an endpoint.

It counts DIRECTIONS rather than links: a link threaded by `via` contributes two, one terminating contributes one, and more than two is a junction.\
Counting links instead would call a T a bend.\
The derivation and its cases live in `kernel/geometry.mjs` beside the code, which is the one place they cannot go stale against it.

**The empty set is a bend.**\
Including `bend` as a member would make `['bend','endpoint']` constructible, which is a contradiction nothing prevents, and would force every render loop to special-case a member meaning "draw nothing".

`waypointLayers(roles, ext)` turns the set into the layers to draw -- anchor first, dot last, so no opaque pad buries what sits inside it.

**A circle a line STOPS at is opaque; a circle a line passes through is not.**\
The endpoint pad and the junction ring both fill with the canvas colour, so links end at their edge rather than showing their tails crossing underneath.\
The anchor stays hollow: a bend is a path TURNING, and an opaque anchor would break every route it bends, making a corner read as a gap.\
Both renderers walk that one list, so a new sub-type is one change rather than two.

### What the validator enforces

The old rule refused any waypoint already owned by another link, which rejected every junction topology.\
It was two checks under one name and only one moved.

- **Self-conflict stays.** One link naming a waypoint twice across its own `src`, `dst` and `via` visits a point twice and the geometry is undefined.
- **Sharing relaxed.** Two links meeting at one waypoint is the junction.
- **A repeated endpoint pair is refused.** Two links that bend at the same waypoint may not carry the same `src`/`dst` pair, compared unordered.

Whether a SECOND STRAIGHT link may join a pair is `straightCapacity` in `model/invariants.mjs`, a separate rule in a separate layer.

### The split [BUILT 2026-09-19]

**Linking to a bend splits the link it bends.**\
`a->b via [w]` becomes `a->w` and `w->b`, and the new link makes three terminating at `w`.\
This is what keeps "terminations only" true by construction rather than by convention.

**On RELEASE, not on touch.**\
Pressing `w` on an occupied bend mid-drag threads it like any other waypoint and commits nothing, so a route can continue through it and multiple bends in one drag keep working.\
`commitRoute` already assembles placed waypoints and the link into one undo step; the split joins that same commit.

**Both halves get new ids.**\
The original ceases to exist rather than being mutated into one half: `del` the old, `put` two.\
The `via` list divides at the split index and the remainder carries to each side -- `a->b via [w1,w2,w3]` split at `w2` gives `a->w2 via [w1]` and `w2->b via [w3]`.

Two cases must refuse rather than split.\
A link whose `src` or `dst` is already the split waypoint would produce a self-link; that state cannot exist today because self-conflict refuses it, so assert rather than handle.\
A CLOSED ring has no ends and cutting one is undefined.

`splitAtBend` in `model/invariants.mjs` computes the halves; `commitRoute` finds which existing links the new one turns into junctions, and `routeLink` carries the `del` plus two `put`s in the same entry list.

Checked on building: the repeated-pair rule from B207 is NOT unreachable.\
The editor can no longer produce it, because a second link splits the first rather than bending beside it -- but the REST and CLI doors write documents directly, so the rule still fires and still earns its place.

### Open

- **A limit on how many links may meet at one junction.** Twenty is legal and useless.

  A COUNT is not derivable. Links are not constrained to right angles -- `kernel/router.mjs` says "axis-aligned segments" in its determinism argument, but `roundedPath` accepts arbitrary vectors, verified by routing a diagonal. There is no quantised set of directions to count.

  What bounds it is ANGULAR SEPARATION at the junction ring, the smallest circle the links cross: at r=7 with 6px links, four are 90 degrees apart with 5px clear, six are 60 apart with 1.3px clear, eight at 45 overlap. But that holds only for even spacing, and two links five degrees apart are indistinguishable however few there are.

  A cap of 4 would refuse a six-way junction that reads perfectly well while admitting two links five degrees apart -- wrong in both directions. The fix, when one is needed, is angular rather than a number.

- **Why the old occupancy rule was written.** No recorded rationale -- a code comment, and nothing in any spec, decision record or backlog row. The reconstruction is that it conflated self-conflict with sharing, which the split into two independently-failing checks supports.

### Parked, with triggers

- **Two links crossing without connecting.** Unexpressible: occupancy is keyed by cell, so two waypoints cannot share a grid point and any two links through one point share its waypoint. Revive when a diagram needs an overpass.
- **Two links bending through one point without becoming a junction.** The split makes this impossible by construction. Revive when a layout needs two routes to turn at the same cell independently.

Both are the same shape -- the grid cannot say "coincident but unconnected".

### Evidence

Built as B206 through B209, each step guarded before the next: the two checks split with no behaviour change, sharing relaxed, roles made a set, and the layers rendered.\
The capability probe behind the sub-type model is recorded in [`../../dev/DECISIONS.md`](../../dev/DECISIONS.md) under the staged universal node.

---
## Declared direction and the collapse matrix [DESIGNED 2026-09-22]

A link has a **stored order** -- which end the model calls `src` -- and it may have a **declared direction**, an assertion by the author that something flows one way.\
These are different things, and conflating them is the defect this design answers.

Stored order is a byproduct of which end the author happened to drag from.\
Declared direction is meant, is visible, and is the only direction any rule may read.

### The rule

**No rule may branch on `src`/`dst` ordering unless the link carries a declared direction.**

An undeclared link is symmetric.\
Drawing `A` to `B` and drawing `B` to `A` produce the same diagram, and every rule must agree that they do.

### What a waypoint is, by what meets there

Direction is measured **relative to the waypoint**, never from the stored fields.\
A link stored `src: w` but declared as flowing toward `w` is an inbound link at `w`, whatever `src` says.

| terminations | directions | what it is |
|---|---|---|
| 1 | any | endpoint |
| 2 | agree -- one in, one out | bend |
| 2 | oppose -- both in, or both out | junction |
| 3 or more | any | junction |

An **endpoint** is a terminus: one link, nothing beyond it.\
A **junction** is where flow does something other than continue: it converges, diverges, or has more than two ways to go.\
A **bend** is flow passing through, which is why it adds nothing -- geometry changes, meaning does not.

Two undeclared links are always a bend.\
Having no direction, they cannot oppose one another, so only the count matters.

This **revises the built rule** that more than two terminations makes a junction (B214).\
Two can now be a junction as well, so `waypointRoles` takes direction as an input where today it only counts.

### Propagation

Declared direction **inherits** along a run of bends.\
One declaration at the head of a path colours the whole run, so an end-to-end direction costs one gesture rather than one per segment.

Inheritance is **derived, never stored**.\
Undeclaring the head must un-colour the run, which is only possible if the run was never written down -- the same discipline the roles follow.

Two opposing declarations on one run **fragment it**: the waypoint between them has two links that oppose, which the table above already calls a junction.\
This is not a special case but the general rule arriving where it applies.\
The alternative -- latest declaration wins and overwrites the earlier one -- was rejected because it silently rewrites an authored decision whose only evidence is a change somewhere off-screen.

### Packets

A junction passes packets, and what it does with one depends on **how much the packet knows**.

- Knows nothing -> **clone**, to every outward way.
- Knows only that it must move -> **round robin**, fairly and deterministically.
- Knows its destination -> **route**, computed over the graph toward an armed endpoint.

None of the three needs a routing table, so a junction holds no state.\
The control plane is computed server-side and the browser is a stateless data plane: it executes and renders what it is given, and a reload recomputes the same answer rather than resuming a remembered one.

### Why this is one substrate

A router is not a node that routes.\
It is a waypoint carrying a router glyph and a routing capability -- the same substrate, differently dressed.

A waypoint today cannot hold a glyph, a type or content, and a node cannot be a junction or take part in a collapse.\
Neither restriction has a recorded reason; they are two evolved shapes rather than two designed ones.

### Evidence

Two defects prompted this and share one cause: the collapse reads stored order as though it were declared.\
The experiment that isolated it held topology, counts and waypoint identical and varied only the direction of the drag -- one order collapsed, the other did not.

Recorded as B221 and B222.
