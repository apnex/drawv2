# H26.0, part 1 -- `snap-grid`, and what every component shares

The first piece of H26's design of record (`dev/DECISIONS.md` H26-3).\
It designs `snap-grid`, the smallest of the four components H26-1 named, and the parts all four share: the repository template, the vocabulary check, the gate and the release workflow, how draw depends on a release, and how draw's pages load it.\
The other three components and the gesture tester's scope are later pieces, each brought to the director on its own.

**Standing:** a design under review; nothing in it is built until the director ratifies it.\
Revision 2, after the first multi-family reading (section 10); revision 1 was `0c59572`.

---

## 1. What this decides, and what it does not

It decides:
- `snap-grid`'s one duty, its vocabulary and its contract, precisely enough that an agent other than its author could build it from section 3 alone;
- the invariants and tests that hold it, and the acceptance tests for draw's move onto it (H26.1), with every site in draw that the move touches (appendix B);
- what every component repository holds, how it is checked, how a release is made, and how draw takes one in (section 7).

It does not decide:
- `input-binding`, `input-capture` or `vector-scene`, nor the gesture tester's scope (later pieces of H26.0);
- pan and zoom in draw (H26.6, which overturns decision 1 and is ruled when reached);
- any grid that is not square (B390: named, and proved possible in tests, not built);
- the defects in draw that the inventory found (section 6.3): each is kept exactly as it is by H26.1 and registered for its own ruling.

---

## 2. What draw does with grids today

Read from the code at `0c59572`; appendix B lists every site, one row each, with what H26.1 does with it.

**The arithmetic** lives in `kernel/geometry.mjs`, over the locked pitch of `kernel/spec.mjs` (`STD.pitch`, 60):
- `cellOf` -- the node grid, no offset, unbounded (`geometry.mjs:12`), injected into the relation index (`engine/relations.mjs:18-22`);
- `LAYOUTS` -- two lattices, `node` at offset 0 and `zone` at offset 30 (`:34-37`);
- `onLayout`, `snapLayout`, `cellOn`, `pxOn` -- one axis at a time (`:40-49`);
- `nearestAnchor`, `anchorAt` -- both axes, unbounded, used by the REST door (`:59-67`);
- `spanExtent` -- `(cols - 1) * pitch`, the extent a block adds beyond one position (`:108-111`), restated inline at `server/svg.mjs:171` and `devices/device-fields.mjs:65`.

**Which grids a diagram has** is the layouts plugin's: two stored records, each `{ pitch, offset, ext }` (`layouts/layout-table.mjs:21-24`), held to today's values by WD7.

**The kinds of use**, which differ and must each be kept:
- **bounded snapping** on the canvas: snap, then clamp to the place's extent (`app/src/snap.js:25-34,146-151`, `zones/zone-gestures.mjs:20-26`);
- **unbounded snapping**: the REST `nearest` route (`server/rest.js:655`: `x=5000` answers `x=4980`) and the relation index, which keys positions mid-drag that are off the lattice and may be off the extent (`app/src/input.js:1004`);
- **exact tests**, one field at a time, for positions and for lengths (`product/kinds.mjs:87-88`, `zones/zone-kind.mjs:42-45` -- a zone's `w` and `h` are tested against the node lattice as lengths);
- **enumeration**: the drawn grid over the record's extent (`layouts/layout-canvas.mjs:26-35`), the free anchors over the node extent (`server/anchor.mjs:62-68`), and the REST anchor list over the node index range for both grids (`server/rest.js:663-665`);
- **rounding toward one side**: the zone wrap floors and ceils onto the zone lattice (`zones/zone-keys.mjs:28-33`);
- **stepping**: a zone corner one pitch from the fixed one, falling back the other way at the edge (`zone-gestures.mjs:56-64`), and the free-anchor walk (`server/anchor.mjs:139`);
- **spans**: device frames, outlines, footprints and the export's bounds (`devices/device-appearance.mjs`, `devices/device-footprint.mjs`, `server/svg.mjs:171`);
- **lengths in pitches**, which are policy, not conversion: a drag's clamp quantised to the pitch (`snap.js:66-81`), capacity counts (`model/surface.mjs:14`), mover speeds and tower ranges (`engine/movers.mjs:77`, `engine/rules.mjs:69`), render sizes.

Three facts shape the design:
- every extent is on its own lattice (900 and 480 on the node grid, 930 and 510 on the zone grid), so clamping a snapped coordinate equals clamping its index;
- a coordinate exactly halfway between two lattice coordinates goes to the greater, because `Math.round` does;
- every index and every snapped coordinate is normalised from `-0` to `0`, except `px`, which no product module calls.

---

## 3. `snap-grid`

### 3.1 Duty

Answer, for a grid declared as data, where its positions lie in a plane and which position lies nearest a point.

That is the whole duty.\
It does not also draw a grid, hold which grids an application has, decide what may sit at a position, keep anything between calls, or move anything -- each of those is the consumer's or another component's.

### 3.2 Vocabulary

These are the only nouns `snap-grid`'s source uses for what it handles.

| Word | Meaning |
|---|---|
| plane | the two-dimensional space a consumer's coordinates live in; `snap-grid` assumes nothing of which way its axes point |
| point | an object with numbers `x` and `y` |
| grid | a set of positions with a rule for where each lies, opened from a declaration |
| declaration | plain JSON data naming a grid's shape and its parameters |
| shape | the kind of rule a grid follows -- `square` is the one shipped |
| position | a grid's own integer coordinates for one of its places -- `{ col, row }` on a square grid |
| representable | a position whose indices and whose point's coordinates are all safe integers (magnitude at most 2^53 - 1) |
| offered | a representable position whose point lies within the grid's bounds, or any representable position when it has none |
| bounds | an optional box in the plane limiting which positions are offered |
| cell | the closed part of the plane nearer to one position than to any other position of the same shape with no bounds -- bounds never change a cell |
| block | the positions between two corner positions, both included |
| region | a closed part of the plane, tagged by kind: `{ kind: 'rect', x, y, w, h }` with `w` and `h` at least 0 is the one a square grid returns and every view uses |
| view | `{ region, scale }`: the rect being looked at, and `scale` in screen units per plane unit |
| stride | how many positions apart, on each index, the positions offered for a view are |
| direction | a name for a step from one position to its neighbour, each shape naming its own and pairing each with its opposite |

### 3.3 Contract

One capability per row.\
None requires another component's capability, and none brings a trait: `snap-grid` keeps nothing between calls, coordinates no actors and contains no model.

| Capability | Relation | What a consumer can depend on |
|---|---|---|
| `declared-grid` | provides | A declaration is opened into a grid, or refused with every problem it has, each naming where it lies (SG1). |
| `nearest-grid-position` | provides | The offered position nearest a point (SG3). |
| `grid-position-point` | provides | The point any representable position lies at (SG4). |
| `exact-grid-position` | provides | The offered position a point lies exactly on, or none (SG5). |
| `grid-positions-in-view` | provides | The offered positions within a view, thinned to a spacing on screen, in one order (SG6). |
| `next-grid-position` | provides | The offered neighbour of an offered position in a named direction, or none (SG7). |
| `grid-position-span` | provides | The region a block runs through and the region its cells cover (SG8). |
| `enclosing-grid-block` | provides | The smallest block of offered positions whose span runs through a region (SG9; decision D10). |
| `grid-shape-conformance` | provides | A kit that judges whether a shape keeps the invariants of section 4 over cases it is given (SG11). |

**Errors.**\
Every function validates its arguments before it computes.\
A malformed argument -- a point that is not an object with number `x` and `y`, a position not of the shape's form, a region or view not of section 3.2's form, an option out of range, a direction the grid does not list -- throws a `TypeError` whose message begins with the function's name.\
A well-formed position that is not representable, given to `pointOf` or `span`, throws a `RangeError`.\
A point whose coordinates are numbers but not finite is well formed: `nearest`, `positionAt` and `enclosing` answer `null` for it.\
`openGrid` never throws for any declaration; it throws a `TypeError` only for malformed `options`.

**SG1 -- A declaration, opened or refused.**\
`openGrid(declaration, options?)` returns `{ ok: true, grid }` or `{ ok: false, problems }`.\
A problem is a record of exactly `pointer`, an RFC 6901 pointer into the declaration (`~` written `~0`, `/` written `~1`), and `problem`, one of the codes below.\
Problems are ordered by pointer and then by problem, each compared by UTF-16 code unit as JavaScript's `<` compares strings, and no record appears twice.

A plain object is a value whose prototype is `Object.prototype` or `null`.\
The checks run in this order; a check that fails at a pointer suppresses every check beneath that pointer:

| Step | When | Problem, at pointer |
|---|---|---|
| 1 | the declaration is not a plain object | `not-an-object` at `""`, and nothing else |
| 2 | it has no own `shape` | `missing-property` at `/shape`, and nothing else |
| 3 | `shape` is not a string naming a shape the call knows | `unknown-shape` at `/shape`, and nothing else |
| 4 | an own property other than those the shape names | `unknown-property` at `/<name>`, one each |
| 5 | a required property is absent | `missing-property` at `/<name>` |
| 6 | a property is present and not of its form | the form's problem, below |
| 7 | every parameter is valid and the bounds offer no position | `no-position-in-bounds` at `/bounds` |

A square declaration names `shape: 'square'`, `pitch`, `origin` and, optionally, `bounds`:

| Property | Form | When not of the form |
|---|---|---|
| `pitch` | a safe integer above 0 | `invalid-value` at `/pitch` |
| `origin` | a plain object of exactly `x` and `y`, each a safe integer | `not-an-object` at `/origin`; else, per member, `unknown-property`, `missing-property` or `invalid-value` at `/origin/<name>` |
| `bounds` | a plain object of exactly `min` and `max`, each a point of the same form as `origin`, with `min.x <= max.x` and `min.y <= max.y` | as for `origin`, at `/bounds` and beneath it; when `min` and `max` are both valid and an axis is reversed, `invalid-value` at `/bounds/max/x` or `/bounds/max/y` |

`options.shapes` is an array of shapes (SG11) added to `square`; a shape that is not of SG11's form, or a name given twice or equal to `square`, makes `openGrid` throw a `TypeError`.\
`grid.declaration` is a recursively frozen copy, `-0` written `0`; the grid holds nothing else and never changes.

**SG2 -- What the grid offers.**\
A square grid's least and greatest offered index on each axis are those of the bounds -- `ceil((min - origin) / pitch)` and `floor((max - origin) / pitch)` -- or, with no bounds, those whose points are safe integers.\
`nearest`, `positionAt`, `inView`, `next` and `enclosing` answer only with offered positions; `pointOf` and `span` compute for any representable position, because they compute rather than choose.\
`grid.offers(position)` says whether a well-formed position is offered.

**SG3 -- Nearest.**\
`grid.nearest(point)` returns the offered position whose point is nearest, or `null` for a coordinate that is not finite.\
On a square grid, on each axis: `Math.round((v - origin) / pitch)`, clamped to the least and greatest offered index, then `+ 0`.\
So a coordinate exactly halfway between two positions goes to the greater, and no index is `-0`.\
Per-axis rounding and clamping is exactly nearest, because each cell is a square and the offered positions form a rectangle.

**SG4 -- Where a position lies.**\
`grid.pointOf(position)` returns its point; a square position is a plain object of exactly `col` and `row`, each a safe integer.\
On a square grid: `{ x: col * pitch + origin.x + 0, y: row * pitch + origin.y + 0 }`.

**SG5 -- Exactly on.**\
`grid.positionAt(point)` returns `n = grid.nearest(point)` when `grid.pointOf(n)` has exactly the point's `x` and `y` (`===`), and `null` otherwise.\
Defined through `nearest` and `pointOf`, it means the same for every shape, and needs no tolerance.\
On a square grid with no bounds it answers a position exactly when draw's test `(v - origin) % pitch === 0` holds on both axes, for every finite coordinate of magnitude at most 2^53 - 1 (I10's corpus holds both).

**SG6 -- In view.**\
`grid.inView(view, options?)` returns a frozen `{ stride, positions }`, each entry a frozen `{ position, point }`.\
`view.region` is a rect with finite `x`, `y`, `w`, `h`, `w` and `h` at least 0, and `x + w`, `y + h` finite; `view.scale` is finite and above 0.\
`options.minSpacing`, default 0, is a finite number at least 0: the least distance on screen between neighbouring positions offered.\
`options.max`, default 10000, is a safe integer at least 1: the most positions returned.\
On a square grid:
- an index range on each axis is the offered indices whose coordinate lies in the region, edges included -- possibly empty;
- the stride is the least power of two `s`, from 1 to 2^54, at which `pitch * view.scale * s >= options.minSpacing`, or 2^54 when none is;
- a position is returned when both its indices are in range and divisible by the stride, tested as `i % s === 0`;
- while more positions than `options.max` would be returned, counted per axis as `floor(hi / s) - ceil(lo / s) + 1` before anything is made, the stride doubles; at 2^54 at most one index per axis is divisible, so this ends;
- the positions are ordered by row and then by column, both ascending.

For one region and one grid, the positions returned at stride `2s` are a subset of those at stride `s`: zooming out drops positions and never moves one.

**SG7 -- Next.**\
`grid.directions` is a frozen array of the shape's direction names, and `grid.opposite(direction)` names each one's opposite.\
A square grid's directions are `-x`, `+x`, `-y` and `+y`, each a step of one index on that axis, opposite in pairs.\
`grid.next(position, direction)` returns the neighbour in that direction when both the position and the neighbour are offered, and `null` otherwise.

**SG8 -- Span.**\
`grid.span(from, to)` returns a frozen `{ through, covering }` for the block between `from` and `to`, in either order:
- `through` -- the smallest region holding every position's point;
- `covering` -- the smallest region holding every position's cell.

On a square grid, with the least corner's point `(x0, y0)`, `cols = |to.col - from.col| + 1` and `rows` alike: `through` is `{ kind: 'rect', x: x0, y: y0, w: (cols - 1) * pitch, h: (rows - 1) * pitch }`, and `covering` is `through` grown by `pitch / 2` on every side.\
So `span(p, p).through` is the rect of `p`'s point with `w` and `h` 0, and `span(p, p).covering` is `p`'s cell.\
`grid.regionContains(region, point)` says whether a point lies in a region of the shape's kinds, edges included.

**SG9 -- Enclosing.**\
`grid.enclosing(region)` returns `{ from, to }`, the smallest block of offered positions whose `through` contains the region, clamped to what the grid offers, or `null` when the region has a coordinate that is not finite.\
On a square grid, on each axis: `from` is `Math.floor((min - origin) / pitch)` and `to` is `Math.ceil((max - origin) / pitch)`, each clamped to the least and greatest offered index, then `+ 0`, where `min` and `max` are the region's edges.\
This is draw's zone wrap (`zones/zone-keys.mjs:28-33`) as a question any shape can answer.

**SG10 -- Exports.**\
`@apnex/snap-grid` exports `openGrid` and `square`; `@apnex/snap-grid/conformance` exports `checkGridShape`.\
The package imports no other package and no module particular to one runtime, so the same files run in Node and in a browser.

**SG11 -- Shapes are adapters, proved by a kit.**\
A shape is a frozen object `{ name, open }`, `name` a non-empty string and `open(declaration)` returning what `openGrid` returns for it, its grid offering everything SG2 to SG9 name: `declaration`, `directions`, `opposite`, `offers`, `nearest`, `pointOf`, `positionAt`, `inView`, `next`, `span`, `regionContains` and `enclosing`.\
`checkGridShape(shape, cases)` judges the invariants of section 4 over each case and returns a frozen array of failures, empty when none.\
A case is `{ name, declaration, points, positions, views, blocks, regions }`: a declaration the shape admits, and the sample arguments the invariants are judged over -- points, positions, `{ view, options }` pairs, `[from, to]` pairs and regions.\
A failure is `{ invariant, case, args, got }`: the invariant's number, the case's name, the arguments, and what the grid answered.\
Sampled checks cannot prove a claim for every input; each shape's own tests carry the proof of its formulas (section 4's matrix), and the kit proves that the shape's answers hang together.\
`square` is proved by the kit in `snap-grid`'s own tests, and so is a test-only radial shape -- positions `{ ring, slot }` with rings 1 to `rings` and slots 0 to `slots - 1`, points on circles about an integer centre, directions `-ring`, `+ring`, `-slot`, `+slot` with the slot wrapping, regions `rect` and `sector`, and every answer found by searching every position, so it is small and plainly right.\
A consumer may write a shape against this port and prove it with the kit; a shape more than one consumer needs is adjusted into `snap-grid` (C0, "Adjustment over replacement"), never copied between them.

### 3.4 Fit criteria

**Does my project want this at all?**
- More than one part of your system snaps to, draws or validates against the same grid, and they must agree to the last unit.
- You are about to write `Math.round((v - offset) / pitch) * pitch + offset` -- especially if you have written it before.

**It is the wrong tool when:**

| You need | Reach elsewhere, because `snap-grid` is |
|---|---|
| grid lines or dots drawn | not a renderer -- it says where; the consumer draws |
| which grids an application has, stored or edited | not a store |
| whether something may sit at a position | not an authority over occupancy |
| freehand placement, or snapping to other things' edges | not a general snapping engine -- it knows only its grid |
| a grid of fractional pitch | not yet: pitches and origins are integers until a consumer needs otherwise (D1) |

### 3.5 Adjustment policy and edges

Internal and sovereign: a measured gap is recorded where both sides can see it, then resolved by adjusting `snap-grid` or by fracturing it if the gap reveals a second duty; never forked.

**Contains:** the `square` shape and the conformance kit.\
**Consumes:** nothing.\
**Consumed-by:** draw (H26.1), then the gesture tester (H26.5).

---

## 4. Invariants and tests

Each invariant is a check of the kit (SG11) unless marked otherwise, and holds for every grid of every shape over the arguments it is judged on.

| # | Invariant |
|---|---|
| I1 | For every offered position `p`: `offers(p)` is true, `nearest(pointOf(p))` is `p`, and `positionAt(pointOf(p))` is `p`. |
| I2 | `nearest(q)`, for a finite point, is offered, and no offered position among the case's positions, their neighbours, and the positions `inView` returns for the cell-sized rect about `q` is strictly nearer. |
| I3 | `positionAt(q)` is `null` or an offered position whose point is exactly `q`. |
| I4 | Every position `inView` returns is offered and its point lies in the view's region; the stride is a power of two at most 2^54; at stride `2s` the positions are a subset of those at stride `s` for the same view; no more than `max` are returned; the order is the shape's. |
| I5 | `next(p, d)` is `null` or an offered position whose cell shares an edge with `p`'s; where `next(p, d)` is `n`, `next(n, opposite(d))` is `p`; `opposite(opposite(d))` is `d`. |
| I6 | `span(a, b)` equals `span(b, a)`; `covering` contains `through` and the cell of every position in the block; `span(p, p).covering` is `p`'s cell. |
| I7 | The same declaration and arguments always give the same answer, field for field and in the same order; no answer holds `-0`; every answer is frozen. |
| I8 | For every finite region within what the grid offers, `enclosing(region)` gives a block whose `through` contains the region, and neither corner can move inward and keep that true. |
| I9 | `openGrid` never throws for any JSON value, and answers every declaration with exactly the problems SG1 gives (`snap-grid`'s tests, from a table of cases, escaped pointers and code-unit order among them). |
| I10 | `square` reproduces draw's arithmetic: a corpus of points, positions and answers, generated once from draw's `kernel/geometry.mjs`, `app/src/snap.js`, `layouts/layout-canvas.mjs` and `zones/zone-keys.mjs` at `0c59572` for finite coordinates of magnitude at most 2^53 - 1, and stated as square-grid cases with no word of draw's, passes with `-0` told apart from `0` (`snap-grid`'s tests). |
| I11 | The source names no consumer's vocabulary, and the built files import no package and no runtime-specific module or global (`snap-grid`'s gate, section 7.2). |

**Each rule's own tests,** in `snap-grid`'s `test/contract/`, one file per capability, beyond the kit:
- SG1: the refusal table of I9, every row of the validation tables, and `options.shapes` refused for each malformed form;
- SG3: ties toward the greater on both signs, clamping on every side, non-finite coordinates;
- SG5: on and off for each sign, `-0`, and draw's remainder test agreeing over I10's corpus;
- SG6: completeness against a search of every index in small views; the least stride for a spread of scales and spacings; `max` doubling the stride; empty and disjoint regions; zero-size regions; negative indices at strides up to 2^54;
- SG7, SG8, SG9: every direction at every edge; spans in both orders; enclosing of regions straddling, touching and beyond every edge;
- errors: each function refusing each malformed argument with the error and message SG3.3 names; `grid.declaration` frozen to its depth.

**Acceptance for H26.1, draw on `snap-grid`:**
1. `snap-grid` is released from its repository by its CI, and draw's lockfile pins the release file by its hash.
2. Every site appendix B marks *moves* asks `snap-grid`, on the grid the row names; every site marked *stays* reads the pitch, origin and extent from a declaration, never from `STD.pitch`, `LAYOUTS` or a literal; every site marked *kept* keeps its behaviour exactly and cites its backlog row.
3. `kernel/geometry.mjs` no longer exports `px`, `cellOf`, `LAYOUTS`, `onLayout`, `snapLayout`, `cellOn`, `pxOn`, `nearestAnchor`, `anchorAt` or `spanExtent`; `app/src/snap.js` no longer holds `clamped`, `snapNode` or `HALF`; `zones/zone-gestures.mjs` no longer holds `snapZone`; a test in draw finds none of them, and finds `Math.round`, `Math.floor` or `Math.ceil` over a pitch only at the sites appendix B marks *stays*.
4. Before anything is deleted, a test in draw runs each old function and its replacement side by side over a sweep of points and positions for both grids, bounded and unbounded, and finds no difference, `-0` told apart; I10's corpus is what it writes.
5. Draw's full gate passes, the probe against production finds no pixel or style changed, the REST answers for `nearest` and `anchors` are byte-identical before and after for a sweep of queries, and an independent verifier passes the move.
6. The product page, the lab page, the server and the export load the one release: the pages through the import map (section 7.6), Node by name.

---

## 5. What draw supplies, and what stays draw's

**Draw opens four grids,** each from the layouts plugin's records through one function of that plugin, so no other module states a pitch, an origin or an extent:

| Grid | Declaration | Used for |
|---|---|---|
| node, bounded | `{ shape: 'square', pitch, origin: { x: offset, y: offset }, bounds: { min: { x: -ext.x, y: -ext.y }, max: { x: ext.x, y: ext.y } } }` from the node record | canvas snapping, free anchors, the wrap's and the steps' edges |
| node, unbounded | the same with no `bounds` | the relation index, field validation (lengths and positions), the REST `nearest` and `anchors` routes |
| zone, bounded | from the zone record, as the node | canvas snapping of zones, the wrap, corner steps |
| zone, unbounded | the same with no `bounds` | field validation, the REST routes |

The REST anchor list keeps its index range exactly -- the node extent's indices for both grids, through `pointOf` on the unbounded grid -- because that range is today's behaviour, defect or not (section 6.3).

**Stays draw's,** because it is draw's content or policy, reading the pitch and extents from a declaration:
- what is drawn at a position: the dot, its radius (`gridDot`), the layer, the zone grid's Shift;
- a drag's clamp and its quantisation by the pitch (`clampDelta`), and a multi-selection moving as one;
- a group's hull (`groupHull`), a device's frame margin, sockets placed in a device's own frame, and the cap on how many things fit (`anchorCellsWithin`);
- the nearest *free* anchor and the walk past occupied ones (`server/anchor.mjs:75-84,139`), which ask `snap-grid` for positions and decide occupancy themselves;
- speeds, ranges and limits counted in pitches (`engine/movers.mjs`, `engine/rules.mjs`, `devices/device-size.mjs`).

**Out of H26.1,** each registered with its trigger: the CLI's own arithmetic over literal `30` and `60` (`cli/verbs.mjs:2096,2264-2267`), because the CLI imports no product module and installs with no package (SD1, B138) until OD-3 is designed for it.

---

## 6. How the parity is kept

Draw's grids must not move by a pixel, and its REST answers must not change by a byte.

### 6.1 Three tests from three sides

I10 holds `snap-grid` to draw's arithmetic as square-grid cases; acceptance step 4 holds draw's move from draw's side, old against new, before anything is deleted; the probe and the REST sweep hold what is drawn and what is answered.

### 6.2 The differences a careful reader looks for

- **Bounds not on the lattice.** Draw clamps a snapped coordinate (`snap.js:25-27`); `snap-grid` clamps the index. They agree whenever the extent is on its lattice, which every extent draw has is; I10's corpus holds points beyond every edge.
- **Unbounded uses.** The REST routes and the relation index never clamp today; they move onto the unbounded grids, so `x=5000` still answers `x=4980`.
- **Ties.** Both round half toward the greater; the zone wrap's floor and ceiling become SG9, which floors and ceils the same way.
- **`-0`.** Every draw caller normalises it except `px`, which no product module calls and which is deleted.
- **Non-finite input.** `snapNode` passes `NaN` through and clamps `Infinity` to the edge; `nearest` answers `null`. No draw caller can pass either -- pointer events and validated fields are finite -- and the parity is stated for finite input only.

### 6.3 Defects the inventory found, kept as they are

H26.1 is an extraction: it changes no behaviour, defects included.\
Each of these is registered for its own ruling:
- the REST zone anchor list spans `x` -870 to 930 and `y` -450 to 510, 527 anchors, where the zone lattice within its extent has 576 (`server/rest.js:663-665`, measured);
- the zone cap counts 527 places (`zones/zone-kind.mjs:55`, `model/surface.mjs:14`) where the zone lattice within its extent has 576;
- a layout named by an inherited property answers 200 with nulls instead of 404 -- `GET .../layouts/constructor/nearest?x=0&y=0` answers `layout: "Object"`, measured (`server/rest.js:645`); H26.1's lookup through the layouts plugin's records refuses unknown names, so this one changes, and is ruled with H26.1;
- the CLI restates the pitch as literals (section 5).

---

## 7. What every component shares

### 7.1 The repository

Each component is a public repository `apnex/<name>`, its package `@apnex/<name>` (H26-2), laid out after shape-check's (PC1), with the differences named:

| Path | What it holds |
|---|---|
| `README.md` | four journeys -- install, use, test, remove (S4, S9) |
| `VISION.md` | north star, why it exists, what it is and is not, what success means, authority -- ratified by the director |
| `CONTRACT.md` | the contract of record, carrying a mission-kit component entry's fields, its id unminted until mission-kit admits it (C0) |
| the decision record | the component's own rulings, append-only, at the repository's `docs/` |
| `src/` | TypeScript under a `tsconfig.json` strict as shape-check's, with `"types": []` and `lib` limited to what the component needs -- `ES2022` alone for `snap-grid` -- so no runtime's types reach its source; relative imports written with `.js`, as NodeNext requires and a browser resolves |
| `test/` | `node:test` over the built `dist/`, `test/contract/` holding a file per capability, under a `tsconfig` of its own when typed |
| `export-map.json` | each export and the capabilities it serves, in zorg's form, so its capability checker can read the component |
| `tools/` | the vocabulary check, the runtime check and the export-map check; no copy of mission-kit's style tools (7.3) |
| `.github/workflows/` | `gate.yml` and `release.yml` |
| `LICENSE` | MIT |

`package.json` declares `"type": "module"`, `engines.node` `>=22`, `exports` with a string target or a `{ types, default }` pair for each entry point and nothing else, `files` limited to `dist` and the documents, no runtime dependency, and TypeScript pinned as a development dependency.\
Source maps carry their sources (`sourceMap` with `inlineSources`), and declaration maps are off, so nothing in a release points at a file it does not hold.\
`dist/` is git-ignored: built files exist only in a release.

### 7.2 The vocabulary check and the runtime check

**The vocabulary check** fails the gate when the component's `src/` holds a word of a consumer's vocabulary in code, a string or a comment (P4: an import check cannot see a word in a comment).\
It splits every identifier at case changes, underscores and hyphens -- so `nodeCount` is `node` and `count` -- and compares lower-cased whole words.\
The words are test data in `tools/`, never in `src/` and never in a release, one list per consumer:
- draw: `node`, `link`, `zone`, `pipe`, `waypoint`, `device`, `diagram`, `anchor`, `glyph`, `spawner`, `transit`, `layout`, `junction`, `drawv2`;
- the gesture tester: `keyboard`, `keycap`.

Ordinary words a component needs -- `group`, `route`, `draw`, `mouse`, `key`, `bend` -- are on no list; a listed word a component genuinely needs is allowed by name in its decision record, never by loosening the match.\
A word check cannot prove that a component holds none of a consumer's policy; that stays the independent verifier's question at every build.\
Draw's gate also runs the same check, with draw's list, over every installed component's `dist/`, so a release that leaks draw's words cannot reach draw's pages.

**The runtime check** fails the gate when a built file of a component meant for every runtime imports a bare specifier or a `node:` module, or names `process`, `require`, `Buffer`, `window` or `document`.

### 7.3 The gate, and CI

`npm run gate` builds, runs the tests, the vocabulary, runtime and export-map checks, and mission-kit's style checks over the repository's Markdown.\
The style checks are fetched, never copied, as draw fetches them (its `.github/workflows/gate.yml`, ruled 2026-08-27): CI checks out `apnex/mission-kit` at HEAD and points `MISSION_KIT` at it; a developer's machine uses a sibling checkout.\
`gate.yml` runs the gate on every push and pull request, on Node 22 and Node 24, and then a **consumer test**: it packs the package, installs the file into an empty project with `--omit=dev`, imports every export by name in Node 22, and loads every export in headless Chrome through a static server and an import map made as section 7.6 makes draw's.

### 7.4 A release

`release.yml` runs when a tag `v<semver>` is pushed, one run at a time per repository, with permission to write releases and nothing else:
1. it refuses a tag that differs from `package.json`'s version, or one that already has a published release;
2. it runs the gate and the consumer test;
3. it packs the package and writes the file's SHA-512;
4. it creates a **draft** release, attaches the file and its SHA-512, downloads both back and compares them byte for byte with what it packed;
5. only then it publishes the draft.

A failed run leaves at most a draft, which the next run of the same tag deletes and remakes; a published release is never replaced, and a fix is a new version.\
Tags `v*` are protected so that only maintainers can push them, and the repository's release immutability setting is on where GitHub offers it (INFERRED available; checked when the first repository is made).\
Only CI makes a release; a file made on a machine is never attached.

### 7.5 How draw depends on a release

Draw's `package.json` names the release file:
```json
"dependencies": {
  "@apnex/snap-grid": "https://github.com/apnex/snap-grid/releases/download/v0.1.0/apnex-snap-grid-0.1.0.tgz"
}
```

`npm install` records the file's `integrity` in `package-lock.json`, and every `npm ci` -- the gate, CI, the image build -- refuses a file whose hash differs.\
Taking a new version is a change to that one line and the lockfile, in a commit of its own, through draw's whole gate.

### 7.6 How draw's pages load it

**A generated import map.**\
A new generator in draw's tools, `import-map.mjs`, reads draw's `@apnex/` dependencies and each installed package's `exports` and version, and writes one `<script type="importmap">` into a generated region of `app/index.html` and `lab/index.html`, as the stylesheet generator writes the stylesheets; its `--check` runs in the gate.\
It writes one entry per export -- never a trailing-slash prefix, which would map `@apnex/snap-grid/conformance` to a URL with no `.js`:
```json
{ "imports": {
  "@apnex/snap-grid": "/vendor/@apnex/snap-grid@0.1.0/index.js",
  "@apnex/snap-grid/conformance": "/vendor/@apnex/snap-grid@0.1.0/conformance.js"
} }
```

It refuses an `exports` form it does not support -- conditions other than `types` and `default`, patterns, or a target outside `dist/` -- rather than guessing.\
The region sits in `<head>` before every module script and every `modulepreload`, and is the page's only import map.\
`scan-layers`' rule L6, which refuses every inline `<script>`, admits exactly this one: a `type="importmap"` script inside the generated region whose content the generator's `--check` holds; every other inline script is still refused.

**A vendor mount.**\
Both servers serve `/vendor/@apnex/<name>@<version>/<file>` from `node_modules/@apnex/<name>/dist/<file>` through the one static responder, only for a package the map names and only at the version installed; any other name or version is a 404, and the path is bounded as every mount is (`fileWithin`).\
The generator also refuses a vendored file that imports a package the map does not name.

**Node** -- the server, the export, the tests -- imports a component by name from `node_modules`; the export writes no import map, because it never runs in a browser.\
The image installs the component with `npm ci --omit=dev`, unchanged.

**Proved by:** a browser test that loads the product page and the lab page and finds every module request answered 200, the component's among them; the image job fetching a vendored file; and the probe, which serves each side with the real servers (`tools/probe/parity.mjs:100-101`).\
`tools/probe/measure.mjs` serves `app/` alone through Python and already cannot load the module graph; it measures only the page's chrome, and is left as it is.

### 7.7 The architecture manifest

`tools/layers.mjs` gains `COMPONENTS`: each component draw consumes, the parts that may import it, and the ruling that admits it.\
`scan-layers` allows an import of a component only from those parts, and the generated architecture shows each part's components beside its consumes.\
The mission-kit register moves `snap-grid` from a candidate to a component draw composes, under the `lattice` part, the reading date renewed.

---

## 8. Decisions owed

Each is offered with a recommendation; they may be ratified together, or one at a time.

| # | Decision | Recommendation, and why |
|---|---|---|
| D1 | A square declaration is an integer `pitch`, an integer `origin`, and optional integer `bounds` -- one pitch for both axes | yes: draw's grids and the keyboard need nothing else, and integers make every answer exact, so `positionAt` needs no tolerance; fractional or per-axis pitches wait for a consumer (P4) |
| D2 | Positions in each shape's own integer coordinates, and directions each shape names and pairs -- `-x`, `+x`, `-y`, `+y` on a square grid | yes: a radial grid has no x, and names tied to the axes say nothing of which way is up, which is the consumer's |
| D3 | `span` answers both `through` the points and `covering` the cells | yes: draw needs the first, the keyboard the second |
| D4 | Thinning by powers of two counted from position 0 | yes: zooming out drops positions and never moves one, so a drawn grid does not shimmer |
| D5 | Shapes are adapters against a port, the kit exported, a radial shape in the tests only | yes: the contract cannot be square by accident, and nothing ships ahead of a consumer (B390) |
| D6 | `snap-grid` validates its own declaration, depending on no package | yes -- weighed against two alternatives: shape-check for structure plus local checks for the integer and order rules would give a consumer two forms of refusal, add a second package to every page's import map, and needs Node 24 where draw runs 22; an upstream dialect 2 in shape-check is shape-check's ruling, on zorg's timeline, and would leave the order rule local anyway. About sixty lines of validation is the smaller cost; the overlap is recorded as a finding for mission-kit's registry (C0) |
| D7 | Files on the vendor mount are kept by the browser for a year, marked immutable | yes, on two conditions it states: draw's own files and the page that holds the map stay `no-store`, so a page reached by Back or a restored session fetches a fresh map (H24.16-1's verification measured that it does); and draw imports components only statically, a test refusing a dynamic import of one, so no page asks for a version after the deploy that removed it. An address that carries a version and a release that is never replaced mean a kept file is never the wrong one -- the condition B398 waited for, met here for components |
| D8 | Mission-kit's style checks fetched at HEAD in each component's CI, never copied | yes: draw's ruling of 2026-08-27; shape-check copies them, a divergence recorded for zorg rather than followed |
| D9 | A release is a CI run on a protected tag, drafted, verified and only then published, never replaced; versions `0.x` until mission-kit admits the component | yes: H26-2's choice made exact |
| D10 | A seventh question, `enclosing`: the smallest block of offered positions whose span runs through a region | yes: draw's zone wrap floors and ceils onto the zone lattice (`zones/zone-keys.mjs:28-33`), which none of the six questions answers; without it that rounding stays in draw, a copy of the mechanism the component exists to hold |

---

## 9. Axiom alignment audit (M7)

**Identity.**\
H26.0 part 1 at revision 2; drawv2's traits as `MISSION-KIT-ALIGNMENT.md` section 5 reads them (stateful, multi-agent, autonomous); `snap-grid` holds no state, coordinates no actors and runs no model, so it brings no trait and the floor binds it.

**Verdict.**\
Revision 1 was `revise-before-implementation`: its contract left builders room to differ, its inventory missed sites, and its parity and deployment claims went beyond their evidence (section 10).\
Revision 2 is `pass, with guardrails`, its standing confirmed or not by the second reading.

| Axiom | Weight | How the design stands |
|---|---|---|
| A3 Sovereign Composition | load-bearing | One duty, stated without "and"; consumed through a declared contract; the shape port is the one seam for extension, proved by a kit; draw composes it and keeps its content and policy, named site by site. |
| A8 Gated Recursive Integrity | load-bearing | The component's gate and consumer test prove the release before draw depends on it; draw's gate, the side-by-side test, the REST sweep, the probe and a verifier prove the move; the lockfile's hash proves draw runs the file the release made. |
| A5 Perceptual Parity | load-bearing (for draw) | The page, the lab and the server run one implementation; the grids they ask -- bounded or not -- are declared per use in section 5, so where they differ today they differ by declaration, not by drift. |
| A9 Chaos-Validated Deployment | supporting | Tested, not assumed: a release run interrupted after drafting, a file whose hash differs (`npm ci` refuses it), a version the vendor mount does not hold (404), and a page reached by Back and by a restored session across a deploy (D7's conditions), each a test of H26.1. |
| A14 Compounding Learning | supporting | The corpus turns draw's arithmetic into a test any later shape or consumer runs; the inventory's defects are registered, not fixed in passing. |
| A4 Zero-Loss Knowledge | supporting | Rulings recorded in draw and in the component's own record; the reading's findings kept whole outside the repository and dispositioned here. |
| A1, A6, A7, A10, A13 | not materially implicated | `snap-grid` holds no state and no lifecycle; A13 is served by asking section 8's decisions together, each with a recommendation. |

**Tensions, and how they resolve.**
- P4's promotion by evidence against a port with one shipped shape: the port is the contract's own definition, needed to prove the invariants are not square-specific; no second shape ships.
- Six questions ruled against a seventh: D10 asks it, with the site that needs it.
- Use before build (C0) against D6: weighed, with the costs named, and recorded as a finding rather than worked around.
- H24.16-1's `no-store` against D7: H24.16-1 refused keeping files whose address does not change with their content; D7 keeps only files whose address does, on conditions its tests prove.

**Guardrails for the build.**
- G1: every site of appendix B is dispositioned as its row says (acceptance steps 2 and 3), held by a test in draw.
- G2: I10's corpus is generated from draw at `0c59572`, never hand-written, and holds no word of draw's.
- G3: the vocabulary check runs on `src/` comments included, its lists outside the release, and draw runs it on what it installs.
- G4: no release is replaced; draw's lockfile is the only way a version reaches draw.
- G5: the import map is generated and checked, L6 admitting it alone; a page never names a component's address by hand.
- G6: H26.1 changes no behaviour except the one section 6.3 names and rules with it.

**Closeout hooks.**\
H26.1's verifier re-checks G1 to G6, acceptance steps 1 to 6, and A9's four tests; mission-kit admission is asked only after draw runs on the release (C0).

---

## 10. Reviews

### 10.1 Reading 1 -- 2026-10-19, of revision 1 at `0c59572`

Read cold through context-lab's review panel, `--tools on --verify`, the repositories mounted read-only, by `gemini-3.8-flash` (`f`), `grok-4.20-non-reasoning` (`x`) and `gpt-6-astra` (`o`), none of which drafted it, under zorg's pack for its population, the reading kept whole at `~/taceng/drawv2-eval-runs/h26-readings/reading-1/` outside the repository.\
It reported 48 findings.\
Cross-family verification was partial: `x` returned no verdicts, and `f` none on the others' findings, so only `o` verified; every finding was read against the code here, whatever its verdicts.\
A call-site inventory of draw was made to answer the findings about missed sites; it is appendix B.

| Findings | What they said | Disposition |
|---|---|---|
| o:F1, o:F2 | the REST routes are unbounded, and the zone anchor list is not the canvas grid | **Fixed.** Section 5 declares four grids, bounded and unbounded; the REST list keeps its range; both measured, the zone list registered (6.3). |
| f:F1, f:F2, o:F3, x:F8 | the inventory missed sites and consumers of deleted exports | **Fixed.** Appendix B, every site, with a disposition each. |
| o:F4 | "no grid arithmetic stays" contradicts what stays | **Fixed.** G1 and acceptance steps 2 and 3 are the inventory's dispositions, and the policy that stays is named. |
| o:F5 | parity false for `-0` and non-finite input | **Fixed.** Parity stated for finite input; `-0` told apart in the corpus and the side-by-side test (6.2). |
| f:F3, f:F4, o:F6 | refusal records not uniquely determined | **Fixed.** SG1's ordered checks and form tables. |
| o:F7 | argument validation and freezing incomplete | **Fixed.** Errors paragraph; SG1 freezes recursively and writes `-0` as `0`; I7. |
| o:F8, o:F9 | fractional and huge declarations break I1 and I3 | **Fixed.** D1 makes declarations integers; "representable" bounds the domain; SG5 is defined through `nearest` and `pointOf`. |
| o:F10, o:F11, o:F12 | `inView` can fail to end, its modulo loses precision, its region semantics are open | **Fixed.** SG6's options, ranges, stride cap, arithmetic count, `i % s` test and closed rects. |
| f:F7, o:F13, o:F14 | opposites undeclared; I5 false from an unoffered start; cells under bounds ambiguous | **Fixed.** `opposite` in the port; `next` answers `null` from an unoffered position; cells ignore bounds. |
| o:F15, o:F16 | the kit cannot check its invariants, and the invariants admit wrong implementations | **Fixed.** SG11's port, case and failure forms; the radial shape specified; section 4's per-rule tests. |
| f:F9, o:F17, x:F6 | the import map's trailing slash breaks the subpath | **Fixed.** One entry per export (7.6). |
| o:F18 | L6 refuses the import map | **Fixed.** L6 admits the generated map alone (7.6). |
| o:F19, f:F13 | the template does not keep runtime types out; `.js` extensions implicit | **Fixed.** `"types": []`, `.js` imports, the runtime check (7.1, 7.2). |
| o:F20 | source maps would point at missing files | **Fixed.** Inline sources, no declaration maps (7.1). |
| o:F21 | a failed release can strand a version | **Fixed.** Draft, verify, publish; protected tags (7.4). |
| o:F22 | no test of the installed release or the whole loading path | **Fixed.** The consumer test (7.3) and the page tests (7.6). |
| o:F23, x:F7, f:F12 | D7 does not prove freshness after a deploy | **Fixed.** D7's two conditions, each tested (A9). |
| f:F8, o:F24, x:F5 | the word lists collide with ordinary words and leak consumer knowledge | **Fixed.** Lists are test data outside the release, ordinary words are off them, identifiers are split, draw checks what it installs, and the verifier keeps the semantic question (7.2). |
| o:F25 | D6 dismissed adjusting shape-check unweighed | **Fixed.** D6 weighs both alternatives. |
| o:F26 | the M7 pass outran its evidence | **Fixed.** Revision 1's verdict recorded as `revise-before-implementation`; A9's tests named. |
| f:F5, f:F6, f:F10, f:F11, f:F14, x:F1, x:F2, x:F3, x:F4 | -- | **Not changed**, as `o` found: each restates what revision 1 already specified, or claims a mismatch the formulas do not have (`x:F1`: `v=30` gives index 1 and point 60 both ways). |

---

## Appendix A -- `snap-grid`'s vision, the draft put to the director

**North star.**\
Let every part of every application agree, to the last unit, on where a grid's positions lie and which one a point belongs to.

**Why it exists.**\
Applications that place things on a grid restate the arithmetic -- snap here, validate there, draw somewhere else -- and the restatements drift: a point the canvas accepts is one the server refuses, or a dot is drawn a unit off the place it marks.\
`snap-grid` holds the arithmetic once, for any shape of grid, so the parts that snap, validate and draw ask the same thing and get the same answer.

**What it is.**\
An embeddable library that opens a grid declared as data and answers seven questions of it: the nearest position, where a position lies, whether a point is exactly on one, the positions in view, a position's neighbour, the span of a block, and the block enclosing a region.\
Grids are supplied by whoever asks; `snap-grid` keeps none.

**What it is not.**
- Not a renderer: it says where; the consumer draws.
- Not a store: which grids an application has, and how they change, are the application's.
- Not an authority: it never decides what may sit at a position.
- Not a general snapping engine: it knows its grid, never other things' edges.
- Not a network service: it never listens and never sends.

**What success means.**
- **Agreement:** no two consumers of one declaration ever disagree on a position or a point.
- **Leanness:** small enough that no consumer would rather write its own.
- **Reach:** a grid of a new shape arrives as a shape proved by the kit, never as a change to a consumer.
- **Reuse:** a second, unrelated application adopts it without a variant, a fork or a change.

**Authority.**\
Held by the director; drafted by anyone, ratified only by the director; amended, never quietly rewritten.

---

## Appendix B -- every site H26.1 touches

From the inventory of `0c59572` (product code only; tests follow their subjects).\
*moves* -- asks `snap-grid` on the grid named; *stays* -- draw's policy, reading the pitch, origin and extent from a declaration; *kept* -- behaviour kept exactly, registered (6.3); *plumbing* -- a constant, import or injection that goes or is repointed.

| Site | Today | H26.1 |
|---|---|---|
| `kernel/geometry.mjs:7,12,34-67,108-111` | `px`, `cellOf`, `LAYOUTS`, `onLayout`, `snapLayout`, `cellOn`, `pxOn`, `nearestAnchor`, `anchorAt`, `spanExtent` | deleted; `gridDot`, `groupHull` stay |
| `kernel/spec.mjs:10,36` | `pitch: 60`; `cell.ext`, unused | the pitch stays the layout table's source (WD7); `cell.ext` deleted |
| `layouts/layout-table.mjs`, `layout-records.mjs` | the records | plumbing: one function opens the four grids from them |
| `layouts/layout-canvas.mjs:26-35,42` | `latticePoints`; the anchor's place | moves: `inView`, bounded grid, region the extent, scale 1 |
| `app/src/snap.js:14-34,146-151` | `GAP`, `HALF`, `clamped`, `snapNode`, `snapIn` | moves: `nearest`, bounded grid of the place; `HALF` and `snapNode` deleted |
| `app/src/snap.js:66-94` | `clampDelta`, `snappedDelta` | stays (the clamp and its quantisation by the declared pitch); the base's snap moves |
| `app/src/snap.js:112-143` | `placesOf`, `gridsOf` | plumbing: a place names a grid, refused when it names none |
| `app/src/input.js` (`snapNode` x14, `snapIn` x5, `GAP` x4) | readouts, ghosts, stamps, boxes, waypoints, Ctrl+D step | moves: `nearest` on the bounded grid; the Ctrl+D step and readout deltas stay (lengths) |
| `app/src/commands.js:241` | nudge through `clampDelta` | stays (a multi-selection moves as one) |
| `app/src/palette.js:157` | `snapNode` | moves: `nearest`, bounded node grid |
| `app/src/compose-canvas.js:56,76`, `lab/src/root.js:93` | inject `cellOf`; crosshair `GAP` | moves: the relation index keyed by `nearest` on the unbounded node grid; the crosshair reads the pitch |
| `app/src/painter.js:44-48` | the snap box, one cell | moves: `span(p, p).covering` |
| `app/src/overlay.js:24` | `CANVAS`, `GAP` imported, unused | plumbing: deleted |
| `engine/relations.mjs:18-22,80`, `engine/store.mjs:11-12` | keys by `cellOf` | moves: injected `nearest` on the unbounded node grid |
| `engine/movers.mjs:77`, `engine/rules.mjs:69`, `engine/spawners.mjs:71` | speeds, ranges, lengths in pitches (a literal `60` in spawners) | stays, reading the pitch from the node declaration |
| `engine/spawn-runs.mjs:54` | `host.snap('node', ...)` | moves with `snapIn` |
| `model/surface.mjs:7,14` | `NODE_EXT`; `anchorCellsWithin` | stays; the zone cap kept (6.3) |
| `model/model.mjs:232-235`, `model/invariants.mjs:81-89` | occupancy by exact coordinates | stays (exact equality is the point) |
| `product/kinds.mjs:72,82,87-88` | `onLayout` per field; the cap | moves: `positionAt` on the unbounded node grid, one axis with the other held at the origin; the cap stays |
| `zones/zone-kind.mjs:26,42-45,55` | `onLayout` for positions and lengths; the cap | moves: positions on the unbounded zone grid, lengths on the unbounded node grid (origin 0, so a length is a coordinate); the cap kept (6.3) |
| `zones/zone-gestures.mjs:17-26,56-64` | `snapZone`; corner steps | moves: `nearest` on the bounded zone grid; the corner step is `next`, falling back to `opposite`; `MIN_ZONE` stays |
| `zones/zone-keys.mjs:17-34` | the wrap's floor and ceiling | moves: `enclosing` on the bounded zone grid (D10); the one-cell minimum stays |
| `zones/zone-keys.mjs:43-47`, `zones/zone-painter.mjs:53` | resize by a pitch; the zone's place | stays (a length step); the place names the bounded zone grid |
| `devices/device-appearance.mjs:75,105-107,114-116,129-133` | spans of a device; sockets in its own frame | moves: `span` on the unbounded node grid; sockets stay (positions in the device's own frame) |
| `devices/device-footprint.mjs:20-27,45-56` | footprints, outlines, sizes | moves: `span(...).through`, padded by draw's margins |
| `devices/device-fields.mjs:64-66`, `server/svg.mjs:170-172` | `spanExtent` restated | moves: `span(...).through` |
| `devices/device-size.mjs:22-24` | positions to the edge; the span count | the count to the edge moves (`nearest` of the extent's corner on the bounded grid); the step and `SPAN_MAX` stay |
| `devices/device-gestures.mjs:13-21` | `frameSpan` | moves: `span(...).through` grown by the frame margin, which stays |
| `devices/device-types.mjs:159-162` | content regions in a device's own frame | stays |
| `server/rest.js:14,645,655` | `LAYOUTS[name]`, `nearestAnchor` | moves: `nearest` on the unbounded grid of the named record; an unknown name refused (6.3) |
| `server/rest.js:663-665` | anchors over the node index range, both grids | moves: `pointOf` on the unbounded grid over the same range; the zone list kept (6.3) |
| `server/anchor.mjs:29,37,62-68,139-140` | free anchors; the walk | moves: `inView` on the bounded node grid, `next` for each step; the free and occupancy decisions stay |
| `server/anchor.mjs:75-84,112-113,145` | nearest free anchor; zone filter | stays (occupancy policy over `snap-grid`'s positions) |
| `server/store.js:12,17` | `NODE_EXT` imported, unused | plumbing: deleted |
| `cli/verbs.mjs:1898,2096,2264-2267` | literal `30`, `60` | out of H26.1, registered (section 5) |
| `network/appearance.mjs:239`, `groups/group-painter.mjs:23-26` | the dot's radius; group hulls | stays |
