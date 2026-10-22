# H26.0, part 3 -- `input-capture`

The third piece of H26's design of record (`dev/DECISIONS.md` H26-3, as H26-5 amended it).\
It designs `input-capture`, the component that stands between a platform's input events and an application: each event on the surface it is given becomes one fact, in the application's coordinates, and what the application asks of that fact is done to the event.\
It builds on part 1 (`SNAP-GRID.md`), whose section 7 is settled and built twice, and on part 2 (`INPUT-BINDING.md`), whose D1 left the shape of a fact to this piece; it states only where it differs from either, and cites rather than restates what their readings and builds settled.

**Standing:** a design under review, revision 3, drafted 2026-10-22 after its second multi-family reading (section 10.2); revisions 1 and 2 were `c7ea0c3` and `703bc19`; the code read is `703bc19`'s, identical in code to `3dcaba9`, after H26.7 moved every plugin under `plugins/`; the director answered D6 and D7 on 2026-10-22, each to be recorded as a ruling at ratification; a third reading, confirming revision 3, found nothing (section 10.3); ratified by the director on 2026-10-22, all eleven decisions of section 8 as recommended and appendix A as `input-capture`'s vision (`dev/DECISIONS.md` H26-8); built in H26.3.

---

## 1. What this decides, and what it does not

It decides:
- `input-capture`'s one duty, its vocabulary and its contract, precisely enough that an agent other than its author could build it from section 3 alone;
- the boundary with the platform: what capture touches of a browser, how it is kept to that, and how it is tested without a browser and with one (D2);
- what an application supplies -- the surface, the key source, the conversion to its coordinates, the hit test, the reading of a key's focus, the delivery -- and that pan and zoom change only the application's conversion (D3);
- the shape of a fact, which `input-binding` reads (its D1) and the gesture tester will, and how a claim and a pointer capture flow back to the platform (D1, D4);
- how a capture opens and closes, and what it does when the platform throws (IC3);
- which events become facts: the wheel and a pinch held until their first consumer is designed (D6), the context menu left to the application (D5);
- the fields carried from the platform beyond what draw reads, as the director answered (D7);
- events outside the surface -- the palette's tile drag (D8) -- and which part of draw imports the component, with what remains of `app/src/capture.js` (D9);
- the invariants and tests that hold it, the acceptance steps for draw's move onto it (H26.3), and every site that move touches (appendix B).

It does not decide:
- `input-binding`'s contract, ratified (H26-6) and built, which reads a fact's `at` and `button` and nothing else;
- `vector-scene` or how a hit is found once a scene reports what lies under a point (H26.4) -- only that the hit test stays the application's function, handed the drawing point as well as the platform's target;
- the wheel and pinch facts, designed with their first consumer -- the gesture tester's scope (H26.5) or pan and zoom (H26.6), whichever comes first -- nor whether a press's travel is measured on screen (B404);
- the gesture tester's scope, beyond the fields its keys and mouse need (D7);
- draw's policy -- Escape's order, keys typed into a field, Tab beside a control, the context menu (B75), run mode's regions, the label editor, the palette -- each draw's, through the functions draw supplies or outside capture;
- the defects the inventory found (section 6.3): each is kept by H26.3 and registered for its own ruling.

---

## 2. What draw does with platform events today

Read from the code at `3dcaba9` and rechecked at `703bc19`, identical in code; appendix B lists every site, one row each, with what H26.3 does with it.\
`INPUT-BINDING.md` section 2.4 inventoried the fields and routes at `5b4997b` as capture's starting obligation; this section restates them where H26.2 moved Input's line numbers.

### 2.1 The listeners and the round trip

`app/src/capture.js` (127 lines) is L0 of the gesture system (`dev/design/input/GESTURE-SYSTEM.md` section 5.1): the only module whose code reads a browser event for the canvas.
- **The listeners** (`:79-94`): on the canvas element, `pointerleave`, `pointerdown`, `pointermove`, `pointerup`, `pointercancel`, `pointerover`, `pointerout` and `dblclick`, in that order; on `host` -- the page's `window`, handed in by each root (`app/src/main.js:63`, `lab/src/root.js:75`) -- `keydown`, `keyup` and `contextmenu`; each with no options argument, and none ever removed.
- **The round trip** (`#round`, `:97-103`): build one input event, hand it to Input, and in a `finally` call `preventDefault` when Input wrote `claimed` and `setPointerCapture(evt.pointerId)` when it wrote `capture`, a refusal of the latter swallowed (`:101`, "synthetic events").
- **The routes** (`:105-112`): each listener calls one Input method -- `press`, `move`, `release`, `cancelDrag`, `hover`, `double`, `keyDown`, `keyUp` -- and `pointerleave` calls `leave()` with no event (`:81`); a `keydown` whose target is an `INPUT`, `TEXTAREA` or `SELECT` is dropped before an event is made (`:70`, `:111`).
- **The context menu** (`:119-121`): `preventDefault` unless the target lies in a form field or an editable element (B75); never an input event.
- **`emitToHost`** (`:125-127`): run mode's `draw:action` dispatched on the host, imported by Input (`app/src/input.js:43`, `:446`) -- the opposite direction, kept beside the other DOM call.

### 2.2 The input event

`inputEvent` (`:56-67`) makes one plain object per event; Input and every row read it, and Input writes three fields back.

| Field | Produced | Read by |
|---|---|---|
| `type` | `down`, `move`, `up`, `cancel`, `over`, `out`, `double`, `key-down`, `key-up` | the input state (`app/src/input-state.js:35-44`); the release rows (`app/src/releases.js:34-35`, the plugins' box and handle releases); the double-click row (`app/src/recognize.js:128`); `cancelDrag` (`app/src/input.js:1291`) |
| `button` | `evt.button ?? 0`, so `0` on a key event and `-1` on a move with no button changed | the press rows (`app/src/recognize.js:34-35`, `plugins/zones/zone-gestures.mjs:65`, `plugins/devices/device-gestures.mjs:34`); `pending`'s start (`app/src/input.js:143`); the session's taken press and commit (`kernel/input-rules.mjs`, `GESTURES.link`'s declared button) |
| `key`, `repeat` | `evt.key ?? null`, `!!evt.repeat`, on every event | the key rows and key releases (`app/src/keymap.js`); the digit and arrow actions (`app/src/input.js:1479`, `:1567`) |
| `shiftKey`, `ctrlKey`, `altKey`, `metaKey` | each `!!` | the key and press rows; the Shift layer and ortho (`app/src/input.js:92`, `:141-142`); the grids shown (`:659`, `:994`); a double click's modifier (`:1343`); the overlay's arming (`:1609-1610`) |
| `at` | pointer types only: `toCanvas(evt, svg)` (`app/src/painter.js:29-32`), a `DOMPoint` in a browser | the input state; the session's press (`pointerDown`, `pointerMove`); every gesture body and action placing at the pointer (`app/src/input.js:650`, `:995`, `:1105`) |
| `on` | pointer types only: `hitWith(picks)(evt)` (`app/src/pick.js:53-83`), `{ kind, id }`, with `handle` or `mark` true | the press rows; the idle affordance (`app/src/input.js:1069-1071`); hover (`:1609`) |
| `region` | `down` only: run mode's controls under the press (`app/src/capture.js:38-53`), or `null` | run mode's rows (`plugins/simulation/spawn-runs.mjs:40`, `:51`, `plugins/devices/device-panels.mjs:14`, `:17`); `runModePress` (`app/src/input.js:708`) |
| `onControl` | `key-down` only: focus lies in a button, link, field or tabbable element | Tab (`app/src/input.js:1428`) |
| `claimed`, `capture` | `false`; written by Input (`:660`, `:1378`, `:1412`, `:1429`, `:1469-1470`, `:1485`, `:1556`, `:1598`) and by plugins' rows (`plugins/network/keys.mjs:43`, `:47`, `plugins/simulation/spawn-runs.mjs:42`, `:56`, `plugins/devices/device-panels.mjs:15`, `:18`) | capture's `finally` |

Input also writes `trigger`, the session's click or drop, onto a release (`app/src/input.js:1088`), which the link and marquee commits read (`:278`, `:340`); capture never reads it.\
No code reads anything of `at` but its `x` and `y`: no position is spread, mutated, serialized or asked a method (searched over `app/`, `plugins/`, `kernel/`, `engine/`, `model/` and `product/`).

### 2.3 The routes

- `pointerleave` clears the readout's cursor and the hand and forgets the pointer's position (`app/src/input.js:582-586`).
- Input asks for the pointer only on a press a row matches (`:660`), after run mode's diversion (`:633`). A mouse or pen pointer not captured loses its moves once it leaves the canvas, and its release there; a touch is captured by the browser to the element pressed -- a child of the canvas -- before any listener runs, so its moves and its release off the canvas still arrive, that child their target; once Input takes the pointer its events are retargeted to the canvas, so `on` is the canvas during a drag, and the gestures find what lies under the pointer from the drawing point (`anchorAt`). Shown in headless Chrome with trusted input (`~/taceng/drawv2-eval-runs/h26-readings/ic/drafting/v2/chrome-platform.mjs`).
- Pointer Events deliver a second mouse button pressed while one is held as a `pointermove`, so one mouse makes one press; a touch contact or a pen is a pointer of its own, `button` 0 on a touch's press, and the canvas takes touch as pointer events (`touch-action: none`, `app/canvas.css:9`); facts keep no `pointerId`, so a second pointer replaces the first's press (B409).
- Keys arrive on the window: the palette's own `keydown` listener is registered first and spends an Escape that cancels a tile drag (`app/src/palette.js:46-52`), so capture starts only when a root calls `listen()` after its own listeners (`app/src/compose-canvas.js:80-82`, `app/src/main.js:93-97`); the label editor's field stops each of its key-downs (`app/src/labeledit.js:80-97`, `:148-158`), so no key-down typed there reaches the window, while every key-up does -- a Shift released in a field still reaches the key-release rows.
- Capture listens for no `wheel`, `focus`, `blur`, `visibilitychange`, `pointerenter`, `gotpointercapture`, `lostpointercapture`, touch event or `gesturestart`, and Input receives none: a trackpad pinch arrives as a `wheel` with `ctrlKey` and the browser zooms the page; a touch pinch is two pointers; a key released while the page lacks focus makes no key-up (6.3); and the page itself listens for `visibilitychange` on `document`, refreshing the undelete offer when the tab is shown again (`app/src/main.js:278`) -- draw's chrome, outside capture and Input, and no input.
- The palette's tiles have their own press, pointer capture, move and release, no `pointercancel` listener, and their own click rule in screen pixels (`app/src/palette.js:29`, `:104`, `:128-174`; B407).

### 2.4 Who opens it, and what holds it

`composeCanvas` returns `listen()`, which makes the one `Capture` with the parts' picks and run-mode regions (`app/src/compose-canvas.js:33-34`, `:80-82`); the product page calls it after the palette (`app/src/main.js:97`) and the lab after attaching its network, exposing it as `window.lab.capture` (`lab/src/root.js:107`, `:221`), which no test reads.\
The test harness builds a `Capture` over a fake canvas and window (`tests/fixtures/client-harness.mjs:42-43`, `:273`) and hands tests its nine methods -- `onDown`, `onMove`, `onUp`, `onCancel`, `onHover`, `onDblClick`, `onKeyDown`, `onKeyUp`, `onContextMenu`: 424 calls in 24 test files, and 4 in `tests/fixtures/gesture-corpus.mjs`, which drives the corpus's 92 scenarios.\
`tests/input-capture.test.js` builds the class itself over its own fakes (`:17`, `:26-33`, `:58-71`, `:86`, `:107-110`), holding capture's contract and G1 -- `app/src/input.js` reads no DOM; `tests/input.test.js` holds the set of listeners added to the host (`:766-777`, B45) and the menu (`:1383-1400`, B75); `tests/canvas-chrome.test.js:77` holds that `app/src/capture.js` names no plugin's selector.

### 2.5 What is mechanism

| Module | Lines | Imports | Draw's words in code | Draw's policy in it |
|---|---|---|---|---|
| `app/src/capture.js` | 127 | `pick.js`, `painter.js` | 0 (7 in comments) | run mode's regions, the field and control selectors, the B75 rule, `emitToHost` |
| `app/src/pick.js` `hitWith` | 31 of 128 | `model/model.mjs` | 0 | which element is which kind, by the parts' picks |
| `app/src/painter.js` `toCanvas` | 4 of 117 | none | 0 | the SVG's screen transform |

Measured with part 1's vocabulary match, comments removed.\
So the listeners, the reading of an event's fields and the round trip are mechanism free of draw; what lies under a pointer, where a point lies in the drawing and which keys a field keeps are draw's, already reached through functions capture is handed or calls.

---

## 3. `input-capture`

### 3.1 Duty

Turn each input event a platform delivers on one surface into one uniform fact, in the application's coordinates, and carry the application's answer for that fact back to the platform.

That is the whole duty: one boundary, crossed both ways for each event.\
It does not decide what an input means, find what lies under a pointer, convert coordinates, read a clock, or draw anything -- each is `input-binding`'s, the application's or another component's.

### 3.2 Vocabulary

| Word | Meaning |
|---|---|
| platform | what delivers input events and owns the surface: a browser, or anything of the same shape |
| surface | the element whose pointer events capture listens to, and on which it takes the pointer |
| key source | what capture listens to for key events, which the application chooses |
| open | a capture whose listeners are all added and whose `close` has not been called; only an open capture makes facts (IC3) |
| event | one value the platform delivers to a listener; capture reads only the fields IC1 names |
| target | the platform's own object an event names; capture never reads it, and hands it to the application |
| fact | the frozen record capture makes from one event (IC5) |
| point | a frozen record of finite numbers `x` and `y` |
| screen point | the event's own `clientX` and `clientY`, as a point |
| conversion | the application's function from a screen point to its own coordinates |
| hit | the application's answer for what lies under a pointer |
| focus | the application's answer about where a key event arrived |
| delivery | handing one fact, with its reply, to the application |
| reply | what the application may ask of one fact while it is delivered: claim it, take the pointer |
| claim | the platform's default action for the event prevented |
| pointer | one contact or cursor the platform tracks, named by its `pointerId` |
| modifiers | `shiftKey`, `ctrlKey`, `altKey` and `metaKey`, in that order, as an event carries them |

### 3.3 Contract

One capability per row; none requires another component's capability.\
A capture holds one state between events, open or closed, with the listeners it added; its owner relies on it -- no fact once `close` is called -- so `declared-capture` is stateful in T1's sense, narrowly, and the rest are not (section 9).

| Capability | Relation | Requires | What a consumer can depend on | Trait |
|---|---|---|---|---|
| `declared-capture` | provides | none | A capture opened on a surface, and optionally a key source, from the application's functions, or refused with every problem; closed by removing exactly the listeners it added (IC2, IC3). | stateful |
| `pointer-facts` | provides | none | Each pointer and double-click event on the surface as one fact, in the coordinates the application's conversion gives, with the application's hit (IC4 to IC7). | none |
| `key-facts` | provides | none | Each key-down and key-up on the key source as one fact, with the application's focus (IC4 to IC7). | none |
| `fact-reply` | provides | none | What the application asks of a fact while it is delivered -- the event claimed, the pointer taken -- done to that fact's event at once (IC8). | none |

**Errors.**\
`openCapture` never throws while it reads and judges a declaration: it refuses with problems; it throws only an error a platform method threw while it added a listener, after taking back those it added (IC3).\
A listener throws a `TypeError` before `deliver` is called, so nothing is delivered: one whose message begins with the platform event's name and a colon -- `pointerdown: ` -- when the event is not an object, a field is refused (IC6) or reading a field throws; one beginning `toDrawing: ` when the conversion's answer is refused or reading it throws; an error a getter or a trap threw is named in the prose after "could not be read:".\
A reply's method called once its delivery has ended, or `takePointer` called again before its first call returns, throws an `Error`, the base constructor, beginning `claim: ` or `takePointer: `.\
Any other exception -- from an application function, or from a platform method capture calls -- propagates unchanged: beyond the readings above, capture catches only what `setPointerCapture` throws (IC8), and what a removal throws, which it holds until the other removals are attempted (IC3).\
A message's beginning is the contract and the rest is prose, as `input-binding` settled.

**What is returned.**\
Every value capture makes -- an open result, a problem list, a capture, a fact, its `at` and `screen`, a reply -- is made afresh and frozen to its depth, down to but not into the application's own values it holds, the `hit` and `focus` answers, which it holds by reference and never reads, copies or freezes.\
Every record holds its properties in the order its form is written in this section, and nothing else; an open result holds `ok`, then `capture` or `problems`.\
Every function capture makes needs no receiver and reads no argument beyond those its form names, so `close` and a reply's methods read none.

**IC1 -- What capture touches of the platform.**\
Capture reaches the platform only through the values the application hands it, and touches of them exactly:
- of the surface: `addEventListener`, `removeEventListener` and `setPointerCapture`, each read once, as the capture opens (IC2), the function read being the one it calls, with the surface as its receiver, every time;
- of the key source: `addEventListener` and `removeEventListener`, likewise;
- of a pointer or double-click event: `clientX`, `clientY`, `button`, `buttons`, `pointerId`, `pointerType`, the modifiers, `target` and `preventDefault`, each read once, in IC6's order, `preventDefault` called with the event as its receiver only by `claim`;
- of a key event: `key`, `code`, `repeat`, the modifiers, `target` and `preventDefault`, likewise.

It reads no other member, never reads a target's members or an event's prototype, and names no global: no `window`, no `document`, no constructor of the platform's.\
So it cannot reach beyond the surface and the key source it is given, and the same code runs over a browser's objects and over plain objects of their shape.

**IC2 -- How values are read.**\
These are the rules the first two components settled (`SNAP-GRID.md` and `INPUT-BINDING.md` section 11, each component's decision record, D2):
1. The declaration is read as `input-binding` reads one (`INPUT-BINDING.md` section 3.3, IB2 rules 1 to 3 and 6): a plain object's own data properties by descriptor, a property read only when its own keys hold it, an accessor of no form, an inherited property absent, a symbol-named property ignored, a property present as `undefined` of no form, and a key its own keys list whose descriptor reads `undefined` absent; and reading a value stops at the first reflection that refuses it, a reflection that throws refusing the value it was made on, as `input-binding` reads a record -- so a declaration whose prototype, own keys or descriptor cannot be read is `not-an-object` at `""`, nothing further read, and a surface or key source whose member cannot be read is refused at its own pointer.
2. Its order: its prototype; its own keys; the descriptors of `surface`, `keys`, `toDrawing`, `hit`, `focus` and `deliver` its own keys hold, in that order; then, when `surface` holds an object, its `addEventListener`, `removeEventListener` and `setPointerCapture`, and when `keys` holds one, its `addEventListener` and `removeEventListener` -- each through ordinary property access, judged as it is read, the reading of that object stopping at the first member whose read throws or which is not a function; the key source's members are read whatever the surface's were.
3. An event is judged by `typeof` alone, which runs no trap, and its prototype is never read; its fields are read once each through ordinary property access, a browser's being inherited accessors, in IC6's order, each judged as it is read, the reading stopping at the first refused -- `clientX` judged before `clientY` is read, since an event is not a point.
4. The conversion's answer is judged by `typeof`, and its `x` and then its `y` are read through ordinary property access, so a `DOMPoint`'s getters answer, both before either is judged, as `snap-grid` reads a point.
5. An object is a non-null value whose `typeof` is `'object'`, so a function never is one; a function is a value whose `typeof` is `'function'`.

**IC3 -- Opening and closing.**\
`openCapture(declaration)` returns `{ ok: true, capture }` or `{ ok: false, problems }`.\
A declaration is a plain object holding:
- `surface`, an object whose `addEventListener`, `removeEventListener` and `setPointerCapture` are functions;
- optionally `keys`, an object whose `addEventListener` and `removeEventListener` are functions, the surface itself allowed;
- `toDrawing`, a function: the conversion (IC7);
- optionally `hit`, a function, asked for every pointer fact, and `focus`, a function, asked for every key fact, which requires `keys`;
- `deliver`, a function, handed every fact with its reply.

A problem is `{ pointer, problem }` as `input-binding`'s IB3 defines one, ordered by pointer and then by problem by UTF-16 code unit, no record twice:

| Step | When | Problem, at pointer |
|---|---|---|
| 1 | the declaration is not a plain object, or a reflection on it throws | `not-an-object` at `""`, and nothing else |
| 2 | an own property other than the six; `surface`, `toDrawing` or `deliver` absent | `unknown-property` at `/<name>`, one each; `missing-property` at `/<name>` |
| 3 | `surface` an accessor or not an object, or a member of it refused as IC2 reads it | `invalid-value` at `/surface` |
| 4 | `keys` present and an accessor or not an object, or a member of it refused | `invalid-value` at `/keys` |
| 5 | `toDrawing`, `hit`, `focus` or `deliver` present and an accessor or not a function | `invalid-value` at its pointer |
| 6 | `focus` present and `keys` absent | `invalid-value` at `/focus` |

**The lifecycle,** each rule stated here once:
1. A capture is *opening* while `openCapture` adds its listeners, *open* once every one is added, and *closed* from the moment `close` is first called; a listener of a capture not open reads nothing and calls nothing, so an event the platform delivers during opening, or once `close` has begun, makes no fact; a fact begun while the capture was open is made and delivered even if `close` is called meanwhile.
2. `openCapture` calls no platform method until the declaration is judged; it then adds the listeners IC4 lists, in its order, each through the `addEventListener` read as it opened, with two arguments, the event's name and the listener.
3. If an `addEventListener` throws, it removes that very listener -- which the platform may have added before throwing, and whose removal is harmless if not -- and then the listeners already added, in the reverse of the order added, attempting every removal, and then throws the error the `addEventListener` threw, unchanged; the capture is never open.
4. Otherwise it returns `{ ok: true, capture }`, `capture` a frozen `{ close }`.
5. `close()`, on its first call, closes the capture, then removes every listener it added, in the reverse of the order added, through the `removeEventListener` read as it opened, attempting every removal; it then throws the first error a removal threw, unchanged, or returns `undefined`; every later call, one from inside a removal among them, returns `undefined` and calls nothing.

So an operation that calls the platform more than once attempts every call it owes and then throws the first error met; no listener of a capture that failed to open, or that closed, is left on the platform unless a removal threw; and a listener so left makes no fact.

**IC4 -- Which events become facts.**\
Each listener of an open capture makes one fact from the event it is called with, synchronously, and delivers it before it returns, unless it refuses the event (IC6); capture queues, merges, defers and synthesizes nothing, so the platform's own sequence -- a second mouse button as a move, a touch contact as a pointer of its own -- is the facts' sequence.

| Platform event | Listened on | Fact `type` |
|---|---|---|
| `pointerleave` | surface | `leave` |
| `pointerdown` | surface | `down` |
| `pointermove` | surface | `move` |
| `pointerup` | surface | `up` |
| `pointercancel` | surface | `cancel` |
| `pointerover` | surface | `over` |
| `pointerout` | surface | `out` |
| `dblclick` | surface | `double` |
| `keydown` | key source, when given | `key-down` |
| `keyup` | key source, when given | `key-up` |

The first eight make pointer facts and the last two key facts.\
Capture listens for nothing else: no `wheel`, `contextmenu`, `click`, `pointerenter`, `gotpointercapture`, `lostpointercapture`, `focus`, `blur`, `visibilitychange`, touch, gesture or composition event (D5, D6).

**IC5 -- The fact.**\
A fact is a frozen record of exactly these properties, in this order, each `null` where the table says so:

| Property | A pointer fact | A key fact |
|---|---|---|
| `type` | as IC4 gives | as IC4 gives |
| `at` | a point: the `x` and `y` the conversion answered for `screen` (IC7) | `null` |
| `screen` | a point: the event's `clientX` and `clientY` | `null` |
| `hit` | the `hit` function's answer, or `null` when none is given | `null` |
| `focus` | `null` | the `focus` function's answer, or `null` when none is given |
| `button` | the event's `button`, `0` when it is `undefined` or `null` | `null` |
| `buttons` | the event's `buttons` when a safe integer, else `null` | `null` |
| `pointerId` | the event's `pointerId` when a safe integer, else `null` | `null` |
| `pointerType` | the event's `pointerType` when a string, else `null` | `null` |
| `key` | `null` | the event's `key` when a string, else `null` |
| `code` | `null` | the event's `code` when a string, else `null` |
| `repeat` | `null` | whether the event's `repeat` is truthy |
| `shiftKey`, `ctrlKey`, `altKey`, `metaKey` | whether each is truthy | whether each is truthy |

`at` and `screen` hold exactly the numbers read, `-0` kept: capture computes no number (D1).\
A fact holds no time, no event, no target and no function, so a fact made from plain data survives a JSON round trip but for its `hit` and `focus` answers and a `-0` coordinate, which JSON writes as `0`.

**IC6 -- Making a fact.**\
For each event a listener of an open capture receives, in this order, refusing the event -- Errors' `TypeError`, nothing after it read or called -- where a step says so:
1. it refuses the event unless it is an object;
2. for a pointer event it reads `clientX`, refusing the event unless it is a finite number, then `clientY`, likewise; then `button`, refusing it unless `undefined`, `null` or a safe integer; then `buttons`, `pointerId`, `pointerType`, the modifiers, `target` and `preventDefault`, refusing it unless `preventDefault` is a function; for a key event it reads `key`, `code`, `repeat`, the modifiers, `target` and `preventDefault`, refusing it likewise, and reads and judges no coordinate and no button;
3. for a pointer event it calls the conversion with the screen point, a fresh frozen point, and reads the answer as IC2 rule 4 says, refusing the event unless it is an object whose `x` and `y` are finite numbers;
4. it makes the fact with `hit` and `focus` `null`, hands it with the target to `hit` for a pointer fact or to `focus` for a key fact, when that function is given, and makes the fact to deliver, a fresh frozen record of the same form holding the answer;
5. it calls `deliver` with the fact and a fresh reply.

**IC7 -- The application's functions.**\
Each is called synchronously, with no receiver -- as `Reflect.apply(fn, undefined, args)` calls it -- at most once for each event, at the step IC6 gives:
- `toDrawing(screen)` answers where the screen point lies in the application's coordinates;
- `hit(target, fact)` and `focus(target, fact)` answer any value, which capture holds in the delivered fact by reference and never reads;
- `deliver(fact, reply)`'s answer is ignored.

Each is the application's code, as is a getter of an event, of a platform object or of the conversion's answer, and any trap of a `Proxy` capture is handed; any may call `close`, open another capture or make the platform dispatch another event, whose fact is made and delivered within that call, with its own reply, when its capture is open (IC3).\
Capture keeps no state between events but whether it is open, so nothing they do changes how a later event is read; for events whose fields, and application functions whose answers, are alike, the same sequence of events gives the same facts.

**IC8 -- The reply.**\
A reply is a frozen `{ claim, takePointer }`, fresh for each fact and *live* from its delivery's start until `deliver` returns or throws, whether or not the capture closes meanwhile:
- `claim()`, on its first call, marks the fact claimed and then calls the event's `preventDefault`, read at IC6, with the event as its receiver; what that call throws propagates, and the claim is spent; every later call returns `undefined` and calls nothing;
- `takePointer()`, on its first call, answers `false` and calls nothing when the fact's `pointerId` is `null`; otherwise it marks the call in progress and calls the surface's `setPointerCapture`, read as the capture opened, with the surface as its receiver and that `pointerId`, answering `true` when it returns and `false` when it throws, whatever it throws -- the platform refusing a pointer that is not active, as for a synthetic event; a call made while the first is in progress throws Errors' `Error`; every later call answers the first call's answer;
- once the reply is no longer live, each throws Errors' `Error`.

Each acts at once, so what a delivery asked before it threw is done.

**IC9 -- Exports.**\
`@apnex/input-capture` exports `openCapture`, and nothing else; it has no subpath.\
It imports no package and no module particular to one runtime, names and declares no global, touches no platform object but those IC1 names, and reads no clock and no randomness and holds no timer, so it runs over a browser's elements and events and, where there is no browser, over plain objects of their shape.\
Its TypeScript declarations state the platform slice IC1 touches as its own structural types, so a browser's elements and events are assignable to them; they are generic in the hit and the focus, a fact's properties are read-only, and the declaration's type refuses `focus` without `keys`.

### 3.4 Fit criteria

**Does my project want this at all?**
- An application turns a browser's pointer and key events into its own values in more than one place, or tests its input without a browser.
- A gesture needs the pointer captured, or the default action prevented, and the code deciding so should not hold the event.
- An application will pan or zoom, and its input must follow the view without its listeners changing.

**It is the wrong tool when:**

| You need | Reach elsewhere, because `input-capture` is |
|---|---|
| what an input means, a click told from a drag, a gesture's phases | not a binder: that is `input-binding` |
| what lies under a point, or where a screen point lies in a drawing | not a hit tester or a view: the application supplies both, from `vector-scene` or its own |
| the wheel or a pinch as facts | not yet: held until their first consumer is designed, the gesture tester's scope or pan and zoom (D6) |
| the context menu suppressed | not a menu handler: the application listens for it itself (D5) |
| events from the whole page, or from controls outside the surface | not a page listener: one capture listens to one surface and one key source (D8) |
| a hold, a sequence or a double click decided by time | not a clock: a double click is the platform's own event |

### 3.5 Adjustment policy and edges

Internal and sovereign: a measured gap is recorded where both sides can see it, then resolved by adjusting `input-capture` or by fracturing it if the gap reveals a second duty; never forked.

**Contains:** the listeners, the reading of an event into a fact, and the reply.\
**Consumes:** nothing.\
**Consumed-by:** draw (H26.3), then the gesture tester (H26.5).

The tester needs of capture its key facts' `key` and `code` and its pointer facts' `button`, `buttons` and `pointerType`, to light keys and mouse buttons; it hands its facts to `input-binding` as they are, since a pointer fact holds `at` and `button` as own data properties.

**Reference,** as `CONTRACT.md` carries it (SC6): the repository `apnex/input-capture` and its package `@apnex/input-capture`, released only by its own CI; its one export, as `export-map.json` records; TypeScript in `src/`, built to `dist/`; the tests in `test/`, as section 4 names them; the gate's checks in `tools/` (section 7); and this design as its design of record.

---

## 4. Invariants and tests

There is no conformance kit (D10): nothing in `input-capture` is a port another party implements.\
*`input-capture`* marks what the component's own tests hold; *gate* what its gate holds; draw's own tests are the acceptance steps below.

| # | Invariant | Held by |
|---|---|---|
| I1 | `openCapture` never throws while it judges a declaration, and answers every declaration with exactly IC3's problems, from a table of cases: present `undefined`, accessors, a phantom key, a revoked and a trapping `Proxy`, a function as the surface, a surface lacking each member in turn, a member that is not a function followed by one whose getter would change the key source -- never read -- a declaration whose descriptor read throws -- `not-an-object` at `""`, no later descriptor read -- and `focus` without `keys`. | `input-capture` |
| I2 | An open capture has added exactly IC4's listeners, in its order, on the right object, with two arguments, before `openCapture` returns, and eight without a key source; an `addEventListener` throwing at each place in turn, before or after adding its listener, leaves none added and throws its error; `close` removes every listener in reverse order, attempting each when one throws and then throwing the first error; a second `close`, and one made from inside a removal, calls nothing; a listener called during opening or after `close` makes no fact, while a fact begun before `close` is delivered with a live reply. | `input-capture` |
| I3 | Capture touches nothing of the platform outside IC1: with a surface, key source, events and targets that are recording `Proxy` values and spies, opening, a `pointerdown` whose delivery claims and takes the pointer, a `keydown` whose delivery claims, and `close` log exactly IC1's reads in IC2's and IC6's orders and each platform call once, in IC3's and IC8's orders, the targets' logs empty. | `input-capture` |
| I4 | Every reading of IC5 from a table of events: `button` absent, `null`, `-1` and `2`; `buttons`, `pointerId`, `pointerType`, `key` and `code` absent or of another type; modifiers and `repeat` of every truthiness; a fractional `clientX`; an ordinary key event, holding no pointer field. | `input-capture` |
| I5 | Spies log each event's reads and calls in IC6's order; an event refused at each place stops the reading there, no later field read and no application function called -- a `clientX` refused leaves a `clientY` getter that would close the capture unread; `hit` is never called for a key fact, nor `focus` for a pointer fact. | `input-capture` |
| I6 | `screen` holds exactly the event's numbers and `at` exactly the conversion's, under `Object.is`, `-0` and a getter-backed point among them, `x` and `y` both read before either is judged; a conversion answering a function, `null`, `NaN` or an infinity refuses the event. | `input-capture` |
| I7 | Every fact, its `at` and `screen`, every reply and every open result are fresh and frozen to their depth, not into `hit` or `focus`, which are the very values answered; keys in their written order; no function needs a receiver; a fact's JSON round trip loses only `-0`. | `input-capture` |
| I8 | `claim` calls `preventDefault` once, at once, and a throwing one spends it; `takePointer` calls `setPointerCapture` once with the fact's `pointerId`, answering `false` when it throws and calling nothing when `pointerId` is `null`; a `takePointer` made again from inside `setPointerCapture`, through its getter or its body, throws and calls nothing, the outer call then answering as IC8 says; both throw once delivery has ended; what a throwing delivery asked is done. | `input-capture` |
| I9 | An exception from each application function propagates out of the listener unchanged, nothing delivered after a throw before `deliver`; a getter or trap throwing while an event or the conversion's answer is read is rethrown as the Errors paragraph's `TypeError`; a delivery that closes its own capture, one that closes another, and one that dispatches a nested event each follow IC3 and IC7. | `input-capture` |
| I10 | In headless Chrome, with trusted input dispatched through the DevTools protocol's `Input` domain on a page whose surface is an SVG element: a left press, moves leaving the surface and a release, the pointer taken on the press, every move and the release delivered; the same with the pointer not taken, nothing delivered off the surface; a touch pressed on a child of the surface and not taken, its moves and release off the surface delivered with the child as target; a right press and release, `button` 2; a move with no button, `button` -1 and `buttons` 0; a double click, one `double` after its presses and releases, `pointerId` `null`; two touch contacts, two `pointerId` values, `pointerType` `touch`; a touch cancelled, a `cancel`; a key held to repeat, its `key` and `code`, and a key-up; a claimed key-down seen `defaultPrevented` by a later listener; a `leave` when the pointer leaves; nothing after `close`. | gate |
| I11 | A consumer compiled with `tsc --noEmit` under strict settings, with and without `exactOptionalPropertyTypes`, passes an `SVGSVGElement`, an `HTMLCanvasElement` and a `Window` where IC3 asks; its `hit` and `focus` types reach `fact.hit` and `fact.focus`, and `null` when it omits them; and lines that give `focus` without `keys` or write a fact's property must fail to compile. | `input-capture` |
| I12 | The source names no consumer's vocabulary and declares no global (section 7); the built files import no package, name no runtime global and no clock, timer or source of chance (`SNAP-GRID.md` section 7.2; `input-binding`'s clock check). | gate |

**Each rule's own tests,** in `test/contract/`: one file per capability -- `declared-capture` (IC2, IC3, I1, I2), `pointer-facts` and `key-facts` (IC4 to IC7, I3 to I6, I9), `fact-reply` (IC8, I8) -- beside `returned-values-and-errors.test.js` (the Errors and What is returned paragraphs) and `public-types.test.js` (I11), as the earlier components keep them; each reading order is held by a `Proxy` that records each trap.\
The fakes are plain objects whose `addEventListener` records each listener, and Node.js's own `EventTarget` for a dispatch that runs every listener; I10's page is in `test/browser/`, driven over Node.js's global `WebSocket`, so no dependency is added.

**Acceptance for H26.3, draw on `input-capture`:**
1. `input-capture` is released from its repository by its CI, and draw's lockfile pins the release file by its hash.
2. Every site appendix B marks *moves* goes through the component, only `app/src/capture.js` names `@apnex/input-capture`, every site marked *stays* or *unchanged* is unchanged, and every site marked *kept* keeps its behaviour and cites its backlog row.
3. `app/src/capture.js` exports `captureCanvas` and `emitToHost` and no class, adds no listener for a pointer, double-click or key event and reads no field of an event -- its one listener is the B75 menu's -- and Input's entry points take the events they took; a new test in draw's `tests/`, `input-capture-move.test.js`, finds each.
4. Before the old capture is deleted, a test in draw drives it and the adapter with the same fake events -- every event of the gesture corpus and of the input tests, none of which carries another family's fields -- and finds that each hands Input the same event, field for field and in the same key order, and makes the same `preventDefault` and `setPointerCapture` calls; and it holds each difference 6.3 lists with both answers.
5. Draw's full gate passes: the gesture corpus replays byte-identical, the 24 files and the fixture driving the canvas through the harness pass unchanged, and in real Chrome the browser tests -- the K7 and K8 palette and Escape tests, the run-mode key test, the second-pointer test of B409 (`tests/input-binding-browser.test.js`) -- and the matrix corpus's boards pass; the gesture-sample probe (`tools/probe/gesture-sample.mjs`) finds its eleven real gestures alike before and after.
6. The probe against production, each side on its own dependencies, finds no pixel or style changed, and an independent verifier passes the move.
7. The product page and the lab page load the one release through the import map; the server and the export never load it, since only the pages compose a canvas.

---

## 5. What draw supplies, and what stays draw's

**Draw's adapter is `app/src/capture.js`,** which exports `captureCanvas({ svg, host, sink, picks, regions })` in place of the class `Capture`; it opens the capture with this declaration, adds the B75 menu's listener to the host after it, and answers a frozen `{ close }` that closes both, which nothing in draw calls today:

| Property | Draw supplies |
|---|---|
| `surface` | the canvas element `composeCanvas` is handed, `#container` |
| `keys` | `host`, the page's `window`, as today |
| `toDrawing` | `(screen) => toCanvas({ clientX: screen.x, clientY: screen.y }, svg)`, `app/src/painter.js:29-32` unchanged, reading the screen transform at each event |
| `hit` | `(target, event) => ...`: `null` on a `leave`; otherwise `{ on, region }`, `on` from `hitWith(picks)` handed `{ target }` and the fact's modifiers (`app/src/pick.js:53-83`, unchanged), and `region` from `regionOf(target, regions)` on a `down` alone, else `null` (`app/src/capture.js:38-53`) |
| `focus` | `(target, event) => ...`: on a `key-down` alone, today's field test first (`:70`) -- `{ typing: true, onControl: false }` when the key is typed into a field, the control test not run -- and otherwise `{ typing: false, onControl }`, today's control test (`:32-34`, `:64`); else `null` |
| `deliver` | the round trip below |

So the hit test runs on exactly the events `hitOf` ran on today, the field test on every key-down and the control test on every key-down not typed into a field, as today; and the adapter names each function's fact `event`, so it reads `event.type`, the form `tests/canvas-names-no-plugin.test.js` exempts from its plugin-field count.

**The round trip,** each step today's:
1. A `leave` calls `sink.leave()`, and a `key-down` whose focus is `typing` is dropped, as today's capture drops it.
2. Every other fact becomes draw's input event in today's form, field for field and in today's key order: `type`; `button`, `0` for a key; `key`; `repeat`, `false` for a pointer; the modifiers; on a pointer fact `at` and `on`; on a `down` `region`; on a `key-down` `onControl`; `claimed` and `capture` `false`.
3. It is handed to the Input method today's capture calls for its type, `over` and `out` to `hover` with `true` or `false`.
4. In a `finally`, `claimed` makes the adapter call `claim()`, and `capture` `takePointer()`, so what Input asked before a throw is done, as today.

So every row, Input, the session and the plugins' rows read and write the event they read and write today, and `trigger` stays a field of draw's own event; `emitToHost` stays in the adapter.

**Where it is opened** follows draw's layer rules:
- only the `canvas` part imports `input-capture` (`tools/layers.mjs` `COMPONENTS`, D9), and only `app/src/capture.js`, already a canvas module, names it, which acceptance step 3's test holds;
- `listen()` keeps its place and its order -- the product page after the palette, the lab after its network -- calling `captureCanvas` where it made the class, so the palette's Escape still runs first, and `window.lab.capture` holds the adapter's `{ close }`;
- the adapter names no plugin's kind or selector (`tests/canvas-chrome.test.js:77`), and G1 holds unchanged: `app/src/input.js` reads no DOM.

**The test harness** gains `captureDispatch({ svg, host, sink, picks, regions })`, which makes the fakes it is handed record the listeners added to them, calls `captureCanvas`, and answers the nine methods of section 2.4, each calling the listener the component or the adapter added; `makeInput` hands it as `h.capture`, so the 428 calls are unchanged, and the harness's fake elements gain a `setPointerCapture` that throws, as a browser refuses a synthetic pointer and as today's capture swallowed the fakes' missing one.\
`tests/input-capture.test.js` builds through `captureDispatch` where it built the class, its fakes gaining the `removeEventListener` IC3 requires; its tests stay as they are, the reading of fields moving to the component's own; `tests/input.test.js`'s B45 test finds the same three host listeners, two the component's and the menu's.

A drafting prototype -- the component's reading, facts, reply and lifecycle as section 3 states them, revised for each finding of the second reading (`drafting/v3/`), the adapter, `captureDispatch` and the restated `tests/input-capture.test.js` as above, in a copy of the tree -- passes all 504 tests of the 40 files that drive or compose the canvas, the gesture corpus's 92 scenarios byte-identical among them, with `tests/canvas-names-no-plugin.test.js`, `tests/canvas-chrome.test.js` and `tools/scan-dead.mjs` (`~/taceng/drawv2-eval-runs/h26-readings/ic/drafting/`, `v2/` and `tree/`); of the 2,099 tests in the files that launch no browser, it fails five -- three that need a git checkout, failing on an untouched copy of the tree too, and two that run `scan-layers`, which refuses the prototype's import of the component by path, where the build imports the package by the name `COMPONENTS` admits; a recording run shows revision 1's prototype touching exactly IC1's members and never the target (`platform-members.mjs` there).

**Stays draw's,** because it is draw's content or policy:
- what lies under a pointer (`app/src/pick.js`), where a screen point lies in the drawing (`app/src/painter.js`), run mode's regions, which keys a field keeps and whether focus is on a control;
- the context menu's suppression (B75) and `emitToHost`;
- the input event's form and its `claimed`, `capture` and `trigger` fields, and every row and Input entry point reading it;
- the palette's tile drag (D8, B407), the label editor's field, Escape's order and `touch-action: none`;
- one press for every pointer (B409): draw's event carries no `pointerId`, so the session holds one press, as today.

---

## 6. How the parity is kept

Draw's inputs must reach Input as they did, field for field, and its gestures must commit what they committed, byte for byte.

### 6.1 Four tests from three sides

The component's tests hold section 3 alone; acceptance step 4 holds old against new over every event draw's tests make; the gesture corpus, the browser tests and the matrix corpus hold what draw does with the events; the gesture-sample probe and the production probe hold real gestures and what is drawn.

### 6.2 The differences a careful reader looks for

- **`at` is a frozen record.** It was the conversion's own `DOMPoint` in a browser, holding `z`, `w` and methods; it is a fresh frozen `{ x, y }` of the same numbers now. No code reads more of a position than `x` and `y`, none mutates one (section 2.2), the harness's events always made a plain one, and the prototype replays with the frozen record.
- **The conversion on a `leave`.** It ran on every pointer event but a `leave` and runs on a `leave` too, reading the canvas's screen transform; the adapter's `hit` answers `null` there, and `focus` runs only on a key-down, so the hit test and the two field tests run on exactly the events they ran on.
- **The order of reads.** The event's fields are read once each before the conversion, where today's object literal read them as it was built, and `preventDefault` is read with them, where today it was read only when claimed; a browser's event fields are accessors without effects and its `preventDefault` an inherited method, so neither changes anything.
- **The claim and the pointer capture.** Done by the reply from the adapter's `finally`, after Input returns, as today's `finally` did; the platform's refusal of `setPointerCapture` is swallowed and answered `false`, as today's `catch` swallowed it; and the methods called are those read as the capture opened, which draw never replaces.
- **The listeners.** The same events, the same objects, the same order, no options argument, added when `listen()` is called; the menu's listener after `keyup`, as today; none removed, since draw never closes the capture.
- **A key event's `button` and a pointer event's `key` and `repeat`.** `null` in the fact, written `0`, `null` and `false` by the adapter, as today's literal wrote them for every browser event, which never carries another family's fields.

### 6.3 Defects the inventory found, and what H26.3 changes

H26.3 is an extraction: it changes nothing any input of draw's pages produces, and keeps every behaviour, defects included.

**Inputs nothing in draw produces, which now behave differently** -- listed so that this section is exhaustive for every input a browser, a test or a composition can produce; measured against today's capture by `~/taceng/drawv2-eval-runs/h26-readings/ic/drafting/v2/parity-edges.mjs`, and none found among the events draw's tests make:
- a pointer event whose `clientX` or `clientY` is not a finite number -- a synthetic `Event` with no coordinates -- is refused and delivers nothing, where today its `at` was whatever a `DOMPoint` made of it;
- a pointer event whose `button` is neither absent, `null` nor a safe integer is refused, where today it was carried to Input;
- an event whose `preventDefault` is not a function, or whose reading throws, is refused before delivery, where today it reached Input and threw only if claimed;
- a pointer event carrying `key` or `repeat`, or a key event carrying `button`, reaches Input with `key` `null`, `repeat` `false` or `button` `0`, where today the field was copied;
- a pointer event with no `pointerId` on a press Input captures calls nothing, where today it called `setPointerCapture(undefined)`, which a browser refuses;
- a conversion answering no point with finite coordinates refuses the event, where today Input received it and the session threw on a press or a move -- and a `leave` while the canvas has no screen transform, which only an unrendered canvas has and nothing in draw hides, now throws where `leave()` was called, as every other pointer event already threw;
- a key event whose `key` is not a string has `key` `null`, where today it was carried;
- a surface lacking `setPointerCapture`, `addEventListener` or `removeEventListener`, or a key source lacking either of its two, is refused when the capture opens, where today each pointer capture's failure was swallowed; draw's canvas and window hold them, and the harness's fakes gain the first;
- an `addEventListener` that throws as the capture opens takes back every listener it added, the one whose adding threw among them, where today those added before it stayed.

**Kept, each registered for its own ruling:**
- one press for every pointer (B409), unchanged: the fact carries `pointerId`, draw's event does not;
- a key released while the page lacks focus makes no key-up, since nothing listens for `blur` (section 2.3): a Shift released after the page lost focus leaves the zone layer shown until the next pointer move recomputes it (`app/src/input.js:994`), and leaves a zone selected that H24.3 drops when Shift comes up (`:1622-1636`); read from the code, kept, and registered with a trigger (section 8).

---

## 7. What this piece needs of the shared parts

`SNAP-GRID.md` section 7 is settled and built twice: the repository, the vocabulary and runtime checks, the gate and its consumer test, the release workflow, how draw pins a release, the import map, the vendor mount and the architecture manifest serve `input-capture` unchanged, and neither earlier component needs a new release.\
Where this piece differs:
- **The repository** is `apnex/input-capture`, its package `@apnex/input-capture`, laid out as 7.1 lays out a component, with `lib` `ES2022` alone and `"types": []`: no DOM library, the platform slice being capture's own types (IC9, D2), so the compiler itself refuses any global of the platform's.
- **The source check,** a check of the gate's own, walks every file in `src/` with TypeScript's parser and fails on a `.d.ts` file there, on any declaration carrying `declare` -- `var`, `let`, `const`, `function`, `class`, `enum`, `namespace`, `module`, `global` -- and on a triple-slash reference directive, and checks that `tsconfig.json`'s `lib` is `["ES2022"]` and its `types` `[]`; so no global of the platform's can be declared back, each planted form among the falsifiers of the component's `gate-checks.test.js`, as `input-binding`'s clock check keeps its.
- **`package.json` `exports`** has one entry, `.`, so draw's import map gains one line, and `export-map.json` maps `openCapture` to all four capabilities, `{ part: 'input-capture', serves }`, `deferred` empty.
- **The runtime check** is 7.2's unchanged, since capture names none of its globals, and `input-binding`'s clock check (`check-clock-and-chance.mjs`, its D2) is adopted as written.
- **The consumer test's exercise** opens a capture over plain fakes in Node.js, and over an element in the page, where it dispatches a constructed `PointerEvent` and `KeyboardEvent` -- real event objects, whose fields are inherited accessors -- and finds their facts, the page's `setPointerCapture` refusing the synthetic pointer so `takePointer` answers `false`.
- **I10, a browser test,** joins the gate: Chrome is launched as the consumer test launches it, with a debugging port, and driven over the DevTools protocol through Node.js's global `WebSocket`.
- **The vocabulary check** runs both lists over `src/`, comments included, and a component touching the DOM meets their words in the platform's names: the tester's `keyboard` in `KeyboardEvent` -- capture's own types say "key event" -- and draw's `node` in the DOM's `Node` and in "Node.js", `link` and `anchor` in the `<a>` element, and `layout` in a key layout; no name in section 3 holds one, checked with the check's own match, and no allowance is asked.
- **The built size** is recorded in the component's record at build, as the earlier two recorded theirs.
- **Draw's side:** the dependency line and lockfile (7.5); the import map regenerated and `tests/import-map.test.js:57-60` restated; `COMPONENTS` gaining `@apnex/input-capture` with the `canvas` part alone; `MISSION_KIT` and `ALIGNMENT` restated and the architecture documents regenerated, the target's authored text edited, each with the words appendix B gives (7.7).
- **A deploy in flight** spans three components; the window is the one 7.6 names and B403 holds, unchanged.

---

## 8. Decisions owed

Each is offered with a recommendation; they may be ratified together, or one at a time.\
Ratified together, all eleven as recommended, D6 and D7 as the director answered them, on 2026-10-22 (`dev/DECISIONS.md` H26-8); `H26-8` stands below where the draft wrote its placeholder.

| # | Decision | Recommendation, and why |
|---|---|---|
| D1 | The boundary: capture reads an event's data fields and hands its target only to the application's functions; the fact's form (IC5) is capture's contract, which `input-binding`'s D1 reads (`at`, `button`) and the tester will; a fact holds no time, no event and no target, is frozen, and capture computes no number in it | yes: binding's D1 left the fact's shape here, and a fixed, frozen record of plain data is what both later consumers can depend on and record. Weighed against facts that carry the event (a consumer then holds a live platform object and the boundary is gone) and against mutable facts, as draw's events are (a consumer's write would reach every later reader, and the tester's recorded stream would not be a record). A time field is held with binding's timed triggers (B405) |
| D2 | The platform slice: no DOM library -- capture states the members it touches (IC1) as its own structural types, and a source check refuses any declared global; the runtime check stays 7.2's; I3 holds the slice by a recording test; tested over plain-object fakes in Node.js and with trusted input in headless Chrome in the gate (I10) | yes: with no DOM library the compiler refuses every platform global, so 7.2's check needs no new list -- only the source check -- and the same types make Node.js fakes exact. Weighed against the DOM library with a runtime check banning every global `lib.dom.d.ts` declares (a generated list hundreds long, which a free-variable walk must apply without flagging locals), and against the DOM library with 7.2's check as it is (bans `window` and `document` but leaves `DOMPoint`, `navigator`, `fetch` and timers reachable). I11 proves a browser's elements assignable. The cost is a browser test in a component's gate -- Chrome already runs there for the consumer test -- and its time |
| D3 | The application supplies the surface, the key source and four functions: `toDrawing` asked at every pointer event, `hit` and `focus` handed the platform's target and the fact so far, `deliver` handed each fact and its reply | yes: the conversion asked at each event reads the view as it is then, so pan and zoom (H26.6) change draw's conversion -- or the scene's, handed in its place -- and never capture; the hit handed the drawing point as well as the target serves a scene that answers by point (H26.4) as well as today's picks by element. Weighed against capture converting by the element's own screen transform (it would know SVG, fail for a `<canvas>`, and need to know the view) and against the application handing a matrix it updates (a view change the application misses -- a scroll, a resize -- makes every fact wrong until it notices) |
| D4 | The claim and the pointer capture flow back through a reply handed with each fact, acting at once and only while that fact is delivered; `trigger` and every other answer stay the application's own | yes: acting at once keeps today's rule that what Input asked before a throw is done (`app/src/capture.js:99-102`), and keeps facts frozen. Weighed against a returned answer (a delivery that throws returns none, so a claim made before the throw is lost -- a change) and against mutable facts, as today (D1's objection) |
| D5 | Routes: pointer events on the surface, keys on the key source the application chooses, nothing else; which keys a field keeps, and whether focus is on a control, are the application's focus reading; the context menu stays the application's own listener (B75 in draw's adapter) | yes: draw's typing refusal and Tab test read draw's selectors, which a built-in rule would fix for every application; and the menu is suppressed page-wide today, over the palette and the header, beyond any one surface. Weighed against a built-in field rule (policy in the component), against keys from the surface alone (the canvas would need focus, and keys would stop when it lost it -- a change), and against a menu fact now (its consumer, the tester, is not designed); the menu fact is registered for the tester |
| D6 | The wheel and a pinch, which H26-1 names in capture's duty, are held: capture listens for no `wheel` in H26.3, and their facts are added by a minor release when their first consumer is designed -- the gesture tester's scope (H26.5) or pan and zoom (H26.6), whichever comes first | yes, as the director refined it on 2026-10-22, to be recorded as a ruling at ratification: P4 -- their shape is their consumer's question: whether a trackpad pinch (a `wheel` with `ctrlKey`) and a touch pinch (two pointers) are one fact, whether a wheel's lines and pages are converted, and whether claiming a wheel must be decided before the platform scrolls. Weighed against designing them now (a shape no consumer reads), against waiting for H26.6 alone (the tester, first in H26-3's order, may need the wheel first), and against listening now (a wheel listener that never claims only slows scrolling, and one that claims stops the browser zooming the page -- either decided without its consumer) |
| D7 | The fact carries what the platform reports of the input, verbatim, beyond what draw reads: the screen point, `pointerId`, `pointerType`, `buttons` and `code`; `input-binding`'s one press (B406, B409) is unchanged, draw's event carrying none of them | yes, as the director answered on 2026-10-22, to be recorded as a ruling at ratification: capture is the only source of each, and the consumers in sight are named by H26-1 -- the gesture tester (H26.5) lights a key by its `code` and a mouse's buttons by `buttons`, and pan and zoom (H26.6) start from the screen point, B404's screen travel and a touch pinch's two `pointerId` values; adding them later would change every fact's form. Weighed against holding them until each consumer asks (P4's reading), and against delivering only the primary pointer (it would end B409, but change what a second finger does and remove the pinch's second pointer) |
| D8 | One capture listens to one surface; the palette's tile drag stays draw's, outside capture, and B407 is held again with a new trigger | yes: its click rule is chrome in screen pixels, strict, measured where the release lands, with no `pointercancel` (B407), so moving it onto capture and binding would change what a tile does, while a second capture on the palette, keeping draw's rule, would add a path and change nothing. Weighed against a page-wide capture (one listener for every control, the platform's own boundary between controls rebuilt in the component) |
| D9 | Draw's `canvas` part alone imports it, and `app/src/capture.js` -- draw's adapter, exporting `captureCanvas` in place of the class -- alone names it; `app/src/pick.js` and `app/src/painter.js` are unchanged | yes: the canvas part holds the adapter, `pick.js` and the composition already, so no edge is added, and a function is all `listen()` and the harness need. Weighed against a part of its own for the adapter (it needs `pick.js`, and `compose-canvas.js` needs it, so the two parts would consume each other), against the `renderer` part, home of `painter.js` (capture draws nothing), and against keeping the class with methods that call listeners (test machinery in a product module) |
| D10 | No conformance kit; no clock, no timer, no randomness | yes: nothing in capture is a port another party implements, and a double click is the platform's own event, as binding's D2 has it |
| D11 | `@apnex/input-capture` released as `0.1.0` from `apnex/input-capture`, its one export path `.` | yes: `SNAP-GRID.md` section 7 unchanged; `0.x` until mission-kit admits it |

**Registered on ratification (H26-8),** each with its revival trigger (RU3), as B411 to B413, and B407 held again:
- wheel and pinch facts: when their first consumer is designed -- the gesture tester's scope (H26.5) or pan and zoom (H26.6), whichever comes first (D6);
- a context-menu fact: when an application other than draw needs the menu suppressed over its surface, or draw's B75 rule is next changed;
- a key-up lost to the page's focus (6.3): when a person reports a key, a Shift layer or a zone left behind by switching away, or capture next adds a listener;
- the palette outside capture (B407, again): when the palette's drag is next changed, or a second application needs input from outside its surface.

---

## 9. Axiom alignment audit (M7)

**Identity.**\
H26.0 part 3 at revision 3, read against `703bc19`, identical in code to `3dcaba9`, and mission-kit at `e33c850`, audited in three layers:
- the library: T1's test applied -- capture writes whether it is open, with the listeners it added, reads both back at every event and at `close`, and its owner relies on them, no fact following `close` -- so `declared-capture` is stateful, narrowly, and A1 binds it; the facts and the reply hold nothing between events; it coordinates no actors and runs no model;
- the release process: unchanged from part 1, built twice;
- the consumer: draw, stateful, multi-agent and autonomous as `MISSION-KIT-ALIGNMENT.md` section 5 reads it, to which the move adds a third installed component and changes no state it holds.

**Verdict.**\
Revision 1 was `revise-before-implementation`, by its first reading: how a capture opens when the platform throws, how it closes when a removal throws or re-enters, what a re-entrant `takePointer` answers, and where the reading of a platform object or an event stops were each open, and builders reading them two ways would differ in what the platform is left holding (section 10.1).\
Revision 2 was `revise-before-implementation`, by its second reading: IC2 judged each event field as it was read while IC6 read `clientX` and `clientY` before judging either, and a `clientY` getter that closes the capture made the two orders leave the platform holding eight listeners or none; a reflection on the declaration that threw was refused at the property, not the declaration, as the adopted rule has it; an `addEventListener` that adds its listener and then throws left that listener behind; and the adapter ran the control test on keys typed into a field (section 10.2).\
Revision 3 is `pass, with guardrails`, by its author, and a reading confirming it found nothing (section 10.3).

| Layer | Axiom | Weight | How the design stands |
|---|---|---|---|
| library | A3 Sovereign Composition | load-bearing | One duty, one boundary crossed both ways (3.1); what an event means, where it lies and what is under it are the application's, injected as functions (D3); capture reaches the platform only through what it is handed (IC1, D2). |
| library | A1 Sovereign State Transparency | supporting | The whole state is open or closed and the listeners added, owned by the capture and decided by its owner's own calls alone: open from `openCapture`'s return, closed from the first `close`, whatever the removals do, a failed removal's error rethrown to that owner (IC3). No value reports it, the owner's calls being its record; it is not durable -- a reload drops the platform's listeners and the page opens a new capture. |
| library | A8 Gated Recursive Integrity | load-bearing | Section 4 holds each rule by a test that can fail, the platform slice by a recording test, each lifecycle failure by a throwing fake, and real input in real Chrome in the gate (I10). |
| consumer | A8 Gated Recursive Integrity | load-bearing | The side-by-side test over every event draw's tests make, the gesture corpus, the browser tests, the gesture-sample probe, the production probe and a verifier prove the move; a prototype already replays draw's tests through the contract. |
| consumer | A5 Perceptual Parity | supporting | Nothing a person sees changes (6.3); the facts the tester will show are the ones draw's rows read, through one adapter. |
| consumer | A9 Chaos-Validated Deployment | supporting | Nothing new is claimed of a deploy; the in-flight window stays registered (B403). |
| all | A4 Zero-Loss Knowledge | supporting | Rulings recorded in draw and in the component's own record; the readings kept whole outside the repository and dispositioned in section 10. |
| all | A14 Compounding Learning | supporting | What the first two components' readings and builds settled is built in (section 10), so a reading need not find it again. |
| all | A2, A6, A7, A10, A11, A12, A13 | not materially implicated | No trait brings A2, A11 or A12 into force; no seam between agents is designed (A6, A7, A10); A13 is served by section 8's decisions, each with a recommendation, and by the two the director answered (D6, D7). |

**Tensions, and how they resolve.**
- The duty's two directions against A3's law of one: one boundary, crossed by each event and its answer; the reply exists only while its fact is delivered.
- H26-1's wheel and pinch against P4: named in the duty, held for their first consumer with a trigger, as the director refined it (D6).
- Carrying fields no consumer reads against P4: the director answered D7, the consumers being named by H26-1.
- A component touching a platform against neutrality: held to a closed slice of members read once, no global, and no target read (IC1, I3).
- Never throwing against a platform that throws: a declaration is refused with problems, and a platform's own error is rethrown after what capture added is taken back (IC3).

**Guardrails for the build.**
- G1: every site of appendix B is dispositioned as its row says (acceptance steps 2 and 3), held by a test in draw.
- G2: capture touches no platform member outside IC1, never reads a target, names no global, declares none and loads no DOM library (I3, I12).
- G3: the vocabulary check runs on `src/` comments included, and draw runs it on what it installs.
- G4: H26.3 changes no behaviour of any input draw's pages produce; the inputs nothing produces are those 6.3 lists.
- G5: only the `canvas` part imports `input-capture`, and only `app/src/capture.js` names it.
- G6: where a point lies and what lies under it reach capture only through the application's functions, so pan and zoom change only those.
- G7: draw's input event as the adapter makes it is today's, field for field and in key order (acceptance step 4).
- G8: I10 passes in the component's gate on every push, and every lifecycle rule of IC3 and IC8 is held by a fake that throws or re-enters (I2, I8).

**Closeout hooks.**\
H26.3's verifier re-checks G1 to G8 and acceptance steps 1 to 7; mission-kit admission is asked only after draw runs on the release (C0).

---

## 10. Reviews

H26-3 requires a multi-family reading through context-lab's review panel (M1) before ratification.\
What the first two components' readings and builds found, by kind (`SNAP-GRID.md` and `INPUT-BINDING.md` sections 10 and 11, each component's decision record, D2), and where this design answers each:

| What the earlier readings and builds found | Where this design answers it |
|---|---|
| argument forms read two ways: getters, proxies, accessors, present `undefined`, phantom keys, functions as objects | IC2's rules, the declaration read as binding's IB2 and D2 read one, the platform's objects through ordinary access; an object is `typeof` `'object'` |
| when reading stops, and in what order | IC2's order for the declaration and the platform's members, IC6's for every event, each stopping at the first refusal |
| proxies and getters as application code, re-entry, determinism | IC7 and IC3: each named, every re-entry given its rule, determinism stated for answers that are alike |
| freezing, ownership, key order, receivers, message prefixes, extra arguments | the Errors and What is returned paragraphs, as binding's build settled them |
| numerical claims not exact | capture computes no number; `at` and `screen` hold exactly what was read (IC5, I6) |
| the contract's columns and headings added at build | section 3.3's Requires and Trait columns; section 3.5's Reference |
| optional types tripping a consumer under `exactOptionalPropertyTypes` | I11, compiled both ways |
| records and tests missed | appendix B, from a search of the tree: the harness, its 24 files and its fixture, the tests that build the class or read its text, the plugins writing `claimed` |
| behaviour changes not listed | 6.3, the inputs nothing produces listed apart and measured; 6.2 for every difference that changes no outcome; a prototype replays draw's tests through the contract |
| draw's layer rules | section 5 and D9: one part, one module, the plugin-field exemption named |
| an export map left open; a listed word in a platform or runtime name | section 7 states both |

### 10.1 Reading 1 -- 2026-10-22, of revision 1 at `c7ea0c3`

Read cold through context-lab's review panel, `--tools on --verify`, the repositories mounted read-only, by `gemini-4-argon` (`a`), `grok-4.20-non-reasoning` (`x`) and `gpt-6-astra` (`o`), none of which drafted it, the reading kept whole at `~/taceng/drawv2-eval-runs/h26-readings/ic/reading-1/` outside the repository; the panel's first launch died when the shared scratch folder was wiped, and it was run again.\
It reported 25 findings: 10 from `a`, 11 from `o` and 4 from `x`; 9 blocking, 12 should-fix and 4 minor.\
Every reader returned verdicts on the others' findings: `a` supported all 11 of `o`'s, `x` refuted them all; `o` supported 5 of `a`'s and `x` 7; `a` and `o` refuted all 4 of `x`'s.\
Every finding was read against the code at `c7ea0c3`, and each behavioural claim was run, the scripts kept in `~/taceng/drawv2-eval-runs/h26-readings/ic/drafting/v2/`: revision 1's and revision 2's prototypes over the lifecycle and reading cases (`lifecycle.mjs`), today's capture against the adapter (`parity-edges.mjs`), and Chrome with trusted input (`chrome-platform.mjs`).\
The director answered D6 and D7 while the reading ran.

| Finding | What it said | Disposition, and why |
|---|---|---|
| a:F1 | where an event's reading stops, a non-object event, and whether the answer's `y` is read when `x` is refused, read two ways | **Fixed.** IC2 and IC6: an event judged by `typeof` before any read, its fields read and judged one at a time, stopping at the first refused, as binding's IB2 rule 8 and D2 settled; the answer's `x` and `y` both read before judged, as a point is. Revision 1 read every field before judging any, which `o` and `x` took as settled; the earlier components' rule is adopted instead. |
| a:F2 | where reading a surface's or key source's members stops, and whether a refused surface stops the key source's | **Fixed**, as `o` supported: IC2 rule 2 judges each member as read, stopping at the first that throws or is no function, the key source read whatever the surface's were; I1 holds the finding's case. |
| a:F3 | members looked up again at each call, `preventDefault` read only by `claim`, and I3's log depending on what the delivery calls | **Fixed**, as `o` supported: every member is read once -- the surface's and key source's as the capture opens, `preventDefault` with the event's fields -- and the function read is the one called; I3 names its sequence. |
| a:F4 | whether an event after `close`, or a `close` inside `hit`, still delivers | **Fixed**, as `x` supported: IC3 rule 1 -- a listener of a capture not open makes no fact, and a fact begun is delivered with a live reply; run in `lifecycle.mjs`. `o` held removal enough, but a removal may fail (o:F2). |
| a:F5 | draw's `Capture` class, which `tests/input-capture.test.js` builds directly, and two tests in `tests/input.test.js`, left out | **Fixed**, confirmed: `captureCanvas` replaces the class, the harness's `captureDispatch` answers the nine methods, the test builds through it, and the B45 and B75 tests are in appendix B; the restated tree passes, `scan-dead` with it (section 5). |
| a:F6 | the ambient-declaration check's scope | **Fixed**, as `x` supported: section 7 states the walk, every `declare` form, a `.d.ts` file and the `tsconfig.json` settings, and adds the triple-slash reference directive, which could bring the DOM library back. `o` held the rule enough; its scope cost a sentence. |
| a:F7 | D6 not refined to the first consumer | **Fixed** by the director's answer: sections 1 and 3.4, D6 and its trigger name H26.5 or H26.6, whichever comes first. |
| a:F8 | the `Requires` and `Trait` columns, and the Reference heading, missing | **Fixed**, as `o` and `x` supported: both columns in section 3.3, `declared-capture` marked stateful (o:F11), and section 3.5's Reference. |
| a:F9 | the test files and calls miscounted | **Fixed**, as `x` supported: 24 test files make 424 calls and the corpus's fixture 4; the nine methods were right. `o` refuted it as wording; a count a builder checks is worth getting right. |
| a:F10 | I11 does not compile under `exactOptionalPropertyTypes` or with the options omitted | **Fixed**, as `o` and `x` supported: I11 compiles both ways, omitted `hit` and `focus` giving `null`, and `focus` without `keys` failing to compile (IC9). |
| o:F1 | opening has no outcome when an `addEventListener` throws | **Fixed**, reproduced -- revision 1's prototype left two listeners: IC3 rules 2 and 3 judge everything before any call, then add in a fixed order, and on a throw remove what was added, in reverse, and rethrow; Errors narrows "never throws" to the declaration. |
| o:F2 | closing is undefined when a removal throws or re-enters | **Fixed**, reproduced -- revision 1 left all eight and still delivered: IC3 rule 5 closes first, attempts every removal in reverse, rethrows the first error, and makes every later call nothing; a listener left makes no fact. |
| o:F3 | a re-entrant `takePointer` has no answer to give | **Fixed**, reproduced -- revision 1 recursed 2,453 times: IC8 marks the first call in progress, a call during it throws, and the outer call answers as `setPointerCapture` returned or threw; I8 holds both routes. |
| o:F4 | platform-member validation's stopping point | **Fixed**, as a:F2. |
| o:F5 | a throwing `preventDefault` getter reaches `deliver` | **Fixed**, reproduced: `preventDefault` is read and judged with the fields, so the event is refused before delivery; a `preventDefault` that throws when called spends the claim. |
| o:F6 | IC6's coordinate refusal applies to key events as written | **Fixed:** step 2 reads and judges coordinates and `button` for a pointer event alone; I4 adds an ordinary key event. |
| o:F7 | 6.3 omits the cross-family fields and `setPointerCapture(undefined)` | **Fixed**, reproduced: both in 6.3, measured, and acceptance step 4 holds each with both answers; draw's test events carry neither, measured over the 40 files. |
| o:F8 | the adapter's callbacks on a `leave` and a key-up add failure paths | **Fixed:** draw's `hit` answers `null` on a `leave` and `focus` reads only on a key-down, as today's tests ran (section 5); the conversion on a `leave` is named in 6.2, and its one failure, an unrendered canvas, which nothing in draw makes, in 6.3. |
| o:F9 | the inventory overlooks a touch's implicit capture | **Fixed**, confirmed in Chrome, which `o` could not run: section 2.3 tells a mouse's loss of an uncaptured pointer from a touch's capture to the pressed child; I10 adds the case. It changes nothing H26.3 does. |
| o:F10 | `-0` against the JSON round trip | **Fixed:** IC5 and I7 name the one loss. |
| o:F11 | the M7 audit excluded T1 by the state's size | **Fixed:** section 9 applies T1's test -- written, read back, relied on -- marks `declared-capture` stateful and audits A1 for it. |
| x:F1 | section 2.1 misses `pointerenter`, `lostpointercapture`, focus, blur, `visibilitychange` and touch | **Not changed**, as `a` and `o` found: capture listens for none of them (`app/src/capture.js:79-94`), and section 2.3 and IC4 named them absent; revision 2 adds `pointerenter` and `visibilitychange` to the list, the page's one listener for the latter being the undelete offer's. |
| x:F2 | the fact's form and reading order let two builders differ | **Not changed**, as `a` and `o` found: IC5's written order fixes the keys, and the reading order is now complete (a:F1). |
| x:F3 | the reply's lifetime and re-entry underspecified | **Not changed in substance**, as `a` and `o` found: revision 1 ended the reply when `deliver` returned or threw and allowed nesting; IC3 and IC8 now state each re-entry once (o:F2, o:F3). |
| x:F4 | D7 carries fields against P4 | **Not changed**, as `a` and `o` found: the director answered D7 as recommended. |

### 10.2 Reading 2 -- 2026-10-22, of revision 2 at `703bc19`

Read cold through context-lab's review panel, `--tools on --verify`, the document read from disk, by the same three, none of which drafted it, the reading kept whole at `~/taceng/drawv2-eval-runs/h26-readings/ic/reading-2/` outside the repository.\
It reported 9 findings: none from `a`, 4 from `o` and 5 from `x`; 2 blocking, 6 should-fix and 1 minor.\
Every reader returned verdicts: `a` supported all 4 of `o`'s and `x` 3 of them, its verdict on the fourth refuting it in words that agree with it; `a` refuted all 5 of `x`'s, and `o` 4, supporting x:F2.\
Every finding was read against the code at `703bc19`, and each behavioural claim was run, against revision 2's prototype and revision 3's, and today's capture against each revision's adapter (`~/taceng/drawv2-eval-runs/h26-readings/ic/drafting/v3/reading-2.mjs`); revision 2's lifecycle cases were run again on revision 3 (`lifecycle.mjs` there).

| Finding | What it said | Disposition, and why |
|---|---|---|
| o:F1 | IC2 judges each event field as it is read, IC6 reads `clientX` and `clientY` before judging either | **Fixed**, reproduced: with `clientX` `NaN` and a `clientY` getter that closes the capture, revision 2's prototype read both and was closed, eight listeners gone, where IC2's order leaves all eight. IC6 step 2 now reads and judges `clientX` before reading `clientY`, IC2 rule 3 saying why -- an event is not a point, whose `x` and `y` are read together -- and I5 holds the case. |
| o:F2 | a throwing reflection on the declaration is refused at the property, against the rule adopted from `input-binding` | **Fixed**, reproduced: revision 2's prototype answered `invalid-value` at `/toDrawing` and read on, where `input-binding`'s reader refuses the record whose reflection threw. IC2 rule 1 states the rule as binding applies it -- `not-an-object` at `""`, nothing further read -- IC3's step 1 names it, and I1 holds the case. |
| o:F3 | an `addEventListener` that adds its listener and then throws leaves it behind | **Fixed**, reproduced -- revision 2's prototype left `pointermove` added: lifecycle rule 3 removes that very listener first, harmless if it was never added, then the rest in reverse; I2 throws before and after adding, and the closing sentence names the one way a listener can still be left, a removal that throws. |
| o:F4 | the adapter runs the control test on a key-down typed into a field, which today's capture drops first | **Fixed**, reproduced: with a typed key-down whose target's `closest` throws, today's capture and revision 3's adapter return, revision 2's threw. Draw's `focus` runs the field test first and the control test only on a key not typed into a field (section 5). |
| x:F1 | section 2.1 misses `pointerenter`, `gotpointercapture`, `lostpointercapture`, focus and blur | **Not changed**, as `a` and `o` found: section 2.1 lists the listeners draw adds today, which include none of them, and section 2.3 and IC4 name each as absent. |
| x:F2 | section 2.3 claims no `visibilitychange` listener, but `app/src/main.js:278` has one | **Clarified**, as `o` supported: the listener exists, on `document`, and revision 2 named it, but in a sentence opening "Nothing listens"; section 2.3 now says capture listens for none and the page's own listener refreshes the undelete offer, draw's chrome outside capture. IC4's list is capture's, and stays. |
| x:F3 | key facts carry no `button` or `repeat` in IC5, but the adapter sets them | **Not changed**, as `a` and `o` found: IC5 gives a key fact `button` `null` and the event's `repeat`; the adapter writes draw's own event from the fact, `0` and `false` where today's literal wrote them (section 5, step 2; 6.2). |
| x:F4 | IC6 step 2 reads coordinates and `button` for key events | **Not changed**, as `a` and `o` found: the step read them for a pointer event alone and said a key event's are never read; o:F1's fix restates the step. |
| x:F5 | 6.3 omits refused events and the early `preventDefault` read | **Not changed**, as `a` and `o` found: 6.3 lists the refused events and 6.2 the early read; the one path the reading found absent was o:F4's, now gone. |

### 10.3 Reading 3 -- 2026-10-22, of revision 3 at `3edf2e3`, confirming

A reading scoped to revision 3's changes and section 10.2's dispositions, by `gemini-4-argon` (`a`) and `gpt-6-astra` (`o`), kept whole at `~/taceng/drawv2-eval-runs/h26-readings/ic/reading-3/`.\
Each read the diff, ran the drafter's `reading-2.mjs` and `lifecycle.mjs`, and found nothing: no finding of section 10.2 only claimed, and no fault introduced.

---

## Appendix A -- `input-capture`'s vision, the draft put to the director

Ratified by the director as written, with section 8 (H26-8); `input-capture`'s `VISION.md` is made from it when its repository is.

**North star.**\
Let every application meet the platform's input in one place, and receive it as the same plain facts everywhere.

**Why it exists.**\
Applications read a browser's events wherever they need one -- a coordinate here, a button there, a `preventDefault` deep in a handler -- so the platform leaks into every layer, and input cannot be tested, recorded or replayed without a browser.\
`input-capture` holds that boundary once: it listens, reads each event into a fact in the application's own coordinates, and does to the event only what the application asks of the fact.

**What it is.**\
An embeddable library with one function: open a capture on a surface, hand it the application's conversion, hit test and delivery, and receive one frozen fact for each pointer, double-click and key event, with a reply that can claim the event or take the pointer.

**What it is not.**
- Not a binder: what an input means is `input-binding`'s.
- Not a hit tester or a view: what lies under a point, and where a screen point lies, are the application's.
- Not a page listener: it listens to the surface and the key source it is given.
- Not a clock: a fact holds no time.
- Not a network service: it never listens to or sends anything but events.

**What success means.**
- **Fidelity:** a fact says exactly what the platform reported, and nothing the application did not supply.
- **Containment:** no layer above it needs the platform's event to work.
- **Testability:** every input an application handles can be driven without a browser, and is proved with one.
- **Reuse:** a second, unrelated application adopts it without a variant, a fork or a change.

**Authority.**\
Held by the director; drafted by anyone, ratified only by the director; amended, never quietly rewritten.

---

## Appendix B -- every site H26.3 touches

From the inventory of `3dcaba9`, rechecked at `703bc19`, paths as H26.7 left them: product code, and the records that name it.\
*moves* -- to `input-capture`, through the adapter; *stays* -- draw's content or policy, unchanged; *kept* -- behaviour kept exactly, registered (6.3); *plumbing* -- an import, a record or a line that goes or is repointed; *unchanged* -- a site that names what moves, or lies on an input route, and needs no edit.

| Site | Today | H26.3 |
|---|---|---|
| `app/src/capture.js:1-28` | the header | plumbing: restated as draw's adapter over `input-capture` |
| `app/src/capture.js:29-30` | imports | plumbing: `openCapture` from `@apnex/input-capture` added; `pick.js` and `painter.js` kept |
| `app/src/capture.js:55-67` | `inputEvent` | moves: the fact to the component (IC5, IC6); draw's event made from the fact, field for field (section 5) |
| `app/src/capture.js:72-94` | the class `Capture` and its listeners | moves: to `openCapture` (IC3, IC4), the class replaced by `captureCanvas`; the `contextmenu` listener stays |
| `app/src/capture.js:96-103` | `#round` | moves: the reply (IC8), called from the adapter's `finally` |
| `app/src/capture.js:105-112` | the class's eight event methods | moves: the adapter's `deliver` routes by fact type; the typing refusal through `focus`; the methods to the harness's `captureDispatch` |
| `app/src/capture.js:32-34,36-53,64,69-70` | the field and control selectors, `regionOf`, `onControl`, `typing` | stays: in the adapter's `hit` and `focus` |
| `app/src/capture.js:114-121` | the B75 menu | stays (D5) |
| `app/src/capture.js:124-127` | `emitToHost` | stays |
| `app/src/pick.js:32-83,123-125` | `picksOf`, `hitWith`, `regionsOf` | unchanged: `hitWith` handed the target and the modifiers |
| `app/src/painter.js:28-32` | `toCanvas` | unchanged: draw's conversion |
| `app/src/compose-canvas.js:33-34,80-83` | `listen()` | plumbing: calls `captureCanvas`; its order and its answer's use unchanged |
| `app/src/main.js:63,93-97` | the window handed in; the palette, then `listen()` | unchanged |
| `lab/src/root.js:75,107,221` | the window; `listen()`; `window.lab.capture` | unchanged, `window.lab.capture` holding the adapter's `{ close }`, which no test reads |
| `app/src/input.js:43,446` | `emitToHost` | unchanged |
| `app/src/input.js:582,626,990,1085,1289,1332,1370,1608,1614` | Input's entry points | unchanged: draw's input events, as today |
| `app/src/input.js:660,1088,1378,1412,1429,1469-1470,1485,1556,1598` | `capture`, `trigger` and `claimed` written | unchanged |
| `plugins/network/keys.mjs:43,47`, `plugins/simulation/spawn-runs.mjs:42,56`, `plugins/devices/device-panels.mjs:15,18` | `claimed` written by plugins' rows | unchanged |
| `app/src/input-state.js:35-44`, `kernel/input-rules.mjs` | `at` and `button` read | unchanged: the frozen `at` holds the same numbers (6.2) |
| `app/src/input-state.js`, `app/src/input.js:626-666` | one press for every pointer | kept (B409) |
| `app/src/input.js:994,1622-1636` | a key-up lost to the page's focus | kept (6.3), registered |
| `app/src/palette.js:29,46-52,104,128-174` | the tile drag, its Escape and click rule | stays (D8, B407) |
| `app/src/labeledit.js:80-97,148-158` | the label editor's keys and blur | stays |
| `app/canvas.css:9` | `touch-action: none` | stays |
| `app/src/main.js:278` | `visibilitychange`, the undelete offer | unchanged: no input |
| `package.json`, `package-lock.json` | the dependencies | plumbing: the release file pinned by its hash |
| `app/index.html:8-18`, `lab/index.html:29-39` | the import map | plumbing: regenerated, one entry more |
| `tools/layers.mjs:159-166` | `COMPONENTS` | plumbing: `'@apnex/input-capture': { parts: ['canvas'], by: ['H26-1', 'H26-2', 'H26-8'] }` |
| `tools/layers.mjs:176-194` | `MISSION_KIT_READ`, `MISSION_KIT` | plumbing: `'input-capture': 'proposed in drawv2, released from its own repository, composed (H26-8)'`, the date renewed |
| `tools/layers.mjs:195-211` | `ALIGNMENT.canvas` | plumbing: `to: ['input-binding', 'input-capture']`, waiting `'consumes input-binding through rules (H26-6) and input-capture itself (H26-8); its rows and gesture bodies stay draw\'s (B389)'` |
| `tools/layers.mjs:114-121` | the canvas part's modules | unchanged: `app/src/capture.js` stays in them |
| `tools/scan-dead.mjs` | exports with no production consumer | unchanged: `captureCanvas` has `compose-canvas.js`, and the class goes (run on the prototype's tree) |
| `tools/import-map.mjs`, `tools/scan-components.mjs`, `server/static.mjs` | the map, the vocabulary scan, the vendor mount | unchanged: they read and serve a third package as they do two |
| `docs/ARCHITECTURE.md` | generated parts and alignment | plumbing: regenerated |
| `docs/ARCHITECTURE-TARGET.md:90,190,326,340` | the justification chain, section 4.2's `canvas` row, section 9.3 | plumbing: the chain cites `H26-8`; the `canvas` row reads "press rows, gestures, keys and the hand, each a part's declaration over shared gestures, the platform's events reaching them through `input-capture` (D1, D2, H26-8)"; section 9.3's first sentence names three components, `input-capture` through the `canvas` part |
| `tests/import-map.test.js:57-60` | the whole import map | plumbing: restated with `input-capture`'s entry |
| `tests/fixtures/client-harness.mjs:42-43,273` and its fake elements | the harness's `Capture` | plumbing: `captureDispatch` and its nine methods; the fakes' throwing `setPointerCapture` (section 5) |
| `tests/input-capture.test.js:17,26-33,58-71,86,107-110` | the class built over the test's own fakes | plumbing: built through `captureDispatch`, the fakes gaining `removeEventListener`; the reading of fields to the component's tests; the region, typing, Tab, B75 and B268 tests and G1 stay |
| `tests/input.test.js:766-777,1383-1400` | B45's host listeners; B75's menu | unchanged: the same three host listeners, the menu through `onContextMenu` |
| the 24 test files calling `h.capture.on...`, `tests/gesture-corpus.test.js`, `tests/fixtures/gesture-corpus.mjs` and its JSON | 428 calls; 92 scenarios | unchanged: replaying byte-identical is acceptance step 5 |
| `tests/canvas-chrome.test.js:77`, `tests/canvas-names-no-plugin.test.js` | the adapter's text | unchanged: it names no plugin's selector, and reads a fact's type as `event.type` |
| `tests/canvas-picks.test.js`, `tests/pipe-select.test.js`, `tests/fixtures/binding-parity.mjs:99` | `hitWith`; a key event as capture made one | unchanged |
| `tests/browser.test.js`, `tests/input-binding-browser.test.js`, `tests/fixtures/matrix-runner.mjs`, `tools/probe/gesture-sample.mjs` | real input in Chrome | unchanged: acceptance step 5 |
| `input-capture-move.test.js`, new in `tests/` | none | plumbing: acceptance steps 3 and 4 |
| `dev/INPUT.md`, `dev/design/input/GESTURE-SYSTEM.md` sections 5.1 and 13 | capture as built at stage 1b | plumbing: kept as written (RU2), each gaining a dated line at H26.3 naming the component |
