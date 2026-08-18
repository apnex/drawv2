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
		this.selection = selection;
		this.onState = onState || (() => {});
		this.hydrated = false;
		this.loading = false;
		this.expectLoad = false; // a snapshot we asked for (open/create) always loads
		this.locked = false;     // Server-Locked: a server-side controller owns writes
		this.lockShownAt = 0;    // when the amber indicator went up (for the min dwell)
		this.unlockTimer = null; // pending return-to-green after the min dwell
		this.queue = [];
		this.selectionDirty = false; // a selection (model-state) change pending forward to the server (R2)

		net.subscribe((msg) => this.onMessage(msg));
		net.onStatus((status) => this.onStatus(status));
		model.onChange((action, kind, entity) => this.onChange(action, kind, entity));
		selection.subscribe(() => this.onSelectionChange()); // forward selection (model-state) to the server (R2)
		this.pulse = setInterval(() => this.flush(), PULSE_MS);
	}

	// ---- outbound ----
	onChange(action, kind, entity) {
		if (this.loading || action === 'load' || !this.hydrated) return;
		const copy = { ...entity };
		if (copy.members) copy.members = [...copy.members];
		if (action === 'set') {
			// coalesce into a queued set for this entity, but ANY del/put is an
			// ordering barrier: group members and link endpoints are cross-entity
			// references, so a set must never move earlier than a structural op
			for (let i = this.queue.length - 1; i >= 0; i--) {
				const q = this.queue[i];
				if (q.action !== 'set') break;
				if (q.kind === kind && q.entity.id === copy.id) { q.entity = copy; return; }
			}
		}
		this.queue.push({ action, kind, entity: copy });
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
		if (this.locked) { this.queue = []; this.selectionDirty = false; return; }
		if (!this.net.isOpen() || !this.hydrated) return;
		if (this.queue.length) {
			this.queue.forEach((mutation) => this.net.send('apply', mutation));
			this.queue = [];
		}
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
				this.queue = [];
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
			this.queue = [];
			this.history.clear();
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
		if (msg.cmd === 'error') {
			console.warn('[ sync ] server: ' + msg.body.message);
		}
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
			this.queue = []; // drop any unsent local edits
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
				this.queue = [];
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
		this.queue = [];
		this.net.send('open', { id });
	}

	createDiagram() {
		if (!this.net.isOpen() || !this.hydrated) return this.emitState({});
		this.flush();
		this.hydrated = false;
		this.expectLoad = true;
		this.queue = [];
		this.net.send('create', {});
	}

	// destructive and not undoable: the UI arms before calling this
	deleteDiagram() {
		if (!this.net.isOpen() || !this.hydrated) return this.emitState({});
		this.hydrated = false;
		this.expectLoad = true;
		this.queue = [];
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
