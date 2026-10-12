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
**What is generated:** the parts of the anchored core -- each part's duty, kind, fixing rulings and what it consumes -- are declared once in `tools/layers.mjs` and rendered into both documents by `tools/generate-architecture.mjs`, so the two instants carry the same components; the imports in the code that the target does not allow are measured into the current document.

| Section | Maturity | Reopens on |
|---|---|---|
| 1. Identity, scope and non-goals | provisional | `VISION.md` changing |
| 2. Justification chain | provisional | a ruling changing the model |
| 3. Axiom alignment | provisional | a ruling, or a tension resolved |
| 4. Anchored core | provisional | a part's duty or its consumes changing |
| 5. A type is a composition | provisional; where the tables live, and the behaviour family, owed | the decisions owed in section 9 |
| 6. Entity model and interfaces | provisional | a format change |
| 7. Run time | provisional | a door's lifecycle changing |
| 8. Verification and divergence | provisional | a check added, or a divergence closed |
| 9. Owed and open | provisional | each entry's ruling |

Approval is aggregate, by the director; each section reopens on its trigger.

---

## 1. Identity, scope and non-goals

**Maturity: provisional.**

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

**Maturity: provisional.**

Each layer cites only the layers above it.

**Domain.**\
Diagrams of systems, made into worlds with physics: a diagram stops being a picture of a system and becomes a world computed identically by every viewer (`VISION.md`).

**Axioms in force** (mission-kit, `axioms/`): A3 Sovereign Composition, A2 Isomorphic Specification, A1 Sovereign State Transparency, A5 Perceptual Parity, A11 Cognitive Minimalism, A8 Gated Recursive Integrity, A14 Compounding Learning, A7 Resilient Agentic Operations, A13 Director Intent Amplification; the rest bear lightly (section 3).

**North star.**\
Derived physics that everyone watching computes identically (`VISION.md`).\
Noted for PC1: AR1 asks for the system's north star and this one is the programme's; the mission-kit's own exemplar does the same, a disagreement between the entry and its exemplar recorded rather than resolved here.

**Principles -- the outcome axes the director accepted** (`dev/surveys/unification-survey.md`, S0): AX1 derived, not stored; AX2 parity at every door; AX3 expressiveness; AX4 extensible physics; AX5 conceptual economy; AX6 one-way doors few, named and last.

**Decisions** -- the rulings that fix the structure below:
- **The universal node, staged** (2026-09-19, amended 2026-09-22): endpoint, bend and junction are what the graph makes of an anchor, derived; a type declares which roles it permits, per type, and a violation is refused; appearance and routing are pack families; appearance resolves per state.
- **A type is the name of a composition** (2026-10-02): what survives of "type" is the name an author picks for a composition, and the core does not know what it means.
- **P-10** (2026-10-03): `type` stays the stored name, and packs are code tables keyed by it, with no format change.
- **The stack interface:** browsers and server derive, the CLI asks (SD1); the planner runs the rules for every door (SD2); a pack is only its table (SD4); one pipe per pair (SD7); the network is a plugin (SD11); the core is anchors, identity and position, with no notion of connection, and the network contributes pipes, links and the rules that react to edits (SD11b); each document lists the plugins it needs (SD12).
- **H17-D1, H17-D6:** the lab lives in this repository, in its own folder (H17-D1); the one device-type table is imported by its users (H17-D6).
- **Transit:** a pin is cut where transit goes off (TR-2); `w` on an anchor whose transit is off makes two links ending there (TR-2b); which types offer transit is configuration the network plugin brings (2026-10-07); a device pin follows transit's rules only (Z1).
- **N1, N5:** plugins bring their own kinds, and the core keeps only what spans kinds (N1); names are a service a kind opts into (N5).
- **O1, O4:** every kind is a plugin's; the core keeps what spans kinds and the anchor capability -- identity, position, occupancy, resolving a reference -- and a plugin depends on another's kind brokered at composition (O1); the core holds one kind, the anchor, which carries no type (O4).
- **G3:** a plugin contributes fields to a kind it does not own.
- **Q1:** a plugin's questions are asked of the plugin.
- **D1 to D5:** the canvas contract, the canvas naming no plugin's kind beyond a record that may only fall (D1); draw-a-link the product's shared gesture with the network as its judge (D2); several plugins draw one kind through the appearance pipeline (D3); a plugin's edits are data (D5).
- **H2:** run mode and the download are one rendering, one place for code.
- **The palette** (2026-10-01): one core palette, roles per owner.
- **WD1, WD6, WD7, WD10:** a wide device is one anchor (WD1); a diagram stores its grids as layout records (WD6) holding today's values (WD7); a device owns its size (WD10).

**Model.**\
The **anchor** is the core: identity and position on one cell (SD11b, O4); connection is the network plugin's.\
A **pack** is a code table a plugin contributes, keyed by type (SD4, P-10).\
A **type** is the name of a composition; a **node** is an anchor with what plugins compose onto it, and a node with no type is a bare anchor -- a waypoint, by the word people use (P-10).\
Whether the anchor itself is named is owed (section 9.1).\
Everything a node shows or does is derived from its composition and the document.

---

## 3. Axiom alignment

**Maturity: provisional.**

| Axiom | Weight | How the architecture stands -- or the tension, left open |
|---|---|---|
| A3 Sovereign Composition | load-bearing | each plugin owns one concern and composes onto the anchor through declared contracts; the product composes the plugins. **Tensions:** a node's `type` is the devices plugin's field, yet it names a composition other plugins' packs are keyed by; a plugin depends on another's kind brokered at composition (O1), while the network imports the devices plugin's modules -- measured in the current document's part divergence |
| A2 Isomorphic Specification | load-bearing | each pack family is one table keyed by type, and the type list one table imported by its users (H17-D6); where the tables live, and whether a type is one declaration across them, is owed (section 9.1). **Tension:** the CLI's static imports stay inside `cli/` so an installed copy runs, and it holds its own list of types, kept equal to the kernel's by a test (B167) -- owed, section 9 |
| A1 Sovereign State Transparency | load-bearing | the document states its grids (WD6) and the plugins it needs (SD12); every write records who made it; roles and routes are computed, never stored |
| A5 Perceptual Parity | load-bearing | an agent reads what a viewer sees -- a route, whether a link is down, an anchor's role -- from the server (SD1) |
| A11 Cognitive Minimalism | load-bearing | a pack is a table keyed by type, not a mechanism (SD4, P-10). **Open:** the 2026-09-22 record's caution, that packs composing must be earned by composing two -- fields compose onto the anchor (G3), and at the current instant no type is a composition of packs; whether a behaviour family is earned is owed (section 9) |
| A8 Gated Recursive Integrity | load-bearing | the planner is the one write; a document a door cannot hold is refused; the gate holds the layers, the parts, the kinds and the records |
| A14 Compounding Learning | load-bearing | the current architecture is generated, and the imports the target does not allow are measured; the semantic divergence is listed by hand, row by row (section 8) |
| A7 Resilient Agentic Operations | supporting | a link whose way is gone is shown down at every door and heals when a way returns; a refusal is said at the door that made it |
| A13 Director Intent Amplification | supporting | this document tracks the rulings and asks the director only the questions in section 9 |
| A4, A6, A9, A10, A12 | supporting or not materially implicated | records append-only; deploys gated; no agent context assembly in the product |

**AX6, a principle rather than an axiom:** `type` staying the stored name keeps a type's composition out of stored documents (P-10); SD12's plugin list is a new field in every document, a format change named here.

---

## 4. Anchored core

**Maturity: provisional.**

### 4.1 Parts

Generated from `tools/layers.mjs` `PARTS`; the current document renders the same parts with the modules each is made of today and the parts each imports.

<!-- BEGIN GENERATED: architecture-target-parts. Run tools/generate-architecture.mjs; do not edit by hand. -->
| Part | Duty | Kind | Fixed by | Consumes |
|---|---|---|---|---|
| `lattice` | Compute geometry on the grid | core | O1 | -- |
| `kind-contract` | Compose kinds from the rows plugins declare | core | N1, G3, WD6 | -- |
| `document` | Hold one document's entities | core | O1, O4, Q1 | `kind-contract`, `lattice` |
| `relations` | Index which entities relate | core | O1 | `document`, `kind-contract`, `lattice` |
| `colours` | Hold the colours every role draws from | core | N1 | -- |
| `primitives` | Draw the shapes painters compose | core | N1, D3 | `lattice`, `colours` |
| `rules` | Match an input to one declared row | core | D2 | -- |
| `planner` | Make the one write every door applies | core | SD2, O1 | `kind-contract`, `document`, `relations`, `lattice` |
| `layouts` | Declare a diagram's grids | plugin | WD6, WD7 | `lattice`, `kind-contract`, `document` |
| `devices` | Compose a device onto an anchor | plugin | O4, WD10 | `lattice`, `kind-contract`, `document`, `relations`, `colours`, `primitives`, `rules` |
| `network` | Connect anchors | plugin | SD11, SD11b, O1 | `lattice`, `kind-contract`, `document`, `relations`, `colours`, `primitives`, `rules` |
| `zones` | Bound regions of cells | plugin | O1, O4 | `lattice`, `kind-contract`, `document`, `layouts`, `colours`, `primitives`, `rules` |
| `groups` | Name sets of anchors | plugin | O1 | `lattice`, `kind-contract`, `document`, `relations`, `colours`, `primitives`, `rules` |
| `simulation` | Derive what the clock drives | plugin | AX1, AX4, SD11b | `lattice`, `kind-contract`, `document`, `relations`, `colours`, `primitives`, `rules`, `network`, `devices` |
| `product` | Compose the plugins into the product | composition | N1, D1 | `kind-contract`, `lattice`, `layouts`, `devices`, `network`, `zones`, `groups`, `simulation` |
| `canvas` | Turn input into edits through the parts' declarations | host | D1, D2, D5 | `lattice`, `kind-contract`, `document`, `relations`, `rules`, `planner`, `renderer`, `primitives`, `colours` |
| `renderer` | Draw a document through the parts' painters | host | D1, D3 | `lattice`, `document`, `primitives`, `colours` |
| `sync` | Keep a tab converged with the server | host | SD2 | `document`, `kind-contract`, `canvas` |
| `product-page` | Compose the product page | composition root | D1 | any part -- a composition root |
| `lab` | Compose the canvas over the real modules, without storage | composition root | H17-D1 | any part -- a composition root |
| `server` | Compose the server | composition root | SD2 | any part -- a composition root |
| `access` | Establish who a request comes from | door | A1 | -- |
| `placement` | Choose the free anchor a relationship names | door | SD1 | `lattice`, `document`, `relations`, `devices` |
| `store` | Keep documents durable | door | SD2, WD6 | `document`, `kind-contract`, `lattice`, `planner`, `product`, `relations`, `access`, `placement` |
| `hub` | Carry each change to the tabs watching a document | door | SD2 | `store`, `planner`, `document`, `kind-contract`, `access` |
| `rest` | Answer agents over HTTP | door | SD1, Q1 | `store`, `hub`, `planner`, `document`, `kind-contract`, `product`, `lattice`, `access`, `layouts`, `network`, `devices`, `zones`, `groups` |
| `cli` | Give an agent one command per verb | door | SD1 | -- |
| `export` | Render a document without a browser | door | H2 | `lattice`, `document`, `kind-contract`, `primitives`, `colours`, `product`, `renderer` |
<!-- END GENERATED: architecture-target-parts -->

### 4.2 What the parts expose

| Part | Exposes |
|---|---|
| `lattice` | the lattices' arithmetic -- cells, snapping, the nearest point -- and a path's geometry |
| `kind-contract` | the row contract a kind is declared by; extension rows (G3); the entities every document holds (WD6); a composition |
| `document` | a document's entities by kind; the one name namespace kinds opt into (N5); the anchor capability's identity and reference resolution (O1) |
| `relations` | the anchor capability's occupancy -- which anchor holds a cell (O1) -- and which entities refer to an anchor, by the references their rows declare |
| `colours` | the one palette's values; each plugin names its own roles over it (the palette ruling) |
| `primitives` | the shapes every painter composes, none a plugin's own (N1) |
| `rules` | one match, or none, for an input among declared rows |
| `planner` | plan, commit, undo and redo over a composition's rows and every tenant it brings, each alike; document validation; the invariants a write keeps |
| `layouts` | the layout kind, its two records in every diagram, the anchor's place, the grids drawn from the records |
| `devices` | the device fields -- type, shape, span, content; the appearance family -- glyph art and box, frames, content regions; a device's footprint and size (WD10) |
| `network` | the link and pipe kinds; the transit field; the routing family -- per type, the roles it permits and whether it offers transit (2026-10-07); the reactions that cut, join and lay legs; the queries a route answers |
| `zones` | the zone kind and its gestures, over the zone grid |
| `groups` | the group kind, its tenant, gathering by members |
| `simulation` | the spawn field; what the clock drives -- movers along routes, towers, the reveal -- and their appearances |
| `product` | the product's composition: every kind, the network's among them, and every canvas part |
| `canvas` | press rows, gestures, keys and the hand, each a part's declaration over shared gestures (D1, D2) |
| `renderer` | every kind drawn through its part's painter or appearances, composed per state (D3) |
| `sync` | an outbox replayed after reconnect; the server's answer applied; a tab reloaded onto a new revision |
| `product-page`, `lab`, `server` | the product page, the lab page and the server, each composed from the product |
| `access` | who a request comes from: a person's identity, an agent's connection code, a websocket's origin |
| `placement` | the free anchor that satisfies a relationship an agent names, so an agent places as it asks (SD1) |
| `store` | documents loaded, completed with what every document holds, validated and written back |
| `hub` | snapshots and changes to every session on a document |
| `rest` | the routes an agent drives, an anchor's role among what they derive (SD1) |
| `cli` | a verb for each route, asking the server for what the server derives (SD1) |
| `export` | a document drawn to a file through the same rendering run mode draws (H2) |

### 4.3 How the parts consume one another

The table in 4.1 lists each part's consumes; these rules bound them, each a ceiling by kind that `tools/generate-architecture.mjs` holds (`tools/layers.mjs` `KIND_MAY_CONSUME`), and the consumes form no cycle.
- **The core consumes the core alone** (N1, O1).
- **A plugin consumes the core, and another plugin only through its queries and factories** (O1, Q1).
- **The network reads a node's type, and its own routing table keyed by it** (P-10, 2026-10-07) -- not the devices plugin's modules.
- **The planner consumes a composition's rows and every tenant it brings,** with no part of its own reserved for any plugin (SD2, SD11b).
- **The canvas and the renderer consume the core and each other, never a plugin,** beyond D2's record of the draw-a-link gesture (D1, D2).
- **The doors consume the core, the product's composition, and a plugin's queries and factories** (SD2, Q1); none composes a plugin's rows itself; the download draws through the renderer (H2).
- **The CLI consumes the server over HTTP,** importing no product module, for everything the server derives (SD1).

---

## 5. A type is a composition

**Maturity: provisional; where the tables live, and the behaviour family, are owed (section 9.1).**

What a device is, said once per family.
- **A type is the name an author picks for a composition** (2026-10-02); the core does not know what it means, and a node's `type` is that name, stored as it is (P-10).
- **A pack is a code table keyed by type** (SD4, P-10): the derivation that reads it is its plugin's, and the writes it implies are the planner's tenants'.
- **The pack families ruled in scope** (2026-09-22):
  - **appearance** -- the devices plugin's: a glyph's art and box, a frame, how content regions lay out;
  - **routing** -- the network's: per type, the roles an anchor may take -- endpoint, junction, bend -- and whether it offers transit, which is the network's configuration (2026-10-07).
- **One lookup, no per-type row free to drift** (2026-09-22): a per-type permission table and a pack registry are the same lookup, and a type's facts are not restated beside it -- beyond what section 9.1 leaves owed.
- **A node with no type** is a bare anchor (P-10): it permits every role (2026-09-22), and is drawn by the network's marks per state, with no device appearance (D3).
- **Transit is a per-anchor input:** the routing table says what a type offers; an anchor's own stored `transit` says whether it is on; with transit off an anchor is an endpoint for every link that ends there, at any count (2026-10-02).
- **A violation:** a pin through a type that offers no passage is refused in the validator (2026-09-22); where a delete leaves two links that a join would make a bend at a type that does not permit one, the join does not happen, and links that end at a device keep ending there (2026-09-28, Z1); a pin where an anchor's transit goes off is cut, and `w` on such an anchor makes two links ending there (TR-2, TR-2b, Z1).
- **Appearance resolves per state** (2026-09-22, D3): a device that the graph makes a junction draws its junction mark composed over its frame.
- **No stored document changes when a type is a composition** (P-10).

---

## 6. Entity model and interfaces

**Maturity: provisional.**

### 6.1 The stored document

| Part | Holds |
|---|---|
| `meta` | id, name, version, schema, owner, grants, and the plugins the document needs (SD12) |
| `layouts` | the diagram's two grids, each a record of name, pitch, offset and extent, holding today's values (WD6, WD7) |
| `nodes` | anchors -- id, position, order, and a name if the anchor is named (owed, section 9.1) -- and the fields plugins contribute: the devices plugin's type, shape, span, content; the network's transit; the simulation's spawn |
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

**Maturity: provisional.**

- **An edit, at any door:** the door states intent as ops; the planner checks each op against its kind's row and the contributed rows, runs every tenant's reactions on the change set, checks every invariant, and answers with the one write; the store applies it, logs its inverse and broadcasts it; every tab applies the answer.
- **In a tab, before the answer:** the tab plans the same edit with the same planner and shows it at once (SD2), then takes the server's answer and replays its own unanswered edits over it.
- **Loading a document:** the store reads it, completes the entities every document holds, refuses one in a format it does not read or listing a plugin it lacks, validates it, and reports any invariant it breaks.
- **Reading:** a route, an anchor's role, whether a link is down and where a mover is are derived on demand, identically in a tab, on the server and for an agent.
- **Downloading:** a document is drawn to a file by the rendering run mode draws (H2).
- **A new revision:** a tab detects it, says why, and reloads onto it.
- **The lab:** the canvas composed over the real modules, with one authority in the page and no storage.

---

## 8. Verification and divergence

**Maturity: provisional.**

### 8.1 How a claim is proved

- **The gate** proves the layers, the parts and their consumes, the kinds' composition, the records, every test, and that both architecture documents say what the code declares; it measures the parts' imports at module level, so an import of a plugin's query and of its factory look alike.
- **The ratchets** hold what shared code may name of a plugin, each exception with its reason and its trigger.
- **The corpora and the behaviour matrix** hold behaviour equal across changes and across both pages.
- **The sync fuzz** holds a tab converged with the server under reorder and disconnect.

### 8.2 Divergence -- what this states and the current instant does not

**Measured:** every import in the code between two parts that the target's consumes do not allow is listed, generated, in the current document's section "Part divergence".\
**Listed by hand,** each row named by the backlog row that carries it:

| This target states | The current instant | Carried by |
|---|---|---|
| each pack family is one table keyed by type, the type list one table, and no other code table keys on a type name | eight tables in five files key on a type's name, two of them copies (`dev/design/unification/UNIFICATION-AUDIT.md`, section 3.1) | B282 |
| a type's routing table decides which roles an anchor may take | whether a node has a type decides whether it may bend or join | B282 |
| a device the graph makes a junction draws its junction mark over its frame | nothing draws it | B331 |
| the planner and the canvas take the network as any plugin, and the doors take it within the product's composition | the planner takes a `links` option and imports the network's layer; the canvas takes a `network` slot; each door composes the network's rows itself | B332 |
| the core holds the palette and primitives no plugin owns; each plugin holds its colour roles, its glyph art and its frame and content drawing | the core's theme holds the zone, group, link and waypoint roles and the device glyph art; its primitives draw a device's frame and content | B338 |
| an agent reads an anchor's role; the CLI imports no product module | no door serves a role; the CLI imports product modules to derive combat and movers, and restates a rule | B339 |
| each document lists the plugins it needs | no document does | B248 |
| the download is drawn by the rendering run mode draws | the export door is a second renderer, naming kinds | B330 |
| a part reads another plugin's kind only through the composition | the canvas reads the devices plugin's drawn word for a create label; the groups painter reads a device's span | B340 |
| occupancy is the core's anchor capability | the occupancy index and the one-anchor-to-a-point invariant are the network layer's | B341 |
| the simulation's page pieces are the simulation's | the movers and the reveal live in the canvas folder | B329 |
| the canvas names no plugin's kind beyond D2's record of the draw-a-link gesture | the canvas names plugin kinds and imports plugin modules, each recorded in its ratchet's record (`tests/canvas-names-no-plugin.test.js`) | B328 |

---

## 9. Owed and open

**Maturity: provisional.**

### 9.1 Decisions owed

Each is asked when its stage reaches it (H21); the options and their costs are as the record shows them.

| Question | The options and their costs | Recommendation |
|---|---|---|
| Is the anchor named? The 2026-09-22 ontology lists name among what is not universal, and O4 defines the anchor as identity and one cell; N5 (2026-10-02, when a node was the device kind beside a separate waypoint kind) keeps the five built-in kinds named | **The anchor kind opts into names** (N5, B187): every anchor addressable by name for agents, nothing stored changes; the core's one kind carries a service O4's definition leaves out. **Name is a field a plugin contributes** (2026-09-22, O4): the anchor stays exactly identity and one cell; a bare anchor has no name to address it by, and the naming plugin becomes a dependency of every door that resolves names | the anchor kind opts into names -- names are already a service a kind opts into, not a core field, and agents address anchors by name |
| Where do a type's tables live, and is a type one declaration across them? H17-D6 put the type table in "a devices module in the new network folder"; SD11b gives the network "the device tables"; O4 composes a device onto an anchor by the devices plugin; H21's U4 exit is "adding a type is one declaration" | **Each family's owner holds its table, keyed by type, and the type list is the devices plugin's:** each plugin reads its own table with no import of another; adding a type touches each family's table, so one declaration is not met, and a missed routing row defaults silently (`dev/design/unification/UNIFICATION-AUDIT.md`, section 3.1). **The product holds one declaration per type, naming its pack in each family:** one declaration, every family reading through it; the plugins cannot import the product, which imports them all, so it is handed to them at composition, reversing H17-D6's "imported by its users". **One type table in the devices plugin naming each type's packs:** one declaration; the network and the simulation import the devices plugin to read it, the dependence O1 brokers at composition | the product holds one declaration per type, handed in at composition -- it is the only option meeting U4's exit without a plugin importing another, at the cost of reversing H17-D6, which is to be asked as such |
| SD5: an act that would make a device take a role its type forbids -- refused, or cut? Held "until that door" (a pin naming a device), which the device-junctions ruling of 2026-10-07 (B301) opened; never put to the director | **The split as built:** a type offering no passage refuses a pin (2026-09-22); a stop whose transit is off is cut (TR-2, TR-2b, Z1; B303 built the cut at every door) -- one rule per input, the same at every door. **Refused everywhere:** simpler to state; reverses TR-2b and B303, and a drag and REST would disagree until both change (AX2) | the split as built -- it is what the rulings already make the code do at every door |
| How does the CLI learn the device types? | **From the server** (SD1): one list, no copy; no route serves the types today, so one is added; `draw help` offline cannot name them; `draw map`'s letter per type needs a home in a family (section 5). **A copy held equal by a test** (B167): help works offline; two lists of one fact, the drift A2 warns of, held only by the test | from the server -- the CLI needs the server for every verb but help |
| Is a type's behaviour a pack family -- a tower's numbers a table the simulation keys by type? | **Yes:** the director's description of a composition names behaviours (2026-10-02), the approach H21 ratified puts "behaviour (a tower)" in U4's composition (`dev/design/unification/UNIFICATION-AUDIT.md`, section 7), and the tower table is keyed by type already (`engine/kinds.mjs`); it adds a third family to learn (AX5). **Not yet:** a tower stays the simulation's rule over a type name, outside the families; nothing new to learn, and a type's facts are then not in one place (A2) | yes, as a third family, nothing beyond the table it already is |

### 9.2 Open -- ratified but undesigned, or held with a trigger

| Topic | Standing |
|---|---|
| Flows: a flow declared once along a path, seen end to end | ratified in principle (SD10, SD6), undesigned, parked by the director (B327); no flow is in the document of section 6 |
| Links side by side over one pipe | held until designed (B256) |
| Anchors along a wide device, and which one a link ends at | held until a wide device needs links at more than one point (B282; WD1) |
| A diagram varying its grids | held until the infinite canvas is designed (B325; WD7) |
| Unloading what is out of view | held until the infinite canvas is designed (B289) |
| Policy over packets and flows | out of scope; named so nothing excludes it (2026-09-22) |
| Each document lists the plugins it needs | ratified (SD12); its building held with the director's approval, on B248's trigger |
| Absorption of rulings recorded before 2026-10-11 | a ruling from then on names the documents it affects, and the gate checks each cites it -- a citation check, not proof that the section absorbs it; an older ruling's absorption is read by review |
