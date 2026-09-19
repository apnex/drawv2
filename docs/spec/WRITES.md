# draw -- the write model

The sovereign spec for HOW a change reaches a document: one op at a time, or a group authored locally and committed whole, with or without a paced reveal.

A design of record, written before the surface exists.\
It sits under `CLI.md`, which owns the verbs, and over `TRANSACTIONS.md`, which owns durability.\
`CLI.md` says what an agent can ask for; this says what happens between the asking and the document changing.

> **Status: BUILT and deployed.**\
> Reached by design conversation on 2026-09-04 and implemented the same day, so this began as a
> design of record and is now a record of what runs.\
> Five defects changed it under construction -- **B189** moved anchor selection server-side, **B191**
> made a beat unfurl for a viewer already watching, **B192** gave a beat a dwell so a one-entity
> caption can be read, **B193** restarted a drained schedule, and **B195** let a drafted set link
> what it is creating. Each is marked where it applies.\
> Section 9 lists what is still not settled and who owns each answer.

---

## 0. Why this document exists

An agent building a twenty-node topology today makes one call per op.\
Each is a round trip, a version bump, a transaction, and a separate undo entry.\
The write budget is 30 commits per rolling 5 seconds (**B181**), so a real build hits the limit and backs off for 6 seconds mid-topology.\
Undoing "the web tier" means undoing eleven times and counting carefully.

That is the churn this document removes.\
It is a authoring problem, not a rendering one, and it is worth fixing whether or not anything is ever narrated.

The second problem is that a document arrives all at once.\
An agent explaining a system has no way to say "this part first, then this part" -- the words live in chat, separated from the geometry, and a viewer who joins late sees a finished wall.\
That is **B188**, and the reveal in section 5 is the smallest thing that answers it.

---

## 0b. What already exists, and what is actually missing

`draw commit --ops <file|->` ships today.\
It takes a JSON array of ops, applies them as ONE transaction with one undo label, and `CLI.md` rules that it stays -- a batch transport is legitimate, and content regions are better expressed as data than as flags.

So the atomic-apply half of a set is **built**.\
An agent can already avoid forty round trips by assembling ops itself and posting them once.

What is missing is everything around it.\
Assembling that JSON is the caller's problem, which is precisely the failure **B133** recorded: with no write verb for a zone or a link between existing nodes, every structural change went through `commit --ops` as hand-authored entity JSON, and the CALLER re-derived six rules the codebase already owned.\
Two of the six were wrong on the first attempt.

**The gap is the draft, not the batch.**\
An agent should compose a set with the same verbs it already uses -- `draw place node`, `draw link` -- and have the tool accumulate them, rather than hand-writing the transport format those verbs exist to hide.\
That is what sections 2 through 4 specify, and it is why a set is a small slice rather than a large one.

---

## 1. The two objects

The word "batch" was doing two jobs in the conversation that produced this document, and the design only became clear once they were separated.

**A set** is a group of ops applied atomically.\
It has an id, one version bump, one undo entry, and it is complete on its own.\
An agent that never narrates anything still wants sets: three reviewable groups instead of forty commits.

**A beat** is a set plus a reveal -- a pacing interval and a caption -- so the set's changes appear over time rather than at once.\
A beat is constructed with a set and commits as one call.

The dependency runs one way.\
A beat references a set; a set knows nothing about beats.\
Removing a beat leaves its set untouched, which is what makes cancelling a reveal coherent.

**A document with no beats is the normal case**, not a special one.\
Absence of a reveal means fully revealed, so every document that exists today is already correct under this model and needs no migration.

---

## 2. The draft is a destination, not a mode

This is the load-bearing decision of the document, and the alternatives were considered and rejected.

A **drafting mode** that changes what a verb does is hidden state.\
The same command means two things depending on something set earlier, and an agent invoking `draw` per-command has no prompt to remind it.\
That is the failure this design exists to avoid, not a shape to build on.

A **default plus an override flag** is better and still leaves every write verb with two behaviours selected by remembered context.

So the verb never changes meaning.\
What changes is where the op lands, and that is named in the command:
```text
draw place node web-01              applies now
draw place node web-01 --draft      stages
draw commit                          applies the draft as one set
```

Reading the command back tells you what it did.\
This is the `draw use` precedent (**B186**): a target stored per host, addressed explicitly, refusing rather than guessing.

**A draft is an ordinary object.**\
It has state, it can be listed, inspected, appended to, discarded and committed, and it appears in reads like anything else.\
That is **B187** applied before the fact: the mistake there was machinery that existed while the field did not, and the equivalent here would be a draft that exists only as an implicit side effect of staging.

---

## 3. The mode is a remembered destination

`--draft` on every op is correct and verbose.\
For a long authoring session an agent should be able to set the destination once, which is what Junos configuration mode does and what the conversation reached for by analogy.

```text
draw draft begin                     subsequent writes stage
draw place node web-01               stages -- the destination is remembered
draw place node web-02 --direct      applies now, escaping the default
draw commit                          applies the draft, and clears the destination
```

**Why the Junos analogy holds and where it does not.**\
Configuration mode is safe there because the prompt shows it on every line -- `>` against `#` -- so the mode cannot be forgotten.\
An agent has no prompt, so the property that makes the mode safe must be provided some other way.

**Every write while a draft is open reports the draft state.**

```text
$ draw place node web-01
draft +1: place node web-01     (3 ops staged)
```

Silence is the failure mode.\
An agent that stages five ops and never commits has changed nothing, and nothing errored -- so the tool states the count on every append, and a non-empty draft is surfaced by reads.\
That is the prompt's job, relocated to where an agent actually reads.

Junos `commit confirmed` -- auto-rollback unless reconfirmed -- is deliberately NOT carried over.\
It exists because a bad router config locks the operator out; our failure mode is a wrong diagram and undo already answers it.

---

## 4. Perception is symmetric with authoring

With a draft open there are two realities: the document, and the document as it would be after the draft applies.\
An agent needs both and must never confuse them, so the same flag means the same thing in both directions.

| question | verb |
|---|---|
| what is in the document | `draw get ...` -- never time-dependent, never draft-dependent |
| what have I staged | `draw draft show` -- the ops, in authored order |
| what would the document look like | `draw get --draft` -- the projection |
| what would change | `draw draft diff` -- the delta |

`draft diff` is named under `draft` rather than as a bare `draw diff`, which stays free for comparing documents or revisions.

**`plan` and `apply` are deliberately not used.**\
They are Terraform's words for declarative convergence -- compute a diff against a declared target, then execute it.\
A draft is imperative: an authored list of ops in order, so a "plan" would show what was already typed.\
Borrowing the vocabulary would promise convergence semantics this model does not have, and that is **AG-4** of the B188 survey, deferred as a separate thing.

---

## 5. The reveal

A commit decides what it becomes:
```text
draw commit                                        a set -- applies at once
draw commit --pace 200ms --caption "the web tier"  a beat -- applies at once, appears over time
```

**The ops apply immediately in both cases.**\
All of them, atomically, one version bump.\
There is no pending op, no partially applied document, and `draw get` is never a function of time.

What is derived is **when each op's result becomes visible on a canvas**.\
The renderer asks whether an entity is revealed yet and computes it from the beat's origin, the interval, and the entity's index.\
This is the H12 shape one level down: `moversAt` derives motion over a static board; this derives the arrival of structure over a complete document.

**What is stored** is an origin, an interval, a caption, and the ordered entity ids -- not the ops, which already ran.

### The queue holds order, not time

An author submits in order and reasons only in order.\
Timestamps are the system's burden, and **B177** is the standing evidence for why: two tabs disagreed about the time by tens of seconds because a stamp crossed a machine boundary.

So **at most one instant exists** -- the active beat's origin.\
Everything queued behind it derives its start from that origin plus the durations ahead of it.\
No stamp can go stale, because there is only ever one.

This is what makes the rest fall out:

- **No promoter, no timer, no watcher.** Nothing advances the queue; position is derived, the same way a mover's position is.
- **Survives reload and scale-to-zero.** A late joiner computes the same reveal position as everyone else, from the same stored origin.
- **Cancelling a queued beat is a list removal.** Whatever followed recomputes, because nothing downstream was stored.

### Cancel drops the reveal, not the work

A queued beat's ops have already committed.\
`draw beat cancel` removes the reveal record; the entities remain and become immediately visible, since absence of a reveal means fully revealed.

Cancel applies to a **queued** beat only.\
The active one is refused, and the refusal names undo, which is the mechanism for a beat in flight.

---

## 6. Undo

**Undo removes the most recent commit, whole, globally.**

One undo per set and one per beat, which was the requirement from the start.\
Undoing a beat that is mid-reveal interrupts it and removes it entirely -- a partially revealed thing vanishes, including entities that never visually appeared.

Unwinding is **last-in-first-out only**.\
Removing set 7 while 8 through 12 stand is not supported, and this is a ruling rather than an omission: the ops in 8 through 12 may depend on 7's, so arbitrary removal needs a dependency graph between commits.\
That is a substantially larger thing than grouped authoring, and nothing has needed it.

The sharp edge, stated because it follows directly from atomic apply: an agent that submits twelve beats has committed twelve times within a second while the canvas is ninety seconds behind.\
Undo at that moment removes the twelfth -- the one nobody has seen -- not the one on screen.\
**Ruled: undo removes the most recent commit.**

---

## 7. Ordering and references within a set

Ops apply in authored order, sequentially.

An op referring to something created earlier in the same set is the obvious case -- place a node, then link to it.

**B187 already solved the reference half.**\
Every entity carries a mandatory name, `resolveId` matches on names, and names are unique across all five kinds.\
So an op refers to `web-01` and the server resolves it while applying, in order.\
Ids do not need to travel: `place` already mints its own client-side (`node-<6 hex>`) and the server accepts it, so a set may name what it created.

A forward reference -- naming something created later in the same set -- is a refusal, not a puzzle to solve.\
The set is refused whole, which is what atomic apply means.

### The resolution hazard, measured

**This is the real work of a draft, and it is not the transport.**

A write verb does not simply record what the agent typed.\
`draw place server near lb-1` READS the live document, asks the server for free anchors, picks one, and emits an op carrying a resolved `x,y`.\
Forty-four call sites in `cli/verbs.mjs` resolve an argument against live state this way.

So two drafted ops both resolve against the SAME pre-draft document and both choose the same anchor.\
Measured on the live estate 2026-09-04, on a scratch diagram, with two `place` ops committed as one set:
```text
commit: node-aa2222 and node-aa1111 occupy the same anchor (0,-60)
```

The set is refused WHOLE, which is atomic apply behaving correctly -- **B112** holds one occupant per anchor and the server enforces it.\
Run sequentially the same two verbs succeed, because the second sees the first's result.

**A draft that only accumulates emitted ops is therefore wrong.**\
It would work for ops whose arguments are absolute (`add at 0,0`, `rename`, `rm`) and fail for every verb that resolves a relationship -- which is the verb set B133 was filed to create, and the reason an agent uses the tool instead of hand-writing JSON.

Three shapes answer it, and the second was ruled:

- **Resolve against a local projection.** The draft keeps its own model of the document as the set would leave it. Cheaper to build -- `projection()` and `violations()` already exist in `model/` -- but `cli/` stops being self-contained.
- **Defer resolution to the server.** The op stores the INTENT (`near lb-1`) rather than a resolved position, and the server resolves each op as it applies. **RULED.**
- **Refuse the combination.** A draft accepts only absolute ops. Cheap and useless: it excludes exactly the verbs a set is for.
### W7 RULED: the op carries INTENT, and the server resolves it

Ruled by the director 2026-09-04, against the projection-in-the-CLI alternative.

A drafted op stores what the agent EXPRESSED -- `place server near lb-1` -- rather than a position resolved against a document the draft cannot see.\
Resolution happens at commit, in the server, where the document is.\
`cli/` stays standalone: it imports `node:` builtins and its own two files, and takes no dependency on `model/`.

**The server half already exists.**\
`server/txn.mjs` `plan(model, ops)` runs each op against a scratch projection and calls `applyOps(proj, step.ops)` between them -- the comment on the line reads *"advance the projection for op i+1"*.\
So ops in one request already resolve against the accumulated result of the ones before them.

Measured 2026-09-04, calling `plan()` directly on a two-node document:
```text
distinct anchors -> ok
same anchor      -> refused at op-1: node-bb2222 and node-bb1111 occupy the same anchor (0,-60)
```

That is the whole mechanism a draft needs, already built and already the single mutation point -- `tools/scan-writers.mjs` fails the build on any write outside `applyOps`.

**What is missing is one op form.**\
`planOne` accepts `put`, `set`, `del` and `meta`, each carrying resolved values.\
An intent op names a relationship instead, and `planOne` must learn to resolve it against the projection it already holds.\
The relational logic exists but lives in the wrong place: `cli/verbs.mjs` computes free anchors and picks one across 44 call sites, and that reasoning has to move server-side to be usable inside a transaction.

**Why this over resolving in the CLI.**\
The projection alternative was cheaper to build -- `projection()` and `violations()` already exist in `model/` and return the server's own error strings -- but it costs a coupling: `cli/` would stop being self-contained, and a change to `Model` could break the tool.\
Intent is the better architecture for the reason the survey's derived-visibility pick was: the stored thing is what was MEANT, and the resolution is computed where the truth is.\
It also composes with a beat, where the gap between authoring and applying is wider still.

**W8 is therefore closed rather than owed.**\
The CLI takes no new dependency, and `CLI.md` needs no amendment about self-containment.

**A draft validates structurally on append and semantically on commit.**\
The CLI can answer "is this a well-formed op with coherent flags" -- it already does for 60 verbs.\
It cannot answer "does this target exist, is this anchor free," and a draft that pre-validated semantically would be lying anyway, because the document can change between draft and commit.

### W9: the intent op, and where its logic already lives

**The relational logic does not need to be written, and mostly does not need to move.**\
`kernel/geometry.mjs` exports `LAYOUTS`, `anchorAt` and `nearestAnchor`; `server/rest.js` already imports them to answer `layouts/<layout>/anchors?free=1`.\
`txn.mjs` can import the same kernel the rest of the server does, so a resolver inside `planOne` composes what exists rather than restating it.

What `cli/verbs.mjs` adds on top is the SELECTION, and it is small: filter the free list to a zone's bounds for `inside`, take the midpoint for `between`, walk outward by 60px for `--dir`, else pick nearest.

Measured 2026-09-04, resolving `near lb-1` twice against a projection advanced between them:
```text
op1 near lb-1 -> { x: 0, y: -60 }
op2 near lb-1 -> { x: -60, y: 0 }   distinct: true
```

Two intents, two distinct anchors, inside one transaction -- which is what two round trips buy today.

**The rule had one home and it was the wrong one -- SHIPPED 2026-09-04.**\
The server ANSWERED occupancy -- `anchors?free=1` filters the grid and returns every free anchor -- but nothing server-side picked one.\
Selection was `cli/verbs.mjs` alone, which is why `place` costs two round trips and why `plan()` could not resolve an intent op.

`server/anchor.mjs` `resolveAnchor(model, at)` now owns it: pure, reading a model and returning an anchor or a refusal.\
It sits in `server/` rather than `model/` deliberately -- it needs `kernel/` for the grid, and `model/` is a sovereign sibling of `kernel/` that imports it nowhere (`model/limits.mjs`).

Proven equivalent to the rule it replaces: 72 resolutions across six reference points, each after twelve sequential placements, **zero divergence** from the CLI's algorithm.\
So moving the rule cannot change where a node lands.

One correction was carried across rather than transcribed.\
The CLI ordered candidates by `Math.hypot`; the resolver compares squared distance, because ordering by `d2` is ordering by `d` and **B176** bans an implementation-approximated root from anything two peers must agree on.

**Shape.**\
An intent op names a relationship in place of a resolved position:
```text
{ op: 'place', kind: 'node', entity: { name, type }, at: { near: 'lb-1', dir: 'right' } }
{ op: 'place', kind: 'node', entity: { name, type }, at: { inside: 'dmz' } }
{ op: 'place', kind: 'node', entity: { name, type }, at: { between: ['a', 'b'] } }
```

`planOne` resolves `at` against the projection it already holds, producing exactly the `put` it would have received, then proceeds unchanged.\
So the op form is additive: `put`, `set`, `del` and `meta` keep their meanings, and a resolved `put` remains the thing that reaches `applyOps` -- `scan-writers` still reports one writer.

**SHIPPED 2026-09-04**, and the property that matters is proven through `plan()` rather than only against the resolver: two `place` intents in ONE transaction resolve to different anchors, because the planner advances its projection between them.\
An unresolvable intent refuses the whole set and names the op, keeping `{ ok, error, opIndex }`.

Refusal keeps `plan()`'s existing contract -- `{ ok: false, error, opIndex }` -- so `zone dmz has no free anchor` refuses op 3 of a set and names it, and the whole set is refused because that is what atomic apply means.

**Which verbs emit it.**\
Not all 44 call sites: most resolve a REFERENCE (`resolveId` turning a name into an id), which the server already does and B187 made unambiguous.\
The ones that need an intent op are those resolving a POSITION -- `place` in its three forms, and any later verb that positions by relationship.\
An absolute op (`add at 0,0`, `move`, `rename`, `rm`) needs nothing new and stages as it stands.

**Relational is not declarative, and the difference is load-bearing.**\
An intent op says what should be TRUE -- a server near `lb-1` -- and the system computes how, which is the declarative move and is why the pieces kept already existing.\
But a declarative surface is idempotent and convergent: applying an unchanged declaration twice is a no-op.\
`place server near lb-1` twice gives two servers, correctly, because it is an imperative instruction whose POSITIONING is deferred rather than a statement of desired state.

So the ops are **relational**, not convergent, and re-committing a set duplicates everything in it.\
Undo is the only unwind (section 6).\
Full convergence needs a target state to diff against, which nothing here produces -- that is **AG-4**, `draw apply <document>`, deferred.\
This is the substrate such a thing would need, and the director has held it open for consideration once this interaction is coherent.

### The intent op needs the server that understands it

A drafted `place` carries an op form the deployed server may not have.\
Measured 2026-09-04 against the live estate, staging three intents and committing them:
```text
commit: unknown op 'place' (op 0)
```

The in-process suite could not find this -- it boots a server from the working tree, so the tool and the server always agree there.\
Only the live path has a version gap, which makes a probe against the estate part of landing this rather than a courtesy.

Resolved by deploying, and re-probed on the estate immediately after:
```text
draft +1: place server near lb-1  (3 ops staged)   document still v1
3 ops  v2                                          one commit, one version
lb-1 0,0   web-01 0,-60   web-02 -60,0   web-03 60,0
4 nodes, 4 distinct anchors
undo --expect 2  ->  1 node
```

Three intents in one transaction, each resolved against the projection the planner advanced between them, and one undo removing the whole set.\
That is the property the suite cannot assert and the reason the probe is part of the work.

The beat shipped the same way, and the same probe was owed.\
Before deploying, `--pace` and `--caption` were accepted and silently DISCARDED -- the deployed server dropping fields it did not know, which is the failure shape this document names in section 9.\
After, on the estate:
```text
draft begin, three place ops, no --draft on any of them
3 ops  v2
reveal: origin=1789719654496  beats=1  interval=250ms  caption='the web tier'  ids=3
t=origin-1ms    -> []
t=origin+0ms    -> [web-01]
t=origin+250ms  -> [web-01, web-02]
t=origin+500ms  -> [web-01, web-02, web-03]
undo            -> nodes=[core]  reveal=GONE
```

One origin, the unfurl derived from it, and undo taking the record with the entities it named.

**And then watched, which found what none of that had.**\
The document was right and the canvas was not: three nodes committed at a 2000ms pace appeared simultaneously on a page that was already open.\
Two defects behind one symptom -- the reveal never crossed the wire on a change, and once it did, the painter treated its own set as proof the DOM write had landed.\
Both are **B191**, and both are now held by a CDP test that commits a beat to a watching page.

A third defect came from driving the whole surface rather than a layer, and it was not in the code.\
A fourteen-node topology built with `place near <ref>` repeated against one reference produced a CLUSTER -- leaves above, below and beside the spines -- and the run was reported as a success because the beat record was checked and the canvas was not.\
`near` is a proximity rule; a rank is a layout decision, and `add ... at <cell>` is how a tier is stated.\
`draw map` renders occupancy as a grid for exactly this, and its own summary says placement is SEEN rather than derived.

So the rehearsal now asserts its own layout.\
`deploy/demo/spine-leaf.sh` builds each tier as one beat, prints the map, and exits non-zero if a tier has drifted off its row -- a check that reported and returned zero would be one nobody could gate on.\
For anything visual the record is not evidence, and a verb exists whose whole purpose is to show the thing instead.

The lesson is narrower than "test more".\
The derivation, the model round trip and the CLI were each tested and each correct; the gap was the composition between them, and no unit test spans a websocket broadcast.\
Verified by eye on the live app at the third attempt, which is two attempts more than a machine-watched unfurl would have cost.

Two things follow.\
**A draft outlives a refusal**: the local file is cleared only after the server accepts, so three staged ops survived the rejection and were still listed by `draft show`.\
An agent that loses its work to a server-side refusal cannot even see what it lost.\
**And a drafted set is only as portable as the oldest server it might reach** -- `--draft` against an older revision stages happily and fails at commit, which is the right place to fail but a poor message.\
Naming the op in the refusal is the server's job and it already does it.

### The lock

A write today requires the write slot -- `draw add` refuses with `add needs the write slot -- run draw lock first`.\
A draft is local and takes no lock: nothing is being written while ops accumulate, and a long authoring session must not hold the slot against every other writer.\
The lock is needed at `commit` and nowhere earlier, which is one more reason drafting locally is worth having.

---

## 8. What this does not decide

**The story layer.**\
An ordered list of beats with a stored cursor, scrubbable, replayable, authored over a finished document.\
The B188 survey captured intent for it and almost none of that intent is spent here.\
A beat in this document is a one-shot reveal attached to a commit; a beat in the survey is a step in a story.\
**Those were different things sharing a word, and the ruling separated them** (2026-09-04, recorded in `API.md`).\
A `beat` is the reveal specified here.\
The story layer's step is unnamed, and naming it is owed when that layer is designed -- the survey calls it a beat throughout, and is read with the amendment rather than rewritten.

**Skip.**\
Deferred.\
Dropping it removed the question of whether a read-only observer may truncate a reveal everyone else is watching.

**A queue bound.**\
Deferred, with correctness left to the author.\
An agent can put the canvas arbitrarily far behind the document.

**Multiple drafts.**\
Singular for now.\
Named drafts multiply every verb's addressing, and nothing has needed two.

**Auto-commit** on size, age or op count.\
Every variant reintroduces surprise; a draft commits when told.

---

## 9. Owed rulings

| # | Question | Owner |
|---|---|---|
| ~~W1~~ | **Vocabulary. RULED 2026-09-04 and recorded in `API.md`.** A `set` is a group of ops, a `beat` is a reveal, and the story layer's step is neither -- it is unnamed, and naming it is owed when that layer is designed. The B188 survey's `beat` means the story step throughout; that artifact is a ratified record and is read with the amendment rather than rewritten. | director |
| W2 | **PARTLY ANSWERED by use.** A reveal is replaced when the queue has drained (B193), so a document holds at most the beats of one playing schedule rather than every beat ever committed -- the unbounded-growth half of this question is closed. What remains is whether a SET is addressable after its beat is gone, which nothing has needed. Original: **Does a set outlive its beat, and how long does either persist?** A caption held until replaced means the most recent completed beat must survive. Retaining an id and touched-set per commit is bounded and small, but it is a step toward the chain-of-batches hypothesis and should be taken deliberately. | design |
| W3 | **What does `commit` return, and how is a set addressed afterwards?** Needed for inspection and for a beat to attach to an existing set. | design |
| ~~W4~~ | **Is `draw draft begin` built, or is `--draft` alone enough? BUILT 2026-09-04, and the measurement ran.** Six `place` ops authored both ways on the live estate produced identical documents -- 7 nodes, 7 distinct anchors -- so the mode is a convenience rather than a correctness matter, which is what the deferral wanted to know. It earns its place on the line count: the flag form repeats `--draft` once per op and the mode states the destination once. `--direct` escapes for a single write, and building it surfaced a real defect: `place` and `rm` tested `ctx.flags.draft` directly and were blind to the mode, so two staged ops resolved against the same pre-draft document and collided on one anchor. One `staging()` predicate now owns the question. | measurement |
| W5 | **Flag naming.** `--draft` reads well on a write and less well on a read, where `--projected` or `--pending` may say more. Symmetry argues for one word. | design |
| W6 | **Does a completed beat stay visible in the queue view?** Same question as W2 from the reporting side. | design |
| ~~W7~~ | **How does a relational op resolve inside a draft? RULED 2026-09-04: it does not -- the op carries INTENT and the server resolves at commit.** `plan()` already advances a projection between ops; what is missing is an op form naming a relationship, and the relational logic moving out of `cli/verbs.mjs` to where a transaction can use it. Section 7 carries the measurement. | director |
| ~~W8~~ | **Does `cli/` take a dependency on `model/`? CLOSED by the W7 ruling: no.** The tool stays standalone and `CLI.md` needs no amendment. | -- |
| ~~W9~~ | **What is the intent op's shape, and which relational verbs emit it? ANSWERED in section 7.** An `at:` clause naming a relationship, resolved by `planOne` into the `put` it would have received. Only position-resolving verbs need it -- reference resolution is already the server's. The kernel already exports the geometry; what is missing is SELECTION, which lives in `cli/verbs.mjs` alone and must move to where a transaction can reach it (**B189**). | design |
| ~~W10~~ | **Does the sovereign resolver land before or with H14.2? ANSWERED: before.** B189 shipped as its own row and H14.2 built on it, so the intent op had a resolver to call rather than one invented alongside it. | design |

---

## 10. Hypotheses on the record

Both were reached in the design conversation, both are more powerful than what is specified above, and both are deferred with a trigger rather than dismissed.

**Procedural ops.**\
The document as a function of time at the structural level -- ops genuinely arriving rather than pre-applied, so the document GROWS as a beat plays.\
Blocked on versioning: if content changes without a transaction then the version stops being a write counter, and **B185**'s `ifGenerationMatch`, conflict detection and `SEEN_MAX` are all comparing integers that would no longer mean what they mean.\
Every consumer would have to ask "as of when".
**Trigger:** needing to interact with a half-built document, which is the only thing atomic apply genuinely cannot do.

**The document as a chain of sets.**\
A uniform representation where an existing document is "set 0, no reveal" and state is a fold over ordered inputs.\
Requires retaining ops, which reverses H13's settled reasoning -- the log is a bounded ring, nothing rebuilds state by replaying it, and a joining client gets a snapshot rather than a history -- and it is **AG-5** of the B188 survey.\
Storage would grow with edit history rather than with entity count.
**Trigger:** wanting to replay how a document was BUILT, not just how a beat reveals.

---

## 11. Related records

- `CLI.md` -- the verb surface this extends, and the **GR18** rule that agentic interaction goes through the tool
- `TRANSACTIONS.md` -- durability, and the transaction machinery a set commits through
- `AUTHORITY.md` -- one writer per document, and the conflict surface a set inherits
- `API.md` -- the vocabulary W1 must land in
- **B188** -- the backlog row, and `dev/surveys/b188-beats-and-stories-survey.md` for captured intent
- **B181** -- the write budget this removes the pressure from
- **B186** -- `draw use`, the per-host target precedent a draft follows
- **B187** -- mandatory names, which is what makes intra-set references possible
