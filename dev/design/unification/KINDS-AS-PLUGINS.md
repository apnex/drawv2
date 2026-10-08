# Every kind becomes a plugin's -- zones, groups, then the node -- H19.7 (DELTA, proposed)

> **Tier 3 -- a design of record, proposed.** Written 2026-10-08 against `aa91ba0`.
> Facts about today's code are measured and cited by file and line; judgements are marked as such.
> Proposes; decides nothing. Section 9 lists what only the director can settle, one at a time.
> AMENDED 2026-10-08: O1 ruled -- full decoupling, the node last; the core keeps machinery and the anchor capability (section 11).

## 1. Status

- **Asked for:** the director, 2026-10-07, approving the re-triage after the cutover in its recommended order -- the next unification arc after the sync hardening, each designed for approval before any code (`dev/BOARD.md` H19, item H19.7, row B280).
- **Is:** B280, "every kind brought by a plugin": the link moved to the network plugin at S-e (H18.15, G5); this designs the step for the kinds the product still owns.
- **Rests on two rulings that read differently** (section 5.1): the core is "anchors: identity and position" (SD11b, 2026-09-27), and "zones, groups and links each their own, the core holding none" (the generalised N1 ruling, 2026-10-02).

---

## 2. From-state -> to-state

**From** (measured at `aa91ba0`):
- **The core composes three kinds:** `node`, `zone`, `group` (`model/shape.mjs:45`, `:71-74`), their checks in `planner/kinds.mjs:150-198`, composed first by `productKinds` (`planner/kinds.mjs:241`); the network brings `link`, `pipe` and the node's `transit` field (`network/kinds.mjs:16-22`).
- **The group's behaviour is hard-wired into the planner:** its tenant, `GROUPS`, is appended to every composition rather than passed in (`planner/txn.mjs:255`; `planner/tenants.mjs:23-63`), and its two invariants -- no node in two groups (B82), a group needs two members (B85) -- live in the core's invariants (`model/invariants.mjs:60-91`).
- **The core Model makes and reads zones and groups:** `makeZone` (`model/model.mjs:415`), `makeGroup` (`:427`), `groupOf` (`:312`) and the rule that selecting a member selects its group (`expandSelection`, `:451-461`).
- **The product's consumers name them directly:** the word `zone` appears in 22 product modules and `group` in 19 (B280's own count, re-measured) -- most heavily the canvas (`app/src/input.js` 60 lines, `app/src/commands.js` 19), the CLI (`cli/verbs.mjs` 87), the export (`kernel/adapt.mjs` 10) and REST (`server/rest.js` 14).
- **The seams the network plugin built** carry a plugin's whole contribution on the page and the server: its rows (`network/kinds.mjs`), its tenant of reactions, passed to the planner (`planner/txn.mjs` `links`), its key rows for Input (`network/keys.mjs`, through `plugins`), and its painter attached to the page (`network/host.mjs`, `network/page.mjs`). REST already serves any composed collection (`server/rest.js:23` `kindOfCollection`).

**To**, as decision O1 rules (section 9):
- **The core holds the node** -- identity and position, the anchor every plugin references -- **and no other kind.**
- **Zones are a shipped plugin, and groups another,** each in a folder of its own holding its row, its checks, its reactions, its invariants, its key rows and its painter, composed by the product page, the lab, the server and the CLI's reader as the network is.
- **Nothing a user or an agent sees changes.**

---

## 3. The fence

The zone and group rows and their checks; the group tenant passed in like the link tenant; the group invariants on the group's row; the Model's zone and group factories and queries; the canvas's zone and group gestures, commands and drawing; the export's and REST's reading of them; the CLI's restatements, held to the plugins by test; a layer rule that the core names neither.

---

## 4. The anti-scope fence

- **No change to the stored format.** Collections keep their names, `zones` and `groups`, and their order in a document: the composition stays node, zone, group, link, pipe.
- **No change to behaviour.** Every corpus -- planner, gesture, matrix, K8 DOM -- stays byte-identical; a difference is a defect in the move.
- **The node stays core** unless O1 rules otherwise; the type-as-composition question is B282's (H19.8).
- **No plugin registry, discovery or loading at runtime:** kinds are composed when a page or server is built (ruled 2026-10-02).
- **The Model's six questions to the network** (`MODEL_READS`, `model/model.mjs:108`) stay as they are; B280 records them, and they are not this delta's.

---

## 5. Findings that shape the design

### 5.1 What the core keeps is ruled twice, and the two readings differ

SD11b: "The core is anchors: identity and position" -- and B282: "The base entity is the NODE, and a node has an ANCHOR".\
The generalised N1 ruling: "regrouping the existing kinds into plugins -- zones, groups and links each their own, the core holding none" -- which lists zones, groups and links, and not the node.\
The board's exit for H19 says "the core holds no kind", which reads the second more widely than it is written.
**Recommended (judgement):** the core keeps the node, as both rulings allow; the exit is amended to say so (O1).

### 5.2 The seams exist for a plugin's rows, rules, keys and painter -- not for the CLI or the export

A zone plugin needs no new seam on the page or in the planner: rows, tenant, key rows and painter are how the network already contributes.\
Two consumers have no plugin seam: the CLI, which ships standalone and restates what it reads, held to the source by tests (B138); and the export (`kernel/adapt.mjs` `docToSchema`, `kernel/engine.mjs`), which reads `doc.zones` and `doc.groups` by name.
**Recommended (judgement):** the CLI keeps its restatements, each held to the plugin's row by a test, as it holds the network's today; the export reads collections through the composition it is handed, as REST does.

### 5.3 Earned exposure says wait; the target state says go

The 2026-10-02 ruling: "Build only what one plugin kind needs" (mission-kit P4; A3, earned exposure).\
B280 was held until "a composition that wants to leave out a kind, or a second added kind" -- and neither has happened: every composition holds zones and groups.\
The case for now is the target state the director set (`dev/DECISIONS.md`, "Promotion's target state"): "the core names no plugin; a plugin's rules, kinds and fields are its own", and the re-triage that put this arc on the board.\
So this is O2, with holding named as an option and its cost stated.

### 5.4 The group is the harder of the two

A zone is self-contained: a row, a gesture, a drawing, a grid.\
A group spans kinds -- its members are nodes -- and reaches into the planner (a hard-wired tenant), the core's invariants, and selection (`expandSelection`).
**Recommended (judgement):** zones first, as the proof of a shipped plugin that is not the network; groups after, once the tenant and selection seams exist.

---

## 6. Build order -- each stage provable before the next depends on it

| stage | what lands | proven by |
|---|---|---|
| **O-a** | **The group tenant passed in, not hard-wired:** a composition passes its tenants -- the network's and the product's groups -- and the planner appends none; the group invariants move to the group row's `invariants` | every corpus byte-identical; a test that `planner/txn.mjs` names no tenant |
| **O-b** | **The zone plugin:** its row and checks, `makeZone`, its gesture and commands, its painter and grid, composed by the page, the lab, the server and the reader; the export and REST read it through the composition | every corpus identical; the core composes no zone; a composition without the plugin refuses a zone by name and draws no zone layer |
| **O-c** | **The group plugin:** its row, tenant, invariants, `makeGroup`, `groupOf`, the selection rule as the plugin's contribution, its key and commands | as O-b, for groups |
| **O-d** | **Closed:** a layer rule that the core names neither kind; the CLI's restatements held to the plugin rows; B280 closed or its remainder recorded | the gate; the lab and production deployed with nothing changed for a user |

Each stage is one gate and one lab deploy.
**Size, by judgement:** large -- O-b and O-c each touch about twenty modules; O-a is small.

---

## 7. Invariants and acceptance tests

**Invariants:**
1. The core's modules name no zone or group: no literal, no factory, no tenant.
2. A composition is the only source of kinds: a Model, the planner, the validator, the store, the page and the lab composed without a plugin hold none of its kinds, and refuse one by name.
3. With every plugin composed, behaviour is unchanged.
4. A plugin's rules are its own: its row, checks, reactions, invariants, key rows and painter in its folder.

**Acceptance tests:**
1. The core's composition lists `node` alone; production composes node, zone, group, link, pipe, in that order, from the core and three plugins.
2. A composition without the zone plugin refuses a zone, naming it, at the validator, the planner and the Model; the page composed without it draws no zone layer.
3. The planner, gesture, matrix and K8 DOM corpora are byte-identical before and after each stage.
4. A layer rule fails on a zone or group literal planted in a core module.
5. The CLI's restatements fail their test when the plugin's row changes and they do not.

---

## 8. Coverage, verification, costs

**Proves:** B280 for zones and groups, as O1 and O2 rule; the plugin contract shown on a kind that is not the network's.\
**Defers:** B282, type as composition (H19.8); the Model's questions to the network (`MODEL_READS`); a CLI that reads its kinds from the server.

**Named costs and non-claims (judgement):**
- **A large refactor with nothing a user sees:** its yield is the core naming no plugin, and a contract proven twice rather than once.
- **The CLI still restates** what it reads, held by tests rather than shared code, because it ships standalone (B138).
- **It earns its exposure on the target state, not on a consumer** (section 5.3).

---

## 9. Decisions for the director -- one at a time

- **O1 -- what the core keeps.** Recommended: **the node** -- identity and position, the anchor every plugin references, as SD11b and B282 rule -- and no other kind; H19's exit amended from "the core holds no kind" to "the core holds only the node". The alternative: the node becomes a shipped plugin too, so the core holds no kind at all -- larger, every plugin then references another plugin's kind, and it reads SD11b's "the core is anchors" against itself.
- **O2 -- when, and how far.** Recommended: **staged, zones first** (O-a to O-d), carrying the target state at the cost of a large refactor no user sees. The alternatives: the planner and the Model only -- rows, tenant and invariants move, while the canvas, CLI and export keep naming the kinds, which is smaller and leaves the core's consumers naming them; or hold B280 until a composition wants to leave a kind out or a second kind is added, as A3's earned exposure asks, closing H19 without it.

---

## 10. Axiom alignment audit (M7)

| axiom | weight | how the delta holds it |
|---|---|---|
| A3 Sovereign Composition | load-bearing, with a named tension | each kind's rules in one unit that owns them, composed through the seams the network built; against it, Earned Exposure -- no consumer yet needs a composition without zones or groups (section 5.3, O2) |
| A2 Isomorphic Specification | load-bearing | one statement of each kind's rules, in its plugin; the CLI's restatements held to it by test |
| A8 Gated Recursive Integrity | load-bearing | each stage gated on byte-identical corpora before the next depends on it |
| A13 Director Intent Amplification | supporting | two decisions, asked alone; the arc is the director's order |
| A1, A4-A7, A9-A12, A14 | not materially implicated | no state, perception, operation or deployment changes |

**Layered application:** at the composition layer, the core's rows fall to one and the plugins bring the rest; at the planner, tenants are passed rather than wired; at the canvas, the zone and group gestures and drawing reach the page as the network's do; at the CLI, restatements held by tests.\
**Guardrails for the build:** no stored change; corpora byte-identical at every stage; no registry.\
**Closeout hooks:** acceptance tests 1 to 5; the deferred items recorded with their triggers (RU3).

**Verdict: pass-with-guardrails** -- O1 and O2 ruled before O-a; the earned-exposure tension named, not hidden.

---

## 11. O1, ruled -- and what it changes here

AMENDED 2026-10-08 -- **O1 RULED: full decoupling, the node last** (`dev/DECISIONS.md`, "O1").\
The director, asked whether the node stays core: "I'm inclined to go full decoupling and move node to a plugin.\
It is entirely feasible that different plugins may leverage other plugins going forward - and our system of imports and exports can broker this - like the kubernetes CRD+Controller model".

**The to-state, amended:** the core holds no kind. It keeps what spans kinds and the anchor capability -- identity, position, occupancy and resolving a reference -- for any kind whose row declares itself an anchor; the node is the shipped plugin that declares it, and zones, groups and links are plugins beside it.

**Why it unifies, measured:**
- Kinds are composed three ways today: the core's default, unchecked, which `new Model()` takes (`model/shape.mjs:202`, `model/model.mjs:111`); the product's, checked (`planner/kinds.mjs:241`); and the reader's, the core's unchecked rows with the network's (`network/read-model.mjs:21`). With every kind a plugin's there is one: compose these plugins.
- The anchor is hard-coded as a name: `anchor: k === 'node'` (`model/shape.mjs:80`), `BARE_KIND = 'node'`, and the anchor kinds bound once to the core's own composition (`model/anchors.mjs:34`), so another composition's anchors are invisible to them. Declared by each row, they are read from the composition in use -- the move H19.10 made for transit.
- One kind depending on another is already brokered: a row's `references`, and a composition missing a referenced kind refused when built (`model/shape.mjs:156-158`). The network's link declares `references: ['node']`.

**A stage added, after O-c:**

| stage | what lands | proven by |
|---|---|---|
| **O-e** | **The node plugin:** its row and checks, its factories, typed and bare; the core's anchor capability generic over the kinds declaring it, read from the composition in use; the network, zones and groups depending on the node plugin through `references` | every corpus identical; the core composes no kind; a composition without the node plugin refuses a node, and refuses a plugin that references it, by name |

O-d, the close-out, moves after O-e; its layer rule then holds that the core names no kind at all.
**Acceptance test 1, amended:** the core composes no kind; production composes node, zone, group, link, pipe, in that order, from four plugins.

---

## 12. O2, ruled; O-a done

AMENDED 2026-10-08 -- **O2 RULED: built now, staged** (`dev/DECISIONS.md`, "O2"): O-a (H19.18), O-b (H19.19), O-c (H19.20), O-e (H19.21), O-d (H19.22).

AMENDED 2026-10-08 -- **O-a done** (H19.18).
**How a tenant reaches the planner, chosen in the build:** a row may carry its tenant, as it carries its checks and its invariants (`model/shape.mjs` `tenant`); the composition lists its rows' tenants, and the planner runs the link tenant it is passed, then those, and appends none of its own.
The other way, a `tenants` option each caller passes, was not taken: 66 call sites would carry it, and one that forgot would compose groups without their rules and say nothing.\
The network's tenant stays passed as `links`, since it is made with each network; whether it rides its row too is O-e's or O-d's to settle.
**What moved:** the group's tenant, from the planner's own list (`planner/txn.mjs`) to the group row; its two invariants, B82 and B85, from `model/invariants.mjs` to the group row, asking `planner/policy.mjs` itself rather than having each caller inject it -- a caller still passing the policy is refused, not ignored.
`model/invariants.mjs` keeps the anchor capability's own rule, one occupant to an anchor (B112).
**Held by:** `tests/tenant-from-row.test.js` -- a group row stripped of its rules runs none, and a planner appending the group tenant itself, or ignoring the rows' tenants, fails it (both mutants killed); the planner, gesture and matrix corpora and the generated reaction table are unchanged; one test restated (`tests/txn.test.js`, B85's policy).

---

## 13. O-b, in three steps; O-b1 done

AMENDED 2026-10-08 -- **O-b is built in three steps**, each gated and deployed: O-b1, the zone kind out of the core and the planner; O-b2, the canvas -- the zone's gesture, commands and drawing; O-b3, the export, REST and the CLI.\
The zone is named in 34 product modules, 280 lines of code, too many to move safely in one gate.

AMENDED 2026-10-08 -- **O-b1 done** (H19.19 stays open until O-b3).
**What moved:** the zone row, whole -- its storage facts, its checks and its cap -- to `zones/zone-kind.mjs`; its extent to `zones/zone-extent.mjs`; `makeZone` from the Model to `zones/make-zone.mjs`, minting through the Model's kind-blind `freshId`, `nextName` and `nextOrder`.
The three files are apart so the planner entry loads the row and the extent and not the factory (`tools/layers.mjs` L10).\
The core composes node and group; `planner/kinds.mjs` composes the product as node, the zones plugin's row, group, so a document lists its collections as before.\
The cell count a positioned kind's cap derives from moved to the core's grid module (`model/surface.mjs` `anchorCellsWithin`), so the node's cap and the zone's derive one way.\
**The reader composes no kinds of its own** -- the first of the three ways of composing kinds to go (section 11).\
`readModel` refuses to run without its caller's kinds; the store and the export door hand it the store's, and the CLI the product's.
**Two placements chosen in the build:**
- **A top-level folder, `zones/`, beside `network/`**, its own layer importing only the core; served by the product's server and the lab's and copied into the image as the network's folder is.
  Gathering the plugins under one folder was not taken: the network's folder would have to move with it, and every import of it change.
- **The CLI may import the planner layer, as an interim:** its reader takes the product's composition, which lives in `planner/kinds.mjs` while the node's and the group's checks do. The allowance is marked in `tools/layers.mjs` and goes at O-e, when the composition no longer needs the planner.

**Held by:** `tests/zone-plugin.test.js` -- the core composes no zone and names none; the product composes the plugin's row; `makeZone` mints as the Model did; a composition without the plugin refuses a zone at the validator, the planner and the Model; the reader composes none (a reader given its own composition back, and a Model given `makeZone` back, each fail it -- both mutants killed).
Tests that pinned the core's list as three kinds, or paired a bare Model with the product's planner, restated, each saying why; every corpus unchanged.
