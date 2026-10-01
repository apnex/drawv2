# Transit -- what an anchor does with what passes through it (PROPOSED)

---

## 1. Status

- **Written:** 2026-09-28, against drawv2 at `2a9b488` (branch `main`), from a live design conversation with the director on the same day.
- **This document proposes; it decides nothing.** Sections 3 to 6 are the proposal. Section 8 lists what is still open, and section 9 what this would amend.
- **It exists because the conversation converged and was not written down.** The same ground was re-derived three times in one session, which is the signal that a record was owed.
- **Every number cited is MEASURED and names its file.** Where something is the proposer's reading it says so.

---

## 2. What this is for

The director ruled on 2026-09-28 that no history of a link is kept: two links left on an anchor after a mutation, compatible in plane and direction, join into one, derived from the page alone.\
That ruling supplies its own remedy for the case where an author does NOT want them joined -- "some key-press on a selected anchor to cut a bend into 2 endpoints, then toggle back to a joined path".

This document specifies that key-press: what it toggles, where the value lives, and how it relates to the per-type capability tables already ruled in SD4.

---

## 3. The property

**`transit`** -- does what arrives at this anchor pass through it, or stop.

It is carried by the `routable` pack, per layer:
```
routable.links.transit     do links pass through this anchor
routable.flows.transit     do flows pass through this anchor
```

One verb, qualified by the layer it applies to.\
The layers are named by their plurals -- `pipes`, `links`, `flows` -- because the corpus already uses those words 36, 243 and 35 times against 2, 3 and 2 for conduit, cable and traffic, which appear only as glosses.\
A gloss explains; it should not also name.

`pipes` has no `transit`: an anchor IS a pipe endpoint, and nothing passes through a pipe.

---

## 4. Roles are derived, never configured

`endpoint`, `bend` and `junction` are not settings.\
They fall out of two things the page already holds: how many links terminate at the anchor, and whether transit is on.

| links at the anchor | `links.transit: true` | `links.transit: false` |
|---|---|---|
| 1 | endpoint | endpoint |
| 2, agreeing, same plane | **bend** -- one continuous path | **2 endpoints** |
| 2, opposing or planes differ | junction | 2 endpoints |
| 3 or more | **junction** -- all connected | **3+ endpoints**, drawn with a larger ring |

The first column is today's matrix (`docs/spec/ATOMICS.md:272-275`), unchanged.\
The second column is what the toggle adds.

**The uniformity is the point.**\
One property behaves the same way at every arity: transit off means what arrives stops.\
An earlier draft of this proposal claimed a bend could be toggled and a junction could not, on the reasoning that an author never chooses a junction -- they draw a third link and it is one.\
The director corrected it: turning transit off at a three-link anchor does not REFUSE the third link, it lands and terminates.\
Nothing is refused, both pages are legal, and the special case disappears.

---

## 5. Two places the value lives, one rule that reads them

|  | the type's table | the anchor's setting |
|---|---|---|
| scope | per device TYPE | per ANCHOR |
| set by | the pack author, once | the document author |
| lives in | `network/`, as code (H17 cut K6) | the stored document |
| ruled by | SD4 | the 2026-09-28 transit ruling, if made |
| nature | a PERMISSION: which values are offered | a CHOICE within what is offered |

**The table is a permission, not a default** (director, 2026-09-28).\
It states which values of `transit` a type offers.\
An author may choose among them and may never choose outside them.\
So an author's setting can only ever be as restrictive as the type allows, never more permissive -- which preserves what a type MEANS.\
A router's centre ring stays honest because no author can make a host behave like one.

The same path is used in both places, so a reader who learns it knows both:
```
# in the pack, per type -- the permitted values
routable.links.transit: [true, false]

# in the document, per anchor -- the author's choice
routable.links.transit: false
```

The derivation reads the anchor's setting when present and the type's default-permitted value otherwise, and the planner refuses a setting the table does not offer.

---

## 6. The table, worked

Against the six types the product ships (`kernel/theme.mjs:GLYPH_BB`) plus the bare anchor.\
**These contents are the proposer's reading and are not ruled.**\
They are here to show the shape.

| type | `links.transit` | `flows.transit` |
|---|---|---|
| bare anchor (today's waypoint) | `[true, false]` | `[true, false]` |
| router | `[true, false]` | `[true]` |
| firewall | `[true, false]` | `[true, false]` |
| vxlan | `[true, false]` | `[true]` |
| loadbalancer | `[false]` | `[true, false]` |
| server | `[false]` | `[false]` |
| host | `[false]` | `[false]` |

`vxlan` is the row worth reading twice: it offers a choice about links and none about flows, which is the evidence that the two columns are genuinely independent rather than one column written out twice.

---

## 7. What was considered and dropped

**A count column** (`ends`, `terminating`, `acceptsMany`) -- how many links may terminate here.\
Dropped for three reasons.\
No device was found that permits two terminations and forbids three.\
It read badly in four separate namings, which is usually a sign the concept is not real rather than that the naming is hard.\
And once transit is uniform at every arity, nothing needs refusing, so the column has no consumer.

The cost of being wrong is ASYMMETRIC and that is why it is safe to leave out: the table is code in `network/`, not stored data, so adding a column later is one module plus its reader, with no migration and no format batch.\
SD4 already names a new column as the ruled extension mechanism.\
Removing a column that rulings have been built on is the expensive direction.

**Separate packs per layer** -- `cabling` and `traffic` as two packs.\
Dropped: they are the same capability seen at two layers, and no device was found that forwards links while blocking flows in a way that would need separate composition.\
Two columns in one pack is the smaller claim, and SD4's own cost note names columns as how a pack grows.

**Two verbs** -- `forwarding` for links and `transit` for flows.\
Dropped at the director's instruction: two words for one idea, differing only in what they apply to, forces a reader to hold a translation table.\
One verb, qualified by position.

---

## 8. The gesture, ruled 2026-09-28

**The key is `x`.**\
Chosen by the director for ERGONOMICS rather than mnemonics: it sits by the `wasd` cluster, under the left hand, on a key that will be pressed often.\
That departs from the pattern of the other declaration keys, which name their property (`f` flow, `s` shape, `w` waypoint), and the departure is deliberate and recorded rather than accidental.\
`p` was offered and not taken; it named the property but sits under the right hand.\
`x` is free in every modifier combination (`app/src/keymap.js`), and the application binds no clipboard cut, so a plain `x` cannot be mistaken for one.

**Two states, not three.**\
`transit` is on or off.\
There is no third undeclared state, unlike `flow`, because no case was found where "undeclared" is distinguishable on the page from "the type's permitted default".\
A third state that nothing can see is ceremony.

**It applies wherever it is legal, including where it does nothing yet.**\
An anchor with fewer than two links has no visible bend or junction to change, and the toggle is still ALLOWED AND STORED.\
The reason is pre-declaration: an author may place an anchor, mark it non-transiting, and then draw two links that STAY apart.\
Refusing here would force the author to draw the links, watch them join, and separate them afterwards -- so the join would flicker on screen every time, which is a worse gesture for the same result.

**Many anchors at once, each flipped independently.**\
The key acts on every selected anchor.\
A mixed selection therefore does not converge: two on and one off become two off and one on, and pressing twice returns to the start.\
This follows the one multi-select precedent the application already has -- `reshapeNodes` (`app/src/commands.js:163`) flips each node's shape independently -- so an author learns one rule for both keys rather than two rules for two keys.\
The cost, shown and accepted: making a mixed selection uniform takes either two presses with a look between them, or selecting alike in the first place.

**Refused only by the type's table.**\
The one refusal is a type that offers no choice: a host whose table holds `[false]` cannot be toggled, because there is nothing to choose.\
The readout says so rather than failing silently.

---

## 9. The mark, ruled 2026-09-28

**A thin dashed ring in light orange, radius 10, width 1**, drawn inside the endpoint ring and outside the junction ring.\
The colour is `#ffb74d`, carried as a named token beside the others in `kernel/theme.mjs`, never as a literal in a stylesheet -- B235 and B236 were both one value with two authorities, and a colour introduced as a literal is the same trap set again.

The geometry has room without moving anything (`kernel/geometry.mjs:179-185`):

| ring | radius | width | spans |
|---|---|---|---|
| junction | 7 | 3 | 5.5 to 8.5 |
| **transit off** | **10** | **1** | **9.5 to 10.5** |
| endpoint | 14 | 5 | 11.5 to 16.5 |

A three-unit clear gap sits between the junction and endpoint rings, and a one-unit ring centres in it with a full unit of clearance either side.

**The weight carries the meaning.**\
Endpoint is heaviest at 5, junction is 3, and this is 1.\
Thin and dashed says "a rule, not a thing", which is right: it is the only one of the three that is not a derived role.\
It is the author's declaration about what may happen at this anchor, and the other two are what the page then derives.

**It draws whenever `transit` is false**, including at an anchor with no links or one.\
The director's words: "a function of actual anchor behaviour not node type".\
So it is not conditioned on the anchor currently having something to keep apart -- an anchor marked before its links are drawn SHOWS the mark, which is what makes the pre-declaration ruled in section 8 visible rather than silent.\
A type whose table offers no choice draws nothing, because the author declared nothing.

**It composes; it does not replace.**\
`waypointLayers` is additive -- an anchor's dot, its anchor circle, and one layer per derived role -- and this is one more layer.\
So a non-transiting anchor with three links draws the endpoint ring AND this ring inside it.

**One endpoint ring, not three.**\
`roles` is a SET (`kernel/geometry.mjs:297-309`, B208), so `endpoint` contributes exactly one ring however many links terminate.\
Nothing is stacked or hidden.\
The director has noted a future adjustment to the endpoint visual for the several-terminations case; that is out of scope here and is not designed.

**The dash reads unambiguously, ruled 2026-09-28.**\
Dash already means the control plane on a link (`DASH_ON` 2, `DASH_OFF` 1.5), and is also used for sockets, the marquee and previews, so it is a general "provisional" idiom rather than one owned by control.\
The director settled the control-link case directly: the control links DO NOT CONNECT to the transit ring visually.\
The geometry agrees, and recording it is what makes the reading safe rather than lucky.\
A terminating link's stroke stops at the endpoint ring, whose inner edge is 11.5, while the transit ring's outer edge is 10.5.\
A full unit of empty space separates them, the endpoint ring sits between the link and the transit ring, and the two dashed things differ in weight by a factor of five.\
This holds only while the transit ring stays INSIDE the endpoint ring, so a later change to either radius must re-check the clearance.

**The socket collision, and why the colour moved.**\
A second dashed mark was found on the same element and it is a closer call than the control link: `.socket` is `#e0a85a`, width 0.6, dasharray 2 2 -- amber, dashed and thin, drawn on anchors in EDIT MODE, which is exactly where and when an author presses `x`.\
Three of four attributes would have matched.\
The director ruled that the socket and packet ambers are PLACEHOLDERS rather than locked tokens, so the clash is resolved by moving them later rather than by avoiding orange here.\
`#ffb74d` was chosen for the ring: 11.0:1 against the canvas, and separated from today's socket amber.\
Recorded so that whoever re-colours the socket knows this ring is a constraint on that choice rather than a free variable.
---

## 10. Open -- not settled by this document

1. **Absent or explicit.** Whether `transit` is stored only when the author sets it, as `flow` and `control` are, with absent meaning the type's permitted default. The proposer's reading is yes, for consistency with every other optional declaration.
2. **Where the field sits against SD11b.** SD11b puts the core anchor at identity and position only, with everything else in the network plugin. `transit` belongs to the plugin, not the core -- proposer's reading, not ruled.
3. **The format batch.** This is a stored-format change, so under survey F6 it lands as part of the ONE named batch, last, after the behaviour is proven.
4. **SD5 is untouched.** Whether an act that would make a device take a forbidden role is refused or cut stays held behind the id-prefix one-way door. This proposal needs no refusal machinery, which is why it does not disturb that hold.
5. **The table's contents.** Section 6 is illustrative. Each row is a decision the director has not made.

---

## 11. What this would amend

- **SD6** ruled a per-type yes/no column for whether a flow may pass through a device. This does not change that rule; it renames the column to `routable.flows.transit` so it sits beside its link-layer sibling under one verb. Naming only, but it is an amendment to a ruling eight days old and is flagged as one rather than folded in silently.
- **The 2026-09-26 ruling** that two separately drawn links left alone at a point join into one (`:593`) is CONFIRMED, not overturned. It is the page-derived answer, and `transit: false` is how an author departs from it deliberately.
- **Nothing in the 2026-09-28 no-history ruling changes.** This is the gesture that ruling called for.

---

## 12. Transit with pipes -- the approach for the lab (2026-09-30)

**Why now.**The director, 2026-09-30: "We actually began down the rabbit hole of pipe infrastructure as a result of the initial transit discussion.\
Now that we have pipes - we can revisit Transit and implement it in the lab".\
This document was written on 2026-09-28, before pipes, routing over them, guides, one link per pipe, down links, or the ruling that a pinned link lives and dies with its pins.\
Sections 3 to 9 still stand; this section says what pipes change, what must be ruled first, and the order the work goes in.\
Tracked as H17.10 / B267.

### 12.1 What exists -- measured at `a2b8b81`

- **The mark is drawn, and nothing can set it.** `waypointLayers` draws the ring when `anchor.transit === false` (`kernel/geometry.mjs:310-330`); no key, command, field, validator or rule sets or reads `transit`.
- **And the drawing never receives the anchor.** Both callers pass `waypointLayers` the roles, the extent and the links but not the waypoint (`app/src/renderer.js:365`, `kernel/renderer.mjs:211`), so even a set `transit` would draw no ring; X1 passes it.
- **Routes pass through any anchor a pipe reaches, nodes included.** The router walks pipes with no regard to what an anchor is (`network/pipes.mjs:37-72`); `w` and `g` may stop on a node.
- **On every lab board, routes pass only through bare waypoints, and every node is a router.** Measured over the six seeds: a table that lets routers and bare anchors transit by default changes no existing matrix row.
- **Joining is the planner's.** Two links left at a waypoint join by `collapseAtWaypoint` (`server/txn.mjs:291`); roles are derived by `waypointRoles` (`kernel/geometry.mjs:505`).
- **Node types are the palette's list** (`app/src/palette.js:14`); the per-type table section 5 places in `network/` (cut K6) is not built.

### 12.2 What pipes change

Before pipes, transit had one job: whether links meeting at an anchor JOIN (a bend) or stay apart (endpoints) -- section 4.With pipes it gains a second, and it is the one the director's words on nodes point at: whether a link's ROUTE may pass THROUGH the anchor.A router passes traffic on; a host does not.Without transit, a host with pipes to two switches is a shortcut every route between them may take -- which the per-type table (section 6) exists to forbid.

So `links.transit: false` reads, uniformly, "what arrives here stops":
- a route may not pass through it -- it may only begin or end there;
- links meeting there do not join;
- a link cannot bend there, so a pin there is two links ending there.

### 12.3 Decisions to rule first -- one at a time, each with a recommendation

- **TR-1 -- routing.** A route may not pass through a non-transiting anchor; it may only end there. A link whose only way passed through one is down, and says so. Recommended.
  Ruled 2026-09-30: as recommended.
- **TR-2 -- a pin there.** A link pinned at a non-transiting anchor is cut there into two links that both end at it, as a junction cuts (B210); turning transit back on joins them again by the join ruling of 2026-09-26. Recommended -- it is exactly the "cut a bend into 2 endpoints, then toggle back to a joined path" the no-history ruling asked for. The alternatives: refuse `w` there, or let a pin pass regardless.
  Ruled 2026-09-30: as recommended; and `w` pressed there while drawing makes two links ending there (TR-2b).
- **TR-3 -- a guide there.** `g` on a non-transiting anchor is refused with a notice, since a guide exists to be passed through. Recommended.
  Ruled 2026-09-30 otherwise: the hand pipe to it is laid, and no route passes through it -- in a link drag the route runs another way and the drawn path is kept as its alternate.
- **TR-4 -- turning it off under live links.** Links routed through the anchor re-route or go down, and heal when it is turned back on. It is a declaration, not a drag, so "a drag that would move an existing link is refused" does not apply. Recommended.
  Ruled 2026-09-30: as recommended.
- **TR-5 -- joining.** Two links left ending at a non-transiting anchor stay two -- section 4's table, confirmed under pipes. Recommended.
  Ruled 2026-09-30: as recommended.
- **TR-6 -- the type table.** Its contents (section 6 is illustrative), and what an anchor with no setting takes: recommended, the table's first value, with bare anchors, routers, firewalls and vxlans offering both and defaulting to transit, and load balancers, servers and hosts offering only `false`.
  Ruled 2026-09-30: as recommended.
- **TR-7 -- where the value lives in the lab.** Recommended: session state in the network session, keyed by anchor, as pipes are -- the stored-format change lands in promotion's format batch (PROMOTION.md, P2), as section 10.3 and survey F6 require. The cost, as with pipes: undo cannot move it until then. The alternative: a stored optional field now, which the production validator would accept and ignore.
  Ruled 2026-09-30: as recommended.
- **TR-8 -- the mark on a node.** Section 9 designed the ring for waypoints; a node's glyph fills the space it would take. Recommended: the same dashed ring, drawn just outside the node's frame -- to be seen in the lab and adjusted by eye before it is settled.
  WITHDRAWN 2026-09-30: the ring is already ruled (section 9) -- radius 10, between the junction and endpoint rings -- and the director confirmed it is settled. On a node, which draws neither of those rings, it is drawn at the same radius and judged by eye in the lab at X1, raised again only if it does not read.

### 12.4 Build order -- each stage matrix-first, gated, and deployed to the lab

Each stage adds its rows to the behaviour matrix before the code, with their RED shown, as the network work did; the gesture corpus is unaffected, because `x` is bound only by the network plugin.

| stage | what lands | decisions | exit criterion |
|---|---|---|---|
| **X1** | **The value and the mark.** `x` as a network key row, flipping each selected anchor independently (section 8); refused, with a readout, where the type offers no choice; the ring drawn on waypoints and nodes | TR-6, TR-7 | pressing `x` on a real anchor in Chrome draws the ring, and again removes it; a host refuses and says why; nothing else on any board changes |
| **X2** | **Routing stops there.** The router treats a non-transiting anchor as a dead end except for a link's own ends; the network view keys on transit; a down link blocked by it says so | TR-1, TR-4 | a link whose shortest way passed through the anchor takes another way or goes down, and heals when `x` is pressed again |
| **X3** | **Pins and guides.** A pin there cuts the link in two, which rejoin when transit returns; `w` there while drawing makes two links; `g` there lays its pipe and the route passes elsewhere | TR-2, TR-3 | the cut and the rejoin are one undo step each, through the planner; a `g` there lays its pipe and no route uses it |
| **X4** | **Joining.** The planner's join leaves links apart at a non-transiting anchor -- a new method of the network interface, answered only by the plugin, so production's join is unchanged | TR-5 | two links left there stay two; with transit on they join, as today |
| **X5** | **Node types.** The per-type table in `network/` (a slice of cut K6), read by the key's refusal, the router and the mark | TR-6 | a host never passes a route and cannot be toggled; a router passes by default and can be |

**Out of scope here:** `flows.transit` (flows are not built); storing the value (promotion's format batch); production.

**What it proves.**\
The original reason for this document, now with the pipes it led to: an author can decide, per anchor and within what each device type allows, whether links pass through or stop -- and see it.

### 12.5 Progress

**X1 -- the value and the mark, 2026-09-30.**
- **`x` is a network key row** (`network/keys.mjs`): with anchors or nodes selected and no drag in progress, it flips each one's transit on its own; a type offering no choice is refused and named in the notice.
- **The table and the settings** are `network/transit.mjs`, held by the network session (TR-6, TR-7); the network answers `declaresNoTransit`, a fifth read of the Model's network interface, which production answers never.
- **The ring draws as ruled,** dashed and light orange: the canvas now passes the anchor to `waypointLayers`, honours a layer's own stroke and dash -- so does the export -- and draws the same ring on a node, at its anchor point, taken from the same list.
- **The plugin host gains one declared verb,** `selected()`, the selection as plain data; the lab redraws the anchors a change names, and its notice says what happened.
- **Nothing else changes:** five matrix rows (TRN-01 to TRN-05) on a new `transit` board, RED before the code; the 43 earlier boards are identical but for an empty ring list; routes still pass a non-transiting anchor until X2.
- **Not yet:** the export cannot draw a ring, since the setting is session state outside the document until promotion stores it.
- **Eight mutants, each caught.**- **Seen in the lab, and kept:** on a router the ring at radius 10 sits over the glyph and is hard to read; the director kept it as ruled -- one rule for all nodes -- and will reconsider the glyph design later.

**X2 -- routing stops there, 2026-09-30.**
- **One predicate, every router.** `passes(id)` -- may a route pass this anchor -- is taken by the router, the share-out of pipes, the preferred way behind the blocker highlight, the board's derivation, the preview of a link not yet held, and the drag judge, so they cannot disagree. A route may begin or end at a non-transiting anchor, never pass it (TR-1).
- **Built once, from the session and the table:** an anchor no route may pass is one declared off, or one whose type offers only off -- a host, a server, a load balancer (TR-6). The board's derivation is keyed on them, so a toggle is a new board state, and links re-route, go down or heal as a matter of course (TR-4).
- **The notice and the why.** A toggle's notice counts what is then down; a selected down link names the anchors whose transit, turned back on, would give it a way -- or, when none would, the device whose type never passes a route. The first version named the host where the anchor just turned off was the one to turn back; it was caught by a test and corrected before landing.
- **Matrix:** six rows (TRN-06 to TRN-11) on the transit board and a new board whose short way runs through a host; TRN-01 gave up its "until X2" routing claims to TRN-06 and kept its subject, the ring. Every earlier board unchanged.
- **Eight mutants, each caught.**- **Found verifying it live:** a down link is hard to click -- about a third of clicks select it, because the browser hit-tests a dotted stroke's dots and not its gaps. It predates transit (down links have been dotted since 2026-09-29); registered as B268, H17.11.

**X3 -- pins and guides, 2026-09-30.**
- **Turning transit off at a pin cuts the link there** into two links ending at it, each up over its own pipe; turning it back on joins the two left ending there, restoring the link the author drew -- the src half keeps the id through the round trip (B213). Each is one edit through the planner, one undo step. `cutAt` and `joinAt` live in `network/transit.mjs`, since where a link may bend is a network rule; the layer scan refused them in the canvas's `commands.js`, rightly.
- **A `w` on a non-transiting anchor while drawing makes two links ending there,** on a waypoint or a node (TR-2b). The drag judge names the cuts and judges each piece as the drag it would have been, the pieces before it made, all or none; Input commits the pieces as one edit, pinned between the cuts. It is one small, generic addition to the judge seam: a judge may cut the drawn link at stops it names.
- **A `g` on a non-transiting anchor** lays its pipe and no route uses it, which X2's routing already gives (TRN-16 passed before this stage's code); where the route runs elsewhere the notice now says the anchor's transit, not a length, is why.
- **The limit TR-7 accepted:** undo moves the document but not the session's transit, so undoing a cut restores the pinned link while transit stays off.
- **Matrix:** five rows (TRN-12 to TRN-16) and a `transit-pin` board; every earlier board unchanged. **Eight mutants, each caught.**

