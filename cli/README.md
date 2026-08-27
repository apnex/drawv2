# draw CLI

The tool an agent drives draw through (**GR18**).\
Not a convenience over the API: an agent that cannot do a thing through `draw` extends `draw`, or halts and raises it -- reaching for `curl` is not the third option.

Speaks only HTTP.\
Imports nothing from `server/`, `app/` or `model/`, so it works against any draw server and can never accidentally test itself against in-process state.

Requires Node.\
The shell version required `jq` and `column` and is retired; see `docs/spec/COMMIT-DELETIONS.md`.

---

## Install

```bash
ln -s "$(pwd)/cli/draw.mjs" ~/.local/bin/draw
```

---

## Reaching a server

```bash
export DRAW_HOST=https://draw.apnex.io      # default http://localhost:8080
export DRAW_CODE=XXXX-XXXX-XXXX-XXXX        # a connection code, if the server has authorization on
```

The door is chosen, never configured.\
A code present means `/connect/v1`, its absence means `/api/v1` -- which is the server's own rule that the prefix is a door and never a privilege.

---

## Verbs

`draw help` prints them grouped, and `draw help <verb>` gives arguments, flags, a worked example, and the route that verb reaches.\
Naming the route is deliberate: an agent meeting a refusal the tool does not explain can go to [API.md](../docs/spec/API.md) rather than guess whether the tool or the server said no.

Every verb answers `--json`, because an agent parses output and a verb that cannot is one it cannot compose with.

---

## The three ideas worth knowing

Positions are **anchors**, never pixels.\
`draw add server at 5,-2` takes a cell, and a cell cannot be off the grid; `draw anchor nearest 130 60` converts a pixel if you have one.

Ask for **context** rather than assembling it.\
`draw about <entity>` answers what connects to a thing, what contains it and where it sits, in one call -- so a caller never derives a relationship the model could have been asked for.

The same idea drives the structural verbs, which is why they take cells and names rather than geometry.\
`draw link a-edge core-1 --via -8,-7` mints the waypoints a bend needs, and `draw zone site-a from -15,-6 to -9,4` owns the half pitch the zone grid sits on.\
Both existed only as hand-written JSON through `commit --ops` until B133, and the cost was that the caller re-derived rules the codebase already owns -- which is the same failure as reaching for `curl`, wearing a better disguise.

**Look** before deciding, and check that everyone is looking at the same thing.\
`draw map` draws the canvas as text -- occupancy, zone boxes, free anchors -- so placement is seen rather than derived from coordinates; `--zone`, `--around` and `--full` scope it.\
`draw focus` then stands on an entity and `links`, `holds` and `peers` read relations from it, which is how you walk a diagram you did not build.\
`draw parity` compares what the model holds, what the render draws and what the map shows, and refuses if they disagree -- because a human and an agent looking at different diagrams is a defect, not a difference of opinion.

This last idea is [A5 Perceptual Parity](../../mission-kit/axioms/A5-perceptual-parity.md) and the verbs are its two mechanics: instruments for an agent to perceive its own output, and a measurement that keeps the instruments honest.

---

## Design

[CLI.md](../docs/spec/CLI.md) is the design of record: why one manifest drives dispatch, help, coverage and this file, and what the verb surface is for.
