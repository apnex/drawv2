# H26.0, part 2 -- `input-binding`

The second piece of H26's design of record (`dev/DECISIONS.md` H26-3, as H26-5 amended it).\
It designs `input-binding`, the component that decides what each input means: the one declared row it resolves to in its context, and the phase it brings a gesture to.\
It builds on part 1 (`SNAP-GRID.md`), whose section 7 -- the repository, the checks, the gate, the release, the import map -- is settled and built, and states only where this piece differs.

**Standing:** a design under review, revision 1, drafted 2026-10-20 against `6078018`; not ratified, and not yet read by the multi-family reading H26-3 requires (section 10).

---

## 1. What this decides, and what it does not

It decides:
- `input-binding`'s one duty, its vocabulary and its contract, precisely enough that an agent other than its author could build it from section 3 alone;
- the boundary with `input-capture`: what binding reads of an input fact, and what it gives back (IB1, decision D1);
- the invariants and tests that hold it, and the acceptance tests for draw's move onto it (H26.2), with every site in draw that the move touches (appendix B);
- which part of draw imports it, and what of draw's rules and gestures stays draw's (section 5).

It does not decide:
- `input-capture`'s contract -- the whole shape of a fact, the hit test, the coordinates, how a claim and a pointer capture reach the platform -- which is H26.3's piece; this one names only what capture must keep producing for binding and for draw's rows (section 2.4);
- `vector-scene`, or what lies under a point (H26.4), and the gesture tester's scope (H26.5's piece);
- the editing gestures -- marquee, handles, drag-to-move with a preview -- whose bodies stay draw's (B389);
- pan and zoom (H26.6), including whether a press's travel is then measured on screen rather than in the drawing (D7);
- a timed trigger (a hold, or a double click decided by time rather than by the platform), held keys beyond the modifiers a fact carries, or several pointers pressed at once -- none is in draw, and each waits for a consumer (section 8);
- precedence between rows (B262 stays held), bindings edited at run time (DG3), or the context panel (B265);
- the defects the inventory found (section 6.3): each is kept exactly as it is by H26.2 and registered for its own ruling.

---

## 2. What draw does with input today

Read from the code at `6078018`; appendix B lists every site, one row each, with what H26.2 does with it.

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
Their other properties are draw's payload, which the matcher passes back untouched: `run`, `gesture`, `box`, `input`, `doc`, `said`, `context`.

### 2.3 The gesture lifecycle

`app/src/input.js` (1,607 lines) holds the lifecycle and draw's editor together:
- **the slot** -- `mode`, the live gesture's name or `null`, and `ctx`, its working data (`:502-503`); `isGesturing()` is a live gesture other than `pending` or `clone-pending` (`:560-562`), which is both the guard state `gesturing` and the sync layer's reason to defer inbound changes (`app/src/sync.js:72-84`);
- **the bodies** -- `GESTURES`, eight entries, `move`, `clone`, `pending`, `clone-pending`, `handle`, `link`, `box` and `marquee`, each with some of `start`, `update`, `commit`, `cancel` and, for `link` alone, `ignoreUp` (`:77-333`);
- **a press** tracks the input state, diverts to run mode's table, lets a live `link` consume a left press, closes the label editor and the hand, resolves the press table, and only if a row matches cancels any live gesture, takes the pointer, and runs the row's action or sets `mode` and calls the gesture's `start` (`:587-620`);
- **a move** tracks the input state and calls the live gesture's `update` (`:945-960`); a `pending` press becomes a move, and a `clone-pending` one a clone, through the press-to-drag tables once the press is a drag (`escalate`, `:985-995`), and their failure paths drop the gesture with no body run (`:698`, `:712-716`, `:719`);
- **a release** computes the trigger, then, unless the gesture refuses the release (`:1061`), clears the slot before the commit body runs, so a commit may start a chained gesture (`:1041-1070`; `dev/INPUT.md` section 7, I-IN1);
- **a cancel** -- a pointer cancel, Escape (`:1374-1383`), a lock (`:577`), a document swap (`:525`), a second press that resolves (`:612`), a double click that edits (`:1286`), the sync layer's snapshot (`app/src/sync.js:82`) -- runs the cancel body while the slot still names the gesture, then clears it (`:1240-1250`);
- **a chain** starts a `link` with no press -- after a Shift release (`:1150-1154`), or replacing the live one when a digit places a node mid-drag (`:1447-1484`) -- through `chainFrom` (`:1193-1199`).

The input state (`app/src/input-state.js`, 50 lines) is one plain value folded by a pure reducer: the pointer's position, the armed `w` and the chained flag -- draw's editor notes -- and the press, where it began and the furthest it has travelled (`:34-50`).\
The triggers (`app/src/triggers.js`, 23 lines) read the press: a drag once it has travelled more than 4 canvas units, a click otherwise (`:17-23`).

### 2.4 What an input is today

`app/src/capture.js` is the only code that reads a browser event, and turns each into an input event, plain data (`:56-67`).\
It is the fact `input-capture` will produce; these are the fields, and what reads each.

| Field | Produced | Read by |
|---|---|---|
| `type` | `down`, `move`, `up`, `cancel`, `over`, `out`, `double`, `key-down`, `key-up` (`:105-112`) | the release and double-click rows (`app/src/releases.js:34-35`, `app/src/recognize.js:128`, the plugins' box and handle releases); `cancelDrag` (`app/src/input.js:1241`) |
| `button` | `evt.button ?? 0` | the press rows; `pending`'s start (`app/src/input.js:129`); `link`'s `ignoreUp` (`:209`); the chain's consumed press (`:595`) |
| `key`, `repeat` | `evt.key ?? null`, `!!evt.repeat` | the key rows and key releases; the digit and arrow actions (`:1423`, `:1509`) |
| `shiftKey`, `ctrlKey`, `altKey`, `metaKey` | each `!!` | the key and press rows; Shift's layer and ortho (`:127`, `:79`, `:93`); a double click's modifier (`:1284`) |
| `at` | pointer types only, drawing coordinates (`app/src/painter.js` `toCanvas`) | the press's travel (`app/src/input-state.js:40-42`); every gesture body and action placing at the pointer |
| `on` | pointer types only, the hit: `{ kind, id }`, and `handle` or `mark` (`app/src/pick.js:53-82`) | the press rows, through the hit facts (`app/src/recognize.js:64-86`); the idle and hover affordances |
| `region` | `down` only, run mode's controls under the press (`:38-53`) | run mode's rows; `runModePress` (`app/src/input.js:662`) |
| `onControl` | `key-down` only | the Tab action (`:1369`) |
| `claimed`, `capture` | `false`; written back by Input and the actions, and acted on by capture: `preventDefault` and `setPointerCapture` (`:97-103`) | capture |

Input also writes `trigger` onto a release event (`app/src/input.js:1043`), which the link and marquee commits read (`:263`, `:325`).

### 2.5 Time and the threshold

Nothing in the input layers reads a clock.\
A double click is the browser's `dblclick` event (`app/src/capture.js:88`), and the input state's header says time enters only with the first timed trigger (`app/src/input-state.js:30-31`).\
The one `Date.now` in `app/src/input.js` is the default of the agreed instant handed to the situation and to the simulation's rows (`:494`, `:643`, `:420`), which no row's predicate reads.

The click threshold is one number, 4, in canvas units -- the drawing's coordinates -- ruled by the director on 2026-09-30 (`dev/design/input/GESTURE-SYSTEM.md` section 13, stage 3):
- the press records the furthest `Math.hypot` distance any move has taken it from where it began (`app/src/input-state.js:36`, `:42`);
- a press is a drag when that distance is strictly greater than 4 (`app/src/triggers.js:20`), so a travel of exactly 4 is a click;
- only moves count: a release's own position is never measured (`app/src/input-state.js:43`);
- a second press of any button replaces the press, and any release or pointer cancel ends it (`:40`, `:43`);
- a chain restarts a press still held from where the chain began (`:47`).

The link release reuses the number differently -- whether the release landed within 4 units of the drag's start, `<=`, with `dist` (`app/src/input.js:263`, `app/src/snap.js:45`) -- which is draw's policy, not the trigger.

### 2.6 What is mechanism, measured again

B274 measured five modules free of the drawing app on 2026-10-01, and four of them on 2026-10-12.\
Measured again at `6078018` with part 1's vocabulary check's match (split at case changes, underscores, hyphens and digits, plurals included), comments removed:

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

So the matcher, the press and the threshold are mechanism free of draw's content; the slot that holds the live gesture is mechanism too, entangled in `app/src/input.js` with draw's editor; the tables, the situation, the armed `w`, the chain and the bodies are draw's.\
A word count is not a proof of neutrality (P4): the armed `w` holds no word of draw's and is draw's policy.

Four facts shape the design:
- the matcher never reads a fact or a context, and the press reads one property of a fact, `at`;
- every predicate draw declares is an arrow function of its argument and of values fixed when its rows were built, so rows can be handed over as they are;
- the press and the live gesture change independently: a press can be held with no gesture (a press no row matched), and a gesture can be live with no press (a chain after a Shift release);
- nothing reads a clock.

---

## 3. `input-binding`

### 3.1 Duty

Decide what each input means in its context: the one declared row it matches, and the phase it brings the gesture in progress to.

That is the whole duty.\
A gesture's phase is what an input means over time -- a move during a gesture means update, the release it accepts means commit -- so the two capabilities serve one concern (D11).\
It does not also listen to a platform's events, find what lies under a pointer, convert coordinates, draw a preview, perform an action, hold an application's situation, or read a clock -- each of those is the consumer's or another component's.

### 3.2 Vocabulary

These are the only nouns `input-binding`'s source uses for what it handles.

| Word | Meaning |
|---|---|
| input | something a person did -- a key pressed, a pointer moved -- as the application hands it over |
| fact | the value an application hands binding for one input; binding reads only its `at` (IB1) |
| point | a non-null object, not a function, with finite number properties `x` and `y` |
| row | a declared meaning: a record with an `id`, a predicate `on` over facts, an optional predicate `when` over contexts, flags, and the application's own payload |
| predicate | a pure function an application supplies, whose truthy answer means yes |
| tenant | a source of rows, named by its `owner`; tenants are composed in order |
| table | the rows of several tenants, composed once, in table order |
| context | what is true when an input arrives, as the application describes it; binding hands it to `when` unread |
| guard | a declared rule refusing rows by a state and a row's flag (IB4) |
| guard state | a record of named boolean states handed with an input |
| claim | a row's declaration that the application owns an input its `on` matches, so the platform's default action is suppressed |
| trace | for every row of a table, in order, how far it matched one input |
| hit | a row admitted by every guard whose `on` and `when` both hold |
| match | the one hit, when there is exactly one |
| overlap | a combination of fact, context and guard state in which two or more rows hit |
| session | the state of one input surface's presses and gestures between calls, opened and owned by the application |
| press | a pointer button held: where it went down and whether it has travelled beyond the threshold |
| threshold | the distance a press may travel and still be a click, in the units of the facts' `at` |
| trigger | what a release is: `click` when its press never went beyond the threshold, `drop` otherwise |
| gesture | a named, declared kind of continuous interaction an application runs |
| live | the one gesture started and not yet ended |
| engaged | a gesture's declaration that, while live, it counts as a gesture in progress for the application's guards |
| phase | a step of a gesture's life: start, update, commit, cancel, and become |

### 3.3 Contract

One capability per row.\
None requires another component's capability.\
The table keeps nothing between calls; the session keeps its state between calls for as long as its application keeps it, and so is stateful in T1's sense (section 9).

| Capability | Relation | What a consumer can depend on |
|---|---|---|
| `declared-binding-table` | provides | Tenants' rows, guards and a claim declared as data are composed into a table, or refused with every problem the declaration has, each naming where it lies (IB2, IB3). |
| `one-binding-match` | provides | The one row an input means in its context under a guard state, or none when none or several do -- never chosen by position -- and whether the input is claimed (IB4, IB6). |
| `binding-match-trace` | provides | For every row, in table order, how far it matched an input: refused by a guard, unbound, unmet, or a hit (IB5). |
| `binding-overlaps` | provides | Every combination, among the facts, contexts and guard states given, in which two or more rows hit (IB7). |
| `declared-gesture-session` | provides | A session opened from a threshold and the gestures an application declares, or refused with every problem (IB8). |
| `press-travel` | provides | Whether a press has travelled beyond the threshold, decided exactly from its moves, and whether its release is a click or a drop (IB9). |
| `live-gesture` | provides | The one live gesture: started, become another, committed or cancelled, each in its order, each started gesture ended exactly once, and whether it is engaged (IB10, IB11). |

**Errors.**\
Every function validates its arguments before it computes or changes state.\
`composeBindingTable` and `openGestureSession` never throw, for any argument: they refuse with problems.\
A malformed argument to any other function throws a `TypeError` whose message begins with the function's name: a guard state not of IB4's form; `facts`, `contexts` or `guardStates` given to `findOverlaps` that are not arrays; a fact handed to `pointerDown` or `pointerMove` that is not a non-null object, or whose `at` is not a point; a gesture argument not of IB10's form, or naming a gesture the session does not declare.\
An operation the session's state does not allow -- `startGesture` while a gesture is live, `becomeGesture` or `commitGesture` while none is -- throws an `Error`, the base constructor, whose message begins with the operation's name, and changes nothing; a malformed argument is refused before the state is consulted, so it throws the `TypeError`.\
An exception a row's predicate throws propagates unchanged, and the call that met it returns nothing and leaves nothing behind.\
Arguments are read as `snap-grid` settled at build (`SNAP-GRID.md` section 11): a fact's `at`, and a point's `x` and `y`, read once each through ordinary property access, getters called and their errors rethrown as the function's own `TypeError`; every other argument read by descriptor, a getter never called, an accessor not of any form, a symbol-named property ignored; omitted and `undefined` the same for an optional argument, and a property present with the value `undefined` malformed.\
A fact handed to a table, and a context, are never read at all.

**What is returned.**\
Every value binding returns -- an open result, a problem list, a table's `rows`, `guards` and `claim`, a trace, a match, an overlap list, a session's declaration, its state, an outcome -- is made afresh by the call that first returns it and frozen to its depth, down to but not into the caller's own values it holds.\
Those values -- a row, a fact, a context, a guard state, handed in and handed back -- are the caller's own, returned by reference and never copied, frozen or changed.

**IB1 -- The fact.**\
A fact is any value; binding reads exactly one property of a fact, `at`, and only of a fact handed to `pointerDown` or `pointerMove`.\
There the fact must be a non-null object and its `at` a point, in the units the session's threshold is stated in, each read once through ordinary property access.\
Every other fact, and every other property of any fact, binding passes unread and unchanged to the predicates the application declared, and never keeps, copies, freezes or writes.\
So the shape of a fact -- its kind, its button, its key, its modifiers, what lies under it -- is `input-capture`'s contract and the application's rows', never binding's (D1); section 2.4 lists the fields draw's rows read, which capture's design inherits as its starting obligation.\
Binding gives one thing back for capture to act on, `claimed` (IB6).

**IB2 -- A table, composed or refused.**\
`composeBindingTable(declaration)` returns `{ ok: true, table }` or `{ ok: false, problems }`.\
A declaration is a plain object -- a value whose prototype is `Object.prototype` or `null` -- holding `tenants` and, optionally, `guards` and `claim`:
- `tenants`, an array, each tenant a plain object of exactly `owner`, a non-empty string, and `rows`, an array; two tenants may share an owner;
- `guards`, an array, each guard a plain object of exactly `state`, `flag`, `default` and `refuses` (IB4);
- `claim`, a plain object of exactly `flag` and `default` (IB6).

A row is a plain object holding `id`, a non-empty string, and `on`, a function; optionally `when`, a function; optionally, for each declared guard and for the claim, a property named by its `flag`, a boolean; and any other property, which the table never reads.\
A problem is a record of exactly `pointer`, an RFC 6901 pointer into the declaration (`~` written `~0`, `/` written `~1`), and `problem`, one of the codes below.\
Problems are ordered by pointer and then by problem, each compared by UTF-16 code unit as JavaScript's `<` compares strings, and no record appears twice.\
A check that fails at a pointer suppresses every check beneath that pointer, and none at a sibling's; a member is valid when no problem lies at its pointer or beneath it.

| Step | When | Problem, at pointer |
|---|---|---|
| 1 | the declaration is not a plain object | `not-an-object` at `""`, and nothing else |
| 2 | an own property other than `tenants`, `guards` and `claim`; `tenants` absent | `unknown-property` at `/<name>`, one each; `missing-property` at `/tenants` |
| 3 | `guards` present and not an array; a guard not a plain object; a guard property other than its four, or one of them absent; `state` or `flag` not a non-empty string, or `flag` one of `id`, `on`, `when`; `default` not a boolean; `refuses` not one of the three forms of IB4 | `invalid-value` at `/guards`; `not-an-object` at `/guards/<k>`; `unknown-property` or `missing-property` at `/guards/<k>/<name>`; `invalid-value` at `/guards/<k>/<name>` |
| 4 | `claim` present and not a plain object; a property other than `flag` and `default`, or one absent; `flag` not a non-empty string or one of `id`, `on`, `when`; `default` not a boolean | `not-an-object` at `/claim`; `unknown-property` or `missing-property` at `/claim/<name>`; `invalid-value` at `/claim/<name>` |
| 5 | among valid flags -- the guards' in order, then the claim's -- one equal to an earlier one | `duplicate-flag` at the later one's `/flag` |
| 6 | `tenants` not an array; a tenant not a plain object; a tenant property other than `owner` and `rows`, or one absent; `owner` not a non-empty string; `rows` not an array | `invalid-value` at `/tenants`; `not-an-object` at `/tenants/<i>`; `unknown-property` or `missing-property` at `/tenants/<i>/<name>`; `invalid-value` at `/tenants/<i>/<name>` |
| 7 | a row not a plain object; `id` or `on` absent; `id` not a non-empty string; `on` not a function; `when` present and not a function | `not-an-object` at `/tenants/<i>/rows/<j>`; `missing-property` at `.../<j>/id` or `.../<j>/on`; `invalid-value` at `.../<j>/<name>` |
| 8 | steps 3 to 5 found no problem, and a row holds a declared flag that is not a boolean | `invalid-value` at `/tenants/<i>/rows/<j>/<flag>` |
| 9 | among rows whose `id` is valid, in table order, one whose `id` equals an earlier row's | `duplicate-id` at the later row's `/id` |

**IB3 -- What a table holds.**\
Table order is the tenants in the declaration's order, each tenant's rows in its order.\
At composition the table reads each row's `id`, `on`, `when` and declared flags, once, and holds them with the row's owner, a flag the row omits taking its declared `default`; it reads no other property of a row, then or later.\
So a row changed after composition changes no answer; the row object itself is kept by reference, and is handed back as `row` wherever an entry or a match names it, so the application reads its own payload from it.\
`table.rows` is a frozen array, in table order, of frozen entries `{ id, owner, row }`.\
`table.guards` is a frozen copy of the guard declarations, in order, and `table.claim` a frozen copy of the claim declaration, or `null`.\
A table holds no state and changes after composition in no way; any number of callers may share one.

**IB4 -- Guards.**\
A guard state is a plain object whose own properties are named states, each a boolean; a state it omits is `false`, and an omitted guard state is all states `false`.\
A guard state naming a state no guard of the table declares, or holding a value that is not a boolean, is malformed.\
A guard `{ state, flag, default, refuses }` refuses a row, under a guard state, as `refuses` says, `s` being the guard state's value of `state` and `f` the row's value of `flag`:

| `refuses` | The row is refused when |
|---|---|
| `state-and-flag` | `s` and `f` |
| `state-without-flag` | `s` and not `f` |
| `flag-without-state` | `f` and not `s` |

A row is admitted when no guard refuses it.\
Several guards may name one state; no two name one flag (IB2 step 5).

**IB5 -- The trace.**\
`table.traceInput(fact, context, guards?)` returns a frozen array of frozen records `{ id, owner, refusedBy, on, when, hit }`, one per row, in table order, computed in three passes:
1. each row's guards are applied, and `refusedBy` is the `flag` of the first guard, in declaration order, that refuses it, or `null` when it is admitted;
2. for each admitted row, in table order, its `on` is called once with the fact;
3. for each admitted row whose `on` answered a truthy value, in table order, its `when`, if it has one, is called once with the context.

`on` is `null` for a refused row and otherwise whether its call answered a truthy value; `when` is `null` for a row pass 3 does not reach, `true` for a reached row with no `when`, and otherwise whether its call answered a truthy value; `hit` is `true` exactly when `on` and `when` are both `true`.\
So each record reads as refused, unbound (`on` false), unmet (`when` false) or a hit.\
A predicate is called as a plain function, `this` undefined, with one argument, and its answer is taken as JavaScript's `if` takes it.\
Predicates are the application's, expected to be pure functions of their argument; binding calls each at most once in a call of `traceInput` or `matchInput`, and at most once for each combination in a call of `findOverlaps`, in the order above, and cannot detect a predicate that is not pure.

**IB6 -- One match, or none.**\
`table.matchInput(fact, context, guards?)` returns a frozen `{ match, claimed }`, from exactly the calls IB5 makes for the same arguments:
- `match` is a frozen `{ id, owner, row }` for the one row whose trace record is a hit, or `null` when no row hits or more than one does;
- `claimed` is `true` when some admitted row whose `on` answered a truthy value holds its claim flag `true` -- whatever its `when` answered -- and `false` otherwise, always `false` for a table with no claim.

So no permutation of tenants or of rows changes a `matchInput` answer's `match.id` or `claimed`; order decides only the order of `rows`, of a trace and of an overlap list.

**IB7 -- Overlaps.**\
`table.findOverlaps(facts, contexts, guardStates)` takes three arrays, each element of `guardStates` a guard state (IB4).\
For each guard state, then each context, then each fact -- guard states outermost, facts innermost -- it makes the calls IB5 makes, and where two or more rows hit it lists a frozen record `{ fact, context, guards, ids }`: the three values given, by reference, and `ids`, a frozen array of the hitting rows' ids in table order.\
It returns a frozen array of the records in that order, empty when there is none.

**IB8 -- A session, opened or refused.**\
`openGestureSession(declaration)` returns `{ ok: true, session }` or `{ ok: false, problems }`, problems as IB2 states them.\
A declaration is a plain object of exactly `threshold` and `gestures`:

| Step | When | Problem, at pointer |
|---|---|---|
| 1 | the declaration is not a plain object | `not-an-object` at `""`, and nothing else |
| 2 | an own property other than `threshold` and `gestures`; one of them absent | `unknown-property` at `/<name>`, one each; `missing-property` at `/<name>` |
| 3 | `threshold` not a finite number at least 0 | `invalid-value` at `/threshold` |
| 4 | `gestures` not an array; a gesture not a plain object; a property other than `name` and `engaged`, or one absent; `name` not a non-empty string; `engaged` not a boolean | `invalid-value` at `/gestures`; `not-an-object` at `/gestures/<k>`; `unknown-property` or `missing-property` at `/gestures/<k>/<name>`; `invalid-value` at `/gestures/<k>/<name>` |
| 5 | among valid names, one equal to an earlier one | `duplicate-name` at the later one's `/name` |

`session.declaration` is a frozen copy, `-0` written `0`.\
A session belongs to the application that opens it: one for each input surface whose presses and gestures form one stream, kept as long as the application keeps it, and dropped by dropping it -- nothing closes it, and two sessions share nothing.

**IB9 -- The press.**\
A session holds at most one press, `null` or `{ at, beyond }`:
- `pointerDown(fact)` makes the press `{ at, beyond: false }`, `at` a copy of the fact's, whatever press there was -- a second button's press replaces the first's;
- `pointerMove(fact)` makes the press beyond when there is a press, it is not yet beyond, and the distance from its `at` to the fact's `at` is greater than the threshold, and then its outcome's `crossed` is `true`; otherwise it changes nothing and `crossed` is `false`, and a move with no press changes nothing;
- `pointerUp()` answers `trigger`, `'drop'` when there is a press and it is beyond and `'click'` otherwise, and makes the press `null`; it reads no argument, so where a release lands never counts, only the moves before it;
- `pointerLost()` makes the press `null`, with no trigger -- the platform has taken the pointer;
- `startGesture` and `becomeGesture` given `from` (IB10), when there is a press, make it `{ at, beyond: false }`, `at` a copy of `from`.

The distance is decided exactly: with `(x0, y0)` the press's `at`, `(x1, y1)` the fact's and `t` the threshold, the press is beyond when `(x1 - x0)^2 + (y1 - y0)^2 > t^2` holds of the exact real numbers the binary64 values denote.\
It is computed exactly for every finite input -- over `BigInt` from each value's exact significand and exponent, or by a binary64 fast path wherever its error bound decides, falling back to `BigInt` where it does not -- and its tests hold it to a `BigInt` oracle (D7).\
So a travel of exactly the threshold is a click, and a press never stops being beyond except by a new press, a restart, `pointerUp` or `pointerLost`.

**IB10 -- The live gesture.**\
A session holds at most one live gesture, `null` or `{ name, row, engaged }`:
- `startGesture({ gesture, row?, from? })`, when none is live, makes `{ name: gesture, row, engaged }` live, `row` the string given or `null`, `engaged` the declared gesture's, and restarts a held press from `from` when given (IB9); when one is live it throws (Errors);
- `becomeGesture({ gesture, from? })`, when one is live, gives it the new name and that gesture's `engaged`, keeps its `row`, restarts a held press from `from` when given, and answers `was`, the gesture as it was; when none is live it throws;
- `commitGesture()`, when one is live, makes none live and answers `ended`, the gesture as it was; when none is live it throws;
- `cancelGesture()`, when one is live, makes none live and answers `ended`, the gesture as it was; when none is live it changes nothing and answers `ended: null`.

A gesture argument is a plain object: `startGesture`'s holds `gesture`, a name the session declares, and optionally `row`, a non-empty string, and `from`, a point; `becomeGesture`'s holds `gesture` and optionally `from`; any other property, `row` given to `becomeGesture` among them, is malformed.\
So at most one gesture is live, and a gesture started is ended exactly once, by `commitGesture` or by `cancelGesture`, whatever it became in between.\
Binding decides when each phase is due and holds the order; the application runs each phase's body (D6):

| Phase | Brought by | The application calls | Then runs |
|---|---|---|---|
| start | a press whose matched row names a gesture, or the application's own reason -- a chain | `startGesture` | the gesture's start body |
| update | a move while a gesture is live | `pointerMove`, whose outcome names the live gesture in its state | its update body |
| become | the live gesture turning into another -- a press becoming a move | `becomeGesture` | its own transition |
| commit | a release the live gesture accepts | `pointerUp` for the trigger, then `commitGesture` | its commit body, after `commitGesture`, so the body may start another |
| cancel | the platform taking the pointer, or the application's reason -- Escape, a lock, a document replaced, another press | `pointerLost` for the pointer, `cancelGesture` for the gesture | its cancel body, before or after `cancelGesture` as its own order requires |

**IB11 -- State and outcomes.**\
`session.state` is a frozen `{ press, gesture }`, each `null` or the record IB9 and IB10 name, `press.at` a frozen `{ x, y }`.\
It is replaced by a new value exactly when an operation changes it; an operation that changes nothing leaves the very same value.\
No coordinate in a state is `-0`: a copied coordinate is written `v + 0`.\
Each operation answers a fresh frozen outcome holding the state it leaves:

| Operation | Outcome |
|---|---|
| `pointerDown(fact)`, `pointerLost()`, `startGesture(args)` | `{ state }` |
| `pointerMove(fact)` | `{ state, crossed }` |
| `pointerUp()` | `{ state, trigger }` |
| `becomeGesture(args)` | `{ state, was }` |
| `commitGesture()`, `cancelGesture()` | `{ state, ended }` |

The same declaration and the same sequence of operations and arguments give the same states and outcomes.\
A session calls no application code, reads nothing but its arguments and its own state, and keeps nothing of a fact but a copy of its `at`; so any operation may be called from code the application runs in answer to another operation's outcome -- a commit body starting a chained gesture -- and sees the state the last operation left.

**IB12 -- Exports.**\
`@apnex/input-binding` exports `composeBindingTable` and `openGestureSession`, and nothing else; it has no subpath.\
The package imports no other package and no module particular to one runtime, touches no DOM, reads no clock and no randomness, and holds no timer, so the same files run in Node and in a browser.\
Its TypeScript declarations are generic in the fact and the context, so a consumer's predicates are typed against its own facts.

### 3.4 Fit criteria

**Does my project want this at all?**
- More than one surface -- a key, a press, a help overlay, a panel that follows the situation -- must agree on what an input means.
- You are about to write a ladder of `if` branches in which the order decides which one wins, or a read-only check placed at a line number.
- You are about to decide "click or drag" in a second place.

**It is the wrong tool when:**

| You need | Reach elsewhere, because `input-binding` is |
|---|---|
| platform events turned into facts, coordinates, a hit under the pointer | not a listener: that is `input-capture`, the hit test and coordinates the application's |
| a preview drawn, or what lies under a point | not a renderer: that is `vector-scene`, or the application |
| an action performed, an undo kept | not an executor: rows carry the application's payload, which binding never reads |
| one row to win over another by priority | not a precedence engine: two hits mean nothing, and an overlap fails the application's gate |
| a hold, or a double click decided by time | not yet: binding reads no clock, and a timed trigger waits for a consumer, its time then a field of the facts |
| several pointers pressed at once, or held keys tracked | not yet: one press, and the modifiers a fact carries |
| bindings a person edits while the application runs | not a store: rows are source, composed once |

### 3.5 Adjustment policy and edges

Internal and sovereign: a measured gap is recorded where both sides can see it, then resolved by adjusting `input-binding` or by fracturing it if the gap reveals a second duty; never forked.

**Contains:** the binding table and the gesture session.\
**Consumes:** nothing.\
**Consumed-by:** draw (H26.2), then the gesture tester (H26.5).

The tester needs three things of binding: its own tables, matched as draw's are; every row's standing for each input, to highlight every gesture live (`traceInput`, D8); and the session's state after each operation, to show a press becoming a drag and a gesture's phase (IB11).\
It draws its keys and its pointer from capture's facts, which binding does not read.

---

## 4. Invariants and tests

There is no conformance kit (D9): nothing in `input-binding` is a port another party implements.\
*`input-binding`* marks what the component's own tests hold; *gate* what its gate holds; *draw* what draw's tests hold at H26.2.

| # | Invariant | Held by |
|---|---|---|
| I1 | `composeBindingTable` and `openGestureSession` never throw for any value, and answer every declaration with exactly the problems IB2 and IB8 give, from a table of cases, escaped pointers and code-unit order among them. | `input-binding` |
| I2 | A table reads each row once: a row changed after composition changes no answer, and `match.row` and every entry's `row` are the declared object itself (`===`). | `input-binding` |
| I3 | For every guard form, state and flag, a row is admitted exactly when no guard refuses it; and draw's four guards (section 5), over all 128 combinations of their four flags and three states, admit exactly what `kernel/input-rules.mjs:56-57` admits. | `input-binding` |
| I4 | `matchInput`'s `match` is the one hit of `traceInput` for the same arguments, or `null` when there are none or several; `claimed` is as IB6 states -- over generated tables, facts, contexts and guard states. | `input-binding` |
| I5 | Order decides nothing: for every permutation of tenants and of rows in a generated table, every `matchInput` answer's `match.id` and `claimed` are unchanged. | `input-binding` |
| I6 | Spies count every predicate call and its order: each admitted row's `on` once, each reached row's `when` once, every `on` before any `when`, each in table order; a throwing predicate's exception propagates, and the table answers the next call as before. | `input-binding` |
| I7 | `findOverlaps` lists exactly the combinations in which two or more rows hit, in IB7's order, with `ids` in table order. | `input-binding` |
| I8 | Binding reads no property of a fact but `at`, and that only in `pointerDown` and `pointerMove`, and writes none: a `Proxy` fact records every read; frozen facts, contexts, rows and guard states are accepted. | `input-binding` |
| I9 | The press's `beyond` and `trigger` agree with an exact `BigInt` oracle over generated streams and over points targeted within 10^-15 of the threshold, on both signs, near the origin and far from it; a release's position never changes a trigger. | `input-binding` |
| I10 | Over generated sequences of operations, at most one gesture is live; every started gesture ends exactly once, by commit or cancel; every refused operation throws and changes nothing. | `input-binding` |
| I11 | Every state is frozen to its depth and holds no `-0`; it is replaced exactly when an operation changes it; the same sequence gives the same states and outcomes. | `input-binding` |
| I12 | The table and the press reproduce draw's: a corpus generated once from draw's `kernel/input-rules.mjs`, `app/src/input-state.js` and `app/src/triggers.js` at `6078018` -- tables stated as data with no word of draw's, which the test turns into predicates, and streams of presses and moves -- passes, except the press points within the exact band, which the corpus lists apart, each with draw's answer and the exact one (D7, section 6.3). | `input-binding` |
| I13 | The source names no consumer's vocabulary, and the built files import no package and no runtime-specific module or global (`SNAP-GRID.md` section 7.2). | gate |

**Each rule's own tests,** in `input-binding`'s `test/contract/`, one file per capability:
- IB2 and IB8: the refusal tables of I1, every step's rows, a problem beneath one member never suppressing its sibling's, step 8 skipped after a problem in steps 3 to 5, accessors and `Proxy` values refused without a getter called;
- IB3 and IB4: defaults applied to omitted flags; each refusal form at each of its four combinations; an undeclared state and a non-boolean value refused with the function's name;
- IB5 and IB6: a row refused by two guards naming the first; `on` answering `0`, `''` and an object; `claimed` with a hit, with an unmet `when`, with two hits, and with no claim declared;
- IB7: an empty answer, an overlap under one guard state alone, and the nesting order;
- IB9: a travel of exactly the threshold, one binary64 step beyond it, a move with no press, a second press, a restart with and without a press held, and the I9 oracle;
- IB10: every operation in each state, the refusals, `row` kept through `becomeGesture`, `engaged` following the declared gesture;
- errors: each function refusing each malformed argument with the error and message the Errors paragraph names; every answer frozen to its depth, and no argument frozen.

**Acceptance for H26.2, draw on `input-binding`:**
1. `input-binding` is released from its repository by its CI, and draw's lockfile pins the release file by its hash.
2. Every site appendix B marks *moves* asks `input-binding` through draw's `rules` part, and only that part imports it; every site marked *stays* is unchanged; every site marked *kept* keeps its behaviour exactly and cites its backlog row.
3. `app/src/triggers.js` is deleted; `app/src/input-state.js` holds no press; `kernel/input-rules.mjs` holds no matching, guard or overlap code of its own, only draw's declaration and the calls through; `app/src/input.js` assigns no `mode`, reading it from the session; a test in draw finds each of these, and finds no distance measured in `app/src/input.js`, `app/src/input-state.js` or `kernel/input-rules.mjs` but the link release's `atStart` (`app/src/input.js:263`).
4. Before anything is deleted, a test in draw runs the old matcher and the adapter side by side over every table section 2.2 lists, on the product page's and the lab's compositions, with the facts, situations and guard states draw's tests enumerate, and finds every answer's row id and claim equal; and runs the old press and the session side by side over generated streams, finding no difference beyond those section 6.3 lists as changed, each of which it holds with both answers.
5. Draw's full gate passes: the gesture corpus's 76 scenarios replay byte-identical (`tests/gesture-corpus.test.js`), the old press table's 504 combinations (`tests/pointer-bindings.test.js`) and the release tables' oracles (`tests/releases.test.js`) agree, the help overlay is identical, `tools/gesture-table.mjs --check` passes with no edit, and the matrix corpus's boards match in real Chrome.
6. The probe against production, each side on its own dependencies, finds no pixel or style changed, and an independent verifier passes the move.
7. The product page, the lab page, the server and the export load the one release: the pages through the import map, Node by name -- the server and the export load it because the network plugin's drag grammar does (`network/grammar.mjs:18`).

---

## 5. What draw supplies, and what stays draw's

**Draw supplies its rows,** every one of the 83 of section 2.2, unchanged: the product's keys, presses, double click, key releases and release tables; run mode's rows; each plugin's presses, keys, box and handle releases; and the network's drag grammar.

**Draw states its guards and its claim once,** in its `rules` part, as the declaration every table it composes is given -- exactly the guards `kernel/input-rules.mjs:40,56-57` applies today:

| `state` | `flag` | `default` | `refuses` |
|---|---|---|---|
| `readOnly` | `mutates` | `true` | `state-and-flag` |
| `readOnly` | `whileReadOnly` | `false` | `flag-without-state` |
| `helpOpen` | `duringHelp` | `false` | `state-without-flag` |
| `gesturing` | `duringGesture` | `false` | `state-without-flag` |

and the claim `{ flag: 'prevent', default: true }`, as `kernel/input-rules.mjs:68` reads `prevent !== false`.

**Draw opens one session for each Input,** in `app/src/input.js`, its declaration the threshold of 4 canvas units the director ruled on 2026-09-30, named once there, and the eight gestures of `GESTURES`, `pending` and `clone-pending` declaring `engaged: false` and every other `engaged: true` -- the set `isGesturing` names today (`:560-562`).

**Draw supplies its contexts and its facts** as today: the situation (`engine/situation.mjs:58-70`), the facts each gesture hands its release table, `null` for the drag grammar; and capture's input events (section 2.4).

Where each is opened follows draw's layer rules and its parts' declared consumes:
- only the `rules` part imports `input-binding` (`tools/layers.mjs` `COMPONENTS`, section 7; D10); `kernel/input-rules.mjs` keeps `composeRules(...tenants)`, `resolveInput(table, input, situation, guards)` and `overlapsIn(table, inputs, situations, guardStates)` with today's signatures and answers -- `{ rule, claimed }` with `rule` the declared row, and records `{ input, situation, guards, ids }` -- over `composeBindingTable`, throws loudly at load for a refused declaration with today's message for a duplicate id (`input rule '<id>' is brought by both <owner> and <owner> -- an id names one row`), and adds `openGestures(declaration)`, which opens a session or throws loudly with its problems;
- the canvas and the network plugin already consume `rules` (`tools/layers.mjs:100-120`), so neither gains an edge: the canvas opens its session and composes its tables through `rules`, and `network/grammar.mjs` composes and resolves its two tables through it, unchanged;
- `kernel/` imports nothing from `model/` (L3), and the adapter, a core module, names no plugin's kind (`tests/core-names-no-plugin.test.js`) and no tenant's word (`tests/input-rules.test.js`, whose neutrality test keeps reading it, comments and strings included), and its exports -- `composeRules`, `resolveInput`, `overlapsIn`, `openGestures` -- match no name L5 refuses in the core;
- the session is a private field of Input, so no module outside `app/src/input.js` can read the gesture state, which `tools/scan-writers.mjs:82` already forbids for `mode` and `ctx`; `mode` is read through a getter over the session, so its 27 reading sites are unchanged.

**Stays draw's,** because it is draw's content or policy:
- the rows themselves, the action labels (`app/src/actions.js`), the help overlay and its input grammar (`app/src/help.js`), and the situation (`engine/situation.mjs`);
- the editing gestures' bodies, their previews and their working data, `ctx` (B389);
- what a press becomes when dragged, as rows (`app/src/releases.js:93-99`), and that a resolved press cancels the live gesture first (`app/src/input.js:612`);
- the chain: the armed `w`, the chained flag, a live `link` consuming a left press, and when a chain starts or replaces a gesture (`app/src/input-state.js`, `app/src/input.js:595`, `:1193-1199`);
- run mode's diversion before any press table (`:592`), and closing the label editor and the hand on a press (`:597-598`);
- the lock, the help overlay's state, and when each cancels a gesture; the sync layer's deferral (`app/src/sync.js:72-84`);
- `claimed`, `capture` and `trigger` written onto draw's own event objects, which capture acts on, until H26.3 designs how a claim reaches the platform;
- capture and the hit test (`app/src/capture.js`, `app/src/pick.js`), until H26.3;
- the help overlay reads `bindings()` (`app/src/main.js:99`), which hands each composed table's rows in table order, so `helpSections` and its lines are unchanged;
- the generated tables: `tools/gesture-table.mjs` reads the network's row arrays directly (`:16-17`, `:26-28`) and needs no edit, and `tools/reaction-table.mjs` reads the planner's reactions, not input at all.

---

## 6. How the parity is kept

Draw's inputs must mean what they meant, row for row, and its gestures must commit what they committed, byte for byte.

### 6.1 Four tests from three sides

I12 holds `input-binding` to draw's matcher and press as neutral cases; acceptance step 4 holds draw's move from draw's side, old against new, over every table draw composes; the gesture corpus, the press and release oracles already in draw's tests, and the matrix corpus hold what draw does with the answers; the probe holds what is drawn.

### 6.2 The differences a careful reader looks for

- **The row handed back.** `composeRules` copied each row with its defaults and its owner (`kernel/input-rules.mjs:49`), and `resolveInput` answered the copy; it answers the declared row now. No product module reads `owner` or a defaulted flag from an answer, and the help overlay reads `input`, `said`, `doc`, `context`, `run` and `gesture`, which every declared row carries; two tests read `owner` from a composed table, and read `table.rows` instead (appendix B).
- **A table is no longer an array.** Draw iterates a composed table in one product site, `bindings()` (`app/src/input.js:1079-1083`), which reads each table's `rows`; the help overlay's lines are unchanged.
- **`this` in a predicate.** Today a predicate is called as a method of the composed copy (`kernel/input-rules.mjs:61-62`); it is called as a plain function now; every predicate draw declares is an arrow function (measured), so none reads `this`.
- **The order of calls.** Kept: guards, then every admitted row's `on` in table order, then every bound row's `when` (`kernel/input-rules.mjs:61-62`), so a predicate is asked exactly as before.
- **The press cleared before the commit body.** Today the release clears the press in its `finally`, after the commit (`app/src/input.js:1045`); `pointerUp` clears it before. No commit body reads the press: the one that touches it, a chain's note restarting a held press (`app/src/input-state.js:47`), leaves it cleared either way, and the press is `null` after both.
- **The slot cleared around the bodies.** Kept: a press starts its gesture before the start body runs (`app/src/input.js:618-619`); a release commits before the commit body (`:1064`, `:1069`); a cancel runs the cancel body before the gesture is cancelled (`:1242-1243`).
- **Engaged by declaration.** `isGesturing` names `pending` and `clone-pending` (`:561`); the session declares those two not engaged and every other engaged, the same set.
- **The travel distance.** The press no longer keeps how far it went, only whether it went beyond; `travelled` had one reader, `dragging` (`app/src/triggers.js:20`).
- **Two buttons, one press.** Kept: a second button's press replaces the first's, and any release ends it (6.3).
- **Guard states.** Draw passes booleans in every guard state it hands (`app/src/input.js:609`, `:662`, `:1086`, `:1274`, `:1314-1318`, `:1556-1558`; none at `network/grammar.mjs:79`), and names only the states its guards declare, so the stricter check refuses nothing draw passes.
- **The threshold's arithmetic.** `Math.hypot` against an exact distance, at the edge (6.3).

### 6.3 Defects the inventory found, and what H26.2 changes

H26.2 is an extraction: it keeps every behaviour of draw's, defects included, except those it changes below, each made by D7 and ruled with it.

**Changed by H26.2:**
- a press whose travel lies within about 10^-15 of the 4-unit threshold -- one unit in the last place of 4 -- is decided by the exact distance, where `Math.hypot`'s rounding decided it: over 2,000,000 travels generated within 5 x 10^-13 of 4 units, at origins across the drawing, about 900 (0.05%) were decided the other way, every one within 10^-15 of 4, measured; over a quarter-unit lattice of moves from one press none differs. ECMA-262 leaves `Math.hypot` implementation-approximated, so at those points today's answer may also differ between browsers, and the exact one does not (D7).

**Inputs nothing in draw produces, which now behave differently** -- listed so that this section is exhaustive for every input a pointer, a key or a declared row can produce:
- a row whose `on` is not a function, whose `when` is present and not a function, whose `id` is not a non-empty string, or which holds a flag that is not a boolean, is refused when draw loads, where today `on` threw at the first resolve and a flag was read by its truthiness; none of draw's 83 rows has one (measured);
- a predicate that reads `this`: none of draw's does;
- a pointer fact whose `at` is not a point with finite coordinates makes `pointerDown` and `pointerMove` throw, where today the travel became `NaN` and every release a click; a pointer event's coordinates are finite;
- a guard state naming a state no guard declares, or holding a value that is not a boolean, makes the call throw, where today the name was ignored and the value read by its truthiness; draw passes neither.

**Kept, each registered for its own ruling:**
- one press for every button: a right press that matches no row, and its release, during a left `link` drag, end the press (`app/src/input-state.js:40`, `:43`; the gesture refuses the right release, `app/src/input.js:1061`), so the left release is a click however far it travelled, and released within 4 units of the drag's start it selects the source (`app/src/releases.js:40`, `:54-56`) where a drop there discards the drag (`:58`);
- a `handle` press whose start finds no entity -- its lone selected entity gone, or a re-plugged link's fixed end -- leaves `handle` live with an empty context (`app/src/input.js:185-193`, `:619`), so each move throws until the release, whose commit throws too (`:172-173`, `:153-155`); unreachable in a live page, the handles being redrawn whenever the selection or their entity changes (`:517`, `:522`), and kept exactly, since the bodies are draw's.

---

## 7. What this piece needs of the shared parts

`SNAP-GRID.md` section 7 is settled and built (its section 11): the repository, the vocabulary and runtime checks, the gate and its consumer test, the release workflow, how draw pins a release, the import map, the vendor mount and the architecture manifest all serve `input-binding` unchanged.\
Nothing in them changes, so `snap-grid` needs no new release.\
Where this piece differs:
- **The repository** is `apnex/input-binding`, its package `@apnex/input-binding`, laid out as 7.1 lays out a component, with `lib` `ES2022` alone -- `BigInt` is ES2020's -- `"types": []` and no DOM library: binding never sees a platform event, only the values an application hands it.
- **`package.json` `exports`** has one entry, `.`, so draw's generated import map gains one line, and `export-map.json` maps two exports to seven capabilities.
- **The vocabulary check** runs both lists of 7.2 over `src/`; ordinary English a binding source might reach for is on draw's list -- `node` (a tree's, or "Node 22" in a comment), `anchor`, `layout` -- and is refused, so the source says neither; no allowance is asked.
- **The runtime check** is 7.2's; binding names no platform global by construction.
- **Draw's side:** the dependency line and lockfile (7.5); the import map regenerated, and `tests/import-map.test.js:55-57`, which states the whole map, restated with it; the vendor mount and `tools/scan-components.mjs` serving and reading the second package unchanged; `COMPONENTS` gaining `@apnex/input-binding` with the `rules` part alone and its rulings, `MISSION_KIT` and `ALIGNMENT` restated, the architecture documents regenerated and the target's authored text edited (7.7, appendix B).
- **A deploy in flight** spans two components now; the window is the one 7.6 names and B403 holds, unchanged, and a cold load asks the new revision for both components' old versions, as it asked for one.

---

## 8. Decisions owed

Each is offered with a recommendation; they may be ratified together, or one at a time.

| # | Decision | Recommendation, and why |
|---|---|---|
| D1 | The boundary with `input-capture`: binding reads one property of a fact, `at`, of a fact handed to `pointerDown` or `pointerMove`; it passes every fact to the application's predicates unread, and gives back `claimed`; the whole shape of a fact is capture's contract, which inherits draw's fields (section 2.4) as its starting obligation | yes: it is what the code does -- the matcher never reads a fact (`kernel/input-rules.mjs:61`), the press reads `at` alone (`app/src/input-state.js:40-42`) -- and every row is written against capture's facts, so a schema here would validate fields binding never reads and fix capture's design before it is made; weighed against binding defining a fact's kind, button, key, modifiers and hit, and rejected for those reasons |
| D2 | Binding is pure: no DOM, no clock, no randomness, no timer; a double click is a fact capture makes from the platform's own event; a timed trigger waits for a consumer, and its time then arrives as a field of the facts, never from a clock | yes: true to the code -- nothing in the input layers reads a clock (`app/src/input-state.js:30-31`; the one `Date.now` in `app/src/input.js` is the agreed instant's default, which no row reads) and the browser decides a double click (`app/src/capture.js:88`); a clock read here would make one recorded stream mean two things on replay (GESTURE-SYSTEM G2, G9) |
| D3 | A row is a record whose `on` and `when` are the application's pure predicates; the guard flags and the claim flag are named by the table's declaration, so draw's rows pass unchanged; every other property is the application's payload, never read, handed back by reference | yes: all 83 of draw's rows are already this shape, every predicate an arrow function (measured) reading its argument and values fixed when its rows were built; a pattern language for `on` would be the DSL `dev/RULES.md` section 6 forbids, restating 83 predicates for nothing a consumer needs; naming the flags in the declaration keeps draw's words for read-only and help out of the component without renaming a row |
| D4 | One match or none: two hits mean nothing, never the first; overlaps found by enumeration in the application's gate; no override and no priority | yes: Q3 and DG2 as built (`dev/RULES.md` section 11), B262 held with its trigger; the trace defines the match, so what a tester highlights and what an input runs cannot disagree |
| D5 | Guards declared per table, each a state, a row flag, its default and one of three refusal forms | yes: the three forms are every way a state and a flag can refuse a row monotonically, and draw's four guards (`kernel/input-rules.mjs:56-57`) are exactly four such declarations; fixed guards would put draw's read-only lock and help overlay into the component |
| D6 | The gesture lifecycle is a session the application opens and owns, one per input surface, holding two independent slots -- the press and the one live gesture -- whose operations the application calls and whose outcomes report each phase; the application runs each phase's body | yes, weighed against binding calling the application's start, update, commit and cancel itself: draw's commit starts a chained gesture (`app/src/input.js:1150-1154`), its update turns a press into a move (`:985-995`), and its keys cancel or replace a live one (`:1377`, `:1447-1484`), so callbacks would need rules for re-entering binding from inside its own call, while operations need none -- each sees the state the last left -- and keep binding free of application code but predicates; the outcomes are also the tester's live trace. H26-1's "a gesture's start, update, commit and cancel run" is read as sequenced: binding decides when each phase is due and that each gesture ends exactly once, and the editing bodies stay draw's (B389) |
| D7 | One threshold, declared in the units of the facts' `at` -- drawing coordinates today -- decided exactly: a press is a drag once the exact distance from its origin to a move is strictly greater | yes: ECMA-262 leaves `Math.hypot` implementation-approximated, so today's answer at the edge can differ between engines, where an exact answer never does, for a few lines -- `snap-grid`'s D1 made the same choice; it changes draw only for a travel within about 10^-15 of 4 units (6.3). Measuring on screen rather than in the drawing waits for pan and zoom (H26.6), where a zoomed-out drawing would otherwise shrink the threshold on screen; registered below |
| D8 | `traceInput` now: every row's standing for one input | yes: the tester at `input.apnex.io` highlights every gesture live (H26-1), which needs every row's standing, not only the winner; defining the match from the trace makes them one computation, so it adds no second path |
| D9 | No conformance kit | yes: nothing in binding is a port another party implements, as a grid's shape is; what an application checks of its own tables is `findOverlaps`, run in its own gate |
| D10 | Draw's `rules` part alone imports the component: `kernel/input-rules.mjs` keeps `composeRules`, `resolveInput` and `overlapsIn` with their signatures as draw's adapter, adds `openGestures`, and the canvas opens its session through it; the part's duty becomes "Decide what an input means" | yes: as the `lattice` alone imports `snap-grid` (`SNAP-GRID.md` section 7.7) -- one module adapts if the component's interface moves, every call site and the tests that hold parity run unchanged, and the canvas and the network plugin consume `rules` already; weighed against the canvas and the network importing it directly, which would repoint 17 call sites in product code and six test files, and spread the component's interface over two parts, for nothing a consumer needs |
| D11 | One component with two capabilities -- resolution and the lifecycle -- not two components | yes: both answer what an input means, a press opens a gesture through a row's match, and no consumer pays for the half it does not use -- draw's drag grammar resolves without a session; a split is a fracture by evidence (C0) when a consumer needs one half without the other and measures a cost |
| D12 | `@apnex/input-binding` released as `0.1.0` from `apnex/input-binding`, its one export path `.` | yes: `SNAP-GRID.md` section 7 unchanged; `0.x` until mission-kit admits it (`snap-grid`'s D9) |
| D13 | What documents the bindings reads the rows, never the component's internals: draw's help overlay reads each composed table's `rows` in table order, `tools/gesture-table.mjs` keeps reading draw's row arrays, and `tools/reaction-table.mjs`, which reads the planner, is untouched; the component describes no row | yes: the rows are draw's one master and every projection a view of it (P3), so the overlay lists exactly the rows an input resolves against (RULES I4, A5); the input grammar a help line is written in (`app/src/help.js:9-15`) is draw's, and a component that rendered rows would carry it |

**Registered when this is ratified,** each with its revival trigger (RU3):
- travel measured on screen: when H26.6 designs pan and zoom, a fact may carry a screen point beside `at` and the session's declaration name which it measures;
- a timed trigger: when an application needs a hold or a double click decided by time, its time a field of the facts;
- held keys and several pointers: when an application's row needs a key other than a modifier held, or a second pointer's press kept;
- the two defects kept in 6.3: when a person reports a drag that selected where it should have discarded, or a handle's start or the handles' redraw is next changed.

---

## 9. Axiom alignment audit (M7)

**Identity.**\
H26.0 part 2 at revision 1, drafted against `6078018`, audited in three layers:
- the library: the table holds no state; the session holds the press and the live gesture between calls, which the application acts on, so the library is stateful in T1's sense -- not durable, but read back and authoritative while the session lives -- and A1 binds it, beyond the floor; it coordinates no actors and runs no model;
- the release process: unchanged from part 1, whose release layer section 9 of `SNAP-GRID.md` audited and H26.1 built;
- the consumer: draw, stateful, multi-agent and autonomous as `MISSION-KIT-ALIGNMENT.md` section 5 reads it, to which the move adds a second installed component and moves its gesture state into a session.

**Verdict.**\
Revision 1, by its author: `pass, with guardrails`.\
It has not been read by the multi-family reading H26-3 requires, and part 1's first reading found its revision 1 `revise-before-implementation` (`SNAP-GRID.md` section 10.1); this verdict is the drafter's, to be tested by that reading (section 10).

| Layer | Axiom | Weight | How the design stands |
|---|---|---|---|
| library | A3 Sovereign Composition | load-bearing | One duty, two capabilities serving it (D11); rows' semantics are the application's, injected as data and predicates (P4); binding calls no application code but predicates (D6); draw composes it through one part and keeps its editing gestures (B389), named site by site. |
| library | A1 Sovereign State Transparency | load-bearing | The session's whole state is one frozen value, replaced exactly when it changes; the table holds none; nothing is hidden in a closure the state does not show. |
| library | A8 Gated Recursive Integrity | load-bearing | Section 4 holds each rule by a test that can fail; the travel is held to an exact oracle; draw's old matcher and press generate the corpus the component must pass. |
| library | A14 Compounding Learning | supporting | `findOverlaps` turns the ladder defects (B18, B37, B42) into a gate any application runs; the inventory's defects are registered, not fixed in passing. |
| consumer | A5 Perceptual Parity | load-bearing | What a person reads -- the help overlay, the tester's highlights -- is generated from the tables an input resolves against, and the match is defined from the trace, so the view and the behaviour cannot drift. |
| consumer | A8 Gated Recursive Integrity | load-bearing | The side-by-side tests over every table, the gesture corpus, the press and release oracles, the matrix corpus, the probe and a verifier prove the move; the one behaviour it changes is named and ruled (6.3). |
| consumer | A9 Chaos-Validated Deployment | supporting | Nothing new is claimed of a deploy: the second component rides the release, the lockfile and the import map H26.1's tests proved, and the in-flight window stays registered (B403). |
| all | A4 Zero-Loss Knowledge | supporting | Rulings recorded in draw and in the component's own record; the readings to come kept whole outside the repository and every finding dispositioned here. |
| all | A2, A6, A7, A10, A11, A12, A13 | not materially implicated | No trait brings A2, A11 or A12 into force -- binding reconciles nothing and runs no model; matching is deterministic code, which A11's intent asks; no seam between agents is designed (A6, A7, A10); A13 is served by asking section 8's decisions together, each with a recommendation. |

**Tensions, and how they resolve.**
- H26-1 states the duty with an "and" against A3's law of one: one duty, what an input means, stated without the conjunction, its two capabilities answering it; D11 asks whether to split.
- P4's promotion by evidence against `traceInput`, whose consumer is not built: the tester is selected work (H26.5), and the trace defines the match, so no second path ships.
- "Run" in H26-1 against an operation-reporting session: D6 reads "run" as sequenced, and argues why binding does not call the bodies.
- Exactness against parity: D7 makes travel exact, and so changes draw where `Math.hypot` rounds; the change is named, measured and ruled with D7, not hidden inside the parity claim.
- Purity against draw's actions writing `claimed` onto its events: the claim binding computes is returned, and writing it onto an event stays draw's until H26.3 designs capture's side.

**Guardrails for the build.**
- G1: every site of appendix B is dispositioned as its row says (acceptance steps 2 and 3), held by a test in draw.
- G2: binding reads no fact property but `at`, and calls no application code but `on` and `when` (I6, I8).
- G3: the vocabulary check runs on `src/` comments included, its lists outside the release, and draw runs it on what it installs.
- G4: I12's corpus is generated from draw at `6078018`, never hand-written, and holds no word of draw's.
- G5: H26.2 changes no behaviour except the one section 6.3 names as changed, ruled with D7.
- G6: only the `rules` part imports `input-binding`, and draw's guards and claim are declared there once.
- G7: the session is a private field of Input; nothing outside `app/src/input.js` reads the gesture state.
- G8: order decides nothing: I5's permutation test in the component, and draw's overlap tests over every composed table, stay in their gates.

**Closeout hooks.**\
H26.2's verifier re-checks G1 to G8 and acceptance steps 1 to 7; mission-kit admission is asked only after draw runs on the release (C0).

---

## 10. Reviews

None yet.\
H26-3 requires a multi-family reading through context-lab's review panel (M1) before ratification, and part 1 took five.\
What part 1's readings found, by kind (`SNAP-GRID.md` section 10), and where this revision answers each up front:

| What part 1's readings found | Where this revision answers it |
|---|---|
| claims a builder could read two ways: argument forms, freezing, ordering, ties, errors | the Errors and What is returned paragraphs; IB2's and IB8's step tables; IB5's three passes; IB6's tie rule; IB10's refusals; IB11's outcome table |
| numerical claims not true in binary64 | IB9 states the travel in real arithmetic and computes it exactly; the difference from `Math.hypot` is measured, not argued (6.3) |
| invariants a kit cannot check through its port | no kit (D9); section 4 marks each invariant by who holds it |
| draw's layer rules broken by where things are opened or imported | section 5: one importing part, consumed already by the two parts that use it; L3, the neutrality test and the no-plugin test named; the session private to Input |
| records and tests missed | appendix B, product code and every record, allowance and test that names the moved code, from a search of the tree at `6078018` |
| behaviour changes not listed | 6.3, the inputs nothing in draw produces listed apart, and 6.2 for every difference that changes no outcome |
| deployment claims beyond evidence | section 7 claims nothing new of a deploy, and names the window B403 holds |

---

## Appendix A -- `input-binding`'s vision, the draft put to the director

To be ratified by the director with section 8; `input-binding`'s `VISION.md` is made from it when its repository is.

**North star.**\
Let every application decide what an input means in one place, from rows it declares, the same way every time.

**Why it exists.**\
Applications decide what a key or a press means in ladders of `if` branches, where the order is the meaning and a check placed one line too low lets a locked client write, and they decide "click or drag" again in each gesture that asks.\
The help overlay, the menu and the input itself then answer the same question three ways, and drift.\
`input-binding` holds the decision once: rows declared as data, one match or none, and one rule for click or drag, so every surface that asks gets the same answer.

**What it is.**\
An embeddable library with two capabilities: a table of declared rows that says which one row an input means in its context -- refusing ties, tracing how every row matched, and finding overlaps before they ship -- and a session that decides click or drop by one threshold and holds the one live gesture through its start, its changes, its commit or its cancel.\
Rows, contexts and gesture bodies are supplied by whoever asks; `input-binding` reads only what it needs and keeps no input.

**What it is not.**
- Not a listener: it never touches a platform's events.
- Not a hit tester or a renderer: what lies under a pointer, and what a gesture draws, are the application's.
- Not an executor: a row's action is the application's payload, never read.
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

From the inventory of `6078018`: product code, and the records that name it.\
*moves* -- asks `input-binding` through the `rules` part; *stays* -- draw's content or policy, unchanged; *kept* -- behaviour kept exactly, registered (6.3); *plumbing* -- an import, a record or a line that goes or is repointed; *unchanged* -- a site that names what moves and needs no edit.

| Site | Today | H26.2 |
|---|---|---|
| `kernel/input-rules.mjs:40-79` | `DEFAULTS`, `composeRules`, `admitted`, `matching`, `resolveInput`, `overlapsIn` | moves: the mechanism to `input-binding`; the module becomes draw's adapter -- the three functions keep their signatures and answers over `composeBindingTable`, draw's four guards and `prevent` stated as the declaration, the duplicate-id message kept; `openGestures` added (section 5) |
| `kernel/input-rules.mjs:1-38` | the header | plumbing: restated as the adapter's, still naming no tenant's word |
| `app/src/input-state.js:19-22,34,36,40-43,47` | the press and its travel | moves: the press to the session -- `pointerDown`, `pointerMove`, `pointerUp`, `pointerLost`, a restart `from`; the pointer, the armed `w` and the chained flag stay |
| `app/src/triggers.js:17-23` | `DRAG_THRESHOLD`, `dragging`, `releaseTrigger` | moves: the threshold to the session's declaration, `dragging` to `state.press.beyond`, `releaseTrigger` to `pointerUp().trigger`; the module deleted |
| `app/src/input.js:39,44-45` | imports | plumbing: `openGestures` from the `rules` part; the triggers import goes |
| `app/src/input.js:77-333` | `GESTURES`, the editing gestures' bodies | stays (B389); `pending` and `clone-pending` declare `engaged: false`, the session's gestures derived from the table |
| `app/src/input.js:263` | the link release's `atStart`, against `DRAG_THRESHOLD` | stays (draw's policy), reading the threshold where `app/src/input.js` names it |
| `app/src/input.js:376-378,444-458,469` | fourteen tables composed | unchanged at the call sites, `composeRules` moving beneath them |
| `app/src/input.js:496,502-503` | the input state, `mode` and `ctx` | moves: `mode` to the session's live gesture, read through a getter; the session a private field; `ctx` stays |
| `app/src/input.js:560-562` | `isGesturing` by gesture names | moves: the live gesture's `engaged` |
| `app/src/input.js:587-620` | a press | moves: `pointerDown` beside the input state; `cancelGesture` beneath `cancelDrag`; `startGesture` before the start body |
| `app/src/input.js:609,662,1086,1274,1314-1318,1556-1558` | `resolveInput` calls | unchanged at the call sites |
| `app/src/input.js:679-688` | `beginPress` writing `mode` | plumbing: the write deleted, the press having started the gesture |
| `app/src/input.js:690-702,709-734` | `startMove`, `startClone` | moves: `becomeGesture`; each failure path `cancelGesture` with no body run, as its `mode = null` does today |
| `app/src/input.js:945-960` | a move | moves: `pointerMove` beside the input state; the update body as today |
| `app/src/input.js:985-995` | `escalate` | moves: reads `state.press.beyond` |
| `app/src/input.js:1041-1049` | a release | moves: the trigger from `pointerUp`, which clears the press before the commit (6.2) |
| `app/src/input.js:1058-1070` | `dispatchUp` | moves: `commitGesture` before the commit body |
| `app/src/input.js:1079-1083` | `bindings()` | plumbing: each table's rows from `table.rows`; the help overlay unchanged |
| `app/src/input.js:1193-1199` | `chainFrom` | moves: `startGesture` or `becomeGesture` with `from`; the chained note keeps the flag alone |
| `app/src/input.js:1240-1250` | `cancelDrag` | moves: `pointerLost` on a pointer cancel; `cancelGesture` after the cancel body |
| `app/src/input-state.js:40,43`, `app/src/input.js:1061` | one press for every button | kept (6.3): the session's one press reproduces it |
| `app/src/input.js:185-193,619` | a `handle` start that finds nothing, left live | kept (6.3) |
| `app/src/input.js`, 27 lines reading `this.mode` (`:525`, `:561`, `:577`, `:595`, `:612`, `:947`, `:951`, `:959`, `:990`, `:1059-1060`, `:1242`, `:1261`, `:1286`, `:1314`, `:1344`, `:1377`, `:1410-1411`, `:1426-1427`, `:1487`, `:1494`, `:1556`, `:1565`, `:1576`, `:1592`) | the live gesture's name | unchanged, read through the getter |
| `app/src/recognize.js`, `app/src/releases.js`, `app/src/keymap.js` | draw's rows | stays |
| `app/src/actions.js`, `app/src/help.js` | the labels and the overlay | stays |
| `app/src/run-mode.js`, `engine/spawn-runs.mjs:38-59`, `devices/device-panels.mjs:12-19` | run mode's rows | stays |
| `zones/zone-gestures.mjs:63-101`, `zones/zone-keys.mjs:21-39`, `devices/device-gestures.mjs:32-50`, `devices/device-keys.mjs:13-23`, `network/link-handles.mjs:50-61`, `network/link-keys.mjs:57-90`, `network/keys.mjs:38-62`, `groups/group-keys.mjs:20-40` | the plugins' rows | stays |
| `network/grammar.mjs:18,75-82` | the drag grammar composed and resolved | unchanged at the call sites |
| `engine/situation.mjs:58-70` | the situation | stays (draw's context) |
| `app/src/capture.js` | facts, claims, pointer capture | stays until H26.3 (section 2.4) |
| `app/src/sync.js:72-84` | deferral during a gesture | unchanged: `isGesturing`, `onGestureEnd` and `cancelDrag` keep their meaning |
| `app/src/compose-canvas.js:78-82`, `app/src/main.js:56-69,99`, `lab/src/root.js:74-78` | the composition | unchanged: Input's constructor is unchanged |
| `app/src/overlay.js:104-112`, `app/src/tools.js` | arming, the held tools | unchanged |
| `tools/gesture-table.mjs:16-17,26-28` | the network's rows read as arrays | unchanged; `--check` passes with no edit |
| `tools/reaction-table.mjs` | the planner's reactions | unchanged: it reads no input row |
| `package.json`, `package-lock.json` | the dependencies | plumbing: the release file pinned by its hash (`SNAP-GRID.md` section 7.5) |
| `app/index.html:8-17`, `lab/index.html:29-38` | the import map region | plumbing: regenerated, one entry more |
| `tools/layers.mjs:93-94` | `PARTS.rules`'s duty | plumbing: "Decide what an input means"; modules and consumes unchanged |
| `tools/layers.mjs:113-120,305-309` | the canvas part's modules; `LAYER.canvas` | plumbing: `app/src/triggers.js` leaves both |
| `tools/layers.mjs:358-367,432-437` | `ENTRIES.page` and `ENTRIES.lab` | plumbing: `app/src/triggers.js` leaves both |
| `tools/layers.mjs:158-161` | `COMPONENTS` | plumbing: `@apnex/input-binding`, the `rules` part alone, by H26-1, H26-2 and the ruling that ratifies this piece |
| `tools/layers.mjs:172-190` | `MISSION_KIT_READ`; `input-binding`'s standing | plumbing: the standing restated as composed, the date renewed |
| `tools/layers.mjs:191-207` | `ALIGNMENT.rules`, `ALIGNMENT.canvas` | plumbing: `rules` composes it; the canvas consumes it through `rules` |
| `tools/layers.mjs:284` | `LAYER.core`'s note for the matcher | plumbing: restated as draw's adapter |
| `tools/layers.mjs:876-994` | `UNUSED_EXPORTS` | unchanged: `kernel/input-rules.mjs` is not in the planner entry's closure, so nothing joins `retired` |
| `tools/scan-dead.mjs:79` | the allowance for `overlapsIn` | unchanged: it stays the adapter's gate instrument, consumed by tests alone |
| `tools/scan-docrefs.mjs:65-310` | `ALLOW` | plumbing: `*:app/src/triggers.js` added, for the records written while it lived that cite it (`dev/design/input/GESTURE-SYSTEM.md`, `dev/BACKLOG.md`, `dev/design/unification/MISSION-KIT-ALIGNMENT.md`) |
| `tools/scan-writers.mjs:82` | Input's gesture state read from outside | unchanged: the session is a private field of Input |
| `kernel/README.md:15` | the matcher's line | plumbing: restated as draw's adapter over `input-binding` |
| `docs/ARCHITECTURE.md`, `docs/ARCHITECTURE-TARGET.md` | generated parts and alignment; the target's authored sections 2, 4.2 and 9.3 | plumbing: regenerated with the manifest; the target's justification chain cites the ratifying ruling, its section 4.2 says `rules` exposes the session, and its section 9.3 says the core composes two components |
| `tests/input-rules.test.js` | the matcher's tests; the neutrality test | moves: the matcher's tests to the component's own; the neutrality test stays on the adapter, which imports `@apnex/input-binding` alone; the owner test reads `table.rows` |
| `tests/input-state.test.js:15-19,30-37,68-84` | the press, in the state's whole value and on its own | moves: the press's tests to the component's; the initial state restated without a press |
| `tests/triggers.test.js` | the click rule | moves: to the component (IB9's tests); its "decided once" test stays in draw, restated -- `app/src/input.js` names the threshold once and the link release alone reads it |
| `tests/input.test.js:979,987` | composed tables read as arrays | plumbing: restated to `table.rows` |
| `tests/canvas-names-no-plugin.test.js:48-49` | `app/src/input.js`'s count of 9 gesture-name words | unchanged at 9: `chainFrom`'s one name replaces its one assignment; a rise is restated with its reason in the same commit |
| `tests/import-map.test.js:55-57` | the whole import map | plumbing: restated with `input-binding`'s entry |
| `tests/pointer-bindings.test.js`, `tests/releases.test.js`, `tests/network-grammar.test.js`, `tests/network-transit.test.js`, `tests/canvas-gestures.test.js:198-203` | call the adapter | unchanged: they hold the parity |
| `tests/help.test.js` | reads `bindings()` and the rows | unchanged: `bindings()` still hands it arrays of rows |
| `tests/gesture-corpus.test.js`, `tests/fixtures/gesture-corpus.json` | 76 scenarios | unchanged: replaying byte-identical is acceptance step 5 |
| `dev/RULES.md` section 11, `dev/INPUT.md` section 7, `dev/design/input/GESTURE-SYSTEM.md` | the matcher and the lifecycle as built | plumbing: each kept as written (RU2), gaining a dated line at H26.2 naming the component |
