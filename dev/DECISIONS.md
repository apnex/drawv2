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
A PIPE is a visible adjacency between two anchors, drawn, selected and deleted by an author. A LINK is a cable with its own identity, routed through pipes, which re-paths when a pipe under it is removed and is cut and joined as the rulings above describe. A FLOW is declared over links, and its path is derived.\
This adopts a DIRECTION for design and changes no code. The bake-off's measured costs of FR3 -- a link's memory of the route it was drawn along, which can make identical-looking states diverge; the number of records one edit rewrites; the cost of re-deriving routes at scale; and the round-trip cases where removing a landing does not restore the passing links -- are carried as the next design questions, not accepted as settled.

**A link returns to its drawn route -- ruled 2026-09-25.**\
Asked "When the deleted pipe is redrawn, where should the re-pathed link go?", the director was first unsure; after the proposer set out the three options and recommended one, the director chose "Back to drawn route" over "Stay where it is" and "Always the best route".\
The route an author draws is stored as the link's INTENT; the route it currently takes is derived from it -- the drawn route while all of its pipes exist, a detour while they do not -- and the link returns to the drawn route when it can.\
This makes explicit the route memory the bake-off measured as hidden state in FR3, and the detour can be shown to the author.

**A link with no route stays, shown as down, and heals -- ruled 2026-09-25.**\
Asked "When a link has no route left at all, what happens to it?", the director chose "Down, and heals" over "Removed": the link stays, keeps its name and drawn route, shows as down, and comes back when a route returns -- the same behaviour the director gave for a declared flow with no route in survey Round 2 Q4.

**Draw-then-delete leaves no trace -- ruled 2026-09-25.**\
Asked, for two links passing through one point that a new link lands on and cuts, "After deleting the new link, should the two passing links be whole again?", the director chose "Yes, rejoin both" over "No, stay cut": deleting the landing rejoins each passing link into one, as before the landing.\
This generalises the join-on-removal ruling beyond three links meeting, and closes the round-trip failures the bake-off re-test measured (a landing on a point two links pass, then its removal, left four ends).\
Carried to design, not ruled: how the rejoin pairs the pieces -- which ends belong to which link when several were cut at one point.

**A new link passing through a point where another link ends connects to it -- ruled 2026-09-25.**\
Asked "When a new link passes through a point where another link ends, should they connect?", the director chose "Yes, connect" over "No, pass by": the new link is cut at that point and the three meet at a junction.\
This is the mirror of the landing ruling above, so the order in which two links are drawn no longer decides whether they meet -- the re-test measured that it did, for the adopted model and today's.

**A server may have several links -- ruled 2026-09-25, amending the permission table of 2026-09-22.**\
Asked "Should a server be allowed more than one link?", the director chose "Yes, several links" over "Only an aggregate" and "No, one only": a server can have several independent links, such as redundant uplinks.\
The 2026-09-22 ruling that "a compute or server glyph permits endpoint alone" said that if a second link were ever legitimate, "the TABLE changes rather than the rule bending"; this is that change, and it lets a server take part in all four link relations.\
Not ruled here: whether a flow may pass THROUGH a server (forwarding), as against only starting or ending there.

**Two links passing through one point cross without connecting -- ruled 2026-09-25.**\
Asked "When two links both pass through the same point, do they connect there?", the director chose "No, they just cross" over "Yes, both are cut": both pass through untouched, like a crossover on a schematic, and links connect at a point only where one of them ENDS there (the landing and pass-through rulings above).\
This settles the register's PS205 (meeting against passing through) for links. The pipes at that point still meet as pipes -- two cables can share a conduit junction without being connected -- which is consistent with pipes and links being separate layers.

**Whether a link may pass through a device is decided by the device's capability pack -- ruled 2026-09-25.**\
Asked "Can a link pass through a device (host, firewall, load balancer, VXLAN), or does every device end the links that reach it?", the director answered in their own words: "Depends on the capability pack that restricts anchor routables. Most existing nodes will only support either endpoint or junction (or both)".\
So the capability pack in a node's composition restricts which routable roles its anchor may take -- endpoint, junction, bend -- as the director's earlier leaning described for routers; and most existing node types permit endpoint and/or junction but not bend, meaning a link reaching them ends there.\
Carried to design: the per-type table itself (which existing types permit which roles), and whether any type permits bend.

**A landing on a link that is on a detour cuts it where it is -- ruled 2026-09-26.**\
The FR3-v3 prototype (`dev/design/unification/BAKEOFF-LINK.md`, Addendum 2) applied the landing rule to a link's DRAWN route, so a new link ending on a visible detour left the detoured link passing through uncut.\
Asked "A link is on a detour because a pipe under it was deleted. You draw a new link that ends on that detour. Should it cut the link there?", the director chose "Yes, cut it where it is" over "No, cut the drawn route" (the proposer's recommendation) and "Detours avoid link ends".\
The option as worded by the proposer: the landing cuts the link on its detour, and the detour becomes its new drawn route, so the link forgets its old route and does not return to it when the pipe comes back.\
Not ruled here:
- whether a landing on the unused drawn route of a detoured link cuts it (the prototype does);
- whether deleting such a landing restores the old drawn route, under "draw-then-delete leaves no trace" above.
