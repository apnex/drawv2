# PLANNING-POSITION -- draw's opening position on planning a change: entity-graph, entity-store, shape-check and draw (H31-1, its H31.7)

> **Sent to zorg with `drawv2-planning-boundaries-proposal.md` by the director's decision, 2026-11-10 (draw's `dev/DECISIONS.md` H31-3).**
> **TIER 3 -- ANALYSIS AND POSITION.**
> Signed: the H31 planning-position agent, a read-only subagent; the recorder saves the record and owns it.
> Dated: 2026-11-10.
> Every placement, resolution, estimate and preference below is this agent's judgement for draw's side of a negotiation; none is ruled.
> Draw's position is sent only after the director's ruling on it (draw's `dev/DECISIONS.md` H31-1, amended: "one ruling per move").
> Built on `DRAW-SIDE.md` sections 1-3 and 7, `COMPONENT-SIDE.md`, `COMPARISON.md` sections 1-4 and `REASSESSMENT.md` (in `~/taceng/drawv2-eval-runs/h31-reuse/`, outside draw's repository, readable on the shared machine), re-read against the code and records at the pins below.
> Brief: `drawv2-eval-runs/h26-builds/H31-PLANNING-POSITION.md`.
> The letter built on it: `drawv2-planning-boundaries-proposal.md` (this folder).

Notation, stated once:
- `[M]` measured: read in a cited file, or produced by a named command; `[I]` inferred, with its basis; `NOT-CLAIMED` where neither.
- Code lines are draw's own counter, a line holding anything but comments and whitespace (`tools/code-split.mjs:6-7`).
  Per-file figures are its exported `codeLines` run over each file; per-function figures are the same function run over line ranges cut at function boundaries, so a slice that cuts a statement can overcount by a few lines (one file's slices summed to 155 against its true 145) [M, method].
- Component figures are the same counter run over each component's `src/*.ts` at its pin; TypeScript-only lines are counted as code, which is what draw's ledger does for a vendored release (`tools/code-split.mjs:10-11`) [M, method; the ledger reads release source maps, which do not exist yet].
- No test, gate or server was run; no repository was changed; `git fetch` was not run.

Pins, each widened by `git rev-parse` [M]:

| Repository | Revision read | How |
|---|---|---|
| drawv2 | `cf8825dc25fe327f1119cec57d6d6f82f93ffff2` (HEAD; `git status --short` empty) | working tree; its planner, model, engine, plugins and tests are identical to `a11e317`, where `DRAW-SIDE.md` was read, but for one line of `tests/generate-architecture.test.js` [M, `git diff --stat a11e317 HEAD`] |
| entity-graph | `e765ac9399618345a424602197390101261139ae` | `git show origin/main:<path>`; equal to `git ls-remote origin main` today [M] |
| entity-store | `d7f17972d3d8cde72ef562958e2df61e4c50b0a7` | same |
| shape-check | `a4f4e2891cfe3ee45c7bc15cac09b0382b90dca4` | same |
| mission-kit | `c82c9f6a9bd1e5d7e1b52235837b5c436565fa85` | same |
| zorg | `42cb345917677c40c7169774f4c83f35837d2d8b` | same |

---

## 0. The frame, and what the records already say about this move

- The director's frame: components serve every project; a gap is pressure; draw's bespoke mechanisms move into the right component and draw keeps declarations; boundaries are negotiable when the move makes a component more valuable; one capability at a time, planning a change first (draw `dev/DECISIONS.md:2492,2494-2502`) [M].
- entity-graph was drawn from draw's planner: its D1 names `engine/ivm.mjs`, `engine/relations.mjs`, `planner/txn.mjs` and `model/invariants.mjs` as the proof of a domain-neutral mechanism (`entity-graph docs/DECISIONS.md:18-21`) [M], and D2 records that draw runs ordered phases, not a fixed point, and validates each requested op in order before judging the result (`:39`) [M].
- zorg parked entity-graph as `BL33` with the trigger "`drawv2`'s refactor onto the component set reaches its in-memory entity graph and transaction planner" (`zorg docs/BACKLOG.md:42`) [M]; H31-1 is that trigger firing [I].
- zorg's D33 already shaped entity-store's change log for draw: "the change log's record holds a list of writes ... an operation making a change of several is added when a consumer needs it", because draw "changes several entities in one request, all or nothing, as one version and one undo step" (`zorg docs/DECISIONS.md:707-711`) [M]; the code's `ChangeRecord.writes` is a list (`entity-store src/store-types.ts:239-249`) while every operation writes one (`src/entity-store.ts:330`) [M].
- mission-kit's `0117` lets draw keep its planner meanwhile if it records its requirement against entity-graph's contract, does not grow it into a variant, and moves once entity-graph is usable (`mission-kit docs/DECISIONS.md:2260-2263`) [M]; draw has not yet recorded it (`COMPARISON.md` section 3) [M, there].

---

## 1. The capability, decomposed in draw

What "planning a change" is in draw, cut into its mechanisms.\
**Mechanism** means any entity application would need it; **product** means draw's own meaning (what a link, a pipe, a node, a grid is).\
**Declarable** marks a product rule that a general mechanism could carry as data rather than code.

| # | Mechanism | Where | Code lines [M] | Mark |
|---|---|---|---:|---|
| 1 | Ops and their application: `put`, `set`, `del`, applied by one function, each copied so nothing aliases the wire | `model/ops.mjs:27-50`; `planner/txn.mjs:100-109` (`track`) | 20 + 10 | mechanism |
| 1b | The `meta` op: the document's name and plugin list | `model/ops.mjs:53-57`; `planner/txn.mjs:530-540` | 4 + 10 | product |
| 2 | The scratch projection: plan against a copy, so a refusal touched nothing ("rejection safety is by purity") | `model/model.mjs:34-38`; the Model's `get/all/put/set/del` and change spine `:137-189` | 5 + 37 | mechanism |
| 3 | The change set (TG-1, TG-1b): each touched entity's `before`, `after`, changed `fields`, and `into` for an absorbed delete | `planner/txn.mjs:111-152` | 31 | mechanism |
| 4 | The reaction graph: declared phases, triggers as data (TG-2), tenant and refusal rows validated at composition, dispatch index by kind (TG-4), per-op `clear`/`follow`, transaction phases once each, PD-3 claim rule | `planner/txn.mjs:154-191,212-213,244-301,328-376,392-402` | 106 | mechanism |
| 4b | Which phases exist and their order ("the order is meaning", `planner/txn.mjs:208`) | `planner/txn.mjs:212` | 1 | product data |
| 5 | References and their reverse index: incidence and gathering over one incremental-view skeleton | `engine/relations.mjs:41-51,54-97`; `engine/ivm.mjs:19-48`; `engine/store.mjs:59-69`; `model/model.mjs:215-222` | about 45 + 27 + 12 + 8 | mechanism |
| 5b | Cell occupancy (which anchor sits on which grid cell) | `engine/relations.mjs:33-39,52,98-103` | about 25 | product (geometry) |
| 5c | Reference detection: any string field whose id prefix names a referenced kind | `engine/relations.mjs:45-47` | 3 | draw convention, to be replaced by declared reference fields |
| 6 | Cascades: a delete runs `clear` before it applies, a put runs `follow` after | `planner/txn.mjs:362-369` | in row 4 | mechanism |
| 6b | Cascade rules: `node-links`, `pipe-cascade`, `group-trim`, `group-steal` | `plugins/network/link-reactions.mjs:40-51`; `plugins/network/network.mjs:124-129`; `plugins/groups/group-rules.mjs:31-69` | about 11 + 5 + 30 | product, **declarable** (cascade-delete, unlink with a minimum, steal) |
| 6c | Cascade rules with draw conditions: `stranded-links`, `orphan-sweep` | `plugins/network/link-reactions.mjs:115-150,205-265` | about 16 + 25 | product, partly declarable (cascade on a pin's loss; delete a target left unreferenced) |
| 6d | Draw's own consequences: `waypoint-links`, `transit-cut`, `junction-cut`, `size-change`, `link-legs`, `link-join`, `pipe-sweep` | `dev/design/planner/REACTIONS.md:29-48` (generated table) | most of 361 rule lines (`DRAW-SIDE.md` section 3) | product |
| 7 | Cross-entity invariants as facts `{ key, measure, sentence }`, asked of each row; refusal only of what an edit introduces or worsens (B271) | `model/invariants.mjs:40-58,92`; `planner/txn.mjs:423-448` | 9 + 8 | mechanism |
| 7b | The invariants themselves: straight-pair capacity (B81), no node in two groups (B82), two distinct members (B85), one occupant per anchor (B112) | `plugins/network/link-kind.mjs`; `plugins/groups/group-kind.mjs`; `model/invariants.mjs:60-90` | B112 9; the rest inside the rows | product; B82 and B85 **declarable** (exclusivity, a minimum of distinct targets) |
| 8 | Reaction writes held to the rules a requested write meets, introduced-only (B302) | `planner/txn.mjs:403-421` | 10 | mechanism |
| 9 | Inverses (PL-2): taken from the projection just before each op, in the one place an op reaches it; a `set` introducing a key inverts to a whole `put`; narrowing so a no-op is detectable; undo and redo replay stored inverses | `planner/txn.mjs:47-109,542-551,630-686` | 79 | mechanism |
| 10 | Record extensions (B270): a field recorded with its inverse beside the ops, its refusal decided before the apply | `planner/txn.mjs:569-578,584-610`; `planner/edges.mjs:15-28` | about 13 | mechanism |
| 10b | `BEATS`: which created ids a paced commit reveals, the caption limit, the schedule | `planner/edges.mjs:30-104` | about 26 | product |
| 11 | The version and `expect`: version minted per accepted transaction, undo and redo included; `expect` refused on mismatch; the document stamped from the log (D6) | `planner/txn.mjs:553-568,580-583,599-628` | 32 | mechanism |
| 12 | The undo log: cursor, redo tail, bounds by count and bytes, never the last record, a floor at the newest human record that yields at 4x | `planner/log.mjs` | 80 (about 70 mechanism) | mechanism |
| 12b | Who counts as human (`by === 'client'`) and the numbers 100 / 32 KiB / 4x | `planner/log.mjs:28-32,76,84-89` | about 10 | product policy |
| 13 | Field and kind validation: one entity against its row's field checks; a mutation merged over the stored entity and handed to the row's `refers`; the document path running the same `refers` | `planner/validate.js:104-166,243-279` | 18 + 22 + 29 | mechanism (shape: 18; references and op validation: 51) |
| 13b | Kind composition: rows checked and merged once, extensions owned field by field | `model/shape.mjs:152-245` | 91 | mixed: graph declaration, shape declaration, and draw's own row facts (`selectable`, `named`, `anchor`, `needs`, `always`, `collection`) |
| 13c | The kind rows' checks, references, caps and invariants | `plugins/*/*-kind.mjs`, `plugins/devices/device-fields.mjs`, `product/kinds.mjs` | 293 (link 50, pipe 31, group 49, zone 41, layout 33, device fields 58, product 31) | product declarations, already about half declarative (`tools/code-split.mjs --parts`: plugins 21-65%) |
| 13d | Document-door validation: document ids, principals, meta allowlist, selection, reveal, the log tolerated, the meta patch | `planner/validate.js:1-103,168-242,287-365` | about 104 | product (draw's document and access) |
| 14 | The `place` op: an op resolved against the projection as the ops before it left it, rewritten into the `put` it would have been | `planner/txn.mjs:459-477` | 8 | mechanism (the seam) |
| 14b | The resolver: which free anchor a relationship names; and a creation's drawing order (F-d) | `server/anchor.mjs` 82; `planner/txn.mjs:495-513` about 8; `model/order.mjs` 6 | 96 | product |
| 15 | Request bounds: `MAX_OPS` 2000, label grammar, per-kind cap | `planner/txn.mjs:42,45,493` | in rows 1 and 13 | mechanism, with draw's numbers |

**Totals [M, sums of the table's figures].**
- The modules the move touches hold 1,086 code lines: `planner/txn.mjs` 377, `planner/edges.mjs` 29, `planner/log.mjs` 80, `planner/validate.js` 173, `model/invariants.mjs` 18, `engine/relations.mjs` 70, `engine/ivm.mjs` 27, `engine/store.mjs` 12, `model/model.mjs` 164, `model/ops.mjs` 24, `model/shape.mjs` 112.
- Of `planner/txn.mjs`, about 355 are mechanism and about 22 product (the `meta` op, F-d's drawing order, the `meta` inverse, the label grammar); its segments sum to 377 exactly.
- The parts at HEAD: `planner` 677, `relations` 109, `document` 210, `kind-contract` 124 (`node tools/code-split.mjs --parts` at `cf8825d`) [M].

**What the decomposition shows [I].**
- Draw's planner core is already neutral in the sense entity-graph needs: it names no kind (PL1, `dev/design/planner/PLANNER-SYSTEM.md:176`), and every rule arrives on a row.
- The product half is three things: rules a general reference vocabulary could state as data (rows 6b, 7b), conditions and consequences only draw can state (rows 6d, 7b's B81 and B112, the three refusal rows), and draw's document envelope (rows 1b, 13d).
- One thing draw does is a convention, not a rule: reference detection by id prefix (5c); a component needs references declared field by field, and draw should declare them.

---

## 2. Where each mechanism belongs

By each component's own vision and duty.

| # | Mechanism | Belongs in | By what | Draw's argument for every consumer |
|---|---|---|---|---|
| 1 | Ops and their application | entity-graph (plan) and entity-store (land) | C15 "an edit is any set of creations, changes and removals asked for together" (`entity-graph VISION.md:37`); C4 positioned writes (`entity-store CONTRACT.md:37`) | Every consumer gets one write vocabulary across plan, land and undo. |
| 2 | Scratch projection | entity-graph | C15 "planning changes no answer" (`CONTRACT.md:40`); design input "a scratch projection" (`CONTRACT.md:60`) | Already its design input. |
| 3 | Change set | entity-graph | C15 "a caller can see everything an edit would do" (`VISION.md:38`) | Consequences, refusals and undo all read one record of what changed; zorg's reactions get it free. |
| 4 | Reaction graph, triggers as data, dispatch index, PD-3 | entity-graph, with phases allowed for application consequences (section 3, T4) | C15 "any consequence of its own that the reference rules cannot express" (`CONTRACT.md:38`); mechanism open (`VISION.md:75`, D2) | Triggers as data make each consequence's reach readable and indexable; the dispatch index makes an edit's cost follow the kinds it touched, which is C15's Leanness (`VISION.md:152-154`); PD-3 makes conflicting consequences fail in a test, not silently. |
| 4b | Phase names and order | draw, as declaration | "Not the owner of meaning" (`VISION.md:95-96`) | -- |
| 5 | Reverse index (incidence, gathering) | entity-graph | C15 "who refers to what" (`VISION.md:31`); design input incremental indices (`CONTRACT.md:66`) | Already its design input; `ownerOf` in its candidate surface (`CONTRACT.md:70`) is draw's `gathererOf`. |
| 5b | Cell occupancy | draw, over snap-grid (C11) | C15 "Not the owner of geometry" (`VISION.md:119-122`) | -- |
| 6 | Cascade order (clear before delete, follow after put) | entity-graph | C15 "with all its consequences" (`VISION.md:36`) | -- |
| 6b, 6c | Cascade rules | entity-graph's reference options, as data on draw's kinds | Design input `onTargetDelete`, `exclusivity: steal`, `minTargets` with `onBelowMin` (`CONTRACT.md:62`) | **One new option**: a target that lives only while referenced is deleted when its last referrer lets go (draw's `orphan-sweep`, B162). Any application with dependent sub-records (bend points, attachments, tags) gains it. |
| 6d | Draw's consequences | draw, as pure functions on its kinds | C15 seam: "a condition or consequence declared on the kind" (`mission-kit components/C15-entity-graph.md:49`) | -- |
| 7 | Invariant facts and introduce-or-worsen (B271) | entity-graph | C15 "No edit may leave a rule more broken than it found it" (`VISION.md:29`); design input `{ key, measure, sentence }` (`CONTRACT.md:63`) | Answers its cold-reading question "how much a rule is broken is measured" (`CONTRACT.md:84`) with a working answer. |
| 7b | The invariants | draw's conditions; B82, B85 as reference options | mission-kit C15 adjustment policy step 2 names draw's own straight-link capacity as the example of a condition on a kind (`C15-entity-graph.md:102`) | -- |
| 8 | B302 | entity-graph | C15 "Agreement": the same edit gets the same result on every path (`VISION.md:139-141`) | **Not in C15's records** [M, `COMPARISON.md` section 3]. A consequence that writes what a request could not is the defect B301 shipped in draw; every consumer with consequences needs the guard. |
| 9 | Inverses, narrowing, undo and redo replay | entity-graph | C15 "can be undone exactly" (`VISION.md:43-45`); design input PL-2 (`CONTRACT.md:64-65`) | Already its design input. |
| 10 | Record extensions | dissolved: document-level state as singleton entities, written by a consequence that reads an **edit context** | C15 consequences are the application's (`CONTRACT.md:38`) | A context the caller attaches to an edit (draw: `pace`, `caption`, the commit time) and consequences read lets any consumer stamp edit-level facts without a second record path; draw's B270 machinery goes. |
| 11 | Version and `expect` | entity-store | C4 "every change has one place in one order" (`VISION.md:15`) and "refuses ... a write ... that would overwrite a change its author never saw" (`VISION.md:52`) | **Adjustment**: an expected *position* on a change, refused if the store has moved; any reader acting on a whole view (an agent, a planner) gains a complete guard, and it answers C15's question "which entities an edit's guards cover" (`CONTRACT.md:77`) for one host. |
| 12 | Undo stack (cursor, redo, bounds) | entity-graph's `reversible-history`, its records durable in entity-store (T2) | C15 design input "a bounded undo and redo stack" (`CONTRACT.md:65`); C4 "Not an archive" (`VISION.md:84-86`) | An application-stated bound with an application predicate that pins records gives every multi-actor consumer draw's human floor (I14) as a declaration. |
| 13 | One entity's shape | shape-check (C3) | C15 "Not a judge of one entity's shape" (`VISION.md:91-93`); C3's north star (`VISION.md:15`) | **Adjustment**: dialect 2 with `minimum`, `maximum`, `uniqueItems` (JSON Schema's names), since dialect 1 never changes (`shape-check CONTRACT.md:55`); every consumer bounding a number or a set gains. |
| 13 | References and op validation | entity-graph | C15 `graph-declaration` (`CONTRACT.md:38`) | -- |
| 13b | Kind composition | split: C15 graph declaration, C3 shapes (also C4's kinds, `entity-store src/store-types.ts:309-310`), draw's row facts | -- | One shape per kind judged identically by C3 in draw's validation and by C4 on write: C3's Agreement (`VISION.md:83-85`). |
| 13d | Door validation | draw | -- | -- |
| 14 | The `place` seam | entity-graph: an **intent resolver**, an application function that rewrites an op into writes against the scratch view as the edit's earlier parts left it | C15 "Choosing where anything sits belongs to the application" (`VISION.md:122`); its question "how an entity created within an edit is named" (`CONTRACT.md:86`) | Draw has two uses in the planner today (placement; a creation's drawing order, `planner/txn.mjs:495-513`) and a candidate third (the next free name, minted outside the planner at `model/model.mjs:262-268`); any consumer allocating names or sequence numbers inside one edit gains it. |
| 15 | Request bounds | entity-graph with application numbers | -- | -- |

**General mechanisms the current boundary puts nowhere, or in draw.**
- B302 (row 8), the orphan rule (6c), the edit context (10), the intent resolver (14): nowhere in C15's records [M, grep of `CONTRACT.md@e765ac9` for `B302`, `place`, `orphan`, `context`: no hit for the first three; `context` only in its edges].
- Expected position (11): nowhere in C4; C4 has per-entity `expectedRevision` only (`entity-store src/store-types.ts:40-53`) [M].
- PD-3 (4): nowhere in C15 [M, `COMPARISON.md` section 3].
- A durable home for undo records (12): nowhere; C15 says whatever it keeps "is never the record" (`VISION.md:87-89`), and C4 keeps writes' after-states only (`src/store-types.ts:224-228`) [M].

---

## 3. The tensions, and draw's proposed resolutions

### T1. Who holds the order of changes

- Draw: one `Log` per diagram mints `version`, +1 per accepted transaction including undo and redo (`planner/log.mjs:7-10`; `docs/spec/TRANSACTIONS.md:286-294`, D6).
- entity-store: one position per change in one order (`VISION.md:24-27`).
- entity-graph: answers dated by "the store `position`" (`CONTRACT.md:39`); it requires a store that orders (`VISION.md:70`).
- **Resolution.** One order, the store's: draw's `version` becomes the diagram store's position; entity-graph dates its view and its plans by it; a commit lands with the planned-from position as its expected position, so a stale plan is refused, as `version conflict` is today (`planner/txn.mjs:562-564`).
- entity-graph declares its store as a **port** shaped by C4's capabilities, C4 the reference provider; draw satisfies it with its own `Log` and `Store` until OD-1 (B344), as `0117` allows, so the planning move does not wait on the storage migration (`REASSESSMENT.md` move 2).
- Cost: C4, an expected-position write (additive); C15, a port in place of a named dependency in `positioned-graph-sync`; zorg, none at run time [I]; draw, an adapter of about 40-60 lines while OD-1 is open [I].

### T2. Who holds undo

Three candidates hold a piece of it today:
- draw's bounded ring with a human floor, which appends no record on undo (`planner/log.mjs:15-32`; `docs/spec/TRANSACTIONS.md:259-265`, D3);
- entity-store's history, kept to a time bound of 1 ms to 365 days for catch-up and "not an archive" (`src/store-types.ts:305-306`; `VISION.md:84-86`);
- entity-graph's undoable edits, where "an undo is an edit like any other" (`VISION.md:44`).

**Resolution, in four parts.**
1. **The order: entity-store.** Every undo and redo lands as a change with a position, as draw's version already rises on both (D6). Draw gives up D3's "no record": the log becomes the store's timeline, and the undo stack a structure over it.
2. **What an undo restores: entity-graph.** Each inverse is derived at plan time from the state just before its write (PL-2, `planner/txn.mjs:93-109`), the only place the before-state is held (`:13-15`).
3. **Where the inverse is kept durably: entity-store.** **Adjustment**: a change may carry an application note, opaque plain JSON within a stated size, kept with the change, served by `changes`, and forgotten with it at the history bound. entity-graph keeps its inverse there, so it keeps no record of its own (`VISION.md:87-89`). draw keeps its label and actor there; zorg could keep a reason. Undo then survives a restart, as draw's does today (D1, `docs/spec/TRANSACTIONS.md:236`).
4. **The undo stack and its bound: entity-graph's `reversible-history`.** It holds the cursor, the redo tail and `undo(to)` (D21). The bound is stated by the application by count and bytes, with a predicate that pins records: draw's floor at the newest human record (I14) becomes a declaration.

**Replay or re-plan.**
- Draw's undo replays the stored inverse; it does not plan it again or run reactions (`planner/txn.mjs:659-666`).
- That is exact by construction under global undo (D2, `docs/spec/TRANSACTIONS.md:246-257`): every write passes through the one log and undo reverses only the top applied record, so an inverse always meets the state its change left.
- entity-graph is "not a gate on other writers" (`VISION.md:102-104`), so a change can land by another path.
- Draw proposes: an undo is an edit for landing (whole, positioned, guarded by expected position) and for judging (refusals and invariants on the result); its consequences are already in the inverse, so it is not expanded again.
- If something landed since that the stack does not account for, the expected position refuses the undo; `expect` is already mandatory on undo (`docs/spec/TRANSACTIONS.md:370-380`, D14).

Cost:
- C4: an optional note on change records, which may change its log format (NOT-CLAIMED whether v1 logs read unchanged).
- C15: the undo row gains its replay clause.
- zorg: none unless it adopts undo [I].
- Draw: the `history` door reads store changes; D3 is superseded by ruling.

### T3. Who judges a single entity's shape, and who judges rules between entities

- C3 judges a value against a shape and owns no refusal but fit (`shape-check VISION.md:71-74`, `CONTRACT.md:192-197`).
- C15 judges "what lies between entities" (`VISION.md:91-93`).
- Draw's rows mix single-field checks (`fields`), cross-field and cross-entity checks (`refers`), whole-set rules (`invariants`, `cap`) (`model/shape.mjs:101-109`).
- **Resolution.** Draw's single-field checks become C3 shape fragments per kind, which C4 also enforces on write (one shape, two judges, one verdict).
  Coordinates and counts need dialect 2's `minimum` and `maximum`; B85's distinct members need `uniqueItems`.
  Everything else is a C15 condition: draw's cross-field rules on one entity (a self-link, a transit the node's type does not offer) are conditions whose scope is one entity, which C15 applies without understanding, as its adjustment policy routes a rule "where a shape cannot state it" to the application (`mission-kit C15-entity-graph.md:102`).
- Cost: C3, dialect 2 (additive; dialect 1 untouched); C15, conditions of any scope beyond shape; zorg, none [I].

### T4. Where a consequence engine stops and product reactions begin

- C15's design input expands consequences to a fixed point (`CONTRACT.md:61`); draw runs declared phases in order, per op and per transaction, with PD-3 (`planner/txn.mjs:193-213`), and chose not to re-invoke until nothing changes (`dev/design/planner/PLANNER-SYSTEM.md:109`).
- **Resolution, a hybrid.** Declared reference rules (cascade-delete, unlink, steal, a minimum, the orphan rule) are order-free and monotone, so C15 expands them to a fixed point, which terminates because each step removes something [I].
  Application consequences run once each in application-declared phases, in order, each seeing the writes before it, under PD-3; their writes are fed back to the declared rules.
  This is `ON DELETE CASCADE` beside ordered triggers, the prior art draw's own design names (`PLANNER-SYSTEM.md:102-104`).
- It answers two of C15's cold-reading questions: cycle termination and the order consequences apply in (`CONTRACT.md:81`).
- Cost: op order inside a change record can differ from draw's golden while the resulting state is identical (section 6); C15 carries both forms; zorg's `BL33` names "delete/unlink/steal/minimum-member cascades, pure per-kind reaction ... hooks" (`zorg docs/BACKLOG.md:42`), both halves.

### T5. Per-op validation against judging by resulting state

- Draw validates each requested op against the projection as the ops before it left it, then judges invariants on the result (`planner/txn.mjs:384-391,456-489`); 301 of the corpus's 397 refusals name an op, 96 the whole request [M, read from `tests/fixtures/planner-corpus.json`].
- C15 judges an edit "by the state it would leave, never by the order of its steps" (`VISION.md:28`).
- **Resolution.** Draw adopts result-state judging for references: a batch that creates a node after the link that names it is accepted, which is better for agents writing batches [I].
  Application faults stay per op (a `set` on an absent entity, 128 refusals [M]; an unknown op) because they are not rule judgements.
  The refusal still names the part of the edit (C15's Legibility, `VISION.md:148-150`), which is draw's `opIndex`.
- Cost: some corpus refusals become acceptances; the count is NOT-CLAIMED until replayed; each is a ruled difference (section 6).

### T6. Where a refusal's wording lives

- C3 returns misfit records `{ pointer, keyword, expected, fit }` (`CONTRACT.md:114`); C4 the shared refusal form `{ part, code, what, why, fix, details }` (`src/store-types.ts:191-200`), which zorg holds as one convention (`zorg capability-overlaps.md:25`); C15 owes "what a refusal carries, in full" (`CONTRACT.md:83`); draw answers one English sentence and `opIndex` (`planner/txn.mjs:377-386`).
- **Resolution.** Components return facts in the shared form; the words are the application's, as C3's own vision says even of a misfit (`VISION.md:74`).
  C15's refusal carries the rule key, the subject, the measure, the part of the edit, and, for an application condition, the condition's own sentence verbatim.
  Draw renders its sentences from those facts, so its agents, its CLI's three rewordings (`cli/verbs.mjs:323-352`) and its corpus see no change.
- Cost: C15, a refusal record in the shared form; draw, an adapter of about 15-25 lines [I].

### T7. Where the view lives

- Draw's index is attached only in the page and the lab; the server scans (`engine/store.mjs:2-7`; `model/model.mjs:117`); the page plans with the same `plan()` for its preview (`PLANNER-SYSTEM.md:158-162`, PL6).
- **Resolution.** C15 runs synchronously, in memory, in a browser as on a server (its design input, `CONTRACT.md:67`); whether the server holds indices is C15's choice if its memory per graph is stated (Leanness), measured at up to 500 diagrams (`server/store.js:78`).
- Draw's flexibility: it takes server-side indices if the figure is small; the preview must run the identical planner.

### T8. Document-level state and record extensions

- Draw's `meta` op and the reveal are document state, not entities (`model/model.mjs:99-115`); the reveal moves with undo through a record extension (`planner/edges.mjs:15-24`).
- **Resolution.** Name and plugins become a singleton entity of a draw kind, the reveal another, written by draw's beat consequence from the edit context (T2's note carries no state); their inverses are ordinary.
  Owner and grants stay outside planning, since undo must never restore revoked access (`planner/validate.js:89-98`); selection stays draw's status.
- Cost: draw rewrites `BEATS` as a consequence; C15 gains the edit context (section 2, row 10).

### T9. Identity across undoing a deletion

- C4 mints `e<position>.1` (`src/entity-store.ts:355`), so recreating a deleted entity cannot restore its identity (C15 D6, `docs/DECISIONS.md:112`).
- **Resolution.** Draw's ids (`node-1a2b3c`) become C4 names, which fit `^[a-z0-9][a-z0-9-]{0,62}$` (`src/entity-store.ts:66`) [I for every id form, pipe ids included]; C15 references by name; an undone delete recreates the name.
  Every consumer that names its own entities gets exact undo; one that does not keeps C4's ids and accepts the open question.

### T10. One component or three (C15 D5)

- Draw's evidence for one: the inverse is taken inside `track`, the same function that notes the change set (`planner/txn.mjs:100-109`), and the change set feeds both consequences and refusals; a planner split from undo would split that one place.
- Draw does not ask for a ruling here; the design effort holds D5 (`docs/DECISIONS.md:88-90`).

---

## 4. What moves out of draw, and what draw keeps

Estimates [I], built on the measured lines of section 1.

| Module | Lines [M] | Out | To | Stays as |
|---|---:|---:|---|---|
| `planner/txn.mjs` | 377 | about 355 | C15 about 330; C4 about 25 (version, `expect`, record) | the `meta` op as a singleton kind, F-d as a resolver: about 22 |
| `planner/edges.mjs` | 29 | 2 | C15 | `BEATS` as a consequence: about 27 |
| `planner/log.mjs` | 80 | about 70 | C15 (stack), C4 (durable record) | the floor predicate and numbers: about 10 |
| `model/invariants.mjs` | 18 | 9 | C15 | B112 as a condition: 9 |
| `engine/relations.mjs` | 70 | about 45 | C15 | cell occupancy: about 25 |
| `engine/ivm.mjs` | 27 | 27 | C15 | -- |
| `engine/store.mjs` | 12 | 12 | C15 | -- |
| `planner/validate.js` | 173 | about 55 | C3 18; C15 about 37 | door validation about 104, the C3 adapter about 15 |
| `model/model.mjs` | 164 | about 40 | C15 (projection, writes, change spine, gathering scan) | a facade the canvas reads, selection, ids, names: about 124 |
| `model/ops.mjs` | 24 | about 20 | C15 | the `meta` application: 4 |
| `model/shape.mjs` | 112 | about 45 | C15 declaration, C3 shapes | draw's row facts and their composition: about 67 |
| **Total** | **1,086** | **about 680** | | **about 406** |

**What draw writes.**
- Reference rules as data on `link`, `pipe` and `group`: about 20-30 lines, replacing about 60 lines of rule logic (rows 6b, 7b's B82 and B85, the existence checks in `refers`).
- The refusal adapter (T6) and the store-port adapter over its `Log` while OD-1 is open (T1): about 55-85 lines.
- Shape fragments per kind for C3: about 40-80 lines of data in place of predicates (`REASSESSMENT.md` section 3, C3).

**What draw keeps, ideally as declarations.**
- Kind rows: their shapes as data, their reference rules as data, their draw facts (`selectable`, `named`, `anchor`, `always`).
- Conditions: straight-pair capacity (B81), one occupant per anchor (B112), self-link, transit offered by type, the three refusal rows.
- Consequences: `waypoint-links`, `transit-cut`, `junction-cut`, `size-change`, `link-legs`, `link-join`, `pipe-sweep`, `stranded-links` and `orphan-sweep`'s draw conditions, `BEATS`, as pure functions on their kinds.
- Resolvers: placement (`server/anchor.mjs`), drawing order, and the next free name if it moves inside an edit.
- Policy: phase names and order, the undo bound's numbers and its human predicate, `MAX_OPS`.
- Its document envelope and doors: ids, principals, meta allowlist, selection, access.

**Projected `dev/CODE-SPLIT.md` effect [I].**
- At HEAD: draw running 14,941, vendor 4,141, vendor share 21.7% (`node tools/code-split.mjs --row` at `cf8825d`) [M].
- Planning move (C15 and C3 taken; draw's own store behind the port): draw running down about 600 net (about 655 out, about 55-85 written), to about 14,340. Vendor up by shape-check (560 lines of `src/*.ts` [M]) and entity-graph (no code; 800-1,500 inferred from draw's about 680 lines of JavaScript mechanism plus types and refusal records), to about 5,500-6,200. Vendor share about 28-30%.
- With OD-1 (C4 taken): entity-store adds 1,882 lines of `src/*.ts` without its contract suite, 3,331 with it [M]; whether a release's source maps ship the suite is NOT-CLAIMED. Vendor share about 34-40%, before any storage code leaves draw.
- By part (`--parts`): `planner` 677 to about 190, about 118 of it door validation that belongs with `store` (`tools/layers.mjs:1061-1063`, tagged `serves-a-server-door`); `relations` 109 to about 25; `document` 210 to about 150; `kind-contract` 124 to about 80.
- The declarative share rises a little, as rule logic in the network and groups plugins becomes data.

---

## 5. Draw's non-negotiables and its flexible points

**Non-negotiable: behaviour draw's people and agents depend on.**

| Behaviour | Held by today |
|---|---|
| An edit of 1 to 2,000 ops lands whole or not at all, as one version and one undo step; above 2,000 it is refused before any write | `planner/txn.mjs:42,317-319`; `tests/txn.test.js:168-175` [M]. No test commits an accepted 2,000-op edit (grep) [M]; the 2,000-op record is exercised by the log (`tests/persist.test.js:292-300`). |
| Undo of a whole commit restores every entity it changed, consequences included; redo; `undo {to: seq}` | `tests/planner-corpus.test.js:43-46`; D21 `planner/txn.mjs:637-647` |
| A stale `expect` is refused and nothing is written; `expect` is mandatory on undo and redo | `planner/txn.mjs:562-564`; `docs/spec/TRANSACTIONS.md:370-380` |
| A refused edit touches nothing and names the part that failed | PL2, `PLANNER-SYSTEM.md:177`; `planner/txn.mjs:377-386` |
| The preview is the commit: the page runs the identical planner | PL6, `PLANNER-SYSTEM.md:181` |
| No automatic rule commits what a request could not (B302) | `planner/txn.mjs:403-421` |
| Conflicting consequences never pick a silent winner (PD-3) | `planner/txn.mjs:353` |
| A partial repair is allowed (B271) | `planner/txn.mjs:444-447` (C15 shares it, `VISION.md:29`) |
| A person's last change stays undoable while agents write (I14) | `planner/log.mjs:19-25` |
| The corpus's semantics, as section 6 defines "passes" | `tests/planner-corpus.test.js` |

**Flexible: what draw would change to meet a better shared design.**
- A fixed point for declared reference rules (T4), if the corpus passes at level 2.
- Op order inside a change record, if state and undo are exact.
- Undo as a positioned change rather than a cursor move with no record (T2, superseding D3).
- The undo bound's numbers (100 records, 32 KiB, 4x), for any count-and-bytes bound with a pinning predicate.
- Judging references by resulting state rather than per op (T5), each flipped case ruled.
- Indices held on the server (T7), if memory per diagram is stated and small.
- Record extensions replaced by singleton entities and an edit context (T8).
- Draw's ids used as store names (T9); references declared field by field in place of id-prefix detection (5c).
- Refusal words drawn from structured facts (T6), or C15's words where draw's sentence has no consumer.

---

## 6. Acceptance

**The oracle [M].**
- `tests/fixtures/planner-corpus.json`: 1,044 cases, 44 named and 1,000 generated, 647 accepted and 397 refused; the largest accepted plan holds 25 ops (read from the golden file).
- Refusals by kind: `set` on a missing entity 128; straight-pair capacity 61; self-link 48; a link end that does not exist 67; a via waypoint that does not exist 21; a group too small 21; a group member that does not exist 19; two links bending at one waypoint 16; one anchor occupied twice 8; B302 5; an unknown field 1; an unknown op 1; the op count 1.
- The 132 planner tests (`DRAW-SIDE.md` section 3; re-counted per file at HEAD, same total).
- The corpus stores each accepted plan's exact `ops` and `inverse`, and each refusal's exact `error` and `opIndex` (`tests/fixtures/planner-corpus.mjs:309-336`); undo restores is judged with collections sorted by id (B10, `:300-307`).

**What "passes" means.**
1. **Level 1, exact**: the golden file as it stands.
2. **Level 2, equivalent**: the same verdict per case; the same `opIndex`; for an accepted case, the same resulting document compared as undo already is, sorted by id, with undo restoring it; for a refused case, the same rule key and subject, draw's sentence rendered by draw's adapter.
3. **A semantic difference** is any case outside level 2. It is listed by case id with both results and its cause (for example T5 accepting what per-op validation refused). It is ruled by the director under H31-1, and the golden is re-frozen in the same commit, citing the ruling. Never silently: the corpus's own rule is that "a stage that changes a result has changed behaviour, and must say so and be ruled" (`tests/planner-corpus.test.js:6-7`).
- The reach floors stay (`tests/planner-corpus.test.js:53-72`), so a pass that stopped firing fails.
- Draw's expectation [I]: T4 moves op order (level 1 fails, level 2 holds); T5 flips some refusals to acceptances (ruled differences); T6 keeps every sentence if the adapter holds.

**The corpus offered upstream.**
- It uses draw's words (`link`, `pipe`, `node`), and C15 builds in no kind (`VISION.md:21`) and holds no vocabulary allowance (`REASSESSMENT.md` section 2, S6).
- So it runs in draw's gate against each entity-graph release, a consumer-side oracle.
- Draw also contributes a neutral corpus to entity-graph: the mechanism its named cases exercise (cascade, unlink with a minimum, steal, partial repair, PD-3, B302, undo restoring), restated over neutral kinds, written by an agent other than C15's implementer, as shape-check's corpus is (`shape-check CONTRACT.md:143-149`).

---

## 7. Knock-on for zorg and others

As far as zorg's records show.

| Where | Change | Effect on zorg |
|---|---|---|
| entity-store | multi-item `change` | The form D33 shaped for (`zorg docs/DECISIONS.md:707-708`); additive; zorg's single-write operations unchanged [I]. |
| entity-store | expected position on a change | Additive [I]. |
| entity-store | an optional note on a change | Additive in the API; it may change the change-log format (`src/store-types.ts:239-249`), so zorg's stored hub logs would need to read as before; NOT-CLAIMED until designed. |
| entity-api (C6) | carry the multi-item change and its note | C6's host half gains an operation; a 2,000-write change meets AGP's message size, where C4 already sends at least one whole change per page over 512 KiB (`entity-store src/entity-store.ts:484-512`) [M]; whether AGP carries it is NOT-CLAIMED. |
| shape-check | dialect 2 | Additive; dialect 1 untouched; no zorg change [I]. |
| entity-graph | contract rows amended (store port, undo replay clause, refusal form, edit context, intent resolver, orphan rule, B302, PD-3, phases for application consequences); requirements recorded under *Design owed* | No code and no consumer yet (`mission-kit C15-entity-graph.md:16-18`); zorg's `BL33` is parked, so no zorg product code changes today [M, `BACKLOG.md:42`]. |
| mission-kit | C15 entry restated to match; C4 entry's `historyBound` (count or duration, `C4-entity-store.md:36`) against the code's `historyMs` | Draw does not need the count form once undo lives in C15; the disagreement is the C4 owner's to settle under C15 D4 [I]. |
| zorg `capability-overlaps.md` | C15's refusal joins `actionable-refusal`'s shared form (`:25`) | A convention zorg holds; no code [I]. |
| zorg `capability-overlaps.md` | the repeated-write seam (`:43`) | Draw's `txnId` replay (`server/store.js:113-120`) maps onto C4's write identity at OD-1, not in this move [I]. |

**Order [I].**
1. Record draw's requirements under C15's *Design owed* (`0117` term one), with the zorg agent's agreement on wording.
2. C3 dialect 2 and C4's two additions (multi-item change, expected position) are small and serve any consumer; they can land before C15 has code.
3. C15's design, with draw's corpus in draw's gate and the neutral corpus upstream.
4. Draw's planner onto C15 over its own store.
5. OD-1 later, bringing C4 under C15's port.
