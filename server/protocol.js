/*
Protocol — one websocket session per client. Envelope: { cmd, body } both ways
(graph lineage). The client owns mutations; the server validates, applies,
persists, and acks. The server pushes model changes only as a snapshot — to
answer hello/open/create/push, OR (Server-Locked) to live-refresh viewers after
a server-side write (via the Hub).

client -> server                          server -> client
  hello  { diagram? }                       snapshot { doc, diagrams, locked }
  open   { id }                             ack      { rev }
  create { name? }                          diagrams { list }
  apply  { action, kind, entity }           error    { message }
  push   { doc }            (reconnect resync, client-authoritative)   lock { owner }
  meta   { name?, slides? }
  select { ids }            (model-state: the authoritative selection)
  reclaim { id? }           (human takes control back from the server side)
  delete { id }             (answers with a snapshot of a surviving diagram)
  list   {}

While a diagram is Server-Locked, client writes (apply/push/meta) are refused and
the client is resynced read-only — it can never clobber the server-side controller.
*/

// the snapshot payload, shared by the websocket and the REST broadcast path so
// the wire shape has one definition. `locked` tells a client, on any snapshot,
// whether the diagram is currently Server-Locked (read-only for it).
export function snapshotBody(model, store, locks) {
	return {
		doc: model.toJSON(),
		diagrams: store.list(),
		locked: locks ? locks.locked(model.state.meta.id) : false
	};
}

export class Session {
	constructor(ws, store, hub = null, locks = null) {
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

	error(message) {
		console.warn(`[ session ] ${message}`);
		this.send('error', { message });
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
				const name = typeof body.name === 'string' ? body.name.slice(0, 64) : undefined;
				return this.snapshot(this.store.create(name));
			}
			case 'apply': {
				const model = this.current();
				if (!model) return this.error('no diagram open (send hello first)');
				if (this.rejectIfLocked(this.diagramId)) return;
				const err = this.store.apply(this.diagramId, body);
				if (err) return this.error(`apply rejected: ${err}`);
				return this.send('ack', { rev: model.state.meta.rev });
			}
			case 'push': {
				// a reconnecting client sends push as its FIRST message on the new
				// socket — adopt the pushed doc's diagram if it exists in the store
				let model = this.current();
				if (!model && body.doc && body.doc.meta && this.store.get(body.doc.meta.id)) {
					this.diagramId = body.doc.meta.id;
					model = this.store.get(this.diagramId);
				}
				if (!model) return this.error('no diagram open (send hello first)');
				// a reconnect must NEVER overwrite a server-side controller's work
				if (this.rejectIfLocked(this.diagramId)) return;
				const err = this.store.replace(this.diagramId, body.doc);
				if (err) return this.error(`push rejected: ${err}`);
				return this.send('ack', { rev: model.state.meta.rev });
			}
			case 'meta': {
				const model = this.current();
				if (!model) return this.error('no diagram open (send hello first)');
				if (this.rejectIfLocked(this.diagramId)) return;
				const err = this.store.patchMeta(this.diagramId, body);
				if (err) return this.error(`meta rejected: ${err}`);
				return this.send('ack', { rev: model.state.meta.rev });
			}
			case 'select': {
				// model-state (status): the authoritative selection. Mirrors meta — lock-gated, no rev bump.
				const model = this.current();
				if (!model) return this.error('no diagram open (send hello first)');
				if (this.rejectIfLocked(this.diagramId)) return;
				const err = this.store.setSelection(this.diagramId, body.ids);
				if (err) return this.error(`select rejected: ${err}`);
				return this.send('ack', { rev: model.state.meta.rev });
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
