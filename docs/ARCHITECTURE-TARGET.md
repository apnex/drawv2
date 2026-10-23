---
instant: target
system: drawv2
---

# drawv2 - target architecture

**Instant: target.**\
The system drawv2 is going to be, stated as though it exists.\
It is the current architecture (`docs/ARCHITECTURE.md`, derived from the code) with every ratified decision not yet built absorbed; why drawv2 exists is `VISION.md`, and no build order appears here (mission-kit AR1).

**What fixes it:** the rulings in `dev/DECISIONS.md`, cited by id or heading.\
A question no ruling settles is not answered here; it is in section 9, with the recommendation the director is asked to rule on.
**What ratifying covers:** sections 1 to 8, and section 9 only as a register.\
Ratifying rules no question in section 9.1 and adopts none of its recommendations; each is ruled by its own block in `dev/DECISIONS.md` when its stage reaches it (H21) -- the anchor's name with this document, the rest with the type's composition.
**What is generated:** the parts of the anchored core -- each part's duty, kind, fixing rulings and what it consumes -- are declared once in `tools/layers.mjs` and rendered into both documents by `tools/generate-architecture.mjs`, so the two instants carry the same components; the imports in the code that the target does not allow are measured into the current document.

| Section | Maturity | Reopens on |
|---|---|---|
| 1. Identity, scope and non-goals | approved (H21.6) | `VISION.md` changing |
| 2. Justification chain | approved (H21.6); its axioms amended by A-5 | a ruling changing the model |
| 3. Axiom alignment | approved (H21.6); its axioms amended by A-5 | a ruling, or a tension resolved |
| 4. Anchored core | approved (H21.6); a type's one declaration settled by U4-1 | a part's duty or its consumes changing |
| 5. A type is a composition | approved (H21.6); settled by U4-1, U4-2, U4-3 | a ruling on packs or types |
| 6. Entity model and interfaces | approved (H21.6); the anchor's name settled by N5a | a format change |
| 7. Run time | approved (H21.6) | a door's lifecycle changing |
| 8. Verification and divergence | approved (H21.6) | a check added, or a divergence closed |
| 9.1 Decisions owed | owed -- not approved by ratifying this document | each question's ruling |
| 9.2 Open | provisional | each entry's ruling |
| 9.3 Alignment with mission-kit | provisional; a register, not structure (A-0) | each owed design's trigger; B343 |

Approval is aggregate, by the director, recorded as H21.6 in `dev/DECISIONS.md`; each section reopens on its trigger.

---

## 1. Identity, scope and non-goals

**Maturity: approved (H21.6).**

drawv2 is a programmable geometric engine.\
A document declares geometry -- anchors on a grid, and the connections between them -- and everything else is a consequence of that geometry, derived identically by everyone watching (`VISION.md`).

**In scope:** a document of anchors on stored grids; plugins that compose onto an anchor -- what a device is and how it looks, how anchors connect, derived motion; plugins of their own kinds over the grid -- regions of cells, named sets of anchors; a type as the name of a composition; one write, planned once and applied at every door; the doors -- a browser page, a lab page, a REST and websocket server, a CLI, a headless export.

**Non-goals, from the vision:**
- **Not a drawing tool:** a position is a statement about where a thing is, never where it was dropped.
- **No rule lives at one door:** what the browser computes, the server, the CLI and an agent compute the same.
- **No stored state a derivation can supply:** roles, routes, whether a link is down and motion are derived, never stored.
- **Not policy over packets:** permit or deny over flows is named so nothing excludes it, and is undesigned (`dev/DECISIONS.md`, "The universal node, staged", amended 2026-09-22).

---

## 2. Justification chain

**Maturity: approved (H21.6); its axioms amended by A-5.**

Each layer cites only the layers above it.

**Domain.**\
Diagrams of systems, made into worlds with physics: a diagram stops being a picture of a system and becomes a world computed identically by every viewer (`VISION.md`).

**Traits** (mission-kit, `traits/`): drawv2 is stateful (T1) -- the server owns the diagrams; multi-agent (T3) -- people and agents write one diagram; autonomous (T4, INFERRED) -- the server sweeps expired locks and runs unattended.\
It is not declarative (T2) -- derivation is not reconciliation toward a declared end state -- and not llm-in-the-loop (T5).

**Axioms in force,** by those traits and the floor (mission-kit, `axioms/`; A-5): A3 Sovereign Composition, A4 Zero-Loss Knowledge, A8 Gated Recursive Integrity, A9 Chaos-Validated Deployment and A14 Compounding Learning, the floor; A1 Sovereign State Transparency, by T1; A5 Perceptual Parity, A6 Frictionless Agentic Collaboration, A7 Resilient Agentic Operations, A10 Autopoietic Evolution and A13 Director Intent Amplification, by T3 and T4.\
Not in force: A2 Isomorphic Specification, which binds declarative systems, and A11 Cognitive Minimalism and A12 Precision Context Engineering, which bind systems with a language model in the loop; what this architecture took from A2 and A11 is held, in part, by the outcome axes AX2 and AX5 (section 3).

**North star.**\
Derived physics that everyone watching computes identically (`VISION.md`).\
Noted for PC1: AR1 asks for the system's north star and this one is the programme's; the mission-kit's own exemplar does the same, a disagreement between the entry and its exemplar recorded rather than resolved here.

**Principles -- the outcome axes the director accepted** (`dev/surveys/unification-survey.md`, S0): AX1 derived, not stored; AX2 parity at every door; AX3 expressiveness; AX4 extensible physics; AX5 conceptual economy; AX6 one-way doors few, named and last.

**Decisions** -- the rulings that fix the structure below:
- **The universal node, staged** (2026-09-19, amended 2026-09-22): endpoint, bend and junction are what the graph makes of an anchor, derived; a type declares which roles it permits, per type, the table living with the type definition, and a violation is refused; a bare anchor is the table's unrestricted row; appearance and routing are pack families; appearance resolves per state.
- **A type is the name of a composition** (2026-10-02): what survives of "type" is the name an author picks for a composition, and the core does not know what it means.
- **P-10** (2026-10-03): `type` stays the stored name, and packs are code tables keyed by it, with no format change.
- **The stack interface:** browsers and server derive, the CLI asks (SD1); the planner runs the rules for every door (SD2); a pack is only its table (SD4); a pin through a type offering no passage is refused while a stop whose transit is off cuts (SD5); one pipe per pair (SD7); the network is a plugin (SD11); the core is anchors, identity and position, with no notion of connection, and the network contributes pipes, links and the rules that react to edits (SD11b); each document lists the plugins it needs (SD12).
- **H17-D1, H17-D6, U4-1, U4-2, U4-3:** the lab lives in this repository, in its own folder (H17-D1); one type table in the devices plugin names each type's pack in each family -- appearance, routing and run-mode behaviour (U4-3) -- and its map letter, and is handed to the other plugins at composition (U4-1, reversing H17-D6's "imported by its users" and amending SD11b and 2026-10-07); the server serves the device types, and the CLI asks the server for them rather than keeping a copy (U4-2).
- **Transit:** a pin is cut where transit goes off (TR-2); `w` on an anchor whose transit is off makes two links ending there (TR-2b); which types offer transit is configuration the network plugin brings (2026-10-07); a device pin follows transit's rules only (Z1).
- **N1, N5, N5a:** plugins bring their own kinds, and the core keeps only what spans kinds (N1); names are a service a kind opts into (N5), and the anchor kind opts into it (N5a).
- **O1, O4:** every kind is a plugin's; the core keeps what spans kinds and the anchor capability -- identity, position, occupancy, resolving a reference -- and a plugin depends on another's kind brokered at composition (O1); the core holds one kind, the anchor, which carries no type (O4).
- **G3:** a plugin contributes fields to a kind it does not own.
- **Q1:** a plugin's questions are asked of the plugin.
- **D1 to D5:** the canvas contract, the canvas naming no plugin's kind beyond a record that may only fall (D1); draw-a-link the product's shared gesture with the network as its judge (D2); several plugins draw one kind through the appearance pipeline (D3); a plugin's edits are data (D5).
- **H2:** run mode and the download are one rendering, one place for code.
- **H9, access** (amended 2026-08-20; `docs/spec/ACCESS.md`, "Decided"): access is per diagram and per owner, a principal is a person's identity or an agent's, and a connection code is an agent's credential.
- **The palette** (2026-10-01): one core palette, roles per owner.
- **WD1, WD6, WD7, WD10:** a wide device is one anchor (WD1); a diagram stores its grids as layout records (WD6) holding today's values (WD7); a device owns its size (WD10).
- **H26-1, H26-2, H26-4, H26-6, H26-8, H26-10, H26-11:** a grid's arithmetic is `snap-grid`'s, what an input means, and when each phase of a gesture is due, is `input-binding`'s, the platform's input events reach the canvas as facts through `input-capture`, and what the canvas draws is shown through `vector-scene`, each a component of one duty that knows nothing of drawv2 (H26-1); each component is its own public repository, released by its own CI, drawv2 pinning the release file by its hash, its server importing it by name and its pages through a generated import map (H26-2); `snap-grid`'s design is ratified, the `lattice` part alone composing it (H26-4); `input-binding`'s design is ratified, the `rules` part alone composing it (H26-6); `input-capture`'s design is ratified, the `canvas` part alone composing it (H26-8); each further boundary of the canvas layer is drawn first inside drawv2 as a declared part, held by the scanners and extracted when its second consumer is in sight, the editing duty the first (H26-10); `vector-scene`'s design is ratified, the `renderer` part alone composing it (H26-11).

**Model.**\
The **anchor** is the core: identity and position on one cell (SD11b, O4); connection is the network plugin's.\
A **pack** is a code table a plugin contributes, keyed by type (SD4, P-10).\
A **type** is the name of a composition; a **node** is an anchor with what plugins compose onto it, and a node with no type is a bare anchor -- a waypoint, by the word people use (P-10).\
The anchor kind opts into the naming service, so every anchor -- device or waypoint -- is named (N5, N5a).\
Everything a node shows or does is derived from its composition and the document.

---

## 3. Axiom alignment

**Maturity: approved (H21.6); amended by A-5.**

Weighed by M7 -- load-bearing, supporting, or not materially implicated -- over the axioms in force (section 2; A-5).

| Axiom | Weight | How the architecture stands -- or the tension, left open |
|---|---|---|
| A3 Sovereign Composition | load-bearing | each plugin owns one concern and composes onto the anchor through declared contracts; the product composes the plugins. **Tensions:** a node's `type` is the devices plugin's field, yet it names a composition other plugins' packs are keyed by; the network asks the devices plugin whether a device is composed on an anchor to decide its roles, where the routing table's unrestricted row answers it (2026-09-22) -- measured in the current document's part divergence |
| A1 Sovereign State Transparency | load-bearing | the document states its grids (WD6) and the plugins it needs (SD12); roles and routes are computed, never stored |
| A5 Perceptual Parity | load-bearing | an agent reads what a viewer sees -- a route, whether a link is down, an anchor's role -- from the server (SD1) |
| A8 Gated Recursive Integrity | load-bearing | the planner is the one write; a document a door cannot hold is refused; the gate holds the layers, the parts, the kinds and the records |
| A14 Compounding Learning | load-bearing | the current architecture is generated, and the imports the target does not allow are measured; the semantic divergence is listed by hand, row by row (section 8) |
| A7 Resilient Agentic Operations | supporting | a link whose way is gone is shown down at every door and heals when a way returns; a refusal is said at the door that made it |
| A6 Frictionless Agentic Collaboration | supporting | people and agents write one diagram through the same planner, and the selection each makes is seen by the others |
| A4 Zero-Loss Knowledge | supporting | each change carries its inverse in the diagram's log, and a deleted diagram stays restorable through its retention window |
| A9 Chaos-Validated Deployment | supporting | a deploy passes the gate, and a format change is rehearsed on a copy of production before it lands (WD9) |
| A13 Director Intent Amplification | supporting | this document tracks the rulings and asks the director only the questions in section 9 |
| A10 Autopoietic Evolution | not materially implicated | nothing in the product revises itself; the system changes only through rulings and gated work |

**AX2, parity at every door, holds what this architecture took from A2:** each device type is declared once in the devices plugin, naming its pack in each family and its map letter, handed to the other plugins at composition (U4-1), and served by the server so the CLI asks for the types rather than keeping a copy (U4-2).

**AX5, conceptual economy, holds what it took from A11:** a pack is a table keyed by type, not a mechanism (SD4, P-10).\
Three families compose onto a type -- appearance, routing and run-mode behaviour (U4-3) -- answering the 2026-09-22 record's caution that packs composing must be earned by composing at least two.

**AX6, a principle rather than an axiom:** `type` staying the stored name keeps a type's composition out of stored documents (P-10); SD12's plugin list is a new field in every document, a format change named here.

---

## 4. Anchored core

**Maturity: approved (H21.6); a type's one declaration settled by U4-1.**

### 4.1 Parts

Generated from `tools/layers.mjs` `PARTS`, and each part's components from its `COMPONENTS`; the current document renders the same parts with the modules each is made of today, and the parts and components each imports.

<!-- BEGIN GENERATED: architecture-target-parts. Run tools/generate-architecture.mjs; do not edit by hand. -->
| Part | Duty | Kind | Fixed by | Consumes | Composes |
|---|---|---|---|---|---|
| `lattice` | Compute geometry on the grid | core | O1 | -- | `@apnex/snap-grid` |
| `kind-contract` | Compose kinds from the rows plugins declare | core | N1, G3, WD6 | -- | -- |
| `document` | Hold one document's entities | core | O1, O4, Q1 | `kind-contract`, `lattice` | -- |
| `relations` | Index which entities relate | core | O1 | `document`, `kind-contract`, `lattice` | -- |
| `colours` | Hold the colours every role draws from | core | N1 | -- | -- |
| `primitives` | Draw the shapes painters compose | core | N1, D3 | `lattice`, `colours` | -- |
| `rules` | Decide what an input means | core | D2 | -- | `@apnex/input-binding` |
| `planner` | Make the one write every door applies | core | SD2, O1 | `kind-contract`, `document`, `relations`, `lattice` | -- |
| `layouts` | Declare a diagram's grids | plugin | WD6, WD7 | `lattice`, `kind-contract`, `document` | -- |
| `devices` | Compose a device onto an anchor | plugin | O4, WD10 | `lattice`, `kind-contract`, `document`, `relations`, `colours`, `primitives`, `rules` | -- |
| `network` | Connect anchors | plugin | SD11, SD11b, O1 | `lattice`, `kind-contract`, `document`, `relations`, `colours`, `primitives`, `rules` | -- |
| `zones` | Bound regions of cells | plugin | O1, O4 | `lattice`, `kind-contract`, `document`, `layouts`, `colours`, `primitives`, `rules` | -- |
| `groups` | Name sets of anchors | plugin | O1 | `lattice`, `kind-contract`, `document`, `relations`, `colours`, `primitives`, `rules` | -- |
| `simulation` | Derive what the clock drives | plugin | AX1, AX4, SD11b | `lattice`, `kind-contract`, `document`, `relations`, `colours`, `primitives`, `rules`, `network`, `devices` | -- |
| `product` | Compose the plugins into the product | composition | N1, D1 | `kind-contract`, `lattice`, `colours`, `layouts`, `devices`, `network`, `zones`, `groups`, `simulation` | -- |
| `canvas` | Turn input into edits through the parts' declarations | host | D1, D2, D5 | `lattice`, `kind-contract`, `document`, `relations`, `rules`, `planner`, `renderer`, `editing`, `primitives`, `colours` | `@apnex/input-capture` |
| `editing` | Let a person select, move and resize what the canvas draws | host | D1, H26-10 | `document` | -- |
| `renderer` | Draw a document through the parts' painters | host | D1, D3 | `lattice`, `document`, `primitives`, `colours` | `@apnex/vector-scene` |
| `sync` | Keep a tab converged with the server | host | SD2 | `document`, `kind-contract`, `canvas` | -- |
| `product-page` | Compose the product page | composition root | D1 | any part -- a composition root | -- |
| `lab` | Compose the canvas over the real modules, without storage | composition root | H17-D1 | any part -- a composition root | -- |
| `server` | Compose the server | composition root | SD2 | any part -- a composition root | -- |
| `access` | Establish who a request comes from | door | H9 | -- | -- |
| `placement` | Choose the free anchor a relationship names | door | SD1 | `lattice`, `document`, `relations`, `devices` | -- |
| `store` | Keep documents durable | door | SD2, WD6 | `document`, `kind-contract`, `lattice`, `planner`, `product`, `relations`, `access`, `placement`, `network` | -- |
| `hub` | Carry each change to the tabs watching a document | door | SD2 | `store`, `planner`, `document`, `kind-contract`, `access` | -- |
| `rest` | Answer agents over HTTP | door | SD1, Q1 | `store`, `hub`, `planner`, `document`, `kind-contract`, `product`, `lattice`, `access`, `layouts`, `network`, `devices`, `zones`, `groups`, `simulation` | -- |
| `cli` | Give an agent one command per verb | door | SD1 | -- | -- |
| `export` | Render a document without a browser | door | H2 | `lattice`, `document`, `kind-contract`, `primitives`, `colours`, `product`, `renderer` | -- |
<!-- END GENERATED: architecture-target-parts -->

### 4.2 What the parts expose

| Part | Exposes |
|---|---|
| `lattice` | the grids, opened from `snap-grid` -- the node grid, and any lattice record's (H26-1, H26.1) -- and a path's geometry |
| `kind-contract` | the row contract a kind is declared by; extension rows (G3); the entities every document holds (WD6); a composition |
| `document` | a document's entities by kind; the one name namespace kinds opt into (N5); the anchor capability's identity and reference resolution (O1) |
| `relations` | the anchor capability's occupancy -- which anchor holds a cell (O1) -- and which entities refer to an anchor, by the references their rows declare |
| `colours` | the one palette's values; each plugin names its own roles over it (the palette ruling) |
| `primitives` | the shapes every painter composes, none a plugin's own (N1) |
| `rules` | one match, or none, for an input among declared rows, and a gesture session deciding when each phase of a gesture is due, both from `input-binding` (H26-6) |
| `planner` | plan, commit, undo and redo over a composition's rows and every tenant it brings, each alike; document validation; the invariants a write keeps |
| `layouts` | the layout kind, its two records in every diagram, the anchor's place, the grids drawn from the records |
| `devices` | the device fields -- type, shape, span, content; the one type table, naming each type's pack in each family and its map letter (U4-1, U4-2); the appearance family -- glyph art and box, frames, content regions; a device's footprint and size (WD10) |
| `network` | the link and pipe kinds; the transit field; the routing family -- the roles a pack permits and whether it offers transit (2026-10-07), handed each type's routing pack at composition (U4-1); the reactions that cut, join and lay legs; the queries a route answers |
| `zones` | the zone kind and its gestures, over the zone grid |
| `groups` | the group kind, its tenant, gathering by members |
| `simulation` | the spawn field; the behaviour family -- a run-mode behaviour pack's stats, such as a tower's, handed each type's pack at composition (U4-1, U4-3); what the clock drives -- movers along routes, towers, the reveal -- and their appearances |
| `product` | the product's composition: every kind, the network's among them, every canvas part, and handing each plugin its slice of the type declarations (U4-1) |
| `canvas` | press rows, gestures, keys and the hand, each a part's declaration over shared gestures, the platform's events reaching them through `input-capture` (D1, D2, H26-8) |
| `editing` | the selection, and what shows what an edit will do -- the crosshair, the snap box, the previews, the stamp ghost, the handles and the datum -- as items of the scene it is handed (H26-10, H26-11) |
| `renderer` | every kind drawn through its part's painter or appearances, composed per state (D3), and shown through `vector-scene` (H26-11) |
| `sync` | an outbox replayed after reconnect; the server's answer applied; a tab reloaded onto a new revision |
| `product-page`, `lab`, `server` | the product page, the lab page and the server, each composed from the product |
| `access` | who a request comes from: a person's identity, an agent's connection code, a websocket's origin |
| `placement` | the free anchor that satisfies a relationship an agent names, so an agent places as it asks (SD1) |
| `store` | documents loaded, completed with what every document holds, validated and written back |
| `hub` | snapshots and changes to every session on a document |
| `rest` | the routes an agent drives, an anchor's role and the declared device types among what they serve (SD1, U4-2) |
| `cli` | a verb for each route, asking the server for what the server derives (SD1) |
| `export` | a document drawn to a file through the same rendering run mode draws (H2) |

### 4.3 How the parts consume one another

The table in 4.1 lists each part's consumes; these rules bound them.\
`tools/generate-architecture.mjs` holds the ceiling each kind sets (`tools/layers.mjs` `KIND_MAY_CONSUME`), a part's one consume beyond its kind only where a ruling in section 2 names it (`beyondKind`), and no cycle; the rules naming one part -- the network's, the planner's, the CLI's -- are held by that part's consumes, and the rest by review.
- **The core consumes the core alone** (N1, O1).
- **A plugin consumes the core, and another plugin only through its queries and factories** (O1, Q1).
- **The network decides an anchor's roles from its routing table** (P-10, 2026-10-07), a bare anchor being the table's unrestricted row (2026-09-22) -- not from asking the devices plugin whether a device is composed there.
- **The planner consumes a composition's rows and every tenant it brings,** with no part of its own reserved for any plugin (SD2, SD11b).
- **The canvas and the renderer consume the core and each other, never a plugin,** beyond D2's record of the draw-a-link gesture (D1, D2).
- **The doors consume the core, the product's composition, one another, and a plugin's queries and factories** (SD2, Q1); none composes a plugin's rows itself.
- **The export door alone consumes the renderer, because the download draws through it** (H2).
- **The CLI consumes the server over HTTP,** importing no product module, for everything the server derives (SD1).

---

## 5. A type is a composition

**Maturity: approved (H21.6); settled by U4-1, U4-2 and U4-3.**

What a device is, said once per family.
- **A type is the name an author picks for a composition** (2026-10-02); the core does not know what it means, and a node's `type` is that name, stored as it is (P-10).
- **A pack is a code table keyed by type** (SD4, P-10): the derivation that reads it is its plugin's, and the writes it implies are the planner's tenants'.
- **The pack families ruled in scope** (2026-09-22, U4-3):
  - **appearance** -- the devices plugin's: a glyph's art, box and map letter (U4-2), a frame, how content regions lay out;
  - **routing** -- the network's: the roles an anchor may take -- endpoint, junction, bend -- and whether it offers transit, which is the network's pack configuration (2026-10-07), each type's routing pack named in the devices plugin's one type declaration and handed to the network at composition (U4-1);
  - **behaviour** -- the simulation's: a run-mode behaviour pack's parameters, such as a tower's range, beam, cooldown and damage, each type's behaviour pack named in the devices plugin's one type declaration and handed to the simulation at composition (U4-1, U4-3).
- **One lookup, no per-type row free to drift** (2026-09-22, U4-1, U4-2, U4-3): a per-type permission table and a pack registry are the same lookup, and a type's facts are not restated beside it.
- **A node with no type** is a bare anchor (P-10): it permits every role (2026-09-22), and is drawn by the network's marks per state, with no device appearance (D3).
- **Transit is a per-anchor input:** the routing table says what a type offers; an anchor's own stored `transit` says whether it is on; with transit off an anchor is an endpoint for every link that ends there, at any count (2026-10-02).
- **A violation:** a pin through a type that offers no passage is refused in the validator (2026-09-22, SD5); where a delete leaves two links that a join would make a bend at a type that does not permit one, the join does not happen, and links that end at a device keep ending there (2026-09-28, Z1); a pin where an anchor's transit goes off is cut, and `w` on such an anchor makes two links ending there (TR-2, TR-2b, Z1, SD5).
- **Appearance resolves per state** (2026-09-22, D3): an appearance composes or competes per derived state. A device is drawn by its glyph alone whatever role the graph gives it, a junction included (H24.9, which overturned the junction ring composed over its frame); a device whose transit is off composes its transit ring.
- **No stored document changes when a type is a composition** (P-10).

---

## 6. Entity model and interfaces

**Maturity: approved (H21.6); the anchor's name settled by N5a.**

### 6.1 The stored document

| Part | Holds |
|---|---|
| `meta` | id, name, version, schema, owner, grants, and the plugins the document needs (SD12) |
| `layouts` | the diagram's two grids, each a record of name, pitch, offset and extent, holding today's values (WD6, WD7) |
| `nodes` | anchors -- id, name, position, order (N5a) -- and the fields plugins contribute: the devices plugin's type, shape, span, content; the network's transit; the simulation's spawn |
| `links` | connections: their stops, closure, direction and plane (the network's) |
| `pipes` | adjacencies between two anchors, keyed by the pair, and how each was laid (SD7) |
| `zones` | regions of cells (the zones plugin's) |
| `groups` | named sets of members (the groups plugin's) |
| `selection`, `reveal` | the authoritative selection; a reveal's beats |

A peer lacking a plugin the document lists refuses the document (SD12).\
A named entity's name is unique across every named kind (N5).

### 6.2 The interfaces between parts

- **The row contract** (`kind-contract`): a kind's owner, collection, fields with their checks, what it opts into -- selection, names, the anchor, a tenant, gathering -- what it refers to, its cap, its invariants, and the entities every document holds.
- **Extension rows** (G3): a plugin's fields on a kind it does not own, each with its check and its cross-field rule.
- **Tenants:** a plugin's reactions to an edit, declared triggers over the change set, run by the planner for every plugin alike.
- **Canvas parts:** what a plugin brings to the page -- painters and appearances, picks, places, press rows, handles, the hand, keys, labels, size steps, grids, descriptions, tallies -- composed by the canvas without naming the plugin (D1 to D5).
- **Queries** (Q1): a plugin's own functions over a document -- a link's path and route, whether it is down, what blocks it, an anchor's role.
- **Pack tables** (SD4, P-10): each family's one table, keyed by type.
- **The doors:** REST routes, the websocket's commands, the CLI's verbs -- listed, derived, in the current document.

---

## 7. Run time

**Maturity: approved (H21.6).**

- **An edit, at any door:** the door states intent as ops; the planner checks each op against its kind's row and the contributed rows, runs every tenant's reactions on the change set, checks every invariant, and answers with the one write; the store applies it, logs its inverse and broadcasts it; every tab applies the answer.
- **In a tab, before the answer:** the tab plans the same edit with the same planner and shows it at once (SD2), then takes the server's answer and replays its own unanswered edits over it.
- **Loading a document:** the store reads it, completes the entities every document holds, refuses one in a format it does not read or listing a plugin it lacks, validates it, and reports any invariant it breaks.
- **Reading:** a route, an anchor's role, whether a link is down and where a mover is are derived on demand, identically in a tab, on the server and for an agent.
- **Downloading:** a document is drawn to a file by the rendering run mode draws (H2).
- **A new revision:** a tab detects it, says why, and reloads onto it.
- **The lab:** the canvas composed over the real modules, with one authority in the page and no storage.

---

## 8. Verification and divergence

**Maturity: approved (H21.6).**

### 8.1 How a claim is proved

- **The gate** proves the layers, the parts and their consumes, the kinds' composition, the records, every test, and that both architecture documents say what the code declares; it measures the parts' imports at module level, so an import of a plugin's query and of its factory look alike.
- **The ratchets** hold what shared code may name of a plugin, each exception with its reason and its trigger.
- **The copy and twin measures** (`tools/scan-copies.mjs`, `tools/scan-twins.mjs`) hold copied style rules, foreign style rules, undrawn styled names, copied page or stylesheet lines, unreached product modules and shared arithmetic at zero or to an exception the director ruled, with its reason and its trigger (`H25`).
- **The corpora and the behaviour matrix** hold behaviour equal across changes and across both pages.
- **The sync fuzz** holds a tab converged with the server under reorder and disconnect.

### 8.2 Divergence -- what this states and the current instant does not

**Measured:** every import in the code between two parts that the target's consumes do not allow is listed, generated, in the current document's section "Part divergence" (now zero); and every copied fact across the five copy measures (`tools/copies-record.json`) is listed, generated, in the current document's section "Recorded exceptions", each standing entry a ruled exception (`H25`).\
**Listed by hand:** none -- every divergence recorded here at ratification (`B332`, `B338`, `B248`, `B330`, `B329`, `B328`) is closed (`H21.8`, `H22`).

---

## 9. Owed and open

**Maturity: provisional.**

### 9.1 Decisions owed

**Maturity: settled.**\
All five questions recorded here at ratification (H21.6) have been ruled: the anchor's name (`N5a`), one declaration per type in the devices plugin handed in at composition (`U4-1`), refusing a pin through a type offering no passage while cutting at a transit-off stop (`SD5`), the CLI learning the device types from the server (`U4-2`), and run-mode behaviour as a third pack family (`U4-3`).

### 9.2 Open -- ratified but undesigned, or held with a trigger

| Topic | Standing |
|---|---|
| Flows: a flow declared once along a path, seen end to end | ratified in principle (SD10, SD6), undesigned, parked by the director (B327); no flow is in the document of section 6 |
| Links side by side over one pipe | held until designed (B256) |
| Anchors along a wide device, and which one a link ends at | held until a wide device needs links at more than one point (B282; WD1) |
| A diagram varying its grids | held until the infinite canvas is designed (B325; WD7) |
| Unloading what is out of view | held until the infinite canvas is designed (B289) |
| Policy over packets and flows | out of scope; named so nothing excludes it (2026-09-22) |
| Absorption of rulings recorded before 2026-10-11 | a ruling from then on names the documents it affects, and the gate checks each cites it -- a citation check, not proof that the section absorbs it; an older ruling's absorption is read by review |

### 9.3 Alignment with mission-kit -- a register (A-0)

**Maturity: provisional; a register, not structure.**\
The anchored core composes four components, `snap-grid` through its `lattice` part, `input-binding` through its `rules` part, `input-capture` through its `canvas` part and `vector-scene` through its `renderer` part, each through that part alone (H26-1, H26-2, H26-4, H26-6, H26-8, H26-11; `tools/layers.mjs` `COMPONENTS`), where A-0 found it composed none.\
Each part below is mapped to the component it composes or the candidate it would take, declared in `tools/layers.mjs` `ALIGNMENT` and generated; the other parts are drawv2's own.\
Why each mapping fits, and the rulings composing it would change, are `dev/design/unification/MISSION-KIT-ALIGNMENT.md`, sections 3 and 7.2.

<!-- BEGIN GENERATED: architecture-target-alignment. Run tools/generate-architecture.mjs; do not edit by hand. -->
| Part | Aligns to | Standing, read 2026-10-23 | Composing it waits on |
|---|---|---|---|
| `lattice` | `snap-grid` | snap-grid: proposed in drawv2, released from its own repository, composed (H26-4) | composed (H26-4); its grid arithmetic moved onto it at H26.1 |
| `kind-contract` | `shape-check` | shape-check: proposed in zorg, certified | OD-3; the target's section 4.3 |
| `document` | `entity-store` | entity-store: proposed in zorg, certified | OD-1 |
| `store` | `entity-store` | entity-store: proposed in zorg, certified | OD-1 |
| `primitives` | `vector-scene` | vector-scene: proposed in drawv2, released from its own repository, composed (H26-11); a candidate in zorg D32, steered in D35 | draw's shapes, drawn through vector-scene (H26-11) |
| `rules` | `input-binding` | input-binding: proposed in drawv2, released from its own repository, composed (H26-6) | composed (H26-6); its matcher and gesture session moved onto it at H26.2 |
| `planner` | `change-planner` | change-planner: candidate, zorg D32, steered in D35 | a contract; OD-3 |
| `canvas` | `input-binding`, `input-capture` | input-binding: proposed in drawv2, released from its own repository, composed (H26-6); input-capture: proposed in drawv2, released from its own repository, composed (H26-8) | consumes input-binding through rules (H26-6) and input-capture itself (H26-8); its rows and gesture bodies stay draw's (B389) |
| `renderer` | `vector-scene` | vector-scene: proposed in drawv2, released from its own repository, composed (H26-11); a candidate in zorg D32, steered in D35 | composed (H26-11); its drawing loop moved onto it at H26.4 |
| `sync` | `entity-view`, `write-outbox` | entity-view: candidate, zorg D32; write-outbox: candidate, zorg D32 | OD-2; OD-3 |
| `server` | `static-host` | static-host: candidate, zorg D32 | a contract |
| `access` | `caller-identity`, `credential-issuer`, `access-grants` | caller-identity: proposed in zorg, certified; credential-issuer: proposed in zorg, no code; access-grants: candidate, zorg BL20 | OD-2 |
| `hub` | `entity-api`, `agp`, `resource-lease` | entity-api: proposed in zorg, certified; agp: registered in mission-kit, C1; resource-lease: candidate, zorg D32 | OD-2 |
| `cli` | `operation-command` | operation-command: proposed in zorg, certified | OD-3 |
| `export` | `vector-scene` | vector-scene: proposed in drawv2, released from its own repository, composed (H26-11); a candidate in zorg D32, steered in D35 | draws through it with no root (H26-11) |
| `editing` | `canvas-editing` | canvas-editing: a drawv2 candidate by H26-10, B389 | declared inside draw (H26-10); its gestures' bodies join at H26.8, extracted when a second app needs it (B389) |
<!-- END GENERATED: architecture-target-alignment -->

**The owed designs,** each designed and asked on its own when its trigger fires:

| Owed design | Carried by | Trigger |
|---|---|---|
| OD-1, a diagram kept in an entity-store | B344 | the director selecting it, or a ruling in entity-store's record on the adjustments it needs |
| OD-2, clients reaching the server over agp | B345 | OD-1 ruled, entity-api certified, and its follows unparked (zorg's D15) |
| OD-3, how components reach the page and the installed CLI -- the page's and the server's half answered: each release file pinned by its hash, the server importing it by name, the pages through a generated import map and a vendor mount (H26-2, H26-4; `dev/design/components/SNAP-GRID.md` section 7.6, built in H26.1); the installed CLI's half open | B346; the CLI's half, B402 | fired at H26-2 for the page and the server; the CLI's half when it is designed for the CLI, so the CLI can take `snap-grid`, or the pitch changes (B402) |

**Held with them:**
- zorg's D38 and D39, where they name drawv2's agent door and its connection codes, open until OD-2;
- the anchored core in zorg's checkable form, held until the first component composed, which it has -- the `lattice` composes `snap-grid` (H26-4), its grid arithmetic moved onto it in H26.1 -- so the hold has ended and the form is the director's to take up (A-0);
- drawv2's board, backlog and decisions at mission-kit's paths (its ruling 0076), a divergence;
- which of drawv2's parts become shared components, reasoned with agp's and zorg's own, when the director starts it (B343).
