# draw - the Rules system

The sovereign spec for how the system decides what an input MEANS, given the situation the document is in.

> **Status: DRAFT, RULING-OWED, and PARTLY SUPERSEDED by the survey run to validate it.**\
> Section 0 is FACT -- measured at `7e774a6` and cited in **B163**.\
> Section 10 lists what cannot be settled without the director.
>
> **Read `surveys/b163-rules-system-survey.md` before acting on this document.**\
> A K5 survey captured the director's intent on 2026-09-01 and changed three things this spec asserts.\
> The target is a **programmable geometric engine**, not an editor with a seam left open.\
> Tower defence is the **pilot use case that drives the design**, not a stress case applied afterwards.\
> And the **ordered rule table of section 3 is demoted to one candidate**, pending a prior-art pass -- the director's instruction was to take inspiration from game modding and control-plane ecosystems *"rather than blindly assume this will be a table"*.\
> Section 3 arrived by fixing a defect, which is a sound route to a local answer and an unsound route to a platform surface.
>
> The defect in section 0 and the invariants in section 5 are unaffected and still stand.\
> Sections 2, 3 and 4 are candidate shapes awaiting the prior-art pass.

## 0. Why this document exists

`INPUT.md` settled **which** gesture or keystroke fires.\
It did not settle **what that keystroke means when the situation differs**, and that is now the growing edge.

A rule is chosen today by the event and by three guards.\
`resolveKey` filters each of the 31 `KEYMAP` rows on `mutates`, `duringHelp` and `duringGesture`, then asks `r.when(evt, ctx)`.\
The `ctx` it receives is `{ readOnly, helpOpen, gesturing }`: three guards and no subject.\
**Zero of the 31 predicates read `ctx` at all.**\
Every one is a pure function of the keystroke.

So a rule that can be stated in one sentence -- *a closed link is selected and `f` is pressed, therefore fill* -- has nowhere to be written as a row.\
It lands as a branch inside the verb it belongs to.\
Three handler bodies already test `kindOf`, `selection.size()` or the hovered kind before deciding what they mean.

Three is small, and the ladder that produced the following began exactly this way:

| Row | Defect | Shape |
|---|---|---|
| **B18** | three mutation paths ran while Server-Locked | a guard placed by line number |
| **B37** | two inspection verbs wrongly blocked | the same guard, the other direction |
| **B42** | a tool armed before the lock survived it | a branch above the guard the first fix missed |
| **B163** | a rule cannot be selected by the situation | the condition has no home, so it moves into the body |

The first three were cured by making dispatch DATA.\
B163 is the same disease one level up: the CONDITION is still code, and two conditions that overlap resolve by position with nothing saying so.

**The duplication is the other half.**\
*What is legal right now* is already answered twice -- once by the table, and once by hand in the help overlay at `index.html:104`, 21 rows of prose that no gate compares against the table.\
Nothing outside `keymap.js` imports `KEYMAP`.\
They have already drifted, and a context menu would ask the same question a third time.

**This has already been repaired once, by hand, for one key.**\
`H10.6` reconciled the help text against the keymap for `7` and is `DONE`.\
It fixed that key and left the mechanism that let them disagree, which is why the drift is back without a defect being filed against it.\
Generating the overlay retires the whole class instead of its next instance.

---

## 1. What the rules system is

One duty, stated in one sentence:

> **Decide what an input means given the situation the document is in, and answer that same question for every surface that has to display it.**

The second half is not decoration.\
A menu, a help overlay and a keystroke are three renderings of one question.\
Where they are three lists, two of them are wrong and nobody knows which.

**Boundaries.**\
Rules own no geometry, no persistence and no gesture lifecycle.\
They read a situation, choose one rule, and name a verb for `input.js` to run.\
Everything downstream of that name is `INPUT.md`'s, and everything downstream of the commit boundary is `COMMIT.md`'s.

---

## 2. The situation

A single derived value describing what is true right now, built once per event, in one place.

It is not a grab-bag of references.\
It is a **closed, named vocabulary of questions** a rule is allowed to ask:
```js
// built once per event from model + selection + transient UI state
s.selection.size          // how many things are picked
s.one('link')             // exactly one link, and nothing else
s.every('node')           // a homogeneous selection
s.closed()                // the selected route returns to its start
s.straight()              // no via waypoints
s.role()                  // 'endpoint' or 'bend' for a picked waypoint
s.hovered('zone')         // what the pointer is over
```

The vocabulary is closed on purpose.\
`closed()` already exists as `t.close` in `kernel/geometry.mjs:145`, and `straight()` as `isStraight` in `model/invariants.mjs:55`.\
Both are consulted today by whoever remembers to.\
Naming them once means a rule cannot get *closed* subtly wrong in its own arrow function.

---

## 3. The rule table  *(CANDIDATE -- superseded pending the prior-art pass)*

> **This section is no longer the design-of-record.**\
> The director ruled on 2026-09-01 that the surface shape must be chosen from prior art rather than inherited from the defect that prompted it.\
> What follows is retained as one candidate and as the reasoning that produced it, not as a decision.\
> The load-bearing distinction below -- guard versus condition -- is expected to survive whatever shape wins, because it is about authority versus subject rather than about tables.

A rule is a row.\
Its condition is a predicate over the situation and **nothing else**:
```js
RULES = [
  {
    id: 'fill-closed-route',
    on: 'f',
    when: (s) => s.one('link') && s.closed(),
    run: 'fillRoute',
    doc: 'fill a closed route',
    mutates: true,
  },
];
```

The three existing tolerances survive unchanged and stay dispatcher-applied.\
This is the load-bearing distinction in the whole document:

- a **guard** is about AUTHORITY -- may this run at all? (`mutates`, `duringHelp`, `duringGesture`)
- a **condition** is about SUBJECT -- does this input mean this thing right now? (`when`)

Mixing the two is precisely what put a read-only check at a line number and produced B18, B37 and B42.\
Guards are applied uniformly by the dispatcher to every row.\
Conditions are per-row and never mention `readOnly`.

---

## 4. The projection rule

**One table answers three consumers.**

| Consumer | Reads | Today |
|---|---|---|
| dispatch | `on`, `when`, `run` | `KEYMAP`, correct |
| help overlay | `on`, `doc`, `when` | 21 hand-written rows, drifted |
| context menu | `doc`, `when` against the live situation | does not exist |

A menu is the table filtered by the current situation.\
Help is the table unfiltered.\
Neither keeps a list.

The precedent is already in the tree and already worked.\
`INPUT.md` section 4 prints the **resolved matrix** generated from `RECOGNIZE`, and generating it exposed two defects that reading the code had not.

---

## 5. Invariants

Falsifiable, and each one is the negation of a defect the tree has already had.

- **I1 -- a condition is a pure function of the situation.**\
  A `when` body may reference only its `s` argument.\
  It may not read the model, the selection or the DOM.
- **I2 -- conditions compose named terms.**\
  A rule asks `s.closed()`; it does not re-derive closedness inline.
- **I3 -- no silent precedence.**\
  Two rules matching one situation is a GATE FAILURE, not a first-wins.\
  Deliberate overlaps are enumerated, as `INPUT.md` already enumerates its single one.
- **I4 -- every documented control is generated.**\
  A hand-written list of controls anywhere in the tree is a gate failure.
- **I5 -- guards stay uniform.**\
  A condition never tests authority, and a guard never tests the subject.
- **I6 -- fail closed.**\
  An unmatched situation does nothing and reports nothing changed.\
  A row added carelessly is inert rather than dangerous.

---

## 6. What this must NOT become

A general rule engine is the obvious overreach, and it would be worse than the nesting it replaces.

Three bounds hold **this table**:

1. **The condition vocabulary is closed.** Extending it is a deliberate edit to one file, reviewable in one diff.
2. **No runtime-authored rules in the editor table.** It is source, gated like source. Nobody edits editor dispatch through the UI.
3. **No DSL.** Plain JavaScript predicates over a typed situation. The moment it needs a parser, the design was wrong.

**These bound the internal table, not the system.**\
An earlier draft of this section said *no runtime-authored rules* without qualification, which would have foreclosed section 7 by accident.\
It is corrected here rather than left to be discovered: the editor's own dispatch stays closed, and a mod surface is a different tier with different rules.

---

## 7. The wider hypothesis -- rules as a modding surface

**Not in this slice, and recorded so the slice does not foreclose it.**\
The director's framing is that drawv2 is a programmable geometric engine, and that behaviours triggered by click, hover, select and place should be a first-class surface -- the modding model of Factorio, OpenTTD or Minecraft rather than a fixed editor.\
The stress case is a tower-defence game built from the existing primitives.

**The seam already exists in embryo, and is already named.**\
`main.js:56` calls it *the self-hosting interface -- the diagram emits actions, the app maps them to behaviour*.\
In run mode a clickable region fires a `draw:action` CustomEvent carrying an action string, and the host wires it.\
It is one-directional, stringly-typed, and has exactly one listener: `help` is wired real and everything else raises a toast.

**Where this design helps.**\
A mod needs to ask *what is true right now* before it can decide anything, and that is precisely the situation object of section 2.\
Building it well is the cheapest down-payment available on a mod surface, on one condition stated as a requirement rather than an aspiration:

> The situation is **not** an `input.js` private.\
> It is a model-level value, serialisable, buildable without a DOM, and passable to a consumer that is not the editor.

`engine/ivm.mjs` is the other half already in place -- a generic maintained reverse index over a change stream, parameterised by a tenant's keying, and explicitly written to be promoted when a second tenant appears.\
Range and occupancy queries are what a game asks constantly, and that machinery exists.

**Where the tree is genuinely not ready.**\
Three gaps, and the tower-defence case separates them cleanly:

| Need | Tower-defence example | Today |
|---|---|---|
| placement and topology | towers on anchors, creep routes along links | **fits** -- this is what the primitives already are |
| spatial query | what is in range of this tower | **partly** -- `engine/ivm.mjs`, awaiting a second tenant |
| a clock | creeps advance whether or not anyone clicks | **absent** -- no `requestAnimationFrame` and no `setInterval` anywhere in `app/src`, `kernel` or `engine` |
| ephemeral state | creep positions at frame rate | **absent, and actively hostile** -- see below |
| a way back in | a mod registering a behaviour, not merely receiving a string | **absent** -- actions escape, nothing returns |

**The ephemeral-state gap is the sharp one.**\
Every mutation today is a versioned, logged, persisted, undoable transaction, and `server/log.mjs:27` caps the ring at `LOG_MAX = 100` records with oldest-first eviction.\
A game loop driving state through that boundary would evict the entire real history in under two seconds at frame rate, and would replicate it to every viewer while doing so.\
So a mod tier needs a **second state tier that mints no transaction**: document state stays authoritative, undoable and shared, and ephemeral state is none of those things.\
Which entity state is which is the first question a modding design has to answer, and it is not answered here.

**What this section commits to: nothing but the shape of the seam.**\
No mod loader, no sandbox, no lifecycle, no clock.\
The single binding consequence is the requirement above -- the situation is model-level and DOM-free -- because retrofitting that later means rewriting every predicate.

---

## 8. Axiom alignment  *(M7, required before implementation)*

- **A1 Sovereign State Transparency** -- load-bearing. Interaction state is currently readable only by assembling model, selection, palette and a help flag from four places. The situation makes it one value.
- **A2 Isomorphic Specification** -- load-bearing, and already violated. The overlay is declared intent, the table is running reality, and they have drifted with no gate between them.
- **A3 Sovereign Composition** -- a new interaction is a row behind an existing boundary rather than a branch inside a verb.
- **A11 Cognitive Minimalism** -- the table is deterministic dispatch. Nothing reasons per case at runtime.

**Tension, named rather than smoothed.**\
A11 argues for the smallest mechanism; expressiveness argues for a richer condition language.\
Section 6 resolves it by capping expressiveness at a closed vocabulary, and accepts the cost: some rules will not be expressible and must extend the vocabulary first, deliberately.

---

## 9. Verification

Each invariant has a test that can fail, and each is proven by mutation before it is trusted.

| Invariant | Proven by |
|---|---|
| I1, I2 | a scanner over `when` bodies -- a predicate naming anything but `s` fails the gate |
| I3 | a generated resolution matrix, plus a deliberately overlapping pair that must turn the gate red |
| I4 | the overlay is generated; deleting a rule removes its row, and no `<table>` of controls survives in `index.html` |
| I5 | a condition mentioning `readOnly` fails the scanner |
| I6 | an unmatched situation commits nothing, asserted at the commit boundary |

The worked example is the director's own, and it is the acceptance case for the whole document.

A closed link selected plus `f` fills it.\
An open link selected plus `f` does nothing.\
One row expresses both, and no handler body contains an `if`.

---

## 10. Decisions required

**Settled.**\
**Q2 -- no context menu in this slice.**\
Ruled by the director.\
The table and the generated overlay land first; the menu is a later projection of the same table and nothing here depends on it.

**Still owed.**

| # | Decision owed | Why it cannot be settled without you |
|---|---|---|
| Q1 | Does the situation include HOVER, or selection only? | With the menu deferred, the case for hover is now section 7 rather than the menu, and that is a weaker and more speculative reason. Selection-only is the cheaper start and hover can be added to a closed vocabulary later. |
| Q3 | Is an overlapping pair always a gate failure, or may a row declare `overrides:`? | A hard failure is simpler and will occasionally be inconvenient. An escape hatch is the exact mechanism by which the last ladder rotted. |
| Q4 | Is the section 7 requirement binding now -- the situation model-level, serialisable and DOM-free? | It costs a little discipline in this slice and it is the one thing that cannot be retrofitted without rewriting every predicate. Declining it is legitimate and should be a decision rather than a drift. |
