# A wide device and its anchors -- H19.8 (DELTA, proposed)

> **Tier 3 -- a design of record, proposed.** Written 2026-10-10 against `6b8bac5`.
> Facts about production and the code are measured and cited; judgements are marked as such.
> Proposes; decides nothing. Section 7 holds the decisions for the director, to be asked one at a time.
> AMENDED 2026-10-10: **APPROVED** by the director -- "approved. continue" -- after three adversarial passes (sections 9, 11, 13) and the rulings WD1, WD2 revisited, WD4 to WD8; built at H19.44 to H19.47.

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

**In:** what a wide device's anchors are and where; which anchor a link or a pipe ends at; whether a device's covered cells are taken, held at every door (B323); the end of the width exception; the migration of the stored diagrams if the format changes; the anchor's canvas part, if the director rules it a plugin.\
AMENDED 2026-10-10, after the rulings: **in** -- one anchor to a point at every door (B323); the tab's index brought to it, ending the width exception; what a placing gesture does under the pointer (WD5); the layout plugin and a place's size (WD4).\
**Out,** fallen away with the rulings: anchors along a device and which one a link ends at (WD1's trigger), a migration (no stored change), a word for a taken cell (none is taken).
**Out:**
- **A device type as a composition of packs** -- B282's other half, held.
- **What a panel draws** -- its content regions, frame and labels stay as they are.
- **Routing over a wide device** -- whether a route may pass under a panel is the network's, unchanged.
- **The REST API's word "anchor" for a grid point** -- B310, held.

---

## 5. To-state and build order -- rewritten after WD2 was revisited and WD5 ruled

REWRITTEN 2026-10-10, twice: the version the first adversarial pass read is at commit `5e8cead`; sections 9 and 11 record both passes, and section 10 what the first changed.

### 5.1 To-state

- **A wide device is one anchor** (WD1); what it covers -- the cells it is drawn over, picked by and sized by -- is the devices plugin's to declare, as it already declares it (`devices/device-footprint.mjs`).
- **One rule at every door: one anchor to a point** (B112, `model/invariants.mjs`, on the network's rung), as the planner, the server and the agent door hold it today (WD2, revisited).
  The tab's occupancy index (`engine/relations.mjs`) keys an anchor by its own cell alone, reading `span` no more, so the width exception ends and the index answers what every scan answers (`model/model.mjs` `occupiedAnyAt`, `devices/occupancy.mjs`).
  The agent API, the CLI, undo, redo and Ctrl+D change nothing.
- **What a placing gesture does is what is under the pointer** (WD5): a gesture that places at the pointer places nothing while an item is under it -- by what the parts say they cover under a hover (`under`: a device's frame, a waypoint's radius) -- and elsewhere one anchor to a point decides.
- **The tab's paths, each with what changes** (measured by the second pass; a device frame reaches 20 px from its cell's centre, its pick 24 px, a snap 30 px):

| path | where | today | after |
|---|---|---|---|
| idle `w` | `app/src/input.js` `placeWaypoint` | refused on any covered cell | refused under an item (WD5); placed on a covered cell outside a frame |
| Enter with a type held | `onStampKey`, then `stampAt` | refused on a covered cell (a device's `blocked`) | as `w` |
| a palette drop | `stampAt(pos, item)` | as Enter | as `w` |
| a digit key mid-drag | `chainThroughNode` | refused on a covered cell | as `w` |
| a click with a type held | `stampClicked`, then `stampAt` | lands on the device over its frame; refused on a covered cell outside it | over the frame as today; outside it, placed on a covered cell |
| a run-mode tower | `engine/spawn-runs.mjs` | none on a drawn item; refused on a covered cell outside it | on a drawn item as today; outside it, placed on a covered cell |
| `w` or `g` mid-drag | `addStop` | threads a device the pick grabs (24 px); refused on a covered cell outside it | threads it as today; outside it, a stop on a covered cell; a bend already on the snapped cell is threaded first, as it is today for the 7 under labels |
| the hand's ghost and the readout's cursor line | `handBlocked`, `tools.js`, `readout.js` | blocked on a covered cell | blocked exactly where the gestures above place nothing |

Over a device's frame nothing changes for a user; the change is the strip of a covered cell outside the frame, and keys or a drop over a waypoint, which now place nothing where today a stamp was sent and refused by the planner.

- **A layout plugin owns the anchor grid** (WD4): the anchor's place on the node lattice and its extent, and the grid's dots, moved from `product/canvas.mjs` -- in a folder named for search, proposed `anchor-grid/`, since "layout" already names the kernel's lattices, the REST `/layouts` and a place's `layout` (first pass, finding 9).
  The product keeps composition: the anchor's drawing order among the plugins' appearances, and its rank in a delete.
- **A place's size comes from exactly one source:** the place's own `size`, as the zones plugin's carries it today, or one part's `sizes` for that kind -- so the anchor's place, the layout plugin's, carries none, and the devices plugin declares a device's size from its span.
  - A placed kind with neither, or with both, is refused when the canvas is composed, naming the parts -- `app/src/snap.js` `placesOf` keeps its refusal of a sizeless place, now naming the sources it looked for.
  - A sizer that answers nothing for an entity means one cell, `{ w: 0, h: 0 }` -- a waypoint.
  - What a size means stays the place's: for the anchor, the extent beyond its cell from the cell's centre; for a zone, its whole box from its corner -- as `clampDelta`, `selectionBounds` and the readout's box read it today.
  Neither the layout plugin nor the product reads a device field.
- **Stored documents do not change,** and every anchor in production stays valid.

### 5.2 Build order -- each stage provable before the next depends on it

| stage | what lands | proven by |
|---|---|---|
| **WD-a** | **One rule at every door (B323), and the pointer (WD5):** the index keys an anchor by its own cell; the placing gestures and the ghost ask what is under the pointer; the width exception ends | tests 1 and 3; the two tests asserting a span's covered cells occupied rewritten (`tests/rules-acceptance.test.js`, the step's geometry, and `tests/span.test.js`, the index), asserting the footprint by the parts' covers instead; every corpus unchanged, or each difference shown and traced to a row of section 5.1's table |
| **WD-b** | **The layout plugin (WD4) and the size contract:** `anchor-grid/` with the anchor's place and grid and its deploy plumbing; `sizes`, the devices plugin's for a device; the product's part reduced to composition | tests 4 and 6; the K8 DOM's grids identical; `tests/browser.test.js` and `tests/lab-browser.test.js`, which load the canvas through both servers' mounts; every corpus unchanged |
| **WD-c** | **Closed:** B323 closed; B282's O4 half closed, its pack half held with WD1's trigger added; KINDS-AS-PLUGINS section 16.3's exception recorded as ended, and the comments that record it retired (`devices/device-fields.mjs`, `product/canvas.mjs`, `engine/relations.mjs`, `tests/core-names-no-plugin.test.js`) | the gate; the user-visible changes exactly section 5.1's table; production deployed, its boot reporting no invariant violation |

**Size, by judgement:** WD-a moderate (the index, one pointer predicate read by four gestures and the ghost, two tests rewritten); WD-b small to moderate, much of it the new folder's plumbing; WD-c small.

---

## 6. Invariants and acceptance tests

1. **The doors agree, and the pointer decides** -- a 3x1 host panel with its anchor at (0,0) and a 3x1 text label with its anchor at (0,240), each in its own test:
   - an anchor put on a covered cell, (60,0) or (60,240), by an op, is admitted by the planner (the server's door), and the agent API lists the cell free (`?free=1`);
   - an anchor put on either device's own anchor cell is refused by the planner and not listed free;
   - with the pointer at a covered cell's centre (over the frame), an idle `w`, Enter with a type held, `input.stampAt(pos, item)` (what a palette drop calls) and a digit key mid-drag each place nothing, and the ghost reads blocked;
   - with the pointer 26 px below that centre (outside the frame and the pick, snapping to the same cell), each of the four places its anchor on the covered cell, and the ghost reads clear;
   - a click with a type held at the covered cell's centre lands on the device -- a retype for the label, whose type no hand holds; for the host, a select with `host` held and a retype with another type.
2. **Production and the templates stay valid** -- the rule does not change; `violations()` finds nothing in any template in `templates/`, held by a test, and the deployed server's boot reports no invariant violation for production's diagrams.
3. **The index keys anchors alone** -- a wide device in the index-and-scan parity test (`tests/engine.test.js`), the two agreeing, and `occupiedAnyAt` false on a covered cell; and no `.span` read in `engine/relations.mjs`, `model/*.mjs` or `planner/*`.
4. **The layout plugin is the anchor grid's** -- `product/canvas.mjs` reads no device field (`span`, `type`, `shape`, `content`); `anchor-grid/` imports no plugin; the K8 DOM's grids identical.
5. **The corpora** -- the planner corpus unchanged; the gesture, matrix and K8 DOM corpora unchanged, or each difference shown and traced to a row of section 5.1's table.
6. **The size contract** -- a device's place size is its span's extent and a waypoint's one cell; a zone's place keeps its own size; a placed kind with no source, or with two, is refused when the canvas is composed, naming the parts.

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
| A2 Isomorphic Specification | load-bearing | REWRITTEN after WD2 was revisited: one rule, one anchor to a point, at every door -- the tab's index brought to what the planner, the server, the agent door and every scan already hold; B323's drift ends because only one rule remains |
| A3 Sovereign Composition | load-bearing | the footprint is the devices plugin's and a place's size is asked of the part that sizes the entity; the width exception ends. **Tension:** the layout plugin is a surface with one consumer, which A3's "earned by real consumers" would wait on -- the proposer recommended waiting; the director ruled it now (WD4), the cost named; recorded as the director's choice, carried as a guardrail rather than a fail |
| A8 Gated Recursive Integrity | load-bearing | each stage gated; no rule is made stricter (WD2 revisited); the corpora's differences shown and traced to section 5.1's table |
| A13 Director Intent Amplification | load-bearing | O4's literal reading amended by the director on measured evidence (WD1); WD2 put back to the director when the review found its cost understated, not quietly reshaped; the director's question answered by a decision, not assumed (WD4); a pointer's meaning ruled, not assumed (WD5) |
| A1 Sovereign State Transparency | supporting | no stored change; the boot reports any violation and `/health` shows it (B83) |
| A9 Chaos-Validated Deployment | supporting | no data migration and no stricter rule; the boot still reports any violation (B83) |
| A4 Zero-Loss Knowledge | supporting | the director's words, the measurements and the screenshots' findings recorded whole |
| A10, A14 | supporting | B323 registered from the measurement; WD1's revival trigger recorded (RU3) |
| A5 Perceptual Parity | supporting | added after the review (finding 1): an agent and the tab now perceive one occupancy rule; nothing an agent reads changes |
| the rest | not materially implicated | no agent seam, context assembly or LLM path changes |

**Layered:** the format and the rules are untouched; the tab's index is brought to the one rule and its placing gestures to what is under the pointer (WD5); the canvas gains one plugin and loses its last device-field read below the devices plugin.\
**Verdict: pass, with guardrails** (REWRITTEN after WD2 was revisited) --
1. the user-visible changes are exactly section 5.1's table, recorded with WD-a; the boot line checked after deploy for no invariant violation;
2. every corpus difference shown and traced to a row of that table, or the stage stops;
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

---

## 10. WD2 revisited, and the review's dispositions settled

The director, shown the review's costs and the measures, chose "free for every device" (`dev/DECISIONS.md`, WD2 revisited): one anchor to a point at every door.\
CORRECTED by the second pass (section 11): findings 1, 2, 4, 5, 11 and 13 fall away with it -- finding 3 does not, a device under any wide device being ruled ("a stamp"), and finding 16 now applies to every wide device.\
As first written: findings 1, 2, 3, 4, 5, 11 and 13 fall away with it -- no cell is taken beyond its anchor, so there is no word to choose for one, nothing for undo to restore, no discriminator, no panel-on-panel rule and no `takes` key.\
Finding 6: test 1 is rewritten by gesture and door (section 6); the step geometry test is extended to a text label in WD-a, `w` mid-drag over a label still threading the label, as it does today.\
Finding 8: the index keys anchors alone, as every scan does.\
Finding 9: the size contract is specified (section 5.1) and the folder proposed as `anchor-grid/`.\
Finding 10: the WD-c ratchet is test 3's `span` pattern over named modules, and the user-visible change is listed.\
Finding 17: the fence's open items fall away with WD2 or are named above; templates are in test 2.

---

## 11. The second adversarial pass, after WD2 was revisited

**Reviewer:** the same independent agent, given the revised sections 5, 6, 8 and 10 and told to break them against the code; read only.\
**Its verdict:** "ratifiable once the listed changes are made" -- one blocker and four major findings, none reopening WD1, WD2 as revisited or WD4; one choice put to the director, which became WD5.

| # | sev | finding | disposition |
|---|---|---|---|
| 1 | blocker | four more tab paths change on a covered cell -- a digit key mid-drag anywhere, and a click, a tower and a drag's stop in the strip outside a frame -- and section 5.1 contradicted the ruling on stops and the tower | **WD5 ruled** (the pointer decides); every path listed with what changes (section 5.1's table), aligned with the ruling |
| 2 | major | the hand's ghost and the readout would say "stamp" where a click retypes | accepted -- WD5: the ghost reads blocked exactly where the gestures place nothing |
| 3 | major | two tests assert a span's covered cells occupied and will fail; "extended" was the wrong word | accepted -- named as rewritten in WD-a, asserting the footprint by the parts' covers |
| 4 | major | the `sizes` contract collided with `placesOf`'s refusal, the zones place's own size, the per-kind meaning of a size, and a third reader (the readout) | accepted -- section 5.1: exactly one source, the refusal kept, a silent default only for an entity its sizer leaves unsized, the meaning the place's |
| 5 | major | test 1 was neither binary nor complete | accepted -- rewritten with positions, gestures and outcomes, a palette drop named as `input.stampAt` |
| 6 | minor | the templates clause could never fail (templates load without the rules) | accepted -- a test calls `violations()` on `templates/` |
| 7 | minor | a text pattern does not prove the index keys anchors alone | accepted -- a wide device in the index-and-scan parity test, and `occupiedAnyAt` on a covered cell |
| 8 | minor | the M7 audit still spoke of a stricter rule and a new key | accepted -- A8, A9, the layered line and guardrail 1 rewritten |
| 9 | minor | corpus differences traced to an incomplete list; WD-b's plumbing proven by nothing named | accepted -- traced to section 5.1's table; the two browser suites named |
| 10 | minor | section 10 marked finding 3 moot and missed finding 16's reach; the fence was unchanged | accepted -- section 10 CORRECTED; the fence AMENDED |
| 11 | minor | `w` and `g` mid-drag thread a bend already on the snapped cell before the device | accepted -- in section 5.1's table, as it is today for the 7 under labels |
| 12 | minor | comments still record the width exception | accepted -- retired in WD-c, the four files named |

---

## 12. Stored layouts (WD6) -- revising WD4

AMENDED 2026-10-10 -- the director, told that "layout" already names a grid in the code, asked whether both grids should be one generic layout plugin and "layout-*" entities "configured with their specs", and chose stored layout entities (`dev/DECISIONS.md` WD6).\
Section 5's WD-b (a plugin for the anchor's grid alone) is superseded by this section once its decision below is ruled.

### 12.1 From-state -- measured 2026-10-10

- **The grid arithmetic is already generic:** one snapping and on-grid arithmetic configured twice (`kernel/geometry.mjs` `LAYOUTS`: the device grid at offset 0, the zone grid at half a pitch), which the agent API already lists (`server/rest.js`, `GET /diagrams/<id>/layouts`) and serves free points from (`server/anchor.mjs`).
- **Each grid's settings are scattered:** the device grid's extent in the core (`model/surface.mjs` `NODE_EXT`), its checks in the product (`product/kinds.mjs`), its place and dots in the product's canvas part; the zone grid's extent, checks, place, dots and Shift in the zones plugin (`zones/zone-extent.mjs`, `zones/zone-kind.mjs`, `zones/zone-grid.mjs`).
- **What reads a grid's values:** the pitch, 63 lines in 22 product files and 26 in the kernel's drawing, routing and export; the device grid's extent 19 lines in 7 files; the zone grid's 24 in 7; the canvas surface 42 in 36; the arithmetic 42 lines in 8.
- **What a stored-format change must carry:** production's 38 diagrams and its 4 templates (`templates/`); the lab's boards (`lab/seeds.json`); the recorded corpora (`tests/fixtures/*.json`); 17 test files that build a schema 2 document; every maker of a new document (`server/store.js`, `server/seed.js`, `model/model.mjs`); the CLI's `--doc` (`cli/verbs.mjs`, which names schema 2).
- **The precedent:** the format batch (`dev/design/unification/FORMAT-BATCH.md`) -- one pure migration run on every path into the store, a dry run on a production backup, `meta.schema` raised, a staged deploy, and the migration deleted once every stored document is current (B291).
- **The doors refuse an unknown collection** (B307), so a stored layout is a kind composed at every door.

### 12.2 To-state, as far as WD6 fixes it

- **A layout plugin owns the layout kind:** `layout-<hex>` entities, two in every diagram, each named -- `node`, the device grid; `zone`, the zone grid -- with its spec.
- **A kind uses a layout by name, declared on the kind** -- the anchor's place the `node` layout, the zone's the `zone` layout -- so no node or zone entity changes.
- **A diagram always holds its two layouts:** made with every new diagram; neither may be deleted; a name is unique in a diagram.
- **One migration, the format batch's way:** `meta.schema` 3; a pure function adding the two layouts, run on every path into the store (boot, reload, create, templates); a dry run on a private production copy that boots a real store; every repository document migrated in source; a restore point (a production backup) before deploy; the migration deleted once every stored document is schema 3.
- **What each spec may hold differently from one diagram to the next is WD7, below.**

### 12.3 WD7 -- what a stored layout may vary, in this delta

- **Nothing yet:** each record holds its spec -- name, offset, pitch, extent, dot, when shown -- and the planner refuses any value but the product's own, so every reader keeps today's values; the layout plugin draws the grids from the records.
  Varying a grid is a later delta, with its trigger (a diagram that needs a grid unlike the others -- the infinite canvas, B289).
  Cost: the migration and the new kind; nothing a user sees changes.
- **Its extent:** a diagram may set its own edges -- a larger canvas.
  Adds: every reader of an extent and of the canvas surface reads the diagram's records (some 85 lines in about 45 files), and the canvas's size follows the open diagram.
- **Everything, spacing included:** a diagram may set its own pitch and offset.
  Adds: every reader of the pitch -- the kernel's drawing, routing and export, the CLI, which restates it -- reads the diagram's records (some 90 lines in about 28 files, the kernel's arithmetic among them).

AMENDED 2026-10-10 -- **WD7 ruled: nothing varies yet** (`dev/DECISIONS.md` WD7) -- each diagram stores its two layouts with today's values; "We will chase full programmability of layouts when we go after infinite canvas and scrolling" (the director), recorded as WD7's revival trigger.

### 12.4 To-state, after WD7

- **A layouts plugin** (`layouts/`, its kind `layout`, as `zones/` holds `zone`) owns both grids.
  A layout record holds its geometry: `name` (`node` or `zone`), `pitch`, `offset` and `ext` -- the planner refusing any value but the product's own (WD7).
  How a grid is shown -- its dot's size, its page layer, and that the zone grid shows while Shift is held -- is the plugin's code, keyed by the layout's name: a keyboard binding is no fact of the document.
- **A diagram always holds its two layouts:** the layout row declares them -- with fixed ids, `layout-000001` (`node`) and `layout-000002` (`zone`), since ids are a document's own and a fixed id keeps the migration pure.
  This is a contract addition: a kind's row may declare the entities every document of the composition holds, and the core's new document, the server's `create`, the seed and the lab's boards gain them by construction rather than each maker remembering.
  Deleting one, adding a second of a name, or changing a value is refused at every door, by the row's checks and its invariant.
- **A kind uses a layout by name, declared on the kind:** the anchor's place names `node`, the zone's `zone`; a place's extent is its layout's.
  No node or zone entity changes, and nothing selects, clones, deletes or exports a layout (`kernel/adapt.mjs` reads the collections it names).
- **One table of the two grids' values, in the layouts plugin:** the zone extent moves there from `zones/zone-extent.mjs` (the zones plugin then depends on the layouts plugin); the device extent stays the core's (`model/surface.mjs`, which the core's anchor capability reads) and the arithmetic's offsets the kernel's (`kernel/geometry.mjs` `LAYOUTS`, which may import no plugin) -- the table built from them where it can be, and held equal to them by a test where it cannot.
- **The grids are drawn from the open diagram's records,** redrawn when a diagram is loaded; with WD7 every diagram draws the same dots.
- **`meta.schema` 3, by one migration, the format batch's way:** a pure function adding the two layouts to a schema 2 document, run on every path into the store (boot, reload, `create`, templates), so an open tab from before that posts its document is migrated rather than refused; schema 1 still refused with B291's sentence; the migration deleted once every stored document is schema 3.
- **Section 5's WD-b is superseded:** the anchor's place and size contract (section 5.1) stand, the place's extent read from its layout.

### 12.5 Build order -- revised

| stage | what lands | proven by |
|---|---|---|
| **WD-a** | as section 5.2: one rule at every door (B323), the pointer (WD5) -- independent of layouts, built first | as section 5.2 |
| **WD-b1** | **The layouts plugin and the format:** the `layout` kind and its row, the always-held entities contract, schema 3, the migration on every store path; every repository document migrated in source (`templates/`, the corpora, the test documents; the lab's boards gain theirs by construction); the plugin's deploy plumbing | tests 7 to 10; a dry run on a private production copy -- every diagram migrated, booted in a real store, none skipped, no violation, every entity equal to its source but the two layouts; an open tab running the build before against the new server, observed and recorded; a production backup taken as the restore point before deploy |
| **WD-b2** | **The canvas reads the layouts:** the grids drawn from the records; a place's extent from its layout; the size contract (section 5.1); the zone extent moved into the plugin; the product's part reduced to composition | tests 4, 6 and 9; the K8 DOM's grids identical; every corpus unchanged but the layouts WD-b1 added |
| **WD-c** | **Closed:** the migration deleted once every stored document is schema 3 (measured on the bucket); B323 closed; B282's O4 half closed, its pack half held with WD1's trigger; WD7's trigger on a backlog row; KINDS-AS-PLUGINS section 16.3's exception recorded as ended | the gate; production deployed, its boot reporting every diagram loaded and no invariant violation |

**Size, by judgement:** WD-a moderate; WD-b1 large -- a kind, a contract addition, a schema change and its migration across the store, the corpora and 17 test files; WD-b2 moderate; WD-c small.

### 12.6 Acceptance tests -- added

7. **Every diagram holds its two layouts** -- a document made by the server's `create`, by the core's new Model, by the seed and by a lab board holds `layout-000001` (`node`) and `layout-000002` (`zone`) with the product's values; an op deleting either, adding a second `node`, or setting a value is refused by the planner, naming the layout.
8. **The migration** -- pure (the same input gives the same output) and idempotent (a schema 3 document passes unchanged); a schema 2 document gains exactly the two layouts and `meta.schema` 3, every other entity equal to its source; it runs on boot, reload, `create` and the templates; a schema 1 document is refused with B291's sentence.
9. **The grids come from the records** -- a diagram's grid dots are drawn from its layouts, redrawn on load; the K8 DOM's grids identical.
10. **One table** -- the layouts plugin's values equal the kernel's offsets (`LAYOUTS`), its pitch (`STD.pitch`), the core's device extent (`NODE_EXT`) and the zone extent; the agent API's list of layouts is the open diagram's records' names.

### 12.7 Axiom alignment audit (M7) -- for the revised scope

| axiom | weight | how it holds -- or the tension |
|---|---|---|
| A1 Sovereign State Transparency | load-bearing | a diagram's grids become stated in the diagram, readable by every door, rather than implied by code |
| A9 Chaos-Validated Deployment | load-bearing | a migration of production's records (D7): a pure function, a dry run on a private copy booted in a real store, a restore point taken first, the old-tab case observed before deploy, and the migration deleted after -- the format batch's proven route |
| A2 Isomorphic Specification | load-bearing | one table of the grids' values in the layouts plugin, held equal by test to the constants the core and the kernel keep; the planner refuses any other value, so record and code cannot drift while WD7 holds |
| A3 Sovereign Composition | load-bearing | both grids one plugin's concern; a kind names the layout it uses. **Tension:** stored records nothing yet varies are a format ahead of its use -- the proposer recommended configuring the grids in code; the director chose stored entities (WD6) and fixed values until the infinite canvas (WD7); carried as the director's choice and a guardrail, not a fail |
| A13 Director Intent Amplification | load-bearing | the director's model -- generic layouts, "layout-* an entity" -- built as stated; its cost shown before the ruling; its programmability deferred in the director's words |
| A4, A8, A10, A14 | supporting | rulings and measures recorded whole; each stage gated; WD7's trigger kept on a row |
| the rest | not materially implicated | no agent seam, context or LLM path changes |

**Verdict: pass, with guardrails** -- section 8's, and:
1. no WD-b1 deploy without the dry run's every-diagram result, the old-tab observation and a fresh backup recorded;
2. the planner refuses every layout value but the product's own while WD7 holds;
3. the migration deleted at WD-c, once the bucket holds schema 3 alone (B291's pattern);
4. the layouts plugin's plumbing by the checklist.

---

## 13. The third adversarial pass, on section 12

**Reviewer:** the same independent agent, given section 12 and told to break it against the code; read only.\
**Its verdict:** "not ratifiable yet; ratifiable after the changes above" -- one blocker and five major findings; WD6 and WD7 need no reopening; one finding needs a ruling, put to the director as WD8.

| # | sev | finding | disposition |
|---|---|---|---|
| 1 | blocker | always-held layouts make a fresh tab's offline count non-zero (`app/src/sync.js` `localEntityCount`, counting every kind since C-e step fourteen), so every page load would `create` a new diagram | accepted -- the count counts what a document holds beyond its always-held entities; a test that opening a page creates nothing |
| 2 | major | nothing makes a document hold its layouts: `Model.load` replaces collections wholesale; the seed writes schema 3 with none; a document with no `meta.schema` counts as current; `validateDoc` runs no invariant | accepted -- **completion:** every path into a store or a Model completes a document with its always-held entities (fixed ids and values, so it is deterministic), a document with no `meta.schema` migrated as schema 2; `validateDoc` then requires them; a reader of a layout fails loudly, naming it, rather than drawing nothing |
| 3 | major | "every path into the store" misses `restore` and `#seedFromExamples`, names a "reload" that does not exist, and boot writes back nothing, so the bucket might never be schema 3; deleted copies stay schema 2 | accepted -- the paths named (`init`, `restore`, `create`, `seed`, `#seedFromExamples`, `#loadTemplates`); boot marks a migrated document dirty so it is written back; the migration deleted at WD-c only once the bucket's live documents are schema 3 and the 7-day soft-delete window has passed, B291's sentence corrected to say a refused copy predates schema 3 |
| 4 | major | the `layouts` collection collides with the agent API's `/layouts` addresses, which serve the kernel's names | **WD8**, put to the director |
| 5 | major | "a place's extent is its layout's" cannot be built as stated: the placed kinds are built once, before any diagram loads, and the snapping takes no model | accepted -- the records drive the grid drawing alone, redrawn on load; places keep the table, held equal by WD7's refusal; extent from the record is WD7's trigger's delta |
| 6 | major | a backup is no way back once users have edited: the old image refuses schema 3 | accepted -- a down-migration (drop the layouts, set schema 2) kept and tested until WD-c, so rolling the image back keeps every edit |
| 7 | minor | tests 9 and 10 sit in a stage that cannot pass them; the zone extent's import direction would flip between stages; the layer manifest's lists need updating | accepted -- each test in the stage that passes it; the zone extent moves into the layouts plugin at WD-b1, the zones plugin importing it from then; the manifest's changes on the checklist |
| 8 | minor | tests 7 and 8 and the old-tab guardrail are not binary | accepted -- test 7 names `new Model({ kinds: productKinds(...NETWORK_ROWS) })`; test 8 names the store's paths; the old tab passes when it loads, its edits commit, nothing is refused and it reloads on the revision change |
| 9 | minor | the size estimate's test list is incomplete | accepted -- the kinds-list tests and every test loading a document without layouts added to WD-b1 |
| 10 | minor | the contract should say a layout is not selectable, not in the shared name list, and deep-copied per Model | accepted -- stated; fixed ids measured safe (not an anchor kind; the id format; no undo record touches one) |
| 11 | minor | factual: the zone's place is `zones/zone-painter.mjs`; only the server refuses an unknown collection, the tab drops it; makers missed -- the tab's offline `create`, the lab's authority Model, `kernel/adapt.mjs` `schemaToDoc` | accepted -- corrected, the makers added to completion's reach |
| 12 | minor | A1 overclaims while records equal code; test 10 is tautological where the table is built from the constants; WD7's check belongs in the layout row's cross-field rule | accepted -- A1 restated (the grids recorded in each diagram, most readers on the table until WD7's trigger); test 10 kept for the parts not built from the constants; WD7's check the row's rule |

CORRECTED (finding 11; section 12.1): "the doors refuse an unknown collection" holds of the server; the tab's Model drops one silently on load -- which is why a tab from before the change survives a schema 3 snapshot.

AMENDED 2026-10-10 -- **WD8 ruled: `/layouts` serves the stored records** (`dev/DECISIONS.md` WD8).\
`GET /diagrams/<id>/layouts` answers with the diagram's two records, each with its id, name, pitch, offset and extent; `/layouts/<name>/nearest` and `/layouts/<name>/anchors` keep their answers; a write to a layout through the API is refused while WD7 holds.
**Into WD-b1:** the agent API's list served from the records; `draw layouts` (`cli/verbs.mjs`) reading records; the routes' manifest (`tools/routes.mjs`) and its test kept in step.
**Test 11 -- the agent API's layouts:** `GET /diagrams/<id>/layouts` returns exactly the two records with their names and the product's values; `/layouts/node/nearest` and `/layouts/zone/anchors` answer as before; a write to a layout is refused, naming it.
**The M7 audit, A5:** an agent reads the diagram's grids at the address it already uses, now with their settings -- perceptual parity improved, its one cost the list's richer answer, named.

AMENDED 2026-10-10 -- **WD-a done** (H19.44): the occupancy index keys an anchor by its own cell (`engine/relations.mjs`), so every door holds one anchor to a point and the width exception ends; a gesture placing at the pointer -- an idle `w`, a stamp by Enter, a palette drop, a digit mid-drag -- and the hand's ghost and readout ask one question, `placeRefused`: no item under the pointer (the parts' `under` covers), and one anchor to a point (`app/src/input.js`); the hand's own `blocked` rule went to it (`devices/device-hand.mjs`).
**Measured:** the gesture, matrix and K8 DOM corpora unchanged -- no recorded scenario places on a covered cell -- so the user-visible change is section 5.1's table alone.\
**Held by:** `tests/wide-devices.test.js` -- the doors agreeing on a host panel's and a label's covered cell (the planner, the agent door); over a frame the four gestures placing nothing and the ghost blocked, and 26 px below it each placing on the covered cell and the ghost clear; a click there landing on the device; the index keying anchors alone, the index and the scan agreeing; no `span` read below the plugins; the ghost the same after a refresh as after a move (the pointer ignored, B112 ignored in the tab, the width exception back, and the ghost never blocked on a refresh each fail -- four mutants killed, the last once its test was added); the index test (`tests/span.test.js`) and the step's geometry (`tests/rules-acceptance.test.js`) RESTATED; two comments that recorded the exception amended.

AMENDED 2026-10-10 -- **B323 closed at WD-a, not WD-c:** its whole fix -- one anchor to a point at every door -- landed in WD-a, so WD-c's row no longer carries it.

AMENDED 2026-10-10 -- **WD-b1 built, not deployed** (H19.45; commits `1d5b420`, `ebd0c38`, `9643c99`): the layouts plugin and its kind (`layouts/`), the always-held contract (`model/shape.mjs` `always`, `completeAlwaysHeld`), schema 3 and its migration on the store's five doors with boot and restore writing a migrated document back (`server/migrate-schema-3.mjs`), the way back (`tools/migrate-down-to-schema-2.mjs`), and the agent API's records (`layouts/layout-records.mjs`).
**Measured, correcting section 12.1:** no recorded corpus holds a stored document, so none was migrated; `tools/routes.mjs` derives route names only, and no route's path changed.\
**Guardrail 1, the dry run** on a private copy of production's bucket, booted in a real store: 38 of 38 diagrams loaded with no warning; 2,539 entities otherwise equal; each holding the two layouts; each written back as schema 3 with its log kept.
**The way back, rehearsed on that copy:** the tool rewrote 38 of 38 as schema 2; the image now live booted all 38 with no warning, each equal to its original, document and log.\
**Measured beside it:** the image now live refuses to boot on schema 3 files ("38 diagram file(s) present, none loaded"), so a rollback runs the way back, or restores the backup, before the older image is deployed.\
**Guardrail 1, the old tab,** observed locally (the old server, then the new one on the same port, data and a different revision): the old tab's edit made offline committed one second after the new server answered; it loaded the schema 3 document; nothing was refused on either side; it reloaded onto the new revision eleven seconds later, by its poll; its next edit committed.
**Guardrail 1, the backup:** taken at the deploy, frozen, as the P9 runbook takes it -- the restore point is the bucket as the deploy found it.
