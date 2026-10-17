# Completing the unification: every copied fact measured, then removed -- H25

> **Tier 3 -- a design of record, proposed.** Written 2026-10-17 against `d0684e9`, revised the same day after its adversarial review.
> Facts about today's code are measured by `tools/scan-copies.mjs` and cited by file; judgements are marked as such.
> Proposes; decides nothing. Section 9 lists what only the director can settle.
> AMENDED 2026-10-17: ratified, D1 to D6 as recommended (`dev/DECISIONS.md` H25-1).

## 1. Status

- **Asked for:** the director, 2026-10-17: "Ok, lets plan a programme of work to complete this unification. Propose first action"; the first action ruled as recommended, measure first (`dev/DECISIONS.md` H25).
- **Is:** board milestone H25; this document is H25.0's output (B365, closed by the measuring), the audit and the plan to remove the copies it found (B366), whose ratification is H25.1.
- **Found by:** the published SVG's copied order of layers and copied label rules drifting from the page unseen (B361), and the question that followed: whether the unification had deduplicated what it decoupled.

---

## 2. From-state -> to-state

**From** (measured by the scanner the H25.0 commit lands, on the tree at `d0684e9`):
- **Decoupled, measured:** no part imports another outside the target's consumes (`docs/ARCHITECTURE.md` section 5, generated, "None"); the target's own divergence list is empty (`docs/ARCHITECTURE-TARGET.md` 8.2).
- **No duplicated function:** `tools/scan-twins.mjs`, now reading every product folder, finds no pair.
- **Copies, measured by nothing until H25.0** -- 128 findings, named in `tools/copies-record.json`:
  - 32 style properties set in two stylesheets;
  - 65 rules in a stylesheet setting the look of a class only another part's plugins draw;
  - 11 styled classes or ids nothing draws or writes;
  - 15 lines of the canvas layout copied between two pages;
  - 5 modules in product folders that no production entry reaches.

**To**, building H2 (one rendering, decided in one place), N1 (a plugin brings its own), CANVAS-PLUGINS D1 (the canvas names no plugin's kind) and H25:
- **Every recorded finding is a copy the director ruled may stand,** each named with its ruling in `tools/layers.mjs` `COPIES.exceptions`; the frozen ceiling is unchanged.
- **Each plugin brings its own look,** its elements' states included, as the network plugin brings `network/network.css`; the export and the favicon draw with the same stylesheets the page loads.
- **One renderer:** the old scene renderer is gone, and each test that read it reads the real one or names the test that already says what it said.
- **One canvas layout, one stylesheet list:** each declared once and generated into the pages.
- **The architecture document reports the copies,** generated.

Ratifying this delta ratifies decisions D1 to D6 of section 9 as recommended, unless the director rules one otherwise; a different ruling changes the to-state as that decision says.

---

## 3. The fence

- The stylesheets the pages load, the CSS the modules hold as text, and the order the pages load them in.
- Where a plugin's look is declared, and how the page, the lab, the export and the favicon load it.
- The export's own styling of what it serialises (`server/svg.mjs` `serializeNode`: `LINK_COLOURS`, the label's fill, the background's).
- The canvas layout the two pages lay out, the lab's own list of the layers it needs (`lab/src/root.js` `NEEDED`), and the colour check's list of sheets (`tools/colour-tokens.mjs`).
- The modules in product folders that no production entry reaches, and the tests that read them.
- The one name the layer manifest holds as misnamed (`routeGeometry`).
- The records, the probe of section 7, and the generated architecture document.

---

## 4. The anti-scope fence

- **No visible change.** Every stage is held to section 7's probe: no pixel differs, in any mode, on the pinned documents; a stage that changes a pixel stops and is shown to the director.
  AMENDED 2026-10-17 by the director (`dev/DECISIONS.md` H25-3): correctness and quality come first, and the director never asked for no visible change -- this fence was the agent's own, offered with H25's first action and stated here. The probe still runs on every stage, to find every difference rather than to forbid one: each is explained and judged, a change that makes a picture correct is wanted and shown to the director, and a difference nobody can explain stops the stage.
- **Moving a rule moves it.** A rule moves word for word with its selector unchanged; nothing is restyled, merged or renamed on the way.
- **No behaviour change and no new feature.** The router is not rewritten (D5); the CLI gains no route and changes no output (D6).
- **No stored document changes.** No schema change, no migration, no repair at boot.
- **The mission-kit migration stays held** (B343 to B346, the director's ruling to wait); this programme makes the parts cleaner to migrate and migrates none.
- **The core's grid names stay held** (B325's trigger): they are words the core uses, not a fact copied into two places.

---

## 5. The audit -- what was found

### 5.1 How it was measured, and how the record is held

H25.0 added `tools/scan-copies.mjs`, which runs five measures (`tools/copies.mjs`) over what the layer manifest declares.\
Each finding is named, not counted: removing one copy and adding another is two faults, not none.\
The findings stand in `tools/copies-record.json`, which may only shrink -- `--write` lowers it to what is measured and refuses to write a new copy in -- and which may hold nothing outside `tools/copies-ceiling.json`, the findings when H25 opened, frozen and pinned by its hash in `tests/scan-copies.test.js`.\
A copy the director rules may stand goes in `COPIES.exceptions` with the ruling it cites, resolved by `tools/exceptions.mjs`; an exception for a copy that is gone fails.\
The duplicate-function scanner's folder list is now derived from the manifest's folders (`SCANNER_ROOTS.twins`), where it had named the six folders the product had when it was written, none of them a plugin's.\
Each measure was shown to catch a planted copy and pass its control (`tests/scan-copies.test.js`, 14 tests), 22 mutants of the measures were killed, and three real-tree plants -- a new copied rule, an edited ceiling, `--write` asked to raise the record -- were each refused.

**What the reading of classes can and cannot see (judgement, bounded).**\
A class is credited to the part whose code puts it on an element: markup written as text (`class="solid"`), the value of a class key (`class`, `cls`, `className =`, `addClass`, a pick's `idle`, a gesture's `preview`, a handle's `dragState`), `classList.add` or `.toggle`, a state set or cleared through the renderer, `setAttribute('class', ...)`, or a page's markup.\
A class only read (`classList.contains`, `.includes('label')`), or a word quoted under another key (a layer, a layout's name, a fill), is not credited.\
A class passed to a helper (`previewRect(overlay, 'marquee')`, a status cell built by `cell(cls, text)`) is not seen; those are counted under "styled names nothing draws", so a blind spot is a number in the gate rather than a silence.

**Why a page's stylesheet styling a plugin's class is foreign (judgement).**\
The manifest lets a composition root import anything (`KIND_MAY_CONSUME`), and that governs which way a dependency may point.\
Restating a plugin's look in the page's sheet is not a dependency but a second statement of the plugin's decision, which is what this programme counts; so a sheet's rules are judged against the parts that draw the classes, whatever the sheet's owner may import.

### 5.2 Copied style rules -- 32

| Copy | Count | Where |
|---|---|---|
| The kernel's CSS against the page's | 19 | `kernel/theme.mjs` `KERNEL_CSS` and `app/style.css`: `.hollow`, `.solid`, `.icon`, `.frame`, the `.node` variables, `.node .select-box`, `.node.selected .select-box` |
| The export's CSS against the page's | 11 | `product/canvas.mjs` `EXPORT_CSS` and `app/style.css`: `.label`, `.label.zone-label`, `.label-pill`, `.link`, `.zone-rect` |
| The export's CSS against the network's | 1 | `EXPORT_CSS` and `network/network.css`: `.link[data-down]` |
| The lab's sheet against the page's | 1 | `lab/lab.css` and `app/style.css`: `#status { display: flex }`, the same value in both, so redundant |

Some of these are dead text: the export strips a link path's class and its selection boxes (`server/svg.mjs` `serializeNode`), so `EXPORT_CSS`'s `.link`, `.link[data-down]` and `.link-hit` rules and `KERNEL_CSS`'s `.select-box` rules style nothing in the export or the favicon.\
The export's live link colours are attributes it writes itself (`LINK_COLOURS`), which this measure cannot see (section 5.9) and H25.2 removes.

### 5.3 Foreign style rules -- 65

A stylesheet setting the look of a class that only plugins put on elements, none of them the stylesheet's owner; the scanner's own breakdown, a rule styling two plugins' classes counting for each:

| Sheet | devices | groups | layouts | network | simulation | zones |
|---|---|---|---|---|---|---|
| `app/style.css` | 16 | 1 | 2 | 26 | 6 | 12 |
| `kernel/theme.mjs` `KERNEL_CSS` | 3 | | | | | |
| `product/canvas.mjs` `EXPORT_CSS` | 3 | 1 | | 3 | | 4 |

Two kinds are mixed in the page's 53, and the build tells them apart (judgement):
- **A plugin's own look** -- `.link`, `.zone-rect`, `.wp-anchor`, `.beam`, `.label`: the plugin's to bring, as the network brings `network/network.css`.
- **How a plugin's element shows the host's state** -- `.waypoint.selected .select-box`, `.link.selected`, `.zone.hover`: the selection and hover are the canvas's classes, the element and its look the plugin's (D2).

### 5.4 Styled names nothing draws -- 11

- **Dead rules (6):** `#slides-url`, `#slides-push` and its `.busy`, `.ok` and `.err` states style a Slides control the page no longer has; `.data-tag` and `.data-pill` style elements nothing draws.
- **Drawn through a helper the reading cannot follow (5):** `.marquee` (the selection box, `app/src/input.js` `previewRect`), and `.left`, `.roomy`, `.name`, `.id` (the status table's cells, `app/src/main.js` `cell`).

### 5.5 Copied lines -- 15

`app/index.html` and `lab/index.html` each lay out the canvas in `#container` -- its `<main>`, its `<svg>`, its background rectangle and its eleven layers -- line for line.\
`tests/run-picture.test.js` holds the two equal since H24.8, and the export reads the order from the product page (`server/svg.mjs` `pageLayerOrder`).\
A third copy of the layer list, `lab/src/root.js` `NEEDED`, is JavaScript and unmeasured; so is each page's list of stylesheets, which differ only in their comments.

### 5.6 Modules no production entry reaches -- 5

- **The old scene renderer (4):** `kernel/adapt.mjs`, `kernel/engine.mjs` and `kernel/svg-scene.mjs` draw a document by kind name, read by seven test files (`bare-anchor`, `display`, `drawing-order`, `renderer`, `run-picture`, `span`, `transit-roles`), some checking the product's drawing against them; `kernel/fixtures.mjs` is read by nothing at all.
- **The REST surface, declared beside the router (1):** `server/routes.mjs` lists each route and method; the router does not dispatch from it; `tests/routes.test.js` proves each declared route answers, `tools/routes.mjs` derives the route names from the router independently, and `tools/scan-cli.mjs` and `tools/generate-architecture.mjs` read it.

### 5.7 Duplicate functions -- none

Every function in the fourteen product folders compared, no pair sharing a quarter of its lines; the one allowed pair (two injected constructors) stands.

### 5.8 Recorded exceptions

Three ratchets carry a reason and an end (`docs/ARCHITECTURE.md` section 11):
- `routeGeometry`, named for one consumer -- ends when `kernel/router.mjs` is next changed;
- the CLI's verbs list the kinds themselves -- seven lines whose categories include `waypoints`, which is no kind, so they are the CLI's display, not a copy of the composition's list; held on their trigger (D6);
- the old scene adapter's kind names -- trigger `permanent`, retired with the adapter itself (H25.5).

The core naming the zone and group grids (`kernel/geometry.mjs`, `kernel/spec.mjs`) waits on B325, outside this fence.

### 5.9 Not measured -- what "zero" will not mean

- **A value:** the measures compare which property of which elements a sheet sets, never the value.
- **A look written as attributes in code:**
  - a link head's and leg's stroke (`network/link-painter.mjs`);
  - a group hull's (`groups/group-painter.mjs`, beside `EXPORT_CSS`'s);
  - the export's colours (`server/svg.mjs`);
  - the old renderer's restatements.

  H25.2 removes the export's; the plugins' attribute styling is the painter's own statement and stays.
- **A list copied in code:** the lab's `NEEDED` (H25.4 removes it), the lab server's mounts beside the product server's, the colour check's list of sheets (H25.1 derives it), the other scanners' folder lists (`SCANNER_ROOTS.docrefs` lacks `network` and `lab`; H25.7 derives it).
- **A number repeated in code, a copy within one file, a document restating code, a test restating its subject** (B108).

---

## 6. Build order -- each stage provable before the next depends on it

Each stage: tests first; the record lowered in its commit, which lists each finding removed and the one declaration that replaced it; section 7's probe run by an agent that did not build the stage; the lab first, then production.

0. **H25.0b -- the probe, before anything moves.**
   A probe committed under `tools/probe/` renders a pinned document set at two commits -- a baseline and a candidate, each served from its own worktree -- in one browser build, and compares them pixel for pixel and style for style (section 7, criteria 4 and 5).
   The set: every diagram the director owns, read from production read-only and pinned by content hash at H25.0b, never written into this public repository; the browser parity board, extended with a down link carrying a head and a group; and a state board holding each interaction state.
   Proves: the probe passes at baseline against itself, and fails on a planted one-property change in each mode.
   AMENDED 2026-10-17: built as `tools/probe/parity.mjs`, the boards in `tools/probe/boards.mjs`; passed against itself (94 pictures, 18 style readings) and reported five planted changes -- edit-mode sockets, the run-mode border, a link's armed state, the export's name pill, a hovered clickable -- each where it shows and nowhere else (B367).
1. **H25.1 -- each plugin brings its own stylesheet (D1, D2).**
   The zones, groups, devices, layouts and simulation plugins each bring a stylesheet with their canvas part, as the network does; each plugin's rules move into it word for word, its elements' state rules with them (D2).
   The pages list the composed parts' sheets in their served markup, in a fixed order generated from the composition and checked (mission-kit `P3`), the network's still before the page's own; the colour check reads the same list.
   The simulation's sheet sits beside its modules in `engine/`, named in its part's module list so the scanner knows its owner.
   Proves: foreign style rules in `app/style.css` at zero; the probe passes.
   AMENDED 2026-10-17, as built (B368):
   - a name's label is drawn by the core (`kernel/renderer.mjs` `nameLabel`) and styled by `kernel/primitives.css`, since the zones and devices plugins drew the same two elements -- names are a service a kind opts into (N5);
   - the network's waypoint rules moved whole, the spawning ones with them, because their order decides which state wins on one waypoint (armed over spawning over a selected path), and splitting them across two sheets could keep only one of those orders; the two spawning rules stay counted as foreign, as does `#container.zonegrid .zone` in the zones' sheet, until H25.3 rules on them;
   - `.waypoint.linkband` styles a state only devices declare, for devices -- dead, deleted in H25.3;
   - the copy findings were named by the sheet each sat in, so a move read as a copy removed and another added; they are named by the fact copied now, and the ceiling was re-expressed from the tree H25 opened on, 120 findings where 128 were;
   - 201 rules before and after, each word for word; the probe against be5c9c3 passed.
   - the simulation's sheet is owned through `tools/layers.mjs` `COPIES.owners`, as the core's is, rather than named in its part's module list, which lists modules;
   - verified by an agent that did not build it: the probe between be5c9c3 and 9364fb2 passed, every pair and triple of twelve states and five container modes compared at both commits found no difference in thirty properties, and no pair of rules whose order changed can style one element; its findings -- a guard test still reading two sheets, two stale comments, this missing line, and `.label.zone-label` placed after the zone block rather than before it, which no element can tell apart -- are fixed or noted in the commit after.
2. **H25.2 -- the export and the favicon draw with the same stylesheets (D3).**
   `server/svg.mjs` builds its style from the composed parts' sheets and the canvas's own rules, every `var()` given a literal fallback from the colour registry; `serializeNode` stops writing colours of its own; `KERNEL_CSS` and `EXPORT_CSS` retire, and the favicon takes the devices plugin's sheet.
   `tests/run-picture.test.js`'s assertions on the export's attribute colours are restated to assert the colour the element computes.
   Proves: copied style rules at zero, but for the lab's, removed in H25.3; foreign style rules at zero; the probe passes on the export, the favicon and the parity board's down link and group.
   AMENDED 2026-10-17, as built (B369):
   - the page's own sheet is split into its chrome (`app/style.css`) and the canvas's (`app/canvas.css`), word for word, the canvas's loaded last where its rules stood, so the export reads the canvas's rules without the chrome's;
   - CORRECTED after the first build failed its verification (D3 as amended, H25-2): the export carries no stylesheet; `server/svg-style.mjs` applies every rule of every sheet but the chrome's -- a browser's cascade reduced to what these sheets hold, custom properties inherited, colour tokens written in, pointer rules left out, anything it cannot carry refused -- and writes each element's drawn properties as its attributes, the shared defs and the favicon likewise; the first build's `drawingStyle`, which shipped those sheets as a <style>, is gone;
   - the rules are applied to the file as it is written, not to the tree the painters drew -- the probe caught a spawning endpoint's ring turned green when they were -- which exposed that the published file has never drawn a spawner as the page does (B370, held behind this programme's no-pixel-change fence until the director lifted it, H25-3, and fixed as H25.2b: the file keeps each waypoint circle's class, so the page's spawning rule draws it, and the parity board holds a spawner);
   - its independent verification passed, with four findings acted on: the defs drawn outside a device's scope survived every test (now held by `tests/svgexport.test.js`); CSS the cascade mishandled was not refused (`!important`, a pseudo-class a still picture could be in, a transform with units, a `:root` property not a token, unreadable markup -- now each refused, a token's fallback and an element's own custom property now honoured); "draws alike in any renderer" overclaimed, since librsvg before 2.50 reads no plain `href` and so draws no device in this file or the one before it (B371); and a host page's CSS now restyles a pasted file more than it did, presentation attributes losing to any rule (B372);
   - the ground is drawn as the canvas is, its fill the canvas rule's, with no page-wide id; the parity test compares it;
   - a link is written as one group named by its id -- its line, its class kept, then the head and the leg that name it -- so the page's down rule reaches the head as the line's next sibling; a draft of the first build, before it was committed, wrote the line bare, and the CLI, which counts links by the group (`draw render --summary`, `draw parity`), counted none, which an installed CLI would have done against a new server;
   - the lab server served the product page's sheets from a list it typed, which missed the canvas's; the probe found the lab's canvas drawn at another size, and the lab now serves the composition's list;
   - copied style rules 32 to 1 (the lab's redundant `#status`, H25.3), foreign 13 to 4 (the cross-plugin rules, H25.3); the probe against 9cbb963 passed.
3. **H25.3 -- dead and unseen styles.**
   The six dead names' rules and the lab's redundant `#status` rule are deleted; the helpers that put `.marquee` and the status cells' classes do so where the reading sees them.
   Proves: styled names nothing draws at zero; copied style rules at zero.
   AMENDED 2026-10-17, as built (B373): the six dead names' rules deleted, with `.waypoint.linkband` (a state only devices declare); the lab's `#status` keeps its gap and takes its display from the page's sheet; the selection rectangle's class declared as a box row declares its preview (`app/src/input.js` `MARQUEE`), the deleted-diagrams list's cells named by a `cls` key (`app/src/main.js`); 36 findings to 23. The three foreign style rules -- the spawner's two, the zone grid's cursor -- are owed a ruling (B374), as H25.3b.
   AMENDED 2026-10-17, H25.3b: the director ruled the three exceptions (`dev/DECISIONS.md` H25-4), each in `tools/layers.mjs` `COPIES.exceptions` with its trigger.
4. **H25.4 -- one canvas layout.**
   The layer list is declared once in the product's composition; the pages' `#container` is generated from it and checked (`P3`), as their stylesheet lists are; the lab's `NEEDED`, the export and `tests/run-picture.test.js` read the declaration; the copied-lines measure passes over a region marked as generated, which its generator holds equal to the declaration.
   Proves: copied lines at zero.
   AMENDED 2026-10-17, as built (B376): `product/canvas.mjs` declares `CANVAS_VIEWBOX` and `CANVAS_LAYERS`, the layer order's reasons with them; `tools/canvas-layout.mjs` writes each page's `<svg id="container">` between generated markers, in the gate with `--check`, through `tools/regions.mjs`, which `tools/stylesheets.mjs` now shares; the lab's `NEEDED` spreads the declaration; the export stacks by it, where it read the product page's markup; `tests/run-picture.test.js` reads the declaration, and `tests/canvas-layout.test.js` holds each page to it. Copied lines 15 to 0; 23 findings to 8 -- the three ruled exceptions and the five modules no entry reaches (H25.5, and D5's route list).
5. **H25.5 -- one renderer (D4).**
   The old scene renderer's four modules are deleted, with their records in `tests/core-names-no-plugin.test.js` and the manifest's `NOT_PARTS`.
   Each test that read them reads the real renderer, or is deleted with the commit naming the test of the real renderer that already says what it said; no test is deleted without one.
   `server/routes.mjs` stands as a ruled exception (D5).
   Proves: modules no production entry reaches holds only that exception.
   AMENDED 2026-10-17, as built (B378): `kernel/adapt.mjs`, `kernel/engine.mjs`, `kernel/fixtures.mjs` and `kernel/svg-scene.mjs` deleted, along with the scene-element helpers they alone called (`kernel/geometry.mjs` `node`, `zone`, `group`, `bboxOf`, `cellPx`; `kernel/spec.mjs` `derive` un-exported; `kernel/router.mjs` `gridSnap`; `network/appearance.mjs` `waypoint`, `port`, `junction`, `path`; `network/read-model.mjs` `linesOf`; `zones/zone-painter.mjs` `ZONE_TOKENS`; `groups/group-painter.mjs` `GROUP_TOKENS` un-exported); all seven test files moved onto `server/svg.mjs` `svgDocument` and `app/src/renderer.js` `Renderer` with zero tests deleted; `NOT_PARTS` empty; `RATCHETS.L7k` drops `kernel/adapt.mjs`; `server/routes.mjs` recorded in `COPIES.exceptions` citing `H25-1` (D5); findings 8 to 4, all 4 ruled exceptions.
6. **H25.6 -- one name.**
   `routeGeometry` is renamed for what it computes.
   Proves: ratchet L5p empty.
7. **H25.7 -- close.**
   `docs/ARCHITECTURE.md` gains a generated section listing each measure and its findings; `docs/ARCHITECTURE-TARGET.md` 8.2 states that copies are measured; `SCANNER_ROOTS.docrefs` is derived from the manifest's folders; B365 closes.

---

## 7. Binary exit criteria

1. `node tools/scan-copies.mjs` passes, and every finding in `tools/copies-record.json` is an entry of `COPIES.exceptions` citing a ruling that resolves; `tests/scan-copies.test.js` passes, so the ceiling is unchanged.
2. `node tools/scan-twins.mjs` passes over every product folder.
3. `tools/layers.mjs` `RATCHETS.L5p` is empty.
4. The H25.0b probe, run by an agent that did not build the stage, renders every pinned document at the H25.0b baseline commit and at the candidate commit, in the same browser build, in the renderer's authoring mode, in edit mode, and in run mode with the movers' layer hidden and the clock fixed: no pixel differs between the two.
5. The same probe renders the served SVG of every diagram the director has published, and the favicon the server serves, at both commits: no pixel differs; and on the state board, every element's computed style in each interaction state -- selected, armed, armed to clone, hover, an end being dragged, link band, down, down and selected, blocking, a text box's preview, a run-mode clickable under the pointer -- is equal at both commits.
   AMENDED 2026-10-17 (`dev/DECISIONS.md` H25-3): in 4 and 5, "no pixel differs" reads "every pixel that differs is explained, and judged correct by the director", and the computed styles likewise -- H25.3's deleted waypoint link-band rule left one reading differing for good, a state the product never sets on a waypoint (B373).
6. `tests/browser.test.js` `H24.8 (B361)` runs, not skipped, and passes, its board holding a down link with a head and a group.
7. Every `var()` in a served SVG carries a literal fallback.
   AMENDED 2026-10-17 with D3 (`dev/DECISIONS.md` H25-2): a served SVG and the favicon carry no `var()` at all, no stylesheet and no pointer rule (`tests/svgexport.test.js` H25.2).
8. `git diff <H25.0b baseline> -- model/shape.mjs server/store.js server/docfile.mjs` is empty, and production's boot log after each deploy holds no `ERROR`, `skipping` or `invariant` line.
9. `docs/ARCHITECTURE.md` carries a generated section listing each measure and its findings, and `node tools/generate-architecture.mjs --check` passes.

---

## 8. Coverage, verification, costs

**Proves:**
- H2's one rendering in its styling as in its drawing: the export styled by the page's sheets, with no colours of its own.
- N1's plugins bringing their own, extended to their look.
- CANVAS-PLUGINS D1, extended to the page's stylesheet -- the page's, which holds the canvas's rules and the chrome's together, not a canvas sheet of its own.
- H25.

**Defers:**
- the mission-kit components (B343 to B346);
- the core's grid names (B325);
- the CLI's own display list of collections (D6);
- the REST route list beside the router (D5);
- what section 5.9 lists as unmeasured.

**Verification targets:** `tests/scan-copies.test.js` and each stage's tests; `tests/browser.test.js` `H24.8 (B361)` with its extended board; the H25.0b probe, rerun at every stage by an agent that did not build it.

**Named costs and non-claims (judgement):**
- Seven stages of moving code that changes nothing on screen; its value is that the next drift has nowhere to hide, which B361 showed is not hypothetical.
- The class reading is a reading, not a parse; its blind spots are counted, not removed.
- "Zero" means zero of the five kinds measured, inside section 5.9's limits, not that no fact is stated twice anywhere.

---

## 9. Decisions for the director -- one at a time

- **D1 -- where a plugin's look lives.**
  Recommended: each plugin brings its stylesheet with its canvas part, as the network does, listed in the pages' served markup in a fixed order generated from the composition.
  Otherwise: the page's stylesheet keeps them, the page's foreign rules recorded as one ruled exception.
- **D2 -- how a plugin's element shows the host's states.**
  Recommended: the state rules move with the plugin's look, word for word -- `.link.selected` into the network's sheet -- so the DOM and the published SVG's bytes do not change, and a plugin's sheet names the host's state classes, a contract the host owns.
  Otherwise: the renderer puts one generic class on every entity's root and the host styles states through it, which changes every element's classes and every published SVG's bytes.
- **D3 -- how the export gets its styles.**
  Recommended: from the same stylesheets, every `var()` given a literal fallback, `serializeNode` writing no colours of its own.
  Otherwise: every drawn element carries its look as attributes, and the export loads no stylesheet.
  AMENDED 2026-10-17 by the director (`dev/DECISIONS.md` H25-2): the first build shipped the page's sheets as a stylesheet and failed its verification -- it restyled a page it was pasted into, carried the page's cursors, and lost its lines in renderers that skip custom properties, so the premise that a `var()` fallback keeps such a renderer drawing was false. The export now applies the page's own rules at export time and writes each element's result as its attributes (`server/svg-style.mjs`), carrying no stylesheet.
- **D4 -- the old scene renderer.**
  Recommended: deleted, each test reading the real renderer or naming the test that already says what it said.
  Otherwise: moved under `tests/` as a fixture -- recorded as a copy still, a second renderer kept for the tests.
- **D5 -- the REST route list beside the router.**
  Recommended: a ruled exception, until the next change to how the router dispatches -- making the router dispatch from it is a rewrite of the router, outside this fence.
  Otherwise: the router dispatches from it in this programme, with a behaviour check of every route added to section 7.
- **D6 -- the CLI's own list of collections.**
  Recommended: held on its ratchet's trigger -- learning it from the server needs a route the server does not have and changes the CLI's output; `routeGeometry` is renamed in this programme.
  Otherwise: a kinds route and the CLI reading it, as a feature of its own.

---

## 10. Axiom alignment audit (M7)

**Identity:** H25 (B365), this document at its revision after review, `tools/scan-copies.mjs` as H25.0 lands it; mission-kit axioms as read 2026-10-17.\
**Verdict: pass-with-guardrails.**

| Axiom | Weight | How the plan stands |
|---|---|---|
| A3 Sovereign Composition | load-bearing | a plugin brings its look as it brings its kinds and painters; the page, the export and the favicon compose it rather than restate it |
| A8 Gated Recursive Integrity | load-bearing | the findings are a record that may only shrink inside a frozen ceiling, and each stage proves its findings gone, and its pixels unchanged, before the next depends on it |
| A2 Isomorphic Specification | supporting | one declaration of each style rule, the canvas layout and the stylesheet list, the generated copies checked against it |
| A11 Cognitive Minimalism | supporting | the copies are found by a scanner and the pixels compared by a probe, not by the director looking (B361) |
| A1 Sovereign State Transparency | supporting | the architecture document reports the findings, generated |
| A14 Compounding Learning | supporting | B361's lesson -- a measure of imports cannot see a copy -- becomes a check every commit runs |
| A13 Director Intent Amplification | supporting | no visible change, so the director's attention goes to six decisions, not to reviewing pixels |
| A4, A5, A6, A7, A9, A10, A12 | not materially implicated | |

**Tensions:**
- The measures are heuristic where the tree declares no ownership of classes -- resolved by counting the blind spots and gating them.
- Churn with no visible change, against RU1's default-reject -- resolved by B361, the incident this programme exists to prevent.

**Guardrails for the build:**
- No pixel changes (criteria 4, 5).
  AMENDED 2026-10-17 by the director (`dev/DECISIONS.md` H25-3): "no pixel changes" reads "every pixel that changes is explained and judged correct by the director"; so do the A8 and A13 rows and the tension on churn above -- a stage proves each difference correct, and the director's attention goes to each difference, shown.
- A rule moves word for word.
- No stored document changes.
- No finding is removed by moving a copy out of the scanner's sight: each stage's commit names every finding it removes and the declaration that replaced it, and the probe's runner checks that list against the diff.
**Closeout hooks:** criteria 1 to 9, the probe rerun at every stage by an agent that did not build it.

---

## Adversarial review

**Reviewer:** an independent review agent that did not draft this document, given the document, the H25.0 code and AR2's falsifiers, read-only, 2026-10-17.\
It could not run commands and read the code by hand; it re-derived the copied style rules (32) and the copied lines (12, as first measured) exactly.
**Verdict given:** ratifiable after the listed fixes; findings 1 to 5 blocking.\
**Disposition of each finding** -- *fixed* is code changed in H25.0, *amended* is this document changed, *accepted* is a finding taken as stated with nothing to change, *rejected* gives the reason:

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | blocking | the pixel criteria covered one mode, read "view mode" two ways, compared live documents across stages, tolerated a visible drift, and had no probe or baseline | amended: stage H25.0b builds the probe first; criteria 4 and 5 compare a pinned set at two commits, in three named modes and the interaction states, with no tolerance |
| 2 | blocking | moving sheets changes their load order and so the cascade; a generic host class is a redesign no decision covered | amended: sheets listed in served markup in a fixed generated order, the network's before the page's; rules move word for word; the host's states are D2, recommended to move with the plugin's look so nothing about the DOM changes |
| 3 | blocking | the export strips a link's class, so a page rule would turn down links' heads blue, unseen by a parity board with no down link or group; `var()` breaks embedders; `serializeNode`'s colours stay | amended: `serializeNode` inside the fence and its colours removed in H25.2; the parity board gains a down link with a head and a group in H25.0b; criterion 7 requires a literal fallback in every `var()`; `tests/run-picture.test.js`'s colour assertions restated |
| 4 | blocking | "may only fall" was a count anyone could raise in the same commit; no exceptions; ways to hide a copy | fixed: findings named in a record that may only shrink inside a frozen ceiling pinned by hash, `--write` only lowers, exceptions resolved by `tools/exceptions.mjs`; a one-rule template now counts, a comment in a copied run hides nothing, a read or another key credits no class; each stage's commit names what it removed and what replaced it |
| 5 | blocking | the class reading credited reads and words under other keys -- the export's `label` test, a layer, a layout's name, `fill: 'solid'` | fixed: only the value of a class key and the writes are read, markup as text included; the real tree's attributions are pinned in a test; the foreign count rose from 59 to 65 as the review predicted |
| 6 | should-fix | section 5.3's arithmetic did not close and leaned on misattributions | fixed: the breakdown is the scanner's own (`--verbose`) |
| 7 | should-fix | copies the measures miss: attribute styling, the lab's `NEEDED`, the stylesheet lists, the server mounts, the colour check's list, the docrefs folder list | amended: the export's attribute colours removed in H25.2, `NEEDED` in H25.4, the stylesheet and colour lists in H25.1, the docrefs list in H25.7; the rest listed in section 5.9 |
| 8 | should-fix | copied lines were right by accident: comment lines broke the run | fixed: comments removed whole before comparing; the count is 15, the whole layout |
| 9 | should-fix | some counted copies are dead text; the parity test does not cover groups or down links | amended: section 5.2 names the dead text; the parity board is extended in H25.0b |
| 10 | should-fix | dead id rules uncounted | fixed: styled ids are measured too; `#slides-push` and `#slides-url` now counted, deleted in H25.3 |
| 11 | should-fix | D5 misread the lab's `#status` rule, the same value as the page's | accepted: the old D5 is withdrawn; H25.3 deletes the redundant rule |
| 12 | should-fix | making the router dispatch from the route list breaks the fence | amended: D5 now recommends a ruled exception with a trigger |
| 13 | should-fix | the CLI's kinds need a new route and change its output | amended: D6 now recommends holding it; only the rename stays |
| 14 | should-fix | the favicon embeds `KERNEL_CSS` | amended: H25.2 and criterion 5 cover the favicon |
| 15 | should-fix | the simulation has no folder for a sheet to sit in; the colour check's list | amended: H25.1 places the simulation's sheet in `engine/`, named in its part, and derives the colour check's list |
| 16 | should-fix | H25.4 named no declaration and would break the export's reading of the markup | amended: the list is declared in the composition, the markup generated from it, the export and the test reading the declaration |
| 17 | should-fix | calling a composition root's rules foreign contradicts what it may import | amended: section 5.1 states the rule -- import rights govern dependency, not a second statement of a plugin's look -- and section 8 no longer claims a canvas sheet |
| 18 | should-fix | criteria 5 and 6 were not binary | amended: criterion 5 covers every diagram the director has published; criterion 6 says the test ran, not skipped; the stored-document criterion is now a diff of the storage code |
| 19 | should-fix | the to-state named no ratified decision and rested on unratified ones | amended: the to-state cites H2, N1, CANVAS-PLUGINS D1 and H25, and says ratifying the delta ratifies D1 to D6 as recommended |
| 20 | should-fix | "Proves" overclaimed | amended: each proof bounded by what the stages remove |
| 21 | should-fix | tests of the old renderer could be deleted without a replacement | amended: H25.5 deletes no test without naming the one that already says what it said |
| 22 | minor | seven test files read the old renderer, not nine; `kernel/fixtures.mjs` is read by nothing | amended in section 5.6 |
| 23 | minor | the adapter's trigger is `permanent` | amended in section 5.8 |
| 24 | minor | the route test proves routes answer, not that the lists are equal | amended in section 5.6 |
| 25 | minor | the from-state named an uncommitted scanner; the mutants were nowhere recorded | amended: the from-state names the H25.0 commit's scanner; the mutants are recorded on B365 |
| 26 | minor | the selector reading merged `.node .select-box` with `.waypoint .select-box`; `//` inside a string; backticks in a comment | fixed: two rules match only with the same context, or none against one bare class; a line comment is blanked only after whitespace; comments are blanked before templates are read |
| 27 | minor | AR2 places an instance at `docs/DELTAS/` | rejected: this repository keeps its deltas in `dev/design/unification/` (its README indexes them), and moving one would split the series |
