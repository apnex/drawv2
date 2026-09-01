/*
movers.mjs — WHICH movers exist at an instant, and where each one is.

The simulation, and nothing else. It does not know what a document is, it cannot see a DOM, and it
never asks what time it is. `t` arrives as an argument and routes arrive already described, so this
unit is understandable and testable from its contract alone (A3 Local Reasoning), and the same call
answers identically in a browser, on the server, and in a test with no browser anywhere near it.

THE LOAD-BEARING PROPERTY IS THAT A MOVER IS DERIVED, NEVER STORED.

  travelled(k, t) = (t - since - k*interval) * speed / 1000

A mover is alive while `0 <= travelled <= length`. It is "consumed" at the far end by that
inequality going false -- there is no destruction step, because there was no creation step. Nothing
is allocated, nothing is synced, nothing is torn down.

Three consequences, and they are the reason this shape was chosen over an entity list:

  the log is untouched   `server/log.mjs` caps history at LOG_MAX = 100 records with oldest-first
                         eviction. A mover that entered the transaction boundary at frame rate would
                         evict the whole of a person's real undo history in under two seconds.

  parity is free         two peers holding the same document and the same clock compute the same
                         answer without exchanging one message about it (A5). Nothing is broadcast,
                         so nothing can be missed, arrive late, or be applied out of order.

  it is queryable        a tower asking "what is in range of me" reads numbers, not pixels. The
                         answer exists without a renderer having drawn anything.

WHAT THIS DELIBERATELY CANNOT DO. A mover that takes damage, is slowed, or dies early is not a
function of time, and this unit will never express one. That is the sparse-overlay tier named in
`surveys/b163-rules-system-survey.md`: the closed form stays the baseline for the overwhelming
majority that never deviate, and only the deviations get stored. Stable identity is what makes that
addition possible without a rewrite, which is why a mover carries `spawnerId` and `k` rather than an
index into whatever array happened to be built this frame.
*/

import { routeGeometry, pathLength, pointAtDistance } from '../kernel/router.mjs';
import { STD } from '../kernel/spec.mjs';

/*
B172 -- `speed` is authored in CELLS per second and the geometry is in pixels, so the conversion
happens ONCE, here, at the boundary between the two. Everything below this line is px/s.

Cells is the authored unit because the grid is this system's unit of distance (B110), so a stored
speed keeps its meaning if the pitch ever changes. Pixels is the computed unit because that is what
a path is measured in. Converting at the edge is what keeps both true at the same time.
*/
const PITCH = STD.pitch;

/*
A runtime bound, not a document limit -- so it is here rather than in `model/limits.mjs`, whose
opening line scopes it to "the caps on user-supplied values" and which already keeps a list of what
it excludes and why. Mixing a derived safety bound into that file would give it a second concern.

It exists because `interval` and `speed` are authored numbers: a fast spawner on a long route asks
for length/(speed*interval) movers at once, and a careless pair of values asks for a million. The
cap makes a bad configuration LOOK wrong -- a sparse trickle -- rather than freeze the tab.
*/
export const MAX_MOVERS_PER_SPAWNER = 256;

/*
A spawner descriptor is plain data, on purpose: `{ id, pts, close, radius, since, interval, speed }`.
It carries a route as POINTS rather than as a link id, so the simulation never reaches into a model
to find out what it is working on (A3 Air-Gap). Whatever owns the document is responsible for
handing over a description; that adapter is somebody else's one concern.

  since     epoch ms -- when this spawner was armed. Shared, so every peer agrees on the phase.
  interval  ms between departures
  speed     px per second
*/
export function prepareSpawner(spawner) {
	const { pts, closed = false, radius = 20 } = spawner || {};
	const geo = routeGeometry(pts, radius, closed);
	// `pxSpeed` is the only speed anything below uses; `speed` stays as authored so a caller
	// reading a prepared spawner back sees the number it supplied rather than a derived one.
	const pxSpeed = typeof spawner?.speed === 'number' ? spawner.speed * PITCH : 0;
	return { ...spawner, geo, length: pathLength(geo), pxSpeed };
}

// whether a prepared spawner can produce anything at all. A zero-length route, a non-positive
// interval or a non-positive speed each describe a spawner that emits nothing, and each would
// otherwise divide by zero or loop forever.
/*
SURVIVORS RECORDED, so the next reader does not rediscover them.

`tools/mutate.mjs` reports three survivors on this line and one on the `elapsed >= 0` guard below.
They are REDUNDANT rather than untested: each condition here is covered by another, so relaxing one
alone changes no answer. `geo.length > 0` is subsumed by `length > 0` -- an empty decomposition has
no length -- and a spawner failing either fails both. The `>= 0` guard survives on the single
instant `elapsed === 0`, where admitting or refusing the not-yet-departed mover gives the same
empty set.

Kept as separate conditions because each names a distinct way to be silent, and a reader asking
"can a zero-speed spawner emit" should find `speed > 0` rather than infer it. Documented instead of
deleted or allow-listed: an allow-list moves the fact away from the code it is about.
*/
const emits = (s) => s && s.geo && s.geo.length > 0 && s.length > 0 && s.interval > 0 && s.pxSpeed > 0;

/*
The movers alive at `t`, in departure order, across every prepared spawner.

Only the live window is walked, never every mover since the spawner was armed: the earliest one
still travelling is bounded by the route's own transit time, so an endpoint armed an hour ago costs
the same as one armed a second ago.
*/
export function moversAt(prepared, t) {
	const out = [];
	for (const s of prepared || []) {
		if (!emits(s)) continue;
		const transit = (s.length / s.pxSpeed) * 1000;        // ms from departure to consumption
		const elapsed = t - s.since;
		if (!(elapsed >= 0)) continue;                      // armed in the future: nothing yet
		const newest = Math.floor(elapsed / s.interval);
		const oldest = Math.max(0, Math.ceil((elapsed - transit) / s.interval));
		/*
		B173 -- the cap is PER SPAWNER, as its name has always said.

		It was checked against the shared output array, so the first spawner could consume the whole
		budget and every one after it emitted NOTHING. Two saturating spawners produced 256 movers
		and zero: not a throttle, a starvation, and silent -- the second endpoint simply looked
		unarmed. Found while investigating a two-spawner report that turned out to be something
		else; the reproduction needs 256 movers, which is why nobody had hit it.
		*/
		let mine = 0;
		for (let k = oldest; k <= newest && mine < MAX_MOVERS_PER_SPAWNER; k++) {
			const travelled = ((elapsed - k * s.interval) / 1000) * s.pxSpeed;
			/*
			A FLOATING-POINT BACKSTOP. The window above is what decides liveness.

			Mutation settled this after two wrong readings, so the whole matrix is recorded rather
			than the conclusion alone:

			  window ok  + this present  correct, fast          <- shipped
			  window ok  + this DELETED  correct, fast          <- so this is dead given a sound window
			  window BAD + this present  correct, 153ms/year-of-arming
			  window BAD + this DELETED  wrong

			The window is exact by construction: k >= oldest gives elapsed - k*interval <= transit
			and hence travelled <= length; k <= newest gives travelled >= 0. What construction does
			NOT guarantee is that `ceil` and `floor` over float division land the same side of a
			boundary as the multiplication below them, so this catches an off-by-one-ULP at an exact
			departure or arrival instant, and nothing else.

			It is kept because it costs one comparison and the failure it covers is silent. It is
			LABELLED because the row above it -- correct and fast with this deleted -- is what a
			future reader will find when they mutate it, and they should not have to rediscover why
			no test bit. The window is tested by COST, which is the only way its absence shows.
			*/
			if (travelled < 0 || travelled > s.length) continue;
			mine++;
			out.push({
				id: `${s.id}#${k}`,          // stable identity -- the seam the deviation tier needs
				spawnerId: s.id,
				k,
				travelled,
				progress: travelled / s.length,
				at: pointAtDistance(s.geo, travelled),
			});
		}
	}
	return out;
}

// Where one mover is, without building the whole set. The query a tower will ask, and the reason
// the answer is a function rather than a lookup into something the renderer happened to populate.
export function positionOf(prepared, k, t) {
	if (!emits(prepared)) return null;
	const travelled = ((t - prepared.since - k * prepared.interval) / 1000) * prepared.pxSpeed;
	if (travelled < 0 || travelled > prepared.length) return null;
	return pointAtDistance(prepared.geo, travelled);
}
