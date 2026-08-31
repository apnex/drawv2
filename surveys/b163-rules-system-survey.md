---
# Survey envelope — captures stakeholder intent BEFORE a design is committed.
# Scaffolded by survey-init.sh. Placeholders in <angle-brackets> are unfilled;
# validate-envelope.sh rejects any pick/required-field still left as <...>.
survey-title: B163 -- the rules system, and how far it should reach
work-item: B163
methodology-source: mission-kit K5-survey (pinned copy at ~/.config/opencode/skills/survey)
lifecycle-handoff:
  from: intent-open
  to: intent-captured
  authority-ref: Director, in-session pick responses to Round 1 and Round 2, 2026-09-01
  planning-input-ref: self
stakeholder-picks:
  round-1:
    Q1: c
    Q1-rationale: a programmable geometric engine; chosen over the proposer's recommended middle option
    Q2: abc
    Q2-rationale: defect-class elimination, zero ambiguity and optionality; cost-to-ship explicitly not selected
    Q3: a
    Q3-rationale: probe first, then commit; buy evidence before ruling on mechanism
  round-2:
    Q4: abcd
    Q4-rationale: all four falsifiers in scope, plus a free-text rider promoting tower defence to pilot use case, requiring the slice itself to be expressible as a sovereign decoupled mod, and rejecting the assumption that the surface is a table
    Q5: c
    Q5-rationale: table, situation and a reserved ephemeral tier; one step beyond the proposer's recommendation, still no clock
    Q6: c
    Q6-rationale: browser and server both; the situation must serialise across a process boundary
# classification is OPTIONAL. Delete this key if your project has no work-item
# taxonomy. If you keep it and set SURVEY_CLASSES (env) or --classes, the value
# must be one of that pipe-separated set; otherwise any non-placeholder string passes.
classification: platform-surface design (upgraded from defect fix during the survey)
outcome-axis:
  # Proposer-drafted from evidence in the tree and offered at Round 1; NOT yet
  # corrected or confirmed by the director. See flag F7.
  primary: [AX4 optionality]
  secondary: [AX1 defect-class elimination, AX2 zero ambiguity, AX3 agentic reach]
  round-1:
    primary: [AX4 optionality]
    secondary: [AX1 defect-class elimination, AX2 zero ambiguity]
  round-2:
    primary: [AX3 agentic reach, AX4 optionality]
    secondary: [AX1 defect-class elimination, AX2 zero ambiguity]
axiom-principle-anchors:
  # Free-form axiom/principle/goal anchors. These must also be explained in the
  # Round 1, Round 2, and final intent prose sections; labels alone are not enough.
  primary: [A3 sovereign composition]
  secondary: [A5 perceptual parity, A11 cognitive minimalism (held as a brake), A4 zero-loss knowledge]
  round-1: [A3 sovereign composition, A2 isomorphic specification]
  round-2: [A3 sovereign composition (strongest form), A5 perceptual parity]
anti-goals-count: 6
flags-count: 7
calibration-data:
  stakeholder-time-cost-minutes: 0
  comparison-baseline: none — first survey run in this repository, and first use of K5 by this proposer
  notes: >-
    Time cost was NOT measured; the zero above is a placeholder the schema
    requires an integer for, and the prose calibration section says so plainly
    rather than letting the number be read as a measurement. Measure it next run.
    The method paid for itself at Round 1: three of four unanswerable mechanism
    questions became derived consequences without being asked. Both multi-picks
    were informative through omission — declining cost-to-ship is what makes the
    enlarged Round-2 scope coherent. The strongest result came from free text,
    not a pick: full saturation of a pick-list (Q4, all four) is itself a signal
    the question was too narrow. Proposer recommendations were wrong toward the
    conservative option on three of six questions.
contradictory-constraints:
  - round: 2
    questions: [Q4, Q5]
    picks: [a, c]
    constraint-envelope: the state-tier split must be falsifiable while nothing runs at frame rate, so the probe's evidence is expressibility and static analysis rather than observed runtime behaviour
  - round: 2
    questions: [Q4, Q6]
    picks: [abcd, c]
    constraint-envelope: every falsifier in scope plus the most demanding portability; satisfiable only if situation portability is proven FIRST, since a live-object situation would pass the other three falsifiers and then fail portability
---

# B163 -- the rules system, and how far it should reach — Survey envelope

**Methodology:** mission-kit `K5-survey` (2-round, 3-orthogonal-questions-per-round pick-list)
**Work item:** B163
**Classification candidate:** platform-surface design (upgraded from defect fix during the survey)
**Lifecycle handoff:** `intent-open -> intent-captured` only; this envelope grants no design, seed, implementation, or delivery effect.

---

## §0 Context

**Source work-item text** (provided at survey init):

> B163 -- a rule cannot be chosen by the situation.

A rule is chosen today by the event and by three guards. `resolveKey` filters each of
the 31 `KEYMAP` rows on `mutates`, `duringHelp` and `duringGesture`, then asks
`r.when(evt, ctx)`. The `ctx` it receives is `{ readOnly, helpOpen, gesturing }`: three
guards and no subject. Zero of the 31 predicates read `ctx` at all.

So a rule that can be stated in one sentence -- "a closed link is selected and `f` is
pressed, therefore fill" -- has nowhere to be written as a row. It lands as a branch
inside the verb it belongs to. Three handler bodies already test `kindOf`,
`selection.size()` or the hovered kind before deciding what they mean.

Three is small. The 243-line ladder that produced B18, B37 and B42 began the same way,
and the shape is identical one level up: dispatch was made data and the CONDITION was
left as code, so two overlapping conditions resolve by position with nothing saying so.

The other half is duplication. "What is legal right now" is answered twice -- once by
the table, once by 21 hand-written rows in `index.html` that no gate compares against
it, and nothing outside `keymap.js` imports `KEYMAP`. H10.6 reconciled the two for the
key `7` and is DONE; it fixed that key and left the mechanism.

`docs/spec/RULES.md` is the design-of-record, DRAFT and RULING-OWED. It proposes a
situation object, a closed condition vocabulary, a rule table, and a projection rule
(one table answers dispatch, generated help, and later a menu). Six invariants, each
the negation of a defect this tree has had.

The director has since reframed the target: drawv2 as a programmable geometric engine
with a first-class surface for mods -- behaviours triggered by click, hover, select and
place, in the Factorio / OpenTTD / Minecraft sense, stress-tested against a
tower-defence game. Not to be built now, but not to be foreclosed. Recorded as section
7 of the spec.

Q2 is ruled: no context menu in this slice.

THREE QUESTIONS REMAIN OWED, and the director has stated he cannot answer them as
posed:

Q1 -- does the situation include hover, or selection only?
Q3 -- is an overlapping rule pair always a gate failure, or may a row declare
      `overrides:`?
Q4 -- is the section 7 requirement binding now: the situation model-level,
      serialisable and DOM-free?

Constraints already measured. No clock exists: zero `requestAnimationFrame` and zero
`setInterval` across `app/src`, `kernel` and `engine`. `server/log.mjs:27` caps history
at `LOG_MAX = 100` records with oldest-first eviction, so any state driven through the
transaction boundary at frame rate destroys real history. `engine/ivm.mjs` is a generic
maintained reverse index awaiting a second tenant. `main.js:56` already calls
`draw:action` "the self-hosting interface".

**Provenance.**\
The item was not raised as a feature request.\
It began when the director, reasoning aloud about context-aware behaviour -- *"if link selected, and link is closed, and I press something, then fill"* -- asked whether the system was set up for declarative programmable rules without the mess.\
Investigation found it was not: `B163` was filed with `[V, file:line]` evidence, and `docs/spec/RULES.md` was authored against **W14** as the design-of-record, using `docs/spec/INPUT.md` as the exemplar per **M6**.\
The director then reframed the target as a programmable geometric engine with a first-class mod surface, which became section 7 of that spec.

**Why a survey was run.**\
The spec closed with four questions owed a ruling, and the director stated he could not answer them as posed and asked for a guided deliberation.\
That is the exact condition **K5** names: questions pitched below the altitude at which intent lives.\
The methodology anchor is therefore K5, and the survey's job was to fix the altitude rather than to collect more answers.

**Related items.**\
`B163` (source, `RULING-OWED`), `H10.34` (board), `H10.6` (`DONE`, and the prior hand-repair of the same drift), `B18` / `B37` / `B42` (the defect class), `B108` / `H11.4` (open, and directly relevant to validating the acceptance bar this envelope sets), `H9.9` templates and `W5` run mode (the two existing surfaces a mod tier would most plausibly absorb).

---

## §1 Round 1 picks

**Outcome axes for this survey** (proposer-drafted from evidence in the tree, offered to the director for correction; uncorrected at Round 1 close): **AX1 defect-class elimination**, **AX2 zero ambiguity** (`DESIGN.md`'s product bar), **AX3 agentic reach** (GR18), **AX4 optionality** (A14 capital-forward), **AX5 cost to ship**.

| Q | Pick | Intent reading (1-line summary) |
|---|---|---|
| Q1 — ambition / what drawv2 becomes | **C** A programmable geometric engine | Interactive behaviour is the product; the editor is one consumer of the rules surface, not the whole of it |
| Q2 — what this slice optimises | **A** kill the defect class + **B** zero ambiguity + **C** optionality | Three of four, and the one declined is the informative part |
| Q3 — how to proceed | **A** Probe first, then commit | Buy evidence before ruling on mechanism; a throwaway probe is cheaper than a wrong lock |

### §1.Q1 — Per-question interpretation

The director selected the **most** ambitious option available, against a proposer recommendation of the middle one.\
That is the single most consequential fact in this round, and it must not be softened: the proposer's reading before the survey was that *"I do not want to build an entirely new mechanism just now"* meant ambition should be capped and the seam merely left open.\
The pick says the opposite about the TARGET while the earlier statement still stands about the TIMING.

Read against the work item, this converts three of the four owed questions from open rulings into consequences.\
If the editor is one consumer among several, then the situation object is a shared surface rather than an `input.js` private, and the section 7 requirement stops being a speculative cost and becomes structural.\
Primary axis **AX4 optionality**; secondary **AX3 agentic reach**, since a second consumer of the rules surface is exactly the position an agent occupies.

### §1.Q2 — Per-question interpretation

Three picks of four, and the omission carries the signal: **AX5 cost to ship was NOT selected**.\
Taken with Q1, this is a stated willingness to spend now to avoid a rewrite later, which is consistent with the whole register discipline this tree already runs on.

The combination of **AX1** and **AX2** is stronger than either alone and resolves the `overrides:` question without needing to ask it.\
A silent precedence win between two matching rules is *simultaneously* a live defect class and an ambiguity between what the table says and what the machine does.\
Selecting both axes makes a hard gate failure the only consistent answer.\
Primary axes **AX1**, **AX2**, **AX4**; **AX5** explicitly deprioritised.

### §1.Q3 — Per-question interpretation

Choosing to probe rather than to lock is the same instinct the tree already encodes as house discipline: measure rather than assert.\
It is also the correct response to the proposer's own failure mode, which is a check or a claim whose scope is narrower than its subject -- a probe has a falsifier, a spec paragraph does not.

Read with Q1, the probe acquires a specific burden it would not otherwise carry.\
If the target is an engine, the probe must stress the ENGINE claim, not merely the editor claim -- which means a rough tower-defence sketch is not decoration in the probe, it is the part that can actually fail.\
Primary axis **AX4**; secondary **AX1**.

**Round-1 composite read**: the director wants an engine, is willing to pay for it in everything except a rewrite, and wants the mechanism decided by evidence rather than by ruling -- which converts the three owed questions into derived answers and moves the real uncertainty to the boundary of THIS slice.\
**Tension flagged for Round 2:** *"a programmable geometric engine"* (Q1) sits against the director's earlier and unretracted *"I don't want to build an entirely new mechanism just now"*, so the ambition is settled while the slice boundary is not, and Round 2 must fix the boundary rather than re-open the ambition.

**Round-1 axiom / principle anchoring**: the round advances **A3 sovereign composition** -- a rules surface with more than one consumer is a boundary, not a branch -- and **A2 isomorphic specification**, since the help-overlay drift is already a declared-intent-versus-running-reality failure that the AX2 pick refuses to tolerate.\
It tensions **A11 cognitive minimalism**: an engine ambition invites more mechanism than the defect strictly requires, and section 6 of the spec is the brake that must be held on deliberately rather than quietly relaxed.

---

## §2 Round 2 picks

| Q | Pick | Round-1 aggregate relation | Intent reading (1-line summary) |
|---|---|---|---|
| Q4 — what the probe must falsify | **A + B + C + D**, plus a free-text rider | **challenges** | All four falsifiers in scope, and the rider rejects the proposer's assumed solution shape outright |
| Q5 — the boundary of this slice | **C** table, situation, and a reserved ephemeral tier | **deepens** | One step beyond the proposer's recommendation: the state-tier split is settled in the design, still with no clock |
| Q6 — where a mod eventually runs | **C** browser and server both | **deepens** | The most demanding portability available; the situation must serialise across a process boundary |

### §2.Q4 — Per-question interpretation

The director selected **every** falsifier and then added the load-bearing content as free text, which is the strongest possible signal that the pick-list itself was too narrow.\
The rider, recorded verbatim in the work item and reproduced here because paraphrase would destroy it: *"I want to consider the Tower Defense scenario as the pilot use case to drive the design. In theory - the entirety of the slice we are targeting should be able to be programmed into our app as a sovereign / decoupled mod - we should probably spend some time thinking about the best/perfect target state to support this programmability surface, and consider whether we should take inspiration from computer games, or kubernetes or other related ecosystems for the surface - rather than blindly assume this will be a table."*

Three distinct instructions are compressed in there and each one moves the design.\
First, **tower defence is promoted from stress case to pilot use case** -- it drives the design rather than testing it afterwards.\
Second, **the editor's own behaviour must be expressible as a sovereign mod on the surface** -- this is the *base game is a mod* test that Factorio passes and Minecraft does not, and it is a far harder and far better falsifier than anything the proposer offered.\
Third, and most directly: **the rule table is demoted from design-of-record to one candidate among several**, with prior art named as the way to choose. The proposer arrived at a table by fixing a defect, which is a legitimate route to a local answer and an illegitimate route to a platform surface. Primary axes **AX4**, **AX1**; the rider is a direct challenge to the proposer's own §3 of `docs/spec/RULES.md`.

### §2.Q5 — Per-question interpretation

Choosing option C over the recommended B settles the document-versus-ephemeral split **inside this slice** rather than deferring it, while still withholding the clock.\
That is a coherent and quite precise line: the hardest *design* question is answered now, and the hardest *engineering* commitment is not taken.

Read against the measured constraint, this is the right place to draw it.\
`server/log.mjs:27` caps history at `LOG_MAX = 100` with oldest-first eviction, so which state is transactional is not a preference but a correctness property -- getting it wrong destroys undo. Reserving the tier without building a clock means the split can be designed and validated against the tower-defence pilot on paper before anything runs at frame rate. Primary axis **AX4**; secondary **AX2**, since a state tier that is undefined is exactly the kind of ambiguity `DESIGN.md` refuses.

### §2.Q6 — Per-question interpretation

This is the most demanding of the four options and it retires the *"trusted, browser-only, authored by you"* simplification the proposer recommended.\
A situation that must serialise across a process boundary cannot be a live object graph with model references; it becomes a value, with a schema, versioned like every other wire shape in this tree.

Taken with the Q4 rider it is also consistent rather than merely ambitious.\
If behaviour must run headless, then GR18 and **AX3 agentic reach** apply to the rules surface directly: an agent is precisely a non-editor consumer, and `main.js:56`'s *self-hosting interface* comment already anticipated a consumer that is not the person clicking. Primary axis **AX3**; secondary **AX4**.

**Round-2 composite read**: Round 2 did not refine Round 1, it **enlarged** it -- the director took the harder option on every question, promoted tower defence to the pilot that drives the design, required the editor's own behaviour to be expressible as a decoupled mod, and explicitly instructed that the solution shape be chosen from prior art rather than inherited from the defect that started this.\
The practical consequence is that the design phase cannot begin: a prior-art pass is now a prerequisite, and `docs/spec/RULES.md` section 3 must be demoted from design-of-record to candidate before it misleads a future reader.

**Round-2 axiom / principle anchoring**: the round advances **A3 sovereign composition** to its strongest form -- the surface is a boundary the editor itself must sit behind, not merely a table the editor owns -- and puts **A5 perceptual parity** in play, since a headless consumer and the editor must perceive the same situation or they will diverge.\
It sharpens the **A11** tension flagged in Round 1 rather than resolving it: the *base game is a mod* requirement is the discipline that keeps an engine ambition from becoming unbounded mechanism, because a surface too baroque to express the editor's own behaviour fails its own test.

---

## §3 Composite intent envelope

**The derived intent is a programmability surface, not a rules table.**\
drawv2 is to be treated as a programmable geometric engine whose editor is one consumer among several, and whose behaviours -- triggered by click, hover, select and place -- are programmed against a surface rather than compiled into verbs.\
Tower defence is the pilot use case that drives the design, not a test applied afterwards.\
The acceptance bar the director set is the strongest one available and it is the centre of this envelope: **the entirety of the targeted slice must be expressible as a sovereign, decoupled mod on the surface it defines.** The editor's own behaviour is the first mod, or the surface has failed.

**The proposer's solution shape is explicitly not adopted.**\
`docs/spec/RULES.md` reached an ordered rule table by fixing a defect, and the director has ruled that a platform surface may not be inherited from a defect fix.\
The shape must instead be selected from prior art -- game modding ecosystems and control-plane ecosystems were both named -- and the choice justified.\
This is a genuine reversal of the design-of-record and is recorded as flag **F1**.

**Three constraints bound the design and are already measured.**\
The situation must serialise across a process boundary, because behaviour must run headless as well as in the browser, which makes it a versioned wire shape rather than a live object graph.\
The document-versus-ephemeral state split must be settled in this slice, because `server/log.mjs:27` caps history at `LOG_MAX = 100` with oldest-first eviction and a mis-assignment destroys undo rather than merely performing badly.\
No clock is built, which means the ephemeral tier is designed and validated on paper against the pilot rather than demonstrated at runtime -- a both-at-once constraint carried forward in `§contradictory`.\
Primary outcome **AX4 optionality**; secondary **AX1 defect-class elimination**, **AX2 zero ambiguity**, **AX3 agentic reach**; **AX5 cost to ship** explicitly deprioritised across both rounds.

**Final axiom / principle anchoring:** the envelope rests on **A3 sovereign composition** in its strongest form -- the surface is a boundary the editor itself must sit behind -- and on **A5 perceptual parity**, since a headless consumer and the editor must be handed the same situation or they will silently diverge.\
It is held in check by **A11 cognitive minimalism**, and the *base game is a mod* bar is precisely the mechanism that keeps an engine ambition from becoming unbounded: a surface too baroque to express the editor's own behaviour has failed its own test, which makes A11 falsifiable here rather than aspirational.\
**A4 zero-loss knowledge** governs the handling of the Q4 rider, which is carried verbatim rather than summarised, because the instruction *not to assume a table* is the part most likely to be lost in paraphrase.

---

## §4 Scope summary

| Axis | Bound |
|---|---|
| Title | B163 -- the rules system, and how far it should reach |
| Classification | platform-surface design, upgraded from a defect fix during the survey |
| Location / scope | `docs/spec/RULES.md`; `app/src/keymap.js`; `app/src/recognize.js`; `app/src/input.js`; `engine/`; `model/`; a prior-art artefact not yet written |
| Primary outcome | A programmability surface on which the editor's own behaviour is expressible as a sovereign, decoupled mod, with tower defence as the pilot that drives the design |
| Secondary outcomes | Retire the B18/B37/B42/B163 defect class structurally; generate the control documentation rather than hand-writing it; settle the document-versus-ephemeral state split |
| Outcome-axis (primary) | AX4 optionality |
| Outcome-axis (secondary) | AX1 defect-class elimination, AX2 zero ambiguity, AX3 agentic reach |
| Outcome-axis (Round-1) | primary: AX4; secondary: AX1, AX2 |
| Outcome-axis (Round-2) | primary: AX3, AX4; secondary: AX1, AX2 |
| Axiom/principle anchors | primary: A3 sovereign composition; secondary: A5 perceptual parity, A11 cognitive minimalism (as a held brake) |
| Axiom/principle anchors (Round-1) | A3, A2; tensions A11 |
| Axiom/principle anchors (Round-2) | A3 (strongest form), A5; sharpens the A11 tension and makes it falsifiable |

---

## §5 Anti-goals (out-of-scope; deferred)

| AG | Description | Composes-with target |
|---|---|---|
| AG-1 | ~~**A clock.** No `requestAnimationFrame`, no tick, no scheduler.~~ **OVERRIDDEN by the director, 2026-09-01, and recorded rather than left to drift.** The pilot he specified -- an endpoint that spawns movers along its path on an interval -- cannot exist without one. The override is narrower than the anti-goal it replaces: a clock that drives a DERIVED view is far weaker than a clock that drives mutable state, and the mutable tier stays out (see AG-6) | `H12` -- the clock arrives as one agreed `now()` seeded from the server, because parity was ruled desirable and a per-machine clock cannot deliver it |
| AG-6 | **Mutable per-mover state.** Raised with the override above, to keep what AG-1 was actually protecting. A mover is a closed form of time, so nothing deviates, nothing is stored, and the transaction log is untouched | The sparse-overlay tier in `§3`; arrives when a mover must take damage, be slowed, or die early -- which is the first thing tower defence needs that this pilot does not |
| AG-2 | **A mod loader, sandbox or trust model.** Nothing loads, isolates or authorises third-party code in this slice. | Follows a decision on third-party authorship, which Q6 did not settle -- it settled the process boundary, not the trust boundary |
| AG-3 | **The context menu.** Ruled out by the director at Q2 of the first pass, before this survey. | A later projection of whatever surface is chosen |
| AG-4 | **Runtime-authored editor dispatch.** The editor's own bindings stay source-gated even if mods are dynamic. | Revisit only if the *base game is a mod* bar makes the distinction untenable, which is a real possibility and is flagged as F6 |
| AG-5 | **Retrofitting existing verbs.** Migrating all 31 keymap rows onto the new surface is not in the pilot. | A follow-on migration once the surface is chosen and proven on the pilot |

---

## §6 Flags / open questions for the design phase

Open questions and risks surfaced during interpretation, each with a recommendation
to challenge during design review.

| # | Flag | Recommendation |
|---|---|---|
| F1 | **`docs/spec/RULES.md` is now partly superseded by the survey that was run to validate it.** Section 3 presents an ordered rule table as the design-of-record; the director has demoted it to one candidate. A reader who finds the spec without this envelope will be misled. | Amend the spec's status block and section 3 to name the table a CANDIDATE pending the prior-art pass, and cross-reference this envelope. Do it before any other work, because the cost of leaving it is a wrong build by whoever reads it next. |
| F2 | **The work item has outgrown its register row.** B163 is a defect -- a rule cannot be chosen by the situation -- and what this envelope describes is a platform surface. Keeping them as one row means the defect cannot be fixed until the platform is designed. | Split. Keep B163 as the defect with its own narrow fix, and raise a separate item for the programmability surface. Let the director decide whether the defect waits for the platform or is fixed ahead of it. |
| F3 | **A prior-art pass is now a prerequisite and does not exist.** The director named game modding and Kubernetes as inspiration sources; neither has been examined. Choosing a surface without it would reproduce exactly the error the rider objects to. | Run a bounded prior-art artefact under the K4 research-artefacts discipline before any design. Candidate substrates: Factorio (base game is a mod), Minecraft Forge, OpenTTD, an ECS, the Kubernetes control plane (CRD, controller, admission, informer), and a policy language such as CEL or OPA. |
| F4 | **The strongest acceptance test is currently prose.** *"The entirety of the slice must be expressible as a sovereign, decoupled mod"* is the best falsifier in this envelope and has no mechanical form. | Make it the pilot's gate: a named set of editor behaviours must be expressed as a mod with no privileged access, and a test must fail if any of them needs an escape hatch. |
| F5 | **A serialisable situation and a live-object situation are different designs.** Q6 requires the former; the spec's section 2 sketch assumed the latter, with methods and model access. | Treat the situation as a versioned wire shape with a schema, in the same register as every other wire shape here. Expect the predicate sketch in the spec to change shape, not merely move. |
| F6 | **The *base game is a mod* bar may collide with anti-goal AG-4.** If the editor's behaviour is a mod, and mods are dynamic, then editor dispatch is dynamic -- which contradicts the spec's bound that editor dispatch stays source-gated. | Do not resolve by preference. The prior-art pass should report how the named ecosystems handle exactly this: Factorio ships the base game as a mod yet still gates it, and how it does so is directly instructive. |
| F7 | **The outcome axes were proposer-drafted and never corrected.** They were offered to the director at Round 1 and neither confirmed nor amended, so every axis mapping in this envelope rests on the proposer's reading of the tree rather than a stated goals framework. | Have the director confirm or amend AX1-AX5 at ratification. If any axis is wrong, the mappings in §1 and §2 need re-reading, not just re-labelling. |

---

## §7 Sequencing / cross-work considerations

### §7.1 Branch + review strategy

Work lands on `main` directly, as everything in this tree does, gated by `npm run gate` (674 tests, nine scanners) and by the director's review of each commit.\
The prior-art artefact (F3) is documentation and should land as its own commit before any code, matching the register-before-implementation discipline already in force.

### §7.2 Composability with concurrent / pending work

**B163** is the source row and is `RULING-OWED`; F2 recommends splitting it.\
**H10.3 / B74** (durable status surface) is ranked above this on the board and is untouched by it.\
**B108 / H11.4** -- no check can see a test that reimplements its subject -- is directly relevant: the *base game is a mod* bar is a test whose subject is the whole surface, and B108 is the open question of how such a test is validated at all.\
**H9.9 templates** and **W5 run mode** are the two existing surfaces a mod tier would most plausibly absorb; `main.js:56` already frames run mode as *the self-hosting interface*.\
`engine/ivm.mjs` carries an explicit promote-on-second-tenant rule, and a mod surface is a candidate second tenant.

### §7.3 Compressed-timeline candidate?

**No, and the survey is the reason.**\
The work arrived looking like a defect fix with three open questions and leaves as a platform surface with a prerequisite research pass and a reversed design-of-record.\
Collapsing phases here would mean choosing the surface shape without the prior art, which is the specific error the Q4 rider was raised to prevent.\
**Risk flag for the director:** AX5 cost to ship was declined twice, so this is expected to be slower than the original slice, and the defect it started from is still live in the meantime -- which is what F2 exists to address.

---

## §calibration — Calibration data point

Captures an empirical baseline for the methodology-evolution loop.

- **Stakeholder time-cost (minutes):** not captured. Both rounds were answered in a single sitting each, with no elapsed-time measurement taken. Recording this is a gap in the proposer's execution, not a property of the method, and it should be measured on the next run rather than estimated here.
- **Comparison baseline:** none. First survey run in this repository, and the first use of K5 by this proposer.
- **Notes:** The method paid for itself at Round 1. The director had stated plainly that four mechanism questions were unanswerable as posed; going up one altitude converted three of the four into derived consequences without asking about any of them, which is precisely the failure K5 names -- questions pitched below the altitude at which intent lives.\
  Both multi-pick questions were informative through what was NOT selected: declining AX5 cost to ship at Q2 is the reason the enlarged Round-2 scope is coherent rather than contradictory.\
  The strongest single result came from free text, not from a pick. The Q4 rider reversed the proposer's design-of-record, and the pick-list beside it -- all four options selected -- carried almost no information by comparison. The lesson is that a pick-list saturated on every option is itself a signal the question was too narrow, and the proposer should treat full saturation as a prompt to ask what the list omitted.\
  The proposer's recommendations were wrong in the same direction on three of six questions (Q1, Q5, Q6), each time toward the more conservative option. Worth carrying into the next survey as a known bias rather than a coincidence.

---

## §contradictory — Contradictory multi-pick carry-forward

(Fill ONLY when a multi-pick signals a both-at-once constraint. Otherwise omit this section entirely.)

| Round | Question(s) | Picks | Constraint envelope description |
|---|---|---|---|
| 2 | Q4, Q5 | **A** (state-tier split must be falsifiable) + **C** (no clock in this slice) | The probe must be able to FALSIFY the document-versus-ephemeral split while nothing runs at frame rate. Both are satisfiable together only if the probe's evidence is expressibility and static analysis rather than observed runtime behaviour: express the tower-defence pilot's state completely, classify every piece as document or ephemeral, and show that the document half stays within `LOG_MAX = 100` under realistic play while the ephemeral half never touches the transaction boundary. A runtime demonstration is out of scope by AG-1, so the probe's falsifier is *"a piece of pilot state that cannot be classified, or whose classification breaks the log budget"*. |
| 2 | Q4, Q6 | **all four** + **C** (browser and server both) | Every falsifier in scope AND the most demanding portability. Common-satisfiable only if situation portability (Q4-C) is proven first, since it constrains the shape of everything the other three falsifiers test -- a live-object situation would pass the vocabulary and end-to-end tests and then fail portability, invalidating both. Sequence the probe portability-first. |

---

## §8 Cross-references

- **mission-kit `K5-survey`** — the survey methodology this followed, installed as a pinned copy at `~/.config/opencode/skills/survey`
- **mission-kit `K4-research-artefacts`** — the discipline the prerequisite prior-art pass (F3) should run under
- **mission-kit `W14`** — the design-of-record work-type `docs/spec/RULES.md` was authored against, and whose falsifier the F1 amendment must continue to satisfy
- **B163** — source work item, `RULING-OWED`, recommended for splitting under F2
- **`docs/spec/RULES.md`** — the design-of-record this survey partly reverses; see F1
- **`docs/BOARD.md` H10.34** — the board item, and the `Decisions required` row carrying B163
- **B108 / H11.4** — open: no check can see a test that reimplements its subject; bears directly on how the *base game is a mod* bar is validated

---

— Proposer: agent (opencode) / 2026-09-01 (Survey envelope; 8 picks plus one free-text rider ratified across 2 rounds)
