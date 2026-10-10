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

---

## 11. Finding at C-a, step three -- one kind drawn by several plugins (D3)

AMENDED 2026-10-09 -- **stopped before the anchor's painter.**\
Measured at `0830ed0`:
- **A device's drawing is two plugins':** the devices plugin's frame, glyph, content regions and label, and the network's transit ring when the anchor declares its transit off (`app/src/renderer.js` `draw`, `declaresNoTransit`).
- **A waypoint's drawing is the network's:** its roles and rings (`waypointRolesIn`, `waypointLayers`), with the simulation's `spawning` mark; devices draw into `#nodes`, waypoints into `#waypoints`.
- **Redraws cross kinds:** an anchor's change redraws the links at it and the links routed through it (the network's) and what gathers it (done at step two); a link's put, set or delete redraws the anchors at its ends and bends, whose roles it changes (`refreshWaypointsOf`).
- **A link is two elements** -- its path and its invisible hit twin (B268) -- and its selection reflections (blockers, the selected path) are the network's.

Section 3's "a painter per kind" covers neither a kind whose drawing several plugins contribute to, nor a redraw that crosses kinds.

**D3 -- how several plugins draw one kind.**
- **A -- a base and decorations, as fields are composed (recommended, judgement).** The canvas keeps a generic anchor painter -- an element at the anchor's point, in the layer a decoration claims -- and a plugin brings decorations for a kind, each applying when its test holds: the devices plugin its device (frame, glyph, content, label; `#nodes`), the network its waypoint rings (`#waypoints`) and its transit ring on a device, the simulation its spawning mark.
  A painter or a decoration also names what else to redraw when its entity changes -- a link its anchors, an anchor's network decoration its links.
  It mirrors field extensions (S-a) and O4's "a node composes appearance from plugins on top of the anchor".
  Cost: a second seam beside painters, its decorations applied in composition order.
- **B -- whole painters, split by shape.** The devices plugin paints anchors carrying a device, the network paints bare ones, each choosing by a test; the network's transit ring on a device is handed to the device's painter through the kit.
  Cost: two painters for one kind, and the network's look on a device stays an exception.
- **C -- the canvas keeps drawing anchors.** Zones, groups and links are painted by their plugins; the canvas draws devices and waypoints itself, calling the plugins' look functions as it does now.
  Cost: the canvas keeps naming whether a device is composed and the network's waypoint look, recorded in C-f's ratchet.

CORRECTED 2026-10-09 -- **option A is the appearance pipeline's composition half, ruled and unbuilt.**\
The director asked: "So this is the "unified appearance pipeline" we discussed earlier in our programme?" -- and it is.\
Ruled 2026-09-22 ("How two derived appearances resolve", `dev/DECISIONS.md`): a pack declaring a derived appearance carries, per derived state, `composes` -- drawn alongside the others, priority the z order -- or not, competing so the highest priority alone is drawn; a router's glyph outranks the anchor's endpoint pad, which is not emitted rather than hidden; `.spawning` composes; session state decorates and is no pack.\
The director, 2026-10-02: "a node is a composition of an anchor with a pipeline including capability packs, behaviours and appearance".\
H15.9 built one look per kind applied by both create and update; the composition across packs is unbuilt (`dev/design/unification/REALITY-MAP.md`, the appearance pipeline row).

**Option A, restated to the ruling:** the canvas keeps an anchor's element and the session decorations; each plugin brings appearances for a kind, each declaring per derived state whether it composes or competes, and its place in an ordered list of named layers -- the ruling's own caution against a bare integer priority, now that three plugins contribute.
- The network's anchor marks (endpoint pad, junction rings) are offered for every anchor and compete low; the devices plugin's device competes high -- so on a device the marks are not emitted and on a bare anchor they are, today's drawing reached by the rule rather than by a branch on whether a device is composed.
- The network's transit ring and the simulation's spawning mark compose.
- An appearance names what else to redraw when its entity changes.

AMENDED 2026-10-09 -- **D3 RULED: A, the appearance pipeline's composition half** (`dev/DECISIONS.md`, "D3"); C-a continues on it.

AMENDED 2026-10-09 -- **C-a, step three: the anchor drawn through the appearance pipeline** (H19.29 stays open for the link).\
A canvas part may bring `appearances` for a kind several plugins draw on, and `orders` for such a kind; the renderer composes an entity's appearances -- those whose state applies; of the competing ones the highest-ranked alone; every composing one with it -- builds the winner's root in its layer with the composers' classes, emits each named layer of the order in turn (the winner's part, then the composers'; the canvas's own `select` layer, the selection brackets), and applies the looks (`app/src/renderer.js` `composeParts`, `compose`, `drawComposed`).\
An update renders afresh when the composition or the winner's structure changed, otherwise applies the looks, then redraws what each appearance names and whatever gathers the entity.
**Brought:** the devices plugin's device (`devices/device-appearance.mjs`), the network's marks and its transit ring over a device (`network/anchor-appearance.mjs`), the simulation's spawning mark (`engine/spawn-appearance.mjs`); the product declares the anchor's order -- layers `frame, sockets, body, marks, transit, select, label`, ranks `device, marks` (`product/canvas.mjs`).\
**A refinement chosen in the build:** two named lists, not one -- the layers (the z order of parts) and the ranks (which competitor is drawn).
The ruling's own example needs both: the router's endpoint pad would be drawn over the glyph if it composed (higher in z), yet the glyph outranks it.\
And the network's transit ring is drawn within its marks on a waypoint, where it sits between the rings and the centre dot, and as its own composing appearance over a device.
**Found and fixed on the way:** B312 and B313 (H19.35), fixed first so the refactor stayed structural; B314 (H19.36) and B315 (H19.37), regressions of C-a's first two steps -- the session states not re-applied for a painted kind, and `byId` not searching a painter's layer.\
**Held by:** `tests/appearance-pipeline.test.js` -- each plugin's appearances composed by the product; with the ranks reversed a device is drawn by the network's marks (the rule, not a branch); without the network a device draws without its ring and a waypoint not at all; the renderer draws no device and no waypoint of its own; malformed appearances and orders refused (ranks ignored, composers dropped, and no fresh render on a changed composition each fail -- three mutants killed); the page's DOM record, the matrix and every corpus unchanged.
Six source-reading tests that looked in the renderer for the waypoint's and the device's drawing were pointed at the plugins that hold it now.

AMENDED 2026-10-09 -- **C-a, step four: the link's painter -- and C-a done** (H19.29).\
The network brings the link's painter (`network/link-painter.mjs`), composed with its appearances into its canvas part (`network/canvas.mjs`): the path along where the network draws the link, its look in one derivation, its invisible click twin (B268), stacked by drawing order.\
A painter may now name companions drawn with its element -- moved and removed with it -- the entity a companion stands for, and what to draw afresh once its entity is created, changed or deleted: a link its waypoints, whose roles it changes (B218).\
The renderer keeps no layer of its own: every entity is drawn by a painter or by the appearance pipeline.
**Left in the renderer, for C-e:** the selection reflections -- a selected path lit through its waypoints, the links blocking a down link -- which are session decorations, not drawing; they name the link and read the links layer.\
**Held by:** `tests/canvas-painters.test.js` -- a link drawn with its twin, a deleted link's waypoint re-derived, no link without the network's painter, the renderer drawing no link, a link put back keeping its twin just after it (the twin not removed, no redraw after a delete, and the twin not restacked each fail -- three mutants killed, the last once its test was added); four source-reading tests pointed at the painter; the page's DOM record, the matrix and every corpus unchanged.

AMENDED 2026-10-09 -- **C-b done: picking** (H19.30).\
A painter or an appearance declares how its element is picked -- `picks: [{ closest, word, modifier? } | { self, word, id? }]` -- and the picker is composed from the page's canvas parts (`app/src/pick.js` `picksOf`, `hitWith`), handed to `Capture` by the composition.\
The zones plugin's pick is under Shift and passes a plain press through (U1); the devices plugin's answers `g.node` but not a held tool's ghost; the network's answers a waypoint, a link's path and its click twin.\
A backdrop -- a pick under a modifier -- is tried after everything drawn over it, which restores the old precedence by rule.\
The canvas keeps what spans kinds: a plugin's mark, the canvas -- and the handles, C-d's.
**A refinement chosen in the build:** no new attribute. Every entity's element already carries its id (a link's twin as `data-link`) and the DOM is held byte for byte, so each drawer declares how its element is found.\
**Left for later stages:** the picks by coordinate -- which device or waypoint is at a point (`nodeAt`, `endpointAt`), read by the gestures -- C-c's and C-d's; run mode's regions (`app/src/capture.js` `regionOf`) -- C-e's.\
**Held by:** `tests/canvas-picks.test.js` -- the product's picks answer every kind as before; without the zones plugin a zone is never picked; the picker names no plugin's kind; malformed picks refused; a backdrop last (the modifier ignored, and the backdrop not last, each fail -- two mutants killed); `Capture`'s tests and one pipe test restated to hand it the product's picks; the gesture corpus and every browser run unchanged.

AMENDED 2026-10-09 -- **C-c done: placing** (H19.31).\
A canvas part declares its placed kinds -- `places: [{ kind, layout, ext, size(entity) -> { w, h } }]` -- composed by `app/src/snap.js` `placesOf` and handed to Input by the composition.\
Moving, duplicating, cloning and nudging ask whether a kind is placed; a drag snaps its base on its own grid (`snapIn`); the clamp holds each moved entity inside its own extent by its own size.\
The zones plugin places the zone -- the half-offset grid, its extent, its box; the product places the anchor -- the node grid, the node extent, and its size a wide device's span: the canvas's one read of a device field for the anchor, the recorded width exception until B282 (O4).
**Left for later stages:** snapping the pointer while drawing a zone or a node, and a zone's resize (`snapZone`, `resizeBox`, `resizeZoneStep`) -- the gestures', C-d's.\
**Held by:** `tests/canvas-places.test.js` -- a waypoint and a zone nudged; the places the parts'; without the zones plugin a zone not placed; a zone held at its extent by its size; a dragged zone snapped on its own grid; the canvas naming no list of placed kinds; malformed places refused (the size ignored, any kind nudged, and every base on the node grid each fail -- three mutants killed, the last directly once its test was added); twelve direct calls in the tests and the sync fuzz handed the product's places; the gesture corpus and every browser run unchanged.

AMENDED 2026-10-09 -- **C-d, step one: the zone's draw and resize as the zones plugin's rows over shared gestures** (H19.32 stays open).\
Two shared gestures in Input: BOX -- a preview rect on the grid of the kind its row places, its release's meaning the opening row's own -- and HANDLE -- drag a handle of the lone selected entity by what its kind's handles declare (where they are, what a drag makes of the entity, the command's label), previewed live, rewound on cancel.\
A canvas part may bring `presses` (rows composed with the product's, under its owner) and `handles`; Input takes the canvas parts and composes its places, press rows, the release rows a press row brings, and the handles from them; the overlay draws a lone selection's handles from the kind's declaration.\
The host gains one verb, `create(kind, make)`, through which a plugin's release row makes and selects an entity; a handle drag commits through one generic builder (`app/src/commands.js` `setFields`).\
The zones plugin brings its draw row over BOX and its corner handles (`zones/zone-gestures.mjs`), with the corner arithmetic, moved from the canvas.
**Left for later steps:** the link's end handles and replug, the text box, a device's stamping and chaining, the press rows that name a zone, a link or a waypoint as what a press selects, moves or clones, and the Ctrl clone-arming.\
**Held by:** `tests/canvas-gestures.test.js` -- a zone drawn on its grid and selected; a corner drag resizing it, a cancel rewinding; without the zones plugin no zone drawn and no handles; the canvas holding no zone draw or resize; handles brought twice refused (a box on the node grid, a cancel that does not rewind, and a plugin release row not run each fail -- three mutants killed); the press-table oracle, the release tests, the grid tests, the host-verbs test and one builder test restated; the gesture corpus and every browser run unchanged.

AMENDED 2026-10-09 -- **C-d, step two: the link's end handles and re-plug as the network's** (H19.32 stays open).\
The shared handle gesture previews one of two ways a handle declaration names: `reshape` -- what a drag makes of the entity, written live and rewound at the end (a zone's corners) -- and `retarget` -- a preview line from the fixed anchor to the pointer or the device under it, the dragged entity marked (a link's ends).\
On release the declaring plugin says what it found (`released`) and its release rows say what that means: the gesture commits nothing itself, and both a zone's resize and a link's re-plug now reach the document through their plugin's rows and the host's new `set` verb.\
A handle declaration names its hit word and dataset key, and the picker reads them, so the canvas no longer knows a corner from a link end; the press rows that open the handle gesture are the zones plugin's (`resize`) and the network's (`replug`).\
The network brings the link's handles (`network/link-handles.mjs`): their places on the route's own end segments (B29), the re-plug's judgement (a genuine retarget, a pair with room, B72, B80) and its release row; `replugLink` is retired for the one builder.
**A user-visible change, measured:** the help overlay lists a plugin's press rows after the product's, so its pointer section now lists the zone's draw, its resize and the link's re-plug after the other presses, where they sat among them -- the same lines in another order, since step one.\
**Held by:** `tests/canvas-gestures.test.js` -- a link re-plugged onto the device released on, a cancel changing nothing and unmarking the link; without the network's part no link handles; the canvas holding no link handle or re-plug, and the handle gesture committing nothing itself (a retarget cancel left uncleaned, the pair's room ignored, and the release rows not run each fail -- three mutants killed, the first once its test was added); the press-table oracle, the release, host-verb, pick and builder tests, a reconcile test and the sync fuzz restated; the gesture corpus's re-plug scenarios and every browser run unchanged.

AMENDED 2026-10-09 -- **C-d, step three: the text box as the devices plugin's row over the box gesture** (H19.32 stays open).\
The box gesture takes its shape from the opening row -- the rect two points span, or the row's own frame -- and whether its preview shows at the press; the devices plugin's row (`devices/device-gestures.mjs`) opens it with the text tool held, on the node grid, its frame the cells the drag spans with a frame's margin (`frameSpan`, moved from the canvas), shown once the pointer moves, as it always was.\
Its release makes a text panel through `create`, which now answers the new entity's id, then releases the tool and opens the editor on the panel's frame -- two more host verbs, `releaseTool` and `editFrame`.
**Held by:** `tests/canvas-gestures.test.js` -- a drag with the text tool held making a panel over the cells it spans, selected, the tool released; nothing without the devices plugin's part; the canvas holding no text box; the panel's frame shown only once the pointer moves while the zone's shows at once (the row's frame ignored, the tool not released, and the preview shown at the press regardless each fail -- three mutants killed, the last once its test was added); the press-table oracle and the host-verb test restated; the gesture corpus and every browser run unchanged.

AMENDED 2026-10-09 -- **device placing moves to C-e, as one step** (the director: "as one step in C-e").\
Stamping a device, chaining through one mid-drag, the palette and its drop, the digit keys, the pipette and a click that retypes all hang off the held device type -- the hand -- across the keys, two gestures' release rows and two widgets; moved in a slice now, the hand would sit half in the product and half in the plugin.\
C-d finishes with what is its own: the press rows that still name a zone, a link or a waypoint as what a press selects, moves or clones, and the Ctrl clone-arming.\
C-e opens with the devices plugin's hand.\
**Found re-reading the press rows: B316** (H19.38), a regression of C-d step two, fixed -- a handle's hit is flagged, as a plugin's mark is.

AMENDED 2026-10-09 -- **C-d, step four: the press rows read the plugins' facts (D4) -- and C-d done** (H19.32).\
The product's press rows are composed from the parts' picks and places (`app/src/recognize.js` `pressRows`, `hitFactsOf`): for each drawn hit word, whether its kind is placed (the part's place, C-c), an anchor (the core's anchor kinds) and cloned by Ctrl+left (the one fact a pick declares -- the devices plugin's, the network's link, the zones plugin's), and the modifier it is picked under.\
A right press moves the placed, a left press draws a link from an anchor (Ctrl+left cloning instead what clones), a press selects a drawn hit that is no anchor; the help's kind lists are built from the plugins' words.\
The same facts drive the overlay's Ctrl clone highlight (placed and cloned), Shift as a zone's layer key rather than selection-add, what anchors a clone drag, and the press's drag escalation (`unplaced`, `linksOnLeft`, B203).
**A refinement chosen in the build:** a pick declares only what nothing else states. "Placed" is the part's place and "an anchor" the core's anchor kinds, derived rather than declared twice (A2), and "selects on a press" is "drawn but no anchor".\
**A user-visible change, measured:** three help lines reorder their kind lists -- the delete chord ("a node, a link, a waypoint or a zone"), the Ctrl+left clone ("a node, a link or a zone") and the select press ("a link / Shift + a zone / a mark") -- the same lines, as D4 said.\
**Found and fixed on the way:** B316 (H19.38) and B317 (H19.39), regressions of step two -- a link end's hit gained an id, which the delete chord and the overlay's hover took for an entity's; a handle's hit is flagged now.\
**Carried into C-e, with the hand:** the picks by coordinate the gestures and the hover read (`nodeAt`, `endpointAt`, a device's footprint), the marquee's footprint picks, and the draw-a-link gesture's targets -- `app/src/input.js` and `app/src/commands.js` hold most of what the canvas still names, 44 and 46 lines.\
**Held by:** `tests/canvas-gestures.test.js` -- the facts per hit word; the rows' kind lists from the plugins; no row naming a zone without the zones plugin; no kind test in the rows or the arming; Ctrl lighting a device's clone and not a waypoint's; a Shift-press on a zone selecting it alone (clones ignored by the link row, nothing placed, arming ignoring clones, and Shift adding a zone each fail -- four mutants killed, the last two once their tests were added); the press-table oracle (all 168 presses), the help tests, the release and pipe tests and the waypoint-literal ratchet restated; the gesture corpus and every browser run unchanged.

AMENDED 2026-10-09 -- **C-e, step one: the hand is the devices plugin's to declare** (H19.33 stays open).\
A canvas part may declare a hand -- `{ items, place, blocked, stamp, itemOf, retype }` -- and the canvas holds its item and runs the keys and release rules that read it: a digit holds the nth item, a click or Enter stamps the held item on its place's grid where it is not blocked, the pipette holds the item a device was stamped from, a click on a device with another item held retypes it, and a digit mid-link-drag stamps through the hand before the drag chains on.\
The devices plugin declares it (`devices/device-hand.mjs`): its six device types, a device standing on the cell blocking a stamp, the device a stamp makes, a device's type as its item, the retype's edit.\
`NODE_TYPES` left `app/src/tools.js` and `retypeNode` left the builders; the palette is handed the items.
**A choice in the build:** the same shape as handles -- the plugin declares, the product's keys and rules read -- rather than the keys moving into the plugin, since the keys are generic ("hold the nth item", "pipette", "stamp") and only their device meaning was the canvas's.\
**An edge recorded:** a device whose type is `waypoint`, pipetted, once stamped a bare waypoint (an unreachable branch otherwise); it now stamps a device of that type, as the pipette meant.\
**Left for C-e's next steps:** the hand's ghost (`app/src/painter.js` `ghostNode`), the palette's tile icons and its drop, and the readout's naming of a held item.\
**Found on the way, mine, caught by the gate:** the palette built its tiles from a list no longer in scope, so the product page did not boot; fixed before the commit.\
**Held by:** `tests/canvas-hand.test.js` -- a digit holding the first item, a click stamping it on its cell, the pipette holding a device's type; without the devices plugin's part nothing held and nothing stamped; the canvas holding no type list, stamp or retype; a hand brought twice refused; a blocked stamp and a same-type click sending nothing (a stamp ignoring what blocks it, the wrong item held, and a retype never recognised each fail -- three mutants killed, two once their test was added); a builder test and the waypoint-literal ratchet restated; the gesture corpus and every browser run unchanged.

AMENDED 2026-10-09 -- **C-e, step two: the hand's preview, and the palette's drop through the hand** (H19.33 stays open).\
The hand declares how an item looks before it is stamped -- `preview(item)`, elements as data: the frame, and the glyph fitted to its box from the numbers the device's appearance draws with (`GLYPH_BB`, `STD.socket`).\
The stamp ghost and the palette's drag ghost draw it (`app/src/painter.js` `ghostNode(overlay, preview)`, `buildPreview`), and so do the palette's tiles, which had built the same numbers by hand since B205; the palette is handed the hand and a `stamp(item, pos)`, and a drop stamps through the canvas's `stampAt` as a click with the item held does -- the hand's grid, its rule for what blocks a stamp, the selection following.\
The palette no longer builds an entity or a command, and the ghost's waypoint branch and its four CSS rules went: no hand holds a waypoint.
**Measured before moving, two facts:** the ghost drew a device's glyph unfitted, 85-115% of the device it stamps -- B318 (H19.40), fixed by the move, all six types 1.00 after, viewed in a screenshot; and a drop onto an occupied cell already made nothing (the planner refused it, a step later and silently), so stamping through the hand's own check changes nothing seen there.\
**The readout needs no move:** its cursor line prints the held item as given (`stamp host -> ...`), naming no kind.\
**Held by:** `tests/canvas-hand.test.js` -- every item's ghost glyph fitted to the socket box; no device drawn by the canvas for a ghost or a tile, and nothing made by the palette; `tests/browser.test.js` -- on the page, each device's ghost glyph the size the device draws it, and a tile dropped on a free cell stamping that device there, selected, and on an occupied cell nothing (the glyph unfitted, a drop stamping nothing, and a drop's item ignored each fail -- three mutants killed); the waypoint-literal ratchet lowered; the gesture corpus and every other browser run unchanged.

AMENDED 2026-10-09 -- **C-e, step three: what is at a point is what the plugins say their items cover** (H19.33 stays open).\
A canvas part may declare `at: [{ word, of, grabs, under, within, joins }]` -- the word its items are picked by, the items, and what a press grabs, what keeps a hover after a gesture, what a box takes, and what a box takes once it took what the item joins.\
The canvas composes them in the parts' order (`app/src/pick.js` `pointsOf`, `grabbedAt`, `takenIn`) and asks them for a link's ends and its live preview, a link's stops, the pipette, the step under the pointer, the marquee and the overlay's hover.\
The devices plugin declares a device's footprint (`devices/device-footprint.mjs`, `inFootprint` and `footprintHits` moved there from the picker), the network a waypoint's radius and a link taken with both its ends (`network/anchor-points.mjs`); a handle names the words it lands on, a link end on a device (`targets`).\
A link ends at an anchor: the words whose picks the core's anchor kinds back (D4's facts).\
`nodeAt`, `endpointAt` and the canvas's own occupancy question left the picker, which now imports nothing from a plugin.
**Equivalences relied on, by the grid's geometry:** a link's stop and the step under the pointer ask for a waypoint on the snapped cell first, so asking any anchor next can only find a device, as `nodeAt` did; and a cell with no waypoint on it is taken only by a device, so the stop's refusal asks the core's occupancy.\
**Left for C-e's labels and keys steps:** a text box's double-click hit (`editUnderPointer`, which now reads the devices plugin's footprint), the step words and the stop's waypoint-on-a-cell question, and select-all.\
**Held by:** `tests/canvas-points.test.js` -- a marquee taking a device by its footprint, a waypoint by its place and the link joining them; a link drawn from a waypoint ending on the device released over; without the devices plugin's part no device taken or ended on; without the network's no waypoint and no link taken; a link end not re-plugged onto a waypoint; a wide device's hover kept over its far cell and dropped off it; the picker, the input and the overlay finding nothing by a plugin's kind or shape (a box taking no link, a handle's words ignored, the hover kept by the origin alone, and no waypoint grabbed each fail -- four mutants killed, the third once its test was added); a geometry test and B209's restated, the latter having gone vacuous when `endpointAt` left the picker; the gesture corpus and every browser run unchanged.

AMENDED 2026-10-09 -- **C-e, step four: the zone keys, and the size steps (D5)** (H19.33 stays open).\
D5 rules the shape of every command that moves: a plugin's edits are data, handed to the host's generic verbs, and `app/src/commands.js` keeps generic builders only.\
A canvas part may bring key rows, as a plugin does: the zones plugin's `z` (`zones/zone-keys.mjs`) asks the host for the selection's bounds -- the selected placed entities, each by its place's `size` (C-c) -- and makes the zone through `create`, then says its size through the readout (`selectionBounds`, `flash`, `dims`, three more host verbs).\
Shift+arrow stays the canvas's one row, since two plugins answer it: a part declares its `sizeStep` -- the zones plugin's grows a zone a cell, the devices plugin's a device's span a cell (`devices/device-size.mjs`) -- and the canvas asks only the lone selected entity's kind's, setting what it makes through `setFields`; the row's help is phrased from the parts that declare a step, so it reads as before with both and says nothing of zones without the zones plugin (a product row may phrase its `doc` from the composition, and is absent where it answers null).\
`wrapSelection`, `resizeZoneStep`, `resizeNodeStep` and `resizeNodeSpan` left the builders.
**Two user-visible changes, measured:** `z` wraps a wide device whole -- B319 (H19.41), the bounds having counted a device as its origin point; and the help's `z` line moves to after the network's keys, where a plugin's rows are listed, the same line.\
**Held by:** `tests/canvas-keys.test.js` -- `z` wrapping a device and a waypoint in a zone, selected, with a receipt; a wide device wrapped whole; Shift+arrow growing a lone zone and a lone device's span, a waypoint and a mixed selection stepping nothing; the help's Shift+arrow line as before, and without the zones plugin no zone key and a line naming only the device's step; the canvas holding no zone key or size step (the bounds ignoring a device's span, a mixed selection stepping, no receipt, and the help phrased regardless of the parts each fail -- four mutants killed); B44's builder list, B46's two builder tests, B86's cap check, the host-verb test and a scan-dead allowance restated; the gesture corpus and every browser run unchanged.

AMENDED 2026-10-09 -- **C-e, step five: the group keys, and each plugin's rank in a delete (D5)** (H19.33 stays open).\
Ctrl+G and Ctrl+Shift+G are the groups plugin's key rows (`groups/group-keys.mjs`): the selected anchors, at least two, made into a group and put under the label `group`, the selection kept; and every group a selected anchor belongs to, removed under `ungroup` -- through three more generic host verbs, `ask` (a plugin's question over the Model, answered), `put` (an entity it made, under its label) and `remove` (entities deleted, under its label), and two generic builders, `putEntity` and `deleteEntities`.\
`createGroup`, `ungroupAll` and `Selection#groupable` left the canvas.\
A kind's rank in a delete is its part's (`deleteRanks`, composed by `deleteRanksOf`): the groups plugin's group 0, the zones plugin's zone 1, the network's link 2, the anchor 4 -- the product's, beside its layers -- and a kind no part ranks, 3, as the table said.
**Measured on the way:** a group is never selected (the selection keeps no group id), so the group's rank is reached only by a caller handing the builder a group; it is kept, as the table had it.\
**Group cloning stays in the clone builder for the network's step:** it runs after link cloning there, and a group whose member is a link's bend pulled into the clone depends on that order, so the two followers move together.\
**A user-visible change, measured:** the help's Ctrl+G and Ctrl+Shift+G lines move to after `z`, where the parts' rows are listed -- the same lines.\
**Held by:** `tests/canvas-keys.test.js` -- Ctrl+G grouping the selected anchors under `group` with the selection kept, Ctrl+Shift+G ungrouping under `ungroup`; a delete's order on the page and, with a group, through the builder; without the groups plugin no group made and no group key offered; the canvas holding no group key, group builder or ranking (a group of one, an ungroup removing nothing, no delete order, and a link ranked after the anchors each fail -- four mutants killed); the page's whole key composition held to no keystroke matching two rows; the command tests restated onto the generic builders, the at-least-two rule held through the plugin's row, and B87's ungroup case corrected (it named a node as the group, and held nothing); B48, the host-verb test, a convergence test and the sync fuzz restated; the gesture corpus and every browser run unchanged.

AMENDED 2026-10-09 -- **C-e, step six: the devices plugin's key (D5)** (H19.33 stays open).\
`s` is the devices plugin's key row (`devices/device-keys.mjs`): each selected device flipped between a circle and a square, as one edit labelled `reshape`, through one more host verb, `setAll`, and one generic builder, `setFieldsAll`; `reshapeNodes` left the builders.\
The rest of what the canvas still names of the devices belongs to later steps, by the inventory: a run-mode tower (the simulation's), a waypoint's placing and a link's stops (the network's), a text box's double-click and a panel's content edit (the labels'), and select-all.
**A user-visible change, measured:** the help's `s` line moves to after Ctrl+Shift+G, where the parts' rows are listed -- the same line.\
**Held by:** `tests/canvas-keys.test.js` -- `s` flipping each selected device and nothing else, labelled `reshape`; without the devices plugin nothing reshaped and no reshape key offered; the canvas holding no reshape key or builder (a waypoint reshaped and a flip with no way back each fail -- two mutants killed); the reshape tests in three files restated to run the plugin's row through one fixture (`tests/fixtures/plugin-edits.mjs`), and the host-verb test; the gesture corpus and every browser run unchanged.

AMENDED 2026-10-09 -- **C-e, step seven: the network's link keys (D5)** (H19.33 stays open).\
`c`, `f`, `k`, `l` and Shift+L are the network's key rows (`network/link-keys.mjs`), first in its list (`network/keys.mjs`), beside `g`, `w` and `x`: close or open the lone selected bent link (on a straight one, say why), cycle its direction, toggle its plane, and chain or star the selected devices -- each handed to the host's generic verbs, two more of them: `putAll` (several entities put as one edit, `putEntities`) and `select`.\
Returning a declaration to absent stays a whole-entity put of the link without the key, now cloned by `putEntity` where `cycleDirection` had put a shallow copy that shared the link's `via`.\
`toggleClosed`, `cycleDirection`, `toggleControl`, `linkNodes` and `Selection#selectedNodes` left the canvas, with the readout refreshes after `f` and `k` -- the readout already redraws when a selected entity changes.
**A user-visible change, measured:** the help's six link-key lines move to after Delete, where the network's rows are listed -- the same lines.\
**Held by:** `tests/canvas-keys.test.js` -- `c`, `f` and `k` on a bent link under their labels, a cleared direction or plane leaving no key; `l` chaining the selected devices and not a waypoint, Shift+L starring them past existing pairs, the new links selected; composed without the network none of them acting or offered; the canvas holding no link key or builder (clearing written as undefined, an existing pair linked again, a waypoint chained, and the data plane written as false each fail -- four mutants killed); three page tests now PRESS `f` and `k` under write access where they had called the removed handlers -- which had skipped the read-only guard a press meets; the link-builder tests in four files and the sync fuzz run the network's rows through `tests/fixtures/plugin-edits.mjs`; the generated gesture table lists the six rows among the network's (its diff only those six lines); the gesture corpus and every other browser run unchanged.

AMENDED 2026-10-09 -- **C-e, step eight: what follows a clone, and the network's transit edit (D5)** (H19.33 stays open).\
A part may declare what follows a clone (`follows`, each with a rank; composed by `followersOf`): the network's link both of whose ends were cloned, with bends of its own pulled in through the canvas's anchor cloner (`network/link-clone.mjs`, rank 1), and the groups plugin's group all of whose members were (`groups/group-clone.mjs`, rank 2).\
`cloneSubgraph` clones the seeds and runs the followers in rank order; the link and group passes left it.\
The network's transit edit, the one command it built by hand (`network/host.mjs`, out of B44's reach), now reaches history through `edit(label, entries)`, which the composition roots back with a new generic builder, `editOf` -- each entry rebuilt, a put's or a delete's entity cloned, a set's patch copied; `attachNetwork` takes `edit` in place of `history`.
**CORRECTED, a claim of step five:** "a group whose member is a link's bend pulled into the clone depends on that order" holds only for the builder: on the page, selecting one member of a group selects them all, measured, so a group is cloned whole whatever the order. The rank order is held at the builder, handed a link's ends alone.\
**Left for C-f's record, by D2:** the draw-a-link gesture's commit -- `routeLink`, `routeLinks`, `chainHop`, `keepAnchors`, `withJudged` -- is the product's shared gesture with the network as its judge (D2), and it names a link and the bare anchor however its entries are built; moving the builders alone would move no name out of the canvas.\
**Held by:** `tests/canvas-keys.test.js` -- Ctrl+D copying two linked, grouped devices with the link, a bend of its own and the group; composed without the network no link following, without the groups plugin no group; a group holding the link's bend following, the link first, at the builder; `editOf` handing over copies; the clone builder naming no follower and the network building no command by hand (followers out of order, a cloned route sharing its bends, `editOf` aliasing a put, and transit never committed each fail -- four mutants killed, the first once its builder-level test was added); the network-host and pipe-select tests composed with `edit`, two clone-builder tests with the followers; the gesture corpus and every browser run unchanged.

AMENDED 2026-10-09 -- **C-e, step nine: run mode's spawner and tower are the simulation's (D5)** (H19.33 stays open).\
The two run-mode rows that author -- arm or disarm an endpoint as a spawner, place a tower on open ground -- are the simulation plugin's (`engine/spawn-runs.mjs`), and the product's run-mode list includes them (`app/src/run-mode.js`), which only the product page hands Input: the lab passes no run-mode rows, as H17-D7 rules, so the rows do not ride the simulation's canvas part, which the lab composes too.\
They act through three more generic host verbs -- `now` (the agreed instant), `snap` (a point on a place's grid) and `add` (an entity made and committed, the selection untouched) -- and Input runs a run-mode row that is a function through the host, as it runs a key row.\
`toggleSpawn` left the builders, its overrides with it (no caller but a test took them), and `toggleSpawnHere` and `placeTowerHere` left Input.\
The panel rows, a button and an input, stay the product's for the labels step.
**Measured on the way:** the tower's own occupied-cell check is the front door -- without it a request goes out and the planner refuses a second anchor on the cell -- so it is held by "nothing sent", not by the model alone.\
**Held by:** `tests/canvas-runs.test.js` -- an endpoint armed from the agreed clock and disarmed with the key gone, under their labels; a tower on open ground on its snapped cell, unselected, and nothing placed or sent on a taken cell; the canvas holding no spawner or tower (a disarm writing undefined, the wall clock, a tower on a taken cell, and a tower selected each fail -- four mutants killed, the third once "nothing sent" was asserted); the spawn tests and a replay test run the simulation's row through `tests/fixtures/plugin-edits.mjs`, the override assertion CORRECTED away, the wall-clock check read off the module; the host-verb test; the help, the gesture corpus and every browser run unchanged, the armed spawner's included.

AMENDED 2026-10-09 -- **C-e, step ten: a kind's description, and whether select-all takes it** (H19.33 stays open).\
A part declares how its kind reads on the selection line (`describe`, given the readout's formatters and the Model) and what Ctrl+A takes of it (`selectAll`, a word, a rank and the ids): the devices plugin's device by its name and place (`devices/device-facts.mjs`), the zones plugin's zone with its size too (`zones/zone-facts.mjs`), the network's link by its ends, its direction and its plane (`network/link-facts.mjs`); a kind no part describes, or one its part declines -- a waypoint -- reads as its id, as before.\
The readout's multi-selection box takes each placed kind's size (C-c), where it had read a device's span by name; Ctrl+A selects in rank order -- devices, zones, links, as it did -- and its help line is phrased from the parts, as before with all of them and naming no zone without the zones plugin.
**Held by:** `tests/canvas-facts.test.js` -- Ctrl+A taking devices, zones and links in that order, and no waypoint or group, its help as before; without the zones plugin no zone taken or named; the selection line for a device, a zone and a link, a wide device's span in the box, and a zone read as its id without the zones plugin; the readout and the input naming no kind for it (Ctrl+A out of order, no kind's words, a wide device's span ignored, and the help phrased regardless of the parts each fail -- four mutants killed, the third once the box's corners were asserted); two readout tests composed with the product's parts; the help, the gesture corpus and every browser run unchanged.

AMENDED 2026-10-09 -- **C-e, step eleven: where a kind's name is edited** (H19.33 stays open).\
A part declares its labels (`labels`): the kinds F2 renames (`named`), where a kind's label sits (`labelAt`), the word a Tab rename run groups by (`wordOf`), and what a double-click edits at a point (`edits`, ranked).\
The devices plugin's (`devices/device-labels.mjs`): a device named, its name under it and centred, a run through devices or through waypoints, and a double-click on a text box's footprint (its text, rank 0) or a device's icon or name strip (its name, rank 1); the zones plugin's (`zones/zone-labels.mjs`): a zone named, a double-click inside it (rank 2).\
The canvas runs the edits in rank order, the first that answers winning, and the label editor takes `labelAt` and `wordOf` from the composition; `pointInBox` left the canvas with its last callers.\
**A user-visible change, measured: B321** (H19.42) -- F2 with a pipe selected opened a name editor with no place and no value, and dropped a name typed into it; F2 renames only the named kinds now, which is the survey's first open finding (section 7) confirmed and closed.
**Caught by its own test before commit:** the label editor's Tab run still read `drawnKind`, whose import the move had removed -- a Tab in a rename would have thrown; the run now groups by the parts' `wordOf`.\
**Held by:** `tests/canvas-labels.test.js` -- a double-click editing a device's name on its icon and its strip, a zone's inside it and a text box's text; a device inside a zone editing the device; without the zones plugin or the devices plugin, nothing; F2 on a link and a zone renaming the zone, and on a pipe nothing (B321); a device's label place; a Tab run through devices past a waypoint, and through waypoints; the canvas holding no edit target, placement or filter (the ranks reversed and a run crossing devices and waypoints each fail); `tests/browser.test.js` -- a device's name editor opening with its styled width centred under the device and just below its frame (the editor not centred fails -- a page test added, since the editor is a DOM element the harness never builds); the zone's inclusive edge held where it lives now (`tests/grid.test.js`, CORRECTED); the gesture corpus and every other browser run unchanged.

AMENDED 2026-10-10 -- **C-e, step twelve: a panel's content is the devices plugin's** (H19.33 stays open).\
A device's `content` -- its regions, a field only a device carries -- is read and edited through the devices plugin's `labels.content` (`devices/device-labels.mjs`): a region's value and alignment, and the edit that sets one, a copy of the regions so the history entry and the live device share nothing (W6).\
The label editor takes `contentOf` from the composition and names no kind; its commit goes through `setFields`, and `setContentValue` left the builders.\
Run mode's panel rows -- a button hands the host `draw:action`, an input opens the editor -- are the devices plugin's (`devices/device-panels.mjs`), included in the product's run list beside the simulation's and handed in by the product page alone (H17-D7), acting through two more host verbs, `emit` and `editRegion`; `fireActionHere` and `openInputHere` left Input, and `app/src/run-mode.js` now holds no row of its own.
**Held by:** `tests/canvas-panels.test.js` -- a committed panel input setting the device's content with that region changed, a copy, labelled `edit`; an unchanged value or a missing region committing nothing; the plugin's reading of a region and of none; a panel button handing the host `draw:action`; the canvas holding no panel row, region read or content builder (the edit aliasing the live regions, a button handed nowhere, an unchanged value committed, and a locked client opening an input each fail -- four mutants killed); the existing run-mode tests -- a button live on a locked client, an input opened only when unlocked -- unchanged; the content tests in two files run the plugin's edit through `tests/fixtures/plugin-edits.mjs`, and the host-verb test; the help identical to HEAD in every section, the gesture corpus and every browser run unchanged.

AMENDED 2026-10-10 -- **C-e, step thirteen: the grids are declared by what places on them** (H19.33 stays open).\
A part declares its grid (`grids`): the page layer its dots go into, the points, the dot's radius, and for a grid not always shown the modifier that shows it and the stylesheet class that does.\
The product declares the anchor grid, always shown, with the kernel's dot (B200; `product/canvas.mjs`); the zones plugin the half-offset grid, shown with Shift and not during a move or clone (`zones/zone-grid.mjs`).\
The canvas draws each part's dots in the parts' order -- refusing a grid whose layer the page lacks, naming the part -- and the overlay shows each modifier grid by its declaration (`showGrids`); `zonePoints`, `nodePoints`, the zone grid's dot, `snap.js`'s re-export of the zone extent and `Input#syncZoneGrid` -- no caller, the survey's finding (section 7) -- left the canvas.
**Held by:** `tests/canvas-grids.test.js` -- Shift showing the zone grid and its release hiding it, and neither Shift nor the pointer moving on with it held showing it mid-move; without the zones plugin no grid shown; the two declarations, their layers, point counts, dots and modifiers; the canvas drawing and showing no grid of its own (the grid shown mid-move, the zone grid a row short, and every dot the zone grid's size each fail -- three mutants killed, the first once the pointer case was asserted); `tests/browser.test.js` K8 -- both grids' dot counts and first dots identical on the real page; B200's dot check, the grid tests and the zone-layer test restated; the gesture corpus and every other browser run unchanged.

AMENDED 2026-10-10 -- **C-e, step fourteen: what a selection lights, and the survey's open findings -- and C-e done** (H19.33).\
A part declares its selection reflections (`reflects`: a class, the ids it marks given the Model and the selection, and whether a mark is kept when an element is drawn afresh): the network's -- a selected link's waypoints lit (`on-selected-path`, kept) and the links blocking a selected down link (`blocking`) -- in `network/selection-reflects.mjs`; the renderer marks and unmarks them in one step and held both itself.
**The survey's findings (section 7), each settled:** a pipe put again lost its line -- **B322** (H19.43), MEASURED on the lab page and fixed: the renderer removes and draws only what it draws; F2 on a pipe -- B321, step eleven; the offline-start count's kind list, which omitted pipes, counts every kind the Model was composed with (INFERRED unreachable: a pipe's ends are anchors the count already held); the device hand's waypoint clause, unreachable since step one, went from the retype rule; `syncZoneGrid` -- step thirteen.
A join's succession asks whether what it joined into still exists, where it asked for a link (`app/src/changes.js`).
**Measured before and after, on the lab page (seed `trunk`):** selecting its down link turns the blocking link orange, `rgb(255, 152, 0)`, and deselecting returns it to `rgb(79, 195, 247)`, identically -- screenshots viewed.\
**Held by:** `tests/canvas-reflects.test.js` -- the blocker lit and released, a bent link's waypoints lit and released, a lit waypoint kept across a redraw, a part's own reflection honoured, B322, the offline count with a pipe, and the canvas naming no kind for these (nothing unmarked, a redraw dropping the light, and B322 back each fail -- three mutants killed); the path test in `tests/affordance.test.js` restated onto the one step; the link-release truth table CORRECTED to the values the hand can hold; the waypoint-literal ratchet lowered; the gesture corpus and every browser run unchanged.

**C-e is done** -- fourteen steps, each gated and deployed (`draw-00189` to `draw-00202`); B316 to B322 found and fixed on the way, two of them my own regressions (B316, B317).
**What the canvas still names, carried to C-f's record (MEASURED by a scan of `app/src/`, 2026-10-10):**
- the draw-a-link gesture, the product's shared gesture with the network as its judge (D2) -- its stops and `w`, its route commit and pieces, chaining through a device, the step under the pointer, and its builders (`routeLink`, `routeLinks`, `chainHop`, `keepAnchors`, `withJudged`);
- the clone's naming of a copy -- a device by its type (`cloneSubgraph`);
- run mode's regions read off the page's classes (`app/src/capture.js` `regionOf`);
- the page's header counts (`app/src/main.js`) and the hover ring over a device (`idleAffordance`);
- the core's anchor names (`ANCHOR_KINDS`, `BARE_KIND`), which are the core's to say, not a plugin's.

AMENDED 2026-10-10 -- **C-f, step one: the small names out first** (H19.34; the director: "Agree with clearing the three small first").
- **Run mode's regions** are read by the parts' selectors (`app/src/pick.js` `regionsOf`): what each part draws (`drawn` -- the zone, the group, the device, the link) and what a run press aims at (`runTargets` -- the network's waypoint); the region carries `target`, `overTarget` and the control's `owner` where it carried `waypoint`, `overWaypoint` and `node`, and the simulation's and the devices plugin's run rows read those; the help's run-mode word for an endpoint is `region:endpoint`.
- **The header's counts** are each part's (`tally`: a rank, a word, a count), joined by `tallyOf` -- devices, links, zones, as before.
- **The hover ring** is the state a pick declares its item shows idle under the pointer (`idle` -- the devices plugin's `linkband`); the canvas sets and clears it by the declaration.\
**The director's question, answered:** the anchor grid is declared today by the product's own part (`ANCHOR_ORDER`, with the anchor's drawing order, place and delete rank), not a plugin; it would be a layout plugin, and its extraction is put to the director with B282's design (H19.8), which rewrites exactly that part.\
**Held by:** `tests/canvas-chrome.test.js` -- in run mode no tower on a zone and one on open ground, and without the zones plugin what it would have drawn open ground; the header's counts in order, a waypoint no device, and without the zones plugin no zone count; the ring over a device, dropped by Ctrl, and none over a waypoint; capture, the header and the hover naming no kind or class (nothing drawn under a press, a control owned by nothing, the counts out of order, and Ctrl keeping the ring each fail -- four mutants killed); the run-mode page tests -- an endpoint's whole anchor clicks through to it, a spawner arms -- unchanged through the new selectors; the input-capture test given the parts' regions, the spawn fixture the new region; the help identical to HEAD; the gesture corpus and every browser run unchanged.

AMENDED 2026-10-10 -- **C-f done: B308 closed** (H19.34).\
The ratchet is `tests/canvas-names-no-plugin.test.js`: no module under `app/src/` names a plugin's kind -- a quoted kind word, or a class selector for one in a string -- or imports a module a plugin owns, beyond a record by file that may only fall, each count with its reason.\
MEASURED at the close: 18 kind words in four files and 19 plugin imports in seven, every one either the draw-a-link gesture (D2: its name, stops, route and the builders of its commit), the clone's naming of a copy (B187), a composition root composing plugins by design (the page, its run-mode list, the canvas's relations index), the simulation's two page pieces living in the canvas folder (movers, reveal), or the label of the pipes a refused drag keeps.\
Planting a kind word or a plugin import where none is recorded, and one more where one is, each fail it.
**The arc, start to close:** six stages, C-a to C-f, built 2026-10-08 to 2026-10-10 and deployed at every step (`draw-00174` to `draw-00203`; the ratchet's own commit is tests and documents, and deploys nothing); four rulings beyond D1 and D2 (D3 composition, D4 press facts, D5 edits as data, and device placing moved to C-e); defects B311 to B322 found and fixed on the way, B316 and B317 my own regressions within it.
Acceptance (section 6): a page composed without the zones plugin draws, picks, gestures, keys, handles and grids no zone, held stage by stage; the record above; the gesture and matrix corpora and the K8 DOM unchanged at every step; a malformed part refused when the page is built, naming the plugin.
**Carried, with their triggers (RU3):** the draw-a-link gesture's names -- revived if a second plugin must judge or extend a link drag; the simulation's page pieces -- revived when the simulation brings its canvas part whole; the anchor's own canvas part (`product/canvas.mjs` `ANCHOR_ORDER`), which the director asked whether it becomes a layout plugin -- put to the director with B282's design (H19.8), which rewrites it; the export door -- as section 7 records.

AMENDED 2026-10-10 -- **WD-b2 (H19.46) changed two part keys this design defined** (`dev/design/unification/WIDE-DEVICES.md` section 5.1 and its WD-b2 record): a place declares its size's source -- its own `size(entity)`, or `sizedBy: 'parts'`, its kind's parts sizing it through a part's `sizes` -- and a grid names its `layout` and reads its `points(model)` from the open diagram.\
The anchor's place and both grids are the layouts plugin's (`layouts/layout-canvas.mjs`); the product's part keeps the anchor's drawing order and delete rank alone.
