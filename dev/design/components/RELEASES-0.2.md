# H26.5 -- the components' next releases, for `input-tester`

The design of record for the changes the four components make so that `input-tester` (`H26-12` as amended, `H26-13` as amended) can be built from them as published, never working around them.\
It answers each of the nineteen gaps the cold-agent experiment logged (B426) and the few this design found beside them, with one disposition each: a component's minor release, the components' documents, the guide to using the four together, the tester's own code, or held with a trigger.\
It builds on the four designs beside it (`SNAP-GRID.md`, `INPUT-BINDING.md`, `INPUT-CAPTURE.md`, `VECTOR-SCENE.md`) and on each component's published contract at `v0.1.0`; it states only what changes, citing each rule it amends by its id.\
The tester's own architecture, which composes these releases, is `ARCHITECTURE-TARGET.md` in `apnex/input-tester`'s `docs` folder (`~/taceng/input-tester/docs/ARCHITECTURE-TARGET.md`); its decisions owed are numbered IT-D1 to IT-D11.

**Standing:** a design under review, revision 1, drafted 2026-10-24; the code read is draw's `19e5dd5` and each component's `v0.1.0`; the experiment read is `~/taceng/drawv2-eval-runs/h26-tester-experiment/` (its `GAPS.md`, kept verbatim beside this design as `TESTER-EXPERIMENT-GAPS.md`, its app and proof); browser behaviour cited as measured was measured in headless Chrome with trusted input over the DevTools protocol, the probes kept at `~/taceng/drawv2-eval-runs/h26-tester-design/probes/`; not ratified.

---

## 1. What this decides, and what it does not

It decides:
- one disposition for every gap the experiment logged, G1 to G19, and for each gap found here, N1 to N7 (section 2);
- `input-capture` `0.2.0`: the wheel, the context menu and focus loss as facts, each listened for only when a capture lists it, and every fact's time as data (section 3.1);
- `input-binding` `0.2.0`: a gesture committed by the release that ends a press of its button, whichever button that release names, and the keys held kept by the session (section 3.2);
- `vector-scene` `0.2.0`: the item under a screen point, answered by the platform's own hit test, so it serves a captured pointer, and what an application may write on the root (section 3.3);
- `snap-grid`: its documents and its gate alone, and no release (section 3.4);
- what all four change in their documents, their gates (B424) and their vocabulary lists, and where the guide to using the four together lives (section 3.5);
- whether draw moves onto the releases in H26.5, and what changes in draw when it does (section 4).

It does not decide:
- the tester's own structure, language, build, hosting or browser rule, which are its architecture's (IT-D1 to IT-D11);
- pan and zoom (H26.6): a view the scene holds stays held (B419), and the wheel's facts carry no view;
- a touch screen's two-pointer pinch, several pointers told apart (B406's second half, B409), a hold or a double click decided by time, each held with its trigger;
- any change to draw's behaviour beyond B413 and B427, which draw's move fixes and which are ruled with it.

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
| G10 | every consumer writes the same down-match-`pressMatched` routing | tester: a declared part, the router (IT-D3); held: a shared routing part, the trigger "a second application's routing, made a declared part of its own, is shown alike" -- draw's at H26.8 the expected second |
| G11 | no hold, no double click decided by time | held: binding's timed triggers, the trigger "an application's row decides by time"; capture's `time` (G13) is their prerequisite, now carried |
| G12 | naming gesture outcomes through the table's opaque facts was a guess | guide: stated as supported -- a fact is any value the application hands (IB1), so a table may name its own outcomes |
| G13 | facts hold no time; no lock state; no `location` | capture: `time`, the event's `timeStamp` as data (IC5); lock state held (RD7); `location` needs no field, `code` naming left and right and the keypad already |
| G14 | what the application may write on the root is unstated | scene: VS13 -- the root is the application's, its `viewBox` among it (RD11) |
| G15 | no scale, no resize signal | guide: the scale from two `toScreen` calls, a resize the application's own listener; held: a scale the scene answers, with the view (B419) |
| G16 | no "which of my blocks owns this point" | docs: not `snap-grid`'s question -- ownership is the application's data, and the point's item is `vector-scene`'s `itemAt` |
| G17 | no key layout data, no locale labels | tester: its keyboard plan, labels from the Keyboard Map (IT-D2); held: a shared keyboard plan, the trigger "a second application draws a keyboard" |
| G18 | the `README.md` does not name the file an import map maps to | docs: each Install section names it -- `index.js` in the package's `dist` folder, and `snap-grid`'s `conformance.js` beside it |
| G19 | the status line and the gate's mission-kit checkout are noise on a consumer's first screen | docs: the status moved into a Status section near the end; the gate's needs under Test alone |
| N1 | found here: Chrome makes a `wheel` listener on the window, the document or the body passive, so a claim there prevents nothing (measured) | capture: the wheel listener added with `{ passive: false }` (RD2) |
| N2 | found here: a mouse's back button released over a page navigates history unless its `pointerup` is claimed; claiming the `pointerdown` alone does not stop it (measured); the experiment never claimed a release | guide and tester: claim the releases of buttons 3 and 4; no component change -- capture's reply already claims an `up` fact (IC8) |
| N3 | found here: under a browser rule with `style-src 'self'`, a `style` attribute written by script is refused, while presentation attributes and the CSS object model are not (measured) | guide: a scene shape states its look by class or presentation attribute under a strict rule, since the scene writes every attribute by `setAttribute` (VS1) |
| N4 | found here: a browser rule cannot stop a page navigating away with data in its address (measured) | tester: containment of navigation held by its source check and gate (its architecture, GT1) |
| N5 | found here: input through an input method arrives as key events with `key` `Process` and as composition events (not measured) | held: composition facts, the trigger "a person typing through an input method reports what the tester shows" |
| N6 | found here: the experiment proved focus loss with a synthetic `blur`; opening a second tab over the DevTools protocol makes a trusted `blur` and `visibilitychange` (measured) | capture's I10 and the tester's gate use the second tab |
| N7 | found here: draw's capture adapter calls `sink[ROUTE[event.type]]` for every fact (`app/src/capture.js:62`, `:105`), so a fact of a type it has no route for throws | capture: each new family listened for only when listed (RD1), so a `0.1.0` declaration delivers no new type |

---

## 3. The releases

### 3.1 `input-capture` `0.2.0`

**Duty: unchanged.**\
A wheel turn and a context menu are input events on the surface; a `blur` is the key source's own event saying its input has stopped, as a `pointerleave`, already a fact (IC4), says the surface's hover has.\
Capture still decides no meaning, finds nothing under a pointer, converts no coordinate and reads no clock: an event's `timeStamp` is a field the platform delivered, read as data.

**IC3 -- the declaration gains `listen`.**\
Optionally `listen`, an array of distinct strings, each one of `'wheel'`, `'context-menu'` and `'blur'`, `'blur'` requiring `keys`; absent, the capture listens for exactly what `0.1.0` listens for.\
IC2 rule 2's order reads the descriptor of `listen` after `deliver`'s; the array is read as `input-binding` reads one (IB2 rules 4 and 8).

| Step | When | Problem, at pointer |
|---|---|---|
| 7 | `listen` an accessor, or not a dense array of IB2's form | `invalid-value` at `/listen` |
| 8 | an element not one of the three names, or equal to an earlier element | `invalid-value` at `/listen/<i>` |
| 9 | `'blur'` listed and `keys` absent | `invalid-value` at that element's `/listen/<i>` |

**IC4 -- three listeners more, each only when listed.**\
After the listeners IC4 already lists, in this order:

| Platform event | Listened on | Fact `type` | Added with |
|---|---|---|---|
| `wheel` | surface | `wheel` | three arguments, the third `{ passive: false }` (N1, RD2) |
| `contextmenu` | surface | `context-menu` | two arguments |
| `blur` | key source | `blur` | two arguments |

A `wheel` and a `context-menu` fact are pointer facts; a `blur` fact is of neither family.\
Lifecycle rules 2, 3 and 5 hold for them as written: added in order after the judging, taken back in reverse on a throw, removed in reverse by `close`.\
Capture still listens for nothing else: no `click`, `auxclick`, `pointerenter`, `gotpointercapture`, `lostpointercapture`, `focus`, `visibilitychange`, touch, gesture or composition event.

**IC5 -- five properties more, after `metaKey`.**

| Property | A pointer fact | A key fact | A `blur` fact |
|---|---|---|---|
| `deltaX`, `deltaY`, `deltaZ` | a `wheel` fact: the event's numbers, `-0` kept; otherwise `null` | `null` | `null` |
| `deltaMode` | a `wheel` fact: the event's `deltaMode` when it is `0`, `1` or `2` -- pixels, lines, pages -- else `null`; otherwise `null` | `null` | `null` |
| `time` | the event's `timeStamp` when a finite number, else `null` | likewise | likewise |

A `blur` fact holds `type` `'blur'`, `time`, every modifier `false`, and every other property `null`; neither `hit` nor `focus` is asked for it.\
The deltas are carried as delivered, never converted: capture computes no number (`INPUT-CAPTURE.md` D1), and a line's or a page's height is no field of the event (RD3).\
A touchpad's pinch arrives as a `wheel` with `ctrlKey` true and fractional deltas, and a mouse wheel turned with Ctrl held as a `wheel` with `ctrlKey` true; capture names neither a pinch, since what the platform delivers does not tell them apart (RD4).\
`time` is the platform's own number, milliseconds from the page's time origin; capture compares and orders nothing by it.\
The sentence "A fact holds no time" becomes "A fact holds no clock reading, only the event's own `timeStamp`".

**IC6 -- reading the new fields.**\
For a pointer event, after the modifiers: for a `wheel` event `deltaX`, `deltaY` and `deltaZ`, each refusing the event unless a finite number, then `deltaMode`; then, for every event, `timeStamp`; then `target` and `preventDefault`, as before.\
For a `blur` event it reads `timeStamp`, `target` and `preventDefault` alone.\
For a key event it reads `timeStamp` after the modifiers.

**IC1 -- the slice, widened.**\
Of a `wheel` event, also `deltaX`, `deltaY`, `deltaZ` and `deltaMode`; of every event, `timeStamp`; and the surface's `addEventListener` is called with a third argument for `wheel` alone.\
It still reads no target's members and names no global, so a `visibilitychange`, fired at the document, is not listened for: a key source's `blur` precedes it when the page's tab is left (measured, with the window and with a focused element as key source); minimising a window or locking the screen is not measured.

**IC8 -- the claim, on the new facts.**\
Claiming a `wheel` fact prevents its scroll and Chrome's page zoom on Ctrl and the wheel (`defaultPrevented` measured true on a listener of the surface; the scroll and the zoom themselves not observed, I10 holding the scroll); claiming a `context-menu` fact prevents the menu (measured in headless Chrome on Linux, which delivers `contextmenu` as a `PointerEvent` with a `pointerId`, after the `pointerdown` and before the `pointerup`; on other systems the menu's event may follow the release, not measured); claiming a `blur` fact calls `preventDefault`, which changes nothing, the event not being cancelable.

**Fit criteria.**\
The rows "the wheel or a pinch as facts" and "the context menu suppressed" now read: listen for them (`listen`); a new row: "a touchpad's pinch told from Ctrl and the wheel -- not a reader of hardware: the platform delivers both alike"; "composition and lock state -- not yet" (N5, RD7).

**Edges.**\
Consumed by draw (H26.3) and `input-tester`; the tester uses every family, `time` and the deltas; its pinch is a `wheel` fact with `ctrlKey`.

| # | Invariant | Held by |
|---|---|---|
| I13 | `listen` judged as IC3's steps 7 to 9 say, from a table of cases: absent; empty; each name; an unknown name; a duplicate; an accessor; a sparse array; another realm's array; `'blur'` without `keys`; `focus` without `keys` beside it. | input-capture |
| I14 | With `listen` absent, exactly I2's listeners, arguments and calls; with each name listed, its listener added after IC4's in the table's order, `wheel`'s with `{ passive: false }` as third argument and the others with two; a throw at each new `addEventListener` takes back every listener; `close` removes all in reverse. | input-capture |
| I15 | A `wheel` event's fact holds its deltas under `Object.is`, `-0` among them, `deltaMode` `0`, `1` and `2` as given and `null` for any other value, `ctrlKey` as given; a non-finite delta refuses the event with no later field read. | input-capture |
| I16 | Every fact's `time` is its event's `timeStamp` under `Object.is` when a finite number, and `null` for `NaN`, an infinity, a string or an absent field; read in IC6's order, a throwing getter refusing the event. | input-capture |
| I17 | A `context-menu` fact is a pointer fact; a `blur` fact holds what IC5 gives it; `claim` on each calls `preventDefault` once; `hit` and `focus` are never asked for a `blur`. | input-capture |
| I10 | Extended, in headless Chrome: a claimed `wheel` over the surface of a scrollable page leaves it unscrolled; a pinch synthesized by `Input.synthesizePinchGesture` with `gestureSourceType` `mouse` arrives as `wheel` facts with `ctrlKey` true; a right press's `context-menu` fact, claimed, is seen `defaultPrevented` by a later listener; a second tab opened over the protocol makes one `blur` fact on a window key source; `time` never decreases across the run. | gate |

**Vocabulary.**\
The new words -- wheel, delta, menu, blur, time, listen -- are in neither list (`consumer-vocabulary.json`, the same in all four repositories), and the check passes as written.

**Does it break a `0.1.0` consumer?**\
No declaration that was valid is refused, and none that omits `listen` adds a listener or delivers a new type, so draw's adapter (N7) is untouched; every fact gains the five properties, after the old ones, so a consumer comparing whole facts sees them, and draw reads facts field by field (`app/src/capture.js:65-76`).\
The declarations type `deliver`'s fact by the families `listen` names, so a consumer listing none compiles as before (I11).

### 3.2 `input-binding` `0.2.0`

**Duty: unchanged.**\
A gesture's commit is the meaning of a release, so the release rule is binding's already (IB11); the keys held are the context a row needs when its meaning depends on another key held, which B406 registered as binding's own limit, and which the tester's roll-over row now meets.\
The session is "the state of one input surface's presses and gestures"; it becomes "of one input surface's presses, gestures and held keys".\
It still holds no application's situation, draws nothing, and reads no clock.

**IB1 -- binding reads one property more.**\
`code`, of a fact handed to `keyDown` or `keyUp`: a non-empty string.\
Every other property of any fact is still never read.

**IB10 -- the press records its button.**\
A press is `{ at, beyond, unmatched, button }`, `button` the safe integer the `pointerDown` fact gave; IB12's identity rules compare it with `===` like the other fields.\
The component's decision record's build choice that the press holds no button (`input-binding` D2, its Forms) is superseded by this rule.

**IB11 -- the release rule.**\
The `pointerUp` rows become:

| Operation | When | Phase due, and what changes |
|---|---|---|
| `pointerUp(fact)` | a gesture is live, and its declared `button` is `null`, or equals the fact's `button`, or equals the `button` of the press the release ends | `commit`: the gesture ends; the press ends with its trigger |
| `pointerUp(fact)` | otherwise | none: the press ends with its trigger, and a live gesture stays live |

A platform delivers a chord's presses and releases after the first as moves, so the release that ends a press names the last button released, which need not be the button that began it (measured in Chrome: `pointerdown` 0, `pointermove` 2, `pointermove` 0, `pointerup` 2).\
A gesture opened with no press keeps today's answer: a click of another button replaces the press, so its release ends a press that button began, and commits only a gesture declaring that button or `null`.\
Every sequence a browser produces in which the last release names the press's own button answers as `0.1.0` answered.

**IB14 -- held keys.**\
Three operations take what the key source delivered, and `session.state` gains `keys`, a frozen array of the codes held, in the order first pressed:

| Operation | Reads | What changes, and the outcome |
|---|---|---|
| `keyDown(fact)` | the fact; its `code` | a code not held is appended; the outcome `{ state, held }`, `held` true when it was held already -- a repeat, or a press whose release was not seen |
| `keyUp(fact)` | the fact; its `code` | a code held is removed; the outcome `{ state, held }`, `held` false when it was not held -- a key pressed while the page lacked focus |
| `keysLost()` | nothing | every code removed; the outcome `{ state, released }`, `released` the frozen array removed, in order |

The keys held never change the press or the gesture, and no key operation makes a phase due.\
A fact is read as IB2 reads a fact handed to a pointer operation: an object, holding `code` as an own data property, judged as read; a malformed fact throws the function's own `TypeError`.\
IB12's identity holds: `keys` is the very same array when no code changed, and the state the very same value when nothing did.\
`session.state` is `{ press, gesture, keys }`, in that order.

**Fit criteria.**\
"Several pointers told apart, or held keys tracked: not yet" becomes "several pointers told apart: not yet; held keys: the session keeps them (IB14), the application handing them to its rows' contexts".

**Edges.**\
Consumed by draw (H26.2) and `input-tester`, which uses IB14 to light keys and to match its roll-over row, and IB11's rule for every gesture.

| # | Invariant | Held by |
|---|---|---|
| I15 | Over generated sequences in which a press of button b begins, other buttons' presses and releases arrive as `pointerMove`, and the closing `pointerUp` names any button: a gesture declaring b commits with the press's trigger; a gesture opened with no press and declaring b does not commit on the release of a press of another button; every `0.1.0` sequence whose release names the press's own button gives `0.1.0`'s outcomes, against the `0.1.0` release run beside it. | input-binding |
| I16 | Over generated sequences of `keyDown`, `keyUp` and `keysLost`, `keys` equals a model written apart, in order; repeats change nothing; outcomes are as IB14 gives; identity as IB12 gives; no key operation changes the press or the gesture or makes a phase due; an empty code, a code not a string, and an accessor `code` are refused before the state is read. | input-binding |
| I10, I12, I13 | Unchanged, the generator of I10 adding chords, and the state's form `{ press, gesture, keys }`; the I13 corpus still passes, its press records gaining `button`. | input-binding |

**Vocabulary.**\
The new words -- keys, held, code, released -- are in neither list; no new name needs `keyboard`, which the tester's list refuses.

**Does it break a `0.1.0` consumer?**\
No operation's answer changes for a sequence a browser produces but the chorded release, which is the fix; the press and the state each gain a property, so a consumer comparing whole states sees them; draw reads `state.press?.beyond` (`app/src/input.js:1033`) and the gesture, and its parity fixture (`tests/fixtures/binding-parity.mjs`) compares the old press's answers with the session's, so the chord sequences are listed apart there (read, not run).

### 3.3 `vector-scene` `0.2.0`

**Duty: unchanged.**\
"Say which shape a platform element belongs to and where a point lies" already holds the item under a point, which `H26-1` named ("the shape under a point reported"); `itemAt` answers it by the platform's own hit test, never by geometry, as D4 ruled.

**VS1 -- the slice, widened by one member.**\
Of the root's document, also `elementsFromPoint`, read once as the scene opens, after `createElementNS`, the function read being the one called, with the document as receiver and the point's `x` and `y`; when it is absent or not a function the scene opens as before and `itemAt` refuses.\
Of its answer, judged by `Array.isArray`, the scene reads its elements by index from 0, stopping at the first element it made for an item it holds; it reads nothing of any element, only its identity.

**VS12 -- the shape at a point.**\
`itemAt(screen)` answers a frozen `{ layer, key, path }`, as `itemOf` answers it, for the first element the platform's `elementsFromPoint` answers at the screen point that the scene made for a shape of an item it holds, and `null` when there is none:
1. the point is read as VS2 rule 6 says, and refused unless its `x` and `y` are finite numbers;
2. the scene's state is judged, and a scene with no root, or whose document had no `elementsFromPoint`, refused with Errors' `Error`;
3. the document's `elementsFromPoint` is called, and an answer that is not an array refused;
4. its elements are walked from the first, every element the scene did not make passed over -- the root, a layer's element, a foreign layer's content, anything else on the page.

The screen point is in the units `input-capture`'s `screen` holds and `toScreen` answers, the viewport's.\
The platform leaves out of its answer every element whose `pointer-events` is `none`, so a layer an application declares with that attribute is looked through (measured in Chrome, under a captured pointer).\
Unlike `itemOf`, whose argument is the event's target, it answers under a captured pointer, whose every event targets the element holding the capture (measured).\
An error the platform throws propagates, and leaves the scene open.

**VS13 -- what the application may write on the root.**\
The root and its attributes are the application's: it may set the root's `viewBox`, its size, its `preserveAspectRatio`, its classes and its styles, before or after the scene opens; the scene never reads or writes them, and each conversion and `itemAt` follows the root as it stands when asked (VS10).\
A layer's element stays the scene's alone (VS4), so a layer's attributes are set only by its declaration.\
What `H26-1` names the viewport -- a view the scene holds, panned and zoomed, and a layer told the visible area and scale -- stays held for pan and zoom (B419); an application's own `viewBox` is no view of the scene's.

**Fit criteria.**\
"A shape found by geometry, with no platform" stays (B420's other half); a new row: "what lies under a captured pointer -- `itemAt`".

**Edges.**\
The sentence the experiment tripped on becomes: "The tester asks `itemOf` with `input-capture`'s target, and `itemAt` with the fact's `screen` while the pointer is taken."

| # | Invariant | Held by |
|---|---|---|
| I13 | With a recording document, `elementsFromPoint` read once as the scene opens and called once per `itemAt`, with the document as receiver and the point; the first element the scene made answers, with its path; `null` when none is; refused with no root, with no member, closed or failed, with a malformed point, and with an answer that is not an array; a root whose document has no `elementsFromPoint` opens and serves every `0.1.0` function unchanged. | vector-scene |
| I14 | In headless Chrome: with the pointer taken on a press, `itemAt` of each move's screen point answers the item under it while the target stays the capturing element; an item under a layer declared `pointer-events` `none` is answered through it; with no pointer taken, `itemAt(screen)` equals `itemOf(target)` for trusted presses over a grid of points; a `viewBox` the application sets after opening is followed by `toDrawing`, `toScreen` and `itemAt`. | gate |

**Vocabulary.**\
The new name, `itemAt`, splits into words in neither list.

**Does it break a `0.1.0` consumer?**\
Every root that opened opens, the member being optional; the scene gains `itemAt`, so its frozen object holds ten functions where it held nine, which only a consumer listing a scene's keys would see; draw calls no `itemAt` until H26.8, its picks reading targets by selector (D4), and its test harness's fake document, which has no `elementsFromPoint`, opens as before.

### 3.4 `snap-grid`: documents and gate, no release

The tester places every key and mouse button by `span` (SG8) on one square grid (SG1), as `0.1.0` answers it; ownership of a point is the application's data and `vector-scene`'s `itemAt` (G16), and the tester draws no grid, so `inView`'s scale (G15) asks nothing of it.\
Its changes are section 3.5's documents and B424's gate checks, which change no file a release ships, so no release is made (RD12).

### 3.5 What all four share

**Contracts freed of draw (G1).**\
Each `CONTRACT.md` states every rule on its own terms -- IB2 rule 5's `DOMPoint` explained by the platform's own getters, SG9 without the zone wrap, the invariants that name draw's corpus naming it as a test's provenance in the decision record instead -- and its Reference keeps one provenance line: the design of record and the rulings are kept in draw's records, `apnex/drawv2`.

**A consumer reference (G2, G9, G18, G19).**\
Each `README.md`: Install names the file each export maps to (`index.js` in the package's `dist` folder, and `snap-grid`'s `conformance.js` beside it, as each `package.json` `exports` gives); Use becomes the consumer reference, every function and every shape a consumer handles on one page, with the traps the experiment met stated where they bite, IB10's restart beside `becomeGesture` among them; the status line moves into a Status section near the end, and the gate's mission-kit checkout under Test alone; Documents links the guide.

**The guide (IT-D6).**\
One page, `GUIDE.md` in `apnex/input-tester`'s `docs` folder, the tester's code its worked example: opening the four together; the `hit` function asking `itemOf` and `itemAt`; the delivery switch over the fact families; the down, match, `pressMatched`, cancel, `pressMatched` routing and the drag-become without `from`; claiming wheels, the context menu and the releases of buttons 3 and 4 (N2); a table naming its own outcomes (G12); focus lost through `blur`, `keysLost` and `pointerLost`; the scale from two `toScreen` calls and a resize listener (G15); looks by class under a strict browser rule (N3); fakes for tests in Node.js; and trusted input over the DevTools protocol, a held button named on every move (G8).

**The gates (B424).**\
`input-binding` and `input-capture` take, in their `0.2.0`, `vector-scene`'s runtime check -- only the built-ins the build uses, a DOM member seen when named as a literal key of a reflection call -- and its release workflow's retried lookup of the draft; `input-binding` also the clock-and-chance forms `input-capture` and `vector-scene` already refuse (`Intl`, `Temporal`, `WeakRef`, `FinalizationRegistry`, `eval`, `Function`, a call through `constructor`; B414); `input-capture` also its source check's triple-slash fix and its Chrome teardown's removal of Chrome's temporary directory; `snap-grid`, which has no clock-and-chance check at all (`~/taceng/snap-grid/tools`), takes the runtime check, the clock-and-chance check and the release workflow on its main branch, with no release (RD13).

**The vocabulary lists.**\
Each repository's list named `gesture-tester` is renamed `input-tester`, its words `keyboard` and `keycap` kept, and joined by the tester's own nouns once its source exists.

---

## 4. What draw does with each release

Draw moves onto `input-capture` `0.2.0`, `input-binding` `0.2.0` and `vector-scene` `0.2.0` in H26.5, each after its release and lab first, as H26.1 to H26.4 moved it (RD14); `snap-grid` stays at `0.1.0`.

**Common to each move.**\
The dependency line and the lockfile; the import map regenerated, and the tests that list the installed components restated (`tests/import-map.test.js`, `tests/probe-sides.test.js`, `tests/import-map-browser.test.js`); the gesture corpus replayed byte-identical but for the cases each move lists; the pixel probe against production finding nothing; an independent verifier passing the move.

**`input-capture` `0.2.0`: B413 fixed.**\
Draw lists `'blur'` alone; its adapter routes a `blur` fact to Input, which drops what it derived from modifiers held -- the zone layer shown while Shift is held, and the zone selection H24.3 drops on Shift's release (B413) -- as a key-up of each would, the exact set fixed by draw's test at the move; it cancels no gesture, since a drag continues across a focus change today, and the move changes no behaviour it does not rule.\
B413 is first reproduced in a test of draw's -- Shift held, focus lost, Shift released elsewhere, the zone grid still shown -- and then held fixed; the fix is a change of behaviour, ruled with this design.\
Draw lists neither the wheel, which waits for pan and zoom (H26.6), nor the context menu, since its own listener on the host (B75, `app/src/capture.js`) covers the palette and the header beyond the surface; facts' `time` is read by nothing of draw's.

**`input-binding` `0.2.0`: B427 fixed.**\
Draw declares its link gesture for button 0 (`app/src/input.js:225`); IB11's rule commits it when a chord's last release names another button.\
B427 is first reproduced in a test of draw's -- a link drag, the right button pressed, the left released, the right released, the gesture left live under `0.1.0` -- and then held fixed; the fix is a change of behaviour, ruled with this design; the binding parity fixture lists the chord sequences apart, each with both answers.\
Draw calls none of IB14's operations: its rows read the modifiers a fact carries.

**`vector-scene` `0.2.0`.**\
Nothing of draw's behaviour changes: draw calls no `itemAt` until its picks read items (H26.8), and its harness's fake document opens as before.

**Backlog rows closed by the releases and the moves.**\
B411 (the wheel and the touchpad's pinch, the tester their first consumer); B412 (the context menu as a fact, the tester the application other than draw); B413 (draw); B427 (draw and every consumer); B424; B406's first half, held keys, its second half staying with B409; B420's captured-pointer half, its no-platform half staying; B419 stays, VS13 stating what it leaves to the application.

---

## 5. Decisions owed

Each with its options and their costs, and a recommendation, to be asked of the director one at a time.

| # | Decision | Options, and what each costs | Recommendation, and why |
|---|---|---|---|
| RD1 | How capture's new event families arrive | (a) each only when the capture lists it in `listen`; (b) always -- draw's adapter would throw on every wheel turn, right click and focus loss (N7; read from the code, not run), and every page gains a wheel listener it never asked for; (c) a component of their own -- a second listener component on one surface | (a): no `0.1.0` declaration changes behaviour, and a consumer opts into exactly what it handles |
| RD2 | The wheel listener's passivity | (a) `{ passive: false }`, so a claim works on any surface; (b) two arguments, a claim then working only on an element surface (N1), which the contract must say; (c) a declaration field choosing | (a): the claim must be decided before the platform scrolls, and a capture that lists the wheel has asked to decide it |
| RD3 | The wheel's units | (a) deltas and `deltaMode` as delivered; (b) converted to pixels by a line and page height the declaration gives -- a number capture computes from a guess, the platform giving no line height; (c) both | (a): capture computes no number (D1), and "exactly" is the tester's whole point; the guide shows a conversion where an application wants one |
| RD4 | A touchpad's pinch | (a) a `wheel` fact with `ctrlKey`, named nothing; (b) a `pinch` fact guessed from `ctrlKey` and fractional deltas -- a guess the platform does not support; (c) Safari's gesture events as well -- non-standard, not measured here | (a), with Safari's gesture events held, the trigger "a person on Safari reports a pinch shown as nothing" |
| RD5 | Where focus loss comes from | (a) `blur` on the key source; (b) `blur` and `visibilitychange` -- the latter fired at the document, which capture is not handed, and whose state capture cannot read without a target's member; (c) nothing, the application listening itself | (a): a key source's `blur` preceded the `visibilitychange` in the one leaving measured, a tab switch, and is the event that means no key-up will come to that source |
| RD6 | The event's time | (a) `time` on every fact; (b) on facts of a listed family alone; (c) held | (a): it is data the platform delivered, it costs one field, and the tester's hold duration and repeat rate need it, as binding's timed triggers will |
| RD7 | Lock state (Caps Lock, Num Lock) | (a) held; (b) carried, by calling the event's `getModifierState` -- a platform method run while reading, and a state the gate cannot set over the protocol | (a), the trigger "an application's row or a person needs lock state shown": lock state is no input, so coverage holds without it |
| RD8 | A gesture whose last release names another button (B427) | (a) commit on the release that ends a press of the gesture's button; (b) a `commitGesture` request -- each application then rebuilds the reasoning G6 says would ship as a bug; (c) commit on the move that releases the gesture's button -- binding would learn the platform's `buttons` bit order; (d) nothing, `button: null` documented -- the declared button then takes no press | (a): binding keeps deciding when each phase is due, from one more field it already read, and no browser sequence but the chord changes answer |
| RD9 | Who keeps the keys held | (a) `input-binding`'s session (IB14); (b) each application, the guide showing a dozen lines; (c) `input-capture` -- stateless by design (IC7) | (a): B406 registered it as binding's limit with the trigger the tester's roll-over row meets, and a stuck key after focus loss is a trap a shared part should hold once; weighed against binding's line "holds no application's situation", the keys held being input state, as the press is |
| RD10 | What lies under a captured pointer | (a) `vector-scene`'s `itemAt`, by the platform's `elementsFromPoint`; (b) a geometric query in the scene -- a second hit test that disagrees with the platform's at every stroke's edge (D4); (c) each application's own geometry, as the experiment did | (a): exact as the platform hit-tests, one member of the slice, optional so no `0.1.0` root is refused |
| RD11 | The root's attributes | (a) stated as the application's (VS13); (b) a view in the scene now -- H26.6's question answered without its consumer; (c) left silent, as the experiment found it | (a): a sentence, and nothing H26.6 needs is decided |
| RD12 | `snap-grid` | (a) no release, its documents and gate on its main branch; (b) a `0.1.1` patch carrying them, so the package's own `README.md` is the new one | (a): nothing a release ships changes; the next release, when a change needs one, carries them |
| RD13 | B424 | (a) folded into each `0.2.0`, and into `snap-grid`'s main branch; (b) a release of its own later | (a): B424's trigger is the next release, and these are it |
| RD14 | Draw's move | (a) in H26.5, each component after its release, lab first, B413 and B427 fixed and ruled; (b) held until H26.8 -- two releases of each component in use at once, and draw keeping both defects; (c) after the tester ships | (a): a second consumer moving at once proves each release keeps `0.1.0`'s behaviour for everything draw does not opt into |
| RD15 | Draw's references in the contracts (G1) | (a) rules on their own terms, one provenance line; (b) each component's design of record moved into its own repository, draw keeping the rulings alone -- the programme's designs then split across five repositories; (c) as published | (a): a newcomer reads each contract alone, and `H26-12` keeps the programme's records in draw |
| RD16 | The consumer reference (G2) | (a) each `README.md`'s Use section; (b) a `USE.md` beside it -- a third document to find; (c) generated from the TypeScript declarations -- shapes without the traps | (a): the first page a consumer opens |
| RD17 | Where the guide lives | as IT-D6, decided once there | `GUIDE.md` in `apnex/input-tester`'s `docs` folder, beside its worked example, linked from each `README.md` |

**Registered when this is ratified,** each with its revival trigger (RU3): a shared trusted-input driver (G8); a shared routing part (G10); binding's timed triggers (G11); a scale the scene answers, with the view (G15, B419); a shared keyboard plan (G17); Safari's gesture events (RD4); lock state (RD7); composition facts (N5).

---

## 6. Axiom alignment audit (M7)

**Identity.**\
The components' next releases at revision 1, read against draw's `19e5dd5`, each component's `v0.1.0` and mission-kit at `e33c850`, audited in three layers: the components as libraries; their releases, unchanged in form; and draw and `input-tester` as consumers.

**Verdict.**\
Revision 1 is `pass, with guardrails`, by its author; its standing is to be confirmed by a reading (M1).

| Layer | Axiom | Weight | How the design stands |
|---|---|---|---|
| library | `A3` | load-bearing | Each duty unchanged, each change inside it (sections 3.1 to 3.3); each new surface earned by a consumer outside draw, the tester, and opt-in where draw has not asked for it (RD1); nothing a component lacked is left for the tester to work around. |
| library | `A1` | supporting | `input-capture` stays stateless between events; the session's keys held are in its state, frozen and readable whole (IB14); the scene's state unchanged. |
| library | `A8` | load-bearing | Each new rule has invariants able to fail, the chord, the wheel, the context menu, focus loss and the captured pointer each driven with trusted input in Chrome in the component's own gate (I10, I14). |
| consumer | `A5` | load-bearing | Draw's pixel probe against production finds nothing at each move; draw and the tester run the same releases. |
| consumer | `A9` | supporting | Each draw move lab first; B413 and B427 reproduced before they are fixed. |
| all | `A4` | supporting | Each gap with one disposition and every deferral a row with its trigger; the experiment's gap log is kept verbatim beside this design (`TESTER-EXPERIMENT-GAPS.md`), its app and proof in the run folder. |
| all | `A14` | load-bearing | Nineteen gaps and seven more become part changes, documents and the guide, and the tester's vision forbids it keeping a workaround. |
| all | `A2`, `A6`, `A7`, `A10`, `A11`, `A12`, `A13` | not materially implicated | No trait brings `A2`, `A11` or `A12` into force; no seam between agents changes; `A13` is served by section 5's decisions, each with a recommendation. |

**Tensions, and how they resolve.**
- `input-binding` holding keys against its line "holds no application's situation": the keys held are input state, as the press is, and B406 named them binding's (RD9); the director may rule otherwise, the guide then carrying the dozen lines.
- `input-capture` listening for three events more against IC4's "listens for nothing else": still nothing else unless the capture lists it (RD1).
- Both slices widened: capture reads four wheel fields and every event's `timeStamp` and passes a third argument for one listener; the scene reads one document member and the platform's answer's identities, never an element's members.
- A fifth shared part for the routing against `A3`'s earned exposure: held until a second application's routing is shown alike (G10, IT-D3).

**Guardrails for the build.**
- GR1: a `0.1.0` declaration or root opens and behaves as under `0.1.0` in every listener, call and fact value, held by I14 of `input-capture`, I15 of `input-binding` and I13 of `vector-scene`.
- GR2: each new rule's tests fail against a planted mutant of it, recorded in the component's decision record.
- GR3: the vocabulary check passes with the renamed list on each repository.
- GR4: no contract names a draw file but its provenance line.
- GR5: B424's checks pass on `input-binding`, `input-capture` and `snap-grid`.
- GR6: draw's moves keep the gesture corpus byte-identical but for the B413 and B427 cases, each listed with both answers.

**Closeout hooks.**\
Each release's run-verifier re-checks GR1 to GR3 and its section's invariants; draw's move verifier re-checks GR6 and the probe; the tester's first release is the proof that no workaround remains.

---

## 7. Reviews

H26-3 requires a multi-family reading through context-lab's review panel (M1) before ratification; none has been made of this design.\
Each reading is recorded here as it is made: its readers, its counts, and one disposition per finding with its reason.

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
| binding: IB14 held keys | G5 | which keys are held, kept once, and a roll-over row | fidelity, proof of reuse |
| scene: `itemAt` | G7, G16 | the key under a captured drag, and its drop | fidelity, proof of reuse |
| scene: VS13 | G14 | the picture's `viewBox` set by the tester, with nothing guessed | teachability |
| all: contracts freed of draw, consumer references, files named, status moved | G1, G2, G18, G19 | a newcomer reading the parts alone, with no word of draw | teachability |
| the guide | G8, G9, G10, G12, G15, N2, N3 | the routing, the traps and the browser's surprises in one page, the tester the example | teachability |
| gates and lists | B424 | four parts held to one standard, the tester named in their lists | proof of reuse |
