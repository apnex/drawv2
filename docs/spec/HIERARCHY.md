# draw — Object Hierarchy & Geometry (DRAFT)

> **Status: DRAFT.** The **geometry variant `standard` is LOCKED** (§2); everything
> else (entity + state, colours, behaviour) is still draft. This document iterates
> *ahead* of `SCOPE.md`; locked parts graduate into `SCOPE.md` and the code.
> **§0 is the vision / North Star — read it first.** Lineage: PRISM (cell / selection / group / zone concepts).
>
> Tags per item: **[LOCKED]** settled & frozen · **[AGREED]** settled in discussion ·
> **[TENTATIVE]** leaning but open · **[OPEN]** undecided.
>
> Visual mocks render to `/tmp/draw-preview.png` (one stable file, overwritten each
> iteration).

---

## 0. Vision / North Star

**What this is:** the **complete, deterministic, grid-quantized geometric grammar** for
an engineering-diagram tool — a coordinate system plus a small set of composable
primitives where *every* element and *every* relationship has an exact, derivable
position and size on a strict grid. **No dynamic auto-scaling, no fudging.** Given a set
of entities and their relationships, there is exactly **one correct rendering**,
computable from grid rules + a variant's parameters. The px values (40 / 26 / 3 / 2 …)
are one *instance*; the target is the *system*. Variants are parameterizations; the
stress-test is the completeness proof. **Steps are not locked until they survive utility.**

**Primitives → engineering meaning:**
- node = component · glyph = its symbol · socket = the symbol's fixed mount
- cell / zone = space / region (a sheet or area) · group = a functional bundle of components
- selection = the current working scope · connection = a net/wire (incl. container↔container, single or parallel)

**Principles (enforced everywhere):**
1. **Determinism over aesthetics** — snap to grid; exact coordinates; reproducible, not arranged by eye (schematic-grade).
2. **Orthogonal composability** — content (nodes/groups) vs space (cells/zones), shape vs glyph, containment vs connection: independent axes that combine with no special cases.
3. **Scale by reserving, not squishing** — density is absorbed by reserving grid space (mandated cell gaps), never by auto-scaling. Precision must survive arbitrary load.

**Lineages we borrow from:**
- *Engineering games (Factorio / Shapez)* — tile-grid determinism; entities occupy whole cells; belts/wires snap & never overlap; you scale by laying more tiles.
- *Electrical schematic tools (KiCad et al.)* — components on a grid, **pins/ports at defined grid points**, orthogonal routing, **buses** for parallel nets, junctions.

**Why connections are the crucible:** containment is largely solved (the concentric
ladder). Connections test the grammar *to destruction* — joining *regions* at arbitrary
multiplicity, with defined attachment points, without breaking determinism or legibility.
Survive every connection permutation → the grammar is complete.

**Status — we are layering the primitives bottom-up:** cell → glyph → node → selection →
group → zone are settled enough (variant `standard`). **Links / line-routing have barely
begun** — a much deeper rabbit hole (ports, buses, orthogonal routing, junctions,
crossings, bundling). Concepts to borrow when ready, from prior explorations:
**github.com/apnex/fractal** and **github.com/apnex/prism** (line routing).

---

## 1. The layered hierarchy

A diagram is a small set of nested/overlapping layers over a shared grid of cells.
Two kinds of layer:

- **point-anchored** (centred on one cell): `glyph ⊂ node ⊂ selection`
- **region** (span multiple cells/nodes): `group`, `zone`

Definitions:

| layer | what it is | unit | aware of contents? |
|-------|-----------|------|--------------------|
| **cell** | a point in the first-layer grid (pitch 60); node centres land here | *space* | — |
| **glyph** | the inner icon (a node's `type`), scaled to fit the frame | content of a node | — |
| **node** | a *frame* (shape shell: circle\|square) on a cell, holding a glyph | *content* | holds one glyph |
| **selection** | transient per-target highlight (corner brackets), not persisted | runtime | — |
| **group** | a bounding box of **NODES**, hugs them; membership is explicit | content set | **yes** |
| **zone** | a region of **CELLS**; does not know/track what's inside | space region | **no** |

**[AGREED] The governing distinction:**
> **Groups bundle CONTENT (nodes) and hug them. Zones partition SPACE (cells) and
> ignore content.** A node is in a zone *incidentally* (geometric overlap); in a
> group *explicitly* (membership).

**[OPEN]** Is `selection` a *level* in the hierarchy, or the **cursor** that picks
which level you currently operate on (glyph→node→group)? If the latter it sits
outside the stack. See §3.

---

## 2. Geometry — variant `standard`  [LOCKED 2026-06-15]

Locked for the scope covered: node / glyph / socket + the selection / group / zone
ladder + the zone gutter. (Colours, entity + state, and behaviour stay open — §3, §5.)
This is the **baseline variant**; other variants are derived by changing the
parameters below via the budget equation, without touching the rest of the model.

**[LOCKED] Budget equation** (per cell, one axis):
> **pitch = node + 18 + gutter**   — the 18 is the ladder (3px × 3 steps, each side)

**`standard` parameters:**

| param | value |
|-------|-------|
| grid pitch | **60** — the coordinate lattice; node centres define the space, everything routes around it |
| node | **40** (±20, `NODE_R 20`) |
| ladder step | **3px** — frame → selection → group → zone |
| zone gutter | **2px** between adjacent zones (1px each side of the cell boundary) |
| socket (glyph box) | **26px** (±13) |

**Derived extents:** frame ±20 · selection ±23 · group ±26 · zone ±29 (cell extent
58 within pitch 60 → the 2px gutter). **Rounded radii:** 5 / 8 / 11 / 14
(frame / sel / group / zone — they track the +3 gap; calibrated on a square node, since
a circle hides the corner gap). Validated visually: the slide-4 nested stack and the
slide-5 composite both render correctly in these numbers.
- **selection** = corner brackets, 10px arms, rounded. (In code today at ±24 rx8
  for node-42; would become ±23 under node-40.)
- **group** = `bbox(member node frames) + 6`, a **continuous** rounded rect (not
  brackets — stays distinct from selection). The gutter never touches it: a
  group's edges face the zone's *outer* edges, never the inter-zone gutter.
- **zone** = a cell-extent region (cell 58 in pitch 60), **translucent fill +
  stroke** (an *area*, vs the outline frames); edges on the cell grid; backmost.
  Gutter lives only on the shared (inner) edges between adjacent zones; outer
  edges stay on the cell boundary so group→zone clearance stays 3px.

- **[AGREED] socket = fixed 26px square** (±13) — the glyph container. Sized just
  inside the inscribed square of the r20 circle (true inscribed = `r√2 = 28.28`; 26
  leaves a ~1px margin so even boxy glyphs clear the ring — corners at 13√2 = 18.4 <
  the ring inner edge). **Every glyph normalises to it** (centre its bbox, scale
  max-dim → 26), so glyph size is finally **one number**, and it's **identical for
  circle & square frames** (margin inside the circle; 7px margin inside the ±20
  square) → the glyph is frame-shape-independent.

**Z-order (back → front):** zone (fill) → links → group → node frame → glyph → selection.

---

## 3. Entity + state  [OPEN — barely started]

The second axis from the original framing; almost entirely undecided.

- **One entity or many?** Likely a shared *frame substrate* (geometry + shape +
  state) **composed** by node/zone/group, rather than one god-entity. *(lean)*
- **Selection = an unnamed group?** A permanence spectrum:
  `zone (region) → group (named set) → selection (transient set) → node (atom)`.
  `Z` and `Ctrl+G` already promote across it. If so, selection shares the group
  op-surface but is runtime-only (never persisted/synced).
- **Ownership / cascade** per level (delete/move). Today mixed: node→links
  cascade; group→dissolve (members live); zone→owns nothing.
- **State propagation** down containment (select group → members; lock → subtree;
  hover zone → contents). Reuses the existing orthogonal CSS-var composition.

---

## 4. Code status (reality, today)

- **SHIPPED:** frame/glyph decoupling — node = frame `shape` × glyph `type`; per-node
  `shape` field (circle\|square). Commit `b89418a`.
- **WORKING TREE (uncommitted):** rounded selection brackets, ±24 rx8 10px arms
  (`client/src/renderer.js`). Sized for node-42; would move to ±23 under node-40.
- **NOT BUILT YET:** group rendering (groups have no visual at all today); zones on
  the cell grid + gutter (today zones are independent w×h rects, half-offset grid);
  the node-40 resize and its ripple (NODE_R, frame defs, glyph scale, hit-test slop,
  label offset, tests, suites).

---

## 5. Open considerations (raised, before locking)

- **Colours** (deferred): group placeholder (violet `#b388ff`); **link vs selection
  both cyan `#4fc3f7` → they clash** when both present; zone a neutral translucent.
- **More variants** — the budget equation supports e.g. a denser node-44 or a
  spacious node-36 / 4px-gutter. A variant is a parameter set (pitch, node, ladder
  step, gutter, socket, frame radius, selection arm) → all per-layer extents/radii
  derive from it. `standard` is the locked baseline.
- **Glyph sizing / fit at r20.** Glyphs are **not** a uniform size — measured
  footprints at node-40 (scale 0.2857): host 21.4, server 21.1, vxlan 23.4×19.3,
  firewall 25.7×20.0, loadbalancer 28.6×24.8, router 28.6 (px). Range ~20→29px
  (~53%→72% of the 40px node). Art was loosely fitted to the r70 envelope, not a
  common box. Fixed invariant: `glyph scale = NODE_R/70` (0.2857 at r20); envelope
  = frame. **[RESOLVED]** glyphs normalise to the fixed **26px socket** (§2) — one
  uniform size, frame-shape-independent. (Original per-icon footprints retained above
  only as the measurement record.)
- **Behaviour/dynamics:** auto-fit vs fixed region; does the group box show *always*
  or only when selected; how group/zone geometry recomputes as nodes move.
- **Hit-testing for squares**; **zone adjacency/overlap rules** (may two zones
  overlap? may a node sit in several zones?).
- **Slides push for shapes** (square → RECTANGLE) — separate "Wave B".

---

## 6. Verification

- **Visual:** headless-Chrome render → `/tmp/draw-preview.png` (one stable file).
- **Numeric/behavioural:** `npm test` (node:test) + `bash scripts/smoke.sh` once built.

---

## 7. Stress-test framework — Geometry Rule Check (GRC)

A variant "survives utility" when its rendering passes a fixed set of **invariants**
across a **permutation ladder** of scenarios. Modelled on what the lineages already do:
schematic **DRC/ERC** (automated design / electrical rule checks) + game **blueprint
validity** on the tile grid.

### Criteria (scorecard — each variant × rung)
| # | rule | pass = | check |
|---|------|--------|-------|
| 1 | grid-snap / determinism | every coord on the grid (or a *defined* sub-grid); one reproducible render | auto |
| 2 | clearance | mandated gaps (cell gaps, ladder steps) respected; no illegal overlap | auto |
| 3 | attachment validity | every connection end is a defined, on-grid port/node | auto |
| 4 | legibility under density | relationships stay distinguishable at max load | eye |
| 5 | composability | one rule covers node/group/zone endpoints — no special-cases | eye |
| 6 | reuse cost | needs no new primitive (lower is better) | eye |
| 7 | scale by reserving | N grows by reserving space, not squishing | auto |
| 8 | routing tractability | can turn / branch / cross when edges aren't facing | eye |

*(auto = a DRC checker verifies it from the scene data; eye = visual judgement.)*

### Candidate variants
**Sketched:** `connect-ports`, `connect-edge-node`, `connect-single`, `connect-hybrid`,
`connect-node-aligned`. **To add:** `connect-bus` (bundled trunk + fan-out), `connect-ortho`
(Manhattan routing), `connect-junction` (1→many), `connect-group` (group-edge endpoint),
`connect-offset` (staggered containers → forced routing).

### The ladder (simple → torture)
1 single facing zones · 2 parallel ×N · 3 group↔zone · 4 group↔group · 5 + cross-zone
group (cross-cut) · 6 staggered/offset · 7 orthogonal turn (side edge) · 8 bus + fan-out ·
9 junction 1→many · 10 pass-through an intervening zone · 11 torture (dense nodes + nested
groups + overlapping zones + crossing buses). Rungs 6–11 pressure-test the px steps.

### The walk
For each rung: render every *surviving* variant in that scenario, run the GRC, lay the
results in a matrix (rows = variants, cols = rungs) with each cell's scorecard. Eliminate
variants that fail; deepen survivors at harder rungs; where px-steps break a rung, adjust
the variant's parameters and re-run (the matrix shows whether the fix holds across rungs).
Coalesce survivors + borrowed routing concepts ([[line-routing-references]]) into the final
connection grammar. **Retain every permutation in the preview** (never delete) — comparison + history.

### Tooling required
1. **scene-as-data** — a scene is a *list of placed primitives* (type, grid coords, extents),
   composed from (variant geometry) × (rung topology) × (connection style). Refactor
   `build.mjs` so SVG renders *from* this data (today it builds SVG strings directly).
2. **rung library** — `design/rungs/*.mjs`: each rung a topology generator returning
   scene-data (containers + relationships), connection-style-agnostic.
3. **DRC checker** — `design/grc.mjs`: scene-data → pass/fail per *auto* criterion
   (grid-snap, clearance, overlap, on-grid attachment, reserve-not-squish).
4. **matrix page** — render the variant × rung grid + per-cell scorecard; sectioned
   (containment · connection · routing).
5. **shot.mjs** — headless screenshot (already built).
