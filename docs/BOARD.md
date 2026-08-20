# draw — board

The **live, triaged, prioritised queue**. What we are doing next, in order.

`docs/BACKLOG.md` is the durable *record* — append-and-close, every row evidenced, nothing ever deleted.
This file is the *plan* — mutable, reorderable, and short. They are maintained together and checked against
each other.

> **Opened 2026-08-19** from a full-tree audit at the close of the CS arc (CS1–CS6). Seeded with
> `BACKLOG.md` rows **B13–B33**.
> **Triaged 2026-08-19** — every active row scored and re-sorted; see [what triage changed](#what-the-triage-pass-changed).

---

## The contract between BOARD and BACKLOG

Five rules. They exist so the plan can move fast without the record losing fidelity.

1. **Every board item cites a `B` row.** A finding with no row is not ready for the board — it gets a row
   first, with `[V, file:line]` evidence, per the BACKLOG's own "Adding a row" contract.
2. **Closing a board item closes its `B` row in the same commit.** Never one without the other.
3. **A `B` row that is `Open` with a revival trigger is NOT on the board** until its trigger fires. They are
   listed under [Held](#held--on-the-record-not-on-the-board) so the comparison is explicit rather than implied by absence.
4. **The board is reorderable; items may be dropped.** But a dropped item is not deleted silently — its `B`
   row is rewritten with the reason as a revival trigger. Explicit deferral is permitted; silence is not.
5. **A fix ships with a test proven to fail against the pre-fix code.** X13's lesson, applied by default:
   *a guardrail must be shown to bite before it is counted.*

**Reconciliation is mechanizable and should be** — see `H2.4`. Every `Closes` value in BACKLOG naming an
`H` milestone must exist here; every board item must cite a live `B` row.

**Status:** `TODO` · `WIP` · `BLOCKED` · `DONE` · `DROPPED`

---

## Triage scale

Milestones are grouped by **severity**, not by which files they touch. Grouping by theme was the flaw in the
first cut of this board: it let two user-visible wrong-result defects sit in the last milestone because they
happened to live next to the cleanup work.

**Severity** — what it does to someone

| | | |
|---|---|---|
| **S1** | **data-loss** | corrupts or destroys data, or silently discards work the system already accepted |
| **S2** | **silent-wrong** | a confidently incorrect result, or a divergence the user cannot see and the system will not repair |
| **S3** | **broken** | an advertised capability throws or does nothing |
| **S4** | **degraded** | works, but misreports; or a capability gap that blocks a legitimate caller |
| **S5** | **internal** | no behavioural consequence — dead code, duplication, drift |

**Visible** — `user` · `agent` · `operator` · `internal`
**Size** — `S` (a few lines) · `M` (half a day) · `L` (structural)

**Axiom** — which standing commitment in `mission-kit/axioms` the row breaches, and whether the breach is
of the axiom's **mandate** (the invariant itself) or of a **signal** (an enforcement mechanic). drawv2
satisfies `any-system`, `stateful`, `declarative`, `multi-agent`, `llm-in-the-loop` and partially
`autonomous`, so effectively the whole set is in force.

> **Ordering rule.** The first cut of this board ordered on impact-severity alone, which was derived from
> intuition rather than from the axioms. Those two signals disagree, and the disagreement is real
> information, so both are kept and **ordering takes the higher of the two**. `readJson` hanging forever
> (**B24**) is only `S4` by user impact — no observed trigger — but it is **A7's named `Blocked Actor`
> fault against an explicit mandate** (*"no actor is permanently blocked by a system error"*), so it moves
> into H1. The absence of client tests (**B23**) is `S5` by impact and an **A9 mandate gap** — half the
> entropy battery, which A9 requires to cover *"client caches and network transports, not just the central
> service"* — which is why it sits on the critical path despite the score. Collapsing the two scales would
> have hidden both facts; the earlier board did, and B23's `S5` label openly contradicted its placement.

---

## Triage ledger

All 18 active rows, scored. Held rows are [below](#held--on-the-record-not-on-the-board).

| Row | Sev | Axiom | Visible | Size | Milestone | One line |
|---|---|---|---|---|---|---|
| **B13** | **S1** | A8 · A7 mandate | user | **S** | **H1** ✅ | a `$` in any name corrupts the file; silent until restart, then refuses to boot |
| **B15** | **S1** | **A1 mandate** | user | M | **H1** | `durableVersion` over-reports → the outbox is pruned of work never flushed |
| **B24** | S4 | **A7 mandate** | agent | **S** | **H1** ⬆ | `readJson` never settles above 1 MB — A7 `Blocked Actor`, verbatim |
| **B20** | S4 | A7 signal | operator | **S** | **H1** | GR9's assert sits in the I/O catch; permanently degrades `/health`, never re-checks |
| **B23** | S5 | **A9 mandate** | internal | **L** | **H2** | no client tests — half the entropy battery A9 requires is absent |
| **B21** | S4 | A8 signal | internal | **S** | **H2** | `tests/gate.test.js` absent; a fresh clone is entirely ungated |
| **B22** | S4 | A8 signal | internal | **L** | **H2** | `tests/diff-inverse.test.js` absent; GR5's oracle covers 15 of 23 shapes |
| **B18** | **S2** | **A7 mandate** | user | **S** | **H3** | read-only leaks 3 mutation paths → A7 `Silent Collapse` |
| **B19** | **S2** | **A7 mandate** · A9 | user | **S** | **H3** | D12's defer rule never wired; GR6 fault (ii) tests a queue that does not exist |
| **B14** | S3 | A2 signal | user | **S** | **H3** | nudge + both key-resizes throw; three advertised gestures dead |
| **B30** | **S2** | A7 mandate | user | M | **H3** | cloning a routed link silently straightens it |
| **B29** | **S2** | **A5 mandate** | user | M | **H3** | the data view reports the wrong length for every routed link |
| **B16** | **S2**† | **A2** `Doc-Code Drift` | agent | M | **H4** | `expect` discarded on REST forward writes — CAS an agent believes it has |
| **B34** | S4 | **A12** `Projection, not dump` | agent | **S** | **H4** ✚ | `commitSelection` broadcasts the whole document where every write broadcasts a delta |
| **B17** | S4 | A5 signal | user | **S** | **H4** | `undoTop` missing from the REST broadcast; the undo affordance goes stale |
| **B25** | S4 | A1 signal | agent | **S** | **H4** | `create {doc}` seeds a `meta.version` the log does not share |
| **B26** | S5 | **A3** `Air-Gap` | internal | **S** | **H5** | `patchMeta` + 4 unused imports + 10 hand-walked store internals |
| **B31** | S5 | **A2** `Doc-Code Drift` | internal | **S** | **H5** | five documented paths do not exist |
| **B28** | S5 | **A3** `Law of One` | internal | **L** | **H5** | `schema.js` is not the production path; the region renderer is cloned |

⬆ **B24 promoted H4 → H1** by the axiom review — server-side, `S`, no harness needed, and A7's mandate is
explicit that no actor may be permanently blocked. ✚ **B34 is new** (filed by the same review; it was an
audit finding that had never been banked). ✅ closed.

† **B16 is S2 in consequence, low in likelihood.** An agent sending `expect` on a forward write has no CAS
protection and will silently overwrite another writer. Nothing in-tree does this today — the CLI is
read-only and the browser uses the websocket — so it is ranked below the client S2s. It rises the moment a
second writer exists.

---

## What the triage pass changed

Four movements, and one finding that matters more than the reordering:

- **B18, B19 promoted H4 → H3.** Both are `S2` and both are `S`. B18 is a guard hoist; B19 is three lines of
  composition-root wiring. Severe, tiny, and they were queued fourth.
- **B30, B29 promoted H5 → H3.** Both are `S2` and user-visible. Grouping them as "client dedupe" let the
  theme carry the ranking — B29 in particular reports a **confidently wrong number** in a tool whose stated
  bar is *"zero ambiguity between intent and result — the machine states what will happen, in numbers."*
- **B25 demoted H3 → H4.** Genuinely `S4`, agent-facing, no observed trigger. *(B24 was demoted with it,
  then promoted to H1 by the axiom review below — impact said `S4`, the A7 mandate said otherwise.)*
- **B14 demoted H1 → H3.** Not because it matters less, but because it is `S3` and cannot be fixed before
  the harness exists. Keeping it in H1 was wishful sequencing.

**The finding: the client harness (B23) is now on the critical path, not a follow-up.** Five of the six
remaining severe rows are client-side, and rule 5 means none can be fixed before a test can construct
`Input`. That partially vindicates the *"net first"* option declined at planning time — but only for the
client half. **H1 stays first** because B13/B15/B20 are server-side and `tests/persist.test.js` and
`tests/store-atomicity.test.js` already reach them.

So the arc is: **server data-loss now → build the client net → then the client severities.**

---

## H0 — seed the registers · `WIP`

No code. The house rule is that the register is written before the implementation.

| # | Item | Row | Status |
|---|---|---|---|
| H0.1 | Land `B13`–`B33` on `docs/BACKLOG.md` with evidence citations | — | `DONE` |
| H0.2 | Correct **B7**: its stated D12 mitigation does not exist (see B19) | B7 | `DONE` |
| H0.3 | This board, triaged and scored | — | `DONE` |
| H0.4 | Resolve the four [decisions required](#decisions-required) below | — | `TODO` |

**Exit:** registers current, decisions taken, H1 sequenced.

---

## H1 — stop the data loss · `DONE`

`S1` + one adjacent `S4`. **All server-side, all reachable by suites that already exist** — which is why
this runs before the harness. **H1.1 should land on its own, immediately.**

| # | Item | Row | Sev · Size | Violates | Status |
|---|---|---|---|---|---|
| H1.1 | `serialize` — built structurally by slicing; no `replace`, no pattern interpretation. Shipped standalone | **B13** | **S1 · S** | D18; false-fires GR8/I15 | `DONE` |
| H1.2 | Adversarial-string round-trip: 7 replacement patterns, the empty-body log-drop, and the end-to-end restart. All three verified **red first**; 35/35 real files byte-identical after | B13 | — | — | `DONE` |
| H1.3 | Per-entry `flushedVersion` recorded in `flush()`; `Store.log(id)` + `Store.durableVersion(id)` retire all 10 hand-walked sites and all 3 spellings of the rule; `scan-writers` extended to keep the boundary shut (**proven to bite**) | **B15**, B26 (part) | **S1 · M** | D13, D30, A1, A3 | `DONE` |
| H1.4 | GR9 post-condition moved out of the write's try/catch; own counter (`invariantFailures`), own `/health` status (`corrupt` vs `degraded`), own message, surfaced in `draw status` | **B20** | S4 · S | GR9 | `DONE` |
| H1.5 | `readJson` settles on every terminal event, accumulates `Buffer`s, caps on BYTES, and answers **413** with `Connection: close` instead of destroying the socket. **Promoted from H4** by the axiom review | **B24** | S4 · **A7 mandate** · S | A7 | `DONE` |

**Exit:** B13, B15, B20, B24 closed. Each fix has a test verified red against the pre-fix tree. `npm run gate` green.

---

## H2 — build the net · `DONE`

Promoted onto the critical path by the triage pass: **H3 cannot start without H2.1.**

| # | Item | Row | Sev · Size | Status |
|---|---|---|---|---|
| H2.1 | Client harness — `tests/fixtures/client-harness.mjs`, ~150 lines of stubs, no dependency. Real `Model`/`Changes`/`Selection`/`Input`; assertions **only** at the commit boundary, enforced by `scan-writers`. 13 characterization tests; B14 ×3 and B37 ×1 marked `todo`, never written around | **B23** | S5 · **A9 mandate** · L | `DONE` |
| H2.2 | `tests/gate.test.js` — GR1's own self-check, **6 probes proven to bite**. Writing it found that `gate:install` wrote to `.git/hooks/` while a global `core.hooksPath` sent git elsewhere: **the gate had never run on a push**. Replaced by `tools/install-hook.sh`, which resolves git's real hook path and confines itself to this repo | **B21** | S4 · S | `DONE` |
| H2.3 | **Re-ruled at H7: CI EXISTS.** The no-CI ruling was scoped to “no remote, so nowhere to run”. `apnex/drawv2` is now public, `.github/workflows/gate.yml` runs `npm run gate` on push + PR, `prepare` installs the pre-push hook during `npm install`, and `gate.test.js` asserts the hook instead of warning. **X14 discharged** | — | verified on a real fresh clone: assert red before install, green after; global `core.hooksPath` redirect handled (B21) |
| H2.4 | `tools/scan-board.mjs` (**GR14**) — R1 citations resolve, R2 milestones exist, R3 `DONE` and `CLOSED` move together, **R4 a milestone marked DONE has no open items** (added after H3 was marked DONE with three items outstanding — R3 stayed silent because each pair *agreed*, and agreement is not completion). Wired into `npm run gate`; 6 probes proven to bite | — | — | `DONE` |
| H2.5 | **Retired** (**X15**) — a differential needs two implementations and client-side inverse building has zero: it was removed at CS3, not replaced. I3/I4's round-trip property covers the risk more strongly than a differential would have | **B22** | S4 · L | `DONE` |
| H2.6 | **Rescoped**: not “three more classes” but *the affordance surface*, which is the one H6 unit with no commit-boundary observable. 8 tests, 5 H6.3-shaped regressions proven caught | **B23** | S5 · M | A3 | `DONE` |

**Exit:** B21, B22, B23 closed. `npm run gate` green **from a fresh clone**, not just this working copy.

---

## H3 — silent divergence and wrong results · `DONE`

Every row `S2` or `S3`, every row user-visible. Ordered smallest-first — the two `S` fixes are hours, not days.

| # | Item | Row | Sev · Size | Violates | Status |
|---|---|---|---|---|---|
| H3.1 | The Server-Locked gate made **semantic, not positional**: inspection verbs (Ctrl+A, Space) hoisted above it, mutation paths (run-mode inline edit, text tool, `t`) gated below it, and the run-mode split honoured — actions still fire, editing does not. Closes **B18** and **B37** together | **B18**, **B37** | **S2 · S** | SCOPE-5, I16 | `DONE` |
| H3.2 | `bindGestureDefer(input, sync)` — a **named unit**, not two loose assignments; `onUp` wrapped so the release fires on every exit path | **B19** | **S2 · S** | D12 | `DONE` |
| H3.3 | All three burst gestures rewired onto `Changes.amend`; `lastNudge`/`lastResize`/`NUDGE_COALESCE_MS` and the three duplicated coalesce blocks deleted (**-45 lines**). `Changes.flush()` added so a burst still cannot span a selection change | **B14** | S3 · S | D11 | `DONE` |
| H3.4 | One per-kind cloner; waypoints seed and clone (without inventing a `name`); `via` remapped through the id map with missing bends pulled into the closure; `closed` carried | **B30** | **S2 · M** | — | `DONE` |
| H3.5 | **T0** taxonomy ratified (`HIERARCHY.md` §0) · **T1** `anchor` freed (5 senses → 1) · **T2** `Model.pathOf()` is the sole route→path resolver, 4 hand-rolled sites retired, endpoints resolve via `endpointOf` | **B29** | **S2 · M** | A3 | `DONE` |
| H5.5 | Dead `link` element and `wire` retired; GRC speaks *path*; `port`/`junction` recorded as **declared, not dead** | **B38** | S5 · S | A3 | `DONE` |
| H3.6 | GR6 fault (ii) now **states its scope**: it proves convergence under reordering with a simulated hold; the WIRING is pinned in `tests/input.test.js` against a real `Input` | B19 | — | GR6 | `DONE` |
| H3.7 | **B7**'s row corrected — its D12 mitigation is real as of H3.2 | B7 | — | — | `DONE` |

**Exit:** B14, B18, B19, B29, B30 closed. No path applies a mutation locally while Server-Locked; no surface
reports a number it cannot justify.

---

## H4 — agent surface · `DONE`

All `S4` except B16's `expect` half. Each item amends `README.md` / `SCOPE.md` **in the same commit** (GR10).

| # | Item | Row | Sev · Size | Violates | Status |
|---|---|---|---|---|---|
| H4.1 | `expect` rides the **`X-Draw-Expect` header** and reaches the transaction; a stale one answers 409 and writes nothing | **B16** | **S2† · S** | D14 | `DONE` |
| H4.2 | `/commit` takes `{ops, label?}`; legacy shape retired, not aliased; verbs build ops directly | **B16** | S4 · M | GR10, X1 | `DONE` |
| H4.3 | `reversalBody()` shared by both transports; `undoTop` restored to REST; surfaced and closed **B39** (the ws waived D14 on undo/redo) | **B17**, **B39** | S4 · S | D21, D14 | `DONE` |
| H4.4 | `create {doc}` validates as-arrived, installs at 0 — malformed rejected (D17), well-formed ignored (I11) | **B25** | S4 · S | D6, I11 | `DONE` |
| H4.5 | `selection {ids, actor}` — a first-class event on **both** transports (REST shipped a snapshot; the ws shipped nothing) | **B34** | S4 · **A12** · S | D7, A12 | `DONE` |
| H4.6 | `spec.test.js` derives the REST surface from the router. Found on first run: README documented **no Slides push endpoint at all** | — | — | GR10 | `DONE` |

**Exit:** B16, B17, B25, B34 closed. Spec and wire agree in both directions, mechanically.

---

## H5 — hygiene · `DONE`

All `S5`. Nothing here changes behaviour; everything here reduces the chance of the next B14.

| # | Item | Row | Sev · Size | Status |
|---|---|---|---|---|
| H5.1 | Dead surface deleted through §7.4 (7 rows); `scan-dead` in the gate | **B26** | S5 · S | `DONE` |
| H5.2 | Doc drift repointed; `scan-docrefs` extended to **code comments** and in the gate | **B31** | S5 · S | `DONE` |
| H5.3 | ~~Decide `schema.js`'s fate~~ — **resolved by PROMOTION**: the kernel renderer got the consumer it always lacked, `GET /d/<id>.svg` | **B28** | S5 · L | `DONE` |
| H5.6 | `contentLayout()` owns the arithmetic; both renderers own only emission. `scan-twins` ALLOW list now **empty** | **B40** | S5 · S | `DONE` |
| H5.7 | `document/` → `model/` — filesystem, 32 imports, the `/model` HTTP mount and the Dockerfile in one commit; `doc` deliberately untouched | **B41** | S5 · M | A3 | `DONE` |
| H5.4 | **span→px consolidated** into `spanExtent` (5 spellings → 1). The `input.js`/`palette.js` remainder — crosshair owners, zone-corner map, drag thresholds — **deferred into H6**, which restructures those files | **B36** | S5 · M | A3 | `DONE` |

**Exit:** duplication ledger closed or each survivor carries a reason. Zero dangling references.

> **Note — the rename question travels with H5.3.** Three names in this tree fail plain-text search, and all
> three are entangled with the `schema.js` decision rather than separable from it:
>
> - **`renderer` resolves to two files** — `kernel/renderer.mjs` and `app/src/renderer.js`, one a line-for-line
>   clone of the other. This *is* B28; whichever way the decision goes, one of the two names changes or one
>   of the two files stops existing.
> - **`kernel/engine.mjs` vs the `engine/` substrate** — two unrelated concepts, one word. `kernel/engine.mjs`
>   resolves a schema into a scene; `engine/` maintains the relational indices. A search for "engine" lands on
>   both and the reader has to disambiguate by path, which is exactly what a name should have done.
> - **`kernel/adapt.mjs` vs the kernel's schema concept** — and per B28 the app one is not even reachable
>   from the running client.
>
> So the H5.3 decision is not only *"is `docToSchema` the production path?"* — it is also *"what are these
> three things called afterwards?"* Renaming before the decision would be churn; renaming after it is one
> commit. **Do not split them.** Assessed against `write-discoverable-code` (rules: one definition site per
> symbol; do not rely on the module path to disambiguate a generic name).
>
> The rest of the tree passes: `grc.mjs`, `docfile.mjs`, `txn.mjs`, `locks.js`, `geometry.mjs`, `router.mjs`
> and `surface.mjs` are domain words that grep uniquely, and the three `index.mjs` files are thin re-export
> entry points, which the rule explicitly permits.

---

## H6 — decompose `input.js` · `DONE`

> **Design: `docs/spec/INPUT.md`** — the input system now has a sovereign spec, which is the point.
> Every other layer was specified before it was built; this one accreted, and it is the densest
> source of defects in the tree (B14, B18, B19, B37, B42 — five defects, three shapes, one file,
> none of them a logic error). H6 implements that spec; the spec outlives H6.

**B35**, promoted from a deferral to a scheduled arc (approved 2026-08-19). Runs **after H3–H5**: the
five H3 rows are user-visible severities that should not wait behind a structural arc, and each is
easier to verify once this lands, not harder. Governed by **A3 Sovereign Composition**; the house
pattern is already demonstrated by `kernel/` · `engine/` · `model/` — sovereign siblings importing
nothing from each other, composed only at roots.

### What the measurement says

`input.js` is 1,609 lines / 53 methods / 11 gesture modes / 14 mutable state fields / 23 commit sites.

| | lines | |
|---|---|---|
| **stateless** (20 methods) | **312** | movable with zero FSM risk |
| stateful, non-dispatcher (29) | 582 | need an owner named first |
| the 4 dispatchers | **656** | `onKeyDown` 224 · `onUp` 169 · `onDown` 162 · `onMove` 101 |

State coupling, by how many methods touch each field: `mode` 16 · `ctx` 12 · `lastPos` 8 · `readOnly` 7 ·
`focusId` 7 · `hovered` 6 · `textTool` 4 · `lastDelta` 4 · `snap` 4 · `armed` 3 · `lastResize` 3 · `help` 3 ·
`lastNudge` 2 · `datumEl` 2. The `mode`+`ctx` pair is the only genuinely central state; the rest are small
clusters that already have natural owners.

**The decisive finding: 4 of the 11 gesture modes already carry a `start*/update*/commit*` triple**
(move, clone, link, resize); the other 7 are inlined in `onUp`. The uniform shape is **latent** — the
if-ladder is hiding it. Stage 3 finishes a design that is already half-present rather than imposing one.

### Target — each duty is one sentence. If it needs "and", it is two units.

| Unit | Duty | Owns | Interface |
|---|---|---|---|
| `pick.js` **new** | Resolve a canvas point to the entity under it. | — pure | `hitAt(model,pos,opts)`, `nodeAt`, `endpointAt`, `occupiedAt` |
| `snap.js` *extend* | Constrain a position or delta to the grid and the surface. | — pure | `+ clampDelta`, `snappedDelta`, `orthoDelta`, `resizeBox` |
| `commands.js` *complete* | Turn an intent plus a selection into one committable change. | — pure | `+ wrapInZone`, `chain`, `duplicate`, `cloneClosure`, `nudge` |
| `overlay.js` **new** | Draw transient feedback for the current pointer and selection. | `hovered` `armed` `datumEl` `snap` | `hover(id)`, `arm(id,cls)`, `handles(sel)`, `datum(pos)` |
| `keymap.js` **new** | Map a keystroke to an intent. | — table | `resolve(evt, ctx) -> intent \| null` |
| `input.js` *residue* | Drive one in-flight pointer gesture from press to commit. | `mode` `ctx` `lastPos` | `GESTURES[mode] = {start, update, commit, cancel}` |

**Three new files, not eight.** Two duties fold into modules that already exist, per A3 *Earned Exposure*
— a concern earns a boundary by being one concern, not by being noticed. `commands.js` is already the home
for intent→command, which is exactly why **8 of the 23 commit sites bypassing it** is a completion job and
not a new sibling. Projected: `input.js` **1,609 → ~900**, one concern, 11 uniform handlers.

### Deliberately NOT done

- **`readOnly` does not become a module.** One concern, ~10 lines; a module for it is *Ceremony Bloat*. It
  becomes an explicit guard at the **two** entry points (pointer, key) — which is also **B18**'s fix, since
  that leak exists precisely because the guard sits mid-function instead of at the boundary.
- **No per-gesture files.** Eleven handlers of 30–60 lines belong in one module with the table. Splitting
  them fragments one answer across eleven reads, which A3 warns about as clearly as it warns about God
  Objects.

### Stages — each independently verifiable

| # | Stage | Risk | Proof |
|---|---|---|---|
| H6.1 | `DONE` — the characterization net (**H2.1**) landed, commit-boundary only, sealed by a scanner | — | Stage 0: written once, must be **unchanged** when the arc ends |
| H6.2 | `DONE` — Tier A: `pick.js` (78) + drag geometry into `snap.js`. **Tier B**: the last 11 hand-built commands become builders (`input.js` 8, `sync.js` 3), closing **B44**; `scan-writers` now enforces the command boundary | low | net green; the new rule counted against pre-fix HEAD (8+3) and both halves proven by injection |
| H6.3 | `DONE` — **overlay.js lands**: 4 fields and ~90 lines move; `input.js` **1562 → 1477**, 13 fields → 9. Event handlers stay on Input and delegate | low | net green; the affordance suite re-verified to bite in the code's NEW home |
| H6.4 | `DONE` — two tables + the full gesture lifecycle. `onDown` 167→26, `onKeyDown` 243→12, `onMove` 91→16, `dispatchUp` 168→13, `cancelDrag` 34→9. Found and closed **B43**. `input.js` **1653→1362** | real | 386 tests; B43 proven red against the genuine pre-fix code |
| H6.5 | `DONE` — the seal, **narrower than this row originally claimed**. It said DOM should fail outside `main.js`/`painter.js`; measured, that would have flagged `palette.js` and `labeledit.js`, whose job IS building their widget. The real asset was that **14 of 18 client modules already reach zero DOM globals**, every H6 unit among them. GR17 seals those 14 and allows the 4 that own the page. `input.js` became the fourteenth by injecting `host` + `help`, closing **B45** and retiring a duplicate `#help` lookup. The gesture-state rule extends from `tests/` to `app/src/` | — | proven by injection ×5, incl. the DOM rule against genuine pre-fix `input.js`; `renderer.mode` and `editing.mode` verified NOT to false-positive |
| H6.6 | `DONE` — **B36's remainder**, the last H6 item. One crosshair owner instead of two (`main.js` owns it, `Overlay`+`Palette` share it); `zoneCorners` + `OPPOSITE_CORNER` replace two transposed corner literals; the palette's magic `5` becomes `CLICK_SLOP` with the unit-system difference from `DRAG_THRESHOLD` written down | — | 393 tests; corner + crosshair rules each proven red against the genuine pre-fix arrangement |
| H6.7 | `DONE` — **B48**: the keymap resolves the intent, not just the key. Four Shift-splits where the modifier selects a different verb, plus `chain`/`star`; 27→31 entries, nothing re-reads Shift after the match. `Ctrl+Shift+Z` matched the entry named `undo` and was redirected in the handler | — | 398 tests; the table-truth test fails on the pre-split table, the 3 behavioural guards pass either way (the defect was never behavioural) |
| H6.8 | `DONE` — **B47**: `prevent` becomes a table field defaulting to true. 17 handlers lose the call; seven entries opt out for two stated reasons (Escape belongs to the browser; five claim the key only when they act). The six omissions were proven INHERITED — absent from the pre-H6.4 ladder too, unexplained | — | 402 tests; both the hoist and Escape's opt-out proven to bite |
| H6.9 | `DONE` — **B46 pure half**: 4 computing builders move to `commands.js`; `input.js` **1353→1290**. GR16's `before` rule narrowed from file-blunt to entry-scoped after it produced its first false positive | — | 405 tests; 3 builder tests proven red, and GR16 re-verified on BOTH key orders |
| H6.10 | `DONE` — `projection()` promoted from `server/txn.mjs` to `model/`; the server moves first so the promotion is proven by the existing suite before the client depends on it | — | scan-writers caught the load-ledger shift in both directions; allow-list updated deliberately |
| H6.11 | `DONE` — **B46 closes**. `cloneSubgraph` + `linkNodes` allocate against a projection; `commitRoute`'s put deleted as redundant. `input.js` **1353→1218**, `commands.js` 237→412 | — | 409 tests; both projections proven to bite by substituting the live model |
| H6.12 | `DONE` — `focusId` moves to `labeledit.js` per §8. Input wrote it from nine places and read it from none; the one reader was F2's target choice | — | 411 tests; first attempt tested the HARNESS — the stub reimplemented the rule and passed against broken product code, so it now borrows the real method |
| H6.13 | `DONE` — `textTool` moves to `Palette`; `releaseTools()` drops every armed tool in one call, finishing **B42**'s structural half. `input.js` **1653→1211** across H6 | — | 411 tests; B42's own regression proven to still bite through the new structure |

**Exit:** `input.js` states one duty in one sentence. Boundary violations are caught by tooling, not review
(A3 signal 5). The H2.1 net is unchanged from the day it was written — which is the whole proof that
behaviour was preserved.

> **Why the net must assert only at the commit boundary.** `Changes.onCommit` is sovereign to how a gesture
> was produced (D4), so tests written there survive every stage untouched. Tests asserting on `input.mode`
> or `input.ctx` would break at H6.3 and H6.4 and would become a *tax* on the refactor rather than its net —
> which is exactly how a harness ends up ratifying the God Object it was built to remove.

---

## H7 — ship it · `WIP`

The push that expires **X14**. Its first CI run immediately found a guardrail that had been weaker
than its own output claimed for two milestones — which is the argument for CI, made better by
running it than by writing it down.

| # | Item | Row | Sev · Size | Status |
|---|---|---|---|---|
| H7.1 | Public remote `apnex/drawv2`; `.github/workflows/gate.yml` runs `npm run gate` on push + PR; `prepare` installs the pre-push hook during `npm install`, so `gate.test.js` can ASSERT the hook rather than warn without breaking *fresh clone → npm install → tests pass*. **X14 discharged** | — | S3 · M | `DONE` |
| H7.2 | `scan-docrefs` resolves against `git ls-files`, not the filesystem — it had been satisfied by gitignored files on the developer's disk | **B49** | S4 · S | `DONE` |
| H7.3 | README rewritten to mission-kit's doc style: S9 order, S4 journeys, OAuth tutorial extracted to `docs/slides-setup.md`. 281 -> 214 lines | **B50** | S4 · M | `DONE` |
| H7.4 | Gate the doc style, so B50 cannot recur | **B51** | S4 · M | `TODO` |
| H7.5 | Repair the Docker build broken by the `prepare` hook | **B52** | S2 · S | `DONE` |
| H7.6 | Build the image in CI and probe it, so packaging regressions cannot ship | **B53** | S3 · M | `TODO` |
| H7.7 | Evict half-open sockets with a ws ping sweep | **B54** | S4 · S | `DONE` |

---

## H8 -- cloud deployment · `WIP`

The plan is `docs/spec/DEPLOY.md`, written before any of this.

| # | Item | Row | Sev · Size | Status |
|---|---|---|---|---|
| H8.1 | Widen the persistence seam to `{list, read, write, remove}`, filesystem default, pure refactor | **B55** | S3 · M | `DONE` |
| H8.2 | Make the seam async, then the GCS adapter on raw `fetch` with `ifGenerationMatch` for compare-and-swap | **B6**, **B59** | S2 · L | `TODO` |
| H8.3 | Slides refresh token moves off the ephemeral filesystem | **B56** | S3 · S | `TODO` |
| H8.4 | Manual image build to Artifact Registry, deploy to Cloud Run `australia-southeast1` | — | S3 · M | `TODO` |
| H8.5 | Serverless NEG, backend service, host rule, certificate MAP attach (atomic — ignores classic certs), DNS cutover | **B58** | S3 · M | `TODO` |
| H8.7 | Public `/privacy` on a separate backend — IAP has no path exclusion, so the consent-screen check cannot reach an app route | — | S2 · S | `TODO` |
| H8.6 | IAP on the backend service; consent screen is in **Testing**, not published — test users only | **B57** | S2 · S | `TODO` |

## Held — on the record, not on the board

Open `BACKLOG` rows whose trigger has not fired. Scored so the comparison is a judgement, not an omission.

| Row | Sev | Held item | Revival trigger |
|---|---|---|---|
| **B6** | **S1** | No `fsync` anywhere | any multi-instance or GCS-backed deployment |
| **B33** | S3 | No auth; CORS `*` on writes; ws has no origin check | any deployment reachable beyond loopback |
| **B7** | **S2** | Preview writes to the shared Model (the *fix*; the *mitigation* is H3.2) | the renderer-overlay arc (N7) |
| **B10** | **S2** | Put-based inverse loses intra-kind ordering → stacking can swap across delete+undo | a user reports it, or explicit z-order becomes a feature |
| **B27** | S4 | Bounds validated per field, never per derived extent | a document renders off-surface, or the first non-browser authoring client |
| **B32** | S4 | REST cannot create or delete a diagram | an agentic workflow needing to provision or retire one — **ruling first**, X12 applies |
| **B9** | S5 | No durable accountability record beyond the 100-record ring | compliance, multi-tenant, or an incident review needing history older than the ring (N12) |

**B6 is the uncomfortable one.** It is `S1` and it is held. That is defensible only because X2 records the
deviation and N5 states the guarantee at exactly the strength the code makes — but note that **B15 is the
same failure mode inside the window B6 declares safe**, which is why B15 is H1 and B6 is not.

---

## Decisions required

Four, all in H0.4. Each blocks work that should not start until it is answered.

1. **`schema.js` (B28).** Is `docToSchema` → `kernel.resolve()` the production render path, or a test/export
   adapter? Two files describe it as production and the live client never calls it, while
   `app/src/renderer.js` carries a line-for-line clone of the kernel's content-region code. Routing the
   client through the kernel is the larger change and the more coherent end state; relabelling is honest and
   cheap. **Blocks H5.3.**
2. **GR5's second half (B22).** Build `tests/diff-inverse.test.js` against the frozen fixture, or retire it
   with a recorded deviation? GR5 says the opportunity is *"destroyed permanently once the old code is
   gone"* — it is gone. **Blocks H2.5.**
3. **CI (B21).** A tracked enforcement point, or an explicit ruling that the local pre-push hook plus
   `tests/gate.test.js` is the whole gate. Today a fresh clone has neither. **Blocks H2.3.**
4. **REST diagram lifecycle (B32).** Ruling before building. X12 answered the same question `no` for
   `draw undo` on the grounds that the destructive verb must keep its gates.

---

## Not in this arc

Deliberately excluded so the arc has an edge. **Each now carries a durable marker** — the axiom review
found all three were deferred in this file only, and this file is mutable, so clearing the board would
have erased them (A14 *Insight Depreciation*; a breach of BACKLOG's own "Adding a row" contract):

- **Refactoring `input.js` and its four oversized functions** (`onKeyDown` **224** lines, `onUp` **169**,
  `onDown` **162**, `onMove` **101**) — now **B35**, trigger: *B23's harness is green*. They are the natural
  target *after* H2 gives them coverage, never before. A refactor without a net is how B14 happened.
- **Performance** — the five known costs — now **B36**, trigger: *a measured frame drop*. All sub-threshold
  today and none measured; measure before optimising.
- **Any geometry work.** Deliberately **not** given a B row: `docs/spec/HIERARCHY.md` §0/§7 and
  `design/walk/FINDINGS.md` are already its durable record, and a duplicate would be ceremony, not
  zero-loss. `HIERARCHY.md` is explicit that connections are the open frontier and containment
  is locked; the GRC walk has two surviving variants at rung 8 of 11, and `ATOMICS.md` still has the
  ±29-vs-±30 container-edge handle open. **That is a design arc, not a hardening arc.** It starts clean once
  this board is empty.
