# draw -- the write model

The sovereign spec for HOW a change reaches a document: one op at a time, or a group authored locally and committed whole, with or without a paced reveal.

A design of record, written before the surface exists.\
It sits under `CLI.md`, which owns the verbs, and over `COMMIT.md`, which owns durability.\
`CLI.md` says what an agent can ask for; this says what happens between the asking and the document changing.

> **Status: DESIGN, no code written.**\
> Reached by design conversation on 2026-09-04, recorded here rather than built from the conversation.\
> Section 9 lists what is not settled and who owns each answer.

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

An op referring to something created earlier in the same set is the obvious case -- place a node, then link to it -- and the reference cannot be an id, because ids are server-minted 6 hex characters and a client-chosen one is a collision waiting to happen.

**B187 already solved this.**\
Every entity carries a mandatory name, `resolveId` matches on names, and names are unique across all five kinds.\
So an op refers to `web-01` and the server resolves it while applying, in order.

A forward reference -- naming something created later in the same set -- is a refusal, not a puzzle to solve.\
The set is refused whole, which is what atomic apply means.

**A draft validates structurally on append and semantically on commit.**\
The CLI can answer "is this a well-formed op with coherent flags" -- it already does for 60 verbs.\
It cannot answer "does this target exist, is this anchor free," and it should not try: `cli/` is standalone and cannot import the kernel (**B138**), and a draft that pre-validated semantically would be lying anyway, because the document can change between draft and commit.

---

## 8. What this does not decide

**The story layer.**\
An ordered list of beats with a stored cursor, scrubbable, replayable, authored over a finished document.\
The B188 survey captured intent for it and almost none of that intent is spent here.\
A beat in this document is a one-shot reveal attached to a commit; a beat in the survey is a step in a story.\
**Those are different things sharing a word, and the vocabulary is owed a ruling before either is built** (section 9).

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
| W1 | **Vocabulary.** "Beat" means a reveal here and a story step in the B188 survey. Three meanings appeared across one conversation, which is how the **B187** gap happened -- machinery under a word that meant different things in different places. Fix in `API.md` before schema. | director |
| W2 | **Does a set outlive its beat, and how long does either persist?** A caption held until replaced means the most recent completed beat must survive. Retaining an id and touched-set per commit is bounded and small, but it is a step toward the chain-of-batches hypothesis and should be taken deliberately. | design |
| W3 | **What does `commit` return, and how is a set addressed afterwards?** Needed for inspection and for a beat to attach to an existing set. | design |
| W4 | **Is `draw draft begin` built in the first slice, or is `--draft` alone enough to learn from?** Whether per-op verbosity is acceptable to an agent authoring forty ops is empirical -- driving the spine-leaf demo through the explicit form answers it in one session. | measurement |
| W5 | **Flag naming.** `--draft` reads well on a write and less well on a read, where `--projected` or `--pending` may say more. Symmetry argues for one word. | design |
| W6 | **Does a completed beat stay visible in the queue view?** Same question as W2 from the reporting side. | design |

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
- `COMMIT.md` -- durability, and the transaction machinery a set commits through
- `AUTHORITY.md` -- one writer per document, and the conflict surface a set inherits
- `API.md` -- the vocabulary W1 must land in
- **B188** -- the backlog row, and `docs/surveys/b188-beats-and-stories-survey.md` for captured intent
- **B181** -- the write budget this removes the pressure from
- **B186** -- `draw use`, the per-host target precedent a draft follows
- **B187** -- mandatory names, which is what makes intra-set references possible
