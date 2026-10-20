# H26.0, part 1 -- `snap-grid`, and what every component shares

The first piece of H26's design of record (`dev/DECISIONS.md` H26-3).\
It designs `snap-grid`, the smallest of the four components H26-1 named, and the parts all four share: the repository template, the vocabulary check, the gate and the release workflow, how draw depends on a release, and how draw's pages load it.\
The other three components and the gesture tester's scope are later pieces, each brought to the director on its own.

**Standing:** ratified by the director on 2026-10-20, all ten decisions of section 8 as recommended and appendix A as `snap-grid`'s vision (`dev/DECISIONS.md` H26-4); built in H26.1.\
Revision 6, after four full multi-family readings and a confirming one (section 10); revision 1 was `0c59572`, revision 2 `fe8c25f`, revision 3 `2cbd907`, revision 4 `1d8a592`, revision 5 `6d4e877`.

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
| point | any object with number properties `x` and `y`, whatever else it holds -- a plain object, a `DOMPoint`, an entity |
| grid | a set of positions with a rule for where each lies, opened from a declaration |
| declaration | plain JSON data naming a grid's shape and its parameters |
| shape | the kind of rule a grid follows -- `square` is the one shipped |
| position | a grid's own integer coordinates for one of its places -- `{ col, row }` on a square grid |
| domain | the coordinates a shape computes exactly; a square grid's is every number of magnitude at most 2^50 (section 3.3, SG2) |
| representable | a position whose point lies in the shape's domain |
| offered | a representable position whose point lies within the grid's bounds, or any representable position when it has none |
| bounds | an optional box in the plane limiting which positions are offered |
| cell | the closed part of the plane nearer to one position than to any other position of the same shape with no bounds -- bounds never change a cell |
| block | the positions between two corner positions, both included |
| region | a closed part of the plane, tagged by kind; a `rect`, `{ kind: 'rect', x, y, w, h }` with `w` and `h` at least 0, is the kind every view and every `enclosing` takes, and the kind a square grid returns |
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
| `enclosing-grid-block` | provides | The smallest block of offered positions whose span runs through a rect, or the shape's answer where none does (SG9; decision D10). |
| `grid-shape-conformance` | provides | A kit that judges whether a shape keeps the invariants of section 4 over cases it is given (SG11). |

**Errors.**\
Every function validates its arguments before it computes.\
A point may be any object, of any prototype, with number properties `x` and `y`, because consumers pass what they hold -- draw passes `DOMPoint`s and its own entities; a position, a region, a view and an options argument are plain objects (SG1) holding the properties their forms name and no other, an options argument any of its properties or none.\
A malformed argument -- a point that is not an object with number `x` and `y`, a position not of the shape's form, a region or view not of section 3.2's form, an option out of range, a direction the grid does not list -- throws a `TypeError` whose message begins with the function's name.\
A well-formed position that is not representable, given to `pointOf` or `span`, throws a `RangeError`.\
A rect is malformed when `x`, `y`, `w` or `h` is not a number, or `w` or `h` is less than 0; its edges are `x`, `y`, `x + w` and `y + h` as binary64 computes them.\
A point with a coordinate that is a number but not finite, or outside the shape's domain, is well formed, and `nearest` and `positionAt` answer `null` for it; so is a rect with such an edge, and `enclosing` answers `null` for it.\
`openGrid` never throws for any declaration; it throws a `TypeError` only for malformed `options`.

**What is returned.**\
Every value `snap-grid` returns -- a grid, an open result, a problem list, a position, a point, a region, an `inView` answer, a span, a block, a failure list -- is made afresh by the call and frozen to its depth; nothing a caller passes is frozen, kept or changed.

**SG1 -- A declaration, opened or refused.**\
`openGrid(declaration, options?)` returns `{ ok: true, grid }` or `{ ok: false, problems }`.\
A problem is a record of exactly `pointer`, an RFC 6901 pointer into the declaration (`~` written `~0`, `/` written `~1`), and `problem`, one of the codes below.\
Problems are ordered by pointer and then by problem, each compared by UTF-16 code unit as JavaScript's `<` compares strings, and no record appears twice.

A plain object is a value whose prototype is `Object.prototype` or `null`.\
The checks run in this order; a check that fails at a pointer suppresses every check beneath that pointer, and none at a sibling's.\
A member is valid when no problem lies at its pointer or beneath it.

| Step | When | Problem, at pointer |
|---|---|---|
| 1 | the declaration is not a plain object | `not-an-object` at `""`, and nothing else |
| 2 | it has no own `shape` | `missing-property` at `/shape`, and nothing else |
| 3 | `shape` is not a string naming a shape the call knows | `unknown-shape` at `/shape`, and nothing else |
| 4 | an own property other than those the shape names | `unknown-property` at `/<name>`, one each |
| 5 | a required property is absent | `missing-property` at `/<name>` |
| 6 | a property is present and not of its form | the form's problem, below |
| 7 | steps 1 to 6 found no problem anywhere in the declaration, and the bounds offer no position | `no-position-in-bounds` at `/bounds` |

A square declaration names `shape: 'square'`, `pitch`, `origin` and, optionally, `bounds`:

| Property | Form | When not of the form |
|---|---|---|
| `pitch` | an integer from 1 to 2^50 | `invalid-value` at `/pitch` |
| `origin` | a plain object of exactly `x` and `y`, each an integer of magnitude at most 2^50 | `not-an-object` at `/origin`; else, per member, `unknown-property`, `missing-property` or `invalid-value` at `/origin/<name>` |
| `bounds` | a plain object of exactly `min` and `max`, each a point of the same form as `origin`, with `min.x <= max.x` and `min.y <= max.y` | as for `origin`, at `/bounds` and beneath it; when `min` and `max` are both valid and an axis is reversed, `invalid-value` at `/bounds/max/x` or `/bounds/max/y` |

`options.shapes` is an array of shapes (SG11) added to `square`; a shape that is not of SG11's form, or a name given twice or equal to `square`, makes `openGrid` throw a `TypeError`.\
`grid.declaration` is a recursively frozen copy, `-0` written `0`; the grid holds nothing else and never changes.

**SG2 -- The domain, exactness, and what the grid offers.**\
A square grid's domain is every number of magnitude at most 2^50, and every answer it gives is exact: each formula below is stated in real arithmetic, and is computed exactly for every input in the domain, so no answer needs a tolerance.\
Over integers, binary64 is exact already: the offered ranges, `pointOf` and `span` form only integers and half-integers below 2^52 in magnitude, and a quotient of two integers that size rounds onto the correct side of every integer and half-integer.\
Over a coordinate that is not an integer it is not: `Math.round((v - origin) / pitch)` rounds `v - origin` before it divides, and on the zone grid sends `v = -60 - 2^-47` to the position at -30 when the one at -90 is nearer.\
So `nearest`, `inView` and `enclosing` compute exactly; splitting `v` into its integer part and its fraction does it in binary64, as a prototype checked against an exact rational oracle over 300,000 points shows (kept outside the repository with the readings, section 10.2), and their tests hold the build to such an oracle.\
On each axis, the least and greatest offered index are `ceil((lo - origin) / pitch)` and `floor((hi - origin) / pitch)`, where `lo` and `hi` are the bounds on that axis, or -2^50 and 2^50 with no bounds; so every offered index is below 2^52 in magnitude.\
`nearest`, `positionAt`, `inView`, `next` and `enclosing` answer only with offered positions; `pointOf` and `span` compute for any representable position, because they compute rather than choose.\
`grid.offers(position)` says whether a well-formed position is offered.

**SG3 -- Nearest.**\
`grid.nearest(point)` returns the offered position whose point is nearest, or `null` for a coordinate that is not finite or lies outside the domain.\
On a square grid, on each axis: `(v - origin) / pitch` rounded to an integer, half toward the greater as `Math.round` rounds, computed exactly (SG2), clamped to the least and greatest offered index, then `+ 0`.\
So a coordinate exactly halfway between two positions goes to the greater, and no index is `-0`.\
Per-axis rounding and clamping is exactly nearest, because each cell is a square and the offered positions form a rectangle.

**SG4 -- Where a position lies.**\
`grid.pointOf(position)` returns its point; a square position is a plain object of exactly `col` and `row`, each a safe integer.\
On a square grid: `{ x: col * pitch + origin.x + 0, y: row * pitch + origin.y + 0 }`; a position whose point would lie outside the domain throws a `RangeError`, and one whose indices are not safe integers is malformed.

**SG5 -- Exactly on.**\
`grid.positionAt(point)` returns `n = grid.nearest(point)` when `grid.pointOf(n)` has exactly the point's `x` and `y` (`===`), and `null` otherwise.\
Defined through `nearest` and `pointOf`, it means the same for every shape, and needs no tolerance.\
Draw's test, `(v - origin) % pitch === 0` on each axis, agrees with it for every integer coordinate in the domain -- every coordinate draw's snapping makes -- on a grid with no bounds, and within the bounds on one with them; beyond the bounds `positionAt` answers `null` where draw's test, which knows no bounds, can pass.\
It disagrees where `v - origin` rounds: on the zone grid it accepts `x = -30 + 2^-48`, one rounding from a lattice point, which `positionAt` refuses; that is one of the differences D1 makes in draw (section 6.3).

**SG6 -- In view.**\
`grid.inView(view, options?)` returns a frozen `{ stride, positions }`, each entry a frozen `{ position, point }`.\
`view.region` is a rect with finite `x`, `y`, `w`, `h`, `w` and `h` at least 0, and `x + w`, `y + h` finite; `view.scale` is finite and above 0.\
`options.minSpacing`, default 0, is a finite number at least 0: the least distance on screen between neighbouring positions offered.\
`options.max`, default 10000, is an integer from 1 to 2^32 - 1, the longest array JavaScript allows: the most positions returned.\
On a square grid:
- an index range on each axis is the offered indices whose coordinate lies in the region, from `x` to `x + w` (or `y` to `y + h`) as binary64 computes them, edges included, computed exactly (SG2) -- possibly empty; the region's interval on each axis may first be intersected with the domain's, an empty intersection giving an empty range, which changes no answer, since no offered position lies beyond the domain;
- the stride is the least power of two `s`, from 1 to 2^52, at which `pitch * view.scale * s >= options.minSpacing` in binary64, or 2^52 when none is;
- a position is returned when both its indices are in range and divisible by the stride, tested as `i % s === 0`;
- the number returned is counted before anything is made, as the product of the two axes' counts, an axis counting 0 when its range is empty and otherwise `floor(hi / s) - ceil(lo / s) + 1`;
- while that number exceeds `options.max`, the stride doubles; at 2^52 only index 0 is divisible, every index being below 2^52 in magnitude, so this ends;
- an empty view returns no positions and the stride chosen for the spacing;
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

On a square grid, with the least corner's point `(x0, y0)`: `through` is `{ kind: 'rect', x: x0, y: y0, w: |to.col - from.col| * pitch, h: |to.row - from.row| * pitch }`, and `covering` is `through` grown by `pitch / 2` on every side.\
No count is formed on the way, so every value is an integer or a half-integer below 2^52 in magnitude, and exact.\
So `span(p, p).through` is the rect of `p`'s point with `w` and `h` 0, and `span(p, p).covering` is `p`'s cell.\
`grid.regionContains(region, point)` says whether a point lies in a region of the shape's kinds, edges included, a rect's edges being `x`, `y`, `x + w` and `y + h` as binary64 computes them.

**SG9 -- Enclosing.**\
`grid.enclosing(rect)` returns a block `{ from, to }` of offered positions, or `null`.\
Where some block's `through` contains the rect, it is the smallest such block; where none does, the shape's rule says what it answers; and it is `null` for a rect with an edge that is not finite or lies outside the domain (section 3.3).\
On a square grid, on each axis: `from` is `floor((min - origin) / pitch)` and `to` is `ceil((max - origin) / pitch)`, computed exactly (SG2), each clamped to the least and greatest offered index, then `+ 0`, where `min` and `max` are the rect's edges; so a rect reaching past the offered positions gives the block clamped to them, and a rect wholly beyond one side gives a block of the one edge position there.\
This is draw's zone wrap (`zones/zone-keys.mjs:28-33`) as a question any shape can answer.

**SG10 -- Exports.**\
`@apnex/snap-grid` exports `openGrid` and `square`; `@apnex/snap-grid/conformance` exports `checkGridShape`.\
The package imports no other package and no module particular to one runtime, so the same files run in Node and in a browser.

**SG11 -- Shapes are adapters, proved by a kit.**\
A shape is a frozen object `{ name, open }`, `name` a non-empty string and `open(declaration)` returning what `openGrid` returns for it, its grid offering everything SG2 to SG9 name: `declaration`, `directions`, `opposite`, `offers`, `nearest`, `pointOf`, `positionAt`, `inView`, `next`, `span`, `regionContains` and `enclosing`.\
Each shape defines its own domain and its own representable positions: a square grid's domain is every coordinate within 2^50, fraction or not, and its representable positions are those whose points lie in it, their indices reaching 2^51; a shape on a circle has points that are not integers; and `positionAt` means the same for both, because it is defined through `nearest` and `pointOf` (SG5).

`checkGridShape(shape, cases)` judges, over each case, the checks section 4 marks *kit* -- those that need nothing but the port and a rect, whose membership the kit computes itself -- and returns a frozen array of failures, empty when none.\
A case is `{ name, declaration, points, positions, views, blocks, rects }`: a declaration the shape admits, and the arguments to judge over -- points; representable positions; `{ view, options }` pairs; `[from, to]` pairs of representable positions; and rects that the `through` of some block of offered positions contains.\
A failure is `{ invariant, case, args, got }`: the invariant's number, as `'I1'`, the case's name, the arguments, and what the kit saw.\
The kit judges the cases in the array's order, and within a case the invariants in the order `open`, I1 to I8, each over the arguments the table below names, in the order the case gives them.\
It records one failure for each argument tuple that fails any of its invariant's checks, a call that throws failing its tuple and ending that tuple's checks.\
So, for a shape whose every answer depends only on its declaration and its arguments, two conforming kits list the same failures in the same order, with the same `invariant`, `case` and `args`; `got` is a diagnostic -- the answer that failed, or `{ thrown: <message> }` -- and its form is not part of the contract.\
A shape whose answers depend on how often or in what order it is asked is broken whatever a kit lists; a kit samples, and cannot always see it -- I7 catches what a repeated call shows -- so two kits, making their other calls in different orders, may list different failures for it, or one none.\
A declaration the shape refuses is the case's one failure, `{ invariant: 'open', case, args: [declaration], got: problems }`.

| Invariant | Judged over, in order | `args` |
|---|---|---|
| `open` | the case's declaration | `[declaration]` |
| I1 | each case position `offers` accepts | `[position]` |
| I2, I3 | each case point | `[point]` |
| I4 | each view pair; then each two view pairs, the earlier first, whose regions are equal and whose strides differ, `got` the first position of the greater stride's answer missing from the other's | `[view, options]`; `[pair, pair]` |
| I5 | the grid's directions, once; then each case position `offers` accepts, with each direction in the order of `directions` | `[]`; `[position, direction]` |
| I6 | each block; then each case position | `[from, to]`; `[position]` |
| I7 | a fixed schedule of calls, each made twice and the two answers compared field by field, each answer checked for `-0` and for being frozen: for each case point, `nearest` then `positionAt`; for each case position, `offers`, `pointOf`, then `next` in each direction in the order of `directions`; for each view pair, `inView`; for each block, `span`; for each rect, `enclosing` | `[name, ...arguments]` |
| I8 | each case rect | `[rect]` |

What the kit cannot check through the port -- that a nearest position is nearest among every position, that `inView` misses none and orders them as its shape says, that neighbours' cells share an edge, that a span is the smallest, that an enclosing block cannot shrink -- each shape proves in its own tests, against its formulas (section 4).

`square` is proved by the kit and by its own tests in `snap-grid`; so is `ring-test`, a shape in the tests alone, which exists to show that the port and the kit are not square by accident -- one index, two directions that wrap, points that are not integers, and regions that are not rects (appendix C).

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

Each invariant holds for every grid of every shape.\
*Kit* marks what `checkGridShape` judges through the port over a case's arguments (SG11); *shape* marks what each shape proves in its own tests, against its own formulas, because the port cannot show it; *`snap-grid`* and *gate* mark what only `snap-grid`'s tests or its gate hold.

| # | Invariant | Held by |
|---|---|---|
| I1 | For every case position `p` that `offers` accepts: `nearest(pointOf(p))` is `p`, and `positionAt(pointOf(p))` is `p`. | kit |
| I2 | `nearest(q)` is `null` or offered, and no offered position among the case's positions and the neighbours of `nearest(q)` is strictly nearer to `q`, nearness measured as `(q.x - p.x) ** 2 + (q.y - p.y) ** 2` in binary64 (kit). It is `null` exactly when a coordinate of `q` is not finite or lies outside the domain, and no offered position at all is nearer (shape). | kit, shape |
| I3 | `positionAt(q)` is `nearest(q)` when `pointOf(nearest(q))` has exactly `q`'s `x` and `y`, and `null` otherwise. | kit |
| I4 | Every entry `inView` returns has an offered position, its point is `pointOf` of that position, and the point lies in the view's rect; the stride is a power of two from 1 to 2^52; no more than `max` entries are returned; of two answers for one region, the one with the greater stride holds a subset of the other's positions (kit). No offered position in the rect at the stride is missed, the stride is the least the shape's rule allows, and the order is the shape's (shape). | kit, shape |
| I5 | `directions` is frozen, and each direction's `opposite` is among them; `opposite(opposite(d))` is `d`; `next(p, d)` is `null` or offered, and where it is `n`, `next(n, opposite(d))` is `p` (kit). A neighbour's cell shares an edge with the position's (shape). | kit, shape |
| I6 | `span(a, b)` equals `span(b, a)`; `through` holds the points of `a` and `b`; every case point in `through` is in `covering`; `span(p, p).covering` holds `p`'s point (kit). `through` and `covering` are the smallest regions of the shape's kinds holding the block's points and its cells (shape). | kit, shape |
| I7 | The same declaration and arguments always give the same answer, field for field and in the same order; no answer holds `-0`; every answer is frozen to its depth. | kit |
| I8 | `enclosing(rect)` is `null` or a block of offered positions; for a case rect, the block's `through` holds the rect's four corners and every case point in the rect (kit). No corner can move inward and keep that true, and the shape's rule decides a rect no block contains (shape). | kit, shape |
| I9 | `openGrid` never throws for any JSON value, and answers every declaration with exactly the problems SG1 gives, from a table of cases, escaped pointers and code-unit order among them. | `snap-grid` |
| I10 | `square` reproduces draw's arithmetic: a corpus of points, positions and answers, generated once from draw's `kernel/geometry.mjs`, `app/src/snap.js`, `layouts/layout-canvas.mjs` and `zones/zone-keys.mjs` at `0c59572` over coordinates in the domain, and stated as square-grid cases with no word of draw's, passes with `-0` told apart from `0` -- except at the points where draw's arithmetic is not exact, which the corpus lists apart, each with draw's answer and the exact one (D1, section 6.3). | `snap-grid` |
| I11 | The source names no consumer's vocabulary, and the built files import no package and no runtime-specific module or global (section 7.2). | gate |

The kit measures nearness in binary64 because it has no exact measure for an arbitrary shape.\
A square grid's exact answer never loses that comparison: its distance on each axis is no greater than any other position's, and rounding never reverses an order, so its computed distance is never the greater.

**Each rule's own tests,** in `snap-grid`'s `test/contract/`, one file per capability, beyond the kit:
- SG1: the refusal table of I9, every row of the validation tables, a problem beneath one member never suppressing its sibling's, step 7 skipped after any other problem, and `options.shapes` refused for each malformed form;
- SG2 and SG4: the offered range's endpoints on both signs, bounds off the lattice, `pointOf` of a representable position beyond the bounds and `offers` false for it, and the domain's edge and one unit past it, a `RangeError` there;
- SG3, SG6 and SG9: an exact rational oracle -- `BigInt` over each double's exact value -- over random and edge-targeted points, the counterexamples of section 10.2 among them: `v = -60 - 2^-47` on the zone grid, and translated origins near 2^50;
- SG3: ties toward the greater on both signs, clamping on every side, coordinates not finite or outside the domain;
- SG5: on and off for each sign, `-0`, one rounding from a lattice point, and draw's remainder test agreeing over I10's corpus;
- SG6: completeness against a search of every index in small views; the least stride for a spread of scales and spacings; `max` doubling the stride; empty and disjoint regions, the stride asserted as well as the positions; zero-size regions; negative indices at strides up to 2^52;
- SG7, SG8, SG9: every direction at every edge; spans in both orders and at the domain's corners; `regionContains` on each edge and just beyond it; enclosing of rects straddling, touching and beyond every edge;
- errors: each function refusing each malformed argument with the error and message section 3.3 names; a `DOMPoint`-like object and an entity accepted as points; every answer frozen to its depth, and no argument frozen.

**Acceptance for H26.1, draw on `snap-grid`:**
1. `snap-grid` is released from its repository by its CI, and draw's lockfile pins the release file by its hash.
2. Every site appendix B marks *moves* asks `snap-grid`, on the grid the row names; every site marked *stays* reads the pitch, origin and extent from a declaration, never from `STD.pitch`, `LAYOUTS` or a literal; every site marked *kept* keeps its behaviour exactly and cites its backlog row.
3. `kernel/geometry.mjs` no longer exports `px`, `cellOf`, `LAYOUTS`, `onLayout`, `snapLayout`, `cellOn`, `pxOn`, `nearestAnchor`, `anchorAt` or `spanExtent`; `app/src/snap.js` no longer holds `clamped` or `HALF`, and its `snapNode` and `snapIn` only ask `snap-grid`; `zones/zone-gestures.mjs` no longer holds `snapZone`; a test in draw finds none of them, and finds `Math.round`, `Math.floor` or `Math.ceil` over a pitch only at the sites appendix B marks *stays*.
4. Before anything is deleted, a test in draw runs each old function and its replacement side by side over a sweep of points and positions for both grids, bounded and unbounded, and finds no difference, `-0` told apart, beyond those section 6.3 lists as changed, each of which the sweep holds with both answers; I10's corpus is what it writes.
5. Draw's full gate passes; the probe against production, each side on its own dependencies, finds no pixel or style changed; the REST answers for `nearest` and `anchors` are byte-identical before and after for a sweep of queries, except those section 6.3 rules -- coordinates beyond the domain and an inherited name among them; placing a text box stores the same origin and span as before; every stored diagram on the lab and in production loads, none skipped; and an independent verifier passes the move.
6. The product page, the lab page, the server and the export load the one release: the pages through the import map (section 7.6), Node by name.

---

## 5. What draw supplies, and what stays draw's

**Draw opens four grids,** through two functions of the core's `lattice` part: `latticeGrids(record)` takes a record of the layouts plugin's form, `{ pitch, offset, ext }`, and returns the grid bounded by its extent and the grid with no bounds, refusing loudly, with its problems, at load; `nodeGridWithin(ext)` is `latticeGrids` of the node grid's own pitch and origin with the extent its caller gives.

| Grid | Declaration | Opened by | Used for |
|---|---|---|---|
| node, unbounded | `{ shape: 'square', pitch, origin: { x: 0, y: 0 } }`, the pitch `STD.pitch` | the lattice, as `NODE_GRID` | the relation index, field validation (lengths and positions), spans, the steps and the walk, the REST routes |
| node, bounded | the same with `bounds: { min: { x: -ext.x, y: -ext.y }, max: { x: ext.x, y: ext.y } }`, `ext` being `NODE_EXT` | `nodeGridWithin(NODE_EXT)`, by each part that needs it | canvas snapping; free anchors |
| zone, bounded | from the zone record, as the node | the layouts plugin, from its table, as `ZONE_GRIDS` | canvas snapping of zones, through the zone's place; the wrap; corner steps |
| zone, unbounded | the same with no `bounds` | the layouts plugin, as `ZONE_GRIDS` | field validation; the REST routes |

Where each is opened follows draw's layer rules and its parts' declared consumes, which revisions 2 and 3 broke (sections 10.2 and 10.3):
- only the `lattice` part imports `snap-grid` (section 7.7), and every other part consumes `lattice` already; `kernel/` and `model/` import nothing from each other (L3), so the kernel cannot read `NODE_EXT`, and a part that needs the bounded node grid -- the canvas, the placement part, the layouts plugin's anchor place -- opens it with `nodeGridWithin(NODE_EXT)`, one function over one declaration, each opening equal to the others;
- the layouts plugin builds its two records as today, the node's pitch and offset read from `NODE_GRID`'s declaration and the zone's offset -- half a pitch -- stated in its table rather than in the kernel, and opens the zone's two grids from its record at load;
- the canvas never imports `layouts/` (`tests/canvas-names-no-plugin.test.js`): each place keeps its `layout` name and its `ext` and gains its bounded grid -- the anchor's from `nodeGridWithin`, the zone's from `ZONE_GRIDS` -- `placesOf` refusing a place whose grid's bounds are not its `ext`; `snapIn` asks the place's grid, and `snapNode`, which has no place in hand, asks `nodeGridWithin(NODE_EXT)` through `app/src/snap.js`, as the palette and every gesture already call it;
- the REST routes look a name up in the layouts table and ask that name's grid with no bounds, `NODE_GRID` or the zone's, as today they ask the kernel's, reading no record; the drawn grid opens from the diagram's records, `latticeGrids(layoutNamed(model, name))`, as today it reads them.

A grid opened from the table and one opened from a diagram's record are the same grid, because WD7 holds every diagram's records to the table's values and the layouts kind refuses any other.\
So nothing is rebuilt when a diagram loads, and a relation index is attached to each model as today, the injected `cellOf` replaced by `NODE_GRID`'s `nearest`.\
The day a diagram may vary its grids, every caller that opens from the table must take its grids from the diagram instead: that is WD7's programmability, which H26.6's pan and zoom brings, and it fires B325.

The REST anchor list keeps its index range exactly -- the node extent's indices for both grids, through `pointOf` on the unbounded grid -- because that range is today's behaviour, defect or not (section 6.3).

**Stays draw's,** because it is draw's content or policy, reading the pitch and extents from a declaration:
- what is drawn at a position: the dot, its radius (`gridDot`), the layer, the zone grid's Shift;
- a drag's clamp and its quantisation by the pitch (`clampDelta`), and a multi-selection moving as one;
- a group's hull (`groupHull`), a device's frame margin, sockets placed in a device's own frame, and the cap on how many things fit (`anchorCellsWithin`);
- the nearest *free* anchor and the walk past occupied ones (`server/anchor.mjs:75-84,139`), which ask `snap-grid` for positions and decide occupancy themselves;
- speeds, ranges and limits counted in pitches (`engine/movers.mjs`, `engine/rules.mjs`, `devices/device-size.mjs`).

**Out of H26.1,** registered with its trigger: the CLI's own arithmetic over literal `30` and `60` (`cli/verbs.mjs:2096,2264-2267`), because the CLI imports no product module and installs with no package (SD1, B138) until OD-3 is designed for it (B402).

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
- **Fractions one rounding from an edge.** Draw rounds `v - origin` before it divides, and `snap-grid` is exact (SG2). They agree for every integer coordinate, and for every other one except a coordinate within one rounding of a cell's edge or a lattice point -- about 10^-14 at draw's scale -- where draw gives the farther position, or accepts a point off the lattice as on it (6.3).
- **Non-finite input, and beyond the domain.** `snapNode` passes `NaN` through and clamps `Infinity` to the edge; `nearest` answers `null`. No canvas caller and no validated field can pass either, or come near 2^50 -- pointer events and validated fields are finite and within the extent -- and the parity is stated for them only; the REST route can, and is ruled (6.3).

### 6.3 Defects the inventory found, and what H26.1 changes

H26.1 is an extraction: it keeps every behaviour of draw's, defects included, except those it changes below, each made by D1 or by section 5 and ruled with them.

**Kept, each registered for its own ruling:**
- the REST zone anchor list spans `x` -870 to 930 and `y` -450 to 510, 527 anchors, where the zone lattice within its extent has 576 (`server/rest.js:663-665`, measured; B399);
- the zone cap counts 527 places (`zones/zone-kind.mjs:55`, `model/surface.mjs:14`) where the zone lattice within its extent has 576 (B400);
- the CLI restates the pitch as literals (section 5; B402).

**Changed by H26.1:**
- a layout named by an inherited property answers 200 with nulls instead of 404 -- `GET .../layouts/constructor/nearest?x=0&y=0` answers `layout: "Object"`, measured (`server/rest.js:645`); looked up in the layouts table, an unknown name is refused 404 (section 5; B401, ruled with H26.1);
- a coordinate within one rounding of a cell's edge or a lattice point is decided exactly: on the zone grid a pointer at `x = -60 - 2^-47` snaps to -90, where draw snaps it to -30, and a zone stored at `x = -30 + 2^-48`, which draw's check accepts today, is refused, both measured; and the anchor walk from a reference off the lattice finds nothing, where today's float addition can round onto it -- from a node at `x = 1e-14` it finds `x = 180` -- though no stored node can be off the lattice, its fields being validated on it (D1);
- the REST `nearest` route answers a coordinate beyond 2^49 in magnitude 422 `bad-query`, as it answers one that is not finite: beyond 2^53 today's answer is garbled by its float arithmetic -- `x = 9007199254740991` gives `x = 9007199254741020` -- and near 2^50 the exact nearest position can lie outside the domain, where `nearest` clamps -- on the zone grid `x = 2^50` gives `x = 1125899906842650` today, which is exact, and would give `1125899906842590`; refusing beyond 2^49 leaves every accepted query a nearest position well inside the domain, so no accepted answer changes, all measured (D1).

---

## 7. What every component shares

### 7.1 The repository

Each component is a public repository `apnex/<name>`, its package `@apnex/<name>` (H26-2), laid out after shape-check's (PC1), with the differences named:

| Path | What it holds |
|---|---|
| `README.md` | four journeys -- install, use, test, remove (S4, S9) |
| `VISION.md` | north star, why it exists, what it is and is not, what success means, authority -- ratified by the director |
| `CONTRACT.md` | the contract of record, under the six headings a mission-kit component entry carries, in order -- Duty, Contract, Reference, Fit criteria, Adjustment policy, Edges (SC6), the vocabulary and the rules inside Contract -- its id unminted until mission-kit admits it (C0) |
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

**The runtime check** fails the gate when a built file of a component meant for every runtime imports a bare specifier or a `node:` module, or names `process`, `require`, `Buffer`, `window`, `document`, `self`, `global` or `globalThis`, or holds a dynamic `import(`, so the whole of a component's module graph loads with its first import; a component that needs one says why in its decision record.

### 7.3 The gate, and CI

`npm run gate` builds, runs the tests, the vocabulary, runtime and export-map checks, and mission-kit's style checks over the repository's Markdown.\
The style checks are fetched, never copied, as draw fetches them (its `.github/workflows/gate.yml`, ruled 2026-08-27): CI checks out `apnex/mission-kit` at HEAD and points `MISSION_KIT` at it; a developer's machine uses a sibling checkout.\
`gate.yml` runs the gate on every push and pull request, on Node 22 and Node 24, and then a **consumer test**: it packs the package, installs the file into an empty project with `--omit=dev`, imports every export by name in Node 22, and loads every export in headless Chrome through a static server and an import map made as section 7.6 makes draw's.

### 7.4 A release

`release.yml` runs when a tag `v<semver>` is pushed, one run at a time per repository, with `contents: write` -- the permission GitHub gives releases -- and nothing else:
1. it refuses a tag that differs from `package.json`'s version, or one that already has a published release, found by listing the repository's releases, since a draft is not found by its tag;
2. it runs the gate and the consumer test;
3. it packs the package and writes the file's SHA-512;
4. it creates a **draft** release, attaches the file and its SHA-512, downloads both back through the authenticated API -- a draft's public address answers 404 -- and compares them byte for byte with what it packed;
5. only then it publishes the draft.

A failed run leaves at most a draft, which the next run of the same tag deletes and remakes; a published release is never replaced, and a fix is a new version.\
Tags `v*` are protected so that only maintainers can push them, and the repository's release immutability setting is on where GitHub offers it (INFERRED available; checked when the first repository is made, and confirmed, section 11).\
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
It is registered as every generated page region is, in `PAGE_REGIONS` and `COPIES.generated`, so `scan-copies` neither calls its markers stray nor counts the lines the two pages share as a copy, and `tests/scan-copies.test.js`, which names the regions and their generators, is restated with it; the generator, as every tool, begins `#!/usr/bin/env node` and is executable, and its `--check` joins the gate's script, the generated gate region of `docs/ARCHITECTURE.md` regenerated with it.\
`scan-layers`' rule L6, which refuses every inline `<script>`, admits exactly this one: a `type="importmap"` script inside the generated region whose content the generator's `--check` holds; every other inline script is still refused.

**A vendor mount.**\
Both servers serve `/vendor/@apnex/<name>@<version>/<file>` from `node_modules/@apnex/<name>/dist/<file>`, only for a package the map names and only at the version installed; any other name or version is a 404, and the path is bounded as every mount is (`fileWithin`).\
One responder in `server/static.mjs` does it, and each server calls it in a line: it is no entry in either server's mounts, so `lab/` stays within its line budget (L8) and the test that every folder the lab mounts is copied into the image (H17 C5) is unchanged, the files coming from `npm ci` rather than a `COPY`.\
It sends the cache header D7 rules; every other file `sendFile` serves keeps `no-store`.\
The generator also refuses a vendored file that imports a package the map does not name.

**Node** -- the server, the export, the tests -- imports a component by name from `node_modules`; the export writes no import map, because it never runs in a browser.\
The image installs the component with `npm ci --omit=dev`, unchanged.

**Proved by:** a browser test that loads the product page and the lab page and finds every module request answered 200, the component's among them; the image job fetching a vendored file; and the probe, which serves each side with the real servers (`tools/probe/parity.mjs:100-101`).\
`tools/probe/measure.mjs` serves `app/` alone through Python and already cannot load the module graph; it measures only the page's chrome, and is left as it is.

**The probe, on each side's own dependencies.**\
`tools/probe/parity.mjs` links the root's `node_modules` into every worktree it serves (`:92`), which would run a revision pinned to one component version on another's files, and answer its page's map with a 404.\
H26.1 has it install a worktree's dependencies from that worktree's own lockfile whenever it differs from the root's, and assert on each side, before it measures, the version the page's map names and the server serves.

**A deploy in flight.**\
A page fetched from one revision, whose modules are asked of the next because a deploy cut over between, asks for the component version the page named, which the new revision does not hold: a 404, and a page that does not start until it is reloaded.\
Draw's own files have the same window today -- a page from one revision, its modules from the next -- so it is not new; it is registered with its trigger (B403), not closed, and a test of H26.1 shows what the page does in it (A9).

### 7.7 The architecture manifest

`tools/layers.mjs` gains `COMPONENTS`: each component draw consumes, the parts that may import it, and the ruling that admits it -- for `snap-grid`, the `lattice` part alone, every other part asking the grids the lattice and the layouts plugin open (section 5).\
`scan-layers` allows an import of a component only from those parts, resolving the package and its subpaths as it resolves `DEPENDENCIES` today, and the generated architecture shows each part's components beside its consumes.\
The records that name what H26.1 deletes change in the commit that deletes it: the deleted exports join `UNUSED_EXPORTS`' `retired` list and leave its `list`; `scan-dead`'s three allowances for `cellOn`, `pxOn` and `px` go, so none outlives its reason; `kernel/geometry.mjs`'s entry in the record of `tests/core-names-no-plugin.test.js` goes, the zone's offset having left the kernel; and every test that imports a deleted name follows its subject.\
The register of mission-kit's components in `tools/layers.mjs` gains `snap-grid` in `MISSION_KIT`, as a component draw composes, and `ALIGNMENT` aligns the `lattice` part to it, the reading date renewed; `docs/ARCHITECTURE.md` and `docs/ARCHITECTURE-TARGET.md` are regenerated in the same commit, and the target's authored text changed with them: its sentence "The anchored core composes no mission-kit component (A-0)" no longer true, and its justification chain citing the rulings `COMPONENTS` names, as it cites every ruling a part is fixed by.

---

## 8. Decisions owed

Each is offered with a recommendation; they may be ratified together, or one at a time.\
Ratified together, all ten as recommended, on 2026-10-20 (`dev/DECISIONS.md` H26-4).

| # | Decision | Recommendation, and why |
|---|---|---|
| D1 | A square declaration is an integer `pitch`, an integer `origin` and optional integer `bounds` -- one pitch for both axes, every value within 2^50 -- and every answer is exact | yes: draw's grids and the keyboard need nothing else; integers within 2^50 keep every intermediate value exact, and computing a fraction's rounding exactly costs a few lines, so `positionAt` needs no tolerance and the nearest position is the nearest. It changes draw where draw's float arithmetic is wrong -- within one rounding of a cell's edge or a lattice point -- and refuses REST queries beyond 2^49, where the domain's edge would otherwise move an answer (section 6.3); fractional or per-axis pitches wait for a consumer (P4) |
| D2 | Positions in each shape's own integer coordinates, and directions each shape names and pairs -- `-x`, `+x`, `-y`, `+y` on a square grid | yes: a radial grid has no x, and names tied to the axes say nothing of which way is up, which is the consumer's |
| D3 | `span` answers both `through` the points and `covering` the cells | yes: draw needs the first, the keyboard the second |
| D4 | Thinning by powers of two counted from position 0 | yes: zooming out drops positions and never moves one, so a drawn grid does not shimmer |
| D5 | Shapes are adapters against a port, the kit exported, a ring shape in the tests only | yes: the contract cannot be square by accident (appendix C), and nothing ships ahead of a consumer (B390) |
| D6 | `snap-grid` validates its own declaration, depending on no package | yes -- weighed against two alternatives: shape-check for structure plus local checks for the integer and order rules would give a consumer two forms of refusal, add a second package to every page's import map, and needs Node 24 where draw runs 22; an upstream dialect 2 in shape-check is shape-check's ruling, on zorg's timeline, and would leave the order rule local anyway. About sixty lines of validation is the smaller cost; the overlap is recorded as a finding for mission-kit's registry (C0) |
| D7 | Files on the vendor mount are kept by the browser for a year, marked immutable | yes, on two conditions it states: draw's own files and the page that holds the map stay `no-store`, so a page reached by Back or a restored session fetches a fresh map (H24.16-1's verification measured that it does); and draw imports components only statically, a test refusing a dynamic import of one, and a component's built files hold none either (the runtime check, 7.2), so the whole of a component's graph loads with the page and only a cold load in flight across a deploy can ask for a version the deploy removed -- the window draw's own files already have, registered (B403). An address that carries a version and a release that is never replaced mean a kept file is never the wrong one -- the condition B398 waited for, met here for components |
| D8 | Mission-kit's style checks fetched at HEAD in each component's CI, never copied | yes: draw's ruling of 2026-08-27; shape-check copies them, a divergence recorded for zorg rather than followed |
| D9 | A release is a CI run on a protected tag, drafted, verified and only then published, never replaced; versions `0.x` until mission-kit admits the component | yes: H26-2's choice made exact |
| D10 | A seventh question, `enclosing`: the smallest block of offered positions whose span runs through a region | yes: draw's zone wrap floors and ceils onto the zone lattice (`zones/zone-keys.mjs:28-33`), which none of the six questions answers; without it that rounding stays in draw, a copy of the mechanism the component exists to hold |

---

## 9. Axiom alignment audit (M7)

**Identity.**\
H26.0 part 1 at revision 5, audited in three layers, because the shared parts bring state the library does not:
- the library: `snap-grid` holds no state, coordinates no actors and runs no model, so it brings no trait and the floor binds it;
- the release process: tags, drafts and published releases, state held on GitHub;
- the consumer: draw, stateful, multi-agent and autonomous as `MISSION-KIT-ALIGNMENT.md` section 5 reads it, to which the design adds installed versions, browser caches and deploys.

**Verdict.**\
Revision 1 was `revise-before-implementation`: its contract left builders room to differ, its inventory missed sites, and its parity and deployment claims went beyond their evidence (section 10.1).\
Revision 2 was `revise-before-implementation` as well: its exactness was false near 2^53 and for fractions, its grids were opened where draw's layer rules forbid, and its deployment claims stopped short of a deploy in flight (section 10.2).\
Revision 3 was `revise-before-implementation` too: its test shape rejected its own points, its kit's failure list was not determined, a REST answer moved at the domain's edge unnamed, and the placement part was sent to an import its consumes forbid (section 10.3).\
Revision 4 was `revise-before-implementation` once more, its faults narrowed to the test shape's cells and enclosing, the kit's failure list, and a clamping clause revision 4 itself added (section 10.4).\
Revision 5 had a fifth reading, scoped to its changes, which found no fault in the square grid or in draw's side, and two in the test shape's cells and the kit's determinism claim, each answered in revision 6 by narrowing a claim rather than adding mechanism (section 10.5).\
Revision 6 is `pass, with guardrails`.

| Layer | Axiom | Weight | How the design stands |
|---|---|---|---|
| library | A3 Sovereign Composition | load-bearing | One duty, stated without "and"; consumed through a declared contract; the shape port is the one seam for extension; draw composes it through one part and keeps its content and policy, named site by site. |
| library | A8 Gated Recursive Integrity | load-bearing | Section 4 splits what the kit shows through the port from what each shape proves; the exact arithmetic is held to an oracle, not to a sample of draw's answers. |
| release | A8 Gated Recursive Integrity | load-bearing | The gate and the consumer test run before the draft; the download-and-compare runs before publishing; the lockfile's hash proves draw runs the file the release made. |
| release | A1 Sovereign State Transparency | supporting | A release's state -- draft or published -- is GitHub's and readable there; a failed run leaves a draft the next run replaces, never a published release changed. |
| release | A7 Resilient Agentic Operations | supporting | One run at a time per repository; an interrupted run leaves a draft; a fix is a new version (7.4). |
| consumer | A5 Perceptual Parity | load-bearing | The page, the lab and the server run one implementation; the grids they ask are declared per use and opened through the lattice's two functions alone (section 5), so where they differ they differ by declaration, not by drift. |
| consumer | A8 Gated Recursive Integrity | load-bearing | Draw's gate, the side-by-side test, the REST sweep, the probe with each side on its own dependencies, and a verifier prove the move; the behaviours it changes are named and ruled (6.3). |
| consumer | A9 Chaos-Validated Deployment | supporting | Tested, not assumed: a release run interrupted after drafting, a file whose hash differs (`npm ci` refuses it), a version the vendor mount does not hold (404), a page reached by Back and by a restored session across a deploy with the mixed cache policies D7 sets, and a cold load in flight across a deploy, whose 404 is registered (B403). |
| all | A14 Compounding Learning | supporting | The corpus and the oracle turn draw's arithmetic and its errors into tests any later shape or consumer runs; the inventory's defects are registered, not fixed in passing. |
| all | A4 Zero-Loss Knowledge | supporting | Rulings recorded in draw and in the component's own record; both readings kept whole outside the repository and every finding dispositioned here, with its reason. |
| all | A6, A10, A13 | not materially implicated | No seam between agents is designed here; A13 is served by asking section 8's decisions together, each with a recommendation. |

**Tensions, and how they resolve.**
- P4's promotion by evidence against a port with one shipped shape: the port is the contract's own definition, needed to prove the invariants are not square-specific; no second shape ships.
- Six questions ruled against a seventh: D10 asks it, with the site that needs it.
- Use before build (C0) against D6: weighed, with the costs named, and recorded as a finding rather than worked around.
- Exactness against parity: D1 makes `snap-grid` exact, and so changes draw where draw's arithmetic is wrong; each change is named, measured and ruled with D1, not hidden inside the parity claim.
- H24.16-1's `no-store` against D7: H24.16-1 refused keeping files whose address does not change with their content; D7 keeps only files whose address does, on conditions its tests prove.

**Guardrails for the build.**
- G1: every site of appendix B is dispositioned as its row says (acceptance steps 2 and 3), held by a test in draw.
- G2: I10's corpus is generated from draw at `0c59572`, never hand-written, and holds no word of draw's.
- G3: the vocabulary check runs on `src/` comments included, its lists outside the release, and draw runs it on what it installs.
- G4: no release is replaced; draw's lockfile is the only way a version reaches draw.
- G5: the import map is generated and checked, L6 admitting it alone; a page never names a component's address by hand.
- G6: H26.1 changes no behaviour except those section 6.3 names as changed, each ruled with it.
- G7: every grid is `NODE_GRID` or is opened through `latticeGrids` or `nodeGridWithin`, and only the `lattice` part imports `snap-grid` (sections 5 and 7.7).
- G8: the probe runs each side on its own lockfile's dependencies, and asserts each side's component version before it measures.

**Closeout hooks.**\
H26.1's verifier re-checks G1 to G8, acceptance steps 1 to 6, and A9's five tests; mission-kit admission is asked only after draw runs on the release (C0).

---

## 10. Reviews

### 10.1 Reading 1 -- 2026-10-20, of revision 1 at `0c59572`

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
| f:F5 | the remainder test misbehaves on negative coordinates | **Not changed.** JavaScript's `%` keeps the dividend's sign and `-0 === 0`, so the test is exact on integers of either sign; D1 made every declaration an integer. |
| f:F6 | `inView`'s meeting with the bounds, its order and its empty answer unspecified | **Answered by revision 2's SG6**, made for o:F10 to o:F12: offered indices in the region, by row then column, possibly none. |
| f:F10 | the vendor mount's routing undesigned | **Not changed then; answered in revision 3.** Revision 1 named the mount and its 404s; revision 3 puts it in `server/static.mjs` (7.6; a:F13 of reading 2). |
| f:F11 | the export needs Node to resolve the bare name | **Not changed.** Revision 1 already had the server and the export import by name from `node_modules` (7.6). |
| f:F14 | `span(p, p).through` described as a point, not a region | **Not changed.** Revision 1's formula gives the rect with `w` and `h` 0; revision 2 says so in words (SG8). |
| x:F1 | `nearest` and `positionAt` disagree with draw on half-integers | **Not changed.** `v = 30` gives index 1 and point 60 both ways; rounding the index and rounding the coordinate agree for every integer pitch and origin. |
| x:F2 | `inView`'s stride ambiguous and unlike `latticePoints` | **Not changed.** SG6 gave the stride's rule; at stride 1 over the extent it is `latticePoints`, which I10's corpus holds. |
| x:F3 | the bounds unlike draw's clamped snapping | **Not changed.** Clamping the index equals clamping the snapped coordinate when the extent is on its lattice, as every extent of draw's is (6.2). |
| x:F4 | spans inexact, and `spanExtent` missed | **Not changed.** `through`'s width was `(cols - 1) * pitch`, `spanExtent`'s formula; revision 3 forms it without the count (o:F2 of reading 2). |

### 10.2 Reading 2 -- 2026-10-20, of revision 2 at `fe8c25f`

Read as reading 1 was, by `gemini-4-argon` (`a`), `grok-4.20-non-reasoning` (`x`) and `gpt-6-astra` (`o`), the reading kept whole at `~/taceng/drawv2-eval-runs/h26-readings/reading-2/`, with the prototype of SG2's exact rounding beside it in `prototypes/`.\
It reported 43 findings.\
`o` verified the others', supporting 12 and refuting 16; `a` and `x` returned no verdicts, so `o`'s own 15 stand unverified by another family; every finding was read against the code here whatever its verdicts, and every counterexample was run.

| Findings | What they said | Disposition |
|---|---|---|
| o:F1, o:F2, a:F3, a:F4, o:F3, x:F2 | the offered ranges do not keep indices safe; float division breaks round trips and spans; the remainder claim fails inside the promised domain | **Fixed.** The domain is 2^50, where integer arithmetic is exact; a fraction's rounding is computed exactly and held to an oracle (SG2); spans form no count (SG8); the remainder claim is restated with its counterexample (SG5); the changes this makes in draw are named in 6.3 and decided with D1. |
| o:F9 | the REST route's answers change beyond the domain | **Fixed.** Named as a change, measured, decided with D1 (6.3); the REST sweep holds such queries (acceptance step 5). |
| a:F5, o:F4, x:F4 | an empty range is counted negative | **Fixed.** SG6 counts an empty axis 0 and gives an empty view the spacing's stride; the tests assert the stride. |
| a:F7, o:F5, x:F6 | the kit cannot check I2, I5, I6 or I8 | **Fixed.** Section 4 marks each invariant kit or shape; the kit judges only what the port and its own rect test can show, and each shape proves the rest in its tests (SG11). |
| o:F6 | the radial shape breaks the representability rule and is underspecified | **Fixed.** The domain and representability are each shape's; the radial shape is now `ring-test`, a single ring whose cells are exact wedges, specified whole in appendix C. |
| o:F7 | freezing is not one rule | **Fixed.** One rule: every value returned is made afresh and frozen to its depth, and nothing passed is frozen (3.3). |
| o:F8 | no tests for SG2 or SG4 | **Fixed.** Section 4's SG2 and SG4 tests, and the oracle tests. |
| a:F1 | SG1's suppression and step 7 are ambiguous | **Clarified.** `o` found SG1 determinate, as it was for siblings; step 7 after an unknown property was open. "Valid" is defined, and step 7 runs only when nothing else was found. |
| a:F2 | which argument forms are malformed | **Clarified.** `o` found SG4 determinate; a point may now be any object with number `x` and `y` -- draw passes `DOMPoint`s and entities -- and every other argument is a plain object of exactly its form's properties (3.3). |
| a:F6, x:F5 | enclosing beyond the edges, and what I8's "within" means | **Clarified.** SG9 states the collapse to an edge position; I8's kit check runs on case rects some block's `through` contains. |
| a:F8, o:F10, x:F7 | the four grids cannot all be opened from records, for callers with no model, within draw's layer rules | **Fixed.** Section 5: the lattice opens the unbounded node grid, the layouts plugin the other three from its table, places carry them to the canvas, and callers holding a diagram open from its records; WD7 makes them the same grid, and B325 fires when it stops. |
| a:F9, a:F17 | scanner records and tests that name the deleted exports | **Fixed.** Section 7.7 names each record that changes, in the commit that deletes. |
| a:F10, a:F11, a:F18, o:F11 | the anchor walk, the zone corner step, the relation index's form, the text box's counts | **Clarified** in appendix B: the walk steps on the unbounded grid and the free set decides; the corner condition is a shared column or row; keys and `atCell` keep their form; the text box's origin and counts come from positions and its frame from `span`. |
| a:F12, a:F13, a:F14 | the import map's region, the vendor mount's place and cache header, the lab's line budget, the image's mount test | **Fixed.** 7.6: the region registered with the page regions; one responder in `server/static.mjs`, which alone sends the vendor cache header; L8 and H17 C5 unchanged. |
| o:F13 | the probe runs a historical revision on today's dependencies | **Fixed.** Each worktree installs from its own lockfile, and the probe asserts each side's version (7.6, G8). |
| a:F15, o:F12, x:F8 | a cold load across a deploy asks for a version the deploy removed | **Accepted, not closed.** The window is real, and is draw's own today; D7 restated, the test named (A9), the window registered (B403). |
| a:F16 | the release permission, and finding a draft | **Clarified.** `contents: write`; drafts found by listing; downloads through the authenticated API (7.4). |
| a:F19 | the runtime check misses `self`, `global` and `globalThis` | **Fixed.** All three added (7.2); `o` held `globalThis` neutral, but a library for every runtime has no use for it. |
| a:F20 | `CONTRACT.md`'s headings | **Clarified.** SC6's six headings, in order (7.1). |
| o:F14 | the M7 audit left out the release process's and draw's state | **Fixed.** Section 9 audits three layers, and records revision 2's verdict as `revise-before-implementation`. |
| o:F15 | reading 1's rejected findings carried no reasons | **Fixed.** Section 10.1 gives each its reason. |
| x:F1 | SG1's order of unknown and missing | **Not changed**, as `o` found: SG1 orders unknown before missing. |
| x:F3 | SG5 to be limited to the node grid, and to grids without bounds | **Not changed** in revision 3, as `o` found for the zone grid; its objection about bounds was right, as reading 3 showed (o:F5 there), and revision 4 limits SG5's comparison to the bounds. |

### 10.3 Reading 3 -- 2026-10-20, of revision 3 at `2cbd907`

Read as before, by `a`, `x` and `o`, the two earlier readings and the prototype mounted for it, kept whole at `~/taceng/drawv2-eval-runs/h26-readings/reading-3/`.\
It reported 27 findings.\
`o` verified the others', supporting 6 and refuting 10; `a` and `x` returned no verdicts on `o`'s 11; every finding was read against the code here, and every counterexample was run.

| Findings | What they said | Disposition |
|---|---|---|
| a:F1, a:F2, o:F2, o:F3, o:F6, o:F7 | `ring-test`'s angle test rejects its own endpoints; the centre's tie is not slot 0; its cells exclude the centre; its stride does not keep the spacing round the ring; its enclosing holds rects with area | **Fixed.** Appendix C defines every region through the shape's own `nearest` and `positionAt`, its stride by the least distance among the positions returned, and its enclosing for zero-size rects alone; the claim about the centre is gone. `o` refuted a:F1's numbers, but o:F2 found the same fault with its own. |
| a:F4 | a rect's domain judged by its fields or by its edges | **Fixed.** By its edges, `x + w` and `y + h` as binary64 computes them; and a rect is malformed for a field that is not a number or a negative size (3.3). |
| a:F5, o:F11 | the kit's failure list is not determined | **Fixed.** SG11's table: what each invariant is judged over, its `args`, one failure per tuple, `got` from the first failing check, cases in the array's order. |
| o:F1 | REST answers move at the domain's edge, for integer queries inside it | **Fixed.** The REST route refuses queries beyond 2^49, so every accepted query's nearest position lies inside the domain and keeps today's answer; named in 6.3 and D1. |
| o:F4 | the placement part may not import the layouts plugin | **Fixed.** `nodeGridWithin(NODE_EXT)` in the lattice opens the bounded node grid for every part that needs it (section 5). |
| o:F10 | a missing record would change the REST routes' answers | **Fixed.** The REST routes ask the table's grids, as they ask the kernel's today, reading no record (section 5). |
| o:F5 | SG5's comparison with draw's test ignores bounds | **Fixed.** Limited to the bounds (SG5); x:F3's disposition in 10.2 corrected. |
| o:F8 | SG11 bounded square indices to 2^50 | **Fixed.** The domain bounds coordinates; indices reach 2^51 (SG11). |
| a:F6, a:F7, o:F9, a:F10 | places lose `layout` and `ext`; the palette has no place; the snap box needs the place's grid; the walk passes `null` to `next` | **Fixed** in section 5 and appendix B: places keep `layout` and `ext` beside their grid; `snapNode` asks `nodeGridWithin(NODE_EXT)` beneath its callers, the palette among them; the snap box stays draw's drawing; the walk finds nothing from an off-lattice reference, as today. |
| a:F8, a:F9 | the scan-copies test and the generated architecture; `snap-grid` is not in draw's register | **Fixed.** 7.6 and 7.7 name the test, the regenerated documents, and `MISSION_KIT` and `ALIGNMENT` gaining it. |
| a:F3 | `inView` over a region beyond the domain | **Clarified.** `o` found SG6 determinate; it now says an edge beyond the domain may be clamped first, which changes no answer. |
| a:F11 | the release workflow's API calls | **Not changed**, as `o` found: 7.4 states what the workflow must do, and prescribes no call that would fail. |
| x:F1, x:F2, x:F3, x:F4, x:F5 | the stride cap; `x + w` in binary64; enclosing beyond the bounds; I4's order; missed callers | **Not changed**, as `o` found: indices reach 2^51, so 2^52 holds; `x + w` is specified as binary64 computes it; SG9 states the clamping; I4's order is a shape check; no caller was named. |

### 10.4 Reading 4 -- 2026-10-20, of revision 4 at `1d8a592`

Read as before, by `a`, `x` and `o`, the three earlier readings and the prototype mounted for it, kept whole at `~/taceng/drawv2-eval-runs/h26-readings/reading-4/`.\
It reported 20 findings, against 27, 43 and 48 before; two touch the square grid's contract, both in SG6.\
`o` verified the others', supporting 4 and refuting 7; `a` and `x` returned no verdicts on `o`'s 9.

| Findings | What they said | Disposition |
|---|---|---|
| a:F1, o:F5 | `ring-test` refuses a rect whose positive size vanishes in its edges' arithmetic | **Fixed.** Its enclosing judges a rect by its computed edges (appendix C). |
| o:F1 | `ring-test`'s cells, made by `nearest`'s tie, are not closed and do not share edges | **Fixed.** A cell is the points no position is strictly nearer to, so a tie lies in both (appendix C). |
| o:F6 | `ring-test`'s spacing names no expression | **Fixed.** The expression is stated (appendix C). |
| a:F2, o:F2, x:F4 | the kit's failure list is still not determined: `got` for compound checks, and I7's calls | **Fixed.** I7 is a fixed schedule over the case's arguments; the failures, their order and their `invariant`, `case` and `args` are determined; `got` is declared a diagnostic, outside the contract (SG11). |
| o:F3 | case rects and positions a correct square grid fails | **Fixed.** Case rects lie in the `through` of a block of offered positions, and case positions and blocks are representable (SG11). |
| o:F4 | SG6's clamping clause can make a position appear | **Fixed.** The region is intersected with the domain, an empty intersection staying empty (SG6). |
| o:F7 | `max` allows an array longer than JavaScript allows | **Fixed.** `max` is at most 2^32 - 1 (SG6). |
| o:F8 | the walk from an off-lattice reference does not keep today's answer | **Fixed.** Parity is stated for references on the lattice, which every stored node is; the off-lattice case is listed as a change under D1 (6.3). |
| o:F9 | a component's own dynamic import escapes D7's condition | **Fixed.** The runtime check refuses a dynamic `import(` in a component's built files (7.2), and D7 states it. |
| a:F4 | the target architecture's authored text goes false | **Fixed.** 7.7 and appendix B name the sentence and the justification chain. |
| a:F6 | the relation index's option name | **Clarified** in appendix B: `nearest`, its absence refused naming it. |
| a:F3, a:F5 | L6's test copy lacks `node_modules`; `null` options and getters | **Not changed**, as `o` found: L6 checks the region's structure and the generator's `--check` its content, so neither reads installed packages in that test; options must be plain objects of valid values, which excludes `null` and present `undefined`. |
| x:F1, x:F2, x:F3, x:F5 | the stride cap; `x + w`; the rect's domain; missed callers | **Not changed**, as `o` found, each answered by revision 3 or 4. |

### 10.5 Reading 5 -- 2026-10-20, of revision 5 at `6d4e877`, confirming

A reading scoped to revision 5's changes and section 10.4's dispositions, by `a` and `o`, kept whole at `~/taceng/drawv2-eval-runs/h26-readings/reading-5/`.\
`a` verified every row of 10.4, ran the numerical claims, and found nothing; `o` reported two findings, which `a` did not verify.

| Findings | What they said | Disposition |
|---|---|---|
| o:F1 | `ring-test`'s cells, made by a rounded distance, are not the geometric cells its text claimed: a point the rounding ties is in two cells though exactly nearer one, and the centre with three slots is in one cell only | **Fixed** by narrowing: appendix C claims only what its definitions make true -- cells of the rounded distance, no centre tie, no shared edge -- and says the shape exists for the kit, not as a geometry. |
| o:F2 | a shape that answers differently on its fifth call makes two kits' failure lists differ, since only I7's calls are scheduled | **Fixed** by narrowing: the determinism SG11 promises is for shapes whose answers depend only on their arguments; a shape that is not is broken whatever a kit lists, and a kit, which samples, cannot always see it. Scheduling every call of every check was the alternative, and buys determinism only for shapes already broken. |

---

## 11. Settled at build

`apnex/snap-grid` was built from section 3 by an agent that had not drafted it, verified twice by others -- a static reading, then a run that sealed it -- and released as `v0.1.0` by its own CI (H26-5).\
Where section 3 was silent or open, the builder chose, the verifiers judged, and the recorder confirmed; each rule is stated in the component's `CONTRACT.md` and listed in its own decision record, D2.\
None changes a decision of section 8.

- **Arguments.** A point is a non-null value of type `object`, functions refused, its `x` and `y` read through getters; every other argument is read by descriptor, a getter never called; an error from a getter or a proxy is rethrown as the function's own `TypeError`.
- **Rects.** A rect is malformed unless `x`, `y`, `w` and `h` are numbers with `w` and `h` each at least 0, so `NaN` is refused; an infinite size is well formed, and `enclosing` answers `null` for its edge.
- **Options.** Omitted and `undefined` are the same; `null`, or a property present with the value `undefined`, is malformed.
- **Shapes.** A shape is a frozen plain object of exactly `name` and `open`; `openGrid`'s guarantees hold for `square` and for an added shape that keeps SG11, and the kit checks that `open` answers in SG1's form, frozen and fresh.
- **The kit.** I4's `args` are always `[view, options]`; `args` are copied one way, every point as `{ x, y }`; answers compare by value with `-0` equal to `0`, except under I7, which compares with `Object.is`, key order and prototype; a case position whose `offers` throws is not selected for I1 or I5, and I2 asks `offers` inside each point's tuple; `null` from `enclosing` for a case rect fails I8.
- **I10.** The corpus -- 8,947 cases that agree -- lists apart 680 points with every reason that applies: 60 where draw's float arithmetic is not exact, 24 where draw's answer lies outside the domain, and 598 rects wholly beyond one side, for which draw's wrap inverts its block where SG9 gives the edge position; SG9 is draw's wrap for every rect the wrap is given, a selection's bounds within the extent.
- **Checks.** The vocabulary check compares each identifier whole, split at case changes, underscores, hyphens and digits, and with a trailing `s` or `es` removed -- a word run together in lower case, as `zonegrid`, is not caught; the runtime check walks TypeScript's syntax tree.
- **Draw's move.** The side-by-side test of acceptance step 4 writes its own record of draw's old answers, since `snap-grid` was built first (H26-5) and its I10 corpus was taken from draw's code directly; acceptance step 3's allow-list also names the CLI's arithmetic (B402), held by a record rather than left unscanned.
- **Inputs nothing can produce.** Three behave differently from before, recorded here so that section 6.3 stays exhaustive for every input a pointer, a validated field or a stored diagram can produce: a zone resized from a fixed corner off the zone lattice or beyond the extent has that corner snapped first; a point that is not finite or lies outside the domain gives a box or a frame of `NaN` where it gave a clamped one; and such a point lies in no cell of the relation index, where every such point shared one.
- **The release.** GitHub's immutable releases are on, confirming section 7.4's inference, and tags `v*` are held by a ruleset that lets only an administrator create, move or delete one; the release workflow refuses a version outside `0.x` and attaches the very file its consumer test installed; a source map's `sources` name the inlined content, not files the release must hold.

---

## Appendix A -- `snap-grid`'s vision, the draft put to the director

Ratified by the director as written (H26-4); `snap-grid`'s `VISION.md` is made from it when its repository is.

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

From the inventory of `0c59572`: product code, and the records that name it; tests follow their subjects.\
*moves* -- asks `snap-grid` on the grid named; *stays* -- draw's policy, reading the pitch, origin and extent from a declaration; *kept* -- behaviour kept exactly, registered (6.3); *plumbing* -- a constant, import or injection that goes or is repointed.

| Site | Today | H26.1 |
|---|---|---|
| `kernel/geometry.mjs:7,12,34-67,108-111` | `px`, `cellOf`, `LAYOUTS`, `onLayout`, `snapLayout`, `cellOn`, `pxOn`, `nearestAnchor`, `anchorAt`, `spanExtent` | deleted; `latticeGrids`, `nodeGridWithin` and `NODE_GRID` added (section 5), the zone's offset leaving for the layouts table; `gridDot`, `groupHull` stay |
| `kernel/spec.mjs:10,36` | `pitch: 60`; `cell.ext`, unused | the pitch stays the layout table's source (WD7); `cell.ext` deleted |
| `layouts/layout-table.mjs`, `layout-records.mjs` | the records | plumbing: the table states the zone's offset and reads the node's pitch and offset from `NODE_GRID`; `ZONE_GRIDS` opens the zone's two grids from it at load; `layoutNamed` serves the drawn grid, which opens from a diagram's records |
| `layouts/layout-canvas.mjs:26-35,42` | `latticePoints`; the anchor's place | moves: `inView` on the bounded grid opened from the diagram's record, region the extent, scale 1; the anchor's place gains `nodeGridWithin(NODE_EXT)` beside its `layout` and `ext` |
| `app/src/snap.js:14-34,146-151` | `GAP`, `HALF`, `clamped`, `snapNode`, `snapIn` | moves: `snapIn` asks the place's grid, `snapNode` asks `nodeGridWithin(NODE_EXT)`, each `pointOf(nearest(pos))`; `HALF` and `clamped` deleted |
| `app/src/snap.js:66-94` | `clampDelta`, `snappedDelta` | stays (the clamp and its quantisation by the declared pitch); the base's snap moves |
| `app/src/snap.js:112-143` | `placesOf`, `gridsOf` | plumbing: a place keeps `layout` and `ext` and carries its grid, refused when it carries none or its grid's bounds are not its `ext`; `gridsOf` still matches by `layout` |
| `app/src/input.js` (`snapNode` x14, `snapIn` x5, `GAP` x4) | readouts, ghosts, stamps, boxes, waypoints, Ctrl+D step | unchanged at the call sites, `snapNode` and `snapIn` moving beneath them; the Ctrl+D step and readout deltas stay (lengths) |
| `app/src/commands.js:241` | nudge through `clampDelta` | stays (a multi-selection moves as one) |
| `app/src/palette.js:157` | `snapNode` | unchanged, `snapNode` moving beneath it |
| `app/src/compose-canvas.js:56,76`, `lab/src/root.js:93` | inject `cellOf`; crosshair `GAP` | moves: the relation index is given `NODE_GRID`'s `nearest`; the crosshair reads `NODE_GRID`'s pitch |
| `app/src/painter.js:44-48`, `app/src/tools.js:90` | the snap box, a pitch wide about the snapped point | stays: a drawing about a point on either grid, the pitch read from `NODE_GRID`'s declaration |
| `app/src/overlay.js:24` | `CANVAS`, `GAP` imported, unused | plumbing: deleted |
| `engine/relations.mjs:18-22,80`, `engine/store.mjs:11-12` | keys by `cellOf` | moves: the injected `cellOf` becomes `nearest`, the option named `nearest` and its absence refused naming it, so `engine/` still imports no kernel module; keys stay `col,row` strings and `atCell` stays `[col, row]` |
| `engine/movers.mjs:77`, `engine/rules.mjs:69`, `engine/spawners.mjs:71` | speeds, ranges, lengths in pitches (a literal `60` in spawners) | stays, reading the pitch from `NODE_GRID`'s declaration |
| `engine/spawn-runs.mjs:54` | `host.snap('node', ...)` | moves with `snapIn` |
| `model/surface.mjs:7,14` | `NODE_EXT`; `anchorCellsWithin` | stays; the zone cap kept (6.3) |
| `model/model.mjs:232-235`, `model/invariants.mjs:81-89` | occupancy by exact coordinates | stays (exact equality is the point) |
| `product/kinds.mjs:72,82,87-88` | `onLayout` per field; the cap | moves: `positionAt` on `NODE_GRID`, one axis with the other held at the origin; the extent check stays first; the cap stays |
| `zones/zone-kind.mjs:26,42-45,55` | `onLayout` for positions and lengths; the cap | moves: positions on `ZONE_GRIDS.unbounded`, lengths on `NODE_GRID` (origin 0, so a length is a coordinate); the extent check stays first; the cap kept (6.3) |
| `zones/zone-gestures.mjs:17-26,56-64` | `snapZone`; corner steps | moves: `nearest` on the bounded zone grid; where the snapped corner shares the fixed corner's column -- on the zone lattice, today's `< MIN_ZONE` -- it becomes `next(fixed, '+x')`, or `next(fixed, '-x')` where that is `null`, and the same for rows; `MIN_ZONE`, read nowhere else, goes |
| `zones/zone-keys.mjs:17-34` | the wrap's floor and ceiling | moves: `enclosing` on the bounded zone grid of the selection's bounds grown by half a pitch (D10); the growth and the one-cell minimum stay |
| `zones/zone-keys.mjs:43-47`, `zones/zone-painter.mjs:53` | resize by a pitch; the zone's place | stays (a length step); the place names the bounded zone grid |
| `devices/device-appearance.mjs:75,105-107,114-116,129-133` | spans of a device; sockets in its own frame | moves: `span` on `NODE_GRID`; sockets stay (positions in the device's own frame) |
| `devices/device-footprint.mjs:20-27,45-56` | footprints, outlines, sizes | moves: `span(...).through`, padded by draw's margins |
| `devices/device-fields.mjs:64-66`, `server/svg.mjs:170-172` | `spanExtent` restated | moves: `span(...).through` |
| `devices/device-size.mjs:22-24` | positions to the edge; the span count | the count to the edge moves: the column (or row) of `nearest` of the extent's corner less the device's, plus one, on `NODE_GRID`; the step and `SPAN_MAX` stay |
| `devices/device-gestures.mjs:13-21` | `frameSpan`: the frame, its origin and its counts | moves: the two snapped corners' positions on `NODE_GRID` give the origin, the least corner's point, and the counts, the index differences plus one; `span(...).through` grown by the frame margin, which stays, gives the frame |
| `devices/device-types.mjs:159-162` | content regions in a device's own frame | stays |
| `server/rest.js:14,645,655` | `LAYOUTS[name]`, `nearestAnchor` | moves: the name looked up in the layouts table, an unknown one refused 404 (6.3); `nearest` on that name's grid with no bounds, `NODE_GRID` or `ZONE_GRIDS.unbounded`; a coordinate beyond 2^49 refused 422 (6.3) |
| `server/rest.js:663-665` | anchors over the node index range, both grids | moves: `pointOf` on that name's grid with no bounds, over the same range; the zone list kept (6.3) |
| `server/anchor.mjs:29,37,62-68,139-140` | free anchors; the walk | moves: `inView` on `nodeGridWithin(NODE_EXT)`, the placement part consuming only `lattice`, each entry mapped back to today's `{ layout, cx, cy, x, y }`; the walk steps with `next` on `NODE_GRID` from `positionAt(ref)`, the free set deciding as today for every reference on the lattice, and finds nothing when `ref` is off it and `positionAt` is `null` (6.3); the free and occupancy decisions stay |
| `server/anchor.mjs:75-84,112-113,145` | nearest free anchor; zone filter | stays (occupancy policy over `snap-grid`'s positions) |
| `server/store.js:12,17` | `NODE_EXT` imported, unused | plumbing: deleted |
| `cli/verbs.mjs:1898,2096,2264-2267` | literal `30`, `60` | out of H26.1, registered (section 5; B402) |
| `network/appearance.mjs:239`, `groups/group-painter.mjs:23-26` | the dot's radius; group hulls | stays |
| `tools/layers.mjs` | `UNUSED_EXPORTS`, `MISSION_KIT`, `ALIGNMENT` | plumbing: `COMPONENTS` added; the deleted exports retired; `snap-grid` registered and aligned to `lattice` (7.7) |
| `tests/canvas-places.test.js`, `tests/layouts-canvas.test.js`, `tests/scan-copies.test.js` | the places' fields; the generated regions | restated: places carry grids; the import-map region joins the list (7.6) |
| `docs/ARCHITECTURE.md`, `docs/ARCHITECTURE-TARGET.md` | generated, and the target's authored text | regenerated with the manifest and the gate; the target's sentence on composing no component, and its justification chain, edited (7.6, 7.7) |
| `tools/scan-dead.mjs:55-57` | allowances for `cellOn`, `pxOn`, `px` | plumbing: deleted with their exports (7.7) |
| `tests/core-names-no-plugin.test.js:74-76` | `kernel/geometry.mjs`'s recorded count of 4 | plumbing: deleted, the zone's offset and the layout names having left the kernel (7.7) |

---

## Appendix C -- `ring-test`, the shape in the tests alone

A shape `snap-grid`'s tests open through `options.shapes`, never exported, to show that the port and the kit hold for a grid that is not square (D5).\
Its points are computed in binary64 by one expression, and every other answer -- its regions among them -- is defined through its own `nearest` and `positionAt`, so no two of its answers can disagree by a rounding; it proves the port, not geometry or precision.\
Revision 3 defined its regions by angles and radii, and the third reading showed them rejecting the shape's own points by a rounding (section 10.3).

- **Declaration:** `{ shape: 'ring-test', centre, radius, slots }`: `centre` of `origin`'s form with integers of magnitude at most 2^30, `radius` an integer from 1 to 2^30, and `slots` an integer from 3 to 64; refused as SG1 refuses, step 7 never applying.
- **Domain:** every point whose coordinates have magnitude at most 2^40.
- **Positions:** `{ slot }`, a plain object of exactly `slot`, a safe integer; representable and offered when `0 <= slot < slots`.
- **Points:** `pointOf({ slot })` is `{ x: centre.x + radius * Math.cos(a) + 0, y: centre.y + radius * Math.sin(a) + 0 }`, with `a = 2 * Math.PI * slot / slots`; `Math.cos` and `Math.sin` may differ in their last bit between engines, so the shape agrees with itself within one engine, which is where the kit runs it.
- **Nearest:** the offered position least distant from the point, the distance `(q.x - p.x) ** 2 + (q.y - p.y) ** 2` as the kit measures it, ties to the lower slot; `positionAt` is SG5's.
- **Directions:** `-slot` and `+slot`, each the other's opposite, a step of one slot, wrapping from `slots - 1` to 0 and back.
- **Regions:** a rect; `{ kind: 'ring-points', from, to }`, which holds a point when `positionAt` of it is a slot from `from` to `to`; and `{ kind: 'ring-cells', from, to }`, which holds a point in the domain when some slot from `from` to `to` has no offered slot strictly nearer to it, by Nearest's distance.
- **Cells:** a position's cell is the points in the domain no offered position is strictly nearer to, by Nearest's distance, `ring-cells` from its slot to its slot; a point that distance calls equally near two positions lies in both cells, and `nearest`'s tie to the lower slot chooses among them without making either smaller.\
  That distance is rounded, so these are the cells of a rounded distance, close to the geometric ones and not exactly them; `ring-test` exists for the kit's checks, not as a geometry, and of section 4's shape checks it proves those its definitions make true -- nearest among every position, completeness and order in view, smallest spans -- and claims no shared edge between cells.
- **Span:** a block runs from the lesser slot to the greater, never across slot 0; `through` is `ring-points` and `covering` is `ring-cells` over its slots, each the smallest region holding the block's points or its cells, by its definition.
- **In view:** the offered positions whose point lies in the view's rect, a position returned when `slot % s === 0`, ordered by slot; the stride `s` is the least power of two from 1 to 2^52 at which, for every two positions returned, `Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2) * view.scale >= options.minSpacing` over their points -- one position or none counting as far enough apart -- doubled while more than `options.max` would be returned; doubling only removes positions, so the least distance never falls and the least stride is well defined.
- **Enclosing:** a rect whose edges as binary64 computes them meet in one point -- `x + w === x` and `y + h === y`, whatever `w` and `h` are -- and whose point is a position's gives the block of that one position; every other rect in the domain gives `null`, since no block's `through`, a set of points, holds more than one point or a point that is no position's.
