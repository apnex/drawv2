/*
rules.mjs — what is TRUE at a tick, asked rather than announced.

The derivation surface. A rule is a pure function of `(world, tick)` returning FACTS: it decides
nothing, mutates nothing and sends nothing. "Tower A is firing at packet 47 on tick 412" is a
question anybody can ask and everybody answers identically.

WHY LEVEL-TRIGGERED AND NOT EVENT-HANDLERS. This was chosen against prior art rather than by taste.
Factorio's shape -- declare data, then hook `on_event` -- is the closest to how the director
described the goal, and it is the one to avoid: a handler surface requires every peer to receive
every event in order, and a peer that misses one diverges permanently. That is what obliges those
games to run deterministic lockstep with hash exchange and a resync path.

Kubernetes' shape -- controllers that reconcile from state rather than react to events -- needs only
shared state. A peer that misses everything and reconnects simply recomputes. That is why a third
client joining this diagram already costs nothing, and it is the property worth protecting above
convenience.

THE ONLY THING THAT TRAVELS IS WHAT CANNOT BE DERIVED. A player placing a tower is intent, and rides
the document machinery that already orders and broadcasts it. A tower firing is not intent -- it is
implied by the board and the clock, so broadcasting it would be sending the receiver something it
already knows.

WHAT A RULE MAY NOT DO, and the boundary is load-bearing: it may not write. A rule that incremented
a score or deleted a creep would be creating state nobody else derived, and parity would need a
protocol. Mutation stays with player intent. Ruled 2026-09-01.
*/

import { moversAt } from './movers.mjs';
import { spawnersOf } from './spawners.mjs';
import { towerFor, moverFor, tickAt, TICK_MS } from './kinds.mjs';
import { STD } from '../kernel/spec.mjs';

const PITCH = STD.pitch;

/*
The board at rest: everything a rule reads, gathered once.

Prepared rather than passed a model, so a rule cannot reach for anything it was not given -- the
same Air-Gap reasoning that keeps the situation object inert. `towers` carries pixel positions
because movers are measured in pixels; the RANGE comparison below converts to cells and squares,
which keeps the decision itself in exact integer arithmetic.
*/
export function worldOf(model) {
	const towers = [];
	for (const n of model.all('node')) {
		const spec = towerFor(n);
		if (spec) towers.push({ id: n.id, x: n.x, y: n.y, ...spec });
	}
	// deterministic order: two peers must iterate towers identically or their shots differ
	// ids in a document are distinct, so `<` and `<=` order identically here and in the tie-break
	// below: both are equivalent mutants and neither is killable. Survivors accepted.
	towers.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
	const spawners = spawnersOf(model);
	return { towers, spawners, byId: new Map(spawners.map((s) => [s.id, s])) };
}

// squared distance in CELLS, as integers where the grid is integral. No sqrt, no hypot: B176.
const inRange = (tower, at) => {
	const dx = (at[0] - tower.x) / PITCH, dy = (at[1] - tower.y) / PITCH;
	return dx * dx + dy * dy <= tower.range * tower.range;
};

/*
THE RULES. Two exist, and they are the same construct with different triggers -- which is the
evidence that made this surface worth extracting rather than imagining.
*/
export const DERIVATIONS = [
	{
		id: 'tower-fires',
		about: 'a tower fires on its own schedule at the mover furthest along, within range',
		facts(world, tick, alive) {
			const out = [];
			for (const t of world.towers) {
				// the schedule is the tick index itself, so it needs no origin and no placement time.
				// Every tower of a period fires together, which is visible and deliberate: staggering
				// would need a per-tower phase, and a phase derived from an id is a hash nobody can
				// predict from the board.
				if (tick % t.period !== 0) continue;
				/*
				ONE target per shot, the furthest along its route. Deterministic by construction:
				progress is a number both peers derive, and the id breaks a tie so the answer never
				depends on array order. "Furthest along" is also the only choice that plays like a
				tower defence -- it shoots what is about to escape.
				*/
				const targets = alive.filter((m) => inRange(t, m.at));
				if (!targets.length) continue;
				targets.sort((a, b) => (b.progress - a.progress) || (a.id < b.id ? -1 : 1));
				out.push({ kind: 'hit', tower: t.id, target: targets[0].id, damage: t.damage, tick });
			}
			return out;
		},
	},
];

export const factsAt = (world, tick, alive) =>
	DERIVATIONS.flatMap((r) => r.facts(world, tick, alive) || []);

/*
The fold: hit points accumulate, so state at a tick is history rather than a snapshot.

This is the cost the director accepted when creeps became destructible. `moversAt` answers any
instant in one step; damage does not, because a creep's condition depends on every shot before it.
So the window is folded forward, tick by tick.

BOUNDED BY THE LONGEST TRANSIT, not by how long the diagram has existed. Nothing that departed
before the oldest living mover can still be alive, so there is nothing before that to replay -- a
spawner armed an hour ago costs exactly what one armed a minute ago costs. The same reasoning that
bounds `moversAt`'s window bounds this one.

The result is a MEMO, not a truth: any peer can compute it alone and they agree, because they are
folding the same function over the same inputs. Nothing here needs synchronising.
*/
export function combatAt(world, t) {
	const now = tickAt(t);
	// `pxSpeed > 0` guards a division the validator already prevents -- speed has a floor of 0.1, so
	// this branch is unreachable from any stored document and mutation cannot kill it. Kept because
	// worldOf is also fed hand-built fixtures. Survivor accepted, per tools/mutate.mjs.
	const transit = Math.max(0, ...world.spawners.map((s) => (s.pxSpeed > 0 ? (s.length / s.pxSpeed) * 1000 : 0)));
	// the trailing -1 is a margin, not a boundary: one tick before the oldest possible departure.
	// Mutating it shifts the window into slack, so no test can kill it. Survivor accepted.
	const from = now - Math.ceil(transit / TICK_MS) - 1;

	const hp = new Map();         // mover id -> remaining
	const dead = new Map();       // mover id -> tick it died
	const hits = [];

	for (let tick = from; tick <= now; tick++) {
		const alive = moversAt(world.spawners, tick * TICK_MS)
			.filter((m) => !dead.has(m.id));
		for (const f of factsAt(world, tick, alive)) {
			if (f.kind !== 'hit') continue;
			const max = moverFor(world.byId.get(f.target.split('#')[0]).kind).hp;
			const left = (hp.has(f.target) ? hp.get(f.target) : max) - f.damage;
			hp.set(f.target, left);
			hits.push(f);
			if (left <= 0) dead.set(f.target, tick);
		}
	}
	const alive = moversAt(world.spawners, now * TICK_MS).filter((m) => !dead.has(m.id));
	return { tick: now, alive, dead, hp, hits: hits.filter((h) => h.tick === now) };
}
