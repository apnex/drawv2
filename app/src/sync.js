import { applyOps } from '../../document/ops.mjs';

/*
Sync — wires the model to the wire. The SERVER owns the document; this client
submits transactions through the commit boundary (Changes) and reflects what
comes back. Every committed change goes out as one `commit`; nothing else can.

Session semantics: hydrate on first connect (hello -> snapshot). On RE-connect,
`resume {diagram, version}` — the client declares what it believes it holds and
the server answers: `sync` if they are in step (keep the document, replay the
outbox), a snapshot if it is behind, a snapshot marked `rewound` if it is AHEAD
of the server (D29 — acked work the server lost, said out loud rather than
reverted in silence). The client never sends a document to overwrite one; that
was `push`, and it destroyed a real diagram whenever the user drew before the
server answered (B2). Its one whole-document path is `create {name, doc}`, which
mints a NEW diagram.

The outbox holds what has been submitted but is not yet known durable, and is
persisted (D30), so offline work survives a tab close and not merely a drop.
*/

const MIN_LOCK_MS = 1000; // keep the amber indicator up at least this long so a fast lock is visible
const LAST_DIAGRAM_KEY = 'draw.diagram';
const OUTBOX_KEY = 'draw.outbox';

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
		this.selectionDirty = false; // a selection (model-state) change pending forward to the server (R2)
		this.outbox = [];            // submitted, not yet known durable; persisted (D30)
		this.deferred = [];          // inbound changes held while a gesture is live (D12)
		this.diagramId = null;       // the loaded diagram; what a resync and the outbox belong to
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
		this.persistOutbox();
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
		this.persistOutbox();
	}

	/*
	D30 — the outbox is persisted, so unsent work survives a tab close and not merely a socket drop.

	Only commits are kept. An undo/redo carries `expect`, a version that is stale the moment the tab
	closes; replaying one would earn a version-conflict, and reversing an unknown change on a later
	session is not what the user asked for anyway.
	*/
	persistOutbox() {
		try {
			const pending = this.outbox.filter((m) => !m.verb).map(({ ops, label, txnId }) => ({ ops, label, txnId }));
			if (!pending.length) localStorage.removeItem(OUTBOX_KEY);
			else localStorage.setItem(OUTBOX_KEY, JSON.stringify({ diagram: this.model.state.meta.id, msgs: pending }));
		} catch { /* private mode: the outbox is still correct in memory */ }
	}

	// Restore on hydration. TOLERATE-AND-DROP: a malformed record costs the replay, never the
	// document — the same precedent the Log follows on a corrupt file.
	restoreOutbox(diagramId) {
		let saved = null;
		try { saved = JSON.parse(localStorage.getItem(OUTBOX_KEY) || 'null'); } catch { /* corrupt */ }
		if (!saved || saved.diagram !== diagramId || !Array.isArray(saved.msgs)) return;
		const msgs = saved.msgs.filter((m) => m && Array.isArray(m.ops) && m.ops.length);
		for (const m of msgs) this.outbox.push({ ops: m.ops, label: m.label, txnId: `t${++this.txn}` });
	}

	/*
	Re-send what the server has not confirmed durable.

	`reapply` says the local document was just replaced by an authoritative one, which does not
	carry these changes — so they are applied locally as well as re-sent, the same order
	Changes.commit uses. Replay is safe either way: every op is idempotent, so a change the server
	DID receive plans zero ops and is accepted as a no-op rather than applied twice.
	*/
	replayOutbox({ reapply }) {
		for (const m of this.outbox) {
			m.sent = false;
			if (reapply && Array.isArray(m.ops)) applyOps(this.model, m.ops);
		}
		this.drain();
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
		if (this.locked) { this.outbox = []; this.persistOutbox(); this.selectionDirty = false; return; }
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
				/*
				B2 — the user drew before the server answered (offline start, slow boot).

				That work becomes a NEW diagram. The old path adopted the identity of whichever
				diagram the server happened to answer with and pushed its own content over the top,
				destroying real content that had nothing to do with this tab. The server mints the
				id (I11); this doc's `meta.id` is ignored, so the browser cannot target anything.

				Skipped while Server-Locked — you cannot author into a controlled diagram; fall
				through to a read-only load of the controller's state.
				*/
				const local = this.model.toJSON();
				if (this.pendingSlidesUrl) {
					local.meta.slides = { ...local.meta.slides, url: this.pendingSlidesUrl };
					this.pendingSlidesUrl = null;
				}
				this.expectLoad = true;
				this.net.send('create', { name: local.meta.name, doc: local });
				return;
			}
			this.loading = true;
			this.model.load(doc); // model.load now restores the authoritative selection from doc.selection (R2) — no clear
			this.loading = false;
			const switched = this.hydrated && this.diagramId !== doc.meta.id;
			this.hydrated = true;
			this.expectLoad = false;
			this.diagramId = doc.meta.id;
			// the loaded diagram's lock state is authoritative — drop any pending dwell
			if (this.unlockTimer) { clearTimeout(this.unlockTimer); this.unlockTimer = null; }
			this.locked = !!msg.body.locked;
			if (this.locked) this.lockShownAt = Date.now();
			this.changes.setCounts({ canUndo: msg.body.canUndo, canRedo: msg.body.canRedo, version: msg.body.version });
			if (this.pendingSlidesUrl) {
				// a slides URL typed before hydration must survive the snapshot
				this.model.state.meta.slides.url = this.pendingSlidesUrl;
				this.net.send('meta', { slides: { url: this.pendingSlidesUrl } });
				this.pendingSlidesUrl = null;
			}
			try { localStorage.setItem(LAST_DIAGRAM_KEY, doc.meta.id); } catch { /* private mode */ }
			this.setUrl(doc.meta.id);
			// An outbox belongs to ONE diagram: a deliberate switch abandons it, a reload adopts
			// what the last session left behind. The snapshot does not carry either, so unsent work
			// is re-applied locally as well as re-sent (D30).
			if (switched) { this.outbox = []; this.persistOutbox(); }
			else this.restoreOutbox(doc.meta.id);
			this.replayOutbox({ reapply: true });
			this.emitState({ diagrams: msg.body.diagrams, rewound: msg.body.rewound });
		}
		// `resume` found us in step: no document, just the server's authority. The local model,
		// selection and viewport all stand — and the outbox goes back out.
		if (msg.cmd === 'sync') {
			const b = msg.body || {};
			this.hydrated = true;
			this.locked = !!b.locked;
			this.changes.setCounts({ canUndo: b.canUndo, canRedo: b.canRedo, version: b.version });
			this.replayOutbox({ reapply: false });
			this.emitState({});
			return;
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
			// emitState, not onState: the readout reads meta/status off every state it is handed,
			// so a bare { error } would throw on the way to displaying the error (D28/I16).
			this.emitState({ error: b.message, code: b.code });
		}
	}

	// Re-open the current diagram: the server answers with a snapshot, which is authoritative.
	// Used when this tab knows it has diverged — a rejected optimistic apply, or a change whose
	// `from` is ahead of us (we missed one).
	requestResync() {
		if (!this.hydrated || !this.net.isOpen()) return;
		this.expectLoad = true;
		this.net.send('open', { id: this.model.state.meta.id });
	}

	// A change from another writer. `from` is the version it applied to: equal to ours means we are
	// in step; BELOW ours is a duplicate and is ignored (re-applying would fight the local state);
	// ABOVE ours means we missed one, so ask for the authoritative document.
	applyChange(body) {
		const v = this.changes.state.version;
		if (typeof body.from === 'number') {
			if (body.from < v) return;                       // already applied: ignore, never re-apply
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
			this.outbox = []; // drop any unsent local edits — the controller owns the diagram now
			this.persistOutbox();
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
				// Reconnect. Say what we believe we hold and let the server decide — it answers
				// `sync`, a snapshot, or a snapshot marked `rewound`. The outbox is NOT dropped:
				// what it holds is precisely the work the server has not confirmed durable, and
				// dropping it here is what made the old client-authoritative push necessary.
				this.net.send('resume', {
					diagram: this.model.state.meta.id,
					version: this.changes.state.version
				});
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
		this.persistOutbox();
		this.net.send('open', { id });
	}

	createDiagram() {
		if (!this.net.isOpen() || !this.hydrated) return this.emitState({});
		this.flush();
		this.hydrated = false;
		this.expectLoad = true;
		this.outbox = [];
		this.persistOutbox();
		this.net.send('create', {});
	}

	// destructive and not undoable: the UI arms before calling this
	deleteDiagram() {
		if (!this.net.isOpen() || !this.hydrated) return this.emitState({});
		this.hydrated = false;
		this.expectLoad = true;
		this.outbox = [];
		this.persistOutbox();
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
