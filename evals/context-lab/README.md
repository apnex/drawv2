# The map evaluation -- draw's context-lab pack

Agents measured finding, reading and editing things on a diagram larger than one of the CLI's map chunks, by its chunks and its senses (draw's H28.3, B440; the director's ruling H28-2).\
Four arms, six tasks, every model context-lab offers, three runs.\
The chunk or the senses change afterwards only where an agent is measured failing, and only on the director's ruling.

---

## Run it

Prerequisites: a built context-lab checkout at `~/taceng/context-lab`, Node.js 24 for it, `bwrap`, authenticated `opencode` and `codex`, and draw's `node_modules` installed.

Build the fixtures once, and again whenever the pinned revision, the diagram, a policy or the shim changes:
```sh
node evals/context-lab/tools/build-fixture.mjs
```

Check the pack, preview a run, then run it:
```sh
CL="node $HOME/taceng/context-lab/packages/core/dist/src/cli.js"
$CL check evals/context-lab
$CL preview evals/context-lab pilot --out $HOME/.cache/h28-me-work/preview-pilot
$CL run evals/context-lab pilot --parallel 6 --work $HOME/.cache/h28-me-work
```

The full run is the suite `full` (the experiment `map-eval`), recorded first so it carries status `result`:
```sh
$CL record evals/context-lab map-eval
$CL run evals/context-lab full --parallel 6 --work $HOME/.cache/h28-me-work
```

H29.2's re-run is the experiment `map-units`: `map-eval`'s arm `a` on H29.1's CLI, which names its units (B453), over four models and three runs, 72 cells:
```sh
flock $HOME/taceng/drawv2-eval-runs/gate.lock $CL run evals/context-lab map-units --parallel 6 --work $HOME/.cache/h28-me-work
```

The pack pins H29.1's revision since H29.2, so `map-eval` and its supplements, recorded at H28.3's revision, now read `changed after it was recorded`: their variants' revision and their fixtures' `cli/verbs.mjs` moved, nothing else.\
Their runs' records are unchanged, and `report.mjs` reads them.\
To run one of them as recorded -- `map-supplement-o`, gpt's owed cells (B454) -- run it from a worktree at `7eca56d`, the pack as H28.3 left it, after building its fixtures there.

Resume a run that stopped:
```sh
$CL resume evals/context-lab <run-dir> --parallel 6 --work $HOME/.cache/h28-me-work
```

Report a run, per arm, model and task:
```sh
node evals/context-lab/tools/report.mjs <run-dir>
```

Run the pack's own tests:
```sh
node --test evals/context-lab/test/*.test.mjs
```

Runs are written outside the repository, to `~/taceng/drawv2-eval-runs/h28/map-eval/` (`records.path`).\
The work folder must not sit under a folder holding `AGENTS.md` or `CLAUDE.md`, which context-lab refuses.

---

## What it measures

The arms differ only in the `cli/verbs.mjs` each delivers, patched by `hooks/arm-cli.mjs`:

| arm | the map |
|---|---|
| `a` | 31 by 17, as draw ships it |
| `b` | 17 by 17, the one line that sets `CHUNK` |
| `c` | 31 by 17 without the senses: no "beyond the window" lines, no `--json` `beyond`, and no help promising them |
| `a2` | identical to `a`, so the gap between `a` and `a2` measures chance |

The tasks, on one diagram some fifteen chunks of 31 by 17 wide, each scored by code from the agent's `answer.txt` and the server's state when the session ended (`hooks/scoring.mjs`):

| task | asked | `./draw` allows |
|---|---|---|
| `t1-find` | the cell of `vault-7`, two chunks away among six decoys | every verb |
| `t2-trace` | the far end of `edge-gw`'s eastward link, through three waypoints | every verb |
| `t3-place` | a server beside `fw-north-3`, two of its sides taken | every verb |
| `t4-wire` | a link between devices four chunks apart | every verb |
| `t5-hunt` | the one vxlan, named nowhere, then a host west of it | `map` and the writing verbs |
| `t6-count` | the devices in an area larger than a chunk | `map` alone |

`t5-hunt` and `t6-count` separate the arms; in the other four an agent may read positions without the map, which `other-reads` counts.

Beside each task's `success` (and `found` and `placed` for `t5-hunt`), the hook records from the shim's log: `draw-calls`, `map-calls`, `wrong-reads` (map reads before every target was shown that showed none and came no nearer), `reads-to-target`, `target-reads`, `saw-targets`, `senses-followed` (reads of a chunk an earlier map printed as a sense command), `followed-content`, `other-reads`, `refused` and `intact`.\
Tool calls, tokens and seconds are recorded by context-lab itself.

---

## How it is built

- `fixture/shim.mjs` is `./draw` in every workspace: each call boots draw's server in process on no port, answers the CLI's `fetch` through an in-memory stream, runs draw's own CLI, flushes the store and exits.
  No socket is opened, so codex, whose sandbox refuses them, runs as every other runtime does.
  The server's data is kept gzipped in `.draw/state.json.gz`, with its write locks, and every call is a line in `.draw/log.jsonl`.
- `tools/build-fixture.mjs` builds draw's runtime at the revision `pack.json` pins and one workspace per scenario under `fixtures/`, which git ignores.
  `.draw/REVISION` records the revision and a digest, and `hooks/arm-cli.mjs` refuses a run over a fixture built otherwise or changed since.
- `tools/generate.mjs` built `data/diagram.json` through the CLI's own doors and derived `data/answers.json`; no workspace holds the answers.
- `data/policies.json` names the verbs each task allows.

- `tools/fixture-lib.mjs` `SCORED` names what scores a run beyond what context-lab hashes: the modules the hooks import, the shim and the data.
  Their digest is stamped into every experiment's notes, so recording `map-eval` pins them, and the transform refuses a run whose stamp is stale.

To move the pin, or after changing anything `SCORED` names, change every variant's `revision` in `pack.json` if it moved, run `node evals/context-lab/tools/build-fixture.mjs --stamp`, run the tests, and record `map-eval` again.
