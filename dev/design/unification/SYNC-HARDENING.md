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
