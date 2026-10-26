# H26.5 -- the components' next releases, for `input-tester`

The design of record for the changes the four components make so that `input-tester` (`H26-12` as amended, `H26-13` as amended) can be built from them as published, never working around them.\
It answers each of the nineteen gaps the cold-agent experiment logged (B426) and the few this design and its first reading found beside them, with one disposition each: a component's release, the components' documents, the guide to using the four together, the tester's own code, or held with a trigger.\
It builds on the four designs beside it (`SNAP-GRID.md`, `INPUT-BINDING.md`, `INPUT-CAPTURE.md`, `VECTOR-SCENE.md`) and on each component's published contract at `v0.1.0`; it states only what changes, citing each rule it amends by its id.\
The tester's own architecture, which composes these releases, is `ARCHITECTURE-TARGET.md` in `apnex/input-tester`'s `docs` folder (`~/taceng/input-tester/docs/ARCHITECTURE-TARGET.md`); its decisions owed are numbered IT-D1 to IT-D11.

**Standing:** ratified as recommended, 2026-10-24 (`H26-14`), every decision RD1 to RD19 at its recommendation; the four releases built and published 2026-10-24 (section 8); revision 4, drafted 2026-10-24, folding in readings 1 to 3 (section 7); the code read is draw's `19e5dd5` and each component's `v0.1.0`; the experiment read is `~/taceng/drawv2-eval-runs/h26-tester-experiment/` (its `GAPS.md`, kept verbatim beside this design as `TESTER-EXPERIMENT-GAPS.md`, its app and proof); browser behaviour cited as measured was measured in headless Chrome with trusted input over the DevTools protocol, the probes and their outputs kept at `~/taceng/drawv2-eval-runs/h26-tester-design/probes/` (P1 to P13 for revision 1; P14 the rule split in two, P15 the icon request, P16 the zoom control, P17 a drag's `button` and P18 a key with no code, for revision 2; P19 composition and P20 the components loaded with no import map, for revision 3; P21 the rows trusted input reaches, for revision 4; with the member walk, the release cases and the scale's exact check run in `scratch/` beside them); not ratified.

---

## 1. What this decides, and what it does not

It decides:
- one disposition for every gap the experiment logged, G1 to G19, and for each gap found beside them, N1 to N9 (section 2);
- `input-capture` `0.2.0`: the wheel, the context menu and focus loss as facts, each listened for only when a capture lists it, and every fact's time as data (section 3.1);
- `input-binding` `0.2.0`: a gesture committed by the release that ends a press of its button, a move or release of another pointer told apart, the keys held kept by the session, and a press resolved in one call (section 3.2);
- `vector-scene` `0.2.0`: the item under a screen point, answered by the platform's own hit test, so it serves a captured pointer, and what an application may write on the root (section 3.3);
- `snap-grid` `0.1.1`: its documents and its gate, its code unchanged (section 3.4);
- what all four change in their documents, their gates (B424) and their vocabulary lists, and where the guide to using the four together lives (section 3.5);
- whether draw moves onto the releases in H26.5, and what changes in draw when it does (section 4).

It does not decide:
- the tester's own structure, language, build, hosting or browser rule, which are its architecture's (IT-D1 to IT-D11);
- pan and zoom (H26.6): a view the scene holds stays held (B419), and the wheel's facts carry no view;
- a touch screen's two-pointer pinch, a second pointer's press told from the first's (B409's remaining half), a hold or a double click decided by time, each held with its trigger;
- any change to draw's behaviour beyond the four section 4 lists, each ruled with this design (RD14).

---

## 2. The gaps, each with one disposition

*capture*, *binding*, *scene* name a component's `0.2.0` (section 3); *docs* the components' documents (section 3.5); *guide* the guide to using the four together (IT-D6); *tester* the tester's own code; *held* a backlog row with its trigger (RU3).

| Gap | What it was | Disposition |
|---|---|---|
| G1 | the contracts explain their rules by draw's files and draw's design | docs: each rule stated on its own terms, an example where a draw file was cited; one provenance line keeps where the design of record and the rulings are (RD15) |
| G2 | about 1,270 lines of contract, no consumer reference | docs: each `README.md`'s Use section grown into a consumer reference -- every function, every shape a consumer handles, one example (RD16); and the guide |
| G3 | no wheel facts | capture: `wheel` facts, listed in `listen` (IC3, IC4, IC5) |
| G4 | the context menu opens unless the application listens itself | capture: `context-menu` facts, listed in `listen`; a claim prevents the menu (IC4, IC8) |
| G5 | no fact for focus lost; no held keys | capture: `blur` facts from the key source, listed in `listen`; binding: the keys held, kept by the session (IB14, RD9) |
| G6 | a gesture whose last release names another button stays live | binding: a release commits a gesture when it ends a press of the gesture's button (IB11, RD8); B427 |
| G7 | `itemOf` answers nothing while the pointer is taken, and the Edges said otherwise | scene: `itemAt(screen)`, by the platform's own hit test (VS12, RD10); the Edges paragraph corrected |
| G8 | no shipped trusted-input driver; a held button must be named on every move | tester: its own driver; guide: the quirk stated; held: a shared driver, the trigger "a change must be made to more than one copy of the trusted-input harness" (five copies, one per repository) |
| G9 | passing `from` to `becomeGesture` restarts the press, turning a drop into a click | guide: the drag-become sequence, without `from`; docs: the consumer reference states IB10's restart beside `becomeGesture` |
| G10 | every consumer writes the same down-match-`pressMatched` routing | binding: `resolvePress` (IB15, RD19), compared now against draw's routing and the experiment's; the switch over fact types stays each application's wiring, since no component imports another (H26-1) |
| G11 | no hold, no double click decided by time | held: binding's timed triggers, a double click of a button other than the primary among them, the platform's `dblclick` being the primary's, the trigger "an application's row decides by time"; capture's `time` (G13) is their prerequisite, now carried |
| G12 | naming gesture outcomes through the table's opaque facts was a guess | guide: stated as supported -- a fact is any value the application hands (IB1), so a table may name its own outcomes |
| G13 | facts hold no time; no lock state; no `location` | capture: `time`, the event's `timeStamp` as data (IC5); lock state held (RD7); `location` needs no field, `code` naming left and right and the keypad already |
| G14 | what the application may write on the root is unstated | scene: VS13 -- the root is the application's, its `viewBox` among it (RD11) |
| G15 | no scale, no resize signal | guide: the conservative scale, the smallest stretch of the root's transform, from three `toScreen` calls (3.5); a resize the application's own listener; held: a scale the scene answers, with the view (B419) |
| G16 | no "which of my blocks owns this point" | docs: not `snap-grid`'s question -- ownership is the application's data, and the point's item is `vector-scene`'s `itemAt` |
| G17 | no key layout data, no locale labels | tester: its keyboard plans, labels from the Keyboard Map (IT-D2); held: a shared keyboard plan, the trigger "a second application draws a keyboard" |
| G18 | the `README.md` does not name the file an import map maps to | docs: each Install section names it -- `index.js` in the package's `dist` folder, and `snap-grid`'s `conformance.js` beside it |
| G19 | the status line and the gate's mission-kit checkout are noise on a consumer's first screen | docs: the status moved into a Status section near the end; the gate's needs under Test alone |
| N1 | found here: Chrome makes a `wheel` listener on the window, the document or the body passive, so a claim there prevents nothing (measured) | capture: the wheel listener added with `{ passive: false }` (RD2) |
| N2 | found here: a mouse's back button released over a page navigates history unless its `pointerup` is claimed; claiming the `pointerdown` alone does not stop it (measured) | guide and tester: claim the releases of buttons 3 and 4; no component change -- capture's reply already claims an `up` fact (IC8) |
| N3 | found here: under a browser rule with `style-src 'self'`, a `style` attribute written by script is refused, while presentation attributes and the CSS object model are not (measured) | guide: a scene shape states its look by class or presentation attribute under a strict rule, since the scene writes every attribute by `setAttribute` (VS1) |
| N4 | found here: a browser rule cannot stop a page navigating away with data in its address (measured, P9 and P14) | tester: containment of navigation held by its source check and its request monitor (its architecture, GT1) |
| N5 | found here: composition injected over the protocol reached no listener with focus on the body or on a focusable `svg`, while a `textarea` and a `contenteditable` element each received `compositionstart`, `compositionupdate` and `compositionend` with their `data` (measured, P19); what a native input method delivers to a page with nothing editable is not measured | tester: no composition facts, and coverage of typing through an input method claimed only once a native one has been used on the director's Chromebook (IT-D12); held: composition facts, the trigger "an application with an editable key source needs composition as facts, or a person typing through an input method reports what the tester shows" |
| N6 | found here: the experiment proved focus loss with a synthetic `blur`; opening a second tab over the DevTools protocol makes a trusted `blur` and `visibilitychange` (measured) | capture's I10 and the tester's gate use the second tab |
| N7 | found here: draw's capture adapter calls `sink[ROUTE[event.type]]` for every fact (`app/src/capture.js:62`, `:105`), so a fact of a type it has no route for throws | capture: each new family listened for only when listed (RD1), so a `0.1.0` declaration delivers no new type |
| N8 | found by reading 1: capture delivers a key's `code` as `''` when the platform names no physical key (`key` `AudioVolumeUp`, `code` `''`, run through the released capture by reader `o`; a trusted key event dispatched over the protocol with no code arrives so in Chrome, P18), and `null` when it is no string | binding: IB14 answers such a fact untracked rather than refusing it; tester: the key shown as delivered, its identity unreported |
| N9 | found by reading 1: a release of another pointer -- a mouse button pressed beyond the surface, released over it while a touch holds a press -- would commit the touch's gesture under revision 1's rule (o:F4) | binding: a move or release of a pointer other than the press's changes nothing (IB10, IB11, RD18); draw hands its facts' `pointerId` |

---

## 3. The releases

### 3.1 `input-capture` `0.2.0`

**Duty: unchanged.**\
A wheel turn and a context menu are input events on the surface; a `blur` is the key source's own event saying its input has stopped, as a `pointerleave`, already a fact (IC4), says the surface's hover has.\
Capture still decides no meaning, finds nothing under a pointer, converts no coordinate and reads no clock: an event's `timeStamp` is a field the platform delivered, read as data.

**IC3 -- the declaration gains `listen`.**\
Optionally `listen`, an array of distinct strings, each one of `'wheel'`, `'context-menu'` and `'blur'`, `'blur'` requiring `keys`; absent, the capture listens for exactly what `0.1.0` listens for.\
Step 2 reads "an own property other than the seven".\
IC2 rule 2's order becomes: the prototype; the own keys; the descriptors of `surface`, `keys`, `toDrawing`, `hit`, `focus`, `deliver` and `listen` its own keys hold, in that order; the surface's three members; the key source's two; then `listen`'s array, read as IB2 rule 8 reads one -- `Array.isArray`, its prototype, its own keys, its `length`'s descriptor, then each index's descriptor in order -- each element judged as it is read.\
So a member's getter that changes `listen`'s array is seen by the reading, which comes last (o:F12, I13).

| Step | When | Problem, at pointer |
|---|---|---|
| 7 | `listen` an accessor, or not a dense array of IB2's form | `invalid-value` at `/listen`, nothing beneath it read |
| 8 | an element not one of the three names, or equal to an earlier element | `invalid-value` at `/listen/<i>` |
| 9 | an element `'blur'` that step 8 did not refuse, and `keys` not among the declaration's own keys -- step 6's test for `focus` | `invalid-value` at `/listen/<i>` |

So `keys: undefined` and `keys: 5` are refused at `/keys` by step 4 alone, and a second `'blur'` by step 8 alone.

**IC4 -- three listeners more, each only when listed.**\
After the ten listeners IC4 lists, in this table's order whatever order `listen` names them:

| Platform event | Listened on | Fact `type` | Added with |
|---|---|---|---|
| `wheel` | surface | `wheel` | three arguments, the third a fresh frozen `{ passive: false }` made for that call (N1, RD2) |
| `contextmenu` | surface | `context-menu` | two arguments |
| `blur` | key source | `blur` | two arguments |

A `wheel` and a `context-menu` fact are pointer facts; a `blur` fact is of neither family.\
Lifecycle rules 2, 3 and 5 hold for them as written; every removal, on a throw and by `close`, passes two arguments, the name and the listener, `wheel`'s included, since a platform matches a listener for removal by its type, its function and its capture flag alone.\
Capture still listens for nothing else: no `click`, `auxclick`, `pointerenter`, `gotpointercapture`, `lostpointercapture`, `focus`, `visibilitychange`, touch, gesture or composition event.

**IC5 -- five properties more, after `metaKey`.**\
A fact's keys are, in order: `type`, `at`, `screen`, `hit`, `focus`, `button`, `buttons`, `pointerId`, `pointerType`, `key`, `code`, `repeat`, `shiftKey`, `ctrlKey`, `altKey`, `metaKey`, `deltaX`, `deltaY`, `deltaZ`, `deltaMode`, `time`.

| Property | A pointer fact | A key fact | A `blur` fact |
|---|---|---|---|
| `deltaX`, `deltaY`, `deltaZ` | a `wheel` fact: the event's numbers, `-0` kept; otherwise `null` | `null` | `null` |
| `deltaMode` | a `wheel` fact: `0`, `1` or `2` -- pixels, lines, pages -- when the event's value is one, written `v + 0` so `-0` gives `0`, else `null`; otherwise `null` | `null` | `null` |
| `time` | the event's `timeStamp` when a finite number, else `null` | likewise | likewise |

A `blur` fact holds `type` `'blur'`, `time`, every modifier `false`, and every other property `null`; neither `hit` nor `focus` is asked for it.\
The deltas are carried as delivered, never converted: capture computes no number (`INPUT-CAPTURE.md` D1), and a line's or a page's height is no field of the event (RD3).\
A touchpad's pinch arrives as a `wheel` with `ctrlKey` true and fractional deltas, and a mouse wheel turned with Ctrl held as a `wheel` with `ctrlKey` true; capture names neither a pinch, since what the platform delivers does not tell them apart (RD4).\
`time` is the platform's own number, milliseconds from the page's time origin; capture compares and orders nothing by it.\
The sentence "A fact holds no time" becomes "A fact holds no clock reading, only the event's own `timeStamp`".

**IC6 -- reading the new fields.**
- A pointer event, after the modifiers: for a `wheel` event `deltaX`, refusing the event unless a finite number, then `deltaY` and `deltaZ` likewise, each judged as read, then `deltaMode`, never refusing; then, for every pointer event, `timeStamp`; then `target` and `preventDefault`, as before.
- A key event: `timeStamp` after the modifiers, then `target` and `preventDefault`.
- A `blur` event: `timeStamp`, then `preventDefault`, refusing it unless a function; no `target`, which nothing would be handed.
- A `timeStamp` that is no finite number gives `time` `null`; a getter that throws refuses the event, as every read does (IC2).
- Step 4's fact, handed to `hit` or `focus`, holds every property of the fact delivered, the five new ones among them, `hit` and `focus` `null`.

**IC1 -- the slice, widened.**\
Of a `wheel` event, also `deltaX`, `deltaY`, `deltaZ` and `deltaMode`; of every event, `timeStamp`; and the surface's `addEventListener` is called with a third argument for `wheel` alone.\
It still reads no target's members and names no global, so a `visibilitychange`, fired at the document, is not listened for: a key source's `blur` precedes it when the page's tab is left (measured, with the window and with a focused element as key source); minimising a window or locking the screen is not measured.

**IC8 -- the claim, on the new facts.**\
Claiming a `wheel` fact prevents its scroll and a touchpad pinch's zoom (P16: a synthesized pinch over an unclaimed surface took `visualViewport.scale` from 1 to 2, over a claimed one left it 1); Chrome's page zoom on Ctrl and a mouse wheel does not happen in headless Chrome at all (P16), so its prevention is not measured; claiming a `context-menu` fact prevents the menu (measured in headless Chrome on Linux, which delivers `contextmenu` as a `PointerEvent` with a `pointerId`, after the `pointerdown` and before the `pointerup`; on other systems the menu's event may follow the release, not measured); claiming a `blur` fact calls `preventDefault`, which changes nothing, the event not being cancelable.

**IC9 -- types and exports.**\
Every fact type gains `time: number | null`; the package exports also `WheelFact`, `ContextMenuFact`, `BlurFact` and `ListenName`:

| Type | `type` | The deltas | `deltaMode` |
|---|---|---|---|
| `PointerFact<Hit>`, its eight types unchanged | `PointerFactType` | `null` | `null` |
| `WheelFact<Hit>` | `'wheel'` | `number` | `0 \| 1 \| 2 \| null` |
| `ContextMenuFact<Hit>` | `'context-menu'` | `null` | `null` |
| `KeyFact<Focus>` | `KeyFactType` | `null` | `null` |
| `BlurFact` | `'blur'` | `null` | `null` |

`CaptureFact`, `openCapture` and the declaration types gain a third type parameter, `Listen extends ListenName`, defaulting to `never` and inferred from `listen`'s elements; `CaptureFact` adds `WheelFact` and `ContextMenuFact` for each listed, and `BlurFact` for `'blur'`; `hit`'s fact parameter is `PointerFact<null>` and each listed pointer-family type with its `Hit` `null`.\
So a delivery whose declaration lists no `'wheel'` and compares `fact.type` with `'wheel'` fails to compile.\
The module still exports `openCapture` alone; its export map adds a capability row, `focus-loss-facts` -- the key source's focus loss as one fact (IC4, IC5) -- which `openCapture` serves, the wheel and the context menu widening `pointer-facts`; the contract-coverage test holds the new row to its contract test.

**Fit criteria.**\
The rows "the wheel or a pinch as facts" and "the context menu suppressed" now read: listen for them (`listen`); a new row: "a touchpad's pinch told from Ctrl and the wheel -- not a reader of hardware: the platform delivers both alike"; "composition and lock state -- not yet" (N5, RD7).

**Edges.**\
Consumed by draw (H26.3) and `input-tester`; the tester uses every family, `time` and the deltas; its pinch is a `wheel` fact with `ctrlKey`.

| # | Invariant | Held by |
|---|---|---|
| I13 | `listen` judged as IC3's steps 7 to 9 say, from a table of cases: absent; empty; each name; an unknown name; a duplicate; a duplicate `'blur'` without `keys`; an accessor; a sparse array; another realm's array; `'blur'` with `keys` absent, `undefined` and `5`; `focus` without `keys` beside it; a surface member's getter appending to `listen`, seen; the reads in IC2 rule 2's order, held by recording proxies. | input-capture |
| I14 | With `listen` absent, exactly I2's listeners, arguments and calls; with the names listed in every order, the listeners added after IC4's in the table's order, `wheel`'s with a fresh frozen `{ passive: false }` as third argument and the others with two; a throw at each new `addEventListener` takes back every listener with two arguments; `close` removes all in reverse with two. | input-capture |
| I15 | A `wheel` event's fact holds its deltas under `Object.is`, `-0` among them, `deltaMode` `0`, `1`, `2` and `-0` giving `0`, `1`, `2`, `0` and `null` for any other value, `ctrlKey` as given; a non-finite delta refuses the event with no later field read; the fact's keys in IC5's order. | input-capture |
| I16 | Every fact's `time` is its event's `timeStamp` under `Object.is` when a finite number, and `null` for `NaN`, an infinity, a string or an absent field; read in IC6's order, a throwing getter refusing the event; step 4's fact holds the new properties. | input-capture |
| I17 | A `context-menu` fact is a pointer fact; a `blur` fact holds what IC5 gives it, its event's `target` never read; `claim` on each calls `preventDefault` once; `hit` and `focus` are never asked for a `blur`. | input-capture |
| I18 | Beside `0.1.0`: `0.1.0`'s contract tables run against both releases give the same listeners, calls, reads and facts' first sixteen properties, but for the changes the closing paragraph lists. | input-capture |
| I10 | Extended, in headless Chrome: a claimed `wheel` over the surface of a scrollable page leaves it unscrolled; a pinch synthesized by `Input.synthesizePinchGesture` with `gestureSourceType` `mouse` arrives as `wheel` facts with `ctrlKey` true, and leaves `visualViewport.scale` 1 when claimed and makes it 2 when not, the positive control; a right press's `context-menu` fact, claimed, is seen `defaultPrevented` by a later listener; a second tab opened over the protocol makes one `blur` fact on a window key source; `time` never decreases across the run. | gate |

**Vocabulary.**\
The new words -- wheel, delta, menu, blur, time, listen, loss -- are in neither list (`consumer-vocabulary.json`, the same in all four repositories), and the check passes as written.

**What changes beside `0.1.0`.**
- A declaration with an own `listen` property, which `0.1.0` refused as `unknown-property`, is judged.
- Every event's `timeStamp` is read, so an event whose `timeStamp` getter throws, which `0.1.0` delivered, is refused (o:F13).
- Every fact gains five properties after `metaKey`; draw reads facts field by field (`app/src/capture.js:65-76`).
- Nothing else: with `listen` absent no listener is added and no new type delivered, so draw's adapter (N7) is untouched (I18).

### 3.2 `input-binding` `0.2.0`

**Duty: unchanged.**\
A gesture's commit is the meaning of a release, so the release rule is binding's already (IB11); the keys held are the context a row needs when its meaning depends on another key held, which B406 registered as binding's own limit, and which the tester's roll-over row now meets; and the order in which a press passes through the session -- down, match, cancel, start -- is the session's own protocol, which every consumer has so far written out by hand (G10).\
The session is "the state of one input surface's presses and gestures"; it becomes "of one input surface's presses, gestures and held keys".\
It still holds no application's situation, draws nothing, and reads no clock.

**IB1, IB2 -- binding reads two properties more, each by descriptor.**\
`code`, of a fact handed to `keyDown` or `keyUp`, a string or `null`; and `pointerId`, of a fact handed to a pointer operation, read by `Reflect.getOwnPropertyDescriptor` alone -- no own-keys read -- so a descriptor `undefined` is absent and means `null`, and otherwise it must be a data property holding `null` or a safe integer.\
A malformed fact throws the function's own `TypeError`; every other property of any fact is still never read.\
IB2's table gains or changes these rows, held by its recording test:

| Function | What it reads, in order |
|---|---|
| `pointerDown` | the fact; its `at`; that point's `x` and `y`; the fact's `button`; its `pointerId` |
| `pointerMove` | the fact; its `at`; that point's `x` and `y`; its `pointerId` |
| `pointerUp` | the fact; its `button`; its `pointerId` |
| `resolvePress` | the fact, as `pointerDown`; then `handlers` as `startGesture` reads its argument -- prototype, own keys, then the descriptors of `match` and `cancelled` its own keys hold; later, `match`'s answer as `pressMatched` reads a match -- prototype, `id`, `opens` -- `undefined` among the answers refused |
| `keyDown`, `keyUp` | the fact; its `code` |
| `keysLost` | nothing |

**IB10 -- the press records its button and its pointer.**\
A press is `{ at, beyond, unmatched, button, pointer }`: `button` the `pointerDown` fact's, written `button + 0`, and `pointer` its `pointerId`, written likewise, or `null`; a restart from `from` keeps both.\
IB12's identity compares both with `===`, so a `pointerDown` that differs from the press in its button or its pointer alone leaves a new press and state, where `0.1.0` left the very same (its `live-gesture.test.js` asserting "the button is not part of the press" is restated).\
The component's decision record's build choice that the press holds no button (`input-binding` D2, its Forms) is superseded by this rule.

**IB11 -- the release rule, and another pointer.**\
With `g` the live gesture's declared button and `p` the press, the `pointerMove` and `pointerUp` rows become:

| Operation | When | Phase due, and what changes |
|---|---|---|
| `pointerMove(fact)` or `pointerUp(fact)` | `p !== null` and the fact's `pointerId` `!== p.pointer` | none: nothing changes; the outcome's `otherPointer` `true`, `crossed` `false`, `trigger` `null` |
| `pointerUp(fact)` | otherwise, a gesture is live, and `g === null`, or `g === fact.button`, or `p !== null && g === p.button` | `commit`: the gesture ends; the press ends with its trigger |
| `pointerUp(fact)` | otherwise | none: the press ends with its trigger, and a live gesture stays live |

The `pointerMove` rows of `0.1.0` hold for a move of the press's own pointer, or with no press, `otherPointer` `false`.\
A platform delivers a chord's presses and releases after the first as moves, so the release that ends a press names the last button released, which need not be the button that began it (measured in Chrome: `pointerdown` 0, `pointermove` 2, `pointermove` 0, `pointerup` 2).\
A second pointer's press still replaces the first's (B409): what changes is that the first pointer's later moves and release no longer move, end or commit the press the second began.\
The cases the table decides, with gestures `g0` and `g3` declaring buttons 0 and 3 and `gnull` declaring `null`, facts carrying no `pointerId` but in the last row (the `0.1.0` column run on the released code):

| Sequence | `0.1.0` | `0.2.0` |
|---|---|---|
| `down` 0 opening `g0`; `up` 0 | commit | commit |
| `down` 0 opening `g0`; the right button pressed and the left released, as moves; `up` 2 | none, `g0` left live (B427) | commit: `g0` is the press's button |
| `down` 0 opening `g0`; the right button pressed and released, as moves; `up` 0 | commit | commit |
| `down` 3 opening `g3`; the left button pressed and button 3 released, as moves; `up` 0 | none, `g3` left live | commit |
| `g0` started with no press; `down` 3, not taken; `up` 0 | commit: the release names 0 | commit |
| `g0` started with no press; `down` 3; `up` 3 | none, `g0` live | none, `g0` live |
| `g0` started with no press; `down` 0, taken; `up` 0 | commit | commit |
| `gnull` started; `down` 2; `up` 2 | commit | commit |
| `down` 0 of pointer 7 opening `g0`; `up` 2 of pointer 1 | none, the press ended | none, nothing changed, `otherPointer` `true` |

**IB14 -- held keys.**\
Three operations take what the key source delivered, and `session.state` gains `keys`, a frozen array of the codes held, in the order first pressed:

| Operation | What changes, and the outcome |
|---|---|
| `keyDown(fact)` | a non-empty `code` not held is appended; the outcome `{ state, tracked, held }`: `tracked` false when `code` is `''` or `null`, the state then unchanged and `held` `null`; otherwise `held` true when the code was held already -- a repeat, or a press whose release was not seen |
| `keyUp(fact)` | a non-empty `code` held is removed; the outcome `{ state, tracked, held }`: `tracked` as for `keyDown`; otherwise `held` false when the code was not held -- a key pressed while the page lacked focus |
| `keysLost()` | every code removed; the outcome `{ state, released }`, `released` the array `state.keys` held before the call, the very same value, so the empty array itself when nothing was held |

So a key whose physical identity the platform does not report is neither refused nor given one: `key` is never read in its place.\
The keys held never change the press or the gesture, and no key operation makes a phase due.\
IB12's identity holds: `keys` is the very same array when no code changed, and the state the very same value when nothing did.\
`session.state` is `{ press, gesture, keys }`, in that order.

**IB15 -- a press resolved in one call.**\
`session.resolvePress(fact, handlers)`, `handlers` holding `match`, a function, and optionally `cancelled`, a function; any other property is malformed.\
*The press* is the one step 2 makes, until a `pointerDown`, `pointerUp`, `pointerLost` or `resolvePress` replaces or ends it; a move or a restart keeps it.
1. It reads its arguments (IB2); a malformed one throws the function's own `TypeError`, the state untouched.
2. It makes `pointerDown`'s transition; when the press is taken, it answers at once, `match` never called.
3. It calls `match` with no receiver and no argument, and reads its answer once: `null` ends the call, the press left unmatched, as a press that matched no row is; any other answer is read as a match, a malformed one, `undefined` among them, throwing the function's own `TypeError` with the `pointerDown` transition standing; the `id` and `opens` read decide every later transition, whatever a callback later does to the match.
4. It makes `pressMatched`'s transition when the press is still unmatched, and otherwise ends the call.
5. When that answers `cancel`, it calls `cancelled`, if given, with that outcome and no receiver, then makes `pressMatched`'s transition once more when the press is still unmatched and no gesture is live, and otherwise ends the call.
6. It answers a fresh frozen `{ state, taken, match, cancelled, phase, gesture }`: `taken` as `pointerDown` answered; `match` the value `match` answered, or `null`; `cancelled` step 5's `cancel` outcome, or `null`; `phase` and `gesture` the press's resolution -- `start` and the gesture started, or `null` -- never `cancel`, which `cancelled` alone reports.

| While | A callback | Then |
|---|---|---|
| `match` runs | calls nothing of the session | step 4 |
| `match` runs | ends, replaces or matches the press | no transition; `phase` `null` |
| `match` runs | starts a gesture, the press still unmatched | step 4, whose `cancel` ends that gesture and calls `cancelled` |
| `cancelled` runs | calls nothing of the session | the second transition: `start` or `null` |
| `cancelled` runs | ends, replaces or matches the press, or starts a gesture | no second transition; `phase` `null` |
| either runs | throws | the error propagates; the transitions made stand |

So a call cancels at most one gesture, and only one `cancelled` saw.\
The two traps this order holds -- `pressMatched` throws on a taken press, and a cancel without a second call loses the start -- are the session's to hold once, and a consumer's code runs where its policy sits: between the press and the match, and inside the cancel.\
IB12's sentence "A session calls no application code but a point's getters and a `Proxy`'s traps" gains "and `resolvePress`'s `match` and `cancelled`, each after the transition before it, the state read again after each returns", the exception recorded in the decision record beside the table's predicates (IB6).

**IB12, IB13 -- the session's form.**\
A session is a frozen object of exactly `declaration`, `state`, `pointerDown`, `pressMatched`, `pointerMove`, `pointerUp`, `pointerLost`, `startGesture`, `becomeGesture`, `cancelGesture`, `resolvePress`, `keyDown`, `keyUp` and `keysLost`, in that order; `pointerMove`'s and `pointerUp`'s outcomes end with `otherPointer`, and `pointerUp`'s `trigger` may be `null` (IB11).\
The contract gains two capability rows, `held-keys` (IB14, stateful) and `press-resolution` (IB15), which `openGestureSession` serves in the export map, each held to its own contract test by the contract-coverage test; the declarations export `KeyOutcome`, `KeysLostOutcome`, `ResolvePressHandlers` and `ResolvePressOutcome`.

**Fit criteria.**\
"Several pointers told apart, or held keys tracked: not yet" becomes "a second pointer's press told apart: not yet; another pointer's moves and release: told apart by `pointerId` (IB11); held keys: the session keeps them (IB14)"; a new row: "a press resolved in one call -- `resolvePress`".

**Edges.**\
Consumed by draw (H26.2) and `input-tester`, which uses IB14 to light keys and to match its roll-over row, IB15 for every mouse press, and IB11's rule for every gesture.

| # | Invariant | Held by |
|---|---|---|
| I15 | IB11's decided cases, and generated sequences of a gesture declaring g -- opened by a press of buttons 0 to 4 or with no press, the press taken or not, g `null` among them -- in which other buttons' presses and releases arrive as `pointerMove` in both orders and the closing `pointerUp` names any button: commit exactly when g is `null`, the release names g, or the press began with g; `press.button` holds no `-0` and survives restarts. | input-binding |
| I16 | Over generated sequences of `keyDown`, `keyUp` and `keysLost`, codes `''` and `null` among them, `keys` equals a model written apart, in order; repeats change nothing; untracked facts change nothing; outcomes, their key order and `released`'s identity as IB14 gives; no key operation changes the press or the gesture or makes a phase due; a code of another type and an accessor `code` are refused before the state is read. | input-binding |
| I17 | `resolvePress` against the five calls written out by hand, over generated sequences in which neither callback calls the session or changes the match it answered: the same states and outcomes; each row of IB15's table driven by recording callbacks, a match changed after `match` returns among them, answered as the table says; `match` never called on a taken press; `cancelled` seeing no live gesture. | input-binding |
| I18 | Over generated sequences of two pointers: a move or release of the pointer that is not the press's changes nothing and answers `otherPointer` `true`; facts with no `pointerId` answer as facts whose pointers are equal. | input-binding |
| I19 | Beside `0.1.0`: the I13 corpus and I10's generator, their facts carrying no `pointerId`, give `0.1.0`'s outcomes but for the chord sequences and the changes the closing paragraph lists, the press records gaining `button` and `pointer` and the state `keys`. | input-binding |

**Vocabulary.**\
The new words -- keys, held, code, released, tracked, resolve -- are in neither list; no new name needs `keyboard`, which the tester's list refuses.

**What changes beside `0.1.0`.**
- A pointer fact whose `pointerId` is an accessor, or neither `null` nor a safe integer, is refused, where `0.1.0` passed it unread.
- The press gains `button` and `pointer`, the state `keys`, the session four functions after `cancelGesture`, and the move's and release's outcomes `otherPointer`.
- A chord's release commits its gesture: the second and fourth of IB11's cases (B427).
- A move or release of another pointer while a press is held changes nothing (IB11's last case).
- Draw reads `state.press?.beyond` (`app/src/input.js:1033`) and the gesture, and its parity fixture (`tests/fixtures/binding-parity.mjs`) compares the old press's answers with the session's, so the chord and two-pointer sequences are listed apart there (read, not run).

### 3.3 `vector-scene` `0.2.0`

**Duty: unchanged.**\
"Say which shape a platform element belongs to and where a point lies" already holds the item under a point, which `H26-1` named ("the shape under a point reported"); `itemAt` answers it by the platform's own hit test, never by geometry, as D4 ruled.

**VS1, VS2 -- the slice, widened by one member.**\
Of the root's document, also `elementsFromPoint`, read as the scene opens, after `createElementNS` and before the root's `appendChild` and `getScreenCTM`, through ordinary property access.\
A getter that throws refuses the root, `invalid-value` at `/root`, and the reading of the root stops there, as for every member (VS2 rule 2); a value that is not a function, `undefined` among them, is kept as none, the root opens, and `itemAt` refuses.\
The function read is the one called, with the document as receiver and the point's `x` and `y`; of its answer the scene reads only what VS12 says, and nothing of any element but its identity.

**VS12 -- the shape at a point.**\
`itemAt(screen)` answers a frozen `{ layer, key, path }`, as `itemOf` answers it, for the first element of the platform's hit stack at the screen point that the scene made for a shape of an item it holds, and `null` when there is none:
1. the point is read as VS2 rule 6 says, and refused unless its `x` and `y` are finite numbers, as a conversion reads one (VS10);
2. the scene's state is judged before anything of the scene is read -- writing, closed and failed refused as every function refuses them; then a scene with no root, or whose document held no `elementsFromPoint`, refused with Errors' `Error`;
3. the document's `elementsFromPoint` is called; an answer that `Array.isArray` does not accept is refused with Errors' `Error`;
4. the answer's `length` is read once, by ordinary access, and refused unless a safe non-negative integer; then indices from 0 below it are read in order, by ordinary access, stopping at the first element the scene made for a shape of an item it still holds, as `itemOf` recognises one; every other element -- one made for an item since removed, the root, a layer's element, a foreign layer's content, anything else on the page -- is passed over;
5. the state is judged again, a scene closed or failed meanwhile refused with Errors' `Error`, and the item answered.

An error the platform or a getter throws propagates, and leaves the scene open.\
So `itemAt` names the first owned item anywhere in the hit stack, looking through what the scene did not make; it is not the topmost hit, and under an opaque element the scene did not make it answers the item beneath, where `itemOf` of the event's target answers `null` (o:F10).\
The screen point is in the units `input-capture`'s `screen` holds and `toScreen` answers, the viewport's.\
The platform leaves out of its answer every element whose `pointer-events` is `none`, so a layer an application declares with that attribute is looked through (measured in Chrome, under a captured pointer).\
Unlike `itemOf`, whose argument is the event's target, it answers under a captured pointer, whose every event targets the element holding the capture (measured).

**VS13 -- what the application may write on the root.**\
The root and its attributes are the application's: it may set the root's `viewBox`, its size, its `preserveAspectRatio`, its classes and its styles, before or after the scene opens; the scene never reads or writes them, and each conversion and `itemAt` follows the root as it stands when asked (VS10).\
A layer's element stays the scene's alone (VS4), so a layer's attributes are set only by its declaration.\
What `H26-1` names the viewport -- a view the scene holds, panned and zoomed, and a layer told the visible area and scale -- stays held for pan and zoom (B419); an application's own `viewBox` is no view of the scene's.

**The scene's form.**\
A scene is a frozen object of exactly `layers`, `put`, `remove`, `items`, `itemOf`, `itemAt`, `layerElement`, `toDrawing`, `toScreen` and `close`, in that order -- nine functions where `0.1.0` held eight; the export map adds a capability row, `shape-at-point` (VS12), which `openScene` serves.

**Fit criteria.**\
"A shape found by geometry, with no platform" stays (B420's other half); a new row: "what lies under a captured pointer -- `itemAt`".

**Edges.**\
The sentence the experiment tripped on becomes: "The tester asks `itemOf` with `input-capture`'s target and, when that answers `null`, `itemAt` with the fact's `screen`, so a captured pointer, whose target is the capturing element, is answered by point."

| # | Invariant | Held by |
|---|---|---|
| I13 | With a recording document, `elementsFromPoint` read once as the scene opens, in VS2 rule 2's order, and called once per `itemAt` with the document as receiver and the point; a throwing getter refusing `/root`; a non-function opening; the first element the scene made for an item it still holds answering, with its path, nested shapes among them, an element of a removed item passed over; `null` when none is; refused with no root, with no member, closed or failed, with a malformed point, with an answer not an array and with a `length` not a safe non-negative integer; `length` read once, so an answer whose index getter appends an owned element answers `null`; a getter that throws, propagated with the scene open; a getter that closes the scene, refused. | vector-scene |
| I14 | In headless Chrome: with the pointer taken on a press, `itemAt` of each move's screen point answers the item under it while the target stays the capturing element; an item under a layer declared `pointer-events` `none` is answered through it; with no pointer taken and nothing the scene did not make above the items, `itemAt(screen)` equals `itemOf(target)` for trusted presses over a grid of points; under an opaque foreign element above an item, `itemAt` answers the item and `itemOf` `null`; a `viewBox` the application sets after opening is followed by `toDrawing`, `toScreen` and `itemAt`. | gate |
| I15 | Beside `0.1.0`: `0.1.0`'s contract tables give the same answers and calls but for the changes the closing paragraph lists. | vector-scene |

**Vocabulary.**\
The new name, `itemAt`, splits into words in neither list.

**What changes beside `0.1.0`.**
- A root whose document's `elementsFromPoint` getter throws, which `0.1.0` opened, is refused (o:F13).
- The scene gains `itemAt` after `itemOf`, which only a consumer listing a scene's keys would see.
- Draw calls no `itemAt` until H26.8, its picks reading targets by selector (D4), and its test harness's fake document, which has no `elementsFromPoint`, opens as before.

### 3.4 `snap-grid` `0.1.1`

The tester places every key and mouse button by `span` (SG8) on one square grid (SG1), as `0.1.0` answers it; ownership of a point is the application's data and `vector-scene`'s `itemAt` (G16), and the tester draws no grid, so `inView`'s scale (G15) asks nothing of it.\
Its package ships `README.md`, `CONTRACT.md` and `VISION.md` beside `dist` (`package.json` `files`), so section 3.5's documents reach a consumer only in a release (o:F17): a patch release, `0.1.1`, carries them, its built files byte-identical to `0.1.0`'s, checked by the release run, with B424's gate on its main branch (RD12).

### 3.5 What all four share

**Contracts freed of draw (G1).**\
Each `CONTRACT.md` states every rule on its own terms -- IB2 rule 5's `DOMPoint` explained by the platform's own getters, SG9 without the zone wrap, the invariants that name draw's corpus naming it as a test's provenance in the decision record instead -- and its Reference keeps one provenance line: the design of record and the rulings are kept in draw's records, `apnex/drawv2`.

**A consumer reference (G2, G9, G18, G19).**\
Each `README.md`: Install names the file each export maps to (`index.js` in the package's `dist` folder, and `snap-grid`'s `conformance.js` beside it, as each `package.json` `exports` gives); Use becomes the consumer reference, every function and every shape a consumer handles on one page, with the traps the experiment met stated where they bite, IB10's restart beside `becomeGesture` among them; the status line moves into a Status section near the end, and the gate's mission-kit checkout under Test alone; Documents links the guide.

**The guide (IT-D6).**\
One page, `GUIDE.md` in `apnex/input-tester`'s `docs` folder, the tester's code its worked example:
- opening the four together -- by bare names through an import map, or, as the tester does under its strict browser rule, each part's release files vendored and imported by relative path -- and the switch over the fact families, the application's own wiring;
- the `hit` function, `itemOf(target) ?? itemAt(screen)`, with what `itemAt` looks through;
- a press through `resolvePress`, and a move, a release and a lost pointer one call each; the drag-become without `from`;
- a chorded press or release told by a move whose `button` is 0 or more, Pointer Events giving a move with no button change `button` -1 (P17, measured under the trusted-input driver too);
- claiming wheels, the context menu and the releases of buttons 3 and 4 (N2); a table naming its own outcomes (G12);
- focus lost through `blur` and `keysLost`, a key whose `code` is empty answered untracked (N8);
- the conservative scale from three `toScreen` calls: the images of the origin and of the two unit points give the linear part's columns `(a, b)` and `(c, d)`, divided by their largest magnitude `m`; the largest singular value is `sqrt(e*e + h*h) + sqrt(f*f + g*g)`, `e` and `f` half of `a + d` and `a - d`, `g` and `h` half of `b + c` and `b - c`, a sum that cancels nothing; the determinant `a*d - b*c` is lowered by `8u` times `|a*d| + |b*c|`, `u` being 2^-53, for its rounding; and the scale is `m` times the lowered determinant over the largest value, lowered by `32u` -- a lowered determinant of 0 or less, or a scale 0, subnormal or not finite, meaning no grid can be spaced, so none is drawn; checked in exact rational arithmetic to be a lower bound over 200,000 transforms (`scratch/scale/`), each recipe an executable check of the guide with the counterexamples that defeat simpler ones: an x scale of 2 and a y scale of 1, where one axis's sample overstates; the shear `x' = x + y`, `y' = 0.01 y`, where both axes measure at least 1 yet the scale is about 0.007; and `diag(1, 1e-8)` and `diag(1, 1e-9)`, where the textbook `sqrt((S - sqrt(S*S - 4*D*D)) / 2)` cancels to about `1.05e-8` and to 0 (o:F20, o:F14, o:F3); a resize the application's own listener (G15);
- looks by class under a strict browser rule (N3); fakes for tests in Node.js; and trusted input over the DevTools protocol, a held button named on every move (G8).

**The gates (B424).**\
Each component takes `vector-scene`'s runtime check and its release workflow's retried lookup of the draft, each check stated for the component it guards (measured by running `vector-scene`'s check over each `v0.1.0` build):

| Component | Built-ins its runtime check allows | Its platform-member pass | Clock and chance |
|---|---|---|---|
| `vector-scene` | its thirteen, unchanged | VS1's slice, `elementsFromPoint` added to the document's row, with a control -- a built file naming it passes -- and a falsifier -- one naming `elementFromPoint` fails -- in its `gate-checks.test.js` | held already |
| `input-capture` | the same thirteen, its build naming no other | against the members of `EventTarget`, `Element`, `Window`, `Event`, `UIEvent`, `MouseEvent`, `PointerEvent`, `WheelEvent`, `KeyboardEvent` and `FocusEvent` and what they extend, exactly these allowed: IC1's eighteen, the five `0.2.0` reads, the conversion's answer's `x` and `y`, and its own names `focus`, `name` and `length` -- the walk run on the `v0.1.0` build finding those three and nothing else (a:F2); falsifiers reading an event's `composedPath` or a target's `tagName` fail | held already; also its source check's triple-slash fix and its Chrome teardown's removal of Chrome's temporary directory |
| `input-binding` | the thirteen and `ArrayBuffer`, `BigInt` and `DataView`, which `travel-beyond.ts` uses for IB10's exact fallback | none: it is handed no platform object, and its own names `id` and `exponent` are platform members' names | the forms `input-capture` refuses taken -- `Intl`, `Temporal`, `WeakRef`, `FinalizationRegistry`, `eval`, `Function`, a call through `constructor` (B414) |
| `snap-grid` | the thirteen and `RangeError` | none: no platform object reaches it, and its names `open`, `points`, `r` and `scale` are platform members' names | the same forms, its first such check (B414) |

**The vocabulary lists.**\
Each repository's list named `gesture-tester` is renamed `input-tester`, its words `keyboard` and `keycap` kept, and joined by the tester's own nouns once its source exists.

---

## 4. What draw does with each release

Draw moves onto `input-capture` `0.2.0`, `input-binding` `0.2.0` and `vector-scene` `0.2.0` in H26.5, each after its release and lab first, as H26.1 to H26.4 moved it (RD14); `snap-grid` `0.1.1` changes no built file, so draw stays at `0.1.0`.

**Common to each move.**\
The dependency line and the lockfile; the import map regenerated, and the tests that list the installed components restated (`tests/import-map.test.js`, `tests/probe-sides.test.js`, `tests/import-map-browser.test.js`); the gesture corpus replayed byte-identical but for the cases each move lists, each with both answers; the pixel probe against production finding nothing; an independent verifier passing the move.

**`input-capture` `0.2.0`: B413 fixed.**\
Draw lists `'blur'` alone; `ROUTE` (`app/src/capture.js:62`) gains `blur: 'blur'`, and `inputEventOf` (`:65-76`) carries a pointer fact's `pointerId` for binding (RD18).\
Input gains `blur(evt)` and one field, `shiftOwed`, set whenever delivered input can have activated Shift-dependent state and cleared only when `onShiftUp` runs: by `onShiftDown` (`app/src/input.js:1404`), and by every pointer or key event Input is handed whose `shiftKey` is true, since every place that state is activated reads that `shiftKey` -- the press showing the zone grid and picking a Shift-only kind (`:662`, `:142`), the move showing it and locking a move's or clone's axis (`:997`, `:93`, `:107`, `:1040`), the release and the cancel showing it again (`:1113`, `:1308`), and a hover reaching a zone only while that grid is shown (o:F7, o:F2).
1. When `shiftOwed`, `onShiftUp()` runs whole, as Shift's release would: the zone grid hidden, a live move or clone redrawn unlocked, a hovered Shift-only zone disarmed, and the Shift-only selection dropped at once or, while a press owns the pointer, when it ends (`shiftUpPending`, `afterShiftUpPress`).
2. When not, nothing of Shift's runs, so zones Ctrl+A selected with no Shift held since stay selected; a focus loss stands in for the Shift release the canvas never saw, as H24.3 rules zones stay until Shift is next released (B352).
3. `onArmingUp(evt)` runs with the blur's event, whose modifiers are all false, so an armed delete or clone affordance goes, as Alt's or Control's release would (a:F9).

It cancels no gesture and ends no press, draw's own policy: a drag continues across a focus change today.\
B413's cases are first reproduced in tests of draw's and then held fixed: Shift held, focus lost, Shift released elsewhere -- the zone grid still shown and a Shift-picked zone still selected; the same with a pointer event whose `shiftKey` is false between the Shift press and the focus loss; Shift held before the page had focus, a Shift-right-click on a zone, its release, then the focus loss; Shift pressed while typing in a field, its key-down dropped (`app/src/capture.js:102`), then a Shift-press on the canvas and the focus loss; Alt held over a node, focus lost -- the node still armed; and two controls, Ctrl+A's zones kept across a focus loss with no Shift held, and Shift pressed and released while typing, leaving nothing owed.\
The move restates, read and not run: `tests/input.test.js:774` (B45's bound set gains `blur`); `tests/input-capture-move.test.js` (its added and removed listeners gain `host:blur`, its sink a `blur` method, and its `FORM.press` and `FORM.pointer` `pointerId`); `tests/input-capture.test.js` (where it lists the sink's methods); `tests/fixtures/client-harness.mjs` (`dispatchFor` gains `onBlur`).\
The parity mode is retired, as `INPUT-CAPTURE.md` planned "until the copy is deleted -- when B409 or B413 is ruled, or capture next changes", all three now: its comparison with the SHA-pinned copy of the old capture would differ on every pointer event by the `pointerId` the adapter now hands (a:F4), and the corpus replayed byte-identical stays the move's guard (GR6).\
So `tests/input-capture-parity.test.js`, `tests/fixtures/capture-parity-edges.json` and the copy's folder, `tests/fixtures/pre-capture/`, are deleted; `tests/fixtures/capture-parity.mjs` keeps `sceneOver` alone, for `tests/input-capture.test.js` and `tests/input-capture-move.test.js`; `tests/fixtures/client-harness.mjs` loses its parity hook; `RULES.L4.verbatim`'s entry for the copy leaves `tools/layers.mjs`, and `tests/scan-layers.test.js`'s falsifiers V1 to V9 are restated against a fixture of their own; `tools/probe/capture-sample.mjs`'s note is restated.\
Draw lists neither the wheel, which waits for pan and zoom (H26.6), nor the context menu, since its own listener on the host (B75, `app/src/capture.js`) covers the palette and the header beyond the surface; facts' `time` is read by nothing of draw's.

**`input-binding` `0.2.0`: B427 fixed, another pointer told apart, the press resolved in one call.**\
Draw declares its link gesture for button 0 (`app/src/input.js:225`); IB11's rule commits it when a chord's last release names another button.\
B427 is first reproduced in a test of draw's -- a link drag, the right button pressed, the left released, the right released, the gesture left live under `0.1.0` -- and then held fixed.\
Draw's facts carrying `pointerId`, a move or release of another pointer answers `otherPointer`, and draw's handlers return at once on it (o:F6): `move` calls `pointerMove` before `track`, and `release` returns before `dispatchUp` and the teardown that calls `onGestureEnd` and `afterShiftUpPress` (`app/src/input.js:1088-1095`).\
So in o:F4's case -- a mouse button pressed beyond the canvas, a touch press opening a link, the mouse's release over the canvas -- the link, its press and the deferred queue all survive, and the touch's own release commits the link with its own trigger; an integration case holds it with remote changes queued (`bindGestureDefer`, `app/src/sync.js:72-74`), the queue released only after the touch's commit.\
Its press body becomes, with no change of behaviour (checked against `app/src/input.js:632-641`, where `pointerDown` precedes the run-mode guard and the guard precedes the taken return, so in run mode `runModePress` runs taken or not):
1. `track`; in run mode, `pointerDown` alone and `runModePress`, as today;
2. otherwise `resolvePress(evt, { match, cancelled })`: `match` closes the labels, hides the hand and answers `resolveInput`'s `match` when it found a rule, else `null`; `cancelled` is `#cancelled(outcome, evt)` (`app/src/input.js:660-661`);
3. a taken press, or one with no rule, returns; the rest of the body is unchanged.

The binding parity fixture (`tests/fixtures/binding-parity.mjs`, `tests/fixtures/binding-parity-lifecycle.json`) confirms the same bodies run in the same order (GR7), the chord and two-pointer sequences listed apart, each with both answers; where today's code makes its second `pressMatched` whatever the cancel body did -- throwing if it ended the press, cancelling a gesture it started -- `resolvePress` makes none (IB15), which no corpus case reaches (read, not run).\
The session spy (`tests/fixtures/session-spy/wrapper.mjs`) wraps `resolvePress` and the key operations beside its eight, logging the outcome `resolvePress` answers, since the calls it makes inside are not the wrapper's to see; F6 of `tests/input-binding-move.test.js:176-187`, which looks for the press's `pressMatched`, looks for its `resolvePress` (a:F1).\
Draw calls none of IB14's operations, its rows reading the modifiers a fact carries.

**`vector-scene` `0.2.0`.**\
Nothing of draw's behaviour changes: draw calls no `itemAt` until its picks read items (H26.8), and its harness's fake document opens as before.

**Backlog rows the releases and the moves close or change.**\
Closed: B411 (the wheel and the touchpad's pinch, the tester their first consumer); B412 (the context menu as a fact, the tester the application other than draw); B413 (draw); B427 (draw and every consumer); B424; B406's first half, held keys; B420's captured-pointer half.\
Narrowed: B409, to a second pointer's press replacing the first's, its moves and release now told apart (RD18).\
Restated: B417, whose trigger the tester meets in name only -- its legend is its own, every row's standing for each fact painted live from `traceInput` (IB6), where draw's help is a static list of what each row means (`app/src/help.js`); the two share only the reading of `table.rows`, which `input-binding` already offers, so nothing is extracted, and the trigger becomes "a second application shows a static help of the inputs its bindings declare".\
Held: B419, VS13 stating what it leaves to the application; B420's no-platform half.

---

## 5. Decisions owed

Each with its options and their costs, and a recommendation, to be asked of the director one at a time.

| # | Decision | Options, and what each costs | Recommendation, and why |
|---|---|---|---|
| RD1 | How capture's new event families arrive | (a) each only when the capture lists it in `listen`; (b) always -- draw's adapter would throw on every wheel turn, right click and focus loss (N7; read from the code, not run), and every page gains a wheel listener it never asked for; (c) a component of their own -- a second listener component on one surface | (a): no `0.1.0` declaration changes behaviour, and a consumer opts into exactly what it handles |
| RD2 | The wheel listener's passivity | (a) `{ passive: false }`, so a claim works on any surface; (b) two arguments, a claim then working only on an element surface (N1), which the contract must say; (c) a declaration field choosing | (a): the claim must be decided before the platform scrolls, and a capture that lists the wheel has asked to decide it |
| RD3 | The wheel's units | (a) deltas and `deltaMode` as delivered; (b) converted to pixels by a line and page height the declaration gives -- a number capture computes from a guess, the platform giving no line height; (c) both | (a): capture computes no number (D1), and "exactly" is the tester's whole point; the guide shows a conversion where an application wants one |
| RD4 | A touchpad's pinch | (a) a `wheel` fact with `ctrlKey`, named nothing; (b) a `pinch` fact guessed from `ctrlKey` and fractional deltas -- a guess the platform does not support; (c) Safari's gesture events as well -- non-standard, not measured here | (a), Safari lying outside the tester's covered browsers (IT-D12), its gesture events held with the trigger "a covered browser delivers a pinch as other than a `wheel`" |
| RD5 | Where focus loss comes from | (a) `blur` on the key source; (b) `blur` and `visibilitychange` -- the latter fired at the document, which capture is not handed, and whose state capture cannot read without a target's member; (c) nothing, the application listening itself | (a): a key source's `blur` preceded the `visibilitychange` in the one leaving measured, a tab switch, and is the event that means no key-up will come to that source |
| RD6 | The event's time | (a) `time` on every fact; (b) on facts of a listed family alone; (c) held | (a): it is data the platform delivered, it costs one field and one read, and the tester's hold duration and repeat rate need it, as binding's timed triggers will; the read refuses an event whose getter throws, a change listed beside `0.1.0` |
| RD7 | Lock state (Caps Lock, Num Lock) | (a) held; (b) carried, by calling the event's `getModifierState` -- a platform method run while reading, and a state the gate cannot set over the protocol | (a), the trigger "an application's row or a person needs lock state shown": lock state is no input, so coverage holds without it |
| RD8 | A gesture whose last release names another button (B427) | (a) commit on the release that ends a press of the gesture's button; (b) a `commitGesture` request -- each application then rebuilds the reasoning G6 says would ship as a bug; (c) commit on the move that releases the gesture's button -- binding would learn the platform's `buttons` bit order; (d) nothing, `button: null` documented -- the declared button then takes no press | (a), with RD18: binding keeps deciding when each phase is due, from one more field it already read, and no browser sequence of one pointer but the chord changes answer |
| RD9 | Who keeps the keys held | (a) `input-binding`'s session (IB14); (b) each application, the guide showing a dozen lines; (c) `input-capture` -- stateless by design (IC7) | (a): B406 registered it as binding's limit with the trigger the tester's roll-over row meets; with IB15 the session becomes the one place an input surface's protocol lives -- the press's order, the release's rule, and which keys are down -- and a stuck key after focus loss is a trap of that protocol, as a lost start is of the press's; weighed against binding's line "holds no application's situation", the keys held being input state, as the press is |
| RD10 | What lies under a captured pointer | (a) `vector-scene`'s `itemAt`, by the platform's `elementsFromPoint`, the first owned item in the hit stack; (b) a geometric query in the scene -- a second hit test that disagrees with the platform's at every stroke's edge (D4); (c) each application's own geometry, as the experiment did | (a): exact as the platform hit-tests, one member of the slice, optional so a root without it opens |
| RD11 | The root's attributes | (a) stated as the application's (VS13); (b) a view in the scene now -- H26.6's question answered without its consumer; (c) left silent, as the experiment found it | (a): a sentence, and nothing H26.6 needs is decided |
| RD12 | `snap-grid` | (a) no release, its documents and gate on its main branch -- the installed package keeps the documents G1, G2, G18 and G19 found, since it ships them (o:F17); (b) `0.1.1`, a patch carrying the documents, its built files byte-identical to `0.1.0`'s | (b): what a consumer installs is what it reads, and a patch release changes no code |
| RD13 | B424 | (a) folded into each `0.2.0` and `snap-grid`'s `0.1.1`, each check stated for its component (section 3.5); (b) a release of its own later | (a): B424's trigger is the next release, and these are it |
| RD14 | Draw's move | (a) in H26.5, each component after its release, lab first, four changes of behaviour ruled with this design -- B413's grid and Shift-only selection dropped on focus loss when Shift was held, an armed affordance cleared on focus loss (a:F9), a chord's release committing (B427), and another pointer's move or release changing nothing, draw returning at once on it (RD18) -- each reproduced before it is fixed; (b) held until H26.8 -- two releases of each component in use at once, and draw keeping the defects; (c) after the tester ships | (a): a second consumer moving at once proves each release keeps `0.1.0`'s behaviour for everything draw does not opt into, and that `resolvePress` serves an application with policy between its steps |
| RD15 | Draw's references in the contracts (G1) | (a) rules on their own terms, one provenance line; (b) each component's design of record moved into its own repository, draw keeping the rulings alone -- the programme's designs then split across five repositories; (c) as published | (a): a newcomer reads each contract alone, and `H26-12` keeps the programme's records in draw |
| RD16 | The consumer reference (G2) | (a) each `README.md`'s Use section; (b) a `USE.md` beside it -- a third document to find; (c) generated from the TypeScript declarations -- shapes without the traps | (a): the first page a consumer opens |
| RD17 | Where the guide lives | as IT-D6, decided once there | `GUIDE.md` in `apnex/input-tester`'s `docs` folder, beside its worked example, linked from each `README.md` |
| RD18 | A move or release of another pointer (N9, o:F4) | (a) binding reads `pointerId`, and while a press is held a move or release of another pointer changes nothing and answers `otherPointer`; draw's facts carry it, and its handlers return at once on it; (b) revision 1's rule, the case listed as changed -- a mouse's release commits the gesture a touch began; (c) all of several pointers held with B409, the case committing wrongly until H26.8 | (a): about ten lines and one optional field, exact for the case, a second pointer's press still held with B409; facts with no `pointerId` answer as before |
| RD19 | Where the press's routing lives (G10, IT-D3) | (a) a routing operation in `input-binding` reading capture's `type` -- breaks IB1's opacity and couples two vocabularies; (b) a fifth component composing both by their shapes -- two contracts coupled, releases in lockstep, a repository and gate more, shaped by one application's policy; (c) the tester's own declared part, an exception to H26-12 recorded -- both traps left to every consumer; (d) the guide alone -- likewise; (e) `resolvePress(fact, match)` with the match computed first -- draw cannot adopt it, its labels and run mode sitting between and its cancel body reading the state; (f) a generator the application steps -- no shorter; (g) `resolvePress(fact, { match, cancelled })` (IB15) | (g): compared now, draw's routing and the experiment's share about five lines of mechanism, which hold both traps, and differ only in policy at four points -- before the press, between it and the match, inside the cancel, and after; draw adopts (g) with no change of behaviour and the tester with no policy of its own; the switch over fact types stays wiring, since no component imports another |

**Registered when this is ratified,** each with its revival trigger (RU3): a shared trusted-input driver (G8); binding's timed triggers (G11); a scale the scene answers, with the view (G15, B419); a shared keyboard plan (G17); Safari's gesture events (RD4); lock state (RD7); composition facts (N5); double clicks of buttons other than the primary, with the timed triggers (G11); and B417's trigger restated (section 4).

---

## 6. Axiom alignment audit (M7)

**Identity.**\
The components' next releases at revision 4, read against draw's `19e5dd5`, each component's `v0.1.0` and mission-kit at `e33c850`, after readings 1 to 3.

**Verdict.**\
Revision 4 is `pass, with guardrails`, by its author, after a confirming reading whose six findings it folds in (section 7.3).

| Layer | Axiom | Weight | How the design stands |
|---|---|---|---|
| library | `A3` | load-bearing | Each duty unchanged, each change inside it (sections 3.1 to 3.4); each new surface earned by a consumer outside draw, and opt-in where draw has not asked for it (RD1); the press's protocol held once by the session that owns it (IB15), so no consumer keeps a copy of it. |
| library | `A1` | supporting | `input-capture` stays stateless between events; the session's keys held and the press's pointer are in its state, frozen and readable whole (IB10, IB14); the scene's state unchanged. |
| library | `A8` | load-bearing | Each new rule has invariants able to fail, among them a test beside `0.1.0` in each component (I18, I19, I15) and a positive control for the claimed pinch (I10); each check of B424 stated for its component, with a control and a falsifier. |
| consumer | `A5` | load-bearing | Draw's pixel probe against production finds nothing at each move; draw and the tester run the same releases. |
| consumer | `A9` | supporting | Each draw move lab first; each change of behaviour reproduced before it is fixed (RD14). |
| all | `A4` | supporting | Each gap with one disposition and every deferral a row with its trigger; the experiment's gap log kept verbatim (`TESTER-EXPERIMENT-GAPS.md`), and each reading's every finding recorded with its disposition (section 7). |
| all | `A14` | load-bearing | Nineteen gaps and nine more become part changes, documents and the guide, the routing among them, and the tester's vision forbids it keeping a workaround. |
| all | `A2`, `A6`, `A7`, `A10`, `A11`, `A12`, `A13` | not materially implicated | No trait brings `A2`, `A11` or `A12` into force; no seam between agents changes; `A13` is served by section 5's decisions, each with a recommendation. |

**Layered application.**\
State and truth: the session holds one surface's input state once -- the press with its button and pointer, the gesture, the keys held -- and capture still holds none.\
Composition: four components through their contracts; each new read optional or opt-in; the fact-type switch left to the application, so no component learns another's vocabulary.\
Integrity: each release gated by its own invariants, a test beside `0.1.0`, and Chrome runs for what only a browser can show; draw's moves gated by the corpus and the pixel probe.\
Director attention: section 5 asks one decision at a time, RD9, RD14, RD18 and RD19 the ones that change what a component is or what draw does.

**Tensions, and how they resolve.**
- `input-binding` holding keys against its line "holds no application's situation": the keys held are input state, as the press is, and B406 named them binding's (RD9); the director may rule otherwise, the guide then carrying the dozen lines.
- `resolvePress` calling application code against IB12's rule that a session calls none but getters and traps: the exception is bounded -- two functions, each after a transition, the state read again after each -- and recorded beside the table's predicates (IB6), which already run application code.
- `input-capture` listening for three events more against IC4's "listens for nothing else": still nothing else unless the capture lists it (RD1).
- The slices widened: capture reads four wheel fields and every event's `timeStamp` and passes a third argument for one listener; binding reads `code` and an optional `pointerId`; the scene reads one document member and the platform's answer's identities.

**Deltas.**\
`input-capture` `0.2.0`, `input-binding` `0.2.0`, `vector-scene` `0.2.0` and `snap-grid` `0.1.1`, each released by its own CI after its run-verifier; the four documents (section 3.5); the guide, with the tester's first release; draw's three moves (section 4); B411, B412, B413, B424 and B427 closed, B406 and B420 halved, B409 narrowed, B417's trigger restated, and the registered rows of section 5.

**Guardrails for the build.**
- GR1: a `0.1.0` declaration, root, fact and sequence behaves as under `0.1.0` in every listener, call, read and value, except for the changes each section's closing paragraph lists, held by I18 of `input-capture`, I19 of `input-binding` and I15 of `vector-scene`, each run beside the `0.1.0` release.
- GR2: each new rule's tests fail against a planted mutant of it, recorded in the component's decision record.
- GR3: the vocabulary check passes with the renamed list on each repository.
- GR4: no contract names a draw file but its provenance line.
- GR5: B424's checks pass on all four, each with its control and falsifier (section 3.5).
- GR6: draw's moves keep the gesture corpus byte-identical but for the cases RD14 rules, each listed with both answers.
- GR7: draw's press through `resolvePress` runs the same bodies in the same order as today for every corpus case.

**Closeout hooks.**\
Each release's run-verifier re-checks GR1 to GR3 and GR5 and its section's invariants; draw's move verifier re-checks GR6, GR7 and the probe; the tester's first release is the proof that no workaround remains.

---

## 7. Reviews

H26-3 requires a multi-family reading through context-lab's review panel (M1) before ratification.\
Each reading is recorded here as it is made: its readers, its counts, and one disposition per finding with its reason.

### 7.1 Reading 1 -- 2026-10-24, of revision 1 at `5224b00`, with the tester's architecture at `5094216`

Read cold through context-lab's review panel, `--tools on --verify`, the repositories mounted read-only, by `gemini-4-argon` (`a`), `gpt-6-astra` (`o`) and `grok-4.20-non-reasoning` (`x`), none of which drafted it, the reading kept whole at `~/taceng/drawv2-eval-runs/h26-readings/it/reading-1/` outside the repository.\
It read this design and the tester's architecture together, and reported 47 findings: 19 from `a` (10 blocking, 7 should-fix, 2 minor), 21 from `o` (9 blocking, 12 should-fix) and 7 from `x` (3 blocking, 2 should-fix, 2 minor); 22 blocking, 21 should-fix and 4 minor.\
Every reader returned verdicts on the others' findings: `a` supported all 21 of `o`'s and 4 of `x`'s 7; `o` supported 11 of `a`'s 19 and 1 of `x`'s; `x` refuted all of the others'.\
The director gave a disposition for each finding; the behavioural claims were checked against the code, and what revision 2 newly relies on was measured in Chrome (P14 to P17).\
*A* marks a finding fixed in the tester's architecture, recorded in its own Readings section as well.

| Finding | What it said | Disposition, and why |
|---|---|---|
| a:F1 | `itemAt`'s `elementsFromPoint` fails `vector-scene`'s own platform-member check | **Fixed**, confirmed: the slice's document row gains it, with a control and a falsifier (3.5). |
| a:F2 | copying `vector-scene`'s runtime check fails the other three on `BigInt` and DOM names | **Fixed**, reproduced by running it over each build: each component's check stated for it, built-ins and member pass apart (3.5). |
| a:F3 | `listen`'s judging and listeners leave seven ambiguities | **Fixed**: step 2 says seven, step 9's test is step 6's, the order fixed, removals with two arguments, the options object fresh (3.1). |
| a:F4 | the new fields' order and reading underspecified | **Fixed**: the 21 keys in order, each delta judged as read, `-0` mode `0`, no `target` on a `blur`, step 4's fact whole, the types named (3.1). |
| a:F5 | press identity, `-0` and the `code` seam ambiguous | **Fixed**: `button + 0` kept across restarts, identity restated, IB11 written exactly, `''` and `null` answered untracked (3.2, N8). |
| a:F6 | the session's key order, outcomes and capability rows omitted | **Fixed**: the fourteen keys in order, outcomes' keys, `released` the old array itself, two capability rows (3.2). |
| a:F7 | `itemAt`'s reading and the scene's key order underspecified | **Fixed**: a throwing getter refuses the root, a non-function opens, the state judged first, nine functions not ten (3.3). |
| a:F8 | draw's `blur` breaks tests section 4 missed | **Fixed**, confirmed: section 4 lists each test and fixture the move restates. |
| a:F9 | Alt's and Control's arming survives a focus loss | **Fixed**: draw's `blur` runs `onArmingUp`, a change of behaviour RD14 rules. |
| a:F10 | chord rows overlap ordinary drag moves | **Fixed** *A*: a move whose `button` is 0 or more is a button change, a plain drag's move giving -1 under the trusted-input driver too (P17, measured). |
| a:F11 | the tester never uses `traceInput`, which binding's design made for it | **Fixed** *A*: the legend is every row's trace for each fact (IB6). |
| a:F12 | Ctrl wheel facts hit the plain wheel rows too | **Fixed** *A*: the wheel rows exclusive on `ctrlKey`, a row for a turn of no distance, the overlap check holding them. |
| a:F13 | one verdict per fact loses phases; `pressMatched` can throw | **Fixed** *A*: an ordered verdict; `resolvePress` holds the guard (IB15); `becomeGesture` only from a live press gesture. |
| a:F14 | `hit` cannot know whether the pointer is taken | **Fixed** *A*: `itemOf(target) ?? itemAt(screen)`, no capture state kept. |
| a:F15 | `frame-ancestors` in a `meta` rule | **Fixed** *A*, confirmed -- Chrome ignores it there with a console message (P14): the rule split, the `meta` without it, the gate's server sending the header. |
| a:F16 | the keyboard recommendation ignores a Chromebook | **Fixed** *A*: both plans drawn, the person choosing (IT-D2). |
| a:F17 | B417 not addressed | **Fixed**: restated, the tester's legend its own (section 4). |
| a:F18 | M7's Deltas and Layered application missing | **Fixed**: added here and in the architecture. |
| a:F19 | an edge cache unverified against `Cache-Control` | **Fixed** *A*: `Cache-Control` set as object metadata at the copy, the edge cache off by design. |
| o:F1 | one verdict cannot hold every phase one fact makes | **Fixed** *A*, as a:F13. |
| o:F2 | IB14 refuses keys capture legitimately delivers | **Fixed**: untracked, never refused, identity never invented (IB14, N8). |
| o:F3 | routing deferred though a second consumer exists | **Fixed**: compared now; `resolvePress` (IB15, RD19); draw adopts it. |
| o:F4 | the release rule changes behaviour across pointers | **Fixed**: `pointerId` read, the case listed with both answers (IB11, RD18, section 4). |
| o:F5 | permitted request channels unchecked | **Fixed** *A*: images and fonts refused, the painter held to an allowlist, requests monitored from navigation, planted leaks failing. |
| o:F6 | revalidation does not make a deploy atomic | **Fixed** *A*: versioned folders, the entry copied last, a release-independent header, rollback by entry. |
| o:F7 | the immediacy gate passes visible lag | **Fixed** *A*: a failing bound a delayed build fails, and a recorded acceptance on the director's Chromebook. |
| o:F8 | input the browser cannot report confused with input not shown | **Fixed** *A*: two lists, each delivered family placed in one (N5, RD4). |
| o:F9 | mouse state lacks rules for other facts | **Fixed** *A*: only mouse facts change the buttons and reach the session; touch and pen kept out. |
| o:F10 | `itemAt` looks through foreign occluders | **Fixed**: the semantics named, the equivalence qualified, an occlusion case in I14. |
| o:F11 | reading `itemAt`'s answer not deterministic | **Fixed**: `length` read once, indices in order, a closing getter refused (VS12, I13). |
| o:F12 | `listen`'s traversal unplaced among member reads | **Fixed**: read last, the mutation case in I13. |
| o:F13 | optional new reads break GR1 | **Fixed**: every change listed per release, GR1 scoped, a test beside `0.1.0` in each. |
| o:F14 | the stored button can hold `-0` | **Fixed**, as a:F5. |
| o:F15 | unseen presses and idle holds lack honest timing | **Fixed** *A*: first seen told from pressed, durations as of the latest fact, no display clock. |
| o:F16 | coalescing may merge delivered values | **Fixed** *A*: the exact latest fact kept, counts never sums. |
| o:F17 | `snap-grid` ships the documents it would not release | **Fixed**, confirmed in its `package.json`: `0.1.1` (RD12). |
| o:F18 | draw's blur cleanup left to the builder | **Fixed**: the transition and its state fixed now, Ctrl+A's zones kept (section 4). |
| o:F19 | pinch suppression asserted without observing zoom | **Fixed**, measured (P16): an unclaimed pinch took the scale to 2, a claimed one left it 1, now I10's control; Ctrl and the wheel do not zoom headless, so the Chromebook check is recorded. |
| o:F20 | the two-point scale fails for a non-uniform scale | **Fixed**: the guide states the precondition and the smaller axis scale, with the example. |
| o:F21 | the keyboard recommendation postpones the known user's | **Fixed** *A*, as a:F16. |
| x:F1 | draw a Chromebook plan with measured codes | **Fixed in part** *A*: both plans, the Chromebook's codes from Chromium's table and the code values, marked unmeasured until the director's keyboard is run. |
| x:F2 | the pinch and Ctrl-wheel ambiguity not marked | **Fixed** *A*: IT-D8's fixed sentence beside the row and in the coverage check. |
| x:F3 | composition, double clicks, page zoom and touch beyond `pointerType` missed | **Fixed in part**: composition and Safari's gestures now said not shown (N5, RD4); a double click is already a `double` fact; zoom is prevented by the claim; touch and pen shown as delivered. |
| x:F4 | the router and the plan held in the tester against `A3` | **Fixed** for the router (IB15); the plan stays the tester's, one application's data, held with G17's trigger. |
| x:F5 | held keys against binding's duty | **Not changed in substance**: RD9 stays the director's, its argument strengthened by IB15. |
| x:F6 | the `meta` rule's subset and real headers unproven | **Fixed**, as a:F15; no `'unsafe-inline'` is needed, presentation attributes and the CSS object model passing (P11). |
| x:F7 | `itemAt`'s walk, layers and nesting not verified | **Fixed** by o:F10 and o:F11: I13 and I14 hold the walk, `pointer-events` and nested shapes. |

### 7.2 Reading 2 -- 2026-10-24, of revision 2 at `19e5390`, with the tester's architecture at `71b0842`

Read cold through the same panel, `--tools on --verify`, by the same three, the reading kept whole at `~/taceng/drawv2-eval-runs/h26-readings/it/reading-2/`.\
`a`'s reply was malformed JSON, so the panel recorded none of its findings; its twelve were recovered from the raw reply into `a-findings.txt` beside the reading, and carry no verdict from another family.\
It reported 32 findings: 12 from `a` (7 blocking, 4 should-fix, 1 note), 14 from `o` (8 blocking, 6 should-fix) and 6 from `x` (2 blocking, 3 should-fix, 1 minor).\
`a` supported all 14 of `o`'s and refuted all 6 of `x`'s; `o` refuted all of `x`'s; `x` refuted all of `o`'s.\
The director gave a disposition for each; what revision 3 newly relies on was measured in Chrome (P19, P20) or run on the released code (`scratch/`).

| Finding | What it said | Disposition, and why |
|---|---|---|
| o:F1 | the key rows still overlap | **Fixed** *A*: rows exclusive, Shift classed, the browser's keys refused by every claiming row; the released binding finds no overlap over 46,469 facts and four contexts, and revision 2's rows reproduce Ctrl+A's. |
| o:F2 | `when` cannot tell a held key's release from an unseen one | **Fixed** *A*: a per-fact context, `wasHeld` and `otherHeld`, the same for the trace, the match and the overlap check. |
| o:F3 | the double row refuses the platform's `dblclick` | **Fixed** *A*: no pointer type asked of `double`; other buttons' double clicks held (G11). |
| o:F4 | `resolvePress` answers inconsistently after re-entry | **Fixed**: IB15's table, the match read once, `phase` never `cancel`, I17's oracle limited to where it holds. |
| o:F5 | I15 contradicts IB11 for a pressless gesture | **Fixed**: revision 2's sentence was wrong; IB11's decided cases, the `0.1.0` column run on the released code, and I15 stating the table's condition. |
| o:F6 | draw ends its gesture work on an ignored release | **Fixed**, confirmed in `app/src/input.js`: `otherPointer`, draw returning before dispatch and teardown, an integration case with remote changes queued. |
| o:F7 | the blur guard can forget a Shift cleanup owed | **Fixed**: an obligation, cleared only by `onShiftUp`, the intervening event a test. |
| o:F8 | focus loss can leave the tester's gesture live | **Fixed** *A*: revision 2's change reverted, `blur` calling `pointerLost`. |
| o:F9 | commit meanings have no trace in the legend | **Fixed** *A*: the derived fact's shape, its trace and match in its step, input and meaning marked apart, examples per family. |
| o:F10 | the threshold is unstated | **Fixed** *A*: the session's declaration, 4 drawing units shown on the page, the boundary tested. |
| o:F11 | backend-bucket headers need Cloud CDN | **Partial**: not established -- Google's custom-headers documentation and `gcloud compute backend-buckets update --help` state them with no CDN requirement; the lab deploy measures the headers before production, the URL map's header action the stated alternative. |
| o:F12 | the header leaves script loads open; no allowlist | **Fixed** *A* by the browser-rule decision: no import map, one whole rule in the header, the allowlist written out, planted leaks (P20). |
| o:F13 | "not shown" does not meet the ratified coverage | **Decision owed** *A* (IT-D12): covered browsers named; composition reaches no page with nothing editable (P19). |
| o:F14 | the smaller axis scale fails under shear | **Fixed**: the smallest singular value, the shear an executable check (3.5). |
| x:F1 | the run-mode guard and `resolvePress` break parity | **Not changed in substance**: rechecked, the guard's order holds and `match` reads no mode; GR7 is checked by the parity fixture at the build. |
| x:F2 | the pointer rule underspecified for four cases | **Fixed** with o:F5: each case a row of IB11's table. |
| x:F3 | the split rule and the entry last unproved | **Fixed** by the browser-rule decision: one rule, no hash; atomicity tested between deploy steps (*A*). |
| x:F4 | read Shift from binding's keys | **Fixed** otherwise, as o:F7: draw tracks no keys. |
| x:F5 | rows not proved exclusive | **Fixed** with o:F1. |
| x:F6 | the verdict needs examples | **Fixed** with o:F9. |
| a:F1 | the spy misses the press's calls | **Fixed**: the spy and F6 restated; the guard's order rechecked and holding. |
| a:F2 | capture's member check fails on its own names | **Fixed**, run on the build: `focus`, `name` and `length` found, the exact set stated (3.5). |
| a:F3 | draw's `FORM` and edge records break | **Fixed**: `FORM` restated, the edge records retired with the parity mode; `tests/import-map-browser.test.js:90` reads named fields, unaffected. |
| a:F4 | parity breaks on every event | **Fixed**: the parity mode retired, as `INPUT-CAPTURE.md` planned. |
| a:F5 | `shiftHeld` fails when typing in a field | **Fixed** as o:F7, the field a control. |
| a:F6 | step 5 unclear when `cancelled` changes the press | **Fixed** with o:F4. |
| a:F7 | IB2's reading order incomplete | **Fixed**: IB2's rows, `pointerId` by descriptor alone, `undefined` refused. |
| a:F8 | key rows overlap on modifiers and empty codes | **Fixed** *A* with o:F1. |
| a:F9 | buttons beyond 4, `buttons` `null` and `double` | **Fixed** *A*: a row for each, the double as o:F3. |
| a:F10 | the new facts' types and mouse state | **Fixed**: the types tabled (IC9); the tester's rule for context-menu, double and wheel facts (*A*). |
| a:F11 | `itemAt` may stop at a removed item's element | **Fixed**: it stops at an item still held. |
| a:F12 | the header carries no `default-src` | **Fixed** *A* by the browser-rule decision. |

### 7.3 Reading 3 -- 2026-10-24, of revision 3 at `3cebc0f`, with the tester's architecture at `1a537cc`, confirming

Read by `a` and `o`, the reading kept whole at `~/taceng/drawv2-eval-runs/h26-readings/it/reading-3/`: `a` raised nothing; `o` raised six, one blocking, four should-fix and one minor, each supported by `a`.

| Finding | What it said | Disposition, and why |
|---|---|---|
| o:F1 | GT5 asks trusted input for a row Chromium cannot produce | **Fixed** *A*: browser-reachable rows proved by trusted input, three defensive rows by named fixtures, the overlap check over both; a wheel of no distance, pen and touch pointers and the browser's own keys measured reaching a page (P21). |
| o:F2 | the Shift obligation misses pointer-driven activation | **Fixed**: set by every event carrying Shift, each activation site in `app/src/input.js` reading it, and the two sequences added. |
| o:F3 | the singular-value formula cancels | **Fixed**: a scaled computation with no cancellation and lowered for its rounding, an unrepresentable scale drawing no grid, checked exactly; both counterexamples in the guide's checks. |
| o:F4 | the press over a live gesture omits the taken case | **Fixed** *A*: qualified to another button, and the same button's press added -- taken, nothing asked, cancelled or started. |
| o:F5 | P19 does not show an input method's typing arrives as key events | **Fixed**: the claim narrowed to the injection measured; a native input method's acceptance on the director's Chromebook made a condition of IT-D12's coverage (*A*). |
| o:F6 | the browser's own keys miss macOS's fullscreen shortcut | **Fixed** *A*: listed per platform with their sources, Control, Command and F among them, the predicate their union. |

---

## 8. Settled at build

Each release was built from its section by an agent that had not drafted this design, sealed by an independent run-verifier who planted mutants of their own, folded the verifier's findings, passed its gate on GitHub on Node.js 22 and 24, and was released by its own CI as an immutable GitHub release; each published package's built files equal a build of its tag.\
Each component's decision record, D3, lists what its builder chose and its errata in full; none changes a decision of section 5.

| Release | Tag at | Mutants | Errata and what the verifier changed |
|---|---|---|---|
| `snap-grid` `0.1.1` | `dbfd8d8` | 17 | The runtime check's built-ins are the thirteen names the build uses -- `RangeError` in, `WeakMap` out -- since the check requires the list to equal the build's; the release step that refuses built files differing from `0.1.0`'s moved into a script of its own in `snap-grid`'s tools folder, `check-repeated-build.mjs`, and tested end to end with a stand-in `gh`, after the verifier's mutants of the inline step survived; the built files are byte-identical to `0.1.0`'s, shown on the published release. |
| `input-binding` `0.2.0` | `dbf0332` | 52 | The built-ins are fifteen, `WeakMap` out, for the same reason; `eval`, `Function` and a call through `constructor` are refused by the runtime check, as in the other three; while the press holds a pointer that is not `null`, a fact naming none is another pointer's, stated in `CONTRACT.md` and `README.md` at the verifier's asking; I11 extended so a malformed `match` stops the reading before `cancelled`'s descriptor (the verifier's surviving mutant). |
| `input-capture` `0.2.0` | `1caa4b5` | 44 | An unclaimed pinch's scale is accepted within a hundredth of 2; a wheel fact's `takePointer` answers `false` only when its event carries no `pointerId`; a second tab blurs a page only once it holds the window's focus, and IC1's sentence says so; the builder's erratum that Chrome could not show RD2 was withdrawn when the verifier showed it on a body capture, and I10 now shows it; the I18 comparison strips exactly one `timeStamp` read per event; Chrome's singleton directory, which GitHub's later Chrome names with no leading dot, is removed in either form, found by GitHub's gate after the first push. |
| `vector-scene` `0.2.0` | `a4df889` | 17 | Every opening with a root now reads `elementsFromPoint`, a change beside `0.1.0` the design's list named only as a refusal, held by I15; the new fit criterion sits under "Does my project want this at all?"; its first release run found no Chrome started within the launch wait on its runner while the main branch's gate passed on the same commit at the same moment, and the run made no draft; re-run on the same tag, it released. |

- **Each vision absorbed `H26-14`** where its direction changed, the status line saying so: `input-capture`'s (the facts a capture asks for, and the event's time, its "not a clock" line restated), `input-binding`'s (held keys, pointers told apart, the press resolved in one call, its only calls back named) and `vector-scene`'s (the item under a screen point); `snap-grid`'s is unchanged.
- **The trusted-input harness** kept in each repository needed one change in `input-capture` that `vector-scene`'s identical copy also wants -- the undotted singleton directory, which it leaves on GitHub's runners without failing (B428).
- **Closed by the releases:** B411, B412 and B424; B413 and B427 close with draw's moves.
- **Draw's three moves,** each built by an agent that had not drafted this design and passed by an independent verifier, in the lab in turn and in production together at `ca492da` (`draw-00242-xws`, 2026-10-25), the pixel probe of all three against production finding nothing across 20 documents; B413 and B427 closed.
  - `input-capture`: failed once by its verifier -- retiring the parity test moved which test files run beside the lab's, and one start-up wait the fix missed still timed out under load -- then passed, the lab started in one helper that waits up to 15 seconds with a guard that fails any test starting it another way; a real second tab now stands for the focus loss; Shift and Alt held together at a focus loss is a case of its own.
  - `input-binding`: a test and a corpus scenario release the right button while the left press is held, which no browser sends -- the right's release comes only once every button is up -- and IB11 commits the link at that release, one step earlier than `0.1.0`; the corpus record is unchanged and the per-step records are listed apart with both answers, ruled by the recorder as IB11's own consequence on input no browser produces and confirmed by the verifier; the Shift marking runs before the return on another pointer, held by a test, and the return holds whatever the press.
  - `vector-scene`: no change of behaviour; every scene opened on a root reads `elementsFromPoint` once, and draw calls no `itemAt` until H26.8.
  - Found beside them: two of draw's browser tests launch Chrome on a fixed port (B434).
- **The tester's first release,** `input-tester` `v0.1.0`, built from its architecture by an agent given the four components' published documents and not draw's, released immutable by its own CI and deployed to its lab, `input-lab.apnex.io`, 2026-10-26; its own record is its decision record's entry 0002 and its backlog, in `apnex/input-tester`.
  - Two independent reviews failed its first build: its tests took which keys it claims from the code they tested, so a page claiming a browser shortcut passed; and its deploy copied the entry without replacing it, so no second release or rollback could ship. Both folded, and the builder found its own browser driver had never held a taken pointer, naming no button on a drag's moves; confirming reviews passed it, their remaining test gaps folded with one targeted check each (H26-15).
  - The recorder ruled two errata within IT-D9 and the architecture's bound: the browser's own keys matched by the key's letter as well as its code, since Chrome matches shortcuts by the layout's letter, view source among them; and the immediacy bound judged at the deliveries' 95th percentile, since the maximum flaked under a loaded machine.
  - GitHub's newer Chrome refuses a forbidden worker by an error event, not an exception; the test judges either, the page refused both ways.
  - What the components' documents left its builder to guess is the tester's backlog D1 to D6 -- among them that no component's document states the held-button trap on a drag's moves -- inputs to the guide and to the components' next documents.
  - Its hosting: two public buckets, `gs://input-lab-apnex-io` and `gs://input-apnex-io`, each behind a backend bucket with the edge cache off and the IT-D5 rule as a custom response header, on the existing load balancer at `input-lab.apnex.io` and `input.apnex.io`; measured by the deploy, every file served byte-identical to the release, the entry `no-store`, the folder `immutable`.

---

## Appendix A -- each change, and the tester's need it meets

| Change | Gap | What the tester needs it for | Vision dimension |
|---|---|---|---|
| capture: `listen` | G3, G4, G5, N7 | the wheel, the menu and focus loss through the part, with no listener of its own | proof of reuse |
| capture: `wheel` facts with deltas and unit, `{ passive: false }` | G3, N1 | scroll and pinch shown exactly as delivered, and claimed so the page neither scrolls nor zooms | coverage, fidelity |
| capture: `context-menu` facts | G4 | the right button shown without the browser's menu covering the page | coverage |
| capture: `blur` facts | G5, N6 | keys held when focus is lost unlit, and their releases said unreported | fidelity |
| capture: `time` | G13 | how long a key is held, and its repeat interval | fidelity |
| binding: IB11's release rule | G6 | a chord whose last release names another button ends its gesture | fidelity |
| binding: another pointer told apart | N9 | none of its own, since it hands touch and pen to no session; every consumer handing several pointers to one session, draw among them | fidelity |
| binding: IB14 held keys, untracked keys | G5, N8 | which keys are held, kept once, a roll-over row, and a key with no identity shown as delivered | fidelity, proof of reuse |
| binding: `resolvePress` | G10 | every press through the session with no routing of its own | proof of reuse, teachability |
| scene: `itemAt` | G7, G16 | the key under a captured drag, and its drop | fidelity, proof of reuse |
| scene: VS13 | G14 | the picture's `viewBox` set by the tester, with nothing guessed | teachability |
| all: contracts freed of draw, consumer references, files named, status moved; `snap-grid` `0.1.1` | G1, G2, G18, G19 | a newcomer reading the parts alone, with no word of draw, in the package installed | teachability |
| the guide | G8, G9, G12, G15, N2, N3 | the traps and the browser's surprises in one page, the tester the example | teachability |
| gates and lists | B424 | four parts held to one standard, each check stated for its part, the tester named in their lists | proof of reuse |
