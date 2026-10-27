# H26.8 -- native shapes: draw takes the four components' own shapes

The design of record for H26.8, which H26-16 aims at clean modular unification and sovereign boundaries, measured before and after by part.\
Draw stops translating between its own forms and the components': the editor reads `input-capture`'s facts, the tables are composed in `input-binding`'s own form, the canvas describes `vector-scene`'s shapes, the places carry `snap-grid`'s grids, and each adapter keeps only draw's policy and its wiring (H26-9).\
It builds on the four designs beside it (`SNAP-GRID.md`, `INPUT-BINDING.md`, `INPUT-CAPTURE.md`, `VECTOR-SCENE.md`), whose H26.8 columns it completes, and on `RELEASES-0.2.md` sections 4 and 8, which left draw on `input-capture`, `input-binding` and `vector-scene` `0.2.0` and `snap-grid` `0.1.0`.

**Standing:** a design under review, revision 2, drafted 2026-10-27, reading 1's 26 findings folded in as the director disposed of them (section 9); the code read is `1ce06b5`, whose product tree is production's `ca492da` (no product file differs between them); code lines are measured by `tools/code-split.mjs` and its `classify`, through the per-module and per-range scripts kept at `~/taceng/drawv2-eval-runs/h26-native-shapes/`; browser behaviour cited as measured was measured in headless Chrome over the DevTools protocol, and the export's bytes in Node.js on a patched copy of the tree, the probes and their outputs in `probes/` there; every figure after H26.8 is an estimate, labelled with its basis; not ratified.

---

## 1. What this decides, and what it does not

It decides:
- an inventory of every translation between draw's forms and a component's, every mechanism draw holds twice, and every part whose duty is mixed or whose boundary is undeclared, each with its code lines (section 2);
- the target part map, each part one duty behind a declared boundary, the component each speaks natively, each native form pinned, and the manifest changes that hold it (section 3);
- seven moves, `vector-scene`'s split in four, their order, what each deletes, the guard each must pass and which behaviour changes (section 4);
- the record the drawing moves are compared against, written from `ca492da`'s drawing code before any of it changes (4.2);
- the reveal's trace as a declared animation with its whole lifecycle, which fixes B422 (section 5);
- the projection by part, and what the measure will and will not show (section 6).

It does not decide:
- pan and zoom (H26.6), which this must not make harder: every term it relies on -- items, conversions, `itemAt` -- keeps its meaning under a view (`VECTOR-SCENE.md` D6), the pipes leave the foreign layers, and the movers alone stay foreign;
- extracting any component: the general duties it names become declared parts of draw, extracted when a second consumer is in sight (H26-10);
- the stored document's form: a layout record stays `{ pitch, offset, ext }` (NS9);
- draw's configuration as data files (B425) or the description offered to agents (B418), whose triggers H26.8 meets and which it restates (NS12);
- any behaviour change beyond those section 4 names, each ruled with this design.

---

## 2. What draw holds today

Read from the code at `1ce06b5`, every figure re-measured for this revision; appendix A lists every site each move touches.

### 2.1 Translations

| # | Adapter | What it converts | Where | Code lines |
|---|---|---|---|---|
| T1 | `input-capture`'s | a frozen fact into draw's mutable input event, field by field in the old key order; the route by fact type; the event's `claimed` and `capture` written back into the reply | `app/src/capture.js:73-87`, `:114-126` | 25 of 88 |
| T2 | `input-binding`'s | tenants' `rules` renamed `rows`; the answers renamed -- `rule` for `match.row`, `input` and `situation` for `fact` and `context`; a refused declaration re-worded into the old matcher's messages | `kernel/input-rules.mjs:66-111` | 39 of 55 |
| T3 | `vector-scene`'s | element-shaped shadow nodes, with the platform's semantics wherever draw's drawing code could tell, described to the scene | `app/src/shadow.js` | 115 |
| T4 | `vector-scene`'s | the renderer's bookkeeping for the shadow: the look applier, fragments, dirty marks and serials, batching and puts keyed by serial, `update` through finders, states re-applied to fresh elements, signatures, lookups of its own elements | `app/src/renderer.js:43-52`, `:162-172`, `:228-244`, `:273-310`, `:438-479`, `:504-512`, `:558-570` | 106 of 331 |
| T5 | `vector-scene`'s | each plugin's second statement of how its item looks -- an `update` beside its `create`, a `look` with element finders, a `structure` signature, companions found again by selector | `plugins/network/link-painter.mjs:62-66`, `:87-139` (32); `plugins/devices/device-appearance.mjs:69-90`, `:103`, `:135` (23); `plugins/groups/group-painter.mjs:29`, `:43-49` (8); `plugins/zones/zone-painter.mjs:30`, `:47-49` (4); `plugins/network/anchor-appearance.mjs:54` (1) | 68 |
| T6 | `vector-scene`'s | the reveal and the towers holding the renderer's elements: a trace measured on a node and forced through it, a glyph cached while connected | `plugins/simulation/reveal-painter.mjs:95-118`, `plugins/simulation/mover-painter.mjs:314-345` | 42 |
| T7 | `vector-scene`'s | a state of an id the renderer did not draw, found by selector beneath the foreign layers; the trace's settle | `app/src/compose-canvas.js:96-116`, `app/src/painter.js:44` | 15 |
| T8 | `snap-grid`'s | a place's extent declared beside its grid and cross-checked; a stored layout record into a declaration | `app/src/snap.js:124-128` (5); `kernel/geometry.mjs:25-36` (12, the stored form's boundary, kept) | 17 |

So 427 code lines, 3.0% of draw's 14,049, translate; H26.8 deletes each range or rewrites it in the component's form, all but T8's 12.\
Examined and found no translation (x:F1): `nameLabel` (`kernel/renderer.mjs:33-36`, 4) builds its two elements through the builder T3 translates, so it is rewritten to answer two shapes, in as many lines; the probe (`app/src/painter.js:38-43`, 6) measures a path off the page, which the trace needs, so it stays.\
The adapters' policy stays: capture's field and control tests, menu and focus loss (`app/src/capture.js:96-113`, `:127-170`); binding's guards, claim and gesture field (`kernel/input-rules.mjs:45-58`); the lattice's grids, anchors, dot and hull (`kernel/geometry.mjs`).

### 2.2 Mechanisms held twice

| # | Held twice | Where | Code lines | Disposition |
|---|---|---|---|---|
| X1 | keyed drawing: the renderer and the scene keep items by key, and the network keeps its own map of pipe elements by id, making, updating and removing them, a hook letting the renderer's states reach them | `plugins/network/host.mjs:58-93` (35); `app/src/compose-canvas.js:96-116` (14) | 49 | held once: the pipes a painted kind (NS3, 4.6) |
| X2 | what lies under the pointer on the page: draw's picks by selector over the target, beside the scene's `itemOf` and `itemAt`, which answer the same by element and which draw does not call | `app/src/pick.js:32-83`, `:123-125` (44); `app/src/capture.js:52-67` (16); each plugin's `picks`, `drawn`, `runTargets` | 60 | held once: picks by item (NS6, 4.7), as D8 ruled |
| X3 | what an item looks like: once built by `create`, again by `update` with `look` and its finders, the renderer signing which applies | T4, T5 | (in T4, T5) | held once: the scene diffs one description |
| X4 | the reveal's mark and trace and the towers' aim, written onto elements outside the renderer that drew them | T6 | (in T6) | held once: marks the owning part declares and the renderer applies (NS5) |
| X5 | an entity's state classes: the renderer's for what it drew, the network's own for a pipe's `selected`, and the hook for `hover` and `armed`, lost on each repaint (`VECTOR-SCENE.md` section 11) | `app/src/renderer.js:312-331`, `:558-570`; `plugins/network/host.mjs:87` | (in X1, T4) | held once: states `editing-states.js` holds, every item described with them (NS13) |
| X6 | a place's extent and its grid's bounds | T8 | 5 | held once: the grid alone |
| X7 | the export's bounds, re-derived by parsing `transform` and `d` out of the description, beside the parts' footprints | `server/svg.mjs:91-117` | 26 | kept: the export's own (H2), and changing it changes the export's bytes |
| X8 | the palette's tiles built by `buildPreview`, beside the stamp ghost's shapes | `app/src/painter.js:48-54` | 7 | kept, as `VECTOR-SCENE.md` appendix B ruled: the tiles stand outside the canvas |

Not held twice, though it looks so:
- the page, the export and the lab draw through one renderer and one canvas composition (H2; H17 K8);
- what a drag lands on is answered by footprints (`app/src/pick.js:103-110`), draw's gesture policy -- a device grabbed within its frame and 4 more (`plugins/devices/device-footprint.mjs:67`) -- not a second hit test of what is painted;
- the canvas parts' declarations are read 40 times across ten modules, each slice composed once by its consumer;
- three nearness tests -- `nearOrigin`, the network's `near`, the devices' `inFootprint` -- are each a part's policy over one radius, `L_STD.frame.ext`;
- the paint loop (`plugins/simulation/paintloop.mjs`, 19), a timer floor with frames above it, is already one module, which the reveal and the movers share (2.3).

### 2.3 Parts whose duty is mixed or whose boundary is undeclared

| Part, today | Code lines | What is mixed or undeclared | Target (section 3) |
|---|---|---|---|
| `canvas` | 2,182 | its duty is to turn input into edits, yet it holds the label editor (`app/src/labeledit.js`, 141, B416), the help overlay and its action labels (`app/src/help.js` 65, `app/src/actions.js` 37, B417 -- imported by `app/src/main.js` alone, `app/src/help.js` in the `chrome` layer) and grid drawing (`app/src/grids.js`, 20, B415) | three declared parts (NS8) |
| `canvas`, `GESTURES` | 171 | eight gesture bodies each take the whole Input, `i`; the five generic ones, 101 lines, reach 20 of its members and four helpers of `app/src/snap.js` and `app/src/editing-visuals.js` (`app/src/input.js:91-352`) | the five in `editing`, behind a declared host of named verbs (NS7) |
| `renderer` | 479 | composition, states, the shadow, and DOM helpers for the foreign layers, the palette and the help panel's visibility (`app/src/painter.js:61-62`) | composition and description alone |
| `network`'s `host.mjs` | 93 | a pipe drawer of its own beside the renderer (`:58-93`, 35) | a pipe painter (4.6) |
| `simulation`'s reveal and towers | 42 | reach into the renderer's elements by `byId` and `glyphOf` (`app/src/renderer.js:228-244`) | marks the simulation declares (NS5) |
| `simulation`'s paint loop | 19 | a general duty inside one plugin (o:F12) | stays the simulation's: both its consumers and the clock it serves are the simulation's (NS14) |
| `primitives` | 28 | `nameLabel(el, g, ...)` takes the element builder (`kernel/renderer.mjs:33-36`) | answers shapes |

### 2.4 What holds draw's behaviour today

- **Verbatim copies, each pinned by its SHA-256 under L4's named exception,** their trigger "the verbatim copies are deleted (H26.8)" (`tools/layers.mjs:562-568`): today's renderer and painter (`tests/fixtures/pre-scene/`, 366 code lines with shims) and export (`tests/fixtures/pre-export/`, 184), run by `tests/vector-scene-parity.test.js` and `tests/vector-scene-trace.test.js`; and the old matcher, press and triggers (`tests/fixtures/pre-binding/`, 47), run by `tests/input-binding-parity.test.js`.
- **Records written before a move and replayed after:** the gesture corpus, 92 scenarios byte-identical (`tests/fixtures/gesture-corpus.json`); the editing layers' trees over the corpus (`tests/fixtures/scene-parity-record.json`); which gesture body ran for each input, and the help's projection (`tests/fixtures/binding-parity-lifecycle.json`, `tests/fixtures/binding-parity-help.json`); the booted page's DOM (`tests/fixtures/k8-dom.json`).
- **Live:** 514 calls in 28 test files dispatch platform events through the real capture (`tests/fixtures/client-harness.mjs` `captureDispatch`); the export's bytes (`tests/svgexport.test.js`, `tests/svg-style.test.js`); the pixel probe against production, no tolerance (`tools/probe/parity.mjs`).

Which of these is independent of the code H26.8 rewrites (o:F2): the copies are not -- `tests/fixtures/scene-parity.mjs:40-60` runs the live composition, network, reveal and movers on both sides, and `tests/fixtures/pre-export/` re-exports the live composition, so a painter rewritten changes both sides alike; the records, the K8 corpus and the pixel probe are, being data written before the move or production itself.\
Section 4.2 adds the record the drawing moves need.

---

## 3. The target

### 3.1 The part map

Each part one duty; *speaks* names the component it calls with that component's own shapes; *H26-10* names a duty general enough to become a component, extracted only when a second consumer is in sight.

| Part | Duty | Modules after H26.8 | Consumes | Speaks | H26-10 |
|---|---|---|---|---|---|
| `lattice` | Compute geometry on the grid | as today | -- | `snap-grid`: grids opened from declarations, the places carrying them | -- |
| `rules` | Declare what an input means: draw's guards, its claim and its gesture field | `kernel/input-rules.mjs`, `openTable` and `openGestures` over one declaration | -- | `input-binding`: `{ owner, rows }` tenants, `matchInput`, `findOverlaps`, the session | -- |
| `canvas` | Turn input into edits through the parts' declarations | as today but the modules below leave | `editing`, `grids`, `label-editor` beside today's | `input-capture`: facts and replies, Input taking each fact whole | -- |
| `editing` | Let a person select, move and resize what the canvas draws | today's three, `editing-gestures.js` and `editing-states.js`, new in `app/src/` | `document` | `vector-scene`'s items, handed the scene as a value; the states the renderer describes | B389 |
| `renderer` | Describe a document through the parts' shapes | `app/src/renderer.js`, `app/src/painter.js` (the movers' builder, the palette's tiles, the probe) | as today; handed the editing states as a value | `vector-scene`: `put`, `remove`, `items`, `itemOf`, `toDrawing`, `toScreen` | -- |
| `grids` | Draw the grids a diagram's places snap to | `app/src/grids.js`, handed the grids it draws | -- | `vector-scene`'s items | B415 |
| `label-editor` | Edit a drawn label in place | `app/src/labeledit.js`, handed its two edits | `document`, `kind-contract` | `vector-scene`'s `toScreen`; its regions' boxes by the one declared exception (3.2) | B416 |
| `help` | Show what each input does, from the tables' rows | `app/src/help.js`, `app/src/actions.js` | -- | `input-binding`'s `table.rows` | B417 |
| plugins | as today | as today, the network gaining `pipe-painter.mjs` | as today | each painter and appearance answering shapes; the simulation declaring its marks; each row in `input-binding`'s form | -- |

`help` is consumed by `product-page`, as `app/src/main.js` imports it today, not by `canvas`: Input is handed the panel (3.2).\
Draw's own, staying in `canvas`: the readout, the commands, the commit boundary, the held tools, the picks and footprints, the situation, the rows, and the session's transitions; in `product-page`: the palette.\
B418 is met in form -- what a person sees is the scene's items, data -- and restated (NS12).

What pan and zoom (H26.6) will need, and how H26.8 leaves it:

| H26.6 needs | After H26.8 |
|---|---|
| a view the scene holds, a transform on its layers or the root's `viewBox` (`VECTOR-SCENE.md` D6) | as today, every layer's element the scene's, foreign or not, so a view carries all; the pipes' content the scene's too (4.6), the movers' alone drawn outside it |
| picks under a moved view | by item, which no view changes; a captured pointer by `itemAt` |
| conversions | the scene's, as today; the label editor's boxes the platform's, which follow a view |
| drawing only what is in view (B289) | each entity one description, put or removed whole, so a culled entity is one removal |

### 3.2 The native forms

**A painter answers its item's shapes** (NS2): `{ kind, layer, stacked, picks, run?, shapes(entity, kit) -> parts | null, redraws?, modal? }`, `parts` an ordered list of `[part, shape]`, each `shape` `vector-scene`'s (VS5); the part `''` is the entity's own element, keyed by its id, and every other a companion keyed `<id>/<part>`, so a link answers `''`, `head`, `leg` and `hit`, and a head gained keeps the line and the twin as today.\
`modal` asks a re-description when the mode changes, as the renderer re-renders the appearances' kinds today (`app/src/renderer.js:254`); `run` is the run-mode region (below).

**The kit, exactly:** `{ model, mode, renderOpts(), sizeOf(kind, entity), outlineOf(kind, entity), pillWidth }` -- today's (`app/src/renderer.js:484-488`) less `el`, `setAttrs`, `applyLook` and `layer`; no element builder, no layer, no look applier and no mark (GR3).

**The shape form, pinned** (a:F5, x:F2): each part in today's order -- a link's line, head, leg, twin; a device's root, then its layers in the order's layers; a pipe's group holding its line and hit line -- and each shape's attributes in the order today's fresh draw gives them, a conditional attribute at its place when present and absent otherwise.\
Appendix B lists every order, measured over 18 documents in three modes; two a builder would not guess: a device's inner `<svg>` writes `viewBox` after `preserveAspectRatio` on 303 shapes and before it on 6, and the device's name label orders its pill `class rx y height x width` where the zone's orders it `class rx height x y width`.\
GR12 holds every order against the record (4.2), and an element kept across an update: `scene.itemOf` of the element made before answers the same key after.

**The renderer describes and puts each entity whole,** in its call, as `place` and `syncAll` order it today:
1. on a change of the entity, or of one a painter's or appearance's `redraws` names, the painter's parts or the composed `<g>` are described -- a dependency redraw -- and the description kept;
2. the states and the marks are applied to a copy of it (below), and each part is put under its key, `<id>` or `<id>/<part>`, before the item of the next part it kept, or before the item `place` found from the layer's items, as `putOf` places them today (`app/src/renderer.js:293-310`);
3. a part no longer answered is removed; an entity no longer drawn has every key removed and its marks dropped;
4. a state or a mark changed applies them again to the kept description and puts it, no painter or appearance called -- a state- or mark-only put -- the scene writing only what differs; no dirty marks, no batching, no fragments and no signatures are kept.

`renderer.ownShapeOf(id)` answers the entity's own shape as last described, frozen, or `null`: data, never an element; the reveal reads a line's `d` through it (section 5).\
`renderer.drawerOf(id)` answers the painter or the winning appearance that drew the entity, which the picks read.

**An appearance answers its parts' shapes:** `parts: { [layer]: (entity, kit, state) -> shapes }`; `state`, `composes`, `root`, `rootAttrs`, `addClass`, `selectBox` and `redraws` as today; `look` and `structure` go, the scene comparing one description to the last (VS7).\
The renderer composes the winner's `<g>` with the composers' parts in the order's layers, as `drawComposed` does (`app/src/renderer.js:516-531`).

**A state is a class in the description** (NS13): `editing-states.js` holds them -- `set(id, cls, on)`, `clear(id, ...classes)`, `reflect(selected)` (the selection and the parts' `reflects`, from `app/src/renderer.js:312-331`), `classesOf(id)` in the order set, and `onChange(fn)`.\
The composition makes it and hands it to the renderer, which reads `classesOf` and hears `onChange`, and to Input, the overlay and the network, which set, clear and reflect through it where they asked the renderer (`app/src/input.js` 10 sites, `app/src/overlay.js` 6, `plugins/network/host.mjs:122`).\
The own element is the shape bearing the entity's id, at any depth, so a pipe's line nested in its group carries its states.\
Each state and mark is held by the part that sets it and described while the entity is drawn; where today's lifetime differs, the change is the director's to rule (NS13, o:F8):

| State or mark | Set and cleared by | Today a fresh element -- a mode change for every node and waypoint, a structural change, a remote edit -- loses it until | After H26.8 |
|---|---|---|---|
| `selected`; a kept reflection, `on-selected-path` | the selection; the network's reflections | never: re-applied (`app/src/renderer.js:466-470`) | unchanged |
| `blocking`, a reflection not kept | the network's reflections | the next reflection, which every model change runs | unchanged in sight: a structural change comes with a model change |
| `hover`, the idle ring (`linkband`) | the overlay; Input on a deletion, a load and Shift's release (`app/src/input.js:568`, `:1686`) | the pointer leaves and returns, the overlay holding it throughout | kept while held (NS13) |
| `armed`, `armed-clone` | the overlay | the next arming | kept while held (NS13) |
| a link end's drag state | the handle gesture (`app/src/input.js:210`, `:1037`) | the drag ends | kept while held (NS13) |
| `unrevealed` | the reveal, every pass | its next pass, a frame or 100 ms | kept: hidden at once (NS13); dropped with the entity and on a load, as a fresh element carries none, the next pass marking again |
| `trace` | the reveal (section 5) | never: the line drawn whole | kept, its animation running on (NS13, section 5) |
| `aim` | the movers, each frame a bearing changes | the next frame a target is in range | kept, a tower holding its last bearing as `aimTurrets` intends (`plugins/simulation/mover-painter.mjs:314-327`); cleared by the movers' `clear` on leaving run mode, where today's re-render clears it |

**A mark is declared by the part that owns it** (NS5): a canvas part declares `marks: { [name]: (parts, value) -> parts }`, the renderer applying each mark an entity holds to its described parts, in the parts' order; `renderer.mark(id, name, value)` records one, `null` clearing it, and puts the entity's items only when the value changed.\
The simulation declares its three in `SIMULATION_CANVAS` (`plugins/simulation/spawn-appearance.mjs`):

| Mark | Value | Applied to | Attributes, appended |
|---|---|---|---|
| `unrevealed` | `true` | the own shape | `data-unrevealed=""` |
| `trace` | `{ run, len, ms }` | the own shape, a link's line | `data-trace="<run>"`, `style="--trace-len: <len>; --trace-ms: <ms>ms"` |
| `aim` | degrees | the shape holding `data-layer="glyph"` beneath the own shape | `data-aim`, then `transform="rotate(<deg>)"`, today's order |

No painter or appearance reads a mark, so the devices plugin knows nothing of the towers, as today; the export holds no mark.

**A pick names a word and the parts that answer** (NS6): `{ word, modifier?, button?, idle?, clones?, mark?, parts? }` on a painter or an appearance, `parts` the item's parts that answer it, every part when absent.\
`picksOf(parts)` validates it, refusing `closest` and `self` (GR4); `hitWith(picks, { scene, drawerOf })` answers `(evt) -> { kind, id, handle?, mark? }`:
- `scene.itemOf(evt.target)` gives `{ layer, key, path }`;
- a key of the editing part's handles item answers the handle its shape at the path names, by the `data-` key its declaration gives (`handles`), with `handle: true`;
- a key `<id>` or `<id>/<part>` answers the pick of the drawer `drawerOf(id)` names -- the painter of `kindOf(id)`, or the winning appearance -- when its `parts` hold the key's part: with its modifier held, or none declared, `{ kind: word, id }`, `mark` when declared; without it, `{ kind: 'canvas', id: null }` (U1);
- anything else, `null` among it, is the canvas.

`button` stays as today, read by `app/src/recognize.js:71` alone, so a zone answers Shift+right, and Shift+left and Ctrl+Shift+left over a zone still draw one (o:F4).

| Picked today by | Picked natively by |
|---|---|
| `closest: 'g.zone'`, Shift, the right button (`plugins/zones/zone-painter.mjs:39`) | the zone painter's item, every part; `modifier: 'shiftKey'`, `button: 'right'` |
| `closest: 'g.node:not(.ghost)'` (`plugins/devices/device-appearance.mjs:100`); `closest: 'g.waypoint'` (`plugins/network/anchor-appearance.mjs:44`) | an item of kind `node`, by the appearance that won it: the device's `node`, its idle ring kept, or the anchor's `waypoint`; the stamp ghost an editing item, no entity's, so the canvas |
| `self: 'link'`, `self: 'link-hit'` and its `data-link` (`plugins/network/link-painter.mjs:75`) | the link's parts `''` and `hit`; its head and leg answer nothing, as today |
| a handle's class and dataset key (`app/src/pick.js:57-61`) | the editing part's handles item, the handle read from the shape at the path |
| a mark's `data-select`, which only a hand pipe's hit line carries (`app/src/pick.js:79-80`, `plugins/network/host.mjs:71`) | the pipe painter's part `hit`, which only a hand pipe has; `mark: true`; any pipe's line answering nothing, as today (o:F6) |

**Run mode's region is declared apart from the picks** (o:F5): a painter or appearance declares `run: { entity?: parts, target?: true }` -- the parts on which a run press counts as on the entity, and whether its item is what a run press aims at; `regionWith({ scene, drawerOf })` answers today's seven fields from the item and the shapes along its path:

| Field | Today (`app/src/capture.js:52-67`) | Natively |
|---|---|---|
| `target`, `overTarget` | the closest `runTargets` element (`.waypoint`), its id, and whether one answered | the item's entity and `true` when its drawer declares `target` -- the anchor appearance alone |
| `action`, `input`, `control` | the closest `[data-action],[data-input]` and its dataset | the deepest shape along the path holding `data-action` or `data-input`, its attributes read as today |
| `owner` | that control's closest `drawn` element | the item's entity, when its drawer declares `entity` |
| `entity` | the closest `drawn` element: `.zone`, `.link`, `.group`, `.node` | the item's part among its drawer's `entity` parts: a zone's, a group's and a device's every part; a link's `''` alone, so its twin is no entity, as today; none for a waypoint, a pipe or an editing item |

**Input takes each fact whole:** `deliver(fact, reply)` routes by `fact.type` to today's entry points, the route `app/src/capture.js:73` held; `hit` answers draw's pick with the region folded in on a `down`, `{ kind, id, handle?, mark?, region? }`.

| Draw's input event today (`app/src/capture.js:76-87`) | Read natively | Readers |
|---|---|---|
| `type`, `key`, the four modifiers | the fact's own, unchanged | every row |
| `button`, `0` for a key; `repeat`, `false` for a pointer | the fact's, `null` where its family carries none | rows test them only within their family, where both agree |
| `at`, `pointerId` | the fact's | Input, the session, the input state |
| `on`, `region` | `fact.hit`, its `kind` and `id`; `fact.hit.region` | `app/src/recognize.js`, `app/src/input.js`, three plugins' rows, `app/src/help.js`'s `eventsFor` |
| `onControl` | `fact.focus.onControl` | Tab's run (`app/src/input.js:1460`) |
| `claimed`, `capture`, written by Input and rows | `reply.claim()`, `reply.takePointer()`, asked at once | Input, three plugins' runs |
| `trigger`, written by the release (`app/src/input.js:1116`) | the session's outcome, handed to the body | the link's and the marquee's commits (`:281`, `:343`) |

`app/src/help.js`'s `eventsFor` builds `{ hit: { ...hitOf(k), region } }` where it built `{ on, region }`, so the help's proof drives the rows as facts drive them (a:F8).\
Input is handed the help panel as `{ shown(), show(on) }`, made by the page from its element, where it imported `isShown` and `setShown` from `app/src/painter.js`; the two leave for `app/src/main.js`, and `canvas` imports nothing of `chrome` (a:F4).

**The tables are `input-binding`'s:** `openTable(...tenants)` composes `{ owner, rows }` under draw's declaration, throwing the component's problems as `openGestures` throws its own; call sites ask `table.matchInput(fact, context, guards)` and read `match?.row`, and the gate asks `table.findOverlaps`.

**The editing gestures take a declared host** (NS7): `EDITING_GESTURES` in `editing-gestures.js`, the five bodies -- `move`, `clone`, `pending` with `clone-pending`, `handle`, `marquee` -- each phase `(host, ctx, pos, evt)` where today's took `i` and read `i.ctx`.\
The session's transitions stay Input's: Input opens, escalates and ends each gesture, a body asking through a named verb.\
The host is a frozen object Input makes, as it makes `pluginHost` for the plugins' rows (`app/src/input.js:422-454`), holding exactly what the bodies reach today (a:F4, o:F3):

| Today's (`app/src/input.js:92-220`, `:338-352`) | The host's | Kept where |
|---|---|---|
| `i.ctx`, read in `update` | handed in as `ctx`; `start` answers it | Input holds it |
| `i.model` -- `set`, `get`, `del`, `endpointOf`; `i.selection` -- `list`, `clear` | `model`, `selection`, the same values | -- |
| `i.scene`, for `previewLine` and `previewRect` | `scene`, the value; the previews `app/src/editing-visuals.js`'s, in `editing` | -- |
| `i.overlayUi.crosshair.hide()`, `i.overlayUi.handles()` | `hideCrosshair()`, `showHandles()` | the overlay, `editing`'s |
| `i.readout.setBox`, `i.readout.setLink` | `showBox(patch)`, `showLink(from, to)` | the readout, `canvas`'s |
| `i.renderer.setState` | `setState(id, cls, on)` | `editing-states.js` |
| `i.hitFacts.get`, `i.handleWords.get`, `i.tools.hand` | `factsOf(word)`, `handleOf(word)`, `holding()` | Input's tables and tools |
| `i.anchorAt`, `i.decide`, `i.act` | `anchorAt(pos, targets)`, `decide(table, evt, facts)`, `act(rule, ctx)` | draw's footprints and tables, Input's |
| `i.beginPress` -- the label editor's focus, the selection | `press(hit, pos, shift)`, answering the gesture's opening `ctx` | Input |
| `i.escalate` -- the session's `press.beyond`, the rule's `run`, the mode, the grid feedback | `escalate(pos, evt, table, facts, become)` | Input |
| `i.updateMove` -- the places, `orthoDelta`, `clampDelta`, `snapIn`, `GAP`, the crosshair, `readout.setDrag` | `drag(pos, shiftHeld)` | Input |
| `i.retarget`, `i.endRetarget` | moved with the bodies, over `setState` and `ctx` alone | `editing-gestures.js` |
| `snapNode`, `resolveBox`, imported from `app/src/snap.js` | `cellName(pos)`, `boxOf(p1, p2)`: draw's geometry policy, injected | Input, from `app/src/snap.js` |
| `i.commitMove`, `i.commitClone` | `commitMove(ctx, pos, ortho)`, `commitClone(ctx, pos, ortho)` | Input |
| `kindOf`, imported | imported, `document`'s | -- |

GR13 runs every phase of every moved body with a host alone, no Input.

**The label editor's one read of the page** (o:F11): it places a native input over a drawn label or a panel's region at the box the platform gives it, so it keeps five reads of elements the scene made -- two lookups by id and two region finds beneath them (`app/src/labeledit.js:117-123`), and one box (`:133`) -- and writes none.\
Declared as the one exception (NS8), counted by `tools/scan-writers.mjs` (3.3), and held by a Chrome test placing the frame editor over a text box and the region editor over a panel's region, each at its element's box.\
Its constructor: `LabelEditor({ svg, scene, model, edits: { setFields, rename }, labelAt, wordOf, contentOf })`, the composition handing the two commits it made through `app/src/commands.js` (`:197`, `:205`).

**A place carries its grid alone:** `{ kind, layout, grid, size | sizedBy }`, its extent the grid's `bounds`, read by `clampDelta` (`app/src/snap.js:71-90`); `latticeGrids` stays the one translation, from the stored record's form (NS9).\
`Grids({ scene, grids, model })` is handed `gridsOf(parts)` by the composition, where it was handed the parts and imported `app/src/snap.js`.

### 3.3 What the manifest says, so the scanners hold it

| `tools/layers.mjs` | Change |
|---|---|
| `PARTS` | `editing` gains `editing-gestures.js` and `editing-states.js`; `renderer` loses `app/src/shadow.js`, its duty "Describe a document through the parts' shapes"; `canvas` loses `app/src/grids.js`, `app/src/labeledit.js`, `app/src/help.js` and `app/src/actions.js` and consumes `grids` and `label-editor`; `product-page` consumes `help`; three parts added, each `kind: 'host'`, `by: ['H26-10', 'H26-16']`: `grids` and `help` consuming nothing, `label-editor` consuming `document` and `kind-contract` |
| `COMPONENTS` | unchanged: each component imported by one part |
| `ALLOWED`, `LAYER` | `ALLOWED` unchanged: `app/src/help.js` stays in `chrome`, imported by `app/src/main.js` alone, and Input imports none of it; `LAYER.canvas` and the page's and the lab's `ENTRIES` name the new modules and drop `app/src/shadow.js` |
| `MOVED` | nothing moves: the new modules are new, `app/src/shadow.js` is deleted |
| `RULES.L4.verbatim` | both entries go with their copies (4.2) |
| `MISSION_KIT`, `ALIGNMENT` | `renderer` waits "describes through it natively (H26-16)"; `editing` "its gestures' bodies joined at H26.8"; `grids`, `label-editor` and `help` aligned to candidates of their own, "a drawv2 candidate by H26-10" with B415, B416 and B417 |

| Beyond the manifest (a:F10, o:F11) | Change |
|---|---|
| `docs/ARCHITECTURE-TARGET.md` section 2 | a bullet citing H26-9 and H26-16, authored at the first move, since `tools/generate-architecture.mjs` fails a part whose `by` the justification chain does not cite |
| `tools/scan-dead.mjs` `ALLOW` | `kernel/input-rules.mjs:overlapsIn` goes (binding); `app/src/compose-canvas.js:foreignStates` goes (pipes); `app/src/input.js:GESTURES` restated to the two bodies left, `link` and `box` (capture); `server/svg-style.mjs:rulesOfSheets` restated, a temporal at-rule left out (trace) |
| `tools/scan-writers.mjs` | a rule counting, by file, reads of an element the scene made -- `getElementById(`, `querySelector(`, `querySelectorAll(`, `.closest(`, `getBoundingClientRect(` -- in the modules of `canvas`, `editing`, `renderer`, `grids`, `label-editor`, `help` and the plugins: none, but `app/src/capture.js` 2 (its control and field tests on the event's target) and `app/src/labeledit.js` 5 (the exception); proved on fixtures through the scanner's `--root` (GR8) |

So `tools/generate-architecture.mjs` fails an import outside each declared `consumes`, and the edges run one way -- `canvas` to `grids` and `label-editor`, `product-page` to `help`, none back -- since each is handed what it imported from `canvas` today.

---

## 4. The moves

### 4.1 The order, and `vector-scene`'s move split in four (NS1)

Revision 1's one `vector-scene` move carried nearly all the risk -- every painter, the pipes, the picks and the trace -- under one guard that shared the code it guarded (o:F2).\
Split, each move holds one kind of change under a guard of its own:

| # | Move | What it does | Its guard |
|---|---|---|---|
| 1 | `binding` | the tables in `input-binding`'s form (4.3) | the lifecycle and help records byte-identical; the corpus |
| -- | the record | `native-record.mjs` and its record written from `ca492da`'s drawing code, committed alone (4.2) | its drawing modules checked byte for byte against `ca492da`'s as it is written |
| 2 | `trace` | B422 fixed on today's renderer: the declared animation, its lifecycle, the export taught temporal rules (4.4, section 5) | section 5's Chrome test, unpaused, with the real reveal and loop; the export's bytes over the 18 documents; the record's reveal steps re-written, their diff only the traced lines' `style` and `data-trace` |
| 3 | `painters` | every painter and appearance answers shapes, puts by part, states and marks described, the shadow deleted; picks and pipes as today (4.5) | the record equal (4.2); the export's bytes; the K8 corpus; the corpus's editing trees; the pixel probe; GR2, GR3, GR12; each of NS13's changes by its own test |
| 4 | `pipes` | the pipes a painted kind (4.6) | the record equal, its pipes layer among its trees, over every trigger of 4.6's graph; no patch or move on load |
| 5 | `picks` | picks by item, run regions declared, the harness on scene-made elements (4.7) | the drafting comparison: every element of every document's page, each mode, each modifier and button, every hit and region equal; the corpus through the migrated harness |
| 6 | `capture` | Input takes facts; the five bodies to `editing` behind the host; `label-editor` and `help` declared (4.8) | the corpus byte-identical; the lifecycle record; GR13; `tests/help.test.js` |
| 7 | `grid` | places carry their grid alone; `grids` declared (4.9) | the corpus; the grid parity record |

Why this order:
- **`binding` first:** the smallest, touching no plugin and no element, held by records already written.
- **The trace before the painters:** the one visible change lands alone, proved by its own test, so the painters move is a refactor the record holds exactly; and it must land at or before the shadow's deletion, since today's trace forces a layout between two writes (`plugins/simulation/reveal-painter.mjs:102-109`), which no description can.
- **The painters before the pipes and the picks:** keys `<id>/<part>` and kept descriptions are what both read.
- **The pipes before the picks:** a hand pipe's hit line must be a scene item before a pick by item can find it.
- **The picks before capture:** the harness moves onto scene-made elements once, so the capture move's corpus runs on it, and its own risk is the event form and the host alone.
- **`grid` last:** a few lines, independent.

If the pipes move's guard cannot be met, the network keeps its drawer (NS3 b), recorded with its reason, and the picks move reads a hand pipe's `data-select` from the target as today, the one selector read kept.\
Each move runs as H26.1 to H26.5 ran: built by an agent that did not draft it, lab first, the gesture corpus replayed, the pixel probe against production, an independent verifier as H26-15 rules, and `node tools/code-split.mjs --parts` measured at its end.

### 4.2 The record the drawing moves answer to (o:F2)

`native-record.mjs`, new in `tests/fixtures/`, is written and run before the first drawing move, over drawing code that is `ca492da`'s byte for byte, and its record committed with it.\
It drives only what both trees answer -- model operations, `setMode`, the selection, the states, the reveal and the movers at fixed instants of their clocks -- through a two-line adapter for the calls whose owner moves (a state set on the renderer before, on `editing-states.js` after), and reads only `scene.items` and, for a foreign layer, its content.\
It records:
1. every layer's trees after a load, attributes in order, for each of the 18 documents in view, edit and run mode;
2. for each document, a scripted run -- an entity moved and renamed, its structure changed (a head gained and lost, a device's type, a span), a link rerouted, a pipe laid and swept, a transit toggled, a selection set and cleared, a hover and an arming, each mode change, a reveal at fixed instants, a tower aimed at a fixed tick, a load -- and the trees after each step, attributes as a map;
3. each document's export bytes.

The corpus's editing trees, the K8 corpus and the pixel probe are kept beside it.\
These differences are allowed, and no others:

| Allowed | Why | Where |
|---|---|---|
| attribute order on an element kept across a patch | the scene keeps an element of the same tag and appends what a patch adds (VS7), where today's made it afresh | the steps' trees, compared as maps; a load and the export compared in order |
| element identity | the record does not observe it | -- |
| the order of state tokens in a class after a structural change | as set, where today's fresh element re-set `selected` and the kept reflections first | the steps' class attributes, compared as sets of tokens |
| NS13's lifetimes, as ruled | each listed in 3.2 | the steps holding a state across a structural or a mode change, asserted by their own tests |
| the trace's attributes | B422's fix (section 5) | the reveal's steps, re-written at the trace move |

The copies go once nothing rests on them (NS10): `tests/fixtures/pre-binding/` at the binding move, once the lifecycle record passes; `tests/fixtures/scene-trace-side.mjs` at the trace move, whose test replaces it; `tests/fixtures/pre-scene/` and `tests/fixtures/pre-export/` at the painters move, once its comparison with the record passes.

### 4.3 `input-binding`

| | |
|---|---|
| Changes | `kernel/input-rules.mjs` keeps the declaration and gains `openTable`; Input composes every table it holds through it, `{ owner, rows }` (`app/src/input.js:402-507`); `plugins/network/grammar.mjs:75-79` likewise; each `resolveInput(...).rule` becomes `table.matchInput(...).match?.row`, each `overlapsIn` `findOverlaps`; section 2's bullet citing H26-9 and H26-16 (3.3) |
| Deleted | `composeRules`, `resolveInput`, `overlapsIn` and the refusal's re-wording (`kernel/input-rules.mjs:66-111`); `tests/fixtures/pre-binding/` and the matcher and press halves of `tests/fixtures/binding-parity.mjs`, with `tests/fixtures/binding-parity-press.json` |
| Held by | the lifecycle record replayed byte-identical; the help's projection unchanged (`tests/fixtures/binding-parity-help.json`); the corpus; `tests/pointer-bindings.test.js`, `tests/releases.test.js` and `tests/input.test.js`'s overlap sweeps, restated to the component's calls |
| Behaviour changes | a refused declaration -- which no row of draw's is -- throws the component's problems, pointer and problem, where it threw the old matcher's words (NS11) |
| Tests touched | `tests/input-rules.test.js` (its guard and claim cases kept, its messages restated); every test composing a table (appendix A) |

### 4.4 The trace

| | |
|---|---|
| Changes | `plugins/simulation/reveal-painter.mjs`: `show` reads the line's `d` through `byId`, measures it with the probe and writes `data-trace` and the style, no layout forced; the lifecycle of section 5; `plugins/simulation/simulation.css` declares the trace; `server/svg-style.mjs` leaves out a `@keyframes` block and the animation properties as temporal (a patch of 14 lines, measured) |
| Deleted | the forced layout and the inline transition (`plugins/simulation/reveal-painter.mjs:102-109`); `settleOf` (`app/src/painter.js:44`) and the shadow's settle; `tests/fixtures/scene-trace-side.mjs` |
| Held by | section 5's test; the export's bytes over the 18 documents (equal on a patched copy, measured); `tests/svg-style.test.js` gaining the temporal cases, every other at-rule still refused; the record's reveal steps re-written and their diff reviewed |
| Behaviour changes | B422 fixed (NS4) |
| Tests touched | `tests/vector-scene-trace.test.js`, rewritten as section 5's; `tests/reveal.test.js`; `tests/svg-style.test.js` |

### 4.5 The painters

| | |
|---|---|
| Changes | every painter and appearance answers shapes (3.2); `kernel/renderer.mjs` `nameLabel` answers its two shapes; the renderer describes and puts by part, the states of `editing-states.js` and the simulation's marks applied; `reflectSelection` and the parts' `reflects` move to `editing-states.js`; the reveal and the towers mark (NS5), the reveal reading a line through `ownShapeOf`; the picks still by selector, now over the elements the scene made, and the pipes foreign, as today |
| Deleted | `app/src/shadow.js`; T4; T5; `byId`, `glyphOf` and the towers' glyph cache; `tests/fixtures/pre-scene/`, `tests/fixtures/pre-export/` and the old sides of `tests/fixtures/scene-parity.mjs`, once the record passes |
| Held by | the record (4.2); the export's bytes; the K8 corpus; the corpus's editing trees against their record; the pixel probe against production finding nothing, since it plays no beat; GR12 |
| Behaviour changes | NS13's lifetimes, as ruled; nothing else |
| Tests touched | the eleven that build the renderer over the harness, restated to shapes; `tests/canvas-painters.test.js`, `tests/vector-scene-move.test.js`, `tests/reveal.test.js`, `tests/movers.test.js` (appendix A) |

A tower's aim is a mark-only put per tower whose bearing changed, per frame, where today wrote two attributes on a cached glyph; the move measures it in run mode beside today's.

### 4.6 The pipes

| | |
|---|---|
| Changes | `pipe-painter.mjs`, new in `plugins/network/`, in `NETWORK_CANVAS.painters`: a pipe's group, line and hit line in today's structure and order (appendix B), `under` read from the network's derivation through `networkOf(kit.model)` as the link painter's `pathOf` reads it (`plugins/network/network-queries.mjs:55-58`), `null` in run mode or with an end gone, `modal`; `plugins/network/host.mjs` keeps every hook, its `paint` describing every pipe again; `FOREIGN_LAYERS` the movers' alone, `CANVAS_LAYERS` naming `pipes` where `FOREIGN_LAYERS.network` stood (`product/canvas.mjs:62-69`); the pages attach the network without a layer and a builder (`app/src/main.js:85`, `lab/src/root.js:111`) |
| Deleted | the pipe map and its elements (`plugins/network/host.mjs:66-91`); `foreignStates` (`app/src/compose-canvas.js:96-116`); the network's write of `selected` |
| Held by | the record, its pipes layer read as content before and as items after, over each trigger below; the export's bytes, run mode drawing no pipe; no put on load patching or moving an item (`tests/vector-scene-parity.test.js:71`), restated to the pipes |
| Behaviour changes | a pipe's `hover` and `armed` kept through a repaint (NS13) |
| Tests touched | `tests/network-pipes.test.js`, `tests/pipe-select.test.js` (`net.paint()` kept as the hook), `tests/run-picture.test.js`; `tests/core-names-no-plugin.test.js`, its record for `product/canvas.mjs` re-measured, a count that may only fall |

What changes a pipe's drawing, and what describes it again (a:F3, o:F7):

| Trigger | Today | As a painted kind |
|---|---|---|
| the pipe itself made, changed or deleted | `paint` on the model's change (`plugins/network/host.mjs:92`) | the renderer, as for any painted kind |
| anything else in the model: an endpoint moved with no link changed, a link made, changed or removed, another pipe made or swept, a transit toggled, a load | `paint` on every change: the ends, `under`, `laid` | the network's hook kept: on every change every pipe described again -- a dependency redraw -- the scene writing only what differs, as `paint` reconciles today |
| the planner's answer settled or refused, a board seeded, a drag judged with no commit | `redraw` (`:119-123`): the pipes, every link, the reflection | `redraw` kept, its `paint` the same hook, its reflection `editing-states.js`'s |
| the mode | `watchMode(paint)` (`:93`), no pipe drawn in run mode | `modal`: `null` in run mode removes each pipe's items; leaving it describes them again |
| the selection, a hover, an arming | the network's `selected` and `foreignStates` | states, a state-only put |
| links listed before pipes in one commit (`lab/src/root.js:183`) | the links drawn again by `redraw` after the answer | unchanged: the network's settle; the layers' order puts pipes beneath links whatever the order of puts |

### 4.7 The picks

| | |
|---|---|
| Changes | `picksOf` takes words and parts; `hitWith(picks, { scene, drawerOf })` and `regionWith({ scene, drawerOf })` in `app/src/pick.js`, as 3.2 states them, `drawerOf` the renderer's; each part's `picks`, `drawn` and `runTargets` restated as 3.2's `picks` and `run`; the harness's targets the elements the scene made |
| Deleted | the selector walk (`app/src/pick.js:53-83`), `regionsOf` (`:123-125`), `regionOf` (`app/src/capture.js:52-67`); each part's `drawn` and `runTargets` |
| Held by | the drafting comparison, outside the repository and kept with the move's evidence: over every element of every document's page in each mode, with and without each modifier and each button, today's hit and region against the new, every answer equal; the corpus through the migrated harness; Shift+left and Ctrl+Shift+left over a zone drawing one, Shift+right selecting and cloning it; a visible link-laid pipe, a hand pipe's hit line, a pipe under a link and run mode |
| Behaviour changes | none |
| Tests touched | `tests/canvas-picks.test.js` and `tests/pipe-select.test.js`, restated; the nine test files that call `picksOf`, `hitWith` or `regionsOf` (appendix A); the fabricated targets below |

**The harness's targets** (o:F10): 67 fabricated `closest` answers in 28 test files stand for a drawn entity, a handle, a panel's control, a form field, a page's button or the ground (appendix A).\
Each standing for something the scene draws is replaced by the element the scene made for it, found by `targetOf(h, on)`, new in `tests/fixtures/client-harness.mjs`, which walks the harness's stub layer and asks `scene.itemOf` of each element for the key and path wanted -- an entity's own shape, a companion, a handle, a panel's control -- so each scenario's inputs and expected commits stay as written and the pick runs as on the page.\
No fake `itemOf` reads a selector stub; the stubs standing for a field, a page's button or the ground stay, capture's own tests reading them; `tests/fixtures/gesture-corpus.mjs`'s `targetFor` becomes a call of `targetOf`.

### 4.8 `input-capture`

| | |
|---|---|
| Changes | `deliver` hands Input the fact and its reply (3.2); the rows read `hit` and `focus`: `app/src/recognize.js` (17 sites), `app/src/input.js`, `plugins/zones/zone-gestures.mjs`, `plugins/network/link-handles.mjs`, `plugins/devices/device-panels.mjs`, `plugins/simulation/spawn-runs.mjs`; claims through the reply in `app/src/input.js` (9 sites), `plugins/network/keys.mjs`, `plugins/simulation/spawn-runs.mjs`, `plugins/devices/device-panels.mjs`; `app/src/help.js`'s `eventsFor` building facts' `hit`; the five bodies to `editing-gestures.js` behind the host (NS7); Input handed the help panel; the label editor handed its edits; `label-editor` and `help` declared (NS8) |
| Deleted | T1; draw's input event as a type; the five bodies from `app/src/input.js`; `isShown` and `setShown` from `app/src/painter.js` |
| Held by | the corpus byte-identical; the lifecycle record; GR13; `tests/help.test.js` turning every documented input into a fact and matching its row |
| Behaviour changes | none: the same facts reach the same rows, and a claim made during delivery acts at once, as the reply's did in the adapter's `finally` (IC8) |
| Tests touched | `tests/input-capture-move.test.js` (its `FORM` checks restated to the fact); `tests/input-capture.test.js`; `tests/help.test.js`, `tests/pointer-bindings.test.js` and `tests/input-focus-loss.test.js`, whose events carry `on` and `region`; the twelve calls that hand Input an event literal; the three pins of `GESTURES` and `tests/fixtures/session-spy/wrapper.mjs`; `tests/canvas-labels.test.js` and `tests/canvas-panels.test.js`, the label editor's edits (appendix A) |

### 4.9 `snap-grid`

| | |
|---|---|
| Changes | the anchor's and the zone's places carry their grid alone (`plugins/layouts/layout-canvas.mjs:42`, `plugins/zones/zone-painter.mjs:54`); `clampDelta` reads the grid's bounds; the composition hands `Grids` the grids it draws; `grids` declared |
| Deleted | `ext` on each place and `placesOf`'s check that it equals the bounds (`app/src/snap.js:124-128`) |
| Held by | the corpus; `tests/canvas-grids.test.js` and `tests/layouts-canvas.test.js`; the grid parity record (`tests/fixtures/grid-parity-record.json`) |
| Behaviour changes | none |
| Tests touched | `tests/canvas-places.test.js`, whose refusal of a mismatched extent goes; `tests/layouts-canvas.test.js`, which reads `p.ext` and calls `Grids` four times; `tests/fixtures/scene-parity.mjs:559`; each test that declares a place (appendix A) |

---

## 5. The reveal's trace, a declared animation (B422)

**Today** (`plugins/simulation/reveal-painter.mjs:95-118`): on a link's show, its line's length is measured, an inline `stroke-dasharray` of that length and an equal `stroke-dashoffset` are written with no transition, a layout is forced, and a transition of the offset to `0` is armed; the inline dash is never taken away, so a control or down link revealed is drawn solid ever after, and a route made longer shows a gap (B422).

**Declared** (NS4):
1. On a link's show the reveal reads the line's `d` -- through `byId` at the trace move, through `ownShapeOf` from the painters move -- measures it with the page's probe, a path of draw's own never on the page (`app/src/painter.js:38-43`), computes `ms` as today (`traceOf`, `plugins/simulation/reveal.mjs:57-67`), and writes the trace, `run` the other name from the one this line last took.
2. The line carries `data-trace="<run>"` and `style="--trace-len: <len>; --trace-ms: <ms>ms"`: written on the line at the trace move, the mark `trace` from the painters move.
3. The stylesheet, beside the simulation's others: `[data-trace] { animation-duration: var(--trace-ms); animation-timing-function: ease-out; animation-fill-mode: both }`, `[data-trace="a"] { animation-name: trace-a }`, `[data-trace="b"] { animation-name: trace-b }`, and two identical keyframes holding `stroke-dasharray` at `var(--trace-len)` and taking `stroke-dashoffset` from `var(--trace-len)` to `0`.
4. At `show + ms` by the reveal's clock the trace ends, the attribute and style taken away and the line drawn with its own dash; meanwhile the fill mode holds it whole.

**Its lifecycle** (a:F2, o:F9), the reveal its one owner:

| Event | What happens |
|---|---|
| a pass of the loop | first every trace whose end has passed ends; then each active trace's `d` is read again and its length written if it changed; then today's pass |
| the loop | runs while the reveal holds a record or an active trace, `sync` and `paint` stopping it only when it holds neither |
| the record gone, by an undo or a cancel | `showAll` shows every withheld entity, each link tracing as today, and the loop runs on until those traces end |
| a hide | ends the line's trace at once and marks it `unrevealed`; the next show takes the other name, so a hide and a show in one task restart it |
| the entity removed | its trace and marks go with it -- with its element at the trace move, with its keys from the painters move; the reveal's entry ends on its instant, writing nothing |
| a document loaded | the same, every mark dropped; the reveal's `sync` on the load marks what the new record withholds |
| a route changed mid-trace | the length read again in the same task when the model changed -- the reveal's `sync` runs on every change, after the renderer's -- or on the next pass when the network's settle redraws a link with no change of its own, a frame later at most, 100 ms in a hidden tab; the animation keeps its time and draws the same fraction of the new line (measured) |
| the line described again, the trace unchanged | nothing written, the scene writing only what differs, and the animation runs on (measured); at the trace move, before the painters', a line drawn afresh loses its trace as today's does, its entry ending on its instant |
| the 100 ms tick | `hide` on every pass for what is withheld writes nothing while its mark stands |
| a mode change | nothing: a link is not modal; a node's fade untouched |

**The export keeps its bytes** (a:F1, o:F1): `server/svg-style.mjs` refuses any at-rule (`:70`) and parses every sheet but the chrome's, `plugins/simulation/simulation.css` among them, so revision 1's keyframes broke every export.\
The parser now leaves out a `@keyframes` block, its braces balanced, and adds the animation properties to `INTERACTIVE` beside `transition` -- what acts over time, which its own comment says a still picture leaves out (`:27`) -- refusing every other at-rule as today; the export composes no reveal and holds no mark (`server/svg.mjs:119-139`).\
Measured on a patched copy of the tree (`export-keyframes.mjs`): today's parser refuses the new sheet; the patched one reads 100 rules where it read 97 and exports each of the 18 documents byte for byte as today; `@media`, `@import` and `@font-face` are still refused; a traced line's drawn style holds no animation property; `tools/colour-tokens.mjs`, `tools/stylesheets.mjs` and `tools/scan-copies.mjs` pass, and 44 tests in `tests/svg-style.test.js`, `tests/svgexport.test.js`, `tests/run-picture.test.js` and `tests/scan-copies.test.js`.

**Measured in Chrome** (the probes and their outputs in `~/taceng/drawv2-eval-runs/h26-native-shapes/probes/`):
- revision 1's class form against today's, paused at the same fractions and screenshotted at the same place: at 0, 0.1, 0.25, 0.5, 0.75, 0.9 and 1 for an open line with corners, a dashed control line, a dotted down line and a closed ring offset by its own dash (`trace-declared-a.mjs`), and at 0.25, 0.5 and 0.9 for ten cases, draw's quadratic corners, arcs and a closed square among them (`trace-measured-all.mjs`) -- every screenshot equal, pixel for pixel;
- the attribute form above, its duration a custom property, against that class form at the same seven fractions, over a dashed line with corners and a dotted curve: equal pixel for pixel (`trace-lifecycle.mjs`);
- after the trace, each run left to finish: every case equal to the line never traced, where today's leaves the line solid -- 1,371 pixels differing from the untraced dashed line, 2,673 for the dotted, 2,335 for the ring (`trace-declared.mjs`); untraced at its end, the line's computed dash its own again, no animation left (`trace-lifecycle.mjs`);
- a hide and a show in one task: with the name alternated the animation restarts (its time 83 ms after the show); with the same name it runs on (800 ms), so the alternation is what the restart rests on (`trace-restart.mjs`);
- written again mid-run with the same values: the same animation, its time running on; its `d` changed to a longer route and its length rewritten mid-run: the same animation at the same time, its dash the new length and its offset the same eased fraction of it, 0.5548 before and after (`trace-lifecycle.mjs`);
- the normalised alternative, `pathLength="1"` with no measurement (NS4 b), equals today's on straight lines but differs at its moving tip on every curve and arc -- 6 to 471 pixels, by up to 195 in a channel (`trace-declared.mjs`, `trace-ring.mjs`, `trace-quad.mjs`).

**Proved at the move** by `tests/vector-scene-trace.test.js` restated: in Chrome, the cases above sampled by pausing the page's animations, the line's computed dash and offset and its pixels at each fraction against a reference drawn in a second frame by today's technique, written into the test; and the real reveal and its loop, unpaused, with their real timers: a trace ended by its own pass, the line's own dash computed and its pixels equal to an untraced line; a trace ended after the record is removed mid-trace and after `showAll`; an entity removed and a document loaded mid-trace, leaving no attribute; a hide and a show in one task restarting; a route changed and a head gained mid-flight; velocity mode; a node's fade untouched.\
A probe finding carried into that test: an animation the test pauses and plays leaves its effect on the line after the attribute is gone, which draw never does, so the test reads the end state from a run it never paused.

---

## 6. Before and after, by part

**Logic density** is read two ways, both by `tools/code-split.mjs --parts`: the declarative share -- the code lines of top-level tables, pure data or holding predicates, over all code lines -- and the logic lines each part holds.\
Baseline: `dev/CODE-SPLIT.md`, H26.8's baseline at `ca492da`, reproduced at `1ce06b5`.\
After: estimates; the basis is the measured code lines of each range section 2 names, deleted or moved, plus the lines a native form adds, estimated from the code it replaces; `=` is unchanged.

| Part | Lines | Share | Logic | After (est.) | Share (est.) | Logic (est.) | Basis |
|---|---:|---:|---:|---:|---:|---:|---|
| `lattice` | 156 | 14.1% | 134 | = | = | = | T8's 12 kept |
| `kind-contract`, `document`, `relations`, `colours`, `planner` | 1,198 | -- | 1,082 | = | = | = | untouched |
| `primitives` | 28 | 0.0% | 28 | 28 | 0.0% | 28 | `nameLabel` answers shapes in as many lines |
| `rules` | 55 | 18.2% | 45 | 20 | 50% | 10 | T2's 39 deleted; `openTable` 4 |
| `layouts` | 69 | 52.2% | 33 | = | = | = | a key dropped from one line |
| `devices` | 552 | 52.5% | 262 | 534 | 53.7% | 247 | T5's 23 deleted; its parts as shapes, 5 more |
| `network` | 1,719 | 21.3% | 1,353 | 1,680 | 21.4% | 1,321 | T5's 32 deleted; the pipe drawer's 35 for a painter of about 25, a table, and a hook of 3 |
| `zones` | 171 | 63.7% | 62 | 165 | 65.5% | 57 | look and update, 16, for shapes of about 10 |
| `groups` | 169 | 66.3% | 57 | 160 | 65.0% | 56 | likewise, 17 for about 8 |
| `simulation` | 572 | 14.2% | 491 | 572 | 15.9% | 481 | T6's 42 for marks of about 22; the trace's lifecycle about 10; the three marks declared, about 10 |
| `product` | 73 | 35.6% | 47 | = | = | = | `pipes` leaves `FOREIGN_LAYERS` |
| `canvas` | 2,182 | 13.3% | 1,892 | 1,784 | 8.0% | 1,642 | T1, the selector picks, the place check and `foreignStates` deleted (about 55); the five bodies, 101 declared, and `retarget` and `endRetarget`, 15, to `editing`; three parts out (263); the host, `deliver` and the hand-offs added (about 36) |
| `editing` | 179 | 1.1% | 177 | 324 | 31.8% | 221 | the five bodies (101, declared); `retarget` and `endRetarget` (15); `editing-states.js`, the reflections' 17 and about 12 more |
| `renderer` | 479 | 0.6% | 476 | 281 | 1.1% | 278 | T3 (115), T4 (106), the settle and the help panel's two deleted; the reflections (17) moved; descriptions, puts by part and marks added (about 43) |
| `grids`, `label-editor`, `help` (new) | -- | -- | -- | 261 | 18.0% | 214 | moved from `canvas`, each import of `canvas` handed in |
| `export` | 265 | 0.0% | 265 | 277 | 0.0% | 277 | the temporal rules left out, 12 |
| `sync`, `server`, doors but `export` | 5,449 | -- | 5,176 | = | = | = | untouched |
| `product-page` | 627 | 1.3% | 619 | 629 | 1.3% | 621 | the help panel handed, 2; the network attached without a layer and a builder |
| `lab` | 106 | 10.4% | 95 | = | = | = | likewise, in the same lines |
| **draw, running** | **14,049** | **12.5%** | **12,294** | **about 13,770** | **about 12.7%** | **about 12,020** | |

**The headline, an estimate:** draw's own code about 280 lines smaller, 2.0%, where revision 1 estimated 350 -- the reveal's lifecycle, the marks' declarations, the export's parser and the session's verbs kept in Input add back what it missed; the renderer about 41% smaller, the rules adapter 64%, `canvas` about 18%; the declarative share about flat; the tests about 650 code lines smaller -- the copies, their old sides and `tests/fixtures/scene-trace-side.mjs`, about 950, out, and the recorder and the new tests, about 300, in.

What the measure will show: each part's row moving as above, three new rows, and `editing` gaining a declared share as the bodies' table arrives where `canvas` loses it.\
What it will not show:
- the translations and duplications retired, which are H26.8's substance: a function inside a table counts as declared whether it translates or not, and the shadow's logic leaving is partly replaced by the renderer's descriptions, so the share barely moves; section 2's inventory, re-measured at each move, is that measure, 427 lines and eight duplications today, 12 and two at the close;
- whether a boundary is sovereign: that is the scanners' -- `tools/generate-architecture.mjs` over each `consumes`, L12 over `COMPONENTS`, the scene-read rule -- not a line count;
- behaviour, which is the record's and the tests'.

What the decisions change: the network's drawer kept (NS3 b) keeps its 35 lines and `foreignStates`' 14 where a painter of 25 and a hook of 3 would stand, so draw about 260 smaller, with a selector read kept in the picks; today's lifetimes kept exactly (NS13 b) keeps the renderer's signatures and each plugin's `structure`, about 14; the label editor's boxes by a geometry query (NS8 b') adds about 15 to the editor, the exception gone.\
Each move measures its own row, and H26.8's close records the table again in `dev/CODE-SPLIT.md`, beside this baseline (H26-16).

---

## 7. Decisions owed

Each offered with its options and their costs and a recommendation apart; marked *the director's* where the director's judgement is needed, the rest the architect's to settle at ratification.

| # | Decision | Options, and what each costs | Recommendation, and why |
|---|---|---|---|
| NS1 | The moves: their order, and whether `vector-scene`'s is split | (a) seven -- binding, trace, painters, pipes, picks, capture, grid -- each its own guard (4.1); (b) revision 1's four, the scene in one -- one guard over every painter, the pipes, the picks and the trace, sharing the code it guards (o:F2); (c) (a) with the trace last -- the shadow cannot be deleted while today's trace forces a layout through it | (a): each guard holds one kind of change, the one visible change lands alone, and the painters move becomes a refactor the record holds exactly |
| NS2 | A painter's native form | (a) ordered named parts, `''` the own element, companions `<id>/<part>`, attribute orders pinned (appendix B); (b) top-level shapes keyed by serial, as the shadow keys them -- keys that name nothing, which picks by item cannot read; (c) one item per entity, companions as children -- the link's sibling structure gone, which the stylesheet's sibling rules and the export's grouping read | (a): stable keys a pick can read, the elements draw keeps kept, every order held by GR12 |
| NS3 | The pipes | (a) a painted kind, its own move, every model change describing every pipe again as `paint` reconciles today, the network's hooks kept (4.6); (b) the network's drawer, as today -- `foreignStates` and a `data-select` read kept, a pipe's hover lost on each repaint, and under H26.6 the network culling its own (B289); (c) the network's paint putting items through the scene -- two drawers into one scene, a key's owner unclear | (a), with (b) its fallback if the move's guard fails: revision 1's risk was a redraw on a link's change alone (a:F3, o:F7), which (a) no longer has; what remains is mechanism, held by the record over every trigger |
| NS4 (the director's) | The reveal's trace (B422) | (a) declared, the measured length and the duration custom properties, the name alternated per line, its lifecycle the reveal's, its own move; (b) declared and normalised, `pathLength="1"`, no measurement -- its moving tip differs on every curve (measured); (c) as written, B422 kept | (a): pixel-identical to today during the trace in every case run, nothing left after it, the export's bytes unchanged (section 5); a visible change, the fix, ruled here |
| NS5 | The reveal's marks and the towers' aim | (a) declared by the part that owns them, applied by the renderer to the description, set through `renderer.mark`; (b) the reveal and the towers handed the scene's elements -- against VS4, the scene's elements its own; (c) revision 1's `kit.markOf`, read by the device appearance -- the devices plugin knowing the towers | (a): one drawer per element, the owner of a mark the one part that knows it; the cost a mark-only put per changed bearing per frame, measured at the move |
| NS6 | Picks | (a) by item, through `itemOf`, words and parts, run regions declared apart; (b) by selector, as today -- against D8 | (a), as D8 ruled: the scene already says which item an element is, and the selectors leave the plugins |
| NS7 (the director's) | The five generic gestures' bodies | (a) to `editing`, behind a host of named verbs, the session's transitions and geometry policy Input's; (b) left in `canvas`, taking Input whole; (c) with their helpers too, as revision 1 -- the host would need the session's private state and `canvas`'s geometry, which `editing` may not import (a:F4, o:F3); (d) a component now -- no second consumer (P4) | (a), as D13 ruled: the boundary B389 names, held by the scanners and GR13, the extraction a move |
| NS8 (the director's) | The label editor, the help and grid drawing | (a) declared parts now -- `label-editor`, `help` consumed by the page, `grids` -- each marked for extraction; (b) left in `canvas`, its duty mixed; (c) components now -- no second consumer; and for the editor's reads, (a') five reads declared as the one exception and counted, or (b') each box answered from the description -- exact for a region and a text box's frame, not for its fallback, a whole device's box, which only the platform measures | (a) with (a'): H26-16's target holds every general duty a component's or a declared part's; the exception is the platform's box, counted, its revival B416's extraction |
| NS9 | The stored layout record | (a) kept, `{ pitch, offset, ext }`, `latticeGrids` its one translation; (b) stored as `snap-grid`'s declaration -- a migration of every document, template and seed, and of the agent door's answers | (a): a document's form is a contract with its readers, and H26.8 changes no stored byte |
| NS10 | The side-by-side copies | (a) each deleted by the move it holds, once the record or its own record has passed (4.2); (b) all kept until H26.8 closes -- copies of code already gone, held for nothing; (c) deleted before the moves -- the binding move unheld | (a): the copies share the live painters and guard nothing the record does not; each goes when nothing rests on it |
| NS11 | A refused table declaration's words | (a) the component's problems, as `openGestures` says its own; (b) the old matcher's words, keeping 27 lines of translation | (a): only a declaration nothing in draw produces is refused |
| NS12 | B418 and B425, whose triggers H26.8 meets | (a) each restated: B418 "an agent needs to perceive what a person sees on the canvas", the scene's items being that description; B425 "an agent or a person needs to change draw's configuration without a code change"; (b) either delivered inside H26.8 -- a route or a data file with no consumer | (a): neither has a consumer, and H26.8's shapes are functions, not the data B425 asks for |
| NS13 (the director's) | The states' and marks' lifetimes | (a) each shown while its owner holds it -- the changes 3.2 lists: hover, the idle ring, arming and a link end's drag state kept through a mode change and a structural change; `unrevealed` kept through a structural change; a tower's aim through a node redrawn in run mode; a pipe's hover through a repaint; (b) today's exactly -- the renderer dropping the transient states wherever today's drew afresh, which needs today's signatures and each plugin's `structure`, the double statement H26.8 retires, kept for this alone | (a): what is shown is what is held; each change ends a state lost while still true, and each is asserted by its own test |
| NS14 | The paint loop (`plugins/simulation/paintloop.mjs`) | (a) the simulation's, registered with a trigger; (b) a declared part now -- 19 lines whose two consumers are one plugin's | (a): the duty is general but its consumers and its clock are the simulation's (H26-10's "when a consumer appears") |

**Registered when this is ratified,** each with its revival trigger (RU3): the export's bounds from the parts' footprints (X7), "the export's frame is found wrong for a drawing, or H26.6 designs pan and zoom"; the paint loop as a part of its own (NS14), "a part other than the simulation derives what it draws from the clock -- H26.6's animated pan among them"; the label editor's boxes from the description (NS8 b'), "the label editor is extracted (B416)"; B422 is closed by the trace move (NS4), and B418 and B425 restated as NS12 says.

---

## 8. Axiom alignment audit (M7)

**Identity.**\
H26.8 at revision 2, read against `1ce06b5` (production's `ca492da`), the four components' released contracts, H26-9, H26-10, H26-11 as amended, H26-14, H26-15 and H26-16, and mission-kit at `a3f0cae`; audited in two layers: draw's parts, and the moves that carry them.

**Verdict.**\
Revision 2 is `pass, with guardrails`, by its author; reading 1 found revision 1's guards weaker than its claims -- an oracle sharing the code it guarded, a lifecycle and an invalidation graph unstated -- and its standing is to be confirmed by a second reading (M1).

| Layer | Axiom | Weight | How the design stands |
|---|---|---|---|
| parts | `A3` | load-bearing | Each component reached by one part in its own shapes; the general duties declared parts, the five bodies behind named verbs, the session's transitions Input's; one declared exception, the label editor's boxes, counted; no universal adapter (H26-9). |
| parts | `A1` | supporting | What a person sees is the scene's items, data readable whole, the own shape readable through `ownShapeOf`; each state and mark a value its owner holds and the renderer describes. |
| moves | `A8` | load-bearing | Each move held by a guard of its own; the drawing moves by a record written from `ca492da` before any drawing code changes, its allowed differences stated; the trace proved in Chrome with the real reveal and loop. |
| moves | `A5` | load-bearing | The page and the export from one description; the export's bytes measured unchanged with the trace's sheet loaded; the pixel probe finds nothing but B422's fix. |
| all | `A14` | load-bearing | Every translation and duplication inventoried and re-measured; what stays held, a row with its trigger. |
| all | `A4` | supporting | Records written before each move kept after it; each copy's L4 entry deleted with it. |
| all | `A2`, `A6`, `A7`, `A9` to `A13` | not materially implicated | No trait brings them into force beyond what the moves already keep; `A13` is served by section 7. |

**Layered application.**\
State and truth: one owner per element, one owner per state class and per mark, one description per item, a state shown while held.\
Composition: four components, one part each, natively; three new declared parts; the editing host and the marks the new interfaces, named.\
Integrity: each move verified as H26-15 rules, against a record independent of the code it rewrites, the copies deleted only when nothing rests on them.\
Director attention: four decisions marked the director's, each with a recommendation.

**Tensions, and how they resolve.**
- The declarative share flat against "logic density" as an aim: the measure counts functions in tables as declared, so H26.8 is read by translations and mechanisms (section 6), which it retires.
- The record's allowed differences against parity: each is stated with where it is compared (4.2); any other difference fails the move.
- The label editor's five reads against one owner per element: they read the platform's box and write nothing, counted by the scene-read rule, revisited at B416.
- Marks re-describing a node per frame against the towers' cache: one drawer per element is the boundary; a mark-only put calls no appearance; priced at the move.
- Three new parts against P4: declared inside draw, not extracted (H26-10).

**Deltas.**\
Seven moves and a record (section 4); three parts and four modules -- two of `editing`, the pipe painter and the record's recorder; the copies and their L4 entries gone; a scene-read rule; B422 closed; B418 and B425 restated; three rows registered.

**Guardrails for the build.**
- GR1: each component imported by its one part (`tools/scan-layers.mjs` L12 over `COMPONENTS`); no module imports two components.
- GR2: `app/src/shadow.js` absent; `composeParts` refuses a painter with `create` or `update` and one without `shapes` (a test).
- GR3: the kit holds exactly `model`, `mode`, `renderOpts`, `sizeOf`, `outlineOf` and `pillWidth` (`tests/canvas-painters.test.js`).
- GR4: `picksOf` refuses a `closest` or `self` pick (a test, at the picks move).
- GR5: Input receives the component's fact itself, frozen (a test of the delivery).
- GR6: `kernel/input-rules.mjs` exports the declaration, `openTable` and `openGestures` alone, and passes its neutrality test (`tests/input-rules.test.js:98`).
- GR7: `editing` imports `document` alone; `grids` and `help` import nothing outside their part; `label-editor` imports `document` and `kind-contract` (`tools/generate-architecture.mjs`).
- GR8: no module of `canvas`, `editing`, `renderer`, the three new parts or the plugins reads an element the scene made, but `app/src/capture.js`'s 2 and the label editor's 5 (the scene-read rule in `tools/scan-writers.mjs`, proved on fixtures); the Chrome test of the editors' placement.
- GR9: each move's guard (4.1) passed as written; the pixel probe finding nothing but B422's fix.
- GR10: section 5's trace test passes in Chrome, the reveal and its loop unpaused.
- GR11: `--parts` measured at each move and recorded at H26.8's close.
- GR12: for every document and mode of the record, each item's part order and each shape's attribute order equal to the record's on a load, and an element kept across an update (`native-shapes.test.js`, new in `tests/`).
- GR13: every phase of every body in `EDITING_GESTURES` run with a host alone, a frozen object of exactly 3.2's verbs, no Input (`editing-host.test.js`, new in `tests/`).

**Closeout hooks.**\
Each move's verifier re-checks GR1 to GR13 as its move reaches them; H26.8 closes when `dev/CODE-SPLIT.md` holds the closing table, section 2's inventory is re-measured at 12 lines, B422 is closed and every L4 copy is gone.

---

## 9. Reviews

H26-3 requires a multi-family reading through context-lab's review panel (M1) before ratification.\
Each reading is recorded here as it is made: its readers, its counts, and one disposition per finding with its reason.

### 9.1 Reading 1 -- 2026-10-27, of revision 1 at `1ce06b5`

Read cold through context-lab's review panel, `--tools on --verify`, by `gemini-4-argon` (`a`), `gpt-6-astra` (`o`) and `grok-4.20-non-reasoning` (`x`), none of which drafted it, the reading kept whole at `~/taceng/drawv2-eval-runs/h26-readings/ns/reading-1/` outside the repository.\
It reported 26 findings: 11 from `a`, 12 from `o` and 3 from `x`; 18 blocking, 7 should-fix and 1 minor.\
Every reader returned verdicts on the others' findings: `a` supported all 12 of `o`'s and refuted all 3 of `x`'s; `o` supported 10 of `a`'s 11, refuting a:F5, and refuted all 3 of `x`'s; `x` supported 5 of `a`'s and 1 of `o`'s.\
The director disposed of every finding, accepting all but x:F3; each was read against the code at `1ce06b5`, and each claim revision 2 newly rests on was measured, in Chrome or on a patched copy of the tree, the scripts in `~/taceng/drawv2-eval-runs/h26-native-shapes/probes/`.

| Finding | What it said | Disposition, and why |
|---|---|---|
| a:F1 | the trace's `@keyframes` break the export and its tests | **Fixed**, reproduced: the export's parser leaves out a `@keyframes` block and the animation properties as temporal, refusing every other at-rule; all 18 documents export byte for byte as today with the new sheet loaded (section 5). |
| a:F2 | the trace breaks under mid-trace re-renders, route changes and the 100 ms tick | **Fixed**: the reveal owns the whole lifecycle -- active traces, the loop running till they end, `showAll`, removal, a load -- the length read again from the line's current `d`, the element kept; a reroute and a re-put measured in Chrome; the test drives the real reveal unpaused (section 5). |
| a:F3 | pipes as a painted kind break on load, transit changes and settle | **Fixed**: 4.6's graph keeps today's rule -- every model change describes every pipe again -- and the network's settle, mode and load order, held by the record over each trigger; the pipes their own move, the drawer kept if its guard fails (NS3). |
| a:F4 | `help.js` is `chrome`, and the moved helpers reach what the host does not offer | **Fixed**: `help` is consumed by the page, Input handed the panel; the host lists every capability, the session's transitions and geometry Input's verbs (3.2); GR13. |
| a:F5 | attribute order, conditional attributes and `markOf` unspecified | **Fixed**: every order measured and pinned (appendix B), the kit stated exactly, marks declared by their part so no `markOf`, the aim's lifetime stated; GR12. |
| a:F6 | the pick form drops `button`, pipes' eligibility and the region's derivation | **Fixed**: `button` and `parts` in the form; a pipe answers by its `hit` part alone; run regions declared apart, each of the seven fields derived (3.2). |
| a:F7 | `hitWith`'s new signature and `tests/canvas-picks.test.js` missing | **Fixed**: `picksOf`, `hitWith` and `regionWith` stated exactly; `tests/canvas-picks.test.js`, `tests/pipe-select.test.js` and the nine callers listed (4.7, appendix A). |
| a:F8 | `fact.hit` breaks `eventsFor` and two tests | **Fixed**: `eventsFor` builds facts' `hit`; `tests/help.test.js`, `tests/pointer-bindings.test.js` and `tests/input-focus-loss.test.js` at the capture move. |
| a:F9 | the grid and capture moves omit tests and the two constructors | **Fixed**: `Grids({ scene, grids, model })` and `LabelEditor({ ..., edits })` stated; `tests/canvas-places.test.js`, `tests/layouts-canvas.test.js` and `tests/fixtures/scene-parity.mjs:559` listed. |
| a:F10 | section 2 of the target must cite H26-16; `scan-dead`'s allowances change | **Fixed**: the bullet authored at the first move; each `ALLOW` entry's fate listed (3.3). |
| a:F11 | the counts are wrong | **Fixed**, each re-measured: `app/src/renderer.js` 331, T4 106 over ranges that leave out what stays, X7 26, `GESTURES` 171, the five bodies 101. |
| o:F1 | the keyframes break every export | **Fixed**, as a:F1. |
| o:F2 | the parity oracle shares the painters being rewritten | **Fixed**: a record written from `ca492da` before any drawing code changes, its allowed differences stated; the copies deleted only once it passes (4.2). |
| o:F3 | the host cannot support the helpers assigned to it | **Fixed**, as a:F4. |
| o:F4 | the pick form drops the zone's right button | **Fixed**, reproduced: `button` kept; Shift+left and Ctrl+Shift+left over a zone still draw, held by the picks move's test. |
| o:F5 | run regions are not entity membership | **Fixed**: declared apart, a link's twin no entity and a zone one without Shift, as today; the drafting comparison holds all seven fields. |
| o:F6 | a painter-wide pipe pick selects link-laid pipes | **Fixed**: the pick names its parts, only a hand pipe's `hit` answering; the four pipe cases tested. |
| o:F7 | link redraws do not replace the pipe drawer's subscriptions | **Fixed**, as a:F3. |
| o:F8 | persistent states and aim marks change lifetimes unruled | **Fixed**: each state's and mark's lifetime stated, today's beside it (3.2); keeping each while held is the director's to rule (NS13), each change its own test. |
| o:F9 | trace cleanup stops when the reveal is cancelled | **Fixed**, as a:F2: the loop runs while a trace is active, `showAll`'s traces included. |
| o:F10 | the harness's fabricated targets cannot exercise picks by item | **Fixed**: 67 fabricated answers in 28 files migrated to the elements the scene made, through `scene.itemOf`, no fake `itemOf` (4.7). |
| o:F11 | GR8 is violated by the label editor and enforced by nothing | **Fixed**: the editor's five reads declared as the one exception; GR8 now a counted rule in `tools/scan-writers.mjs` with a placement test (3.2, 3.3). |
| o:F12 | the shared paint loop is not inventoried | **Fixed**: inventoried (2.2, 2.3); the simulation's, registered with a trigger (NS14). |
| x:F1 | `nameLabel` and `probe` missing from the inventory | **Fixed in substance**: both examined and recorded beside 2.1 -- `nameLabel` is rewritten in form, building through T3's builder, and the probe measures, kept; neither translates, so the total stands without them. |
| x:F2 | the painter form is not pinned by a test | **Fixed**, as a:F5: GR12. |
| x:F3 | `tools/layers.mjs` is not updated | **Not changed**, as `a` and `o` found and the director ruled: each move edits the manifest as it lands (appendix A), so it is unchanged at design, as expected. |

---

## Appendix A -- every site each move touches

*goes* -- deleted; *native* -- rewritten in the component's own shapes; *moves* -- to another part, unchanged in substance; *stays* -- draw's policy; *restated* -- a test or record changed to the native form.

| Site | Today | Move | Change |
|---|---|---|---|
| `kernel/input-rules.mjs:66-111` | tenants renamed, answers renamed, refusals re-worded | binding | goes; `openTable` added |
| `kernel/input-rules.mjs:45-58`, `:114-118` | the declaration; `openGestures` | binding | stays |
| `app/src/input.js:402-507` | every table Input holds, composed through `composeRules` | binding | native: `openTable`, `{ owner, rows }` |
| `app/src/input.js:669`, `:726`, `:1157`, `:1363`, `:1404`, `:1649` | `resolveInput(...).rule` | binding | native: `matchInput(...).match?.row` |
| `plugins/network/grammar.mjs:75-79` | the drag grammar's two tables | binding | native |
| `tests/fixtures/pre-binding/`, `tests/fixtures/binding-parity-press.json` | the old matcher, press and triggers | binding | goes |
| `tests/fixtures/binding-parity.mjs`, `tests/input-binding-parity.test.js` | matcher, press and lifecycle compared | binding | restated: the lifecycle and help records alone |
| `tests/input-rules.test.js`, `tests/pointer-bindings.test.js`, `tests/releases.test.js`, `tests/input.test.js`, `tests/network-grammar.test.js`, `tests/network-transit.test.js`, `tests/canvas-gestures.test.js` | tables through the adapter | binding | restated |
| `docs/ARCHITECTURE-TARGET.md` section 2; `tools/scan-dead.mjs` `ALLOW` `overlapsIn` | the chain; the gate instrument's allowance | binding | H26-9 and H26-16 cited; goes |
| `tests/fixtures/scene-parity.mjs` `boards` and the drawing code | the 18 documents | the record | `native-record.mjs` and its record, new in `tests/fixtures/` |
| `plugins/simulation/reveal-painter.mjs:58-118` | the loop's start and stop, `showAll`, the trace through a node | trace | the lifecycle and the declared trace (section 5) |
| `plugins/simulation/simulation.css` | the movers' rules | trace | the trace's declaration added |
| `server/svg-style.mjs:31`, `:66-70` | `INTERACTIVE`; any at-rule refused | trace | the animation properties and a `@keyframes` block left out |
| `app/src/painter.js:44`, `app/src/compose-canvas.js:77` | the trace's settle, handed to the renderer | trace | goes |
| `tests/fixtures/scene-trace-side.mjs`, `tests/vector-scene-trace.test.js`, `tests/reveal.test.js`, `tests/svg-style.test.js` | today's trace against the shadow's; the export's refusals | trace | goes; restated: section 5's test; the temporal cases |
| `app/src/shadow.js` | the live shadow | painters | goes |
| `app/src/renderer.js:43-52`, `:162-172`, `:228-244`, `:273-310`, `:438-479`, `:504-512`, `:558-570` | look applier, shadow bookkeeping, lookups, batching, puts by serial, update, signatures, element states | painters | native: descriptions, puts by part, states and marks applied |
| `app/src/renderer.js:312-331` | selection and reflections | painters | moves to `editing-states.js`, new in `app/src/` |
| `app/src/compose-canvas.js:77-78` | the renderer's selected look | painters | the renderer and the selection handed `editing-states.js` |
| `app/src/input.js`, `app/src/overlay.js` | `renderer.setState` and `clearState` (16 sites) | painters | `editing-states.js`'s `set` and `clear` |
| `kernel/renderer.mjs:33-36` | `nameLabel` over a builder | painters | native |
| `plugins/zones/zone-painter.mjs:25-49`, `plugins/groups/group-painter.mjs:23-49` | create, update, look, finders | painters | native: `shapes` |
| `plugins/network/link-painter.mjs:57-139` | create, update, finders, companions | painters | native: parts `''`, `head`, `leg`, `hit` |
| `plugins/network/anchor-appearance.mjs:25-70`, `plugins/devices/device-appearance.mjs:38-136`, `plugins/simulation/spawn-appearance.mjs` | appearance parts over a builder; looks | painters | native; the simulation's marks declared |
| `plugins/simulation/reveal-painter.mjs:95-118`, `plugins/simulation/mover-painter.mjs:314-352` | the trace and the hide through a node; the towers' glyph cache and its clear | painters | native: marks |
| `tests/fixtures/pre-scene/`, `tests/fixtures/pre-export/` | today's renderer, painter and export | painters | goes, once the record passes |
| `tests/fixtures/scene-parity.mjs`, `tests/vector-scene-parity.test.js` | the side-by-side and the editing trees | painters | restated: the editing trees against their record alone |
| `tests/renderer.test.js`, `tests/appearance.test.js`, `tests/appearance-pipeline.test.js`, `tests/drawing-order.test.js`, `tests/anchor-redraws.test.js`, `tests/canvas-painters.test.js`, `tests/canvas-reflects.test.js`, `tests/link-heads.test.js`, `tests/run-picture.test.js`, `tests/consumer-parity.test.js`, `tests/span.test.js`, `tests/vector-scene-move.test.js` | the renderer over the harness | painters | restated to shapes |
| `tests/reveal.test.js`, `tests/movers.test.js` | the reveal, the towers | painters | restated to marks |
| `plugins/network/host.mjs:58-93`, `:119-123` | the pipes' own drawer; the settle | pipes | native: `pipe-painter.mjs`, new in `plugins/network/`; the settle kept |
| `app/src/compose-canvas.js:96-116`; `tools/scan-dead.mjs` `ALLOW` `foreignStates` | `foreignStates`; its allowance | pipes | goes |
| `product/canvas.mjs:62-69` | `pipes` foreign | pipes | a scene layer; `FOREIGN_LAYERS` the movers' alone |
| `app/src/main.js:85`, `lab/src/root.js:111` | the network attached with the pipe layer and `el` | pipes | stays, without them |
| `tests/network-pipes.test.js`, `tests/pipe-select.test.js`, `tests/run-picture.test.js`, `tests/core-names-no-plugin.test.js` | pipes drawn by the network; the composition's names | pipes | restated |
| `app/src/pick.js:32-83`, `:123-125`, `app/src/capture.js:52-67` | picks and regions by selector | picks | native: by item, `hitWith` and `regionWith` |
| each painter's and appearance's `picks`; `drawn` and `runTargets` in the zones, groups, devices and network parts | selectors | picks | native: words, parts and `run` |
| `tests/canvas-picks.test.js`, `tests/pipe-select.test.js`, `tests/canvas-gestures.test.js`, `tests/help.test.js`, `tests/input-capture.test.js`, `tests/input-capture-move.test.js`, `tests/pointer-bindings.test.js`, `tests/scan-layers.test.js`, `tests/fixtures/client-harness.mjs` | call `picksOf`, `hitWith` or `regionsOf` | picks | restated |
| `tests/fixtures/client-harness.mjs`, `tests/fixtures/gesture-corpus.mjs`, `tests/input.test.js`, `tests/affordance.test.js`, `tests/b242-reconcile-paths.test.js`, `tests/canvas-chrome.test.js`, `tests/canvas-grids.test.js`, `tests/canvas-hand.test.js`, `tests/canvas-panels.test.js`, `tests/canvas-points.test.js`, `tests/canvas-runs.test.js`, `tests/duplicate-waypoints.test.js`, `tests/guide-gesture.test.js`, `tests/input-chord-other-pointer.test.js`, `tests/input-focus-loss.test.js`, `tests/input-press-resolution.test.js`, `tests/pair-capacity.test.js`, `tests/releases.test.js`, `tests/wide-devices.test.js`, `tests/network-transit.test.js` and the picks row above | 67 fabricated `closest` answers | picks | restated: `targetOf`, where they stand for what the scene draws |
| `app/src/capture.js:73-87`, `:114-126` | `ROUTE`, `inputEventOf`, the write-back | capture | goes; `deliver` hands the fact and its reply |
| `app/src/input.js:91-352`; `tools/scan-dead.mjs` `ALLOW` `GESTURES` | `GESTURES`; its allowance | capture | `move`, `clone`, `pending`, `clone-pending`, `handle`, `marquee` to `editing-gestures.js`, new in `app/src/`; `link` and `box` stay, the allowance restated |
| `app/src/input.js:743-752`, `:1034-1084` | `beginPress`, `endRetarget`, `retarget`, `escalate`, `updateMove` | capture | `retarget` and `endRetarget` move with the bodies; the rest stay Input's, offered as the host's verbs |
| `app/src/input.js:634-693`, `:1008-1149`, `:1317-1347`, `:1400-1423`, `:1640-1673` | entry points over draw's input event | capture | native: facts and replies |
| `app/src/recognize.js`, `plugins/zones/zone-gestures.mjs`, `plugins/network/link-handles.mjs` | rows reading `e.on` | capture | native: `fact.hit` |
| `plugins/devices/device-panels.mjs`, `plugins/simulation/spawn-runs.mjs`, `plugins/network/keys.mjs` | rows reading `region`, writing `claimed` | capture | native: `fact.hit.region`, `reply.claim()` |
| `app/src/help.js:26-50` | `eventsFor`, events with `on` and `region` | capture | native: facts' `hit`; the `help` part |
| `app/src/painter.js:61-62`, `app/src/input.js:42`, `:1387-1406` | the help panel's visibility, imported by Input | capture | moves to `app/src/main.js`, Input handed the panel |
| `app/src/labeledit.js:8`, `:18`, `:197`, `:205` | imports the commands, handed `history` | capture | handed its two edits; the `label-editor` part |
| `app/src/actions.js` | in `canvas` | capture | the `help` part |
| `tests/input-capture-move.test.js`, `tests/input-capture.test.js`, `tests/help.test.js`, `tests/pointer-bindings.test.js`, `tests/input-focus-loss.test.js` | the input event's form | capture | restated to the fact |
| `tests/canvas-gestures.test.js`, `tests/wide-devices.test.js`, `tests/input.test.js`, `tests/canvas-grids.test.js` | event literals handed to Input | capture | restated to facts |
| `tests/fixtures/binding-parity.mjs:34`, `tests/input-binding-move.test.js:120`, `tests/releases.test.js:140`, `tests/fixtures/session-spy/wrapper.mjs` | pins of `GESTURES`; the spy | capture | restated to `EDITING_GESTURES` and the host |
| `tests/canvas-labels.test.js`, `tests/canvas-panels.test.js` | `new LabelEditor` with `history` | capture | restated: `edits` |
| `app/src/snap.js:71-90`, `:124-128` | `clampDelta` reads `ext`; the extent checked | grid | native: the grid's bounds; the check goes |
| `plugins/layouts/layout-canvas.mjs:42`, `plugins/zones/zone-painter.mjs:54` | places with `ext` and `grid` | grid | native: `grid` alone |
| `app/src/grids.js:12`, `app/src/compose-canvas.js:68` | grids found through `app/src/snap.js` | grid | handed by the composition; the `grids` part |
| `tests/canvas-places.test.js`, `tests/layouts-canvas.test.js`, `tests/fixtures/scene-parity.mjs:559`, `tests/canvas-grids.test.js` | places with `ext`; `Grids` handed the parts | grid | restated |
| `tools/layers.mjs` | parts, layer lists, entries, L4, alignment | each | as section 3.3 says, each move its own rows |
| `tools/scan-writers.mjs` | no scene-read rule | painters | the rule, its counts falling to 2 and 5 at the picks move |
| `docs/ARCHITECTURE.md`, `docs/ARCHITECTURE-TARGET.md` | generated parts | each | regenerated |
| `dev/CODE-SPLIT.md` | H26.8's baseline | each | each move's row; the closing table |

---

## Appendix B -- the shape form today, measured

Each shape's attributes in order on a fresh draw, read from the scene's descriptions over the 18 documents the side-by-side draws, in view, edit and run mode (`attr-orders.mjs`); a bracketed attribute is conditional and stands at its place when present; a state's class is set apart (3.2).\
The native painters and appearances describe exactly these, held by GR12.

| Layer | Shape | Attributes, in order |
|---|---|---|
| `zones` | `g.zone` | `id class` |
| `zones` | `rect.zone-rect` | `class rx x y width height` |
| `zones` | `rect.label-pill` | `class rx height x y width` |
| `zones` | `text.label.zone-label` | `class font-size x y` |
| `pipes` | `g.pipe-of` | `class data-pipe` (read from `plugins/network/host.mjs:69`, `:88`) |
| `pipes` | `line.pipe`, the pipe's own | `id stroke stroke-width fill [stroke-dasharray] x1 y1 x2 y2 class` (`:70`, `:85`, `:87`) |
| `pipes` | `line.pipe-hit`, a hand pipe's | `class data-select stroke stroke-width fill x1 y1 x2 y2` (`:71`, `:86`) |
| `groups` | `g.group` | `id class` |
| `groups` | `rect.group-hull` | `class rx fill stroke stroke-width x y width height` |
| `links` | `path.link` | `id class fill d stroke-width [stroke-dasharray] [stroke-linecap] [data-down]` |
| `links` | `path.link-head` | `class data-head-of d fill stroke stroke-width stroke-linejoin [data-down]` |
| `links` | `path.link-leg` | `class data-leg-of d fill stroke stroke-width stroke-linecap [stroke-dasharray stroke-dashoffset] [data-down]` |
| `links` | `path.link-hit` | `class data-link d fill stroke stroke-width [stroke-linecap]` |
| `waypoints` | `g.waypoint` | `id class transform` |
| `waypoints` | `circle.wp-anchor`, view and edit | `class r fill stroke stroke-width stroke-opacity` |
| `waypoints` | `circle.wp-ring`, `circle.wp-junction` | `class r fill stroke stroke-width stroke-opacity` |
| `waypoints` | `circle.wp-dot` | `class r fill` |
| `waypoints`, `nodes` | `path.select-box` | `class d` |
| `nodes` | `g.node` | `id class [data-span] [data-content] transform` |
| `nodes` | `use`, the frame | `data-layer href` |
| `nodes` | `rect.frame`, a spanned or content device's frame | `data-layer class x y width height rx stroke-width` |
| `nodes` | `svg`, the body | `x y width height preserveAspectRatio viewBox` on 303; `x y width height viewBox preserveAspectRatio` on 6 |
| `nodes` | `use`, the glyph, beneath the body | `data-layer href`, then `[data-aim transform]` while aimed |
| `nodes` | `rect.label-pill` | `class rx y height x width` |
| `nodes` | `text.label` | `class y font-size x` |
| `nodes` | `rect.socket`, edit mode | `class x y width height` |
| `nodes` | `rect.content-box` | `class x y width height rx fill stroke stroke-width` |
| `nodes` | `text.content-text` | `class x y text-anchor dominant-baseline font-family font-size fill` |
| `nodes` | `rect.clickable` | `class data-action x y width height fill`, or `class data-input data-idx x y width height fill` |
