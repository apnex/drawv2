# A plugin brings its kind onto the page -- H19.23 (DELTA, proposed)

> **Tier 3 -- a design of record, proposed.** Written 2026-10-08 against `0020118`.
> Facts about today's code are measured and cited by file and line; judgements are marked as such.
> Proposes; decides nothing. Section 8 holds the decisions for the director, to be asked one at a time.

## 1. Status

- **Asked for:** the director, 2026-10-08 -- O3, "core first, canvas later" (`dev/DECISIONS.md`), and the choice of this design after the kinds-as-plugins arc closed (`dev/BOARD.md` H19.23).
- **Is:** B308, "the canvas has no seam through which a plugin brings a kind" -- the canvas's half of B280, for the four kinds O3 named: zone, group, device and the network's link.
- **Rests on:** O1 and O4 (every kind a plugin's; the core holds only the anchor), and the seams the core-side arc proved: rows, extensions, tenants, attachments.

---

## 2. From-state -- measured at `0020118`

The canvas handles every kind with product code; only keys have a plugin seam.\
Per concern:

| concern | where | kinds named | plugin seam |
|---|---|---|---|
| picking | `app/src/pick.js:45-70` -- a DOM target to `{ kind, id }`; Shift makes a zone pickable (`:57-58`) | node, waypoint, zone, link, handles | partial: an element with `data-select` is a plugin's mark (`:62-68`) |
| press rows | `app/src/recognize.js:66-92`, 14 rows | node, waypoint, zone, link, canvas, handles | no -- composed under owner `product` only (`app/src/input.js:401-403`) |
| gestures | `app/src/input.js:88-358`, ten state machines (`move`, `clone`, `resize`, `replug`, `link`, `zone`, `marquee`, `textbox`, ...) | node, waypoint, zone, link, text device | partial: the link drag is judged by a plugin (`judgeDrag`) and steps through `pluginHost.addStop` |
| release meanings | `app/src/releases.js`, seven tables | node, waypoint, zone, link | partial: a `judged` fact |
| keys | `app/src/keymap.js:73-137`, 34 rows; handlers in `app/src/input.js:1351-1644` | all but pipe | yes: a plugin's key rows, through `composeRules` with its owner, acting through `pluginHost` (`addStop`, `selected`) |
| commands | `app/src/commands.js`, 29 builders | node, waypoint, zone, group, link | partial: `withJudged` entries; the network commits directly (`network/host.mjs:148`) |
| handles | `app/src/overlay.js:138-163` -- link ends, zone corners | zone, link | no |
| snapping | `app/src/snap.js` -- `snapNode`, `snapZone`, `clampDelta` (an anchor branch and a zone branch, `:88-109`) | anchors, zone | no |
| drawing | `app/src/renderer.js` -- five layers (`:152-158`), `draw` and `update` per kind (`:409-616`), per-kind looks (`:96-138`); kernel drawing primitives (`kernel/renderer.mjs`, `kernel/geometry.mjs`, `kernel/spec.mjs`, `kernel/theme.mjs`) | node, waypoint, zone, group, link | partial: the network paints its pipes into its own layer (`network/host.mjs:57-90`) and calls `renderer.update('link')` |
| moving, cloning | `app/src/input.js` -- a positioned kind is `[...ANCHOR_KINDS, 'zone']` (`:653`, `:699`); `app/src/commands.js:448` | anchors, zone | no |
| readout, labels, help | `app/src/readout.js:116-180`, `app/src/labeledit.js:59-168`, `app/src/help.js:12-14` | node, zone, link, waypoint | partial: a plugin row's `doc` reaches the help |
| grids | `app/src/compose-canvas.js:61-62` -- the node grid and the zone grid | node, zone | no |

**The one generic machine already in place:** the Rules engine (`kernel/input-rules.mjs`) -- rows of `{ id, on, when, run, mutates, ... }` from several owners, composed with a duplicate id refused naming both, guarded, resolved only when exactly one row matches.
Keys, presses, releases, the network's drag grammar (`network/grammar.mjs`) and run mode all use it; only keys take another owner's rows.

**The precedent for a plugin on the page:** the network brings key rows and a drag judge to Input, paints its own layer, and reads the canvas through the renderer's `update`, `watchMode` and `reflectSelection` (`network/host.mjs`, `network/page.mjs`).

---

## 3. To-state

A plugin hands the page a **canvas part**, composed when the page is built, as it hands the Model its rows: no registry, no discovery (ruled 2026-10-02).\
What the part brings, per concern:

- **Drawing -- a painter per kind:** the layer it draws into, with a declared rank among the page's layers; how it creates, updates and removes an entity's elements; its look.
  The renderer becomes a dispatcher over the composed painters, keeping what spans kinds -- selection marks, drawing order, mode.
- **Picking -- by attribute, not by class:** every drawn entity carries its id on one attribute, so `pick.js` resolves any kind the same way; a kind may declare a modifier it is picked under (the zone, Shift).
- **Placing -- as row facts:** a kind placed on the grid declares its layout and extent (an anchor the node grid, a zone the half-offset grid within its extent), so moving, cloning, nudging and snapping read the row rather than a list of kinds.
- **Handles:** a kind declares the handles a lone selected entity shows -- a zone's corners, a link's ends -- and what dragging one does.
- **Presses, gestures, releases:** see section 8, D2 -- either a plugin brings rows for a fixed set of generic gestures, or it brings whole gestures with a host.
- **Keys:** as today, with the host's verbs widened to what the moved keys need (wrap the selection in a zone, step a size).
- **Readout, labels, select-all, delete order:** a kind's description, where its label edits, whether select-all takes it, its rank in a delete.
- **Grids:** a plugin may bring a grid layer and when it shows (the zone grid, while Shift is held).

**Nothing a user sees changes.**\
The canvas names no plugin's kind; what still does is recorded and ratcheted, as the core's is (`tests/core-names-no-plugin.test.js`).

---

## 4. The fence and the anti-scope

**In:** the canvas -- `app/src/` -- and the kernel's drawing primitives it uses; the four kinds' canvas behaviour moved into their plugins through the contract; a ratchet that the canvas names no plugin's kind.
**Out:**
- **The export door** (`kernel/adapt.mjs`, `kernel/svg-scene.mjs`, `server/svg.mjs`), which reads a document's kinds by name to draw a file; whether the painters serve it too is a later question, recorded with its trigger (section 7).
- **The CLI**, which ships standalone and restates what it reads, held by tests (B138).
- **B282's multi-anchor device**, which changes what a wide device is and so how it is drawn and picked; this design draws today's device.
- **What anything looks like or does:** every corpus -- gesture, matrix, K8 DOM -- stays byte-identical.

---

## 5. Build order -- each stage provable before the next depends on it

| stage | what lands | first consumer | proven by |
|---|---|---|---|
| **C-a** | **Drawing:** painters per kind, the renderer a dispatcher, layers ranked | zones, then groups, devices and links | the K8 DOM corpus and the matrix byte-identical; a page composed without the zones plugin draws no zone layer |
| **C-b** | **Picking:** the id attribute on every drawn entity; a kind's pick modifier | zones (Shift) | the gesture corpus identical; `pick.js` names no kind |
| **C-c** | **Placing:** layout and extent as row facts; moving, cloning, nudging and snapping read them | anchors, zones | corpora identical; no list of positioned kinds in the canvas |
| **C-d** | **Handles, presses, gestures, releases** -- the shape D2 rules | zones (draw, resize), then links (replug) and groups | corpora identical; `recognize.js` and `releases.js` name no plugin's kind |
| **C-e** | **Keys, commands, readout, labels, grids:** each moved key and command its plugin's | groups, zones, links | corpora identical |
| **C-f** | **Closed:** the ratchet that the canvas names no plugin's kind, with what remains recorded; B308 closed | -- | the gate; the lab and production deployed with nothing changed for a user |

Each stage is one gate and one deploy.
**Size, by judgement:** the largest arc of the programme -- the canvas is some 5,000 lines (`app/src/input.js` alone 1,650), and C-c and C-d reach most of it.
Zones go first at every stage, as the smallest self-contained kind; the link goes last, its drag already part-plugged.

---

## 6. Acceptance tests

1. A page composed without the zones plugin draws no zone, picks none, offers no zone gesture, key or handle, and shows no zone grid -- and every other kind behaves as before.
2. `app/src/` names no plugin's kind beyond a record that may only fall.
3. The gesture, matrix and K8 DOM corpora are byte-identical before and after each stage.
4. A plugin's canvas part with a malformed painter, row or handle is refused when the page is built, naming the plugin.

---

## 7. Findings from the survey

- **Fixed in passing (B311, H19.28):** duplicating a selection with a waypoint or a bent link copied nothing and said it had -- the copy filter predated waypoints as nodes.
  It is the class this design removes: a list of kinds in canvas code, which a kind's change leaves stale.
- **Unverified, each to be checked by the stage that touches it (INFERRED from reading):**
  - a pipe put again could detach the element the network's painter keeps, since the renderer's `draw` removes an id's element first (`app/src/renderer.js:410`; `network/host.mjs:65-90`) -- C-a;
  - F2 may open a rename on a selected pipe, a kind that carries no name (`app/src/input.js:1578-1580`) -- C-e;
  - the offline-start count omits pipes (`app/src/sync.js:424-426`) -- C-e;
  - the device hand's `'waypoint'` branches look unreachable, since no tool offers that hand (`app/src/tools.js:17`; `app/src/palette.js:194-197`) -- C-e;
  - `syncZoneGrid` has no caller (`app/src/input.js:1615`) -- C-e.
- **Deferred, with its trigger (RU3):** the export door's reading of kinds by name -- revived when a plugin's kind must reach a downloaded file without the export naming it, or when C-a's painters prove they can serve a headless scene.

---

## 8. Decisions for the director -- one at a time

**D1 -- how far.**
- **Recommended (judgement): the whole contract, staged C-a to C-f.** The target state you set -- the core and the canvas naming no plugin -- reached; the contract shaped by four kinds, not one.
  Cost: the largest arc of the programme, every stage invisible to a user.
- **Drawing, picking and placing only (C-a to C-c), then stop.** The parts that are data on a row or a painter; gestures, keys and commands stay the product's.
  Cost: the canvas keeps naming zones, groups and links in its gestures and keys.
- **Hold B308.** The canvas stays product code, as O3's third option put it.
  Cost: a kind's canvas behaviour stays spread across the canvas -- the class B311 was.

**D2 -- how a plugin brings gestures** (asked after D1, if D1 reaches C-d).
- **Recommended (judgement): rows for a fixed set of generic gestures.** The product keeps a small number of gestures that span kinds -- draw a box, drag a handle, move or clone what is placed, draw a link -- and a plugin brings rows saying when each starts and what its result means: "Shift and drag on the canvas draws a box; a box makes a zone".
  The pattern the link drag already follows (the product's gesture, the network's judge) and the Rules engine's: verbs as data (mission-kit P5).
  Cost: a kind needing a gesture the set lacks waits for the set to grow.
- **Whole gestures with a host.** A plugin brings its own state machines -- start, update, commit, cancel -- acting through a host of declared verbs: preview, write live, commit, select.
  Cost: a wider seam, each plugin's gestures tested on their own; the Rules engine's one-match guarantee does not reach inside a gesture.

---

## 9. Axiom alignment audit (M7)

| axiom | weight | how it holds |
|---|---|---|
| A3 Sovereign Composition | load-bearing | each kind's canvas behaviour in its plugin, composed through declared seams; the canvas keeps what spans kinds |
| A2 Isomorphic Specification | load-bearing | one statement of each kind's look, pick, placement and gestures, in its plugin |
| A8 Gated Recursive Integrity | load-bearing | each stage gated on byte-identical corpora before the next depends on it |
| A11 Cognitive Minimalism | supporting | D2's recommendation keeps gestures as data a check can read |
| A13 Director Intent Amplification | supporting | two decisions, asked alone; the export, the CLI and B282 named as out of scope with their triggers |
| A5 Perceptual Parity | supporting | B311 -- a readout that reported a copy it did not make -- fixed, and its class removed |
| the rest | not materially implicated | nothing stored or deployed changes in kind |

**Verdict: pass-with-guardrails** -- D1 and D2 ruled before C-a; corpora byte-identical at every stage; the export's deferral carries its trigger.

---

## 10. Ruled

AMENDED 2026-10-08 -- **D1 RULED: the whole contract; D2 RULED: rows for shared gestures** (`dev/DECISIONS.md`, "D1, D2").\
The stages: C-a (H19.29), C-b (H19.30), C-c (H19.31), C-d (H19.32), C-e (H19.33), C-f (H19.34).

AMENDED 2026-10-08 -- **C-a, step one: the painter seam, and the zone's painter** (H19.29 stays open until groups, devices and links are painted by their plugins).\
A canvas part is `{ owner, painters }`; a painter is `{ kind, layer, stacked, create, update }`, handed a kit -- `el`, `applyLook`, `pillWidth` and its layer -- since a plugin imports no canvas code (`app/src/renderer.js` `composePainters`, `kit`).\
The renderer draws, refreshes, stacks and fully re-renders a painted kind through its painter, the painted kinds first in the order the parts were composed; a malformed part, a layer the page lacks, or a kind painted twice is refused when the canvas is built, naming the owner.\
The zones plugin brings the zone's painter (`zones/zone-painter.mjs` `ZONES_CANVAS`), building the elements the renderer built; `product/canvas.mjs` composes the product's parts, which the product page, the lab and the tests that build a renderer hand it.
**Held by:** `tests/canvas-painters.test.js` -- the product's canvas draws a zone; a canvas composed without the zones plugin draws none; the renderer names no zone; malformed parts refused (a renderer that skips a painter fails it and two other files -- mutant killed); the page's DOM record, the matrix and every corpus unchanged.

AMENDED 2026-10-09 -- **C-a, step two: the group's painter** (H19.29 stays open for devices and links).\
The groups plugin brings the group's painter (`groups/group-painter.mjs` `GROUPS_CANVAS`): its hull, built and refreshed as the renderer built it, not stacked.\
A painter's `update` may now ask for its element's removal as well as a fresh render -- a group none of whose members resolves loses its hull.\
When an anchor moves, the renderer redraws whatever gathers it by asking the core (`Model#gathererOf`, the row's `gathers`), so it imports no groups module and names no group.
**Held by:** `tests/canvas-painters.test.js` -- the hull drawn and following a member's move; none drawn without the groups plugin; the renderer naming no group; a hull dropped when no member resolves (a renderer that does not redraw the gatherer, and one that ignores a removal, each fail it -- both mutants killed, the second only once that test was added).
