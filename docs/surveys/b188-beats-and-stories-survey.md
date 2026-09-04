---
survey-title: Beats, stories and progressive visual disclosure
work-item: B188
methodology-source: mission-kit skill K5 survey (two-round, three-orthogonal-questions-per-round pick-list)
lifecycle-handoff:
  from: intent-open
  to: intent-captured
  authority-ref: Director, live session 2026-09-04, "Run the survey"
  planning-input-ref: self
stakeholder-picks:
  round-1:
    Q1: a
    Q1-rationale: Story is a lens over a document; entities stay in the document.
    Q2: a
    Q2-rationale: Everything exists at commit; visibility is derived.
    Q3: abcd
    Q3-rationale: All four consumption modes must hold -- live, self-paced, late arrival, unattended.
  round-2:
    Q4: a
    Q4-rationale: The story stores a cursor; playback advances it.
    Q5: a
    Q5-rationale: Render what remains and report the story stale.
    Q6: a
    Q6-rationale: CLI-first authoring; the canvas plays but does not author.
classification: feature
outcome-axis:
  primary: [AX1 comprehension, AX2 derivation integrity, AX5 consumption modes]
  secondary: [AX3 agent authorability, AX4 reuse]
  round-1:
    primary: [AX2 derivation integrity, AX4 reuse, AX5 consumption modes]
    secondary: [AX1 comprehension]
  round-2:
    primary: [AX5 consumption modes, AX3 agent authorability]
    secondary: [AX2 derivation integrity, AX4 reuse]
axiom-principle-anchors:
  primary: [A2 isomorphic specification, A5 perceptual parity]
  secondary: [A11 cognitive minimalism, A1 sovereign state transparency, GR18 CLI-only agentic surface]
  round-1: [A2 isomorphic specification, A5 perceptual parity]
  round-2: [A1 sovereign state transparency, GR18 CLI-only agentic surface, A11 cognitive minimalism]
anti-goals-count: 6
flags-count: 8
calibration-data:
  stakeholder-time-cost-minutes: 6
  comparison-baseline: B163 ordered-rule-table survey; B178 spawner survey
  notes: >-
    Every pick landed on the proposer's recommended option, which is a weak
    signal -- either the conversation had already converged the intent before
    the instrument ran, or the recommendations anchored the answers. The
    preceding design conversation makes the first more likely, but the
    instrument cannot distinguish them and should not be read as independent
    confirmation. The one genuinely load-bearing answer was Q3, the only
    multi-pick and the only question with no recommendation attached: taking
    all four consumption modes forced Q4 to exist and converted a vague
    "pacing" idea into a concrete cursor-versus-clock ruling. Design
    recommendation for future rounds: withhold the recommendation marker on
    questions whose answer the proposer most wants to test.
contradictory-constraints:
  - round: 1
    questions: [Q3]
    picks: [a, b, c, d]
    constraint-envelope: >-
      Live narration wants manual interruptible control, unattended playback
      wants declared per-beat duration, self-paced reading wants private random
      access, and late arrival wants position to be independent of wall-clock
      time. These cannot be one mechanism. The satisfiable envelope is a stored
      ordinal cursor as the single notion of position, with duration as a
      per-beat property that an optional advancing agent consumes, and private
      viewer position deferred to a later composable increment.
---

# Beats, stories and progressive visual disclosure -- Survey envelope

**Methodology:** mission-kit skill K5 survey (2-round, 3-orthogonal-questions-per-round pick-list)
**Work item:** B188
**Classification candidate:** feature
**Lifecycle handoff:** `intent-open -> intent-captured` only; this envelope grants no design, seed, implementation, or delivery effect.

---

## S0 Context

B188 arises from a live design conversation following the ratification of `VISION.md` on 2026-09-03.\
The director asked for a first-class stored entity holding a paced group of ops, named `beat` after choosing from `step`, `scene`, `beat` and `act`, later composable into a `timeline`.\
The framing that raised the survey was agent-delivered long-duration complex visual technical stories: multiple stages, a declared caption per beat, explaining something like a polyglot distributed architecture through progressive visual disclosure.

The survey was run because the preceding conversation had assembled a substantial design -- beats, cursor, captions, visible sets, position overrides, story-as-lens, timeline -- entirely from the proposer's reading.\
B163 established that a platform surface may not be invented from a single instance, and both B163 and B178 measurably changed shape once intent was captured rather than inferred.\
This is a larger surface than either.\
Three semantic readings of a beat were open at survey start: A, beat-as-record where entities exist at commit and unfurl is replay; B, beat-as-program where entities do not exist until played; C, entities exist and visibility is derived.

The outcome axes for this survey are consumer-supplied for the work item: AX1 comprehension, does a human understand a complex system faster because of this; AX2 derivation integrity, does it hold the vision's line that geometry carries and storage does not; AX3 agent authorability, can an agent compose a story through the CLI without a canvas; AX4 reuse, does one document support many stories and one story survive the document changing; AX5 consumption modes, are live narration, self-paced reading, late arrival and unattended playback all served.

---

## S1 Round 1 picks

| Q | Pick | Intent reading (1-line summary) |
|---|---|---|
| Q1 -- Story ownership | **a** A lens over a document | Story holds beats, cursor and captions; entities stay in the document untouched. |
| Q2 -- Disclosure mechanism | **a** Everything exists; visibility is derived | Reading C ruled; commit creates all entities, a beat declares emphasis, rendering derives it. |
| Q3 -- Who is watching | **a,b,c,d** All four modes | Live narration, self-paced reading, late arrival and unattended playback must all hold. |

### S1.Q1 -- Per-question interpretation

The director chose reuse over simplicity.\
A lens means the document remains the single source of structure and a story is a view over it, so one architecture can carry an onboarding walkthrough and an incident post-mortem without duplicating entities.\
This directly advances AX4 and is consistent with the ratified vision's asymptote that geometry carries more and stores less, with a beat declaring which geometry matters right now.

The pick commits the design to a cost the alternatives would have avoided.\
A lens can go stale: the document can change beneath a story, and a beat referencing a deleted entity becomes a real state requiring a ruled answer rather than an edge case.\
Rejecting option b, a sixth entity kind, also rejects the simplest build and the free inheritance of undo and versioning, which means story mutation semantics must be specified rather than inherited.\
Q5 was authored specifically to close the staleness question this pick opened.

### S1.Q2 -- Per-question interpretation

This is the ruling on the A/B/C question held open through the design conversation, and it selects C. Every entity exists from commit; a beat declares which are emphasised or dimmed; a renderer derives the visible state.\
`draw get node` always returns every node, nothing in the document is conditional on position, and the unfurl is presentation using the same mechanism as a mover's position -- a pure function of a parameter, not stored intermediate state.

This is the strongest AX2 pick available and it anchors squarely on A2 isomorphic specification: declared intent and running reality cannot drift when there is only one stored reality and the rest is derived.\
Rejecting option b is significant -- b was the most faithful unfurl, genuinely growing the document as the story advances, but it would have made the document's contents a function of position, forcing every consumer to ask "when", preventing a link to an entity that does not yet exist, and making `draw get` answer differently depending on the cursor.\
The director accepted the honest cost of a: the unfurl is a replay of something already true rather than a build actually happening.

### S1.Q3 -- Per-question interpretation

The only multi-pick in the survey, and the only question offered without a recommended option.\
All four consumption modes were taken, which is not a hedge: the four are orthogonal and each adds a distinct constraint on the design.\
Live narration demands interruptibility and manual control; self-paced reading demands random access and a caption comprehensible without a narrator; late arrival demands that position be a property of the story rather than of wall-clock time; unattended playback demands that a beat carry its own duration.

Taking all four is a contradictory multi-pick in the sense the methodology names, and it is recorded as such in the frontmatter.\
Live narration wants manual control while unattended playback wants automatic advance; self-paced reading wants private position while live narration wants shared position.\
These cannot be one mechanism, and the tension was carried directly into Q4 as the round's clarification candidate.\
This pick is what converted the vague "pacing" concept from the design conversation into a precise question about what determines position.

**Round-1 composite read:** A story is a derived lens over a complete document, addressed by something other than wall-clock time, and it must serve four consumption modes whose requirements conflict.
The tension between shared and private position, and between manual and automatic advance, is unresolved by Round 1 and is the primary Round-2 clarification candidate.

**Round-1 axiom / principle anchoring:** The round advances A2 isomorphic specification, because choosing derived visibility over stored intermediate state removes the possibility of a story's declared shape drifting from the document's running reality, and A5 perceptual parity, because a derived-from-cursor story guarantees every observer computes the same visible state from the same given rather than deriving their own.
It tensions A4 zero-loss knowledge lightly: a lens that can go stale risks a story silently losing the meaning it once carried, which Q5 addresses.

---

## S2 Round 2 picks

| Q | Pick | Round-1 aggregate relation | Intent reading (1-line summary) |
|---|---|---|---|
| Q4 -- What moves the cursor | **a** Stored cursor; playback advances it | deepens -- resolves the four-mode conflict Q3 created | Position is one stored ordinal in the story; all four modes read or move it. |
| Q5 -- Staleness | **a** Render what remains, report stale | deepens -- closes the cost Q1 accepted | A missing entity is skipped, the story plays, and staleness is visible and queryable. |
| Q6 -- Authoring surface | **a** CLI-first; canvas plays | refines -- adds the AX3 axis Round 1 never touched | An agent composes stories through verbs; the canvas is a player, not an author. |

### S2.Q4 -- Per-question interpretation

Q3 took all four consumption modes, and Q4 asked what single notion of position could serve them.\
The answer is a stored ordinal cursor: the story holds "we are at beat 7", a presenter advances it, a reader scrubs it, a late arrival reads it, and unattended playback is an agent advancing it on a timer.\
This is the decisive ruling of the survey, because it settles that position is an index and not an instant -- the late-arrival case then falls out for free, and beat duration becomes a transition property consumed by whatever is advancing rather than the thing that defines position.

Choosing a over c defers private per-viewer position rather than denying it.\
The director took the simpler mechanism knowing the stated cost: the cursor is shared state, so two readers scrubbing the same story fight over it.\
That is acceptable now and composes later -- a private position can be added as a viewer-local override of a stored cursor without changing what the cursor means, whereas the reverse is not true.\
This is recorded as AG-1 with its revival trigger rather than being silently dropped.\
Anchoring on A11 cognitive minimalism: one stored integer plus a derivation is the smallest mechanism that satisfies all four modes, and the detach-and-rejoin state machine of option c is not yet earned by evidence.

### S2.Q5 -- Per-question interpretation

Q1 chose a lens and thereby accepted that the document can change beneath a story; Q5 rules what happens when it does.\
A beat referencing a deleted entity renders what remains and the story reports itself stale.\
This keeps a twelve-beat story usable when one node is deleted, and it makes decay visible rather than silent -- which requires a real surface, a verb or a badge, naming which beats reference things that are gone.

The rejected options are each instructive.\
Option b, refusing to play, would have made it impossible to ever show something misleading, a genuine virtue for a technical explanation, but one deletion by someone unaware a story existed would break the whole story.\
Option c, pinning referenced entities against deletion, would have inverted the relationship Q1 chose by letting a lens constrain the document it only observes.\
Option d, referencing geometry rather than ids, fails because emphasis on a moving entity is the normal case.\
This pick anchors on A1 sovereign state transparency: the design must make staleness visible from one place rather than leaving a reader to infer that a story has quietly become wrong.\
The residual risk -- a story that appears to work while misleading -- is carried as F2.

### S2.Q6 -- Per-question interpretation

No Round-1 question touched AX3, so Q6 refines the aggregate by adding the authorability axis.\
CLI-first means an agent composes a story entirely through verbs: create beats, set captions, declare emphasis, reorder, and the canvas is a player.\
This matches the originating use case, where the agent is the author of a long-duration technical story, and it is compelled by GR18: all agentic interaction goes through `cli/draw.mjs`, and a story surface an agent could not drive headlessly would be a CLI gap by definition.\
It also keeps the whole surface testable without a browser, which matters given twelve-plus measured incidents of green-and-wrong tests.

The stated cost is real and is where this design is most likely to fail: authoring a visual thing without seeing it is exactly the failure mode that produced wrong positions before, and B110 exists because positions must be anchors rather than pixels.\
The mitigation is that the agent must hold its own instruments per A5 -- a `draw` verb that renders or describes the derived visible state at a given cursor, so the agent can perceive what a beat looks like without asking the director to look at a screen.\
That requirement is carried as F1 and is load-bearing rather than optional.\
Rejecting option b defers canvas authoring rather than denying it; the two surfaces must not drift in expressiveness if b is later built, recorded as AG-2.

**Round-2 composite read:** Round 2 confirmed Round 1 and made it buildable, converting "a lens with derived visibility" into three concrete commitments -- position is a stored ordinal, staleness is tolerated and reported, and authoring is a verb surface.
Nothing in Round 2 challenged Round 1; the rounds compose cleanly into a single coherent design direction.

**Round-2 axiom / principle anchoring:** Where Round 1 anchored on A2 and A5 to rule how a story relates to truth, Round 2 anchors on A1 sovereign state transparency for staleness reporting, GR18 for the authoring surface, and A11 cognitive minimalism for taking the smallest position mechanism that serves all four modes.
The A5 anchor carries forward with a sharper obligation: a CLI-first authoring surface is only honest if the agent can perceive the derived result through its own instruments.

---

## S3 Composite intent envelope

A story is a **lens over a document**: an ordered list of beats plus a stored ordinal cursor, where every entity exists in the document from commit and what a viewer sees at any point is **derived** from the cursor.\
This is reading C from the design conversation, corrected on one decisive axis -- position is an **index, not an instant**.\
That correction is what allows the four consumption modes taken in Q3 to be served by one mechanism: a presenter advances the cursor, a reader scrubs it, a late arrival reads it, and unattended playback is an agent advancing it on a timer that consumes a per-beat duration.\
Pacing is a transition property within and between beats; it is not what defines position.

The primary outcomes are AX1 comprehension, AX2 derivation integrity and AX5 consumption modes; the secondary outcomes are AX3 agent authorability and AX4 reuse.\
The key design constraints surfaced are: a beat declares emphasis over a complete document rather than creating content, so `draw get` answers identically at every cursor position; a beat must be able to **subtract** as well as add, because progressive disclosure of a complex architecture is focus rather than monotonic accumulation; a caption is a second channel rendered in the footer bar rather than on the canvas, and its typing effect is derived from elapsed-within-beat, giving a beat an internal duration distinct from its ordinal position; the story must render what remains and report staleness when the document changes beneath it; and the entire authoring surface must be driveable by an agent through `draw` verbs.

Two things the conversation had assumed are **not** settled by this envelope and must not be smuggled into the design.\
Per-beat **position overrides** were discussed at length before the survey and no question ratified them; they would make an entity appear in two places depending on whether a story is being read, which is a second source of truth for position and collides with B110.\
They are carried as F3 for an explicit design-phase ruling, not as an accepted feature.\
Likewise `timeline` was named as the eventual composition above beats, but nothing here rules whether a timeline is a distinct entity or simply the ordered beat list a story already holds; that is F4.

**Final axiom / principle anchoring:** The derived intent is anchored primarily on **A2 isomorphic specification** and **A5 perceptual parity**.
A2 is what makes derived visibility the right answer rather than merely an elegant one: with a single stored reality and everything else computed, a story's declared shape cannot drift from the document's running reality, and the one place drift can still enter -- a stale reference -- is exactly what Q5 requires be reported rather than hidden.\
A5 binds the design twice: every observer of a story must derive the same visible state from the same given cursor rather than computing their own from a local clock, and the authoring agent must hold instruments to perceive the derived result rather than relying on a human to look at a screen.\
Secondary anchors are A11 cognitive minimalism, which justifies the single shared cursor over a detach-and-rejoin state machine until evidence earns it, A1 sovereign state transparency for staleness, and GR18, which makes the CLI-first authoring surface a requirement rather than a preference.

---

## S4 Scope summary

| Axis | Bound |
|---|---|
| Title | Beats, stories and progressive visual disclosure |
| Classification | feature |
| Location / scope | `model/`, `server/validate.js`, `cli/verbs.mjs`, `app/src/` renderer and footer bar |
| Primary outcome | A story is a lens over a complete document: ordered beats plus a stored ordinal cursor, with visible state derived from that cursor. |
| Secondary outcomes | Agent-authorable through `draw` verbs; many stories over one document; staleness tolerated and reported. |
| Outcome-axis (primary) | AX1 comprehension, AX2 derivation integrity, AX5 consumption modes |
| Outcome-axis (secondary) | AX3 agent authorability, AX4 reuse |
| Outcome-axis (Round-1) | primary: AX2, AX4, AX5; secondary: AX1 |
| Outcome-axis (Round-2) | primary: AX5, AX3; secondary: AX2, AX4 |
| Axiom/principle anchors | primary: A2 isomorphic specification, A5 perceptual parity; secondary: A11, A1, GR18 |
| Axiom/principle anchors (Round-1) | A2 isomorphic specification, A5 perceptual parity |
| Axiom/principle anchors (Round-2) | A1 sovereign state transparency, GR18, A11 cognitive minimalism |

---

## S5 Anti-goals (out-of-scope; deferred)

| AG | Description | Composes-with target |
|---|---|---|
| AG-1 | Private per-viewer position (detach from the shared cursor and rejoin). Q4 took the shared cursor knowing two readers scrubbing one story contend. | Revival trigger: the first report of two readers contending on one story, or a story published for self-paced reading by more than one person at once. Composes as a viewer-local override of the stored cursor without changing its meaning. |
| AG-2 | Canvas authoring of stories (select, arrange, capture as a beat). Q6 chose CLI-first; the canvas plays only. | Revival trigger: a human author, rather than an agent, needs to compose a story. Must not drift in expressiveness from the verb surface. |
| AG-3 | Beat-as-program (reading B): entities genuinely coming into existence as beats play. Ruled out by Q2. | Revival trigger: a story must explain assembly order in a way derived emphasis provably cannot convey. Reopening requires re-ratifying Q2. |
| AG-4 | `draw apply <document>` declarative convergence -- diff-derived ops from a desired state. Named in conversation as explicitly NOT what a beat is. | Revival trigger: a request to reconcile a document toward a declared target state. Independent of stories; a beat is an imperative authored draft. |
| AG-5 | Narrating a past editing session by replaying its recorded transactions (reading A). Ruled out by Q2. | Revival trigger: a request to see how a document was actually built. Note the log is a bounded ring and nothing replays it, so this is a larger change than it appears. |
| AG-6 | Audio, video, or any non-visual narration channel alongside the caption. | Revival trigger: a story must be consumed without a reader present to read the caption. |

---

## S6 Flags / open questions for the design phase

| # | Flag | Recommendation |
|---|---|---|
| F1 | Q6 puts an agent in charge of authoring a visual artifact it cannot see. This is the failure mode that produced wrong positions before, and B110 exists because of it. | Load-bearing, not optional: design a verb that renders or describes the derived visible state at a given cursor, so the agent perceives the result through its own instruments per A5. Build it before, not after, the authoring verbs. |
| F2 | Q5 accepts that a story can appear to work while having become misleading. | Design the staleness surface as a first-class query, not a badge alone. Decide whether a stale story is flagged at play time, at read time, or both, and whether deleting an entity referenced by a story warns the deleter. |
| F3 | Per-beat position overrides were designed at length in conversation but ratified by no question. They create a second source of truth for position and collide with B110 anchors. | Do NOT carry into the design as accepted. Rule explicitly: either an entity has exactly one position and beats cannot move things, or overrides are ratified separately with the two-places-at-once cost stated. Recommend the former until evidence earns the latter. |
| F4 | The relationship between `beat`, `story` and `timeline` is unsettled. The director named `beat` and `timeline`; the survey established `story` as the lens. Three names, unclear whether they are three entities. | Rule the entity count before writing schema. Candidate: a story IS the ordered beat list plus cursor, making `timeline` a synonym rather than a third thing. Name it once and delete the other two words from the design. |
| F5 | A beat must subtract as well as add -- focus, not accumulation. It is unclear whether a beat declares an absolute visible set or a delta from the previous beat. | Absolute is more robust to reordering and insertion, which the drafting workflow requires; delta is more compact to author. Recommend absolute stored, with a delta-style authoring verb that computes it. |
| F6 | A caption's typing effect is derived from elapsed-within-beat, so a beat has an internal duration as well as an ordinal position. Two clocks now exist: cursor position, and elapsed-within-beat. | Specify the origin of elapsed-within-beat precisely. It must not be wall-clock-since-commit -- that is the B177 failure class. Recommend deriving it from when the cursor last changed, which is a stored fact. |
| G7 | Earlier conversation established that `cli/` is standalone and cannot import the kernel (B138), so validation of a drafted beat needs the server. | Confirm during design whether beats are drafted server-side or whether the CLI can hold an unvalidated draft. This constrains the "a beat validates as it is drafted" property agreed in conversation. |
| F8 | Every pick in this survey landed on the proposer's recommended option. | Treat the envelope as capturing a direction the conversation had already converged, not as independent confirmation of it. The design review should adversarially test Q1 and Q2 in particular, since they carry the most downstream weight. |

---

## S7 Sequencing / cross-work considerations

### S7.1 Branch + review strategy

Design-of-record first, then build behind the standard gate.\
Per X13 every fix ships with a test proven RED, and the derived-visibility property is a mutation-testing target: a mutant that ignores the cursor must fail a test.\
Per M1 triangulated review, the design needs a minimum of four independent inputs before build, given this is a new first-class surface rather than a defect repair.

### S7.2 Composability with concurrent / pending work

Composes with B187, which made `name` mandatory on all five kinds -- a story referencing entities by name rather than raw id is now viable and more readable in a CLI authoring flow, though names are unique-at-creation rather than immutable, which F2 staleness must account for.\
Independent of H13.7, the lease, which remains director-blocked.\
Independent of B180, the cached combat fold, though both concern derivation caching and a scrub-backwards requirement on stories may strengthen the B180 trigger.\
The AR1 architecture record still does not exist; adding a sixth conceptual surface without it widens that known gap, and this envelope should be cited when AR1 is finally written.

### S7.3 Compressed-timeline candidate?

No. This is a new first-class entity with an unresolved entity count (F4), an unratified position-override question (F3), and a hard prerequisite (F1) that must be built first.\
Recommend the full design-of-record path.\
The one compression available is that F1, the agent's perception verb, is independently useful and can be built ahead of the design settling.

---

## Scalibration -- Calibration data point

- **Stakeholder time-cost (minutes):** 6 (across both rounds)
- **Comparison baseline:** B163 ordered-rule-table survey; B178 spawner survey
- **Notes:** All six picks landed on the recommended option, which the instrument cannot distinguish from anchoring -- see F8. The load-bearing question was Q3, the only multi-pick and the only one offered without a recommendation; taking all four consumption modes generated the contradiction that Q4 resolved, converting a vague "pacing" idea into the cursor-versus-clock ruling that is the survey's main output. Novel constraint surfaced: position must be an ordinal index rather than a temporal instant, which was not visible before the four modes were forced to coexist. Methodology observation: withholding the recommendation marker on the question whose answer the proposer most wants to test produced the highest-value answer of the survey, and should be considered as guidance for future round design.

---

## Scontradictory -- Contradictory multi-pick carry-forward

| Round | Question(s) | Picks | Constraint envelope description |
|---|---|---|---|
| 1 | Q3 | a, b, c, d | Live narration wants manual interruptible control; unattended playback wants declared per-beat duration; self-paced reading wants private random access; late arrival wants position independent of wall-clock time. Not one mechanism. Satisfiable envelope: a stored ordinal cursor as the single notion of position, per-beat duration as a property an optional advancing agent consumes, and private viewer position deferred to AG-1. |

---

## S8 Cross-references

- **mission-kit K5 survey** -- the survey methodology this followed
- **B188** -- source work item
- **`VISION.md`** -- ratified AR6; the geometry-carries-more-and-stores-less asymptote this envelope leans on
- **`docs/DECISIONS.md`** -- where the Q1, Q2 and Q4 rulings should be recorded as AR4 entries
- **B163, B178** -- prior surveys; the calibration baseline
- **B110** -- positions are anchors, never pixels; the constraint F3 collides with
- **B138** -- `cli/` cannot import the kernel; the constraint behind G7
- **B177** -- the cross-machine-timestamp failure class F6 must avoid
- **B187** -- mandatory names; makes name-based beat references viable
- **AR1** -- the absent architecture record this envelope widens the gap in

---

-- Proposer: agent (planner) / 2026-09-04 (Survey envelope; 6 picks ratified across 2 rounds)
