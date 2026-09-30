# draw - decisions

**Status: enduring, append-and-amend.**\
The ratified decision register: what was ruled, when, and what it affects.

A decision here is not re-litigated.\
It is **amended in place with a date** when it is reversed or narrowed, so the reasoning behind a change survives the change and a reader can see that a position moved rather than finding only its replacement.

Holding this document authorises nothing.\
It records rulings; it does not make them.\
Purpose belongs to [`../VISION.md`](../VISION.md), the live plan to [`BOARD.md`](BOARD.md), and the durable record of what was not done to [`BACKLOG.md`](BACKLOG.md).

> **Opened 2026-09-03**, carrying the locked decisions and their amendments out of `docs/spec/SCOPE.md`.\
> They were never scope: a scope document says what is in and out, and these are rulings with dated reversals.\
> They lived there because nothing else existed to hold them, which is the shape a missing artifact leaves behind.\
> `GR10` enforces the amendment discipline below and reads this file.

---

## Decisions (locked 2026-06-11)

1. **Canvas**: fixed logical 1920x1080 (16:9), scaled to fit the window. No pan/zoom.
   The canvas maps 1:1 onto a Google Slide via a linear coordinate transform.
   *(Amended 2026-06-12)* - **center-origin coordinates**: [0,0] is the exact
   canvas/slide center, matching external geometric systems. Node grid =
   multiples of 60 from the origin (31x17 points, oddxodd - a true center
   point exists); zone grid keeps the half-cell offset (+/-30 + k-60). Extents:
   nodes +/-900/+/-480, zones +/-930/+/-510. Docs carry `meta.grid: "center"`; legacy
   top-left documents are migrated on load by a uniform (-930, -510)
   translation (preserves layout exactly; outermost right/bottom band clamps
   inward one cell).
   *(Amended 2026-08-18, CS1/CS5)* - the **geometry above is unchanged**; its two
   mechanisms are gone. Load-time legacy migration was deleted at **CS1**: a
   quadrant-confined top-left document validates clean, so it loaded silently
   displaced by (+930, +510) with no way back. A document that cannot be told
   apart from a valid one must be REJECTED at the boundary, not guessed at, and
   `Store.init` now refuses to boot rather than skipping the file and reseeding
   over it (D17/GR8). `meta.grid` was deleted at **CS5** - it was 'center' on
   every live file and its discriminator role passes to `meta.schema: 1`. There
   are no legacy documents left: all 17 were migrated by
   `tools/migrate-version.mjs`, verified per-entity.
2. **Interaction**: modern conventions. Left-click select, drag from palette to create,
   Delete key deletes, marquee select.
   *(Amended 2026-06-12)* - **two-button gestures** (v1 convention restored): left-drag
   from anywhere on a node draws a link (the whole node is the source - the edge-band
   targeting split is gone); right-drag moves a node/zone and its selection. Click
   semantics, Ctrl+drag clone and the Alt+right-click delete chord are unchanged;
   zones still move on left-drag too (they cannot source a link).
   *(Amended 2026-06-13)* - **stamp hand** (Factorio convention): digits 1-6, Q pipette,
   or a palette-tile click hold a node type; a ghost rides the snapped cell (red when
   occupied - occupied cells refuse), plain click on empty canvas stamps one node per
   click (one undo entry each), Enter stamps at the ghost, and clicking a node of a
   different type retypes it in place (fast-replace: id/name/links survive, undoable).
   Click-select on entities, marquee DRAGS, and all right-button gestures stay live
   while a hand is held - the hand only claims the plain empty-canvas click.
   *(Amended 2026-06-13)* - **data view**: **Tab** toggles a read-only numeric overlay
   (Factorio info X-ray) showing every node's [x, y], every zone's [x, y] wxh, and every
   link's length at once; pointer-inert, tracks the model live, units follow the readout's
   px/cm toggle, on/off persists. The whole grid becomes auditable in one glance.
   *(Amended 2026-06-13)* - **keyboard wiring**: with 2+ nodes selected, **L** links them
   pairwise in selection order (chain), **Shift+L** stars the first-selected to every other;
   existing pairs are skipped (no duplicate), the batch is one undo step. Selection order is
   deterministic but invisible for marquee picks - unambiguous for 2 nodes or the star.
   *(Amended 2026-06-13)* - **link re-plug**: a single selected link shows a handle at
   each endpoint (on the line, just outside its node); left-dragging a handle onto another
   node rewires that end - one undoable `set` (the link keeps its id), refused if it would
   duplicate an existing link or self-loop. Replaces delete-and-redraw for fixing a miswire.
   *(Amended 2026-06-13)* - **keyboard layout instruments**: **Ctrl+D** duplicates the
   selected subgraph at the remembered pitch (the last committed move/clone delta this
   session, default one cell right; clamped to the canvas, refuses when both axes clamp
   to zero - never overlaps); tapping it lays out a row. **Z** wraps the selection in a
   fitted zone (bbox + 30px margin, rounded out to the zone grid). **Shift+arrows**
   resize the lone selected zone one cell at a time (NW-anchored, minimum one cell,
   coalesced into one undo step like nudge). All three are derived, exact, undoable.
   *(Amended 2026-06-12, engineering-UI pass)* - **zone layer**: zones are interactive
   only while Shift is held (additive layer - nodes keep hit priority and their Shift
   semantics). Without Shift, zones are inert backdrop: clicks and marquees pass through,
   which makes marquee-select work inside zones. Marquee never picks zones. Double-click
   rename stays Shift-free (geometric, unambiguous). **Selection visual**: corner
   brackets around the entity footprint (RTS convention) - selection never restyles the
   icon; arming states keep their recolor (transient warnings may shout).
3. **Group**: logical member set `{id, name, members[]}` - select/move as one. No visual of its
   own (zones cover visual regions).
   persisted in diagram meta. Push is an explicit button (commit/push), one-way.
5. **Ownership**: unidirectional. The client owns all model mutations during a session; the
   server is persistence-of-record and read-only to everyone else (REST). Single writer -
   no convergence machinery, no conflict resolution.
   *(Amended 2026-06-13)* - **Server-Locked control**: write authority can hand off between
   sides, but never split. Default = *editable* (the browser writes over the websocket; REST
   is read-only). A server-side controller (LLM, script, or a person at the CLI) `POST`s
   `/api/v1/diagrams/:id/lock` to become **Server-Locked**: it then writes over REST
   (`/commit` + high-level `/nodes|/links|/zones|/groups` verbs, token via `X-Draw-Lock`,
   funneling through the same validated `store.commit`), the server live-pushes snapshots to
   the browser, and the browser goes read-only - its websocket writes are refused so it can
   never clobber the controller.
   *(Amended 2026-08-18, CS1/CS3/CS6)* - the REST verb is `/commit`, not `/apply` (X1), and what the
   server live-pushes is the **change** (`change {..., ops}`), not a whole snapshot: a viewer
   applies the ops it is sent rather than reloading the document. Server-Locked itself is
   unchanged - one side writes at a time, the human reclaims anytime. The human reclaims anytime (force-release); an idle lock
   also TTL-expires so a crashed controller never strands a diagram. This stays faithful to
   "single writer": it is a *control handoff*, still exactly one writer at a time - no
   convergence, no conflict resolution, not multi-user. The browser surfaces it with a header
   pill (green **unlocked** / amber **locked**, click to reclaim) and goes read-only while
   locked - selection, the data view, and the readout still work, but no mutations. Read-only
   follows the lock belief, not the connection (a drop while locked stays read-only).
6. **Visual continuity**: the editor looks like draw v1. The v1 visual system is ported as an
   asset, not reinvented: dark theme (#101010 canvas, #202020 grid dots), the hand-authored
   SVG `<defs>` icon library (host, router, vxlan, firewall, loadbalancer, server), the
   CSS-variable state-class system (--icon/--fill/--outer), the palette (#aed581 green
   primary, #4fc3f7 blue links, #e57373 delete-arming red, #81d4fa clone blue), and the
   light translucent rounded rectangles for zones (#ddddff, rx 6px). New visual states
   required by modern interaction (selection, marquee) are designed *inside* the same
   CSS-variable system using graph's orthogonal class composition (e.g. selected x hover
   as independent class dimensions), never as a parallel styling mechanism.

---

## Borrowed mechanisms (narrow, by source)

| Source | Mechanism |
|---|---|
| draw v1 | dual-grid snap (node grid 60px/30px offset + half-offset zone grid); `<defs>`/`<use>` iconset with CSS-variable state classes; SVG layer ordering (zones->links->nodes->overlay); live snap feedback; the entire visual theme (dark palette, icon artwork, zone styling) ported verbatim from `.refs/draw/index.html` defs + `style.css` + `colours.js` |
| graph | single websocket with reconnect + rehydrate handshake; `{cmd, body}` envelope protocol; prefixed hex entity IDs (`node-a1b2c3`); orthogonal CSS class composition for independent visual state dimensions (was status x hover; becomes selected x hover) |
| prism | debounced write batching (200ms pulse -> disk flush, server-side); entity-manifest JSON document format; entity-addressable read-only REST; janitor-lite validation at the server boundary; framework-free `node:test` integrity tests |

Explicitly NOT borrowed: L1-L4 compiler, layouts/settlement, routes/pathfinder, tag selectors, class/style entities, Merkle/hash auditing, reverse RPC, multi-host, k8s binding, peer mesh.

---

## Google Slides sync -- REMOVED

Retired.\
`slides` is the sole entry in `RETIRED_META` in `server/store.js`: the key is stripped from every document on read, so no diagram carries it and nothing writes it.\
The `POST /api/v1/diagrams/:id/sync/slides` endpoint this section used to specify does not exist in `server/routes.mjs`.

Recorded as removed rather than deleted outright, because a reader who meets `slides` in an old export or in the retired-meta list should be able to find out what it was and that it is gone.
---

## Capability rulings, and what reversed them

*(Moved 2026-09-03 from `SCOPE.md`'s "In scope (functions)".\
The list itself was scope and is gone with that document; what is kept is the dated amendments, because each records a locked position being reversed and `GR10` requires them to survive.\
The capability statements around them are retained as the context the amendment reverses -- an amendment with its subject deleted is a correction to nothing.)*

### As shipped, with the rulings that changed it

Drawing: palette create, snap move, delete, clone, link draw (node edge drag), zone draw, labels (double-click edit).\
Selection: click, marquee, multi-move.\
Undo/redo: client-side command stack.\
Persistence: continuous auto-save over WS, named diagrams (list/create/open/delete with two-click arming), first-boot example seed (from the tracked `examples/` corpus into the untracked runtime data dir - content and state are different things), hydrate on connect/reconnect.

*(Amended 2026-08-20, H9)* - **the example corpus becomes a TEMPLATE set, not a first-boot seed.**\
Under per-diagram access control the old behaviour is wrong twice: the corpus is shared state every principal can edit, and no principal has a starting point of their own.\
Templates are read from the image, never written to the store, and listed to everyone; the first mutation against one forks a new diagram with a new id, owned by the caller.\
The invariant the first-boot rule protected is unchanged and is the reason this is safe - **deleted user work never returns**.\
A template is not user work, so a template reappearing after its fork is deleted is not a resurrection; what stays impossible is the deleted fork coming back.\
Designed in `docs/spec/ACCESS.md`, not yet built.

*(Amended 2026-08-18, CS3)* - **undo/redo are a SERVER capability**, not a client-side command stack.\
The stack was destroyed by any authoritative snapshot, and a REST write broadcast one - so Ctrl+Z could not reverse an agent's change, only lose your own.\
The server holds a bounded log of changes with their inverses; `undo`/`redo {expect}` reverse whoever's change is on top.\
The client keeps only a coalesce window, so a burst of nudges is still ONE undo step.\
See the wire-protocol amendment above and `docs/spec/TRANSACTIONS.md` section 3 (D3, D14, D21).\
Product: README with real usage, one-command start, seeded example diagram, tests (model, protocol, slides mapping with mocked API, CLI integrity).\
*(Amended 2026-06-13)* - a sovereign **read-only `draw` CLI** (`cli/`, bash+curl+jq over the REST API) ships as a first-class agentic/operator surface; it is bundled in the single container.\
Still strictly read-only - it adds no mutation path, honoring single-writer ownership.\
(Supersedes the "CLI binary" exclusion below: that ruled out a *write* CLI.)

*(Amended 2026-08-18, CS6)* - the write-CLI question is answered **no**; the exclusion stands.\
CS6 adds `draw history` (read) and does **not** add `draw undo` / `draw redo`, though the design listed them.\
The condition this CLI was admitted on is that it adds no mutation path, and undo is the *destructive* verb - the one the whole `expect`/reclaim apparatus exists to stop anyone issuing blind.\
A bash wrapper is one shell-history recall away from reversing work nobody meant to touch, and it cannot hold a lock across the two calls it would need.\
Agents keep `POST /api/v1/diagrams/:id/undo`, where the lock and `expect` gates live.\
Revisit only if an operator hits a case the REST call cannot serve.

---

---

## The universal node, staged (ruled 2026-09-19)

**Target.**\
A node declares CAPABILITIES; a capability contributes visual layers and behaviour, derived from the document.\
`waypoint` does not survive as a separate kind -- it becomes a capability pack on the universal node, and the last one still pretending to be a type.

**Derived, not stateful.**\
A capability recomputes when the document changes -- a new link configuration, a moved entity -- and stores nothing that could disagree with it.\
This is what the system already does: `waypointRole` is called fresh on every render and nothing caches a role.\
A capability that needed stored state would be a different and more expensive class, and none is proposed.

**Sequenced deliberately, and the order is the ruling.**

1. Capabilities introduced ALONGSIDE the existing kinds, gating on a declared capability rather than on `kind === 'waypoint'`.
2. Proven on the junction, which needs no migration because it rides on the `waypoint` kind as it stands.
3. `waypoint` collapsed into `node` only once the mechanism is load-bearing.

**Why staged rather than collapse-first.**\
The two are independent: capability-driven behaviour does not require removing a kind, and the probe demonstrated exactly that by gating on `routable` while `waypoint` remained distinct.\
Collapsing first would migrate 26 live diagrams to prove a mechanism that had not yet been exercised.

**The one-way door is named.**\
`waypoint` is an ID PREFIX, present in the id grammar, the CLI, and every stored document.\
Everything before step 3 is reversible; step 3 is not.\
It also changes what `via` means -- from "any waypoint" to "any node holding the capability" -- which is a semantic widening, not only a rename.

**Amended 2026-09-19, after the junction shipped.**\
Step 2 did not happen as written.\
The junction was built directly on the `waypoint` kind -- sub-type roles, layer list, validator relaxation, picking -- rather than through a capability, because that was the fast path and each step was approved on its own.\
So the junction is BUILT and the capability mechanism is still only a probe.

That is accepted rather than corrected, and the sequence is now **extract, not design-first**: finish the junction including the split, then lift the whole waypoint surface out as a pack and see whether it separates.

The reason is what building it taught.\
A capability pack for `routable` has to supply five things, and the probe had only tested two: role derivation and visual layers, both pure functions.\
The others are validator participation, picking behaviour, and -- newly -- a WRITE.

**The split is the first capability that mutates the document**, and nothing in the capability model says how a pack contributes one.\
That is the question the extraction has to answer, and designing the seam before writing a single write is how a registry-first programme would have gone wrong.

**Evidence.**\
The capability probe is recorded in [`ATOMICS.md`](../docs/spec/ATOMICS.md) under the junction entry: zero divergence on role derivation across all six cases, layers composing correctly, and a `server` holding both `framed` and `routable` producing a combination that is currently inexpressible.

**Amended 2026-09-22, ruled by the director: the anchor, and permission by type.**

The shape the extraction was waiting to learn is now settled, and it is smaller than the five-part pack this ruling anticipated.

**The base entity is the NODE, and a node has an ANCHOR.**\
The anchor is intrinsic and empty by default -- a node can be reached whether or not anything reaches it.\
`waypoint` was overloaded: it named the id prefix, the kind, and the anchor at once.

**Endpoint, bend and junction are not behaviours a node implements.**\
They are what the GRAPH makes of an anchor at a given moment -- derived, never stored, exactly as the roles are today.\
An anchor does not choose to be a junction; three links terminate there, so it is one, and deleting one makes it a bend with nothing reconfigured.\
So `routable` supplies ONE capability and the three variants fall out of it, rather than three implementations and a dispatch between them.\
Three implementations could disagree with each other, which is the class of defect B211 through B222 all were.

**A type DECLARES which variants it permits**, and the declaration reads like an import of the capabilities the anchor produces.\
A bare waypoint permits all three, which is what makes it "just an anchor" -- it is the unrestricted case rather than a kind of its own, and that is how it disappears.\
A router permits endpoint and junction but never bend: it is a thing the author placed, not a geometric artifact to be absorbed into a `via`.\
A compute or server glyph permits endpoint alone.

The rejected alternative was to DERIVE absorbability from whether the node carries a glyph, a name or content.\
It infers intent from incidental properties, so a node would become un-absorbable as a side effect of being named -- the same shape as reading direction out of `src` and `dst`, which is what B222 was.\
A declaration can be read and reasoned about; an inference cannot.\
Permission also answers more: not only "may this collapse" but "may a link land here at all", which currently has no answer.

**PER TYPE, not per instance.**\
All servers behave alike, and the table lives with the type definition, so adding a glyph means deciding its routing permissions.\
Per-instance permission would be hidden state that nothing on screen shows.

**A violation is REFUSED**, in the validator, where the permission table belongs beside the rules that already refuse illegal states.\
Not permitted-but-underived, which leaves two links terminating at something still calling itself a terminus; not permitted-with-escalation, which rewrites what the author placed.\
The cost is accepted: a second link cannot be drawn to a server node, and if that is ever legitimate the TABLE changes rather than the rule bending.

**What `routable` therefore owns**: the permission table, the derivation, and the write.\
Role derivation, visual layers, picking and validation consume those rather than being separate responsibilities of the pack.\
The boundary is smaller than the five-part version above BECAUSE the permission table absorbed the special cases.

**Still not designed**: how a pack contributes a write.\
That question is unchanged by this amendment -- the collapse is still the first one, and it is now gated by permission as well.
> **AMENDED 2026-09-27 by the director (stack interface, SD4): a pack is ONLY its table.** The routing pack no longer owns the role derivation or the write. The derivation belongs to the link layer (shared by browsers and the server, SD1). The write rules belong to the server's planner (SD2). Both read the pack's table. So "how a pack contributes a write" is answered: it does not. See "A device's capability pack is only a table" under the stack interface rulings below.

**Amended again 2026-09-22, ruled by the director: a node is a CORE plus packs, and a type is a composition.**

The core of a node is identity, position, and an anchor.\
Nothing else is universal: glyph, name, content, span and shape are all things SOME nodes have, so none of them belongs in the core.

Everything else is a capability pack, and **a named type is a composition of packs rather than a kind the core understands**.\
A `server` is not a thing the core knows about; it is `glyph(server)` plus a routing pack plus, eventually, what it does with packets.\
A `router` is a different composition, a load balancer another.

This collapses a question that looked like two.\
A per-type permission table and a registry of named pack variants are the same thing seen twice: asking what a server permits is asking which routing pack the server composition includes.\
One lookup, not two, and no per-type row free to drift into its own opinion.

It is also why the bare anchor disappears cleanly.\
It is not a special kind to be removed -- it is the composition with the fewest packs, and it stops being distinguishable rather than being deleted.

**Two families are in scope**: appearance (glyph, frame, content) and routing (which anchor variants a composition permits).\
Both are DERIVED and stateless, which is the property every rule in this system has so far held: two peers with the same document agree without exchanging anything.

**A third was raised and deliberately left out of scope**: policy, meaning permit or deny over packets and flows.\
It is named here only so the pack model is not designed in a way that excludes it.\
The hypothesis worth preserving is the director's: policy may be DERIVABLE the way routing is -- declare flow pairs on a control-plane graph and let the permissions follow deterministically -- which would keep it stateless rather than making it the first pack to carry per-instance configuration.\
Not designed, not ruled, and not to be assumed by anything built before it.

**Scope discipline.**\
This reaches the glyph table, the validator's closed type vocabulary, the CLI, and the `type` field of every stored document -- all downstream of a pack mechanism that does not exist and whose hardest question, how a pack contributes a write, is still open.\
So the model is RECORDED and the unification begins, but the claim that packs compose must be earned by composing two rather than asserted in advance.

**The ontology, ruled 2026-09-22 after the core was named wrongly once.**

This ruling first called the NODE the core, and that does not survive scrutiny.\
A node has a name, a glyph, a shape and a span, and none of those is universal -- a bare routing point has none of them.\
So "node" was doing exactly what "waypoint" had been doing: naming both the substrate and one dressed-up instance of it.

| term | what it is |
|---|---|
| **anchor** | the CORE. Identity, position, and the fact that links can reach it. Nothing else. |

> **AMENDED 2026-09-27 by the director (stack interface, SD11 and SD11b):** the core anchor is identity and position only. "The fact that links can reach it" moves into the network plugin, which contributes pipes, links, flows, their rules and the device tables. See "Pipes belong to the network plugin" under the stack interface rulings below.

| **pack** | one capability, composable onto an anchor -- `routable`, `glyph`, `framed`, `named`, `content`. |
| **composition** | a named set of packs, and what an author actually picks: `server`, `router`, `load-balancer`. |
| **node** | an anchor AND the entirety of its composition. A precise term, not a loose one -- what it is not is a LAYER: nothing sits between the anchor and its packs. |
| **waypoint** | RETIRED as a concept. An anchor carrying only `routable`. |

The test this passes and node-as-core failed: it explains the residue.\
Today a waypoint cannot hold a glyph and a node cannot be a junction, and neither restriction has a recorded reason.\
Under anchor-as-core both are the same omission -- two compositions built separately, each missing packs the other has.\
The disappearance is uniform too: `waypoint` stops existing because it is the anchor with only `routable`, and `node` stops being a kind for the same reason, being the anchor with `framed` and `glyph`.\
Neither is deleted; both become descriptions.

**THE IDENTIFIERS DO NOT MOVE YET.**\
`node` remains the id prefix, the validator kind, the CLI noun and the field in every stored document, now meaning "an anchor plus its composition".\
The ontology lives in the documentation and the identifiers lag it deliberately: renaming before the model is proven is how it gets done twice, and the id-grammar change is the irreversible step this ruling has flagged from the start.

**Appearance, and what is derivable.**\
Ruled: appearance divides into INTRINSIC -- glyph, the fit box, the colour tokens, the spec ladder, all type-supplied and irreducible -- and DERIVED, which is a function of what other packs have derived rather than a thing a pack declares.

A survey of every appearance site found the derived half exists exactly ONCE.\
`waypointLayers(roles, ext)` takes the derived role set and returns the layer list, and all three renderers walk it without re-deciding.\
Seventeen other sites derive a visual property from state, each a single owner rather than a shared derivation, and CSS already follows the same shape without being named as such: `.spawning`, `.on-selected-path`, `.selected` and `[data-unrevealed]` are classes minted from state with the stylesheet owning the colour.

So this half of the ruling is PRESCRIPTIVE, not descriptive.\
One instance exists and the rest is the target, and saying so is the difference between a rule and a claim about the code.

**How two derived appearances resolve, ruled 2026-09-22.**

A pack declaring a derived appearance carries two fields: **`composes`**, and a **priority**.

- `composes: true` -- it renders alongside the others, and priority is the z order.
- `composes: false` -- it competes, and the highest priority wins alone.

The case that forced it: a ROUTER holding `framed`, `glyph` and `routable` derives `endpoint` from the one link terminating on it.\
If `routable` simply owned the endpoint vocabulary, the router would draw a pad inside its own frame, over its own glyph.\
Nobody wants that, and the reason is worth stating: the endpoint pad is not what an endpoint looks like, it is what a BARE ANCHOR looks like when it is an endpoint.\
The marks exist because nothing else is drawing; a router already shows where it is and what it is.

So the glyph outranks the anchor marks with `composes: false`, and the pad is NOT EMITTED rather than drawn underneath.\
Drawn-underneath is invisible by accident -- it breaks the moment a frame turns transparent or a glyph shrinks -- and the rule should be that the marks are absent, not hidden.

Both behaviours already exist in the tree, which is why the mechanism is two fields rather than one rule.\
`.spawning` recolours the anchor marks from `entity.spawn` rather than replacing them: derived from document state, composing with what is already drawn.\
More are expected -- ports, flow direction, packet state -- and each is the same shape.

**Session state is NOT a pack, and does not compete with one.**\
Selection, hover, armed, ghost and the run-mode hides are session state: they live outside the document, are not derived from the graph, and are not part of any composition.\
They DECORATE whatever was drawn.\
This was got wrong once in the reasoning that produced this ruling -- selection brackets were offered as a counter-example to `composes`, which only worked by treating a non-pack as a pack -- and the boundary is recorded because that conflation is easy.

**A boundary case worth naming**: the socket grid.\
`showsSockets(opts)` is gated on a RENDER OPTION -- the client passes `sockets: mode === 'edit'` -- so it is mode-driven session state rather than a pack appearance, and it sits on the decorate side of the line.\
That it looks like a derived appearance, and is not one, is exactly why the boundary needs stating.

**One caution carried forward.**\
Priority as a bare integer is where this shape rots: two packs land on the same value, or one is inserted at 50 and silently reorders another.\
An ordered list of named layers avoids it and stays readable.\
Not ruled, because the first two packs do not need it.

**Resolution is PER-STATE, not per-pack.**\
The open question was what a router deriving JUNCTION should look like, and the answer came from a glyph the director drew long before any of this had a name: the router and the load balancer both carry a centre ring.

That ring does the job a junction mark does -- it marks the point where paths meet and something happens to them.\
So the glyph and the junction mark are not competing for one space; they are expressing the same fact, which is a different relationship from the endpoint case where the pad was merely redundant.

| derived state | glyph vs anchor marks | why |
|---|---|---|
| endpoint | glyph wins alone | the frame already says something terminates here |
| junction | the ring composes over the frame | nothing about a frame says flow meets and does something to it |

A pack therefore declares `composes` and priority PER DERIVED STATE rather than once for the whole pack.

**Hypothesis, not designed**: that the router's centre ring should come FROM `routable` when the anchor derives `junction`, rather than being drawn into the glyph.\
A router with one link would then show no ring, and one with three would -- the ring becoming a reading of the graph rather than decoration, and a static ring being the same kind of error as a stored role.\
Worth testing rather than assuming: a router that renders identically whether or not it is a junction would look wrong in a way a still image will not reveal.

More broadly the director has raised DECOMPOSING the glyphs themselves into dynamic visual mechanisms.\
That is deliberately not designed here.\
The order is the same discipline this ruling applies to the write: build the framework and the pipeline first, and glyph decomposition then becomes pack design rather than a change to the mechanism.

**Selection belongs to the grid**, not to a node or a pack.\
The layout owns which of the things inhabiting it are selected, which is why selection sits on the decorate side with hover and mode.

---
## Scrubbing a published connection code, 2026-09-22

**Ruled by the director**: rotate, then scrub, then force-push `main`.

`key` held a live connection code and was tracked rather than ignored, so three commits carried one to a PUBLIC repository.\
The first recommendation was to rotate and leave history alone, on the grounds that a rotated code is inert.\
That was wrong, and the correction is worth keeping: the reasoning holds for a private repository and fails for a public one.

A dead credential in a public repository is still evidence.\
It shows the format, the filename, and that codes get committed -- a template for the next one rather than a risk in itself.\
The string was already spent; the pattern was the exposure.

**Sequence.**\
Rotate first, because a scrub is not remediation -- treat a pushed secret as compromised from the moment it lands, whether or not the rewrite succeeds.\
Then `K1` for the rewrite, then `K2` for the publication, which is a separate decision with different inputs.

**Why the push was permitted.**\
Blast radius, not branch name: one contributor, zero forks, zero open PRs, no CI pinning a SHA.\
The only external references to the rewritten SHAs were B223's own rows, updated in the same change as `K2` condition 5 requires.

**What it does not do.**\
GitHub still serves orphaned commits by SHA after a successful force-push; removing them needs its support team.\
So the scrub stops casual discovery and is not a retraction, and reporting it as one would be false.

**The durable fix is the `.gitignore` entry**, not the rewrite.\
The rewrite cleans up one incident; the ignore stops the next.

**Evidence.**\
Verified by `K1`'s three checks -- zero occurrences across every ref, tip tree hash unchanged at `d2b99b8`, commit count unchanged at 431.\
The unchanged tree hash is the strongest of the three: it proves the rewrite touched history and nothing else.\
Pre-scrub tip `c03826b`, backup retained on the filesystem until the push is confirmed good.

---

## What a link does at a junction, and when a pipe under it goes -- ruled 2026-09-25

**Ruled by the director**, in the unification programme's design phase, after a bake-off of three candidate models for what a link is (`dev/design/unification/BAKEOFF-LINK.md`).\
These rule BEHAVIOUR -- what an author sees happen -- and not yet which model delivers it: the model is decided separately, after the leading candidate has been re-tested against these rulings.

**Drawing a new link to a point another link passes through cuts the passing link there.**\
Asked "When a new link ends where another link passes through, should that connect them?", the director chose "Yes, cut it there" over "Only if asked": the passing link is split at that point, and the three meet at a junction.\
This keeps today's behaviour and the director's earlier statement that drawing a new link to a bend converts it to a junction.

**Deleting one of three links at a junction joins the two that remain into one link.**\
Asked "After deleting one of three links at a junction, what happens to the two that remain?", the director chose "Join into one link" over "Keep as two links": the point becomes a bend.\
This re-affirms the 2026-09-22 reading at "The universal node, staged" -- deleting one makes it a bend -- and pairs with the ruling above: cut on landing, join on removal.

**When a pipe under a link is deleted and another route exists, the link re-paths.**\
Asked "When a pipe under a link is deleted and another route exists, what does the link do?", the director chose "Link re-paths" over "Link goes down": the link finds another way through the pipes and keeps its name and identity, so a link behaves as a logical circuit rather than a fixed physical cable.\
This answers the check question the director asked with survey Round 2 Q4 ("delete a pipe and watch a link between 2 nodes re-path?"), which had no recorded answer.

**What these do not rule.**\
Which model realises them (the bake-off's leading candidate, a link as a declared cable routed over pipes, failed exactly the first two behaviours as built, and is being re-tested with them); which half of a cut link keeps the original identity, and which name survives a join; and whether a link that cannot re-path goes down or is removed.

**Pipes are a visible layer -- ruled 2026-09-25.**\
After the re-test (`dev/design/unification/BAKEOFF-LINK.md`, addendum), asked "Are pipes something the author sees and works with directly?", the director chose "Yes, a visible layer" over "No, hidden plumbing": an author can see pipes, select them, draw and delete them, and links visibly run through them.\
It is consistent with the director's Round-1 survey pick that a noun earns a place when an author can see, name, select and act on it.\
The re-test's second judge made this the condition on which the leading model stays ahead of today's; the model itself is still decided separately.

**The link model: FR3 adopted as the model to design toward -- ruled 2026-09-25.**\
Asked "Adopt FR3 (links as cables routed through visible pipes) as the model to design toward?", the director chose "Adopt" over "More evidence first".\
A PIPE is a visible adjacency between two anchors, drawn, selected and deleted by an author.\
A LINK is a cable with its own identity, routed through pipes, which re-paths when a pipe under it is removed and is cut and joined as the rulings above describe.\
A FLOW is declared over links, and its path is derived.\
This adopts a DIRECTION for design and changes no code.\
The bake-off's measured costs of FR3 -- a link's memory of the route it was drawn along, which can make identical-looking states diverge; the number of records one edit rewrites; the cost of re-deriving routes at scale; and the round-trip cases where removing a landing does not restore the passing links -- are carried as the next design questions, not accepted as settled.

**A link returns to its drawn route -- ruled 2026-09-25.**\
Asked "When the deleted pipe is redrawn, where should the re-pathed link go?", the director was first unsure; after the proposer set out the three options and recommended one, the director chose "Back to drawn route" over "Stay where it is" and "Always the best route".\
The route an author draws is stored as the link's INTENT; the route it currently takes is derived from it -- the drawn route while all of its pipes exist, a detour while they do not -- and the link returns to the drawn route when it can.\
This makes explicit the route memory the bake-off measured as hidden state in FR3, and the detour can be shown to the author.

**A link with no route stays, shown as down, and heals -- ruled 2026-09-25.**\
Asked "When a link has no route left at all, what happens to it?", the director chose "Down, and heals" over "Removed": the link stays, keeps its name and drawn route, shows as down, and comes back when a route returns -- the same behaviour the director gave for a declared flow with no route in survey Round 2 Q4.

AMENDED 2026-09-29, for a deleted pin: a link that loses a pin with no other way is deleted whole, not left down -- see "A link that loses a pin with no other way is deleted whole" below.\
A link that loses its route any other way is still down, and heals; how it looks was ruled the same day -- dotted, "ready to heal".

**Draw-then-delete leaves no trace -- ruled 2026-09-25.**\
Asked, for two links passing through one point that a new link lands on and cuts, "After deleting the new link, should the two passing links be whole again?", the director chose "Yes, rejoin both" over "No, stay cut": deleting the landing rejoins each passing link into one, as before the landing.\
This generalises the join-on-removal ruling beyond three links meeting, and closes the round-trip failures the bake-off re-test measured (a landing on a point two links pass, then its removal, left four ends).\
Carried to design, not ruled: how the rejoin pairs the pieces -- which ends belong to which link when several were cut at one point.\
AMENDED 2026-09-30, for one case: a `w` link drawn beside a down link and then deleted leaves its anchor and pipes, with the down link healed over them -- the cost shown and accepted with "A w pipe goes when no link is on it or resolves onto it" below.

**A new link passing through a point where another link ends connects to it -- ruled 2026-09-25.**\
Asked "When a new link passes through a point where another link ends, should they connect?", the director chose "Yes, connect" over "No, pass by": the new link is cut at that point and the three meet at a junction.\
This is the mirror of the landing ruling above, so the order in which two links are drawn no longer decides whether they meet -- the re-test measured that it did, for the adopted model and today's.

**A server may have several links -- ruled 2026-09-25, amending the permission table of 2026-09-22.**\
Asked "Should a server be allowed more than one link?", the director chose "Yes, several links" over "Only an aggregate" and "No, one only": a server can have several independent links, such as redundant uplinks.\
The 2026-09-22 ruling that "a compute or server glyph permits endpoint alone" said that if a second link were ever legitimate, "the TABLE changes rather than the rule bending"; this is that change, and it lets a server take part in all four link relations.\
Not ruled here: whether a flow may pass THROUGH a server (forwarding), as against only starting or ending there.

**Two links passing through one point cross without connecting -- ruled 2026-09-25.**\
Asked "When two links both pass through the same point, do they connect there?", the director chose "No, they just cross" over "Yes, both are cut": both pass through untouched, like a crossover on a schematic, and links connect at a point only where one of them ENDS there (the landing and pass-through rulings above).\
This settles the register's PS205 (meeting against passing through) for links.\
The pipes at that point still meet as pipes -- two cables can share a conduit junction without being connected -- which is consistent with pipes and links being separate layers.

**Whether a link may pass through a device is decided by the device's capability pack -- ruled 2026-09-25.**\
Asked "Can a link pass through a device (host, firewall, load balancer, VXLAN), or does every device end the links that reach it?", the director answered in their own words: "Depends on the capability pack that restricts anchor routables.\
Most existing nodes will only support either endpoint or junction (or both)".\
So the capability pack in a node's composition restricts which routable roles its anchor may take -- endpoint, junction, bend -- as the director's earlier leaning described for routers; and most existing node types permit endpoint and/or junction but not bend, meaning a link reaching them ends there.\
Carried to design: the per-type table itself (which existing types permit which roles), and whether any type permits bend.

**A landing on a link that is on a detour cuts it where it is -- ruled 2026-09-26.**\
The FR3-v3 prototype (`dev/design/unification/BAKEOFF-LINK.md`, Addendum 2) applied the landing rule to a link's DRAWN route, so a new link ending on a visible detour left the detoured link passing through uncut.\
Asked "A link is on a detour because a pipe under it was deleted.\
You draw a new link that ends on that detour.\
Should it cut the link there?", the director chose "Yes, cut it where it is" over "No, cut the drawn route" (the proposer's recommendation) and "Detours avoid link ends".\
The option as worded by the proposer: the landing cuts the link on its detour, and the detour becomes its new drawn route, so the link forgets its old route and does not return to it when the pipe comes back.\
Not ruled here:
- whether a landing on the unused drawn route of a detoured link cuts it (the prototype does);
- whether deleting such a landing restores the old drawn route, under "draw-then-delete leaves no trace" above.

**A link's intent is its ends plus its pinned vias -- ruled 2026-09-26, refining "a link returns to its drawn route" above.**\
Raised by the director (`dev/design/unification/DISCUSSION-SEEDS.md`, S22): "links are either [src,dst] or [src,dst,[via..]] definitions. via would "pin" that anchor as a required hop and fail if it can't dynamic route across pipes to get there.\
[src,dst] can take any shortest path via pipes".\
Asked "Should a link's intent be its two ends plus its pinned vias, with everything between the pins routed by pipe cost?", the director chose "Yes, ends + pinned vias" over "No, the whole drawn line".\
A link stores its two ends and an ordered list of pinned vias.\
Between consecutive pins, its route is the cheapest path over the pipes.\
If a pin cannot be reached, the link is down and heals, as ruled above.\
What this does to the rulings above:
- "Returns to its drawn route" is no longer stored route memory. For a hand-drawn link, every bend dropped while drawing is a pin, and each leg lays a direct pipe, which is the cheapest way between its two pins; the link returns because of pipe cost (proposer reading, INFERRED).\
  CONFIRMED by the director the same day, for the pin half: "pressing "w" while dragging a link automatically creates an anchors and pins the link to that anchor (same behaviour as today)". The cost half is still the proposer's reading.
- A detour re-routes only the broken leg and still passes every pin. The FR3-v3 prototype instead re-routed the whole link and could skip its own bends.
- A link may be declared by its two ends alone and routed over the pipes. This is the same shape as a flow declared over links.

Carried to design, not ruled:
- how "cut it where it is" (above) reads here. A proposer reading: the cut point becomes an end of both pieces, and each piece keeps the pins on its side;
- what a link's route does when it passes a point where another link ends without being pinned or ending there (connect or cross). The director leaned "connects", while this definition was still open;
- what pipe cost is (hops, length, or a per-pipe weight), and how ties break.

**On its routed stretch a link crosses the points it passes; it connects only at its ends and its pins -- ruled 2026-09-26.**\
Asked "Between two of its pins, a link's cheapest route runs through a point where another link ends.\
That point is not one of its pins or ends.\
Do they connect there?", the director chose "No, it crosses" (the proposer's recommendation) over "Yes, cut it there" and "Route around link ends".\
The director had leaned "connects" (S22) on the question this replaces, before link intent was defined as ends plus pinned vias.\
The proposer gave the reason for recommending otherwise: if a link connects wherever its route happens to run, deleting and redrawing an unrelated pipe could leave a link cut in two for good.\
So routing never changes which links exist or where they meet.\
A link connects only where an author placed it: at its ends, at its pins, and where an author's act cuts it (the landing rulings above, including "cut it where it is" on a detour).\
The question set aside earlier, a landing on the old route of a detoured link, then reads this way (proposer reading, not asked):
- a pinned point is always on the link's route, so a landing there cuts it;
- an unpinned point the link no longer passes is not touched, and if the link's route later runs through it again, it crosses.

**Pipes a deleted link laid stay while another link uses them -- ruled 2026-09-26.**\
The FR3-v4 prototype (bench `link-bakeoff`, recorded in `dev/design/unification/BAKEOFF-LINK.md`) measured three answers.\
Asked "Drawing a link lays pipes along its way.\
When you later delete that link, what happens to the pipes it laid?", the director chose "Stay while another link uses them" over "They go with it" (the proposer's recommendation) and "They stay as ordinary pipes".\
When a link is deleted, the pipes its drawing laid are removed, except those another link is currently routed over, which stay.\
The costs shown with the option (MEASURED, options-acts): another link moves in 1.8% of deletions, against 4.0% under "they go" and 0.2% under "they stay".\
A pipe the author deleted comes back if a link is drawn along it and then deleted, in 94% of that construction (5,161 of 5,468).\
Not ruled here: whether a pipe kept this way then belongs to the author (deleted only by hand) or is removed once the last link using it goes.

AMENDED 2026-09-30: with pipes carrying one link each, no other link can be routed over a link's pipes while it exists, so the exception above cannot arise, and a deleted link's pipes go with it -- see "Pipes carry one link each, for now" below.

**Under pins, a cut on a detour keeps only the original bends -- ruled 2026-09-26, refining "a landing on a link that is on a detour cuts it where it is" above.**\
With link intent defined as ends plus pinned vias, "the detour becomes its route" could mean either that the whole detour is pinned or that each piece keeps only the original bends on its side.\
Asked, for the uplink r1-p1-p2-r2 detouring p1-q1-q2-q3-p2 and cut by a landing at q3, "What should the cut pieces keep as their route?", the director chose "Only the original bends" (the proposer's recommendation) over "The whole detour, pinned".\
The cut point becomes an end of both pieces, and each piece keeps the pins on its side.\
So:
- deleting the landing returns the link fully to its drawn route;
- a detour never becomes a set of bends, so a detour cannot decide where links meet.

The cost shown with the option (MEASURED, FR3-v4 probe E6 and measure-v4 construction cutPins-C1): when the missing pipe returns, a piece may move back towards its old route and share a pipe with its sibling.\
With the landing at q3 it moves; at q2 it stays.\
This supersedes the phrase in the earlier ruling's option text that the link "does not return to it when the pipe comes back": a piece returns as far as its own bends and new end allow.

**A cut link stays cut while another link still ends at the cut point -- ruled 2026-09-26.**\
The FR3-v4 adversary found this case (its defect 3), and the fix pass left it to the director.\
The literal draw-then-delete ruling says a deleted landing's cut rejoins.\
The mirror ruling says the order of drawing must not decide whether links meet.\
Asked "Link X is detouring through point w (no bend there).\
Y is drawn to w and cuts X. Then Z is also drawn to w.\
Now Y is deleted.\
Should X join back up at w, even though Z still ends there?", the director chose "No, stay cut while Z ends there" (the proposer's recommendation) over "Yes, join back up".\
The result of deleting a landing is the same as if that landing had never been drawn: Z's own landing cuts X at w, and Z meets X. The prototype already did this where w is one of X's pins.\
At a plain routed point, as built, it rejoined (959 times in the default fuzz, MEASURED), and that is now to be changed.

**A flow's path may pass through the same point twice -- ruled 2026-09-26.**\
Asked "A flow is routed over links.\
May its path pass through the same point twice?\
For example, S-X-M and M-X-T cross at X and meet at M. May the flow from S to T run S, X, M, X, T?", the director chose "Allow it" (the proposer's recommendation) over "Forbid it".\
The measurements shown with it (MEASURED, options-pins and measure-v4):
- allowing agreed with a full search on every flow the search could finish, and routed 90-96% of flows on random networks, against 81-94% if forbidden;
- 8-27% of flow paths then pass some point twice: through crossings, through junctions, and along a link that crosses itself;
- under "forbid", nothing built so far was both correct and fast. The exact search did not finish one flow in 240 s, and the fast search missed a real route in 1-5% of flows.

This also settles how the prototype's exponential flow search (v3 defect D1) is fixed: by a search that allows revisiting.

**A link's route may pass through a point it already passes, even its own end -- ruled 2026-09-26.**\
The FR3-v4 adversary found this case (its defect 4).\
It follows literally from "ends plus pins, with the cheapest way between them", because each leg is routed on its own.\
Asked, for link A-B bent at w whose cheapest way from A to w after pipe A-w is deleted runs through B (A-u-B-w-B), "is that allowed?", the director chose "Allow it" (the proposer's recommendation) over "No, the link shows down" and "Route around its own points".\
The cost shown with it (MEASURED, FR3-v4 adversary fuzz): a new link landing on a point such a link passes twice cuts only one of the two passes (140 landings).\
Flows along such a link work because flows may revisit (ruled above).\
AMENDED 2026-09-30: for a route that would run the SAME PIPE twice -- out and back, as B-w-B here -- the later ruling "A link never runs the same pipe twice" replaces this one, confirmed by the director (RULESET-AUDIT D2); passing a point twice along different pipes stays allowed.

**A join that would make a loop does not happen -- ruled 2026-09-26, an exception to "deleting one of three links at a junction joins the two that remain".**\
Asked, for 'top' A-u-P and 'bottom' A-v-P, where E is drawn to P and then deleted, "Should they still join?"\
(joining would make one loop, A-u-P-v-A), the director chose "Don't join; keep both" (the proposer's recommendation) over "Join anyway".\
Both links keep their names, a flow from A to P keeps running, and P stays a point where two links end.\
The measurements shown with it (MEASURED, options-join, under the reading where R2 joins): this came up in 47 of every 1,000 deletions.\
"Join anyway" made 84 loop links and lowered the draw-then-delete no-trace rate from 84% to 80%.\
The earlier prototypes' wider exception, "a join whose route would revisit an anchor", is narrowed by this ruling and the link-revisit ruling above.\
A join is refused when it would make a loop of the link's own stops.\
It is not refused because a routed stretch passes a point twice.\
That reading is the proposer's (INFERRED): the question asked was only the loop case.

**A join of two links carrying different channels (VLANs) does not happen -- ruled 2026-09-26, a second exception to the join-on-removal ruling.**\
Asked, for A-P 'red' carrying VLAN 10 and P-B 'blue' carrying VLAN 20, where E is drawn to P and then deleted, "Should they join into one link that carries both?", the director chose "Don't join; keep both" (the proposer's recommendation) over "Merge into one".\
Each link keeps its own VLAN and name, and P stays a point where two links end.\
This came up in about 3 of every 1,000 deletions (MEASURED, options-join).\
Two links carrying the same VLAN were already never joined.

**Two separately drawn links left alone at a point join into one -- ruled 2026-09-26, keeping the join-on-removal ruling ahead of "draw-then-delete leaves no trace" in this case.**\
The two rulings pull apart when A-P ('red') and P-B ('blue') are drawn as separate links, and E-P is then drawn and deleted.\
The join ruling was asked about exactly this shape: one of three links at a junction is deleted.\
The draw-then-delete ruling was asked about a landing that cut passing links; only its headline wording reaches this case.\
Asked "Should red and blue end up as one link A-P-B, or stay as two?", the director chose "Join into one" (the proposer's recommendation) over "Stay as two".\
When a removal leaves exactly two links ending at a bare point, they join, subject to the loop and VLAN exceptions above.\
Today's product does the same: `server/txn.mjs` collapses at a waypoint whenever a removal leaves exactly two links there, and never when a link is created (READ).
> **CORRECTION 2026-09-27.** The description of today's product in the sentence above is incomplete. The FR3-v5 audit found this, and the proposer re-read the code. `collapseAtWaypoint` (`model/invariants.mjs`, around lines 152-190) also refuses a pair that would make a self-link (a loop), a pair whose declared directions both arrive or both leave, a pair mixing a control link with a data link, and a closed link. The B239 guard in `server/txn.mjs` refuses a merge whose result would be invalid. The ruling was made on the shorter description. Whether the plane and direction refusals also apply under this ruling was then put to the director as a separate question.\
The cost shown with it: here, draw-then-delete is not traceless.\
Whenever the join happens, the two drawn links become one and one name is lost; the exceptions block the join in about 1 in 5 of these cases (MEASURED, options-join).

**How pieces pair on rejoin: settled by the rulings above, not asked (proposer reading, 2026-09-26).**\
This was the prototype's open item I4.\
It is recorded as settled by existing rulings, and the director may reopen it.
- When a landing that cut several passing links is deleted, the draw-then-delete ruling says each passing link is whole again "as before the landing". So the pieces pair as they were cut (lineage). Pairing straight-through by geometry restored the originals in only 1.9% of turning cases (MEASURED, options-join).
- When other links still end at the cut point, the stay-cut ruling above keeps the pieces cut. That covers a piece deleted and redrawn while cut.
- The join ruling fires only when a removal leaves exactly two links at a point. So four or more ends that did not come from one cut are not paired at all.

**A join keeps the earlier-drawn link's name and identity -- ruled 2026-09-26.**\
Asked, for 'left' A-P and 'right' P-B joining into A-P-B when E-P is deleted, "When two separately drawn links join into one, whose name does the joined link keep?", the director chose "The earlier-drawn link's" (the proposer's recommendation) over "The later-drawn link's".\
The joined link is 'left', and 'right' is lost.\
Across the options-join fuzz, 39 of 3,270 named links at risk lost their name this way (MEASURED).\
A rejoin of pieces that one cut split is separate: it restores the original link's name and identity, under the draw-then-delete ruling.

**When a link is cut in two, the longer piece keeps its name and identity -- ruled 2026-09-26.**\
Asked, for 'trunk' A-W-u-B cut at W into A-W and W-u-B, "When a link is cut in two, which piece keeps the link's name?", the director chose "The longer piece" (the proposer's recommendation) over "The piece at the first end" (the prototype's behaviour) and "Neither; both pieces are new".\
On a tie, the piece at the link's first end keeps it.\
The proposer's reason: the author can see which piece is longer, but not which end the link was drawn from.\
All three answers give 'trunk' back whole if the landing is deleted, as the draw-then-delete ruling requires.\
In the options-acts fuzz, the name stayed visible in every cut under this answer (704 of 704, MEASURED).\
Not ruled here: whether "longer" is counted in pipes or in grid length.\
The prototype counted route length.

**Deleting one piece of a cut drawing deletes only that piece -- ruled 2026-09-26.**\
A line drawn through a point where another link ends is cut there (the pass-through ruling), so one drawing can become several links.\
Asked, for a spur W-C and a line A..B drawn with a bend at W (cut into A-W and W-B), "Later you select A-W and delete it.\
What goes?", the director chose "Only that piece" (the proposer's recommendation) over "The whole line you drew".\
The author deletes what they selected.\
A-W goes, and W-B then joins the spur into one link B-W-C under the join ruling.\
The costs shown with it (MEASURED, the FR3-v4 builder's fuzz, which the model's author wrote): deleting each piece in turn gave the old page back in 58% of cases, against 90% for the whole line.\
The drawing's returned reference then names B-W-C.\
Not ruled here: whether a "delete the whole drawing" command exists alongside, and what it removes once a piece has joined another link.

**While its members are cut, a bundle lists nothing and shows down -- ruled 2026-09-26.**\
Asked, for a LAG of two links A-X-B that a new link E cuts at X, "While they're cut, what should the bundle list as its members?", the director chose "Nothing; shown down" (the proposer's recommendation) over "All the pieces" and "The original links by name".\
A bundle never lists a member that does not run end to end between its ends, so what it shows is always true.\
When the landing is deleted, the bundle gets its members back, as the draw-then-delete ruling requires.\
The cost shown with it (MEASURED, options-acts): bundles were empty in 35% of states, against 10-12% for the other two answers.

**Deleting a point a link bends at removes that bend from the link -- ruled 2026-09-26.**\
Asked, for link A-w-B with another way A-x-B open, "You delete the point w itself.\
What happens to the link A-w-B?", the director chose "Forget that bend" (the proposer's recommendation) over "Stay, shown down" and "Cut the link at w".\
The pin is dropped from the link's intent, and the leg routes directly between its neighbouring stops by cost.\
The measurements shown with it (MEASURED, options-pins):
- the link stayed up in 95-98% of cases;
- its intent changes for good, so if w comes back the link does not return to it, and it behaves differently from a link that never lost w in 81% of later edits.

Today's product also drops a deleted point from a link (`server/txn.mjs`, READ).\
It also deletes the link if that would duplicate an existing straight link; that case is not ruled here.\
The proposer noted that "Stay, shown down" is the literal reading of the director's "fail if it can't dynamic route across pipes to get there" (S22).\
The director ruled that an author deleting the point is removing the stop, which is a different case from a stop that cannot be reached.

AMENDED 2026-09-29, where no other way exists: the link is deleted whole rather than routed "by cost" over nothing -- see "A link that loses a pin with no other way is deleted whole" below.\
With another way open this ruling stands unchanged.

**A cut link stays cut while another link ends at the cut point, even when that link was there first -- ruled 2026-09-27, settling "a cut link stays cut while another link still ends at the cut point" above.**\
That ruling's heading ("stays cut") and its gloss ("the same as if that landing had never been drawn") agree when the other link lands after the cut.\
They disagree when the other link, Z, already ended at w and the cut link, X, only crossed Z there by routing.\
FR3-v5 had built the gloss.\
Asked "Z already ends at point w.\
X's route passes through w and just crosses Z there.\
Now Y is drawn to w, so X is cut there and X, Y and Z all meet.\
Then Y is deleted.\
What happens to X?", the director chose "Stays cut, meeting Z" (the proposer's recommendation, revised after the FR3-v5 audit) over "Joins back up, crossing Z again".\
So what happens to X depends only on what is on the page now.\
It does not depend on whether Z was drawn before or after X's route came through w, and the model keeps no per-cut list of the links that already ended there.\
The costs shown with the option:
- here, drawing and deleting Y leaves a trace: X and Z now meet where before they only crossed. It changed the result in about 15% of measured round trips: 1,507 of 10,677 in stream A and 1,880 of 10,326 in stream B (MEASURED, measure-v5).
- the answer not chosen kept a hidden list for each cut: 7,269 KiB where 1,000 links cross a point and 1,000 end there.

The gloss "as if never drawn" therefore holds only when no other link ends at the cut point.

**Deleting a point a landing cut a link at keeps the cut link: the cut is undone first -- ruled 2026-09-27.**\
Asked, for X on A-w-B with another way A-k-B, cut at w by Y, "Now you delete the point w itself.\
What happens to X?", the director chose "X survives, rerouted" (the proposer's recommendation) over "X's pieces go too" (FR3-v5 and today's product).\
Y goes, because it ended at w.\
X is joined back up, and then loses w as any link passing through it would: it reroutes by cost, or drops w if w was one of its pins (the delete-bend ruling above).\
Deleting Y and then w, or deleting w directly, gives the same result.\
Links that simply ended at w still go with it, as today.\
This differs from today's product, which deletes every link ending at a deleted waypoint (`server/txn.mjs`, READ).\
Not built yet.\
The rate (119 of 1,055 point deletions touched a cut link) comes from the brief writer's unsaved run and is UNVERIFIED.

**Pipes laid automatically with a link live only while links use them; only pipes placed by hand remain without links -- ruled 2026-09-27, completing "pipes a deleted link laid stay while another link uses them" above.**\
Asked, for pipes A-u and u-B laid by L1, kept after L1's deletion because the declared link L2 runs over them, "Now delete L2.\
What happens to those pipes?", the director answered in their own words: "They go - any pipes laid automatically with a link, will be removed when there are no links remaining.\
Only pipes manually placed remain without links."\
So there are two kinds of pipe:
- a pipe laid automatically by drawing a link is removed once no link remains on it;
- a pipe the author placed by hand stays until the author deletes it.

FR3-v5 had instead handed a kept pipe to the author once no living drawing claimed it.\
Proposer reading, not asked: a DOWN link whose intent runs along a pipe counts as a link remaining on it, so its own legs are kept and it heals onto them.\
FR3-v5 already keeps those pipes: 52 of 2,934 and 96 of 2,644 candidate pipes in measure-v5.

**"Longer" means longer on screen -- ruled 2026-09-27, refining "when a link is cut in two, the longer piece keeps its name and identity" above.**\
Asked, for 'trunk' A-W-u1-u2-B, where A-W is one 20-unit pipe and W-u1-u2-B is three pipes totalling 6 units, cut by E at W, "Should 'longer' mean longer on screen, or more pipes?", the director chose "Longer on screen" (the proposer's recommendation) over "More pipes" (FR3-v5's choice).\
A-W keeps 'trunk'.\
On a tie, the piece at the link's first end keeps it, as before.\
The costs shown with it:
- not built;
- compared with FR3-v5, a different piece keeps the name in about a third of cuts: 724 of 2,186 (stream A) and 637 of 1,932 (stream B), MEASURED on the fuzz's evenly spaced grid;
- route cost still counts pipes, so the two measures can disagree.

The figure shown on 2026-09-26 (704 of 704) was counted in pipes.\
Not ruled here: whether route cost should move to on-screen length too.\
It is still an open engineering choice.

**A link carrying a VLAN does not join a link carrying none -- ruled 2026-09-27, widening "a join of two links carrying different channels does not happen" above.**\
Asked, for 'red' A-P carrying VLAN 10 and 'blue' P-B carrying no VLAN, where E-P is drawn and then deleted, "Should red and blue join into one link carrying VLAN 10 all the way?", the director chose "Don't join" (the proposer's recommendation) over "Join, and VLAN 10 covers it" (FR3-v5's behaviour).\
Each link keeps its own name and what it carries, and no VLAN spreads because a different link was deleted.\
The consequence shown with it: a link carrying any VLAN never joins another link under the join ruling, and only the pieces of its own cut rejoin.\
That needs its own rule, because while such a link is cut only its longer piece carries the VLAN.\
It differs from today's product's treatment of a link with no declared direction, which takes the other link's direction when two links merge (`model/invariants.mjs`, READ).

**Control and data links, and links whose directions meet head-on or split, do not join -- ruled 2026-09-27, keeping today's refusals under the join ruling.**\
Asked "Should they still join if one is a control link and the other a data link, or if their declared directions both point into the point (or both out of it)?", the director chose "Don't join, as today" (the proposer's recommendation) over "Join them anyway".\
These are the refusals `collapseAtWaypoint` already makes (see the correction under the join ruling above).\
The point stays a junction, as today's two-link matrix reads it (`kernel/geometry.mjs`, READ).\
The cost shown with it: two more exceptions to the join rule, and their rate is unmeasured, because no bench model has planes or directions.\
So the exceptions to "two links left alone at a point join" are:
- a join that would make a loop;
- two links carrying different channels, or one carrying a VLAN and one carrying none;
- a control link with a data link;
- directions that both arrive or both leave.

**A bundle goes with a deleted end point -- ruled 2026-09-27.**\
Asked, for a bundle (LAG) between A and B whose members end at A, "You delete point A ... What happens to the bundle?", the director chose "It goes too" (the proposer's recommendation) over "It stays, empty and down" (FR3-v5's behaviour, where nothing could refill it).\
This is the same as a link ending at a deleted point, which goes in FR3-v5 and in today's product.\
Not built and not measured.

**After a partial rejoin, the longer piece on screen carries the name -- ruled 2026-09-27.**\
Asked, for 'trunk' cut at n2 and n3 by two new links, where the link at n2 is deleted and the pieces either side of n2 join back up, "Now there are two pieces, split at n3.\
Which one should carry 'trunk'?", the director chose "The longer one on screen" (the proposer's recommendation) over "Wherever it already is" (FR3-v5's behaviour).\
The name goes where it would be if the deleted landing had never been drawn: the pieces on the page now decide, by the "longer on screen" rule.\
The cost shown with it: the name can move to the other piece at n3, a point the author did not touch.\
Under FR3-v5's behaviour, the same picture showed the name on a different piece depending on the order of cuts: 190 of 4,915 (stream A) and 152 of 4,558 (stream B) two-cut round trips (MEASURED, measure-v5).\
Not built.

**A piece made different while its link is cut stays a separate link -- ruled 2026-09-27.**\
Asked "Y has cut link X in two at w.\
While it's cut, you make one piece different: you give it its own VLAN, or make it a control link.\
Then you delete Y. Should the two pieces join back into X?", the director chose "No, they stay two links" (the proposer's recommendation) over "Yes, and the change covers all of X" (FR3-v6's behaviour for a VLAN) and "Yes, as the original X; change dropped".\
The page decides: two links that differ in VLAN, plane or direction do not join, as for any two links (the VLAN, plane and direction rulings above).\
What the author set stays where it was set.\
The costs shown with it (MEASURED, adversary fuzz on FR3-v6 and the FR3-v6 brief audit):
- deleting Y leaves two links where there was one;
- deleting the point w later removes both pieces rather than keeping X. X survived in only 1 of 392 such cut points.
- not yet built for a VLAN on one piece, where 550 fuzz cases would change.

Carried to design: a plain piece of a cut VLAN link must still rejoin its own sibling (:640).\
Telling that apart from a piece given its own VLAN needs the pieces' state at the cut, which is lineage.

**A down link keeps the laid pipes along its own drawn legs -- ruled 2026-09-27, confirming the proposer's reading of "removed when there are no links remaining".**\
Asked, for L2 declared from A to B over another link's laid pipes and down after pipe A-u is deleted, "While L2 is down, do its other laid pipes count as having a link remaining, so that redrawing A-u brings L2 back?", the director chose "Keep a down link's own drawn legs" (the proposer's recommendation) over "Keep nothing for a down link" and "Keep the pipes it last ran over".\
A down link counts as remaining on the laid pipes along its own drawn legs, so a hand-drawn link heals when the deleted pipe is redrawn.\
No last route is remembered.\
The costs shown with it (MEASURED, one instrument on one small grid):
- a link declared by its ends has no drawn legs, so the laid pipes it ran over go while it is down, and it may not come back when the deleted pipe is redrawn (10 of 615);
- a declared link and a drawn link on the same route therefore behave differently once down;
- the answer not chosen that kept everything needed stored last-route memory, which the pin ruling had removed.

## The stack interface -- ruled from 2026-09-27

**Ruled by the director**, in the design phase that follows the link model.\
The questions were prepared from the problem-space register, the rulings and a map of today's code.\
An independent audit checked them before they were asked (workflow run wf_61107120-ccf; the prepared sequence and its audit are kept outside the repository in the stack-design bench).\
Each question is asked on its own, in the prepared order.

**Browsers and the server work out what the document implies; the CLI asks the server -- ruled 2026-09-27 (SD1).**\
Asked "Who works out what the document implies: a link's current route, whether it's down, each point's role, a flow's path?", the director chose "Browsers + server; CLI asks" (the proposer's recommendation) over:
- "Every peer; CLI downloads the code";
- "Every peer; CLI ships the code";
- "Only the server; it sends results".

The browsers and the server run one shared body of derivation code.\
The CLI stays a plain HTTP client, which it was built to be (`dev/design/unification/DISCUSSION-SEEDS.md` S20, sub-question 3), and reports what the server worked out.\
The costs shown with it:
- the server needs new read endpoints for derived state (today REST returns no roles);
- the CLI cannot derive offline;
- derived results travel to agents, which VISION's "a consequence is never sent" does not foresee.

Today the answer is mixed: browsers derive waypoint roles, and the CLI reports none (the stack-design code map, probe P5).\
It reads the director's S19 ("derivation can occur client-side ... pushed out to the edge/browser") as covering browsers and the server, not the agent's CLI.

**The rules that react to an edit run at the server for every door, and the browser previews them with the same code -- ruled 2026-09-27 (SD2).**\
Asked "Where do the rules that react to an edit run: cutting a link another link lands on, joining two links left alone, rejoining, clearing laid pipes, deciding which piece keeps a name?", the director chose "Server, with browser preview" (the proposer's recommendation) over "Server only" and "Today's split".\
The server's planner applies the rules for every door (browser, CLI, REST), so an act gives the same document whichever door made it.\
The browser runs the same rule code to show the result at once, then takes the server's answer.\
The costs shown with it:
- a preview that differs from the server's answer, for example on minted ids, is corrected;
- the tab must accept server results that share a key with its own ops, so B242 must be fixed first.

This answers B243 (a landing through REST or the CLI is not cut) and the register's PS314 and PS320.\
It keeps the direction of BOARD H15.2 ("share, not mirror").

**A device's capability pack is only a table -- ruled 2026-09-27 (SD4), amending "What `routable` therefore owns" (2026-09-22) in place.**\
Asked "The 2026-09-22 ruling gives a device's routing pack three things: its table of allowed roles, working out the roles, and writing the changes.\
Should a pack instead be only the table, with the link layer and the server's rules reading it?", the director chose "Only a table" (the proposer's recommendation) over "Table + rules, as ruled" and "Table + proposals".\
A pack is data: which routable roles (endpoint, junction, bend) a device type allows.\
The link layer's derivations and the planner's rules exist once and read every device's table.\
The costs shown with it:
- a device can add new behaviour only as a new column in the table plus code that reads it, so the director's leaning that "packs can extend anchor behaviour too" (S12) waits for that route;
- a load balancer's fan-out may force a further amendment;
- the table must be passed into `kernel/`, `model/` and `server/`, which import nothing from each other (the stack-design code map, constraint C9).

**Whether a flow may pass through a device is set by the device's table -- ruled 2026-09-27 (SD6), answering "Not ruled here: whether a flow may pass THROUGH a server" (2026-09-25).**\
Asked "May a declared flow pass through a device where links meet?", for a flow H1 to H3 whose only way runs through server X (with two uplinks) and switch S, the director chose "Device table decides" (the proposer's recommendation) over "Any meeting point passes" and "Not yet; bare points only".\
Each device type's table gains a yes/no column for letting flows pass through; a flow's derived path reads it.\
The contents are left to the per-type table, still carried to design; the illustration offered was routers and switches yes, servers and hosts no. The costs shown with it:
- every type needs this second setting;
- fan-out such as load balancing cannot be a yes/no, and waits for the behaviour design;
- a server where several links meet is a junction at the link layer yet passes no traffic, so link roles and forwarding separate (register PS207).

**At most one pipe joins any two anchors -- ruled 2026-09-27 (SD7).**\
Asked "Can two pipes join the same two anchors?", for switch S and router R joined by two physically separate conduits, the director chose "No: one pipe per pair" (the proposer's recommendation) over "Yes: pipes get their own ids".\
A pipe is named by its two anchors, and parallel cables share it.\
This confirms the director's leanings "a wire's spec is just its two anchors" and "parallelism lives above/abstracted over wires" (S15).\
A pipe's stored form is its pair plus how it was laid (by hand or with a link).\
The costs shown with it:
- two diverse conduits need an extra anchor;
- links sharing a pipe draw on top of each other until a parallel renderer exists (`kernel/engine.mjs`, the deferred parallel realizer).

AMENDED 2026-09-30: "parallel cables share it" is suspended until concurrent links can be drawn -- see "Pipes carry one link each, for now" below.\
The cost listed above is what that ruling removes.

**A pipe may join any two anchors as a straight line, diagonals included -- ruled 2026-09-27 (SD8).**\
Asked "Must a pipe run straight along a grid row or column?", for anchors at (0,0) and (3,4), the director chose "Any two anchors, straight" over "Row or column only" (the proposer's recommendation) and "Any two, with an auto corner".\
This keeps today's actual behaviour.\
The store accepts diagonal segments (stack-design code map, probe P1), and nothing calls the GRC `ortho` check.\
`docs/spec/ATOMICS.md`'s "manual links are orthogonal" does not describe the product, and is to be corrected with this ruling.\
So "longer on screen" (above) is Euclidean length, computed with `Math.sqrt` (B176), not grid length.\
The cost shown with it: lengths are square roots, so two routes of equal true length may not compare equal.\
`Math.sqrt` and the four operators are exact IEEE 754, so every peer computes the same comparison (INFERRED from B176's note in `kernel/router.mjs`), provided sums are formed in one fixed order.

**Route cost is the number of pipes -- ruled 2026-09-27 (SD9), answering "what pipe cost is" (carried to design 2026-09-26).**\
Asked "When a link or flow is routed over pipes, what makes one route cheaper?", for a detour of 3 short pipes (10 units on screen) against 2 long pipes (30 units), the director chose "Fewest pipes" over "Shortest on screen" (the proposer's recommendation) and "A weight you set per pipe".\
A route takes the fewest pipes.\
Ties still go to one fixed order that every peer computes, as the prototypes' symmetric tie-break does (FR3-v5 onward: naming the ends the other way round changes 0 of 965 routes, MEASURED).\
The cost shown with it: routes count pipes while "which piece keeps the name" counts on-screen length, so the two can disagree.\
The prototypes' measurements already use this unit.

**A declared flow is part of the document -- ruled 2026-09-27 (SD10).**\
Asked "Is a declared flow part of the document, which every viewer sees, which is exported, and which undo removes like any edit?", the director chose "Part of the document" (the proposer's recommendation) over "A saved selection" and "Session only".\
A flow is stored as its two ends, versioned and undoable like any edit; its path is derived (SD1).\
Every door and every export sees it.\
This confirms the director's S14: "a link, path or flow config would need to have some entity persisted into the document (minimal entity/spec) such that the derivation can actually occur".\
The costs shown with it:
- a new stored kind across every closed kind list and the id grammar, a lasting change to the document format that spends the one-way-door budget (AX6) the director has not yet set;
- `link.flow`, today a link's declared direction, must be renamed to end the collision (naming deferred).

**The network is built as a plugin now -- ruled 2026-09-27 (SD11).**\
Asked "In this phase, should any of the network (pipes, links, flows and their rules) be built outside the engine as a plugin, or all inside it, with the plugin line drawn later when a second, different kind of world needs one?", the director chose "Yes: a network plugin now" over "Not yet: inside, as layers" (the proposer's recommendation).\
Links, flows, their rules and the device tables form a network plugin now.\
This follows the director's leanings: "plugin is the distribution unit, contributing packs and stages" (S21), and the Kubernetes analogy for stages as capabilities (S12).\
Under the director's rule of 2026-09-01 (`dev/BOARD.md`), "no premature abstraction, unless the work IS the abstraction", this makes the plugin surface part of the work.\
The costs shown with it:
- the plugin contract is designed around a single plugin;
- every closed kind list and the id grammar must read from the plugin (stack-design code map, C1);
- the single-writer scan must cover the plugin's rules (C2);
- the anchor's core definition, "the fact that links can reach it" (above, "a node is a CORE plus packs"), holds only while the network plugin is present, and is amended by the next ruling.

**Pipes belong to the network plugin; the core is anchors in space -- ruled 2026-09-27 (SD11b), amending the anchor definition in place.**\
Asked "With the network as a plugin: are pipes part of the engine's core, or part of the network plugin?", the director chose "In the network plugin" (the proposer's recommendation) over "Pipes in the core", their own earlier tentative leaning ("perhaps pipes cost nothing as core", S21).\
The core is anchors: identity and position.\
The network plugin contributes pipes, links, flows, the rules that react to edits, and the device tables.\
A world without connections, such as towers that act by range (S21's separating question), carries no pipes.\
The costs shown with it:
- the core has no notion of connection at all;
- the anchor's core definition is amended in place (above);
- today's movers, which ride links, depend on the network plugin (INFERRED from `dev/design/unification/DISCUSSION-SEEDS.md` S21).

**Each document lists the plugins it needs -- ruled 2026-09-27 (SD12).**\
Asked "Should each document list the plugins it needs?", the director chose "Yes, listed now" (the proposer's recommendation) over "Not until a second plugin" and "Listed, fixed at creation".\
Each document lists its plugins.\
A peer lacking a listed plugin refuses the document, following GR8's "a document that cannot be told apart from a valid one must be REJECTED" (INFERRED that it applies).\
Changing the list is an undoable edit.\
This confirms the director's S20: "a document should declare its required packs.\
Delivered via the server and in sync per document".\
The costs shown with it:
- a new field in every document, a lasting format change (AX6);
- with one fixed plugin set, no peer can differ yet, so the refusal path has no real case to test.

**Held, not asked yet (2026-09-27):**
- **SD3, whether the document keeps the history the rejoin and naming rules read** (which pieces one cut made; which link was drawn first). Held for the FR3-v7 round's measurement of a rejoin with no memory.
- **SD5, whether an act that would make a device take a forbidden role is refused or cut.** It can arise only once a pin may name a device, which is the id-prefix one-way door (the universal node rulings above), so it is held until that door.

**Every change to the stored document format lands as one named batch, last -- ruled 2026-09-27, answering survey flag F6 (AX6, the one-way-door budget).**\
The rulings above change how every diagram is stored:
- pipes as a stored kind (the adoption of FR3);
- stored flows (SD10);
- a plugin list in every document (SD12);
- possibly lineage records and a creation order (SD3, held);
- the rename of `link.flow`.

Asked how those irreversible changes to the 38 live diagrams should be spent, the director chose "One named batch, last" (the proposer's recommendation) over "Each with its feature" and "Trim the list first".\
All stored-format changes go into a single listed conversion, applied once, after the new behaviour is proven on the bench and in tests.\
This is AX6's "few, named, and last" (`dev/surveys/unification-survey.md`).\
Under the standing rule, the conversion itself is deleted after it runs ("transform once, then delete the transform").\
The cost shown with it: the new behaviour cannot reach live diagrams until the batch lands.

**The lab canvas: a minimal client composition over real code modules -- directed 2026-09-27.**\
The director proposed "a sovereign cut-down version of our app purely for anchor+routing pack validation": a single fixed canvas, with no multiple documents, no storage, and none of the menu icons, bars, status or SSO.\
It would be "a minimal kernel of a visual canvas to use 'w', 'f', 'k' and other related visual testing", which "might also be helpful at cutting decoupled modular boundaries of the real packs using real code".\
Asked what the lab should run first, the director chose real code, in their own words: "one thing I'm keen to do is properly cut the seams/boundaries such that we don't load any code that is unnecessary.\
This work will allow us to re-architect the real production app and backport and gains we develop.\
One goal will be - just how minimal / efficient with proper soveriegn / deduped boundaries can we make this?\
Perform a full axiom audit if it would help.\
This then essentially becomes a "minimal" client system composition over real code modules - and we will re-build and re-integrate into the production service when we are ready".\
So the lab:
- is built from the real modules, mounted rather than forked, with an in-memory document and the real planner running locally;
- loads nothing it does not need;
- has sovereign, deduplicated boundaries, enforced by scanners;
- its gains are carried back into the production app, which is later rebuilt on the same composition.

The work is milestone H17 on `dev/BOARD.md`.\
It begins with a measured baseline of what the app loads, and an axiom alignment audit (mission-kit M7) of the module boundaries.

**H17 lab decisions -- ruled from 2026-09-27.**\
These were prepared by the H17 audit and design workflow (run wf_a40c7406-192), whose measured baseline, seam map, axiom audit (M7), design, independent review and brief are kept in the lab-design bench outside the repository.\
The cut ids (K0-K18) refer to that brief.

**H17-D1: the lab lives in a `lab/` folder in this repository.**\
The director chose "A lab/ folder in the repo" (the proposer's recommendation) over "Outside the repository" and "Inside the product, at /lab".\
The gate scans it and runs its tests on every push.\
It is never deployed, because the Dockerfile copies named folders only.

> **AMENDED 2026-09-28 by the director: the lab IS deployed, to its own hostname.**\
> The original three options were about WHERE THE FOLDER LIVES. "Never deployed" was recorded as a consequence of the Dockerfile copying named folders, not as a decision that was weighed -- deploying the lab was never put to the director, so this amends a by-product rather than reopening a ruling.\
> The director's reasoning: a minimal app with no menus, icons, logins or IAP is safe to expose because it stores nothing and everything is client-side.\
> That is stronger than it first appears, because H17-D8 already rules the planner runs IN THE PAGE. A deployed lab therefore carries no `Store`, no `Hub`, no `Locks`, no principals and no agent door -- there is no API behind it to reach and nothing to authorize. It is static files and a page, which is a different risk surface rather than a smaller copy of the product's.\
> **Two conditions attached, and both were the proposer's.**\
> First, a SEPARATE SERVICE at **`lab.apnex.io`** (the director's choice over `draw-lab.apnex.io` and `canvas.apnex.io`), never a `/lab` path on the product. A path would put unauthenticated content inside the IAP perimeter and give the application a second door, which is the "footgun wearing a door's clothes" that `AGENT_DOOR` in `server/app.js` already warns against. A sibling hostname needs no new certificate, because the deployment holds a wildcard -- recorded in the deploy runbook, which is kept outside this repository.\
> Second, **G12 still holds** -- lab evidence is never cited as production proof. Deploying makes the lab more visible and more tempting to cite, so the guardrail matters more rather than less.\
> What it buys, beyond convenience: A5 perceptual parity. The director and the agent currently cannot look at the same canvas, because `/ws` is IAP-only and the agent holds a CLI key -- which is exactly why K1's browser half could not be verified live earlier the same day. A deployed lab is a surface both can reach.\
> Cost: `COPY lab/` in the Dockerfile, a second service and its own build. Small, and H17 cut K9 already anticipates one static responder serving both.

**H17-D2: each finished cut ships to production as it lands.**\
The director chose "Ship each cut as it lands" (the proposer's recommendation) over "Hold on a branch until the rebuild".\
Production gets lighter step by step, each step behind its own tests. 23 of the 26 planned cuts land on main as they are made.\
The exceptions are the lab itself (K10, never deployed) and the two cuts that wait for the rebuild (K13d, K18b).\
The five that change what a user sees are each a registered defect or a ruling: K1 (B242), K14a (B244), K14b (B245), K15 (B246) and K18a (B243, SD2).
> **CORRECTED 2026-09-27 (second M7 pass, C10).** K10, the lab, also lands on main, because H17-D1 puts `lab/` in this repository; it is the one cut never deployed. So 24 of the 26 cuts land on main as they are made, and 23 of them reach production. Only K13d and K18b wait for the rebuild.

**H17-D3: the tab takes the server's full answer, then replays its own unanswered edits on top (the fix for B242).**\
The director chose "Take answer, replay yours" (the proposer's recommendation) over "Take additions except your fields" and "Take additions as they arrive" (the fix `dev/BACKLOG.md` first named for B242).\
In the brief's four real-code cases (MEASURED on the real Model, commit, deleteSelection and renameEntity), it converged in all four with no flicker.\
Today's filter diverged in three, and taking additions as they arrive diverged in one and briefly showed an older value.\
It needs only the tab's own list of unacknowledged ops.\
This settles the register's PS321, which B242 was held for.
> **CORRECTED 2026-09-27 (second M7 pass, C4).** "The server's full answer" is the recorder's gloss, and it is wrong. The rule measured, and the one the director's option "Take answer, replay yours" names, applies the server's planned ops that are NOT identical to what the tab itself sent, then replays the tab's unacknowledged ops. Re-applying the full answer would re-apply the tab's own sent ops, and during a live drag would briefly revert it, the flicker the chosen option was shown not to have (the second pass's live-gesture probe). The director's choice is unchanged. K1's tests assert both convergence and that no own edit regresses (`dev/design/h17/PLAN.md`).\
> **As built, K1 (2026-09-28), the proposer's reading.** The replay step replays the tab's pending ops only on the entities the server's answer wrote. Everywhere else the tab already shows them, so replaying them there changes nothing, except during a live drag, which is in no request and would snap back. It gives the same document as replaying everything outside a gesture (INFERRED), and meets C4's "the tab must not snap back" during one (MEASURED, `tests/b242-reconcile.test.js`).

**H17-D4: the three barrel files go.**\
The director chose "Delete them" (the proposer's recommendation) over "Keep them, split per use" and "Keep them as they are".\
`kernel/index.mjs`, `engine/index.mjs` and `model/index.mjs` are deleted, every import names the module that defines it, and the layer manifest (K0) declares what is public.\
The planner falls from 31 modules to 15, and the page from 50 to 44 (MEASURED arithmetic over the import graph).\
The cost shown: 125 import sites change (83 static, 42 dynamic).\
This reverses the barrels' own "import from HERE only" (`kernel/index.mjs:1-2`), which was already bypassed at 24 of 58 sites.\
The mount check in `server/app.js`, which serves a folder only if its `index.mjs` exists, changes to "the folder exists" in the same cut (review finding 1).

**H17-D5: two new served folders, `planner/` and `network/`.**\
The director chose "New planner/ and network/" (the proposer's recommendation) over "Serve parts of server/" and "Move both into engine/".
- **`planner/`** holds the planner. `txn.mjs`, `log.mjs` and `validate.js` move whole, with `policy.mjs`. It loads in a browser, as SD2's preview requires; after the planned cuts that is 14 modules and 168,489 bytes (MEASURED).
- **`network/`** holds the network plugin's rules, roles, appearance and device table (SD11).
- **Serving:** each folder is served whole or not at all, and `server/` is never served. A test checks that `server/store.js`, `server/identity.mjs` and `server/anchor.mjs` still return 404.
> **CORRECTED 2026-09-27 (second M7 pass, C10).** "After the planned cuts that is 14 modules and 168,489 bytes" is the planner at lab v1, which still loads the theme. At the end of the plan the planner is 15 modules and 142,913 bytes, loading neither the theme nor the renderer.

The costs shown:
- files move, so 73 import sites change (58 planner, 15 network);
- 230 citations in tracked Markdown change;
- five folder lists in four scanners move to the layer manifest;
- the Dockerfile gains two COPY lines and the server two mounts.

**H17-D6: the one device-type table is imported by its users, a deviation from the M7 audit's guardrail G8, accepted by the director.**\
The director chose "Import it" (the proposer's recommendation) over "Hand it in", the guardrail as written.\
Under M7 step 4 a guardrail deviation needs the director's acceptance, and this records it.\
The reason given: injection was needed only because the table's users sat in `kernel/` and `model/`, which may not import each other (C9).\
After the planned moves no file in either folder needs the table.\
The table will be a devices module in the new network folder, pinned to the palette's order (host, server, loadbalancer, firewall, vxlan, router), because the digit keys index it.
> **CORRECTED 2026-09-27 (second M7 pass, C10).** The reason given ("after the planned moves no file in either folder needs the table") was INFERRED in the brief, not measured. It is recorded here as the proposer's inference.

**H17-D7: the lab uses the whole key table, shared with the product.**\
The director chose "The whole key table" (the proposer's recommendation) over "All but text and naming" and "Link keys only".\
There is one key table (`app/src/keymap.js`), and the lab carries the label editor (6,738 bytes).\
Three bindings do nothing in the lab because their features are absent: `r` (run mode) and the `draw:action` event, since the lab passes no run-mode rules (K5), and `/`, since there is no help panel.

**H17-D8: the lab runs the real planner in the page from its first version.**\
The director chose "Yes, planner in the page" (the proposer's recommendation) over "No, first lab is tab-only" and "Talk to a local server".
- **The door:** the lab holds a tab Model and a local authority Model, with the real `commit`, `undo`, `redo` and `Log`. So a delete shows the planner's own cascade and sweep, and undo works. Today undo and redo are round trips to the server (`app/src/changes.js`).
- **Cost:** 4 more modules and 78,915 bytes (MEASURED): `referential`, `log`, `txn` and `validate`.
- **Exit amended:** H17's exit wording on `dev/BOARD.md` now reads "core, plugin, planner and canvas modules".
- **The recorder's bullet confirmed:** this confirms, with the director, the bullet "the real planner running locally" recorded under "The lab canvas" above.

**H17-D9: "loads nothing unneeded" is checked at export level.**\
The director chose "Export level" (the proposer's recommendation) over "File level".\
The layer scanner's rule L10 fails when any module in an entry's closure exports something that nothing inside that closure imports.\
What must wait for the rebuild is listed by name, as a ratchet that may only shrink.\
The cost shown: it cannot reach zero within H17.\
The Model's link methods move only at the rebuild (K13d), and some exports serve server doors only.\
At the measured start the hypothetical lab root had 106 of 314 exports imported by nothing in its closure, and the planner entry 153 of 241 (MEASURED).

**H17-D10: the ids of a cut's pieces are derived from the cut.**\
The director chose "Derived from the cut" (the proposer's recommendation) over "Random, then replaced" and "Browser mints and sends".\
A piece's id is a deterministic function of the cut link's id and the cut point, so a browser preview and the server's planner mint the same ids by construction, and GR5's frozen differential of `plan()` stays reproducible.\
The costs shown:
- a rule for collisions must be specified;
- two peers holding different documents can still mint differently, which must show as a typed correction.

**H17-D11: SD2's browser preview reaches the product at the rebuild, not before.**\
The director chose "At the rebuild" (the proposer's recommendation) over "Before the rebuild".\
Until then the product's browser keeps its copies of three rules: the delete cascade and group steal in `app/src/commands.js`, and `splitsFor` in `app/src/input.js`.\
The layer scanner's restatement count (L9) and the design's criterion 5 stay at 2 through H17.\
The lab does not need the preview cut, because it runs the planner in the same page (H17-D8).\
Shipping it earlier would have added 5 modules and about 72 KB to the live page (MEASURED arithmetic).\
The rule half of SD2 (K18a: every door cuts a landing, fixing B243) still lands during H17.
> **CORRECTED 2026-09-27 (second M7 pass, C10).** The design's criterion 5 (zero browser restatements of planner rules) ends H17 at 3 copies, the cascade, the group steal and the split, not 2. The scanner rule L9 is a proxy for it that reads 2.

**H17-D12: no build step for now; the lab serves its source as written, revisited at the rebuild.**\
The director chose "Not now; revisit at rebuild" (the proposer's recommendation) over "Yes, add a build step".\
The built, compressed size is still reported on every run: a similar lab set was 415,516 bytes as source and 31,233 bytes built and compressed (MEASURED by the H17 baseline).\
The reason: the repository has no build step, and built code would be a derived artifact that A2 and the code-revision parity input would then have to cover (the M7 audit's tension T3).\
Comments are 56-57% of the lab's source bytes.

**Before H17.3 starts:** the M7 audit's flag H1 requires a second M7 pass over the revised plan (the brief with all review findings applied and these twelve decisions), not over the first design.

**H17-B251: after a reconnect, a request whose answer was lost stays shown, and a `replayed` answer triggers one fresh snapshot -- ruled 2026-09-28.**\
The K1 fix pass left one reconcile case the rulings did not answer.\
After a reconnect the tab cannot tell whether a request whose answer was lost with the socket reached the server.\
If it did, the fresh snapshot already holds it, the tab re-applies it as its own, and the server's `replayed` answer carries nothing to correct it.\
In the K1 fuzz these were all 3 remaining divergences, and none occur without reconnects (MEASURED).\
Asked "What should the tab do with that edit meanwhile?", the director chose "Keep showing it, re-check" (the proposer's recommendation) over "Hide it until the server answers".\
The edit stays on screen.\
When the server's answer says `replayed`, the tab fetches the document once more, so it converges and the author's edit never flickers away (C4).\
The cost shown: one extra snapshot after such a drop.\
Not built yet; B251 records the work.

**H17-C2(c) EXTENDED: a consumer leaving the closure also vacates -- ruled 2026-09-28.**\
K2a shrank the planner closure from 31 modules to 15, and seven exports became unused for a reason C2(c) did not anticipate: the modules that CALLED them left, while the modules that EXPORT them stayed.\
`kernel/geometry.mjs:node` is the shape -- still exported, still used by 49 product files, unused only WITHIN the planner entry now that `kernel/engine.mjs` and the `engine/` modules are outside it.\
Asked how the rule should handle it, the director chose "Extend C2(c): a consumer leaving also vacates" (the proposer's recommendation) over "Keep C2(c) strict and stop exporting the seven", which would have pulled cut K13a forward out of PLAN order, and over "Record them as a one-off K2a exception", whose cost is that the next cut hits the same wall and the exception list becomes the growth path C2(c) forbids.\
The cost shown and accepted: the L10 list can now GROW as cuts land, which is the thing C2(c) was written to stop.\
It is bounded two ways -- a departed module must actually import the name from that module, and the departure is judged against a frozen record rather than a claim.

**The frozen K0 closure, and why the first four attempts were wrong.**\
"A consumer left the closure" compares two states and the manifest holds one.\
Four implementations judged it from the current tree and each failed: two refused names the ruling admits, one admitted mutant A14's borrowed spelling by testing the MODULE rather than the name, and one passed by reading the entry's own post-cut module list -- which asks the manifest whether the manifest is right, the B108/H11.4 shape.\
So `UNUSED_EXPORTS.planner.k0closure` freezes the 31 modules as `f01772c` recorded them, written once and never edited, with its sha256 pinned in `tests/scan-layers.test.js` exactly as `RATCHET_CEILING` is.\
`departed` is then derivable at every later cut as the frozen list minus today's closure.\
This supports a WEAKER claim than the ruling's wording suggests: it says "left since K0", not "left at cut K7".\
That is the honest limit of one frozen artifact, and it is recorded rather than glossed because a later cut may want the stronger one.

**No history of a link is kept -- a rejoin is DERIVED from the page -- ruled 2026-09-28.\
This answers SD3.**\
The director ruled: "No history of a link is kept - it should be derived.\
If 2 links are remaining on an anchor post some mutation, and they are compatible types and direction, they are to be joined.\
This allows for visual determinism, and we can introduce some key-press on a selected anchor to 'cut' a bend into 2 endpoints, then 'toggle' back to a joined path."\
So the document stores no cut records and no creation order.\
A join is decided entirely by what the page holds: two links left on an anchor after any mutation, compatible in plane and direction, join into one.\
The stated reason is VISUAL DETERMINISM -- the same page always behaves the same way, because there is nothing behind it that could differ.

**What this answers, and what it overturns.**\
SD3 is answered: the document does NOT keep lineage.\
The question was held for the FR3-v7 round's measurement, that measurement is now in, and the director ruled against lineage with the cost in front of them.\
The FR3-v7 and FR3-v8 name-placement rules (`placePartials`, `earlierOf`, the merged cut records of fix pass D3) are all lineage readers and are therefore RETIRED, not fixed.\
Three attempts to make a lineage-based placement consistent each moved the inconsistency somewhere else rather than removing it, which is the evidence that produced this ruling:

| rule | two-cut twins | three-cut twins | name placed by when it was typed |
|---|---|---|---|
| builder's, pre-D1 | 474 and 824 diverge | 3,148 of 10,437 | clean |
| FR3-v7 (fix1d, branch on name) | 0 | 488 | 1,276 of 11,982 DIVERGE |
| FR3-v8 (one rule, named or not) | 0 | 488 | worse: 1,009 of 2,100, 48% |
| page-only, no lineage | 0 | 0 | clean |

MEASURED: `audit-v7/twin3.summary.txt`, `adversary-v7-indep/` F1, `adversary-v8/` G1.\
Page-only is the only variant with no divergence in any column, which is the ruling's "visual determinism" stated as a number.

**The cost, shown and accepted.**\
Draw-then-delete is traceless in 46.50% of round trips (9,626 of 20,701) without lineage, against 98.33% (20,418 of 20,764) with it (MEASURED, the page-only report in the link bake-off bench, which lives outside this repository).\
So R8, "draw-then-delete leaves no trace" (:455), is no longer met by the model in most round trips: deleting a landing often leaves two links where one was drawn.\
Removing lineage also fails 12 more suite ASSERTs (74/13 against 86/1), of which 10 encode rulings, 1 a proposer reading and 1 the suite's own; and it cuts code by 18%.

**What replaces the trace: an explicit gesture.**\
The director's ruling supplies the remedy in the same sentence -- a key-press on a selected anchor cuts a bend into two endpoints, and toggles back to a joined path.\
The trace is therefore not derived from history but ASKED FOR by the author, which is consistent with `flow` and `control`: a declaration is stored only when the author makes one.\
Not designed here.\
It needs its own ruling on the gesture, on whether the cut state is stored on the anchor, and on what a cut anchor does when a further link lands on it.

**Consequences to carry into design.**
- The 2026-09-26 ruling "two separately drawn links left alone at a point join into one" (:593) is CONFIRMED by this, not overturned: it was already the page-derived answer.
- Naming rules that read which piece was drawn first, or which cut made which piece, have no input left. "The longer piece on screen keeps the name" survives, because length is on the page; "the earlier-drawn name wins a join" does not.
- SD4's per-type capability table gains force: a join must also be refused where the anchor's table forbids `bend`. NOT BUILT in any prototype, so every measurement above assumes no device refuses anything.

**The transit gesture: `x`, two states, many anchors, each flipped independently -- ruled 2026-09-28.**\
Specifying the key-press the 2026-09-28 no-history ruling called for.\
The proposal is `dev/design/unification/TRANSIT.md`, which decides nothing; this ruling settles its gesture.\
Four decisions, each with what was not chosen:
- **The key is `x`**, chosen for ERGONOMICS: "its close to the wasd keys and my left hand will be pressing it a lot". `p` was offered as the proposer's recommendation and not taken -- it named the property, as `f`, `s` and `w` do, but sits under the right hand. The departure from the name-the-property pattern is deliberate. `x` is free in every modifier combination and the application binds no clipboard cut, so a plain `x` cannot be mistaken for one.
- **Two states, not three.** On or off. No undeclared third state, unlike `flow`, because nothing distinguishes "undeclared" from "the type's permitted default" on the page, and a state nothing can see is ceremony.
- **Allowed and stored even where it does nothing yet**, chosen over refusing at an anchor with fewer than two links. This buys PRE-DECLARATION: place an anchor, mark it non-transiting, then draw two links that stay apart. Refusing would force the author to draw, watch the links join, and separate them after, so the join would flicker every time.
- **Many anchors at once, each flipped independently**, chosen over driving a mixed selection to one value and over refusing one. It follows the application's one multi-select precedent, `reshapeNodes` (`app/src/commands.js:163`), so an author learns one rule for two keys rather than two rules. The cost shown and accepted: a mixed selection does not converge, so making one uniform takes two presses with a look between them, or selecting alike first.

The only refusal is a type whose table offers no choice, and the readout says so rather than failing silently.

**The transit mark: a thin dashed ring at radius 10, width 1 -- ruled 2026-09-28.**\
Drawn inside the endpoint ring and outside the junction ring, where a three-unit clear gap already exists (junction spans 5.5 to 8.5, endpoint 11.5 to 16.5; `kernel/geometry.mjs:179-185`).\
A one-unit ring centres in it with a unit of clearance either side, so nothing existing moves.\
The weight carries the meaning: endpoint 5, junction 3, this 1.\
Thin and dashed reads as "a rule, not a thing", which is right -- it is the only one of the three that is not a derived role but the author's declaration about what may happen at this anchor.\
**It draws whenever `transit` is false**, in the director's words "a function of actual anchor behaviour not node type".\
Not conditioned on the anchor currently having links to keep apart, so an anchor marked before its links are drawn SHOWS the mark -- which is what makes the pre-declaration ruled above visible rather than silent.\
A type that offers no choice draws nothing, because the author declared nothing.\
**It composes rather than replaces.**\
`waypointLayers` is additive, so a non-transiting anchor with three links draws the endpoint ring AND this ring inside it.\
One endpoint ring is drawn, not three: `roles` is a SET (B208), so `endpoint` contributes exactly one ring however many links terminate.\
The director has noted a future adjustment to the endpoint visual for the several-terminations case, out of scope here and not designed.\
Carried forward, not settled: dash already means the control plane on a link, and is also used for sockets, the marquee and previews, so it reads as a general "provisional" idiom rather than one owned by control.\
Whether a dashed ring on an anchor whose links are themselves dashed reads ambiguously is a judgement only the eye settles, and it is recorded rather than assumed.

**The lab incubates the network plugin, in `network/`, and production takes it by promotion -- ruled 2026-09-28.**\
The director's framing: "We can use the lab as the 'next' prototype of the unification and routing subsystem.\
Once we have validated it there we can promote to prod."\
And: "We are essentially building towards modular pluggable net-new functionality as part of the unification core now - and testing it in the lab."

**What forced it.**\
Building the `g` gesture found that the product has no pipes.\
Its entity kinds are node, waypoint, link, zone and group; `model/model.mjs` mentions `pipe` zero times; and `pathOf` draws a link as a straight polyline through its `via` list, with no routing at all.\
Pipes, cheapest-path routing and links routed over pipes exist only in the bake-off prototype, which mentions `pipe` 108 times.\
So `g` -- a gesture whose whole meaning is steering a router -- had nothing to steer in the product, and building it there would have tested nothing.\
That also corrects a claim recorded earlier the same day: GUIDE-ANCHORS.md T1 said `g` needs no stored-format change.\
That is true of the ruled link model and FALSE of the product, which has no pipes to route over.\
The proposals were reasoned against a model that is ruled but not built.

**The shape.**\
The lab holds two kinds of code, and they obey different rules:

| kind | examples | rule |
|---|---|---|
| mounted | kernel, model, planner, canvas | G1 holds: used unchanged, every change lands in the real module |
| incubated | pipes, routing, `transit`, the `g` gesture | built lab-first in `network/`, promoted when proven |

**Where incubated code lives.**\
Chosen: `network/` at the repository root, now -- over an incubator in the bake-off bench, copied in at promotion.\
It is the folder SD11b and the layer manifest already name ("the plugin of connection ... gets its own folder at K13"), arriving early rather than invented.\
`lab/` cannot hold it, because L8 forbids the lab from exporting anything.\
What it buys, in the director's terms: sovereign boundaries enforced by `scan-layers` from the first line, pluggable interfaces drawn where they will live permanently, and promotion as production STARTING TO IMPORT `network/` rather than a port that must be de-duplicated afterwards.\
The bench option was rejected on exactly that cost: no gate, no layer rules, and promotion as a migration.

**G1 is amended, not suspended.**\
It holds for mounted code as written.\
For incubated code the direction of travel reverses -- lab first, production by promotion -- and that is the ruled exception rather than a lapse.

**The rule that makes this safe: production must not import `network/` until promotion is deliberate.**\
Until then the product runs exactly as it does today, and nothing incubating can reach a user of `draw.apnex.io`.\
This is held by `scan-layers`, not by convention.

**Carried to design.**\
The mounted modules the incubated code needs to extend -- the Model's link methods, the planner's rules, `pathOf` -- are the pluggable interfaces this work must draw.\
Each is a place where production and the incubator currently cannot both be satisfied, and naming them is part of the work rather than a surprise at promotion.

**A refused `g` drag keeps its anchors and pipes -- ruled 2026-09-29.**\
The director, after a `g` drag was refused by the whole-route check and its anchor and pipes vanished: "which is correct, however if then deletes the anchor and pipes I deliberately placed - I think G is supposed to keep the pipe/anchors even if the link fails?"\
So refusal refuses the LINK, not the geometry.\
The `g` anchors and the pipes laid by hand to them are kept; what the drag placed for the link alone -- its `w` anchors, and any pipe that would end at one -- goes with it.\
This extends GUIDE-ANCHORS T4 (a `g` pipe outlives its link) to a link that never existed.\
The refusal that prompted it was also FALSE: it said "a shorter way already exists" where the ways tied, two pipes against two, lost to the router's fixed tie order.\
It now says which; not a ruling, a correction.\
AMENDED 2026-09-30: a `g` drag is no longer refused because a shorter or equally short free way exists -- see "A `g` drag with a shorter free way makes the link on that way" below.\
This ruling still governs the refusals that remain: a way held by another link, no way at all, and a drag that would move an existing link.

**In the network model, "deliberate" means held by the pipes laid with `g` -- ruled 2026-09-29, in the lab's plugin now and in production at promotion.**\
A link built as a chain of `w` anchors was deleted and left anchors behind.\
Fixing a regression (the link's own dying pipes sheltered its pins) left two, kept by existing rulings: its end (B216, "a terminus is a place the author put something") and a start placed with `w` while nothing was in hand (B162, `pinned`).\
Asked what should happen to them, the director reframed the question: "In this case 'deliberately' would be anchors placed with 'g' ?"\
Then asked where that rule should apply, the director chose "The lab's network plugin now; production at promotion" (the proposer's recommendation) over "Everywhere now, production included" and "Both count: g-held or w-pinned".\
The cost shown and accepted: until promotion the lab and production sweep differently, deliberately; production has no pipes and no `g`, so there B162 and B216 remain the only protection an author's anchor has.\
Then asked directly whether a `w`-made ENDPOINT should survive its last link, the director chose "No - it goes just as ruled" (the proposer's recommendation) over "Yes -- endpoints survive; only w bends go".\
So in the lab only links and pipes laid by hand keep an anchor: `w` anchors go with their last link -- pins, ends and a pinned start alike -- and `g` anchors stay, held by their pipes.\
Nodes are never swept either way.\
Built as a third planner interface, `keepsOrphan`, defaulting to production's rule and held to it by tests.

**PROPOSAL, recorded and not built: "survives its last link" as a capability -- the director, 2026-09-29.**\
Verbatim: "I thought I'd add that 'survives last link deleted' sounds like a property/capability that can be injected to an anchor - this could unify then how servers, hosts, routers etc behave by never auto-deleting".\
Today the sweep spares every node because it is a NODE -- a kind distinction with no recorded reason, the same residue that questioned node against waypoint.\
As a column in a type's table (SD4), devices would carry it and a bare anchor would not, and one rule would cover every anchor.\
The seam exists: `keepsOrphan` is where the planner would read it.\
Proposer's reading, not ruled: build it when the device table lands (H17 K6), since the capability belongs in that table.
**Named by the director, 2026-09-29:** "keepsOrphan is a better name". The capability, when built, is the table column `keepsOrphan` -- the same word as the planner interface that reads it, so the capability and its seam are one name end to end rather than two words for one idea.

**A down link is not a deleted link: it stays, drawn dotted, "ready to heal" -- ruled 2026-09-29.**\
The director's report: deleting an anchor "snaps" a direct link between two nodes, "automatically creating a pipe? this is wrong, pipes are deliberate construction actions - either by pressing w/g or mouseup a link drag onto an anchor/node".\
No pipe was created: MEASURED, the pipe set was empty.\
The links had lost their route and were down, and a down link was drawn as a plain solid line, which is how a live link over a direct pipe looks.\
Asked whether "visually deleting a link" is the same as "link is down, trying to connect", the director answered in their own words: "if a link is dynamic, but has no path - a dotted/control like link directly between the source and dest node would indicate 'ready to heal' - if either source or dest node is deleted, link is gone with it permanently".\
So they are two states:
- DELETED: gone from the document, drawn nowhere, healing never; only undo restores it. A link is deleted when its source or destination is, and when it loses a pin with no other way (below).
- DOWN: still in the document with its name and intent, but with no route over the pipes right now. It is drawn DOTTED along its intent -- for a link with no pins, directly between its source and destination -- and heals by itself when a route returns.
AMENDED 2026-09-30: a mouseup onto an anchor no longer lays a pipe; only `w` and `g` do -- see "Each drag action does one thing" below.

Built as round dots rather than the control dash, the proposer's choice within the director's "dotted/control like": a control link is already dashed, and so is the drag preview, so a dashed down link would read as a live control-plane link.\
The link keeps its own weight, so a down control link still reads as control plane.\
The lab's notice states the count as well ("2 links down, ready to heal").\
Proposer's reading, NOT RULED: a link whose pins all remain but which lost the way between two of them -- the `g` anchor it passed was deleted -- is down, dotted THROUGH its pins, since its pins are its intent and what it heals onto.\
The director spoke of the dynamic case, and this extends it by the same rule.\
This retires the resolver's earlier stance that inventing an appearance for a down link "would be designing in the wrong place": the appearance is now ruled, and lives in the appearance pipeline, where that comment said it belonged.\
It also removes the resolver's second exception, which drew every link as live when no pipes existed at all; in the lab every link is laid with its pipes, so no pipes means the routes were removed.

**A link that loses a pin with no other way is deleted whole -- ruled 2026-09-29, amending "Down, and heals" (2026-09-25) and "Forget that bend" (2026-09-26) for that case.**\
The director's report: "if I delete an anchor that has pinned points, the entire end to end link does not delete - a section remains".\
Asked, for a w-chain S-P1-P2-P3-E with P2 deleted and no pipe from P1 to P3, "What should happen to the link?", the director chose "Delete the whole link" over "Stay, shown down".\
The option as worded: the link goes, with its `w` anchors and dashed pipes; `g` anchors and solid pipes stay; undo brings it back.\
With another way open the link still re-routes, as ruled 2026-09-26; measured working on the `detour` board.\
AMENDED 2026-09-30: no longer -- a pinned link lives and dies with its pins, so deleting a pin deletes the link whatever ways are left ("A pinned link lives and dies with its pins", below).\
Built as a fourth planner interface, `isStranded(link, model)`, which is asked only about a link whose pin the transaction deleted, is judged over the pipes that survive the edit, and is never asked in production.\
The removal is in the same transaction, so the orphan sweep takes the link's `w` anchors and one undo restores all of it.\
CORRECTED, the option's "undo brings it back": undo restores the link and every anchor, but not its pipes, which are session state outside the planner's log until the format batch stores them (F6).\
So the link returns DOWN, drawn dotted, rather than routed -- the stated limit every lab undo already has, held by a test so the change shows when pipes are stored.

**Seed boards give each pipe the lifetime its gesture would -- ruled 2026-09-29.**\
The lab's seeds loaded every pipe as laid by hand, so on `?seed=bend` deleting the link's end left its bend anchor and a pipe standing: a board no gesture could have made.\
MEASURED on boards drawn by hand: deleting a link's end removes everything.\
Asked "Should seed pipes get the lifetime their gesture would have given them?", the director chose "Yes, as the gesture would" (the proposer's recommendation) over "No, keep seeds hand-laid".\
So a pipe joining two consecutive stops of a link's intent -- its ends and pins, in order -- is laid with the link, as `w` lays it, and any other pipe is laid by hand, as `g` lays it.\
Each seed pipe states its lifetime, and a test holds every board to the rule.

**Lab behaviour is specified in one matrix, which the gate executes -- the director, 2026-09-29.**\
In their words: "Let's make sure we are durably capturing our intended rules in for each of these test permutations in a matrix somewhere, such that we can refine and iterate on behaviours in a deliberate fashion".\
So every lab gesture permutation is a row of `dev/design/unification/BEHAVIOUR-MATRIX.json`: a board state, a gesture performed with real input, what should happen in words and as checks, the ruling it follows, and whether the lab does it.\
Its readable view, `BEHAVIOUR-MATRIX.md`, is generated from it, and the gate fails if the two differ (mission-kit P3).\
The gate runs every row in real Chrome; a row marked `todo` must still fail, so the matrix cannot claim a behaviour the lab lacks, nor lag one it gains.\
Rulings stay here; a row cites one, says it is the proposer's reading, or says it is open.\
Changing a gesture rule is therefore an edit to one row, and eleven hand-written tests that stated these rules were folded into rows so that each is stated once.

**Pipes carry one link each, for now -- ruled 2026-09-30, suspending SD7's "parallel cables share it" until concurrent links can be drawn.**\
The director, on HEAL-05, where a down link healed over the pipes a new `w` link laid, and deleting that link left its anchor and pipes behind: "because we don't have a concurrency mechanism - is it worth declaring that our pipes are concurrency=1 for now - that is, only a single link is permitted across a single pipe for now.\
A single anchor can have multiple links bending and crossing however.\
When we develop the visual and mechanics of concurrent links over pipes (proper sub-anchors etc..) we can adjust this rule".\
The proposer measured it before it was ruled, on a scratch copy of the tree with real input, and over 3,000 random gesture sequences of 14 edits replayed under each rule (a model of the lab's gestures that omits landing cuts, joins and anchor sweeps; the scripts are in the private archive, not the repository).\
One finding set the shape of the ruling: capacity alone is not enough.\
Without an ownership rule, deleting the `w` link let the down link take over its leftover pipes, and the trace returned (MEASURED).\
AMENDED 2026-09-30: a link drag whose way is held is no longer refused; the link is made, drawn down, and names what blocks it -- see "Each drag action does one thing" below.\
AMENDED 2026-09-30, rule 2: a pipe laid with a link is no longer carried only by that link; the link has first call on it, and any link may use it when free -- see "A w pipe goes when no link is on it or resolves onto it" below.\
CORRECTED 2026-09-30, rule 3: "the older link keeps a contested hand-laid pipe" understated what was built and measured -- the older link has first pick every time routes are worked out, so it can take a pipe a younger link is routed over; see "An older link may supplant a younger link's route" below.

| measured over 42,000 edits | today | one link per pipe, older link first, strict |
|---|---|---|
| states with links stacked on one pipe | 31% | 0% |
| plain or `w` draw-then-delete leaves no trace | 90% | 100% |
| drags that move an unrelated link | 8% | 0% |
| deletes that move an unrelated link | 0% | 0.7% |
| drags refused | 17.0% | 17.5% |

With the older link first but no strict refusal, and with a fixed order by random id, the same runs moved or downed unrelated links on 2.8% to 4.4% of accepted drags; the id order also drew 2.8% of accepted drags differently after commit than their check showed.\
The director chose the proposer's three rules: "Yes, a good refinement".
1. A pipe carries at most one link. The limit is one function, `pipeCapacity` in `network/pipes.mjs`, as `straightCapacity` already caps straight links per pair, so raising it when concurrent links can be drawn is a change to its body.
2. A pipe laid with a link carries only the link whose ends and pins it joins. This is read from the page; nothing is stored.
3. The older link keeps a contested hand-laid pipe, and a drag that would move an existing link is refused. "Older" is creation order: session state in the lab, as pipes are, and stored at promotion in the format batch (F6).

The cost shown and accepted: a refused `g` drag still keeps its pipes, and those can re-route other links -- 13% of refused drags against 6% today -- occasionally sending one down (81 links in 42,000 edits), because pipes are shared out one link at a time.\
What it changes:
- a link can be down because another link holds its way, as well as because no way exists;
- a `w` drag can be refused, when one of its legs is held (`GUIDE-ANCHORS.md` section 4, corrected);
- the `g` drag in matrix row REF-01 is now accepted, because the tying way is held, so the refusal it tested moves to a board where the other way is free.

Proposer's reading, not ruled: a link that loses a pin, where another way exists but another link holds it, stays -- down, and blocked -- rather than being deleted whole.\
It is deleted whole only when no way exists at all, which is the case the 2026-09-29 ruling was asked about ("no pipe from P1 to P3").\
A held way is a way that is full, not a way that is gone.

**Selecting a blocked link highlights the link blocking it -- ruled 2026-09-30.**\
The director: "when I select a down/broken link that cannot be healed due to another link occupying my preferred path, also highlight that blocking link in orange so I can see the path that is blocking".\
A down link's preferred path is the way it would take if no other link held any pipe; the links blocking it are those holding a pipe on that path.\
A link down because no way exists at all has no blocker, and the notice says which of the two it is.\
The orange is the one the down link is drawn in (2026-09-29), `#ff9800`, which measures 8.8:1 on the canvas.

**A `g` drag with a shorter free way makes the link on that way; the path drawn is kept as its alternate -- ruled 2026-09-30.**\
The director's report: "I draw w,g,g,g - then delete the link pipes remain.\
I draw another w,g,g,g,g (between the same two anchors) to make an alternate pipe path.\
Link fails to establish.\
There are not links on either path".\
MEASURED with real input: the second drag was refused, "a shorter way exists (3 pipes, against the 5 drawn)".\
The whole-route check refused any `g` route the link would not follow, because the first path was still there, free, and shorter.\
Asked "What should happen?", the director chose "Link runs the shorter way" (the proposer's recommendation) over "Keep refusing" and "Link runs the drawn path".\
The option as worded: the link is created and runs the old path, and the new path is kept as its alternate, so if the old path goes, the link moves onto it; the notice says so; `g` anchors only lay pipes, and a `g` drag is refused only when no free way exists.\
It reverses the part of the `g` check the director called correct on 2026-09-29, which was shown with the option.\
"Link runs the drawn path" was shown as needing a new stored kind of anchor, a routing hold that is not a connection (`GUIDE-ANCHORS.md` section 8, item 3).\
CORRECTED, the option's "refused only when no free way exists": two other refusals from the same day stand, a way held by another link and a drag that would move an existing link, since both rules were ruled on their own.\
AMENDED 2026-09-30: a drag using only `g` now makes no link at all -- see "Each drag action does one thing" below.\
This ruling still governs `g` hops inside a `w` drag: the link runs the shorter way, and the path drawn is kept.

**Each drag action does one thing: `w` pins a link, `g` lays pipes, a plain mouseup makes a link over existing pipes -- ruled 2026-09-30.**\
The director, to streamline testing: "w: behaves as it does now - constructs anchors, pipes and pins the link. g: change it such that it only constructs anchors and pipes - but actually no link. plain-left-mouse-drag-between-two-anchors: constructs a link but NO PIPES! must use existing infra".\
Asked what a drag using both keys does, the director chose the proposer's recommendation and stated the rule in their own words: "A "left-click-drag" from a source anchor is an undefined intent - the very next action decides what it is - a "w", a "g", or a plain "mouse-up" on another anchor.\
"w" pins a link, and determines it will also produce a link, and dynamically route from that first w pin to either the next w, or the destination".\
Asked what a plain drag does when no free way exists, the director chose "Made, but down" over "Refused" (the proposer's recommendation): the link is made, drawn down, and heals when pipes are laid or the way frees.\
So:
- a drag with any `w` makes a link, pinned at each `w` anchor; between pins, and from the last pin to the destination, it routes over the pipes;
- a drag with `g` and no `w` lays anchors and pipes by hand, and makes no link;
- a drag with neither, released on another anchor, makes a link and lays no pipe;
- a link with no free way is made down, and names the link holding its way when one does.

Proposer's reading, not ruled: each action lays at most the pipe INTO its own stop -- `w` and `g` from the previous stop, a plain release none -- so a `w` link released plainly on its destination routes to it over existing pipes, and to lay that last pipe the author presses `w` or `g` on the destination.\
CONFIRMED 2026-09-30 for the keys: each `w` or `g` lays the pipe from the previous stop to its own; the release's part was replaced the same day ("A release lays the final pipe whenever a key was pressed before it").\
It follows the director's "dynamically route from that first w pin to ... the destination", and it keeps every board drawn with a `w` pressed at its end, as the `w`-chain is, unchanged.\
Proposer's reading, not ruled: `g` may be pressed on an existing node, so a pipe can end at one; `w` still may not, since a pin is always a waypoint.\
CONFIRMED 2026-09-30 for `g`: pressed on a node, the node is a stop and the hand pipe ends there; `w` on a node was ruled a stop, never a pin, the same day.\
Proposer's reading, not ruled: a plain drag between two anchors that an unpinned link already joins makes nothing, and says so, because a pair takes one unpinned link (B72); before this the drag was dropped without a word.\
CONFIRMED 2026-09-30 by the director (matrix row HEAL-03): nothing is made, and the notice says why.\
What it replaces: `GUIDE-ANCHORS.md` T3 ("the first bend key decides") is taken and widened -- any drag without `w` makes no link.\
The "healed" notice for a `g` drag an older down link took (HEAL-01) goes, because a `g` drag makes no link to refuse: its pipes are laid, and the down link heals over them.

**In a drag that lays only pipes, a release on an anchor lays the last pipe into it -- ruled 2026-09-30.**\
The director: "Given we have established that the "w" or "g" key determines if the current drag includes a link or not - can we enable "mouse up, after a previous g, on an anchor - also constructs the pipe" ? allows a pipe to end at a node without having to press g on the final hop".\
It conflicts with no ruling: once a `g` is pressed the drag makes no link, so the ruling that a plain drag makes a link with no pipes, which concerns a drag whose first action is the release, is not reached.\
It replaces the proposer's reading that a plain release lays no pipe, for this case.\
Asked whether it also applies in a link drag whose last key was `g`, the director chose "Only in g-only drags" over "Yes, after any g" (the proposer's recommendation).\
So in a drag with any `w` the release still lays nothing, and the link routes to its end over existing pipes, as ruled.\
AMENDED 2026-09-30, the same day: the director reversed the "Only in g-only drags" answer -- a release lays the last pipe after any key; see "A release lays the final pipe whenever a key was pressed before it" below.

**A release lays the final pipe whenever a key was pressed before it -- ruled 2026-09-30, reversing "Only in g-only drags" the same day.**\
The director: "I may have ruled that wrong.\
I think if the penultimate hop before a mouse-up is a "w", then the pipe should be added".\
Asked what then happens in a link drag whose last key was `g`, the director chose "Lay it too: after any key" (the proposer's recommendation) and restated the rule: "If penultimate hop was a key (g or w) - final pipe is laid.\
Direct links without a key lay no pipe.\
A "g" only path has no link - a link is "activated for this current drag" after a "w" is pressed".\
So a release on an anchor lays the pipe into it from the last stop -- with the link after `w`, by hand after `g` -- and only a drag that pressed no key, a plain drag, lays no pipe.\
It replaces the proposer's reading, recorded under "Each drag action does one thing", that a plain release lays no pipe; and it changes HEAL-04, where a `w` bend released on B now draws the new link up over its own two pipes.

**A `w` pipe goes when no link is on it or resolves onto it; a link has first call on the `w` pipes joining its own pins -- ruled 2026-09-30, amending rule 2 of "Pipes carry one link each".**\
The director's report: A has a multi-hop `w` path to B; C has a `g` path joining one of its `w` anchors; with links A-B and C-B, C-B is blocked and down, "If I delete link A-B - I would expect C-B to route over the top of the now-free path.\
But link deletion of a w node destroys it prematurely".\
MEASURED with real input: rule 2 made A-B's pipes usable by A-B alone, so C-B was reported as having no way at all rather than being blocked, and A-B's pipes were swept with it.\
Asked whether a deleted link's `w` pipes may be taken over, the director chose younger links waiting and inheriting, then simplified it: "why do we need to record "who laid the pipe" - cant we just have the rule "if pipe was laid by w, and no current or waiting links occupying - destroy?""; and, asked whether an older down link may also land on them, chose "Yes: nothing recorded": "W pipes dont remember who laid them - only that they are marked for destruction if the pipe is empty.\
Another pending link can use that pipe and hold it alive".\
So nothing is recorded: a link has first call on the `w` pipes joining its own consecutive stops, ahead of older links; any link may use a `w` pipe no link has called; and after every edit a `w` pipe no link is routed over is swept.\
The cost shown and accepted: in HEAL-05, deleting the `w` link drawn beside a down A-B leaves that link's anchor and pipes, with A-B healed over them.

**`w` may be pressed on a node as the last hop -- ruled 2026-09-30.**\
The director: "We have no way to construct a direct link between two anchors now - I guess we need to enable the "w" key on the final anchor before we mouse up to activate pipes?"\
MEASURED: `w` on a final waypoint already made a direct link with its pipe; on a node it did nothing, by the proposer's reading that `w` may not be pressed on a node because a pin is always a waypoint.\
So `w` on a node makes the drag a link drag and a hop into that node, laid with the link; released there, the node is the link's destination and nothing is pinned on it.\
Proposer's reading, not ruled: `w` on a node the drag then continues past is a hop the link routes over but does not pin, since a node cannot be a pin.\
CONFIRMED 2026-09-30 by the director: one link A-C through N, which it passes but does not pin -- not two links chained there, as a digit key makes.\
Only with a route hook -- the lab -- so production's `w` is unchanged.

**A link never runs the same pipe twice; hairpins wait for concurrent links on pipes -- ruled 2026-09-30.**\
The director: "should we reason about "split horizon" across pipes that have a pinned w for a link?\
Today if I delete an anchor and one of the remaining anchors has a link pinned - it is permitted to trace back across the same pipe it came in on "hairpin" - visually strange but possibly correct".\
MEASURED at the router: only a pin left on a spur produces one -- the one way on from the pin is back the way it came, `A-X-P-X-B` -- and it was allowed because the capacity check counted links, not runs.\
Asked "Should a link be allowed to run the same pipe twice?", the director chose "No: never the same pipe twice" (the proposer's recommendation): "I reliased that hairpinning is something we should bundle with parallel concurrency at a later stage on pipes".\
So a way that would double back is no way: the link is down, drawn through its pins, and heals when a way through appears; and a link that just lost a pin with nothing else left is deleted whole (2026-09-29), since a hairpin no longer counts as another way.\
Held with concurrent links on a pipe, as B256.\
Asked in the same exchange, and confirmed by the director as correct: a link that loses a `w` anchor and has another way re-routes over it, stays the older link, and keeps blocking a younger link that wants those pipes -- a delete re-routes the link whose pin went, and the protection against moving an existing link belongs to drags.\
AMENDED 2026-09-30: reversed -- a link that loses a pin is deleted whole, whatever ways remain ("A pinned link lives and dies with its pins", below).

**An older link may supplant a younger link's route: age decides every time routes are worked out -- ruled 2026-09-30.**\
The director asked: "Are you saying that an older path can supplant an already routed new one?"\
MEASURED at the router: an older link O on A-x-B and a younger link Y on a middle path; x is deleted, O's own way is gone, O takes the middle path, and Y is down, blocked by O. The proposer had described rule 3 as "the older link keeps a contested hand-laid pipe", which hid this: routes are worked out from the page and the link ages after every edit, oldest first, so the older link has first pick every time.\
What can trigger it: deleting an anchor or `g` hop an older link passed, or a pin when it has another way; undo bringing an older link back (matrix row CAP-06); new hand pipes from a `g` drag that give an older link a better way.\
What cannot: drawing a new link, since a drag that would move an existing link is refused; and a younger link's own `w` pipes, since it has first call on them.\
Asked whether an older link that loses its way may take hand-laid pipes a younger link is routed over, the director chose "Yes: age decides every time (as built)" over "No: a routed link keeps its route", which was shown as needing each pipe to remember the link on it.

**The w that placed the source counts as the drag's first key, while that anchor is still the sole selection -- ruled 2026-09-30.**\
The director's report: after a `w`-chain, "start a new link w to an existing anchor - it becomes a junction (correctly).\
However it didnt lay the pipes.\
We agreed that a link ending with a "mouseup" that was preceded with a w/g key constructs pipes.\
Do we need to ensure this includes the case where w is used on the source for a single hop link?"\
MEASURED with real input: the `w` that places an anchor with nothing in hand happens before the drag starts, so the drag from it was plain -- the junction was made, the new link laid no pipe and was down; pressing `w` on the destination instead laid the pipe.\
Asked whether that `w` should count, the director chose the proposer's recommendation and refined it: "When you press w, the anchor is "selected".\
So Yes if that same anchor remains the sole selected anchor, and the next gesture is a drag.\
This eliminates the case where you click off the anchor to unselect it - then the drag would follow normal link commit rules".\
Asked what happens when that drag then presses `g`, the director chose "A g in the drag cancels it" (the proposer's recommendation), so a pipe-only path from a fresh anchor stays pipe-only.\
So: `w`, drag, release makes a link with its final pipe; `w`, drag, `g`..., release lays pipes and no link; a click, or any other press, between placing the anchor and dragging from it clears the `w`.

**Recorded late: four statements from the lab review of 2026-09-29 that matrix rows cite -- recorded 2026-09-30.**\
The ruleset audit (`dev/design/unification/RULESET-AUDIT.md`, F6) found five matrix rows citing director statements this file did not hold.\
They are recorded here verbatim, with the rows that rely on them; nothing is newly ruled.
- LOOK-01 and CAP-05, the down look: "Ok, we need to make the dots a different color - orange?"
- HEAL-01, a `g` bend onto a down pair: "if I draw the new link with a bend using "g" (not w! - that would pin a new link) and let go on the end node - it also fails (2 straight links between node A/B etc.. which may carry one)".
- HEAL-02, `g` against a plain mouseup: "do we need to distringuish between plain "mouseup on link drag on existing anchor" and "pressing g on existing anchor then mouseup"".
- HEAL-04, a `w` bend beside a down link: "if I draw a new link with "w" - this should not be the healed link (w pins and draws an entirely new link in addition to the broken one?)".

**The Rules system's three owed rulings: selection only, no overrides, the situation plain data -- ruled 2026-09-30.**\
Asked `dev/RULES.md` Q1, Q3 and Q4 as the gate on step T3 of the ruleset audit, the director answered: "Agree with all 3 recommendations".\
The recommendations, as put to the director:
- Q1: a rule sees the selection, plus what each step of a drag landed on (a node, an anchor, empty ground), recorded in the drag itself; no general hover, which can be added to the closed vocabulary later.
- Q3: two rules matching the same situation is always a gate failure; no row may declare `overrides:`.
  CLARIFIED 2026-09-30: held FOR NOW, not committed to -- the director: "We havent committed to that ruling. We may allow for ovverides later if it serves us and has value." Parked as B262, with its revival trigger.
- Q4: the situation is binding now as model-level, serialisable and DOM-free data.

**The Rules system is foundational to plugins, and a plugin's rules are the plugin's -- stated 2026-09-30.**\
The director: "The rules system will be critical in that it is modular, decoupled, programmable, extensible etc as it will be foundational to our plugin/capability system.\
Are the rules that relate to our "routing" plugin part of the plugin itself? it would have to be, given that it acts on capability that no other plugin would have awareness of?\
This reminds me of game mods injecting behaviour into a general game engine, such as a lua surface".\
Recorded as the director's intent; the design that answers it is proposed separately and awaits the director's approval.

**The Rules engine's second example is `c`, not fill -- ruled 2026-09-30.**\
The proposer had offered "a closed link selected plus `f` fills it" (the worked example in `dev/RULES.md` section 9) as the engine's second, non-routing user, and found on surveying that fill does not exist: `f` sets a link's flow direction (H15.6), and links carry no fill.\
Asked what the second example should be, the director chose "Use `c` close instead" over building fill as a new feature, or both.\
So the example is behaviour-preserving: one link with a bend selected plus `c` closes or opens it; one link without a bend selected plus `c` says "close needs a multi-hop route"; anything else, nothing.

**The input system is to be a programmable, context-aware mapping from inputs to actions -- stated 2026-09-30.**\
Approving a design for separating input capture, gesture lifecycle and meaning, the director added: "One thing I want to consider with the input/gesture updates - is context awareness - much like we did for the rules engine - having a progressive, modular, layered "gesture system" that tracks current inputs, keys and gestures - both ordering and concurrent - can be bound to an action and trigger it.\
Essentially a programmable mapping - this will allow us to have "context aware menus" so the same action can have different meaning depending on what was pressed or selected etc".\
Recorded as the director's intent; the design that answers it is `dev/design/input/GESTURE-SYSTEM.md`, awaiting approval.

**The gesture system's scope and first decisions: DG1, DG2, DG3, DG5 as recommended -- ruled 2026-09-30.**\
Asked the five decisions of `dev/design/input/GESTURE-SYSTEM.md` section 12, the director answered: "We havent committed to that ruling.\
We may allow for ovverides later if it serves us and has value.\
Keep it for now.\
Agree wth your recommendations".
- DG1: stages 1 to 5 (restructuring, no outcome changes) first, then 6 (generated help) and 7 (context menu).
- DG2: no binding overrides another, for now -- contexts compose by disjoint conditions. Q3 is held, not committed to; overrides are parked as B262.
- DG3: "programmable" means bindings are data brought by tenants in source; runtime editing by users or agents is a later, separate decision.
- DG5: key sequences beyond drags are in the trigger vocabulary's design, built only when a first binding asks for one.
- DG4, how a menu is opened, stays open; it is needed before stage 7 only.

**A click is a release that never travelled more than 4px from its press -- ruled 2026-09-30.**\
Stage 3 of the gesture system makes "click or drag" one rule, and the proposer measured that it was decided three ways that disagree at the edges: a link drag out 250px and back to within 2px counted as a click and selected its node; a 3px diagonal release was a click on empty canvas, stamping the held type, but a drag on a node.\
Asked which one rule, the director chose "Never travelled >4px" (the proposer's recommendation) over "Within 4px at release" and keeping all three.\
So a drag out and back is a drag, and a release a little over 4px away on the canvas no longer stamps.\
A chain -- a Shift-release, or a digit mid-drag -- begins a new drag where it happens, so travel is measured from there.\
A chained run is ended by a press that is not that drag's start; a click still ends the run selecting its anchor only when it lands on that anchor, as before -- the rule decides whether it is a click, and where it landed decides what the click means.

**A double click edits a zone's name without Shift, for now -- ruled 2026-09-30.**\
Stage 4 found that a press reaches a zone only with Shift held (the zone layer is inert otherwise), while a double click finds a zone without it; the design had listed making them consistent (acceptance test 5), which is an outcome change.\
The director: "double-click to edit a zone name without shift is fine for now.\
I'll re-evaluate in the lab later".\
Parked as B264, with that re-evaluation as its revival trigger; acceptance test 5 is withdrawn until then.

**The context menu is a fixed panel, to be designed separately later; stage 7 is parked -- stated 2026-09-30.**\
Asked how a menu should open (DG4), the director: "What I was thinking with a context menu was actually a small fixed panel somewhere on the screen - that dynamically changes depending on the context rule - however I think I want to design that properly, separately at a later stage and not now".\
So DG4 is withdrawn -- a fixed panel is not opened by a gesture -- and stage 7 of `dev/design/input/GESTURE-SYSTEM.md` is not built now.\
What it would read is already in place: the bindings, their conditions over the situation, and the action labels (stages 4 to 6).\
Parked as B265, with the director opening that design as its revival trigger.

**A pinned link lives and dies with its pins -- ruled 2026-09-30, reversing re-routing when a pin is deleted.**\
Asked, for a link whose pin is deleted and whose only remaining way an older link is using, whether it stays down or is deleted, the director answered: "I'm thinking it should be deleted - a deliberate pin is a link's intent, and if that intent is removed, the link no longer serves its purpose - does this make sense?".\
The proposer pointed out that the reason reaches further -- a free way used to save such a link (matrix row DEL-02, and the director's confirmation of 2026-09-30 that it re-routes) -- and asked whether it applies only when the way left is taken, or whenever a pin is deleted; the director chose "Whenever a pin is deleted" (the proposer's recommendation).\
So deleting any pin of a link deletes the link, whatever ways are left; its `w` anchors go with it unless a hand pipe still uses them, and one undo restores it.\
It amends the 2026-09-29 ruling "A link that loses a pin with no other way is deleted whole" (which kept re-routing when another way was open) and reverses matrix row DEL-02.\
Losing an anchor that is not a pin -- a `g` guide -- does not delete the link: it stays, shown down, and heals (below).

**Three readings of the delete and drag rules, confirmed -- 2026-09-30.**\
Asked one at a time, the director confirmed the proposer's readings:
- matrix row DEL-09: deleting a `g` guide a pinned link runs through leaves the link, shown down through its pins, keeping the pipes on its path to heal onto -- "Stays, shown down";
- matrix row DEL-14: when deleting pin P1 deletes the link, its other pin P2 survives as a plain anchor if a hand pipe still joins it to a guide -- "P2 stays";
- RULESET-AUDIT D2: the later "never the same pipe twice" replaces the earlier "may pass a point twice" for going out and back along one pipe -- "Yes, 30 Sept replaces it".

**Promotion is a full cutover: every existing diagram moves to the routing engine, with no legacy mode -- ruled 2026-09-30, and planned, not started.**\
Asked what promoting the network plugin into production should do to existing diagrams -- opt in per diagram, or switch the whole product -- the director: "I dont want to proceed yet - but let's document the full plan for when we are ready.\
Full cutover to new routing engine in existing diagrams.\
No legacy".\
So when promotion happens, production composes the network plugin always; every stored diagram is migrated to carry pipes and link ages; and the product's pre-network behaviours -- straight polylines through `via`, the B162/B216 orphan rules, never stranding a link -- are retired rather than kept beside the new ones.\
The plan is `dev/design/unification/PROMOTION.md`; it is held as B266 until the director says the work may start.

**Transit is revisited now that pipes exist -- stated 2026-09-30.**\
The director: "We actually began down the rabbit hole of pipe infrastructure as a result of the initial transit discussion.\
Now that we have pipes - we can revisit Transit and implement it in the lab.\
Prepare an approach to progress this programme".\
Recorded as intent; the approach is `dev/design/unification/TRANSIT.md` section 12, with eight decisions (TR-1 to TR-8) for the director before any code.

