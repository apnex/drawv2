# draw -- board

The **live, triaged, prioritised queue**.\
What we are doing next, in order.

`docs/BACKLOG.md` is the durable *record* -- append-and-close, every row evidenced, nothing ever deleted.\
This file is the *plan* -- mutable, reorderable, and short.\
They are maintained together and checked against each other.

> **Opened 2026-08-19** from a full-tree audit at the close of the CS arc (CS1-CS6). Seeded with
> `BACKLOG.md` rows **B13-B33**.
> **Triaged 2026-08-19** -- every active row scored and re-sorted; see [what triage changed](#what-the-triage-pass-changed).

---

## The contract between BOARD and BACKLOG

Five rules.\
They exist so the plan can move fast without the record losing fidelity.

1. **Every board item recording a DEFECT cites a `B` row; an item building a FEATURE says `feature`.**
   A finding with no row is not ready for the board -- it gets a row first, with `[V, file:line]`
   evidence, per the BACKLOG's own "Adding a row" contract.
   The rule used to read *every* item and was therefore never true: `H9.9` and `H9.22` were open and
   uncited, a long tail of closed items never cited anything either, and `scan-board`'s R1 only ever
   checked that a citation which EXISTS resolves. A rule demanded everywhere is enforced nowhere.
   It is also wrong as written -- BACKLOG's own contract requires a row for a deletion, a deferral or
   an unfixed defect, and not for planned work that was never a finding (**B128**).
   Enforced on OPEN items only, by R11: a closed item's citation no longer keeps a finding from being
   lost, and demanding one retroactively would rewrite records made before the rule.
2. **Closing a board item closes its `B` row in the same commit.** Never one without the other.
3. **A `B` row that is `Open` with a revival trigger is NOT on the board** until its trigger fires. They are
   listed under [Held](#held----on-the-record-not-on-the-board) so the comparison is explicit rather than implied by absence.
4. **The board is reorderable; items may be dropped.** But a dropped item is not deleted silently -- its `B`
   row is rewritten with the reason as a revival trigger. Explicit deferral is permitted; silence is not.
5. **A fix ships with a test proven to fail against the pre-fix code.** X13's lesson, applied by default:
   *a guardrail must be shown to bite before it is counted.*

**Reconciliation is mechanizable and should be** -- see `H2.4`.\
Every `Closes` value in BACKLOG naming an `H` milestone must exist here; every board item must cite a live `B` row.

**Status:** `TODO` - `WIP` - `BLOCKED` - `DONE` - `DROPPED`

**No em dashes.**\
Ruled 2026-08-26 and held by `tests/gate.test.js`.\
Write `--`, which greps, diffs and types the same everywhere, where an em dash needs a compose key and reads as a hyphen in half the places this file is opened.\
The rule is enforced rather than stated because a convention nobody checks is the thing this whole file spent the day discovering it had several of.

---

## Triage scale

Milestones are grouped by **severity**, not by which files they touch.\
Grouping by theme was the flaw in the first cut of this board: it let two user-visible wrong-result defects sit in the last milestone because they happened to live next to the cleanup work.

**Severity** -- what it does to someone

| | | |
|---|---|---|
| **S1** | **data-loss** | corrupts or destroys data, or silently discards work the system already accepted |
| **S2** | **silent-wrong** | a confidently incorrect result, or a divergence the user cannot see and the system will not repair |
| **S3** | **broken** | an advertised capability throws or does nothing |
| **S4** | **degraded** | works, but misreports; or a capability gap that blocks a legitimate caller |
| **S5** | **internal** | no behavioural consequence -- dead code, duplication, drift |

**Visible** -- `user` - `agent` - `operator` - `internal` **Size** -- `S` (a few lines) - `M` (half a day) - `L` (structural)

**Axiom** -- which standing commitment in `mission-kit/axioms` the row breaches, and whether the breach is of the axiom's **mandate** (the invariant itself) or of a **signal** (an enforcement mechanic). drawv2 satisfies `any-system`, `stateful`, `declarative`, `multi-agent`, `llm-in-the-loop` and partially `autonomous`, so effectively the whole set is in force.

> **Ordering rule.** The first cut of this board ordered on impact-severity alone, which was derived from
> intuition rather than from the axioms. Those two signals disagree, and the disagreement is real
> information, so both are kept and **ordering takes the higher of the two**. `readJson` hanging forever
> (**B24**) is only `S4` by user impact -- no observed trigger -- but it is **A7's named `Blocked Actor`
> fault against an explicit mandate** (*"no actor is permanently blocked by a system error"*), so it moves
> into H1. The absence of client tests (**B23**) is `S5` by impact and an **A9 mandate gap** -- half the
> entropy battery, which A9 requires to cover *"client caches and network transports, not just the central
> service"* -- which is why it sits on the critical path despite the score. Collapsing the two scales would
> have hidden both facts; the earlier board did, and B23's `S5` label openly contradicted its placement.

---

## Triage ledger -- historical, from the 2026-08-19 cut

**Every row in this table is closed.**\
Kept because the scoring is the record of how the H1-H5 arc was ordered and why, including the two places where impact and axiom disagreed and the axiom won.\
It is not the current queue -- that is [Next slice](#next-slice----ordered-by-a14-capital-forward-value), and the live rows are reconciled mechanically by `scan-board` R8.

All 18 rows active at the time, scored.\
Held rows are [below](#held----on-the-record-not-on-the-board).

| Row | Sev | Axiom | Visible | Size | Milestone | One line |
|---|---|---|---|---|---|---|
| **B13** | **S1** | A8 - A7 mandate | user | **S** | **H1** [x]| a `$` in any name corrupts the file; silent until restart, then refuses to boot |
| **B15** | **S1** | **A1 mandate** | user | M | **H1** | `durableVersion` over-reports -> the outbox is pruned of work never flushed |
| **B24** | S4 | **A7 mandate** | agent | **S** | **H1** ^ | `readJson` never settles above 1 MB -- A7 `Blocked Actor`, verbatim |
| **B20** | S4 | A7 signal | operator | **S** | **H1** | GR9's assert sits in the I/O catch; permanently degrades `/health`, never re-checks |
| **B23** | S5 | **A9 mandate** | internal | **L** | **H2** | no client tests -- half the entropy battery A9 requires is absent |
| **B21** | S4 | A8 signal | internal | **S** | **H2** | `tests/gate.test.js` absent; a fresh clone is entirely ungated |
| **B22** | S4 | A8 signal | internal | **L** | **H2** | `tests/diff-inverse.test.js` absent; GR5's oracle covers 15 of 23 shapes |
| **B18** | **S2** | **A7 mandate** | user | **S** | **H3** | read-only leaks 3 mutation paths -> A7 `Silent Collapse` |
| **B19** | **S2** | **A7 mandate** - A9 | user | **S** | **H3** | D12's defer rule never wired; GR6 fault (ii) tests a queue that does not exist |
| **B14** | S3 | A2 signal | user | **S** | **H3** | nudge + both key-resizes throw; three advertised gestures dead |
| **B30** | **S2** | A7 mandate | user | M | **H3** | cloning a routed link silently straightens it |
| **B29** | **S2** | **A5 mandate** | user | M | **H3** | the data view reports the wrong length for every routed link |
| **B16** | **S2**[*] | **A2** `Doc-Code Drift` | agent | M | **H4** | `expect` discarded on REST forward writes -- CAS an agent believes it has |
| **B34** | S4 | **A12** `Projection, not dump` | agent | **S** | **H4** + | `commitSelection` broadcasts the whole document where every write broadcasts a delta |
| **B17** | S4 | A5 signal | user | **S** | **H4** | `undoTop` missing from the REST broadcast; the undo affordance goes stale |
| **B25** | S4 | A1 signal | agent | **S** | **H4** | `create {doc}` seeds a `meta.version` the log does not share |
| **B26** | S5 | **A3** `Air-Gap` | internal | **S** | **H5** | `patchMeta` + 4 unused imports + 10 hand-walked store internals |
| **B31** | S5 | **A2** `Doc-Code Drift` | internal | **S** | **H5** | five documented paths do not exist |
| **B28** | S5 | **A3** `Law of One` | internal | **L** | **H5** | `schema.js` is not the production path; the region renderer is cloned |

^ **B24 promoted H4 -> H1** by the axiom review -- server-side, `S`, no harness needed, and A7's mandate is explicit that no actor may be permanently blocked. + **B34 is new** (filed by the same review; it was an audit finding that had never been banked).\
[x] closed.

[*] **B16 is S2 in consequence, low in likelihood.**\
An agent sending `expect` on a forward write has no CAS protection and will silently overwrite another writer.\
Nothing in-tree does this today -- the CLI is read-only and the browser uses the websocket -- so it is ranked below the client S2s.\
It rises the moment a second writer exists.

---

## What the triage pass changed

Four movements, and one finding that matters more than the reordering:

- **B18, B19 promoted H4 -> H3.** Both are `S2` and both are `S`. B18 is a guard hoist; B19 is three lines of
  composition-root wiring. Severe, tiny, and they were queued fourth.
- **B30, B29 promoted H5 -> H3.** Both are `S2` and user-visible. Grouping them as "client dedupe" let the
  theme carry the ranking -- B29 in particular reports a **confidently wrong number** in a tool whose stated
  bar is *"zero ambiguity between intent and result -- the machine states what will happen, in numbers."*
- **B25 demoted H3 -> H4.** Genuinely `S4`, agent-facing, no observed trigger. *(B24 was demoted with it,
  then promoted to H1 by the axiom review below -- impact said `S4`, the A7 mandate said otherwise.)*
- **B14 demoted H1 -> H3.** Not because it matters less, but because it is `S3` and cannot be fixed before
  the harness exists. Keeping it in H1 was wishful sequencing.

**The finding: the client harness (B23) is now on the critical path, not a follow-up.**\
Five of the six remaining severe rows are client-side, and rule 5 means none can be fixed before a test can construct `Input`.\
That partially vindicates the *"net first"* option declined at planning time -- but only for the client half.\
**H1 stays first** because B13/B15/B20 are server-side and `tests/persist.test.js` and `tests/store-atomicity.test.js` already reach them.

So the arc is: **server data-loss now -> build the client net -> then the client severities.**

---

## Next slice -- ordered by A14 capital-forward value

Re-cut 2026-08-27, after the agent-first authoring arc.\
Ranked by deleted future friction rather than by size or by how recently something was noticed.

The previous cut organized around a pattern -- a check whose scope is narrower than its stated claim -- and that pattern held: it accounted for eleven of the defects closed since.\
**What changed is that a second organizing axis appeared, and it is named in the axioms rather than invented here.**

**A5 Perceptual Parity** turns out to describe the whole agent-first arc, and it was being satisfied by instinct.\
Its first mechanic, Synthetic Sensory Organs, is what `map`, `render --summary` and the walking verbs are.\
Its second, Measured Parity, is `draw parity`, and it did not exist until it was looked for.\
Two of its four named faults were live all day: Cognitive Friction, with the director acting as the agent's eyes, and Black-Box Failure, where 594 green tests coexisted with a `draw` that could not run through a symlink.

The ranking below therefore weighs one question above size: **does this let an agent perceive something it currently has to be told, or reason about something it currently has to derive?**

| Order | Item | Tier | Why it ranks here |
|---|---|---|---|
| 1 | -- | verifier | **H11.4 closed 2026-09-01, re-scoped by measurement.** The stated check was undecidable; the census candidate scored 2 of 9. `tools/mutate.mjs` automates the technique that caught seven of the nine, and found two more gaps on its first run. Original ranking note follows | The general form of every defect this session found by mutation rather than by reading. Narrower than when filed -- the parity gate, `tests/routes.test.js` and `scan-cli` each answer it in one domain -- so **re-scope before building**, and the re-scoping is most of the work. Sharpened since: B147 shipped three times because each test asserted the layer below the one that broke, and mutation cannot see that, because a mutant only probes the assertions that exist. |
| 2 | -- | user | **H10.3 closed 2026-09-01.** The durable status surface. A server error survives until the next message overwrites it, so the one channel the client has for trouble is the one that forgets -- A5's Operational Lag, on the human side of the symmetry. The only item here a person would notice. |
| 3 | Level 2 placement | feature | `place` extensions and the `gridLayout` entity, designed in `docs/spec/LAYOUT.md`. The largest remaining product value, and now much cheaper to verify because the map shows what a layout did. |
| 4 | H11.29 | verifier | `COMMIT.md` section 5 claims to list the guardrails and has no row for `GR14`. A statement of record, not behaviour. H9.20 closed 2026-08-27: the index is pinned, and the general count rule is deferred with its convention written down. |
| 5 | -- | agent | **H10.32 closed 2026-09-01.** A verb now refuses a positional it never declared, at the dispatcher rather than in 41 verbs. Kept as a rank so the ordering below is not silently renumbered |
| 6 | H10.8 | local | Real, small, compounding into nothing alone. Take them opportunistically. **H9.22 closed and left this tier 2026-09-01.** Closed from this tier on 2026-08-27: H10.17 (the caps have one home) and H10.16 (the referential rules have one statement). |
| -- | H10.7 | blocked | Bounded parallel connections. **H10.11 closed and left this tier 2026-09-01.** **H10.7 is blocked in practice on H10.8**, because the apparatus that derived its bound is not in the tree. |

**What the arc left undone, deliberately.**\
The map shows what is where and not what connects to what, and links are not going on it -- `links`, `about` and `link path` answer connectivity as lists, and a text grid carrying both would be the mess the design set out to avoid.\
Type glyphs are also not identity: three servers read as `s s s` and the key disambiguates them.\
That is acceptable while authoring, and is the weakest part of the surface for reading a diagram somebody else built, which is the test case not yet run.

---

## H0 -- seed the registers - `DONE`

No code.\
The house rule is that the register is written before the implementation.

| # | Item | Row | Status |
|---|---|---|---|
| H0.1 | Land `B13`-`B33` on `docs/BACKLOG.md` with evidence citations | -- | `DONE` |
| H0.2 | Correct **B7**: its stated D12 mitigation does not exist (see B19) | B7 | `DONE` |
| H0.3 | This board, triaged and scored | -- | `DONE` |
| H0.4 | Resolve the ONE remaining [decision required](#decisions-required) -- B32, the REST diagram lifecycle. Three of the original four were answered by later work and the section said otherwise. **Ruled 2026-08-23**: `POST` and `DELETE` both exist, `DELETE` gated on write access rather than ownership | **B32** | `DONE` |

**Exit:** registers current, decisions taken, H1 sequenced.

---

## H1 -- stop the data loss - `DONE`

`S1` + one adjacent `S4`.\
**All server-side, all reachable by suites that already exist** -- which is why this runs before the harness.\
**H1.1 should land on its own, immediately.**

| # | Item | Row | Sev - Size | Violates | Status |
|---|---|---|---|---|---|
| H1.1 | `serialize` -- built structurally by slicing; no `replace`, no pattern interpretation. Shipped standalone | **B13** | **S1 - S** | D18; false-fires GR8/I15 | `DONE` |
| H1.2 | Adversarial-string round-trip: 7 replacement patterns, the empty-body log-drop, and the end-to-end restart. All three verified **red first**; 35/35 real files byte-identical after | B13 | -- | -- | `DONE` |
| H1.3 | Per-entry `flushedVersion` recorded in `flush()`; `Store.log(id)` + `Store.durableVersion(id)` retire all 10 hand-walked sites and all 3 spellings of the rule; `scan-writers` extended to keep the boundary shut (**proven to bite**) | **B15**, B26 (part) | **S1 - M** | D13, D30, A1, A3 | `DONE` |
| H1.4 | GR9 post-condition moved out of the write's try/catch; own counter (`invariantFailures`), own `/health` status (`corrupt` vs `degraded`), own message, surfaced in `draw status` | **B20** | S4 - S | GR9 | `DONE` |
| H1.5 | `readJson` settles on every terminal event, accumulates `Buffer`s, caps on BYTES, and answers **413** with `Connection: close` instead of destroying the socket. **Promoted from H4** by the axiom review | **B24** | S4 - **A7 mandate** - S | A7 | `DONE` |

**Exit:** B13, B15, B20, B24 closed.\
Each fix has a test verified red against the pre-fix tree.\
`npm run gate` green.

---

## H2 -- build the net - `DONE`

Promoted onto the critical path by the triage pass: **H3 cannot start without H2.1.**

| # | Item | Row | Sev - Size | Status |
|---|---|---|---|---|
| H2.1 | Client harness -- `tests/fixtures/client-harness.mjs`, ~150 lines of stubs, no dependency. Real `Model`/`Changes`/`Selection`/`Input`; assertions **only** at the commit boundary, enforced by `scan-writers`. 13 characterization tests; B14 x3 and B37 x1 marked `todo`, never written around | **B23** | S5 - **A9 mandate** - L | `DONE` |
| H2.2 | `tests/gate.test.js` -- GR1's own self-check, **6 probes proven to bite**. Writing it found that `gate:install` wrote to `.git/hooks/` while a global `core.hooksPath` sent git elsewhere: **the gate had never run on a push**. Replaced by `tools/install-hook.sh`, which resolves git's real hook path and confines itself to this repo | **B21** | S4 - S | `DONE` |
| H2.3 | **Re-ruled at H7: CI EXISTS.** The no-CI ruling was scoped to "no remote, so nowhere to run". `apnex/drawv2` is now public, `.github/workflows/gate.yml` runs `npm run gate` on push + PR, `prepare` installs the pre-push hook during `npm install`, and `gate.test.js` asserts the hook instead of warning. **X14 discharged**, verified on a real fresh clone: assert red before install, green after; global `core.hooksPath` redirect handled (B21) | -- | S2 - M | `DONE` |
| H2.4 | `tools/scan-board.mjs` (**GR14**) -- R1 citations resolve, R2 milestones exist, R3 `DONE` and `CLOSED` move together, **R4 a milestone marked DONE has no open citing items**, **R5 every item declares a state**, **R6 a heading agrees with the states beneath it in both directions** (added after H3 was marked DONE with three items outstanding -- R3 stayed silent because each pair *agreed*, and agreement is not completion). Wired into `npm run gate`; 6 probes proven to bite | -- | -- | `DONE` |
| H2.5 | **Retired** (**X15**) -- a differential needs two implementations and client-side inverse building has zero: it was removed at CS3, not replaced. I3/I4's round-trip property covers the risk more strongly than a differential would have | **B22** | S4 - L | `DONE` |
| H2.6 | **Rescoped**: not "three more classes" but *the affordance surface*, which is the one H6 unit with no commit-boundary observable. 8 tests, 5 H6.3-shaped regressions proven caught | **B23** | S5 - M | A3 | `DONE` |

**Exit:** B21, B22, B23 closed.\
`npm run gate` green **from a fresh clone**, not just this working copy.

---

## H3 -- silent divergence and wrong results - `DONE`

Every row `S2` or `S3`, every row user-visible.\
Ordered smallest-first -- the two `S` fixes are hours, not days.

| # | Item | Row | Sev - Size | Violates | Status |
|---|---|---|---|---|---|
| H3.1 | The Server-Locked gate made **semantic, not positional**: inspection verbs (Ctrl+A, Space) hoisted above it, mutation paths (run-mode inline edit, text tool, `t`) gated below it, and the run-mode split honoured -- actions still fire, editing does not. Closes **B18** and **B37** together | **B18**, **B37** | **S2 - S** | SCOPE-5, I16 | `DONE` |
| H3.2 | `bindGestureDefer(input, sync)` -- a **named unit**, not two loose assignments; `onUp` wrapped so the release fires on every exit path | **B19** | **S2 - S** | D12 | `DONE` |
| H3.3 | All three burst gestures rewired onto `Changes.amend`; `lastNudge`/`lastResize`/`NUDGE_COALESCE_MS` and the three duplicated coalesce blocks deleted (**-45 lines**). `Changes.flush()` added so a burst still cannot span a selection change | **B14** | S3 - S | D11 | `DONE` |
| H3.4 | One per-kind cloner; waypoints seed and clone (without inventing a `name`); `via` remapped through the id map with missing bends pulled into the closure; `closed` carried | **B30** | **S2 - M** | -- | `DONE` |
| H3.5 | **T0** taxonomy ratified (`HIERARCHY.md` section 0) - **T1** `anchor` freed (5 senses -> 1) - **T2** `Model.pathOf()` is the sole route->path resolver, 4 hand-rolled sites retired, endpoints resolve via `endpointOf` | **B29** | **S2 - M** | A3 | `DONE` |
| H5.5 | Dead `link` element and `wire` retired; GRC speaks *path*; `port`/`junction` recorded as **declared, not dead** | **B38** | S5 - S | A3 | `DONE` |
| H3.6 | GR6 fault (ii) now **states its scope**: it proves convergence under reordering with a simulated hold; the WIRING is pinned in `tests/input.test.js` against a real `Input` | B19 | -- | GR6 | `DONE` |
| H3.7 | **B7**'s row corrected -- its D12 mitigation is real as of H3.2 | B7 | -- | -- | `DONE` |

**Exit:** B14, B18, B19, B29, B30 closed.\
No path applies a mutation locally while Server-Locked; no surface reports a number it cannot justify.

---

## H4 -- agent surface - `DONE`

All `S4` except B16's `expect` half.\
Each item amends `README.md` / `SCOPE.md` **in the same commit** (GR10).

| # | Item | Row | Sev - Size | Violates | Status |
|---|---|---|---|---|---|
| H4.1 | `expect` rides the **`X-Draw-Expect` header** and reaches the transaction; a stale one answers 409 and writes nothing | **B16** | **S2[*] - S** | D14 | `DONE` |
| H4.2 | `/commit` takes `{ops, label?}`; legacy shape retired, not aliased; verbs build ops directly | **B16** | S4 - M | GR10, X1 | `DONE` |
| H4.3 | `reversalBody()` shared by both transports; `undoTop` restored to REST; surfaced and closed **B39** (the ws waived D14 on undo/redo) | **B17**, **B39** | S4 - S | D21, D14 | `DONE` |
| H4.4 | `create {doc}` validates as-arrived, installs at 0 -- malformed rejected (D17), well-formed ignored (I11) | **B25** | S4 - S | D6, I11 | `DONE` |
| H4.5 | `selection {ids, actor}` -- a first-class event on **both** transports (REST shipped a snapshot; the ws shipped nothing) | **B34** | S4 - **A12** - S | D7, A12 | `DONE` |
| H4.6 | `spec.test.js` derives the REST surface from the router. Found on first run: README documented **no Slides push endpoint at all** | -- | -- | GR10 | `DONE` |

**Exit:** B16, B17, B25, B34 closed.\
Spec and wire agree in both directions, mechanically.

---

## H5 -- hygiene - `DONE`

All `S5`.\
Nothing here changes behaviour; everything here reduces the chance of the next B14.

| # | Item | Row | Sev - Size | Status |
|---|---|---|---|---|
| H5.1 | Dead surface deleted through section 7.4 (7 rows); `scan-dead` in the gate | **B26** | S5 - S | `DONE` |
| H5.2 | Doc drift repointed; `scan-docrefs` extended to **code comments** and in the gate | **B31** | S5 - S | `DONE` |
| H5.3 | ~~Decide `schema.js`'s fate~~ -- **resolved by PROMOTION**: the kernel renderer got the consumer it always lacked, `GET /d/<id>.svg` | **B28** | S5 - L | `DONE` |
| H5.6 | `contentLayout()` owns the arithmetic; both renderers own only emission. `scan-twins` ALLOW list now **empty** | **B40** | S5 - S | `DONE` |
| H5.7 | `document/` -> `model/` -- filesystem, 32 imports, the `/model` HTTP mount and the Dockerfile in one commit; `doc` deliberately untouched | **B41** | S5 - M | A3 | `DONE` |
| H5.8 | The `doc` / `Model` vocabulary is stated where the names are met -- `validateDoc`, `toJSON`, and a SCOPE.md vocabulary section -- because the ruling lived only in a closed backlog cell and the question recurred five milestones later | **B95** | S1 - S | `DONE` |
| H5.4 | **span->px consolidated** into `spanExtent` (5 spellings -> 1). The `input.js`/`palette.js` remainder -- crosshair owners, zone-corner map, drag thresholds -- **deferred into H6**, which restructures those files | **B36** | S5 - M | A3 | `DONE` |

**Exit:** duplication ledger closed or each survivor carries a reason.\
Zero dangling references.

> **Note -- the rename question travels with H5.3.** Three names in this tree fail plain-text search, and all
> three are entangled with the `schema.js` decision rather than separable from it:
>
> - **`renderer` resolves to two files** -- `kernel/renderer.mjs` and `app/src/renderer.js`, one a line-for-line
>   clone of the other. This *is* B28; whichever way the decision goes, one of the two names changes or one
>   of the two files stops existing.
> - **`kernel/engine.mjs` vs the `engine/` substrate** -- two unrelated concepts, one word. `kernel/engine.mjs`
>   resolves a schema into a scene; `engine/` maintains the relational indices. A search for "engine" lands on
>   both and the reader has to disambiguate by path, which is exactly what a name should have done.
> - **`kernel/adapt.mjs` vs the kernel's schema concept** -- and per B28 the app one is not even reachable
>   from the running client.
>
> So the H5.3 decision is not only *"is `docToSchema` the production path?"* -- it is also *"what are these
> three things called afterwards?"* Renaming before the decision would be churn; renaming after it is one
> commit. **Do not split them.** Assessed against `write-discoverable-code` (rules: one definition site per
> symbol; do not rely on the module path to disambiguate a generic name).
>
> The rest of the tree passes: `grc.mjs`, `docfile.mjs`, `txn.mjs`, `locks.js`, `geometry.mjs`, `router.mjs`
> and `surface.mjs` are domain words that grep uniquely, and the three `index.mjs` files are thin re-export
> entry points, which the rule explicitly permits.

---

## H6 -- decompose `input.js` - `DONE`

> **Design: `docs/spec/INPUT.md`** -- the input system now has a sovereign spec, which is the point.
> Every other layer was specified before it was built; this one accreted, and it is the densest
> source of defects in the tree (B14, B18, B19, B37, B42 -- five defects, three shapes, one file,
> none of them a logic error). H6 implements that spec; the spec outlives H6.

**B35**, promoted from a deferral to a scheduled arc (approved 2026-08-19).\
Runs **after H3-H5**: the five H3 rows are user-visible severities that should not wait behind a structural arc, and each is easier to verify once this lands, not harder.\
Governed by **A3 Sovereign Composition**; the house pattern is already demonstrated by `kernel/` - `engine/` - `model/` -- sovereign siblings importing nothing from each other, composed only at roots.

### What the measurement says

`input.js` is 1,609 lines / 53 methods / 11 gesture modes / 14 mutable state fields / 23 commit sites.

| | lines | |
|---|---|---|
| **stateless** (20 methods) | **312** | movable with zero FSM risk |
| stateful, non-dispatcher (29) | 582 | need an owner named first |
| the 4 dispatchers | **656** | `onKeyDown` 224 - `onUp` 169 - `onDown` 162 - `onMove` 101 |

State coupling, by how many methods touch each field: `mode` 16 - `ctx` 12 - `lastPos` 8 - `readOnly` 7 - `focusId` 7 - `hovered` 6 - `textTool` 4 - `lastDelta` 4 - `snap` 4 - `armed` 3 - `lastResize` 3 - `help` 3 - `lastNudge` 2 - `datumEl` 2.\
The `mode`+`ctx` pair is the only genuinely central state; the rest are small clusters that already have natural owners.

**The decisive finding: 4 of the 11 gesture modes already carry a `start*/update*/commit*` triple** (move, clone, link, resize); the other 7 are inlined in `onUp`.\
The uniform shape is **latent** -- the if-ladder is hiding it.\
Stage 3 finishes a design that is already half-present rather than imposing one.

### Target -- each duty is one sentence. If it needs "and", it is two units.

| Unit | Duty | Owns | Interface |
|---|---|---|---|
| `pick.js` **new** | Resolve a canvas point to the entity under it. | -- pure | `hitAt(model,pos,opts)`, `nodeAt`, `endpointAt`, `occupiedAt` |
| `snap.js` *extend* | Constrain a position or delta to the grid and the surface. | -- pure | `+ clampDelta`, `snappedDelta`, `orthoDelta`, `resizeBox` |
| `commands.js` *complete* | Turn an intent plus a selection into one committable change. | -- pure | `+ wrapInZone`, `chain`, `duplicate`, `cloneClosure`, `nudge` |
| `overlay.js` **new** | Draw transient feedback for the current pointer and selection. | `hovered` `armed` `datumEl` `snap` | `hover(id)`, `arm(id,cls)`, `handles(sel)`, `datum(pos)` |
| `keymap.js` **new** | Map a keystroke to an intent. | -- table | `resolve(evt, ctx) -> intent \| null` |
| `input.js` *residue* | Drive one in-flight pointer gesture from press to commit. | `mode` `ctx` `lastPos` | `GESTURES[mode] = {start, update, commit, cancel}` |

**Three new files, not eight.**\
Two duties fold into modules that already exist, per A3 *Earned Exposure* -- a concern earns a boundary by being one concern, not by being noticed.\
`commands.js` is already the home for intent->command, which is exactly why **8 of the 23 commit sites bypassing it** is a completion job and not a new sibling.\
Projected: `input.js` **1,609 -> ~900**, one concern, 11 uniform handlers.

### Deliberately NOT done

- **`readOnly` does not become a module.** One concern, ~10 lines; a module for it is *Ceremony Bloat*. It
  becomes an explicit guard at the **two** entry points (pointer, key) -- which is also **B18**'s fix, since
  that leak exists precisely because the guard sits mid-function instead of at the boundary.
- **No per-gesture files.** Eleven handlers of 30-60 lines belong in one module with the table. Splitting
  them fragments one answer across eleven reads, which A3 warns about as clearly as it warns about God
  Objects.

### Stages -- each independently verifiable

| # | Stage | Risk | Proof |
|---|---|---|---|
| H6.1 | `DONE` -- the characterization net (**H2.1**) landed, commit-boundary only, sealed by a scanner | -- | Stage 0: written once, must be **unchanged** when the arc ends |
| H6.2 | `DONE` -- Tier A: `pick.js` (78) + drag geometry into `snap.js`. **Tier B**: the last 11 hand-built commands become builders (`input.js` 8, `sync.js` 3), closing **B44**; `scan-writers` now enforces the command boundary | low | net green; the new rule counted against pre-fix HEAD (8+3) and both halves proven by injection |
| H6.3 | `DONE` -- **overlay.js lands**: 4 fields and ~90 lines move; `input.js` **1562 -> 1477**, 13 fields -> 9. Event handlers stay on Input and delegate | low | net green; the affordance suite re-verified to bite in the code's NEW home |
| H6.4 | `DONE` -- two tables + the full gesture lifecycle. `onDown` 167->26, `onKeyDown` 243->12, `onMove` 91->16, `dispatchUp` 168->13, `cancelDrag` 34->9. Found and closed **B43**. `input.js` **1653->1362** | real | 386 tests; B43 proven red against the genuine pre-fix code |
| H6.5 | `DONE` -- the seal, **narrower than this row originally claimed**. It said DOM should fail outside `main.js`/`painter.js`; measured, that would have flagged `palette.js` and `labeledit.js`, whose job IS building their widget. The real asset was that **14 of 18 client modules already reach zero DOM globals**, every H6 unit among them. GR17 seals those 14 and allows the 4 that own the page. `input.js` became the fourteenth by injecting `host` + `help`, closing **B45** and retiring a duplicate `#help` lookup. The gesture-state rule extends from `tests/` to `app/src/` | -- | proven by injection x5, incl. the DOM rule against genuine pre-fix `input.js`; `renderer.mode` and `editing.mode` verified NOT to false-positive |
| H6.6 | `DONE` -- **B36's remainder**, the last H6 item. One crosshair owner instead of two (`main.js` owns it, `Overlay`+`Palette` share it); `zoneCorners` + `OPPOSITE_CORNER` replace two transposed corner literals; the palette's magic `5` becomes `CLICK_SLOP` with the unit-system difference from `DRAG_THRESHOLD` written down | -- | 393 tests; corner + crosshair rules each proven red against the genuine pre-fix arrangement |
| H6.7 | `DONE` -- **B48**: the keymap resolves the intent, not just the key. Four Shift-splits where the modifier selects a different verb, plus `chain`/`star`; 27->31 entries, nothing re-reads Shift after the match. `Ctrl+Shift+Z` matched the entry named `undo` and was redirected in the handler | -- | 398 tests; the table-truth test fails on the pre-split table, the 3 behavioural guards pass either way (the defect was never behavioural) |
| H6.8 | `DONE` -- **B47**: `prevent` becomes a table field defaulting to true. 17 handlers lose the call; seven entries opt out for two stated reasons (Escape belongs to the browser; five claim the key only when they act). The six omissions were proven INHERITED -- absent from the pre-H6.4 ladder too, unexplained | -- | 402 tests; both the hoist and Escape's opt-out proven to bite |
| H6.9 | `DONE` -- **B46 pure half**: 4 computing builders move to `commands.js`; `input.js` **1353->1290**. GR16's `before` rule narrowed from file-blunt to entry-scoped after it produced its first false positive | -- | 405 tests; 3 builder tests proven red, and GR16 re-verified on BOTH key orders |
| H6.10 | `DONE` -- `projection()` promoted from `server/txn.mjs` to `model/`; the server moves first so the promotion is proven by the existing suite before the client depends on it | -- | scan-writers caught the load-ledger shift in both directions; allow-list updated deliberately |
| H6.11 | `DONE` -- **B46 closes**. `cloneSubgraph` + `linkNodes` allocate against a projection; `commitRoute`'s put deleted as redundant. `input.js` **1353->1218**, `commands.js` 237->412 | -- | 409 tests; both projections proven to bite by substituting the live model |
| H6.12 | `DONE` -- `focusId` moves to `labeledit.js` per section 8. Input wrote it from nine places and read it from none; the one reader was F2's target choice | -- | 411 tests; first attempt tested the HARNESS -- the stub reimplemented the rule and passed against broken product code, so it now borrows the real method |
| H6.13 | `DONE` -- `textTool` moves to `Palette`; `releaseTools()` drops every armed tool in one call, finishing **B42**'s structural half. `input.js` **1653->1211** across H6 | -- | 411 tests; B42's own regression proven to still bite through the new structure |

**Exit:** `input.js` states one duty in one sentence.\
Boundary violations are caught by tooling, not review (A3 signal 5).\
The H2.1 net is unchanged from the day it was written -- which is the whole proof that behaviour was preserved.

> **Why the net must assert only at the commit boundary.** `Changes.onCommit` is sovereign to how a gesture
> was produced (D4), so tests written there survive every stage untouched. Tests asserting on `input.mode`
> or `input.ctx` would break at H6.3 and H6.4 and would become a *tax* on the refactor rather than its net --
> which is exactly how a harness ends up ratifying the God Object it was built to remove.

---

## H7 -- ship it - `DONE`

The push that expires **X14**.\
Its first CI run immediately found a guardrail that had been weaker than its own output claimed for two milestones -- which is the argument for CI, made better by running it than by writing it down.

| # | Item | Row | Sev - Size | Status |
|---|---|---|---|---|
| H7.1 | Public remote `apnex/drawv2`; `.github/workflows/gate.yml` runs `npm run gate` on push + PR; `prepare` installs the pre-push hook during `npm install`, so `gate.test.js` can ASSERT the hook rather than warn without breaking *fresh clone -> npm install -> tests pass*. **X14 discharged** | -- | S3 - M | `DONE` |
| H7.2 | `scan-docrefs` resolves against `git ls-files`, not the filesystem -- it had been satisfied by gitignored files on the developer's disk | **B49** | S4 - S | `DONE` |
| H7.3 | README rewritten to mission-kit's doc style: S9 order, S4 journeys, OAuth tutorial extracted to `docs/slides-setup.md`. 281 -> 214 lines | **B50** | S4 - M | `DONE` |
| H7.4 | Gate the doc style, so B50 cannot recur | **B51** | S4 - M | `DONE` |
| H7.5 | Repair the Docker build broken by the `prepare` hook | **B52** | S2 - S | `DONE` |
| H7.6 | Build the image in CI and probe it, so packaging regressions cannot ship | **B53** | S3 - M | `DONE` |
| H7.7 | Evict half-open sockets with a ws ping sweep | **B54** | S4 - S | `DONE` |

---

## H8 -- cloud deployment - `DONE`

The plan is `docs/spec/DEPLOY.md`, written before any of this.

| # | Item | Row | Sev - Size | Status |
|---|---|---|---|---|
| H8.1 | Widen the persistence seam to `{list, read, write, remove}`, filesystem default, pure refactor | **B55** | S3 - M | `DONE` |
| H8.2 | Make the seam async, then the GCS adapter on raw `fetch` with `ifGenerationMatch` for compare-and-swap | **B6**, **B59** | S2 - L | `DONE` |
| H8.3 | Slides refresh token moves off the ephemeral filesystem -- **dropped with the feature**; Slides is purged in both phases, so there is no token. B56 and B57 carry the revival trigger | **B56**, **B57** | S3 - S | `DROPPED` |
| H8.4 | Manual image build to Artifact Registry, deploy to Cloud Run `australia-southeast1` | -- | S3 - M | `DONE` |
| H8.5 | Serverless NEG, backend service, host rule, certificate MAP attach (atomic -- ignores classic certs), DNS cutover | **B58** | S3 - M | `DONE` |
| H8.7 | Public `/about`, `/privacy`, `/terms` on a separate backend bucket -- IAP has no path exclusion, so verification cannot reach an app route | -- | S2 - S | `DONE` |
| H8.8 | The REST/agent surface is behind IAP and the CLI sends no credential -- decide how an agent authenticates | **B61** | S2 - M | `DONE` |
| H8.6 | IAP on the backend service; consent screen is in **Testing**, not published -- test users only | **B57** | S2 - S | `DONE` |

---

## H9 -- access control - `DONE`

Authorization for an **agent-first** tool, designed in `docs/spec/ACCESS.md`.\
Two authentication methods -- Google identity via IAP, and an agent identity holding a connection code -- resolving to one grant model, scoped per diagram or per owner.\
Amended 2026-08-21: the milestone was written human-first and did not say so; the human work landed to date was opportunistic, and the agent half is what remains.

| # | Item | Cites | Size | State |
|---|---|---|---|---|
| H9.1 | Principal + grant model: `(principal, diagram) -> read \| write`, stored in `meta` as server-recorded status, never a commit | -- | S3 - L | `DONE` |
| H9.2a | Authentication boundary: verify `x-goog-iap-jwt-assertion`, emit a principal, cross-check the email header | -- | S3 - M | `DONE` |
| H9.2b | `list()` filters by grant behind an `authz` switch; `OWNER` adopts what predates ownership; boot refuses `BUCKET` without `IAP_AUDIENCE` | -- | S3 - M | `DONE` |
| H9.2c | Plumb the principal from the request into REST and websocket handlers -- the boundary exists but no handler calls it yet | -- | S3 - M | `DONE` |
| H9.11 | `scan-dead` counted internal use as consumption, so 18 exports passed on their own references; also strips strings, and reports exemptions that have outlived their cause | **B62** | S2 - M | `DONE` |
| H9.3a | Enforce write at the store: all seven mutating methods gated, fail-closed on a missing principal | -- | S2 - M | `DONE` |
| H9.3b | Pass the principal from REST and websocket handlers into the seven gated methods, and map `forbidden` to `403` | -- | S2 - M | `DONE` |
| H9.3c | Give the client its own read-only state, distinct from Server-Locked, driven by the server's write predicate | **B65** | S2 - M | `DONE` |
| H9.4 | ACL-gate the two routes that decide who may write but write nothing: lock acquire and reclaim | **B63**, **B64** | S2 - M | `DONE` |
| H9.4b | Agent identity separate from credential: `agent:<name>` is the principal, a code authenticates as it -- revoking or rotating a code must not orphan what the agent owns | -- | S2 - M | `DONE` |
| H9.4c | A grant may name an OWNER, not only a diagram -- lifts the collection-scope deferral, which agent-created diagrams made untenable. Unblocked: H9.4d landed the grant surface this extends | -- | S2 - M | `DONE` |
| H9.4d | Grant administration on the IAP surface -- an owner can grant and revoke, which nothing in the deployed system can do today; prerequisite for H9.4c, which would otherwise add a second unreachable API | **B90** | S2 - M | `DONE` |
| H9.5 | Connection codes: mint, hash at rest, show once, optional expiry, rotate, revoke -- a credential FOR an agent identity, not a principal | **B99** | S3 - L | `DONE` |
| H9.6 | `/connect/v1` outside IAP, bearer-authenticated, REST only -- a rewrite to one surface, not a second API | **B61** | S2 - M | `DONE` |
| H9.7 | The `/connect` prefix is rewritten once and never read again -- the scanner's premise dissolved when one surface replaced two, so the property held is that the door is never a privilege | -- | S2 - S | `DONE` |
| H9.24 | `scan-board` misses every lettered item (`H9.2a`, `H9.4b`, ...) -- 9 rows, 7 of them DONE, all in H9, exempt from R1/R3/R5/R6; and the summary calls a citing-row subset "items" | **B92** | S2 - S | ``DONE` |
| H9.25 | Authorization becomes its own switch, not a shadow of `IAP_AUDIENCE` -- the boot guard demands an identity source rather than an IAP audience, and `identity.mjs` stays the only module that has heard of Google | **B93** | S2 - M | `DONE` |
| H9.27 | The REST surface becomes `docs/spec/API.md` -- it answers a different reader than the README, and GR10 now reads it there | **B97** | S1 - S | `DONE` |
| H9.26 | GR10 derives REST routes from one path position, so a whole top-level family landed undocumented with the gate green -- widened to any position | **B96** | S1 - S | `DONE` |
| H9.28 | Origin policy: the websocket upgrade is refused from an origin we do not know, and CORS stops answering `*` -- a cross-site upgrade carries the victim's cookie and CORS does not gate one | **B33** | S2 - M | `DONE` |
| H9.29 | Mint and copy a connection code from the access panel -- H9.5 shipped the surface with no UI, so "shown once" had nowhere to be shown and the only way to get a code was to craft a request | -- | S2 - S | `DONE` |
| H9.36 | A watching browser silently discards every remote change -- the staleness guard reads a version advanced two lines earlier, so live collaboration has never worked | **B106** | S3 - M | `DONE` |
| H9.37 | The convergence harness reimplements the client's change rule rather than calling it, and its copy is the correct one -- GR6 passes over code that does not run | **B107** | S3 - M | `DONE` |
| H9.35 | An agent cannot direct or invite a human's view, so its work is unobservable -- the other half of H9.30, and what agent-PLUS-human actually requires. Needs a ruling: push, invite, or follow-mode | **B105** | S3 - M | `DONE` |
| H9.30 | An agent-created diagram is invisible to the human who authorised the agent -- ACCESS.md's reciprocity requirement, of which only the human-to-agent half was built. Needs a ruling on shape | **B100** | S3 - M | `DONE` |
| H9.31 | An agent cannot fetch the render of what it drew -- `/d/<id>.svg` sits outside `/connect` | **B101** | S2 - S | `DONE` |
| H9.32 | The lock read never reports the lock's own expiry, so an agent that loses its token waits blind | **B102** | S2 - S | `DONE` |
| H9.33 | A rejected commit drops the failing op index the server already computed | **B103** | S1 - S | `DONE` |
| H9.34 | API.md never states the entity id grammar it enforces | **B104** | S1 - S | `DONE` |
| H9.23 | `scan-dead` says "every export" but reads only module exports, so an uncalled method of an exported class passes -- widened to public methods of exported classes, under a DIFFERENT rule from exports, with the scope stated | **B91** | S2 - S | `DONE` |
| H9.21 | An agent may create a diagram and owns it -- `POST /api/v1/diagrams` follows from the agent-first ruling; `DELETE` does not and stays open as B32 | **B32** | S3 - M | `DONE` |
| H9.22 | Long-poll: `history?since=&wait=` -- the response COMPLETES, which is why it fits a harness that shells out where SSE does not. Additive; the agent surface does not depend on it | feature | S4 - M | `DONE` |
| H9.8 | Domain allowlist in the app, composed into the authentication boundary so it runs before any grant lookup -- IAM cannot name a consumer domain | **B66** | S2 - S | `DONE` |
| H9.9 | Examples become templates; first write forks a per-owner copy -- reverses the first-boot seed, amended in `SCOPE.md`. Four exported from live, `template` in the id grammar, fork on write and on taking the write slot | feature | S3 - L | `DONE` |
| H9.10 | Decide the fate of the 12 unowned diagrams in `gs://diagrams.apnex.io` -- adopt or delete, explicitly. Recorded as 11 until the bucket was counted at cutover | -- | S3 - S | `DONE` |
| H9.12 | Gate reads: `hello`, `open`, `store.first`, the REST document and log, and the SVG rendering -- writes were gated, reads never were | **B67** | S2 - M | `DONE` |
| H9.13 | Name every identity refusal, once per reason, so a misconfiguration announces itself instead of presenting as a uniform denial | **B68**, **B69** | S2 - S | `DONE` |
| H9.14 | Pass the audience `server.js` switches authorization on with, and refuse to start when authz has no identity source | **B70** | S2 - S | `DONE` |
| H9.15 | Cutover: enable authorization on the live service -- build, deploy image with `IAP_AUDIENCE` and `OWNER` together, adopt the 12, verify the owner reaches them through IAP | **B67**, **B70** | S1 - M | `DONE` |
| H9.16 | Scanner: what `server.js` passes must match what `createApp` destructures -- the composition root is unscanned, and the worst defect of the cutover lived there | **B70** | S2 - S | `DONE` |
| H9.17 | Turn `authz` off-by-default into on-by-default, or delete the switch -- a flag that is on in the only deployment that exists is a second code path nobody runs. **B116 and B115 both shipped through this gap.** Ruled 2026-08-26: default on, switch retained; the work and its findings are H11.8 | **B129** | S3 - S | `DONE` |
| H9.18 | Scanner: every item declares a state, and a heading agrees with the states beneath it in both directions | **B77** | S2 - S | `DONE` |
| H9.20 | Scanner: a stated count must not contradict one the repo can compute -- deferred from H9.18, needs the convention decided before it is enforceable | **B77** | S3 - M | `DONE` |
| H9.19 | `scan-board` matched milestones as `H\d`, so H10 and every item under it were silently unenforced while the gate said PASS | **B78** | S1 - S | `DONE` |

---

## H10 -- client surface and observability - `WIP`

The half of the system a person actually touches, and the half with no verifier behind it.\
Every item here was found by using the application rather than by running the gate, which is itself the argument for the observability items ranking above the cosmetic ones.

| # | Item | Cites | Size | State |
|---|---|---|---|---|
| H10.1 | Defer an inbound `snapshot` under a live gesture, as D12 already does for `change` -- it silently deleted work in progress | **B71** | S2 - M | `DONE` |
| H10.2 | The client is told which principal it is; one field on `snapshotBody`, not an email | **B76** | S2 - S | `DONE` |
| H10.3 | A durable status surface for the last server event, right-aligned in `#status` -- errors currently survive until the next message | **B74** | S2 - M | `DONE` |
| H10.4 | A routed link may duplicate an existing pair; a straight duplicate still refuses, because it would render invisibly | **B72** | S3 - S | `DONE` |
| H10.9 | One straight link per pair, permitted alongside any number of routed ones -- H10.4 keyed the refusal on any link, so drawing order decided what was reachable | **B80** | S2 - S | `DONE` |
| H10.10 | The rule becomes a document invariant in a sovereign validator, and the waypoint cascade deletes a link it would leave colliding | **B81** | S2 - M | `DONE` |
| H10.11 | Resolve straight-link capacity from a node-kind config property, settable at runtime by operator or API -- the seam exists, the configuration does not | **B126** | S4 - L | `DONE` |
| H10.12 | "No entity is in two groups" becomes an invariant -- it was enforced on `put` only, so a `set` produced a document the client and server read differently | **B82** | S1 - M | `DONE` |
| H10.13 | Document invariants get the surface the log invariant already has: checked at load and creation, counted, reported through `/health` -- never a refusal | **B83** | S2 - S | `DONE` |
| H10.14 | Export `isStraight` and `pairKey` so the rule's vocabulary lives where the rule does | **B84** | S2 - S | `DONE` |
| H10.18 | A `del` entry with no entity threw in the browser and shipped -- every builder branch now converts through the real `Changes` | **B87** | S1 - S | `DONE` |
| H10.19 | `scan-writers` checks that no entry carries a forbidden key and not that it carries a required one -- the asymmetry that turned a correct rejection into a broken fix | **B125** | S2 - S | `DONE` |
| H10.22 | A revoked peer's open tab still believes it may write until it reconnects -- a contentless signal that prompts each session to refresh its own snapshot, NOT a broadcast grant map, which would put a second copy of the predicate in the browser | **B94** | S3 - M | `DONE` |
| H10.21 | Two specs asserted facts the code contradicted -- the SVG route's authentication and H9.3's existence -- corrected with dated amendments | **B89** | S2 - S | `DONE` |
| H10.15 | A group holds at least two distinct members, enforced server-side | **B85** | S3 - S | `DONE` |
| H10.16 | Collapse the four referential rules written twice inside `validate.js` into the invariants module | **B83** | S3 - L | `DONE` |
| H10.17 | Share the constants restated across files -- `MAX_COLLECTION`, `OPTIONAL`, `SELECTABLE`, the name and URL caps | **B86** | S4 - M | `DONE` |
| H10.7 | Parallel connections between two containers, count bounded by the column span -- designed and walked in `design/walk/FINDINGS.md`, never implemented | **B127** | S4 - L | `TODO` |
| H10.8 | Restore the connection-walk apparatus, or correct the record that calls it historical while it governs live decisions | **B79** | S3 - M | `TODO` |
| H10.5 | Suppress the browser context menu outside form fields, not on the canvas alone | **B75** | S3 - S | `DONE` |
| H10.25 | A rejected commit is spliced from the outbox in memory and left in localStorage, so a command the server can never accept replays on every reload -- observed as the same entity id refused twelve times | **B148** | S1 - S | `DONE` |
| H10.26 | The header's right cluster shifts on every edit and pops in and out. Fixed widths in `ch`, resting states, the email boxed, and the banner given the slack so nothing can push the cluster | **B155** | S3 - S | `DONE` |
| H10.27 | The header's eleven controls are four different heights because none is declared. One `--control-h`, applied to every child | **B156** | S4 - S | `DONE` |
| H10.28 | The four single-glyph header buttons are sized by their glyph's advance, two of them non-ASCII, so they are neither square nor equal. Width from `--control-h` | **B157** | S4 - S | `DONE` |
| H10.29 | A per-principal diagram quota. The 500 cap is global, so one signed-in stranger can lock out the owner -- and it gates widening sign-in | **B158** | S2 - S | `DONE` |
| H10.30 | Cloud Armor on the agent door, which is deliberately IAP-free. Threshold measured, preview first | **B159** | S2 - M | `TODO` |
| H10.31 | `draw` reads a throttle as a credential problem and gives up on a condition that clears by waiting. Bounded backoff, announced | **B160** | S2 - S | `DONE` |
| H10.32 | A verb targeting with `--diagram` drops a positional id and answers about a different diagram, silently. Refuse an unread positional in the dispatcher | **B161** | S2 - S | `DONE` |
| H10.33 | Deleting a link orphans its `via` waypoints and they still render, so a removed shape leaves debris and holds its anchors. The cascade exists for a node's links and not for a link's bends | **B162** | S3 - S | `DONE` |
| H10.23 | The waypoint leaves the palette: it is a routing anchor, not a glyph node, and listing it as `7` is what made B73 read as a behavioural defect | **B146** | S3 - S | `DONE` |
| H10.24 | `1-6` mid-link-drag places that node and continues the run from it, so a chain of different node types is one gesture | **B147** | S4 - M | `DONE` |
| H10.6 | Reconcile the help text and the keymap on `7` -- neither side was wrong; the waypoint should not have been a palette tile at all, which H10.23 settled | **B73** | S4 - S | `DONE` |
| H10.34 | A rule is chosen by the keystroke and the guards but never by the situation, so context lands as an `if` in a handler body and the help overlay keeps a second, drifted copy of what is legal. `docs/spec/RULES.md` is the design-of-record; three questions are owed a ruling before any code | **B163** | S3 - M | `TODO` |

---

## H11 -- the register, and the shipped path - `WIP`

Opened 2026-08-26 by a full reconciliation of this file against the register, requested after H9 and H10 landed and the plan stopped describing them.\
The reconciliation itself is the finding: the two files had drifted in eleven places, and every check that should have caught it was scoped narrower than its own claim.

| # | Item | Cites | Size | State |
|---|---|---|---|---|
| H11.1 | `scan-board` classified a disposition by a bold-keyword convention the register abandoned at B61, so R2 and R3 were vacuous over 51 of 121 rows -- the whole of H9 and H10 -- while the summary printed a correct row count. Verdicts become a closed set and an unrecognised opener is an ERROR, so the next drift costs one commit instead of an arc | **B122** | S2 - M | `DONE` |
| H11.2 | Reconciliation ran one way: R1 checked that a board item cites a live row and nothing checked that a live row reached the plan. R8 adds the direction, R9 its converse for Held, and Held becomes a list the scanner reads rather than a section a reader recognises | **B123** | S2 - M | `DONE` |
| H11.3 | Three items were follow-on work whose cited row had closed without them, so the register read as settled while the work was unstarted. Each remainder gets its own row rather than reopening a row that correctly closed | **B124** | S3 - S | `DONE` |
| H11.6 | Five rows were malformed markdown tables -- unescaped `\|` in prose and in code spans, a stray backtick for an apostrophe, a trailing empty cell -- so they mis-rendered on GitHub and handed every downstream rule the wrong text. Repaired at the source; R10 counts fields | **B122** | S3 - S | `DONE` |
| H11.7 | Contract rule 1 says every board item cites a row and nothing checks that one exists, so the rule that keeps findings out of a mutable file is decorative. It is also wrong as written -- a feature was never a finding -- so narrow it to defects and enforce that | **B128** | S3 - S | `DONE` |
| H11.8 | `authz` defaults on, so the suite runs the configuration the deployment runs. 152 tests failed on the flip, and the fixture supplies a principal once instead of seventeen times. Found B130 and B131 on the first run | **B129** | S3 - L | `DONE` |
| H11.9 | Deleting a diagram strands every viewer: the survivor is resolved with no principal, so under authorization it is null. Resolve it PER VIEWER, which is what the REST comment already claims happens | **B130** | S2 - S | `DONE` |
| H11.10 | Deleting your last diagram reseeds one nobody can read: the store refuses to be empty and the reseed is unowned, so the invariant is satisfied and its purpose is not. The reseed belongs to the principal who caused it | **B131** | S2 - S | `DONE` |
| H11.11 | `draw health` had never worked in any configuration. The declaration was right and prefix-relative; the SERVER only implemented the root path, and the prover papered over it with a special case for that one entry. `scan-cli` gains the reverse check -- a route a verb declares must exist | **B132** | S3 - M | `DONE` |
| H11.12 | The CLI has no write verb for a zone, group, waypoint, link, span, move or rename, so anything structural goes through `commit --ops` and the agent re-derives cell-to-pixel, the zone half-pitch, id minting and three invariants by hand. B117 in a better disguise | **B133** | S2 - L | `DONE` |
| H11.13 | The tool creates every kind of entity and removes none: `draw rm <ref>` does not exist, so tidying up is still `commit --ops`. The cascade is the interesting half -- the verb should report what else went | **B134** | S3 - M | `DONE` |
| H11.14 | The CLI's lock and context stores read `process.env.HOME` directly, so `main`'s injected env is bypassed and 812 token files accumulated in the developer's real home. Isolation the harness advertises and does not have | **B135** | S2 - M | `DONE` |
| H11.15 | The lock token store never shrinks: 837 credential files, 835 naming deleted diagrams. A token outliving its lock is why the tool reports `not server-locked` when the truth is `your lock lapsed` | **B136** | S2 - M | `DONE` |
| H11.16 | The image ships a broken `draw`: the Dockerfile symlinks it to the retired `cli/draw.sh`, and `ln -s` never checks its target so every build is green. `scan-docrefs` reads docs and not the Dockerfile | **B137** | S3 - S | `DONE` |
| H11.17 | `draw` invoked through a symlink runs nothing and exits 0 -- and a symlink is how both the README and the Dockerfile install it. The entry guard compares the link path to the module URL | **B138** | S2 - S | `DONE` |
| H11.18 | Authoring the reference topology needed eleven departures from the tool -- loops, `python3` over `--json`, a heredoc per panel, a headless browser to see the result. Every verb answers with a table, so an agent cannot LOOK at the canvas it is editing | **B139** | S2 - L | `DONE` |
| H11.19 | A lock cannot be renewed by its holder: `acquire` refuses on any live lock and the 409 says *another controller* even when it is you. A 60-second slot with no renewal blocks progressive authoring outright | **B140** | S2 - M | `DONE` |
| H11.20 | The tool judges lock expiry on the local clock against a server timestamp, so skew makes it bin a live token and then fail to renew -- undoing B140 in the direction that looks like another agent's fault | **B141** | S2 - S | `DONE` |
| H11.21 | The write slot expires on a browser's timer, so it is taken from an agent for pausing to think. Sliding already works; the sixty seconds is a default nobody chose, and `reclaim` -- not the TTL -- is what protects the human | **B142** | S2 - S | `DONE` |
| H11.22 | `zone contents` and `link path` take ids only, and `place` reimplements the name lookup four times without the ambiguity refusal. Resolution is per-verb habit, not a rule | **B143** | S3 - S | `DONE` |
| H11.23 | `about` answers every relation in ids, and prints `undefined` for a group because `links` carries two shapes. The verb built to stop cross-referencing forces it | **B144** | S3 - S | `DONE` |
| H11.24 | A5 Perceptual Parity was satisfied by instinct and never verified: the instruments got built, the delta was never measured, and both existing A5 citations are about the HUMAN's view of a symmetry that has two sides | **B145** | S2 - M | `DONE` |
| H11.25 | The ranked Next slice advertises finished work: four of its ten entries are DONE, and no rule reads the ranking table. R11 made every item row accountable and left the ranking over those rows unchecked | **B149** | S1 - S | `DONE` |
| H11.26 | R12 holds a ranked entry to not being finished and never to existing, so the ranking survived pointing at an item deleted the same commit. Structured data, unambiguous, one branch | **B151** | S1 - S | `DONE` |
| H11.27 | The server emits non-ASCII in agent-facing error strings, so an agent reads a character it cannot type back into a grep or an assertion. Three strings, plus the rule that keeps them out | **B152** | S3 - S | `TODO` |
| H11.28 | `Decisions required` is the last declared list nothing reads, and the one wrong twice. The Held pattern applied to a second section: a `RULING-OWED` verdict and one bidirectional rule | **B153** | S3 - S | `DONE` |
| H11.29 | `COMMIT.md` section 5 claims to list the mechanized guardrails and has no row for `GR14`, which is cited on this board and enforced in the gate | **B154** | S4 - S | `TODO` |
| H11.4 | No check can see a test that reimplements its subject instead of calling it. Narrower than when filed: the parity gate answers it for the renderer, `tests/routes.test.js` for the API, `scan-cli` for the tool. What remains is the general question, and it should be re-scoped before it is built | **B108** | S3 - L | `TODO` |
| H11.5 | A deleted diagram is recoverable and nothing said so. Reached from both surfaces; the seam answers `null` for a backend with NO window, which is not the same fact as an empty one | **B109** | S2 - M | `DONE` |

**Exit:** the plan and the record agree mechanically, in both directions, and a live row cannot be invisible in either file.

---

## H12 -- the programmable engine pilot - `DONE`

Opened 2026-09-01 out of the **B163** survey, `surveys/b163-rules-system-survey.md`, which settled the ambition as a programmable geometric engine and named tower defence the pilot use case that drives the design.\
The director then reduced the pilot to its smallest honest form: **click an endpoint waypoint in read view and it spawns movers along its path, consumed at the far end.**\
That is the creep lifecycle -- spawn, traverse, despawn -- minus combat, and it is the seed of enemies-along-a-path.

**The ordering is the point, and it comes from the survey rather than from taste.**\
The surface is EXTRACTED from what the pilot needed, never designed ahead of it -- A3 *Earned Exposure*, and A3 *Logic Density*, which files premature abstraction as a defect rather than a virtue.

**Director's rule, 2026-09-01: *no premature abstraction, unless the work IS the abstraction*.**\
This corrects an over-application of A3 in the first draft of this milestone, which used *Logic Density* to defer the deliverable itself.\
The discriminator: an abstraction is PREMATURE when it generalises over instances that have not been seen, and it IS THE WORK when the deliverable is a surface something else must be built on.

By that test the simulation, the clock and the **situation** are the work and are built properly here.\
Dispatch is not, and it is deferred on the survey's F3 prior-art prerequisite rather than on A3 -- the shape of a rule surface is owed research the director has not yet authorised.\
So this milestone ships a real situation and exactly ONE rule expressed as a predicate over it, and no table.

**Boundaries, each owning exactly one concern (A3 Law of One).**

| Unit | Owns | Knows nothing about |
|---|---|---|
| `kernel/router.mjs` | the shape of a route -- decomposition, length, sampling | movers, time, the document |
| `engine/movers.mjs` | which movers exist at time `t` and where | the document, the DOM, the clock |
| the situation | what is true right now, as a value | what anyone intends to do about it |
| the clock | one agreed `now()` across peers | movers, geometry |
| the presentation layer | drawing movers | truth -- it reads simulation output and never answers back |

The simulation takes `t` as an argument rather than reaching for a clock, and takes spawner descriptors rather than reading the document.\
Both are Air-Gap: a unit that reaches for what it needs cannot be reasoned about alone.

| # | Item | Cites | Size | State |
|---|---|---|---|---|
| H12.1 | One decomposition of a route into lines and quadratic corners, consumed by BOTH the SVG string and the measurement -- a second copy of the corner rule would be the undeclared twin `scan-twins` exists to catch, and `BEND_R` is 20 on a 40px grid so a consumer walking the raw polyline departs the drawn line by ~8px at every bend | feature | S2 - S | `DONE` |
| H12.2 | The browser's own path measurement as a GATE oracle, not a one-off probe: kernel length and sampling proven against `getTotalLength` / `getPointAtLength` in headless Chrome. Measured at 0.018% and 0.0145px on the probe; the gate is what keeps it true | feature | S2 - S | `DONE` |
| H12.3 | `engine/movers.mjs` -- `moversAt(spawners, t)`, pure, portable, DOM-free. The simulation, and the thing a tower will later query | feature | S3 - S | `DONE` |
| H12.4 | One agreed clock: `serverNow` on the snapshot handshake, client-side offset, so parity does not depend on whose laptop is right | feature | S2 - S | `DONE` |
| H12.5 | `spawn` config on an endpoint waypoint -- document state, undoable, shared. Direction derives from which end was pressed; a closed route has no endpoints and cannot be armed | feature | S2 - S | `DONE` |
| H12.6 | The **situation** as a value: model-level, serialisable, DOM-free, buildable without a browser. The survey made this binding and it survived the rule table's demotion, because it is the read-surface a mod needs before it can decide anything. Built here because the work IS the abstraction, not deferred as scaffolding | feature | S3 - M | `DONE` |
| H12.7 | The pilot rule, expressed as ONE predicate over the situation rather than a branch in a handler body: in read view, a click on an endpoint waypoint toggles spawn. The same click SELECTS in author view -- the situation-conditioned meaning `KEYMAP` cannot currently express, which is **B163** stated as a feature rather than a defect. No dispatch table; the shape of one is owed the F3 prior-art pass | **B163** | S3 - M | `DONE` |
| H12.9 | One vocabulary for a link's ends and its ring flag. `src`/`dst`/`closed` everywhere, including inside `kernel/`, and BOTH translation sites deleted rather than reconciled. Found while building H12.6, where adding a second adapter is what revealed the first | **B166** | S3 - M | `DONE` |
| H12.8 | Presentation via WAAPI `offset-path`, seeded from the agreed clock. Motion only in read view; the spawn config stays visible in every mode, so an author can see that a diagram emits without it moving | feature | S3 - M | `DONE` |

| H12.10 | The pilot's AGENT surface: a verb that mints a waypoint-terminated link, a verb that arms an endpoint, a read verb that reports the fields an entity HAS rather than a fixed list, and `add` refusing a type no glyph exists for. Found by trying to build and then verify this milestone's own fixture through `draw`, and failing at every step in both directions | **B167**, **B168**, **B169** | S3 - M | `DONE` |

| H12.11 | A mover in flight keeps the route it was born on, so moving an endpoint leaves packets on a line the diagram no longer draws. The presentation caches geometry the simulation has already updated | **B171** | S3 - S | `DONE` |

| H12.12 | A spawner refers to a centralised look rather than copying one, and its speed is in the grid's unit. `kind` resolves to a stylesheet class, so one edit reaches spawners that already exist; `speed` is cells per second, converted to pixels once at the simulation boundary. Old documents are migrated on read, because the validator is strict and a refused document is SKIPPED rather than reported | **B172** | S3 - M | `DONE` |

| H12.13 | One spawner could exhaust the mover budget and starve every spawner after it -- the cap was named per-spawner and enforced globally, so a second armed endpoint silently never emitted | **B173** | S3 - S | `DONE` |

| H12.14 | The document-to-spawner adapter moves to `engine/`, and `draw movers` reports what is in flight. A client-side report was uninvestigable because the only code that could answer lived in a browser tab | **B174** | S2 - M | `DONE` |

| H12.15 | Segment length uses an exactly-specified `sqrt` rather than the implementation-approximated `Math.hypot`, so every engine computes the same mover position. A prerequisite for derived combat, where a disagreement is folded forward instead of recomputed away | **B176** | S2 - S | `DONE` |

**Exit:** an endpoint armed in read view spawns movers that ride the drawn line and are consumed at the far end, two browsers agree on where they are, and the simulation can answer where any mover is without touching a DOM.\
**The abstraction bar, which is the harder half of the exit:** the pilot's rule reads a situation it did not build, and the simulation answers a question no browser was involved in -- so both are already the surface a mod would use, rather than something to be generalised afterwards.

**Why this pilot cannot desync, and when that stops being true.**\
The director noted the resemblance to OpenTTD -- distributed simulation with seed and hash validation to catch desyncs -- and the comparison is right about the class of system and not yet about this one.\
Lockstep simulations desync because their state ACCUMULATES: tick `n+1` is computed from tick `n`, so a one-ULP divergence compounds without bound, which is why OpenTTD and Factorio use fixed-point arithmetic and exchange periodic state hashes.\
A mover here accumulates nothing -- it is a closed form of `t` -- so a float discrepancy affects one frame and is gone the next, and the two inputs are the document and the clock, both of which come from the server rather than from each peer's own reckoning.\
That is why parity needed no protocol: there is nothing for two peers to independently derive.

**The deviation tier changes this, and the cost should be known before it is chosen.**\
The moment a mover can be damaged or slowed, its state accumulates and every lockstep problem arrives together: ordering of events across peers, and the free use of floating point that is harmless today becoming the reason two clients disagree.\
The options at that point are the ones those games already found -- make the server authoritative over deviations and broadcast them, or make the simulation bit-exact and hash-check it.\
A hash built now would detect nothing, so building one would be mechanism against an unmeasured problem (**A11**); what is worth keeping is that `moversAt` already returns plain values, so it is hashable the day that changes.

**Not in this milestone:** mutable per-mover state, towers, range queries, waves, combat.\
The sparse-overlay design for deviating movers is named in the survey and is not built here.\
An undeviated mover is a closed form, so this pilot needs no reconciliation at all.

---

## H13 -- the deviation tier - `WIP`

Opened 2026-09-02.\
H12 closed as a pilot that deliberately excluded combat, on the reasoning that an undeviated mover is a closed form of `t` and therefore cannot desync.\
This milestone spends that property knowingly: the moment a creep can be damaged its state ACCUMULATES, and every lockstep problem H12 avoided arrives at once.

**What buys it back is that only the non-derivable travels.**\
A player placing a tower is intent, and rides the document machinery that already orders and broadcasts it.\
A tower firing is not intent -- it is implied by the board and the clock, so a peer told about it is being told what it could have worked out.\
That is the level-triggered shape, chosen against prior art rather than by taste: an event-handler surface needs every peer to receive every event in order, which is precisely what obliges those games into lockstep with hash exchange and a resync path.

**Director rulings, 2026-09-02.**\
Towers are automatic and are `loadbalancer` nodes placed during read/play.\
Firing is derived; a tower burns the leading creep in range -- furthest in the direction of travel, the one about to escape.\
The weapon is a LASER, and the reason is mechanical rather than cosmetic: a beam connects instantaneously, so there is no projectile in flight and no lead to predict.\
Synchronised fire between towers is acceptable, which is what lets the schedule come from the clock rather than a per-tower hash.\
Level and game remain the same object for now, with three costs accepted and a revival trigger.

| # | Item | Cites | Size | State |
|---|---|---|---|---|
| H13.1 | The derivation surface: a kind declares its own game data, and a rule is a pure function of `(world, tick)` returning facts. A tower fires because the board and the clock imply it, so only tower placement travels and a third client recomputes rather than being told | `feature` | S3 - M | `DONE` |
| H13.3 | A player places a tower during play, and the laser is drawn. Placement is the only thing that travels; the beam is derived by every peer from the board and the clock | `feature` | S2 - M | `DONE` |
| H13.6 | A clock stamp is consumed by the snapshot it belongs to, so a peer's offset cannot absorb the age of its own tab. Two viewers of one diagram saw a route full of packets and no packets at all, from the same document | **B177** | S2 - S | `DONE` |
| H13.2 | A tower rotates to face what it is burning. Deferred from H13.1 by ruling, and it is presentation only -- the angle is derived from two positions the fold already knows, so nothing is stored and no peer needs telling | `feature` | S1 - S | `TODO` |

**Exit:** a player places a tower during play, it burns creeps that come into range, and two browsers watching the same diagram agree on which creeps died without exchanging anything but the placement.

**Not in this milestone:** waves, scoring, lives, separated in-game authoring, the deviation memo.\
The memo is a checkpoint so folding starts from the last clean point; it is an optimisation and is not needed until the fold is measurably slow.

---

## Held -- on the record, not on the board

Open `BACKLOG` rows whose trigger has not fired.\
Scored so the comparison is a judgement, not an omission.\
**This list is now read by `scan-board`** (R8/R9), so an entry is a declaration rather than a paragraph a reader recognises: a live row must be here or be an item, and a settled row must not be here at all.

| Row | Sev | Held item | Revival trigger |
|---|---|---|---|
| **B7** | **S2** | Preview writes to the shared Model (the *fix*; the *mitigation* is H3.2) | the renderer-overlay arc (N7) |
| **B10** | **S2** | Put-based inverse loses intra-kind ordering -> stacking can swap across delete+undo | a user reports it, or explicit z-order becomes a feature |
| **B27** | S4 | Bounds validated per field, never per derived extent | a document renders off-surface, or the first non-browser authoring client |
| **B33** | S3 | The residue after H9.28: authentication and read-gating exist, the row's remaining half does not | stated in the row; part-closed, not open |
| **B164** | S3 | A gate test races its own teardown, so a sound commit is occasionally refused on a socket error | a SECOND flake appears, or this one fails twice in a week -- either makes it a habit rather than an incident, and a gate dismissed by habit has stopped being a gate |
| **B175** | S3 | A second armed endpoint appeared not to animate in one tab; resolved with no change and no cause found | a SECOND report of an armed endpoint not animating, or this one recurring -- `draw movers --at <t>` now bisects it in one command |
| **B170** | S3 | A synthetic input event fails silently, so a test that simulates a gesture proves nothing and still passes | a THIRD place loses a round to it, or a new test dispatches a synthetic event -- the moment a rule would have paid for itself |
| **B165** | S3 | `SCOPE.md`'s entity block describes the MVP's four kinds and denies waypoints and routing, both of which shipped | the next entity field lands, or an agent is observed acting on the stale block -- and the real fix is a rule that reads the block, since prose no check consults is where this drifts again |
| **B88** | S3 | Prose can assert that finished work is blocked, and no rule reads a sentence | a second blocked entry appears on the board, or any `Decisions required` entry returns |

**Cleared 2026-08-26**, because the trigger fired and was answered, or the ruling landed:

| Row | Was held on | What settled it |
|---|---|---|
| **B6** | no `fsync` anywhere | **CLOSED H8.2.** The trigger was *any GCS-backed deployment*, and that is now the only deployment. Compare-and-swap on `ifGenerationMatch` replaces the guarantee `fsync` was standing in for |
| **B9** | no durable accountability record beyond the ring | **RULED CS2/CS3.** The ring stays bounded, attribution is scoped to it by `actor`, and the absence beyond it is a declared non-goal rather than a deferral |
| **B32** | REST cannot create or delete a diagram | **RULED 2026-08-23**, and both verbs shipped. `DELETE` is gated on write access, not ownership -- the same gate `store.remove` already applied to the websocket -- and answers 423 while another controller holds the lock, except to the holder |

**B6 was the uncomfortable one** and it is worth recording how it resolved, because the reasoning was not that the risk went away.\
It was `S1` and held, defensible only while X2 recorded the deviation and N5 stated the guarantee at exactly the strength the code made.\
The deployment that fired its trigger is also the one that answered it: object storage with a generation precondition is a stronger primitive than the local `write`+`rename` the row was written against, so the arc closed the row by moving underneath it.

---

## Decisions required

**One.**\
Wrong twice before, and now checked rather than trusted.

| Row | Decision owed | Why it cannot be settled without you |
|---|---|---|
| **B163** | Ratify the survey envelope `surveys/b163-rules-system-survey.md`, which captured intent on 2026-09-01 and superseded part of `docs/spec/RULES.md`. Three sub-rulings are owed: confirm or amend the five outcome axes (flag F7 -- they were proposer-drafted and never corrected); rule on flag F2, whether the B163 defect is split from the platform surface and fixed ahead of it; and authorise the prerequisite prior-art pass in flag F3 | The three original mechanism questions no longer need a ruling -- the ambition answer derived them. What remains cannot be derived. The axes are the director's goals framework and every axis mapping in the envelope rests on them, so if one is wrong the interpretations need re-reading rather than re-labelling. F2 decides whether a live defect waits on a platform design. F3 decides whether the surface may be chosen at all, since the director's own instruction was not to assume the shape |

**R13 reads this table in both directions**, which is what `Held` has had since B123 and this section never did.\
A row recording `RULING-OWED` must appear here, so a decision cannot wait unseen; an entry here must still be `RULING-OWED`, so a ruling that has landed cannot keep asserting itself.\
Those are the two ways this section has actually failed.\
Zero entries is a legitimate answer and stays cheap to say -- the floor is that the SECTION exists, not that it has rows.

**B150 was ruled on 2026-08-27 and split.**\
The ruling-owed half became **B153**, built the same day.\
The `Blocks` field half was folded into **B88**'s held scope: its population is one blocked item against 159 rows, and B88's trigger already fires when a second appears.

**B88 is deferred, not closed**, and the measurement is the reason.\
Its tractable form reads *blocks Hn.m* as a fixed phrase.\
Against this board that phrase matches ZERO live claims: the one real blocking claim is at the `blocked` tier of the Next slice, *H10.7 is blocked in practice on H10.8*, where the item precedes the verb and the blocker follows *on*.\
The rule would have caught the 2026-08-21 phrasing (`**Blocks H5.3**`, verbatim) and misses the phrasing this file has since moved to.

A widened pattern matches one claim, *Unblocked: H9.4*, which is correct.\
A third candidate -- every `Hn.m` in prose resolving to a real item -- has one hit in 205 mentions, and it is a false positive.

**The finding is worth more than the rule was.**\
Every `scan-board` rule that finds anything reads STRUCTURE: a column, a state token, a table row.\
R12 found five stale entries the same morning.\
The candidates with a population of zero are the ones that read English, and adding them would have been the H9.20 mistake committed in the act of closing it.

This section is still maintained by hand and still worth reading with suspicion.\
What changed is that the thing it now asserts is a ruling owed, which is a claim someone can act on.

### Resolved, and by what

| Was | Answered by |
|---|---|
| **REST diagram lifecycle (B32)** | Ruled 2026-08-23. Two rulings, not one: `POST` follows from agent-first authoring; `DELETE` inherits X12's reasoning that a destructive verb keeps its gates, and is acceptable because `gs://diagrams.apnex.io` carries a 604800s soft-delete window -- which is itself unreachable from the product, and is B109 |
| **`schema.js` (B28)** | Answered by fact rather than by ruling. `docToSchema` -> `kernel.resolve()` IS a production path: `server/svg.mjs:17` renders every `/d/<id>.svg` through it. It is the EXPORT authority, not the client's, and the clone the decision was really about is gone |
| **GR5's second half (B22)** | Retired, not built (**X15**). A differential needs two implementations and client-side inverse building has zero |
| **CI (B21)** | It exists. `.github/workflows/gate.yml` runs `npm run gate` on push and PR. The claim that a fresh clone had neither was true when written and false since H7 |

---

## Not in this arc

Deliberately excluded so the arc has an edge.\
**Each now carries a durable marker** -- the axiom review found all three were deferred in this file only, and this file is mutable, so clearing the board would have erased them (A14 *Insight Depreciation*; a breach of BACKLOG's own "Adding a row" contract):

- **Refactoring `input.js` and its four oversized functions** (`onKeyDown` **224** lines, `onUp` **169**,
  `onDown` **162**, `onMove` **101**) -- now **B35**, trigger: *B23's harness is green*. They are the natural
  target *after* H2 gives them coverage, never before. A refactor without a net is how B14 happened.
- **Performance** -- the five known costs -- now **B36**, trigger: *a measured frame drop*. All sub-threshold
  today and none measured; measure before optimising.
- **Any geometry work.** Deliberately **not** given a B row: `docs/spec/HIERARCHY.md` section 0/section 7 and
  `design/walk/FINDINGS.md` are already its durable record, and a duplicate would be ceremony, not
  zero-loss. `HIERARCHY.md` is explicit that connections are the open frontier and containment
  is locked; the GRC walk has two surviving variants at rung 8 of 11, and `ATOMICS.md` still has the
  +/-29-vs-+/-30 container-edge handle open. **That is a design arc, not a hardening arc.** It starts clean once
  this board is empty.
