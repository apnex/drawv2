# The server composes the network -- promotion's P3 (DELTA, proposed)

> **Tier 3 -- a design of record, proposed.** Written 2026-10-03 against `d5abf1f`.
> Facts about today's code are measured and cited by file and line; judgements are marked as such.
> Proposes; decides nothing. Section 9 lists what only the director can settle, one at a time.

## 1. Status

- **Asked for:** the director, 2026-10-03, approving H18.10 -- P3's design before any code ("continue").
- **Is:** stage P3 of `PROMOTION.md` section 6, with what P2 handed it ("P2 is done on `main`", `PROMOTION.md`): stored pipes and the P-4 split (F2), `pinned` and production's orphan rule (P-5 corrected), the classic tenant, and the link's move to the network (the link's path table, P3 rows).
- **Judged against the target state** the director stated (`dev/DECISIONS.md`, "Promotion's target state"): clean, deduplicated, modular, in step with the lab. Each stopgap below is named with the stage that removes it.
- **Found while measuring, and the reason section 9 has five questions rather than two:**
  - the product page cannot load a document holding pipes until it composes the pipe kind, so P3 cannot change the server alone (section 5.1);
  - a link made through a door with no drag judge -- the CLI, REST, the product page before P5 -- gets no pipes, so under the network's routing it comes up down (section 5.2);
  - the browser's own copy of the cascade cannot agree with the server's before P5 gives the product page the network (section 5.3).

---

## 2. From-state -> to-state

**From** (measured at `d5abf1f`):
- **The server runs production's rules.** The store constructs three Models with the product's four kinds (`server/store.js:655`, `:799`, `:848`) and commits, undoes and redoes with the planner's defaults (`:1259`, `:1285`, `:1297`), which are the classic link tenant (`planner/txn.mjs` `composition`, `links = CLASSIC_LINKS`).
- **The classic tenant keeps a pinned orphan and a link's end** (`planner/tenants.mjs:19`, B162, B216), strands nothing, and joins anywhere; the network's tenant keeps neither, strands a link that lost a pin, and joins only where transit passes (`network/network.mjs`).
- **The product page composes the product's four kinds** and no network (`app/src/compose-canvas.js:63`). A snapshot's `pipes` would be dropped silently by `Model.load`, and a pipe op would throw (`model/model.mjs` `collection`).
- **No production module imports `network/`** (`tests/scan-layers.test.js:747`, `MAY_REACH_THE_INCUBATOR`).
- **Pipes are laid only by the lab's drag judge** (`network/session.mjs` `judge`), and by `ring-pipe` for a ring's closing leg.
- **The link kind's row and its rules live in the product's folders:** the row in `planner/kinds.mjs`, its rules in `model/link-reactions.mjs`, `model/invariants.mjs` and `model/referential.mjs`, its roles and appearance in `kernel/`.
- **`transit` is a field of the product's node row** (`planner/kinds.mjs`), though only the network gives it meaning (H18.7).
- **The browser previews with its own copies of three planner rules:** the cascade and the group trim (`app/src/commands.js:128`, `:166`) and the split at a bend (`app/src/input.js:1000`).
- **The planner corpus holds 1,045 production cases** planned with the classic tenant.
- **The estate's 464 links have no pipes.** One pipe per consecutive stop pair, closing legs included, is 783; no pair is shared (H18.2).

**To** (at the end of P3):
- **The server composes the network:** every Model the store holds carries the product's kinds and the network's `pipe`, and every commit, undo and redo plans with the network's tenant. The planner has no default tenant, so no path plans without one.
- **The classic tenant, its pinned-orphan rule and `pinned` are deleted;** the migration drops `pinned` from stored documents.
- **The migration lays every stored link's pipes** -- one link pipe per consecutive stop pair, closing legs included -- and splits any shared leg into a junction (P-4); the dry run shows every link up along exactly its stored stops.
- **A link made through any door gets the pipes it needs** by one rule in the network's tenant (G2).
- **The product page composes the same kinds** and holds pipes, drawing links as it does today until P5 attaches the network's drawing (G1).
- **The link kind and its model-side rules are the network's,** in `network/` (G5, B280, K13b's model half); the kernel's roles and appearance follow at P5 with the canvas (PU22).
- **`transit` is a field the network contributes to the node** (G3).

---

## 3. The fence

The store's composition and every planner call it makes; the planner's default tenant; the classic tenant and `pinned`; the migration's pipe, split and unpin steps and the dry run's checks for them; the pipe rule for links made outside a drag; the product page's kinds; the incubator boundary; the link kind's row and its model-side rules moving into `network/`; a plugin contributing a field to another owner's kind; the corpora, matrix rows and tests that move with them.

---

## 4. The anti-scope fence

- **No change to the canvas's drawing.** The product page draws links straight through their stops, as today, until P5 attaches the network (pipe painter, drag judge, `g`).
- **No path consumer changes:** the SVG export, REST paths, `draw movers` and `draw combat` keep their straight drawing until P4 (`PROMOTION.md` section 3.3).
- **No pipe verbs in the CLI or REST:** P6.
- **No new routing behaviour.** Every rule is as the lab runs it; the behaviour that changes is the network's ruled behaviour reaching the server (section 7).
- **The kernel's network roles and appearance stay in `kernel/`** until P5 moves them with the canvas (PU22).
- **Production stays on `draw:2538ab8`** (F3).

---

## 5. Three findings that shape the stages

### 5.1 The product page cannot hold a document with pipes

`Model.load` keeps only the collections its kinds name, so a snapshot's pipes are dropped without a word; an answer carrying a pipe op then throws, because the product page's Model has no `pipe` kind.
Every edit the network's tenant answers can carry one: deleting an anchor takes its pipes (`pipe-cascade`), closing a link lays one (`ring-pipe`), and the sweep removes them.
So the server cannot compose the network while the product page does not compose the pipe kind.

The page is not live -- production is frozen on `2538ab8` -- so this concerns `main`'s own product page and its tests, not users.
Recommended in G1: the product page composes the pipe kind at P3, and holds pipes without drawing them, until P5 attaches the network; P5 follows P3 directly.

### 5.2 A link made outside a drag gets no pipes

In the lab every link arrives with the pipes its drag laid (`network/session.mjs` `judge`).
Nothing else lays a link's pipes: an agent's `draw link a b --via ...`, a REST create, and the product page's own drag commit a link with none, and under the network's routing such a link is down -- on an empty board, every link an agent draws.
The grammar already says what a drag lays (`network/grammar.mjs` G5-G7): a pinned link lays a pipe into each of its stops; a plain link, with no key, lays none -- "Direct links without a key lay no pipe" (2026-09-30).

Recommended in G2: one rule in the network's tenant, `link-legs` -- a link created or re-pinned whose leg between two consecutive stops has no way lays a link pipe for that leg, when the link has pins; a plain link lays nothing.
"Has no way" keeps the lab's drags untouched: their judge has laid what they route over, so the rule finds nothing to add; it is the same question `ring-pipe` asks for a closing leg, which it subsumes -- one rule rather than two.
The migration lays every leg of every stored link, plain links included, because those were drawn under a rule that needed no pipes; that is its own documented step, not this rule.

### 5.3 The browser's cascade cannot agree with the server's before P5

`PROMOTION.md` gives P3 the exit criterion "a pin deleted over the server deletes its link, and the tab agrees before the answer arrives".
The tab's optimistic cascade (`app/src/commands.js` `deleteSelection`) strips a bend, as the classic rule did; the server will delete the link (P-7).
The tab is corrected by the answer (`derivedToApply`), so the documents converge; but the tab agrees only after the answer.
Agreeing before it is PL-6 -- the browser previewing with the planner itself -- which needs the network's tenant in the page, which is P5.
Recommended in G4: the second half of that criterion, and PL-6, move to P5.

---

## 6. Build order -- each stage provable before the next depends on it

| stage | what lands | exit criterion |
|---|---|---|
| **S-a** | **A plugin may contribute fields to another owner's kind** (G3): a composition row naming a kind it does not own and the fields it adds, each with its check, refused when two claim one field; the network contributes `transit` to the node, and the product's node row loses it | the product's rows name no `transit`; a composition without the network refuses a stored `transit`; every corpus unchanged |
| **S-b** | **The server composes the network.** The store's Models and every commit, undo and redo take the product's kinds, the network's `pipe` and its tenant; templates and examples load the same way; the planner requires a tenant, so none plans without one; the product page composes the same kinds and holds pipes (G1); the incubator boundary admits `server/` and the page's composition; the classic tenant and the pinned-orphan rule are deleted; the planner corpus's production cases are retired into its network cases | a pin deleted over the server deletes its link; no store path constructs a Model or plans without the network; the product page loads, edits and undoes a document holding pipes; every rewritten corpus case cites the cutover ruling |
| **S-c** | **Pipes for a link made outside a drag** (G2): `link-legs` in the network's tenant, folding `ring-pipe` into it | an agent's `draw link a b --via x,y` comes up up; a plain `draw link a b` on a board with a way runs over it and lays nothing; the lab's matrix and corpus unchanged |
| **S-d** | **The migration's last steps:** `pipes` (every stored link's legs, closing legs included), `split` (a shared leg split into a junction at its bends, the younger link giving way, P-4), and `unpin` (`pinned` dropped); the dry run checks every link up along exactly its stored stops; templates and seeds migrated in source | the estate dry run: 783 pipes, 17 closing, 0 shared, every link up along its stops, 0 `pinned`; a constructed shared leg is split and listed |
| **S-e** | **The link is the network's kind** (G5; B280, K13b's model half): the link row and its rules -- reactions, invariants, references, the tenant builder -- move into `network/`; the product composes four kinds less the link, and the link by composing the network | no product module defines a link rule; L7k's lists re-recorded; every corpus unchanged |
| **S-f** | **P3 closed:** the estate dry run on every step; the production-upgrade register (section 7); `PROMOTION.md` amended | the dry run reports nothing unexplained; every change in section 7 has a PU entry |

Each stage is one gate and one lab deploy.

**Size, by judgement:** S-b and S-e are most of it.
S-b changes the default every planner test relies on: 39 test files plan or commit, and the planner corpus's 1,045 production cases are re-planned as network cases.
S-e moves about 1,000 lines between folders and re-points their importers; behaviour is held still by the corpora.

---

## 7. Behaviour that changes, stated before it is built

**For people and agents** (each a PU entry):
- **Deleting a pin deletes its link** (P-7) -- PU39, recorded at H18.9.
- **A waypoint goes with its last link, ends included** (ruled 2026-09-29, "it goes just as ruled"): production kept a link's end and a pinned waypoint (B162, B216). A new PU entry.
- **Two links left at a waypoint join only where its transit passes** (TR-5); production joined anywhere. A new PU entry.
- **An agent's link** gets its legs' pipes when it has pins and no way; a plain `draw link a b` lays none, and comes up down where no way exists, until P6 gives agents pipe verbs (G2). A new PU entry.
- **`pinned`** leaves `draw set` and the stored document.

**In the behaviour matrix:** nothing changes; the lab already runs the network's tenant. New rows only if S-c finds a lab case `link-legs` reaches, which "has no way" is designed to rule out.

---

## 8. Coverage, verification, costs

**Proves:** P3's exit criteria, its tab half moved to P5 (G4); F2 (stored pipes); P-4; P-5 as corrected; B280 and K13b's model half; G3's field contribution.\
**Defers:** PL-6 and the tab agreeing before the answer (P5); the kernel's roles and appearance (P5); path consumers (P4); pipe verbs (P6); B282's type-as-composition half.

**Verification targets:** the estate dry run at every stage, with the new checks; the planner corpus re-planned under one tenant, each rewritten case diffed and cited; a round-trip of a document with pipes through store, snapshot, sync, undo and the log -- P2's deferred exit criterion; the lab matrix unchanged; mutants on `link-legs`, the migration's new steps, the planner's required tenant and the field contribution.

**Named costs and non-claims (judgement):**
- **The largest stage after P2:** it changes the server's rules and every planner test's default.
- **The product page holds pipes it cannot draw** between S-b and P5 -- a named stopgap, removed at P5 (G1).
- **An agent's plain link can come up down** between S-c and P6 -- a named stopgap, removed at P6 (G2).
- **It does not show the product page routing,** or any export drawing a route: P5 and P4.

---

## 9. Decisions for the director -- one at a time

- **G1 -- the product page between P3 and P5.** Recommended: the page composes the pipe kind at P3 and holds pipes without drawing them, and P5 follows P3 directly; the page is not live while production is frozen. The alternatives: build P3 and P5 as one stage, larger and harder to prove; or keep the server's network behind a switch until P5, which is a second mode the cutover ruling forbids.
- **G2 -- pipes for a link made outside a drag.** Recommended: `link-legs` -- a link with pins lays a link pipe for each leg that has no way; a plain link lays nothing, as the grammar rules for a drag; it subsumes `ring-pipe`. The alternatives: every created link lays every missing leg, plain ones included, which changes what a plain drag does in the lab; or no rule, and each door lays its own pipes, which puts the grammar in the CLI too.
- **G3 -- where `transit` lives.** Recommended: a plugin may contribute fields to a kind it does not own, declared in its composition and checked like any field, so the network brings `transit` and the product's node row names none -- the clean answer the target state asks for, small because composition already validates rows. The alternative: leave `transit` in the node row as a named stopgap until B282's packs supply fields.
- **G4 -- the tab agreeing before the answer.** Recommended: that half of P3's exit criterion, and PL-6, move to P5, where the product page has the network's tenant to preview with; the tab converges on the answer meanwhile. The alternative: give the page the planner's network tenant at P3 without its drawing, which is most of P5's composition done early.
- **G5 -- when the link becomes the network's.** Recommended: at P3, as the link's path table already places it (B280), with its model-side rules (K13b) -- once production imports `network/`, the rules can live there, and the "network code in core folders" gap closes for the model and planner; the kernel's half moves at P5 with the canvas. The alternative: after the cutover, which keeps the gap through P9.

---

## 10. Axiom alignment audit (M7)

**Identity:** this delta, against `d5abf1f`, measured against mission-kit A1-A14 and the director's target state.\
**Verdict: pass-with-guardrails** -- G1 to G5 ruled before S-a.

| axiom | weight | how the delta holds it |
|---|---|---|
| A2 Isomorphic Specification | load-bearing | one link tenant, not two; one pipe rule for every door (G2); the link's rules in the plugin that owns them (G5) |
| A3 Sovereign Composition | load-bearing | the network contributes its kind, its field and its rules by composition (G3, G5); the core names no plugin |
| A5 Perceptual Parity | supporting | an agent's link is routed as a person's is, by the same tenant on the server |
| A8 Gated Recursive Integrity | load-bearing | the estate dry run at every stage proves every link up along its stored stops before the cutover depends on it |
| A13 Director Intent Amplification | supporting | five decisions, each a named stopgap or its removal, asked one at a time |
| A1, A4, A6, A7, A9-A12, A14 | not materially implicated | |

**Tensions.**
- **A full cutover against intermediate stages (A2 against A8).** Between S-b and P5 the server runs the network while the page does not draw it. Accepted under G1: the page is not live, and the stopgap is named with the stage that removes it.
- **The grammar against agents (A5).** An agent's plain link lays no pipe, as a person's plain drag lays none; until P6 an agent has no way to lay one. Accepted under G2 as a named stopgap.

**Guardrails:** the lab's matrix and corpus unchanged at every stage; no planner path without a tenant once S-b lands; every rewritten corpus case cites the cutover ruling; production frozen (F3); the backup stays private.
