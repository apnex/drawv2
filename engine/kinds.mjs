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

	range    CELLS, inclusive. Compared as squared cell distance -- integers, no sqrt, no hypot.
	period   TICKS between shots. Expressed in ticks rather than shots-per-second so the schedule
	         is exact: a rate of 3/s would be 3.33 ticks and the rounding would be a decision made
	         silently, differently, at each call site.
	damage   hit points removed per shot.
*/
export const TOWERS = {
	loadbalancer: { range: 3, period: 5, damage: 1 },
};

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
