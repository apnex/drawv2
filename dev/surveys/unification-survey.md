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
    Q4: c
    Q4-rationale: '"Repair automatically"; with no route to repair onto, "a flow that cant route gets visible retracted. If the pipe/link is repaired - the flow automatically heals"'
    Q5: a
    Q5-rationale: 'bare pick "Declare a flow"; option description (proposer): "Build a small network, declare a flow between two leaves, and see it routed with a visual flow along it -- the same in browser, CLI and export."'
    Q6: b
    Q6-rationale: 'I''m thinking 2 for now - making a game in "read mode" is currently out of scope - we might need to extend history and state for a real tower defense game in future'
classification: design-programme
outcome-axis:
  primary: [AX2 parity at every door, AX3 expressiveness, AX4 extensible physics, AX1 derived not stored]
  secondary: [AX5 conceptual economy]
  round-1:
    primary: [AX2 parity at every door, AX3 expressiveness, AX4 extensible physics, AX1 derived not stored]
    secondary: [AX5 conceptual economy]
  round-2:
    primary: [AX1 derived not stored, AX2 parity at every door, AX3 expressiveness]
    secondary: [AX4 extensible physics]
axiom-principle-anchors:
  primary: ["VISION north star (derived physics, everyone watching)", A5 perceptual parity, A3 sovereign composition]
  secondary: [A7 resilient agentic operations, A13 director intent amplification]
  round-1: ["VISION north star (derived physics, everyone watching)", A5 perceptual parity, A3 sovereign composition]
  round-2: [VISION derived physics, A5 perceptual parity, A7 resilient agentic operations, A13 director intent amplification]
anti-goals-count: 3
flags-count: 9
calibration-data:
  stakeholder-time-cost-minutes: 20
  comparison-baseline: dev/surveys/b188-beats-and-stories-survey.md
  notes: "Time is the proposer's estimate for answering alone, not measured; the Round-1 clarifications ran inside a longer design conversation. Round 2 was delivered one question at a time at the director's request, and two of its answers arrived through Other with a clarification or a hybrid."
contradictory-constraints:
  - round: 2
    questions: [Q4 follow-up]
    picks: [show it broken, remove it]
    constraint-envelope: "A declared flow that cannot route is visibly retracted but not deleted, and heals automatically when the pipe or link is repaired: visible like 'show it broken', retracted in a sense the director did not define (S2.Q4), and the declaration survives both."
---

# The unification programme -- Survey envelope

**Methodology:** mission-kit `K5` survey (2-round, 3-orthogonal-questions-per-round pick-list)\
**Work item:** unification-programme\
**Classification candidate:** design-programme\
**Lifecycle handoff:** `intent-open -> intent-captured` only; this envelope grants no design, seed, implementation, or delivery effect.

**STATUS: BOTH ROUNDS CAPTURED (2026-09-25).**\
Round 2's Q4 and Q6 were designed from the register's intent-silent entries and Q5 from a further director point (register PS501), and Round 2 was asked one question at a time.

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
So the pick extends the unified substrate's reach beyond the ruled pack scope to writes (split, collapse, cascades) and to the pilot's physics (spawners, movers, combat, reveal), and it keeps policy out, which preserves the 09-22 exclusion and its hypothesis.

**CORRECTED 2026-09-25 (proposer): the option text and this reading embedded a mechanism.**\
Was: the option read "the pilot's physics ... become packs on anchors", and this interpretation read "a spawner, a mover or a tower is expected to be a pack on an anchor".\
That is a design choice inside an intent question, and the director's clarification (a visual flow element attached to a declared FLOW, not to an anchor) shows it may be wrong.\
Corrected reading: the pick sets REACH only.\
Behaviour and events are inside the unified substrate; HOW they join it (packs on anchors, attachments to flows or paths, or something else) is open and carried to design.\
The one consequence that survives without assuming a mechanism: behaviour brings time and a clock into the substrate, not only the document.

**CORRECTED 2026-09-25 (proposer, after an independent neutrality audit): option b embedded a mechanism too, and this reading widened the ruled pack scope.**\
Was: "So the pick extends the ruled scope to writes (split, collapse, cascades) and to the pilot's physics", which read the pick as widening the 09-22 PACK scope; flag F1 carried the same reading ("Q2 widens the ruled pack scope (appearance + routing) to writes, behaviour and events") and recommended recording it as a ruling "once the survey closes". Both are corrected in place.\
The same holds for option b, whose text read "split, collapse and cascades become rules that packs contribute and the planner runs": the pick sets reach for writes too; who contributes a derived write and who applies it is open (register PS313, PS422).

### S1.Q3 -- Per-question interpretation

Three of four criteria picked, and the fourth deliberately not: a noun is admitted when SOMETHING ATTACHES to it and an AUTHOR OR AGENT CAN SEE IT, and it is DERIVED; it does NOT have to delete special-case code to earn a name.\
The director's refinement is load-bearing: derived does not mean input-free.\
"A src:dst node pair may be selected and this persists as state in the control plane, so that a path can be derived across all viewers."\
So the document may store an INPUT (the pair, which the director called "selected"; selection versus declaration is the Round-1 tension below), and the path is a computation every viewer performs identically from it, which is exactly `VISION.md`'s "each computes the world from inputs it already holds, rather than being told the outcome".

Measured against the code on 2026-09-25: the persisted, shared half already exists as the authoritative selection (`doc.selection`, `model/model.mjs:361`, lock-gated with no version bump), but the derived half does not.\
The selected-path highlight lights the waypoints of each selected LINK only (`app/src/renderer.js:180-192`); nothing derives a path between a node pair across several links.\
The example also sits close to the director's preserved policy hypothesis ("declare flow pairs on a control-plane graph"), while Q2 kept policy out, which suggests the director wants the MECHANISM of a persisted input and a derived path, without the permit/deny SEMANTICS.

**Director clarification, 2026-09-25, given after the Round-1 picks and recorded verbatim:**

> I'm not sure I answered correctly - but I hope my intent is there.
> One of the things I want to be able to do is "declare a path or flow" and have that path/flow - multihop across routed junctions/nodes - have a visual flow element along them.
> Use case here is that we construct a geomtric network of wires or links, and then just declare or reason with lots of permutations of flows between the leaves/endpoints.
> I keen using flow/path and wire/link interchangeably for now, because I am not completely sure if these are mechanically the same primitive or slightly different ones, and I'd like to explore that split.
> Its possible that Links exist, but are derived on top of Wires, and possible that Paths are persistent entities, derived on top of Links, and maybe only some of these items have direction etc.
> I guess unification of behaviours here also involves developing the proper "OSI Layered Stack" or equivalent for our drawing system

Reading: the anchoring use case is to BUILD a geometric network, then DECLARE many flows between its leaves, each flow's multi-hop path derived across routed junctions and nodes and drawn with a visual flow element, identically for every viewer.\
Whether wire and link are one primitive or two, and path and flow one or two, is explicitly OPEN and is to be explored, not assumed; direction may belong to some layers and not others.\
The director suggests ("I guess") that unification involves a layered stack, an "OSI Layered Stack" or equivalent, which makes the layer boundaries themselves a design output of this programme.

**Director statement, 2026-09-25, recorded verbatim:** "We are building a full fidelity network system".\
Reading: the connection layers are to be held to the fidelity of a real network (layers, forwarding, flows, direction where a network has it), not to the fidelity of a diagram of one.\
Carried to design undecided: whether that network stack belongs to the ENGINE (`VISION.md`: "a programmable geometric engine", whose pilot is tower defence) or is a DOMAIN composed onto a neutral engine, alongside the pilot's movers, which already travel along paths.

**Director, 2026-09-25, recorded verbatim (no label in the source; seeds S15 records the first three sentences as DIRECTOR LEANINGS and the last as a DIRECTOR REQUIREMENT, hedged "I think"):** "links are only ever between endpoints or junctions (or one to the other). drawing a new link to a bend converts it to a junction (current behaviour). parallelism lives above/abstracted over wires. I think we need to be able to model, construct and visualise all 4 of those in the table."\
The four are the wire-to-link relations of a real network: SERIES (many wires to one link through bends), PARALLEL (many members to one logical link, as in link aggregation), MULTIPLEX (one wire carrying many logical links, as in VLANs), and PARALLEL LINKS (several links between the same two anchors).\
Reading: all four must be possible to model, construct and visualise, and the programme is not complete while any of them is not.\
How they are represented is carried to design undecided (register S15).

**CORRECTED 2026-09-25 (proposer, after an independent neutrality audit): five Round-1 passages hardened or widened what the director said, and are corrected in place above and in the composite read below.**\
Was (S1.Q3): "So the document may store a DECLARATION (the pair)", which settled register PS220 (selection or declaration) by vocabulary.\
Was (clarification reading): "The director names a layered stack, "OSI or equivalent", as part of what unification means", which dropped the director's "I guess".\
Was (statement heading): "Director requirement, 2026-09-25, recorded verbatim", over the whole statement, although the source carries no label and seeds S15 labels only the last sentence a requirement.\
Was (requirement reading): "all four must be expressible by an author or agent, buildable at every door, and visible", which added "buildable at every door".\
Was (composite read): "as a derivation whose inputs may be persisted declarations", which settled PS220 by vocabulary as S1.Q3 did.

**Round-1 composite read:** all four payoffs are required, the target substrate reaches through behaviour and events but not policy, and a connection noun is admitted by attachment plus visibility, as a derivation whose inputs may be persisted.\
Tensions for Round 2: whether a persisted src:dst pair is a SELECTION (model-state, no version bump, outside undo, which the 09-22 ruling calls session state) or a DECLARATION (document intent, versioned, undoable); what "the control plane" means here (H15.15 control links, a separate declared layer, or the document); and "fewer concepts" as a payoff alongside a noun test that does not require deletion.

**Round-1 axiom / principle anchoring:** the round advances the `VISION.md` north star, derived physics that everyone watching computes identically, and `A5` perceptual parity (a noun must be visible, and every viewer derives the same path); `A3` sovereign composition is implicated by the widened reach, since behaviour joining the substrate is a boundary decision.\
The tension to carry: storing inputs (declarations or selections; PS220) is consistent with "not a system that stores what it can derive" only while the stored thing is intent that cannot be derived, and the design must hold that line per noun.

---

## S2 Round 2 picks

Q4 and Q6 were designed from the register's intent-silent entries (`dev/design/unification/PROBLEM-SPACE.md` section 8.2), and Q5 from its section 8.3 (PS501), in place of a planned geometric-fidelity question whose entries (PS202, PS203, PS214, PS406) stay in 8.2; Round 2 was asked one question at a time at the director's request.\
Each question asks how things should behave, never which structure to build.

| Q | Pick | Round-1 aggregate relation | Intent reading (1-line summary) |
|---|---|---|---|
| Q4 -- when a change would break something declared | **c** repair automatically; a flow with no route is retracted visibly and heals automatically | deepens Q3 (derived, visible) | Repair first; a flow that cannot route is kept, shown as retracted, and heals on its own when the pipe or link is repaired. |
| Q5 -- what the first working version must demonstrate end to end | **a** declare a flow | disambiguates Q1 (all four payoffs) | The first proof is the director's own use case: a small network, one declared flow between two leaves, routed and shown, the same in browser, CLI and export. |
| Q6 -- does a change apply from that moment, or as if it had always been so | **b** as if always, for now | deepens Q2 (behaviour and events in reach) | Behaviour keeps today's recompute-from-the-current-board semantics; history and state for a real game are out of scope (AG-3). |

### S2.Q4 -- Per-question interpretation

Asked, after the lead-in "Sometimes a change breaks something the author declared. For example, a pipe is deleted, and a declared flow loses its path.": "When a change would break something declared, what should happen?", with the options refuse the change, allow it and show it broken, or repair automatically.\
The picked option's description, in the proposer's wording, read: "The system adjusts on its own (e.g. finds another path), visibly and undoably."\
The director picked **repair automatically** and checked the meaning: "You mean like - delete a pipe and watch a link between 2 nodes re-path?" -- a question the director asked. No reply is recorded as text in the session transcript before the next question, so the example has the standing of a director question.\
The proposer's gloss, that a declared flow would re-route across links at its own layer "in the same way", was not put to the director and bears on no register alternative (PS113's alternatives 4 and 5 especially).\
Asked what happens when no other route exists, the director answered with a hybrid of "show it broken" and "remove it": "I'm thinking a hybrid between 1/3 - a flow that cant route gets visible retracted. If the pipe/link is repaired - the flow automatically heals".

Reading: a flow that cannot route is not deleted and does not block the change; it is visibly retracted, and when the pipe or link is repaired it heals without the author acting on it. The director did not say what is retracted (the flow itself, or only its path) or whether the retraction is stored or derived.\
The behaviour resembles the visible-condition outcome in seeds S13 (register PS221 alternative 1), but the pick does not choose that alternative's mechanism; director statements S14 and S19 bear on the mechanism as recorded there.\
It also bears on the register's PS221 (a declaration its inputs can no longer satisfy), which was intent-silent before this answer.\
Carried to design undecided: whether "repair" applies at every layer (a link re-pathing through pipes, a flow re-routing across links); what counts as "visibly retracted"; whether repair ever changes stored state or only derived state; what happens to a link that cannot re-path when no route exists (the follow-up's options named "the link or flow", and the director answered for a flow); and whether the flow answer extends to other declared things (a spawn, a group member).

### S2.Q5 -- Per-question interpretation

Asked: "What should the first working version demonstrate end to end?", after the lead-in "In Round 1 you said all four payoffs matter. This question asks which one the first working version must show, end to end.", against four options written by the proposer: declare a flow (read by the proposer as parity and expressiveness), the four relations (expressiveness), self-repair (AX1, not a Q1 payoff), and a second world (extensible physics); no option represented Q1 c, fewer concepts.\
The director picked **declare a flow**, whose option description read: "Build a small network, declare a flow between two leaves, and see it routed with a visual flow along it -- the same in browser, CLI and export."\
The director's answer was the bare label. The option's description, and the reading below that it demonstrates two payoffs at once, restate the proposer's own lean given earlier the same day.

Reading: Round 1's "all four payoffs" set what the programme must eventually prove; this sets which proof comes FIRST; the order of the later proofs is not set, and the first slice is the use case the director gave in the Round-1 clarification.\
It demonstrates two payoffs at once -- a new capability (a declared, multi-hop, visibly flowing path) and parity across browser, CLI and export -- so the first slice is judged on both, not on the capability alone.\
Nothing unpicked is dropped: extensible physics and fewer concepts remain required by Q1, the four relations by the director's requirement, and self-repair by Q4; all are later proofs rather than lesser ones.\
Carried to design undecided: how much of the stack the first slice needs (which layers must exist for one flow to be declared and routed), and what "the same in browser, CLI and export" is measured by.

### S2.Q6 -- Per-question interpretation

Asked, with no example shown as text (the proposer's thinking before the question named towers placed mid-simulation; whether it was displayed is not recorded): "When the network changes while things are moving on it, should the change apply from that moment, or as if it had always been so?", with "As if always" described as "Everything is recomputed from the new network, including what was already shown (today's behaviour)."\
The director leaned to **as if always** ("I'm thinking 2 for now"), with a scope reason: "I'm thinking 2 for now - making a game in "read mode" is currently out of scope - we might need to extend history and state for a real tower defense game in future".

Reading: behaviour keeps today's semantics -- what the simulation shows is recomputed from the current board, including what was already shown -- and this is a scoping choice rather than a statement that retroactive recomputation is right for a game.\
A real game, with the history and state it might need, is recorded as anti-goal AG-3 with that revival trigger.\
For the current scope it answers PS421's behavioural question (a change does alter what was already shown), and it bears on PS325 and PS419. Those two ask mechanism questions (an instant or a whole-window fold; which instant a behaviour counts from) that the pick does not settle. All three reopen under AG-3.\
Carried to design undecided: how "as if always" reads for the instants that exist today (spawn.since, reveal.origin; PS419), and which mechanism delivers it (PS325).

**Round-2 composite read:** the round turned two intent-silent areas (Q4, Q6) and one open Round-1 point (Q5) into intent. A declared flow outlives a failure to route: breakage is repaired where it can be and otherwise shown as a visible retraction that heals by itself when the pipe or link is repaired (Q4). The first proof is one declared flow across a small network, the same in browser, CLI and export (Q5). And behaviour keeps recompute-from-the-current-board time, because a real game is out of scope (Q6, AG-3).\
Round 2 sharpened Round 1 rather than changing it: Q4 said how a declared flow behaves when it can no longer route, Q5 chose which proof comes first, and Q6 bounded Round 1's widened reach in time.\
Not asked in Round 2, and carried to design as register entries rather than dropped: whether a persisted src:dst pair is a selection or a declaration (PS220), what "control plane" names (PS227), "fewer concepts" as a payoff beside a noun test that does not require deletion, and the seeds' Round-2 candidate on whether a passing cable terminates where a new link lands (PS117, PS212).

**Round-2 axiom / principle anchoring:** Q4 bears on `VISION.md`'s derived physics (whether retraction and healing are derived or stored is open, S2.Q4) and advances `A5` perceptual parity (the retraction is visible to every viewer; where it is computed is open, PS105, PS127), and `A7` resilient operations (a flow that cannot route heals rather than blocking or silently failing). Q5 puts `A5` parity at the head of the first proof alongside the new capability. Q6 is an `A13` move: the director spends intent on scope, and names the revival (a real game) rather than deciding the time model for it.

---

## S3 Composite intent envelope

The programme unifies what a thing is, what it does and how things connect into one substrate. The director's "We are building a full fidelity network system" holds the connection layers to the fidelity of a real network; whether that network is the engine's own connection model or a domain composed onto a neutral engine is carried to design (register PS101).\
All four payoffs are required -- parity at every door, new expressiveness, fewer concepts, extensible physics -- and none may be spent silently to buy another; the FIRST proof is the director's own use case: build a small network, declare a flow between two leaves, and see it routed with a visual flow along it, the same in browser, CLI and export.

Series, parallel/LAG, multiplex/VLAN and parallel links must all be possible to model, construct and visualise (director: "I think we need to be able to model, construct and visualise all 4 of those in the table"); they are later proofs, not lesser ones.\
Behaviour keeps as-if-always time for now (Q6: "I'm thinking 2 for now").

The substrate reaches through writes, behaviour and events, and stops short of policy (AG-1), a runtime admin portal for managing packs (AG-2) and a playable game and the history and state it might need (AG-3).\
A connection noun is admitted when something attaches to it and an author or agent can see it; it is derived, but its inputs may be persisted (the director's example is a selected src:dst pair; whether such a pair is a selection or a declaration is PS220, carried open by F2 and F7).\
When a change breaks something declared, the system repairs it automatically where it can; a flow that cannot route is visibly retracted, not deleted, and heals automatically when the pipe or link is repaired; whether any of this is stored or only derived is carried to design.\
The model's own vocabulary -- pipe, link, path, flow, and whether they are one primitive or several -- and the layer stack they form are design outputs, explored rather than assumed, with every leaning recorded in the discussion seeds and every alternative carried in the register.

**Final axiom / principle anchoring:** the intent advances `VISION.md`'s north star directly -- a world computed identically by everyone watching, where a consequence is derived rather than stored or sent -- and `A5` perceptual parity is the constraint the first proof is judged on.\
`A3` sovereign composition is implicated by the widened reach and by the plugin and stage vocabulary the director leaned toward, and `A7` shapes how breakage behaves.\
The tension to carry into design: storing inputs (declarations or selections; PS220) is consistent with "not a system that stores what it can derive" only while each stored thing is intent that cannot be derived, and the design must hold that line per noun, per layer.

---

## S4 Scope summary

| Axis | Bound |
|---|---|
| Title | The unification programme -- one substrate for what a thing is, does, and connects to |
| Classification | design-programme |
| Location / scope | the whole product: `model/`, `kernel/`, `engine/`, `server/`, `app/`, `cli/`; design input in `dev/design/unification/` |
| Primary outcome | One substrate whose connection layers meet full network fidelity (engine or domain open, PS101), first proven by declaring a flow across a small network, the same in browser, CLI and export |
| Secondary outcomes | Required, proved after the first slice (later, not lesser): the four wire-to-link relations modelled, built and shown; self-repair with visible retraction; extensible physics; fewer concepts |
| Outcome-axis (primary) | AX2 parity at every door, AX3 expressiveness, AX4 extensible physics, AX1 derived not stored |
| Outcome-axis (secondary) | AX5 conceptual economy |
| Outcome-axis (Round-1) | primary: AX2, AX3, AX4, AX1; secondary: AX5 |
| Outcome-axis (Round-2) | primary: AX1, AX2, AX3; secondary: AX4 |
| Axiom/principle anchors | primary: VISION north star, A5, A3; secondary: A7, A13 |
| Axiom/principle anchors (Round-1) | VISION north star, A5, A3 |
| Axiom/principle anchors (Round-2) | VISION derived physics, A5, A7, A13 |

**Drift check:** AX6, one-way-door risk, was touched by no pick in either round. It is not dropped -- the register carries the one-way door (the `waypoint-` prefix, the stored-shape migration of live diagrams) -- but intent does not yet say how much of it the director will spend, and that is flag F6.

---

## S5 Anti-goals (out-of-scope; deferred)

| AG | Description | Composes-with target |
|---|---|---|
| AG-1 | Policy: permit/deny over flows (Q2 stopped at behaviour and events). | The director's preserved hypothesis in `DECISIONS.md` 2026-09-22; revisit once declared flow pairs and derived paths exist. |
| AG-2 | An admin portal for managing packs at runtime. Director, 2026-09-25: "For now, packs/mods will be fixed server-side, and distributed to clients. A later 'admin portal' for managing packs can be worked on - but out of scope". In scope: a document declares its required packs, from a fixed server-side set delivered to clients and kept in sync per document. | Runtime pack management and publishing; revisit when a pack must change without a server release. |
| AG-3 | A playable tower-defence game in read mode, and the extended history and state it might need. Director, 2026-09-25 (Round 2 Q6): "making a game in "read mode" is currently out of scope - we might need to extend history and state for a real tower defense game in future". Behaviour keeps recompute-from-the-current-board semantics until then. | Revisit when a real game is in scope; the register's time entries (PS419, PS421, PS325) carry the open questions. |

---

## S6 Flags / open questions for the design phase

| # | Flag | Recommendation |
|---|---|---|
| F1 | Q2 widens the substrate's reach beyond the ruled pack scope (appearance + routing) to writes, behaviour and events; `DECISIONS.md` does not yet say so. | Record the widened REACH as a ruling, stating that how writes and behaviour join the substrate (packs, planner passes, or other) is not ruled (PS313, PS422, PS409). |
| F2 | The 09-22 ruling calls selection session state, but the code persists it in the document (`doc.selection`), and Q3's example builds on persistence. | NOT asked in Round 2. Carried to design as register PS220; the director's ruling is needed there. |
| F3 | Behaviour brings time (a clock) into a model ruled as derived from the document. | Established by the reality map (section 2.4); Q6 sets the behaviour for the current scope (as if always); the mechanism entries PS419 and PS325 stay open, and AG-3 holds the rest. |
| F4 | The layer stack (wire, link, path, flow, or fewer) is a design output, and each boundary is a fork: what a layer stores, what it derives, what it may attach to, and whether it has direction. | Design the boundaries one at a time, each with alternatives, before any identifier moves. |
| F5 | Today's `flow` boolean has no layer yet: it could be a one-way constraint on a link, or a one-hop declared flow. | Settle as part of F4, since the answer changes what "declare a flow" means. |
| F6 | Drift: AX6 (one-way-door risk) was touched by no pick in either round. | Ask the director how much one-way-door risk the programme may spend before the design phase places the irreversible steps. |
| F7 | Round-1 tensions not asked in Round 2: selection vs declaration, what "control plane" names, and "fewer concepts" beside a noun test that does not require deletion; also the seeds' Round-2 candidate on whether a passing cable terminates where a new link lands (PS117, PS212). | Carried as register PS220 and PS227, the noun-test entries, and PS117 and PS212; each needs the director in design. |
| F8 | Engine or domain: S1 carries undecided whether the network stack is the engine's connection model or a domain on a neutral engine. | Carried as register PS101; needs the director in design. |
| F9 | Round-2 items carried undecided (S2.Q4, S2.Q5, S2.Q6), including the Q4 pick (refuse offered, not picked) beside the 09-22 ruling that a violation is REFUSED. | Carried as register section 8.3 rows (PS221; PS324; PS325 and PS419; PS106 and PS426; PS109, PS113 and PS116; PS105) and, for a stranded behaviour, the intent-silent PS416 (section 8.2); each needs the director in design. |

---

## S7 Sequencing / cross-work considerations

### S7.1 Branch + review strategy

The design phase follows this survey: the register's questions are taken with alternatives and the director's rulings are recorded in `dev/DECISIONS.md` as they are made, then an independent `M7` axiom audit, then a target architecture and deltas, and only then implementation.

### S7.2 Composability with concurrent / pending work

H16 (B238-B241), four defects the reality map surfaced, was fixed and deployed before this round, at the director's ruling; it is independent of how the programme is designed.\
B242 -- the originating tab dropping a server-derived op that shares a key -- is held for the design phase, because fixing it would choose an answer to register PS321 early.

### S7.3 Compressed-timeline candidate?

No. The director asked for the whole problem space to be carried into a separate design phase before anything is committed; compressing the phases would decide design inside intent capture.

---

## Scalibration -- Calibration data point

- **Stakeholder time-cost (minutes):** 20 (across both rounds) -- the proposer's estimate for answering alone; not measured, because the Round-1 clarifications happened inside a longer design conversation.
- **Comparison baseline:** `dev/surveys/b188-beats-and-stories-survey.md`
- **Notes:** Round 1's option text smuggled mechanisms into options b ("rules that packs contribute and the planner runs") and c ("become packs on anchors"); c was corrected in place when the director's clarification showed it could be wrong, and b after an independent neutrality audit. Round 2 was checked for that before each question was shown, yet the same audit (19 findings across this envelope and the register) found the record's own voice still deciding or widening intent: a mechanism for Q4's retraction, network fidelity for the whole substrate, a proposer gloss credited to the director, dropped hedges. The findings were applied in place, the Round-1 ones under correction banners. Round 2 was delivered one question at a time at the director's request, which made two answers arrive as clarifications or hybrids through Other rather than as bare picks -- more signal than a pick-list alone would have given. The richest intent came from the conversation around Round 1, not from the picks, which argues for recording that conversation (the discussion seeds) as part of the survey's output.

---

## Scontradictory -- Contradictory multi-pick carry-forward

| Round | Question(s) | Picks | Constraint envelope description |
|---|---|---|---|
| 2 | Q4 follow-up (no route to repair onto) | show it broken, remove it | A flow that cannot route is visibly retracted but not deleted, and heals automatically when the pipe or link is repaired: visible like "show it broken", retracted in a sense the director did not define (S2.Q4), and the declaration survives both. |

---

## S8 Cross-references

- **mission-kit `K5` survey** -- the methodology followed
- **`dev/HANDOVER.md`** -- the programme's on-ramp (at `a986fb3`)
- **`dev/DECISIONS.md`** "The universal node, staged" -- the ruled ontology this survey extends
- **`dev/surveys/b188-beats-and-stories-survey.md`** -- prior survey, calibration baseline
- **`VISION.md`** -- source of the outcome axes
- **`dev/design/unification/PROBLEM-SPACE.md`** -- the undecided problem-space register this survey feeds (PS entries; its section 8.2 lists the entries still intent-silent after Round 2, and section 8.3 the further points that need the director)
- **`dev/design/unification/REALITY-MAP.md`** -- the code-grounded map of both tracks and the seam at `a986fb3` (forks F1-F41, defects D1-D48, contradictions C1-C48)
- **`dev/design/unification/DISCUSSION-SEEDS.md`** -- the director's verbatim statements, leanings and questions from the design conversation of 2026-09-25 (S1-S21)

-- Proposer: Claude / 2026-09-25 (Survey envelope; 6 picks captured across 2 rounds)
