# drawv2 - vision

> **Status: DRAFT, awaiting director ratification.**\
> Drafted by the engineer on 2026-09-03 from the ratified record, not from recollection: `surveys/b163-rules-system-survey.md`, the rulings carried in the commit corpus, and `docs/BACKLOG.md`.\
> Intent is the one thing no role but the director may supply, so until it is ratified this document states what the record appears to say and nothing more.\
> Authored against `AR6` from the devices rather than a template, per `M6`.

---

## What this is

**drawv2 is a programmable geometric engine.**

A document declares geometry - things placed on a grid, and the paths between them.\
Behaviour is *derived from* that geometry by rules, rather than stored beside it.\
The editor is one consumer of the engine among several; the command surface and any future mod are peers of it, not subordinates.

The endeavour is to find out what becomes possible when a diagram is not a picture of a system but a **substrate that can be programmed**, and when the behaviour running on it is derived identically by everyone looking.

---

## What this is not

The negative half is the half that travels, and each of these is a live temptation rather than a hypothetical.

**Not a drawing tool.**\
Coordinates are anchors on a grid, never pixels a hand placed.\
A feature that can only be expressed by nudging something until it looks right does not belong here.

**Not an editor with a scripting hook bolted on.**\
The programmability is the product. An editor that grew an extension point would be the same shape from the outside and the wrong thing underneath, because the engine would still be the editor's private property.

**Not a game.**\
Tower defence is the **pilot** - the use case that drives the design and proves the surface is real. A pilot earns its place by exercising the engine harder than the editor does. The day a feature is justified because it makes the game better rather than because it makes the engine more capable, the pilot has captured the programme.

**Not a system that stores what it can derive.**\
A number copied into a document is a decision that can no longer be changed. Derived state is not an optimisation here; it is the reason two peers agree without a protocol.

**Not multi-writer.**\
One authority per document at any instant. This is a bounded, deliberate limit, not an unfinished feature.

---

## What holding this document does not authorise

This is a statement of purpose. It grants no authority of any kind.

It does not authorise implementation, and citing it is not a design review.\
It does not approve a delta, seed work, or ratify an architecture.\
It does not override a standing commitment: where this document and an axiom appear to conflict, the axiom holds and the conflict is a finding to be raised, not resolved by preferring this page.\
It settles no question that the record has not already settled - and where it is read as doing so, the record wins and this document is wrong.

---

## North star

**Behaviour is derived from a shared document and a shared clock, so that every observer computes the same answer without being told it.**

Three terms are load-bearing and are defined here rather than left to the reader.

**Derived** - computed on demand from inputs every participant already holds. The opposite of *stored* and of *broadcast*. A derived fact is never sent, because sending it would tell a peer something it could already work out.

**Shared document** - the declared geometry and the intent placed on it. It is the only thing that travels between participants.

**Observer** - anything that computes state from the document: a browser, the server, the command surface, a test. Not a spectator; a peer. If two observers can disagree, the north star is not met, regardless of which one is right.

---

## What would count as succeeding

Dimensions, deliberately not collapsible into a score. A single number would hide the weakest one, and the weakest one is the one that ends programmes.

**Parity.** Two observers of the same document at the same instant compute the same state, and the system can prove it rather than assert it.

**Derivation depth.** How much behaviour is computed rather than stored. Measured by what a document does *not* contain: no positions of things in motion, no outcomes, no numbers belonging to a kind.

**Programmability.** Whether a new behaviour can be expressed as a rule over a situation without touching the engine. The pilot is the current evidence; a second, unlike consumer would be stronger.

**Observability without a human relay.** Whether an agent can answer a question about the running system using its own instruments. Every occasion a person is asked to read something back is a failure on this dimension.

**Honesty of the record.** Whether the declared state of the system matches the running one. Drift found by a person rather than by a gate counts against this.

**Interruption cost.** What real use of the system costs its user in lost work, forced reloads, and time spent recovering rather than doing.

They are expected to disagree. Where they do, the disagreement is information and is taken to the board rather than averaged away.

---

## Authority

**Held by the director.** Intent is the one input no other role may supply.

Drafted by anyone; ratified only by the director.\
Amended, never quietly rewritten: a ruling that changes direction is recorded as a decision and absorbed here, so the reasoning survives the change.

---

## Boundary with the architecture

This document names no component, and that is a test rather than a style.

Replace every component in the system - a different renderer, a different transport, a different storage substrate - and the statements above are untouched, because none of them was ever about a shape.\
Anything written here that would die in that replacement belongs to the architecture instead, and its presence here is a defect.

Where the system currently *is*, and where it is going, is `AR1`'s subject and is not stated here at any instant.
