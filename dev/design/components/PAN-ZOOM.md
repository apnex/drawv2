# H26.6 -- pan and zoom: an infinite canvas, one grid per diagram, each viewer's own view

The design of record for H26.6, from the director's intent captured in `PAN-ZOOM-INTENT.md` and ruled as `H26-22`.\
Draw's canvas loses its edges: one grid per diagram, 60 by default and changeable, devices at its square centres and zones on its lines; a viewer pans and zooms with the touchpad and mouse gestures the intent names, and each viewer's view is remembered per diagram in their browser, with a reticle button home to 0,0.\
It overturns decision 1's fixed canvas and WD7's refusal of other grid values once ratified, and meets B289 and B325; it is built component first, as H26-3 ordered and H26-22 confirms, on the four components draw runs on -- `input-binding`, `input-capture` and `vector-scene` `0.2.0`, `snap-grid` `0.1.0` -- and the gesture tester.

**Standing:** revision 1, drafted, not ratified, awaiting its readings and the director's walkthrough; drafted in three parts, of which sections 1 and 2 are written and sections 3 to 8 and appendix A are to come; the code read is `1fbbc5b`; code lines measured by `tools/code-split.mjs` and its `codeLines`, browser behaviour in headless Chrome through `@apnex/headless-chromium` on draw's lab page, the scripts and their outputs at `~/taceng/drawv2-eval-runs/h26-pan-zoom/probes/`.

---

## 1. What this decides, and what it does not

It decides:
- what in draw assumes the canvas has edges or a fixed size, with its code lines, and what the four components offer and lack for a view and an unbounded grid (section 2);
- the target: what each component's contract gains, the tester's step, and draw's infinite canvas, gestures, remembered view, home button, one stored grid per diagram and the new forms of what an extent bounded today (section 3);
- the decisions owed, `PZ1` onward: each of the intent's fifteen flags and each decision the drafting finds, with options, costs, a recommendation and the evidence (section 4);
- the moves, in H26-3's order -- the components' releases, the tester on the director's Chromebook, then draw, per-diagram grid size its own step -- each with its guard and its validation in the live lab (section 5);
- the projection by part against H26.8's close (section 6), the axiom alignment audit (section 7), and the build checklist each move's builder satisfies and its verifier checks (appendix A).

It does not decide:
- anything the intent's anti-goals exclude: a view stored in the diagram or shared between viewers (AG-1), the wheel zooming without Ctrl or a drag on open ground panning (AG-2), one grid size for every diagram or the two grids sized apart (AG-3), a device scaling with its grid (AG-4), or draw built before the components it needs (AG-5);
- a touch screen's or a pen's gestures, which the intent does not name: their pointers keep today's meaning;
- the stored document's form beyond its grid, or draw's configuration as data (B425);
- any behaviour change beyond those section 5 names, each ruled with this design.

---

## 2. What draw holds today

Read at `1fbbc5b`, where draw's running code is 13,979 code lines (`node tools/code-split.mjs`).

### 2.1 Every extent and fixed size

| # | What | Where | Code lines | What it assumes |
|---|---|---|---:|---|
| E1 | the fixed logical canvas and its fit | `product/canvas.mjs:59`; `app/index.html:145-147` and `lab/index.html:63-65`, written by `tools/canvas-layout.mjs`; `app/canvas.css:9-10`, `:15`, `:17` | 11 | a `viewBox` of `-960 -540 1920 1080` on a root of 100% of the stage, scaled to fit by the root's default `preserveAspectRatio` and letterboxed; the ground `#canvas` fills it, and its edge is stroked in edit and run mode, so the edge is drawn (decision 1) |
| E2 | the extents | `model/surface.mjs:6-7`; `plugins/layouts/layout-table.mjs:25` | 3 | the surface 1920 by 1080, devices within 900 by 480 of the origin, zones within 930 by 510; `NODE_EXT` is named on 20 lines in 7 files, `ZONE_EXT` on 13 in 4 |
| E3 | the layout table, the two stored layouts and WD7 | `plugins/layouts/layout-table.mjs:27-35`; `plugins/layouts/layout-kind.mjs:14-17`, `:19-49`; `plugins/layouts/layout-records.mjs:13-23`; `kernel/geometry.mjs:25-38` | 64 | every diagram stores two `layout` entities, `node` and `zone`, each a pitch, an offset and an extent, their ids fixed, a document lacking one completed (`always`); any other value is refused (`plugins/layouts/layout-kind.mjs:37-42`, 6 lines, WD7); the grids are opened bounded by the extent and unbounded beside it; `LAYOUT_TABLE` is named on 15 lines in 5 files, `ZONE_GRIDS` on 16 in 7 |
| E4 | the per-kind caps | `kernel/geometry.mjs:63-76`; `product/kinds.mjs:86`; `plugins/zones/zone-kind.mjs:63` | 16 | the anchor cap, 527, and the zone cap, 576, are the counts of each grid's positions within its bounds, found by listing them at load (H26-21); the other caps -- 2,000 links, 4,000 pipes, 2,000 groups -- are plain numbers and need no extent |
| E5 | bounds checked at every door | `product/kinds.mjs:44`, `:91-92`; `plugins/zones/zone-kind.mjs:48-51`, `:59-60`; `plugins/devices/device-fields.mjs:17`, `:69-79` | 21 | an anchor's `x` and `y` within the device extent; a zone's corner, size and far edge within the zone extent; a device's span within the surface (B27); each refused by the planner, so by the browser, the agent door and the CLI alike |
| E6 | the editor held inside the extent | `app/src/snap.js:19`, `:25`, `:35-39`, `:73-88`, `:129`; `plugins/layouts/layout-canvas.mjs:42`; `plugins/zones/zone-painter.mjs:48`; `plugins/zones/zone-gestures.mjs:17`; `plugins/zones/zone-keys.mjs:17`, `:44-45`; `plugins/devices/device-size.mjs:17`, `:27`; `app/src/palette.js:146-148`; `app/src/editing-visuals.js:23-39` | 51 | `snapNode` snaps to the device grid within its extent, so a point beyond it snaps to the edge (15 call lines in 3 files); `clampDelta` holds a move inside each place's grid bounds (5 lines in 3 files); a place whose grid has no bounds is refused; the zone's corner drag, wrap and size step, and a device's span step, stop at the edge; a palette drop beyond the 1920 by 1080 is refused; the crosshair spans the surface |
| E7 | the agents' and the CLI's lists | `server/rest.js:137-139`, `:681-692`; `server/anchor.mjs:62-70`; `cli/verbs.mjs:2096`, `:2264-2267`, `:1897-1904` | 34 | the anchors route answers every position within each grid's bounds, 527 and 576; placement walks every position in view of the device extent for a free one; the CLI computes a zone's cells with the literals 30 and 60 (B402), its refusal says a cell beyond 40 looks like a pixel, and its `add`, `anchor free` and `map --full` read the whole list |
| E8 | the export's frame | `server/svg.mjs:91-117`, `:119`, `:128-129` | 29 | the frame found by parsing `transform` and `d` back out of the drawing (B435), padded by 18; no extent, but a re-reading of what it drew |
| E9 | the grid drawn | `plugins/layouts/layout-canvas.mjs:30-37`; `app/src/grids.js:15-34` | 26 | every lattice point within each extent, one scene item per grid, drawn at load and never again, whatever is in view |
| E10 | screen and drawing | `app/src/input.js:61`, `:148`, `:407`; `app/src/labeledit.js:66-68`, `:145`, `:151` | 8 | a press is a click within 4 drawing units, the gesture session's threshold (B404); the label editor is placed by the scene's `toScreen` and its font scaled by the root's screen scale, so it follows any view already |
| E11 | the grid's pitch as a device's unit, a speed and an index | `kernel/spec.mjs:10`; `app/src/snap.js:21`; `plugins/devices/device-appearance.mjs:34`, `:98`; `plugins/devices/device-types.mjs:161`; `plugins/devices/device-footprint.mjs:20`; `plugins/simulation/movers.mjs:49`, `:77`; `plugins/simulation/rules.mjs:43`, `:69`; `app/src/compose-canvas.js:70` | 11 | one constant, 60, is the grid's spacing and also a device's socket step, a content region's cell, a span's footprint, a packet's speed and a tower's range in cells, and the cell the occupancy index keys by (2.3) |

So 274 code lines, 2.0% of draw's 13,979, hold or read an extent or the fixed size, across 34 files (`inventory.mjs`); most are one line each, the extent being read through a name, so the names' reach is the measure of the change as much as the lines are.\
Examined and assuming no edge: the network's routing and its pipes, the simulation's runs beyond its speeds and ranges, the groups' hulls, and the stored seed board (`server/seed.js`), which lies within the extents but is not bounded by them.

### 2.2 What the fixed canvas and the grids cost, measured

| Measured | Figure | Probe |
|---|---|---|
| today's fit, the canvas's screen scale at three windows (inner sizes; a real window's tab strip makes each smaller) | 0.495 at 1366 by 576, the drawing 951 by 535 pixels with about 207 empty on each side; 0.784 at 1920 by 888; 0.525 at 1280 by 608 | `fit-and-view.mjs` |
| the click threshold on screen (B404) | 4 drawing units are 1.98 screen pixels at the first fit and 3.14 at the second, so a zoomed-out view shrinks it further | `fit-and-view.mjs` |
| what the page holds for an empty diagram | 1,115 elements, 1,103 of them the two grids' dots, 527 and 576 | `fit-and-view.mjs` |
| the two caps, listed at load | 527 and 576 in 2.8 milliseconds; the same counts by arithmetic from the grid's first and last positions | `grid-listing.mjs` |
| the most `snap-grid` lists in one answer | 5,592,404 positions: its `deepFreeze` tracks every object it freezes in one `Set`, three per position and two more, and V8's `Set` holds 16,777,216; one position more throws "Set maximum size exceeded" after 17.5 seconds, where the contract allows `max` up to 2^32 - 1 | `grid-listing.mjs` |
| listing a million positions | 2.1 seconds, 155 MB held after collection (B325 recorded 3.6 seconds and 424 MB, measured at its peak) | `grid-listing.mjs` |
| square sizes the zone lattice can take | every even size from 1 to 200 opens; every odd one is refused, its half-square origin not an integer (`snap-grid` SG1) | `odd-size.mjs` |

### 2.3 The grid's size is also a device's unit

`STD.pitch` (`kernel/spec.mjs:10`) is derived from a device's frame -- a 40 frame, six ladder steps of 3 and a gutter of 2 make 60 (`kernel/spec.mjs:5`) -- and is read as the grid's spacing by snapping, the clamp, the nudge and the readout through `GAP`.\
It is read as a device's own unit too: a device's sockets a pitch apart in its own frame, its content regions' cells, and its span's footprint, found by `span` on the device grid (`plugins/devices/device-fields.mjs:72`, `plugins/devices/device-footprint.mjs:20`, `plugins/devices/device-gestures.mjs:27`, `server/svg.mjs:101`).\
It is the simulation's unit of speed and range, and the occupancy index keys each device by its cell on the device grid.\
So the pitch is named on 29 lines in 15 files and `NODE_GRID`'s `span` and `nearest` asked on 11 lines in 8, and the intent's Q3 -- a size change keeps every device's own size -- needs each of them read either as the diagram's grid or as a device's unit that stays 60.

### 2.4 What the four components offer and lack

| Component, as draw pins it | Offers a view or an unbounded grid | Lacks |
|---|---|---|
| `vector-scene` `0.2.0` | conversions through the root's screen transform at the moment asked, its `viewBox` and letterboxing included (VS10); the root and its `viewBox` are the application's to set, before or after the scene opens (VS13) -- measured: a `viewBox` panned to 5000, 7000 and one zoomed four times about 0,0, set after opening, each followed exactly, `toScreen` and `toDrawing` equal to `DOMPoint`'s over the root's transform at three points and their round trip exact (`fit-and-view.mjs`); an item removed whole in one call (VS6); the item under a screen point, captured pointer or not (VS12); every layer's element the scene's alone, "so the scene can give every layer what a view needs when one arrives" (VS4) | a view of its own: panning, zooming, each layer told the visible area and the scale, held "until its first consumer is designed" (VS13; B419); unloading what is out of view; zoom about a point |
| `snap-grid` `0.1.0` (0.1.1's built files are the same bytes) | a grid with no bounds, every coordinate within 2^50 its domain (SG1, SG2); the nearest position on any grid (SG3), which is the mapping a size change asks -- the new grid's nearest to each device's point; positions in a view, `{ region, scale }`, thinned by a least spacing on screen, the stride doubling past `max` (SG6), which is a level of detail for drawn dots | a count of the positions in a region without listing them -- `inView` counts before it lists (SG6) but answers the list alone; a listing ceiling its build keeps, 5,592,404 against the contract's 2^32 - 1 (2.2); an origin that is not an integer, so a zone lattice on an odd square size (2.2; its fit criteria: "pitches and origins are integers until a consumer needs otherwise") |
| `input-capture` `0.2.0` | wheel facts when listed, with `deltaX`, `deltaY`, `deltaMode` and `ctrlKey` -- a touchpad's pinch arrives as a wheel with Ctrl held -- its listener not passive, so a claim stops the browser scrolling or zooming (IC4, IC5); a context-menu fact; each pointer fact's screen point beside its drawing point; the button, the buttons held and the pointer's type; the pointer taken (IC8) | nothing the intent's gestures are known to need; draw listens for focus loss alone today (`app/src/capture.js:89`) and stops the browser's menu with a listener of its own (B75), and whether a claimed middle press stops the platform's autoscroll is for the tester to show |
| `input-binding` `0.2.0` | the keys held (IB14), the context a Space-held drag reads; a button declared per gesture, its presses and its release (IB9, IB11), so a middle-button and a right-button drag are gestures of their own; a press resolved in one call (IB15); rows that match any fact draw hands them | a threshold measured on screen: one number per session, in the units of the facts' `at` (IB9), which in draw are drawing units, 1.98 screen pixels at today's fit (B404) |
| the gesture tester (`input-tester`) | shows every wheel turn and pinch as delivered, claimed and drawn; draws no grid | pan and zoom of its own picture, a non-goal in its own architecture target (line 67 of that document, in its repository), so its step changes its own target |

Each component's unreleased `main` holds only its tests' move to `clean-runner` and `headless-chromium`, nothing toward a view or an unbounded grid.

### 2.5 What holds draw's behaviour, and what of it assumes the fixed canvas

The export's bytes (`tests/svgexport.test.js`), the native record (`tests/fixtures/native-record.mjs`) and the gesture corpus (`tests/fixtures/gesture-corpus.json`) read the scene's items and the model in drawing coordinates, with no view, so a view that changes only what is on screen leaves each as it is.\
The pixel probe against production compares screenshots at one window, 1600 by 1000 (`tools/probe/parity.mjs:259`), so it holds only while both sides open a diagram the same way, which the first opening's rule decides (section 4).

---

## 3. The target

To come: each component's contract gains -- `vector-scene`'s view, `snap-grid`'s unbounded grid with counts, areas and a listing ceiling, `input-capture` and `input-binding` only where a gesture shows a gap -- the tester's step, and draw's infinite canvas, gestures as rows, remembered view, home button, one stored grid per diagram and its migration, and the new forms of the caps, anchor lists, export frame and CLI.

---

## 4. Decisions owed

To come: `PZ1` onward, each of the intent's fifteen flags and each decision the drafting finds, with options, doing nothing among them where it applies, costs, a recommendation and the evidence.

---

## 5. The moves

To come: the component releases, the tester on the director's Chromebook, then draw, per-diagram grid size its own step, each with its guard and its validation in the live lab.

---

## 6. Before and after, by part

To come: the projection by part, estimated against H26.8's close in `dev/CODE-SPLIT.md`, as H26-16 asks.

---

## 7. Axiom alignment audit (M7)

To come: the audit, its verdict, tensions and guardrails.

---

## 8. Reviews

To come: each reading recorded as it is made, its findings tiered as H26-15 as amended rules.

---

## Appendix A -- the build checklist

To come: each row a move's builder satisfies and its independent verifier checks.
