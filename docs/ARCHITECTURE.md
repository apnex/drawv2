---
instant: current
system: drawv2
---

# drawv2 - current architecture

**Instant: current.**\
This document states drawv2 as it is built today.\
Where it is going is `docs/ARCHITECTURE-TARGET.md`, and why it exists is `VISION.md`.

**The structure is derived; the frame is authored.**\
Every structural section below is generated from what the code declares about itself by `tools/generate-architecture.mjs`, and the gate fails when a section no longer says what the code does (mission-kit AR1: a current architecture is derived, never hand-authored).\
The reasoning -- the justification chain and the axiom alignment -- is the target's, because the current structure is the target's less the divergence the target lists; it is not restated here.

| Section | Maturity | Reopens on |
|---|---|---|
| 1. Identity | provisional | `VISION.md` changing |
| 2 to 8, the structure | derived -- regenerated from the code, checked by the gate | the code changing |
| 9. Divergence | provisional | a ratified decision that changes the target |

---

## 1. Identity

drawv2 is a programmable geometric engine: a document declares geometry -- things placed on a grid, and the paths between them -- and everything else is a consequence computed identically by everyone watching (`VISION.md`).\
Its non-goals are the vision's: not a drawing tool, not a picture, not a place where a rule lives at one door.

---

## 2. Layers

**Maturity: derived.**\
A module belongs to one layer, and a layer imports only what it may (`tools/layers.mjs`, held by `tools/scan-layers.mjs`).

<!-- BEGIN GENERATED: architecture-layers. Run tools/generate-architecture.mjs; do not edit by hand. -->
| Layer | Duty | Modules | May import |
|---|---|---|---|
| `core` | the anchor on the grid: the lattice's arithmetic, the kind contract, the document store and the drawing primitives | 15 | -- |
| `network` | connection: links, pipes, routes, junctions and transit | 38 | `core`, `devices` |
| `layouts` | the diagram's grids, as stored layout records | 4 | `core` |
| `zones` | regions of cells | 7 | `core`, `layouts` |
| `groups` | named sets of anchors | 7 | `core` |
| `devices` | what a device composed onto an anchor is, and how it looks | 14 | `core` |
| `planner` | the one write: plan, commit, undo, redo, the log and validation | 4 | `core`, `network` |
| `product` | the product's composition of the plugins: its kinds and its canvas parts | 2 | `core`, `devices`, `network`, `layouts`, `zones`, `groups`, `simulation` |
| `canvas` | turning input into edits, and a document into a drawing, through the plugins' parts | 21 | `core`, `devices`, `network`, `layouts`, `zones`, `groups`, `planner` |
| `chrome` | the production page around the canvas: sync, status, palette, readouts and its composition root | 12 | `core`, `devices`, `network`, `layouts`, `zones`, `groups`, `planner`, `product`, `canvas`, `simulation`, `export` |
| `simulation` | derived motion: spawners, movers, towers and run mode | 8 | `core`, `devices`, `network` |
| `export` | the headless SVG path | 5 | `core`, `network` |
| `server-only` | the server's doors and storage, never served to a browser | 16 | `core`, `devices`, `network`, `layouts`, `zones`, `groups`, `planner`, `product`, `simulation`, `export`, `serve` |
| `serve` | the one static responder both servers share | 1 | -- |
| `cli` | the command-line tool agents drive | 2 | `core`, `devices`, `network`, `layouts`, `zones`, `groups`, `simulation`, `product` |
| `lab` | the lab page's composition over the real modules | 2 | `core`, `devices`, `network`, `layouts`, `zones`, `groups`, `planner`, `product`, `canvas`, `serve` |
| `tools` | the gate's scanners and generators | not counted | any layer |
| `tests` | the tests the gate runs | not counted | any layer |
<!-- END GENERATED: architecture-layers -->

---

## 3. Kinds

**Maturity: derived.**\
What a document can hold, as the server composes it: the core's anchor, stored as `node`, and every other kind a plugin's (`product/kinds.mjs`, `model/shape.mjs`).

<!-- BEGIN GENERATED: architecture-kinds. Run tools/generate-architecture.mjs; do not edit by hand. -->
| Kind | Owner | Stored under | Opts into | Refers to | Fields other plugins contribute | Every document holds |
|---|---|---|---|---|---|---|
| `layout` | layouts | `layouts` | -- | -- | -- | `layout-000001`, `layout-000002` |
| `node` | the core | `nodes` | selection, names, the anchor | -- | devices: `type`, `shape`, `span`, `content`; the simulation: `spawn`; the network: `transit` | -- |
| `zone` | zones | `zones` | selection, names | -- | -- | -- |
| `group` | groups | `groups` | names, a planner tenant, gathering by `members` | `node` | -- | -- |
| `link` | the network | `links` | selection, names | `node` | -- | -- |
| `pipe` | the network | `pipes` | selection | `node` | -- | -- |
<!-- END GENERATED: architecture-kinds -->

---

## 4. Canvas parts

**Maturity: derived.**\
What each plugin brings to the page; the canvas composes the parts and names no plugin's kind beyond the exceptions of section 7 (`product/canvas.mjs`).

<!-- BEGIN GENERATED: architecture-canvas. Run tools/generate-architecture.mjs; do not edit by hand. -->
| Part | Brings to the page |
|---|---|
| the product | `orders`, `deleteRanks` |
| layouts | `places`, `grids` |
| zones | `painters`, `places`, `presses`, `handles`, `keys`, `sizeStep`, `deleteRanks`, `describe`, `selectAll`, `labels`, `drawn`, `tally` |
| groups | `painters`, `keys`, `deleteRanks`, `follows`, `drawn` |
| devices | `appearances`, `presses`, `hand`, `at`, `sizeStep`, `sizes`, `keys`, `describe`, `selectAll`, `labels`, `drawn`, `tally` |
| network | `painters`, `appearances`, `presses`, `handles`, `at`, `deleteRanks`, `follows`, `describe`, `selectAll`, `reflects`, `drawn`, `runTargets`, `tally` |
| the simulation | `appearances` |
<!-- END GENERATED: architecture-canvas -->

---

## 5. Compositions

**Maturity: derived.**\
Where the product composes its kinds and its canvas parts -- one composition, used at every door.

<!-- BEGIN GENERATED: architecture-compositions. Run tools/generate-architecture.mjs; do not edit by hand. -->
| Module | Composes |
|---|---|
| `app/src/main.js` | the kinds, with the network's; the canvas parts |
| `cli/verbs.mjs` | the kinds, with the network's |
| `lab/src/root.js` | the kinds, with the network's; the canvas parts |
| `server/seed.js` | the product's kinds alone |
| `server/store.js` | the kinds, with the network's |
<!-- END GENERATED: architecture-compositions -->

---

## 6. Doors

**Maturity: derived.**\
Every way something outside the engine reaches it: the browser's websocket, the agent's REST, the CLI.

<!-- BEGIN GENERATED: architecture-doors. Run tools/generate-architecture.mjs; do not edit by hand. -->
**REST** -- 37 routes (`server/routes.mjs`):

| Route | Methods | What it answers |
|---|---|---|
| `/api/v1/sessions` | GET | what each client did -- commits, refusals, reconnects and how fast (B182) |
| `/api/v1/health` | GET | store health, through the versioned door -- what an agent reads |
| `/api/v1/diagrams` | GET, POST | list, and mint a new one |
| `/api/v1/diagrams/:id` | GET, DELETE | the document, and removing it |
| `/api/v1/diagrams/deleted` | GET | what is inside the delete window (B109) |
| `/api/v1/diagrams/deleted/:id/restore` | POST | bring one back from the window |
| `/api/v1/diagrams/:id/commit` | POST | a batch of ops as one transaction |
| `/api/v1/diagrams/:id/history` | GET | the change log |
| `/api/v1/diagrams/:id/lock` | GET, POST, DELETE | the write slot |
| `/api/v1/diagrams/:id/undo` | POST | reverse a change or a run |
| `/api/v1/diagrams/:id/redo` | POST | reapply what undo reversed |
| `/api/v1/diagrams/:id/selection` | PUT | the authoritative selection |
| `/api/v1/diagrams/:id/grants` | POST | grant access to this diagram |
| `/api/v1/diagrams/:id/grants/:principal` | DELETE | revoke it; answers what remains |
| `/api/v1/diagrams/:id/context/:entity` | GET | what surrounds an entity |
| `/api/v1/diagrams/:id/near` | GET | what is around a point |
| `/api/v1/diagrams/:id/zones/:zone/contents` | GET | what falls inside a zone |
| `/api/v1/diagrams/:id/links/:link/path` | GET | a route resolved to coordinates |
| `/api/v1/diagrams/:id/layouts` | GET | the diagram's two grids, as its layout records |
| `/api/v1/diagrams/:id/layouts/:name/nearest` | GET | the legal anchor nearest a pixel |
| `/api/v1/diagrams/:id/layouts/:name/anchors` | GET | every anchor, or every free one |
| `/api/v1/diagrams/:id/nodes` | POST | high-level create; `draw add` and `draw place` are preferred |
| `/api/v1/diagrams/:id/nodes/:entity` | PATCH, DELETE | high-level patch and remove |
| `/api/v1/diagrams/:id/links` | POST | high-level create |
| `/api/v1/diagrams/:id/links/:entity` | PATCH, DELETE | high-level patch and remove |
| `/api/v1/diagrams/:id/zones` | POST | high-level create |
| `/api/v1/diagrams/:id/zones/:entity` | PATCH, DELETE | high-level patch and remove |
| `/api/v1/diagrams/:id/groups` | POST | high-level create |
| `/api/v1/diagrams/:id/groups/:entity` | PATCH, DELETE | high-level patch and remove |
| `/api/v1/diagrams/:id/pipes` | POST | lay a pipe by hand between two anchors (P6 W-a) |
| `/api/v1/diagrams/:id/pipes/:entity` | DELETE | remove a pipe (P6 W-a) |
| `/api/v1/workspace/agents` | GET | what every agent is doing |
| `/api/v1/workspace/viewers` | GET | who is looking at what |
| `/api/v1/workspace/grants` | GET, POST | grants across everything you own |
| `/api/v1/workspace/grants/:principal` | DELETE | withdraw one |
| `/api/v1/workspace/codes` | GET, POST | connection codes |
| `/api/v1/workspace/codes/:code` | DELETE | retire one |

**The websocket** -- 11 commands a tab sends (`server/protocol.js`): `hello`, `open`, `create`, `commit`, `undo`, `redo`, `resume`, `select`, `reclaim`, `delete`, `list`.

**The CLI** -- 65 verbs (`cli/verbs.mjs`):

| Group | Verbs |
|---|---|
| Context | `health`, `use`, `diagrams`, `context`, `status`, `get`, `history`, `about`, `zone contents`, `link path`, `dump`, `combat`, `movers`, `show`, `map`, `focus`, `links`, `holds`, `peers`, `parity` |
| Lifecycle | `create`, `delete`, `render`, `deleted`, `restore` |
| Writing | `lock`, `unlock`, `lock status`, `commit`, `draft begin`, `draft show`, `draft discard`, `undo`, `redo`, `select`, `spawn`, `link`, `panel`, `zone`, `group`, `move`, `rename`, `textsize`, `pipe`, `rm`, `set`, `region` |
| Placement | `near`, `place`, `add`, `anchor nearest`, `anchor free`, `layouts` |
| Awareness | `who`, `viewers`, `sessions` |
| Access | `access`, `grant`, `revoke`, `workspace grant`, `code mint`, `code list`, `code revoke`, `workspace grants`, `workspace revoke` |
<!-- END GENERATED: architecture-doors -->

---

## 7. Recorded exceptions

**Maturity: derived.**\
Where shared code still names what a plugin owns, each with its reason and when it ends (`tools/layers.mjs` `RATCHET_REASONS`).\
The canvas's and the core's records are their ratchets' own (`tests/canvas-names-no-plugin.test.js`, `tests/core-names-no-plugin.test.js`), each entry resolved by `tools/exceptions.mjs`.

<!-- BEGIN GENERATED: architecture-exceptions. Run tools/generate-architecture.mjs; do not edit by hand. -->
| Ratchet | Where | Count | Why it holds | Ends when |
|---|---|---|---|---|
| L5p | `kernel/router.mjs:routeGeometry` | 1 | a generic polyline's geometry -- rounded turns, the one path the movers and the renderer walk -- named for one consumer, the route | kernel/router.mjs is next changed: rename it then |
| L7k | `cli/verbs.mjs` | 7 | the CLI is installed standalone and imports nothing outside cli/ (the rule B138 gave), so its verbs list the kinds themselves | the CLI learns the kinds from the server (H21.3, U4) |
| L7k | `kernel/adapt.mjs` | 2 | the export door converts a document to the kernel's scene by kind name | the export door draws through the painters (B330) |
<!-- END GENERATED: architecture-exceptions -->

---

## 8. Verification -- the gate

**Maturity: derived.**\
What `npm run gate` runs, before every commit and again before every push.

<!-- BEGIN GENERATED: architecture-gate. Run tools/generate-architecture.mjs; do not edit by hand. -->
| # | Step |
|---|---|
| 1 | `node --test tests/*.test.js` |
| 2 | `node tools/scan-skips.mjs` |
| 3 | `node tools/scan-writers.mjs` |
| 4 | `node tools/scan-claims.mjs dev/COMMIT-DELIVERY.md#2 dev/COMMIT-DELETIONS.md` |
| 5 | `node tools/scan-board.mjs` |
| 6 | `node tools/scan-triggers.mjs` |
| 7 | `node tools/scan-designs.mjs` |
| 8 | `node tools/generate-architecture.mjs --check` |
| 9 | `node tools/scan-docstyle.mjs` |
| 10 | `node tools/scan-dead.mjs` |
| 11 | `node tools/scan-twins.mjs` |
| 12 | `node tools/scan-docrefs.mjs` |
| 13 | `node tools/scan-wiring.mjs` |
| 14 | `node tools/scan-cli.mjs` |
| 15 | `node tools/scan-layers.mjs` |
| 16 | `node tools/lab-matrix.mjs --check` |
| 17 | `node tools/gesture-table.mjs --check` |
| 18 | `node tools/reaction-table.mjs --check` |
| 19 | `node tools/colour-tokens.mjs --check` |
<!-- END GENERATED: architecture-gate -->

---

## 9. Divergence

**Maturity: provisional.**\
What the target states and this instant does not is listed, row by row, in `docs/ARCHITECTURE-TARGET.md`, section 8; each row names the backlog row carrying it.
