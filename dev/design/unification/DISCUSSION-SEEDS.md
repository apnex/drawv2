# Problem-space register -- seed entries from discussion (2026-09-25)

Merged into the register when the reality map lands. Every entry is UNDECIDED.

> **NAMING NOTE, 2026-09-25 (director leaning):** "I now like pipe under this model."
> Entries S1-S15 were written using "wire"; read "wire" there as **pipe** (the conduit: an adjacency between anchors through which links run).
> The earlier wording is kept as recorded rather than rewritten.
> **AGREED (director, 2026-09-25):** there are two layers of routing -- **links through pipes**, and **paths over links**.

## S1 The layer stack (director: "OSI Layered Stack or equivalent"; "full fidelity network system")
- Candidate proposed by Claude, ONE alternative among several: Space (anchor) / Wire (stored, undirected) / Link (derived run of wires through bends) / Path (derived route across the link graph) / Flow (declared src->dst, directed) / Behaviour / Presentation (cross-cutting) / Session (decorates).
- Alternatives: links stay stored with path+flow above (smallest change, dual encoding survives); links stored and wires only derived segments (roughly today); fewer layers (wire=link, path=flow); other.
- Discriminators: wire vs link -- does anything attach to a unit smaller than a run? path vs flow -- can two flows share a path, can a path change under a stable flow?

## S2 Engine or domain (director statement "full fidelity network system" vs VISION "programmable geometric engine", pilot = tower defence)
- Alternatives: network stack IS the engine's connection model; neutral path/flow core composed by network and pilot (mission-kit P4); two stacks.
- Evidence: pilot movers already travel along paths.

## S3 The dual encoding of a bend (Claude, inferred from measured rules)
- Today one bend has two encodings: one link via W, or two links meeting at W; they derive different roles (geometry.mjs:522-526). Collapse and split convert between them; B211-B222 live there.
- Under stored wires: one encoding; split/collapse become derivations; FRAGMENT and H15.5 propagation fall out. Costs: derived-link identity, via retires, 38 live diagrams change stored shape.

## S4 `via` derived (director, 2026-09-25)
- "This could potentially allow via to be entirely derived."
- Under stored wires, via = the ordered bend anchors of a derived link. Alternatives: via stays stored (today); via stored only as authoring intent; via derived.

## S5 Authoring vocabulary vs stored vocabulary (director, 2026-09-25)
- "Using the w key to create a link with bends might also construct wires between the anchors under the hood mechanically."
- The author's verb (draw a link through these cells) may be higher-level than what is stored (wires); the verb compiles down. Same for `draw link a b --via cx,cy`.
- Parity consequence: if every door compiles through ONE function (planner-side), gesture and CLI converge and "a new route landing on a bend" stops being a special write.
- Open: is the compiler a client helper, a planner pass, or a declared op kind the server expands?

## S6 Meeting vs passing through (raised by S4/S5)
- If runs are wires between anchors, two runs sharing an anchor necessarily MEET there (junction). Does a full-fidelity network need a run that passes an anchor WITHOUT connecting to what else is there? (Schematic crossover vs junction dot; a cable passing a patch point.)
- Today: a via waypoint belongs to one link; CLI/REST can already land a link on another link's bend, which ATOMICS.md:141 says "cannot arise" (verified finding X4).
- Alternatives: sharing an anchor always means meeting; an anchor is exclusive to one run unless it is a junction; crossings happen only between anchors; a declared "through" relation.

- DIRECTOR LEANING 2026-09-25 ("for now", not a ruling): "if wires are between anchors, then a link can only occur between endpoints and junctions in this model. For now I would think wires meeting at an anchor join there - however - a junction is actually links meeting, rather than wires."
- Reading: roles split across layers. WIRE layer: wires meeting at an anchor join; two that continue make a bend (a wire-layer fact). LINK layer: a link is a chain of wires between two non-continuing anchors; endpoint (one link end) and junction (links meeting) are link-layer facts. Consistent with code: a bend is already the empty role set (geometry.mjs:505-509, B199).
- Crossover without connection then happens only BETWEEN anchors (wires crossing mid-segment); collinear overlap of two wires on one grid line is an edge case to settle.

## S6a The cut rule must be computable below links (consequence of S6 leaning, inferred)
- Links are derived by cutting wire chains at anchors that do not continue. Whatever decides a cut must be readable BELOW the link layer, or the derivation is circular: wire degree; plane (data/control) difference; opposing direction; the anchor's composition.
- So under this model, plane and any cut-affecting direction are properties of wires or anchors, not of links.

## S6b Tension with a ruling: FRAGMENT assumes direction lives on links/runs (needs the director)
- Ruled 2026-09-22 (BOARD H15, ATOMICS): opposing declarations on a run break it at the waypoint between them (a junction).
- If direction moves UP to flows (a flow is src->dst over a path), two opposite flows over one link should NOT cut it (a link carries both ways), and FRAGMENT would not apply at the flow layer. If direction stays on wires/links as a one-way property, FRAGMENT holds as ruled.
- Not re-litigated here; recorded because the layered model can reopen it, and only the director can.

## S6c Permission "never bend" as a cut, not a refusal (inferred alternative)
- Ruled 2026-09-22: a router permits endpoint and junction, never bend; violations are REFUSED by the validator. The ruling's reason: a router "is a thing the author placed, not a geometric artifact to be absorbed into a via".
- Under derived links, absorption into a via is not an operation. "Never bend" could instead mean "a router anchor always CUTS": two wires at a router make two links meeting there, i.e. a junction, with nothing refused. Network fidelity points the same way (a router terminates each attached link).
- Alternatives: permission as a derivation input (cuts); permission as validator refusal (as ruled); both (cut for routers, refuse for single-homed servers).
- DIRECTOR LEANING 2026-09-25: "A router never bends - this would be a capability/behaviour restriction applied by the 'router node' pack to the anchor system on that node."
- Reading: the anchor system exposes behaviours (continue as a bend, terminate as an endpoint, meet as a junction), and a pack in the node's composition RESTRICTS them. This is the ruled "one lookup" (DECISIONS 2026-09-22: what a server permits is which routing pack its composition includes), placed at the anchor, and it makes the seam concrete: Track A packs act on Track B derivation through the anchor.
- Open inside it: (1) restrictions the derivation can honour (never bend -> cut) vs ones it cannot (endpoint-only on a second wire -> still needs refusal); (2) how two packs' restrictions combine on one anchor (intersection? precedence?); (3) whether packs only RESTRICT anchor behaviour or can also EXTEND it (e.g. a router forwarding flows, a load balancer fanning one out); (4) whether the restriction is read per instance or per composition type (ruled: per TYPE).

## S12 Layers as capabilities (director question, 2026-09-25)
- DIRECTOR LEANING: "packs can extend anchor behaviour too, not just restrict."
- DIRECTOR QUESTION: "So links, paths, flows are themselves modular decoupled capabilities injected onto our wire primitives with anchors?"
- Observation (Claude): packs and layers are orthogonal axes. One pack contributes to several stages at one anchor: router = link stage always cuts (restrict), path stage forwards/transit (extend); server = link stage endpoint only, path stage terminates only.
- Alternatives: A. stages FIXED (link, path, flow are the engine's stack; packs plug contributions into them); B. stages are themselves CAPABILITIES (a new stage registers like a pack; bundles, tunnels, a pilot's own pathing addable without an engine change); others.
- B buys: extensible physics by construction, one mechanism, and an answer to S2 (engine = anchors + wires + capability mechanism; network stack and pilot = capability sets; mission-kit P4).
- B demands: stage dependencies and stratified evaluation order (prismv2 layered derivation); multiple attachment scopes (anchor, wire, whole graph, declaration); every stage pure, deterministic and shared by every door (kernel/ and model/ deliberately do not import each other today); stable addresses for derived entities.
- Separating test: will a second, different set of stages ever run over the same wires (pilot pathing by other rules, another domain)? VISION's "a second, unlike world running on the same engine" is direction, not evidence.
- DIRECTOR ANALOGY 2026-09-25: "B is more akin to the Kubernetes model I think, where the analogy is that pods are primitives, and deployments extend them etc."
- Holds: primitives vs extended kinds (pod ~ wire/anchor); CRD + controller ~ registering a new stage without a core change; spec vs status ~ stored declaration vs derived state (Flow is the most k8s-shaped: src:dst spec, path as status); labels/selectors ~ capabilities applying by type (per-type permission is selection by type).
- Strains: k8s controllers WRITE lower objects and store status; here higher stages DERIVE from lower primitives, every observer computes them, nothing is written ("a consequence is never sent", VISION). So each stage has a DIRECTION: materialize DOWN (authoring: the w gesture compiles a link into wires; a declared flow) is k8s-like; derive UP (the link a viewer sees; a flow's path) is view-like.
- Lineage: matches the prismv2 memory's recorded path, k8s (resources, status.conditions, selectors, level-triggered) -> Datalog/RETE/incremental view maintenance.

## S13 A declaration its inputs can no longer satisfy (raised by the k8s analogy)
- Case: a wire under a declared flow's path is deleted; a flow's src or dst anchor is deleted.
- Alternatives: the flow keeps its spec and derives a visible CONDITION (e.g. unroutable) every viewer sees (k8s status.conditions); reroute silently; refuse the delete; delete the flow (cascade).
- Behavioural intent question for Round 2 (asks how it should behave, not what structure).

## S14 Every stage = minimal persisted spec + derivation (director, 2026-09-25)
- DIRECTOR: "Agree that derivations flow up - but a link, path or flow config would need to have some entity persisted into the document (minimal entity/spec) such that the derivation can actually occur." Also: "I keep walking this path - it feels intuitive and mechanical/deterministic."
- Reading: uniform shape per stage, spec (stored intent, minimal) + derivation (computed by every observer). VISION's limit per stage: "a document that declares only where things are and what was intended".
- Two kinds of spec: GENERATIVE (needed for existence: wire = its anchors; flow = src, dst) vs CONFIGURING (adjusts a thing that exists anyway: a link's name, one-way, appearance; a path's constraints). Open per stage: does link have a generative spec, or only configuring? Is a path ever declared (pinned) or always derived from a flow?
- Per-field admission test (candidate): a field is persisted only if it is intent that cannot be derived (a link's name passes; its role never does).

## S15 Multiplicity between wire and link (director, 2026-09-25)
- DIRECTOR LEANING: "a wire's spec is just its two anchors." DIRECTOR CONTEXT: "Today - we only support a single link between 2 anchors, but in future we may allow parallel links between 2 anchors."
- Consequence (inferred): a wire's identity = its unordered anchor pair; parallel wires need a discriminator (index/lane), a differing property (e.g. plane), or parallelism must live above wires.
- Relations a full-fidelity network has: SERIES (many wires -> one link through bends; a cable through patch points), PARALLEL (many wires -> one logical link; LAG/port-channel), MULTIPLEX (one wire -> many logical links; VLANs), PARALLEL LINKS (many links between two anchors, each on its own wire; redundant uplinks).
- Discriminator for S1: series only -> a link is a derived chain, arguably not a separate primitive; any of the other three -> wire and link are distinct with a many-to-many relation.
- Prunes S7 binding alternative (1), by end anchors, unless a discriminator exists.
- To clarify later: does "just its two anchors" mean NO configuring spec on a wire (then plane lives higher and can no longer cut links, touching the ruled plane-difference rule), or only that the GENERATIVE spec is two anchors?
- Today's one-link-per-anchor-pair rule: where it is enforced is for the reality map to confirm.
- DIRECTOR LEANINGS 2026-09-25: "links are only ever between endpoints or junctions (or one to the other). drawing a new link to a bend converts it to a junction (current behaviour). parallelism lives above/abstracted over wires."
- DIRECTOR REQUIREMENT (also in the envelope): "we need to be able to model, construct and visualise all 4 of those in the table" (series, parallel/LAG, multiplex/VLAN, parallel links).
- Measured nuance: "current behaviour" holds at the BROWSER door only (split lives in input.js; CLI/REST land a link on a bend unsplit, verified X4). Under stored wires it would hold at every door by construction (a new wire raises the anchor's wire count).
- Consequence A (inferred): with wire identity = anchor pair and parallelism above, a WIRE is an adjacency or conduit, not a physical cable; two redundant cables between the same anchors are represented above the wire. Naming implication for "wire" is open.
- Consequence B (inferred): series chains can be derived from geometry, but parallel, multiplexed and multiple links cannot; they need a DECLARATION. So the link stage has a generative spec at least when multiplicity > 1: "derived chain + optional declared multiplicity/partition" is one shape, among others. Answers part of S14's open question.
- Consequence C (open): "a junction is links meeting" must say WHAT is counted once links can be parallel. A server with a two-member aggregate (one logical link) vs a server with two redundant links (two links): distinct logical links? distinct neighbours? member count? Interacts with "server permits endpoint only".
- Consequence D: visualising all four (lanes, bundle marks, multiplex tags) joins S10's shared-link readability question.

## S16 The physical/logical stack as the director describes it (2026-09-25)
- DIRECTOR: "a 'wire' represents an adjacency between anchors as a lowest network primitive. I like wire because it relates to physics of our model, not the physics of the visual diagram it aims to represent. 'wires' more accurately represent physical pipes/conduits through which 'links' can run - so 'links' are probably equivalent to 'cables' in the real world networking. I'm open to thinking about 'pipe' as a term if it helps. paths are logical, flows are specific instances of traffic"
- Reading: wire/pipe = CONDUIT (adjacency, physical, model physics); link = CABLE running through conduits (physical); path = logical route; flow = a traffic instance (logical).
- Four relations under it: series = one cable through many conduits; parallel links = several cables in one conduit (no wire discriminator needed); aggregation (LAG) and multiplex (VLAN) = LOGICAL constructs over cables, above links and at or below paths. Open: is there a logical-link layer between cable and path?
- Reconciles S6: conduits join at an anchor AND a junction is cables meeting, simultaneously; a cable passes through a conduit T without meeting the cables that end there. Pass-through = a cable that does not end at that anchor; no extra relation needed.
- QUALIFIES S3 (Claude's earlier claim that split/collapse "become derivations"): holds only if a link is a DERIVED CHAIN of wires. If a link is a CABLE (declared, own identity), split returns as "does the passing cable terminate here?" (an authored choice) and collapse as "splice two cables" (authored). Still ordinary operations on declared things, not special derived writes. Link-as-derived-chain stays as an alternative.
- via under the cable model = the cable's route through conduits: declared (stored conduit sequence) or routed from its ends (the director's "via entirely derived").
- Routing appears at TWO layers: cables through the conduit graph, flows through the link graph. Same shape (route through a graph, deterministic tie-break): one routing capability reused at two layers is a direct test of S12's stages-as-capabilities.
- Naming: the director's criterion is "the physics of our model, not the physics of the visual diagram". Electrically, "wire" is a conductor (closer to a cable); "pipe"/"conduit" suggests containment (what the director described). Open; the director's call.
- The current behaviour "drawing a new link to a bend converts it to a junction" becomes a behavioural question under the cable model: does the passing cable terminate there? (Round-2 candidate.)

## S7 Spec binding: identity, names and fields of derived things (recast by S14)
- If links are derived, where do a link's id, name, plane and direction live (on wires, on a declaration, derived from end anchors)? Today's split already loses name/flow/control (verified).
- The noun test (Q3) requires a derived link to be visible and selectable, so a derived thing needs a stable address.
- The hard case: a CONFIGURING spec bound to a thing that re-forms when topology changes (a link named "uplink" cut in two by a new wire at a mid-point: which half keeps the name?).
- Binding alternatives: (1) by end anchors (breaks when a cut moves an end); (2) by a member wire, inherited by the derived link containing it (H15.5's "declaration on one segment propagates along a run"; conflicting configs in one link need FRAGMENT or precedence); (3) a stored link entity listing its wires (links stored again); (4) selectors (k8s-style).

## S8 Direction per layer (envelope flag F5)
- wire: none (symmetric geometry)? link: optional one-way constraint? path: from its flow; flow: always directed.
- Today's `flow` boolean: one-way link, or one-hop declared flow?
- DIRECTOR LEANING 2026-09-25: "Yes I think pipes don't have direction" (in reply to Claude's lean: flows always directed, pipes never, link one-way an optional attribute).

## S9 Selection vs declaration (Round-1 Q3 note)
- A src:dst pair "selected ... persists as state in the control plane". Selection is persisted model-state today (doc.selection, no version bump, outside undo); the 09-22 ruling calls selection session state. A declaration would be versioned and undoable.
- "Control plane": H15.15 control links, a separate declared layer, or the document?

## S10 Derived path determinism and rendering
- Equal-cost routes: every viewer must pick the same one (tie-break).
- Many flows sharing a link: the visual flow elements must stay readable (lanes, bundling, aggregation).

## S11 Behaviour attachment and time (Round-1 Q2, corrected)
- How behaviour joins the substrate (packs on anchors, attachments to flows/paths, other) is open; behaviour brings a clock into a document-derived model.

## S17 Linking vs routing vs forwarding (director question, 2026-09-25; added AFTER the register drafters started)
- DIRECTOR QUESTION: "So 'linking' might become a modded behaviour over pipes/anchors? would this be different to 'routing/forwarding' capability?"
- Three concepts the word "routing" covers (Claude's distinction, for weighing): LINKING (L1 cabling: where cables run through pipes -- cable routing via declared via or an auto-router -- and where they may end or continue at an anchor); ROUTING (L3 control plane: computing a flow's path across the link graph, graph-wide, per flow); FORWARDING (L3 data plane: what an anchor does with traffic passing through -- pass on, fan out, terminate; per anchor, per flow).
- Evidence: the record uses "routable" for topology/permission/write (DECISIONS.md:255) and "routing capability" for forwarding (ATOMICS.md:353-354); the map's F27 records them as "not reconciled". Forwarding (clone / round robin / route) is designed and unbuilt (ATOMICS.md:340-349). No code walks more than one link (map 3.4).
- One composition contributes to several stages: a router terminates links (linking stage) AND forwards flows (forwarding); a server terminates links and flows.
- Alternatives: one routable capability covering linking + forwarding (status quo of the record's wording); separate linking, routing and forwarding capabilities; linking + a combined routing/forwarding capability; other.
- Under stages-as-capabilities, linking is itself a registered capability ("modded behaviour") over pipes and anchors; under fixed stages it is part of the engine.

## S18 Can the stack recurse? Overlays and tunnels (raised by S17)
- The node type list already includes `vxlan` (map 2.2, palette order). A tunnel is a LOGICAL link carried over a PATH: a higher-layer link rides on lower-layer routing.
- If full fidelity includes overlays, links do not only run through pipes; some run over paths, and the stack recurses (link -> path -> link -> path ...).
- Bears directly on stages fixed vs stages as capabilities: a fixed linear stack cannot recurse.
- Alternatives: no recursion (overlays drawn as ordinary links); recursion as a first-class stage relation; overlays as a logical-link construct at one fixed layer; other.

## S19 Where controllers run: derivation at every peer (director, 2026-09-25; added after the drafters started)
- DIRECTOR: "So in our pipeline, the reconciliation + derivation can occur client-side - and an analogy would be these mod/packs are the 'reconciliation controllers' similar to kubernetes - but pushed out to the edge/browser instead of central"
- Consistent with VISION: "each computes the world from inputs it already holds, rather than being told the outcome"; "a consequence is never sent".
- Refinement 1 (for weighing): an edge controller can DERIVE, not WRITE. k8s controllers reconcile by actuating (writing), one per object; if every peer ran a writing controller, the same write would be applied N times. Measured symptoms of a client-derived write racing a server-derived one: map D2, D3, D44. So: derive half at every peer; write half at one ordering point (planner behind the lock). Execution analogy for the derive half: deterministic lockstep (every client runs the same simulation over the same inputs); k8s supplies the SHAPE (kinds, spec/status, a controller per kind).
- Refinement 2: "edge" = every peer, including the server (the planner must derive to REFUSE, e.g. permission) and the CLI (agents need derived state, GR18/A5; roles are not readable at agent doors today, map critic gap 1). Shared-code location is map F24.
- Determinism inputs named in engine/rules.mjs: document, agreed clock, code revision. Already broken at the edge today: D11 (index iteration order differs browser vs CLI), D15 (CLI host clock).
- Alternatives: derive at every peer, write at the planner; derive centrally and broadcast results (contradicts VISION "a consequence is never sent"); hybrid (derive everywhere, validate-derive at the planner only); other.

## S20 Pack/mod distribution and version as a parity input (raised by S19)
- If controllers are mods, the controller SET and its VERSION become a parity input: a peer with an older or different pack set derives a different world.
- Today's defence covers one codebase only: B178 revision pinning (health reports `revision`; a stranded websocket detects a revision mismatch).
- Questions: does a document declare the packs it requires (and versions)? what does a peer lacking one do (refuse, degrade visibly, derive without it)? can peers at different pack versions share one document?
- DIRECTOR LEANING 2026-09-25: "yes, a document should declare its required packs. Delivered via the server and in sync per document"
- Open sub-questions under that leaning: (1) changing the pack set is a WRITE (lock, version, undo)? undoing it removes a capability and everything derived from it; (2) version pinning per document (lockfile) vs following the server's latest -- a pack upgrade changing old documents' derived world; tension with X1 and the standing rule "transform once, then delete the transform" (pinning implies keeping old versions; the alternative is a one-time migration); (3) the CLI (built to speak only HTTP and import nothing from server/app/model; already bent by combat/movers dynamic imports, map): load server-delivered pack code, or ask the server to derive for it; (4) TRUST: a server-delivered mod executes in OTHER principals' browsers -- who may publish a pack, and is pack code sandboxed?; (5) how purity/determinism of pack code is enforced (sandbox, scanner, test harness).
- DIRECTOR SCOPE 2026-09-25: "For now, packs/mods will be fixed server-side, and distributed to clients. A later 'admin portal' for managing packs can be worked on - but out of scope" (envelope AG-2).
- Effect on the sub-questions: (4) trust -- settled for current scope (packs are the server's reviewed code; no third-party code); (2) version -- pack version = server revision, mismatch covered by the existing B178 revision check; removing a pack is a code change handled as a one-time migration (X1). STILL OPEN: (1) is changing a document's pack set a write; (3) how the CLI gets derived state; (5) determinism enforcement.
- Extensible physics (survey Q1 d) remains an ARCHITECTURAL property (packs modular and registered apart from the engine); only RUNTIME pack management is out of scope, so S12 (stages fixed vs as capabilities) stays open.

## S21 Naming the extension unit: pack, plugin, mod (director question, 2026-09-25)
- DIRECTOR QUESTION: "These packs could be called 'plugins'?"
- Measured 2026-09-25: "plugin" has 0 uses in code or docs (app, kernel, engine, model, server, cli, docs, dev, VISION). "pack" is RULED (DECISIONS.md 2026-09-22: "one capability composed onto an anchor"). "capability" in code means authorization. VISION uses "mod", in two senses: an extender of physics ("a mod introduces a new kind of force, motion or collision") and a driver of the world ("driven equally by a person, a command, an agent or a mod").
- Structural question under the name: is the unit a DOCUMENT DECLARES and the server DISTRIBUTES (S20) the same as the unit a COMPOSITION LISTS on an anchor? A distribution unit may contribute several things at once: stages, kinds/specs, per-anchor packs, appearance (cf. Terraform providers contributing resource types; VS Code extensions contributing commands).
- Alternatives: (1) one word, one unit (pack = plugin); (2) two units: plugin = distribution/registration unit declared by a document, contributing packs (per-anchor), stages and kinds; (3) mod (VISION's word) or extension; other.
- Renaming or retiring the RULED "pack" is a director decision.
- DIRECTOR LEANING 2026-09-25: "plugin is the distribution unit, contributing packs and stages". Reading: plugin = distribution/registration unit (declared by a document, fixed server-side, delivered to clients); pack = per-anchor contribution listed by a composition (ruled name kept); stage = graph-wide derivation layer; composition = named set of packs (ruled).
- Open under the leaning: (1) does a stage carry its own spec schema (S14: stage = spec + derivation; e.g. a flow stage brings the flow declaration kind), or are kinds a third contribution? (2) plugin dependencies: a network plugin needs pipe/link stages from elsewhere -> a plugin dependency order (S12's stage ordering seen from distribution); (3) is the core (anchor, pipe) the engine itself or a core plugin every document declares (S2 engine or domain, in plugin terms)?
- DIRECTOR 2026-09-25: "We can weigh up whether the concept of pipes is a plugin or core" -- explicitly OPEN for the design phase.
- Toward core: VISION defines a document as "things placed on a grid, and the paths between them"; every moving behaviour built so far rides a connection (movers ride a link).
- Toward plugin: VISION's physics lists "position, distance, range and arrival" -- range and distance are spatial, not adjacency; towers act by range with no connection; a second, unlike world (VISION's test that the engine is real) may have space without adjacency or adjacency with other rules; under stages-as-capabilities, pipes-as-plugin leaves the smallest core (anchors in space).
- Separating question: is there a world the engine should run that has no adjacency between anchors, or adjacency with rules a pipe cannot express?
- DIRECTOR TENTATIVE LEANING 2026-09-25: "Yep, perhaps pipes cost nothing as core" (hedged; recorded as tentative, the question stays open).

## S22 What "drawn" means: a link as ends plus pinned vias (director, 2026-09-26)
- Raised while answering a question about a detoured link's way back. The FR3-v3 prototype stored a link's WHOLE drawn route as intent, and on a broken pipe re-routed the whole link, which could skip the link's own bends.
- DIRECTOR, verbatim: "I'm thinking 1 - but should we define "drawn there?" - links are either [src,dst] or [src,dst,[via..]] definitions. via would "pin" that anchor as a required hop and fail if it can't dynamic route across pipes to get there. [src,dst] can take any shortest path via pipes - so returning would be a matter of pipe cost and not "drawn" unless [via] was pinned? I'm just making sure I'm not confused"
- The "1" refers to "Returns, connects at P" in the question that prompted it (hedged "I'm thinking"; NOT a ruling). That question is set aside, because this definition changes what it asks.
- RULED 2026-09-26 as a result (see DECISIONS.md, "A link's intent is its ends plus its pinned vias").
- DIRECTOR, verbatim, after the ruling: "pressing "w" while dragging a link automatically creates an anchors and pins the link to that anchor (same behaviour as today)". This confirms that a bend dropped while drawing is a pin.
- Proposer observations given to the director before the ruling (INFERRED, not measured):
  - For a hand-drawn link every bend is a via and each leg lays a direct pipe, which is the cheapest route between its two pins, so hand-drawn links behave as under the 09-25 "return to drawn route" ruling.
  - A detour becomes local to the broken leg and still passes every pin.
  - A link declared by its ends alone is new. It has the same shape as a declared flow over links, and resembles an explicit route with loose hops.

## Prior art (evidence, not starting designs)
- prism (github.com/apnex/prism): the geometry/line-routing system; paths/routes as derived entities.
- prismv2: a separate kernel/core engine concept; derived relations over observed primitives (EDB/IDB); firewall/route-map/conntrack/k8s lineage. engine/ here is its banked substrate.
