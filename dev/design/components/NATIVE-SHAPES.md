# H26.8 -- native shapes: draw takes the four components' own shapes

The design of record for H26.8, which H26-16 aims at clean modular unification and sovereign boundaries, measured before and after by part.\
Draw stops translating between its own forms and the components': the editor reads `input-capture`'s facts, the tables are composed in `input-binding`'s own form, the canvas describes `vector-scene`'s shapes, the places carry `snap-grid`'s grids, and each adapter keeps only draw's policy and its wiring (H26-9).\
It builds on the four designs beside it (`SNAP-GRID.md`, `INPUT-BINDING.md`, `INPUT-CAPTURE.md`, `VECTOR-SCENE.md`), whose H26.8 columns it completes, and on `RELEASES-0.2.md` sections 4 and 8, which left draw on `input-capture`, `input-binding` and `vector-scene` `0.2.0` and `snap-grid` `0.1.0`.

**Standing:** a design under review, revision 1, drafted 2026-10-27; the code read is `0e469e1`, whose product tree is production's `ca492da` (no product file differs between them); code lines are measured by `tools/code-split.mjs` and its `classify`, the per-module and per-range scripts kept at `~/taceng/drawv2-eval-runs/h26-native-shapes/`; browser behaviour cited as measured was measured in headless Chrome over the DevTools protocol, the probes and their outputs in `probes/` there; every figure after H26.8 is an estimate, labelled with its basis; not ratified.

---

## 1. What this decides, and what it does not

It decides:
- an inventory of every translation between draw's forms and a component's, every mechanism draw holds twice, and every part whose duty is mixed or whose boundary is undeclared, each with its code lines (section 2);
- the target part map, each part one duty behind a declared boundary, the component each speaks natively, and the manifest changes that hold it (section 3);
- the four moves, one component at a time, their order, what each deletes, how behaviour is held and which behaviour changes (section 4);
- the reveal's trace as a declared animation, which fixes B422 (section 5);
- the projection by part, before and after (section 6).

It does not decide:
- pan and zoom (H26.6), which this must not make harder: every term it relies on -- items, conversions, `itemAt` -- keeps its meaning under a view (`VECTOR-SCENE.md` D6), the pipes leave the foreign layers, and the movers alone stay foreign;
- extracting any component: the general duties it names become declared parts of draw, extracted when a second consumer is in sight (H26-10);
- the stored document's form: a layout record stays `{ pitch, offset, ext }` (NS9);
- draw's configuration as data files (B425) or the description offered to agents (B418), whose triggers H26.8 meets and which it restates (NS12);
- any behaviour change beyond those section 4 names, each ruled with this design.

---

## 2. What draw holds today

Read from the code at `0e469e1`; appendix A lists every site each move touches.

### 2.1 Translations

| # | Adapter | What it converts | Where | Code lines |
|---|---|---|---|---|
| T1 | `input-capture`'s | a frozen fact into draw's mutable input event, field by field in the old key order; the route by fact type; the event's `claimed` and `capture` written back into the reply | `app/src/capture.js:73-87`, `:114-126` | 25 of 88 |
| T2 | `input-binding`'s | tenants' `rules` renamed `rows`; the answers renamed -- `rule` for `match.row`, `input` and `situation` for `fact` and `context`; a refused declaration re-worded into the old matcher's messages | `kernel/input-rules.mjs:66-111` | 39 of 55 |
| T3 | `vector-scene`'s | element-shaped shadow nodes, with the platform's semantics wherever draw's drawing code could tell, described to the scene | `app/src/shadow.js` | 115 |
| T4 | `vector-scene`'s | the renderer's bookkeeping for the shadow: fragments, dirty marks, batching, puts keyed by serial, `applyLook`, signatures, lookups of its own elements | `app/src/renderer.js:43-52`, `:162-171`, `:228-244`, `:273-310`, `:438-512`, `:548-567` | about 92 of 327 (the lines a native renderer drops) |
| T5 | `vector-scene`'s | each plugin's second statement of how its item looks -- an `update` beside its `create`, a `look` with element finders, a `structure` signature, companions found again by selector | `plugins/network/link-painter.mjs:62-66`, `:87-139` (32); `plugins/devices/device-appearance.mjs:69-90`, `:103`, `:135` (23); `plugins/groups/group-painter.mjs:29`, `:43-49` (8); `plugins/zones/zone-painter.mjs:30`, `:47-49` (4); `plugins/network/anchor-appearance.mjs:54` (1) | 68 |
| T6 | `vector-scene`'s | the reveal and the towers holding the renderer's elements: a trace measured and forced through a node, a glyph cached while connected | `plugins/simulation/reveal-painter.mjs:95-118`, `plugins/simulation/mover-painter.mjs:314-345` | about 18 of 42 |
| T7 | `vector-scene`'s | a state of an id the renderer did not draw, found by selector beneath the foreign layers; the trace's settle | `app/src/compose-canvas.js:96-116`, `app/src/painter.js:44` | 15 |
| T8 | `snap-grid`'s | a place's extent declared beside its grid and cross-checked; a stored layout record into a declaration | `app/src/snap.js:124-128` (5); `kernel/geometry.mjs:25-36` (12, the stored form's boundary, kept) | 17 |

So about 389 code lines, 2.8% of draw's 14,049, translate; H26.8 retires all but T8's 12.\
The adapters' policy stays: capture's field and control tests, menu and focus loss (`app/src/capture.js:96-113`, `:127-170`); binding's guards, claim and gesture field (`kernel/input-rules.mjs:45-58`); the lattice's grids, anchors, dot and hull (`kernel/geometry.mjs`).

### 2.2 Mechanisms held twice

| # | Held twice | Where | Code lines | Disposition |
|---|---|---|---|---|
| X1 | keyed drawing: the renderer and the scene keep items by key, and the network keeps its own map of pipe elements by id, making, updating and removing them, a hook letting the renderer's states reach them | `plugins/network/host.mjs:58-110`; `app/src/compose-canvas.js:96-116` | 57 | held once: the pipes a painted kind (NS3) |
| X2 | what lies under the pointer on the page: draw's picks by selector over the target, beside the scene's `itemOf` and `itemAt`, which answer the same by element and which draw does not call | `app/src/pick.js:32-83`, `:123-125` (44); `app/src/capture.js:52-67` (16); each plugin's `picks`, `drawn`, `runTargets` | about 60 | held once: picks by item (NS6), as D8 ruled |
| X3 | what an item looks like: once built by `create`, again by `update` with `look` and its finders, the renderer signing which applies | T4, T5 | (in T4, T5) | held once: the scene diffs one description |
| X4 | the reveal's mark and trace and the towers' aim, written onto elements outside the renderer that drew them | T6 | (in T6) | held once: marks the renderer describes (NS5) |
| X5 | an entity's state classes: the renderer's for what it drew, the network's own for a pipe's `selected`, and the hook for `hover` and `armed`, lost on each repaint (`VECTOR-SCENE.md` section 11) | `app/src/renderer.js:312-331`, `:561-567`; `plugins/network/host.mjs:97` | (in X1) | held once: states the `editing` part answers, every item described with them |
| X6 | a place's extent and its grid's bounds | T8 | 5 | held once: the grid alone |
| X7 | the export's bounds, re-derived by parsing `transform` and `d` out of the description, beside the parts' footprints | `server/svg.mjs:91-117` | 21 | kept: the export's own (H2), and changing it changes the export's bytes |
| X8 | the palette's tiles built by `buildPreview`, beside the stamp ghost's shapes | `app/src/painter.js:48-54` | 7 | kept, as `VECTOR-SCENE.md` appendix B ruled: the tiles stand outside the canvas |

Not held twice, though it looks so:
- the page, the export and the lab draw through one renderer and one canvas composition (H2; H17 K8);
- what a drag lands on is answered by footprints (`app/src/pick.js:103-110`), draw's gesture policy -- a device grabbed within its frame and 4 more (`plugins/devices/device-footprint.mjs:67`) -- not a second hit test of what is painted;
- the canvas parts' declarations are read 40 times across ten modules, each slice composed once by its consumer;
- three nearness tests -- `nearOrigin`, the network's `near`, the devices' `inFootprint` -- are each a part's policy over one radius, `L_STD.frame.ext`.

### 2.3 Parts whose duty is mixed or whose boundary is undeclared

| Part, today | Code lines | What is mixed or undeclared | Target (section 3) |
|---|---|---|---|
| `canvas` | 2,182 | its duty is to turn input into edits, yet it holds the label editor (`app/src/labeledit.js`, 141, B416), the help overlay and its action labels (`app/src/help.js`, `app/src/actions.js`, 102, B417) and grid drawing (`app/src/grids.js`, 20, B415) | three declared parts (NS8) |
| `canvas`, `GESTURES` | 170 | eight gesture bodies each take the whole Input, `i`, the five generic ones reaching 20 of its members -- `ctx`, `model`, `overlayUi`, `selection`, `renderer`, `readout`, `hitFacts`, `decide`, `act` among them (`app/src/input.js:91-352`) | the five in `editing`, behind a declared host (NS7) |
| `renderer` | 479 | composition, states, the shadow, and DOM helpers for the foreign layers, the palette and the help panel's visibility (`app/src/painter.js:61-62`) | composition and description alone |
| `network`'s `host.mjs` | 93 | a pipe drawer of its own beside the renderer | a pipe painter |
| `simulation`'s reveal and towers | 42 | reach into the renderer's elements by `byId` and `glyphOf` (`app/src/renderer.js:228-244`) | marks through a declared verb |
| `primitives` | 28 | `nameLabel(el, g, ...)` takes the element builder (`kernel/renderer.mjs:33-36`) | answers shapes |

### 2.4 What holds draw's behaviour today

- **Verbatim copies, each pinned by its SHA-256 under L4's named exception,** their trigger "the verbatim copies are deleted (H26.8)" (`tools/layers.mjs:562-568`): today's renderer and painter (`tests/fixtures/pre-scene/`, 366 code lines with shims) and export (`tests/fixtures/pre-export/`, 184), run by `tests/vector-scene-parity.test.js` and `tests/vector-scene-trace.test.js`; and the old matcher, press and triggers (`tests/fixtures/pre-binding/`, 47), run by `tests/input-binding-parity.test.js`.
- **Records written before a move and replayed after:** the gesture corpus, 92 scenarios byte-identical (`tests/fixtures/gesture-corpus.json`); the editing layers' trees over the corpus (`tests/fixtures/scene-parity-record.json`); which gesture body ran for each input, and the help's projection (`tests/fixtures/binding-parity-lifecycle.json`, `tests/fixtures/binding-parity-help.json`); the booted page's DOM (`tests/fixtures/k8-dom.json`).
- **Live:** 514 calls in 28 test files dispatch platform events through the real capture (`tests/fixtures/client-harness.mjs` `captureDispatch`); the export's bytes (`tests/svgexport.test.js`, `tests/svg-style.test.js`); the pixel probe against production, no tolerance (`tools/probe/parity.mjs`).

---

## 3. The target

### 3.1 The part map

Each part one duty; *speaks* names the component it calls with that component's own shapes; *H26-10* names a duty general enough to become a component, extracted only when a second consumer is in sight.

| Part | Duty | Modules after H26.8 | Consumes | Speaks | H26-10 |
|---|---|---|---|---|---|
| `lattice` | Compute geometry on the grid | as today | -- | `snap-grid`: grids opened from declarations, the places carrying them | -- |
| `rules` | Declare what an input means: draw's guards, its claim and its gesture field | `kernel/input-rules.mjs`, `openTable` and `openGestures` over one declaration | -- | `input-binding`: `{ owner, rows }` tenants, `matchInput`, `findOverlaps`, the session | -- |
| `canvas` | Turn input into edits through the parts' declarations | as today but the modules below leave | `editing`, `grids`, `label-editor`, `help` beside today's | `input-capture`: facts and replies, Input taking each fact whole | -- |
| `editing` | Let a person select, move and resize what the canvas draws | today's three, `editing-gestures.js` and `editing-states.js`, new in `app/src/` | `document` | `vector-scene`'s items, handed the scene as a value | B389 |
| `renderer` | Describe a document through the parts' shapes | `app/src/renderer.js`, `app/src/painter.js` (the movers' builder, the palette's tiles, the trace's probe) | as today | `vector-scene`: `put`, `remove`, `items`, `itemOf`, `toDrawing`, `toScreen` | -- |
| `grids` | Draw the grids a diagram's places snap to | `app/src/grids.js` | -- | `vector-scene`'s items, `snap-grid`'s positions in view through the layouts plugin | B415 |
| `label-editor` | Edit a drawn label in place | `app/src/labeledit.js` | `document`, `kind-contract` | `vector-scene`'s `toScreen` | B416 |
| `help` | Show what each input does, from the tables' rows | `app/src/help.js`, `app/src/actions.js` | -- | `input-binding`'s `table.rows` | B417 |
| plugins | as today | as today | as today | each painter and appearance answering shapes; each row in `input-binding`'s form | -- |

Draw's own, staying in `canvas`: the readout, the commands, the commit boundary, the held tools, the picks and footprints, the situation and the rows; in `product-page`: the palette.\
B418 is met in form -- what a person sees is the scene's items, data -- and restated (NS12).

What pan and zoom (H26.6) will need, and how H26.8 leaves it:

| H26.6 needs | After H26.8 |
|---|---|
| a view the scene holds, a transform on its layers or the root's `viewBox` (`VECTOR-SCENE.md` D6) | as today, every layer's element the scene's, foreign or not, so a view carries all; the pipes' content now the scene's too, the movers' alone drawn outside it |
| picks under a moved view | by item, which no view changes; a captured pointer by `itemAt` |
| conversions | the scene's, as today |
| drawing only what is in view (B289) | each entity one description, put or removed whole, so a culled entity is one removal |

### 3.2 The native forms

**A painter answers its item's shapes** (NS2): `{ kind, layer, stacked, picks, shapes(entity, kit) -> parts | null, redraws?, modal? }`, `parts` an ordered list of `[part, shape]`, each `shape` `vector-scene`'s (VS5); the part `''` is the entity's own element, keyed by its id, and every other a companion keyed `<id>/<part>`, so a link answers `''`, `head`, `leg` and `hit`, and a head gained keeps the line and the twin as today.\
`kit` holds `model`, `mode`, `renderOpts`, `sizeOf`, `outlineOf`, `pillWidth` and `markOf`; no element builder, no layer, no look applier.\
`modal` asks a re-render when the mode changes, as the renderer re-renders the appearances' kinds today (`app/src/renderer.js:254`).

**The renderer puts each entity whole,** in its call, as `place` and `syncAll` order it today:
1. the painter's parts, or the composed `<g>`, are described, the own element's class gaining the states `editing-states.js` answers and its attributes the marks;
2. each part is put under its key, `<id>` or `<id>/<part>`, before the item of the next part it kept, or before the item `place` found from the layer's items, as `putOf` places them today (`app/src/renderer.js:293-310`);
3. a part no longer answered is removed; an entity no longer drawn has every key removed;
4. a state or a mark changed puts the entity's items again, the scene writing what differs, so no dirty marks, no batching and no fragments are kept.

**An appearance answers its parts' shapes:** `parts: { [layer]: (entity, kit, state) -> shapes }`; `state`, `composes`, `root`, `rootAttrs`, `addClass`, `selectBox` and `redraws` as today; `look` and `structure` go, the scene comparing one description to the last (VS7).\
The renderer composes the winner's `<g>` with the composers' parts in the order's layers, as `drawComposed` does (`app/src/renderer.js:516-531`), and describes it whole on every change.

**A state is a class in the description:** the entity's own element is the shape bearing its id, at any depth, so a pipe's line nested in its group carries its states; the classes are those `editing-states.js` answers for the id -- `selected`, `hover`, `armed`, `armed-clone`, each part's reflection -- and a state changed puts the item again, the scene writing the one attribute that differs.

**A mark is the renderer's to describe** (NS5): `renderer.mark(id, name, value)` records it and puts the item again; `unrevealed` writes `data-unrevealed=""` on the own element, `trace` the declared animation (section 5), and `aim` a glyph's `data-aim` and `transform`, which the device appearance reads through `kit.markOf`; the export sets none, so its bytes are untouched.

**A pick names a word, never a selector** (NS6): `{ word, modifier?, idle?, clones?, mark? }` on a painter or an appearance; `hit` asks `scene.itemOf(target)`, finds the item's entity by its key's first segment and the painter or winning appearance that drew it, and answers that drawer's pick; run mode's region is read from the shapes along the path -- the deepest holding `data-action` or `data-input` -- and the item's entity.

| Picked today by | Picked natively by |
|---|---|
| `closest: 'g.zone'`, Shift its modifier (`plugins/zones/zone-painter.mjs:39`) | an item of the zone painter; `modifier: 'shiftKey'`, a press without it passing through, as today (U1) |
| `closest: 'g.node:not(.ghost)'` (`plugins/devices/device-appearance.mjs:100`); `closest: 'g.waypoint'` (`plugins/network/anchor-appearance.mjs:44`) | an item of kind `node`, by the appearance that won it, `device` or `marks`; the stamp ghost an editing item, no entity's |
| `self: 'link'`, `self: 'link-hit'` and its `data-link` (`plugins/network/link-painter.mjs:75`) | the link's parts `''` and `hit`, one entity |
| a handle's class and dataset key (`app/src/pick.js:57-61`) | the editing part's `handles` item, the handle's name read from the shape at the path |
| a mark's `data-select`, a hand pipe's hit line (`app/src/pick.js:79-80`) | the pipe painter's item; `mark: true` |
| run mode's `drawn` and `runTargets` selectors (`app/src/pick.js:123-125`) | the item's entity, and the word its drawer gives |

**Input takes each fact whole:** `deliver(fact, reply)` routes by `fact.type` to today's entry points, the route `app/src/capture.js:73` held; `hit` answers draw's pick with `region` folded in on a `down`, `{ kind, id, handle?, mark?, region? }`.

| Draw's input event today (`app/src/capture.js:76-87`) | Read natively | Readers |
|---|---|---|
| `type`, `key`, the four modifiers | the fact's own, unchanged | every row |
| `button`, `0` for a key; `repeat`, `false` for a pointer | the fact's, `null` where its family carries none | rows test them only within their family, where both agree |
| `at`, `pointerId` | the fact's | Input, the session, the input state |
| `on`, `region` | `fact.hit`, its `kind` and `id`; `fact.hit.region` | `app/src/recognize.js`, `app/src/input.js`, three plugins' rows |
| `onControl` | `fact.focus.onControl` | Tab's run (`app/src/input.js:1460`) |
| `claimed`, `capture`, written by Input and rows | `reply.claim()`, `reply.takePointer()`, asked at once | Input, three plugins' runs |
| `trigger`, written by the release (`app/src/input.js:1116`) | the session's outcome, handed to the body | the link's and the marquee's commits (`:281`, `:343`) |

**The tables are `input-binding`'s:** `openTable(...tenants)` composes `{ owner, rows }` under draw's declaration, throwing the component's problems as `openGestures` throws its own; call sites ask `table.matchInput(fact, context, guards)` and read `match?.row`, and the gate asks `table.findOverlaps`.

**The editing gestures take a declared host** (NS7): `EDITING_GESTURES` in `editing-gestures.js`, the five bodies -- `move`, `clone`, `pending` with `clone-pending`, `handle`, `marquee` -- each `(host, ...)` where today's took `i`, the host a frozen object Input makes, as it makes `pluginHost` for the plugins' rows (`app/src/input.js:422-454`), holding exactly what the bodies reach today:

| Today's `i.` (the five bodies, `app/src/input.js:92-220`, `:338-352`) | The host's |
|---|---|
| `ctx` | the live gesture's working data, handed in and answered, never a member |
| `model` (set, delete, get), `selection`, `scene` | the same values, handed |
| `overlayUi`, `readout`, `renderer` (a state) | `crosshair`, `handles`, `setBox`, `setLink`, `setState` |
| `hitFacts`, `handleWords`, `tools` (the hand held) | `factsOf(word)`, `handleOf(word)`, `holding()` |
| `anchorAt`, `decide`, `act` | the same, draw's footprints and tables |
| `beginPress`, `escalate`, `updateMove`, `retarget`, `endRetarget` | moved with the bodies, the editing part's |
| `commitMove`, `commitClone` | `commitMove`, `commitClone`: draw's commits, Input's |

**A place carries its grid alone:** `{ kind, layout, grid, size | sizedBy }`, its extent the grid's `bounds`, read by `clampDelta` (`app/src/snap.js:71-90`); `latticeGrids` stays the one translation, from the stored record's form (NS9).

### 3.3 What the manifest says, so the scanners hold it

| `tools/layers.mjs` | Change |
|---|---|
| `PARTS` | `editing` gains `editing-gestures.js` and `editing-states.js`; `renderer` loses `app/src/shadow.js`, its duty "Describe a document through the parts' shapes"; `canvas` loses `app/src/grids.js`, `app/src/labeledit.js`, `app/src/help.js` and `app/src/actions.js` and consumes `grids`, `label-editor` and `help`; three parts added, each `kind: 'host'`, `by: ['H26-10', 'H26-16']`: `grids` consuming nothing, `label-editor` consuming `document` and `kind-contract`, `help` consuming nothing |
| `COMPONENTS` | unchanged: each component imported by one part |
| `ALLOWED`, `LAYER` | `ALLOWED` unchanged, every module staying in the `canvas` layer; `LAYER.canvas` and the page's and the lab's `ENTRIES` name the two new modules and drop `app/src/shadow.js` |
| `MOVED` | nothing moves: the new modules are new, `app/src/shadow.js` is deleted |
| `RULES.L4.verbatim` | both entries go with their copies |
| `MISSION_KIT`, `ALIGNMENT` | `renderer` waits "describes through it natively (H26-16)"; `editing` "its gestures' bodies joined at H26.8"; `grids`, `label-editor` and `help` aligned to candidates of their own, "a drawv2 candidate by H26-10" with B415, B416 and B417 |

So `tools/generate-architecture.mjs` fails an import outside each declared `consumes`; the edges run one way -- `canvas` to the four hosts it consumes, none back -- since `app/src/grids.js` is handed its grids (it imports `app/src/snap.js` today), `app/src/labeledit.js` its two edits (it imports `app/src/commands.js` today), and `app/src/help.js` takes `isShown` and `setShown` from `app/src/painter.js`, where they never belonged.

---

## 4. The moves

### 4.1 The order

Recommended (NS1): `input-binding`, then `vector-scene`, then `input-capture`, then `snap-grid`.
- **`input-binding` first:** the smallest, touching no plugin and no element, held by records already written; a verified move with little at stake, retiring one copy.
- **`vector-scene` second:** the largest, every painter changed, held by the one exact side-by-side the programme kept for it; it makes item keys meaningful -- `<id>/<part>` -- which the next move's picks read, and puts the states in `editing`, which the gestures' move joins.
- **`input-capture` third:** it rewrites Input's entry points, and with them the three places that pin `GESTURES` (`VECTOR-SCENE.md` section 5.3), so the bodies move to `editing` once, over native states and items.
- **`snap-grid` last:** a few lines, independent, with the `grids` part.

Each move runs as H26.1 to H26.5 ran: built by an agent that did not draft it, lab first, the gesture corpus replayed, the pixel probe against production, an independent verifier as H26-15 rules, and `node tools/code-split.mjs --parts` measured at its end.

### 4.2 `input-binding`

| | |
|---|---|
| Changes | `kernel/input-rules.mjs` keeps the declaration and gains `openTable`; Input composes every table it holds through it, `{ owner, rows }` (`app/src/input.js:402-507`); `plugins/network/grammar.mjs:75-79` likewise; each `resolveInput(...).rule` becomes `table.matchInput(...).match?.row`, each `overlapsIn` `findOverlaps` |
| Deleted | `composeRules`, `resolveInput`, `overlapsIn` and the refusal's re-wording (`kernel/input-rules.mjs:66-111`); `tests/fixtures/pre-binding/` and the matcher and press halves of `tests/fixtures/binding-parity.mjs`, with `tests/fixtures/binding-parity-press.json` (NS10) |
| Held by | the lifecycle record replayed byte-identical; the help's projection unchanged (`tests/fixtures/binding-parity-help.json`); the corpus; `tests/pointer-bindings.test.js`, `tests/releases.test.js` and `tests/input.test.js`'s overlap sweeps, restated to the component's calls |
| Behaviour changes | a refused declaration -- which no row of draw's is -- throws the component's problems, pointer and problem, where it threw the old matcher's words (NS11) |
| Tests touched | `tests/input-rules.test.js` (its guard and claim cases kept, its messages restated); every test composing a table (appendix A) |

### 4.3 `vector-scene`

| | |
|---|---|
| Changes | every painter and appearance answers shapes (3.2); `kernel/renderer.mjs` `nameLabel` answers its two shapes; the renderer puts each item whole, keyed by part, states and marks described; the network's pipes a painted kind in a scene layer, `pipes` no longer foreign, the link's `redraws` naming the pipes, `modal` (NS3); `editing-states.js` answers which ids carry which state class, `reflectSelection` and the parts' `reflects` moving there; the reveal and the towers mark (NS5); the trace declared (section 5) |
| Deleted | `app/src/shadow.js`; the renderer's T4 lines; each plugin's T5 lines; `byId`, `glyphOf`, `foreignStates`, `settleOf`; `plugins/network/host.mjs`'s pipe map; `tests/fixtures/pre-scene/`, `tests/fixtures/pre-export/` and the old sides of `tests/fixtures/scene-parity.mjs` and `tests/fixtures/scene-trace-side.mjs`, after the move's parity has run (NS10) |
| Held by | the side-by-side over every stored template, the parity board and the lab's boards, today's renderer against the native one: trees equal element for element and, on a fresh draw, attribute for attribute in order; every element today keeps, kept; the export byte-identical against today's; the corpus's editing trees against their record, kept as a test of its own; the K8 DOM corpus; the pixel probe against production finding nothing, since it plays no beat |
| Behaviour changes | B422 fixed (section 5); a pipe's `hover` and `armed` kept through its repaint, now described with the item; a link re-rendered mid-trace keeps its trace, and an entity re-rendered while unrevealed stays hidden, where today a fresh element shows until the reveal's next pass (read, not measured); where today a structural change made an element afresh, the scene keeps it when the tag at its place is the same, so more elements are kept and an attribute a patch adds stands after the others -- seen by nothing but a serialization of an edited page |
| Tests touched | the eleven that build the renderer over the harness, restated to shapes; `tests/canvas-painters.test.js`, `tests/vector-scene-move.test.js`, `tests/network-pipes.test.js`, `tests/pipe-select.test.js`, `tests/reveal.test.js`, `tests/movers.test.js`; `tests/vector-scene-trace.test.js` rewritten as section 5's test (appendix A) |

Constraints the native painters keep, each held by the side-by-side: attributes described in the order today's `create` wrote them -- its builder's, then its look's -- so the export's bytes and the K8 corpus stand; a link's parts in today's order, line, head, leg, twin, so the export's `withCompanions` and the stylesheet's sibling rules find them; a pipe's group, line and hit line in today's structure and attribute order.

### 4.4 `input-capture`

| | |
|---|---|
| Changes | `deliver` hands Input the fact and its reply (3.2); the rows read `hit` and `focus`: `app/src/recognize.js` (17 sites), `app/src/input.js`, `plugins/zones/zone-gestures.mjs`, `plugins/network/link-handles.mjs`, `plugins/devices/device-panels.mjs`, `plugins/simulation/spawn-runs.mjs`; claims through the reply in `app/src/input.js` (9 sites), `plugins/network/keys.mjs`, `plugins/simulation/spawn-runs.mjs`, `plugins/devices/device-panels.mjs`; picks by item, the plugins' `picks`, `drawn` and `runTargets` restated as words (NS6); the five bodies to `editing-gestures.js` behind the host (NS7); the `help` and `label-editor` parts declared (NS8) |
| Deleted | T1; `hitWith`'s selector walk, `regionOf`, `regionsOf`; draw's input event as a type |
| Held by | the corpus byte-identical; the 514 harness calls unchanged, since they dispatch platform events; the lifecycle record; a drafting comparison, outside the repository, of the selector picks and the item picks over every element each stored document's page draws, in each mode, with and without each modifier, every answer equal, kept with the move's evidence |
| Behaviour changes | none: the same facts reach the same rows, and a claim made during delivery acts at once, as the reply's did in the adapter's `finally` (IC8) |
| Tests touched | `tests/input-capture-move.test.js` (its `FORM` checks restated to the fact); `tests/input-capture.test.js`; the twelve calls that hand Input an event literal (`tests/canvas-gestures.test.js`, `tests/wide-devices.test.js`, `tests/input.test.js`, `tests/canvas-grids.test.js`, `tests/fixtures/binding-parity.mjs`); the three pins of `GESTURES` (`tests/fixtures/binding-parity.mjs:34`, `tests/input-binding-move.test.js:120`, `tests/releases.test.js:140`); `tests/fixtures/session-spy/wrapper.mjs` |

### 4.5 `snap-grid`

| | |
|---|---|
| Changes | the anchor's and the zone's places carry their grid alone (`plugins/layouts/layout-canvas.mjs:42`, `plugins/zones/zone-painter.mjs:54`); `clampDelta` reads the grid's bounds; the composition hands `Grids` the grids it draws, and the `grids` part is declared |
| Deleted | `ext` on each place and `placesOf`'s check that it equals the bounds (`app/src/snap.js:124-128`) |
| Held by | the corpus; `tests/canvas-grids.test.js` and `tests/layouts-canvas.test.js`; the grid parity record (`tests/fixtures/grid-parity-record.json`) |
| Behaviour changes | none |
| Tests touched | the tests that declare a place (appendix A) |

---

## 5. The reveal's trace, a declared animation (B422)

**Today** (`plugins/simulation/reveal-painter.mjs:95-118`): on a link's show, its line's length is measured, an inline `stroke-dasharray` of that length and an equal `stroke-dashoffset` are written with no transition, a layout is forced, and a transition of the offset to `0` is armed; the inline dash is never taken away, so a control or down link revealed is drawn solid ever after, and a route made longer shows a gap (B422).

**Declared** (NS4):
1. On a link's show the reveal measures the line's `d` with the page's probe -- a path of draw's own never put on the page (`app/src/painter.js:38-43`), which reads no layout of the page -- computes its duration as today (`traceOf`, `plugins/simulation/reveal.mjs:57-67`), and marks it: `renderer.mark(id, 'trace', { len, ms, run })`, `run` alternating `a` and `b` at each show.
2. The renderer describes the line with the class `tracing tracing-<run>` and `style="--trace-len: <len>; animation-duration: <ms>ms"`.
3. The stylesheet declares it, beside the simulation's others: `.tracing { animation-timing-function: ease-out; animation-fill-mode: both }`, `.tracing-a { animation-name: trace-a }`, `.tracing-b { animation-name: trace-b }`, and two identical keyframes taking `stroke-dasharray` from `var(--trace-len)` and `stroke-dashoffset` from `var(--trace-len)` to `0`.
4. On its first pass past `show + ms` the reveal clears the mark, and the line is described with its own dash again; meanwhile the fill mode holds it whole.
5. A hide clears the trace and marks `unrevealed`; the next show takes the other name, so a hide and a show in one task -- nothing read between -- restart it by the animation's own rule.

**Measured in Chrome** (the probes and their outputs in `~/taceng/drawv2-eval-runs/h26-native-shapes/probes/`):
- during the trace, each way paused at the same fractions of its timing and screenshotted at the same place: at 0, 0.1, 0.25, 0.5, 0.75, 0.9 and 1 for an open line with corners, a dashed control line, a dotted down line and a closed ring offset by its own dash (`trace-declared-a.mjs`), and at 0.25, 0.5 and 0.9 for ten cases, draw's quadratic corners, arcs and a closed square among them (`trace-measured-all.mjs`) -- every screenshot equal to today's, pixel for pixel;
- after it, each run left to finish: every case equal to the line never traced, where today's leaves the line solid -- 1,371 pixels differing from the untraced dashed line, 2,673 for the dotted, 2,335 for the ring (`trace-declared.mjs`);
- a hide and a show in one task: with the name alternated, the animation restarts (its time 83 ms after the show); with the same name it runs on (800 ms), so the alternation is what the restart rests on (`trace-restart.mjs`);
- the normalised alternative, `pathLength="1"` with no measurement (NS4 b), equals today's on straight lines but differs at its moving tip on every curve and arc -- 6 to 471 pixels, by up to 195 in a channel -- since the platform's normalisation and its measure disagree on a curve's length (`trace-declared.mjs`, `trace-ring.mjs`, `trace-quad.mjs`).

**Kept out of the export by construction:** the export composes no reveal (`server/svg.mjs:119-139`), so it marks nothing and its bytes are unchanged.

**Proved at the move** by `tests/vector-scene-trace.test.js` restated: in Chrome, the cases above sampled by pausing the page's animations, the line's computed dash and offset and its pixels at each fraction against a reference drawn in a second frame by today's technique, written into the test, since draw's old reveal goes with the copies; after the end, the line's own dash computed and its pixels equal to an untraced line; a hide and a show in one task restarting; a route changed and a head gained mid-flight; velocity mode; a node's fade untouched.\
A probe finding to carry into that test: an animation the test pauses and plays leaves its effect on the line after the class is gone, which draw never does, so the test reads the end state from a run it never paused.

---

## 6. Before and after, by part

**Logic density** is read two ways, both by `tools/code-split.mjs --parts`: the declarative share -- the code lines of top-level tables, pure data or holding predicates, over all code lines -- and the logic lines each part holds.\
The measure counts a function's body inside a table as declared, so a painter's `shapes` counts as declared while a renderer's method counts as logic; H26.8 is better read by the translation lines and the mechanisms of section 2, which go from about 389 lines and eight duplications to 12 lines and two duplications kept.

Baseline: `dev/CODE-SPLIT.md`, H26.8's baseline at `ca492da`, reproduced at `0e469e1`.\
After: estimates; the basis is the measured code lines of each range section 2 names, deleted, plus the lines a native form adds, estimated from the code it replaces; `=` is unchanged.

| Part | Lines | Share | Logic | After (est.) | Share (est.) | Logic (est.) | Basis |
|---|---:|---:|---:|---:|---:|---:|---|
| `lattice` | 156 | 14.1% | 134 | = | = | = | T8's 12 kept |
| `kind-contract`, `document`, `relations`, `colours`, `planner` | 1,198 | -- | 1,082 | = | = | = | untouched |
| `primitives` | 28 | 0.0% | 28 | 28 | 0.0% | 28 | `nameLabel` answers shapes in as many lines |
| `rules` | 55 | 18.2% | 45 | 20 | 50% | 10 | T2's 39 deleted; `openTable` 4 |
| `layouts` | 69 | 52.2% | 33 | = | = | = | a key dropped from one line |
| `devices` | 552 | 52.5% | 262 | 534 | 53.7% | 247 | T5's 23 deleted; its parts as shapes, 5 more |
| `network` | 1,719 | 21.3% | 1,353 | 1,670 | 21.8% | 1,305 | T5's 33 deleted; the pipe map's 43 for a painter of about 25 |
| `zones` | 171 | 63.7% | 62 | 165 | 65.5% | 57 | look and update, 16, for shapes of about 10 |
| `groups` | 169 | 66.3% | 57 | 160 | 65.0% | 56 | likewise, 17 for about 8 |
| `simulation` | 572 | 14.2% | 491 | 552 | 14.7% | 471 | T6's 42 for marks of about 22 |
| `product` | 73 | 35.6% | 47 | = | = | = | `pipes` leaves `FOREIGN_LAYERS` |
| `canvas` | 2,182 | 13.3% | 1,892 | 1,744 | 8.1% | 1,602 | T1, the selector picks, the place check and `foreignStates` deleted (53); the five bodies and their helpers to `editing` (157); three parts out (263); the host and `deliver` added (35) |
| `editing` | 179 | 1.1% | 177 | 356 | 28.9% | 253 | the five bodies (101, declared) and helpers (56); states (20) |
| `renderer` | 479 | 0.6% | 476 | 265 | 1.1% | 262 | T3, T4 and the settle deleted, the help panel's two helpers moved; puts by part, states and marks added |
| `grids`, `label-editor`, `help` (new) | -- | -- | -- | 266 | 17.7% | 219 | moved from `canvas` |
| `sync`, `server`, doors | 5,714 | -- | 5,441 | = | = | = | untouched |
| `product-page` | 627 | 1.3% | 619 | 624 | 1.3% | 616 | the pipe layer and builder no longer handed |
| `lab` | 106 | 10.4% | 95 | 104 | 10.6% | 93 | likewise |
| **draw, running** | **14,049** | **12.5%** | **12,294** | **about 13,700** | **about 12.7%** | **about 11,960** | |

**The headline, an estimate:** draw's own code about 350 lines smaller, 2.5%; the renderer about 45% smaller and the rules adapter about 64%; the declarative share flat, since a painter's shapes and its old `create` are both functions; the improvement is in kind -- no translation but the stored record's, every mechanism held once but the two section 2.2 keeps, every general duty a declared part -- and the tests about 1,300 code lines smaller as the copies and their parity code go.\
Each move measures its own row, and H26.8's close records the table again in `dev/CODE-SPLIT.md`, beside this baseline (H26-16).

---

## 7. Decisions owed

Each offered with its options and their costs and a recommendation apart; marked *the director's* where the director's judgement is needed, the rest the architect's to settle at ratification.

| # | Decision | Options, and what each costs | Recommendation, and why |
|---|---|---|---|
| NS1 | The order of the moves | (a) binding, scene, capture, grid; (b) the board's order, capture first -- the bodies moved before the states they read are native, so moved twice; (c) scene first -- the largest risk first, the binding move's quick proof lost | (a): smallest first, and each later move reads what an earlier made native (4.1) |
| NS2 | A painter's native form | (a) ordered named parts, `''` the own element, companions `<id>/<part>`; (b) top-level shapes keyed by serial, as the shadow keys them -- keys that name nothing, which picks by item cannot read; (c) one item per entity, companions as children -- the link's sibling structure gone, which the stylesheet's sibling rules and the export's grouping read | (a): stable keys a pick can read, the elements draw keeps kept |
| NS3 | The pipes | (a) a painted kind of the network's, its states the renderer's; (b) items the network's own paint puts through the scene, the state hook kept; (c) foreign, as today -- against D8, which made them items | (a): one keyed drawer, one owner of states, and a pipe's `hover` kept through a repaint (4.3); the cost a `redraws` naming every pipe on a link's change, as today's paint repaints every pipe on every change |
| NS4 (the director's) | The reveal's trace (B422) | (a) declared, the measured length as a custom property, the names alternated, the mark cleared after it; (b) declared and normalised, `pathLength="1"`, no measurement -- its moving tip differs on every curve (measured); (c) as written, B422 kept -- doing nothing | (a): pixel-identical to today during the trace in every case run, and nothing left after it (section 5); a visible change, the fix, ruled here |
| NS5 | The reveal's marks and the towers' aim | (a) marks the renderer describes, through `mark` and `kit.markOf`; (b) the reveal and the towers handed the scene's elements -- against VS4, the scene's elements its own; (c) the towers' glyphs drawn in a foreign layer -- a second drawing of a device | (a): one drawer per element; the cost a node described again per tower whose aim changed, per frame, which no measurement has priced yet -- the move measures it in run mode beside today's |
| NS6 | Picks | (a) by item, through `itemOf` and the drawer's words; (b) by selector, as today -- against D8 | (a), as D8 ruled: the scene already says which item an element is, and the selectors leave the plugins |
| NS7 (the director's) | The five generic gestures' bodies | (a) to `editing`, behind a host of named verbs; (b) left in `canvas`, taking Input whole; (c) a component now -- no second consumer (P4) | (a), as D13 ruled: the boundary B389 names held by the scanners, the extraction a move |
| NS8 (the director's) | The label editor, the help and grid drawing | (a) declared parts now -- `label-editor`, `help`, `grids` -- each marked for extraction; (b) left in `canvas`, its duty mixed; (c) components now -- no second consumer | (a): H26-16's target holds every general duty a component's or a declared part's; each costs a manifest entry and a few lines handed in (3.3) |
| NS9 | The stored layout record | (a) kept, `{ pitch, offset, ext }`, `latticeGrids` its one translation; (b) stored as `snap-grid`'s declaration -- a migration of every document, template and seed, and of the agent door's answers | (a): a document's form is a contract with its readers, and H26.8 changes no stored byte |
| NS10 | The side-by-side copies | (a) each deleted by the move it holds, once that move's parity has run, its records kept; (b) all kept until H26.8 closes -- copies of code already gone, held for nothing; (c) deleted before the moves -- the scene's move unheld | (a): each copy holds one move, and the records -- the lifecycle, the help, the editing trees -- hold draw's own behaviour after |
| NS11 | A refused table declaration's words | (a) the component's problems, as `openGestures` says its own; (b) the old matcher's words, keeping 27 lines of translation | (a): only a declaration nothing in draw produces is refused |
| NS12 | B418 and B425, whose triggers H26.8 meets | (a) each restated: B418 "an agent needs to perceive what a person sees on the canvas", the scene's items being that description; B425 "an agent or a person needs to change draw's configuration without a code change"; (b) either delivered inside H26.8 -- a route or a data file with no consumer | (a): neither has a consumer, and H26.8's shapes are functions, not the data B425 asks for |

**Registered when this is ratified,** each with its revival trigger (RU3): the export's bounds from the parts' footprints (X7), "the export's frame is found wrong for a drawing, or H26.6 designs pan and zoom"; B422 is closed by the scene move (NS4), and B418 and B425 restated as NS12 says.

---

## 8. Axiom alignment audit (M7)

**Identity.**\
H26.8 at revision 1, read against `0e469e1` (production's `ca492da`), the four components' released contracts, H26-9, H26-10, H26-11 as amended, H26-14, H26-15 and H26-16, and mission-kit at `e33c850`; audited in two layers: draw's parts, and the moves that carry them.

**Verdict.**\
Revision 1 is `pass, with guardrails`, by its author; its standing is to be confirmed by a reading (M1).

| Layer | Axiom | Weight | How the design stands |
|---|---|---|---|
| parts | `A3` | load-bearing | Each component reached by one part in its own shapes; the general duties declared parts, the five bodies behind named verbs; no universal adapter (H26-9), each adapter's text its policy. |
| parts | `A1` | supporting | What a person sees is the scene's items, data readable whole; each state and mark a value the renderer describes, never an element written beside it. |
| moves | `A8` | load-bearing | Each move held by records, the corpus, the export's bytes and the probe; the scene's by its exact side-by-side before its copies go; the trace proved in Chrome. |
| moves | `A5` | load-bearing | The page and the export from one description; the pixel probe finds nothing but B422's fix. |
| all | `A14` | load-bearing | Every translation and duplication inventoried with its lines; what stays held, a row with its trigger. |
| all | `A4` | supporting | Records written before each move kept after it; each copy's L4 entry deleted with it. |
| all | `A2`, `A6`, `A7`, `A9` to `A13` | not materially implicated | No trait brings them into force beyond what the moves already keep; `A13` is served by section 7. |

**Layered application.**\
State and truth: one owner per element, one owner per state class, one description per item.\
Composition: four components, one part each, natively; three new declared parts; the editing host the one new interface, named.\
Integrity: each move verified as H26-15 rules, the copies deleted only by the move they hold.\
Director attention: three decisions marked the director's, each with a recommendation.

**Tensions, and how they resolve.**
- The declarative share flat against "logic density" as an aim: the measure counts functions in tables as declared, so H26.8 is read by translations and mechanisms (section 6), which it retires.
- Marks re-describing a node per frame against the towers' cache: one drawer per element is the boundary; priced at the move.
- Three new parts against P4: declared inside draw, not extracted (H26-10).

**Deltas.**\
The four moves (section 4); three parts and two modules; the copies and their L4 entries gone; B422 closed; B418 and B425 restated; one row registered.

**Guardrails for the build.**
- GR1: each component imported by its one part (`tools/scan-layers.mjs` L12 over `COMPONENTS`); no module imports two components.
- GR2: `app/src/shadow.js` absent; `composeParts` refuses a painter with `create` or `update` and one without `shapes` (a test).
- GR3: no kit hands a painter an element builder, a layer or a look applier (`tests/canvas-painters.test.js`).
- GR4: `picksOf` refuses a `closest` or `self` pick (a test); no product module reads `closest` on a pointer's target outside capture's field, control and menu tests.
- GR5: Input receives the component's fact itself, frozen (a test of the delivery).
- GR6: `kernel/input-rules.mjs` exports the declaration, `openTable` and `openGestures` alone, and passes its neutrality test (`tests/input-rules.test.js:98`).
- GR7: `editing` imports `document` alone; `grids` and `help` import nothing; `label-editor` imports `document` and `kind-contract` (`tools/generate-architecture.mjs`).
- GR8: no module but the renderer reads an element the scene made (`byId`, `glyphOf` and `elementOf` gone, held by `tools/scan-dead.mjs`).
- GR9: each move's corpus byte-identical, its export byte-identical, its pixel probe finding nothing but B422's fix.
- GR10: section 5's trace test passes in Chrome.
- GR11: `--parts` measured at each move and recorded at H26.8's close.

**Closeout hooks.**\
Each move's verifier re-checks GR1 to GR11 as its move reaches them; H26.8 closes when `dev/CODE-SPLIT.md` holds the closing table, B422 is closed and every L4 copy is gone.

---

## 9. Reviews

H26-3 requires a multi-family reading through context-lab's review panel (M1) before ratification; none has been made of this design.\
Each reading is recorded here as it is made: its readers, its counts, and one disposition per finding with its reason.

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
| `app/src/shadow.js` | the live shadow | scene | goes |
| `app/src/renderer.js:43-52`, `:162-171`, `:228-244`, `:273-310`, `:438-512`, `:548-567` | look applier, kit, lookups, batching, puts by serial, update, signatures, element states | scene | native: puts by part, states and marks described |
| `app/src/renderer.js:312-331` | selection and reflections | scene | moves to `editing-states.js`, new in `app/src/` |
| `app/src/painter.js:44`, `:61-62` | the trace's settle; the help panel's visibility | scene; capture | goes; moves to `app/src/help.js` |
| `app/src/compose-canvas.js:96-116`, `:77` | `foreignStates`; the renderer handed measure and settle | scene | goes; the renderer handed the editing states |
| `kernel/renderer.mjs:33-36` | `nameLabel` over a builder | scene | native |
| `plugins/zones/zone-painter.mjs:25-49`, `plugins/groups/group-painter.mjs:23-49` | create, update, look, finders | scene | native: `shapes` |
| `plugins/network/link-painter.mjs:57-139` | create, update, finders, companions | scene | native: parts `''`, `head`, `leg`, `hit` |
| `plugins/network/anchor-appearance.mjs:25-70`, `plugins/devices/device-appearance.mjs:38-136`, `plugins/simulation/spawn-appearance.mjs` | appearance parts over a builder; looks | scene | native |
| `plugins/network/host.mjs:58-110`, `plugins/network/page.mjs` | the pipes' own drawer; attached with a layer and a builder | scene | native: a pipe painter in the network's canvas part |
| `product/canvas.mjs:62-79` | `pipes` foreign | scene | stays but for `pipes`, a scene layer |
| `app/src/main.js:85`, `lab/src/root.js:111` | the network attached with the pipe layer and `el` | scene | stays, without them |
| `plugins/simulation/reveal-painter.mjs:95-118`, `plugins/simulation/reveal.mjs` | the trace through a node; `traceOf` | scene | native: marks; `traceOf` stays |
| `plugins/simulation/mover-painter.mjs:314-345` | the towers' glyph cache | scene | native: the `aim` mark |
| `plugins/simulation/simulation.css` | the movers' rules | scene | stays, the trace's declaration added |
| `tests/fixtures/pre-scene/`, `tests/fixtures/pre-export/`, `tests/fixtures/scene-trace-side.mjs` | today's renderer, painter and export; the trace's old side | scene | goes, after the move's parity has run |
| `tests/fixtures/scene-parity.mjs`, `tests/vector-scene-parity.test.js` | the side-by-side and the editing trees | scene | restated: the editing trees against their record alone |
| `tests/vector-scene-trace.test.js` | today's trace against the shadow's | scene | restated: section 5's test |
| `tests/renderer.test.js`, `tests/appearance.test.js`, `tests/appearance-pipeline.test.js`, `tests/drawing-order.test.js`, `tests/anchor-redraws.test.js`, `tests/canvas-painters.test.js`, `tests/canvas-reflects.test.js`, `tests/link-heads.test.js`, `tests/run-picture.test.js`, `tests/consumer-parity.test.js`, `tests/span.test.js`, `tests/vector-scene-move.test.js` | the renderer over the harness | scene | restated to shapes |
| `tests/network-pipes.test.js`, `tests/pipe-select.test.js`, `tests/reveal.test.js`, `tests/movers.test.js` | pipes, their selection, the reveal, the towers | scene | restated |
| `app/src/capture.js:73-87`, `:114-126` | `ROUTE`, `inputEventOf`, the write-back | capture | goes; `deliver` hands the fact and its reply |
| `app/src/capture.js:52-67`, `app/src/pick.js:32-83`, `:123-125` | picks and regions by selector | capture | native: by item |
| `app/src/input.js:91-352` | `GESTURES` | capture | `move`, `clone`, `pending`, `clone-pending`, `handle`, `marquee` move to `editing-gestures.js`, new in `app/src/`; `link` and `box` stay |
| `app/src/input.js:743-752`, `:1034-1088` | `beginPress`, `retarget`, `endRetarget`, `escalate`, `updateMove` | capture | moves with the bodies |
| `app/src/input.js:634-693`, `:1008-1149`, `:1317-1347`, `:1400-1423`, `:1640-1673` | entry points over draw's input event | capture | native: facts and replies |
| `app/src/recognize.js`, `plugins/zones/zone-gestures.mjs`, `plugins/network/link-handles.mjs` | rows reading `e.on` | capture | native: `fact.hit` |
| `plugins/devices/device-panels.mjs`, `plugins/simulation/spawn-runs.mjs`, `plugins/network/keys.mjs` | rows reading `region`, writing `claimed` | capture | native: `fact.hit.region`, `reply.claim()` |
| each painter's and appearance's `picks`; `drawn` and `runTargets` in the zones, groups, devices and network parts | selectors | capture | native: words |
| `app/src/labeledit.js:8`, `:197`, `:205` | imports the commands | capture | handed its two edits; the `label-editor` part |
| `app/src/help.js`, `app/src/actions.js` | in `canvas` | capture | the `help` part |
| `tests/input-capture-move.test.js`, `tests/input-capture.test.js` | the input event's form | capture | restated to the fact |
| `tests/canvas-gestures.test.js`, `tests/wide-devices.test.js`, `tests/input.test.js`, `tests/canvas-grids.test.js` | event literals handed to Input | capture | restated to facts |
| `tests/fixtures/binding-parity.mjs:34`, `tests/input-binding-move.test.js:120`, `tests/releases.test.js:140`, `tests/fixtures/session-spy/wrapper.mjs` | pins of `GESTURES`; the spy | capture | restated to `EDITING_GESTURES` and the host |
| `app/src/snap.js:71-90`, `:124-128` | `clampDelta` reads `ext`; the extent checked | grid | native: the grid's bounds; the check goes |
| `plugins/layouts/layout-canvas.mjs:42`, `plugins/zones/zone-painter.mjs:54` | places with `ext` and `grid` | grid | native: `grid` alone |
| `app/src/grids.js:12`, `app/src/compose-canvas.js:68` | grids found through `app/src/snap.js` | grid | handed by the composition; the `grids` part |
| `tools/layers.mjs` | parts, layer lists, entries, L4, alignment | each | as section 3.3 says, each move its own rows |
| `docs/ARCHITECTURE.md`, `docs/ARCHITECTURE-TARGET.md` | generated parts | each | regenerated |
| `dev/CODE-SPLIT.md` | H26.8's baseline | each | each move's row; the closing table |
