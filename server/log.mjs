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
*/

export const LOG_MAX = 100;
export const LOG_BYTES = 32 * 1024;

const sizeOf = (change) => JSON.stringify(change).length;

export class Log {
	constructor(version = 0) {
		this.version = version;
		this.records = [];
		this.cursor = 0;
		this.evicted = 0;
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

	// Oldest-first, but never the last surviving record however large it is.
	#evict() {
		while (this.records.length > 1 && (this.records.length > LOG_MAX || this.bytes > LOG_BYTES)) {
			const dropped = this.records.shift();
			this.bytes -= sizeOf(dropped);
			this.evicted++;
			if (this.cursor > 0) this.cursor--;      // the cursor tracks the same records
		}
	}

	canUndo() { return this.cursor > 0; }
	canRedo() { return this.cursor < this.records.length; }
	get truncated() { return this.evicted > 0; }

	// The record undo would reverse next, and the one redo would replay next.
	peekUndo() { return this.canUndo() ? this.records[this.cursor - 1] : null; }
	peekRedo() { return this.canRedo() ? this.records[this.cursor] : null; }

	toJSON() {
		return { version: this.version, cursor: this.cursor, evicted: this.evicted, records: this.records };
	}

	// `fallback` seeds version for a document written before the log existed.
	static from(json, fallback = 0) {
		const log = new Log(Number.isInteger(json?.version) ? json.version : fallback);
		if (Array.isArray(json?.records)) {
			log.records = json.records;
			log.bytes = json.records.reduce((n, c) => n + sizeOf(c), 0);
		}
		log.cursor = Number.isInteger(json?.cursor) ? Math.min(json.cursor, log.records.length) : log.records.length;
		log.evicted = Number.isInteger(json?.evicted) ? json.evicted : 0;
		// A persisted version below the ring's own high-water mark would re-mint a live seq.
		const top = log.records.length ? log.records[log.records.length - 1].seq : 0;
		if (log.version < top) log.version = top;
		return log;
	}
}
