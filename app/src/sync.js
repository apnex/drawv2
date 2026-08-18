import { applyOps } from '../../document/ops.mjs';

/*
Sync — wires the model to the wire. Unidirectional ownership (docs/spec/SCOPE.md):
this client is the only writer. Every committed model change is forwarded as
an apply delta, batched on a 200ms pulse with consecutive sets on the same
entity coalesced (prism's metabolic pulse, client-side).

Session semantics: hydrate once on first connect (server is persistence-of-
record between sessions); on RE-connect, push the full local document instead
(the client is authoritative during a session).
*/

const PULSE_MS = 200;
const MIN_LOCK_MS = 1000; // keep the amber indicator up at least this long so a fast lock is visible
const LAST_DIAGRAM_KEY = 'draw.diagram';

export class Sync {
	constructor({ model, net, history, selection, onState }) {
		this.model = model;
		this.net = net;
		this.history = history;
		this.changes = history;   // the commit boundary (Changes); named for what it now is
		this.selection = selection;
		this.onState = onState || (() => {});
		this.hydrated = false;
		this.loading = false;
		this.expectLoad = false; // a snapshot we asked for (open/create) always loads
		this.locked = false;     // Server-Locked: a server-side controller owns writes
		this.lockShownAt = 0;    // when the amber indicator went up (for the min dwell)
		this.unlockTimer = null; // pending return-to-green after the min dwell
		this.outbox = [];
		this.selectionDirty = false; // a selection (model-state) change pending forward to the server (R2)
		this.outbox = [];            // submitted, not yet known durable
		this.deferred = [];          // inbound changes held while a gesture is live (D12)
		this.txn = 0;                // correlation ids, so a rejection can name its request

		net.subscribe((msg) => this.onMessage(msg));
		net.onStatus((status) => this.onStatus(status));
		// NOT model.onChange — that is the RENDER signal, and app/src/input.js writes live drag
		// state into the model on every pointer-move frame. Sync listens to the commit boundary,
		// so an uncommitted preview cannot reach the wire (D4).
		selection.subscribe(() => this.onSelectionChange()); // forward selection (model-state) to the server (R2)
		// no pulse: a commit is a user-action-rate event, so it goes out immediately. Selection
		// keeps a short trailing flush because Selection.changed() fires per entity during a cascade.
		this.selectionTimer = null;
	}

	// ---- outbound ----

	// The ONE outbound path. `request` is either a commit ({ops, label}) or an undo/redo verb.
	// Everything the browser writes goes through here because everything goes through Changes.
	submit(request) {
		if (this.locked) return;                       // read-only while Server-Locked
		if (!this.hydrated) return;
		const txnId = `t${++this.txn}`;
		const msg = request.verb
			? { verb: request.verb, expect: request.expect, txnId }
			: { ops: request.ops, label: request.label, txnId };
		this.outbox.push(msg);
		this.drain();
	}

	// The outbox holds what has been submitted but not yet acknowledged as DURABLE. Pruning on
	// `ack` alone would drop a change the server has accepted but not yet flushed.
	drain() {
		if (!this.net.isOpen() || this.locked) return;
		for (const msg of this.outbox) {
			if (msg.sent) continue;
			const ok = msg.verb
				? this.net.send(msg.verb, { expect: msg.expect, txnId: msg.txnId })
				: this.net.send('commit', { ops: msg.ops, label: msg.label, txnId: msg.txnId });
			if (!ok) return;                            // socket closed mid-drain; retry on reconnect
			msg.sent = true;
		}
	}

	pruneOutbox(durableVersion) {
		if (typeof durableVersion !== 'number') return;
		this.outbox = this.outbox.filter((m) => !(m.sent && m.version !== undefined && m.version <= durableVersion));
	}

	// a selection (model-state) change is coalesced to a dirty flag and forwarded on the pulse, AFTER
	// the entity queue (referenced entities must exist server-side first). Read-only / pre-hydration
	// changes are dropped — the server is authoritative then. (R2)
	onSelectionChange() {
		if (this.loading || !this.hydrated || this.locked) return;
		this.selectionDirty = true;
	}

	flush() {
		// while Server-Locked the browser is read-only — never push edits up
		if (this.locked) { this.outbox = []; this.selectionDirty = false; return; }
		if (!this.net.isOpen() || !this.hydrated) return;
		this.drain();
		if (this.selectionDirty) {
			this.net.send('select', { ids: this.selection.list() }); // after the entity queue
			this.selectionDirty = false;
		}
	}

	// ---- inbound ----
	localEntityCount() {
		return ['node', 'link', 'zone', 'group'].reduce((n, k) => n + this.model.all(k).length, 0);
	}

	onMessage(msg) {
		if (msg.cmd === 'snapshot') {
			const doc = msg.body.doc;
			if (!this.expectLoad && !this.hydrated && this.localEntityCount() > 0 && !msg.body.locked) {
				// the user drew content before the server answered (offline start /
				// slow boot). Client is authoritative during a session: adopt the
				// server diagram's identity, keep the local content, push it up.
				// (Skipped when the diagram is Server-Locked — you can't author into
				// it; fall through to a read-only load of the controller's state.)
				this.loading = true;
				this.model.state.meta = {
					...this.model.state.meta,
					id: doc.meta.id,
					name: doc.meta.name,
					slides: { ...this.model.state.meta.slides, ...(doc.meta.slides || {}) }
				};
				this.loading = false;
				this.hydrated = true;
				this.outbox = [];
				if (this.pendingSlidesUrl) {
					this.model.state.meta.slides.url = this.pendingSlidesUrl;
					this.pendingSlidesUrl = null;
				}
				this.net.send('push', { doc: this.model.toJSON() });
				try { localStorage.setItem(LAST_DIAGRAM_KEY, doc.meta.id); } catch { /* private mode */ }
				this.setUrl(doc.meta.id);
				this.emitState({ diagrams: msg.body.diagrams });
				return;
			}
			this.loading = true;
			this.outbox = [];
			this.model.load(doc); // model.load now restores the authoritative selection from doc.selection (R2) — no clear
			this.loading = false;
			this.hydrated = true;
			this.expectLoad = false;
			// the loaded diagram's lock state is authoritative — drop any pending dwell
			if (this.unlockTimer) { clearTimeout(this.unlockTimer); this.unlockTimer = null; }
			this.locked = !!msg.body.locked;
			if (this.locked) this.lockShownAt = Date.now();
			if (this.pendingSlidesUrl) {
				// a slides URL typed before hydration must survive the snapshot
				this.model.state.meta.slides.url = this.pendingSlidesUrl;
				this.net.send('meta', { slides: { url: this.pendingSlidesUrl } });
				this.pendingSlidesUrl = null;
			}
			try { localStorage.setItem(LAST_DIAGRAM_KEY, doc.meta.id); } catch { /* private mode */ }
			this.setUrl(doc.meta.id);
			this.emitState({ diagrams: msg.body.diagrams });
		}
		if (msg.cmd === 'lock') {
			// the server handed write control to/from a server-side controller
			this.applyLock(msg.body.owner === 'server');
		}
		// our own request came back: reflect the server's authority, prune what is now durable
		if (msg.cmd === 'ack') {
			const b = msg.body || {};
			this.changes.setCounts({ canUndo: b.canUndo, canRedo: b.canRedo, version: b.version, undoLabel: b.label });
			const sent = this.outbox.find((m) => m.txnId === b.acked);
			if (sent) sent.version = b.version;
			this.pruneOutbox(b.durableVersion);
			if (Array.isArray(b.ops) && (b.label === 'undo' || b.label === 'redo')) applyOps(this.model, b.ops);
			this.emitState({});
			return;
		}
		// someone else's change. Apply it, unless a gesture is mid-flight — a model.load or a
		// competing write landing under a live drag fights the preview (D12).
		if (msg.cmd === 'change') {
			const b = msg.body || {};
			this.changes.setCounts({ canUndo: b.canUndo, canRedo: b.canRedo, version: b.version });
			if (this.deferInbound && this.deferInbound()) { this.deferred.push(b); return; }
			this.applyChange(b);
			this.emitState({});
			return;
		}
		if (msg.cmd === 'error') {
			// B3/I16: a rejection is surfaced against the request that caused it, never dropped
			const b = msg.body || {};
			const dropped = this.outbox.findIndex((m) => m.txnId === b.txnId);
			if (dropped >= 0) {
				this.outbox.splice(dropped, 1);
				// The commit was applied LOCALLY before it was submitted — that is what makes a
				// gesture feel instant. A rejection therefore leaves this tab holding a change the
				// server refused, and it will never converge on its own. Ask for authoritative
				// state. (Found by tests/convergence.test.js, not by reasoning about it.)
				this.requestResync();
			}
			console.warn(`[ sync ] server: ${b.message} (${b.code || 'error'})`);
			this.onState({ error: b.message, code: b.code });
		}
	}

	// Re-open the current diagram: the server answers with a snapshot, which is authoritative.
	// Used when this tab knows it has diverged — a rejected optimistic apply, or a change whose
	// `from` is ahead of us (we missed one).
	requestResync() {
		if (!this.diagramId || !this.net.isOpen()) return;
		this.expectLoad = true;
		this.net.send('open', { id: this.diagramId });
	}

	// A change from another writer. `from` is the version it applied to: equal to ours means we are
	// in step; BELOW ours is a duplicate and is ignored (re-applying would fight the local state);
	// ABOVE ours means we missed one, so ask for the authoritative document.
	applyChange(body) {
		const v = this.changes.state.version;
		if (typeof body.from === 'number') {
			if (body.from < v - 1) return;                 // a duplicate: ignore, never re-apply
			if (body.from > v) return this.requestResync();  // we missed one: repair, do not guess
		}
		if (Array.isArray(body.ops)) applyOps(this.model, body.ops);
	}

	// replay whatever landed while a gesture was in flight
	releaseDeferred() {
		const pending = this.deferred;
		this.deferred = [];
		pending.forEach((b) => this.applyChange(b));
		if (pending.length) this.emitState({});
	}

	/*
	Apply a lock transition with a minimum amber dwell: a lock then a near-instant
	release (a controller that edits and lets go in well under a second) must still
	be visible. The lock releases crisply server-side; this only holds the browser's
	read-only/amber state for up to MIN_LOCK_MS before returning to green.
	*/
	applyLock(serverLocked) {
		if (serverLocked) {
			if (this.unlockTimer) { clearTimeout(this.unlockTimer); this.unlockTimer = null; }
			if (!this.locked) this.lockShownAt = Date.now();
			this.locked = true;
			this.outbox = []; // drop any unsent local edits
			this.emitState({});
			return;
		}
		if (this.unlockTimer || !this.locked) return; // already returning, or never locked
		const remaining = MIN_LOCK_MS - (Date.now() - this.lockShownAt);
		if (remaining <= 0) { this.locked = false; this.emitState({}); return; }
		this.unlockTimer = setTimeout(() => {
			this.unlockTimer = null;
			this.locked = false;
			this.emitState({});
		}, remaining);
	}

	// the human takes control back from a server-side controller (force-release)
	reclaim() {
		if (this.net.isOpen()) this.net.send('reclaim', { id: this.model.state.meta.id });
	}

	// /next?d=<id> (this thin UI) or legacy /d/<id> in the address bar wins over last-opened
	urlDiagram() {
		const q = new URLSearchParams(location.search).get('d');
		if (q && /^diagram-[0-9a-f]{6}$/.test(q)) return q;
		const match = location.pathname.match(/^\/d\/(diagram-[0-9a-f]{6})$/);
		return match ? match[1] : null;
	}

	setUrl(id) {
		try {
			if (this.urlDiagram() !== id) history.replaceState(null, '', `/d/${id}`);
		} catch { /* non-http context (file://, sandboxed) — URL stays as-is */ }
	}

	onStatus(status) {
		if (status === 'open') {
			if (!this.hydrated) {
				let last = null;
				try { last = localStorage.getItem(LAST_DIAGRAM_KEY); } catch { /* private mode */ }
				this.net.send('hello', { diagram: this.urlDiagram() || last || undefined });
			} else {
				this.outbox = [];
				if (this.locked) {
					// can't push while Server-Locked — re-fetch the controller's state
					this.expectLoad = true;
					this.net.send('open', { id: this.model.state.meta.id });
				} else {
					// reconnect: local state is authoritative for this session
					this.net.send('push', { doc: this.model.toJSON() });
				}
			}
		}
		this.emitState({});
	}

	emitState(extra) {
		this.onState({
			status: this.net.status,
			meta: this.model.state.meta,
			locked: this.locked,
			...extra
		});
	}

	// ---- diagram management (header menu) ----
	openDiagram(id) {
		if (id === this.model.state.meta.id) return;
		if (!this.net.isOpen() || !this.hydrated) return this.emitState({}); // can't switch offline
		this.flush(); // don't lose the current pulse window's edits
		this.hydrated = false;
		this.expectLoad = true;
		this.outbox = [];
		this.net.send('open', { id });
	}

	createDiagram() {
		if (!this.net.isOpen() || !this.hydrated) return this.emitState({});
		this.flush();
		this.hydrated = false;
		this.expectLoad = true;
		this.outbox = [];
		this.net.send('create', {});
	}

	// destructive and not undoable: the UI arms before calling this
	deleteDiagram() {
		if (!this.net.isOpen() || !this.hydrated) return this.emitState({});
		this.hydrated = false;
		this.expectLoad = true;
		this.outbox = [];
		this.net.send('delete', { id: this.model.state.meta.id });
	}

	rename(name) {
		if (this.locked) return this.emitState({}); // read-only: revert the field
		const trimmed = name.trim().slice(0, 64);
		if (!trimmed) return this.emitState({});
		this.model.state.meta.name = trimmed;
		if (this.hydrated) this.net.send('meta', { name: trimmed });
		this.emitState({});
	}

	setSlidesUrl(url) {
		if (this.locked) return this.emitState({}); // read-only: revert the field
		this.model.state.meta.slides.url = url.trim().slice(0, 512);
		if (this.hydrated) this.net.send('meta', { slides: { url: this.model.state.meta.slides.url } });
		else this.pendingSlidesUrl = this.model.state.meta.slides.url; // replay after hydration
	}

	// remember which slide a successful push landed on (re-sync targets it);
	// ignored if the user switched or deleted diagrams while the push was in flight
	setSlidesBinding(diagramId, presentationId, pageId) {
		if (this.model.state.meta.id !== diagramId) return;
		Object.assign(this.model.state.meta.slides, { presentationId, pageId });
		if (this.hydrated) this.net.send('meta', { slides: { presentationId, pageId } });
	}
}
