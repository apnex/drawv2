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

	// claim the server-side write lock; null if another live controller holds it, or if the human
	// has just reclaimed and the hold has not lapsed
	acquire(id) {
		if (this._live(id)) return null;
		const hold = this.holds.get(id);
		if (hold !== undefined) {
			if (hold > this.now()) return { held: true, retryAfter: hold - this.now() };
			this.holds.delete(id);
		}
		const token = crypto.randomBytes(16).toString('hex');
		const expiresAt = this.now() + this.ttlMs;
		this.map.set(id, { token, expiresAt });
		return { token, expiresAt };
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
