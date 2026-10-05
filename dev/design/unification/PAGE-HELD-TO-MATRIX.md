# The tests move to the product -- promotion's P7 (DELTA, proposed)

> **Tier 3 -- a design of record, proposed.** Written 2026-10-04 against `79688d7`.
> Facts about today's code are measured and cited by file and line; judgements are marked as such.
> Proposes; decides nothing. Section 9 lists what only the director can settle, one at a time.

## 1. Status

- **Asked for:** the director, 2026-10-04: "Lets proceed correctly as per the recommended path to eventually unify all the things" -- P7, then P8 with a staging rehearsal (`dev/DECISIONS.md`, "The path to the cutover").
- **Is:** stage P7 of `PROMOTION.md` section 6 -- "the behaviour matrix runs against the product page as well as the lab; the gesture corpus and the tests that pinned no-network production behaviour are rewritten under the ruling", proven when "the matrix is green on the product page; every rewritten expectation cites the cutover ruling" -- and `PROMOTION.md` section 7's criterion 5.
- **Judged against the target state** (`dev/DECISIONS.md`, "Promotion's target state"): in step with the lab, measured gesture by gesture.
- **Found while measuring:** the harness every input test and the gesture corpus drive composes the product page as it was before P5 -- no network keys and no drag judge -- so they still pin behaviour the page no longer has (section 5.1).

---

## 2. From-state -> to-state

**From** (measured at `79688d7`):
- **The behaviour matrix runs on the lab alone:** 89 rows, each a gesture on a seeded board, driven in real Chrome by `tests/lab-browser.test.js` through `window.lab`, and frozen in `tests/fixtures/matrix-corpus.json`. It takes about 113 seconds of a gate of about 140.
- **The client harness** (`tests/fixtures/client-harness.mjs` `makeInput`), which 12 test files and the gesture corpus drive, composes Input with the network's keys only when a test passes a stub judge (`routeHook`), and 6 corpus scenarios do; otherwise it has no `g`, no `x`, and no drag judge.
- **Tests that still claim production's pre-network behaviour:** three named `PRODUCTION:` in `tests/guide-gesture.test.js` (`:29`, `:42`, `:192` -- `g` does nothing, `w` on a node does nothing), which the product page has not done since V-b; five named `production:` in `tests/path-injection.test.js` (`:78` to `:149`) and one in `tests/network-contract.test.js:77`, which describe a Model with no network -- which since J2 holds no links, and is not production.

**To** (at the end of P7):
- **The matrix runs on the product page as on the lab:** every row on each, against the real server for the page, held to one record.
- **The client harness composes Input as the product page does,** the network's keys and its real drag judge among it, so the gesture corpus records the product page's behaviour.
- **No test claims a production behaviour production no longer has;** each rewritten expectation cites the ruling it follows.

---

## 3. The fence

The matrix runner and a driver for the product page; the client harness's composition; the gesture corpus and the tests that state pre-network production behaviour; the differences the page shows against the lab, each registered and resolved; the gate's time.

---

## 4. The anti-scope fence

- **No new behaviour.** A difference between the page and the lab is a defect in the page's composition, fixed to the lab's ruled behaviour -- or, where the page's own nature makes the difference (a server between tab and planner, the banner for the notice), recorded as such.
- **No change to the matrix's rows or what they expect.**
- **The lab stays** and keeps its runner (`PROMOTION.md` section 4: the place the next capability incubates).
- **Production stays on `draw:2538ab8`** (F3); the staging rehearsal is P8's.

---

## 5. Two findings that shape the stages

### 5.1 The harness and the gesture corpus describe the page before P5

`makeInput` builds the page's canvas without `networkInput` unless a stub judge is passed (`tests/fixtures/client-harness.mjs:257`); the product page has passed the network's keys and real judge since V-b (`app/src/main.js`, `createPageNetwork`).\
So 69 of the corpus's 75 scenarios record a page with no `g` and no `x`, and three tests assert, under the name PRODUCTION, that `g` and `w` on a node do nothing.\
The harness should compose the page as `app/src/main.js` does, through `createPageNetwork`; the corpus is then re-recorded, each changed scenario reviewed and cited, and the stub-judge scenarios kept for what they test -- the plugin seam -- under that name.

### 5.2 The runner speaks to the lab through `window.lab`; the page has a server between

The lab's runner seeds through `?seed=` and reads its in-page authority (`lab.authority`), its notice (`#lab-notice`), and its history (`lab.history`) directly (`tests/lab-browser.test.js:114`, `:624-800`).\
The product page has none of those: a board is a diagram on the server, the authority is the server's document, an answer arrives over the socket, and the network's notice goes to the header banner (J3).
**Recommended (judgement):** one runner and one vocabulary of steps and checks, over two drivers -- the lab's, as today, and the page's, which creates a diagram holding the row's seed board, opens `/d/<id>`, settles by waiting for the outbox to be answered, reads the authority through REST, and reads the notice from the banner -- so a step means the same on both, and no row is written twice.

---

## 6. Build order -- each stage provable before the next depends on it

| stage | what lands | proven by |
|---|---|---|
| **X-a** | **The harness composes the product page:** `makeInput` through `createPageNetwork`, the network's keys and real judge; the stub-judge scenarios kept as tests of the plugin seam; the `PRODUCTION:` and `production:` tests restated under the rulings they now follow | the gesture corpus re-recorded, each changed scenario reviewed and cited; no test claims a pre-network production behaviour |
| **X-b** | **One runner, two drivers:** the matrix runner over a driver interface; the lab's driver as today; the product page's driver against a real server | every lab row unchanged on the lab driver, byte for byte; the product driver runs one row of each step kind green |
| **X-c** | **The matrix on the product page:** every row run on the page; each difference from the lab registered as a B row and fixed, or recorded as the page's own nature (L1) | every row green on the page, held to the record L1 rules |
| **X-d** | **P7 closed:** `PROMOTION.md` section 7's criterion 5; the register; the gate's time measured | the matrix green on both pages in the gate |

Each stage is one gate and one lab deploy.
**Size, by judgement:** X-a and X-c are most of it; X-c's size is the number of differences the page shows, unknown until it runs.

---

## 7. Behaviour that changes, stated before it is built

**For people and agents:** nothing, by design -- every difference X-c finds is fixed to the lab's ruled behaviour; each fix that a person or an agent would notice gets a PU entry when it lands.\
**For the gate:** the matrix runs twice; measured today at about 113 seconds on the lab, so the gate grows by about that (L2).

---

## 8. Coverage, verification, costs

**Proves:** P7's exit criterion; `PROMOTION.md` section 7's criterion 5; the page in step with the lab, gesture by gesture.\
**Defers:** the final dry run and the staging rehearsal (P8); the cutover (P9).

**Verification targets:** the matrix on both pages; the gesture corpus re-recorded under the page's composition; mutants on the page driver's settle, its authority read and its notice read.

**Named costs and non-claims (judgement):**
- **The gate grows** by the page's run of the matrix (L2).
- **It does not put the page in front of a person:** the staging rehearsal is P8's.

---

## 9. Decisions for the director -- one at a time

- **L1 -- what the product page is held to.** Recommended: the lab's own record, row for row -- one matrix corpus, so the page and the lab cannot drift; the only differences allowed are the page's own nature, each named in the runner (the notice read from the banner rather than `#lab-notice`, and the authority read from the server rather than in the page). The alternative: a corpus of the page's own, which would record whatever the page does today, differences included.
- **L2 -- where the page's matrix runs.** Recommended: in the gate, beside the lab's, every push -- about two more minutes, and the page can never fall out of step unnoticed. The alternative: in CI only, or on demand, which keeps the gate's time and lets a difference land unseen until it runs.

---

## 10. Axiom alignment audit (M7)

**Identity:** this delta, against `79688d7`, measured against mission-kit A1-A14 and the director's target state.\
**Verdict: pass-with-guardrails** -- L1 and L2 ruled before X-b.

| axiom | weight | how the delta holds it |
|---|---|---|
| A2 Isomorphic Specification | load-bearing | one matrix and one record hold the lab and the page to the same ruled behaviour (L1) |
| A8 Gated Recursive Integrity | load-bearing | the page's matrix in the gate keeps it in step at every push (L2) |
| A5 Perceptual Parity | supporting | a person on the page sees what the lab shows, gesture by gesture |
| A1, A3, A4, A6, A7, A9-A14 | not materially implicated | |

**Guardrail:** no row is edited to fit the page; a difference is fixed in the page or named as its nature in the driver.
