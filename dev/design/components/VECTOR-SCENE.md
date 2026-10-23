# H26.0, part 4 -- `vector-scene`

The fourth piece of H26's design of record (`dev/DECISIONS.md` H26-3, as H26-5 and H26-9 amended it).\
It designs `vector-scene`, the component that shows an application's shapes: it holds them as data, in declared layers, under the application's keys, makes the platform show exactly what they describe, says which shape a platform element belongs to, and converts points between the screen and the application's coordinates.\
It builds on part 1 (`SNAP-GRID.md`), whose section 7 is settled and built three times, and on parts 2 and 3 (`INPUT-BINDING.md`, `INPUT-CAPTURE.md`), whose readings and builds settled how arguments are read, how a lifecycle rolls back and how a platform is touched; it states only where it differs, and cites rather than restates.\
H26-9 holds its contract to the target state draw adopts natively after it (board item H26.8): appendix B says what H26.4's adapter translates now and what H26.8 then retires.\
H26-10 aims the programme beyond the four components, each boundary drawn first inside draw as a declared part: section 5.2 maps where each piece of draw's canvas layer lands, and section 5.3 declares the first such part, `editing`.

**Standing:** a design under review, revision 2, drafted 2026-10-23 after its first multi-family reading (section 10.1); revision 1 was `567caec`; the code read is `569c0a8`'s, identical in code to `f702102`, after H26.7 moved every plugin under `plugins/` and H26.3 moved draw onto `input-capture`; the director answered D1, D6 and D8 and ruled H26-10 on 2026-10-22, each answer to be recorded as a ruling at ratification; not ratified, and its standing to be confirmed by a second reading.

---

## 1. What this decides, and what it does not

It decides:
- `vector-scene`'s one duty, its vocabulary and its contract, precisely enough that an agent other than its author could build it from section 3 alone;
- what a shape is -- data in SVG's vocabulary, the application's own, not an element and not a callback -- and who owns the platform's elements and their updates (D1 to D3);
- what lies under a point: the item a platform element belongs to, answered by the platform's own hit test, so draw's picking can stay exact (D4);
- layers as data, their order, and layers whose content the application draws itself (D5);
- the viewport now: conversions through the root's screen transform, no view state until its first consumer is designed, and every term of the contract meaning already what it will mean when the view arrives (D6);
- that selection visuals, states and overlays are the application's shapes (D7);
- how H26.4 moves draw onto it -- what it translates, what it writes natively, what H26.8 retires, and that no plugin changes, the reveal's trace among them -- which part imports it, and that the export draws through it in Node.js (D8, D9, D12);
- where each piece of draw's canvas layer lands after H26.4 and H26.8, and the `editing` part draw declares for its editing duty (D13, sections 5.2 and 5.3);
- the invariants and tests that hold it, the acceptance steps for H26.4, and every site that move touches (appendix B).

It does not decide:
- pan and zoom (H26.6): how the view moves, culling what is out of view (B289), a diagram's own grids (B325) -- only that none of them needs a field of this contract changed (D6);
- the gesture tester's scope (H26.5), beyond what its keys and mouse need of a scene;
- `input-capture`'s contract, ratified (H26-8) and built, whose `hit` and `toDrawing` this scene can serve;
- draw's content and policy -- what each kind looks like, the appearance pipeline's composition (D3 of the 2026-09-22 ruling), drawing order (F-d), which classes mean selected or hovered, the stylesheets, the export's serialization and styling -- each draw's;
- an editing component (B389): its boundary is drawn inside draw (D13), and its contract waits for a second application.

---

## 2. What draw does with drawing today

Read from the code at `569c0a8`; appendix B lists every site, one row each.

### 2.1 The renderer

`app/src/renderer.js` (460 lines) reconciles the Model into the page's SVG layers through the parts' painters and appearances:
- **Layers by id** -- a painter names the layer it draws into, checked against the page with `svg.querySelector('#' + layer)` (`:101-114`); an appearance names its root's layer the same way (`:84-91`); the renderer keeps no layer of its own (`:128`).
- **An element per entity, keyed by its `id` attribute** -- found with `ownerDocument.getElementById` (`:447-449`); a put removes and draws afresh (`:331-339`), a set asks the painter to update the element in place or to re-render (`:342-367`), a delete removes it (`:244-264`, `:441-445`).
- **Painters and appearances are callbacks over a kit** -- `create(entity, kit) -> element` and `update(entity, element, kit)`, the kit holding `el`, `setAttrs`, `applyLook`, the layer and the model (`:376-382`); appearances compose by ranks into one `<g>` per anchor (`:388-425`); a link draws four sibling elements -- its path, head, leg and click twin (`plugins/network/link-painter.mjs:77-86`) -- moved and removed together (`:138`).
- **Stacking** -- a stacked layer keeps its items in drawing order, each element moved by `insertBefore` before the first newer item, whether or not it stands there (`:307-325`, `model/stacking.mjs:11-14`).
- **Session states** -- `selected`, `hover`, `armed` and each part's reflection are classes toggled on the entity's element (`:224-242`, `:451-459`) and re-applied to a fresh element (`:371-374`); modes and labels are classes on the root (`:156-160`, `:202-215`).
- **Readers of its elements** -- the reveal marks one (`plugins/simulation/reveal-painter.mjs:96`, `:116-117`, through `byId`, `:191-200`) and traces a link's line, measuring it, writing its inline style and forcing a layout between two states (`:98-111`); the towers turn a glyph each animation frame, caching it while it is connected (`plugins/simulation/mover-painter.mjs:318-345`, through `glyphOf`, `:178-181`).
- **What holds an element's identity** -- an update keeps the elements it patches, and a link gaining or losing its head inserts or removes the head and leg between a line and a click twin it keeps (`plugins/network/link-painter.mjs:121-135`); a touch keeps the pointer captured to the element it pressed while that element stays in the page (`INPUT-CAPTURE.md` section 10.1); the trace's transition runs on the line it began on; a run-mode region's `:hover` follows the element under the pointer (`plugins/devices/devices.css:12`); and the towers' cache holds a glyph while it is connected.

### 2.2 The other drawers

- **Widgets** -- `app/src/painter.js` builds the crosshair (`:37-55`), the stamp ghost from a hand's preview, already data as `{ tag, attrs, children }` (`:58-80`), and the preview rect, line and path (`:82-106`), each into a layer element it is handed; Input, Tools and the palette hand them `#overlay` (`app/src/input.js:532`, `app/src/tools.js:21`, `app/src/palette.js:35`), the composition `#snaplayer` (`app/src/compose-canvas.js:76`).
- **The overlay** -- handles as rects with a dataset key (`app/src/overlay.js:145-167`), the datum in `#snaplayer` (`:122-133`), the shown grids as root classes (`:178-180`).
- **Grids** -- a circle per point into each grid's layer, redrawn afresh on load (`app/src/grids.js:12-31`).
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

The renderer's tests build it over the harness's fake SVG (`tests/fixtures/client-harness.mjs:371-381`) in eleven files, whose elements neither detach a child they append nor keep their class list one with their `class` attribute (`:55-83`), which no test met while the renderer wrote through `classList` and `insertBefore`; the export's tests hold its bytes (`tests/svgexport.test.js`, `tests/svg-style.test.js`); the K8 test holds the booted page's layers, grid and entities (`tests/browser.test.js:1291-1306`); and the pixel probe compares a candidate with a baseline in Chrome, pixels in each mode, each served SVG, the favicon, the lab's boards and computed styles under every state, with no tolerance (`tools/probe/parity.mjs`).

### 2.7 What is mechanism

The generic mechanism is: layers in an order, an item per key holding sibling elements, bringing elements to a description, placing an item within its layer, which item an element belongs to, and converting points through the root.\
Draw's content and policy is: what each kind draws, the appearance pipeline's composition, drawing order, what classes mean, the stylesheets, the export's flattening and styling, the picks' selectors, and which layers exist (`CANVAS_LAYERS`).\
The renderer interleaves both: its layer lookups, element keying, stacking moves and DOM writes are mechanism; `compose`, `sigOf`, reflections and `byDrawingOrder` are draw's.

---

## 3. `vector-scene`

### 3.1 Duty

Show an application's shapes, held as data in declared layers under its keys, exactly as described, and say which shape a platform element belongs to and where a point lies.

That is the whole duty: one scene, kept equal to its description.\
It does not decide what anything looks like or means, find a shape by geometry, read a clock, animate, style or sanitize -- each is the application's or another component's.\
Panning and zooming the viewport, which H26-1 names in the duty, are held until their first consumer is designed (D6).

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
| drawing coordinates | the coordinates the layers are drawn in: the root's own, while no view is declared (D6) |
| point | a frozen record of finite numbers `x` and `y` |
| screen transform | the platform's affine map from the root's coordinates to the screen |

### 3.3 Contract

One capability per row; none requires another component's capability.\
A scene writes its items, reads them back and is relied on to show them, so `declared-scene` and `keyed-shapes` are stateful in T1's sense (section 9).

| Capability | Relation | Requires | What a consumer can depend on | Trait |
|---|---|---|---|---|
| `declared-scene` | provides | none | A scene opened from declared layers, on a root or with none, or refused with every problem; closed by removing exactly what it added (VS2 to VS4). | stateful |
| `keyed-shapes` | provides | none | Items of shapes put, replaced, moved and removed by key within a layer, the platform brought to show exactly the description, and the description read back as data that can be put again (VS5 to VS8). | stateful |
| `shape-at-element` | provides | none | The item and path a platform element belongs to, or none -- so the platform's own hit test answers what lies under a point (VS9). | none |
| `screen-conversion` | provides | none | Where a screen point lies in drawing coordinates, and back, through the root's screen transform at the moment asked (VS10). | none |

**Errors.**\
`openScene` never throws while it reads and judges a declaration: it refuses with problems; it throws only an error a platform method threw while it created the layers, after removing every layer it made (VS3).\
Every other function reads and judges its arguments first, in VS2's order, and only then reads the scene's state; `close` takes none.\
A malformed argument throws a `TypeError` whose message begins with the function's name and a colon -- `put: ` -- so a malformed argument to a closed scene meets the `TypeError`; an error a getter or a trap threw while an argument is read is rethrown as that `TypeError`, the thrown value named by its `typeof` alone: a primitive as `String` writes it, an object as "an object", a function as "a function".\
A call the scene's state does not allow throws an `Error`, the base constructor, beginning with the function's name: any call but `close` on a closed or failed scene, any call, `close` among them, made while the scene writes to the platform, a `before` naming no item of the layer, and a conversion or `layerElement` the root cannot answer (VS4, VS10).\
An error a platform method throws propagates unchanged: thrown while the scene writes, it leaves the scene failed (VS7); thrown while it converts, it leaves the scene as it was.\
A message's beginning is the contract and the rest is prose, as `input-binding` and `input-capture` settled.

**What is returned.**\
Every value the scene makes -- an open result, a problem list, a scene, its `layers`, an `items` answer, an `itemOf` answer, a point -- is made afresh by the call that first returns it and frozen to its depth.\
A description is the scene's own frozen copy, made when the item is put and returned by reference afterwards; each shape in it holds `tag` and `attrs`, then `text` when it has text or `children` when it has child shapes, and nothing else, each attribute's value a string, so every description the scene returns is a valid argument to `put`, and putting it again to its own item, with no `place`, calls nothing (VS8).\
Every record holds its properties in the order its form is written here and nothing else; an open result holds `ok`, then `scene` or `problems`; a scene is a frozen object of exactly `layers`, `put`, `remove`, `items`, `itemOf`, `layerElement`, `toDrawing`, `toScreen` and `close`.\
Every function the scene makes needs no receiver and reads no argument beyond those its form names; nothing the application passes is kept, frozen or changed, but the root and the elements it holds.

**VS1 -- What the scene touches of the platform.**\
The scene reaches the platform only through the root the application hands it, and touches exactly:
- of the root: `ownerDocument`, `appendChild` and `getScreenCTM`, each read once, as the scene opens (VS2), the function read being the one it calls, with the root as its receiver, every time;
- of the root's document: `createElementNS`, read once likewise, called with the document as its receiver, the SVG namespace `http://www.w3.org/2000/svg` and a tag;
- of each element it makes: `setAttribute`, `removeAttribute`, `appendChild`, `insertBefore` and `remove`, each called as that element's method when it is used, and its `textContent`, only ever written;
- of a screen transform the root answers, once for each conversion: for `toDrawing` its `inverse`, read and called with the transform as its receiver, and of the transform used, `a`, `b`, `c`, `d`, `e` and `f`, read in that order (VS10).

It reads no other member, reads nothing of an element it made, writes nothing beneath a foreign layer, writes nothing on the root but the layers it appends, and names no global: no `window`, no `document`, no constructor of the platform's.\
So it cannot reach beyond the root it is given, and the same code runs over a browser's elements and over plain objects of their shape.

**VS2 -- How values are read.**\
These are the rules the first three components settled (`SNAP-GRID.md`, `INPUT-BINDING.md` and `INPUT-CAPTURE.md` section 11, each component's decision record, D2), adopted whole:
1. Every value but a point and a screen transform is read as `input-binding` reads one (`INPUT-BINDING.md` section 3.3, IB2 rules 1 to 4, 6, 8 and 9): a plain object's own data properties by descriptor, a property read only where its own keys hold it, an accessor of no form, an inherited property absent, a symbol-named property ignored, a property present as `undefined` of no form, a key whose descriptor reads `undefined` absent, an array dense, of `Array.prototype` and holding no other own string-named key, an index a canonical integer below 2^32 - 1, and a value made in another realm no plain object.
2. A declaration is read breadth first, as IB2 rule 8 reads one: its prototype, its own keys, the descriptors of `root` and `layers` its own keys hold, in that order; then, when `root`'s descriptor holds an object, its `ownerDocument`, that document's `createElementNS`, and its own `appendChild` and `getScreenCTM`, each through ordinary property access and judged as read, the reading of `root` stopping at the first refused; then `layers`, as an array is read -- `Array.isArray`, its prototype, its own keys, the descriptor of its `length`, then of each index in order; then each layer in index order, read whole before the next: its prototype, its own keys, the descriptors of `name`, `attrs` and `foreign` its own keys hold, in that order, and then, unless it is refused at its own pointer, the values those held, in the same order, `attrs` as rule 5 reads a record; a reflection that throws refuses the value it was made on, and nothing beneath a value refused at its pointer is read.
3. Every other function reads its arguments once each, in their order, judging each read as it is made, and throws at the first that is malformed, reading nothing after it: `remove` reads its layer and then its key, `items` and `layerElement` their one name, `itemOf` its value by `typeof` and identity alone, running no trap, and `put` its layer, its key, its shapes as an array is read, each shape whole before the next, and last its `place` -- its prototype, its own keys, the descriptor of `before`.
4. A shape at a depth is read thus: its depth judged first, so a shape nested deeper than VS5 allows is refused with nothing of it read; then its prototype; its own keys, any key but `tag`, `attrs`, `text` and `children` refusing it; the descriptors of those four its own keys hold, in that order, each judged as read; `tag` absent, or both `text` and `children` present, refusing it; and only then its values, in the same order -- `tag`, `attrs` as rule 5 reads a record, `text`, and `children` as an array, each child read whole, at the next depth, before the next.
5. An attribute record is read thus: its prototype; its own keys; then each own string-named key in their order -- its name judged against VS5, then its descriptor read and judged, then its value -- the reading stopping at the first refused.
6. A point given to a conversion, and a screen transform the root answers, are each judged by `typeof` and read through ordinary property access, a browser's being getters: a point's `x` and then its `y`, a transform's `a` to `f` in order, all read before any is judged, as `snap-grid` reads a point.
7. A getter or a trap met while arguments are read is the application's code and may call the scene: the call takes effect at once, and the function reads the scene's state only after its arguments are read and judged (IB2 rule 9).

**VS3 -- Opening and closing.**\
`openScene(declaration)` returns `{ ok: true, scene }` or `{ ok: false, problems }`.\
A declaration is a plain object holding `layers` and, optionally, `root`:
- `root`, an object whose `ownerDocument` is an object whose `createElementNS` is a function, and whose `appendChild` and `getScreenCTM` are functions;
- `layers`, a non-empty array of plain objects, each holding `name`, a non-empty string unique among them, and optionally `attrs`, an attribute record of VS5's form written on the layer's element, and `foreign`, a boolean, `false` when absent.

A problem is `{ pointer, problem }` as `input-binding`'s IB3 defines one, ordered by pointer and then by problem by UTF-16 code unit, no record twice; a check that fails at a pointer suppresses every check beneath it, and none at a sibling's:

| Step | When | Problem, at pointer |
|---|---|---|
| 1 | the declaration is not a plain object, or a reflection on it throws | `not-an-object` at `""`, and nothing else |
| 2 | an own property other than `root` and `layers`; `layers` absent | `unknown-property` at `/<name>`, one each; `missing-property` at `/layers` |
| 3 | `root` an accessor or not an object, or a member refused as VS2 rule 2 reads it | `invalid-value` at `/root` |
| 4 | `layers` an accessor, not an array of VS2's form, or empty | `invalid-value` at `/layers` |
| 5 | a layer not a plain object, or a reflection on it throws; a property other than `name`, `attrs` and `foreign`; `name` absent | `not-an-object` at `/layers/<i>`; `unknown-property` or `missing-property` at `/layers/<i>/<name>` |
| 6 | `name` an accessor or not a non-empty string; `foreign` an accessor or not a boolean | `invalid-value` at its pointer |
| 7 | `attrs` an accessor, not a plain object, or a reflection on it throws; an attribute of it refused as VS2 rule 5 reads it | `not-an-object` at `/layers/<i>/attrs`; `invalid-value` there |
| 8 | among valid names, one equal to an earlier one | `duplicate-name` at the later one's `/layers/<i>/name` |

**The lifecycle,** each rule stated here once:
1. With a root, `openScene` calls no platform method until the declaration is judged; then, for each layer in order, it makes a `<g>`, sets the layer's attributes on it in order, and appends it to the root, after whatever the root already holds.
2. If a platform method throws while it does so, it calls `remove` on every layer element it made -- the one in progress first, which does nothing to an element the root never took -- and then the others in reverse of the order made, attempting each, and throws the error first thrown, unchanged; nothing is left in the root.
3. With no root it makes nothing; its scene holds and reads back data alone.
4. A scene is *open* until `close` is first called, *closed* from then on, and *failed* from the moment a platform method throws while it writes (VS7); every function but `close` throws Errors' `Error` once it is closed or failed, and every function, `close` among them, throws it while the scene writes to the platform, changing nothing, since it is not re-entrant there.
5. `close()`, on its first call made while the scene is not writing, closes the scene, then calls `remove` on every layer element it made, in reverse of the order made, attempting each, and throws the first error a removal threw, unchanged, or returns `undefined`; every later call returns `undefined` and calls nothing; removing a layer removes every element the scene made beneath it.

So no element the scene made outlives a failed opening or a close unless a removal threw.

**VS4 -- Layers.**\
A scene layer holds items, back to front in the order VS6 places them; a foreign layer holds whatever the application draws beneath the element `layerElement(name)` answers, which the scene never writes beneath, reads or removes but as VS3 removes every layer.\
A layer's element is the scene's: the application writes nothing on it, foreign or not, and nothing beneath a scene layer's, so the scene can give every layer what a view needs when one arrives (D6).\
`layers` is a frozen copy of the declaration's layers, each `{ name, attrs, foreign }`.\
`layerElement(name)` answers a foreign layer's element; a name that is no foreign layer is malformed, and a scene with no root refuses.\
A function taking a layer takes the name of a scene layer; any other value, a foreign layer's name among them, is malformed.

**VS5 -- Shapes.**\
A shape is a plain object holding `tag`, and optionally `attrs`, and `text` or `children`, but not both, and nothing else:
- `tag`, a string of an ASCII letter followed by ASCII letters, digits and hyphens, the element's local name in the SVG namespace;
- `attrs`, an attribute record: a plain object whose every own string-named property is a data property whose name is an ASCII letter or underscore followed by ASCII letters, digits, underscores, periods and hyphens, not beginning with `on` in any case, and whose value is a string, or a finite number written as JavaScript's `String` writes it, so `-0` is written `0`;
- `text`, a string, the element's text content, `""` meaning none;
- `children`, an array of VS2's form of shapes, the element's children in order, empty meaning none.

An item's shapes are an array of at least one shape; shapes nest at most 32 deep, an item's own shapes at depth 1.\
No attribute name can be an array index, so a description's attributes keep the order the record's own keys gave them.\
The scene judges a shape's form, never its meaning: it refuses an event-handler attribute, since a description is data, but it is no sanitizer -- a `script` element, a `javascript:` URL or an animation that sets one is the application's to keep out of what it describes, as it is today, and an application drawing what it does not trust sanitizes it first.

**VS6 -- Putting and removing.**\
`put(layer, key, shapes, place?)` makes `shapes` the description of the item `key` in `layer`, and returns `undefined`:
- `key` is a non-empty string; `place`, when given, is a plain object holding at most `before`, which is `null` or a non-empty string other than `key`;
- an item not in the layer is placed before the item `before` names, or last when `before` is `null` or `place` holds none;
- an item in the layer keeps its place when `place` holds no `before`, and otherwise is moved before the item `before` names, or last when `before` is `null`, whether or not it stands there already, as draw's stacking inserts each element it places;
- a `before` naming no item of the layer throws Errors' `Error`, after the arguments are read and before anything changes.

`remove(layer, key)` takes the item out of the layer, its elements with it, and returns `undefined`; a key the layer does not hold changes nothing.\
`items(layer)` answers a frozen array of frozen `{ key, shapes }`, one per item, back to front, `shapes` its description.

**VS7 -- Bringing the platform to the description.**\
With a root, each put and removal makes exactly these platform calls, in this order, and reads nothing of the platform:
1. A shape's element is made by `createElementNS` with its tag; then each attribute set, in order; then its text written to `textContent` when it has text; then each child's element made the same way, depth first, and appended; and only then is it inserted where it goes.
2. A new item's elements are inserted, in order, before the first element of the item it is placed before, or appended to the layer.
3. An item put again is brought from its old shapes to its new list by list -- its own shapes, and the children of every element kept -- position by position: where both lists hold a shape of the same tag, the element is kept and patched (step 4); where the new list holds a shape and the old none, or one of another tag, a new element is made and inserted before the old element at that position or, past the old list's end, appended to its parent, an item's own shapes being inserted before the next item's first element or appended to the layer when the item is last; then the old element there, if any, is removed; and the old elements past the new list's end are removed, in order.
4. An element is patched by setting each new attribute whose value differs or which the old lacked, in the new order, and removing each old attribute the new lacks, in the old order; then its content: text to text, the new text written when it differs, `""` among them; text to children, `""` written when the old text was not, then each child made and appended; children to text or to none, each old child removed, in order, then the new text written when there is one; children to children, the lists compared as step 3 compares them.
5. An item moved has its elements inserted, in order, before the first element of the item named, or appended to the layer, once step 3 has brought them to their new shapes.
6. An item removed has each of its elements removed, in order.

So every element under a scene layer shows exactly its description -- attributes in description order on an element made, an added attribute last on an element kept, as the platform orders them -- and the scene writes only what its descriptions differ by, so it neither reads nor restores what anything else writes on an element it made.\
An element keeps its identity while its shape keeps its position and its tag, so a pointer captured to it, a transition running on it and a hover on it outlast every put that keeps it; an application whose shapes gain or lose a sibling before an element it needs kept puts that element in an item of its own, as draw's adapter does for every top-level element a painter draws (section 5.1).\
If a platform method throws, the scene is failed, the error propagates unchanged, no further call is made, and what was written stays; only `close` is left, so what the scene holds of a half-written put is never read.\
With no root, put and remove change the descriptions alone, as they would with one.\
For arguments whose reading runs no application code, the same sequence of calls gives the same platform calls and the same descriptions.

**VS8 -- Reading back.**\
`items` and `layers` are the scene's whole state but which elements it made: putting each layer's items, in order, into a fresh scene opened with the same layers gives equal items, and a scene with no root answers them as one with a root would.

**VS9 -- The shape at an element.**\
`itemOf(value)` answers a frozen `{ layer, key, path }` when `value` is an element the scene made for a shape of an item it holds, `path` a frozen array of the shape's indices from the item's own shapes down; and `null` for any other value -- a layer's element, a foreign layer's content, the root, an element the scene removed, anything the scene did not make.\
It reads nothing of `value`, so it runs no application code; given the target of a pointer event, it answers what the platform found under the point; like every function but `close`, it throws once the scene is closed or failed, and while it writes.

**VS10 -- Conversions.**\
`toDrawing(screen)` answers where a screen point lies in drawing coordinates, and `toScreen(point)` the reverse:
1. the point is read as VS2 rule 6 says, and refused unless its `x` and `y` are finite numbers;
2. the scene's state is judged, and a scene with no root refused;
3. the root's `getScreenCTM` is called, and an answer that is not an object refused;
4. for `toDrawing`, the answer's `inverse` is read, refused unless a function, and called with the answer as its receiver, and what it answers refused unless an object;
5. `a`, `b`, `c`, `d`, `e` and `f` of that transform are read as VS2 rule 6 says, and refused unless each is a finite number;
6. the answer is the frozen point `{ x: a * x + c * y + e, y: b * x + d * y + f }`, each evaluated left to right in binary64, and refused unless both are finite.

Each refusal of steps 2 to 6 is Errors' `Error`; an error the platform throws at steps 3 to 5 propagates unchanged and leaves the scene open; a call the transform's getters make on the scene takes effect, and the conversion answers from the transform it read.\
So a singular transform -- a root scaled to nothing -- is refused either way: a `DOMMatrix`'s inverse answers `NaN` members, which step 5 refuses, and Chrome's `SVGMatrix` throws `InvalidStateError` from `inverse`, which propagates, as it does from `toCanvas` today (measured).\
That is the arithmetic of `DOMPoint`'s `matrixTransform` for a two-dimensional matrix, so over a transform of finite numbers a conversion answers exactly what `new DOMPoint(x, y).matrixTransform(matrix)` answers, and follows whatever the platform's screen transform includes -- the root's place on the screen, its `viewBox`, its letterboxing.

**VS11 -- Exports.**\
`@apnex/vector-scene` exports `openScene`, and nothing else; it has no subpath.\
It imports no package and no module particular to one runtime, names and declares no global, touches no platform object but those VS1 names, and reads no clock and no randomness and holds no timer, so it runs over a browser's elements and, where there is no browser, over plain objects of their shape or with no root at all.\
Its TypeScript declarations state the platform slice VS1 touches as its own structural types, so a browser's `<svg>` element is assignable as a root; a shape's properties are read-only, and the type of a returned description is assignable to `put`'s.

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
| panning or zooming the view | not yet: held until its first consumer is designed (D6) |
| animation run frame by frame, or a canvas or WebGL drawing | not an animator: draw it in a foreign layer (D5) |
| HTML elements | not a page builder: every shape is an SVG element |
| SVG from an untrusted source drawn safely | not a sanitizer: it judges a shape's form, never its meaning (VS5) |

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
| I1 | `openScene` never throws while it judges a declaration, and answers every declaration with exactly VS3's problems, from a table of cases: present `undefined`, accessors, a phantom key, a revoked and a trapping `Proxy`, a declaration whose descriptor read throws -- `not-an-object` at `""`, nothing further read -- a function as the root, a root lacking each member in turn, each layer refusal, `attrs` refused whole and nothing beneath it checked, a duplicate name beside an invalid one, a value from another realm. | `vector-scene` |
| I2 | A rooted scene's layers are made and appended in order with their attributes; a throw at each platform call of opening, before or after the root takes the layer, leaves the root as it was and throws that error; `close` removes every layer in reverse, attempting each when one throws, then throws the first; a second `close` calls nothing; every other function throws once closed or failed; a platform method re-entering any function, `close` among them, while the scene writes is refused and changes nothing. | `vector-scene` |
| I3 | The scene touches nothing of the platform outside VS1: with a recording root, document, made elements and transforms, an opening, puts that create, patch, move and replace, a removal, both conversions and `close` log exactly VS1's reads, once each, and VS7's calls in order, and no read of a made element. | `vector-scene` |
| I4 | Over generated sequences of puts, moves and removals on a rooted scene, after every call the elements under each scene layer equal the descriptions `items` answers, each element's attributes compared as a map from name to value and an element made holding them in description order; each call made exactly VS7's platform calls, against a model of VS7 written apart. | `vector-scene` |
| I5 | Every reading of VS2 and VS5 from a table of arguments, each order held by a `Proxy` that records each trap: each refusal at each place stopping the reading there, a malformed argument refused before a closed scene's state is read, an accessor attribute refused with no getter run, a shape at depth 33 refused with nothing of it read, a shape holding both `text` and `children` refused before its `attrs` is read, a trap that calls the scene taking effect first, an `on` attribute in any case refused, a number written as `String` writes it, `-0` as `0`. | `vector-scene` |
| I6 | The same sequence on a scene with no root and on a rooted one gives equal `items` after every call. | `vector-scene` |
| I7 | `itemOf` answers every element made, at every depth, with its item and path, after patches and moves; `null` for a layer element, a foreign layer's content, the root, a removed element, a primitive and a `Proxy`, whose traps never run; and throws once the scene is closed or failed. | `vector-scene` |
| I8 | Every returned value is fresh and frozen to its depth; a description is the very value `items` answers again, holds `text` or `children` only when not empty, and is accepted by `put`, putting it again calling nothing; putting each layer's items into a fresh scene gives equal items; keys in their written order; no function needs a receiver. | `vector-scene` |
| I9 | Conversions compute VS10's arithmetic over recorded transforms, `-0` and extreme values among them; refuse a point that is no object, holds a non-finite coordinate or is read through a throwing getter; refuse with `Error` no transform, an `inverse` that is no function or answers no object, a member not a finite number -- a string, or the `NaN` a singular `DOMMatrix` inverse answers -- and an answer that overflows; and let a throwing getter's or `inverse`'s error out unchanged, the scene still open. | `vector-scene` |
| I10 | In headless Chrome, on an SVG root scaled and offset in its page: puts, patches, moves and removals leave each layer's elements equal to `items` as I4 compares them; an element kept across a sibling item's insertion keeps a running transition; a trusted press on a child shape, on an item's own shape, on the ground and in a foreign layer is mapped by `itemOf` of its target to that item and path, or `null`; `toDrawing` and `toScreen` equal `DOMPoint`'s `matrixTransform` over the root's screen transform for thousands of points; `close` leaves the root as found; Chrome is launched and torn down as `input-capture`'s I10 settled, so the test can neither fail nor hang on teardown. | gate |
| I11 | A consumer compiled with `tsc --noEmit` under strict settings, with and without `exactOptionalPropertyTypes`, passes an `SVGSVGElement` as `root` and an `items` answer's shapes to `put`, and lines that write a shape's property or give both `text` and `children` must fail to compile. | `vector-scene` |
| I12 | The source names no consumer's vocabulary and declares no global; the built files import no package, name no runtime global, no clock, timer or source of chance, and no route to `Function` (section 7). | gate |

**Each rule's own tests,** in `test/contract/`: one file per capability -- `declared-scene` (VS2 to VS4, I1, I2), `keyed-shapes` (VS5 to VS8, I3 to I6, I8), `shape-at-element` (VS9, I7), `screen-conversion` (VS10, I9) -- beside `returned-values-and-errors.test.js`, `public-types.test.js` (I11) and I10's `test/browser/`.

**The real-browser bar.**\
The component's I10 runs on every push in its gate; draw's real-browser tests and the pixel probe hold what draw draws, and the pixel probe is the arbiter of H26.4: it must find nothing, against production.

**Acceptance for H26.4, draw on `vector-scene`:**
1. `vector-scene` is released from its repository by its CI, and draw's lockfile pins the release file by its hash.
2. Every site appendix B marks *moves* or *native* goes through the scene, only the `renderer` part names `@apnex/vector-scene`, every site marked *stays* or *unchanged* is unchanged, and every site marked *translates* is the adapter appendix B names, retired by H26.8.
3. A new test, `vector-scene-move.test.js` in draw's `tests/`, finds that `app/src/renderer.js` writes no platform element, `app/src/painter.js` holds no `toCanvas` and no widget, the `editing` part's modules and `app/src/grids.js` make no element, `server/svg.mjs` swaps no `document` and builds no tree of its own, each page's canvas region holds no layer, and `PARTS.editing` holds the modules and consumes section 5.3 names.
4. First, before anything is deleted, a test keeps today's `app/src/renderer.js` and `app/src/painter.js` as verbatim copies pinned by their SHA-256, at `tests/fixtures/pre-scene/app/src/` so their own relative imports resolve, the four core modules they import answered by re-export shims, as H26.3 kept today's capture; it runs them beside the adapter over every stored diagram and template, the parity board and the lab's boards, through what a page does -- a load, a put, a set and a delete of every kind, a head gained and lost, selections, hover and arming, each mode, labels, the real reveal and the real towers -- finding after every step the layers' trees equal, element for element and attribute for attribute in order, the same elements kept and made afresh, each kept one at its former place, and the towers' glyph lookups equal; runs the export both ways over the same documents, finding it byte-identical; and replays the gesture corpus, finding the overlay's, snap layer's and grids' trees after every step equal, attributes in order, to a record today's code writes before the move, as `snap-grid`'s side-by-side kept its record.
5. Draw's full gate passes: the gesture corpus replays byte-identical; the harness restated to the platform's semantics (section 5.1) and every test appendix B marks *plumbing* restated to hand the scene, their assertions unchanged; the export's tests, the K8 page test, the affordance tests, the browser tests -- H14.12's trace among them, unchanged -- and the matrix corpus's boards pass; the gesture-sample probe finds its real gestures alike before and after; and a browser test runs the verbatim renderer and the adapter in two frames, finding the reveal's trace alike in every mode, computed values and pixels at sampled times, as section 6.2's evidence does.
6. The pixel probe against production, each side on its own dependencies, finds no pixel and no computed style changed in any mode, served SVG, favicon or lab board, and an independent verifier passes the move.
7. The product page and the lab page load the one release through the import map, and the server and the export load it by name, since the export draws through it (D8).

---

## 5. What draw supplies, and what stays draw's

### 5.1 The move

**Draw declares its scene once, in its composition** (`product/canvas.mjs`): `CANVAS_LAYERS` in order, each `{ name, attrs: { id: name } }`, and the two it draws itself, `pipes` and `movers`, foreign -- named where the product composes the plugins, since the canvas and the renderer may name no plugin's layer (`tests/canvas-names-no-plugin.test.js:31`) and consume no composition (`tools/layers.mjs:75`).\
The page's root (`app/src/main.js:56`) and the lab's (`lab/src/root.js:74`) hand that declaration to `composeCanvas`, which opens the scene on `#container` through the renderer's `openCanvasScene`; the export opens the same declaration with no root (`server/svg.mjs`); the generated canvas region keeps the root, its `viewBox` and its ground, and holds no layer, the scene appending them after the ground (`tools/canvas-layout.mjs`).

**H26.4 translates draw's painters through a live shadow** (`shadow.js`, new in `app/src/`): the renderer hands each painter and appearance a fragment of shadow nodes for its entity -- the export's headless node, moved there -- through the same kit, `el` and `setAttrs` building shadow nodes, and each change to one marks its entity, put at the end of the renderer's call, or at once for a change made outside one, the reveal's and the towers' among them.\
Each top-level node an entity draws is an item of its own, keyed by the entity's id for its own element and by the id and a serial for a companion, so a link's line, head, leg and click twin are four items, and a head gained or lost is an item put before the twin or removed, the line and the twin kept, as the painter keeps them.\
The shadow answers what draw's drawing code reads with the platform's semantics where draw could tell: `tagName` in SVG's case; `classList` as a DOMTokenList over the `class` attribute, so a token removed that is absent writes nothing; `isConnected` while its entity is drawn, so the towers keep their glyph as today; a write that changes nothing marks nothing; `style`, written into the `style` attribute; and, where the composition hands the platform's measure and settle -- the page, never the export or the harness -- `getTotalLength` of a path's `d` and `getBoundingClientRect` (D12).\
Draw's drawing order, composition, reflections and states stay in the renderer, unchanged: `place` puts every other entity's pending changes in that layer, computes the item the entity goes before from `items` as it walked the layer's elements, and puts the entity once, each item with that `before`, as `insertBefore` moved each element; `elementOf` answers the entity's own shadow node; `syncAll` removes every item it put.\
So no painter, appearance or plugin changes; H26.8 retires the shadow when each describes its item to the scene directly.

**The reveal's trace runs as written** (D12): its `show` measures the line with `getTotalLength`, writes its inline style, and forces a layout between two states; the shadow measures the same `d` with a probe path of draw's own that is never put on the page (`app/src/painter.js`, beside `el`), writes the style into the `style` attribute and puts it at once, and settles by putting the entity and asking the root its box, which has the platform compute the page's style, so the second state is a transition from the first, in every mode the reveal has (section 6.2).

**H26.4 writes draw's own editing visuals natively,** in the `editing` part (section 5.3), each an item whose key names it:
- `crosshair` in `snaplayer`, two `line.gridline` and one `rect.snapbox`, put on each show, kept and patched as it moves, removed on hide, one owner still (B36); and `datum` there, removed and put afresh each time it moves, as today;
- `handles` in `overlay`, one `rect.handle` per point with its data key, removed and put afresh on each refresh so they land on top as today;
- each preview -- the stamp ghost, the preview rect, line and path -- an item keyed by its kind and a serial, so the held tool's ghost, the palette's dragged tile and a gesture's preview never share one, put last when made, patched as it follows the pointer, removed when done;
- each grid one item of its layer, removed and put afresh on each load, as `replaceChildren` made its dots afresh (`app/src/grids.js`, `canvas`);
- `toDrawing` the scene's for capture's adapter and the palette, and `toScreen` for the label editor, each the same arithmetic over the same transform, so `toCanvas` leaves `app/src/painter.js`.

**The pipes and the movers draw into foreign layers,** their code unchanged, handed `layerElement('pipes')` and `layerElement('movers')`; H26.8 makes the pipes items, and the movers stay foreign, since they animate.

**What draw's picks read stays as it is:** `hitWith` reads the target the browser found, now an element the scene made, carrying the same attributes; `itemOf` waits for H26.8, when draw's picks name items rather than selectors.

**Where it is opened** follows draw's layer rules:
- only the `renderer` part imports `vector-scene` (`tools/layers.mjs` `COMPONENTS`, D9); `app/src/renderer.js` exports `openCanvasScene`, which opens a scene or throws naming its problems, as `kernel/input-rules.mjs` opens a session;
- `composeCanvas` (`canvas`, which consumes `renderer`) and the export (which consumes it by H2) call it; the canvas and editing modules, the palette and the tools use the scene they are handed, a value, as Input uses `input-binding`'s session;
- `shadow.js` joins the renderer part, names no plugin's kind, and reaches no DOM global (`tools/scan-writers.mjs`), the probe and the settle being `app/src/painter.js`'s, which may;
- G1 holds: `app/src/input.js` reads no DOM, its previews taking the scene.

**The test harness** is restated to the platform's semantics the scene relies on: a fake element's `appendChild` detaches a child it moves, as its `insertBefore` already does; its `class` attribute and `classList` are one state; `textContent` replaces its children; a removal leaves the id registry (`tests/fixtures/client-harness.mjs:55-131`); `makeInput` and `makeRenderer` open a scene over the fake root and find the layers it appended; and each test that handed an element hands the scene, its assertions unchanged (appendix B).

**Evidence.**\
A drafting prototype of revision 2 -- the component as section 3 states it and draw's renderer translated onto it as above, in a copy of the tree (`~/taceng/drawv2-eval-runs/h26-readings/vs/drafting/r2/`) -- shows:
- over all 16 stored diagrams and templates, 583 steps -- loads, puts, sets and deletes, a link's head gained, turned and lost, selections, states, modes, the real reveal and three frames of the real towers -- trees equal to today's renderer's on a tree with the platform's semantics, attributes in order, the same elements kept and made afresh, each kept one at its former place, the scene's items equal to what it wrote, and 55 glyph lookups each side, where revision 1's adapter in the same run kept other elements at every head gained or lost, put 515 moves beyond its items on load, and looked a glyph up 117 times (`page-side-by-side.mjs`);
- in Chrome, today's renderer and the adapter in two frames over the same 16 documents and 508 steps, the reveal tracing for real: trees, identity and each document's final pixels equal (`chrome-side-by-side.mjs`);
- the reveal's trace in Chrome in every mode it has, at 81 sampled times (section 6.2, `chrome-trace.mjs`);
- the export byte-identical for all 16 through a scene with no root, its 35 tests in five files passing (`export-side-by-side.mjs`); the lifecycle cases (`lifecycle.mjs`); a scene in Chrome mapping trusted presses by `itemOf` and converting 10,000 points exactly (`chrome-scene.mjs`); and each behavioural finding of reading 1 run on both revisions (`reading-1.mjs`).

It does not cover the native editing visuals, the grids and the harness, which acceptance steps 4 and 5 hold at build.

### 5.2 Where each piece of the canvas layer lands

H26-10 draws each boundary first inside draw, as a declared part of the architecture manifest held by the scanners, and extracts it when a second consumer is in sight (P4).\
Each piece of what draw's canvas layer does today lands here; a part is named as `tools/layers.mjs` `PARTS` names it:

| Piece | Today | After H26.4 | After H26.8 | Beyond |
|---|---|---|---|---|
| layers, the item diff, the element-to-item map, conversions | `renderer`, `toCanvas` | `vector-scene` | `vector-scene` | -- |
| what each kind draws, composition, drawing order, reflections | `renderer` | `renderer`, through the shadow | `renderer`, describing shapes | -- |
| the selection; the visuals: crosshair, snap box, previews, stamp ghost, marquee rectangle, resize handles, hover, arming, datum | `canvas`, `renderer` | `editing`, native (5.3) | `editing` | B389 |
| the editing gestures: move, clone, pending, handle, marquee | `canvas` (`app/src/input.js` `GESTURES`) | `canvas`, previews over the scene | `editing` | B389 |
| which ids carry which state class | `renderer`, with the parts' `reflects` | `renderer`, on shadow nodes | `editing` answers, `renderer` describes | B389 |
| the draw-a-link and box gestures, routing, rules, capture's adapter, picks, commands, readout | `canvas` | `canvas` | `canvas`, adapters keeping draw's policy | -- |
| grid dots | `canvas` (`app/src/grids.js`) | `canvas`, an item per grid | `canvas` | B415 |
| the inline text editor | `canvas` (`app/src/labeledit.js`) | `canvas`, through `toScreen` | `canvas` | B416 |
| the help overlay from the bindings | `canvas` (`app/src/help.js`) | unchanged | unchanged | B417 |
| the palette | `product-page` | `product-page`, its ghost an editing visual | `product-page` | draw's own |
| pipes | the network plugin, into `#pipes` | a foreign layer | the network's items | -- |
| movers; the reveal's trace | the simulation plugin | a foreign layer; the trace through the shadow | movers foreign; the trace two puts, measured and settled by draw | -- |
| what a person sees, as data | -- | `items`, translated | `items`, native | B418 |

### 5.3 The declared `editing` part

**Duty:** let a person select, move and resize what the canvas draws -- the selection, the gestures that edit it, and the visuals that show what an edit will do (B389, as H26-10 widened it).\
**Kind:** `host`, naming no plugin, so it consumes only core parts (`tools/layers.mjs:75`); `by` cites D1 and H26-10.\
**Consumes** `lattice` and `document`: `app/src/overlay.js` takes its node radius from `kernel/spec.mjs` rather than `app/src/snap.js`, so it reaches no canvas module, and the scene, the renderer's states and the parts' declarations arrive as values; **consumed by** `canvas` -- Input, the tools, the composition -- and `product-page`, the palette.

**Modules:**
- at H26.4, `app/src/selection.js`, unchanged, from `canvas`; `app/src/overlay.js`, rewritten natively, from `canvas`; and `editing-visuals.js`, new in `app/src/`, holding the crosshair, the stamp ghost and the preview rect, line and path, the six functions that leave `app/src/painter.js` (`renderer`) as H26.4 rewrites them;
- at H26.8, a module of its own for the five generic gestures' bodies -- `move`, `clone`, `pending`, `handle` and `marquee` -- out of `app/src/input.js`'s `GESTURES`, with what they call that is mechanism, draw's policy reaching them through Input as today's bodies already take it; the draw-a-link and box gestures stay `canvas`'s, being draw's: the network judges a link, a plugin declares a box;
- the plugins' selection reflections stay each plugin's declaration (`reflects`), and which state class an id carries joins the part at H26.8, when the renderer describes states as classes in each item.

**Declared at H26.4, completed at H26.8.**\
H26.4 rewrites every editing visual natively anyway, so the part costs it a manifest entry and the move of six functions into the module it writes; declared later, the same files would be written twice.\
The gestures' bodies wait for H26.8, which rewrites Input's entry points as the editor reads `input-capture`'s facts, and with them the three places that pin `GESTURES` in `app/src/input.js` (`tests/fixtures/binding-parity.mjs:34`, `tests/input-binding-move.test.js:120`, `tests/releases.test.js:140`); moving them at H26.4 would restate those for no drawing reason.\
Meanwhile the scanners hold the boundary: `tools/generate-architecture.mjs` fails an import from an editing module of a part outside its consumes, so nothing can make the later extraction more than a move, and `tests/canvas-names-no-plugin.test.js` already reads every module in `app/src/`.

**Stays draw's,** because it is draw's content or policy:
- every painter, appearance, look, class and stylesheet; the appearance pipeline's composition; drawing order; reflections; what `selected`, `hover` and `armed` mean;
- the root, its `viewBox`, its ground and its classes -- modes, labels, shown grids -- and the defs in `#kdefs`;
- which layers exist and their order (`CANVAS_LAYERS`), and the export's flattening, styling and bounds;
- the picks (`app/src/pick.js`), the gestures' geometry (`anchorAt`), the label editor's scale and boxes, the palette, the movers' animation, and the `editing` part until B389's trigger.

---

## 6. How the parity is kept

Draw's page must show what it showed, pixel for pixel, and its export must write what it wrote, byte for byte.

### 6.1 Four tests from three sides

The component's tests hold section 3 alone; acceptance step 4 holds old against new over every document and every kind of change draw makes, elements' identity included; the gesture corpus, the renderer's and export's tests, the K8 test, the browser tests and the trace's two-frame test hold what draw does with the drawing; the pixel probe holds what is seen.

### 6.2 The differences a careful reader looks for

- **The layers made by the scene.** The page's markup holds the root, its `viewBox` and ground; the scene appends the eleven layers after the ground when the canvas is composed, with the ids they had, so the booted DOM is today's and the K8 test unchanged; before the modules run the root holds no layer, and draws nothing then either.
- **Changes put at a call's end.** A painter's change reaches the page when the renderer's call returns rather than at once; nothing runs between, no event, no frame, so nothing can see the difference; and a write that changes nothing -- the reveal's hide, on every tick -- puts nothing.
- **Attributes written when they differ.** A painter's update rewrote every attribute of its look; the scene writes those whose values differ, so the page's elements end the same, and only a mutation observer, which draw has none of, could count the writes.
- **Element identity.** The same elements are kept and made afresh as today, each top-level element being an item of its own, measured over every stored document in Node.js and in Chrome (section 5.1), so a pointer captured to an element, a transition on it, a hover and the towers' cached glyph meet no difference.
- **The reveal's trace.** Chrome against today's code, at 81 sampled times: the same computed `stroke-dasharray`, `stroke-dashoffset`, opacity and visibility, the same inline dash and transition as the CSSOM reads them, and the same pixels -- for an open solid link, a dashed control link, a closed directed ring whose line is offset, the velocity mode, a hide mid-flight and the trace begun again, a hide and a show in one task and a second trace, the route changing mid-flight, the link gaining a head mid-flight, each from its start to past its end, and a node's fade; the two frames drew alike before any trace (`chrome-trace.mjs`).
- **The `style` attribute's text.** It is the shadow's own serialization, `257.14285714285717ms` where Chrome's serializer writes `257.143ms`, parsed to the same values; nothing reads that text, and H14.12's browser test reads the CSSOM, unchanged.
- **The conversions.** The scene's arithmetic is `DOMPoint`'s over the same matrix: equal under `Object.is` for 120,042 points over six window sizes, `-0` and extremes among them, and 10,000 more both ways (`chrome-conversion.mjs`, `chrome-scene.mjs`); Chrome's `createSVGPoint` answers a float32 point, different in nearly every case, which is why the scene computes rather than asks it.
- **The export.** It reads the scene's descriptions where it walked its own tree, and swaps no `document`; byte-identical for every stored document.
- **Lookups by id.** The renderer finds an entity's element by its item where it asked `getElementById`; the label editor still asks the document, and finds the element the scene made, with the same id.

### 6.3 Defects the inventory found, and what H26.4 changes

H26.4 is an extraction: it changes nothing any input of draw's pages produces, and keeps every behaviour, defects included.

**Inputs nothing in draw produces, which now behave differently** -- listed so that this section is exhaustive for every input a page, a test, a document or a composition can produce:
- an attribute whose name is not of VS5's form -- a namespace prefix, a character outside it, a leading `on` -- or whose value is neither a string nor a finite number, is refused when put, where today `setAttribute` wrote it, or threw for an invalid name; `NaN` was written `"NaN"`; draw's painters write 31 attribute names, none refused, over every stored document in every mode (`shape-census.mjs`);
- a tag not of VS5's form is refused; draw's are `circle`, `g`, `path`, `rect`, `svg`, `text` and `use`;
- shapes nested more than 32 deep are refused; draw's nest at most 3;
- a root that answers no screen transform, a transform whose `inverse` is no function or whose members are not six finite numbers, or a point whose answer is not finite makes a conversion throw Errors' `Error`, where `toCanvas` threw a `TypeError` or answered `NaN` or an infinity; a singular transform in Chrome throws the platform's `InvalidStateError`, as today;
- a root that refuses to take a layer as the scene opens leaves no layer behind and throws, where today the markup held them;
- a painter's change made after its call with no renderer call to follow -- none but the reveal's and the towers', which are put at once -- would reach the page at once, as today.

**Kept, each registered:** every element in the document is drawn whether in view or not (B289), and a diagram cannot vary its grids (B325), each held for pan and zoom.\
**Found and kept, registered when this is ratified:** a link revealed by a trace keeps the trace's inline dash -- one dash its measured length -- through every in-place update until it is drawn afresh, so a control or down link revealed by a beat is drawn solid and a route made longer shows a gap past that length, in today's code and the shadow's alike (`chrome-trace.mjs`).

---

## 7. What this piece needs of the shared parts

`SNAP-GRID.md` section 7 is settled and built three times: the repository, the vocabulary and runtime checks, the gate and its consumer test, the release workflow, how draw pins a release, the import map, the vendor mount and the architecture manifest serve `vector-scene` unchanged.\
Where this piece differs:
- **The repository** is `apnex/vector-scene`, its package `@apnex/vector-scene`, laid out as 7.1 lays out a component, with `lib` `ES2022` alone and `"types": []`: no DOM library, the platform slice being its own types (VS11, D2), and `input-capture`'s source check refusing any `declare`, `.d.ts` file or triple-slash directive in `src/`.
- **`package.json` `exports`** has one entry, `.`, and `export-map.json` maps `openScene` to all four capabilities, `{ part: 'vector-scene', serves }`, `deferred` empty.
- **The runtime and clock checks** are `input-capture`'s, as widened at its build: `Intl`, `Temporal`, `WeakRef` and `FinalizationRegistry`, `eval`, `Function` and a call through a `constructor` property refused besides 7.2's list (B414); a `WeakMap` is no clock and is allowed.
- **The consumer test's exercise** opens a scene with no root in Node.js, puts an item, reads it back and puts the description again, and in the page opens one on an `<svg>`, puts an item and finds its element, converts a point and closes.
- **I10, a browser test,** joins the gate as `input-capture`'s did, over Node.js's global `WebSocket`, with its teardown.
- **The vocabulary check** runs both lists over `src/`, comments included, and an SVG component meets their words: the DOM's `Node` and Node.js, `<a>`'s `link` and `anchor`, SVG's `glyph`, and a page's `layout` -- the contract says shape, element and lays out; no name in section 3 holds one, checked with the check's own match.
- **The built size** is recorded at build, as the earlier three recorded theirs.
- **Draw's side:** the dependency line and lockfile (7.5); the import map regenerated, and the tests that list the installed components restated; `COMPONENTS` gaining `@apnex/vector-scene` with the `renderer` part alone; `PARTS` gaining `editing` (5.3), `canvas` losing `app/src/selection.js` and `app/src/overlay.js` and consuming `editing`, `renderer` gaining `shadow.js`, `LAYER`'s `canvas` list naming both new modules and `ALLOWED` unchanged, since every module stays in the `canvas` layer; `MISSION_KIT` and `ALIGNMENT` restated and the architecture documents regenerated, each with the words appendix B gives (7.7); and the image installing it for the server, since the export draws through it.
- **A deploy in flight** spans four components; the window is the one 7.6 names and B403 holds, unchanged.

---

## 8. Decisions owed

Each is offered with a recommendation; D1, D6 and D8 the director has answered, each to be recorded as a ruling at ratification.\
The ruling that ratifies this piece is written `H26-r` below until it has its number.

| # | Decision | Recommendation, and why |
|---|---|---|
| D1 | A shape is data in SVG's vocabulary -- a tag, attributes, and text or child shapes (VS5), the application's own and trusted as its code is -- not an element the application builds and not a callback the scene calls | yes, as the director answered on 2026-10-22: data is what the scene can compare, read back, run with no platform and hand to a second application -- the tester describes keys, zorg's web canvas its entities, an agent reads what a person sees (B418) -- and it is what draw's hand previews already are (`app/src/painter.js:58-64`). Weighed against elements built by the application (the scene could not diff or run headless, and the application keeps the platform), and against draw's callbacks over a kit, the cheapest to adopt (every painter would stay), but which make the kit the contract, need a fake platform in Node.js as the export has today, and leave diffing to each painter, where B218 and B228 were missed updates |
| D2 | The scene owns the elements under its layers, writing them through a closed slice of the platform (VS1) with no DOM library, and runs with no root in Node.js | yes: one owner of the canvas's elements, held to a list a recording test checks, as `input-capture`'s D2 held its; the export draws through the same code with no fake `document`. Weighed against handing the application the elements to write (the boundary gone) and against a scene that only describes and a host that writes (a second component, or each application writing the same writer). The cost is a browser test in the gate, as `input-capture` already carries |
| D3 | Diffing is the scene's: old description against new, list by list and position by position, an element kept where the tag is the same, never reading the platform (VS7); an element an application needs kept across a sibling's insertion is an item of its own | yes: the simplest rule two builders cannot read two ways, and with an item per top-level element it keeps exactly the elements draw's painters keep, measured in Node.js and Chrome. Weighed against keyed children (no consumer reorders children, and items of their own serve draw's one insertion; registered) and against reading the platform to diff (it would run whatever another writer did, and need a wider slice) |
| D4 | What lies under a point is answered by element -- `itemOf` maps the element the platform hit-tested, `input-capture`'s target, to its item and path -- not by geometry; draw keeps its picks by selector until H26.8 | yes: the platform already decides painted areas, `pointer-events` and dashes, which draw's picking depends on (B268's twin exists for the browser's rule), so answering by element matches today exactly; geometry would be a second hit test that disagrees at every stroke's edge. Weighed against a geometric query (no consumer needs one; registered) and against `elementsFromPoint` for every shape under a point (a wider slice, and no consumer yet) |
| D5 | Layers are declared as data in order, each a `<g>` the scene creates with its attributes and alone writes on; a foreign layer is created and ordered but drawn beneath by the application; within a scene layer an item goes before a named item or last | yes: draw's eleven layers are already one declaration (`CANVAS_LAYERS`) its export reads, and the scene making them ends the page's copy of it; a foreign layer serves what cannot be described -- the movers' animation -- and draw's pipes until H26.8. Weighed against adopting layers the page's markup holds (the declaration then lives twice), and against z-order by a rank the scene sorts by (draw's drawing order is draw's policy, and `before` states any order) |
| D6 | No view state in `0.1.0`; the view -- pan, zoom, a layer told the visible area and scale -- is added by a minor release when its first consumer is designed, pan and zoom (H26.6) or the gesture tester's scope (H26.5) if it needs a moving view, whichever comes first | yes, as the director refined it on 2026-10-22, as the wheel was for `input-capture`: every term of the contract already means what it will mean with a view. The conversions answer in drawing coordinates, the root's own while no view is declared and the layers' when one is, so `toDrawing` and `toScreen` keep their meaning whichever form the view takes; a view written as the root's `viewBox` carries every layer, foreign or not, as today, and one written as a transform on the layers is the scene's to write on the layer elements it alone writes on (VS4), so the pipes and the movers follow it with no change to their drawers; a grid layer is told the visible area and scale by a new function, or declared fixed to the screen by a new optional field -- each additive, since a declaration refuses unknown fields today and so no valid one holds them; and the members a view needs of the root are read only from a scene that declares one, so every root valid today stays valid. Weighed against a view in the declaration now, fixed at draw's `viewBox` (a field draw never moves, whose form the consumer may need otherwise), and against the whole view API now (no consumer) |
| D7 | Selection visuals, states and overlays are the application's shapes -- a class is an attribute it describes, a preview or a handle an item -- and the root and everything on it but the appended layers are the application's | yes: what a selection looks like is policy, and the scene holding no notion of state is what keeps it one duty; draw toggles classes on shadow nodes at H26.4 and describes them at H26.8. Weighed against a state API on items (draw's states would name the scene's vocabulary, and the tester's differ) |
| D8 | H26.4 translates draw's painters, appearances, reveal and towers through a live shadow, writes draw's own editing visuals and grids natively, draws pipes and movers in foreign layers, and moves the export onto a scene with no root; H26.8 retires the shadow and draw's picks by selector, and makes the pipes items | yes, as the director answered on 2026-10-22, which allowed one plugin change, the reveal's trace; revision 2 needs none, since the shadow carries the trace identically (D12), so H26.4 changes no plugin and its side-by-side compares old and new exactly, elements' identity included. Weighed against translating everything (a smaller H26.4, a larger H26.8, and translation built only to be retired) and against moving every painter to shapes now (every plugin changed in H26.4, losing the exact side-by-side H26-9 relies on) |
| D9 | Draw's `renderer` part alone imports it, through `openCanvasScene` in `app/src/renderer.js`; the canvas, the `editing` part and the export use the scene it opens, the declaration handed by the composition | yes: the part that draws holds the adapter, as the lattice holds `snap-grid` and the rules part `input-binding`; the canvas and the export consume `renderer` already, and the declaration names plugin layers, so only the composition may write it. Weighed against the canvas part (the export would then need the canvas) and against a part of its own (it would consume and be consumed by the renderer) |
| D10 | No conformance kit; no clock, no timer, no randomness, no animation | yes: nothing is a port another party implements; animation is time, the application's, run frame by frame in a foreign layer or declared to the platform in an attribute |
| D11 | `@apnex/vector-scene` released as `0.1.0` from `apnex/vector-scene`, its one export path `.` | yes: `SNAP-GRID.md` section 7 unchanged; `0.x` until mission-kit admits it |
| D12 | The reveal's trace runs as written: the shadow answers the three members it uses -- `style`, written into the `style` attribute; `getTotalLength`, a probe path of draw's own measuring the same `d`; `getBoundingClientRect`, putting the entity at once and settling the page's style through the root -- each only where the page hands the platform's measure and settle | yes: identical to today in Chrome in every mode the reveal has, computed values and pixels at 81 sampled times (6.2), and no plugin changes. Revision 1's CSS animation is withdrawn: its computed dash was normalised to 1 where today's is the length, it moved a closed ring's dash off its line once done (o:F4), and it restarts only if the page computes style between a hide and a show, which the reveal's loop does not promise. Weighed against that animation, against the scene measuring or settling (a platform read outside its slice, and time in the scene), and against the trace dropped to a fade (H14.12 ruled the trace). At H26.8 the reveal describes the trace's two states as two puts, measuring by its own probe and settling the page between them: the same steps, with no shadow |
| D13 | Draw's editing duty is a declared part, `editing`, from H26.4: the selection and the editing visuals now, the five generic gestures' bodies at H26.8 (5.3) | yes: H26.4 writes every editing visual natively anyway, so declaring the part then costs a manifest entry and a module it writes regardless, and makes the later extraction a move held by the scanners; the bodies wait for H26.8, which rewrites Input's entry points and the three places that pin `GESTURES`. Weighed against all of it at H26.4 (three tests restated for no drawing reason), against waiting for B389's trigger (the visuals written twice and the boundary unheld until then), and against a component now (no second consumer: P4) |

**Registered when this is ratified,** each with its revival trigger (RU3):
- the view -- pan, zoom, the visible area and scale told to a layer: when its first consumer is designed, pan and zoom (H26.6) or the gesture tester's scope (H26.5) (D6);
- a shape found by geometry: when an application needs the shape under a point with no platform, or under a captured pointer (D4);
- children kept or reordered by key: when an application's shapes reorder, or gain siblings before elements it needs kept, often enough that items of their own or positional diffing are measured to cost (D3);
- draw's pipes as items, its picks by item, its painters describing shapes, its editing gestures in the `editing` part: with H26.8, on the board;
- a link that keeps its trace's dash after the trace, a defect H26.4 keeps (6.3): filed when this is ratified, its fix a trace that leaves no dash behind.

---

## 9. Axiom alignment audit (M7)

**Identity.**\
H26.0 part 4 at revision 2, read against `569c0a8` and mission-kit at `e33c850`, audited in three layers:
- the library: T1's test applied -- a scene writes its descriptions, reads them back at every put and at `items`, and the application relies on the page showing them -- so `declared-scene` and `keyed-shapes` are stateful, and A1 binds them; it coordinates no actors and runs no model;
- the release process: unchanged from part 1, built three times;
- the consumer: draw, stateful, multi-agent and autonomous as `MISSION-KIT-ALIGNMENT.md` section 5 reads it, to which the move adds a fourth installed component, loaded by its server too, and a declared part.

**Verdict.**\
Revision 1 was `revise-before-implementation`, by its first reading: how the screen transform is read and refused, the order declarations and shapes are read in and what re-entry sees, whether a move re-inserts and what a throwing platform call leaves, whether a returned description could be put back, and the trace's end state were each open or wrong, and the adapter replaced elements draw keeps (section 10.1).\
Revision 2 is `pass, with guardrails`, by its author; its standing is to be confirmed by a second reading.

| Layer | Axiom | Weight | How the design stands |
|---|---|---|---|
| library | A3 Sovereign Composition | load-bearing | One duty, one scene kept equal to its description (3.1); what is drawn and what it means are the application's, as data (D1, D7); the platform reached only through what it is handed (VS1, D2). |
| library | A1 Sovereign State Transparency | load-bearing | Toward the limit: the scene's whole state but its elements is `layers` and `items`, frozen data its owner reads at any moment and can put back, from which the scene can be rebuilt (VS8); its owner alone changes it. Short of the limit, and recorded: it is transient -- a reload ends it and the page puts its items again -- and a failed scene keeps what it wrote until closed. |
| library | A8 Gated Recursive Integrity | load-bearing | Section 4 holds each rule by a test that can fail, the diff against a model written apart, the slice by a recording test, and real rendering in real Chrome in the gate (I10). |
| consumer | A5 Perceptual Parity | load-bearing | The page and the export draw from the same descriptions through the same code; the pixel probe finds nothing (acceptance step 6); and what a person sees becomes data an agent can read (B418). |
| consumer | A8 Gated Recursive Integrity | load-bearing | The side-by-side over every document and change, identity included, the trace in two frames, the export byte for byte, the corpus, the browser tests, the probe and a verifier prove the move; a prototype already passes the first three. |
| consumer | A9 Chaos-Validated Deployment | supporting | Nothing new is claimed of a deploy; the in-flight window stays registered (B403). |
| all | A4, A14 | supporting | Rulings recorded in draw and the component's record; what the earlier readings and builds settled is adopted whole (VS2, section 10); the boundaries H26-10 names are drawn now, not rediscovered later (5.2, 5.3). |
| all | A2, A6, A7, A10, A11, A12, A13 | not materially implicated | No trait brings A2, A11 or A12 into force; no seam between agents is designed; A13 is served by section 8's decisions, each with a recommendation. |

**Tensions, and how they resolve.**
- H26-1's viewport against P4: named in the duty, held until its first consumer is designed, every term of the contract already meaning what it will with a view (D6).
- `itemOf` with no draw consumer at H26.4 against P4: the duty names it, the tester and H26.8 consume it, and it costs a map (D4).
- A translation layer against H26-9's target: one module, retired by H26.8, answering the platform's members draw's drawing code reads so that no plugin changes, while draw's own visuals are written natively now (D8, D12).
- A declared `editing` part against P4: declared inside draw, not extracted, until a second application needs it (D13).
- A component touching a platform against neutrality: held to a closed slice, no global, nothing of an element read (VS1, I3).

**Guardrails for the build.**
- G1: every site of appendix B is dispositioned as its row says (acceptance steps 2 and 3), held by a test in draw.
- G2: the scene touches no platform member outside VS1, reads nothing of an element it made, names no global, declares none and loads no DOM library (I3, I12).
- G3: the vocabulary check runs on `src/` comments included, and draw runs it on what it installs.
- G4: H26.4 changes no behaviour of any input draw's pages produce, and keeps every element draw keeps; the inputs nothing produces are those 6.3 lists; the pixel probe finds nothing.
- G5: only the `renderer` part imports `vector-scene`.
- G6: the export draws through the scene with no root, byte-identical, and swaps no global.
- G7: no plugin changes in H26.4; the shadow is the one translation, named for H26.8.
- G8: I10 passes in the component's gate on every push, its teardown unable to fail or hang a run.
- G9: the `editing` part consumes only core parts and holds section 5.3's modules, held by `tools/generate-architecture.mjs`.

**Closeout hooks.**\
H26.4's verifier re-checks G1 to G9 and acceptance steps 1 to 7; mission-kit admission is asked only after draw runs on the release (C0).

---

## 10. Reviews

H26-3 requires a multi-family reading through context-lab's review panel (M1) before ratification.\
What the first three components' readings and builds found, by kind (`SNAP-GRID.md`, `INPUT-BINDING.md` and `INPUT-CAPTURE.md` sections 10 and 11, each component's decision record, D2), is adopted whole by VS2, the Errors and What is returned paragraphs, VS3's lifecycle, VS1's slice, section 7's checks and I10's teardown; reading 1 found where revision 1 had adopted them only in part.

### 10.1 Reading 1 -- 2026-10-22, of revision 1 at `567caec`

Read cold through context-lab's review panel, `--tools on --verify`, the repositories mounted read-only, by `gemini-4-argon` (`a`), `grok-4.20-non-reasoning` (`x`) and `gpt-6-astra` (`o`), none of which drafted it, the reading kept whole at `~/taceng/drawv2-eval-runs/h26-readings/vs/reading-1/` outside the repository.\
It reported 29 findings: 14 from `a`, 11 from `o` and 4 from `x`; 17 blocking, 10 should-fix and 2 minor.\
Every reader returned verdicts on the others' findings: `a` supported all 11 of `o`'s and refuted all 4 of `x`'s; `o` supported 12 of `a`'s 14 and refuted all 4 of `x`'s; `x` supported 4 of `a`'s and none of `o`'s.\
Every finding was read against the code at `569c0a8`, and each behavioural claim was run -- in Chrome where it is rendering or animation, which `o` could not run -- the scripts kept in `~/taceng/drawv2-eval-runs/h26-readings/vs/drafting/r2/` (section 5.1's evidence).\
The director answered D1, D6 and D8 and ruled H26-10 while the reading ran.

| Finding | What it said | Disposition, and why |
|---|---|---|
| a:F1 | how the transform's `inverse` and `a` to `f` are read, judged and refused is unspecified | **Fixed**, as `o` supported, reproduced -- revision 1 threw V8's own `TypeError` for an `inverse` that is no function: VS10 reads `inverse` once, refuses it unless a function and its answer unless an object, reads all six members before judging them, each refusal Errors' `Error`, a platform throw unchanged with the scene open; I9 holds each. |
| a:F2 | the declaration's reading order and IB3's suppression not adopted | **Fixed**, as `o` supported: VS2 rule 2 reads breadth first as IB2 rule 8 does, VS3 adopts IB3's suppression and `not-an-object` for a refused `attrs` record -- revision 1 answered `invalid-value`, reproduced; I1 holds the cases. |
| a:F3 | when a shape's depth, keys, `text` and `children` are judged, against its `attrs`' traps | **Fixed**, as `o` supported, reproduced -- revision 1 read `attrs` before refusing both `text` and `children`: VS2 rule 4 judges depth before reading, then keys and descriptors, then values; I5 holds both cases. |
| a:F4 | state checked before arguments, `close` while writing, a conversion's getter closing the scene | **Fixed**, as `o` supported, each reproduced on revision 1: every function reads its arguments before the scene's state, `close` throws while the scene writes, and a conversion judges the state after reading its point. |
| a:F5 | whether `before` naming the place an item already stands re-inserts it | **Fixed**, as `x` read it: VS6 states that `before` always moves, as draw's stacking inserts each element unconditionally (`app/src/renderer.js:324`), so the adapter's calls are today's. |
| a:F6 | the element map's timing under a throw, `itemOf` on a failed scene, and patching empty text and children | **Fixed**, as `o` supported: `itemOf` throws once failed or closed and while the scene writes -- revision 1's prototype answered, reproduced -- so the map's timing is never observed; VS7 step 4 states the four content cases. |
| a:F7 | the trace's `hide` and velocity mode unspecified, and the drafted reveal never edited | **Fixed** by D12's revision: the reveal is unchanged and runs on the shadow, whose `getTotalLength` keeps velocity mode's measure and whose unchanged writes put nothing, so `hide` on every tick puts nothing; Chrome finds every mode identical (6.2). |
| a:F8 | native widgets break tests and the harness unless their keys and seams are specified | **Fixed**, confirmed: section 5.1 names each widget's item and key, preview keys made unique, and appendix B restates the four tests that handed an element, their assertions unchanged. |
| a:F9 | deleting `toCanvas` breaks the capture oracle's shim and L4's exception | **Fixed**, confirmed: today's `app/src/painter.js` is kept verbatim beside today's renderer (acceptance step 4), and the capture oracle's shim re-exports `toCanvas` from that copy, so the oracle keeps today's conversion, independent of the new; L4's entry names both. |
| a:F10 | the adapter puts every new item twice, and a no-op `classList` call writes `class=""` | **Fixed**, reproduced -- revision 1 put 515 moves beyond its items on load: `place` puts the entity once with its placement, measured at no patch or move on load; the shadow's `classList` follows DOMTokenList, though no element draw makes lacks a class, so revision 1 differed nowhere. |
| a:F11 | appendix B misses tests asserting the export's source and the installed components | **Fixed**, confirmed: `tests/span.test.js:805`, `tests/probe-sides.test.js:94`, `tests/import-map-browser.test.js:93` and `tests/canvas-gestures.test.js:181` added. |
| a:F12 | the animation's timing differs and its style lingers, blocking a later dash | **Withdrawn with D12's animation**: revision 2's trace is today's, timing included; the lingering dash is today's defect, measured alike and now stated as kept through in-place updates (6.3). `o` refuted it. |
| a:F13 | how a grid layer and the foreign layers follow a moving view is not shown | **Fixed** by the director's refinement of D6: conversions answer in drawing coordinates, a layer's element is the scene's alone (VS4), and D6 shows each form the view may take additive. |
| a:F14 | `-0` and attribute order are not stated | **Fixed**, though `o` refuted it as implied: VS5 states `-0` written `0` and why the record's key order is kept; one sentence each. |
| o:F1 | a returned description cannot be put back | **Fixed**, reproduced: a returned shape holds `text` or `children` only when not empty, so it is valid input; I8 and I11 put it back. |
| o:F2 | ordered serialization in I4 and I10 contradicts VS7 keeping attribute positions | **Fixed**, reproduced: I4 and I10 compare attributes as maps, an element made in description order; draw's ordered comparison is old against new (acceptance step 4). |
| o:F3 | conversions have no numerical or failure domain | **Fixed**, reproduced -- revision 1 answered an infinity, `NaN` and a string: VS10 refuses members that are not finite numbers and a non-finite answer, and states the singular transform, refused either way -- Chrome's `inverse` throws, measured; I9 holds each. |
| o:F4 | the animation restores the wrong offset on a closed directed ring | **Withdrawn with D12's animation**, confirmed: today's inline offset holds the ring's line, and revision 2's trace keeps it, a closed directed ring among Chrome's modes (6.2). |
| o:F5 | recreating an item on a structural change breaks elements draw keeps | **Fixed**, reproduced: each top-level element is an item of its own, so a head gained or lost keeps the line and twin; identity measured equal over every document in Node.js and Chrome, and VS7 states what keeps an element. |
| o:F6 | the trace's evidence does not prove parity | **Fixed:** `chrome-trace.mjs` drives today's reveal and revision 2's in two frames, asserting computed values and pixels at controlled times, interruption, a hide and show in one task, a closed ring and a route changed mid-flight among them; acceptance step 5 makes it a test. |
| o:F7 | the declaration has no route through draw's composition boundary | **Fixed**, confirmed against `tools/layers.mjs:75` and `tests/canvas-names-no-plugin.test.js:31`: `product/canvas.mjs` declares it, and the roots hand it to `composeCanvas` and the export (5.1). |
| o:F8 | deleting `toCanvas` breaks the capture oracle, and capture's wiring test | **Fixed**, as a:F9; `tests/input-capture-move.test.js:187` restated to the call handing the scene's conversion. |
| o:F9 | the harness needs the platform's semantics, not missing members | **Fixed**, reproduced -- a move duplicated a child and `classList` missed a class set by attribute: section 5.1 restates the harness's append, class, text and removal. |
| o:F10 | the shadow misses the towers' connectivity-dependent cache | **Fixed**, reproduced -- 117 lookups against today's 55: the shadow answers `isConnected`, and the real towers run in the side-by-side, 55 each. |
| o:F11 | the shape grammar does not establish its script restriction | **Fixed:** VS5 drops the claim, states that the scene judges form, not meaning, and is no sanitizer; the event-handler refusal stays as a rule of form, and 3.4 names the case. |
| x:F1 | section 2.1 misstates the renderer's keying and update | **Not changed**, as `a` and `o` found: section 2.1 says a set asks the painter to update in place or re-render, at the lines cited. |
| x:F2 | VS7 is ambiguous on reuse against replacement | **Not changed in substance**, as `a` and `o` found: a shape of the same tag keeps its element; VS7 now states every case (a:F6, o:F5). |
| x:F3 | the arithmetic is not shown equal to `DOMPoint`, said to use float32 | **Not changed**, as `a` and `o` found: `DOMPoint` is binary64, Chrome's `SVGPoint` the float32 one, and equality is measured (6.2); VS10 now scopes it to finite transforms. |
| x:F4 | the export's bytes would differ by the keyframes | **Not changed**, as `a` and `o` found: the export skipped them; revision 2 has none. |

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
- Not a sanitizer: what it is handed is the application's own.
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

From the inventory of `569c0a8`, paths as H26.7 left them.\
*moves* -- to `vector-scene`; *native* -- written in the scene's shapes now; *translates* -- H26.4's adapter, retired by H26.8; *stays* -- draw's content or policy; *plumbing* -- an import, a record or a line that goes or is repointed; *unchanged* -- names what moves or lies on its route, no edit.\
The last column says what H26.8 does.

| Site | Today | H26.4 | H26.8 |
|---|---|---|---|
| `app/src/renderer.js:9` | imports `el`, `setAttrs` | plumbing: the shadow kit; `openScene` from `@apnex/vector-scene` | the shadow kit goes |
| `app/src/renderer.js:66-114` | layers found by id, painters' and appearances' layer elements | moves: checked against the scene's layers, a layer a name | unchanged |
| `app/src/renderer.js:116-141` | the constructor over an `svg` | translates: takes the scene and the platform's measure and settle beside the root; `openCanvasScene` exported | the scene alone |
| `app/src/renderer.js:178-200` | `glyphOf`, `byId` over the page | translates: answer the entity's shadow node | the reveal and towers describe their marks; both go |
| `app/src/renderer.js:224-264` | selection, reflections, `handle` | translates: batched, each call's changes put at its end | states described as classes, which ids from `editing` |
| `app/src/renderer.js:266-285` | `syncAll` empties the layers | moves: removes every item it put | unchanged |
| `app/src/renderer.js:294-339` | render, `place` by `insertBefore`, `draw` | translates: a fragment per entity, an item per top-level node, placed once by `put` with `before` | the painter's shapes put directly |
| `app/src/renderer.js:342-382` | `update`, `reapplyStates`, `kit` | translates: a painter's kit over the entity's fragment | a painter answers shapes; the kit goes |
| `app/src/renderer.js:388-425` | appearances composed into a `<g>` | translates: into the winner's fragment | composition answers shapes; stays draw's policy |
| `app/src/renderer.js:441-459` | `remove`, `elementOf`, `setState`, `clearState` | translates: by entity | `setState` puts the item described with its class |
| `shadow.js`, new in `app/src/` | none | translates: the live shadow, the export's headless node moved here, with the members 5.1 lists | retired |
| `app/src/painter.js:10-26` | `el`, `setAttrs` over `document` | stays: for the foreign layers' drawers; beside them the trace's probe and settle (D12) | stays for the movers |
| `app/src/painter.js:29-32` | `toCanvas` | moves: `toDrawing`; deleted, its verbatim copy kept for the capture oracle | unchanged |
| `app/src/painter.js:37-106`, `editing-visuals.js` new in `app/src/` | crosshair, preview, ghost, preview rect, line and path | native: moved to `editing-visuals.js`, items of the overlay and snap layers keyed as 5.1 says | unchanged |
| `app/src/painter.js:116` | `layerOf` | plumbing: goes with Input's overlay element | unchanged |
| `app/src/overlay.js:23-24,40-41,122-167` | `el`, `snap.js`; the overlay and snap layers; datum; handles | native: items, the handles and datum removed and put afresh; its node radius from `kernel/spec.mjs`; the `editing` part | unchanged |
| `app/src/overlay.js:178-180` | shown grids as root classes | stays | stays |
| `app/src/selection.js` | the selection | plumbing: unchanged code, the `editing` part's | unchanged |
| `app/src/grids.js:12-31` | a circle per point into each layer | native: an item per grid, removed and put afresh on load | unchanged |
| `app/src/compose-canvas.js:51,58,67,76-82` | defs; grids; renderer; crosshair; Input; capture | plumbing: opens the scene from the declaration handed, with the measure and settle, and hands it on; defs stay | unchanged |
| `app/src/main.js:56`, `lab/src/root.js:74`, `product/canvas.mjs:59-66` | `composeCanvas`; the view box and layers | plumbing: the composition declares the scene's layers, `pipes` and `movers` foreign, and the roots hand it on | unchanged |
| `app/src/input.js:210,328,344,532,905` | previews into `#overlay` | native: previews over the scene | the five bodies to `editing` |
| `app/src/tools.js:21,87`, `app/src/palette.js:35,150,155,166` | the ghost into `#overlay`; `toCanvas` | native: the ghost an item; `toDrawing` | unchanged |
| `app/src/capture.js:33,89` | `toCanvas` as capture's conversion | plumbing: the scene's `toDrawing` | the scene's `toDrawing` handed whole |
| `app/src/capture.js:84-93`, `app/src/pick.js:53-83` | picks by selector over the target | stays | picks by `itemOf` and the item's attributes |
| `app/src/labeledit.js:59-61` | `toScreen` by `DOMPoint` | plumbing: the scene's `toScreen` | unchanged |
| `app/src/labeledit.js:113,118,129,138` | an element by id, its box, the scale | stays | stays |
| `app/src/main.js:84,107`, `lab/src/root.js:106` | the pipe and mover layers by id | plumbing: `layerElement` | pipes: items |
| `lab/src/root.js:53` | the lab checks each layer in its markup | plumbing: checks the root, its ground and the scene opened | unchanged |
| `plugins/network/host.mjs:66-92` | pipes into `#pipes` | unchanged: a foreign layer | native: pipe items |
| `plugins/simulation/mover-painter.mjs`, `plugins/simulation/paintloop.mjs` | packets, beams, the towers' cached glyph | unchanged: a foreign layer; the glyph a shadow node, cached while connected | stays foreign |
| `plugins/simulation/reveal-painter.mjs:96-117` | marks an entity's element; traces a line | unchanged: shadow nodes, put at once, the trace through the measure and settle (D12) | the mark described; the trace two puts |
| every painter and appearance under `plugins/` (`plugins/zones/zone-painter.mjs`, `plugins/groups/group-painter.mjs`, `plugins/network/link-painter.mjs`, `plugins/network/anchor-appearance.mjs`, `plugins/devices/device-appearance.mjs`, `plugins/simulation/spawn-appearance.mjs`) | callbacks over the kit | unchanged: over shadow nodes | each answers its item's shapes |
| `kernel/renderer.mjs` | label, brackets, defs, dashes | stays: draw's primitives | stays |
| `tools/canvas-layout.mjs`, `tools/page-regions.mjs:31`, `app/index.html:143-158`, `lab/index.html:61-76` | the canvas region with its layers | plumbing: the region holds the root and ground alone | unchanged |
| `server/svg.mjs:13,38-113,115-216` | the renderer over its own tree, `document` swapped | moves: a scene with no root; serialization reads its descriptions; the tree and the swap go | unchanged |
| `package.json`, `package-lock.json`, `app/index.html:8-18`, `lab/index.html:29-39` | dependencies; the import map | plumbing: the release pinned; one map entry more | unchanged |
| `tools/layers.mjs:114-123` | `PARTS` `canvas` and `renderer` | plumbing: `editing` added (5.3); `canvas` loses `app/src/selection.js` and `app/src/overlay.js` and consumes `editing`; `renderer` gains `shadow.js` | `editing` gains the gestures' module |
| `tools/layers.mjs:218-240`, `:291-354` | `ALLOWED`; `LAYER` | plumbing: `ALLOWED` unchanged; `LAYER.canvas` names `shadow.js` and `editing-visuals.js` | unchanged |
| `tools/layers.mjs:159-168` | `COMPONENTS` | plumbing: `'@apnex/vector-scene': { parts: ['renderer'], by: ['H26-1', 'H26-2', 'H26-r'] }` | unchanged |
| `tools/layers.mjs:181-216` | `MISSION_KIT`; `ALIGNMENT` | plumbing: `'vector-scene': 'proposed in drawv2, released from its own repository, composed (H26-r); a candidate in zorg D32, steered in D35'`; `renderer` waits `'composed (H26-r); its drawing loop moved onto it at H26.4'`, `export` `'draws through it with no root (H26-r)'`, `primitives` `'draw's shapes, drawn through vector-scene (H26-r)'`; `editing` aligned to `'canvas-editing'`, `'a drawv2 candidate by H26-10, B389'` | `renderer` restated |
| `tools/layers.mjs:538-542` | `RULES.L4.verbatim`: the capture oracle's shims | plumbing: the renderer oracle's entry, its two copies and four shims; the capture shim re-exporting the verbatim painter, which stays while either oracle does | each entry goes with its copy |
| `tools/scan-dead.mjs`, `tools/scan-writers.mjs:215-221` | exports with a consumer; DOM globals by file | unchanged: `toCanvas` and `layerOf` deleted, `openCanvasScene` consumed; `shadow.js` reaches none, `app/src/painter.js` the probe | unchanged |
| `docs/ARCHITECTURE.md`, `docs/ARCHITECTURE-TARGET.md` | generated parts and alignment; sections 2, 4.2 and 9.3 | plumbing: regenerated with `editing`; the chain cites `H26-10` and `H26-r`; 9.3 names four components | unchanged |
| `tests/fixtures/client-harness.mjs:55-131,231-288,371-381` | fakes for the renderer and the canvas | plumbing: the platform's append, class, text and removal; a scene over the fake root, its layers found | unchanged |
| `tests/renderer.test.js`, `tests/appearance.test.js`, `tests/appearance-pipeline.test.js`, `tests/drawing-order.test.js`, `tests/anchor-redraws.test.js`, `tests/canvas-painters.test.js`, `tests/canvas-reflects.test.js`, `tests/link-heads.test.js`, `tests/run-picture.test.js`, `tests/consumer-parity.test.js`, `tests/span.test.js` | build the renderer over the fake | plumbing: hand it the scene; `tests/span.test.js:805` restated to the export's scene | restated to shapes |
| `tests/canvas-hand.test.js:93-99`, `tests/canvas-gestures.test.js:181`, `tests/layouts-canvas.test.js:44-79`, `tests/input.test.js:796-816` | `ghostNode`, `Grids` and `Tools` handed an element; Input's overlay element read | plumbing: hand the scene; read the layer the harness found; assertions unchanged | unchanged |
| `tests/affordance.test.js`, `tests/canvas-grids.test.js`, `tests/canvas-points.test.js` | overlay, grids, hover | unchanged: the same trees, through the harness | unchanged |
| `tests/svgexport.test.js`, `tests/svg-style.test.js`, `tests/display.test.js`, `tests/transit-roles.test.js`, `tests/bare-anchor.test.js` | the export's bytes and words | unchanged: byte-identical | unchanged |
| `tests/canvas-layout.test.js`, `tests/scan-copies.test.js`, `tests/import-map.test.js`, `tests/probe-sides.test.js:94`, `tests/import-map-browser.test.js:93` | the canvas region; the map; the installed components | plumbing: the region without layers; the map and the component lists restated | unchanged |
| `tests/input-capture-parity.test.js`, `tests/fixtures/pre-capture/painter.js`, `tests/input-capture-move.test.js:187` | old capture against the adapter; its conversion's shim; the wiring | plumbing: the shim re-exports the verbatim painter's `toCanvas`; the wiring test restated to the scene's conversion | unchanged |
| `tests/browser.test.js:482-539`, `tests/browser.test.js:1291-1306`, `tests/page-matrix.test.js`, `tests/fixtures/k8-dom.json`, `tools/probe/parity.mjs`, `tools/probe/gesture-sample.mjs` | the trace; the booted page, real gestures, pixels and styles | unchanged: acceptance steps 5 and 6 | unchanged |
| `vector-scene-move.test.js`, `vector-scene-parity.test.js` and `vector-scene-trace.test.js`, new in `tests/`, with today's renderer and painter in `tests/fixtures/pre-scene/` | none | plumbing: acceptance steps 3, 4 and 5 | the copies deleted |
| `dev/design/input/GESTURE-SYSTEM.md`, `dev/design/unification/CANVAS-PLUGINS.md` | the canvas parts and the renderer as built | plumbing: kept as written (RU2), each gaining a dated line at H26.4 | unchanged |
