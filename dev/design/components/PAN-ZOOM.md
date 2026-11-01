# H26.6 -- pan and zoom: an infinite canvas, one grid per diagram, each viewer's own view

The design of record for H26.6, from the director's intent captured in `PAN-ZOOM-INTENT.md` and ruled as `H26-22`.\
Draw's canvas loses its edges: one grid per diagram, 60 by default and changeable, devices at its square centres and zones on its lines; a viewer pans and zooms with the touchpad and mouse gestures the intent names, and each viewer's view is remembered per diagram in their browser, with a reticle button home to 0,0.\
It overturns decision 1's fixed canvas and WD7's refusal of other grid values once ratified, and meets B289 and B325; it is built component first, as H26-3 ordered and H26-22 confirms, on the four components draw runs on -- `input-binding`, `input-capture` and `vector-scene` `0.2.0`, `snap-grid` `0.1.0` -- and the gesture tester.

**Standing:** revision 1, drafted, not ratified, awaiting its readings and the director's walkthrough; drafted in three parts, of which sections 1 to 4 are written and sections 5 to 8 and appendix A are to come; the code read is `1fbbc5b`; code lines measured by `tools/code-split.mjs` and its `codeLines`, browser behaviour in headless Chrome through `@apnex/headless-chromium` on draw's lab page, the scripts and their outputs at `~/taceng/drawv2-eval-runs/h26-pan-zoom/probes/`.

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

Each decision this section rests on is section 4's, named where it binds; each recommendation is taken here as the target, to be changed with the decision if the walkthrough changes it.

### 3.1 The part map

| Part | Duty after H26.6 | What changes | Speaks |
|---|---|---|---|
| `view` (new, `view.js` in `app/src/`) | Hold each viewer's view of the open diagram, apply it, remember it, and move it home | new: the view `{ x, y, scale }`, its clamp (PZ12), its verbs -- pan, zoom about a point, home, fit, actual size -- and its store (PZ23); a declared part, `kind: 'host'`, consuming nothing, handed the scene and a store by the composition | `vector-scene`'s view (3.2) |
| `layouts` | Hold a diagram's one grid | one stored `layout` entity, its size the diagram's; the table, the extents and WD7's refusal gone; the size change a planner reaction (PZ4) | `snap-grid`: the diagram's two lattices opened from its one record |
| `lattice` | Compute geometry on the grid | `latticeGrids` opens a record's two unbounded lattices; `nodeGridWithin`, `positionsWithin` and `NODE_GRID` as the grid go; `STD.pitch` stays 60, a device's unit (PZ18) | `snap-grid` |
| `canvas` | Turn input into edits | the view's rows and gestures added (3.6); snapping on the diagram's unbounded grid, no clamp to an extent; the palette's drop on any point of the canvas | `input-capture`, `input-binding` |
| `grids` | Draw the grids places snap to | each grid drawn from the scene's visible view, thinned on screen (PZ24) | `snap-grid`'s `inView`, `vector-scene`'s items |
| `label-editor` | Edit a drawn label in place | its font scaled by the view's scale, where it read the root's (`app/src/labeledit.js:145`) | `vector-scene`'s `toScreen` and view |
| `devices`, `zones` | as today | a device's span sized in the unit, 60, never the grid (PZ18); a zone's corners on the zone lattice (PZ2); no edge refusals | -- |
| `rest`, `placement`, `cli` | as today | anchor lists by area (PZ9); placement's nearest free point by rings; the CLI's zone cells from the stored pitch (PZ15) | -- |
| `product-page`, `lab` | as today | the reticle button home (3.7), the store handed to `view` | -- |

### 3.2 What each component's contract gains

**`vector-scene` `0.3.0` -- a view** (PZ22; B419; its D6 as the director refined it):
- a scene declared with `view: true` holds a view, `{ x, y, scale }`: the drawing point shown at the root's centre, and the screen units per drawing unit, opening at `{ x: 0, y: 0, scale: 1 }`; a scene declared without one is exactly `0.2.0`'s;
- `setView(view)` judges each member finite and `scale` above 0, writes one transform -- `translate(w / 2, h / 2) scale(scale) translate(-x, -y)`, `w` and `h` the root's box -- on every layer's element, scene and foreign alike, the elements it alone writes on (VS4), and answers the view it wrote; `view()` answers it;
- `visible()` answers `{ region, scale }`, the drawing rect the root's box shows and the scale, exactly `snap-grid`'s view form (SG6), so an application hands it to `inView` unchanged;
- `zoomAbout(screen, factor)` answers the view whose scale is `scale * factor` and which keeps the drawing point under `screen` where it is, without setting it;
- `toDrawing` and `toScreen` compose the view with the root's screen transform (VS10), `itemAt` and `itemOf` are unchanged, and the root's own attributes stay the application's (VS13), its `viewBox` absent for a viewed scene;
- what it reads of the platform gains the root's `getBoundingClientRect`, read by `setView` and `visible` alone, declared in VS1;
- it unloads nothing: an item out of view stays on the page, removing one being one removal already (VS6; PZ11).

**`snap-grid` `0.1.2` -- its build keeps its contract** (PZ13): `inView` freezes each value it makes as it makes it, tracking none, so it lists any count its contract allows where it now stops at 5,592,404 (section 2.2); a new invariant lists 2^24 positions; nothing else changes, and draw needs nothing more of it -- an unbounded grid (SG1), the nearest position a size change asks (SG3) and positions in view thinned on screen (SG6) are there today.

**`input-binding` `0.3.0` -- a threshold measured on screen** (PZ17; B404): the session's declaration gains `measure`, `'at'` by default or `'screen'`; with `'screen'` the session reads a fact's `screen` point where it reads `at` (IB1, IB10), the threshold stated in its units; a declaration without it is `0.2.0`'s.

**`input-capture`**: no release; the gestures use the wheel facts it lists (IC4, IC5), draw listing `wheel` beside `blur`, and a right press's menu stays stopped by draw's own listener (B75); a gap the tester shows on the Chromebook -- the platform's autoscroll on a middle press is the one known risk -- is answered by a release of its own, ruled when shown.

### 3.3 The tester's step (PZ30)

The tester composes `vector-scene` `0.3.0` and `input-binding` `0.3.0` and shows each of the intent's gestures on the director's Chromebook before draw has any:
- its table gains the view's rows (3.6) and its session the three drag gestures, measured on screen;
- a view pane beside its picture of the keyboard and mouse, a second scene on an `svg` of its own declared with a view, so the picture stays still: an unbounded square grid of 60, drawn from `visible()` and thinned by `inView` (PZ24), panned and zoomed by every gesture, its scale and centre shown as numbers, and a reticle button home to 0,0;
- each gesture's verdict shown as today's verdicts are, a pan by its distance on screen, a zoom by its factor and the point it keeps;
- its architecture's non-goal "pan and zoom of the picture" amended by a decision of its own record to "pan and zoom of anything but the view pane".

### 3.4 One grid per diagram, stored

- **The stored form** (PZ14): one `layout` entity, `{ id: 'layout-000001', name: 'grid', pitch }`, `pitch` an even integer (PZ20) within PZ21's range, 60 by default; the device lattice's origin 0, so cell 0,0 lies at the origin; the zone lattice's origin `pitch / 2` on both axes, always, never stored (Q2: "Zone grid is always in-between the node grid").
- **The lattices**: `latticeGrids(record)` opens `{ device, zone }`, both unbounded; every reader of `NODE_GRID`, `ZONE_GRIDS` or `nodeGridWithin` as the grid takes the diagram's lattices from its model through the composition, as B325 said every caller must.
- **Validation**: the layout row checks `pitch` even and in range and refuses any other field; WD7's refusal and the second layout go; an anchor's `x` and `y` are on the device lattice and within PZ31's bound, a zone's corner on the zone lattice and its sides whole squares; the per-kind caps are PZ8's numbers.
- **The migration, once**: schema 3 to 4, run once on production's documents during a freeze as WD9 ruled for schema 3, the deployed version reading schema 4 alone; each document's two layouts, which every readable document holds at the table's values (19 of 19 production, 4 of 4 templates, `stored-grids.mjs`), become `{ id: 'layout-000001', name: 'grid', pitch: 60 }`, and nothing else in it moves; a document lacking the record is completed with it (`always`).
- **The agents' answers**: `GET /diagrams/<id>/layouts` answers the one record; the routes by name keep `node` and `zone`, each now a lattice of the one grid (PZ9).

### 3.5 A size change (PZ1 to PZ4)

A person, an agent or the CLI sets the record's `pitch` as any edit (PZ29); the planner's transaction phase runs the layouts plugin's reaction, so every door gets one answer (PL-3), and the change is one commit, one undo, seen by every viewer at once (PZ4):
1. each anchor -- device or waypoint -- moves to the new device lattice's nearest point to where it stands (`nearest`, SG3; Q3: "they just move to nearest point"), a spanning device by its anchor, its first cell (PZ1);
2. where two land on one point, the one later in drawing order moves to the nearest free point (PZ3), measured within one square in every case;
3. each zone's two corners move to the nearest points of the new zone lattice, so its edges stay on the lines (PZ2);
4. every size -- a device's span, frame, sockets and content in the unit of 60 -- is kept (Q3: "scalaing a grid has no impact on individual node sizes"; PZ18), and links, pipes and groups follow their anchors, their routes derived again as today;
5. the notice says how many moved and names each anchor moved to a free point and each zone whose enclosed anchors changed.

### 3.6 The gestures, as rows

The view's rows are a table of their own, `viewRules`, in `input-binding`'s form, asked for every pointer and wheel fact in every mode before the press table, so run mode pans and zooms as the others do; their gestures are declared in the one session, each with its button, the threshold 4 screen pixels (PZ17):

| Row | Fact | Runs |
|---|---|---|
| `scroll-pan` | a `wheel` without Ctrl | the view panned by the deltas over the scale, a line 40 pixels and a page the canvas's height |
| `pinch-zoom` | a `wheel` with Ctrl -- a pinch or Ctrl and a mouse wheel | the view zoomed about the fact's `screen` point by `2 ** (-deltaY / 300)`, the constant calibrated in the tester |
| `pan-middle` | a `down` of button 1, anywhere | the `pan` gesture, button 1 |
| `pan-right` | a `down` of button 2 on open ground -- the canvas, a zone pressed without Shift among it (U1) | the `pan` gesture, button 2; a right click that never travels does nothing, as today (PZ5) |
| `pan-space` | a `down` of button 0 while Space is held (IB14) | the `pan` gesture, button 0; Space's datum moves to its key-up when no pan ran while it was held (PZ27) |
| the keys | `=` or `+`, `-`, `Shift+0`, `Shift+1`, `h` | zoom in, zoom out, actual size, fit the diagram, home (PZ28) |

A `pan` gesture's update moves the view by the pointer's travel on screen over the scale; its commit and cancel change nothing more, a view being no edit.\
Dragging on open ground with the left button stays the selection box, and the wheel without Ctrl never zooms (AG-2).

### 3.7 The view, remembered, and the way home

- **The view**: `{ x, y, scale }`, the drawing point at the canvas's centre and the screen pixels per drawing unit, `scale` within PZ12's range; when the canvas is resized the page tells the view part, which sets the view again, so the centre stays.
- **Remembered** (PZ23): in the viewer's browser alone, `localStorage` key `draw:view:<diagram id>`, the value `{"v":1,"x":...,"y":...,"scale":...}`, written half a second after the view last moved and when the page hides, read when the diagram opens; never stored in the diagram, sent, or shared (AG-1), so viewers look at different parts at once; a value absent, unreadable or out of range is ignored; the lab, holding no diagram id, remembers none.
- **First opening** (PZ7): with nothing remembered, centre 0,0 at the scale that fits the old 1920 by 1080 frame in the canvas, so every diagram opens as it shows today.
- **Home** (PZ6): a reticle button, `button#view-home`, page chrome over the canvas's lower right corner beside `#container`, and the key `h`, each bringing the view's centre to cell 0,0 (Q5: "moves the camera back to cell 0,0"), the zoom kept.
- **Far out** (PZ12): the dots thinned to a least spacing of 24 screen pixels (PZ24), and labels and their pills hidden when a label's text would be under 5 screen pixels.

### 3.8 Draw's other forms

- **The canvas**: the root `#container` carries no `viewBox` and no ground rect; `CANVAS_VIEWBOX` goes and `tools/canvas-layout.mjs` writes the root bare; the ground is the root's own fill; edit and run mode's edge becomes an inset outline of the root, at the screen's edge (PZ25); the crosshair spans `visible()`.
- **The extents**: `SURFACE`, `NODE_EXT` and `ZONE_EXT` go; `snapNode` and `snapIn` snap on the diagram's unbounded lattices; `clampDelta` quantises a move by the grid and holds no edge; a place carries an unbounded grid, `placesOf`'s refusal of one gone; a zone's step and a device's span step have no edge; a palette drop lands on any point of the canvas.
- **The caps** (PZ8): the anchor cap 527 and the zone cap 576, stated as numbers, where they were counted from an extent.
- **The anchor lists** (PZ9): `GET .../layouts/<name>/anchors?x0=&y0=&x1=&y1=`, an area required, answered by `inView` with a `max` of 10,000 and refused, naming the count, when thinned; placement finds the nearest free point by rings about the point asked, where it listed the extent.
- **The export** (PZ10): as today, its frame from what it drew.
- **The CLI** (PZ15): a zone's cells from the stored `pitch`, read from `GET /diagrams/<id>/layouts`; `map` and `anchor free` over the used bounds and a margin unless an area is given; `add` takes any cell.
- **An agent** (PZ16): reads the document and the lists as today; a view is a viewer's alone.
- **The occupancy index** (PZ26): keyed by the diagram's device lattice, built again when the grid changes.
- **The unit and the simulation** (PZ18, PZ19): `STD.pitch` is read only as a device's unit -- sockets, content cells, span footprints, the export's span bounds -- and by the simulation's speeds and ranges; every reader that asks where a position lies asks the diagram's grid.

---

## 4. Decisions owed

Each offered with its options, doing nothing among them where it applies, their costs, a recommendation apart, and its evidence; marked *the director's* where the director's judgement is needed, the rest the architect's to settle at ratification.\
The figures are the probes' at `~/taceng/drawv2-eval-runs/h26-pan-zoom/probes/`: `size-change.mjs` over the 19 production documents the pixel probe pins and the 18 stored and seeded boards, at square sizes 20 to 120.

| # | Decision | Options, and what each costs | Recommendation, and its evidence |
|---|---|---|---|
| PZ1 | How a spanning device lands on a new grid (F1); rests on PZ18 | (a) by its anchor, its first cell, to the nearest point -- its far squares off the new lines unless its span divides by the size; (b) by its centre to the nearest point -- its anchor then off the grid, against B110's on-grid rule; (c) its span re-counted in new squares -- its size changed, against Q3 | (a): (b) puts 67 of the 109 production spanning devices' anchors off the grid even at 60, an even span's centre lying between points; under (a), at 40 a span stays whole squares for 42 of 109, at 80 for 12, the centre moving 18.5 and 30.2 on average, and at 20, 30 and 60 nothing moves |
| PZ2 (the director's) | What a zone does on a size change (F2) | (a) keep its size, its corner to the nearest zone-lattice point -- its edges off the lines; (b) both corners to the nearest zone-lattice points -- on the lines, its size changed; (c) outward, floor and ceiling (`enclosing`) -- on the lines, never smaller | (b): Q2 puts zones on the lines, which (a) breaks for 138 to 165 of the 169 production zones at 40 to 120; (b) changes no zone's enclosed anchors when the grid shrinks and 35 to 55 of 169 when it grows to 80 to 120, where (c) changes 24 to 39 when it shrinks and 55 to 70 when it grows |
| PZ3 (the director's) | Two anchors landing on one point (F3); rests on PZ1 | (a) refuse the change, naming each pair; (b) the later in drawing order to the nearest free point; (c) nothing -- the planner refuses the edit by B112's invariant, unexplained | (b): shrinking to 40 or 50 collides nowhere; growing collides in 7 to 11 of the 19 production documents, 20 to 48 points at 80 to 120, so (a) refuses most growth; under (b) every displaced anchor finds a free point within one square, moving 50 to 101 on average, and the notice names each |
| PZ4 | A size change as an edit (F4) | (a) one transaction, the reaction in the planner -- one undo, every viewer at once, the agent door's answer the browser's; (b) built by the browser as a commit of moves -- the agent door and the CLI computing their own; (c) a setting outside the document -- no undo, a viewer's alone, against Q3 | (a): the planner already runs tenants' reactions in a transaction's phases (`planner/txn.mjs`, PL-3) |
| PZ5 | A right-button drag on open ground (F5) | (a) a `pan` gesture on button 2 when the press's hit is the canvas -- a zone pressed without Shift among it, which passes through (U1); (b) a right drag panning anywhere -- taking the right rows on a device, a waypoint and a Shift-pressed zone; (c) none -- against the director's added constraint | (a): through draw's own tables (`right-button.mjs`), a right or middle press on open ground matches no row in any of 192 cases each -- every modifier, writable or locked, a hand held or not, view, edit and run -- where on a zone the right rows match; live, a right press dragged on open ground commits, selects and claims nothing, Alt and right there does nothing, and a selection box completes with the right button joining it, which the platform delivers as moves (IB11) |
| PZ6 (the director's) | The home button (F6) | (a) to cell 0,0, the zoom kept, the reticle over the canvas's lower right, the key `h`; (b) to 0,0 at the first opening's scale; (c) to 0,0 at actual size | (a): Q5 names the place, cell 0,0, and fit and actual size have keys of their own (PZ28), so home does one thing; shown in the tester first |
| PZ7 (the director's) | What a diagram first shows (F7) | (a) centre 0,0 at the scale that fits the old 1920 by 1080 frame -- every diagram as it shows today; (b) the whole diagram fitted -- each diagram's first picture changed; (c) 0,0 at actual size -- 1.3 to 2 times closer than today on the windows measured | (a): every readable document lies within the old frame (WD7's extents held them), so nothing changes on first sight and the pixel probe against production stays valid; today's fit is 0.495 at a 1366 window and 0.784 at 1920 (`fit-and-view.mjs`) |
| PZ8 | The per-kind caps without an extent (F8) | (a) the anchor and zone caps stated as the numbers they are, 527 and 576; (b) raised, to 750 or 2,000 as links' and groups' are; (c) none | (a): no accepted document changes; the largest production document holds 65 anchors and 27 zones; a board of 750 devices pans at the two-frame floor in Chrome, 1,000 at 50 ms a step and 2,000 at 100 (`pan-cost.mjs`), so a higher cap waits on PZ11; a row registered to raise them, its trigger a diagram near the cap |
| PZ9 | The agents' anchor lists and placement (F9) | (a) a list by an area asked, at most 10,000 positions, refused with its count past that; placement's nearest free point by rings; (b) the old extent's positions kept as the list -- an edge again; (c) the list removed -- the CLI's `add`, `anchor free` and `map` lose their answer | (a): `inView` thins past its `max` (SG6), so asking for 10,000 and refusing a thinned answer bounds the work; a request names its area as the CLI's `map` already does for the part in use |
| PZ10 | The export's frame (F10; B435) | (a) as today, from what it drew -- no extent in it; (b) from the parts' footprints -- every export's bytes changed | (a): its frame never read an extent (section 2.1, E8), so the infinite canvas needs nothing of it; B435 stays held, its trigger the frame found wrong |
| PZ11 | Unloading what is out of view (F11; B289); rests on PZ8 | (a) nothing: every item on the page, the view told to layers (PZ22) so a culled item is one removal when needed; (b) the scene culls by bounds the application hands it; (c) draw culls by its footprints as the view moves | (a) at PZ8's caps: in Chrome a board of 500 devices pans at the two-frame floor whole or culled, 750 at the floor with its slowest tenth at 50 ms, 2,000 at 100 ms whole and the floor culled, 4,000 at 232 and the floor (`pan-cost.mjs`); B289 stays held, its trigger the caps raised past 750 or a person finding panning slow |
| PZ12 (the director's) | The zoom range and what shows far out (F12) | (a) a scale from 0.1 to 4 screen pixels per unit, a square 6 to 240 pixels at 60, dots thinned to 24 pixels apart, labels hidden under 5 pixels of text, proven in the lab; (b) no lower bound -- an empty screen of dots past measure; (c) today's fit and closer only | (a): unthinned, a view at 0.05 holds 162,613 dots, listed in 326 ms; thinned to 24 pixels no view from 0.05 to 4 holds more than 2,622 (`dots-in-view.mjs`); today's fit draws a label, 13 units (`STD.fontSize`), at 6.4 pixels (`fit-and-view.mjs`), so labels hide below a scale of 0.38 |
| PZ13 | Listing an unbounded grid (F13) | (a) never listed: every list a view's or an asked area's, under a `max`; `snap-grid` `0.1.2` freezing as it makes so its build keeps its contract; (b) `snap-grid` gaining a count of positions in a region -- a capability with no consumer under (a); (c) nothing -- the build's ceiling, 5,592,404, against its contract's 2^32 - 1, left | (a): measured, one position past the ceiling throws after 17.5 s, a million take 2.1 s (`grid-listing.mjs`); draw asks no more than 10,000 at once under PZ9, PZ12 and PZ24 |
| PZ14 | The stored grid and its migration (F14) | (a) one `layout` entity, `{ id: 'layout-000001', name: 'grid', pitch }`, migrated once, schema 3 to 4, as WD9 deployed schema 3; (b) the two records kept, the zone's checked equal to the device's -- two records of one fact (A2); (c) a field of the document's meta -- outside the edits, no undo (PZ4) | (a): every readable document is schema 3 with the table's values (19 of 19 production, 4 of 4 templates, `stored-grids.mjs`), so the migration is exact; `pitch` keeps the word agents read today (WD8) and `snap-grid`'s own |
| PZ15 | The CLI's grid (F14; B402); rests on PZ14 | (a) its zone cells from the stored `pitch`, read from the layouts route; (b) the literals kept -- wrong on any other size; (c) the CLI taking `snap-grid` -- OD-3, its packaging, not this design's | (a): the CLI imports no product module (SD1, B138) but already reads `GET /diagrams/<id>/layouts` (`cli/verbs.mjs:1822`) |
| PZ16 | What an agent perceives (F15; B418) | (a) as today -- the document, the lists, the export -- a view being each viewer's own; (b) a viewer's view sent to agents -- against AG-1; (c) the scene's items as data for agents -- B418's own delivery, with no consumer | (a): nothing an agent reads depends on a view; B418 stays held as restated at H26.8 |
| PZ17 | A press's travel, on screen (F15; B404) | (a) `input-binding` `0.3.0` measuring a session on the facts' `screen` points, 4 pixels; (b) draw handing the session a copy of each fact with `screen` as its `at` -- no release, a second fact per input, the translation H26.8 retired; (c) nothing -- 1.98 pixels at today's fit already, less as the view zooms out | (a): B404 named it; `input-capture` puts the screen point on every pointer fact already (IC5); the palette's threshold (`app/src/palette.js:20`) moves to screen pixels with it |
| PZ18 | The grid's pitch and a device's unit (section 2.3) | (a) `STD.pitch` stays 60 as a device's unit -- span, frame, sockets, content cells -- and the grid's size is the diagram's record; (b) one pitch for both -- a device grows and shrinks with the grid, against Q3 ("no impact on individual node sizes") and AG-4 | (a), the director's constraint: the 29 lines naming the pitch and the 11 asking `NODE_GRID`'s `span` and `nearest` are each read as one or the other (3.8) |
| PZ19 | The simulation's speeds and ranges | (a) in units of 60, unchanged in drawing units; (b) in the diagram's squares -- after a growth to 120 a tower reaches twice as far over devices that stayed where they were | (a): a size change moves each device to its nearest point, not by scaling, so the distances between devices stay within half a square of what they were; speeds and ranges kept in drawing units keep every run's timing and every tower's reach |
| PZ20 | Which sizes a diagram may take | (a) even sizes alone; (b) `snap-grid` accepting half-integer origins -- its D1 integer arithmetic reopened; (c) the zone lattice at `floor(pitch / 2)` -- not "always in-between" (Q2) | (a): every odd size from 1 to 200 is refused for the zone lattice, every even one opens (`odd-size.mjs`); 60 is even |
| PZ21 (the director's) | The range of sizes | (a) 40 to 240; (b) 60 and up -- growth alone; (c) any even size | (a): a zone's line lies half a square from a device's centre, and a device's rungs reach 20 (its frame), 23 (its selection box), 26 (a group's hull) and 29 (a zone's rung) from its centre (`kernel/spec.mjs:5`, `:11-13`), so below 58 the line crosses the zone's rung, below 52 a group's hull, below 46 the selection box, and below 40 neighbouring devices' frames overlap; sizes dividing 60 move nothing (PZ1); to be shown on a stored diagram in the walkthrough |
| PZ22 | The view's form in `vector-scene` (B419) | (a) a transform the scene writes on every layer's element, with `visible()` in `snap-grid`'s view form and `zoomAbout`; (b) the root's `viewBox`, written by the scene -- the root no longer the application's (VS13); (c) draw writing the root's `viewBox` itself -- no release, against H26-1's duty and AG-5 | (a): every layer's element is the scene's alone (VS4), so the pipes and the movers follow with no change to their drawers (D6); the conversions already follow whatever transform the platform reports, measured exact for a panned and a zoomed `viewBox` (`fit-and-view.mjs`) |
| PZ23 | Where a view is remembered (Q5) | (a) `localStorage`, `draw:view:<diagram id>`, `{ v, x, y, scale }`; (b) `sessionStorage` -- lost when the tab closes; (c) the address's fragment -- shareable, against AG-1 | (a): Q5's "remembered per diagram" in each viewer's browser |
| PZ24 | The grid drawn under a view, and B415 | (a) each grid drawn from `visible()` by `inView` with a least spacing of 24 pixels, again when the view moves, at most once a frame; drawing a grid stays draw's; (b) the old extent's dots kept -- an edge again; (c) a shared grid-drawing piece -- no second application draws a grid (the tester's view pane is the first, PZ30) | (a), with B415 restated: the tester's pane makes the second drawer, so its trigger fires when that pane is built; `dots-in-view.mjs` |
| PZ25 | The ground, the mode's edge and the crosshair | (a) the root's own fill as ground, the mode an inset outline at the screen's edge, the crosshair across `visible()`; (b) a ground rect sized to the view on every move; (c) the mode cue dropped | (a): the edge stroke is the one place the mode shows on the canvas today (`app/canvas.css:15`, `:17`) |
| PZ26 | The occupancy index under a diagram's grid | (a) keyed by the diagram's device lattice, built again on a load and a size change; (b) keyed by coordinates -- every query from a pointer snapped first by its caller | (a): queries ask arbitrary points (`app/src/compose-canvas.js:70`); a size change moves every anchor anyway |
| PZ27 (the director's) | Space: the datum, and panning while held | (a) the datum set on Space's key-up when no pan ran while it was held, a pan when the left button drags while it is; (b) the datum on key-down as today, a pan setting it first; (c) no Space pan -- the intent's Q4 pick narrowed | (a): Space sets the datum on its press today (`app/src/keymap.js:92`), the one gesture of the intent that meets a key already bound |
| PZ28 | The view's keys | (a) `=` or `+` and `-` to zoom, `Shift+0` actual size, `Shift+1` fit, `h` home; (b) the browser's own `Ctrl+=`, `Ctrl+-`, `Ctrl+0` claimed -- the page's own zoom taken | (a): each is free in draw's tables, the digits 1 to 6 bound alone, and the pairs follow the design tools the intent's Q4 named; shown in the tester |
| PZ29 | Where a person changes the size | (a) a field in the header's menu and through every door -- the agent door's commit and the CLI; (b) the agent door and the CLI alone | (a): A5, a person and an agent perceive and act alike |
| PZ30 | The tester's step | (a) a view pane, every gesture's verdict, its non-goal amended (3.3); (b) the verdicts alone, no pane -- the component's view never run on the Chromebook before draw | (a): H26-22 orders the tester to show each gesture working on the director's device before draw has any |
| PZ31 | How far from the origin a coordinate may be | (a) a magnitude of at most 1,000,000 drawing units; (b) 2^49, the nearest route's limit -- beyond what a browser draws exactly; (c) none -- refused only by `snap-grid`'s domain, 2^50 | (a), its number to be fixed by measurement in the tester: a single-precision value holds a coordinate within 2^20 to a sixteenth of a unit and one near 2^24 to a whole unit, and whether Chrome loses precision drawing an SVG transform so far out is not yet measured |

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
