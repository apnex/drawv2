# Promoting the network plugin into production -- a full cutover, planned (DESIGN, held)

> **Tier 3 -- a plan of record, not started.** Written 2026-09-30 against `fca7828`.
> Facts about today's code are measured and cited by file and line; judgements are marked as such.
> Held as B266: no work starts until the director says so, and then one approved stage at a time.

## 1. Status

- **Ruled:** 2026-09-30, "Full cutover to new routing engine in existing diagrams. No legacy" (`dev/DECISIONS.md`, "Promotion is a full cutover").
- **Held:** B266, revived when the director says promotion may start.
- **Builds on:** the lab's incubation ruling of 2026-09-28 ("production takes it by promotion"), the network interface (RULESET-AUDIT T1) and the gesture system (`dev/design/input/GESTURE-SYSTEM.md`).
- **Decides nothing yet:** section 10 lists what the director rules at the start.

---

## 2. What was ruled, and what it means

The director: "I dont want to proceed yet - but let's document the full plan for when we are ready.\
Full cutover to new routing engine in existing diagrams.\
No legacy".

So at promotion:
- production composes the network plugin always, in the browser, on the server, in the CLI, in REST and in the export;
- every stored diagram -- the live estate, the templates, the examples -- is migrated to carry pipes and link ages;
- the product's pre-network behaviours are deleted, not kept beside the new ones: straight polylines through `via`, the B162/B216 orphan rules, never stranding a link, and the null-network seams that let a composition run without the network.

---

## 3. Where it stands -- measured at `fca7828`

### 3.1 Already production code

These ship with the next deploy of `main` and need no promotion work:
- the gesture system, stages 1 to 6 -- capture, input state, triggers, the Rules engine, releases as rows, the generated help;
- the network interface on the Model and the planner (`model/model.mjs:68-104`, `server/txn.mjs:94-108`), unused by production today;
- the one home for pair capacity (`model/invariants.mjs:78-84`) and the B245, B258, B261 fixes.

### 3.2 Lab-only

- **The network plugin, `network/`** -- about 950 lines: pipes and routing (`pipes.mjs`), one derivation per board state (`view.mjs`), the network object (`network.mjs`), guides and the drag judge (`guide.mjs`), the grammar (`grammar.mjs`), its keys (`keys.mjs`), appearance, link ages (`order.mjs`) and the session (`session.mjs`).
- **Its orchestration, in the lab root** -- the pipe painter, `settle`, the route hook and the door (`lab/src/root.js:78-209`).
- **Pipes and ages are session state.** They live in the tab (`network/pipeset.mjs`, `network/order.mjs`): a reload loses them, other peers never see them, undo cannot move them (`dev/DECISIONS.md`, "undo brings it back", CORRECTED).
- `network/` is already in the production image (`Dockerfile:39`) but is neither served (`server/app.js:308-310`) nor imported, and a test holds that (`tests/scan-layers.test.js:719`).

### 3.3 What production lacks to host it

- **No pipe kind.** Five kinds are enumerated in `model/model.mjs:11`, `server/validate.js:45` (the id grammar) and `:59`, with 17 consumer lines ratcheted (`tools/layers.mjs:462-469`) and more that the ratchet cannot see: the renderer's `syncAll`, `commands.js` cascades and clones, `server/anchor.mjs:48`, `server/rest.js:15`, `sync.js:385`.
- **Pipes have no id.** The incubator keys a pipe by its pair (`network/pipes.mjs:35`), but ops, `kindOf`, the id grammar and change reconciliation (`app/src/changes.js:66-87`) assume `<kind>-<6hex>`.
- **The network reads an outside pipe set,** not the model (`network/view.mjs:27-30`), so it must be reshaped before pipes can live in the document.
- **No stored link age.** B259; without it a reloaded peer falls back to id order, and routes can differ between peers.
- **Five path consumers run without a network** and would keep drawing straight: the SVG export (`server/svg.mjs` via `kernel/engine.mjs:124-138`), REST paths (`server/rest.js:96`, `:663`), `draw movers` and `draw combat` (`cli/verbs.mjs:1484-1521`), and the store's planner Model (`server/store.js:638`, `:1236`).
- **Down links still yield a straight path** (`network/resolve.mjs:53-56`), so spawners would run movers along a down link unless they ask whether it is down.
- **The planner composes no network,** and undo and redo replay stored inverses without the planner (`server/txn.mjs:711-761`), so every pipe consequence of an edit must be captured as ops at commit time.
- **The schema is pinned.** `validateDoc` refuses `schema !== 1` (`server/validate.js:396`) and silently ignores unknown top-level keys; templates and `create({doc})` skip the load-time migrations (`server/store.js:760-762`, `:826-832`).
- **The product page has no `#pipes` layer** (`app/index.html:118-130`).

### 3.4 Migration facts

- **Most legs belong to one link.** One link may not use a waypoint in two roles, two links on one pair may not bend at one waypoint, and a pair takes one straight link (`model/referential.mjs:93-147`, `model/invariants.mjs:297-303`).
- **But the rules allow a shared leg in four ways:** two links bending through one waypoint from the same end anchor (reachable in the browser: threading an occupied bend does not split it, `app/src/input.js:908-915`); a link ending at another link's bend through REST or the CLI (B243); a ring's closing leg coinciding with a straight link; and documents already over the pair capacity, which load with a report.
- **Measured on the local files** (4 templates, 12 local diagrams, the lab seeds): one pipe per consecutive stop pair gives 0 shared pipes. The live estate is not in the repository -- 21 or 38 diagrams by the records -- and must be measured by a dry run (stage P8).
- **The network ignores `closed`:** it routes `src -> via -> dst` (`network/pipes.mjs:93-107`) and the renderer closes the loop geometrically.

---

## 4. The to-state

- **A pipe is a stored entity,** `pipe-<6hex>`, with `a`, `b` and `laid` (`link` or `hand`); one pipe per pair of anchors, both of which exist.
- **Every link carries its age,** stamped once when it is made, so every peer orders links identically.
- **The network reads the document:** its view derives routes from the model's pipes and links and their ages -- the tab, the server, the CLI and the export alike, one derivation (RULESET-AUDIT T2).
- **Every edit's pipe consequences are ops in the same transaction:** the pipes a drag lays ride with its link, and the pipes an edit leaves unused are swept by the planner. So undo restores pipes with everything else, and the lab's "undo cannot move pipes" limit goes.
- **One composition everywhere:** the product page, the server's store, the CLI and REST all compose the network plugin. The Model and the planner no longer run without one.
- **The lab stays** as the place the next capability incubates, composing the same product modules.

---

## 5. The delta -- fence and anti-scope

**The fence.**\
Pipes and link ages as stored state; the network composed in every production path; the migration of every stored document; the retirement of the pre-network behaviours; the tests and gates that move with them.

**The anti-scope fence.**
- **No new routing behaviour.** What the lab does, as ruled, is what production does; a behaviour change during promotion is a separate, ruled commit.
- **No concurrent links on a pipe** and no hairpins (B256 stays held).
- **No per-diagram plugin list** (SD12, B248): a full cutover has no documents without the network, so B248 keeps its own trigger.
- **No context panel** (B265) and no runtime binding editing (DG3).
- **No other format changes** unless the director folds them in: the stored-format batch the records anticipate also names the `link.flow` rename (`dev/DECISIONS.md:897-908`), which is decided at the start (section 10).

---

## 6. Build order -- each stage provable before the next depends on it

| stage | what lands | exit criterion |
|---|---|---|
| **P0** | **Production on current `main`.** The gesture system and the fixes deploy first, so promotion starts from a production that differs from the lab only by the network | production serves `main`; the estate snapshot for P8 is taken |
| **P1** | **The network reads a model, in the lab.** `createNetwork` derives from the model's pipes and link ages instead of a session pipe set; the lab's tab and authority models hold pipes; the session's pending legs become ops in the link's own commit, and its sweep a planner cascade | the lab behaviour matrix passes, unedited; undo restores pipes (a new row); the session pipe set is deleted |
| **P2** | **The stored format.** The `pipe` kind -- id grammar, the kind lists, shape, ops, a pipe referential rule (ends exist, one per pair), validation, caps, the relations index -- and the link age, with `meta.schema` 2 | every kind list names six; a document with pipes round-trips through store, snapshot, sync, undo and the log; L7k's ratchet is re-recorded in the same commit |
| **P3** | **The server composes the network.** The store's Models and `commit` take it; the planner's null defaults, `KEEPS_ORPHAN_AS_RULED`, `NEVER_STRANDED` and `straightPath`'s fallback are deleted; the client's optimistic cascade (`app/src/commands.js:86-107`) follows the network's rules | a pin deleted over the server deletes its link, and the tab agrees before the answer arrives; no `network = null` path remains in model or planner |
| **P4** | **Every path consumer routes.** The SVG export, REST paths, `draw movers` and `draw combat` compose the network through one shared function; spawners skip down links | the five consumers of section 3.3 draw the route the tab draws, asserted per consumer on one board |
| **P5** | **The product page composes it.** A `#pipes` layer and pipe painter in the renderer, `networkInput` in Input, `/network/` served, the page closure and the incubator boundary widened in one diff | the product page draws pipes and routed links, `g` works there, and the lab root holds no network orchestration |
| **P6** | **CLI and REST for pipes.** List, add and remove; `show`, `dump`, `map`, `get` and `columnsFor` carry pipes; `SETTABLE` covers the new fields | an agent can do with pipes everything a person can (A5), held by the CLI suite |
| **P7** | **The tests move to the product.** The behaviour matrix runs against the product page as well as the lab; the gesture corpus and the tests that pinned no-network production behaviour are rewritten under the ruling | the matrix is green on the product page; every rewritten expectation cites the cutover ruling |
| **P8** | **The migration, dry-run.** A pure `migrateDoc` in the shape of `tools/migrate-version.mjs`: one pipe per consecutive stop pair (closing leg included), ages from document order, schema 2, logs truncated; templates migrated in source; run on the estate snapshot, reporting every shared leg and every link that would come up down | the dry run reports zero unexplained differences between each diagram's drawing before and after; every shared leg is listed with its disposition |
| **P9** | **The cutover.** Backup, migrate, deploy, verify, with a rollback held open across the window (W25) | every live diagram loads and draws as before; the backup restores on the old image |

Each stage is one approval, one gate, and a lab deploy; P9 is the director's deploy.

---

## 7. Binary exit criteria for the whole promotion

1. Production imports `network/`, and no production path constructs a Model or runs the planner without the network.
2. A pipe is a stored entity: it round-trips through the store, the snapshot, sync, the log, undo and redo.
3. Two peers on one document derive identical routes, including after a reload -- link ages are stored.
4. The SVG export, REST paths, `draw movers`, `draw combat` and the tab draw the same route for every link.
5. The behaviour matrix passes on the product page.
6. Every live diagram migrated, with its drawing unchanged except where section 10's shared-leg disposition says otherwise, each such case listed.
7. No pre-network behaviour remains: `straightPath` as a default, `KEEPS_ORPHAN_AS_RULED`, `NEVER_STRANDED`, and the `pinned` orphan rule are gone.

---

## 8. Risks -- found by the inventory

- **Pipe identity.** Pairs as keys do not fit ops, reconciliation or the id grammar; a pipe needs an id, and "one pipe per pair" becomes a referential rule (section 10, P-1).
- **Old undo history.** Stored inverses predate pipes and undo bypasses the planner; replaying them after the cutover would restore links without their pipes (section 10, P-6).
- **Deleting a bend deletes its link.** Production strips a bend today (`server/txn.mjs:568-580`); under the ruling of 2026-09-30 a pinned link lives and dies with its pins, and every existing `via` bend is a pin. That is the biggest change existing users will feel (section 10, P-7).
- **Shared legs.** The four cases of section 3.4 make the younger link come up down under one link per pipe; the live estate may hold some (section 10, P-4).
- **Closed rings.** The network routes `src -> via -> dst` and ignores `closed`; a generated closing pipe laid with the link would be swept (section 10, P-3).
- **Rollback.** Schema 2 files are refused by images before it (`server/validate.js:396`), so rollback is restoring the backup, not redeploying (section 10, P-8).
- **Stale tabs.** An open tab from before the cutover can post an old-format document through `create` (`app/src/sync.js:663`), which skips migration; the server must refuse or migrate it.
- **Determinism.** Routes are derived on every peer; ties are broken by sorted adjacency and age with id as the fallback (`network/pipes.mjs:48`, `:143`), and every peer must hold the same ages.

---

## 9. Coverage, verification, costs

**Coverage.**\
Proves the incubation ruling's promotion, B259 (ages stored) and the removal of the lab's session-pipe limits.\
Defers B256 (concurrency, hairpins), B248 (plugin list), B265 (context panel).

**Verification targets.**\
The behaviour matrix on both pages; a round-trip suite for the pipe kind; a parity test over the five path consumers; the migration dry run on the estate snapshot; the gesture corpus, rewritten only where the cutover ruling changes an outcome.

**Named costs and non-claims.**
- **Size, by judgement:** ten stages, larger than the gesture system, because it changes stored documents and the server. P2 (the format) and P8 (the migration) are the largest; a firmer estimate follows the start-of-work audit of the server, CLI and export, which the inventory began.
- **It changes what existing users feel:** bend deletion, down links where no way exists, and orphan anchors that go with their last link.
- **It does not add** concurrent links, flows along routes, or the context panel.

---

## 10. Decisions for the director, at the start

Each is a real fork with a recommendation, asked one at a time when the work starts.

- **P-1 -- pipe identity.** Recommended: pipes get ids, `pipe-<6hex>`, and "one pipe per pair" is a referential rule -- rather than keying pipes by their pair, which ops and reconciliation cannot carry.
- **P-2 -- where a link's age lives.** Recommended: a field on the link, stamped by the planner when the link is made, from a counter in the document -- rather than a separate ordered list, which every edit would have to keep in step.
- **P-3 -- closed rings.** Recommended: the network routes a ring's closing leg as it routes the others, so a ring is a route like any link -- rather than the renderer drawing the close geometrically.
- **P-4 -- shared legs found in the estate.** Recommended: the migration splits them into junctions (B210) so no link comes up down -- rather than migrating them as they are and letting the younger link show down.
- **P-5 -- the `pinned` waypoint field.** Recommended: retired with the orphan rule it served, removed by the migration.
- **P-6 -- undo history across the cutover.** Recommended: truncated by the migration, so history starts at the cutover -- rather than replaying inverses that carry no pipes.
- **P-7 -- bend deletion for existing users.** The network deletes a link whose pin is deleted, and every existing bend is a pin. Confirm that this ruling applies to the estate as it does to new work.
- **P-8 -- rollback.** Recommended: restoring the pre-migration backup is the rollback, accepted in advance, since older images cannot read schema 2.
- **P-9 -- the `link.flow` rename** the records place in the same format batch: fold it in, or keep it out.

---

## 11. Axiom alignment audit (M7)

**Identity:** this plan, against `fca7828`, measured against mission-kit A1-A14.\
**Verdict: pass-with-guardrails** -- with section 10 ruled before P1.

| axiom | weight | how the plan holds it |
|---|---|---|
| A2 Isomorphic Specification | load-bearing | "no legacy" removes the second behaviour production would otherwise keep beside the first, and one derivation serves every consumer |
| A1 Sovereign State Transparency | load-bearing | pipes and ages move from tab memory into the document, where every peer and agent can see them |
| A5 Perceptual Parity | load-bearing | the export, REST, the CLI and the tab draw the same route; agents get pipe verbs |
| A8 Gated Recursive Integrity | load-bearing | each stage gates the next; the migration is dry-run on the real estate before the cutover |
| A9 Chaos-Validated Deployment | load-bearing | the cutover runs with a held rollback and a verified backup (W25) |
| A3 Sovereign Composition | supporting | promotion is production importing `network/`, not a port; the lab keeps incubating |
| A13 Director Intent Amplification | supporting | nine start-of-work decisions, asked one at a time; the rest is mechanised |
| A4, A6, A7, A10, A11, A12, A14 | not materially implicated | |

**Tensions.**
- **"No legacy" against rollback (A2 against A9).** Without a legacy mode, the rollback is a restore rather than a switch. Resolved by P-8: the backup is verified before the cutover and restoring it is rehearsed in P8.
- **A full cutover against user continuity.** Bend deletion and down links change what existing users feel. Resolved by P-4 (no link comes up down through migration) and P-7 (the director confirms bend deletion for the estate).

**Guardrails.**
- No stage lands with a behaviour change the cutover ruling does not cover; the lab matrix and the gesture corpus are the proof at every stage.
- No production path may construct a Model or run the planner without the network once P3 lands.
- P9 does not start until the P8 dry run has zero unexplained differences.

**Closeout hooks.**\
Re-check section 7's criteria; the estate's migration report; the parity test over the five path consumers; the matrix on the product page.
