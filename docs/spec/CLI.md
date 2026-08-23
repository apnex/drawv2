# draw -- the tool surface

The verbs an agent drives draw through, and the rule that keeps them complete.

A design of record for a surface that is not built yet.\
It exists because the alternative is accreting flags onto `cli/draw.sh` until the shape is whatever the last change left behind.

---

## Why the tool, and not HTTP

Agentic interaction is through the tool (**GR18**).\
The CLI is the surface an agent is expected to hold, and it is the precursor to registering draw as an MCP tool -- a shape that cannot exist until one program can perform every operation.

The evidence that this needs mandating is behavioural.\
Across the session that built B100 to B117 the agent drove the live estate entirely with `curl`, never once reached for the tool written for it, and could not have: the CLI had no authentication and spoke only the IAP-fronted `/api/v1` (**B117**).

A tool nobody can use is indistinguishable from one that does not exist.

There is no fallback, ruled 2026-08-23.\
An agent that cannot do a thing through `draw` extends `draw`, or halts and raises it; reaching for `curl` is not the third option.\
Every time that option is taken the tool stays exactly as incapable as it was, and the gap stops being visible -- which is how B117 accumulated, because the work kept getting done and so nothing ever reported the tool could not do it.

---

## One manifest, four consumers

Every verb is declared once, as data: its name, its group, its summary, its arguments, its flags, and the route it reaches.

That declaration drives four things which have no other source:
```text
dispatch    what running the verb does
help        `draw help`, `draw help <verb>`, `draw <verb> --help`
coverage    tools/scan-cli.mjs -- every REST route has a verb, or a recorded exemption
docs        the command table in cli/README.md
```

Four hand-maintained copies is how a CLI drifts from its server.\
The manifest is the reason a new endpoint fails the gate rather than being quietly unreachable, which is exactly what happened to every verb H9 added.

---

## Shape

Two levels, and only where a noun earns it.

A noun with several operations takes a sub-verb, because `draw code mint` and `draw code revoke` belong together and `draw mint-code` does not group with anything.\
A single operation stays flat, because `draw commit node add` would be ceremony.

```text
draw <verb> [args] [flags]
draw <noun> <verb> [args] [flags]
```

Flags are uniform across every verb, so none has to be learned twice:
```text
--diagram <id|name>   target, defaulting to the context
--json                machine output; the default is a human table
--host <url>          server, defaulting to DRAW_HOST
--code <code>         connection code, defaulting to DRAW_CODE
--help                this verb's arguments, flags and an example
```

`--json` is not decoration.\
An agent parses output, so every verb answers JSON on request, and a verb that cannot is a verb an agent cannot compose with.

---

## The door is chosen, not configured

A code present means `/connect/v1`, absent means `/api/v1`.

The operator never selects a prefix.\
Which door a request uses follows from whether it carries a credential, and that is the same rule the server states: the prefix is a door and never a privilege.

---

## The verbs

Grouped by the question each answers, which is also how `draw help` will print them.

```text
Context
  diagrams                      what exists
  context [id]                  the default target, persisted
  status                        the active diagram in summary
  show                          status plus every entity table
  get <kind> [id|name]          interrogate nodes, links, zones, groups, waypoints
  history [--limit n]           the change log
  health                        the server's own report

Lifecycle
  create [name] [--doc f.json]  mint a diagram; answers its id
  delete <id>                   remove one; refuses 423 unless you hold the lock
  render [--out f.svg]          the picture, as an SVG file

Writing
  lock / unlock                 take and release the write slot
  lock status                   who holds it, when it frees, and the human hold
  commit [--ops f.json|-]       a batch of ops as one transaction
  node add|move|set|rm          the high-level verbs, server-minted ids
  link add|rm
  zone add|rm
  group add|rm
  undo [--to seq] / redo        with the expected version, never implicit
  select <ids...>               the authoritative selection

Placement
  layouts                       the named grids
  anchor nearest <x> <y>        somewhere legal near here
  anchor free                   every anchor nothing occupies

Access
  grant <principal> <level>     on the active diagram
  revoke <principal>
  workspace grant|revoke        across everything you own
  code mint <agent> / list / revoke <id>

Awareness
  agents                        what every agent is doing
  viewers                       who is looking at what

Projection
  push                          project to the bound Slides deck
```

---

## The tool exists to reduce agent error, not to mirror the API

Ruled 2026-08-23.\
Parity with the REST surface is the floor, not the purpose.\
A verb earns its place by making an agent faster, more correct, or less likely to be wrong -- and a verb that is a thin wrapper over one route adds a name without adding any of those.

The highest-value gap is CONTEXT.\
An agent asking about a node wants what is attached to it, what contains it, what it connects to and where it may legally sit; today it fetches the whole document and derives all of that itself, which is arithmetic it can get wrong and repeats on every call.

The logic for it already exists and is sovereign.\
`model/model.mjs` carries `linksOf`, `linksAt`, `linkBetween`, `groupOf` and `pathOf`, so a contextual route composes methods the model already owns rather than restating relationships in a second place -- the engine's indexed versions are a browser-side optimisation over the same semantics, not a rival definition.

The shape this points at:

```text
node <id> context     position and anchor, links in and out, group, containing zone, free neighbours
zone <id> contents    what falls inside its bounds
link <id> path        the resolved route, bends included -- what the renderer would draw
near <x> <y>          what is around a point, which is how an agent places without colliding
```

Each needs a route that does not exist yet, and each composes existing model methods behind it.\
That is the test for a contextual verb: it assembles what the model already knows, and it never computes a relationship the model could have been asked for.

## Help is a first-class output

`draw help` prints the groups above.\
`draw help <verb>` and `draw <verb> --help` print that verb's arguments, its flags, one worked example, and the route it reaches.

Naming the route in help is deliberate.\
An agent that hits a server behaviour the tool does not explain can read which endpoint answered and go to `API.md`, instead of guessing whether the tool or the server refused it.

Every verb in the manifest must carry a summary and an example, and the absence of either is a gate failure rather than a rough edge.

---

## What this does not decide

Whether the CLI keeps a human audience at all.\
The verb list above is shaped for an agent, and `show` and the coloured tables are shaped for a person; they have not conflicted yet and may.

The MCP registration itself, which is the point of the exercise and needs the surface finished before it can be specified.

Whether `commit` should accept anything other than a file or stdin.\
An ops batch is the one input that resists flags, and inventing a flag grammar for it would be a second way to say what JSON already says.
