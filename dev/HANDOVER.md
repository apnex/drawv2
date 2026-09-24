# Handover - the unification programme

For an agent picking up the consolidation, unification and appearance-pipeline work.\
Written 2026-09-24, at `b87117e`, with the gate at 1003 and every scanner green.

This document is the ON-RAMP, not the record.\
The record is `dev/DECISIONS.md` for what was ruled, `dev/BOARD.md` for what is live, and `dev/BACKLOG.md` for what was consciously not done.\
Read this to know where to stand; read those to know what is true.

---

## What the programme is

`VISION.md` was ratified 2026-09-03 and states the end: drawv2 is a programmable geometric engine, where a diagram is not a picture of a system but a world with physics.

The unification programme is the structural half of getting there.\
Today the system has two entity kinds that are really one, five renderers that each assemble their own attributes, and a type vocabulary the validator holds closed.\
The programme collapses those into ONE substrate with composable capabilities.

The ontology was ruled by the director on 2026-09-22 and amended twice.\
It is recorded in `dev/DECISIONS.md` under "The universal node, staged", and the terms are load-bearing:

| term | what it is |
|---|---|
| anchor | the CORE. Identity, position, and the fact that links can reach it. Nothing else. |
| pack | one capability composed onto an anchor: `routable`, `glyph`, `framed`, `named`, `content`. |
| composition | a named set of packs, and what an author picks: `server`, `router`, `load-balancer`. |
| node | an anchor AND the entirety of its composition. Not a layer -- nothing sits between the two. |
| waypoint | RETIRED as a concept. An anchor carrying only `routable`. |

The test that ontology passes, and that node-as-core failed, is that it explains the residue.\
A waypoint cannot hold a glyph and a node cannot be a junction, and neither restriction has a recorded reason.\
Under anchor-as-core both are the same omission: two compositions built separately, each missing packs the other has.

**The identifiers do not move yet.**\
`node-` remains the id prefix, the validator kind, the CLI noun and the field in every stored document.\
Renaming before the model is proven is how it gets done twice, and the id-grammar change is the irreversible step.

**Amended by the director 2026-09-24: `node-` is probably CORRECT, not merely tolerated.**\
The earlier framing treated the prefix as debt to be paid once the model was proven.\
It is not: `node` names an anchor AND the entirety of its composition, which is exactly what an identifier in a stored document refers to -- the whole entity, not its core.\
So the prefix is not lagging the ontology, it is naming the right thing in it.

What IS still owed is naming the other parts of the stack.\
`anchor`, `pack` and `composition` are ruled as concepts and have no identifiers, no field names and no place in the id grammar, and some of them will need one.\
That is design work, deliberately not settled here -- the point recorded is only that it is a naming question about the REST of the stack rather than a rename of `node-`.

---

## Where to start

Three items are open in H15 and one is part-built.\
They are not equally ready, and the order below is a recommendation with reasons rather than a queue.

### H15.9 - the appearance pipeline (WIP, start here)

The one with momentum, and the structural answer to the defect family that bit three times in one session.

Links are DONE.\
`linkAppearance(link, w)` in `kernel/geometry.mjs` returns ATTRIBUTES rather than advice, and `APPEARANCE_KEYS` declares every key it can produce.\
Both renderers go through it; `update` iterates the declared keys, setting those present and REMOVING those absent.\
`linkMarker`, `linkDash` and `linkWidth` are no longer called directly from either renderer.

That arrangement gets B230 structurally: adding a key to the derivation without declaring it is caught with no new guard.

Nodes, waypoints, zones and groups still assemble their own attributes, and the waypoint layer list is still a list of layers.\
Extending the pipeline to them is the next increment, and it folds in the third route a frame weight reaches the screen (see B235 below).

### H15.2 - the client projection of the collapse

Small, well-understood, and it was BLOCKED on H15.4 which has now landed.\
The board said "FOLDED INTO H15.4" across three sessions while H15.4 sat DONE and the fold never happened; that was reconciled in this handover's commit.

The defect is live: deleting a link paints a two-termination endpoint ring for roughly 100ms before the server's collapse returns.\
The fix is to SHARE `collapseAtWaypoint` rather than mirror it -- `model/invariants.mjs` is already imported by both sides, so there is no second copy to drift.\
`grep collapseAtWaypoint` finds exactly one importer today, `server/txn.mjs`.

### H15.5 - propagation along a run

A declaration on one segment should propagate along a run of bends, derived and never stored.\
Opposing declarations FRAGMENT the run, which the collapse matrix already calls a junction.

This one is ruled but unbuilt, and the ruling is the valuable part: see "the conflict rule" below.

### H15.7 - the permission table

A composition declares which anchor variants it permits, per TYPE rather than per instance, enforced by REFUSAL in the validator.

Ruled, unbuilt, and the most exposed of the four: it reaches the glyph table, the validator's closed type vocabulary, the CLI and the `type` field of every stored document.\
The director's scope discipline applies -- the claim that packs compose must be EARNED by composing two, not asserted in advance.

---

## What was ruled, and must not be re-litigated

These are director rulings recorded in `dev/DECISIONS.md` and `docs/spec/ATOMICS.md`.\
Reopening one needs the director, not an argument.

**`src` and `dst` are stored order.**\
A byproduct of drag direction.\
No rule may branch on them unless the link carries a declared direction.

**`flow` is an optional boolean, not an end-name.**\
Absent means undeclared and symmetric; `true` follows stored order; `false` runs against it.\
A boolean because the link already records both ends.

**The collapse matrix**, per waypoint: one termination is an endpoint; two agreeing terminations in the same plane make a BEND with an empty role set; two opposing, or planes differing, or three or more, make a JUNCTION.\
Plane and direction are INDEPENDENT tests.

**The conflict rule is FRAGMENT.**\
Two opposing declarations on one run break it at the waypoint between them, which the matrix already calls a junction.\
Latest-wins was rejected because it silently rewrites an authored decision.\
The consequence matters for H15.5: a declaration stores only ITSELF -- no ordering, no timestamps.

**Appearance divides into intrinsic and derived.**\
Intrinsic is glyph, fit box, colour tokens, the spec ladder -- type-supplied and irreducible.\
Derived is a function of what other packs have derived.

**Resolution is PER DERIVED STATE, not per pack.**\
A pack declaring derived appearance carries `composes` and a priority, and it carries them per state:

| derived state | glyph vs anchor marks | why |
|---|---|---|
| endpoint | the glyph wins alone | the frame already says something terminates here |
| junction | the ring composes over the frame | nothing about a frame says flow meets and does something to it |

**Session state is NOT a pack.**\
Selection, hover, armed, ghost, run-mode hides and the socket grid DECORATE what was drawn; they never compete with a pack.\
Selection belongs to the grid, not to a node.\
This was got wrong once in the reasoning that produced the ruling, which is why the boundary is written down.

**Policy is out of scope**, and named only so the pack model is not designed in a way that excludes it.\
The director's preserved hypothesis: policy may be derivable the way routing is, by declaring flow pairs on a control-plane graph, which would keep it stateless.\
Not designed, not ruled, and not to be assumed.

---

## The open question nobody has answered

**How does a pack contribute a WRITE?**

This is the hardest question in the programme, it is still open, and it is worth building up rather than stating.\
What follows is the explanation given to the director on 2026-09-24, recorded because the shape of the question is most of the work.

**What a pack is today.**\
Every pack designed so far ANSWERS QUESTIONS, and never changes anything.\
Ask `routable` about an anchor and it says "you are a junction".\
Ask `glyph` about a node and it says "draw the router symbol".\
Ask `framed` and it says "stroke-width 2.1, square".

Ask the same question twice and the answer is the same.\
Ask it on two machines and the answer is the same.\
Nothing is stored and nothing is remembered.

That property is why the system works without peers talking to each other: two browsers holding the same document agree without exchanging anything, because each derives the same answer independently.

**The operation that breaks it.**\
Take a link bent through a waypoint, click the waypoint, and SPLIT -- one link becomes two.\
`splitAtBend` in `model/invariants.mjs` returns two halves, which is not an answer about the document but a CHANGE to it: one link destroyed, two created.

**Why that is a different kind of thing.**

| | a derivation | a write |
|---|---|---|
| what it does | reads the document | changes the document |
| run it twice | the same answer | a DIFFERENT result |
| needs a lock | no | yes |
| needs the server | no | yes |
| can be undone | nothing to undo | must be undoable |
| two peers | agree automatically | must be ordered |

Every row is a new problem.\
Running a derivation twice is harmless; running a split twice leaves three links.

**The actual question.**\
Splitting is a `routable` concern -- it is about the route, the bend and the anchor -- so if `routable` is a pack, the split belongs to it.\
But every mechanism designed for packs assumes the pure shape, that a pack is asked a question and returns an answer.

Concretely unanswered: what does a pack RETURN, an op list or a whole document or a request?\
Who APPLIES it, the pack or the server's planner or something between?\
Where does VALIDATION happen, before or after the pack has spoken?\
If two packs both want to write, who goes first?\
How does the result reach undo history?

**Why it cannot be deferred.**\
Build the pack mechanism now and it will be built for pure functions, because those are the only packs that exist -- then the split arrives and does not fit, and the mechanism is redesigned, which is precisely what the staged approach exists to avoid.\
It is also the first real test of the model: two derivations composing proves little, since both are just functions, whereas a derivation and a write composing proves the claim the director's scope discipline says must be EARNED.

**The blunt version.**\
Packs are read-only.\
The first genuinely useful capability, the split, is read-write.\
Nobody has designed how a pack writes, so building the pack system today means building the wrong one and finding out later.

**A frame worth challenging before accepting it.**\
The above assumes the pack needs to write.\
The alternative is that a pack never writes, it PROPOSES: `routable` returns "this is a legal split, here are the two halves", still a pure function and still deterministic, and the server's planner decides whether to apply it.\
Packs would then stay read-only forever and the write would stay where writes already live.

If that holds the question dissolves rather than gets answered.

It is not settled, but the code leans that way and the lean is worth reading before designing.\
`splitAtBend` is already pure: it RETURNS two halves and applies nothing, and it is `app/src/input.js` that decides identity, re-cuts pieces and emits the ops.\
So the split is today a pure derivation plus a caller that writes, which is exactly the shape the alternative proposes -- the pack reasons, the planner writes.\
What that does NOT settle is whether the derivation can stay pure once it must know which half keeps the original id, which is the decision `input.js:992` makes and the one a pack would have to make too.\
Test it in design rather than assume it either way.

A second, smaller one: **priority as a bare integer is where the `composes` shape rots.**\
Two packs land on the same value, or one is inserted at 50 and silently reorders another.\
An ordered list of named layers avoids it.\
Not ruled, because the first two packs do not need it -- but it will need ruling before the fifth.

And a hypothesis worth TESTING rather than assuming: the router's centre ring should perhaps come FROM `routable` when the anchor derives `junction`, rather than being drawn into the glyph.\
A router with one link would then show no ring and one with three would.\
This needs the director's eye, because a router that renders identically whether or not it is a junction would look wrong in a way a still image will not reveal.

---

## How this codebase fails, measured

This is the most useful section in the document.\
The failures below are not hypothetical; each is a defect number with evidence.

### Green-and-wrong: verifying the nearest layer instead of the real one

Five instances in one session:

| defect | what was verified | what was true |
|---|---|---|
| B225 | the marker was defined in defs | nothing referenced it |
| B226 | the `marker-end` attribute was set | `context-stroke` painted ZERO pixels |
| B228 | the first render worked | updates did not -- `update` set only `d` |
| B229 | the readout fired | it was a 1200ms flash, not state |
| B235 | the export said `stroke-width="1"` | the canvas computed 2.1px -- CSS beats a presentation attribute |

**The corrective**: for anything visible, verify `getComputedStyle` or pixel readback WITH A CONTROL, never an attribute.\
Deploy earlier and look.

### One value, two authorities

Three in one session, all the same shape -- a stylesheet the kernel cannot see:

| defect | the value | the two authorities |
|---|---|---|
| B234 | node and zone labels | the canvas drew them, the export did not |
| B235 | the panel frame weight | a presentation attribute against a CSS rule |
| B236 | the label size and offsets | a presentation attribute against a CSS rule |

The appearance pipeline is the structural answer, which is the argument for H15.9 going first.

### Guards that agree with the code rather than the ruling

Three instances: B232 asserted `['endpoint']` for the bend case; B233 declared `flow` on every H15.15 case, hiding the nesting; the dash-ratio test computed its expectation from `DASH_ON`/`DASH_OFF`.

**The corrective**: enumerate the ruled cases FIRST, then assert each one.

### Tests that pin literals break on correct changes

Five in one session: `'6 6'`, `'10 10'`, a frame rect matched byte-for-byte, line height `18`, and `<->`.

**The corrective**: assert the RULE -- a ratio, a relationship, a geometry -- not the value.\
Derived arithmetic needs a tolerance.

### Count the doors

`flow` needed five doors (commit, boot, canvas, kernel renderer, and the ADAPTER).\
The name in B234 needed four and was dropped at three.\
B237 is the same failure again: the doors to the SCREEN were counted and the CLI was not.

**The corrective**: `kernel/adapt.mjs` is the door that gets forgotten.\
Check it every time.

### Guards with a file list go stale

B224: B200's guard named three files and `painter.js` was the fourth.

**The corrective**: sweep a DIRECTORY, and assert the sweep found something.\
`tests/cli-tool.test.js` has a worked example in the B237 block -- it sweeps `OPTIONAL` and asserts `checked >= 3`.

### Aliasing makes a test vacuous

`m.get(...)` returns the model's LIVE object, so holding it across a mutation compares a value to itself.\
Snapshot with `{ ...m.get(...) }`.

---

## Standing rules

Director-ruled, and not negotiable without going back.

**GR18 / no fallback.**\
Extend `draw` or halt and raise it.\
Piping `draw show --json` through a script is ITSELF a defect and is banned.\
B231 exists because that ban was breached repeatedly before being noticed.

**A5 perceptual parity.**\
Hold your own instruments.\
Never ask the director to read a screen for you.

**Positions are anchors, never pixels** (B110).

**Register before implementation** -- a `B` row with `[V, file:line]` evidence, before the code.

**Every fix ships with a test proven RED.**\
Mutate to prove the test can fail.\
`cmp -s` against a backup before and after every mutation.

**`git add -A` BEFORE `npm run gate`.**\
Never `git checkout <file>` on an uncommitted file.

**X1: pure target state, no back-compat.**

---

## The state of the instruments

`npm run gate` runs 1003 tests and nine scanners.\
All green at `b87117e`.

The scanners are the part worth knowing, because they are what makes the board trustworthy:

- `scan-board` -- citations resolve, verdicts parse, no live row invisible in either file. The verdict vocabulary is CLOSED: `DONE`, `TODO`, `WIP`, `BLOCKED` on the board; `CLOSED`, `RULED`, `OPEN`, `PART-CLOSED` and others in the backlog. `DEFERRED` is rejected on the board.
- `scan-dead` -- every export needs a production consumer or a recorded reason in the ALLOW table.
- `scan-twins` -- no undeclared shared arithmetic.
- `scan-docstyle` -- the documentation conforms to the mission-kit style rules it claims to follow.
- `scan-cli` -- every route and method pair is reached, pending with recorded work, or allowed with a reason.

**What no scanner can catch**: a row that lies about itself.\
`BLOCKED` is a legal verdict, so H15.2 claimed for three sessions to be folded into a milestone that was already DONE.\
Re-read the live rows against the code periodically; the scanner checks consistency, not truth.

---

## Known live defects, not in the programme

- **B221** -- the 100ms endpoint-ring flash on delete. This IS H15.2.
- **B230** -- PART-CLOSED. Links are structurally guarded; nodes, waypoints, zones and groups need a SCANNER, not a test. Four test-shaped attempts failed differently: comparing against a fresh render requires running create, which repairs the element first.
- **Link names** -- split copies `name` while minting a fresh `id`, so three links can all read `link-2`. Cosmetic, unregistered.
- **`B113` in `tests/server.test.js` is flaky** -- 2001 links against a 3000ms timeout.
- **No AR1 architecture record exists.** For a programme whose aim is unification, there is no document saying what the system IS -- only 237 rows saying what was done to it.

---

## Two gaps found by using the tool, deliberately not closed

Both were raised with the director in the session that produced this handover and both were deferred, so they are recorded rather than acted on.

**A draft cannot be observed.**\
`draw map`, `show`, `trace`, `parity`, `near` and `check` all read the COMMITTED document; not one consults the draft.\
So while a draft is open, every way of looking at the diagram shows the state before your staged work.\
A draft is therefore safest when it is short, which is the opposite of what it is for.\
Closing this needs SERVER mechanics, not a CLI change: `cli/` is self-contained by construction (B138 installs it as a bare symlink), and a local projection would mean a second implementation of the model.\
The seam already exists -- `plan()` in `server/txn.mjs` is pure and separate from `commit()`.

**An agent cannot perceive its own authority.**\
`draw access` answers per diagram and needs a diagram you can already name.\
There is no verb reporting your identity and grants, so an agent discovers its scope only by being refused.\
That is an A5 gap.

---

## Operational

- Live at `https://draw.apnex.io` behind IAP, Cloud Run, GCS-backed at `gs://diagrams.apnex.io`, authorization ON.
- Current revision `draw-00149-t2m`. B237 is committed and pushed but NOT deployed -- it is a CLI change, so the running service is unaffected.
- `export CLOUDSDK_AUTH_ACCESS_TOKEN=$(gcloud auth application-default print-access-token)` before every gcloud call.
- Deploy with `--min-instances=1 --max-instances=1`.
- `deploy/` must never be pushed. The durable copy lives at `~/taceng/drawv2-archive/deploy-runbook/`.
- The CLI derives its door from the credential: a code means `/connect/v1`, its absence means `/api/v1`. Pass the bare origin as `DRAW_HOST`, never the prefix.
- Credentials live OUTSIDE the repo at `../key` and are gitignored. B223 exists because one was tracked and published to a public repository.
