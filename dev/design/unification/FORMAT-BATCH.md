# The stored format batch -- promotion's P2 (DELTA, proposed)

> **Tier 3 -- a design of record, proposed.** Written 2026-10-03 against `b63f966`.
> Facts about today's code are measured and cited by file and line; judgements are marked as such.
> Proposes; decides nothing. Section 9 lists what only the director can settle, one at a time.
> AMENDED 2026-10-03: approved, its decisions ruled (section 9).

## 1. Status

- **Asked for:** the director, 2026-10-03, approving H18.2 -- P2's design before any code.
- **Is:** stage P2 of `PROMOTION.md` section 6, with everything section 10's rulings put into it (`PROMOTION.md`, "Section 10 ruled").
- **Found while measuring, and the reason section 9 has a question about stage boundaries:** the product cannot hold stored pipes before it composes the network's planner reactions (section 5.3).
  So the pipe step of the one migration is proposed to land with P3, not P2 -- decision F2.
- **The estate it must carry,** measured again for this design from the production backup of 2026-10-02: 43 diagrams, 530 nodes, 475 waypoints, 464 links, 17 closed rings, 104 `pinned` waypoints, 4 spawners, 42 declared directions (37 forward, 5 reverse), 11 groups holding a waypoint, 1 stored selection naming one, 2,004 undo records.
  One pipe per consecutive stop pair, closing legs included, gives 783 pipes, 17 of them closing legs, and **no shared leg** once ids are compared whole.
  Compared by hex alone there are 2: the 3 node and waypoint ids sharing their hex, which is why those 3 are renumbered.

---

## 2. From-state -> to-state

**From** (measured at `b63f966`):
- **Two anchor kinds.** `node` and `waypoint` are separate kinds with separate collections (`model/shape.mjs:33`); a link's `via` holds waypoints only (`planner/kinds.mjs:210`); a node's `type` is required (`:147`); `pinned` and `spawn` exist on waypoints alone (`:186`, `:203`).
  The renderer draws waypoints in their own pass, before nodes (`app/src/renderer.js:323-324`).
  The product's code names the kind 122 times as a literal and the word 514 times; the tests and the lab, 4,172 times.
- **No stored order.** Stacking follows each collection's insertion order (B249), undo puts a restored item last (B10), and the network's link ages are session state that a reload rebuilds from listing order (`network/order.mjs`, B259).
- **Transit is session state** in the lab: a map from anchor id to its declared value (`network/transit.mjs:27`); a toggle is an edit the page builds (`transitEdit`, `:111`); the export cannot see it (B277).
- **`link.flow`** stores a declared direction as a boolean (`planner/kinds.mjs:214`) while the CLI's words for it are `forward`, `reverse` and none (`cli/verbs.mjs:357`); the name is wanted for stored flows (SD10).
- **`meta.schema` is 1,** and `validateDoc` refuses any other (`planner/validate.js:188`).
  The store forgives old shapes by repairing them before validation (`server/store.js:125`, `shedRetired`), on boot and reload (`:294`, `:621`) but not for a template (`:830`); `create` validates what the wire sends (`:764`).
- **Pipes are entities in the lab's models only** (H17.22); the product's composition has no pipe kind, and production may not import `network/` (`tests/scan-layers.test.js:747`).

**To** (at the end of P2, with the pipe step at P3 if F2 is ruled as recommended):
- **One anchor kind.** A waypoint is a node with no `type`.
  `waypoint-<hex>` becomes `node-<hex>`, keeping its hex; the 3 clashes are renumbered.
  `pinned` is gone.
  The kinds are `node`, `link`, `zone`, `group`, and the network's `pipe`.
- **Every drawn item stores its drawing order,** `order`, an integer on every node, link and zone: newest on top, the same for every peer, restored in place by undo; a link's age is its order.
- **Transit is stored on the anchor,** `transit`, present only where it differs from the type's default; a toggle is a `set`, and the cut and join it causes are planner reactions in the network's tenant.
- **`link.flow` is renamed** (decision F1).
- **Undo history starts at the cutover,** each log keeping its version (P-6).
- **`meta.schema` is 2,** reached only through one migration function, which runs on every path a document enters the store by, and in a dry run against the estate backup.
- **A ring's closing leg is routed** like any leg (P-3), in the lab.
- **At P3:** the migration also lays every link's pipes, closing legs included, and splits any shared leg into a junction (P-4).

---

## 3. The fence

The waypoint kind's elimination; the drawing-order field; transit as a stored field and its reactions; the `link.flow` rename; the undo truncation; `meta.schema` 2; the migration function, its store wiring and its dry-run tool; the ring's closing leg in the network's routing; every document in the repository migrated in source -- templates, lab seeds, the server's seed, test fixtures and corpora; the tests, scanners and records that move with them.

---

## 4. The anti-scope fence

- **Behaviour is identical wherever a ruling does not change it.** Every rule that reads "a waypoint" today reads "a node with no type" afterwards, and nothing else: a bend is a node with no type, a router is never a bend, only a node with no type may spawn, the sweep takes only nodes with no type, as it takes only waypoints today.
  The behaviour matrix is the proof; a row whose board differs beyond the renaming and the new fields is a defect.
- **Whether a node has a type is fixed when it is made.** Giving a bare node a type, or taking a type away, is refused, because it would let a bend become a router.
  Relaxing it belongs to B282's type-as-composition half, which stays held.
- **No type-as-composition** (B282's second half, held by P-10): `type` stays the stored name; transit's offers stay a code table (`network/transit.mjs`, `OFFERS`).
- **No stored flows, no plugin list** (SD10, SD12): the rename only frees the name.
- **Production is not deployed** from the first stage of this batch until the cutover (decision F3).
- **No pipe in the product's composition** before the product composes the network's reactions (decision F2).
- **No new routing behaviour** beyond P-3's closing leg.

---

## 5. The migration -- one function, run once on the estate

### 5.1 Its shape

`migrateDoc(doc)`, pure: it returns a new document and never touches its input or the disk, so the dry run and the real run transform identically by construction -- the property `tools/migrate-version.mjs` was built on.

It is **a list of steps, each keyed on the shape it repairs** -- a `waypoints` collection present, a `flow` field present, an `order` absent -- not on the schema number.\
This is the loader's existing pattern (`migrateNames`, `migrateSpawn`, `server/store.js:148`, `:188`), and it makes every step idempotent: a document already repaired passes through unchanged, and a step added at P3 repairs a document stamped 2 at P2.

**It runs on every path into the store,** before validation: boot, reload, `create` -- so an open tab from before the cutover that posts its old document is migrated rather than refused (`PROMOTION.md` section 8, "Stale tabs") -- and templates, which skip the loader's repairs today (`server/store.js:830`).\
`validateDoc` accepts schema 2 alone, so a schema 1 document can enter only through the function.

**The dry-run tool** runs the same function over a directory, boots a real store on the staged copy, and compares (section 5.4).\
It is `tools/migrate-version.mjs`'s shape -- staging, a real boot, the health-port interlock -- and is run on the estate backup at the end of every stage.

**Deleted after the cutover,** with the loader's steps and the tool, under the standing rule "transform once, then delete the transform" (`dev/DECISIONS.md`, "One named batch, last").\
Revival trigger, on the backlog row it leaves: every stored document, the backups kept for rollback included, is schema 2.

### 5.2 Its steps, in order

| step | repairs | lands |
|---|---|---|
| **renumber** | a waypoint whose hex a node holds gets a fresh hex, deterministic from the document so the dry run and the real run agree; every reference is rewritten: links' `src`, `dst`, `via`, groups' `members`, the stored selection | F-c |
| **anchors** | each waypoint becomes a node with no `type`, keeping `id` hex, `name`, `x`, `y` and `spawn`; `pinned` is dropped (P-5); the former waypoints follow the nodes in the `nodes` collection; `waypoints` is removed | F-c |
| **order** | every node, link and zone without `order` gets its place in its collection, 1 upward -- today's stacking and today's ages, unchanged | F-d |
| **direction** | `flow` becomes the name F1 rules | F-a |
| **history** | the persisted log's records are dropped and its version kept (P-6) | F-a |
| **schema** | `meta.schema` becomes 2 | F-a |
| **pipes** | each link without its pipes gets one `link` pipe per consecutive stop pair, closing leg included (P-3); a pair an older link already holds is a shared leg, and the younger link is split (P-4, section 5.3) | P3, by F2 |

Transit needs no step: no stored document has any, so every anchor starts at its type's default, which is what nothing stored means.

### 5.3 Two findings that shape it

**The product cannot hold stored pipes before P3.**\
A pipe's cross-entity check requires both ends to exist (`network/pipe-kind.mjs`), and `validateDoc` runs every row's check on load (`planner/validate.js:248`).\
The edit that deletes an anchor checks only the entities it touches, so it is the network tenant's `pipe-cascade` that deletes the anchor's pipes with it (`network/network.mjs:41`).\
The product's tenant has no such reaction.\
So a document holding pipes, edited through the product's composition before P3 composes the network's tenant, can delete an anchor, leave its pipes, and become a document the store refuses at its next boot -- a diagram that disappears from the list.\
Recommended in F2: the pipe step lands with P3, the stage that composes the network in the server; the rest of the batch is complete at P2.

**P-4 has nothing to split in the estate, and the browser can still make one.**\
The estate holds no shared leg, closing legs included.\
The browser can make one until the network is composed in production: threading an occupied bend does not split it (`PROMOTION.md` section 3.4), so a shared leg may appear before the cutover.\
The split is therefore built, not assumed away, and is applied to the younger link, the older keeping the pipe as ruled for contested pipes: the younger is cut at the shared leg's ends where they are bends (`splitAtBend`), the piece along the shared leg is deleted -- the older link draws that line -- and its declarations ride on its other pieces (`LINK_DECLARATIONS`, B284).\
A younger link that is nothing but the shared leg cannot be split without deleting it; the dry run lists it, and the cutover does not start while one exists.

### 5.4 What the dry run proves

For every diagram in the backup:
- the migrated document boots in a real store;
- every entity is equal to its source once the migration's own id map and its intended field changes are applied -- `order` added, `pinned` dropped, `flow` renamed -- and nothing else differs;
- the counts match the measurement: 43 diagrams, 1,005 nodes, 0 waypoints, 464 links, and at P3 783 pipes, 17 of them closing legs;
- at P3, every link comes up, along exactly its stored stops, in the network's own derivation -- so the drawing is unchanged;
- every log keeps its version, with no records.

Any other difference fails the run.

---

## 6. Build order -- each stage provable before the next depends on it

| stage | what lands | exit criterion |
|---|---|---|
| **F-a** | **The frame.** `migrateDoc` with the direction, history and schema steps; the store runs it on every load path, templates and `create` included; `validateDoc` takes schema 2 alone; the Model's new document says 2; the dry-run tool; the rename through the field checks, the CLI's columns and `set`, the key's action and help | the estate dry run passes; a schema 1 document through `create` comes back as schema 2; a schema 2 document carrying `flow` is refused |
| **F-b** | **One question for "a bare anchor".** Every reader that asks whether an entity is a waypoint -- the kind literal, the collection -- asks one predicate instead. No format change; the kind still exists | the planner, gesture and matrix corpora unchanged; a ratchet holds the kind literal to the predicate's own module |
| **F-c** | **The waypoint kind goes** (P-10, P-5). The renumber and anchors steps; the kinds fall to four in the product, five in the lab; the predicate becomes "no `type`"; `type` optional and fixed at creation; `via`, `spawn` and the sweep read the predicate; the pipe row references nodes only; `pinned` and the product tenant's pinned rule are gone; every document in the repository migrated in source by the function itself | no composition names `waypoint`; the estate dry run passes with 0 waypoints; every corpus rewrite equals the old one once the id map is applied |
| **F-d** | **Drawing order** (B249, B10, B259). `order` on node, link and zone, minted as one above the highest of its kind by whoever creates the item, ties broken by id; the renderer stacks by it; the network's link ages read it, and `network/order.mjs` is deleted | two tabs and a reload stack crossing links identically; undoing a delete returns the item to its place; no module imports `network/order.mjs` |
| **F-e** | **Transit stored** (TR-7). `transit` on a node, stored only where it differs from the type's default; a value the type does not offer is refused by the network; a toggle is a `set`; the cut and the join become reactions in the network's tenant, triggered by a change of `transit`; `transitEdit` is deleted; the export's roles read the field | transit survives a reload and undo (new matrix rows); the export and the canvas give the same roles on a board with transit off; no module defines `transitEdit` |
| **F-f** | **The ring's closing leg** (P-3). The network routes `dst -> src` for a closed link, the sweep keeps its pipe, and the renderer draws the route rather than closing the loop itself | a ring's closing leg is laid as a pipe, routed and kept (a new matrix row); a ring drawn before still draws the same |
| **F-g** | **The batch closed.** The estate dry run on every step; the production-upgrade register; the backlog rows closed; `PROMOTION.md` amended | the dry run reports nothing unexplained; every change in section 7 has a PU entry |

At P3, if F2 is ruled as recommended: the pipes step and the P-4 split, with the store composing the network.

AMENDED 2026-10-03 -- **F-a done** (H18.3).\
`server/migrate.mjs`'s `migrateFormatBatch` -- named apart from CS5's `migrateDoc` in `tools/migrate-version.mjs`, which a reader searching for either would otherwise find both of -- holds the direction, history and schema steps, each keyed on the shape it repairs and pure; the store admits every document through it before validation -- boot, examples, `create`, templates (which skipped the loader's repairs before) and restore -- and writes a migrated file back once.\
The document generation has one owner, `SCHEMA` in `model/shape.mjs`, read by the Model, the store, the seed and the validator, which takes 2 alone; `kernel/adapt.mjs` stamps none, since `kernel/` may not import it.\
`link.flow` is `direction` everywhere a direction is read or written: the field checks, the join and the split, both readings of which way a link faces, the arrowhead, the export's adapter, the CLI's `set` and `--direction`, and the `f` key, its command, its labels and its help.\
The templates are schema 2 in source; the lab's seeds and the server's seed carry nothing to rename.\
The dry run, `tools/migrate-schema.mjs`, boots a real store on a copy and compares every diagram with its source once the ruled changes are set aside by its own normaliser, written from the rulings rather than from the migration.\
**On the estate backup: 43 diagrams boot; 42 directions renamed in 10 diagrams; 2,004 undo records dropped from 42; every version kept; nothing else changed.**\
Corpora: the planner corpus differs in 6 cases, each only by the rename and its input digest; the gesture corpus by 5 lines and the matrix corpus by 3 notices, each only by the rename.\
Mutants: 21 -- 20 killed by the tests as written; the survivor, a migrated file not written back, killed once its test stopped booting through a helper that marks every adopted diagram dirty; the dry run's own undo check shown to fail by disabling the history step.

AMENDED 2026-10-03 -- **F-b done** (H18.4).\
`model/anchors.mjs` says how a bare anchor is stored, and every reader asks it: `BARE_KIND`, the kind an op names; `ANCHOR_KINDS`, read from the kind table's anchor rows; `isBareEntity(kind, entity)`; `bareAnchor` and `bareAnchors` over anything answering `get` and `all`; `anchorOf`, which the Model's `endpointOf` now is; and `bareAnchorsOf` over a plain document.\
Fifty readers in 22 modules moved behind it -- the canvas's commands, input, renderer, snap, palette and pick; the Model; the planner's reactions, tenants and validation; the relations index, spawners and situation; the network's view, keys, session, host, transit, pipe row and tenant; REST and the anchor resolver.\
Where a reader told a waypoint from a node by its kind alone, it asks of the entity now -- the relations index's buckets, REST's links and group, the renderer's two paths, the stranded reaction, transit's offers, the situation's target -- so F-c can make the answer depend on `type`.\
What still names the kind does so for a reason, recorded per file in `tests/bare-anchor.test.js`, which ratchets the literal in every product module: the kind's own rows, the loader's repairs, the CLI (standalone, B138), `kernel/` (which may not import `model/`, C9), and the canvas's and scene's word for what is drawn, which F4 keeps.\
The planner, gesture and matrix corpora are unchanged, byte for byte; the estate dry run unchanged.\
Mutants: 14 on the module and the readers that now ask of the entity, 13 killed by the tests as written; the survivor -- REST reading a waypoint's links as a node's, which misses a bend -- killed by a new test of `about` on a bend.

AMENDED 2026-10-03 -- **F-c done** (H18.5).\
A waypoint is a node with no `type`: the kind table holds four kinds, `type` is optional, and `pinned` and `spawn` joined the node's fields.\
The node row's cross-entity check holds the line the kind boundary held -- whether a node has a type is fixed when it is made, `pinned` and `spawn` are a waypoint's alone, and `shape`, `span` and `content` a typed node's alone -- and `validateMutation` judges a `put` as it stands, not merged over what it replaces, so a put that drops a type is seen.\
`model/anchors.mjs` answers "a node with no type", and adds `isTypedEntity` and `typedNodes` for the readers that meant a typed node when they said `node`: the renderer's passes, the occupancy index, the picker, the label editor, `L`'s link, the readout, the clone set, select-all, the tower world and the anchor resolver; the word the canvas and the situation say for a node, `waypoint` or `node`, is `model/anchor-words.mjs`'s.\
The two clear reactions both hear a node deleted and each acts on its own shape of node; the reaction table says so.\
The migration gained two steps, keyed on the `waypoints` collection: `renumber` moves a waypoint whose hex a node holds to the next free hex, deterministically, and `anchors` moves every waypoint into the nodes and rewrites every reference -- links' ends and bends, groups, the stored selection and the reveal's beats; the history step now runs first, and also clears a log beside a schema 2 document that still holds waypoints.\
The CLI reads the wire through one view that keeps its two words, and names an old `waypoint-` id's new id; the export's adapter draws a node with no type as a waypoint; `docs/spec/API.md` is amended.\
Every document in the repository is migrated in source -- the four templates by the function itself, the lab's seeds and the behaviour matrix by the id map -- and each was checked equal to its source once the id map is applied.\
**On the estate backup: 43 diagrams boot; 475 waypoints become nodes, 1,005 in all; 3 renumbered, in 2 diagrams; nothing else changed.**\
Corpora: the matrix corpus and the 84 rows unchanged, byte for byte; the gesture corpus differs only where an op on a waypoint now names kind `node` (9 lines); every one of the planner corpus's 2,089 cases equals the old once the id map, the op kind and the input digest are set aside; the K8 DOM snapshot differs only by 4 ids.\
P-5 is CORRECTED (`dev/DECISIONS.md`): a node with no type is still a waypoint the sweep may take, so `pinned` stays until P3, where it goes with production's orphan rule; F-c changes no behaviour.\
Found on the way: the loader's naming repair read the kind table's collections, which no longer list `waypoints`, so two unnamed old waypoints could both be named `waypoint-1`; it now reads the old collection by name, and a test that failed without the fix holds it.\
Mutants: 27, on the module, the node row, the put view, the clear reactions, the migration's steps, the adapter, the CLI's view, the occupancy index and the canvas readers -- all 27 killed.

AMENDED 2026-10-03 -- **F-d done** (H18.6; B249, B10, B259 closed).\
Every node, link and zone stores `order`, a positive integer: one above the highest of its kind, stamped by whoever creates the item -- the Model's factories in a tab, the planner for a creation that arrives without one, the migration for a stored document, in the order each collection lists its items.\
The planner gives a creation its order as a `set` after the put it was sent, never by rewriting the put: a tab must know its own echo, and rewriting it made the answer pull a dragged node back (tests/b242-reconcile.test.js C4); the set's inverse is the put's, so undo carries no extra op.\
A put that replaces an item and omits its order keeps the item's own, and one that changes nothing else is still no change.\
One comparator, `byDrawingOrder` (model/stacking.mjs; restated in kernel/adapt.mjs), stacks the canvas's layers and the export and ages the network's links; an item without an order is the oldest -- first written as the newest, which made a link the planner had just stamped older than every unstamped link on a board and changed which pipe one corpus case swept.\
The canvas places each item among its layer's on every render, and again when its order changes, so undo, another writer's answer and a re-render leave it in its place (B10); a clone and a cut's new piece are drawn newest, the piece that keeps a link's id keeps its order.\
A link's age is its order (network/view.mjs `ageIn`): the session record, `network/order.mjs`, is deleted, and the drag judge ages links as the canvas does.\
**On the estate backup: every node, link and zone of 42 diagrams is given its collection position; the dry run checks each collection rising in the order it was listed, and nothing else changed.** The templates are migrated in source, each differing only by its orders, 1 to n per collection.\
Corpora: the planner corpus differs in 304 of 2,090 cases, each only by the orders given -- inverses equal once order fields are set aside; the gesture corpus only by the orders the factories stamp (269 fields); the matrix corpus in 21 rows only by the DOM order of the waypoints layer, whose rings never overlap, and in 3 by the stacking of links: CAP-06's undone link returns beneath the other (B10), and in SRC-01 and TRN-15 the piece that keeps a cut link's id keeps its place under the newer piece.\
Measured in Chrome on the lab: a link deleted and undone returns beneath the link drawn after it, though the planner's collection lists it last.\
Mutants: 23 -- 20 killed by the tests as written; two survivors killed by new tests (the migration's ordering of a collection that already holds an order, and the drag judge's ages); the dry run's wiring of its order check survives, its check itself shown to fail three ways.

AMENDED 2026-10-03 -- **F-e done** (H18.7; TR-7).\
A node stores `transit`, a boolean, where its author chose other than its type's default; the network's transit rules read it off the model each is asked about and keep nothing, so the tab, the planner's model, every peer and the export agree, and a reload keeps it (a store round-trip test).\
`x` is an edit: the session hands over a set of each anchor's `transit`, or a whole put without it when the flip returns to the default, and the page commits it as one edit labelled `transit`; a toggle refused for every anchor commits nothing.\
The cut is the planner's, `transit-cut`, in a new transaction phase, `cut`, before the stranded pass, the sweep and the join: a waypoint whose transit changed and now stops what arrives cuts each link bending there, re-ending the link the author drew -- its id, its order, its declarations -- and putting the new piece newest, with an id derived from the link and the waypoint, so every peer mints the same piece; each waypoint is cut on the board the cuts before it left (B283).\
The join is the shared `link-join`, woken in the network's tenant by a waypoint's `transit` changing (`wakesAt`); the classic tenant wakes on nothing new.\
A tenant now carries REFUSALS as well as reactions -- rules held on the result, as data with a trigger, judged after the phases: the network's first refuses a transit a type does not offer, from any door, a retype included. The reaction table shows the `cut` phase and the `refuse` rows.\
The notice is said when the planner answers, from its ops (`transitSummary`): a cut is a re-put and the put of its piece in a row, so a piece cut from a piece is traced to its drawn link (B283's counting).\
The export reads the stored field: a waypoint whose transit is off takes endpoints only and draws the transit ring, as the canvas does (B277), held by a parity test. The CLI sets it with `transit on|off|default` (A5). `transitEdit`, `cutAt` and `joinAt` are deleted.\
Corpora: the gesture corpus unchanged; the planner corpus differs in 110 cases, each only by a restored node carrying its stored `transit: false` -- undo restores transit now; the matrix corpus differs in 5 rows only by a version one higher (a toggle that cuts nothing is an edit now, where it was session state), and gains TRN-35 and TRN-36: a cut at P undone restores P's transit and the one link, and redone cuts it again.\
Found on the way: the cut first trusted its trigger, and the TG-3 shadow -- every reaction handed every change -- caught it cutting at a waypoint merely moved while off; it reads what each change is now.\
Measured in Chrome on the lab: `x` at P cuts the link and says so, undo restores P and the one link with no ring, redo cuts it again with the ring.\
Mutants: 16 -- 13 killed as written; the three survivors (a host's stored off drawn as declared, a cut where nothing stops, the CLI's word for off) killed by new tests.

AMENDED 2026-10-03 -- **F-f done** (H18.8; P-3).\
A closed link's stops return to its start (`network/pipes.mjs`), so its closing leg is routed, called and held like any leg, and a ring can be down on it; the derivation's key includes `closed`, so closing a link re-derives its board.\
`ring-pipe`, in the network's tenant, lays a link pipe from a ring's end back to its start when a link is closed (or made closed) and no pipe joins them -- in the planner's `reshape` phase, renamed from `cut` since it now holds two reactions, before the sweep; the sweep wakes on `closed`, so opening a ring sweeps the pipe, and undo takes it back with the close.\
The canvas still draws the ring closed; the route's repeated start is dropped before drawing, so no point is drawn twice.\
No format change: `closed` was stored already. The 17 estate rings get their closing pipes from the migration's pipe step, at P3 (F2).\
Corpora: the planner, gesture and matrix corpora unchanged; three matrix rows added -- RING-01 closes the `bend` board's link (a third link pipe, the ring up), RING-02 opens it again (swept), RING-03 undoes the close (pipe gone).\
Measured in Chrome on the lab: `c` on the bend board's link draws the ring closed and up, over three link pipes.\
Mutants: 8 -- 6 killed as written; two survivors (a ring's closing leg not among the legs it calls, and a down ring not keeping its closing pipe) killed by new tests.

Each stage is one gate and one lab deploy.

**Size, by judgement:** F-b and F-c are most of it -- the word appears 514 times in product code and 4,172 in tests and the lab.
F-b exists so that F-c's diff is a change of storage behind one question, not 122 decisions made at once.

---

## 7. Behaviour that changes, stated before it is built

**For people and agents** (each a PU entry):
- **Ids.** Every `waypoint-<hex>` becomes `node-<hex>`; an agent or script holding an old id must look it up again.
  Names are unchanged and still resolve.
  The 3 renumbered ids change their hex as well.
- **The declared direction's field is renamed** in `set`, `show`, `get` and REST (F1).
- **Undo history before the cutover is gone** (P-6).
- **Deleting a pin deletes its link** in existing diagrams -- 302 bends on 90 links become pins (P-7); this reaches production with P3, and is recorded now because it was ruled with the batch.
- **Stacking is the same for everyone** and survives undo (B249, B10); today a peer can see a different order.
- **Transit and link ages survive a reload** in the lab.
- **Old images cannot read the new format,** so the rollback is the backup (P-8).

**In the behaviour matrix:** rows gain the new fields and the renamed ids; new rows for transit across reload and undo, stacking across undo, and the ring's closing leg.
Nothing else changes.

---

## 8. Coverage, verification, costs

**Proves:** P-3 (in the lab), P-5, P-6, P-9, P-10; B249, B10, B259; TR-7; B282's waypoint half; B277's export parity; `PROMOTION.md` P2's exit criteria, with stored pipes at P3.\
**Defers:** stored pipes and P-4 to P3 (F2); P-7 and P-8 to the cutover; B282's type-as-composition half; SD10, SD12.

**Verification targets:** the estate dry run at every stage; the planner, gesture and matrix corpora, rewritten only through the id map and the new fields, each rewrite diffed; a round-trip test of the migration -- idempotent, pure, deterministic; mutants on each step, on the store's wiring of it, and on the order mint.

**Named costs and non-claims (judgement):**
- **Larger than P1,** and the largest stage of promotion: it changes production code everywhere a waypoint is named.
- **Production is frozen** for the whole of P2 and P3 to P9 under F3; a fix it needs in that window is built on a branch.
- **It does not show pipes stored in the product,** or two peers agreeing on routes -- both need P3.

---

## 9. Decisions for the director -- one at a time

- **F1 -- the new name for `link.flow`** (P-9). Recommended: `direction`, stored as `forward` or `reverse`, absent meaning none -- the words the CLI and the help already use, and a stored value that says what it means. The alternatives: `forward`, a boolean as today; or another name.
- **F2 -- where stored pipes land.** Recommended: with P3, which composes the network's tenant in the server, so the product never holds a pipe it cannot keep; the migration's pipe step and the P-4 split land there, and the rest of the batch at P2. The alternatives: a temporary pipe cascade in the product's tenant at P2, written to be deleted a stage later; or composing the network in the server at P2, which makes P3 part of P2.
- **F3 -- production during the batch.** Recommended: production stays on `draw:2538ab8` from F-a until the cutover; a fix it needs is built on a branch from `2538ab8`, deployed from there and landed on `main`. The alternatives: build the batch on a branch, so `main` stays deployable, with every lab change merged twice; or migrate production at F-a, before it composes the network.
- **F4 -- the word for a node with no type.** The format and the ids say `node`. Recommended: people and agents keep calling it a waypoint -- the key, the help and `draw` verbs unchanged, a waypoint being a node with no type. The alternatives: `anchor` everywhere; or `node` everywhere, with no word of its own.

AMENDED 2026-10-03 -- **F1 to F4 RULED as recommended** (`dev/DECISIONS.md`, "P2's design decisions, F1 to F4"): `direction`, stored as `forward` or `reverse`; stored pipes and the P-4 split with P3; production frozen on `draw:2538ab8` until the cutover; the word waypoint kept.\
The build is H18.3 to H18.9, one stage each, F-a to F-g.

---

## 10. Axiom alignment audit (M7)

**Identity:** this delta, against `b63f966`, measured against mission-kit A1-A14.\
**Verdict: pass-with-guardrails** -- F1 to F4 ruled before F-a.

| axiom | weight | how the delta holds it |
|---|---|---|
| A2 Isomorphic Specification | load-bearing | one anchor kind where the ruling of 2026-09-22 has one; one migration function for the dry run and the real run; drawing order and link age one field |
| A1 Sovereign State Transparency | load-bearing | transit and link ages leave tab memory for the document, where every peer and agent reads them |
| A8 Gated Recursive Integrity | load-bearing | the estate dry run at every stage; F-b proves the predicate before F-c changes what it reads |
| A3 Sovereign Composition | supporting | pipes enter the product only with the tenant that keeps them (F2); transit's offers stay the network's, checked by its tenant |
| A5 Perceptual Parity | supporting | the export reads stored transit, so it draws the roles the canvas draws |
| A13 Director Intent Amplification | supporting | four decisions, asked one at a time; every behaviour change named before it is built |
| A4, A6, A7, A9-A12, A14 | not materially implicated | |

**Tensions.**
- **"No legacy" against the loader's repair (A2).** The store carries a migration until the cutover.
  Resolved by deleting it after the cutover, with a revival trigger, as the loader's earlier repairs are named for deletion.
- **One batch against two stages (A2 against A3).** The pipe step lands a stage after the rest.
  Accepted under F2: the migration runs on the estate once, at the cutover, whole; only its code arrives in two stages.

**Guardrails:** the matrix edited only through the id map, the new fields and the rows section 7 names; the estate dry run passes at the end of every stage; production stays frozen under F3; the backup stays private and never enters the repository.
