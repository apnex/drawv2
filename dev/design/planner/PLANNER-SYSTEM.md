# The planner as a sovereign system -- a neutral transaction core, declared reactions, one preview (DESIGN, awaiting approval)

> **Tier 3 -- a design of record, proposed.** Written 2026-09-30 against `a030e98`.
> Facts about today's code are measured and cited by file and line; judgements are marked as such.
> APPROVED 2026-09-30: PD-1 to PD-4 and PD-6 as recommended; PD-5 ruled before PL-6 (`dev/DECISIONS.md`).
> Built one stage at a time (section 9), validated in the lab; no production deploy until the director says.

## 1. Status

- **Asked for:** the director, 2026-09-30: "The "planner" - as a sovereign system with a dedicated duty - what is it? is it well scoped, and should its interfaces and seams be adjusted in a similar way to the programme we made for input/gestures?"; approved as recommended the same day, after transit's X4 ("then we can progress as recommended").
- **Tracked:** BOARD H17.15. It folds the H17 cuts that touch the planner: K3, K13c, K17 and K18 (`dev/design/h17/PLAN.md`).
- **Builds on:** the stack rulings SD1, SD2 and SD11 (`dev/DECISIONS.md`), the network interface (RULESET-AUDIT T1), the Rules system's neutral core (`kernel/input-rules.mjs`, `dev/RULES.md` section 11) and the gesture system's method (`dev/design/input/GESTURE-SYSTEM.md`).
- **Proposes; decides nothing.** Section 12 lists what only the director can settle, one at a time.

---

## 2. What the planner is

`server/txn.mjs` is the system's one write.\
Every edit -- a browser gesture, a key, a REST call, a CLI verb, undo, redo -- arrives as a request; the planner validates it, works out its consequences, applies them as one transaction, and records the inverse so undo can reverse it exactly.\
It is pure: `plan()` works on a projection, so a refused request touches nothing (the file's header, lines 1-26).

**Its core is sound,** and the design keeps it: one write path for every door; planning as a pure function of the pre-state; inverses computed where the pre-state is known; undo and redo as replays of recorded inverses.

---

## 3. Where it stands -- measured at `a030e98`

### 3.1 Size and shape

| function | lines | code lines |
|---|---|---|
| `plan` | 109-403 | 98 of 295 |
| `planOne` / `planPut` / `planSet` / `planDel` | 405-600 | 98 of 143 |
| `commit` | 604-705 | 52 of 102 |
| `undo` / `redo` | 725-775 | 35 of 50 |

### 3.2 What `plan()` does, in order

| step | lines | kind |
|---|---|---|
| request shape (1..2000 ops) | 115-117 | core |
| projection | 118-120 | core |
| the op loop: `place` resolution, validation, put / set / del | 129-135, 405-438 | core, edge, validation |
| per-op consequences inside put and del: group member stealing (B82); a node's links deleted; a waypoint's links deleted or stripped, with the straight-pair rule (B81); groups trimmed | 466-600 | reactions (groups: product; links: network) |
| stranded links deleted whole (network hook `isStranded`) | 145-153 | reaction |
| orphan sweep of bends (B162, B216, B241; hooks `alsoReferenced`, `keepsOrphan`) | 175-243 | reaction |
| two links left at a waypoint joined (B215, B222, B239, B240, B269; hook `joinsAt`) | 273-375 | reaction, with a validation inside |
| rule backstop: no new violation (B81 etc.) | 389-401 | validation |

**The consequences are fixed passes in a fixed order, and the order is meaning:** stranded runs before the sweep (a stranded link frees its bends to be swept) and before the join (a stranded link's ends become join candidates); the sweep and the join each apply as they go (B240, B241).

### 3.3 What is mixed into it

- **Link-network rules,** in core code: the node and waypoint cascades, the B81 strip, the sweep, the join, the stranded pass. SD11 and SD11b rule that "the rules that react to edits" belong to the network plugin, and K13c already plans to move the sweep and the join.
- **Four hooks for one plugin** -- `alsoReferenced`, `keepsOrphan`, `isStranded`, `joinsAt` (line 99) -- each a question asked beside a fixed pass, and each new network capability adds one: transit's X4 added the fourth today.
- **Placement** for the CLI's `place` op (`server/anchor.mjs`), not injected (K3), and resolved a second time inside the CLI itself (`cli/verbs.mjs:1176-1190`).
- **Presentation:** beats and the reveal (H14) inside `commit`, with `Date.now()` read three times (lines 679, 683, 689) in a file whose header says "no timers".
- **Validation inside a reaction:** the join refuses itself through `validateMutation` (B239, line 343).

### 3.4 A hand-written copy in the browser

The browser builds the delete cascade, the B81 strip and group stealing itself, for its optimistic view (`app/src/commands.js:63-156`; its own comment: "a LOCAL PROJECTION ... the server's planner re-derives the same cascade").\
Because the browser sends those consequences as explicit ops, the planner's own cascade finds nothing left to do for a browser request: the browser's copy decides, and the planner only judges.\
SD2 rules the opposite: "the browser runs the same rule code to show the result at once, then takes the server's answer".\
The junction split exists only in the browser (`app/src/input.js:970-1018`, B243, K18a).

### 3.5 Defects found by the inventory

- **B270:** a commit refused for its caption has already changed the document -- the check comes after `applyOps` and the version bump, and no record is written (verified).
- **B271:** a partial repair of an existing violation is refused, because the backstop compares sentences that embed counts (verified).
- Smaller, recorded for the stages that touch them: the reveal comment says "only CREATED entities" and the code takes every `put` (line 641); undo restores the reveal but `reversalBody` never sends it (`server/protocol.js:197-209`); the join is triggered only by a link `del`, never by a `set` that removes a waypoint reference (line 275, inferred); `store.js` imports `plan` and `validateMutation` and uses neither (lines 12, 21).

### 3.6 The safety net it has

About 100 tests drive `plan`, `commit` and `undo` directly and about 200 through the store; `tests/diff-plan.test.js` runs 1000 seeded single-op mutations against a frozen pre-CS1 planner.
**What it lacks:** the differential is single-op, builds links between nodes only -- so the sweep, the join and the stranded pass are never reached -- and predates them; and there is no recorded corpus of requests and their exact results.

---

## 4. What the design must do

| id | requirement | from |
|---|---|---|
| PR1 | The transaction core knows no entity rules: shape, version, apply, inverse, log, undo, redo, and nothing about links, waypoints or groups | A3; the director's question |
| PR2 | An edit's consequences are declared reactions brought by tenants -- the product for groups, the network for links -- never fixed passes in the core | SD11, SD11b, K13c |
| PR3 | A new network capability adds a reaction, not a hook in the core | the four hooks of section 3.3 |
| PR4 | Every refusal is decided before the document is touched | the header's purity promise; B270 |
| PR5 | Placement and presentation are edges passed in, not core code | K3; section 3.3 |
| PR6 | The browser previews with the same code the server runs, and keeps no copy of any rule | SD2, K18b |
| PR7 | Every door gives the same document for the same act, splits included | SD2, K18a, B243 |
| PR8 | Undo stays byte-identical: whatever a reaction does is reversed exactly | the log's contract |

---

## 5. Prior art -- recalled, not re-verified in this session

| system | what it separates | lesson |
|---|---|---|
| Kubernetes admission | mutating webhooks run first, in a declared order and may be re-invoked; validating webhooks run after, and only refuse | **consequences and refusals are two phases**, and a consequence never refuses (B239 mixes them) |
| database triggers and `ON DELETE CASCADE` | cascades declared on the schema, run inside the transaction | consequences belong beside the data they follow, and run inside the same atomic step |
| Rails callbacks | `before_*` / `after_*` hooks on models | the cautionary tale: implicit callbacks whose order nobody can see -- so reactions must be listed, ordered by declaration, and generated into a readable table |
| Redux reducers and middleware | a pure reducer per slice; effects outside it | the core stays pure; effects (time, presentation) live at the edge |
| event sourcing | the log is the truth, the document a fold of it | already this system's undo: records hold ops and inverses, and replay is exact |

**What the design takes:** two phases, consequences then refusals; reactions declared and ordered by declaration, never by registration; the core pure and the edges outside it.\
**What it does not take:** re-invocation until nothing changes (Kubernetes) -- a fixed, declared sequence of phases is enough here and is easier to reason about (A11).

---

## 6. The design -- five parts

The parts, and how a request passes through them:
```
EDGES        placement resolver, beats/reveal          passed in (K3); a record extension around the core
CORE         request -> plan -> apply -> record        pure planning; owns every inverse; knows no entity rules
  phase 1    the requested ops, each validated
  phase 2    REACTIONS, phase by phase, applied as they go
  phase 3    REFUSALS: the document rules on the result
TENANTS      product: groups        network: links, waypoints, pipes   each brings reactions and rules
PREVIEW      the browser runs the same plan() for its optimistic view
```

### 6.1 The transaction core

Neutral, in the sense of P4 and of `kernel/input-rules.mjs`: it names no kind.\
It checks the request's shape and version, runs the three phases on a projection, applies the result in one step, and records it.
**It owns every inverse:** a reaction returns ops, and the core computes their inverses from the projection as it applies them -- so no tenant can write an inverse wrong, and undo stays exact (PR8).\
**Every refusal comes before the apply** (PR4, fixing B270), including the caption check, which moves into phase 3.

### 6.2 Reactions

A reaction is a declared row, in the shape the Rules engine uses:
```
{ id, owner, phase,
  on(change, before, after) -> candidates     what in this edit it reacts to
  run(candidate, doc) -> ops                  what follows; ops only, never an inverse }
```

**Phases are declared, in order** -- for example `cascade`, `stranded`, `sweep`, `join` -- so today's meaningful order is data a reader can see, and a generated table documents it (as `GESTURES.md` does for the drag grammar).
**Within a phase, reactions are disjoint:** two reactions proposing different changes to one entity in one phase is a gate failure, the same rule Q3 set for input (decision PD-3).\
**Applied as they go,** as the sweep and the join already are (B240, B241), so each reaction sees the ones before it.\
The four network hooks disappear: `isStranded`, `keepsOrphan`, `alsoReferenced` and `joinsAt` become conditions inside the network tenant's own stranded, sweep and join reactions (PR3).

### 6.3 Document rules -- refusals

Phase 3 runs the document rules on the result: the per-kind validation, the referential rules, and the invariants.\
**It compares violations, not their sentences** (fixing B271): a violation is identified by its rule and its subject, and a transaction is refused only for a violation it introduced or worsened.\
The kind and shape tables arrive by injection (K17), so the pipe kind of promotion is a table, not a code change.

### 6.4 Edges

- **Placement** is passed in (K3); the CLI sends its intent and stops resolving positions itself.
- **Beats and the reveal** become a record extension: the core hands it the applied ops, it returns the reveal and its inverse, and the clock is passed in, not read.

### 6.5 One preview

The browser plans its own optimistic view with the same `plan()`, composed with the same tenants (SD1, SD2, PR6): it sends only what the author did -- "delete this node" -- and shows the planner's consequences at once.\
The hand-written copies in `app/src/commands.js` and the browser-only junction split are deleted; the split becomes a network reaction every door runs (PR7, K18a).
**What it needs first:** ids the planner mints must be derivable, so the preview and the server mint the same ones -- H17-D10 already rules this for a cut's pieces.

### 6.6 Production and the network before promotion

Production composes no network plugin today, yet runs link rules (the cascades, B81, the B162 and B216 sweep, the join).
**Recommended (PD-2):** two alternative link tenants -- production's classic link reactions, and the network plugin's -- each composition choosing one, never both, so no reaction ever overrides another (B262 stays held).\
Promotion, a full cutover with no legacy (`dev/design/unification/PROMOTION.md`), deletes the classic tenant.

---

## 7. Invariants

Each falsifiable, each with a test before the stage that relies on it lands.

- **PL1 -- the core names no kind.** A scan of the core's text finds no kind name, as for the Rules engine.
- **PL2 -- a refused request touches nothing:** document, version and log are identical after a refusal, for every refusal path.
- **PL3 -- reactions return ops only;** every inverse is the core's, and undo after any transaction restores the pre-state exactly.
- **PL4 -- phases run in declared order,** and within a phase no two reactions change one entity.
- **PL5 -- consequences never refuse;** refusals happen only in phase 3.
- **PL6 -- one preview:** for every request, the browser's optimistic result equals the server's answer, ids aside where H17-D10 does not yet derive them.
- **PL7 -- every door, one document:** a split, a cascade, a sweep or a join comes out the same from the browser, REST and the CLI.

---

## 8. Acceptance tests

1. B270 and B271 fixed, each RED first.
2. A planner corpus -- recorded requests with their exact ops, inverses and refusals, across every rule the planner holds, with and without the network -- replays identically through every restructuring stage.
3. The differential widened: multi-op transactions, links through waypoints, so the sweep, the join and the stranded pass are reached.
4. The core's text names no kind (PL1).
5. A new reaction lands with no edit to the core.
6. The network's four hooks are gone from `PLANNER_READS`, their behaviour held by the corpus.
7. The browser's `deleteSelection` cascade, its B81 strip and its group stealing are deleted, and the gesture corpus records the browser sending intent only.
8. A link landing on a bend is split the same whether it comes from the browser, REST or the CLI.

---

## 9. Build order -- each stage approved, gated, and deployed to the lab

| stage | what lands | exit criterion |
|---|---|---|
| **PL-0** | **The two defects.** Every refusal before the apply (B270); violations compared by identity, not sentence (B271) | each RED first; nothing else changes |
| **PL-1** | **The planner corpus**, and the differential widened | the corpus replays; the differential reaches the sweep, the join and the stranded pass |
| **PL-2** | **The core owns every inverse.** Per-op planners and passes return ops only | every corpus inverse byte-identical |
| **PL-3** | **Reactions and phases.** The engine; the passes and per-op cascades become reactions of a classic link tenant, a group tenant, and the network tenant; the four hooks go | the corpus replays identically; PL1, PL4, PL5 held |
| **PL-4** | **Edges.** Placement injected (K3), the CLI's own resolver removed; beats as a record extension with the clock passed in | the corpus replays; the core reads no clock |
| **PL-5** | **Kind and shape tables injected** (K17) | every kind list reads from the tables; the corpus replays |
| **PL-6** | **One preview.** The browser plans its own view; the hand-written copies go; the junction split becomes a reaction (K18a, B243) | PL6 and PL7 held; the gesture corpus records intent only, as ruled |

Stages PL-1 to PL-5 change no outcome, and the corpus proves it.\
PL-0 fixes two defects; PL-6 changes what the browser sends, which the director rules before it lands (PD-5).\
DONE 2026-10-01: PL-0 (`2ebb619`, H17.16 and H17.17).\
DONE 2026-10-01: PL-1 -- `tests/fixtures/planner-corpus.mjs` and its golden file, replayed by `tests/planner-corpus.test.js`.\
CLARIFIED 2026-10-01: the differential's oracle for PL-2 to PL-5 is the corpus itself -- the planner's answers at `2ebb619` -- not the frozen pre-CS1 planner of `tests/diff-plan.test.js`, which is single-op and has no stranded pass, sweep or join to compare.\
That test stays as it is.\
The corpus holds 84 named cases (42 rules in each composition) and 1000 seeded multi-op requests per composition, over boards with waypoints, junctions, groups, pipes and transit.\
Measured reach over the generated requests: production sweep 45 and join 38; network stranded 96, sweep 145, join 34, join declined 50.\
The test holds floors under those, and seven planner mutants each fail it.\
CLARIFIED 2026-10-01: undo is checked to restore every entity, with each collection compared sorted by id, because a restored entity is appended to its collection -- B10, registered and held, whose fix is an explicit order field.\
So "byte-identical" in PR8 and PL-2 means per entity, not per collection order, until B10 is revived.\
DONE 2026-10-01: PL-2 -- `inverseOf` and `track` in `server/txn.mjs`: every op reaches the projection through `track`, which records its inverse from the state just before it; the per-op planners, the cascades, the stranded pass, the sweep and the join return ops only.\
All 2084 corpus results replay unchanged, inverses included, and a structural test in `tests/txn.test.js` holds one writer of inverses.\
DONE 2026-10-01: PL-3 -- the core in `server/txn.mjs` runs declared phases (`clear`, `follow`, `stranded`, `sweep`, `join`) of reactions brought by tenants, and names no kind (PL1).\
The link reactions are `model/link-reactions.mjs`, built into a tenant by `linkTenant` with each tenant's own conditions: production's classic tenant and the groups in `server/tenants.mjs`, the network's in `network/network.mjs`.\
The four hooks are gone; the network passes `{ links: network.links }`, and the retired `network` option is refused.\
A delete's `clear` reactions run wherever the delete comes from -- a request, the waypoint cascade or the sweep -- which is how the sweep's group trim (B241) now arrives, with no second copy.\
The corpus replays all 2084 results unchanged, plus one named case added and checked against the pre-PL-3 planner (an unchanged group put that still steals).\
Six mutants of the engine and tenants each fail a test, and `dev/design/planner/REACTIONS.md` is generated from the rows by `tools/reaction-table.mjs`, which the gate checks.\
CLARIFIED 2026-10-01: a link tenant's conditions -- strands or not, what else references an anchor, which orphans are kept, where links join -- are arguments its author passes to `linkTenant` at composition, so the core asks a plugin nothing (PR3).\
DONE 2026-10-01: PL-4 -- the edges are passed in: `place` (the store passes `server/anchor.mjs`, K3), `now` (the store passes its own injected clock) and `extensions`, the record extensions run around each commit.\
Beats and the reveal are `BEATS` in `server/edges.mjs`: a caption refusal before the apply, the next reveal after it, and the core records any extension's field with its inverse and restores it on undo and redo, in the record shape stored logs already hold.\
The core reads no clock, resolves no anchor and names no reveal, and a test holds all three; the planner's closure lost `server/anchor.mjs`, and the lab no longer serves it.\
`draw place` sends the relationship every time and reads the position from the server's answer, so its own copy of the resolver is deleted; the two had the same order, occupancy rule and tie-breaking, so where a node lands did not move.\
The corpus replays all results unchanged; six mutants each fail a test; B272 (a paced commit hides an entity it only changed) was found reading the moved code and is registered, held.\
AMENDED 2026-10-01: B272 fixed at the director's word (H17.18): a beat reveals only the entities its commit created, read off the plan -- a put whose inverse is a delete.
**These are production code paths:** every stage is gated and deployed to the lab; the production deploy stays the director's call.

---

## 10. Risks -- from the inventory

- **Order is meaning.** Declared phases must reproduce today's sequence exactly; the corpus, written first, is the check.
- **Inverses move.** The core computing inverses must be byte-identical with the hand-built ones (PL-2 does nothing else).
- **Validation inside a reaction** (B239): moving it to phase 3 changes when a failed join is skipped versus refused -- measured in PL-1, ruled if it differs.
  MEASURED 2026-10-01 (PL-1): of 1000 generated production requests, 41 leave a join undone, and in only 2 of them is it the B239 validation that declines it; the rest are declined by `collapseAtWaypoint` itself, which is a shape rule, not a refusal.\
  The named cases `join-declined-duplicate-bend` and `join-declined-self-conflict` hold the B239 skips.\
  So moving that validation to phase 3 would turn about 2 in 1000 accepted deletes into refusals; PL-3 keeps them skips, and the corpus holds that.
- **The browser's requests change in PL-6,** which changes log records, the gesture corpus, and what reconciliation treats as an echo.
- **Hooks see different models today:** the live model in one call, an un-networked projection in another; reactions must see one projection, consistently.
- **Production and the lab differ in link rules** until promotion; two tenants keep that honest, and a gate test proves no composition holds both.

---

## 11. Axiom alignment audit (M7)

**Identity:** this design, against `a030e98`, measured against mission-kit A1-A14.\
**Verdict: pass-with-guardrails.**

| axiom | weight | how the design holds it |
|---|---|---|
| A3 Sovereign Composition | load-bearing | a core with one duty; reactions brought by the tenant that owns their meaning; hooks replaced by composition |
| A2 Isomorphic Specification | load-bearing | one preview: the browser and the server run the same code, and the hand-written copies go |
| A8 Gated Recursive Integrity | load-bearing | the corpus and the widened differential gate every stage |
| A11 Cognitive Minimalism | load-bearing | declared phases instead of re-invocation; one engine shape shared with input rules |
| A1 Sovereign State Transparency | supporting | the reaction table, generated, shows every consequence an edit can have |
| A5 Perceptual Parity | supporting | every door gives the same document (PR7) |
| A4, A6, A7, A9, A10, A12, A13, A14 | not materially implicated | |

**Tensions.**
- **Q3 against reactions.** Input rules allow one row per input; many reactions rightly fire for one edit. Resolved by phases: order between phases is declared, and within a phase reactions must be disjoint per entity.
- **A2 against PL-6's cost.** One preview changes what the browser sends. Resolved by ruling it separately (PD-5), after the core is proven.

**Guardrails.**\
No stage lands without the corpus replaying identically; a behaviour change is its own ruled commit.\
No reaction may write an inverse.\
No composition holds both link tenants.

**Closeout hooks.**\
PL1-PL7 by their tests; the corpus and the widened differential; the generated reaction table; the count of rule copies left in the browser, which should be zero.

---

## 12. Decisions for the director

- **PD-1 -- scope and order.** Stages PL-0 to PL-5 (two fixes, then restructuring with no outcome change), then PL-6 ruled separately. Recommended.
- **PD-2 -- production and the network before promotion.** Two alternative link tenants, each composition choosing one, the classic one deleted at promotion -- rather than one tenant keeping today's hooks as policies. Recommended.
- **PD-3 -- reactions that collide.** Phases in declared order; within a phase, two reactions changing one entity fail the gate -- rather than the later one winning. Recommended, in the spirit of Q3 and held as Q3 is: for now.
- **PD-4 -- who writes inverses.** The core, from the projection, for every op a reaction returns -- rather than each reaction writing its own. Recommended.
- **PD-5 -- one preview.** PL-6 after PL-5, with derived ids for minted entities (H17-D10) -- rather than at the production rebuild, as H17-D11 deferred it. To be ruled before PL-6.
- **PD-6 -- beats and the reveal.** A record extension around the core, the clock passed in -- rather than staying inside `commit`. Recommended.
