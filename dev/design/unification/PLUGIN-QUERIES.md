# The Model's questions to the network become the network's -- H19.26 (DELTA, proposed)

> **Tier 3 -- a design of record, proposed.** Written 2026-10-08 against `ab5500f`.
> Facts about today's code are measured and cited by file; judgements are marked as such.
> Proposes; decides nothing. Section 6 holds the one decision for the director.

## 1. Status

- **Asked for:** the director, 2026-10-08, choosing "pay K13d first" after the kinds-as-plugins arc closed (`dev/BOARD.md` H19.25, H19.26).
- **Is:** the second half of K13d (`dev/design/h17/PLAN.md`), recorded in B280's history: "the core Model asks a plugin named `network` six questions by name, a privilege of one plugin; the direction is plugins bringing their own queries".
- **Follows:** H19.25, which moved the Model's five link methods to `network/link-queries.mjs`, and found the hazard this design removes (section 2).

---

## 2. From-state -> to-state

**From** (measured at `ab5500f`):
- **A Model is built with `{ network }`** and refuses a network that does not answer six questions by name (`model/model.mjs` `MODEL_READS`, `requireNetwork`): `pathOf`, `linksRoutedThrough`, `isLinkDown`, `blockersOf`, `declaresNoTransit`, `stopsAt`.
  It forwards each as a method of its own -- `model.isLinkDown(link)` is answered by `network.isLinkDown(link, model)` -- and keeps `straightPath`, a down link's intent, which it hands the network as `pathOf`'s default.
- **The link's row names the questions that draw it** (`drawnBy`), and a Model composed with a drawn kind and no network is refused.
- **Callers:** 25 in production, 3 of them optional calls -- `model.stopsAt?.(id)` in the network's roles, `model.isLinkDown?.(...)` and `model.linksRoutedThrough?.(...)` -- and some 113 in tests.
  A Model is built with a network in 7 production places and 55 test places.
- **The hazard, measured at H19.25:** three optional calls of the same shape, `model.linksAt?.(id) || []`, answered no links once the method left the Model, instead of failing; the suite caught it.
  An optional call on a Model method turns a moved method into a silent wrong answer.

**To** (option A, section 6):
- **The six questions are the network's functions over a Model** -- `pathOf(model, link)`, `isLinkDown(model, link)`, `blockersOf(model, link)`, `linksRoutedThrough(model, id)`, `declaresNoTransit(model, id)`, `stopsAt(model, id)` -- as the link queries are since H19.25, with `straightPath` beside them.
  Each gives the no-network answer itself when the Model has no network attached: the straight path, not down, no blockers, nothing routed through, no declaration, nothing stops.
  CORRECTED 2026-10-08, building Q-a: with no network a Model drew no link -- `pathOf` answered null, not the straight path (`model/model.mjs`, V-e, J2); the function gives null, and the straight path stays what the network draws a down link along.
  So no caller needs an optional call.
- **The Model holds what a plugin attaches to it, per Model, without naming or asking it** -- `new Model({ kinds, attached: { network } })` -- since the network keeps one derivation per board and so one instance per Model (`network/read-model.mjs`).
  The network's functions read their own instance; the core reads nothing of it.
- **A row names the attachment its kind needs** where it named the questions that draw it -- the link's `drawnBy` becomes `needs: ['network']` -- and a Model composed with the kind and without the attachment is refused, as now.
- **Nothing a user sees changes.**

---

## 3. The fence and the anti-scope

**In:** the six forwards and `straightPath` off the Model; the attachment slot; the row's declaration; every caller; a test that no caller makes an optional call on these names, and that the core Model names none of them.
**Out:** what the network answers -- every answer stays byte-identical, the corpora holding it; the canvas (B308, H19.23); the stored format.

---

## 4. Build order -- one stage

| stage | what lands | proven by |
|---|---|---|
| **Q-a** | The six questions and `straightPath` as the network's functions; `attached` in place of `network` on the Model; `needs` in place of `drawnBy`; every caller and construction re-pointed | every corpus identical; the core Model names no network question; no optional call on one anywhere; a Model composed with the link and no network refused, naming the attachment |

**Size, by judgement:** moderate and mechanical -- about 25 production calls and 7 constructions, 113 test calls and 55 constructions.

---

## 5. Acceptance tests

1. `model/model.mjs` names none of the six questions, `straightPath` or `network`.
2. No module or test makes an optional call on one of the six (`?.(`).
3. With no network attached, each function gives the no-network answer; with one, the answer production gives today.
4. A Model composed with the link and without the network attached is refused, naming what is missing.
5. The planner, gesture, matrix and K8 DOM corpora are byte-identical.

---

## 6. The decision for the director

**Q1 -- how a plugin's queries reach their callers.**
- **A -- callers ask the plugin; the Model holds attachments it does not read (recommended, judgement).** The pattern H19.25 just proved; each question keeps its own searchable name (K27); the no-network answer is given in one place per question, so the optional calls go.
  Cost: 62 constructions change their option's name, mechanically.
- **B -- the Model keeps one generic door, `model.ask(question, ...args)`, which a plugin's row supplies.** Callers keep asking the Model; the core still names no plugin.
  Cost: questions become strings -- a misspelling is found when it runs, and plain-text search finds no definition (K27).
- **C -- hold.** The forwards stay; a test forbids optional calls on them, which removes the hazard but not the privilege.
  Cost: the core keeps asking one named plugin six questions.

---

## 7. Axiom alignment audit (M7)

| axiom | weight | how it holds |
|---|---|---|
| A3 Sovereign Composition | load-bearing | a plugin's questions live in the plugin; the core holds an attachment it does not interpret |
| A2 Isomorphic Specification | load-bearing | one statement of each question and of its no-network answer |
| A5 Perceptual Parity | supporting | no caller derives "no links" or "not down" from a missing method -- the measured hazard |
| A8 Gated Recursive Integrity | load-bearing | one stage, gated on byte-identical corpora |
| A11 Cognitive Minimalism | supporting | a check, not a reader, finds an optional call |
| the rest | not materially implicated | nothing stored, deployed or perceived changes |

**Verdict: pass** -- for A, or B with its stated cost; C passes A5 and leaves A3's privilege standing.

---

## 8. Ruled, and built

AMENDED 2026-10-08 -- **Q1 RULED: A** (`dev/DECISIONS.md`, "Q1").

AMENDED 2026-10-08 -- **Q-a done** (H19.27); K13d with it.
**What moved:** `pathOf`, `linksRoutedThrough`, `isLinkDown`, `blockersOf`, `declaresNoTransit`, `stopsAt` and `straightPath` from the Model to `network/network-queries.mjs`, with `networkOf`, which reads the network attached to a Model and checks it whole once.
The Model takes `attached` where it took `network`, holds it frozen and reads none of it; the retired option is refused, naming what replaced it.\
The link's row declares `needs: ['network']` where it declared `drawnBy`, and a Model composed with the link and without the network is refused, naming the attachment.
**Callers:** every production call re-pointed, the three optional calls among them; every construction attaches the network; in-page test strings import the functions from the served folder.\
**Held by:** `tests/network-queries.test.js` -- the core Model names no network and no question; no module or test makes an optional call on one; each question's no-network answer; the attachment refused when a kind needs it and it is missing, and the retired option refused (a no-network answer changed, and the attachment check dropped, each fail it -- both mutants killed).
Two test files that held the forwarding contract itself (`tests/path-injection.test.js`, `tests/network-contract.test.js`) restated to the attached one; the sync fuzz's planted route fault, which overwrote a Model method nothing reads now, plants it in the tab's network; every corpus unchanged.
