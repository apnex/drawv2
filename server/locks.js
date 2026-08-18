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
	constructor({ ttlMs = 60000, now = () => Date.now() } = {}) {
		this.ttlMs = ttlMs;
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

	// claim the server-side write lock; null if another live controller holds it
	acquire(id) {
		if (this._live(id)) return null;
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
