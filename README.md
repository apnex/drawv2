# draw

A strictly minimal, grid-aligned diagramming tool. Browser SVG editor with the
draw-v1 visual theme, JSON diagram state persisted server-side, one-way push to
Google Slides as **native shapes**. See [SCOPE.md](docs/spec/SCOPE.md) for the locked scope.

## Status

- **M1 — editor core: complete.** Canvas, dual-grid snap, node/link/zone/group,
  selection, undo/redo. Runs entirely in-browser.
- **M2 — server persistence: complete.** One websocket (hydrate + delta apply +
  reconnect push), debounced JSON persistence, read-only REST, diagram menu
  (list/create/open/rename), deep links, single-image Docker deploy.
- **M3 — labels, clone, polish: complete.** Always-visible labels with inline
  rename (double-click/F2), Ctrl+drag subgraph clone (blue arming), Alt+right-click
  delete (red arming — the v1 chord, resurrected), arrow-key nudge, zone resize
  handles, crosshair link affordance, `/` help overlay, Ctrl+A.
  Every milestone reviewed by multi-agent adversarial passes.
- **M4 — Google Slides push: complete.** URL field + push button in the header,
  one-way push as native shapes (dark background, circle nodes with center
  hubs matching the canvas, hub-bound connector lines, translucent
  sharp-cornered zones with inline labels), idempotent two-tier re-sync
  (target slide cleared of draw shapes, this diagram's ids cleaned up
  elsewhere — sibling diagrams untouched), OAuth installed-app flow with
  zero added dependencies. Verified against a live presentation.
- **M5 — hardening + engineering-UI: complete.** Center-origin grid, page-aware
  metric Slides transform, two-button gestures, the Factorio-style stamp hand,
  ortho lock, chain wiring, datum, duplicate-at-pitch, wrap-zone, zone-resize
  keys, plus the sovereign read-only `draw` CLI — each landed and hardened by a
  multi-agent adversarial review. Ships as one unified container (editor + API +
  CLI), verified by a fresh-clone walkthrough. Current gate: 183 node tests, all
  green (`npm test`). One runtime dependency (`ws`); no build step.

## Run

Requires Node 18+ (global fetch, node:test).

```
npm start            # editor + persistence + REST on http://localhost:8080 (ws on /ws)
                     #   flags: --port N, --data DIR (default ./diagrams), or PORT env
npm test             # node:test suites: core + server + slides (mocked API) + CLI integrity
```

The editor (the kernel-rendered `app/` thin UI) is served by the draw server at `/`; it needs
the server for its module mounts (`/kernel`, `/engine`, `/document`), persistence (websocket),
and the read-only REST API.

## Persistence & API

Every committed edit auto-saves over the websocket — there is no save button. A commit is a
user-action-rate event and goes out immediately; live drag frames never reach the wire at all.
Diagrams persist as JSON in `diagrams/<id>.json`, each carrying its own change log, and survive
restarts. Coordinates are **center-origin**: [0,0] is the canvas/slide center (x ±960, y ±540,
node grid on multiples of 60).
The header menu lists, creates, opens, renames, and deletes diagrams (the × button
arms red on first click — deletion is the one non-undoable action).

**`examples/` vs `diagrams/`.** `examples/` is the shipped corpus, tracked in git and copied into
the data dir on **first boot only** — delete one and it stays deleted. `diagrams/` (or `$DATA_DIR`)
is runtime state and is *not* tracked: the store rewrites a file on every edit, so a tracked runtime
directory would show a diff whenever anyone used the app, and in a container it is a mounted volume
anyway. Deleting the last diagram reseeds a single example rather than leaving the store empty.

**Durability, exactly.** Undo survives a **process** restart. A machine-level kill can lose the
last 200 ms of websocket work — document and log together, consistent, never corrupt. There is no
`fsync`: a write is `writeFileSync` + `renameSync`, atomic against a dying process but not against
an unflushed page cache. The document and its log are one file, so a lost write never leaves a log
describing a document that does not exist. REST writes are stronger on purpose — an agentic caller
is one-shot with no reconnect backstop, so a REST 200 means *flushed*, not merely accepted.

**Undo is the server's, not the tab's.** It reverses whoever's change is on top, so Ctrl+Z takes
back an agent's write as readily as your own. When the top of the log belongs to someone else, the
banner offers `Ctrl+Shift+Backspace` — *undo all N changes by `<actor>`* — which reverses the whole
run as one transaction rather than N racy steps. `draw history` shows who did what.

Every diagram has a stable id and a **deep link**: `http://localhost:8080/d/<diagram-id>`
opens the editor on that diagram directly, and the address bar always tracks the
diagram you are viewing — bookmark or share it. (An unknown id falls back to the
default diagram and the URL corrects itself.)

## Google Slides sync

Bind a presentation by pasting its URL into the header field, then hit **⇑ slides**.
The diagram lands on the slide as **native, individually editable shapes** — dark
background, circles for nodes (matching the canvas), connector-bound lines for
links, translucent rectangles for zones, text labels — never an image. Re-pushing replaces exactly the objects draw
created (ids are stable) and leaves anything you added in Slides untouched.
If the URL contains `#slide=id.<x>` that slide is targeted, otherwise the first one.

The push adapts to the deck's page size automatically (nothing to configure).
For **decimal-exact metric geometry**, set the deck to a custom page of
**19.2 × 10.8 cm** (File → Page setup): 1 canvas px = 0.1mm, grid cells = 6mm,
and with Format options set to *From: Center* the position readout equals the
model coordinate (÷100, in cm). Default-size decks render exactly as before;
switching back is just re-pushing after restoring the page size.

One-time setup (Google credentials, ~5 minutes):

1. In [Google Cloud Console](https://console.cloud.google.com/), create/pick a project
   and **enable the Google Slides API**.
2. Configure the OAuth consent screen (External, add yourself as a test user).
3. Credentials → **Create credentials → OAuth client ID → Desktop app**.
4. Download the client JSON and save it as `secrets/google-credentials.json`
   (or point `GOOGLE_OAUTH_CREDENTIALS` at it). `secrets/` is gitignored, and is
   kept separate from `diagrams/` so the diagram data volume carries no credentials.
   Override the whole directory with `SECRETS_DIR` or `--secrets <dir>`.
5. First push: the editor opens a Google consent tab; approve, then push again.
   The refresh token is then written to `secrets/google-token.json` (mode 600;
   the directory is created on first authorization). It is a runtime artifact —
   delete it to force re-authorization. Override with `GOOGLE_OAUTH_TOKEN`.

Notes: each node pushes as a small Slides group — circle + a visible center
hub dot + its label. Connectors bind to the hub, so lines attach to the
CENTER from any angle and stay nailed to it when you drag the group around
in Slides; the label travels too. Zone labels live inside their rectangle. Re-pushing replaces draw shapes on
the TARGET slide plus this diagram's own shapes wherever they have moved
(found even inside groups) — other diagrams pushed to other slides of the
same deck, and shapes you added yourself, are never touched. If your OAuth redirect differs from
`http://localhost:<port>/oauth2callback`, set `OAUTH_REDIRECT_URI`.

## Docker

The whole product ships as **one image** (node:22-alpine, ~178MB, non-root,
healthcheck): the editor, the persistence websocket, the read-only REST API, Slides
push, and the `draw` CLI. Diagrams live in the `/data` volume.

```
docker build -t draw .
docker run -d -p 8080:8080 -v $(pwd)/diagrams:/data draw
# or: docker compose up -d
```

Config via env: `PORT` (default 8080), `HOST` (default 127.0.0.1 bare-metal,
0.0.0.0 in the image), `DATA_DIR` (default /data in the image), `CLIENT_DIR`
(point at `/none` to run **API-only** — websocket + REST with no bundled editor).
`docker stop` is graceful: pending writes flush on SIGTERM. The smoke harness is
never shipped in the image.

The CLI is on the container's PATH, pointed at the server inside it:

```
docker exec <container> draw show          # full diagram view
docker exec <container> draw get nodes      # or run it on the host vs the exposed port
```

## REST: reads + Server-Locked writes

Reads are always open:

```
curl -s localhost:8080/health | jq
curl -s localhost:8080/api/v1/diagrams | jq
curl -s localhost:8080/api/v1/diagrams/<id> | jq
curl -s localhost:8080/api/v1/diagrams/<id>/nodes | jq          # also /links /zones /groups
curl -s localhost:8080/api/v1/diagrams/<id>/nodes/<nodeId> | jq
curl -s localhost:8080/api/v1/diagrams/<id>/selection | jq        # the authoritative selection
curl -s localhost:8080/api/v1/diagrams/<id>/history | jq          # who changed what
```

**Writes** are normally the browser's alone (over the websocket). A *server-side
controller* — an LLM, a script, or a person at the terminal — can take exclusive
control by acquiring the diagram's lock, then write over REST while the browser
goes read-only (the header pill turns amber **locked**; click it to take control
back). One side writes at a time — a control handoff, never concurrent editing.

```
TOK=$(curl -s -X POST localhost:8080/api/v1/diagrams/<id>/lock | jq -r .token)
# low-level (the transaction vocabulary the websocket uses) — ops travel as a batch, and a batch
# is ONE change: one version bump, one undo step, no window for another writer to interleave
curl -s -X POST localhost:8080/api/v1/diagrams/<id>/commit -H "X-Draw-Lock: $TOK" \
     -d '{"ops":[{"op":"put","kind":"node","entity":{...}}],"label":"create node"}'
# high-level verbs (the server mints ids/names):
curl -s -X POST   localhost:8080/api/v1/diagrams/<id>/nodes      -H "X-Draw-Lock: $TOK" -d '{"type":"server","x":120,"y":-60}'
curl -s -X PATCH  localhost:8080/api/v1/diagrams/<id>/nodes/<id> -H "X-Draw-Lock: $TOK" -d '{"x":240}'
curl -s -X DELETE localhost:8080/api/v1/diagrams/<id>/nodes/<id> -H "X-Draw-Lock: $TOK"
curl -s -X DELETE localhost:8080/api/v1/diagrams/<id>/lock       -H "X-Draw-Lock: $TOK"   # release
```

`expect` is an optional compare-and-swap on any forward write, and travels as a **header** —
`-H "X-Draw-Expect: 42"` — because a forward write's body is an entity payload and a reserved key
there would collide with field validation. A stale one answers **409** and writes nothing. On undo
and redo `expect` is mandatory and rides the body instead, because there the body *is* control:
control fields ride the body only where the body is control.

Every write funnels through the same validation — and the same single write path — the websocket
uses, then broadcasts the change to the browser. An idle lock auto-expires (~60s) so a crashed
controller never strands a diagram.

Undo and redo are the one pair of verbs whose target is *implicit* — the top of a log another
writer may have moved since you read it — so `expect` is mandatory on them, and only on them:

```
curl -s localhost:8080/api/v1/diagrams/<id>/history            # who changed what, and what is undoable
curl -s -X POST localhost:8080/api/v1/diagrams/<id>/undo -H "X-Draw-Lock: $TOK" \
     -d '{"expect":42}'                                        # 409 if the log moved; the body says how
curl -s -X POST localhost:8080/api/v1/diagrams/<id>/undo -H "X-Draw-Lock: $TOK" \
     -d '{"expect":42,"to":38}'                                # back out a whole run as ONE transaction
```

**Actions** are not model mutations and take no lock — they act on the outside world:

```
curl -s -X POST localhost:8080/api/v1/diagrams/<id>/sync/slides   # push to the bound deck
```

A stale `expect` answers 409 carrying the records that landed since — reconcile, rather than
refetch and diff. `draw undo` is deliberately **not** a CLI verb: see `docs/spec/SCOPE.md`.

## Controls

| Action | Input |
|---|---|
| Create node | drag a type from the left palette onto the canvas |
| Stamp hand | digits 1-6 (or a tile click) hold a type — ghost rides the snapped cell, every click stamps one, Enter stamps at the ghost, Q pipettes the type under the cursor, Esc/same digit drops the hand |
| Fast-replace | with a hand held, click a node of a different type to retype it in place (name and links survive) |
| Link | left-drag from a node (crosshair ring) onto another node |
| Link selected | L chains selected nodes in selection order; Shift+L stars from the first-selected |
| Data view | Tab toggles a numeric overlay — every node's coords, link lengths, zone dims (units follow the readout) |
| Move | right-drag a node (or any selected set); snaps to grid on release. Zones: with Shift held |
| Zone | hold Shift, drag on empty canvas (zone grid appears) |
| Zone layer | zones are inert unless Shift is held — Shift+click selects, Shift+drag moves; plain clicks and marquees pass through |
| Resize zone | drag a corner handle of the selected zone |
| Select | click; Shift/Ctrl-click to add or toggle; drag empty canvas for marquee (grabs enclosed links too) |
| Select all | Ctrl+A |
| Edit label | double-click a node/zone, or F2 with it selected |
| Clone | Ctrl+drag a node/zone (blue arming; clones the selected subgraph) |
| Duplicate | Ctrl+D repeats the selection at the last move/clone offset (default one cell right); tap to lay out a row |
| Wrap in zone | Z fits a zone around the selection (snapped to the zone grid) |
| Resize zone | drag a corner handle, or Shift+arrows one cell at a time |
| Re-plug a link | select a link, drag an endpoint handle onto another node (one undoable retarget) |
| Axis lock | hold Shift during a move/clone drag (press it after the drag starts) |
| Chain links | hold Shift when releasing a link on its target — the run continues from there |
| Datum | Space sets a local origin under the cursor (readout shows ∂); Shift+Space clears |
| Rename run | Tab in the label editor commits and opens the next entity's label |
| Delete under cursor | Alt+right-click (red arming) |
| Nudge | arrow keys (one grid cell; a quick burst is one undo step) |
| Group / ungroup | Ctrl+G / Ctrl+Shift+G (grouped nodes select and move as one) |
| Delete selection | Delete or Backspace |
| Undo / redo | Ctrl+Z / Ctrl+Shift+Z (or Ctrl+Y) |
| Cancel / clear / close | Escape |
| Help overlay | / (or ?) |
| Push to Slides | paste presentation URL in the header field, click ⇑ slides |

## Layout

```
app/             browser editor — kernel-rendered thin UI (vanilla ES modules, no build step)
  src/           renderer, input, commands, painter, selection, snap (grid math),
                 palette, labeledit, readout (coordinate HUD), net (ws pipe),
                 sync (model<->wire), main (boot/wiring)
document/        sovereign document Model — entity store + id helpers + surface/extent constants
kernel/          sovereign geometry — resolve(schema)->scene, routing, GRC, locked spec
engine/          sovereign relational substrate — incidence / membership / occupancy indices
server/          persistence server: app, server (entry), store, protocol, rest,
                 validate, seed (first-boot example)
  slides/        Slides push: transform (model->requests), sync (wipe+create), auth (OAuth)
cli/             draw.sh — sovereign read-only CLI over the REST API (+ tpl/ jq tables)
tests/           node:test suites (core + server + slides + cli) + fixtures/
docs/spec/       the locked product specification (SCOPE, HIERARCHY, ATOMICS, DESIGN)
design/          design-process provenance: mockups + rendered panel studies
diagrams/        persisted diagram JSON (gitignored user data)
secrets/         OAuth client + refresh token (gitignored; see "Google Slides sync")
.refs/           reference clones of the draw lineage (not part of this project)
```

## License

MIT — see [LICENSE](LICENSE).
