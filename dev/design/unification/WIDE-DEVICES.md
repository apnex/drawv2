# A wide device and its anchors -- H19.8 (DELTA, proposed)

> **Tier 3 -- a design of record, proposed.** Written 2026-10-10 against `6b8bac5`.
> Facts about production and the code are measured and cited; judgements are marked as such.
> Proposes; decides nothing. Section 7 holds the decisions for the director, to be asked one at a time.

## 1. Status

- **Asked for:** the director, 2026-10-10 -- "write the design", after the canvas arc closed (`dev/BOARD.md` H19.8).
- **Is:** B282's half that O4 added (`dev/DECISIONS.md` O4, 2026-10-08): "An anchor occupies a single cell on a grid. A wide device that occupies multiple cells has multiple anchors" -- refined the same day: "a multi-cell node may have any number of anchors, and not strictly all cells will get them. I.e a large panel might just have anchors at corners".
  With it: which anchor a link ends at, the migration of the stored diagrams, and the end of the width exception (`dev/design/unification/KINDS-AS-PLUGINS.md` section 16.3).
- **And the director's question** (2026-10-10, on the anchor grid): "this would be a 'layout' plugin correct?" -- whether the anchor's canvas part becomes a plugin of its own.
- **Not:** B282's other half, a device type as a composition of packs -- held, its trigger unchanged: the second pack that composes.

---

## 2. From-state -- measured 2026-10-10

**Production** (all 38 diagrams, read from the store's bucket into a private scratch copy, schema 2 throughout):
- **118 wide devices** -- a device whose span covers more than one cell -- **in 20 diagrams**: 109 text panels and 9 hosts, covering 1,055 cells.
  The figures recorded with O4 (144 in 22 of 40) predate the four diagrams deleted on 2026-10-08 and later edits.
- **Every wide device is a content panel.**
  The text panels are labels and callouts: viewed in two of the diagrams, labels sit on link routes ("vpc-spoke", "hybrid-spoke") with the routes' bends beneath them, and a dotted link points at a note.
  The 9 wide hosts are a legend ("key"), "controls", a header, two flow and gate panels, two site panels and a "control-bar".
- **6 links end at a wide device** -- 5 at text panels, callouts, and 1 at the control bar -- all straight; 6 pipes, the links' own; no routed link.
  A link ends at its anchor's point, the centre of the device's top-left cell (`network/network-queries.mjs` `pathOf`, which resolves an end by `model.endpointOf`; nothing clips a link to a frame).
- **7 anchors already sit on cells a wide device covers** -- all waypoints, each carrying a link: bends and ends under a label, in 5 diagrams.
  Of the 7, 5 are on a corner cell of the panel and 2 inside it.
- **Anchors a migration would add,** by where a wide device's anchors go: none with one each; 188 at its corners, colliding with 5 of those waypoints; 937 at every cell, colliding with all 7.
- Three wide devices are group members, in two groups; none carries `spawn` or `transit`.

**The code:**
- **A wide device is one anchor,** at its top-left cell, with a `span` the devices plugin owns (`devices/device-fields.mjs`).
- **That it covers its other cells is enforced in the browser tab alone:** the tab's occupancy index keys a device by every cell its span covers (`engine/relations.mjs` `cellsOf` -- the width exception, KINDS-AS-PLUGINS section 16.3), and the tab refuses an anchor there (`devices/occupancy.mjs` `occupiedAt`).
  The planner, the server and the agent door hold only that one anchor sits on one point (B112, `model/invariants.mjs`).
  So the doors disagree, and production holds the 7 overlaps above -- **B323**.
- **What reads a device's width:** the devices plugin (its place, footprint, picks, drawing, size step, labels), the kernel's drawing and the export (`kernel/geometry.mjs`, `kernel/renderer.mjs`, `kernel/adapt.mjs`), the groups plugin's hull, the CLI's panel verb (`cli/verbs.mjs`), and the occupancy index -- the one reader below the plugins.
- **The anchor's canvas part is the product's** (`product/canvas.mjs` `ANCHOR_ORDER`): the anchor's drawing order, its place on the grid -- the size beyond one cell read from a device's span -- its grid's dots and its rank in a delete.

---

## 3. Findings that shape the design

### 3.1 The multi-anchor device has no user in production

O4 was ruled to keep the core's duty exact -- an anchor is one cell -- and multiple anchors were the consequence for a wide device.\
MEASURED: no wide device in production is used as a device something attaches to at more than one point; all 118 are panels, and 6 of them carry one link each.\
JUDGEMENT: anchors along a wide device would be earned by a use -- a bus bar with several links, a panel with ports -- which production does not yet have (A3: surfaces earned by real consumers).

### 3.2 Labels over routes are the common case, and anchors on their cells would collide

The bends under labels are an author's intent, not damage: a label names the route it sits on.\
Anchors on a label's cells would refuse a bend there from then on, and the migration would have to move 5 or 7 existing bends -- redrawing the routes they carry -- or move the labels.

### 3.3 The width exception is a door disagreement, not only a layering one

Section 16.3 recorded that the index reads a plugin's field.\
MEASURED here: the rule it enforces -- a wide device's cells are taken -- holds in one door only, so the server stores what the tab refuses.\
Whatever the anchors become, B323 asks for one rule at every door.

---

## 4. The fence and the anti-scope

**In:** what a wide device's anchors are and where; which anchor a link or a pipe ends at; whether a device's covered cells are taken, held at every door (B323); the end of the width exception; the migration of the stored diagrams if the format changes; the anchor's canvas part, if the director rules it a plugin.
**Out:**
- **A device type as a composition of packs** -- B282's other half, held.
- **What a panel draws** -- its content regions, frame and labels stay as they are.
- **Routing over a wide device** -- whether a route may pass under a panel is the network's, unchanged.
- **The REST API's word "anchor" for a grid point** -- B310, held.

---

## 5. Build order

To be written once section 7's decisions are ruled: every option there has its own stages, and staging an option not chosen would be delta content written twice.

---

## 6. Invariants and acceptance tests

To be written with the build order, from the decisions; the ones every option shares:
1. One rule for whether an anchor may sit on a cell a device covers, held at every door -- the planner, the server, the agent door and the tab.
2. No core module, and no module of the network's rung, reads a device's field.
3. Every link and pipe in production ends where it ended before, drawn the same, or the difference is ruled.
4. The planner, gesture, matrix and K8 DOM corpora unchanged where the decisions change nothing that is drawn.

---

## 7. Decisions for the director -- one at a time

- **WD1 -- what a wide device's anchors are.** Every cell (O4's first reading), its corners (the refinement's example), or one anchor with the cells it covers declared by the devices plugin (O4 amended: "any number", one until a use earns more).
- **WD2 -- whether a device's covered cells are taken,** and for which devices: held at every door either way (B323).
- **WD3 -- which anchor a link ends at,** if a device has more than one: the one the author released on, stored; or the device's, the nearest anchor chosen when the route is drawn.
- **WD4 -- the anchor's canvas part** (`product/canvas.mjs` `ANCHOR_ORDER`): a layout plugin of its own now, or the product's until a second composition needs a different one.

The M7 audit (section 8) and an adversarial review by an agent that did not draft this follow the rulings, before approval.
