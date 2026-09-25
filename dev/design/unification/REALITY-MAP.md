# Unification reality map: drawv2 at a986fb3

> **Landed 2026-09-25 in `dev/design/unification/` (uncommitted).**
> The probe scripts this map cites ([M-run] marks: probe*.mjs, stale-merge/, gapfill/, critic/ and the rest) were session-scratch files and are NOT preserved in the repository.
> Their results are recorded here; re-running any of them means re-writing the probe from the mechanism the row describes.
> Companion documents: `PROBLEM-SPACE.md` (the undecided register built from this map) and `DISCUSSION-SEEDS.md` (the director's verbatim statements from the design conversation).

This is the reality-establishing step of the unification programme, written 2026-09-25. It records what IS, cited to file:line. It contains no design and no recommendations.

- Track A covers what a thing is and does: pipeline, rules, node, capability/pack, composition, behaviour, event.
- Track B covers how things connect: link, route, path, run, flow, plane/control, junction, bend, endpoint, via, waypoint.
- The seam is the anchor, the `routable` pack, and how rules write.

---

## 0. How to read this

**Sources.** This document merges seven reader reports, then three gap fills written after a critic reviewed the first merge:

| ID | Reader | Slice |
| --- | --- | --- |
| R1 | b-model | stored Track B shape and write rules |
| R2 | b-derivation | route, path, roles and incidence derivations |
| R3 | doors-writes | operations across doors and transport |
| R4 | a-behaviour | spawners, movers, towers, rules, events, clock |
| R5 | a-node | node, type, glyph, frame, appearance |
| R6 | record | dev/ and docs/ record |
| R7 | terms | vocabulary and prior art |
| G1 | gap fill: stale merge | how derived writes compose inside one plan() pass |
| G2 | gap fill: containers | derived writes versus Track A containers (group.members) |
| G3 | gap fill: seam ops | retype, re-route, shape, content, node delete, waypoint ↔ node |
| CR | critic | the probes in critic/, re-run by G1–G3 |

Two other sources feed it: facts the orchestrator had already verified, marked [V], and places the synthesiser re-read at HEAD, marked [S]. In this revision [S] also marks the integrator's re-reads at HEAD (listed below).

**Numbering in this revision.** The three gap fills proposed colliding ids. They were re-assigned: D41–D48, C46–C48, F40 (G1's composition fork) and F41 (G3's recomposition fork). G3's proposed "node delete reaches D1" is folded into D1, and its "pin survives set via" into D5, because §9 de-duplicates by mechanism.

**Marks.**

| Mark | Meaning |
| --- | --- |
| [M-run] | A reader executed repository code in a scratch probe. The probes are in the scratchpad: probe*.mjs, split-*.mjs, collapse-dup.mjs, bend-term.mjs, thread-bend.mjs, clone-fields.mjs, reveal-undo.mjs, ack-collide.mjs and hist.mjs. Gap-fill probes: stale-merge/ harness.mjs, cases.mjs, undo-diff.mjs, undo-order.mjs, advancing-cases.mjs, search2.mjs, search-chain2.mjs, search-chain3.mjs, search-chain4.mjs (G1); gapfill/ triggers.mjs, followon.mjs, browser-door.mjs, browser-door2.mjs, undo-redo.mjs, boot-skip.mjs (G2); gapfill-seam-ops.mjs and gapfill-seam-ops2.mjs (G3); critic/ double-collapse.mjs, node-del-collapse.mjs, sweep-group.mjs (CR). Each has a .out capture beside it. **INVALID, not cited:** G1's stale-merge/search.mjs, search-chain.mjs, search-1.out, search-chain.out, search-chain2.out, search-chain2-11.out and search-chain2-12.out, which came from a random-number generator whose multiply ran past 2^53. G1's rates come only from its mulberry32 re-runs. G3 retracted its own first "undo round-trip false" reading as an artefact of its comparison's collection ordering. |
| [M-read] | A reader read the cited source. Any factual claim without a mark is [M-read] by the reader(s) named. |
| [V] | Orchestrator-verified. Not re-verified here. |
| [S] | Re-read by the synthesiser at HEAD a986fb3. |
| [I] | Inferred. Not measured. |
| NOT-CLAIMED | Stated where no one measured. |

The [S] re-reads cover:

- server/store.js:122-129
- app/src/sync.js:405-418
- server/txn.mjs:196-215 and :504-518
- engine/spawners.mjs:28-49
- model/invariants.mjs:55-70
- docs/spec/ATOMICS.md:138-145 and :276-284
- app/src/input.js:637-638
- engine/situation.mjs:143
- `git status`

The integrator's [S] re-reads, made for the corrections and new contradiction rows in this revision:

- cli/verbs.mjs:1892-1925
- server/txn.mjs:80-290
- kernel/engine.mjs:60-80 and app/src/renderer.js:303-312
- model/ops.mjs:36-50, model/model.mjs:100-128 and model/invariants.mjs:238-260
- the `wire` hits at kernel/renderer.mjs:200, 217; app/src/commands.js:213, 286; app/src/input.js:13, 15
- `git status` (still only `?? dev/surveys/unification-survey.md`)

**Cautions.**

- Concordance between readers is not independence. R1–R7 ran the same repo functions (plan, validateDoc, waypointRoles, spawnersOf) through similar node probes, so their agreement is one instrument family.
- G1–G3 ran the same family again (plan(), validateDoc, groupReferential, the browser command builders). Their agreement with R1–R7, and with each other, is not a second instrument. G1's rates come from two generators that G1 wrote, which are also one family, and they describe those generators, not real documents.
- Nobody ran a browser DOM, the draw CLI, the network, `npm run gate` or the test suite. Every visual consequence is [I].
- Readers' line ranges for the same site sometimes differ by a few lines. Where one conflicts with a [V] or [S] range, the [V]/[S] range is used.
- `engine/` means the directory. `kernel/engine.mjs` is a kernel file. Keep the two apart when reading "the engine never reads flow".
- `dev/surveys/unification-survey.md` is untracked (not in HEAD; `git status` shows `??` [S]). R3, R6 and R7 read it for context only. It is cited only where they cited its Q3.

---

## 1. Glossary

**Status legend.**

| Status | Meaning |
| --- | --- |
| RULED | The record rules a meaning, and code carries that one meaning. |
| USED | One live meaning in code, and the record is silent or matches. |
| AMBIGUOUS | Two or more live meanings, in code or between code and record. The meanings are listed in the cell. |
| ABSENT | The concept has no code carrier. The word may still be used for something else, as noted. |

### 1.1 The director's four terms

| Term | Ruled meaning (record) | Code meaning(s) | Stored / derived | Status |
| --- | --- | --- | --- | --- |
| WIRE | Vision: "connection = a net/wire (incl. container<->container, single or parallel)" (dev/HIERARCHY.md:29). A planned scanner failure on "any surviving `wire`" (HIERARCHY.md:77) was never built (tools/scan-writers.mjs has no such rule; R1, R2, R5, R6, R7). | (1) The network/serialization boundary, the dominant sense: app/src/sync.js:37, server/validate.js:3, model/ops.mjs:4, server/protocol.js:33, model/model.mjs:7. (2) The DI verb "wire it at the composition root": engine/relations.mjs:25, app/src/main.js:81. (3) "Wiring" meaning drawing links: app/src/commands.js:286 (L/Shift+L), input.js:15 (chain wiring), recognize.js:26. (4) Prose for a drawn line: kernel/renderer.mjs:200,217 and ATOMICS.md:63. (5) RETIRED: the kernel union `wire`/`wiresOf` (link or path element), deleted by B38 in d349ccd; tombstone at kernel/grc.mjs:13-19. | Not stored, not derived. No identifier names a connection. Hit counts were 44, 58 and 68 across R1, R3 and R7 (scopes differ). **CORRECTED:** senses (3) and (4) ARE connection concepts, carried in comments and help text rather than identifiers (kernel/renderer.mjs:200 "a tie point hides the wires beneath it", :217 "so wires meet its edges cleanly"; commands.js:286; input.js:15); "rewire" for replug is a third (commands.js:213; input.js:13) [S] (was: "none is a connection concept", which this row's own senses (3) and (4) contradict). | **CORRECTED:** ABSENT as an identifier and as a unit distinct from link; in prose a synonym for a drawn link; the word is AMBIGUOUS (was: "ABSENT as a connection concept") |
| LINK | The document entity owning a route, plus identity and `closed` (HIERARCHY.md:48, which omits name/flow/control). After B38, "link means one thing again" (BACKLOG B38). | (1) Stored entity {id, name, src, dst, via?, closed?, flow?, control?} (validate.js:238-251). (2) Kernel `relation` {id, route}; the adapter drops `name` (kernel/adapt.mjs:52). (3) Gesture mode `link`, which may yield a link, a routed link, a split or a chain (input.js:204-293). (4) CLI verb `draw link`, which also mints waypoints (cli/verbs.mjs:1872-1950). (5) REST /links, whose create is straight-only (rest.js:196). (6) Undo label: 'link' when straight, 'route' when it has via (commands.js:330). Retired: the kernel scene element `link` (d349ccd). | Stored: doc.links[] | RULED |
| PATH | [LOCKED 2026-08-19] An ordered list of coordinates with no identity (HIERARCHY.md:37-47). | (1) Model.pathOf(link) gives [[x,y],...] in raw px for ONE link; it returns null when any via is not a waypoint (model.mjs:152-187). (2) The kernel scene element {kind:'path', pts, radius, closed, flow?, control?}, with pts grid-snapped (kernel/geometry.mjs:541; kernel/engine.mjs:124-138). (3) An SVG d-string from roundedPath (kernel/router.mjs:91-103). app/src/movers.js:212-214 has a `pathOf` that returns a d-string: same name, different type. (4) REST GET .../links/:link/path and CLI `link path` (rest.js:658-664; verbs.mjs:1034-1048). (5) `.on-selected-path`: the waypoints of ONE selected link (renderer.js:180-192). (6) The UI label "close path"/"open path" for link.closed (commands.js:224-227). (7) The mover track: one link's pts, reversed away from the armed end (spawners.mjs:37-42 [S]). Record-only senses: a multi-link chain (BOARD.md:847 H15 exit; BACKLOG B147; survey Q3); "a path passing THROUGH" meaning a bend (ATOMICS.md:143-144); a path a mover chooses at a junction (ATOMICS.md:170). | Derived, never stored | AMBIGUOUS; the multi-link sense is ABSENT |
| FLOW | (1) `flow`: an optional boolean giving declared direction against stored order; absent means undeclared (ATOMICS.md:252-256, 324-338). (2) The traffic that passes through a bend or "does something" at a junction (ATOMICS.md:278-279, 306-309). (3) The policy "flow pairs on a control-plane graph": a hypothesis, "not designed, not ruled" (DECISIONS.md:281-284). (4) VISION.md:102: "a flow now arrives late". | (1) The only identifier is link.flow (validate.js:245-247). It is read by facing (invariants.mjs:136-143), by linkFacing, linkMarker, waypointRoles and linkAppearance (kernel/geometry.mjs:394-401, 451-454, 520, 439-449), by the adapter (adapt.mjs:52) and kernel/engine.mjs:135, and by the collapse (invariants.mjs:176-190; txn.mjs:245-246). (2) Runtime traffic is spawners and movers, which never read link.flow: engine/ has 0 reads (R1–R4, R7). | The declaration is stored; traffic is derived | AMBIGUOUS (a declaration identifier, versus traffic built without the name); the flow-pair sense is ABSENT |

### 1.2 Track B terms

| Term | Ruled meaning (record) | Code meaning(s) | Stored / derived | Status |
| --- | --- | --- | --- | --- |
| route | [LOCKED] An ordered list of anchors: topology, no coordinates (HIERARCHY.md:39-46). | (1) link.src + via + dst. (2) The kernel relation.route {src, dst, via, closed, flow?, control?} (adapt.mjs:52). HIERARCHY.md:46 and adapt.mjs:15 still say {from,via,to}. (3) A link with a non-empty via: the 'route' label (commands.js:330), `routed` (rest.js:88-89,110; verbs.mjs:2710), "multi-hop route" (input.js:25,778-788). (4) Coordinates: routeGeometry(pts) (router.mjs:44-58), "carries a route as POINTS" (movers.mjs:64-66), "the route is reversed" (spawners.mjs:17). (5) Packet routing toward an armed endpoint (ATOMICS.md:346), unbuilt. (6) HTTP routes: server/routes.mjs and CLI VERBS[].route (verbs.mjs:365-376). (7) kernel/router.mjs, a corner renderer; "an auto-router (later) populates the SAME waypoint list" (router.mjs:1-4). (8) 'Routing' as a pack family (DECISIONS.md:278). | Stored as link.src/via/dst | AMBIGUOUS |
| run | A run of bends along which a declaration inherits; derived, never stored; opposing declarations FRAGMENT it (ATOMICS.md:312-322; BOARD.md:834-841, ruled by the director 2026-09-22). H15.5 is TODO (BOARD.md:832). | (1) Run mode, the read view (situation.mjs:50,130). (2) A chain-wiring run (input.js:15; commands.js:339-360). (3) An undo run (protocol.js:147-158; changes.js:116-121). (4) Router "short runs" (router.mjs:90,94). (5) The rule field `run:` (recognize.js:50; keymap.js:19,77). The propagation sense has no code: searches for propagat, inherit, runOf, traverse, walk, chain, contiguous and reachab found nothing (R1, R2, R7). | Not stored | AMBIGUOUS word; the topological run is ABSENT |
| net | "connection = a net/wire" (HIERARCHY.md:29,88,95), vision only. | None. | — | ABSENT |
| via | An ordered list of waypoint ids (API.md:105,126). Step 3 widens it to "any node holding the capability", a one-way door (DECISIONS.md:204). | (1) Stored waypoint ids, at most 500 (validate.js:243). (2) CLI `--via cx,cy` takes CELLS, mints a new waypoint per cell and refuses an occupied cell, so it cannot thread an existing waypoint (verbs.mjs:1880, 1908-1916). (3) Kernel resolveRoute accepts any byId entity (node, waypoint, zone, group) or a bare cell (kernel/engine.mjs:124-131) [M-run R2]. (4) Model.pathOf requires a waypoint; otherwise the whole path is null (model.mjs:180-183) [M-run R2]. Absent and [] both mean straight (isStraight, invariants.mjs:55 [S]); the server strip writes [] (txn.mjs:467-469) [M-run R1 P9]. | Stored | AMBIGUOUS |
| src / dst (stored order) | Stored order is a byproduct: "No rule may branch on src/dst ordering unless the link carries a declared direction" (ATOMICS.md:252-263, :260). | (1) End references, which must exist and differ (referential.mjs:70-72). (2) The frame that flow is expressed against. (3) Identity anchor for rewrites: the src-side piece keeps the id (input.js:1027; txn.mjs:226-232). (4) Mover orientation from the armed end (spawners.mjs:42 [S]). (5) Reveal trace direction, src to dst (model/reveal.mjs:37-39; app/src/reveal.js:95-110). Rewritten by the collapse flip (invariants.mjs:150). | Stored | AMBIGUOUS |
| closed | Validator and CLI help: "(render-only)" (validate.js:244; verbs.mjs:1892). | A ring looping dst back to src, and in practice topological: waypointRoles skips it (geometry.mjs:461); collapse (invariants.mjs:154) and split (:195) refuse it; spawnersOf skips it (spawners.mjs:35 [S]); CLI spawn refuses it (verbs.mjs:1592-1596); routeGeometry adds a closing run (router.mjs:65-75). NOT consulted by the orphan sweep (txn.mjs:139-149) or by straightCapacity [M-run R1 P3, P5]. | Stored, optional boolean | AMBIGUOUS (render flag versus topology) |
| control / plane | link.control=true is the control plane and "carries no data-plane packets"; plane is independent of direction; differing planes make a junction (ATOMICS.md:287-310, :290; validate.js:248-249; H15.17/B233). | (1) link.control: samePlane (geometry.mjs:355); linkDash/linkWidth/CONTROL_WEIGHT 0.6 (:374-388); allControl, where "mixed is data" (:390-392); an inline twin at invariants.mjs:186. (2) The architectural sense: "control plane computed server-side, browser a stateless data plane" (ATOMICS.md:348-349). (3) Server-Locked control plane: lock arbiter plus hub (server/app.js:3-5; DECISIONS.md:88-95). (4) The policy "control-plane graph" (DECISIONS.md:283). (5) A Bezier control point `c` (router.mjs:44-46). (6) k8s controllers (engine/rules.mjs:14). There is no `plane` field. engine/ never reads control [M-run R1, R2, R7]. | Stored link.control; derived plane | AMBIGUOUS |
| endpoint | A derived role, never stored (DECISIONS.md:231-240); a permitted variant. | (1) The role in waypointRoles: at least one termination, not a junction, not a declared pass-through (geometry.mjs:465,523). (2) Any link end, node or waypoint: Model.endpointOf (model.mjs:148-150); validate.js:241. (3) REST contextOf `endpoints` {src,dst} (rest.js:96). (4) "Armed endpoint", meaning a spawner. The browser gate is onEndpoint(roles) (situation.mjs:126-127). The CLI "ENDPOINT waypoint" terminates an open link AND sits in no via (verbs.mjs:1585-1597). (5) GRC path free ends (grc.mjs:35-39,67-80). (6) An HTTP endpoint. | Derived | AMBIGUOUS |
| bend | Flow passing through (ATOMICS.md:279). "Two undeclared links are always a bend" (ATOMICS.md:281 [S]). The permission variant is "a geometric artifact to be absorbed into a via" (DECISIONS.md:239). | (1) A stored via entry: "a via bend is always a waypoint entity" (model.mjs:162-163). (2) The derived EMPTY role set: an untouched waypoint, a via-only one, a closed-ring end, or two same-plane terminations that both declare flow with one in and one out (geometry.mjs:318-321, 521). (3) The waypointRole string 'bend' and the CSS class 'bend' when roles are empty (geometry.mjs:534; kernel/renderer.mjs:206-210; renderer.js:334). (4) A collapse-eligible pair, including undeclared pairs (invariants.mjs:176-191). (5) The sweep's "bend-only": in some via, never any src/dst, and closed is ignored (txn.mjs:139-149). (6) The CLI reading: in ANY via (verbs.mjs:1590). (7) A geometric corner, BEND_R=20 (kernel/spec.mjs:31; ATOMICS.md:54-58). (8) A "free bend": a bare cell (kernel/engine.mjs:22-25). | A via entry is stored; the role is derived | AMBIGUOUS |
| junction | What the graph makes of an anchor (DECISIONS.md:231-240). Where flow does something other than continue (ATOMICS.md:270-278). An anchor kind "no schema can yet name" (HIERARCHY.md:53). [LOCKED] crossing convention: connected means the junction pad (ATOMICS.md:61-65). A packet decision point with clone / round robin / route, where "engine semantics are intended but unspecified" (ATOMICS.md:169-171, 340-349). | (1) Derived role: more than 2 terminations, OR 2 with opposing declared flow, OR 2 on differing planes. It supersedes endpoint (B211) (geometry.mjs:479,518,521) and is drawn as the wp-junction ring (:284-289,306). (2) A kernel scene element {kind:'junction'}, "a tap point on a trunk", a 10px pad never emitted by resolve() (geometry.mjs:538; kernel/renderer.mjs:216-218). (3) A GRC attachment anchor kind (grc.mjs:69). Never derived for nodes. | Derived | AMBIGUOUS |
| termination / thread | B211: threading contributes nothing to the count (ATOMICS.md:140-146 [S]). | Termination means a link's src/dst lands on the point. The predicate "src or dst equals id" is restated at 7 or more sites: geometry.mjs:462-463; kernel/engine.mjs:76; invariants.mjs:157; spawners.mjs:35; verbs.mjs:1592; txn.mjs:211 and :445-447. It is called "terminations" (geometry), "terminal" (txn.mjs:143) and "ends" (invariants.mjs:157). Threading means the point is in a via; the predicate "via includes id" is restated at verbs.mjs:1590 and input.js:1011, and prose calls it "threads" or "passes through". Neither has a named predicate. | Derived | USED, with no identifier |
| incidence / touching (linksAt) | — | (1) Model.linksAt and the engine index linksAt: any role, src/dst/via (model.mjs:140-144; relations.mjs:83-87). (2) linksOf: src/dst only. (3) kernel `el.links`: terminating links only, closed included (kernel/engine.mjs:73-76). (4) The canvas passes linksAt, any role, to waypointRoles and waypointLayers (renderer.js:325,336). (5) Collapse candidates: any-role count == 2, then both must terminate (txn.mjs:216-217). (6) spawnersOf: the first terminating non-closed link in linksAt order (spawners.mjs:34-35 [S]). Browser index order differs from scan order after a put [M-run R4 c]. | Derived; the index lives in memory | AMBIGUOUS |
| facing / flip | Direction at a point (ATOMICS.md:260). | facing gives 'in', 'out' or null (invariants.mjs:136-143). flip swaps src/dst, reverses via and inverts flow (:150). The kernel twin is linkFacing (geometry.mjs:394-401), a declared twin (scan-twins.mjs:49-62). The arrowhead comes from linkMarker (:451-454). | Derived | USED |
| straight / routed | B72, B80: at most one straight link per pair. | isStraight (invariants.mjs:55 [S]). straightCapacity is 1 per UNORDERED pair and ignores plane, direction and closed (invariants.mjs:24-42, 260-275) [M-run R1 P5]. It is written as a function "intended to become per-endpoint-kind". The subtype is named "route"/"routed" only in labels. | Derived | USED (the subtype overloads "route") |
| pair (pairKey) | invariants.mjs:44-50 claims it owns the vocabulary "so it is not re-derived". | invariants.mjs:56 is exported and joins with '\|' after an ordered compare [S]. referential.mjs:125 is private and sorts then joins with '\u0000'. Behaviour agrees today. | Derived | USED (two encodings) |
| occupancy | — | (1) violations(): no two nodes or waypoints at one anchor POINT, refused only when a transaction introduces it (invariants.mjs:276-306; txn.mjs:276-288). (2) The engine relations index keys every CELL of a span (relations.mjs:32-39, 120-121). (3) The Model scan compares anchor px only (model.mjs:216-230). (4) server/anchor.mjs takenSet (:46-52). (5) rest.js occupantAt. [M-run R1 P8] | Derived | AMBIGUOUS (point versus footprint) |
| port | [LOCKED] A face-locked attachment marker; 2 per node face and 3 per group-hull cell (ATOMICS.md:69-76, 106-115). An anchor kind (HIERARCHY.md:53). A future derived appearance (DECISIONS.md:341). | A kernel element {kind:'port'} handled by the renderer, GRC and bboxOf but never emitted by resolve() (geometry.mjs:537; kernel/renderer.mjs:219-223; grc.mjs:44-59,69). It is called DECLARED locked design (tests/span.test.js:376-385). It has no id grammar (validate.js:43). The word is also a TCP port. | Not stored | ABSENT as a document concept |
| segment | — | A geometric point pair: segmentsOf (router.mjs:167-173), GRC ortho/obstacle. One link in a chain gesture (input.js:214, 1406-1430; commands.js:347-348). One link in a run (HANDOVER.md:80). JWS segments. | — | AMBIGUOUS |
| hop | — | A link with at least one via, the "multi-hop route" (input.js:25,778-788). One link of a chain: chainHop (commands.js:340-360). A network hop (clock.js:20). In prism, route.hops are nodes or tag selectors. | — | AMBIGUOUS |
| edge | — | A container face (ATOMICS.md:80-89; geometry.mjs:29,43). An import edge (adapt.mjs:7). A cloud edge returning 429 (cli/draw.mjs). No graph-edge identifier exists; `link` carries that role. | — | AMBIGUOUS; the graph sense is ABSENT |
| waypoint | RETIRED as a concept: an anchor carrying only routable (DECISIONS.md:302). It is still the id prefix, kind and collection, which is the one-way door (DECISIONS.md:201-204). Older senses: a placeable anchor entity (HIERARCHY.md:49); a grid point a link may terminate at or bend through (API.md:129); "not a node type" (B146; palette.js:189-190); "an implementation detail of a bend" (CLI.md:212); "IS a node for placement" (LAYOUT.md:113). | (1) Stored {id, name, x, y, pinned?, spawn?}, with name REQUIRED (validate.js:187-237) [M-run R1 P4]. (2) The kernel scene element waypoint(cx,cy,roles); the adapter drops name, pinned and spawn (geometry.mjs:103; adapt.mjs:47). (3) Any polyline vertex, ends included: "paths as grid waypoints" (router.mjs:1-3, 89, 163-168). (4) The authoring pseudo-type 'waypoint' (verbs.mjs:1660; input.js:261,865,890; painter.js:61; palette.js:251-252). (5) A placement occupant. | Stored | AMBIGUOUS |
| pinned | Placed deliberately with no link, and exempt from the sweep. "Threading clears it" (validate.js:206-219; B162). | It is set only by the idle `w` key (input.js:907) and by CLI `set pinned` (verbs.mjs:358-361). It is cleared only locally in the browser (input.js:938) [M-run R1 P1]. It is read only at txn.mjs:166. | Stored | USED |

### 1.3 Seam terms

| Term | Ruled meaning (record) | Code meaning(s) | Stored / derived | Status |
| --- | --- | --- | --- | --- |
| anchor | Three rulings coexist. (a) [LOCKED 2026-08-19] A referenceable point: node, waypoint, port, junction or cell; "anchor means exactly one thing" (HIERARCHY.md:39-54, :70). (b) 2026-09-22: the CORE, meaning identity, position and reachability by links, with no identifier, field or grammar slot (DECISIONS.md:227-229, 298; HANDOVER.md:44-46). (c) A grid position {layout, cx, cy, x, y, occupant}: "one anchor holds one node" (LAYOUT.md:25-39, 62-64; built in B110-B113). | (1) A grid position: LAYOUTS/nearestAnchor/anchorAt (geometry.mjs:33-80); server/anchor.mjs resolveAnchor (placement only); REST /layouts/:name/anchors; CLI `anchor nearest` and `anchor free`; violations "occupy the same anchor" (invariants.mjs:303); engine/policy.mjs:34. (2) A drawn layer: the wp-anchor ring, via waypointAnchor (geometry.mjs:137-145, 205-210, 298). (3) A "free anchor": a bare cell or {x,y} used as a route reference (kernel/engine.mjs:21-25; model.mjs:171-176). (4) The GRC anchor set: port, node, junction, waypoint (grc.mjs:69). The core sense has no code. | Not stored as a noun | AMBIGUOUS |
| routable | Five responsibilities (DECISIONS.md:214-215), shrunk to three: permission table, derivation, write (:255-257). "Waypoint = anchor + only routable" (:302). | Only a string in tools/scan-twins.mjs:61. `git log -S routable` returns only b497388 (R5). | — | ABSENT |
| pack | One capability composed onto an anchor: routable, glyph, framed, named, content (DECISIONS.md:299). | None. A grep hits only scan-twins.mjs:61 (a comment) and server/identity.mjs:114 (JWS "packs"). Capability-shaped mechanisms exist under other names. Field-presence gates: content makes a panel, span makes a rect frame, spawn makes an emitter, pinned exempts from the sweep. Per-type tables: GLYPH_BB/GLYPH_DEFS and TOWERS (R5). | — | ABSENT |
| capability | What a node declares; it contributes layers and behaviour (DECISIONS.md:183). Also "the anchor VARIANTS a type permits" (:237). "Routing capability" means forwarding (ATOMICS.md:353-354). The "capability probe" is cited at DECISIONS.md:221 and ATOMICS.md:247. | Authorization, "write capability" (store.js:1127; rest.js:901; protocol.js:498; main.js:599). | — | ABSENT (ruled sense); the word is used for authorization |
| composition | A named set of packs; what an author picks: server, router, load-balancer (DECISIONS.md:262-273, 300). | The DI "composition root" (main.js:52,60,69; invariants.mjs:241). The nearest stored proxy is node.type. The ruled spelling 'load-balancer' differs from the code key 'loadbalancer' (theme.mjs:28; kinds.mjs:50; palette.js:14; seed.js:22; input.js:642; verbs.mjs:31). | node.type is the proxy | ABSENT (ruled sense) |
| permission table | Per TYPE, the variants a type permits. A bare waypoint permits all three; a router permits endpoint and junction, never bend; a server permits endpoint alone. It is refused "in the validator", gates the collapse, and answers "may a link land here" (DECISIONS.md:237-260). H15.7 is TODO (BOARD.md:816). | None. | — | ABSENT |
| door | "Count the doors": commit, boot, canvas, kernel renderer, adapter, CLI (HANDOVER.md:263-270). Also writer entry points (browser, REST, CLI, undo/redo), and "the prefix is a door" (CLI.md:75-80). | No identifier. | — | ABSENT in code |
| derived op | Each one is named (cascade, sweep, collapse, steal); there is no umbrella term. The TRANSACTIONS contract lists only cascade (TRANSACTIONS.md:59, 189-191). | Planner-added ops at txn.mjs:95-262, labelled 'cascade', 'swept' and 'merges'. | Emitted as ops | ABSENT (unnamed) |
| intent op (`place`) | W7 RULED 2026-09-04: an op carries intent and planOne resolves it against the advancing projection (WRITES.md:248-289). | txn.mjs:308-312 plus server/anchor.mjs:103-148. The CLI emits it only when drafting (verbs.mjs:1210-1212). | Not stored | RULED |

### 1.4 Track A terms

| Term | Ruled meaning (record) | Code meaning(s) | Stored / derived | Status |
| --- | --- | --- | --- | --- |
| node | A component: a frame on a cell holding a glyph (HIERARCHY.md:27,114). An anchor AND the entirety of its composition (DECISIONS.md:301). 2026-09-24: the `node-` prefix is "probably CORRECT" (HANDOVER.md:34-40). | (1) Stored {id, name, type, shape?, x, y, span?, content?}, with id, name, type, x and y required (validate.js:177-186; shape.mjs:33) [M-run R5]. (2) The kernel scene element (geometry.mjs:83-88; kernel/engine.mjs:42-54). (3) A placement class shared with waypoints (validate.js:204; anchor.mjs:45). (4) The CSS `.node` class, also put on palette tiles and ghosts, including the waypoint ghost (palette.js:127; painter.js:60). A node cannot be a via (validate.js:243), cannot take a role (kernel/engine.mjs:66-71), and cannot spawn (validate.js:236). | Stored | RULED (identifier); the ruled ontology meaning has no mechanism |
| type (node.type) | "A named type is a composition" (DECISIONS.md:267). "The validator's closed type vocabulary" (DECISIONS.md:287; HANDOVER.md:17,89). | (1) The glyph id (adapt.mjs:35; renderer.js:278-280). (2) The behaviour key, via TOWERS (kinds.mjs:49-51,72). (3) The name prefix, via nextName(type) (model.mjs:253; commands.js:483). (4) The authoring "hand" value, including the pseudo-type 'waypoint'. (5) A sentinel: 'text' in the editor (model.mjs:261-269), 'host' as the CLI panel default (verbs.mjs:1965,1990). (6) The CLI ASCII letter (verbs.mjs:2200,2242). The validator accepts any /^[a-z0-9-]+$/ up to 32 characters, unchanged since 67d229d (validate.js:180). A probe accepted 'zzz' and 'waypoint' [M-run R5]. | Stored | AMBIGUOUS |
| kind | — | Entity kind and id prefix (model.mjs:11,51). Document kind: diagram or template. Scene element kind. The engine's "kind", which is really node type (kinds.mjs:2-16). spawn.kind 'packet', resolved to a CSS class (validate.js:150-164; style.css:507). Fact kind 'beam' (rules.mjs:125). Pick hit.kind. Index kind: set or single (relations.mjs:42-45). No door changes an entity's kind in place, because kind is the id prefix (§5 "Waypoint ↔ node conversion") [M-run G3]. | Id prefix; spawn.kind | AMBIGUOUS |
| glyph | The pack `glyph`, intrinsic appearance (DECISIONS.md:299,315). | The art registry GLYPH_DEFS (theme.mjs:45-109) and fit boxes GLYPH_BB (:26-29). The scene field equals type, defaulting to 'router' (geometry.mjs:84), while the fit falls back to the host box (kernel/renderer.mjs:225; renderer.js:19; palette.js:162). The content-region glyph (validate.js:126). There are 7 emission sites: 6 fitted by a hand-written nested svg, and the ghost unfitted (painter.js:79). | Derived from type | USED |
| frame / shape (framed) | The pack `framed` (DECISIONS.md:299,307). | node.shape is circle or square, optional, default circle (validate.js:59,181). A panel's shape picks its corner radius (kernel/renderer.mjs:41-44). Weight is derived: panelW 1, otherwise frameW 2.1 (:39; spec.mjs:18-19). The frame is universal for nodes and impossible for waypoints. It is emitted by 6 routes: renderer.mjs:232-234 and 340-341; renderer.js:258-260; palette.js:156; painter.js:78; theme.mjs:152. | shape stored; frame derived | USED (the pack is ABSENT) |
| content / panel | The pack `content`. | node.content holds up to 200 regions (validate.js:120-141). `region.content` is also the region-kind field, the same word (validate.js:124 vs :185). isPanel(e) means content is non-empty (renderer.mjs:26); it suppresses glyph and label and lightens the frame. region.action fires draw:action; region.input opens an editor. The same thing is called "text box" (model.mjs:261), "panel" (CLI; isPanel) and "content node". | Stored | AMBIGUOUS |
| name (named) | An optional pack (DECISIONS.md:265,293,299), versus B187 (director, 2026-09-04): "MANDATORY on all five kinds" (BACKLOG B187). | Required on every kind at full validation (validate.js:307-312; shape.mjs:31-47) [M-run R1, R5], despite the comment at validate.js:201 ("Optional, like every other name"). An empty string is accepted. resolveId treats a name as a unique handle and refuses ambiguity (model.mjs:236-238), but no invariant enforces uniqueness, and anchor.mjs:87-89 takes the first match. Only plain and span nodes and zones render it. It is minted three ways: nextName; name=id in the CLI; and duplicates from a split. | Stored | AMBIGUOUS |
| appearance pipeline | Derived state in, attributes out, in one call (ATOMICS.md:367-388, H15.9). "One resolution by composes and priority per state -- LINKS DONE" (BOARD.md:831). composes/priority per derived state was ruled 2026-09-22 and is unbuilt (DECISIONS.md:357-368). | linkAppearance + APPEARANCE_KEYS, links only (geometry.mjs:414-449) [V]. waypointLayers, a layer list (:297-309). Node predicates isPanel, frameWidth, frameRadius and showsSockets (renderer.mjs:26-48). Literal assembly for zones and groups. No composes/priority resolver exists [V]. | Derived | USED (links only); composes/priority is ABSENT |
| pipeline | See the row above. | The appearance pipeline. The geometry pipeline (TRANSACTIONS.md:642 N7; BACKLOG B7). The kernel render pipeline: schema, resolve, scene, renderer plus GRC (dev/design/sim/README.md; kernel/README.md). HTTP keep-alive pipelining (rest.js:176). The history pipeline (scan-writers.mjs:88). No module is named pipeline. | — | AMBIGUOUS |
| session decoration | Selection, hover, armed, ghost and run-mode hides are not packs; they decorate (DECISIONS.md:343-350). | CSS classes each set at their own site: selected, hover, armed, armed-clone, ghost, blocked, linkband, on-selected-path, replugging, labels-off, edit-mode, run-mode, zonegrid, texttool, data-unrevealed. setState is the only shared helper (renderer.js:469-472). | Not stored | RULED (no registry) |
| behaviour | A capability contributes layers AND behaviour (DECISIONS.md:183). Roles "are not behaviours a node implements" (:231). VISION.md:74: a behaviour expressible only by storing a number on a shape is a failure. RULES.md:201 treats behaviour as a mod surface. | Simulation: spawners, movers, towers. Input meaning. Host-mapped draw:action. engine/kinds.mjs:14-16: "the same move for behaviour rather than appearance". | Only inputs are stored | AMBIGUOUS |
| rule | See F32. | (1) Input dispatch rows: RECOGNIZE and KEYMAP (recognize.js:45-65; keymap.js:65,133). (2) Run-mode situation rules that WRITE (input.js:588-647). (3) The RULES.md input-meaning design, a candidate. (4) Engine derivations, (world, tick) to facts, "may not write" (rules.mjs:1-35; ruled 2026-09-01 and recorded only in that comment per R6). (5) Validation invariants and referential refusals. (6) Kernel GRC RULES (grc.mjs:133), with no production caller (R2). (7) Policy/cascade rules in engine/policy.mjs and txn.mjs plan. (8) Role derivation. (9) The spectator follow rule. (10) Editor rules (input.js:229-249). (11) Scanner rules. (12) Director standing rules. | Code | AMBIGUOUS |
| event | Event handlers are rejected for rules (rules.mjs:8-17; RULES.md:17-21). | A model change emit (put, set, del, load), including live previews (model.mjs:80-89). The commit boundary, Changes.onCommit. DOM input. The draw:action CustomEvent (input.js:649-651; main.js:115-130; only 'help' is wired). Transport messages. Session-log events. History records. `draw event` is held (B194). Mover birth and arrival have no event; death is a fold result; arrival is recorded nowhere. | History records are stored | AMBIGUOUS |
| situation | The RULES.md:83-103 method vocabulary: s.one('link'), s.role() returning 'endpoint' or 'bend'. | An inert value {at, mode, readOnly, target{kind, id, roles?, spawning?}, selection} plus free predicates oneSelected, onEndpoint, inReadView, onSpawner, onOpenGround (situation.mjs:46-55, 58-92, 111-143). The code rejects the method vocabulary by name (:15-21). | Derived | USED (diverges from the design) |
| spawn / spawner | "An ENDPOINT waypoint may carry spawn" (API.md:129-131). | waypoint.spawn {interval ms, speed cells/s, kind:'packet', since}, whole or absent (validate.js:143-173, 220-236). It is shape-checked only, with no role gate. The spawner descriptor is derived by spawners.mjs:30-49 feeding movers.mjs:72-79. | Config stored; emitter derived | USED |
| armed | — | (1) Spawn is configured (renderer.js:332). (2) A delete/clone chord target (overlay.js:40). (3) A held palette tool (palette.js:42). (4) A spectator follow (spectate.js:4-6). Stored "armed" and derived "emitting" are not distinguished (§7). | Only the spawn sense is stored | AMBIGUOUS |
| mover / packet | Packets clone, round-robin or route at junctions (ATOMICS.md:340-349), unbuilt. | A closed form of (spawner, t) with id `${spawnerId}#${k}` (movers.mjs:9-35, 107-163). MOVERS is {packet:{hp}} (kinds.mjs:62-66). A mover travels one link and never continues. | Derived | USED |
| tower / turret | H13: towers are loadbalancer nodes (BOARD.md:663,678). | A node whose type is a TOWERS key, today only 'loadbalancer' (kinds.mjs:49-51,72; rules.mjs:52-64). Its numbers live in code. It is called "turret" in movers.js:287-315. | Derived from type | USED (two names) |
| combat / aim | — | combatAt folds ticks over [now - window, now] with the CURRENT world (rules.mjs:160-198). DERIVATIONS has one entry, 'tower-fires' (:104-130). aimAt picks the in-range mover with the highest progress FRACTION (rules.mjs:88-102; movers.mjs:157). | Derived | USED |
| clock / tick | commands.js:549-551: since comes from the agreed clock, never Date.now(). | The agreed instant: serverNow and Clock.seed (clock.js:55-68; sync.js:567). engine TICK_MS 100 (kinds.mjs:27-28). The app movers' TICK_MS 200 paint floor (movers.js:32). reveal TICK_MS 100 (reveal.js:29). Server Date.now for reveal.origin and change.at (txn.mjs:558,563). CLI host Date.now for spawn.since and movers --at (verbs.mjs:1486,1526,1607). | Instants stored in spawn.since and reveal.origin | AMBIGUOUS |
| beat / reveal | The b188 survey re-ruled "beat" to the shipped reveal; the story step is now UNNAMED (b188 survey:78-81). | doc.reveal {origin, beats[{interval, caption?, ids}]} from a paced commit (txn.mjs:514-576). A link reveal traces stored src to dst (reveal.mjs:37-39; reveal.js:95-113). Only app/src/reveal.js imports model/reveal.mjs. | Stored | RULED |
| draw:action | "The self-hosting interface" (RULES.md:204-207). | node.content[].action, run-mode click, CustomEvent, host map (validate.js:135; main.js:115-130). | Stored | USED |
| zone | No row in the ontology table (DECISIONS.md:296-302). | {id, name, x, y, w, h} on the half-pitch-offset zone layout (validate.js:252-259). Not link-reachable, not a group member, selectable; a placement region for `inside`. | Stored | USED |
| group | No ontology row. Hub principle: links attach to the hull (ATOMICS.md:113). API.md:133-134 says "Not rendered" (stale). | {id, name, members[node or waypoint]} with no position; the hull is derived (geometry.mjs:572-581). Never selected directly; not link-reachable. A request delete of a member trims or dissolves the group (txn.mjs:406-418); the orphan sweep does not, so a swept bend can stay listed (D42) [M-run G2]. | Stored | USED |
| policy | Permit or deny over packets and flows; OUT OF SCOPE; a hypothesis only (DECISIONS.md:281-284). | engine/policy.mjs means groupAfterRemoval and collectionCap (TRANSACTIONS D16). Also sign-in policy and soft-delete policy. | — | AMBIGUOUS word; the ruled sense is ABSENT |
| tokens / theme | — | TOKENS (theme.mjs:12-22), which has no `label` key although kernel/renderer.mjs:125 reads it. The STD ladder (spec.mjs:8-45). KERNEL_CSS, a vendored copy of the client CSS (theme.mjs:33-41). app/style.css restates the values as literals. | — | USED (twinned) |
| socket | Glyph mount, 26px (HIERARCHY.md:27; spec.mjs:14). | The glyph socket; the socket grid for content regions (a render option); websocket. | — | AMBIGUOUS |

### 1.5 Operations and transport terms

| Term | Ruled meaning (record) | Code meaning(s) | Stored / derived | Status |
| --- | --- | --- | --- | --- |
| collapse | The split's inverse; "One rule, one place, every door" (ATOMICS.md:159-167; B213, B215, B217, B222). | collapseAtWaypoint is pure (invariants.mjs:152-192). plan() applies it on link DELETE only (txn.mjs:207-262), in the same undo record, with violations() only [V]. Within one plan() every merge is computed against a projection that is not advanced between merges, and all are applied once (txn.mjs:214-261), so two touched waypoints that share a link compose wrongly (D41) [M-run G1]. | Emitted as ops | USED |
| split | ATOMICS.md:141, 202-223; B210, B213. The id rule is stated two ways (§8). | splitAtBend is pure (invariants.mjs:194-202). It is called only from the browser, via commitRoute and splitsFor (input.js:984-1033), and drops flow, control and name [V]. | Emitted as ops | USED |
| orphan sweep | B162, B216. | A waypoint referenced before the transaction and not after, not pinned, and bend-only before, is deleted (txn.mjs:116-177) [V order]. It emits a bare `del waypoint` (txn.mjs:169) and does not trim the groups holding it, unlike planDel's trimGroupsHolding (:406-418, called at :425 and :472) (D42) [M-run G2]. It runs once, before the collapse, and does not run again after it (P6, D41) [M-run G1]. | Emitted as ops | USED |
| cascade / steal | D12: the server computes it; the browser sends intent (TRANSACTIONS.md:344). I4: "five shapes". | planDel (txn.mjs:400-477). A deleted node takes its links. A deleted waypoint deletes the links terminating there; threading links are stripped, or deleted where stripping would duplicate a straight link (B81); groups are trimmed. STEAL happens in planPut (txn.mjs:363-379). The client projects both as twins (commands.js:51-124, 126-147). | Emitted as ops | USED |
| undo / redo | D21 undo-run. | undo applies the stored inverse (txn.mjs:600-637); redo applies record.ops (:639-650). Neither re-plans or validates. Undo restores content but not collection order when a deleted entity was not last in its collection (D43) [M-run G1]. Redo recreates a validateDoc-invalid state unchanged (D42) [M-run G2]. | log.records | USED |
| change / ack / snapshot | — | changeBody (protocol.js:163-187). reversalBody (:197-209) carries no `reveal` and from:null. snapshotBody (:48-121). The ack diff is keyed by op:kind:id (sync.js:409-416 [S]). | Not stored | USED |
| selection | Status: persisted, not logged (TRANSACTIONS D15). Session state (DECISIONS.md:344). [OPEN] level or cursor (HIERARCHY.md:124-126). | doc.selection: no version bump, not undoable (store.js:1281-1292). It is broadcast as a `selection` event that the browser never handles (sync.js:336-540). | Stored | USED |
| template fork | — | The first write or REST lock on `template-` forks it (store.js:712-721, 1185-1192). The fork has no undo record. | A new diagram file | USED |
| replug | — | `set {src,dst}`. The browser can retarget to nodes only (input.js:164-201). Replug triggers neither split nor collapse. | — | USED |
| clone | — | cloneSubgraph (commands.js:462-536), browser only. | — | USED |

---

## 2. Track A: what a thing is and does today

### 2.1 What a node is

- A node is a stored kind. Its required core is {id, name, type, x, y}; shape, span and content are optional (validate.js:177-186; shape.mjs:33). A missing type or name is refused [M-run R5].
- Every node draws a frame on every route, and no field can suppress it. The glyph comes from type and the name label is shown when there is no content (kernel/renderer.mjs:224-255; renderer.js:250-288).
- A node cannot be a via (validate.js:243). It never receives roles (kernel/engine.mjs:66-71; renderer.js:309). It cannot spawn (spawn is waypoint-only, validate.js:236).
- A waypoint is a separate kind {id, name, x, y, pinned?, spawn?}. It has derived roles and cannot hold type, glyph, shape or content.
- Nothing in code corresponds to anchor-as-core, pack or composition (R5, R6, R7). Behaviour is gated by kind in 34 places across 17 files, using `kind`/`type` compared against 'waypoint' (R5's regex; one hit is a comment). Zero sites gate on a declared capability.
- The capability probe was paper-only. 46f169b touched only dev/ATOMICS.md, and the text was deleted in 8863d77. The citation now runs in a circle: DECISIONS.md:221 cites ATOMICS, and ATOMICS.md:247 cites DECISIONS (R5, R6).

### 2.2 Type, and the de facto composition table

**One stored slug** (node.type) resolves independently through a set of separate per-type tables, with no shared registry:

- art: GLYPH_DEFS and GLYPH_BB (theme.mjs:26-29, 45-109);
- behaviour: TOWERS (kinds.mjs:49-51);
- palette order and hotkeys: NODE_TYPES (palette.js:14);
- CLI acceptance: NODE_TYPES (verbs.mjs:31);
- the ASCII letter (verbs.mjs:2200);
- the name prefix (model.mjs:253).

**The lists disagree in order.** The palette is [host, server, loadbalancer, firewall, vxlan, router]; the CLI is [host, server, firewall, router, loadbalancer, vxlan]. Only the CLI list is pinned to GLYPH_BB by a test (tests/cli-tool.test.js:1426-1431).

**The validator is open.** It accepts any slug (validate.js:180, unchanged since 67d229d).

**Unknown and default types.**

- An unknown slug renders an empty `<use>` inside the host fit box (kernel/renderer.mjs:225).
- The scene defaults a missing glyph to 'router' (geometry.mjs:84). Every fit falls back to the host box.

**Sentinels.** The editor's text box stores type 'text' (model.mjs:261-269). The CLI panel defaults to 'host' (verbs.mjs:1965,1990). Templates carry both conventions (R5).

**Spelling.**

- Every stored and coded slug is 'loadbalancer'. The ruled composition is 'load-balancer' (DECISIONS.md:300). A node typed 'load-balancer' yields 0 towers [M-run R4 probe2].
- Run-mode placement hard-codes 'loadbalancer' (input.js:642).

**Retype** (G3). node.type is settable at every door as one undoable `set` (§5 "Retype" row).

- Links survive and no derived pass runs. A router with three terminating links retyped to server is accepted, the plan is exactly `set:node{type}`, and validateDoc on the result is null [M-run G3]. The record's only statement is DECISIONS.md:53 (Amended 2026-06-13): "id/name/links survive".
- Retype to 'waypoint' and to 'load-balancer' is accepted; 'Router' is refused ("invalid value for node.type") [M-run G3].
- The CLI's retype verb is open while its create verbs are closed (D46).
- Retype grants or removes TOWERS behaviour retroactively (D45).
- REST files it in history as 'move node' (D48).
- The only test touching retypeNode asserts that it carries no `before` (tests/input.test.js:660-684). Nothing tests links, permission or towers under retype [M-read G3].
- What retype does to an anchor under the permission ruling is F41.

### 2.3 Appearance

**Four derivation shapes coexist** (R5):

1. An attribute map: linkAppearance + APPEARANCE_KEYS, for links only (geometry.mjs:414-449) [V].
2. A layer list: waypointLayers (geometry.mjs:297-309), walked by kernel/renderer.mjs:211, renderer.js:336 and painter.js:72.
3. Shared predicates with per-renderer emission, for nodes: isPanel, frameWidth, frameRadius, showsSockets (kernel/renderer.mjs:26-48).
4. Per-site literal assembly, for zones and groups (kernel/renderer.mjs:166-170; renderer.js:297-308).

**No composes/priority resolver exists** [V].

**Renderers.** There are two full renderers (kernel/renderer.mjs:16-20). There are also partial ones: the palette tile, the drag/stamp ghost, the favicon, the CLI ASCII map and the turret aim (movers.js:303-315). HANDOVER.md:17 counts five renderers.

**Two policies for who owns a look coexist.**

- B172: a kind resolves to a CSS class, and the stylesheet owns the look (validate.js:150-161).
- B235 (84f9dd7): a derived attribute is the one authority.

Canvas and export disagree in the places listed in §9 (D27–D33).

### 2.4 Behaviours

Every simulation behaviour follows one pattern: a stored intent plus a derivation over the document, the clock and the code revision (R4).

| Behaviour | Stored input | Derivation | Site |
| --- | --- | --- | --- |
| spawner | waypoint.spawn, per instance | spawnersOf, then prepareSpawner | engine/spawners.mjs:30-49 [S]; movers.mjs:72-79 |
| movers | none | moversAt, a closed form of t | movers.mjs:107-163 |
| tower | node.type, looked up per type in the code table TOWERS | worldOf / towerFor | rules.mjs:52-64; kinds.mjs:72 |
| combat | none | combatAt folds over ticks, using the current world for every tick | rules.mjs:160-198 |
| aim | none | aimAt, by progress fraction | rules.mjs:88-102 |
| reveal | doc.reveal (origin + beats) | revealedAt / beatsOf | model/reveal.mjs:112-148 |
| content action | node.content[].action, per instance | host maps a CustomEvent | main.js:115-130 |

- **Who computes.** The server computes no simulation (R4: no server/ import of spawnersOf, moversAt or combatAt). The browser computes it in run mode only (movers.js:65-70), and so does the CLI (`draw movers` / `draw combat`). The CLI uses its own host clock (verbs.mjs:1486,1526).
- **Parity inputs.** rules.mjs:19-25 names three parity inputs: the document, the clock and the code revision. Spawner link selection also depends on linksAt ORDER [M-run R4 c].
- **Tuning numbers.** Towers keep their numbers centrally ("declared once and stored nowhere", kinds.mjs:8-16). Spawn stores interval and speed per document; the defaults (900ms, 1.4 cells/s) are written in by commands.js:565-575.
- **Retype re-folds the past.** worldOf reads the current type (rules.mjs:52-64; kinds.mjs:72), and combatAt folds every tick with one world (rules.mjs:160-198). A retype therefore grants or removes tower behaviour over the whole folded window: loadbalancer → server takes dead movers from 14 to 0 at the same t, and server → loadbalancer takes them from 0 to 14, the earliest death 98 ticks before now [M-run G3, engine level] (D45).
- **Content carries per-instance behaviour.** Regions can hold `action` (W5) and `input` (W6) (validate.js:136-137), so a content write grants or removes behaviour per instance [M-read G3]. A content node draws no type glyph (renderer.js:383), so retyping one changes tower behaviour with no visible glyph change [I].

### 2.5 Rules and situation

**The word "rule" names at least seven constructs** (glossary row). They split on whether the construct may write.

- **May not write.** Engine derivations (rules.mjs:32-34, ruled 2026-09-01). This ruling is recorded only in the code comment; it is not in DECISIONS (R6).
- **Do write.**
  - Run-mode situation rules: the pilot rule arms a spawner, and the "second rule" places a tower (input.js:588-647).
  - Planner cascades, sweep and collapse (txn.mjs:196-262).
  - The browser split (input.js:984-1033).

**Situation.** It is an inert value with free predicates (situation.mjs). Run mode dispatches through hand-written branches; there is "no dispatch table here on purpose" (input.js:535-537). In the tower rule, `this.situation(null)` always yields a null target, so `onOpenGround(s)` (`!s.target`) is always true [S input.js:637-638, situation.mjs:143]. The real gate is a DOM `closest('.node,.zone,.link,.group')` test plus occupiedAnyAt (R4).

**DERIVATIONS.** It has held exactly one entry since 42b70e1, yet rules.mjs:73-75 says "Two exist" (R4).

**Kernel GRC.** The kernel GRC rules (grc.mjs:133) have no production caller in server/, app/src, cli, engine or model (R2 grep).

### 2.6 Events

- Behaviour is deliberately level-triggered. Facts are asked, not announced (rules.mjs:8-17).
- The "events" that exist are the model change stream, the commit boundary, DOM input, draw:action, transport messages, session-log notes and history records.
- There is no gameplay event:
  - A mover's birth and arrival have none.
  - Death is a fold result (a dead map from mover to tick).
  - Arrival at the far end is recorded nowhere (R4 grep for score, lives, leak, escaped).

### 2.7 Pipeline

"Pipeline" as ruled (the appearance pipeline, H15.9) exists for links only. No module is named pipeline (R5 grep). See §1.4.

---

## 3. Track B: how things connect today

### 3.1 Stored shape

- **link** = {id, name, src, dst} required, plus optional via (waypoint ids, at most 500), closed, flow and control, all booleans (validate.js:238-251; shape.mjs:25-49).
  - src and dst must each be a node or a waypoint, must exist and must differ (referential.mjs:70-72).
- **waypoint** = {id, name, x, y} required, plus optional pinned and spawn.
- **Refused keys.** Unknown keys are refused. An optional key may be absent but not null (R1).
- **Removing a key.** `set` cannot remove a key, so every door clears an optional field by `put`-ing the whole entity (commands.js:253-265; verbs.mjs:2519-2540). inverseOfSet turns the inverse of a key-introducing set into a whole put (txn.mjs:49-56). `put` on an existing id is an upsert (txn.mjs:353-386).
- **Redundant representations** that every door can produce:
  - via absent vs [];
  - closed/control false vs absent;
  - a→b vs b→a for an undeclared link;
  - node.shape absent vs 'circle', a node field listed here beside the link pairs. Renderers default absent to circle (renderer.js:260, 393; adapt.mjs:35). The browser toggle writes 'circle' explicitly and never returns to absent, and the CLI cannot clear the field [M-read, M-run G3].
- **Group membership is a stored id list** (validate.js:264). It is the only stored container that a derived delete can leave stale: the orphan sweep deletes waypoints, which groups can hold, and does not trim them (D42). The other id-holding containers are link src/dst/via (safe by construction for the sweep), doc.selection (reconciled by Model.del, model.mjs:124-127) and reveal beats (stale ids tolerated on purpose, validate.js:470-472) [M-read G2].

### 3.2 Refusals and invariants

| Class | Rules | Where enforced | When |
| --- | --- | --- | --- |
| Referential refusals | ends exist and differ; every via waypoint exists; selfConflict (no waypoint twice within one link, referential.mjs:93-95); duplicateThroughBend (two links bending at one waypoint may not share an unordered pair, referential.mjs:125-147; ignores plane and flow [M-run R1 P13]); groupReferential: every member exists, no groups of groups (referential.mjs:149-156) | validateMutation (validate.js:351-357; groupReferential only when an op writes a group carrying `members`, :358-361; a `del` gets only the id check, :322-326 [M-read G2]) and validateDoc (:439-456) | requested ops and whole documents only; deliberately NOT in violations() (referential.mjs:23-29) |
| violations() backstop | one group per member; group minimum size, counting LISTED members rather than existing ones (invariants.mjs:249-258), so a dangling member is invisible to it [M-run G2] (D42); at most 1 straight link per unordered pair (ignores plane, direction, closed); one node or waypoint per anchor point (spans ignored) | plan() refuses only violations a transaction INTRODUCES (txn.mjs:276-288); install only reports them (store.js:663-667) | every transaction, including derived ops [V] |
| Editor-only rules | a straight duplicate is refused only when a straight link exists (input.js:229-249, B80); linkNodes refuses any existing pair (commands.js:302) | browser | browser gestures |

### 3.3 Derivations

**route to path (two builders)** (R2):

- **Model.pathOf** (model.mjs:170-186).
  - Admits: src/dst as a node, a waypoint or a bare {x,y}; via as a waypoint only, otherwise null.
  - Output: raw entity px, corners not rounded, no closing segment.
  - Used by: the canvas, overlay, live preview, spawners and REST.
- **kernel resolveRoute** (kernel/engine.mjs:124-138).
  - Admits: any byId entity (node, waypoint, zone, group) or a cell array [M-run R2 probe3].
  - Output: grid-snapped to pitch/2.
  - Used by: the SVG export.

**Drawn geometry** (router.mjs:58-103):

- The line runs through anchor centres.
- Each interior vertex becomes a quadratic Bezier with radius min(BEND_R=20, half of each adjacent segment).
- A closed route rounds every vertex and adds a closing run.
- It is NOT orthogonal by construction. A diagonal straight link is emitted, and GRC `ortho` fails on it [M-run R2 §7].

**Attachment on a multi-cell node** is always the origin cell centre (kernel/engine.mjs:44,52; model.mjs:176-178).

**Roles.** waypointRoles (geometry.mjs:456-532) reads closed, src/dst, control and flow, and never reads via:

| Terminations at the waypoint (open links; threading adds 0) | Condition | Roles | Note |
| --- | --- | --- | --- |
| 0 | — | [] (bend) | also a via-only waypoint and a closed-ring end |
| 1 | — | ['endpoint'] | also 1 termination + 1 threading link [M-run R1, R2] |
| 2 | planes differ | ['junction'] | |
| 2 | both declare flow: one in, one out | [] (bend) | |
| 2 | both declare flow: both in or both out | ['junction'] | |
| 2 | fewer than two declare flow | ['endpoint'] | undeclared/undeclared and declared/undeclared [M-run R1, R2, R7] |
| more than 2 | — | ['junction'] alone (early return :479) | junction supersedes endpoint (B211) [M-run] |

- Single-role projections map junction to 'bend' (geometry.mjs:103-106, 534).
- Roles are computed for waypoints only (kernel/engine.mjs:66-67; renderer.js:309).
- The two renderers pass different link sets. The export passes terminating links (kernel/engine.mjs:73-76); the canvas passes model.linksAt, any role (renderer.js:325,336).

**Collapse eligibility** differs from roles. collapseAtWaypoint (invariants.mjs:152-192) behaves as follows:

- refuses closed links (:154);
- needs both links to terminate (:157-158);
- orients both to face through (:160-161);
- refuses opposing declarations and differing planes (:182-186);
- MERGES undeclared and one-declared pairs (:176-191) [M-run R2 §1, R6].

**Planes and direction.**

- The plane of a terminus is allControl, with mixed read as data (geometry.mjs:390-392). It thins the endpoint ring.
- The arrowhead comes from linkMarker (:451-454).
- Direction at a point comes from facing/linkFacing.

### 3.4 What a run or path is, and is not

- **Within one link**, the via list is the run of bends, and one `flow` covers every segment (R1, R2).
- **Across links**, no code walks a run:
  - pathOf takes one link (model.mjs:170-187);
  - spawnersOf follows one link (spawners.mjs:34-37 [S]);
  - reflectPathSelection and refreshWaypointsOf cover one link (renderer.js:180-192, 366-371);
  - contextOf neighbours are one hop (rest.js:88-90);
  - the CLI `links` verb shows the immediate far end (verbs.mjs:2697-2714).
- **Searches run.** The readers searched for chain, walk, trace, propagat, traverse, contiguous, reachab, runOf and inherit (R1, R2, R4, R7).
- **The same drawing has two stored encodings.** a→w + w→b can be stored as two links, or as one link a→b via [w]. Which one the document holds depends on history:
  - building it directly keeps two links;
  - deleting a third link from a 3-way junction collapses the remaining pair into one link via [w] [M-run R7; R1 P7].
- **The pass-through is classified three ways**:
  - bend, per ATOMICS.md:281 [S];
  - endpoint, per waypointRoles;
  - merge-eligible, per the collapse.
- **Propagation is scoped only by the record.** Opposing declarations fragment a run (ATOMICS.md:312-322; BOARD.md:834-841), and there is no code. B232 (BACKLOG:275) says an undeclared link "cannot make a path through by itself".

### 3.5 Traffic

- **Movers are the only thing that travels.**
  - Each mover travels ONE link's path, oriented away from the armed end, and is consumed at the far end. It does not continue even when the far end is a bend-role waypoint joining the next link.
  - A mover reads spawn, link src/dst/via/closed and anchor positions. It reads neither flow, nor control, nor roles (spawners.mjs:30-49 [S]; R4 grep).
- **Junction forwarding is unbuilt.** Clone, round robin and route are designed (ATOMICS.md:340-349) and not built. BOARD.md:849 puts "packet movement over the graph" out of H15.

### 3.6 Designed, not built

- Face-locked ports [LOCKED] (ATOMICS.md:69-76) and parallel-link ports [LOCKED] (:106-115).
- The crossing tunnel-gap [LOCKED] (:61-65). A grep for "tunnel" finds nothing in kernel/ or app/src.
- The container-edge handle [OPEN] (:80-89).
- The routing fabric [OUT OF SCOPE] (:92-95).
- "Coincident but unconnected" is parked (:237-242).
- The auto-router (router.mjs:1-4).
- The permission table (H15.7).
- Propagation (H15.5).
- Bus/ortho/junction realizers exist only in the archive sim (drawv2-archive/design-generators/design/sim/realizers.mjs). kernel/engine.mjs:25-26 still points to dev/design/sim for them.

---

## 4. The seam

### 4.1 Anchor

The ruled core has no code (§1.3). Each site admits a different set of "anchors" as a route reference:

| Site | src/dst admits | via admits | Evidence |
| --- | --- | --- | --- |
| Validator | node, waypoint | waypoint | validate.js:241-243; via=[node] refused [M-run R2 probe2] |
| Model.pathOf | node, waypoint, bare {x,y} (live preview) | waypoint (otherwise null) | model.mjs:171-183 [M-run R2] |
| kernel resolveRoute | any byId entity (node, waypoint, zone, group) or a cell | the same | kernel/engine.mjs:90,102,124-131 [M-run R2 probe3] |
| GRC attachment | port, node, junction, waypoint | — | grc.mjs:69 |
| CLI `link` | node or waypoint reference | cells only; mints new waypoints | verbs.mjs:1880, 1908-1916 |
| HIERARCHY canon | node, waypoint, port, junction, cell | — | HIERARCHY.md:51-55 |
| DECISIONS step 3 | — | "any node holding the capability" | DECISIONS.md:204 |

In code, the grid-position sense (occupancy, placement, layout API) is the one bound to identifiers (§1.3).

### 4.2 Routable

`routable` has no code (§1.3). Its ruled responsibilities live today in these places:

| Ruled responsibility | Where it lives today | Shape |
| --- | --- | --- |
| Role derivation | kernel/geometry.mjs waypointRoles; restated at txn.mjs:139-149 (wasBendOnly), verbs.mjs:1589-1597 (CLI spawn) and spawners.mjs:35 | pure, kernel/ |
| Visual layers | kernel/geometry.mjs waypointLayers | pure, kernel/ |
| Collapse (a write) | model/invariants.mjs collapseAtWaypoint, applied by server/txn.mjs plan | pure plus planner |
| Split (a write) | model/invariants.mjs splitAtBend, applied by app/src/input.js splitsFor and commands.routeLink | pure plus browser |
| Validator participation | model/referential.mjs (refusals) and model/invariants.mjs (violations) | pure, model/ |
| Picking | app/src/pick.js endpointAt (pick.js:81-85) | browser |
| Permission table | nowhere | — |
| Pin clear (a write) | app/src/input.js:938, local only; threading by `set via` or /commit leaves pinned:true on the server (D5) [M-run G3] | browser |

kernel/ and model/ do not import each other [V]. That is why facing/linkFacing, samePlane and the termination predicate are restated. engine/ imports both (movers.mjs:38-39; spawners.mjs:23; rules.mjs:40; situation.mjs:28-29).

### 4.3 How rules write today

plan() runs in a fixed order [V]: request ops plus cascades, then the orphan-bend sweep, then the collapse, then invariant refusal. It is a single pass [V]. Within that pass the projection advances per requested op (txn.mjs:91, "advance the projection for op i+1"), but the sweep and the collapse each compute all their writes against one projection and apply them once (:174-177; :259-261) [M-read G1; S]. For the sweep that is harmless, because its writes are independent. For the collapse it is not (D41; "Composition inside one plan() pass" below).

| Write | Computed | Pure part | Applied by | Validation | Undo | Reaches originator | Reaches peers |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Requested op | any door | — | plan() | validateMutation per op (FIELDS + linkReferential) + introduced violations() | inverse built in plan | already applied optimistically; ack | change broadcast |
| `place` intent | planner planOne | resolveAnchor | plan() | rewritten into a put, then validated as a put | yes | ack | change |
| Delete cascade | planner planDel; client twin | groupAfterRemoval | plan() | violations() only (R3; txn.mjs:318-324) | same record | client projected it itself | change |
| Group steal | planner planPut; client twin | groupAfterRemoval | plan() | violations() only | same record | projected | change |
| Orphan sweep | planner only | (inside txn.mjs) | plan() | violations() only [V]; does not maintain group.members, so it commits validateDoc-invalid states [M-run G2] (D42) | same record; redo recreates the invalid state [M-run G2] | ack diff | change |
| Collapse | planner only | collapseAtWaypoint | plan() | violations() only [V]; merges are computed against an unadvanced projection, and violations() cannot see the resulting failure forms [M-run G1] (D41) | same record [V]; content restored, collection order not (D43) [M-run G1] | ack diff, filtered by op:kind:id key [S] | change |
| Split | browser commitRoute only [V] | splitAtBend | client builds entries; plan applies them as REQUESTED ops | validateMutation + violations() | same record as the new link | local | change |
| Pin clear on threading | browser only | none | local model.set, never sent | none | none | local only | never |
| Undo / redo | server | stored inverse / ops | txn.mjs:600-650 | none | — | ack applies all ops | reversal broadcast (no reveal, from:null) |
| Load migration | boot, examples, restore | shedRetired | store | validateDoc; violations reported | log inverses untouched | snapshot | snapshot |

**The ack reconciliation.** For a commit, the originator applies only the planned ops whose `${op}:${kind}:${id}` key it did not itself send (sync.js:409-416 [S]). A derived op that shares a key with a client-sent op is therefore dropped (D2, D3, D44).

#### Composition inside one plan() pass (G1)

This is the first measured case of two derived writes composing wrongly. It is the "how are writing packs ordered and applied" question of F17, now F40.

**Mechanism** [M-read G1; S]:

- Requested ops advance the projection one op at a time (txn.mjs:88-94). The comment at :296-306 names that per-op advance as the reason `place` resolves server-side.
- The sweep computes `nowReferenced = refs(proj)` once (:162), loops at :165-171 and applies at :174-177. `refs` reads links only (:116-124) and the sweep deletes only waypoints, so its writes are independent and the unadvanced projection is harmless there.
- The collapse builds `touched` from the link dels already in `out` (:207-213). For each touched waypoint it reads the pair from `proj` (:216, :230-231), computes the merge (:232) and only pushes the ops onto `merges` (:247-248). `merges` is applied once (:259-261), so every merge after the first reads links as they stood before any merge.
- A stale op on a missing link is silent. Model.set and Model.del return on a missing id (model.mjs:111-114, :119-121), and applyOps passes both through; it throws only for an unknown op name (ops.mjs:45-48), although its comment says it throws rather than silently no-op'ing (C47).
- `touched` always reads the link as it was before the transaction: :210 reads `op.entity || model.get('link', op.id)`, and no del the planner emits carries `entity` (the dels at :169, 247, 361, 372, 411, 422, 457, 464, 474).
- The only check after the merges is violations() (:276). No rule there detects a lost link, a no-op set or overlapping survivors (invariants.mjs:211-309).

**Measured cases** [M-run G1, stale-merge/cases.out]. In every case plan returns ok=true, violations() returns [] and validateDoc returns null.

| Case | Setup / request | Result |
| --- | --- | --- |
| P1 | x→w1 (A), w1→w2 (B), w2→y (C), and a parallel L w1→w2 via [w3]; delete L | Ops: `del L, del w3, del B, set A{x→w2 via[w1]}, del C, set B{…}`. The last set hits deleted B and does nothing. Only A remains; y has no link. |
| P2 | As P1, with L stored w2→w1 so `touched` runs w2 then w1 | `del C, set B{w1→y via[w2]}, del B, set A{x→w2 via[w1]}`. Every op finds its target and y still loses its link. A "throw on a missing id" guard would not see this form. |
| P3 | C stored y→w2 and inserted before B | B is the dropped half of both merges: `del B, set A, del B, set C`. Two links survive, A x→w2 via[w1] and C y→w1 via[w2]; both draw the w1–w2 segment, and each waypoint is an endpoint of one and a bend of the other. The expected result is one link x→y via [w1, w2]. |
| P4 | Delete node n, which has T1 n→w1 and T2 n→w2, on the chain x-w1-w2-y | The cascade deletes T1 and T2, both waypoints are touched, and the outcome is P1's. |
| P5 | One request `[del T1, del T2]` on P4's document | Identical to P4. |
| P6 | As P1, with C = w2→y via [w4] | Same loss, and w4 is left referenced by no link, because the sweep ran before the collapse and does not run again. |
| P8 | A x→w1 flow:true, B w1→w2 undeclared, C y→w2 flow:true | The stale read at w2 pairs B (undeclared) with C, so the pair qualifies and C is deleted; the following `set B` does nothing. With the projection advanced, the pair at w2 is A′ with C, both arriving, and collapseAtWaypoint returns null (invariants.mjs:176-177), so C survives as a convergence. |

**Four failure forms** [M-run G1; P1–P3 and the chain search, seed 1]:

- (a) a set on a link already gone does nothing, and the absorbed route is lost (P1);
- (b) a delete of a link an earlier merge just rewrote, with every op finding its target, and the same loss (P2);
- (c) the same link deleted twice, leaving two overlapping survivors where one is expected (P3); 684 transactions in chain seed 1;
- (d) the same link set twice, where the last write wins and the first merge's route is dropped; 238 transactions in chain seed 1. Example: delete l1 and l3 from x-w0-w1-w2-y, where l4 = w2→w0 via v0 and l5 = w1→w0 via v0; the planner emits `set l2{w2→w0 via[w1,v0]}` then `set l2{w1→w0 via[w2,v0]}`, the w1–v0 segment disappears, and w0 keeps two terminating links that nothing collapses.

**Every derived-pass boundary, checked for the stale-projection shape** (G1):

| Boundary | Stale? | Evidence |
| --- | --- | --- |
| request op → next request op | no; advanced at :91 | [M-read] |
| cascade → sweep | no; cascade ops are part of each planOne step, applied at :91 before `refs(proj)` at :162. A different defect sits here (D42). | [M-read] |
| within the sweep | not advanced, but its writes are independent (:116-124) | [M-read] |
| sweep → collapse | no; applied at :176, and :212 keeps only waypoints still in `proj` | [M-read] |
| collapse → collapse | **STALE** (D41) | [M-run] |
| collapse → sweep | the sweep never runs again. A valid merge cannot unreference a waypoint, because the merged link's refs are the union of both halves' (invariants.mjs:188-189) [I from read]. Advancing loop, chain seed 1: 0 merges orphaned a waypoint; shipped plan(): 162 transactions left a waypoint referenced by no link | [M-run] |
| collapse → invariant refusal | applied at :261 before violations() at :276; no rule fires on forms (a)–(d); P1–P8 all return [] | [M-read]; [M-run] |
| collapse → groups | not affected; groups hold only nodes and waypoints (referential.mjs:149-155) and the collapse deletes only links | [M-read] |

**Can a collapse re-trigger another collapse?**

- In the code, no: `touched` is fixed at :207-213 before any merge is pushed, so the outbound link a merge deletes never enters it [M-read G1].
- In principle, a valid merge cannot create a new candidate, because the merged link carries the union of both halves' refs and the link count at every other waypoint is unchanged. The one exception is a waypoint referenced by both halves, which is refused as a self-link (invariants.mjs:162) or yields a D1-class document [I from read, G1]. Declared flow can only remove eligibility at a neighbour, never add it (P8 is that eligibility read against a stale link) [I from read].
- Sampled with G1's advancing loop (the repo's collapseAtWaypoint, projection advanced after each merge): about 74k valid random documents showed a new candidate at an untouched waypoint 75 + 83 times, and validateDoc refused every one of those results; about 117k chain documents showed 0 [M-run, sampled].
- The shipped single pass does leave new candidates, only through stale merges: at untouched waypoints 107/101/109 (chain seeds 1–3) and 76/87 (random seeds 1–2); at touched waypoints still eligible after plan(), 60/41/62 and 32/39 [M-run].

**Rates** [M-run G1]. These describe G1's generators, not real documents. The "advancing loop" is G1's scratch loop with the same `touched` set, pair choice and collapseAtWaypoint, advancing the projection after each merge.

| Measure (chain-biased generator, 40k trials per seed) | Seed 1 | Seed 2 | Seed 3 |
| --- | --- | --- | --- |
| Valid documents | 38887 | 38982 | 38873 |
| Transactions with 2 or more merges | 3484 | 3529 | 3511 |
| plan(): an op targets an id already gone | 1454 | 1469 | 1459 |
| plan(): connectivity over nodes and waypoints changed by the collapse | 1603 | 1654 | 1611 |
| …of which no op targeted a missing id | 868 | 862 | 867 |
| Advancing loop: connectivity changed | 0 | 0 | 0 |
| Advancing loop differs from plan() | 2373 | 2383 | 2400 |

Random generator (search2.mjs; seeds 1/2): 149/153 transactions had 2 or more merges, and 46/44 broke connectivity under plan(); the advancing loop broke none.

**Not measured** (G1): the browser, CLI, REST, network, test suite, gate and live estate; the ack or client path for D41 (both sides run the same Model.set, so they are expected to converge on the same wrong result [I]); whether a fixpoint loop and the advancing loop differ after a D1 self-conflict merge.

### 4.4 Every place Track A reads a Track B derivation

| # | Track A consumer | Track B input | Site | What it reads, and what it ignores | Mark |
| --- | --- | --- | --- | --- | --- |
| 1 | Browser spawn arming (pilot rule) | role set via situation.target.roles | input.js:603; situation.mjs:86,126-127 | Requires 'endpoint'. A junction and an agreeing pass-through are refused; a thread + termination ('T') is accepted. | M-run (R1, R2, R4, R5, R6) |
| 2 | CLI spawn arming | its own structural predicate | verbs.mjs:1589-1597 | Refuses a waypoint in ANY via and a ring-only waypoint. Admits a junction and a two-link terminus. | M-read |
| 3 | Server spawn validation | none | validate.js:171-173,236 | Shape only. | M-read |
| 4 | Spawner emission | linksAt order, termination, closed, pathOf(one link) | spawners.mjs:30-49 [S] | Takes the first terminating non-closed link in index order. Direction is away from the armed end. Ignores roles, flow, control and via membership. | M-run (R1, R2, R4, R7) |
| 5 | Movers | spawner pts + routeGeometry | movers.mjs:72-79, 107-163 | One link, consumed at the far end. progress is a fraction of that link. | M-run R4 |
| 6 | Combat and aim | movers | rules.mjs:88-130, 160-198 | Inherit 4–5. The board is the current world for every folded tick. | M-run R4 |
| 7 | situation.spawning and the `.spawning` class | stored spawn only | situation.mjs:89; renderer.js:332 | Not emitting-state, so an inert spawn still reads as spawning. | M-run R4 e |
| 8 | Waypoint layers (canvas) | roles + allControl(linksAt, any role) | renderer.js:325,336; geometry.mjs:297-309,390-392 | Threading links count toward the ring plane. | M-run R2 (kernel function with the canvas input) |
| 9 | Waypoint layers (export) | roles + terminating links | kernel/engine.mjs:66-77 | Diverges from #8 (ring width 5 vs 3). | M-run R2 |
| 10 | Link appearance | flow, control | geometry.mjs:439-454 | Arrowhead, dash, width. | M-read |
| 11 | `.on-selected-path` | the selected link's src/dst/via | renderer.js:180-192 | One link only. The CSS misses the wp-anchor and wp-junction layers (D30). | M-read |
| 12 | Reveal trace | stored src→via→dst order | reveal.mjs:37-39; reveal.js:95-110; renderer.js:234-237 | Ignores flow. | M-read |
| 13 | Run-mode tower placement | occupancy (client footprint index) + DOM hit test | input.js:636-646 | The situation predicate is vacuous [S]. | M-read |
| 14 | Turret glyph rotation | movers | movers.js:303-315 | Client-only; never cleared on retype (D35). | M-read |
| 15 | REST contextOf and CLI `about`/`links` | linksAt (any role), pathOf | rest.js:88-96; verbs.mjs:997, 2709 | Neighbours include the ends of threading links. `about` misformats the path (D17). | M-read; D17 by expression evaluation |
| 16 | CLI `draw movers` / `draw combat` | scan-order linksAt, host clock | verbs.mjs:1472-1528 | Can pick a different link than the browser (D11). | M-run R4 c |
| 17 | Group membership (a Track A container, §1.4) | the orphan sweep's derived `del waypoint`, whose role comes from the pre-state: bend-only before, unreferenced after | txn.mjs:161-176 vs planDel trimGroupsHolding :406-418, called at :425 and :472 | Reads nothing: the sweep never consults groups, so the swept id stays listed, where the request path trims it or dissolves the group. Six request shapes reach the sweep. Result: plan ok, violations() [], validateDoc refuses, and the file is skipped at boot (D42). | M-run (G2: gapfill/triggers.mjs, boot-skip.mjs; critic/sweep-group.mjs) |

Track B reads Track A in only two ways today:

- **Kind gates.** **CORRECTED:** roles are derived for the `waypoint` kind only (kernel/engine.mjs:67; renderer.js:309), and the collapse admits only waypoints to its candidate set (txn.mjs:212) [S] (was: "Roles and collapse run for the `waypoint` kind only (txn.mjs:231)"; txn.mjs:231 is the pair pick `const other = at.find((l) => l !== src)`, and txn.mjs derives no roles).
- **Id prefix.** kindOf splits the id on '-' (model.mjs:49-51).

Track B also WRITES Track A in one place, and one of its two paths misses it:

- **Membership write-back.** A Track B deletion of an anchor must also remove the id from any group, or dissolve the group. Of the two waypoint-deletion paths, planDel does this (txn.mjs:406-418) and the orphan sweep does not (txn.mjs:163-170) [M-run G2]. The sweep is the only derived delete of a kind that a stored container can hold: the collapse, node cascade, waypoint cascade and steal delete links or groups, which no container can reference (validate.js:264; referential.mjs:149) [M-read G2].

In the other direction, Track A operations reach Track B derived writes:

- **A node delete performs a routable write.** It sweeps the bends of the node's own links and collapses at a far two-link waypoint or junction: `del link C, del node, del link B, set link A {src:a, dst:b, via:[w]}`, taking W from ['junction'] to [] [M-run G3; critic/node-del-collapse.mjs]. The originating browser receives that write only through the ack diff, and diverges in D44's case.
- **A retype changes the node side while the links stay.** It is one undoable `set`, runs no derived pass and consults no permission, yet it changes what the anchor permits under the ruled table (DECISIONS.md:240) and flips tower behaviour retroactively (D45) [M-run G3]. See §2.2 and F41.

The type-to-variant permission lookup, and capacity per endpoint kind (invariants.mjs:24-42), are both unbuilt.

### 4.5 Restated rules (twins) that touch the seam

- facing ↔ linkFacing, a declared twin (invariants.mjs:136 ↔ geometry.mjs:394; scan-twins.mjs:49-62).
- samePlane ↔ inline `!!a.control !== !!b.control` (geometry.mjs:355 ↔ invariants.mjs:186).
- pairKey ↔ referential pairKey, with two encodings (invariants.mjs:56 ↔ referential.mjs:125).
- Model.pathOf ↔ kernel resolveRoute: different admitted refs and snapping.
- The termination predicate, restated at 7 or more sites (§1.2).
- Role readings: waypointRoles ↔ wasBendOnly (txn.mjs:139-149, no closed check) ↔ CLI spawn (verbs.mjs:1589-1597) ↔ spawnersOf link pick.
- Arming gates: onEndpoint ↔ CLI ↔ none at the server ↔ emission.
- The delete cascade ↔ its client projection (txn.mjs:420-473 ↔ commands.js:51-124). Group steal ↔ createGroup (txn.mjs:363-379 ↔ commands.js:126-147).
- place resolution ↔ CLI local resolution (anchor.mjs:103-148 ↔ verbs.mjs:1142-1185): hypot vs squared distance.
- Occupancy, five ways (§1.2).
- newId ↔ CLI mint ↔ adapt newId (model.mjs:40; verbs.mjs:1839; adapt.mjs:24).
- nextName ↔ CLI name=id.
- FIELDS ↔ CLI SETTABLE (validate.js:176-266 ↔ verbs.mjs:344-367).
- The type lists (§2.2).
- changeBody ↔ reversalBody.
- announceActivity ↔ the inline announce (rest.js:40-46 ↔ protocol.js:508).
- The server reveal-schedule end ↔ the unexported durationOf (txn.mjs:554-555 ↔ reveal.mjs:85).
- positionOf ↔ the moversAt formula (movers.mjs:167-172 ↔ :127).

---

## 5. Operation x door matrix

Doors are the browser (which rides the websocket), the CLI (which reaches the server through REST, via VERBS[].route at verbs.mjs:365-376 per R3), REST, and the server planner (derived ops).

"Optimistic" means the browser applies the change locally before the ack (changes.js:51-56).

Derived passes (cascade, sweep, collapse, split) are recorded in the "Applied by" cell. Rows marked (G3) were added by gap fill G3 and measured at plan level with the real plan(), validateDoc and browser command builders [M-run G3]; no DOM, CLI or network ran, and the ack filter was restated from sync.js:411-412 rather than run through the Sync class.

| Operation | Browser | CLI | REST | Pure part lives | Applied by | Validation | Undo | Client projection |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Create node | palette drop, stamp, text tool, chainThroughNode, run-mode tower, clone (commands.createEntity) | add, place, panel (name=id; closed type list; panel --type unchecked) | POST /nodes (makeNode), /commit | model.makeNode | plan() planPut | validateMutation + violations() | inverse del | optimistic |
| `place` (intent) | none | emitted only when drafting; otherwise resolved locally | /commit | server/anchor.mjs resolveAnchor | planOne rewrites into a put | as put | yes | n/a |
| Create waypoint | idle `w` (pinned:true), stamp, palette drop, mid-route `w` (live put, committed by routeLink) | add waypoint; link --via mints | /commit only (no /waypoints collection, rest.js:15) | model.makeWaypoint | plan() | validateMutation + violations() | yes | optimistic |
| Create straight link | routeLink, linkNodes (refuses any existing pair), chainHop | link | POST /links: makeLink(src,dst) only, no via/flow/control/closed (rest.js:196) | model.makeLink | plan() | linkReferential + straightCapacity | yes | optimistic |
| Create routed link | commitRoute | link --via (fresh waypoints only) | /commit | — | plan() | as above | yes | optimistic |
| Link ending at another link's bend | commitRoute SPLITS (del + 2 puts); chainHop does not split | accepted unsplit | accepted unsplit [M-run R1 P13b, R3] | splitAtBend (invariants.mjs:194-202) | client builds; plan applies as requested ops | validateMutation + violations() | same record | client-computed only |
| Thread an existing waypoint as a bend | `w` on an occupied waypoint (input.js:919-939): no split; pin cleared locally only | impossible (mint-only) | /commit | — | plan() | duplicateThroughBend refuses only the same pair | yes | pin clear never sent |
| Replug (set src/dst) | nodes only (input.js:164-201) | none (not in SETTABLE) | PATCH /links | — | plan() planSet | validateMutation merges src/dst/via | yes | optimistic; triggers neither split nor collapse |
| Re-route: set via on an existing link (G3) | no gesture; the only browser via-set on an existing link is the waypoint-delete strip projection (commands.js:96) | `set` refuses it ("a link has no 'via'", verbs.mjs:2499; table :351-356); reachable through `draw commit --ops` and drafts with no CLI-side check (verbs.mjs:791-839); `link --via` at creation only | PATCH /links/:id, label 'move link' (rest.js:1098) (D48); /commit | none | plan() planSet. SWEEP yes: `set via [w2]` on a→b via [w1,w2] gives `set link, del waypoint w1`, and `set via []` sweeps both bends. COLLAPSE no: `touched` reads only `del link` ops (txn.mjs:207-213). SPLIT no. No pin clear (D5). A thread cannot change a terminus's role: threading another link's bend gives roles [] (a crossing), threading a terminus keeps ['endpoint'] (a T) [M-run G3] | FIELDS.link.via is waypoint ids only (validate.js:243); via = [node] refused [M-run G3]; linkReferential over the merged {src,dst,via} (validate.js:351-356); violations() refuses a straight duplicate [M-run G3]; the sweep leaves swept bends listed in groups (D42) [M-run G2 T4, T5] | a set with the prior via, or a whole-link put when via is introduced; swept waypoints re-put [M-run G3] | the originator is REST or CLI, with no local model; peers get the change broadcast |
| Set flow | F, cycleFlow (clear = whole put) | set flow forward/reverse/none; link --flow | PATCH / commit | — | plan() | validateMutation | yes | optimistic |
| Set control | K, toggleControl | set control; link --control | PATCH / commit | — | plan() | validateMutation | yes | optimistic |
| Set closed | toggleClosed (needs at least 1 via) | **CORRECTED:** --closed at creation only; not settable. The 2-via minimum applies only to the dst-less ring form (`ring = !dst && ctx.flags.closed`, verbs.mjs:1899, 1905); with a named dst, any via count including none is accepted and closed is set, so the CLI can write a closed straight link (:1924-1925) [S; CLI not run] (was: "--closed at creation only (needs at least 2 via)") | PATCH / commit (a straight closed link is accepted) | — | plan() | validateMutation | yes | optimistic |
| Rename / set name | node, waypoint and zone only (input.js:1504-1506) | rename refuses link and waypoint; `set name` accepts all five | PATCH (no waypoints) | — | plan() | validateMutation | yes | optimistic |
| Retype: set node.type (G3) | fast-replace: a plain click, no drag, on a node while holding a hand of a different type; the gate excludes hand 'waypoint', chained clicks and modifier keys (input.js:257-266); commits commands.retypeNode, label 'retype' (commands.js:218-221) | `set <node> type <slug>` with NO vocabulary check (verbs.mjs:347; patch :2551), label 'set type', while `add`/`place` refuse slugs outside NODE_TYPES (verbs.mjs:1124, 1669-1670) (D46); `commit --ops` | PATCH /nodes/:id, label 'move node' (rest.js:1094-1099) (D48); /commit | none | plan() planSet (txn.mjs:388-398). No derived pass: the plan is the single op in every case, and all links survive [M-run G3] | FIELDS.node.type is a slug regex only (validate.js:180); no referential step for kind node (validate.js:351-362); no violations() rule reads type. A 3-link router → server is accepted, the state DECISIONS.md:240 rules refused [M-run G3] | a set restoring the prior type [M-run G3] | optimistic; renderer.update swaps the glyph href and refits the viewBox in place (renderer.js:380-389); the run-mode fold rereads towers every TICK_MS (movers.js:111, 128-133) [M-read], so tower behaviour flips retroactively (D45) |
| Set shape (framed) (G3) | `s`, reshapeNodes (keymap.js:90; input.js:1387-1388; commands.js:163-168): absent → 'square', square → 'circle'; never writes absent | `set <node> shape circle\|square` (verbs.mjs:348); `add --shape` (:1679-1681); no word clears it | PATCH /nodes ('move node'); /commit | none | plan() planSet; no derived pass [M-run G3] | SHAPES only (validate.js:181) | a whole-node put when shape is introduced, otherwise a set [M-run G3] | optimistic; swaps the frame def or rx in place (renderer.js:391-398) |
| Set content (content) (G3) | setContentValue rewrites one region's value as a whole-array set (commands.js:151-159), from labeledit.js:167 (W6 run-mode input); no gesture adds or removes regions (content comes from the text tool or a clone) | `region` appends and requires span (verbs.mjs:2567-2611; refusal :2600-2601) (D47); `textsize` (:2137, patch :2169); `panel --content` at creation (:1956); no verb clears content | PATCH /nodes ('move node'); /commit | none | plan() planSet; no derived pass [M-run G3] | the region schema (validate.js:115-141); does not check that regions fit the span, so content on a 1x1 node is accepted [M-run G3] | a whole-node put when introduced, otherwise a set [M-run G3] | optimistic; a full node re-render on a content-signature change (renderer.js:380) |
| Move / resize | live model.set every frame, rewound then committed; nudge coalesces over 600ms | move node or waypoint (zones refused) | PATCH (no waypoints; label always 'move') | — | plan() | validateMutation + occupancy violations() | yes | live preview writes; app/ is not scanned by scan-writers (tools/scan-writers.mjs:48) |
| Delete node | deleteSelection projects the link and group cascade and sends `del link…, del node` (commands.js:51-124) [M-run G3] | rm (bare dels; reports the cascade by re-reading, verbs.mjs:2413-2447) | DELETE /nodes/:id, label 'delete node' (rest.js:1101-1102); /commit | groupAfterRemoval, collapseAtWaypoint | plan() planDel: links and groups (txn.mjs:420-426). Then the sweep takes the bends of the node's links, and the collapse fires at a far two-link waypoint or junction, so a Track A delete performs a routable write (G3: `del link C, del node, del link B, set link A{src:a, dst:b, via:[w]}`; W goes from ['junction'] to []). All three doors' request shapes yield the same plan [M-run G3; critic/node-del-collapse.mjs] | requested del: id format only (validate.js:322-326); cascade, sweep and collapse: violations() only [V]. Reaches D1 [M-run G3], D41 (P4) [M-run G1] and D42 (T2) [M-run G2] | one record; content round-trips exactly [M-run G3]; collection order is not restored (D43) | cascade projected; sweep and collapse arrive only through the key-filtered ack diff. Converges in the simple case [M-run G3, ack rule restated]; diverges in D44's case |
| Delete waypoint | as above | rm | /commit | groupAfterRemoval | planDel: delete terminating links; strip or delete threading links (B81); trim or dissolve holding groups (trimGroupsHolding, txn.mjs:406-418, :472). Then the sweep [M-run G2 T3], and the collapse over the deleted links' far ends [I from txn.mjs:207-213] | as above; the sweep leaves swept bends listed in groups (D42) | as above | cascade projected; sweep/collapse not |
| Delete link | deleteSelection | rm | DELETE /links | collapseAtWaypoint | plan(): then sweep, then collapse [V] | derived ops violations() only [V]; the sweep leaves swept bends listed in groups (D42) [M-run G2]; merges at two touched waypoints that share a link compose wrongly (D41) [M-run G1] | same record [V]; collection order not restored (D43) [M-run G1] | none; arrives by the key-filtered ack diff |
| Group create / steal | group key; client projects steals | group | POST /groups | groupAfterRemoval | planPut steal | violations() only | yes | projected |
| Set members (overlap) | — | — | PATCH | — | planSet (no steal) | refused by B82 violation | — | — |
| Spawn arm / disarm | run-mode pilot rule gated by onEndpoint; since = agreed clock | `draw spawn`, own gate; since = host Date.now() | /commit, any waypoint | — | plan() | shape only | yes | optimistic |
| Pin set | idle `w` | set pinned on/off | /commit | — | plan() | validateMutation | yes | optimistic |
| Pin clear on threading | local model.set only (input.js:938) | none | none | — | never applied by the server | none | none | local only; diverges |
| Clone | cloneSubgraph (browser only); drops flow and control, copies spawn | none | none | commands.cloneSubgraph (allocates against the projection) | plan() puts | validateMutation | yes | live clone drag, then commit |
| Waypoint ↔ node conversion (G3) | none in place: fast-replace requires `model.get('node', …)` and `hand !== 'waypoint'` (input.js:261); delete + stamp + redraw takes several records [I] | none in place: `set <node> type waypoint` is accepted but yields a pseudo-type with the kind unchanged; rm + add + link takes several records; `commit --ops` can replace in one record | none in place; /commit can replace | none | Replacement only, which mints a new anchor id: the cascade deletes the terminating links, and re-putting them with the same ids in the same transaction is accepted; no sweep or collapse, because W is gone from the projection [M-run G3]. Only for a waypoint that is not a via: `set via [node]` is refused [M-run G3] | kind is the id prefix (model.mjs:51; validate.js:43, :112). Refused: `set kind:node id:waypoint-…` ("invalid id for node"), `set waypoint {type}` ("unknown field waypoint.type"), `put kind:node id:waypoint-…` ("invalid id for node") [M-run G3]. Fields do not transfer: spawn and pinned have no node home, and type, shape, span and content have no waypoint home (validate.js:176-237), so an armed spawner cannot be converted [M-read G3] | replacement: one record, exact content round trip [M-run G3] | n/a |
| Undo | server round trip | undo --expect | /undo | stored inverse | txn.mjs:600-637 | none | n/a | ack applies all ops |
| Redo | server round trip | redo | /redo | record.ops | txn.mjs:639-650 | none | n/a | ack applies all ops |
| Reveal (pace) | never sends pace | commit --pace | /commit pace | txn.mjs:514-577 filter: op==='put' | plan() | — | reveal inverts; the reversal body carries no reveal | the ack path ignores reveal |
| Selection write | ws select | select | PUT selection | Model.setSelection | store.setSelection | shape only | not undoable; no version bump | the browser has no handler for the broadcast |
| Template fork | first write on `template-` | lock | lock / commit | forkTemplate | store.commit | validateDoc; violations reported | no undo record | `forked` handler re-opens |
| Whole-doc install / boot | ws create | — | create | shedRetired (boot, examples, restore; not create or templates) | install | validateDoc; violations reported, never refused; boot skips an invalid file | Log(0) | snapshot |

---

## 6. Forks register

A fork is a design decision the code or the record visibly presents: two shapes coexisting, an unanswered case, or a contradiction.

Forks are ordered so that a fork others depend on comes first. "Depends on" names the forks whose answer this one needs. "Blocks" names the forks that need this one's answer.

F40 (G1) and F41 (G3) were added by gap fills. Ids are kept stable so that every existing citation still resolves, so each new fork is placed by its dependencies rather than by number: F40 sits after F19 because it blocks F20, and F41 sits after F31 because it depends on F30 and F31. The numbering is therefore not monotone. The gap fills also added the edges F4 → F20, F17 → F40, F19 → F40, F40 → F20, F40 → F21, and F2, F16, F17, F20, F30, F31 → F41. No other fork moved. A mechanical check of the register then found six edges stated on one side only, all older than the gap fills (F1 → F3, F1 → F4, F1 → F10, F2 → F5, F10 → F26, and F17 → F19); each is now stated on both sides, with a note at the line changed. After that, every "Depends on" fork appears earlier in the register, and every edge appears in both the Depends and Blocks lines.

### Tier 0: vocabulary and ontology

**F1. What `anchor` names.** Track: seam.

Why it is a fork: four live senses share one word, and two of them run containment in opposite directions.

- [LOCKED] A referenceable point, including an identity-less cell; "means exactly one thing" (HIERARCHY.md:39-54, :70).
- A grid place that an entity OCCUPIES (LAYOUT.md:25-39, 62-64).
- The core an entity HAS, with identity (DECISIONS.md:298).
- A drawn ring, wp-anchor (geometry.mjs:137-145).

Code identifiers bind the grid sense: nearestAnchor, anchorAt, resolveAnchor, /layouts/:name/anchors, CLI `anchor`, and the violations text at invariants.mjs:303. The claimed scan-writers enforcement is absent. HANDOVER.md:42-46 says anchor "has no identifiers", which is true of the core sense only.

Options visible:

- rename the grid sense (slot, cell, position, place);
- keep anchor for grid and name the core differently;
- amend the HIERARCHY canon to match the ontology;
- keep or drop identity-less free anchors (kernel/engine.mjs:21-25; model.mjs:171-176).

Depends on: none. Blocks: F3, F4, F5, F10, F11, F14, F16. (F3, F4 and F10 added in this revision: each already listed F1 under "Depends on".)

**F2. What `type` is, and where the type vocabulary is closed.** Track: A.

Why it is a fork:

- The validator is open (validate.js:180, since 67d229d). The record says it is closed (DECISIONS.md:287; HANDOVER.md:17,89).
- The closed edge lists disagree (palette.js:14 vs verbs.mjs:31), and only the CLI list is test-pinned.
- One field feeds glyph, behaviour (TOWERS), name prefix, sentinels ('text' vs 'host') and the ASCII letter.
- The ruling says a type is a composition (DECISIONS.md:267). Composition names are spelled 'load-balancer' while code uses 'loadbalancer' [M-run R4: 0 towers].
- 'waypoint' is accepted as a node.type [M-run R5]. It is also used as an authoring pseudo-type, although B146 ruled a waypoint is not a node type.
- The CLI's own verbs disagree: create is closed (verbs.mjs:1124, 1669) and retype through `set type` is open (:347), so 'waypoint', 'load-balancer' and 'text' are reachable by retype (D46) [M-read G3; server acceptance M-run].

Options visible:

- one composition registry read by validator, palette, CLI, renderers and engine;
- close the vocabulary at the validator from one registry;
- stay open with a fallback composition;
- type = glyph only, with behaviour and permission elsewhere;
- content-bearing nodes get their own composition rather than a sentinel;
- retire the 'waypoint' pseudo-type branches, or make 'waypoint' the name of the routable-only composition.

Depends on: none. Blocks: F3, F5, F11, F13, F16, F28, F30, F41. (F5 added in this revision: F5 already listed F2 under "Depends on".)

**F3. Which node features are intrinsic and which are packs: name, frame, glyph, reachability, and naming at the doors.** Track: A / seam.

Why it is a fork:

- The ruling says glyph, name, content, span and shape are things SOME nodes have, and names `named` and `framed` packs (DECISIONS.md:265, 293, 299).
- Code requires name on all five kinds, per director ruling B187 (validate.js:307-312; BACKLOG B187), and requires type on nodes. The frame is universal on nodes and impossible on waypoints.
- The core already includes reachability (DECISIONS.md:228,298), yet routable supplies the variants (:234,268). What a composition without routable permits is unanswered.
- Name identity versus label: resolveId refuses an ambiguous name (model.mjs:236-238), but there is no uniqueness invariant.
- Names are minted three ways, and a split mints duplicates [M-run R1 P2, R3].
- The rename/set matrix disagrees per door and kind:
  - the browser cannot rename a link or group (input.js:1504-1506);
  - CLI rename refuses link and waypoint with a pre-B187 reason (verbs.mjs:2112-2113), while `set name` accepts all five (:344-367);
  - REST has no waypoint collection (rest.js:15).

Options visible:

- name as core (B187), or `named` as a pack;
- name as an optional label, a required unique handle, or generated from the id unless authored;
- mint names at the server, against a projection, or for display only;
- frame intrinsic to the node kind, or `framed` as a pack with one emission route;
- every linkable composition includes routable, or reachability without routable permits nothing (or endpoint only);
- one rename surface per kind at every door.

Depends on: F1, F2. Blocks: F5, F16, F17, F29, F34.

**F4. Containers and kernel-only element kinds in the ontology.** Track: A / B.

Why it is a fork:

- The ontology covers anchor, pack, composition, node and waypoint only (DECISIONS.md:296-302).
- A zone has a position but is not reachable; a group has neither (validate.js:241-242, 252-265).
- The record keeps a container-edge handle [OPEN] (ATOMICS.md:80-90), parallel ports [LOCKED] (:106-115) and a hub principle (:113), plus port and junction anchors "no schema can yet name" (HIERARCHY.md:51-54).
- An [OPEN] shared frame substrate is proposed for node, zone and group (HIERARCHY.md:146-147).
- The kernel's port() and junction() elements have no producer (geometry.mjs:537-538). They are called DECLARED design (tests/span.test.js:376-385) and "drawv1 residue" (ATOMICS.md:50,132).
- The [LOCKED] crossing pad and tunnel-gap (ATOMICS.md:61-65) have no renderer.
- The mechanism realizers are archive-only.
- Group membership is a stored id list that derived writes must maintain, and the orphan sweep does not (D42) [M-run G2]. Whether a container holds ids that a Track B write must keep true is part of what the ontology leaves open.

Options visible:

- containers stay outside the anchor model;
- containers or their hulls become anchors with a routable-like pack;
- ports as child anchors;
- keep, delete, or fold into a pack the port and junction kinds;
- one appearance substrate for all five kinds.

Depends on: F1. Blocks: F11, F13, F20, F34.

**F5. The identifier one-way door.** Track: seam.

Why it is a fork:

- Step 3 is irreversible and widens via (DECISIONS.md:201-204).
- `waypoint-` is in the id grammar (validate.js:43; API.md:236), in kindOf (model.mjs:49-51) and in every stored document.
- `node-` is "probably CORRECT", while identifiers for anchor, pack and composition are "deliberately not settled" (HANDOVER.md:39-46).
- X1's revival trigger ("any out-of-repo or third-party consumer of /api/v1 -- the next change then goes to /api/v2", COMMIT-DELIVERY.md:565) is absent from HANDOVER.md:310's restatement.
- The /connect/v1 agent door exists (API.md:357-367).
- Migrations reach documents only (F23).
- No door converts an entity between the waypoint and node kinds in place, because kind is the id prefix (model.mjs:51) [M-run G3]. Step 3 is described as a collapse of the kind across documents, "migrate 26 live diagrams" (DECISIONS.md:193-197, 201-204), and the identifiers are held back deliberately (:310-312). So what the missing operation blocks is the per-entity, id-preserving conversion ("make this terminus a router"), not the retirement itself; after step 3 that conversion becomes a retype, which is F41 [M-read G3; the reading is I]. This fork covers the prefix migration only.

Options visible:

- migrate `waypoint-` to `node-` (transform once);
- keep `waypoint-` as a composition-specific prefix;
- treat a grammar change as a v2 surface under X1's trigger.

Depends on: F1, F2, F3. Blocks: F11, F23.

### Tier 1: Track B topology

**F6. Incidence: which links "touch" an anchor.** Track: B.

Why it is a fork:

- The export passes terminating links only (kernel/engine.mjs:73-76, stated in a comment). The canvas passes any role (renderer.js:336). Their output diverges on a valid document [M-run R2].
- Collapse counts any role (txn.mjs:216). The CLI counts any role (verbs.mjs:1589). Spawners take the first terminating link (spawners.mjs:35). REST neighbours include the ends of threading links (rest.js:88-90).
- The termination predicate is restated at 7 or more sites. The threading predicate is unnamed.
- A link that only threads a junction blocks a later collapse there, because the collapse counts links of any role (txn.mjs:216) but merges only terminations (invariants.mjs:155-158) [M-run G3] (F19).

Options visible:

- terminating-only;
- any role;
- typed incidence, where each link reports its role and each consumer filters.

Depends on: none. Blocks: F7, F8, F9, F27, F28.

**F7. Pass-through: derived role or stored rewrite, and what an undeclared two-termination waypoint is.** Track: B / seam.

Why it is a fork: three records give three answers for one drawing.

- It is a bend (ATOMICS.md:281 [S]; HANDOVER.md:107; tests/validate.test.js:730 comment).
- It is an endpoint (waypointRoles; tests/validate.test.js:710 asserts it) [M-run].
- The collapse merges it (invariants.mjs:176-191) [M-run], but only on removal (txn.mjs:199-213 [S]). The stored form therefore depends on history [M-run R7, R1 P7].

Further evidence:

- DECISIONS.md:233 says deleting a link "makes it a bend with nothing reconfigured"; the collapse does reconfigure the document.
- "bend" names both a via entry and the derived empty role.
- The twin test never drives an undeclared or one-declared pair (tests/validate.test.js:874-900, 937-949 per R2).
- A declared + undeclared pair derives 'endpoint', which H15.5 inheritance would change.

Options visible:

- derived role only (keep two links and derive a bend);
- stored rewrite at every door on every transition;
- today's hybrid;
- undeclared counts as agreeing everywhere, or as a terminus everywhere;
- collapse eligibility and role derivation as separate questions.

Depends on: F6. Blocks: F8, F9, F16, F18, F19, F24, F27, F28.

**F8. A link ending at another link's bend, and two links threading one waypoint.** Track: B.

Why it is a fork:

- ATOMICS.md:141 [S] and invariants.mjs:59-68 [S] say the case "cannot arise" because landing on a bend splits it.
- Only commitRoute splits [V]. chainHop and chainThroughNode (input.js:1420-1442), CLI link, REST /links and /commit, and add/place --link never split.
- plan() accepts a link ending at a bend unsplit, and the waypoint derives ['endpoint'] [M-run R1 P13b, R3].
- The browser's `w` may thread an existing waypoint (input.js:919-939). splitsFor considers only the new link's ends (:1000-1004), so it returns [] [M-run R3]. This produces a crossing, which referential refuses only for the same pair (referential.mjs:127-147).
- The T shape arms in the browser but the CLI refuses it (F28).

Options visible:

- the planner derives the split at every door;
- refuse termination at a bend at the validator;
- admit thread + termination as a named role (tap / T-bend);
- for a crossing: name it, refuse it, or split it into a junction.

Depends on: F6, F7. Blocks: F18, F27, F28.

**F9. What a run is; whether a multi-link path exists.** Track: B.

Why it is a fork:

- A run is ruled derived, never stored, and fragmentable (ATOMICS.md:312-322; BOARD.md:834-841). H15.5 is TODO (BOARD.md:832).
- The H15 exit is "declares flow once on a path and sees it end to end" (BOARD.md:847). Survey Q3 wants a path derived across viewers (untracked).
- No code walks links (§3.4).
- Within one link, via is the run. Propagation therefore matters only across link boundaries, and those are exactly what the collapse removes, but only on removal (F7).
- B232 says an undeclared link "cannot make a path through by itself".

Options visible:

- maximal chains through derived bends, derived on read;
- run = inside one link's via, forbidding multi-link pass-throughs;
- a derived run index maintained like incidence;
- a named unit over links.

Depends on: F6, F7. Blocks: F10, F12, F25, F26, F27, F36.

**F10. Naming the connection nouns.** Track: B.

Why it is a fork:

- The director asks for wire, link, path and flow to be considered. Every candidate already holds a narrower meaning (§7):
  - path is one link's coordinates [LOCKED];
  - route is one link's anchors, plus seven other senses;
  - flow is a boolean;
  - wire means transport, is a retired union, has a planned ban, and in prose and help text is a synonym for a drawn link (§1.1 WIRE, corrected);
  - run has four senses.
- segment and hop each name both a geometric piece and a whole link.
- The 2026-08-19 taxonomy froze route and path (HIERARCHY.md:37-47).

Options visible:

- widen `path` to a multi-link derivation;
- adopt prism's `route` (src, hops, dst) as a declaration;
- `flow` for the declared src:dst pair and `path` for its derivation;
- reclaim `wire`/`net` for the connected set and rename the transport uses;
- keep all four narrow and mint a new noun;
- link as the unit, with segment and hop reserved for geometry.

Depends on: F1, F9. Blocks: F26, F36. (F26 added in this revision: F26 already listed F10 under "Depends on".)

**F11. Admitted route references and the via domain.** Track: B.

Why it is a fork:

- Five sites admit five sets (§4.1).
- The CLI cannot reference an existing waypoint as a via.
- Step 3 widens via to "any node holding the capability" (DECISIONS.md:204), while a router "never bend[s]" (:239).
- In prism, routes bend at node centres (L3Resolver.js:210-229). BEND_R = node radius "as in prism" (ATOMICS.md:55).
- A multi-cell node always attaches at its origin cell centre.

Options visible:

- one anchor predicate shared by validator, model and kernel;
- via restricted to compositions that permit a bend;
- the kernel keeps a broader schema than the document (today);
- CLI via as cells minted on write, or as references.

Depends on: F1, F2, F4, F5. Blocks: F16.

**F12. `closed`: render-only flag or topology.** Track: B.

Why it is a fork:

- The validator and CLI say "render-only" (validate.js:244; verbs.mjs:1892).
- Five rules treat a ring as having no ends. The sweep and straightCapacity ignore it [M-run R1 P3, P5].
- The closure rule lives only at the edges:
  - the browser needs at least 1 via (input.js:786-790);
  - **CORRECTED:** the CLI needs at least 2 only for its dst-less ring form (`ring = !dst && ctx.flags.closed`, verbs.mjs:1899, 1905); with a named dst, `draw link a b --closed` sets closed with no via check, so the CLI can also write a closed straight link (:1924-1925) [S; CLI not run] (was: "the CLI needs at least 2 (verbs.mjs:1905)");
  - the server accepts a closed straight link.
- The REST path response omits closed (rest.js:663).

Options visible:

- a link attribute (today);
- a run whose ends coincide;
- a ring entity;
- a server rule, or a pure render flag with no rule.

Depends on: F9. Blocks: none.

**F13. Parallel links: what distinguishes them, and where capacity lives.** Track: B.

Why it is a fork:

- Straight capacity is pair-only; it ignores plane, direction and closed [M-run R1 P5]. duplicateThroughBend ignores plane and flow [M-run P13]. Yet the role matrix counts plane and direction differences (ATOMICS.md:308-310).
- Capacity is a function "to become per-endpoint-kind" (invariants.mjs:24-42).
- B81 and B126 give a director direction for runtime-configurable per-kind capacity (BACKLOG:143,188). DECISIONS.md:247-249 and :279 say per-type declared and packs stateless.
- The editor rules differ from each other (input.js:229-249; commands.js:302).
- [LOCKED] ports allow 2 per face (ATOMICS.md:106-115). H10.7/B127 is OPEN.

Options visible:

- pair-only;
- pair + plane;
- pair + plane + direction;
- per-endpoint-kind capacity, as a code constant, runtime config, or type declaration.

Depends on: F2, F4. Blocks: F16.

**F14. Occupancy of multi-cell footprints.** Track: B.

Why it is a fork:

- The server checks anchor points only. The client index checks every covered cell. The Model scan checks anchors only. There are five implementations [M-run R1 P8].

Options visible:

- anchor-only;
- footprint cells;
- anchor for waypoints, footprint for spanned nodes.

Depends on: F1. Blocks: none.

**F15. Orthogonal routing: ruled in principle, emitted as polylines, never checked.** Track: B.

Why it is a fork:

- HIERARCHY's principles and lineage assume orthogonal routing.
- GRC `ortho` (grc.mjs:88-91) has no production caller.
- A diagonal straight link is emitted [M-run R2].
- The router is "hand-routed for now" (router.mjs:1-4).

Options visible:

- advisory ortho;
- enforce at the validator or planner;
- an auto-router filling the same via list.

Depends on: none. Blocks: none.

**F16. Roles derived only for waypoints; the permission table versus multi-link nodes.** Track: seam.

Why it is a fork:

- The ruling says roles are what the graph makes of ANY anchor, with permission per type (DECISIONS.md:229-242). Code derives roles and collapses for waypoints only (kernel/engine.mjs:66-67; renderer.js:309; **CORRECTED:** txn.mjs:212, the collapse's waypoint-only candidate gate [S] (was: "txn.mjs:231", which is the pair pick)). A node with three terminations gets no junction.
- The table would refuse a second link to a server (DECISIONS.md:240,253). [LOCKED] parallel ports and B72/B80 build many links per node. Whether a second link is a refused variant depends on F7.
- Enforcement is placed "in the validator" (DECISIONS.md:251-253), while derived ops skip validateMutation (F20).
- This fork's record evidence is creation-phrased ("a second link cannot be DRAWN to a server node", DECISIONS.md:253). A retype, which changes the node side while the links stay, is accepted today with no check [M-run G3]; that case is F41, not an option of this fork.

Options visible:

- derive roles for every anchor and let permission decide;
- keep the derivation kind-gated until waypoint folds into node;
- refuse (ruled), or change the table if legitimate (the ruled escape).

Depends on: F1, F2, F3, F7, F11, F13. Blocks: F20, F28, F41.

### Tier 2: writes

**F17. How a pack or rule contributes a WRITE.** Track: seam.

Why it is a fork: the record marks this open, and the code already contains both shapes.

- The open questions are what a pack returns (ops, a document, or a request), who applies it, where validation happens, how writing packs are ordered, and how the result reaches undo (HANDOVER.md:138-205, 2026-09-24).
- The rulings: routable "owns the write" and it is "still not designed" (DECISIONS.md:217-218, 255, 259-260). "A rule may not write" (engine/rules.mjs:32-35, ruled 2026-09-01). W7 is an intent-op precedent (WRITES.md:248-289).
- Code shapes that already exist:
  - pure builders applied by the planner: collapseAtWaypoint, groupAfterRemoval, resolveAnchor;
  - pure builders applied by the client: splitAtBend feeding routeLink;
  - run-mode rules that commit commands: toggleSpawn, createEntity (input.js:606-607, 642-644);
  - one unapplied local write: the pin clear.
- The B181 flood's write path was the spawn toggle, and its trigger was never identified (R4).
- A further open question is how the writes of one derived pass compose, and whether a write re-enters later passes. The collapse computes every merge against one unadvanced projection and applies them together, and two merges that share a link compose wrongly (F40; D41) [M-run G1].

Options visible:

- a pack returns ops and the planner applies them (propose);
- a pack applies its own write;
- a write as an intent op resolved in planOne;
- packs stay read-only.

Depends on: F3. Blocks: F18, F19, F20, F22, F24, F32, F39, F40, F41.

**F18. Where each routable write is computed; door parity.** Track: seam.

Why it is a fork:

- The split is browser-only and client-proposed. The collapse is planner-only and derived [V].
- D12: the server computes cascades (TRANSACTIONS.md:344). D16: the planner is server-only (:393). The collapse is "every door" (ATOMICS.md:166-167). REST and CLI write directly (ATOMICS.md:222-223).
- H15.2 proposes shipping collapseAtWaypoint to the client (BOARD.md:812). B221 is open.

Options visible:

- the planner derives the split as it derives the collapse;
- the client proposes and the planner validates (today's split);
- a shared pure proposer imported by both sides.

Depends on: F7, F8, F17. Blocks: F19, F21, F22.

**F19. What triggers the collapse: an event (a link del op) or the resulting state.** Track: seam.

Why it is a fork:

- The scope is "ON LOSING A LINK". The planner reads `del link` ops with `op.entity`, falling back to `model.get` (the pre-state) (txn.mjs:199-213 [S]).
- Creation keeps a two-link terminus; deletion rewrites it.
- A replug away from a junction triggers nothing.
- A split's own del X + put X counts as a loss. It collapsed an unrelated authored terminus [M-run R3] (D2).
- The trigger set is fixed once (txn.mjs:207-213). Merge dels are not triggers, and under valid merges they need not be, because a valid merge cannot create a new candidate [I from read; sampled 0 on valid results, G1]. `touched` always reads the pre-transaction link, because no planner del carries `entity` (:210) [M-read G1].
- A link that only threads a junction blocks a later collapse there. Junction W with A, B, C terminating, delete C: A and B merge. The same W also threaded by L, delete C: one op, no merge [M-run G3]. The collapse counts links of any role (txn.mjs:216) but merges only terminations (invariants.mjs:155-158), so a `set via` changes what a later, unrelated delete does. Whether that is a defect is NOT-CLAIMED.
- A `set via` re-route reaches the sweep but never the collapse, because `touched` reads only `del link` ops [M-run G3].

Options visible:

- state-triggered;
- triggered only on genuine loss (distinguish del + re-put; include replug);
- no automatic collapse, deriving the bend role instead.

Depends on: F7, F17, F18. Blocks: F20, F21, F40. (F17 added in this revision: F17 already listed F19 under "Blocks", and F19 reached F17 through F18.)

**F40. How derived writes compose within one plan().** Track: seam. (Added by G1; placed here because it blocks F20.)

Why it is a fork:

- Two shapes coexist in one function. Requested ops advance the projection per op (txn.mjs:88-94, justified at :296-306). The sweep and the collapse compute all their writes against one projection and apply them once (:161-177, :214-262) [M-read G1; S].
- The sweep's shape is safe only because its writes are independent. The collapse's writes are not (D41) [M-run G1].
- The record states no composition rule. ATOMICS.md:159-167 and the comments at txn.mjs:179-205 each describe one waypoint.

Options visible:

- (a) one pass over a projection that is not advanced (today);
- (b) advance the projection after each merge, the planner's own per-op shape (:91). On P1, P2 and P3 it gives one link, A x→y via [w1, w2]; on P8 it keeps C [M-run G1, with a scratch loop calling the repo's collapseAtWaypoint; the loop is G1's code, not repo code]. It produces results validateDoc refuses where (a) does not: 12 in chain seed 1, duplicate-through-bend (D1). Today's corruption hides some D1 outcomes;
- (c) iterate to a fixpoint, feeding merge dels back into `touched`. No re-trigger was observed on valid results, so (c) matched (b) in the sampled spaces. They could differ only after a D1 self-conflict merge, which is unmeasured.

A fact about one partial guard, not a recommendation: making applyOps throw on a set or del whose id is gone (the principle stated at ops.mjs:38-41) would catch forms (a) and (c) only. In chain seed 1, 868 of the 1603 connectivity-breaking transactions had no op targeting a missing id [M-run G1].

Depends on: F17, F19. Blocks: F20, F21.

**F20. Validation depth of derived writes, undo/redo, and where permission is enforced.** Track: seam.

Why it is a fork:

- Requested ops get validateMutation, including linkReferential. Derived ops get violations() only [V]. The referential refusals are deliberately outside violations() (referential.mjs:23-29).
- A collapse commits states that validateDoc refuses [M-run R1 P14/P15, R3] (D1).
- undo and redo apply stored ops unvalidated (txn.mjs:600-650). Install reports violations but never refuses (store.js:663-667).
- LAYOUT.md:76-78 splits validation between per-entity and document consistency. DECISIONS.md:251-253 and :260 place permission "in the validator" and make it gate the collapse.
- The TRANSACTIONS contract omits the sweep and collapse (§8).
- The orphan sweep is a second derived write that commits validateDoc-invalid states, through groupReferential rather than linkReferential (D42) [M-run G2]. No permission table and no collapse is involved.
- Two shapes coexist for one maintenance duty. planDel trims containers inside the per-op closure trimGroupsHolding (txn.mjs:406-418). The sweep runs on the transaction result and has no such closure (txn.mjs:161-176).
- groupReferential (referential.mjs:149-156) is outside violations() in the same way the link refusals are, so the option "move the link refusals into violations()" names only one of the two bypassed rule sets. B85 in violations() counts listed members, so the backstop cannot see a dangling member (invariants.mjs:249-258) [M-run G2].
- The option "prove each derivation invariant-preserving and guard it by test" has no multi-merge test today: by text scan, each collapse test in tests/txn.test.js (:562, :583, :634, :670, :758) names one waypoint, and violations() cannot see D41's forms (a)–(d) [M-run G1]. The GR5 differential corpus draws groups from nodes only (tests/diff-plan.test.js:40-44), and the sweep tests have no group case (tests/txn.test.js:418-560) [M-read G2].
- A permission check placed beside linkReferential would never see a retype, because validateMutation runs referential checks only for link and group kinds (validate.js:351-362), and violations() refuses only an INTRODUCED violation, so a loaded document already in a forbidden state would be tolerated (txn.mjs:276-287) [M-read G3] (F41).

Options visible:

- run validateMutation/linkReferential over derived ops;
- move the link refusals into violations();
- prove each derivation invariant-preserving and guard it by test;
- validate inverses on undo;
- permission in a routable pack consulted by the planner, in the validator, or in violations().

Depends on: F4, F16, F17, F19, F40. The F4 edge is direct because D42 depends only on the sweep, which is ruled (B162/B216) and not a fork, and on group membership being a stored id list (F4); it does not depend on F16 or F19, which govern the permission and collapse halves. F4 already reached F20 transitively (F4 → F13 → F16 → F20). Blocks: F21, F23, F41.

**F21. Client projection of derived writes, and reconciliation.** Track: seam.

Why it is a fork:

- The client mirrors the cascade and the steal. It receives the sweep and the collapse only through the ack diff (sync.js:409-416 [S]). It computes the split alone. It keeps the pin clear local.
- The ack diff keys by op:kind:id. It drops a server op whose key matches a client-sent op and does not resync [M-run R3: converged false] (D2, D3).
- H15.2 is open.
- Sharing collapseAtWaypoint shares the pairwise rule only. The composition loop is inline in plan() (txn.mjs:207-262) and is not exported [M-read G1]. Whether a client would reproduce D41 depends on it re-implementing that loop [I].
- A Track A delete reaches the same key filter: one selection that deletes a node and a bend of the link the collapse keeps diverges at the originator (D44) [M-run G3, ack rule restated].
- The browser learns of the sweep only through the ack (sync.js:393-413); it has no sweep of its own (grep of app/src and cli for "orphan|sweep" finds only comments and the unrelated sweepTokens) [M-read G2].

Options visible:

- shared pure derivations imported by both sides;
- a server-authoritative echo of the whole planned list;
- no client projection of derived passes;
- reconcile by value rather than by key.

Depends on: F18, F19, F20, F40. Blocks: none.

**F22. `pinned`: stored intent that a write rule must clear.** Track: B / seam.

Why it is a fork:

- Threading is supposed to clear the pin (validate.js:216-217; B162). Only the browser does it, and only locally (input.js:938) [M-run R1 P1].
- The B162 disposition concedes that a stale pin can remain. The sweep exempts pinned waypoints (txn.mjs:166).
- Threading a pinned waypoint through `set via` or /commit leaves pinned:true on the server; no door clears it there (D5) [M-run G3].

Options visible:

- clear the pin in plan();
- derive "placed deliberately" from the absence of references;
- make the pin permanent intent.

Depends on: F17, F18. Blocks: none.

**F23. Load migrations versus stored inverses.** Track: seam.

Why it is a fork:

- shedRetired runs at boot, for examples and on restore; not on create and not for templates (store.js:122-197, 821-832).
- Log records persist pre-migration shapes (docfile.mjs:19-35), and undo applies them unvalidated (F20).
- It contradicts the "transform once, then delete the transform" target (user memory).
- shedRetired also short-circuits (D26 [S]).

Options visible:

- migrate the log records too;
- truncate the log on migration;
- validate inverses on undo.

Depends on: F5, F20. Blocks: none.

**F24. kernel/model independence versus twin rules.** Track: seam.

Why it is a fork:

- The layering rule [V] is why the rules are restated (§4.5). scan-twins.mjs:49-62 names a routable pack as their eventual single home.
- engine/ already imports both kernel/ and model/, contradicting three sovereignty claims (§8).

Options visible:

- a shared module both import;
- twins held by tests;
- one owner (a routable pack) for role derivation and the collapse.

Depends on: F7, F17. Blocks: none.

### Tier 3: behaviour at the seam

**F25. What direction governs motion and presentation.** Track: seam.

Why it is a fork:

- Declared flow is ruled the only direction a rule may read (ATOMICS.md:260).
- Spawners orient from the armed end and never read flow (spawners.mjs:42 [S]). Movers run against a declaration when armed at the flow head [M-run R1, R4 (6 combinations), R7].
- The reveal trace follows stored order (reveal.mjs:37-39).
- shape.mjs:44-47 derives direction from the armed end (H12.5, BOARD.md:613). No ruling relates the two (R6 grep).

Options visible:

- movers follow a declared flow;
- the armed end decides (today);
- arming is refused where it would oppose a declaration;
- the trace follows a declared flow, or is exempt as presentation.

Depends on: F9. Blocks: F27.

**F26. Plane versus packets, and which "control plane".** Track: seam.

Why it is a fork:

- `control` means "carries no data-plane packets" (validate.js:248-249; ATOMICS.md:290), yet spawners emit on control links [M-run R1, R2, R7].
- The phrase has competing meanings:
  - "control plane computed server-side, browser a stateless data plane" (ATOMICS.md:348-349);
  - against that, "a consequence is never sent" (VISION.md:80-81) and every peer derives (rules.mjs:27-30); the server computes no simulation (R4);
  - the policy control-plane graph (DECISIONS.md:283);
  - the lock "control plane" (app.js:3-5).

Options visible:

- the engine skips control links;
- arming is refused on control links;
- plane stays appearance + role only;
- a server-computed control plane, or every peer derives.

Depends on: F9, F10. Blocks: F27, F36, F37.

**F27. Mover travel unit, junction forwarding, and which link a spawner uses.** Track: seam.

Why it is a fork:

- Movers travel one link and stop at its far end. A split shortens the route from 472.45 to 240 px [M-run R4 d].
- Junction forwarding is designed, unbuilt, and "owed before anything in engine/ reads it" (ATOMICS.md:169-171, 340-349). BOARD.md:849 excludes it from H15.
- At a multi-link waypoint the first link in linksAt order wins, and index order differs from scan order after a put [M-run R4 c] (D11). relations.mjs:77 claims the index is order-insensitive.
- `routable` (topology, permission, write) and the "routing capability" (forwarding, ATOMICS.md:353-354) are not reconciled.

Options visible:

- per-link travel;
- per-run travel;
- choose at a junction by packet knowledge;
- first-found, or a declared/derived choice;
- one routable pack covering forwarding, or separate topology and forwarding packs.

Depends on: F6, F7, F8, F9, F25, F26. Blocks: F28.

**F28. Arming eligibility; roles as drawing states versus predicate inputs.** Track: seam.

Why it is a fork: four gates decide what may be armed (§4.4 #1–4).

- A junction or pass-through is refused in the browser, but emits if armed via the CLI or REST.
- A T arms in the browser, but the CLI refuses it [M-run R4 b, b2].
- Comments claim a junction is armable (situation.mjs:123-124; geometry.mjs:475-476; ATOMICS.md:175).
- B211 made junction supersede endpoint for DRAWING, and the same role set feeds the predicate (geometry.mjs:314-316 vs :468-479).

Options visible:

- one predicate owned with the role derivation;
- permission per type decides;
- door-specific gates;
- separate the drawing resolution from the role set;
- forbid arming a junction, or allow it with a declared outlet;
- key arming on the termination count.

Depends on: F2, F6, F7, F8, F16, F27. Blocks: F29.

**F29. Where `spawn` attaches.** Track: seam.

Why it is a fork:

- spawn is stored on the waypoint kind only. It is meaningful only while the waypoint is a non-ring terminus, and that role is derived: it changes under collapse, clone and threading.
- A collapse leaves an inert spawn on a via [M-run R1 P6, R4 e] (D12). A clone copies spawn onto any role.
- The ruling calls per-instance pack configuration a future class that "none is proposed" for (DECISIONS.md:186-191, 283). spawn already is one.

Options visible:

- keep it on the anchor and validate against the derived role;
- attach it to (link, end);
- a pack with per-instance config;
- document-level intent referencing an anchor.

Depends on: F3, F28. Blocks: F30, F37.

### Tier 4: Track A

**F30. How behaviour attaches, and where its numbers live.** Track: A.

Why it is a fork:

- Three attachment shapes exist: per-instance stored (spawn), per-type code table (TOWERS by node.type), and a per-instance action string (validate.js:135).
- The ruling says PER TYPE, not per instance (DECISIONS.md:250-255).
- kinds.mjs:8-16 moves numbers into code, yet spawn stores interval and speed per document (commands.js:565-575). VISION.md:74 says storing a number on a shape is a failure.
- The ruling's pack families (appearance, routing; policy excluded; DECISIONS.md:278-284) do not place the per-type behaviour in engine/kinds.mjs.
- A content write grants or removes behaviour per instance, because regions can hold `action` (W5) and `input` (W6) (validate.js:136-137) [M-read G3]. A retype grants or removes per-type behaviour (D45).

Options visible:

- per-instance config;
- a per-type central table keyed by type or composition;
- host-dispatched actions;
- TOWERS contributed by a composition, a composition referencing the kinds table, or a separate registry;
- behaviour as a third pack family.

Depends on: F2, F29. Blocks: F31, F41.

**F31. How behaviours anchor to time.** Track: A.

Why it is a fork:

- spawn.since is per entity. reveal.origin is per document (server clock). Towers use the global epoch tick and have no placement instant (rules.mjs:112-122).
- The fold uses the current board, so a new tower kills retroactively [M-run R4 probe2] (D13). Whether that is intended is NOT-CLAIMED.
- The CLI stamps since from the host clock (D15).
- Retype is a second trigger for the retroactive fold, in both directions: retype away resurrects killed movers, and retype to kills movers in the past (D45) [M-run G3, engine level].

Options visible:

- a stored per-entity instant;
- a per-document instant;
- an origin-free global tick.

Depends on: F30. Blocks: F41.

**F41. Recomposition: what a type change does to an anchor's existing links and behaviour.** Track: seam. (Added by G3; placed here because it depends on F30 and F31.)

Why it is a fork:

- Retype exists at all three doors as one undoable `set` (§5 "Retype" row). It changes what an anchor permits and does while its links stay. A router with three terminating links retyped to server is accepted, which the ruled table forbids ("A compute or server glyph permits endpoint alone", DECISIONS.md:240; "a second link cannot be drawn to a server node", :253) [M-run G3].
- It silently grants or drops TOWERS behaviour, retroactively in both directions (D45).
- No F-entry and no record line after DECISIONS.md:53 addresses it. Search: `grep -i 'retyp|fast-replace|type change|set type'` over all *.md, plus `retyp|recompos` over HANDOVER, BOARD, ATOMICS, DECISIONS and the survey [M-run grep G3]. B22 and B44 mention retype only for `before` and inverses, and both are closed.
- The record constrains the answer but does not give it. DECISIONS.md:53 (2026-06-13) says "id/name/links survive" a retype; :251-253 (2026-09-22) says "A violation is REFUSED". The two are consistent only if the retype itself is refused, and the record never says so. A cascade that drops or rewrites the offending links would contradict :53 [M-read G3; the reading is I].
- The answer depends on the enforcement point (F20): validateMutation runs referential checks only for link and group kinds (validate.js:351-362), so a permission check beside linkReferential would never see a retype; violations() refuses only INTRODUCED violations (txn.mjs:276-287) [M-read G3].
- Three shapes coexist for "what this anchor is" [M-read G3]: kind by id prefix, which is immutable; node.type, settable at every door in one undoable op; and node.type = 'waypoint', a pseudo-type accepted by the validator and CLI `set` and excluded only by the browser gate (input.js:261).
- Waypoint ↔ node conversion is the same operation under anchor-as-core (DECISIONS.md:298-302). Today it is impossible in place, because kind is the id prefix (§5 "Waypoint ↔ node conversion"; F5).

Why it is not a case of F16 or F2: F16's record evidence is creation-phrased, and its options decide whether roles and permission apply to nodes, not which write is refused when the node side changes while the links stay. F2 decides what type is and where the vocabulary closes, not what happens to existing links and behaviour when type changes.

Options visible:

- refuse a retype whose composition does not permit the anchor's current roles;
- cascade: drop or rewrite the offending links, as a derived write (F17);
- tolerate, and derive an "unpermitted" state;
- allow retype only between compatible compositions;
- treat recomposition as delete + create with a new identity;
- for behaviour: anchor it to a recomposition instant, or keep the origin-free fold (F31).

Depends on: F2, F16, F17, F20, F30, F31. Blocks: none. The per-entity half of F5 (in-place waypoint ↔ node) folds into this fork after step 3 [I].

**F32. What a "rule" is.** Track: A.

Why it is a fork:

- Engine rules may not write. Run-mode input rules and planner cascades do.
- RULES.md:17-25 says the input-rules prior-art pass was settled by a physics derivation (engine/rules.mjs).
- "Two exist" sits above a DERIVATIONS table that has held one entry since 42b70e1.
- Three input-rule shapes coexist: RECOGNIZE/KEYMAP tables, situation predicates, and DOM branches. The tower rule's predicate is vacuous [S].
- The method vocabulary of RULES.md:89-98 is rejected by situation.mjs:15-21.
- The owed items at RULES.md:282-288 were derived by B163. BOARD.md:899 says F3 is owed while RULES.md:17-21 says done.

Options visible:

- a read-only level-triggered derivation;
- a situation-predicate input rule that commits a command;
- a dispatch-table row;
- a method vocabulary, or an inert value with free predicates.

Depends on: F17. Blocks: F33.

**F33. Events versus level-triggered derivation.** Track: A.

Why it is a fork:

- rules.mjs:8-17 rejects event handlers.
- Transport is ordered deltas with a from-gap check, skipped for reversals (sync.js:633-644).
- draw:action has no registry.
- Survey Q2 widens the substrate to "behaviour and events" (untracked; cited by R3 and R7). `draw event` is held (B194).

Options visible:

- derivations over document + clock;
- events as derived facts per tick;
- a handler surface.

Depends on: F32. Blocks: none.

**F34. Appearance derivation shape and resolution.** Track: A.

Why it is a fork:

- Four shapes are live (§2.3). ATOMICS.md:386-388 keeps the layer list deliberately separate from an attribute set.
- composes/priority is ruled and unbuilt [V]. The priority representation (integer vs ordered named layers) is "Not ruled" (DECISIONS.md:352-355). The router-ring-from-routable idea is a hypothesis (:370-372).
- DECISIONS.md:317 and ATOMICS.md:372 name different sole instances. BOARD.md:831 overclaims.
- DECISIONS.md:319 lists `.on-selected-path` and `.selected` as derived classes, yet :343-346 rules selection a decoration. HIERARCHY.md:124-126 is [OPEN].
- H15 excludes the pack yet carries the permission table and composes/priority (BOARD.md:849-853).

Options visible:

- extend the attribute map to every kind;
- per-state composes + priority over layers, with links folded in;
- two levels: layers, each carrying an attribute map;
- selection classes as derived appearance, or as decoration.

Depends on: F3, F4. Blocks: F35.

**F35. Who owns a look: the stylesheet or the derived attribute.** Track: A.

Why it is a fork:

- B172 says the stylesheet owns the look. B235 says the derived attribute is the one authority.
- The results diverge (D16, D27–D31).
- TOKENS and style.css hold separate literals. KERNEL_CSS is a vendored copy.

Options visible:

- derived attributes everywhere, with CSS only for session decoration;
- CSS classes minted from derived state everywhere, with the export carrying the stylesheet;
- split along the intrinsic/derived line.

Depends on: F34. Blocks: none.

**F36. A persisted src:dst pair: selection (status) or declaration.** Track: B / seam.

Why it is a fork:

- Survey Q3 (untracked) quotes the director: "a src:dst node pair may be selected and this persists as state in the control plane, so that a path can be derived across all viewers" (R6).
- doc.selection is status: no version bump, no undo (store.js:1281-1292). The browser ignores the `selection` broadcast (D25).
- Selection is ruled session state that "belongs to the grid" (DECISIONS.md:344, 375-376).
- DECISIONS.md:126 explicitly did NOT borrow prism routes, the pathfinder or tag selectors. Prism's route {src, dst, hops} (RouteFactory.js:20-31) is the nearest prior art.

Options visible:

- selection-backed status;
- a versioned, undoable declaration;
- revisit the prism route exclusion;
- derive paths with no stored route entity.

Depends on: F9, F10, F26. Blocks: F37.

**F37. Policy.** Track: A.

Why it is a fork:

- Policy is out of scope. The hypothesis is that it derives from flow pairs; it is "not designed, not ruled, not to be assumed" (DECISIONS.md:281-284).
- "The first pack to carry per-instance configuration" is named as something to avoid, while spawn already is one (F29).
- `policy` already names engine/policy.mjs.

Options visible:

- derived from declared flow pairs;
- a per-instance-config pack.

Depends on: F26, F29, F36. Blocks: none.

**F38. The story step `beat` once named.** Track: A.

Why it is a fork:

- The b188 survey moved "beat" to the wall-clock reveal (survey:78-81).
- The cursor-addressed story step is left unnamed, with naming owed (:133, 152, 203).

Options visible:

- a time-addressed reveal (built);
- a cursor-addressed story (captured, unbuilt).

Depends on: none. Blocks: none.

### Programme

**F39. Sequencing: extract a pack from built behaviour, or design the write seam first.** Track: meta.

This fork governs the order in which the others are taken, not their content.

Why it is a fork: successive dated positions pull different ways.

- DECISIONS.md:191-195: staged steps; "the order is the ruling".
- :206-211, :218: "extract, not design-first".
- :286-288: compose two packs to earn the claim.
- HANDOVER.md:185-187 (2026-09-24): the write question cannot be deferred.
- DECISIONS.md:374-376: "build the framework and the pipeline first".
- BOARD.md:853 cites AG-5, which resolves to an unrelated item.
- Constraints: GR18 says pack-derived state must reach the CLI (TRANSACTIONS.md:620; CLI.md:10-22). A5 says it must be perceivable, and two A5 gaps are deferred (HANDOVER.md:290-297, 343-357).

Options visible:

- extract from the built junction/split/collapse;
- answer the write question first;
- pipeline first, glyph decomposition later.

Depends on: F17. Blocks: none.

---

## 7. Candidate terms

This section describes; it does not recommend.

### 7.1 The director's four

**WIRE**

- **Concepts it could name:**
  - (a) the multi-link chain through pass-throughs (a run);
  - (b) the electrical net: every link connected through junctions (a connected component);
  - (c) a drawn link (a synonym of link);
  - (d) a bundle: one declared container-to-container connection realised as N lines.
- **Exists unnamed?**
  - (a) is ruled with no code (ATOMICS.md:312-322).
  - (b) is vision only (HIERARCHY.md:29, 88, 95).
  - (c) is `link`.
  - (d) exists only in the archive sim as a "mechanism relation" {from, to, style, count} with realizers (drawv2-archive/design-generators/design/sim/engine.mjs:15; realizers.mjs:1-50). kernel/engine.mjs:25-26,116 calls it a future layer.
- **What carries the word now:**
  - transport (dominant);
  - DI wiring;
  - "wiring" meaning drawing links: L/Shift+L chain/star (commands.js:285-308) and chain wiring (input.js:15);
  - "rewire" meaning replug (commands.js:213; input.js:13) [S];
  - prose for a drawn line (kernel/renderer.mjs:200, 217; ATOMICS.md:63).
- **History:**
  - A kernel union `wire` = link or path element, so GRC could iterate both (`wiresOf`). It was retired by B38 in d349ccd (2026-08-19); tombstone at grc.mjs:13-19. `git log -S wiresOf` shows 67d229d, 1c0865e, d349ccd (R7). It is still live in the archive sim grc.mjs:3,14-21.
  - HIERARCHY.md:77 plans a scanner ban that was never built.
- **Prior art:**
  - prism: a "wire protocol" with mgmt/control/data planes (drawv2-archive/arc-programme/PRISMV2-DESIGN.md:92; reference-repos/prism/sync/core/MessageRouter.js:5-32).
  - graph-server: a drawn link realised as a live websocket peer connection {host, port}, a literal wire (reference-repos/graph-server/main.js:124-137).
  - Term history before 67d229d exists only in the archive bundle. The archive README's pre-purge commit 3adcdd7 is absent from the live repo (R7).

**LINK**

- **Concepts it could name:** the stored connection entity (its current meaning); or, if a larger unit were named, the per-hop piece of that unit.
- **Exists unnamed?** No. It is the only persisted connection.
- **What carries it now:** doc.links[]; the kernel `relation`; the gesture mode; the CLI verb; the REST collection.
- **History:** B38 deleted the kernel scene `link` element so that link "means one thing again".
- **Prior art:**
  - prism LINK = a straight src/dst adjacency, kept DISTINCT from ROUTE (reference-repos/prism/model/factories/LinkFactory.js:20-31; shared/kernel/L3Resolver.js:93-110).
  - fractal link = {path: [tag, ...], opts: {close, radius, handles, gap}}, scoped to a group level (fractal/schemas/linkTest.js:19-31, 70-78; engine/nlink.js:41-46, 99-108).

**PATH**

- **Concepts it could name:**
  - (a) one link's coordinates (ruled, LOCKED);
  - (b) the end-to-end chain between two nodes;
  - (c) the link itself in UI ("close path", "selected path");
  - (d) the mover track;
  - (e) a route a mover chooses at a junction.
- **Exists unnamed?** (b) is requested (H15 exit BOARD.md:847; B147 "client->firewall->lb->server"; survey Q3). No code derives it (§3.4).
- **What carries it now:** Model.pathOf; the kernel `path` element; the SVG path; REST /links/:id/path; `.on-selected-path` (one link).
- **Prior art:**
  - fractal `path` = the tags a link visits, then their resolved vertices. That is what drawv2 calls a route (nlink.js:45, 99-108).
  - prism v1 stored a PATH entity {points} and a POINT {pos, tags} (/home/apnex/prism/model/factories/PathFactory.js:33-40; PointFactory.js:25-31).
  - The old draw reference README calls itself a "frontend UI for the `path` API system" (reference-repos/draw/README.md:3). That system was not found locally.

**FLOW**

- **Concepts it could name:**
  - (a) the declared direction on a link (its current identifier);
  - (b) the traffic that moves;
  - (c) a declared src:dst pair, the "flow pair" of the policy hypothesis and survey Q3;
  - (d) direction inherited along a run (H15.5).
- **Exists unnamed?** (b) is implemented as spawners/movers without the name, and is disjoint from (a) [M-run]. (c) has no shape anywhere. (d) is ruled and unbuilt.
- **What carries it now:** the link.flow boolean; movers.
- **Prior art:** an archive analogy of conntrack/OpenFlow flows for gesture sessions (drawv2-archive/arc-programme/INPUT-KERNEL-DESIGN.md:142, 319).

### 7.2 Other terms surfaced as unnamed or ambiguous

| Candidate term(s) | Concept it could name | Exists unnamed? Evidence | Current carrier | History / prior art |
| --- | --- | --- | --- | --- |
| route | (a) one link's anchor list (ruled); (b) a declared src + hops + dst | (b) absent | link.src/via/dst; eight senses (§1.2) | prism ROUTE {src, dst, hops[]}; hops are nodes or tag selectors {matchTags, orderBy}, resolved per compile (RouteFactory.js:20-31; L2Compiler.js:74-108; L3Resolver.js:207-240). Explicitly NOT borrowed (DECISIONS.md:126). |
| run | chain along which a declaration propagates | ruled, no code (§3.4) | four other senses | ATOMICS.md:312-322; FRAGMENT ruling |
| net | connected component through junctions | vision only | nothing | HIERARCHY.md:29, 88 (Factorio "belts/wires"), 95 |
| trace | (a) the drawn traversable geometry, the line/quad list passed around as an untyped `geo`; (b) a run | (a) yes: router.mjs:43-58; movers.mjs:74-78 | "trace" names the reveal dash animation (reveal.js) | HANDOVER.md:340 names a `draw trace` verb that does not exist (R7) |
| termination / thread; terminates(link,id) / threads(link,id) | a link ends at, or passes through, an anchor | predicates restated at 7+ and 2+ sites (§1.2) | local variables: terminations, terminal, ends | B211 |
| incidence role (src, dst, via) versus aggregate role | per-link role at a point, as distinct from the waypoint's role set | validate.js:209-212 and txn.mjs:111-114 describe a per-link "endpoint" that differs from the aggregate at 3 terminations | "role" names both | — |
| two-link terminus / pass-through / splice / joint | a waypoint where two links terminate and the pair is not collapsed | named only in a txn.mjs:203 comment; derives ['endpoint'] | none | B214 "a terminus that something else also reaches"; B217 made it buildable |
| threaded bend versus pass-through | the two operational "bend"s: a via entry versus two links meeting and agreeing | the collapse converts the second into the first (invariants.mjs:188) | "bend" | — |
| tap / T-bend / branch point | a waypoint in one link's via that terminates another | produced by every non-browser door and chainHop [M-run]; derives ['endpoint'] | none | drawv1 "tap point on a trunk" (geometry.mjs:538) |
| crossing | a waypoint in the via of two links with different pairs | "cannot arise" (invariants.mjs:59-68 [S]), yet admitted [M-run R3] | none | ATOMICS.md:61-65 [LOCKED] tunnel-gap crossing (unbuilt) |
| bundle / bus / trunk | parallel connection declared once, realised N times | archive sim only | none | sim realizers ports/hybrid/nodeAligned and `bus` (realizers.mjs:18-47); ATOMICS.md:138 "no trunk, no taps" rejects the trunk model for junctions |
| port / attachment point | where a link attaches on a node (always the origin cell centre today) | implicit in both builders (kernel/engine.mjs:44,52; model.mjs:176-178) | none | ATOMICS [LOCKED] ports; KiCad pins (HIERARCHY.md:88) |
| free anchor / cell anchor | an identity-less route reference | kernel admits; document does not | "free bend" (kernel/engine.mjs:22-25) | — |
| slot / cell / place / position / occupant | the grid-position sense of anchor | code calls it anchor | anchorAt, resolveAnchor, "one anchor holds one occupant" | LAYOUT.md uses "occupant". 1c0865e freed origin, fixedCorner, base and placement from "anchor" (2026-08-19). |
| plane | data versus control as a first-class value; plane of a terminus | named only by the samePlane predicate; stored as a `control` boolean; "mixed is data" computed ad hoc (geometry.mjs:390-392) | link.control | prism planes: mgmt/control/data (MessageRouter.js) and H/T/S (L3Kernel.js:70-90) |
| emitting / live spawner / inert spawn | spawn present AND an open link terminates there | yes; differs from stored "armed" (§4.4 #7) | "armed", "spawning" | — |
| lane / leg / track | the mover's travel unit: one link oriented away from the armed end | yes (spawners.mjs:34-43) | "path", "route" in engine prose | — |
| heading / emission direction / source end / armed end | the direction movers travel | yes, separate from flow (spawners.mjs:17-19, 42; verbs.mjs:1605 `dir`) | none | H12.5 |
| forwarding / switching | clone / round robin / route at a junction | designed and unbuilt (ATOMICS.md:340-349) | ATOMICS "routing capability" (:353-354) | — |
| flow pair / demand / intent | a persisted src:dst declaration | no shape (DECISIONS.md:283; survey Q3) | doc.selection is the nearest (status) | prism route |
| derived op / consequence / reaction / repair | planner-added ops | yes (txn.mjs:95-262) | 'cascade', 'swept', 'merges' | the ack path calls them `added` (sync.js:412) |
| re-put / lineage / id survival / successor | "the src-side piece keeps the original id" across split/collapse | decided in two places (input.js:989-996, 1027; txn.mjs:226-232); the planner cannot tell a re-put from a loss | ids | B213 round trip |
| door / door table | the set of paths a field or rule must reach | named as a failure mode (HANDOVER.md:263-270); no table exists | none | B225, B234, B237 |
| recomposition / retype | changing what an anchor is (its type, or its kind) while its identity and links stay | exists as retype (set node.type) at every door, with no permission or behaviour handling; impossible across kinds in place (F41) [M-run G3] | 'retype' (commands.js:218-221), fast-replace, 'set type' | DECISIONS.md:53 "id/name/links survive" |
| composition registry / type table | everything a type resolves to | yes (§2.2) | scattered per-type tables | engine/kinds.mjs "what a KIND means" |
| presence-gated capability / implicit pack | capability switched on by field presence | yes: content, span, spawn, pinned | none | The deleted probe text called it "branching on field presence rather than on kind" (git show 8863d77) |
| far end / opposite | the other end of a link from an entity | computed ad hoc (verbs.mjs:2709; spawners.mjs:41; verbs.mjs:1600) | none | — |
| segment / hop | the unit a run or path is made of | both overloaded (§1.2) | — | prism route.hops = nodes |
| activation instant (since / origin / epoch) | when a behaviour began | two carriers, towers have none | spawn.since, reveal.origin | — |
| incidence | every link referencing an anchor in any role | relations.mjs calls it "incidence" (:7, 42) | linksAt | — |
| panel | a node carrying content regions | three names: text box, panel, content node | isPanel | — |
| tower / turret | a node type that fires | two names | TOWERS, movers.js | H13 |
| run mode / read view / play | one surface mode | several names (situation.mjs:130; input.js:537; BOARD.md:663) | mode 'run' | — |

---

## 8. Contradictions and stale record

The record disagrees with itself, or with code, in the following places. Marks: [M-read] unless stated.

| # | Record claim | Contradicted by | Mark |
| --- | --- | --- | --- |
| C1 | "Two undeclared links are always a bend" (ATOMICS.md:281); HANDOVER.md:107; tests/validate.test.js:730 comment | waypointRoles returns ['endpoint'] (geometry.mjs:520-523); tests/validate.test.js:710 asserts it | [S] ATOMICS; [M-run] roles |
| C2 | A 3-termination waypoint is "a junction AND an endpoint" (ATOMICS.md:175); a threaded link "contributes two" (:177); the B208 docblock (geometry.mjs:311-316); "a junction can still be armed" (geometry.mjs:475-476; situation.mjs:123-124); a T "holds both roles" | Code returns ['junction'] alone (:479) and ['endpoint'] alone for a T; threading contributes 0; onEndpoint(junction) = false | [M-run] |
| C3 | "cannot arise": linking to a bend always splits (ATOMICS.md:141; invariants.mjs:59-68 crossing) | REST, CLI, commit and chainHop accept it unsplit; `w` threading produces crossings | [S] text; [M-run] R1, R3 |
| C4 | "Terminations only, and more than two of them"; two terminations is never a meet (ATOMICS.md:140-146); "A junction cannot exist with two links" (txn.mjs:182); "two terminations is the smallest meet" (geometry.mjs:329-330) | The same document's matrix (ATOMICS.md:274,284) and H15.4: two opposing, or two differing planes, make a junction | [S] :140-146 |
| C5 | Split: "Both halves get NEW ids" (ATOMICS.md:212-213; input.js:981-982) | "THE SRC HALF KEEPS THE ORIGINAL ID" (input.js:992-996, 1030-1031; B213; ATOMICS.md:160) | [M-read] |
| C6 | "split copies name" (HANDOVER.md:337) | Halves are re-minted by nextName against a namespace that cannot see the batch, so all read the same name and the original is lost | [M-run] R1 P2, R3 |
| C7 | `closed` is "(render-only)" (validate.js:244; verbs.mjs:1892) | Five rules treat it as topology (§1.2) | [M-read] |
| C8 | Names optional: "Optional, like every other name" (validate.js:201); "a waypoint does not [carry a name]" (CLI.md:216); "no name" (palette.js:189-190); "a waypoint has no name field at all" (verbs.mjs:2112-2113); "must NOT be given a name" (commands.js:467-469) | Required on all five kinds (validate.js:307-312; B187) | [M-run] R1, R5 |
| C9 | "the validator's closed type vocabulary" (DECISIONS.md:287; HANDOVER.md:17,89) | Open slug since 67d229d (validate.js:180) | [M-run] R5 |
| C10 | The capability probe "is recorded in ATOMICS" (DECISIONS.md:221) and "in DECISIONS" (ATOMICS.md:247); it "demonstrated" gating on routable | Circular; the text was deleted in 8863d77; the probe was paper-only (46f169b) | [M-read] git |
| C11 | scan-writers fails on a non-canonical `anchor`, a second polyline builder outside Model.pathOf, and any surviving `wire` (HIERARCHY.md:74-78) | No such checks (grep); kernel resolveRoute is a second polyline builder | [M-read] |
| C12 | The kernel route is `{from,via,to}` and path is `{pts,radius,close}` (HIERARCHY.md:46-47; adapt.mjs:15; kernel/engine.mjs:122); link = route + identity + closed (HIERARCHY.md:48) | Code uses src/dst and closed (B166); links also carry name, flow and control | [M-read] |
| C13 | "a waypoint belongs to at most one link (endpoint XOR via), so 0 or 1 links" (model.mjs:137-139; referential.mjs:3-5; commands.js:503-505; CLI.md:201 "waypoint exclusivity") | Sharing relaxed (B207; referential.mjs:97-123); 3 links at one waypoint measured | [M-run] |
| C14 | A junction is "more than two path directions" (referential.mjs:101-103) | Rule replaced by B211 termination counting | [M-read] |
| C15 | Sovereignty: "engine imports no spatial-kernel module" (relations.mjs:14); "model/ and engine/ ... neither imports the other" (invariants.mjs:240); engine/store.mjs keeps engine free of kernel (:12) | engine/movers.mjs:38-39, spawners.mjs:23, rules.mjs:40, situation.mjs:28-29 | [M-read] |
| C16 | The server derives spawners (spawners.mjs:14-15); "both peers load it" (model/reveal.mjs:11) | No server/ import of spawnersOf, moversAt or combatAt; only app/src/reveal.js imports reveal.mjs | [M-read] |
| C17 | The relations index "mirrors model EXACTLY (order-insensitive)" (relations.mjs:77) | spawnersOf is order-sensitive; index and scan order differ after a put | [M-run] R4 c |
| C18 | "Two exist, and they are the same construct" (rules.mjs:73-75) | DERIVATIONS has one entry, and has had since 42b70e1 | [M-read] git |
| C19 | "progress is distance along the route" (rules.mjs:94) | progress = travelled / length, a fraction (movers.mjs:157) | [M-read] |
| C20 | H15.9 "one resolution by composes and priority per state -- LINKS DONE" (BOARD.md:831) | No composes/priority resolver [V]; DECISIONS.md:317 (waypointLayers is the sole instance) vs ATOMICS.md:372 (linkAppearance is the only one) | [V] |
| C21 | "REVISIT when the capability pack lands (H15.6)" (scan-twins.mjs:61) | H15.6 is the gesture/arrowhead item, DONE (BOARD.md:815); the pack is not in H15 (:849) | [M-read] |
| C22 | "...rules we have watched behave (AG-5)" (BOARD.md:853) | The only AG-5 is the session-narration item (b188 survey:250; WRITES.md:477) | [M-read] |
| C23 | Owed: hover, overlap and DOM-free binding (RULES.md:282-288); F3 prior-art pass owed (BOARD.md:899; input.js:597); "no requestAnimationFrame and no setInterval" (RULES.md:222-228) | B163 derived them (BACKLOG:225); "The prior-art pass is DONE" (RULES.md:17-21); paintloop.js:37-49 uses both | [M-read] |
| C24 | The TRANSACTIONS contract lists plan() as validate / cascade / group-steal / narrow / invert; I4 "five shapes" (TRANSACTIONS.md:59, 114-134, 189-191, 575) | plan() also runs the sweep and the collapse, and derived ops bypass per-op validation | [V] |
| C25 | "deleting one makes it a bend with nothing reconfigured" (DECISIONS.md:233) | The collapse reconfigures the document (del + set) | [V] |
| C26 | API.md:99-105 example document | Invalid three ways: no names; off-grid coordinates (570, 510, 270); spawn on a waypoint that is a via, which the same page (:129-131) forbids | [M-read] R1 |
| C27 | Frames are `#frame-*`; glyphs are "0.3-scaled art"; a group is "Not rendered" (API.md:122-125, 133-134); span and content undocumented, yet the CLI points to API.md for content (verbs.mjs:1965) | #m-* defs and fitted glyphs; #frame-circle/#frame-square are dead defs (theme.mjs:46-47); both renderers draw a hull | [M-read] R5 |
| C28 | Z-order zone, links, group, node (ATOMICS.md:47) | Both renderers draw the group below links (kernel/renderer.mjs:266; app/index.html:162-166) | [M-read] R5 |
| C29 | Labels "still deferred" (ATOMICS.md:119-120); manual waypoint-laying affordance open (:102); "A router... is a waypoint carrying a router glyph" (:351-357); dev/README.md "eight specifications" omits ATOMICS; "starts clean once this board is empty" (BOARD.md:947-952); "Until the matrix lands" (invariants.mjs:110-112, 172-174) | H15.19/H15.21; `w` (INPUT.md:171; B147); DECISIONS.md:302; H15 open; H15.4 landed | [M-read] R6 |
| C30 | A 1x1 frame "takes the stylesheet weight" (kernel/renderer.mjs:230-231); duplicated "junction rung RESERVED, not drawn" blocks and a superseded "hollow" comment (geometry.mjs:212-219, 245-272); `role` kept for bboxOf (geometry.mjs:100-101) | B235 moved the weight into defs (:337-345); waypointJunction is drawn (:284-289, 306); bboxOf reads only kind (:545) | [M-read] R2, R5 |
| C31 | Spawner is "RED by default ... DOCUMENT state ... may eventually want its own colour" (commands.js:561-564) | The code beneath writes kind:'packet' and the stylesheet owns the look (B172) | [M-read] R4 |
| C32 | Cascade lives in commands.js (model.mjs:4); protocol lists a `meta` command (protocol.js:16) | Cascade lives in txn.mjs (:10); dispatch has no `meta` (:327-540) | [M-read] R3 |
| C33 | An undo that removed a beat "sends exactly that" null (sync.js:655-657); a snapshot is broadcast (rest.js:313-316) | reversalBody has no reveal key [M-run R3]; a `selection` event is broadcast instead | [M-run] / [M-read] |
| C34 | The mechanism/parallel realizers live in dev/design/sim (kernel/engine.mjs:25-26) | Only README.md and explore/synthesis.json remain there; the realizers are in the archive | [M-read] R7 |
| C35 | The archive README says live history reaches 3adcdd7 | `git cat-file -t 3adcdd7` fails; live history starts at 67d229d (2026-08-18) | [M-run] R7 |
| C36 | `draw trace`, `draw check` (HANDOVER.md:340) | Not in cli/verbs.mjs VERBS | [M-read] R7 |
| C37 | "a rule may not write... Ruled 2026-09-01" (rules.mjs:32-35) | Recorded only in the code comment, not in DECISIONS | [M-read] R6 |
| C38 | X1 restated as "pure target state, no back-compat" (HANDOVER.md:310) | X1's original (COMMIT-DELIVERY.md:565) carries a revival trigger (a third-party /api/v1 consumer → /api/v2) | [M-read] R6 |
| C39 | "Only CREATED entities are revealed" (txn.mjs:506-507) | The filter is `op === 'put'` (:516), which includes whole-entity replacement puts | [S]; [M-run] R4 probe3 |
| C40 | `link path` returns "what the renderer would draw" (verbs.mjs:1035) | It returns the unrounded anchor polyline and omits closed (rest.js:663) | [M-read] R2 |
| C41 | Anchor "has no identifiers" (HANDOVER.md:42-46) | `anchor` is an identifier for the grid-position sense (nearestAnchor, anchorAt, resolveAnchor, wp-anchor, REST, CLI) | [M-read] R5 |
| C42 | "An endpoint is the src/dst of an open link" wording (validate.js:209-212; txn.mjs:111-114) | The aggregate role at 3 terminations is 'junction' | [M-read] R7 |
| C43 | The situation method vocabulary (RULES.md:89-98) | Rejected by name (situation.mjs:15-21) | [M-read] R4 |
| C44 | "Hand-routed ... orthogonal routing" principle (HIERARCHY.md) | Polylines, diagonal allowed; ortho is never checked in production | [M-run] R2 |
| C45 | The comment says the orphan sweep treats a closed ring's ends as bends (txn.mjs:111-113) | wasBendOnly adds every src/dst to `terminal` with no closed check (:139-149) | [M-run] R1 P3 |
| C46 | "Asking whether a group would dissolve with NOTHING removed is the same question as whether it is under the minimum" (model/invariants.mjs:242-244, the B85 comment) | That holds only while every listed member exists. After the sweep, the group [w3 (dead), node-cccccc] has 1 live member and violations() returns [] (D42) | [M-run] G2; comment [S] |
| C47 | applyOps: "a malformed op here is a planner bug, so it throws rather than silently no-op'ing" (model/ops.mjs:38-41) | The throw covers only unknown op names (:48). A set or del on a missing id returns silently (model.mjs:111-114, :119-121), which is how D41's form (a) lands | [S] read; P1, P3 [M-run] G1 |
| C48 | "An undone collapse must be byte-identical to what stood before it" (txn.mjs:250-254) | Undo restores content but not collection order whenever a deleted entity was not last in its collection (D43) | [M-run] G1 |

---

## 9. New defects surfaced

Defects are de-duplicated across readers. The Readers column says who found each one. "Consequence" is [I] unless marked otherwise.

| # | Defect | Evidence | Mark | Readers |
| --- | --- | --- | --- | --- |
| D1 | A collapse can commit a document that validateDoc refuses, bypassing both link refusals. The orphan sweep does the same through the group referential rule (D42), so derived-op invalidity is not collapse-only. Self-conflict: x→w plus w→y via [x] plus a third link at w; deleting the third gives x→y via [w, x]. Duplicate-through-bend: the merged link shares a pair with another link bending at the same waypoint. plan() returns ok. A node delete reaches it: with x→w, w→y via [x] and N→w (a valid pre-state), deleting node N plans ok and gives "link uses a waypoint in two roles" (G3). | probes P14/P15 (R1) and collapse-dup.mjs (R3): validateDoc returns "link uses a waypoint in two roles" and "two links with the same endpoints bend at the same waypoint". The store skips an invalid file at boot (store.js:289-296): now run through D42's boot-skip.mjs, which exercises the same validateDoc gate but not D1's specific document. Node-delete reach: gapfill-seam-ops.out (G3); the browser, CLI rm and REST DELETE request shapes reduce to the same plan (doors not run). Reachability through browser threading is [I] (threading is allowed at input.js:916-944). | [M-run]; boot skip [M-run, via D42's probe]; node-delete reach [M-run, plan level]; threading reach [I] | R1, R3, G2, G3 |
| D2 | A split can collapse an unrelated authored two-link terminus and delete the half that kept the original id. The split's `del X` + `put X` counts as a link loss. The collapse's own `del X` is then dropped from the ack diff because the client sent `del:link:X`, so the originating tab diverges. | split-collapse.mjs and split-collapse-ack.mjs (R3), using the real splitsFor, routeLink, Changes, Sync and plan: converged false. Mechanism at txn.mjs:207-213 [S], sync.js:409-416 [S], input.js:1027-1029. | [M-run]; the Sync transport was a stub | R3 |
| D3 | The ack diff drops any server-derived op whose op:kind:id key matches a client-sent op, e.g. a collapse `set` on a link the client also `set`. No resync is requested. D44 is this mechanism reached through a Track A delete. | ack-collide.mjs (R3): the server has L1 = a→b via [W]; the client has L1 = a→W via []. | [M-run] | R3 |
| D4 | Split naming: the new link and both halves receive one minted name, and the original name is lost. The halves also drop flow and control [V]. | split-names.mjs (R3), P2 (R1). makeLink/nextName read the live model, which does not yet hold the batch (model.mjs:240-247, 278-282). | [M-run] | R1, R3, R6 |
| D5 | The pin clear is local-only. Threading a pinned waypoint sets pinned:false in the browser model only. No op carries it, no undo record holds it, and the server and peers keep true. Threading a pinned waypoint through `set via` or /commit also leaves pinned:true, so no door clears the pin on the server (G3). Consequence: the sweep keeps exempting that bend. | P1 (R1): the only committed op is put/link. input.js:938; routeLink carries only ctx.placed (commands.js:332). set via threading: gapfill-seam-ops.out (G3). Sweep consequence [I] (txn.mjs:166). | [M-run] | R1, R3, G3 |
| D6 | cloneSubgraph drops a link's flow and control (it copies via and closed), and copies spawn onto a cloned waypoint whatever its role. | probe6 (R1), clone-fields.mjs (R3); commands.js:471, 517-521 | [M-run] | R1, R3 |
| D7 | The orphan sweep keeps the src and dst waypoints of a deleted closed ring. **CORRECTED:** a dst-less CLI ring (`draw link <src> --closed --via …`) has a minted waypoint as its dst (verbs.mjs:1899, 1918), so that waypoint is left behind; with a named dst the dst is whatever was named [S] (was: "A CLI ring always has a minted waypoint as its dst (verbs.mjs:1918)"). | P3 (R1): only via bends are swept; waypointRoles(src) = []. wasBendOnly has no closed check (txn.mjs:139-149). | [M-run] | R1, R6 (as [I]) |
| D8 | Arming gates disagree. The browser cannot arm a junction, contrary to its comments. The CLI can, and the simulation then emits along the first terminating link. The browser arms a T; the CLI refuses it. The server has no gate. Consequence: a spawner armed as an endpoint keeps emitting after its waypoint becomes a junction, and cannot be toggled off by click. | probes R1, R2 §3, R4 b/b2, R5, R6; situation.mjs:122-127; verbs.mjs:1589-1597; validate.js:236; tests/situation.test.js:115-167 assert the role set, never the arming. Toggle-off consequence [I] (R6). | [M-run] | R1–R6 |
| D9 | Spawners emit data-plane packets on control-plane links, contrary to the field's definition. | spawnersOf on control:true returns a spawner (R1, R2, R7); spawners.mjs:30-49 [S] reads no control | [M-run] | R1, R2, R3, R4, R7 |
| D10 | Movers run against the declared flow whenever the armed end is the flow head. This is an unregistered divergence; BOARD.md:849 puts packet movement outside H15, so it may be a known gap. | R4 probe1 a (all 6 combinations start at the armed waypoint); R1; R7 | [M-run] | R1, R4, R7 |
| D11 | Parity break: the link a spawner emits along depends on linksAt order. That order differs between the browser's maintained index and a scanning Model (CLI `draw movers`/`combat`). Two browsers with different histories may also disagree ([I]). | probe1 c (R4): after a put of an existing link, the index picks link-aa0003 and the scan picks link-aa0001; ivm.mjs:31-40 | [M-run]; browser-vs-browser [I] | R4 |
| D12 | A collapse leaves spawn stored on a waypoint that has become a via. It emits nothing, yet situation.spawning and the `.spawning` class still report it armed. | P6 (R1); probe1 e (R4); txn.mjs has no spawn handling | [M-run] | R1, R4 |
| D13 | A newly placed tower is folded as if present for the whole transit window. Movers already past it vanish at placement: those beyond range drop from 11 to 0, and the earliest death is 138 ticks before now. Whether this is intended is NOT-CLAIMED; no ruling was found. Retype is a second trigger, and adds a resurrection direction (D45). | probe2 (R4); rules.mjs:160-198 uses one worldOf | [M-run] | R4 |
| D14 | A paced commit reveals whole-entity replacement puts as if they were created, so a paced disarm hides an already-visible waypoint until its slot. | probe3 (R4); txn.mjs:506-507 vs :516 [S] | [M-run] | R4 |
| D15 | CLI spawn stamps `since` from the host's Date.now(), not the agreed clock. | verbs.mjs:1607 vs commands.js:549-551 | [M-read] | R3, R4 |
| D16 | Canvas and export draw different endpoint ring weights for the same valid document. The canvas counts threading links toward the plane: width 5 on canvas, 3 in the export. | probe §4 (R2), using the kernel function with each renderer's input; the export SVG shows stroke-width="3". Browser DOM not run. | [M-run] (kernel level) | R2 |
| D17 | `draw about <link>` prints the path as "undefined,undefined -> ...". contextOf returns [[x,y]] tuples; the CLI formats them as p.x,p.y. `link path` formats the same data correctly. | rest.js:96; verbs.mjs:997 vs :1047; the same expression was evaluated on a real pathOf result (R2). The CLI was not run. | [M-run] (expression) | R2 |
| D18 | The `link path` response cannot express a closed link's closing segment or rounding, yet is described as what the renderer draws. | rest.js:663; verbs.mjs:1035; router.mjs:65-75 | [M-read] | R2 |
| D19 | The CLI `links` verb and REST context misdescribe links that only thread a waypoint: the far end is reported as l.src, and neighbours include both ends. | verbs.mjs:2709; rest.js:88-90 | [M-read] | R2 |
| D20 | The server accepts a waypoint or node inside a spanned node's footprint; the client index calls that cell occupied. | P8 (R1): plan accepts (60,0) next to a 3x1 span at (0,0); occupiedAnyAt(60,0) is true on the index and false on the scan | [M-run] | R1 |
| D21 | undo/redo broadcasts carry no reveal and from:null, so peers keep a stale reveal after a beat is undone or redone. | reveal-undo.mjs (R3); protocol.js:197-209 vs :181 | [M-run] | R3 |
| D22 | The websocket reclaim path pushes the whole, unfiltered agent list to every session: the B116 leak at one call site. | protocol.js:508 vs rest.js:40-46 announceEach | [M-read] | R3 |
| D23 | The browser never consumes the `selection` or `viewers` events the server broadcasts. | sync.js:336-540 (the only net subscriber, :161); protocol.js:488; rest.js:45, 330 | [M-read] | R3 |
| D24 | shedRetired short-circuits (`migrateNames(doc) \|\| migrateSpawn(doc) \|\| shed`), so migrateSpawn never runs when migrateNames changed something. A document needing both would be refused and skipped at boot. Templates are never migrated. | store.js:128 [S]; :821-832. No stored document was checked. | [S] mechanism; consequence [I] | R3 |
| D25 | CLI `rename` refuses links and waypoints with a pre-B187 reason, while `set <ref> name` accepts both. | verbs.mjs:2112-2113 vs :344-367 | [M-read] | R3 |
| D26 | `name` is required at full validation for link, waypoint and node, contradicting its own comment and the API example. | P4 (R1); validateEntity (R5) | [M-run] | R1, R5 |
| D27 | After B235 the favicon frame has no stroke-width: `<circle class="frame" r="20"/>` falls back to 1 against the canvas 2.1. The test pins the string and never checks the weight. | faviconSvg() run (R5); theme.mjs:36, 146, 152; tests/browser.test.js:486-514. Pixel weight [I]. | [M-run] | R5 |
| D28 | Node and zone name labels differ between canvas and export in colour (#ddddff vs #e6e9ee, because TOKENS.label is undefined), family, baseline and backing pill. The B236 guard checks only font-size. | style.css:388-390; renderer.js:284-286, 300-301; kernel/renderer.mjs:124-128; theme.mjs:12-22; tests/browser.test.js:1104-1130 | [M-read]; visual [I] | R5 |
| D29 | `.waypoint.spawning .wp-ring { stroke-width: 3 }` overrides the derived endpoint ring width, the B235 class of defect. The spawning appearance never reaches the export. | style.css:495; geometry.mjs:299-304; adapt.mjs:47; kernel/renderer.mjs:209-214 | [M-read] | R5 |
| D30 | Selected-path, armed and spawning recolouring misses `.wp-anchor` (a bend's ring) and `.wp-junction`. `.node.ghost .wp-ring` targets a layer the ghost never draws. | style.css:426-428, 479-480, 495-496, 508-514; painter.js:72; renderer.js:168-170 claims to prevent this | [M-read]; visual [I] | R5 |
| D31 | Canvas links carry no stroke-linecap/linejoin (SVG defaults butt/miter); the export emits round/round. | renderer.js:294; style.css:393; kernel/renderer.mjs:175 | [M-read]; visual [I] | R5 |
| D32 | The drag/stamp ghost emits an UNFITTED glyph `<use>`: B205 residue. | painter.js:78-79 vs palette.js:129-173 | [M-read]; size difference [I] | R5 |
| D33 | The zone label update path uses literals (x+10, y+22; pill x+6, y+9) where the render path uses STD.zoneDx/zoneDy. The values agree today. | renderer.js:300-301 vs :441, 443 | [M-read] | R5 |
| D34 | The pipette can arm an unrenderable or wrong-kind type: 'text' from a text box (no glyph-text def), or 'waypoint' from a node stored with that type (which the validator accepts). | input.js:1460-1463, 862-875; theme.mjs:45-109. End-to-end [I]. | [M-read] steps | R5 |
| D35 | A turret's glyph rotation is never cleared. A former tower retyped through the in-place update path keeps its aim rotation. | movers.js:313-314; renderer.js:382-389. G3 read that a retype of a plain 1x1 node takes the in-place branch (renderer.js:380-389), that aimTurrets is the only writer of the glyph `transform`, and found no reset by grep of app/src. DOM effect [I]. | [M-read] | R5, G3 |
| D36 | After a reveal trace, a control-plane link may render solid: an inline `stroke-dasharray` outranks the dash attribute and is never removed. | reveal.js:103; no removal anywhere in app/src | [I] | R1 |
| D37 | The H15.4 twin-agreement test builds 9 "every combination" cases and uses them only in a length assert. No matrix test covers the undeclared or one-declared pair, which is exactly where roles and collapse disagree. | tests/validate.test.js:874-882, 885-900, 937-949, 965-981 | [M-read] | R2 |
| D38 | A second, undeclared pairKey with a different encoding exists, although invariants.mjs claims to own it. | referential.mjs:125 vs invariants.mjs:56 [S] | [M-read] | R1, R3 |
| D39 | The run-mode tower rule's situation predicate is vacuous: situation(null) always gives onOpenGround = true. The effective gate is the DOM test plus occupiedAnyAt. | input.js:637-638 [S]; situation.mjs:143 [S] | [S] | R4 |
| D40 | CLI mint has no collision check, and put upserts, so a colliding id would silently replace an entity. The probability is very low. | verbs.mjs:1839; txn.mjs:353-386 | [I] | R1 |
| D41 | Collapses in one plan() are computed against a projection that is not advanced between merges. Each touched waypoint's pair is read from `proj` as it stood before any merge, and all merges are applied once. When two touched waypoints share a link, the later merge reads that link's pre-merge ends, in four forms: (a) a set on a link already deleted does nothing, and a link is lost (P1); (b) a delete of a link just rewritten, with every op finding its target, and the same loss (P2); (c) a double delete leaving two overlapping survivors where one link is expected (P3); (d) a double set, where the last write wins and a segment is dropped. Flow eligibility is read against the stale link, so a declared convergence is merged away (P8). A stale merge can orphan a bend after the sweep has run (P6). In P1–P6 and P8, plan is ok, violations() is [] and validateDoc is null. Undo restores the content. Reachable through plan() by a node delete (P4) and by a two-link request (P5). | server/txn.mjs:216, :230-232, :259-261; model.mjs:111-114; ops.mjs:45. Cases and rates in §4.3 "Composition inside one plan() pass" (stale-merge/cases.out and the mulberry32 search captures; critic/double-collapse.mjs). The browser's deleteSelection builds one entry list that includes a deleted node's cascaded links (app/src/commands.js:51-124, :64-69, :117); that it reaches plan() as one request is [I]. No txn test holds two collapse candidates (text scan of tests/txn.test.js :562, :583, :634, :670, :758). | [M-run] mechanism and cases; door reachability [I] | G1, CR |
| D42 | The orphan sweep deletes a grouped bend without trimming the group, so the dead id stays in group.members. plan() returns ok; violations() cannot see it, because B85 counts listed members; validateDoc refuses it ("group member does not exist: waypoint-000003 (group-000001)"). Six request shapes reach it: del link, del node, del terminating waypoint, set via [], set via reroute, put without via. A 2-member group survives with 1 live member where the request path dissolves it. The browser then REFUSES any delete or regroup that would rewrite the group's member list (opIndex 0, "group member does not exist"); deleting all live co-members at once passes, because the group dissolves. CLI/REST single dels pass and can shrink the group to one live member. Redo recreates the state. The flushed file is skipped at the next boot, and when it is the only diagram file the server refuses to boot ("refusing to boot: 1 diagram file(s) present, none loaded"). Both renderers hide the dead member, so nothing shows in-session; the first signal is the boot skip [I]. A later waypoint minted with the dead id would silently join the group (D40 class) [I]. | txn.mjs:161-176 vs :406-418, :425, :472; validate.js:322-326, 358-361, 453-456; referential.mjs:149-156; invariants.mjs:249-258; store.js:289-296, 318-322; renderer.js:243; kernel/engine.mjs:97; model.mjs:40-47. GR5 corpus groups are nodes-only (tests/diff-plan.test.js:40-44); the sweep tests have no group case (tests/txn.test.js:418-560). The record has no entry (searches: "group member does not exist", "sweep" with "group", "dangling member\|dangling group\|stale member"; only BACKLOG.md:224 B162, whose closure says nothing about groups on the sweep). | [M-run] (gapfill/ triggers, followon, browser-door, browser-door2, undo-redo, boot-skip; critic/sweep-group.mjs); browser live-model state [I] (sync.js:407-413); CLI resolving a waypoint ref [I] | G2, G1, CR |
| D43 | Undo restores content but not collection order whenever a deleted entity was not the last in its collection, because Model.put appends a re-created key (model.mjs:105-106). Measured on a single, non-stale collapse (P4ctl) and on a plain link delete (A, B, C → B, C, A). Both applied `r.inverse` with applyOps, not through undo(). The B215 undo test compares order-sensitively (tests/txn.test.js:21, :583-600) and passes because its fixture deletes the last-inserted link. The critic's "P1 undo is byte-for-byte" holds only for P1's insertion order. Consequence for linksAt order and spawner choice (D11): [I]. | stale-merge/undo-diff.mjs, undo-order.mjs; contradicts txn.mjs:250-254 (C48) | [M-run] | G1 |
| D44 | The originating browser diverges when one selection deletes a node AND a bend of the link the collapse keeps. deleteSelection sends `set:link:A{via:[]}` (the strip projection, commands.js:96); the collapse's `set:link:A` has the same key and is dropped (sync.js:411-412). The originator holds A = a→W via [] with B gone; the server holds A = a→b via [W]. The originator's view validates, so nothing flags it. This is D3's class reached through a Track A delete. | gapfill-seam-ops2.out: converged false | [M-run]; ack rule restated, not the Sync class | G3 |
| D45 | Retype flips tower behaviour retroactively in both directions. Retype away resurrects killed movers (dead 14 → 0 at the same t); retype to kills movers in the past (earliest death 98 ticks before now). This is a second trigger for D13's mechanism, and the resurrection direction is new. On-canvas visibility is [I]: fold() runs every TICK_MS and replaces `this.deaths` (movers.js:111, 128-133). | engine-level probe in gapfill-seam-ops.mjs (probe2's fixture with the far node moved on-surface; combatAt at the same t); worldOf reads the current type (rules.mjs:52-64; kinds.mjs:72) | [M-run] engine level; canvas [I] | G3 |
| D46 | The CLI type vocabulary is closed on create (verbs.mjs:1124, 1669) and open on retype (`set type`, verbs.mjs:347, no check). 'waypoint', 'load-balancer' and 'text' are reachable by retype. | read; server acceptance measured | [M-read] + [M-run] | G3 |
| D47 | CLI `region` refuses content on a node without span; the server accepts content on a 1x1 node. | verbs.mjs:2600-2601; probe | [M-read] + [M-run] | G3 |
| D48 | REST PATCH labels every field write 'move <kind>' (rest.js:1098), so a retype, a re-route or a content change enters history as 'move node' or 'move link'. | read | [M-read] | G3 |

---

## 10. Known gaps not filled

This section replaces the earlier "10. What this map does not cover", whose content is kept unchanged as §10.2 with G1's unmeasured items added.

### 10.1 Critic gaps that no gap fill closed (verbatim)

1. MEDIUM. The matrix covers writes only, and the role derivation (the central Track B output) cannot be read at the agent doors. A grep of server/ and cli/ for waypointRoles, waypointRole and roles returns nothing. REST contextOf (rest.js:80-112) reports links, neighbours, group and zones for a waypoint, with no role. The CLI shows only its own structural refusal wording in `spawn` (verbs.mjs:1585-1597). The only server-side role computation is inside the SVG export (server/svg.mjs:17 -> kernel/engine.mjs:71), which draws roles but does not report them. The map cites GR18, which requires pack-derived state to reach the CLI (TRANSACTIONS.md:620; CLI.md:10-22), only as a sequencing constraint under F39. It never records that endpoint, bend and junction are not readable today through REST or the CLI, nor that the pass-through classification disagreement (F7) is visible only on the canvas. The same absence applies to incidence role, the flow head at a point, and any run or path.

2. MEDIUM. Two glossary rows are missing or incomplete. FLOW, one of the director's four terms, lacks a live code meaning. The browser treats an undeclared link as carrying flow BOTH WAYS and renders it '<->': readout.js:141-147 says 'a symmetric link carries flow both ways rather than having no relationship', and input.js:818-820 says the same. The rules read undeclared as 'no direction anywhere': facing/linkFacing return null (invariants.mjs:127-129, 137; geometry.mjs:394-401), ATOMICS.md:262 calls it 'symmetric', B232 says an undeclared link 'cannot make a path through by itself', and the collapse lets a declared half's direction be inherited across it (invariants.mjs:169-170, 187). 'Bidirectional' and 'unasserted' decide the H15.5 inheritance cases and F7 differently, and the FLOW row lists neither reading. tests/rules.test.js:101 also uses 'flow' for mover traffic. Separately, PROJECTION has no row although the write seam depends on it and it carries at least four meanings: the scratch Model copy (model.mjs:34-38), the planner's advancing `proj` (txn.mjs:90, :215, :261; W7 'advancing projection'), the client's prediction of server cascades (commands.js twins, the matrix 'Client projection' column), and a single-role projection (geometry.mjs:528-534). The HIGH stale-projection defect above is a defect in the second of these.

   Integrator note, not part of the verbatim text: "the HIGH stale-projection defect above" is D41. Neither row was added in this revision.

3. MEDIUM-LOW. The matrix row 'Spawn arm / disarm' treats disarm as the mirror of arm, but disarm is gated by the ARM predicate at both human-facing doors. As a result, a spawn stranded by a collapse (D12) cannot be cleared from the browser or the CLI. Browser: toggleSpawn has one caller (input.js:606), gated at :603 by onEndpoint, which needs roles to include 'endpoint'. A collapsed via waypoint derives [] (geometry.mjs:458-465, 523-524), so clicking it does nothing. CLI: `draw spawn W --off` reaches the bend refusal at verbs.mjs:1589-1591 ('is a BEND ... not an endpoint') before the --off branch at :1599. The only remaining door is a raw put through /commit or REST (validate.js:236 is shape-only). This is M-read and unexecuted per constraint. It sharpens F28/F29: arming and disarming share one gate, and the gate reads a derived role that later writes (collapse, split, threading) change. D8's toggle-off consequence is marked [I] and covers only the browser junction case.

### 10.2 Sources and instruments not covered

- **Unread sources.**
  - The full cli/verbs.mjs regions for textsize, map and parity.
  - kernel/renderer.mjs beyond the cited ranges.
  - The internals of engine combat and movers beyond the cited lines.
  - dev/design/walk/FINDINGS.md.
  - BOARD H0–H11 in full.
  - The b188 survey beyond its AG rows.
  - COMMIT-DELIVERY.md beyond X1.
  - ACCESS.md, AUTHORITY.md and HOSTING.md, beyond R6's keyword grep (no Track A/B content).
- **Unrun instruments.**
  - The live estate: only templates/ and the gitignored local diagrams/ were tallied.
  - Any pixel or computed-style reading.
  - The browser DOM.
  - The CLI.
  - The network.
  - The test suite and gate.
  - Browser-to-browser index-order divergence.
  - The ack or client path for D41 (G1 expects convergence on the same wrong result [I]).
  - Whether a fixpoint collapse loop and an advancing one differ after a D1 self-conflict merge (G1).
  - The Sync class for D44 (G3 restated the ack key rule from sync.js:411-412).
  - The browser's live model reaching D42's dangling-member state (G2, [I] from sync.js:407-413), and whether CLI `group` resolves a waypoint reference (verbs.mjs:2057-2061).
