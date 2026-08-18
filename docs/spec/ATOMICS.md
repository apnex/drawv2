# draw — geometry & interaction ATOMICS

Living record of the foundational visual + interaction decisions, resolved *before* any routing
engine. Mockups that drove these: `design/sim/handles.mjs` and `design/sim/atomics.mjs`
(`node …` → `/tmp/draw-preview.png`). Tags: **[LOCKED] / [OPEN] / [DEFERRED] / [OUT OF SCOPE]**.

## Pixel spec — variant `standard` [LOCKED]
See `HIERARCHY.md` §2. pitch **60** · node **40** (±20) · uniform +3 ladder → frame ±20 ·
selection ±23 · group ±26 · zone ±29 · radii 5/8/11/14 · socket 26 · linkW 6 · selArm 10.
Connection markers: **port** = 10px square, green (`#aed581`); **junction pad** = 10px square,
blue (`#4fc3f7`), opaque centre, stroke 2.6 (drawn over the links).

## Routed-corner radius [LOCKED] = 20 (= node radius)
A bend uses **radius = node radius (20)**, as in prism. Property (verified): the rounded corner
is exactly **inscribed** in a node placed at the turn vertex — the curve's endpoints land on the
frame (r20) and the arc stays inside. r<20 under-fills the node, r>20 over-fills it. Harmonises
traces with node footprints.

## Crossing vs junction [LOCKED]
- **Connected** → the **junction pad** (hollow blue square, opaque centre, 10px).
- **Crossing (not connected)** → **vertical wins**: the vertical wire is continuous, unmodified,
  on top; the **horizontal breaks with a tunnel-GAP** (not an arc). A **faint tunnel line** bridges
  the gap for continuity — blue, **half link-width (3)**, **half opacity (0.5)** (RailRoute-style).

## Attachment (link → node) [LOCKED — dual mode]
- **Face-locked** → when a link is locked to a specific face, a **port** (green square) marks that
  face (±20).
- **Centre** → otherwise the link connects to the node **centre** with **no port** (the stub is
  occluded by the filled frame, which renders on top).
- **Gesture (Q1 for nodes):** hover a node → grab handles appear on the 4 faces (±20) → drag to a
  target. Locking to a face yields a port; dropping to centre yields no port. (So Q1-node ≡ Q3,
  and the ±29/±30 question never touches node endpoints.)

## Container-edge handle (group / zone) [OPEN]
The *only* place ±29 vs ±30 bites. A container's edge handle/port sits on either:
- **A · hull (±29)** — port on the visible outline; the lane does a ~1px stub to reach it (already
  GRC-exempt). Reads as "attached to the zone".
- **B · cell line (±30)** — one lattice for content + routing; the port floats ~1px *outside* the
  hull (30 > 29), looking slightly detached.
Open observation: cell-line alignment (B) lets **two adjacent zones share one handle** on the
common cell line — possibly desirable; use case TBD. **Unresolved — revisit with use cases.**

## Routing fabric / auto-routing [OUT OF SCOPE — for now]
The cell-as-conduit fabric and auto-routing are **deferred**. Resolve the visual geometry of
**manual** links first. Future intent: routing may be enabled only **inside a zone** (scoped
routing regions), not on every cell.

## Manual-link routing [PARTIAL]
Manual links are orthogonal, rounded at **r=20**, on the 30/60 grid; they attach per the dual-mode
rule and the crossing/junction convention. Parallel-link capacity is settled (below).
**Still open:** the manual waypoint-laying affordance; bundled-vs-individual link rendering.

## Parallel-link capacity [LOCKED]
Parallel links attach via PORTS spaced along the attach boundary's face, centred, at a **4px gap**
(10px port + 4px = 14px centre-to-centre). The COUNT per face is capped by the boundary, because the
outer port must clear the ADJACENT face's outer port at the corner:
- **Node face (±20): 2 ports per face** (outer ±7). 3 cannot fit a 40px face AND clear the corner on
  a multi-face fan — proven: 3-on-all-faces overlaps at any gap (floor ±10 = zero clearance).
- **Group hull (±26): 3 ports per CELL of face length** (single-cell hub → 3 per face, outer ±14,
  corners ~12px clear). An N-cell group face holds ~3N. **More cells = more room.**
- **Hub principle:** a high-fan-out node is wrapped in a GROUP; links attach to the group hull, which
  has the boundary length a bare node face lacks. Beyond capacity → more cells / a wider group.
Mockups: `design/sim/star.mjs` (5×5: node ±20 vs single-cell group ±26) · `design/sim/parallel.mjs`.

## Labels & direction [DEFERRED]
Link/node labels and link direction (arrowheads / directionality) are **deferred until routing
and handle mechanics are locked** — they layer on top of the substrate and must not constrain it.
