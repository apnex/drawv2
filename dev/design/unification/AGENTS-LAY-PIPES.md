# Agents lay pipes -- promotion's P6 (DELTA, proposed)

> **Tier 3 -- a design of record, proposed.** Written 2026-10-04 against `6d88019`.
> Facts about today's code are measured and cited by file and line; judgements are marked as such.
> Proposes; decides nothing. Section 9 lists what only the director can settle, one at a time.
> AMENDED 2026-10-04: approved; K1 ruled as recommended (section 9).

## 1. Status

- **Asked for:** the director, 2026-10-04, approving H18.30 -- P6's design before any code ("approved for next get action").
- **Is:** stage P6 of `PROMOTION.md` section 6 -- "CLI and REST for pipes: list, add and remove; `show`, `dump`, `map`, `get` and `columnsFor` carry pipes; `SETTABLE` covers the new fields", proven when "an agent can do with pipes everything a person can (A5), held by the CLI suite".
- **Removes the last named stopgap,** G2's: an agent's plain `draw link a b` lays no pipe, and comes up down wherever no way exists (`SERVER-COMPOSES-NETWORK.md` section 9, G2).
- **Judged against the target state** (`dev/DECISIONS.md`, "Promotion's target state"): it adds no stopgap, and it closes one more hand-kept kind list (section 5.2).
- **Found while measuring:** a person can make a link that lays its own pipe in one gesture, and an agent cannot (section 5.1).

---

## 2. From-state -> to-state

**From** (measured at `6d88019`):
- **REST has no pipes.** Its collections are a hand-kept list of the product's four (`server/rest.js:17`, `COLLECTIONS`), so `GET`, `POST` and `DELETE` on `/pipes` answer `unknown collection` (`:687`, `:1089`).
- **The CLI cannot name a pipe.** `resolveId` accepts `node`, `link`, `zone` and `group` ids and looks names up in their collections (`cli/verbs.mjs` `resolveId`), so `draw rm pipe-...` is not found; `draw get` lists five kinds and no pipes (`get`); `show`, `dump` and `map` print none.
- **An agent cannot lay a pipe** except by hand-writing ops through `draw commit` or `POST /commit`, building the pipe's id and ends itself -- the rule the network owns (`network/pipe-kind.mjs` `pipeEntity`).
- **What a person can do with pipes,** on the lab and, since P5, the product page (`network/grammar.mjs`):
  - lay a pipe by hand with `g`, between two anchors, which outlives any link (`hand-pipe`);
  - make a link that lays its own pipes, which go when no link is on them, by pressing a key during the drag (`link-pipe`);
  - make a plain link over the pipes already there (`plain-link`, `no-pipe`);
  - select a hand pipe and delete it (N6, B281);
  - see every pipe no up link runs over.
- **An agent's link with pins** lays its legs (G2, `link-legs`); a plain one lays none.

**To** (at the end of P6):
- **REST serves the composition's collections,** pipes among them: an agent lists, lays and deletes pipes through `/pipes` like any other entity.
- **The CLI lays, lists and removes pipes,** and every read verb shows them.
- **An agent can do in one call what a person does in one gesture:** lay a hand pipe, and make a link that lays its own pipe.

---

## 3. The fence

REST's collections and their reads and writes for pipes; the CLI's verbs, resolution and read output for pipes; how an agent makes a link that lays its own pipes; the tests that hold each verb to what a person's gesture makes; the production-upgrade entries.

---

## 4. The anti-scope fence

- **No change to any rule.** A pipe laid by an agent is planned like any edit, by the network's tenant; nothing about how pipes are laid, swept or routed changes.
- **No change to the canvas or the gestures.**
- **No pipe `set` verb:** a pipe's one field an author changes is `laid`, and only from `link` to `hand` -- which laying it by hand already does (`network/pipe-kind.mjs`, the row refuses the reverse). So `SETTABLE` needs no new field; the plan's line about it is answered by measurement, not work.
- **No change to the stored format or the migration.**
- **Production stays on `draw:2538ab8`** (F3).

---

## 5. Two findings that shape the stages

### 5.1 A person makes a link that lays its own pipe in one gesture; an agent cannot

The grammar's `link-pipe` row: any hop of a drag that pressed a key lays a pipe with the link, which goes when no link is on it (`network/grammar.mjs:69`).\
So a drag from A with `w` pressed at A and released on B makes the link A-B and its pipe, in one gesture.\
An agent's `draw link a b` is the plain drag, which lays none -- correctly, as ruled ("Direct links without a key lay no pipe", 2026-09-30) -- and an agent's `draw link a b --via x` lays its legs (G2).\
What an agent lacks is the keyed drag with no pins: a direct link that lays its own pipe.\
`draw pipe a b` followed by `draw link a b` is not the same: that pipe is a hand pipe, which outlives the link, where the gesture's goes with it.

### 5.2 REST's collection list is a second list of the composition's kinds

`server/rest.js:17` names the four product collections by hand.\
The store already composes the product's kinds with the network's (`server/store.js` `KINDS`), and each Model carries its composition (`model.kinds`), so the collection list can be read from the model as `entityIn` already is (R-b).
**Recommended (judgement):** read it; the one write that differs by kind -- building an entity from a `POST` body (`buildEntity`) -- gains the pipe's shape, `{ a, b }`, through the network's `pipeEntity`, so REST builds no pipe id itself.

---

## 6. Build order -- each stage provable before the next depends on it

| stage | what lands | proven by |
|---|---|---|
| **W-a** | **REST serves pipes:** its collections read from the model's composition; `GET /pipes` and `/pipes/<id>`; `POST /pipes {a, b}` lays a hand pipe through `pipeEntity`; `DELETE /pipes/<id>` | each answer read against the store's document; a `POST` refused for an end that does not exist, and for ends a pipe already joins, as the planner refuses them |
| **W-b** | **The CLI lays and removes pipes:** `draw pipe <a> <b>` lays a hand pipe; `draw rm` takes a pipe id or a pipe's two ends; `resolveId` accepts a pipe id | the CLI suite: a pipe laid between two anchors heals a down link through it, as HEAL-02 does on the page; removed, the link goes down again |
| **W-c** | **The CLI reads pipes:** `draw get pipes`, and pipes in `show`, `dump` and `map` | each verb's output on one board holds every pipe, laid by hand or with a link, and nothing else |
| **W-d** | **A link that lays its own pipe** (K1) | the CLI suite: `draw link a b` with the chosen form on an empty board comes up up, its pipe laid with it, and the pipe goes when the link is deleted; plain `draw link a b` still lays none |
| **W-e** | **P6 closed:** the parity test -- each thing a person does with pipes, done through the CLI, makes the document the gesture makes; the register; `PROMOTION.md` amended | for each of the five things in section 2, the CLI's document equals the gesture corpus's or the matrix's for the same board |

Each stage is one gate and one lab deploy.
**Size, by judgement:** the smallest stage of the promotion -- no rule changes, and most of the work is the CLI's.

---

## 7. Behaviour that changes, stated before it is built

**For agents** (each a PU entry, reaching production at the cutover):
- **REST serves `/pipes`:** list, read, lay by hand (`POST {a, b}`) and delete.
- **`draw pipe a b`** lays a hand pipe; **`draw rm`** removes a pipe by id or by its two ends; **`draw get pipes`** lists them; `show`, `dump` and `map` show them.
- **A link that lays its own pipe,** in the form K1 rules.

**For people:** nothing.\
**In the behaviour matrix:** nothing.

---

## 8. Coverage, verification, costs

**Proves:** P6's exit criterion (A5 for pipes); G2's stopgap removed; the collections read from the composition.\
**Defers:** the matrix on the product page (P7); the final dry run (P8).

**Verification targets:** each verb against the real server in the CLI suite; the parity test of W-e, each of the five things a person does with pipes held to the gesture's document; mutants on the collection reading, the pipe build, the end-pair removal and K1's form.

**Named costs and non-claims (judgement):**
- **REST answers one more collection**, read from the composition: a future plugin kind is served the same way without a REST change.
- **It does not add a pipe to any link an agent made before P6:** those links are as G2 left them, laid if pinned.

---

## 9. Decisions for the director -- one at a time

- **K1 -- how an agent makes a link that lays its own pipe** (section 5.1). Recommended: a flag on `draw link`, `--lay`, which lays a pipe with the link for each leg no pipes join -- as the keyed drag does, and as a pinned link already does (G2's `link-legs`); without it, a plain link lays none, as ruled. The alternatives: every agent link lays its legs (which would overrule "Direct links without a key lay no pipe" for agents alone), or none does and an agent lays hand pipes first (which outlive the link, unlike the gesture's).


AMENDED 2026-10-04 -- **K1 RULED as recommended** (`dev/DECISIONS.md`, "P6's design decision, K1"): `draw link ... --lay` lays the link's legs with it; a plain link lays none.

AMENDED 2026-10-04 -- **W-a done** (H18.31).\
REST's collections are read from the model's composition (`kindOfCollection`), so the network's `pipes` is served like any other, and REST holds no list of kinds. `POST /pipes {a, b}` builds a hand pipe through the network's `pipeEntity`; which ends a pipe may join is the planner's to judge, so REST checks only that two are named. `docs/spec/API.md` amended.\
Held by `tests/rest-pipes.test.js` against the real server -- a pipe laid heals a down link, refused to a missing end and to one anchor, laid twice once, deleted and the link down again, and every composed collection served -- all four failing on the code before. Mutants: 3; 2 killed, the third the self-pipe check REST had copied from the planner, which was removed.
---

## 10. Axiom alignment audit (M7)

**Identity:** this delta, against `6d88019`, measured against mission-kit A1-A14 and the director's target state.\
**Verdict: pass-with-guardrails** -- K1 ruled before W-d.

| axiom | weight | how the delta holds it |
|---|---|---|
| A5 Perceptual Parity | load-bearing | an agent can do with pipes everything a person can, held thing by thing against the gesture's document |
| A2 Isomorphic Specification | supporting | every pipe an agent lays is planned by the network's tenant, built by the network's `pipeEntity`; no door restates the id rule |
| A3 Sovereign Composition | supporting | REST's collections are the composition's, so the network's kind is served because it is composed |
| A1, A4, A6-A14 | not materially implicated | |

**Guardrail:** no verb builds a pipe id or decides a pipe's lifetime itself; held by the parity test in W-e.
