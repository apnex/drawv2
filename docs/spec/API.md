# draw -- the interface surface

Every way something outside the engine reaches it: the vocabulary, the entities, the websocket protocol and the HTTP surface.

> **Widened 2026-09-03.**\
> This file was `REST API` and pointed at `SCOPE.md` for the wire protocol, the vocabulary and the entity model.\
> Those lived in a scope document because nothing else held them, and a reader following the cross-reference landed in a file whose premise was superseded.\
> They are here now, beside the REST surface they are cited next to, and the anchors that pointed away resolve within this document.

---

The HTTP surface an agent drives.\
Split out of the README at H9.27 because it answers a different reader: the README is for an operator installing and running `draw`, and this is for whoever is writing something that drives it.\
It was also the largest section by some way, and the one that grows every time the surface does.

The websocket protocol is specified below, and the authorization model these routes enforce is in [ACCESS.md](ACCESS.md).\
Two nouns appear throughout and are defined below under Vocabulary: a **Model** is the live object, a **doc** is the flat JSON these routes carry.

---

Creating takes no lock, because there is no diagram yet to lock.\
Ownership comes from the authenticated identity rather than from the body -- an owner presented on the wire is refused, so it cannot be forged:
```sh
curl -s -X POST localhost:8080/api/v1/diagrams -d '{"name":"topology"}'
curl -s -X POST localhost:8080/api/v1/diagrams -d '{"doc":{"meta":{"name":"from a file"},"nodes":[]}}'
```

An agent's work belongs to whoever authorised the agent (ruled 2026-08-23, **B100**).\
A diagram created by `agent:planner` is owned by the principal that claimed that agent name, and the agent is left an ordinary `write` grant on it.\
This document previously said the caller owns what it creates, which was true of a human and produced work nobody could reach when an agent did it: owned by `agent:<name>` with no grants, invisible to the person who authorised the agent, on their own deployment.

The agent is not a party here, it is a credential held on behalf of a claimant.\
Ownership rather than a grant to the human, because a grant would have left the agent owning the diagram and therefore holding its access list -- the human could not have granted anyone else, and could not have revoked the agent from work done on their behalf.

The response is `201` carrying the minted id and the whole document, so an agent does not need a second call to discover what it just made.\
An id in the body is ignored: the server mints it, which is what stops offline work from landing on top of whichever diagram the server last answered with.

`DELETE /api/v1/diagrams/<id>` removes one, and needs write access rather than ownership -- whoever may empty a diagram may remove it.\
It answers `423` while another controller holds the lock, unless you are that controller, and anyone watching the diagram is moved onto a surviving one.\
The store never goes empty: removing the last diagram reseeds the examples.

A removed diagram is recoverable while the backend's delete window lasts, and two routes reach it.

`GET /api/v1/sessions` answers `{ sessions[] }` -- what each client DID, not what the document became.\
Each entry carries the actor, principal, diagram, whether it is still live, its counts of commits and refusals, and a bounded narrative of recent events.\
The report is whole and unfiltered -- bounded at 40 sessions by construction -- and `draw sessions --hot n` selects a runaway client from it.\
Held in memory and bounded on both axes, so it is a troubleshooting instrument rather than state anything may depend on.\
It exists because an agent asked the director to read a browser console during an incident, which is the anti-pattern **A5** names in its own rationale (**B182**).

`GET /api/v1/diagrams/deleted` answers `{ window, deleted[] }`.\
`window` is a boolean and it is not the same question as whether the list is empty: `false` means this deployment has no recycle bin at all, which is the honest answer on a filesystem, while `true` with an empty list means the window exists and nothing is in it.\
Collapsing the two would tell a caller their work is gone when nobody has looked.\
Each entry carries `id`, `name`, `owner`, `deletedAt` and `purgeAt` -- the last being the one that decides whether to act now.\
The list is filtered by ownership, read from the deleted document itself, because a removed diagram took its grants with it and there is nothing left for `canRead` to consult.

`POST /api/v1/diagrams/deleted/<id>/restore` brings one back and loads it, answering `{ restored, name }`.\
It takes no lock: the write slot governs edits to a live document and there is none to hold it against.\
An id the caller cannot see and an id that never existed give the same `404`, which is the correct answer to both.\
A deployment with no window answers `501`.

Where the bucket sets one, the retention is a soft-delete window in seconds -- 604800 is a week.

`MAX_DIAGRAMS` bounds the store, defaulting to 500, and a create past it answers `507`.\
It is a runaway guard rather than a quota -- invisible to real use, and present for the retry loop that thinks its last call failed.

## Vocabulary

Two nouns, one spelling each, and confusing them is the most common question this repository produces.\
A **Model** is the live object: indices, selection, mutation methods, the thing an editor or the server holds in memory.\
A **doc** is the flat JSON that comes off disk and travels the wire, produced by `model.toJSON()` and consumed by `Model.load()`.

`validateDoc` is named for the second and is not a leftover from the `document/` to `model/` rename.\
Validation exists only at the serialization boundary -- a file read at boot, or a `create {doc}` arriving from a client -- so a `validateModel` would name something that never happens.\
The substrate directory was renamed because `document` covered three concepts at once: the substrate, the browser global, and a persisted diagram.\
`doc` was kept because it covers exactly one.

---

## Entities (five)

```json
{
  "meta":   { "id": "diagram-x", "name": "demo", "version": 12, "schema": 1,
              "owner": "user:someone@example.com",
              "grants": { "user:other@example.com": "read", "agent:planner": "write" },
              },
  "nodes":  [ { "id": "node-a1b2c3", "name": "web-1", "type": "host", "shape": "circle", "x": 510, "y": 270 } ],
  "waypoints": [ { "id": "waypoint-5e5e5e", "x": 570, "y": 270,
                "spawn": { "interval": 900, "speed": 1.4, "kind": "packet", "since": 1788300000000 } } ],
  "links":  [ { "id": "link-9f00aa", "src": "node-a1b2c3", "dst": "node-d4e5f6",
                "via": ["waypoint-5e5e5e"], "closed": false } ],
  "zones":  [ { "id": "zone-77bb01", "name": "dmz", "x": 480, "y": 240, "w": 240, "h": 180 } ],
  "groups": [ { "id": "group-3c3c3c", "name": "web-tier", "members": ["node-a1b2c3"] } ]
}
```

`owner` and `grants` are AUTHORIZATION and are server-recorded status, not document content.\
They are written by the store rather than by a commit, so they carry no undo record -- a grant that undo could reverse would restore access to a principal just revoked.\
A principal is `user:<email>` or `agent:<name>`, namespaced so an agent can never be mistaken for a person, and a level is `read` or `write`.\
An agent name is lowercase, starts alphanumeric, allows hyphens, and is bounded at 63 -- the DNS label shape, chosen because case-variant identities are a confusion attack rather than a convenience.\
Neither key is writable through a meta patch, and neither survives arriving on a document from the wire.\
Designed in `docs/spec/ACCESS.md`.\
Corrected 2026-08-21 (B89): this read *enforcement is H9.3 and not yet built*, which stopped being true at H9.3a.\
Writes are gated at all seven mutating store methods, reads at `hello`, `open`, the REST document and log, and `/d/<id>.svg` (B67), and lock acquisition and reclaim at H9.4.\
A connection code is a CREDENTIAL that authenticates as an agent identity, and is deliberately NOT a principal (H9.4b): conflating them meant revoking a code destroyed an owner, rotating one lost every grant, and a code could not be reused across diagrams because the code was the grant.\
Still pending from the same amendment and not yet built: a grant may name an OWNER as well as a diagram, so an agent granted on a person reaches everything that person owns.

- node: a `shape` frame (the outer shell - `circle` | `square`) with a `type` glyph
  attached in its middle, snapped to a grid point, with editable label. Frame and glyph
  are independent layers (`#frame-*` raw-canvas shapes + `#glyph-*` 0.3-scaled art);
  `shape` is optional and defaults to `circle` (legacy docs load unchanged).
- link: a route between two endpoints, each a node or a waypoint. Bends through any `via`
  waypoints and is drawn with rounded corners (`BEND_R` on the grid pitch); `closed` makes it
  a ring with no ends. `src`/`dst`/`closed` is the one vocabulary, kernel and model alike (B166).
- waypoint: a grid point a link may terminate at or bend through. An ENDPOINT waypoint may carry
  a `spawn` composite, which makes it emit movers along its link in read view -- whole or absent,
  never partial. The numbers a mover obeys are declared in `engine/kinds.mjs`, never stored here.
- zone: grid-aligned rectangle on the half-offset grid, with label. Purely visual.
- group: logical member set; selecting/moving any member moves all. Not rendered, not synced
  as a shape.

---

## Wire protocol (one websocket) - as shipped

Client -> server:
- `{cmd:"hello", body:{diagram?}}` -> `{cmd:"snapshot", body:{doc, diagrams, locked, version, canUndo, canRedo}}`
- `{cmd:"commit", body:{ops, label?, expect?, txnId?}}` -> `{cmd:"ack", body:{seq, from, version,
  durableVersion, canUndo, canRedo, ops, acked}}`. One request is one TRANSACTION: a whole
  gesture, not one entity. `expect` is an optional compare-and-swap precondition.
- `{cmd:"undo"|"redo", body:{expect, txnId?}}` -> ack carrying the ops to apply
- `{cmd:"resume", body:{diagram, version}}` - reconnect. The client states what it BELIEVES it
  holds; the server answers `{cmd:"sync", body:{version, canUndo, canRedo, locked}}` if they are
  in step, a snapshot if the client is behind, or a snapshot carrying `rewound:{from,to}` if the
  client is ahead. **The client never sends a document to overwrite one.**
- `{cmd:"create", body:{name?, doc?}}` - `doc` is the only whole-document path a client has, and
  it can only CREATE: the server mints the id and ignores `doc.meta.id`
- `{cmd:"select", body:{ids}}` -> `ack`, and the server broadcasts `{cmd:"selection", body:{ids, actor}}`
  to the other sessions on that diagram. Selection is model-state, not a change: no version bump, not
  undoable - but it IS a first-class event, because it is what lets a human watch an agent work.
- diagram management: `open {id}`, `reclaim {id?}`,
  `delete {id}` (answers with a snapshot of a surviving diagram; the store
  reseeds the example rather than ever going empty), `list {}`.
  Renaming a diagram and binding a deck are CHANGES, so they travel as a `meta` op inside a
  `commit` - undoable and broadcast like any other.
- failures answer `{cmd:"error", body:{message, code, txnId}}`; sessions survive any payload

Server -> client, unprompted: `{cmd:"change", body:{..., ops}}` - every accepted transaction is broadcast to the other sessions on that diagram, so a second tab and an agent write converge without refetching.\
`{cmd:"lock", body:{owner}}` on a Server-Locked handoff.

Server: validates (janitor-lite: field whitelists, ranges, referential integrity, collection caps), commits through ONE write path, debounce-writes JSON to `diagrams/<id>.json` (200ms pulse, atomic tmp+rename).\
Deletes cascade server-side too, so a persisted document always reloads.\
On FIRST connect the client hydrates (hello -> snapshot); on RE-connect it sends `resume` and the server decides.\
Content drawn before first hydration becomes a NEW diagram via `create {doc}` - it is never pushed over the diagram the server happened to answer with.\
A commit goes out immediately (it is a user-action-rate event); what coalesces is a burst of same-shape edits, into ONE undoable change.\
Live drag frames never reach the wire at all.

*(Amended 2026-08-18, CS1-CS5 - see `docs/spec/COMMIT.md`)* - **the server owns the document.**\
The section above HAS BEEN REWRITTEN, not merely annotated: a wire reference is what a reader copies from, so a superseded-but-still-printed line gets sent.\
This amendment is late - **CS1 and CS3 each owed one and did not pay it**, so those lines were false for three milestones rather than the one GR10 allows, and nothing mechanized the check (now `tests/spec.test.js`).\
What changed:

- **`apply {action, kind, entity}` -> `commit {ops, label?, expect?, txnId?}`** (CS1). One
  request carries a whole transaction, not one entity. The reply is
  `ack {seq, from, version, durableVersion, canUndo, canRedo, ops, acked}`, not
  `{rev}`, and errors are typed: `error {message, code, txnId}`.
- **`push {doc}` was deleted** (CS4). A client never sends a document to overwrite one.
  On RE-connect it sends `resume {diagram, version}` - a *belief* - and the server
  answers `sync {version, canUndo, canRedo, locked}` if they are in step, a snapshot if
  the client is behind, or a snapshot carrying `rewound {from, to}` if the client is
  **ahead** (a server that restarted before flushing changes it had acked). Content
  drawn before first hydration is no longer pushed over whichever diagram the server
  named - it becomes a **new** diagram via `create {name, doc}`, whose id the server
  mints and whose `doc.meta.id` is ignored.
- **The 200ms client pulse was removed** (CS3). A commit is a user-action-rate event and
  goes out immediately; what batches now is a *burst of same-shape edits* (arrow-key
  nudges), coalesced into ONE change client-side. Live drag frames never reach the wire
  at all - the sync layer subscribes to the commit boundary, not to the model.
- **The server does push model changes** (CS1/CS3): every accepted transaction is
  broadcast to the other sessions on that diagram as `change {..., ops}`, so a second tab
  and an agent write converge without refetching. **Undo and redo are server
  capabilities** (`undo`/`redo {expect, txnId?}`), reversing any writer's change, not
  only the browser's own.

- **`meta.rev` -> `meta.version`, and `meta.grid` is gone** (CS5). `rev` counted render
  emissions - one drag advanced it ~60 times - and described no transaction. `version`
  is minted once per accepted transaction and is what `expect` compares. `meta.schema`
  takes over the generation-discriminator role `grid` was accidentally serving. The 17
  live files were migrated by `tools/migrate-version.mjs`; the pre-CS5 binary cannot
  read the result.

*(Amended 2026-08-19, H4)* - three agent-facing surfaces corrected, none visible to the browser:

- **`POST /api/v1/diagrams/:id/commit` takes `{ops, label?}`** - the transaction vocabulary it was
  always documented as taking and never did. It accepted a single legacy `{action, kind, entity}`
  mutation, so the websocket's own shape answered 422 and **multi-op transactions were unreachable
  over REST**: an agent had to issue N round trips, each a window another writer could interleave.
  The legacy shape is **gone, not aliased** (X1 - an alias is a second surface to keep true).
- **`expect` on forward writes rides the `X-Draw-Expect` header** and now actually reaches the
  transaction; it was silently discarded, so an agent believing it held a compare-and-swap held
  nothing. Mandatory `expect` on undo/redo keeps the body form, and is now enforced on the
  **websocket** as well - it had been waived for redo entirely and for undo by the record's own
  author, contrary to D14 (**B39**).
- **Selection broadcasts as `selection {ids, actor}`** on both transports. REST shipped a whole
  document snapshot for a focus change; the websocket broadcast nothing at all, so two viewers never
  shared a selection. Neither was right.

Unchanged and still binding: one websocket per client, `{cmd, body}` both ways, the server validates everything, sessions survive any payload, and the store reseeds rather than ever going empty.

---

## What an id looks like

Every entity id is its kind, a hyphen, and exactly six lowercase hex digits.

```text
node-0003fc      waypoint-aa0001      link-b09674
zone-285c5e      group-8582bf         diagram-7bc886
template-c8d87c
```

The server enforces `^(node|waypoint|link|zone|group|diagram|template)-[0-9a-f]{6}$` and refuses anything else, including uppercase hex, five digits or seven, and a kind outside that list.\
A refusal here is a `422` naming the op that carried the bad id.

*(Amended 2026-08-27, H9.9)* -- `template` joins the grammar as a second DOCUMENT-level kind beside `diagram`.\
A template is read from the image, never written to the store, and forks into a `diagram-` id on first write.\
The kind lives in the identifier so that any path which does not handle one is refused here, rather than treating it as an ordinary diagram.

An agent supplying its own ids must match the grammar, and the six digits are the only free part.\
Nothing checks that ids are random, so a batch may use `node-000001` upward, but two entities of the same kind cannot share one.

Ids for a whole diagram are minted by the server, never accepted from a caller.\
`POST /api/v1/diagrams` ignores an id in the body and answers `201` with the one it chose, which is what stops offline work from landing on top of whichever diagram the server last answered with.

Selection is narrower than the id grammar.\
Only `node`, `waypoint`, `link` and `zone` are selectable; a `group` or `diagram` id in a selection is refused rather than ignored, because tolerating it would hide a caller bug behind a silent prune.

## Geometry is a rule, not a courtesy

Positions are refused unless they sit on the grid, and the pitch is 60.

```text
node, waypoint    x and y are multiples of 60
zone              x and y are 30 + 60k; w and h are multiples of 60
```

A zone uses the half-offset because it BOUNDS cells rather than sitting on one, so its edges fall between them.\
That is the rule most easily got wrong, and the server now refuses rather than letting it through.

An off-grid coordinate answers `422` naming the field, and the batch writes nothing.\
It is not snapped for you: snapping would silently move your work and leave you believing you drew something you did not.

### Ask for an anchor instead of computing one

An anchor is a grid position, and it is on-grid by construction:
```sh
curl -s localhost:8080/api/v1/diagrams/<id>/layouts
curl -s "localhost:8080/api/v1/diagrams/<id>/layouts/node/nearest?x=270&y=-150"
curl -s "localhost:8080/api/v1/diagrams/<id>/layouts/node/anchors?free=1"
```

`nearest` answers *somewhere legal near here* and returns `{layout, cx, cy, x, y, occupant}`.\
The pixels are there so you never multiply and the cell is there so you never divide, which are the two steps that produce an off-grid entity.

`anchors?free=1` answers *where may I put something*, and omits every anchor a node or waypoint already holds.\
A waypoint counts, because a waypoint is a node for placement.

Reads, so neither takes the lock.\
The layout name travels with an anchor because the same cell resolves to different pixels on the two grids.

### Context: what surrounds a thing

These exist so a caller does not fetch a whole document and derive relationships itself, which is arithmetic it can get wrong and would repeat on every call:
```sh
curl -s localhost:8080/api/v1/diagrams/<id>/context/<entity-id>
curl -s "localhost:8080/api/v1/diagrams/<id>/near?x=120&y=60&within=120"
curl -s localhost:8080/api/v1/diagrams/<id>/zones/<zone-id>/contents
curl -s localhost:8080/api/v1/diagrams/<id>/links/<link-id>/path
```

`context` takes any entity id and works out its kind for you.\
For a node or waypoint it answers where it sits, the links touching it, its neighbours, its group, and the zones enclosing it; for a link, its endpoints, bends and resolved path; for a zone, its bounds and everything inside; for a group, its members and the links they carry.

`near` answers what is already around a point, which is the counterpart to a free anchor.\
One says where placement is legal and the other says what is close enough to matter, and an agent that only asks the first can still draw on top of something meaningful.

`path` resolves a route into coordinates -- the identities of `src`, `via` and `dst` become the line the renderer would draw.\
It is the only way to ask whether a link visually crosses something.

All four are composed from methods the model already owns, so they cannot disagree with the document they describe.

### What every agent is doing

One read, covering the whole workspace rather than one diagram:
```sh
curl -s localhost:8080/api/v1/workspace/agents
```

It answers `{agents: [{principal, diagram, since, expiresAt}]}`, derived from the live locks so it cannot disagree with them.\
An agent that died holding a lock stops being reported when the lock lapses, without anything having to notice it died.

`principal` is `null` with authorization off, which is honest rather than empty: something is driving that diagram and there is no identity to name.\
The list is filtered by read access, so it shows the diagrams the caller could open anyway.

Its mirror answers who is WATCHING what, which is how an agent avoids taking the wheel out from under someone:
```sh
curl -s localhost:8080/api/v1/workspace/viewers
```

A person cannot decline to be observed, and that is deliberate.\
The control surface is the grant and the connection code: declining to mint one is how you decline to be watched, and an agent you have already authorised can see where you are working.

Both lists are filtered by read access, on the push as well as the pull.\
A caller learns about a diagram it could open anyway, and nothing about one it could not -- the document staying private and its existence leaking are different failures, and only the first was ever guarded.

The same lists ride the websocket, in every `snapshot` and in an `agents` or `viewers` message whenever they change.\
It is state rather than an event, so a client that connects after a lock was taken still sees it.

### How much fits

A diagram holds at most one node or waypoint per anchor, so the canvas caps at 527 of them together.\
The per-collection limit is the anchor count for a positioned kind and 2000 for a kind with no coordinates, so the number the code names is the number that binds.

A node reaches to 900 by 480 and a zone half a cell further, to 930 by 510.\
These are what the editor has always clamped to; the server now refuses the same set rather than a wider one.

### Where the rule lives

This is enforced at the server rather than in the editor, which is where it used to live.\
The cost of it living in the browser was that an agent could place entities anywhere, and the engine's occupancy index assumes the opposite -- `cellOf` is `Math.round(v / 60)`, so two entities 30px apart occupy one cell while looking distinct.

## Is the server well

```sh
curl -s localhost:8080/health
```

It answers `{status, diagrams, flushFailures, invariantFailures}` and takes no credential, because a health check that needs to authenticate cannot report the failure of authentication.\
`status` is `ok`, `degraded` when a flush has failed, or `corrupt` when a document failed its invariants -- the three are distinct because they need different responses.

This route went undocumented from the day it was written until 2026-08-23, when the coverage check was widened to see the shape it is written in (**B118**).

## Two doors, one surface

An agent reaches the same API at `/connect/v1/...` that the editor reaches at `/api/v1/...`, and the prefix is the only difference.\
The routes, bodies and refusals are identical, because the prefix is stripped at ingress and everything below it is one implementation.

`/connect` is a door onto the surface rather than onto the API alone.\
It opens on exactly two paths, and widening it is a deliberate act rather than a consequence of adding a route:
```text
/connect/v1/...      ->  /api/v1/...      the REST surface
/connect/d/<id>.svg  ->  /d/<id>.svg      the rendered picture
```

The picture is the same route the editor links to, so an agent can fetch a render of what it just drew:
```sh
curl -s -H "Authorization: Bearer XXXX-XXXX-XXXX-XXXX" -O https://draw.apnex.io/connect/d/<id>.svg
```

It is grant-gated like everything else, because an SVG carries the whole document's content and a representation is not a permission.

The two exist because of where authentication sits, not because the surfaces differ.\
IAP is configured per backend service and has no path exclusion, so a path an agent can reach without a Google sign-in must be routed to a different backend -- which the load balancer already does for `/about`, `/privacy` and `/terms`.

An agent authenticates with a connection code as a bearer token, and never a query parameter:
```sh
curl -s -H "Authorization: Bearer XXXX-XXXX-XXXX-XXXX" https://draw.apnex.io/connect/v1/diagrams
```

The prefix authorizes nothing.\
Authentication resolves a principal before the router runs and authorization happens after it, on that principal alone, so a request with no valid code is refused exactly as one that slipped past IAP would be -- an empty list, and `403` on everything else.

---

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

Reads never take the lock, so `GET .../lock` answers even while somebody else holds it.\
That is the call for an agent that has lost its token, or that wants to know whether writing is worth attempting:
```sh
curl -s localhost:8080/api/v1/diagrams/<id>/lock
```

It reports two independent waits, and they are not the same question.\
`expiresAt` is when the current holder's lock lapses on its own, and is `null` when nothing holds it.\
`heldUntil` is the post-reclaim human hold, which is why an agent may not take the lock even when no one has it, and is `null` when no reclaim has happened.

A rejected commit answers `422` carrying `opIndex`, the position in the batch that failed.\
`-1` means the request was refused as a whole rather than at one op, and the batch writes nothing either way.

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

Access is administration rather than a model write, so it takes no lock either -- an owner must be able to revoke while somebody else is mid-drag, which is exactly when revoking is urgent.\
Only the owner may grant or revoke, a level is `read` or `write`, and a principal is `user:<email>` or `agent:<name>`:
```sh
curl -s -X POST   localhost:8080/api/v1/diagrams/<id>/grants -d '{"principal":"agent:planner","level":"write"}'
curl -s -X DELETE localhost:8080/api/v1/diagrams/<id>/grants/agent%3Aplanner
```

A **connection code** is the credential an agent authenticates with, and it is not a principal -- it authenticates AS an `agent:<name>`, so rotating or revoking one leaves everything that agent owns untouched.\
Codes hang off the workspace rather than a diagram, because an agent identity is not a property of any one document:
```sh
curl -s        localhost:8080/api/v1/workspace/codes
curl -s -X POST   localhost:8080/api/v1/workspace/codes -d '{"agent":"agent:planner"}'
curl -s -X DELETE localhost:8080/api/v1/workspace/codes/<id>
```

The `201` from a mint carries the plaintext, and that is the only time it exists outside your hands -- it is hashed at rest, absent from the listing, and absent from the logs.\
There is no way to recover it, so a lost code is replaced rather than retrieved.

The first mint against an agent name CLAIMS it for the minting principal, and only that principal may mint against it afterwards.\
Without that rule an agent name is global, and a second person minting against `agent:planner` would obtain a credential authenticating as the identity the first granted access to.\
Revoking every code leaves the claim standing, because releasing the name on revocation would let somebody acquire it by waiting.

Rotation is mint-then-revoke, in that order, so there is never a window with no valid code.

There is no `GET /api/v1/diagrams/<id>/grants`, deliberately: `GET /api/v1/diagrams/<id>` already carries `meta.owner` and `meta.grants`, so anyone entitled to read the diagram already has the grant list and a second route would be two spellings of one fact.

A grant may also name an OWNER rather than a diagram.\
A **workspace** is the set of diagrams owned by a principal, including ones not created yet, which is the point -- otherwise a person is in the loop for every diagram an agent makes:
```sh
curl -s        localhost:8080/api/v1/workspace/grants
curl -s -X POST   localhost:8080/api/v1/workspace/grants -d '{"principal":"agent:planner","level":"write"}'
curl -s -X DELETE localhost:8080/api/v1/workspace/grants/agent%3Aplanner
```

No owner appears in that path: you administer your own workspace and no other, so granting on someone else's is unrepresentable rather than merely refused.\
This family does have a `GET`, unlike the diagram one, because a workspace grant lives in no diagram and there would otherwise be no way to read it.

A grant naming a diagram wins over a grant naming its owner, so a workspace grant can be narrowed on one diagram.\
The consequence is worth stating plainly: revoking a diagram grant from someone who also holds a workspace grant does not remove their access, it returns them to the workspace level, and the revoke response carries an `effective` field saying what remains.\
A leaked workspace credential costs everything that owner holds, which is the price of not having a person in the loop.

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
