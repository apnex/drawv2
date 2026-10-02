# The network reads a model -- promotion's P1, in the lab (DELTA, proposed)

> **Tier 3 -- a design of record, proposed.** Written 2026-10-02 against `cb49be4`.
> Facts about today's code are measured and cited by file and line; judgements are marked as such.
> Proposes; decides nothing. Section 8 lists what only the director can settle, one at a time.

## 1. Status

- **Asked for:** the director, 2026-10-02, approving the recommended next lab actions: the one-transit-question pass (done, B278), then "item 4 -- the network reads a model", to come back as a design first because it changes behaviour.
- **Is:** stage P1 of `PROMOTION.md` section 6, run in the lab while promotion itself is held (B266). Nothing here reaches production.
- **Found while measuring, and the reason this is a design and not a build:** P1 as written assumes the lab's models can hold pipes, but the kind list is fixed at five for every composition (`model/shape.mjs:32`) and the planner refuses any other id (`planner/validate.js:45`) and any unknown field (`planner/validate.js:305`). Letting a composition bring its own kind is B273, held until P2. So P1 cannot land without first answering how pipes enter a model before the format batch -- decision N1.

---

## 2. From-state -> to-state

**From** (measured at `cb49be4`):
- **Pipes live beside the models, in the network session** (`network/session.mjs:34`), keyed by their pair, with no id. Every reader takes the session's list: the derivation (`network/view.mjs:30`), the drag judge (`network/session.mjs:66`), the painter (`network/host.mjs:38`) and the planner's reference check (`model/link-reactions.mjs:173`, through `alsoReferenced`).
- **A drag's legs wait outside the commit.** The judge returns them (`network/guide.mjs:73-80`), the session holds them (`network/session.mjs:70`), and lays them only when the planner's answer arrives (`network/session.mjs:79`). Input knows nothing of pipes: it commits `commands.routeLink(s)` (`app/src/input.js:1186-1187`).
- **The sweep and the prune are the session's,** run after each answer (`network/session.mjs:85-88`), and skipped after undo and redo, since undo cannot move pipes.
- **Undo cannot restore pipes.** The director's original wording, "undo brings it back", was CORRECTED for this limit (`dev/DECISIONS.md:1225`); matrix row UNDO-01 states it: the link returns down.
- **The host reads the lab's planner model** in three places -- the judge, the sweep, the ages noted on an answer (`PROMOTION.md`, AMENDED 2026-10-02) -- which the product page has no copy of.
- **Link ages and transit are session state too** (`network/order.mjs`, `network/transit.mjs`; TR-7).

**To:**
- **A pipe is an entity in the lab's models,** a kind the network plugin brings: `pipe-<6hex>` with `a`, `b`, `laid`; one per pair, both ends existing.
- **The network derives from the model it is asked about:** `createNetwork` takes no pipe set, and the view reads `model.all('pipe')`.
- **Every pipe change is an op in the transaction that causes it:** a drag's legs ride in its own commit; a `g` drag that makes no link commits its pipes alone; an anchor's deletion takes its pipes as a cascade; the sweep of unused `link` pipes is a planner reaction in the `sweep` phase.
- **So undo and redo move pipes,** exactly, by replaying recorded inverses; the "skip the sweep after undo" rule goes.
- **The host takes no planner model:** it judges, paints and settles over the tab's model, which is what the product page will hold at P5.
- **The session pipe set is deleted.**

---

## 3. The fence

Pipes as entities in the lab's tab and authority models; the network's derivation, judge, painter and planner reactions reading them; the commit seam that carries a drag's pipes; the seeds; the tests and matrix rows that move with them.

---

## 4. The anti-scope fence

- **Production is unchanged,** byte for byte: it passes exactly its five kinds, and its planner corpus results do not move.
- **No stored format.** The lab stores nothing; schema, migration, the server and the export are P2 to P4.
- **Transit stays session state** (TR-7) until the format batch.
- **No new routing rule.** Every rule stays as ruled; the one behaviour that changes is the one the director first worded -- undo brings pipes back.
- **Not the other promotion decisions.** P-3 to P-9 concern the estate and the cutover and are asked when promotion starts (decision N4).

---

## 5. Build order -- each stage provable before the next depends on it

| stage | what lands | exit criterion |
|---|---|---|
| **N-a** | **A composition brings its kinds** (B273, by N1). The kind table is passed in: the Model, the planner's id grammar and field checks, ops and change reconciliation read the composition's table. Production passes its five, unchanged; the lab passes the five and the network's `pipe` row | the production planner corpus and the gesture corpus unchanged; a Model or planner handed a kind it was not composed with refuses it, naming it; L7k re-recorded in the same commit |
| **N-b** | **The network's pipe kind and its rules.** The row (collection, fields); a pipe's ends exist and one pipe per pair, as network rules; an anchor's deletion deletes its pipes (a `clear` reaction); the sweep of unused `link` pipes moves from the session into the network tenant's `sweep` phase | planner corpus, network composition: the same edits make the same links, with the pipe consequences as ops; the sweep and prune cases agree with the session's results |
| **N-c** | **The network reads the model.** The view and the judge read `model.all('pipe')`; the judge's verdict carries the pipe entries; Input gains one generic seam -- a judge may add entries to the commit it judges -- so its commit stays pipe-agnostic; a `g` drag with no link commits its pipes; the host loses the lay, the tidy and the planner model; seeds commit their pipes as ops | the behaviour matrix passes with every row unedited except UNDO-01 (section 6); the corpus differs only by pipe ids and the undo rows |
| **N-d** | **The session pipe set is deleted,** with `alsoReferenced`'s outside list and the skip-after-undo rule | no module imports `network/pipeset.mjs`; `attachNetwork` takes no `authority` |


AMENDED 2026-10-02 -- **N-a done.**\
`composeKinds` (model/shape.mjs) builds a composition of whole rows and refuses a twice-claimed kind, a missing referenced kind, a field without a check, a named kind with no name check, and a plugin kind with nested fields (which `clone` cannot yet copy); the Model and the planner each take `kinds`, and the planner refuses a model composed differently; the product's rows are planner/kinds.mjs; the id grammar is built from the rows; anchors are minted with their hex unique across both anchor kinds (`Model.freshId`).\
Production unchanged: every corpus and earlier test as before.\
Pinned by tests/kinds.test.js; 16 of 17 mutants killed, the survivor equivalent.

AMENDED 2026-10-02 -- **N-b done.**\
The pipe kind is the network's row, `network/pipe-kind.mjs`: id `pipe-<lowerhex>-<higherhex>`, ends `a` and `b` stored lower hex first, `laid` link or hand; its check refuses an end that does not exist, an id its ends do not make, and a hand pipe becoming a link pipe.\
The network's derivation reads its pipes from a source, `pipesOf(model)` -- the session's set until N-c, the model's own pipes where it holds them.\
The network's tenant gains two reactions: `pipe-cascade` (an anchor deleted takes its pipes) and `pipe-sweep` (link pipes no link runs over, after the join, as the session swept once the commit had landed); both inert where the model holds no pipes, which N-d removes.\
Proven over every network case in the planner corpus, 1,045, planned again with its pipes in the model: the same verdict, ops and inverse on everything but pipes, the pipes the session would leave, and an undo that restores them -- 687 accepted, 1,156 pipe ops made by the reactions.\
The corpus never has a join that changes a route, so it cannot tell the sweep before the join from after; the contract test that pins the phase order does.\
The hand-pipe delete (B281) moves to N-c, which first puts pipes in the lab's models.

---

## 6. Behaviour that changes, stated before it is built

- **UNDO-01:** one undo restores the link, its three pins, its five anchors -- and its pipes, so it returns UP. Edited from "returns down"; its CORRECTED ruling becomes true as first worded.
- **A new row:** a `g` drag that makes no link is one undo step; undo removes its pipes, redo lays them again.
- **Everything else the matrix states holds unedited.** The corpus gains pipe ids; any row whose board differs beyond that is a defect in the build, not a change to accept.

---

## 7. Coverage, verification, costs

**Proves:** P1's exit criteria (the matrix passes, undo restores pipes, the session pipe set is deleted); B273's injection, in the lab; the host's P5 contract without a planner model.\
**Defers:** link ages (by N3), transit storage (TR-7), every production path (P2 to P5).

**Verification targets:** the planner corpus in both compositions; the gesture corpus; the behaviour matrix and its corpus in real Chrome; a kind-injection test that a composition's table is the only one read; mutants on each new reaction and on the commit seam.

**Named costs and non-claims (judgement):**
- **Larger than any H17 cut:** N-a touches the planner's validation and the Model, which production runs -- held byte-identical by its corpus, but it is production code changing shape.
- **It does not store anything,** so a reload in the lab still starts empty, as today.
- **It does not demonstrate peers agreeing** -- that needs stored ages (P2).

---

## 8. Decisions for the director -- one at a time

- **N1 -- how pipes enter a model before the format batch.** Recommended: a composition brings its own kinds now (B273's injection, at P1 rather than P2), so the network plugin owns its `pipe` row and production passes exactly its five -- the sovereign split promotion would otherwise do later. The alternatives: hold P1 until P2 lands the format in production, which conflicts with the hold on promotion; or keep pipes outside the kind system, which ops cannot carry, so undo still could not restore them -- the point of P1 lost.
- **N2 -- pipe identity** (promotion's P-1, brought forward because P1 needs it). RULED 2026-10-02, differently: `pipe-<lowerhex>-<higherhex>`, the two anchors' hex; anchor hex unique across nodes and waypoints from N-a; the waypoint kind eliminated at promotion (B282). Recommended: ids, `pipe-<6hex>`, with "one pipe per pair" a network rule -- rather than keying a pipe by its pair, which ops and change reconciliation cannot carry.
- **N3 -- link ages in P1.** RULED 2026-10-02 as recommended. Recommended: they stay session state in P1 and move at P2 with B249's drawing-order field, which stores one order for every kind, link age included -- a core field, so a production format change. Undo already keeps a returning link's age (`network/session.mjs:23`). The alternative: an age field on links now, which the network would add to a core kind ahead of B249.
- **N4 -- which start-of-promotion decisions bind P1.** RULED 2026-10-02 as recommended; every decision is ruled, and the build is H17.22. `PROMOTION.md` section 11 gated P1 on all of section 10. Recommended: only P-1 (N2) binds it; P-2 is N3's; P-3 to P-9 concern the estate and the cutover, and are asked when promotion starts.

AMENDED 2026-10-02 -- N1 RULED as recommended, and generalised (`dev/DECISIONS.md`, "Plugins bring their own kinds"):
- **N-a grows to one shape for every kind:** each of the six kinds is a row carrying its storage facts, a check for every field with its id prefix, its cross-entity check and the kinds it references; the five built-ins' checks move into their rows; the id grammar is built from the rows (amending C3). A twice-claimed kind and a missing referenced kind are refused when the composition is built.
- **Two questions the ruling opened**, asked first, since they shape the row every kind takes:
  - **N5 -- names.** Every kind is named today (B187), and one name namespace spans the kinds. Whether a kind joins it is a row fact; for `pipe`, whether it is named. RULED 2026-10-02: a row declares `named`; the five stay named; a pipe is not.
  - **N6 -- whether a pipe can be selected,** which decides the gesture that deletes a hand pipe (B281). RULED 2026-10-02: hand pipes can be selected and deleted; link pipes are never offered.

---

## 9. Axiom alignment audit (M7)

**Identity:** this delta, against `cb49be4`, measured against mission-kit A1-A14.\
**Verdict: pass-with-guardrails** -- N1 to N4 ruled before N-a.

| axiom | weight | how the delta holds it |
|---|---|---|
| A2 Isomorphic Specification | load-bearing | one record of pipes -- the model -- where today the session's set and the planner's projection are two, reconciled by the lay-on-answer ordering |
| A3 Sovereign Composition | load-bearing | the network brings its kind as it brings its reactions and colour roles; production composes its five, and nothing network-shaped enters the core table |
| A1 Sovereign State Transparency | supporting | pipes become entities every reader of a model sees, with ids and an undo history; still unstored in the lab |
| A8 Gated Recursive Integrity | supporting | N-a is gated by production's corpus before any network stage depends on it |
| A13 Director Intent Amplification | supporting | four decisions, asked one at a time; the behaviour change named before it is built |
| A4-A7, A9-A12, A14 | not materially implicated | |

**Tensions.**
- **Bringing B273 forward against the hold on promotion (A3 against A13).** Injection changes code production runs while promotion is held. Resolved by the guardrail that production's corpora do not move, and by asking N1 rather than assuming it.
- **Ages left behind (A2).** P1 ends with pipes in the model and ages in the session -- two homes for network state for one stage. Accepted under N3, because the age's real home is a core field for every kind.

**Guardrails:** production's planner corpus and gesture corpus unchanged at every stage; the matrix edited only at UNDO-01 and the new undo row; Input names no pipe -- the seam is "a judge may add entries".
