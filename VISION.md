# drawv2 - vision

> **Status: DRAFT, awaiting director ratification.**\
> Drafted by the engineer on 2026-09-03 from the ratified record, not from recollection: `surveys/b163-rules-system-survey.md`, the rulings carried in the commit corpus, and `docs/BACKLOG.md`.\
> Intent is the one thing no role but the director may supply, so until it is ratified this document states what the record appears to say and nothing more.\
> Authored against `AR6` from the devices rather than a template, per `M6`.
>
> **Two claims were removed on director correction, and the reason is worth keeping.**\
> A first draft excluded *multi-writer* as an enduring non-goal. That was wrong on the facts -- two tabs already write to one diagram, and always have. What exists is single-writer per SERVER INSTANCE, which is a property of the architecture at this instant and belongs to `AR1`. Replace the storage substrate with one that arbitrates writes and the exclusion dies, which is exactly the discriminator that says it was never a vision statement.\
> A first draft also listed *interruption cost* as a success dimension. It is a delta's exit criterion, not a measure of enduring purpose, and it was recency from an incident rather than intent.

---

## What this is

**drawv2 is a programmable geometric engine.**

A document declares geometry - things placed on a grid, and the paths between them.\
Behaviour is not attached to those things; it is a **consequence of where they are**.\
A range is measured in cells, a speed is cells per second, an arrival is a distance reached.\
Nothing in that list is a property stored on a shape.

The editor is intended to be one consumer of the engine among several, with the command surface and any future mod as peers rather than subordinates.\
Today the editor is the only consumer that can drive the world; the others can inspect it.\
That gap is the distance still to travel, not a claim about what exists.

The endeavour is to find out what becomes possible when a diagram stops being a picture of a system and becomes **a world with physics** - and when that world is computed identically by everyone watching it.

---

## What this is not

The negative half is the half that travels, and each of these is a live temptation rather than a hypothetical.

**Not a drawing tool.**\
Coordinates are anchors on a grid, never pixels a hand placed.\
A feature that can only be expressed by nudging something until it looks right does not belong here.

**Not an editor with a scripting hook bolted on.**\
The programmability is the product.\
An editor that grew an extension point would be the same shape from the outside and the wrong thing underneath, because the engine would still be the editor's private property.

**Not a game.**\
Tower defence is the **pilot** - the use case that drives the design and proves the surface is real.\
A pilot earns its place by exercising the engine harder than the editor does.\
The day a feature is justified because it makes the game better rather than because it makes the engine more capable, the pilot has captured the programme.

**Not a system that stores what it can derive.**\
A number copied into a document is a decision that can no longer be changed.\
Derived state is not an optimisation here; it is the reason two peers agree without a protocol.

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

## Why it has value

A diagram of a system tells you what someone believed when they drew it.\
It cannot be wrong in an interesting way, because it asserts nothing that could be checked.

A world with physics can be wrong, and that is the whole of its value.\
Place a thing and consequences follow that nobody wrote down: something is now in range, a path is now longer, a flow now arrives late.\
The diagram stops being a record of a decision and becomes a place to find out whether the decision was any good.

**And because the consequences are derived rather than stored, they are the same for everyone.**\
Two people looking at one world are not comparing two renderings of an agreed picture; they are watching one thing happen.\
That is what makes the world shareable without a protocol for sharing it, and it is why derivation is a constraint on the design rather than an efficiency.

---

## The asymptote

What this tends toward as it matures, stated as a direction rather than a plan.

**These four are also what would count as succeeding**, deliberately as directions rather than as a score.\
A single number would hide the weakest of them, and the weakest is what ends programmes.\
They are expected to disagree - progress along one often costs another - and where they do, the disagreement is information and goes to the board rather than being averaged away.

**Geometry carries more and stores less.**\
The limit is a document that declares only where things are and what was intended, from which everything else follows.\
Every number that remains stored on a shape is distance from that limit.

**Physics becomes extensible rather than fixed.**\
Today the engine knows about motion along paths and consequence within a range, and a new behaviour is a rule expressed over that.\
At the limit the engine holds space, motion and interaction as a first-class layer, and a new kind of force, motion or collision can be introduced without the engine having anticipated it.

**The editor stops being privileged.**\
At the limit no consumer is the primary one, and the world can be driven equally by a person, a command, an agent or a mod - because each is only another observer that also acts.

**The world becomes worth inhabiting rather than only worth reading.**\
The pilot is the first evidence of this and deliberately not the last: a second, unlike world running on the same engine is the point at which the engine is real rather than argued.

These do not converge on a finished state.\
They are directions along which the system can always be further, and a version of this system that had arrived at all four would no longer be this endeavour.

---

## Authority

**Held by the director.**\
Intent is the one input no other role may supply.

Drafted by anyone; ratified only by the director.\
Amended, never quietly rewritten: a ruling that changes direction is recorded as a decision and absorbed here, so the reasoning survives the change.

---

## Boundary with the architecture

This document names no component, and that is a test rather than a style.

Replace every component in the system - a different renderer, a different transport, a different storage substrate - and the statements above are untouched, because none of them was ever about a shape.\
Anything written here that would die in that replacement belongs to the architecture instead, and its presence here is a defect.

Where the system currently *is*, and where it is going, is `AR1`'s subject and is not stated here at any instant.
