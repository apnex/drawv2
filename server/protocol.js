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

export function snapshotBody(model, store, locks) {
	const id = model.state.meta.id;
	const log = store.diagrams.get(id)?.log;
	return {
		doc: model.toJSON(),
		diagrams: store.list(),
		locked: locks ? locks.locked(id) : false,
		// the version the document is AT, so a client can `resume` against it later without
		// having to observe a change first (I11: the client never mints this, it only echoes it)
		version: log ? log.version : 0,
		canUndo: !!log?.canUndo(),
		canRedo: !!log?.canRedo()
	};
}

// The reply to a `resume` that finds the client already in step: no document, just the authority.
// A full snapshot on every reconnect would be a needless O(doc) round trip for a client that is
// already correct — and would discard the local selection and viewport with it.
export function syncBody(model, store, locks) {
	const id = model.state.meta.id;
	const log = store.diagrams.get(id)?.log;
	return {
		version: log ? log.version : 0,
		canUndo: !!log?.canUndo(),
		canRedo: !!log?.canRedo(),
		locked: locks ? locks.locked(id) : false
	};
}

// The change payload — one definition, used by the ws ack, the ws broadcast and the REST 200 body.
// `ops` is included so a receiver can apply the change without refetching; `inverse` NEVER goes on
// the wire (it is the server's undo material, and it doubles the payload).
export function changeBody(change, store, id) {
	const entry = store.diagrams.get(id);
	const log = entry?.log;
	return {
		seq: change.seq, from: change.from, at: change.at,
		by: change.by, actor: change.actor, label: change.label,
		ops: change.ops,
		version: log ? log.version : change.seq,
		durableVersion: entry && !entry.dirty ? log.version : (log ? log.version - 1 : 0),
		canUndo: !!log?.canUndo(), canRedo: !!log?.canRedo(), truncated: !!log?.truncated,
	};
}

// The ack a writer receives for its own request: the change, plus the correlation id it sent.
export function ackBody(change, store, id, txnId) {
	return { ...changeBody(change, store, id), acked: txnId ?? null };
}

export class Session {
	constructor(ws, store, hub = null, locks = null) {
		// a stable per-session identity: the `actor` on every Change it authors, and what lets
		// undo tell 'my own last change' from 'someone else's'
		this.actor = `s-${crypto.randomUUID().slice(0, 8)}`;
		this.ws = ws;
		this.store = store;
		this.hub = hub;
		this.locks = locks;
		this.diagramId = null;
		if (hub) hub.add(this);
		ws.on('message', (data) => this.onMessage(data));
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
		this.send('snapshot', snapshotBody(model, this.store, this.locks));
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

	onMessage(data) {
		let msg;
		try {
			msg = JSON.parse(data.toString());
		} catch {
			return this.error('malformed JSON');
		}
		if (!msg || typeof msg.cmd !== 'string') return this.error('missing cmd');
		const body = (msg.body && typeof msg.body === 'object') ? msg.body : {};
		try {
			this.dispatch(msg.cmd, body);
		} catch (err) {
			// a session must survive any payload; validation should catch everything
			// before here, but a crash vector must never take the server down
			this.error(`internal error handling ${msg.cmd}: ${err.message}`);
		}
	}

	dispatch(cmd, body) {
		switch (cmd) {
			case 'hello': {
				const model = (body.diagram && this.store.get(body.diagram)) || this.store.first();
				if (!model) return this.error('no diagrams available');
				return this.snapshot(model);
			}
			case 'open': {
				const model = this.store.get(body.id);
				if (!model) return this.error(`unknown diagram: ${body.id}`);
				return this.snapshot(model);
			}
			case 'create': {
				// `doc` is the one whole-document path a client still has, and it can only ever
				// CREATE: the id is minted here and `doc.meta.id` is ignored (I11), so offline work
				// lands in a new diagram instead of overwriting whichever one the server answered
				// with. That overwrite was B2.
				const name = typeof body.name === 'string' ? body.name.slice(0, 64) : undefined;
				const res = this.store.create(name, body.doc || null);
				if (!res.ok) return this.error(`create rejected: ${res.error}`, 'create-rejected', body.txnId);
				return this.snapshot(res.model);
			}
			case 'commit': {
				const model = this.current();
				if (!model) return this.error('no diagram open (send hello first)');
				if (this.rejectIfLocked(this.diagramId)) return;
				const res = this.store.commit(this.diagramId, body, 'client', this.actor);
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
				const log = this.store.diagrams.get(this.diagramId)?.log;
				// D14/GR11: undo's target is IMPLICIT — the top of a shared ring another writer may
				// have moved. A session that did not author the top record must say which version it
				// believes it is undoing.
				const top = log?.peekUndo();
				const mine = cmd === 'undo' ? (top && top.actor === this.actor) : true;
				if (!mine && body.expect == null) {
					return this.error('expect required on undo/redo', 'expect-required', body.txnId);
				}
				if (body.expect != null && body.expect !== log?.version) {
					return this.error('version conflict', 'version-conflict', body.txnId);
				}
				const res = cmd === 'undo' ? this.store.undo(this.diagramId) : this.store.redo(this.diagramId);
				if (!res.ok) return this.error(`${cmd} rejected: ${res.error}`, `${cmd}-rejected`, body.txnId);
				const payload = { seq: null, from: null, at: Date.now(), by: 'client', actor: this.actor,
					label: cmd, ops: res.ops, version: res.version,
					durableVersion: this.store.diagrams.get(this.diagramId).dirty ? res.version - 1 : res.version,
					canUndo: !!log.canUndo(), canRedo: !!log.canRedo(), truncated: !!log.truncated };
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
				const log = this.store.diagrams.get(this.diagramId).log;
				// I11: the client's number is a BELIEF, never an authority. It selects which reply
				// to send and is otherwise discarded — it can neither set nor advance the version.
				const believed = Number.isInteger(body.version) ? body.version : null;
				if (believed === log.version) return this.send('sync', syncBody(model, this.store, this.locks));
				// D29: the client is AHEAD of us — it holds acked changes we lost (a restart before
				// the flush). Say so. A bare snapshot here would revert its work in silence.
				const rewound = believed !== null && believed > log.version
					? { from: believed, to: log.version } : null;
				const payload = snapshotBody(model, this.store, this.locks);
				return this.send('snapshot', rewound ? { ...payload, rewound } : payload);
			}

			case 'select': {
				// model-state (status): the authoritative selection. Mirrors meta — lock-gated, no rev bump.
				const model = this.current();
				if (!model) return this.error('no diagram open (send hello first)');
				if (this.rejectIfLocked(this.diagramId)) return;
				const err = this.store.setSelection(this.diagramId, body.ids);
				if (err) return this.error(`select rejected: ${err}`);
				return this.send('ack', { ok: true });
			}
			case 'reclaim': {
				// the human takes control back from the server side (force-release).
				// No token: the browser user owns the tool.
				const id = body.id || this.diagramId;
				const model = this.store.get(id);
				if (!model) return this.error(`unknown diagram: ${id}`);
				if (this.locks) this.locks.reclaim(id);
				if (this.hub) this.hub.broadcast(id, 'lock', { owner: 'client' });
				return this.snapshot(model);
			}
			case 'delete': {
				if (!this.store.get(body.id)) return this.error(`unknown diagram: ${body.id}`);
				// don't let the browser delete a diagram a server-side controller owns
				if (this.locks && this.locks.locked(body.id)) return this.error('server-locked: read-only');
				const err = this.store.remove(body.id);
				if (err) return this.error(err);
				console.log(`[ session ] deleted diagram ${body.id}`);
				if (this.diagramId === body.id) this.diagramId = null;
				// always leave the client on a live diagram (the store never goes empty)
				return this.snapshot(this.store.first());
			}
			case 'list':
				return this.send('diagrams', { list: this.store.list() });
			default:
				return this.error(`unknown cmd: ${cmd}`);
		}
	}
}
