/*
Log — the per-diagram change ring: what happened, in order, with each change's inverse.

Split out of server/txn.mjs deliberately. The eviction and cursor rules are the fiddliest part of
this design and they are testable here without constructing a transaction, a Model, or a Store.

  version   monotonic, +1 per accepted transaction INCLUDING undo and redo. Never decreases.
            Not the same as records.length, and not the same as records.at(-1).seq — undo moves
            the version without appending, which is exactly why version cannot be derived from
            the ring.
  cursor    how many records are currently "applied". undo decrements, redo increments.
  evicted   monotonic count of records dropped off the bottom. Persisted, so `truncated` survives
            a restart — a bounded loss no actor can perceive is not a bounded loss.

Bounds: LOG_MAX records AND LOG_BYTES, evict oldest first, but NEVER evict the only record. The
last rule exists so that select-all-delete — the single most destructive action available — can
never be the one thing you cannot undo.

The FLOOR (I14): eviction also stops at the newest HUMAN-authored record. An agent writing a long
batch would otherwise push the user's own last change out of a 100-record ring — their work becomes
un-undoable because someone else was busy, which is not a bound the user can perceive or predict.
The floor only ever binds when everything newer than that record is agent work, which is exactly
the case it exists for. A hard ceiling still overrides it, because unbounded memory is a worse
failure than a lost undo step; when it does, `evictedHuman` counts it and the browser says so.
*/

export const LOG_MAX = 100;
const LOG_BYTES = 32 * 1024;
// the floor yields to these: past them the ring grows without bound, which no undo step is worth
export const LOG_HARD_MAX = LOG_MAX * 4;
const LOG_HARD_BYTES = LOG_BYTES * 4;

const sizeOf = (change) => JSON.stringify(change).length;

export class Log {
	constructor(version = 0) {
		this.version = version;
		this.records = [];
		this.cursor = 0;
		this.evicted = 0;
		this.evictedHuman = 0;   // of those, how many the user authored — the loss they can feel
		this.bytes = 0;
	}

	// Append a change at the cursor, truncating any redo tail. Callers mint the seq (it is
	// log.version after the bump) — the assertion pins that contract rather than trusting it.
	append(change) {
		if (change.seq !== this.version) {
			throw new Error(`Log.append: seq ${change.seq} !== version ${this.version}`);
		}
		if (this.cursor < this.records.length) {
			for (const dropped of this.records.slice(this.cursor)) this.bytes -= sizeOf(dropped);
			this.records.length = this.cursor;      // a new change destroys the redo tail
		}
		this.records.push(change);
		this.bytes += sizeOf(change);
		this.cursor = this.records.length;
		this.#evict();
		return change;
	}

	// Oldest-first, but never the last surviving record however large it is, and never past the
	// newest human-authored one until the hard ceiling forces it (I14).
	#evict() {
		const overSoft = () => this.records.length > LOG_MAX || this.bytes > LOG_BYTES;
		const overHard = () => this.records.length > LOG_HARD_MAX || this.bytes > LOG_HARD_BYTES;
		while (this.records.length > 1 && overSoft()) {
			const victim = this.records[0];
			// the floor: the oldest record IS the newest human one, so dropping it costs the user
			// their last undoable change. Hold, unless the ring has grown past the hard ceiling.
			if (victim === this.#newestHuman() && !overHard()) break;
			this.records.shift();
			this.bytes -= sizeOf(victim);
			this.evicted++;
			if (victim.by === 'client') this.evictedHuman++;
			if (this.cursor > 0) this.cursor--;      // the cursor tracks the same records
		}
	}

	// The most recent record a person authored. `by` is 'client' for a browser session and
	// 'server' for a REST/CLI writer — the distinction exists because only one of them is standing
	// at the keyboard expecting Ctrl+Z to work.
	#newestHuman() {
		for (let i = this.records.length - 1; i >= 0; i--) {
			if (this.records[i].by === 'client') return this.records[i];
		}
		return null;
	}

	canUndo() { return this.cursor > 0; }
	canRedo() { return this.cursor < this.records.length; }
	get truncated() { return this.evicted > 0; }
	// a stronger signal than `truncated`: the ring dropped work this user did, not agent noise
	get truncatedHuman() { return this.evictedHuman > 0; }

	// The record undo would reverse next, and the one redo would replay next.
	peekUndo() { return this.canUndo() ? this.records[this.cursor - 1] : null; }
	peekRedo() { return this.canRedo() ? this.records[this.cursor] : null; }

	toJSON() {
		return { version: this.version, cursor: this.cursor, evicted: this.evicted,
			evictedHuman: this.evictedHuman, records: this.records };
	}

	// A record we cannot read is worse than one we drop: undo would apply `record.inverse` blind.
	// Shape-check each, keep the readable ones, discard the rest.
	static #readable(c) {
		return !!c && typeof c === 'object' && !Array.isArray(c)
			&& Number.isInteger(c.seq) && Number.isInteger(c.from)
			&& Array.isArray(c.ops) && Array.isArray(c.inverse);
	}

	// `fallback` seeds version for a document written before the log existed. TOLERATE-AND-DROP:
	// a malformed log costs undo history; it must never cost the diagram (server/store.js skips a
	// doc that fails validation, so a throw here would make the whole diagram vanish on boot).
	static from(json, fallback = 0) {
		const log = new Log(Number.isInteger(json?.version) ? json.version : fallback);
		if (Array.isArray(json?.records)) {
			const kept = json.records.filter((c) => Log.#readable(c));
			if (kept.length !== json.records.length) {
				console.warn(`[ log ] dropped ${json.records.length - kept.length} unreadable record(s)`);
			}
			log.records = kept;
			log.bytes = kept.reduce((n, c) => n + sizeOf(c), 0);
		}
		log.cursor = Number.isInteger(json?.cursor) ? Math.min(json.cursor, log.records.length) : log.records.length;
		log.evicted = Number.isInteger(json?.evicted) ? json.evicted : 0;
		log.evictedHuman = Number.isInteger(json?.evictedHuman) ? json.evictedHuman : 0;
		// A persisted version below the ring's own high-water mark would re-mint a live seq.
		const top = log.records.length ? log.records[log.records.length - 1].seq : 0;
		if (log.version < top) log.version = top;
		return log;
	}
}
