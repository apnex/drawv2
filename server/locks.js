/*
Locks — the Server-Locked arbiter. Per-diagram write lock that flips a diagram
from client-owned (default; browser writes over the websocket) to server-owned
(a server-side controller — LLM, script, or a person at the CLI — writes over
REST). Single-writer-at-a-time: one side holds the lock, never both.

Sovereign: depends only on node:crypto. No knowledge of HTTP, websockets, the
store, or who the controller is — it is a pure state machine over opaque tokens.
TTL is evaluated lazily on access (no timers), so a crashed controller's lock
always frees itself and the behavior is deterministic for tests (inject `now`).
*/

import crypto from 'node:crypto';

export class Locks {
	constructor({ ttlMs = 60000, holdMs = 30000, now = () => Date.now() } = {}) {
		this.ttlMs = ttlMs;
		this.holdMs = holdMs;
		this.holds = new Map();   // diagramId -> heldUntil (D22, the post-reclaim human hold)
		this.now = now;
		this.map = new Map(); // diagramId -> { token, expiresAt }
	}

	// the live lock for a diagram, or null if none / lapsed. It does NOT delete a
	// lapsed lock: sweep() is the sole expiry-deleter, so it can always report the
	// freed diagram to viewers. Reads here treat a lapsed lock as already gone
	// (acquire overwrites it), so correctness doesn't depend on the sweep cadence.
	_live(id) {
		const lock = this.map.get(id);
		if (!lock) return null;
		if (lock.expiresAt <= this.now()) return null;
		return lock;
	}

	locked(id) {
		return !!this._live(id);
	}

	/*
	B102 -- when the CURRENT lock lapses, or null if nothing holds it.

	Distinct from `heldUntil`, which is the D22 post-reclaim human hold and answers a different
	question: that one is why an agent MAY NOT take the lock, this one is when the holder's grip
	lets go on its own. An agent that lost its token could see neither, so it had nothing to wait
	for and no way to tell waiting from hanging.
	*/
	expiresAt(id) {
		const lock = this._live(id);
		return lock ? lock.expiresAt : null;
	}

	// claim the server-side write lock; null if another live controller holds it, or if the human
	// has just reclaimed and the hold has not lapsed
	/*
	`token` makes this RENEWAL for the holder -- B140.

	`if (this._live(id)) return null` refused every caller while a lock was live, including the one
	whose token it was, and the 409 above it said *another controller* -- false for the commonest
	case there is. The slot frees after about a minute and authoring a diagram one entity at a time
	takes far longer, so an agent must re-acquire mid-sequence; refusing it there meant the only way
	to keep working was to let the lock lapse and race for it, which is worse for everyone.

	Extending rather than reissuing is deliberate. A new token on renewal would invalidate the one
	the caller has already stored and turn a renewal into a silent revocation of its own writes.
	*/
	acquire(id, principal = null, token = null) {
		const live = this._live(id);
		if (live) {
			if (!token || live.token !== token) return null;
			live.expiresAt = this.now() + this.ttlMs;
			return { token: live.token, expiresAt: live.expiresAt, renewed: true };
		}
		const hold = this.holds.get(id);
		if (hold !== undefined) {
			if (hold > this.now()) return { held: true, retryAfter: hold - this.now() };
			this.holds.delete(id);
		}
		const fresh = crypto.randomBytes(16).toString('hex');
		const expiresAt = this.now() + this.ttlMs;
		// B105: WHO holds it, not just that it is held. Without this the estate could say a diagram
		// was locked and never say by whom, so an operator could see that something was happening
		// and not what -- which is the whole of what the agent indicator has to answer.
		this.map.set(id, { token: fresh, expiresAt, principal, since: this.now() });
		return { token: fresh, expiresAt };
	}

	/*
	B105 -- what every agent is doing, across the whole workspace.

	The pill answers what may I do HERE. This answers what is happening ANYWHERE, which is the
	thing no per-diagram element can report and the reason the indicator is worth having: an
	operator learns about work they are not currently looking at.

	Derived from the live locks rather than tracked separately, so it cannot disagree with them.
	A lapsed lock is already invisible to `_live`, so an agent that died holding one stops being
	reported without anything having to notice it died.
	*/
	activity() {
		const out = [];
		for (const id of this.map.keys()) {
			const lock = this._live(id);
			if (!lock) continue;
			/*
			A lock with no principal is still reported, as `null`.

			With authorization off there IS no principal, and skipping those would make the whole
			indicator blank in exactly the configuration a single operator runs -- reporting that
			something is driving a diagram without being able to name it is the honest answer, and
			it is already what the pill does when it says `locked`.
			*/
			out.push({ principal: lock.principal ?? null, diagram: id, since: lock.since, expiresAt: lock.expiresAt });
		}
		return out.sort((a, b) => a.since - b.since);
	}

	verify(id, token) {
		const lock = this._live(id);
		return !!lock && !!token && lock.token === token;
	}

	// refresh the TTL; only the live holder can (returns false otherwise)
	heartbeat(id, token) {
		const lock = this._live(id);
		if (!lock || lock.token !== token) return false;
		lock.expiresAt = this.now() + this.ttlMs;
		return true;
	}

	// release by the holder (token must match the live lock)
	release(id, token) {
		const lock = this._live(id);
		if (!lock || lock.token !== token) return false;
		this.map.delete(id);
		return true;
	}

	// force-release — the human reclaiming control from the browser. No token:
	// the human owns the tool and can always take the wheel back.
	reclaim(id) {
		this.map.delete(id);
		// D22: a bare release is raceable — an agent's retry loop can re-acquire before the human's
		// next action lands, which makes reclaim-then-undo (the designated remedy for agent damage)
		// unreliable. Hold the diagram briefly for the human; cleared by their first commit.
		this.holds.set(id, this.now() + this.holdMs);
	}

	// the human's first write ends the hold early — they have taken the wheel, so an agent may
	// contend again on the normal terms
	releaseHold(id) {
		this.holds.delete(id);
	}

	heldUntil(id) {
		const t = this.holds.get(id);
		return t !== undefined && t > this.now() ? t : null;
	}

	// drop every lapsed lock, returning their diagram ids. Lazy TTL keeps reads
	// correct; this lets a caller (app.js) tell viewers a crashed controller's
	// lock has freed — otherwise the browser would stay read-only forever.
	sweep() {
		const expired = [];
		const t = this.now();
		for (const [id, lock] of this.map) {
			if (lock.expiresAt <= t) { this.map.delete(id); expired.push(id); }
		}
		return expired;
	}
}
