/*
Reveal -- when a committed entity becomes VISIBLE, derived rather than stored.

  revealedAt(reveal, t)   the set of entity ids shown at instant t
  beatsOf(reveal, t)      which beat is current, and the caption to display

`durationOf` is deliberately NOT exported: how long a beat takes is an internal step of the
schedule, and an export nothing calls is a surface that can drift from its only use.

Sovereign duty: the arrival of structure over time, and nothing else. It reads a reveal record and
an instant and answers; it knows no document, no renderer, no clock. Both peers load it, the same
way both load `engine/movers.mjs`.

H14.4 -- what this is and is not.

A beat's ops apply IMMEDIATELY and completely, exactly as a set does: one transaction, one version,
one undo. The document is never a function of time, and `draw get` answers the same at every
instant. What a beat adds is a record saying when each op's RESULT becomes visible, so the unfurl is
presentation over a complete document rather than a document that grows.

That is the H12 shape one level down. `moversAt` derives motion over a static board; this derives
the arrival of structure over a static document. Neither stores what it can compute.

**At most one instant is stored** -- `reveal.origin`. A queued beat carries no timestamp of its own:
its start is the origin plus the durations of the beats ahead of it. So no stamp can go stale, no
promoter has to advance a queue, undoing or cancelling a beat recomputes everything after it for
free, and a late joiner derives the same position as everyone else from the same given.

B177 is the standing evidence for storing one instant rather than many: two tabs disagreed about the
time by tens of seconds because a stamp crossed a machine boundary. One origin, compared against
each viewer's own clock, is the smallest surface that can carry.
*/

/*
How an entity ARRIVES -- H14.12, ruled by the director.

A node fades. A link TRACES from source to destination, because a link has a direction and a fade
throws it away: `spine-1 -> leaf-2` is a statement about reaching, and watching it reach is the
point. The drawing is a dash-offset the renderer animates; what lives here is only the arithmetic
saying how long, so it can be reasoned about without a browser.

Two modes, because a fabric holds links of very different lengths and neither answer is always
right. FIXED DURATION gives every link the same time, so a beat lands on schedule and a long haul
is simply drawn faster. FIXED VELOCITY gives every link the same speed, so the eye reads distance
honestly and a long link takes longer. The first keeps a beat predictable, the second keeps the
drawing truthful, and which matters depends on what is being narrated.
*/
/*
The ruled durations. `TRACE_MS` is consumed here by `traceOf`; `FADE_MS` is NOT -- a node's fade is
a CSS transition, because nothing in JS needs to know how long a browser takes to interpolate an
opacity. It is declared beside its sibling so the two ruled numbers are readable together, and the
stylesheet names this file so a reader of either finds the other.
*/
export const TRACE_MS = 500;   // a link, unless the beat says otherwise
export const FADE_MS = 500;    // a node -- ENFORCED in app/style.css, stated here for company

export function traceOf(cfg, length) {
	const len = Number.isFinite(length) && length > 0 ? length : 0;
	if (cfg && cfg.mode === 'velocity') {
		const pxPerMs = cfg.pxPerMs > 0 ? cfg.pxPerMs : 1;
		return { ms: len / pxPerMs, pxPerMs };
	}
	const ms = cfg && cfg.ms > 0 ? cfg.ms : TRACE_MS;
	// a zero-length link takes no time and reports a finite speed rather than NaN or Infinity: a
	// consumer dividing by it should get an answer, not a hole
	return len ? { ms, pxPerMs: len / ms } : { ms: 0, pxPerMs: 0 };
}

/*
How long a beat OCCUPIES, which is not the same as how its entities are spaced -- B192.

The last entity lands at `(n-1) * interval`, and that was also being used as the beat's end, so
every beat handed its caption to the next one at the instant its final entity appeared. A
one-entity beat, whose spacing is zero, therefore never held the caption at all: an agent writes
one, the commit accepts it, the document stores it, and nothing ever shows it.

So a beat lasts one further interval past its last entity. That is a DWELL, not a pause -- nothing
is waiting to be revealed during it, the beat is simply still the thing being said while its last
arrival is on screen. Derived from the beat's own interval rather than a constant, so a beat paced
for reading dwells for reading and a fast one does not drag.

A zero interval still reveals a whole beat at its start and still occupies nothing, which keeps
"reveal this at once" expressible.
*/
function durationOf(beat) {
	const n = (beat?.ids || []).length;
	return n ? n * (beat.interval || 0) : 0;
}

// The instant each beat begins, derived by walking the list from the one stored origin. Returned
// alongside the beat so no caller recomputes the running total -- doing it twice is how two answers
// to one question appear.
function schedule(reveal) {
	let at = reveal?.origin ?? 0;
	return (reveal?.beats || []).map((beat) => {
		const start = at;
		at += durationOf(beat);
		return { beat, start, end: at };
	});
}

/*
The entity ids visible at instant `t`.

A beat's Nth entity appears at `start + N * interval`, so the whole beat is present once its
duration has elapsed. Everything from beats already finished stays visible: a reveal only ever adds,
because the ops it describes have already been applied and nothing un-applies them.

Answering with a Set rather than a list: the only question a renderer asks is whether one entity is
shown yet, and a list would make that a scan per entity per frame.
*/
export function revealedAt(reveal, t) {
	const out = new Set();
	if (!reveal) return out;
	for (const { beat, start } of schedule(reveal)) {
		// beats are ordered, so nothing later has begun. An OPTIMISATION, not a guard: the per-entity
		// check below is what actually withholds a future beat, and removing this line changes no
		// answer. Kept so a long queue costs the beats that have started rather than all of them.
		if (t < start) break;
		const interval = beat.interval || 0;
		(beat.ids || []).forEach((id, i) => {
			if (t >= start + i * interval) out.add(id);
		});
	}
	return out;
}

/*
Which beat is current at `t`, and what it is saying.

`active` is the beat whose window contains `t`, or -- once every beat has played -- the last one,
because the caption is HELD until replaced rather than cleared. A blank status bar between beats
would flicker, and the last thing said is still the truest thing available.

`elapsed` is how far into the active beat we are, which is what a typing caption consumes. It is
derived from the stored origin, never from wall-clock-since-commit: that is the B177 failure class,
and a beat that measured its own age against a peer's clock would drift exactly the way two tabs
drifted over a spawner.
*/
export function beatsOf(reveal, t) {
	const sched = schedule(reveal);
	if (!sched.length || t < sched[0].start) return { active: null, index: -1, elapsed: 0 };
	let hit = sched[0], index = 0;
	sched.forEach((s, i) => {
		if (t >= s.start) { hit = s; index = i; }
	});
	return { active: hit.beat, index, elapsed: Math.max(0, t - hit.start) };
}
