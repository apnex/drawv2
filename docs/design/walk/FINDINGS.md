# Connection walk -- findings & spawned hypotheses

Running record of the GRC walk (style x rung).\
Failures are kept (history) and each generates a "what would make it pass" hypothesis -> new candidate styles/rungs.\
Criteria: grid-snap / clearance / attachment / reserve / count-honored (`docs/design/walk/grc.mjs` + run.mjs).

---

## Walk 1 -- rungs 1-5 x {ports, hybrid, nodeAligned, edgeNode}
- **ports / hybrid / nodeAligned** -- survive all of rungs 1-5.
- **edgeNode** -- FAILS every rung: `grid-snap` (a gateway *node* sits on the zone edge, off the
node grid) + `clearance` (overlaps the inside node in its column).
  - **Principle exposed:** a node is a *cell-resident*; it cannot live on an edge (off-grid,
    between cells) -- it breaks the grid and collides with the cell's occupant.
  - **-> spawned `gateway-cell`:** put the bridging node in a reserved on-grid GAP cell, stubbed
    to each zone edge.

---

## Walk 2 -- added {gatewayCell, bus} + the count-honored criterion
- **nodeAligned, gatewayCell** -- clean sweep (all rules, all rungs). `gatewayCell` *validates the
failure->remediation loop* (the variant a failure generated now passes everything).
- **ports / hybrid / bus** -- clean except `count` at `3-parallel3`: `made 2/3`.
  - **Principle exposed:** node-agnostic gutters number `cols - 1`, so these styles cap parallel
    at N-1 between N-column zones; node-aligned / gateway-cell use the columns -> up to N.
  - **-> spawned `outer-flank gutters`:** let gutter styles also use positions beyond the end
    columns (cols+1 slots) to honor higher counts.
- **bus** -- valid but undifferentiated at low count; **needs a wide / high-count rung** to show
its bundling payoff.
- **edgeNode** -- retained as eliminated history.

---

## Walk 3 -- added rungs {6-wide, 7-group-zone, 8-group-group} + the ortho criterion
- **nodeAligned** -- clean sweep on all 8 rungs (single/parallel/wide/group<->zone/group<->group).
**Front-runner.**
- **gatewayCell** -- clean except `7-group-zone`: `grid-snap[fractional@58.5]`. The bridge sits at
the arithmetic midpoint of the two edges; group<->zone is asymmetric (group hull **26**, zone **91**)
  -> mid **58.5**, fractional. (group<->group passed: (26+94)/2 = 60.)
  - **-> remedy:** snap the bridge node/trunk to the nearest **on-grid gap row** (e.g. 60), never
    `(from+to)/2`.
- **bus** -- same 58.5 bug at group<->zone + the `count` cap.
- **ports / hybrid / bus** -- `count` cap = **cols-1** confirmed (3-parallel 2/3; 2-col group rungs 1/2).
- **edgeNode** -- eliminated on every rung.
- **ortho** -- passes everywhere (no diagonals yet; bites at fan-out / routing).
- **Refuted:** `outer-flank gutters` -- for a tight zone (= cols + ext) the flank positions fall
*outside* the zone edge, so node-agnostic genuinely caps at cols-1.\
Higher count => more columns (wider topology) or a column-based style.
- **Remediation applied (gap-row snap):** `gatewayCell`/`bus` now place the bridge at the nearest
on-grid node row, not `(from+to)/2`.\
Result: **`gatewayCell` = clean sweep on all 8 rungs** (joins `nodeAligned`); `bus` grid-snap cleared (only the count cap remains).\
The failure->remediation loop produced a winning survivor (`gatewayCell`, born from edge-node's failure).

---

## Survivors after walks 1-3 (attachment layer)
- **nodeAligned** and **gatewayCell** -- clean on all 8 rungs.
- **ports / hybrid / bus** -- viable when count <= cols-1.
- **edgeNode** -- eliminated.

---

## Open hypotheses / next rungs
- `outer-flank gutters` (ports/bus capacity).
- **wide / high-count rung** (show bus bundling; test flank gutters).
- **group-edge attachment** (group<->zone, group<->group) -- true attachment, not coexistence.
- **junction (1->many)** rung.
- **routing rungs** (offset / ortho turn / pass-through) -- need line-routing concepts; borrow
from github.com/apnex/fractal + prism before building these.
