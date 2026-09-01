/*
kinds.mjs — what a KIND means, declared once and stored nowhere.

The document says a node is a `loadbalancer` and a spawner emits `packet`s. It does not say that a
loadbalancer shoots, how far, or how much a packet can take. Those are properties of the KIND, and
they live here.

WHY NOT ON THE ENTITY. B172 is the whole argument, learned the expensive way: a spawner used to
store its colour as a hex, so three changes of mind reached only newly armed endpoints and there was
no way to restyle the estate short of rewriting data. Numbers copied into documents are decisions
you can no longer change. Declared centrally, a balance pass is one edit and it reaches every
diagram that has ever existed, including ones nobody has opened since.

It is the shape the tree already uses twice: a node stores `type` and resolves a glyph; a spawner
stores `kind` and resolves a stylesheet class. This is the same move for behaviour rather than
appearance.

EVERY NUMBER IS IN THE GRID'S UNIT OR IN TICKS, never pixels and never milliseconds. B110 rules that
positions are anchors; B176 shows why the derived path must avoid approximated arithmetic. A range
in cells compared against a squared cell distance is exact integer work, so two peers cannot
disagree about whether a creep was in range -- which is the disagreement that would never heal.
*/

// the simulation's fixed timestep. Absolute epoch ticks, so there is no origin for peers to agree
// on: any peer can evaluate any tick from an instant alone. 100ms reads as responsive, and folding
// a minute of history is 600 steps rather than 60,000.
export const TICK_MS = 100;
export const tickAt = (t) => Math.floor(t / TICK_MS);

/*
A node kind that fires.

	range     CELLS, inclusive. Compared as squared cell distance -- integers, no sqrt, no hypot.
	beam      TICKS the laser is on. It is a sustained beam, not a shot: while lit it damages the
	          leading target every tick, re-acquiring as targets die or leave range.
	cooldown  TICKS dark before it may light again. May be 0, which is a beam that never stops --
	          the cooldown is a balance lever and is not assumed anywhere to be present.
	damage    hit points removed per lit tick.

Durations are in TICKS rather than seconds so the schedule is exact. A rate of 3/s would be 3.33
ticks, and that rounding would be a decision made silently, and possibly differently, at each call
site -- the same class of divergence H12.15 removed from the arithmetic.

THE WEAPON IS A LASER, ruled 2026-09-02, and the reason is mechanical rather than cosmetic: a beam
connects to its target instantaneously, so there is no projectile in flight, no travel time, and no
lead to predict. A ballistic shot would need its own position derived every tick and would raise the
question of what happens when its target dies mid-flight. The laser deletes that entire problem.
*/
export const TOWERS = {
	loadbalancer: { range: 3, beam: 10, cooldown: 10, damage: 1 },
};

/*
The full on-off cycle in ticks, and the only place the two durations are combined.

Floored at 1 because the schedule is `tick % cycle`, and a zero cycle would be a modulo by zero --
NaN, which compares false against everything and would leave a tower firing permanently rather than
failing loudly. A kind with no beam at all is a kind that never fires, which is what the floor gives.
*/
export const cycleOf = (t) => Math.max(1, t.beam + t.cooldown);

/*
A mover kind that can be hurt.

`hp` here rather than on the spawner for the same reason as everything else in this file: it is a
property of what a packet IS, not of the endpoint that happened to emit it.
*/
export const MOVERS = {
	packet: { hp: 3 },
};

export const towerFor = (node) => (node && TOWERS[node.type]) || null;
export const moverFor = (kind) => MOVERS[kind] || MOVERS.packet;
