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
CORRECTED 2026-10-08, taking up O-b2: "a zone plugin needs no new seam on the page" is wrong.\
Input's plugin seam is `{ owner, keys, judgeDrag }`, and a plugin's key rows act only through `addStop` and `selected` (`app/src/input.js` `PLUGINS`); press rows, gestures, releases, handles, picking and per-kind drawing have no plugin seam.\
The network's own kind is no exception: the link is drawn by `app/src/renderer.js` and made by the product's link gesture, and the network judges a finished drag, adds two keys and paints its pipes.\
So moving a kind's canvas into its plugin needs a canvas plugin contract first, which this design does not hold (section 14).

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

---

## 14. Finding at O-b2 -- the canvas has no seam for a plugin's kind

AMENDED 2026-10-08 -- **O-b2 stopped before code.**\
Measured at `c20ad2a`: the zone's canvas spans Input's own machinery -- Shift as the zone layer (`app/src/pick.js`), the draw gesture and its release (`app/src/input.js`, `app/src/releases.js`), corner handles (`app/src/overlay.js`), the `Z` and Shift+arrow keys, move and clone treating a zone as positioned, zone snapping (`app/src/snap.js`), drawing (`app/src/renderer.js`) and the zone grid (`app/src/compose-canvas.js`).\
None of it reaches Input through a plugin seam, and none of the link's does either (section 5.2, corrected).\
Building one for zones alone would be a contract shaped by one consumer; the kinds that would use it are four -- zone, group, node and the network's link.\
The choice of how to proceed is the director's.

AMENDED 2026-10-08 -- **O3 RULED: the core first, the canvas designed after** (`dev/DECISIONS.md`, "O3").\
The stages now: O-c, the group out of the core and the planner (H19.20); O-e, the node (H19.21); O-d, closed with a rule that the core and the planner name no kind (H19.22); then the canvas plugin contract, designed for zone, group, node and link together (B308, H19.23).\
O-b closed at O-b1; its canvas, export and CLI steps are H19.23's.

---

## 15. O-c done -- the group out of the core and the planner

AMENDED 2026-10-08 -- **O-c done** (H19.20).
**What moved:** the group row, whole -- storage facts, checks, its members-exist check, its two invariants, its tenant and its cap -- to `groups/group-kind.mjs`; its rules and the threshold they and its invariants ask, `groupAfterRemoval`, to `groups/group-rules.mjs`, where `planner/tenants.mjs` and part of `planner/policy.mjs` were (the first deleted); `makeGroup` and `groupOf` from the Model to `groups/make-group.mjs` and `groups/group-of.mjs`.
The core composes the node alone; `planner/kinds.mjs` composes node, the zones plugin's row, the groups plugin's row, so a document lists its collections as before.
**One row capability added, as the 2026-10-02 ruling anticipated:** a row may gather one of its list fields (`model/shape.mjs` `gathers`).
The Model's `gathererOf` finds the entity listing an id, of any kind that gathers, and its selection pulls in the whole list -- so it does for a group what it did by name, and names no group.\
The relations index keys membership the same way (`engine/relations.mjs`), so a composition without groups rebuilds its index rather than failing on a kind it does not hold.
**Held by:** `tests/group-plugin.test.js` -- the core composes the node alone; the core, the planner and the index name no group; `makeGroup` and `groupOf` answer as the Model did, from the index and from the scan; a group row that gathers nothing selects a member alone; a composition without the plugin refuses a group and its index holds (a Model selecting by name, and an index rebuilding by name, each fail it -- both mutants killed, the second only once the test attached the index as the page does, which it had not).
Tests that pinned the core as node and group, built a bare Model to hold groups, or imported the moved policy, restated; every corpus unchanged.

---

## 16. O-e, re-shaped -- the core holds only the anchor (DELTA, proposed)

AMENDED 2026-10-08 -- **proposed for approval; no code until then.**\
Written against `dfc3d51`.\
AMENDED 2026-10-08 -- **APPROVED** by the director after a walk-through of the field split, the two contract additions and the width exception: "approved, build O-e1".

### 16.1 What the director ruled

Asked to walk through O-e as section 11 planned it -- the whole node row into a plugin, the core holding no kind -- the director asked: "Maybe an "anchor" is a core concept, and a "node" is a plugin? i.e a node composes and injects multiple capabilities including behaviour and appearance etc from other plugins on top of entity anchor?"; then "Why do anchors have "types" ?"; then "Are anchors and nodes separate things?\
Can core hold anchor, and plugin bring "node" that composes on top?"\
Then: "The core holds only the anchor.\
An anchor occupies a single cell on a grid.\
A wide device that occupies multiple cells has multiple anchors.\
A wide device that occupies a single cell has a single anchor."\
Shown that the split keeps the core's duty exact, and keeps the system's clean only if a wide device becomes a stored thing of its own that gathers stored anchors -- a change to the stored format, so B282's -- the director agreed to O-e now with the width exception below, and the multi-anchor device in B282's design: "Yes agreed."\
And confirmed, measured: "Zones do not target anchors though, only grid cells" (section 16.5).\
Recorded as O4 (`dev/DECISIONS.md`); it amends O1's "the core holds no kind" to "the core holds only the anchor".

### 16.2 From-state -> to-state

**From** (measured at `dfc3d51`):
- **The core's one kind is the node,** whose row holds the anchor's facts and the device's: id, name, x, y and order, and type, shape, span, content and spawn (`model/shape.mjs` `TABLE`; checks in `planner/kinds.mjs`); the network adds `transit` (`network/kinds.mjs`).
- **`type` does two jobs:** it names what a device is, and -- since F-c merged waypoints into nodes (P-10) -- it marks a device apart from a waypoint, which 30 product modules ask through `model/anchors.mjs` (`isBareEntity`, `isTypedEntity`, `typedNodes`, `bareAnchors`, `bareAnchor`).
- **The core Model makes devices and waypoints** (`makeNode`, `makeTextBox`, `makeWaypoint`) and answers two cell questions by device-ness (`occupiedAt`, `waypointAt`); `engine/situation.mjs` and `model/anchor-words.mjs`, core modules, name the thing under the pointer by the drawn word, waypoint or node (F4).
- **Occupancy reads a device field:** a wide device covers several cells, and the one-per-cell rule and its index read `span` to know which (`engine/relations.mjs` `cellsOf`).
- **Production holds 144 wide devices** in 22 of its 40 diagrams -- 135 text panels and 9 hosts -- covering 1,481 cells.

**To:**
- **The core holds one kind, the anchor:** identity and one cell -- id, name, x, y and drawing order.
  It is stored as `node`, so ids (`node-<hex>`) and the collection keep their names and no stored document changes.
- **An anchor carries no type.**
  The devices plugin (`devices/`) composes a device onto an anchor: it adds `type`, `shape`, `span` and `content`, with their cross-field rules -- a device is composed when the anchor is made and stays (today's "a node's type is fixed when it is made"), and shape, span and content belong to a device alone.
  It owns the factories (`makeNode`, `makeTextBox`, `makeWaypoint`), the question whether a device is composed on an anchor, and the drawn word.
- **The simulation adds `spawn`,** with its rule that a spawner sits on an anchor no device is composed on; the network adds `transit`, as now, reading the device's type.
  Each depends on the devices plugin, checked when the app is assembled (O1).
- **The core keeps the anchor capability:** resolving a reference to an anchor of any anchor kind (`endpointOf`), the shared id space (`freshId`), one occupant to a cell (B112), and which anchor is on a cell (`occupiedAnyAt`).
  "Which device" and "which waypoint" on a cell are the devices plugin's, over that.

### 16.3 The width exception, recorded

The ruling's anchor occupies one cell; today's wide device is one anchor covering several.\
Until B282 makes a wide device several anchors, the one-per-cell rule and its index keep reading the device's `span` -- the one place the core reads a plugin's field.\
It is named in the layer rule that holds the core (O-d), so it cannot spread, and it ends in B282's build.\
CORRECTED 2026-10-08, building O-e2: the one-per-cell rule does not read `span` -- B112 compares anchor points (`model/invariants.mjs`), so a cell a wide device covers is guarded by the occupancy index alone (`engine/relations.mjs` `cellsOf`), a module of the network's rung, not the core's.\
No core module reads `span`; the exception is the index's, and O-d names it there.

### 16.4 Two additions to the field contract

A plugin that adds fields to another plugin's kind brings a check per field today (S-a, `model/shape.mjs` `EXTENSION_KEYS`).\
The devices plugin also needs:
- **nested fields** (`span`, `content`), which a copy must copy deeply -- an extension may declare its `composite` fields;
- **cross-field rules** over the entity -- an extension may bring its `refers`, run beside the owner's, each in its plugin.

No footprint hook is added: section 16.3's exception stands in for it until B282.

### 16.5 Zones, and the word "anchor"

Measured: a zone's row is no anchor and references nothing, nothing references a zone, and the one-per-cell rule counts anchors only.\
What relates a zone to anchors is geometry, computed when read -- REST's contents and enclosing zones (`server/rest.js`), and "place inside a zone", which picks the free anchor nearest the zone's centre within it (`server/anchor.mjs` `at.inside`).\
The zones plugin needs the grid, the core's, and nothing of the anchor's.

The REST API calls a grid point an "anchor" on both grids -- `GET .../anchors`, `nearestAnchor`, "a zone anchor".\
Once the core's anchor is the entity on one cell, that sense needs its own name; renaming it changes what agents call, so it is recorded (B310) rather than done here.

### 16.6 Build order

| stage | what lands | proven by |
|---|---|---|
| **O-e1** | **The device vocabulary and factories to `devices/`:** whether a device is composed, the drawn word, `makeNode`, `makeTextBox`, `makeWaypoint`; the Model's device-ness cell questions to the plugin; `engine/situation.mjs` to the plugin rung, its readers being the canvas and the network; the index asking the plugin | every corpus identical; the core's modules name no device vocabulary |
| **O-e2** | **The device fields off the core's row:** `type`, `shape`, `span`, `content` as the devices plugin's extension, with its `composite` and `refers` (section 16.4); `spawn` as the simulation's | every corpus identical; a composition without the devices plugin refuses a device field by name, one without the simulation `spawn` |

Then O-d closes the arc: the layer rule that the core and the planner name no kind but the anchor, with section 16.3's exception named; the product's composition moved below the planner, and with it the CLI's interim allowance.
**Size, by judgement:** O-e1 large -- about 30 modules re-pointed and some 125 test lines; O-e2 moderate.

### 16.7 Acceptance tests

1. The core composes one kind, `node`, whose row checks id, name, x, y and order and nothing else; production composes node, zone, group, link, pipe, in that order.
2. A composition without the devices plugin refuses `type`, `shape`, `span` and `content` on an anchor, naming each; without the simulation, `spawn`.
3. The core's modules name no device field and no device vocabulary, but for section 16.3's `span`.
4. The planner, gesture, matrix and K8 DOM corpora are byte-identical before and after each stage.

### 16.8 Axiom alignment audit (M7)

| axiom | weight | how it holds |
|---|---|---|
| A3 Sovereign Composition | load-bearing | the anchor's duty in the core, the device's in its plugin, each composed through rows and extensions; one named exception, bounded and ended by B282 |
| A2 Isomorphic Specification | load-bearing | one statement of whether a device is composed, in the devices plugin; the export's restatement (`kernel/adapt.mjs`) held to it by test |
| A8 Gated Recursive Integrity | load-bearing | each stage gated on byte-identical corpora |
| A4 Zero-Loss Knowledge | supporting | the director's words recorded whole (O4) |
| A13 Director Intent Amplification | supporting | the shape is the director's; the format change it implies is routed to B282 rather than taken here |
| the rest | not materially implicated | nothing stored, deployed or perceived changes |

**Verdict: pass-with-guardrails** -- the width exception named in the layer rule; no stored change; corpora identical at every stage.

AMENDED 2026-10-08 -- **O-e1 done** (H19.21 stays open until O-e2).
**What moved:** whether a device is composed on an anchor -- `isBareEntity`, `isTypedEntity`, `bareAnchor`, `bareAnchors`, `typedNodes` -- from `model/anchors.mjs` to `devices/device-shapes.mjs`; the drawn word, `model/anchor-words.mjs`, to `devices/anchor-words.mjs`; `makeNode`, `makeTextBox` and `makeWaypoint` from the Model to `devices/make-node.mjs`; the Model's `occupiedAt` and `waypointAt` to `devices/occupancy.mjs`.
`model/anchors.mjs` holds the anchor alone -- `BARE_KIND`, `ANCHOR_KINDS`, `anchorOf` -- and the core Model reads no `type`; its `occupiedAnyAt` asks for the anchor's stored kind by name rather than by literal.\
`engine/situation.mjs` left the core layer for the network's rung, since it names what is under the pointer by the drawn word.\
The node row's typed test in `planner/kinds.mjs` is restated locally, as a row's checks are, until O-e2 moves that rule to the devices plugin.
**Held by:** `tests/devices-plugin.test.js` -- the core's anchor module holds the anchor alone and the core Model asks no device question; the plugin's factories mint as the Model did; its cell questions answer from the index and from the scan alike (a scan that counts any anchor as a device, and an index asked the wrong question, each fail it -- both mutants killed).
In-page test strings that called the Model's factories import the plugin's from the served folder; tests that called the moved methods call the plugin's functions; every corpus unchanged.

AMENDED 2026-10-08 -- **O-e2 done, and O-e with it** (H19.21).
**What moved:** the node row's device fields -- `type`, `shape`, `span`, `content` -- from `planner/kinds.mjs` to the devices plugin's extension, `devices/device-fields.mjs` `DEVICE_FIELDS`, with their checks and the rule that a device stays a device and its fields are a device's alone; `spawn` to the simulation's, `engine/spawn-field.mjs` `SPAWN_FIELDS`, with its rule that a device carries no spawner.
The anchor's row checks id, name, x, y and order, and the core's storage row declares `order` alone optional and nothing nested.\
`hasDevice` (`devices/device-fields.mjs`) is the one statement of whether a device is composed; `devices/device-shapes.mjs` and the spawner's rule build on it.
**The field contract, extended (section 16.4):** an extension may declare its nested fields (`composite`) and bring a cross-field rule (`refers`), checked when the composition is built and run after the owner's.
Every message a writer meets is unchanged -- the type rule first, then the device's fields, then the spawner, as the one rule ran them.
**Held by:** `tests/device-fields.test.js` -- the three refusals word for word; production's node fields owned by the devices plugin, the simulation and the network; an anchor composed without the devices plugin refusing a device field by name; an extension's malformed nesting or rule refused when built; an edit setting a nested field to what it holds writing nothing (an extension rule run before the owner's, and the nesting dropped, each fail it -- both mutants killed, the second only once the behaviour was tested rather than the declaration).
Two tests that read the optional fields from the core's map restated; every corpus unchanged.
