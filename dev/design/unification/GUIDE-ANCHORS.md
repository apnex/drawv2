# Guide anchors -- routing through a point without connecting to it (PROPOSED)

## 1. Status

- **Written:** 2026-09-28, against drawv2 at `ecf06e2` (branch `main`), from a live design conversation with the director on the same day.
- **This document proposes; it decides nothing.** Section 8 lists what is open.
- **It follows `TRANSIT.md`.** That document settled what an anchor does with what reaches it. This one settles how an author says a link should go THROUGH a point without meeting it there.
- **Every claim about today's behaviour names its source.** Where something is the proposer's reading it says so.

---

## 2. The gap this closes

The 2026-09-26 ruling already draws the line this proposal needs:

> On its routed stretch a link CROSSES the points it passes; it connects only at its ends and its pins.

So an anchor has two entirely different relationships with a link, and only one of them counts:

| relationship | how it arises | is it a termination |
|---|---|---|
| crosses | the derived route passes through | no -- the matrix does not see it |
| connects | an end, or a pinned via | yes |

Crossing is therefore the mechanism by which two links share an anchor without meeting.\
It is ruled, it is derived, and it needs nothing new.

**The gap is that an author cannot DRAW one.**\
`w` during a drag does four things at once: it drops an anchor, lays a pipe from the previous anchor to it, PINS the link to it, and continues the draw.\
A pin is a connection, so every bend an author draws is a connection, and two links bent through one anchor make four terminations and a junction whether or not the author wanted one.\
The crossing case is reachable only by accident -- when a derived route happens to pass a point -- and never on purpose.

---

## 3. The proposal: a second bend key

A second key during a link drag, `g` for now, doing everything `w` does EXCEPT the pin.

| action | `w` | `g` |
|---|---|---|
| drop an anchor | yes | yes |
| lay a pipe from the previous anchor | yes | yes |
| **pin the link to it** | **yes** | **no** |
| continue the draw while the button is down | yes | yes |

`g` is free as a plain key today; `meta+g` is group and `meta+shift+g` is ungroup (`app/src/keymap.js:122-123`).

What the author is saying differs, and the difference is worth stating in their own terms:

- **`w`** -- the link goes through here, AND connects here.
- **`g`** -- the link goes this way, and does not touch this point.

---

## 4. The commit differs, and this is the substantive part

**`w` needs no end-to-end check at mouse-up**, because the author has already pinned each hop by hand.\
Every pin is in the link's intent, each leg lays a direct pipe between consecutive pins, and a direct pipe is by construction the cheapest way between them.\
So the route the author drew IS the derived route, leg by leg, and nothing at the end can contradict it.

> **CORRECTED 2026-09-30.** Once pipes carry one link each (`dev/DECISIONS.md`, "Pipes carry one link each, for now"), a `w` leg can land on a pipe another link already holds, so a `w` drag can be refused at mouse-up after all. The lab runs the whole-route check for every drag, `w` included, so the check needs no new place. The paragraph above is kept as written, per the frozen-history rule.

**`g` needs a whole-route check at mouse-up.**\
A guide anchor is NOT in the intent -- intent is ends plus pinned vias (`DECISIONS.md:496`) -- so the route through it is derived, and between two pins the route is the cheapest path over the pipes (`DECISIONS.md:501`, SD9).\
Whether the cheapest path actually runs through the guide anchors the author dropped cannot be known leg by leg; it is a property of the whole route.

So on mouse-up the drag is resolved as one transaction: route from the originating anchor to the final anchor over all pipes, honouring every `w` pin, and check that the result passes through the `g` anchors as drawn.\
The link is then committed or refused as a whole.

> **CORRECTED 2026-09-30.** A `g` route the link would not follow is no longer refused: the director ruled "Link runs the shorter way" (`dev/DECISIONS.md`). The link is committed on the fewest-pipes way, the pipes drawn are kept as its alternate, and the notice names the guides it skips. The whole-route check still runs, and still refuses a way that is held or missing. The text above is kept as written, per the frozen-history rule.

This is a departure from today's per-leg validation and is the main cost of the proposal.

---

## 5. What a guide anchor is, once committed

Nothing.\
That is the point, and it is worth stating plainly because it is easy to assume otherwise.

A guide anchor is an ordinary anchor with a pipe on each side.\
The link does not reference it, does not store it, and does not hold it: the link stores its ends and its pins, and the guide anchor is in neither.\
The link runs through it only for as long as that remains the cheapest path.

**The consequence the author must understand:** delete a pipe elsewhere and the route may move OFF a guide anchor that was deliberately placed.
`w` holds; `g` does not.\
Whether that is acceptable or surprising is open (section 8).

---

## 6. What it buys

**Two links through one anchor, neither connected.**\
Both cross, the matrix counts zero terminations, and the anchor is not a junction.\
This is the case the director asked for, and it needs no new dimension: no second junction per anchor, no VRF-like construct, no change to how pipes work.

**It keeps `transit` and pinning orthogonal, which they are.**\
`transit` is a property of an ANCHOR: does what reaches me pass through, for everything that reaches me.\
A pin is a property of a LINK: do I connect at this point.\
`g` is how an author declines to pin.\
They compose without overlapping.

**It makes the 09-26 ruling reachable.**\
That ruling defined crossing as the ordinary case for a routed stretch.\
Today an author cannot produce one deliberately.\
This is the missing gesture rather than a new concept.

---

## 7. Why the alternatives were not taken

**Pipes are the wrong layer.**\
SD7's "parallel cables share it" is about two links sharing one pipe, which is adjacency.\
Crossing is about whether a link CONNECTS at a point, which is settled a layer up, at the link's intent.

**A second junction per anchor (a VRF-like construct)** would let one anchor hold two independent meeting points.\
It is a real network concept and it is a much larger model change: a new dimension on every anchor, and a new thing for every rule that reads roles to know about.\
Crossing already gives independence without it, so nothing yet demands it.\
Recorded as considered and not needed, rather than rejected.

**Making `w` itself not pin** was not considered seriously: it would silently change what every existing document means, and pins are load-bearing in the intent.

---

## 8. Open -- not settled by this document

1. **Is `g` the key.** It is free, and near `w` and the `wasd` cluster under the left hand, which is the reason the transit key is `x`. Not chosen.
2. **What a refused commit shows.** A `g` drag can now fail at mouse-up, which no drag does today. What the author sees, and whether the drawn route is kept for correction or discarded, is undesigned.
3. **Whether a guide anchor should be held after all.** The proposal lets a route move off one. An alternative is a third state -- in the intent for routing, but not a connection -- which would hold the route without making a termination. That is a stored-format change and a new concept; this proposal deliberately does not take it.
4. **What happens when a later edit makes a guide anchor unreachable.** Under SD9 the route simply moves; whether the author is told is open.
5. **Whether a landing on a guide anchor cuts the link.** The 09-26 ruling says a landing cuts at a pinned point and crosses at an unpinned one, so the proposer's reading is that it does NOT cut. Not asked.
6. **Interaction with `transit: false`.** An anchor that refuses transit and is crossed by a link: the crossing is not a termination, so the proposer's reading is that transit does not apply to it at all. Worth confirming, because it is the kind of interaction that looks obvious and is not.

---

## 9. What this would amend

- **Nothing is overturned.** The 09-26 crossing ruling is unchanged; this makes it reachable by an author.
- **`TRANSIT.md` is unaffected.** Transit governs terminations; a crossing is not one.
- **The per-leg commit becomes per-leg for `w` and whole-route for `g`**, which is new behaviour rather than an amendment, since no gesture produces an unpinned bend today.

---

## 10. Tentative decisions, to reach lab validation

The director's instruction on 2026-09-28: "I dont mind making tentative decisions now to progress to lab validation.\
Then we refine gestures, behaviour and keybinds further."\
So the following are taken as WORKING ANSWERS, chosen to be cheap to reverse, and every one of them is reopenable once the lab can show the gesture.\
They are recorded here rather than in `dev/DECISIONS.md` precisely because they are not rulings.

> **CORRECTED 2026-09-28.** T1 below is true of the RULED link model and false of the PRODUCT. Building `g` found that the product has no pipes -- its kinds are node, waypoint, link, zone and group, and `pathOf` draws a link as a straight polyline through `via` with no routing -- so there is no router for a guide anchor to steer. The proposal was reasoned against a model that is ruled but not built. Resolved by the director's ruling the same day: the lab incubates the network plugin in `network/`, and `g` is built there. The line is kept as written below, per the frozen-history rule.

**T1.\
`g` needs NO stored-format change, which is why this can be built before the format batch.**\
A pin is a `via` entry; a guide anchor is simply not in the intent.\
So `g` does not ADD a field, it OMITS one: `w` at an anchor appends it to `link.via`, `g` at an anchor does not, while both create the anchor and its pipes.\
Every document either gesture produces is one today's validator already accepts (`model/shape.mjs:25,34` -- `via` is both composite and optional).\
Survey F6 holds every stored-format change to one batch landing last; this proposal is outside that constraint, and that is what makes it testable now rather than after the batch.

**T2.\
The leading-`w` mandate is NOT taken.**\
`mousedown` still starts a link, as today.\
The alternative considered was requiring a `w` before a drag counts as a link, so that a drag with no `w` lays pipes only.\
It buys a clean answer to pipe lifetime and gives laying pipes without a link its own gesture, but it changes the meaning of the most-used gesture in the application: `mousedown A ... mouseup B` would silently produce pipes and no link.\
Deferred rather than rejected, because the lab is the place to feel that rather than argue it.

**T3.\
A `g`-only drag lays pipes and no link -- the FIRST bend key decides.**\
Press `g` before any `w` and the drag is a pipe-laying drag.\
Press `w` first and it is a link drag, in which later hops may be `w` or `g`.\
This keeps T2's gain -- pipes without a link, and a clean pipe-lifetime test -- without changing the no-bend case.

**T4.\
A `g`-pipe is HAND-PLACED for lifetime purposes.**\
The 09-27 ruling gives two kinds of pipe: laid automatically with a link (removed once no link remains on it) and placed by hand (stays until deleted).\
A `g`-pipe fits neither cleanly, and reading it as automatic is unstable: a guide anchor holds the route only while it stays cheapest, so a cheaper path appearing elsewhere would delete routing geometry the author deliberately placed, and deleting the shortcut would not bring it back.\
Taken tentatively as hand-placed, on the reading that "by hand" means THE AUTHOR CHOSE THIS GEOMETRY rather than the author used the pipe tool.\
This reinterprets a ruling and must be put to the director properly once the lab shows the behaviour.

**T5.\
Unresolved and deliberately left so: does a link CROSSING a pipe count as a link remaining on it.**\
The lifetime rule says a pipe goes when no link remains on it.\
With guide anchors that is ambiguous between a link crossing the pipe and a link pinned at both its ends.\
It is the crossing-versus-connecting distinction again, at the pipe layer, and nothing has ruled it.\
No working answer is taken because the lab will produce the case directly.
