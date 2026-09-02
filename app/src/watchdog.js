/*
watchdog.js — is this tab still worth trusting, and what to do when it is not.

One concern: deciding which RUNG a client is on, and acting once when it changes.
It owns no DOM, no socket and no timer of its own choosing -- everything it touches is injected, so
the whole ladder is testable without a browser.

WHY THE CLIENT DECIDES AT ALL. The defect this exists for is a deadlock: a websocket keeps its
instance alive, so Cloud Run never sends the SIGTERM that would close the websocket, and a
superseded instance can serve stale clients indefinitely (B178). Any mechanism that depends on the
server being willing and able to speak inherits that deadlock. So the client carries its own
evidence and repairs itself.

THE RUNGS ARE DELIBERATELY DISTINCT, and collapsing them is the mistake this file exists to avoid.

	live         the socket is open and the revision matches
	offline      the socket is gone. Reversible, informative, SAFE
	stale        positive evidence this tab is running replaced code. Reload
	unreachable  a reload is warranted and cannot be completed. Hold, say so, keep trying

**A RELOAD REQUIRES THE SERVER TO BE UP.** That is the whole reason `offline` and `stale` are not
one rung. Reloading in response to a lost connection is the one action guaranteed to fail at exactly
the moment it fires: it discards a working application and replaces it with a browser error page.
A timeout therefore raises SUSPICION and never a reload -- it schedules a check, and the check needs
an answer from the server before it can conclude anything.

WHY THE PREFLIGHT IS THE SAME CALL AS THE TEST. Asking `/health` returns the live revision, which is
the staleness test, and its success is the reachability test. One request answers both, so a client
never reloads into a void: an answer means both that it is stale and that reloading will complete.

Ruled by the director on 2026-09-02. Specified in `docs/spec/AUTHORITY.md` section 6.
*/

export class Watchdog {
	/*
	`probe`  -> Promise<string|null|undefined>  the live revision, or null when unreachable
	`reload` -> ()                              what to do when this tab must be replaced
	`onRung` -> (rung, detail)                  told once per CHANGE, never per check
	*/
	constructor({ probe, reload, onRung = () => {}, pollMs = 15_000 } = {}) {
		this.probe = probe;
		this.reload = reload;
		this.onRung = onRung;
		this.pollMs = pollMs;
		this.rung = 'live';
		this.pinned = null;      // the revision that served this page, from the snapshot
		this.wanted = false;     // a reload is warranted and has not yet succeeded
		this.reason = null;
		this.timer = null;
	}

	/*
	The revision this tab's socket is pinned to, taken from the snapshot.

	Null is honest and common: a local server sets no `K_REVISION`, and with nothing to compare
	against the revision half of this ladder is INERT rather than guessing. That is deliberate --
	F6: a development environment that diverges from production in the mechanism meant to guarantee
	correctness is worse than no mechanism.
	*/
	pin(revision) {
		if (typeof revision === 'string' && revision) this.pinned = revision;
	}

	#to(rung, reason = null) {
		if (this.rung === rung) return false;
		this.rung = rung;
		this.reason = reason;
		this.onRung(rung, reason);
		return true;
	}

	// the socket came up. Only a matching revision returns this tab to `live`.
	noteOpen() {
		if (this.wanted) return;              // a warranted reload is not cancelled by a reconnect
		this.#to('live');
	}

	/*
	The socket went away. Rung 1, and nothing more.

	No reload, no suspicion acted on, no state discarded: the application keeps running and the
	outbox keeps accumulating. A poll starts so that IF the server comes back different, this tab
	finds out -- but the poll can only ever raise `stale` by learning something, never by waiting.
	*/
	noteClosed() {
		if (this.wanted) return;
		this.#to('offline', 'the connection dropped');
		this.start();
	}

	// the server said so. Evidence, and the only rung-2 trigger that needs no comparison.
	retire(reason = 'the server retired this session') { this.want(reason); }

	// a version gap this client cannot reconcile. Evidence of divergence rather than of staleness.
	gap(reason = 'this tab is out of step with the document') { this.want(reason); }

	// mark a reload warranted, then try to complete it
	want(reason) {
		this.wanted = true;
		this.reason = reason;
		this.start();
		return this.check();
	}

	/*
	One check: ask, then decide.

	The four outcomes are the whole ladder. No answer while a reload is wanted is `unreachable` --
	the rung that exists so a client never destroys itself trying to fetch from a server that is
	gone. No answer otherwise leaves the client where it was, because not knowing is not evidence.
	*/
	async check() {
		let live = null;
		try { live = await this.probe(); }
		catch { live = null; }

		if (live === null || live === undefined) {
			if (this.wanted) this.#to('unreachable', this.reason);
			return this.rung;
		}
		// an answer proves the server is reachable, so a reload can complete
		if (this.wanted) return this.#fire();
		if (this.pinned && live !== this.pinned) {
			this.wanted = true;
			this.reason = 'this tab is running a replaced version';
			return this.#fire();
		}
		return this.rung;
	}

	#fire() {
		this.#to('stale', this.reason);
		this.stop();
		this.reload();
		return this.rung;
	}

	start() {
		if (this.timer || !this.pollMs) return;
		this.timer = setInterval(() => { this.check().catch(() => {}); }, this.pollMs);
		if (this.timer.unref) this.timer.unref();
	}

	stop() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }
}
