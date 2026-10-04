# The server composes the network -- promotion's P3 (DELTA, proposed)

> **Tier 3 -- a design of record, proposed.** Written 2026-10-03 against `d5abf1f`.
> Facts about today's code are measured and cited by file and line; judgements are marked as such.
> Proposes; decides nothing. Section 9 lists what only the director can settle, one at a time.
> AMENDED 2026-10-03: approved, its decisions ruled (section 9).

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

AMENDED 2026-10-03 -- **G1 to G5 RULED as recommended** (`dev/DECISIONS.md`, "P3's design decisions, G1 to G5").\
The build is H18.11 to H18.16, one stage each, S-a to S-f.

AMENDED 2026-10-03 -- **S-a done** (H18.11; G3).\
A composition may hold EXTENSION rows -- `{ kind, owner, extends: true, fields, optional }` -- each adding fields to a kind another owner brings; `composeKinds` merges them into that kind's row, so every reader sees one row, and refuses an extension of a kind not composed, a field the owner or another plugin already brings (both named), a field that is not optional, a field without a check, and any other key; the composition says who brought a field (`contributed`).\
The network's rows are one list, `network/kinds.mjs` `NETWORK_ROWS`: its `pipe` kind and `transit` on the node; every composition with the network is `productKinds(...NETWORK_ROWS)`. The product's node row, and the core's table, name no `transit`.\
A tenant may name the fields it reads on another owner's kind, as it names the kinds it needs: the network's tenant names `node.transit`, and the planner refuses a composition without it.\
**A stated consequence, designed:** until S-b composes the network in the server, the store refuses a stored `transit`, naming the field -- so an agent's `draw set <ref> transit` is refused there meanwhile. Held both ways by the CLI and store tests, which assert the round trip again once S-b lands. Production is frozen and the lab composes the network, so no one meets it.\
Corpora unchanged; the estate holds no transit. Mutants: 9, all killed.

AMENDED 2026-10-03 -- **S-b done** (H18.12), in two commits, each gated.\
**The server composes the network:** `server/store.js` builds one composition -- `productKinds(...NETWORK_ROWS)` and the network's tenant, with transit -- and every Model it holds, every document it validates (boot, examples, `create`, templates, restore) and every commit, undo and redo use it; its Models are given no network to draw with, so the server's path consumers keep their straight drawing until P4. `/network/` is served, and the incubator boundary admits `server/store.js` and `app/src/main.js` -- the promotion's widening, in the diff where a reviewer sees it.\
**The product page composes the network's rows** (G1) and holds pipes; it attaches no network drawing until P5.\
**No default link tenant:** `plan` and `commit` refuse a composition without one, so no path plans links by a rule nobody chose; undo and redo, which replay inverses, refuse a model composed with other kinds.\
**Deleted under the cutover ruling:** `CLASSIC_LINKS` and its condition -- B162's pinned orphan and B216's kept end -- with its reaction table. The planner corpus's 1,045 production cases are retired with that composition; the 1,045 network cases are unchanged, byte for byte.\
**Split, so the planner loads only what it checks:** `model/invariants.mjs` keeps the document invariants; the pair capacity moved to `model/pair-capacity.mjs` (the invariant and the link rules both read it), and the link rules -- `pairHolders`, `collapseAtWaypoint`, `splitAtBend`, `LINK_DECLARATIONS` -- to `model/link-rules.mjs`, on their way into `network/` at S-e.\
**Tests moved with the ruling:** a shared fixture, `tests/fixtures/composed.mjs`, plans as production does; tests that held the classic tenant's rules now hold the network's, each citing its ruling -- a pinned link goes with its only bend (P-7), an endpoint waypoint goes with its last link (2026-09-29), a pinned bend is swept (P-5 corrected), two links' terminus goes with the last of them; the sweep's own tests keep the classic condition as a tenant they build, since a condition is the tenant's to state; the frozen oracle of the GR5 differential composes the oracle's rules as a tenant of its own.\
**Held by a new test file,** `tests/server-network.test.js`: a pin deleted over the server deletes its link; a document with pipes round-trips through the store's write, boot, commit and undo -- P2's deferred exit criterion; the server refuses a transit a host does not offer. The transit round trip through the CLI and the store asserts storage again.\
Gate: lab matrix and its corpus unchanged; the lab's boards seed under the network's tenant, checked in Chrome. Mutants: 6, all killed -- one, undo replaying over another composition, by a new test.

AMENDED 2026-10-03 -- **S-c done** (H18.13; G2).\
`link-legs`, in the network's tenant: a link with pins, or a ring, that is made or re-pinned lays a link pipe straight between two consecutive stops wherever NO PIPES join them at all -- judged leg by leg, none reusing a pipe an earlier leg took, as routing judges them; a plain link lays nothing. It folds in F-f's `ring-pipe`.\
**Two corrections to the design, found by the gate:**
- **"Pipes at all", not "a way".** Section 5.2 proposed laying a leg that "has no way". Matrix row TRN-16 -- a `g` laid on an anchor whose transit is off, the link ruled down (TR-1, TR-3) -- came up, because a pipe was laid round the blocked anchor. A leg joined by pipes only through a non-transiting anchor is down by the author's choice, so the rule asks whether pipes join the stops at all, ignoring transit.
- **The stranded phase, not reshape.** A link that loses a pin is re-pinned by the waypoint cascade and then deleted by the stranded pass; run before it, `link-legs` laid pipes for a link on its way out. It runs after the stranded pass, before the sweep and the join.
Held by: an agent's pinned link on an empty board lays its legs and is up; a plain one lays none and is down (the named stopgap until P6); a leg joined only through a non-transiting anchor lays nothing and stays down; a renamed link lays nothing (TG-3); the ring tests, unchanged.\
Corpora: the matrix and gesture corpora unchanged. The planner corpus differs in 46 of 1,045 cases: 45 only by pipe ops -- legs laid for a generated link with pins over a board without them, their inverses, and what the sweep then does with pipes a now-up link runs over -- and one, `gen-672`, where a waypoint the old answer swept is kept, because the re-pinned link is up now and its route runs through it, and a route shelters what it carries (ruled 2026-09-29).\
Two txn tests moved with it: B81's undo compares collections as sets (the laid pipes come back in reverse order; pipes carry no drawing order), and B241's re-route lifts the bend's pipes too, since a straightened link otherwise still runs over them -- a route is derived from the pipes (2026-09-26).\
Mutants: 7, all killed -- one by a new test.

AMENDED 2026-10-04 -- **S-d done** (H18.14; F2, P-3, P-4, P-5 corrected).\
Three steps in the migration, before `direction` and `schema`:
- **`split` (P-4).** Links are taken oldest first by drawing order, then id. A younger link whose leg an older one already runs is cut at that leg's ends, and the piece along it dropped, since the older link draws that line. The pieces keep the link's declarations; the first keeps its id and order, and a new piece is the newest. A ring is cut open there, one path round its other legs, and again at any typed node inside it, since a link bends only at a waypoint (F-c). A link that is nothing but the shared leg is left and reported, and the dry run fails while one exists. The store says each split, or refused split, in its log.
- **`pipes` (F2, P-3).** One link pipe per distinct leg of every stored link, a ring's closing leg and a plain link included, since both were drawn under a rule that needed no pipe. Keyed on the document never having held a pipe collection: one the network wrote holds one, empty or not.
- **`unpin` (P-5 corrected).** `pinned` is dropped from every node.

**`pinned` retired from the tree:** the node row and its waypoint-only list, `draw set ... pinned`, the drag's unpin entries (B245) and `w`'s placement. A waypoint placed with no link stays until deleted, since the sweep takes only what an edit orphaned.\
**The dry run** composes the network as the store does, and checks every link is up along exactly its stored stops, every pipe is some leg's and laid `link`, and no node carries `pinned`.\
Against the estate backup: 783 pipes, 17 rings with a closing leg, 0 shared legs split, 104 `pinned` dropped; PASS.\
A split diagram's links are checked by the network rather than against their source, since the split is the ruled change.\
Adding the network to the dry run widens the incubator list by `tools/migrate-schema.mjs`, which nothing served imports.\
**Templates migrated in source:** the four gain their pipes (29, 14, 6 and 34) and nothing else. The lab's seeds already carry pipes.\
**Beyond the design, which did not say:** a ring can share a leg too. Cut open at the shared leg it loses nothing, so it is split like an open link. A link that is nothing but the shared leg is listed and blocks the cutover, as `FORMAT-BATCH.md` section 4 rules.\
**Restated, not imported:** `FORMAT-BATCH.md` section 4 named `splitAtBend` and `LINK_DECLARATIONS`. The split runs before the `direction` step, so a link there may still hold `flow`, which `LINK_DECLARATIONS` does not name, and `splitAtBend` refuses a ring. The step keeps every field but the drawn ones, as the migration restates its other rules; it is deleted after the cutover with the rest of `server/migrate.mjs`.\
Corpora:
- The gesture corpus changed in 5 scenarios, only by `pinned` gone and the unpin `set` gone. The `pinned` board is now `free`, a waypoint no link uses, so the threading cases stay.
- The planner corpus lost `sweep-keeps-pinned`, which without `pinned` was `sweep-bend-released` again, so it has 1,044 cases. 387 cases differ only by `pinned` and their input hash; the generator still takes the draw that set `pinned`, so every other case is generated as before.
- The matrix is unchanged.

Tests: `tests/migrate-pipes.test.js`, 13 tests, 10 of them RED before the change.\
B245's acceptance test now holds that threading a free waypoint commits the link alone.\
Mutants: 12; 11 killed, two by tests added for them (age by drawing order, the ring cut at a typed node).\
The 12th is equivalent: putting `pinned` back on the waypoint-only list changes nothing, since the row refuses the field first.

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
