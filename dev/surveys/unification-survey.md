---
survey-title: The unification programme -- one substrate for what a thing is, does, and connects to
work-item: unification-programme
methodology-source: mission-kit skill K5 survey (two-round, three-orthogonal-questions-per-round pick-list)
lifecycle-handoff:
  from: intent-open
  to: intent-captured
  authority-ref: Director, live session 2026-09-25, "yes, frame is right ... Proceed"
  planning-input-ref: self
stakeholder-picks:
  round-1:
    Q1: abcd
    Q1-rationale: All four payoffs are required evidence; none is optional.
    Q2: c
    Q2-rationale: The target reaches through behaviour and events; policy stays out.
    Q3: abc
    Q3-rationale: "Though it must be derived/computed - its inputs may be persisted to the document: i.e a src:dst node pair may be selected and this persists as state in the control plane, so that a path can be derived across all viewers"
  round-2:
    Q4: <pending>
    Q5: <pending>
    Q6: <pending>
classification: design-programme
outcome-axis:
  primary: [<pending round 2>]
  secondary: [<pending round 2>]
  round-1:
    primary: [AX2 parity at every door, AX3 expressiveness, AX4 extensible physics, AX1 derived not stored]
    secondary: [AX5 conceptual economy]
  round-2:
    primary: [<pending>]
    secondary: [<pending>]
axiom-principle-anchors:
  primary: [<pending round 2>]
  secondary: [<pending round 2>]
  round-1: [VISION north star (derived physics, everyone watching), A5 perceptual parity, A3 sovereign composition]
  round-2: [<pending>]
calibration-data:
  stakeholder-time-cost-minutes: <pending>
  comparison-baseline: dev/surveys/b188-beats-and-stories-survey.md
  notes: <pending>
---

# The unification programme -- Survey envelope

**Methodology:** mission-kit `K5` survey (2-round, 3-orthogonal-questions-per-round pick-list)\
**Work item:** unification-programme\
**Classification candidate:** design-programme\
**Lifecycle handoff:** `intent-open -> intent-captured` only; this envelope grants no design, seed, implementation, or delivery effect.

**STATUS: ROUND 1 CAPTURED, ROUND 2 PENDING.**\
Round 2 is designed after the reality map lands, so its questions come from forks the code actually presents.

**Director's instruction, 2026-09-25: this survey captures INTENT and must not decide the design.**\
"Let's make sure that when we are ready for round 2, and when we complete the survey - that we have encoded the entire problem space to carry through to design. I don't want this survey to decide the design before we perform that next entire phase."\
So every question here asks what must hold, what matters, or how things should behave, never which structure to build.\
The problem space itself (every open boundary with its alternatives, including the status quo, the test that would separate them, and the evidence) is carried in a separate problem-space register, cross-referenced in S8, and nothing in this envelope ranks one alternative over another.

---

## S0 Context

`dev/HANDOVER.md` (at `a986fb3`) hands over a unification programme: collapse two entity kinds into one substrate with composable capabilities, per the ontology in `dev/DECISIONS.md` "The universal node, staged" (anchor, pack, composition, node; waypoint retired).\
A verification pass on 2026-09-25 found the handover accurate on most code facts but found its central argument weaker than stated: the collapse is already a shipped "pure proposal, planner applies" write, the split exists at the browser door only and drops `flow`, `control` and the name, and several rulings live only in the handover.

The director framed the programme as two related tracks meeting at a seam:

- **Track A**, what a thing IS and DOES: pipeline, rules, node, capability, behaviour, event.
- **Track B**, how things CONNECT: link, route, path, flow, junction, bend, endpoint.
- **The seam**: the anchor, the `routable` pack, and how rules write.

The director also named **wire, link, path and flow** as candidate terms: "some of these things either don't exist, perhaps should or shouldn't exist, but worth considering if it buys us capability and behaviour in a clean, decoupled unified way".

**Outcome axes**, drawn from `VISION.md` and accepted by the director without amendment:

| Axis | Meaning |
|---|---|
| AX1 derived not stored | What can be computed from geometry and a clock is computed; the document states intent. |
| AX2 parity at every door | Browser, server, CLI and REST compute the same thing; no rule lives at one door. |
| AX3 expressiveness | Compositions that are inexpressible today become expressible. |
| AX4 extensible physics | A new capability or behaviour arrives without an engine change. |
| AX5 conceptual economy | Fewer kinds and special cases for an author or agent to learn. |
| AX6 one-way-door risk | Irreversible changes to stored documents (38 live diagrams at 2026-09-25) are few, named, and last. |

**Round-1 pre-anchor:**

| Q | Likely primary axis | Likely secondary axis |
|---|---|---|
| Q1 payoff | AX2, AX3, AX5, AX4 (one per option) | -- |
| Q2 reach | AX4 | AX6 |
| Q3 new nouns | AX1, AX5 | AX3 |

---

## S1 Round 1 picks

| Q | Pick | Intent reading (1-line summary) |
|---|---|---|
| Q1 -- payoff: what the model must prove first | **abcd** door parity, new expressiveness, fewer concepts, extensible physics | All four are required evidence; the programme may not trade one away silently. |
| Q2 -- reach of the target substrate | **c** + behaviour and events | Appearance, routing, writes, and the pilot's physics become one substrate; policy does not. |
| Q3 -- what earns a connection noun | **abc** something attaches, author can see it, derived never stored (with a refinement) | A noun is admitted when something attaches to it and people can see it; it is derived, but its INPUTS may be persisted. |

### S1.Q1 -- Per-question interpretation

Four orthogonal options, all picked, so each adds a constraint rather than choosing a direction.\
Read against `VISION.md`, which says the asymptote's directions "are expected to disagree" and that the disagreement "goes to the board rather than being averaged away", this is not indecision: it says no payoff may be bought by silently spending another.\
The hypothesis is that the design must carry an explicit account of each of AX2, AX3, AX4 and AX5, and that where two conflict the conflict is surfaced as a ruling rather than resolved by the proposer.\
What the pick does not say is which one the FIRST increment has to demonstrate end to end, and that is a Round-2 disambiguation candidate.

### S1.Q2 -- Per-question interpretation

The options were cumulative levels, and the director picked the third: the target includes appearance, routing, writes, AND behaviour and events.\
This is wider than the record: `DECISIONS.md` (2026-09-22) scoped packs to two families, appearance and routing, both derived and stateless.\
So the pick extends the ruled scope to writes (split, collapse, cascades) and to the pilot's physics (spawners, movers, combat, reveal), and it keeps policy out, which preserves the 09-22 exclusion and its hypothesis.

**CORRECTED 2026-09-25 (proposer): the option text and this reading embedded a mechanism.**\
Was: the option read "the pilot's physics ... become packs on anchors", and this interpretation read "a spawner, a mover or a tower is expected to be a pack on an anchor".\
That is a design choice inside an intent question, and the director's clarification (a visual flow element attached to a declared FLOW, not to an anchor) shows it may be wrong.\
Corrected reading: the pick sets REACH only.\
Behaviour and events are inside the unified substrate; HOW they join it (packs on anchors, attachments to flows or paths, or something else) is open and carried to design.\
The one consequence that survives without assuming a mechanism: behaviour brings time and a clock into the substrate, not only the document.

### S1.Q3 -- Per-question interpretation

Three of four criteria picked, and the fourth deliberately not: a noun is admitted when SOMETHING ATTACHES to it and an AUTHOR OR AGENT CAN SEE IT, and it is DERIVED; it does NOT have to delete special-case code to earn a name.\
The director's refinement is load-bearing: derived does not mean input-free.\
"A src:dst node pair may be selected and this persists as state in the control plane, so that a path can be derived across all viewers."\
So the document may store a DECLARATION (the pair), and the path is a computation every viewer performs identically from it, which is exactly `VISION.md`'s "each computes the world from inputs it already holds, rather than being told the outcome".

Measured against the code on 2026-09-25: the persisted, shared half already exists as the authoritative selection (`doc.selection`, `model/model.mjs:361`, lock-gated with no version bump), but the derived half does not.\
The selected-path highlight lights the waypoints of each selected LINK only (`app/src/renderer.js:180-192`); nothing derives a path between a node pair across several links.\
The example also sits close to the director's preserved policy hypothesis ("declare flow pairs on a control-plane graph"), while Q2 kept policy out, which suggests the director wants the declaration-and-derivation MECHANISM without the permit/deny SEMANTICS.

**Director clarification, 2026-09-25, given after the Round-1 picks and recorded verbatim:**

> I'm not sure I answered correctly - but I hope my intent is there.
> One of the things I want to be able to do is "declare a path or flow" and have that path/flow - multihop across routed junctions/nodes - have a visual flow element along them.
> Use case here is that we construct a geomtric network of wires or links, and then just declare or reason with lots of permutations of flows between the leaves/endpoints.
> I keen using flow/path and wire/link interchangeably for now, because I am not completely sure if these are mechanically the same primitive or slightly different ones, and I'd like to explore that split.
> Its possible that Links exist, but are derived on top of Wires, and possible that Paths are persistent entities, derived on top of Links, and maybe only some of these items have direction etc.
> I guess unification of behaviours here also involves developing the proper "OSI Layered Stack" or equivalent for our drawing system

Reading: the anchoring use case is to BUILD a geometric network, then DECLARE many flows between its leaves, each flow's multi-hop path derived across routed junctions and nodes and drawn with a visual flow element, identically for every viewer.\
Whether wire and link are one primitive or two, and path and flow one or two, is explicitly OPEN and is to be explored, not assumed; direction may belong to some layers and not others.\
The director names a layered stack, "OSI or equivalent", as part of what unification means, which makes the layer boundaries themselves a design output of this programme.

**Director statement, 2026-09-25, recorded verbatim:** "We are building a full fidelity network system".\
Reading: the connection layers are to be held to the fidelity of a real network (layers, forwarding, flows, direction where a network has it), not to the fidelity of a diagram of one.\
Carried to design undecided: whether that network stack belongs to the ENGINE (`VISION.md`: "a programmable geometric engine", whose pilot is tower defence) or is a DOMAIN composed onto a neutral engine, alongside the pilot's movers, which already travel along paths.

**Director requirement, 2026-09-25, recorded verbatim:** "links are only ever between endpoints or junctions (or one to the other). drawing a new link to a bend converts it to a junction (current behaviour). parallelism lives above/abstracted over wires. I think we need to be able to model, construct and visualise all 4 of those in the table."\
The four are the wire-to-link relations of a real network: SERIES (many wires to one link through bends), PARALLEL (many members to one logical link, as in link aggregation), MULTIPLEX (one wire carrying many logical links, as in VLANs), and PARALLEL LINKS (several links between the same two anchors).\
Reading: all four must be expressible by an author or agent, buildable at every door, and visible, and the programme is not complete while any of them is not.\
How they are represented is carried to design undecided (register S15).

**Round-1 composite read:** all four payoffs are required, the target substrate reaches through behaviour and events but not policy, and a connection noun is admitted by attachment plus visibility, as a derivation whose inputs may be persisted declarations.\
Tensions for Round 2: whether a persisted src:dst pair is a SELECTION (model-state, no version bump, outside undo, which the 09-22 ruling calls session state) or a DECLARATION (document intent, versioned, undoable); what "the control plane" means here (H15.15 control links, a separate declared layer, or the document); and "fewer concepts" as a payoff alongside a noun test that does not require deletion.

**Round-1 axiom / principle anchoring:** the round advances the `VISION.md` north star, derived physics that everyone watching computes identically, and `A5` perceptual parity (a noun must be visible, and every viewer derives the same path); `A3` sovereign composition is implicated by the widened reach, since behaviour joining the substrate is a boundary decision.\
The tension to carry: storing declarations as inputs is consistent with "not a system that stores what it can derive" only while the stored thing is intent that cannot be derived, and the design must hold that line per noun.

---

## S2 Round 2 picks

PENDING: designed after the reality map (`unification-reality-map.md`) lands.

---

## S3 Composite intent envelope

PENDING.

---

## S4 Scope summary

PENDING.

---

## S5 Anti-goals (out-of-scope; deferred)

| AG | Description | Composes-with target |
|---|---|---|
| AG-1 | Policy: permit/deny over flows (Q2 stopped at behaviour and events). | The director's preserved hypothesis in `DECISIONS.md` 2026-09-22; revisit once declared flow pairs and derived paths exist. |
| AG-2 | An admin portal for managing packs at runtime. Director, 2026-09-25: "For now, packs/mods will be fixed server-side, and distributed to clients. A later 'admin portal' for managing packs can be worked on - but out of scope". In scope: a document declares its required packs, from a fixed server-side set delivered to clients and kept in sync per document. | Runtime pack management and publishing; revisit when a pack must change without a server release. |

---

## S6 Flags / open questions for the design phase

| # | Flag | Recommendation |
|---|---|---|
| F1 | Q2 widens the ruled pack scope (appearance + routing) to writes, behaviour and events; `DECISIONS.md` does not yet say so. | Record the widened reach as a ruling once the survey closes, not only in this envelope. |
| F2 | The 09-22 ruling calls selection session state, but the code persists it in the document (`doc.selection`), and Q3's example builds on persistence. | Round 2 disambiguates selection vs declaration. |
| F3 | Behaviour as packs brings time (a clock) into a model ruled as derived from the document. | Establish in the reality map how movers and spawners derive from geometry plus clock today. |
| F4 | The layer stack (wire, link, path, flow, or fewer) is a design output, and each boundary is a fork: what a layer stores, what it derives, what it may attach to, and whether it has direction. | Design the boundaries one at a time, each with alternatives, before any identifier moves. |
| F5 | Today's `flow` boolean has no layer yet: it could be a one-way constraint on a link, or a one-hop declared flow. | Settle as part of F4, since the answer changes what "declare a flow" means. |

---

## S7 Sequencing / cross-work considerations

PENDING.

---

## Scalibration -- Calibration data point

PENDING.

---

## S8 Cross-references

- **mission-kit `K5` survey** -- the methodology followed
- **`dev/HANDOVER.md`** -- the programme's on-ramp (at `a986fb3`)
- **`dev/DECISIONS.md`** "The universal node, staged" -- the ruled ontology this survey extends
- **`dev/surveys/b188-beats-and-stories-survey.md`** -- prior survey, calibration baseline
- **`VISION.md`** -- source of the outcome axes
- **`dev/design/unification/PROBLEM-SPACE.md`** -- the undecided problem-space register this survey feeds (PS entries; its section 8.2 lists the intent-silent entries that are Round-2 candidates)
- **`dev/design/unification/REALITY-MAP.md`** -- the code-grounded map of both tracks and the seam at `a986fb3` (forks F1-F41, defects D1-D48, contradictions C1-C48)
- **`dev/design/unification/DISCUSSION-SEEDS.md`** -- the director's verbatim statements, leanings and questions from the design conversation of 2026-09-25 (S1-S21)

-- Proposer: Claude / 2026-09-25 (Survey envelope; Round 1 captured, Round 2 pending)
