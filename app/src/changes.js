/*
Changes — the browser's commit boundary. Replaces History.

The class it replaces kept a local undo stack and replayed inverses itself, which is why an agent
write silently destroyed it: any authoritative snapshot cleared the stack, and a REST write
broadcast one. Undo now lives on the server, where it can reverse a change whoever made it.

What did NOT change is the surface the 26 call sites use — `commit(command)`, `undo()`, `redo()`,
`canUndo()`, `canRedo()`. Only what sits behind it changed. That is deliberate: it inverts the
dependency instead of wrapping every call site, so there is no way to forward an *uncommitted*
change. Sync subscribes here, not to `model.onChange` — which is the render signal, and which six
other subscribers legitimately want to fire on every preview frame.

A commit applies locally first (the gesture must feel instant) and submits the same ops. Undo and
redo are server round-trips: the reply carries the ops to apply, because the server owns the log.
*/

import { applyOps } from '../../document/ops.mjs';

// History carried the inverse in each entry (`before`) because it replayed inverses itself. The
// server derives the inverse from the pre-state now, so only the forward intent travels.
function toOp(entry) {
	if (entry.op === 'put') return { op: 'put', kind: entry.kind, entity: entry.entity };
	if (entry.op === 'del') return { op: 'del', kind: entry.kind, id: entry.entity.id };
	if (entry.op === 'set') return { op: 'set', kind: entry.kind, id: entry.id, patch: entry.after };
	if (entry.op === 'meta') return { op: 'meta', patch: entry.patch };
	throw new Error(`toOp: unknown entry op '${entry.op}'`);
}

// A burst of same-shape edits (arrow-key nudges, Shift+arrow resizes) should be ONE undo step, not
// one per keystroke. The window is client-side because only the client knows a burst is in
// progress; the server sees whatever the window emits.
const COALESCE_MS = 600;

export class Changes {
	constructor(model, { coalesceMs = COALESCE_MS, now = () => Date.now() } = {}) {
		this.model = model;
		this.coalesceMs = coalesceMs;
		this.now = now;
		this.subs = [];
		this.state = { canUndo: false, canRedo: false, undoLabel: '', version: 0,
			undoTop: null, truncated: false, truncatedHuman: false };
		this.actor = null;       // our server-side session id, learned from the first ack we author
		this.window = null;      // { label, ops, until }
	}

	onCommit(fn) { this.subs.push(fn); }

	// Apply locally and submit. `command` is { label, entries } — the shape the builders already
	// produce. An empty command is not a change.
	commit(command) {
		if (!command || !command.entries || command.entries.length === 0) return;
		const ops = command.entries.map(toOp);
		applyOps(this.model, ops);
		this.#submit({ ops, label: command.label || '' }, command.coalesce === true);
	}

	// A burst amends the open window rather than opening a new change.
	amend(command) {
		if (!command || !command.entries || command.entries.length === 0) return;
		this.commit({ ...command, coalesce: true });
	}

	#submit(request, coalesce) {
		const t = this.now();
		if (coalesce && this.window && this.window.label === request.label && t < this.window.until) {
			this.window.ops.push(...request.ops);
			this.window.until = t + this.coalesceMs;
			return;                                   // still open — nothing goes out yet
		}
		this.#flushWindow();
		if (coalesce) {
			this.window = { label: request.label, ops: [...request.ops], until: t + this.coalesceMs };
			this.timer = setTimeout(() => this.#flushWindow(), this.coalesceMs);
			if (this.timer.unref) this.timer.unref();
			return;
		}
		this.#emit(request);
	}

	#flushWindow() {
		if (!this.window) return;
		const w = this.window;
		this.window = null;
		this.#emit({ ops: w.ops, label: w.label });
	}

	#emit(request) {
		this.subs.forEach((fn) => fn(request));
	}

	// Undo and redo are the server's to perform — it holds the log and the inverses. The subscriber
	// turns these into a ws message; the ops come back and are applied by Sync.
	undo() { this.#flushWindow(); this.subs.forEach((fn) => fn({ verb: 'undo', expect: this.state.version })); }
	redo() { this.#flushWindow(); this.subs.forEach((fn) => fn({ verb: 'redo', expect: this.state.version })); }

	/*
	D21 — reverse the whole top run as ONE action.

	Offered when the top of the log is not yours: an agent's batch is N records, and taking it back
	one Ctrl+Z at a time is both tedious and racy (another writer can interleave between them). The
	server computed the run and told us where it starts, so the affordance and the verb cannot
	disagree about how far back "all of it" goes.
	*/
	undoRun() {
		const top = this.state.undoTop;
		if (!top || !Number.isInteger(top.to)) return this.undo();
		this.#flushWindow();
		this.subs.forEach((fn) => fn({ verb: 'undo', expect: this.state.version, to: top.to }));
	}

	// what the readout offers, or null when the top is our own change (Ctrl+Z already says that)
	foreignRun() {
		const top = this.state.undoTop;
		return top && top.actor && top.actor !== this.actor ? top : null;
	}

	// the server is authoritative about what is undoable; the UI just reflects it
	setCounts({ canUndo, canRedo, version, undoLabel, undoTop, truncated, truncatedHuman, actor }) {
		if (canUndo !== undefined) this.state.canUndo = canUndo;
		if (canRedo !== undefined) this.state.canRedo = canRedo;
		if (version !== undefined) this.state.version = version;
		if (undoLabel !== undefined) this.state.undoLabel = undoLabel;
		if (undoTop !== undefined) this.state.undoTop = undoTop;
		if (truncated !== undefined) this.state.truncated = truncated;
		if (truncatedHuman !== undefined) this.state.truncatedHuman = truncatedHuman;
		if (actor) this.actor = actor;   // our own session id, so we can tell our run from theirs
	}

	canUndo() { return this.state.canUndo; }
	canRedo() { return this.state.canRedo; }

	// kept so the callers that cleared a local stack still compile; there is no local stack now, and
	// an authoritative snapshot no longer destroys undo history — that was the defect.
	clear() { this.window = null; }
}
