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

The whole product ships as one image: editor, websocket, REST API, and the `draw` CLI.
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

The suite is `node:test`, covering the model, the server, and the CLI:
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

An agent drives the same model the editor does, over HTTP.\
Reads are open, writes take a server lock, and access is by grant.

See [docs/spec/API.md](docs/spec/API.md) for the routes, the lock protocol and the grant surface.

## Layout

```text
app/         browser editor - kernel-rendered thin UI, vanilla ES modules
model/       sovereign Model - entity store, id helpers, surface constants
kernel/      sovereign geometry - resolve(schema) to scene, routing, locked spec
engine/      sovereign relational substrate - incidence, membership, occupancy
server/      persistence server, REST, and validation
cli/         draw.mjs - the agent's verb surface, and the manifest that declares it
tests/       node:test suites and fixtures
tools/       the gate's source scanners
docs/spec/   the locked product specification
```

---

## License

MIT, see [LICENSE](LICENSE).
