# H26.8 -- native shapes: draw takes the four components' own shapes

The design of record for H26.8, which H26-16 aims at clean modular unification and sovereign boundaries, measured before and after by part.\
Draw stops translating between its own forms and the components': the editor reads `input-capture`'s facts, the tables are composed in `input-binding`'s own form, the canvas describes `vector-scene`'s shapes, the places carry `snap-grid`'s grids, and each adapter keeps only draw's policy and its wiring (H26-9).\
It builds on the four designs beside it (`SNAP-GRID.md`, `INPUT-BINDING.md`, `INPUT-CAPTURE.md`, `VECTOR-SCENE.md`) and on `RELEASES-0.2.md` sections 4 and 8, which left draw on `input-capture`, `input-binding` and `vector-scene` `0.2.0` and `snap-grid` `0.1.0`.

**Standing:** ratified as recommended, 2026-10-27 (`H26-17`), every decision NS1 to NS16 at its recommendation; revision 4, drafted 2026-10-27; reading 2's 39 findings tiered as H26-15 as amended rules -- each design-level finding settled here, each build-level one carried into appendix A's build checklist -- and the confirming reading's five folded (section 9); the code read is `bd6ca83`, whose product tree is production's `ca492da`; code lines measured by `tools/code-split.mjs`, browser behaviour in headless Chrome, the export's bytes and the drawing's attribute orders in Node.js on copies of the tree, the scripts and their outputs at `~/taceng/drawv2-eval-runs/h26-native-shapes/`; every figure after H26.8 an estimate with its basis; not ratified.

---

## 1. What this decides, and what it does not

It decides:
- what draw translates and holds twice today, with its code lines (section 2);
- the target part map, each native interface pinned, and what the scanners hold (section 3);
- seven moves, each with one guard, and the independent record the drawing moves answer to (section 4);
- the reveal's trace as a declared animation with its lifecycle, fixing B422 (section 5);
- the projection by part, and what the measure cannot show (section 6);
- the build checklist each move's builder satisfies and its verifier checks (appendix A), and the shape contract GR12 asserts (appendix B).

It does not decide:
- pan and zoom (H26.6), which it must not make harder: items, conversions and `itemAt` keep their meaning under a view (`VECTOR-SCENE.md` D6), and the movers alone stay foreign;
- extracting any component: general duties become declared parts, extracted when a second consumer is in sight (H26-10);
- the stored document's form (NS9), draw's configuration as data (B425) or a description for agents (B418), both restated (NS12);
- any behaviour change beyond those section 4 names, each ruled with this design.

---

## 2. What draw holds today

Read at `bd6ca83`.

### 2.1 Translations

| # | Adapter | What it converts | Where | Code lines |
|---|---|---|---|---|
| T1 | `input-capture`'s | a frozen fact into draw's mutable input event, the route by fact type, `claimed` and `capture` written back into the reply | `app/src/capture.js:73-87`, `:114-126` | 25 of 88 |
| T2 | `input-binding`'s | tenants' `rules` renamed `rows`, the answers renamed, a refusal re-worded into the old matcher's messages | `kernel/input-rules.mjs:66-111` | 39 of 55 |
| T3 | `vector-scene`'s | element-shaped shadow nodes described to the scene | `app/src/shadow.js` | 115 |
| T4 | `vector-scene`'s | the renderer's bookkeeping for the shadow: look applier, fragments, dirty marks, batching, puts by serial, `update` through finders, states re-applied to fresh elements, signatures, element lookups | `app/src/renderer.js:43-52`, `:162-172`, `:228-244`, `:273-310`, `:438-479`, `:504-512`, `:558-570` | 106 of 331 |
| T5 | `vector-scene`'s | each plugin's second statement of its look: `update` beside `create`, `look` with finders, `structure` | `plugins/network/link-painter.mjs:62-66`, `:87-139` (32); `plugins/devices/device-appearance.mjs:69-90`, `:103`, `:135` (23); `plugins/groups/group-painter.mjs:29`, `:43-49` (8); `plugins/zones/zone-painter.mjs:30`, `:47-49` (4); `plugins/network/anchor-appearance.mjs:54` (1) | 68: 51 declared, 17 logic |
| T6 | `vector-scene`'s | the reveal and the towers holding the renderer's elements | `plugins/simulation/reveal-painter.mjs:95-118`, `plugins/simulation/mover-painter.mjs:314-345` | 42 |
| T7 | `vector-scene`'s | a state of an id beneath the foreign layers, found by selector; the trace's settle | `app/src/compose-canvas.js:96-116`, `app/src/painter.js:44` | 15 |
| T8 | `snap-grid`'s | a place's extent cross-checked against its grid; the stored layout record into a declaration | `app/src/snap.js:124-128` (5); `kernel/geometry.mjs:25-36` (12, kept) | 17 |

So 427 code lines, 3.0% of draw's 14,049, translate; H26.8 deletes or rewrites each range but T8's 12.\
Examined and no translation: `nameLabel` (`kernel/renderer.mjs:33-36`) is rewritten to answer shapes; the probe (`app/src/painter.js:38-43`) measures, and stays.

### 2.2 Mechanisms held twice

| # | Held twice | Where | Code lines | After H26.8 |
|---|---|---|---|---|
| X1 | keyed drawing: the network's own map of pipe elements and a hook for the renderer's states | `plugins/network/host.mjs:58-93`; `app/src/compose-canvas.js:96-116` | 49 | the pipes a painted kind (NS3) |
| X2 | what is under the pointer: picks by selector beside the scene's `itemOf` | `app/src/pick.js:32-83`, `:123-125`; `app/src/capture.js:52-67`; each plugin's `picks`, `drawn`, `runTargets` | 60 | picks by item (NS6) |
| X3 | an item's look, built by `create` and again by `update` | T4, T5 | -- | one description, diffed by the scene |
| X4 | marks and aim written onto elements another part drew | T6 | -- | marks the owning part declares (NS5) |
| X5 | state classes: the renderer's, the network's `selected`, the foreign hook's | `app/src/renderer.js:312-331`, `:558-570`; `plugins/network/host.mjs:87` | -- | `editing-states.js` (NS13) |
| X6 | a place's extent beside its grid's bounds | T8 | 5 | the grid alone |
| X7 | the export's bounds re-derived from the description | `server/svg.mjs:91-117` | 26 | kept (registered, section 7) |
| X8 | the palette's tiles beside the stamp ghost's shapes | `app/src/painter.js:48-54` | 7 | kept, outside the canvas |

The shared paint loop (`plugins/simulation/paintloop.mjs`, 19) is one module already, the reveal's and the movers' (NS14).

### 2.3 Parts whose duty is mixed

| Part | Code lines | What is mixed | Target |
|---|---|---|---|
| `canvas` | 2,182 | the label editor (141, B416), the help and its labels (102, B417, imported by `app/src/main.js` alone), grid drawing (20, B415) | three declared parts (NS8) |
| `canvas`, `GESTURES` | 171 | eight bodies taking the whole Input; the five generic ones, 101 lines, reach 20 of its members and four helpers of `app/src/snap.js` and `app/src/editing-visuals.js` | the five in `editing` behind a host (NS7) |
| `renderer` | 479 | composition, states, the shadow, DOM helpers for foreign layers and the help panel | composition and description |
| `network`'s `host.mjs` | 93 | a pipe drawer beside the renderer (35) | a pipe painter (4.6) |
| `simulation` | 42 of 572 | the reveal and the towers reaching into the renderer's elements | declared marks |
| `primitives` | 28 | `nameLabel` taking the element builder | answers shapes |

### 2.4 What holds behaviour today, and what of it is independent

The copies (`tests/fixtures/pre-scene/`, `tests/fixtures/pre-export/`, `tests/fixtures/pre-binding/`) are not independent of the painters: `tests/fixtures/scene-parity.mjs:40-60` runs the live composition on both sides (o:F2).\
The records -- the gesture corpus (`tests/fixtures/gesture-corpus.json`), the editing trees (`tests/fixtures/scene-parity-record.json`), the binding lifecycle and help records, the K8 DOM (`tests/fixtures/k8-dom.json`) -- and the pixel probe against production are; section 4.2 adds the record the drawing moves need.

---

## 3. The target

### 3.1 The part map

| Part | Duty | Modules after H26.8 | Consumes | Speaks | H26-10 |
|---|---|---|---|---|---|
| `lattice` | Compute geometry on the grid | as today | -- | `snap-grid` | -- |
| `rules` | Declare what an input means | `kernel/input-rules.mjs`: the declaration, `openTable`, `openGestures` | -- | `input-binding` | -- |
| `canvas` | Turn input into edits | as today but the modules below leave | `editing`, `grids`, `label-editor` beside today's | `input-capture` | -- |
| `editing` | Let a person select, move and resize | today's three, `editing-gestures.js` and `editing-states.js`, new in `app/src/` | `document` | `vector-scene`'s items, the scene handed as a value | B389 |
| `renderer` | Describe a document through the parts' shapes | `app/src/renderer.js`, `app/src/painter.js` | as today; handed the states | `vector-scene` | -- |
| `grids` | Draw the grids places snap to | `app/src/grids.js` | -- | `vector-scene`'s items | B415 |
| `label-editor` | Edit a drawn label in place | `app/src/labeledit.js` | `document`, `kind-contract` | `vector-scene`'s `toScreen`; its regions' boxes by the one exception (3.2) | B416 |
| `help` | Show what each input does | `app/src/help.js`, `app/src/actions.js` | -- | `input-binding`'s rows | B417 |
| plugins | as today | as today, the network gaining `pipe-painter.mjs` | as today | shapes, declared marks, rows in `input-binding`'s form | -- |

`help` is consumed by `product-page`, as today; Input is handed the panel.\
Under H26.6 a view carries every layer, picks are by item, and a culled entity is one removal.

### 3.2 The native interfaces

**A painter:** `{ kind, layer, stacked, picks, run?, shapes(entity, kit) -> parts | null, redraws?, modal?, dependsOn?, shared?, touches? }`.
- `parts` is an ordered list of `[part, shape]`, each `vector-scene`'s shape; `''` is the entity's own item, keyed by its id, any other a companion keyed `<id>/<part>` -- a link answers `''`, `head`, `leg`, `hit`.
- `modal` asks a description on each mode change; `dependsOn`, `shared` and `touches` state what else invalidates the kind (rule P, 4.6).
- **The kit, exactly:** `{ model, mode, renderOpts(), sizeOf(kind, entity), outlineOf(kind, entity), pillWidth, shared }`, `shared` present only for a painter declaring it (GR3).

**An appearance:** `parts: { [layer]: (entity, kit, state) -> shapes }`, with `state`, `composes`, `root`, `rootAttrs`, `addClass`, `selectBox` and `redraws` as today; `look` and `structure` go.

**The shape contract** (o:F1, a:F5, a:F6): each part in today's order, each shape's attributes in today's fresh-draw order, a conditional attribute at its place when present.\
The contract is the record (4.2) -- whose documents reach every conditional branch of today's drawing code, by line coverage -- and appendix B its summary, measured over the 18 stored documents and coverage boards in three modes; GR12 asserts every item against the record.

**The renderer** describes and puts each entity whole:
1. a change of the entity, or one a `redraws`, `dependsOn` or `modal` names, describes it -- the painter's parts or the composed `<g>` -- and keeps the description;
2. the states and marks are applied to a copy, and each part put under its key, placed as `putOf` places today (`app/src/renderer.js:293-310`);
3. a part no longer answered is removed; an entity no longer drawn has every key removed and its marks dropped;
4. a state or mark changed re-applies them to the kept description and puts it, no painter called -- a state- or mark-only put.

`renderer.ownShapeOf(id)` answers the own shape as last described, data; `renderer.drawerOf(id)` the painter or winning appearance that drew it; the renderer answers no element (GR8).

**States** (NS13, a:F2): `editing-states.js` holds them -- `setState(id, cls, on)`, `clearState(id, ...classes)`, `reflect(selected)` (the selection and the parts' `reflects`), `classesOf(id)` in the order set, `onChange(fn)`.
- The composition makes it and hands it to the renderer, Input, the overlay and the network's settle.
- **The state target** (reading 3, o:F1) is the shape bearing the entity's id within its own item, at any depth: the item's root for a zone, group, link, waypoint and device, and a pipe's line, path `[0]` beneath its group, where today's network writes `selected` (`plugins/network/host.mjs:87`) and `.pipe.selected` matches; a companion bears no id and carries no state, its look following the sibling rules as today (measured over the 18 documents, `pipe-state-target.mjs`).
- The target's class is its class in the description -- the painter's, or the winner's `root.class` then each composer's `addClass` in the composition's order (`app/src/renderer.js:521`) -- then `classesOf(id)`; a state-only put writes only there, Appendix B's group structure kept.
- On a load: Input drops hover and arming as today (`app/src/input.js:568-574`); `selected` and the reflections follow NS13's ruling.

Each state and mark is held by the part that sets it; where today's lifetime differs, NS13 rules:

| State or mark | Set and cleared by | Today | After H26.8 |
|---|---|---|---|
| `selected`, `on-selected-path` | the selection; the network's reflections | re-applied to a fresh element, first; **lost on a load though the selection survives** (measured, `load-selection.mjs`) | shown while selected, a load included (NS13) |
| `blocking` | the network's reflections | re-applied by the next reflection, which every model change runs | unchanged in sight |
| `hover`, the idle ring | the overlay; Input on deletion, load, Shift's release | lost on a fresh element -- a mode change, a structural change, a remote edit -- the overlay still holding it | kept while held (NS13) |
| `armed`, `armed-clone`; a link end's drag state | the overlay; the handle gesture | lost on a fresh element | kept while held (NS13) |
| class token order | -- | as set, but a fresh element re-sets `selected` and kept reflections first | as set (NS13); no rule reads it |
| `unrevealed` | the reveal, each pass | lost on a fresh element -- **every mode change, each way**, and a structural change -- until its next pass re-marks it (measured, `mark-lifetimes.mjs`) | kept through both (NS13); dropped with the entity and on a load and re-marked by the next pass, as today |
| `trace` | the reveal | lost on a fresh element | kept, its animation running on (section 5) |
| `aim` | the movers, each frame | lost on a fresh element; on a restore by undo and on a load, the movers' next frame aims it again (measured); cleared by leaving run mode | dropped with the entity and on a load and re-set by the movers' next frame, and cleared on leaving run mode, as today; kept through a node redrawn in run mode (NS13) |

**Marks** (NS5): a canvas part declares `marks: { [name]: (parts, value) -> parts }`; `renderer.mark(id, name, value | null)` puts the entity only when the value differs from the one it holds, so an owner sets its mark on every pass -- the reveal hides each withheld id each pass, the movers aim each tower each frame -- and a mark dropped with its entity or by a load is set again on the owner's next pass, as today.\
The simulation declares three in `SIMULATION_CANVAS` (`plugins/simulation/spawn-appearance.mjs`): `unrevealed` -- `data-unrevealed=""` on the state target; `trace` `{ run, len, ms }` -- `data-trace` and `style` on the state target, a link's line (section 5); `aim` (degrees) -- `data-aim` then `transform` on the shape holding `data-layer="glyph"` beneath it.\
No painter or appearance reads a mark; the export holds none.

**Picks** (NS6): `{ word, modifier?, button?, idle?, clones?, mark?, parts?, on? }` on a painter or appearance.
- `parts` names the entity's items that answer, all when absent; `on` names an attribute the shape at the path must carry -- a pipe is one item, its group holding line and hit line, and only `on: 'data-select'`, which a hand pipe's hit line alone carries, answers.
- **A mark pick keeps today's mark** (reading 3, o:F2): `{ mark: true, on, parts? }` names no word; its hit is `{ kind: kindOf(id), id, mark: true }`, as `data-select` answers today; and `hitFactsOf` (`app/src/recognize.js:64-71`) takes no mark pick, as it takes no handle, so the press rows, the overlay's facts and the generated help see a mark only through `hit.mark`, the locked fallback included -- measured on a copy of the tree, every one of 64 presses on a hand pipe's mark (each button and modifier, locked or not, a tool held or not) and every help line as today, where the pipe taken as a drawn word changes 8 locked presses and adds two help lines (`pipe-mark-recognition.mjs`).
- `picksOf(parts)` validates, refusing `closest` and `self` and a word on a mark pick, and answers one pick per drawer, no order (GR4).
- `hitWith(picks, { scene, drawerOf })` answers `(evt) -> { kind, id, handle?, mark? }`: `scene.itemOf(evt.target)`; an editing handle answers by the `data-` key its declaration names; a key `<id>` or `<id>/<part>` answers its drawer's pick when `parts` and `on` admit the shape, with its modifier held or none declared, else the canvas (U1); anything else is the canvas.
- `button` stays, read by `app/src/recognize.js:71`: Shift+left and Ctrl+Shift+left over a zone still draw one (o:F4).
- **Precedence** (a:F11): an element is one item, so which drawer answers is which item the platform's hit test finds -- the layers' order, `CANVAS_LAYERS` putting zones beneath every other drawn layer; a device over a zone answers the device, as today's backdrop ordering did, and a zone answers only where nothing above it is hit; proved by the picks move's point grid.

**Run regions** (o:F5, o:F9): a drawer declares `run: { entity?: parts, target?: true }`; `regionWith({ scene, drawerOf })` answers today's seven fields:

| Field | Today (`app/src/capture.js:52-67`) | Natively |
|---|---|---|
| `target`, `overTarget` | the closest `.waypoint` | the item's entity and `true` when its drawer declares `target` (the anchor appearance) |
| `action`, `input`, `control` | the closest `[data-action],[data-input]` | the deepest shape on the path holding either, read as today |
| `owner` | that control's closest drawn element, `null` with no control | `null` unless a control was found; then the item's entity when its drawer declares the item's part `entity` |
| `entity` | the closest `.zone`, `.link`, `.group`, `.node` | the item's part among its drawer's `entity` parts: every part of a zone, group or device; a link's `''` alone; none for a waypoint, a pipe or an editing item |

**Facts** (a:F16, a:F17): Input's entry points take `(fact, reply)`; `fact` is input-capture's, frozen, never written.

| Draw's input event today | Natively |
|---|---|
| `on`, present on every pointer event but `leave` | `fact.hit`, draw's answer on every pointer fact, `null` on key and `blur` facts -- present exactly where `on` was |
| `region`, on a `down` | `fact.hit.region` on a `down`, else `null`; a reader of `e.region?.x` reads `e.hit?.region?.x` |
| `onControl`, on a `key-down` | `fact.focus.onControl` on a `key-down`, `focus` `null` otherwise |
| `claimed`, `capture`, written | `reply.claim()`, `reply.takePointer()`, asked at once (IC8) |
| `trigger`, written by the release (`app/src/input.js:1116`) | the session's outcome, handed to `commit`; nothing written on the fact |

Rows test `type` before `hit` or `focus`, as they test it before `on` today; `app/src/help.js`'s `eventsFor` builds facts' `hit`.

**Tables:** `openTable(...tenants)` composes `{ owner, rows }`; call sites read `table.matchInput(fact, context, guards).match?.row`; the gate asks `table.findOverlaps`.

**The editing gestures** (NS7, a:F14, a:F15, o:F5): `EDITING_GESTURES` in `editing-gestures.js` -- `move`, `clone`, `pending`, `clone-pending`, `handle`, `marquee`, with `MARQUEE`'s preview declaration -- each phase:
- `start(host, hit, pos, evt, rule) -> ctx`, Input keeping the answer as the gesture's;
- `update(host, ctx, pos, evt)`, `ctx` Input's current one;
- `commit(host, ctx, pos, evt, outcome)`, `outcome` the session's, holding `trigger`;
- `cancel(host, ctx)`.

Input owns `ctx`, and which context a verb acts on follows the phase that calls it (reading 3, o:F3):
- the verbs of `start` and `update` act on Input's current `ctx`: `press` answers the `ctx` it opens; `escalate` may replace Input's `ctx` and mode (`startMove`, `startClone`), after which the calling body uses its `ctx` no more; `drag` and `retarget` read and write the current one, as Input itself calls `drag` from its Shift handlers;
- the verbs of `commit` and `cancel` take the phase's context as their argument -- `endRetarget(ctx)`, `act(rule, ctx)`, `commitMove(ctx, ...)`, `commitClone(ctx, ...)` -- since Input saves the gesture's `ctx` and replaces its own with `{}` before a commit (`app/src/input.js:1134-1135`) and after a cancel (`:1328-1330`); none reads Input's current one.

`link` and `box` stay in `app/src/input.js`, dispatched with the same phases, Input their subject in place of the host.\
The host, a frozen object Input makes, holds exactly:

| The host's | For today's | Answered by |
|---|---|---|
| `model`, `selection`, `scene` | `i.model`, `i.selection`, `i.scene` | the same values |
| `hideCrosshair()`, `showHandles()` | `i.overlayUi.crosshair.hide()`, `i.overlayUi.handles()` | the overlay |
| `showBox(patch)`, `showLink(from, to)` | `i.readout.setBox`, `i.readout.setLink` | the readout |
| `setState(id, cls, on)` | `i.renderer.setState` | `editing-states.js` |
| `factsOf(word)`, `handleOf(word)`, `holding()` | `i.hitFacts.get`, `i.handleWords.get`, `i.tools.hand` | Input's tables and tools |
| `anchorAt(pos, targets)`, `decide(table, evt, facts)`, `act(rule, ctx)` | the same | Input |
| `press(hit, pos, shift)`, `escalate(pos, evt, table, facts, become)`, `drag(pos, shiftHeld)`, `retarget(target, excludeId)` | `i.beginPress`, `i.escalate`, `i.updateMove`, `i.retarget` | Input, over its current `ctx`, session and places |
| `endRetarget(ctx)`, `commitMove(ctx, pos, ortho)`, `commitClone(ctx, pos, ortho)` | `i.endRetarget`, `i.commitMove`, `i.commitClone` | Input, over the context it is handed |
| `cellName(pos)`, `boxOf(p1, p2)` | `snapNode`, `resolveBox` from `app/src/snap.js` | Input, injecting draw's geometry |

GR13 runs every phase of every body with a host alone, each verb's context as its phase holds it -- a commit's and a cancel's host holding a current `ctx` of `{}`, so a verb reading it fails -- and checks that `editing-gestures.js` reads nothing but its parameters and its part's imports; the corpus drives every body through Input.

**The help panel:** Input is handed `{ shown(), show(on) }` by the page; `isShown` and `setShown` leave `app/src/painter.js` for `app/src/main.js`.

**The label editor's one exception** (NS8): it places a native input at the platform's box for a drawn region, keeping five reads of elements the scene made -- two lookups by id, two region finds beneath them (`app/src/labeledit.js:117-123`), one box (`:133`) -- and writing none; it is handed `edits: { setFields, rename }` where it imported `app/src/commands.js`.

**A place carries its grid alone:** `{ kind, layout, grid, size | sizedBy }`, its extent the grid's `bounds`; `Grids({ scene, grids, model })` is handed `gridsOf(parts)` by the composition.

### 3.3 What the scanners hold

- `tools/layers.mjs`: `editing` gains its two modules; `renderer` loses `app/src/shadow.js`; `canvas` loses four modules and consumes `grids` and `label-editor`; `product-page` consumes `help`; `grids`, `label-editor` and `help` added, `kind: 'host'`, `by: ['H26-10', 'H26-16']`; L4's two verbatim entries go with their copies; `ALLOWED` unchanged; each move edits its own rows (appendix A).
- `tools/generate-architecture.mjs` fails an import outside each `consumes`, so the edges run one way: `canvas` to `grids` and `label-editor`, `product-page` to `help`.
- `docs/ARCHITECTURE-TARGET.md` section 2 cites H26-9 and H26-16 before any `by` names them.

**GR8, the scene-read boundary** (o:F10, a:F20, a:F21): no module of `canvas`, `editing`, `renderer`, `grids`, `label-editor`, `help` or a plugin holds an element the scene made, but `app/src/capture.js` and the label editor.\
It is held three ways, and its limit stated:
1. none is handed one: the renderer answers data only (a test calls its members over a drawn board), the foreign hook is deleted, and input-capture's facts hold no target (its IC);
2. none finds one: `tools/scan-writers.mjs`, in the gate, counts by file every spelling that reaches an element from another -- `getElementById(`, `querySelector(`, `querySelectorAll(`, `.closest(`, `elementFromPoint(`, `elementsFromPoint(`, `layerElement(`, `addEventListener(`, `.parentNode`, `.parentElement`, `.childNodes`, `.children`, `.firstChild`, `.firstElementChild`, `.lastChild`, `.lastElementChild`, `.nextSibling`, `.previousSibling`, `.nextElementSibling`, `.previousElementSibling` -- so a new path fails until reviewed;
3. an event's target reaches only capture's `hit`, `focus` and menu.

Its limit: a counted spelling's reads are review's, and `.children` is also a word of the descriptions, counted where the renderer reads them.\
The counts, by move:

| File | Painters (the rule added) | Pipes | Picks, and after |
|---|---:|---:|---:|
| `app/src/capture.js` | 7 | 7 | 3 |
| `app/src/compose-canvas.js` | 2 | 0 | 0 |
| `app/src/pick.js` | 1 | 1 | 0 |
| `app/src/labeledit.js` | 10 (its 4 lookups, 6 listeners on its own input) | 10 | 10 |
| `app/src/readout.js` | 1 (a listener on its own element) | 1 | 1 |
| `app/src/painter.js` | 2 (a preview's `children`) | 2 | 2 |
| `app/src/renderer.js` | its description reads, counted at the move | = | = |

---

## 4. The moves

### 4.1 The order, and each move's guard (NS1)

| # | Move | What it does | Its guard |
|---|---|---|---|
| 1 | `binding` | the tables in `input-binding`'s form | the lifecycle and help records byte-identical; the corpus |
| -- | the record | written from `ca492da`, committed alone (4.2) | its coverage (4.2) |
| 2 | `trace` | B422 fixed on today's renderer (section 5) | section 5's Chrome test, unpaused; the export's bytes; the record's reveal steps under the trace rule |
| 3 | `painters` | painters answer shapes; states and marks described; the shadow deleted; picks and pipes as today | the record (4.2); the export's bytes; the K8 DOM; the corpus's editing trees; the pixel probe; GR2, GR3, GR8, GR12 |
| 4 | `pipes` | the pipes a painted kind under rule P (4.6) | the record over every pipe trigger, its describe counts as rule P names; no put on load patching or moving an item |
| 5 | `picks` | picks by item, run regions, the harness drawing through the renderer (4.7) | the drafting comparison; the corpus through the migrated harness |
| 6 | `capture` | facts whole; the bodies to `editing`; `label-editor` and `help` declared | the corpus byte-identical; the lifecycle record; GR13 |
| 7 | `grid` | places carry their grid alone; `grids` declared | the corpus; the grid parity record |

The trace lands before the painters because it is the one visible change, and because today's trace forces a layout no description can; the painters before pipes and picks because both read keys and descriptions; pipes before picks so a hand pipe's hit line is an item; picks before capture so the harness moves once.\
If the pipes move's guard fails, the network keeps its drawer (NS3 b) and the picks move reads a hand pipe's `data-select` from the target.\
Each move is built by an agent that did not draft it, verified independently as H26-15 rules, and measured by `node tools/code-split.mjs --parts`.

### 4.2 The record the drawing moves answer to (o:F2, a:F1, o:F6, x:F1)

**From what code:** `native-record.mjs`, new in `tests/fixtures/`, drives only calls `ca492da` answers, through a two-line adapter for the calls whose owner moves (a state set on the renderer at `ca492da`, on `editing-states.js` after).\
Its record, `native-record.json`, is written by running it against an archive of `ca492da` outside the repository, committed with it alone before the trace move, and never regenerated: a move's expectations are the record and the allowed differences below, never its own output.\
It runs the page's composition in Node as `tests/fixtures/scene-parity.mjs`'s page side does -- model, network session attached as the page attaches it, the network's host hooks, selection, renderer, reveal and movers at fixed clock instants, a deterministic path length -- and reads only `scene.items` and, for a foreign layer, its content.

**What it records:**

| Group | Scenarios | Recorded after each step |
|---|---|---|
| Loads | the 18 stored documents and coverage boards -- closed directed rings forward and reverse, data and control; transit off on a device and a waypoint; a panel with glyph, action, input and outlined regions; a span without content; headed links up and down; hand and link pipes -- each in view, edit and run | each layer's trees, attributes in order; each load's put kinds; the export's bytes |
| Pipe triggers, alone | a hand pipe made, laid again by a link, deleted; its endpoint moved, no link changed; an up link made over it, and deleted; a link rerouted onto it; another pipe opening a route, and swept; a transit off and on; a load; an answer accepted with links listed before pipes; refused; a board seeded; a drag judged with no commit; run mode and back; the pipe selected, hovered, armed | the trees; each pipe's descriptions per step, compared from the pipes move |
| Pipe triggers, combined | one commit moving an endpoint, making a link and sweeping a pipe; a mode change with a pipe hovered and selected; a load with a pipe selected | the same |
| States (NS13) | each of `hover`, the idle ring, `armed`, `armed-clone`, a link end's drag state, `selected`, `on-selected-path`, `blocking`, held across a structural change of its entity, a mode change each way, deletion and undo, and a load | the entity's class |
| Marks (NS13) | `unrevealed` and `trace` across a structural change, a mode change each way, deletion and undo, and a load; `aim` across a node redrawn in run mode, deletion and undo, a load, and leaving run mode | the entity's attributes before each boundary, at it, and after the owner's next pass or frame |
| A healed link (NS16) | a down link without a head gaining a route by a pipe made, then losing it | the link's line and its twin |
| Transient targets | a selected zone's corners, a selected link's ends, a held hand's stamp ghost, the crosshair and the datum | the editing items, by layer, for the picks comparison |

**Its coverage:** while it records, every line of `ca492da`'s painters, appearances, `nameLabel`, renderer, pipe drawer, reveal and movers that makes a shape or writes an attribute is reached, measured by Node's coverage; the comparator fails any scenario it did not reach.

**What a move may differ in, and nothing else:**

| Move | Allowed | Compared |
|---|---|---|
| trace | a traced line's `style` and `data-trace`: today's inline dash at a step is, after, the trace's attributes during `[show, show + ms)` and none after, by rule from the recorded length and duration | the reveal steps |
| painters | attribute order on an element kept across a patch; class token order and the lifetimes NS13 rules, each asserted by its own test; a healed link's twin without the `stroke-linecap` today's update leaves on it (NS16); element identity, unrecorded | the steps as maps, token sets for classes; a load and the export in order |
| pipes | a pipe's states through a repaint (NS13); each pipe described only as rule P names | the pipes layer and the describe counts |
| picks, capture, grid | nothing in the record | their own guards (4.1) |

The copies go when nothing rests on them (NS10): `tests/fixtures/pre-binding/` at the binding move; `tests/fixtures/scene-trace-side.mjs` at the trace move; `tests/fixtures/pre-scene/` and `tests/fixtures/pre-export/` at the painters move, once the record passes and each assertion of the tests running them has a named replacement.

### 4.3 `input-binding`

| | |
|---|---|
| Changes | `openTable` in `kernel/input-rules.mjs`; Input's tables and `plugins/network/grammar.mjs:75-79` composed through it; `resolveInput(...).rule` read as `matchInput(...).match?.row`, `overlapsIn` as `findOverlaps` |
| Deleted | `composeRules`, `resolveInput`, `overlapsIn` and the refusal's re-wording (`kernel/input-rules.mjs:66-111`); `tests/fixtures/pre-binding/` |
| Behaviour changes | a refused declaration, which none of draw's is, throws the component's problems (NS11) |

### 4.4 The trace

| | |
|---|---|
| Changes | the reveal's show and lifecycle (section 5); the trace declared in `plugins/simulation/simulation.css`; `server/svg-style.mjs`'s temporal rules (section 5) |
| Deleted | the forced layout and inline transition (`plugins/simulation/reveal-painter.mjs:102-109`); `settleOf` and the shadow's settle; `tests/fixtures/scene-trace-side.mjs` |
| Behaviour changes | B422 fixed (NS4) |

### 4.5 The painters

| | |
|---|---|
| Changes | painters and appearances answer shapes; `nameLabel` answers two; the renderer describes and puts by part with `editing-states.js`'s states and the simulation's marks; the reveal and towers mark |
| Deleted | `app/src/shadow.js`; T4; T5; `byId`, `glyphOf`, the towers' glyph cache; the copies, as 4.2 says |
| Behaviour changes | NS13's lifetimes, as ruled |

### 4.6 The pipes, under rule P (NS3, a:F3, o:F4, o:F7, x:F2)

| | |
|---|---|
| Changes | `pipe-painter.mjs`, new in `plugins/network/`: the group, line and hit line in today's structure and order, `null` in run mode or with an end gone, `modal`; `dependsOn: ['node', 'link']`; `shared`: `occupiedOf(model)`, new in `plugins/network/network-queries.mjs`, the set of pipes an up link runs over, frozen and identical while the network's derivation is the cached one, empty with no network; `touches(pipe, changed)`: `changed` is a node the pipe names; `FOREIGN_LAYERS` the movers' alone, `CANVAS_LAYERS` naming `pipes` |
| Deleted | the network's pipe map and `paint` (`plugins/network/host.mjs:58-93`), its `model.onChange(paint)` and `watchMode(paint)`, and the pipe repaint in its settle, which keeps the links' redraw and the reflection; `foreignStates` |
| Behaviour changes | a pipe's `hover` and `armed` kept through a repaint (NS13) |

**Rule P, the renderer's one schedule:**
1. A load describes every pipe once, in `syncAll`, and nothing more: no put on load patches or moves an item.
2. A change of a pipe, a link or a node asks `shared` once in that call; if it differs from the last, every pipe is described once, the changed one among them; if not, the changed pipe and those `touches` names are.
3. A mode change describes every pipe once (`modal`).
4. A selection, hover or arming is a state-only put.
5. No other subscriber draws a pipe; nothing else describes one.

It is sound because a pipe's drawing reads its ends, its `laid`, `under` and its states, and the derivation's key holds every input of routing -- pipes, links, ranks and transit stops, never a position (`plugins/network/view.mjs:47-55`) -- so an unchanged derivation leaves every `under` as it was, and a node moved changes only the pipes ending at it.\
Its cost per change is one derivation lookup, as today's `paint` makes on every change, and only the affected pipes' descriptions, where `paint` reconciles every pipe; a drag describes only the dragged node's pipes.

### 4.7 The picks, and the harness that proves them (a:F9, a:F10, o:F3)

| | |
|---|---|
| Changes | picks, `hitWith` and `regionWith` as 3.2 states them, in `app/src/pick.js`; each part's `picks`, `drawn` and `runTargets` restated as `picks` and `run` |
| Deleted | the selector walk (`app/src/pick.js:53-83`), `regionsOf`, `regionOf` (`app/src/capture.js:52-67`) |
| Behaviour changes | none |

**The drafting comparison**, outside the repository and kept with the move's evidence: in Chrome, for every element of every record document's page and a grid of points over it, in each mode, with each modifier and button and with the record's transient targets present, today's hit and region against the new, every field equal.

**The harness draws** (measured, `harness-renderer.mjs`): `makeInput` builds the real renderer and `editing-states.js` over its model and scene with the product's parts, its recorded observations kept by forwarding spies; with it every stub element the scene made is answered by `itemOf`, a run mode drawn by `setMode`.\
A test's target is `targetOf(h, on)`, new in `tests/fixtures/client-harness.mjs`, which finds the element the scene made for a key and path and throws when there is none; no fake `itemOf` reads a stub.\
A test whose target the scene does not draw is restated to its intent: an entity it presses on is seeded; a press proving that a part filtered out leaves open ground presses where the part would draw; the backdrop test is restated as precedence (3.2).\
One record changes, named: the corpus's `run-mode-action` presses a `data-action` control on no entity, which no page draws; restated over a panel the board gains, its recorded `host` event names the panel's id where it named none, and its final document holds the panel (NS15).

### 4.8 `input-capture`

| | |
|---|---|
| Changes | `deliver` hands Input the fact and reply; rows read `hit` and `focus`; claims through the reply; the outcome handed to `commit`; the five bodies to `editing-gestures.js` behind the host; the help panel and the label editor's edits handed; `label-editor` and `help` declared |
| Deleted | T1; draw's input event as a type; the five bodies from `app/src/input.js`; `isShown` and `setShown` from `app/src/painter.js` |
| Behaviour changes | none (IC8) |

### 4.9 `snap-grid`

| | |
|---|---|
| Changes | the anchor's and zone's places carry their grid alone; `clampDelta` reads its bounds; `Grids` handed its grids; `grids` declared |
| Deleted | `ext` on each place and its check (`app/src/snap.js:124-128`) |
| Behaviour changes | none |

---

## 5. The reveal's trace, a declared animation (B422)

**Today** (`plugins/simulation/reveal-painter.mjs:95-118`): an inline dash and offset written, a layout forced, a transition armed; the dash never taken away, so a control or down link revealed is drawn solid ever after, and a longer route shows a gap.

**Declared** (NS4):
1. On a link's show the reveal reads the line's `d` -- through `byId` at the trace move, `ownShapeOf` from the painters move -- measures it with draw's probe, computes `ms` by `traceOf` as today, and takes `run`, the other of `a` and `b` from the one this line last took.
2. The line carries `data-trace="<run>"` and `style="--trace-len: <len>; --trace-ms: <ms>ms"`.
3. The stylesheet: `[data-trace] { animation-duration: var(--trace-ms); animation-timing-function: ease-out; animation-fill-mode: both }`, `[data-trace="a"]` and `[data-trace="b"]` naming two identical keyframes that hold `stroke-dasharray` at `var(--trace-len)` and take `stroke-dashoffset` from it to `0`.
4. At `show + ms` by the reveal's clock the attribute and style go, the line its own dash again.

**Its lifecycle**, the reveal its one owner:

| Event | What happens |
|---|---|
| a pass of the loop | ends every trace past its instant; re-reads each active trace's length, writing it if changed; then today's pass |
| the loop | runs while the reveal holds a record or an active trace |
| the record gone | `showAll` shows every withheld entity, links tracing as today; the loop runs until those end |
| a hide | ends the line's trace and marks it `unrevealed`; the next show takes the other name, so a hide and a show in one task restart it |
| the entity removed; a load | its trace and marks dropped; the reveal's entry ends on its instant, writing nothing; a load's `sync` re-marks what the new record withholds |
| a route changed mid-trace | the length re-read in the same task on a model change, or on the next pass when the network's settle redraws a link; the animation keeps its time and draws the same fraction of the new line |
| the line described again, the trace unchanged | nothing written; the animation runs on |
| the 100 ms tick | `hide` writes nothing while its mark stands |

**The export keeps its bytes** (a:F8, o:F8, x:F4): `server/svg-style.mjs` refuses any at-rule (`:70`) and parses `plugins/simulation/simulation.css`, so it is taught one temporal rule, safely:
- comments are stripped first, as today;
- only `@keyframes <ident> {` is taken -- a vendor variant, a nameless block and every other at-rule stay for today's refusal;
- braces are counted outside strings, a string's escapes honoured, and an unterminated block or string is refused, naming the sheet;
- `animation`, `animation-name`, `animation-duration`, `animation-timing-function`, `animation-fill-mode`, `animation-delay`, `animation-iteration-count`, `animation-direction` and `animation-play-state` join `INTERACTIVE`, beside `transition`, left out as acting over time.

Measured on a patched copy (`export-keyframes-v2.mjs`, 28 code lines): all 18 documents export byte for byte as today; a quoted, an escaped and a single-quoted brace each keep the rule after the block; two blocks around rules keep all three rules; an unterminated block and an unterminated string are refused; a traced line's drawn style holds no animation property.

**Measured in Chrome** (`trace-declared-a.mjs`, `trace-measured-all.mjs`, `trace-lifecycle.mjs`, `trace-restart.mjs`): during the trace, pixel-identical to today's at seven fractions over four cases and at three over ten; after it, equal to an untraced line where today's differs by 1,371 to 2,673 pixels; the name alternated restarts it, the same name does not; re-written mid-run it runs on; rerouted mid-run it keeps its time and fraction; `pathLength="1"` differs on every curve.

**Proved at the move** by `tests/vector-scene-trace.test.js` restated: the sampled cases against a reference drawn by today's technique, and the real reveal and loop, unpaused, through each event of the lifecycle table.

---

## 6. Before and after, by part

The declarative share is the code lines of top-level tables over all code lines; logic is the rest (`tools/code-split.mjs --parts`).\
Baseline: `dev/CODE-SPLIT.md` at `ca492da`; after: estimates from each range deleted or moved, as measured, and each addition, estimated; a plugin's `shapes` sit in its table, so they count declared, and T5's deletions are 51 declared and 17 logic lines (measured).

| Part | Lines | Share | Logic | After (est.) | Share | Logic | Basis |
|---|---:|---:|---:|---:|---:|---:|---|
| `lattice` | 156 | 14.1% | 134 | = | = | = | T8's 12 kept |
| `kind-contract`, `document`, `relations`, `colours`, `planner` | 1,198 | -- | 1,082 | = | = | = | untouched |
| `primitives` | 28 | 0.0% | 28 | = | = | = | `nameLabel` in as many lines |
| `rules` | 55 | 18.2% | 45 | 20 | 50% | 10 | T2 deleted; `openTable` 4 |
| `layouts` | 69 | 52.2% | 33 | = | = | = | a key dropped |
| `devices` | 552 | 52.5% | 262 | 534 | 53.6% | 248 | T5's 9 declared and 14 logic deleted; shapes, 5 declared |
| `network` | 1,719 | 21.3% | 1,353 | 1,687 | 21.6% | 1,323 | T5's 33 deleted (30 declared or data, 3 logic); the drawer's 35 logic for a painter of about 28 declared and `occupiedOf`, 8 logic |
| `zones` | 171 | 63.7% | 62 | 165 | 62.4% | 62 | create, update and look, 16 declared, for shapes of about 10 |
| `groups` | 169 | 66.3% | 57 | 160 | 64.4% | 57 | likewise, 17 for about 8 |
| `simulation` | 572 | 14.2% | 491 | 572 | 15.9% | 481 | T6's 42 logic for marks of about 22; the lifecycle, 10; three marks declared, 10 |
| `product` | 73 | 35.6% | 47 | = | = | = | `FOREIGN_LAYERS` edited |
| `canvas` | 2,182 | 13.3% | 1,892 | 1,798 | 7.9% | 1,657 | T1, the selector picks, the place check and `foreignStates` (55) deleted; the five bodies (101 declared) and `MARQUEE` (1) to `editing`; three parts out (263); the host, `deliver` and hand-offs (36) added |
| `editing` | 179 | 1.1% | 177 | 310 | 33.5% | 206 | the five bodies; `MARQUEE`; `editing-states.js`, the reflections' 17 and 12 more |
| `renderer` | 479 | 0.6% | 476 | 293 | 1.0% | 290 | T3, T4, the settle and the help panel's two deleted; the reflections moved; descriptions, puts by part and marks (43) and rule P (12) added |
| `grids`, `label-editor`, `help` | -- | -- | -- | 261 | 18.0% | 214 | moved from `canvas` |
| `export` | 265 | 0.0% | 265 | 293 | 0.0% | 293 | the temporal rule, 28 |
| `sync`, `server`, doors but `export` | 5,449 | -- | 5,176 | = | = | = | untouched |
| `product-page` | 627 | 1.3% | 619 | 629 | 1.3% | 621 | the help panel, 2 |
| `lab` | 106 | 10.4% | 95 | = | = | = | in the same lines |
| **draw, running** | **14,049** | **12.5%** | **12,294** | **about 13,800** | **about 12.6%** | **about 12,060** | |

**The headline, an estimate:** draw about 250 lines smaller, 1.8%; the renderer 39% smaller, the rules adapter 64%, `canvas` 18%; the export 28 larger; the share flat; the tests about 500 smaller -- about 950 out with the copies and their old sides, about 450 in with the recorder, the harness's renderer, the parser's and the new guards' tests.

What the density measure will not show, plainly: H26.8's substance -- the 427 translating lines and eight duplications section 2 counts, going to 12 and two -- because a function in a table counts declared whether it translates or not and the shadow's logic is partly replaced by the renderer's; nor whether a boundary holds, which is the scanners'; nor behaviour, which is the record's.\
The decisions move it: NS3 (b) about as many lines, the drawer and `foreignStates` kept where the painter, `occupiedOf` and rule P would stand; NS13 (b) about 14 more; NS8 (b') about 15 more.

---

## 7. Decisions owed

Marked *the director's* where the director's judgement is needed; the rest the architect's at ratification.

| # | Decision | Options, and what each costs | Recommendation |
|---|---|---|---|
| NS1 | The moves | (a) seven, each one guard (4.1); (b) revision 1's four, one guard over every painter, the pipes, the picks and the trace; (c) the trace last -- the shadow cannot go while today's trace forces a layout | (a) |
| NS2 | A painter's form | (a) ordered named parts, `''` the own item, companions `<id>/<part>`, the record the contract; (b) shapes keyed by serial, which picks cannot read; (c) companions as children, losing the link's sibling structure | (a) |
| NS3 | The pipes | (a) a painted kind under rule P, the network's subscriptions gone (4.6); (b) the network's drawer kept -- `foreignStates`, a `data-select` read and a hover lost on each repaint kept; (c) the network's paint putting items through the scene -- two drawers in one scene | (a): rule P is one schedule, no load patch, never more work than today; (b) the fallback |
| NS4 (the director's) | The trace (B422) | (a) declared, measured length and duration as custom properties, the name alternated per line, its lifecycle the reveal's; (b) `pathLength="1"`, differing on every curve; (c) B422 kept | (a): pixel-identical during, nothing left after, the export unchanged |
| NS5 | Marks and aim | (a) declared by the owning part, applied by the renderer; (b) the scene's elements handed out, against VS4; (c) a `markOf` the devices plugin reads | (a) |
| NS6 | Picks | (a) by item, with `parts` and `on`, run regions apart, precedence the layers'; (b) by selector, against D8 | (a) |
| NS7 (the director's) | The five bodies | (a) to `editing` behind the host, Input owning `ctx`, the session and geometry; (b) left in `canvas`; (c) their helpers moved too, needing what `editing` may not import; (d) a component now | (a) |
| NS8 (the director's) | The label editor, help and grids | (a) declared parts now, `help` the page's, with (a') the editor's five reads one counted exception, or (b') boxes from the description -- exact for a region, not for the fallback of a whole device's box; (b) left in `canvas`; (c) components now | (a) with (a'), revisited at B416 |
| NS9 | The stored layout record | (a) kept; (b) migrated -- every document, template and seed | (a) |
| NS10 | The copies | (a) each deleted when nothing rests on it (4.2); (b) kept to the close; (c) deleted first | (a) |
| NS11 | A refused declaration's words | (a) the component's problems; (b) the old words, 27 lines kept | (a) |
| NS12 | B418 and B425 | (a) restated with their triggers; (b) delivered with no consumer | (a) |
| NS13 (the director's) | The states' lifetimes | (a) each shown while held: hover, the idle ring, arming and a drag state through a mode or structural change; `unrevealed` through a structural change and through every mode change, where today a withheld device or waypoint shows for up to one pass after each (measured); aim through a redraw in run mode; a pipe's hover through a repaint; a surviving selection shown after a load, which today loses its look (measured); token order as set; (b) today's exactly -- keeping the signatures and `structure` H26.8 retires, and the load's lost selection | (a): what is shown is what is held; each change its own test |
| NS14 | The paint loop | (a) the simulation's, registered; (b) a part now, its consumers one plugin's | (a) |
| NS15 | The corpus's `run-mode-action` | (a) restated over a panel, its record's host event and final document changed (4.7); (b) kept by a stub that reads a selector | (a): the scenario described a page that never exists |
| NS16 | A healed link's hit twin (reading 3, o:F5) | (a) drawn as a fresh draw draws it: once a down link without a head gains a route, its twin holds no `stroke-linecap`, one named difference from the record, where today's update sets the twin's attributes and removes none (`plugins/network/link-painter.mjs:117`), leaving `round` until a reload; (b) today's leftover kept -- a description that depends on the link's history, which a painter answering from the entity cannot give | (a): the twin is transparent, so the difference is its click area's ends squared at once rather than at the next reload; the record's healed-link step asserts it and nothing else |

**Registered when ratified** (RU3): the export's bounds from the parts' footprints (X7), "the export's frame is found wrong, or H26.6 designs pan and zoom"; the paint loop as a part (NS14), "a part beyond the simulation draws from the clock"; the label editor's boxes from the description (NS8 b'), "the label editor is extracted (B416)"; B422 closed by the trace move; B418 and B425 restated.

---

## 8. Axiom alignment audit (M7)

**Identity:** Revision 4, read against `bd6ca83` (production's `ca492da`), the components' released contracts, H26-9 to H26-16 with H26-15 as amended, and mission-kit at `a3f0cae`.

**Verdict:** `pass, with guardrails`, confirmed by reading 3, scoped to section 9.2's design-level points as H26-15 as amended rules, its five findings folded (9.3).

| Axiom | Weight | How the design stands |
|---|---|---|
| `A3` | load-bearing | each component reached by one part in its own shapes; general duties declared parts; one counted exception; no universal adapter |
| `A1` | supporting | what is drawn is the scene's items and the renderer's descriptions, data; each state and mark a value its owner holds |
| `A8` | load-bearing | each move one guard; the drawing moves against a record from `ca492da`, its coverage measured and its allowed differences stated |
| `A5` | load-bearing | the page and the export from one description; the export's bytes measured unchanged |
| `A14` | load-bearing | every translation and duplication inventoried; a latent defect measured and named (NS13) |
| `A4` | supporting | records kept across each move; each copy goes only when nothing rests on it |

Tensions: the share flat against density as an aim (section 6); the record's allowed differences against parity (4.2); the label editor's reads against one owner per element (NS8); a mark-only put per tower per frame against today's cached glyph, priced at the painters move.

**Guardrails.**
- GR1: each component imported by its one part (`tools/scan-layers.mjs` L12).
- GR2: `app/src/shadow.js` absent; `composeParts` refuses `create`, `update`, and a painter without `shapes`.
- GR3: the kit holds exactly 3.2's members.
- GR4: `picksOf` refuses `closest` and `self`.
- GR5: Input receives input-capture's fact itself, frozen, and writes nothing on it.
- GR6: `kernel/input-rules.mjs` exports the declaration, `openTable` and `openGestures` alone.
- GR7: `editing` imports `document` alone; `grids` and `help` nothing outside their part; `label-editor` `document` and `kind-contract`.
- GR8: the scene-read boundary as 3.3 states it, its counts by move.
- GR9: each move's guard (4.1) passed as written.
- GR10: section 5's test, the reveal and loop unpaused, in Chrome.
- GR11: `--parts` measured at each move and at the close.
- GR12: every record document and mode: each item's parts and each shape's attributes as the record holds them on a load; an element kept across an update keeps its key (`native-shapes.test.js`, new in `tests/`).
- GR13: every phase of every body run with a host alone, each verb acting on the context its phase holds -- a commit's and a cancel's on the one handed to it; `editing-gestures.js` reading nothing but its parameters and its part's imports (`editing-host.test.js`, new in `tests/`).
- GR14: rule P: each pipe described at most once per change, exactly as it names, counted against the record's pipe triggers.

**Closeout:** H26.8 closes when `dev/CODE-SPLIT.md` holds the closing table, section 2's inventory is re-measured at 12 lines, B422 is closed, every L4 copy is gone and appendix A's every row is checked.

---

## 9. Reviews

H26-3 requires a multi-family reading (M1); H26-15 as amended tiers its findings: design-level settled here and confirmed by one reading scoped to them, build-level carried into appendix A.

### 9.1 Reading 1 -- 2026-10-27, of revision 1 at `1ce06b5`

Read cold through context-lab's review panel, `--tools on --verify`, by `gemini-4-argon` (`a`), `gpt-6-astra` (`o`) and `grok-4.20-non-reasoning` (`x`), kept at `~/taceng/drawv2-eval-runs/h26-readings/ns/reading-1/`.\
It reported 26 findings, 11 from `a`, 12 from `o` and 3 from `x`, 18 blocking; `a` supported all of `o`'s, `o` 10 of `a`'s, `x` 6, and both refuted all of `x`'s.\
The director accepted all but x:F3; revision 2 folded them.

| Finding | What it said | Disposition |
|---|---|---|
| a:F1, o:F1 | the trace's keyframes break the export | **Fixed**: temporal rules left out; revision 3 hardens the parse (9.2) |
| a:F2, o:F9 | the trace's lifecycle unstated | **Fixed**: the reveal owns it (section 5) |
| a:F3, o:F7 | pipes as a painted kind lose their redraws | **Fixed**: revision 3's rule P (4.6) |
| a:F4, o:F3, o:F11 | the host incomplete; `help` in `chrome`; GR8 unenforced | **Fixed**: 3.2's host; the panel handed; GR8 restated in revision 3 |
| a:F5, x:F2 | the shape form unpinned | **Fixed**: the record the contract; GR12 |
| a:F6, o:F4, o:F5, o:F6, a:F7 | the pick form; run regions; signatures | **Fixed**: 3.2 |
| o:F2 | the oracle shares the painters | **Fixed**: the record from `ca492da` (4.2) |
| o:F8 | lifetimes unruled | **Fixed**: NS13 |
| o:F10 | the harness's targets are stubs | **Fixed**: revision 3's drawing harness (4.7) |
| a:F8, a:F9, a:F10, a:F11 | missing tests, constructors, citations, counts | **Fixed**, now appendix A's rows |
| o:F12 | the paint loop not inventoried | **Fixed**: NS14 |
| x:F1 | `nameLabel` and the probe missing | **Fixed in substance**: examined, neither translates |
| x:F3 | `tools/layers.mjs` not updated | **Not changed**: each move edits it |

### 9.2 Reading 2 -- 2026-10-27, of revision 2 at `0f8031c`

Read cold through the same panel, `--tools on --verify`, by the same three readers, kept at `~/taceng/drawv2-eval-runs/h26-readings/ns/reading-2/`.\
It reported 39 findings, 23 from `a`, 10 from `o` and 6 from `x`; 27 blocking, 11 should-fix and 1 minor; `a` supported all 10 of `o`'s, `o` 12 of `a`'s 23, `x` returned no verdicts, and `a` and `o` refuted all 6 of `x`'s.\
The director tiered them under H26-15 as amended; each design-level claim revision 3 rests on was measured, the scripts at `~/taceng/drawv2-eval-runs/h26-native-shapes/probes/`.

| Finding | Tier | Disposition |
|---|---|---|
| a:F1 | design | **Fixed**: 4.2's matrix drives every pipe trigger alone and combined, every NS13 case and the network's settle; the comparator fails a scenario it did not reach |
| a:F2 | design | **Fixed**: the class order stated (3.2); a surviving selection loses its look on a load today, measured, named in NS13 |
| a:F3 | design | **Fixed**: rule P, the renderer's one schedule; the network's subscriptions go (4.6) |
| a:F4 | build | appendix A, pipes |
| a:F5 | design | **Fixed**: coverage boards measured; the ring's offset and the transit ring's attributes pinned; GR12 asserts the record |
| a:F6 | design | **Fixed**: each `<svg>` order tied to its condition (appendix B) |
| a:F7 | build | appendix A, trace |
| a:F8 | design | **Fixed**: a string-aware parse refusing what it cannot read, nine properties named, 18 of 18 re-measured (section 5) |
| a:F9 | design | **Fixed**: the harness draws through the real renderer, measured (4.7) |
| a:F10 | design | **Fixed**: absent targets seeded or restated to intent; `targetOf` throws on absence; one corpus record named (NS15) |
| a:F11 | design | **Fixed, no change in behaviour**: precedence is the layers' order (3.2), proved by the point grid |
| a:F12 | build | appendix A, painters |
| a:F13 | build | appendix A, painters; the states keep the names `setState` and `clearState`, so the credit holds |
| a:F14 | design | **Fixed**: phase signatures stated; Input owns `ctx` (3.2) |
| a:F15 | design | **Fixed**: `retarget` and `endRetarget` stay Input's, offered by the host |
| a:F16 | design | **Fixed**: the outcome handed to `commit`, nothing written on the fact |
| a:F17 | design | **Fixed**: `hit` present exactly where `on` was; `region` read as `hit?.region` |
| a:F18 | build | appendix A, pipes and capture |
| a:F19 | build | appendix A, pipes |
| a:F20 | design, build | **Fixed**: GR8's claim (3.3); the walk in appendix A |
| a:F21 | design | **Fixed**: GR8's counts by move (3.3) |
| a:F22 | build | appendix A, capture |
| a:F23 | design | **Fixed**: re-estimated with T5's measured split (section 6) |
| o:F1 | design | **Fixed**, as a:F5 |
| o:F2 | design | **Fixed**: the pipe one item; `on: 'data-select'` admits its hit line alone |
| o:F3 | design | **Fixed**, as a:F9 |
| o:F4 | design | **Fixed**, as a:F3 |
| o:F5 | design | **Fixed**, as a:F14 and a:F16; `MARQUEE` moves with its body |
| o:F6 | design | **Fixed**, as a:F1; transient targets recorded; copies kept until replaced |
| o:F7 | design | **Fixed**: `shared` asked once per change; only touched pipes while routes stand |
| o:F8 | design | **Fixed**, as a:F8 |
| o:F9 | design | **Fixed**: `owner` `null` unless a control is found |
| o:F10 | design | **Fixed**: GR8 counts every acquisition path; its limit stated |
| x:F1 | design | **Fixed**: run against an archive of `ca492da`, never regenerated |
| x:F2 | design | **Fixed**, as a:F3; GR14 |
| x:F3 | design | **Fixed**, as a:F14; GR13's source check |
| x:F4 | design | **Fixed**, as a:F8 |
| x:F5 | design | **Fixed**, as a:F23: about 250 smaller |
| x:F6 | reject | **Not changed**: each move edits the manifest |

### 9.3 Reading 3 -- 2026-10-27, of revision 3 at `bd6ca83`, confirming

Read cold through the same panel, `--tools on --verify`, by `gemini-4-argon` (`a`) and `gpt-6-astra` (`o`), scoped to section 9.2's design-level points, kept at `~/taceng/drawv2-eval-runs/h26-readings/ns/reading-3/`.\
`a` raised nothing; `o` raised five -- two blocking, two should-fix and one minor -- each supported by `a`.\
Each was reproduced and its fold measured, the scripts at `~/taceng/drawv2-eval-runs/h26-native-shapes/probes/`.

| Finding | Tier | Disposition |
|---|---|---|
| o:F1 | design | **Fixed**: the state target is the shape bearing the entity's id, a pipe's line; one selected hand pipe's line is `pipe pipe-hand selected`, stroked `#aed581`, as production, where the root rule gave `#78909c` (`pipe-state-target.mjs`) |
| o:F2 | design | **Fixed, no change in behaviour**: a mark pick names no word and `hitFactsOf` takes none; 64 of 64 presses and every help line as today, where the pick as a drawn word changed 8 presses and added two lines (`pipe-mark-recognition.mjs`) |
| o:F3 | design | **Fixed**: the verbs of `commit` and `cancel` take the phase's context, those of `start` and `update` Input's current one; GR13 holds it |
| o:F4 | design | **Fixed**: the mark matrix covers each boundary; `unrevealed` lost on every mode change today, measured, named in NS13; `aim` kept as today by its owner setting it each frame (`mark-lifetimes.mjs`) |
| o:F5 | build | appendix A, painters; the cleanup difference named (NS16) |

---

## 10. Settled at build

Each move is built by an agent that did not draft this design, against appendix A, and passed by an independent verifier (H26-15 as amended); what it settled, and its figures by part beside section 6's baseline, are recorded here as it closes.

| Move | Commits | Guard | By part, after | Settled |
|---|---|---|---|---|
| 1 `binding` | `01df1f8`, then the verifier's three folds | the lifecycle and help records and the corpus byte-identical by hash, regenerated by the verifier from the moved code; a test now pins both records' hashes | `rules` 55 to 23 code lines (declarative share 18.2% to 43.5%; section 6 estimated 20 and 50%, the deep freeze of the declaration two lines of logic); `canvas` 2,182 to 2,183; draw 14,049 to 14,018 | NS11 the only change of behaviour, no declaration of draw's refused; the declaration exported for `openTable` alone, with a `scan-dead` allowance, and frozen to its depth; the key table's help and gesture guards held through Input, an older gap the verifier's mutants found on a line the move rewrote; two tests beyond appendix A restated; 14 mutants planted by the builder, 12 killed and 2 equivalent (its commit message says 15 and 13), 18 by the verifier, all killed but the same 2 equivalents and the two now held |
| 2 `trace` | `4d87513` (the record, alone), `51587f9`, then the verifier's four folds, the record regenerated from a fresh archive of `ca492da` and committed alone | section 5's Chrome test unpaused, 3 of 3 in each run; the export byte for byte over 18 templates and seeds and, by the verifier, 19 pinned production documents; the reveal steps under the trace rule, 11 scenarios and 97 steps, every one asked of a running trace at its event; the pixel probe against production, no difference | `simulation` 572 to 604 (section 6 estimated about 10 for the lifecycle; the per-pass upkeep and the trace's end are most of it); `export` 265 to 307 (estimated 293: the string-aware head, taken at the top level alone); `renderer` 479 to 474; draw 14,018 to 14,087 | B422 the only change of behaviour, reproduced first on `4d87513`; the record's first form recorded no trace in five scenarios and held none across two events, its steps falling after the beat's origin -- found by the verifier, fixed, and regenerated from production's code; the parser took a `@keyframes` head inside a string, fixed to the top level alone; the length re-read a frame late with no record held, fixed; Chrome leaves a few edge pixels of a line stale at a dash animation's end until a whole repaint, measured the same for today's trace, so the screenshots repaint whole; the shadow's measure and settle and the renderer's `platform` parameter deleted with the settle; section 4.2's full record still owed before the painters move |

---

## Appendix A -- the build checklist

The one place a builder reads: each row the builder satisfies and the move's independent verifier checks, beside the move's guard (4.1) and the gate.

| Move | The builder | The verifier checks |
|---|---|---|
| binding | `openTable`; Input's tables (`app/src/input.js:402-507`) and `plugins/network/grammar.mjs:75-79` through it; the six `resolveInput` sites (`app/src/input.js:669`, `:726`, `:1157`, `:1363`, `:1404`, `:1649`) | the lifecycle and help records byte-identical |
| binding | restate `tests/input-rules.test.js` (messages), `tests/pointer-bindings.test.js`, `tests/releases.test.js`, `tests/input.test.js`, `tests/network-grammar.test.js`, `tests/network-transit.test.js`, `tests/canvas-gestures.test.js`; `tests/fixtures/binding-parity.mjs` keeps lifecycle and help alone | each restated test runs; no assertion weakened |
| binding | delete `tests/fixtures/pre-binding/`, `tests/fixtures/binding-parity-press.json`, L4's entry, `tools/scan-dead.mjs`'s `overlapsIn` allowance; author `docs/ARCHITECTURE-TARGET.md` section 2's bullet | the gate's generators and scanners pass |
| the record | `native-record.mjs` and `native-record.json` per 4.2, the coverage boards among its documents, written against an archive of `ca492da` with node modules linked, a deterministic path length injected | the drawing modules of the archive equal `ca492da`'s; coverage as 4.2 states; every scenario of 4.2's matrix named |
| trace | the reveal per section 5, writing `data-trace` and `style` with `setAttribute`, the string exactly `--trace-len: <len>; --trace-ms: <ms>ms`, removed with `removeAttribute`, the same string the painters move's mark writes (a:F7) | the record's reveal steps under the trace rule |
| trace | `server/svg-style.mjs` per section 5; `tests/svg-style.test.js` gains the quoted, escaped, unterminated, vendor and two-block cases; `tools/scan-dead.mjs`'s `rulesOfSheets` text restated | the 18 documents' bytes; each case as section 5 states |
| trace | delete `settleOf`, the shadow's settle and `tests/fixtures/scene-trace-side.mjs`; rewrite `tests/vector-scene-trace.test.js`; restate `tests/reveal.test.js` | the Chrome test unpaused |
| painters | painters per 3.2 and appendix B; the renderer, `editing-states.js` with `setState` and `clearState` so `tools/copies.mjs` still credits state classes (a:F13); the simulation's marks | GR2, GR3, GR12; `tools/scan-copies.mjs` passes |
| painters | the harness's state observations: `makeInput` records `editing-states.js`'s calls by forwarding spies; restate `tests/affordance.test.js`, `tests/canvas-gestures.test.js`, `tests/canvas-chrome.test.js`, `tests/input-focus-loss.test.js` (a:F12) | each test asserts the same observations |
| painters | the scene-read rule in `tools/scan-writers.mjs`, walking the modules of 3.3's parts read from `PARTS`, resolved through its `--root` for fixtures, with negative fixtures for a lookup, a traversal then a read, and a listener (a:F20, o:F10) | the counts of 3.3; each negative fixture fails |
| painters | restate `tests/renderer.test.js`, `tests/appearance.test.js`, `tests/appearance-pipeline.test.js`, `tests/drawing-order.test.js`, `tests/anchor-redraws.test.js`, `tests/canvas-painters.test.js`, `tests/canvas-reflects.test.js`, `tests/link-heads.test.js`, `tests/run-picture.test.js`, `tests/consumer-parity.test.js`, `tests/span.test.js`, `tests/vector-scene-move.test.js`, `tests/movers.test.js` | each runs |
| painters | the healed link (reading 3, o:F5): the record's healed-link step drawn natively -- the twin as a fresh draw gives it, no `stroke-linecap` once the link gains a route | that step differs from the record by the twin's `stroke-linecap` alone (NS16), and the line, its head and the step back to down equal the record |
| painters | delete the copies and their L4 entries once each assertion of `tests/vector-scene-parity.test.js` has a named replacement | the replacement list |
| pipes | `pipe-painter.mjs` per 4.6, its layer its folder's, never `LAYER.canvas`; `ENTRIES.page` and `ENTRIES.lab` gain it, as the painters move adds `editing-states.js` and drops `app/src/shadow.js` and the capture move adds `editing-gestures.js` (a:F18) | `tools/scan-layers.mjs` L1 and L6 pass at each move |
| pipes | `occupiedOf` empty with no network; `tests/run-picture.test.js` and `tests/pipe-select.test.js` attach a network or assert empty occupancy, `net.paint()` restated to the renderer (a:F4) | each runs |
| pipes | `product/canvas.mjs`'s kind record stays 4; `lab/src/root.js` drops `FOREIGN_LAYERS`; `RATCHETS.L7k`, `tests/core-names-no-plugin.test.js` and `tests/bare-anchor.test.js` re-measured for the new module (a:F19) | the ratchets do not rise |
| pipes | delete `foreignStates` and its `tools/scan-dead.mjs` allowance; `plugins/network/host.mjs` keeps `judge`, `answered`, `settled`, `refused`, `redraw` and `seed` | GR14; `tests/network-pipes.test.js` |
| pipes | the state target per 3.2: a pipe's states on its line, the shape bearing its id, never its group (reading 3, o:F1) | one selected hand pipe, drawn and styled by the export's resolver: line class `pipe pipe-hand selected`, stroke `#aed581`, group class `pipe-of` (`pipe-state-target.mjs` as a test); the record's pipe-state steps |
| picks | `makeInput` builds the real renderer; `targetOf`; the 67 fabricated `closest` answers in 28 files restated where they stand for something drawn -- `tests/fixtures/gesture-corpus.mjs`, `tests/input.test.js`, `tests/affordance.test.js`, `tests/b242-reconcile-paths.test.js`, `tests/canvas-chrome.test.js`, `tests/canvas-gestures.test.js`, `tests/canvas-grids.test.js`, `tests/canvas-hand.test.js`, `tests/canvas-panels.test.js`, `tests/canvas-points.test.js`, `tests/canvas-runs.test.js`, `tests/duplicate-waypoints.test.js`, `tests/guide-gesture.test.js`, `tests/input-chord-other-pointer.test.js`, `tests/input-focus-loss.test.js`, `tests/input-press-resolution.test.js`, `tests/pair-capacity.test.js`, `tests/releases.test.js`, `tests/wide-devices.test.js`, `tests/network-transit.test.js` | the corpus byte-identical but NS15's scenario; no stub reads a selector |
| picks | restate `tests/canvas-picks.test.js` (precedence), `tests/pipe-select.test.js` (the four pipe cases), and the nine callers of `picksOf`, `hitWith` and `regionsOf`, `tests/scan-layers.test.js` among them; pin complete region objects for a device's frame, label, action and input, a link's line, twin and head, a waypoint, a pipe, the ground and an editing item | the drafting comparison's evidence |
| picks | the pipe painter's pick `{ mark: true, on: 'data-select' }`; `hitFactsOf` takes no mark pick, as it takes no handle (reading 3, o:F2) | every press on a hand pipe's mark -- each button and modifier, locked or not, a tool held or not -- matching the row it matches today, and the generated help line for line as today (`pipe-mark-recognition.mjs` as a test) |
| capture | facts whole; restate `tests/input-capture-move.test.js`, `tests/input-capture.test.js`, `tests/help.test.js`, `tests/pointer-bindings.test.js`, `tests/input-focus-loss.test.js`, the twelve event literals, `tests/fixtures/binding-parity.mjs`'s `keyEvent` and `press`, `tests/canvas-gestures.test.js:203` | GR5 |
| capture | `tests/input-chord-other-pointer.test.js` and `tests/input-press-resolution.test.js` observe the trigger from the outcome handed to `commit` (a:F16) | both assert `drop` then `click` |
| capture | `EDITING_GESTURES` and `MARQUEE` moved; the pins of `GESTURES` (`tests/fixtures/binding-parity.mjs:34`, `tests/input-binding-move.test.js:120`, `tests/releases.test.js:140`) and `tests/fixtures/session-spy/wrapper.mjs` restated; `tools/scan-dead.mjs`'s `GESTURES` text restated | GR13 |
| capture | `endRetarget`, `act`, `commitMove` and `commitClone` take the phase's context; `press`, `escalate`, `drag` and `retarget` Input's current one (reading 3, o:F3) | GR13 with a commit's and a cancel's current `ctx` of `{}`; a handle's retarget committed and cancelled through Input, its preview removed and its drag state cleared |
| capture | `LabelEditor` handed `edits`; its four sites in `tests/canvas-labels.test.js`, two in `tests/canvas-panels.test.js` and the harness's borrowed methods restated (a:F22); the label editor's placement test in Chrome | each runs |
| capture | `help` and `label-editor` in `PARTS`; `app/src/actions.js` stays in `LAYER.canvas`, parts and layers being distinct; `RULES.L11`'s ratchet for the label editor unchanged (a:F18) | `tools/generate-architecture.mjs` and `tools/scan-layers.mjs` pass |
| grid | places per 3.2; `Grids` handed its grids; restate `tests/canvas-places.test.js`, `tests/layouts-canvas.test.js` (its four `Grids` calls, `p.ext`), `tests/fixtures/scene-parity.mjs:559`, `tests/canvas-grids.test.js` | the grid parity record |
| each | `tools/layers.mjs` rows of the move; `docs/ARCHITECTURE.md` and `docs/ARCHITECTURE-TARGET.md` regenerated; the move's row in `dev/CODE-SPLIT.md` | the gate passes |

---

## Appendix B -- the shape contract, summarised

Each shape's attributes in fresh-draw order, measured over the 18 stored documents and the coverage boards, in view, edit and run (`attr-orders-coverage.mjs`); a bracketed attribute is conditional, at its place when present; state classes apart.\
GR12 asserts the record, which this summarises.

| Layer | Shape | Attributes, in order |
|---|---|---|
| `zones` | `g.zone` | `id class` |
| `zones` | `rect.zone-rect` | `class rx x y width height` |
| `zones` | `rect.label-pill` | `class rx height x y width` |
| `zones` | `text.label.zone-label` | `class font-size x y` |
| `pipes` | `g.pipe-of`, the item | `class data-pipe` (from `plugins/network/host.mjs:69`, `:88`) |
| `pipes` | `line.pipe`, its path `[0]` | `id stroke stroke-width fill [stroke-dasharray] x1 y1 x2 y2 class` |
| `pipes` | `line.pipe-hit`, path `[1]`, a hand pipe's | `class data-select stroke stroke-width fill x1 y1 x2 y2` |
| `groups` | `g.group` | `id class` |
| `groups` | `rect.group-hull` | `class rx fill stroke stroke-width x y width height` |
| `links` | `path.link` | `id class fill d stroke-width [stroke-dasharray] [stroke-linecap] [data-down] [stroke-dashoffset]`, the offset a closed directed ring's |
| `links` | `path.link-head` | `class data-head-of d fill stroke stroke-width stroke-linejoin [data-down]` |
| `links` | `path.link-leg` | `class data-leg-of d fill stroke stroke-width stroke-linecap [stroke-dasharray stroke-dashoffset] [data-down]` |
| `links` | `path.link-hit` | `class data-link d fill stroke stroke-width [stroke-linecap]` |
| `waypoints` | `g.waypoint` | `id class transform` |
| `waypoints` | `circle.wp-anchor`, view and edit | `class r fill stroke stroke-width stroke-opacity` |
| `waypoints` | `circle.wp-ring`, `circle.wp-junction` | `class r fill stroke stroke-width stroke-opacity` |
| `waypoints`, `nodes` | `circle.wp-transit`, transit off | `class r fill stroke stroke-width stroke-opacity [stroke-dasharray] [pathLength]` |
| `waypoints` | `circle.wp-dot` | `class r fill` |
| `waypoints`, `nodes` | `path.select-box` | `class d` |
| `nodes` | `g.node` | `id class [data-span] [data-content] transform` |
| `nodes` | `use`, the frame | `data-layer href` |
| `nodes` | `rect.frame`, a spanned or content device's | `data-layer class x y width height rx stroke-width` |
| `nodes` | `svg`, a plain device's body | `x y width height preserveAspectRatio viewBox` |
| `nodes` | `svg`, a panel's glyph region | `x y width height viewBox preserveAspectRatio` |
| `nodes` | `use`, the glyph | `data-layer href`, then `[data-aim transform]` while aimed |
| `nodes` | `rect.label-pill` | `class rx y height x width` |
| `nodes` | `text.label` | `class y font-size x` |
| `nodes` | `rect.socket`, edit mode | `class x y width height` |
| `nodes` | `rect.content-box` | `class x y width height rx fill stroke stroke-width` |
| `nodes` | `text.content-text` | `class x y text-anchor dominant-baseline font-family font-size fill` |
| `nodes` | `rect.clickable` | `class data-action x y width height fill`, or `class data-input data-idx x y width height fill` |
