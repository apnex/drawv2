# The gesture system -- a layered, context-aware, programmable mapping from input to action (DESIGN, awaiting approval)

> **Tier 3 -- a design of record, proposed.** Written 2026-09-30 against `6be0bb5`.
> Facts about today's code are measured and cited by file and line; judgements are marked as such.
> No code moves until the director approves it, and then one stage at a time (section 9).

## 1. Status

- **Asked for:** by the director on 2026-09-30, twice in one exchange (section 2), both recorded in `dev/DECISIONS.md`.
- **Builds on:** the Rules engine (`kernel/input-rules.mjs`, `dev/RULES.md` section 11) and its rulings Q1, Q3 and Q4; the input spec `dev/INPUT.md`, which this revises where it is out of date (section 3.4).
- **Proposes; decides nothing.** Section 12 lists what only the director can settle, one decision at a time.

---

## 2. What was asked

The director, on whether input is its own sovereign system: "How are input gestures captured? are these in their own sovereign system that is separate to the events/rules themselves?"\
The answer was no for pointer gestures, and the director approved a design to make it so.

Then, adding to it: "having a progressive, modular, layered "gesture system" that tracks current inputs, keys and gestures - both ordering and concurrent - can be bound to an action and trigger it.\
Essentially a programmable mapping - this will allow us to have "context aware menus" so the same action can have different meaning depending on what was pressed or selected etc".

Read as requirements, each one testable:

| id | requirement | from |
|---|---|---|
| R1 | Capture, gesture lifecycle, meaning and effect are separate units, each with one concern | "their own sovereign system that is separate to the events/rules" |
| R2 | The system TRACKS the current input: what is held, where the pointer is, what the gesture has done so far | "tracks current inputs, keys and gestures" |
| R3 | ORDER matters: a sequence (press, then a key, then a release) can be bound | "both ordering" |
| R4 | CONCURRENCY matters: inputs held together (a key held during a drag, a modifier with a press) can be bound | "and concurrent" |
| R5 | A binding maps an input pattern, in a context, to a named action -- and the mapping is data | "can be bound to an action", "a programmable mapping" |
| R6 | The same input means different actions in different situations: what is selected, what was pressed, what is under the pointer | "context awareness", "different meaning depending on what was pressed or selected" |
| R7 | It is LAYERED and PROGRESSIVE: each layer is built only from the one below, and a tenant -- the product, a plugin -- adds bindings without editing another's | "progressive, modular, layered" |
| R8 | Menus are generated from the same mapping, filtered by the situation, so a menu can never disagree with what a key or a gesture does | "context aware menus" |

---

## 3. Where it stands -- measured at `6be0bb5`

### 3.1 What is already separate

- **Keys.** `onKeyDown` builds a situation (`engine/situation.mjs`) and asks the Rules engine for the one row (`app/src/input.js:1387`, `kernel/input-rules.mjs`). Product rows are `app/src/keymap.js`; the network plugin's are `network/keys.mjs`. Two rows matching one situation fails the gate (Q3).
- **The network's drag grammar.** Input records a link drag as steps and hands the record to the plugin, whose grammar is data (`network/grammar.mjs`).
- **Effects.** `app/src/commands.js` builds the commands; `history.commit` sends them to the planner.

### 3.2 What is not

- **One module holds capture, lifecycle, meaning and effect.** `app/src/input.js` is 1,681 lines and 80 methods. It registers the DOM listeners (lines 524-544), runs ten gesture handlers (the `GESTURES` table, lines 74-417), decides what each release means, and performs the effects.
- **Pointer rules are ordered, and 14 pairs overlap.** `RECOGNIZE` (`app/src/recognize.js:45-65`, 11 rows) resolves by first match: the held text tool beats seven other rows, the Alt+right chord beats clone and press, Ctrl+left clone beats link and press, link beats press, zone drawing beats marquee. No test covers the table. Q3 forbids exactly this for keys.
- **What a release means is decided in `if`s.** The link release alone makes about twelve decisions (`input.js:216-316`): judge delegation, the pair rule, Shift-chaining, a click that retypes a node from the held type, a click that selects, cleanup. The marquee release decides between stamping the held type, clearing the selection and picking (`input.js:365-387`). This is the pattern B163 named and T3 removed for keys.
- **Read-only is enforced in about eight places,** not one: the recognizer filter, the press escalation, three branches of `runModePress`, two in `onDblClick`, the key guard, `setReadOnly`, and the overlay's arming (`input.js:118, 681, 714, 728, 1335, 1363, 1394, 585, 1431`).
- **Some inputs bypass every table.** Key releases (`onKeyUp`, `input.js:1659`) are handled by hand; double-click does its own hit test and finds zones without the Shift rule `hitOf` applies (`input.js:1328`); run mode diverts before anything else (`input.js:605`).
- **Nothing tracks input state as a value.** What is held is scattered: Shift is re-read from each event, the `w` that placed a source lives in `placedByW` and `armedSource`, a chain lives in `ctx.chained`, the last move in `lastDelta`.

### 3.3 Registered defects this touches

- **B245** -- threading a pinned waypoint clears its pin on the tab only, outside history, and a cancelled drag does not restore it (`input.js:1029`). The gesture system fixes it by construction (invariant G5).

### 3.4 Where `dev/INPUT.md` no longer matches the code

Counts (1,653 lines and 57 methods then; 1,681 and 80 now); "order decides exactly one keystroke" (none now, Q3); the keymap's size and its `duringGesture` list; the held-tool unification of its section 6, never built; the gesture slot signature; and `lastDelta`'s owner.\
This design supersedes its sections 4, 6 and 8 when approved, and the stale lines get CORRECTED notes rather than rewrites.

---

## 4. Prior art -- recalled, not re-verified in this session

Five input systems solve this problem, and they agree on more than they differ.

| system | the mapping | context | time and concurrency | layering |
|---|---|---|---|---|
| VS Code keybindings | `{ key, command, when }` rows; commands are named separately | `when` clauses over named context keys | two-stroke chords (`ctrl+k ctrl+s`) | user rows override default rows by order |
| Emacs keymaps | key sequences to commands | the active modes decide which keymaps apply | prefix keys make sequences | minor-mode maps shadow major, which shadow global |
| Blender keymaps | event type + value (press, release, click, double-click, click-drag) + modifiers to an operator | one keymap per editor and region | the event VALUE carries time: click versus drag | per-editor keymaps over a global one |
| Unity Input System | action maps; bindings attach to named actions | enabled action maps | interactions (press, hold, tap, multi-tap) and composite bindings | maps enabled and disabled as a set |
| Unreal Enhanced Input | input actions, bound in mapping contexts | mapping contexts added and removed at runtime | triggers (pressed, released, hold, tap, chorded action, combo) | contexts carry a numeric priority |

**Three lessons this design takes.**
- **Actions are named apart from their bindings.** Every system above does it, and it is what makes a menu possible: a menu lists actions, and a binding is only one way to reach one.
- **Context is a condition over named facts** -- VS Code's `when` over context keys is our situation and its predicates, already built (Q1, Q4).
- **Time belongs to the trigger, not the action.** Blender's event values and Unity's and Unreal's interactions put press, release, click, drag, hold and chord in a small closed vocabulary, so an action never re-derives "was that a click or a drag".

**One lesson this design refuses.**\
Every system above layers contexts by PRECEDENCE: a later row, a minor mode, a higher priority wins.\
Q3 ruled that two rows matching one situation is a failure, never a win by position (2026-09-30).\
So layers here compose by being disjoint -- a modal tool is a condition in the situation, not a layer that shadows another -- and section 12, decision DG2, asks the director whether that should stay strict.

**Why tracking input as events is safe here.**\
The Rules system chose level-triggered rules over event handlers, because a peer that misses one event diverges (`engine/rules.mjs`).\
That argument is about SHARED state.\
A user's pointer and keys are local to one tab and never shared; only the action they choose travels, as a command through the planner.\
So the gesture layers may consume an event stream, while everything the bindings read stays a plain value (Q4).

---

## 5. The design -- six layers, each built only from the one below

```
L5  projections   help overlay, context menu       generated from L3 + L4, filtered by the situation
L4  actions       named verbs: instant or continuous   product's and each plugin's
L3  bindings      trigger pattern + situation -> action   the Rules engine; one table per tenant, composed
L2  gestures      click, drag, drop, step, chord, hold   a closed vocabulary of triggers, derived from L1
L1  input state   what is held, where, what happened     a plain value, reduced from L0 events
L0  capture       DOM events -> input events          the only layer that touches the DOM
```

Each layer has one concern (A3), and nothing reaches past the layer beneath it.\
A tenant -- the product, the network plugin, a future one -- adds rows at L3 and actions at L4, and nothing else (P4).

### 5.1 L0 -- capture

The only code that reads a DOM event.

It turns each pointer, key and double-click event into an INPUT EVENT, plain data:
```
{ type: 'down' | 'move' | 'up' | 'cancel' | 'key-down' | 'key-up' | 'double', button, key, mods: { shift, ctrl, alt, meta },
  at: { x, y },            canvas coordinates
  on: { kind, id, end, corner } }   what is under the pointer -- today's hitOf, moved here
```

It owns the listeners (`input.js:524-544`), `toCanvas`, `hitOf` (`app/src/pick.js:42`) and the double-click hit test, which becomes the same `hitOf` with its zone rule (section 3.2).\
It decides nothing: no mode, no read-only, no meaning.

### 5.2 L1 -- input state

A plain value, reduced from input events by a pure function, `track(state, event, now) -> state`:
```
{ held: { keys: [...], buttons: [...], mods },     concurrent: what is down right now
  pointer: { at, on, downAt, downOn, travelled },  where, and how far since the press
  sequence: [ { event, on, at } ... ],             ordered: what this gesture has done so far
  armed: { ... } }                                 what a previous gesture left for the next -- the `w` that placed a source
```

It absorbs the scattered state of section 3.2: `placedByW` and `armedSource` become `armed`, the chain becomes part of `sequence`, Shift is read from `held` rather than re-read per event.\
Because it is pure over a recorded stream, a gesture can be REPLAYED exactly, which is how migration is proven (section 9).

### 5.3 L2 -- gestures: the vocabulary of triggers

Derived from L1, a small closed set -- the lesson of Blender, Unity and Unreal:

| trigger | when it fires | today |
|---|---|---|
| `press` | a button goes down | `onDown` |
| `click` | a button comes up having travelled under the threshold | inside four release handlers, three ways (distance, box size, none) |
| `drag-start` | the pointer has travelled past the threshold with a button held | `escalate` |
| `drag` | each move during a drag | `update` slots |
| `step` | a key pressed during a drag -- the drag's sequence grows | `addStop`, the digit chain |
| `drop` | the button comes up after a drag | `commit` slots |
| `cancel` | Escape, pointer cancel, a lock, an inbound change | `cancelDrag` |
| `key` | a key goes down with no drag | `onKeyDown` |
| `key-up` | a key comes up | `onKeyUp`, by hand today |
| `double` | a double click | `onDblClick`, by hand today |
| `menu` | the menu is asked for | does not exist (decision DG4) |

`hold` and `sequence` of keys without a drag (a prefix key, as in Emacs or VS Code chords) are in the vocabulary's design but NOT built until a binding needs one (A3, earned exposure; decision DG5).\
The threshold is one number, applied in one place, so click and drag cannot be told apart three ways again.

### 5.4 L3 -- bindings: the Rules engine, for everything

A binding is a row of the engine that already exists, with a trigger in its `on`:
```
{ id, owner, on: (trigger, state) -> bool,   which trigger and which held inputs -- order (R3) and concurrency (R4)
  when: (situation) -> bool,                 what is selected, pressed, under the pointer -- context (R6)
  action: 'action-id',                       what it means (L4)
  mutates, duringHelp, duringGesture }       the guards, applied by the engine alone
```

One engine resolves every input -- keys, presses, clicks, drags, steps, drops, key releases, double clicks, menus.\
`RECOGNIZE` and `KEYMAP` become binding tables of the product tenant; `network/keys.mjs` is already one.\
Q3 applies to all of it: the 14 overlapping pointer pairs become explicit conditions, and the gate enumerates triggers against situations and fails on any pair.\
Read-only is one guard in one place (`mutates`), and the eight scattered checks go.

The situation grows only by what a binding reads (Q1): the trigger's target, the gesture's travel, the drag's steps -- all plain data.

### 5.5 L4 -- actions

An action is named once, and everything else refers to it by id:
```
{ id, owner, label,                    label: what a menu or help row shows
  kind: 'instant' | 'continuous',
  run(context)                          instant: do it
  begin / update / end / cancel         continuous: own the in-flight state of a drag, its preview, its commit }
```

The 33 key handlers and the ten gesture handlers become actions.\
A continuous action keeps today's lifecycle contract (`dev/INPUT.md` section 7, invariants I-IN1 to I-IN5), but decides nothing about meaning: WHAT a drop means is a binding on `drop`, and the action is told which.\
Actions reach the document only through `commands.js` and `history` (the effect layer, unchanged).

### 5.6 L5 -- projections

- **Help** is the binding table unfiltered, rendered: each action's label and every binding that reaches it. It replaces the 41 hand-written rows of `app/index.html:105` (RULES I4, B163), which have already drifted: they still offer `7` as the waypoint, which B146 removed.
- **A context menu** is the binding table filtered by the situation at the point it opens: every action some binding would run here, now, with the input that reaches it shown beside it (`dev/RULES.md` section 4, the projection rule).

So the same action can have different meaning depending on what was pressed or selected (R6), and the menu shows exactly the meanings that hold (R8) -- because it reads the conditions the keys and gestures are resolved by, and keeps no list of its own.

### 5.7 Worked examples

- **`c` -- context (built in T3).** Two bindings on `key c`: `close` when one bent link is selected, `close-refused` when one straight link is. A menu opened on a bent link lists "Close path (c)"; on a straight link, the refusal or nothing (decision DG4).
- **The link release -- a drop, decided by bindings.** Today's twelve `if`s become rows on `drop` from a link drag: `link-commit` when the target is valid and the pair has room, `link-chain` when Shift is held and the link is plain, `retype-in-place` on a `click` with a held type, `select-on-click` on a `click` otherwise, `link-discard` when none holds. Each is a named action; the drag action only commits what it is told.
- **Order -- a sequence.** `w` then release: the drag's `sequence` records the `w` step, and the network's grammar reads it (built in T3). A prefix-key sequence would be the same shape on `key` triggers, built when a binding needs one.
- **Concurrency -- a chord.** Alt held with a right press: `on` reads `held.mods.alt` and the press; today's `chord` row, made disjoint from clone and press by condition rather than by being listed first.
- **A plugin.** The network adds `g` as a `step` binding with its own action, and its drop grammar -- as it does now, on the same engine as everything else.

---

## 6. Contracts and invariants

Each is falsifiable, and each has a test before the stage that relies on it lands.

- **G1 -- only L0 touches the DOM.** Every layer above takes plain data. A scan fails on a DOM or event-object read above L0.
- **G2 -- input state is a pure value.** `track` is a pure function of the state, the event and an injected clock. The same recorded stream yields the same state, on any machine.
- **G3 -- one engine resolves every input, and no row wins by position.** Keys, pointer triggers, key releases, double clicks and menus all resolve through `kernel/input-rules.mjs`. `overlapsIn` over the composed tables -- product, and product with each plugin -- is empty for every trigger and situation enumerated.
- **G4 -- the guards are applied once.** Read-only, help and gesture-in-flight are the engine's guards and appear nowhere else in the input layers.
- **G5 -- nothing reaches the document except through an action's commit.** No layer writes the model outside `commands.js` and `history`, except a continuous action's live preview, which its `cancel` restores exactly (fixes B245).
- **G6 -- an action is named once.** Every binding, menu entry and help row refers to it by id; a hand-written list of controls anywhere fails the gate (RULES I4).
- **G7 -- a tenant adds, never edits.** A plugin brings bindings and actions; it cannot change the product's. The core names no tenant (the existing scan).
- **G8 -- fail closed.** An input no binding means in the current situation does nothing and changes nothing (RULES I6).
- **G9 -- time is injected.** The click threshold, double-click window and any hold or sequence timeout read one injected clock, so tests are deterministic.

---

## 7. Acceptance tests

Binary, and each one fails on today's code or holds a property today's code has.

1. `RECOGNIZE`'s 14 overlapping pairs no longer exist: the composed pointer bindings have no overlap for any trigger, modifier set and situation enumerated.
2. A recorded corpus of gestures -- every row of `BEHAVIOUR-MATRIX.json` plus the input and guide-gesture suites' drags -- replays to the same commits before and after each stage.
3. The link release, marquee release and clone click contain no meaning: each drop or click resolves to one named action by a binding, and the action bodies hold no condition on the situation.
4. Read-only is refused by the engine's guard alone: removing it lets a locked client draw a link; removing any other former check changes nothing.
5. A double click on a zone without Shift behaves as `hitOf` says a press there does (section 3.2).
6. A cancelled drag through a pinned waypoint leaves it pinned (B245).
7. The help overlay is generated from the bindings, and deleting a binding removes its row.
8. With a menu trigger ruled (DG4), a menu opened on one bent link lists "Close path" with `c`, and on a straight link does not.
9. The network plugin adds a binding and an action with no edit to any product module.

---

## 8. The delta -- from, to, and what must not creep in

**From:** section 3, at `6be0bb5`.\
**To:** section 5, with invariants G1-G9 held by tests.

**The fence.**\
The input layers of the product -- capture, input state, gestures, bindings, actions, and the two projections -- and the plugin seam into them.

**The anti-scope fence.**
- No new gesture or behaviour during the restructuring stages: stages 1 to 5 change no outcome, and the matrix and the input suites prove it.
- No runtime editing of bindings in the product -- "programmable" means bindings are data brought by tenants, in source (decision DG3).
- No change to commands, the planner or the document format.
- No mod loader, sandbox or scripting surface (`dev/RULES.md` section 7 commits only to the seam).
- No touch, pen or gamepad input beyond the pointer events handled today.

---

## 9. Build order -- each stage behaviour-preserving, provable before the next depends on it

| stage | what lands | proves | exit criterion |
|---|---|---|---|
| 1 | **Replay corpus and L0 capture.** A recorder of input events, and a corpus from the matrix and the input suites; capture moves out of `input.js` | nothing changes as capture moves | the corpus replays to identical commits; G1's scan passes |
| 2 | **L1 input state.** `track` as a pure reducer; `armed`, the chain and held inputs move into it | state is a value | G2's tests pass; the corpus still replays identically |
| 3 | **L2 triggers, one threshold.** Click, drag, drop, step, key-up, double from L1 | click and drag decided once | the three click tests are one; the corpus replays identically |
| 4 | **Pointer bindings on the engine.** `RECOGNIZE` becomes bindings with disjoint conditions; key releases and double click join | no first match anywhere | acceptance tests 1, 4, 5; `resolveRule` deleted |
| 5 | **Actions, and release meaning as bindings.** Handlers become named actions; the drop and click decisions become bindings | meaning out of the lifecycle | acceptance tests 3 and 6; the corpus replays identically |
| 6 | **Help overlay generated.** | RULES I4 | acceptance test 7; the hand-written rows are gone |
| 7 | **Context menu.** Only after DG4 is ruled | R8 | acceptance test 8 |

Stages 1 to 5 are restructuring and change no outcome.\
Stages 6 and 7 add what the director asked for, on top of a table that already means what the keys and gestures do.\
Each stage is one approval, one gate, one lab deploy, as T1-T5 were.

**Coverage.**\
Proves: R1-R7 by stage 5, R8 by stage 7; RULES I4 and B163; B245.\
Defers: hold and prefix-key sequences until a binding needs one (DG5); runtime keymap editing (DG3).

**Verification targets.**\
The replay corpus (every stage); `overlapsIn` over composed tables with the trigger vocabulary (stage 4 on); the matrix in real Chrome (every stage); the scans for G1 and G6.

**Named costs and non-claims.**
- **`input.js` is the most exercised module in the product,** and moving it risks silent regressions -- which is why the replay corpus comes first and gates every stage.
- **Disjoint conditions are more verbose than first match.** Fourteen pointer pairs become fourteen explicit exclusions; the rows are longer and the precedence is visible instead of implied.
- **This does not make input configurable by users,** does not add touch, and does not claim the menu's look or placement -- only that its contents are the bindings that hold.

---

## 10. Risks

- **Double click against click.** A click must not wait for a possible double click, or every click gains latency. Today the browser's `dblclick` decides; stage 3 keeps that until a binding needs otherwise.
- **The live preview writes the shared model** (I-IN5, B7). Continuous actions keep that, and G5 bounds it: the preview is restored exactly on cancel.
- **Sync defers inbound changes while a gesture is live** (`app/src/sync.js:72-82`, `isGesturing` and `onGestureEnd`). The gesture layer must keep exposing both, with the same meaning; the corpus covers the chain case, where `onGestureEnd` fires while a chained drag begins.

---

## 11. Axiom alignment audit (M7)

**Identity:** this design, against `6be0bb5`, measured against mission-kit A1-A14.\
**Verdict: pass-with-guardrails.**

| axiom | weight | how the design holds it |
|---|---|---|
| A3 Sovereign Composition | load-bearing | six layers, one concern each; tenants add rows and actions and never edit another's; the 80-method module is split by concern |
| A2 Isomorphic Specification | load-bearing | help and menus are generated from the bindings, so declared controls and running behaviour cannot drift |
| A11 Cognitive Minimalism | load-bearing | deterministic tables and one engine; the trigger vocabulary is closed and grows only when a binding needs it |
| A1 Sovereign State Transparency | load-bearing | input state is one plain value instead of fields scattered across a module |
| A8 Gated Recursive Integrity | load-bearing | each stage is gated by the replay corpus before the next depends on it |
| A5 Perceptual Parity | supporting | the menu shows the meanings the bindings will run -- what the author sees is what the input does |
| A13 Director Intent Amplification | supporting | the director rules on scope and four decisions; the rest is mechanized |
| A4, A6, A7, A9, A10, A12, A14 | not materially implicated | |

**Tensions.**
- **A11 against R3 and R4.** Sequences and chords invite a general pattern language. Resolved by a closed trigger vocabulary and plain predicates over the input state: no DSL (`dev/RULES.md` section 6), and a new trigger is added only for a binding that needs it.
- **Q3 against the prior art's layering.** Every surveyed system resolves contexts by precedence. Resolved, pending DG2, by disjoint conditions: the cost is longer rows, and the gain is that no binding can silently shadow another.

**Guardrails for implementation.**
- No stage lands without the replay corpus replaying identically; a behaviour change is a separate, ruled commit.
- No trigger, situation field or action kind is added without a binding that uses it.
- The engine stays neutral: its text scan must keep passing as the trigger vocabulary arrives (the vocabulary lives in the product's gesture layer, not in the core).

**Closeout hooks.**\
Re-check G1-G9 by their tests; the corpus size and its replay; `overlapsIn` over every composed table; the count of `if`s left in action bodies that read the situation, which should be zero.

---

## 12. Decisions for the director

Each is a real fork, with a recommendation.

- **DG1 -- scope and order.** Approve stages 1 to 5 (pure restructuring, no outcome changes), then 6 and 7? Recommended.
- **DG2 -- layering.** Keep Q3 strict for pointer bindings too (contexts compose by disjoint conditions, never by priority), or allow an explicit priority between context layers, as Unreal and Emacs do? Recommended: strict.
- **DG3 -- what "programmable" means now.** Bindings as data brought by tenants in source -- the product and plugins -- now; runtime editing by users or agents later, as its own decision, since it needs storage and conflict handling? Recommended.
- **DG4 -- the menu's trigger.** Right press is taken (press and drag, Alt for delete, Ctrl for clone). Candidates: a long press, the keyboard's menu key, or right-click-without-drag on a selection. Needed before stage 7 only.
- **DG5 -- sequences beyond drags.** Are prefix-key sequences wanted (a key, then another, as VS Code's chords)? Recommended: in the vocabulary's design, built only when a first binding asks.
