# draw - decisions

**Status: enduring, append-and-amend.**\
The ratified decision register: what was ruled, when, and what it affects.

A decision here is not re-litigated.\
It is **amended in place with a date** when it is reversed or narrowed, so the reasoning behind a change survives the change and a reader can see that a position moved rather than finding only its replacement.

Holding this document authorises nothing.\
It records rulings; it does not make them.\
Purpose belongs to [`../VISION.md`](../VISION.md), the live plan to [`BOARD.md`](BOARD.md), and the durable record of what was not done to [`BACKLOG.md`](BACKLOG.md).

> **Opened 2026-09-03**, carrying the locked decisions and their amendments out of `docs/spec/SCOPE.md`.\
> They were never scope: a scope document says what is in and out, and these are rulings with dated reversals.\
> They lived there because nothing else existed to hold them, which is the shape a missing artifact leaves behind.\
> `GR10` enforces the amendment discipline below and reads this file.

---

## Decisions (locked 2026-06-11)

1. **Canvas**: fixed logical 1920x1080 (16:9), scaled to fit the window. No pan/zoom.
   The canvas maps 1:1 onto a Google Slide via a linear coordinate transform.
   *(Amended 2026-06-12)* - **center-origin coordinates**: [0,0] is the exact
   canvas/slide center, matching external geometric systems. Node grid =
   multiples of 60 from the origin (31x17 points, oddxodd - a true center
   point exists); zone grid keeps the half-cell offset (+/-30 + k-60). Extents:
   nodes +/-900/+/-480, zones +/-930/+/-510. Docs carry `meta.grid: "center"`; legacy
   top-left documents are migrated on load by a uniform (-930, -510)
   translation (preserves layout exactly; outermost right/bottom band clamps
   inward one cell).
   *(Amended 2026-08-18, CS1/CS5)* - the **geometry above is unchanged**; its two
   mechanisms are gone. Load-time legacy migration was deleted at **CS1**: a
   quadrant-confined top-left document validates clean, so it loaded silently
   displaced by (+930, +510) with no way back. A document that cannot be told
   apart from a valid one must be REJECTED at the boundary, not guessed at, and
   `Store.init` now refuses to boot rather than skipping the file and reseeding
   over it (D17/GR8). `meta.grid` was deleted at **CS5** - it was 'center' on
   every live file and its discriminator role passes to `meta.schema: 1`. There
   are no legacy documents left: all 17 were migrated by
   `tools/migrate-version.mjs`, verified per-entity.
2. **Interaction**: modern conventions. Left-click select, drag from palette to create,
   Delete key deletes, marquee select.
   *(Amended 2026-06-12)* - **two-button gestures** (v1 convention restored): left-drag
   from anywhere on a node draws a link (the whole node is the source - the edge-band
   targeting split is gone); right-drag moves a node/zone and its selection. Click
   semantics, Ctrl+drag clone and the Alt+right-click delete chord are unchanged;
   zones still move on left-drag too (they cannot source a link).
   *(Amended 2026-06-13)* - **stamp hand** (Factorio convention): digits 1-6, Q pipette,
   or a palette-tile click hold a node type; a ghost rides the snapped cell (red when
   occupied - occupied cells refuse), plain click on empty canvas stamps one node per
   click (one undo entry each), Enter stamps at the ghost, and clicking a node of a
   different type retypes it in place (fast-replace: id/name/links survive, undoable).
   Click-select on entities, marquee DRAGS, and all right-button gestures stay live
   while a hand is held - the hand only claims the plain empty-canvas click.
   *(Amended 2026-06-13)* - **data view**: **Tab** toggles a read-only numeric overlay
   (Factorio info X-ray) showing every node's [x, y], every zone's [x, y] wxh, and every
   link's length at once; pointer-inert, tracks the model live, units follow the readout's
   px/cm toggle, on/off persists. The whole grid becomes auditable in one glance.
   *(Amended 2026-06-13)* - **keyboard wiring**: with 2+ nodes selected, **L** links them
   pairwise in selection order (chain), **Shift+L** stars the first-selected to every other;
   existing pairs are skipped (no duplicate), the batch is one undo step. Selection order is
   deterministic but invisible for marquee picks - unambiguous for 2 nodes or the star.
   *(Amended 2026-06-13)* - **link re-plug**: a single selected link shows a handle at
   each endpoint (on the line, just outside its node); left-dragging a handle onto another
   node rewires that end - one undoable `set` (the link keeps its id), refused if it would
   duplicate an existing link or self-loop. Replaces delete-and-redraw for fixing a miswire.
   *(Amended 2026-06-13)* - **keyboard layout instruments**: **Ctrl+D** duplicates the
   selected subgraph at the remembered pitch (the last committed move/clone delta this
   session, default one cell right; clamped to the canvas, refuses when both axes clamp
   to zero - never overlaps); tapping it lays out a row. **Z** wraps the selection in a
   fitted zone (bbox + 30px margin, rounded out to the zone grid). **Shift+arrows**
   resize the lone selected zone one cell at a time (NW-anchored, minimum one cell,
   coalesced into one undo step like nudge). All three are derived, exact, undoable.
   *(Amended 2026-06-12, engineering-UI pass)* - **zone layer**: zones are interactive
   only while Shift is held (additive layer - nodes keep hit priority and their Shift
   semantics). Without Shift, zones are inert backdrop: clicks and marquees pass through,
   which makes marquee-select work inside zones. Marquee never picks zones. Double-click
   rename stays Shift-free (geometric, unambiguous). **Selection visual**: corner
   brackets around the entity footprint (RTS convention) - selection never restyles the
   icon; arming states keep their recolor (transient warnings may shout).
3. **Group**: logical member set `{id, name, members[]}` - select/move as one. No visual of its
   own (zones cover visual regions).
   persisted in diagram meta. Push is an explicit button (commit/push), one-way.
5. **Ownership**: unidirectional. The client owns all model mutations during a session; the
   server is persistence-of-record and read-only to everyone else (REST). Single writer -
   no convergence machinery, no conflict resolution.
   *(Amended 2026-06-13)* - **Server-Locked control**: write authority can hand off between
   sides, but never split. Default = *editable* (the browser writes over the websocket; REST
   is read-only). A server-side controller (LLM, script, or a person at the CLI) `POST`s
   `/api/v1/diagrams/:id/lock` to become **Server-Locked**: it then writes over REST
   (`/commit` + high-level `/nodes|/links|/zones|/groups` verbs, token via `X-Draw-Lock`,
   funneling through the same validated `store.commit`), the server live-pushes snapshots to
   the browser, and the browser goes read-only - its websocket writes are refused so it can
   never clobber the controller.
   *(Amended 2026-08-18, CS1/CS3/CS6)* - the REST verb is `/commit`, not `/apply` (X1), and what the
   server live-pushes is the **change** (`change {..., ops}`), not a whole snapshot: a viewer
   applies the ops it is sent rather than reloading the document. Server-Locked itself is
   unchanged - one side writes at a time, the human reclaims anytime. The human reclaims anytime (force-release); an idle lock
   also TTL-expires so a crashed controller never strands a diagram. This stays faithful to
   "single writer": it is a *control handoff*, still exactly one writer at a time - no
   convergence, no conflict resolution, not multi-user. The browser surfaces it with a header
   pill (green **unlocked** / amber **locked**, click to reclaim) and goes read-only while
   locked - selection, the data view, and the readout still work, but no mutations. Read-only
   follows the lock belief, not the connection (a drop while locked stays read-only).
6. **Visual continuity**: the editor looks like draw v1. The v1 visual system is ported as an
   asset, not reinvented: dark theme (#101010 canvas, #202020 grid dots), the hand-authored
   SVG `<defs>` icon library (host, router, vxlan, firewall, loadbalancer, server), the
   CSS-variable state-class system (--icon/--fill/--outer), the palette (#aed581 green
   primary, #4fc3f7 blue links, #e57373 delete-arming red, #81d4fa clone blue), and the
   light translucent rounded rectangles for zones (#ddddff, rx 6px). New visual states
   required by modern interaction (selection, marquee) are designed *inside* the same
   CSS-variable system using graph's orthogonal class composition (e.g. selected x hover
   as independent class dimensions), never as a parallel styling mechanism.

---

## Borrowed mechanisms (narrow, by source)

| Source | Mechanism |
|---|---|
| draw v1 | dual-grid snap (node grid 60px/30px offset + half-offset zone grid); `<defs>`/`<use>` iconset with CSS-variable state classes; SVG layer ordering (zones->links->nodes->overlay); live snap feedback; the entire visual theme (dark palette, icon artwork, zone styling) ported verbatim from `.refs/draw/index.html` defs + `style.css` + `colours.js` |
| graph | single websocket with reconnect + rehydrate handshake; `{cmd, body}` envelope protocol; prefixed hex entity IDs (`node-a1b2c3`); orthogonal CSS class composition for independent visual state dimensions (was status x hover; becomes selected x hover) |
| prism | debounced write batching (200ms pulse -> disk flush, server-side); entity-manifest JSON document format; entity-addressable read-only REST; janitor-lite validation at the server boundary; framework-free `node:test` integrity tests |

Explicitly NOT borrowed: L1-L4 compiler, layouts/settlement, routes/pathfinder, tag selectors, class/style entities, Merkle/hash auditing, reverse RPC, multi-host, k8s binding, peer mesh.

---

## Google Slides sync -- REMOVED

Retired.\
`slides` is the sole entry in `RETIRED_META` in `server/store.js`: the key is stripped from every document on read, so no diagram carries it and nothing writes it.\
The `POST /api/v1/diagrams/:id/sync/slides` endpoint this section used to specify does not exist in `server/routes.mjs`.

Recorded as removed rather than deleted outright, because a reader who meets `slides` in an old export or in the retired-meta list should be able to find out what it was and that it is gone.
---

## Capability rulings, and what reversed them

*(Moved 2026-09-03 from `SCOPE.md`'s "In scope (functions)".\
The list itself was scope and is gone with that document; what is kept is the dated amendments, because each records a locked position being reversed and `GR10` requires them to survive.\
The capability statements around them are retained as the context the amendment reverses -- an amendment with its subject deleted is a correction to nothing.)*

### As shipped, with the rulings that changed it

Drawing: palette create, snap move, delete, clone, link draw (node edge drag), zone draw, labels (double-click edit).\
Selection: click, marquee, multi-move.\
Undo/redo: client-side command stack.\
Persistence: continuous auto-save over WS, named diagrams (list/create/open/delete with two-click arming), first-boot example seed (from the tracked `examples/` corpus into the untracked runtime data dir - content and state are different things), hydrate on connect/reconnect.

*(Amended 2026-08-20, H9)* - **the example corpus becomes a TEMPLATE set, not a first-boot seed.**\
Under per-diagram access control the old behaviour is wrong twice: the corpus is shared state every principal can edit, and no principal has a starting point of their own.\
Templates are read from the image, never written to the store, and listed to everyone; the first mutation against one forks a new diagram with a new id, owned by the caller.\
The invariant the first-boot rule protected is unchanged and is the reason this is safe - **deleted user work never returns**.\
A template is not user work, so a template reappearing after its fork is deleted is not a resurrection; what stays impossible is the deleted fork coming back.\
Designed in `docs/spec/ACCESS.md`, not yet built.

*(Amended 2026-08-18, CS3)* - **undo/redo are a SERVER capability**, not a client-side command stack.\
The stack was destroyed by any authoritative snapshot, and a REST write broadcast one - so Ctrl+Z could not reverse an agent's change, only lose your own.\
The server holds a bounded log of changes with their inverses; `undo`/`redo {expect}` reverse whoever's change is on top.\
The client keeps only a coalesce window, so a burst of nudges is still ONE undo step.\
See the wire-protocol amendment above and `docs/spec/COMMIT.md` section 3 (D3, D14, D21).\
Product: README with real usage, one-command start, seeded example diagram, tests (model, protocol, slides mapping with mocked API, CLI integrity).\
*(Amended 2026-06-13)* - a sovereign **read-only `draw` CLI** (`cli/`, bash+curl+jq over the REST API) ships as a first-class agentic/operator surface; it is bundled in the single container.\
Still strictly read-only - it adds no mutation path, honoring single-writer ownership.\
(Supersedes the "CLI binary" exclusion below: that ruled out a *write* CLI.)

*(Amended 2026-08-18, CS6)* - the write-CLI question is answered **no**; the exclusion stands.\
CS6 adds `draw history` (read) and does **not** add `draw undo` / `draw redo`, though the design listed them.\
The condition this CLI was admitted on is that it adds no mutation path, and undo is the *destructive* verb - the one the whole `expect`/reclaim apparatus exists to stop anyone issuing blind.\
A bash wrapper is one shell-history recall away from reversing work nobody meant to touch, and it cannot hold a lock across the two calls it would need.\
Agents keep `POST /api/v1/diagrams/:id/undo`, where the lock and `expect` gates live.\
Revisit only if an operator hits a case the REST call cannot serve.

---
