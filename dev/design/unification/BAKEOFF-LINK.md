> **Landed 2026-09-25 in `dev/design/unification/` (uncommitted).** The three models, the shared suite and the judges' probes are session-scratch files and are not preserved in the repository; their results are recorded here.

# Link bake-off: evidence report

This report sets out the evidence for one decision: what a LINK is, relative to the units below it (anchors and adjacencies) and above it (relations and flows).
It reports the three judges' verdicts. It adds no recommendation of its own.

**Labels.**
- **MEASURED** means someone ran it, and the source is named.
- **INFERRED** means it was reasoned and nothing ran it.
- A builder's or judge's claim is attributed to them. "Reporter" marks what I checked myself.

**What the reporter checked (MEASURED, 2026-09-25):**
- **Shared suite.** I re-ran suite 1.1.0 on the three model files (`spec/harness.mjs --out` into the scratchpad).
  - Pass/fail/observed/not-expressible: FR1 27/0/11/0, FR2 27/0/11/0, FR3 26/1/11/0.
  - 0 of 38 statuses differ from the measurer's run.
  - The model sha256 prefixes match the measurer's provenance: FR1 `2dbb8401b922a9d0`, FR2 `a2120554ad48461b`, FR3 `c166c84c51d2923e`.
- **Judge probes.** I re-ran `judge1/probe2.mjs`, `judge2/probe.mjs` and `judge2/probe2.mjs`. Each output is byte-identical to the saved stdout.
- **Migration figures.** I summed `judge3/migrate.out.json`: FR3 and FR1 flow paths agree on 105+1+10+55 = 171 of 171 flows, with 97 routed in each. The per-template link and role figures quoted in section 5.4 match that file.
- **Not re-run by me:** `measure/measure.mjs`, the builders' probes and mutants, FR3's `difftest.mjs`, `judge1/probe.mjs` (I read its saved output) and `judge3/migrate.mjs`. Their numbers are as their authors report them. The authors MEASURED them.
- **Product repo.** In `/home/apnex/taceng/drawv2`, `git status --porcelain` prints 0 lines and HEAD is `d54869e`.

---

## 1. The question and the three frames

**The question.** Is a link:
- a stored record, as today;
- something derived from stored adjacencies (pipes); or
- a declared entity routed over stored adjacencies?

Each answer has consequences for roles (endpoint, bend, junction), for identity and configuration, for relations (parallel, aggregate, multiplex) and for flow paths.

**De-anonymisation.** The judges scored anonymised frames: **A = FR3, B = FR1, C = FR2**.
This report uses FR labels throughout, with the judges' letter in brackets where it helps.

Sources for the table: the builders' design notes, which are their reading of their own code. Code lines were MEASURED by the measurer. Special-case counts are the builders' own lists.

| | FR1, the control (judges' B) | FR2 (judges' C) | FR3 (judges' A) |
| --- | --- | --- | --- |
| In one line | A link is a stored record, as today | A link is derived from stored pipes | A link (a "cable") is declared, then routed over stored pipes |
| What is stored | nodes, waypoints, links `{id,name,src,dst,via?,parallel?}`, relations, flows, `nextId` | anchors, pipes `{a,b}` plus paint, flows, relations; arrays in canonical order | anchors, pipes `[a,b]` (at most one per pair), cables `{id,ends,via,name}`, relations, flows, `seq` |
| Below the link | Anchors. A `via` is geometry absorbed into the link | Pipes. A link is a maximal chain through anchors that "continue": a bare anchor with exactly two pipes to two different neighbours | Pipes. A cable keeps its declared via while every pipe on it exists. Otherwise it re-paths through bend-permitting anchors, and failing that it is DOWN |
| Keeping the document consistent | Today's SPLIT (a new link ending at a bend cuts the passing link) and COLLAPSE (removing a leg merges two links). Both are stored writes | Nothing is maintained: links, roles and refs are all derived | Re-path, DOWN and retraction are derived. No maintenance writes |
| Roles | Today's waypointRoles, applied to every anchor: 3+ terminations is a junction, 1-2 an endpoint, threaded only a bend | Continues: bend. 3+ pipes: junction. Anything else: endpoint | Facts about cables: one cable ends there, endpoint; 2+ end there, junction; one passes through, bend |
| Identity and configuration | Link id and name live on the record. A split keeps them on the src-side piece; a collapse keeps the inbound link's id | Refs are pipe addresses. Configuration is paint on every pipe of the link; the link reads the value its pipes agree on, and a disagreement reads null with `conflicts` | Cable id and name. Ids are never reused |
| Above the link | Relations over link ids. Flows route over the link graph and may turn only where links end | Relation membership is paint. Flows route over pipes by link hops, then drawn length, then anchor sequence | Relations over cable ids, and an aggregate counts as one logical link. Flows route over logical links with the same `best()` function that routes cables |
| Special cases declared by the builder | 4 | 8 | 5 |
| Code lines in `model.mjs` | 386 | 351 | 265 |

---

## 2. The scenario suite

Suite 1.1.0 has 38 scenarios: 27 ASSERT and 11 OBSERVE (MEASURED).
An ASSERT rests on a ruled or director-stated basis. An OBSERVE records behaviour where the record is open, contested or silent, and cannot fail.

**Validation (MEASURED by the spec author).**
- The null model gave 38 of 38 `not-expressible`, all of class `unimplemented`.
- A smoke model gave 27 pass and 11 observed.
- Every expectation from the deliberately broken copies (mutants) was met.
- The smoke model and the suite share one author. So this shows the suite runs and its ASSERTs can fail. It is not evidence about any frame.

### 2.1 ASSERT scenarios (27)

| Scenario | What it asserts | Basis |
| --- | --- | --- |
| `series-bends` | One connection drawn through bends is one connection, and its bare via anchors are bends | RULED DECISIONS.md:238-239; DS7 "series" |
| `junction-three-way` | Three connections ending at J make a junction. Deleting one makes J a bend, with nothing reconfigured | RULED DECISIONS.md:231-233 |
| `relation-parallel-links`, `relation-aggregation`, `relation-multiplex` | Each relation can be constructed and queried | DS7 (director requirement, hedged "I think"); DS12 |
| `flow-first-proof` | The exact path s1,r1,j1,r2,s2 | Round-2 Q5; DS2 |
| `determinism-equal-cost` | One document, loaded into a model that ran a different history, gives the same path | DS1, Q5, AX2; PS219's separating test |
| `determinism-reload` | The same, via `load()` at a second door | DS1; PS219 |
| `repair-reroute-retract-heal` | A flow reroutes, is retracted but kept, and heals | Round-2 Q4 (director pick) |
| `repair-heal-by-undo` | Undo restores a routed flow | RULED undo exactness (TRANSACTIONS I3-I5) together with DS1 (one document gives one derivation) |
| `permission-router-never-bend` | A router is never a bend and never appears in any connection's `through` | RULED DECISIONS.md:239, :260, :331 |
| `permission-server-endpoint-alone` | A second link to a server is REFUSED and writes nothing | RULED DECISIONS.md:240, :251-253; TRANSACTIONS I1 |
| `undo-*` (13 scenarios) | Undo restores `stored()` exactly, with array order significant. The 13 are addAnchor, addAnchor-typed, connect, connect-via, setName, remove-connection, remove-anchor, connect-to-bend, junction-collapse, parallel, aggregate, multiplex and remove-segment | RULED DECISIONS.md:159-161; TRANSACTIONS I3/I4 |
| `undo-refused-leaves-no-step` | A refusal writes nothing and leaves no undo step | TRANSACTIONS I1 |
| `undo-chain` | N undos return to the start | TRANSACTIONS I5 |

### 2.2 OBSERVE scenarios (11)

| Scenario | Why it is not asserted |
| --- | --- |
| `pass-through-two-way` | The record classifies this case three ways (C1; REALITY-MAP 3.4) |
| `bend-to-junction` | DS7's "converts it to a junction" is labelled a leaning (S15), and the question is open under a cable model (S16, PS212). It was demoted from ASSERT in review R1 |
| `crossing-at-anchor` | PS205 is open; DS8 is a "for now" leaning |
| `flow-endpoint-removed` | Q4 is silent on a deleted src or dst (PS221) |
| `lag-member-loss` | Intent-silent (PS110's separating test) |
| `permission-server-multiplicity` | The ruling and the DS7 requirement conflict and are unresolved (PS307, PS111) |
| `identity-name-under-junction` | PS217's hard case: a connection is cut |
| `identity-names-under-join` | PS217: two connections are joined |
| `repair-segment-removed` | The director's Q4 check question, "delete a pipe and watch a link ... re-path?", has no recorded answer |
| `undo-flow` | PS220 is open: is a flow a selection or a declaration? |
| `one-way-door` | AX6 was touched by no pick; the measures are heuristic |

### 2.3 Suite choices a frame could dispute

These come from the spec author (ADAPTER.md sections 11 and 13).
- **`junction-three-way` stays an ASSERT.** For FR3 this is a real conflict between the ruling and the frame, and the review kept it.
- **Server refusal is asserted from the 09-22 ruling,** even though Q4's option "refuse the change" was not picked (F9, PS324).
- **Routers.** Only "never a bend, never in `through`" is asserted. Whether a connection drawn through a router is refused or cut is only recorded (PS308).
- **Undo is compared with array order significant,** so a difference in order alone still fails.
- **Contract choices:**
  - `connectionRef` is opaque and stable only until the next mutation.
  - `remove` takes `{anchor|connection|segment}`.
  - A refusal is distinct from not-expressible.
  - `roleOf` returns one role, with junction over endpoint over bend.
  - Connections have no direction.
  - The permission table is fixed to router, server and compute.
  - Aggregate members must share both ends.
- **Visualisation is UNRUNNABLE here.**

### 2.4 Review changes that affected frames (1.0.0 to 1.1.0)

MEASURED by the spec author unless marked.
- **R1.** `bend-to-junction` moved from ASSERT to OBSERVE. Under 1.0.0 an FR3-shaped mutant (`bend-stays-bend`) failed it.
- **R2.** The determinism check across a reverse insertion order is now recorded, not asserted. As an ASSERT it penalised frames that mint ids in insertion order (FR1, FR3), while FR2 passed by construction.
- **R3.** `undo-chain` addressed a connection by its ends, which an FR2-shaped probe could not satisfy. It now addresses it by a segment.
- **R4.** The router check now tests the property, not only the label.
- **R6-R8.** Added: segment removal, `crossing-at-anchor`, and names under a join.
- **R10.** The server-multiplicity peers were retyped to `router`, to remove an artefact of the suite (INFERRED).
- **R12.** A frame that refuses a landing on a passing point now has that refusal recorded; it no longer makes the scenario not-expressible.

---

## 3. Results side by side (the neutral measurer's re-run)

These counts were MEASURED by the measurer and reproduced by me. The builders' own result files agree in all 38 statuses.

| | pass | fail | observed | not-expressible |
| --- | --- | --- | --- | --- |
| FR1 | 27 | 0 | 11 | 0 |
| FR2 | 27 | 0 | 11 | 0 |
| FR3 | 26 | 1 | 11 | 0 |

**ASSERTs.** All 27 pass in FR1 and FR2, and 26 pass in FR3.
FR3 fails `junction-three-way` at the check "after deleting one of the three, J is a bend": the actual role is `junction`.
Two cables still end at J, and FR3 does not merge them automatically. The stored diff is the one removed cable.

**OBSERVE results (MEASURED; from the notes in `measure/suite/<FRn>.json`):**

| Scenario | FR1 (B) | FR2 (C) | FR3 (A) |
| --- | --- | --- | --- |
| `pass-through-two-way` | Drawn directly: two links, and W is an endpoint. Left behind by deleting a junction leg: one link via W, and W is a bend. Role, shape and stored form all differ by history | Both ways: one link A-W-B, W is a bend, and the stored form is byte-identical | Both ways: two cables, and W is a junction. The stored form differs because an orphan pipe is kept |
| `bend-to-junction` | A..B is split at W. W becomes a junction, matching the DS7 leaning. Flow A->C is routed | Three derived links. W is a junction (matches). A->C is routed. One pipe is written | A..B keeps passing W, and W is an endpoint (does not match the leaning). A->C is **retracted** |
| `crossing-at-anchor` | Both links pass X, and X is a bend. A->D is retracted | X becomes a 4-way junction, so a crossing cannot be kept. A->D is routed | Both cables pass X, and X is a bend. A->D is retracted |
| `flow-endpoint-removed` | The flow is deleted with the anchor; undo restores it | The flow is kept and reads retracted; undo restores it | The flow is deleted; undo restores it |
| `lag-member-loss` | One member lost: routed, and the aggregate keeps one member. Both lost: retracted, and the aggregate is dropped | Same as FR1: the record is dropped at zero members | Same flow behaviour, but the aggregate record is kept with `members: []` |
| `permission-server-multiplicity` | A parallel to a server is refused, so a server aggregate cannot be built. Two uplinks are refused | Same | Same (reason: "does not permit junction") |
| `identity-name-under-junction` | The ref and the name `uplink` stay on s1-w1-w2. The piece w2-s2 is new and unnamed. w2 is a junction, and the flow is still routed | Both halves are named `uplink`, and the old ref resolves to both pieces. w2 is a junction | The cable is unchanged (ref, name and flow). A new cable w2-s3 is added, and w2 is an endpoint |
| `identity-names-under-join` | The merged link is `west`. The `east` ref resolves to `[]`. J is a bend. Undo restores all three names | The merged link reads name null with conflicts `{name:[east,west]}`. J is a bend. The only stored change is one removed pipe | Both cables stay, with both names and both refs. J is a junction |
| `repair-segment-removed`, two routes | `uplink` is cut into a named r1-t1 and an unnamed t2-r2, and the flow reroutes via the backup. A redraw heals the flow but leaves 3 links where 1 was drawn | Both stubs are named `uplink`, and the flow reroutes. A redraw re-forms `uplink` whole with one write | `uplink` **re-paths** to r1-u1-u2-u3-r2 and keeps its ref and name. A redraw returns it to its drawn route but also adds a t1-t2 cable |
| `repair-segment-removed`, one route | The flow is retracted and heals on redraw | The flow is retracted and heals; the removal writes one pipe | `uplink` is DOWN (`up:false`) and still named. The flow is retracted and heals |
| `undo-flow` | Declaring and removing a flow are both undoable | Same | Same |
| `one-way-door` (heuristic) | Key-set Jaccard 0.25. All 5 of today's links are recoverable by value. 618 bytes against today's 671 | Jaccard 0. 4 of 5 are recoverable (j1-s3 via b1 is not stored). 464 bytes | Jaccard 0. All 5 are recoverable. 687 bytes |

---

## 4. Measurements

All of this is from the neutral measurer (`measure/MEASUREMENTS.md`) and is MEASURED unless marked.
Everything was measured on one network: 13 anchors (5 routers, 3 servers, 5 bare), three series runs, junction J, a parallel pair, one aggregate, one multiplex and 3 flows.

### 4.1 Stored footprint

| | Entities | Scalar fields | Object keys | JSON bytes |
| --- | --- | --- | --- | --- |
| FR1 | 29 | 121 | 125 | 1474 |
| FR2 | 33 | 98 | 101 | 1047 |
| FR3 | 43 | 150 | 122 | 1623 |

- FR3 stores both pipes (14) and cables (11).
- FR2 stores 15 pipes, because the parallel copy is a second pipe on the same pair.

### 4.2 Determinism across 5 insertion orders

| Query | FR1 | FR2 | FR3 |
| --- | --- | --- | --- |
| `connections()` raw (refs and order) | differs (5 values) | same | differs (5) |
| `connections()` normalised | same | same | same |
| `roleOf`, all 13 anchors | same | same | same |
| `flowPath` and `flowStatus`, 3 flows | same | same | same |
| `stored()` strict | differs (5) | differs (2): relation ids R1 and R2 swap | differs (5): minted ids |

- The equal-cost ties this relies on were found by hand arithmetic (INFERRED).
- The check is weak. A mutant that breaks ties by insertion history was caught in only 1 of 4 orders, and only after a bend (w4) was added to the network. The measurer kept that correction in the record.

### 4.3 Undo

Each of 10 seeds applied 20 accepted random verbs.

| | FR1 | FR2 | FR3 |
| --- | --- | --- | --- |
| End state equal to start (strict) | 10/10 | 10/10 | 10/10 |
| Every intermediate state exact | 10/10 | 10/10 | 10/10 |
| Refused calls / calls that did not accept but still wrote | 39 / 0 | 51 / 0 | 31 / 0 |

All three keep whole prior documents for undo. The measurer read this at FR1 `model.mjs:324`, FR2 `:196` and FR3 `:221`.
So these runs show that every write goes through the document. They do not test per-rule inverses.
Judge 3 notes that the product's undo is an inverse-operation log (`server/txn.mjs:526`). On that reading this axis does not separate the frames (INFERRED).

### 4.4 Write amplification

Each cell is the number of stored entities changed; `+id` marks a moved id counter.
"Visible" counts the `connections()` records that changed.
The measurer deliberately did not total these rows, because the choice of contexts would drive any total.

| Context | FR1 | FR2 | FR3 | Visible (FR1/FR2/FR3) |
| --- | --- | --- | --- | --- |
| addAnchor (bare or typed) | 1 | 1 | 1 | 0/0/0 |
| connect straight to a new router | 1 +id | 1 | 2 +id | 1/1/1 |
| connect with two bends | 1 +id | 3 | 4 +id | 1/1/1 |
| connect landing on a bend (w1 or w3) | 3 +id | 1 | 2 +id | 4/4/1 |
| connect to junction J | 1 +id | 1 | 2 +id | 1/1/1 |
| remove a leaf connection | 1 | 1 | 1 | 1/1/1 |
| remove junction leg J-r2 | 3 | 1 | 1 | 4/4/1 |
| remove a series connection | 1 | 3 | 1 | 1/1/1 |
| remove an aggregate member | 2 | 1 | 2 | 1/1/1 |
| remove a multiplex carrier | 2 | 3 | 2 | 1/1/1 |
| remove an aggregate or multiplex relation | 1 | 3 | 1 | 0/0/0 |
| remove one multiplex channel | 1 | 1 | 1 | 0/0/0 |
| remove bend anchor w2 | 2 | 3 | 4 | 2/2/1 |
| remove junction anchor J | 4 | 4 | 7 | 3/4/3 |
| remove hub router r2 | 9 | 7 | 11 | 8/8/5 |
| remove server s1 (a flow source) | 4 | 2 (flows kept) | 5 | 1/1/1 |
| remove segment w1-w2 | 2 +id | 1 | 1 | 3/3/2 |
| remove segment J-r2 | 3 | 1 | 1 | 4/4/2 |
| setName on a series connection | 1 | 3 | 1 | 2/2/2 |
| setName on a relation | 1 | 1 | 1 | 0/0/0 |
| parallel | 1 +id | 1 | 1 +id | 1/1/1 |
| aggregate after parallel | 1 +id | 3 | 1 +id | 0/0/0 |
| multiplex | 1 +id | 2 | 1 +id | 0/0/0 |
| declareFlow or removeFlow | 1 | 1 | 1 | 0/0/0 |

**What drives the counts:**
- FR1's split and collapse writes (landing on a bend, removing a leg).
- FR2's per-pipe paint (setName, relations).
- FR3's pipe-plus-cable writes on connect, and its cascade when an anchor is removed.

### 4.5 Code size and special cases

| | Lines | Code lines | File bytes | Special cases declared by the builder | Declarations the measurer probed |
| --- | --- | --- | --- | --- | --- |
| FR1 | 465 | 386 | 21663 | 4 | 5 of 5 hold |
| FR2 | 399 | 351 | 19373 | 8 | 6 of 6 hold |
| FR3 | 337 | 265 | 19457 | 5 | 5 of 5 hold |

The builders' special-case lists went to the orchestrator, not to disk.
So the measurer did not find them, and instead probed the rules each model declares in its comments.

**The builders' lists, condensed:**
- **FR1:**
  - a `parallel:true` marker that exempts a link from today's duplicate rules;
  - `remove({segment})` composed from split and collapse;
  - server permission checked structurally, because today's roles label two terminations "endpoint";
  - roles derived for typed anchors.
- **FR2:**
  - pipe multiplicity for parallels;
  - continuation requires two different neighbours;
  - `connect` refuses a second pipe;
  - a post-condition guard on `parallel()`;
  - oneWay stored as a from-anchor;
  - relation records garbage-collected;
  - an extra `configure` verb;
  - canonical array order.
- **FR3:**
  - `removePipe` returns unresolved for an emptied pipe;
  - a DOWN cable is still listed with its declared via;
  - a simple-path fallback in `best()`;
  - `connect` lays pipes;
  - no scenario-only branch (MEASURED with a threshold mutant).

### 4.6 Other measured observations, recorded but not weighed

- **FR3 aggregate record.** After both members are removed, FR3 keeps the record with `members: []`, and its `ends` still name the deleted anchor r2. This contradicts FR3's own comment at `model.mjs:188-189`. FR1 and FR2 drop the record.
- **Stored change against visible change** when a connection lands on a bend: FR1 writes 3 entities and changes 4 visible records; FR2 writes 1 and changes 4; FR3 writes 2 and changes 1.

### 4.7 Not measured

- Scaling or performance. Only one network was measured.
- Drawing direction.
- Visualisation (UNRUNNABLE).
- Per-rule undo inverses.

---

## 5. The judges

Scores run from 1 to 5, and higher is better. Each cell reads Judge 1 / Judge 2 / Judge 3.

| Criterion | FR3 (A) | FR1 (B) | FR2 (C) |
| --- | --- | --- | --- |
| 1. Expressiveness (AX3) | 4 / 4 / 3 | 4 / 4 / 4 | 3 / 2 / 3 |
| 2. Derived, not stored (AX1) | 3 / 3 / 2 | 3 / 2 / 3 | 5 / 4 / 5 |
| 3. Parity and determinism (AX2) | 4 / 4 / 4 | 2 / 2 / 3 | 5 / 4 / 5 |
| 4. Conceptual economy (AX5) | 4 / 4 / 4 | 2 / 2 / 2 | 3 / 3 / 3 |
| 5. Extensibility (AX4) | 4 / 4 / 4 | 3 / 3 / 3 | 2 / 2 / 2 |
| 6. One-way-door cost (AX6) | 3 / 3 / 4 | 5 / 5 / 5 | 2 / 2 / 3 |
| 7. Repair behaviour (Q4) | 5 / 4 / 5 | 2 / 2 / 3 | 4 / 3 / 4 |
| 8. First proof readiness (Q5) | 5 / 4 / 3 | 4 / 4 / 5 | 4 / 3 / 2 |
| 9. Identity and configuration stability | 5 / 4 / 5 | 3 / 3 / 2 | 2 / 2 / 3 |
| **Unweighted total** | **37 / 34 / 34** | **28 / 27 / 30** | **30 / 25 / 30** |

**Totals.** Judges 2 and 3 stated their totals, and they match the cells. Judge 1 stated none, so I computed Judge 1's from the cells.
Summed over all judges and criteria, unweighted: FR3 105, FR1 85, FR2 85 (reporter arithmetic).

### 5.1 Rankings

| Judge | 1st | 2nd | 3rd |
| --- | --- | --- | --- |
| Judge 1 | FR3 | FR2 | FR1 |
| Judge 2 | FR3 | FR1 | FR2 |
| Judge 3 | FR3 | FR1 | FR2 |

### 5.2 Where they agree

- **FR3 is first for all three judges.** FR1 is second for two of three.
- **Identical scores from all three judges** on conceptual economy (FR3 4, FR2 3, FR1 2) and on extensibility (FR3 4, FR1 3, FR2 2). The extensibility scores rest on structure and are INFERRED by all three judges; Judge 3 cites source lines.
- **The same frame leads a criterion for every judge:**
  - FR1 on the one-way door (5, 5, 5).
  - FR2 on derived-not-stored (5, 4, 5).
  - FR3 on repair (5, 4, 5) and on identity (5, 4, 5).
  - FR1 is last on parity for every judge.
- **The same strongest argument against FR3,** from all three judges:
  - It fails the RULED `junction-three-way` (DECISIONS.md:233).
  - A T drawn onto a passing cable does not connect (`bend-to-junction`, with flow A->C retracted).
  - Complying needs authored splice or cut verbs that the contract lacks and nobody has built.
  - It has the largest footprint.
  - Emptied pipes persist invisibly.
  - Its aggregate `ends` dangle after anchor removal.
- **The same first "what would change my mind" item,** from all three: the director confirming that DECISIONS.md:233 and the DS7 T-landing leaning are binding, and ruling out a splice verb.

### 5.3 Where they disagree, and why

| Point | Split | Why (from the judges' rationales) |
| --- | --- | --- |
| Second place: FR1 or FR2 | Judge 1 puts FR2 ahead; Judges 2 and 3 put FR1 ahead | Judge 1 gives FR2 full marks on derived-not-stored and parity, and 4 on repair. Judge 2 docks FR2's parity for a path that moves when a stub is added (P6) and for derived states the write gate refuses (P7, P8), and scores its expressiveness 2. Judge 3 weights the door and first proof, where it MEASURED FR2 lowest on real templates: link ids are lost, typed firewalls are absorbed into links, and `load()` skips the permission check. The unweighted sum over all judges ties FR1 and FR2 at 85, so second place turns on weighting, not on the cells |
| First proof readiness (FR3 against FR1) | Judge 1: FR3 5, FR1 4. Judge 2: 4 and 4. Judge 3: FR3 3, FR1 5 | Judges 1 and 2 dock FR1 for a MEASURED false retraction, where FR1's router prunes the only valid route through a shared via anchor (judge1 probe2, judge2 P10). Judge 3 measured FR3 and FR1 paths identical on 171 of 171 real-template flows, so the defect did not fire there. It weighted instead that FR1 needs no data migration and that a T-landing connects in FR1 |
| Expressiveness of FR3 | 4 / 4 / 3 | Judges 1 and 2 credit constructs their probes found only FR3 (or FR3 and FR1) can make. Judge 3 weights the ruled failure and FR3's contract workarounds (the DOWN listing, unresolved emptied pipes) more heavily |
| One-way door for FR3 | 3 / 3 / 4 | Judges 1 and 2 used the suite's heuristic (Jaccard 0). Judge 3 ran the transform on 4 product templates, and it kept every open link and its id |
| Identity, FR1 against FR2 | Judges 1 and 2: FR1 3, FR2 2. Judge 3: FR1 2, FR2 3 | Judge 3 credits FR2 because paint is never lost and undo is exact. Judges 1 and 2 weight FR2's MEASURED ref resurrection, relation-id reuse and name overwrite |
| Derived-not-stored, FR3 against FR1 | Judge 2: FR3 above FR1. Judge 3: FR1 above FR3. Judge 1: tied | They weigh differently FR3's duplication (pipes alongside cable vias) and FR1's history-encoded split and collapse writes |

**Judges' arithmetic, checked by the reporter (computed from their own cells):**
- **Judge 1** says FR3 is "highest on 5 of 9" criteria. Its cells give 6: economy also counts, at FR3 4 against 3 and 2. The ranking is unchanged.
- **Judge 3** says FR3 stays ahead of FR1 "unless the door and first-proof axes are weighted about 2.5 times or more". On Judge 3's cells:
  - FR3 leads FR1 by 7 points on the other seven criteria.
  - FR3 trails by 3 on those two.
  - So the tie point is a weight of 7/3, about 2.33, slightly below the stated 2.5. The stated figure is slightly generous to FR3.

### 5.4 Judge-measured facts that the suite does not reach

Each row is MEASURED by the judge named. Every judge probe is a single hand-built construction, and each is that judge's own instrument; Judge 2 states this as a caveat.
I re-ran `judge1/probe2`, `judge2/probe` and `judge2/probe2`, and each matched its saved output byte for byte.

| Probe | FR3 | FR1 | FR2 | Source |
| --- | --- | --- | --- | --- |
| A routable flow where two links share a via anchor | routed | **retracted** (a false retraction) | third connect refused; retracted | judge1 probe2; judge2 P10 |
| A parallel through one bare bend ("two fibres in one duct") | accepted | accepted | **refused** | judge1 and judge2 P4 |
| A multiplex over an aggregate | accepted | accepted | **refused** ("not modelled") | judge1 and judge2 P5 |
| Two separately named links meeting at a bare waypoint | two links; w is a junction | two links; w is an endpoint | **one link**: `east` overwrote `west` | judge1 P6; judge2 P12 |
| A stale connection ref after remove and redraw | `[]` | `[]` | resolves to the **new** connection | judge1 P2; judge2 P1 |
| A stale relation ref after a new relation is made | nothing | nothing | designates the **new** relation (id reused) | judge1 P3; judge2 P2 |
| The same T drawn through W, against drawn piecewise | **differs**: drawn through, W is an endpoint and the flow is null; piecewise, W is a junction and the flow is routed | same both ways | same both ways | judge1 P7 |
| A landing on an aggregate member's bend | accepted; aggregate intact | **refused** | accepted; aggregate lists pieces that no longer share ends | judge1 and judge2 P8 |
| Emptied pipes steering a later re-path | **re-paths through pipes of deleted connections** | no re-path | no re-path | judge1 P1; judge2 P11 |
| A bend anchor of a cable removed | **cable deleted** (ref resolves `[]`) while the flow re-routes | bend stripped; link and name kept | stub kept, named `uplink` | judge2 probe2 |
| A flow's end anchor removed, then an anchor re-added with the same id | flow gone | flow gone | flow **re-attaches** and routes via the new anchor | judge2 P9 |
| A stub added at a bend on the chosen route | path unchanged | path unchanged | path **moves** from A,w,B to A,x,B | judge2 P6 |
| FR3's route fallback checked against a brute force | seed 1: 2326 checks, 0 mismatches | n/a | n/a | re-run by judges 1 and 3; the brute force was written by FR3's builder (same family) |

**Migration on 4 product templates (MEASURED by judge 3; `judge3/migrate.out.json`, figures checked by the reporter):**
- **As is.** Two of the four templates break the ruled server rule in every frame. FR3 and FR1 refuse to load them. FR2 loads them, because its `load()` skips the permission check, and then refuses all 105 and 55 flows.
- **After retyping the over-connected servers:**
  - FR3 and FR1 flow paths are identical on 171 of 171 flows, 97 of them routed. FR2 differs on 15 of 105 on template-1ced1f.
  - FR3 keeps every open link and its id: 20/21, 3/4, 6/6 and 18/20. The misses are closed rings.
  - Roles changed against today: FR3 11/28, 2/14, 2/7 and 8/47; FR1 2/28, 2/14, 0/7 and 4/47.
  - FR2 as built keeps 0 link ids and absorbs typed firewall nodes into links. A one-line variant (typed anchors never continue) reproduced 21/21, 4/4, 6/6 and 20/20.
- **Stored bytes on template-1ced1f:** FR3 9994, FR1 9040, FR2 8846.
- **Not measured:** the 38 live diagrams.

---

## 6. Each frame's strongest argument for and against

These are drawn from the judges, the builders and the measurements. The sources are in sections 3 to 5.

**FR3: the cable over pipes (judges' A)**
- **For.**
  - It is the only frame whose LINK re-paths when a pipe is removed, keeping its ref and name, and it keeps a DOWN link with its identity (MEASURED, `repair-segment-removed`). This answers the director's Q4 check question literally.
  - Identity holds through a cut, a join and a re-path, and ids are never reused (MEASURED).
  - It builds every relation composition the judges probed: a parallel through one duct, a multiplex over an aggregate, a crossing, and the shared-via routing trap (MEASURED).
  - It is the smallest code (265 lines), with one `best()` serving both layers.
- **Against.**
  - It is the only frame that fails a RULED ASSERT (`junction-three-way`, DECISIONS.md:233).
  - A T drawn onto a passing cable does not connect, and the result depends on how the T was drawn (MEASURED, judge1 P7).
  - Complying needs splice and cut verbs, which are unbuilt and untested.
  - It has the largest footprint (43 entities).
  - Emptied pipes are invisible and cannot be removed through the contract, yet they steer later re-paths (MEASURED, P1 and P11).
  - Aggregate `ends` dangle after an anchor is removed.
  - Removing a bend anchor deletes the cable, which is inconsistent with its pipe-removal re-path.
  - The route fallback is exponential in the worst case, and its scaling is unmeasured.
  - On migrated templates, anchors where two links end change role from endpoint to junction (11 of 28 on one template).

**FR1: the stored link, today's model (judges' B)**
- **For.**
  - Link records are identical to today's, and the 4 templates load with no transform (MEASURED).
  - It passes 27 of 27 ASSERTs.
  - A T-landing connects: today's split is kept.
  - It has the shortest path to the first proof, because flows sit on today's links.
- **Against.**
  - One drawing is stored and classified two ways depending on history (`pass-through-two-way`, MEASURED), and split and collapse must write to keep the document consistent.
  - It is the largest code (386 lines), and it carries the most rule machinery, including a `parallel:true` exemption marker.
  - A join loses `east` and its ref. A cut leaves an unnamed piece. A redraw fragments one link into three.
  - It cannot re-path a link.
  - Its router falsely retracts a routable flow (MEASURED by judges 1 and 2).

**FR2: the link derived from pipes (judges' C)**
- **For.**
  - It has the smallest footprint (33 entities, 1047 bytes), and it stores nothing derived.
  - Its stored form is history-free: the pass-through case is byte-identical both ways.
  - It has the strongest raw determinism: `connections()`, refs included, is identical across 5 orders.
  - It has the cleanest heal: one write re-forms `uplink` whole (MEASURED).
- **Against.**
  - It cannot express a parallel through a bent duct, a multiplex over an aggregate, a crossing without meeting, or two named links meeting at a waypoint (MEASURED).
  - Refs resurrect and relation ids are reused (MEASURED).
  - Names spread, duplicate, conflict or are overwritten.
  - A flow re-attaches to an unrelated anchor that reuses the id (MEASURED).
  - A stub can move a chosen path.
  - It has the widest door: link ids are lost, typed nodes are absorbed, and `load()` skips the permission check (MEASURED on templates).

---

## 7. Open items the bake-off could not settle

| # | Open item | Why it is unsettled | What would settle it |
| --- | --- | --- | --- |
| 1 | Are DECISIONS.md:233 ("delete one of three makes a bend") and the DS7 T-landing leaning binding? | This is FR3's only ASSERT failure and the top "change my mind" item for all three judges. It is a ruling question, so no run can decide it | A director ruling. If splice and cut verbs are acceptable, prototype them in FR3 and re-run `junction-three-way`, `bend-to-junction` and the identity scenarios, to check the ruled roles come out without destroying cable identity |
| 2 | Does Q4's "watch a link ... re-path" require the LINK to re-path, or is a flow re-route enough? | FR3's lead on repair rests on link-level re-path. The check question has no recorded answer | A director answer to the Q4 check question, and to whether a link models a physical cable that does not re-path or a logical circuit that does |
| 3 | The real one-way-door cost | Judge 3 measured 4 templates. The 38 live diagrams are unmeasured, and no `importToday()` verb exists | Run the migration over the live documents. Count role changes (FR3), fused and conflicting names (FR2), and closed links (FR3 has no home for `closed`) |
| 4 | Scaling of FR3 | Its fallback in `best()` is exponential in the worst case, and every cable route is re-derived on every query. Nothing measured this at product size | Benchmark on product-size and layered networks |
| 5 | Is FR1's false retraction a local fix? | MEASURED by judges 1 and 2. The fix is untried | Patch FR1's route search (for example with FR3's fallback) and re-run judge1 probe2 and judge2 P10 plus the suite |
| 6 | Can FR2's identity defects be fixed without losing its strengths? | Ref resurrection, relation-id reuse and paint overwrite are all MEASURED. A never-reused pipe id variant was proposed and not built | Build that variant and re-run judge probes P1-P3, P6 and P12 and the suite, counting the special cases it adds |
| 7 | What do unlisted typed anchors (firewall, host) permit? | FR2 absorbs them into links. Judge 3's variant (typed anchors never continue) changes FR2's door | A permission-table ruling for unlisted types |
| 8 | FR3's pipe lifecycle | Emptied pipes are invisible and unremovable through the contract, yet they steer re-paths. The contract has no pipe-only verb | Decide whether pipes are author-visible and addressable, add the verb, and re-run judge1 P1 and judge2 P11 |
| 9 | Crossing at an anchor without meeting (PS205) | FR2 cannot express it. FR1 and FR3 can, but no flow can turn there | A director ruling on PS205 |
| 10 | A server with an aggregate (PS307, PS111) | No frame can build it: the ruling refuses a second pipe or link at a server, against the DS7 requirement | A director ruling reconciling DECISIONS.md:253 with DS7 |
| 11 | Flow semantics: undo (PS220) and a deleted endpoint (PS221) | All three store flows as undoable intent, which is not ruled. On a deleted endpoint, FR2 keeps the flow and FR1 and FR3 delete it. FR2's choice leads to re-attachment by id (judge2 P9) | Director rulings on PS220 and PS221 |
| 12 | A connection drawn through a router: refuse or cut (PS308) | FR3 refuses it and FR2 cuts it (builders' notes). FR1 refuses it through its validator (INFERRED from the builder notes) | A director ruling on PS308 |
| 13 | Evidence quality | Determinism has weak power (1 catch in 4 orders). FR3's fallback check is builder-written. The judges' P-probes are single constructions. Undo is exact by snapshot in all three, so per-rule inverses are untested. Visualisation is UNRUNNABLE | Independent tests: more orders and networks, a brute force written by someone other than FR3's builder, and undo against the product's inverse-op log |
---

# Addendum: re-test against the rulings of 2026-09-25

Labels are used as in the main report. MEASURED means someone ran it, and the source is named. INFERRED means it was reasoned and nothing ran it. READ means it was read in source. Frames: **A = FR3, B = FR1, C = FR2**. The FR labels are used throughout, with the judges' letter in brackets.

**What the reporter checked (MEASURED, 2026-09-25)**
- **Rulings text.** Read at `dev/DECISIONS.md:416-434`. Line 419 says the rulings settle behaviour only: "the model is decided separately, after the leading candidate has been re-tested against these rulings".
- **Suite 1.2.0 re-run.** I ran it on all six models (3 originals, 3 v2), with output in `bakeoff/reporter-v2/`.
  - The counts match every figure in section A.3.
  - 0 of 39 statuses differ from `spec-v2/results/` for the originals, or from the builders' `results.json` for the v2 models.
  - Model sha prefixes: FR1-v2 `21770ff11b9c5857`, FR2-v2 `07077d282a109cea`, FR3-v2 `4c3374fee383e6aa`.
  - Suite `a1e7b3401d15b7de`; harness `92a4ec5a60d6f773`, unchanged from 1.1.0.
- **Stray files.** `bakeoff/results/` holds only the first-round null-model files.
- **Product repo.** `git status` shows `M dev/DECISIONS.md` and `?? .../BAKEOFF-LINK.md`, the same as at session start. HEAD is `d54869e`.
- **Re-judge arithmetic.** I recomputed every total and weight threshold in A.6.
- **Output files I read directly.**
  - Measurer: `rules-fuzz.stdout`, `dual.stdout`, `dual-orig.stdout`.
  - Re-judge 1: `probe.stdout`, `probe-v1.stdout`.
  - Re-judge 2: `hyst.stdout`, `duct-landing.stdout`, `landing-fuzz.stdout`, `scale-large.out`.
- **Not re-run by me.** The measurer's fuzz, dual and `measure.mjs` runs; the judge probes; the builders' mutants and fuzz; the re-judges' probes; `spec-v2/selftest`. Their figures are as their authors MEASURED them.

---

## A.1 The rulings and how suite 1.2.0 asserts them

| Ruling | DECISIONS.md | Scenario (kind) | What the suite asserts | The suite's own reading (INFERRED, disputable) |
| --- | --- | --- | --- | --- |
| R1: cut on landing | :421-423 | `bend-to-junction` (OBSERVE -> ASSERT) | `connect(W,C)` is accepted. W is a junction and nothing passes it. Exactly A-W, W-B and W-C end at W. Flow A->C is routed A,W,C | "The three meet" is read as a flow can pass from one to another at W |
| R2: join on removal | :425-427, with :231-233 | `junction-three-way` (ASSERT, extended) | The two survivors are ONE connection A,J,B, and J is a bend | none |
| R3: re-path | :429-431 | `link-repath-segment-removed` (new ASSERT) | Removing t1-t2 is accepted. The old ref resolves to exactly one connection, still named `uplink`, still joining r1 and r2, and avoiding t1-t2. Its route is a simple path over stretches carried before the removal, and `connections()` lists it. A frame that cannot remove one stretch is recorded NOT_EXPRESSIBLE | "Keeps its identity" is read as the old ref still resolves. "Accepted" and "listed" come from how the questions were framed, not from their text |
| Not ruled | :434 | `identity-name-under-junction`, `identity-names-under-join` and the one-route half of `repair-segment-removed` stay OBSERVE. The mirror-order T is recorded inside `bend-to-junction` | Recorded, never asserted | none |

- **Counts (MEASURED).** 1.2.0 has 39 scenarios: 29 ASSERT and 10 OBSERVE. 1.1.0 had 38: 27 and 11.
- **Power (MEASURED by the spec author; I reproduced it on the originals).** Each new or upgraded ASSERT passes on one original model and fails on another.
- **Gap.** `selftest/` was copied from 1.1.0 and has not been run under 1.2.0.

---

## A.2 Per frame: how it met each ruling, and what it cost

In each table, the builder's account is checked against the measurer. "Fuzz" means the measurer's run of 300 seeds x 40 edits. Its check counts are not comparable across frames.

### FR3 (A)

| Item | Builder's account | Measurer and re-judges | Agree? |
| --- | --- | --- | --- |
| R1 | `lay()` then `cutAt()` at both ends, read after the lay. The builder's own fuzz found 0 violations in 4 seeds x 7,200 calls | `bend-to-junction` passes (7 checks flipped). judge1 P7 now gives the same result both ways. Fuzz: **9 of 3475 fail** (3 still-passing, 6 moved-away; seeds 37:17 and 92:39 were replayed) | **No.** The builder's 0 is not reproduced by the measurer's instrument |
| R2 | Joins where a call takes an anchor from 3 or more ending cables to exactly 2. No join at a router, where the joined route would revisit an anchor, or where both cables are multiplexed | `junction-three-way` passes (3 checks flipped). Fuzz: 52 of 1072 fail, all revisit (a declared exception). Also 4 of 80 other removals | Yes |
| R3 | Passed in v1. v2 adds pipe pruning and re-path or DOWN when a bend anchor is removed. The builder flagged as INFERRED that a pipe held by a DOWN cable's via could still be used by another cable | judge1 P1 and judge2 P11 now go DOWN instead of re-pathing over deleted pipes. judge2 probe2 re-paths. Fuzz: **13 of 1140 fail**. 9 used a stretch listed only on a DOWN cable, and 4 a stretch on no listed connection | Yes. The builder's INFERRED residual is now MEASURED |
| Not-ruled choices | Cut: the half holding the first declared end keeps the id and name, so it depends on draw direction. Join: the earlier-minted cable survives, and the absorbed ref resolves to []. No re-path: the cable goes DOWN (`up:false`, still listed) | v2claims 8/8 hold. In `identity-names-under-join`, west survives and the east ref resolves to [] | Yes |
| Code | 265 -> 300 lines | 265 -> 300 | Yes |
| Storage and writes | No new field, but cut, join and prune now write. The builder did not measure build cost | Footprint unchanged at 1623 bytes. Landing on a bend: 2 -> 4 entities. Removing a junction leg: 1 -> 4. Per connect: mean 5.40, p95 12, max 54 (FR1-v2 2.62 / max 16; FR2-v2 1.84 / max 3) | Yes. The size of the cascades is the measurer's finding |
| Behaviour costs | `pass-through-two-way` depends on history. Redrawing a removed stretch cuts the healed link. The mirror-order T is not cut. A cut member leaves its aggregate | All MEASURED (OBSERVE notes changed in 11 scenarios). Re-judges add route memory the author cannot see: RJ5 (+1 against +3 connections from the same connect), hyst (a draw-then-delete leaves uplink on the deleted link's pipes), and Q4 | Partly. The builder did not list hidden route memory |
| Scale | Not measured | Re-judge 2, one run: `connections()` takes a mean 101.5 ms at 460 anchors with 58 off-route or DOWN; FR1-v2 about 0. **Reporter's read of the same file:** the refresh after a removal (`connections()` plus 20 `flowPath` calls) takes a mean 2146 ms, max 2992 ms, against FR1-v2 2.4 and FR2-v2 20.5. The workloads differ: 135, 77 and 72 connections were kept | n/a |

### FR1 (B)

| Item | Builder's account | Measurer and re-judges | Agree? |
| --- | --- | --- | --- |
| R1 | Already done by SPLIT. v2 fix: a cut piece inherits `parallel` (E5, E8). Residual refusals listed: E6 and P8 | Passes. Fuzz: 0 of 2798, **accepted connects only**. Re-judge 2's landing fuzz: **474 of 1463 landings REFUSED (32.4%)** by today's duplicate rules, against A 0/1464 and C 0/1630 | Partly. The refusal rate is only in re-judge 2's run |
| R2 | Already done by COLLAPSE. v2 fix: the relation-bound link survives, so the join happens (E1). No join listed at a router (E4) or with two multiplexes (P7) | Passes. Fuzz: **89 of 1131 declined** (81 revisit, 8 would duplicate another link's ends). The original declined 93 of 1294, so this is carried from v1 | **No.** The revisit and duplicate declines are not in the builder's account (grep of `model.mjs`). They come from today's validator (INFERRED) |
| R3 | New `repath()` over stretches carried before, minus the removed one. Shortest wins, ties go to the least sequence. `parallel:true` only when another link shares both ends. No re-path through a router (E10) | Passes (4 of 7 checks flipped). Fuzz: 0 of 808 (the predicate covers bare anchors only). t1 and t2 go to role none. Every judge-probe output is byte-identical to v1, including the false retraction | Yes |
| Not-ruled choices | Cut: the src-side piece keeps the id and name. Join: the inbound link's id and name survive. No re-path: the link is cut, and its ref lands on stub r1-t1, which is still named. "Down" is not expressible | v2claims 6/6 hold | Yes |
| Code | 386 -> 414 lines; 21663 -> 25469 bytes | Same | Yes |
| Storage and writes | No new field. `parallel:true` gains a second, derived writer | Footprint unchanged at 1474 bytes. All 28 write-amplification contexts are identical to v1 | Yes |
| Geometry | The stretches beside a removed one are erased. A redraw adds a lone t1-t2 | Same (redraw: the flow stays on the u-route) | Yes |
| Broke | Builder's probe 8d, as intended | v1 declared behaviours 5/5 -> 4/5 (the intended R2 fix) | Yes |

### FR2 (C)

| Item | Builder's account | Measurer and re-judges | Agree? |
| --- | --- | --- | --- |
| R1 | Holds by construction, with no code | Passes. Fuzz: 0 of 3229. Landings refused: 0 of 1630. The mirror-order T also connects | Yes |
| R2 | Holds by construction | Passes. Fuzz: 0 of 1869, plus 0 of 1300 other removals | Yes |
| R3 | Identity is now stored paint (`link`). Parallel pipes pair k-th to k-th through bends. A cut link is re-laid, with a guard. Declared limits: no re-path through a junction; opposing one-way directions block it | Passes (6 of 7 checks flipped). **Fuzz: 584 of 693 fail.** In 506, every alternative passes a junction (declared). In 78, a junction-free alternative existed. By outcome: 433 gone, 77 pieces, **74 re-laid but the old ref resolves to nothing**. I did not cross-tabulate the two splits | **Partly.** The 74 ref failures are not in the builder's account |
| "Through the pipes" | New pipes are laid beside backup's, because a pipe belongs to one link | The suite reads a pipe as an adjacency, so this passes | The builder's own caveat |
| Not-ruled choices | Cut: both halves keep the identity. Join: name null with a conflict; both refs resolve. No re-path: v1's cut, and the pieces keep the identity | v2claims 6/6 hold | Yes |
| Code | 351 -> 425 lines | Same | Yes |
| Storage | A `link` on every pipe. The one-way-door form grows from 464 to 634 bytes | 1047 -> 1505 bytes. D1 and L1 are no longer byte-identical. 1568 of 3128 end-state refs are pipe addresses | Yes. The ref share is the measurer's |
| Behaviour | A removal is now a write. A redraw adds a separate link (V11). A parallel through a bend is now accepted. The P1 resurrection is kept | judge P4 now accepted. Anchor removal re-paths. Resurrection, relation-id reuse and the stub moving the path are unchanged | Yes |

---

## A.3 Suite results before and after (MEASURED; reproduced by the reporter)

Each cell is pass / fail / observed / not-expressible.

| Frame | 1.1.0 on v1 | 1.2.0 on v1 (baseline) | 1.2.0 on v2 | Status changes, v1 -> v2 |
| --- | --- | --- | --- | --- |
| FR1 (B) | 27/0/11/0 | 28/1/10/0 | **29/0/10/0** | `link-repath-segment-removed` fail -> pass |
| FR2 (C) | 27/0/11/0 | 28/1/10/0 | **29/0/10/0** | `link-repath-segment-removed` fail -> pass |
| FR3 (A) | 26/1/11/0 | 27/2/10/0 | **29/0/10/0** | `junction-three-way` and `bend-to-junction` fail -> pass |
| null | 38 NE | 39 NE | - | - |

| Ruling scenario | FR1 v1 -> v2 | FR2 v1 -> v2 | FR3 v1 -> v2 |
| --- | --- | --- | --- |
| `bend-to-junction` (R1) | pass -> pass | pass -> pass | fail -> pass |
| `junction-three-way` (R2) | pass -> pass | pass -> pass | fail -> pass |
| `link-repath-segment-removed` (R3) | fail -> pass | fail -> pass | pass -> pass |

No ASSERT broke in any frame. After masking refs and paint, OBSERVE notes changed in 2 FR1 scenarios, 8 FR2 scenarios (6 by paint only) and 11 FR3 scenarios.

**OBSERVE changes that matter (MEASURED):**

| Scenario | FR1 | FR2 | FR3 |
| --- | --- | --- | --- |
| `pass-through-two-way`, same role both ways | false, unchanged | true, unchanged | **true -> false** |
| Mirror-order T (drawn through an existing end) | W endpoint, A->C retracted (unchanged) | W junction, routed | W endpoint, retracted. It now differs from the landing order |
| `repair-segment-removed`, two routes | cut -> **re-path**. t1 and t2 go to none; a redraw adds a lone link | two named stubs -> **re-laid**. A redraw adds a lone link, where v1's re-formed uplink whole | re-path both times. A redraw now **cuts uplink into 3** plus a duplicate t1-t2 (v1 restored it whole) |
| `repair-segment-removed`, one route | cut, ref on stub r1-t1 (unchanged) | two named stubs, refs now pipe addresses | DOWN. A redraw now cuts |
| `identity-names-under-join` | west survives, east -> [] | null with conflicts | both kept, J junction -> **west survives, east -> [], J bend** |

---

## A.4 Judge probes, old against new (MEASURED by the measurer)

The measurer re-ran the probes on the originals, and the outputs are byte-identical to the saved ones. I did not re-run them. "=" means the output is byte-identical, old against new.

| Probe | FR3 (A) | FR1 (B) | FR2 (C) |
| --- | --- | --- | --- |
| j1 P1: deleted connections steer a re-route | re-path over deleted pipes -> **DOWN** | = | = (paint only) |
| j1 P4 / j2 P4: a parallel through a bare bend | = | = | refused -> **accepted** |
| j1 P7: a T drawn through W against piecewise | differed -> **same (junction, routed)** | = | = |
| j1 P8 / j2 P8: a landing on an aggregate member | accepted, 2 members -> accepted, **1 member** | = (refused) | = |
| j1 probe2 / j2 P10: shared-via trap | = (routed) | = (**retracted**) | = (refused; retracted) |
| j2 P11: pull one route, cut the other | re-path over the pulled pipe -> **DOWN**; `remove b-r2` now unresolved | = | = |
| j2 probe2: remove bend anchor t1 | cable deleted -> **re-paths, keeps ref and name** | = (bend stripped) | stub -> **re-laid, keeps ref and name** |
| j1 P2, P3, P5, P6, P9; j2 P1-P3, P5-P7, P9, P12 | = | = | = |

Rows changed: FR3 6, FR2 3, FR1 0. FR1-v2's probe output is byte-identical to v1 in every row.

---

## A.5 The dual-encoding check (MEASURED by the measurer; tallies from `dual{,-orig}.stdout` are the reporter's)

The constructions compared:
- **D1:** drawn through W.
- **D3:** two pieces.
- **L1:** left behind by deleting a junction leg.
- **L4:** cut, then join.
- **T1:** the landing.
- **T2:** piecewise.
- **T3:** mirror order.

| Comparison | FR1 v1 | FR1 v2 | FR2 v1 | FR2 v2 | FR3 v1 | FR3 v2 |
| --- | --- | --- | --- | --- | --- | --- |
| D1 vs L1: roles | Y | Y | Y | Y | n | Y |
| D1 vs L1: stored, strict | n | n | **Y** | n | n | n |
| D1 vs L1: stored, ignoring ids and counters | Y | Y | Y | n | n | Y |
| D3 vs L1: roles (the suite's pass-through pair) | n | n | Y | Y | Y | **n** |
| L4 vs D1: stored, strict | n | n | Y | Y | n | n |
| T1 vs T2: roles | Y | Y | Y | Y | n | Y |
| T1 vs T3: roles and A->C flow | n | n | Y | Y | Y (neither cuts) | **n** |
| Role agreement, 8 comparisons against D1 and T1 | 6/8 | 6/8 | 8/8 | 8/8 | 3/8 | 6/8 |

**What the table shows:**
- **FR3-v2 has exactly FR1's partition of role outcomes:** {D1, D2, L1-L4} against {D3}, and {T1, T2} against {T3}. Its roles, shape and flow match FR1 in every row. Its stored-form cells do not (D2, L3 and T2 differ).
- **Whether FR3's parity got worse depends on the reference.** Against the suite's pairs (D3/L1 and T1/T3) it got worse. Against drawn-through D1, role agreement rose from 3/8 to 6/8. Both readings are MEASURED, and which comparison matters is not ruled.
- **Round trips (re-judge 1; each is a single construction).** Landing then removing the landing restores all of roles, shape, identity and configuration in:
  - FR3: 5 of 5 in v1, 1 of 5 in v2. RJ2, RJ3 and RJ6 fail. In RJ1 only the aggregate changes, from 2 members to 1.
  - FR1: 1 of 2 non-refused in v1, 1 of 4 in v2. RJ1 is refused in both versions, and RJ2 and RJ3 were refused in v1.
  - FR2: 5 of 5 in both versions.

---

## A.6 Re-judges: re-scores, rankings, and whether the leader survives

"Old" is the first-round median of the three judges. I verified this for every cell both re-judges cite. Criteria a re-judge did not re-score keep the median.

| Criterion | FR3 (A): old / RJ1 / RJ2 | FR1 (B): old / RJ1 / RJ2 | FR2 (C): old / RJ1 / RJ2 |
| --- | --- | --- | --- |
| 1. Expressiveness | 4 / 4 / 4 | 4 / 4 / **3** | 3 / 3 / **2** |
| 2. Derived, not stored | 3 / **2** / **2** | 3 / 3 / **2** | 5 / **4** / **4** |
| 3. Parity and determinism | 4 / **2** / **2** | 2 / 2 / 2 | 5 / **4** / **4** |
| 4. Conceptual economy | 4 / **3** / **3** | 2 / 2 / 2 | 3 / **2** / **2** |
| 5. Extensibility | 4 / 4 / 4 | 3 / 3 / 3 | 2 / 2 / 2 |
| 6. One-way door | 3 / 3 / 3 | 5 / 5 / 5 | 2 / 2 / 2 |
| 7. Repair | 5 / **4** / **4** | 2 / **3** / **3** | 4 / **2** / **2** |
| 8. First proof | 4 / **5** / 4 | 4 / 4 / 4 | 3 / 3 / 3 |
| 9. Identity and configuration | 5 / **3** / **4** | 3 / 3 / 3 | 2 / 2 / 2 |
| **Total** | **36 / 30 / 30** | **28 / 29 / 27** | **29 / 24 / 23** |

| | 1st | 2nd | 3rd | Door weight at which FR1 ties FR3 (reporter arithmetic) |
| --- | --- | --- | --- | --- |
| First round | FR3 (all three judges) | FR1 (2 judges), FR2 (1 judge) | | 2.33, door and first proof together (Judge 3's cells) |
| Re-judge 1 | FR3, 30 | FR1, 29 | FR2, 24 | 1.5 for the door alone; 2.0 for door and first proof |
| Re-judge 2 | FR3, 30 | FR1, 27 | FR2, 23 | 2.5 for the door alone; 2.5 for door and first proof. At 2.5 it is a tie, not a flip |

**Where the re-judges agree:**
- The order is FR3, FR1, FR2.
- FR3 loses on parity (4 -> 2), economy, derived-not-stored and repair.
- FR1 gains on repair (2 -> 3).
- FR2 loses on repair (4 -> 2), economy, parity and derived-not-stored.

**Where they split:**
- FR3 first proof: re-judge 1 raises it to 5; re-judge 2 leaves it at 4.
- FR3 identity: 3 against 4.
- FR1 expressiveness: 4 against 3. Only re-judge 2 measured the 32.4% landing refusals.
- FR1 derived-not-stored: 3 against 2.
- FR2 expressiveness: 3 against 2.

**Does the leader survive the rulings?**
- **Re-judge 1: only nominally.** FR3 and FR1 are "effectively tied". The first round's margin came from FR3 never cutting or joining, and R1 and R2 removed it. FR3 keeps four things: DOWN keeps a link's identity, it routes the shared-via trap, it builds every probed composition, and it has the smallest code. It adds hidden route memory, which FR1 lacks.
- **Re-judge 2: narrowly, and only on a condition.** FR3 stays first only if the product makes pipes an author-visible, addressable layer with a verb. Otherwise its pipe layer is hidden state with measured defects, and FR1 gives the same ruled behaviour at lower build cost.

**Reporter checks on re-judge claims (MEASURED from their cited files):**
- Re-judge 1 says FR3 "matches B's in every cell" of measure-v2 section 4. That holds for roles, shape and flow, but not for the stored-form cells.
- Re-judge 1's "B 81 of 1131" R2 declines counts the revisit class only. FR1's total is 89.
- Re-judge 2's scale figure is per `connections()` call. The post-removal refresh in the same file is about 20 times larger for FR3-v2 (A.2).

---

## A.7 Remaining risks and what would settle each

| # | Risk | Frames | Evidence | What would settle it |
| --- | --- | --- | --- | --- |
| 1 | A landing on a point that two or more links pass, followed by its removal, does not round-trip: 4 ends are left, and R2 fires only when 3 or more drop to 2 | FR3, FR1 | MEASURED, single constructions (RJ2, RJ3, RJ6, RJ5 X') | A director ruling on whether removing such a landing restores the passing links. Then a fuzz that includes relations and flows |
| 2 | FR3's hidden declared-route memory: states that look identical diverge, and a redraw fragments a healed link | FR3 | MEASURED (RJ5, hyst, Q5, `repair-segment-removed`) | Decide open item 8 (are pipes author-visible, with a verb?) and whether a logical circuit remembers its drawn route. Re-run RJ5, hyst and the repair scenario |
| 3 | Write cascades and scale | FR3 | MEASURED once: 5.40 records per connect on average, max 54; one connect took listed connections from 22 to 30; the refresh took about 2.1 s at 460 anchors. The workloads differed | A benchmark with equal workloads at product size, and a prototype of incremental routing |
| 4 | R1 is not a fixed point: 9 of 3475 in the measurer's fuzz, against 0 in the builder's | FR3 | The two instruments disagree | Run the builder's predicate on seeds 37:17 and 92:39, or the measurer's predicate on the builder's stream |
| 5 | Landing refusals (32.4%) and the false retraction | FR1 | Both MEASURED. That they are local fixes is INFERRED and untried | Relax the duplicate rule for cut pieces and patch the route search. Re-run the landing fuzz, judge1 probe2, judge2 P10 and the suite |
| 6 | Re-path limited at junctions (506 of 693), and refs that resolve to nothing after a re-lay (74) | FR2 | MEASURED | Attempt a re-path through junctions and re-run the rules fuzz. Whether the frame allows it is INFERRED to be hard |
| 7 | R2 exceptions are not ruled (revisit, duplicate ends, two multiplexes, router) | FR3 52/1072, FR1 89/1131, FR2 0 | MEASURED | A director ruling on closed or revisiting links |
| 8 | The mirror-order T is not ruled | FR3 and FR1 do not connect; FR2 does | MEASURED | A director ruling |
| 9 | The not-ruled items. A link that cannot re-path: FR3 goes DOWN, FR1 cuts to a stub, FR2 keeps the pieces. Also which half keeps the identity, and which name survives a join | all | Behaviour MEASURED. That DOWN connections pile up in FR3 (6751 listed at the end of the fuzz against about 3150) is INFERRED, because the streams differ | Director rulings. A "removed" ruling would cancel FR3's DOWN advantage |
| 10 | Template migration has not been re-run on v2 | all | The measurer did not run it. It was UNRUNNABLE under re-judge 2's brief. That FR3's role-change figures carry over is INFERRED | Run `judge3/migrate.mjs` against the v2 models, and then on the 38 live diagrams |
| 11 | Routing is now coupled to persistence: a change to `best()` changes what cut, join and prune write | FR3 | INFERRED (READ at 203-207, 222-227, 237-241) | Change the router's tie-break and diff the stored forms over the fuzz |
| 12 | The suite's own readings: identity as "the old ref resolves", "meet" as "a flow passes", accepted and listed from the question framing, and FR2 laying new pipes | all | INFERRED | A director confirmation of the readings |
| 13 | Evidence quality. The RJ and Q probes are single constructions by their own authors. Builders' mutants and fuzz are the same family as their models. The measurer's fuzz has no relations or flows. The selftest was not re-run under 1.2.0. Undo is exact only by snapshot. Extensibility is INFERRED | all | Stated | An independent rate test with relations and flows, and a selftest run under 1.2.0 |

The reporter's re-run outputs are in `/tmp/claude-1000/-home-apnex-taceng-drawv2/91425672-bafc-4fea-b641-ad76cbb3b3ce/scratchpad/bakeoff/reporter-v2/`.

SUMMARY:
All three v2 models now pass suite 1.2.0 at 29/0/10/0, with no ASSERT regressions (MEASURED, reproduced by the reporter).
Re-judge 1 ranks FR3 30, FR1 29, FR2 24; re-judge 2 ranks FR3 30, FR1 27, FR2 23. The first-round medians were 36, 28 and 29.
FR3 survives only narrowly: re-judge 1 calls FR3 and FR1 effectively tied, and re-judge 2 keeps FR3 first only if pipes become author-visible and addressable.
Cut and join made FR3's role partition identical to FR1's, dropped FR3's round trips from 5/5 to 1/5, and made writes about 2x FR1's per connect (mean 5.40, max 54).
FR1 is limited by its landing refusals (32.4%) and its false retraction, both untried possible local fixes. FR2 fails R3 in 584 of 693 fuzz checks, mostly at junctions.
The next director rulings that could decide adoption: whether a link that cannot re-path goes down or is removed, R2 on revisiting links, the mirror-order T, and the pipe verb (open item 8). Also unmeasured: scale at equal workloads, and migration on v2.
---

# Addendum 2: FR3-v3, the engineering prototype (2026-09-26)

FR3 was adopted on 2026-09-25 (`dev/DECISIONS.md`). This addendum records one prototype of it, FR3-v3, built against the rulings R1-R8 to price what the rulings cost in engineering. It is not the product design, and it adds no recommendation.

**R numbering used here:**
- R1: cut on landing.
- R2: join on removal.
- R3: re-path.
- R4: pipes are visible.
- R5: FR3 adopted.
- R6: a link returns to its drawn route.
- R7: a link with no route is down and heals.
- R8: draw-then-delete leaves no trace.

The four edge-case rulings committed in `e9d7bc3` are called "the later rulings".

**The brief's premises.** These were set by the orchestrator. Nothing ran them.
- A link stores its drawn route as intent.
- Its current route and its drawn, detour or down state are derived and never stored.
- Derivation is memoised once per document version.
- The rejoin pairing rule was left to the builder.

**Four roles, each with its own instruments:**
- A spec author wrote suite 1.3.0.
- A builder wrote the model, `model.mjs`.
- A neutral measurer read the builder's files only after its own runs.
- An adversarial reviewer used its own fuzz, probes and an independent BFS derivation.

Everything ran in the session scratch directory (`bakeoff/` under the scratchpad) and is not preserved. Directory names below are relative to it.

**The brief predates three of the later rulings.** The brief was written before the later rulings were asked, so it called the mirror-order T "not ruled". The builder, measurer and reviewer each found the ruling at `dev/DECISIONS.md:459-461` and reported the mismatch.
- The builder implemented "connect", which the ruling asks for.
- Suite 1.3.0 still asserts the old refusal of a second link to a server, which `dev/DECISIONS.md:463-466` has since amended.

**What the reporter checked (MEASURED, 2026-09-26):**
- I re-ran suite 1.3.0 on `model.mjs` in `FR3-v3/`, into `reporter-v3/`. Result: 38 pass, 0 fail, 10 observed, 0 not-expressible. Model sha256 prefix `d1283fee283b0265`, matching all three roles' provenance.
- I read these outputs directly and the figures below match them:
  - measurer: `scale-summary.quiet.stdout`, `writeamp-table.stdout`, `fixed-points.stdout`;
  - reviewer: `flow-blowup.stdout`, `probes.stdout` (D1, D2, E1, E2).
- Not re-run by me: every fuzz, the probes, the mutants, and the scale runs. Their figures are as their authors MEASURED them.
- Product repo: status clean at `e9d7bc3` before this addendum.

---

## B.1 Suite 1.3.0

Counts: 48 scenarios, 38 ASSERT and 10 OBSERVE. The suite sha prefix is `e6bcb676056f9416`. The harness is unchanged since 1.1.0.

**Carried over (MEASURED by the spec author).** All 39 scenarios from 1.2.0 keep their status for each v2 model. Two basis texts gained CORRECTED banners, because they said "NOT RULED" for what R7 now rules.

**New ASSERT scenarios:**

| Scenario | Ruling | Needs a new verb |
| --- | --- | --- |
| `link-returns-to-drawn-route` | R6 | `addPipe` |
| `link-detour-shown` | R6 | `addPipe`, `routeOf` |
| `link-down-stays-and-heals` | R7 | none |
| `link-down-shown` | R7 | `addPipe`, `routeOf` |
| `derived-detour-and-down-not-stored` | R6 and R7: a pipe delete changes only the pipe in stored form | `storedLayout` |
| `landing-removed-rejoins-two`, `landing-removed-rejoins-one` | R8 | none |
| `landing-removed-stored-links-two`, `landing-removed-stored-links-one` | R8, stored form | `storedLayout` |

- **Rejoin pairing.** Only a landing followed at once by its removal is asserted. How a model pairs the pieces is never asserted.
- **Power (MEASURED by the spec author).**
  - Eight shimmed variants of FR3-v2, six of them deliberate defects, gave 72 predicted statuses and 0 mismatches.
  - Each new ASSERT passes on at least one variant and fails on at least one.
  - Limit: the pass side of the two-link rejoin is shown only by a satisfiability aid, which is an undo in disguise.
- **Baseline (MEASURED; pass / fail / observed / not-expressible):**
  - FR1-v2: 30/2/10/6.
  - FR2-v2: 30/1/10/7.
  - FR3-v2: 31/1/10/6.
  - The v2 models cannot express the six scenarios that need a new verb.
- **Not run:** `selftest/` under 1.3.0.

---

## B.2 How FR3-v3 meets each ruling

The builder's own fuzz is the same family as the model, so each row is checked against the measurer and the reviewer.

| Ruling | Builder | Measurer | Reviewer | Status |
| --- | --- | --- | --- | --- |
| R1 | Cut rule reads the DRAWN route. 0 violations in 2236 checks on drawn routes | Fixed-point fuzz: 9,298 states with a link passing a point where another ends, **all on a derived detour**, none on a drawn route | Same finding: 5,721 (300x40) and 24,733 (100x120) states, all on detours. Two probes, below | **Met on drawn routes. Open on detours (B.6 item 1)** |
| R2 | 0 unexplained failures in 1263. The rest are declared exceptions: revisit 138, a join at the far end 4, both multiplexed 1 | Ruled case, 11 violations in 605: 2 multiplex, 2 revisit, 7 "joined but the result detours away" | 565 of 664 joined. The other 99: 97 revisit, 2 both multiplexed | **Met except the declared exceptions, which are not ruled** |
| R3 | 0 of 2602 pipe deletions lost an id or name | (not separately reported) | 6,924 pipe operations wrote nothing outside the pipes. Independent BFS matched `routeOf` in 426,817 of 426,817 checks | **Met** |
| R4 | `addPipe`; `remove({segment})` deletes any pipe; `pipes()` lists them | n/a | Functional. `pipes()` is quadratic: 6.1 s at 1602 anchors and 1000 links | **Met, with a cost defect** |
| R6 | Pipe operations wrote only the pipe list, 0 exceptions in 2559 | 0 violations | Met for pipe edits. Deleting an anchor rewrites the drawn route (D6) | **Met, except anchor deletion** |
| R7 | Both scenarios pass | 0 violations | Met in the same 426,817 checks | **Met** |
| R8 | 989 landings restored; 10 not, where R2 fires at the landing's far end | 10,718 of 10,792 restored. All 74 failures start with exactly two links already ending at the landing point | Pure landings restored: 771/771 cutting 1 link, 179/179 cutting 2, 51/51 cutting 3 or more. Composed cases fail (D2, D3, D5) | **Met for the ruled case. Composed cases open (B.6 items 2-4)** |
| Later: mirror-order T connects | Implemented | Recorded in a class of its own | Honoured | **Met** |
| Later: a server may have several links | Not implemented | n/a | Refused: "server srv does not permit junction" (D7) | **Not met** |
| Later: passing links cross | Honoured on drawn routes | n/a | READ at `model.mjs:41-46` | **Met** |
| Later: device pass-through by capability pack | Only the suite's fixed table | n/a | n/a | **Not built** |

**The two instruments disagree on one R2 class, as stated.** When a join happens but the joined link then detours away from the point, the point reads `none` rather than `bend`. The builder counts that as meeting R2 (106 cases) and the measurer counts it as a violation (7). Both readings are recorded here.

**R1 probes (MEASURED by the reviewer, `probes.stdout`):**
- **D4a.** The uplink visibly runs r1-u1-u2-u3-r2 on a detour. A new link lands on u2. The uplink is not cut and still passes u2.
- **D4b.** Link X is on a detour A-h-B. Its unused drawn route A-P-Q-B passes P. A landing on P cuts X into A-P and P-A-h-B, although nothing visibly passed P.

**The measured alternative.** The builder's variant `detour-avoids-ends.mjs` forbids a detour to pass a point where a link ends. On the builder's instrument:
- R1 failures fall to 0 of 2,770.
- R3 fails 635 of 742 (630 links go down).

---

## B.3 Cost

**Writes per verb** (MEASURED; mean / p95 / max):
- **Connect:**
  - measurer, with the re-test's fuzz: FR3-v3 5.70 / 12 / 29, against FR3-v2 5.40 / 12 / 54 (reproduced) and FR1-v2 2.62 / 7 / 16;
  - measurer, with relations, flows and pipe edits added: FR3-v3 5.76 / 12 / 28;
  - reviewer, counting a modified record as 2: 6.55 / 15 / 30. That breaks down as cables 3.02, pipes 2.18 and splices 1.34.
- **Remove a connection:**
  - measurer: 5.69 / 10 / 22, against FR3-v2 3.47 / 6 / 10;
  - reviewer: 4.42 / 10 / 19.
- **Delete or add a pipe:** 1 record (measurer, and 1.00 / 1 / 1 on the reviewer's fuzz).
- **The splice records.** They hold the cut lineage that R8 needs, at about one record per connect or removal (reviewer).

**Speed** (MEASURED by the measurer; median of 7 runs; 460 anchors, 901 pipes, 150 links, 40 flows):

| Workload | FR1-v2 | FR3-v2 | FR3-v3 |
| --- | --- | --- | --- |
| Equal workload: pipe removal plus refresh | 59.7 ms | 209.4 ms | 11.2 ms |
| Re-judge 2's instrument: refresh only | 2.7 ms | 2223 ms | 1.2 ms |

- FR3-v2's 2223 ms reproduces the ~2.1 s of A.7 risk 3.
- The routing work moved into the write, and reads use the cache.

**Speed at larger sizes, and memory** (MEASURED by the reviewer, one machine):
- **Every edit costs in proportion to the whole document**, because each one clones, re-derives and freezes it (READ at `model.mjs:410-426`).
  - setName: 2.3 ms at 44 KiB, 32.4 ms at 534 KiB.
  - connect: 2.3 ms at 402 anchors, 19.5 ms at 1602 anchors and 1000 links.
- **Trunk failure** (one pipe under 1000 links): the delete takes 2.77 s at 1602 anchors. It runs one route search per distinct pair of ends (INFERRED).
- **Undo** keeps every version whole, plus a derivation of each:
  - about 1.24 MiB per edit on a 190 KiB document;
  - 1431 MiB after 1000 edits;
  - there is no cap.
- **Size:** 434 lines of code against v2's 300 (builder; code means non-comment, non-blank).

**Determinism** (MEASURED):
- A network built in 7 orders gives identical normalised connections, roles and flow paths in FR3-v3. FR1-v2 and FR3-v2 each give 2 or 3 different results (measurer).
- Replay is identical in 400 of 400 seeds (reviewer).
- A fresh load agrees with the live model in 24,000 of 24,000 checks (reviewer).
- Undo is exact in 300 of 300 seeds for all three models (measurer).

---

## B.4 Defects for engineering, not for the director (MEASURED by the reviewer)

| # | Defect | Mechanism |
| --- | --- | --- |
| D1 | A flow read can take exponential time. In a full mesh of K routers plus two links crossing at a bare point: 0.8 ms at K=5, 1,712 ms at K=8, 142,082 ms at K=9. Random use: 13.1 s for one read. Inherited from FR3-v2; FR1-v2 stays under 0.4 ms | When the cheapest path revisits an anchor, which crossing links cause, the search falls back to listing every simple path (READ at `model.mjs:104`, `:119-130`) |
| D2 | Draw-then-delete brings back a pipe the author deleted, and can bring a DOWN link up | A link-laid pipe lives while ANY drawn route runs along it, including one broken at exactly that pipe |
| D3 | Deleting a landing that was itself mirror-cut leaves a trace, and the outcome depends on deletion order. 351 of 835 in the fuzz; 46 of 835 when all the pieces are deleted in one step | The pieces are separate links with no one-step removal |
| D5 | Aggregate member order is reversed after a rejoin ([c1,c2] becomes [c2,c1]) | Rejoin re-inserts in cut order, not reverse order |
| D6 | Deleting an anchor rewrites the drawn route, which R6 treats as intent | `removeAnchor` writes `via` (READ at `:369`) |
| D7 | The later server ruling is not implemented | The fixed permission table |
| D8 | `resolve(ref)` returns only the first piece of a drawing that became several | Contract deviation from the suite's own contract document |
| D9 | Input hardening: key separator collision on U+0000; `load()` accepts duplicates and a seq below a minted id | Low severity |

**Hidden memory that remains** (MEASURED by the measurer and reviewer). States that look identical to the author diverge on the same edit through:
- the splice lineage;
- which pipes the author drew and which a link laid;
- the mirror-cut pieces.

Redrawing a healed stretch as a link still turns 4 listed links into 7. Redrawing it as a pipe restores 4.

---

## B.5 A.7's risks after FR3-v3

| A.7 # | Risk | Now |
| --- | --- | --- |
| 1 | A landing on a point two links pass does not round-trip | Pure landings round-trip (B.2, R8). Composed cases remain |
| 2 | Hidden route memory | The drawn route is now ruled intent. The hyst probe now gives identical results, and RJ5's landing-and-removal variant matches the original. New memory: splices and pipe authorship (B.4) |
| 3 | Write cascades and scale | Measured at equal workloads (B.3). The refresh is fast; the per-edit whole-document cost, undo memory, `pipes()` and D1 are open |
| 4 | R1 not a fixed point | Explained: every violation is a link on a detour (B.2) |
| 7 | R2 exceptions not ruled | Still not ruled: revisit and both-multiplexed |
| 8 | Mirror-order T not ruled | Ruled "connect" in the later rulings; implemented |
| 9 | Not-ruled items | "Cannot re-path" is ruled DOWN (R7). Which piece keeps the identity, and which name survives a join, are still open |
| 10 | Migration not re-run | Still not run |
| 11 | Routing coupled to persistence | Not re-measured on v3 |
| 13 | Evidence quality | Improved: an independent adversary used its own instruments and an independent derivation. `selftest/` is still not run under 1.3.0 |

---

## B.6 Open for the director (collected from the builder and reviewer; none ruled, and the order is not a ranking)

1. **R1 on a link that is on a detour.** Does a landing on the visible detour cut it (D4a)? Does a landing on the unused drawn route cut it (D4b)?
2. **R2 against R8 on one history.** Draw A-P, draw P-B, draw E-P, delete E-P. R2 joins A-P-B; "no trace" leaves A-P and P-B as two links. This is the source of all 74 of the measurer's R8 failures.
3. Whether deleting a mirror-cut landing means deleting all its pieces in one act (D3).
4. How pieces pair on rejoin when lineage and geometry disagree, for example after a piece was replaced while cut.
5. The R2 exceptions: revisit, about 15% on the reviewer's stream, and both-multiplexed.
6. What a link keeps as intent when an anchor on its drawn route is deleted (D6).
7. What an aggregate shows while its members are cut. It empties and reads down.
8. Whether a flow may pass the same point twice along two crossing links. This decides D1's fix.
9. Which piece keeps identity when a link is cut, and which name survives a join (open since `dev/DECISIONS.md:434`).

---

# Addendum 3: FR3-v4, pinned vias, and the options behind thirteen rulings (2026-09-26)

On 2026-09-26 the director ruled three things that changed what a link is:
- a landing on a detoured link cuts it where it is;
- a link's intent is its ends plus pinned vias, routed by cost between them;
- a routed stretch crosses the points it passes.

FR3-v4 was built on those rulings. Every question the rulings left open was then given switchable options, and each option was measured, so the director could rule with the consequences in hand. Thirteen further rulings followed the same day (`dev/DECISIONS.md`, entries dated 2026-09-26).\
Labels are as in the main report.

**Where the evidence lives.** A reboot on 2026-09-26 wiped the session scratch directory that held the bench. The bench was rebuilt from the session transcripts: all 669 paths accounted for, none lost, and all seven earlier models EXACT by sha256. It now lives durably at `~/taceng/drawv2-archive/link-bakeoff/`, outside this repository, with a README and recovery manifests. Directory names below are relative to it. The workflow's full reports are in its `RESULTS-v4` directory.

**Roles** (workflow run wf_1b876d5c-fb2; each role had its own instruments):
- a suite author wrote suite 1.4.0;
- a builder wrote FR3-v4;
- an independent adversary attacked it;
- a fix pass fixed what it could;
- a neutral cost measurer and three option measurers followed;
- a brief writer drafted the questions;
- an independent auditor checked the drafts against the measurement files.

**What the reporter checked (MEASURED, 2026-09-26):**
- **Suite 1.4.0**, re-run into `reporter-v4/`:
  - FR3-v4 passes 47, fails 0, observes 14, with 0 not-expressible;
  - FR3-v3 passes 40, fails 5, observes 14, with 2 not-expressible;
  - model sha256 prefix `b12d4839af866273`, suite `ed63396d4aee82f2`, harness `92a4ec5a60d6f773` (unchanged).
- **Timings.** The measurers ran concurrently on an 8-thread machine at load 16-27, so the cost measurer repeated its timing runs once the machine was quiet. The reporter then re-ran the three FR3-v4 timings that were still contended, at load 0.1-0.2 (`measure-v4/quiet2/`, `run-quiet2.sh`). The contended figures had overstated FR3-v4's costs by up to 9x.
- **Read against the files:** the options-acts pipe-deletion and round-trip tables, the cut-under-pins construction and probe E6, and the collapse rule in `server/txn.mjs`.
- **Not re-run by me:** every fuzz, the option sweeps, and the builder's and adversary's probes.

## C.1 Suite 1.4.0

- **Size:** 61 scenarios, 47 ASSERT and 14 OBSERVE. 9 ASSERTs are new, for the 09-26 rulings:
  - leg-local detours pass every pin;
  - an unreachable pin makes a link down, and it heals;
  - a link returns to its legs;
  - a link can be declared by its ends and routed;
  - a routed stretch crosses, and so does a declared one;
  - a pin at a link end connects;
  - a detour landing cuts where it is, and deleting it rejoins.
- **Re-based with CORRECTED banners (8 scenarios):**
  - 6 scenarios assumed a whole-route detour that skips bends;
  - 2 assumed the old server refusal.
- **Power:** 238 predicted status cells, 0 mismatches.
  - Limit: for several new ASSERTs, the pass side comes only from the suite author's own instrument, the same family as the suite.
- **Contract:** one new verb, `declareLink(a,b)`. `routeOf(ref).drawn` is now read as the intent: end, pins, end.

## C.2 FR3-v4: cost (MEASURED, measure-v4; quiet runs)

| Measure | FR1-v2 | FR3-v3 | FR3-v4 |
| --- | --- | --- | --- |
| 460 anchors: 150 connects | 512 ms | 487 ms | 49 ms |
| 460 anchors: pipe removal + refresh | 58.9 ms | 9.99 ms | 4.52 ms |
| 1,600 anchors / 1,000 links: pipe removal + refresh | 3,906 ms (load ~2) | 1,256 ms | 29-37 ms (reporter re-run) |
| 1,600 anchors: `pipes()` | not expressible | 17,470 ms | 11-16 ms |
| setName per edit at 290 links | 288 ms | 32.8 ms | 0.5 ms |
| Undo heap over 1,000 setName edits | 86 -> 203 MiB | 193 -> 1,431 MiB | 25 -> 26 MiB |
| Stored size, 460-anchor network | 40,703 B | 76,438 B | 101,467 B |
| One undo step, 100 -> 1,000 links | not measured quiet | 0.02 -> 0.15 ms | 1.83 -> 13.02 ms |
| Fresh `load()`, 460 anchors | 4 ms | 6 ms | 15 ms |

- **Distinct legs** (1,000 detoured links; delete the grid pipe that carries the most of them), reporter re-run on a quiet machine:
  - delete plus first read: 99.6 ms;
  - re-add the pipe plus read: 859 ms.
  - The contended run had given 743 ms and 7.6 s.
- **Writes per connect:**
  - FR1-v2: mean 2.62, p95 7, max 16;
  - FR3-v3: mean 5.70, p95 12, max 29;
  - FR3-v4: mean 7.08, p95 16, max 70 (rules-fuzz, unchanged instrument).
  - `parallel` writes 4.15 against 1.12, because of pipe-credit rewrites.
- **Determinism:** FR3-v4 gives one visible result across 7 build orders. One stored-form split remains: a T drawn landing-first records a splice by the landing; mirror-first records a group.

## C.3 FR3-v4: defects, and what became of them (MEASURED by the adversary, then the fix pass)

The adversary confirmed ten defects. The fix pass fixed five of them. For each, it showed the failure before the fix, the pass after it, the failure again on reverting it, and the failure on a build with only that fix removed:
- 1: a refused rejoin stayed armed;
- 6: cubic hub rejoin (18.0 s down to 0.69 s at K=1,000);
- 8: non-default bundle options changed flows;
- 9: every addPipe re-searched every leg;
- 10: input hardening.

Four defects went to the director, and each is now ruled:
- 2: how a cut on a detour reads under pins (ruled: only the original bends);
- 3: a rejoin across a link that landed later (ruled: stay cut while another link ends there);
- 4: a link route that passes a point twice (ruled: allowed);
- 5: an incomplete flow search when revisits are forbidden (ruled: flows may revisit).

One defect is not fixed. **Defect 7:** when two routes tie, an undirected link's route depends on which end was named first. A symmetric tie-break is INFERRED to fix it and was not built. The "how ties break" question is carried to design.

## C.4 The option measurements and the rulings they informed

| Open item | Options measured | Ruled (DECISIONS.md 2026-09-26) | The deciding measurements |
| --- | --- | --- | --- |
| Pipes a deleted link laid (I10) | go / stay / stay while used | Stay while another link uses them (against the proposer's lean) | another link moves in 1.8% / 4.0% / 0.2% of deletions; an author-deleted pipe returns via draw-then-delete in 94% of that construction |
| Cut on a detour under pins (defect 2) | original bends / whole detour pinned | Original bends | whole-detour pinning left 784 fuzz states with a bend where another link ends, and a landing-then-delete left the link on its detour for good |
| Rejoin across a later landing (defect 3) | rejoin / stay cut | Stay cut | rejoining happened 959 times and stopped the later link's flow |
| Flow revisits (I8) | allow / forbid | Allow | allow routed 90-96% of random flows, against 81-94%; no forbid search built was both exact and bounded |
| Link route passes a point twice (defect 4) | allow / down / route around | Allow | 1,920 of 50,111 fuzz states; a landing cuts only one of the two passes (140 landings) |
| Join would make a loop (I5) | no join / join | No join | 47 per 1,000 deletions; joining made 84 loop links |
| Join of different VLANs (I5) | no join / merge | No join | about 3 per 1,000 deletions |
| Two separately drawn links left at a point (I2) | join / stay two / merge on arrival | Join (today's product also collapses) | stay-two was traceless (5,665 of 5,665) but failed the suite's join test; join loses one name whenever it fires |
| Pairing on rejoin (I4) | lineage / geometry / none | Settled by existing rulings (proposer reading) | geometry restored turning links in 1.9% |
| Join name (I9) | earlier / later | Earlier-drawn | 39 of 3,270 named links at risk lost their name |
| Cut name (I9) | first end / longer / neither | Longer piece | the name stayed visible in 704 of 704 cuts |
| Delete one piece of a cut drawing (I3) | that piece / whole line | That piece | the old page came back in 58% against 90% (builder's own fuzz) |
| Bundle while members are cut (I7) | nothing / pieces / originals | Nothing, shown down | a member without both of the bundle's ends was listed in 0% / 29.5% / 23.8% of bundle states |
| Delete a pinned point (I6) | forget the bend / down / cut | Forget the bend | stayed up in 95-98%; 81% of later edits then differ from a link that never lost the pin |

**The audit, before any question was asked.** The independent auditor found 19 problems in the drafted questions:
- numbers that did not match their files;
- recommendations contradicted by the bench's own measurements;
- an order that would let later answers reopen earlier figures;
- recommended options described with fewer costs than the others.

Each question was revised against the findings before it was put to the director. The order was changed so that pipe lifetime and the detour and rejoin cases came first. The full audit is saved as `audit.json` in the `RESULTS-v4` directory on the bench.

## C.5 What the prototype does not yet match, and what is still open

**FR3-v4's defaults now differ from the rulings in five places**, the next build's inputs:
- flows forbid revisits (ruled allow);
- the cut name goes to the first end (ruled longer piece);
- a deleted pin makes the link down (ruled forget the bend);
- laid pipes follow the drawing's credit (ruled stay while used);
- a transit cut rejoins across a later landing (ruled stay cut; not built).

**Not built at all:**
- planes and declared directions, so today's two-link matrix is not modelled;
- per-type capability packs;
- any drawing on screen.

**Open and not ruled:**
- how route ties break (defect 7);
- whether "longer" counts pipes or grid length;
- whether a "delete the whole drawing" command exists;
- whether a pipe kept because another link uses it then belongs to the author;
- whether a pipe drawn by a link counts as author-drawn once the link is gone.
