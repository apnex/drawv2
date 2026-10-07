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

P5 V-d (H18.28; PL-6, ruled PD-5) -- ONE PREVIEW. A commit sends what the author did -- its INTENT, "delete this node" -- and
shows the planner's whole answer at once: `preview(model, ops)` plans the intent with the page's own composition, the same
`plan()` and tenants the server runs, and the tab applies what it plans. So the browser keeps no copy of a planner rule, and
a pin deleted on the page takes its link before the server answers (G4). Each request carries both: `ops`, sent, and
`applied`, what the tab applied -- which the answer is reconciled against (`derivedToApply`). A preview the planner refuses
applies nothing; the intent is still sent, and the server's answer, or its refusal, decides. With no preview (a composition
without the network), the intent is applied as it stands, as before.
*/

import { applyOps } from '../../model/ops.mjs';

// History carried the inverse in each entry (`before`) because it replayed inverses itself. The
// server derives the inverse from the pre-state now, so only the forward intent travels.
function toOp(entry) {
	if (entry.op === 'put') return { op: 'put', kind: entry.kind, entity: entry.entity };
	if (entry.op === 'del') return { op: 'del', kind: entry.kind, id: entry.entity.id };
	if (entry.op === 'set') return { op: 'set', kind: entry.kind, id: entry.id, patch: entry.after };
	if (entry.op === 'meta') return { op: 'meta', patch: entry.patch };
	throw new Error(`toOp: unknown entry op '${entry.op}'`);
}

/*
B242 / H17-D3 -- reconcile the tab that made a change with the server's answer to it. The ONE rule:
Sync's ack calls it, and so will the lab's local door (dev/design/h17/PLAN.md K1, guardrail G3), so
there is no second copy of a filter to drift.

`sent` is what this tab submitted for the request being answered -- nothing, for undo and redo, whose
ops are the server's by definition, and nothing for another writer's change (Sync.applyChange uses
this rule too). `planned` is what the planner committed for it. `pending` is every op already applied
to this tab and not yet answered, oldest first. The result, applied in order:

  1. the planned ops that are not the tab's own sent ops echoed back -- what the server added or
     changed: a sweep, a group trim, a collapse;
  2. then the ops in `pending` on the entities step 1 wrote, because the server applies those AFTER
     this answer and step 1 has overwritten them (a collapse rewriting a link the tab has since
     replugged).

An echo is skipped rather than re-applied because the tab already holds it, and re-applying it would
pull back a live drag that has moved the entity since, which no request carries. Re-applying the whole
answer is exactly the reading H17-D3's CORRECTED banner rules out.

Step 2 replays only where step 1 wrote for the same reason. On any other entity the tab already shows
its pending ops -- it applied them last, and nothing in this answer has written there since -- so
re-applying them changes nothing, except under a live drag, which writes the model and is in no
request. Replaying every pending op put a node being dragged back where its own unanswered nudge had
left it, whenever the answer to an EARLIER request arrived: C4's "the tab must not snap back",
broken by the replay itself.

"Echoed back" is read as the real planner echoes, where a byte comparison of op bodies is wrong three
ways (tests/b242-reconcile.test.js has a case for each):
- a set comes back NARROWED to the fields that changed (planner/txn.mjs narrow), so a planned set is an
  echo when every field it carries has the value a sent set gave it;
- each sent op vouches for at most ONE planned op, so a coalesced burst that sets one field three times
  is three echoes -- keyed by op:kind:id alone, the last sent value would stand for all three;
- once a derived op has written an entity, a later echo on that entity is applied: the tab applied its
  op before the derived one existed, so on the tab it is no longer on top.
*/
export function derivedToApply(sent, planned, pending) {
	const mine = new Map();          // entity -> the tab's sent ops on it, not yet matched, in order
	for (const op of sent) {
		const at = entityOf(op);
		if (!mine.has(at)) mine.set(at, []);
		mine.get(at).push(op);
	}
	const written = new Set();       // entities a derived op has written in this answer
	const derived = [];
	for (const op of planned) {
		const at = entityOf(op);
		const own = written.has(at) ? null : mine.get(at);
		const echo = own ? own.findIndex((o) => echoes(o, op)) : -1;
		if (echo >= 0) { own.splice(echo, 1); continue; }
		derived.push(op);
		written.add(at);
	}
	return [...derived, ...pending.filter((op) => written.has(entityOf(op)))];
}

/*
Which of the ops a tab applied for a request the server's answer does not confirm -- the preview's unconfirmed part.
B304 (H19.15; ruled 2026-10-07, "re-fetch"): the tab previews each request's consequences on its own board (V-d); when another
writer's edit reached the server first, the server plans the request on a different board and can answer otherwise -- delete
less, join differently, mint a piece another way. `derivedToApply` adds what the answer holds that the tab lacks, and cannot
take back what the tab applied that the answer lacks; so an op the tab DERIVED for its request with no echo in the answer means
the tab shows something the server does not hold, and the tab fetches the document again. An op the tab ASKED for (`asked`, the
request's own ops) that the answer leaves out was already so on the server -- narrowed to nothing -- and proves nothing, which
keeps a tab with no preview, whose applied ops are what it asked, from fetching on every no-op. In ordinary use the preview and
the answer are one plan of one board (PL-6), and this is empty.
*/
export function unconfirmedPreviewOps(applied, planned, asked = []) {
	/*
	B305 (H19.16) -- FIELD BY FIELD. The echo rule an answer is applied by (`echoes`) takes an answer setting fewer fields than the
	tab did as an echo, narrowed; confirming a preview needs every field the tab set, set to that value by the answer -- or asked
	for by the tab and already so on the server. A join's merged link carrying a direction the server's board did not have was
	counted confirmed by an answer setting the same ends without it (the sync fuzz, seed 147).
	*/
	const on = (list, op) => list.filter((p) => entityOf(p) === entityOf(op));
	const sets = (ops, f, v) => ops.some((p) => ((p.op === 'set' || p.op === 'meta') ? Object.hasOwn(p.patch || {}, f) && sameValue(p.patch[f], v)
		: p.op === 'put' && !!p.entity && sameValue(p.entity[f], v)));
	const same = (ops, op) => ops.some((p) => p.op === op.op && (op.op === 'del' || sameValue(p.entity, op.entity)));
	return applied.filter((op) => {
		const theirs = on(planned, op), mine = on(asked, op);
		if (op.op === 'del' || op.op === 'put') return !same(theirs, op) && !same(mine, op);
		return Object.entries(op.patch || {}).some(([f, v]) => !sets(theirs, f, v) && !sets(mine, f, v));
	});
}

/*
B288 -- AN ANSWER, APPLIED: the derived ops (`derivedToApply`) onto the model, and a selected entity that a reaction
absorbed handing its selection to what it was absorbed into -- read off the delete's `into` (TG-1b, succession), which the
planner's join sets -- a join keeps the earlier-drawn link's id (ruled 2026-09-26), so the
half the author had selected was the one deleted, and the selection emptied (the director's report, 2026-10-02). The one
step every door that applies a planner's answer takes: the lab's, and production's sync, for its own answers and another
writer's change alike.
*/
export function applyAnswer(model, selection, ops) {
	if (!ops.length) return;
	// SUCCESSION (TG-1b): a delete that names what it was absorbed into -- the planner's join says so -- hands the selection on
	const carry = ops.filter((o) => o.op === 'del' && o.into && selection.has(o.id)).map((o) => o.into);
	applyOps(model, ops);
	const live = carry.filter((id) => model.get('link', id) && !selection.has(id));
	if (live.length) selection.add(live);
}

// a meta op carries neither kind nor id, so every meta op keys as one entity of its own
const entityOf = (op) => `${op.kind}:${op.id ?? op.entity?.id}`;
const sameValue = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// is `planned` the planner's echo of `own`, an op the tab sent on the same entity?
function echoes(own, planned) {
	if (own.op !== planned.op) return false;
	if (planned.op === 'put') return sameValue(own.entity, planned.entity);
	// set and meta: narrowed, each field with the value the tab sent. A del has no patch, so it echoes.
	const patch = own.patch || {};
	return Object.entries(planned.patch || {}).every(([f, v]) => Object.hasOwn(patch, f) && sameValue(patch[f], v));
}

// A burst of same-shape edits (arrow-key nudges, Shift+arrow resizes) should be ONE undo step, not
// one per keystroke. The window is client-side because only the client knows a burst is in
// progress; the server sees whatever the window emits.
const COALESCE_MS = 600;

export class Changes {
	/*
	`preview(model, ops)`: the planner, composed as the page composes it, answering `{ ok, ops }` (V-d). `apply(ops)`: how the
	tab applies a planned answer -- the page's carries a selection across a join (`applyAnswer`, B288); a bare model write
	when none is given.
	*/
	constructor(model, { coalesceMs = COALESCE_MS, now = () => Date.now(), preview = null, apply = null } = {}) {
		this.model = model;
		this.preview = preview;
		this.apply = apply ?? ((ops) => applyOps(model, ops));
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
		const applied = this.applyLocally(ops);
		this.#submit({ ops, label: command.label || '', applied }, command.coalesce === true);
	}

	/*
	The intent, planned and applied to this tab: the ops applied, which the answer is reconciled against. Public, because a
	tab whose document was just replaced by a snapshot re-plans what is still its own on the new board (app/src/sync.js
	`replayOutbox`), rather than re-applying what an old board made of it.
	*/
	applyLocally(ops) {
		if (!this.preview) { this.apply(ops); return ops; }
		const planned = this.preview(this.model, ops);
		if (!planned.ok) return [];   // refused here: nothing shown, and the server decides
		this.apply(planned.ops);
		return planned.ops;
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
			this.window.applied.push(...request.applied);
			this.window.until = t + this.coalesceMs;
			return;                                   // still open — nothing goes out yet
		}
		this.#flushWindow();
		if (coalesce) {
			this.window = { label: request.label, ops: [...request.ops], applied: [...request.applied], until: t + this.coalesceMs };
			this.timer = setTimeout(() => this.#flushWindow(), this.coalesceMs);
			if (this.timer.unref) this.timer.unref();
			return;
		}
		this.#emit(request);
	}

	/*
	Close the open window now, emitting whatever it holds.

	Public because a burst must not span a SELECTION CHANGE: nudging A, selecting B, then nudging B
	inside the 600ms window would otherwise fold two different entity sets into one undoable change.
	Input reset its own coalescing state on selection change for exactly this reason (B14's old
	`lastNudge = null`); rewiring onto `amend` would have dropped that property silently, so the
	window it moved into gets the same seam.
	*/
	flush() { this.#flushWindow(); }

	/*
	B242 -- the ops in the open burst window: applied to this tab already (commit applies first), not
	yet submitted, so in no outbox. They are among the tab's unanswered ops that an answer to an earlier
	request must replay (derivedToApply), or an undo answered mid-burst would revert the nudge.
	*/
	openWindowOps() { return this.window ? [...this.window.applied] : []; }   // what the tab applied for it (V-d)

	#flushWindow() {
		if (!this.window) return;
		const w = this.window;
		this.window = null;
		this.#emit({ ops: w.ops, label: w.label, applied: w.applied });
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
