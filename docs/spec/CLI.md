# draw -- the tool surface

The verbs an agent drives draw through, and the rule that keeps them complete.

A design of record, written before the surface existed and kept current as it was built.\
It exists because the alternative was accreting flags onto a shell script until the shape was whatever the last change left behind -- which is what the retired `draw.sh` had become, and what B117 ended.

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

Grouped by the question each answers, which is also how `draw help` prints them.\
**This block is DERIVED from `cli/verbs.mjs` and checked against it** -- it drifted for two milestones otherwise, listing a `push` verb for a feature that had been purged and an `agents` verb that was named `who`, while omitting nine that existed.

```text
Context
  health                                                                          the server's own report
  diagrams [--counts]                                                             what exists
  context [id|name]                                                               the default target, persisted
  status                                                                          the active diagram in summary
  get <kind> [id|name]                                                            interrogate nodes, links, zones, groups, waypoints
  history [--limit n]                                                             the change log
  about <entity-id>                                                               what surrounds an entity: links, neighbours, group, enclosing zones
  zone contents <zone>                                                            what falls inside a zone
  link path <link>                                                                the resolved route -- what the renderer would draw
  movers [--at epoch-ms] [--spawner ref]                                          what is in flight right now -- the movers a correct client must be drawing
  show                                                                            the whole diagram: summary and every entity
  map [--full] [--zone <ref>] [--around <ref>] [--radius n] [--layout node|zone]  look at the canvas -- occupancy as a grid, so placement is seen rather than derived
  focus [ref]                                                                     the entity the relation verbs read from, persisted; omit to see it
  links [ref]                                                                     what connects to a thing -- the other end named, routed marked
  holds [ref]                                                                     what contains a thing -- its zones and its group, upward
  peers [ref]                                                                     what sits one hop away -- neighbours, and the rest of its group
  parity                                                                          do the model, the render and the map agree -- A5, measured rather than assumed

Lifecycle
  create [name]            mint a diagram; answers its id
  delete <id|name>         remove one; refuses unless you hold the lock
  render [--out file.svg]  the picture, as SVG
  deleted                  what is still recoverable, and how long is left
  restore <id>             bring one back out of the delete window

Writing
  lock                                                            take the write slot, and remember the token
  unlock                                                          release the write slot
  lock status                                                     who holds it, when it frees, and the human hold
  commit --ops <file|->                                           a batch of ops as one transaction
  undo [--to seq]                                                 reverse the last change, or a run
  redo                                                            reapply what undo reversed
  select <id...>                                                  set the authoritative selection
  link <src> [<dst>] [--via <cx>,<cy>...] [--closed]              join two things that already exist, bending the route through cells you name
  spawn <waypoint> [--interval ms] [--speed px] [--colour #hex] [--off] arm an endpoint waypoint to emit movers along its path, or stop it
  panel <name> at <cx>,<cy> --cols n --rows n [--content f.json]  a node that spans cells and can carry content regions
  zone <name> from <cx>,<cy> to <cx>,<cy>                         enclose a rectangle of CELLS -- the half-pitch offset is the tool's problem, not yours
  group <name> <ref> <ref> [ref...]                               name a set of nodes as one thing
  move <ref> to <cx>,<cy>                                         put an existing node or waypoint on a different anchor
  rename <ref> <name>                                             change what something is called
  rm <ref> [ref...]                                               remove entities, and say what the cascade took with them
  set <ref> <field> <value>                                       change one property of one entity
  region <panel> at <col>,<row> [--text s | --glyph g] [flags]    add one content region to a panel, in place

Placement
  near <x> <y> [--within px]                       what is already around a point, so you do not draw on top of it
  place <type> near|inside|between <ref> [--link]  put a node beside, inside or between things -- on a free anchor, no coordinates
  add <type> at <cx>,<cy> [--name n] [--link ref]  put a node on a named anchor -- a cell, never a pixel
  anchor nearest <x> <y> [--layout node|zone]      the legal anchor closest to a pixel coordinate
  anchor free [--layout node|zone]                 every anchor nothing occupies
  layouts                                          the named grids and their offsets

Awareness
  who      who else is here: agents driving, people watching
  viewers  who is looking at what

Access
  access                                    who can reach this diagram, and at what level
  grant <principal> <read|write>            let a principal reach this diagram
  revoke <principal>                        withdraw a grant; says what access remains
  workspace grant <principal> <read|write>  grant across everything you own
  code mint <agent>                         mint a connection code; shown once, never again
  code list                                 the codes you have minted, never their secrets
  code revoke <id>                          retire a code; the agent claim survives it
  workspace grants                          who may reach everything you own
  workspace revoke <principal>              withdraw a workspace grant
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

### The structural verbs, and what they take off the caller

Amended 2026-08-26, and the amendment corrects this document rather than the code.\
The verb list above used to read `node add|move|set|rm`, `link add|rm`, `zone add|rm`, `group add|rm`.\
That is one sub-verb per CRUD operation per kind, which is exactly the API mirroring the section above rules against.\
It was never built that way, and the gap was not noticed because nothing checks this list against the manifest.

What the absence actually cost is **B133**.\
With no write verb for a zone, a group, a waypoint, a link between existing nodes, a move or a rename, every structural change went through `commit --ops` as hand-authored entity JSON.\
A twenty-node topology built that way made the CALLER re-derive six rules the codebase already owns: cell-to-pixel from `kernel/geometry.mjs`, the zone grid's half-pitch offset from `LAYOUTS`, the `<kind>-<six hex>` id grammar from `server/validate.js`, one-occupant-per-anchor from `model/invariants.mjs`, one-straight-link-per-pair from B80, and waypoint exclusivity, which was written down nowhere and was learned by being refused.\
Two of the six were wrong on the first attempt.

That is B117 in a better disguise.\
B117 was an agent reaching past the tool to `curl`; this is an agent reaching past the tool's vocabulary to a generic transport inside it.\
The consequence is identical -- the tool stays as incapable as it was, the gap stops being visible, and the reasoning ends up in a throwaway script instead of a verb anyone can re-run.

So each verb owns a rule rather than a route:

| verb | the rule it takes off the caller |
|---|---|
| `link <src> <dst> --via <cell>` | a waypoint is an implementation detail of a bend, so the verb mints them, orders them, and refuses an occupied anchor before the server has to |
| `zone <name> from <cell> to <cell>` | the zone grid sits half a pitch off the node grid; the caller names the cells it wants enclosed and never sees the offset |
| `group <name> <ref> <ref>` | resolves names to ids and refuses a group of one locally, because the server's refusal would cost a round trip to say the same thing |
| `move <ref> to <cell>` | occupancy, checked against the anchor list rather than discovered as a 422 |
| `rename <ref> <name>` | which kinds carry a name at all -- a waypoint does not, and a link's would be invented |

`commit --ops` stays.\
A batch transport is legitimate, and content regions are genuinely better expressed as data than as flags.\
What changed is that it is no longer the only way to say anything structural.

### Perception, and why it is a verb surface at all

Added 2026-08-27, and the frame is **A5 Perceptual Parity** rather than anything invented here.\
The axiom requires that a human operator and an agent hold symmetric perception of one reality, and it names two mechanics.\
This document had been satisfying the first by instinct and had never heard of the second.

**Synthetic Sensory Organs** are the instruments an agent uses to perceive its own output rather than emitting it blind.\
Before them, every verb answered with a TABLE, so an agent extending a diagram rebuilt its geometry from coordinates before it could choose where anything went.\
`map` is the answer: the canvas as text, scoped to content, a zone, or a radius around an entity.\
`render --summary` is the other half -- what the renderer actually emitted, by element, so confirming a picture needs no browser.

**Measured Parity** is the mechanic that makes the first verifiable: *the delta is itself measured and held within an explicitly-defined bound, because symmetry is a verified property and not an aspiration*.\
`draw parity` compares three views produced by three different code paths -- what the model holds, what the render emits, what the map shows -- and refuses when they disagree.\
The bound is zero.\
It is not hypothetical: `render --summary` shipped omitting waypoints, reporting 20 elements where the map reported 27 occupied anchors, and that was caught by eye.

The map is shaped for an agent reading a terminal, which changes several defaults away from what a person would want:

| decision | why |
|---|---|
| absolute labels on both axes | counting characters to recover a coordinate is the easiest mistake available, so the map never asks for it |
| two terminal columns per cell | the canvas is fixed at 31 cells, so the widest possible map is 62 columns plus a gutter, inside 80 always. A wrapped grid is worse than no grid because it still looks correct |
| cropped to content by default | most diagrams use a fraction of 527 cells, and empty rows cost attention |
| the legend prints every time | there is no hovering and no remembered glyph table |
| the key is one entity per line | lines parse; columns do not |
| zone borders in the GUTTERS | the zone grid sits half a pitch off the node grid, so an edge falls exactly between two cells. The borders are geometrically exact and cost neither a column nor a glyph |

### Walking, and the danger of a focus

`about` answers everything at once, which is right for *tell me about this* and wrong for moving around.\
Walking is a sequence of narrow questions where each answer decides the next step, so `focus` sets a subject and `links`, `holds` and `peers` read from it.\
`holds` is the relation that had no verb at all: containment was answerable downward through `zone contents`, or buried inside `about`, and standing on a node and asking what it is part of is the question a walk asks constantly.

**A focus is state, and hidden state is the most dangerous thing this tool can offer.**\
A verb answering confidently about something set ten commands ago is the failure this codebase keeps finding, so two rules are not negotiable: the subject is PRINTED by every verb that uses it, and the focus is scoped to its diagram.\
An entity id means nothing outside the diagram that minted it, and unscoped it answered `unknown entity: node-42c3be` on the next one -- a real refusal that blames the entity instead of saying the focus does not belong there.

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
