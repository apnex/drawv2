# draw CLI

Sovereign terminal consumer of the draw server's read-only REST API — the first
external program to live entirely on the API contract. Prism CLI lineage: context
file, address-style queries, jq table templates, `--json` escape hatch.

Speaks only HTTP. No imports from `client/` or `server/`; works against any draw
server (local, container, remote) via `--host` or `DRAW_HOST`. Read-only by
design: model mutations stay with the browser (single-writer rule); the one
action, `push`, projects to Slides and never mutates the model.

Requires: `bash`, `curl`, `jq`, `column`.

Built for agentic interrogation as much as for humans: colors appear only on a
TTY (pipes and `NO_COLOR` get clean text), every error exits 1, and `show`
delivers full situational awareness in a single call.

## Install

```bash
alias draw="$(pwd)/cli/draw.sh"        # or symlink into your PATH:
ln -s "$(pwd)/cli/draw.sh" ~/.local/bin/draw
```

## Commands

```
draw <command> [args] [--diagram <id|name>] [--json] [--host <url>]

Discovery & Context:
  diagrams        List all diagrams on the server
  context [id]    View or set the default target diagram (persisted)

The Query Engine:
  get <entity> [id|name]   Interrogate entities (nodes, links, zones, groups)
  show                     Full diagram view: status + every entity table
  status                   Summary of the active diagram

Projection:
  push            Push the active diagram to its bound Google Slides deck

Verification:
  health          Server heartbeat
```

## Examples

```bash
draw diagrams                      # ID  NAME  REV
draw context prod-topology         # resolve by name or id prefix, persist
draw get nodes                     # ID  NAME  TYPE  X  Y   (center-origin px)
draw get nodes web-1               # one entity, by exact name or id prefix
draw get links web-1               # every link touching web-1, endpoint NAMES
draw get zones --json | jq .       # raw JSON for piping
draw status                        # meta + entity counts
draw show                          # the whole diagram in one call (--json: full doc)
draw push --diagram dmz            # wipe-and-recreate the bound slide
DRAW_HOST=http://box:8080 draw health
```

Tables are jq-projected via `tpl/*.jq` — edit those to reshape columns without
touching the script. Context persists in `cli/.draw_context` (gitignored);
`DRAW_CONTEXT` overrides the location (the test suite uses this).

Integrity audit: `tests/cli.test.js` in the repo suite drives this executable
against a throwaway server — `npm test` covers it.
