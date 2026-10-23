# H26.0, part 4 -- `vector-scene`

The fourth piece of H26's design of record (`dev/DECISIONS.md` H26-3, as H26-5 and H26-9 amended it).\
It designs `vector-scene`, the component that shows an application's shapes: it holds them as data, in declared layers, under the application's keys, makes the platform show exactly what they describe, says which shape a platform element belongs to, and converts points between the screen and the application's coordinates.\
It builds on part 1 (`SNAP-GRID.md`), whose section 7 is settled and built three times, and on parts 2 and 3 (`INPUT-BINDING.md`, `INPUT-CAPTURE.md`), whose readings and builds settled how arguments are read, how a lifecycle rolls back and how a platform is touched; it states only where it differs, and cites rather than restates.\
H26-9 holds its contract to the target state draw adopts natively after it (board item H26.8): appendix B says what H26.4's adapter translates now and what H26.8 then retires.

**Standing:** a design under review, revision 1, drafted 2026-10-22; the code read is `f702102`'s, after H26.7 moved every plugin under `plugins/` and H26.3 moved draw onto `input-capture`; not ratified.

---

## 1. What this decides, and what it does not

It decides:
- `vector-scene`'s one duty, its vocabulary and its contract, precisely enough that an agent other than its author could build it from section 3 alone;
- what a shape is -- data in SVG's vocabulary, not an element and not a callback -- and who owns the platform's elements and their updates (D1 to D3);
- what lies under a point: the item a platform element belongs to, answered by the platform's own hit test, so draw's picking can stay exact (D4);
- layers as data, their order, and layers whose content the application draws itself (D5);
- the viewport now: conversions through the root's screen transform, with no view state until pan and zoom are designed (D6);
- that selection visuals, states and overlays are the application's shapes (D7);
- how H26.4 moves draw onto it -- what it translates, what it writes natively, what H26.8 retires -- which part imports it, and that the export draws through it in Node.js (D8, D9);
- the invariants and tests that hold it, the acceptance steps for H26.4, and every site that move touches (appendix B).

It does not decide:
- pan and zoom (H26.6): how the view moves, a grid layer told the visible area and the scale, culling what is out of view (B289), a diagram's own grids (B325) -- only that none of them needs a field of this contract changed;
- the gesture tester's scope (H26.5), beyond what its keys and mouse need of a scene;
- `input-capture`'s contract, ratified (H26-8) and built, whose `hit` and `toDrawing` this scene can serve;
- draw's content and policy -- what each kind looks like, the appearance pipeline's composition (D3 of the 2026-09-22 ruling), drawing order (F-d), which classes mean selected or hovered, the stylesheets, the export's serialization and styling -- each draw's;
- the editing gestures (B389) and draw's picks by selector, which stay draw's until H26.8.

---

## 2. What draw does with drawing today

Read from the code at `f702102`; appendix B lists every site, one row each.

### 2.1 The renderer

`app/src/renderer.js` (460 lines) reconciles the Model into the page's SVG layers through the parts' painters and appearances:
- **Layers by id** -- a painter names the layer it draws into, checked against the page with `svg.querySelector('#' + layer)` (`:101-114`); an appearance names its root's layer the same way (`:84-91`); the renderer keeps no layer of its own (`:128`).
- **An element per entity, keyed by its `id` attribute** -- found with `ownerDocument.getElementById` (`:447-449`); a put removes and draws afresh (`:331-339`), a set asks the painter to update the element in place or to re-render (`:342-367`), a delete removes it (`:244-264`, `:441-445`).
- **Painters and appearances are callbacks over a kit** -- `create(entity, kit) -> element` and `update(entity, element, kit)`, the kit holding `el`, `setAttrs`, `applyLook`, the layer and the model (`:376-382`); appearances compose by ranks into one `<g>` per anchor (`:388-425`); a link draws four sibling elements -- its path, head, leg and click twin (`plugins/network/link-painter.mjs:77-86`) -- moved and removed together (`:138`).
- **Stacking** -- a stacked layer keeps its items in drawing order, each moved by `insertBefore` after the first newer item (`:307-325`, `model/stacking.mjs:11-14`).
- **Session states** -- `selected`, `hover`, `armed` and each part's reflection are classes toggled on the entity's element (`:224-242`, `:451-459`) and re-applied to a fresh element (`:371-374`); modes and labels are classes on the root (`:156-160`, `:202-215`).
- **Readers of its elements** -- the reveal marks one (`plugins/simulation/reveal-painter.mjs:96`, `:116-117`, through `byId`, `:191-200`) and traces a link's path, measuring it, writing its inline style and forcing a layout between two states (`:98-111`), and the towers turn a glyph each animation frame (`plugins/simulation/mover-painter.mjs:318-345`, through `glyphOf`, `:178-181`).

### 2.2 The other drawers

- **Widgets** -- `app/src/painter.js` builds the crosshair (`:37-55`), the stamp ghost from a hand's preview, already data as `{ tag, attrs, children }` (`:58-80`), and the preview rect, line and path (`:82-106`), each into a layer element it is handed; Input, Tools and the palette hand them `#overlay` (`app/src/input.js:532`, `app/src/tools.js:21`, `app/src/palette.js:35`), the composition `#snaplayer` (`app/src/compose-canvas.js:76`).
- **The overlay** -- handles as rects with a dataset key (`app/src/overlay.js:145-167`), the datum in `#snaplayer` (`:122-133`), the shown grids as root classes (`:178-180`).
- **Grids** -- a circle per point into each grid's layer, redrawn on load (`app/src/grids.js:12-31`).
- **Pipes** -- the network's keyed painter writes `#pipes` directly with the page's `el` (`plugins/network/host.mjs:66-92`, handed at `app/src/main.js:84`).
- **Movers** -- the simulation draws packets and beams into `#movers` with the Web Animations API (`plugins/simulation/mover-painter.mjs:93-96`, `:237`, `:269`, layer handed at `app/src/main.js:107`).
- **The page's canvas** -- `tools/canvas-layout.mjs` writes into each page the root `<svg id="container">` with `CANVAS_VIEWBOX`, its ground `<rect id="canvas">` and the eleven layers of `CANVAS_LAYERS` (`product/canvas.mjs:59-66`; `app/index.html:143-158`, `lab/index.html:61-76`); the defs go into `#kdefs`, outside the root (`app/src/compose-canvas.js:51`).

### 2.3 What lies under a point

The browser hit-tests; draw reads the target.\
`input-capture` hands draw's adapter the event's target (`app/src/capture.js:84-93`), and `hitWith` (`app/src/pick.js:53-83`) names the hit from the target's class list, dataset and `closest` -- a handle by its dataset key, a backdrop passing a press through without its modifier, a mark by `data-select`.\
The browser's own rules decide the target: painted fill and stroke, `pointer-events`, and dashes -- the reason a link carries an invisible twin, its gaps filled (B268, `plugins/network/link-painter.mjs:21-29`).\
During a drag the gestures ask the Model what lies at the drawing point (`anchorAt`), not the page.

### 2.4 Coordinates and the view

The root's `viewBox` maps the drawing's -960 to 960 by -540 to 540 onto the element, letterboxed (decision 1: a fixed canvas, no pan or zoom).\
Screen to drawing is `new DOMPoint(x, y).matrixTransform(svg.getScreenCTM().inverse())` (`app/src/painter.js:29-32`), used by capture's adapter (`app/src/capture.js:89`) and the palette (`app/src/palette.js:150`, `:166`); the label editor goes the other way with the screen transform itself (`app/src/labeledit.js:59-61`), and reads its scale and a region's box (`:129`, `:138`).\
Every one of them follows any change to the `viewBox`, since the screen transform includes it.

### 2.5 The export

`server/svg.mjs` drives the same renderer in run mode over a headless tree of its own (`:38-113`), swapping `globalThis.document` so `painter.js`'s `el` builds into it (`:195-203`), then serializes each layer's elements, styled by the page's rules (`:115-161`, `:191-216`).\
So the renderer already runs in Node.js, through a fake platform.

### 2.6 What holds it

The renderer's tests build it over the harness's fake SVG (`tests/fixtures/client-harness.mjs:371-381`) in eleven files; the export's tests hold its bytes (`tests/svgexport.test.js`, `tests/svg-style.test.js`); the K8 test holds the booted page's layers, grid and entities (`tests/browser.test.js:1291-1306`); and the pixel probe compares a candidate with a baseline in Chrome, pixels in each mode, each served SVG, the favicon, the lab's boards and computed styles under every state, with no tolerance (`tools/probe/parity.mjs`).

### 2.7 What is mechanism

The generic mechanism is: layers in an order, an item per key holding sibling elements, bringing elements to a description, placing an item within its layer, which item an element belongs to, and converting points through the root.\
Draw's content and policy is: what each kind draws, the appearance pipeline's composition, drawing order, what classes mean, the stylesheets, the export's flattening and styling, the picks' selectors, and which layers exist (`CANVAS_LAYERS`).\
The renderer interleaves both: its layer lookups, element keying, stacking moves and DOM writes are mechanism; `compose`, `sigOf`, reflections and `byDrawingOrder` are draw's.

---

## 3. `vector-scene`

### 3.1 Duty

Show an application's shapes, held as data in declared layers under its keys, exactly as described, and say which shape a platform element belongs to and where a point lies.

That is the whole duty: one scene, kept equal to its description.\
It does not decide what anything looks like or means, find a shape by geometry, read a clock, animate, or style -- each is the application's or another component's.\
Panning and zooming the viewport, which H26-1 names in the duty, are held until pan and zoom are designed (D6).

### 3.2 Vocabulary

| Word | Meaning |
|---|---|
| platform | what shows elements and owns the root: a browser, or anything of the same shape |
| root | the platform's element the scene draws into, an `<svg>` in a browser; absent for a scene with no platform |
| layer | a declared, named place in the root, drawn back to front in declared order |
| scene layer | a layer whose content is the scene's items |
| foreign layer | a layer the scene creates and orders, whose content the application draws itself |
| shape | data describing one element: its tag, its attributes, and its text or its child shapes |
| item | the shapes held under one key in one scene layer, shown as sibling elements |
| key | the application's name for an item, unique within its layer |
| description | what the scene holds of an item: its shapes, as last put |
| path | the indices from an item's first list of shapes down to one shape |
| screen point | a point in the platform's screen units |
| point | a frozen record of finite numbers `x` and `y` |
| screen transform | the platform's affine map from the root's coordinates to the screen |

### 3.3 Contract

One capability per row; none requires another component's capability.\
A scene writes its items, reads them back and is relied on to show them, so `declared-scene` and `keyed-shapes` are stateful in T1's sense (section 9).

| Capability | Relation | Requires | What a consumer can depend on | Trait |
|---|---|---|---|---|
| `declared-scene` | provides | none | A scene opened from declared layers, on a root or with none, or refused with every problem; closed by removing exactly what it added (VS2 to VS4). | stateful |
| `keyed-shapes` | provides | none | Items of shapes put, replaced, moved and removed by key within a layer, the platform brought to show exactly the description, and the description read back as data (VS5 to VS8). | stateful |
| `shape-at-element` | provides | none | The item and path a platform element belongs to, or none -- so the platform's own hit test answers what lies under a point (VS9). | none |
| `screen-conversion` | provides | none | Where a screen point lies in the root's coordinates, and back, through the root's screen transform at the moment asked (VS10). | none |

**Errors.**\
`openScene` never throws while it reads and judges a declaration: it refuses with problems; it throws only an error a platform method threw while it created the layers, after removing every layer it made (VS3).\
A malformed argument to any other function throws a `TypeError` whose message begins with the function's name and a colon -- `put: ` -- before the scene's state is read; an error a getter or a trap threw while an argument is read is rethrown as that `TypeError`, the thrown value named by its `typeof` alone: a primitive as `String` writes it, an object as "an object", a function as "a function".\
A call the scene's state does not allow throws an `Error`, the base constructor, beginning with the function's name: a call on a closed or failed scene, a call made while the scene writes to the platform, a `before` naming no item of the layer, and a conversion or `layerElement` on a scene with no root, or with a root answering no screen transform.\
An error a platform method throws while the scene writes propagates unchanged and leaves the scene failed (VS7).\
A message's beginning is the contract and the rest is prose, as `input-binding` and `input-capture` settled.

**What is returned.**\
Every value the scene makes -- an open result, a problem list, a scene, its `layers`, an `items` answer, an `itemOf` answer, a point -- is made afresh by the call that first returns it and frozen to its depth.\
A description is the scene's own frozen copy, made when the item is put and returned by reference afterwards: every shape in it holds exactly `tag`, `attrs`, `text` and `children`, in that order, `text` `""` and `children` empty when not given, each attribute's value a string.\
Every record holds its properties in the order its form is written here and nothing else; an open result holds `ok`, then `scene` or `problems`; a scene is a frozen object of exactly `layers`, `put`, `remove`, `items`, `itemOf`, `layerElement`, `toDrawing`, `toScreen` and `close`.\
Every function the scene makes needs no receiver and reads no argument beyond those its form names; nothing the application passes is kept, frozen or changed, but the root and the elements it holds.

**VS1 -- What the scene touches of the platform.**\
The scene reaches the platform only through the root the application hands it, and touches exactly:
- of the root: `ownerDocument`, `appendChild` and `getScreenCTM`, each read once, as the scene opens (VS2), the function read being the one it calls, with the root as its receiver, every time;
- of the root's document: `createElementNS`, read once likewise, called with the document as its receiver, the SVG namespace `http://www.w3.org/2000/svg` and a tag;
- of each element it makes: `setAttribute`, `removeAttribute`, `appendChild`, `insertBefore` and `remove`, each called as that element's method when it is used, and its `textContent`, only ever written;
- of a screen transform the root answers: `inverse`, for `toDrawing` alone, and `a`, `b`, `c`, `d`, `e` and `f`, read in that order.

It reads no other member, reads nothing of an element it made, never writes inside a foreign layer, writes nothing on the root but the layers it appends, and names no global: no `window`, no `document`, no constructor of the platform's.\
So it cannot reach beyond the root it is given, and the same code runs over a browser's elements and over plain objects of their shape.

**VS2 -- How values are read.**\
These are the rules the first three components settled (`SNAP-GRID.md`, `INPUT-BINDING.md` and `INPUT-CAPTURE.md` section 11, each component's decision record, D2):
1. A declaration, a shape, an `attrs` record and a `place` are read as `input-binding` reads one (`INPUT-BINDING.md` section 3.3, IB2 rules 1 to 4 and 6): a plain object's own data properties by descriptor, read only where its own keys hold them, an accessor of no form, an inherited property absent, a symbol-named property ignored, a property present as `undefined` of no form, a key whose descriptor reads `undefined` absent, an array dense and of `Array.prototype` with no other own key; reading a value stops at the first reflection that refuses it, a reflection that throws refusing the value it was made on.
2. A declaration is read whole -- its prototype, its own keys, the descriptors of `root` and `layers`; then, when `root` holds an object, its `ownerDocument`, that document's `createElementNS`, the root's `appendChild` and `getScreenCTM`, each through ordinary property access, judged as it is read, the reading stopping at the first refused; then each layer in order -- its prototype, its own keys, the descriptors of `name`, `attrs` and `foreign` -- and every problem is reported (VS3).
3. Every other function reads its arguments once each, in their order, each judged as it is read, and throws at the first that is malformed, reading nothing after it: `remove` reads its layer and then its key, `items` and `layerElement` their one name, and `put` reads its layer, its key, its shapes -- the array, then each shape depth first: its prototype, its own keys, the descriptors of `tag`, `attrs`, `text` and `children`, then its `attrs` -- prototype, own keys, each own string-named key's descriptor in the order its own keys give them -- then its children in index order -- and last its `place`: its prototype, its own keys and the descriptor of `before`.
4. A point given to a conversion is judged by `typeof`, and its `x` and then its `y` are read through ordinary property access, both before either is judged, as `snap-grid` reads a point.
5. An object is a non-null value whose `typeof` is `'object'`, so a function never is one; `itemOf` judges its argument by `typeof` and identity alone, running no trap.
6. A getter or a trap the scene meets while reading is the application's code and may call the scene: the call takes effect at once, and the function reading its arguments reads the scene's state only after they are read and judged, as `input-binding`'s IB2 rule 9 has it.

**VS3 -- Opening and closing.**\
`openScene(declaration)` returns `{ ok: true, scene }` or `{ ok: false, problems }`.\
A declaration is a plain object holding `layers` and, optionally, `root`:
- `root`, an object whose `ownerDocument` is an object whose `createElementNS` is a function, and whose `appendChild` and `getScreenCTM` are functions;
- `layers`, a non-empty array of plain objects, each holding `name`, a non-empty string unique among them, and optionally `attrs`, an attribute record of VS5's form written on the layer's element, and `foreign`, a boolean, `false` when absent.

A problem is `{ pointer, problem }` as `input-binding`'s IB3 defines one, ordered by pointer and then by problem by UTF-16 code unit, no record twice:

| Step | When | Problem, at pointer |
|---|---|---|
| 1 | the declaration is not a plain object, or a reflection on it throws | `not-an-object` at `""`, and nothing else |
| 2 | an own property other than `root` and `layers`; `layers` absent | `unknown-property` at `/<name>`, one each; `missing-property` at `/layers` |
| 3 | `root` an accessor or not an object, or a member refused as VS2 rule 2 reads it | `invalid-value` at `/root` |
| 4 | `layers` not an array of VS2's form, or empty | `invalid-value` at `/layers` |
| 5 | a layer not a plain object; a property other than `name`, `attrs` and `foreign`; `name` absent | `not-an-object` at `/layers/<i>`; `unknown-property` or `missing-property` at `/layers/<i>/<name>` |
| 6 | `name` not a non-empty string; `attrs` not of VS5's attribute form; `foreign` not a boolean | `invalid-value` at `/layers/<i>/<name>`, an `attrs` record refused whole at `/layers/<i>/attrs` |
| 7 | among valid names, one equal to an earlier one | `duplicate-name` at the later one's `/layers/<i>/name` |

**The lifecycle,** each rule stated here once:
1. With a root, `openScene` calls no platform method until the declaration is judged; then, for each layer in order, it makes a `<g>`, sets the layer's attributes on it in order, and appends it to the root, after whatever the root already holds.
2. If a platform method throws while it does so, it calls `remove` on every layer element it made -- the one in progress first, which does nothing to an element the root never took -- and then the others in reverse of the order made, attempting each, and throws the error first thrown, unchanged; nothing is left in the root.
3. With no root it makes nothing; its scene holds and reads back data alone.
4. A scene is *open* until `close` is first called, *closed* from then on, and *failed* from the moment a platform method throws while it writes (VS7); every function but `close` throws Errors' `Error` once it is closed or failed, and while it writes to the platform -- `close` among them -- since it is not re-entrant there.
5. `close()`, on its first call, closes the scene, then calls `remove` on every layer element it made, in reverse of the order made, attempting each, and throws the first error a removal threw, unchanged, or returns `undefined`; every later call returns `undefined` and calls nothing; removing a layer removes every element the scene made beneath it.

So no element the scene made outlives a failed opening or a close unless a removal threw.

**VS4 -- Layers.**\
A scene layer holds items, back to front in the order VS6 places them; a foreign layer holds whatever the application draws into the element `layerElement(name)` answers, which the scene never writes beneath, reads or removes but as VS3 removes every layer.\
`layers` is a frozen copy of the declaration's layers, each `{ name, attrs, foreign }`.\
`layerElement(name)` answers a foreign layer's element; a name that is no foreign layer is malformed, and a scene with no root refuses.\
A function taking a layer takes the name of a scene layer; any other value, a foreign layer's name among them, is malformed.

**VS5 -- Shapes.**\
A shape is a plain object holding `tag`, and optionally `attrs`, and `text` or `children`, but not both, and nothing else:
- `tag`, a string of an ASCII letter followed by ASCII letters, digits and hyphens, the element's local name in the SVG namespace;
- `attrs`, an attribute record: a plain object whose every own string-named property is a data property whose name is an ASCII letter or underscore followed by ASCII letters, digits, underscores, periods and hyphens, not beginning with `on` in any case, and whose value is a string, or a finite number written as JavaScript's `String` writes it;
- `text`, a string, the element's text content;
- `children`, an array of VS2's form of shapes, the element's children in order.

An item's shapes are an array of at least one shape; shapes nest at most 32 deep, an item's own shapes at depth 1.\
So no attribute carries a namespace, no shape runs script through an attribute, and every element is an SVG element.

**VS6 -- Putting and removing.**\
`put(layer, key, shapes, place?)` makes `shapes` the description of the item `key` in `layer`, and returns `undefined`:
- `key` is a non-empty string; `place`, when given, is a plain object holding at most `before`, which is `null` or a non-empty string other than `key`;
- an item not in the layer is placed before the item `before` names, or last when `before` is `null` or `place` is absent;
- an item in the layer keeps its place when `place` holds no `before`, and is moved before the item `before` names, or last when `before` is `null`;
- a `before` naming no item of the layer throws Errors' `Error`, after the arguments are read and before anything changes.

`remove(layer, key)` takes the item out of the layer, its elements with it, and returns `undefined`; a key the layer does not hold changes nothing.\
`items(layer)` answers a frozen array of frozen `{ key, shapes }`, one per item, back to front, `shapes` its description.

**VS7 -- Bringing the platform to the description.**\
With a root, each put and removal makes exactly these platform calls, in this order, and reads nothing of the platform:
1. A shape's element is made by `createElementNS` with its tag; then each attribute set in order; then its text written to `textContent` when not `""`; then each child's element made the same way, depth first, and appended; and only then is it inserted where it goes.
2. A new item's elements are inserted, in order, before the first element of the item it is placed before, or appended to the layer.
3. A described item is brought from its old shapes to its new ones list by list -- its own shapes, and the children of every element kept -- position by position: where both lists hold a shape of the same tag the element is kept and patched; where the new list holds a shape and the old none, or one of another tag, a new element is made and inserted before the old element at that position, or, past the old list's end, appended to the parent element for a list of children, and for an item's own shapes inserted before the next item's first element, or appended to the layer when the item is last; and the old element, if any, removed; the old elements past the new list's end are removed.
4. An element is patched by setting each new attribute whose value differs from the old or which the old lacked, in the new order, and removing each old attribute the new lacks, in the old order; then its content: text to text, written when it differs; text to children, `""` written when the old text was not, then the children made and appended; children to text or to nothing, each old child removed, then the text written when not `""`; children to children, compared as in step 3.
5. An item moved has its elements inserted, in order, before the first element of the item named, or appended to the layer.
6. An item removed has each of its elements removed, in order.

So every element under a scene layer shows exactly its description, attributes in description order on an element made and an added attribute last on an element kept, as the platform orders them.\
The scene writes only what its descriptions differ by, so it neither reads nor restores what anything else writes on an element it made.\
If a platform method throws, the scene is failed, the error propagates unchanged, and what was written stays; only `close` is left.\
With no root, put and remove change the descriptions alone, as they would with one.\
For arguments whose reading runs no application code, the same sequence of calls gives the same platform calls and the same descriptions.

**VS8 -- Reading back.**\
`items` and `layers` are the scene's whole state but which elements it made, and an application can rebuild a scene from them alone; a scene with no root answers them as one with a root would.

**VS9 -- The shape at an element.**\
`itemOf(value)` answers a frozen `{ layer, key, path }` when `value` is an element the scene made for a shape of an item it holds, `path` a frozen array of the shape's indices from the item's own shapes down; and `null` for any other value -- a layer's element, a foreign layer's content, the root, an element the scene removed, anything the scene did not make.\
It reads nothing of `value`, so it runs no application code; given the target of a pointer event, it answers what the platform found under the point.

**VS10 -- Conversions.**\
`toDrawing(screen)` answers where a screen point lies in the root's coordinates, and `toScreen(point)` the reverse:
1. the point is read as VS2 rule 4 says;
2. the root's `getScreenCTM` is called, and an answer that is not an object is refused;
3. for `toDrawing`, the answer's `inverse` is called, and an answer that is not an object is refused;
4. `a`, `b`, `c`, `d`, `e` and `f` of the matrix are read, in that order;
5. the answer is the frozen point `{ x: a * x + c * y + e, y: b * x + d * y + f }`, each evaluated left to right in binary64.

That is the arithmetic of `DOMPoint`'s `matrixTransform` for a two-dimensional matrix, so a conversion answers exactly what `new DOMPoint(x, y).matrixTransform(matrix)` answers over the same matrix, and follows whatever the platform's screen transform includes -- the root's place on the screen, its `viewBox`, its letterboxing.

**VS11 -- Exports.**\
`@apnex/vector-scene` exports `openScene`, and nothing else; it has no subpath.\
It imports no package and no module particular to one runtime, names and declares no global, touches no platform object but those VS1 names, and reads no clock and no randomness and holds no timer, so it runs over a browser's elements and, where there is no browser, over plain objects of their shape or with no root at all.\
Its TypeScript declarations state the platform slice VS1 touches as its own structural types, so a browser's `<svg>` element is assignable as a root; a shape's properties are read-only.

### 3.4 Fit criteria

**Does my project want this at all?**
- An application draws its own content as SVG and keeps that drawing in step with its data as the data changes.
- The same drawing must also be produced where there is no browser, from the same code.
- Something must say which of its things a pointer landed on, by the platform's own hit test.

**It is the wrong tool when:**

| You need | Reach elsewhere, because `vector-scene` is |
|---|---|
| what an input means, or a pointer's events as facts | not an input layer: that is `input-binding` and `input-capture` |
| what a thing looks like, its styles or its state's meaning | not a theme: the application describes every attribute |
| a shape found by geometry, with no platform | not a geometry engine: it answers by the platform's elements (D4) |
| panning or zooming the view | not yet: held until pan and zoom are designed (D6) |
| animation run frame by frame, or a canvas or WebGL drawing | not an animator: draw it in a foreign layer (D5); a CSS animation is an attribute like any other (D12) |
| HTML elements | not a page builder: every shape is an SVG element |

### 3.5 Adjustment policy and edges

Internal and sovereign: a measured gap is recorded where both sides can see it, then resolved by adjusting `vector-scene` or by fracturing it if the gap reveals a second duty; never forked.

**Contains:** the layers, the descriptions, the bringing of the platform to them, the element-to-item map, the conversions.\
**Consumes:** nothing.\
**Consumed-by:** draw (H26.4), then the gesture tester (H26.5); named later, zorg's web canvas (zorg D31, D35).

The tester draws its keys and mouse as items, lights one by putting it again with another class, asks `itemOf` with `input-capture`'s target to know which key a pointer is over, and hands `toDrawing` to `input-capture` as its conversion.

**Reference,** as `CONTRACT.md` carries it (SC6): the repository `apnex/vector-scene` and its package `@apnex/vector-scene`, released only by its own CI; its one export, as `export-map.json` records; TypeScript in `src/`, built to `dist/`; the tests in `test/`, as section 4 names them; the gate's checks in `tools/` (section 7); and this design as its design of record.

---

## 4. Invariants and tests

There is no conformance kit (D10): nothing in `vector-scene` is a port another party implements.\
*`vector-scene`* marks what the component's own tests hold; *gate* what its gate holds; draw's own tests are the acceptance steps below.

| # | Invariant | Held by |
|---|---|---|
| I1 | `openScene` never throws while it judges a declaration, and answers every declaration with exactly VS3's problems, from a table of cases: present `undefined`, accessors, a phantom key, a revoked and a trapping `Proxy`, a function as the root, a root lacking each member in turn, each layer refusal, a duplicate name beside an invalid one. | `vector-scene` |
| I2 | A rooted scene's layers are made and appended in order with their attributes; a throw at each platform call of opening, before or after the root takes the layer, leaves the root as it was and throws that error; `close` removes every layer in reverse, attempting each when one throws, then throws the first; a second `close` calls nothing; every other function throws once closed or failed; a platform method re-entering the scene while it writes is refused. | `vector-scene` |
| I3 | The scene touches nothing of the platform outside VS1: with a recording root, document and made elements, an opening, puts that create, patch, move and replace, a removal, both conversions and `close` log exactly VS1's reads once each and VS7's calls in order, and no read of a made element. | `vector-scene` |
| I4 | Over generated sequences of puts, moves and removals on a rooted scene, after every call the elements under each scene layer, serialized with their attributes in order, equal the descriptions `items` answers, and each call made exactly VS7's platform calls, against a model of VS7 written apart. | `vector-scene` |
| I5 | Every reading of VS2 and VS5 from a table of arguments: each refusal at each place stopping the reading there, an accessor attribute refused with no getter run, a trap that calls the scene while a shape is read taking effect first, depth 32 accepted and 33 refused, an `on` attribute in any case refused, a number written as `String` writes it. | `vector-scene` |
| I6 | The same sequence on a scene with no root and on a rooted one gives equal `items` after every call. | `vector-scene` |
| I7 | `itemOf` answers every element made, at every depth, with its item and path, after patches and moves; and `null` for a layer element, a foreign layer's content, the root, a removed element, a primitive and a `Proxy`, whose traps never run. | `vector-scene` |
| I8 | Every returned value is fresh and frozen to its depth; a description is the very value `items` answers again; keys in their written order; no function needs a receiver. | `vector-scene` |
| I9 | Conversions compute VS10's arithmetic over recorded matrices, `-0` and extreme values among them, and refuse a point that is no object, holds a non-finite coordinate, or is read through a throwing getter; a root answering no screen transform, or a transform answering no inverse, is refused. | `vector-scene` |
| I10 | In headless Chrome, on an SVG root scaled and offset in its page: puts, patches, moves and removals leave each layer's elements serialized equal to `items`; a trusted press on a child shape, on an item's own shape, on the ground and in a foreign layer is mapped by `itemOf` of its target to that item and path, or `null`; `toDrawing` and `toScreen` equal `DOMPoint`'s `matrixTransform` over the root's screen transform for thousands of points; `close` leaves the root as found. Chrome is launched and torn down as `input-capture`'s I10 settled -- its process group killed, every wait bounded, a profile that cannot be removed a warning -- so the test can neither fail nor hang on teardown. | gate |
| I11 | A consumer compiled with `tsc --noEmit` under strict settings, with and without `exactOptionalPropertyTypes`, passes an `SVGSVGElement` as `root`, and lines that write a shape's property or give both `text` and `children` must fail to compile. | `vector-scene` |
| I12 | The source names no consumer's vocabulary and declares no global; the built files import no package, name no runtime global, no clock, timer or source of chance, and no route to `Function` (section 7). | gate |

**Each rule's own tests,** in `test/contract/`: one file per capability -- `declared-scene` (VS2 to VS4, I1, I2), `keyed-shapes` (VS5 to VS8, I3 to I6), `shape-at-element` (VS9, I7), `screen-conversion` (VS10, I9) -- beside `returned-values-and-errors.test.js`, `public-types.test.js` (I11) and I10's `test/browser/`; each reading order held by a `Proxy` that records each trap.

**The real-browser bar.**\
The component's I10 runs on every push in its gate; draw's real-browser tests and the pixel probe hold what draw draws, and the pixel probe is the arbiter of H26.4: it must find nothing, against production.

**Acceptance for H26.4, draw on `vector-scene`:**
1. `vector-scene` is released from its repository by its CI, and draw's lockfile pins the release file by its hash.
2. Every site appendix B marks *moves* or *native* goes through the scene, only the `renderer` part names `@apnex/vector-scene`, every site marked *stays* or *unchanged* is unchanged, and every site marked *translates* is the adapter appendix B names, retired by H26.8.
3. A new test, `vector-scene-move.test.js` in draw's `tests/`, finds that `app/src/renderer.js` writes no platform element, `app/src/painter.js` holds no `toCanvas` and no widget making elements, `app/src/overlay.js` and `app/src/grids.js` make no element, `server/svg.mjs` swaps no `document` and builds no tree of its own, and each page's canvas region holds no layer.
4. First, before anything is deleted, a test keeps today's renderer as a verbatim copy pinned by its SHA-256, as H26.3 kept today's capture, and runs it beside the adapter over every stored diagram and template, the parity board and the lab's boards, through what a page does -- a load, a put, a set and a delete of every kind, selections, hover and arming, each mode, labels, a reveal's mark and a tower's turn -- finding the layers' trees equal after every step, element for element and attribute for attribute in order; runs the export both ways over the same documents, finding it byte-identical; and replays the gesture corpus both ways, finding the overlay's, snap layer's and grids' trees equal after every step.
5. Draw's full gate passes: the gesture corpus replays byte-identical, the renderer's tests pass restated only to hand the scene, the export's tests, the K8 page test, the affordance tests, the browser tests, H14.12's restated to the animation (D12), and the matrix corpus's boards pass, and the gesture-sample probe finds its real gestures alike before and after.
6. The pixel probe against production, each side on its own dependencies, finds no pixel and no computed style changed in any mode, served SVG, favicon or lab board, and an independent verifier passes the move.
7. The product page and the lab page load the one release through the import map, and the server and the export load it by name, since the export draws through it (D8).

---

## 5. What draw supplies, and what stays draw's

**Draw declares its scene once,** where `composeCanvas` opens it (`app/src/compose-canvas.js`): the root `#container`, and `CANVAS_LAYERS` in order, each `{ name, attrs: { id: name } }`, `pipes` and `movers` foreign; the generated canvas region keeps the root, its `viewBox` and its ground, and holds no layer, the scene appending them after the ground (`tools/canvas-layout.mjs`).\
The export opens the same layers with no root (`server/svg.mjs`).

**H26.4 translates draw's painters through a live shadow** (`shadow.js`, new in `app/src/`): the renderer hands each painter and appearance an item's fragment of shadow nodes -- the export's headless node, moved there, answering `tagName` in SVG's own case as a browser does -- through the same kit, `el` and `setAttrs` building shadow nodes; each change to a shadow node marks its item, and the renderer puts every marked item at the end of its own call, or at once for a change made outside one, the reveal's mark and a tower's turn among them, through `byId` and `glyphOf`, which answer shadow nodes.\
Draw's drawing order, composition, reflections and states stay in the renderer, unchanged: `place` computes the item it goes before from `items` and puts it there; `elementOf` answers the item's own shadow node; `syncAll` removes every item it put; and an item whose shapes changed in structure -- a link's head gained or lost -- is removed and put afresh in its place, as a painter's insertion made fresh elements.\
So no painter or appearance changes, and no plugin but the reveal's trace; H26.8 retires the shadow when each describes its item to the scene directly.

**The reveal's trace is described** (D12), being the one write of a plugin's that no description carries as it is made today: measured, written as inline style, and armed by a forced layout.\
Its `show` writes on the link's shadow node `pathLength` 1 and a `style` naming a CSS animation, `link-trace`, for the ruled duration, its keyframes in the simulation's own sheet, `plugins/simulation/simulation.css` (H25.1); its `hide` removes both, so a link shown again traces again, as today, a link hiding at once since it is excluded from the fade (`app/canvas.css:104-106`).\
The export, a still picture, passes the keyframes over: `server/svg-style.mjs:70` refuses any at-rule today, and is taught to skip a `@keyframes` block, as `tools/copies.mjs:105` skips every at-rule.\
The ruled duration needs no length; the velocity mode, which nothing sets (`plugins/simulation/reveal-painter.mjs:42`), would measure the route by the kernel, as the movers do (`plugins/simulation/movers.mjs:78`).

**H26.4 writes draw's own drawers natively,** since they are draw's code and no plugin's interface:
- the crosshair, the stamp ghost and the preview rect, line and path (`app/src/painter.js`) put and remove items of the overlay and snap layers, the ghost's preview being already shapes;
- the overlay's handles are one item, removed and put afresh on each refresh so they land on top as today, and its datum one item (`app/src/overlay.js`);
- each grid is one item of its layer, put on each load (`app/src/grids.js`);
- `toDrawing` is the scene's for capture's adapter and the palette, and `toScreen` for the label editor, each the same arithmetic over the same screen transform, so `toCanvas` goes.

**The pipes and the movers draw into foreign layers,** their code unchanged, handed `layerElement('pipes')` and `layerElement('movers')`; H26.8 makes the pipes items, and the movers stay foreign, since they animate.

**What draw's picks read stays as it is:** `hitWith` reads the target the browser found, which is now an element the scene made, carrying the same attributes; `itemOf` waits for H26.8, when draw's picks name items rather than selectors.

A drafting prototype -- the component as section 3 states it, and draw's renderer translated onto it as above, in a copy of the tree (`~/taceng/drawv2-eval-runs/h26-readings/vs/drafting/`, `vector-scene.mjs` and `tree/`) -- writes trees equal to today's renderer's, attributes in order, over 460 steps of loads, puts, sets and deletes -- a link's head gained, turned and lost among them -- selections, states, modes, reveals, traces as D12 writes them, and turns across all 16 stored diagrams and templates, its scene's descriptions equal to what it wrote (`page-side-by-side.mjs`); draws the export byte-identical for all 16 through a scene with no root, the trace's keyframes in the simulation's sheet (`export-side-by-side.mjs`), and passes the export's 16 tests and the copies scan; in Chrome renders, maps trusted presses by `itemOf` and converts exactly (`chrome-scene.mjs`); and in Chrome traces a link as today's code does, 150 ms in and at the end, solid and dashed, and again after a hide, where two puts of a transition in one task trace nothing (`chrome-trace.mjs`); its lifecycle cases are `lifecycle.mjs` there.\
It does not cover the native widgets, grids and harness, which acceptance steps 4 and 5 hold at build.

**Where it is opened** follows draw's layer rules:
- only the `renderer` part imports `vector-scene` (`tools/layers.mjs` `COMPONENTS`, D9); `app/src/renderer.js` exports `openCanvasScene`, which opens a scene or throws naming its problems, as `kernel/input-rules.mjs` opens a session;
- `composeCanvas` (canvas, which consumes `renderer`) and the export (which consumes it by H2) call it; the canvas modules, the palette and the tools use the scene they are handed, a value, as Input uses `input-binding`'s session;
- `shadow.js` joins the renderer part, names no plugin's kind (`tests/canvas-names-no-plugin.test.js`), and reaches no DOM global (`tools/scan-writers.mjs`);
- G1 holds: `app/src/input.js` reads no DOM, its widgets taking the scene.

**The test harness** opens a scene over its fake root in `makeInput` and `makeRenderer`, finds the layers it appended for the tests that read them, and its fake elements gain any member VS1 names they lack; the renderer's tests pass the scene.

**Stays draw's,** because it is draw's content or policy:
- every painter, appearance, look, class and stylesheet; the appearance pipeline's composition; drawing order; reflections; what `selected`, `hover` and `armed` mean;
- the root, its `viewBox`, its ground and its classes -- modes, labels, shown grids -- and the defs in `#kdefs`;
- which layers exist and their order (`CANVAS_LAYERS`), and the export's flattening, styling and bounds;
- the picks (`app/src/pick.js`), the gestures' geometry (`anchorAt`), the label editor's scale and boxes, the palette and the movers' animation.

---

## 6. How the parity is kept

Draw's page must show what it showed, pixel for pixel, and its export must write what it wrote, byte for byte.

### 6.1 Four tests from three sides

The component's tests hold section 3 alone; acceptance step 4 holds old against new over every document and every kind of change draw makes; the gesture corpus, the renderer's and export's tests, the K8 test and the browser tests hold what draw does with the drawing; the pixel probe holds what is seen.

### 6.2 The differences a careful reader looks for

- **The layers made by the scene.** The page's markup holds the root, its `viewBox` and ground; the scene appends the eleven layers after the ground when the canvas is composed, with the ids they had, so the booted DOM is today's and the K8 test unchanged; before the modules run the root holds no layer, and draws nothing then either.
- **Changes put at a call's end.** A painter's change reaches the page when the renderer's call returns rather than at once; nothing runs between, no event, no frame, so nothing can see the difference.
- **Attributes written when they differ.** A painter's update rewrote every attribute of its look; the scene writes those whose values differ, so the page's elements end the same, and only a mutation observer, which draw has none of, could count the writes.
- **Element identity.** A put afresh makes new elements, as a re-render did; an update keeps them, as a painter's update did; where an update's structure changes, the adapter puts the item afresh, so a link gaining a head makes its elements anew where the painter inserted one -- seen only by a holder of the old element, which nothing in draw is.
- **The conversions.** The scene's arithmetic is `DOMPoint`'s over the same matrix: equal under `Object.is` for 120,042 points over six window sizes, `-0` and extremes among them (`chrome-conversion.mjs`), and 10,000 more both ways (`chrome-scene.mjs`); Chrome's `createSVGPoint` answers a float32 point, different in nearly every case, which is why the scene computes rather than asks it.
- **The reveal's trace.** Today's moves a dash the path's measured length long; D12's moves a dash normalised to 1 by `pathLength`, so its computed dash reads `1` where it read the length, and the same pixels show, equal in Chrome 150 ms into the trace and at its end for a solid link and a dashed one (`chrome-trace.mjs`); H14.12's browser test, which read the transition, is restated to read the animation; and a written `style` attribute, which a Content-Security-Policy without `'unsafe-inline'` would refuse where an inline style set by script passes, meets none, the page setting no policy and the served SVG's (`server/app.js:285`) holding no reveal.
- **The export.** It reads the scene's descriptions where it walked its own tree, and swaps no `document`; byte-identical for every stored document.
- **Lookups by id.** The renderer finds an entity's element by its item where it asked `getElementById`; the label editor still asks the document, and finds the element the scene made, with the same id.

### 6.3 Defects the inventory found, and what H26.4 changes

H26.4 is an extraction: it changes nothing any input of draw's pages produces but how the reveal's trace is made, which shows alike (6.2), and keeps every behaviour, defects included.

**Inputs nothing in draw produces, which now behave differently** -- listed so that this section is exhaustive for every input a page, a test, a document or a composition can produce:
- an attribute whose name is not of VS5's form -- a namespace prefix, a character outside it, a leading `on` -- or whose value is neither a string nor a finite number, is refused when put, where today `setAttribute` wrote it, or threw for an invalid name; `NaN` was written `"NaN"`; draw's painters write 31 attribute names, none refused, over every stored document in every mode (`shape-census.mjs`), and the trace adds `pathLength` and `style`;
- a tag not of VS5's form is refused; draw's are `circle`, `g`, `path`, `rect`, `svg`, `text` and `use`;
- shapes nested more than 32 deep are refused; draw's nest at most 3;
- a canvas whose root answers no screen transform makes a conversion throw Errors' `Error`, where `toCanvas` threw a `TypeError` reading `inverse` of `null`;
- a root that refuses to take a layer as the scene opens leaves no layer behind and throws, where today the markup held them;
- a painter's change made after its call with no renderer call to follow -- none but the reveal's and the towers', which are put at once -- would reach the page at once, as today.

**Kept, each registered:** every element in the document is drawn whether in view or not (B289), and a diagram cannot vary its grids (B325), each held for pan and zoom.\
**Found and kept, registered when this is ratified:** a control link revealed by a trace is drawn solid until it is next drawn afresh, the trace's dash overriding its own, today's code and D12's alike (`chrome-trace.mjs`).

---

## 7. What this piece needs of the shared parts

`SNAP-GRID.md` section 7 is settled and built three times: the repository, the vocabulary and runtime checks, the gate and its consumer test, the release workflow, how draw pins a release, the import map, the vendor mount and the architecture manifest serve `vector-scene` unchanged.\
Where this piece differs:
- **The repository** is `apnex/vector-scene`, its package `@apnex/vector-scene`, laid out as 7.1 lays out a component, with `lib` `ES2022` alone and `"types": []`: no DOM library, the platform slice being its own types (VS11, D2), and `input-capture`'s source check refusing any `declare`, `.d.ts` file or triple-slash directive in `src/`.
- **`package.json` `exports`** has one entry, `.`, and `export-map.json` maps `openScene` to all four capabilities, `{ part: 'vector-scene', serves }`, `deferred` empty.
- **The runtime and clock checks** are `input-capture`'s, as widened at its build: `Intl`, `Temporal`, `WeakRef` and `FinalizationRegistry`, `eval`, `Function` and a call through a `constructor` property refused besides 7.2's list (B414); a `WeakMap` is no clock and is allowed.
- **The consumer test's exercise** opens a scene with no root in Node.js and puts and reads back an item, and in the page opens one on an `<svg>`, puts an item and finds its element, converts a point and closes.
- **I10, a browser test,** joins the gate as `input-capture`'s did, over Node.js's global `WebSocket`, with its teardown.
- **The vocabulary check** runs both lists over `src/`, comments included, and an SVG component meets their words: the DOM's `Node` and Node.js, `<a>`'s `link` and `anchor`, SVG's `glyph`, and a page's `layout` -- the contract says shape, element and lays out; no name in section 3 holds one, checked with the check's own match.
- **The built size** is recorded at build, as the earlier three recorded theirs.
- **Draw's side:** the dependency line and lockfile (7.5); the import map regenerated and `tests/import-map.test.js` restated; `COMPONENTS` gaining `@apnex/vector-scene` with the `renderer` part alone; `MISSION_KIT` and `ALIGNMENT` restated and the architecture documents regenerated, each with the words appendix B gives (7.7); and the image installing it for the server, since the export draws through it.
- **A deploy in flight** spans four components; the window is the one 7.6 names and B403 holds, unchanged.

---

## 8. Decisions owed

Each is offered with a recommendation; they may be ratified together, or one at a time.\
The ruling that ratifies this piece is written `H26-r` below until it has its number.

| # | Decision | Recommendation, and why |
|---|---|---|
| D1 | A shape is data in SVG's vocabulary -- a tag, attributes, and text or child shapes (VS5) -- not an element the application builds and not a callback the scene calls | yes: data is what the scene can compare, read back, run with no platform and hand to a second application -- the tester describes keys, zorg's web canvas its entities -- and it is what draw's hand previews already are (`app/src/painter.js:58-64`). Weighed against elements built by the application (the scene could not diff or run headless, and the application keeps the platform), and against draw's callbacks over a kit, the cheapest to adopt (every painter would stay), but which make the kit the contract, need a fake platform in Node.js as the export has today, and leave diffing to each painter, where B218 and B228 were missed updates |
| D2 | The scene owns the elements under its layers, writing them through a closed slice of the platform (VS1) with no DOM library, and runs with no root in Node.js | yes: one owner of the canvas's elements, held to a list a recording test checks, as `input-capture`'s D2 held its; the export draws through the same code with no fake `document`. Weighed against handing the application the elements to write (the boundary gone) and against a scene that only describes and a host that writes (a second component, or each application writing the same writer). The cost is a browser test in the gate, as `input-capture` already carries |
| D3 | Diffing is the scene's: old description against new, list by list and position by position, an element kept where the tag is the same, never reading the platform (VS7) | yes: the simplest rule two builders cannot read two ways, exact over draw's every change in the prototype. Weighed against keyed children reordered by key (no consumer reorders children; registered) and against reading the platform to diff (it would run whatever another writer did, and need a wider slice) |
| D4 | What lies under a point is answered by element -- `itemOf` maps the element the platform hit-tested, `input-capture`'s target, to its item and path -- not by geometry; draw keeps its picks by selector until H26.8 | yes: the platform already decides painted areas, `pointer-events` and dashes, which draw's picking depends on (B268's twin exists for the browser's rule), so answering by element matches today exactly; geometry would be a second hit test that disagrees at every stroke's edge. Weighed against a geometric query (it works with no platform but no consumer needs that; registered) and against `elementsFromPoint` for every shape under a point (a wider slice, and no consumer yet) |
| D5 | Layers are declared as data in order, each a `<g>` the scene creates with its attributes; a foreign layer is created and ordered but drawn by the application; within a scene layer an item goes before a named item or last | yes: draw's eleven layers are already one declaration (`CANVAS_LAYERS`) its export reads, and the scene making them ends the page's copy of it; a foreign layer serves what cannot be described -- the movers' animation -- and draw's pipes until H26.8. Weighed against adopting layers the page's markup holds (the declaration then lives twice), and against z-order by a rank the scene sorts by (draw's drawing order is draw's policy, and `before` states any order) |
| D6 | No view state in `0.1.0`: the scene converts through the root's screen transform, exactly as draw does today (VS10), and pan, zoom and a layer told the visible area and scale are added when H26.6 designs them, by a minor release | yes, though H26-1 names the viewport in the duty: every conversion follows the `viewBox` already, so nothing in this contract changes meaning when the view moves, and the form the view takes -- a `viewBox`, a transform on the layers, layers fixed to the screen, zoom about a point -- is H26.6's question, as the wheel's was for `input-capture` (its D6). Weighed against a view in the declaration now, fixed at draw's `viewBox` (a field draw never moves, whose form H26.6 may need otherwise), and against the whole view API now (no consumer) |
| D7 | Selection visuals, states and overlays are the application's shapes -- a class is an attribute it describes, a preview or a handle an item -- and the root and everything on it but the appended layers are the application's | yes: what a selection looks like is policy, and the scene holding no notion of state is what keeps it one duty; draw toggles classes on shadow nodes at H26.4 and describes them at H26.8. Weighed against a state API on items (draw's states would name the scene's vocabulary, and the tester's differ) |
| D8 | H26.4 translates draw's painters, appearances, reveal and towers through a live shadow, writes draw's own widgets, overlay and grids natively, draws pipes and movers in foreign layers, and moves the export onto a scene with no root; H26.8 retires the shadow and draw's picks by selector, and makes the pipes items | yes: no plugin changes at H26.4 but the reveal's trace (D12), its side-by-side compares old and new exactly, and the translation is one module the prototype shows exact; what is draw's own and small is written as the target shape at once, rather than translated and rewritten. Weighed against translating everything (a smaller H26.4, a larger H26.8, and translation built only to be retired) and against moving every painter to shapes now (every plugin changed in H26.4, losing the exact side-by-side that H26-9 relies on) |
| D9 | Draw's `renderer` part alone imports it, through `openCanvasScene` in `app/src/renderer.js`; the canvas and the export use the scene it opens | yes: the part that draws holds the adapter, as the lattice holds `snap-grid` and the rules part `input-binding`; the canvas and the export consume `renderer` already. Weighed against the canvas part (the export would then need the canvas) and against a part of its own (it would consume and be consumed by the renderer) |
| D10 | No conformance kit; no clock, no timer, no randomness, no animation | yes: nothing is a port another party implements; animation is time, the application's, run frame by frame in a foreign layer or declared to the platform in an attribute (D12) |
| D11 | `@apnex/vector-scene` released as `0.1.0` from `apnex/vector-scene`, its one export path `.` | yes: `SNAP-GRID.md` section 7 unchanged; `0.x` until mission-kit admits it |
| D12 | The reveal's trace is described at H26.4, the one plugin change: `show` writes `pathLength` 1 and a `style` naming a CSS animation in the simulation's stylesheet, and `hide` removes both; the export passes the animation over | yes: the trace is the one write the scene cannot carry as made today -- it measures the element, writes inline style and forces a layout between two states, and two puts of a transition in one task trace nothing (`chrome-trace.mjs`) -- while the animation is one description, needs no measurement, and moves as today's does, mid-flight and at its end; it is the target shape, so H26.8 keeps it. Weighed against the adapter forcing a layout between two puts (it would still need the element's length, which the scene does not read), against the scene handing an application its elements to animate (the boundary gone for every consumer, and the page no longer equal to the description), and against the trace dropped to a fade (H14.12 ruled the trace) |

**Registered when this is ratified,** each with its revival trigger (RU3):
- the view -- pan, zoom, the visible area and scale told to a layer: when H26.6 designs pan and zoom (D6);
- a shape found by geometry: when an application needs the shape under a point with no platform, or under a captured pointer (D4);
- children reordered by key: when an application's shapes reorder often enough that positional diffing is measured to cost (D3);
- draw's pipes as items, its picks by item, its painters describing shapes: with H26.8, on the board;
- a control link drawn solid after its trace, a defect H26.4 keeps (6.3): filed when this is ratified, its fix a trace that leaves no dash behind.

---

## 9. Axiom alignment audit (M7)

**Identity.**\
H26.0 part 4 at revision 1, read against `f702102` and mission-kit at `e33c850`, audited in three layers:
- the library: T1's test applied -- a scene writes its descriptions, reads them back at every put and at `items`, and the application relies on the page showing them -- so `declared-scene` and `keyed-shapes` are stateful, and A1 binds them; it coordinates no actors and runs no model;
- the release process: unchanged from part 1, built three times;
- the consumer: draw, stateful, multi-agent and autonomous as `MISSION-KIT-ALIGNMENT.md` section 5 reads it, to which the move adds a fourth installed component, loaded by its server too.

**Verdict.**\
Revision 1 is `pass, with guardrails`, by its author; its standing is to be confirmed by a reading.

| Layer | Axiom | Weight | How the design stands |
|---|---|---|---|
| library | A3 Sovereign Composition | load-bearing | One duty, one scene kept equal to its description (3.1); what is drawn and what it means are the application's, as data (D1, D7); the platform reached only through what it is handed (VS1, D2). |
| library | A1 Sovereign State Transparency | load-bearing | Toward the limit: the scene's whole state but its elements is `layers` and `items`, frozen data its owner reads at any moment, from which the scene can be rebuilt (VS8); its owner alone changes it. Short of the limit, and recorded: it is transient -- a reload ends it and the page puts its items again -- and a failed scene keeps what it wrote until closed. |
| library | A8 Gated Recursive Integrity | load-bearing | Section 4 holds each rule by a test that can fail, the diff against a model written apart, the slice by a recording test, and real rendering in real Chrome in the gate (I10). |
| consumer | A5 Perceptual Parity | load-bearing | The page and the export draw from the same descriptions through the same code; the pixel probe finds nothing (acceptance step 6). |
| consumer | A8 Gated Recursive Integrity | load-bearing | The side-by-side over every document and change, the export byte for byte, the corpus, the browser tests, the probe and a verifier prove the move; a prototype already passes the first two. |
| consumer | A9 Chaos-Validated Deployment | supporting | Nothing new is claimed of a deploy; the in-flight window stays registered (B403). |
| all | A4, A14 | supporting | Rulings recorded in draw and the component's record; what the earlier readings and builds settled is built in (section 10). |
| all | A2, A6, A7, A10, A11, A12, A13 | not materially implicated | No trait brings A2, A11 or A12 into force; no seam between agents is designed; A13 is served by section 8's decisions, each with a recommendation. |

**Tensions, and how they resolve.**
- H26-1's viewport against P4: named in the duty, held until pan and zoom are designed, every conversion already following the view (D6).
- `itemOf` with no draw consumer at H26.4 against P4: the duty names it, the tester and H26.8 consume it, and it costs a map (D4).
- A translation layer against H26-9's target: one module, retired by H26.8, while draw's own drawers are written natively now (D8).
- A component touching a platform against neutrality: held to a closed slice, no global, nothing of an element read (VS1, I3).

**Guardrails for the build.**
- G1: every site of appendix B is dispositioned as its row says (acceptance steps 2 and 3), held by a test in draw.
- G2: the scene touches no platform member outside VS1, reads nothing of an element it made, names no global, declares none and loads no DOM library (I3, I12).
- G3: the vocabulary check runs on `src/` comments included, and draw runs it on what it installs.
- G4: H26.4 changes no behaviour of any input draw's pages produce, but how the trace is made, which shows alike (D12); the inputs nothing produces are those 6.3 lists; the pixel probe finds nothing.
- G5: only the `renderer` part imports `vector-scene`.
- G6: the export draws through the scene with no root, byte-identical, and swaps no global.
- G7: no plugin changes in H26.4 but the reveal's trace (D12); the shadow is the one translation, named for H26.8.
- G8: I10 passes in the component's gate on every push, its teardown unable to fail or hang a run.

**Closeout hooks.**\
H26.4's verifier re-checks G1 to G8 and acceptance steps 1 to 7; mission-kit admission is asked only after draw runs on the release (C0).

---

## 10. Reviews

H26-3 requires a multi-family reading through context-lab's review panel (M1) before ratification; none has been made of this piece.\
What the first three components' readings and builds found, by kind (`SNAP-GRID.md`, `INPUT-BINDING.md` and `INPUT-CAPTURE.md` sections 10 and 11, each component's decision record, D2), and where this design answers each:

| What the earlier readings and builds found | Where this design answers it |
|---|---|
| argument forms read two ways: getters, proxies, accessors, present `undefined`, phantom keys, functions as objects | VS2, adopting binding's IB2 and the D2 records; an object is `typeof` `'object'` |
| when reading stops, and in what order; a declaration read whole | VS2 rules 2 and 3, each read judged as made |
| proxies and getters as application code, re-entry, determinism | VS2 rule 6; VS3's no re-entry while writing; VS7's determinism |
| thrown values read after a refusal | Errors: named by `typeof` alone |
| freezing, ownership, key order, receivers, message prefixes, extra arguments | the Errors and What is returned paragraphs |
| numerical claims not exact | VS10's arithmetic is `DOMPoint`'s, measured equal in Chrome; the scene computes no other number |
| a lifecycle that could leak on a throw before or after the platform took a value | VS3: the layer in progress removed first, by its own `remove` |
| a platform slice read or re-read two ways | VS1: the root's members once, an element's at each call, nothing of an element read |
| the contract's columns and headings added at build; optional types under `exactOptionalPropertyTypes` | section 3.3's Requires and Trait; section 3.5's Reference; I11 |
| wider clock, chance and global checks; a browser test's teardown | section 7 (B414); I10's teardown |
| records and tests missed; behaviour changes not listed | appendix B from a search of the tree; 6.3, measured by a prototype over every stored document |
| draw's layer rules | D9 and section 5: one part, the names tests and the DOM-global scan named |

---

## Appendix A -- `vector-scene`'s vision, the draft put to the director

To be ratified by the director with section 8; `vector-scene`'s `VISION.md` is made from it when its repository is.

**North star.**\
Let an application say what it shows as data, and have it shown exactly, in a browser or anywhere else.

**Why it exists.**\
Applications that draw build elements by hand and update them by hand, and every update that forgets a branch leaves the page a frame behind its data; they read the elements back to find what a pointer touched, and cannot draw the same picture where there is no browser without faking one.\
`vector-scene` holds the drawing once: the application describes its items, the scene makes the platform show exactly that, tells it which item an element belongs to, and draws the same description with no platform at all.

**What it is.**\
An embeddable library with one function: open a scene on a root, or on none, declare its layers, and put, move and remove items of shapes by key, read them back, map an element to its item, and convert points through the root.

**What it is not.**
- Not a theme: what anything looks like is the application's.
- Not an input layer: what a pointer means is `input-binding`'s and `input-capture`'s.
- Not a geometry engine: it answers by the platform's own elements.
- Not an animator or a clock.
- Not a network service: it never listens and never sends.

**What success means.**
- **Fidelity:** the page shows exactly the description, and nothing else the scene wrote.
- **Containment:** no application code needs to build or read an element it shows.
- **Portability:** the same description draws in a browser and with no browser, from one code path.
- **Reuse:** a second, unrelated application adopts it without a variant, a fork or a change.

**Authority.**\
Held by the director; drafted by anyone, ratified only by the director; amended, never quietly rewritten.

---

## Appendix B -- every site H26.4 touches

From the inventory of `f702102`, paths as H26.7 left them.\
*moves* -- to `vector-scene`; *native* -- written in the scene's shapes now; *translates* -- H26.4's adapter, retired by H26.8; *stays* -- draw's content or policy; *plumbing* -- an import, a record or a line that goes or is repointed; *unchanged* -- names what moves or lies on its route, no edit.\
The last column says what H26.8 does.

| Site | Today | H26.4 | H26.8 |
|---|---|---|---|
| `app/src/renderer.js:9` | imports `el`, `setAttrs` | plumbing: the shadow kit; `openScene` from `@apnex/vector-scene` | the shadow kit goes |
| `app/src/renderer.js:66-114` | layers found by id, painters' and appearances' layer elements | moves: checked against the scene's layers, a layer a name | unchanged |
| `app/src/renderer.js:116-141` | the constructor over an `svg` | translates: takes the scene beside the root; `openCanvasScene` exported | the scene alone |
| `app/src/renderer.js:178-200` | `glyphOf`, `byId` over the page | translates: answer the item's shadow node | the reveal and towers describe their marks; both go |
| `app/src/renderer.js:224-264` | selection, reflections, `handle` | translates: batched, each call's changes put at its end | states described as classes in each item |
| `app/src/renderer.js:266-285` | `syncAll` empties the layers | moves: removes every item it put | unchanged |
| `app/src/renderer.js:294-339` | render, `place` by `insertBefore`, `draw` | translates: a fragment per item, placed by `put` with `before`, computed from `items` | the painter's shapes put directly |
| `app/src/renderer.js:342-382` | `update`, `reapplyStates`, `kit` | translates: a painter's kit over the item's fragment | a painter answers shapes; the kit goes |
| `app/src/renderer.js:388-425` | appearances composed into a `<g>` | translates: into the winner's item fragment | composition answers shapes; stays draw's policy |
| `app/src/renderer.js:441-459` | `remove`, `elementOf`, `setState`, `clearState` | translates: by item | `setState` puts the item described with its class |
| `shadow.js`, new in `app/src/` | none | translates: the live shadow, the export's headless node moved here | retired |
| `app/src/painter.js:10-26` | `el`, `setAttrs` over `document` | stays: for the foreign layers' drawers | stays for the movers |
| `app/src/painter.js:29-32` | `toCanvas` | moves: `toDrawing`; deleted | unchanged |
| `app/src/painter.js:37-106` | crosshair, preview, ghost, preview rect, line and path | native: items of the overlay and snap layers | unchanged |
| `app/src/painter.js:116` | `layerOf` | plumbing: goes with Input's overlay element | unchanged |
| `app/src/overlay.js:40-41,122-167` | the overlay and snap layers; datum; handles | native: items, the handles removed and put afresh | unchanged |
| `app/src/overlay.js:178-180` | shown grids as root classes | stays | stays |
| `app/src/grids.js:12-31` | a circle per point into each layer | native: an item per grid | unchanged |
| `app/src/compose-canvas.js:51,58,67,76-82` | defs; grids; renderer; crosshair; Input; capture | plumbing: opens the scene once and hands it on; defs stay | unchanged |
| `app/src/input.js:210,328,344,532,905` | previews into `#overlay` | native: previews over the scene | unchanged |
| `app/src/tools.js:21,87`, `app/src/palette.js:35,150,155,166` | the ghost into `#overlay`; `toCanvas` | native: the ghost an item; `toDrawing` | unchanged |
| `app/src/capture.js:33,89` | `toCanvas` as capture's conversion | plumbing: the scene's `toDrawing` | the scene's `toDrawing` handed whole |
| `app/src/capture.js:84-93`, `app/src/pick.js:53-83` | picks by selector over the target | stays | picks by `itemOf` and the item's attributes |
| `app/src/labeledit.js:59-61` | `toScreen` by `DOMPoint` | plumbing: the scene's `toScreen` | unchanged |
| `app/src/labeledit.js:113,118,129,138` | an element by id, its box, the scale | stays | stays |
| `app/src/main.js:84,107`, `lab/src/root.js:106` | the pipe and mover layers by id | plumbing: `layerElement` | pipes: items |
| `lab/src/root.js:53` | the lab checks each layer in its markup | plumbing: checks the root, its ground and the scene opened | unchanged |
| `plugins/network/host.mjs:66-92` | pipes into `#pipes` | unchanged: a foreign layer | native: pipe items |
| `plugins/simulation/mover-painter.mjs`, `plugins/simulation/paintloop.mjs` | packets and beams, animated | unchanged: a foreign layer | stays foreign |
| `plugins/simulation/reveal-painter.mjs:96-117` | marks an entity's element; traces a link by its measured length, inline style and a forced layout | the mark unchanged, a shadow node put at once; the trace native, `pathLength` and a `style` naming `link-trace`, removed on hide (D12) | the mark described |
| `plugins/simulation/simulation.css` | the simulation's look | plumbing: `@keyframes link-trace` | unchanged |
| `server/svg-style.mjs:66-70`, `tests/svg-style.test.js` | refuses any at-rule in the sheets it flattens | plumbing: passes over a `@keyframes` block, a case added | unchanged |
| every painter and appearance under `plugins/` (`plugins/zones/zone-painter.mjs`, `plugins/groups/group-painter.mjs`, `plugins/network/link-painter.mjs`, `plugins/network/anchor-appearance.mjs`, `plugins/devices/device-appearance.mjs`, `plugins/simulation/spawn-appearance.mjs`) | callbacks over the kit | unchanged: over shadow nodes | each answers its item's shapes |
| `kernel/renderer.mjs` | label, brackets, defs, dashes | stays: draw's primitives | stays |
| `product/canvas.mjs:59-66` | the view box and layers | unchanged: the scene's declaration | unchanged |
| `tools/canvas-layout.mjs`, `tools/page-regions.mjs:31`, `app/index.html:143-158`, `lab/index.html:61-76` | the canvas region with its layers | plumbing: the region holds the root and ground alone | unchanged |
| `server/svg.mjs:13,38-113,115-216` | the renderer over its own tree, `document` swapped | moves: a scene with no root; serialization reads its descriptions; the tree and the swap go | unchanged |
| `package.json`, `package-lock.json`, `app/index.html:8-18`, `lab/index.html:29-39` | dependencies; the import map | plumbing: the release pinned; one map entry more | unchanged |
| `tools/layers.mjs:122-123` | the renderer part's modules | plumbing: `shadow.js` joins it, and the canvas and page entries | `shadow.js` leaves |
| `tools/layers.mjs:159-168` | `COMPONENTS` | plumbing: `'@apnex/vector-scene': { parts: ['renderer'], by: ['H26-1', 'H26-2', 'H26-r'] }` | unchanged |
| `tools/layers.mjs:181-216` | `MISSION_KIT`; `ALIGNMENT` for `primitives`, `renderer`, `export` | plumbing: `'vector-scene': 'proposed in drawv2, released from its own repository, composed (H26-r); a candidate in zorg D32, steered in D35'`; `renderer` waits `'composed (H26-r); its drawing loop moved onto it at H26.4'`, `export` `'draws through it with no root (H26-r)'`, `primitives` `'draw's shapes, drawn through vector-scene (H26-r)'` | `renderer` restated |
| `tools/scan-dead.mjs`, `tools/scan-writers.mjs:215-221` | exports with a consumer; DOM globals by file | unchanged: `toCanvas` and `layerOf` deleted, `openCanvasScene` consumed; `shadow.js` reaches none | unchanged |
| `docs/ARCHITECTURE.md`, `docs/ARCHITECTURE-TARGET.md` | generated parts and alignment; sections 4.2 and 9.3 | plumbing: regenerated; the chain cites `H26-r`; 9.3 names four components | unchanged |
| `tests/fixtures/client-harness.mjs:371-381` and `makeInput` | fakes for the renderer and the canvas | plumbing: a scene over the fake root, its layers found, members VS1 names added | unchanged |
| `tests/renderer.test.js`, `tests/appearance.test.js`, `tests/appearance-pipeline.test.js`, `tests/drawing-order.test.js`, `tests/anchor-redraws.test.js`, `tests/canvas-painters.test.js`, `tests/canvas-reflects.test.js`, `tests/link-heads.test.js`, `tests/run-picture.test.js`, `tests/consumer-parity.test.js`, `tests/span.test.js` | build the renderer over the fake | plumbing: hand it the scene | restated to shapes |
| `tests/svgexport.test.js`, `tests/svg-style.test.js`, `tests/display.test.js`, `tests/transit-roles.test.js`, `tests/bare-anchor.test.js` | the export's bytes and words | unchanged: byte-identical | unchanged |
| `tests/affordance.test.js`, `tests/canvas-grids.test.js`, `tests/canvas-hand.test.js`, `tests/layouts-canvas.test.js`, `tests/input.test.js` | overlay, grids, ghost and previews | unchanged: the same trees | unchanged |
| `tests/canvas-layout.test.js`, `tests/scan-copies.test.js`, `tests/import-map.test.js` | the canvas region; the map | plumbing: the region without layers; the map restated | unchanged |
| `tests/input-capture-parity.test.js`, `tests/fixtures/pre-capture/` | old capture against the adapter | unchanged: the scene's conversion answers the same numbers over the harness's root | unchanged |
| `tests/browser.test.js:482-539` | H14.12: a link traces, read from its inline transition | plumbing: restated to read the animation | unchanged |
| `tests/browser.test.js:1291-1306`, `tests/page-matrix.test.js`, `tests/fixtures/k8-dom.json`, `tools/probe/parity.mjs`, `tools/probe/gesture-sample.mjs` | the booted page, real gestures, pixels and styles | unchanged: acceptance steps 5 and 6 | unchanged |
| `vector-scene-move.test.js` and `vector-scene-parity.test.js`, new in `tests/`, with today's renderer in `tests/fixtures/pre-scene/` | none | plumbing: acceptance steps 3 and 4 | the copy deleted |
| `dev/design/input/GESTURE-SYSTEM.md`, `dev/design/unification/CANVAS-PLUGINS.md` | the canvas parts and the renderer as built | plumbing: kept as written (RU2), each gaining a dated line at H26.4 | unchanged |
