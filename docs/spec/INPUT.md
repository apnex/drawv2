# draw — the Input system

The sovereign spec for how a person's gestures become committed changes.

> **Status: the model is DRAFT, the defect record and the recognizer audit are FACT.** §1–§3 describe
> what runs today, measured. §4–§7 are the target design, implemented by **H6**. Nothing here is
> `[LOCKED]` yet; it locks when H6 closes.

## 0. Why this document exists

Every other part of this system was specified before it was built. Geometry has `HIERARCHY.md`,
interaction atomics have `ATOMICS.md`, the transaction model has `COMMIT.md`. **The input system was
never specified — it accreted**, and it is the single densest source of defects in the tree:

| Row | Defect | Shape |
|---|---|---|
| **B14** | arrow nudge and both key-resizes threw for two milestones | wiring built, never connected |
| **B18** | three mutation paths ran while Server-Locked | a guard placed by line number |
| **B37** | two inspection verbs wrongly blocked | the same guard, the other direction |
| **B19** | inbound changes never deferred during a gesture | wiring built, never connected |
| **B42** | a tool armed before the lock survived it | a branch above the guard the first fix missed |

Five defects, three shapes, one file. None was a logic error; every one was a **structural** error —
something in the wrong place, or two halves never joined. That is what an unspecified system
produces, and it is why the answer is a spec rather than a refactor.

---

## 1. What the input system is

One duty, stated in one sentence:

> **Turn a person's pointer and keyboard activity into committed changes, and draw the feedback that
> tells them what will happen before it does.**

The second half is not decoration. `DESIGN.md`'s bar for the whole product is *"zero ambiguity
between intent and result — the machine states what will happen, in numbers, before commit."*
Feedback is therefore a first-class output of this system, not a side effect of it.

**Boundaries.** Input owns no persistence, no geometry, and no rendering of the document. It reads
the Model, asks `kernel/` for geometry, and emits **commands** at the commit boundary
(`Changes.onCommit`). Everything downstream of that boundary — versioning, undo, the wire — is
`COMMIT.md`'s.

---

## 2. State, and who owns it  *(measured 2026-08-19)*

`input.js` today: **1,653 lines · 57 methods · 13 mutable fields · 10 gesture modes**, of which the
four dispatchers are **681 lines** (`onKeyDown` 243 · `dispatchUp` 170 · `onDown` 167 · `onMove` 101).

| Field | Methods touching | Owner after H6 |
|---|---|---|
| `mode` | 16 | `input.js` — the FSM |
| `ctx` | 12 | `input.js` |
| `lastPos` | 8 | `input.js` |
| `readOnly` | 7 | **a gate, not a field-owner** — §5 |
| `focusId` | 7 | label editing |
| `hovered` | 6 | `overlay.js` |
| `textTool` | 4 | **retired** — folds into the held tool, §6 |
| `lastDelta` | 4 | `commands.js` (the remembered pitch) |
| `snap` (crosshair) | 4 | `overlay.js` |
| `onGestureEnd` | 4 | `input.js` — the D12 seam |
| `armed` | 3 | `overlay.js` |
| `help` | 3 | `main.js` |
| `datumEl` | 2 | `overlay.js` |

Only `mode` and `ctx` are genuinely central. The rest are small clusters with obvious homes, which
is why the decomposition is tractable at all.

---

## 3. The recognizer, as it actually is  *(audited 2026-08-19)*

`onDown` answers one question — *which gesture is starting?* — in **fifteen ordered branches**. The
order is load-bearing and entirely invisible. Written out:

| # | Button | Condition | Outcome |
|---|---|---|---|
| 1 | L | `renderer.mode === 'run'` | fire action / open inline editor; **all gestures suppressed** |
| 2 | L | a tool is held (`textTool`) | → `textbox` |
| 3 | — | *(side effects: close the label editor, hide the hand)* | — |
| 4 | L | `readOnly` | click-select on node/zone/link, else → `marquee`; nothing mutates |
| 5 | L | `mode === 'link'` | chaining: this press belongs to the next release, never a cancel |
| 6 | R | `altKey` | surgical delete of the armed entity |
| 7 | R | node/zone/waypoint + `ctrlKey` | → `clone-pending` |
| 8 | R | node/zone/waypoint | → `pending` (move-drag, or select on click) |
| 9 | R | anything else | ignored |
| 10 | — | not left button | ignored |
| 11 | L | `hit.kind === 'handle'` | → `resize` |
| 12 | L | `hit.kind === 'lhandle'` | → `replug` |
| 13 | L | `ctrlKey` on node/zone/link | → `clone-pending` |
| 14 | L | node, or a **free** waypoint | → `link` |
| 15 | L | an **occupied** waypoint | select only — never moves on the left button |
| 16 | L | zone or link | → `pending` |
| 17 | L | empty canvas + `shiftKey` | → `zone` |
| 18 | L | empty canvas | → `marquee` |

### Audit findings

**A1 — `readOnly` at #4 is not a gate, it is a branch.** Everything above it (run mode, held tools)
bypasses it. That is B18, B37 and B42 in one line: three defects from one structural fact.

**A2 — the recognizer is keyed on `(button, modifiers, hit.kind, flags)`.** Right-button has its own
sub-ladder (#6–9), left-button another (#11–18). Four dimensions expressed as nesting.

**A3 — run mode (#1) suppresses everything below it.** Deliberate, but nowhere stated, so it reads
as an accident of position rather than a decision.

**A4 — nothing enumerates the modes.** `this.mode` is assigned in ten places and compared in sixteen;
the set exists only by inspection.

---

## 4. The recognizer, as designed

An **ordered table**, because the order is the specification:

```js
RECOGNIZE = [
  { when: (h, e, s) => s.runMode,            act: 'run-action',  mutates: 'depends' },
  { when: (h, e, s) => s.tool && e.left,     act: 'textbox',     mutates: true  },
  { when: (h, e) => h.kind === 'handle',     act: 'resize',      mutates: true  },
  …
];
```

Three properties the ladder cannot have:

- **the ordering is data** — readable, testable, and diffable
- **every entry declares `mutates`**, so §5's gate is one line applied uniformly rather than a
  position anyone can accidentally write above
- **a new gesture is an entry**, not an edit to a 167-line function (A3 *Composable by Default*)

---

## 5. The Server-Locked gate

> **A verb runs while Server-Locked if and only if it does not mutate.**

Not *"if and only if it appears below line N"*, which is what it means today. SCOPE decision 5
promises that while locked *"selection, the data view, and the readout still work, but no
mutations."*

The gate is **one predicate over the `mutates` flag**, applied at both entry points (pointer and
key). Run mode straddles the boundary and is the reason `mutates` is per-entry rather than
per-branch: firing a `draw:action` commits nothing and stays live; opening the inline editor authors
a change and does not.

**Corollary (B42):** every *armed intent* dies with the lock — held tool, delete arming, in-flight
gesture. A list you must remember to extend is not a mechanism, which is why §6 unifies them.

---

## 6. Held tools

Today two things mean *"the next canvas click places something"*: `palette.hand` (a node type, or
`waypoint`) and `textTool` (a boolean). They are the same concept with two representations, two
clear-sites, and two branches — and the one nobody remembered to clear was B42.

**Unified:**

```js
tool = null | { kind: 'node', type } | { kind: 'waypoint' } | { kind: 'text' }
```

One thing to clear on lock, Escape, gesture start and document swap. One recognizer entry
(*a tool is held → place it*). One ghost. B42 becomes structurally impossible rather than fixed.

---

## 7. The gesture lifecycle

All ten modes, one contract:

```js
GESTURES[mode] = { start(ctx, pos, evt) → ctx, update(ctx, pos, evt), commit(ctx, pos, evt), cancel(ctx) }
```

Measured today, only **move**, **clone** and **link** carry explicit lifecycle methods; `resize` has
half; the other six are inlined in `dispatchUp`. The shape is latent in three of ten — H6 finishes a
design already half-present rather than imposing one.

**Invariants that survive the rewrite:**

- **I-IN1** `dispatchUp` snapshots `mode`/`ctx` and clears them *before* dispatching, so a commit
  handler may re-enter (chain wiring re-arms `link` with no held button).
- **I-IN2** a gesture ends exactly once, however it ends, and `onGestureEnd` fires in a `finally` —
  a throwing commit must not strand D12's deferred queue (B19).
- **I-IN3** the committed value is the **last rendered frame**, never a re-sample: ortho commits on
  `ctx.orthoActive`, and move/resize restore the pre-drag state before committing so the change is
  an exact transition.
- **I-IN4** a burst never spans a selection change (`Changes.flush()` on the selection subscriber).
- **I-IN5** live preview writes into the shared Model (**B7**, open) — inbound changes therefore
  defer while `isGesturing()` (**D12**).

---

## 8. Units and duties

| Unit | Duty | Owns |
|---|---|---|
| `pick.js` | Resolve a canvas point to the entity under it. | — |
| `snap.js` | Constrain a position or delta to the grid and the surface. | — |
| `commands.js` | Turn an intent plus a selection into one committable change. | `lastDelta` |
| `overlay.js` | Draw transient feedback for the current pointer and selection. | `hovered` `armed` `datumEl` crosshair |
| `keymap.js` | Map a keystroke to an intent, and say whether it mutates. | the table |
| `input.js` | Drive one in-flight pointer gesture from press to commit. | `mode` `ctx` `lastPos` |

**Not modules, deliberately:** `readOnly` is a predicate (§5); `focusId` belongs to label editing;
`help` to `main.js`. And there are **no per-gesture files** — ten handlers of 30–60 lines belong
beside their table, because splitting them fragments one answer across ten reads.

---

## 9. Verification

Every unit is covered before it moves, and by the property rather than the structure:

| Unit | Proven by |
|---|---|
| pick · snap · commands · keymap · FSM | the **commit boundary** — *this input emits these ops* (`tests/input.test.js`) |
| `overlay.js` | **`tests/affordance.test.js`** — the one unit that commits nothing, so it needed its own net |

`tools/scan-writers.mjs` forbids tests reading `input.mode`/`input.ctx`: a test coupled to internals
breaks at H6.3 and turns the net into a tax on the refactor it exists to enable.
