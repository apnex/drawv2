---
instant: target
system: drawv2
---

# drawv2 - target architecture

**Instant: target.**\
The system drawv2 is going to be, stated as though it exists.\
It is the current architecture (`docs/ARCHITECTURE.md`, derived from the code) plus every ratified decision not yet built, and it moves when a ruling does; why drawv2 exists is `VISION.md`, and no build order appears here (mission-kit AR1).

**What fixes it:** the rulings in `dev/DECISIONS.md`, cited by id.\
A question no ruling settles is not answered here; it is in the owed-and-open register (section 9), with the recommendation the director is asked to rule on.

| Section | Maturity | Reopens on |
|---|---|---|
| 1. Identity, scope and non-goals | provisional | `VISION.md` changing |
| 2. Justification chain | provisional | a ruling changing the model |
| 3. Axiom alignment | provisional | a ruling, or a tension resolved |
| 4. Anchored core | provisional | a part's duty changing |
| 5. A type is a composition | provisional | a ruling on packs or types; the decisions owed in section 9 |
| 6. Entity model and interfaces | provisional | a format change |
| 7. Run time | provisional | a door's lifecycle changing |
| 8. Verification and divergence | provisional | a check added, or a divergence closed |
| 9. Owed and open | provisional | each entry's ruling |

Approval is aggregate, by the director; each section stays open to reopen on its trigger.

---

## 1. Identity, scope and non-goals

**Maturity: provisional.**

drawv2 is a programmable geometric engine.\
A document declares geometry -- anchors placed on a grid, and the connections between them -- and everything else is a consequence of that geometry, derived identically by everyone watching (`VISION.md`).

**In scope:** a document of anchors on stored grids; plugins that compose capability onto an anchor -- what a device is and how it looks, how anchors connect, regions, named sets, derived motion; a type as the name of a composition of packs; one write, planned once, applied at every door; the doors -- a browser page, a lab page, a REST and websocket server, a CLI, a headless export.

**Non-goals, from the vision:**
- **Not a drawing tool:** a position is a statement about where a thing is, never where it was dropped.
- **No rule lives at one door:** what the browser computes, the server, the CLI and an agent compute the same.
- **No stored state a derivation can supply:** roles, routes, whether a link is down and motion are derived, never stored.
- **No policy over packets yet:** permit or deny over flows is named so nothing excludes it, and is not designed (`dev/DECISIONS.md`, "The universal node, staged", amended 2026-09-22).

---

## 2. Justification chain

**Maturity: provisional.**

Each layer cites only the layers above it.

**Domain.**\
Diagrams of systems, made into worlds with physics: a diagram stops being a picture of a system and becomes a world computed identically by every viewer (`VISION.md`).

**Axioms in force** (mission-kit, `axioms/`): A3 Sovereign Composition, A2 Isomorphic Specification, A1 Sovereign State Transparency, A5 Perceptual Parity, A11 Cognitive Minimalism, A8 Gated Recursive Integrity, A14 Compounding Learning, A13 Director Intent Amplification; the others bear lightly (section 3).

**North star.**\
Derived physics that everyone watching computes identically (`VISION.md`; the unification survey's anchor, `dev/surveys/unification-survey.md`).

**Principles -- the outcome axes the director accepted** (`dev/surveys/unification-survey.md`, S0):
- **AX1 derived, not stored:** what geometry and a clock can compute is computed; the document states intent.
- **AX2 parity at every door:** browser, server, CLI and REST compute the same thing.
- **AX3 expressiveness:** compositions inexpressible before become expressible.
- **AX4 extensible physics:** a capability arrives without an engine change.
- **AX5 conceptual economy:** fewer kinds and special cases to learn.
- **AX6 one-way doors few, named and last:** irreversible changes to stored documents are rare and deliberate.

**Decisions** -- the rulings that fix the structure below:
- **The universal node, staged** (2026-09-19, amended 2026-09-22): the anchor is the core; endpoint, bend and junction are what the graph makes of an anchor, derived; a type declares which roles it permits, per type; a violation is refused; a named type is a composition of packs, and a per-type permission table and a pack registry are one lookup; appearance and routing are pack families; appearance resolves per state.
- **SD1 to SD12, the stack interface** (from 2026-09-27): browsers and server derive, the CLI asks (SD1); the planner runs the rules for every door (SD2); a pack is only its table (SD4); one pipe per pair (SD7); a declared flow is part of the document (SD10); the network is a plugin and a world without connections carries no pipes (SD11, SD11b); each document lists the plugins it needs (SD12).
- **N1, N5:** plugins bring their own kinds, composed at build; the core keeps only what spans kinds (N1); names are a service a kind opts into (N5).
- **O1, O4:** every kind is a plugin's; the core holds only the anchor, identity and one cell; an anchor carries no type (O4).
- **G3:** a plugin contributes fields to a kind it does not own.
- **Q1:** a plugin's questions are asked of the plugin; the Model holds what is attached and reads none of it.
- **D1 to D5:** the whole canvas contract; gestures as rows over shared gestures (D2); several plugins draw one kind through the appearance pipeline (D3); a plugin's edits are data (D5).
- **The palette** (2026-10-01): one core palette, roles per owner.
- **P-10:** `type` stays the stored name; packs become code tables keyed by it.
- **WD1, WD6 to WD10:** a wide device is one anchor (WD1); a diagram stores its grids as layout records (WD6), holding today's values until the infinite canvas (WD7); a device owns its size (WD10).
- **H21** (2026-10-11): the unification's approach, this architecture among it.

**Model.**\
The **anchor** is the core: identity and one cell, reachable by connections.\
A **pack** is a table a plugin contributes.\
A **composition** is a named set of packs; a **type** is a composition's name.\
A **node** is an anchor with what plugins compose onto it; a bare anchor -- a waypoint, by the word people use -- is the composition with the fewest packs.\
Everything a node shows or does is derived from its composition and the document, and nothing derived is stored.

---

## 3. Axiom alignment

**Maturity: provisional.**

| Axiom | Weight | How the architecture stands -- or the tension, left open |
|---|---|---|
| A3 Sovereign Composition | load-bearing | each plugin owns one concern and composes onto the anchor through declared contracts; the product is the only place plugins meet. **Tension:** the network imports the devices plugin to read a device's composition (`tools/layers.mjs` ALLOWED); a type's routing pack makes the network read the composition instead of the device -- section 5 |
| A2 Isomorphic Specification | load-bearing | a device type is declared once and every door reads it. **Tension:** the CLI is installed alone and imports nothing (B138), so it either asks the server for the types or keeps a copy held equal by a test -- owed, section 9 |
| A1 Sovereign State Transparency | load-bearing | the document states its grids (WD6) and the plugins it needs (SD12); roles and routes are computed, never stored |
| A5 Perceptual Parity | load-bearing | an agent reads what a viewer sees -- a route, whether a link is down, an anchor's role -- from the server (SD1) |
| A11 Cognitive Minimalism | load-bearing | a pack is a table, not a mechanism (SD4); a type is a name pointing at tables. **Tension:** the 2026-09-22 record's caution that packs "must be earned by composing two" -- answered: three plugins compose fields onto the anchor (devices, network, simulation) |
| A8 Gated Recursive Integrity | load-bearing | the planner is the one write; a document a door cannot hold is refused (B307); the gate holds the layers, the kinds and the records |
| A14 Compounding Learning | load-bearing | the current architecture is generated, so the distance to this target is measured, not reported (section 8) |
| A13 Director Intent Amplification | supporting | this document tracks the rulings and asks the director only the questions in section 9 |
| AX6 (survey) | supporting | `type` stays the stored name, so a type becoming a composition changes no stored document (P-10). **Tension:** SD12's plugin list is a new field in every document -- a format change, named here |
| A4, A6, A7, A9, A10, A12 | supporting or not materially implicated | records append-only; failures surfaced at the door; deploys gated; no agent context assembly in the product |

---

## 4. Anchored core

**Maturity: provisional.**

### 4.1 Parts

One duty each; where each lives today is in the current architecture's layers (`docs/ARCHITECTURE.md`, section 2).

| Part | Duty | Kind |
|---|---|---|
| `lattice` | Compute geometry on the grid | core |
| `kind-contract` | Compose kinds from the rows plugins declare | core |
| `document` | Hold one document's entities | core |
| `palette` | Hold the colours every role draws from | core |
| `primitives` | Draw the shapes painters compose | core |
| `relations` | Index which entities relate | the network's rung |
| `planner` | Make the one write every door applies | core service |
| `layouts` | Declare a diagram's grids | plugin |
| `devices` | Compose a device onto an anchor | plugin |
| `network` | Connect anchors | plugin |
| `zones` | Bound regions of cells | plugin |
| `groups` | Name sets of anchors | plugin |
| `simulation` | Derive motion along routes | plugin |
| `product` | Compose the plugins into the product | composition |
| `canvas` | Turn input into edits through the parts' declarations | host |
| `renderer` | Draw a document through the parts' painters | host |
| `sync` | Keep a tab converged with the server | host |
| `product-page` | Compose the product page | composition root |
| `lab` | Compose the canvas over the real modules, without storage | composition root |
| `store` | Keep documents durable | door |
| `hub` | Carry each change to the tabs watching a document | door |
| `rest` | Answer agents over HTTP | door |
| `cli` | Give an agent one command per verb | door |
| `export` | Render a document without a browser | door |

### 4.2 What the parts expose

| Part | Exposes |
|---|---|
| `lattice` | the lattices' arithmetic -- cells, snapping, the nearest anchor -- and a path's geometry |
| `kind-contract` | the row contract a kind is declared by; extension rows (G3); the entities every document holds (WD6); a composition |
| `document` | a document's entities by kind, the one name namespace kinds opt into (N5), the anchor |
| `palette` | the palette's values; each plugin names its own roles over it (the palette ruling) |
| `primitives` | frames, glyph placement and region layout, the pieces every painter and the export draw with |
| `relations` | which links meet an anchor, which anchor holds a cell, which group gathers a member |
| `planner` | plan, commit, undo and redo over a composition's rows and tenants, every plugin a tenant alike; document validation |
| `layouts` | the layout kind, its two records in every diagram, the anchor's place, the grids drawn from the records |
| `devices` | the device fields (type, shape, span, content); the appearance pack family -- glyph art, glyph box, frame, content -- and the placement packs -- the palette's tiles and digits; a device's footprint and size (WD10) |
| `network` | the link and pipe kinds; the transit field; the routing pack family -- the roles a composition permits and the transit it offers; the reactions that cut, join and lay legs; the queries a route answers |
| `zones` | the zone kind, its gestures, its grid's use |
| `groups` | the group kind, its tenant, gathering by members |
| `simulation` | the spawn field; the behaviour pack family -- a tower's numbers; movers, run mode and their appearances |
| `product` | the product's composition of kinds and canvas parts, and its device types, each a composition of packs (section 5) |
| `canvas` | press rows, gestures, keys and the hand, each a part's declaration over shared gestures (D1, D2) |
| `renderer` | every kind drawn through its part's painter or appearances, composed per state (D3) |
| `sync` | an outbox replayed after reconnect; the server's answer applied; a tab reloaded onto a new revision |
| `store` | documents loaded, completed with what every document holds, validated, written back |
| `hub` | snapshots and changes to every session on a document |
| `rest` | the routes an agent drives, including an anchor's role, a route and the device types (SD1) |
| `cli` | verbs for every route, each asking the server for what the server derives (SD1) |
| `export` | a document drawn to SVG, its kind knowledge in the export layer, none in the core (N1) |

### 4.3 What each part consumes

- **Every plugin** consumes the `kind-contract` (to declare its rows), the `document` (to read entities) and the `lattice`; none consumes another plugin's internals, and a plugin that reads another's kind reads it through the `product`'s composition or that plugin's exposed queries (O1, Q1).
- **The `network`** consumes a node's composition -- which routing pack its type includes -- not the devices plugin's fields; whether an anchor may bend, join or pass a route is read from that pack (section 5).
- **The `planner`** consumes a composition's rows and every tenant the composition brings, the network's among them, with no slot of its own for any plugin (SD11b).
- **The `canvas` and `renderer`** consume the canvas parts the `product` composes, and name no plugin's kind (D1).
- **The doors** (`store`, `hub`, `rest`, `cli`, `export`) consume the one composition the `product` makes, so each holds the same rules (SD2).
- **The `cli`** consumes `rest` alone (SD1).

---

## 5. A type is a composition

**Maturity: provisional.**

This is the unification's centre: what a device is, said once.

- **A pack is a table** a plugin contributes, and nothing else (SD4): the derivation that reads it is the plugin's, the writes it implies are the planner's tenants'.
- **The pack families:**
  - **appearance** -- the devices plugin's: a glyph's art and box, a frame, how content regions lay out;
  - **routing** -- the network's: which roles an anchor may take -- endpoint, junction, bend -- and the transit it offers;
  - **behaviour** -- the simulation's: a tower's numbers, for a type that is one;
  - **placement** -- the devices plugin's: whether a type is a palette tile, and its place there.
- **A type is a composition:** a name, and the pack it takes from each family it uses.
  It is declared once; every plugin reads its own family's pack through that one declaration, so adding a type is one declaration, and no type name appears outside it.
- **A per-type permission table and a pack registry are one lookup** (2026-09-22): asking what a server permits is asking which routing pack the server composition includes.
- **A bare anchor** is the composition with the fewest packs: a routing pack permitting every role, no appearance beyond the network's marks; it stops being distinguishable rather than being deleted (2026-09-22).
- **Roles are derived, per type:** whether an anchor is an endpoint, a bend or a junction is what the graph makes of it, within what its routing pack permits; a join that would make an anchor a bend its pack forbids does not happen.
- **A violation is refused in the validator** (2026-09-22), where the permission belongs; whether a pin through a stop that offers no passage is refused or cut is owed (SD5, section 9).
- **Appearance resolves per state** (2026-09-22; D3): a device that the graph makes a junction draws its junction mark composed over its frame.
- **The stored name does not change** (P-10): a node's `type` is its composition's name, so no stored document migrates when a type becomes a composition.

---

## 6. Entity model and interfaces

**Maturity: provisional.**

### 6.1 The stored document

| Part | Holds |
|---|---|
| `meta` | id, name, version, schema, owner, grants, and the plugins the document needs (SD12) |
| `layouts` | the diagram's two grids, each a record of name, pitch, offset and extent, holding today's values (WD6, WD7) |
| `nodes` | anchors: id, name, position, order -- and the fields plugins contribute: the devices plugin's type, shape, span, content; the network's transit; the simulation's spawn |
| `links` | connections: their stops, closure, direction and plane (the network's) |
| `pipes` | adjacencies between two anchors, keyed by the pair, and how each was laid (SD7) |
| `zones` | regions of cells (the zones plugin's) |
| `groups` | named sets of members (the groups plugin's) |
| `selection`, `reveal` | the authoritative selection; a reveal's beats |

A peer lacking a plugin the document lists refuses the document (SD12).\
A name is a service the anchor opts into, unique across every named kind (N5; confirmation owed, section 9).

### 6.2 The interfaces between parts

- **The row contract** (`kind-contract`): a kind's owner, collection, fields with their checks, what it opts into -- selection, names, the anchor, a tenant, gathering -- what it refers to, its cap, its invariants, and the entities every document holds.
- **Extension rows** (G3): a plugin's fields on a kind it does not own, each with its check and its cross-field rule.
- **Tenants:** a plugin's reactions to an edit, declared triggers over the change set, run by the planner for every plugin alike.
- **Canvas parts:** what a plugin brings to the page -- painters and appearances, picks, places, press rows, handles, the hand, keys, labels, size steps, grids, descriptions, tallies -- composed by the canvas without naming the plugin (D1 to D5).
- **Queries** (Q1): a plugin's own functions over a document -- a link's path and route, whether it is down, what blocks it.
- **Pack tables** (SD4): each family's tables, keyed by pack name; a type's composition names one per family (section 5).
- **The doors:** REST routes, the websocket's commands, the CLI's verbs -- each listed, derived, in the current architecture, section 6.

---

## 7. Run time

**Maturity: provisional.**

- **An edit, at any door:** the door states intent as ops; the planner checks each op against its kind's row and the contributed rows, runs every tenant's reactions on the change set, checks every invariant, and answers with the one write; the store applies it, logs its inverse and broadcasts it; every tab applies the answer.
- **In a tab, before the answer:** the tab plans the same edit with the same planner and shows the result at once (SD2), then takes the server's answer and replays its own unanswered edits over it.
- **Loading a document:** the store reads it, completes the entities every document holds, refuses one in a format it does not read or listing a plugin it lacks, validates it, and reports any invariant it breaks.
- **Reading:** a route, an anchor's role, whether a link is down and where a mover is are derived on demand, identically in a tab, on the server and for an agent.
- **A new revision:** a tab detects it, says why, and reloads onto it.
- **The lab:** the canvas composed over the real modules with one authority in the page and no storage.

---

## 8. Verification and divergence

**Maturity: provisional.**

### 8.1 How a claim is proved

- **The gate** proves the layers, the kinds' composition, the records, every test, and that the current architecture says what the code declares (its steps are listed, derived, in `docs/ARCHITECTURE.md`, section 8).
- **The ratchets** hold what shared code may name of a plugin, each exception with its reason and its trigger.
- **The corpora and the behaviour matrix** hold behaviour equal across changes and across both pages.
- **The sync fuzz** holds a tab converged with the server under reorder and disconnect.

### 8.2 Divergence -- what this states and the current instant does not

The distance between this document and `docs/ARCHITECTURE.md`, each row carried by a backlog row; the table shrinks as rows close.

| This target states | The current instant | Carried by |
|---|---|---|
| a device type is declared once, as a composition of packs; no type name appears outside it | eight tables in five files key on a type's name (`dev/design/unification/UNIFICATION-AUDIT.md`, section 3.1) | B282 |
| a type's routing pack decides whether an anchor may bend, join or pass a route | whether a node has a type decides it | B282 |
| a device the graph makes a junction draws its junction mark over its frame | nothing draws it | B331 |
| the planner and the canvas compose the network as any plugin | the planner takes a `links` option and the canvas a `network` slot | B332 |
| the core holds the palette; each plugin holds its colour roles and its glyph art | `kernel/theme.mjs` holds the zone, group, link and waypoint roles and the device glyph art | B338 |
| an agent reads an anchor's role; the CLI asks the server what the server derives | no door serves a role; the CLI derives combat and movers and restates a rule | B339 |
| each document lists the plugins it needs | no document does | B248 |
| the export door's knowledge of kinds lives in the export layer, none in the core | the core's geometry module holds the zone and group elements the export draws | B330 |

---

## 9. Owed and open

**Maturity: provisional.**

### 9.1 Decisions owed -- each with the recommendation the director is asked to rule on

| Question | Recommendation, and why |
|---|---|
| Does the anchor keep its `name`? The 2026-09-22 record lists name among what is not universal; N5 later made names a service each kind opts into | **Keep it, as the anchor opting into the naming service** -- N5 is the later and more specific ruling, every entity is addressable by name for agents (B187), and nothing stored changes |
| A pin through a stop that offers no passage: refused or cut? (SD5, never asked) | **Refused, at every door** -- the 2026-09-22 ruling puts a violation in the validator, and a cut rewrites what the author drew |
| Who holds a type's composition: the product or the devices plugin? | **The product** -- a type draws packs from three plugins' families, and composing plugins is the product's one duty; each plugin keeps its own pack tables |
| How does the CLI learn the types? | **From the server** (SD1) -- the CLI asks for what the server holds, and its copy and the test that holds it equal (B167) retire |

### 9.2 Open -- ratified but undesigned, or held with a trigger

| Topic | Standing |
|---|---|
| Flows: a flow declared once along a path, seen end to end | ratified in principle (SD10, SD6); undesigned; parked by the director (B327) |
| Links side by side over one pipe | held until designed (B256) |
| The export door drawing through the painters | held (B330) |
| Anchors along a wide device, and which one a link ends at | held until a wide device needs links at more than one point (B282; WD1) |
| A diagram varying its grids | held until the infinite canvas is designed (B325; WD7) |
| Unloading what is out of view | held until the infinite canvas is designed (B289) |
| Policy over packets and flows | out of scope; named so nothing excludes it (2026-09-22) |
