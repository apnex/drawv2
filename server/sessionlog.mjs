/*
sessionlog.mjs — what each client DID, kept server-side, so nobody has to read a browser console.

WHY THIS EXISTS, stated plainly because the reason is a failure rather than a feature.

During the B181 incident the agent asked the director to read his browser console, twice. That
inverts A5 Perceptual Parity -- "human supervisors are then forced to act as the agent's eyes,
relaying state by hand" is the exact wording of the rationale -- and it spends the one resource A13
names as irreplaceable. The remedy A5 gives is not to ask better; it is for the agent to hold its
own instrument.

The server already SAW everything needed. It knew each session's identity, when it connected, every
commit, every refusal, every retire, and when the socket closed. It simply kept none of it in a form
anyone could read back. Reconstructing "one session committed spawn/stop alternately at 78 per
second, while sessions churned" took an hour of log greps that should have been one question.

WHAT IT IS. A bounded ring of recent sessions, each with a bounded ring of events. Not a metric --
a NARRATIVE, because the diagnostic value was always in the sequence: connect, resume, commit,
commit, refused, refused, close, connect again four milliseconds later.

WHAT IT IS NOT. It is not the transaction log: that records what the DOCUMENT did and is already
durable and bounded. This records what a CLIENT did, lives in memory, and is expected to be lost on
restart. It is a troubleshooting instrument, so it must never become something correctness depends
on -- if reading it changed an outcome, it would be state rather than observation.

BOUNDED ON BOTH AXES, deliberately. An unbounded diagnostic is a memory leak that only shows up in
the incident it was built for, which is the worst possible time.
*/

// how many finished sessions to remember, and how many events within one session
export const SESSIONS_KEPT = 40;
export const EVENTS_PER_SESSION = 60;

export class SessionLog {
	#live = new Map();      // actor -> record, while the socket is open
	#past = [];             // most recently CLOSED first, bounded

	/*
	A session opened. `principal` may be null with authorization off, which is honest rather than a
	gap -- there is no identity then, and inventing one would make a single-tenant run look otherwise.
	*/
	open(actor, principal, now = Date.now()) {
		const rec = { actor, principal: principal || null, opened: now, closed: null, events: [], counts: {} };
		this.#live.set(actor, rec);
		this.note(actor, 'open', principal ? { as: principal } : null, now);
		return rec;
	}

	/*
	One thing happened. `kind` is a short verb -- open, hello, commit, refused, retire, close -- and
	`detail` is whatever makes that line worth reading later.

	Counts are kept alongside the ring because the ring is short: a session that committed nine
	hundred times keeps its last sixty events, and the count is the only place the nine hundred
	survives. That number was the whole diagnosis during the incident.
	*/
	note(actor, kind, detail = null, now = Date.now()) {
		const rec = this.#live.get(actor);
		if (!rec) return;
		rec.counts[kind] = (rec.counts[kind] || 0) + 1;
		rec.events.push({ at: now, kind, ...(detail ? { detail } : {}) });
		if (rec.events.length > EVENTS_PER_SESSION) rec.events.splice(0, rec.events.length - EVENTS_PER_SESSION);
	}

	/*
	Which document this session is on.

	A method rather than a field poked from outside: the first version reached in through `report()`,
	which returns SHAPED COPIES, so it set the diagram on a throwaway object and every row read `-`.
	An instrument that quietly reports nothing is worse than none, because it is believed.
	*/
	attach(actor, diagramId) {
		const rec = this.#live.get(actor);
		if (rec) rec.diagram = diagramId;
	}

	// the socket went away. Moved to the past ring rather than dropped, because a session that
	// vanished is exactly the one worth reading -- reconnect churn is invisible if only the live
	// ones are kept, and that is precisely what was missed during the incident.
	close(actor, now = Date.now()) {
		const rec = this.#live.get(actor);
		if (!rec) return;
		this.note(actor, 'close', null, now);
		rec.closed = now;
		this.#live.delete(actor);
		this.#past.unshift(rec);
		if (this.#past.length > SESSIONS_KEPT) this.#past.length = SESSIONS_KEPT;
	}

	/*
	Everything remembered, live first, newest-closed next.

	`rate` is derived here rather than stored: commits divided by the seconds the session has been
	open, which is the number that would have named the incident in one reading. A session open for
	under a second reports its raw count rather than a rate, because dividing by a fraction invents
	precision the sample cannot support.
	*/
	report(now = Date.now()) {
		const shape = (r) => {
			const secs = ((r.closed || now) - r.opened) / 1000;
			const commits = r.counts.commit || 0;
			return {
				actor: r.actor, principal: r.principal, diagram: r.diagram || null,
				live: r.closed === null,
				openedMs: Math.round((r.closed || now) - r.opened),
				counts: { ...r.counts },
				commitsPerSecond: secs >= 1 ? Math.round((commits / secs) * 10) / 10 : null,
				events: r.events,
			};
		};
		return [...[...this.#live.values()].map(shape), ...this.#past.map(shape)];
	}

	// which sessions are writing faster than a person could, whatever the cause. The threshold is
	// the caller's, so this stays a report rather than a policy.
	hot(perSecond, now = Date.now()) {
		return this.report(now).filter((s) => s.commitsPerSecond !== null && s.commitsPerSecond >= perSecond);
	}
}
