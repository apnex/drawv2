# H26.0, part 2 -- `input-binding`

The second piece of H26's design of record (`dev/DECISIONS.md` H26-3, as H26-5 amended it).\
It designs `input-binding`, the component that decides what each input means: the one declared row it resolves to in its context, and the phase of a gesture it makes due.\
It builds on part 1 (`SNAP-GRID.md`), whose section 7 -- the repository, the checks, the gate, the release, the import map -- is settled and built, and states only where this piece differs.

**Standing:** a design under review, revision 5, drafted 2026-10-20 after its fourth reading, confirming revision 4 (section 10.4); revisions 1 to 4 were `5b4997b`, `e131855`, `355a25d` and `d275205`; the code read is `d275205`'s, identical in code to `5b4997b` and `6078018`; ratified by the director on 2026-10-20, all fourteen decisions of section 8 as recommended and appendix A as `input-binding`'s vision (`dev/DECISIONS.md` H26-6); built in H26.2.

---

## 1. What this decides, and what it does not

It decides:
- `input-binding`'s one duty, its vocabulary and its contract, precisely enough that an agent other than its author could build it from section 3 alone;
- what H26-1's "a gesture's start, update, commit and cancel run" means: binding decides when each phase of a gesture is due and reports it, and the application runs its own code for the phase -- the reading the director confirmed on 2026-10-20, to be recorded as a ruling at ratification (D6);
- which inputs and declarations make each phase due, and which phases the application requests for reasons binding cannot see (IB11);
- the boundary with `input-capture`: what binding reads of an input fact, and what it gives back (IB1, D1);
- the invariants and tests that hold it, and the acceptance tests for draw's move onto it (H26.2), with every site in draw that the move touches (appendix B);
- which part of draw imports it, and what of draw's rules, gestures and input paths stays draw's (section 5, D14).

It does not decide:
- `input-capture`'s contract -- the whole shape of a fact, the hit test, the coordinates, how a claim and a pointer capture reach the platform -- which is H26.3's piece; this one names only what capture must keep producing and routing for binding and for draw (section 2.4);
- `vector-scene`, or what lies under a point (H26.4), and the gesture tester's scope (H26.5's piece);
- the editing gestures -- marquee, handles, drag-to-move with a preview -- whose bodies stay draw's (B389);
- pan and zoom (H26.6), including whether a press's travel is then measured on screen rather than in the drawing (D7);
- a timed trigger (a hold, or a double click decided by time rather than by the platform), held keys beyond the modifiers a fact carries, or several pointers told apart -- none is in draw, and each waits for a consumer (section 8);
- precedence between rows (B262 stays held), bindings edited at run time (DG3), or the context panel (B265);
- the palette's own tile drag, which stays draw's in H26.2 (D14);
- the defects the inventory found (section 6.3): each is kept by H26.2 and registered for its own ruling, and where moving a phase's decision into binding changes what one does, the change is named there.

---

## 2. What draw does with input today

Read from the code at `5b4997b` and rechecked at `355a25d`, identical in code; appendix B lists every site, one row each, with what H26.2 does with it.

### 2.1 The rule matcher

`kernel/input-rules.mjs` is the neutral core of the Rules system (`dev/RULES.md` section 11), 79 lines, importing nothing:
- **a row** is `id`, `on(input)`, optional `when(situation)`, `run`, and the flags `mutates`, `duringHelp`, `duringGesture`, `whileReadOnly` and `prevent` (`:10-22`);
- **`composeRules(...tenants)`** joins tenants' rows in order into one array, each row copied with the defaults `mutates: true` and the other three guard flags `false`, and stamped with its tenant's `owner`; an id taken twice throws, naming both owners (`:40-53`);
- **the guards** refuse a row when it mutates and writes are refused, when it is admitted only while writes are refused and they are not, when help is open and it does not say `duringHelp`, or when a gesture is live and it does not say `duringGesture` (`:56-57`);
- **matching** filters the admitted rows whose `on` holds -- the bound rows -- and then the bound rows whose `when` holds or is absent -- the hits (`:60-63`);
- **`resolveInput`** answers the hit when there is exactly one and `null` otherwise, and `claimed` when some bound row has `prevent !== false`, whatever its `when` says (`:66-69`);
- **`overlapsIn`** enumerates guard states, then situations, then inputs, and lists every combination with two or more hits (`:72-79`); it is the gate's instrument for Q3, consumed by tests alone (`tools/scan-dead.mjs:79`).

Two rows matching are never resolved by position: nothing runs, and the gate fails before it ships (Q3, ruled 2026-09-30; DG2 held it strict, B262 holds overrides).

### 2.2 The tables draw composes

Sixteen tables, 83 rows, every one composed by `composeRules` and resolved by `resolveInput`.\
What each hands its rows as the second argument -- the context a `when` reads -- differs, and the matcher never looks inside it.

| Table | Rows, by tenant | Context handed to `when` | Guard state handed | Composed | Resolved |
|---|---|---|---|---|---|
| keys | 24 product (`app/src/keymap.js:70-135`), 9 network (`network/keys.mjs:38-53`, `network/link-keys.mjs:57-90`), 4 of the parts (`zones/zone-keys.mjs:21-39`, `groups/group-keys.mjs:20-40`, `devices/device-keys.mjs:13-23`) | the situation, with the gesture and its step | `readOnly`, `helpOpen`, `gesturing` | `app/src/input.js:376-378` | `:1314-1318` |
| presses | 10 product (`app/src/recognize.js:97-120`), 4 of the parts (`zones/zone-gestures.mjs:63-100`, `devices/device-gestures.mjs:32-50`, `network/link-handles.mjs:54-61`) | the situation | `readOnly` | `:444` | `:609` |
| double clicks | 1 (`app/src/recognize.js:127-129`) | the situation | `readOnly` | `:445` | `:1274` |
| key releases | 2 (`app/src/keymap.js:142-145`) | the situation, with the gesture | `readOnly`, `helpOpen`, `gesturing` | `:446` | `:1556-1558` |
| run mode | 4 on the product page (`engine/spawn-runs.mjs:38-59`, `devices/device-panels.mjs:12-19`, through `app/src/run-mode.js`), none in the lab | the situation, with the press's target | `readOnly` | `:449` | `:662` |
| five release tables | 8, 4, 1, 1, 1 (`app/src/releases.js:47-99`) | the facts the gesture hands over | `readOnly` | `:451-453` | `:1086`, called at `:121-125`, `:136-137`, `:261-267`, `:325` |
| two box releases | 1 each (`zones/zone-gestures.mjs:72`, `devices/device-gestures.mjs:42-46`) | the box's facts | `readOnly` | `:455-458` | `:300` |
| two handle releases | 1 each (`zones/zone-gestures.mjs:89`, `network/link-handles.mjs:50`) | the handle's facts | `readOnly` | `:469` | `:163` |
| the drag grammar | 3 and 3 (`network/grammar.mjs:41-71`) | `null` | none | `network/grammar.mjs:75-76` | `:79` |

Every one of the 83 rows holds an `id` that is a string, an `on` that is a function, a `when` that is a function where present, and boolean flags where present, and every `on`, `when` and run that is a function is an arrow function (measured over the composed rows); each predicate reads its argument and values its tenant fixed when it built its rows, and nothing else (read from the code).\
Their other properties are draw's payload, which the matcher passes back untouched: `run`, `gesture`, `box`, `input`, `doc`, `said`, `context`.\
A press row that opens a gesture names it in `gesture`; every other row names an action in `run`.

Draw iterates a composed table in one product site, `bindings()` (`app/src/input.js:1079-1083`), which hands the help overlay the key, press, double-click and run-mode tables and the link, marquee and Ctrl+click release tables concatenated, each as the array of its rows (`app/src/help.js:69-78` reads `input`, `said`, `doc`, `context`, `run` and `gesture` from each); and two tests read a composed table as an array (`tests/input-rules.test.js:22`, `tests/input.test.js:979,987`).

### 2.3 The gesture lifecycle

`app/src/input.js` (1,607 lines) holds the lifecycle and draw's editor together:
- **the slot** -- `mode`, the live gesture's name or `null`, and `ctx`, its working data (`:502-503`); `isGesturing()` is a live gesture other than `pending` or `clone-pending` (`:560-562`), which is both the guard state `gesturing` and the sync layer's reason to defer inbound changes (`app/src/sync.js:72-84`);
- **the bodies** -- `GESTURES`, eight entries, `move`, `clone`, `pending`, `clone-pending`, `handle`, `link`, `box` and `marquee`, each with some of `start`, `update`, `commit`, `cancel` and, for `link` alone, `ignoreUp`, which refuses any release but the left button's (`:77-333`, `:209`).

The lifecycle's decisions, in the order the code makes them:
1. **A press** (`:587-620`) folds the input event into the input state, which replaces the press whatever its button (`:589`); in run mode it resolves run mode's table instead and stops (`:592`); a live `link` takes a left press, which then means nothing more (`:595`); otherwise it closes the label editor and the hand (`:597-598`), resolves the press table (`:609`), and stops if no row matches (`:610`); a row that matches cancels any live gesture first (`:612`), then takes the pointer (`:614`) and runs the row's action (`:616`) or sets `mode` to the row's gesture and runs its start body (`:618-619`), so a start body whose answer is `null` leaves the gesture live with an empty context (`:619`).
2. **A move** folds into the input state and runs the live gesture's update body, whatever the press (`:945-960`); `pending` and `clone-pending` ask on each move whether the press is a drag (`escalate`, `:985-995`) and, if their press-to-drag row matches, run its action, which becomes `move` or `clone` or drops the gesture with no body run when there is nothing to move or clone (`:698`, `:712-716`, `:719`).
3. **A release** computes the trigger from the press (`:1043`); if a gesture is live and does not refuse the release (`:1059-1061`), it clears the slot, then runs the commit body, so a commit may start a chained gesture (`:1062-1069`; `dev/INPUT.md` section 7, I-IN1); the press is ended in a `finally` (`:1045`).
4. **A pointer cancel** ends the press and runs the cancel body while the slot still names the gesture, then clears it and runs the teardown, `onGestureEnd` and `afterShiftUpPress` (`:1240-1250`); none of these is in a `finally`, so a cancel body that throws leaves the slot naming the gesture and the rest unrun.
5. **The application's own cancels** run the same `cancelDrag` without ending the press: Escape, after help (`:1374-1383`), a lock (`:577`), a document replaced (`:525`), a double click that edits (`:1286`), the sync layer's snapshot (`app/src/sync.js:82`); and a press a row matches runs it with the press's own event (`:612`), so its `afterShiftUpPress` runs before the row's start body (`:1249`, `:1591-1595`).
6. **A chain** sets `mode` to `link` with no press of its own (`chainFrom`, `:1193-1199`) -- after a commit that chains, when the slot is already clear (`:1150-1154`), or replacing the live `link` when a digit places a node mid-drag (`:1447-1484`) -- and restarts a press still held from where the chain began (`app/src/input-state.js:47`).
7. **Keys during a gesture** change its working data and its preview with no pointer move, each an action of a key row admitted during a gesture (`duringGesture`): Shift redraws a live `move` or `clone` with the axis lock on or off (`onShiftDown`, `onShiftUp`, `:1342-1350`, `:1563-1578`), and the release commits the frame last drawn (`:82-84`, `:94-96`); `w` and the network's stop keys add a stop to a live `link` (`onWaypointKey`, `:1409-1412`; `addStop`, `:877-905`, reached by plugins through the host, `:398`); a digit commits a segment and chains on through a node it places (`:1420-1430`, `:1447-1484`); Escape cancels (item 5).
A harness run of a right drag to (120, 60) then Shift, released with no move between, commits the node at (120, 0), and Shift released again before the release commits it at (120, 60) (`~/taceng/drawv2-eval-runs/h26-readings/ib/reading-2/prototypes/shift-no-move.mjs`).

The input state (`app/src/input-state.js`, 50 lines) is one plain value folded by a pure reducer (`:38-50`, its `type` switch at `:39`): the pointer's position, which a `leave` forgets (`:44`); the armed `w` and the chained flag -- draw's editor notes, written by `placeWaypoint` and `chainFrom` (`app/src/input.js:845`, `:1195`); and the press, where it began and the furthest it has travelled.\
The triggers (`app/src/triggers.js`, 23 lines) read the press: a drag once it has travelled more than 4 canvas units, a click otherwise (`:17-23`).

Draw's tests hold the text of `app/src/input.js` as well as its behaviour:
- three slice it and test the slice -- by method, `startMove`, `startClone` and the release actions (`tests/releases.test.js:120-137`) and `addStop` (`tests/span.test.js:930-940`), and by `GESTURES` slot, from each `commit:` to the next `cancel:` or `update:` (`tests/releases.test.js:139-147`) and the whole `handle` slot (`tests/canvas-gestures.test.js:125-126`);
- two count words in it (`tests/canvas-names-no-plugin.test.js:48`, `tests/bare-anchor.test.js:104`), and one refuses any DOM read in it (`tests/input-capture.test.js:96-97`);
- others refuse names it once held, which H26.2 adds none of;
- so `GESTURES` stays one object literal of slots in today's order, and the methods those slices name stay methods, each named as today (appendix B).

### 2.4 What reaches the input layers, and how

`app/src/capture.js` owns the canvas's listeners and turns each pointer, double-click and key event into an input event, plain data (`:56-67`); `app/src/pick.js:53-82` and `app/src/painter.js:29-32` read the event capture hands them, for the hit and the coordinates.\
These are its fields, and what reads each.

| Field | Produced | Read by |
|---|---|---|
| `type` | `down`, `move`, `up`, `cancel`, `over`, `out`, `double`, `key-down`, `key-up` (`:105-112`) | the input state (`app/src/input-state.js:39`); the release and double-click rows (`app/src/releases.js:34-35`, `app/src/recognize.js:128`, the plugins' box and handle releases); `cancelDrag` (`app/src/input.js:1241`) |
| `button` | `evt.button ?? 0` | the press rows; `pending`'s start (`app/src/input.js:129`); `link`'s `ignoreUp` (`:209`); the chain's taken press (`:595`) |
| `key`, `repeat` | `evt.key ?? null`, `!!evt.repeat` | the key rows and key releases; the digit and arrow actions (`:1423`, `:1509`) |
| `shiftKey`, `ctrlKey`, `altKey`, `metaKey` | each `!!` | the key and press rows; Shift's layer and ortho (`:127`, `:79`, `:93`); a double click's modifier (`:1284`) |
| `at` | pointer types only, drawing coordinates (`app/src/painter.js:29-32`) | the press's travel (`app/src/input-state.js:40-42`); every gesture body and action placing at the pointer |
| `on` | pointer types only, the hit: `{ kind, id }`, with `handle: true` on a handle and `mark: true` on a plugin's mark (`app/src/pick.js:53-82`) | the press rows, through the hit facts (`app/src/recognize.js:64-86`); the idle and hover affordances |
| `region` | `down` only, run mode's controls under the press (`:38-53`) | run mode's rows; `runModePress` (`app/src/input.js:662`) |
| `onControl` | `key-down` only | the Tab action (`:1369`) |
| `claimed`, `capture` | `false`; written back by Input and the actions, and acted on by capture after delivery, in a `finally`: `preventDefault` and `setPointerCapture` (`:97-103`) | capture |

Input also writes `trigger` onto a release event (`app/src/input.js:1043`), which the link and marquee commits read (`:263`, `:325`).

**The routes,** which matter as much as the fields:
- `pointerleave` reaches Input as `leave()` with no event (`app/src/capture.js:81`), which clears the readout's cursor and the hand and folds `{ type: 'leave' }` into the input state (`app/src/input.js:548-552`);
- a key-down whose target is an `INPUT`, `TEXTAREA` or `SELECT` never reaches Input, while every key-up does (`app/src/capture.js:70`, `:111-112`) -- so typing in a field still delivers a Shift release to the key-release rows;
- the context menu is suppressed everywhere but a field and is never a fact (`:93`, `:119-121`);
- Pointer Events deliver a second mouse button pressed while one is held as a `pointermove`, not a `pointerdown`, so one mouse makes one press; a second touch contact or a pen is a pointer of its own, with its own `pointerdown` and, for touch, `button` 0, and the canvas receives touch as pointer events (`touch-action: none`, `app/canvas.css:9`);
- facts keep no `pointerId` or `pointerType`, so presses from several pointers share one press (6.3);
- capture listens for no `wheel`, `blur`, `focus`, `lostpointercapture` or touch event;
- Escape means, in order, close the help overlay, cancel the gesture, drop the tool, drop the hand, clear the selection (`app/src/input.js:1374-1383`), so with help open a live gesture survives the first Escape.

**Outside capture and Input:**
- the palette's tiles (`app/src/palette.js`) have their own press, pointer capture, move and release, and no `pointercancel` listener (`:104`, `:128-174`), deciding a click by their own rule -- a release less than 5 screen pixels from the press, `<`, measured where it lands, and only off the canvas (`:29`, `:167-169`) -- and their own Escape, a `keydown` listener on the window registered before capture's, which cancels a tile drag and stops the event (`:46-52`; `app/src/main.js:95-97`);
- the label editor's field handles its own Enter, Escape and Tab, stopping each key-down, commits on blur and closes on a resize (`app/src/labeledit.js:80-97`, `:148-158`);
- the page's chrome -- the header's menus and buttons, the help overlay's dismissal -- listens for itself (`app/src/main.js`).

What H26.3 must keep producing, for binding and for draw: the fields above; `at` in drawing coordinates and `button` on every pointer fact; `leave`; the refusal of key-downs in fields with key-ups delivered; the context menu's suppression; the claim and the pointer capture acted on after delivery; and Pointer Events' own sequence, never a synthetic press for a second mouse button.\
What stays draw's policy: Escape's order, the label editor's keys, the palette's tile drag, and the chrome.

### 2.5 Time and the threshold

Nothing in the input layers reads a clock.\
A double click is the browser's `dblclick` event (`app/src/capture.js:88`), and the input state's header says time enters only with the first timed trigger (`app/src/input-state.js:30-31`).\
The one `Date.now` in `app/src/input.js` is the default of the agreed instant handed to the situation and to the simulation's rows (`:494`, `:643`, `:420`), which no row's predicate reads.

The click threshold is one number, 4, in canvas units -- the drawing's coordinates -- ruled by the director on 2026-09-30 (`dev/design/input/GESTURE-SYSTEM.md` section 13, stage 3):
- the press records the furthest `Math.hypot` distance any move has taken it from where it began (`app/src/input-state.js:36`, `:42`);
- a press is a drag when that distance is strictly greater than 4 (`app/src/triggers.js:20`), so a travel of exactly 4 is a click;
- only moves count: a release's own position is never measured (`app/src/input-state.js:43`);
- a second press of any pointer or button replaces the press, and any release or pointer cancel ends it (`:40`, `:43`);
- a chain restarts a press still held from where the chain began (`:47`).

The link release reuses the number differently -- whether the release landed within 4 units of the drag's start, `<=`, with `dist` (`app/src/input.js:263`, `app/src/snap.js:45`) -- which is draw's policy, not the trigger.

### 2.6 What is mechanism, measured again

B274 measured five modules free of the drawing app on 2026-10-01, and four of them on 2026-10-12.\
Measured again with part 1's vocabulary check's match (split at case changes, underscores, hyphens and digits, plurals included), comments removed:

| Module | Lines | Imports | DOM or clock | Draw's words in code |
|---|---|---|---|---|
| `kernel/input-rules.mjs` | 79 | none | none | 0 |
| `app/src/input-state.js` | 50 | none | none | 0 -- but its armed `w` and chained flag are draw's editor notes |
| `app/src/triggers.js` | 23 | none | none | 0 |
| `app/src/recognize.js` | 129 | `model/anchors.mjs` | none | 14 |
| `app/src/releases.js` | 99 | none | none | 24 |
| `app/src/capture.js` | 127 | draw's hit test and painter | 21 DOM reads | 0 |
| `engine/situation.mjs` | 160 | `model/model.mjs` | none | 7 |
| `app/src/input.js` | 1,607 | 17 modules | one `Date.now` | 107 |

So the matcher, the press and the threshold are mechanism free of draw's content; the slot that holds the live gesture, and the rules that decide when it starts, commits and is cancelled, are mechanism too, entangled in `app/src/input.js` with draw's editor; the tables, the situation, the armed `w`, the chain and the bodies are draw's.\
A word count is not a proof of neutrality (P4): the armed `w` holds no word of draw's and is draw's policy.

Four facts shape the design:
- the matcher never reads a fact or a context, and the lifecycle reads two properties of a fact, `at` and `button`;
- every predicate draw declares is an arrow function of its argument and of values fixed when its rows were built, so rows can be handed over as they are;
- the press and the live gesture change independently: a press can be held with no gesture (a press no row matched), and a gesture can be live with no press (a chain after a Shift release);
- nothing reads a clock.

---

## 3. `input-binding`

### 3.1 Duty

Decide what each input means in its context: the one declared row it matches, and the phase it makes due for the gesture in progress.

That is the whole duty.\
A gesture's phase is what an input means over time -- a move during a gesture means update, the release it accepts means commit -- so the two capabilities serve one concern (D11).\
H26-1's "a gesture's start, update, commit and cancel run" is read as the director confirmed on 2026-10-20, to be recorded as a ruling at ratification: binding decides when each phase of a gesture is due and reports it; the application runs its own code for the phase (D6).\
It does not also listen to a platform's events, find what lies under a pointer, convert coordinates, draw a preview, perform an action, hold an application's situation, or read a clock -- each of those is the consumer's or another component's.

### 3.2 Vocabulary

These are the only nouns `input-binding`'s source uses for what it handles.

| Word | Meaning |
|---|---|
| input | something a person did -- a key pressed, a pointer moved -- as the application hands it over |
| fact | the value an application hands binding for one input; binding reads only its `at` and its `button` (IB1) |
| point | a non-null value whose `typeof` is `'object'`, so not a function, of any prototype, with finite number properties `x` and `y` |
| button | an integer naming a pointer's button, compared only for equality |
| row | a declared meaning: a record with an `id`, a predicate `on` over facts, an optional predicate `when` over contexts, flags, the gesture it opens if any, and the application's own payload |
| predicate | a pure function an application supplies, whose truthy answer means yes |
| tenant | a source of rows, named by its `owner`; tenants are composed in order |
| table | the rows of several tenants, composed once, in table order |
| context | what is true when an input arrives, as the application describes it; binding hands it to `when` unread |
| guard | a declared rule refusing rows by a state and a row's flag (IB5) |
| guard state | a record of named boolean states handed with an input |
| claim | a row's declaration that the application owns an input its `on` matches, so the platform's default action is suppressed |
| opens | the gesture a row names for a press it matches to start |
| trace | for every row of a table, in order, how far it matched one input |
| hit | a row admitted by every guard whose `on` and `when` both hold |
| match | the one hit, when there is exactly one |
| overlap | a combination of fact, context and guard state in which two or more rows hit |
| session | the state of one input surface's presses and gestures between calls, opened and owned by the application |
| press | a pointer button held: where it went down, whether it has travelled beyond the threshold, and whether it is still unmatched -- not yet handed to `pressMatched`, which a press no row matches never is |
| taken | a press the live gesture declares as its own, which then means nothing more |
| threshold | the distance a press may travel and still be a click, in the units of the facts' `at` |
| trigger | what a release is: `click` when its press never went beyond the threshold, `drop` otherwise |
| gesture | a named, declared kind of continuous interaction an application runs |
| live | the one gesture started and not yet ended |
| engaged | a gesture's declaration that, while live, it counts as a gesture in progress for the application's guards |
| phase | a step of a gesture's life binding makes due: start, update, become, commit or cancel |

### 3.3 Contract

One capability per row.\
None requires another component's capability.\
The table keeps nothing between calls; the session keeps its state between calls for as long as its application keeps it, and so is stateful in T1's sense (section 9).

| Capability | Relation | What a consumer can depend on |
|---|---|---|
| `declared-binding-table` | provides | Tenants' rows, guards, a claim and the field naming what a row opens, declared as data, are composed into a table, or refused with every problem the declaration has, each naming where it lies (IB3, IB4). |
| `one-binding-match` | provides | The one row an input means in its context under a guard state, or none when none or several do -- never chosen by position -- and whether the input is claimed (IB5, IB7). |
| `binding-match-trace` | provides | For every row, in table order, how far it matched an input: refused by a guard, unbound, unmet, or a hit (IB6). |
| `binding-overlaps` | provides | Every combination, among the facts, contexts and guard states given, in which two or more rows hit (IB8). |
| `declared-gesture-session` | provides | A session opened from a threshold and the gestures an application declares, or refused with every problem (IB9). |
| `press-travel` | provides | Whether a press has travelled beyond the threshold, decided exactly from its moves, and whether its release is a click or a drop (IB10). |
| `live-gesture` | provides | The one live gesture, and which phase each input makes due for it -- start, update, commit or cancel -- by the declared gestures and the inputs alone, with the phases the application requests checked against the same rules (IB11, IB12). |

**Errors.**\
Every function reads and checks its arguments in the order IB2 gives, and throws at the first that is malformed, before it reads the session's state or calls a predicate.\
`composeBindingTable` and `openGestureSession` never throw, for any argument: they refuse with problems.\
A malformed argument to any other function throws a `TypeError` whose message begins with the function's name: a guard state not of IB5's form; `facts`, `contexts` or `guardStates` given to `findOverlaps` not of IB8's form; a fact handed to a pointer operation not of IB1's form; a match or a gesture argument not of IB11's form, or naming a gesture the session does not declare.\
That beginning is the contract; the rest of a message is prose, which no consumer reads and no test pins, as in `snap-grid`, while which refusal a malformed argument meets first is fixed by IB2's order.\
An error a getter or a `Proxy` trap throws while an argument is read is rethrown as the function's own `TypeError`, its message beginning with the function's name.\
An operation the session's state does not allow -- IB11's refusals -- throws an `Error`, the base constructor, whose message begins with the operation's name, and changes nothing; a malformed argument is refused before the state is consulted, so it throws the `TypeError`.\
An exception a row's predicate throws propagates unchanged, and the call that met it returns nothing and leaves nothing behind.

**What is returned.**\
Every value binding returns -- an open result, a problem list, a table's `rows`, `guards`, `claim` and `opens`, a trace, a match, an overlap list, a session's declaration, its state, an outcome -- is made afresh by the call that first returns it and frozen to its depth, down to but not into the caller's own values it holds.\
Those values -- a row, a fact, a context, a guard state, handed in and handed back -- are the caller's own, returned by reference and never copied, frozen or changed.\
Every record binding makes holds its properties in the order its form is written in this section, and nothing else.

**IB1 -- The fact.**\
A fact is any value the application hands binding for one input.\
Binding reads two properties of a fact, and only of a fact handed to a pointer operation:
- `at`, of a fact handed to `pointerDown` or `pointerMove`: a point, in the units the session's threshold is stated in;
- `button`, of a fact handed to `pointerDown` or `pointerUp`: a safe integer, compared only for equality with a gesture's declared button (IB11).

There the fact must be a non-null value whose `typeof` is `'object'`, so not a function, of any prototype, holding each property the operation reads as an own data property, and is read as IB2 says.\
Every other fact, every fact handed to a table, and every other property of any fact, binding passes unread and unchanged to the predicates the application declared, and never keeps, copies, freezes or writes.\
So the shape of a fact -- its kind, its key, its modifiers, what lies under it -- is `input-capture`'s contract and the application's rows', never binding's (D1); section 2.4 lists the fields and routes draw depends on, which capture's design inherits as its starting obligation.\
Binding gives one thing back for capture to act on, `claimed` (IB7).

**IB2 -- How arguments are read.**\
These rules, `snap-grid`'s as settled at build (`SNAP-GRID.md` section 11) where they fit, decide every reading the contract makes:
1. A plain object is a value whose prototype is `Object.prototype` or `null`; an array is a value for which `Array.isArray` is true and whose prototype is `Array.prototype`; a transparent `Proxy` cannot be told from its target, and is read as its target, its traps running as rule 9 says.
2. Every argument binding reads but a point -- a declaration, a guard state, a match handed to `pressMatched`, a gesture argument, and a fact handed to a pointer operation -- is read through its own data properties, by descriptor, so no getter of it is called: an own accessor property is present and of no form, an inherited property is absent, and a symbol-named property is ignored.
3. Present means an own property, whatever its value; a property present with the value `undefined` is present, and of no form, since no form admits `undefined`; an optional argument -- the `guards` of `traceInput` and `matchInput`, a predicate's context -- omitted and one given as `undefined` are the same.
4. An array is of its form only when it is dense -- every index from 0 to `length - 1` an own data property -- and holds no own string-named property but those indices and `length`.
5. A point -- a fact's `at`, a gesture argument's `from` -- and a fact handed to a pointer operation are each a non-null value whose `typeof` is `'object'`, so a function is neither, of any prototype; a point's `x` and `y` are read once each through ordinary property access, `x` first, so a `DOMPoint`'s getters answer -- draw's `at` is a `DOMPoint`, whose `x` and `y` are getters on its prototype (`app/src/painter.js:29-32`) -- and both are read before either is checked, as `snap-grid` reads a point.
6. Reflection that throws -- `Array.isArray`, or reading a prototype, own keys, a descriptor or a point's coordinate, on a revoked or trapping `Proxy` or through a throwing getter -- makes that value of no form: in a declaration it is refused at its pointer (IB3); in any other argument it is malformed.
7. A property binding does not own -- a row's payload, a match's `owner` and `row`, a fact's every property but `at` and `button` -- is never read, so its getter never runs, whatever its form, and it may be an accessor or hold `undefined`.
8. A declaration is read whole, value by value, in the table's order: of each value, first all that judges it at its own pointer -- its prototype, for an array `Array.isArray` first, then its own keys, then the descriptor of each property its form names that its own keys hold, in the table's order, or for an array the descriptor of its `length` and then of each index in order -- and only then, unless it is refused at its pointer, the values those descriptors held, in the same order, each read whole before the next; a property its form does not name is known by its key alone, nothing beneath a value refused at its pointer is read, nothing is read twice, and every problem is reported (IB3, IB9); every other function reads its arguments once each, in the table's order, an array as a declaration's is read, checking each read as it is made -- a point's `x` and `y` together -- and throws at the first that is malformed, reading nothing after it.
9. A point's getter and a `Proxy`'s trap -- `getPrototypeOf`, `ownKeys`, `getOwnPropertyDescriptor`, `get` and the rest -- are the application's code, and may call the session: what that call does takes effect at once; the operation reading the argument reads the session's state only after all its arguments are read and checked, so it sees what that code left; an operation that throws while reading changes nothing itself, and undoes nothing that code did, whether the code returned or threw; and binding cannot tell a `Proxy` from its target, no means to do so being common to every runtime, so it can neither refuse one nor keep its traps from running, and it calls a getter only on a point, where draw's `DOMPoint` needs one.

| Function | What it reads, in order |
|---|---|
| `composeBindingTable` | the declaration; its `guards`, each guard's `state`, `flag`, `default` and `refuses`; its `claim`'s `flag` and `default`; its `opens`'s `field`; its `tenants`, each tenant's `owner` and `rows`, and each row's `id`, `on` and `when`, then, when step 9 runs, each guard's flag in order, the claim's flag and the `opens` field |
| `openGestureSession` | the declaration; its `threshold`; its `gestures`, each gesture's `name`, `engaged` and `button` |
| `matchInput`, `traceInput` | the guard state, if given: its prototype, its own keys, then each own string-named property's descriptor in the order `Reflect.ownKeys` gives them; the fact and the context are never read |
| `findOverlaps` | `facts`, then `contexts`, then `guardStates`, each array as rule 8 reads one -- `Array.isArray`, its prototype, its own keys, its `length`'s descriptor and its elements' in index order; then each element of `guardStates` in order, as a guard state |
| `pointerDown` | the fact; its `at`; that point's `x` and `y`; the fact's `button` |
| `pointerMove` | the fact; its `at`; that point's `x` and `y` |
| `pointerUp` | the fact; its `button` |
| `pressMatched` | the match's prototype; its `id`; its `opens` |
| `startGesture`, `becomeGesture` | the argument's prototype and own keys; its `gesture`, then its `row` for `startGesture`, then its `from`, each by descriptor; then that point's `x` and `y` |
| `pointerLost`, `cancelGesture` | nothing |

So a declaration whose `gestures` descriptor trap rewrites `threshold` has already had `threshold` read; a `guards` array whose second element is an accessor is refused before its first element is read, so no trap of that element runs; `pointerDown` given an accessor `at` throws with no getter called; a point whose `x` is `NaN` has its `y` read and then throws; and `startGesture` naming a gesture the session does not declare throws before `from`'s coordinates are read.

**IB3 -- A table, composed or refused.**\
`composeBindingTable(declaration)` returns `{ ok: true, table }` or `{ ok: false, problems }`.\
A declaration is a plain object holding `tenants` and, optionally, `guards`, `claim` and `opens`:
- `tenants`, an array, each tenant a plain object of exactly `owner`, a non-empty string, and `rows`, an array; two tenants may share an owner;
- `guards`, an array, each guard a plain object of exactly `state`, `flag`, `default` and `refuses` (IB5);
- `claim`, a plain object of exactly `flag` and `default` (IB7);
- `opens`, a plain object of exactly `field`, the name of the row property in which a row names the gesture a press it matches opens (IB11).

A row is a plain object holding `id`, a non-empty string, and `on`, a function; optionally `when`, a function; optionally, for each guard and for the claim, a property named by its `flag`, a boolean; optionally a property named by `opens.field`, a non-empty string; and any other property, which the table never reads.\
A problem is a record `{ pointer, problem }`: an RFC 6901 pointer into the declaration (`~` written `~0`, `/` written `~1`), and one of the codes below.\
Problems are ordered by pointer and then by problem, each compared by UTF-16 code unit as JavaScript's `<` compares strings, and no record appears twice.\
A check that fails at a pointer suppresses every check beneath that pointer, and none at a sibling's; a member is valid when no problem lies at its pointer or beneath it.\
Where a step needs a plain object and finds anything else -- a value of another kind, an accessor, a value whose reflection throws -- the problem is `not-an-object`; where it needs an array or a value of another form and finds anything else, `invalid-value`; an array that is not dense, or holds another own string-named property, is `invalid-value` at its own pointer, and nothing beneath it is checked.

| Step | When | Problem, at pointer |
|---|---|---|
| 1 | the declaration is not a plain object | `not-an-object` at `""`, and nothing else |
| 2 | an own property other than `tenants`, `guards`, `claim` and `opens`; `tenants` absent | `unknown-property` at `/<name>`, one each; `missing-property` at `/tenants` |
| 3 | `guards` present and not an array of its form; a guard not a plain object; a guard property other than its four, or one of them absent; `state` or `flag` not a non-empty string, or `flag` one of `id`, `on`, `when`; `default` not a boolean; `refuses` not one of the three forms of IB5 | `invalid-value` at `/guards`; `not-an-object` at `/guards/<k>`; `unknown-property` or `missing-property` at `/guards/<k>/<name>`; `invalid-value` at `/guards/<k>/<name>` |
| 4 | `claim` present and not a plain object; a property other than `flag` and `default`, or one absent; `flag` not a non-empty string, or one of `id`, `on`, `when`; `default` not a boolean | `not-an-object` at `/claim`; `unknown-property` or `missing-property` at `/claim/<name>`; `invalid-value` at `/claim/<name>` |
| 5 | `opens` present and not a plain object; a property other than `field`, or `field` absent; `field` not a non-empty string, or one of `id`, `on`, `when` | `not-an-object` at `/opens`; `unknown-property` or `missing-property` at `/opens/<name>`; `invalid-value` at `/opens/field` |
| 6 | among the row-property names the declaration gives -- each guard's `flag` in order, then the claim's `flag`, then `opens.field` -- each valid at its own pointer whatever its siblings, one equal to an earlier one | `duplicate-field` at the later one's pointer |
| 7 | `tenants` not an array of its form; a tenant not a plain object; a tenant property other than `owner` and `rows`, or one absent; `owner` not a non-empty string; `rows` not an array of its form | `invalid-value` at `/tenants`; `not-an-object` at `/tenants/<i>`; `unknown-property` or `missing-property` at `/tenants/<i>/<name>`; `invalid-value` at `/tenants/<i>/<name>` |
| 8 | a row not a plain object; `id` or `on` absent; `id` not a non-empty string; `on` not a function; `when` present and not a function | `not-an-object` at `/tenants/<i>/rows/<j>`; `missing-property` at `.../<j>/id` or `.../<j>/on`; `invalid-value` at `.../<j>/<name>` |
| 9 | no problem lies at or beneath `/guards`, `/claim` or `/opens` -- a `duplicate-field` of step 6 among them -- and a row holds a guard's or the claim's flag that is not a boolean, or the `opens` field that is not a non-empty string, `undefined` among them | `invalid-value` at `/tenants/<i>/rows/<j>/<name>` |
| 10 | among rows whose `id` is valid, in table order, one whose `id` equals an earlier row's | `duplicate-id` at the later row's `/id` |

A row's `id`, `on` and `when` are checked at step 8 alone, and a row's properties are checked only under the names steps 8 and 9 give, so a payload property is never inspected.

**IB4 -- What a table holds.**\
Table order is the tenants in the declaration's order, each tenant's rows in its order.\
At composition the table reads each row's `id`, `on`, `when`, declared flags and `opens` field, once, and holds them with the row's owner, a flag the row omits taking its declared `default`; it reads no other property of a row, then or later.\
So a row changed after composition changes no answer; the row object itself is kept by reference, and is handed back as `row` wherever an entry or a match names it, so the application reads its own payload from it.\
`table.rows` is a frozen array, in table order, of frozen entries `{ id, owner, opens, row }`, in that order whatever the declaration: `opens` is the row's gesture name, or `null` for a row with no own property of the `opens` field's name and for every row when no `opens` is declared; a row holding that property with any other value, `undefined` among them, is refused at IB3 step 9.\
`table.guards` is a frozen array of frozen copies `{ state, flag, default, refuses }`, in order; `table.claim` a frozen copy `{ flag, default }`, or `null`; `table.opens` a frozen copy `{ field }`, or `null`.\
A table holds no state and changes after composition in no way; any number of callers may share one.

**IB5 -- Guards.**\
A guard state is a plain object whose own properties are named states, each a boolean data property; a state it omits is `false`, and an omitted guard state is all states `false`.\
A guard state naming a state no guard of the table declares, holding a value that is not a boolean, or holding an accessor, is malformed.\
A guard `{ state, flag, default, refuses }` refuses a row, under a guard state, as `refuses` says, `s` being the guard state's value of `state` and `f` the row's value of `flag`:

| `refuses` | The row is refused when |
|---|---|
| `state-and-flag` | `s` and `f` |
| `state-without-flag` | `s` and not `f` |
| `flag-without-state` | `f` and not `s` |

A row is admitted when no guard refuses it.\
Several guards may name one state; no two name one flag (IB3 step 6).

**IB6 -- The trace.**\
`table.traceInput(fact, context, guards?)` returns a frozen array of frozen records `{ id, owner, refusedBy, on, when, hit }`, one per row, in table order, computed in three passes:
1. each row's guards are applied, and `refusedBy` is the `flag` of the first guard, in declaration order, that refuses it, or `null` when it is admitted;
2. for each admitted row, in table order, its `on` is called once with the fact;
3. for each admitted row whose `on` answered a truthy value, in table order, its `when`, if it has one, is called once with the context.

`on` is `null` for a refused row and otherwise whether its call answered a truthy value; `when` is `null` for a row pass 3 does not reach, `true` for a reached row with no `when`, and otherwise whether its call answered a truthy value; `hit` is `true` exactly when `on` and `when` are both `true`.\
So each record reads as refused, unbound (`on` false), unmet (`when` false) or a hit.\
A predicate is called with no receiver and one argument, as `Reflect.apply(predicate, undefined, [argument])` calls it -- so a strict function sees `this` undefined, a sloppy one the global object, and a bound or arrow function its own -- and its answer is taken as JavaScript's `if` takes it.\
Predicates are the application's, expected to be pure functions of their argument; binding calls each at most once in a call of `traceInput` or `matchInput`, and at most once for each combination in a call of `findOverlaps`, in the order above, and cannot detect a predicate that is not pure.

**IB7 -- One match, or none.**\
`table.matchInput(fact, context, guards?)` returns a frozen `{ match, claimed }`, from exactly the calls IB6 makes for the same arguments:
- `match` is a frozen `{ id, owner, opens, row }` -- as the row's entry in `table.rows` -- for the one row whose trace record is a hit, or `null` when no row hits or more than one does;
- `claimed` is `true` when some admitted row whose `on` answered a truthy value holds its claim flag `true` -- whatever its `when` answered -- and `false` otherwise, always `false` for a table with no claim.

So no permutation of tenants or of rows changes a `matchInput` answer's `match.id` or `claimed`; order decides only the order of `rows`, of a trace and of an overlap list.

**IB8 -- Overlaps.**\
`table.findOverlaps(facts, contexts, guardStates)` takes three arrays of IB2's form; the elements of `facts` and `contexts` may be any values, `undefined` among them, and every element of `guardStates` must be a guard state (IB5), so an `undefined` element is malformed there.\
All three are read and checked before any predicate is called, even when one is empty.\
For each guard state, then each context, then each fact -- guard states outermost, facts innermost -- it makes the calls IB6 makes, and where two or more rows hit it lists a frozen record `{ fact, context, guards, ids }`: the three values given, by reference, and `ids`, a frozen array of the hitting rows' ids in table order.\
It returns a frozen array of the records in that order, empty when there is none.

**IB9 -- A session, opened or refused.**\
`openGestureSession(declaration)` returns `{ ok: true, session }` or `{ ok: false, problems }`, problems and their reading as IB3 states them.\
A declaration is a plain object of exactly `threshold` and `gestures`:
- `threshold`, a finite number at least 0: the distance a press may travel and still be a click, in the units of the facts' `at`;
- `gestures`, an array of plain objects of exactly `name`, a non-empty string, unique among them; `engaged`, a boolean; and `button`, a safe integer or `null` -- the button whose presses the gesture takes while it is live, and the only button whose release commits it, or `null` for a gesture that takes no press and is committed by any release.

| Step | When | Problem, at pointer |
|---|---|---|
| 1 | the declaration is not a plain object | `not-an-object` at `""`, and nothing else |
| 2 | an own property other than `threshold` and `gestures`; one of them absent | `unknown-property` at `/<name>`, one each; `missing-property` at `/<name>` |
| 3 | `threshold` not a finite number at least 0 | `invalid-value` at `/threshold` |
| 4 | `gestures` not an array of its form; a gesture not a plain object; a property other than `name`, `engaged` and `button`, or one absent; `name` not a non-empty string; `engaged` not a boolean; `button` neither a safe integer nor `null` | `invalid-value` at `/gestures`; `not-an-object` at `/gestures/<k>`; `unknown-property` or `missing-property` at `/gestures/<k>/<name>`; `invalid-value` at `/gestures/<k>/<name>` |
| 5 | among valid names, one equal to an earlier one | `duplicate-name` at the later one's `/name` |

`session.declaration` is a frozen copy `{ threshold, gestures }`, each gesture `{ name, engaged, button }`, `-0` written `0`.\
A session belongs to the application that opens it: one for each input surface whose presses and gestures form one stream, kept as long as the application keeps it, and dropped by dropping it; two sessions share nothing.

**IB10 -- The press.**\
A session holds at most one press, `null` or `{ at, beyond, unmatched }`:
- `pointerDown(fact)` replaces the press, whatever press there was: `at` a copy of the fact's, `beyond` false, and `unmatched` true unless the live gesture takes the press (IB11), when it is false;
- `pointerMove(fact)` makes the press beyond when there is a press, it is not yet beyond, and the distance from its `at` to the fact's `at` is greater than the threshold, and then its outcome's `crossed` is `true`; otherwise the press is unchanged and `crossed` is `false`, and a move with no press changes no press;
- `pointerUp(fact)` answers `trigger`, `'drop'` when there is a press and it is beyond and `'click'` otherwise, and makes the press `null`; it reads the fact's `button` (IB11), never its `at`, so where a release lands never counts, only the moves before it;
- `pointerLost()` makes the press `null`, with no trigger -- the platform has taken the pointer;
- `pressMatched` answering `start` or no phase makes `unmatched` false (IB11);
- `startGesture` and `becomeGesture` given `from`, when there is a press, set its `at` to a copy of `from` and `beyond` to false, keeping `unmatched`; with no press, `from` is read and checked and changes nothing.

The distance is decided exactly: with `(x0, y0)` the press's `at`, `(x1, y1)` the fact's and `t` the threshold, the press is beyond when `(x1 - x0)^2 + (y1 - y0)^2 > t^2` holds of the exact real numbers the binary64 values denote.\
So a travel of exactly the threshold is a click, and a press never stops being beyond except by a new press, a restart, `pointerUp` or `pointerLost`.

It is computed exactly, and cheaply, in two steps (D7):
1. **A binary64 filter.** With `dx = x1 - x0`, `dy = y1 - y0`, `s = dx * dx + dy * dy` and `q = t * t`, each rounded once, and every one of `dx`, `dy`, `s` and `q` finite, and each of `dx * dx`, `dy * dy` and `q` either `0` because its operand is `0` or at least 2^-1022: the press is beyond when `s > q * (1 + 2^-49)`, and not beyond when `s < q * (1 - 2^-49)`.
2. **An exact fallback.** Otherwise the five values are read as their exact significands and exponents, shifted as `BigInt`s to the least exponent among the nonzero ones, and compared exactly.

The filter is sound: a subtraction whose result is subnormal is exact, and otherwise errs by at most one rounding, `u = 2^-53` relative; so, with no underflow, the computed `s` lies within a factor `1 +- 5u` of the exact sum and the computed `q` within `1 +- u` of `t^2`, and a computed `s` above `q * (1 + 2^-49)` -- 2^-49 being `16u` -- implies an exact sum above `t^2`, and below `q * (1 - 2^-49)` one below it, the one further rounding that forms each bound being absorbed by the margin between `5u` and `16u`.\
The fallback is bounded: the exponents of the last places of finite binary64 values run from -1074 to 971, so each shifted operand has at most 2,098 bits, each difference 2,099 and each square 4,198, which `BigInt` multiplies in microseconds -- prototypes measured 16 to 26 microseconds at the worst case, two coordinates near `Number.MAX_VALUE` of opposite signs against one at `Number.MIN_VALUE` -- and the filter decides every travel of ordinary magnitude that does not lie within a relative 2^-49 of the threshold, so the fallback runs only at the edge and at extremes.\
The first prototype's fallback was its own oracle, so its 300,000 agreements checked the filter alone (section 10.3, o:F2).\
The prototype kept beside the third reading (`~/taceng/drawv2-eval-runs/h26-readings/ib/reading-3/prototypes/distance-fallback.mjs`) writes the fallback as step 2 states it, decoding each value's bits, and checks it against an oracle that shares no code with it, making each value an exact fraction by doubling it until it is an integer.\
It disagreed on none of 300,000 random travels -- a tenth of their values of magnitude up to 10^308, a tenth below 10^-300, a tenth subnormal or zero, half the travels within 10^-14 of their threshold -- 142,920 of them reaching the fallback, nor on 10,480 built so the filter cannot decide them, every one reaching it: exact equality and one binary64 step either side, for five Pythagorean triples scaled by every seventh power of two from subnormal to overflow, from negative origins, with opposite-sign extremes and signed zeros.\
Each of five mutations of the fallback -- `>=` for `>`, the sign dropped, a subnormal given a hidden bit or the wrong exponent, the shift taken to the greatest exponent -- fails between 7 and 2,997 of the built cases, and the wrong subnormal exponent fails no random travel.

**IB11 -- The live gesture, and what makes each phase due.**\
A session holds at most one live gesture, `null` or `{ name, row, engaged }`, `row` the id of the row that opened it or `null`.\
A gesture lives from the operation that starts it to the one that ends it, a commit or a cancel; `becomeGesture` renames it within the same life.\
Each operation answers the phase it makes due -- `start`, `update`, `become`, `commit`, `cancel`, or `null` for none -- and the gesture it concerns (IB12).

**Inputs.**\
These five operations take what a person did, and binding decides from them and from the declared gestures which phase is due:

| Operation | When | Phase due, and what changes |
|---|---|---|
| `pointerDown(fact)` | a gesture is live and declares a `button` equal to the fact's | none: the press is taken -- replaced, with `unmatched` false, and the outcome's `taken` true -- and means nothing more |
| `pointerDown(fact)` | otherwise | none: the press is replaced, `unmatched` true, `taken` false |
| `pressMatched(match)` | the press is unmatched, and a gesture is live | `cancel`: a press that means something ends the gesture in progress; the press stays unmatched, so the start it opens can follow |
| `pressMatched(match)` | the press is unmatched, none is live, and `match.opens` names a gesture | `start`: that gesture is live, its `row` `match.id`; the press is no longer unmatched |
| `pressMatched(match)` | the press is unmatched, none is live, and `match.opens` is `null` | none: the press means an action, the application's; the press is no longer unmatched |
| `pressMatched(match)` | there is no press, or it is not unmatched | refused (Errors) |
| `pointerMove(fact)` | a gesture is live | `update`, the press's travel decided as IB10 says |
| `pointerMove(fact)` | none is live | none, the press's travel decided as IB10 says |
| `pointerUp(fact)` | a gesture is live, and its declared `button` is `null` or equals the fact's | `commit`: the gesture ends; the press ends with its trigger |
| `pointerUp(fact)` | otherwise | none: the press ends with its trigger, and a live gesture stays live |
| `pointerLost()` | a gesture is live | `cancel`: the gesture ends; the press ends |
| `pointerLost()` | none is live | none: the press ends |

`pressMatched` takes the `match` of a `matchInput` answer, read by IB2: a plain object holding `id`, a non-empty string, and `opens`, a name the session declares or `null`; its other properties are not read.\
A press that matched no row is never handed to `pressMatched`, and changes nothing of the gesture.\
An application that resolves a press calls `pressMatched` once, and again only when it answered `cancel`, for the start the match opens.

**Requests.**\
These three operations are the application's, for causes binding cannot see; binding checks each against the same rules and reports the phase it makes due:

| Operation | When | Phase due, and what changes |
|---|---|---|
| `startGesture({ gesture, row?, from? })` | none is live | `start`: the gesture is live, `row` the string given or `null`; a held press restarts from `from` (IB10) |
| `startGesture(args)` | one is live | refused |
| `becomeGesture({ gesture, from? })` | one is live | `become`: it takes the new name and that gesture's `engaged`, keeps its `row`, and the outcome's `was` is the gesture as it was; a held press restarts from `from` |
| `becomeGesture(args)` | none is live | refused |
| `cancelGesture()` | one is live | `cancel`: the gesture ends |
| `cancelGesture()` | none is live | none |

A gesture argument is a plain object read by IB2: `startGesture`'s holds `gesture`, a name the session declares, and optionally `row`, a non-empty string, and `from`, a point; `becomeGesture`'s holds `gesture` and optionally `from`; any other property, `row` given to `becomeGesture` among them, is malformed.\
So `row` present with any value but a non-empty string -- `null` and `undefined` among them -- is malformed, and only a `row` absent leaves the gesture's `row` `null`; and a call with no argument, or with any value that is not a plain object, is malformed.\
They are requests because their causes are the application's state, not an input: which gesture a chain opens with no press, and when; what a gesture becomes once its press is a drag, which draw decides by its own table and by whether anything selected can move; and a cancel for a lock, a document replaced, a key's action, or a become that found nothing to do.\
So binding still decides when each phase is due: from the inputs it is given, by the rules above, and for every request by refusing it unless the lifecycle allows it now; the application runs its code for a phase only on an outcome naming it.\
A gesture's working data is the application's, and binding holds none of it: the live gesture is a name, a row and `engaged`.\
So what the application does to that data between phases -- a key redrawing a preview, or adding a stop to it -- is no phase, and changes the session only through a request.

**Lives.**\
At most one gesture is live; each life ends at most once, by a `commit` or a `cancel`; and at every moment the gestures started equal the gestures ended plus the one live, if any.\
Nothing else ends a gesture: a session dropped with one live ends nothing and reports nothing, and a gesture opened with no press stays live until an input or a request ends it, so seeing every gesture end is the application's obligation (draw's ends on a release, a lost pointer, a press, or its own causes, section 5).

The phases of H26-1 are these: start, by `pressMatched` or `startGesture`; update, by `pointerMove`; commit, by `pointerUp`; cancel, by `pointerLost`, `pressMatched` or `cancelGesture`; and become, a renaming within one life.

**IB12 -- State, identity and outcomes.**\
`session.state` is a frozen `{ press, gesture }`, each `null` or the record IB10 and IB11 name, `press.at` a frozen `{ x, y }`.\
Every coordinate binding copies is written `v + 0`, so no state holds `-0`.\
An operation computes the press and the gesture it leaves; each is the very same record as before when every field equals the old one's under `===` -- a press's `at` compared by its `x` and its `y` -- and a new frozen record otherwise; the press's `at` is likewise the very same record when its `x` and `y` are equal; and the state is the very same value when both records are, and a new frozen `{ press, gesture }` otherwise.\
So `pointerDown` at the press's own point while it is not beyond and with an equal `unmatched`, a restart from the press's own point while it is not beyond, `becomeGesture` to the live gesture's own name with no restart, and every operation that changes nothing leave the very same state.\
Each operation answers a fresh frozen outcome, of the form the table gives: `state` the state it leaves, `phase` the phase it made due or `null`, and `gesture` the record the phase concerns -- the gesture started, updated or become, or the one that ended -- and `null` when `phase` is `null`:

| Operation | Outcome |
|---|---|
| `pointerDown(fact)` | `{ state, phase, gesture, taken }`, `taken` a boolean, `phase` and `gesture` always `null` |
| `pressMatched(match)` | `{ state, phase, gesture }` |
| `pointerMove(fact)` | `{ state, phase, gesture, crossed }`, `crossed` a boolean |
| `pointerUp(fact)` | `{ state, phase, gesture, trigger }`, `trigger` `'click'` or `'drop'` |
| `pointerLost()`, `startGesture(args)`, `cancelGesture()` | `{ state, phase, gesture }` |
| `becomeGesture(args)` | `{ state, phase, gesture, was }`, `was` the gesture as it was |

For arguments whose reading runs no application code -- no `Proxy` among them, and every point's `x` and `y` data properties or getters that answer the same at every read, as a `DOMPoint`'s do -- the same declaration and the same sequence of operations and arguments give the same states and outcomes.\
Where reading does run application code, an operation's outcome is decided by what its reads answered and by the calls into the session that code made, in IB2's order; binding cannot make a getter or a trap answer the same twice, and promises nothing of one that does not.\
A session calls no application code but a point's getters and a `Proxy`'s traps while it reads its arguments, all before it reads its own state, and keeps nothing of a fact but a copy of its `at`; so any operation may be called from code the application runs in answer to another operation's outcome -- a commit body starting a chained gesture -- and sees the state the last operation left.

**IB13 -- Exports.**\
`@apnex/input-binding` exports `composeBindingTable` and `openGestureSession`, and nothing else; it has no subpath.\
The package imports no other package and no module particular to one runtime, touches no DOM, reads no clock and no randomness, and holds no timer, so the same files run in Node.js and in a browser.\
Its TypeScript declarations are generic in the fact and the context, so a consumer's predicates are typed against its own facts.

### 3.4 Fit criteria

**Does my project want this at all?**
- More than one surface -- a key, a press, a help overlay, a panel that follows the situation -- must agree on what an input means.
- You are about to write a ladder of `if` branches in which the order decides which one wins, or a read-only check placed at a line number.
- You are about to decide "click or drag", or which release ends a gesture, in a second place.

**It is the wrong tool when:**

| You need | Reach elsewhere, because `input-binding` is |
|---|---|
| platform events turned into facts, coordinates, a hit under the pointer | not a listener: that is `input-capture`, the hit test and coordinates the application's |
| a preview drawn, or what lies under a point | not a renderer: that is `vector-scene`, or the application |
| an action performed, an undo kept, a gesture's body run | not an executor: rows carry the application's payload, and phases are reported for the application's code to run |
| one row to win over another by priority | not a precedence engine: two hits mean nothing, and an overlap fails the application's gate |
| a hold, or a double click decided by time | not yet: binding reads no clock, and a timed trigger waits for a consumer, its time then a field of the facts |
| several pointers told apart, or held keys tracked | not yet: one press, and the modifiers a fact carries |
| bindings a person edits while the application runs | not a store: rows are source, composed once |

### 3.5 Adjustment policy and edges

Internal and sovereign: a measured gap is recorded where both sides can see it, then resolved by adjusting `input-binding` or by fracturing it if the gap reveals a second duty; never forked.

**Contains:** the binding table and the gesture session.\
**Consumes:** nothing.\
**Consumed-by:** draw (H26.2), then the gesture tester (H26.5).

The tester needs three things of binding: its own tables, matched as draw's are; every row's standing for each input, to highlight every gesture live (`traceInput`, D8); and every operation's outcome, to show a press becoming a drag and each phase as it falls due (IB12).\
It draws its keys and its pointer from capture's facts, which binding does not read beyond `at` and `button`.

---

## 4. Invariants and tests

There is no conformance kit (D9): nothing in `input-binding` is a port another party implements.\
*`input-binding`* marks what the component's own tests hold; *gate* what its gate holds; draw's own tests are the acceptance steps below.

| # | Invariant | Held by |
|---|---|---|
| I1 | `composeBindingTable` and `openGestureSession` never throw for any value, and answer every declaration with exactly the problems IB3 and IB9 give, from a table of cases: escaped pointers, code-unit order, present `undefined`, accessors, sparse arrays, arrays with extra properties or another prototype, revoked and trapping `Proxy` values refused at their pointers, and a transparent `Proxy` answered as its target. | `input-binding` |
| I2 | A table reads each row once and owns nothing else of it: a row changed after composition changes no answer; `match.row` and every entry's `row` are the declared object itself (`===`); a payload getter is never called. | `input-binding` |
| I3 | For every guard form, state and flag, a row is admitted exactly when no guard refuses it; and draw's four guards (section 5), over all 128 combinations of their four flags and three states, admit exactly what `kernel/input-rules.mjs:56-57` admits. | `input-binding` |
| I4 | `matchInput`'s `match` is the one hit of `traceInput` for the same arguments, or `null` when there are none or several; `claimed` is as IB7 states -- over generated tables, facts, contexts and guard states. | `input-binding` |
| I5 | Order decides nothing: for every permutation of tenants and of rows in a generated table, every `matchInput` answer's `match.id` and `claimed` are unchanged. | `input-binding` |
| I6 | Spies count every predicate call, its order and its receiver: each admitted row's `on` once, each reached row's `when` once, every `on` before any `when`, each in table order, each with no receiver -- a strict predicate sees `this` undefined, a sloppy one the global object; a throwing predicate's exception propagates, and the table answers the next call as before. | `input-binding` |
| I7 | `findOverlaps` lists exactly the combinations in which two or more rows hit, in IB8's order, with `ids` in table order, and refuses a malformed guard state before calling any predicate, even with no facts. | `input-binding` |
| I8 | Binding reads no property of a fact but `at` and `button`, each only in the operations IB1 names, in IB2's order, and writes none: a `Proxy` fact records every read; an accessor `at` or `button` is refused with no getter called; a function given as a fact or a point is refused; frozen facts, contexts, rows and guard states are accepted. | `input-binding` |
| I9 | The press's `beyond` and `trigger` agree with an exact oracle that shares no code with the fallback over generated streams; over travels targeted within 10^-15 of the threshold, on both signs, near the origin and far from it; over values near `Number.MAX_VALUE`, where binary64 squares overflow, and subnormal or zero, where they underflow; and over cases built so the filter cannot decide them, each asserted to reach the fallback -- exact equality and one binary64 step either side, across exponents, from negative origins -- which mutations of the fallback's comparison, sign and subnormal decoding each fail; a release's position never changes a trigger. | `input-binding` |
| I10 | Over generated sequences of operations, every outcome names the phase IB11's tables give for the state before it; at most one gesture is live; each life ends at most once; started equals ended plus live; every refused operation throws and changes nothing. | `input-binding` |
| I11 | A point's getter, and a `Proxy`'s trap on any argument, that calls the session takes effect before the operation's transition, which sees the state it left -- a gesture argument whose `getOwnPropertyDescriptor` trap cancels the live gesture lets `startGesture` start; such code that calls the session and then throws leaves its own call's effect and nothing of the throwing operation's; and for each operation a malformed argument at each place in IB2's order stops the reading there, no later getter or trap called. | `input-binding` |
| I12 | Every state is frozen to its depth and holds no `-0`; it, its press and its gesture are each the very same value exactly when IB12 says; every record holds its properties in its written order; for arguments whose reading runs no application code the same sequence gives the same states and outcomes, and a counterexample marks the edge of that promise: one fact whose point's getter counts its reads gives two fresh sessions two origins. | `input-binding` |
| I13 | The table and the press reproduce draw's: a corpus generated once from draw's `kernel/input-rules.mjs`, `app/src/input-state.js` and `app/src/triggers.js` at `5b4997b` -- tables stated as data with no word of draw's, which the test turns into predicates, and streams of presses and moves -- passes, except the press points within the exact band, which the corpus lists apart, each with draw's answer and the exact one (D7, section 6.3). | `input-binding` |
| I14 | The source names no consumer's vocabulary, and the built files import no package and no runtime-specific module or global (`SNAP-GRID.md` section 7.2). | gate |

**Each rule's own tests,** in `input-binding`'s `test/contract/`, one file per capability:
- IB2, IB3 and IB9: the refusal tables of I1, every step's rows, a problem beneath one member never suppressing its sibling's, step 6 judging each name at its own pointer, step 9 skipped after any problem at or beneath `/guards`, `/claim` or `/opens`, a `duplicate-field` among them, accessors refused without a getter called, a row's `opens` field absent giving `null` and present as `undefined` refused, and IB2's reading order for every function, the constructors' among them -- each value judged at its pointer before anything beneath it is read -- held by a `Proxy` that records each trap; reading 3's declaration whose trap rewrites `threshold` (section 10.3); and reading 4's, whose `guards` holds a guard wrapped in a `Proxy` whose `getPrototypeOf` trap empties `tenants`, then an accessor, and is refused with `invalid-value` at `/guards` and at `/tenants/0/rows/0/id`, the trap never run (section 10.4);
- IB4 and IB5: defaults applied to omitted flags; `opens` `null` without a declaration; each refusal form at each of its four combinations; an undeclared state, a non-boolean value and an accessor refused with the function's name;
- IB6 and IB7: a row refused by two guards naming the first; `on` answering `0`, `''` and an object; `claimed` with a hit, with an unmet `when`, with two hits, and with no claim declared;
- IB8: an empty answer, an overlap under one guard state alone, the nesting order, holes refused, `undefined` accepted as a fact and refused as a guard state;
- IB10: a travel of exactly the threshold, one binary64 step beyond it, a move with no press, a second press, a restart with and without a press held, the filter and the fallback each deciding, and the I9 oracle;
- IB11: every row of both tables in each state, the refusals, the `pressMatched` sequence of `cancel` then `start`, `row` kept through `becomeGesture`, `row` given as `null` or `undefined` refused, `engaged` following the declared gesture, and I10's generated sequences;
- IB12: each identity case IB12 names, and each operation's outcome, its keys in the order the table writes them;
- errors: each function refusing each malformed argument with the error and message the Errors paragraph names; every answer frozen to its depth, and no argument frozen.

**Acceptance for H26.2, draw on `input-binding`:**
1. `input-binding` is released from its repository by its CI, and draw's lockfile pins the release file by its hash.
2. Every site appendix B marks *moves* asks `input-binding` through draw's `rules` part, and only that part imports it; every site marked *stays* is unchanged; every site marked *kept* keeps its behaviour exactly and cites its backlog row.
3. `app/src/triggers.js` is deleted; `app/src/input-state.js` holds no press; `kernel/input-rules.mjs` holds no matching, guard or overlap code of its own, only draw's declarations and the calls through; `app/src/input.js` assigns no `mode`, holds no `ignoreUp`, and does not decide which press a live gesture takes, which release commits it, or that a press or a lost pointer cancels it -- it runs a gesture's `start`, `update`, `commit` or `cancel` body, and a chain's start, only on an outcome naming that phase, a key's action changing only the working data between phases (section 5, step 6); and it measures no distance but the link release's `atStart` (`app/src/input.js:263`); a new test in draw's `tests/`, `input-binding-move.test.js`, finds each of these, as H26.1's `tests/grid-arithmetic-gone.test.js` found its own.
4. Before anything is deleted, a test in draw runs the old matcher and the adapter side by side over every table section 2.2 lists, on the product page's and the lab's compositions, with the facts, situations and guard states draw's tests enumerate, and finds every answer's row id and claim equal; runs the old press and the session side by side over generated streams, finding no difference beyond those section 6.3 lists as changed, each of which it holds with both answers; and records, over every scenario of the gesture corpus, which gesture body ran for each input and which gesture was live after it, before the move and after, finding them equal.
The corpus first gains scenarios recorded from the code as it stands: Shift pressed over a live move and released, the pointer released with no move after either key; and every cancel route of section 2.3 it does not yet drive -- Escape over a clone, a resize, a box and a marquee, a lock, a document replaced, a press a row matches and a double click that edits, each over a live gesture.\
And a test holds the empty-handle sequence of 6.3 with both answers: before the move, a pointer cancel throws, the gesture stays live and the next move throws; after it, the pointer cancel throws, the gesture has ended, the teardown and `onGestureEnd` have run, and the next move follows the idle path.
5. Draw's full gate passes: the gesture corpus replays byte-identical, its 76 scenarios and those step 4 adds (`tests/gesture-corpus.test.js`), the old press table's 504 combinations (`tests/pointer-bindings.test.js`) and the release tables' oracles (`tests/releases.test.js`) agree, the help overlay's sections are identical -- 37, 12, 7 and 4 lines today -- `tools/gesture-table.mjs --check` passes with no edit, and the matrix corpus's boards match in real Chrome.
6. The probe against production, each side on its own dependencies, finds no pixel or style changed, and an independent verifier passes the move.
7. The product page, the lab page, the server and the export load the one release: the pages through the import map, Node.js by name -- the server and the export load it because the network plugin's drag grammar does (`network/grammar.mjs:18`).

---

## 5. What draw supplies, and what stays draw's

**Draw supplies its rows,** every one of the 83 of section 2.2, unchanged: the product's keys, presses, double click, key releases and release tables; run mode's rows; each plugin's presses, keys, box and handle releases; and the network's drag grammar.

**Draw states its table declaration once,** in its `rules` part, for every table it composes -- exactly the guards `kernel/input-rules.mjs:40,56-57` applies today:

| `state` | `flag` | `default` | `refuses` |
|---|---|---|---|
| `readOnly` | `mutates` | `true` | `state-and-flag` |
| `readOnly` | `whileReadOnly` | `false` | `flag-without-state` |
| `helpOpen` | `duringHelp` | `false` | `state-without-flag` |
| `gesturing` | `duringGesture` | `false` | `state-without-flag` |

with the claim `{ flag: 'prevent', default: true }`, as `kernel/input-rules.mjs:68` reads `prevent !== false`, and `opens: { field: 'gesture' }`, the field draw's press rows already name their gesture in.\
These names are draw's policy, stated in draw's adapter; the component's contract names none of them.

**Draw opens one session for each Input,** in `app/src/input.js`: the threshold of 4 canvas units the director ruled on 2026-09-30, named once there; and the eight gestures of `GESTURES`, derived from the table so no gesture name is written twice -- `link` declaring `engaged: true` and `button: 0`, which replaces its `ignoreUp` (`:209`) and the press check (`:595`); `pending` and `clone-pending` declaring `engaged: false` and `button: null`; and the other five `engaged: true` and `button: null` -- the set `isGesturing` names today (`:560-562`).

**How Input drives the session,** each entry point keeping today's order of draw's own effects:
1. **A press:** fold the event into the input state and call `pointerDown` first, before run mode's diversion (`:589-592`); in run mode resolve run mode's table as today and stop; if the outcome's `taken`, stop (`:595`); close the label editor and the hand; resolve the press table, and stop if no row matches; call `pressMatched` with the match -- on `cancel`, end the gesture it names as step 4 does, with the press's event, so that its `afterShiftUpPress` runs before the start, as today (`:612`, `:1249`), then call `pressMatched` again; then show the grids, take the pointer, and run the row's action, or, on `start`, the start body, its answer the context (`:612-619`).
2. **A move:** fold the event into the input state, call `pointerMove`, and on `update` run the live gesture's update body; `pending` and `clone-pending` read the press's `beyond` to ask whether they are a drag, and their press-to-drag row's action calls `becomeGesture` or, finding nothing to move or clone, `cancelGesture` with no body run -- neither has a cancel body -- and no teardown, as its `mode = null` does today (`:690-734`, `:985-995`).
3. **A release:** note whether a gesture is engaged, call `pointerUp`, write its `trigger` onto the event, and on `commit` clear the context, run the teardown and the commit body (`:1041-1070`); then, as today, `onGestureEnd` if a gesture was engaged, in the release's `finally`.
4. **A cancel,** in `cancelDrag`, whose callers are unchanged: on a pointer cancel, fold the event into the input state and call `pointerLost`; for draw's own causes -- Escape, a lock, a document replaced, a double click that edits, the sync layer's snapshot -- call `cancelGesture`; then, on the outcome's `cancel`, run the cancel body of the gesture the outcome names, with the context as it stands; and in a `finally`, whatever the outcome and whether or not the body throws, clear the context and run the teardown, `onGestureEnd` and `afterShiftUpPress` in today's order (`:1243-1249`), as the release runs its own in a `finally` (`:1044-1048`); so every cancel is outcome-first, as every commit already is (`:1064`), and a cancel body sees no gesture live (6.2, 6.3).
5. **A chain:** `becomeGesture({ gesture: 'link', from })` when a gesture is live -- a digit mid-drag -- and `startGesture({ gesture: 'link', from })` when none is -- a commit that chains -- the chained note keeping only the chained flag (`:1193-1199`).
6. **Keys during a gesture:** a key means the key table's one match under the guard state `gesturing`, as today (`:1314-1318`), and its action is draw's; an action may change the live gesture's working data and its preview with no phase due and no call to the session -- Shift's redraw of a move or a clone (`onShiftDown`, `onShiftUp`), `w`'s stop and the network's (`onWaypointKey`, `addStop`), the digit's committed segment (`chainThroughNode`) -- and changes the lifecycle only by a request: Escape's cancel (step 4), the digit's become (step 5); a release then commits the frame last drawn, as today (section 2.3, item 7).

**Draw supplies its contexts and its facts** as today: the situation (`engine/situation.mjs:58-70`), the facts each gesture hands its release table, `null` for the drag grammar; and capture's input events (section 2.4).

Where each is opened follows draw's layer rules and its parts' declared consumes:
- only the `rules` part imports `input-binding` (`tools/layers.mjs` `COMPONENTS`, section 7; D10); `kernel/input-rules.mjs` keeps `composeRules(...tenants)`, `resolveInput(table, input, situation, guards)` and `overlapsIn(table, inputs, situations, guardStates)` with today's signatures -- `composeRules` handing each tenant `{ owner, rules }` on as `{ owner, rows: rules }` (`kernel/input-rules.mjs:45`); `resolveInput` answering `{ rule, claimed, match }`, `rule` the declared row and `match` the component's match record, a field it adds; `overlapsIn` answering records `{ input, situation, guards, ids }` -- over `composeBindingTable`, throws loudly at load for a refused declaration with today's message for a duplicate id (`input rule '<id>' is brought by both <owner> and <owner> -- an id names one row`), and adds `openGestures(declaration)`, which opens a session or throws loudly with its problems;
- the canvas and the network plugin already consume `rules` (`tools/layers.mjs:100-120`), so neither gains an edge: the canvas opens its session and composes its tables through `rules`, and `network/grammar.mjs` composes and resolves its two tables through it, unchanged;
- `kernel/` imports nothing from `model/` (L3); the adapter, a core module, names no plugin's kind (`tests/core-names-no-plugin.test.js`), and its exports -- `composeRules`, `resolveInput`, `overlapsIn`, `openGestures` -- match no name L5 refuses in the core;
- the adapter's whole text, comments and strings included, is read by the neutrality test's pattern (`tests/input-rules.test.js:98`), which refuses `link`, `node`, `waypoint`, `anchor`, `pipe`, `guide`, `route`, `zone`, `group`, `flow`, `tower` and `pin` and their plurals, `routing`, `network`, `pinned`, `via`, `keymap`, `canvas`, `selection`, `close`, `closed` and `closes`, and every word beginning `spawn` or `drag`, so the adapter speaks of gestures, presses, drops and sessions; the threshold and the gestures are declared in `app/src/input.js`, not there;
- the session is a private field of Input -- `#session` -- so no module outside `app/src/input.js` can read the gesture state, the language refusing it, while `tools/scan-writers.mjs` keeps refusing a read of `input.mode` or `input.ctx` in any test or any product module but Input (`:82`, `:270-271`, `:329-336`); `mode` is read through a getter over the session, so the reading sites that stay are unchanged;
- `bindings()` hands the help overlay each table's rows, `table.rows.map((entry) => entry.row)`, for the key, press, double-click and run-mode tables, and the link, marquee and Ctrl+click release tables' rows concatenated in that order, so `helpSections` receives arrays of rows, as today (`app/src/help.js:69-78`).

**Stays draw's,** because it is draw's content or policy:
- the rows themselves, the action labels (`app/src/actions.js`), the help overlay and its input grammar (`app/src/help.js`), and the situation (`engine/situation.mjs`);
- the editing gestures' bodies, their previews and their working data, `ctx` (B389), a start body answering `null` leaving its gesture live with an empty context, as today (6.3), and the key actions that change that data between phases (step 6);
- what a press becomes when dragged, as rows (`app/src/releases.js:93-99`);
- the chain: the armed `w`, the chained flag, and when a chain starts or replaces a gesture (`app/src/input-state.js`, `app/src/input.js:1193-1199`);
- run mode's diversion before any press table (`:592`), and closing the label editor and the hand on a press (`:597-598`);
- the lock, the help overlay's state, Escape's order, and when each cancels a gesture; the sync layer's deferral (`app/src/sync.js:72-84`);
- `claimed`, `capture` and `trigger` written onto draw's own event objects, which capture acts on, until H26.3 designs how a claim reaches the platform;
- capture and the hit test (`app/src/capture.js`, `app/src/pick.js`), until H26.3;
- the palette's tile drag and the label editor's field keys, outside capture and Input (section 2.4, D14);
- the help overlay's projection of the rows, unchanged in output;
- the generated tables: `tools/gesture-table.mjs` reads the network's row arrays directly (`:16-17`, `:26-28`) and needs no edit, and `tools/reaction-table.mjs` reads the planner's reactions, not input at all.

---

## 6. How the parity is kept

Draw's inputs must mean what they meant, row for row, and its gestures must commit what they committed, byte for byte.

### 6.1 Four tests from three sides

I13 holds `input-binding` to draw's matcher and press as neutral cases; acceptance step 4 holds draw's move from draw's side, old against new, over every table draw composes and over the lifecycle the gesture corpus drives; the gesture corpus, the press and release oracles already in draw's tests, and the matrix corpus hold what draw does with the answers; the probe holds what is drawn.

### 6.2 The differences a careful reader looks for

- **The row handed back.** `composeRules` copied each row with its defaults and its owner (`kernel/input-rules.mjs:49`), and `resolveInput` answered the copy; it answers the declared row now. No product module reads `owner` or a defaulted flag from an answer, and the help overlay reads `input`, `said`, `doc`, `context`, `run` and `gesture`, which every declared row carries.
- **A table is no longer an array.** `bindings()` maps each table's entries to their rows (section 5); handed the entries themselves, the overlay would draw nothing -- a probe of today's tables gave sections of 37, 12, 7 and 4 lines from rows and none from entries. The two tests that read a composed table as an array read `table.rows` (appendix B).
- **`this` in a predicate.** Today a predicate is called as a method of the composed copy (`kernel/input-rules.mjs:61-62`); it is called with no receiver now; every predicate draw declares is an arrow function (measured), so none reads `this`.
- **The order of calls.** Kept: guards, then every admitted row's `on` in table order, then every bound row's `when` (`kernel/input-rules.mjs:61-62`), so a predicate is asked exactly as before.
- **Commit and the press taken, decided by declaration.** Today `link`'s `ignoreUp` refuses any release but the left button's (`app/src/input.js:209`, `:1061`) and the press handler gives a live `link` every left press (`:595`); the session decides both from `link`'s declared `button: 0`, the same rule, and every other gesture, declaring `null`, is committed by any release and takes no press, as today.
- **The cancel body after the session clears, for every cancel.** Today's body runs while `mode` still names the gesture (`:1242-1243`), and now after the session has ended it, on a lost pointer, a press that ends the gesture and each of draw's own causes alike (section 5, step 4). No cancel body reads `mode` or `isGesturing` -- `move`'s, `clone`'s, `handle`'s, `link`'s, `box`'s and `marquee`'s (`:86-102`, `:166-170`, `:269-273`, `:302`, `:327`) -- and nothing they reach reads either at once: `mode` is read by Input alone, and `isGesturing` by Input's own key, hover and arming paths and otherwise only by the sync layer, when an inbound message arrives or a snapshot applies (`app/src/sync.js:73`, `:82`) -- none of them inside a cancel body. A harness run over twelve cancel routes, every cause and every gesture with a cancel body, recorded no read of either from draw's code while a body ran, and its control observer on the model recorded `isGesturing()` true during a rewind, so the instrument sees a read where one is made (`~/taceng/drawv2-eval-runs/h26-readings/ib/reading-2/prototypes/cancel-readers.mjs`). A cancel body that throws is the exception, changed and named in 6.3.
- **Keys between phases.** Kept: a key's action changes the live gesture's working data and preview as today, and reaches the session only by a request (section 5, step 6).
- **A press that cancels, then starts, in two calls.** `pressMatched` ends the live gesture in one call and starts the next in another, so draw's teardown, `onGestureEnd` and `afterShiftUpPress` run with no gesture live and before the start, as today (`:612`, then `:618`), and its cancel body with no gesture live, as the first bullet says. One call doing both would change behaviour: `onGestureEnd` releases the inbound changes the sync layer held (`app/src/sync.js:74`, `:870-879`), a held snapshot loads, and Input's load handler (`app/src/input.js:525`) would find the new gesture already live and cancel it before its start body ran.
- **The press cleared before the commit body.** Today the release clears the press in its `finally`, after the commit (`:1045`); `pointerUp` clears it before. No commit body reads the press: the one that touches it, a chain's note restarting a held press (`app/src/input-state.js:47`), leaves it cleared either way, and the press is `null` after both.
- **The start before the start body.** Kept: `pressMatched`'s `start` makes the gesture live before draw runs the start body, as `:618-619` does.
- **Engaged by declaration.** `isGesturing` names `pending` and `clone-pending` (`:561`); the session declares those two not engaged and every other engaged, the same set.
- **The travel distance.** The press no longer keeps how far it went, only whether it went beyond; `travelled` had one reader, `dragging` (`app/src/triggers.js:20`).
- **One press for every pointer.** Kept: a second pointer's press replaces the first's, and any release ends it (6.3).
- **Guard states.** Draw passes booleans in every guard state it hands (`app/src/input.js:609`, `:662`, `:1086`, `:1274`, `:1314-1318`, `:1556-1558`; none at `network/grammar.mjs:79`), and names only the states its guards declare, so the stricter check refuses nothing draw passes.
- **The threshold's arithmetic.** `Math.hypot` against an exact distance, at the edge (6.3).

### 6.3 Defects the inventory found, and what H26.2 changes

H26.2 is an extraction: it keeps every behaviour of draw's, defects included, except those it changes below, each made by a decision of section 8 and ruled with it.

**Changed by H26.2:**
- a press whose travel lies within about 10^-15 of the 4-unit threshold -- one unit in the last place of 4 -- is decided by the exact distance, where `Math.hypot`'s rounding decided it: over 2,000,000 travels generated within 5 x 10^-13 of 4 units, at random origins across the drawing, about 900 (0.05%) were decided the other way, every one within 10^-15 of 4 -- 886, the furthest 9.2 x 10^-16 from 4, in the run made for this revision (`~/taceng/drawv2-eval-runs/h26-readings/ib/reading-1/hyp2.mjs`); over a quarter-unit lattice of moves from one press none differs. ECMA-262 leaves `Math.hypot` implementation-approximated, so at those points today's answer may also differ between browsers, and the exact one does not (D7);
- a cancel body that throws ends its gesture: today the slot keeps naming the gesture and the teardown, `onGestureEnd` and `afterShiftUpPress` never run (`app/src/input.js:1242-1249`), so the gesture stays live, the sync layer goes on holding inbound changes, the next move throws again, a press a row matches throws in its cancel and starts nothing, and only a release ends it, its commit throwing after `mode` is cleared (`:1064`, `:1069`); after H26.2 the session has ended the gesture before the body runs and the rest runs in a `finally`, so the exception still propagates, the held changes are released, and the next move follows the idle path. The one cancel body that can throw is `handle`'s on the empty context the defect below leaves (`:166-170`), read from the code; the empty-handle prototype shows today's side (`~/taceng/drawv2-eval-runs/h26-readings/ib/reading-2/prototypes/empty-handle.mjs`). It follows from D6: once binding reports a cancel the gesture has ended, as a commit's has today, `dispatchUp` clearing `mode` before the commit body; and without the `finally`, `isGesturing()` would answer false while the sync layer still held changes, and a change arriving next would be applied ahead of them (`app/src/sync.js:527`, against `:447` and `:473`), the order the release's own `finally` keeps (`app/src/input.js:1032-1040`).

**Inputs nothing in draw produces, which now behave differently** -- listed so that this section is exhaustive for every input a pointer, a key or a declared row can produce:
- a row whose `on` is not a function, whose `when` is present and not a function, whose `id` is not a non-empty string, or which holds a flag that is not a boolean or a `gesture` that is not a non-empty string, is refused when draw loads, where today `on` threw at the first resolve and a flag was read by its truthiness; none of draw's 83 rows has one (measured), nor any of the 18,188 rows in the 3,312 tables draw's matcher, input, gesture-corpus, help, grammar, transit, press-table and release tests compose, each checked against IB3's row form with draw's declaration as it was composed, the 230 tests passing (`~/taceng/drawv2-eval-runs/h26-readings/ib/reading-2/prototypes/row-forms.sh`);
- a predicate that reads `this`: none of draw's does;
- a pointer fact whose `at` is not a point with finite coordinates, or whose `button` is not a safe integer, makes the pointer operation throw, where today the travel became `NaN` and every release a click, and a missing `button` was a release `link` refused; capture writes a finite `at` and `button ?? 0` on every pointer fact;
- a pointer fact or a point that is a function, or a fact whose `at` or `button` is an accessor or inherited, makes the pointer operation throw, where today it was read like any other; capture writes both as own data properties of a plain object (`app/src/capture.js:56-67`), and its `at` is a `DOMPoint`, whose getters IB2 reads;
- a guard state naming a state no guard declares, or holding a value that is not a boolean, makes the call throw, where today the name was ignored and the value read by its truthiness; draw passes neither.

**Kept, each registered for its own ruling:**
- one press for every pointer: facts keep no `pointerId` (section 2.4), so a second pointer -- a second touch contact or a pen, browser-reachable since the canvas takes touch as pointer events -- replaces the first pointer's press (`app/src/input-state.js:40`); during a live `link` a touch contact's press, `button` 0, is taken by it (`app/src/input.js:595`), and that pointer's release ends the press and, being a button-0 release, commits the link where it lifted (`:1041-1069`); read from the code and to be shown by a browser test at H26.2 -- revision 1 described a right press and release during a left drag, which one mouse cannot make, Pointer Events delivering a second button as a move (section 10.1, o:F10);
- a `handle` press whose start finds no entity -- no selected entity of the handle's kind, or a re-plugged link's fixed end gone -- leaves `handle` live with an empty context (`app/src/input.js:185-193`, `:619`), so each move throws until the release, whose commit throws too and ends it (`:172-173`, `:153-155`). It is reachable with two pointers (section 10.2, o:F3): select a zone, press its corner handle with Shift held, release Shift with the pointer still down -- the zone stays selected until that press ends (`:1576`) -- then press the still-drawn handle with a second pointer. That press resolves the handle row (`:609`) before the cancel of the live handle gesture runs `afterShiftUpPress` with the press's event, which drops the zone from the selection (`:612`, `:1249`, `:1594`), so the new start finds no zone and answers `null`; the empty-handle prototype reproduces it through Capture, the next move throwing (`~/taceng/drawv2-eval-runs/h26-readings/ib/reading-2/prototypes/empty-handle.mjs`). H26.2 keeps this exactly, `pressMatched`'s `cancel` and then its `start` falling in today's order (section 5, step 1), and changes only what a cancel of the gesture it leaves does, above; acceptance step 4 holds both.

---

## 7. What this piece needs of the shared parts

`SNAP-GRID.md` section 7 is settled and built (its section 11): the repository, the vocabulary and runtime checks, the gate and its consumer test, the release workflow, how draw pins a release, the import map, the vendor mount and the architecture manifest all serve `input-binding` unchanged.\
Nothing in them changes, so `snap-grid` needs no new release.\
Where this piece differs:
- **The repository** is `apnex/input-binding`, its package `@apnex/input-binding`, laid out as 7.1 lays out a component, with `lib` `ES2022` alone -- `BigInt` is ES2020's -- `"types": []` and no DOM library: binding never sees a platform event, only the values an application hands it.
- **`package.json` `exports`** has one entry, `.`, so draw's generated import map gains one line, and `export-map.json`, of `snap-grid`'s form, maps two exports to seven capabilities under that one path, each export `{ part: 'input-binding', serves }`: `composeBindingTable` serves `declared-binding-table`, `one-binding-match`, `binding-match-trace` and `binding-overlaps`; `openGestureSession` serves `declared-gesture-session`, `press-travel` and `live-gesture`; `deferred` is empty.
- **The built size** of each half is recorded in the component's record at build -- the table's code and the session's, the exact distance among it -- since one export path and 7.2's ban on dynamic imports load both wherever either is imported, the server and the export loading the session through draw's drag grammar with none opened (D11).
- **The vocabulary check** runs both lists of 7.2 over `src/`, comments and JSDoc included, and an input component is where their words come easiest: the tester's `keyboard` and `keycap` ("a keyboard shortcut" -- write "a key"), and draw's `node` (a tree's, or the runtime's name, "Node.js", which IB13 names in prose for `CONTRACT.md` and a source comment must not -- write "a server runtime"), `link` (a comment's URL), `pipe` ("pipes the fact through"), `anchor` and `layout`, plurals and split forms caught as 7.2 settled; no contract name in section 3 holds one, checked with the check's own match, and no allowance is asked.
- **The runtime check** is 7.2's; binding names no platform global by construction.
- **Draw's side:** the dependency line and lockfile (7.5); the import map regenerated, and `tests/import-map.test.js:55-57`, which states the whole map, restated with it; the vendor mount and `tools/scan-components.mjs` serving and reading the second package unchanged; `COMPONENTS` gaining `@apnex/input-binding` with the `rules` part alone and its rulings, `MISSION_KIT` and `ALIGNMENT` restated, the architecture documents regenerated and the target's authored text edited, each with the words appendix B gives (7.7).
- **A deploy in flight** spans two components now; the window is the one 7.6 names and B403 holds, unchanged, and a cold load asks the new revision for both components' old versions, as it asked for one.

---

## 8. Decisions owed

Each is offered with a recommendation; they may be ratified together, or one at a time.\
Ratified together, all fourteen as recommended, on 2026-10-20 (`dev/DECISIONS.md` H26-6); `H26-6` stands below where the draft wrote its placeholder.

| # | Decision | Recommendation, and why |
|---|---|---|
| D1 | The boundary with `input-capture`: binding reads two properties of a fact, `at` and `button`, only of facts handed to its pointer operations; it passes every fact to the application's predicates unread otherwise, and gives back `claimed`; the whole shape of a fact is capture's contract, which inherits draw's fields and routes (section 2.4) as its starting obligation | yes: the matcher never reads a fact (`kernel/input-rules.mjs:61`); the press reads `at` (`app/src/input-state.js:40-42`); and `button` is what lets binding, not draw, decide which press a live gesture takes and which release commits it (`app/src/input.js:209`, `:595`), which the ruled reading of D6 asks. Every row is written against capture's facts, so a schema here would validate fields binding never reads and fix capture's design before it is made; weighed against binding defining a fact's kind, key, modifiers and hit, and rejected for those reasons |
| D2 | Binding is pure: no DOM, no clock, no randomness, no timer; a double click is a fact capture makes from the platform's own event; a timed trigger waits for a consumer, and its time then arrives as a field of the facts, never from a clock | yes: true to the code -- nothing in the input layers reads a clock (`app/src/input-state.js:30-31`; the one `Date.now` in `app/src/input.js` is the agreed instant's default, which no row reads) and the browser decides a double click (`app/src/capture.js:88`); a clock read here would make one recorded stream mean two things on replay (GESTURE-SYSTEM G2, G9) |
| D3 | A row is a record whose `on` and `when` are the application's pure predicates; the guard flags, the claim flag and the field naming what a row opens are named by the table's declaration, so draw's rows pass unchanged; every other property is the application's payload, never read, handed back by reference | yes: all 83 of draw's rows are already this shape, every predicate an arrow function (measured) reading its argument and values fixed when its rows were built; a pattern language for `on` would be the DSL `dev/RULES.md` section 6 forbids, restating 83 predicates for nothing a consumer needs; naming the fields in the declaration keeps draw's words for read-only and help out of the component without renaming a row |
| D4 | One match or none: two hits mean nothing, never the first; overlaps found by enumeration in the application's gate; no override and no priority | yes: Q3 and DG2 as built (`dev/RULES.md` section 11), B262 held with its trigger; the trace defines the match, so what a tester highlights and what an input runs cannot disagree |
| D5 | Guards declared per table, each a state, a row flag, its default and one of three refusal forms | yes: the three forms are every way a state and a flag can refuse a row monotonically, and draw's four guards (`kernel/input-rules.mjs:56-57`) are exactly four such declarations; fixed guards would put draw's read-only lock and help overlay into the component |
| D6 | The gesture lifecycle is a session the application opens and owns, one per input surface, holding the press and the one live gesture. Four things are told apart: which phase is due -- binding's, from the inputs and the declared gestures (IB11), the application's requests checked against the same rules; the state transition -- binding's; dispatching to the phase's code -- the application's, on an outcome naming the phase; and the code itself -- the application's (B389) | yes, and confirmed by the director on 2026-10-20, asked what H26-1's "runs" means: binding decides when each phase is due and reports it, and draw runs its own code for the phase -- to be recorded as a ruling at ratification. Weighed against binding calling the application's bodies: draw's commit starts a chained gesture (`app/src/input.js:1150-1154`), its update turns a press into a move (`:985-995`), and its keys cancel or replace a live gesture (`:1377`, `:1447-1484`), so callbacks would need rules for re-entering binding from inside its own call, while reported phases need none, and the outcomes are the tester's live trace. Revision 1's session only recorded what draw asked (section 10.1, o:F1); revision 2 decides commit from the release's button, cancel from a lost pointer and from a press that matched, start from the matched row's declared gesture, update from each move, and a taken press from the declared button. Revision 3 makes every cancel outcome-first, draw's own included, as every commit already is: the gesture has ended when binding reports it, and draw's body runs on the report, which changes only a cancel body that throws (6.3; section 10.2, o:F1 and o:F4) |
| D7 | One threshold, declared in the units of the facts' `at` -- drawing coordinates today -- decided exactly: a press is a drag once the exact distance from its origin to a move is strictly greater; computed by a binary64 filter with a proved error bound and an exact `BigInt` fallback at the edge | yes: ECMA-262 leaves `Math.hypot` implementation-approximated, so today's answer at the edge can differ between engines, where an exact answer never does -- `snap-grid`'s D1 made the same choice; the filter decides all but a band of about 2^-49 around the threshold, and the fallback costs microseconds at the worst finite input (IB10). It changes draw only for a travel within about 10^-15 of 4 units (6.3). Measuring on screen rather than in the drawing waits for pan and zoom (H26.6), where a zoomed-out drawing would otherwise shrink the threshold on screen; registered below |
| D8 | `traceInput` now: every row's standing for one input | yes: the tester at `input.apnex.io` highlights every gesture live (H26-1), which needs every row's standing, not only the winner; defining the match from the trace makes them one computation, so it adds no second path |
| D9 | No conformance kit | yes: nothing in binding is a port another party implements, as a grid's shape is; what an application checks of its own tables is `findOverlaps`, run in its own gate |
| D10 | Draw's `rules` part alone imports the component: `kernel/input-rules.mjs` keeps `composeRules`, `resolveInput` and `overlapsIn` with their signatures as draw's adapter, `resolveInput`'s answer gaining `match`, adds `openGestures`, and the canvas opens its session through it; the part's duty becomes "Decide what an input means" | yes: as the `lattice` alone imports `snap-grid` (`SNAP-GRID.md` section 7.7) -- one module adapts if the component's interface moves, every call site and the tests that hold parity run unchanged, and the canvas and the network plugin consume `rules` already; weighed against the canvas and the network importing it directly, which would repoint 17 call sites in product code and six test files, and spread the component's interface over two parts, for nothing a consumer needs |
| D11 | One component with two capabilities -- resolution and the lifecycle -- not two components | yes: both answer what an input means, and a press opens a gesture through a row's match. A consumer of one half runs nothing of the other -- draw's drag grammar resolves with no session opened -- but loads it: one export path, and no dynamic import (`SNAP-GRID.md` section 7.2), so the server and the export load the session's code through the grammar (`network/grammar.mjs:18`). That cost is measured at build, each half's built size recorded (section 7), and a split, or a second export path, is a fracture by evidence (C0) when a consumer needs one half without the other and finds that cost too high; revision 2 said no consumer paid for the half it does not use, which held of running and not of loading (section 10.2, o:F7) |
| D12 | `@apnex/input-binding` released as `0.1.0` from `apnex/input-binding`, its one export path `.` | yes: `SNAP-GRID.md` section 7 unchanged; `0.x` until mission-kit admits it (`snap-grid`'s D9) |
| D13 | What documents the bindings reads the rows, never the component's internals: draw's help overlay reads each composed table's rows, projected from `table.rows`, in table order; `tools/gesture-table.mjs` keeps reading draw's row arrays, and `tools/reaction-table.mjs`, which reads the planner, is untouched; the component describes no row | yes: the rows are draw's one master and every projection a view of it (P3), so the overlay lists exactly the rows an input resolves against (RULES I4, A5); the input grammar a help line is written in (`app/src/help.js:9-15`) is draw's, and a component that rendered rows would carry it |
| D14 | The palette's tile drag stays draw's own mechanism in H26.2, outside the session | yes: its click rule differs from the canvas's -- 5 screen pixels, `<`, measured where the release lands, and only off the canvas (`app/src/palette.js:29`, `:167-169`) -- so moving it onto the session would change what a tile does: a press travelling 20 pixels and released 3 from where it began toggles the hand today and would be a drop. It is page chrome in screen units, and how events outside the canvas reach binding is H26.3's to design (H26 named it a second input path to clean); registered below |

**Registered on ratification (H26-6),** each with its revival trigger (RU3), as B404 to B410:
- travel measured on screen: when H26.6 designs pan and zoom, a fact may carry a screen point beside `at` and the session's declaration name which it measures;
- a timed trigger: when an application needs a hold or a double click decided by time, its time a field of the facts;
- held keys and several pointers told apart: when an application's row needs a key other than a modifier held, or a second pointer's press kept;
- the palette's tile drag outside binding: when H26.3 designs how events outside the canvas reach binding, or the palette's drag is next changed;
- the gesture state seen only by Input: when an actor other than Input -- an agent, a debug view, the lab's inspection -- needs to perceive a live gesture (section 9, A1);
- the two defects kept in 6.3: when a person reports a gesture ended by a second finger, or a handle gesture that throws on a touch screen, or when a handle's start, H24.3's deferred drop of a zone, or the handles' redraw is next changed.

---

## 9. Axiom alignment audit (M7)

**Identity.**\
H26.0 part 2 at revision 5, read against `d275205`, identical in code to `5b4997b`, and mission-kit at `b076560`, audited in three layers:
- the library: the table holds no state; the session holds the press and the live gesture between calls, which the application acts on, so the library is stateful in T1's sense -- not durable, but read back and authoritative while the session lives -- and A1 binds it, beyond the floor; it coordinates no actors and runs no model;
- the release process: unchanged from part 1, whose release layer section 9 of `SNAP-GRID.md` audited and H26.1 built;
- the consumer: draw, stateful, multi-agent and autonomous as `MISSION-KIT-ALIGNMENT.md` section 5 reads it, to which the move adds a second installed component and moves its gesture state into a session.

**Verdict.**\
Revision 1 was `revise-before-implementation`: its session recorded the phases draw asked for rather than deciding them, so H26-1's lifecycle stayed in draw; its argument forms left builders room to differ on getters, proxies, sparse arrays, present `undefined`, validation order and state identity; its inventory missed the palette's and the label editor's input paths, capture's routes and the help overlay's projection; and its kept right-button defect was an input one mouse cannot make (section 10.1).\
Revision 2 was `revise-before-implementation`, by its second reading: draw's own cancels ran their body before binding reported the cancel, against G9 (o:F1); ending the gesture before a body that throws changed behaviour it did not list (o:F4); a defect it called unreachable is reachable (o:F3); key actions that change a live gesture had no place in its phase boundary (o:F2); a `Proxy`'s traps ran application code it did not admit, and its determinism held only for getters that answer alike (o:F5, o:F6); when a malformed argument stopped the reading was open (a:F3); and a function was admitted as a point (a:F4) (section 10.2).\
Revision 3 stood: its third reading confirmed nothing blocking, and its two should-fix findings, each supported by a second family, asked for a declaration's reading order and a check of the travel's fallback independent of the fallback (section 10.3).\
Revision 4 stood: its confirming reading, scoped to its diff, found one should-fix, supported by a second family -- its declaration reading descended into an array before judging the array's form (section 10.4).\
Revision 5 is `pass, with guardrails`, by its author.

| Layer | Axiom | Weight | How the design stands |
|---|---|---|---|
| library | A3 Sovereign Composition | load-bearing | One duty, two capabilities serving it (D11); rows' semantics are the application's, injected as data and predicates (P4); binding decides phases and calls no application code but predicates, and a point's getters and a `Proxy`'s traps while it reads its arguments (D6, IB2); draw composes it through one part and keeps its editing gestures and the key actions on their working data (B389), named site by site. |
| library | A1 Sovereign State Transparency | load-bearing | Toward the limit: the session's whole state is one frozen value, `session.state`, replaced exactly when it changes, perceivable by its owner at every moment, where today it is three fields of Input (`mode`, `ctx`, the input state's press). Short of the limit, and recorded: the state is transient by design -- a reload ends every press and gesture, as the platform ends its pointer capture, and the document, which draw keeps durable, is the system's truth; and in draw only Input perceives it, projecting `isGesturing()` and `mode` to the sync layer and the situation, as today. Neither gap is widened by the move; the second is registered with a trigger (section 8). |
| library | A8 Gated Recursive Integrity | load-bearing | Section 4 holds each rule by a test that can fail; the travel is held to an exact oracle independent of its fallback, and its filter's bound is proved; draw's old matcher and press generate the corpus the component must pass. |
| library | A14 Compounding Learning | supporting | `findOverlaps` turns the ladder defects (B18, B37, B42) into a gate any application runs; the inventory's defects are registered, not fixed in passing. |
| consumer | A5 Perceptual Parity | load-bearing | What a person reads -- the help overlay, the tester's highlights -- is generated from the tables an input resolves against, and the match is defined from the trace, so the view and the behaviour cannot drift. |
| consumer | A8 Gated Recursive Integrity | load-bearing | The side-by-side tests over every table and over the lifecycle, the gesture corpus with the cancel routes and key sequences it gains, the press and release oracles, the matrix corpus, the probe and a verifier prove the move; the two behaviours it changes are named, measured or reproduced, and ruled (6.3). |
| consumer | A9 Chaos-Validated Deployment | supporting | Nothing new is claimed of a deploy: the second component rides the release, the lockfile and the import map H26.1's tests proved, and the in-flight window stays registered (B403). |
| all | A4 Zero-Loss Knowledge | supporting | Rulings recorded in draw and in the component's own record; the readings kept whole outside the repository and every finding dispositioned in section 10 with its reason. |
| all | A2, A6, A7, A10, A11, A12, A13 | not materially implicated | No trait brings A2, A11 or A12 into force -- binding reconciles nothing and runs no model; matching is deterministic code, which A11's intent asks; no seam between agents is designed (A6, A7, A10); A13 is served by asking section 8's decisions together, each with a recommendation, and by the one question the director answered (D6). |

**Tensions, and how they resolve.**
- H26-1 states the duty with an "and" against A3's law of one: one duty, what an input means, stated without the conjunction, its two capabilities answering it; D11 asks whether to split.
- P4's promotion by evidence against `traceInput`, whose consumer is not built: the tester is selected work (H26.5), and the trace defines the match, so no second path ships.
- Deciding phases against draw's state, which binding cannot see: inputs decide every phase they can; the rest are requests the same rules check (IB11), so the decision stays binding's and the causes stay draw's.
- Exactness against parity: D7 makes travel exact, and so changes draw where `Math.hypot` rounds; the change is named, measured and ruled with D7, not hidden inside the parity claim.
- Outcome-first cancels against parity: binding owning the cancel means the gesture has ended before draw's body runs, which no draw code can see except through a body that throws; that one change is named, reproduced and ruled with D6, and the teardown's `finally` keeps draw's state agreeing with the session's (6.3).
- Determinism against arguments that run code: binding cannot detect a `Proxy` and must call a `DOMPoint`'s getters, so it fixes the order of every read and promises determinism only where reading runs no application code (IB2, IB12).
- Purity against draw's actions writing `claimed` onto its events: the claim binding computes is returned, and writing it onto an event stays draw's until H26.3 designs capture's side.
- A1's limit against a press's nature: a held button is transient in the platform itself; the session holds it in one perceivable value, and the remaining distance from the limit is recorded rather than passed silently.

**Guardrails for the build.**
- G1: every site of appendix B is dispositioned as its row says (acceptance steps 2 and 3), held by a test in draw.
- G2: binding reads no fact property but `at` and `button`, and calls no application code but `on`, `when`, a point's getters and a `Proxy`'s traps, the last two only while it reads its arguments in IB2's order (I6, I8, I11).
- G3: the vocabulary check runs on `src/` comments included, its lists outside the release, and draw runs it on what it installs.
- G4: I13's corpus is generated from draw at `5b4997b`, never hand-written, and holds no word of draw's.
- G5: H26.2 changes no behaviour except the two section 6.3 names as changed, ruled with D7 and D6.
- G6: only the `rules` part imports `input-binding`, and draw's guards, claim and `opens` field are declared there once.
- G7: the session is Input's private field `#session`, which no other module can read, the language refusing it; and `tools/scan-writers.mjs` keeps refusing reads of `input.mode` and `input.ctx` outside `app/src/input.js`.
- G8: order decides nothing: I5's permutation test in the component, and draw's overlap tests over every composed table, stay in their gates.
- G9: draw runs a gesture's `start`, `update`, `commit` or `cancel` body, and a chain's start, only on an outcome naming that phase, and decides no phase itself; between phases a key's action may change the live gesture's working data and preview, and reaches the lifecycle only by a request (section 5, step 6; acceptance step 3).

**Closeout hooks.**\
H26.2's verifier re-checks G1 to G9 and acceptance steps 1 to 7; mission-kit admission is asked only after draw runs on the release (C0).

---

## 10. Reviews

H26-3 requires a multi-family reading through context-lab's review panel (M1) before ratification, and part 1 took five.\
What part 1's readings found, by kind (`SNAP-GRID.md` section 10), and where this revision answers each:

| What part 1's readings found | Where this revision answers it |
|---|---|
| claims a builder could read two ways: argument forms, freezing, ordering, ties, errors | IB2's reading rules; the Errors and What is returned paragraphs; IB3's and IB9's step tables; IB6's three passes; IB7's tie rule; IB11's tables; IB12's identity rule and outcome table |
| numerical claims not true in binary64 | IB10 states the travel in real arithmetic, computes it exactly with a proved filter, and bounds the fallback; the difference from `Math.hypot` is measured, not argued (6.3) |
| invariants a kit cannot check through its port | no kit (D9); section 4 marks each invariant by who holds it |
| draw's layer rules broken by where things are opened or imported | section 5: one importing part, consumed already by the two parts that use it; L3, L5, the neutrality pattern and the no-plugin test named; the session private to Input |
| records and tests missed | appendix B, product code and every record, allowance and test that names the moved code or the routes, from a search of the tree |
| behaviour changes not listed | 6.3, the inputs nothing in draw produces listed apart, and 6.2 for every difference that changes no outcome |
| deployment claims beyond evidence | section 7 claims nothing new of a deploy, and names the window B403 holds |

### 10.1 Reading 1 -- 2026-10-20, of revision 1 at `5b4997b`

Read cold through context-lab's review panel, `--tools on --verify`, the repositories mounted read-only, by `gemini-4-argon` (`a`), `grok-4.20-non-reasoning` (`x`) and `gpt-6-astra` (`o`), none of which drafted it, the reading kept whole at `~/taceng/drawv2-eval-runs/h26-readings/ib/reading-1/` outside the repository.\
It reported 29 findings: 13 from `o`, 5 from `x` and 11 from `a`.\
`a`'s reply was malformed and was recovered from its raw text, so its findings never reached the panel and were verified by no other family; `o` verified `x`'s five, supporting x:F3 and refuting the other four; neither `a` nor `x` returned a verdict on `o`'s thirteen.\
Every finding was read against the code here, whatever its verdicts, and the behavioural claims that could be run here were run -- the help overlay's projection, a sloppy predicate's receiver, a sparse array's indices, `snap-grid`'s reading of a transparent `Proxy`, and the exact distance's filter and fallback, whose prototypes are kept beside the reading (`exact.mjs`, `hyp2.mjs`); the palette's click rule and the Pointer Events chord sequence were read from the code and the specification, `o` having replayed both.

| Findings | What they said | Disposition, and why |
|---|---|---|
| o:F1 | the session records the phases draw requests and decides none: `pointerUp` and `pointerLost` end no gesture, and draw keeps release acceptance and cancel dispatch | **Fixed**, and central once the director confirmed the reading (D6). IB11: `pointerUp` commits by the gesture's declared `button`; `pointerLost` cancels; `pressMatched` cancels on a press that matched and starts the row's declared gesture; `pointerMove` makes update due; `pointerDown` decides a taken press; revision 1's `commitGesture` is gone, a commit being binding's alone. What stays a request -- a chain's start, a become, draw's own cancels -- is named with the reason binding cannot see its cause, and checked by the same rules. Acceptance step 3 and G9 hold draw to deciding no phase. |
| o:F2 | getters on `at` and `x` and `y` can re-enter the session, so "calls no application code" and "a refused operation changes nothing" are false | **Fixed.** IB2 rule 8: every operation reads its arguments before it reads its state; a getter's own call takes effect first; a refused operation changes nothing itself and undoes nothing a getter did; IB12 and G2 name the getters; I11 tests re-entry. |
| o:F3 | "Proxy values refused" cannot be built, and a throwing trap's refusal has no pointer or code | **Fixed.** IB2 rules 1 and 6: a transparent `Proxy` is read as its target, as released `snap-grid` reads one (run); reflection that throws makes the value of no form, refused at its pointer in a declaration (IB3's preamble) and malformed elsewhere; I1 tests both. |
| o:F4, a:F4 | arrays: holes, accessor elements, extra properties and subclasses undecided, in declarations and in `findOverlaps` | **Fixed.** IB2 rule 4: an array is dense, of `Array.prototype`, with no own string-named property but its indices and `length`; IB3: an array not of that form is `invalid-value` at its own pointer, nothing beneath it checked -- so `{ tenants: Array(1) }`, whose index 0 is no own property (run), is `invalid-value` at `/tenants`; IB8 applies the rule to `findOverlaps`, refusing with a `TypeError`. |
| o:F5 | the accessor and present-`undefined` rules contradict "any other property, which the table never reads" | **Fixed.** IB2 rule 7 and IB3's last line: those rules apply only to properties binding owns; payload is never inspected, may be an accessor or `undefined`, and its getters never run (I2). |
| o:F6, a:F6 | "replaced exactly when it changes" is undefined for equal transitions, and records' key order is open | **Fixed.** IB12: identity by field values under `===`, per record and for the state, with the equal cases named; "What is returned" fixes every record's key order as written. |
| o:F7 | "`this` undefined" cannot hold for a sloppy, bound or arrow predicate | **Fixed.** IB6: called with no receiver, as `Reflect.apply(predicate, undefined, [argument])` -- a sloppy function seeing the global object, confirmed by running one; I6 tests the call, not the predicate's `this`. |
| o:F8 | the palette's own gesture mechanism is missing from the inventory, and the session would change it | **Fixed.** Section 2.4 inventories it (`app/src/palette.js:29`, `:46-52`, `:128-174`); D14 keeps it draw's in H26.2, with its distinct rule stated and its revival trigger registered; appendix B gives its sites. |
| o:F9, x:F3, a:F11 | capture's obligations omit routes: `leave`, the typing asymmetry, the context menu, Escape's order, the label editor, absent listeners, pointer identity; and section 2.4 called capture the only event reader | **Fixed.** Section 2.4 now holds the routes, what lies outside capture and Input, and which behaviour is capture's to keep and which draw's policy; `pick.js` and `painter.js` are named as reading the events capture hands them; appendix B lists `tests/input-capture.test.js` and the label and palette tests. x:F3's right-button, Escape and label-editor items were covered in revision 1; its wheel, touch, palette and focus items are added. |
| o:F10 | the kept right-button defect describes events one mouse cannot make: Pointer Events deliver a second button as a move | **Fixed.** The claim is withdrawn; 6.3 keeps the one-press behaviour with its browser-reachable case, a second pointer, read from the code and to be shown by a browser test; section 2.4 names Pointer Events' chord sequence as capture's to keep. |
| o:F11, a:F1 | `table.rows` holds entries, not rows: handed to the help overlay unwrapped it draws nothing, and `tests/input-rules.test.js:22` maps a table | **Fixed.** Section 5 states `bindings()`'s projection exactly; a probe confirmed sections of 37, 12, 7 and 4 lines from rows and none from entries; acceptance step 5 checks the sections; appendix B restates the three test sites. |
| o:F12 | "every started gesture ends exactly once" is false: a session dropped, or a gesture never ended, has no ending | **Fixed.** IB11's "Lives": at most one ending per life, started equal to ended plus live, `become` within one life, and seeing every gesture end the application's obligation; I10 tests finite prefixes. |
| o:F13 | M7 equates freezing with A1, omits restart and authorized perception, and G7's check is not what it claims | **Fixed.** Section 9's A1 row audits queryability, ownership and restart, records the remaining gaps and registers one; G7 is scoped to the private field and the `scan-writers` rule; the audit names mission-kit's revision. |
| a:F2 | `pointerDown` must run before run mode's and the chain's early returns, and `chainFrom` must start or become by whether a gesture is live; a `null` start leaves `handle` live | **Clarified.** Section 5's numbered flow places `pointerDown` beside the input state before run mode, and gives the chain both cases; the `null` start is today's behaviour, kept and registered (6.3). |
| a:F3 | IB2's step 5 "valid flags" and step 8's suppression read two ways | **Fixed.** IB3 step 6 judges each name at its own pointer, whatever its siblings; step 9 runs only when nothing lies at or beneath `/guards`, `/claim` or `/opens`; `id`, `on` and `when` are checked at step 8 alone. |
| a:F5 | present `undefined` in declarations and gesture arguments, `findOverlaps`'s validation order and `undefined` elements, and a point's read order | **Fixed.** IB2 rules 3 and 5; IB8: all three arrays checked before any predicate, `undefined` a fact or context but never a guard state; IB11's argument forms refuse a present `undefined`. |
| a:F7 | exact distance in `BigInt` may be slow or wrong at extreme doubles, and a fast path may misjudge overflow | **Fixed.** IB10 gives the filter's precondition -- every intermediate finite and free of underflow -- and its error bound with a proof sketch, bounds the fallback's squares at 4,198 bits, and records a prototype agreeing with the oracle over 300,000 travels with extremes and costing 26 microseconds at the worst; I9 tests near `Number.MAX_VALUE` and subnormals. |
| a:F8 | `ALIGNMENT`'s new `waits` text and the target's section 9.3 wording are unstated; the deletion's other records unchecked | **Fixed.** Appendix B gives the exact words. Checked and unchanged: `UNUSED_EXPORTS` (no deleted name is in the planner baseline), `docs/ARCHITECTURE.md`'s run-time steps (none cites a triggers test), and `dev/COMMIT-DELETIONS.md` (H26.1 added no row for its deletions, which this follows). |
| a:F9 | the neutrality test refuses `drag`, `canvas`, `keymap`, `selection` and `close` in the adapter's comments | **Fixed.** Section 5 lists the pattern's words and keeps the threshold and the gestures out of the adapter; appendix B repeats it. |
| a:F10, x:F4 | the tester's `keyboard` and draw's `pipe` and `link` are traps for the component's source; draw's terms in the contract | **Fixed** for a:F10: section 7 names the traps. **Not changed** for x:F4, as `o` found: the contract names no word of either list -- checked with the vocabulary check's own match over every name in section 3 -- and draw's flag names appear only in draw's declaration (section 5). |
| x:F1 | draw's guards and claim are pulled into the contract | **Not changed**, as `o` found: IB5 and IB7 define guards and claims a consumer declares; draw's four and its claim are draw's adapter's data (section 5). |
| x:F2 | predicate throws, non-boolean answers, call order, first refusal and `claimed` read two ways | **Not changed**, as `o` found: IB6 and IB7 state each, and section 4's IB6 and IB7 tests cover `0`, `''`, an object, a throw and the call order. |
| x:F5 | D6 and D11 under-argued; B389's sites not listed | **Not changed**, as `o` found: D6 gave the re-entry example and is now confirmed by the director; D11 gives the fracture criterion; appendix B marks the bodies *stays* under B389. |

### 10.2 Reading 2 -- 2026-10-20, of revision 2 at `e131855`

Read cold through context-lab's review panel, `--tools on --verify`, the repositories mounted read-only, by the same three, `gemini-4-argon` (`a`), `grok-4.20-non-reasoning` (`x`) and `gpt-6-astra` (`o`), none of which drafted it, the reading kept whole at `~/taceng/drawv2-eval-runs/h26-readings/ib/reading-2/` outside the repository.\
It reported 22 findings: 10 from `a`, 7 from `o` and 5 from `x`; 9 blocking, 10 should-fix and 3 minor.\
Every reply parsed; `o` verified `a`'s ten and `x`'s five, supporting a:F3 and a:F4 and refuting the other thirteen; neither `a` nor `x` returned a verdict on any finding, so `o`'s seven were verified by no other family.\
Every finding was read against the code at `e131855`, whatever its verdicts, and each behavioural claim was run, with the prototypes kept beside the reading in `prototypes/`: the empty-handle sequence and a throwing cancel (`empty-handle.mjs`), the readers of `mode` and `isGesturing` while a cancel body runs, over twelve routes (`cancel-readers.mjs`), Shift over a live move released with no move (`shift-no-move.mjs`), a `Proxy`'s traps under descriptor reads and a counting getter (`proxy-traps.mjs`), every row draw's tests compose against IB3's row form (`row-forms.sh`), and section 3's names against both vocabulary lists (`vocabulary.mjs`).

| Finding | What it said | Disposition, and why |
|---|---|---|
| a:F1 | a row without the `opens` field, when `opens` is declared, could get `opens` `undefined`, and the entry's key order is open | **Clarified.** As `o` found, IB4 admitted only a name or `null`; it now says so for a row with no own property of the field's name, refuses one present as `undefined` at step 9, and fixes the entry's key order whatever the declaration; IB3's tests name both cases. |
| a:F2 | `startGesture`'s `row` given as `null`, and a call with no argument, read two ways | **Clarified.** As `o` found, IB11 and IB2 rule 3 already refused both; IB11 now says so outright, and IB11's tests name them. |
| a:F3 | when a malformed argument stops the reading is open, so a getter after it may or may not run | **Fixed.** IB2 rule 8 and its table: a declaration is read whole, each reflection at most once; every other function reads in a fixed order, checks each read as it is made, and throws at the first malformed, reading nothing after it; a point's `x` and `y` are read together before either is checked, as `snap-grid` reads a point. The finding's three inputs now each have one answer: an accessor `at` throws with no getter called, a `NaN` `x` has its `y` read and then throws, an undeclared `gesture` throws before `from` is read; I11 tests each stop. |
| a:F4 | "any non-null object" admits a function as a point or a fact | **Fixed**, as `o` supported: a point and a pointer fact are each a non-null value whose `typeof` is `'object'` (section 3.2, IB1, IB2 rule 5), as `SNAP-GRID.md` section 11 and revision 1 had it; I8 tests it. |
| a:F5 | an outcome's key order with its further field is open | **Clarified.** As `o` found, the base form then the further field was determinate; IB12's table now writes each outcome's whole form. |
| a:F6 | whether a `duplicate-field` from step 6 suppresses step 9 | **Clarified.** As `o` found, step 9's "no problem" already included it; step 9 now names it. |
| a:F7 | which capabilities each export serves in `export-map.json` is unstated | **Fixed.** Section 7 states both entries. `o` refuted it as clear from the contract; but `snap-grid`'s two grid exports each list every grid capability, so a builder following that file could list all seven under both. |
| a:F8 | tests that read `app/src/input.js` as text, and acceptance step 3's test file, are missing | **Fixed in the inventory.** As `o` found, none breaks unless the edit reshapes the text; but the shape the edit must keep was unstated. Section 2.3 lists the tests that slice, count or scan the file, appendix B gives them a row, and acceptance step 3 names its test, `input-binding-move.test.js`. |
| a:F9 | `composeRules`'s `{ owner, rules }` against `rows`; `scan-dead` and `scan-layers` unconsidered; a test row the stricter form refuses | **Fixed in part.** The mapping to `{ owner, rows: rules }` is stated (section 5, appendix B). Checked and unchanged: `tools/scan-dead.mjs` -- `openGestures` has a product caller, so no allowance -- and `tests/scan-layers.test.js` and its fixtures, which name neither the matcher's internals nor `app/src/triggers.js`. The refused test row was measured rather than argued: 18,188 rows composed by 230 tests, none refused (6.3). |
| a:F10 | "Node" in IB13 and section 7 is a listed word a builder may copy into `src/` | **Fixed.** "Node.js" where the runtime is meant, in IB13 and acceptance step 7, and section 7's trap names it as prose a source comment must not copy. `o` refuted it as a builder's mistake; the warning costs a clause. |
| o:F1 | draw's own cancels run the body before `cancelGesture`, against G9 and acceptance step 3 | **Fixed**, confirmed against the code: section 5 step 5 and G9 could not both hold. Every cancel is outcome-first now: `cancelDrag` calls `pointerLost` or `cancelGesture` and runs the body the outcome names, its teardown in a `finally` (section 5, step 4). The order changes for draw's own cancels, and 6.2 shows it unseen by draw: over twelve cancel routes no draw code read `mode` or `isGesturing` while a body ran, and the run's control reproduced `o`'s observation with an observer of the probe's own. |
| o:F2 | key actions that change a live gesture -- Shift's redraw -- have no place in the phase boundary | **Fixed**, reproduced: Shift redraws a live move with no pointer move, and the release commits that frame (section 2.3, item 7). Key actions are draw's, changing the working data between phases and the lifecycle only by a request (IB11; section 5, step 6; G9; acceptance step 3); appendix B lists the key handlers; acceptance step 4 adds the Shift sequences released with no move. |
| o:F3 | the empty-handle start is reachable, against revision 2's "unreachable" | **Fixed**, reproduced through Capture: the claim is withdrawn; 6.3 gives the two-pointer sequence and keeps the start-null behaviour in today's order; acceptance step 4 holds it, and its revival trigger names it. |
| o:F4 | ending the gesture before a cancel body that throws breaks the promised parity | **Fixed, as a change named in 6.3**, reproduced: today the gesture stays live after a throwing pointer-cancel body, and the next move throws. Keeping that exactly would need draw to run the body before binding reports the cancel, against D6 and G9, or binding to keep live a gesture it reported ended; so 6.3 lists the change with both behaviours and its reason -- a commit already ends its gesture before its body -- and the `finally` that keeps the sync layer's held changes in order; acceptance step 4 holds both answers. |
| o:F5 | a `Proxy`'s traps run application code under descriptor reads, which IB12 and G2 did not admit | **Fixed.** IB2 rule 9 names traps beside getters, their effects kept when they throw; IB12 and G2 admit both; I11 adds a trap that cancels and lets `startGesture` start, and one that cancels and throws. Refusing a `Proxy` outright was considered and cannot be built: no means common to every runtime tells one from its target. |
| o:F6 | "the same sequence gives the same states" is false for a getter that answers differently each read | **Fixed.** IB12 promises it only where reading runs no application code, and says what decides an outcome where it does; I12 holds the finding's counterexample. To narrow the code that can run, a fact is read by descriptor now, so a getter runs only on a point, where draw's `DOMPoint` needs one (IB2 rules 2 and 5). |
| o:F7 | D11's "no consumer pays for the half it does not use" ignores loading | **Fixed.** D11 states the loading cost, and section 7 records each half's built size at build; the one-component recommendation stands, a split resting on that measurement. |
| x:F1 | section 2.1's citations of `kernel/input-rules.mjs` are wrong | **Not changed**, as `o` found: each was re-read at `e131855` and holds -- 79 lines, the row at `:10-22`, `composeRules` at `:40-53`, the guards at `:56-57`, matching at `:60-63`, `resolveInput` at `:66-69`, `overlapsIn` at `:72-79`. |
| x:F2 | wheel, focus, the right button, the label editor, run mode and the palette's screen pixels are missed | **Not changed**, as `o` found: section 2.4 already names each, the absent listeners, the routes, the label editor's keys, run mode's diversion and the palette's 5 screen pixels (`app/src/palette.js:29`, `:167-169`). |
| x:F3 | error messages and the order of refusals are unpinned | **Clarified in part.** Which refusal a malformed argument meets first is now fixed by IB2's order (a:F3); a message's text past its prefix stays prose, as in `snap-grid`, and the Errors paragraph says so. |
| x:F4 | gesture, press, phase and claim are draw's terms in the contract | **Not changed**, as `o` found: the 88 names section 3 gives hold no word of either list, checked again with the vocabulary check's own split; revision 3 adds no name. |
| x:F5 | revision 1's dispositions cite runs without showing them | **Fixed** where evidence was claimed and not kept: the exact distance's two prototypes are named at their paths beside reading 1 and were run again, their results given (IB10, 6.3); every behavioural claim this revision adds cites its prototype beside reading 2. |

### 10.3 Reading 3 -- 2026-10-20, of revision 3 at `355a25d`

Read cold through context-lab's review panel, `--tools on --verify`, by the same three, none of which drafted it, the reading kept whole at `~/taceng/drawv2-eval-runs/h26-readings/ib/reading-3/` outside the repository.\
The document now exceeds the panel's inline limit, so each reader read it from disk in the mounted repository rather than from its prompt.\
It reported 6 findings: none from `a`, 2 from `o` and 4 from `x`; 1 blocking, 4 should-fix and 1 minor.\
Every reader returned verdicts: `a` supported `o`'s two and `x` refuted them; `a` and `o` refuted `x`'s four.\
Every finding was read against the code at `355a25d`, identical in code to `e131855`, and o:F2's was run, its prototype kept beside the reading in `prototypes/`.

| Finding | What it said | Disposition, and why |
|---|---|---|
| o:F1 | a declaration's descriptor-read order is unspecified, so a trap that rewrites the target makes `threshold` 4 or 8 | **Fixed**, as `a` supported: IB2 rule 8 reads a declaration depth first in the order its table now gives both constructors, `threshold` before `gestures`, so the finding's declaration has one answer; IB2's tests hold both orders with it. `x` refuted it as contrived, citing a purity rule for reads the design does not have: a trap is the application's code (rule 9). |
| o:F2 | the distance prototype's fallback was its own oracle, so the sweep never checked the fallback | **Fixed**, confirmed: `exact.mjs` returns its oracle from the fallback. Reading 3's prototype writes the fallback as IB10 states it and checks it against an oracle sharing no code with it, over 300,000 random travels and 10,480 cases that all reach the fallback, with no disagreement; five mutations of the fallback each fail the built cases, one failing no random travel (IB10); I9 now asks for all three. |
| x:F1 | section 2.4 misses wheel, focus and blur, `lostpointercapture` and touch | **Not changed**, as `a` and `o` found: capture listens for none of them (`app/src/capture.js:81-93`), as section 2.4's routes say; touch reaches it as pointer events (`touch-action: none`), as they say too; and the only blur listener is the label editor's field's, under "Outside capture and Input". Checking every listener found one fact unrecorded, now in section 2.4: the palette's tile listens for no `pointercancel` (`app/src/palette.js:104`, `:128-174`). |
| x:F2 | IB11's `pressMatched` table disagrees with `app/src/input.js:612` | **Not changed**, as `a` and `o` found: `:609-612` cancels a live gesture only once a row matches, as IB11's `cancel` row says, a press no row matches never reaching `pressMatched`. The finding read "unmatched" as "matched no row", so the vocabulary now says it means not yet handed to `pressMatched`. |
| x:F3 | IB2 rule 9 does not pin a trap's order relative to the session's state | **Not changed in substance**, as `a` and `o` found: rule 9 runs every trap and getter before the state is read; rule 8 now adds that each argument is read once, so none is read after. The prototype it cites shows traps running and a getter changing its answer, not an order. |
| x:F4 | D6 and section 5 mix the session call and the body for draw's own cancels | **Not changed**, as `a` and `o` found: section 5 step 4 calls `cancelGesture` before the body, D6 makes every cancel outcome-first, G9 and acceptance step 3 require it; the order the finding cites, `app/src/input.js:1242-1249`, is today's, which 6.3 names as changed. |

### 10.4 Reading 4 -- 2026-10-20, of revision 4 at `d275205`, confirming

Read through context-lab's review panel, `--tools on --verify`, the document read from disk, by `gemini-4-argon` (`a`) and `gpt-6-astra` (`o`), scoped to revision 4's diff, the reading kept whole at `~/taceng/drawv2-eval-runs/h26-readings/ib/reading-4/` outside the repository.\
`a` found nothing; `o` reported one should-fix finding, which `a` supported.

| Finding | What it said | Disposition, and why |
|---|---|---|
| o:F1 | rule 8's depth-first reading of an array conflicts with suppressing everything beneath an array refused at its pointer: a `guards` array whose first element's trap empties `tenants` and whose second is an accessor answers `/guards` alone if read depth first, and `/guards` and `/tenants/0/rows/0/id` if its form is judged first | **Fixed**, confirmed by reading rule 8 against rule 4 and IB3's preamble: an array's form needs every element's descriptor, which revision 4 read only after descending into the elements before. Rule 8 now reads of each value all that judges it at its own pointer -- for an array, its `length`'s descriptor and each element's -- before reading anything beneath it, and descends only into a value not refused, using the values those descriptors held; `findOverlaps` reads its arrays the same way. Applied to every value, not only arrays: a throwing descriptor trap on an object refuses the object at its pointer (rule 6), so the same conflict stood there. Section 4's tests add the finding's case. |

---

## Appendix A -- `input-binding`'s vision, the draft put to the director

Ratified by the director as written, with section 8 (H26-6); `input-binding`'s `VISION.md` is made from it when its repository is.

**North star.**\
Let every application decide what an input means in one place, from rows it declares, the same way every time.

**Why it exists.**\
Applications decide what a key or a press means in ladders of `if` branches, where the order is the meaning and a check placed one line too low lets a locked client write, and they decide "click or drag", and which release ends a gesture, again in each gesture that asks.\
The help overlay, the menu and the input itself then answer the same question three ways, and drift.\
`input-binding` holds the decision once: rows declared as data, one match or none, one rule for click or drag, and one place that decides when each phase of a gesture is due, so every surface that asks gets the same answer.

**What it is.**\
An embeddable library with two capabilities: a table of declared rows that says which one row an input means in its context -- refusing ties, tracing how every row matched, and finding overlaps before they ship -- and a session that decides click or drop by one threshold and decides, for the one live gesture, when its start, its updates, its commit or its cancel are due.\
Rows, contexts and the code each phase runs are supplied by whoever asks; `input-binding` reads only what it needs and keeps no input.

**What it is not.**
- Not a listener: it never touches a platform's events.
- Not a hit tester or a renderer: what lies under a pointer, and what a gesture draws, are the application's.
- Not an executor: a row's action and a phase's code are the application's, never run by binding.
- Not a precedence engine: two rows that both match mean nothing.
- Not a clock: time, when it is needed, arrives in the facts.
- Not a network service: it never listens and never sends.

**What success means.**
- **Agreement:** what an input does, what help says it does and what a tester highlights never disagree.
- **Determinism:** one recorded stream means one thing, in every engine, on every replay.
- **Leanness:** small enough that no application would rather write its own ladder.
- **Reuse:** a second, unrelated application adopts it without a variant, a fork or a change.

**Authority.**\
Held by the director; drafted by anyone, ratified only by the director; amended, never quietly rewritten.

---

## Appendix B -- every site H26.2 touches

From the inventory of `5b4997b`, rechecked at `355a25d`, identical in code: product code, and the records that name it.\
*moves* -- asks `input-binding` through the `rules` part; *stays* -- draw's content or policy, unchanged; *kept* -- behaviour kept exactly, registered (6.3); *plumbing* -- an import, a record or a line that goes or is repointed; *unchanged* -- a site that names what moves, or lies on an input route, and needs no edit.

| Site | Today | H26.2 |
|---|---|---|
| `kernel/input-rules.mjs:40-79` | `DEFAULTS`, `composeRules`, `admitted`, `matching`, `resolveInput`, `overlapsIn` | moves: the mechanism to `input-binding`; the module becomes draw's adapter -- the three functions keep their signatures over `composeBindingTable`, `composeRules` handing each `{ owner, rules }` on as `{ owner, rows: rules }`, `resolveInput`'s answer gaining `match`, draw's guards, claim and `opens` field stated as the declaration, the duplicate-id message kept; `openGestures` added (section 5) |
| `kernel/input-rules.mjs:1-38` | the header | plumbing: restated as the adapter's, in words the neutrality pattern admits (section 5) |
| `app/src/input-state.js:19-22,34,36,40-43,47` | the press and its travel | moves: the press to the session -- `pointerDown`, `pointerMove`, `pointerUp`, `pointerLost`, a restart `from`; the pointer, the armed `w` and the chained flag stay |
| `app/src/triggers.js:17-23` | `DRAG_THRESHOLD`, `dragging`, `releaseTrigger` | moves: the threshold to the session's declaration, `dragging` to `state.press.beyond`, `releaseTrigger` to `pointerUp`'s `trigger`; the module deleted |
| `app/src/input.js:39,44-45` | imports | plumbing: `openGestures` from the `rules` part; the triggers import goes |
| `app/src/input.js:77-333` | `GESTURES`, the editing gestures' bodies | stays (B389); the session's gestures derived from the table, `link` declaring `button: 0`, `pending` and `clone-pending` `engaged: false` |
| `app/src/input.js:209` | `link`'s `ignoreUp` | moves: `link`'s declared `button`; `pointerUp` decides the commit |
| `app/src/input.js:263` | the link release's `atStart`, against `DRAG_THRESHOLD` | stays (draw's policy), reading the threshold where `app/src/input.js` names it |
| `app/src/input.js:376-378,444-458,469` | fourteen tables composed | unchanged at the call sites, `composeRules` moving beneath them |
| `app/src/input.js:496,502-503` | the input state, `mode` and `ctx` | moves: `mode` to the session's live gesture, read through a getter; the session the private field `#session`; `ctx` stays |
| `app/src/input.js:560-562` | `isGesturing` by gesture names | moves: the live gesture's `engaged` |
| `app/src/input.js:587-620` | a press | moves: `pointerDown` with the input state before run mode; `taken` in place of the check at `:595`; `pressMatched` in place of `:612` and `:618`, its `cancel` ended as `cancelDrag` ends one, with the press's event, then called again (section 5, step 1) |
| `app/src/input.js:609,662,1086,1274,1314-1318,1556-1558` | `resolveInput` calls | unchanged at the call sites, the press's reading `match` too |
| `app/src/input.js:679-688` | `beginPress` writing `mode` | plumbing: the write deleted, `pressMatched` having started the gesture |
| `app/src/input.js:690-702,709-734` | `startMove`, `startClone` | moves: `becomeGesture`; each failure path `cancelGesture` with no body run, as its `mode = null` does today |
| `app/src/input.js:945-960` | a move | moves: `pointerMove` beside the input state; the update body on `update` |
| `app/src/input.js:985-995` | `escalate` | moves: reads `state.press.beyond` |
| `app/src/input.js:1041-1049` | a release | moves: `pointerUp`'s `trigger` and `commit`; the press cleared there rather than in the `finally` (6.2) |
| `app/src/input.js:1058-1070` | `dispatchUp` | moves: runs on `pointerUp`'s `commit` alone, the context cleared before the commit body |
| `app/src/input.js:1079-1083` | `bindings()` | plumbing: `table.rows.map((entry) => entry.row)` for each table, the three release tables' rows concatenated in order (section 5) |
| `app/src/input.js:1193-1199` | `chainFrom` | moves: `becomeGesture` with `from` when a gesture is live, `startGesture` with `from` when none is; the chained note keeps the flag alone |
| `app/src/input.js:1240-1250` | `cancelDrag` | moves: `pointerLost` on a pointer cancel, `cancelGesture` for draw's own causes, then the body the outcome's `cancel` names; the context cleared and the teardown, `onGestureEnd` and `afterShiftUpPress` run in a `finally` (section 5, step 4; 6.3) |
| `app/src/input.js:1342-1350,1563-1578` | `onShiftDown`, `onShiftUp`: a live move or clone redrawn with the axis lock on or off | stays: a key action on the working data, no phase (section 5, step 6) |
| `app/src/input.js:398,877-905,1409-1412` | `addStop`, reached by `w` and by the host's plugins | stays: a key action on the working data, no phase |
| `app/src/input.js:1420-1430,1447-1484` | the digit's hop: a committed segment, then `chainFrom` | stays, its chain asking `becomeGesture` through `chainFrom` (row above) |
| `app/src/input.js:1374-1383` | `onEscape` | unchanged: Escape's order stays draw's, its cancel `cancelDrag`'s |
| `app/src/input.js:1591-1595` | `afterShiftUpPress` | unchanged, run in the cancel's `finally` and the release's, in today's order |
| `app/src/input-state.js:40,43`, `app/src/input.js:595,1041-1069` | one press for every pointer | kept (6.3): the session's one press reproduces it |
| `app/src/input.js:185-193,619` | a `handle` start that finds nothing, left live; reachable with two pointers | kept (6.3), in today's order; a throwing cancel of the gesture it leaves changed (6.3) |
| `app/src/input.js`, 27 lines reading `this.mode` (`:525`, `:561`, `:577`, `:595`, `:612`, `:947`, `:951`, `:959`, `:990`, `:1059-1060`, `:1242`, `:1261`, `:1286`, `:1314`, `:1344`, `:1377`, `:1410-1411`, `:1426-1427`, `:1487`, `:1494`, `:1556`, `:1565`, `:1576`, `:1592`) | the live gesture's name | unchanged where they stay, read through the getter; those at `:595`, `:612`, `:1059-1060` and `:1242` go with the rows above |
| `app/src/recognize.js`, `app/src/releases.js`, `app/src/keymap.js` | draw's rows | stays |
| `app/src/actions.js`, `app/src/help.js` | the labels and the overlay | stays |
| `app/src/run-mode.js`, `engine/spawn-runs.mjs:38-59`, `devices/device-panels.mjs:12-19` | run mode's rows | stays |
| `zones/zone-gestures.mjs:63-101`, `zones/zone-keys.mjs:21-39`, `devices/device-gestures.mjs:32-50`, `devices/device-keys.mjs:13-23`, `network/link-handles.mjs:50-61`, `network/link-keys.mjs:57-90`, `network/keys.mjs:38-62`, `groups/group-keys.mjs:20-40` | the plugins' rows | stays |
| `network/grammar.mjs:18,75-82` | the drag grammar composed and resolved | unchanged at the call sites |
| `engine/situation.mjs:58-70` | the situation | stays (draw's context) |
| `app/src/capture.js` | facts, routes, claims, pointer capture | stays until H26.3 (section 2.4) |
| `app/src/pick.js:53-82`, `app/src/painter.js:29-32` | the hit and the coordinates, read from the event capture hands them | stays until H26.3 |
| `app/src/palette.js:29,46-52,104,128-174` | the palette's tile drag, its own click rule and Escape, and no `pointercancel` listener | stays (D14), registered |
| `app/src/labeledit.js:80-97,148-158` | the label editor's own keys, blur and resize | stays (section 2.4) |
| `app/src/sync.js:72-84` | deferral during a gesture | unchanged: `isGesturing`, `onGestureEnd` and `cancelDrag` keep their meaning; the cancel's `finally` keeps `onGestureEnd` following every ended gesture, so a change is never applied ahead of those held (`:447`, `:473`, `:527`, `:870-879`; 6.3) |
| `app/src/compose-canvas.js:78-82`, `app/src/main.js:56-69,95-99`, `lab/src/root.js:74-78` | the composition, the palette's listener first, the help overlay | unchanged: Input's constructor is unchanged |
| `app/src/overlay.js:104-112`, `app/src/tools.js` | arming, the held tools | unchanged |
| `tools/gesture-table.mjs:16-17,26-28` | the network's rows read as arrays | unchanged; `--check` passes with no edit |
| `tools/reaction-table.mjs` | the planner's reactions | unchanged: it reads no input row |
| `package.json`, `package-lock.json` | the dependencies | plumbing: the release file pinned by its hash (`SNAP-GRID.md` section 7.5) |
| `app/index.html:8-17`, `lab/index.html:29-38` | the import map region | plumbing: regenerated, one entry more |
| `tools/layers.mjs:93-94` | `PARTS.rules`'s duty | plumbing: "Decide what an input means"; modules and consumes unchanged |
| `tools/layers.mjs:113-120,305-309` | the canvas part's modules; `LAYER.canvas` | plumbing: `app/src/triggers.js` leaves both |
| `tools/layers.mjs:358-367,432-437` | `ENTRIES.page` and `ENTRIES.lab` | plumbing: `app/src/triggers.js` leaves both |
| `tools/layers.mjs:158-161` | `COMPONENTS` | plumbing: `'@apnex/input-binding': { parts: ['rules'], by: ['H26-1', 'H26-2', 'H26-6'] }` |
| `tools/layers.mjs:172-190` | `MISSION_KIT_READ`; `input-binding`'s standing | plumbing: `'proposed in drawv2, released from its own repository, composed (H26-6)'`, the date renewed |
| `tools/layers.mjs:191-207` | `ALIGNMENT.rules`, `ALIGNMENT.canvas` | plumbing: `rules` waits `'composed (H26-6); its matcher and gesture session moved onto it at H26.2'`; `canvas` waits `'consumes it through rules (H26-6); its rows and gesture bodies stay draw\'s (B389)'` |
| `tools/layers.mjs:284` | `LAYER.core`'s note for the matcher | plumbing: restated as draw's adapter over `input-binding` |
| `tools/layers.mjs:876-994` | `UNUSED_EXPORTS` | unchanged: `kernel/input-rules.mjs` is not in the planner entry's closure, and no deleted name is in its baseline, so nothing joins `retired` |
| `tools/scan-dead.mjs:79` | the allowance for `overlapsIn` | unchanged: it stays the adapter's gate instrument, consumed by tests alone; `openGestures` needs none, `app/src/input.js` calling it |
| `tests/scan-layers.test.js:306-317`, `tests/fixtures/layers/` | the layer rules' mutations of `app/src/input.js` and their fixture manifests | unchanged: the mutations append to the file, and no fixture names `app/src/triggers.js` or the matcher's internals |
| `tools/scan-docrefs.mjs:65-310` | `ALLOW` | plumbing: `*:app/src/triggers.js` added, for the records written while it lived that cite it (`dev/design/input/GESTURE-SYSTEM.md`, `dev/BACKLOG.md`, `dev/design/unification/MISSION-KIT-ALIGNMENT.md`) |
| `tools/scan-writers.mjs:82,270-271,329-336` | Input's `mode` and `ctx` read from outside | unchanged: the session is a private field of Input (G7) |
| `dev/COMMIT-DELETIONS.md` | the deletion register | unchanged: H26.1 added no row for its deletions, and H26.2 follows it |
| `kernel/README.md:15` | the matcher's line | plumbing: restated as draw's adapter over `input-binding` |
| `docs/ARCHITECTURE.md` | generated parts and alignment | plumbing: regenerated with the manifest; its run-time steps cite no test H26.2 moves |
| `docs/ARCHITECTURE-TARGET.md` | generated parts and alignment; the authored sections 2, 4.2 and 9.3 | plumbing: regenerated; the justification chain cites `H26-6`; section 4.2's `rules` row reads "one match, or none, for an input among declared rows, and a gesture session deciding when each phase of a gesture is due, both from `input-binding` (H26-6)"; section 9.3's first sentence reads "The anchored core composes two components, `snap-grid` through its `lattice` part and `input-binding` through its `rules` part, each through that part alone (H26-1, H26-2, H26-4, H26-6; `tools/layers.mjs` `COMPONENTS`), where A-0 found it composed none." |
| `tests/input-rules.test.js` | the matcher's tests; the neutrality test; `table.map` at `:22` | moves: the matcher's tests to the component's own; the neutrality test stays on the adapter, which imports `@apnex/input-binding` alone; the owner test reads `table.rows` |
| `tests/input-state.test.js:15-19,30-37,68-84` | the press, in the state's whole value and on its own | moves: the press's tests to the component's; the state's value restated without a press |
| `tests/triggers.test.js` | the click rule | moves: to the component (IB10's tests); its "decided once" test stays in draw, restated -- `app/src/input.js` names the threshold once and the link release alone reads it |
| `tests/input.test.js:979,987` | composed tables read as arrays | plumbing: restated to `table.rows` |
| `tests/canvas-names-no-plugin.test.js:48-49` | `app/src/input.js`'s count of 9 gesture-name words | plumbing: falls to 8 -- the taken press's `this.mode === 'link'` at `:595` goes, its rule now `link`'s declared `button` -- the record lowered in the same commit; the declaration derived from `GESTURES` and `chainFrom`'s two calls sharing one name add none |
| `tests/import-map.test.js:55-57` | the whole import map | plumbing: restated with `input-binding`'s entry |
| `tests/pointer-bindings.test.js`, `tests/releases.test.js`, `tests/network-grammar.test.js`, `tests/network-transit.test.js`, `tests/canvas-gestures.test.js:198-203` | call the adapter | unchanged: they hold the parity |
| `tests/help.test.js`, `tests/canvas-keys.test.js`, `tests/canvas-facts.test.js` | read `bindings()` and its sections | unchanged: `bindings()` still hands arrays of rows |
| `tests/gesture-corpus.test.js`, `tests/fixtures/gesture-corpus.mjs`, `tests/fixtures/gesture-corpus.json` | 76 scenarios | plumbing first: the Shift sequences and cancel routes acceptance step 4 names are added, recorded from the code before the move; then unchanged, replaying byte-identical being acceptance step 5 |
| `input-binding-move.test.js`, new in `tests/` | none: a new test | plumbing: acceptance step 3's structural checks, as H26.1's `tests/grid-arithmetic-gone.test.js` held its own; and the empty-handle sequence's two answers (acceptance step 4) |
| `tests/releases.test.js:120-147`, `tests/canvas-gestures.test.js:125-126`, `tests/span.test.js:930-940` | slices of `app/src/input.js`'s text: methods by name, `GESTURES` by slot | unchanged, the edit keeping `GESTURES` one literal of slots in today's order -- `link`'s `ignoreUp` going from before its `commit:` -- and `startMove`, `startClone`, `addStop` and the release actions methods named as today (section 2.3) |
| `tests/bare-anchor.test.js:104`, `tests/input-capture.test.js:96-97`, and the tests that refuse names `app/src/input.js` once held | words counted in the file; no DOM read in it; names gone | unchanged: the edit adds no anchor word, no DOM read and none of those names |
| `tests/input-capture.test.js`, `tests/canvas-labels.test.js`, `tests/browser.test.js` (K7, K8 and the palette drop) | capture's routes, the label editor, the palette | unchanged: the routes H26.3 inherits (section 2.4) |
| `dev/RULES.md` section 11, `dev/INPUT.md` section 7, `dev/design/input/GESTURE-SYSTEM.md` | the matcher and the lifecycle as built | plumbing: each kept as written (RU2), gaining a dated line at H26.2 naming the component |
