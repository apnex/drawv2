# draw

A strictly minimal diagramming tool with precise, programmable geometry, drivable by a human or an agent.

**Status:** working.\
Node 18+, no build step, one runtime dependency (`ws`).

Diagrams are a browser SVG editor over a server-held JSON document.\
Everything is snapped to a center-origin grid, every edit is undoable across restarts, and a server-side agent can drive the same document over REST while a human watches it change.

See [SCOPE.md](docs/spec/SCOPE.md) for the locked scope.

---

## Install

Run it directly with Node:
```sh
npm install
npm start
```

The editor is then on `http://localhost:8080`, with the websocket on `/ws`.\
Flags are `--port N` and `--data DIR`, or set `PORT` and `DATA_DIR`.

### Container

The whole product ships as one image: editor, websocket, REST API, Slides push, and the `draw` CLI.
```sh
docker build -t draw .
docker run -d -p 8080:8080 -v "$(pwd)/diagrams:/data" draw
```

The same thing through Compose:
```sh
docker compose up -d
```

Config is by environment: `PORT`, `HOST`, `DATA_DIR`, and `CLIENT_DIR`.\
`CLIENT_DIR` points the static server at a directory other than the bundled `app/`.

---

## Use

Drag a type from the left palette onto the canvas to create a node, then left-drag between nodes to link them.\
Right-drag moves a selection, and Shift raises the zone layer.

| Action | Input |
|---|---|
| Create node | drag from the palette, or hold a type with `1`-`7` and click |
| Link | left-drag from one node onto another |
| Move | right-drag; hold Shift mid-drag to lock an axis |
| Select | click, Shift-click to add, or drag the empty canvas |
| Edit label | double-click, or `F2` |
| Undo / redo | `Ctrl+Z` / `Ctrl+Shift+Z` |
| Help | `/` |

Press `/` in the editor for the complete list.\
That overlay is the authoritative reference, and this table is only the subset needed to get moving.

The read-only `draw` CLI reports the same document from a terminal:
```sh
draw show
draw get nodes
```

Inside a container, reach it through `docker exec`:
```sh
docker exec <container> draw show
```

---

## Test

The suite is `node:test`, covering the model, server, Slides transform, and CLI:
```sh
npm test
```

`npm run gate` is the full promotion proof: the suite plus six source scanners that hold the architectural boundaries.\
It runs on every push, both as a local pre-push hook and in CI.

---

## Remove

Stop the container and delete the image:
```sh
docker rm -f <container>
docker rmi draw
```

Diagram data lives outside the image, so it survives that.\
Delete it deliberately:
```sh
rm -rf diagrams secrets
```

---

## Diagram storage

Every committed edit auto-saves over the websocket, so there is no save button.\
A commit is a user-action-rate event and goes out immediately, while live drag frames never reach the wire at all.

Diagrams persist as JSON in `diagrams/<id>.json`, each carrying its own change log.\
Coordinates are center-origin: `[0,0]` is the canvas center, and the node grid falls on multiples of 60.

`examples/` is the shipped corpus, tracked in git and copied into the data directory on first boot only.\
Delete one and it stays deleted.\
`diagrams/` is runtime state and is not tracked, because the store rewrites a file on every edit.

Undo survives a process restart.\
A machine-level kill can lose the last 200ms of websocket work, but the document and its log are one file, so a lost write never leaves a log describing a document that does not exist.\
REST writes are stronger on purpose: an agentic caller is one-shot with no reconnect backstop, so a REST `200` means flushed rather than merely accepted.

Undo belongs to the server rather than the tab.\
It reverses whoever's change is on top, so `Ctrl+Z` takes back an agent's write as readily as your own.\
When the top of the log belongs to someone else, the banner offers `Ctrl+Shift+Backspace` to reverse that writer's whole run as one transaction.

Every diagram has a deep link at `/d/<diagram-id>` which opens the editor on it directly.

---

## REST API

Reads are always open:
```sh
curl -s localhost:8080/api/v1/diagrams | jq
curl -s localhost:8080/api/v1/diagrams/<id>/nodes | jq
curl -s localhost:8080/api/v1/diagrams/<id>/links | jq
curl -s localhost:8080/api/v1/diagrams/<id>/zones | jq
curl -s localhost:8080/api/v1/diagrams/<id>/groups | jq
curl -s localhost:8080/api/v1/diagrams/<id>/selection | jq
curl -s localhost:8080/api/v1/diagrams/<id>/history | jq
```

Writes are normally the browser's alone.\
A server-side controller takes exclusive control by acquiring the diagram's lock, and the browser goes read-only while it holds it.\
One side writes at a time: a control handoff, never concurrent editing.

Acquire the lock, then write:
```sh
TOK=$(curl -s -X POST localhost:8080/api/v1/diagrams/<id>/lock | jq -r .token)
curl -s -X POST localhost:8080/api/v1/diagrams/<id>/commit -H "X-Draw-Lock: $TOK" \
     -d '{"ops":[{"op":"put","kind":"node","entity":{}}],"label":"create node"}'
curl -s -X DELETE localhost:8080/api/v1/diagrams/<id>/lock -H "X-Draw-Lock: $TOK"
```

Ops travel as a batch, and a batch is one change: one version bump, one undo step, and no window for another writer to interleave.\
High-level verbs let the server mint ids and names instead:
```sh
curl -s -X POST   localhost:8080/api/v1/diagrams/<id>/nodes      -H "X-Draw-Lock: $TOK" -d '{"type":"server","x":120,"y":-60}'
curl -s -X PATCH  localhost:8080/api/v1/diagrams/<id>/nodes/<id> -H "X-Draw-Lock: $TOK" -d '{"x":240}'
curl -s -X DELETE localhost:8080/api/v1/diagrams/<id>/nodes/<id> -H "X-Draw-Lock: $TOK"
```

`expect` is an optional compare-and-swap on any forward write and travels as the `X-Draw-Expect` header, because a forward write's body is an entity payload where a reserved key would collide with field validation.\
A stale one answers `409` and writes nothing.

Undo and redo are the one pair of verbs whose target is implicit, so `expect` is mandatory on them and rides the body, because there the body is control:
```sh
curl -s -X POST localhost:8080/api/v1/diagrams/<id>/undo -H "X-Draw-Lock: $TOK" -d '{"expect":42}'
curl -s -X POST localhost:8080/api/v1/diagrams/<id>/redo -H "X-Draw-Lock: $TOK" -d '{"expect":42}'
```

An idle lock auto-expires so a crashed controller never strands a diagram.\
Actions act on the outside world rather than the model, so they take no lock:
```sh
curl -s -X POST localhost:8080/api/v1/diagrams/<id>/sync/slides
```

Any diagram also renders to a self-contained SVG by adding `.svg` to its deep link:
```sh
curl -O localhost:8080/d/<diagram-id>.svg
```

The glyph artwork and styles travel inside that file, so it opens anywhere with nothing else to fetch, and each shape carries its entity id so an export traces back to the model.

---

## Google Slides sync

Paste a presentation URL into the header field and press the `slides` button.\
The diagram lands as native, individually editable shapes rather than an image: circles for nodes, connector-bound lines for links, translucent rectangles for zones, and text labels.

Re-pushing replaces exactly the objects `draw` created and leaves anything you added in Slides untouched.\
A `#slide=id.<x>` fragment targets that slide, otherwise the first one is used.

Credentials need a one-time setup, described in [docs/slides-setup.md](docs/slides-setup.md).

---

## Layout

```text
app/         browser editor - kernel-rendered thin UI, vanilla ES modules
model/       sovereign Model - entity store, id helpers, surface constants
kernel/      sovereign geometry - resolve(schema) to scene, routing, locked spec
engine/      sovereign relational substrate - incidence, membership, occupancy
server/      persistence server, REST, validation, and slides/ for the push
cli/         draw.sh - read-only CLI over the REST API
tests/       node:test suites and fixtures
tools/       the gate's source scanners
docs/spec/   the locked product specification
```

---

## License

MIT, see [LICENSE](LICENSE).
