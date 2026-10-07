# Sync hardening after the cutover -- H19.5 (DELTA, proposed)

> **Tier 3 -- a plan of record, proposed.** Written 2026-10-07 against `5387bb5`.
> Facts are measured and cited; a number carried from an earlier measurement says when it was taken; judgements are marked.
> Proposes; decides nothing. Section 9 says which decisions come after the first measurement, and why not before.
> AMENDED 2026-10-07: approved by the director, as proposed.

## 1. Status

- **Asked for:** the director, 2026-10-07, approving the re-triage after the cutover in its recommended order -- the sync hardening production now depends on, second (`dev/BOARD.md` H19).
- **Is:** board item H19.5, which plans B247 -- the convergence test (GR6) extended to routes, cuts, the preview's correction and undo, under disconnect and reorder -- with B251 to B254 and B295 judged against it.
- **Why now:** production composes the network since the cutover, and its sync path carries what the lab never did: pipes, routes, transit's cuts and joins, the planner's preview, undo from the server, several writers, and reconnects.

---

## 2. From-state -> to-state

**From** (measured at `5387bb5` unless dated):
- **GR6 today** (`tests/convergence.test.js`) drives two tabs and a server through 200 seeded edits: node create and move, a straight link, a group, a delete; and three faults -- a dropped change, a change under a live drag, a writer disconnecting. No pipe, route, pin, transit edit, cut, join, undo, redo, reconnect, reorder or preview is in it.
- **A broader instrument exists, out of the repository:** the fuzz built for the lab's K1 pass, kept in the private lab-design archive, runs the real Model, Changes, Sync, Store, Session and Hub with undo, redo, drags, reconnects, flushes and a second writer. It predates the cutover and does not run today: its seed is refused, "unknown kind: waypoint" (measured).
- **Open defects, last measured by that fuzz on 2026-09-28, before the cutover and before B294 changed how undo and redo wait** -- so each is INFERRED to persist until re-measured:

| row | what | last measured |
|---|---|---|
| B251 | after a reconnect, a request whose answer was lost is re-applied on a document that holds it; ruled 2026-09-28: re-fetch on a `replayed` answer, not yet built | 3 divergences and 16 replay breaks in 300 runs, all with reconnects |
| B252 | snapshot storms push outbox entries past the replay limit, answered ones included; the user is told changes "could not be delivered" | 1,898 give-ups in the undo-heavy runs |
| B253 | two tabs of one origin share one outbox key | 2 divergences in 150 two-tab runs |
| B254 | the answer to the tab's own undo can land mid-drag | 1 snapback in 300 runs |
| B295 | after a resync, an undo or redo already answered is re-sent and refused | measured 2026-10-05 in a unit test; harmless, a second refusal |

**To:**
- **The extended GR6 is in the repository and in the gate:** the fuzz ported to today's composition, its tabs composed as the product page composes them, its edits including the network's.
- **Every open sync defect re-measured on it,** and each fixed with a test that fails without the fix, or held with its measured rate and a revival trigger.

---

## 3. The fence

The fuzz, ported and extended; its oracle; the gate's bounded run; the fixes the measurement calls for, B251, B252, B253 and B295 among them; B254 if the measurement shows it reachable.

---

## 4. The anti-scope fence

- **No change to the protocol's shape** except what a ruled fix needs (B251's re-fetch is one).
- **No multi-instance server.** Production runs one instance (B178 holds the many-instance case).
- **No new behaviour a user would notice** beyond what a fix restores: a change not lost, a refusal not spurious.

---

## 5. Findings that shape the plan

### 5.1 Measure before ruling

Every number in section 2 is from code that has since changed: the cutover, the planner's preview in the page (V-d), and undo and redo waiting for the answer ahead of them (B294).\
B294 in particular may have changed B252's storm, which was made of answered undo and redo requests re-sent at each snapshot.\
So the plan measures first and rules after (M7 step 1).

### 5.2 The oracle must not read the code under test

The K1 fuzz kept its own copy of how an entry becomes an op, so a defect in the code under test could not hide in the oracle.\
The port keeps that separation, and adds the network's own checks: at quiescence every tab equals the server, the server's document is valid, and every link's route on each tab equals the server's.

---

## 6. Build order -- each stage provable before the next depends on it

| stage | what lands | proven by |
|---|---|---|
| **U-a** | **The fuzz in the repository:** its world as a test fixture and its runner as a test, ported to schema 2; tabs composed as the page composes them -- the network, and the planner's preview; edits extended to pinned links, hand pipes laid and removed, transit turned off and on, a link landing on a bend, and undo and redo | a seeded run reproduces exactly from its seed; a planted divergence in one tab is reported, naming the entity; a planted bad op in the server is reported invalid |
| **U-b** | **The measurement:** runs per profile -- reconnects, undo-heavy, two tabs on one storage, drags -- each failure classified to a backlog row or a new one | a table per row: its rate now beside its rate on 2026-09-28; each new failure registered with its seed |
| **U-c** | **Replay after reconnect and resync:** B251 as ruled, re-fetching on a `replayed` answer; B295, an answered verb not re-sent | each failing on the code before it, by seed and by unit test; mutants killed; the U-b profile re-run |
| **U-d** | **What U-b finds of B252, B253 and B254:** each fixed, or held with its rate -- the two decisions of section 9 asked here, if still needed | as U-c |
| **U-e** | **Closed:** a bounded fuzz in the gate, its cost measured; B247 closed | the gate; the lab and production deployed |

---

## 7. Invariants and acceptance tests

**Invariants** -- at quiescence, after every seeded run:
1. Every tab's document equals the server's, entity by entity.
2. The server's document is valid.
3. Every link's route and down state on each tab equals the server's.
4. No change a tab committed is lost without the tab saying so.

**Acceptance tests:**
1. The fuzz runs in the gate, a bounded seeded set, and any failure prints the seed that replays it.
2. Each of B251, B252, B253, B254 and B295 is closed with a test, or held with its measured rate and a revival trigger.
3. A planted divergence, a planted invalid op and a planted lost change are each reported by the oracle.

---

## 8. Coverage, verification, costs

**Proves:** B247; the open sync defects measured on the code production runs.\
**Defers:** many server instances (B178).

**Named costs and non-claims (judgement):**
- **The gate grows** by the bounded fuzz; U-e measures it, and the bound is set to keep the gate's time reasonable.
- **A fuzz finds what its edits reach:** the port names the edits it drives, and an edit it does not drive is not covered.
- **It is not chaos against the real socket:** the transport is faked in the page, as GR6 fakes it, so failures in the network stack itself are out of reach (A9, named).

---

## 9. Decisions for the director

**None before measuring.**\
Two may be needed at U-d, each only if U-b shows its row still reproduces:
- **U1 -- the outbox's scope (B253).** One per tab, which a closed tab's unsent work does not survive; or one per tab with a closed tab's work adopted by the next tab opened -- D30 made unsent work survive a closed tab.
- **U2 -- what a snapshot storm gives up (B252).** Whether an answered request may be dropped from the outbox at a snapshot rather than counted toward the replay limit.

---

## 10. Axiom alignment audit (M7)

| axiom | weight | how the plan holds it |
|---|---|---|
| A7 Resilient Agentic Operations | load-bearing | a change is not lost on a reconnect or a storm, and a failure prints the seed that replays it |
| A8 Gated Recursive Integrity | load-bearing | the fuzz in the gate holds every later change to convergence; each stage proven before the next |
| A9 Chaos-Validated Deployment | load-bearing, with a named limit | disconnect, reorder, drops and storms injected at the transport the page sees; the socket itself is out of reach (section 8) |
| A1, A5 State transparency, perceptual parity | supporting | invariant 3: every tab sees the server's routes; invariant 4: a lost change is said |
| A13 Director Intent Amplification | supporting | no decision asked before measurement can inform it |
| A2-A4, A6, A10-A12, A14 | not materially implicated | |

**Verdict: pass-with-guardrails** -- measure before ruling; the oracle never reads the code under test; the gate's cost measured at U-e.

AMENDED 2026-10-07 -- **U-a done** (H19.13).
**In the repository:** the K1 fuzz's world (`tests/fixtures/sync-world.mjs`) and runner (`tests/fixtures/sync-fuzz.mjs`), ported to schema 2; each tab composed as the page composes it, the network drawing and the planner previewing every commit; the network's edits added -- a hand pipe laid and removed, transit flipped, a link landing on a bend -- beside the ones it had.\
**Its oracles:** the quiescent ones -- every tab equal to the server, the server's document valid, every tab drawing what the server draws, nothing a tab committed left unanswered -- each shown to report its fault, planted, and each killed as a mutant; the strict one replays a tab's unanswered requests through the planner onto the server's document, since the page applies a request as its plan.\
**A run replays exactly from its seed:** ids and transaction prefixes are drawn from `Math.random`, pinned per run as the gesture corpus pins it.\
**First measurement, 30 runs** (INFERRED representative until U-b runs the profiles): no tab ended apart from the server, no invalid document, no route drawn otherwise, nothing left unanswered; one change given up as undeliverable (B252's symptom); and transient strict-oracle mismatches in 26 runs, which U-b classifies -- some may be the oracle re-planning on a newer document than the tab's preview saw.
**In the gate now:** 20 seeded runs held to the quiescent oracles, about 2.6 seconds.

AMENDED 2026-10-07 -- **U-b done** (H19.14): the measurement, 300 seeded runs of 160 steps per profile, at `db36a2e`.

| profile | runs a tab ended apart from the server | changes given up | other |
|---|---|---|---|
| default | 2 | 208 | 1 run with a change unanswered |
| undo-heavy (undo weight 12) | 3 | 843 | 10 runs with changes unanswered; 1 snapback of a tab's own undo mid-drag |
| two tabs on one storage | 24 | 941 | |
| no reconnects | 6 | 175 | |
| no reconnects, no undo | 26 | 101 | |
| no reconnects, no undo, none of the network's edits | 18 | 65 | |

**Classified, each with seeds that replay it:**
- **B304, new and the largest in ordinary use:** a tab previews an edit's consequences on its own document -- a delete's cascade, a join, a cut -- and when another writer's edit reaches the server first, the server plans the request on a different document and answers otherwise; nothing undoes the preview's unconfirmed part. Seed 7 traced: one tab deletes waypoint `w2`, its preview taking the three links ending there; the other re-plugs one of them away first; the server deletes two, and the first tab has lost the third for good. It needs no reconnect, no undo and none of the network's edits (18 runs of 300 with only the product's edits); seed 38 is the same shape through a cut's derived piece.
- **B253, worse than measured on 2026-09-28:** two tabs on one origin's storage diverge in 24 runs of 300, where they had in 2 of 150.
- **B252:** 208 changes given up in the default profile, 843 undo-heavy (1,898 on 2026-09-28, before B294); undo-heavy leaves a tab with changes unanswered in 10 runs.
- **B251:** 6 replay breaks after a reconnect in 300 runs, each healed by quiescence; no divergence at quiescence attributable to it apart from B304.
- **B254:** one snapback of a tab's own undo mid-drag in 300 undo-heavy runs, as on 2026-09-28.
- **B295:** not counted by the fuzz; its unit test stands.

**So the order changes:** B304 first, since every profile shows it and two people editing one diagram reach it; then B253, whose decision (U1) is now needed; then B252 (U2), B251 and B295 as planned.

AMENDED 2026-10-07 -- **U-c done** (H19.15): B304 ruled re-fetch and built; B251 built as ruled; B295 fixed; and three refinements the measurement showed the re-fetches needed.

**What changed in `app/src/sync.js`:**
- **B304:** an answer that does not confirm every op the tab derived for its request -- a no-op answer included -- asks for the document again; an op it asked for that the server found already so proves nothing (`unconfirmedPreviewOps`, beside `derivedToApply` in `app/src/changes.js`).
- **B251:** a `replayed` answer to a request the tab did not know had landed asks for the document again.
- **B295:** an answered request is never sent again, at a snapshot or by the drain, and counts as sent, so it is pruned once durable.
- **Tries count attempts:** B183's limit counts a request sent since the last snapshot and not answered; one held unsent behind a waiting undo (B294) is not counted.
- **One re-fetch at a time:** a re-fetch already asked for is not asked again until its snapshot comes or the socket drops.

**Why the refinements, measured step by step on 300 seeds each:** the re-fetch alone took divergence from 18 runs to 0 with ordinary edits, but doubled the changes given up, since every snapshot counted a try against every unanswered request; B295 and counting attempts took STUCK to 0 and the give-ups below baseline; asking one re-fetch at a time took them to 0.

**Measured after, 600 seeded runs per profile at the committed code:**

| profile | runs diverged (U-b, of 300) | runs diverged (now, of 600) | changes given up (U-b, 300 runs) | given up (now, 600 runs) |
|---|---|---|---|---|
| default | 2 | 1 | 208 | 0 |
| undo-heavy | 3 | 0 | 843 | 0 |
| two tabs on one storage | 24 | 0 | 941 | 0 |
| no reconnects | 6 | 0 | 175 | 0 |
| ordinary edits only | 18 | 0 | 65 | 0 |

**Left, each registered with its seeds:** B305, an undo's answer leaving a link's direction as the tab had it (seed 147, default; present at U-b); B306, a converged tab on shared storage giving a down link a blocker the server's document does not (seeds 400, 538, 553), the page's live network keeping a stale reason -- newly visible because those runs used to end apart.

**For U-d:** B252's give-ups are 0 in every profile, so U2 is not needed; B253's two-tab divergence is 0 in 600 runs, so U1 may not be; B254's snapbacks stand (6 and 2 own-pending in 600 undo-heavy runs).

AMENDED 2026-10-07 -- **U-d done** (H19.16).
**B305, fixed:** a preview is confirmed field by field. The echo rule an answer is applied by takes an answer setting fewer fields than the tab did as an echo, narrowed; confirming a preview needs every field the tab set (seed 147: a join's merged link kept a direction the server's board did not have).\
**B306, fixed:** the network's derived board keeps a snapshot of each link's id and stops. The Model edits an entity in place, the view caches a board by a key of those values, and a cached board read an object edited after it was derived -- the stale blocker on a converged tab.\
**B252, closed** on its re-measurement; **B253 and B254, held** with their rates and revival triggers -- U1 and U2 were not needed.

**Measured at the committed code, 600 seeded runs per profile:** no run ends with a tab apart from the server, an invalid document, a link drawn otherwise or a change unanswered, in any of five profiles; no change is given up; a dragged entity is moved by an inbound answer in 1 to 6 runs of 600 (B254).

AMENDED 2026-10-07 -- **U-e done, and the plan is closed** (H19.17; B247 closed).
**In the gate:** `tests/sync-fuzz.test.js` runs 100 fixed seeds over the five profiles -- 30 default, 20 undo-heavy, 20 with two tabs on one storage, 15 without reconnects, 15 with ordinary edits only -- each held to the quiescent oracles and to no change given up; a failure prints the seed and the flags that replay it.
A run's options, the undo weight among them, now reach it through `runSeed` as on the command line (shown: 133 undo or redo actions over ten seeds at weight 12, against 50 by default).
**Its cost, as far as measured:** the file takes about 18 seconds of test time on its own; test files run in parallel, and what it adds to the gate's wall time was not measured reliably -- the gate's one run with it took 203 seconds on a machine running other work at the same time.\
**Exit, against section 7:** invariants 1 to 4 hold on every seed of the bound, and held over 600 runs a profile at H19.16; every open sync defect is closed with a test (B251, B252, B295, B304, B305, B306) or held with its measured rate and a revival trigger (B253, B254).
