---
survey-title: H26.6 pan and zoom -- what the director wants before the design is drafted
work-item: H26.6
methodology-source: mission-kit K5 survey (two rounds of three pick-list questions), run one question at a time with a recommendation each, as the director asked
lifecycle-handoff:
  from: intent-open
  to: intent-captured
  authority-ref: dev/DECISIONS.md H26-22 (the director's six answers, 2026-11-01)
  planning-input-ref: self
stakeholder-picks:
  round-1:
    Q1: a
    Q1-rationale: "Yes. Continue. Can we discuss specifics of the design before we build?"
    Q2: a
    Q2-rationale: "Agree with your recommendation. Zone grid is always in-between the node grid"
    Q3: a
    Q3-rationale: "default 60. can be changed per diagram. scalaing a grid has no impact on individual node sizes (they just move to nearest point)"
  round-2:
    Q4: a
    Q4-rationale: "Agreed. also- right-click on an empty space and drag moves the camera."
    Q5: a
    Q5-rationale: "remembered per diagram. multiple users can look at different parts (views) of the same diagram. we need a small button (a aiming reticle icon perhaps?) that moves the camera back to cell 0,0 (the current middle point of our diagrams)"
    Q6: a
    Q6-rationale: "Yes modular component first. Then we validate in live lab."
classification: feature
outcome-axis:
  primary: [sovereign components, the director's own working experience]
  secondary: [correctness first, agents perceive what people do, density by part]
  round-1:
    primary: [sovereign components, correctness first]
    secondary: [density by part]
  round-2:
    primary: [the director's own working experience, sovereign components]
    secondary: [agents perceive what people do]
axiom-principle-anchors:
  primary: [A3 sovereign composition, A13 director intent amplification]
  secondary: [A2 isomorphic specification, A5 perceptual parity, A8 gated recursive integrity]
  round-1: [A3 sovereign composition, A2 isomorphic specification]
  round-2: [A13 director intent amplification, A8 gated recursive integrity]
anti-goals-count: 5
flags-count: 15
calibration-data:
  stakeholder-time-cost-minutes: 10
  comparison-baseline: H26.8's start (H26-16), one pick among three next items with the aims named in free text
  notes: asked one question at a time with a recommendation each, at the director's request; every pick was the recommendation, and four of the six answers added a constraint no option named -- the zone grid always between the device grid's points, a default of 60 with devices moving to their nearest point, a right-button drag that pans, and a reticle button home to 0,0 -- so the free text carried more new intent than the picks
---

# H26.6 pan and zoom -- intent record

**Methodology:** mission-kit K5, the survey: six pick-list questions in two rounds of three, asked one at a time with a recommendation each, as the director asked.\
**Work item:** H26.6, pan and zoom (`dev/BOARD.md`), ruled when reached (H26-3).\
**Classification candidate:** feature.\
**Lifecycle handoff:** `intent-open -> intent-captured` only; this record grants no design, build or delivery, and nothing is built until the design of record is walked through with the director and ratified.

---

## S0 Context

H26-3 put pan and zoom last in H26: in `vector-scene` first, then the gesture tester, then draw.\
The board item says it overturns decision 1 -- a fixed logical canvas of 1920 by 1080, scaled to fit the window, no pan or zoom, made when a diagram had to map one to one onto a fixed page in an external presentation tool -- and fires B289 (unload what is out of view) and B325 (a diagram's own grids), each ruled when reached.\
H26.8 left draw ready for it: every part speaks the components' own shapes, picks are by item, and the native-shapes design notes that under H26.6 a view carries every layer and a culled entity is one removal.\
The feature that decision 1 served is purged (H24.11), so its reason no longer holds.\
Before the survey, H26-21 recorded the director's direction "grid size will be configurable and unified", for this design.

---

## S1 Round 1 picks

| Q | Pick | Intent reading (1-line summary) |
|---|---|---|
| Q1 -- should the canvas have edges? | **a** infinite, no edges | the canvas has no extent; decision 1 is overturned |
| Q2 -- what should "unified" grids mean? | **a** one grid, one size, devices in the squares, zones on the lines | one grid declaration; the zone lattice always half a square from the device lattice |
| Q3 -- who sets the grid size? | **a** each diagram, default 60 | a diagram's square size is its own; a change moves each device to its nearest point and keeps its size |

### S1.Q1 -- Per-question interpretation

The director chose an infinite canvas, the destination named twice before ("when we move to infinite canvas", B289; "when we go after infinite canvas and scrolling", B325), and asked that the design's specifics be discussed before any build.\
So a diagram has no edge: what today is bounded by an extent -- the per-kind caps counted from grid positions, the agents' anchor lists, the export's frame, the grid drawn -- takes a form that needs none, and what is out of view may be unloaded from the page (B289).\
The request to discuss specifics first is the process already in force, made explicit: a design of record, independent readings, then a walkthrough one decision at a time before ratification.

### S1.Q2 -- Per-question interpretation

"Unified" means one grid with one size: devices sit at the centres of its squares and zones snap to its lines, so a zone's edges fall between devices and a zone encloses whole devices, as today.\
The director added that the zone grid is always in between the node grid: the half-square offset is an invariant, never a setting.\
So the two `layout` entities each diagram stores today describe one grid, and a design that lets their sizes or offsets differ is outside this intent.

### S1.Q3 -- Per-question interpretation

Each diagram sets its own square size, 60 by default.\
Changing it keeps every device's own size and moves each device to its nearest point on the new grid -- positions are statements about where a thing is on the grid (VISION.md, "Not a drawing tool"), so a new grid gives each its nearest place rather than scaling the drawing.\
WD7's refusal of any other value, always meant as temporary, is lifted by this intent; how a size change behaves at its edges is the design's to settle (S6).\
AMENDED 2026-11-01, in the design's walkthrough (`PAN-ZOOM.md` section 9): the reading above is corrected by the director, asked whether devices keep their place on the page and snap to the nearest new point, or keep their square while the layout scales.\
The director answered: "Keep their square.\
This was my original intent."\
So a size change keeps every device, zone and waypoint in its square, the diagram growing or shrinking as a whole, each device keeping its own size; flags F1 to F3 below are answered by that, F2 and F3 losing their premise.

**Round-1 composite read:** the canvas is infinite, and one grid per diagram, of a size the diagram chooses, governs both devices and zones; together they remove every extent and every hard-coded size from draw, which is the change B325 and B289 waited on.\
The tension carried to round 2: an infinite canvas with a configurable grid moves what a person sees, how they move through it and where they are, from fixed to per-viewer state.

**Round-1 axiom / principle anchoring:** A3 (sovereign composition) -- the grid's arithmetic stays `snap-grid`'s, one declaration per diagram composed by draw -- and A2 (isomorphic specification) -- the stored grid and the drawn one are the same single declaration, with no second grid to drift from the first.

---

## S2 Round 2 picks

| Q | Pick | Round-1 aggregate relation | Intent reading (1-line summary) |
|---|---|---|---|
| Q4 -- how do you pan and zoom? | **a** touchpad and mouse, design-tool style, plus a right-button drag | deepens | pinch and two-finger scroll first, the selection box kept, a right drag on open ground pans |
| Q5 -- is your view remembered? | **a** per diagram, in each viewer's browser, plus a home button | refines | the view is each viewer's own; a reticle button returns it to 0,0 |
| Q6 -- in what order do we build it? | **a** components first, as ruled | refines | `vector-scene`, then the tester, then draw, each validated in the live lab |

### S2.Q4 -- Per-question interpretation

The director works on a Chromebook touchpad, where Chrome reports a two-finger scroll as wheel events and a pinch as wheel events with Ctrl held.\
The pick keeps both for the touchpad -- two-finger scroll pans, pinch zooms around the pointer -- with the mouse's wheel scrolling and Ctrl+wheel zooming, Space+drag and a middle-button drag panning, and keys for zoom in, zoom out, fit the diagram and actual size; dragging on open ground stays the selection box.\
The director added a right-button press on open ground that moves: it pans the view, which on the Chromebook is a two-finger click held and dragged.\
This deepens round 1: the infinite canvas is reached by the gestures the director already uses, and none of today's gestures is taken.

### S2.Q5 -- Per-question interpretation

The view -- where a viewer looks and how close -- is remembered per diagram in each viewer's browser, so several people on one diagram look at different parts of it, and looking around never edits the diagram.\
The director added a small on-canvas button, a reticle icon, that brings the view back to cell 0,0, the origin and today's centre of every diagram.\
This refines round 1: an infinite canvas needs a way home, and the origin is the one fixed place every diagram shares.

### S2.Q6 -- Per-question interpretation

H26-3's order stands: `vector-scene` gains a view that pans, zooms and tells each layer what is visible (B419); the gesture tester shows each gesture working on the director's Chromebook before draw has any; then draw takes the infinite canvas, the gestures, the remembered view and the home button; per-diagram grid size, which changes stored data, is its own step.\
The director added that each step is validated in the live lab, as H26-14 as amended rules: the lab first, then production with one approval per batch.\
This refines round 1's scope into an order in which the riskiest part -- input on the director's own device -- is proven before draw depends on it.

**Round-2 composite read:** round 2 confirmed round 1 and made it personal: the infinite canvas is moved through with the director's own touchpad gestures and a right-button drag, each viewer keeps their own view with a button home to 0,0, and the work goes component, tester, draw, each step proven live in the lab.

**Round-2 axiom / principle anchoring:** A13 (director intent amplification) -- the director's own device and gestures set the input design, and their four added constraints are carried whole -- and A8 (gated recursive integrity) -- each step is proven in the tester and the live lab before the next builds on it.

---

## S3 Composite intent envelope

Draw's canvas becomes infinite.\
Each diagram has one grid, 60 by default and changeable per diagram, devices at its square centres and zones on its lines, the zone lattice always half a square from the device lattice; a size change keeps every device's size and moves each to its nearest point.\
AMENDED 2026-11-01 (the walkthrough, `PAN-ZOOM.md` section 9): a size change keeps every device in its square, the layout scaling with the grid, as the director clarified, not each device moved to its nearest point.\
A viewer pans with a two-finger scroll, Space+drag, a middle-button drag or a right-button drag on open ground, and zooms with a pinch or Ctrl+wheel around the pointer or by keys; dragging on open ground still draws the selection box.\
Each viewer's view is remembered per diagram in their browser, never stored in the diagram, so viewers look at different parts at once, and a reticle button returns the view to 0,0.\
It is built component first -- `vector-scene`'s view, the gesture tester on the director's Chromebook, then draw, per-diagram grid size its own step -- each validated in the live lab, and nothing is built until the design is walked through with the director and ratified.

**Final axiom / principle anchoring:** A3 leads -- the view is `vector-scene`'s and the grid `snap-grid`'s, each sovereign, draw composing them, so the design adds to the components' contracts before draw uses them; A13 shapes the input and the home button around the director's own device and words; A2 keeps one grid declaration per diagram; A5 asks that what a viewer sees be perceivable by an agent where the design touches it (B418); A8 gates each step on the tester and the lab.

---

## S4 Scope summary

| Axis | Bound |
|---|---|
| Title | H26.6 pan and zoom |
| Classification | feature |
| Location / scope | `vector-scene` (the view), the gesture tester, draw (canvas, input, layouts, export, the REST anchor lists, the caps) |
| Primary outcome | an infinite canvas moved through by touchpad and mouse, each viewer's view remembered, a button home to 0,0 |
| Secondary outcomes | one grid per diagram, 60 by default and changeable; every extent and hard-coded size gone from draw |
| Outcome-axis (primary) | sovereign components, the director's own working experience |
| Outcome-axis (secondary) | correctness first, agents perceive what people do, density by part |
| Outcome-axis (Round-1) | primary: sovereign components, correctness first; secondary: density by part |
| Outcome-axis (Round-2) | primary: the director's own working experience, sovereign components; secondary: agents perceive what people do |
| Axiom/principle anchors | primary: A3, A13; secondary: A2, A5, A8 |
| Axiom/principle anchors (Round-1) | A3, A2 |
| Axiom/principle anchors (Round-2) | A13, A8 |

---

## S5 Anti-goals (out-of-scope; deferred)

| AG | Description | Composes-with target |
|---|---|---|
| AG-1 | A view stored in the diagram or shared between viewers | a shared "home" view, if the director later asks for one |
| AG-2 | The wheel zooming without Ctrl, or a drag on open ground panning -- AMENDED: the wheel's half overturned by `H27-1`, 2026-11-06, every wheel zooming as a pinch does; the drag's half stands | none; the selection box keeps that drag |
| AG-3 | One grid size for every diagram, or the two grids sized apart | none (Q2, Q3) |
| AG-4 | A device scaling with the grid | none; a device keeps its own size (Q3) |
| AG-5 | Draw first, the components shaped after | none (Q6, H26-3) |

---

## S6 Flags / open questions for the design phase

| # | Flag | Recommendation |
|---|---|---|
| F1 | A device spanning several squares (a 3 by 2 panel, 180 by 120 at 60) keeps its size in units, so on a size that does not divide it its footprint no longer covers whole squares | settle how it aligns -- by its centre, or by a corner -- and show it on the coverage boards |
| F2 | Whether zones keep their size, or snap their edges to the new lines, when the size changes | measure both on the stored diagrams and recommend one |
| F3 | Two devices landing on the same point after a size change | refuse the change, or move the later to the next free point; recommend one |
| F4 | Whether a size change is one undoable edit, seen by every viewer at once | one transaction, as any edit is |
| F5 | A right-button drag on open ground must take none of today's right-button gestures (Alt+right delete, the two-button chords, a right chord during a selection box) | inventory them; a drag threshold tells a click from a pan |
| F6 | Whether the home button also resets the zoom, where it sits, and whether a key does the same | recommend; prove it in the tester |
| F7 | What a diagram's first opening shows: the whole diagram fitted, or 0,0 at actual size | recommend, consistent with F6 |
| F8 | The per-kind caps count grid positions within an extent, which an infinite grid has not | a count limit of its own per kind |
| F9 | The agents' anchor lists list every position within an extent | positions within an area asked for, bounded |
| F10 | The export finds its frame by re-reading what it drew (B435) | the frame from the content's bounds |
| F11 | What is out of view stays on the page (B289) | measure a large board; unload by view only if it pays, the scene removing an item as one removal |
| F12 | The zoom range, and what shows when far out (labels, grid dots) | a range and a level-of-detail rule, proven in the tester |
| F13 | Counting a large grid costs memory, and `snap-grid` lists at most about 5.6 million positions (B325, measured at H26.11) | no listing of an unbounded grid; counts and areas only |
| F14 | WD7's refusal of layout writes, the two stored `layout` entities, and the CLI's zone map on literals (B402) | one stored grid per diagram, migrated once; the CLI from the grid |
| F15 | What a viewer sees, readable by an agent (B418), and a press's travel measured on screen once zoomed (B404) | name what the design gives an agent; measure travel in screen pixels |

---

## S7 Sequencing / cross-work considerations

### S7.1 Branch + review strategy

One design of record in `dev/design/components/`, read under the two-tier gate (H26-15 as amended), walked through with the director one decision at a time, then ratified; built in moves on `main`, each by an agent that did not draft it and passed by an independent verifier, each in the live lab, production with one approval per batch.

### S7.2 Composability with concurrent / pending work

Held rows whose triggers name this design: B289 and B325 (the infinite canvas), B404 (travel on screen), B415 (drawing a grid as a shared piece), B419 (the view in `vector-scene`) and B435 (the export's frame) -- each revived when the design is drafted.\
The components grow by release: `vector-scene` and `snap-grid` gain what the view and an unbounded grid need, `input-capture` and `input-binding` only if the gestures show a gap, each released before draw takes it.

### S7.3 Compressed-timeline candidate?

No: the change overturns decision 1 and changes stored data, so the full path -- design, readings, walkthrough, ratification, moves, verifiers, lab -- applies.

---

## Scalibration -- Calibration data point

- **Stakeholder time-cost (minutes):** 10 (six answers across both rounds)
- **Comparison baseline:** H26.8's start (H26-16), one pick among three next items, the aims named in free text
- **Notes:** one question at a time with a recommendation each, as the director asked; every pick was the recommendation, and four answers added a constraint no option offered -- the free text carried the new intent, so a design walkthrough should leave room for it

---

## S8 Cross-references

- **mission-kit K5** -- the survey methodology this followed, adapted to one question at a time
- **H26.6** -- the work item (`dev/BOARD.md`); H26-3 its order; H26-22 records these answers
- **B289, B325, B404, B415, B418, B419, B435** -- the held rows this design meets
- **`dev/design/components/NATIVE-SHAPES.md`** -- section 3.1, the view carrying every layer under H26.6

---

-- Proposer: the recorder / 2026-11-01 (survey envelope; six picks across two rounds, one at a time)
