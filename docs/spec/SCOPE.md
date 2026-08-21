# draw — Scope

A strictly minimally scoped, grid-aligned diagramming tool. Browser editor, server persistence,
one-way push to Google Slides as native shapes. Complete MVP product — narrow, finished, tested.

## Lineage position

Fourth generation of the draw lineage (`draw` 2021 → `graph` 2023 → `prism` 2026, cloned under
`.refs/` for reference). This generation restores what prism removed (user interactivity) and removes what
prism proved but this tool does not need (the 4-layer compiler, distributed convergence,
auto-layout). Coordinates are user-owned. References are mined for narrow mechanisms only.

## Decisions (locked 2026-06-11)

1. **Canvas**: fixed logical 1920×1080 (16:9), scaled to fit the window. No pan/zoom.
   The canvas maps 1:1 onto a Google Slide via a linear coordinate transform.
   *(Amended 2026-06-12)* — **center-origin coordinates**: [0,0] is the exact
   canvas/slide center, matching external geometric systems. Node grid =
   multiples of 60 from the origin (31×17 points, odd×odd — a true center
   point exists); zone grid keeps the half-cell offset (±30 + k·60). Extents:
   nodes ±900/±480, zones ±930/±510. Docs carry `meta.grid: "center"`; legacy
   top-left documents are migrated on load by a uniform (−930, −510)
   translation (preserves layout exactly; outermost right/bottom band clamps
   inward one cell). The Slides transform adds (+960, +540) before the pt
   conversion — slide fidelity unchanged.
   *(Amended 2026-08-18, CS1/CS5)* — the **geometry above is unchanged**; its two
   mechanisms are gone. Load-time legacy migration was deleted at **CS1**: a
   quadrant-confined top-left document validates clean, so it loaded silently
   displaced by (+930, +510) with no way back. A document that cannot be told
   apart from a valid one must be REJECTED at the boundary, not guessed at, and
   `Store.init` now refuses to boot rather than skipping the file and reseeding
   over it (D17/GR8). `meta.grid` was deleted at **CS5** — it was 'center' on
   every live file and its discriminator role passes to `meta.schema: 1`. There
   are no legacy documents left: all 17 were migrated by
   `tools/migrate-version.mjs`, verified per-entity.
2. **Interaction**: modern conventions. Left-click select, drag from palette to create,
   Delete key deletes, marquee select.
   *(Amended 2026-06-12)* — **two-button gestures** (v1 convention restored): left-drag
   from anywhere on a node draws a link (the whole node is the source — the edge-band
   targeting split is gone); right-drag moves a node/zone and its selection. Click
   semantics, Ctrl+drag clone and the Alt+right-click delete chord are unchanged;
   zones still move on left-drag too (they cannot source a link).
   *(Amended 2026-06-13)* — **stamp hand** (Factorio convention): digits 1-6, Q pipette,
   or a palette-tile click hold a node type; a ghost rides the snapped cell (red when
   occupied — occupied cells refuse), plain click on empty canvas stamps one node per
   click (one undo entry each), Enter stamps at the ghost, and clicking a node of a
   different type retypes it in place (fast-replace: id/name/links survive, undoable).
   Click-select on entities, marquee DRAGS, and all right-button gestures stay live
   while a hand is held — the hand only claims the plain empty-canvas click.
   *(Amended 2026-06-13)* — **data view**: **Tab** toggles a read-only numeric overlay
   (Factorio info X-ray) showing every node's [x, y], every zone's [x, y] w×h, and every
   link's length at once; pointer-inert, tracks the model live, units follow the readout's
   px/cm toggle, on/off persists. The whole grid becomes auditable in one glance.
   *(Amended 2026-06-13)* — **keyboard wiring**: with 2+ nodes selected, **L** links them
   pairwise in selection order (chain), **Shift+L** stars the first-selected to every other;
   existing pairs are skipped (no duplicate), the batch is one undo step. Selection order is
   deterministic but invisible for marquee picks — unambiguous for 2 nodes or the star.
   *(Amended 2026-06-13)* — **link re-plug**: a single selected link shows a handle at
   each endpoint (on the line, just outside its node); left-dragging a handle onto another
   node rewires that end — one undoable `set` (the link keeps its id), refused if it would
   duplicate an existing link or self-loop. Replaces delete-and-redraw for fixing a miswire.
   *(Amended 2026-06-13)* — **keyboard layout instruments**: **Ctrl+D** duplicates the
   selected subgraph at the remembered pitch (the last committed move/clone delta this
   session, default one cell right; clamped to the canvas, refuses when both axes clamp
   to zero — never overlaps); tapping it lays out a row. **Z** wraps the selection in a
   fitted zone (bbox + 30px margin, rounded out to the zone grid). **Shift+arrows**
   resize the lone selected zone one cell at a time (NW-anchored, minimum one cell,
   coalesced into one undo step like nudge). All three are derived, exact, undoable.
   *(Amended 2026-06-12, engineering-UI pass)* — **zone layer**: zones are interactive
   only while Shift is held (additive layer — nodes keep hit priority and their Shift
   semantics). Without Shift, zones are inert backdrop: clicks and marquees pass through,
   which makes marquee-select work inside zones. Marquee never picks zones. Double-click
   rename stays Shift-free (geometric, unambiguous). **Selection visual**: corner
   brackets around the entity footprint (RTS convention) — selection never restyles the
   icon; arming states keep their recolor (transient warnings may shout).
3. **Group**: logical member set `{id, name, members[]}` — select/move as one. No visual of its
   own (zones cover visual regions).
4. **Slides sync**: native Slides shapes ONLY — literal rectangles/lines/ellipses/text, editable
   after sync. Never an image. The target presentation URL is a field on the canvas menu,
   persisted in diagram meta. Push is an explicit button (commit/push), one-way.
5. **Ownership**: unidirectional. The client owns all model mutations during a session; the
   server is persistence-of-record and read-only to everyone else (REST). Single writer —
   no convergence machinery, no conflict resolution.
   *(Amended 2026-06-13)* — **Server-Locked control**: write authority can hand off between
   sides, but never split. Default = *editable* (the browser writes over the websocket; REST
   is read-only). A server-side controller (LLM, script, or a person at the CLI) `POST`s
   `/api/v1/diagrams/:id/lock` to become **Server-Locked**: it then writes over REST
   (`/commit` + high-level `/nodes|/links|/zones|/groups` verbs, token via `X-Draw-Lock`,
   funneling through the same validated `store.commit`), the server live-pushes snapshots to
   the browser, and the browser goes read-only — its websocket writes are refused so it can
   never clobber the controller.
   *(Amended 2026-08-18, CS1/CS3/CS6)* — the REST verb is `/commit`, not `/apply` (X1), and what the
   server live-pushes is the **change** (`change {…, ops}`), not a whole snapshot: a viewer
   applies the ops it is sent rather than reloading the document. Server-Locked itself is
   unchanged — one side writes at a time, the human reclaims anytime. The human reclaims anytime (force-release); an idle lock
   also TTL-expires so a crashed controller never strands a diagram. This stays faithful to
   "single writer": it is a *control handoff*, still exactly one writer at a time — no
   convergence, no conflict resolution, not multi-user. The browser surfaces it with a header
   pill (green **unlocked** / amber **locked**, click to reclaim) and goes read-only while
   locked — selection, the data view, and the readout still work, but no mutations. Read-only
   follows the lock belief, not the connection (a drop while locked stays read-only).
6. **Visual continuity**: the editor looks like draw v1. The v1 visual system is ported as an
   asset, not reinvented: dark theme (#101010 canvas, #202020 grid dots), the hand-authored
   SVG `<defs>` icon library (host, router, vxlan, firewall, loadbalancer, server), the
   CSS-variable state-class system (--icon/--fill/--outer), the palette (#aed581 green
   primary, #4fc3f7 blue links, #e57373 delete-arming red, #81d4fa clone blue), and the
   light translucent rounded rectangles for zones (#ddddff, rx 6px). New visual states
   required by modern interaction (selection, marquee) are designed *inside* the same
   CSS-variable system using graph's orthogonal class composition (e.g. selected × hover
   as independent class dimensions), never as a parallel styling mechanism.

## Borrowed mechanisms (narrow, by source)

| Source | Mechanism |
|---|---|
| draw v1 | dual-grid snap (node grid 60px/30px offset + half-offset zone grid); `<defs>`/`<use>` iconset with CSS-variable state classes; SVG layer ordering (zones→links→nodes→overlay); live snap feedback; the entire visual theme (dark palette, icon artwork, zone styling) ported verbatim from `.refs/draw/index.html` defs + `style.css` + `colours.js` |
| graph | single websocket with reconnect + rehydrate handshake; `{cmd, body}` envelope protocol; prefixed hex entity IDs (`node-a1b2c3`); orthogonal CSS class composition for independent visual state dimensions (was status × hover; becomes selected × hover) |
| prism | debounced write batching (200ms pulse → disk flush, server-side); entity-manifest JSON document format; entity-addressable read-only REST; janitor-lite validation at the server boundary; framework-free `node:test` integrity tests |

Explicitly NOT borrowed: L1–L4 compiler, layouts/settlement, routes/pathfinder, tag selectors,
class/style entities, Merkle/hash auditing, reverse RPC, multi-host, k8s binding, peer mesh.

## Entities (MVP = exactly four)

```json
{
  "meta":   { "id": "diagram-x", "name": "demo", "version": 12, "schema": 1,
              "owner": "user:someone@example.com",
              "grants": { "user:other@example.com": "read", "code:k7f3q2": "write" },
              "slides": { "url": "", "presentationId": "", "pageId": "" } },
  "nodes":  [ { "id": "node-a1b2c3", "name": "web-1", "type": "host", "shape": "circle", "x": 510, "y": 270 } ],
  "links":  [ { "id": "link-9f00aa", "src": "node-a1b2c3", "dst": "node-d4e5f6" } ],
  "zones":  [ { "id": "zone-77bb01", "name": "dmz", "x": 480, "y": 240, "w": 240, "h": 180 } ],
  "groups": [ { "id": "group-3c3c3c", "name": "web-tier", "members": ["node-a1b2c3"] } ]
}
```

`owner` and `grants` are AUTHORIZATION and are server-recorded status, not document content.\
They are written by the store rather than by a commit, so they carry no undo record -- a grant that undo could
reverse would restore access to a principal just revoked.\
A principal is `user:<email>` or `code:<id>`, namespaced so a code can never be mistaken for a person, and a
level is `read` or `write`.\
Neither key is writable through a meta patch, and neither survives arriving on a document from the wire.\
Designed in `docs/spec/ACCESS.md`.\
Corrected 2026-08-21 (B89): this read *enforcement is H9.3 and not yet built*, which stopped being true at H9.3a.\
Writes are gated at all seven mutating store methods, reads at `hello`, `open`, the REST document and log, and `/d/<id>.svg` (B67), and lock acquisition and reclaim at H9.4.\
Pending and not yet built: ACCESS.md's 2026-08-21 amendment rules that `code:<id>` becomes a CREDENTIAL rather than a principal, replaced by an `agent:<name>` identity it authenticates as, and that a grant may name an OWNER as well as a diagram.\
This paragraph describes what the code does today; that amendment describes what it is agreed to become.

- node: a `shape` frame (the outer shell — `circle` | `square`) with a `type` glyph
  attached in its middle, snapped to a grid point, with editable label. Frame and glyph
  are independent layers (`#frame-*` raw-canvas shapes + `#glyph-*` 0.3-scaled art);
  `shape` is optional and defaults to `circle` (legacy docs load unchanged).
- link: straight line between two node centers. No waypoints, no routing.
- zone: grid-aligned rectangle on the half-offset grid, with label. Purely visual.
- group: logical member set; selecting/moving any member moves all. Not rendered, not synced
  as a shape (optionally mapped to Slides `groupObjects` later).

## Wire protocol (one websocket) — as shipped

Client → server:
- `{cmd:"hello", body:{diagram?}}` → `{cmd:"snapshot", body:{doc, diagrams, locked, version, canUndo, canRedo}}`
- `{cmd:"commit", body:{ops, label?, expect?, txnId?}}` → `{cmd:"ack", body:{seq, from, version,
  durableVersion, canUndo, canRedo, ops, acked}}`. One request is one TRANSACTION: a whole
  gesture, not one entity. `expect` is an optional compare-and-swap precondition.
- `{cmd:"undo"|"redo", body:{expect, txnId?}}` → ack carrying the ops to apply
- `{cmd:"resume", body:{diagram, version}}` — reconnect. The client states what it BELIEVES it
  holds; the server answers `{cmd:"sync", body:{version, canUndo, canRedo, locked}}` if they are
  in step, a snapshot if the client is behind, or a snapshot carrying `rewound:{from,to}` if the
  client is ahead. **The client never sends a document to overwrite one.**
- `{cmd:"create", body:{name?, doc?}}` — `doc` is the only whole-document path a client has, and
  it can only CREATE: the server mints the id and ignores `doc.meta.id`
- `{cmd:"select", body:{ids}}` → `ack`, and the server broadcasts `{cmd:"selection", body:{ids, actor}}`
  to the other sessions on that diagram. Selection is model-state, not a change: no version bump, not
  undoable — but it IS a first-class event, because it is what lets a human watch an agent work.
- diagram management: `open {id}`, `reclaim {id?}`,
  `delete {id}` (answers with a snapshot of a surviving diagram; the store
  reseeds the example rather than ever going empty), `list {}`.
  Renaming a diagram and binding a deck are CHANGES, so they travel as a `meta` op inside a
  `commit` — undoable and broadcast like any other. The Slides binding
  (`presentationId`/`pageId`) is status the SERVER records after a successful push.
- failures answer `{cmd:"error", body:{message, code, txnId}}`; sessions survive any payload

Server → client, unprompted: `{cmd:"change", body:{…, ops}}` — every accepted transaction is
broadcast to the other sessions on that diagram, so a second tab and an agent write converge
without refetching. `{cmd:"lock", body:{owner}}` on a Server-Locked handoff.

Server: validates (janitor-lite: field whitelists, ranges, referential integrity,
collection caps), commits through ONE write path, debounce-writes JSON to
`diagrams/<id>.json` (200ms pulse, atomic tmp+rename). Deletes cascade server-side
too, so a persisted document always reloads. On FIRST connect the client hydrates
(hello → snapshot); on RE-connect it sends `resume` and the server decides.
Content drawn before first hydration becomes a NEW diagram via `create {doc}` —
it is never pushed over the diagram the server happened to answer with. A commit
goes out immediately (it is a user-action-rate event); what coalesces is a burst
of same-shape edits, into ONE undoable change. Live drag frames never reach the
wire at all.

*(Amended 2026-08-18, CS1–CS5 — see `docs/spec/COMMIT.md`)* — **the server owns the
document.** The section above HAS BEEN REWRITTEN, not merely annotated: a wire
reference is what a reader copies from, so a superseded-but-still-printed line gets
sent. This amendment is late — **CS1 and CS3 each owed one and did not pay it**, so
those lines were false for three milestones rather than the one GR10 allows, and
nothing mechanized the check (now `tests/spec.test.js`). What changed:

- **`apply {action, kind, entity}` → `commit {ops, label?, expect?, txnId?}`** (CS1). One
  request carries a whole transaction, not one entity. The reply is
  `ack {seq, from, version, durableVersion, canUndo, canRedo, ops, acked}`, not
  `{rev}`, and errors are typed: `error {message, code, txnId}`.
- **`push {doc}` was deleted** (CS4). A client never sends a document to overwrite one.
  On RE-connect it sends `resume {diagram, version}` — a *belief* — and the server
  answers `sync {version, canUndo, canRedo, locked}` if they are in step, a snapshot if
  the client is behind, or a snapshot carrying `rewound {from, to}` if the client is
  **ahead** (a server that restarted before flushing changes it had acked). Content
  drawn before first hydration is no longer pushed over whichever diagram the server
  named — it becomes a **new** diagram via `create {name, doc}`, whose id the server
  mints and whose `doc.meta.id` is ignored.
- **The 200ms client pulse was removed** (CS3). A commit is a user-action-rate event and
  goes out immediately; what batches now is a *burst of same-shape edits* (arrow-key
  nudges), coalesced into ONE change client-side. Live drag frames never reach the wire
  at all — the sync layer subscribes to the commit boundary, not to the model.
- **The server does push model changes** (CS1/CS3): every accepted transaction is
  broadcast to the other sessions on that diagram as `change {…, ops}`, so a second tab
  and an agent write converge without refetching. **Undo and redo are server
  capabilities** (`undo`/`redo {expect, txnId?}`), reversing any writer's change, not
  only the browser's own.

- **`meta.rev` → `meta.version`, and `meta.grid` is gone** (CS5). `rev` counted render
  emissions — one drag advanced it ~60 times — and described no transaction. `version`
  is minted once per accepted transaction and is what `expect` compares. `meta.schema`
  takes over the generation-discriminator role `grid` was accidentally serving. The 17
  live files were migrated by `tools/migrate-version.mjs`; the pre-CS5 binary cannot
  read the result.

*(Amended 2026-08-19, H4)* — three agent-facing surfaces corrected, none visible to the browser:

- **`POST /api/v1/diagrams/:id/commit` takes `{ops, label?}`** — the transaction vocabulary it was
  always documented as taking and never did. It accepted a single legacy `{action, kind, entity}`
  mutation, so the websocket's own shape answered 422 and **multi-op transactions were unreachable
  over REST**: an agent had to issue N round trips, each a window another writer could interleave.
  The legacy shape is **gone, not aliased** (X1 — an alias is a second surface to keep true).
- **`expect` on forward writes rides the `X-Draw-Expect` header** and now actually reaches the
  transaction; it was silently discarded, so an agent believing it held a compare-and-swap held
  nothing. Mandatory `expect` on undo/redo keeps the body form, and is now enforced on the
  **websocket** as well — it had been waived for redo entirely and for undo by the record's own
  author, contrary to D14 (**B39**).
- **Selection broadcasts as `selection {ids, actor}`** on both transports. REST shipped a whole
  document snapshot for a focus change; the websocket broadcast nothing at all, so two viewers never
  shared a selection. Neither was right.

Unchanged and still binding: one websocket per client, `{cmd, body}` both ways, the
server validates everything, sessions survive any payload, and the store reseeds rather
than ever going empty.

## REST (read-only) + actions

- `GET /api/v1/diagrams` — list
- `GET /api/v1/diagrams/:id` — full document
- `GET /api/v1/diagrams/:id/{nodes|links|zones|groups}[/:entityId]`
- `GET /health`
- `POST /api/v1/diagrams/:id/sync/slides` — action endpoint (not a model mutation); also
  triggered by the canvas push button
- `GET /d/:id.svg` — the diagram as a **self-contained SVG document** (glyph defs + styles inlined,
  each shape carrying its entity id). A sibling of the `/d/:id` deep link rather than an `/api/v1`
  route, because it is not a description of the model — it is the picture, for a caller that is not
  the browser. *(Added 2026-08-19.)* This is the consumer the kernel renderer always lacked: the
  client renderer maintains live, individually addressable elements for a person editing, and the
  kernel renderer produces a complete document for everyone else. Two renderers, two duties.

All responses plain JSON, curl/jq-friendly.

## Google Slides sync contract

- Target: presentation URL pasted into the canvas menu, stored in `meta.slides`.
- Transform: PAGE-AWARE — the push reads the deck's pageSize and derives a
  uniform scale (min(pageW/1920, pageH/1080)), anchored at the page CENTER
  (matching the center-origin model); output is integer EMU. The default 10in
  page renders exactly as the original 1px = 0.375pt mapping; a metric
  19.2 × 10.8 cm page (File → Page setup) gives 1px = 0.1mm — every position
  decimal-exact, and Slides' From-Center readout equals the model coordinate
  ÷100 in cm. Text and stroke weights scale with the page so the rendered
  look is identical at any size. Non-16:9 pages letterbox, centered. No mode,
  nothing stored: the deck's page size IS the switch, reversible by re-push.
- Mapping (native shapes only) — as shipped:
  - zone → `RECTANGLE` (sharp: the Slides API exposes no corner-radius
    adjustment; the default ROUND_RECTANGLE radius is far rounder than the
    source rx 6px ≈ 2.25pt, so sharp is the closest match), translucent fill,
    label text INSIDE the shape. Accepted deviation: inline zone labels sit
    at the API's fixed ~7.2pt text inset (~19px) from the left border vs the
    canvas's 10px — verified unfixable (no inset fields anywhere in the API
    schema; negative paragraph indents are stored but clamped at render);
    kept inline because the label then moves AND resizes with the zone
  - node → `ELLIPSE` for every node regardless of `shape`, faithful to the canvas
    circle icons; circles also make connector attachment read center-out like the
    source. The client `shape` frame (circle/square) is not yet mapped here —
    `square → RECTANGLE` + inner glyphs remain a deliberate future discussion.
  - node labels → adjacent TEXT_BOX below the shape (v1 look)
  - center handles → each node carries a small visible HUB dot at its center;
    connectors bind to the hub (every site of a 6px ellipse IS the center,
    so attachment is center-out from any angle, no site quantization)
  - node parts (circle + hub + label) are grouped via `groupObjects`, so a
    node dragged in Slides moves as one and bound lines track its center
  - link → `createLine` edge-to-edge geometry, then best-effort hub binding;
    each ladder rung (bind, group) degrades gracefully if the API rejects it
- Identity: Slides `objectId` = entity id (our format is valid). Re-sync is
  idempotent and two-tiered: the TARGET slide is wiped of every draw-shaped
  id (stale cleanup — deleted entities are no longer in the model), while every
  OTHER slide is wiped only of ids belonging to this diagram's entities (URL
  re-binding cleans up after itself; sibling diagrams on other slides are never
  touched). Consequence: two diagrams bound to the SAME slide replace each
  other — one diagram per slide. Recreate from model.
- Auth: Google OAuth installed-app flow, `presentations` scope, stored refresh token.
  Setup documented in README.
- One-way push only. No import, no live binding.

## Durability — what is actually guaranteed

**Undo survives a *process* restart. A machine-level kill can lose the last 200 ms of websocket
work — document and log together, consistent, never corrupt.**

Stated at exactly the strength the code makes, and no more. There is no `fsync` anywhere in the
server: a write is `writeFileSync` + `renameSync`, which is atomic against a process dying but not
against a kernel that has not yet flushed its page cache. The document and its change log are ONE
file, so a lost write loses both together and never leaves a log describing a document that does
not exist.

REST writes are stronger, deliberately: an agentic caller is one-shot and has no reconnect
backstop, so a REST 200 means flushed, not merely accepted. The 200 ms debounce applies to
websocket work only, where a browser reconnects and replays its outbox.

Recorded as deviation **X2**; `docs/BACKLOG.md` **B6** carries the revival trigger (any
multi-instance or GCS-backed deployment — confirm the gcsfuse assumptions against a real bucket
before relying on them).

## In scope (functions)

Drawing: palette create, snap move, delete, clone, link draw (node edge drag), zone draw,
labels (double-click edit). Selection: click, marquee, multi-move. Undo/redo: client-side
command stack. Persistence: continuous auto-save over WS, named diagrams (list/create/open/delete
with two-click arming), first-boot example seed (from the tracked `examples/` corpus into the
untracked runtime data dir — content and state are different things), hydrate on connect/reconnect. Slides: URL field + push button + idempotent sync.

*(Amended 2026-08-20, H9)* — **the example corpus becomes a TEMPLATE set, not a first-boot seed.**
Under per-diagram access control the old behaviour is wrong twice: the corpus is shared state every
principal can edit, and no principal has a starting point of their own. Templates are read from the
image, never written to the store, and listed to everyone; the first mutation against one forks a
new diagram with a new id, owned by the caller. The invariant the first-boot rule protected is
unchanged and is the reason this is safe — **deleted user work never returns**. A template is not
user work, so a template reappearing after its fork is deleted is not a resurrection; what stays
impossible is the deleted fork coming back. Designed in `docs/spec/ACCESS.md`, not yet built.

*(Amended 2026-08-18, CS3)* — **undo/redo are a SERVER capability**, not a client-side command
stack. The stack was destroyed by any authoritative snapshot, and a REST write broadcast one — so
Ctrl+Z could not reverse an agent's change, only lose your own. The server holds a bounded log of
changes with their inverses; `undo`/`redo {expect}` reverse whoever's change is on top. The client
keeps only a coalesce window, so a burst of nudges is still ONE undo step. See the wire-protocol
amendment above and `docs/spec/COMMIT.md` §3 (D3, D14, D21).
Product: README with real usage, one-command start, seeded example diagram, tests
(model, protocol, slides mapping with mocked API, CLI integrity).
*(Amended 2026-06-13)* — a sovereign **read-only `draw` CLI** (`cli/`, bash+curl+jq over
the REST API) ships as a first-class agentic/operator surface; it is bundled in the single
container. Still strictly read-only — it adds no mutation path, honoring single-writer
ownership. (Supersedes the "CLI binary" exclusion below: that ruled out a *write* CLI.)

*(Amended 2026-08-18, CS6)* — the write-CLI question is answered **no**; the exclusion stands.
CS6 adds `draw history` (read) and does **not** add `draw undo` / `draw redo`, though the design
listed them. The condition this CLI was admitted on is that it adds no mutation path, and undo is
the *destructive* verb — the one the whole `expect`/reclaim apparatus exists to stop anyone issuing
blind. A bash wrapper is one shell-history recall away from reversing work nobody meant to touch,
and it cannot hold a lock across the two calls it would need. Agents keep
`POST /api/v1/diagrams/:id/undo`, where the lock and `expect` gates live. Revisit only if an
operator hits a case the REST call cannot serve.

## Explicitly out of scope

Auto-layout; routes/waypoints/orthogonal routing; style/class/theme systems beyond built-in CSS
variables; multi-user editing, presence, conflicts (single editor, last-write-wins); server→client
pushes beyond hydrate/ack; Slides import or live sync; pan/zoom; touch/mobile; auth on the local
server; external system bindings; a *write*/mutation CLI (the read-only CLI is in scope — see
above); arbitrary shapes/images; diagram-to-diagram copy.

## Definition of done (MVP)

Fresh clone → `npm install` → `npm start` → draw nodes/links/zones/groups → close browser,
reopen, state persists → `curl localhost:<port>/api/v1/diagrams/<id> | jq` works → paste a
Slides URL, hit push → the diagram appears in Slides as native, individually editable shapes →
push again after edits → slide updates in place. Tests pass via `npm test`.
