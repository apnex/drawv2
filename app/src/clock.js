/*
clock.js — WHAT TIME IS IT, agreed with the server.

One concern, and a small one. It exists because parity was ruled desirable and a per-machine clock
cannot deliver it: `engine/movers.mjs` computes a mover's position from `t`, so two browsers holding
the same document agree only to the extent their CLOCKS agree. NTP usually holds a laptop within
tens of milliseconds and nothing enforces it -- a hand-set clock puts one viewer's packets visibly
ahead of another's, on a document that says they are in the same place.

The server therefore becomes the one clock. It stamps `serverNow` into the snapshot every client
already receives, each client works out its own offset once, and every consumer of time asks HERE.

WHY A SEAM RATHER THAN `Date.now()` AT EACH CALL SITE. A clock source is the kind of thing that
cannot be retrofitted: by the time three modules read the wall clock directly, changing where time
comes from means finding and correcting all three, and missing one produces a drift nobody can see.
One function is cheap now and irreversible later, which is the same argument that made the situation
model-level.

ROUND-TRIP CORRECTION. `serverNow` is stamped when the snapshot is BUILT and read when it ARRIVES,
so a naive offset runs one network hop behind. Given when the request left, the classic correction
assumes a symmetric path and puts the server's clock half a round trip after the send:

    offset = serverNow - (sentAt + rtt/2)

Without a send time it falls back to arrival, and is then late by roughly one hop. That fallback is
honest rather than hidden: `skew()` reports what was applied, so a caller can tell a corrected clock
from an uncorrected one instead of assuming.

NOT HERE, deliberately: no periodic resync, no drift tracking, no monotonic source. A browser clock
does not wander meaningfully over a session, and a snapshot arrives on every reconnect anyway, so
each of those would be mechanism bought against a problem nobody has measured.
*/
/*
The longest round trip this correction will believe, in ms.

Not a tuning knob -- a plausibility check. The correction assumes `sentAt` belongs to the request
that produced THIS snapshot, and when that assumption breaks the error is not small: the midpoint
lands halfway back to whenever the stamp was made and the offset absorbs the entire gap. A session
open for a minute produced a +30s clock, which put a route's worth of packets on screen at once for
one viewer and nothing at all for the other (B177).

Five seconds is far beyond any real request and far below the gap a stale stamp produces, so it
separates the two cleanly without needing to know which is which.
*/
const MAX_RTT = 5000;

export class Clock {
	#offset = 0;
	#seeded = false;

	/*
	Take the server's instant. `sentAt` is when the request that produced this snapshot left, in
	local time; supply it and the round trip is corrected for, omit it and arrival is used.
	*/
	seed(serverNow, sentAt = null) {
		if (!Number.isFinite(serverNow)) return false;   // an absent stamp leaves the clock local
		const arrived = Date.now();
		// a usable stamp is one that could plausibly belong to this reply. Anything older is a
		// leftover from an earlier request, and arrival -- late by one hop -- beats it by a mile.
		const usable = Number.isFinite(sentAt) && sentAt <= arrived && (arrived - sentAt) <= MAX_RTT;
		const local = usable ? sentAt + (arrived - sentAt) / 2 : arrived;
		this.#offset = serverNow - local;
		this.#seeded = true;
		return true;
	}

	// the agreed instant, in epoch ms. Every consumer of time in the client asks this.
	now() { return Date.now() + this.#offset; }

	// what the correction is worth, so a reader can tell a seeded clock from a local one rather
	// than assuming. `seeded` false means this machine's own clock, uncorrected.
	skew() { return { seeded: this.#seeded, offset: this.#offset }; }
}
