# draw - the Rules system

The sovereign spec for how the system decides what an input MEANS, given the situation the document is in.

> **Status: DRAFT, and RULING-OWED.**\
> Section 0 is FACT -- measured at `7e774a6` and cited in **B163**.\
> Everything from section 2 on is proposed design and binds nothing until the director ratifies it.\
> Section 10 lists what cannot be settled without him.

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

## 3. The rule table

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

Three bounds hold it:

1. **The condition vocabulary is closed.** Extending it is a deliberate edit to one file, reviewable in one diff.
2. **No runtime-authored rules.** The table is source, gated like source. Nobody writes rules through the UI.
3. **No DSL.** Plain JavaScript predicates over a typed situation. The moment it needs a parser, the design was wrong.

---

## 7. Axiom alignment  *(M7, required before implementation)*

- **A1 Sovereign State Transparency** -- load-bearing. Interaction state is currently readable only by assembling model, selection, palette and a help flag from four places. The situation makes it one value.
- **A2 Isomorphic Specification** -- load-bearing, and already violated. The overlay is declared intent, the table is running reality, and they have drifted with no gate between them.
- **A3 Sovereign Composition** -- a new interaction is a row behind an existing boundary rather than a branch inside a verb.
- **A11 Cognitive Minimalism** -- the table is deterministic dispatch. Nothing reasons per case at runtime.

**Tension, named rather than smoothed.**\
A11 argues for the smallest mechanism; expressiveness argues for a richer condition language.\
Section 6 resolves it by capping expressiveness at a closed vocabulary, and accepts the cost: some rules will not be expressible and must extend the vocabulary first, deliberately.

---

## 8. Verification

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

## 9. Decisions required

| # | Decision owed | Why it cannot be settled without you |
|---|---|---|
| Q1 | Does the situation include HOVER, or selection only? | Hover is what makes a context menu useful, and it recomputes on every pointer move. It is a product call about what the menu is for, not a performance detail. |
| Q2 | Does the menu ship with this, or does the spec land first and the menu follow? | Determines whether this is one slice or two, and whether the overlay is regenerated now or later. |
| Q3 | Is an overlapping pair always a gate failure, or may a row declare `overrides:`? | A hard failure is simpler and will occasionally be inconvenient. An escape hatch is the exact mechanism by which the last ladder rotted. |
