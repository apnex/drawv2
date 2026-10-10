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

## 5. To-state and build order -- written after WD1, WD2 and WD4

### 5.1 To-state

- **A wide device is one anchor** (WD1); what it covers is the devices plugin's to declare, twice:
  - **its footprint** -- the cells it is drawn over, picked by and sized by, every wide device's (already the plugin's: `devices/device-footprint.mjs`; the place's size, below);
  - **the points it takes** beyond its own anchor -- a wide device's other cells, but none for a text label (WD2).
- **One declaration of what an entity takes, read at every door** (B323).
  The field contract gains one key: an extension may declare `takes(entity)`, the points beyond the anchor's own that an entity holds.
  - **The core's one-occupant rule** (B112, `model/invariants.mjs`) holds every anchor's point and every declared taken point to one holder, through the composition -- it names no plugin and reads no device field.
  - **The tab's occupancy index** (`engine/relations.mjs`) keys an entity by its own cell and its declared taken points; it reads `span` no more, and the width exception ends.
  - **The agent door's free cells** (`server/anchor.mjs`, and the REST listing of free anchors in `server/rest.js`) are counted the same way, so an agent is never offered a cell the planner refuses.
  - A composition without the devices plugin declares nothing taken: every anchor holds its own point alone.
- **A layout plugin owns the anchor grid** (WD4): the anchor's place on the node lattice and its extent, and the grid's dots -- moved from `product/canvas.mjs`.
  A place's size beyond one cell is asked of the part that composes the entity -- the devices plugin's footprint -- so neither the layout plugin nor the product reads a device field.
  The product keeps composition: the anchor's drawing order among the plugins' appearances, and its rank in a delete.
- **Stored documents do not change.**
  Every anchor in production stays valid: the 7 overlaps are under labels, which take nothing.
  An edit that would put an anchor on a point a host panel takes is refused at every door, as the tab refuses it today; a diagram already holding one would be loaded and reported, never refused (B83, `server/store.js`), and its other edits admitted (`planner/txn.mjs` refuses only a violation introduced or worsened).

### 5.2 Build order -- each stage provable before the next depends on it

| stage | what lands | proven by |
|---|---|---|
| **WD-a** | **One rule at every door (B323):** the `takes` key; the devices plugin's declaration; the core's rule, the tab's index and the agent door's free cells reading it | the four doors agree on a host panel and a label (test 1); production's 38 diagrams measured under the new rule, before deploy, with no violation; every corpus unchanged or each difference shown and traced to WD2 |
| **WD-b** | **The layout plugin (WD4):** `layout/` with the anchor's place and grid, its deploy plumbing; a place's size asked of the composing part; the product's part reduced to composition | the K8 DOM's grid identical; every corpus unchanged; the product's canvas part reads no device field and the layout plugin imports no plugin |
| **WD-c** | **Closed:** the ratchet that no module of the core or the network's rung reads a device field; B323 closed; B282's O4 half closed, its pack half held | the gate; production deployed with nothing changed for a user but the refusal WD2 rules |

**Size, by judgement:** WD-a moderate (the contract key, three readers, about four test files); WD-b small, most of it the new folder's plumbing; WD-c small.

---

## 6. Invariants and acceptance tests

1. **The doors agree** -- for a 3x1 host panel and a 3x1 text label: an anchor on the panel's second cell is refused by the planner (the server's door), refused by the tab (a stamp, a `w`), and not offered by the agent door (the free anchors, `place`); an anchor on the label's second cell is accepted by all four.
2. **Production stays valid** -- the new rule finds no violation in any of production's diagrams, measured on a private copy before WD-a deploys, and the deployed server's boot reports none.
3. **Nothing below the plugins reads a device field** -- no module of the core or the network's rung reads `span` (`engine/relations.mjs` today); the core's rule reads the composed `takes` alone.
4. **The layout plugin is the anchor grid's** -- `product/canvas.mjs` reads no device field; `layout/` imports no plugin; the K8 DOM's grids identical.
5. **The corpora** -- the planner, gesture, matrix and K8 DOM corpora unchanged, or each difference shown, and traced to WD2 (an anchor on a label's covered cell now admitted, or on a panel's now refused at a door that admitted it).
6. **Without the devices plugin** -- a composition without it declares nothing taken; a malformed `takes` is refused when the composition is built, naming its plugin.

---

## 7. Decisions for the director -- one at a time

- **WD1 -- what a wide device's anchors are.** Every cell (O4's first reading), its corners (the refinement's example), or one anchor with the cells it covers declared by the devices plugin (O4 amended: "any number", one until a use earns more).
- **WD2 -- whether a device's covered cells are taken,** and for which devices: held at every door either way (B323).
- **WD3 -- which anchor a link ends at,** if a device has more than one: the one the author released on, stored; or the device's, the nearest anchor chosen when the route is drawn.
- **WD4 -- the anchor's canvas part** (`product/canvas.mjs` `ANCHOR_ORDER`): a layout plugin of its own now, or the product's until a second composition needs a different one.

The M7 audit (section 8) and an adversarial review by an agent that did not draft this follow the rulings, before approval.

AMENDED 2026-10-10 -- **WD1 ruled: one anchor; the devices plugin declares the cells a device covers** (`dev/DECISIONS.md` WD1; it amends O4).\
No stored change and no migration; the width exception ends as a declared footprint the occupancy index asks.
**WD3 falls away:** with one anchor, every link and pipe ends where it ends today; anchors along a device return with WD1's revival trigger, the first wide device that needs links at more than one point.
Section 4's "the migration of the stored diagrams if the format changes" is out with it.

AMENDED 2026-10-10 -- **WD2 ruled: a text label's covered cells are free to other anchors; any other wide device's are taken -- at every door** (`dev/DECISIONS.md` WD2).\
Every anchor in production stays valid (the 7 overlaps are all under labels); the server begins to refuse an anchor under a host panel, as the tab does.\
The rule is the devices plugin's, declared with the footprint and checked by the planner, which ends B323.

AMENDED 2026-10-10 -- **WD4 ruled: a layout plugin now** (`dev/DECISIONS.md` WD4) -- over the proposer's recommendation to keep the part the product's until a second page needs a different grid.

---

## 8. Axiom alignment audit (M7)

**Identity:** H19.8, `dev/design/unification/WIDE-DEVICES.md`, against WD1, WD2 and WD4 and O4 as amended; constitution: mission-kit's axioms A1 to A14 as hydrated 2026-10-10.

| axiom | weight | how it holds -- or the tension |
|---|---|---|
| A2 Isomorphic Specification | load-bearing | one declaration of what an entity takes, read by the planner, the tab and the agent door -- the drift B323 measured cannot recur by construction |
| A3 Sovereign Composition | load-bearing | the footprint and the taking are the devices plugin's; the core's rule reads a composed key and names no plugin; the width exception ends. **Tension:** the layout plugin is a surface with one consumer, which A3's "earned by real consumers" would wait on -- the proposer recommended waiting; the director ruled it now (WD4), the cost named; recorded as the director's choice, carried as a guardrail rather than a fail |
| A8 Gated Recursive Integrity | load-bearing | each stage gated; the stricter rule measured against production before it deploys, and the corpora's differences shown and traced |
| A13 Director Intent Amplification | load-bearing | O4's literal reading amended by the director on measured evidence (WD1); the director's question answered by a decision, not assumed (WD4) |
| A1 Sovereign State Transparency | supporting | no stored change; the boot reports any violation and `/health` shows it (B83) |
| A9 Chaos-Validated Deployment | supporting | no data migration; a stricter rule is reported on load, never refused, so a mis-measure degrades rather than bricks |
| A4 Zero-Loss Knowledge | supporting | the director's words, the measurements and the screenshots' findings recorded whole |
| A10, A14 | supporting | B323 registered from the measurement; WD1's revival trigger recorded (RU3) |
| the rest | not materially implicated | no agent seam, context assembly or LLM path changes |

**Layered:** the format layer is untouched; the rule layer gains one key and one rule read three ways; the canvas layer gains one plugin and loses its last device-field read below the devices plugin.\
**Verdict: pass, with guardrails** --
1. production measured under the new rule on a private copy before WD-a deploys; the boot line checked after for no invariant violation;
2. every corpus difference shown and traced to WD2, or the stage stops;
3. the new folder's plumbing done by the checklist (the image, both server mounts, the layer manifest's lists, the copy lists in two tests);
4. WD1's revival trigger kept on B282's row.

**Closeout hooks:** WD-c re-checks tests 1 to 6, the boot line, and that B282's row carries its pack half and WD1's trigger.

---

## 9. Adversarial review (AR2) -- before ratification

**Reviewer:** an independent agent (the `code-reviewer` role) that did not draft this design, given the design, O4, WD1, WD2, WD4, KINDS-AS-PLUGINS section 16, B282, B323 and the code, and told to break it; it read only.\
**Its verdict:** "not ratifiable as-is; ratifiable with the listed changes" -- one blocker and nine major findings; none reopens WD1 or WD4.\
**Verified by the drafter before disposing, MEASURED:** undo and redo replay inverses without running the rules (`planner/txn.mjs` `undo`, `redo`); the agent API decides a cell's occupant by a point match (`server/rest.js` `occupantAt`); the CLI's parity counts occupied cells as nodes plus waypoints (`cli/verbs.mjs` `parityOf`); Ctrl+D's default step is one cell right (`app/src/input.js` `lastDelta`).
And measured on production's private copy: no two wide host panels overlap; none of their 157 covered cells holds an anchor; none of the 363 stored undo records places an anchor on one (checked against the panels' current places); the templates hold no violation (the reviewer's check).

| # | sev | finding | disposition |
|---|---|---|---|
| 1 | blocker | WD2's "taken" cells leave the agent API's `occupant` undecided: naming the panel breaks `draw parity` and `draw map`; not naming it leaves a cell neither free nor occupied, and the CLI's pre-checks pass a write the server refuses | **WD2 revisited** (below) -- under "free for every device" nothing an agent sees changes; under WD2 as ruled, the API's word for a taken cell is a further decision |
| 2 | major | undo and redo are a door: they replay without the rules, so an undo can restore an anchor under a host panel unreported | **WD2 revisited** -- moot if no cell is taken beyond its anchor; else named, and production's history measured clean (above) |
| 3 | major | WD2 was asked of a bend or a waypoint and ruled of any anchor: a device may now be stamped under a label | **WD2 revisited** -- both readings shown |
| 4 | major | "one holder per point" makes two overlapping host panels illegal, which WD2 never ruled; Ctrl+D of a wide host panel at its default one-cell step is refused | **WD2 revisited**; production measured: no overlap today |
| 5 | major | the discriminator is `type === 'text'`, which follows the door that made a panel (`draw panel` defaults to a host) and flips on a retype | **WD2 revisited** -- moot under "free for every device" |
| 6 | major | test 1 is not binary: a click with a type held retypes a label; `w` mid-drag over a label threads the label; the doors are not countable; the step's geometry claim (`app/src/input.js` `stepUnderPointer`) is held for hosts only | accepted -- test 1 rewritten by gesture and door once WD2 is settled; the geometry test extended to a text label |
| 7 | major | **a factual error in section 2:** the tab refuses only gestures that create an anchor; moving, nudging, resizing, cloning and duplicating a panel over anchors are admitted at every door, so the 7 overlaps may have come from the tab itself | **CORRECTED** below and on B323 |
| 8 | major | two more occupancy scans restate "which points are held" (`model/model.mjs` `occupiedAnyAt`'s scan, `devices/occupancy.mjs`'s scans); A2's "by construction" overclaims | accepted -- under "free for every device" every scan already agrees with B112 (points), and the index is brought to it; otherwise one core function every reader calls |
| 9 | major | WD4's "size asked of the composing part" is unspecified; "layout" already names the kernel's `LAYOUTS`, the REST `/layouts` and `place.layout` | accepted -- the contract specified before WD-b (a part's `sizes` per placed kind, one answerer, a waypoint one cell, refused when a kind has no place); the folder named for search (K27) -- proposed `anchor-grid/`, the director told |
| 10 | major | WD-c's ratchet as worded fails at once (the network's rung reads `type` by design), and "nothing changed for a user" is neither measurable nor true | accepted -- restated as test 3's `span` pattern over named modules, and the user-visible changes listed |
| 11 | minor | `place` of a wide entity checks only its anchor cell | **WD2 revisited** -- moot unless cells are taken |
| 12 | minor | templates are not in the measure | accepted -- measured (none), added to test 2 |
| 13 | minor | the `takes` contract's units, merge, self-point and refusal sentence are open; implementable within C9 | **WD2 revisited** -- moot if no key is added |
| 14 | minor | `model/invariants.mjs` is the network's rung, not the core | accepted -- wording corrected |
| 15 | minor | the tab refuses a waypoint by `occupiedAnyAt`, not `occupiedAt` | accepted -- corrected below |
| 16 | minor | a bend under a label is hard to point at: the device's pick and layer are above the waypoint's | accepted -- recorded as a standing consequence of labels over routes, true of the 7 today; out of this design |
| 17 | minor | the fence names neither undo, the API's `occupant`, the CLI's checks, gestures over labels, agent `place`, templates, the refusal sentence nor panel-on-panel | accepted -- the fence completed once WD2 is settled |
| 18 | minor | H19.8's board title names the held half | accepted -- AMENDED on the board |

CORRECTED (finding 7; section 2, "That it covers its other cells is enforced in the browser tab alone"): the tab refuses only the gestures that create an anchor -- a stamp (`devices/occupancy.mjs` `occupiedAt`, devices only), a waypoint and a drag's stop (`occupiedAnyAt`), the run-mode tower; moving, nudging, resizing, cloning and duplicating a panel over anchors are admitted at every door, the tab included.\
The rule enforced at no door is "a wide device's cells are its own"; the tab enforces only "do not create an anchor there".
