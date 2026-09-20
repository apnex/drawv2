# draw - geometry & interaction ATOMICS

Living record of the foundational visual + interaction decisions, resolved *before* any routing engine.\
Mockups that drove these: `../design/sim/handles.mjs` and `../design/sim/atomics.mjs` (`node ...` -> `/tmp/draw-preview.png`).\
Tags: **[LOCKED] / [OPEN] / [DEFERRED] / [OUT OF SCOPE]**.

## Pixel spec - variant `standard` [LOCKED]
See `HIERARCHY.md` section 2. pitch **60** - node **40** (+/-20) - uniform +3 ladder -> frame +/-20 - selection +/-23 - group +/-26 - zone +/-29 - radii 5/8/11/14 - socket 26 - linkW 6 - selArm 10.\
Connection markers: **port** = 10px square, green (`#aed581`); **junction pad** = 10px square, blue (`#4fc3f7`), opaque centre, stroke 2.6 (drawn over the links).

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
Mockups: `../design/sim/star.mjs` (5x5: node +/-20 vs single-cell group +/-26) - `../design/sim/parallel.mjs`.

---

## Labels & direction [DEFERRED]
Link/node labels and link direction (arrowheads / directionality) are **deferred until routing and handle mechanics are locked** - they layer on top of the substrate and must not constrain it.

---

## Waypoint sub-types: the junction [OPEN - design settled, unbuilt]

A waypoint is an **anchor** -- a grid point a link can reach -- and sub-types are additive layers on top of it (B199).
`endpoint` and `bend` exist; `junction` is the third, and it is the one that forces roles to stop being a single value.

The legacy `junction` kind in `kernel/geometry.mjs` is drawv1 residue: a 10px square tie point, unreachable from any document because the validator's id grammar has no `junction`.
It is **superseded** by this, not extended.

### What it means

A junction is a **MEET**: n links converge at one grid point and are connected.
Symmetric -- no trunk, no taps, no parent link.
The branch reading (a tap hanging off a trunk) is what the drawv1 element described and is deliberately not carried forward.

Engine semantics are intended but unspecified.
A junction is a place a mover could plausibly choose a path, which makes it a routing decision point rather than only a visual claim -- the specifics are owed before anything in `engine/` reads it.

### When a bend becomes a junction

**Count directions, not links.**
A link threaded through a waypoint by `via` contributes **two** directions -- the path enters and leaves.
A link terminating on it contributes **one**.
More than two directions is a junction.

| situation | directions | role |
|---|---|---|
| one link bends through | 2 | bend |
| one link terminates | 1 | endpoint |
| closed ring through it | 2 | bend -- a ring has no ends |
| two links bend through | 4 | **junction** |
| one bends + one terminates | 3 | **junction** + endpoint |
| three links terminate | 3 | **junction** + endpoint |

Counting LINKS instead would call a T-junction a bend, and a drop off a trunk is the most common junction in a network diagram.
Counting directions makes the T fire at two links, which is what it should do.

### The capability probe -- waypoint as a declared capability, not a kind

Tested on paper before any code moved, against the question: can waypoint-ness be expressed as a capability a NODE declares, with no `kind === 'waypoint'` in the path?

**Role derivation: zero divergence.**
`waypointRole(id, touching)` never consulted the kind -- it is pure link topology and is misnamed rather than miscoupled.
All six role cases produce identical answers when gated on a declared `routable` capability instead of on the kind.

**Rendering: composes.**
Expressed as a capability contributing LAYERS, the probe reproduced a bend, an endpoint and a plain node exactly, and then produced something currently inexpressible -- a `server` holding both `framed` and `routable`, drawing its frame and glyph AND the routing layers.

**Two supporting findings.**
`bboxOf` already treats node and waypoint identically, so the footprint was never different.
The text box is the same pattern already in production: `type: 'text'` with `span` and `content`, branching on field presence rather than on kind, and its own comment says "no new kind".

**What the probe did not cover, and where the cost sits.**
`waypoint` is an ID PREFIX, baked into the id grammar, the CLI and every stored diagram -- so collapsing it into `node` is a migration of live documents, not a refactor.
Ninety per-kind branches exist across the tree; the probe exercised six.
The staged path is to introduce capabilities ALONGSIDE the kind, prove them on the junction, which needs no migration, and collapse `waypoint` only once the mechanism is load-bearing.

### Roles become a set

Three of the six rows above carry two roles at once, so a single exclusive role cannot express the model.
`waypointRole` returns one string today and becomes `waypointRoles`, returning the sub-types that apply.

**The empty set is a bend.**
A bend adds no layer -- the path turning is its whole rendering -- so it is the absence of a sub-type rather than a member of the list.
Putting `bend` in the set would make `['bend', 'endpoint']` constructible, which is a contradiction nothing prevents, and would force the render loop to special-case a member meaning "draw nothing".
The CSS class is derived at the edge: `roles.length ? roles.join(' ') : 'bend'`.

### The migration hazard

`onEndpoint` in `engine/situation.mjs` gates spawner arming and reads `role === 'endpoint'`.
Under a set that comparison is **false for every waypoint**, it still compiles, and spawner arming silently stops working everywhere.
This is B201's shape exactly -- a comparison that keeps working while meaning something else -- and it is the reason the predicate transition is guarded before the rename lands rather than after.

Three producers derive the role, all by B162's rule that the derivation has one definition:
`kernel/engine.mjs`, `app/src/renderer.js`, and `engine/situation.mjs`.
Consumers split in two: renderers ask *which layers do I draw*, which is naturally set-shaped, and predicates ask *is this an endpoint*, which is where the hazard lives.

### BLOCKER: XOR occupancy forbids every junction case

`model/referential.mjs` enforces that **a waypoint participates in at most one link, and in one role within it** -- `linkReferential` refuses any waypoint already owned by another link.

Measured against the table above: two links bending through one waypoint is refused, the T is refused, three terminating links is refused.
Every topology A2 calls a junction is rejected at the trust boundary today.

So a junction is **not** a rendering feature waiting to be drawn.
It is an invariant change, and the rendering work is the small half.

The rule carries no recorded rationale -- it is stated in a code comment and appears in no spec, decision record or backlog row.
Before it is relaxed, that reason has to be recovered rather than assumed: it plausibly exists to keep routing unambiguous, so that a corner has exactly one owner and no link can be redrawn by editing another.
If that is the reason, a junction is a deliberate exception and the rule needs a carve-out keyed on the capability rather than a deletion.
If there is a deeper reason, junctions may need a different mechanism entirely.

**This is the next thing to settle.**
Nothing else in the junction design can be built until it is, because the validator will refuse the documents the feature exists to produce.

### Parked, with triggers

- **Two links crossing without connecting.** Currently unexpressible: occupancy is keyed by cell (`server/validate.js`), so two waypoints cannot share a grid point and any two links through one point share its waypoint. Revive when a diagram needs an overpass.
- **Two links bending through one point without becoming a junction.** Under this rule that is unconditionally a junction. Revive when a layout needs two routes to turn at the same cell independently.

Both are the same shape -- the grid cannot currently say "coincident but unconnected" -- and neither blocks the junction itself.
