# H26.0, part 3 -- `input-capture`

The third piece of H26's design of record (`dev/DECISIONS.md` H26-3, as H26-5 amended it).\
It designs `input-capture`, the component that stands between a platform's input events and an application: each event on the surface it is given becomes one fact, in the application's coordinates, and what the application asks of that fact is done to the event.\
It builds on part 1 (`SNAP-GRID.md`), whose section 7 is settled and built twice, and on part 2 (`INPUT-BINDING.md`), whose D1 left the shape of a fact to this piece; it states only where it differs from either, and cites rather than restates what their readings and builds settled.

**Standing:** a design under review, revision 1, drafted 2026-10-21; the code read is `3dcaba9`'s, after H26.7 moved every plugin under `plugins/`; not ratified.

---

## 1. What this decides, and what it does not

It decides:
- `input-capture`'s one duty, its vocabulary and its contract, precisely enough that an agent other than its author could build it from section 3 alone;
- the boundary with the platform: what capture touches of a browser, how it is kept to that, and how it is tested without a browser and with one (D2);
- what an application supplies -- the surface, the key source, the conversion to its coordinates, the hit test, the reading of a key's focus, the delivery -- and that pan and zoom change only the application's conversion (D3);
- the shape of a fact, which `input-binding` reads (its D1) and the gesture tester will, and how a claim and a pointer capture flow back to the platform (D1, D4);
- which events become facts, and which are named and held: the wheel, a pinch, the context menu (D5, D6);
- the fields carried from the platform beyond what draw reads, and several pointers (D7);
- events outside the surface -- the palette's tile drag (D8) -- and which part of draw imports the component, with what remains of `app/src/capture.js` (D9);
- the invariants and tests that hold it, the acceptance steps for draw's move onto it (H26.3), and every site that move touches (appendix B).

It does not decide:
- `input-binding`'s contract, ratified (H26-6) and built, which reads a fact's `at` and `button` and nothing else;
- `vector-scene` or how a hit is found once a scene reports what lies under a point (H26.4) -- only that the hit test stays the application's function, handed the drawing point as well as the platform's target;
- pan and zoom (H26.6): the wheel and pinch facts they need, and whether a press's travel is measured on screen (B404);
- the gesture tester's scope (H26.5), beyond the fields its keys and mouse need (D7);
- draw's policy -- Escape's order, keys typed into a field, Tab beside a control, the context menu (B75), run mode's regions, the label editor, the palette -- each draw's, through the functions draw supplies or outside capture;
- the defects the inventory found (section 6.3): each is kept by H26.3 and registered for its own ruling.

---

## 2. What draw does with platform events today

Read from the code at `3dcaba9`; appendix B lists every site, one row each, with what H26.3 does with it.\
`INPUT-BINDING.md` section 2.4 inventoried the fields and routes at `5b4997b` as capture's starting obligation; this section restates them at HEAD, where H26.2 moved Input's line numbers.

### 2.1 The listeners and the round trip

`app/src/capture.js` (127 lines) is L0 of the gesture system (`dev/design/input/GESTURE-SYSTEM.md` section 5.1): the only module whose code reads a browser event for the canvas.
- **The listeners** (`:79-94`): on the canvas element, `pointerleave`, `pointerdown`, `pointermove`, `pointerup`, `pointercancel`, `pointerover`, `pointerout` and `dblclick`, in that order; on `host` -- the page's `window`, handed in by each root (`app/src/main.js:63`, `lab/src/root.js:75`) -- `keydown`, `keyup` and `contextmenu`; each with no options argument.
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
| `key`, `repeat` | `evt.key ?? null`, `!!evt.repeat` | the key rows and key releases (`app/src/keymap.js`); the digit and arrow actions (`app/src/input.js:1479`, `:1567`) |
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
- Pointer capture is taken only on a press a row matches (`:660`), so a press no row means loses its moves off the canvas; a captured pointer's events are retargeted to the canvas, so `on` is the canvas during a drag, and the gestures find their targets from the drawing point (`anchorAt`).
- Pointer Events deliver a second mouse button pressed while one is held as a `pointermove`, so one mouse makes one press; a touch contact or a pen is a pointer of its own, `button` 0 for touch, and the canvas takes touch as pointer events (`touch-action: none`, `app/canvas.css:9`); facts keep no `pointerId`, so a second pointer replaces the first's press (B409).
- Keys arrive on the window: the palette's own `keydown` listener is registered first and spends an Escape that cancels a tile drag (`app/src/palette.js:46-52`), so capture starts only when a root calls `listen()` after its own listeners (`app/src/compose-canvas.js:80-82`, `app/src/main.js:93-97`); the label editor's field stops each of its key-downs (`app/src/labeledit.js:80-97`, `:148-158`), so no key-down typed there reaches the window, while every key-up does -- a Shift released in a field still reaches the key-release rows.
- Nothing listens for `wheel`, `blur`, `focus`, `lostpointercapture`, a touch event or `gesturestart`: a trackpad pinch arrives as a `wheel` with `ctrlKey` and the browser zooms the page; a touch pinch is two pointers; a key released while the page lacks focus makes no key-up (6.3).
- The palette's tiles have their own press, pointer capture, move and release, no `pointercancel` listener, and their own click rule in screen pixels (`app/src/palette.js:29`, `:104`, `:128-174`; B407).

### 2.4 Who opens it, and what holds it

`composeCanvas` returns `listen()`, which makes the one `Capture` with the parts' picks and run-mode regions (`app/src/compose-canvas.js:33-34`, `:80-82`); the product page calls it after the palette (`app/src/main.js:97`) and the lab after attaching its network, exposing it as `window.lab.capture` (`lab/src/root.js:107`, `:221`).\
The test harness builds a `Capture` over a fake canvas and window (`tests/fixtures/client-harness.mjs:42-43`, `:273`) and hands tests its methods: 25 test files make 426 calls of `h.capture.onDown`, `onMove`, `onUp`, `onKeyDown` and the rest, the gesture corpus's 92 scenarios among them (`tests/fixtures/gesture-corpus.mjs`).\
`tests/input-capture.test.js` holds capture's own contract and G1 -- `app/src/input.js` reads no DOM -- and `tests/canvas-chrome.test.js:77` holds that `app/src/capture.js` names no plugin's selector.

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
It does not decide what an input means, find what lies under a pointer, convert coordinates, keep state between events, read a clock, or draw anything -- each is `input-binding`'s, the application's or another component's.

### 3.2 Vocabulary

| Word | Meaning |
|---|---|
| platform | what delivers input events and owns the surface: a browser, or anything of the same shape |
| surface | the element whose pointer events capture listens to, and on which it takes the pointer |
| key source | what capture listens to for key events, which the application chooses |
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
| modifiers | `shiftKey`, `ctrlKey`, `altKey` and `metaKey`, as an event carries them |

### 3.3 Contract

One capability per row; none requires another component's capability.\
A capture keeps no state between events but whether it is open, so it is not stateful in T1's sense (section 9).

| Capability | Relation | What a consumer can depend on |
|---|---|---|
| `declared-capture` | provides | A capture opened on a surface, and optionally a key source, from the application's functions, or refused with every problem; closed by removing exactly the listeners it added (IC2, IC3). |
| `pointer-facts` | provides | Each pointer and double-click event on the surface as one fact, in the coordinates the application's conversion gives, with the application's hit (IC4 to IC7). |
| `key-facts` | provides | Each key-down and key-up on the key source as one fact, with the application's focus (IC4 to IC7). |
| `fact-reply` | provides | What the application asks of a fact while it is delivered -- the event claimed, the pointer taken -- done to that fact's event at once (IC8). |

**Errors.**\
`openCapture` never throws, for any argument: it refuses with problems.\
A listener that cannot read an event throws a `TypeError` whose message begins with the platform event's name -- `pointerdown: ` -- before it calls any application function, and delivers nothing; a conversion answering no point makes it throw a `TypeError` beginning `toDrawing: `, and deliver nothing.\
An error a getter or a `Proxy` trap throws while an event or the conversion's answer is read is rethrown as the `TypeError` that reading would throw, its message beginning with the event's name or with `toDrawing: `.\
A reply used after its delivery has ended throws an `Error`, the base constructor, beginning `claim: ` or `takePointer: `.\
An exception an application function throws propagates out of the listener unchanged; capture catches nothing but the platform's refusal to take a pointer (IC8).\
A message's beginning is the contract and the rest is prose, as in `input-binding` -- the bare function or event name, a colon and a space.

**What is returned.**\
Every value capture makes -- an open result, a problem list, a capture, a fact, its `at` and `screen`, a reply -- is made afresh and frozen to its depth, down to but not into the application's own values it holds, the `hit` and `focus` answers, which it holds by reference and never reads, copies or freezes.\
Every record holds its properties in the order its form is written in this section, and nothing else; every function capture makes needs no receiver.

**IC1 -- What capture touches of the platform.**\
Capture reaches the platform only through the values the application hands it, and touches of them exactly:
- of the surface: `addEventListener`, `removeEventListener` and `setPointerCapture`, each called as its method;
- of the key source: `addEventListener` and `removeEventListener`;
- of a pointer or double-click event: `clientX`, `clientY`, `button`, `buttons`, `pointerId`, `pointerType`, the four modifiers and `target`, and `preventDefault` called as its method;
- of a key event: `key`, `code`, `repeat`, the four modifiers and `target`, and `preventDefault`.

It reads no other member, never reads a target's members, and names no global: no `window`, no `document`, no constructor of the platform's.\
So it cannot reach beyond the surface and the key source it is given, and the same code runs over a browser's objects and over plain objects of their shape.

**IC2 -- How values are read.**\
The declaration is the application's argument and is read as `input-binding` reads one (`INPUT-BINDING.md` section 3.3, IB2 rules 1 to 3 and 6): a plain object's own data properties by descriptor, an accessor of no form, an inherited property absent, a symbol-named property ignored, a property present as `undefined` of no form, and reflection that throws making its value of no form.\
It is read in this order, once each, stopping beneath a value refused at its pointer: its prototype; its own keys; the descriptors of `surface`, `keys`, `toDrawing`, `hit`, `focus` and `deliver` that its own keys hold, in that order; then the surface's `addEventListener`, `removeEventListener` and `setPointerCapture`, and the key source's `addEventListener` and `removeEventListener`.\
The surface, the key source and every event are the platform's, whose members are inherited methods and accessors, so they are read through ordinary property access: an event's fields once each, in IC6's order; a surface's or key source's member once when it is judged at opening, and again at each call of it, so the member called is the one it holds then.\
An object is a non-null value whose `typeof` is `'object'`, so a function never is one; a function is a value whose `typeof` is `'function'`.

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
| 1 | the declaration is not a plain object | `not-an-object` at `""`, and nothing else |
| 2 | an own property other than the six; `surface`, `toDrawing` or `deliver` absent | `unknown-property` at `/<name>`, one each; `missing-property` at `/<name>` |
| 3 | `surface` an accessor, not an object, or one of its three members not a function or unreadable | `invalid-value` at `/surface` |
| 4 | `keys` present and an accessor, not an object, or one of its two members not a function or unreadable | `invalid-value` at `/keys` |
| 5 | `toDrawing`, `hit`, `focus` or `deliver` present and an accessor or not a function | `invalid-value` at its pointer |
| 6 | `focus` present and `keys` absent | `invalid-value` at `/focus` |

An open capture has added, before `openCapture` returns, exactly the listeners IC4 lists, in its order, each with no options argument, and adds none later.\
`capture` is a frozen `{ close }`: `close()` removes each listener it added, in the order added, and then does nothing on any later call; it returns `undefined`.\
A listener removed is never called again, as the platform guarantees; a fact begun before `close` is delivered.

**IC4 -- Which events become facts.**\
Each listener makes one fact from the event it is called with, synchronously, and delivers it before it returns, unless it refuses the event (IC6); capture queues, merges, defers and synthesizes nothing, so the platform's own sequence -- a second mouse button as a move, a touch contact as a pointer of its own -- is the facts' sequence.

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
Capture listens for nothing else: no `wheel`, `contextmenu`, `click`, `pointerenter`, `gotpointercapture`, `lostpointercapture`, `focus`, `blur`, touch, gesture or composition event (D5, D6).

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
A fact holds no time, no event, no target and no function, so a fact made from plain data survives a JSON round trip but for the application's own `hit` and `focus` answers.

**IC6 -- Making a fact.**\
For each event a listener receives, in this order:
1. it reads the event's fields once each, in IC1's order -- for a pointer event `clientX`, `clientY`, `button`, `buttons`, `pointerId`, `pointerType`, `shiftKey`, `ctrlKey`, `altKey`, `metaKey`, `target`; for a key event `key`, `code`, `repeat`, the four modifiers, `target`;
2. it refuses the event, with Errors' `TypeError`, when `clientX` or `clientY` is not a finite number, or `button` is neither `undefined`, `null` nor a safe integer;
3. for a pointer event it calls the conversion with the screen point, a fresh frozen point, and reads the answer as IC7 says;
4. it makes the fact with `hit` and `focus` `null`, hands it with the target to `hit` for a pointer fact or to `focus` for a key fact, when that function is given, and makes the fact to deliver, a fresh frozen record of the same form holding the answer;
5. it calls `deliver` with the fact and a fresh reply, which ends when `deliver` returns or throws.

**IC7 -- The application's functions.**\
Each is called synchronously, with no receiver -- as `Reflect.apply(fn, undefined, args)` calls it -- at most once for each event, at the step IC6 gives:
- `toDrawing(screen)` answers where the screen point lies in the application's coordinates; capture requires an object, reads its `x` and then its `y` through ordinary property access, so a `DOMPoint`'s getters answer, and requires both finite numbers, else Errors' `TypeError`;
- `hit(target, fact)` and `focus(target, fact)` answer any value, which capture holds in the delivered fact by reference and never reads;
- `deliver(fact, reply)`'s answer is ignored.

Each is the application's code, as is a getter of the conversion's answer and any trap of a `Proxy` capture is handed; any may call `close`, open another capture or make the platform dispatch another event, whose fact is made and delivered within that call, with its own reply.\
Capture keeps no state between events but whether it is open, so nothing they do changes how a later event is read; for events whose fields, and application functions whose answers, are alike, the same sequence of events gives the same facts.

**IC8 -- The reply.**\
A reply is a frozen `{ claim, takePointer }`, fresh for each fact and valid only while that fact is delivered:
- `claim()`, on its first call, calls the event's `preventDefault` as its method; a later call does nothing; it returns `undefined`;
- `takePointer()`, on its first call, answers `false` and calls nothing when the fact's `pointerId` is `null`, and otherwise calls the surface's `setPointerCapture` as its method with that `pointerId`, answering `true` when it returns and `false` when it throws -- the platform refusing a pointer that is not active, as for a synthetic event; a later call answers the first answer.

Each acts at once, so what a delivery asked before it threw is done; each throws Errors' `Error` once its delivery has ended.

**IC9 -- Exports.**\
`@apnex/input-capture` exports `openCapture`, and nothing else; it has no subpath.\
It imports no package and no module particular to one runtime, names no global, touches no platform object but those IC1 names, and reads no clock and no randomness and holds no timer, so it runs over a browser's elements and events and, where there is no browser, over plain objects of their shape.\
Its TypeScript declarations state the platform slice IC1 touches as its own structural types, so a browser's elements and events are assignable to them, and are generic in the hit and the focus.

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
| the wheel, a pinch, or the context menu as facts | not yet: held for pan and zoom and for the gesture tester (D5, D6) |
| events from the whole page, or from controls outside the surface | not a page listener: one capture listens to one surface and one key source (D8) |
| a hold, a sequence or a double click decided by time | not a clock: a double click is the platform's own event |

### 3.5 Adjustment policy and edges

Internal and sovereign: a measured gap is recorded where both sides can see it, then resolved by adjusting `input-capture` or by fracturing it if the gap reveals a second duty; never forked.

**Contains:** the listeners, the reading of an event into a fact, and the reply.\
**Consumes:** nothing.\
**Consumed-by:** draw (H26.3), then the gesture tester (H26.5).

The tester needs of capture its key facts' `key` and `code` and its pointer facts' `button`, `buttons` and `pointerType`, to light keys and mouse buttons; it hands its facts to `input-binding` as they are, since a pointer fact holds `at` and `button` as own data properties.

---

## 4. Invariants and tests

There is no conformance kit (D10): nothing in `input-capture` is a port another party implements.\
*`input-capture`* marks what the component's own tests hold; *gate* what its gate holds; draw's own tests are the acceptance steps below.

| # | Invariant | Held by |
|---|---|---|
| I1 | `openCapture` never throws for any value, and answers every declaration with exactly IC3's problems, from a table of cases: present `undefined`, accessors, a revoked and a trapping `Proxy`, a function as the surface, a surface lacking each member in turn, `focus` without `keys`. | `input-capture` |
| I2 | An open capture has added exactly IC4's listeners, in its order, on the right object, with no options argument, before `openCapture` returns, and eight without a key source; `close` removes exactly those, in order, and a second `close` removes nothing. | `input-capture` |
| I3 | Capture touches nothing of the platform outside IC1: a surface, key source, event and target that are recording `Proxy` values log every member touched, and the log equals IC1's list in IC2's and IC6's orders, the target's log empty. | `input-capture` |
| I4 | Every reading of IC5 from a table of events: `button` absent, `null`, `-1` and `2`; `buttons`, `pointerId`, `pointerType`, `key` and `code` absent or of another type; modifiers and `repeat` of every truthiness; a fractional `clientX`. | `input-capture` |
| I5 | Spies log each event's reads and calls in IC6's order; a refused event calls no application function; `hit` is never called for a key fact, nor `focus` for a pointer fact. | `input-capture` |
| I6 | `screen` holds exactly the event's numbers and `at` exactly the conversion's, under `Object.is`, `-0` and a getter-backed point among them; a conversion answering a function, `null`, `NaN` or an infinity refuses the event. | `input-capture` |
| I7 | Every fact, its `at` and `screen`, every reply and every open result are fresh and frozen to their depth, not into `hit` or `focus`, which are the very values answered; keys in their written order; no function needs a receiver. | `input-capture` |
| I8 | `claim` calls `preventDefault` once, at once; `takePointer` calls `setPointerCapture` once with the fact's `pointerId`, answering `false` when it throws and calling nothing when `pointerId` is `null`; both throw after delivery; what a throwing delivery asked is done. | `input-capture` |
| I9 | An exception from each application function propagates out of the listener unchanged, nothing delivered after a throw before `deliver`; a getter or trap throwing while an event or the conversion's answer is read is rethrown as the Errors paragraph's `TypeError`; a delivery that closes the capture, and one that dispatches a nested event, each see IC7's rules. | `input-capture` |
| I10 | In headless Chrome, with trusted input dispatched through the DevTools protocol's `Input` domain on a page whose surface is an SVG element: a left press, moves leaving the surface and a release, the pointer taken on the press, every move and the release delivered; a right press and release, `button` 2; a move with no button, `button` -1 and `buttons` 0; a double click, one `double` after its presses and releases; two touch contacts, two `pointerId` values, `pointerType` `touch`, `button` 0, and a touch cancelled, a `cancel`; a key held to repeat, its `key` and `code`, and a key-up; a claimed key-down seen `defaultPrevented` by a later listener; a `leave` when the pointer leaves; nothing after `close`. | gate |
| I11 | A consumer compiled under the DOM library passes an `SVGSVGElement`, an `HTMLCanvasElement` and a `Window` where IC3 asks, and its `hit` and `focus` types reach `fact.hit` and `fact.focus`. | `input-capture` |
| I12 | The source names no consumer's vocabulary and declares no ambient value; the built files import no package, name no runtime global and no clock, timer or source of chance (`SNAP-GRID.md` section 7.2; `input-binding`'s clock check). | gate |

**Each rule's own tests,** in `test/contract/`, one file per capability: IC2 and IC3 in `declared-capture`'s, with I1, I2 and the declaration's reading order held by a `Proxy` that records each trap; IC4 to IC7 in `pointer-facts`'s and `key-facts`'s, with I3 to I6 and I9; IC8 in `fact-reply`'s, with I8; the Errors and What is returned paragraphs in a file of their own, as both earlier components keep one.\
The fakes are plain objects whose `addEventListener` records each listener, and Node.js's own `EventTarget` for a dispatch that runs every listener; I10 runs a page under Chrome over Node.js's own WebSocket client, so no dependency is added.

**Acceptance for H26.3, draw on `input-capture`:**
1. `input-capture` is released from its repository by its CI, and draw's lockfile pins the release file by its hash.
2. Every site appendix B marks *moves* goes through the component, only `app/src/capture.js` names `@apnex/input-capture`, every site marked *stays* or *unchanged* is unchanged, and every site marked *kept* keeps its behaviour and cites its backlog row.
3. `app/src/capture.js` adds no listener for a pointer, double-click or key event and reads no field of an event -- its one listener left is the B75 menu's -- and Input's entry points take the events they took; a new test in draw's `tests/`, `input-capture-move.test.js`, finds each.
4. Before the old capture is deleted, a test in draw drives it and the adapter with the same fake events -- every event of the gesture corpus and of the input tests -- and finds that each hands Input the same event, field for field and in the same key order, and makes the same `preventDefault` and `setPointerCapture` calls.
5. Draw's full gate passes: the gesture corpus replays byte-identical, the 25 files driving the canvas through the harness pass unchanged, and in real Chrome the browser tests -- the K7 and K8 palette and Escape tests, the run-mode key test, the second-pointer test of B409 (`tests/input-binding-browser.test.js`) -- and the matrix corpus's boards pass; the gesture-sample probe (`tools/probe/gesture-sample.mjs`) finds its eleven real gestures alike before and after.
6. The probe against production, each side on its own dependencies, finds no pixel or style changed, and an independent verifier passes the move.
7. The product page and the lab page load the one release through the import map; the server and the export never load it, since only the pages compose a canvas.

---

## 5. What draw supplies, and what stays draw's

**Draw's adapter is `app/src/capture.js`,** which opens the capture in place of the class it holds today, with this declaration:

| Property | Draw supplies |
|---|---|
| `surface` | the canvas element `composeCanvas` is handed, `#container` |
| `keys` | `host`, the page's `window`, as today |
| `toDrawing` | `(screen) => toCanvas({ clientX: screen.x, clientY: screen.y }, svg)`, `app/src/painter.js:29-32` unchanged, reading the screen transform at each event |
| `hit` | `(target, event) => ({ on, region })`: `on` from `hitWith(picks)` handed `{ target, shiftKey, ctrlKey, altKey, metaKey }`, `app/src/pick.js:53-83` unchanged, and `region` from `regionOf(target, regions)` on a `down` alone (`app/src/capture.js:38-53`) |
| `focus` | `(target) => ({ typing, onControl })`: today's field test and control test (`:32-34`, `:64`, `:70`) |
| `deliver` | the round trip below |

**The round trip,** each step today's:
1. A `leave` calls `input.leave()`, and a `key-down` whose focus is `typing` is dropped, as today's capture drops it.
2. Every other fact becomes draw's input event in today's form, field for field and in today's key order: `type`; `button`, `0` for a key; `key`; `repeat`, `false` for a pointer; the four modifiers; on a pointer fact `at` and `on`; on a `down` `region`; on a `key-down` `onControl`; `claimed` and `capture` `false`.
3. It is handed to the Input method today's capture calls for its type, `over` and `out` to `hover` with `true` or `false`.
4. In a `finally`, `claimed` makes the adapter call `claim()`, and `capture` `takePointer()`, so what Input asked before a throw is done, as today.

So every row, Input, the session and the plugins' rows read and write the event they read and write today, and `trigger` stays a field of draw's own event.\
The B75 context-menu listener stays on the window in the adapter, added right after the capture opens, as today it follows `keyup`; `emitToHost` stays there too.

A drafting prototype -- the component's listeners, facts and reply as section 3 states them, though not every refusal, and the adapter as above, served in place of `app/src/capture.js` by a loader hook -- passes all 504 tests of the 40 test files that drive the canvas or compose it, the gesture corpus's 92 scenarios byte-identical among them, with the harness's methods dispatching to the listeners the component added (`~/taceng/drawv2-eval-runs/h26-readings/ic/drafting/run-draw-tests.sh`); a recording run shows it touching exactly IC1's members and never the target (`platform-members.mjs` there).

**Where it is opened** follows draw's layer rules:
- only the `canvas` part imports `input-capture` (`tools/layers.mjs` `COMPONENTS`, D9), and only `app/src/capture.js`, already a canvas module, names it, which acceptance step 3's test holds;
- `listen()` keeps its place and its order -- the product page after the palette, the lab after its network -- so the palette's Escape still runs first;
- the adapter reads a fact's type as `event.type`, the form `tests/canvas-names-no-plugin.test.js` exempts from its plugin-field count, and names no plugin's kind or selector (`tests/canvas-chrome.test.js:77`);
- G1 holds unchanged: `app/src/input.js` reads no DOM, its entry points taking draw's input events as before.

**The test harness** makes its canvas and window fake event sources: each records the listeners added to it, the canvas gains a `setPointerCapture` that throws, as today's capture swallowed the fake's missing one, and `h.capture` keeps its nine methods, each calling the listener the component added, so the 426 calls in 25 files are unchanged.

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

- **`at` is a frozen record.** It was the conversion's own `DOMPoint` in a browser, holding `z`, `w` and methods; it is a fresh frozen `{ x, y }` of the same numbers now. No code reads more of a position than `x` and `y`, none mutates one (section 2.2), the harness's events always made a plain one, and the prototype replays with the frozen record. The input-capture test's claim that an input event survives JSON unchanged becomes true in a browser too.
- **The application's functions on more events.** The conversion and the hit run on a `leave`, which made no event before, and the focus reading on a key-down typed into a field, which was dropped before any reading; each is a pure reading of the canvas or the target, and changes nothing.
- **The order of reads.** The event's fields are read once each before the conversion, where today's object literal read them as it was built; a browser's event fields are accessors without effects, so the order changes nothing.
- **The claim and the pointer capture.** Done by the reply from the adapter's `finally`, after Input returns, as today's `finally` did; the platform's refusal of `setPointerCapture` is swallowed and answered `false`, as today's `catch` swallowed it.
- **The listeners.** The same events, the same objects, the same order, no options argument, added when `listen()` is called; the menu's listener after `keyup`, as today.
- **A key event's `button` and a pointer event's `repeat`.** `null` in the fact, written `0` and `false` by the adapter, as today's literal wrote them.

### 6.3 Defects the inventory found, and what H26.3 changes

H26.3 is an extraction: it changes nothing any input of draw's pages produces, and keeps every behaviour, defects included.

**Inputs nothing in draw produces, which now behave differently** -- listed so that this section is exhaustive for every input a browser, a test or a composition can produce:
- a pointer event whose `clientX` or `clientY` is not a finite number -- a synthetic `Event` with no coordinates -- is refused and delivers nothing, where today its `at` was whatever a `DOMPoint` made of it;
- a pointer event whose `button` is neither absent, `null` nor a safe integer is refused, where today it was carried to Input;
- a conversion answering no point with finite coordinates refuses the event, where today Input received it and the session threw on a press or a move;
- a key event whose `key` is not a string has `key` `null`, where today it was carried;
- a surface lacking `setPointerCapture`, `addEventListener` or `removeEventListener` is refused when the capture opens, where today each pointer capture's failure was swallowed; draw's canvas holds all three, and the harness's fake gains the first.

**Kept, each registered for its own ruling:**
- one press for every pointer (B409), unchanged: the fact carries `pointerId`, draw's event does not;
- a key released while the page lacks focus makes no key-up, since nothing listens for `blur` (section 2.3): a Shift released after the page lost focus leaves the zone layer shown until the next pointer move recomputes it (`app/src/input.js:994`), and leaves a zone selected that H24.3 drops when Shift comes up (`:1622-1636`); read from the code, kept, and registered with a trigger (section 8).

---

## 7. What this piece needs of the shared parts

`SNAP-GRID.md` section 7 is settled and built twice: the repository, the vocabulary and runtime checks, the gate and its consumer test, the release workflow, how draw pins a release, the import map, the vendor mount and the architecture manifest serve `input-capture` unchanged, and neither earlier component needs a new release.\
Where this piece differs:
- **The repository** is `apnex/input-capture`, its package `@apnex/input-capture`, laid out as 7.1 lays out a component, with `lib` `ES2022` alone and `"types": []`: no DOM library, the platform slice being capture's own types (IC9, D2), so the compiler itself refuses any global of the platform's; and a check of the gate's own refuses an ambient value declaration in `src/` -- `declare const`, `declare function`, `declare global` -- so that refusal cannot be declared away.
- **`package.json` `exports`** has one entry, `.`, so draw's import map gains one line, and `export-map.json` maps `openCapture` to all four capabilities, `{ part: 'input-capture', serves }`, `deferred` empty.
- **The runtime check** is 7.2's unchanged, since capture names none of its globals, and `input-binding`'s clock check (`check-clock-and-chance.mjs`, its D2) is adopted as written.
- **The consumer test's exercise** opens a capture over plain fakes in Node.js, and over an element in the page, where it dispatches a constructed `PointerEvent` and `KeyboardEvent` -- real event objects, whose fields are inherited accessors -- and finds their facts, the page's `setPointerCapture` refusing the synthetic pointer so `takePointer` answers `false`.
- **I10, a browser test,** joins the gate: Chrome is launched as the consumer test launches it, with a debugging port, and driven over the DevTools protocol.
- **The vocabulary check** runs both lists over `src/`, comments included, and a component touching the DOM meets their words in the platform's names: the tester's `keyboard` in `KeyboardEvent` -- capture's own types say "key event" -- and draw's `node` in the DOM's `Node` and in "Node.js", `link` and `anchor` in the `<a>` element, and `layout` in a key layout; no name in section 3 holds one, checked with the check's own match, and no allowance is asked.
- **The built size** is recorded in the component's record at build, as the earlier two recorded theirs.
- **Draw's side:** the dependency line and lockfile (7.5); the import map regenerated and `tests/import-map.test.js:57-60` restated; `COMPONENTS` gaining `@apnex/input-capture` with the `canvas` part alone; `MISSION_KIT` and `ALIGNMENT` restated and the architecture documents regenerated, the target's authored text edited, each with the words appendix B gives (7.7).
- **A deploy in flight** spans three components; the window is the one 7.6 names and B403 holds, unchanged.

---

## 8. Decisions owed

Each is offered with a recommendation; they may be ratified together, or one at a time.\
The ruling that ratifies this piece is written `H26-r` below until it has its number.

| # | Decision | Recommendation, and why |
|---|---|---|
| D1 | The boundary: capture reads an event's data fields and hands its target only to the application's functions; the fact's form (IC5) is capture's contract, which `input-binding`'s D1 reads (`at`, `button`) and the tester will; a fact holds no time, no event and no target, is frozen, and capture computes no number in it | yes: binding's D1 left the fact's shape here, and a fixed, frozen record of plain data is what both later consumers can depend on and record. Weighed against facts that carry the event (a consumer then holds a live platform object and the boundary is gone) and against mutable facts, as draw's events are (a consumer's write would reach every later reader, and the tester's recorded stream would not be a record). A time field is held with binding's timed triggers (B405) |
| D2 | The platform slice: no DOM library -- capture states the members it touches (IC1) as its own structural types; the runtime check stays 7.2's; I3 holds the slice by a recording test; tested over plain-object fakes in Node.js and with trusted input in headless Chrome in the gate (I10) | yes: with no DOM library the compiler refuses every platform global, so 7.2's check needs no new list -- only a check that the source declares no ambient global of its own -- and the same types make Node.js fakes exact. Weighed against the DOM library with a runtime check banning every global `lib.dom.d.ts` declares (a generated list hundreds long, which a free-variable walk must apply without flagging locals), and against the DOM library with 7.2's check as it is (bans `window` and `document` but leaves `DOMPoint`, `navigator`, `fetch` and timers reachable). I11 proves a browser's elements assignable. The cost is a browser test in a component's gate -- Chrome already runs there for the consumer test -- and its time |
| D3 | The application supplies the surface, the key source and four functions: `toDrawing` asked at every pointer event, `hit` and `focus` handed the platform's target and the fact so far, `deliver` handed each fact and its reply | yes: the conversion asked at each event reads the view as it is then, so pan and zoom (H26.6) change draw's conversion -- or the scene's, handed in its place -- and never capture; the hit handed the drawing point as well as the target serves a scene that answers by point (H26.4) as well as today's picks by element. Weighed against capture converting by the element's own screen transform (it would know SVG, fail for a `<canvas>`, and need to know the view) and against the application handing a matrix it updates (a view change the application misses -- a scroll, a resize -- makes every fact wrong until it notices) |
| D4 | The claim and the pointer capture flow back through a reply handed with each fact, acting at once and only during that fact's delivery; `trigger` and every other answer stay the application's own | yes: acting at once keeps today's rule that what Input asked before a throw is done (`app/src/capture.js:99-102`), and keeps facts frozen. Weighed against a returned answer (a delivery that throws returns none, so a claim made before the throw is lost -- a change) and against mutable facts, as today (D1's objection) |
| D5 | Routes: pointer events on the surface, keys on the key source the application chooses, nothing else; which keys a field keeps, and whether focus is on a control, are the application's focus reading; the context menu stays the application's own listener (B75 in draw's adapter) | yes: draw's typing refusal and Tab test read draw's selectors, which a built-in rule would fix for every application; and the menu is suppressed page-wide today, over the palette and the header, beyond any one surface. Weighed against a built-in field rule (policy in the component), against keys from the surface alone (the canvas would need focus, and keys would stop when it lost it -- a change), and against a menu fact now (its consumer, the tester, is not designed); the menu fact is registered for the tester |
| D6 | The wheel and a pinch, which H26-1 names in capture's duty, are named and held for pan and zoom: capture listens for no `wheel` in H26.3, and their facts are added when H26.6 designs pan and zoom, by a minor release | yes: P4 -- their consumer is H26.6, and their shape is its question: whether a trackpad pinch (a `wheel` with `ctrlKey`) and a touch pinch (two pointers) are one fact, whether a wheel's lines and pages are converted, and whether claiming a wheel must be decided before the platform scrolls. Weighed against designing them now (a shape no consumer reads) and against listening now (a wheel listener that never claims only slows scrolling, and one that claims stops the browser zooming the page -- either decided without its consumer) |
| D7 | The fact carries what the platform reports of the input, verbatim, beyond what draw reads: the screen point, `pointerId`, `pointerType`, `buttons` and `code`; `input-binding`'s one press (B406, B409) is unchanged, draw's event carrying none of them | yes, though P4 weighs against it: capture is the only source of each; the tester, a consumer by ruling (H26-1), lights a key by its `code` and a mouse's buttons by `buttons`; B404's screen travel, B406's several pointers and H26.6's touch pinch each start from the screen point or `pointerId`; adding them later changes every fact's form. Weighed against holding them until each consumer asks (five fields no consumer reads now), and against delivering only the primary pointer (it would end B409, but change what a second finger does and remove the pinch's second pointer) |
| D8 | One capture listens to one surface; the palette's tile drag stays draw's, outside capture, and B407 is held again with a new trigger | yes: its click rule is chrome in screen pixels, strict, measured where the release lands, with no `pointercancel` (B407), so moving it onto capture and binding would change what a tile does, while a second capture on the palette, keeping draw's rule, would add a path and change nothing. Weighed against a page-wide capture (one listener for every control, the platform's own boundary between controls rebuilt in the component) |
| D9 | Draw's `canvas` part alone imports it, and `app/src/capture.js` -- draw's adapter -- alone names it; `app/src/pick.js` and `app/src/painter.js` are unchanged | yes: the canvas part holds the adapter, `pick.js` and the composition already, so no edge is added. Weighed against a part of its own for the adapter (it needs `pick.js`, and `compose-canvas.js` needs it, so the two parts would consume each other) and against the `renderer` part, home of `painter.js` (capture draws nothing) |
| D10 | No conformance kit; no clock, no timer, no randomness | yes: nothing in capture is a port another party implements, and a double click is the platform's own event, as binding's D2 has it |
| D11 | `@apnex/input-capture` released as `0.1.0` from `apnex/input-capture`, its one export path `.` | yes: `SNAP-GRID.md` section 7 unchanged; `0.x` until mission-kit admits it |

**Registered when this is ratified,** each with its revival trigger (RU3):
- wheel and pinch facts: when H26.6 designs pan and zoom, or the tester's design asks for the wheel;
- a context-menu fact: when an application other than draw needs the menu suppressed over its surface, or draw's B75 rule is next changed;
- a key-up lost to the page's focus (6.3): when a person reports a key, a Shift layer or a zone left behind by switching away, or capture next adds a listener;
- the palette outside capture (B407, again): when the palette's drag is next changed, or a second application needs input from outside its surface.

---

## 9. Axiom alignment audit (M7)

**Identity.**\
H26.0 part 3 at revision 1, read against `3dcaba9` and mission-kit at `e33c850`, audited in three layers:
- the library: it keeps no state between events but whether it is open, so it is not stateful in T1's sense, and A1 does not bind it; it coordinates no actors and runs no model;
- the release process: unchanged from part 1, built twice;
- the consumer: draw, stateful, multi-agent and autonomous as `MISSION-KIT-ALIGNMENT.md` section 5 reads it, to which the move adds a third installed component and changes no state it holds.

**Verdict.**\
Revision 1 is `pass, with guardrails`, by its author; its standing is to be confirmed by a reading.

| Layer | Axiom | Weight | How the design stands |
|---|---|---|---|
| library | A3 Sovereign Composition | load-bearing | One duty, one boundary crossed both ways (3.1); what an event means, where it lies and what is under it are the application's, injected as functions (D3); capture reaches the platform only through what it is handed (IC1, D2). |
| library | A8 Gated Recursive Integrity | load-bearing | Section 4 holds each rule by a test that can fail, the platform slice by a recording test, and real input in real Chrome in the gate (I10). |
| consumer | A8 Gated Recursive Integrity | load-bearing | The side-by-side test over every event draw's tests make, the gesture corpus, the browser tests, the gesture-sample probe, the production probe and a verifier prove the move; a prototype already replays the corpus through the contract. |
| consumer | A5 Perceptual Parity | supporting | Nothing a person sees changes (6.3); the facts the tester will show are the ones draw's rows read, through one adapter. |
| consumer | A9 Chaos-Validated Deployment | supporting | Nothing new is claimed of a deploy; the in-flight window stays registered (B403). |
| all | A4 Zero-Loss Knowledge | supporting | Rulings recorded in draw and in the component's own record; the readings kept whole outside the repository and dispositioned in section 10. |
| all | A14 Compounding Learning | supporting | What the first two components' readings and builds settled is built in (section 10), so a reading need not find it again. |
| all | A1, A2, A6, A7, A10, A11, A12, A13 | not materially implicated | No trait brings A1, A2, A11 or A12 into force; no seam between agents is designed (A6, A7, A10); A13 is served by section 8's decisions, each with a recommendation. |

**Tensions, and how they resolve.**
- The duty's two directions against A3's law of one: one boundary, crossed by each event and its answer; the reply exists only while its fact is delivered.
- H26-1's wheel and pinch against P4: named in the duty, held for their consumer with a trigger (D6).
- Carrying fields no consumer reads against P4: argued as D7, the director's to weigh.
- A component touching a platform against neutrality: held to a closed slice of members, no global, and no target read (IC1, I3).

**Guardrails for the build.**
- G1: every site of appendix B is dispositioned as its row says (acceptance steps 2 and 3), held by a test in draw.
- G2: capture touches no platform member outside IC1, never reads a target, names no global, declares none and loads no DOM library (I3, I12).
- G3: the vocabulary check runs on `src/` comments included, and draw runs it on what it installs.
- G4: H26.3 changes no behaviour of any input draw's pages produce; the inputs nothing produces are those 6.3 lists.
- G5: only the `canvas` part imports `input-capture`, and only `app/src/capture.js` names it.
- G6: where a point lies and what lies under it reach capture only through the application's functions, so pan and zoom change only those.
- G7: draw's input event as the adapter makes it is today's, field for field and in key order (acceptance step 4).
- G8: I10 passes in the component's gate on every push.

**Closeout hooks.**\
H26.3's verifier re-checks G1 to G8 and acceptance steps 1 to 7; mission-kit admission is asked only after draw runs on the release (C0).

---

## 10. Reviews

H26-3 requires a multi-family reading through context-lab's review panel (M1) before ratification; none has been made of this piece.\
What the first two components' readings and builds found, by kind (`SNAP-GRID.md` sections 10 and 11, `INPUT-BINDING.md` sections 10 and 11, and each component's decision record, D2), and where this revision answers each:

| What the earlier readings and builds found | Where this revision answers it |
|---|---|
| argument forms read two ways: getters, proxies, accessors, present `undefined`, functions as objects | IC2 cites binding's IB2 for the declaration and states the platform's objects read through ordinary access; an object is `typeof` `'object'` |
| when reading stops, and in what order | IC2's order for the declaration; IC6's for every event, refusing before any application function |
| proxies and getters as application code, re-entry, determinism | IC7: each named, capture keeping no state but whether it is open, determinism stated for answers that are alike |
| freezing, ownership, key order, receivers, message prefixes | the Errors and What is returned paragraphs, as binding's build settled them |
| numerical claims not exact | capture computes no number; `at` and `screen` hold exactly what was read (IC5, I6) |
| records and tests missed | appendix B, from a search of the tree: the harness and its 25 files, the tests reading `app/src/capture.js`'s text, the plugins writing `claimed` |
| behaviour changes not listed | 6.3, the inputs nothing produces listed apart; 6.2 for every difference that changes no outcome; a prototype replays draw's tests through the contract |
| draw's layer rules | section 5 and D9: one part, one module, the plugin-field exemption named |
| an export map left open | section 7 states it |
| a listed word in a platform or runtime name | section 7 names `KeyboardEvent`, `Node` and "Node.js" |
| deployment claims beyond evidence | section 7 claims nothing new of a deploy |

---

## Appendix A -- `input-capture`'s vision, the draft put to the director

To be ratified by the director with section 8; `input-capture`'s `VISION.md` is made from it when its repository is.

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

From the inventory of `3dcaba9`, paths as H26.7 left them: product code, and the records that name it.\
*moves* -- to `input-capture`, through the adapter; *stays* -- draw's content or policy, unchanged; *kept* -- behaviour kept exactly, registered (6.3); *plumbing* -- an import, a record or a line that goes or is repointed; *unchanged* -- a site that names what moves, or lies on an input route, and needs no edit.

| Site | Today | H26.3 |
|---|---|---|
| `app/src/capture.js:1-28` | the header | plumbing: restated as draw's adapter over `input-capture` |
| `app/src/capture.js:29-30` | imports | plumbing: `openCapture` from `@apnex/input-capture` added; `pick.js` and `painter.js` kept |
| `app/src/capture.js:55-67` | `inputEvent` | moves: the fact to the component (IC5, IC6); draw's event made from the fact, field for field (section 5) |
| `app/src/capture.js:76-94` | `Capture`'s listeners | moves: to `openCapture` (IC3, IC4); the `contextmenu` listener stays |
| `app/src/capture.js:96-103` | `#round` | moves: the reply (IC8), called from the adapter's `finally` |
| `app/src/capture.js:105-112` | the routes | moves: the adapter's `deliver` routes by fact type; the typing refusal through `focus` |
| `app/src/capture.js:32-34,36-53,64,69-70` | the field and control selectors, `regionOf`, `onControl`, `typing` | stays: in the adapter's `hit` and `focus` |
| `app/src/capture.js:114-121` | the B75 menu | stays (D5) |
| `app/src/capture.js:124-127` | `emitToHost` | stays |
| `app/src/pick.js:32-83,123-125` | `picksOf`, `hitWith`, `regionsOf` | unchanged: `hitWith` handed the target and the modifiers |
| `app/src/painter.js:28-32` | `toCanvas` | unchanged: draw's conversion |
| `app/src/compose-canvas.js:33-34,80-83` | `listen()` | plumbing: opens the adapter; its order and its answer's use unchanged |
| `app/src/main.js:63,93-97` | the window handed in; the palette, then `listen()` | unchanged |
| `lab/src/root.js:75,107,221` | the window; `listen()`; `window.lab.capture` | unchanged |
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
| `package.json`, `package-lock.json` | the dependencies | plumbing: the release file pinned by its hash |
| `app/index.html:8-18`, `lab/index.html:29-39` | the import map | plumbing: regenerated, one entry more |
| `tools/layers.mjs:159-166` | `COMPONENTS` | plumbing: `'@apnex/input-capture': { parts: ['canvas'], by: ['H26-1', 'H26-2', 'H26-r'] }` |
| `tools/layers.mjs:176-194` | `MISSION_KIT_READ`, `MISSION_KIT` | plumbing: `'input-capture': 'proposed in drawv2, released from its own repository, composed (H26-r)'`, the date renewed |
| `tools/layers.mjs:195-211` | `ALIGNMENT.canvas` | plumbing: `to: ['input-binding', 'input-capture']`, waiting `'consumes input-binding through rules (H26-6) and input-capture itself (H26-r); its rows and gesture bodies stay draw\'s (B389)'` |
| `tools/layers.mjs:114-121` | the canvas part's modules | unchanged: `app/src/capture.js` stays in them |
| `tools/import-map.mjs`, `tools/scan-components.mjs`, `server/static.mjs` | the map, the vocabulary scan, the vendor mount | unchanged: they read and serve a third package as they do two |
| `docs/ARCHITECTURE.md` | generated parts and alignment | plumbing: regenerated |
| `docs/ARCHITECTURE-TARGET.md:90,190,326,340` | the justification chain, section 4.2's `canvas` row, section 9.3 | plumbing: the chain cites `H26-r`; the `canvas` row reads "press rows, gestures, keys and the hand, each a part's declaration over shared gestures, the platform's events reaching them through `input-capture` (D1, D2, H26-r)"; section 9.3's first sentence names three components, `input-capture` through the `canvas` part |
| `tests/import-map.test.js:57-60` | the whole import map | plumbing: restated with `input-capture`'s entry |
| `tests/fixtures/client-harness.mjs:42-43,273` | the harness's `Capture` | plumbing: fake event sources and the same nine methods (section 5) |
| `tests/input-capture.test.js` | capture's contract; G1; B268 | moves: the reading of fields to the component's tests; the region, typing, Tab, B75 and B268 tests and G1 stay, through the harness |
| the 25 files calling `h.capture.on...`, `tests/gesture-corpus.test.js`, `tests/fixtures/gesture-corpus.mjs` and its JSON | 426 calls; 92 scenarios | unchanged: replaying byte-identical is acceptance step 5 |
| `tests/canvas-chrome.test.js:77`, `tests/canvas-names-no-plugin.test.js` | the adapter's text | unchanged: it names no plugin's selector, and reads the type as `event.type` |
| `tests/canvas-picks.test.js`, `tests/pipe-select.test.js`, `tests/fixtures/binding-parity.mjs:99` | `hitWith`; a key event as capture made one | unchanged |
| `tests/browser.test.js`, `tests/input-binding-browser.test.js`, `tests/fixtures/matrix-runner.mjs`, `tools/probe/gesture-sample.mjs` | real input in Chrome | unchanged: acceptance step 5 |
| `input-capture-move.test.js`, new in `tests/` | none | plumbing: acceptance steps 3 and 4 |
| `dev/INPUT.md`, `dev/design/input/GESTURE-SYSTEM.md` sections 5.1 and 13 | capture as built at stage 1b | plumbing: kept as written (RU2), each gaining a dated line at H26.3 naming the component |
