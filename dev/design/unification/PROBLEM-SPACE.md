# Unification problem space -- register (UNDECIDED)

## 1. Status

- **Written:** 2026-09-25, against drawv2 at `a986fb3` (branch `main`).
- **This register decides nothing.** It is the input to the design phase: every open boundary the sources show, every visible alternative including the status quo, the recorded positions with their exact standing, the observation that would separate the alternatives, the evidence, and the captured intent that bears on each question.
- **Director leanings are recorded as leanings, never as decisions.** Where a leaning is in tension with a ruling, the two are stated side by side and not resolved.
- **The director's instruction (2026-09-25, envelope, verbatim):** "Let's make sure that when we are ready for round 2, and when we complete the survey - that we have encoded the entire problem space to carry through to design. I don't want this survey to decide the design before we perform that next entire phase." The survey frame was approved by the director on 2026-09-25 (envelope lifecycle-handoff, verbatim): "yes, frame is right ... Proceed".
- **Sources.**
  1. The reality map, landed beside this file as `REALITY-MAP.md` (written 2026-09-25 as `unification-reality-map.md`; code-grounded; its marks are explained in its section 0). "The map" below means this document.
  2. The discussion seeds S1-S21, including S6a, S6b and S6c (`DISCUSSION-SEEDS.md`, landed beside this file): director leanings and questions from a live design conversation on 2026-09-25, recorded verbatim. Seeds S17-S21 were appended after the four parts below were drafted. S17 and S18 are carried by PS125 and PS126, written at assembly; S19, S20 and S21 by PS127, PS128 and PS129, written at audit. A paragraph appended to S21 after the audit (the director's "We can weigh up whether the concept of pipes is a plugin or core") is carried by PS130, also written at audit.
  3. `dev/surveys/unification-survey.md` (the survey envelope): the Round-1 picks, their interpretations, and the director's verbatim clarifications, including the requirement to model, construct and visualise series, parallel/LAG, multiplex/VLAN and parallel links. The envelope is untracked at `a986fb3`.
- **How it was built.** Four parts (frame, Track B, seam, Track A) were drafted separately against the same three sources. At assembly: every dependency reference was converted to register ids with the source id kept; two duplicated entries were merged (PS119 into PS314, PS210 into PS117), and their ids are kept as pointers; entries that overlap without duplicating were cross-referenced; the programme entries (PS5xx), PS125, PS126 and sections 1-4 and 6-9 were written. At audit, PS127-PS130 were written from seeds S19-S21, and the auditors' findings were applied in place.
- **Size.** 114 question entries (PS1xx: 29; PS2xx: 27; PS3xx: 28; PS4xx: 28; PS5xx: 2), plus one cross-reference (PS502) and two merge pointers (PS119, PS210); 96 map defects and contradictions and 4 further verification findings indexed as evidence (section 7); 21 intent-silent entries listed as Round-2 candidates (section 8.2).

## 2. How to read

### 2.1 The entry template

| Field | What it holds |
| --- | --- |
| Title (`### PSnnn. ...?`) | The open question, phrased as a question. |
| Track / layer | Track A (what a thing is and does), Track B (how things connect), seam (where the two meet: the anchor, the `routable` pack, how rules write), frame (the organisation of the whole connection model), or programme (order and process); then the layers the question touches (anchor, pipe, link, path, flow, behaviour, appearance, writes, vocabulary). |
| Covers | The source ids the entry absorbs: map forks (F#), seeds (S#), critic gaps of map section 10.1 (G1-G3), map sections, and defect or contradiction ids where a drafter placed them. |
| The question | One to three neutral sentences. |
| Why it is open | Evidence carried from the map, the seeds and the envelope, with the map's evidence marks and file:line where the map gives them. |
| Alternatives | A numbered list. One entry is marked "(status quo)", and the list ends with "other". Where an implication is given, it is inferred [I] unless marked. The order carries no rank. |
| Recorded positions | Each position with its standing (section 2.2), or "none". |
| Under each frame | How the question reads under FR0-FR3 (section 3), and under the stages axis where that matters. These readings are inferred [I] unless marked. |
| What would separate the alternatives | An observation, test or question for the design phase whose answer would discriminate between alternatives. It is not answered here. |
| Intent bearing | Which Round-1 picks and which verbatim director statements bear on the question, or INTENT-SILENT if none bears on the choice. INTENT-SILENT entries are Round-2 candidates (section 8.2). |
| Depends on / blocks | Register ids, each followed by the source id it came from in parentheses. "PSa-PSb" means every entry in that range. "Related (overlapping, not merged)" names entries that share part of a question without duplicating it. |
| Evidence (defects/contradictions) | Map defects (D#) and contradictions (C#) that are symptoms of the question, or "none". Section 7 indexes them. |

### 2.2 Standing of a recorded position

| Label | Meaning |
| --- | --- |
| RULED | A ruling in the repository record, with its date and source line (for example DECISIONS.md:251). [LOCKED] marks a line the record itself tags as locked. Where a line entered the record with no reason or date given, the entry says so. |
| Record | A statement in the repository record (a spec, a backlog disposition, a code comment) that is not tagged as a ruling. |
| DIRECTOR LEANING / STATEMENT / REQUIREMENT / QUESTION / ANALOGY / CONTEXT / CLARIFICATION / SCOPE | Director text of 2026-09-25, verbatim, carrying the label its source gives it. A leaning is never presented as decided. Some passages carry two labels in two sources (for example DS7 is a "requirement" in the envelope and "leanings" in the seeds); entries state both. Where the source gives no label (seeds S4, S5, and the pipe paragraph of S21), the entry writes "DIRECTOR" and says that the source gives none. |
| AGREED | The seeds' naming note records one line as "AGREED (director, 2026-09-25)": two routing layers, links through pipes and paths over links. It is not in DECISIONS.md, and the seeds file's header reads "Every entry is UNDECIDED". Entries record it with that standing. |
| HYPOTHESIS | A candidate written by the proposer (Claude) in the seeds or the envelope, or a hypothesis the record itself labels as such. |
| Envelope reading | The proposer's interpretation in the envelope; HYPOTHESIS class. |
| DIRECTOR DIRECTION (memory) | A director statement recorded in auto-memory, outside the repository record and the survey. |
| Director amendment / Handover position | Text in HANDOVER.md, attributed there to the director or to the handover author; not a DECISIONS.md ruling. |
| Code fact | A property of the code at `a986fb3`, carried with its evidence mark; not a ruling. |
| none | No recorded position was found by the map or the drafters. |

### 2.3 Evidence marks

The marks are the map's (its section 0):

| Mark | Meaning |
| --- | --- |
| [M-run] | A reader executed repository code in a scratch probe. |
| [M-read] | A reader read the cited source. A claim carried from the map without a mark is [M-read] by the map's rule. |
| [V] | Orchestrator-verified; not re-verified. |
| [S] | Re-read by the map's synthesiser at `a986fb3`. |
| [I] | Inferred; not measured. |
| NOT-CLAIMED | Stated where no one measured. |

Each part marks the record lines its drafter re-read at `a986fb3` while drafting, and the four spellings mean the same thing: "[M-read here]" (Part 1), "[M-read, PS re-read]" (Part 2), "[read for this register]" (Part 3), "[M-read, this part]" (Part 4). "[M-read at assembly]" marks a line re-read while assembling, and "[M-read at audit]" a line re-read while applying the audit. Seed statements written by Claude are carried as [I]; director text inside the seeds is verbatim.

Concordance between the map's readers is not independence: they ran the same repository functions through similar probes, so their agreement is one instrument family (map section 0, cautions). Nobody ran a browser DOM, the draw CLI, the network, `npm run gate` or the test suite for the map; every visual consequence it states is [I].

### 2.4 Ids and references

- **Register ids.** PS1xx frame; PS2xx Track B; PS3xx seam; PS4xx Track A; PS5xx programme. Ids are stable. PS119 and PS210 are merged (section 1) and remain as pointers, so citations to them resolve.
- **Map ids.** F# is a fork in map section 6; D# a defect in map section 9; C# a contradiction in map section 8. "map s3.4", "map 3.4" and "map section 3.4" all mean REALITY-MAP.md section 3.4.
- **G1-G3.** In a Covers line, G1-G3 are the critic gaps of map section 10.1. Inside an evidence mark (for example [M-run G2]) they are the map's gap-fill readers G1-G3, as the map uses them.
- **Readers.** R1-R7 and CR in evidence marks are the map's readers (map section 0).
- **DS1-DS16.** The director statement key in section 2.5. Part 2 cites director statements by DS id; the other parts quote them inline.
- **VF1-VF4.** Verification findings of 2026-09-25 that are not in the map's defect list, minted in this register (section 7.3).
- **Envelope flags.** The survey envelope's flags F1-F5 (its section S6) share labels with map forks F1-F5. The register always writes them as "envelope flag F#" (PS103, PS106, PS220, PS223, PS409, PS419), and a bare F# means a map fork.
- **Dependency cycles.** The Depends-on edges are not acyclic. Three groups depend on each other in a cycle: {PS109, PS110}; {PS409, PS410, PS411, PS413, PS415, PS417}; and {PS104, PS108, PS111, PS117, PS207, PS209, PS211, PS212, PS213, PS215, PS216, PS217, PS218, PS223, PS306, PS307, PS308, PS312, PS313, PS404, PS405, PS407, PS408} (for example PS117 -> PS211 -> PS209 -> PS207 -> PS308 -> PS117). The map's forks were ordered without cycles. Removing the Depends-on edges tagged only with seed ids leaves the graph acyclic (checked at audit), so every cycle passes through at least one edge carried from the seeds, several of them marked [I] by their drafters. Within a cycle, register order is not an order in which each entry's dependencies are answered first. Pairs that depend on each other directly are marked "mutual" on both sides. (Computed at audit by Tarjan's algorithm over every Depends-on line, after PS127-PS130 were added; they join no cycle.)
- **Edges are one-sided.** A Blocks line lists the edges its drafter carried from the map and the seeds. It is not the reciprocal of every Depends-on line elsewhere: 410 edges appear on one side only (counted at audit, after PS127-PS130 were added with reciprocal edges). For example, PS402 lists PS327 under Blocks, but PS327 does not list PS402 under Depends on. To find what an answer unblocks, search the Depends-on lines for the entry's id.

### 2.5 Director statement key (DS1-DS16)

Written by the Track B drafter and moved here unchanged so that the whole register can use it. All are verbatim and dated 2026-09-25, with the standing their source gives them ("wire" means pipe inside seed quotations, per the seeds' naming note).

- **DS1** (envelope, Q3 rationale): "Though it must be derived/computed - its inputs may be persisted to the document: i.e a src:dst node pair may be selected and this persists as state in the control plane, so that a path can be derived across all viewers"
- **DS2** (envelope, clarification): "One of the things I want to be able to do is "declare a path or flow" and have that path/flow - multihop across routed junctions/nodes - have a visual flow element along them."
- **DS3** (envelope, clarification): "Use case here is that we construct a geomtric network of wires or links, and then just declare or reason with lots of permutations of flows between the leaves/endpoints."
- **DS4** (envelope, clarification): "I keen using flow/path and wire/link interchangeably for now, because I am not completely sure if these are mechanically the same primitive or slightly different ones, and I'd like to explore that split."
- **DS5** (envelope, clarification): "Its possible that Links exist, but are derived on top of Wires, and possible that Paths are persistent entities, derived on top of Links, and maybe only some of these items have direction etc."
- **DS6** (envelope, statement): "We are building a full fidelity network system"
- **DS7** (labelled "Director requirement" in the envelope and "DIRECTOR LEANINGS" in seeds S15): "links are only ever between endpoints or junctions (or one to the other). drawing a new link to a bend converts it to a junction (current behaviour). parallelism lives above/abstracted over wires. I think we need to be able to model, construct and visualise all 4 of those in the table." (The four: series, parallel/LAG, multiplex/VLAN, parallel links.)
- **DS8** (seeds S6, DIRECTOR LEANING, "for now", not a ruling): "if wires are between anchors, then a link can only occur between endpoints and junctions in this model. For now I would think wires meeting at an anchor join there - however - a junction is actually links meeting, rather than wires."
- **DS9** (seeds S6c, DIRECTOR LEANING): "A router never bends - this would be a capability/behaviour restriction applied by the 'router node' pack to the anchor system on that node."
- **DS10** (seeds S12, DIRECTOR LEANING): "packs can extend anchor behaviour too, not just restrict." (DIRECTOR QUESTION): "So links, paths, flows are themselves modular decoupled capabilities injected onto our wire primitives with anchors?" (DIRECTOR ANALOGY): "B is more akin to the Kubernetes model I think, where the analogy is that pods are primitives, and deployments extend them etc."
- **DS11** (seeds S14, statement): "Agree that derivations flow up - but a link, path or flow config would need to have some entity persisted into the document (minimal entity/spec) such that the derivation can actually occur." Also: "I keep walking this path - it feels intuitive and mechanical/deterministic."
- **DS12** (seeds S15, DIRECTOR LEANING): "a wire's spec is just its two anchors." (DIRECTOR CONTEXT): "Today - we only support a single link between 2 anchors, but in future we may allow parallel links between 2 anchors."
- **DS13** (seeds S16, statement): "a 'wire' represents an adjacency between anchors as a lowest network primitive. I like wire because it relates to physics of our model, not the physics of the visual diagram it aims to represent. 'wires' more accurately represent physical pipes/conduits through which 'links' can run - so 'links' are probably equivalent to 'cables' in the real world networking. I'm open to thinking about 'pipe' as a term if it helps. paths are logical, flows are specific instances of traffic"
- **DS14** (seeds naming note, DIRECTOR LEANING): "I now like pipe under this model." The same note records, not as a quotation, "AGREED (director, 2026-09-25): there are two layers of routing -- links through pipes, and paths over links." That line is attached to FR3's model, is not in the ruled record, and sits in a seeds file whose header says "Every entry is UNDECIDED".
- **DS15** (seeds S4): "This could potentially allow via to be entirely derived."
- **DS16** (seeds S5): "Using the w key to create a link with bends might also construct wires between the anchors under the hood mechanically."

Further director texts of 2026-09-25 are quoted inline where they bear: the clarification "I guess unification of behaviours here also involves developing the proper "OSI Layered Stack" or equivalent for our drawing system" (envelope), and the question of seeds S17, "So 'linking' might become a modded behaviour over pipes/anchors? would this be different to 'routing/forwarding' capability?" (PS125). The statement of seeds S19 (PS127), the leaning and scope of seeds S20 (PS128; the scope is also envelope AG-2), the question and leaning of seeds S21 (PS129), and the S21 statement on pipes (PS130) are quoted in those entries. So is the preface to the envelope's clarification, "I'm not sure I answered correctly - but I hope my intent is there." (section 8.1).

### 2.6 Words used across the register

- **pipe** is the working label for a unit below the link, which the seeds' naming note calls the conduit ("an adjacency between anchors through which links run", the seeds' wording, which describes FR3); under FR2 links are derived chains of pipes. Using the word decides nothing: PS121 keeps the name open. Seeds S1-S15 wrote "wire" for it, and quotations keep "wire" as recorded.
- **layer** and **stage** both name one level of the connection stack, as the seeds use them; neither word assumes an answer on the stages axis.
- **connection**, inside a question, means whatever unit a frame places between or through anchors: a link in FR0 and FR1; a pipe, or a link running through pipes, in FR2 and FR3.

## 3. The candidate frames

The frames are alternatives. None is chosen, and they are not the only combinations (PS106 lists others). Every entry reads its question under each frame in its "Under each frame" field.

| Label | Definition | Standing |
| --- | --- | --- |
| **FR0 "today"** | Anchors are two kinds (node, waypoint); links stored {src,dst,via}; no pipe; no multi-link path; flow is a per-link boolean; split (browser) and collapse (planner) convert between two encodings of a bend. | The measured status quo (REALITY-MAP.md). Not a proposal. |
| **FR1 "links stored, logical layers above"** | Today's link storage kept; a path layer (derived) and a flow layer (declared src:dst) added above links; no pipe. | A candidate carried from the alternatives listed in seeds S1 ("links stay stored with path+flow above"). No recorded director position. |
| **FR2 "pipe + derived link"** | Pipes stored (a pipe's spec = its two anchors); a link is a DERIVED maximal chain of pipes through continuing anchors; path and flow above. (Seeds S3.) | HYPOTHESIS (seeds S3, Claude, inferred), as seeds S16 qualifies it: split and collapse become derivations only if a link is a derived chain. Director clarification, 2026-09-25 (envelope, DS5), worded as a possibility: "Its possible that Links exist, but are derived on top of Wires". |
| **FR3 "pipe + cable"** | Pipes stored (adjacency/conduit between two anchors); a link is a CABLE that runs through pipes, declared with its own identity; via = the cable's route through pipes (declared, or routed from its ends); aggregation (LAG) and multiplex (VLAN) are logical constructs over cables; path = logical route over links; flow = a specific instance of traffic. Two routing layers: links through pipes, paths over links. (Seeds S16.) | DIRECTOR STATEMENT, 2026-09-25 (seeds S16, DS13): "'wires' more accurately represent physical pipes/conduits through which 'links' can run - so 'links' are probably equivalent to 'cables' in the real world networking"; with the naming LEANING "I now like pipe under this model." (DS14). The register brief calls FR3 the director's current leaning; the seeds label S16 itself a statement. Not a decision. |
| **Stages FIXED** (orthogonal axis) | Link, path and flow are the engine's stack; packs plug contributions into them. | Alternative A of seeds S12. No recorded director position. |
| **Stages AS CAPABILITIES** (orthogonal axis) | A new stage registers like a pack. | DIRECTOR ANALOGY, 2026-09-25 (seeds S12, labelled ANALOGY there): "B is more akin to the Kubernetes model I think, where the analogy is that pods are primitives, and deployments extend them etc." The register brief reads it as a leaning toward B. The seeds label no leaning on this axis, and seeds S20 (Claude's note) records that S12 "stays open". The director's question in the same seed is DS10. A related DIRECTOR LEANING of seeds S21, "plugin is the distribution unit, contributing packs and stages", is carried in PS129. |
| **Two routing layers** | Links through pipes, and paths over links. | AGREED by the director, 2026-09-25 (seeds naming note). Not in DECISIONS.md (section 2.2). Part of FR3's description; how it reads under the other frames is PS113. |
| **"pipe"** | The name for the conduit. | DIRECTOR LEANING (naming), 2026-09-25: "I now like pipe under this model." (DS14). Earlier the same day: "I'm open to thinking about 'pipe' as a term if it helps" (DS13). The naming question itself is PS121. |

## 4. Index

Every entry, in register order. "Intent-silent" is yes where the entry's Intent bearing field reads INTENT-SILENT. "Depends on" lists the register ids named before "Blocks:" in the entry's Depends on / blocks field (ranges expanded).

| Id | Question | Track / layer | Intent-silent | Depends on |
| --- | --- | --- | --- | --- |
| PS101 | Is the connection model part of the engine itself, or a domain composed onto a neutral engine? | frame ; all connection layers (anchor, pipe, link, path, flow) and behaviour | no | none |
| PS102 | What organizes the connection layers, and what fidelity are their boundaries held to? | frame ; all connection layers | no | PS101 |
| PS103 | Are the stages a fixed part of the engine, or capabilities that register the way packs do? | frame ; all connection layers (the stages axis) | no | PS101 |
| PS104 | How do the packs an anchor's composition carries relate to the connection stages, if stages exist? | seam ; anchor, link, path, flow | no | PS103, PS308 |
| PS105 | In which direction does each stage act -- deriving up from the layer below, materializing down into it, or both -- and is any derived state stored? | frame ; all connection layers ; writes | no | PS103, PS101 |
| PS106 | Which connection stages exist at all? | frame ; anchor, pipe, link, logical link, path, flow | no | PS101, PS102, PS103 |
| PS107 | Is there a connection unit below the link -- a pipe -- and is it stored? | B ; pipe, link | no | PS106, PS102 |
| PS108 | Does a pipe carry anything beyond its two anchors? | B ; pipe (and the cut rule of the link layer) | no | PS110, PS109, PS209 |
| PS109 | What is a link relative to the units below it? | B ; link, pipe | no | PS106, PS110, PS102 |
| PS110 | How are series, parallel (aggregation/LAG), multiplex (VLAN) and parallel links each represented, built and shown, and is there a logical-link stage? | B ; pipe, link, logical link, path | no | PS107, PS109, PS106 |
| PS111 | When links can be parallel or aggregated, what does "links meeting" count at a junction? | B / seam ; link, logical link, anchor roles | no | PS205, PS207, PS110 |
| PS112 | Are path and flow one stage or two, and is a path ever declared on its own? | B ; path, flow | no | PS106, PS102 |
| PS113 | What is the unit of routing at each layer, and is it one routing capability reused at more than one layer? | B / frame ; pipe, link, path, flow | no | PS103, PS109, PS112 |
| PS114 | What does each stage persist: a generative spec, a configuring spec, both, or nothing? | frame ; all connection layers ; writes | no | PS106, PS103, PS110, PS109 |
| PS115 | What test admits a field to the stored document? | frame ; all connection layers ; vocabulary | no | PS114 |
| PS116 | Is via stored, stored only as authoring intent, or derived? | B ; link, pipe | no | PS114, PS109 |
| PS117 | Does one drawn bend keep two stored encodings? | B / seam ; link, pipe, writes | no | PS110, PS109, PS116, PS201, PS211 |
| PS118 | Is what an author draws the same thing as what the document stores? | seam ; writes, vocabulary | no | PS116, PS103, PS109 |
| PS119 | Merged into PS314 (where a compile step is computed). | -- | -- | -- |
| PS120 | Where do behaviour, appearance and session state sit relative to the connection stack? | frame / A ; behaviour, appearance | no | PS106, PS101, PS409 |
| PS121 | What is the lowest connection primitive called? | vocabulary ; pipe | no | PS107, PS106 |
| PS122 | What do "link", "path", "route" and "flow" (and "run", "net", "layer") name once the stack is settled? | vocabulary ; link, path, flow | no | PS106, PS109, PS301, PS302, PS213, PS218 |
| PS123 | Which concepts the map found unnamed or multiply named become nouns, by what test, and at which layer? | vocabulary ; all connection layers, and Track A | no | PS106, PS109, PS122 |
| PS124 | What standing does prior art have for the connection layers? | programme / vocabulary ; link, path, flow, routing | yes | none |
| PS125 | Are linking, routing and forwarding one capability or several, and is linking itself a behaviour added over anchors and whatever connection unit lies below the link? | frame / seam ; pipe, link, path, flow, anchor | no | PS103, PS104, PS113 |
| PS126 | Can the connection stack recurse, so that a link rides over a path (overlays and tunnels)? | frame ; link, logical link, path | no | PS103, PS106, PS110 |
| PS127 | Where does derivation run, and where are writes applied: at every peer, at one central point, or split between them? | frame / seam ; all connection layers, behaviour, writes | no | PS103, PS105 |
| PS128 | Does a document declare the packs it requires, and what follows when that set or its version changes? | programme / frame ; writes, vocabulary, all connection layers | no | PS127, PS103, PS304 |
| PS129 | What is the extension unit called, and is the unit a document declares the same as the unit a composition lists on an anchor? | vocabulary / frame ; anchor, all connection layers | no | PS128, PS104, PS103 |
| PS130 | Is the pipe part of the engine's core, present in every world and document, or something only some worlds or documents carry? | frame ; anchor, pipe | no | PS101, PS103, PS107 |
| PS201 | Which connections count as touching an anchor, and is "touching" one relation or several? | B ; anchor, pipe, link | no | none |
| PS202 | Must connection geometry be orthogonal, and if so where is orthogonality produced or checked? | B ; pipe, appearance | yes | none |
| PS203 | Which cells does a multi-cell entity occupy, for placement and for connections? | B ; anchor | yes | PS301, PS302 |
| PS204 | What may a connection reference as its ends and as the points it passes through? | B / seam ; anchor, pipe, link | no | PS301, PS302, PS401, PS402, PS406, PS407, PS408, PS303, PS304, PS305, PS116, PS308 |
| PS205 | When two connections share an anchor, are they connected there, or can one pass the anchor without meeting the other? | B ; anchor, pipe, link | no | PS201, PS116, PS118 |
| PS206 | Can two connections cross between anchors, and what is an overlap of two connections along one grid line? | B ; pipe, appearance | no | PS205, PS202 |
| PS207 | Are the anchor roles (endpoint, bend, junction) facts of one layer, or of different layers? | B / seam ; anchor, pipe, link, path | no | PS201, PS205, PS111, PS308 |
| PS208 | What does an undeclared link assert about direction: flow both ways, nothing, or something else? | B ; link, flow, vocabulary | no | none |
| PS209 | Where a link is a longer unit than what is stored beneath it, what decides where it ends, and where must those inputs be readable? | B / seam ; anchor, pipe, link | no | PS207, PS108, PS308, PS223 |
| PS210 | Merged into PS117 (a pass-through: reading, stored rewrite, or history). | -- | -- | -- |
| PS211 | What is an anchor where exactly two links end and fewer than two of them declare direction? | B ; anchor, link | no | PS201, PS208, PS209 |
| PS212 | When a new connection is drawn to end where another passes through, does the passing one end there too? | B / seam ; anchor, link, writes | no | PS201, PS117, PS211 |
| PS213 | Is there a unit longer than one stored link, through bends, along which a declaration carries? | B ; link | no | PS201, PS117, PS211, PS208, PS223 |
| PS214 | Is `closed` a drawing flag or a fact about topology? | B ; link, appearance | yes | PS213, PS218 |
| PS215 | What makes two connections between the same two anchors distinct? | B ; pipe, link, appearance | no | PS401, PS402, PS406, PS407, PS408, PS110, PS109 |
| PS216 | Where does connection capacity live: per pair, per anchor, per face, per type, per instance, or elsewhere? | B / seam ; anchor, pipe, link | no | PS401, PS402, PS406, PS407, PS408, PS215 |
| PS217 | Where do a connection's identity, name and configured fields live when the thing they describe is derived or re-forms? | B / seam ; link, path, writes | no | PS114, PS110, PS213, PS218, PS209 |
| PS218 | Does a path across several links exist, and what is it derived from? | B ; path | no | PS201, PS117, PS211, PS213 |
| PS219 | When more than one route satisfies a derivation, how does every viewer arrive at the same one? | B ; path, flow | no | PS218 |
| PS220 | Is a persisted src:dst pair a selection, a declaration, or neither? | B / seam ; flow, writes | no | PS213, PS218, PS122, PS226, PS227 |
| PS221 | What happens to a declaration whose inputs can no longer satisfy it? | B / seam ; flow, path, writes, behaviour | yes | PS103, PS220, PS218, PS219, PS217 |
| PS222 | How do many flows sharing one connection stay distinguishable to a viewer? | B ; flow, appearance | no | PS220, PS215, PS110 |
| PS223 | Which layers carry direction, and what is today's `flow` boolean in a layered model? | B / frame ; pipe, link, path, flow | no | PS208, PS213, PS218 |
| PS224 | Does the FRAGMENT ruling apply once direction can live somewhere other than links? | B / frame ; link, flow | no | PS205, PS207, PS223 |
| PS225 | Which direction governs how things move and how a connection is presented? | seam ; flow, behaviour, appearance | no | PS213, PS218, PS223 |
| PS226 | Where does plane (data or control) live, and does a control-plane connection carry traffic? | B / seam ; pipe, link, flow, behaviour | no | PS213, PS218, PS122, PS223, PS108 |
| PS227 | What does "control plane" name? | B / seam ; flow, vocabulary | no | PS213, PS218, PS122 |
| PS228 | What does "projection" name? | seam ; writes, vocabulary | yes | PS313, PS320, PS321, PS316 |
| PS301 | Which concept does the word `anchor` name? | seam ; vocabulary, anchor | no | none |
| PS302 | Is an identity-less position (a bare cell) something a connection may reference? | seam ; anchor, pipe, link | no | PS301 |
| PS303 | What happens to the `waypoint-` id prefix and kind, the named one-way door? | seam ; vocabulary, anchor | no | PS301, PS302, PS401, PS402, PS403, PS404, PS405 |
| PS304 | Which parts of the stack receive identifiers or field names (anchor, pack, composition, pipe), and in what grammar? | seam ; vocabulary, anchor, pipe | no | PS301, PS302, PS401, PS402, PS403, PS404, PS405, PS114, PS107, PS217 |
| PS305 | Is an id-grammar change delivered in place on `/api/v1`, or behind a new API version? | programme ; vocabulary | yes | PS303, PS304 |
| PS306 | Are anchor roles (endpoint, bend, junction) derived for every anchor, or only for waypoint-kind entities, and at which layer is each role a fact? | seam ; anchor, pipe, link | no | PS301, PS302, PS201, PS117, PS211, PS205, PS207 |
| PS307 | If a type limits the roles its anchor may take, what is counted when a node carries several links? | seam ; anchor, link | no | PS117, PS211, PS215, PS216, PS111, PS306 |
| PS308 | If an anchor's behaviour is restricted, does the restriction act as a refusal, as an input to the derivation (a cut), or both? | seam ; anchor, pipe, link | no | PS117, PS211, PS205, PS207, PS209, PS103, PS104, PS109, PS306, PS307 |
| PS309 | If anchor behaviour is restricted, is the restriction read per composition type or per instance? | seam ; anchor, behaviour | no | PS401, PS402, PS409, PS418, PS308 |
| PS310 | Is what an anchor does only ever narrowed by what the entity is, or can it also be extended, and through what? | seam ; anchor, behaviour, path, flow | no | PS103, PS104, PS411, PS412, PS413, PS308, PS306 |
| PS311 | If more than one source restricts or extends one anchor, how do they combine, and can that case arise? | seam ; anchor, appearance, behaviour | no | PS308, PS310 |
| PS312 | Do the bend conversions (split and collapse) remain derived writes, become derivations, or become authored operations? | frame ; writes, link, pipe | no | PS106, PS117, PS211, PS109, PS205, PS212 |
| PS313 | Does anything other than an author's literal op change the document, and if so, what does it return, who applies it, and how does the result reach validation and undo? | seam ; writes | no | PS403, PS404, PS405, PS312 |
| PS314 | Is an authored connection expanded into different stored writes (including any split), and if so where, and by one function for every door? | seam ; writes, link, pipe | no | PS117, PS211, PS205, PS212, PS312, PS313, PS116, PS118, PS103 |
| PS315 | What triggers the collapse: a link-delete op, the resulting state, a genuine loss, or nothing? | seam ; writes, link | yes | PS117, PS211, PS312, PS313, PS314 |
| PS316 | How do derived writes compose and order within one transaction, and does a write re-enter later passes? | seam ; writes | no | PS313, PS315, PS311 |
| PS317 | What validation does a derived write receive? | seam ; writes | yes | PS406, PS407, PS408, PS313, PS315, PS316 |
| PS318 | If anchors carry restrictions, where are they enforced? | seam ; writes, anchor | no | PS306, PS307, PS317, PS308 |
| PS319 | Are undo and redo validated, and what does "restored" mean for an undo? | seam ; writes | yes | PS317, PS316 |
| PS320 | Which derived writes does a client predict locally, and with what code? | seam ; writes | no | PS314, PS315, PS317, PS316 |
| PS321 | How does the originating client reconcile its local state with the server's planned result? | seam ; writes | no | PS314, PS315, PS317, PS316, PS320 |
| PS322 | Is `pinned` stored intent that a write must clear, something derived, or permanent intent? | seam ; anchor, writes | no | PS313, PS314 |
| PS323 | Where does a rule that both kernel/ and model/ need live: a shared module, test-held twins, or one owner? | seam ; anchor, link, writes | no | PS117, PS211, PS313 |
| PS324 | What does a type change do to an anchor's existing links and permission? | seam ; anchor, link, writes | yes | PS401, PS402, PS306, PS307, PS308, PS309, PS313, PS318 |
| PS325 | Does a recomposition take effect from an instant, or does the behaviour fold reread the whole window? | seam / A ; behaviour | yes | PS409, PS418, PS419, PS420, PS421, PS324 |
| PS326 | Can an entity change between the waypoint and node kinds in place, keeping its identity? | seam ; anchor, vocabulary | no | PS401, PS402, PS303, PS324 |
| PS327 | When a stored shape changes, what happens to the log's stored inverses, and when is the migration code deleted? | seam / programme ; writes | yes | PS303, PS305, PS319, PS128 |
| PS328 | Which derived connection state must an agent be able to read through REST and the CLI, and computed where? | seam ; anchor, link, path | no | PS117, PS211, PS213, PS218, PS306, PS217 |
| PS401 | What does a node's `type` resolve to? | A ; anchor (composition), vocabulary | no | none |
| PS402 | Where, if anywhere, is the node type vocabulary closed, and from which list? | A ; vocabulary, writes (validation) | no | PS401 |
| PS403 | Which node features are universal, and which do only some nodes have? | A / seam ; anchor, appearance | no | PS301, PS302, PS401, PS402 |
| PS404 | What is a name for, and where is it minted and changed? | A / seam ; vocabulary, writes | no | PS301, PS302, PS401, PS402, PS217 |
| PS405 | Is reachability by connections universal to anchors, and what does reachability alone permit? | seam ; anchor, link, pipe | no | PS301, PS302, PS401, PS402, PS205, PS207, PS209, PS308 |
| PS406 | Are containers (zone, group) part of the anchor model, and can connections reach them? | A / B ; anchor, link | yes | PS301, PS302 |
| PS407 | What are port, junction pad, crossing pad and tunnel-gap in the document, if anything? | A / B ; anchor, appearance | no | PS301, PS302, PS205, PS212, PS110, PS109 |
| PS408 | What keeps a container's membership true when a write the author did not request removes a member? | seam ; writes, anchor | yes | PS406, PS407, PS313 |
| PS409 | What does a behaviour attach to, and how does it join the substrate? | A / seam ; behaviour, flow, path, link, anchor | no | PS401, PS402, PS403, PS404, PS405, PS417, PS213, PS218, PS220, PS106, PS101, PS103, PS114, PS109 |
| PS410 | Is the director's visual flow element the same construct as a mover? | A / seam ; behaviour, appearance, flow | no | PS409, PS109, PS213, PS218, PS122, PS220 |
| PS411 | What unit does a mover travel? | seam ; behaviour, link, path, flow | no | PS201, PS117, PS211, PS205, PS212, PS213, PS218, PS225, PS226, PS227, PS409, PS410, PS109, PS113 |
| PS412 | What decides where traffic goes next at an anchor where connections meet? | seam ; behaviour, path, anchor | no | PS213, PS218, PS225, PS226, PS227, PS219, PS103, PS104, PS113 |
| PS413 | When an emitter has several candidate connections, which does emission use: one, several, or all? | seam ; behaviour, link | no | PS201, PS411, PS412, PS409 |
| PS414 | Do drawing and behaviour predicates read one derived role set? | seam ; anchor, behaviour, appearance | yes | PS201, PS117, PS211, PS306, PS307, PS207 |
| PS415 | What decides eligibility to emit, and at which doors is it decided? | seam ; behaviour, anchor, writes | no | PS401, PS402, PS201, PS117, PS211, PS205, PS212, PS306, PS307, PS411, PS412, PS413 |
| PS416 | What governs removing a behaviour whose host no longer qualifies for it? | seam ; behaviour, writes | yes | PS414, PS415, PS417, PS315, PS221 |
| PS417 | What does a spawn configuration belong to? | seam ; behaviour, anchor, link, flow | no | PS403, PS404, PS405, PS414, PS415, PS409 |
| PS418 | Where do a behaviour's tuning numbers live? | A ; behaviour, vocabulary | no | PS401, PS402, PS417, PS114 |
| PS419 | What instant does a behaviour's time count from? | A ; behaviour | yes | PS409, PS418 |
| PS420 | Which clock stamps a behaviour's instant, and which clock does each simulating door read? | A / seam ; behaviour, writes | no | PS419 |
| PS421 | Does a change to the board change what the simulation has already shown? | A ; behaviour | yes | PS409, PS418, PS419 |
| PS422 | What is a rule, and may it write? | A ; behaviour, writes, vocabulary | no | PS313, PS105 |
| PS423 | What is an event in the substrate? | A ; behaviour, vocabulary | no | PS422, PS221 |
| PS424 | What shape does appearance derivation take across kinds, and how do competing contributions resolve? | A ; appearance | no | PS403, PS404, PS405, PS406, PS407, PS408, PS222, PS110 |
| PS425 | Is selection-driven appearance derived state or session decoration? | A ; appearance, vocabulary | no | PS424, PS220 |
| PS426 | Who owns a look: the stylesheet or the derived attribute? | A ; appearance | no | PS424, PS425 |
| PS427 | What does the design phase carry about policy while AG-1 keeps it out of scope? | A ; flow, behaviour, vocabulary (anti-goal AG-1) | no | PS226, PS227, PS417, PS220 |
| PS428 | What is the cursor-addressed story step, and what is it called? | A ; behaviour, vocabulary | yes | none |
| PS501 | In what order are the programme's questions taken: extract a pack from what is built, design the write seam first, build the pipeline first, or some other order? | programme ; writes, all connection layers | no | PS103, PS313, PS328 |
| PS502 | Cross-reference to PS328, not a separate entry: is every derived stage readable at the agent doors (CLI and REST), as GR18 and A5 require? | programme ; agent doors | -- | see PS328 |
| PS503 | How do the defects surfaced by the map and by verification relate to the programme: fixed independently, held as evidence for the design phase, or both? | programme ; all layers | yes | PS501 |

## 5. Register entries

The four drafted parts follow in the order frame, Track B, seam, Track A. Each drafter's text is kept; at assembly only the dependency lines were rewritten to register ids, two duplicated entries were merged, frame keys repeated in each part's preamble were replaced by section 3, the Track B director statement key moved to section 2.5, four intent lines that cited the Round-1 axis AX1 as a Q1 option were corrected to cite AX1 as a Round-1 axis (PS209, PS213, PS217, and the merged PS117), and three field markers were normalised to the template (the Alternatives label of PS106 and PS122, and the status-quo marker of PS108). Entries that overlap without duplicating name each other in a "Related (overlapping, not merged)" note on their Depends on / blocks line.

## 5.1 Part 1 -- The frame: the boundaries every other entry depends on (PS101-PS130)

This part carries the large boundaries of the connection model: whether it belongs to the engine or to a domain, what organizes its layers, which layers exist and what each stores, what a link and a via are, how multiplicity and routing sit in the stack, how authored verbs relate to stored forms, and what the nouns are called.
Every entry is undecided: the alternatives include the status quo, they are not ranked, and each recorded position carries its exact standing.
"Layer" and "stage" both name one level of the connection stack, as the seeds use them; neither word assumes an answer on the stages axis.
"Pipe" is the working label defined in section 2.6 (the seeds' naming note of 2026-09-25 calls it the conduit); seeds S1-S15 wrote "wire" for it, and quotations keep "wire" as recorded.
The frame labels are defined in section 3. Marks are carried from the reality map with the claim (section 2.3); seed statements written by Claude are carried as [I]; **[M-read here]** marks a record line or file re-read at a986fb3 while drafting this part.
Assembly notes: PS119 is merged into PS314 (Part 3), and PS210 (Part 2) is merged into PS117. PS125 and PS126 were written at assembly from seeds S17 and S18. PS127, PS128 and PS129 were written at audit from seeds S19, S20 and S21, and PS130 from the paragraph appended to S21 after the audit.

### PS101. Is the connection model part of the engine itself, or a domain composed onto a neutral engine?
- **Track / layer:** frame ; all connection layers (anchor, pipe, link, path, flow) and behaviour
- **Covers:** S2; prior art (prismv2 as a separate kernel/core engine concept; mission-kit P4, cited by seeds S2)
- **The question:** The director describes "a full fidelity network system"; VISION.md describes "a programmable geometric engine" whose pilot is tower defence. Is a network stack the engine's own connection model, or one domain among others composed onto a neutral core?
- **Why it is open:**
  - VISION.md:15 "drawv2 is a programmable geometric engine."; VISION.md:37 "Tower defence is the **pilot**: it earns its place by exercising the engine harder than the editor does, and every capability it needs is built as a general one."; VISION.md:126 "a second, unlike world running on the same engine is the point at which the engine is real rather than argued" [M-read here].
  - Director statement, 2026-09-25 (envelope S1.Q3): "We are building a full fidelity network system".
  - The pilot's traffic already travels along connection geometry: each mover travels ONE link's path, oriented away from the armed end, and is consumed at the far end; it reads neither flow, nor control, nor roles (spawners.mjs:30-49 [S]; movers.mjs:72-79, 107-163 [M-run R4]).
  - Junction forwarding (clone, round robin, route) is designed and unbuilt (ATOMICS.md:340-349); BOARD.md:849 puts "packet movement over the graph" out of H15 [M-read].
  - Layering today: kernel/ and model/ do not import each other [V]; engine/ imports both (movers.mjs:38-39; spawners.mjs:23; rules.mjs:40; situation.mjs:28-29), against three sovereignty claims (C15) [M-read].
  - "control plane" already carries a network sense (link.control) and an architectural sense ("control plane computed server-side, browser a stateless data plane", ATOMICS.md:348-349) (map s1.2 control/plane row) [M-read].
  - Prior art: prismv2 is "a separate kernel/core engine concept; derived relations over observed primitives (EDB/IDB); firewall/route-map/conntrack/k8s lineage. engine/ here is its banked substrate" (seeds, prior art). mission-kit P4: "Neutral core + tenant composition - shared mechanism, injected semantics, promote down by evidence", opened when "A second domain is about to grow a mechanism the first already has" [M-read here, scratchpad copy of mission-kit INDEX.md].
- **Alternatives:**
  1. (status quo) No named connection stack: connection lives in model/ (stored links, invariants) and kernel/ (roles, geometry), and the pilot's behaviour in engine/ reads one link at a time. Implies each new layer is placed case by case.
  2. The network stack IS the engine's connection model. Implies every world on the engine, the pilot included, sees pipes, links, paths and flows in network terms, and movers become traffic in the network sense.
  3. A neutral connection core (route through a graph, derive a path from a declaration) composed by a network domain and by the pilot (the mission-kit P4 shape). Implies the core carries no network-only semantics (plane, VLAN).
  4. Two stacks, one per domain. Implies two routing mechanisms if both route.
  5. The engine is anchors + pipes + a capability mechanism, and the network stack and the pilot are two capability sets (seeds S12 alternative B, offered there as "an answer to S2"). Implies PS103 is answered AS CAPABILITIES.
  6. other.
- **Recorded positions:**
  - RULED: none on this question.
  - DIRECTOR STATEMENT, 2026-09-25 (envelope S1.Q3): "We are building a full fidelity network system". The envelope carries engine-versus-domain "to design undecided".
  - VISION.md (record, direction): "a programmable geometric engine"; the pilot is tower defence.
  - DIRECTOR ANALOGY, 2026-09-25 (seeds S12): "B is more akin to the Kubernetes model I think, where the analogy is that pods are primitives, and deployments extend them etc." It bears here only through alternative 5.
  - HYPOTHESIS (seeds S12, Claude): stages as capabilities answer S2 by making the network stack and the pilot capability sets.
- **Under each frame:**
  - FR0: the question reads as "is the stored link an engine concept or a network concept"; movers use the link directly.
  - FR1: the added path and flow layers sit either in the engine or in a network domain; movers could travel paths.
  - FR2, FR3: the pipe is a candidate engine primitive ("the physics of our model", director, seeds S16); link or cable, LAG, VLAN, path and flow could sit on either side. FR3's LAG and VLAN carry network-only names.
  - Stages axis: under stages FIXED, the stack's membership is an engine decision, so this question decides what is in it; under AS CAPABILITIES it becomes which capability sets ship with the engine.
- **What would separate the alternatives:** Name one connection concept the pilot needs and the network does not, or the reverse, and check whether both live at one layer (for instance: does a mover choose at a junction by the same rule a flow's path is derived by?). Seeds S12's test: "will a second, different set of stages ever run over the same wires (pilot pathing by other rules, another domain)?", with the seeds' caution that VISION's second world "is direction, not evidence".
- **Intent bearing:** Q2 c (reach: "Appearance, routing, writes, and the pilot's physics become one substrate; policy does not"); Q1 d (AX4: "A new capability or behaviour arrives without an engine change"); Q1 c (AX5); director: "We are building a full fidelity network system"; director: "I guess unification of behaviours here also involves developing the proper 'OSI Layered Stack' or equivalent for our drawing system".
- **Depends on / blocks:** Depends on: none. Blocks: PS106 (S1), PS103 (S12; mutual, since seeds S12 offers an answer to S2), PS102 (S16), PS409 (S11, F30), PS418 (F30), PS411-PS413 (F27), PS130 (S2). Related (overlapping, not merged): PS129.
- **Evidence (defects/contradictions):** C15, C16, C18; D9, D10 (the pilot's traffic ignores the declared plane and flow).

### PS102. What organizes the connection layers, and what fidelity are their boundaries held to?
- **Track / layer:** frame ; all connection layers
- **Covers:** S1 (the stack as "OSI Layered Stack or equivalent"; the candidate stack as one alternative); S16 (the physical/logical description)
- **The question:** The director asks for "the proper 'OSI Layered Stack' or equivalent" and describes a physical half (pipes, cables) and a logical half (paths, flows). What principle decides where one layer ends and the next begins, and what reference model is a boundary checked against?
- **Why it is open:**
  - Director clarification, 2026-09-25 (envelope): "I guess unification of behaviours here also involves developing the proper 'OSI Layered Stack' or equivalent for our drawing system".
  - Director statement, 2026-09-25 (seeds S16): "a 'wire' represents an adjacency between anchors as a lowest network primitive. I like wire because it relates to physics of our model, not the physics of the visual diagram it aims to represent. 'wires' more accurately represent physical pipes/conduits through which 'links' can run - so 'links' are probably equivalent to 'cables' in the real world networking. I'm open to thinking about 'pipe' as a term if it helps. paths are logical, flows are specific instances of traffic".
  - Seeds S1 candidate (Claude, "ONE alternative among several") [I]: "Space (anchor) / Wire (stored, undirected) / Link (derived run of wires through bends) / Path (derived route across the link graph) / Flow (declared src->dst, directed) / Behaviour / Presentation (cross-cutting) / Session (decorates)."
  - The code has no layer model for connection: the stored connection entity is the link, with roles derived for waypoints (map s3.1, s3.3). The 2026-08-19 taxonomy is anchor -> route -> path -> link (HIERARCHY.md:37-48) [LOCKED], a geometric pipeline rather than a network stack (map s1.2) [M-read].
  - "Layer" is already in use: waypointLayers is an appearance layer list (geometry.mjs:297-309); the ontology says a node "is not a LAYER: nothing sits between the anchor and its packs" (DECISIONS.md:301) [M-read here].
  - Envelope reading (proposer): "the connection layers are to be held to the fidelity of a real network (layers, forwarding, flows, direction where a network has it), not to the fidelity of a diagram of one."
- **Alternatives:**
  1. (status quo) No layer model: connection concepts are organized by stored entity kind (link, waypoint), derived roles, and the geometric route -> path pipeline of HIERARCHY.md:37-48.
  2. An OSI-style stack: numbered layers, each offering a service to the one above and reading only the one below.
  3. A physical/logical split as the director describes it (seeds S16): physical = pipe (conduit) and link (cable); logical = aggregation and multiplex constructs, path, flow.
  4. A uniform stage shape with no network reference model: each stage = minimal persisted spec + derivation (seeds S14), and a boundary sits wherever the spec changes kind.
  5. Boundaries drawn by the survey's Q3 noun test: a layer exists where something attaches to it and an author or agent can see it.
  6. Seeds S1's candidate stack as quoted above.
  7. other.
- **Recorded positions:**
  - RULED 2026-08-19 [LOCKED] (HIERARCHY.md:37-48): route = ordered list of anchors; path = ordered list of coordinates with no identity; link = route + identity + closed.
  - DIRECTOR STATEMENTS, 2026-09-25: "OSI Layered Stack or equivalent"; "full fidelity network system"; the seeds S16 physical/logical description quoted above.
  - AGREED (seeds naming note, 2026-09-25; recorded in the seeds' own words, not as a director quotation; not in DECISIONS.md; the seeds header reads "Every entry is UNDECIDED"): two layers of routing -- links through pipes, and paths over links.
  - HYPOTHESIS (seeds S1, Claude): the candidate stack, as one alternative among several.
- **Under each frame:**
  - FR0: there is no stack; the question is whether to have one.
  - FR1: anchor / link (stored) / path / flow; a physical/logical line would sit between link and path.
  - FR2: anchor / pipe / link (derived) / path / flow; the link is derived, yet physical in the director's S16 terms.
  - FR3: anchor / pipe / cable / logical constructs / path / flow, with two routing layers; the physical/logical line sits between the cable and the logical constructs (seeds S16 reading) [I].
  - Stages axis: under AS CAPABILITIES the organizing principle has to be expressible as stage dependencies (seeds S12: "B demands: stage dependencies and stratified evaluation order").
- **What would separate the alternatives:** Find a case the reference models place differently. Is a VLAN (multiplex) its own layer (an OSI sub-layer), an attribute of a cable (a cabling view), or a constraint on a path? Does the pilot's mover need a layer the network model lacks? Is a boundary checked against a real network, a diagram notation, or "the physics of our model, not the physics of the visual diagram" (director, seeds S16)?
- **Intent bearing:** Director statements as quoted; Q1 b (AX3) and Q1 c (AX5) pull on how many layers there are, and the Q1 reading says "the programme may not trade one away silently"; Q3 abc (a noun needs attachment and visibility, and is derived with persisted inputs).
- **Depends on / blocks:** Depends on: PS101 (S2). Blocks: PS106 (S1, stage membership), PS103 (S12), PS114 (S14), PS110 (S15), PS109 (S16), PS122 (F10). Related (overlapping, not merged): PS126.
- **Evidence (defects/contradictions):** C11 (the planned scanner rules for `anchor` and `wire` were never built); C12 (HIERARCHY's {from,via,to} shapes against code); C44 (orthogonal routing in principle, polylines in code).

### PS103. Are the stages a fixed part of the engine, or capabilities that register the way packs do?
- **Track / layer:** frame ; all connection layers (the stages axis)
- **Covers:** S12 (stages FIXED vs AS CAPABILITIES; the director's question; the Kubernetes analogy and where it holds; the part of the analogy about who writes is PS105)
- **The question:** If connection layers exist, is their set fixed by the engine, with packs contributing into link, path and flow? Or is each stage itself a registered capability, so that a new stage (bundles, tunnels, a pilot's own pathing) arrives without an engine change?
- **Why it is open:**
  - DIRECTOR QUESTION, 2026-09-25 (seeds S12): "So links, paths, flows are themselves modular decoupled capabilities injected onto our wire primitives with anchors?"
  - DIRECTOR ANALOGY, 2026-09-25 (seeds S12): "B is more akin to the Kubernetes model I think, where the analogy is that pods are primitives, and deployments extend them etc."
  - Seeds S12 (Claude) [I]. B buys "extensible physics by construction, one mechanism, and an answer to S2". B demands "stage dependencies and stratified evaluation order (prismv2 layered derivation); multiple attachment scopes (anchor, wire, whole graph, declaration); every stage pure, deterministic and shared by every door (kernel/ and model/ deliberately do not import each other today); stable addresses for derived entities."
  - Seeds S12, where the analogy holds [I]: "primitives vs extended kinds (pod ~ wire/anchor); CRD + controller ~ registering a new stage without a core change; spec vs status ~ stored declaration vs derived state ...; labels/selectors ~ capabilities applying by type".
  - Code: pack, composition, routable and capability (in the ruled sense) have no code (map s1.3, ABSENT rows). Capability-shaped mechanisms exist under other names: field-presence gates (content, span, spawn, pinned) and per-type tables (GLYPH_BB/GLYPH_DEFS, TOWERS) [M-read R5]. The engine's DERIVATIONS table is a registration point that has held one entry since 42b70e1 (C18) [M-read]. No composes/priority resolver exists [V].
  - "Every stage shared by every door" does not describe today's derivations: facing, samePlane and the termination predicate are restated across kernel/ and model/ (map s4.5) [V for the layering rule], and the role derivation is not readable at REST or the CLI (map s10.1 critic gap 1) [M-read critic].
  - Lineage (seeds S12): the prismv2 record traces "k8s (resources, status.conditions, selectors, level-triggered) -> Datalog/RETE/incremental view maintenance".
- **Alternatives:**
  1. (status quo) No stage mechanism: behaviour is gated by kind in 34 places across 17 files and zero sites gate on a declared capability (map s2.1) [M-read R5]; each derivation is a free function called by its consumers.
  2. Stages FIXED: link, path and flow (and pipe, if it exists) are the engine's stack; packs plug contributions into them.
  3. Stages AS CAPABILITIES: each stage registers like a pack, declaring what it reads and what it derives; the engine evaluates registered stages in dependency order.
  4. Hybrid: a fixed physical core (anchor, pipe or link) with the logical stages (path, flow, others) registered as capabilities.
  5. other.
- **Recorded positions:**
  - RULED 2026-09-19 ("The universal node, staged", DECISIONS.md): "A node declares CAPABILITIES; a capability contributes visual layers and behaviour, derived from the document." and "A capability that needed stored state would be a different and more expensive class, and none is proposed." [M-read here]
  - RULED 2026-09-22 (DECISIONS.md:278-302): a pack is "one capability, composable onto an anchor"; two families are in scope, appearance and routing, "Both are DERIVED and stateless"; policy is out of scope.
  - DIRECTOR ANALOGY, 2026-09-25 (seeds S12), quoted above; the seeds do not label it a leaning, and seeds S20 (Claude's note) records that S12 "stays open".
  - DIRECTOR LEANING, 2026-09-25 (seeds S21): "plugin is the distribution unit, contributing packs and stages" (PS129). Seeds S20 (Claude) [I]: extensible physics "remains an ARCHITECTURAL property ... so S12 (stages fixed vs as capabilities) stays open."
  - Side by side, not resolved: the ruled pack is "composable onto an anchor" (DECISIONS.md:299), while alternative 3 needs attachment scopes beyond the anchor (pipe, whole graph, declaration) per seeds S12. Survey Q2 c also widens the ruled two families to writes, behaviour and events, which DECISIONS.md does not yet record (envelope flag F1).
- **Under each frame:**
  - FR0: no stages exist to fix or register; the axis applies to whatever is added.
  - FR1: path and flow are the candidate registered stages over a fixed stored link.
  - FR2: the link becomes a derivation over pipes, so under AS CAPABILITIES the link is itself a registered stage.
  - FR3: two routing layers; seeds S16: "one routing capability reused at two layers is a direct test of S12's stages-as-capabilities" (PS113). LAG and VLAN are candidate registered constructs.
- **What would separate the alternatives:** Seeds S12: "will a second, different set of stages ever run over the same wires (pilot pathing by other rules, another domain)?" Does any proposed stage need an attachment scope other than an anchor? Can two registered stages need an evaluation order the engine does not know in advance?
- **Intent bearing:** Q1 d (AX4: "A new capability or behaviour arrives without an engine change"); Q1 c (AX5: one mechanism vs several); Q2 c (reach includes behaviour and events); the director's question and analogy quoted above.
- **Depends on / blocks:** Depends on: PS101 (S2; mutual). Blocks: PS114 (S14), PS113 (S16, routing reuse), PS314 (S5, where a compile step lives), PS313 (F17), PS323 (F24), PS501 (F39), PS127 (S19), PS128 (S20), PS129 (S21), PS130 (S21).
- **Evidence (defects/contradictions):** C10 (the capability probe's circular citation), C15, C18, C20 ("LINKS DONE" for composes/priority), C21.

### PS104. How do the packs an anchor's composition carries relate to the connection stages, if stages exist?
- **Track / layer:** seam ; anchor, link, path, flow
- **Covers:** S12 (Claude's observation that packs and layers are orthogonal axes; the director's leaning that packs can extend anchor behaviour, not only restrict it)
- **The question:** A composition (server, router) is a set of packs on an anchor. If stages exist, does one pack contribute to several stages at its anchor, and may a pack only restrict what a stage derives there, or also extend it?
- **Why it is open:**
  - Seeds S12 observation (Claude) [I]: "packs and layers are orthogonal axes. One pack contributes to several stages at one anchor: router = link stage always cuts (restrict), path stage forwards/transit (extend); server = link stage endpoint only, path stage terminates only."
  - DIRECTOR LEANING, 2026-09-25 (seeds S12): "packs can extend anchor behaviour too, not just restrict."
  - DIRECTOR LEANING, 2026-09-25 (seeds S6c): "A router never bends - this would be a capability/behaviour restriction applied by the 'router node' pack to the anchor system on that node."
  - Code: no pack and no permission table (H15.7 TODO); roles are derived for the waypoint kind only (kernel/engine.mjs:67; renderer.js:309) [S], so a node with three terminations gets no junction (F16) [M-read].
  - `routable` (topology, permission, write) and the ATOMICS "routing capability" (forwarding, ATOMICS.md:353-354) are not reconciled (F27) [M-read].
- **Alternatives:**
  1. (status quo) No packs in code; roles derived only for waypoints; node.type feeds glyph and TOWERS through separate tables (map s2.2).
  2. One pack per stage: a composition carries a separate pack for each stage it affects.
  3. One pack spans stages: a pack declares a contribution to each stage it touches at its anchor (the seeds S12 observation).
  4. Packs only restrict what the stages derive at an anchor (the ruled permission table read as restriction).
  5. Packs restrict and extend, for instance forwarding or fan-out added at the path or flow stage (the director's leaning).
  6. Packs and stages are one axis: a stage is a pack attached at a wider scope (one reading of PS103 alternative 3).
  7. other.
- **Recorded positions:**
  - RULED 2026-09-22 (DECISIONS.md:237-260): "A type DECLARES which variants it permits"; "A router permits endpoint and junction but never bend"; "A compute or server glyph permits endpoint alone"; "PER TYPE, not per instance"; "A violation is REFUSED, in the validator".
  - DIRECTOR LEANINGS, 2026-09-25: extend as well as restrict (seeds S12); router-never-bends as a pack restriction on the anchor system (seeds S6c).
  - Side by side, not resolved: the ruling places permission as a refusal in the validator; the S6c leaning places it as a restriction the pack applies to the anchor system, which seeds S6c reads as possibly a cut rather than a refusal.
  - HYPOTHESIS (seeds S12, Claude): orthogonal axes, as quoted.
- **Under each frame:**
  - FR0: only waypoints derive roles, so a pack would first reach the role derivation.
  - FR1: a pack's contributions divide between the link layer (roles, permission) and path/flow (forwarding, termination).
  - FR2: a restriction at an anchor changes where derived links are cut (seeds S6c), so a pack contribution changes link identity [I].
  - FR3: a restriction at an anchor governs whether a cable may end or pass there, and forwarding at the path stage.
  - Stages axis: under AS CAPABILITIES the question also asks how a stage capability and a pack capability compose at one anchor.
- **What would separate the alternatives:** For a router anchor and a server anchor, list every derived fact that changes when the pack is added. Do those facts belong to one stage or several, and is any fact added rather than removed? Seeds S6c lists items still open inside this: how two packs' restrictions combine on one anchor, and which restrictions a derivation can honour and which only a refusal can.
- **Intent bearing:** Q2 c (routing and behaviour in one substrate); Q1 d (AX4); Q1 b (AX3); the director's leanings quoted above.
- **Depends on / blocks:** Depends on: PS103 (S12, stages axis), PS308 (S6c; mutual). Blocks: PS306, PS307 (F16), PS411-PS413 (F27), PS414, PS415 (F28), PS324-PS326 (F41), PS409 (S11), PS129 (S21). Related (overlapping, not merged): PS310, PS125.
- **Evidence (defects/contradictions):** C10, C21; D8 (the arming gates disagree on junction and T).

### PS105. In which direction does each stage act -- deriving up from the layer below, materializing down into it, or both -- and is any derived state stored?
- **Track / layer:** frame ; all connection layers ; writes
- **Covers:** S12 (where the Kubernetes analogy strains: controllers write lower objects and store status, against derivation up); S14 (the director's "derivations flow up")
- **The question:** A Kubernetes controller writes lower objects and records status; a drawv2 derivation is computed by every observer and never sent. For each stage, does it only derive from below? Does authoring at that stage write lower primitives? Is any result (a status, a condition, a derived link) ever persisted?
- **Why it is open:**
  - Seeds S12 strains [I]: "k8s controllers WRITE lower objects and store status; here higher stages DERIVE from lower primitives, every observer computes them, nothing is written ('a consequence is never sent', VISION). So each stage has a DIRECTION: materialize DOWN (authoring: the w gesture compiles a link into wires; a declared flow) is k8s-like; derive UP (the link a viewer sees; a flow's path) is view-like."
  - VISION.md:81: "A consequence is never sent, because sending it would tell a peer something it could have worked out." [M-read here]
  - Engine derivations "may not write" (rules.mjs:32-35), ruled 2026-09-01 and recorded only in that code comment (C37) [M-read].
  - Planner derived passes do write: the cascade, the orphan sweep and the collapse are emitted as ops in the same undo record (txn.mjs:95-262), and the browser split writes (input.js:984-1033) [V]. They commit states validateDoc refuses (D1, D42) and compose wrongly within one pass (D41) [M-run G1, G2].
  - DECISIONS.md:255-260 (2026-09-22): routable owns "the permission table, the derivation, and the write", and "Still not designed: how a pack contributes a write." [M-read here]
  - DIRECTOR, 2026-09-25 (seeds S14): "Agree that derivations flow up - but a link, path or flow config would need to have some entity persisted into the document (minimal entity/spec) such that the derivation can actually occur."
- **Alternatives:**
  1. (status quo) Mixed: engine derivations are read-only; planner passes (cascade, sweep, collapse) and the browser split write stored links and waypoints as consequences of other writes.
  2. Derive up only: every stage above the stored primitives is computed by every observer, nothing a stage computes is written, and authoring writes only specs.
  3. Materialize down at authoring only: a higher-level authored intent compiles once into lower stored primitives at write time, and everything derives up after that (seeds S12's "the w gesture compiles a link into wires").
  4. Kubernetes-shaped: higher stages act as controllers that write lower objects and store status; peers read the written result.
  5. Per stage: some stages derive up only (a path, for instance), others materialize (a link authored through bends).
  6. Derived state stored beside specs as a status or condition (for instance "unroutable", seeds S13) while staying re-derivable.
  7. other.
- **Recorded positions:**
  - RULED 2026-09-01 (code comment only, rules.mjs:32-35): a rule may not write.
  - RULED 2026-09-19 (DECISIONS.md, "The universal node, staged"): "A capability recomputes when the document changes ... and stores nothing that could disagree with it." [M-read here]
  - RULED 2026-09-22 (DECISIONS.md:255-260): routable owns the write; how a pack contributes a write is not designed.
  - Side by side, not resolved: "a rule may not write" (2026-09-01) and routable owning "the write" (2026-09-22).
  - DIRECTOR, 2026-09-25 (seeds S14): "Agree that derivations flow up - but ... some entity persisted ...", as quoted.
  - HYPOTHESIS (seeds S12, Claude): a per-stage direction, as quoted.
  - DIRECTOR STATEMENT, 2026-09-25 (seeds S19): see PS127.
- **Under each frame:**
  - FR0: split and collapse are materializing writes between two encodings of one bend (PS117).
  - FR1: path and flow can be derive-up only over stored links; the link layer keeps today's writes.
  - FR2: links derive up from pipes; authoring a bent link materializes pipes (PS118).
  - FR3: cables are declared (spec); a cable's route through pipes may derive up (routed from its ends) or be stored (declared); paths derive up over links.
  - Stages axis: AS CAPABILITIES with derive-up only matches a view-maintenance model (seeds lineage: Datalog/RETE/IVM); with materialize-down it matches controllers.
- **What would separate the alternatives:** For each stage: do two peers holding the same document compute the same value without exchanging it (derive up), or does the value have to be written (materialize)? Does any stage's result have to survive a change in code revision? Only a stored value survives one; a derivation follows the code. Does an author ever edit a lower primitive that a higher stage produced?
- **Intent bearing:** Q3 c (derived, with persisted inputs); Q1 a (AX2: "no rule lives at one door"); the VISION north star anchored in Round 1 (derived physics that everyone watching computes identically); the director's S14 statement quoted above.
- **Depends on / blocks:** Depends on: PS103 (S12), PS101 (S2). Blocks: PS118 (S5), PS221 (S13), PS114 (S14), PS313 (F17), PS314 (F18), PS315 (F19), PS316 (F40), PS127 (S19).
- **Evidence (defects/contradictions):** D1, D2, D41, D42, D44; C24, C25, C37, C47.

### PS106. Which connection stages exist at all?
- **Track / layer:** frame ; anchor, pipe, link, logical link, path, flow
- **Covers:** S1 (the stack's membership, including its "fewer layers" alternatives); S15 (whether multiplicity makes pipe and link distinct); S16 (the physical/logical stack and its open logical-link layer); envelope flag F4
- **The question:** Which of pipe, link, logical link (aggregation, multiplex), path and flow exist as distinct stages, and which are one stage under two names? The boundary questions are carried separately (PS107 pipe, PS109 link, PS110 logical link, PS112 path and flow); this entry holds their combination.
- **Why it is open:**
  - Director clarification, 2026-09-25 (envelope): "I keen using flow/path and wire/link interchangeably for now, because I am not completely sure if these are mechanically the same primitive or slightly different ones, and I'd like to explore that split. Its possible that Links exist, but are derived on top of Wires, and possible that Paths are persistent entities, derived on top of Links, and maybe only some of these items have direction etc."
  - Director, 2026-09-25 (envelope S0): "some of these things either don't exist, perhaps should or shouldn't exist, but worth considering if it buys us capability and behaviour in a clean, decoupled unified way".
  - Code: the link is the only persisted connection; WIRE is ABSENT as a unit distinct from link; the multi-link PATH sense is ABSENT; FLOW is a per-link boolean and its flow-pair sense is ABSENT (map s1.1) [M-read].
  - Envelope flag F4: "The layer stack (wire, link, path, flow, or fewer) is a design output, and each boundary is a fork".
  - Seeds S15, discriminator for S1 [I]: "series only -> a link is a derived chain, arguably not a separate primitive; any of the other three -> wire and link are distinct with a many-to-many relation."
  - Seeds S16, open [I]: "is there a logical-link layer between cable and path?"
  - No derived connection fact beyond geometry is readable at REST or the CLI today (map s10.1 critic gap 1) [M-read critic], so a new derived stage would also be a new agent-door surface.
- **Alternatives:** (each a stack, lowest first)
  1. (status quo) anchor, link (stored, with via); path = one link's coordinates; flow = a per-link boolean; traffic = movers on one link.
  2. anchor, link (stored), path (derived), flow (declared) -- FR1.
  3. anchor, pipe (stored), link (derived chain), path, flow -- FR2.
  4. anchor, pipe (stored), link or cable (declared), path, flow, with aggregation and multiplex held inside an existing stage -- FR3 without a logical-link stage.
  5. anchor, pipe, link or cable, logical link (aggregation, multiplex), path, flow -- FR3 with a logical-link stage.
  6. Fewer: pipe = link and path = flow (seeds S1 "fewer layers").
  7. Pipe = link, with path and flow distinct.
  8. Pipe and link distinct, with path = flow.
  9. other.
- **Recorded positions:**
  - RULED 2026-08-19 [LOCKED] (HIERARCHY.md:37-47): path = coordinates with no identity; route = ordered anchors. These fix the words; they do not settle whether multi-link stages exist.
  - DIRECTOR LEANING, 2026-09-25 (seeds S15): "a wire's spec is just its two anchors"; DS7 (a requirement in the envelope, leanings in seeds S15): "parallelism lives above/abstracted over wires."
  - AGREED (seeds naming note, 2026-09-25; recorded in the seeds' own words, not as a director quotation; not in DECISIONS.md; the seeds header reads "Every entry is UNDECIDED"): two layers of routing -- links through pipes, and paths over links.
  - DIRECTOR STATEMENT, 2026-09-25 (seeds S16): "'links' are probably equivalent to 'cables' in the real world networking"; DIRECTOR LEANING, 2026-09-25 (seeds naming note): "I now like pipe under this model."
  - DIRECTOR CLARIFICATION, 2026-09-25 (envelope, DS5), worded as a possibility: "Its possible that Links exist, but are derived on top of Wires" (the FR2 shape).
  - DIRECTOR REQUIREMENT, 2026-09-25 (envelope): "I think we need to be able to model, construct and visualise all 4 of those in the table."
- **Under each frame:** FR0 to FR3 are alternatives 1 to 5 of this entry. FR3 as seeds S16 describes it leaves the logical-link stage open (alternatives 4 and 5).
  - Stages axis: under stages FIXED this entry is the engine's stack; under AS CAPABILITIES it is the first set of registered stages, and a later addition does not reopen it.
- **What would separate the alternatives:** Per boundary, seeds S1: "wire vs link -- does anything attach to a unit smaller than a run? path vs flow -- can two flows share a path, can a path change under a stable flow?". Seeds S15: is any of parallel, multiplex or parallel links required? (The director requirement names all four.) Seeds S16: do aggregation and multiplex carry attachments of their own (the Q3 noun test)?
- **Intent bearing:** Q3 abc (a stage is a noun: admitted when something attaches to it and it is visible; derived, with persisted inputs); Q1 b (AX3) and Q1 c (AX5) may pull in opposite directions on the count [I]; the director's statements, leanings and requirement quoted above.
- **Depends on / blocks:** Depends on: PS101 (S2), PS102 (S1, organizing principle), PS103 (S12). Blocks: PS117 (S3), PS116 (S4), PS118 (S5), PS217 (S7), PS223 (S8), PS114 (S14), PS110 (S15), PS109 (S16), PS213, PS218 (F9), PS122 (F10), PS220 (F36). Related (overlapping, not merged): PS126.
- **Evidence (defects/contradictions):** C12 (the LOCKED taxonomy's shapes against code).

### PS107. Is there a connection unit below the link -- a pipe -- and is it stored?
- **Track / layer:** B ; pipe, link
- **Covers:** S1 (the "wire vs link" discriminator); S15 (the leaning "a wire's spec is just its two anchors"; pipe identity as an unordered anchor pair); S16 (the pipe as conduit or adjacency)
- **The question:** Does the model carry a unit smaller than a link, an adjacency between two anchors, as a stored thing, as a derived view, or not at all?
- **Why it is open:**
  - Seeds S1 discriminator: "does anything attach to a unit smaller than a run?"
  - Within one link, one flow and one control cover every segment, and the via list is the run of bends (map s3.4) [M-read R1, R2]. Segments exist only as derived geometry (segmentsOf, router.mjs:167-173) [M-read].
  - WIRE is ABSENT as an identifier and as a unit distinct from link. A kernel union `wire`/`wiresOf` (a link or path element) was retired by B38 in d349ccd (tombstone kernel/grc.mjs:13-19) [M-read R7].
  - HIERARCHY.md:29 (vision): "connection = a net/wire (incl. container<->container, single or parallel)" [M-read].
  - Seeds S15 [I]: "a wire's identity = its unordered anchor pair; parallel wires need a discriminator (index/lane), a differing property (e.g. plane), or parallelism must live above wires." Consequence A [I]: with identity = anchor pair and parallelism above, "a WIRE is an adjacency or conduit, not a physical cable".
  - The unordered-pair key already has two encodings (invariants.mjs:56 joins with '|' after an ordered compare; referential.mjs:125 sorts and joins with '\u0000'), and the two agree in behaviour today (D38) [M-read R1, R3].
  - Stored-shape impact: alternatives 3 and 4 change the stored shape of the 38 live diagrams (envelope AX6; seeds S3) [I]; alternatives 1 and 2 do not, and under them the history-dependent dual encoding of a bend remains (PS117); alternative 5's effect depends on whether the one unit keeps a via [I].
- **Alternatives:**
  1. (status quo) No unit below the link; segments are derived geometry only.
  2. Pipe derived from stored links: a named view over each link's consecutive anchor pairs, not stored (seeds S1: "links stored and wires only derived segments (roughly today)").
  3. Pipe stored as an adjacency between two anchors, with identity = the unordered anchor pair (FR2, FR3; the director's leaning).
  4. Pipe stored with its own identity, so two pipes may join the same pair (a discriminator such as an index or lane).
  5. Pipe = link: one unit (seeds S1 "fewer layers").
  6. other.
- **Recorded positions:**
  - DIRECTOR LEANING, 2026-09-25 (seeds S15): "a wire's spec is just its two anchors."
  - DIRECTOR STATEMENT, 2026-09-25 (seeds S16): "a 'wire' represents an adjacency between anchors as a lowest network primitive ... 'wires' more accurately represent physical pipes/conduits through which 'links' can run".
  - DIRECTOR LEANING, 2026-09-25 (seeds naming note): "I now like pipe under this model."
  - RULED: none. HIERARCHY.md:77 planned a scanner failure on "any surviving `wire`", never built (C11).
- **Under each frame:**
  - FR0, FR1: alternative 1, or alternative 2 as a read-only view.
  - FR2: alternative 3; the pipe is the only stored connection and links are derived from pipe chains.
  - FR3: alternative 3; pipes are conduits and parallel cables share one pipe, so no discriminator is needed at the pipe (seeds S16) [I].
  - Stages axis: under AS CAPABILITIES the pipe is a candidate engine primitive (seeds S12: "engine = anchors + wires + capability mechanism").
- **What would separate the alternatives:** Seeds S1's attachment test: name anything that attaches to one hop of a bent link and not to the whole link (a per-hop property, a label, a plane, a capacity, a cable passing through). Check whether two parallel things between the same two anchors are told apart at the pipe (alternative 4) or above it (alternative 3).
- **Intent bearing:** Q3 a and b (a noun needs something attached and must be visible); the director's statements quoted above; Q1 c (AX5, adding a kind); AX6 (one-way-door risk, 38 live diagrams).
- **Depends on / blocks:** Depends on: PS106 (S1), PS102 (S16). Blocks: PS117 (S3), PS116 (S4), PS118 (S5), PS205 (S6), PS209 (S6a), PS110 (S15), PS113 (S16, routing unit), PS130 (S16).
- **Evidence (defects/contradictions):** D38; C11.

### PS108. Does a pipe carry anything beyond its two anchors?
- **Track / layer:** B ; pipe (and the cut rule of the link layer)
- **Covers:** S15 (its "to clarify later" item: whether "just its two anchors" means no configuring spec at all, or only that the generative spec is two anchors)
- **The question:** If pipes exist, is a pipe's whole stored form its two anchors, or may it also carry configuring properties (plane, one-way direction, a name, a capacity)?
- **Why it is open:**
  - Seeds S15 [I]: "does 'just its two anchors' mean NO configuring spec on a wire (then plane lives higher and can no longer cut links, touching the ruled plane-difference rule), or only that the GENERATIVE spec is two anchors?"
  - Seeds S6a (another part) [I]: if links are derived by cutting pipe chains, "Whatever decides a cut must be readable BELOW the link layer, or the derivation is circular", so plane and any cut-affecting direction become properties of pipes or anchors.
  - Today plane and direction are link fields (link.control, link.flow; validate.js:245-249), and both enter the role derivation: two terminations on differing planes, or two with opposing declared flow, derive a junction (geometry.mjs:479, 518, 521) [M-run R1, R2].
  - The FRAGMENT ruling: opposing declarations on a run break it at the waypoint between them (ATOMICS.md:312-322; BOARD.md:834-841; ruled 2026-09-22).
- **Alternatives:**
  1. (status quo) With no pipe, plane and direction are link fields.
  2. Pipe = two anchors only; plane, direction and names live on a higher stage (link or cable, path, flow).
  3. Pipe = two anchors (generative) + configuring fields (plane, one-way, others) that the link derivation reads.
  4. Cut-affecting properties live on anchors (their composition), not on pipes.
  5. other.
- **Recorded positions:**
  - DIRECTOR LEANING, 2026-09-25 (seeds S15): "a wire's spec is just its two anchors." Its scope (generative only, or everything) is recorded as open (seeds S15, "To clarify later").
  - RULED 2026-09-22: FRAGMENT, as above; differing planes make a junction (ATOMICS.md:287-310; H15.17/B233).
  - Side by side, not resolved: under FR2 with alternative 2, nothing below the link carries plane or direction, while these rulings use both to decide where a run breaks.
- **Under each frame:**
  - FR0, FR1: does not arise.
  - FR2: the link derivation needs every cut input to sit below links (seeds S6a) [I].
  - FR3: cables are declared, so cuts are authored, and plane and direction can sit on cables or flows without making the link derivation circular (seeds S16 reading) [I].
  - Stages axis: no difference.
- **What would separate the alternatives:** Ask the director what "just its two anchors" covered (a Round-2 candidate). In design: list every rule that reads plane or direction today, and for each frame name the stage it would read them from.
- **Intent bearing:** The director's leaning quoted above, whose scope is unrecorded; the director's "We are building a full fidelity network system" (a real network carries plane and direction at some layer). On which stage carries plane and direction, no pick or statement speaks (a Round-2 candidate).
- **Depends on / blocks:** Depends on: PS110 (S15; a forward reference within Part 1), PS109 (S16; a forward reference within Part 1, which takes the pipe before the link and the four relations), PS209 (S6a; mutual). Blocks: PS209 (S6a; mutual), PS224 (S6b), PS223 (S8), PS226, PS227 (F26).
- **Evidence (defects/contradictions):** D9 (spawners emit on control links: plane does not reach traffic today).

### PS109. What is a link relative to the units below it?
- **Track / layer:** B ; link, pipe
- **Covers:** S16 (the link as a cable with its own identity); S15 (consequence B: multiplicity above one needs a declaration); S3 (the link as a derived chain, the premise of its claim that split and collapse become derivations, as S16 qualifies it)
- **The question:** Is a link a stored record carrying its own route (today), a derived maximal chain of pipes through continuing anchors (FR2), or a declared cable with its own identity that runs through pipes (FR3)?
- **Why it is open:**
  - Today: link = {id, name, src, dst} required, with via, closed, flow and control optional (validate.js:238-251) [M-read R1]; it is the only persisted connection (map s7.1).
  - Director clarification (envelope): "Its possible that Links exist, but are derived on top of Wires".
  - Director statement (seeds S16): "'links' are probably equivalent to 'cables' in the real world networking".
  - Seeds S15 consequence B [I]: "series chains can be derived from geometry, but parallel, multiplexed and multiple links cannot; they need a DECLARATION."
  - Seeds S16 [I]: S3's claim "holds only if a link is a DERIVED CHAIN of wires. If a link is a CABLE (declared, own identity), split returns as 'does the passing cable terminate here?' (an authored choice) and collapse as 'splice two cables' (authored)."
  - Seeds S16 reconciliation of S6 [I]: under the cable reading, "conduits join at an anchor AND a junction is cables meeting, simultaneously; a cable passes through a conduit T without meeting the cables that end there."
  - Seeds S7 (another part): a derived link needs a stable address for its name and configuration; today's split already loses name, flow and control [V].
  - DECISIONS.md:233 (2026-09-22): "An anchor does not choose to be a junction; three links terminate there, so it is one, and deleting one makes it a bend with nothing reconfigured." The shipped collapse does reconfigure the document (C25) [V].
- **Alternatives:**
  1. (status quo) A stored link with src, dst and a stored via (FR0, FR1).
  2. A derived maximal chain of pipes, cut at anchors that do not continue, with identity and configuration bound by some rule (seeds S7) (FR2).
  3. A declared cable with its own identity and ends, whose route through pipes is stored or derived (PS116) (FR3).
  4. A derived chain by default, with an optional declaration where multiplicity exceeds one or configuration is attached (seeds S15 consequence B: "derived chain + optional declared multiplicity/partition").
  5. other.
- **Recorded positions:**
  - RULED 2026-08-19 [LOCKED] (HIERARCHY.md:48): link = route + identity + closed.
  - DIRECTOR STATEMENT, 2026-09-25 (seeds S16, the FR3 description): "'links' are probably equivalent to 'cables' in the real world networking".
  - DIRECTOR CLARIFICATION, 2026-09-25 (envelope, DS5), worded as a possibility: "Its possible that Links exist, but are derived on top of Wires" (the FR2 shape).
  - DIRECTOR LEANING, 2026-09-25, "for now" (seeds S6): "if wires are between anchors, then a link can only occur between endpoints and junctions in this model. For now I would think wires meeting at an anchor join there - however - a junction is actually links meeting, rather than wires."
  - DS7 (2026-09-25; "Director requirement" in the envelope, "DIRECTOR LEANINGS" in seeds S15): "links are only ever between endpoints or junctions (or one to the other)."
  - HYPOTHESIS (seeds S3, Claude): the link as a derived chain, as S16 qualifies it.
- **Under each frame:** FR0, FR1, FR2 and FR3 are alternatives 1, 1, 2 and 3. Under FR2 a link cannot pass an anchor where a third pipe meets without the chain being cut there [I, from the S6 leaning's reading]; under FR3 it can, since a pass-through is a cable that does not end there (seeds S16).
  - Stages axis: under AS CAPABILITIES an FR2 link is a registered derivation, and an FR3 cable is a stored kind with a registered router.
- **What would separate the alternatives:** (a) Does anything need a link identity that survives a topology change (a name, a flow binding)? A derived chain changes identity when a pipe is added at a mid-point (seeds S7 hard case). (b) Must a link pass an anchor where others meet without joining them? (c) Is any of parallel, multiplex or parallel links required? (The director requirement names all four.) (d) How many of the 38 live diagrams change stored shape under each alternative?
- **Intent bearing:** The director's statements and leanings quoted above; the director requirement ("model, construct and visualise all 4"); Q3 abc (a link is a noun something attaches to and people see; derived with persisted inputs); Q1 a (AX2); AX6.
- **Depends on / blocks:** Depends on: PS106 (S1), PS110 (S15; mutual, see PS110; a forward reference within Part 1), PS102 (S16). Blocks: PS117 (S3, F7), PS211 (F7), PS116 (S4), PS118 (S5), PS205 (S6, F8), PS212 (F8), PS217 (S7), PS221 (S13), PS213, PS218 (F9).
- **Evidence (defects/contradictions):** C25; C5, C6; D2, D4 (the split loses the link's name and fields).

### PS110. How are series, parallel (aggregation/LAG), multiplex (VLAN) and parallel links each represented, built and shown, and is there a logical-link stage?
- **Track / layer:** B ; pipe, link, logical link, path
- **Covers:** S15 (the four relations; the director's leanings and requirement; consequence D on visualising them); S16 (the four relations under the cable model; the open logical-link layer)
- **The question:** The director requires all four relations to be modelled, constructed and visualised. At which stage does each live, what tells two members between the same anchors apart, and do aggregation and multiplex need a stage of their own?
- **Why it is open:**
  - DIRECTOR REQUIREMENT, 2026-09-25 (envelope, verbatim): "links are only ever between endpoints or junctions (or one to the other). drawing a new link to a bend converts it to a junction (current behaviour). parallelism lives above/abstracted over wires. I think we need to be able to model, construct and visualise all 4 of those in the table."
  - DIRECTOR CONTEXT, 2026-09-25 (seeds S15): "Today - we only support a single link between 2 anchors, but in future we may allow parallel links between 2 anchors."
  - Measured today: the server refuses only a second STRAIGHT link per unordered pair (straightCapacity, invariants.mjs:24-42, 260-275), ignoring plane, direction and closed [M-run R1 P5]. duplicateThroughBend refuses two links that bend at one waypoint and share a pair (referential.mjs:125-147) [M-run R1 P13]. The browser's linkNodes refuses any existing pair (commands.js:302) [M-read]. Whether two routed links between one pair via different waypoints are admitted is [I] from these rules; nobody ran it.
  - Seeds S16 [I]: "series = one cable through many conduits; parallel links = several cables in one conduit (no wire discriminator needed); aggregation (LAG) and multiplex (VLAN) = LOGICAL constructs over cables, above links and at or below paths. Open: is there a logical-link layer between cable and path?"
  - Record: [LOCKED] parallel-link ports, 2 per node face (ATOMICS.md:106-115), unbuilt. Capacity is written as a function "intended to become per-endpoint-kind" (invariants.mjs:24-42). B81 and B126 carry a director direction for runtime-configurable per-kind capacity (BACKLOG:143, 188) [M-read]. HIERARCHY.md:88 cites KiCad "buses for parallel nets" [M-read].
  - Prior art: the archive sim's "mechanism relation" {from, to, style, count} with realizers, a bundle declared once and realised N times (map s7.1 WIRE (d)); ATOMICS.md:138 "no trunk, no taps" rejects the trunk model for junctions [M-read R7].
  - Seeds S15 consequence D [I]: visualising all four (lanes, bundle marks, multiplex tags) joins S10's shared-link readability question.
- **Alternatives:**
  1. (status quo) Series as one link via bends or as two links (both encodings, PS117); parallel links only in part (a second straight link refused; routed pairs admitted [I]); aggregation and multiplex not expressible.
  2. All four at the link stage: a link carries members (aggregation), tags (multiplex) and a lane index (parallel).
  3. Parallelism at the pipe: pipes with a discriminator (index or lane), and links derived per lane (an FR2 variant).
  4. Parallel links as several cables in one pipe; aggregation and multiplex as a logical-link stage between cable and path (FR3 with a stage).
  5. Parallel links as several cables in one pipe; aggregation and multiplex as declarations inside the path stage, or as attributes of cables (FR3 without a stage).
  6. A declared bundle realised N times (the archive sim's mechanism-relation shape).
  7. other.
- **Recorded positions:**
  - DIRECTOR REQUIREMENT and LEANINGS, 2026-09-25, as quoted, including "parallelism lives above/abstracted over wires."
  - RULED [LOCKED] (ATOMICS.md:106-115; lock date not carried by the map): parallel-link ports, 2 per face, unbuilt. RULED (director ruling recorded in B80, BACKLOG.md:142; date not read): a single straight link per pair, permitted in addition to routed paths (map s1.2 straight/routed row).
  - HYPOTHESIS (seeds S16): the four relations placed as quoted.
  - Envelope reading (proposer): "the programme is not complete while any of them is not."
- **Under each frame:**
  - FR0: alternative 1.
  - FR1: all four at or above the stored link; aggregation and multiplex in the logical layers.
  - FR2: series is the derived chain; the other three need a declaration (seeds S15 consequence B) or a pipe discriminator (alternative 3).
  - FR3: alternative 4 or 5.
  - Stages axis: under AS CAPABILITIES a logical-link stage could register later; under FIXED it is decided here.
- **What would separate the alternatives:** For each relation, name what attaches to the aggregate and what to each member (a member-level failure? a VLAN tag on a flow?). Is a flow's path computed over members or over the aggregate? Is each relation's visual form (lanes, bundle marks, tags) read from the stage that holds the relation, or computed separately?
- **Intent bearing:** The director requirement (a completion condition); Q1 b (AX3); Q1 a (AX2: buildable at every door); Q3 b (visible).
- **Depends on / blocks:** Depends on: PS107 (S15, pipe identity), PS109 (S16; mutual, see PS109), PS106 (S1). Blocks: PS111 (S15 consequence C), PS205 (S6), PS222 (S10), PS215, PS216 (F13). Related (overlapping, not merged): PS215, PS126.
- **Evidence (defects/contradictions):** none (straightCapacity ignoring plane is fork evidence under F13, not a D or C id).

### PS111. When links can be parallel or aggregated, what does "links meeting" count at a junction?
- **Track / layer:** B / seam ; link, logical link, anchor roles
- **Covers:** S15 (consequence C)
- **The question:** If a junction is "links meeting" (the director's leaning), what is counted once an anchor can hold an aggregate of several members, or several parallel links to one neighbour: logical links, member links, distinct neighbours, or something else?
- **Why it is open:**
  - Seeds S15 consequence C [I]: "A server with a two-member aggregate (one logical link) vs a server with two redundant links (two links): distinct logical links? distinct neighbours? member count? Interacts with 'server permits endpoint only'."
  - Today roles count terminations of open links; threading adds 0; more than 2 terminations derive a junction; 2 on differing planes or with opposing declared flow derive a junction (geometry.mjs:456-532; map s3.3 table) [M-run R1, R2].
  - The record states the count several ways: "Terminations only, and more than two of them" (ATOMICS.md:140-146) against the matrix's two-link junctions (C4); a 3-termination waypoint is "a junction AND an endpoint" (ATOMICS.md:175) against code's junction alone (C2).
- **Alternatives:**
  1. (status quo) Count terminating links at the anchor, with differing planes and opposing flow as further junction conditions.
  2. Count logical links (an aggregate counts once).
  3. Count member links (each member counts).
  4. Count distinct neighbouring anchors.
  5. Per composition: the anchor's composition declares what it counts.
  6. other.
- **Recorded positions:**
  - DIRECTOR LEANING, 2026-09-25, "for now" (seeds S6): "a junction is actually links meeting, rather than wires."
  - RULED 2026-09-22 (DECISIONS.md:240): "A compute or server glyph permits endpoint alone."
  - RULED (B211, BACKLOG.md:254, "Three rulings in one"; date not read): junction supersedes endpoint (map s3.3).
  - none on what is counted under multiplicity.
- **Under each frame:**
  - FR0, FR1: parallel members are separate stored links, so the status quo counts members unless something above aggregates them.
  - FR2: the count is taken over derived links, and the same count decides where links are cut, so the definition has to be computable below the link stage (seeds S6a) [I].
  - FR3: cables meeting at an anchor are counted; whether an aggregate counts once depends on PS110.
  - Stages axis: no difference.
- **What would separate the alternatives:** A server anchor with a two-member aggregate to one switch: does it satisfy "endpoint alone"? Compare a server with two independent links to two switches.
- **Intent bearing:** DS7 (the requirement to model, construct and visualise parallel/LAG and parallel links) and DS8 ("a junction is actually links meeting") bear; neither says what is counted under multiplicity, which is a director question (as in PS307).
- **Depends on / blocks:** Depends on: PS205, PS207 (S6; PS207 mutual), PS110 (S15). Blocks: PS306, PS307 (F16), PS414, PS415 (F28), PS308 (S6c). Related (overlapping, not merged): PS307.
- **Evidence (defects/contradictions):** C2, C4, C14; D8.

### PS112. Are path and flow one stage or two, and is a path ever declared on its own?
- **Track / layer:** B ; path, flow
- **Covers:** S1 (the "path vs flow" discriminator); S14 ("Is a path ever declared (pinned) or always derived from a flow?"); S16 ("paths are logical, flows are specific instances of traffic")
- **The question:** Is a flow a declared src:dst over a path derived for it? Is a path an entity that can be declared or pinned by itself? Or are the two one stage?
- **Why it is open:**
  - Director clarification, 2026-09-25 (envelope): "One of the things I want to be able to do is 'declare a path or flow' and have that path/flow - multihop across routed junctions/nodes - have a visual flow element along them." and "possible that Paths are persistent entities, derived on top of Links".
  - Director statement, 2026-09-25 (seeds S16): "paths are logical, flows are specific instances of traffic".
  - Survey Q3 rationale: "a src:dst node pair may be selected and this persists as state in the control plane, so that a path can be derived across all viewers".
  - H15 exit: "an author declares flow once on a path and sees it end to end" (BOARD.md:847) [M-read here].
  - Code: no multi-link path; pathOf takes one link (model.mjs:170-187); no code walks links (searches for chain, walk, trace, propagat, traverse, contiguous, reachab, runOf, inherit; map s3.4) [M-read R1, R2, R4, R7]. link.flow is a per-link boolean; movers never read it (engine/ has 0 reads; R1-R4, R7) [M-run]. The flow-pair sense has no shape anywhere (map s7.1 FLOW).
  - The undeclared link reads two ways: the browser renders it as flow both ways, '<->' (readout.js:141-147; input.js:818-820), while the rules read no direction (facing returns null, invariants.mjs:127-129) (map s10.1 critic gap 2) [M-read critic].
  - Seeds S1 discriminators: "can two flows share a path, can a path change under a stable flow?"
- **Alternatives:**
  1. (status quo) Neither exists across links: path = one link's coordinates, flow = a per-link direction boolean, traffic = movers on one link.
  2. One stage: a declared src:dst whose route over links is derived (path = flow).
  3. Two stages: flow declared (src, dst, directed); path derived as its route (in seeds S12's reading, the flow's status).
  4. Two stages with the path declarable: a path may be declared or pinned (a hop list), and flows reference or run over paths.
  5. Path derived, and flow = a traffic instance at runtime (movers or packets) rather than a declaration.
  6. other.
- **Recorded positions:**
  - RULED 2026-08-19 [LOCKED] (HIERARCHY.md:37-47): path = ordered coordinates with no identity.
  - RULED 2026-09-22 (DECISIONS.md:281-284): policy over flows is out of scope; the flow-pair hypothesis is "Not designed, not ruled, and not to be assumed".
  - AGREED (seeds naming note, 2026-09-25; recorded in the seeds' own words, not as a director quotation; not in DECISIONS.md): paths over links is one of two routing layers.
  - DIRECTOR STATEMENTS, as quoted.
  - HYPOTHESIS (seeds S12, Claude): "Flow is the most k8s-shaped: src:dst spec, path as status".
  - Side by side, not resolved: the LOCKED path has no identity; the director's clarification allows "Paths are persistent entities".
- **Under each frame:**
  - FR0: alternative 1.
  - FR1, FR2: a path over the link graph; FR2's links are themselves derived, so a path is a derivation over a derivation.
  - FR3: "paths over links" (the agreed layer), with flows as traffic instances (seeds S16), so alternative 3 or 5, depending on whether a flow is declared or a runtime instance.
  - Stages axis: under AS CAPABILITIES a flow stage and a path stage can register separately.
- **What would separate the alternatives:** Seeds S1's two questions. Also: is a path ever authored without a flow (pinning a route)? Does anything attach to a path that is not a flow (a visual element, a constraint)? Does traffic follow a flow's path, or is a flow the traffic?
- **Intent bearing:** The director's clarification and S16 statement quoted above; Q3 abc (the rationale describes a persisted pair and a derived path); Q2 c (behaviour and events, i.e. traffic); anti-goal AG-1 keeps permit/deny over flows out.
- **Depends on / blocks:** Depends on: PS106 (S1), PS102 (S16). Blocks: PS223 (S8), PS220 (S9, F36), PS227 (S9), PS219, PS222 (S10), PS221 (S13), PS213, PS218 (F9), PS225 (F25), PS411-PS413 (F27), PS427 (F37). Related (overlapping, not merged): PS218.
- **Evidence (defects/contradictions):** D9, D10 (traffic ignores the declared plane and flow); C19.

### PS113. What is the unit of routing at each layer, and is it one routing capability reused at more than one layer?
- **Track / layer:** B / frame ; pipe, link, path, flow
- **Covers:** S16 (two routing layers; "one routing capability reused at two layers is a direct test of S12's stages-as-capabilities"); S12 (that test)
- **The question:** If routing occurs at two layers -- links through pipes, paths over links -- what is routed at each (a cable, a flow), over which graph, and from which spec? Is the router one capability instantiated per layer, or a separate mechanism per layer?
- **Why it is open:**
  - AGREED (seeds naming note, 2026-09-25; recorded in the seeds' own words, not as a director quotation; not in DECISIONS.md; the seeds header reads "Every entry is UNDECIDED"): two layers of routing -- links through pipes, and paths over links.
  - Seeds S16 [I]: "Routing appears at TWO layers: cables through the conduit graph, flows through the link graph. Same shape (route through a graph, deterministic tie-break): one routing capability reused at two layers is a direct test of S12's stages-as-capabilities."
  - Today nothing routes in this sense: links are hand-routed; "an auto-router (later) populates the SAME waypoint list" (router.mjs:1-4); kernel/router.mjs is a corner renderer [M-read R2]. "route" has eight senses in code and record (map s1.2 route row).
  - Orthogonal routing is ruled in principle and never checked, and a diagonal straight link is emitted (F15; C44) [M-run R2].
  - Determinism: equal-cost routes need a tie-break every viewer computes identically (seeds S10). The spawner's link choice already depends on linksAt ORDER, which differs between the browser index and a scan (D11) [M-run R4].
  - Prior art: prism ROUTE {src, dst, hops[]}, with hops as nodes or tag selectors, resolved per compile (RouteFactory.js:20-31; L3Resolver.js:207-240), explicitly NOT borrowed (DECISIONS.md:126) (map s7.2).
- **Alternatives:**
  1. (status quo) No routing at any layer: the author supplies every bend (via), and nothing routes a multi-link path.
  2. Routing at the path layer only (flows over the link graph); links keep authored routes (FR1).
  3. Routing at the link layer only (a cable routed from its ends through pipes); paths not routed.
  4. Two layers, one capability: one route-through-graph mechanism instantiated per layer, taking the graph, cost and tie-break as inputs.
  5. Two layers, two mechanisms: geometric routing of cables through pipes and logical routing of flows over links differ in kind (for instance geometric cost vs hop count, or forwarding decided by anchor composition).
  6. other.
- **Recorded positions:**
  - AGREED (seeds naming note, 2026-09-25; recorded in the seeds' own words, not as a director quotation; not in DECISIONS.md; the seeds header reads "Every entry is UNDECIDED"): two layers of routing -- links through pipes, and paths over links.
  - RULED (DECISIONS.md:126, section "Borrowed mechanisms (narrow, by source)"): "Explicitly NOT borrowed: L1-L4 compiler, layouts/settlement, routes/pathfinder, tag selectors, ...". The line entered DECISIONS.md in 6604a52 on 2026-09-04 from SCOPE.md; its original ruling date is NOT-CLAIMED [M-read here, git log -L].
  - HYPOTHESIS (seeds S16, Claude): one capability reused at two layers.
- **Under each frame:**
  - FR0: alternative 1.
  - FR1: paths over stored links; link routes stay authored.
  - FR2: links are found as maximal chains, not routed, so the only routing layer is paths over links, and "links through pipes" reads as chain derivation rather than routing [I].
  - FR3: both layers route (cables through pipes; paths over cables), matching the agreed statement.
  - Stages axis: alternative 4 is the seeds' test of AS CAPABILITIES; under FIXED, alternatives 4 and 5 both remain available as internal choices.
- **What would separate the alternatives:** Write down the inputs each layer's routing needs (graph, cost, tie-break, constraints such as forwarding by composition), and check whether one signature covers both. Is a cable's route ever computed (FR3 routed from its ends), or only authored?
- **Intent bearing:** The AGREED line above (seeds naming note); the director clarification "multihop across routed junctions/nodes"; Q1 d (AX4) and Q1 c (AX5: one mechanism); Q1 a (AX2: every viewer derives the same route).
- **Depends on / blocks:** Depends on: PS103 (S12), PS109 (S16), PS112 (S1, path and flow). Blocks: PS116 (S4), PS219 (S10), PS202 (F15), PS411-PS413 (F27). Related (overlapping, not merged): PS125.
- **Evidence (defects/contradictions):** D11; C44.

### PS114. What does each stage persist: a generative spec, a configuring spec, both, or nothing?
- **Track / layer:** frame ; all connection layers ; writes
- **Covers:** S14 (the uniform shape "minimal persisted spec + derivation"; generative vs configuring spec; "does link have a generative spec"); S15 (consequence B, which answers part of it when multiplicity exceeds one)
- **The question:** The director reads every stage as a minimal persisted spec plus a derivation. For each stage, is its spec generative (needed for the thing to exist), configuring (adjusting a thing that exists anyway), both, or absent?
- **Why it is open:**
  - DIRECTOR, 2026-09-25 (seeds S14): "Agree that derivations flow up - but a link, path or flow config would need to have some entity persisted into the document (minimal entity/spec) such that the derivation can actually occur." Also: "I keep walking this path - it feels intuitive and mechanical/deterministic."
  - Seeds S14 [I]: "Two kinds of spec: GENERATIVE (needed for existence: wire = its anchors; flow = src, dst) vs CONFIGURING (adjusts a thing that exists anyway: a link's name, one-way, appearance; a path's constraints). Open per stage: does link have a generative spec, or only configuring? Is a path ever declared (pinned) or always derived from a flow?"
  - Seeds S15 consequence B [I]: the link stage has a generative spec "at least when multiplicity > 1".
  - VISION.md:120: "The limit is a document that declares only where things are and what was intended, from which everything else follows." [M-read here]
  - Today every link field is stored together (validate.js:238-251), including stored order, which the record calls a byproduct: "No rule may branch on src/dst ordering unless the link carries a declared direction" (ATOMICS.md:252-263) [M-read].
  - Per-instance configuration already exists: waypoint.spawn stores interval, speed, kind and since (validate.js:143-173) [M-read], while the ruling calls per-instance pack configuration a future class (DECISIONS.md:186-191; F29).
- **Alternatives:**
  1. (status quo) The stored link holds generative and configuring fields together; anchors hold position and name; nothing is stored for a path or a flow.
  2. Uniform: every stage = minimal spec + derivation, with each stage's spec listed separately (seeds S14).
  3. Generative specs only at the lowest stages (anchor, pipe); higher stages hold configuring specs bound to derived things (seeds S7 binding).
  4. Generative specs at each declared stage (pipe; cable under FR3; flow), with the path derived and each configuring spec on the stage it describes.
  5. Some stages persist nothing (for instance an FR2 link carrying no configuration).
  6. other.
- **Recorded positions:**
  - DIRECTOR STATEMENT, 2026-09-25 (seeds S14, DS11), as quoted.
  - DIRECTOR LEANING, 2026-09-25 (seeds S15): "a wire's spec is just its two anchors."
  - RULED 2026-09-19 (DECISIONS.md, "The universal node, staged"): "A capability that needed stored state would be a different and more expensive class, and none is proposed." Whether a stage's persisted spec is the "stored state" this excludes is NOT-CLAIMED.
  - RULED 2026-09-22 (DECISIONS.md:231-240): roles are "derived, never stored".
- **Under each frame:**
  - FR0: alternative 1.
  - FR1: the link spec is unchanged; flow spec = src:dst (and direction); path spec none, or pinned.
  - FR2: pipe spec = two anchors; the link spec is configuring only (bound by some rule) unless multiplicity exceeds one; flow spec = src:dst.
  - FR3: pipe spec = two anchors; the cable spec is generative (identity and ends, perhaps a route); flow spec; the path derived.
  - Stages axis: under AS CAPABILITIES the spec shape is part of what a stage registers.
- **What would separate the alternatives:** For each stage, delete its spec: does the thing cease to exist (generative) or only lose a property (configuring)? Can a configuring spec be bound to a derived thing that re-forms? Seeds S7's hard case: "a link named 'uplink' cut in two by a new wire at a mid-point: which half keeps the name?"
- **Intent bearing:** Q3 c with its refinement ("Though it must be derived/computed - its inputs may be persisted to the document"); AX1; the director's S14 statement quoted above.
- **Depends on / blocks:** Depends on: PS106 (S1), PS103 (S12), PS110 (S15), PS109 (S16). Blocks: PS116 (S4), PS217 (S7), PS220 (S9), PS221 (S13), PS417 (F29). Related (overlapping, not merged): PS129.
- **Evidence (defects/contradictions):** C7 (closed "render-only" vs topology); C8 and D26 (name optional vs required); D6 (clone drops flow and control).

### PS115. What test admits a field to the stored document?
- **Track / layer:** frame ; all connection layers ; vocabulary
- **Covers:** S14 (the candidate per-field admission test)
- **The question:** When a field is proposed for persistence, what test decides whether it is stored or derived?
- **Why it is open:**
  - Seeds S14 candidate [I]: "a field is persisted only if it is intent that cannot be derived (a link's name passes; its role never does)."
  - Envelope (proposer), carried tension: "storing declarations as inputs is consistent with 'not a system that stores what it can derive' only while the stored thing is intent that cannot be derived, and the design must hold that line per noun."
  - Redundant stored representations that every door can produce: via absent vs []; closed and control false vs absent; a->b vs b->a for an undeclared link; node.shape absent vs 'circle' (map s3.1) [M-read; M-run G3].
  - Fields with contested standing: closed is "(render-only)" in the validator while five rules treat it as topology (C7); pinned is stored intent that a write rule must clear (F22; D5); name is mandatory on all five kinds (B187) while comments call it optional (C8).
  - VISION.md:74: a behaviour expressible only by storing a number on a shape is a failure (map s1.4 behaviour row); spawn stores interval and speed per document (commands.js:565-575) [M-read].
- **Alternatives:**
  1. (status quo) No stated test; fields are admitted item by item.
  2. Intent that cannot be derived (the seeds S14 candidate).
  3. Intent that cannot be derived AND that something reads or attaches to (the candidate joined with Q3 a).
  4. Anything an author set explicitly is stored, derivable or not (authoring history treated as intent).
  5. Each stage declares its admitted fields (a schema per stage).
  6. other.
- **Recorded positions:**
  - RULED 2026-09-22 (DECISIONS.md:231-240): roles are derived, never stored.
  - RULED (ATOMICS.md:252-263, section tagged [DESIGNED 2026-09-22]): stored order is a byproduct; no rule branches on it without a declared direction.
  - RULED (director, 2026-09-04, B187): name is mandatory on all five kinds.
  - HYPOTHESIS (seeds S14, Claude): the candidate test.
- **Under each frame:** Same under all frames in form. What differs is the candidate field set: FR2 removes via from it, and FR3 may add a cable route (PS116).
  - Stages axis: no difference.
- **What would separate the alternatives:** Apply each candidate test to today's fields (id, name, src, dst, via, closed, flow, control, pinned, spawn, shape) and to the proposed ones (pipe anchors, cable route, flow src:dst), then compare the admitted sets.
- **Intent bearing:** Q3 c with its refinement; AX1 ("the document states intent"); VISION.md:120.
- **Depends on / blocks:** Depends on: PS114 (S14). Blocks: PS116 (S4), PS322 (F22), PS417 (F29).
- **Evidence (defects/contradictions):** C7, C8, D5, D26.

### PS116. Is via stored, stored only as authoring intent, or derived?
- **Track / layer:** B ; link, pipe
- **Covers:** S4; S16 (via under the cable model)
- **The question:** A link's via is today an ordered list of waypoint ids stored on the link. Does it stay stored, become authoring intent that a derivation honours, or become fully derived?
- **Why it is open:**
  - DIRECTOR, 2026-09-25 (seeds S4): "This could potentially allow via to be entirely derived."
  - Seeds S4 [I]: under stored pipes, via = the ordered bend anchors of a derived link. Seeds S16 [I]: under the cable model, via = the cable's route through conduits, "declared (stored conduit sequence) or routed from its ends".
  - Today: via holds waypoint ids, at most 500 (validate.js:243); absent and [] both mean straight (invariants.mjs:55 [S]). Five sites admit five route-reference sets (map s4.1): the validator admits waypoints only; Model.pathOf returns null for anything else; the kernel admits any entity or a bare cell; CLI --via takes cells and mints new waypoints (verbs.mjs:1880, 1908-1916); DECISIONS step 3 names "any node holding the capability" (DECISIONS.md:204) [M-run R2].
  - Step 3 (waypoint folded into node) is the ruled one-way door and "changes what `via` means" (DECISIONS.md:201-204, ruled 2026-09-19) [M-read here].
  - A router "never bend[s]" (DECISIONS.md:239), while step 3 widens via to any node holding the capability (F11).
  - "an auto-router (later) populates the SAME waypoint list" (router.mjs:1-4) [M-read R2].
  - Threading a waypoint as a bend is supposed to clear its pin; only the browser does it, and only locally (D5) [M-run R1, G3].
- **Alternatives:**
  1. (status quo) Stored ordered waypoint ids on the link.
  2. Stored only as authoring intent: the bends the author placed, which a derivation honours and may extend.
  3. Derived entirely: FR2's ordered bend anchors of a derived chain, or FR3's route computed from the cable's ends.
  4. Stored on the cable as a pipe sequence (FR3, declared route).
  5. Mixed: stored where authored, routed where not.
  6. other.
- **Recorded positions:**
  - DIRECTOR, 2026-09-25 (seeds S4, no label in the source), worded as a possibility, as quoted.
  - RULED 2026-09-19 (DECISIONS.md:201-204): step 3 is the one-way door and widens via.
  - RULED 2026-09-22 (DECISIONS.md:239): a router never bends.
  - Side by side, not resolved: under a fully derived via, no stored list remains for step 3 to widen.
- **Under each frame:**
  - FR0: alternative 1.
  - FR1: alternative 1, or 2.
  - FR2: alternative 3; authoring a bend writes pipes (PS118).
  - FR3: alternative 4 (declared) or 3 (routed), per PS113.
  - Stages axis: no difference.
- **What would separate the alternatives:** Does an author ever need a bend that no router would produce (a deliberate detour)? If so, via is stored or intent. Must two viewers holding the same document see the same bends without those bends being stored? If so, routing has to be deterministic (seeds S10). How many live diagrams would change stored via?
- **Intent bearing:** The director's S4 statement quoted above; Q3 c (derived, with persisted inputs); Q1 a (AX2: five sites admit five sets today); AX6 (seeds S3: "Costs: derived-link identity, via retires, 38 live diagrams change stored shape").
- **Depends on / blocks:** Depends on: PS114 (S14), PS109 (S16). Blocks: PS117 (S3), PS118 (S5), PS204 (F11), PS322 (F22).
- **Evidence (defects/contradictions):** D5, D19 (links that only thread a waypoint are misdescribed); C12, C13 (the stale waypoint-exclusivity claim).

### PS117. Does one drawn bend keep two stored encodings?
- **Track / layer:** B / seam ; link, pipe, writes
- **Covers:** S3 (the dual encoding of a bend), as S16 qualifies it; F7 (the encoding half: whether a pass-through is a reading over separate stored pieces, a stored rewrite into one piece, or left to history as today). Assembly merge: the Track B entry drafted for F7's encoding half (formerly PS210, "Is a pass-through a reading over separate stored pieces, a stored rewrite into one piece, or left to history as today?") asked the same question; its evidence, alternatives, positions, frame readings and tests are carried here.
- **The question:** Today a->w + w->b can be stored as two links meeting at w, or as one link a->b via [w], and which one a document holds depends on its history. Does the model keep two encodings, reduce them to one canonical form, or remove the distinction by construction? Put as a pass-through (F7): is it derived on read, rewritten in storage at every door on every transition, or left to history as today?
- **Why it is open:**
  - Measured: "building it directly keeps two links; deleting a third link from a 3-way junction collapses the remaining pair into one link via [w]" (map s3.4) [M-run R7; R1 P7].
  - The two encodings derive different roles: two undeclared terminations at w derive ['endpoint'] (geometry.mjs:520-523; tests/validate.test.js:710) [M-run]; a via-only waypoint derives [] (bend) [M-run R1, R2]. The pass-through is classified three ways: bend (ATOMICS.md:281), endpoint (waypointRoles) and merge-eligible (the collapse) (C1) [S; M-run]. Seeds S3 cites geometry.mjs:522-526 for the difference.
  - The converters sit at different doors: the split is in the browser only (commitRoute; input.js:984-1033) and drops flow, control and name [V]; the collapse is in the planner only, and only on a link delete (txn.mjs:199-213 [S]; txn.mjs:207-262 [V]). DECISIONS.md (2026-09-22): "Three implementations could disagree with each other, which is the class of defect B211 through B222 all were." [M-read here]
  - "deleting one makes it a bend with nothing reconfigured" (DECISIONS.md:233) vs the collapse's del + set (C25) [V].
  - Composition failures in the rewrite: merges against an unadvanced projection lose links (D41) [M-run G1]; a split triggers a collapse of an unrelated terminus (D2) [M-run R3]; a collapse strands a spawn on a via (D12) [M-run].
  - Seeds S3 [I]: under stored pipes there is "one encoding; split/collapse become derivations", with FRAGMENT and H15.5 propagation following from it. "Costs: derived-link identity, via retires, 38 live diagrams change stored shape."
  - Seeds S16 qualification [I]: that "holds only if a link is a DERIVED CHAIN of wires. If a link is a CABLE (declared, own identity), split returns as 'does the passing cable terminate here?' (an authored choice) and collapse as 'splice two cables' (authored). Still ordinary operations on declared things, not special derived writes."
  - 38 live diagrams at 2026-09-25 (envelope AX6): any change of stored shape is a one-way door. Their current mix of encodings is not measured (map 10.2).
- **Alternatives:**
  1. (status quo) Both encodings, left to history: the browser split (on creation) and the planner collapse (on removal) convert between them, each at one door and on one trigger.
  2. Canonical one link via w: rewrite to one link at every door on every transition, with split and collapse both planner-side (map F7 option "stored rewrite at every door on every transition").
  3. Canonical two links: never collapse; derive the bend role from two agreeing terminations (map F7 option "derived role only").
  4. One encoding by construction at the pipe level (FR2): a bend is two pipes meeting at a continuing anchor, links are derived, and nothing is rewritten.
  5. One encoding at the pipe level, with the link-level choice authored (FR3): a cable's declared route passes w, and "split" and "collapse" become authored terminate and splice operations.
  6. other.
- **Recorded positions:**
  - RULED 2026-09-22 (DECISIONS.md:233): "deleting one makes it a bend with nothing reconfigured". The shipped collapse reconfigures the document (C25).
  - Record [BUILT] (ATOMICS.md:159-167; B213, B215, B217, B222): the collapse is "the split's inverse", "One rule, one place, every door". (The frame drafter recorded this line as RULED and the Track B drafter as record; PS312 carries it as Record [BUILT].) It stands in tension with DECISIONS.md:233 (C25).
  - DS7 (2026-09-25; "Director requirement" in the envelope, "DIRECTOR LEANINGS" in seeds S15): "drawing a new link to a bend converts it to a junction (current behaviour)". Measured nuance (seeds S15): this holds at the browser door only; the CLI and REST land a link on a bend unsplit (C3) [M-run R1 P13b, R3].
  - DS16 (seeds S5): "Using the w key to create a link with bends might also construct wires between the anchors under the hood mechanically." DS15 (seeds S4): "This could potentially allow via to be entirely derived."
  - HYPOTHESIS (seeds S3, Claude), as S16 qualifies it, quoted above.
- **Under each frame:**
  - FR0: alternative 1.
  - FR1: storage unchanged, so alternative 1, 2 or 3 at the link layer; a path layer reads through either encoding, and the two stored encodings remain.
  - FR2: alternative 4; split and collapse become derivations (seeds S3), at the cost of derived-link identity (PS217) and a stored-shape change to live diagrams.
  - FR3: alternative 5; continuation is part of a cable's declared route, split returns as "does the passing cable terminate here?" and collapse as "splice two cables", both authored (seeds S16), and the director's "converts it to a junction" becomes a Round-2 candidate; pipes and cables are stored, so live diagrams change stored shape, and every door has to offer the authored terminate and splice operations.
  - Stages axis: no difference.
- **What would separate the alternatives:** Under each alternative, replay the map's G1 cases (P1-P8) and D2's split case: does any sequence of doors and triggers leave a history-dependent stored form? Can an author tell the two encodings apart on screen, and does either carry authored intent the other lacks? Does any consumer need to tell "one link via W" from "two links meeting at W" when roles, plane and direction are equal (name, identity, spawn, a declared flow's route)? If none does, the encodings carry one meaning and the question is storage only; if one does, they carry different meanings. Also a tally of each encoding in the 38 live diagrams.
- **Intent bearing:** Q1 a (AX2: the split at one door, the collapse at another); Q1 c (AX5: two encodings of one drawing); AX1 (a Round-1 primary axis); AX6 (one-way door on 38 live diagrams); DS7; DS15; DS16.
- **Depends on / blocks:** Depends on: PS110 (S15), PS109 (S16), PS116 (S4), PS201 (F6), PS211 (F7, the role half). Blocks: PS205, PS212 (F8), PS213, PS218 (F9), PS306, PS307 (F16), PS314 (F18), PS315 (F19), PS316 (F40), PS323 (F24), PS411-PS413 (F27), PS414, PS415 (F28), PS118 (S5). Related (overlapping, not merged): PS312.
- **Evidence (defects/contradictions):** D1, D2, D3, D4, D12, D41, D43, D44; C1, C3, C5, C6, C25, C48.

### PS118. Is what an author draws the same thing as what the document stores?
- **Track / layer:** seam ; writes, vocabulary
- **Covers:** S5 (authoring vocabulary vs stored vocabulary; the w gesture compiling to pipes; the parity consequence)
- **The question:** When an author draws "a link through these cells", is that verb stored as drawn, or does it compile down to a different stored form (pipes, minted waypoints, split links)?
- **Why it is open:**
  - DIRECTOR, 2026-09-25 (seeds S5): "Using the w key to create a link with bends might also construct wires between the anchors under the hood mechanically."
  - Seeds S5 [I]: "The author's verb (draw a link through these cells) may be higher-level than what is stored (wires); the verb compiles down. Same for `draw link a b --via cx,cy`." And on parity: "if every door compiles through ONE function (planner-side), gesture and CLI converge and 'a new route landing on a bend' stops being a special write."
  - Every door already compiles, and each does it differently (map s5): the browser's link gesture may yield a link, a routed link, a split or a chain (input.js:204-293); CLI `draw link --via` takes cells and mints a waypoint per cell (verbs.mjs:1872-1950); REST POST /links creates straight links only (rest.js:196); a link ending at another link's bend is split by commitRoute only [V]; the undo label is 'link' or 'route' according to via (commands.js:330) [M-read].
  - The authoring pseudo-type 'waypoint' is a hand value at several sites (verbs.mjs:1660; input.js:261, 865, 890; palette.js:251-252) [M-read].
- **Alternatives:**
  1. (status quo) Each door compiles its own verb into stored links and waypoints (the browser split and mid-route w, CLI minting, REST straight only).
  2. The author's vocabulary is the stored vocabulary: the author draws exactly what is stored, and nothing compiles.
  3. A higher-level verb compiles through one shared function into stored primitives (pipes under FR2 and FR3; links and waypoints under FR0 and FR1).
  4. The higher-level verb is itself stored as a declaration, and lower forms are derived from it (for instance an FR3 cable with a routed via).
  5. other.
- **Recorded positions:**
  - DIRECTOR, 2026-09-25 (seeds S5, DS16; no label in the source, carried as a statement in PS302 and PS314), worded as a possibility ("might"), as quoted.
  - RULED [LOCKED] (TRANSACTIONS D12, TRANSACTIONS.md:344; lock date not carried): the server computes cascades; the browser sends intent.
  - RULED W7 (director, 2026-09-04, WRITES.md:253-255): "W7 RULED: the op carries INTENT, and the server resolves it"; the per-op projection advance is described at WRITES.md:261-263.
- **Under each frame:**
  - FR0: alternative 1.
  - FR1: alternative 1 or 3 at the link layer; declaring a flow is a new verb (PS112).
  - FR2: alternative 3; the w gesture compiles into pipes (the director's statement).
  - FR3: alternative 4 for cables (declare the ends, derive the route), or 3 (declare the route as pipes).
  - Stages axis: under AS CAPABILITIES a stage could register its own authoring verb and compile step.
- **What would separate the alternatives:** Does an author or agent ever need to address a stored primitive the verb produced (edit one pipe, one minted waypoint)? Does one verb at two doors produce identical stored results? Today it does not (split vs unsplit, C3).
- **Intent bearing:** Q1 a (AX2: "Browser, server, CLI and REST compute the same thing; no rule lives at one door"); Q1 c (AX5); the director's S5 statement quoted above.
- **Depends on / blocks:** Depends on: PS116 (S4), PS103 (S12), PS109 (S16). Blocks: PS314 (S5 compile location, F18), PS205, PS212 (F8), PS313 (F17).
- **Evidence (defects/contradictions):** C3; D2, D4, D5, D6.

**PS119 -- merged into PS314 (Part 3).** The frame drafter's entry "If an authored verb compiles to a different stored form, where is the compile step computed?" (Covers: S5, its open item "is the compiler a client helper, a planner pass, or a declared op kind the server expands?") asked the same question as PS314's S5 half. Its evidence, alternatives, recorded positions, frame readings, separating tests and intent bearing are carried in PS314.

### PS120. Where do behaviour, appearance and session state sit relative to the connection stack?
- **Track / layer:** frame / A ; behaviour, appearance
- **Covers:** S1 (the candidate's Behaviour, Presentation (cross-cutting) and Session (decorates) rows)
- **The question:** Seeds S1's candidate places behaviour as a layer, presentation as cross-cutting and session as decoration. Are these layers of the connection stack, concerns that attach to any stage, per-stage contributions, or something else?
- **Why it is open:**
  - Seeds S1 candidate [I]: "... / Behaviour / Presentation (cross-cutting) / Session (decorates)."
  - Survey Q2, corrected reading (envelope S1.Q2): "Behaviour and events are inside the unified substrate; HOW they join it (packs on anchors, attachments to flows or paths, or something else) is open and carried to design." The director's example attaches a visual flow element to a declared FLOW, not to an anchor.
  - Appearance today: four derivation shapes (an attribute map for links, a layer list for waypoints, shared predicates for nodes, literal assembly for zones and groups) and no composes/priority resolver [V] (map s2.3).
  - Canvas and export disagree in several places (D16, D27-D33) [M-run and M-read R2, R5].
- **Alternatives:**
  1. (status quo) Appearance derived per kind; session as CSS classes set at their own sites; behaviour in engine/ reading one link.
  2. Layers of the stack: behaviour above flow, presentation above everything (the seeds S1 candidate).
  3. Cross-cutting concerns that may attach to any stage (anchor, pipe, link, path, flow).
  4. Per-stage contributions: each stage contributes its own appearance and behaviour.
  5. Packs of the appearance family on anchors only, with other stages' appearance handled separately.
  6. other.
- **Recorded positions:**
  - RULED 2026-09-22 (DECISIONS.md:343-350): "Session state is NOT a pack, and does not compete with one." and "They DECORATE whatever was drawn." [M-read here]
  - RULED 2026-09-22 (DECISIONS.md:278): appearance is one of the two pack families in scope.
  - RULED 2026-09-22 (DECISIONS.md:357-368): composes/priority per derived state, unbuilt [V].
- **Under each frame:** FR0 has appearance for links and waypoints only. Under FR1 to FR3, each new stage (pipe, cable, logical link, path, flow) needs a visible form (Q3 b), so the question grows with the number of stages.
  - Stages axis: under AS CAPABILITIES a stage may carry its appearance and behaviour contributions with it.
- **What would separate the alternatives:** Take the director's "visual flow element" along a multi-hop path. Is it drawn by the flow stage, by a presentation layer reading the flow, or by a pack on each anchor it passes?
- **Intent bearing:** Q2 c (behaviour and events inside the substrate; policy out); Q3 b (a noun must be visible); the director clarification: "have that path/flow ... have a visual flow element along them".
- **Depends on / blocks:** Depends on: PS106 (S1), PS101 (S2), PS409 (S11). Blocks: PS222 (S10), PS409 (F30; mutual), PS418 (F30), PS424, PS425 (F34), PS426 (F35).
- **Evidence (defects/contradictions):** D16, D23, D27-D33; C20, C28.

### PS121. What is the lowest connection primitive called?
- **Track / layer:** vocabulary ; pipe
- **Covers:** S16 (naming: pipe); seeds naming note; F10 (its "reclaim wire" option); map s7.1 (WIRE)
- **The question:** If a unit below the link exists (PS107), what is it called?
- **Why it is open:**
  - DIRECTOR, 2026-09-25 (seeds S16): "I like wire because it relates to physics of our model, not the physics of the visual diagram it aims to represent ... I'm open to thinking about 'pipe' as a term if it helps."
  - DIRECTOR LEANING, 2026-09-25 (seeds naming note): "I now like pipe under this model."
  - Seeds S16 [I]: "Electrically, 'wire' is a conductor (closer to a cable); 'pipe'/'conduit' suggests containment (what the director described)."
  - "wire" today carries the network/serialization boundary (the dominant sense: app/src/sync.js:37, server/validate.js:3, model/ops.mjs:4, server/protocol.js:33, model/model.mjs:7), the DI verb, "wiring" meaning drawing links (commands.js:286; input.js:15), prose for a drawn line (kernel/renderer.mjs:200, 217), "rewire" for replug (commands.js:213; input.js:13) and the retired kernel union (map s1.1 WIRE, AMBIGUOUS) [S; M-read R1, R3, R7].
  - "pipeline" names the appearance pipeline, the geometry pipeline, the kernel render pipeline, HTTP keep-alive pipelining and the history pipeline (map s1.4 pipeline row, AMBIGUOUS) [M-read R5]. How "pipe" fares under plain-text search next to "pipeline" is NOT-CLAIMED (no search was run).
  - HIERARCHY.md:77 planned a scanner failure on "any surviving `wire`", never built (C11). "net" is vision only (HIERARCHY.md:29, 88, 95; map s7.2).
- **Alternatives:**
  1. (status quo) No name, because no such unit exists.
  2. pipe (the director's leaning of 2026-09-25).
  3. wire (the director's earlier term; reclaiming it means renaming the transport uses, map F10 option).
  4. conduit.
  5. adjacency, edge, hop or segment (each already carries other senses: edge is a container face, hop a routed link or chain piece, segment a geometric point pair; map s1.2).
  6. other.
- **Recorded positions:**
  - DIRECTOR LEANING, 2026-09-25: pipe, as quoted, with the director's criterion "the physics of our model, not the physics of the visual diagram".
  - Seeds S16: "Open; the director's call."
  - RULED: none; the wire ban planned at HIERARCHY.md:77 was never built (C11).
- **Under each frame:** FR0 and FR1 have no primitive to name. Under FR2 the name belongs to a unit that links are derived from; under FR3 it belongs to a conduit that cables run through (the director's description).
  - Stages axis: no difference.
- **What would separate the alternatives:** A plain-text search for each candidate across code and record, counting the senses each already carries (mission-kit K27 covers naming for discovery). Does the name read as containment (FR3) or as a conductor (FR2)?
- **Intent bearing:** The director's statements quoted above; Q1 c (AX5: fewer concepts for an author or agent to learn).
- **Depends on / blocks:** Depends on: PS107 (S16), PS106 (S1). Blocks: PS122 (F10, the remaining connection nouns).
- **Evidence (defects/contradictions):** C11.

### PS122. What do "link", "path", "route" and "flow" (and "run", "net", "layer") name once the stack is settled?
- **Track / layer:** vocabulary ; link, path, flow
- **Covers:** F10 (naming the connection nouns); map s7.1 (LINK, PATH, FLOW); map s7.2 (the route, run, net, trace and segment/hop rows)
- **The question:** Each candidate word already holds a narrower ruled or coded meaning. Are those meanings widened, kept narrow with new nouns minted beside them, or reassigned?
- **Why it is open:**
  - map F10: "path is one link's coordinates [LOCKED]; route is one link's anchors, plus seven other senses; flow is a boolean; wire means transport ...; run has four senses"; "segment and hop each name both a geometric piece and a whole link"; "The 2026-08-19 taxonomy froze route and path (HIERARCHY.md:37-47)" [M-read].
  - map s1.1: PATH is AMBIGUOUS (seven code senses; the multi-link sense ABSENT); FLOW is AMBIGUOUS (a declaration identifier vs traffic built without the name; the flow-pair sense ABSENT); LINK is RULED.
  - map s10.1 critic gap 2: the FLOW row lacks a live code meaning. The browser renders an undeclared link as flow both ways ('<->', readout.js:141-147), while the rules read no direction (invariants.mjs:127-129); tests/rules.test.js:101 uses "flow" for mover traffic [M-read critic].
  - "layer": waypointLayers is an appearance layer list (geometry.mjs:297-309); the ontology says a node "is not a LAYER" (DECISIONS.md:301) [M-read here]; the seeds use "layer" and "stage" for the connection stack.
  - Director, 2026-09-25 (envelope): "I keen using flow/path and wire/link interchangeably for now".
- **Alternatives:** (the map's F10 options, plus the status quo and the frames)
  1. (status quo) Keep every word's current narrow meaning; no multi-link noun.
  2. Widen `path` to a multi-link derivation.
  3. Adopt prism's `route` (src, hops, dst) as a declaration.
  4. `flow` for the declared src:dst pair and `path` for its derivation.
  5. Reclaim `wire` or `net` for the connected set and rename the transport uses.
  6. Keep all four narrow and mint new nouns.
  7. `link` as the unit, with segment and hop reserved for geometry.
  8. `link` for the cable (FR3), with the stored-record sense retired.
  9. other.
- **Recorded positions:**
  - RULED 2026-08-19 [LOCKED] (HIERARCHY.md:37-47): route and path.
  - Record (BACKLOG B38, d349ccd, 2026-08-19): "link means one thing again".
  - RULED (DECISIONS.md:126; the line entered DECISIONS.md in 6604a52 on 2026-09-04, and its original ruling date is NOT-CLAIMED, PS113): prism routes are not borrowed (PS124).
  - DIRECTOR, 2026-09-25 (envelope): the words are used interchangeably "for now", as quoted.
  - DIRECTOR, 2026-09-25 (seeds S16): "paths are logical, flows are specific instances of traffic".
- **Under each frame:** FR0 adds no nouns. FR1 names path and flow above link. Under FR2 "link" names a derived thing, so the stored-entity sense of the word moves. Under FR3 link = cable, and path and flow are logical.
  - Stages axis: no difference.
- **What would separate the alternatives:** For each word, list every current carrier (map s1) and count the sites that would change. Check whether any external consumer (/api/v1, /connect/v1) exposes the word (map F5: X1's revival trigger).
- **Intent bearing:** The director's statements quoted above; Q1 c (AX5); Q3 (a noun is admitted when something attaches to it and it is visible).
- **Depends on / blocks:** Depends on: PS106 (S1), PS109 (S16), PS301, PS302 (F1), PS213, PS218 (F9). Blocks: PS226, PS227 (F26), PS220 (F36).
- **Evidence (defects/contradictions):** C11, C12, C14, C19, C36, C40, C42.

### PS123. Which concepts the map found unnamed or multiply named become nouns, by what test, and at which layer?
- **Track / layer:** vocabulary ; all connection layers, and Track A
- **Covers:** map s7.2 (the rows PS121 and PS122 do not carry); map s1.4 (the kind and socket rows)
- **The question:** The map lists concepts that exist in code with no name, or under several names. Which are admitted as nouns and which stay unnamed? Does the survey's Q3 admission test decide it?
- **Why it is open:**
  - map s7.2, Track B and seam rows: termination / thread (predicates restated at 7+ and 2+ sites); incidence role vs aggregate role; two-link terminus / pass-through / splice; threaded bend vs pass-through; tap / T-bend; crossing (admitted, though "cannot arise", C3); bundle / bus / trunk (archive only); port / attachment point; free anchor / cell anchor; slot / cell / place / position / occupant (the grid sense of anchor); plane (a `control` boolean); forwarding / switching (unbuilt); flow pair / demand / intent (no shape); lane / leg / track and heading / armed end (the mover's travel unit and direction); far end; incidence.
  - map s7.2, write and Track A rows: derived op / consequence / reaction / repair; re-put / lineage / id survival; door / door table; recomposition / retype; composition registry / type table; presence-gated capability / implicit pack; activation instant; emitting / live spawner; panel; tower / turret; run mode / read view / play.
  - map s10.1 critic gap 2: PROJECTION carries at least four meanings and has no glossary row [M-read critic].
  - map s1.4 AMBIGUOUS rows that no other entry carries: `kind` (entity kind and id prefix, document kind, scene element kind, the engine's "kind" that is node type at kinds.mjs:2-16, spawn.kind, fact kind, pick hit.kind, index kind) and `socket` (glyph mount, content socket grid, websocket) [M-read]. Seeds S21 adds "kinds/specs" as a further sense under stages AS CAPABILITIES [I].
- **Alternatives:**
  1. (status quo) The concepts stay unnamed or multiply named, with their predicates restated per site.
  2. Name every concept the map lists, one word each.
  3. Name only the concepts that pass the Q3 test (something attaches to it; an author or agent can see it).
  4. Name each concept when its layer is designed, in that layer's own design pass.
  5. Name the predicates and roles (termination, threading, incidence role) but not the transient or Track A concepts.
  6. other.
- **Recorded positions:** none on the list as a whole. Individual rows carry positions elsewhere (for instance the [LOCKED] crossing tunnel-gap, ATOMICS.md:61-65, and [LOCKED] ports, ATOMICS.md:69-76).
- **Under each frame:** Under FR0 and FR1 the rows read as the map records them. Which rows survive depends on the frame. Under FR2 and FR3, "two-link terminus", "threaded bend vs pass-through" and "tap" change meaning, because the bend has one encoding at the pipe level (PS117) [I]. Under FR3 a crossing becomes a cable passing an anchor (seeds S16) [I].
  - Stages axis: no difference.
- **What would separate the alternatives:** Apply the Q3 test row by row: does anything attach to the concept, and can an author or agent see it at every door? (Map s10.1 critic gap 1: roles and incidence are not readable at REST or the CLI today.)
- **Intent bearing:** Q3 abc (noun admission); Q1 c (AX5); the Q3 pick deliberately does not require a noun to delete special-case code (envelope S1.Q3).
- **Depends on / blocks:** Depends on: PS106 (S1), PS109 (S16), PS122 (F10). Blocks: none named. Related (overlapping, not merged): PS129.
- **Evidence (defects/contradictions):** C3, C13, C41, C42.

### PS124. What standing does prior art have for the connection layers?
- **Track / layer:** programme / vocabulary ; link, path, flow, routing
- **Covers:** prior art (prism LINK vs ROUTE kept distinct; prism route {src, dst, hops} explicitly NOT borrowed at DECISIONS.md:126; fractal link/path; prismv2 as a separate kernel/core engine concept)
- **The question:** The record excludes prism's routes, pathfinder and tag selectors, while prism, fractal and prismv2 each carry a split that bears on the stack. Does the exclusion extend to a declared path or flow layer, and which prior-art splits count as evidence for the layer boundaries?
- **Why it is open:**
  - prism: LINK is a straight src/dst adjacency kept DISTINCT from ROUTE (LinkFactory.js:20-31; L3Resolver.js:93-110). ROUTE is {src, dst, hops[]}, with hops as nodes or tag selectors {matchTags, orderBy}, resolved per compile (RouteFactory.js:20-31; L2Compiler.js:74-108; L3Resolver.js:207-240). prism v1 stored a PATH entity {points} (map s7.1, s7.2) [M-read R7].
  - fractal: link = {path: [tag, ...], opts: {close, radius, handles, gap}}, scoped to a group level; fractal's path is the tags a link visits, which drawv2 calls a route (fractal/schemas/linkTest.js:19-31, 70-78; engine/nlink.js:41-46, 99-108) [M-read R7].
  - prismv2 (seeds, prior art): "a separate kernel/core engine concept; derived relations over observed primitives (EDB/IDB); firewall/route-map/conntrack/k8s lineage. engine/ here is its banked substrate."
  - DECISIONS.md:126: "Explicitly NOT borrowed: L1-L4 compiler, layouts/settlement, routes/pathfinder, tag selectors, class/style entities, Merkle/hash auditing, reverse RPC, multi-host, k8s binding, peer mesh." [M-read here]
  - In the seeds' reading, prism's LINK/ROUTE split has the same shape as FR3's pipe/cable split: an adjacency against a route over adjacencies [I].
- **Alternatives:**
  1. (status quo) The exclusion stands as written, and prior art is not consulted for the connection layers.
  2. The exclusion stands for the compiler and pathfinder, while prior art's shapes (LINK vs ROUTE; route {src, dst, hops}) count as evidence for the layer design.
  3. Revisit the exclusion for a declared path or flow layer (map F36 option "revisit the prism route exclusion").
  4. Borrow mechanisms (a route resolver, tag selectors) as candidate routing capabilities (PS113).
  5. prismv2's layered derivation (EDB/IDB, stratified evaluation) as the evaluation model for stages (PS103 alternative 3).
  6. other.
- **Recorded positions:**
  - RULED (DECISIONS.md:126, section "Borrowed mechanisms (narrow, by source)"): the exclusion, as quoted. The line entered DECISIONS.md in 6604a52 on 2026-09-04 from SCOPE.md; its original ruling date is NOT-CLAIMED [M-read here, git log -L].
  - DIRECTOR DIRECTION (recorded in auto-memory, `line-routing-references`, not in the repo record): fractal and prism are "the wells to draw from 'when we are ready'" for links and line routing; prism's paths and routes are derived entities ("confirmed by the user 2026-09-25"); prismv2 is "Not the same thing" as prism (a conflation the user corrected on 2026-09-25) [M-read here, memory file].
  - Side by side, not resolved: the ruled exclusion of prism's routes and pathfinder, and the memory-recorded direction to borrow from prism and fractal for line routing.
- **Under each frame:** Under FR0 prior art does not reach the stored shape. Under FR1, prism's route {src, dst, hops} resembles a declared flow with a pinned path. Under FR2, fractal's link as a tag path resembles a link derived through anchors. Under FR3, prism's LINK vs ROUTE split resembles pipe vs cable [I].
  - Stages axis: prismv2's lineage (seeds S12) is the evaluation model behind AS CAPABILITIES in the seeds' reading.
- **What would separate the alternatives:** Was the exclusion at DECISIONS.md:126 about a mechanism (a compiler and pathfinder inside draw) or about a declared shape? The line records no reason.
- **Intent bearing:** INTENT-SILENT in the survey: no Round-1 pick or verbatim survey statement addresses prior art, and the director's direction exists only in auto-memory. A Round-2 candidate, or a direct question to the director.
- **Depends on / blocks:** Depends on: none. Blocks: PS220 (F36).
- **Evidence (defects/contradictions):** C34, C35 (the archive realizers and pre-purge history are not in the live repo).

### PS125. Are linking, routing and forwarding one capability or several, and is linking itself a behaviour added over anchors and whatever connection unit lies below the link?
- **Track / layer:** frame / seam ; pipe, link, path, flow, anchor
- **Covers:** S17 (appended to the seeds after the parts were drafted; entry written at assembly)
- **The question:** The word "routing" covers three things: where a cable runs through pipes and where it may end or continue at an anchor (linking), how a flow's path is computed across the link graph (routing), and what an anchor does with traffic passing through it (forwarding). Are these one capability, three, or some other split, and is linking a fixed part of the engine or a behaviour added over anchors and whatever connection unit lies below the link?
- **Why it is open:**
  - DIRECTOR QUESTION, 2026-09-25 (seeds S17): "So 'linking' might become a modded behaviour over pipes/anchors? would this be different to 'routing/forwarding' capability?"
  - Seeds S17 (Claude's distinction, "for weighing") [I]: "LINKING (L1 cabling: where cables run through pipes -- cable routing via declared via or an auto-router -- and where they may end or continue at an anchor); ROUTING (L3 control plane: computing a flow's path across the link graph, graph-wide, per flow); FORWARDING (L3 data plane: what an anchor does with traffic passing through -- pass on, fan out, terminate; per anchor, per flow)."
  - The record uses "routable" for topology, permission and the write (DECISIONS.md:255-257) and "routing capability" for forwarding (ATOMICS.md:353-354); map F27 records the two as "not reconciled" [M-read].
  - Forwarding (clone, round robin, route) is designed and unbuilt (ATOMICS.md:340-349) [M-read]; no code walks more than one link (map 3.4) [M-read R1, R2, R4, R7].
  - "route" carries eight senses in code and record (map 1.2, route row) [M-read].
  - Seeds S17 [I]: "One composition contributes to several stages: a router terminates links (linking stage) AND forwards flows (forwarding); a server terminates links and flows."
- **Alternatives:**
  1. (status quo) None is built as a capability: `routable` names topology, permission and the write in the record, and "routing capability" names forwarding in the design text.
  2. One routable capability covering linking and forwarding (seeds S17 lists this as the status quo of the record's wording).
  3. Separate linking, routing and forwarding capabilities.
  4. Linking as one capability, with routing and forwarding combined in another.
  5. Linking as a fixed part of the engine, with routing and forwarding as capabilities over it.
  6. other.
- **Recorded positions:**
  - RULED 2026-09-22 (DECISIONS.md:255-257): `routable` owns "the permission table, the derivation, and the write".
  - Record (ATOMICS.md:340-354, designed and unbuilt): forwarding at junctions; "routing capability" names it.
  - DIRECTOR QUESTION, 2026-09-25 (seeds S17), as quoted. No director leaning on it is recorded.
  - AGREED by the director, 2026-09-25 (seeds naming note; recorded in the seeds' own words, not as a director quotation; not in DECISIONS.md): two layers of routing -- links through pipes, and paths over links.
  - HYPOTHESIS (seeds S17, Claude): the three-way distinction.
- **Under each frame:**
  - FR0: linking is the author's hand-routed via; nothing routes or forwards.
  - FR1: linking is unchanged (stored links); routing derives flow paths over links; forwarding would read flows at anchors [I].
  - FR2: linking is the chain derivation that cuts pipe chains at anchors (PS209), not a routing of cables [I].
  - FR3: linking routes cables through pipes (a declared via or an auto-router), and routing derives paths over cables: the two routing layers as agreed [I].
  - Stages axis: seeds S17: "Under stages-as-capabilities, linking is itself a registered capability ("modded behaviour") over pipes and anchors; under fixed stages it is part of the engine."
- **What would separate the alternatives:** For a router, a server and a load balancer, list what each contributes to linking, routing and forwarding. Does any composition need one of the three without the others? Do cable routing through pipes and flow routing over links take inputs of one signature (PS113)? Does forwarding need per-flow state, which would meet the ruling that packs are "DERIVED and stateless" (DECISIONS.md:278-279)?
- **Intent bearing:** The director question quoted above; DS6 ("We are building a full fidelity network system"); DS2 ("multihop across routed junctions/nodes"); Q1 d (AX4) and Q1 c (AX5); Q2 c (routing and behaviour inside the substrate; policy outside).
- **Depends on / blocks:** Depends on: PS103, PS104 (S12), PS113 (S16, the two routing layers). Blocks: PS411-PS413 (F27), PS310 (S6c, extension). Related (overlapping, not merged): PS113, PS412.
- **Evidence (defects/contradictions):** none (the three concepts are unbuilt; map F27 records routable and forwarding as "not reconciled").

### PS126. Can the connection stack recurse, so that a link rides over a path (overlays and tunnels)?
- **Track / layer:** frame ; link, logical link, path
- **Covers:** S18 (appended to the seeds after the parts were drafted; entry written at assembly)
- **The question:** A tunnel or overlay is a logical link carried over a path: a higher-layer link rides on lower-layer routing. If the model includes overlays, some links run over paths rather than through pipes, and the stack recurses (link -> path -> link -> path). Is recursion part of the connection model, and if so, where does it sit?
- **Why it is open:**
  - Seeds S18 [I]: "A tunnel is a LOGICAL link carried over a PATH: a higher-layer link rides on lower-layer routing." "If full fidelity includes overlays, links do not only run through pipes; some run over paths, and the stack recurses (link -> path -> link -> path ...)."
  - The node type lists already include `vxlan` (palette.js:14; verbs.mjs:31; map 2.2) [M-read]. Behaviour keyed by type exists for `loadbalancer` only (TOWERS, kinds.mjs:49-51; map 1.4) [M-read], so a vxlan node is today a glyph and a name prefix [I from the map's type table].
  - Seeds S18 [I]: "Bears directly on stages fixed vs stages as capabilities: a fixed linear stack cannot recurse."
  - The stack questions elsewhere in this register (PS102, PS106) list linear stacks, lowest first [I].
  - The director's four relations (series, parallel/LAG, multiplex/VLAN, parallel links; DS7) do not name overlays.
- **Alternatives:**
  1. (status quo) No overlay concept; a vxlan node is a glyph and a name prefix like any other type.
  2. No recursion: overlays drawn as ordinary links (seeds S18).
  3. Recursion as a first-class stage relation: a link stage may take a path as its conduit (seeds S18).
  4. Overlays as a logical-link construct at one fixed layer, beside aggregation and multiplex (seeds S18; compare PS110).
  5. other.
- **Recorded positions:** HYPOTHESIS (seeds S18, Claude). RULED: none. No director position on overlays is recorded.
- **Under each frame:**
  - FR0: does not arise beyond the vxlan glyph.
  - FR1: an overlay link could be stored like any link, or declared over a derived path [I].
  - FR2: derived links come from pipe chains, so an overlay link has no pipes of its own unless a path can stand where a pipe stands [I].
  - FR3: an overlay cable would run through a path instead of through pipes; the logical constructs over cables (LAG, VLAN) are the nearest existing slot [I].
  - Stages axis: under stages FIXED, seeds S18 reads that "a fixed linear stack cannot recurse"; under AS CAPABILITIES a stage could declare that it reads the output of a stage above the one it feeds [I].
- **What would separate the alternatives:** Must any overlay case be modelled, constructed and visualised (the four relations of DS7 do not name one)? Must an overlay's route follow the underlay's derived path, or is it only drawn? Does any consumer read an overlay's underlay, for example an underlay change making the overlay unroutable (compare PS221)?
- **Intent bearing:** DS6 ("We are building a full fidelity network system") and the envelope clarification "I guess unification of behaviours here also involves developing the proper "OSI Layered Stack" or equivalent for our drawing system" bear on whether overlays are in scope; Q1 b (AX3) and Q1 d (AX4). No pick or statement names overlays or tunnels (section 8.3).
- **Depends on / blocks:** Depends on: PS103 (S12, stages axis), PS106 (S1, which stages exist), PS110 (S15, S16: the logical-link stage). Blocks: none named. Related (overlapping, not merged): PS102.
- **Evidence (defects/contradictions):** none.

### PS127. Where does derivation run, and where are writes applied: at every peer, at one central point, or split between them?
- **Track / layer:** frame / seam ; all connection layers, behaviour, writes
- **Covers:** S19 (appended to the seeds after the parts were drafted; entry written at audit)
- **The question:** The director describes packs as reconciliation controllers, in the Kubernetes sense, run at the edge (the browser) rather than centrally. Is derived state computed by every peer from the document, computed at one point and sent, or split between the two (for example derived at every peer and written at one ordering point)? Which peers count as the edge: the browser only, or also the server and the CLI?
- **Why it is open:**
  - DIRECTOR STATEMENT, 2026-09-25 (seeds S19): "So in our pipeline, the reconciliation + derivation can occur client-side - and an analogy would be these mod/packs are the 'reconciliation controllers' similar to kubernetes - but pushed out to the edge/browser instead of central"
  - VISION.md:80: "each computes the world from inputs it already holds, rather than being told the outcome"; VISION.md:81: "A consequence is never sent, because sending it would tell a peer something it could have worked out." [M-read at audit]
  - Seeds S19 refinement 1 (Claude, "for weighing") [I]: "an edge controller can DERIVE, not WRITE. k8s controllers reconcile by actuating (writing), one per object; if every peer ran a writing controller, the same write would be applied N times." The seeds cite D2, D3 and D44 as measured symptoms of a client-derived write racing a server-derived one [M-run R3 for D2 and D3; M-run G3 for D44].
  - Seeds S19 refinement 2 [I]: "'edge' = every peer, including the server (the planner must derive to REFUSE, e.g. permission) and the CLI (agents need derived state, GR18/A5; roles are not readable at agent doors today, map critic gap 1)."
  - Today each kind of derived state is computed at its own sites: roles by the two renderers, with the only server-side role computation inside the SVG export (map 10.1 critic gap 1) [M-read critic]; the simulation in the browser in run mode and in the CLI, and not at the server (map 2.4; C16) [M-read R4]; cascade, sweep and collapse by the planner, sent to peers as ops (map 4.3) [V]; the split by the browser alone (map F18) [V].
  - Parity inputs named at engine/rules.mjs:19-25: the document, the clock and the code revision [M-read]. Already divergent between peers: linksAt order, browser index versus CLI scan (D11) [M-run R4 c]; the CLI host clock (D15) [M-read].
- **Alternatives:**
  1. (status quo) Mixed by kind of state: the renderers derive roles; the browser and the CLI each derive the simulation; the planner derives cascade, sweep and collapse and sends them as ops; the browser derives and proposes the split; the server simulates nothing.
  2. Derive at every peer (browser, server, CLI) and apply writes at one ordering point, the planner behind the lock (seeds S19). Implies every peer holds the same derivation code (PS128), and only the planner writes.
  3. Derive at one point and broadcast the results (seeds S19, which records that it contradicts VISION's "a consequence is never sent"). Implies peers receive derived state rather than computing it.
  4. Hybrid: derive at every peer, with the planner deriving again only to validate or refuse (seeds S19). Implies the planner holds every derivation a refusal reads.
  5. Derive in the browser only; the server and the CLI hold no derivation. Implies the agent doors report no derived state unless it is sent to them (PS328).
  6. other.
- **Recorded positions:**
  - DIRECTOR STATEMENT, 2026-09-25 (seeds S19), as quoted. It names derivation and reconciliation at the client; it does not state where writes are applied.
  - RULED [LOCKED] TRANSACTIONS D16 (TRANSACTIONS.md:393; lock date not carried): "The planner is server-only, because *authority* is what must not be duplicated." RULED [LOCKED] TRANSACTIONS D12 (TRANSACTIONS.md:344; lock date not carried): the server computes the cascade; the browser sends intent.
  - Record (ATOMICS.md:349, in the section tagged [DESIGNED 2026-09-22]): "The control plane is computed server-side and the browser is a stateless data plane" [M-read at audit].
  - Record principle (VISION.md:81): "A consequence is never sent".
  - RULED 2026-09-01 (code comment only, engine/rules.mjs:32-35; C37): a rule may not write.
  - RULED 2026-08-23 (GR18, TRANSACTIONS.md:620): "An agent drives draw through the TOOL, and the tool can do everything the API can."
  - Side by side, not resolved: the director's "reconciliation + derivation can occur client-side" and D16's server-only planner; ATOMICS.md:349 and VISION.md:81.
  - HYPOTHESIS (seeds S19, Claude): the derive/write split, and "deterministic lockstep" as the execution analogy for the derive half.
- **Under each frame:** [I]
  - FR0: the sites listed under alternative 1.
  - FR1: a flow's derived path is new derived state, and where it is computed is this question.
  - FR2: the link is itself derived from pipes, so every peer that draws, reports or refuses on a link runs the link derivation, including the planner if it refuses on permission.
  - FR3: a cable routed from its ends (seeds S16) is either derived at every peer or computed once at write time and stored.
  - Stages axis: under AS CAPABILITIES each registered stage is, in the director's analogy, a controller that runs wherever this entry places it; under FIXED the engine's stack runs there.
- **What would separate the alternatives:** Does any derived value differ between two peers holding the same document and code revision (D11 and D15 say one does today)? Does any stage's output have to be available at a peer that does not import its code (the CLI "takes no dependency on `model/`", WRITES.md:259)? Does any derivation have to write, and if so, at how many peers? For each derivation, does the planner need its output in order to refuse a write?
- **Intent bearing:** The director's S19 statement quoted above; Q1 a (AX2: "Browser, server, CLI and REST compute the same thing; no rule lives at one door"); Q1 d (AX4); DS1 ("so that a path can be derived across all viewers"); the Round-1 anchor, the VISION north star ("derived physics that everyone watching computes identically").
- **Depends on / blocks:** Depends on: PS103 (S12), PS105 (S12, S14). Blocks: PS128 (S20, raised by S19). Related (overlapping, not merged): PS227 (F26), PS320, PS321 (F21), PS323 (F24, the shared-code location S19 cites), PS328 (G1).
- **Evidence (defects/contradictions):** D2, D3, D11, D15, D44; C16, C37.

### PS128. Does a document declare the packs it requires, and what follows when that set or its version changes?
- **Track / layer:** programme / frame ; writes, vocabulary, all connection layers
- **Covers:** S20 (appended to the seeds after the parts were drafted; entry written at audit); envelope anti-goal AG-2
- **The question:** If packs contribute derivations, the set of packs and its version are inputs to what a peer derives. Does a document declare the packs it requires? If so, is changing that set a write (locked, versioned, undoable)? What does a peer lacking a declared pack do, how does a door that does not import pack code (the CLI) come to hold the same derived state, and how is pack code held deterministic?
- **Why it is open:**
  - Seeds S20 (Claude) [I]: "If controllers are mods, the controller SET and its VERSION become a parity input: a peer with an older or different pack set derives a different world."
  - Seeds S20 [I]: "Today's defence covers one codebase only: B178 revision pinning (health reports `revision`; a stranded websocket detects a revision mismatch)." The mechanism is in code: the snapshot carries the revision a socket is pinned to (server/protocol.js:77-79), /health returns the live one (server/rest.js:357-365), and app/src/watchdog.js compares them [M-read at audit]. The B178 row itself (BACKLOG.md:297) describes the two-writer collision and records "PART-CLOSED -- the COLLISION half shipped as H13" [M-read at audit].
  - The code revision is already a named parity input (engine/rules.mjs:19-25) [M-read]. Pack and composition have no code (map 1.3) [M-read R5].
  - DIRECTOR LEANING, 2026-09-25 (seeds S20): "yes, a document should declare its required packs. Delivered via the server and in sync per document"
  - DIRECTOR SCOPE, 2026-09-25 (seeds S20; envelope AG-2): "For now, packs/mods will be fixed server-side, and distributed to clients. A later 'admin portal' for managing packs can be worked on - but out of scope"
  - Seeds S20, the scope's effect (Claude) [I]: trust is "settled for current scope (packs are the server's reviewed code; no third-party code)"; "pack version = server revision, mismatch covered by the existing B178 revision check; removing a pack is a code change handled as a one-time migration (X1)". "STILL OPEN: (1) is changing a document's pack set a write; (3) how the CLI gets derived state; (5) determinism enforcement."
  - Seeds S20 sub-question (2) [I]: "version pinning per document (lockfile) vs following the server's latest -- a pack upgrade changing old documents' derived world; tension with X1 and the standing rule 'transform once, then delete the transform'".
  - The CLI "takes no dependency on `model/`" (WRITES.md:259; PS314), yet it already computes the simulation for `draw movers` and `draw combat` (map 2.4) [M-read R4].
  - Seeds S20 [I]: "Extensible physics (survey Q1 d) remains an ARCHITECTURAL property (packs modular and registered apart from the engine); only RUNTIME pack management is out of scope, so S12 (stages fixed vs as capabilities) stays open."
- **Alternatives:**
  1. (status quo) No pack exists in code and a document declares none; every peer runs its own code revision, and a revision mismatch is detected by the B178 check.
  2. A document declares its required packs, and changing the set is a versioned, undoable write through the planner. Implies undoing the change removes what the pack derived, at every viewer.
  3. A document declares its required packs, fixed at creation or changed outside the undo history. Implies a change to the set has no undo record.
  4. No per-document declaration: every document is derived with every pack the server ships. Implies adding a pack to the server changes every document's derived world.
  5. A document declares packs with versions (a lockfile), and every peer derives with the pinned versions. Implies old pack versions are kept, which seeds S20 places in tension with "transform once, then delete the transform".
  6. For a peer lacking a declared pack: it refuses to open the document.
  7. For a peer lacking a declared pack: it opens the document and derives a visible condition (compare PS221).
  8. For a peer lacking a declared pack: it derives without the pack.
  9. other.
- **Recorded positions:**
  - DIRECTOR LEANING, 2026-09-25 (seeds S20), as quoted.
  - DIRECTOR SCOPE, 2026-09-25 (seeds S20; envelope AG-2), as quoted: runtime pack management is out of scope.
  - Envelope S5, AG-2 row (the proposer's wording beside the director's quote): "In scope: a document declares its required packs, from a fixed server-side set delivered to clients and kept in sync per document."
  - RULED 2026-09-22 (DECISIONS.md:299): a pack is "one capability, composable onto an anchor"; (DECISIONS.md:278-279) both pack families are "DERIVED and stateless".
  - Side by side, not resolved: the ruled pack is composed onto an anchor through a composition (DECISIONS.md:299-300); the S20 leaning has a document declare packs. PS129 carries whether these are one unit.
  - RULED (deviation accepted, X1, COMMIT-DELIVERY.md:565; date not measured): /api/v1 is redefined in place, with a revival trigger (PS305).
  - The target "transform once, then delete the transform", which the map (F23) cites from user memory, outside the repository record (PS327).
  - HYPOTHESIS (seeds S20, Claude): the scope's effect on the sub-questions, as quoted.
- **Under each frame:** [I]
  - FR0: no packs exist; the question reads as whether a document records anything about the code that derives it.
  - FR1: the path and flow derivations are new code whose presence a document could declare.
  - FR2: the link derivation is itself engine or pack code, so a peer without it derives no links.
  - FR3: cable routing (when routed from its ends) and the LAG and VLAN constructs are candidate declared packs.
  - Stages axis: under AS CAPABILITIES a declared set can include stages; under FIXED it holds only per-anchor contributions.
- **What would separate the alternatives:** Does undoing a pack-set change have to remove everything derived from the removed pack, and would every viewer see that happen? Can two peers at different server revisions hold one document open at once? Can the CLI produce the same derived state as the browser without importing pack code? Does any document need a pack version other than the server's current one?
- **Intent bearing:** The director's S20 leaning and scope quoted above; Q1 d (AX4: "A new capability or behaviour arrives without an engine change"); Q1 a (AX2); anti-goal AG-2.
- **Depends on / blocks:** Depends on: PS127 (S19), PS103 (S12), PS304 (F5, identifiers for pack and composition). Blocks: PS129 (S21), PS327 (F23). Related (overlapping, not merged): PS219 (S10, determinism), PS305 (F5, X1), PS328 (G1).
- **Evidence (defects/contradictions):** none (packs are unbuilt; the parity breaks that seeds S19 cites are carried by PS127).

### PS129. What is the extension unit called, and is the unit a document declares the same as the unit a composition lists on an anchor?
- **Track / layer:** vocabulary / frame ; anchor, all connection layers
- **Covers:** S21 (its question, its leaning and its open items 1 and 2; open item 3 and the paragraph on pipes are PS130; appended to the seeds after the parts were drafted; entry written at audit)
- **The question:** The director asks whether packs could be called "plugins". Under the name sits a structural question. Is the unit a document declares and the server distributes (PS128) the same as the unit a composition lists on an anchor? Or does one distribution unit contribute several things (per-anchor packs, stages, declaration kinds, appearance)?
- **Why it is open:**
  - DIRECTOR QUESTION, 2026-09-25 (seeds S21): "These packs could be called 'plugins'?"
  - DIRECTOR LEANING, 2026-09-25 (seeds S21): "plugin is the distribution unit, contributing packs and stages"
  - Seeds S21, measured by the seeds' author on 2026-09-25: "'plugin' has 0 uses in code or docs (app, kernel, engine, model, server, cli, docs, dev, VISION)." Re-run at audit over the same directories and VISION.md in the working tree at `a986fb3` (the untracked envelope included): no file contains "plugin", case-insensitive [M-read at audit, grep].
  - "pack" is ruled as "one capability, composable onto an anchor" (DECISIONS.md:299, 2026-09-22; the seeds quote it as "one capability composed onto an anchor") and has no code (map 1.3) [M-read R5]. "capability" in code means authorization (store.js:1127; rest.js:901; protocol.js:498; main.js:599), and "composition" in code is the DI composition root (map 1.3) [M-read].
  - VISION uses "mod" in two senses: "a mod introduces a new kind of force, motion or collision" (VISION.md:68) and "driven equally by a person, a command, an agent or a mod" (VISION.md:130) [M-read at audit]. The director's S19 statement says "mod/packs".
  - Seeds S21 [I]: "A distribution unit may contribute several things at once: stages, kinds/specs, per-anchor packs, appearance (cf. Terraform providers contributing resource types; VS Code extensions contributing commands)."
  - Seeds S21, open under the leaning [I]: "(1) does a stage carry its own spec schema (S14: stage = spec + derivation; e.g. a flow stage brings the flow declaration kind), or are kinds a third contribution? (2) plugin dependencies: a network plugin needs pipe/link stages from elsewhere -> a plugin dependency order (S12's stage ordering seen from distribution); (3) is the core (anchor, pipe) the engine itself or a core plugin every document declares (S2 engine or domain, in plugin terms)?" Item (3) is carried by PS130.
  - Seeds S21: "Renaming or retiring the RULED 'pack' is a director decision."
- **Alternatives:**
  1. (status quo) The ruled word "pack" names a per-anchor capability with no code; no distribution unit exists; "mod" appears in VISION only; "plugin" is unused.
  2. One word, one unit: pack = plugin (seeds S21 alternative 1). Implies the ruled per-anchor unit is also what a document declares.
  3. Two units: plugin = the distribution and registration unit a document declares, contributing per-anchor packs, stages and kinds; pack = the per-anchor contribution a composition lists (seeds S21 alternative 2; the director's leaning). Implies a dependency order among distribution units (open item 2).
  4. "mod" (VISION's word) or "extension" for the distribution unit (seeds S21 alternative 3). Implies either a word VISION already uses in two senses takes a third, or a new word is minted.
  5. Three contribution types under one distribution unit: packs, stages and declaration kinds (seeds S21 open item 1).
  6. other.
- **Recorded positions:**
  - RULED 2026-09-22 (DECISIONS.md:299-300): pack = "one capability, composable onto an anchor"; composition = "a named set of packs".
  - DIRECTOR QUESTION and DIRECTOR LEANING, 2026-09-25 (seeds S21), as quoted.
  - Side by side, not resolved: the ruled "pack" and the leaning's "plugin" as a second, wider unit; seeds S21 records that renaming or retiring "pack" is the director's decision.
  - Record (VISION.md:68, :130): "mod" in two senses, as quoted.
  - HYPOTHESIS (seeds S21, Claude): the reading of the leaning, "plugin = distribution/registration unit (declared by a document, fixed server-side, delivered to clients); pack = per-anchor contribution listed by a composition (ruled name kept); stage = graph-wide derivation layer; composition = named set of packs (ruled)".
- **Under each frame:** [I]
  - FR0: no distribution unit exists; the per-type tables (GLYPH_DEFS, TOWERS) are the nearest contributions (map 2.2).
  - FR1: a network unit could contribute the path and flow stages and the flow declaration kind.
  - FR2: the link derivation comes either from the core or from a unit (PS130).
  - FR3: cable routing and the LAG and VLAN constructs are candidate contributions of one unit.
  - Stages axis: under AS CAPABILITIES a unit contributes stages as well as packs, and units depend on each other (open item 2); under FIXED a unit contributes per-anchor packs into the fixed stack only, while the leaning's wording has it contribute stages.
- **What would separate the alternatives:** Does any unit a document declares contribute anything other than per-anchor packs (a stage, a declaration kind, appearance)? If none does, one unit covers every case. Does any contribution depend on another unit's stage (open item 2)? Is any unit distributed without being listed by a composition, or listed without being distributed? A plain-text search for each candidate word across code and record, counting the senses each already carries (mission-kit K27 covers naming for discovery).
- **Intent bearing:** The director's S21 question and leaning quoted above; Q1 c (AX5: fewer concepts for an author or agent to learn); Q1 d (AX4).
- **Depends on / blocks:** Depends on: PS128 (S20), PS104 (S12), PS103 (S12). Blocks: none named. Related (overlapping, not merged): PS101 (S2), PS114 (S14, open item 1), PS123 (vocabulary), PS304 (F5, identifiers for pack and composition), PS130 (S21, open item 3).
- **Evidence (defects/contradictions):** none.

### PS130. Is the pipe part of the engine's core, present in every world and document, or something only some worlds or documents carry?
- **Track / layer:** frame ; anchor, pipe
- **Covers:** S21 (its open item 3, and the paragraph on pipes appended to it after the audit; entry written at audit)
- **The question:** If a unit below the link exists (PS107), is it part of the core that every world on the engine has, beside anchors? Or is it carried only by the worlds or documents that include it, so that the core is anchors in space?
- **Why it is open:**
  - DIRECTOR, 2026-09-25 (seeds S21, no label in the source): "We can weigh up whether the concept of pipes is a plugin or core". The seeds record it as "explicitly OPEN for the design phase".
  - Seeds S21 open item (3) [I]: "is the core (anchor, pipe) the engine itself or a core plugin every document declares (S2 engine or domain, in plugin terms)?"
  - Seeds S21, "Toward core" (Claude) [I]: "VISION defines a document as 'things placed on a grid, and the paths between them'; every moving behaviour built so far rides a connection (movers ride a link)." VISION.md:17 reads "A document declares geometry - things placed on a grid, and the paths between them." [M-read at audit]. Movers travel one link (map 3.5) [M-run R4].
  - Seeds S21, "Toward plugin" (Claude) [I]: "VISION's physics lists 'position, distance, range and arrival' -- range and distance are spatial, not adjacency; towers act by range with no connection; a second, unlike world (VISION's test that the engine is real) may have space without adjacency or adjacency with other rules; under stages-as-capabilities, pipes-as-plugin leaves the smallest core (anchors in space)." VISION.md:67 reads "Position, distance, range and arrival are computed from geometry and a clock." [M-read at audit]. Towers are keyed by node type and aim at the in-range mover (map 2.4; rules.mjs:88-102) [M-read R4].
  - The ruled core includes reachability by links: the anchor is "Identity, position, and the fact that links can reach it" (DECISIONS.md:298, 2026-09-22) [M-read at audit].
  - No pipe exists in code (map s1.1 WIRE: ABSENT as a unit distinct from link) [M-read].
- **Alternatives:**
  1. (status quo) No pipe exists; the stored link is the only connection unit, held in model/ and kernel/, and the code has no core/extension distinction (map s1.3: pack and composition have no code).
  2. The pipe is in the core: the engine is anchors plus pipes (plus a capability mechanism, as seeds S12 alternative B reads it). Implies every world on the engine has adjacency between anchors.
  3. The pipe comes from a core unit that every document declares (seeds S21 open item 3). Implies the engine itself holds anchors in space, and every document names the unit.
  4. The pipe comes from a unit that only some worlds or documents include, and the core is anchors in space (seeds S21, "Toward plugin"). Implies a document without that unit has no connections.
  5. No pipe at all (FR0, FR1): the same question reads for the stored link.
  6. other.
- **Recorded positions:**
  - DIRECTOR, 2026-09-25 (seeds S21, no label in the source), as quoted; recorded there as open for the design phase.
  - DIRECTOR TENTATIVE LEANING, 2026-09-25 (seeds S21, added after the fixer ran): "Yep, perhaps pipes cost nothing as core". Hedged by the director ("perhaps"); the question stays open. It answers Claude's framing "If not, pipes cost nothing as core" in the separating question above, so the separating question has not itself been answered.
  - RULED 2026-09-22 (DECISIONS.md:298): the anchor core includes "the fact that links can reach it".
  - Side by side, not resolved: the ruled core includes reachability by links; alternative 4 leaves anchors in space as the core.
  - HYPOTHESIS (seeds S21, Claude): the toward-core and toward-plugin readings, as quoted. HYPOTHESIS (seeds S12, Claude): "engine = anchors + wires + capability mechanism".
- **Under each frame:** [I]
  - FR0, FR1: no pipe; the question reads for the stored link (is a link part of the core?).
  - FR2: links are derived from pipes, so a world without pipes has no links, paths or flows.
  - FR3: cables run through pipes, so a world without pipes has no cables; pipes and cables may come from one unit or from different ones.
  - Stages axis: under FIXED, a pipe in the core is the base of the fixed stack; under AS CAPABILITIES the pipe could register like any stage (seeds S21: "pipes-as-plugin leaves the smallest core").
- **What would separate the alternatives:** Seeds S21: "is there a world the engine should run that has no adjacency between anchors, or adjacency with rules a pipe cannot express?" Does any built or planned behaviour run without connections (towers act by range)? Under each alternative, what happens to the ruled core's "the fact that links can reach it" (DECISIONS.md:298)?
- **Intent bearing:** The director's S21 statement quoted above; DS13 ("a 'wire' represents an adjacency between anchors as a lowest network primitive. I like wire because it relates to physics of our model"); Q1 d (AX4); Q1 c (AX5); Q2 c (the pilot's physics inside the reach).
- **Depends on / blocks:** Depends on: PS101 (S2), PS103 (S12), PS107 (S1, S16). Blocks: none named. Related (overlapping, not merged): PS129 (S21).
- **Evidence (defects/contradictions):** none.

## 5.2 Part 2 -- Track B by layer: pipe, link, path, flow, direction and plane (PS201-PS228)

This part carries the Track B forks of the reality map (F6-F9, F11-F15, F25, F26, F36), the discussion seeds that bear on them (S6, S6a, S6b, S7, S8, S9, S10, S13) and critic gap 2 of map section 10.1, each re-read under frames FR0-FR3 and the stages axis.
Entries sit under the layer where the question first applies. The drafter ordered ids by dependency within each layer group; at assembly every edge was converted to register ids, with the source id kept in parentheses.
In Covers lines, "G2" means critic gap 2 of map section 10.1, not gap-fill reader G2 (the map's marks such as [M-run G2] keep their original meaning). Inside quoted seed text, "wire" means pipe, per the seeds' naming note. "Connection" in a question means whatever unit a frame places between or through anchors (a link in FR0 and FR1; a pipe, or a link running through pipes, in FR2 and FR3).
Nothing in this part is decided or ranked, and no alternative is placed above another. A line re-read at a986fb3 for this part to quote it exactly is marked [M-read, PS re-read]. Director statements are cited by DS id; the key is in section 2.5.
Assembly note: PS210 (F7, the encoding half) is merged into PS117 (Part 1).

**Track B layer group: Pipe**

### PS201. Which connections count as touching an anchor, and is "touching" one relation or several?
- **Track / layer:** B ; anchor, pipe, link
- **Covers:** F6
- **The question:** Consumers today disagree on whether a connection that only passes through an anchor (a `via` entry) touches it. Is incidence one relation, one relation that reports each connection's role for each consumer to filter, or a separate relation per layer?
- **Why it is open:**
  - The export passes terminating links only (kernel/engine.mjs:73-76); the canvas passes any role (renderer.js:336); their output diverges on a valid document, ring width 5 vs 3 (D16) [M-run R2].
  - Collapse candidacy counts links of any role (txn.mjs:216) but merges only terminations (invariants.mjs:155-158), so a link that only threads a junction blocks a later collapse there [M-run G3].
  - The CLI counts any role (verbs.mjs:1589); spawners take the first terminating link in index order (spawners.mjs:35 [S]); REST neighbours include both ends of a link that only threads (rest.js:88-90) (D19) [M-read].
  - The termination predicate is restated at 7 or more sites; the threading predicate has no name (map 1.2, termination / thread row) [M-read].
  - Roles, incidence role and any run or path are not readable through REST or the CLI (map 10.1 critic gap 1) [M-read].
- **Alternatives:**
  1. Terminating-only incidence at every consumer -> a passing connection is invisible to roles, collapse candidacy, neighbours and arming.
  2. Any-role incidence at every consumer -> a passing connection counts toward every consumer, so T and crossing shapes change role.
  3. Typed incidence: each connection reports whether it terminates or passes at the anchor, and each consumer filters -> one relation, filtering stated per consumer.
  4. Per-layer incidence: the count of pieces meeting at an anchor (e.g. pipe degree) and the set of connections ending or passing there kept as distinct relations -> exists only where a layer sits below links.
  5. (status quo) Each consumer chooses its own reading, restated at 7+ sites, with the two renderers diverging.
  6. other.
- **Recorded positions:**
  - RULED (B211, BACKLOG.md:254, "Three rulings in one"; date not read): the junction count is terminations only, stated at docs/spec/ATOMICS.md:140 as "Terminations only, and more than two of them". The same file says a threaded link "contributes two" (ATOMICS.md:177), which code does not do (C2).
  - DIRECTOR LEANING DS8 (2026-09-25): pieces meeting at an anchor join, while "a junction is actually links meeting, rather than wires" -- this separates the pipe-level meeting from the link-level count.
- **Under each frame:**
  - FR0: incidence of stored links; the split is termination vs threading (`via`).
  - FR1: as FR0 for links; a path or flow layer adds a further incidence (which paths or flows traverse an anchor) that flow rendering or forwarding would read.
  - FR2: pipe incidence (how many pipes meet) is the primary relation; threading does not exist at the pipe layer, because every pipe ends at its two anchors; "a link passes through" means the anchor is interior to a derived link, known only after cutting (PS209).
  - FR3: pipe incidence and cable incidence are separate relations; a cable may pass an anchor its pipes join at without terminating there (seeds S16), so terminate-vs-pass returns at the cable layer.
  - Stages axis: under stages as capabilities, each stage could expose its own incidence to the stages above it; under fixed stages the engine defines the set once.
- **What would separate the alternatives:** A consumer-by-shape table: for each consumer (role derivation, collapse or cut, arming, neighbours, terminus plane, flow rendering), the intended outcome when a passing connection is added at the anchor. If every consumer ignores passing connections, one terminating relation suffices; if some count them and some do not, the relation must carry the role; if a consumer needs a count that no link-level relation provides, a lower layer's incidence is needed.
- **Intent bearing:** Q1 (AX2: the export and canvas disagree today); Q3 (visibility: roles and incidence are not readable at the agent doors); DS7 ("links are only ever between endpoints or junctions") bears on whether a link may have an anchor inside it where others end; DS8.
- **Depends on / blocks:** Depends on: none. Blocks: PS117, PS211 (F7), PS205, PS212 (F8), PS213, PS218 (F9), PS411-PS413 (F27), PS414, PS415 (F28) (map edges); PS205 (S6), PS209 (S6a) [I].
- **Evidence (defects/contradictions):** D16, D19, D11, C2, C13, C14.

### PS202. Must connection geometry be orthogonal, and if so where is orthogonality produced or checked?
- **Track / layer:** B ; pipe, appearance
- **Covers:** F15
- **The question:** The record assumes orthogonal routing; the code emits polylines through anchor centres and never checks orthogonality in production. Is orthogonality a property of the model, of the drawing, or of neither?
- **Why it is open:**
  - "Manual links are orthogonal, rounded at r=20, on the 30/60 grid" (ATOMICS.md:100, section tagged [PARTIAL]) [M-read, PS re-read]; HIERARCHY's principles and lineage assume orthogonal routing (HIERARCHY.md:88, 95).
  - GRC `ortho` (grc.mjs:88-91) has no production caller; a diagonal straight link is emitted and fails `ortho` [M-run R2].
  - The router is "hand-routed for now" (router.mjs:1-4); auto-routing is "[OUT OF SCOPE - for now]", with "Future intent: routing may be enabled only inside a zone" (ATOMICS.md:92-95) [M-read, PS re-read].
- **Alternatives:**
  1. Advisory orthogonality: stated as a principle, not enforced.
  2. Enforced at the validator or planner: a non-axis-aligned segment is refused.
  3. An auto-router that fills the same via list (or its successor) with corner anchors.
  4. Orthogonality as a render derivation: a diagonal pair of anchors is drawn as an L with an implied corner that is not stored.
  5. (status quo) Polylines through anchor centres, diagonals emitted, `ortho` never run in production.
  6. other.
- **Recorded positions:** Record: ATOMICS.md:100 [PARTIAL]; ATOMICS.md:92-95 [OUT OF SCOPE - for now]; HIERARCHY.md principles. No director position in the seeds or envelope.
- **Under each frame:**
  - FR0 and FR1: the segments of a link between successive route anchors.
  - FR2: a pipe between two anchors not on one row or column is diagonal unless something inserts a corner; an inserted corner is either an anchor (then a pipe boundary, and possibly a cut, PS209) or an identity-less corner (then a pipe has internal geometry).
  - FR3: as FR2 for pipes; in addition, if a cable's via is "routed from its ends" (seeds S16), a router over the pipe graph is the auto-router the record marks out of scope, so this entry couples to that FR3 option.
- **What would separate the alternatives:** Whether any document case intends a diagonal; whether any consumer other than the renderer reads orthogonality (GRC, crossing detection in PS206, overlap in PS206); whether a pipe is by definition one straight segment.
- **Intent bearing:** INTENT-SILENT. No Round-1 pick or director statement speaks to geometric shape. DS13's distinction between "physics of our model" and "the physics of the visual diagram" was made about naming and is noted as context only.
- **Depends on / blocks:** Depends on: none. Blocks: none in the map; PS206 (S6, crossing and overlap), PS116 (S16, routed via) [I].
- **Evidence (defects/contradictions):** C44.

### PS203. Which cells does a multi-cell entity occupy, for placement and for connections?
- **Track / layer:** B ; anchor
- **Covers:** F14
- **The question:** Five implementations disagree on whether a spanned node occupies only its anchor point or every covered cell. Which cells are occupied, and is the answer the same for placing an entity and for a connection ending at or passing over a cell?
- **Why it is open:**
  - The server checks anchor points only; the client index checks every covered cell; the Model scan checks anchors only; server/anchor.mjs takenSet and rest.js occupantAt are further implementations (map 1.2 occupancy row) [M-run R1 P8].
  - The server accepts a waypoint inside a spanned node's footprint while the client index calls that cell occupied (D20) [M-run R1].
  - Attachment on a multi-cell node is always the origin cell centre (kernel/engine.mjs:44, 52; model.mjs:176-178) [M-read].
- **Alternatives:**
  1. Anchor-only occupancy.
  2. Footprint occupancy: every covered cell.
  3. Anchor for waypoints, footprint for spanned nodes.
  4. Footprint for placement, anchor-only for where connections attach or pass.
  5. (status quo) Five implementations: anchor-only at the server and Model scan, footprint at the client index.
  6. other.
- **Recorded positions:** Record: "one anchor holds one node" in the grid-position sense of anchor (LAYOUT.md:25-39, 62-64; built in B110-B113). No director position.
- **Under each frame:**
  - FR0 and FR1: governs placement and where waypoints may be minted.
  - FR2: governs whether a pipe may end at an anchor inside a footprint, and whether a pipe may pass over a footprint cell.
  - FR3: as FR2; a cable routed through pipes from its ends (seeds S16) would read occupancy as a routing obstacle input.
- **What would separate the alternatives:** Whether an anchor inside a spanned node's footprint can be referenced with a meaning (a port-like attachment) or is always an error; whether any routing derivation treats footprints as obstacles.
- **Intent bearing:** INTENT-SILENT on which alternative. Q1 (AX2) bears only on the status quo's per-door divergence (D20), not on the choice among the others.
- **Depends on / blocks:** Depends on: PS301, PS302 (F1). Blocks: none in the map; PS202 (F15), PS116 (S16, routed via) [I].
- **Evidence (defects/contradictions):** D20.

### PS204. What may a connection reference as its ends and as the points it passes through?
- **Track / layer:** B / seam ; anchor, pipe, link
- **Covers:** F11
- **The question:** Five sites admit five different sets of route references, the CLI cannot name an existing waypoint as a via, and a ruled step widens `via` to "any node holding the capability" while another ruling says a router never bends. What may be an end, what may be an interior point, and is an identity-less cell admissible?
- **Why it is open:**
  - Validator: ends node or waypoint, via waypoint only; `via = [node]` refused (validate.js:241-243) [M-run R2].
  - Model.pathOf: ends node, waypoint or bare {x,y}; via waypoint, otherwise the whole path is null (model.mjs:171-183) [M-run R2].
  - Kernel resolveRoute: any byId entity (node, waypoint, zone, group) or a cell (kernel/engine.mjs:124-131) [M-run R2].
  - CLI `link --via` takes cells, mints a waypoint per cell and refuses an occupied cell, so it cannot thread an existing waypoint (verbs.mjs:1880, 1908-1916) [M-read].
  - GRC attachment: port, node, junction, waypoint (grc.mjs:69); HIERARCHY canon: node, waypoint, port, junction, cell (HIERARCHY.md:51-55) [M-read].
  - Prism routes bend at node centres (L3Resolver.js:210-229); a multi-cell node attaches at its origin cell centre [M-read].
- **Alternatives:**
  1. One anchor predicate shared by validator, model and kernel.
  2. Interior points restricted to compositions that permit a bend (ties the via domain to the permission table).
  3. The kernel keeps a broader schema than the document.
  4. CLI interior points as references to existing anchors, rather than cells minted on write.
  5. Identity-less cells (free anchors) admitted, or not admitted, as references in documents.
  6. Attachment on a multi-cell node at any covered cell, or at a face port, rather than the origin cell.
  7. (status quo) Five admitted sets; the kernel broader than the document; CLI via minted from cells; origin-cell attachment.
  8. other.
- **Recorded positions:**
  - RULED (2026-09-19, "The universal node, staged", DECISIONS.md:203-204): step 3 is irreversible and "changes what `via` means -- from "any waypoint" to "any node holding the capability"".
  - RULED (2026-09-22, DECISIONS.md:239): "A router permits endpoint and junction but never bend: it is a thing the author placed, not a geometric artifact to be absorbed into a `via`." [M-read, PS re-read]
  - RULED [LOCKED 2026-08-19] (HIERARCHY.md:39-54): an anchor is a referenceable point, including an identity-less cell.
  - DIRECTOR LEANING DS9 (router restriction as a pack acting on the anchor); DIRECTOR, 2026-09-25 (seeds S4, DS15, no label in the source), worded as a possibility: "This could potentially allow via to be entirely derived."
  - Side by side: the 09-19 ruling widens via to capability-holding nodes; the 09-22 ruling says a router never bends; DS9 places the restriction on the router pack rather than in the validator.
- **Under each frame:**
  - FR0 and FR1: `via` is a stored list of waypoint ids; the question is as stated.
  - FR2: a pipe's spec is its two anchors, so the question becomes what may be a pipe end; `via` is derived (the interior anchors of a derived link), so "via domain" becomes "which anchors may be interior to a derived link", which is the cut rule (PS209).
  - FR3: pipe ends as in FR2, plus the cable's route through pipes, declared (a stored pipe sequence) or routed from its ends; "via domain" becomes what a cable route may name and pass.
  - Stages axis: under capabilities, "may this anchor be interior" can be a per-pack restriction at the anchor (DS9, DS10); under fixed stages it is an engine rule consulting a per-type table.
- **What would separate the alternatives:** A list of document cases that need a zone, a group, a port or a bare cell as an end or an interior point; and whether "any node holding the capability" still has a referent in a frame where via is derived.
- **Intent bearing:** Q1 (AX2: five sites disagree; AX5); DS7; DS9; DS15.
- **Depends on / blocks:** Depends on: PS301, PS302 (F1), PS401, PS402 (F2), PS406-PS408 (F4), PS303-PS305 (F5); PS116 (S4), PS308 (S6c). Blocks: PS306, PS307 (F16); PS209 (S6a) [I].
- **Evidence (defects/contradictions):** C11, C12, C41.

### PS205. When two connections share an anchor, are they connected there, or can one pass the anchor without meeting the other?
- **Track / layer:** B ; anchor, pipe, link
- **Covers:** S6, F8 (the half on two links threading one waypoint)
- **The question:** If two connections both use one anchor, does sharing it always connect them, or can a connection pass an anchor without connecting to what else is there (a crossover drawn on a grid point; a cable passing a patch point)?
- **Why it is open:**
  - The browser's `w` may thread an existing waypoint (input.js:919-939); splitsFor considers only the new link's ends and returns [] [M-run R3]. The result is a waypoint in the via of two links, which referential refuses only for the same pair (referential.mjs:127-147) [M-read].
  - The record says the case "cannot arise ... because landing on a bend SPLITS it" (ATOMICS.md:141 [S]; invariants.mjs:59-68 [S]); REST, CLI, commit and chainHop accept it (C3) [M-run R1, R3].
  - Threading another link's bend gives roles [] (a crossing); threading a terminus keeps ['endpoint'] (a T) [M-run G3].
  - A waypoint "belongs to at most one link" was claimed and then relaxed (C13; B207); "crossing" has no code carrier (map 7.2) [M-read].
  - The [LOCKED] convention distinguishes "Connected -> the junction pad" from "Crossing (not connected)" drawn with a tunnel gap (ATOMICS.md:61-65); nothing renders the gap (map 3.6) [M-read].
  - Seeds S6: "Does a full-fidelity network need a run that passes an anchor WITHOUT connecting to what else is there?"
- **Alternatives:**
  1. Sharing an anchor always means meeting: any two connections at one anchor connect there, and crossing without connecting happens only between anchors (PS206).
  2. An anchor is exclusive to one connection unless it is a junction: a second connection passing it is refused or split.
  3. A declared "through" relation: a connection can be marked as passing without connecting.
  4. Layer-split: pieces meeting at an anchor join at the lower layer, while a link can pass the anchor without meeting the links that end there (seeds S16's reading of FR3).
  5. For a crossing at one waypoint: name it, refuse it, or split it into a junction (map F8 options).
  6. (status quo) Mixed: two links threading one waypoint derive [] and do not connect; a link threading another's terminus derives ['endpoint']; the record says neither can arise.
  7. other.
- **Recorded positions:**
  - DIRECTOR LEANING DS8 (2026-09-25, "for now", not a ruling).
  - RULED [LOCKED] (ATOMICS.md:61-65, date not stated in the lines read): connected -> junction pad; crossing (not connected) -> tunnel gap. A drawing convention; unbuilt.
  - Record: "cannot arise" (ATOMICS.md:141), contradicted by code (C3).
  - Seeds S16 reading (Claude's, not a director position): under FR3 "a cable passes through a conduit T without meeting the cables that end there".
- **Under each frame:**
  - FR0: two stored links' via lists can both hold one waypoint; meeting is decided by terminations only.
  - FR1: as FR0; the path layer above would read whether a path may turn from one link onto the other there, so meeting decides path connectivity.
  - FR2: pipes end at anchors, so two pipe chains sharing an anchor both end pipes there; if pipes meeting always join (DS8), a crossing at an anchor cannot be expressed at the pipe layer, and the cut decides whether the chains form one derived link or several.
  - FR3: pipes join at the anchor; a cable passing without terminating does not meet the cables that end there (seeds S16).
  - Stages axis: whether an anchor connects what passes it can be an anchor behaviour a pack restricts or extends (DS9, DS10).
- **What would separate the alternatives:** A network case the model must express in which two connections share a grid point without connecting. If no such case must be expressible at a point, alternative 1 covers the requirement; if one must, alternative 1 is excluded. Also: whether such a crossing must be selectable or attachable (Q3).
- **Intent bearing:** DS6; DS7 ("links are only ever between endpoints or junctions"); DS8; DS13; Q3 (a crossing is a noun only if something attaches to it and it is visible).
- **Depends on / blocks:** Depends on: PS201 (F6, via F8); PS116 (S4), PS118 (S5) (the seeds that raised S6). Blocks: PS314 (F18), PS411-PS413 (F27), PS414, PS415 (F28) (map, via F8); PS209 (S6a); PS212 (F8, the T half) [I].
- **Evidence (defects/contradictions):** C3, C13, C14, D1 (reach through browser threading is [I]).

### PS206. Can two connections cross between anchors, and what is an overlap of two connections along one grid line?
- **Track / layer:** B ; pipe, appearance
- **Covers:** S6 (crossing between anchors; the collinear-overlap edge case)
- **The question:** If crossing without connection happens between anchors, is that crossing represented, drawn distinctly, or neither? When two connections run along the same grid line, is the overlap a crossing, a meeting, a parallel, or refused?
- **Why it is open:**
  - Seeds S6 reading: "Crossover without connection then happens only BETWEEN anchors (wires crossing mid-segment); collinear overlap of two wires on one grid line is an edge case to settle."
  - The [LOCKED] crossing convention ("vertical wins", in the record's words; the horizontal breaks with a tunnel gap, ATOMICS.md:61-65) has no renderer; a grep for "tunnel" finds nothing in kernel/ or app/src (map 3.6) [M-read].
  - Drawn geometry is a polyline through anchor centres, not orthogonal by construction (router.mjs:58-103) [M-run R2], so crossings today can be at any angle.
  - Whether any site detects a geometric overlap between links of different pairs: NOT-CLAIMED (no reader measured it). straightCapacity and duplicateThroughBend key on the unordered pair only (map 3.2) [M-run R1 P5, P13].
- **Alternatives:**
  1. Crossings between anchors are purely geometric: not represented and not drawn distinctly.
  2. Crossings derived and drawn per the [LOCKED] tunnel-gap convention, never stored.
  3. Crossings between anchors refused, so every crossing is at an anchor, where PS205 decides.
  4. A collinear overlap refused.
  5. A collinear overlap drawn as lanes (the parallel case, PS215).
  6. A collinear overlap treated as one shared piece, or as a meeting at the overlap's end anchors.
  7. (status quo) Nothing detects or draws crossings or overlaps; the [LOCKED] convention is unbuilt.
  8. other.
- **Recorded positions:** RULED [LOCKED] crossing convention (ATOMICS.md:61-65, date not stated in the lines read). The S6 reading is Claude's inference, not a director position.
- **Under each frame:**
  - FR0 and FR1: segments of links cross or overlap.
  - FR2: pipes cross mid-segment or overlap.
  - FR3: several cables in one pipe share its geometry, so an overlap inside one pipe is the parallel-links case (PS215); an overlap between two different pipes along one line is this question.
- **What would separate the alternatives:** Whether any consumer other than the renderer needs to know of a crossing between anchors (a path may not turn there, a flow render must break). If only the renderer, it is appearance; otherwise it is topology. Whether a collinear overlap can arise at all once PS202 fixes the geometry.
- **Intent bearing:** DS7 ("visualise all 4", which includes parallel links, the overlap's nearest case); DS6; Q3 (visibility).
- **Depends on / blocks:** Depends on: PS205 (S6 at an anchor); PS202 (F15) [I]. Blocks: PS215 (F13), PS222 (S10, rendering) [I].
- **Evidence (defects/contradictions):** C44 (through F15).

---

**Track B layer group: Link**

### PS207. Are the anchor roles (endpoint, bend, junction) facts of one layer, or of different layers?
- **Track / layer:** B / seam ; anchor, pipe, link, path
- **Covers:** S6 (the reading that splits roles across layers, and "a junction is links meeting")
- **The question:** Today one derivation over stored links yields all three roles at a waypoint. Do the three roles belong to one layer, or does each belong to where it is decided (continuation below links, termination and meeting at links, a forwarding decision at paths)?
- **Why it is open:**
  - waypointRoles (geometry.mjs:456-532) derives all three from terminations, plane and declared flow; a bend is the empty role set (geometry.mjs:505-509; B199) [M-run].
  - Roles are derived for the waypoint kind only (kernel/engine.mjs:67; renderer.js:309), and the collapse admits only waypoints (txn.mjs:212) [S]; a node with three terminations gets no junction (F16).
  - B211 made junction supersede endpoint for drawing, and the same role set feeds arming predicates (geometry.mjs:314-316 vs :468-479; F28) [M-run].
  - ATOMICS.md:169-171 gives the junction a second, path-level meaning: "A junction is a place a mover could plausibly choose a path, which makes it a routing decision point rather than only a visual claim." [M-read, PS re-read]
  - Seeds S6 reading: pipe layer -- pieces meeting at an anchor join, two that continue make a bend; link layer -- endpoint (one link end) and junction (links meeting).
  - Seeds S15 Consequence C: once links can be parallel, "a junction is links meeting" must say WHAT is counted (distinct logical links, neighbours, members).
- **Alternatives:**
  1. One derivation over the stored connections yields all three roles.
  2. Roles split by layer: bend = continuation at the pipe layer; endpoint and junction = link-layer facts (seeds S6 reading).
  3. Roles split three ways: bend (pipe), endpoint and junction (link), forwarding point (path), with a link-level junction and a path-level decision point kept as distinct facts.
  4. Roles as anchor behaviours that packs restrict or extend (DS9, DS10), evaluated at whichever stage consults them.
  5. (status quo) One derivation over stored links, for the waypoint kind only.
  6. other.
- **Recorded positions:**
  - RULED (2026-09-22, DECISIONS.md:231-233): endpoint, bend and junction "are what the GRAPH makes of an anchor at a given moment -- derived, never stored". [M-read, PS re-read]
  - DIRECTOR LEANING DS8; DIRECTOR LEANING DS9; DS10 (a LEANING, "packs can extend anchor behaviour too", plus a QUESTION and an ANALOGY); DS7 ("links are only ever between endpoints or junctions (or one to the other)").
- **Under each frame:**
  - FR0: one derivation, waypoints only.
  - FR1: link-level roles as today, plus a path-level reading (where a path may turn or fork).
  - FR2: a bend is where a pipe chain continues inside one derived link; endpoints and junctions are where derived links end, so the roles are the output of the cut (PS209).
  - FR3: pipe joins are pipe-level; endpoint and junction are cable facts (a cable ends there; cables meet there); a cable passing through has no role at that anchor.
  - Stages axis: under capabilities, each stage can publish its own anchor facts; under fixed stages the engine defines three roles.
- **What would separate the alternatives:** For each consumer of roles (arming, collapse or cut, drawing layers, readout, permission, forwarding), which fact it needs: "continues or not" is readable below links; "how many links meet" is readable at links; "where may traffic choose" is readable at paths. And, per seeds S15 C: what a junction counts when two parallel links, or one two-member aggregate, end at an anchor.
- **Intent bearing:** DS7; DS8; DS6; DS10; Q3 (roles must be visible, and today are not readable at the agent doors, map 10.1 gap 1); Q1 (AX5, AX2).
- **Depends on / blocks:** Depends on: PS201 (F6); PS205 (S6 at an anchor), PS111 (S15 consequence C; mutual), PS308 (S6c; mutual). Blocks: PS117, PS211 (F7), PS306, PS307 (F16), PS414, PS415 (F28) [I]; PS209 (S6a). Related (overlapping, not merged): PS306.
- **Evidence (defects/contradictions):** C1, C2, C4, C14, C42, D8.

### PS208. What does an undeclared link assert about direction: flow both ways, nothing, or something else?
- **Track / layer:** B ; link, flow, vocabulary
- **Covers:** G2 (the FLOW half: the two live undeclared readings)
- **The question:** Two readings are live at once. The browser shows an undeclared link as carrying flow both ways; the rules read undeclared as asserting no direction. Which does an undeclared connection mean, or does it mean different things at different layers?
- **Why it is open:**
  - Browser: "`<->` for undeclared, because a symmetric link carries flow both ways rather than having no relationship" (app/src/readout.js:141-147); "a symmetric link is not a link with no relationship; it is one that carries flow both ways as far as anything here is concerned" (app/src/input.js:818-820) [M-read, PS re-read].
  - Rules: facing/linkFacing return null for undeclared (invariants.mjs:127-129, 137; geometry.mjs:394-401); "An undeclared link is symmetric." (ATOMICS.md:262); B232's closure: "an undeclared link asserts nothing and cannot make a path through by itself" (BACKLOG.md:275) [M-read, PS re-read]; the collapse lets a declared half's direction be inherited across an undeclared one (invariants.mjs:169-170, 187) (map 10.1 gap 2).
  - The two readings decide H15.5 inheritance and F7 differently (map 10.1 gap 2).
  - "Two undeclared links are always a bend" (ATOMICS.md:281) vs waypointRoles ['endpoint'] (C1).
  - tests/rules.test.js:101 uses "flow" for mover traffic (map 10.1 gap 2).
- **Alternatives:**
  1. Bidirectional: an undeclared connection carries flow both ways -> two undeclared links at an anchor pass through each other in both directions, and inheritance can cross them.
  2. Unasserted: an undeclared connection makes no claim -> it cannot make a path through by itself (B232), and roles fall back to counting.
  3. Layer-split: at the link layer, undeclared means "no one-way constraint" (both ways admitted); at the flow layer, direction exists only on declared flows, so "unasserted" is a flow-layer absence.
  4. (status quo) Both readings live: the browser readout says both ways, the role rules say unasserted, the collapse inherits across.
  5. other.
- **Recorded positions:**
  - RULED per map F25 (ATOMICS.md:260, section tagged [DESIGNED 2026-09-22], shipped as H15.3/H15.4): "No rule may branch on `src`/`dst` ordering unless the link carries a declared direction." ATOMICS.md:262: "An undeclared link is symmetric." Whether "symmetric" means bidirectional or unasserted is not stated [I].
  - Record: B232 closure (BACKLOG.md:275), unasserted; ATOMICS.md:281, "Two undeclared links are always a bend". The two record lines are in tension with each other and with the code (C1).
  - No director position.
- **Under each frame:**
  - FR0: as stated, about `link.flow` absent.
  - FR1: flows are declared above links, so the link-level reading becomes "does an undeclared link admit flows either way".
  - FR2: if direction or its absence can cut a derived link (S6a), the reading is needed below links, on pipes.
  - FR3: cables may carry no direction and flows are directed; the reading becomes whether a cable without a one-way constraint admits flows both ways.
- **What would separate the alternatives:** A worked case: a -> w declared, w - b undeclared. Does a flow from a reach b through w, and does an H15.5 run from a continue through w? The readings answer oppositely. The same for two undeclared links at w (C1).
- **Intent bearing:** DS5 ("maybe only some of these items have direction etc."); DS6; the H15 exit criterion "no rule anywhere reads a direction nobody asserted" (BOARD.md:847, a milestone exit, not a director quote).
- **Depends on / blocks:** Depends on: none [I]. Blocks: PS117, PS211 (F7; map 10.1 gap 2); PS223 (S8), PS213 (F9, run inheritance) [I].
- **Evidence (defects/contradictions):** C1, D37.

### PS209. Where a link is a longer unit than what is stored beneath it, what decides where it ends, and where must those inputs be readable?
- **Track / layer:** B / seam ; anchor, pipe, link
- **Covers:** S6a
- **The question:** In any frame where links are derived from lower pieces, something decides where one link ends and the next begins. Which inputs may that decision read (count of pieces at the anchor, plane, opposing direction, the anchor's composition), and must each be readable below the link layer?
- **Why it is open:**
  - Seeds S6a (inferred): "Whatever decides a cut must be readable BELOW the link layer, or the derivation is circular: wire degree; plane (data/control) difference; opposing direction; the anchor's composition."
  - Today the role derivation reads `closed`, src/dst, `control` and `flow` (geometry.mjs:456-532), and the collapse reads termination, `closed`, direction and plane (invariants.mjs:152-192): all link-level fields [M-read].
  - The ruled matrix: differing planes make a junction (ATOMICS.md:294-306; H15.17/B233); opposing declarations make a junction (ATOMICS.md:271-276) [M-read, PS re-read].
  - Seeds S15 open question: does "just its two anchors" mean no configuring spec on a pipe ("then plane lives higher and can no longer cut links, touching the ruled plane-difference rule"), or only that the generative spec is two anchors?
  - Seeds S6c alternatives (Claude's, inferred): permission as a derivation input (cuts), permission as validator refusal (as ruled), or both.
- **Alternatives:**
  1. Degree only: an anchor where exactly two pieces meet continues; any other count cuts.
  2. Degree + plane: pieces on differing planes cut (plane must then live below links).
  3. Degree + plane + opposing direction (direction must then live below links, and FRAGMENT acts there).
  4. Degree + anchor composition: a composition can force a cut (the router's "never bend" read as always-cut, seeds S6c).
  5. Cuts declared: the author marks where a link ends (the FR3 cable ends).
  6. (status quo) No cut derivation exists: link ends are stored; the role matrix and the collapse read link fields; the collapse rewrites storage on removal only.
  7. other.
- **Recorded positions:**
  - RULED (record, ATOMICS.md:294-306, section tagged [DESIGNED 2026-09-22], shipped H15.15/H15.17): a plane difference makes a junction.
  - RULED (director, 2026-09-22, BOARD.md:834; ATOMICS.md:320): FRAGMENT, opposing declarations break a run into a junction.
  - RULED (2026-09-22, DECISIONS.md:251): "A violation is REFUSED, in the validator".
  - DIRECTOR LEANING DS9: a router never bends as "a capability/behaviour restriction applied by the 'router node' pack to the anchor system".
  - DIRECTOR LEANING DS12: "a wire's spec is just its two anchors."
  - Side by side: the ruling places permission as a validator refusal; DS9 places it as a pack restriction on the anchor; DS12 may leave no pipe-level field for plane to cut on, while the ruled plane rule cuts. None of these is resolved here.
- **Under each frame:**
  - FR0: no cut exists; the analogous question is which inputs the role matrix reads.
  - FR1: as FR0 for links; the path layer's own "where may a path turn" reads link-level facts, so no circularity arises.
  - FR2: the cut defines links, so every input must be a property of pipes or anchors (seeds S6a); plane and any cut-affecting direction move below links.
  - FR3: link ends are declared (cables), so a cut is authored; the question moves to what a cable route may pass (e.g. may a cable pass a router anchor without terminating?).
  - Stages axis: one pack contributing a restriction to a lower stage (cut) and an extension to a higher one (forwarding) is the seeds S12 observation; stages as capabilities demand a stratified evaluation order (seeds S12).
- **What would separate the alternatives:** List every rule that today reads a link field to decide a role (`control`, `flow`, `closed`) and ask, for each, whether its intended meaning survives moving that field below links. Any input that must stay link-level makes an FR2 derivation circular for that input.
- **Intent bearing:** Q1 d (AX4); AX1 (a Round-1 primary axis); DS11 ("derivations flow up"; "mechanical/deterministic"); DS9; DS12.
- **Depends on / blocks:** Depends on: PS207 (S6), PS108 (S15; mutual), PS308 (S6c; mutual); PS223 (S8) [I; forward reference: Part 2 places the Direction and plane group after the Link group]. Blocks: PS224 (S6b); PS117, PS211 (F7), PS214 (F12), PS217 (S7) [I]; PS108 (mutual).
- **Evidence (defects/contradictions):** C4, C25, D1, D41.

**PS210 -- merged into PS117 (Part 1).** The Track B drafter's entry "Is a pass-through a reading over separate stored pieces, a stored rewrite into one piece, or left to history as today?" (Covers: F7, the encoding half) asked the same question as PS117. Its evidence, alternatives, recorded positions, frame readings, separating tests and intent bearing are carried in PS117. F7's role half is PS211.

### PS211. What is an anchor where exactly two links end and fewer than two of them declare direction?
- **Track / layer:** B ; anchor, link
- **Covers:** F7 (the role half)
- **The question:** For two terminations that are undeclared/undeclared or declared/undeclared, the record says bend, the role derivation says endpoint, and the collapse merges them. Which is the anchor, and is that the same question as whether the pair may be merged?
- **Why it is open:**
  - "Two undeclared links are always a bend" (ATOMICS.md:281 [S]; HANDOVER.md:107; tests/validate.test.js:730 comment) vs waypointRoles ['endpoint'] (geometry.mjs:520-523; tests/validate.test.js:710 asserts it) (C1) [M-run].
  - The collapse merges undeclared and one-declared pairs (invariants.mjs:176-191) [M-run R2, R6].
  - B232's closure: one declared of two "still falls through to `endpoint`, because an undeclared link asserts nothing and cannot make a path through by itself" (BACKLOG.md:275) [M-read, PS re-read].
  - No matrix test drives these pairs (D37) [M-read]; H15.5 inheritance would change the declared + undeclared reading (map F7).
- **Alternatives:**
  1. Bend, as ATOMICS.md:281 states.
  2. Endpoint (a two-link terminus), as waypointRoles derives.
  3. Undeclared counts as agreeing everywhere (bend in roles and collapse alike).
  4. Undeclared counts as a terminus everywhere (endpoint in roles; no merge).
  5. Role derivation and collapse eligibility decided as separate questions: a pair can read as a bend without being merged, or be merged without reading as a bend.
  6. (status quo) Roles say endpoint, the collapse merges, the record says bend.
  7. other.
- **Recorded positions:** Record, side by side: ATOMICS.md:281 (section tagged [DESIGNED 2026-09-22]) "Two undeclared links are always a bend"; B232 closure (BACKLOG.md:275) "an undeclared link asserts nothing". No director position.
- **Under each frame:**
  - FR0: as stated.
  - FR1: link-level role as FR0; independently, a path may or may not pass through the anchor according to PS208's reading.
  - FR2: the anchor has two pipes; whether it cuts depends on PS209's inputs; under degree-only cutting it continues (a bend inside one derived link) whatever the declarations.
  - FR3: two cables ending there vs one cable passing is authored; the role follows from what was drawn, not from declarations.
- **What would separate the alternatives:** The PS208 worked cases; and the H15 exit criterion "a bend survives whichever way it was drawn" (BOARD.md:847) applied to a -> w, w -> b drawn once directly and once by deleting a third link: must both histories yield the same role?
- **Intent bearing:** DS7 ("links are only ever between endpoints or junctions (or one to the other)"); Q1 (AX2: record and code disagree); DS5.
- **Depends on / blocks:** Depends on: PS201 (F6); PS208 (G2), PS209 (S6a) [I]. Blocks: PS205, PS212 (F8), PS213, PS218 (F9), PS306, PS307 (F16), PS314 (F18), PS315 (F19), PS323 (F24), PS411-PS413 (F27), PS414, PS415 (F28) (map, via F7); PS117 (F7, the encoding half).
- **Evidence (defects/contradictions):** C1, C4, D8, D37.

### PS212. When a new connection is drawn to end where another passes through, does the passing one end there too?
- **Track / layer:** B / seam ; anchor, link, writes
- **Covers:** F8 (the half on a link ending at another link's bend)
- **The question:** A link ending at another link's interior anchor (a T, or tap) is split at one browser path and left unsplit at every other door. Does a new end at a passing point make the passing connection end there, leave a T, get refused, or depend on the author's choice?
- **Why it is open:**
  - The record says it "cannot arise" (ATOMICS.md:141 [S]; invariants.mjs:59-68 [S]).
  - Only commitRoute splits [V]; chainHop and chainThroughNode (input.js:1420-1442), CLI `link`, REST /links and /commit, and add/place --link never split; plan() accepts the T and the waypoint derives ['endpoint'] [M-run R1 P13b, R3].
  - The T arms in the browser and the CLI refuses it (D8) [M-run R4 b, b2].
  - The split drops flow, control and name and mints one name for all pieces (D4) [V; M-run R3]; it can collapse an unrelated terminus (D2) [M-run R3].
- **Alternatives:**
  1. The passing connection is split into two that end there, at every door.
  2. The new end is refused at a passing point.
  3. The T is admitted as a named shape (tap / T-bend) and the passing connection keeps passing.
  4. The author chooses at drawing time whether the passing connection ends there.
  5. (status quo) The browser's commitRoute splits; chainHop and every other door leave a T.
  6. other.
- **Recorded positions:**
  - DS7, labelled "Director requirement" in the envelope and "DIRECTOR LEANINGS" in seeds S15 (2026-09-25): "drawing a new link to a bend converts it to a junction (current behaviour)."
  - Seeds S15 measured nuance: "current behaviour" holds at the browser door only (C3).
  - Seeds S16: under the cable model it "becomes a behavioural question ... does the passing cable terminate there? (Round-2 candidate.)"
  - Record: ATOMICS.md:141 "cannot arise", contradicted (C3).
- **Under each frame:**
  - FR0 and FR1: as stated; the split is a write.
  - FR2: no split exists; a new pipe raises the anchor's degree and the derived cut changes by construction at every door (seeds S15).
  - FR3: whether the passing cable terminates is an authored choice; alternative 1 and alternative 3 both remain expressible.
- **What would separate the alternatives:** Whether the author ever intends a tap that does not end the passing connection (a cable passing a patch point where another cable ends). If never, alternative 1 or 2 covers the need; if sometimes, alternative 3 or 4 is needed.
- **Intent bearing:** DS7; DS6; DS13; Q1 (AX2: split at one browser path only).
- **Depends on / blocks:** Depends on: PS201 (F6), PS117, PS211 (F7). Blocks: PS314 (F18), PS411-PS413 (F27), PS414, PS415 (F28).
- **Evidence (defects/contradictions):** C2, C3, D2, D4, D8.

### PS213. Is there a unit longer than one stored link, through bends, along which a declaration carries?
- **Track / layer:** B ; link
- **Covers:** F9 (the run half)
- **The question:** A run of bends is ruled derived, never stored, and fragmentable, and no code walks across links. Is the run a derived chain over links, one link's via only, an index, a named unit, or the link itself in a frame where links are derived?
- **Why it is open:**
  - Ruled derived, never stored, fragmentable (ATOMICS.md:312-322; BOARD.md:834-841); H15.5 is TODO (BOARD.md:832) [M-read].
  - No code walks links: pathOf, spawnersOf, reflectPathSelection and refreshWaypointsOf each take one link; contextOf is one hop; the CLI `links` verb shows the immediate far end (map 3.4). Searches named there: chain, walk, trace, propagat, traverse, contiguous, reachab, runOf, inherit (R1, R2, R4, R7).
  - Within one link, via is the run and one `flow` covers every segment; propagation matters only across link boundaries, which the collapse removes on removal only (map F9).
  - "run" has at least four other code senses (map 1.2).
- **Alternatives:**
  1. Maximal chains through derived bends, derived on read.
  2. Run = inside one link's via, forbidding multi-link pass-throughs.
  3. A derived run index maintained like incidence.
  4. A named unit over links.
  5. The run is the link: links derived as maximal pipe chains (FR2).
  6. (status quo) A run exists only within one link's via; nothing spans links; H15.5 unbuilt.
  7. other.
- **Recorded positions:** RULED (ATOMICS.md:317, section tagged [DESIGNED 2026-09-22]): "Inheritance is **derived, never stored**." RULED (director, 2026-09-22, BOARD.md:834): FRAGMENT. Seeds S3's claim that "FRAGMENT and H15.5 propagation fall out" under stored pieces is Claude's, and seeds S16 qualifies it.
- **Under each frame:**
  - FR0: as stated.
  - FR1: if direction lives on flows over paths, inheritance along runs may have no consumer; if one-way constraints stay on links, the run is needed.
  - FR2: run and derived link are one unit.
  - FR3: a cable already spans many pipes, so a declaration on a cable covers its whole route; the run question returns only across splices of cables.
- **What would separate the alternatives:** Whether any declaration needs to carry beyond one link. If direction moves wholly to flows (PS223), the run's consumer is the flow's path instead; if a link-level constraint remains, a run over links is needed. Also: whether "path" in the H15 exit ("declares flow once on a path", BOARD.md:847) means a run of bends or a route across junctions.
- **Intent bearing:** DS5; DS2 (bears on paths across junctions, and so on whether a run is also needed); AX1 (a Round-1 primary axis).
- **Depends on / blocks:** Depends on: PS201 (F6), PS117, PS211 (F7); PS208 (G2), PS223 (S8) [I; mutual, see PS223; forward reference across Part 2's layer groups]. Blocks: PS122 (F10), PS214 (F12), PS225 (F25), PS226, PS227 (F26), PS411-PS413 (F27), PS220 (F36) (map, via F9). Related (overlapping, not merged): PS218.
- **Evidence (defects/contradictions):** none directly (the absence is measured, map 3.4); C1 through F7.

### PS214. Is `closed` a drawing flag or a fact about topology?
- **Track / layer:** B ; link, appearance
- **Covers:** F12
- **The question:** The validator and CLI call `closed` render-only, while five rules treat a ring as having no ends. Is a closed connection a drawing property, a topological one, or a separate kind of thing, and at which layer does a ring live?
- **Why it is open:**
  - "(render-only)" (validate.js:244; verbs.mjs:1892) vs waypointRoles skipping it (geometry.mjs:461), collapse (invariants.mjs:154) and split (:195) refusing it, spawnersOf skipping it (spawners.mjs:35 [S]), CLI spawn refusing it (verbs.mjs:1592-1596), and routeGeometry adding a closing run (router.mjs:65-75) (C7) [M-read].
  - The sweep and straightCapacity ignore it [M-run R1 P3, P5]; the sweep keeps a deleted ring's src and dst waypoints (D7) [M-run R1].
  - The closure rule lives only at the edges: the browser needs at least 1 via (input.js:786-790); the CLI needs 2 only for its dst-less ring form and otherwise accepts any via count, including a closed straight link (verbs.mjs:1899, 1905, 1924-1925) [S; CLI not run]; the server accepts a closed straight link.
  - The REST path response omits `closed` (rest.js:663) (D18).
- **Alternatives:**
  1. A link attribute.
  2. A run whose ends coincide.
  3. A ring entity.
  4. A server rule on closure (a via minimum; ends).
  5. A pure render flag with no rule.
  6. (status quo) A link attribute described as render-only, read as topology by five rules, with closure rules only at the edges.
  7. other.
- **Recorded positions:** Record: "(render-only)" in code comments (validate.js:244; verbs.mjs:1892); no dated ruling found in the lines read. No director position.
- **Under each frame:**
  - FR0: as stated.
  - FR1: as FR0 for links; a path layer could also hold a loop (a flow returning to its source).
  - FR2: a closed chain of pipes whose anchors all continue has no anchor to cut at, so what a derived link over a pure cycle is (its ends, its identity) is open [I].
  - FR3: a cable whose route returns to its start; closure is a property of the cable's route.
- **What would separate the alternatives:** Whether any network case needs a closed connection as topology (a ring whose members forward around it) rather than as a drawing; and, under FR2, what the cut rule does to a cycle with no cut point.
- **Intent bearing:** INTENT-SILENT. No Round-1 pick or director statement speaks to rings.
- **Depends on / blocks:** Depends on: PS213, PS218 (F9; PS218 is a forward reference: Part 2 places the Path group after the Link group). Blocks: none.
- **Evidence (defects/contradictions):** C7, C45, D7, D18.

### PS215. What makes two connections between the same two anchors distinct?
- **Track / layer:** B ; pipe, link, appearance
- **Covers:** F13 (the half on what distinguishes parallel links)
- **The question:** When more than one connection joins the same two anchors, what makes them distinct things: nothing (refused), their plane, their direction, their route, an index or lane, or a separate identity at a higher layer?
- **Why it is open:**
  - straightCapacity is 1 per unordered pair and ignores plane, direction and `closed` (invariants.mjs:24-42, 260-275) [M-run R1 P5]; duplicateThroughBend refuses two links that bend at one waypoint and share an unordered pair, ignoring plane and flow (referential.mjs:125-147) [M-run R1 P13].
  - Yet the role matrix counts plane and direction differences (ATOMICS.md:308-310) [M-read].
  - Editor rules differ from each other and from the planner: routeLink refuses a straight duplicate only when a straight link exists (input.js:229-249, B80); linkNodes refuses any existing pair (commands.js:302) [M-read].
  - B80 quotes a director ruling that "a single straight direct link is permitted **in addition to** routed paths" (BACKLOG.md:142) [M-read, PS re-read]. From the two planner rules, two routed links between one pair through different bends pass the planner [I; composed from two rules, not probed].
  - [LOCKED] parallel-link ports (ATOMICS.md:106-115) are unbuilt; "bundled-vs-individual link rendering" is "Still open" (ATOMICS.md:102) [M-read, PS re-read]; bundle and bus realizers exist only in the archive (map 7.2).
- **Alternatives:**
  1. Pair only: at most one connection per unordered pair at the relevant layer.
  2. Pair + plane.
  3. Pair + plane + direction.
  4. Pair + route: connections are distinct when their routes differ.
  5. A discriminator (index or lane) on the lower unit (seeds S15 consequence).
  6. Parallelism above the lower unit: one pipe per pair, several links (cables) running in it (DS7 "parallelism lives above/abstracted over wires"; seeds S16).
  7. (status quo) Straight capped at one per pair; routed parallels pass the planner unless they share a bend waypoint [I]; editor rules stricter than the planner.
  8. other.
- **Recorded positions:**
  - DIRECTOR LEANING DS12 ("a wire's spec is just its two anchors"), with DIRECTOR CONTEXT "Today - we only support a single link between 2 anchors, but in future we may allow parallel links between 2 anchors."
  - DS7 ("parallelism lives above/abstracted over wires"; "model, construct and visualise all 4").
  - RULED (director ruling quoted in B80, BACKLOG.md:142; date not read): a straight link is permitted in addition to routed paths.
  - RULED [LOCKED] (ATOMICS.md:106-115): parallel links attach via ports, 2 per node face.
  - Side by side: DS12's context says one link between two anchors today; the planner's rules admit routed parallels between one pair [I from the rules above].
  - Seeds S15, open: does "just its two anchors" mean no configuring spec on a pipe, or only that its generative spec is two anchors?
- **Under each frame:**
  - FR0: distinctness of stored links; the question is as stated.
  - FR1: as FR0; flows add a further multiplicity (many flows on one link, PS222).
  - FR2: pipe identity = unordered anchor pair, so a second pipe between the same anchors needs a discriminator or a differing property, or parallelism lives above pipes (seeds S15); links derived from pipe chains cannot express parallel links between one pair unless pipes are distinguishable.
  - FR3: several cables in one pipe, each with its own identity; no pipe discriminator is needed (seeds S16); LAG and VLAN are logical constructs over cables.
- **What would separate the alternatives:** The seeds S15 discriminator: "series only -> a link is a derived chain, arguably not a separate primitive; any of the other three -> wire and link are distinct with a many-to-many relation." A table of the four relations (series, parallel/LAG, multiplex/VLAN, parallel links) against the unit that carries each multiplicity, per frame.
- **Intent bearing:** DS7; DS12; DS13; DS6; Q1 (AX3).
- **Depends on / blocks:** Depends on: PS401, PS402 (F2), PS406-PS408 (F4); PS110 (S15), PS109 (S16). Blocks: PS306, PS307 (F16); PS217 (S7), PS222 (S10, rendering) [I]. Related (overlapping, not merged): PS110.
- **Evidence (defects/contradictions):** D38.

### PS216. Where does connection capacity live: per pair, per anchor, per face, per type, per instance, or elsewhere?
- **Track / layer:** B / seam ; anchor, pipe, link
- **Covers:** F13 (the capacity half)
- **The question:** Capacity is a pair-only constant written as a function "intended to become per-endpoint-kind". Where does the bound on how many connections may meet come from, and at which layer is it counted?
- **Why it is open:**
  - straightCapacity is pair-only (invariants.mjs:24-42) [M-run R1 P5].
  - B126 (BACKLOG.md:188, OPEN): "the design position is that a kind declares it -- settable by an operator or through the API" [M-read, PS re-read].
  - DECISIONS.md:247 rules permission "PER TYPE, not per instance"; DECISIONS.md:278-279 says both pack families are "DERIVED and stateless".
  - [LOCKED] port counts: 2 per node face; 3 per group-hull cell (ATOMICS.md:106-115); H10.7/B127 OPEN (map F13).
  - DECISIONS.md:240 ("A compute or server glyph permits endpoint alone") acts as a capacity of one terminating link [I].
- **Alternatives:**
  1. A per-kind code constant.
  2. Runtime configuration per kind (operator or API; the B126 position).
  3. A declaration on the type or composition.
  4. Geometric capacity from ports per face (the [LOCKED] counts).
  5. Per instance (this node).
  6. Capacity counted at a higher layer: cables per pipe, flows per link [I].
  7. (status quo) One pair-only constant for every kind.
  8. other.
- **Recorded positions:** RULED (2026-09-22, DECISIONS.md:247): per type, not per instance. RULED (2026-09-22, DECISIONS.md:278-279): packs derived and stateless. B126 "design position" (OPEN): per kind, settable at runtime. Side by side: B126's runtime setting and the ruled stateless per-type packs. RULED [LOCKED] port counts.
- **Under each frame:**
  - FR0 and FR1: link count per pair and per anchor.
  - FR2: pipes per pair (one unless a discriminator exists) and pipes per anchor (degree).
  - FR3: cables per pipe, pipes per anchor, and cables terminating per anchor (which count "endpoint alone" limits).
  - Stages axis: under capabilities, capacity could be a pack contribution at each stage.
- **What would separate the alternatives:** Whether any capacity must differ between two instances of one type (then per-type tables do not suffice); whether an operator must change it without a code change (then a constant does not suffice); and which layer's count "endpoint alone" limits (seeds S15 consequence C).
- **Intent bearing:** Q1 (AX4: a new capacity without an engine change); DS7 (parallel links must be constructible); DS9 (a pack restriction on the anchor).
- **Depends on / blocks:** Depends on: PS401, PS402 (F2), PS406-PS408 (F4); PS215 (F13, distinctness) [I]. Blocks: PS306, PS307 (F16).
- **Evidence (defects/contradictions):** none.

### PS217. Where do a connection's identity, name and configured fields live when the thing they describe is derived or re-forms?
- **Track / layer:** B / seam ; link, path, writes
- **Covers:** S7
- **The question:** If a link (or a path) is derived, or if topology changes cut it or join it, what holds its id, name, plane and direction, and which piece keeps them when it re-forms?
- **Why it is open:**
  - The split drops flow, control and name; every piece receives one minted name and the original is lost (D4) [V; M-run R1 P2, R3].
  - The id rule is stated two ways: "Both halves get NEW ids" (ATOMICS.md:212-213; input.js:981-982) vs "THE SRC HALF KEEPS THE ORIGINAL ID" (input.js:992-996; B213) (C5); "split copies name" (HANDOVER.md:337) is false (C6) [M-run].
  - The collapse keeps the inbound link's id (ATOMICS.md:160); the planner cannot tell a re-put from a loss (map 7.2, re-put / lineage row; D2).
  - cloneSubgraph drops flow and control (D6) [M-run]; the kernel adapter drops `name` (kernel/adapt.mjs:52).
  - Seeds S7: the Q3 noun test requires a derived link to be visible and selectable, so a derived thing needs a stable address; the hard case is "a link named "uplink" cut in two by a new wire at a mid-point: which half keeps the name?"
- **Alternatives:**
  1. Bound by end anchors (a cut that moves an end moves the binding; seeds S15, Claude's inference [I], reads this as pruned unless a discriminator exists).
  2. Bound by a member piece: configuration stored on one pipe is inherited by the derived link containing it (H15.5-like; conflicting configurations in one link need FRAGMENT or precedence).
  3. A stored link entity listing its pieces (links stored again).
  4. Selectors (k8s-style): configuration applies to whatever matches a stored selector (the selector is stored, and what it matches changes with topology).
  5. Declared identity on the connection itself (the FR3 cable), with derived things (paths) addressed by the declaration that produces them (identity changes only through authored terminate and splice operations, which every door must offer; paths and LAG/VLAN constructs above cables still need a binding).
  6. (status quo) A stored link id; on split the src-side piece keeps the id and name, flow and control are lost; on collapse the inbound id survives.
  7. other.
- **Recorded positions:**
  - DS11 (2026-09-25): a link, path or flow config "would need to have some entity persisted into the document (minimal entity/spec) such that the derivation can actually occur."
  - Seeds S14 candidate test (Claude's, not a position): "a field is persisted only if it is intent that cannot be derived (a link's name passes; its role never does)."
  - Record: ATOMICS.md:160 (inbound id survives a collapse); B213 (src half keeps the id).
  - RULED (director, 2026-09-04, B187): name mandatory on all five kinds; this is in tension with DECISIONS.md:265, 299, where `named` is a pack (map F3).
- **Under each frame:**
  - FR0: the status quo.
  - FR1: links keep stored identity; a derived path needs an address, and a flow's declaration can be that address with the path as its derived status (seeds S12, spec vs status).
  - FR2: derived links need stable addresses, and the mid-point cut case applies directly.
  - FR3: cables carry declared identity, so re-formation becomes authored (terminate, splice) and the operation decides identity; the question moves to derived paths and to LAG/VLAN constructs referencing cables.
  - Stages axis: stages as capabilities demand "stable addresses for derived entities" (seeds S12).
- **What would separate the alternatives:** The mid-point cut case: a named, one-way link "uplink" receives a new connection at an interior anchor. Under each binding, which part is "uplink", and does the answer match what the author expects? And whether any configuration must survive re-formation, or may be dropped visibly.
- **Intent bearing:** Q3 (attachment and visibility; inputs may be persisted); DS11; Q1 a (AX2: the split loses fields at one door); AX1 (a Round-1 primary axis); DS7.
- **Depends on / blocks:** Depends on: PS114 (S14), PS110 (S15); PS213, PS218 (F9; PS218 is a forward reference: Part 2 places the Path group after the Link group), PS209 (S6a) [I]. Blocks: PS221 (S13), PS220 (F36) [I].
- **Evidence (defects/contradictions):** C5, C6, D2, D4, D6.

---

**Track B layer group: Path**

### PS218. Does a path across several links exist, and what is it derived from?
- **Track / layer:** B ; path
- **Covers:** F9 (the multi-link path half)
- **The question:** No code derives a route across several links between two anchors. Does such a path exist as a derived thing, over which graph (links, pipes, cables), through which anchors (junctions, nodes), and is it ever stored?
- **Why it is open:**
  - The H15 exit: "an author declares flow once on a path and sees it end to end" (BOARD.md:847); B147's "client -> firewall -> lb -> server"; survey Q3 (map 7.1 PATH).
  - No code walks links (map 3.4); `.on-selected-path` lights one link (renderer.js:180-192); movers travel one link and are consumed at its far end [M-run R4].
  - "path" is [LOCKED 2026-08-19] one link's coordinates with no identity (HIERARCHY.md:37-47).
  - Junction forwarding (clone, round robin, route) is designed and unbuilt (ATOMICS.md:340-349); BOARD.md:849 puts "packet movement over the graph" outside H15.
  - Prism's route {src, dst, hops} is the nearest prior art (RouteFactory.js:20-31); DECISIONS.md:126 lists "routes/pathfinder" and "tag selectors" as explicitly not borrowed [M-read, PS re-read].
- **Alternatives:**
  1. A route across the link graph between a declared src and dst, derived by every viewer.
  2. A derived route pinned by stored hops (partly declared, prism-like).
  3. A path stored as an entity (a persisted list of links or anchors).
  4. Path = run: through bends only, with junctions as barriers.
  5. (status quo) No multi-link path; the unit is one link.
  6. other.
- **Recorded positions:**
  - RULED [LOCKED 2026-08-19] (HIERARCHY.md:37-47): path = an ordered list of coordinates, no identity (the narrow sense).
  - RULED (DECISIONS.md:126, section "Borrowed mechanisms"; the line entered DECISIONS.md in 6604a52 on 2026-09-04, and its original ruling date is NOT-CLAIMED, PS113): routes/pathfinder not borrowed.
  - DS1; DS2; DS5 ("possible that Paths are persistent entities, derived on top of Links"); DS13 ("paths are logical"); DS14 (the two routing layers, recorded as AGREED in the seeds, not a ruling).
- **Under each frame:**
  - FR0: none exists.
  - FR1: a derived layer over stored links.
  - FR2: a path over derived links, which are over pipes.
  - FR3: a path over cables, with a second routing layer below it (cables through pipes); the same routing shape at two layers (seeds S16).
  - Stages axis: fixed (path is an engine stage) vs a registered capability; seeds S12's separating test: "will a second, different set of stages ever run over the same wires (pilot pathing by other rules, another domain)?"
- **What would separate the alternatives:** Whether a path is ever needed without a flow (a pinned route with no traffic); seeds S1's discriminators: "can two flows share a path, can a path change under a stable flow?"; and whether the pilot's movers use the same path derivation (seeds S2).
- **Intent bearing:** DS1; DS2; DS3; DS4; DS5; DS14; Q3; Q1 (AX3); Q2 (behaviour: movers travel along paths).
- **Depends on / blocks:** Depends on: PS201 (F6), PS117, PS211 (F7); PS213 (F9, run) [I]. Blocks: PS122 (F10), PS214 (F12), PS225 (F25), PS226, PS227 (F26), PS411-PS413 (F27), PS220 (F36) (map, via F9); PS219, PS222 (S10), PS221 (S13) [I]. Related (overlapping, not merged): PS112.
- **Evidence (defects/contradictions):** none (the absence is measured, map 3.4).

### PS219. When more than one route satisfies a derivation, how does every viewer arrive at the same one?
- **Track / layer:** B ; path, flow
- **Covers:** S10 (the determinism half)
- **The question:** A derived path, or a cable routed from its ends, can have equal-cost alternatives. What makes the choice identical at every viewer and every door, and which inputs may the tie-break read?
- **Why it is open:**
  - Seeds S10: "Equal-cost routes: every viewer must pick the same one (tie-break)."
  - Today's one analogous choice is order-dependent: a spawner takes the first terminating link in linksAt order, and index order differs from scan order after a put (D11, C17) [M-run R4 c].
  - Undo restores content but not collection order (D43) [M-run G1], so a tie-break keyed on collection order would change across an undo [I].
  - rules.mjs:19-25 names three parity inputs: the document, the clock and the code revision (a code comment) [M-read].
  - Junction round robin, "fairly and deterministically" (ATOMICS.md:345), is designed and unbuilt.
  - Seeds S16: routing appears at two layers in FR3, each needing a deterministic tie-break.
- **Alternatives:**
  1. A total order on stable ids.
  2. Geometry: shortest drawn length, then a fixed order.
  3. A stored hint on the declaration (pinned hops).
  4. Ambiguity refused or reported: a visible condition when equal routes exist.
  5. All equal routes carried (ECMP-like): the path is a set, and presentation splits across it.
  6. (status quo) No multi-link derivation; the analogous spawner choice depends on index or scan order.
  7. other.
- **Recorded positions:** None on paths. Record: rules.mjs:19-25 parity inputs (a code comment). DS11 ("mechanical/deterministic").
- **Under each frame:**
  - FR0: only the spawner-link choice.
  - FR1: a path over stored links; stored ids are available as a tie-break input.
  - FR2: derived-link identity (PS217) feeds any id-based tie-break.
  - FR3: the tie-break question appears twice (cable through pipes when routed; path over cables); one routing capability used at two layers is a direct test of stages as capabilities (seeds S16, S12).
- **What would separate the alternatives:** Whether any candidate tie-break input changes across undo or redo, reload, or door (collection order does: D11, D43). A test: one document loaded at two doors with different insertion histories must yield the same path.
- **Intent bearing:** DS1 ("so that a path can be derived across all viewers"); Q1 (AX2); the envelope's Round-1 anchor (VISION north star: derived physics that everyone watching computes identically); DS11.
- **Depends on / blocks:** Depends on: PS218 (F9 path; seeds S10) [I]. Blocks: PS221 (S13, its reroute alternative), PS411-PS413 (F27) [I].
- **Evidence (defects/contradictions):** C17, D11, D43.

---

**Track B layer group: Flow**

### PS220. Is a persisted src:dst pair a selection, a declaration, or neither?
- **Track / layer:** B / seam ; flow, writes
- **Covers:** F36, S9 (the selection-vs-declaration half)
- **The question:** The director's example persists a src:dst pair so that a path is derived at every viewer. Is that pair selection-like status (persisted, unversioned, outside undo) or a declaration (versioned, undoable document intent), and is it the same thing as a flow?
- **Why it is open:**
  - DS1 (the director's example).
  - doc.selection is status: no version bump, not undoable (store.js:1281-1292) [M-read]; the browser never handles the `selection` broadcast (D23) [M-read R3]. The map's F36 cites "D25" for this; section 9's D25 is the CLI rename row and D23 is the selection event [M-read, PS re-read of the map].
  - Selection is ruled session state that lives outside the document (DECISIONS.md:343-344), while the code persists it in the document (envelope flag F2).
  - A flow pair has no shape anywhere (map 7.1 FLOW (c)); prism's route is the nearest prior art, not borrowed (DECISIONS.md:126).
  - The policy hypothesis "declare flow pairs on a control-plane graph" (DECISIONS.md:283) is out of scope (AG-1).
- **Alternatives:**
  1. Selection-backed status (persisted, no version bump, outside undo).
  2. A versioned, undoable declaration.
  3. A prism-like route entity {src, dst, hops} (revisiting DECISIONS.md:126).
  4. Paths derived with no stored route entity (a transient query).
  5. Both: a selection that can be promoted into a declaration.
  6. (status quo) No carrier; the nearest is doc.selection, which highlights one link's path.
  7. other.
- **Recorded positions:**
  - RULED (2026-09-22, DECISIONS.md:343-344): "Selection, hover, armed, ghost and the run-mode hides are session state: they live outside the document". [M-read, PS re-read]
  - RULED [LOCKED] (TRANSACTIONS D15, TRANSACTIONS.md:375; lock date not carried): selection is status (not logged, not versioned, not undoable).
  - DS1 ("persists as state in the control plane"); DS2 ("declare a path or flow").
  - HYPOTHESIS (the director's, 2026-09-22, DECISIONS.md:283): policy derived from flow pairs; "Not designed, not ruled, and not to be assumed".
  - Side by side: the ruling places selection outside the document; the code persists it; DS1 persists the pair "in the control plane".
- **Under each frame:**
  - FR0: no flow entity.
  - FR1, FR2 and FR3: each lists flow as declared src:dst; the question is whether that declaration is versioned intent. FR3 describes a flow as "a specific instance of traffic" (DS13), which admits several flows per pair [I].
  - Stages axis: under the k8s analogy, flow is the most k8s-shaped stage: src:dst as spec, path as status (seeds S12).
- **What would separate the alternatives:** Does undo revert a flow declaration? Does another viewer see it? Does it survive reload and export? Is more than one flow per pair meaningful? The envelope lists this as a Round-2 disambiguation.
- **Intent bearing:** Q3 (inputs may be persisted); DS1; DS2; DS3; Q2 (policy out, AG-1); DS13.
- **Depends on / blocks:** Depends on: PS213, PS218 (F9), PS122 (F10), PS226, PS227 (F26; forward references: Part 2 places the Direction and plane group after the Flow group, while the map orders F26 before F36). Blocks: PS427 (F37); PS221 (S13) [I].
- **Evidence (defects/contradictions):** D23.

### PS221. What happens to a declaration whose inputs can no longer satisfy it?
- **Track / layer:** B / seam ; flow, path, writes, behaviour
- **Covers:** S13
- **The question:** When a piece under a declared flow's path is deleted, or a flow's src or dst anchor is deleted, what does the declaration do?
- **Why it is open:**
  - Seeds S13 names the two cases and four outcomes.
  - The nearest stored intent today is spawn: a collapse leaves an inert spawn on a via that still reads as armed (D12) [M-run], and such a spawn cannot be cleared from the browser or the CLI (map 10.1 critic gap 3) [M-read].
  - A derived delete already leaves a stale reference in a stored container (D42) [M-run G2].
  - "Deleting a link never deletes what it terminated at" (ATOMICS.md:151) [M-read, PS re-read]; a retype is tolerated with no check (F41) [M-run G3].
- **Alternatives:**
  1. The declaration keeps its spec and derives a visible condition (e.g. unroutable) that every viewer sees (seeds S12, status.conditions).
  2. It reroutes silently.
  3. The delete is refused while a declaration depends on it.
  4. The declaration is deleted (cascade).
  5. (status quo) No flow declaration exists; the nearest stored intent (spawn) is left inert and still reads as armed.
  6. other.
- **Recorded positions:** None. Seeds S13 records it as a "Behavioural intent question for Round 2 (asks how it should behave, not what structure)".
- **Under each frame:**
  - FR0: no flow declarations; the analogues are spawn and the delete cascade.
  - FR1: a flow over stored links loses a link or an anchor.
  - FR2: deleting a pipe re-forms derived links, which may reroute or break the path.
  - FR3: deleting a pipe leaves cables routed through it without a conduit, so the question arises one layer down as well (a cable whose declared route loses a pipe; a LAG or VLAN construct losing a member cable) [I].
  - Stages axis: under capabilities, every stage's declarations need the same condition model (seeds S12).
- **What would separate the alternatives:** Round-2 behavioural answers for each case: src deleted; a piece on the path deleted with an alternate route available; the same with none available. And whether undoing the delete must restore the declaration's prior status exactly.
- **Intent bearing:** INTENT-SILENT. No Round-1 pick or director statement speaks to it; seeds S13 names it a Round-2 candidate.
- **Depends on / blocks:** Depends on: PS103 (S12, which raised it); PS220 (F36), PS218 (F9 path), PS219 (S10), PS217 (S7) [I]. Blocks: none recorded.
- **Evidence (defects/contradictions):** D12, D42.

### PS222. How do many flows sharing one connection stay distinguishable to a viewer?
- **Track / layer:** B ; flow, appearance
- **Covers:** S10 (the rendering half)
- **The question:** When many declared flows share a link (and, in some frames, many links share a pipe), what visual form keeps each one distinguishable?
- **Why it is open:**
  - Seeds S10: "Many flows sharing a link: the visual flow elements must stay readable (lanes, bundling, aggregation)."
  - DS2 asks for "a visual flow element along them"; DS3 for "lots of permutations of flows".
  - "Still open: ... bundled-vs-individual link rendering" (ATOMICS.md:102); [LOCKED] ports allow 2 per node face (ATOMICS.md:106-115), which bounds lanes at a node [M-read, PS re-read].
  - `.on-selected-path` lights one link only (renderer.js:180-192); bundle and bus realizers exist only in the archive (map 7.2).
  - Seeds S15 consequence D: visualising the four relations (lanes, bundle marks, multiplex tags) joins this question.
- **Alternatives:**
  1. Lanes: each flow drawn offset within the connection.
  2. Bundling: flows merged along shared segments and split where they diverge.
  3. Aggregation: one mark per connection with a count or legend.
  4. On demand: only selected or hovered flows drawn.
  5. Moving elements per flow (behaviour as the visual element).
  6. (status quo) No flow layer; one link's path highlight; movers per spawner on one link.
  7. other.
- **Recorded positions:** [OPEN] ATOMICS.md:102; RULED [LOCKED] ATOMICS.md:106-115; DS2; DS7 ("visualise all 4"). None else.
- **Under each frame:**
  - FR0: not applicable; no flows.
  - FR1: flows over links.
  - FR2: flows over derived links; lanes follow the pipe chain.
  - FR3: flows over cables that themselves share pipes, so two levels of lane (cables in a pipe; flows on a cable) [I]; VLAN tags are a further mark.
- **What would separate the alternatives:** A density target (the largest number of flows per connection that must stay readable), and whether every viewer must see the same drawing (A5 perceptual parity) or a per-viewer filter as session decoration (DECISIONS.md:343) is admissible.
- **Intent bearing:** DS2; DS3; DS7; Q3 (visibility); the envelope's Round-1 anchor A5 (perceptual parity).
- **Depends on / blocks:** Depends on: PS220 (F36), PS215 (F13) [I]; PS110 (S15). Blocks: none.
- **Evidence (defects/contradictions):** none.

---

**Track B layer group: Direction and plane**

### PS223. Which layers carry direction, and what is today's `flow` boolean in a layered model?
- **Track / layer:** B / frame ; pipe, link, path, flow
- **Covers:** S8
- **The question:** Direction may belong to some layers and not others. Which layers carry it, and is today's `flow` boolean a one-way constraint on a link, or a one-hop declared flow?
- **Why it is open:**
  - Envelope flag F5: "Today's `flow` boolean has no layer yet: it could be a one-way constraint on a link, or a one-hop declared flow."
  - `link.flow` is the only direction identifier; it is read by facing, linkFacing, linkMarker, waypointRoles, linkAppearance, the adapter, kernel/engine.mjs:135 and the collapse; engine/ has 0 reads, and movers never read it (map 1.1 FLOW) [M-run R1-R4, R7].
  - Movers run against a declaration when armed at the flow head (D10) [M-run].
  - "flow" names at least four things (map 7.1 FLOW): the declaration, traffic, a src:dst pair, inherited direction.
  - Seeds S8 candidate: "wire: none (symmetric geometry)? link: optional one-way constraint? path: from its flow; flow: always directed."
- **Alternatives:**
  1. Direction only on flows; links and pipes undirected; today's boolean becomes a one-hop flow.
  2. Pipe none; link an optional one-way constraint; path from its flow; flow always directed (the seeds S8 candidate).
  3. Direction on pipes as well (needed if direction cuts derived links, PS209).
  4. The link boolean kept as a one-way constraint and flows declared above, both read (the constraint limits which flows a link admits).
  5. (status quo) Direction only on links, as an optional boolean, with inheritance along runs ruled and unbuilt.
  6. other.
- **Recorded positions:**
  - RULED per map F25 (ATOMICS.md:256, 260; section tagged [DESIGNED 2026-09-22]; shipped H15.3, H15.4, H15.6): "Declared direction is meant, is visible, and is the only direction any rule may read." [M-read, PS re-read]
  - RULED (director, 2026-09-22, BOARD.md:834): FRAGMENT.
  - DS5 ("maybe only some of these items have direction etc."); DS13 ("paths are logical, flows are specific instances of traffic").
  - DIRECTOR LEANING 2026-09-25 (added after the register was assembled; seeds S8): "Yes I think pipes don't have direction". Given in reply to the proposer's stated lean (flows always directed, pipes never, link one-way an optional attribute); only the pipe half was adopted by the director. Where direction lives above the pipe remains open.
- **Under each frame:**
  - FR0: the status quo.
  - FR1: flows are declared src:dst above links; what the link boolean means is this question.
  - FR2: if direction affects cuts it must live on pipes or anchors (PS209); otherwise on flows only.
  - FR3: a cable may or may not be one-way [I]; flows are directed; paths take direction from flows.
- **What would separate the alternatives:** Whether any network case needs a one-way connection independent of any flow (a simplex link). If yes, a link-level constraint exists alongside flows; if no, direction can live on flows alone. And which current readers of `link.flow` (arrowhead, role matrix, collapse) keep a meaning if it moves.
- **Intent bearing:** DS5; DS6; DS13; the H15 exit (BOARD.md:847).
- **Depends on / blocks:** Depends on: PS208 (G2); PS213 (F9; mutual, see PS213), PS218 (F9) [I]. Blocks: PS209 (S6a), PS224 (S6b); PS225 (F25), PS226, PS227 (F26) [I].
- **Evidence (defects/contradictions):** C1, D10.

### PS224. Does the FRAGMENT ruling apply once direction can live somewhere other than links?
- **Track / layer:** B / frame ; link, flow
- **Covers:** S6b
- **The question:** FRAGMENT rules that opposing declarations on a run break it at the waypoint between them. If direction moves up to flows, two opposite flows over one link need not cut it; if direction stays on links as a one-way property, FRAGMENT applies as ruled. The layered model can reopen the ruling, and only the director can.
- **Why it is open:**
  - The ruling: "Two opposing declarations on one run do not fight. The waypoint between them holds two links that oppose, which the matrix already calls a junction, so the run breaks there and the conflict is visible exactly where it was authored." (BOARD.md:834-837) [M-read, PS re-read]; also ATOMICS.md:320.
  - H15.5 is TODO; no propagation code exists (map 3.4).
  - Seeds S6b: "If direction moves UP to flows (a flow is src->dst over a path), two opposite flows over one link should NOT cut it (a link carries both ways), and FRAGMENT would not apply at the flow layer. If direction stays on wires/links as a one-way property, FRAGMENT holds as ruled." (seeds wording, Claude's)
- **Alternatives:**
  1. FRAGMENT at the link or run layer, as ruled: opposing link declarations make a junction.
  2. FRAGMENT kept for link-level one-way constraints only; opposite flows over one link do not cut it.
  3. FRAGMENT retired if direction moves wholly to flows.
  4. FRAGMENT moved below links: pipe-level direction cuts derived links (FR2 with direction on pipes).
  5. (status quo) Ruled and unbuilt.
  6. other.
- **Recorded positions:** RULED (director, 2026-09-22, BOARD.md:834; ATOMICS.md:320): FRAGMENT. Seeds S6b: "Not re-litigated here; recorded because the layered model can reopen it, and only the director can." No director leaning on reopening it is recorded.
- **Under each frame:**
  - FR0: as ruled, unbuilt.
  - FR1: links keep declarations and flows add direction above; whether both exist decides which alternative has a subject.
  - FR2: FRAGMENT becomes a cut input if direction lives on pipes (PS209).
  - FR3: cables carry flows both ways unless a cable is one-way; FRAGMENT would bite only where one-way cable declarations meet [I].
- **What would separate the alternatives:** A director question: in the layered model, does a head-to-head pair of declarations (a -> w <- b) mean two one-way links meeting (a junction, as ruled) or two flows in opposite directions (no junction)? Draw the case under both readings and ask which drawing is intended.
- **Intent bearing:** DS5; DS6; the FRAGMENT ruling itself.
- **Depends on / blocks:** Depends on: PS205, PS207 (S6), PS223 (S8). Blocks: PS213 (F9, run inheritance, H15.5); PS217 (S7, binding alternative 2) [I].
- **Evidence (defects/contradictions):** none (unbuilt).

### PS225. Which direction governs how things move and how a connection is presented?
- **Track / layer:** seam ; flow, behaviour, appearance
- **Covers:** F25
- **The question:** Declared flow is ruled the only direction a rule may read, yet movers orient from the armed end and the reveal trace follows stored order. Which direction do motion and presentation follow?
- **Why it is open:**
  - ATOMICS.md:256, 260 (declared direction is the only direction a rule may read).
  - Spawners orient from the armed end and never read flow (spawners.mjs:42 [S]); movers run against a declaration when armed at the flow head, in all 6 combinations probed (D10) [M-run R1, R4, R7].
  - The reveal trace follows stored src -> dst (reveal.mjs:37-39; map 4.4 #12) [M-read].
  - shape.mjs:44-47 derives direction from the armed end (H12.5, BOARD.md:613); no ruling relates the two (R6 grep).
  - BOARD.md:849 puts packet movement outside H15.
- **Alternatives:**
  1. Movers follow a declared flow.
  2. Arming refused where it would oppose a declaration.
  3. The trace follows a declared flow.
  4. The trace exempt as presentation.
  5. Movers are instances of a declared flow and travel its path across links, starting at its src [I].
  6. (status quo) The armed end decides motion; stored order decides the trace.
  7. other.
- **Recorded positions:** RULED per map F25 (ATOMICS.md:260, [DESIGNED 2026-09-22]); record H12.5 (BOARD.md:613), direction from the armed end. The two sit side by side with no ruling between them.
- **Under each frame:**
  - FR0: as stated.
  - FR1, FR2 and FR3: a declared flow has a src and a dst; a mover could be an instance of a flow (DS13: "flows are specific instances of traffic") rather than of a spawner, so the question becomes whether spawn (per anchor) and flow (per pair) are one construct or two [I].
- **What would separate the alternatives:** Whether a mover is an instance of traffic on a flow, or a pilot game object on a path (seeds S2, engine or domain). The first ties motion to the flow's direction; the second leaves it to the pilot.
- **Intent bearing:** Q2 (behaviour and events inside the substrate); DS2 ("a visual flow element along them"); DS13; the H15 exit (BOARD.md:847).
- **Depends on / blocks:** Depends on: PS213, PS218 (F9); PS223 (S8) [I]. Blocks: PS411-PS413 (F27).
- **Evidence (defects/contradictions):** D10.

### PS226. Where does plane (data or control) live, and does a control-plane connection carry traffic?
- **Track / layer:** B / seam ; pipe, link, flow, behaviour
- **Covers:** F26 (the plane-vs-packets half), S6a (plane must be readable below links if it cuts)
- **The question:** `control` is defined as carrying no data-plane packets, yet spawners emit on control links and the engine never reads it. Is plane a property of pipes or anchors (so it can cut derived links), of links, of flows, or of appearance only?
- **Why it is open:**
  - "true marks a link that carries no data-plane packets" (ATOMICS.md:290; validate.js:248-249) [M-read, PS re-read]; spawners emit on control links (D9) [M-run R1, R2, R7]; engine/ never reads `control` [M-run].
  - A plane difference makes a junction (ATOMICS.md:294-306; B233); a terminus's plane is "mixed is data" (geometry.mjs:390-392); there is no `plane` field (map 1.2).
  - Seeds S6a: under a derived-link model "plane and any cut-affecting direction are properties of wires or anchors, not of links."
  - Seeds S15, open: if "just its two anchors" means no configuring spec on a pipe, "then plane lives higher and can no longer cut links, touching the ruled plane-difference rule".
  - Prism has three planes (mgmt, control, data) (map 7.2).
- **Alternatives:**
  1. The engine skips control links (no movers on them).
  2. Arming refused on control links.
  3. Plane a property of the lower unit (pipe), so it can cut derived links.
  4. Plane a property of flows (a flow is data or control), with connections carrying both [I].
  5. Plane generalised beyond two values (mgmt, control, data).
  6. (status quo) Plane is appearance plus role input only; the engine ignores it.
  7. other.
- **Recorded positions:** RULED (record, ATOMICS.md:287-310, section tagged [DESIGNED 2026-09-22], shipped H15.15, H15.17): control carries no data-plane packets; plane and direction are independent; differing planes make a junction. DIRECTOR LEANING DS12 ("a wire's spec is just its two anchors"). Side by side: alternative 3 needs a pipe-level field, DS12 may leave none, and the ruled plane rule cuts; the seeds leave the meaning of DS12 "to clarify later".
- **Under each frame:**
  - FR0: `link.control`.
  - FR1: `link.control`; flows may also carry a plane.
  - FR2: plane must be on pipes or anchors to cut (seeds S6a), in tension with DS12 read as "no configuring spec".
  - FR3: plane on cables or on flows; one pipe can hold cables of both planes [I].
- **What would separate the alternatives:** Whether a control-plane connection is a different physical thing (its own cable) or the same cable carrying control traffic. If physical, plane is a cable or pipe property; if traffic, a flow property. And the director's clarification of DS12 (seeds S15).
- **Intent bearing:** DS6; DS12; DS13; Q2 (behaviour: movers on control links).
- **Depends on / blocks:** Depends on: PS213, PS218 (F9), PS122 (F10); PS223 (S8), PS108 (S15). Blocks: PS411-PS413 (F27), PS220 (F36), PS427 (F37).
- **Evidence (defects/contradictions):** D9, D16, D36.

### PS227. What does "control plane" name?
- **Track / layer:** B / seam ; flow, vocabulary
- **Covers:** F26 (the "which control plane" half), S9 (the control-plane half)
- **The question:** The phrase names at least five things: the control link, a server-computed forwarding plane beside a stateless browser, the policy graph, the server lock, and the place where the director's src:dst pair "persists". Which of these, if any, is where declared flows live, and does the phrase stay one term?
- **Why it is open:**
  - Meanings in the record and code (map 1.2 control / plane row): `link.control` (H15.15); "The control plane is computed server-side and the browser is a stateless data plane" (ATOMICS.md:349) [M-read, PS re-read]; the Server-Locked control plane (server/app.js:3-5; DECISIONS.md:88-95); the policy "control-plane graph" (DECISIONS.md:283); plus a Bezier control point and k8s controllers.
  - Against ATOMICS.md:349: "a consequence is never sent" (VISION.md:80-81) and every peer derives (rules.mjs:27-30); the server computes no simulation (C16) [M-read R4].
  - DS1: "persists as state in the control plane".
  - The envelope's Round-2 tension: "what "the control plane" means here (H15.15 control links, a separate declared layer, or the document)".
- **Alternatives:**
  1. The document: declarations stored in the diagram, and every peer derives from them.
  2. A separate declared layer within the document (a declaration collection apart from geometry).
  3. The H15.15 control links: declarations drawn as control-plane connections.
  4. A server-computed plane (ATOMICS.md:349), with the browser rendering what it is given.
  5. The lock and authority plane (server/app.js:3-5).
  6. (status quo) The phrase carries all of these at once.
  7. other.
- **Recorded positions:** Record: ATOMICS.md:349 ([DESIGNED 2026-09-22], Packets subsection); VISION.md:80-81; DECISIONS.md:88-95 (Amended 2026-06-13, Server-Locked control). HYPOTHESIS (the director's, 2026-09-22, DECISIONS.md:283): the policy control-plane graph, out of scope (AG-1). DS1. DIRECTOR STATEMENT, 2026-09-25 (seeds S19): see PS127.
- **Under each frame:**
  - FR0: no flow declarations; the phrase is overloaded.
  - FR1, FR2 and FR3: flows are declared, and where they are stored is this question; FR3 adds logical constructs (LAG, VLAN) as further declarations.
  - Stages axis: under the k8s analogy a control plane is the API server plus controllers that write; seeds S12 records the strain that "here higher stages DERIVE from lower primitives, every observer computes them, nothing is written".
- **What would separate the alternatives:** The director's meaning of "control plane" in DS1 (the document shared by all viewers, a distinct layer, or the server). An observation that separates alternative 1 from 4: whether each viewer computes the path itself or receives it.
- **Intent bearing:** DS1; Q2 (policy out, so the policy-graph meaning is outside the reach); Q3; the envelope's VISION anchor (everyone watching computes identically).
- **Depends on / blocks:** Depends on: PS213, PS218 (F9), PS122 (F10) (map, via F26). Blocks: PS220 (F36), PS427 (F37). Related (overlapping, not merged): PS127.
- **Evidence (defects/contradictions):** C16, D23.

---

**Track B layer group: Vocabulary raised with this part**

### PS228. What does "projection" name?
- **Track / layer:** seam ; writes, vocabulary
- **Covers:** G2 (the PROJECTION half: the missing glossary row)
- **The question:** "Projection" carries at least four meanings and has no glossary row, although the write seam depends on it. Is it one term, several, or renamed per meaning?
- **Why it is open:**
  - Map 10.1 critic gap 2 lists four meanings: the scratch Model copy (model.mjs:34-38); the planner's advancing `proj` (txn.mjs:90, :215, :261; W7 "advancing projection"); the client's prediction of server cascades (commands.js twins; the matrix's "Client projection" column); a single-role projection (geometry.mjs:528-534).
  - D41, the stale-projection defect, is a defect in the second meaning [M-run G1]; D44 is reached through the third (a client projection whose key collides in the ack diff) [M-run G3].
  - The ack path calls planner-added ops `added` (sync.js:412) (map 7.2).
- **Alternatives:**
  1. One word for all four, with a glossary row naming each sense.
  2. One word for one sense (for example, the planner's advancing state, the W7 usage), and the others renamed (names not proposed here).
  3. A separate name for each of the four.
  4. (status quo) One word, four senses, no glossary row.
  5. other.
- **Recorded positions:** RULED W7 (director, 2026-09-04, WRITES.md:253-255): "W7 RULED: the op carries INTENT, and the server resolves it"; the per-op projection advance is described at WRITES.md:261-263. No other position.
- **Under each frame:** Same under all frames as a vocabulary question. Under FR2 and FR3 more layers are derived, so the number of things that are "a projection of" something grows [I]; under stages as capabilities each stage adds a derived state of its own.
- **What would separate the alternatives:** For each use, whether it denotes (a) a state computed ahead of commit, (b) a client's guess of server output, or (c) a reduction of a set to one value. If the uses fall into different kinds, one word covers different kinds.
- **Intent bearing:** INTENT-SILENT on which alternative. Q1 (AX5, fewer concepts to learn) bears on vocabulary in general.
- **Depends on / blocks:** Depends on: PS313 (F17), PS320, PS321 (F21), PS316 (F40) (the write seam) [I]. Blocks: none.
- **Evidence (defects/contradictions):** D41, D44.

## 5.3 Part 3 -- The seam: anchor, roles and permission, writes, validation, projection, identifiers (PS301-PS328)

This part carries the open questions where what a thing is (Track A) meets how things connect (Track B): what `anchor` names, how roles and permission reach an anchor, how writes are contributed, computed, composed, validated, undone and projected to clients, and which identifiers move.
It absorbs map forks F1, F5, F16-F24, F40 and F41, seed S6c, the compiler-location half of seed S5, and critic gap 1 of map section 10.1.
It decides nothing: every entry lists the status quo among its alternatives, records each position at its exact standing, and names what would separate the alternatives.
Evidence marks are the map's ([M-run], [M-read], [V], [S], [I]); "[read for this register]" marks record lines re-read at a986fb3 while drafting; the implications under "Alternatives" and the readings under "Under each frame" are inferred [I] unless a mark says otherwise.
Naming: "wire" inside quoted seed text S1-S15 means pipe (seeds naming note, 2026-09-25). In evidence marks, G1-G3 are the map's gap-fill readers; in Covers lines, "G1" means critic gap 1 of map section 10.1.
Assembly note: PS314 also carries the frame drafter's entry on where a compile step is computed (formerly PS119).

### PS301. Which concept does the word `anchor` name?
- **Track / layer:** seam ; vocabulary, anchor
- **Covers:** F1 (the word and its two containment directions); map sections 1.3 (anchor row) and 4.1
- **The question:** Four live senses share the word: a referenceable point, a grid place that an entity occupies, the identity-bearing core that an entity has, and a drawn ring. Which of these does `anchor` name, and what names the others?
- **Why it is open:**
  - [LOCKED 2026-08-19] "An **ANCHOR** is a referenceable point" with the set "`node - waypoint - port - junction - cell`", and "`anchor` means exactly one thing" (HIERARCHY.md:39-54, :70) [M-read; read for this register].
  - "An anchor is a place" carrying {layout, cx, cy, x, y, occupant}, and "One anchor holds one node" (LAYOUT.md:25-39, :62-64; built B110-B113). Here an entity OCCUPIES an anchor [read for this register].
  - "the CORE. Identity, position, and the fact that links can reach it. Nothing else." (DECISIONS.md:298, 2026-09-22), with "a node has an ANCHOR" (:227). Here an entity HAS an anchor [read for this register].
  - Code identifiers bind the grid sense: nearestAnchor, anchorAt, resolveAnchor, /layouts/:name/anchors, CLI `anchor nearest` and `anchor free`, and the violations text "occupy the same anchor" (invariants.mjs:303) [M-read]. The drawn sense is the wp-anchor ring (geometry.mjs:137-145).
  - The core sense has no code carrier (map 1.3) [M-read R5, R6, R7].
  - HANDOVER.md:42-46 says anchor "has no identifiers", which holds for the core sense only (C41) [M-read R5].
  - The scan-writers check for a non-canonical `anchor` claimed at HIERARCHY.md:74-78 does not exist (C11) [M-read].
- **Alternatives:**
  1. (status quo) The word carries all four senses; the grid sense holds the identifiers and the core sense lives only in documentation. Implies a search for `anchor` returns mixed senses.
  2. `anchor` names the core (DECISIONS.md:298) and the grid sense is renamed (slot, cell, position, place). Implies renaming layout identifiers, a REST route and CLI verbs.
  3. `anchor` names the grid place (LAYOUT.md) and the core receives another name. Implies amending the ontology table at DECISIONS.md:296-302.
  4. The HIERARCHY canon is amended to match the ontology (referenceable point = identity-bearing core), and cell-as-anchor is dropped or renamed (PS302).
  5. The occupying and the having senses are declared one concept, as LAYOUT.md:28-31 argues ("the same concept arriving from the other direction"). Implies occupancy and identity share one noun.
  6. other.
- **Recorded positions:**
  - RULED [LOCKED] 2026-08-19: HIERARCHY.md:39-54, :70 (referenceable point; one meaning).
  - RULED 2026-09-22: DECISIONS.md:227-229, :298 (the core).
  - Spec, date not measured here: LAYOUT.md:25-31 ("the term stays one term") and :62-64 (the grid place), built B110-B113 per the map.
  - The three coexist; the record does not state which supersedes the others (map 1.3).
- **Under each frame:**
  - FR0, FR1: a vocabulary question; roles attach to waypoint entities, and the grid sense stays bound to placement.
  - FR2, FR3: a pipe's spec is "its two anchors" (seeds S15 leaning), so the sense chosen becomes a stored reference target: a pipe between places, or a pipe between identities.
  - Stages axis: the seeds' reading of S6c speaks of "the anchor system" that packs and stages act on; that reading uses the core sense.
- **What would separate the alternatives:** Does anything need to reference a position that no entity occupies (the answer bears on whether the grid sense and the identity-bearing sense can be one noun)? Does any entity occupy more than one place, or any place hold more than one referenceable thing (spans, ports, group hulls)? After any renaming, does a plain-text search for `anchor` return one sense?
- **Intent bearing:** Q1c (fewer concepts) bears on one word carrying four senses. Q3a (something attaches) bears, since pipes and links attach to anchors. Director usage, 2026-09-25: "a wire's spec is just its two anchors" (seeds S15); "a 'wire' represents an adjacency between anchors as a lowest network primitive" (seeds S16); "applied by the 'router node' pack to the anchor system on that node" (seeds S6c). None of these states which sense the word names.
- **Depends on / blocks:** Depends on: none. Blocks: PS403-PS405 (F3), PS406-PS408 (F4), PS303-PS305 (F5), PS122 (F10), PS204 (F11), PS203 (F14), PS306, PS307 (F16) (map edges); PS110 (S15), PS308 (S6c); PS302.
- **Evidence (defects/contradictions):** C11, C41.

### PS302. Is an identity-less position (a bare cell) something a connection may reference?
- **Track / layer:** seam ; anchor, pipe, link
- **Covers:** F1 (its option "keep or drop identity-less free anchors"); map section 4.1
- **The question:** The kernel admits a bare cell as a route reference, the live preview admits a bare {x,y}, and the document admits only entity ids. Is an identity-less position a referenceable anchor, and at which layers?
- **Why it is open:**
  - kernel resolveRoute admits any byId entity (node, waypoint, zone, group) or a cell array (kernel/engine.mjs:90, 102, 124-131) [M-run R2 probe3]; a bare cell is a "free bend" (kernel/engine.mjs:22-25).
  - Model.pathOf admits a bare {x,y} at src/dst for the live preview and requires a waypoint in via, otherwise the whole path is null (model.mjs:171-183) [M-run R2].
  - The validator admits node or waypoint at src/dst and waypoint in via (validate.js:241-243); via = [node] is refused [M-run R2 probe2].
  - HIERARCHY.md:53 includes `cell` in the one anchor set; LAYOUT.md:28 says the model "already admits *a cell coord as a free anchor*" [read for this register].
  - CLI `link --via cx,cy` takes cells, mints a new waypoint per cell, and cannot thread an existing waypoint (verbs.mjs:1880, 1908-1916) [M-read]: the authoring surface speaks cells, the store speaks ids.
  - The ruled core includes "Identity" (DECISIONS.md:298); a cell has none.
- **Alternatives:**
  1. (status quo) Admitted in the kernel and the live preview, refused in the document; the CLI converts cells into minted waypoints on write.
  2. Admitted at every layer: a stored reference may be a cell. Implies references without identity in documents, and occupancy and role derivation over cells.
  3. Refused at every layer: every reference is an identity-bearing entity; the kernel and the preview mint or refuse.
  4. Admitted only at authoring surfaces and compiled into identity-bearing anchors on write (the CLI's behaviour generalised to every door).
  5. other.
- **Recorded positions:** RULED [LOCKED] 2026-08-19: HIERARCHY.md:53 includes `cell`. RULED 2026-09-22: DECISIONS.md:298 puts identity in the core. The two coexist; no record line reconciles them.
- **Under each frame:**
  - FR0, FR1: a question about five admission sets (map 4.1).
  - FR2: whether one end of a pipe may be a bare cell decides whether a pipe, and so a derived link, can end in open space.
  - FR3: the same for pipes, plus whether a cable's routed via can pass a place with no entity.
- **What would separate the alternatives:** Is there an authored connection that ends at, or bends through, a place with no entity and must survive save and reload? Does any consumer (roles, occupancy, permission, a declared flow) need to attach something to such a place?
- **Intent bearing:** Q3a and Q3b (a noun is admitted when something attaches to it and an author or agent can see it) bear on whether a bare cell is a referenceable thing. Seeds S15 DIRECTOR LEANING: "a wire's spec is just its two anchors." Seeds S5 DIRECTOR statement: "Using the w key to create a link with bends might also construct wires between the anchors under the hood mechanically."
- **Depends on / blocks:** Depends on: PS301 (F1). Blocks: PS204 (F11), PS107 (S15, the pipe's spec), PS118 (S5).
- **Evidence (defects/contradictions):** none.

### PS303. What happens to the `waypoint-` id prefix and kind, the named one-way door?
- **Track / layer:** seam ; vocabulary, anchor
- **Covers:** F5 (prefix migration); map section 1.2 (waypoint row)
- **The question:** `waypoint` is an id prefix, a validator kind and a collection in every stored document, and the record names its retirement (step 3) as the irreversible step. Is the prefix migrated, kept, or reinterpreted, and on what condition?
- **Why it is open:**
  - DECISIONS.md:201-204 (2026-09-19): "`waypoint` is an ID PREFIX, present in the id grammar, the CLI, and every stored document. Everything before step 3 is reversible; step 3 is not. It also changes what `via` means -- from 'any waypoint' to 'any node holding the capability'" [read for this register].
  - The prefix is in the id grammar (validate.js:43; API.md:236) and in kindOf, which splits the id on '-' (model.mjs:49-51) [M-read].
  - DECISIONS.md:302 retires waypoint "as a concept"; :310-312 "THE IDENTIFIERS DO NOT MOVE YET."
  - HANDOVER.md:39-42 (2026-09-24): "`node-` is probably CORRECT, not merely tolerated."
  - Migrations reach documents only, not log records (F23; PS327).
  - Estate size: DECISIONS.md:199 says 26 live diagrams (2026-09-19); envelope AX6 says 38 (2026-09-25). Not re-measured here.
- **Alternatives:**
  1. (status quo) Keep `waypoint-` as prefix, kind and collection; the ontology lives in documentation only.
  2. Migrate `waypoint-` to `node-` once. Implies every stored document, the id grammar, kindOf, CLI and REST change, and via widens.
  3. Keep `waypoint-` as the prefix of one composition (the routable-only one), with kind no longer read from the prefix. Implies kind and prefix decouple.
  4. Retire both prefixes in favour of an anchor-level prefix (PS304).
  5. Defer the prefix question to the frame choice: under FR2 or FR3 a bend is carried by pipes rather than by a via entry, which changes what a migration would move.
  6. other.
- **Recorded positions:**
  - RULED 2026-09-19: DECISIONS.md:191-204 (staged order; step 3 irreversible).
  - RULED 2026-09-22: DECISIONS.md:310-312 (identifiers do not move yet).
  - Director amendment recorded in HANDOVER.md:39-42 (2026-09-24), worded "probably CORRECT".
- **Under each frame:**
  - FR0: as stated.
  - FR1: declared flows and derived paths reference anchor ids, so the prefix also appears inside new declarations.
  - FR2: bend anchors remain as pipe ends and via may be derived (seeds S4); the prefix question is unchanged except that no stored via list references it.
  - FR3: bend anchors remain as pipe ends, and a declared cable route may reference them; the prefix question is unchanged.
- **What would separate the alternatives:** Once roles and permission are read by composition, does any behaviour differ between a routable-only node and a waypoint (if none, the prefix carries nothing beyond the composition)? How many stored documents and log records carry the prefix (a count)? Is there an out-of-repo consumer of ids (PS305)?
- **Intent bearing:** Q1c (fewer concepts) bears. The outcome axis AX6 (proposer wording, accepted by the director without amendment, not among Round-1's primary or secondary axes): "Irreversible changes to stored documents (38 live diagrams at 2026-09-25) are few, named, and last."
- **Depends on / blocks:** Depends on: PS301, PS302 (F1), PS401, PS402 (F2), PS403-PS405 (F3). Blocks: PS204 (F11), PS327 (F23), PS326 (F41, per-entity conversion), PS116 (S4), PS305.
- **Evidence (defects/contradictions):** none.

### PS304. Which parts of the stack receive identifiers or field names (anchor, pack, composition, pipe), and in what grammar?
- **Track / layer:** seam ; vocabulary, anchor, pipe
- **Covers:** F5 (the owed naming of the rest of the stack); map section 1.3 (pack, capability, composition rows)
- **The question:** anchor, pack and composition are ruled concepts with no identifier, field name or id-grammar slot, and "some of them will need one". Under FR2 and FR3 pipes are stored, so they also carry some identity. Which of these receive stored identifiers, which are field values, and which stay documentation-only?
- **Why it is open:**
  - HANDOVER.md:44-46 (2026-09-24): "`anchor`, `pack` and `composition` are ruled as concepts and have no identifiers, no field names and no place in the id grammar, and some of them will need one. That is design work, deliberately not settled here" [read for this register].
  - node.type is the nearest stored proxy for composition (map 1.3) [M-read]; the ruled spelling 'load-balancer' differs from the code key 'loadbalancer', and a node typed 'load-balancer' yields 0 towers [M-run R4 probe2] (F2).
  - `pack` has no code: a grep hits only scan-twins.mjs:61 (a comment) and server/identity.mjs:114 (JWS "packs") [M-read R5].
  - "capability" in code means authorization (store.js:1127; rest.js:901; protocol.js:498; main.js:599) [M-read].
  - Seeds S15 (inferred there): with pipe identity = its unordered anchor pair, parallel pipes need a discriminator, a differing property, or parallelism above pipes.
- **Alternatives:**
  1. (status quo) None of anchor, pack or composition has an identifier; node.type stands in for composition.
  2. Composition becomes the stored type value (a registry key); packs stay code-only.
  3. Packs become a stored per-entity field (a declared pack list). Implies per-instance declaration, beside the per-type ruling (PS309).
  4. The anchor receives its own id, separate from the entity that carries it.
  5. Pipe identity: the unordered anchor pair with no stored id; or a minted id under its own prefix; or no pipe (FR0, FR1).
  6. other.
- **Recorded positions:** RULED 2026-09-22: DECISIONS.md:310-312. Director statement in HANDOVER.md:44-46 (2026-09-24): naming the rest is owed and "deliberately not settled". DIRECTOR LEANING 2026-09-25 (seeds S15): "a wire's spec is just its two anchors." The seeds record its open clarification: "does 'just its two anchors' mean NO configuring spec on a wire ... or only that the GENERATIVE spec is two anchors?" DIRECTOR LEANING, 2026-09-25 (seeds S20): "a document should declare its required packs"; see PS128, PS129.
- **Under each frame:**
  - FR0, FR1: anchor, pack and composition only.
  - FR2: pipe identity, plus a stable address for a derived link that has no stored id (seeds S7).
  - FR3: pipe identity, cable identity (the `link-` prefix could carry cables), and identities for LAG and VLAN constructs.
  - Stages axis: under stages as capabilities, a registered stage may itself need a name that declarations reference.
- **What would separate the alternatives:** For each noun, does anything stored reference it (a declaration, a selection, a history record, a URL)? For a noun that nothing stored references, would an id-grammar slot have any reader? The seeds' candidate admission test (S14) reads "a field is persisted only if it is intent that cannot be derived". Can two parallel pipes between one anchor pair be told apart by anything other than a minted id?
- **Intent bearing:** Q3c (derived, with inputs that may be persisted) bears. Seeds S14 DIRECTOR: "a link, path or flow config would need to have some entity persisted into the document (minimal entity/spec) such that the derivation can actually occur." Seeds S15 DIRECTOR CONTEXT: "Today - we only support a single link between 2 anchors, but in future we may allow parallel links between 2 anchors."
- **Depends on / blocks:** Depends on: PS301, PS302 (F1), PS401, PS402 (F2), PS403-PS405 (F3), PS114 (S14), PS107 (S15), PS217 (S7). Blocks: PS204 (F11), PS327 (F23), PS305, PS128 (S20). Related (overlapping, not merged): PS129.
- **Evidence (defects/contradictions):** C41.

### PS305. Is an id-grammar change delivered in place on `/api/v1`, or behind a new API version?
- **Track / layer:** programme ; vocabulary
- **Covers:** F5 (the X1 revival trigger and the /connect/v1 door)
- **The question:** X1 accepted redefining `/api/v1` in place, with a revival trigger; the handover's restatement drops the trigger; an agent door `/connect/v1` exists. Does a prefix or grammar change go out in place, or behind a new version?
- **Why it is open:**
  - X1 (COMMIT-DELIVERY.md:565): accepted "for a single-tenant tool with a bundled CLI", with "Revival trigger: any out-of-repo or third-party consumer of `/api/v1` - the next change then goes to `/api/v2`" [read for this register].
  - HANDOVER.md:310: "X1: pure target state, no back-compat." with no trigger (C38) [M-read R6].
  - The /connect/v1 agent door exists (API.md:357-367) [M-read].
  - Map F23 cites a target held in user memory: "transform once, then delete the transform".
  - Whether any out-of-repo consumer exists today: NOT-CLAIMED.
- **Alternatives:**
  1. (status quo) In place on /api/v1 per X1, with the trigger not exercised.
  2. In place, with the trigger removed as the HANDOVER.md:310 restatement reads.
  3. A new version (/api/v2) carries the grammar change.
  4. Both grammars accepted at the door for a period. Implies migration code persists for that period.
  5. other.
- **Recorded positions:** RULED (deviation accepted, date not measured here): X1 at COMMIT-DELIVERY.md:565, with its trigger. Restatement at HANDOVER.md:310 without it. Both stand in the record; no line reconciles them.
- **Under each frame:** The question reads the same under all frames; its scale differs, since FR2 and FR3 change the stored shape of every link (seeds S3 names "38 live diagrams change stored shape") in addition to any prefix.
- **What would separate the alternatives:** An inventory of consumers of /api/v1 and /connect/v1 outside this repository. Which of the two statements of X1 is current (a question for the director).
- **Intent bearing:** INTENT-SILENT. No Round-1 pick and no verbatim director statement bears on the delivery choice; the accepted axis AX6 names the risk class only.
- **Depends on / blocks:** Depends on: PS303, PS304 (F5). Blocks: PS327 (F23). Related (overlapping, not merged): PS128.
- **Evidence (defects/contradictions):** C38.

### PS306. Are anchor roles (endpoint, bend, junction) derived for every anchor, or only for waypoint-kind entities, and at which layer is each role a fact?
- **Track / layer:** seam ; anchor, pipe, link
- **Covers:** F16 (roles derived only for waypoints); map sections 3.3 (Roles) and 4.4 (kind gates)
- **The question:** The ruling says roles are what the graph makes of any anchor; the code derives roles, and admits collapse candidates, for the waypoint kind only. For which anchors are roles derived, and is each role a fact of one layer or of several?
- **Why it is open:**
  - DECISIONS.md:231-232 (2026-09-22): "Endpoint, bend and junction are not behaviours a node implements. They are what the GRAPH makes of an anchor at a given moment" [read for this register].
  - DECISIONS.md:331 (2026-09-22) gives a ruled example of a role on a node: "a ROUTER holding `framed`, `glyph` and `routable` derives `endpoint` from the one link terminating on it."
  - Code derives roles for waypoints only (kernel/engine.mjs:66-67; renderer.js:309), and the collapse admits only waypoints (txn.mjs:212) [S]. A node with three terminations gets no junction [M-read].
  - A node cannot be a via (validate.js:243) and cannot take a role (kernel/engine.mjs:66-71). The kernel junction() element is never emitted by resolve() (geometry.mjs:538).
  - The two renderers pass different incidence sets to waypointRoles (terminating links vs any role), and their output diverges on a valid document (D16) [M-run R2] (F6).
  - The two-termination pass-through is classified three ways: bend (ATOMICS.md:281), endpoint (waypointRoles), merge-eligible (collapse) (C1) [M-run].
- **Alternatives:**
  1. (status quo) Roles for waypoints only; nodes never derive a role.
  2. Roles for every anchor, with permission deciding which are allowed (map F16 option).
  3. Keep the derivation kind-gated until waypoint folds into node (map F16 option; the staged order at DECISIONS.md:191-195).
  4. Roles split across layers: bend a pipe-layer fact, endpoint and junction link-layer facts (the seeds' reading of the director's S6 leaning).
  5. other.
- **Recorded positions:**
  - RULED 2026-09-22: DECISIONS.md:231-240.
  - RULED 2026-09-19: the staged order, DECISIONS.md:191-195.
  - DIRECTOR LEANING 2026-09-25 (seeds S6, "for now", not a ruling): "if wires are between anchors, then a link can only occur between endpoints and junctions in this model. For now I would think wires meeting at an anchor join there - however - a junction is actually links meeting, rather than wires."
  - DIRECTOR statement 2026-09-25, labelled a leaning in seeds S15 and a requirement in envelope S1.Q3: "links are only ever between endpoints or junctions (or one to the other)."
- **Under each frame:**
  - FR0: a waypoint-only derivation over terminating links (map 3.3).
  - FR1: as FR0; a derived path layer that routes "across routed junctions/nodes" would read roles at nodes as well, if it consults roles.
  - FR2: bend = an anchor where exactly two pipes continue; endpoint and junction are derived at the link level; nodes are anchors, so roles reach them if the derivation reads anchors rather than kinds.
  - FR3: a pass-through is a cable that does not end at the anchor (seeds S16); endpoint and junction are facts about cable ends, and "bend" describes a cable's route rather than an anchor role.
  - Stages axis: under stages as capabilities each stage may contribute its own vocabulary at an anchor (seeds S12 observation: "router = link stage always cuts (restrict), path stage forwards/transit (extend)").
- **What would separate the alternatives:** At a node with three terminating links, does any consumer (appearance, forwarding, permission, arming) read "junction"? If one does, kind-gating withholds it. At a router with one link, does any consumer read "endpoint" (DECISIONS.md:331 says appearance does)?
- **Intent bearing:** Q1a (door parity) and Q1c (fewer concepts) bear. Q2c bears, since routing and behaviour (junction forwarding) are in reach. Director clarification (envelope S1.Q3): "have that path/flow - multihop across routed junctions/nodes - have a visual flow element along them." The S6 and S15 leanings above.
- **Depends on / blocks:** Depends on: PS301, PS302 (F1), PS201 (F6), PS117, PS211 (F7), PS205, PS207 (S6). Blocks: PS307, PS308 (F16, permission half), PS414, PS415 (F28), PS324-PS326 (F41), PS328 (G1). Related (overlapping, not merged): PS207.
- **Evidence (defects/contradictions):** C1, C2, C4, D16.

### PS307. If a type limits the roles its anchor may take, what is counted when a node carries several links?
- **Track / layer:** seam ; anchor, link
- **Covers:** F16 (the permission table versus multi-link nodes)
- **The question:** The ruled table says a server "permits endpoint alone" and that "a second link cannot be drawn to a server node"; locked parallel ports, straight-capacity rules and the four multiplicity relations let a node carry several links. What does a permission entry count, and is a second link to a single-homed node a refused variant?
- **Why it is open:**
  - DECISIONS.md:240: "A compute or server glyph permits endpoint alone." :253: "The cost is accepted: a second link cannot be drawn to a server node, and if that is ever legitimate the TABLE changes rather than the rule bending." [read for this register]
  - Parallel-link ports [LOCKED], two per node face (ATOMICS.md:106-115). B72/B80: at most one straight link per pair. straightCapacity is per unordered pair, ignores plane, direction and closed, and is "intended to become per-endpoint-kind" (invariants.mjs:24-42) [M-run R1 P5].
  - Today two undeclared terminations derive ['endpoint'] and two that both arrive or both depart derive ['junction'] (geometry.mjs:518-523; map 3.3) [M-run], so "endpoint alone" at a node with two links depends on declarations. Whether a second link is a refused variant depends on F7 (map F16).
  - Seeds S15 consequence C (open there): "A server with a two-member aggregate (one logical link) vs a server with two redundant links (two links): distinct logical links? distinct neighbours? member count? Interacts with 'server permits endpoint only'."
  - H15.7 (the table) is TODO (BOARD.md:816).
- **Alternatives:**
  1. (status quo) No table exists; any node accepts any number of links.
  2. Count terminating links: a server refuses a second (as ruled at :253).
  3. Count logical links: an aggregate counts once.
  4. Count distinct neighbours: parallel links to one peer count once.
  5. Count per plane: control and data are counted apart.
  6. Change the table so a server permits more than endpoint (the ruled escape at :253).
  7. other.
- **Recorded positions:**
  - RULED 2026-09-22: DECISIONS.md:237-253.
  - DIRECTOR REQUIREMENT 2026-09-25 (envelope S1.Q3; seeds S15): "we need to be able to model, construct and visualise all 4 of those in the table" (series, parallel/LAG, multiplex/VLAN, parallel links).
  - DIRECTOR statement 2026-09-25, labelled a leaning in seeds S15 and part of a requirement in envelope S1.Q3: "parallelism lives above/abstracted over wires."
  - Stated side by side, not resolved: the ruling "a second link cannot be drawn to a server node" and the requirement to construct parallel links and aggregates, which S15 consequence C places at a server.
- **Under each frame:**
  - FR0, FR1: the count is of stored links.
  - FR2: the count could be of pipes or of derived links; the seeds (S6c sub-question 1) note that "endpoint-only on a second wire" is a case a cut cannot express.
  - FR3: the count could be of pipes, cables, or logical constructs (a server may have one pipe carrying two cables).
- **What would separate the alternatives:** Two concrete cases: a server with a two-member aggregate to one switch, and a server with two redundant uplinks to two switches. Which does the table admit (a question for the director)? Does any other consumer (arming, forwarding, appearance) read the same count?
- **Intent bearing:** Q1b (expressiveness) and Q3a-Q3c (LAG and VLAN as nouns) bear. The director requirement and the S15 leaning above.
- **Depends on / blocks:** Depends on: PS117, PS211 (F7), PS215, PS216 (F13), PS111 (S15 consequence C), PS306 (F16, roles). Blocks: PS318 (F20, permission enforcement), PS324 (F41), PS308 (S6c). Related (overlapping, not merged): PS111.
- **Evidence (defects/contradictions):** none.

### PS308. If an anchor's behaviour is restricted, does the restriction act as a refusal, as an input to the derivation (a cut), or both?
- **Track / layer:** seam ; anchor, pipe, link
- **Covers:** S6c (its main question and sub-question 1, "honour vs refuse"); F16 (its option "refuse (ruled), or change the table")
- **The question:** The ruling says a router never bends and that a violation is refused in the validator. An inferred alternative reads "never bend" as "this anchor always cuts": two pipes at a router make two links meeting there, and nothing is refused. Which restrictions act by refusal, which by shaping what is derived, and which by both?
- **Why it is open:**
  - DECISIONS.md:239: "A router permits endpoint and junction but never bend: it is a thing the author placed, not a geometric artifact to be absorbed into a `via`." :251-252: "A violation is REFUSED, in the validator ... Not permitted-but-underived ... not permitted-with-escalation, which rewrites what the author placed." [read for this register]
  - DECISIONS.md:245: permission answers "not only 'may this collapse' but 'may a link land here at all'"; :260: the collapse "is now gated by permission as well".
  - Seeds S6c (inferred there): "Under derived links, absorption into a via is not an operation. 'Never bend' could instead mean 'a router anchor always CUTS'".
  - Seeds S6c sub-question 1: "restrictions the derivation can honour (never bend -> cut) vs ones it cannot (endpoint-only on a second wire -> still needs refusal)".
  - Seeds S6c (Claude, inferred): "Network fidelity points the same way (a router terminates each attached link)."
  - No table exists (H15.7 TODO, BOARD.md:816); the collapse gate is by kind only (txn.mjs:212) [S].
  - Whether a cut is the "permitted-with-escalation" that DECISIONS.md:252 rejects is not stated by the record: under FR2 a cut is a derivation and writes nothing; under FR0, FR1 and FR3 a cut would have to be written or authored [I].
- **Alternatives:**
  1. (status quo) No permission exists; every state is accepted.
  2. Refusal only, in the validator (as ruled 2026-09-22).
  3. Derivation input only: a restriction shapes what is derived and never refuses.
  4. Both: cut where the derivation can express the restriction (never bend), refuse where it cannot (endpoint alone on a second pipe); the seeds phrase it "cut for routers, refuse for single-homed servers".
  5. Tolerate, and derive a visible "unpermitted" condition (compare seeds S13's status-condition alternative; DECISIONS.md:252 rejects "permitted-but-underived").
  6. other.
- **Recorded positions:**
  - RULED 2026-09-22: DECISIONS.md:237-253 (refusal in the validator).
  - DIRECTOR LEANING 2026-09-25 (seeds S6c): "A router never bends - this would be a capability/behaviour restriction applied by the 'router node' pack to the anchor system on that node."
  - Side by side, not resolved: the leaning locates the restriction at the anchor through a pack and does not say refusal or cut; the ruling places a refusal in the validator.
- **Under each frame:**
  - FR0, FR1: a bend is a stored via entry or a collapse-eligible pair of links; "never bend" would mean refusing a via through a router (via already refuses nodes, validate.js:243) and refusing a collapse there. A cut has no carrier, since links are stored.
  - FR2: a link is a derived chain through continuing anchors, so "never bend" can be a cut rule inside the chain derivation; seeds S6a notes the cut rule must be computable below links.
  - FR3: cables are declared, so "never bend" at a router means a cable may not pass a router without ending there: either a refusal of the cable's route, or an automatic termination, which would be a write.
  - Stages axis: seeds S12 observation: one pack contributes to several stages, "router = link stage always cuts (restrict), path stage forwards/transit (extend)".
- **What would separate the alternatives:** For each permission (never bend; endpoint alone; junction allowed), ask per frame whether the derivation can represent the forbidden state as a different valid state (a cut is available) or cannot (refusal is then the remaining listed mechanism). Case: two pipes meet at a router. Under the cut reading, what does the author see, and is anything refused?
- **Intent bearing:** Q1a (door parity: one validator versus a derivation at every observer) and Q1d (extensible physics: a pack restricting anchor behaviour) bear; Q2c (routing inside the substrate) bears. The S6c leaning above; seeds S12 DIRECTOR LEANING: "packs can extend anchor behaviour too, not just restrict." Director statement (envelope S1.Q3): "We are building a full fidelity network system".
- **Depends on / blocks:** Depends on: PS117 (F7, S3), PS211 (F7), PS205, PS207 (S6; PS207 mutual), PS209 (S6a; mutual), PS103, PS104 (S12; PS104 mutual), PS109 (S16), PS306, PS307 (F16). Blocks: PS315 (F19), PS318 (F20, enforcement), PS324 (F41), PS309, PS310.
- **Evidence (defects/contradictions):** none (the table is unbuilt).

### PS309. If anchor behaviour is restricted, is the restriction read per composition type or per instance?
- **Track / layer:** seam ; anchor, behaviour
- **Covers:** S6c (sub-question 4)
- **The question:** The ruling places permission per type. Behaviour already attaches per instance in two shapes (spawn, content actions). Is a restriction read from the composition, from the instance, or from both?
- **Why it is open:**
  - DECISIONS.md:247-249 (2026-09-22): "PER TYPE, not per instance. All servers behave alike, and the table lives with the type definition ... Per-instance permission would be hidden state that nothing on screen shows." [read for this register]
  - DECISIONS.md:272-273: "asking what a server permits is asking which routing pack the server composition includes. One lookup, not two".
  - Per-instance configuration already exists: waypoint.spawn (validate.js:143-173) and node.content[].action (validate.js:135) [M-read]; DECISIONS.md:186-189 calls stored per-capability state "a different and more expensive class, and none is proposed" (F29, F30).
  - Retype changes one instance's type at every door as one undoable set [M-run G3], so a per-type rule meets per-instance change (PS324).
  - The type vocabulary is open at the validator (validate.js:180) [M-run R5] (F2).
- **Alternatives:**
  1. (status quo) Neither: no permission exists.
  2. Per composition type only (as ruled).
  3. Per instance only (a declared per-entity restriction).
  4. Per type, with per-instance overrides.
  5. Per attachment scope (anchor, pipe, link, declaration), under stages as capabilities (seeds S12 lists "multiple attachment scopes").
  6. other.
- **Recorded positions:** RULED 2026-09-22: DECISIONS.md:247-249. The seeds record the sub-question with "(ruled: per TYPE)". DIRECTOR LEANING 2026-09-25 (seeds S6c) names "the 'router node' pack"; it does not state type or instance.
- **Under each frame:** The question reads the same under all frames. The stages axis matters: under stages as capabilities, restrictions may attach at scopes other than a node (seeds S12: "multiple attachment scopes (anchor, wire, whole graph, declaration)").
- **What would separate the alternatives:** Is there a network case where two instances of one composition route differently (a transit router versus a terminating router)? If one exists, per type expresses it only through a second composition. Is the difference visible on screen (the ruling's stated reason at :249)?
- **Intent bearing:** Q1b (expressiveness) and Q1d (extensible physics) bear. Director statement: "We are building a full fidelity network system" (envelope S1.Q3). The S6c leaning above.
- **Depends on / blocks:** Depends on: PS401, PS402 (F2), PS409, PS418 (F30), PS308 (S6c). Blocks: PS417 (F29), PS324 (F41).
- **Evidence (defects/contradictions):** none.

### PS310. Is what an anchor does only ever narrowed by what the entity is, or can it also be extended, and through what?
- **Track / layer:** seam ; anchor, behaviour, path, flow
- **Covers:** S6c (sub-question 3)
- **The question:** The ruled table only narrows the variants an anchor produces. A director leaning (seeds S12) says packs can extend anchor behaviour too, and the seeds give examples: a router forwarding flows, a load balancer fanning one out. Is behaviour at an anchor only ever narrowed by removing variants, or can something add behaviour the bare anchor lacks, and if so, what adds it?
- **Why it is open:**
  - DECISIONS.md:237-238: "A type DECLARES which variants it permits ... A bare waypoint permits all three, which is what makes it 'just an anchor' -- it is the unrestricted case" [read for this register]. The ruled form is restriction.
  - DECISIONS.md:268: a server is "`glyph(server)` plus a routing pack plus, eventually, what it does with packets."
  - Junction forwarding (clone, round robin, route) is designed and unbuilt (ATOMICS.md:340-349); ATOMICS.md:353-354 uses "routing capability" for forwarding; map F27: `routable` (topology, permission, write) and forwarding "are not reconciled".
  - Behaviour is gated by kind in 34 places across 17 files and by type through TOWERS (map 2.1, 2.2) [M-read R5].
  - Seeds S6c sub-question 3: "whether packs only RESTRICT anchor behaviour or can also EXTEND it (e.g. a router forwarding flows, a load balancer fanning one out)".
- **Alternatives:**
  1. (status quo) Neither mechanism exists; behaviour is gated by kind and by per-type code tables.
  2. Restrict only; extensions live elsewhere (a separate forwarding family, or engine code).
  3. Restrict and extend through one contribution mechanism.
  4. Extensions arrive as stages rather than as anchor contributions (stages as capabilities).
  5. other.
- **Recorded positions:**
  - RULED 2026-09-22: the restriction form (DECISIONS.md:237-238); the ruling does not address extension.
  - DIRECTOR LEANING 2026-09-25 (seeds S12): "packs can extend anchor behaviour too, not just restrict."
  - Scope boundary: policy is out (envelope AG-1; DECISIONS.md:281-284, "Not designed, not ruled, and not to be assumed"). Whether a given extension (fan-out, forwarding) is policy is not stated in the record [I].
- **Under each frame:**
  - FR0: no carrier for either.
  - FR1: an extension would act at the path or flow layer (forwarding a flow through a node).
  - FR2, FR3: with two routing layers (recorded in the seeds as AGREED by the director, 2026-09-25: "links through pipes, and paths over links"), an extension could act at either layer.
  - Stages axis: under fixed stages, extensions plug into the fixed stack; under stages as capabilities, an extension could itself be a stage.
- **What would separate the alternatives:** Name one extension (forwarding at a router; fan-out at a load balancer) and ask whether it can be written as the removal of variants from a larger base set. If it cannot, restriction-only does not express it. Does the extension need stored state or a clock (it would then meet the derived and stateless ruling at DECISIONS.md:278-279)?
- **Intent bearing:** Q1d (extensible physics) and Q2c (behaviour and events inside the substrate, policy outside) bear. Director clarification (envelope S1.Q3): "declare a path or flow ... multihop across routed junctions/nodes". The S12 leaning above; "We are building a full fidelity network system".
- **Depends on / blocks:** Depends on: PS103, PS104 (S12), PS411-PS413 (F27; mutual), PS308 (S6c, refusal or cut), PS306. Blocks: PS411-PS413 (F27; mutual), PS409, PS418 (F30), PS311. Related (overlapping, not merged): PS104, PS125.
- **Evidence (defects/contradictions):** none.

### PS311. If more than one source restricts or extends one anchor, how do they combine, and can that case arise?
- **Track / layer:** seam ; anchor, appearance, behaviour
- **Covers:** S6c (sub-question 2)
- **The question:** If more than one contribution restricts or extends an anchor, is the result an intersection, a union, a precedence order, or something else, and does the ruled "one lookup" leave room for two contributions at all?
- **Why it is open:**
  - DECISIONS.md:272-273 (2026-09-22): "asking what a server permits is asking which routing pack the server composition includes. One lookup, not two, and no per-type row free to drift into its own opinion." One reading is one routing pack per composition [I].
  - A combination rule is ruled for derived appearance only: `composes` and a priority, declared per derived state (DECISIONS.md:324-329, :357-368, ruled 2026-09-22), unbuilt [V]. The priority representation (integer versus ordered named layers) is "Not ruled" (DECISIONS.md:352-355).
  - HANDOVER.md:182 asks the write analogue: "If two packs both want to write, who goes first?" (PS316).
  - Seeds S6c sub-question 2: "how two packs' restrictions combine on one anchor (intersection? precedence?)".
- **Alternatives:**
  1. (status quo) No contributions exist, so nothing combines.
  2. Exactly one routing contribution per composition, so combination cannot arise.
  3. Restrictions intersect: the most restrictive holds.
  4. A precedence order (ordered named layers, or an integer priority).
  5. Per-state resolution in the shape ruled for appearance (composes and priority).
  6. Conflicting contributions refused when a composition is defined.
  7. other.
- **Recorded positions:** RULED 2026-09-22: appearance resolution (DECISIONS.md:324-368), which is for appearance, not permission. RULED 2026-09-22: "One lookup, not two" (:272-273). No position on combining permission or behaviour contributions.
- **Under each frame:** The question reads the same under all frames. Stages axis: under stages as capabilities, contributions from different stages meet at one anchor, and seeds S12 lists "stage dependencies and stratified evaluation order" among what that option demands.
- **What would separate the alternatives:** Is there a composition that needs two routing contributions (for example, a device that is both a router and a load balancer)? If none exists, alternative 2 covers every known case; if one does, alternatives 3-6 remain open.
- **Intent bearing:** Q1c (fewer concepts) and Q1d (extensible physics) bear. The S6c and S12 leanings (PS308, PS310).
- **Depends on / blocks:** Depends on: PS308, PS310 (S6c, restrict or extend). Blocks: PS424, PS425 (F34), PS316 (F40, ordering).
- **Evidence (defects/contradictions):** C20.

### PS312. Do the bend conversions (split and collapse) remain derived writes, become derivations, or become authored operations?
- **Track / layer:** frame ; writes, link, pipe
- **Covers:** F17 (what kind of thing the two built writes are, read across frames); envelope S0 verification note
- **The question:** Today the split (browser-only) and the collapse (planner-only) convert between two stored encodings of one bend. Under FR2 they may stop being writes; under FR3 they may return as authored operations on declared cables. Which kind of thing is each conversion?
- **Why it is open:**
  - Envelope S0 (verification, 2026-09-25): "the collapse is already a shipped 'pure proposal, planner applies' write, the split exists at the browser door only and drops `flow`, `control` and the name".
  - Collapse: collapseAtWaypoint is pure (invariants.mjs:152-192); plan() applies it on link DELETE only (txn.mjs:207-262) [V].
  - Split: splitAtBend is pure (invariants.mjs:194-202); it is called only from the browser, via commitRoute and splitsFor (input.js:984-1033), and drops flow, control and name [V].
  - One drawing has two stored encodings, and which one a document holds depends on history [M-run R7; R1 P7] (map 3.4).
  - DECISIONS.md:217: "The split is the first capability that mutates the document". DECISIONS.md:233 says deleting a link "makes it a bend with nothing reconfigured", while the collapse reconfigures the document (C25).
  - Seeds S3 (Claude, inferred): under stored pipes, "split/collapse become derivations". Seeds S16 qualifies it: this "holds only if a link is a DERIVED CHAIN of wires. If a link is a CABLE (declared, own identity), split returns as 'does the passing cable terminate here?' (an authored choice) and collapse as 'splice two cables' (authored)."
- **Alternatives:**
  1. (status quo) Both are derived writes with pure proposers: the collapse applied by the planner on deletion, the split built by the browser as requested ops.
  2. Both stay derived writes, computed at one site for every door (PS314).
  3. Both become derivations with no write: the store holds one encoding and the link is derived (FR2).
  4. Both become authored operations on declared entities: terminate a cable here, splice two cables (FR3).
  5. Mixed: one derived, one authored (for example, split authored at creation, collapse derived on removal).
  6. other.
- **Recorded positions:**
  - RULED 2026-09-22: DECISIONS.md:255, `routable` owns "the permission table, the derivation, and the write"; :259-260, "Still not designed: how a pack contributes a write."
  - Record [BUILT]: ATOMICS.md:159-167, the collapse "lives in the server planner ... One rule, one place, every door." [read for this register]
  - HYPOTHESIS (HANDOVER.md:194-205, 2026-09-24): "a pack never writes, it PROPOSES"; "It is not settled, but the code leans that way"; "Test it in design rather than assume it either way."
  - DIRECTOR STATEMENT, 2026-09-25 (seeds S16, the FR3 description): "'wires' more accurately represent physical pipes/conduits through which 'links' can run - so 'links' are probably equivalent to 'cables' in the real world networking".
  - DIRECTOR statement 2026-09-25, labelled a leaning in seeds S15 and a requirement in envelope S1.Q3: "drawing a new link to a bend converts it to a junction (current behaviour)." The seeds' measured nuance: "'current behaviour' holds at the BROWSER door only".
- **Under each frame:**
  - FR0: both are writes, and F17-F21 apply as the map states them.
  - FR1: as FR0; a derived path layer above links either treats the two encodings of one bend alike or reads them as different.
  - FR2: no second encoding is stored, so split and collapse are not operations; cut and propagation rules become derivation inputs (seeds S6a).
  - FR3: "a new link to a bend" becomes "does the passing cable terminate here?" (seeds S16), an authored choice at the gesture or the CLI; splice is authored.
  - Stages axis: seeds S12 names a "materialize DOWN (authoring ...)" direction per stage; FR3's authored operations would sit there.
- **What would separate the alternatives:** Does anything attach to a unit smaller than a run (the seeds' S1 discriminator)? When an author deletes one of three links at a junction, is the expected result two links meeting (a derived role) or one link bending (a collapse)? Under FR3, who decides whether a passing cable terminates, the author at the gesture or a rule (seeds S16 lists this as a Round-2 candidate)?
- **Intent bearing:** Q1a (door parity), Q1c (fewer concepts) and Q3c (derived) bear. Envelope S1.Q3 director requirement: "drawing a new link to a bend converts it to a junction (current behaviour)." Seeds S5 DIRECTOR: "Using the w key to create a link with bends might also construct wires between the anchors under the hood mechanically." Seeds S16 DIRECTOR: "'wires' more accurately represent physical pipes/conduits through which 'links' can run - so 'links' are probably equivalent to 'cables' in the real world networking."
- **Depends on / blocks:** Depends on: PS106 (S1), PS117 (S3, F7), PS211 (F7), PS109 (S16), PS205, PS212 (F8). Blocks: PS313 (F17), PS314 (F18), PS315 (F19), PS320, PS321 (F21), PS322 (F22), PS316 (F40). Related (overlapping, not merged): PS117.
- **Evidence (defects/contradictions):** C3, C5, C25, D2, D4, D41.

### PS313. Does anything other than an author's literal op change the document, and if so, what does it return, who applies it, and how does the result reach validation and undo?
- **Track / layer:** seam ; writes
- **Covers:** F17 (the open write questions of HANDOVER.md:179-183, except ordering, which is PS316)
- **The question:** A contribution that changes the document could return ops, a whole document, or a request (an intent op); it could apply its own write, hand it to the planner, or never write. Where is it validated relative to when it is computed, and how does it reach undo?
- **Why it is open:**
  - HANDOVER.md:179-183 (2026-09-24): "what does a pack RETURN, an op list or a whole document or a request? Who APPLIES it, the pack or the server's planner or something between? Where does VALIDATION happen, before or after the pack has spoken? If two packs both want to write, who goes first? How does the result reach undo history?" [read for this register]
  - An engine rule "may not write" (engine/rules.mjs:32-34, "Ruled 2026-09-01", recorded only in that comment, C37) [read for this register].
  - W7 RULED 2026-09-04: "the op carries INTENT, and the server resolves it" (WRITES.md:253-258).
  - Code shapes already present (map F17) [M-read]: pure builders applied by the planner (collapseAtWaypoint, groupAfterRemoval, resolveAnchor); a pure builder applied by the client (splitAtBend feeding routeLink); run-mode rules that commit commands (toggleSpawn, createEntity; input.js:606-607, 642-644); one unapplied local write (the pin clear, input.js:938).
  - HANDOVER.md:204: the proposer shape does not settle "whether the derivation can stay pure once it must know which half keeps the original id"; the split's id rule is stated two ways (C5).
  - The B181 flood's write path was the spawn toggle, and its trigger was never identified (map F17, R4).
- **Alternatives:**
  1. (status quo) Several shapes coexist: planner-applied pure builders, a client-applied pure builder, run-mode rules that commit commands, and one local write never sent.
  2. Propose: a contribution returns ops and the planner applies them (map F17 option).
  3. A contribution applies its own write.
  4. A contribution emits an intent op that planOne resolves (the W7 shape).
  5. Contributions stay read-only, and writes stay with authored intent (the rules.mjs:32-34 boundary extended to packs).
  6. other.
- **Recorded positions:**
  - RULED 2026-09-22 as open: DECISIONS.md:259-260.
  - RULED 2026-09-01 (code comment only): engine/rules.mjs:32-34, "Mutation stays with player intent."
  - RULED 2026-09-04: W7 (WRITES.md:253).
  - HYPOTHESIS (HANDOVER.md:194-205, 2026-09-24): the propose frame, "Test it in design rather than assume it either way."
- **Under each frame:**
  - FR0, FR1: split and collapse are the cases, beside cascade, steal, sweep, place and the pin clear.
  - FR2: the bend conversions stop being writes (PS312); what remains is authored ops, cascades, the sweep, and any authoring compile (PS314).
  - FR3: terminate and splice are authored; cascades and the sweep remain; maintaining LAG and VLAN constructs could add derived writes.
  - Stages axis: under stages as capabilities each stage may carry a materialize-DOWN write (seeds S12), so the question is asked once per stage.
- **What would separate the alternatives:** List every write that is not an author's literal op (cascade, steal, sweep, collapse, split, place, pin clear, spawn toggle) and mark, per frame, which survive. If every survivor is a planner pass, the question narrows to planner passes. Does any surviving contribution need to decide identity lineage (which piece keeps an id)?
- **Intent bearing:** Q2c bears: the envelope reads the pick as extending reach "to writes (split, collapse, cascades)". Q1a (door parity) and Q1d (a new capability without an engine change) bear. Seeds S14 DIRECTOR: "Agree that derivations flow up - but a link, path or flow config would need to have some entity persisted into the document (minimal entity/spec) such that the derivation can actually occur."
- **Depends on / blocks:** Depends on: PS403-PS405 (F3), PS312 (F17, frame reading). Blocks: PS314 (F18), PS315 (F19), PS317-PS319 (F20), PS322 (F22), PS323 (F24), PS422 (F32), PS501 (F39), PS316 (F40), PS324-PS326 (F41).
- **Evidence (defects/contradictions):** C5, C37, D5.

### PS314. Is an authored connection expanded into different stored writes (including any split), and if so where, and by one function for every door?
- **Track / layer:** seam ; writes, link, pipe
- **Covers:** F18; S5 (the "where does the authoring compiler live" half, whose open item reads: "is the compiler a client helper, a planner pass, or a declared op kind the server expands?"). Assembly merge: the frame entry drafted for the same S5 item (formerly PS119, "If an authored verb compiles to a different stored form, where is the compile step computed?") asked the same question; its evidence, alternatives, positions, frame readings and tests are carried here.
- **The question:** The browser splits when a route lands on a bend; the CLI mints a waypoint per cell and never splits; REST creates straight links only; the collapse runs in the planner. Where is each routable write and each authoring expansion computed: a client helper, a planner pass, a declared op kind the server expands, or a shared pure function? Given PS118 alternative 3 or 4 (a verb that compiles to a different stored form), how does every door reach the same result?
- **Why it is open:**
  - The split is browser-only and client-proposed; the collapse is planner-only [V].
  - Non-browser paths never split: chainHop and chainThroughNode (input.js:1420-1442), CLI link, REST /links and /commit, add/place --link [M-run R1 P13b, R3] (map F8; C3).
  - CLI `link --via` takes cells, mints waypoints, and cannot thread an existing waypoint (verbs.mjs:1880, 1908-1916); REST POST /links is straight-only (rest.js:196) [M-read].
  - A server-expanded intent already exists: the `place` intent op, resolved by planOne against the advancing projection (txn.mjs:308-312; server/anchor.mjs:103-148; W7). The CLI emits it only when drafting and otherwise resolves locally (verbs.mjs:1210-1212), through a twin with a different distance formula (map s4.5) [M-read].
  - Planner passes already exist: cascade, sweep and collapse (txn.mjs:95-262). Their client projections differ: the cascade and steal are mirrored, while the sweep and collapse arrive only through the key-filtered ack diff (sync.js:409-416) [S]. That diff drops a derived op whose key matches a client-sent op (D3, D44) [M-run].
  - TRANSACTIONS D12 [LOCKED]: "The server computes the cascade; the browser sends intent" (TRANSACTIONS.md:344). D16 [LOCKED]: "The planner is server-only, because *authority* is what must not be duplicated." (:393) [read for this register]
  - ATOMICS.md:166-167 on the collapse: "One rule, one place, every door." ATOMICS.md:222-223: "the REST and CLI doors write documents directly".
  - W7 (2026-09-04): `cli/` "takes no dependency on `model/`" (WRITES.md:259). HANDOVER.md:351: for the CLI, "a local projection would mean a second implementation of the model".
  - H15.2 (TODO, BOARD.md:812) proposes sharing collapseAtWaypoint with the client; B221 is open.
  - The write question is recorded as not designed (DECISIONS.md:259-260) and as not deferrable (HANDOVER.md:185-187, 2026-09-24) (F17, F39).
  - Seeds S5, open there: "is the compiler a client helper, a planner pass, or a declared op kind the server expands?"
- **Alternatives:**
  1. (status quo) Door-specific expansion: browser commitRoute threads and splits; the CLI mints per cell; REST is straight-only; the planner adds its own derived passes (the collapse).
  2. A planner pass: the planner derives the split as it derives the collapse, or expands a higher-level op at the server as `place` is expanded (map F18 option; S5 "a planner pass").
  3. A client helper: the client proposes and the planner validates (today's split, generalised; S5 "a client helper"). The CLI, as a client, would also hold the helper, which W7 (WRITES.md:259) bears on.
  4. A shared pure proposer or compile function imported by every door, whose result is sent as ordinary ops (map F18 option); the CLI would import it, which W7's standalone-CLI ruling (WRITES.md:259) bears on.
  5. A declared op kind (for example "route this link through these cells") that planOne expands, and that the client projects with the same pure function (the shape of W7's `place` intent op; S5 "a declared op kind the server expands").
  6. No compile step (PS118 alternative 2 or 4: the verb is what is stored).
  7. other.
- **Recorded positions:**
  - RULED [LOCKED]: D12 and D16 (TRANSACTIONS.md:344, 388-393; lock date not carried).
  - RULED 2026-09-04: W7 (WRITES.md:253-259): an intent op is resolved in planOne.
  - RULED 2026-09-22 (DECISIONS.md:259-260): how a pack contributes a write is "Still not designed".
  - Record [BUILT]: ATOMICS.md:159-167.
  - TODO: H15.2 (BOARD.md:812).
  - DIRECTOR statement 2026-09-25 (seeds S5), worded as a possibility: "Using the w key to create a link with bends might also construct wires between the anchors under the hood mechanically."
  - none on the compile step's location itself.
- **Under each frame:**
  - FR0, FR1: the expansion is gesture -> links + waypoints (+ split).
  - FR2: the expansion is gesture -> pipes, and links derive; the seeds (S5) infer that "a new route landing on a bend" then "stops being a special write".
  - FR3: the expansion is gesture -> a cable declaration, its route through pipes (perhaps a pipe sequence), and any new pipes; whether a crossing cable terminates is an authored choice (seeds S16).
  - The location question reads the same under all four frames; what the expansion yields differs.
  - Stages axis: under stages as capabilities each stage may carry its own compile (seeds S12 "materialize DOWN"), so a location rule applies per stage.
- **What would separate the alternatives:** A parity test: one authored intent (a link from a through three cells, one of which is another link's bend) sent through the browser, the CLI, REST and /commit. Does every door store the same result? Can the CLI reach the expansion without importing `model/`, and can an agent at REST or the CLI compute the result without a local model (map s5 re-route row: "the originator is REST or CLI, with no local model")? Does the expansion need the advancing projection, as `place` does (WRITES.md:248-289), or only the request?
- **Intent bearing:** Q1a bears (AX2: "Browser, server, CLI and REST compute the same thing; no rule lives at one door"); Q2c bears (writes in the substrate); Q3 c bears (derived results computed by every viewer). The S5 statement above. Envelope S1.Q3 director requirement: "drawing a new link to a bend converts it to a junction (current behaviour)." On the location itself no pick or statement speaks.
- **Depends on / blocks:** Depends on: PS117, PS211 (F7), PS205, PS212 (F8), PS312, PS313 (F17), PS116 (S4), PS118 (S5), PS103 (S12). Blocks: PS315 (F19), PS320, PS321 (F21), PS322 (F22), PS316 (F40).
- **Evidence (defects/contradictions):** C3, C5, C6, C24, D2, D3, D4, D44.

### PS315. What triggers the collapse: a link-delete op, the resulting state, a genuine loss, or nothing?
- **Track / layer:** seam ; writes, link
- **Covers:** F19
- **The question:** The collapse reacts to `del link` ops from the request and the cascade; creation keeps a two-link terminus; replug and set-via never trigger it. Is the trigger an op, a state, a genuine loss, the author, or nothing at all?
- **Why it is open:**
  - ATOMICS.md:164-165: "It reacts to a link being REMOVED, never to one being added ... scoping it to any touched link collapsed two links into a bend the moment the second was drawn, so a two-link terminus could not be built at all." [read for this register]
  - The planner reads `del link` ops with op.entity, falling back to model.get (txn.mjs:199-213) [S]; `touched` is fixed once (:207-213), and no planner del carries entity (:210) [M-read G1].
  - A split's own `del X` + `put X` counts as a loss, and collapsed an unrelated authored terminus [M-run R3] (D2).
  - A replug away from a junction triggers nothing (map F19).
  - A link that only threads a junction blocks a later collapse there: the collapse counts links of any role (txn.mjs:216) but merges only terminations (invariants.mjs:155-158) [M-run G3]. Whether that is a defect is NOT-CLAIMED.
  - A `set via` re-route reaches the sweep but never the collapse [M-run G3].
  - DECISIONS.md:233: deleting a link "makes it a bend with nothing reconfigured" (C25).
- **Alternatives:**
  1. (status quo) `del link` ops (request and cascade), read against the pre-transaction link.
  2. State-triggered: any transaction that leaves an eligible two-link waypoint collapses it. Implies a two-link terminus cannot be built (ATOMICS.md:164-165 records this as why removal-only was chosen).
  3. Genuine loss only: distinguish `del` + re-`put` of one id, and include replug and set-via. Implies the planner distinguishes a re-put from a loss, which it cannot do today (map 7.2 re-put / lineage).
  4. No automatic collapse; derive the bend role instead (map F19 option). Implies both stored encodings of a bend persist (PS117).
  5. Author-triggered: splice as an authored operation (FR3).
  6. other.
- **Recorded positions:** Record [BUILT]: ATOMICS.md:159-167 (removal-only). DECISIONS.md:260 (2026-09-22): the collapse "is now gated by permission as well". No position on replug, set-via or re-put.
- **Under each frame:**
  - FR0, FR1: as stated.
  - FR2: no collapse exists (PS312), so there is no trigger to choose.
  - FR3: splice is authored, so the trigger is the author.
- **What would separate the alternatives:** A case matrix at one waypoint W: delete, replug away, set-via away, `del` + re-`put` of the same id, split. For each, does the author expect the remaining pair at W to become one link? If the expected outcome differs between paths that reach the same state, the trigger is an event; if it does not, the trigger is a state.
- **Intent bearing:** INTENT-SILENT on what triggers a collapse. Q1a bears only on the reach of whatever trigger is chosen.
- **Depends on / blocks:** Depends on: PS117, PS211 (F7), PS312, PS313 (F17), PS314 (F18). Blocks: PS317-PS319 (F20), PS320, PS321 (F21), PS316 (F40).
- **Evidence (defects/contradictions):** C25, D2, D41.

### PS316. How do derived writes compose and order within one transaction, and does a write re-enter later passes?
- **Track / layer:** seam ; writes
- **Covers:** F40; F17 (its ordering question, "If two packs both want to write, who goes first?")
- **The question:** Requested ops advance the planner's projection one op at a time; the sweep and the collapse each compute all their writes against one projection and apply them once, in a fixed order, and the sweep does not run again after the collapse. How do several derived writes in one transaction compose, in what order do writing passes or contributions run, and does a write feed later passes?
- **Why it is open:**
  - Mechanism (map 4.3) [M-read G1; S]: per-op advance for requested ops (txn.mjs:88-94, justified at :296-306); the sweep over one projection (:161-177); the collapse over one projection (:214-262); fixed order request + cascade -> sweep -> collapse -> refusal [V]; no sweep after the collapse.
  - D41's four forms and P8 [M-run G1]. The map's rates describe G1's generators, not real documents.
  - A stale op on a missing id is silent (model.mjs:111-114, :119-121); applyOps throws only for an unknown op name (ops.mjs:45-48), although its comment says it throws rather than no-op (C47).
  - Option (b), advancing after each merge, gives one link on P1-P3, keeps C on P8, and yields 12 validateDoc-refused results in chain seed 1 (D1) [M-run G1; the loop is G1's code, not repo code].
  - Option (c), a fixpoint, matched (b) in the sampled spaces; it could differ only after a D1 self-conflict merge, which is unmeasured.
  - A partial guard (throw on a set or del whose id is gone) catches forms (a) and (c) only: in chain seed 1, 868 of the 1603 connectivity-breaking transactions had no op targeting a missing id [M-run G1].
  - No record states a composition rule; ATOMICS.md:159-167 and txn.mjs:179-205 each describe one waypoint.
  - HANDOVER.md:182: "If two packs both want to write, who goes first?"
- **Alternatives:**
  1. (status quo) (a) one pass per derived stage over an unadvanced projection, in a fixed stage order, with no re-entry.
  2. (b) advance the projection after each derived write.
  3. (c) iterate to a fixpoint, feeding derived deletes back into the trigger set.
  4. A declared order among writing contributions (ordered named layers, or an integer priority; see the caution at DECISIONS.md:352-355, stated there for appearance).
  5. At most one derived write per anchor per transaction; a second is refused.
  6. Composition of derived link writes does not arise because none remain (FR2 derivations, FR3 authored operations); cascades and the sweep still compose.
  7. other.
- **Recorded positions:** No position on composing derived writes (map F40: "The record states no composition rule"). The per-op advance for requested ops is recorded with W7 (WRITES.md:261-263). The integer-priority caution is recorded for appearance, "Not ruled" (DECISIONS.md:352-355).
- **Under each frame:**
  - FR0, FR1: the sweep, the collapse and the cascades compose.
  - FR2: the collapse is gone; cascades on anchor delete and any sweep of unreferenced anchors remain.
  - FR3: a cascade on anchor delete reaches pipes and the cables routed through them; maintaining LAG and VLAN constructs could add passes.
  - Stages axis: seeds S12 says stages as capabilities demand "stage dependencies and stratified evaluation order" for derivations; this entry is the write analogue.
- **What would separate the alternatives:** A planner test with two collapse candidates that share a link (none exists: each collapse test in tests/txn.test.js names one waypoint, by G1's text scan). The unmeasured fixpoint-versus-advance difference after a self-conflict merge. Whether any writing pass in the target frame can invalidate another pass's input (if none can, alternatives 1-3 give the same result [I]).
- **Intent bearing:** Q1d bears (a new writing capability arriving without an engine change meets whatever composition rule exists [I]), and Q1a bears (every door reaches plan()). No verbatim director statement addresses composition.
- **Depends on / blocks:** Depends on: PS313 (F17), PS315 (F19), PS311 (S6c, combination). Blocks: PS317-PS319 (F20), PS320, PS321 (F21).
- **Evidence (defects/contradictions):** C47, D1, D41.

### PS317. What validation does a derived write receive?
- **Track / layer:** seam ; writes
- **Covers:** F20 (validation depth of derived writes; D1, D42)
- **The question:** Requested ops pass validateMutation, including the referential refusals; derived ops (cascade, steal, sweep, collapse) pass only introduced violations(). Two derived writes have committed documents that validateDoc refuses. What validation does a derived write receive, and where do the refusals it can breach live?
- **Why it is open:**
  - Requested ops: validateMutation per op + introduced violations(); derived ops: violations() only [V] (map 4.3 table).
  - The referential refusals are deliberately outside violations() (referential.mjs:23-29); groupReferential is outside it in the same way (referential.mjs:149-156) [M-read G2].
  - D1: the collapse commits documents validateDoc refuses [M-run R1 P14/P15, R3]; a node delete reaches it [M-run G3].
  - D42: the sweep leaves dead ids in group.members; validateDoc refuses the result; the file is skipped at boot, and when it is the only diagram the server refuses to boot [M-run G2].
  - B85 in violations() counts listed members, so a dangling member is invisible to it (invariants.mjs:249-258) (C46) [M-run G2].
  - planDel trims containers inside trimGroupsHolding (txn.mjs:406-418); the sweep has no such closure (txn.mjs:161-176).
  - Coverage: no multi-merge test; the GR5 differential corpus draws groups from nodes only (tests/diff-plan.test.js:40-44); the sweep tests have no group case (tests/txn.test.js:418-560) [M-read G2].
  - The TRANSACTIONS contract lists plan() without the sweep and the collapse (C24).
- **Alternatives:**
  1. (status quo) Derived ops: introduced violations() only.
  2. Run validateMutation, linkReferential and groupReferential over derived ops.
  3. Move the referential refusals (link and group) into violations().
  4. Prove each derivation invariant-preserving and guard it by test (no multi-merge or grouped-sweep test exists today).
  5. Run validateDoc over the whole post-transaction document.
  6. other.
- **Recorded positions:** Code-recorded design choice, date not measured: referential.mjs:23-29 keeps the refusals out of violations(). RULED (director, 2026-08-28, BACKLOG.md:224 B162): "an unreferenced waypoint self-destructs, wherever that state arises." No position on derived-write validation depth.
- **Under each frame:**
  - FR0, FR1: as stated.
  - FR2: D1's collapse path does not exist; cascades and any sweep remain derived.
  - FR3: terminate and splice are authored and receive request validation; cascades over pipes and cables remain derived.
- **What would separate the alternatives:** Run validateDoc after every plan() over a corpus that includes grouped bends and multi-merge chains, and count refusals per derived pass. The per-transaction cost of full validation is NOT-CLAIMED and could be measured.
- **Intent bearing:** INTENT-SILENT on validation depth. Q1a (door parity) bears only on reach, since derived writes reach every door through plan().
- **Depends on / blocks:** Depends on: PS406-PS408 (F4), PS313 (F17), PS315 (F19), PS316 (F40). Blocks: PS318, PS319 (F20), PS320, PS321 (F21), PS327 (F23), PS324-PS326 (F41).
- **Evidence (defects/contradictions):** C24, C46, D1, D42.

### PS318. If anchors carry restrictions, where are they enforced?
- **Track / layer:** seam ; writes, anchor
- **Covers:** F20 (where permission is enforced); F16 (enforcement "in the validator" while derived ops skip validateMutation); S6c (the enforcement side)
- **The question:** The ruling places permission in the validator beside the refusals and makes it gate the collapse. The validator's referential step never sees a node write (retype), violations() refuses only introduced states, and derived ops skip validateMutation. Where would a restriction be checked so that every write path able to create a forbidden state meets it?
- **Why it is open:**
  - DECISIONS.md:251: "A violation is REFUSED, in the validator, where the permission table belongs beside the rules that already refuse illegal states." :260: the collapse "is now gated by permission as well".
  - validateMutation runs referential checks for link and group kinds only (validate.js:351-362), so a check beside linkReferential never sees a retype [M-read G3].
  - violations() refuses only INTRODUCED violations (txn.mjs:276-287), so a loaded document already in a forbidden state is tolerated [M-read G3]; install reports violations and never refuses (store.js:663-667).
  - Derived ops skip validateMutation [V] (PS317).
  - H15.7 (TODO, BOARD.md:816): "a composition declares which anchor variants it permits, and the validator refuses the rest".
  - Under the cut reading (PS308), some restrictions are enforced by the derivation itself, at every observer, with no validator involved [I].
- **Alternatives:**
  1. (status quo) Nowhere; no table exists.
  2. In the validator per mutation (as ruled), extended to node writes.
  3. In violations() (introduced-only, every transaction including derived ops).
  4. In a routable pack consulted by the planner (map F20 option).
  5. In the derivation (cuts), with a refusal only where a cut cannot express the restriction (PS308 option 4).
  6. In whole-document validation (validateDoc on load, install, undo and redo).
  7. other.
- **Recorded positions:**
  - RULED 2026-09-22: DECISIONS.md:251-253, :260.
  - TODO: H15.7 (BOARD.md:816).
  - DIRECTOR LEANING 2026-09-25 (seeds S6c): the restriction is "applied by the 'router node' pack to the anchor system on that node". Side by side, not resolved: the leaning locates it at the anchor, the ruling in the validator.
- **Under each frame:**
  - FR0, FR1: validator, violations() or planner.
  - FR2: derivation-time cuts, plus a refusal of pipe sets a cut cannot express.
  - FR3: refusal of cable routes or terminations; cuts are unavailable for declared cables.
  - Stages axis: under stages as capabilities, a restriction contributed to one stage is enforced wherever that stage runs, which is every observer if the stage derives.
- **What would separate the alternatives:** List the write paths that can create a forbidden state (create link, set via, replug, retype, collapse, split, load, install, undo, redo) and mark which candidate location each path passes through. A location that some path bypasses leaves the ruled "refused" property unmet on that path.
- **Intent bearing:** Q1a bears (AX2: "no rule lives at one door"). The S6c leaning above.
- **Depends on / blocks:** Depends on: PS306, PS307 (F16), PS317 (F20, validation depth), PS308 (S6c). Blocks: PS327 (F23), PS324 (F41).
- **Evidence (defects/contradictions):** none for permission, since the table is unbuilt. D1 and D42 show that derived writes already bypass the refusals placed beside linkReferential and groupReferential.

### PS319. Are undo and redo validated, and what does "restored" mean for an undo?
- **Track / layer:** seam ; writes
- **Covers:** F20 (undo and redo); map section 1.5 (undo row)
- **The question:** Undo applies the stored inverse and redo applies the stored ops, neither re-planned nor validated, and undo restores content but not collection order. What validation applies to undo and redo, and what must an undo restore?
- **Why it is open:**
  - Undo and redo apply stored ops without validation (txn.mjs:600-650) [M-read].
  - Redo recreates D42's validateDoc-invalid state [M-run G2].
  - D43: undo does not restore collection order when a deleted entity was not last in its collection [M-run G1]. This contradicts the comment "An undone collapse must be byte-identical to what stood before it" (txn.mjs:250-254; C48); the B215 undo test passes because its fixture deletes the last-inserted link.
  - Collection order feeds linksAt order, which decides the spawner's link (D11); the effect of D43 on that choice is [I].
  - Log records keep pre-migration shapes that undo applies without validation (F23; PS327).
  - The reversal broadcast carries no reveal and from:null (D21; C33).
- **Alternatives:**
  1. (status quo) Stored inverse and ops applied without validation; content restored, order not.
  2. Validate inverses and redo ops before applying, and refuse an invalid one.
  3. Re-plan undo and redo as fresh requests through plan().
  4. Restore order exactly (an order-carrying inverse), or make every consumer order-insensitive so that order has no effect.
  5. other.
- **Recorded positions:** RULED [LOCKED]: TRANSACTIONS D21 (TRANSACTIONS.md:444; lock date not carried) for bulk reversal. Code comment txn.mjs:250-254 (the byte-identical claim). No position on validating undo or redo.
- **Under each frame:** The question reads the same under all frames; FR2 and FR3 change what an inverse contains (pipes, cables), not the question.
- **What would separate the alternatives:** Is any consumer order-sensitive (spawnersOf is, per D11)? If every consumer becomes order-insensitive, order restoration has no observable effect. Would a validated undo ever refuse? Only if a forward write can commit an invalid state (PS317), or a log holds a pre-migration shape (PS327) [I].
- **Intent bearing:** INTENT-SILENT. Q1a (door parity) bears only in that undo is computed server-side for every door.
- **Depends on / blocks:** Depends on: PS317 (F20, validation depth), PS316 (F40). Blocks: PS327 (F23).
- **Evidence (defects/contradictions):** C33, C48, D11, D21, D42, D43.

### PS320. Which derived writes does a client predict locally, and with what code?
- **Track / layer:** seam ; writes
- **Covers:** F21 (the projection half)
- **The question:** The client mirrors the cascade and the steal as twins, receives the sweep and the collapse only through the ack, computes the split alone, and keeps the pin clear local. Which derived writes does a client predict, and with shared code, twins, or not at all?
- **Why it is open:**
  - Client twins: the delete cascade (commands.js:51-124 vs txn.mjs:420-473) and the group steal (commands.js:126-147 vs txn.mjs:363-379) (map 4.5).
  - The browser has no sweep of its own and learns of it only through the ack (sync.js:393-413) [M-read G2].
  - The collapse reaches the client only through the ack; H15.2 (TODO, BOARD.md:812) would share collapseAtWaypoint. Sharing it shares the pairwise rule only; the composition loop is inline in plan() and not exported [M-read G1]; whether a client would reproduce D41 depends on re-implementing that loop [I].
  - D12 [LOCKED]: the server computes the cascade and the browser sends intent. D16 [LOCKED]: "The planner is server-only, because *authority* is what must not be duplicated."
  - W7: `cli/` takes no dependency on `model/`; HANDOVER.md:351: "a local projection would mean a second implementation of the model".
  - Critic gap 2 of map 10.1 (not assigned to this part) records that "projection" carries at least four meanings, one of which is this client prediction.
- **Alternatives:**
  1. (status quo) Mixed: twins for cascade and steal, nothing for sweep and collapse, a client-only split, a local-only pin clear.
  2. Shared pure derivations imported by both sides (map F21 option).
  3. A server-authoritative echo of the whole planned list (map F21 option).
  4. No client projection of derived passes (map F21 option).
  5. The client runs a planner instance for prediction.
  6. other.
- **Recorded positions:** RULED [LOCKED]: D12 and D16 (TRANSACTIONS.md:344, 388-393; lock date not carried). TODO: H15.2 (BOARD.md:812).
- **Under each frame:**
  - FR0, FR1: as stated.
  - FR2: derived links are computed by every observer, so link-level state is a derivation rather than a prediction; cascades and any sweep remain to be predicted or not.
  - FR3: terminate and splice are authored at the client; cascades remain.
  - Stages axis: seeds S12 says stages as capabilities demand "every stage pure, deterministic and shared by every door".
- **What would separate the alternatives:** Measure the window in which an originator shows a state the server will not hold (ack latency), and check whether any gesture reads a derived write before the ack arrives (for example, continuing a drag through a collapsed bend). If no gesture does, an echo-only client shows no difference during gestures [I].
- **Intent bearing:** Q1a (door parity) bears. Round-1 anchor (envelope): the VISION north star, "derived physics that everyone watching computes identically". Director Q3 rationale: "so that a path can be derived across all viewers".
- **Depends on / blocks:** Depends on: PS314 (F18), PS315 (F19), PS317 (F20), PS316 (F40). Blocks: PS321 (none in the map). Related (overlapping, not merged): PS127.
- **Evidence (defects/contradictions):** C32, D2, D44.

### PS321. How does the originating client reconcile its local state with the server's planned result?
- **Track / layer:** seam ; writes
- **Covers:** F21 (the reconciliation half; D2, D3, D44)
- **The question:** The ack diff applies only the planned ops whose op:kind:id key the client did not send itself, and requests no resync. What rule reconciles the originator's model with the committed result?
- **Why it is open:**
  - sync.js:409-416 [S]: only ops whose `${op}:${kind}:${id}` key the client did not send are applied.
  - D3: a derived op that shares a key with a client-sent op is dropped, and no resync follows [M-run R3, ack-collide.mjs].
  - D2: the split's `del X` + `put X`, with the collapse's `del X` dropped, leaves converged false [M-run R3].
  - D44: a node delete plus a bend delete, with the collapse's `set:link:A` dropped, leaves converged false; the originator's view validates, so nothing flags it [M-run G3, ack rule restated from sync.js:411-412].
  - D12 [LOCKED] states the intended echo: the browser "applies the server's **expanded** change when it echoes back" (TRANSACTIONS.md:347).
  - Unmeasured: the Sync class for D44; the client path for D41 (G1 expects convergence on the same wrong result [I]).
- **Alternatives:**
  1. (status quo) A key-filtered diff with no resync.
  2. Reconcile by value: compare entity values and apply differences (map F21 option).
  3. Replace the originator's touched entities with the server's post-state.
  4. Rebase: rewind local optimistic ops, then apply the server's planned list.
  5. Detect divergence (hash or version) and resync from a snapshot.
  6. other.
- **Recorded positions:** RULED [LOCKED]: D12 (TRANSACTIONS.md:344-352; lock date not carried). No position on the key rule.
- **Under each frame:** The question reads the same under all frames; FR2 removes the bend-conversion writes that produce D2 and D44's colliding keys, and cascades still reach the rule.
- **What would separate the alternatives:** A divergence check after every ack in a browser harness over the D2, D3 and D44 cases, counting converged true or false for each candidate rule.
- **Intent bearing:** Q1a (door parity) bears. Round-1 anchor A5 perceptual parity (envelope: "every viewer derives the same path").
- **Depends on / blocks:** Depends on: PS314 (F18), PS315 (F19), PS317 (F20), PS316 (F40), PS320 (F21, projection). Blocks: none. Related (overlapping, not merged): PS127.
- **Evidence (defects/contradictions):** C33, D2, D3, D21, D44.

### PS322. Is `pinned` stored intent that a write must clear, something derived, or permanent intent?
- **Track / layer:** seam ; anchor, writes
- **Covers:** F22
- **The question:** `pinned` marks a waypoint placed deliberately with no link and exempts it from the orphan sweep; the record says threading clears it. Only the browser clears it, locally, and the clear is never sent. What is the pin, and what, if anything, clears it?
- **Why it is open:**
  - validate.js:214-217: "What cannot be derived is a waypoint placed deliberately with no link at all ... `pinned` says the author meant it to exist, so the sweep leaves it alone. Threading a link through it clears the pin" [read for this register].
  - It is set only by the idle `w` key (input.js:907) and CLI `set pinned`, cleared only locally (input.js:938) [M-run R1 P1], and read only at txn.mjs:166.
  - Threading through `set via` or /commit leaves pinned:true on the server; no door clears it there (D5) [M-run G3].
  - B162 disposition (BACKLOG.md:224): "`pinned` turned out to be a BACKSTOP, not the primary guard ... It earns its place only where a linked waypoint keeps a pin that threading should have cleared." [read for this register]
- **Alternatives:**
  1. (status quo) Stored; cleared only locally in the browser; the server keeps stale pins.
  2. Clear the pin in plan() when a link first references the waypoint (a derived write).
  3. Derive "placed deliberately" from the absence of references, with no stored pin.
  4. The pin as permanent intent: never cleared by threading, always exempt from the sweep.
  5. other.
- **Recorded positions:** RULED (director, 2026-08-28, B162): "an unreferenced waypoint self-destructs, wherever that state arises." Record statement at validate.js:216-217: "Threading a link through it clears the pin". No position on where the clear is computed.
- **Under each frame:**
  - FR0, FR1: as stated.
  - FR2: a pinned anchor is one with no pipes; "threading" means a pipe added there; the sweep's "unreferenced" reads pipes.
  - FR3: an anchor can have pipes and no cables, so whether "referenced" means pipe or cable is itself open.
- **What would separate the alternatives:** An author places a point, routes through it, then deletes the route. Is the point expected to stay? If it is, the pin is permanent intent; if not, a clear on threading, or a derivation, covers the case.
- **Intent bearing:** Q3c bears (inputs may be persisted; the pin is persisted intent). Seeds S14 candidate admission test (proposer wording, attached to the director's S14 statement): "a field is persisted only if it is intent that cannot be derived".
- **Depends on / blocks:** Depends on: PS313 (F17), PS314 (F18). Blocks: none.
- **Evidence (defects/contradictions):** D5.

### PS323. Where does a rule that both kernel/ and model/ need live: a shared module, test-held twins, or one owner?
- **Track / layer:** seam ; anchor, link, writes
- **Covers:** F24
- **The question:** kernel/ and model/ do not import each other, so facing, samePlane, the termination predicate and pairKey are restated, while engine/ imports both. Where does a rule that both sides need live?
- **Why it is open:**
  - kernel/ and model/ do not import each other [V]; engine/ imports both (movers.mjs:38-39; spawners.mjs:23; rules.mjs:40; situation.mjs:28-29), contradicting three sovereignty claims (C15).
  - Twins (map 4.5): facing and linkFacing, a declared twin (scan-twins.mjs:49-62); samePlane and an inline restatement (geometry.mjs:355 and invariants.mjs:186); pairKey in two encodings (D38); the termination predicate at 7 or more sites; the role readings waypointRoles, wasBendOnly, CLI spawn and spawnersOf.
  - scan-twins.mjs:61 names a routable pack as the twins' eventual home, "REVISIT when the capability pack lands (H15.6)", and H15.6 is a different, DONE item (C21).
  - The H15.4 twin test never drives an undeclared or one-declared pair (D37).
  - HIERARCHY.md:63-68 duties: model/ "Say what is connected, and through which points"; kernel/ "Say how a path is drawn, and whether it is legal"; engine/ "Say what references what." [read for this register]
- **Alternatives:**
  1. (status quo) Twins kept apart by the layering rule; some held by the declared-twin scanner and tests.
  2. A shared module both import (map F24 option).
  3. One owner, a routable pack or whatever holds role derivation and the collapse (map F24 option).
  4. Twins held by exhaustive parity tests, including the undeclared cases D37 names (map F24 option "twins held by tests").
  5. Relax the layering rule so one side imports the other.
  6. other.
- **Recorded positions:** Code fact [V]: kernel/ and model/ do not import each other (map 4.2). RULED [LOCKED]: TRANSACTIONS D16, "Module placement - no sovereignty changes" (TRANSACTIONS.md:388; lock date not carried). Standing gate GR15 (TRANSACTIONS.md:617): twin functions are "detected, not noticed". Record intent at scan-twins.mjs:61 (a routable pack as the home).
- **Under each frame:** FR0 and FR1 as stated. FR2 and FR3 add a pipe-layer derivation that every door computes, which adds candidates for restatement. The stages axis matters: seeds S12 says stages as capabilities demand "every stage pure, deterministic and shared by every door (kernel/ and model/ deliberately do not import each other today)".
- **What would separate the alternatives:** Count divergence incidents by cause: restated code versus differing inputs (D16's canvas/export split came from different incidence inputs, not twin code). A mutation test: change one twin and see whether any guard fails.
- **Intent bearing:** Q1a (door parity) and Q1c (fewer concepts) bear. Round-1 anchor A3 sovereign composition (envelope: "A3 sovereign composition is implicated by the widened reach").
- **Depends on / blocks:** Depends on: PS117, PS211 (F7), PS313 (F17). Blocks: none. Related (overlapping, not merged): PS127.
- **Evidence (defects/contradictions):** C15, C21, D16, D37, D38.

### PS324. What does a type change do to an anchor's existing links and permission?
- **Track / layer:** seam ; anchor, link, writes
- **Covers:** F41 (the links and permission half)
- **The question:** Retype is one undoable set at every door; it runs no derived pass and consults no permission, and a router with three terminating links retyped to server is accepted. If types restrict what an anchor may be, what happens when the node side changes while its links stay?
- **Why it is open:**
  - The plan is exactly `set:node{type}` and validateDoc returns null on the result [M-run G3].
  - DECISIONS.md:52-53 (Amended 2026-06-13): clicking a node of a different type "retypes it in place (fast-replace: id/name/links survive, undoable)" [read for this register]. DECISIONS.md:251-253 (2026-09-22): a violation is REFUSED. The map (F41) reads them as consistent only if the retype itself is refused, which the record never says [I].
  - validateMutation runs referential checks for link and group only (validate.js:351-362), and violations() refuses only introduced states (txn.mjs:276-287) [M-read G3].
  - No record line after DECISIONS.md:53 addresses retype (the map lists the searches) [M-run grep G3].
  - The CLI's retype vocabulary is open while create is closed (D46); REST files a retype as 'move node' (D48).
  - Three shapes coexist for "what this anchor is": kind by id prefix (immutable), node.type (settable), and node.type = 'waypoint' as a pseudo-type [M-read G3].
- **Alternatives:**
  1. (status quo) Accept; no check; links stay.
  2. Refuse a retype whose composition does not permit the anchor's current roles.
  3. Cascade: drop or rewrite the offending links as a derived write. Implies a departure from "links survive" (DECISIONS.md:53).
  4. Tolerate, and derive a visible "unpermitted" condition (compare seeds S13; DECISIONS.md:252 rejects permitted-but-underived).
  5. Allow retype only between compatible compositions.
  6. Treat recomposition as delete + create with a new identity.
  7. Under the cut reading (PS308): the retype changes what the derivation cuts at the anchor, with nothing refused, where a cut can express the restriction. Implies a departure from "A violation is REFUSED, in the validator" (DECISIONS.md:251) wherever a cut replaces the refusal.
  8. other.
- **Recorded positions:** RULED 2026-06-13: DECISIONS.md:52-53. RULED 2026-09-22: DECISIONS.md:251-253. Both stand; the record does not reconcile them.
- **Under each frame:**
  - FR0, FR1: as stated.
  - FR2: retyping a router to a server changes the cuts at that anchor, and derived links re-form.
  - FR3: cables through the anchor stay declared, and a new restriction may make a declared cable's route forbidden.
- **What would separate the alternatives:** The case "router with three links -> server": does the author expect accept, refuse, cascade, or a visible condition (a behaviour question)? Is retype offered as deliberate recomposition, or only as the fast-replace convenience?
- **Intent bearing:** INTENT-SILENT. Q1a (door parity) bears only on reach, since retype exists at every door; no pick or verbatim director statement addresses what a recomposition does to links.
- **Depends on / blocks:** Depends on: PS401, PS402 (F2), PS306-PS309 (F16, S6c), PS313 (F17), PS318 (F20). Blocks: none in the map; PS325 and PS326 list it as a dependency (the F41 links half).
- **Evidence (defects/contradictions):** D34, D46, D48.

### PS325. Does a recomposition take effect from an instant, or does the behaviour fold reread the whole window?
- **Track / layer:** seam / A ; behaviour
- **Covers:** F41 (the behaviour half)
- **The question:** worldOf reads the current type and combatAt folds every tick with the current world, so a retype grants or removes tower behaviour over the whole folded window. Does a recomposition apply from the moment it happens, or across the whole window the fold covers?
- **Why it is open:**
  - D45 [M-run G3, engine level]: loadbalancer -> server takes dead movers from 14 to 0 at the same t; server -> loadbalancer kills 14, the earliest death 98 ticks before now. Canvas visibility is [I].
  - D13 [M-run R4]: a newly placed tower kills retroactively; whether that is intended is NOT-CLAIMED, and no ruling was found.
  - Towers have no placement instant (rules.mjs:112-122); spawn.since is per entity; reveal.origin is per document (F31).
  - A content write grants or removes per-instance behaviour (action, input) [M-read G3].
  - D35: a turret's glyph rotation is never cleared on retype [M-read].
  - The fold derives and does not write, consistent with "may not write" (engine/rules.mjs:32-34).
- **Alternatives:**
  1. (status quo) An origin-free fold over the current world: a recomposition applies to the whole window.
  2. Anchor behaviour to a recomposition instant stored per entity (map F41 option).
  3. Fold against the document as it stood at each tick. Implies a history-aware derivation.
  4. Refuse recomposition while behaviour is running (run mode).
  5. other.
- **Recorded positions:** none (map D13, D45: no ruling found).
- **Under each frame:** The question reads the same under all frames. Where behaviour attaches is open (envelope S1.Q2 correction: "packs on anchors, attachments to flows or paths, or something else"); behaviour attached to a flow or path rather than an anchor changes which writes trigger a re-fold.
- **What would separate the alternatives:** In the pilot (tower defence), is a tower placed or retyped mid-wave expected to act only from that moment onward? The answer is observable on the canvas.
- **Intent bearing:** INTENT-SILENT on whether a recomposition is retroactive. Q2c bears on reach only (the envelope reads it: "behaviour brings time and a clock into the substrate").
- **Depends on / blocks:** Depends on: PS409, PS418 (F30), PS419-PS421 (F31), PS324 (F41, links half). Blocks: none.
- **Evidence (defects/contradictions):** D13, D35, D45.

### PS326. Can an entity change between the waypoint and node kinds in place, keeping its identity?
- **Track / layer:** seam ; anchor, vocabulary
- **Covers:** F41 (in-place waypoint <-> node conversion); F5 (its per-entity half)
- **The question:** Kind is the id prefix, so no door converts a waypoint into a node, or back, while keeping its id; replacement mints a new id, and spawn and pinned have no node home. Is an in-place conversion ("make this terminus a router") an operation, and what carries over?
- **Why it is open:**
  - Refused [M-run G3]: `set kind:node id:waypoint-...` ("invalid id for node"); `set waypoint {type}` ("unknown field waypoint.type"); `put kind:node id:waypoint-...` ("invalid id for node").
  - Replacement fits in one /commit record with a new id; the cascade deletes the terminating links, and re-putting them with the same ids in the same transaction is accepted [M-run G3]; only for a waypoint that is not in a via.
  - Fields do not transfer: spawn and pinned have no node home, and type, shape, span and content have no waypoint home (validate.js:176-237), so an armed spawner cannot be converted [M-read G3].
  - DECISIONS.md:298-302: under anchor-as-core the conversion and a retype are one operation. The map (F5) reads that after step 3 the conversion becomes a retype (PS324) [I].
  - The browser's fast-replace excludes hand 'waypoint' (input.js:261); CLI `set <node> type waypoint` yields a pseudo-type with the kind unchanged (D46).
- **Alternatives:**
  1. (status quo) Not possible in place; replacement with a new id.
  2. After a prefix migration (PS303 option 2), conversion is a retype on one kind.
  3. A dedicated conversion op that re-keys the entity and rewrites every reference in one transaction.
  4. Kinds stay separate and conversion is not offered.
  5. other.
- **Recorded positions:** RULED 2026-09-19 and 2026-09-22: the staged order and the ontology (DECISIONS.md:191-204, 298-302). No position on per-entity conversion.
- **Under each frame:**
  - FR0: as stated.
  - FR1: declared flows and paths reference anchors by id, so a new id would break those references.
  - FR2, FR3: a bend anchor that becomes a router changes cuts or terminations; under FR3, cables passing through are affected only where a restriction applies.
- **What would separate the alternatives:** Does any author workflow need the id preserved (references from declarations, flows, history, selection)? Under FR1-FR3, flows and paths that reference the anchor make id preservation observable.
- **Intent bearing:** Q1b (expressiveness) and Q1c (fewer concepts) bear. Director clarification (envelope S1.Q3): "declare or reason with lots of permutations of flows between the leaves/endpoints", which puts anchor references inside declarations.
- **Depends on / blocks:** Depends on: PS401, PS402 (F2), PS303 (F5), PS324 (F41, links half). Blocks: none.
- **Evidence (defects/contradictions):** D34, D46.

### PS327. When a stored shape changes, what happens to the log's stored inverses, and when is the migration code deleted?
- **Track / layer:** seam / programme ; writes
- **Covers:** F23
- **The question:** shedRetired migrates documents at boot, for examples and on restore, but not on create or for templates; log records keep pre-migration shapes, which undo applies without validation. When a stored shape changes, what happens to the log, and when is the transform deleted?
- **Why it is open:**
  - shedRetired runs at boot, for examples and on restore, and not on create or for templates (store.js:122-197, 821-832) [M-read R3; S].
  - Log records persist pre-migration shapes (docfile.mjs:19-35), and undo applies them without validation (PS319).
  - D24: shedRetired short-circuits (`migrateNames(doc) || migrateSpawn(doc) || shed`), so migrateSpawn never runs when migrateNames changed something; templates are never migrated (store.js:128 [S]). Map F23 cites this as "D26"; in map section 9 the short-circuit is D24, and D26 is the name-required defect.
  - Map F23 records a contradiction with the target "transform once, then delete the transform", which it cites from user memory.
  - Any frame change that alters stored shape (a prefix migration, FR2 pipes, FR3 pipes and cables) is a migration of this kind [I].
- **Alternatives:**
  1. (status quo) Migrate documents on load; leave the log; the migration code persists.
  2. Migrate log records too (map F23 option).
  3. Truncate the log on migration (map F23 option).
  4. Validate inverses on undo, refusing pre-migration shapes (map F23 option; PS319).
  5. Transform the estate once, then delete the transform (the target the map cites from user memory).
  6. other.
- **Recorded positions:** No position in the repository record was found by the map. The target the map cites is held in user memory, outside the repository record; its standing is not verified here.
- **Under each frame:** The question reads the same under all frames; the size differs: FR1 is additive (new declarations), while FR2 and FR3 change the stored shape of every link (seeds S3).
- **What would separate the alternatives:** Count the stored documents whose logs hold retired shapes (not measured). Is undo across a migration boundary a required capability (a question for the director)?
- **Intent bearing:** INTENT-SILENT. The accepted axis AX6 names the risk class only; no pick or director statement bears.
- **Depends on / blocks:** Depends on: PS303, PS305 (F5), PS319 (F20), PS128 (S20, pack versions and the one-time migration). Blocks: none.
- **Evidence (defects/contradictions):** D24.

### PS328. Which derived connection state must an agent be able to read through REST and the CLI, and computed where?
- **Track / layer:** seam ; anchor, link, path
- **Covers:** G1 (critic gap 1 of map section 10.1)
- **The question:** Roles (endpoint, bend, junction) are computed only by the renderers. REST and the CLI report no role, no per-link incidence role, no flow head at a point, and no run or path. Which derived state must an agent be able to read, and from which computation?
- **Why it is open:**
  - Critic gap 1 (map 10.1, verbatim excerpt): "A grep of server/ and cli/ for waypointRoles, waypointRole and roles returns nothing. REST contextOf (rest.js:80-112) reports links, neighbours, group and zones for a waypoint, with no role."
  - The only server-side role computation is inside the SVG export (server/svg.mjs:17 -> kernel/engine.mjs:71), which draws roles and does not report them (critic gap 1).
  - The pass-through classification disagreement (F7) is visible only on the canvas (critic gap 1).
  - The CLI shows only its own structural refusal wording in `spawn` (verbs.mjs:1585-1597).
  - GR18 (TRANSACTIONS.md:620, ruled 2026-08-23): "An agent drives draw through the TOOL, and the tool can do everything the API can." The map (F39) and the critic read GR18 as requiring pack-derived state to reach the CLI. REST does not report roles either, so whether GR18's text reaches state that no door reports is a reading, not a ruling [I].
  - A5 (HANDOVER.md:295-297, listed under "Director-ruled" standing rules): "Hold your own instruments. Never ask the director to read a screen for you."
  - Two A5-class gaps are deferred (HANDOVER.md:343-357): a draft cannot be observed, and an agent cannot perceive its own authority.
  - D17 (CLI `about` misformats a path) and D19 (CLI `links` and REST context misdescribe threading links) show derived data reaching agents in altered form.
- **Alternatives:**
  1. (status quo) No derived role, incidence role, flow head, run or path at REST or the CLI; they are drawn by the renderers only.
  2. REST context and the CLI report the derived state the renderers draw, computed by the same function.
  3. A dedicated derived-state read (per anchor, per link, per path) at REST, with a CLI verb reaching it.
  4. Agents compute it themselves from the raw document. Implies a second implementation at the agent; HANDOVER.md:291-292 records that "Piping `draw show --json` through a script is ITSELF a defect and is banned."
  5. other.
- **Recorded positions:** RULED 2026-08-23: GR18 (TRANSACTIONS.md:620; CLI.md:10-22). Standing rule A5 (HANDOVER.md:286-297, "Director-ruled, and not negotiable without going back"). The reading that GR18 requires derived state at the CLI is the map's (F39) and the critic's.
- **Under each frame:**
  - FR0: roles, incidence roles and the flow head at a point.
  - FR1: adds derived paths over links.
  - FR2: adds the derived links themselves, which have no stored id and need a stable address (seeds S7).
  - FR3: adds cable routes derived from their ends (when via is routed), LAG and VLAN constructs, and paths.
  - Stages axis: under stages as capabilities, every registered stage's output meets this requirement; seeds S12 lists "stable addresses for derived entities" among what that option demands.
- **What would separate the alternatives:** Using only `draw`, can an agent answer "is W a junction?" or "what path does flow F take?". For each fact it cannot answer, which ruling (GR18, A5) does the gap touch, under the director's reading of GR18?
- **Intent bearing:** Q1a bears (AX2: "Browser, server, CLI and REST compute the same thing"). Q3b bears: the envelope reads the pick as "a noun is admitted when ... an AUTHOR OR AGENT CAN SEE IT". Round-1 anchor A5 perceptual parity. Director Q3 rationale: "so that a path can be derived across all viewers".
- **Depends on / blocks:** Depends on: PS117, PS211 (F7), PS213, PS218 (F9), PS306 (F16), PS217 (S7). Blocks: PS501 (F39). Cross-referenced by PS502. Related (overlapping, not merged): PS127, PS128.
- **Evidence (defects/contradictions):** D16, D17, D19.

## 5.4 Part 4 -- Track A: type and composition, node features, containers, behaviour, time, rules, events, appearance, policy (PS401-PS428)

This part covers Track A: what `type` is and where its vocabulary closes; features every node has versus features only some nodes have; names; containers and kernel-only kinds; how behaviour attaches, including the director's flow-element use case and today's one-link movers; arming and disarming; time; rules; events; appearance; policy (AG-1); and the unnamed story step.
Frames FR0-FR3 and the stages axis are the register's candidate frames (section 3): FR0 today; FR1 links stored, with a derived path and a declared flow above; FR2 pipes stored, links derived as chains; FR3 pipes stored, links as declared cables (the register brief calls it the director's current leaning of 2026-09-25; seeds S16 labels the director's text a statement; not a decision). None is chosen, and every "Under each frame" reading is [I], derived from the frame definitions rather than measured.
Marks are carried from the reality map. A claim the map states without a mark is [M-read] by the map's own rule (its section 0). "[M-read, this part]" marks DECISIONS.md lines re-read at a986fb3 to date them.
INTENT-SILENT means no Round-1 pick and no recorded director statement bears on the choice between the alternatives. A pick that only places a question inside the reach is noted, and does not count as bearing on the choice.
In Covers lines, "G3" means critic gap 3 of map section 10.1. Inside evidence marks, G1-G3 are the map's gap fills.

### PS401. What does a node's `type` resolve to?
- **Track / layer:** A ; anchor (composition), vocabulary
- **Covers:** F2 (the "what type is" half, including the sentinels 'text' and 'host' and the 'waypoint' pseudo-type); map section 2.2
- **The question:** One stored slug, node.type, is read independently by several per-type tables. It is open what a type value means: a glyph, a composition, a behaviour key, a name prefix, or some subset of these. It is also open what the values that are not art ('text', 'host', 'waypoint') are.
- **Why it is open:**
  - One field feeds the glyph (GLYPH_DEFS/GLYPH_BB, theme.mjs:26-29, 45-109), behaviour (TOWERS, kinds.mjs:49-51), palette order (palette.js:14), CLI acceptance (verbs.mjs:31), the ASCII letter (verbs.mjs:2200) and the name prefix (model.mjs:253). There is no shared registry (map 2.2) [M-read].
  - The ruling says a named type is a composition (DECISIONS.md:267). Nothing in code corresponds to pack or composition (map 2.1) [M-read R5, R6, R7]. The nearest stored proxy is node.type (map 1.3) [M-read].
  - The ruled composition is spelled 'load-balancer' (DECISIONS.md:300), and every stored and coded slug is 'loadbalancer'. A node typed 'load-balancer' yields 0 towers [M-run R4 probe2].
  - Sentinels: the editor's text box stores type 'text' (model.mjs:261-269), and the CLI panel defaults to 'host' (verbs.mjs:1965, 1990). Templates carry both conventions [M-read R5].
  - 'waypoint' is accepted as a node.type [M-run R5]. It is also an authoring pseudo-type (verbs.mjs:1660; input.js:261, 865, 890; painter.js:61; palette.js:251-252), although B146 ruled that a waypoint is not a node type [M-read].
  - An unknown slug renders an empty `<use>` inside the host fit box (kernel/renderer.mjs:225), and the scene defaults a missing glyph to 'router' (geometry.mjs:84) [M-read].
  - A content node draws no type glyph (renderer.js:383), so retyping one changes tower behaviour with no visible glyph change (map 2.4) [I].
- **Alternatives:**
  1. type is a key that each per-type table reads independently (status quo): each table is local to its consumer; adding a type touches every table, and the tables can disagree (palette and CLI order differ today).
  2. type names a composition, resolved through one registry that the validator, palette, CLI, renderers and engine all read: a type's meaning lives in one place, and every consumer takes a dependency on that registry.
  3. type is the glyph only, and behaviour and permission are keyed elsewhere: this needs a second per-node field or attachment.
  4. content-bearing nodes get their own composition instead of a 'text' or 'host' sentinel: the template conventions change.
  5. the 'waypoint' pseudo-type branches are retired, or 'waypoint' becomes the name of the routable-only composition: this is a choice about B146 and DECISIONS.md:302.
  6. other.
- **Recorded positions:**
  - RULED 2026-09-22 (DECISIONS.md:262-267; date [M-read, this part]): "a named type is a composition of packs rather than a kind the core understands".
  - RULED 2026-09-22 (DECISIONS.md:300, ontology table): composition examples `server`, `router`, `load-balancer`.
  - RULED 2026-09-22 (DECISIONS.md:302): waypoint "RETIRED as a concept. An anchor carrying only `routable`."
  - RULED B146 (date not carried by the map): a waypoint is not a node type.
  - DIRECTOR LEANING (2026-09-25, seeds S6c): "A router never bends - this would be a capability/behaviour restriction applied by the 'router node' pack to the anchor system on that node."
  - DIRECTOR LEANING (2026-09-25, seeds S12): "packs can extend anchor behaviour too, not just restrict."
- **Under each frame:** For glyph and behaviour, the question reads the same under FR0-FR3. What changes is what a type's meaning has to say about connections [I]:
  - FR0 and FR1: which roles an anchor permits for stored links (the ruled permission table).
  - FR2: whether the anchor continues or cuts a pipe chain (seeds S6c reads "never bend" as a cut).
  - FR3: whether a cable may pass through, end, or meet other cables at the anchor.
  - Stages axis: under FIXED stages, a type contributes to the link, path and flow stages. Under stages AS CAPABILITIES, a type could also bring a stage of its own (seeds S12 observation: one pack contributes to several stages at one anchor) [I].
- **What would separate the alternatives:**
  - (a) Does any consumer of type need a value (behaviour, permission, name prefix) that cannot be expressed as part of a composition?
  - (b) Does any type need behaviour to vary independently of the glyph: two types with one glyph, or one type with two glyphs?
  - (c) How many tables does adding one new type touch today, and how many under each alternative? This is an AX4 count.
  - (d) Is 'text' or 'host' as a sentinel read by anything other than the renderers and the CLI default?
- **Intent bearing:**
  - Q1 abcd: c (fewer concepts) and d (extensible physics) bear on one registry versus scattered tables, and a (door parity) bears on edge lists that disagree.
  - Q2 c places behaviour keyed by type (TOWERS) inside the reach.
  - The director leanings S6c and S12, quoted above, bear on a type carrying restrictions and extensions.
- **Depends on / blocks:** Depends on: none (as F2). Blocks: PS403-PS405 (F3), PS303-PS305 (F5), PS204 (F11), PS215, PS216 (F13), PS306, PS307 (F16), PS414, PS415 (F28), PS409, PS418 (F30), PS324-PS326 (F41) (as F2); PS308 (S6c); PS104 (S12).
- **Evidence (defects/contradictions):** C9; D34 (the pipette can arm 'text' or 'waypoint'); D35 (turret rotation is not cleared on retype); D45 (type feeds behaviour, and a retype re-folds the past).

### PS402. Where, if anywhere, is the node type vocabulary closed, and from which list?
- **Track / layer:** A ; vocabulary, writes (validation)
- **Covers:** F2 (the "where the vocabulary closes" half); D46; C9
- **The question:** The validator accepts any slug, the record says the vocabulary is closed, and the closed lists at the edges disagree with each other. It is open whether the vocabulary is closed, where, and from which list.
- **Why it is open:**
  - The validator accepts any /^[a-z0-9-]+$/ up to 32 characters, unchanged since 67d229d (validate.js:180). A probe accepted 'zzz' and 'waypoint' [M-run R5].
  - The record says "the validator's closed type vocabulary" (DECISIONS.md:287; HANDOVER.md:17, 89) (C9) [M-run R5].
  - The edge lists disagree in order. The palette has [host, server, loadbalancer, firewall, vxlan, router] (palette.js:14); the CLI has [host, server, firewall, router, loadbalancer, vxlan] (verbs.mjs:31). Only the CLI list is pinned by a test (tests/cli-tool.test.js:1426-1431) [M-read].
  - CLI create is closed (verbs.mjs:1124, 1669), while CLI retype through `set type` is open (verbs.mjs:347). So 'waypoint', 'load-balancer' and 'text' are reachable by retype (D46) [M-read G3; server acceptance M-run].
  - Retype to 'waypoint' and to 'load-balancer' is accepted; 'Router' is refused ("invalid value for node.type") [M-run G3].
- **Alternatives:**
  1. open at the validator, closed at some edges (palette, CLI create) and open at others (CLI retype) (status quo).
  2. closed at the validator, from one list that every door reads: a stored type outside the list is refused, including in loaded documents (this touches F23).
  3. open everywhere, with a fallback composition for unknown values: an unknown slug gets a defined meaning.
  4. closed at the authoring doors only, with tolerant storage: a document can hold values that no door can author.
  5. extensible at runtime, with a type registered the way a capability would be: registration becomes a write surface of its own.
  6. other.
- **Recorded positions:**
  - Record text, 2026-09-22 (DECISIONS.md:287, "Scope discipline"; date [M-read, this part]): the paragraph refers to "the validator's closed type vocabulary" as existing. It describes the vocabulary rather than ruling it closed, and the code contradicts it (C9).
  - No director position recorded on 2026-09-25.
- **Under each frame:** The same under all frames; this is a Track A vocabulary question. Stages axis: if a type can bring a stage (stages AS CAPABILITIES), registration may need an open vocabulary [I].
- **What would separate the alternatives:**
  - (a) Does any stored document (the 38 live diagrams, or the templates) hold a type outside both edge lists? Not measured.
  - (b) Is there a requirement that an agent can introduce a new type without an engine change?
  - (c) What does each door do with an unknown type on load and on write: refuse it, render a fallback, or preserve it?
- **Intent bearing:** Q1 a (door parity): today CLI create and CLI retype disagree, and so do the palette and CLI lists. Q1 d ("A new capability or behaviour arrives without an engine change", AX4) bears on registration versus code lists.
- **Depends on / blocks:** Depends on: PS401 (F2, the "what type is" half). Blocks: PS303-PS305 (F5), PS204 (F11), PS306, PS307 (F16) (as F2); PS327 (F23: how a door loads a value outside the vocabulary) [I].
- **Evidence (defects/contradictions):** C9; D46; D34.

### PS403. Which node features are universal, and which do only some nodes have?
- **Track / layer:** A / seam ; anchor, appearance
- **Covers:** F3 (whether frame, glyph, content, span, shape and name are intrinsic or packs); map section 2.1; map 1.4 rows for frame, glyph, content and name
- **The question:** The ruling says glyph, name, content, span and shape are things only SOME nodes have, and it names `named` and `framed` packs. The code makes the frame universal on nodes and impossible on waypoints, and makes the name mandatory on all five kinds. It is open which features belong to every node or anchor and which only to some.
- **Why it is open:**
  - The ruling: "glyph, name, content, span and shape are all things SOME nodes have" (DECISIONS.md:265), with packs `routable`, `glyph`, `framed`, `named`, `content` (DECISIONS.md:299) [M-read].
  - B187 (director, 2026-09-04) makes name "MANDATORY on all five kinds" (BACKLOG B187), and the code requires it (validate.js:307-312) [M-run R1, R5].
  - The frame is universal on nodes and impossible on waypoints. Every node draws a frame on every route, and no field suppresses it (kernel/renderer.mjs:224-255; renderer.js:250-288) [M-read].
  - The frame is emitted by 6 routes (kernel/renderer.mjs:232-234, 340-341; renderer.js:258-260; palette.js:156; painter.js:78; theme.mjs:152). The glyph has 7 emission sites: 6 are fitted, and the ghost is not (painter.js:79) [M-read R5].
  - Capabilities switched by field presence already exist without the word "pack": content makes a panel, span makes a rect frame, spawn makes an emitter, and pinned exempts from the sweep (map 1.3, 7.2) [M-read].
  - Pack and composition have no code (map 1.3) [M-read]. The capability probe was paper-only, and its citation runs in a circle (C10) [M-read, git].
  - A waypoint cannot hold type, glyph, shape or content. A node cannot take a role or spawn (map 2.1) [M-read].
- **Alternatives:**
  1. features fixed per kind (status quo): a node always has frame, glyph and name; a waypoint has name, pinned and spawn; content, span and shape are switched on by field presence.
  2. `framed`, `named`, `glyph` and `content` as packs, each with one emission route, composed per type: frame and name can then be absent from some compositions, which is in tension with B187 for name.
  3. name in the core (B187) and the other features as packs: this keeps B187 and departs from DECISIONS.md:264-265 (name is among the things "SOME nodes have") and from `named` as a pack (DECISIONS.md:299).
  4. frame intrinsic to the node kind, and the other features as packs.
  5. one appearance substrate shared by node, zone and group (HIERARCHY.md:146-147 [OPEN]), with each feature a contribution (see F34).
  6. field presence formalised as the capability switch: no separate declaration of a capability exists.
  7. other.
- **Recorded positions:**
  - RULED 2026-09-22 (DECISIONS.md:262-265, 299; date [M-read, this part]): the core is "identity, position, and an anchor"; "Nothing else is universal".
  - RULED B187 (director, 2026-09-04): name mandatory on all five kinds.
  - The two rulings disagree about name. They are stated side by side here and not resolved.
  - DIRECTOR LEANING (2026-09-25, seeds S12): "packs can extend anchor behaviour too, not just restrict."
- **Under each frame:** For node appearance features, the same under all frames. What differs is the set of stored things that could carry a name or appearance [I]:
  - FR0 and FR1: node, waypoint, link, zone and group.
  - FR2: pipes are added as stored things.
  - FR3: pipes and cables are added.
  - Stages axis: not material.
- **What would separate the alternatives:**
  - (a) Is there a composition an author wants with no frame, or with no name?
  - (b) Does any consumer (resolveId, REST, CLI, labels) need a name on every entity?
  - (c) Does a presence-gated field ever need to be present but inactive?
- **Intent bearing:** Q1 d (extensible physics) bears on features arriving as capabilities versus being fixed per kind. Q1 c (fewer concepts) also bears. The director leaning S12 (quoted above) bears.
- **Depends on / blocks:** Depends on: PS301, PS302 (F1), PS401, PS402 (F2) (as F3). Blocks: PS303-PS305 (F5), PS306, PS307 (F16), PS313 (F17), PS417 (F29), PS424, PS425 (F34) (as F3).
- **Evidence (defects/contradictions):** C10; C27 (API.md describes frames and glyphs that do not match the code); D27 (favicon frame, one of the frame emission routes); D32 (the ghost's glyph is not fitted).

### PS404. What is a name for, and where is it minted and changed?
- **Track / layer:** A / seam ; vocabulary, writes
- **Covers:** F3 (name as identity versus label; minting; the rename/set matrix per door and kind)
- **The question:** A name is required on every kind, and resolveId treats it as a unique handle, yet nothing enforces uniqueness. It is minted three ways, and different verbs change it at different doors. It is open what a name is (a label, a handle, or a generated default) and where it is minted and changed.
- **Why it is open:**
  - A name is required on every kind at full validation (validate.js:307-312; shape.mjs:31-47) [M-run R1, R5]. The comment at validate.js:201 says "Optional, like every other name" (C8, D26).
  - An empty string is accepted. resolveId refuses an ambiguous name (model.mjs:236-238), but no invariant enforces uniqueness, and anchor.mjs:87-89 takes the first match [M-read].
  - Names are minted three ways: nextName; name=id in the CLI; and duplicates from a split [M-run R1 P2, R3] (D4, C6).
  - The rename matrix per door:
    - the browser cannot rename a link or group (input.js:1504-1506);
    - CLI `rename` refuses link and waypoint with a reason written before B187 (verbs.mjs:2112-2113), while `set name` accepts all five kinds (:344-367) (D25);
    - REST has no waypoint collection (rest.js:15) [M-read].
  - Only plain and span nodes and zones render a name (map 1.4) [M-read]. The canvas and export labels differ (D28) [M-read].
- **Alternatives:**
  1. required on all kinds, not unique, minted per door (nextName, name=id, split duplicates), and changed by verbs specific to each door (status quo).
  2. an optional label, with the id as the handle.
  3. a required unique handle, enforced by an invariant.
  4. generated from the id unless authored, as a display default.
  5. minted at the server against a projection, or minted for display only.
  6. one rename surface per kind, the same at every door.
  7. under FR2 or FR3, names on pipes, cables or derived links, bound as in seeds S7.
  8. other.
- **Recorded positions:**
  - RULED B187 (director, 2026-09-04): mandatory on all five kinds.
  - RULED 2026-09-22 (DECISIONS.md:299): `named` is a pack. The tension with B187 is recorded in PS403.
  - Record text: "split copies name" (HANDOVER.md:337), contradicted by C6.
  - No position recorded on 2026-09-25.
- **Under each frame:** [I]
  - FR0: names on node, waypoint, link, zone and group; a split mints duplicates.
  - FR1: declared flows, and perhaps paths, join the things that could be named.
  - FR2: a link is derived, so its name needs a binding that survives the link re-forming. The seeds S7 alternatives are: by end anchors, by a member pipe, by a stored entity, or by selectors.
  - FR3: a cable is declared with its own identity, so its name binds to that identity. Whether pipes carry names is separate.
  - Stages axis: not material.
- **What would separate the alternatives:**
  - (a) Does any agent or CLI workflow address entities by name rather than by id, and does it break on duplicates?
  - (b) Does an author ever need two things with the same visible label?
  - (c) Under FR2, when a new anchor cuts a named derived link, which half keeps the name (the seeds S7 hard case)?
- **Intent bearing:** Q1 a (door parity): minting and renaming differ by door. Q3 b ("author can see it") bears on whether a derived link, path or flow needs a visible name [I].
- **Depends on / blocks:** Depends on: PS301, PS302 (F1), PS401, PS402 (F2) (as F3); PS217 (S7; mutual). Blocks: PS303-PS305 (F5), PS313 (F17) (as F3); PS217 (S7; mutual).
- **Evidence (defects/contradictions):** C6; C8; D4; D25; D26; D28.

### PS405. Is reachability by connections universal to anchors, and what does reachability alone permit?
- **Track / layer:** seam ; anchor, link, pipe
- **Covers:** F3 (reachability versus routable: "What a composition without routable permits is unanswered")
- **The question:** The ruled core includes being reachable by links, while `routable` supplies the variants (endpoint, bend, junction). It is unanswered what an anchor that is reachable, but carries no routing permissions, permits.
- **Why it is open:**
  - The core includes reachability (DECISIONS.md:228, 298), and routable supplies the variants (:234, 268) [M-read].
  - routable has no code. It appears only as a string in scan-twins.mjs:61 [M-read R5].
  - Nodes today are reachable as src or dst, but never as a via (validate.js:243), and never receive roles (kernel/engine.mjs:66-71) [M-read]. Roles are derived for waypoints only (map 3.3) [M-read].
  - The permission table is ruled per TYPE: a bare waypoint permits all three variants; a router permits endpoint and junction, never bend; a server permits endpoint alone (DECISIONS.md:237-260). It is unbuilt (H15.7 TODO) [M-read].
  - Zones and groups are not reachable by links (validate.js:241-242) [M-read].
- **Alternatives:**
  1. gated by kind (status quo): nodes are reachable as ends only, never as a via, and have no roles; waypoints are reachable in every role.
  2. every linkable composition includes routable, and an anchor without routable is not reachable.
  3. reachability without routable permits nothing.
  4. reachability without routable permits endpoint only.
  5. reachability is itself a capability contributed by a pack, not part of the core.
  6. under FR2 or FR3, the question splits: may a pipe end at this anchor, and, separately, which behaviours (continue, terminate, meet) does its composition permit (seeds S6c).
  7. other.
- **Recorded positions:**
  - RULED 2026-09-22 (DECISIONS.md:228, 298): the anchor is "Identity, position, and the fact that links can reach it."
  - RULED 2026-09-22 (DECISIONS.md:234, 268): routable supplies which anchor variants a composition permits.
  - DIRECTOR LEANING (2026-09-25, seeds S6c): "A router never bends - this would be a capability/behaviour restriction applied by the 'router node' pack to the anchor system on that node."
  - DIRECTOR LEANING (2026-09-25, seeds S12): "packs can extend anchor behaviour too, not just restrict."
  - DIRECTOR LEANING (2026-09-25; seeds S15 records this passage as a leaning, and the envelope records the same passage as a requirement): "links are only ever between endpoints or junctions (or one to the other). drawing a new link to a bend converts it to a junction (current behaviour). parallelism lives above/abstracted over wires." (Per the seeds naming note, read "wires" as pipes.)
- **Under each frame:** [I]
  - FR0: the variants are roles of a waypoint over stored links, and nodes get none.
  - FR1: as FR0 at the link layer. The path and flow layers add further questions: may a path transit this anchor, and may a flow start or end here?
  - FR2: whether an anchor continues or cuts decides where derived links begin and end. Seeds S6a notes that the cut rule has to be computable below links.
  - FR3: two questions per anchor. May a pipe end here? May a cable pass through, end, or meet other cables here?
  - Stages axis: under FIXED stages, each composition contributes a permission per fixed stage. Under stages AS CAPABILITIES, a composition could lack a stage entirely, which makes "not reachable at stage X" expressible.
- **What would separate the alternatives:**
  - (a) Is there a composition an author wants that can be placed but not connected (an annotation, a text box)?
  - (b) Is there a composition that can be connected only as an end? The ruled table says a server is one.
  - (c) Which restrictions can a derivation honour (never bend as a cut), and which need a refusal (endpoint-only on a second connection)? This is seeds S6c, open item 1.
- **Intent bearing:** The director leanings S6c, S12 and S15 (quoted above) bear on this directly. Q1 b (expressiveness) also bears.
- **Depends on / blocks:** Depends on: PS301, PS302 (F1), PS401, PS402 (F2) (as F3); PS205, PS207 (S6); PS209 (S6a); PS308 (S6c). Blocks: PS306, PS307 (F16) (as F3); PS204 (F11), PS414, PS415 (F28) [I].
- **Evidence (defects/contradictions):** C10.

### PS406. Are containers (zone, group) part of the anchor model, and can connections reach them?
- **Track / layer:** A / B ; anchor, link
- **Covers:** F4 (zone and group in the ontology; the container-edge handle; the hub principle). The shared frame substrate is carried in PS424.
- **The question:** The ruled ontology covers anchor, pack, composition, node and waypoint only. A zone has a position but cannot be reached; a group has neither position nor reach. The record keeps an [OPEN] container-edge handle and a hub principle. It is open whether containers are anchors, and whether connections can end on them.
- **Why it is open:**
  - The ontology covers anchor, pack, composition, node and waypoint only (DECISIONS.md:296-302) [M-read].
  - A zone is {id, name, x, y, w, h}: not reachable by links, not a group member, and a placement region for `inside` (validate.js:252-259) [M-read].
  - A group is {id, name, members[node or waypoint]} with no position. Its hull is derived (geometry.mjs:572-581). It is never selected directly and is not reachable by links [M-read].
  - The record keeps a container-edge handle [OPEN] (ATOMICS.md:80-90) and a hub principle, "links attach to the hull" (ATOMICS.md:113). The vision reads "connection = a net/wire (incl. container<->container, single or parallel)" (HIERARCHY.md:29) [M-read].
  - kernel resolveRoute admits any byId entity, zone and group included [M-run R2 probe3]; the validator admits node and waypoint only (map 4.1) [M-read].
  - The archive sim held a "mechanism relation" {from, to, style, count} with realizers, a bundle between containers (map 7.1 WIRE (d)). kernel/engine.mjs:25-26 points to a location that no longer holds them (C34) [M-read R7].
- **Alternatives:**
  1. containers stay outside the anchor model and cannot be reached (status quo).
  2. containers, or their hulls, become anchors with routing-like permissions.
  3. a connection between two containers is declared once and realised as N lines (the archive's mechanism relation, or bundle).
  4. container edge handles become child anchors (ATOMICS [OPEN]).
  5. zones and groups are treated differently, for example a reachable group hull and an unreachable zone.
  6. other.
- **Recorded positions:**
  - RULED 2026-09-22 (DECISIONS.md:296-302): the ontology table is silent on containers.
  - Record [OPEN]: the container-edge handle (ATOMICS.md:80-90).
  - Record text: the hub principle (ATOMICS.md:113); the vision line (HIERARCHY.md:29). Neither is a 2026-09-25 statement.
  - No position recorded on 2026-09-25.
- **Under each frame:** [I]
  - FR0: a container would become a new kind of src or dst.
  - FR1: also, could a flow's src or dst be a container (a flow between two groups)?
  - FR2: a container would need to be a pipe end, or to have pipe ends on its hull.
  - FR3: a cable could end on a container, or a logical construct over cables could group those between two containers. Seeds S15 and S16 place aggregation above cables.
  - Stages axis: under stages AS CAPABILITIES, reachability of a container could arrive as a capability.
- **What would separate the alternatives:**
  - (a) Does any case in the network requirement (series, LAG, VLAN, parallel links) connect a container rather than a node?
  - (b) Is a group's membership meant to affect routing, or only appearance?
  - (c) Does the flow use case ("flows between the leaves/endpoints") ever name a group as a leaf?
- **Intent bearing:** INTENT-SILENT. The vision line HIERARCHY.md:29 is record rather than 2026-09-25 capture. Q1 b (expressiveness) is general and names no container case. No Round-1 pick and no 2026-09-25 statement names containers.
- **Depends on / blocks:** Depends on: PS301, PS302 (F1) (as F4). Blocks: PS204 (F11), PS215, PS216 (F13), PS317-PS319 (F20), PS424, PS425 (F34) (as F4).
- **Evidence (defects/contradictions):** C27 (group "Not rendered", stale); C28 (z-order claim versus both renderers); C34.

### PS407. What are port, junction pad, crossing pad and tunnel-gap in the document, if anything?
- **Track / layer:** A / B ; anchor, appearance
- **Covers:** F4 (port and junction kernel kinds with no producer; the [LOCKED] crossing pad and tunnel-gap with no renderer; the [LOCKED] parallel ports)
- **The question:** The kernel handles port and junction elements that nothing emits. The record locks face ports, parallel ports and a crossing convention that nothing renders. It is open whether these are anchors, derived appearance, part of a composition, or residue.
- **Why it is open:**
  - port() {kind:'port'} is handled by the renderer, GRC and bboxOf, and never emitted by resolve() (geometry.mjs:537; kernel/renderer.mjs:219-223; grc.mjs:44-59, 69). It has no id grammar (validate.js:43) [M-read].
  - junction() is a kernel scene element, "a tap point on a trunk", a 10px pad that is never emitted (geometry.mjs:538; kernel/renderer.mjs:216-218) [M-read]. It is distinct from the derived junction role, which is drawn as the wp-junction ring (geometry.mjs:284-289, 306) [M-read].
  - The same elements are called DECLARED design (tests/span.test.js:376-385) and "drawv1 residue" (ATOMICS.md:50, 132) [M-read].
  - Face-locked ports are [LOCKED], at 2 per node face and 3 per group-hull cell (ATOMICS.md:69-76, 106-115). Port is an anchor kind "no schema can yet name" (HIERARCHY.md:51-54) and a future derived appearance (DECISIONS.md:341) [M-read].
  - The [LOCKED] crossing pad and tunnel-gap (ATOMICS.md:61-65) have no renderer. A grep for "tunnel" finds nothing in kernel/ or app/src (map 3.6) [M-read].
  - A link always attaches to a multi-cell node at the origin cell centre (kernel/engine.mjs:44, 52; model.mjs:176-178) [M-read].
  - Crossings are admitted in the document (a waypoint in the via of two links with different pairs), although "cannot arise" (invariants.mjs:59-68) [M-run R3] (C3).
- **Alternatives:**
  1. kernel-only elements with no producer, and locked designs unbuilt (status quo).
  2. ports as child anchors of a node: addressable attachment points.
  3. ports as derived appearance only: where a connection meets a frame.
  4. ports and junction pads declared by a node's composition.
  5. the kernel port and junction kinds deleted as residue.
  6. the crossing pad and tunnel-gap as derived appearance at crossings. Whether a crossing is admitted, refused or split is F8 and outside this part.
  7. other.
- **Recorded positions:**
  - Record [LOCKED]: face ports, parallel ports and the crossing convention (ATOMICS.md:61-76, 106-115; lock date not carried by the map).
  - Record text: port as a future derived appearance (DECISIONS.md:341).
  - DS7 (2026-09-25; a leaning in seeds S15, a requirement in the envelope): "parallelism lives above/abstracted over wires" (wires read as pipes, per the seeds naming note).
  - DIRECTOR LEANING (2026-09-25, seeds S15): "a wire's spec is just its two anchors."
- **Under each frame:** [I]
  - FR0 and FR1: a port would be where a stored link attaches. Today violations() allows at most one straight link per unordered pair, and routed links between the same pair are refused only when they bend at a shared waypoint (map 3.2) [M-read].
  - FR2: a pipe's spec is its two anchors (the S15 leaning), so parallel pipes need a discriminator, or parallelism lives above pipes. A port could be that discriminator, or appearance only.
  - FR3: parallel links are several cables in one pipe (the S16 reading), so a port would be where each cable leaves the node, and a junction pad would mark cables meeting.
  - Stages axis: not material.
- **What would separate the alternatives:**
  - (a) Does visualising parallel links and LAG members need distinct attachment points on the frame, or can lanes on one line express them?
  - (b) Does any consumer need to address a port: attach a behaviour to it, name it, select it?
  - (c) Is the crossing case (seeds S6: a crossover without connection, versus a junction dot) needed?
- **Intent bearing:** The director requirement of 2026-09-25 (envelope, verbatim): "I think we need to be able to model, construct and visualise all 4 of those in the table" (series, parallel/LAG, multiplex/VLAN, parallel links). The leaning "parallelism lives above/abstracted over wires" also bears. Q3 a and b (something attaches; it is visible) bear on whether port earns a noun.
- **Depends on / blocks:** Depends on: PS301, PS302 (F1) (as F4); PS205 (F8, S6), PS212 (F8); PS110 (S15); PS109 (S16). Blocks: PS215, PS216 (F13), PS424, PS425 (F34) (as F4).
- **Evidence (defects/contradictions):** C3; C30 (the "junction rung RESERVED, not drawn" comments, although the junction ring is drawn); C34.

### PS408. What keeps a container's membership true when a write the author did not request removes a member?
- **Track / layer:** seam ; writes, anchor
- **Covers:** F4 (the map's wording: "Group membership is a stored id list that derived writes must maintain"); D42
- **The question:** Group membership is a stored id list. When the author deletes a member, the request path trims the group or deletes it; the orphan sweep does neither. It is open how membership stays consistent with derived deletes, including whether membership is stored at all.
- **Why it is open:**
  - A group's members are a stored id list (validate.js:264) [M-read].
  - planDel trims holding groups, or deletes them (trimGroupsHolding, txn.mjs:406-418, called at :425 and :472). The orphan sweep deletes bends without trimming (txn.mjs:161-176) [M-run G2] (D42).
  - Result: plan() is ok, violations() returns [], and validateDoc refuses. The file is skipped at the next boot, and when it is the only diagram file the server refuses to boot [M-run G2].
  - B85 in violations() counts listed members, so it cannot see a dangling member (invariants.mjs:249-258) [M-run G2] (C46).
  - Six request shapes reach the stale state (D42) [M-run G2].
  - The group is the only stored container that a derived delete can leave stale. doc.selection is reconciled by Model.del (model.mjs:124-127); reveal beats tolerate stale ids on purpose (validate.js:470-472) [M-read G2].
- **Alternatives:**
  1. a stored id list, maintained by request deletes and not by the sweep (status quo).
  2. a stored id list, maintained by every deleting pass through one shared trim.
  3. a stored id list whose stale ids are tolerated on read, as reveal beats are: validateDoc would not refuse a dangling member.
  4. membership derived (from a region, or a declared selector) rather than stored: no id list to maintain; membership then changes whenever the region or selector's matches change.
  5. deleting a grouped member refused unless the request names the group change.
  6. other.
- **Recorded positions:**
  - RULED (director, 2026-08-28, BACKLOG.md:224): B162, "an unreferenced waypoint self-destructs, wherever that state arises"; B216 (BACKLOG.md:259; date not read) scopes the sweep to bends.
  - No ruling on the sweep's interaction with groups. The map's D42 names the searches that found no record entry.
- **Under each frame:** [I]
  - FR0 and FR1: waypoints are swept as orphaned bends, and they can be group members.
  - FR2: if a bend is an anchor where pipes continue, the sweep's target (a bend no link references) may not arise as a separate derived delete. What deletes an anchor becomes an author or cascade question.
  - FR3: pipes and cables are stored. Whether an anchor left with no pipe is deleted automatically is the same question as FR0's sweep.
  - Stages axis: not material.
- **What would separate the alternatives:**
  - (a) Does any other container (zone contents, future bundles) hold ids that a derived write can delete?
  - (b) Is an automatic anchor delete, the sweep, retained under the frame the design phase takes?
  - (c) Does a group need to survive losing members below its minimum?
- **Intent bearing:** INTENT-SILENT. Both deleting paths are server-side, so Q1 a (door parity) does not discriminate between the alternatives. Nothing captured names containers.
- **Depends on / blocks:** Depends on: PS406, PS407 (F4); PS313 (F17). Blocks: PS317 (F20; the map's F4 -> F20 edge is this defect).
- **Evidence (defects/contradictions):** D42; C46; D40 (a later waypoint minted with the dead id would silently join the group [I]).

### PS409. What does a behaviour attach to, and how does it join the substrate?
- **Track / layer:** A / seam ; behaviour, flow, path, link, anchor
- **Covers:** S11; F30 (the attachment half: the three attachment shapes live today); map sections 2.4 and 3.5; the envelope's S1.Q2 correction and envelope flag F3
- **The question:** Today a behaviour attaches in three ways: config stored per instance on an anchor (spawn), a code table keyed per type (TOWERS by node.type), and an action stored per instance in content. None attaches to a link, a path or a flow. Survey Q2 put behaviour and events inside the substrate. How behaviour joins it (packs on anchors, attachments to flows or paths, or something else) is open.
- **Why it is open:**
  - The three attachment shapes: spawn on a waypoint (validate.js:143-173, 220-236); TOWERS by type (kinds.mjs:49-51, 72); content action (validate.js:135) [M-read].
  - Every simulation behaviour is stored intent plus a derivation over the document, the clock and the code revision (map 2.4) [M-read R4].
  - Movers read spawn, link src/dst/via/closed and anchor positions. They read neither flow, nor control, nor roles (spawners.mjs:30-49) [S].
  - A content write grants or removes behaviour per instance: `action` (W5) and `input` (W6) (validate.js:136-137) [M-read G3]. A retype grants or removes behaviour per type (D45) [M-run G3].
  - No code walks links across link boundaries, and no flow pair or multi-link path exists (map 3.4) [M-read]. The director's use case has no host today.
  - The rulings: a capability contributes layers and behaviour (DECISIONS.md:183); roles "are not behaviours a node implements" (:231); two pack families, appearance and routing, both derived and stateless, with policy left out (:278-284) [M-read].
  - The envelope's correction of 2026-09-25: Q2's option text had embedded "packs on anchors". Per the correction, the director's clarification (a visual flow element along a declared flow) "shows it may be wrong", and "HOW they join it ... is open and carried to design".
- **Alternatives:**
  1. three shapes: config per instance on an anchor, a code table per type, and an action per instance in content (status quo).
  2. behaviour as a pack contribution to an anchor's composition, per type, with per-instance config where needed.
  3. behaviour attached to a declared flow (src:dst) and realised along its derived path.
  4. behaviour attached to a path, derived or pinned: the path then needs a stable address.
  5. behaviour attached to a link end (link, end), or to a link or cable.
  6. behaviour as a stage or capability of its own, registering over lower layers.
  7. behaviour at document level, referencing anchors, as reveal is today.
  8. several of these at once, one per kind of behaviour.
  9. other.
- **Recorded positions:**
  - RULED 2026-09-19 (DECISIONS.md:183-191; date [M-read, this part]): a capability contributes layers and behaviour "derived from the document". "A capability that needed stored state would be a different and more expensive class, and none is proposed."
  - RULED 2026-09-22 (DECISIONS.md:278-284): "Two families are in scope": appearance and routing, both derived and stateless. Policy is left out.
  - RULED 2026-09-22 (DECISIONS.md:247-255; date [M-read, this part]): "PER TYPE, not per instance". The map's F30 cites this for behaviour. The text at those lines concerns routing permission: "All servers behave alike, and the table lives with the type definition".
  - The ruled scope (appearance and routing, stateless) and the survey's reach (Q2 c: behaviour and events) are stated side by side here. Envelope flag F1 notes that DECISIONS.md does not yet record the wider reach.
  - DIRECTOR LEANING (2026-09-25, seeds S12): "packs can extend anchor behaviour too, not just restrict."
  - DIRECTOR ANALOGY (2026-09-25, seeds S12, on stages as capabilities): "B is more akin to the Kubernetes model I think, where the analogy is that pods are primitives, and deployments extend them etc."
  - DIRECTOR STATEMENT (2026-09-25, seeds S16): "paths are logical, flows are specific instances of traffic".
- **Under each frame:** [I]
  - FR0: the available targets are an anchor instance (spawn), a node type (TOWERS), a content region (action) and the document (reveal). A link is stored, but a split or collapse rewrites it: the src-side piece keeps the id, and the planner cannot tell a re-put from a loss (map 7.2, "re-put / lineage") [M-read]. An attachment to a link would go through those rewrites. No declared flow and no multi-link path exist, so a flow element along a multi-hop flow has no host (map 3.4) [M-read].
  - FR1: adds a declared flow (src:dst) with its own identity, and a path derived over stored links. A behaviour could attach to the flow (declared, stable) and be realised along the path (derived). Anchors and links stay available as targets, with link identity still subject to split and collapse.
  - FR2: pipes are stored, with their anchors as their identity, and links are derived chains. An attachment to a link binds to a derived thing whose extent changes when an anchor starts or stops continuing; seeds S7 lists the binding alternatives. Anchors, pipes, flows and the document stay stable targets.
  - FR3: pipes are stored; cables (links) are declared with their own identity; LAG and VLAN are logical constructs; a path is logical; flows are "specific instances of traffic" (S16). The targets with declared identity are anchor, pipe, cable, logical construct and flow. Under S16's wording a flow may itself be the traffic, so the flow element could be the flow's own presentation rather than a separate attachment. A cable's identity changes when an author terminates or splices it (PS312), so an attachment to a cable goes through those operations. Under S16's wording, a flow that is itself traffic has no declared identity separate from the traffic.
  - Stages axis: under FIXED stages, behaviour attaches to the outputs of the fixed stages (anchor, link, path, flow). Under stages AS CAPABILITIES, a behaviour (traffic along flows, or a pilot's own pathing) could register as a stage that reads lower stages (seeds S12, alternative B).
- **What would separate the alternatives:**
  - (a) For each behaviour (spawner, mover, tower, combat, reveal, content action, and the director's flow element): which entity must still exist for the behaviour to keep running when topology changes, for example when a split cuts the link a mover is travelling?
  - (b) Does any behaviour need per-instance configuration that no type can supply?
  - (c) Does a behaviour need to be addressable by agents (CLI, REST) as a noun of its own (Q3 a and b)?
  - (d) Will a second, different set of behaviours run over the same connections? This is the separating test in seeds S12.
- **Intent bearing:**
  - Q2 c (envelope rationale: "The target reaches through behaviour and events; policy stays out.").
  - Q1 d (extensible physics: a new behaviour arrives without an engine change).
  - The director's clarification (2026-09-25, verbatim): "One of the things I want to be able to do is "declare a path or flow" and have that path/flow - multihop across routed junctions/nodes - have a visual flow element along them."
  - The director's question (2026-09-25, seeds S12, verbatim): "So links, paths, flows are themselves modular decoupled capabilities injected onto our wire primitives with anchors?"
- **Depends on / blocks:** Depends on: PS401, PS402 (F2, as F30); PS403-PS405 (F3); PS417 (F29); PS213, PS218 (F9); PS220 (F36); PS106 (S1); PS101 (S2); PS103 (S12); PS114 (S14); PS109 (S16).
  - The map records F30 as depending on F29, because spawn is one of F30's three attachment shapes. This register places the general question first because the travel-unit, arming, spawn and time entries each read its answer; the coupling runs both ways.
  - Blocks: PS419-PS421 (F31), PS324-PS326 (F41) (as F30); PS411-PS413 (F27), PS414, PS415 (F28), PS417 (F29), PS221 (S13) [I].
- **Evidence (defects/contradictions):** D6 (a clone copies spawn onto any role); D12 (a collapse strands spawn); D45 (a retype grants or removes tower behaviour); D47 (CLI and server disagree on where content may attach).

### PS410. Is the director's visual flow element the same construct as a mover?
- **Track / layer:** A / seam ; behaviour, appearance, flow
- **Covers:** S11 (the director's use case); F27 (movers as the only thing that travels); map section 3.5; map 7.1 FLOW
- **The question:** The director's use case is a visual flow element along a declared multi-hop flow. Today the only thing that travels is a mover: a spawner emits it, it travels one link, and it is consumed at the far end. It is open whether the flow element is a mover, a presentation of the flow, or something else.
- **Why it is open:**
  - The director's clarification of 2026-09-25 (envelope, verbatim; quoted under Intent bearing).
  - Movers are the only thing that travels. Each travels ONE link's path, oriented away from the armed end, and is consumed at the far end (map 3.5) [M-run R4].
  - A mover is a closed form of (spawner, t), with id `${spawnerId}#${k}` (movers.mjs:9-35, 107-163). MOVERS is {packet:{hp}} (kinds.mjs:62-66), so movers carry the pilot's combat state [M-read].
  - FLOW has four senses (map 7.1):
    - (a) the declared direction boolean;
    - (b) traffic, built as spawners and movers without the name, and disjoint from (a) [M-run];
    - (c) a declared src:dst pair, with no shape anywhere;
    - (d) direction inherited along a run, ruled and unbuilt.
  - The reveal trace already animates along one link with no mover identity (reveal.mjs:37-39; reveal.js:95-110) [M-read]. It is an existing example of a moving presentation that is not a mover.
  - The browser computes movers in run mode only (movers.js:65-70) [M-read].
- **Alternatives:**
  1. no flow element exists, and movers are the pilot's traffic along one link (status quo).
  2. the flow element is movers emitted along the flow's derived path, with a spawner at the flow's src.
  3. the flow element is a presentation of the flow (an animated appearance along its path, like the reveal trace), with no per-packet identity.
  4. both: a presentation for every declared flow, plus movers as the pilot's traffic, which may follow flows.
  5. the flow is itself traffic (S16's wording), and movers are its instances.
  6. other.
- **Recorded positions:**
  - Record, H15 scope (BOARD.md:849): "packet movement over the graph" is outside H15 [M-read].
  - DIRECTOR STATEMENT (2026-09-25, seeds S16): "paths are logical, flows are specific instances of traffic".
  - No other position.
- **Under each frame:** [I]
  - FR0: there is no declared flow, so alternatives 2-5 have no host (map 3.4) [M-read].
  - FR1: a flow is declared src:dst, its path is derived over stored links, and a flow element travels that path.
  - FR2: as FR1, with the path running over derived links (chains of pipes).
  - FR3: the path is a logical route over cables, and cables run through pipes, so the element's geometry is the cables' routes through pipes. Under S16's wording the flow is itself a traffic instance.
  - Stages axis: under stages AS CAPABILITIES, a flow element (or movers along flows) could be a stage over the flow stage.
- **What would separate the alternatives:**
  - (a) Does the flow element need per-packet identity (hp, aim target, death), or only a visual?
  - (b) Does it need to be visible outside run mode?
  - (c) Must "lots of permutations of flows" render at once, without a per-packet simulation cost (seeds S10 readability)?
  - (d) Does the element travel continuously, or once, as the reveal does?
- **Intent bearing:**
  - The director's clarification (2026-09-25, verbatim): "One of the things I want to be able to do is "declare a path or flow" and have that path/flow - multihop across routed junctions/nodes - have a visual flow element along them." and "Use case here is that we construct a geomtric network of wires or links, and then just declare or reason with lots of permutations of flows between the leaves/endpoints."
  - Q2 c (behaviour in reach). Q3 b (visibility).
- **Depends on / blocks:** Depends on: PS409 (S11); PS109 (S16); PS213, PS218 (F9); PS122 (F10); PS220 (F36). Blocks: PS411-PS413 (F27); PS222 (S10) [I].
- **Evidence (defects/contradictions):** none.

### PS411. What unit does a mover travel?
- **Track / layer:** seam ; behaviour, link, path, flow
- **Covers:** F27 (mover travel unit); map section 3.5
- **The question:** A mover travels one link and stops at its far end, even when the far end is a waypoint in the bend role that joins the next link. It is open whether traffic travels a link, a run, a path, a flow's path, or something else.
- **Why it is open:**
  - Movers travel one link and stop. A split shortens the route from 472.45 px to 240 px [M-run R4 d].
  - progress is a fraction of one link (movers.mjs:157), although it is described as distance along the route (rules.mjs:94) (C19) [M-read]. aimAt picks the mover with the highest progress FRACTION (rules.mjs:88-102) [M-read].
  - One drawing has two stored encodings, one link via W or two links meeting at W, depending on history [M-run R7; R1 P7]. So today how far a mover travels depends on history [I, from R4 d and map 3.4].
  - No code walks links across link boundaries (map 3.4) [M-read].
  - Movers run against the declared flow whenever the armed end is the flow head (D10) [M-run]. Spawners emit on control links (D9) [M-run].
- **Alternatives:**
  1. per-link travel (status quo).
  2. per-run travel: continue through pass-throughs until a junction or an endpoint.
  3. per-path travel: across junctions and nodes, which needs a forwarding choice (PS412).
  4. per-flow travel: along a declared flow's derived path.
  5. per-cable travel (FR3): along one cable's route through pipes.
  6. other.
- **Recorded positions:**
  - RULED 2026-09-22 (ATOMICS.md:312-322; BOARD.md:834-841, director): a run is derived, never stored, and opposing declarations fragment it.
  - RULED (ATOMICS.md:260, section tagged [DESIGNED 2026-09-22]): declared flow is the only direction a rule may read.
  - Record, H15 scope (BOARD.md:849): packet movement over the graph is outside H15.
  - Record text: junction forwarding is "owed before anything in engine/ reads it" (ATOMICS.md:169-171, 340-349).
  - AGREED (seeds naming note, 2026-09-25; recorded in the seeds' own words, not as a director quotation; not in DECISIONS.md; the seeds header reads "Every entry is UNDECIDED"): two layers of routing -- links through pipes, and paths over links.
- **Under each frame:** [I]
  - FR0: link and run differ, because a pass-through may be two stored links, depending on history. Per-run travel needs a run derivation that does not exist.
  - FR1: link as in FR0. Path and flow become available units from the added layers.
  - FR2: a derived link is a maximal chain through continuing anchors, so per-link and per-run travel coincide by construction.
  - FR3: a cable's route through pipes is one unit. Per-path travel crosses cables at the anchors where they meet.
  - Stages axis: under stages AS CAPABILITIES, the travel unit could follow from which stage a behaviour registers over.
- **What would separate the alternatives:**
  - (a) In the pilot, does a mover emitted at one leaf need to reach another leaf through junctions?
  - (b) Does any use case want traffic to stop at a pass-through?
  - (c) Stored in each of its two encodings, does the same drawing give the same travel under the alternative? This is the history test from R4 d.
- **Intent bearing:** The director's clarification (2026-09-25, verbatim): "multihop across routed junctions/nodes". Q2 c (behaviour in reach).
- **Depends on / blocks:** Depends on: PS201 (F6), PS117, PS211 (F7), PS205, PS212 (F8), PS213, PS218 (F9), PS225 (F25), PS226, PS227 (F26) (as F27); PS409, PS410 (S11); PS109, PS113 (S16). Blocks: PS414, PS415 (F28) (as F27).
- **Evidence (defects/contradictions):** C19; D9; D10.

### PS412. What decides where traffic goes next at an anchor where connections meet?
- **Track / layer:** seam ; behaviour, path, anchor
- **Covers:** F27 (junction forwarding; how `routable` relates to the "routing capability")
- **The question:** Junction forwarding (clone, round robin, route) is designed and unbuilt. `routable` (topology, permission, write) and the "routing capability" (forwarding) have not been reconciled. It is open what decides the next hop for traffic at a meeting point, and whether that sits with topology or separately.
- **Why it is open:**
  - Forwarding is designed and unbuilt: "engine semantics are intended but unspecified", and it is "owed before anything in engine/ reads it" (ATOMICS.md:169-171, 340-349) [M-read]. BOARD.md:849 excludes it from H15 [M-read].
  - routable owns "the permission table, the derivation, and the write" (DECISIONS.md:255-257). The "routing capability" means forwarding (ATOMICS.md:353-354) [M-read].
  - Prior art: prism ROUTE {src, dst, hops[]} (RouteFactory.js:20-31), explicitly not borrowed (DECISIONS.md:126) [M-read].
  - Seeds S10: equal-cost routes need a deterministic tie-break that every viewer computes.
  - Junctions are derived for waypoints only; a node with three terminations gets no junction (map F16) [M-read].
- **Alternatives:**
  1. no forwarding: traffic stops at the far end of its link (status quo).
  2. clone to every outgoing connection.
  3. round robin.
  4. route by what the traffic knows (its destination, for example a flow's dst).
  5. first found, or a declared or derived choice per junction.
  6. traffic follows a declared flow's derived path, so the junction does not choose.
  7. forwarding in the same capability as topology and permission, or in a separate one.
  8. other.
- **Recorded positions:**
  - Record design (ATOMICS.md:340-349): designed, unbuilt.
  - DIRECTOR LEANING (2026-09-25, seeds S12): "packs can extend anchor behaviour too, not just restrict." The seeds' example of an extension ("a router forwarding flows, a load balancer fanning one out", S6c open item 3) is Claude's text, not the director's.
  - AGREED (seeds naming note, 2026-09-25; recorded in the seeds' own words, not as a director quotation; not in DECISIONS.md; the seeds header reads "Every entry is UNDECIDED"): two layers of routing -- links through pipes, and paths over links.
- **Under each frame:** [I]
  - FR0: forwarding chooses among stored links at a waypoint. Nodes get no roles (map 3.3) [M-read].
  - FR1: a flow's derived path fixes the hop sequence, so forwarding reduces to following it, and a junction choice matters only for traffic with no declared flow.
  - FR2: as FR1, over derived links.
  - FR3: routing happens at two layers, cables through pipes (authoring) and paths over links (traffic), and forwarding is part of the second. S16 notes that one routing capability reused at two layers would test S12.
  - Stages axis: under stages AS CAPABILITIES, forwarding could be a stage or capability that a router composition contributes. Under FIXED stages, it would be a contribution into the path stage.
- **What would separate the alternatives:**
  - (a) Is there traffic with no declared flow (the pilot's spawners) that still has to cross junctions?
  - (b) Does a load balancer, the pilot's tower (H13), fan traffic out, or only fire?
  - (c) Is the next hop a function of the traffic (its destination), of the junction, or of a declaration?
- **Intent bearing:**
  - The director's clarification (2026-09-25, verbatim): "multihop across routed junctions/nodes".
  - The director's statement (2026-09-25, verbatim): "We are building a full fidelity network system".
  - The S12 leaning quoted above.
  - Q2 c keeps policy (permit/deny) out; it does not exclude routing by destination.
- **Depends on / blocks:** Depends on: PS213, PS218 (F9), PS225 (F25), PS226, PS227 (F26) (as F27); PS219 (S10); PS103, PS104 (S12); PS113 (S16). Blocks: PS414, PS415 (F28) (as F27). Related (overlapping, not merged): PS125.
- **Evidence (defects/contradictions):** none (unbuilt).

### PS413. When an emitter has several candidate connections, which does emission use: one, several, or all?
- **Track / layer:** seam ; behaviour, link
- **Covers:** F27 (which link a spawner uses); D11; C17
- **The question:** At a waypoint with several links, the first terminating, non-closed link in linksAt order is used. That order differs between the browser's maintained index and a model that scans. It is open how an emitter chooses among several connections.
- **Why it is open:**
  - spawnersOf takes the first terminating, non-closed link in linksAt order (spawners.mjs:34-35) [S].
  - Index order differs from scan order after a put [M-run R4 c] (D11). relations.mjs:77 claims the index is insensitive to order (C17).
  - The CLI's `draw movers` and `draw combat` scan, and can pick a different link than the browser (map 4.4 #16) [M-run R4 c].
  - Undo restores content but not collection order (D43) [M-run G1]; what that does to linksAt order and spawner choice is [I].
  - Emission runs away from the armed end and ignores roles, flow, control and via membership (map 4.4 #4) [M-run].
- **Alternatives:**
  1. first found in linksAt order (status quo).
  2. a deterministic order that does not depend on history (for example by id): index and scan agree; the choice then follows id order rather than any authored preference.
  3. emit along every candidate (clone).
  4. a declared choice stored with the spawn, as (link, end).
  5. derived from a declared flow that starts at the anchor.
  6. arming refused where more than one candidate exists (see PS415).
  7. other.
- **Recorded positions:** none. The order claim at relations.mjs:77 is a code comment.
- **Under each frame:** [I]
  - FR0: the candidates are the stored links at the waypoint.
  - FR1: as FR0, and a flow starting at the anchor could name the direction.
  - FR2: the candidates are derived links whose identity changes with topology, so a stored choice needs a binding (S7).
  - FR3: the candidates are cables ending at the anchor, each with a declared identity.
  - Stages axis: not material.
- **What would separate the alternatives:**
  - (a) Do two browsers with different histories agree on the emitted link? Not measured ([I] in the map).
  - (b) Does the pilot need one emitter to feed several links?
  - (c) Is the choice intent (the author picks it) or derivable?
- **Intent bearing:** Q1 a (door parity): index and scan differ, and the browser and CLI differ. The Round-1 anchor, the VISION north star ("derived physics that everyone watching computes identically"), also bears.
- **Depends on / blocks:** Depends on: PS201 (F6, as F27); PS411, PS412 (F27); PS409 (S11). Blocks: PS414, PS415 (F28) (as F27).
- **Evidence (defects/contradictions):** D11; C17; D43.

### PS414. Do drawing and behaviour predicates read one derived role set?
- **Track / layer:** seam ; anchor, behaviour, appearance
- **Covers:** F28 (roles as drawing states versus predicate inputs); C2; C42
- **The question:** B211 made junction supersede endpoint for drawing, and the same role set feeds the arming predicate. So a waypoint with three terminations draws as a junction and is refused as a spawner. It is open whether one role derivation serves both drawing and behaviour, or each consumer reads its own.
- **Why it is open:**
  - Above 2 terminations, waypointRoles returns ['junction'] alone (geometry.mjs:479) [M-run]. The same set feeds the predicate (geometry.mjs:314-316 vs :468-479) [M-read].
  - The record and comments say a 3-termination waypoint is "a junction AND an endpoint" (ATOMICS.md:175), that a T "holds both roles", and that "a junction can still be armed" (geometry.mjs:475-476; situation.mjs:123-124). The code returns single roles, and onEndpoint(junction) is false (C2) [M-run].
  - "An endpoint is the src/dst of an open link" (validate.js:209-212; txn.mjs:111-114) describes a per-link endpoint, while the aggregate role at 3 terminations is 'junction' (C42) [M-read].
  - Projections to a single role map junction to 'bend' (geometry.mjs:103-106, 534) [M-read].
  - "Role" names both a per-link role (src, dst, via) and the aggregate role at a point (map 7.2) [M-read].
- **Alternatives:**
  1. one role set with precedence (junction supersedes endpoint), read by both drawing and predicates (status quo).
  2. one role set that can hold several roles at once (junction AND endpoint), with drawing resolving precedence separately.
  3. the drawing resolution separated from the role set: drawing reads a projection, and predicates read the full set.
  4. predicates read a lower-level fact (termination count, incidence) rather than roles.
  5. roles split across layers (the seeds S6 reading: bend is a pipe-layer fact; endpoint and junction are link-layer facts), with each consumer naming its layer.
  6. other.
- **Recorded positions:**
  - RULED (B211, BACKLOG.md:254, "Three rulings in one"; date not read): junction supersedes endpoint. The map's F28 says this was for DRAWING.
  - RULED 2026-09-22 (DECISIONS.md:229-242): roles are what the graph makes of ANY anchor.
  - DIRECTOR LEANING (2026-09-25, seeds S6, "for now"): "if wires are between anchors, then a link can only occur between endpoints and junctions in this model. For now I would think wires meeting at an anchor join there - however - a junction is actually links meeting, rather than wires." (Read wires as pipes.)
- **Under each frame:** [I]
  - FR0: one derivation over stored links, for waypoints only.
  - FR1: as FR0 at the link layer. The path and flow layers may add roles of their own (flow src, flow dst, transit).
  - FR2: under the S6 reading, bend is a pipe-layer fact and endpoint and junction are link-layer facts, so "the role set" becomes two sets at two layers.
  - FR3: an anchor carries pipe-layer facts (pipes meeting) and cable-layer facts (cables ending, meeting, passing) at once. For example, one cable passes through while others end there (S16).
  - Stages axis: under stages AS CAPABILITIES, each stage may publish its own roles, so "one role set" becomes one set per stage.
- **What would separate the alternatives:**
  - (a) For every consumer of roles (arming, layers, the sweep's wasBendOnly, CLI spawn, spawnersOf): does it want the single role after precedence, or the full set?
  - (b) Is there an anchor that is legitimately both a junction and an emitter?
- **Intent bearing:** INTENT-SILENT. The S6 leaning bears on which layer each role belongs to, not on whether drawing and predicates share one derivation. Q1 a bears on the arming gates (PS415), not on this split.
- **Depends on / blocks:** Depends on: PS201 (F6), PS117, PS211 (F7), PS306, PS307 (F16) (as F28); PS207 (S6). Blocks: PS415 (F28, the arming half); PS417 (F29) (as F28).
- **Evidence (defects/contradictions):** C2; C42; D8.

### PS415. What decides eligibility to emit, and at which doors is it decided?
- **Track / layer:** seam ; behaviour, anchor, writes
- **Covers:** F28 (arming eligibility; the four gates); D8
- **The question:** Four gates decide what may be armed: the browser's pilot rule, the CLI, the server (shape only), and emission itself. They disagree on junctions, T-bends and pass-throughs. It is open what makes an anchor eligible, and where the gate or gates live.
- **Why it is open:**
  - Browser: onEndpoint(roles) requires 'endpoint'. A junction and an agreeing pass-through are refused, and a thread plus a termination (a T) is accepted (input.js:603; situation.mjs:86, 126-127) [M-run R1, R2, R4, R5, R6].
  - CLI: its own structural predicate refuses a waypoint in ANY via and a waypoint on a ring only, and admits a junction and a two-link terminus (verbs.mjs:1589-1597) [M-read].
  - Server: shape only (validate.js:171-173, 236) [M-read].
  - Emission: the first terminating non-closed link, ignoring roles (spawners.mjs:30-49) [M-run].
  - The doors disagree: a junction or pass-through is refused in the browser but emits if armed via the CLI or REST, and a T arms in the browser but the CLI refuses it [M-run R4 b, b2] (D8).
  - tests/situation.test.js:115-167 assert the role set, never the arming (D8) [M-read].
- **Alternatives:**
  1. gates specific to each door (status quo).
  2. one predicate owned with the role derivation and read at every door.
  3. per-type permission decides: a composition permits or forbids emission.
  4. arming keyed on the termination count.
  5. arming a junction forbidden, or allowed with a declared outlet.
  6. no gate at arming time; eligibility decided at emission (inert and visible when ineligible).
  7. under FR1-FR3: eligibility is being the src of a declared flow, if emission attaches to flows.
  8. other.
- **Recorded positions:**
  - RULED 2026-09-22 (DECISIONS.md:237-260): permission per TYPE. Whether it covers emission is NOT-CLAIMED; the map does not say.
  - Record text (API.md:129-131, not a dated ruling): "An ENDPOINT waypoint may carry spawn".
  - No position recorded on 2026-09-25.
- **Under each frame:** [I]
  - FR0: eligibility reads waypoint roles over stored links.
  - FR1: eligibility may read flow declarations instead (the anchor is a flow src).
  - FR2: eligibility reads link-layer facts derived from pipes. An endpoint can become a pass-through when a new pipe joins, which flips eligibility.
  - FR3: eligibility could read cable ends (a cable terminates here) independently of the pipe count.
  - Stages axis: under stages AS CAPABILITIES, emission could declare which stage's facts it reads.
- **What would separate the alternatives:**
  - (a) Does any use case arm a junction, to emit into several links?
  - (b) After a write changes a role (collapse, split, threading), is the emitter meant to keep emitting? This is D8's consequence.
  - (c) Is arming a per-type permission or a per-instance choice?
- **Intent bearing:** Q1 a (door parity): four gates disagree.
- **Depends on / blocks:** Depends on: PS401, PS402 (F2), PS201 (F6), PS117, PS211 (F7), PS205, PS212 (F8), PS306, PS307 (F16), PS411-PS413 (F27) (as F28). Blocks: PS417 (F29) (as F28).
- **Evidence (defects/contradictions):** D8; C2.

### PS416. What governs removing a behaviour whose host no longer qualifies for it?
- **Track / layer:** seam ; behaviour, writes
- **Covers:** G3 (critic gap 3, map section 10.1: disarm is gated by the arm predicate); D12
- **The question:** At both human-facing doors, disarm is gated by the arming predicate. So a spawn stranded by a collapse (its waypoint is now a via and derives []) cannot be cleared from the browser or the CLI, and only a raw put through /commit or REST remains. It is open what governs removing a behaviour whose anchor no longer qualifies.
- **Why it is open:** These facts come from critic gap 3, [M-read] and not executed.
  - Browser: toggleSpawn has one caller (input.js:606), gated at :603 by onEndpoint, which needs roles to include 'endpoint'. A collapsed via waypoint derives [] (geometry.mjs:458-465, 523-524), so clicking it does nothing [M-read, unexecuted].
  - CLI: `draw spawn W --off` reaches the bend refusal at verbs.mjs:1589-1591 before the --off branch at :1599 [M-read, unexecuted].
  - REST and /commit: validate.js:236 checks shape only [M-read].
  - A collapse leaves spawn stored on a waypoint that has become a via. It emits nothing, yet situation.spawning and `.spawning` still report it armed (D12) [M-run].
  - D8's consequence, a spawner that keeps emitting after its waypoint becomes a junction and cannot be toggled off by click, is [I].
- **Alternatives:**
  1. disarm shares the arm gate at the browser and CLI, and only raw writes clear a stranded spawn (status quo).
  2. disarm ungated at every door.
  3. the write that strands the behaviour also removes it (a cascade, which is a derived write, F17).
  4. the stranded behaviour is kept and shown as a visible condition ("inert") that every viewer derives (compare the seeds S13 conditions).
  5. the attachment is chosen so that a role change cannot strand it (see PS417).
  6. other.
- **Recorded positions:** none.
- **Under each frame:** [I]
  - FR0: stranding happens when a collapse, split or threading changes a waypoint's derived role (D12) [M-run].
  - FR1: the same for behaviour attached to an anchor. A behaviour attached to a flow is stranded instead when its src or dst is deleted, or its path becomes unroutable (S13).
  - FR2: a behaviour attached to an anchor is stranded when pipes join or leave and the derived role changes; one attached to a flow, as in FR1.
  - FR3: a behaviour attached to an anchor is stranded when cables start or stop ending there (authored terminate and splice); one attached to a cable, when the cable is deleted or re-routed away from the anchor; one attached to a flow, as in FR1.
  - Stages axis: not material.
- **What would separate the alternatives:**
  - (a) After each write that changes a role, is the author expected to see the stranded behaviour, keep it, or lose it?
  - (b) Under each alternative, does undoing the stranding write restore emission?
- **Intent bearing:** INTENT-SILENT; a Round-2 candidate, since it asks how a behaviour behaves when its anchor stops qualifying. Q1 a (door parity) bears only on the fact that REST can clear what the browser and CLI cannot; nothing captured bears on the alternatives.
- **Depends on / blocks:** Depends on: PS414, PS415 (F28); PS417 (F29; forward reference: Part 4 takes arming and disarming before spawn attachment, and critic gap 3 reads both); PS315 (F19); PS221 (S13). Blocks: none.
- **Evidence (defects/contradictions):** D12; D8.

### PS417. What does a spawn configuration belong to?
- **Track / layer:** seam ; behaviour, anchor, link, flow
- **Covers:** F29 (where spawn attaches); D12; D6; C26
- **The question:** spawn is stored on the waypoint kind only. It means something only while the waypoint is a terminus that is not a ring end, and that role is derived: collapse, clone and threading change it. It is open what the configuration belongs to: the anchor, a link end, a flow, a pack instance, or the document.
- **Why it is open:**
  - spawn is stored on waypoints only, as {interval, speed, kind:'packet', since} (validate.js:143-173, 220-236), and is checked for shape only [M-read].
  - A collapse leaves an inert spawn on a via [M-run R1 P6, R4 e] (D12). A clone copies spawn onto any role (commands.js:471, 517-521) [M-run] (D6).
  - Nodes cannot spawn (validate.js:236) [M-read]. Converting a waypoint to a node cannot carry spawn, because spawn has no field on a node (map section 5; F41) [M-read G3].
  - The ruling calls a capability with stored state "a different and more expensive class, and none is proposed" (DECISIONS.md:186-191) [M-read]. Spawn is already stored per instance (map F29).
  - The API.md example puts spawn on a waypoint that is a via, which the same page forbids (C26) [M-read R1].
- **Alternatives:**
  1. on the waypoint, never validated against the derived role (status quo).
  2. on the anchor, validated against the derived role: refused or flagged when the role changes.
  3. on (link, end).
  4. on a pack instance in the anchor's composition, for any anchor kind, nodes included.
  5. as intent at document level that references an anchor.
  6. on a declared flow: the flow's src emits.
  7. on a cable end (FR3).
  8. other.
- **Recorded positions:**
  - RULED 2026-09-19 (DECISIONS.md:186-191; date [M-read, this part]): a capability with stored state is a different class, "and none is proposed".
  - Record text inside the policy HYPOTHESIS (DECISIONS.md:281-284, 2026-09-22; that paragraph says "Not designed, not ruled"): a derivable policy "would keep it stateless rather than making it the first pack to carry per-instance configuration".
  - The envelope's S1.Q2 correction (proposer, 2026-09-25) reads the director's clarification as a flow element attached to a declared flow rather than to an anchor. That reading is the proposer's, not a director ruling or leaning.
- **Under each frame:** [I]
  - FR0: alternatives 1-5 are available.
  - FR1: a flow's src is a stable, declared reference, so a spawn on a flow survives links being collapsed or split.
  - FR2: (link, end) binds to a derived link whose ends move with topology (S7). Anchor and flow stay stable.
  - FR3: (cable, end) binds to a declared identity whose ends move under authored terminate and splice.
  - Stages axis: not material beyond PS409.
- **What would separate the alternatives:**
  - (a) Which writes change the thing spawn is attached to today, and after each one does the author expect the spawn to follow, stay, or vanish?
  - (b) Can a node (for example a host) emit, when the network use case puts flows between leaves that may be nodes?
- **Intent bearing:** The director's clarification (2026-09-25, verbatim): "have a visual flow element along them" and "lots of permutations of flows between the leaves/endpoints". Leaves may be nodes, which cannot spawn today [I]. Q2 c (behaviour in reach).
- **Depends on / blocks:** Depends on: PS403-PS405 (F3), PS414, PS415 (F28) (as F29); PS409 (S11; mutual, see PS409). Blocks: PS409 (F30; mutual), PS418 (F30), PS427 (F37) (as F29).
- **Evidence (defects/contradictions):** D12; D6; C26.

### PS418. Where do a behaviour's tuning numbers live?
- **Track / layer:** A ; behaviour, vocabulary
- **Covers:** F30 (where a behaviour's numbers live); map section 2.4 "Tuning numbers"
- **The question:** Tower numbers are declared once, in code ("declared once and stored nowhere"). spawn stores interval and speed in each document, written in by the browser as defaults. VISION says that a behaviour expressible only by storing a number on a shape is a failure. It is open where behaviour parameters live.
- **Why it is open:**
  - kinds.mjs:8-16: the numbers are central, "declared once and stored nowhere" [M-read].
  - spawn stores interval and speed per document; commands.js:565-575 writes in the defaults of 900 ms and 1.4 cells/s [M-read].
  - VISION.md:74: a behaviour expressible only by storing a number on a shape is a failure [M-read].
  - The ruled pack families (appearance and routing, with policy left out; DECISIONS.md:278-284) do not place the per-type behaviour in engine/kinds.mjs [M-read].
  - The parity inputs are the document, the clock and the code revision (rules.mjs:19-25). Numbers held in code make the code revision a parity input [M-read].
- **Alternatives:**
  1. mixed (status quo): per-type numbers in a code table, and per-instance numbers stored on spawn.
  2. every behaviour number held per type or composition, in code.
  3. every behaviour number stored per instance, as declared intent.
  4. per-type defaults, with a per-instance override stored only when the author sets one.
  5. numbers contributed by a composition, through a registry the document references rather than stores.
  6. numbers as configuration at document level, in one place per document.
  7. other.
- **Recorded positions:**
  - RULED 2026-09-22 (DECISIONS.md:247-255): "PER TYPE, not per instance". The map's F30 reads this as covering behaviour; the text concerns routing permission (see PS409).
  - Record principle (VISION.md:74), cited above.
  - Code comment (kinds.mjs:8-16), cited above.
  - HYPOTHESIS (seeds S14, Claude's candidate): "a field is persisted only if it is intent that cannot be derived".
- **Under each frame:** For towers and spawners, the same under all frames. Where a behaviour attached to a flow exists (FR1-FR3), the flow's configuring spec (seeds S14) is a candidate home for numbers per flow, such as rate or speed [I]. Stages axis: under stages AS CAPABILITIES, a registered stage or capability could carry its own defaults [I].
- **What would separate the alternatives:**
  - (a) Does any author want two instances of one type with different numbers?
  - (b) Does changing a number in code change past simulation for every document, with the code revision as a parity input?
  - (c) Is each number intent (the author chose it) or physics (the engine defines it)?
- **Intent bearing:**
  - The director's statement (2026-09-25, seeds S14, verbatim): "Agree that derivations flow up - but a link, path or flow config would need to have some entity persisted into the document (minimal entity/spec) such that the derivation can actually occur."
  - The Q3 refinement: inputs may be persisted.
  - Q1 d (extensible physics).
- **Depends on / blocks:** Depends on: PS401, PS402 (F2), PS417 (F29) (as F30); PS114 (S14). Blocks: PS419-PS421 (F31), PS324-PS326 (F41) (as F30).
- **Evidence (defects/contradictions):** none.

### PS419. What instant does a behaviour's time count from?
- **Track / layer:** A ; behaviour
- **Covers:** F31 (how behaviours anchor to time); S11 (behaviour brings a clock into a model derived from the document); envelope flag F3
- **The question:** spawn.since is an instant per entity. reveal.origin is an instant per document, on the server clock. Towers use the global epoch tick and have no placement instant. It is open what instant a behaviour counts from.
- **Why it is open:**
  - spawn.since is per entity; reveal.origin is per document, on the server clock; towers use the global epoch tick and have no placement instant (rules.mjs:112-122) [M-read].
  - The server computes no simulation. The browser computes it in run mode only, and so does the CLI (map 2.4) [M-read R4].
  - The parity inputs are the document, the clock and the code revision (rules.mjs:19-25) [M-read].
  - With no placement instant, a new tower is folded as if it had been present for the whole window (D13) [M-run R4 probe2]; see PS421.
  - After an undo or redo, peers keep a stale reveal, because reversal broadcasts carry no reveal (D21) [M-run R3].
- **Alternatives:**
  1. mixed (status quo): an instant per entity for spawners, per document for reveal, and an origin-free global tick for towers.
  2. an instant stored per entity for every behaviour, towers included (a placement or recomposition instant).
  3. one instant per document.
  4. an origin-free global tick for every behaviour.
  5. an instant per declaration, for example per declared flow.
  6. other.
- **Recorded positions:**
  - Code comment (commands.js:549-551): since comes from the agreed clock, never Date.now().
  - Code comment (rules.mjs:19-25): the parity inputs.
  - The envelope's consequence, the proposer's reading of Q2 c on 2026-09-25: "behaviour brings time and a clock into the substrate, not only the document".
  - No ruling.
- **Under each frame:** For behaviour attached to an anchor or type, the same under all frames. Under FR1-FR3, a behaviour attached to a flow could take its instant from the flow declaration [I]. Stages axis: not material.
- **What would separate the alternatives:**
  - (a) Does any behaviour need to know when it began? Towers do not, today.
  - (b) Does undoing a behaviour's creation need to restore the simulation as it was before?
  - (c) Does any behaviour need to restart (reset its instant) without being deleted and re-created?
- **Intent bearing:** INTENT-SILENT. Q2 c and the envelope's consequence place time in scope only, and nothing captured bears on which instant.
- **Depends on / blocks:** Depends on: PS409 (F30, S11), PS418 (F30) (as F31). Blocks: PS324-PS326 (F41) (as F31).
- **Evidence (defects/contradictions):** D13 and D45 (towers have no instant; see PS421); D21 (peers do not receive the per-document instant after an undo).

### PS420. Which clock stamps a behaviour's instant, and which clock does each simulating door read?
- **Track / layer:** A / seam ; behaviour, writes
- **Covers:** F31 (D15, the CLI's host clock); S11 (the clock)
- **The question:** The browser stamps spawn.since from the agreed clock, and the CLI stamps it from the host's Date.now(). The server stamps reveal.origin with its own Date.now, and the CLI simulates on the host clock. It is open which clock stamps instants, and which clock each door that simulates reads.
- **Why it is open:**
  - The CLI stamps since from the host's Date.now() (verbs.mjs:1607), while commands.js:549-551 says since comes from the agreed clock, never Date.now() (D15) [M-read R3, R4].
  - The clock carriers:
    - the agreed instant: serverNow and Clock.seed (clock.js:55-68; sync.js:567);
    - server Date.now for reveal.origin and change.at (txn.mjs:558, 563);
    - the CLI host clock for spawn.since and `movers --at` (verbs.mjs:1486, 1526, 1607);
    - tick sizes: engine TICK_MS 100 (kinds.mjs:27-28), movers' paint floor 200 (movers.js:32), reveal TICK_MS 100 (reveal.js:29) (map 1.4 clock row) [M-read].
  - "The server derives spawners" (spawners.mjs:14-15) is contradicted: no server/ file imports spawnersOf, moversAt or combatAt (C16) [M-read].
- **Alternatives:**
  1. the agreed clock in the browser, the host clock at the CLI, and server Date.now for reveal.origin (status quo).
  2. one agreed, server-issued clock at every door.
  3. instants stamped by the planner at commit, not by the door.
  4. no stored instants (origin-free), so nothing is stamped.
  5. other.
- **Recorded positions:** Code comment (commands.js:549-551), cited above. No ruling.
- **Under each frame:** The same under all frames. Stages axis: not material.
- **What would separate the alternatives:**
  - (a) At the same wall time, on a spawn armed through the CLI, do `draw movers` and a browser show the same mover positions? Not run.
  - (b) Is the CLI's `--at` meant as simulation time or as wall time?
- **Intent bearing:** Q1 a (door parity). The Round-1 anchor, the VISION north star ("derived physics that everyone watching computes identically"), also bears.
- **Depends on / blocks:** Depends on: PS419 (F31). Blocks: none.
- **Evidence (defects/contradictions):** D15; C16.

### PS421. Does a change to the board change what the simulation has already shown?
- **Track / layer:** A ; behaviour
- **Covers:** F31 (the retroactive fold: D13, D45)
- **The question:** combatAt folds every tick over [now - window, now] using the current world. So placing a tower kills movers retroactively, and a retype resurrects movers, or kills them, in the past. It is open whether a change to the board changes what has already been shown. The map marks as NOT-CLAIMED whether the current behaviour is intended.
- **Why it is open:**
  - combatAt folds every tick with the CURRENT world (rules.mjs:160-198) [M-read].
  - A newly placed tower: movers beyond range drop from 11 to 0, and the earliest death is 138 ticks before now [M-run R4 probe2] (D13). Whether that is intended is NOT-CLAIMED; no ruling was found.
  - A retype away resurrects killed movers (dead 14 -> 0 at the same t). A retype to a tower kills movers in the past (earliest death 98 ticks before now) [M-run G3, engine level] (D45). What the canvas shows is [I].
  - fold() runs every TICK_MS and replaces this.deaths (movers.js:111, 128-133) [M-read].
  - Towers have no placement instant (rules.mjs:112-122) [M-read].
- **Alternatives:**
  1. the current board is folded over the whole window (status quo): past outcomes change with the board.
  2. each behaviour contributes only from its own instant onward (a placement or recomposition instant): the past stays fixed; each behaviour then stores an instant, which meets DECISIONS.md:189 ("A capability that needed stored state would be a different and more expensive class, and none is proposed") [I].
  3. the fold window resets at every board change.
  4. outcomes recorded as facts (deaths stored or cached): a consequence is stored, which is in tension with VISION.md:80-81, "a consequence is never sent".
  5. other.
- **Recorded positions:**
  - none; the map found no ruling.
  - Record principle (VISION.md:80-81): "a consequence is never sent".
  - Code comment (rules.mjs:8-17): behaviour is level-triggered, and event handlers are rejected.
- **Under each frame:** For towers and spawners, the same under all frames. Under FR1-FR3, a behaviour attached to a flow raises the same question when the flow's path is re-derived under it, which changes where past traffic "was" [I]. Stages axis: not material.
- **What would separate the alternatives:**
  - (a) Does an author or spectator expect a newly placed tower to have fired before it existed?
  - (b) Would an instant per entity (PS419) remove D13 and D45 without storing consequences?
  - (c) How far back can a change reach, and is the window bounded?
- **Intent bearing:** INTENT-SILENT; a Round-2 candidate, since it asks how the simulation behaves.
- **Depends on / blocks:** Depends on: PS409, PS418 (F30), PS419 (F31). Blocks: PS325 (F41, its behaviour option: "anchor it to a recomposition instant, or keep the origin-free fold").
- **Evidence (defects/contradictions):** D13; D45.

### PS422. What is a rule, and may it write?
- **Track / layer:** A ; behaviour, writes, vocabulary
- **Covers:** F32; map section 2.5
- **The question:** The word "rule" names at least seven constructs, and they split on whether they may write. Engine derivations may not. Run-mode situation rules, planner cascades and the browser split do. It is open what a rule is in the unified substrate, and whether it may write.
- **Why it is open:**
  - Engine derivations turn (world, tick) into facts and "may not write" (rules.mjs:1-35). This was ruled 2026-09-01 and is recorded only in that comment (C37) [M-read R6].
  - Constructs that do write:
    - the run-mode situation rules: the pilot rule arms a spawner, and the "second rule" places a tower (input.js:588-647);
    - the planner's cascades, sweep and collapse (txn.mjs:196-262);
    - the browser split (input.js:984-1033) [M-read].
  - Three shapes of input rule coexist: RECOGNIZE/KEYMAP tables, situation predicates, and DOM branches. There is "no dispatch table here on purpose" (input.js:535-537) [M-read].
  - The tower rule's predicate is vacuous: situation(null) always gives onOpenGround = true (input.js:637-638; situation.mjs:143) [S] (D39).
  - situation.mjs:15-21 rejects the method vocabulary of RULES.md:89-98 by name (C43) [M-read R4].
  - "Two exist" sits above a DERIVATIONS table that has held one entry since 42b70e1 (C18) [M-read].
  - RULES.md:17-25 says the prior-art pass was settled, while BOARD.md:899 says it is owed (C23) [M-read].
  - The kernel GRC rules have no production caller [M-read R2].
- **Alternatives:**
  1. several constructs share the word; derivations may not write, while input rules and planner passes do (status quo).
  2. a rule is a read-only, level-triggered derivation, and writes are a different named construct.
  3. a rule is a situation predicate plus the command it commits (an input rule).
  4. a rule is a row in a dispatch table.
  5. a method vocabulary (the RULES.md design), or an inert value with free predicates (situation.mjs).
  6. a rule may propose writes that the planner applies (the "propose" option of F17).
  7. other.
- **Recorded positions:**
  - RULED 2026-09-01 (code comment only, rules.mjs:32-35; C37): "a rule may not write".
  - Code comment (rules.mjs:8-17): event handlers are rejected.
  - Record text: RULES.md holds the input-meaning design as a candidate.
  - No position recorded on 2026-09-25.
- **Under each frame:** The same under all frames. Stages axis [I]:
  - Under stages AS CAPABILITIES, a stage's derivation is itself a construct like a rule: pure, level-triggered and stratified (seeds S12, "B demands").
  - Under FIXED stages, rules are contributions into fixed stages.
  - Seeds S12 also names two directions. One, "materialize DOWN" (for example the `w` gesture compiling a link into pipes), is shaped like a write; the other, "derive UP", is shaped like a read.
- **What would separate the alternatives:**
  - (a) For each construct called a rule: does it write, and if so, through which path?
  - (b) Does any planned behaviour need to write, for example a declaration that materialises down (S12)?
  - (c) Can every writing rule be expressed as a proposal that the planner applies?
- **Intent bearing:** Q1 c (fewer concepts): seven constructs share the word. Q2 c (writes and behaviour are in reach): the ruled "a rule may not write" sits beside writing constructs that Q2 now brings into reach.
- **Depends on / blocks:** Depends on: PS313 (F17, as F32); PS105 (S12, the stage directions). Blocks: PS423 (F33) (as F32).
- **Evidence (defects/contradictions):** C18; C23; C37; C43; D39.

### PS423. What is an event in the substrate?
- **Track / layer:** A ; behaviour, vocabulary
- **Covers:** F33; map section 2.6
- **The question:** Behaviour is deliberately level-triggered, and rules.mjs rejects event handlers. Survey Q2 names "behaviour and events" inside the substrate. Mover birth, arrival and death have no event, and draw:action has no registry. It is open what an event is here.
- **Why it is open:**
  - rules.mjs:8-17 rejects event handlers: facts are asked for, not announced [M-read].
  - The "events" that exist: the model change stream, the commit boundary, DOM input, draw:action (only 'help' is wired; main.js:115-130), transport messages, session-log notes and history records (map 2.6) [M-read].
  - There is no gameplay event. Birth and arrival have none, death is a fold result, and arrival is recorded nowhere [M-read R4 grep].
  - Transport is ordered deltas with a from-gap check, which is skipped for reversals (sync.js:633-644) [M-read].
  - `draw event` is held (B194) [M-read].
- **Alternatives:**
  1. no gameplay events, with behaviour derived over document and clock, and transport and DOM events outside the substrate (status quo).
  2. events as facts derived per tick (for example "mover m arrived at t"), asked for rather than announced; a consumer that must react at a moment reads the fact at each tick.
  3. a handler surface for subscribing to events, which is in tension with rules.mjs:8-17.
  4. events as stored records, like history, which stores a consequence.
  5. draw:action with a registry, making host-dispatched actions the event surface; the registry is a host-side surface outside the document.
  6. other.
- **Recorded positions:**
  - Code comment (rules.mjs:8-17): event handlers are rejected for rules.
  - Record: B194, `draw event`, held.
  - Survey intent, not a ruling: Q2 c, "behaviour and events".
- **Under each frame:** The same under all frames, except that FR1-FR3 add flows whose derived paths can change, which makes "a flow became unroutable" a candidate derived fact (seeds S13 conditions) [I]. Stages axis: under stages AS CAPABILITIES, a stage could publish derived facts (conditions) that other stages read [I].
- **What would separate the alternatives:**
  - (a) Does any consumer need to react at a moment (a score on arrival, a sound, a notification to an agent) rather than read state?
  - (b) Can every such need be met by a fact derived at tick t?
  - (c) What does an agent at the CLI need to observe? GR18 requires pack-derived state to reach the CLI (TRANSACTIONS.md:620).
- **Intent bearing:** Q2 c names events explicitly. That bears on whether an alternative with no event construct meets the pick; it does not choose a form.
- **Depends on / blocks:** Depends on: PS422 (F32, as F33); PS221 (S13). Blocks: none.
- **Evidence (defects/contradictions):** none.

### PS424. What shape does appearance derivation take across kinds, and how do competing contributions resolve?
- **Track / layer:** A ; appearance
- **Covers:** F34 (the four shapes; composes/priority, ruled and unbuilt; the priority representation, not ruled; the disagreement over the sole instance); F4 (the [OPEN] shared frame substrate for node, zone and group); map section 2.3
- **The question:** Four derivation shapes coexist. composes/priority per derived state is ruled and unbuilt, and its representation (an integer, or ordered named layers) is not ruled. It is open what shape appearance derivation takes across all kinds, and how contributions from several sources resolve.
- **Why it is open:**
  - The four shapes (map 2.3) [M-read R5]:
    - an attribute map, linkAppearance plus APPEARANCE_KEYS, for links only (geometry.mjs:414-449) [V];
    - a layer list, waypointLayers (:297-309);
    - shared predicates with emission per renderer, for nodes (kernel/renderer.mjs:26-48);
    - literal assembly per site, for zones and groups.
  - ATOMICS.md:386-388 keeps the layer list deliberately separate from an attribute set [M-read].
  - composes/priority per derived state was ruled 2026-09-22 and is unbuilt [V]. Its representation is "Not ruled" (DECISIONS.md:352-355). Deriving the router ring from routable is a hypothesis (:370-372) [M-read].
  - DECISIONS.md:317 and ATOMICS.md:372 name different sole instances, and BOARD.md:831 says "LINKS DONE" (C20) [V].
  - H15 excludes the pack, yet carries the permission table and composes/priority (BOARD.md:849-853) [M-read].
  - A frame substrate shared by node, zone and group is [OPEN] (HIERARCHY.md:146-147) [M-read].
  - There are two full renderers, plus partial ones (palette tile, ghost, favicon, CLI ASCII, turret aim) (map 2.3) [M-read].
- **Alternatives:**
  1. four shapes, by kind (status quo).
  2. the attribute map extended to every kind.
  3. composes plus priority per state, over layers, with links folded in.
  4. two levels: layers, each carrying an attribute map.
  5. one appearance substrate for all five kinds (HIERARCHY [OPEN]).
  6. priority as integers, or as ordered named layers.
  7. other.
- **Recorded positions:**
  - RULED 2026-09-22 (DECISIONS.md, "How two derived appearances resolve, ruled 2026-09-22"; date [M-read, this part]): composes and priority are declared per derived state; unbuilt.
  - Not ruled (DECISIONS.md:353-355; [M-read, this part]): the representation of priority. The record's caution, verbatim: "Priority as a bare integer is where this shape rots: two packs land on the same value, or one is inserted at 50 and silently reorders another. An ordered list of named layers avoids it and stays readable. Not ruled, because the first two packs do not need it." This is record text, not a ruling.
  - HYPOTHESIS (DECISIONS.md:370-372): the router's centre ring comes from `routable` when the anchor derives junction.
  - Record [OPEN] (HIERARCHY.md:146-147): the shared frame substrate.
- **Under each frame:** [I]
  - FR0: the kinds that need appearance are node, waypoint, link, zone and group.
  - FR1: adds flows and paths as visible things (Q3 b). Many flows sharing a link need a readable rendering (seeds S10).
  - FR2: adds stored pipes and derived links. Whether one or both are drawn is open.
  - FR3: adds pipes, cables and logical constructs (LAG, VLAN). The director's requirement is to visualise series, parallel/LAG, multiplex/VLAN and parallel links.
  - Stages axis: under stages AS CAPABILITIES, a stage may contribute the appearance of its own outputs (presentation as cross-cutting, seeds S1).
- **What would separate the alternatives:**
  - (a) Does any kind need both layers and attributes per layer?
  - (b) Do two contributions ever set the same attribute on one element, which needs a priority?
  - (c) Can lanes, bundle marks and multiplex tags (seeds S15 consequence D) be expressed in each shape?
- **Intent bearing:**
  - Q2 c (appearance in reach).
  - Q1 a (canvas and export parity) and Q1 c (fewer shapes).
  - Q3 b (a noun has to be visible).
  - The director requirement (2026-09-25, verbatim): "I think we need to be able to model, construct and visualise all 4 of those in the table."
- **Depends on / blocks:** Depends on: PS403-PS405 (F3), PS406-PS408 (F4) (as F34); PS222 (S10); PS110 (S15). Blocks: PS426 (F35) (as F34).
- **Evidence (defects/contradictions):** C20; C28; D16.

### PS425. Is selection-driven appearance derived state or session decoration?
- **Track / layer:** A ; appearance, vocabulary
- **Covers:** F34 (selection classes as derived appearance or as decoration; DECISIONS.md:319 versus :343-346; HIERARCHY.md:124-126 [OPEN])
- **The question:** DECISIONS.md:319 lists `.on-selected-path` and `.selected` among classes minted from state, while :343-346 rules selection session state that decorates. HIERARCHY.md:124-126 is [OPEN]. It is open whether selection-driven appearance is derived or decoration. This interacts with a persisted src:dst selection from which a path is derived.
- **Why it is open:**
  - DECISIONS.md:319 lists ".spawning, .on-selected-path, .selected and [data-unrevealed]" as classes minted from state. :343-346 says selection is session state and DECORATES [M-read, this part]. HIERARCHY.md:124-126 is [OPEN] (level or cursor) [M-read].
  - The session decoration classes are each set at their own site, and setState is the only shared helper (renderer.js:469-472) [M-read].
  - `.on-selected-path` lights the waypoints of one link only (renderer.js:180-192), and its CSS misses the wp-anchor and wp-junction layers (D30) [M-read].
  - doc.selection is stored status: no version bump and no undo (store.js:1281-1292). The browser ignores the `selection` broadcast (D23) [M-read].
- **Alternatives:**
  1. decoration classes set per site, with the selected path covering one link (status quo).
  2. selection classes as derived appearance, resolved by the same pipeline as other derived state.
  3. selection as decoration, with a separate derived appearance for declared paths or flows.
  4. selection drives a derived path only when it is persisted (Q3), and decorates otherwise.
  5. other.
- **Recorded positions:**
  - The record text at DECISIONS.md:319 and the ruling at :343-346 sit side by side (section ruled 2026-09-19, amended 2026-09-22) and disagree; not resolved here.
  - RULED 2026-09-22 (DECISIONS.md:344, 375-376): selection is session state that "belongs to the grid".
  - RULED [LOCKED] (TRANSACTIONS D15, TRANSACTIONS.md:375; lock date not carried): selection is status, persisted but not logged.
  - Survey intent (Q3 rationale, verbatim) is quoted under Intent bearing.
- **Under each frame:** [I]
  - FR0: selection highlights one link, and there is no multi-link path to light.
  - FR1-FR3: a selected or declared src:dst pair has a derived path to light across links or cables. Whether that is the same thing as a declared flow is F36, outside this part.
  - Stages axis: not material.
- **What would separate the alternatives:**
  - (a) Does every viewer see the highlighted path, or only the viewer who selected it?
  - (b) Does selection-driven appearance reach the export?
  - (c) Does it need a priority against derived states (PS424)?
- **Intent bearing:** The Q3 rationale (verbatim): "Though it must be derived/computed - its inputs may be persisted to the document: i.e a src:dst node pair may be selected and this persists as state in the control plane, so that a path can be derived across all viewers".
- **Depends on / blocks:** Depends on: PS424 (F34); PS220 (F36, S9). Blocks: PS426 (F35).
- **Evidence (defects/contradictions):** D30; D23.

### PS426. Who owns a look: the stylesheet or the derived attribute?
- **Track / layer:** A ; appearance
- **Covers:** F35
- **The question:** B172 says a kind resolves to a CSS class and the stylesheet owns the look. B235 says the derived attribute is the one authority. The two give different canvas and export results. It is open which owns a look, element by element.
- **Why it is open:**
  - B172: a kind resolves to a CSS class, and the stylesheet owns the look (validate.js:150-161). B235 (84f9dd7): a derived attribute is the one authority [M-read].
  - The results diverge (D16, D27-D31) [M-run for D16 (kernel level) and D27; M-read for D28-D31].
  - TOKENS and style.css hold separate literals, and KERNEL_CSS is a vendored copy (theme.mjs:33-41) [M-read].
  - `.waypoint.spawning .wp-ring { stroke-width: 3 }` overrides the derived ring width (D29) [M-read].
  - After B235 the favicon frame has no stroke-width (D27) [M-run R5].
  - The spawner comment says document state "may eventually want its own colour", while the stylesheet owns the look (C31) [M-read].
  - The comment that a 1x1 frame "takes the stylesheet weight" was superseded by B235 (C30) [M-read].
- **Alternatives:**
  1. both policies coexist, element by element (status quo).
  2. derived attributes everywhere, with CSS only for session decoration.
  3. CSS classes minted from derived state everywhere, with the export carrying the stylesheet.
  4. a split along the line between intrinsic and derived appearance.
  5. other.
- **Recorded positions:** Record dispositions B172 (the stylesheet owns the look) and B235 (at 84f9dd7; the derived attribute is the one authority). Dates are not carried by the map. They are stated side by side and not resolved.
- **Under each frame:** The same under all frames. Stages axis: not material.
- **What would separate the alternatives:**
  - (a) Does the export need to match the canvas pixel for pixel (A5 perceptual parity)?
  - (b) Does a theme (light and dark, or user CSS) need to override derived looks?
  - (c) How many elements are styled by both today?
- **Intent bearing:** Q1 a (door parity: the canvas and the export render one document). The Round-1 anchor A5 perceptual parity also bears.
- **Depends on / blocks:** Depends on: PS424, PS425 (F34) (as F35). Blocks: none.
- **Evidence (defects/contradictions):** D16; D27; D28; D29; D30; D31; D33; C30; C31.

### PS427. What does the design phase carry about policy while AG-1 keeps it out of scope?
- **Track / layer:** A ; flow, behaviour, vocabulary (anti-goal AG-1)
- **Covers:** F37 (policy; AG-1)
- **The question:** Policy (permit or deny over packets and flows) is out of scope as anti-goal AG-1, and is held as a hypothesis that it derives from declared flow pairs. It is open whether and how the design phase accounts for it. The word `policy` also names an unrelated module.
- **Why it is open:**
  - DECISIONS.md:281-284: policy is out of scope; the hypothesis is that it derives from flow pairs; "Not designed, not ruled, and not to be assumed by anything built before it" [M-read, this part].
  - AG-1 (envelope S5): "Policy: permit/deny over flows (Q2 stopped at behaviour and events)". Its composes-with target reads "revisit once declared flow pairs and derived paths exist".
  - Keeping policy stateless is framed as avoiding "the first pack to carry per-instance configuration" (DECISIONS.md:283), while spawn already stores configuration per instance (map F29, F37) [M-read].
  - `policy` names engine/policy.mjs (groupAfterRemoval, collectionCap), as well as sign-in policy and soft-delete policy (map 1.4) [M-read].
  - The envelope's S1.Q3 reads Q3's example as sitting close to the policy hypothesis, and as wanting the declaration-and-derivation mechanism without permit/deny semantics. That is the proposer's reading.
- **Alternatives:**
  1. policy absent, with the hypothesis kept in DECISIONS.md only (status quo).
  2. the recorded hypothesis: policy derived from declared flow pairs, revisited once flows and paths exist (AG-1's trigger).
  3. policy as a pack with configuration per instance.
  4. the design phase records which flow and path structures would or would not admit the hypothesis later, without designing policy.
  5. the engine/policy.mjs sense of the word renamed, or kept.
  6. other.
- **Recorded positions:**
  - RULED 2026-09-22 (DECISIONS.md:281-284): out of scope.
  - HYPOTHESIS (the director's, recorded there): "policy may be DERIVABLE the way routing is -- declare flow pairs on a control-plane graph and let the permissions follow deterministically".
  - Anti-goal AG-1 (survey envelope, 2026-09-25).
- **Under each frame:** [I]
  - FR0: no flow pairs exist for the hypothesis to derive from (map 3.4) [M-read].
  - FR1: declared src:dst flows exist above links.
  - FR2: as FR1, over derived links.
  - FR3: flows are traffic instances over logical paths, so permit or deny would act on declared flows or on paths.
  - Stages axis: under stages AS CAPABILITIES, policy could arrive later as a capability without a core change. Under FIXED stages, it would need a slot in the stack.
- **What would separate the alternatives:**
  - (a) Does any flow shape the design phase considers make deriving policy from flow pairs impossible later (AG-1's revisit condition)?
  - (b) Is `policy` as an identifier needed for the future sense?
- **Intent bearing:** Q2 c (envelope rationale: "The target reaches through behaviour and events; policy stays out."). AG-1.
- **Depends on / blocks:** Depends on: PS226, PS227 (F26), PS417 (F29), PS220 (F36) (as F37). Blocks: none.
- **Evidence (defects/contradictions):** none.

### PS428. What is the cursor-addressed story step, and what is it called?
- **Track / layer:** A ; behaviour, vocabulary
- **Covers:** F38
- **The question:** The b188 survey moved "beat" to the shipped wall-clock reveal, and left the cursor-addressed story step unnamed, with the naming owed. It is open whether that step exists in the unified substrate, how it relates to reveal, and what it is called.
- **Why it is open:**
  - The b188 survey moved "beat" to the wall-clock reveal (survey:78-81). The story step is unnamed, and its naming is owed (:133, 152, 203) [M-read R6].
  - doc.reveal is {origin, beats[{interval, caption?, ids}]}, produced by a paced commit (txn.mjs:514-576). Only app/src/reveal.js imports model/reveal.mjs (map 1.4) [M-read].
  - Reveal is addressed by time, from an instant per document (PS419).
- **Alternatives:**
  1. reveal addressed by time only, with the story step captured, unbuilt and unnamed (status quo).
  2. a cursor-addressed story as a separate construct.
  3. the story step as a cursor over reveal beats: one construct with two ways of addressing it.
  4. the story step expressed as declared flows or paths shown in sequence [I].
  5. other.
- **Recorded positions:** Ruled in the b188 survey (survey:78-81; date not carried by the map): "beat" names the shipped reveal. No position recorded on 2026-09-25.
- **Under each frame:** The same under all frames, except that FR1-FR3 provide declared flows or paths that a story could step through [I]. Stages axis: not material.
- **What would separate the alternatives:**
  - (a) Does any use case need a step the presenter controls (a cursor) rather than wall-clock pacing?
  - (b) Is the step shared across viewers, as selection is, or held per viewer?
- **Intent bearing:** INTENT-SILENT. Q2 c places reveal inside the reach (the envelope's S1.Q2 lists reveal among the pilot's physics), and nothing captured bears on the story step.
- **Depends on / blocks:** Depends on: none (as F38). Blocks: none.
- **Evidence (defects/contradictions):** none directly. D14, D21, C33 and C39 are defects of the built reveal.

## 6. PS5xx Programme

These entries were written at assembly. They carry three programme-level questions: the order in which the other questions are taken, the agent-door surface that every derived stage meets, and how the surfaced defects relate to the programme. Like every other entry, they decide nothing.

### PS501. In what order are the programme's questions taken: extract a pack from what is built, design the write seam first, build the pipeline first, or some other order?
- **Track / layer:** programme ; writes, all connection layers
- **Covers:** F39 (map section 6, "Programme"); the envelope's Q1 note that the first increment is unstated
- **The question:** Successive dated positions in the record pull toward different first steps: extract a pack from the built junction, split and collapse; answer how a pack writes before building the mechanism; or build the framework and pipeline first. The frame (FR0-FR3) and the stages axis are now also open. Which question is taken first, and what does the first increment have to show?
- **Why it is open:**
  - DECISIONS.md:191-195 (ruled 2026-09-19): "Sequenced deliberately, and the order is the ruling", with three steps, the third (folding `waypoint` into `node`) named as the one-way door (:201-204) [M-read at assembly].
  - DECISIONS.md:206-211 and :218 (amended 2026-09-19, "after the junction shipped"): "the sequence is now **extract, not design-first**", and "designing the seam before writing a single write is how a registry-first programme would have gone wrong" [M-read at assembly].
  - DECISIONS.md:286-288 (amended 2026-09-22): "the claim that packs compose must be earned by composing two rather than asserted in advance" [M-read at assembly].
  - DECISIONS.md:374-376 (in the section ruled 2026-09-22, "How two derived appearances resolve"): "build the framework and the pipeline first, and glyph decomposition then becomes pack design rather than a change to the mechanism" [M-read at assembly].
  - HANDOVER.md:185-187 (handover of 2026-09-24): "**Why it cannot be deferred.** Build the pack mechanism now and it will be built for pure functions, because those are the only packs that exist -- then the split arrives and does not fit" [M-read at assembly].
  - BOARD.md:853 cites AG-5, which resolves to an unrelated item (C22) [M-read].
  - Constraints named by the map (F39): GR18 says pack-derived state must reach the CLI (TRANSACTIONS.md:620; CLI.md:10-22); A5 says it must be perceivable, and two A5 gaps are deferred (HANDOVER.md:290-297, 343-357) [M-read]. PS328 carries the agent-door question.
  - The things an extraction would lift out are frame-dependent: under FR2 split and collapse are not operations, and under FR3 they return as authored operations (PS312, PS117) [I].
  - The envelope's Q1 interpretation: "What the pick does not say is which one the FIRST increment has to demonstrate end to end, and that is a Round-2 disambiguation candidate."
  - The outcome axis AX6, accepted by the director without amendment: "Irreversible changes to stored documents (38 live diagrams at 2026-09-25) are few, named, and last."
- **Alternatives:**
  1. (status quo) The staged order of DECISIONS.md:191-204 as amended to "extract, not design-first", with the H15 items (H15.2, H15.5, H15.7) open and no programme order beyond them.
  2. Extract a pack from the built junction, split and collapse (map F39 option).
  3. Answer the write question first (map F39 option; the handover's position).
  4. Build the pipeline first, with glyph decomposition later (map F39 option; DECISIONS.md:374-376).
  5. Settle the frame first (PS101-PS106, PS125-PS130), then take extraction or the write seam inside it.
  6. Fix the surfaced defects first, independently of the programme (PS503).
  7. Choose the first increment by the Q1 payoff it demonstrates end to end (the envelope's Round-2 disambiguation).
  8. other.
- **Recorded positions:**
  - RULED 2026-09-19 (DECISIONS.md:191-195): "the order is the ruling".
  - RULED, amended 2026-09-19 (DECISIONS.md:206-218): "extract, not design-first".
  - RULED, amended 2026-09-22 (DECISIONS.md:286-288): composing two packs earns the claim.
  - RULED 2026-09-22 (DECISIONS.md:374-376, in the appearance-resolution section): "build the framework and the pipeline first", stated there for glyph decomposition.
  - Handover position, 2026-09-24 (HANDOVER.md:185-187): the write question "cannot be deferred". It is a handover position, not a DECISIONS.md ruling.
  - Stated side by side, not resolved: "extract, not design-first" (2026-09-19) and "cannot be deferred" (2026-09-24). The handover records a further frame that bears on both, a pack that PROPOSES rather than writes (HANDOVER.md:194-205), as "not settled" (PS313).
  - Director instruction, 2026-09-25 (envelope, verbatim): "I don't want this survey to decide the design before we perform that next entire phase."
- **Under each frame:**
  - FR0: the extraction candidates are the built junction roles, split and collapse; the write seam is the planner.
  - FR1: new layers are additive above stored links, so path and flow could be built without changing stored shape [I].
  - FR2, FR3: stored shape changes for every link (seeds S3: "38 live diagrams change stored shape"), a one-way door that AX6 places last [I]; extraction targets differ (PS312).
  - Stages axis: under stages AS CAPABILITIES the registration mechanism precedes every stage built on it; under FIXED the stack precedes the contributions into it [I].
- **What would separate the alternatives:** For each ordering, list which open entries must be answered before its first increment can land, and which one-way doors it crosses and when (PS303, PS305, PS327, and any stored-shape change of FR2 or FR3). Does the first increment demonstrate one of the four Q1 payoffs end to end, and which? Would a pack extracted under FR0 survive a change of frame (PS312)?
- **Intent bearing:** Q1 abcd (all four payoffs are required, and the envelope leaves "which one the FIRST increment has to demonstrate" to Round 2); AX6 ("few, named, and last"); the director's instruction quoted above, which places design after the survey.
- **Depends on / blocks:** Depends on: PS103 (S12), PS313 (F17), PS328 (G1). Blocks: PS503.
- **Evidence (defects/contradictions):** C10 (the capability probe cited as evidence for the staged order was paper-only), C22, C37.

**PS502 -- cross-reference to PS328.** The question "Is every derived stage readable at the agent doors (CLI and REST), as GR18 and A5 require?" is not a separate entry. It is carried in full by **PS328** ("Which derived connection state must an agent be able to read through REST and the CLI, and computed where?"), which covers critic gap 1 of map section 10.1: today roles are not readable at REST or the CLI, and nor are incidence roles, the flow head at a point, or any run or path. What the programme level adds is that every stage a frame introduces (a pipe, a derived link or a declared cable, logical constructs, paths, flows, and any condition such as "unroutable", PS221) enlarges PS328's surface: PS106 records that "a new derived stage would also be a new agent-door surface", and PS103 and PS217 record the stable addresses that derived entities would need. PS501 lists GR18 and A5 among the sequencing constraints.

### PS503. How do the defects surfaced by the map and by verification relate to the programme: fixed independently, held as evidence for the design phase, or both?
- **Track / layer:** programme ; all layers
- **Covers:** map sections 8 (C1-C48) and 9 (D1-D48); the verification findings VF1-VF4 of section 7.3
- **The question:** Many surfaced defects are symptoms of open questions in this register (for example D41 of PS316, D42 of PS408 and PS317, D8 of PS415). Is each defect fixed on the current code independently of the programme, held as evidence until the design phase chooses, or triaged between the two? Whether to register them in BACKLOG is a separate question, recorded here and not answered.
- **Why it is open:**
  - The map lists D1-D48 as "New defects surfaced" and C1-C48 as contradictions and stale record (map sections 8, 9). A search of dev/BACKLOG.md at `a986fb3` for "ENOTEMPTY" and "ids.has" (VF1, VF2) returned no hits [M-read at assembly]; the map's D42 names searches that found no record entry. That none of the others is registered is carried from the verification pass [V] and was not re-searched here.
  - Some defects live in code a frame change would remove or rewrite: the collapse composition (D41), the split (D2, D4) and the ack collisions they cause (D3, D44) have no carrier under FR2, and under FR3 split and collapse return as authored operations (PS312, PS316) [I].
  - Others sit in surfaces that every frame keeps [I]: the CLI's host clock (D15); the agent-list leak (D22); the migration short-circuit (D24); the canvas/export differences (D27-D33); the failing CI gate (VF1); the delete gesture that throws (VF2) [V].
  - The sweep leaving dead group members, with a boot refusal when the file is the only diagram (D42) [M-run G2], holds under FR0 and FR1, and under FR2 and FR3 while an automatic sweep of anchors remains (PS408) [I].
  - A fix scoped to the current code can meet the programme's write seam: the H15.2 fix as worded would mirror about 50 lines of plan() and, following the send-projection convention, cause a spurious second collapse (VF4) [V].
  - The handover's stated mechanism for the B113 flake is false; the registered flake is B164 (VF3) [V].
  - Severity against real documents is unmeasured: the map's rates describe its own generators, not the 38 live diagrams (map 4.3, 10.2), and D42's first signal is expected to be the boot skip [I].
- **Alternatives:**
  1. (status quo) Recorded in the map and in this register only; none registered in BACKLOG; none fixed.
  2. Register every defect and fix each on the current code, independently of the programme.
  3. Register every defect; fix now those whose carrier every frame keeps (for example D15, D22, D24, VF1, VF2), and hold those whose carrier depends on the frame (for example D2, D3, D41, D42, D44) as evidence for the design phase.
  4. Hold every defect as design-phase evidence and fix none until a frame is chosen.
  5. Triage by harm first: stored data and boot (D1, D24, D42), then parity between doors (D2, D3, D8, D11, D16, D44), then presentation (D27-D33).
  6. other.
- **Recorded positions:** none on these defects. Record: H15.2 (BOARD.md:812, TODO) proposes shipping collapseAtWaypoint to the client, which VF4 bears on. Registration in BACKLOG is a separate decision, not taken here.
- **Under each frame:**
  - FR0: every defect lives in a surface the frame keeps.
  - FR1: the same, with new layers above stored links.
  - FR2: the split and collapse defects (D2, D4, D41, D44, and D1's collapse half) lose their carrier; cascade, sweep, transport, clock and appearance defects remain [I].
  - FR3: split and collapse become authored operations, so D2 and D41 lose their carrier; D42 depends on whether an automatic sweep remains (PS408) [I].
  - Stages axis: no difference.
- **What would separate the alternatives:** A table of every D, C and VF id against FR0-FR3: does its carrier survive under each frame? Does it damage stored data or boot, parity between doors, or presentation only? Would its fix on the current code be undone by any alternative the design phase is weighing (as VF4 is for H15.2 as worded)? How often does it reach the 38 live diagrams (not measured)?
- **Intent bearing:** INTENT-SILENT on the choice. Q1 a (door parity) bears on what several defects are (D2, D3, D8, D11, D16, D44), not on whether they are fixed before or within the programme; AX6 names the risk class of stored-data defects; the director's instruction ("I don't want this survey to decide the design before we perform that next entire phase") governs the survey, not defect fixing.
- **Depends on / blocks:** Depends on: PS501 (F39). Blocks: none.
- **Evidence (defects/contradictions):** all of section 7: D1-D48, C1-C48, VF1-VF4.

## 7. Defects and contradictions surfaced (evidence, not decisions)

These are symptoms, indexed so the design phase can see which questions each one evidences. None is a decision, and none is ranked here.
The map lists D1-D48 as new defects (its section 9) and C1-C48 as contradictions and stale record (its section 8); VF1-VF4 come from the verification pass of 2026-09-25 and are not in the map's defect list.
**None of them is registered in BACKLOG, and registering them is a separate decision, not taken here** (PS503). For VF1 and VF2 this was checked at assembly: dev/BACKLOG.md at `a986fb3` has no hit for "ENOTEMPTY" or "ids.has" [M-read at assembly]; for D42 the map names the searches that found no entry; for the rest it is carried from the verification pass [V].
The summaries paraphrase the map's rows; the map's mark follows each. The last column lists the entries whose Covers or Evidence field names the id; PS503 (the defects and the programme) bears on every row and is not repeated.

### 7.1 Map defects (D1-D48)

| Id | One-line summary | Evidences |
| --- | --- | --- |
| D1 | A collapse can commit a document that validateDoc refuses (self-conflict; duplicate-through-bend), and a node delete reaches it. [M-run] | PS105, PS117, PS205, PS209, PS316, PS317, PS318 |
| D2 | A split can collapse an unrelated authored two-link terminus and delete the half that kept the original id; the originating tab diverges. [M-run] | PS105, PS109, PS117, PS118, PS127, PS212, PS217, PS312, PS314, PS315, PS320, PS321 |
| D3 | The ack diff drops any server-derived op whose op:kind:id key matches a client-sent op, and no resync follows. [M-run] | PS117, PS127, PS314, PS321 |
| D4 | Split naming: the new link and both halves receive one minted name, the original name is lost, and the halves drop flow and control. [M-run] | PS109, PS117, PS118, PS212, PS217, PS312, PS314, PS404 |
| D5 | The pin clear is local-only; threading through `set via` or /commit also leaves pinned:true, so no door clears it on the server. [M-run] | PS115, PS116, PS118, PS313, PS322 |
| D6 | cloneSubgraph drops a link's flow and control and copies spawn onto a cloned waypoint whatever its role. [M-run] | PS114, PS118, PS217, PS409, PS417 |
| D7 | The orphan sweep keeps the src and dst waypoints of a deleted closed ring. [M-run] | PS214 |
| D8 | Arming gates disagree: the browser refuses a junction and arms a T; the CLI does the reverse; the server has no gate. [M-run] | PS104, PS111, PS207, PS211, PS212, PS414, PS415, PS416 |
| D9 | Spawners emit data-plane packets on control-plane links. [M-run] | PS101, PS108, PS112, PS226, PS411 |
| D10 | Movers run against the declared flow whenever the armed end is the flow head. [M-run] | PS101, PS112, PS223, PS225, PS411 |
| D11 | The link a spawner emits along depends on linksAt order, which differs between the browser index and a scanning Model (CLI). [M-run] | PS113, PS127, PS201, PS219, PS319, PS413 |
| D12 | A collapse leaves spawn on a waypoint that has become a via; it emits nothing yet still reads as armed. [M-run] | PS117, PS221, PS409, PS416, PS417 |
| D13 | A newly placed tower is folded as present for the whole transit window, so movers already past it vanish. [M-run] | PS325, PS419, PS421 |
| D14 | A paced commit reveals whole-entity replacement puts as if they were created. [M-run] | PS428 |
| D15 | CLI spawn stamps `since` from the host's Date.now(), not the agreed clock. [M-read] | PS127, PS420 |
| D16 | Canvas and export draw different endpoint ring weights for one valid document (width 5 vs 3). [M-run, kernel level] | PS120, PS201, PS226, PS306, PS323, PS328, PS424, PS426 |
| D17 | `draw about <link>` prints the path as "undefined,undefined -> ...". [M-run, expression] | PS328 |
| D18 | The `link path` response cannot express a closed link's closing segment or rounding. [M-read] | PS214 |
| D19 | CLI `links` and REST context misdescribe links that only thread a waypoint. [M-read] | PS116, PS201, PS328 |
| D20 | The server accepts a waypoint or node inside a spanned node's footprint; the client index calls that cell occupied. [M-run] | PS203 |
| D21 | Undo/redo broadcasts carry no reveal and from:null, so peers keep a stale reveal. [M-run] | PS319, PS321, PS419, PS428 |
| D22 | The websocket reclaim path pushes the whole, unfiltered agent list to every session (the B116 leak at one call site). [M-read] | PS503 only |
| D23 | The browser never consumes the `selection` or `viewers` events the server broadcasts. [M-read] | PS120, PS220, PS227, PS425 |
| D24 | shedRetired short-circuits, so migrateSpawn never runs when migrateNames changed something; templates are never migrated. [S mechanism; consequence I] | PS327 |
| D25 | CLI `rename` refuses links and waypoints with a pre-B187 reason, while `set <ref> name` accepts both. [M-read] | PS404 |
| D26 | `name` is required at full validation, contradicting its own comment and the API example. [M-run] | PS114, PS115, PS404 |
| D27 | After B235 the favicon frame has no stroke-width. [M-run] | PS120, PS403, PS426 |
| D28 | Node and zone name labels differ between canvas and export in colour, family, baseline and backing pill. [M-read; visual I] | PS120, PS404, PS426 |
| D29 | `.waypoint.spawning .wp-ring { stroke-width: 3 }` overrides the derived endpoint ring width. [M-read] | PS120, PS426 |
| D30 | Selected-path, armed and spawning recolouring misses `.wp-anchor` and `.wp-junction`. [M-read; visual I] | PS120, PS425, PS426 |
| D31 | Canvas links carry no stroke-linecap/linejoin; the export emits round/round. [M-read; visual I] | PS120, PS426 |
| D32 | The drag/stamp ghost emits an unfitted glyph (B205 residue). [M-read] | PS120, PS403 |
| D33 | The zone label update path uses literals where the render path uses STD values (they agree today). [M-read] | PS120, PS426 |
| D34 | The pipette can arm an unrenderable or wrong-kind type ('text', or 'waypoint' stored as a node type). [M-read steps] | PS324, PS326, PS401, PS402 |
| D35 | A turret's glyph rotation is never cleared, including after a retype. [M-read] | PS325, PS401 |
| D36 | After a reveal trace, a control-plane link may render solid (an inline dasharray is never removed). [I] | PS226 |
| D37 | The H15.4 twin-agreement test never drives the undeclared or one-declared pair, where roles and collapse disagree. [M-read] | PS208, PS211, PS323 |
| D38 | A second, undeclared pairKey with a different encoding exists. [M-read] | PS107, PS215, PS323 |
| D39 | The run-mode tower rule's situation predicate is vacuous; the real gate is a DOM test plus occupancy. [S] | PS422 |
| D40 | CLI mint has no collision check, and put upserts, so a colliding id would replace an entity. [I] | PS408 |
| D41 | Collapses in one plan() are computed against an unadvanced projection; when two touched waypoints share a link, links are lost or duplicated in four forms. [M-run] | PS105, PS117, PS209, PS228, PS312, PS315, PS316 |
| D42 | The orphan sweep deletes a grouped bend without trimming the group; validateDoc then refuses the file, which is skipped at boot (or the server refuses to boot). [M-run] | PS105, PS221, PS317, PS318, PS319, PS408 |
| D43 | Undo restores content but not collection order when a deleted entity was not last in its collection. [M-run] | PS117, PS219, PS319, PS413 |
| D44 | The originating browser diverges when one selection deletes a node and a bend of the link the collapse keeps. [M-run] | PS105, PS117, PS127, PS228, PS314, PS320, PS321 |
| D45 | Retype flips tower behaviour retroactively in both directions (resurrects or kills movers in the past). [M-run, engine level] | PS325, PS401, PS409, PS419, PS421 |
| D46 | The CLI type vocabulary is closed on create and open on retype (`set type`). [M-read + M-run] | PS324, PS326, PS402 |
| D47 | CLI `region` refuses content on a node without span; the server accepts content on a 1x1 node. [M-read + M-run] | PS409 |
| D48 | REST PATCH labels every field write 'move <kind>', so a retype or re-route enters history as a move. [M-read] | PS324 |

### 7.2 Map contradictions and stale record (C1-C48)

| Id | One-line summary | Evidences |
| --- | --- | --- |
| C1 | "Two undeclared links are always a bend" (ATOMICS.md:281) vs waypointRoles returning ['endpoint']. | PS117, PS207, PS208, PS211, PS213, PS223, PS306 |
| C2 | A 3-termination waypoint is "a junction AND an endpoint", and a junction "can still be armed" vs code returning single roles. | PS111, PS201, PS207, PS212, PS306, PS414, PS415 |
| C3 | "cannot arise": linking to a bend always splits vs REST, CLI, commit and chainHop accepting it unsplit. | PS117, PS118, PS123, PS205, PS212, PS312, PS314, PS407 |
| C4 | Two terminations "is never a meet" vs the matrix's two-link junctions (opposing declarations, differing planes). | PS111, PS207, PS209, PS211, PS306 |
| C5 | Split: "Both halves get NEW ids" vs "THE SRC HALF KEEPS THE ORIGINAL ID". | PS109, PS117, PS217, PS312, PS313, PS314 |
| C6 | "split copies name" (HANDOVER.md:337) vs halves re-minted with one name and the original lost. | PS109, PS117, PS217, PS314, PS404 |
| C7 | `closed` is "(render-only)" vs five rules treating it as topology. | PS114, PS115, PS214 |
| C8 | Names described as optional in several comments vs required on all five kinds (B187). | PS114, PS115, PS404 |
| C9 | "the validator's closed type vocabulary" vs an open slug since 67d229d. | PS401, PS402 |
| C10 | The capability probe's citation runs in a circle; its text was deleted; the probe was paper-only. | PS103, PS104, PS403, PS405, PS501 |
| C11 | scan-writers checks for `anchor`, a second polyline builder and `wire` are claimed and not built. | PS102, PS107, PS121, PS122, PS204, PS301 |
| C12 | HIERARCHY's {from,via,to} route and "link = route + identity + closed" vs code's src/dst, name, flow and control. | PS102, PS106, PS116, PS122, PS204 |
| C13 | "a waypoint belongs to at most one link" vs sharing relaxed by B207. | PS116, PS123, PS201, PS205 |
| C14 | A junction is "more than two path directions" vs B211 termination counting. | PS111, PS122, PS201, PS205, PS207 |
| C15 | Sovereignty claims (engine free of kernel; model and engine independent) vs engine/ importing both. | PS101, PS103, PS323 |
| C16 | "The server derives spawners" and "both peers load it" vs no server/ import of the simulation. | PS101, PS127, PS227, PS420 |
| C17 | The relations index "mirrors model EXACTLY (order-insensitive)" vs order-sensitive spawner choice. | PS219, PS413 |
| C18 | "Two exist" vs a DERIVATIONS table that has held one entry since 42b70e1. | PS101, PS103, PS422 |
| C19 | "progress is distance along the route" vs progress as a fraction of one link. | PS112, PS122, PS411 |
| C20 | H15.9 "LINKS DONE" for composes/priority vs no resolver; two documents name different sole instances. | PS103, PS120, PS311, PS424 |
| C21 | "REVISIT when the capability pack lands (H15.6)" vs H15.6 being a different, DONE item. | PS103, PS104, PS323 |
| C22 | BOARD.md:853 cites AG-5, which resolves to an unrelated item. | PS501 |
| C23 | Owed items and the owed prior-art pass (RULES.md, BOARD.md) vs B163 and RULES.md saying done; "no rAF or setInterval" vs paintloop.js using both. | PS422 |
| C24 | The TRANSACTIONS contract lists plan() without the sweep and the collapse, and derived ops bypass per-op validation. | PS105, PS314, PS317 |
| C25 | "deleting one makes it a bend with nothing reconfigured" (DECISIONS.md:233) vs the collapse reconfiguring the document. | PS105, PS109, PS117, PS209, PS312, PS315 |
| C26 | The API.md example document is invalid three ways (no names, off-grid coordinates, spawn on a via). | PS417 |
| C27 | API.md's frames, glyphs and "group not rendered" vs the code. | PS403, PS406 |
| C28 | The recorded z-order (zone, links, group, node) vs both renderers drawing the group below links. | PS120, PS406, PS424 |
| C29 | Stale record lines (labels deferred; router as a waypoint with a glyph; "eight specifications"; board-empty claims; "until the matrix lands"). | PS503 only |
| C30 | Stale renderer and geometry comments (stylesheet weight; junction rung "RESERVED, not drawn"; `role` kept for bboxOf). | PS407, PS426 |
| C31 | The spawner comment ("RED by default ... may eventually want its own colour") vs kind:'packet' with the stylesheet owning the look. | PS426 |
| C32 | Cascade said to live in commands.js, and a `meta` command listed, vs neither existing there. | PS320 |
| C33 | An undone beat "sends exactly that" null, and a snapshot is broadcast, vs the reversal body carrying no reveal and a selection event instead. | PS319, PS321, PS428 |
| C34 | The realizers said to live in dev/design/sim vs only in the archive. | PS124, PS406, PS407 |
| C35 | The archive README's pre-purge commit 3adcdd7 is absent from live history. | PS124 |
| C36 | `draw trace` and `draw check` named in HANDOVER.md vs absent from the CLI's VERBS. | PS122 |
| C37 | "a rule may not write... Ruled 2026-09-01" is recorded only in a code comment, not in DECISIONS.md. | PS105, PS127, PS313, PS422, PS501 |
| C38 | X1 restated as "pure target state, no back-compat" vs its original, which carries a revival trigger. | PS305 |
| C39 | "Only CREATED entities are revealed" vs a filter `op === 'put'` that includes replacement puts. | PS428 |
| C40 | `link path` said to return "what the renderer would draw" vs the unrounded anchor polyline without closed. | PS122 |
| C41 | Anchor "has no identifiers" vs `anchor` as an identifier for the grid-position sense. | PS123, PS204, PS301, PS304 |
| C42 | "An endpoint is the src/dst of an open link" wording vs the aggregate role 'junction' at 3 terminations. | PS122, PS123, PS207, PS414 |
| C43 | The situation method vocabulary (RULES.md:89-98) vs its rejection by name in situation.mjs. | PS422 |
| C44 | The "orthogonal routing" principle vs polylines, diagonals and no production check. | PS102, PS113, PS202, PS206 |
| C45 | The sweep comment on closed rings vs wasBendOnly having no closed check. | PS214 |
| C46 | The B85 comment ("Asking whether a group would dissolve with NOTHING removed is the same question as whether it is under the minimum") holds only while every listed member exists. | PS317, PS408 |
| C47 | applyOps says it throws "rather than silently no-op'ing" vs a set or del on a missing id returning silently. | PS105, PS316 |
| C48 | "An undone collapse must be byte-identical to what stood before it" vs collection order not being restored. | PS117, PS319 |

### 7.3 Verification findings of 2026-09-25 not in the map (VF1-VF4)

Carried with the mark [V] (orchestrator-verified on 2026-09-25; not re-verified here). The ids are minted in this register.

| Id | Finding | Evidences |
| --- | --- | --- |
| VF1 | The CI gate has been red on 10 consecutive pushes: tests/browser.test.js and tests/route-oracle.test.js fail in teardown with ENOTEMPTY while removing the Chrome profile; 1003 of 1005 tests pass. [V] | PS503, PS501 |
| VF2 | Alt+right-click delete throws 'ids.has is not a function': input.js:661-664 passes an array to commands.deleteSelection. [V] | PS503, PS320 |
| VF3 | The handover's mechanism for the B113 flake is false: that test has no 3000ms timeout, and the registered flake is B164. [V] | PS503 |
| VF4 | The H15.2 fix as worded would mirror about 50 lines of plan() and, following the send-projection convention, cause a spurious second collapse. [V] | PS503, PS320, PS316, PS321 |

## 8. Intent coverage

### 8.1 Matrix

The director prefaced the Round-1 clarification (envelope, 2026-09-25, verbatim): "I'm not sure I answered correctly - but I hope my intent is there." The picks are read here as recorded, and the verbatim clarifications quoted in each entry carry the intent the director flagged.

What each entry's Intent bearing field says bears on it. Columns:

- **Q1 payoff (abcd):** a door parity (AX2), b expressiveness (AX3), c fewer concepts (AX5), d extensible physics (AX4). All four were picked.
- **Q2 reach:** c, behaviour and events inside the substrate; policy outside (AG-1).
- **Q3 nouns:** a something attaches, b an author or agent can see it, c derived, with inputs that may be persisted. "AX1" marks an entry citing the Round-1 axis AX1 (derived not stored), which the envelope pre-anchors to Q3.
- **Declare-a-flow use case:** the director's clarification (DS2, DS3) or the Q3 example of a persisted src:dst pair from which a path is derived for every viewer (DS1).
- **"full fidelity network system":** DS6.
- **Four relations:** the requirement to model, construct and visualise series, parallel/LAG, multiplex/VLAN and parallel links (DS7). "s" marks an entry citing another sentence of the same DS7 statement (links only between endpoints or junctions; a new link to a bend converts it to a junction; parallelism above pipes).

"x" means the entry cites it without naming an option. A value in parentheses means the entry says the pick places the question inside the reach, or bears only on the status quo, and does not bear on the choice. "-" means nothing cited. Marks were read from each entry's Intent bearing field at assembly, so they inherit each drafter's reading.

| Id | Q1 payoff | Q2 reach | Q3 nouns | Declare-a-flow | Full fidelity | Four relations | Intent-silent |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PS101 | c, d | c | - | - | x | - | no |
| PS102 | b, c | - | a, b, c | - | x | - | no |
| PS103 | c, d | c | - | - | - | - | no |
| PS104 | b, d | c | - | - | - | - | no |
| PS105 | a | - | c | - | - | - | no |
| PS106 | b, c | - | a, b, c | - | - | x | no |
| PS107 | c | - | a, b | - | - | - | no |
| PS108 | - | - | - | - | x | - | no |
| PS109 | a | - | a, b, c | - | - | x | no |
| PS110 | a, b | - | b | - | - | x | no |
| PS111 | - | - | - | - | - | x | no |
| PS112 | - | c | a, b, c | x | - | - | no |
| PS113 | a, c, d | - | - | x | - | - | no |
| PS114 | - | - | c, AX1 | - | - | - | no |
| PS115 | - | - | c, AX1 | - | - | - | no |
| PS116 | a | - | c | - | - | - | no |
| PS117 | a, c | - | AX1 | - | - | s | no |
| PS118 | a, c | - | - | - | - | - | no |
| PS120 | - | c | b | x | - | - | no |
| PS121 | c | - | - | - | - | - | no |
| PS122 | c | - | a, b | - | - | - | no |
| PS123 | c | - | a, b, c | - | - | - | no |
| PS124 | - | - | - | - | - | - | yes |
| PS125 | c, d | c | - | x | x | - | no |
| PS126 | b, d | - | - | - | x | - | no |
| PS127 | a, d | - | - | x | - | - | no |
| PS128 | a, d | - | - | - | - | - | no |
| PS129 | c, d | - | - | - | - | - | no |
| PS130 | c, d | c | - | - | - | - | no |
| PS201 | a | - | b | - | - | s | no |
| PS202 | - | - | - | - | - | - | yes |
| PS203 | (a) | - | - | - | - | - | yes |
| PS204 | a, c | - | - | - | - | s | no |
| PS205 | - | - | a, b | - | x | s | no |
| PS206 | - | - | b | - | x | x | no |
| PS207 | a, c | - | b | - | x | s | no |
| PS208 | - | - | - | - | x | - | no |
| PS209 | d | - | AX1 | - | - | - | no |
| PS211 | a | - | - | - | - | s | no |
| PS212 | a | - | - | - | x | s | no |
| PS213 | - | - | AX1 | x | - | - | no |
| PS214 | - | - | - | - | - | - | yes |
| PS215 | b | - | - | - | x | x | no |
| PS216 | d | - | - | - | - | x | no |
| PS217 | a | - | a, b, c, AX1 | - | - | s | no |
| PS218 | b | c | x | x | - | - | no |
| PS219 | a | - | - | x | - | - | no |
| PS220 | - | c | c | x | - | - | no |
| PS221 | - | - | - | - | - | - | yes |
| PS222 | - | - | b | x | - | x | no |
| PS223 | - | - | - | - | x | - | no |
| PS224 | - | - | - | - | x | - | no |
| PS225 | - | c | - | x | - | - | no |
| PS226 | - | c | - | - | x | - | no |
| PS227 | - | c | x | x | - | - | no |
| PS228 | (c) | - | - | - | - | - | yes |
| PS301 | c | - | a | - | - | - | no |
| PS302 | - | - | a, b | - | - | - | no |
| PS303 | c | - | - | - | - | - | no |
| PS304 | - | - | c | - | - | - | no |
| PS305 | - | - | - | - | - | - | yes |
| PS306 | a, c | c | - | x | - | s | no |
| PS307 | b | - | a, b, c | - | - | x | no |
| PS308 | a, d | c | - | - | x | - | no |
| PS309 | b, d | - | - | - | x | - | no |
| PS310 | d | c | - | x | x | - | no |
| PS311 | c, d | - | - | - | - | - | no |
| PS312 | a, c | - | c | - | - | s | no |
| PS313 | a, d | c | - | - | - | - | no |
| PS314 | a | c | c | - | - | s | no |
| PS315 | (a) | - | - | - | - | - | yes |
| PS316 | a, d | - | - | - | - | - | no |
| PS317 | (a) | - | - | - | - | - | yes |
| PS318 | a | - | - | - | - | - | no |
| PS319 | (a) | - | - | - | - | - | yes |
| PS320 | a | - | - | x | - | - | no |
| PS321 | a | - | - | - | - | - | no |
| PS322 | - | - | c | - | - | - | no |
| PS323 | a, c | - | - | - | - | - | no |
| PS324 | (a) | - | - | - | - | - | yes |
| PS325 | - | (c) | - | - | - | - | yes |
| PS326 | b, c | - | - | x | - | - | no |
| PS327 | - | - | - | - | - | - | yes |
| PS328 | a | - | b | x | - | - | no |
| PS401 | a, c, d | c | - | - | - | - | no |
| PS402 | a, d | - | - | - | - | - | no |
| PS403 | c, d | - | - | - | - | - | no |
| PS404 | a | - | b | - | - | - | no |
| PS405 | b | - | - | - | - | s | no |
| PS406 | (b) | - | - | - | - | - | yes |
| PS407 | - | - | a, b | - | - | x | no |
| PS408 | (a) | - | - | - | - | - | yes |
| PS409 | d | c | - | x | - | - | no |
| PS410 | - | c | b | x | - | - | no |
| PS411 | - | c | - | x | - | - | no |
| PS412 | - | c | - | x | x | - | no |
| PS413 | a | - | - | - | - | - | no |
| PS414 | - | - | - | - | - | - | yes |
| PS415 | a | - | - | - | - | - | no |
| PS416 | (a) | - | - | - | - | - | yes |
| PS417 | - | c | - | x | - | - | no |
| PS418 | d | - | c | - | - | - | no |
| PS419 | - | (c) | - | - | - | - | yes |
| PS420 | a | - | - | - | - | - | no |
| PS421 | - | - | - | - | - | - | yes |
| PS422 | c | c | - | - | - | - | no |
| PS423 | - | c | - | - | - | - | no |
| PS424 | a, c | c | b | - | - | x | no |
| PS425 | - | - | c | x | - | - | no |
| PS426 | a | - | - | - | - | - | no |
| PS427 | - | c | - | - | - | - | no |
| PS428 | - | (c) | - | - | - | - | yes |
| PS501 | a, b, c, d | - | - | - | - | - | no |
| PS503 | (a) | - | - | - | - | - | yes |

### 8.2 Round-2 candidates (intent the design phase will need from the director)

Every INTENT-SILENT entry: no Round-1 pick and no recorded director statement bears on the choice between its alternatives. Each is listed with its question; the entry holds the separating test.

- **PS124.** What standing does prior art have for the connection layers?
- **PS202.** Must connection geometry be orthogonal, and if so where is orthogonality produced or checked?
- **PS203.** Which cells does a multi-cell entity occupy, for placement and for connections?
- **PS214.** Is `closed` a drawing flag or a fact about topology?
- **PS221.** What happens to a declaration whose inputs can no longer satisfy it?
- **PS228.** What does "projection" name?
- **PS305.** Is an id-grammar change delivered in place on `/api/v1`, or behind a new API version?
- **PS315.** What triggers the collapse: a link-delete op, the resulting state, a genuine loss, or nothing?
- **PS317.** What validation does a derived write receive?
- **PS319.** Are undo and redo validated, and what does "restored" mean for an undo?
- **PS324.** What does a type change do to an anchor's existing links and permission?
- **PS325.** Does a recomposition take effect from an instant, or does the behaviour fold reread the whole window?
- **PS327.** When a stored shape changes, what happens to the log's stored inverses, and when is the migration code deleted?
- **PS406.** Are containers (zone, group) part of the anchor model, and can connections reach them?
- **PS408.** What keeps a container's membership true when a write the author did not request removes a member?
- **PS414.** Do drawing and behaviour predicates read one derived role set?
- **PS416.** What governs removing a behaviour whose host no longer qualifies for it?
- **PS419.** What instant does a behaviour's time count from?
- **PS421.** Does a change to the board change what the simulation has already shown?
- **PS428.** What is the cursor-addressed story step, and what is it called?
- **PS503.** How do the defects surfaced by the map and by verification relate to the programme: fixed independently, held as evidence for the design phase, or both?

### 8.3 Further Round-2 items named inside entries that are not intent-silent

These entries have intent that bears on them, and also name a point only the director can settle. They are listed so Round 2 can see them; listing them decides nothing.

- **PS108.** What the director's "a wire's spec is just its two anchors" covered: the generative spec only, or no configuring spec at all (seeds S15, "To clarify later").
- **PS117, PS212.** Under FR3, whether a passing cable terminates where a new link is drawn to it (seeds S16: a Round-2 candidate).
- **PS220.** Whether a persisted src:dst pair is a selection or a declaration (envelope, Round-1 tensions).
- **PS224.** Whether the layered model reopens the FRAGMENT ruling (seeds S6b: "only the director can").
- **PS227.** What "the control plane" means in DS1 (envelope, Round-1 tensions).
- **PS307.** Which multi-link server cases the permission table admits: a two-member aggregate to one switch, or two redundant uplinks (the entry names "a question for the director").
- **PS126.** Whether overlays and tunnels are in scope: DS6 bears in general, and no pick or statement names them.
- **PS501.** Which Q1 payoff the first increment must demonstrate end to end (the envelope's Round-1 interpretation names it a Round-2 disambiguation candidate).
- **PS111.** What "links meeting" counts at a junction once links can be parallel or aggregated (seeds S15 consequence C): DS7 and DS8 bear, and neither says what is counted (moved here from section 8.2 at audit).
- **PS123 (and PS106).** Whether "fewer concepts" (Q1 c, AX5) is a payoff the programme has to demonstrate while the Q3 noun test does not require a noun to delete special-case code (envelope S1, the third of the Round-1 tensions: "'fewer concepts' as a payoff alongside a noun test that does not require deletion").
- **PS127.** Whether "reconciliation + derivation can occur client-side" (seeds S19) covers writes as well as derivations, and whether the server and the CLI count as the edge.
- **PS128.** Whether a change to a document's declared pack set is a write (locked, versioned, undoable) (seeds S20, open sub-question 1).
- **PS129.** Whether a distribution unit also contributes declaration kinds, and whether the core is itself a declared unit (seeds S21, open items 1 and 3).


## 9. Anti-goals carried

| AG | Description | Source and standing | Preserved hypothesis | Revisit condition | Where the register carries it |
| --- | --- | --- | --- | --- | --- |
| AG-1 | Policy: permit or deny over packets and flows. Out of scope for this programme. | Survey envelope S5 (2026-09-25): "Policy: permit/deny over flows (Q2 stopped at behaviour and events)". DECISIONS.md:281-284 (2026-09-22): "A third was raised and deliberately left out of scope: policy, meaning permit or deny over packets and flows. It is named here only so the pack model is not designed in a way that excludes it." [M-read at assembly] | The director's, recorded at DECISIONS.md:283 (2026-09-22), verbatim: "policy may be DERIVABLE the way routing is -- declare flow pairs on a control-plane graph and let the permissions follow deterministically -- which would keep it stateless rather than making it the first pack to carry per-instance configuration." The record's standing for it: "Not designed, not ruled, and not to be assumed by anything built before it." (DECISIONS.md:284) | Envelope S5, composes-with target: "The director's preserved hypothesis in `DECISIONS.md` 2026-09-22; revisit once declared flow pairs and derived paths exist." | PS427 (what the design phase carries about policy while AG-1 holds); PS220 and PS227 (the src:dst pair and "control plane", both close to the hypothesis's wording); PS112 and PS218 (flows and paths, the hypothesis's inputs). |
| AG-2 | An admin portal for managing packs at runtime. Out of scope for this programme. | Survey envelope S5 (2026-09-25), director, verbatim: "For now, packs/mods will be fixed server-side, and distributed to clients. A later 'admin portal' for managing packs can be worked on - but out of scope". The same text is seeds S20's DIRECTOR SCOPE. The envelope row adds, in the proposer's wording: "In scope: a document declares its required packs, from a fixed server-side set delivered to clients and kept in sync per document." | none recorded | Envelope S5, composes-with target: "Runtime pack management and publishing; revisit when a pack must change without a server release." | PS128 (whether and how a document declares its required packs); PS129 (the distribution unit and its name). Seeds S20 (Claude's reading) records that extensible physics (Q1 d) stays an architectural property, so AG-2 leaves PS103 open. |

Notes carried with AG-1, none of them a decision:

- The envelope's reading (proposer, 2026-09-25) is that the Q3 example "sits close to the director's preserved policy hypothesis ... while Q2 kept policy out, which suggests the director wants the declaration-and-derivation MECHANISM without the permit/deny SEMANTICS."
- The word `policy` already names an unrelated module, engine/policy.mjs (groupAfterRemoval, collectionCap), and sign-in and soft-delete policies (map 1.4) [M-read]. PS427 carries whether that sense is renamed or kept.
- The hypothesis frames statelessness as avoiding "the first pack to carry per-instance configuration", while `spawn` already stores configuration per instance (map F29, F37) [M-read]; PS417 carries where spawn belongs.
- Whether any flow or path shape the design phase weighs would make deriving policy from flow pairs impossible later is PS427's separating question.
