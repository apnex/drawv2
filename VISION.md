# drawv2 - vision

**Status: enduring.**\
Ratified by the director on 2026-09-03.\
This document states why drawv2 exists and what it will never be.\
It carries no current state, no roadmap, and no schedule.

Holding this document authorises nothing.\
It does not ratify a decision, approve a change, or promote code.\
A direction change is recorded as a decision and absorbed here afterwards, so the reasoning behind a change survives the change.
---

## What this is

**drawv2 is a programmable geometric engine.**

A document declares geometry - things placed on a grid, and the paths between them.\
Everything else that happens is a consequence of that geometry rather than a property recorded beside it.

The endeavour is to find out what becomes possible when a diagram stops being a picture of a system and becomes **a world with physics** - and when that world is computed identically by everyone watching it.

---

## What this is not

The negative half is the half that travels, and each of these is a live temptation rather than a hypothetical.

**Not a drawing tool.**\
Coordinates are anchors on a grid, and a position is a statement about where a thing is rather than where it was dropped.\
Anything that can only be expressed by nudging until it looks right has no consequence the engine can compute, and belongs in a tool whose output is a picture.

**Not an editor with a scripting hook bolted on.**\
The engine is the product and the editor is one of its consumers, so behaviour is expressed against the world rather than against the editor's internals.\
An editor that grew an extension point would look identical from outside and be the wrong thing underneath, because the engine would remain the editor's private property.

**Not a game.**\
Tower defence is the **pilot**: it earns its place by exercising the engine harder than the editor does, and every capability it needs is built as a general one.\
A feature justified because it makes the game better rather than the engine more capable is the pilot capturing the programme, and is refused on those grounds.

**Not a system that stores what it can derive.**\
What can be computed from geometry and a clock is computed on demand, so a change of mind reaches everything at once.\
A number copied into a document is a decision that can no longer be changed, and a document full of them is a save file rather than a statement of intent.

---

## What holding this document does not authorise

This is a statement of purpose.\
It grants no authority of any kind.

It does not authorise implementation, and citing it is not a design review.\
It does not approve a delta, seed work, or ratify an architecture.\
It does not override a standing commitment: where this document and an axiom appear to conflict, the axiom holds and the conflict is a finding to be raised, not resolved by preferring this page.\
It settles no question that the record has not already settled - and where it is read as doing so, the record wins and this document is wrong.

---

## North star

**A diagram is not a picture of a system but a world with physics, where geometry is the program and everyone watching sees the same thing happen.**

Four terms are load-bearing and are defined here rather than left to the reader.

**Physics** - rules that hold over the whole world by construction, so that a consequence follows from a position rather than from a property somebody set.\
This is the aim in two degrees, and the difference between them decides what the engine must eventually expose.

- **Derived physics.** Position, distance, range and arrival are computed from geometry and a clock. Consequences are asked for, never announced.
- **Extensible physics.** The engine holds space, motion and interaction as a first-class layer, and a mod introduces a new kind of force, motion or collision rather than a new rule over a situation.

Both are intended.\
Only the first is built, and a vision that did not say so would read as a claim.

**Geometry is the program** - what a thing does follows from where it is and what it is connected to.\
A behaviour that can only be expressed by storing a number on a shape is a behaviour this engine has failed to express.

**Everyone watching** - anything that computes state from the document: a browser, the server, the command surface, a test.\
Not a spectator; a peer.\
If two of them can disagree, the north star is not met, regardless of which one is right.

**Sees the same thing happen** - each computes the world from inputs it already holds, rather than being told the outcome.\
A consequence is never sent, because sending it would tell a peer something it could have worked out.

---

## Why this exists

People reason about spatial systems by drawing them, and then the drawing cannot answer any question about the thing it drew.\
The available answers each solve a different problem.

A **diagramming tool** produces a picture that asserts nothing checkable.\
It records what someone believed when they drew it, so it cannot be wrong in an interesting way and nothing follows from moving a box.

A **simulation** computes consequences, but its world is authored in code rather than drawn, so the thing you reason about and the thing that runs are two artefacts that drift.

A **game engine** has physics and a world, and hands you a scene graph rather than a document - there is nothing to review, diff, or hand to someone else as a statement of intent.

A **modelling or CAD tool** is precise about geometry and silent about behaviour: it will tell you two things collide, and never what happens over time when they do.

Each is strong where the others are weak, and none of them lets the drawing *be* the running thing.

drawv2 makes the document and the world the same artefact.\
Place a thing and consequences follow that nobody wrote down: something is now in range, a path is now longer, a flow now arrives late.\
The drawing stops being a record of a decision and becomes the place to find out whether the decision was any good.

**And because the consequences are derived rather than stored, they are the same for everyone.**\
Two people looking at one world are not comparing two renderings of an agreed picture; they are watching one thing happen.\
That is what makes the world shareable without a protocol for sharing it, and it is why derivation is a constraint on the design rather than an efficiency.

---

## The asymptote

What this tends toward as it matures, stated as a direction rather than a plan.

**These three are also what would count as succeeding**, deliberately as directions rather than as a score.\
A single number would hide the weakest of them, and the weakest is what ends programmes.\
They are expected to disagree - progress along one often costs another - and where they do, the disagreement is information and goes to the board rather than being averaged away.

**Geometry carries more and stores less.**\
The limit is a document that declares only where things are and what was intended, from which everything else follows.\
Every number that remains stored on a shape is distance from that limit.

**Physics becomes extensible rather than fixed.**\
Today the engine knows about motion along paths and consequence within a range, and a new behaviour is a rule expressed over that.\
At the limit the engine holds space, motion and interaction as a first-class layer, and a new kind of force, motion or collision can be introduced without the engine having anticipated it.\
The pilot is the first evidence and deliberately not the last: a second, unlike world running on the same engine is the point at which the engine is real rather than argued.

**The editor stops being privileged.**\
Today it is the only consumer that can drive the world; the command surface and any future mod can inspect it.\
At the limit no consumer is the primary one, and the world is driven equally by a person, a command, an agent or a mod - because each is only another observer that also acts.

These do not converge on a finished state.\
They are directions along which the system can always be further, and a version of this system that had arrived at all three would no longer be this endeavour.

---

## Authority

**Held by the director.**\
Intent is the one input no other role may supply.

Drafted by anyone; ratified only by the director.\
Amended, never quietly rewritten: a ruling that changes direction is recorded as a decision and absorbed here, so the reasoning survives the change.

---

## Related records

This document carries no current state and no next move.\
Where each of those lives, so a reader who wants them does not mistake this for them.

| Record | Holds |
|---|---|
| [`docs/BOARD.md`](docs/BOARD.md) | The live, triaged set of legal next moves |
| [`docs/BACKLOG.md`](docs/BACKLOG.md) | What was consciously not done, each row with a revival trigger |
| [`docs/spec/`](docs/spec/) | The system's design of record, per concern |
| [`surveys/`](surveys/) | Captured director intent, ahead of each design commitment |

**There is no architecture record yet.**\
`docs/spec/SCOPE.md` is the closest thing and it describes an earlier endeavour, which is a known gap rather than an oversight.\
Until one exists, this document is the only statement of purpose and nothing states the system's shape at an instant.

---

## Boundary with the architecture

This document names no component, and that is a test rather than a style.

Replace every component in the system - a different renderer, a different transport, a different storage substrate - and the statements above are untouched, because none of them was ever about a shape.\
Anything written here that would die in that replacement belongs to the architecture instead, and its presence here is a defect.

Where the system currently *is*, and where it is going, is `AR1`'s subject and is not stated here at any instant.

---

## Mechanics, rationale, and consequence

### Mechanics

The north star is one quotable sentence whose load-bearing terms this document defines.\
The boundary is stated positively, saying what happens instead rather than only what will not.\
What would count as succeeding is a set of directions with an explicit refusal to collapse them.\
Authority names one holder, and the document carries no point-in-time state.

### Rationale

A programme is asked, repeatedly, whether some proposal is in scope.\
Without a written purpose that question is answered from whoever is in the room, which works while the founder is present and stops working the moment they are not.\
Stating the boundary positively matters more than stating the purpose, because the exclusions are what a proposal actually collides with.

### Consequence of violation

Each of these was observed while drafting this document, which is why they are stated as consequences rather than as advice.

- Purpose left unwritten makes every scope question a matter of memory, and the answer changes with the reader.
- A purpose with no stated exclusions has not been bounded, and anything can be argued into it by resemblance.
- A recent lesson promoted to enduring identity survives long after the incident that taught it, and reads as intent to everyone who arrives later.
- A north star that names a mechanism rather than a purpose is true and useless: it describes how, and a board cannot rank against it.
- A single success score hides its weakest dimension, which is the one that should be driving the next move.
- Point-in-time state under an enduring status makes one line declare the currency of both, and the stale half is trusted because the fresh half is.
- An intent statement that reads as an approval will eventually be cited as one.
