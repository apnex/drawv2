/*
Protocol — one websocket session per client. Envelope: { cmd, body } both ways
(graph lineage). The SERVER owns the document; a client submits transactions and
the server validates, applies, persists, acks and broadcasts. The server sends a
whole document only when asked (hello/open/create/resume) or, Server-Locked, to
live-refresh viewers after a server-side write (via the Hub).

client -> server                          server -> client
  hello  { diagram? }                       snapshot { doc, diagrams, locked, version, canUndo, canRedo }
  open   { id }                             sync     { version, canUndo, canRedo, locked }
  create { name?, doc? }                    ack      { ...change, acked }
  commit { ops, label?, expect?, txnId? }   change   { ...change }
  undo   { expect, txnId? }                 diagrams { list }
  redo   { expect, txnId? }                 error    { message, code, txnId }
  resume { diagram, version }               lock     { owner }
  meta   { name?, slides? }
  select { ids }            (model-state: the authoritative selection)
  reclaim { id? }           (human takes control back from the server side)
  delete { id }             (answers with a snapshot of a surviving diagram)
  list   {}

`resume` replaces `push`: a reconnecting client says what it BELIEVES it holds and
the server answers — `sync` if they are in step (the client keeps its document and
replays its outbox), a snapshot if it is behind, a snapshot marked `rewound` if it
is ahead of the server (D29). The client never sends a document to overwrite one.
Its only whole-document path is `create {doc}`, which mints a NEW diagram.

While a diagram is Server-Locked, client writes (commit/undo/redo/meta/select) are
refused and the client is resynced read-only — it can never clobber the controller.
*/

// the snapshot payload, shared by the websocket and the REST broadcast path so
// the wire shape has one definition. `locked` tells a client, on any snapshot,
// whether the diagram is currently Server-Locked (read-only for it).
import crypto from 'node:crypto';

export function snapshotBody(model, store, locks, principal = null) {
	const id = model.state.meta.id;
	/*
	B67, defence in depth. Every caller is expected to have checked already; this exists so that a
	future one that forgets cannot quietly ship a document to someone with no grant.

	Throwing rather than returning an empty body is deliberate. A doc-less snapshot is a shape no
	client understands, so it would fail somewhere further away from the cause -- and reaching here
	unauthorized is a programming error, not a request to refuse politely.
	*/
	if (!store.canRead(id, principal)) {
		throw new Error(`snapshotBody: ${principal || 'an anonymous caller'} may not read ${id}`);
	}
	const log = store.log(id);
	return {
		doc: model.toJSON(),
		diagrams: store.list(principal),
		locked: locks ? locks.locked(id) : false,
		// H9.3c: the same predicate the server refuses with, so the UI cannot drift from the
		// rule it is presenting. Deliberately not folded into `locked` -- Server-Locked means
		// someone else is driving and offers "take it back", which a reader may not do (B64).
		mayWrite: store.canWrite(id, principal),
		/*
		B76: who the client is. The PRINCIPAL, not the email -- the browser must never have to
		parse an identity, and `user:` vs `agent:` is the distinction that matters to anything
		built on this. Null when authorization is off, which is honest: there is no principal.

		This is the client's own identity and nobody else's. `meta.owner` and `meta.grants` were
		already on the wire inside `doc`, so the browser could enumerate every principal with
		access to a diagram and could not tell which one it was. `mayWrite` answers what may I do;
		this answers who am I, and they are not the same question.
		*/
		principal,
		// the version the document is AT, so a client can `resume` against it later without
		// having to observe a change first (I11: the client never mints this, it only echoes it)
		version: log ? log.version : 0,
		canUndo: !!log?.canUndo(),
		canRedo: !!log?.canRedo(),
		// I14 — a bounded loss no actor can perceive is not a bounded loss, so it rides on
		// hydration too, not only on the change that caused it
		truncated: !!log?.truncated,
		truncatedHuman: !!log?.truncatedHuman,
		undoTop: topRun(log)
	};
}

// The reply to a `resume` that finds the client already in step: no document, just the authority.
// A full snapshot on every reconnect would be a needless O(doc) round trip for a client that is
// already correct — and would discard the local selection and viewport with it.
function syncBody(model, store, locks) {
	const id = model.state.meta.id;
	const log = store.log(id);
	return {
		version: log ? log.version : 0,
		canUndo: !!log?.canUndo(),
		canRedo: !!log?.canRedo(),
		truncated: !!log?.truncated,
		truncatedHuman: !!log?.truncatedHuman,
		undoTop: topRun(log),
		locked: locks ? locks.locked(id) : false
	};
}

/*
D21 — what the browser needs to offer "undo all N changes by <actor>".

The client holds no log, so it cannot see how far back the top run goes; computing it here is one
pass over records the server already has. `to` is the seq the client sends back, so the affordance
and the verb cannot disagree about where the run starts.

A run is consecutive applied records by ONE actor. It is offered when that actor is not you: undoing
your own last change is what Ctrl+Z already means, and needs no explaining.
*/
function topRun(log) {
	const top = log?.peekUndo();
	if (!top) return null;
	let i = log.cursor - 1;
	let n = 0;
	while (i >= 0 && log.records[i].actor === top.actor) { n++; i--; }
	return { seq: top.seq, to: log.records[log.cursor - n].seq, run: n,
		actor: top.actor, by: top.by, label: top.label };
}

// The change payload — one definition, used by the ws ack, the ws broadcast and the REST 200 body.
// `ops` is included so a receiver can apply the change without refetching; `inverse` NEVER goes on
// the wire (it is the server's undo material, and it doubles the payload).
export function changeBody(change, store, id) {
	const log = store.log(id);
	return {
		seq: change.seq, from: change.from, at: change.at,
		by: change.by, actor: change.actor, label: change.label,
		ops: change.ops,
		version: log ? log.version : change.seq,
		durableVersion: store.durableVersion(id),
		canUndo: !!log?.canUndo(), canRedo: !!log?.canRedo(), truncated: !!log?.truncated,
		truncatedHuman: !!log?.truncatedHuman, undoTop: topRun(log),
	};
}

/*
The payload for a REVERSAL (undo/redo) — one definition, used by both transports.

changeBody cannot serve here: undo and redo append no record (D3), so there is no Change to project.
Both transports therefore hand-built this, and they drifted — REST omitted `undoTop`, so a browser
watching an agent undo over REST lost its "undo all N by <actor>" affordance (B17). The drift was
not a typo; it is what happens when one rule has two spellings, which is also how B15 happened.
*/
export function reversalBody(store, id, { ops, version }, { by, actor, label, reversed }) {
	const log = store.log(id);
	return {
		seq: null, from: null, at: Date.now(), by, actor, label,
		ops, version,
		// attribution: WHOSE change was reversed, so a readout can say "undid agent-1's move"
		reversed: reversed ? { seq: reversed.seq, actor: reversed.actor, label: reversed.label } : null,
		durableVersion: store.durableVersion(id),
		canUndo: !!log?.canUndo(), canRedo: !!log?.canRedo(),
		truncated: !!log?.truncated, truncatedHuman: !!log?.truncatedHuman,
		undoTop: topRun(log),
	};
}

// The ack a writer receives for its own request: the change, plus the correlation id it sent.
function ackBody(change, store, id, txnId) {
	return { ...changeBody(change, store, id), acked: txnId ?? null };
}

export class Session {
	constructor(ws, store, hub = null, locks = null, principal = null) {
		// a stable per-session identity: the `actor` on every Change it authors, and what lets
		// undo tell 'my own last change' from 'someone else's'
		this.actor = `s-${crypto.randomUUID().slice(0, 8)}`;
		// who this socket is, resolved once at the upgrade; null when authorization is off
		this.principal = principal;
		this.ws = ws;
		this.store = store;
		this.hub = hub;
		this.locks = locks;
		this.diagramId = null;
		if (hub) hub.add(this);
		// onMessage is async; nothing can await a socket event, so the rejection is caught here.
		ws.on('message', (data) => this.onMessage(data).catch((err) => console.error(`[ session ] unhandled: ${err && err.message}`)));
		ws.on('close', () => { if (hub) hub.remove(this); });
		ws.on('error', () => {});
	}

	send(cmd, body) {
		if (this.ws.readyState === 1) {
			this.ws.send(JSON.stringify({ cmd, body }));
		}
	}

	// B3/I16: a rejection carries a machine-readable code and the caller's correlation id, so the
	// client can surface it against the request that caused it instead of dropping it into a log.
	error(message, code = 'error', txnId = null) {
		console.warn(`[ session ] ${message}`);
		this.send('error', { message, code, txnId });
	}

	snapshot(model) {
		this.diagramId = model.state.meta.id;
		this.send('snapshot', snapshotBody(model, this.store, this.locks, this.principal));
	}

	current() {
		return this.diagramId ? this.store.get(this.diagramId) : null;
	}

	// a browser write is refused while its diagram is Server-Locked; resync the
	// client read-only rather than silently dropping the write
	rejectIfLocked(id) {
		if (!this.locks || !this.locks.locked(id)) return false;
		const model = this.store.get(id);
		this.error('server-locked: read-only');
		if (model) this.snapshot(model);
		return true;
	}

	async onMessage(data) {
		let msg;
		try {
			msg = JSON.parse(data.toString());
		} catch {
			return this.error('malformed JSON');
		}
		if (!msg || typeof msg.cmd !== 'string') return this.error('missing cmd');
		const body = (msg.body && typeof msg.body === 'object') ? msg.body : {};
		try {
			// B59 -- AWAITED. dispatch is async now, and an unawaited call would settle after this
			// try block exits, so the catch below would stop catching: a rejection would escape as
			// an unhandled rejection instead of an error reply, which is exactly the crash vector
			// this handler exists to deny.
			await this.dispatch(msg.cmd, body);
		} catch (err) {
			// a session must survive any payload; validation should catch everything
			// before here, but a crash vector must never take the server down
			this.error(`internal error handling ${msg.cmd}: ${err.message}`);
		}
	}

	async dispatch(cmd, body) {
		switch (cmd) {
			case 'hello': {
				// B67: `first` is principal-scoped, so an unauthorized session gets nothing rather
				// than whichever diagram the Map yielded first
				const asked = body.diagram && this.store.get(body.diagram);
				if (asked && !this.store.canRead(body.diagram, this.principal)) {
					return this.error('forbidden: no access to this diagram', 'forbidden');
				}
				const model = asked || this.store.first(this.principal);
				if (!model) return this.error('no diagrams available');
				return this.snapshot(model);
			}
			case 'open': {
				const model = this.store.get(body.id);
				if (!model) return this.error(`unknown diagram: ${body.id}`);
				// forbidden rather than "unknown", matching the write path: ids are minted and not
				// enumerable, so refusing distinctly costs nothing and telling an agent the truth
				// is worth more than pretending the diagram does not exist
				if (!this.store.canRead(body.id, this.principal)) {
					return this.error('forbidden: no access to this diagram', 'forbidden');
				}
				return this.snapshot(model);
			}
			case 'create': {
				// `doc` is the one whole-document path a client still has, and it can only ever
				// CREATE: the id is minted here and `doc.meta.id` is ignored (I11), so offline work
				// lands in a new diagram instead of overwriting whichever one the server answered
				// with. That overwrite was B2.
				const name = typeof body.name === 'string' ? body.name.slice(0, 64) : undefined;
				const res = this.store.create(name, body.doc || null, this.principal);
				if (!res.ok) return this.error(`create rejected: ${res.error}`, 'create-rejected', body.txnId);
				return this.snapshot(res.model);
			}
			case 'commit': {
				const model = this.current();
				if (!model) return this.error('no diagram open (send hello first)');
				if (this.rejectIfLocked(this.diagramId)) return;
				const res = this.store.commit(this.diagramId, body, 'client', this.actor, this.principal);
				if (!res.ok) return this.error(`commit rejected: ${res.error}`, 'commit-rejected', body.txnId);
				if (this.locks) this.locks.releaseHold(this.diagramId);   // the human took the wheel
				if (!res.change) return this.send('ack', { acked: body.txnId ?? null, noop: true });
				this.send('ack', ackBody(res.change, this.store, this.diagramId, body.txnId));
				if (this.hub) this.hub.broadcast(this.diagramId, 'change', changeBody(res.change, this.store, this.diagramId), this);
				return;
			}
			case 'undo':
			case 'redo': {
				const model = this.current();
				if (!model) return this.error('no diagram open (send hello first)');
				if (this.rejectIfLocked(this.diagramId)) return;
				const log = this.store.log(this.diagramId);
				// D14/GR11: undo's target is IMPLICIT — the top of a shared ring another writer may
				// have moved. A session that did not author the top record must say which version it
				// believes it is undoing.
				/*
				D14 is [LOCKED]: `expect` is MANDATORY on undo and redo. This gate used to waive it
				for redo entirely, and for undo whenever you authored the top record — but "I wrote
				the top record" is exactly the belief D14 exists to distrust. The ring is shared, and
				another writer can interleave between the read that formed the belief and the undo
				that acts on it. Tightened to match REST and the decision; safe because the browser
				already sends expect on every undo and redo (app/src/changes.js:94-95).
				*/
				if (body.expect == null) {
					return this.error('expect required on undo/redo', 'expect-required', body.txnId);
				}
				if (body.expect != null && body.expect !== log?.version) {
					return this.error('version conflict', 'version-conflict', body.txnId);
				}
				// D21 — `to` names the OLDEST change to reverse; the run comes back as ONE
				// transaction, one version bump, one broadcast. Validated in txn.undo, which
				// refuses a seq the ring does not currently hold rather than clamping it.
				const reversing = cmd === 'undo' ? log?.peekUndo() : log?.peekRedo();
				const res = cmd === 'undo'
					? this.store.undo(this.diagramId, Number.isInteger(body.to) ? body.to : null, this.principal)
					: this.store.redo(this.diagramId, this.principal);
				if (!res.ok) return this.error(`${cmd} rejected: ${res.error}`, `${cmd}-rejected`, body.txnId);
				const payload = reversalBody(this.store, this.diagramId, res,
					{ by: 'client', actor: this.actor, label: cmd, reversed: reversing });
				this.send('ack', { ...payload, acked: body.txnId ?? null });
				if (this.hub) this.hub.broadcast(this.diagramId, 'change', payload, this);
				return;
			}
			case 'resume': {
				// A reconnecting client's FIRST message on the new socket. It declares what it
				// believes it holds; the server answers. It never sends a document — the diagram
				// on disk is not the client's to overwrite (that was `push`, and B2 with it).
				const model = this.store.get(body.diagram);
				if (!model) return this.error(`unknown diagram: ${body.diagram}`, 'unknown-diagram');
				this.diagramId = body.diagram;
				const log = this.store.log(this.diagramId);
				// I11: the client's number is a BELIEF, never an authority. It selects which reply
				// to send and is otherwise discarded — it can neither set nor advance the version.
				const believed = Number.isInteger(body.version) ? body.version : null;
				if (believed === log.version) return this.send('sync', syncBody(model, this.store, this.locks));
				// D29: the client is AHEAD of us — it holds acked changes we lost (a restart before
				// the flush). Say so. A bare snapshot here would revert its work in silence.
				const rewound = believed !== null && believed > log.version
					? { from: believed, to: log.version } : null;
				const payload = snapshotBody(model, this.store, this.locks, this.principal);
				return this.send('snapshot', rewound ? { ...payload, rewound } : payload);
			}

			case 'select': {
				// model-state (status): the authoritative selection. Mirrors meta — lock-gated, no version bump.
				const model = this.current();
				if (!model) return this.error('no diagram open (send hello first)');
				if (this.rejectIfLocked(this.diagramId)) return;
				const err = this.store.setSelection(this.diagramId, body.ids, this.principal);
				if (err) return this.error(`select rejected: ${err}`);
				// B34 — the ws used to broadcast NOTHING here while REST shipped a whole snapshot, so
				// the two transports disagreed on whether selection was even shareable. It is: a
				// first-class event, carrying who moved the focus.
				const ids = [...model.state.selection];
				if (this.hub) this.hub.broadcast(this.diagramId, 'selection', { ids, actor: this.actor }, this);
				return this.send('ack', { ok: true, acked: body.txnId ?? null });
			}
			case 'reclaim': {
				// the human takes control back from the server side (force-release).
				// No token: the browser user owns the tool.
				const id = body.id || this.diagramId;
				const model = this.store.get(id);
				if (!model) return this.error(`unknown diagram: ${id}`);
				// B64: "the browser user owns the tool" was true when every browser user was the
				// owner. Force-releasing another controller's lock is a write capability -- a
				// reader could otherwise break a legitimate agent's session at will -- and it is
				// also the owner's remedy against a lock held by someone since revoked, which is
				// why locks need not track who holds them.
				if (!this.store.canWrite(id, this.principal)) {
					return this.error('forbidden: no write access to this diagram', 'forbidden');
				}
				if (this.locks) this.locks.reclaim(id);
				if (this.hub) this.hub.broadcast(id, 'lock', { owner: 'client' });
				return this.snapshot(model);
			}
			case 'delete': {
				if (!this.store.get(body.id)) return this.error(`unknown diagram: ${body.id}`);
				// don't let the browser delete a diagram a server-side controller owns
				if (this.locks && this.locks.locked(body.id)) return this.error('server-locked: read-only');
				const err = await this.store.remove(body.id, this.principal);
				if (err) return this.error(err);
				console.log(`[ session ] deleted diagram ${body.id}`);
				if (this.diagramId === body.id) this.diagramId = null;
				// always leave the client on a live diagram (the store never goes empty)
				return this.snapshot(this.store.first());
			}
			case 'list':
				return this.send('diagrams', { list: this.store.list(this.principal) });
			default:
				return this.error(`unknown cmd: ${cmd}`);
		}
	}
}
