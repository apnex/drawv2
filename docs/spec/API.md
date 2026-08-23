# draw -- REST API

The HTTP surface an agent drives.\
Split out of the README at H9.27 because it answers a different reader: the README is for an operator installing and running `draw`, and this is for whoever is writing something that drives it.\
It was also the largest section by some way, and the one that grows every time the surface does.

The websocket protocol is specified separately in [SCOPE.md](SCOPE.md#wire-protocol-one-websocket--as-shipped), and the authorization model these routes enforce is in [ACCESS.md](ACCESS.md).\
Two nouns appear throughout and are defined in [SCOPE.md](SCOPE.md#vocabulary): a **Model** is the live object, a **doc** is the flat JSON these routes carry.

---

Creating takes no lock, because there is no diagram yet to lock.\
The caller owns what it creates, and ownership comes from the authenticated identity rather than from the body -- an owner presented on the wire is refused, so it cannot be forged:
```sh
curl -s -X POST localhost:8080/api/v1/diagrams -d '{"name":"topology"}'
curl -s -X POST localhost:8080/api/v1/diagrams -d '{"doc":{"meta":{"name":"from a file"},"nodes":[]}}'
```

The response is `201` carrying the minted id and the whole document, so an agent does not need a second call to discover what it just made.\
An id in the body is ignored: the server mints it, which is what stops offline work from landing on top of whichever diagram the server last answered with.

There is no `DELETE /api/v1/diagrams/<id>`, and its absence is a decision rather than an omission.\
Creating and destroying are not symmetric, and a destructive verb keeps its gates until someone rules otherwise.

`MAX_DIAGRAMS` bounds the store, defaulting to 500, and a create past it answers `507`.\
It is a runaway guard rather than a quota -- invisible to real use, and present for the retry loop that thinks its last call failed.

## What an id looks like

Every entity id is its kind, a hyphen, and exactly six lowercase hex digits.

```text
node-0003fc      waypoint-aa0001      link-b09674
zone-285c5e      group-8582bf         diagram-7bc886
```

The server enforces `^(node|waypoint|link|zone|group|diagram)-[0-9a-f]{6}$` and refuses anything else, including uppercase hex, five digits or seven, and a kind outside that list.\
A refusal here is a `422` naming the op that carried the bad id.

An agent supplying its own ids must match the grammar, and the six digits are the only free part.\
Nothing checks that ids are random, so a batch may use `node-000001` upward, but two entities of the same kind cannot share one.

Ids for a whole diagram are minted by the server, never accepted from a caller.\
`POST /api/v1/diagrams` ignores an id in the body and answers `201` with the one it chose, which is what stops offline work from landing on top of whichever diagram the server last answered with.

Selection is narrower than the id grammar.\
Only `node`, `waypoint`, `link` and `zone` are selectable; a `group` or `diagram` id in a selection is refused rather than ignored, because tolerating it would hide a caller bug behind a silent prune.

## Two doors, one surface

An agent reaches the same API at `/connect/v1/...` that the editor reaches at `/api/v1/...`, and the prefix is the only difference.\
The routes, bodies and refusals are identical, because the prefix is rewritten at the router and everything below it is one implementation.

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
