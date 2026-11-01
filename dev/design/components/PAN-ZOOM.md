# H26.6 -- pan and zoom: an infinite canvas, one grid per diagram, each viewer's own view

The design of record for H26.6, from the director's intent captured in `PAN-ZOOM-INTENT.md` and ruled as `H26-22`.\
Draw's canvas loses its edges: one grid per diagram, 60 by default and changeable, devices at its square centres and zones on its lines; a viewer pans and zooms with the touchpad and mouse gestures the intent names, and each viewer's view is remembered per diagram in their browser, with a reticle button home to 0,0.\
It overturns decision 1's fixed canvas and WD7's refusal of other grid values once ratified, and meets B289 and B325; it is built component first, as H26-3 ordered and H26-22 confirms, on the four components draw runs on -- `input-binding`, `input-capture` and `vector-scene` `0.2.0`, `snap-grid` `0.1.0` -- and the gesture tester.

**Standing:** revision 1, complete, drafted, not ratified, awaiting its readings and the director's walkthrough; drafted in three parts, every section written but section 8, which records the readings as they are made; the code read is `1fbbc5b`; code lines measured by `tools/code-split.mjs` and its `codeLines`, browser behaviour in headless Chrome through `@apnex/headless-chromium` on draw's lab page, the scripts and their outputs at `~/taceng/drawv2-eval-runs/h26-pan-zoom/probes/`.

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

### 5.1 The order, each move's guard, and who verifies it

H26-3's order as H26-22 confirms: the component releases, the tester on the director's Chromebook, then draw, per-diagram grid size its own step, last.\
Each move is sized for one agent task of about 45 minutes, built by an agent that did not draft this design; *verifier* marks a move whose change a person or an agent could notice, passed by an independent verifier as H26-15 as amended rules, each component release reviewed once in full as H25-3's correctness first holds; *gate* marks one whose guard holds every record byte for byte, passed by the builder's gate alone.\
Draw's guards name its records: the native record (`tests/fixtures/native-record.mjs`, its comparator under the pipes move's allowances), the export's bytes over the 18 stored and seeded documents and the 19 pinned production documents (`tests/svgexport.test.js`, `tools/probe/parity.mjs`), the gesture corpus (`tests/fixtures/gesture-corpus.json`), and the pixel probe against production.

| # | Move | What it does | Its guard | Deletes | Behaviour changes, and nothing else | Checked by |
|---|---|---|---|---|---|---|
| 1 | `vector-scene` 0.3.0: the view, contract and implementation | 3.2's view -- `view: true`, `setView`, `view`, `visible`, `zoomAbout`, the transform on every layer, the conversions composing it, `getBoundingClientRect` in VS1 -- with its Node tests on a recording root | every invariant of `0.2.0` passes unchanged for a scene declared without a view; the new invariants for a viewed scene | -- | a new capability; none for a scene without a view | verifier |
| 2 | `vector-scene` 0.3.0: in Chrome, and released | the browser invariants: a viewed scene's layers, scene and foreign, carry the transform; `toDrawing` and `toScreen` equal `DOMPoint` over the root's transform and the view at thousands of points; `itemAt` and `itemOf` answer through a panned and zoomed view; `visible()` equals the box's corners converted; then the release by its CI | its gate, its consumer test, and the built files a release of its own CI | -- | -- | verifier |
| 3 | `input-binding` 0.3.0: a threshold on screen | the declaration's `measure`, the session reading `screen` with it; tests, the consumer test, the release | every invariant of `0.2.0` passes unchanged for a declaration without `measure` | -- | none for a declaration without `measure` | verifier |
| 4 | `snap-grid` 0.1.2: the build keeps its contract | `inView` freezing each value as made, with no `Set`; an invariant listing 2^24 positions; the release | every invariant of `0.1.1` unchanged; its corpus | the ceiling at 5,592,404 | a listing past 5,592,404 answers where it threw | verifier |
| 5 | the tester: the view's rows | its table gains 3.6's rows and its session the three drag gestures measured on screen (`input-binding` 0.3.0); each verdict shown; its architecture's non-goal amended by a decision of its own record (PZ30) | its gate: trusted input in headless Chrome over every binding row, no input matching two rows | -- | the tester shows the view's verdicts | verifier |
| 6 | the tester: the view pane, and the director's acceptance | the pane, a second scene on its own `svg` with a view (`vector-scene` 0.3.0): the grid drawn from `visible()` and thinned to 24 pixels, panned and zoomed by every gesture, its centre and scale shown, a reticle home; a line drawn at 2^20 and at 2^24 from the origin, measured, fixing PZ31's number; deployed to the tester's own address | its gate; then the director's acceptance on the Chromebook of each gesture -- two-finger scroll, pinch, Ctrl and the wheel, Space and drag, middle drag, right drag on open ground, the keys, the reticle | -- | the tester's view pane | verifier, then the director |
| 7 | draw: the canvas viewed | the four pins raised; the canvas's scene opened with a view at the first opening's scale (PZ7); the `view` part declared, holding the view and setting it again on a resize; the root bare -- no `viewBox`, no ground rect -- the ground its fill, the mode an inset outline (PZ25); the label editor's font from the view's scale; a palette drop on any point of the canvas | the native record and the export's bytes unchanged; the gesture corpus byte-identical; the pixel probe differs only beyond the old 1920 by 1080 frame and at the mode's outline | `CANVAS_VIEWBOX`, the generated ground rect in `app/index.html` and `lab/index.html`, the palette's frame test (`app/src/palette.js:146-148`), the label editor's read of the root's scale (`app/src/labeledit.js:145`) | the canvas fills the stage, its ground where the letterbox was; the mode shown as an outline at the screen's edge | verifier |
| 8 | draw: the grids and the crosshair from the view | each grid drawn from `visible()` by `inView`, a least spacing of 24 pixels, again at most once a frame when the view moves (PZ24); the crosshair across `visible()` | as move 7, the native record's crosshair line ends the one difference allowed | every lattice point listed within an extent (`plugins/layouts/layout-canvas.mjs:30-37`); the grids' draw at load alone | dots across the whole canvas; the crosshair across it | verifier |
| 9 | draw: the gestures as rows | `wheel` listed beside `blur`; `viewRules` before the press table in every mode, its rows and the `pan` gesture of 3.6; the session measured on screen, 4 pixels (PZ17), the palette's threshold with it | the gesture corpus byte-identical, its harness converting at a scale of one (`tests/fixtures/client-harness.mjs:168`); `right-button.mjs` as a test: on open ground the middle and right buttons match the pan rows alone, every other button and kind as today | the threshold in drawing units (`app/src/input.js:61`) | pan and zoom by every gesture of the intent, in every mode, run mode among them, which takes no other gesture; a press travels 4 screen pixels before it is a drag | verifier |
| 10 | draw: the keys, the remembered view and the way home | the zoom keys and `h` (PZ28); Space's datum on its key-up when no pan ran (PZ27); the view remembered in `localStorage` through a store the page hands the `view` part (PZ23); the reticle button (PZ6) | the gesture corpus but its Space scenario, its new record named; a view never in a commit | the datum on Space's press (`app/src/keymap.js:92`) | the keys; the datum on Space's release; each viewer's view kept per diagram; the button home to 0,0 | verifier |
| 11 | draw: the extents gone | validation without an extent -- an anchor on the device lattice within PZ31's bound, a zone on the zone lattice in whole squares; snapping on the unbounded lattices; `clampDelta` without bounds; the zone's and the device's steps without an edge; the caps as the numbers 527 and 576 (PZ8) | the native record, the export's bytes and the gesture corpus unchanged; every stored document still accepted | `model/surface.mjs`; `NODE_EXT` and `ZONE_EXT`; `nodeGridWithin` and `positionsWithin`; the bound checks, the clamps' bounds and the edge steps of section 2.1's E5 and E6 | anything may be placed, moved or resized beyond the old frame | verifier |
| 12 | draw: the lists, placement, the CLI's grid and the index | the anchors route by area (PZ9); placement's nearest free point by rings; the CLI's zone cells from the stored `pitch` (PZ15, B402) and its `map` and `anchor free` over the used bounds and a margin; the occupancy index keyed by the device lattice the composition hands (PZ26) | the agent door's answers for an area holding the old frame equal today's list; the CLI's tests; the native record unchanged | the bounded grids (`server/rest.js:137-139`); the extent's listing in placement (`server/anchor.mjs:62-70`); the CLI's literals (`cli/verbs.mjs:2096`, `:2264-2267`) | an anchors request without an area is refused, naming its parameters | verifier |
| 13 | draw: the pitch read as the grid or as the unit | every reader of the pitch classified (PZ18, PZ19): a reader asking where a position lies takes the diagram's lattices through the composition; a device's size, the export's span bounds and the simulation's speeds and ranges read `STD.pitch`, 60 | every record byte for byte -- the native record, the export, the gesture corpus, the pixel probe -- since every diagram is still 60 | `GAP` and `NODE_GRID` read as the grid | none | gate |
| 14 | draw: one stored grid | the `layout` row of one entity, `pitch` even (PZ20) and in range (PZ21); the second record and WD7's refusal gone; schema 4; the migration, rehearsed on a copy of production, run once in a freeze (WD9's form); the four templates migrated; `GET .../layouts` answering the one record | every pinned production document and template migrates to the one record and nothing else in it changes; the native record and the export's bytes unchanged | `plugins/layouts/layout-table.mjs`; the second layout; WD7's refusal (`plugins/layouts/layout-kind.mjs:37-42`); schema 3's reading | the agents' `layouts` answer is one record; stored documents are schema 4 | verifier |
| 15 | draw: a size change | the layouts plugin's planner reaction (3.5; PZ1 to PZ4); the header's grid field (PZ29); the CLI's `grid` verb; the agent door's commit of a size | 60 to 60 changes nothing; for each pinned production document and stored board at 40, 80 and 120, the result equals `size-change.mjs`'s, one commit and one undo, the agent door's ops the browser's | -- | a diagram's grid size can be changed, its devices moved to their nearest points and its zones to the lines | verifier |

### 5.2 The live lab and production

Each move of draw's goes to the live lab first, as H26-14 as amended rules, and to production in batches with one approval each:
- **batch 1, the infinite canvas at 60**: moves 7 to 12, released together, so production never holds a canvas that pans past an edge it still refuses;
- **batch 2, per-diagram grid size**: moves 13 to 15, with move 14's freeze and migration, its own step as H26-22 orders.

Draw's first move starts only when the director has accepted every gesture on the Chromebook in the tester (move 6); a gesture the director does not accept goes back to the tester, or to a component's release, before draw takes it.

---

## 6. Before and after, by part

The declarative share is the code lines of top-level tables over all code lines; logic is the rest (`node tools/code-split.mjs --parts`).\
Before: measured at `a4a90b3`, no product file changed since H26.11 went live at `ac0dda2`, beside H26.8's close in `dev/CODE-SPLIT.md`; after: estimates from section 2's measured ranges deleted or rewritten and each addition estimated, `=` unchanged.

| Part | Lines | Share | After (est.) | Basis |
|---|---:|---:|---:|---|
| `lattice` | 169 | 13.6% | 152 | `positionsWithin` (14) and `nodeGridWithin` (1) go with `model/surface.mjs` (2); `latticeGrids` answers the two lattices in as many lines |
| `layouts` | 68 | 54.4% | 90 | the table (10) goes; the row of one entity, 35 to about 22; the records, 11 to about 6; the size change's reaction, about 50 |
| `devices` | 531 | 53.1% | 525 | a span's edge check (4) and the span step's edge (2) go |
| `zones` | 162 | 65.4% | 155 | the extent checks and their sentence (6) and the size step's clamp (1) go |
| `product` | 73 | 35.6% | 72 | `CANVAS_VIEWBOX` goes; the caps written as numbers in as many lines |
| `canvas` | 1,832 | 8.1% | 1,871 | the view's rows (about 12, declared), the `pan` gesture (15), the wheel's entry (10), Space's datum on its release (6), the keys (5, declared), the wheel listed (3) added; the clamp's bounds (8), the palette's frame test (3), the surface's alias and a place's bounded check (3) go |
| `view` (new) | -- | -- | 90 | the view, its clamp and setting (20), pan and zoom (15), home, fit and actual size (25), the store (15), a resize (5), its wiring (10) |
| `grids` | 19 | 0.0% | 27 | drawn from the visible view, at most once a frame |
| `editing`, `renderer` | 683 | -- | 687 | the crosshair from `visible()`; the scene opened with a view |
| `label-editor` | 141 | 0.0% | = | the view's scale read in the line that read the root's |
| `product-page`, `lab` | 736 | -- | 754 | the reticle button, the store over `localStorage` and the resize hook |
| `rest`, `placement` | 736 | -- | 739 | the anchors by area; placement's rings for the extent's listing |
| `cli` | 2,177 | 8.0% | 2,206 | the zone cells from `pitch` (4), `map` and `anchor free` over an area (5), the `grid` verb (20) |
| `export`, `simulation`, `network`, `planner` and every other part | 6,652 | -- | = | untouched: the export's frame never read an extent, the simulation keeps its unit (PZ19), the reaction is the layouts plugin's tenant |
| **draw, running** | **13,979** | **12.5%** | **about 14,160** | |

**The headline, an estimate:** draw about 180 lines larger, 1.3%, its declarative share flat at 12.5%; a feature of new behaviour -- a view, its gestures, a size change -- where H26.8 retired translation, so the measure moves the other way.\
The 274 lines that hold an extent today (section 2.1) are mostly rewritten in place, not deleted: what goes is the extent itself -- three constants, the layout table, two listing functions, every edge check and clamp bound -- about 80 lines, against about 260 added.\
Outside draw's count, the components grow by their releases -- `vector-scene`'s view the largest, about 120 lines, `input-binding`'s `measure` about 15, `snap-grid`'s freeze a few -- and the tester by its pane, each measured in its own repository at its move.

What the density measure will not show:
- the extents' reach, gone: `NODE_EXT` on 20 lines in 7 files, `ZONE_EXT` on 13 in 4 and `LAYOUT_TABLE` on 15 in 5 read the edge today through a name, and each is a line rewritten, not removed (section 2.1);
- whether a boundary holds -- the view the scene's, the grid `snap-grid`'s, a device's unit its own -- which the scanners and GR1 to GR15 check, not a line count;
- behaviour, which the records and the director's acceptance hold.

---

## 7. Axiom alignment audit (M7)

**Identity:** H26.6 at revision 1, `PAN-ZOOM.md`, read against draw at `1fbbc5b`, the intent record and `H26-22`, the four components' released contracts at the versions draw pins, the tester's architecture target, and mission-kit at `15f265f`; draw's traits, the axioms' bindings: stateful (A1), declarative in its manifests and declarations (A2), multi-agent through its agent door and its builders (A5, A6, A7), any system (A3, A4, A8, A9, A14).

**Verdict:** `pass, with guardrails`, by its author, GR1 to GR15 below; to be confirmed by the readings H26-15 as amended asks, recorded in section 8.

| Axiom | Weight | How the design stands |
|---|---|---|
| `A3` | load-bearing | the view is `vector-scene`'s, written on the layer elements it alone owns (VS4), its visible area in `snap-grid`'s own view form, so draw composes the two natively; the grid's arithmetic stays `snap-grid`'s; a screen-measured threshold is `input-binding`'s; each component consumed by its one part, the new `view` part one duty behind its boundary; no surface added without a consumer -- `snap-grid`'s count withheld (PZ13), culling deferred (PZ11) |
| `A13` | load-bearing | the director's four added constraints carried in their words where they bind (Q2, Q3, Q5, the right-button pan); seven decisions marked the director's, each with options and a recommendation, none narrowed; the gestures proven on the director's own device before draw depends on them |
| `A2` | load-bearing | one stored grid, the zone lattice derived and never stored (GR7), so the stored and the drawn grid are one declaration; WD7's two records of one fact retired |
| `A8` | load-bearing | components released and verified first, the tester accepted on the Chromebook, then draw, each move with a guard, the size change last in its own batch; the records held byte for byte where nothing is meant to change |
| `A1` | supporting | the document stays the one truth, schema 4 its one form; the view is a viewer's presentation, held in their browser and never system truth (tension below) |
| `A5` | supporting | a person and an agent read the same document and change the grid through the same edit, the planner computing it once (PZ4); what a viewer looks at is theirs alone (AG-1, tension below) |
| `A7` | supporting | refusals that act -- an anchors request over its bound names its count, a size change's notice names each anchor moved to a free point and each zone whose anchors changed; an unreadable remembered view is ignored, never fatal |
| `A4` | supporting | every figure from a kept probe; each finding the drafting made -- the pitch's double role, `snap-grid`'s ceiling, odd sizes, the Space datum -- a decision with its evidence |
| `A14` | supporting | the defects found on the way registered as work: `snap-grid`'s build against its contract fixed by its own release (move 4); the held rows the design meets given their dispositions (deltas below) |
| `A9` | supporting | each draw move in the live lab before production; the migration rehearsed on a copy of production before its freeze; no chaos testing beyond these, the design changing no failure path |
| `A6`, `A10`, `A11`, `A12` | not materially implicated | no coordination substrate, self-correction loop or model invocation is changed |

**Layered application:**
- *Intent:* the picks, the constraints and the anti-goals carried whole; no anti-goal designed in (GR5, GR6).
- *State and truth:* one stored grid per diagram; the view outside the document (GR5).
- *Specification:* one declaration per grid; the device's unit fixed and named apart from the grid (GR4).
- *Composition:* three component releases, each additive and invisible to a consumer that does not ask (moves 1 to 4); draw's new part declared.
- *Perception:* agents' reads unchanged but the lists by area; the grid's size readable at `GET .../layouts`.
- *Integrity:* component, tester, director, draw; batch 1 then batch 2.
- *Director attention:* seven decisions the director's, the rest the architect's to settle at ratification.

**Tensions, and how they resolve:**
- A1 against a view held in a browser: the view is no system truth -- nothing reads it but the viewer's own page, and losing it costs a return home -- as the mode and label toggles are session state today; AG-1 rules it out of the document.
- A5 against a view each viewer holds: the bound is the document, identical for every actor; where a person looks is excluded by AG-1, and nothing an agent decides depends on it.
- A3 against unloading out of view: the scene could own it, but no measured board needs it at the caps kept (PZ8, PZ11); B289 stays held with a measured trigger.
- Q3's "nearest point" against collisions: two devices cannot share a point (B112), so the later moves to the nearest free one (PZ3), which the director rules.
- H26-16's density aim against a feature: draw grows about 1.3% (section 6); the aims of clean boundaries hold -- every extent gone, the view and the grid each in its component.
- A8 against intermediate states: moves 7 to 10 show an infinite canvas while move 11's extents still bound editing; they live in the lab alone, production taking batch 1 whole.

**Deltas:** the moves (section 5); thirty-one decisions (section 4); held rows given their dispositions at ratification, by the recorder -- B419 closed by moves 1 and 2, B404 by moves 3 and 9, B402 by move 12, B325 by moves 14 and 15, B415's trigger met by move 6 and the row restated, B289, B418 and B435 held with the triggers PZ11, PZ16 and PZ10 state; new rows -- the caps raised (PZ8), an odd size (PZ20), a culled board (PZ11).

**Guardrails for the build:**
- GR1: draw writes no attribute on a layer's element; the view is written by the scene alone (a source check over the canvas, renderer and view parts).
- GR2: no grid is listed whole: every `inView` call in draw holds a region from `visible()` or an asked area and a `max` of at most 10,000, and `positionsWithin` and `nodeGridWithin` are gone (a source check).
- GR3: no extent remains: `SURFACE`, `NODE_EXT`, `ZONE_EXT`, `CANVAS_VIEWBOX` and `LAYOUT_TABLE` are named nowhere in product code (a source check).
- GR4: a device's size never reads the diagram's grid: at a grid of 40 a 3 by 2 panel draws the frame it draws at 60, and its sockets, content cells and export bounds with it (a test).
- GR5: the view is never in a document, a commit or a request: the `view` part imports no commit, sync or store module, and only `app/src/main.js` touches `localStorage` (a source check and a test).
- GR6: the wheel never zooms without Ctrl, and a left drag on open ground stays the selection box (AG-2; tests through the capture).
- GR7: the zone lattice's origin is half the stored pitch, never stored: a layout record carrying any field but `id`, `name` and `pitch` is refused (a test).
- GR8: a size change is one commit and one undo, computed by the planner: the agent door's ops for a request equal the browser's (a test).
- GR9: no row of today's on open ground is taken: `right-button.mjs` as a test, before and after move 9.
- GR10: each component is consumed by its one part (`tools/scan-layers.mjs` L12, as today), the `view` part handed the scene as a value.
- GR11: the export's bytes unchanged at every move over the 18 stored and seeded documents and the 19 pinned production documents.
- GR12: the native record holds at every draw move, its one allowed difference the crosshair's line ends from move 8.
- GR13: the migration exact: every pinned production document and template migrates to `{ id: 'layout-000001', name: 'grid', pitch: 60 }` with no other byte changed, rehearsed on a copy before the freeze.
- GR14: `node tools/code-split.mjs --parts` measured at each draw move and at the close, recorded in `dev/CODE-SPLIT.md`.
- GR15: draw takes no gesture the director has not accepted on the Chromebook in the tester.

**Closeout:** H26.6 closes when batch 2 is in production on the director's approval, each move's verifier has passed it against appendix A, `dev/CODE-SPLIT.md` holds the closing table, decision 1 and WD7 are recorded as overturned, and every held row above has its disposition.

---

## 8. Reviews

To come: each reading recorded as it is made, its findings tiered as H26-15 as amended rules.

---

## Appendix A -- the build checklist

The one place a builder reads: each row the builder satisfies and the move's independent verifier checks, beside the move's guard (5.1) and the gate; a move marked *gate* in 5.1 is checked by its builder's gate against these rows.

| Move | The builder | The verifier checks |
|---|---|---|
| 1 | in `vector-scene`'s repository: its contract gains 3.2's view as numbered rules -- the declaration's optional `view`, `setView`, `view`, `visible`, `zoomAbout`, the transform written on every layer's element, the conversions composing it, `getBoundingClientRect` added to VS1 -- and its decision record the minor release, as `RELEASES-0.2.md` grew `0.2.0` | every rule of `0.2.0` read unchanged for a scene without `view`; the vocabulary check passes, no word of draw's in the source |
| 1 | the implementation and its Node tests on a recording root: the transform's string, the conversions over a view, `visible()` against the root's box, `zoomAbout` keeping the point under the screen point, every refusal -- a non-finite member, a scale at or below 0, a view on a scene declared without one | each new rule has a test that fails on its mutant; the recording root logs no read but VS1's |
| 2 | the browser invariants in Chrome, on `headless-chromium`: a viewed scene's scene and foreign layers carry the transform; the conversions equal `DOMPoint` over the root's transform and the view at thousands of points; `itemAt` and `itemOf` through a panned and a zoomed view; `visible()` equal to the box's corners converted; the consumer test | the tests run in Chrome and fail on a planted fault in the transform |
| 2 | the release by the repository's CI, its built files attached to its release | the release's files are its CI's, its version `0.3.0`, its contract the one tested |
| 3 | in `input-binding`'s repository: the declaration's `measure`, `'at'` by default or `'screen'`; IB1 reads `screen` where a session measures it; its decision record; tests over both measures, the consumer test, the release by its CI | every rule of `0.2.0` read unchanged for a declaration without `measure`; a press's travel measured on `screen` decides click and drop exactly; the release is its CI's |
| 4 | in `snap-grid`'s repository: `inView` freezing each value as it makes it, with no `Set`; an invariant listing 2^24 positions in one answer; the release `0.1.2` by its CI | the corpus and every invariant of `0.1.1` unchanged; `grid-listing.mjs` run against the new build lists past 5,592,404 |
| 5 | in the tester's repository: a decision of its own record amending "pan and zoom of the picture" (PZ30); its table gains 3.6's rows, its session the three `pan` gestures, `measure: 'screen'`, threshold 4; each verdict shown in its words | its gate's trusted input drives every new row in headless Chrome; no input matches two rows over its stated space; the pins are the released files |
| 6 | the view pane: a second scene on an `svg` of its own declared with a view; the grid drawn from `visible()` by `inView`, a least spacing of 24 pixels; its centre and scale shown; the reticle home to 0,0; a line drawn at 2^20 and at 2^24 from the origin and its pixels measured, the measure recorded for PZ31; deployed to the tester's address | the pane pans and zooms by every gesture under trusted input; the keyboard picture never moves; the precision measure is recorded with its numbers |
| 6 | the director's walkthrough on the Chromebook: each gesture tried and accepted or returned | each gesture's acceptance recorded before move 7 starts (GR15) |
| 7 | draw's pins raised to `vector-scene` 0.3.0, `input-binding` 0.3.0 and `snap-grid` 0.1.2, `input-capture` staying at 0.2.0, the import map generated; the canvas's scene declared with `view: true` (`product/canvas.mjs`) | the gate's import-map and pin checks pass |
| 7 | `view.js`, new in `app/src/`, the `view` part declared in `tools/layers.mjs` with `by` citing H26-22, which `docs/ARCHITECTURE-TARGET.md` section 2 cites first; the first opening at the old frame's fit (PZ7); a resize setting the view again | the part's imports are its declared consumes (`tools/generate-architecture.mjs`); the first opening's scale equals today's fit at three window sizes, measured as `fit-and-view.mjs` measures |
| 7 | the root bare: `tools/canvas-layout.mjs` writes `#container` with no `viewBox` and no ground rect, `app/index.html` and `lab/index.html` regenerated; the ground the root's fill in `app/canvas.css`; the mode's inset outline in place of the ground's stroke (`app/canvas.css:15`, `:17`) | the pixel probe against production differs only beyond the old frame and at the outline, each difference shown |
| 7 | the label editor's font from the view's scale (`app/src/labeledit.js:145`); a palette drop on any point of the canvas, `inCanvas` gone (`app/src/palette.js:146-148`) | the label editor's placement test in Chrome at two zooms; a drop beyond the old frame lands |
| 8 | the grids part handed the scene's view: each grid drawn from `visible()` by `inView` with `minSpacing` 24 and a `max` of 10,000, again at most once a frame when the view moves; the crosshair across `visible()` (`app/src/editing-visuals.js:23-39`) | `dots-in-view.mjs`'s counts reproduced from the page at four scales; the native record's crosshair line ends its one difference (GR12) |
| 9 | `wheel` listed beside `blur` (`app/src/capture.js:89`); `viewRules` in `input-binding`'s form, asked before the press table in every mode, run mode included; the `pan` gesture declared with buttons 0, 1 and 2; the session opened with `measure: 'screen'`, threshold 4; the palette's threshold in screen pixels | the gesture corpus byte-identical -- the harness's root answers an identity transform (`tests/fixtures/client-harness.mjs:168`), so screen and drawing points agree there; `right-button.mjs` as a test (GR9); wheel facts without Ctrl never zoom (GR6) |
| 10 | the zoom keys and `h` as rows of the key table (PZ28); Space's datum on its key-up when no pan ran while it was held (PZ27); the store over `localStorage` made in `app/src/main.js` and handed to the `view` part, the key and value of 3.7, written half a second after the view last moved and when the page hides; the reticle button in `#stage` of `app/index.html` and `lab/index.html` | the corpus's Space scenario re-recorded and its difference named; a stored view absent, malformed or out of range is ignored; no commit carries a view (GR5); the button and `h` bring 0,0 to the centre with the zoom kept |
| 11 | validation without an extent: an anchor's `x` and `y` on the device lattice within PZ31's bound (`product/kinds.mjs:91-92`), a zone's corner on the zone lattice and its sides whole squares (`plugins/zones/zone-kind.mjs:48-51`), its edge sentence gone (`:59-60`), a span's edge check gone and its content check kept (`plugins/devices/device-fields.mjs:69-79`); the caps the numbers 527 and 576 | every stored and pinned document still accepted; `tests/svgexport.test.js` and the native record unchanged |
| 11 | snapping on the unbounded lattices (`app/src/snap.js:35-39`); `clampDelta` quantising without bounds (`:73-88`); a place's unbounded grid accepted (`:129`); the zone's and the device's steps without an edge; `model/surface.mjs`, `nodeGridWithin` and `positionsWithin` deleted | GR3 and GR2's source checks; a device dragged and a zone resized past the old frame in the lab |
| 12 | the anchors route by area (`server/rest.js:681-692`), `x0`, `y0`, `x1`, `y1` required, at most 10,000 positions, refused past that naming the count; placement's nearest free point by rings (`server/anchor.mjs:62-70`) | an area holding the old frame answers today's list exactly; `tests/layouts-api.test.js`, `tests/server.test.js`, `tests/bare-anchor.test.js` and `tests/devices-plugin.test.js` restated where they read the whole list; placement on a full ring moves outward |
| 12 | the CLI: a zone's cells from the stored `pitch` (`cli/verbs.mjs:2096`, `:2264-2267`), `map` and `anchor free` over the used bounds and a margin unless an area is given, `add` taking any cell; the occupancy index handed the device lattice by the composition (`app/src/compose-canvas.js:70`) | B402's literals gone; the CLI's tests pass at 60; `tests/cli-tool.test.js` restated where it read the whole list |
| 13 | each reader of the pitch classified and rewired: as the grid -- `GAP`, snapping, the nudge, the readout's cells, the zone's keys, the crosshair's box, field validation, the occupancy index -- from the diagram's lattices; as the unit -- `plugins/devices/device-appearance.mjs:34`, `plugins/devices/device-types.mjs:161`, `plugins/devices/device-footprint.mjs:20`, `plugins/devices/device-gestures.mjs:27`, `server/svg.mjs:101`, `plugins/simulation/movers.mjs:77`, `plugins/simulation/rules.mjs:69` -- from `STD.pitch` | every record byte for byte; the gate alone (5.1) |
| 14 | the `layout` row of one entity, `{ id, name: 'grid', pitch }`, `pitch` even and within 40 to 240, any other field refused (GR7); WD7's refusal and the second record gone; `latticeGrids` opening the device lattice at 0 and the zone lattice at `pitch / 2`; schema 4 in `model/shape.mjs`; `GET .../layouts` answering the one record | GR7's test; the agent door's `layouts` answer in its new form; `stored-grids.mjs` against the migrated copies |
| 14 | the migration, schema 3 to 4, run once in a freeze as WD9 ran schema 3's, rehearsed first on a read-only copy of production; the four templates migrated in the tree; the deployed version reading schema 4 alone | GR13: every pinned production document and template migrated, no other byte changed; the rehearsal's record kept with the move |
| 15 | the layouts plugin's planner reaction (3.5): anchors to the nearest point, a collision's later anchor to the nearest free one, zones' corners to the zone lattice, every size kept, one commit; its notice; the header's grid field; the CLI's `grid` verb; the agent door's commit of a size | GR8: one commit and one undo, the agent door's ops the browser's; at 40, 80 and 120 each pinned production document and stored board equal to `size-change.mjs`'s figures; GR4 at 40 |
| each | `dev/CODE-SPLIT.md`'s row for the move (GR14); `docs/ARCHITECTURE.md` and `docs/ARCHITECTURE-TARGET.md` regenerated; the move in the live lab before its batch goes to production | the gate passes; the lab shows the move |
