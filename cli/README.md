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

## The two ideas worth knowing

Positions are **anchors**, never pixels.\
`draw add server at 5,-2` takes a cell, and a cell cannot be off the grid; `draw anchor nearest 130 60` converts a pixel if you have one.

Ask for **context** rather than assembling it.\
`draw about <entity>` answers what connects to a thing, what contains it and where it sits, in one call -- so a caller never derives a relationship the model could have been asked for.

---

## Design

[CLI.md](../docs/spec/CLI.md) is the design of record: why one manifest drives dispatch, help, coverage and this file, and what the verb surface is for.
