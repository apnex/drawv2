# H26.0, part 1 -- `snap-grid`, and what every component shares

The first piece of H26's design of record (`dev/DECISIONS.md` H26-3).\
It designs `snap-grid`, the smallest of the four components H26-1 named, and the parts all four share: the repository template, the vocabulary check, the gate and the release workflow, how draw depends on a release, and how draw's pages load it.\
The other three components and the gesture tester's scope are later pieces, each brought to the director on its own.

**Standing:** a design under review; nothing in it is built until the director ratifies it.\
Written 2026-10-19 at `561a2df`.

---

## 1. What this decides, and what it does not

It decides:
- `snap-grid`'s one duty, its vocabulary and its contract, precisely enough that an agent other than its author could build it from section 3 alone;
- the invariants its tests must hold, and the acceptance tests for draw's move onto it (H26.1);
- what every component repository holds, how it is checked, how a release is made, and how draw takes one in (section 7).

It does not decide:
- `input-binding`, `input-capture` or `vector-scene`, nor the gesture tester's scope (later pieces of H26.0);
- pan and zoom in draw (H26.6, which overturns decision 1 and is ruled when reached);
- any grid that is not square (B390: named, and proved possible in tests, not built).

Words this document uses in their usual drawv2 sense are marked as draw's; words `snap-grid` uses are defined in section 3.2 and are the only ones its source may use.

---

## 2. What draw does with grids today

Read from the code at `561a2df`.

**The arithmetic** lives in `kernel/geometry.mjs`, over the locked pitch of `kernel/spec.mjs` (`STD.pitch`, 60):
- `px`, `cellOf` -- the node grid with no offset (`geometry.mjs:7,12`);
- `LAYOUTS` -- two named lattices, `node` at offset 0 and `zone` at offset half a pitch (`:34-37`);
- `onLayout`, `snapLayout`, `cellOn`, `pxOn` -- one axis at a time: is a coordinate on the lattice, the nearest lattice coordinate, coordinate to index, index to coordinate (`:40-49`);
- `nearestAnchor`, `anchorAt` -- the two axes together, carrying both the index and the coordinate (`:59-67`);
- `spanExtent` -- the extent a block of several positions adds beyond one, `(cols - 1) * pitch` (`:108-111`).

**Which grids a diagram has** is the layouts plugin's: two stored layout records, each `{ pitch, offset, ext }` (`layouts/layout-table.mjs:21-24`), held to today's values by WD7.

**Where grid arithmetic is restated or used**, beyond the kernel:
- `app/src/snap.js` -- `clamped`, `snapNode`, `snapIn`: snap then clamp to an extent (`:25-34`, `:146-151`); `clampDelta` quantises a drag to the pitch (`:66-81`);
- `layouts/layout-canvas.mjs` -- `latticePoints`: every lattice point within an extent, row by row (`:25-35`);
- `zones/zone-gestures.mjs` -- `snapZone`, a restatement of `snapIn` (`:20-26`);
- `devices/device-gestures.mjs` -- `frameSpan`, the cells two points span (`:17-21`);
- `server/anchor.mjs`, `server/rest.js` -- the free anchors and the `nearest` route (`anchor.mjs:60-68`, `rest.js:655,665`);
- `product/kinds.mjs`, `zones/zone-kind.mjs` -- validation, one field at a time, through `onLayout` (`kinds.mjs:72,87-88`, `zone-kind.mjs:26,42-45`);
- `engine/relations.mjs`, `model/model.mjs`, `model/invariants.mjs` -- occupancy keyed by `cellOf`, injected at the composition root (`relations.mjs:18-22`).

**What draws a grid** is the layouts plugin's canvas part: a dot at each lattice point within the extent, the zone grid only under Shift (`layout-canvas.mjs:37-39`).

Three facts shape the design:
- every consumer that snaps also clamps to an extent, and every extent is itself on its lattice (900 and 480 on the node grid, 930 and 510 on the zone grid);
- a coordinate exactly halfway between two lattice coordinates goes to the greater, because `Math.round` does;
- `-0` is normalised to `0` wherever an index or coordinate is made (`+ 0`, `geometry.mjs:12,46`), so `-0` never becomes a second key.

---

## 3. `snap-grid`

### 3.1 Duty

Answer, for a grid declared as data, where its positions lie in a plane and which position lies nearest a point.

That is the whole duty.\
It does not also draw a grid, hold which grids an application has, decide what may sit at a position, keep anything between calls, or move anything -- each of those is the consumer's or another component's.

### 3.2 Vocabulary

These are the only nouns `snap-grid`'s source may use for what it handles.

| Word | Meaning |
|---|---|
| plane | the two-dimensional space a consumer's coordinates live in; `snap-grid` assumes nothing of which way its axes point |
| point | `{ x, y }`, two finite numbers in the plane |
| grid | a set of positions with a rule for where each lies, opened from a declaration |
| declaration | plain JSON data naming a grid's shape and its parameters |
| shape | the kind of rule a grid follows -- `square` is the one shipped; each shape defines its positions, its directions and its cells |
| position | a grid's own coordinates for one of its places -- `{ col, row }` on a square grid -- always integers |
| bounds | an optional box in the plane; a grid offers only the positions whose points lie inside it |
| cell | the part of the plane nearer to one position than to any other |
| region | a description of part of the plane, tagged by its kind -- `{ kind: 'rect', x, y, w, h }` on a square grid |
| view | the part of the plane being looked at, and its scale: `{ region, scale }`, `scale` being screen units per plane unit |
| stride | how many positions apart the positions offered for a view are, along each of the grid's directions |
| direction | a name for a step from one position to its neighbour, each shape naming its own |

### 3.3 Contract

One capability per row, in the form shape-check's contract uses.\
None requires another component's capability, and none brings a trait: `snap-grid` keeps nothing between calls, coordinates no actors and contains no model.

| Capability | Relation | What a consumer can depend on |
|---|---|---|
| `declared-grid` | provides | A declaration is opened into a grid, or refused with every problem it has, each naming where in the declaration it lies (SG1). |
| `nearest-grid-position` | provides | The position nearest a point, among those the grid offers (SG3). |
| `grid-position-point` | provides | The point any position lies at (SG4). |
| `exact-grid-position` | provides | The position a point lies exactly on, if the grid offers one there (SG5). |
| `grid-positions-in-view` | provides | The positions the grid offers within a view, thinned to a spacing on screen, in one order (SG6). |
| `next-grid-position` | provides | The neighbour of a position in a named direction, if the grid offers it (SG7). |
| `grid-position-span` | provides | The region a block of positions runs through, and the region their cells cover (SG8). |
| `grid-shape-conformance` | provides | A kit that judges whether a shape, shipped or a consumer's own, keeps every invariant of section 4 (SG9). |

**SG1 -- A declaration, opened or refused.**\
`openGrid(declaration, options?)` returns `{ ok: true, grid }` or `{ ok: false, problems }`.\
A square declaration is an object holding exactly `shape: 'square'`, `pitch`, `origin` and, optionally, `bounds`:
- `pitch` -- a finite number above 0, the distance between neighbouring positions on each axis;
- `origin` -- a point, the point of position `{ col: 0, row: 0 }`;
- `bounds` -- `{ min, max }`, two points with `min.x <= max.x` and `min.y <= max.y`, holding at least one position's point.

A problem is a record of exactly `pointer`, an RFC 6901 pointer into the declaration, and `problem`, one of `not-an-object`, `unknown-shape`, `unknown-property`, `missing-property`, `invalid-value` and `no-position-in-bounds`.\
Every problem is listed, ordered by pointer and then by problem, each compared by Unicode code point; a declaration that is not an object, or names no shape the grid knows, is that one problem alone.\
`options.shapes` adds shapes beyond `square` (SG9); a shape is named once, and a second shape of one name is refused by `openGrid` with `invalid-value` at `/shape`.\
A grid holds a frozen copy of its declaration as `grid.declaration`, and never changes.

**SG2 -- What the grid offers.**\
A grid with no bounds offers every position.\
A grid with bounds offers the positions whose points lie inside them, edges included.\
`nearest`, `positionAt`, `inView` and `next` answer only with positions the grid offers; `pointOf` and `span` compute for any position the caller names, offered or not, because they compute rather than choose.

**SG3 -- Nearest.**\
`grid.nearest(point)` returns the offered position whose point is nearest, or `null` for a point with a coordinate that is not a finite number.\
On a square grid, on each axis: the index is `Math.round((v - origin) / pitch)`, clamped to the least and greatest index the bounds hold on that axis, then `+ 0`.\
So a coordinate exactly halfway between two positions goes to the greater, and no index is ever `-0`.\
Per-axis rounding and clamping is exactly nearest on a square grid, because each cell is a square and the offered positions form a rectangle.

**SG4 -- Where a position lies.**\
`grid.pointOf(position)` returns its point.\
On a square grid: `{ x: col * pitch + origin.x + 0, y: row * pitch + origin.y + 0 }`.\
A position that is not an object of two integers is refused with a `TypeError` naming the function.

**SG5 -- Exactly on.**\
`grid.positionAt(point)` returns the offered position the point lies exactly on, or `null`.\
On a square grid, a coordinate is on the grid when `(v - origin) % pitch === 0` in IEEE 754 double arithmetic, which is draw's test (`geometry.mjs:40`); the index is then `(v - origin) / pitch + 0`.\
A grid whose pitch or origin cannot be represented exactly may judge a point off that a person would call on; a consumer with such a grid compares `nearest` and a distance of its own choosing.

**SG6 -- In view.**\
`grid.inView(view, options?)` returns `{ stride, positions }`, each entry `{ position, point }`.\
`view.region` must be a region of the grid's shape with finite edges, and `view.scale` a finite number above 0; anything else is refused with a `TypeError`.\
`options.minSpacing`, default 0, is the least distance on screen, in screen units, between neighbouring positions offered; `options.max`, default 10000, is the most positions returned.\
On a square grid:
- the stride is the least power of two, 1 or more, at which `pitch * scale * stride >= minSpacing`;
- a position is offered when its point lies in the region and the bounds, and both its indices are multiples of the stride -- `((i % stride) + stride) % stride === 0`, so negative indices thin as positive ones do;
- while more than `max` would be offered, the stride doubles;
- the positions are ordered by row and then by column, both ascending.

Because strides are powers of two counted from position `{ col: 0, row: 0 }`, the positions offered at one stride are a subset of those offered at half that stride: zooming out drops positions and never moves one.

**SG7 -- Next.**\
`grid.directions` lists the shape's direction names; a square grid's are `'-x'`, `'+x'`, `'-y'` and `'+y'`, each a step of one index on that axis.\
`grid.next(position, direction)` returns the neighbouring position the grid offers in that direction, or `null` when the grid does not offer it.\
A direction the grid does not list is refused with a `TypeError` naming it.

**SG8 -- Span.**\
`grid.span(from, to)` returns `{ through, covering }` for the block of positions between `from` and `to`, both included, in either order:
- `through` -- the smallest region holding every position's point;
- `covering` -- the smallest region holding every position's cell.

On a square grid, with `cols = |to.col - from.col| + 1` and `rows` alike, `through` is the rect from the least position's point with `w = (cols - 1) * pitch` and `h = (rows - 1) * pitch`, and `covering` is `through` grown by `pitch / 2` on every side.\
`through.w` is draw's `spanExtent(...).sw` (`geometry.mjs:108-111`); `covering` is the box a key of several units fills on a keyboard laid out on the same grid.

**SG9 -- Shapes are adapters, proved by a kit.**\
A shape is an object `{ name, open(declaration) }`, where `open` returns `{ ok: true, grid }` or `{ ok: false, problems }` and the grid offers `declaration`, `directions`, `nearest`, `pointOf`, `positionAt`, `inView`, `next` and `span` as SG2 to SG8 describe them.\
`checkGridShape(shape, cases)`, exported from `@apnex/snap-grid/conformance`, opens each case's declaration with the shape and judges every invariant of section 4 over the case's sample points and positions, returning the list of failures, each naming the invariant, the case and the values.\
`square` is proved by the kit in `snap-grid`'s own tests, and so is a minimal radial shape kept in its tests and never exported: positions `{ ring, slot }`, directions `'-ring'`, `'+ring'`, `'-slot'` and `'+slot'`, the slot wrapping.\
A consumer may write a shape of its own against this port and prove it with the kit; a shape that more than one consumer needs is adjusted into `snap-grid` (C0, "Adjustment over replacement"), never copied between them.

**Exports.**\
`@apnex/snap-grid` exports `openGrid` and `square`; `@apnex/snap-grid/conformance` exports `checkGridShape`.\
The package imports no other package and no module particular to one runtime, so the same files run in Node and in a browser.

### 3.4 Fit criteria

**Does my project want this at all?**
- More than one part of your system snaps to, draws or validates against the same grid, and they must agree to the last pixel.
- You are about to write `Math.round((v - offset) / pitch) * pitch + offset` -- especially if you have written it before.

**It is the wrong tool when:**

| You need | Reach elsewhere, because `snap-grid` is |
|---|---|
| grid lines or dots drawn | not a renderer -- it says where; the consumer draws |
| which grids an application has, stored or edited | not a store |
| whether something may sit at a position | not an authority over occupancy |
| freehand placement, or snapping to other things' edges | not a general snapping engine -- it knows only its grid |

### 3.5 Adjustment policy and edges

Internal and sovereign: a measured gap is recorded where both sides can see it, then resolved by adjusting `snap-grid` or by fracturing it if the gap reveals a second duty; never forked.

**Contains:** the `square` shape and the conformance kit.\
**Consumes:** nothing.\
**Consumed-by:** draw (H26.1), then the gesture tester (H26.5).

---

## 4. Invariants and acceptance tests

Each invariant is a check of the conformance kit (SG9) unless marked otherwise, and holds for every grid of every shape.

| # | Invariant |
|---|---|
| I1 | For every position `p` the grid offers, `nearest(pointOf(p))` is `p` and `positionAt(pointOf(p))` is `p`. |
| I2 | `nearest(q)` is offered, and no offered position's point is strictly nearer to `q` than its point is. |
| I3 | `positionAt(q)` is `null` or a position whose point is exactly `q`. |
| I4 | Every position `inView` returns is offered and its point lies in the view's region; the stride is a power of two; at stride `2s` the positions are a subset of those at stride `s`; the order is the shape's. |
| I5 | `next(p, d)` is `null` or an offered position whose cell borders `p`'s; where `next(p, d)` is `n` and the shape pairs `d` with an opposite `e`, `next(n, e)` is `p`. |
| I6 | `span(a, b)` equals `span(b, a)`; `covering` contains `through` and every cell of the block; `span(p, p).through` is the point of `p` with no extent. |
| I7 | The same declaration and arguments always give the same answer, field for field and in the same order; no answer holds `-0`. |
| I8 | `openGrid` never throws for any JSON value, and refuses every declaration SG1 does not admit with the problems SG1 lists (`snap-grid`'s own tests, not the kit). |
| I9 | The source names no consumer's vocabulary (section 7.2), and imports no package and no runtime-specific module (`snap-grid`'s gate, not the kit). |
| I10 | The `square` shape reproduces draw's arithmetic for draw's two grids exactly: a corpus of cases -- points, positions and their answers, generated once from draw's `kernel/geometry.mjs` at `561a2df` and stated in `snap-grid` as square-grid cases with no word of draw's -- passes byte for byte (`snap-grid`'s own tests). |

**Acceptance for H26.1, draw on `snap-grid`:**
1. `snap-grid` is released from its repository by its CI, and draw's lockfile pins the release file by its hash.
2. Draw opens its grids from the layouts plugin's records through `openGrid`; every use listed in section 2 asks `snap-grid`, and `kernel/geometry.mjs` keeps no grid arithmetic -- `LAYOUTS`, `onLayout`, `snapLayout`, `cellOn`, `pxOn`, `nearestAnchor`, `anchorAt`, `px`, `cellOf` and `spanExtent` are gone, and so are `snapZone` and the clamp in `app/src/snap.js`.
3. Before the old functions are deleted, a test in draw runs old and new side by side over a sweep of points and positions for both grids and finds no difference; the corpus of I10 is what it generates.
4. Draw's full gate passes, the probe against production finds no pixel or style changed, and an independent verifier passes the move.
5. The product page, the lab page and the server load the one release: the page through the import map (section 7.6), the server by name.

---

## 5. What draw supplies, and what stays draw's

| Draw supplies | As |
|---|---|
| its two grids | a declaration each, made by the layouts plugin from a layout record: `{ shape: 'square', pitch, origin: { x: offset, y: offset }, bounds: { min: { x: -ext.x, y: -ext.y }, max: { x: ext.x, y: ext.y } } }` |
| the node grid with no bounds | for occupancy keys and validation, which must judge a point outside the extent as on or off the grid and leave the extent to the validator's own check (`model/surface.mjs`: the trust boundary is never delegated) |
| the region and scale it draws | `inView`, today the extent at scale 1 and stride 1, which reproduces `latticePoints` point for point and in order |

**Stays draw's,** because it is draw's content or another component's duty:
- what is drawn at a position -- the grid dot and its radius (`gridDot`), the layer, the zone grid's Shift;
- a group's hull (`groupHull`), a device's frame margin (`NODE_R`), and the cap on how many things fit (`anchorCellsWithin`);
- a drag's footprint clamp (`clampDelta`), which keeps every moved thing inside its extent and quantises by the grid's pitch, read from the declaration;
- the validator's field-by-field check, which asks `positionAt` of one axis with the other held at the origin's coordinate -- correct for the square shape, which is separable, and draw's to know.

---

## 6. How the parity is kept

Draw's grids must not move by a pixel.\
I10 holds `snap-grid` to draw's arithmetic from `snap-grid`'s side, as square-grid cases; acceptance step 3 holds draw's move from draw's side, old against new, before anything is deleted; the probe holds what is drawn.\
The three differences a careful reader will look for:
- **Bounds not on the lattice.** Draw clamps a snapped coordinate to its extent (`snap.js:25-27`), which would leave a point off the lattice if an extent were not on it; `snap-grid` clamps the index, so its answer is always a position. Draw's extents are all on their lattices, so the two agree for every point draw can see; I10's corpus includes points beyond every edge.
- **Ties.** Both round half toward the greater coordinate.
- **`-0`.** Both normalise it.

---

## 7. What every component shares

### 7.1 The repository

Each component is a public repository `apnex/<name>`, its package `@apnex/<name>` (H26-2), laid out after shape-check's (PC1):

| Path | What it holds |
|---|---|
| `README.md` | four journeys -- install, use, test, remove (S4, S9) |
| `VISION.md` | north star, why it exists, what it is and is not, what success means, authority -- ratified by the director |
| `CONTRACT.md` | the contract of record, carrying a mission-kit component entry's fields, its id unminted until it is admitted to the registry (C0): duty, contract, the numbered declarations, reference, fit criteria, adjustment policy, edges |
| its decision record | the component's own rulings, append-only, at the repository's `docs/` |
| `src/` | TypeScript, strict as shape-check's `tsconfig.json`, its `lib` limited to what the component needs -- `ES2022` alone for `snap-grid`, so no runtime's types reach its source |
| `test/` | `node:test` over the built `dist/`, `test/contract/` holding a file per capability |
| `export-map.json` | each export and the capabilities it serves, in zorg's form, so its capability checker can read the component |
| `tools/` | the vocabulary check and the export-map check -- no copy of mission-kit's style tools, which CI fetches (7.3) |
| `.github/workflows/` | `gate.yml` and `release.yml` (7.3, 7.4) |
| `LICENSE` | MIT |

`package.json` declares `"type": "module"`, `engines.node` `>=22` (H26-2), `exports` for each entry point with its types, `files` limited to `dist`, the docs and the licence, no runtime dependency, and TypeScript pinned as a development dependency.\
`dist/` is git-ignored: the built files exist only in a release.

### 7.2 The vocabulary check

Each component's gate fails when its `src/` -- code, strings and comments alike -- holds a word of a consumer's vocabulary, matched whole and in any case (P4: an import check cannot see a word in a comment).\
The words are held in the check's own list, outside `src/`, one list per consumer with its source:
- draw: `node`, `link`, `zone`, `group`, `pipe`, `waypoint`, `device`, `diagram`, `anchor`, `glyph`, `spawner`, `transit`, `layout`, `junction`, `bend`, `route`, `draw`, `drawv2`;
- the gesture tester: `keyboard`, `keycap`, `mouse`.

A consumer that takes the component in adds its list in the same change; a word a component genuinely needs that a consumer also uses is argued in the component's own decision record and allowed there by name, never by loosening the match.

### 7.3 The gate, and CI

`npm run gate` builds, runs the tests, runs the vocabulary check and the export-map check, and runs mission-kit's style checks over the repository's Markdown.\
The style checks are fetched, never copied, as draw fetches them (`.github/workflows/gate.yml`, ruled 2026-08-27): CI checks out `apnex/mission-kit` at HEAD and points `MISSION_KIT` at it; a developer's machine uses a sibling checkout.\
`gate.yml` runs the gate on every push and pull request, on Node 22 and Node 24.

### 7.4 A release

`release.yml` runs when a tag `v<semver>` is pushed:
1. it refuses a tag that differs from `package.json`'s version, or one that already has a release;
2. it runs the gate;
3. it packs the package with `npm pack` and writes the file's SHA-512;
4. it creates the GitHub release for the tag, attaching the package file and its SHA-512, its notes the tag's message.

A release is never replaced: a fix is a new version.\
Only CI makes a release; a package file made on a machine is never attached.

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
A new generator in draw's tools, `import-map.mjs`, reads draw's `@apnex/` dependencies and each installed package's `exports` and version, and writes one `<script type="importmap">` into a generated region of `app/index.html` and `lab/index.html`, as `tools/stylesheets.mjs` writes the stylesheets; `--check` runs in the gate.\
The region sits in `<head>` before every module script and every `modulepreload`, and is the page's only import map; the check refuses it anywhere else.

It maps each package name, and its subpaths, to a versioned address:
```json
{ "imports": {
  "@apnex/snap-grid": "/vendor/@apnex/snap-grid@0.1.0/index.js",
  "@apnex/snap-grid/": "/vendor/@apnex/snap-grid@0.1.0/"
} }
```

**A vendor mount.**\
Both servers serve `/vendor/@apnex/<name>@<version>/` from `node_modules/@apnex/<name>/dist/` through the one static responder (`server/static.mjs`), only for a package the map names and only at the version installed; any other name or version is a 404.\
The check also refuses a vendored file that imports a package the map does not name, so a component that grows a dependency cannot break the page unseen.

**The server and the tests** import a component by name from `node_modules`, as Node resolves it; the image installs it with `npm ci --omit=dev`, unchanged.

### 7.7 The architecture manifest

`tools/layers.mjs` gains `COMPONENTS`: each component draw consumes, the parts that may import it, and the ruling that admits it.\
`scan-layers` allows an import of a component only from those parts, and the generated architecture shows each part's components beside its consumes.\
The mission-kit register (`MISSION_KIT`, `ALIGNMENT`) moves `snap-grid` from a candidate to a component draw composes, under the `lattice` part, the reading date renewed.

---

## 8. Decisions owed

Each is offered with a recommendation; they may be ratified together, or one at a time.

| # | Decision | Recommendation, and why |
|---|---|---|
| D1 | A square declaration is `pitch`, `origin` as a point, and optional `bounds` -- one pitch for both axes | yes: it is what draw's grids and the keyboard need; a different pitch per axis waits for a consumer that needs it (P4) |
| D2 | Positions in each shape's own integer coordinates, and directions each shape names -- `-x`, `+x`, `-y`, `+y` on a square grid | yes: a radial grid has no x; names tied to the plane's axes say nothing of which way is up, which is the consumer's |
| D3 | `span` answers both `through` the points and `covering` the cells | yes: draw needs the first, the keyboard the second, and each is one line on a square grid |
| D4 | Thinning by powers of two counted from position 0 | yes: zooming out drops positions and never moves one, so a drawn grid does not shimmer |
| D5 | Shapes are adapters against a port, the conformance kit exported, a minimal radial shape in the tests only | yes: the contract cannot be square by accident, and nothing is shipped ahead of a consumer (B390) |
| D6 | `snap-grid` validates its declaration itself, depending on no package | yes: shape-check's dialect 1 has no numeric bounds, which `pitch > 0` and `min <= max` need (MISSION-KIT-ALIGNMENT, section 3), and a dependency would add a second file to every page's import map for one check |
| D7 | Component files on the vendor mount are kept by the browser for a year, marked immutable | yes: the address carries the version and a release is never replaced, so a kept file can never be the wrong one -- the condition H24.16-1 waited for (B398), met here for components; draw's own files stay `no-store` |
| D8 | Mission-kit's style checks fetched at HEAD in each component's CI, never copied | yes: draw's own ruling of 2026-08-27, kept for every repository draw's programme makes; shape-check copies them, a divergence recorded for zorg rather than followed |
| D9 | A release is a GitHub release from a CI run on a tag, never replaced; versions `0.x` until mission-kit admits the component | yes: H26-2's choice made exact; `0.x` says the contract may still move while only draw and the tester consume it |

---

## 9. Axiom alignment audit (M7)

**Identity.**\
H26.0 part 1, this document at its first draft; drawv2's traits as `MISSION-KIT-ALIGNMENT.md` section 5 reads them (stateful, multi-agent, autonomous); `snap-grid` itself holds no state, coordinates no actors and runs no model, so it brings no trait and the floor binds it.

**Verdict: pass, with guardrails.**

| Axiom | Weight | How the design stands |
|---|---|---|
| A3 Sovereign Composition | load-bearing | One duty, stated without "and"; consumed through a declared contract; the shape port is the one seam for extension, proved by a kit; draw composes it and keeps its content. |
| A8 Gated Recursive Integrity | load-bearing | The component's gate proves it before draw depends on it; draw's gate, the probe and a verifier prove the move; the lockfile's hash proves draw runs the file the release made. |
| A5 Perceptual Parity | load-bearing (for draw) | The page, the lab and the server run one implementation, so an agent and a tab can never disagree about where a grid point is -- where today draw's arithmetic is restated in four places. |
| A14 Compounding Learning | supporting | The parity corpus turns draw's arithmetic into a test any later shape or consumer runs; the B398 condition is met where it can be. |
| A4 Zero-Loss Knowledge | supporting | Rulings recorded in draw and in the component's own decision record; the corpus records the behaviour it replaces. |
| A9 Chaos-Validated Deployment | supporting | Releases immutable and hash-pinned; the vendor mount refuses a version not installed. |
| A1, A6, A7, A10, A13 | not materially implicated | `snap-grid` holds no state and no lifecycle; A13 is served by asking the decisions of section 8 together, with recommendations. |

**Tensions, and how they resolve.**
- P4's promotion by evidence against a shape port with one shipped shape: the port is the contract's own definition, needed to prove I1 to I7 are not square-specific; no second shape is shipped.
- Use before build (C0) against D6: shape-check was weighed and does not fit -- no numeric bounds in its dialect -- recorded rather than worked around.
- H24.16-1's `no-store` against D7: H24.16-1 refused keeping files whose address does not change with their content; D7 keeps only files whose address does.

**Guardrails for the build.**
- G1: no grid arithmetic stays in draw after H26.1 (acceptance step 2), held by a test in draw that finds none.
- G2: I10's corpus is generated from draw at `561a2df`, never hand-written, and is described without draw's words.
- G3: the vocabulary check runs on `src/` comments included, and its lists change only with a consumer.
- G4: no release is replaced; draw's lockfile is the only way a version reaches draw.
- G5: the import map is generated and checked; a page never names a component's address by hand.

**Closeout hooks.**\
H26.1's verifier re-checks G1 to G5 and acceptance steps 1 to 5; mission-kit admission is asked only after draw runs on the release (C0).

---

## 10. Reviews

Held to be filled from the multi-family review of this draft before it is put to the director.

---

## Appendix A -- `snap-grid`'s vision, the draft put to the director

**North star.**\
Let every part of every application agree, to the last unit, on where a grid's positions lie and which one a point belongs to.

**Why it exists.**\
Applications that place things on a grid restate the arithmetic -- snap here, validate there, draw somewhere else -- and the restatements drift: a point the canvas accepts is one the server refuses, or a dot is drawn a pixel off the place it marks.\
`snap-grid` holds the arithmetic once, for any shape of grid, so the parts that snap, validate and draw ask the same thing and get the same answer.

**What it is.**\
An embeddable library that opens a grid declared as data and answers six questions of it: the nearest position, where a position lies, whether a point is exactly on one, the positions in view, a position's neighbour, and the span of a block of positions.\
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
