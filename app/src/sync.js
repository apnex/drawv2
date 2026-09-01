import { applyOps } from '../../model/ops.mjs';
import * as commands from './commands.js';
import { NAME_MAX } from '../../model/limits.mjs';
import { Clock } from './clock.js';

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

/*
Connect the gesture FSM to the inbound queue — D12, and the fix for B19.

Both halves of the defer rule existed from CS3 and neither was ever connected: `deferInbound` was
read and assigned nowhere, so `deferred` never filled and `releaseDeferred` never ran. That is the
failure shape this codebase keeps producing — designed, written, tested in isolation, never wired —
and a loose property assignment at the composition root is exactly what gets forgotten.

Making it a named function with both directions in one place does two things a pair of assignments
cannot: it can be called by a test, and half of it cannot be written without the other half being
visibly absent.
*/
export function bindGestureDefer(input, sync) {
	sync.deferInbound = () => input.isGesturing();
	input.onGestureEnd = () => sync.releaseDeferred();
	return sync;
}

export class Sync {
	constructor({ model, net, history, selection, onState, clock }) {
		this.model = model;
		this.net = net;
		this.history = history;
		this.changes = history;   // the commit boundary (Changes); named for what it now is
		this.selection = selection;
		this.onState = onState || (() => {});
		/*
		H12.4 -- the shared clock, and the local instant its correction needs.

		`requestSentAt` is stamped when `hello` or `resume` leaves, so the snapshot that answers can
		be corrected for the round trip instead of arriving one hop stale. Sync owns it because Sync
		is what sends those two messages; the Clock itself stays ignorant of the protocol.
		*/
		this.clock = clock || new Clock();   // the root injects one it shares; bare construction still works
		this.requestSentAt = null;
		/*
		B74 -- the last thing the server said, and it SURVIVES the next state emit.

		The defect was not a short timeout. The message was an EVENT payload: `emitState({ error })`
		carried it and the very next `emitState({})` -- from an ack, a change, a lock, a rename, any
		of nine call sites -- carried no `error` key, so the UI had nothing to render and a rejection
		vanished in milliseconds. Holding it as STATE is the fix; it goes out with every emit until
		something replaces it.

		`null` rather than absent, so "nothing said yet" is a value a renderer can test.
		*/
		this.said = null;
		this.hydrated = false;
		/*
		B106 -- the version the MODEL is actually at, which is not the version the UI displays.

		`changes.state.version` is the server's version, set for the undo/redo counter the moment a
		message arrives. applyChange used to read it to answer "have I already applied this?", but
		the change branch advances it to the POST-change value before applying, so `from < version`
		was true for every inbound change and every one was discarded. Live collaboration had never
		once worked in a browser; only a snapshot got through, because it bypasses the check.

		This field moves only when the model's content moves, so it can answer that question.
		*/
		this.appliedVersion = 0;
		/*
		B105 -- what every agent is doing, workspace-wide. State, not events.

		Held here rather than reacted to, because the ruling turns on it: an invitation delivered as
		a toast is lost when nobody is watching, and this must still be there when the operator next
		looks. Arrives with every snapshot and is replaced whole by an `agents` announcement -- never
		merged, because the server sends the entire live set and a merge could only invent an entry
		the server did not report.
		*/
		this.agents = [];
		this.loading = false;
		this.expectLoad = false; // a snapshot we asked for (open/create) always loads
		this.locked = false;     // Server-Locked: a server-side controller owns writes
		// H9.3c: whether this principal may write this diagram at all. Distinct from `locked`:
		// Server-Locked is temporary and reclaimable, this is not reclaimable by definition.
		// Starts true because with authz off the server answers true for everyone.
		this.mayWrite = true;
		// B76: which principal this client IS. Null with authorization off -- honest, because there
		// is no principal then, and inventing one would make a single-tenant run look multi-tenant.
		this.principal = null;
		this.lockShownAt = 0;    // when the amber indicator went up (for the min dwell)
		this.unlockTimer = null; // pending return-to-green after the min dwell
		this.selectionDirty = false; // a selection (model-state) change pending forward to the server (R2)
		this.outbox = [];            // submitted, not yet known durable; persisted (D30)
		this.deferred = [];          // inbound changes held while a gesture is live (D12)
		this.deferredSnapshot = null; // an unsolicited snapshot held the same way (B71)
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
	// H9.3c: the one question every write path asks. Two causes, one answer -- a diagram is
	// unwritable because someone else is driving (locked) or because this principal never had
	// the grant (mayWrite). Callers that suppress a write want the union; callers that render
	// the lock indicator want `locked` alone, because only that one offers a way out.
	get readOnly() {
		return this.locked || !this.mayWrite;
	}

	submit(request) {
		if (this.readOnly) return;                     // read-only: Server-Locked, or no write grant
		if (!this.hydrated) return;
		const txnId = `t${++this.txn}`;
		const msg = request.verb
			? { verb: request.verb, expect: request.expect, to: request.to ?? null, txnId }
			: { ops: request.ops, label: request.label, txnId };
		this.outbox.push(msg);
		this.persistOutbox();
		this.drain();
	}

	// The outbox holds what has been submitted but not yet acknowledged as DURABLE. Pruning on
	// `ack` alone would drop a change the server has accepted but not yet flushed.
	drain() {
		if (!this.net.isOpen() || this.readOnly) return;
		for (const msg of this.outbox) {
			if (msg.sent) continue;
			const ok = msg.verb
				? this.net.send(msg.verb, { expect: msg.expect, ...(msg.to != null ? { to: msg.to } : {}), txnId: msg.txnId })
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
		if (this.loading || !this.hydrated || this.readOnly) return;
		this.selectionDirty = true;
	}

	flush() {
		// while Server-Locked the browser is read-only — never push edits up
		if (this.readOnly) { this.outbox = []; this.persistOutbox(); this.selectionDirty = false; return; }
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
			/*
			B71 -- D12 covers `change` and never covered `snapshot`, which is the branch that actually
			destroys work. `model.load` fires the load handler in `input.js`, which cancels any live
			gesture, and a cancelled link gesture deletes every waypoint the user placed. A lock
			handoff, a resync after a rejection, a reclaim, or a reconnect that is behind all arrive as
			snapshots, so any of them could erase a route mid-draw with no message.

			Only UNSOLICITED snapshots are held. One the user asked for carries `expectLoad` -- opening
			a diagram, creating one -- and a gesture on the diagram they are leaving is moot; holding
			that would make the app feel stuck rather than safe.
			*/
			if (!this.expectLoad && this.deferInbound && this.deferInbound()) {
				// last one wins: a snapshot is whole state, so an older one has nothing left to say
				this.deferredSnapshot = msg;
				return;
			}
			return this.applySnapshot(msg);
		}
		// `resume` found us in step: no document, just the server's authority. The local model,
		// selection and viewport all stand — and the outbox goes back out.
		if (msg.cmd === 'sync') {
			const b = msg.body || {};
			this.hydrated = true;
			this.locked = !!b.locked;
			this.changes.setCounts({ canUndo: b.canUndo, canRedo: b.canRedo, version: b.version,
				undoTop: b.undoTop, truncated: b.truncated, truncatedHuman: b.truncatedHuman });
			this.appliedVersion = b.version || 0;          // `resume` found us in step
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
			// B74 -- the ordinary case has to speak too, or a blank channel means both "fine" and
			// "not listening". A version number is the smallest true thing the server just said.
			this.say(`accepted v${msg.body?.version ?? '?'}`);
			const b = msg.body || {};
			this.changes.setCounts({ canUndo: b.canUndo, canRedo: b.canRedo, version: b.version, undoLabel: b.label,
				undoTop: b.undoTop, truncated: b.truncated, truncatedHuman: b.truncatedHuman, actor: b.actor });
			this.appliedVersion = b.version || 0;          // our own ops are already in the model
			const sent = this.outbox.find((m) => m.txnId === b.acked);
			if (sent) sent.version = b.version;
			this.pruneOutbox(b.durableVersion);
			/*
			B162 / I7 -- the server EXPANDED this transaction, and the expansion must reach us too.

			Our own ops are already in the model, applied optimistically, which is why this used to
			apply the server's list only for undo and redo. But `plan()` now adds ops we never sent:
			a waypoint the transaction orphaned is swept in the same step. Those deletions arrived in
			`b.ops`, were skipped, and the bends stayed on the canvas -- correct on the server, stale
			in the browser, which is precisely the divergence I7 forbids.

			ONLY WHAT WE DID NOT SEND. Re-applying the whole list would replay our own ops on a model
			that may have moved on -- a later local edit clobbered by an older ack. The outbox holds
			exactly what we submitted, so the difference is the server's contribution and nothing
			else.

			Undo and redo still take the whole list: their ops are the server's by definition, and
			nothing of ours is in flight to be overwritten.
			*/
			if (Array.isArray(b.ops)) {
				if (b.label === 'undo' || b.label === 'redo') applyOps(this.model, b.ops);
				else {
					const mine = new Set((sent?.ops || []).map((o) => `${o.op}:${o.kind}:${o.id ?? o.entity?.id}`));
					const added = b.ops.filter((o) => !mine.has(`${o.op}:${o.kind}:${o.id ?? o.entity?.id}`));
					if (added.length) applyOps(this.model, added);
				}
			}
			this.emitState({});
			return;
		}
		// someone else's change. Apply it, unless a gesture is mid-flight — a model.load or a
		// competing write landing under a live drag fights the preview (D12).
		/*
		H9.9 -- the server forked a template under us, and this session now belongs to the fork.

		The first gesture against a template creates a real diagram owned by whoever made it. The
		server rebinds its own side and sends this; without handling it the client kept believing it
		was on the template, so the picker showed the wrong entry, the outbox belonged to a document
		this session no longer wrote to, and a reload went back to the template.

		`resync` rather than a local id swap: the fork is a document this client has never seen, and
		the server's snapshot is the authoritative answer for what it contains. Guessing its content
		from the template plus one applied op is the kind of derivation that drifts.
		*/
		if (msg.cmd === 'forked') {
			this.say('forked a copy -- templates are read-only');
			this.diagramId = msg.body.diagram;
			this.outbox = [];            // it belonged to the template, which we are no longer editing
			this.persistOutbox();
			this.expectLoad = true;
			this.net.send('open', { id: msg.body.diagram });
			return;
		}
		/*
		B94 -- access moved somewhere, so ask again. The signal says nothing else on purpose.

		A grant reached no open session, so a revoked peer kept rendering an editable canvas and a
		granted peer never saw the diagram appear -- the second read as the invitation having failed.

		`requestResync` rather than trusting the message, because the message CANNOT carry the
		answer: `mayWrite` and the visible list are per-principal, and one broadcast body would be
		wrong for somebody. Re-fetching means the server decides what this principal may see, which
		is where that decision belongs and where it already is.

		The reply is a snapshot, which carries both symptoms' cures at once -- the corrected
		`mayWrite` and the corrected diagram list.
		*/
		if (msg.cmd === 'access') {
			this.requestResync();
			return;
		}
		if (msg.cmd === 'agents') {
			this.agents = Array.isArray(msg.body?.agents) ? msg.body.agents : [];
			this.emitState({});
			return;
		}
		if (msg.cmd === 'change') {
			const b = msg.body || {};
			this.changes.setCounts({ canUndo: b.canUndo, canRedo: b.canRedo, version: b.version,
				undoTop: b.undoTop, truncated: b.truncated, truncatedHuman: b.truncatedHuman });
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
				/*
				WRITE THROUGH -- B148, and this was the one mutation that did not.

				`submit`, `pruneOutbox`, the read-only clear and the diagram switch all persist; this
				splice dropped the message from memory and left it in localStorage, so `restoreOutbox`
				pushed it back on the next load. A command the server can NEVER accept therefore
				replayed on every reload: observed live as the same entity id refused twelve times,
				still flickering after the defect that minted it had been fixed and deployed.

				D30 made the outbox durable so unsent work survives a tab close. Durability applied to
				a command that cannot succeed is a trap, and the only place that removes one for good
				was the only place that forgot to say so.
				*/
				this.persistOutbox();
				// The commit was applied LOCALLY before it was submitted — that is what makes a
				// gesture feel instant. A rejection therefore leaves this tab holding a change the
				// server refused, and it will never converge on its own. Ask for authoritative
				// state. (Found by tests/convergence.test.js, not by reasoning about it.)
				this.requestResync();
			}
			console.warn(`[ sync ] server: ${b.message} (${b.code || 'error'})`);
			// emitState, not onState: the readout reads meta/status off every state it is handed,
			// so a bare { error } would throw on the way to displaying the error (D28/I16).
			this.say(b.message, { code: b.code, err: true });
			// `error`/`code` stay in the payload: B28's readout consumer still reads them, and the
			// durable channel is additive rather than a replacement for a working path.
			this.emitState({ error: b.message, code: b.code });
		}
	}

	// Load a snapshot. Split out of `onMessage` so B71's deferral has somewhere to send a held
	// message when the gesture ends, instead of re-entering the handler past its own guard.
	applySnapshot(msg) {
			/*
			H12.4 -- take the server's clock BEFORE anything else in this method can return early.

			A snapshot has several exits below (the B2 fresh-diagram path among them), and the offset
			is wanted on every one of them: whichever way this snapshot is handled, the client has
			just heard from the server and that is the only moment the offset can be learnt.
			*/
			this.clock.seed(msg.body.serverNow, this.requestSentAt);
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
			// H9.3c: fail closed on a missing field, matching the H9.3a convention. A snapshot
			// that forgot to say should present as unwritable rather than silently offer edits
			// the server will refuse -- and a test will notice the former.
			this.mayWrite = msg.body.mayWrite === true;
			this.principal = typeof msg.body.principal === 'string' ? msg.body.principal : null;
			if (this.locked) this.lockShownAt = Date.now();
			this.changes.setCounts({ canUndo: msg.body.canUndo, canRedo: msg.body.canRedo, version: msg.body.version,
				undoTop: msg.body.undoTop, truncated: msg.body.truncated, truncatedHuman: msg.body.truncatedHuman });
			this.appliedVersion = msg.body.version || 0;   // the model IS this document
			if (Array.isArray(msg.body.agents)) this.agents = msg.body.agents;
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
		const v = this.appliedVersion;                       // B106: what the MODEL is at, not the counter
		if (typeof body.from === 'number') {
			if (body.from < v) return;                       // already applied: ignore, never re-apply
			if (body.from > v) return this.requestResync();  // we missed one: repair, do not guess
		}
		if (Array.isArray(body.ops)) applyOps(this.model, body.ops);
		if (typeof body.version === 'number') this.appliedVersion = body.version;
	}

	// replay whatever landed while a gesture was in flight
	releaseDeferred() {
		const pending = this.deferred;
		this.deferred = [];
		/*
		B71 -- a held snapshot supersedes held changes and is applied instead of them.

		A snapshot is whole state, so replaying deltas that predate it would be applying history on
		top of the present. Draining the queue first and then loading would reach the same document
		by a longer route, but only if every queued change is older than the snapshot, and nothing
		available here establishes that. Dropping them is the claim that can be justified.
		*/
		const snap = this.deferredSnapshot;
		this.deferredSnapshot = null;
		if (snap) return this.applySnapshot(snap);
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
				this.requestSentAt = Date.now();   // H12.4 -- for the round-trip correction
				this.net.send('hello', { diagram: this.urlDiagram() || last || undefined });
			} else {
				// Reconnect. Say what we believe we hold and let the server decide — it answers
				// `sync`, a snapshot, or a snapshot marked `rewound`. The outbox is NOT dropped:
				// what it holds is precisely the work the server has not confirmed durable, and
				// dropping it here is what made the old client-authoritative push necessary.
				this.requestSentAt = Date.now();   // H12.4 -- same on reconnect
				this.net.send('resume', {
					diagram: this.model.state.meta.id,
					version: this.changes.state.version
				});
			}
		}
		this.emitState({});
	}

	/*
	Record what the server just told us. `err` distinguishes a refusal from a routine event, which
	is the only thing the surface colours differently.
	*/
	say(text, { code = null, err = false } = {}) {
		this.said = { text, code, err, at: this.clock.now() };
	}

	emitState(extra) {
		this.onState({
			status: this.net.status,
			meta: this.model.state.meta,
			locked: this.locked,
			mayWrite: this.mayWrite,
			principal: this.principal,
			agents: this.agents,
			said: this.said,
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

	/*
	Renaming a diagram and binding a deck are CHANGES — config the user authored — so they go
	through the commit boundary like every other one: applied locally, submitted as a `meta` op,
	broadcast to the other tabs, undoable.

	They used to be a `meta` command of their own. That command's server case was deleted at CS3a
	when meta became an op, and nothing noticed for two milestones: every rename was answered
	`unknown cmd: meta` and dropped. Found by `tests/spec.test.js`, which derives the wire
	vocabulary from the server's own dispatch rather than trusting the document.
	*/
	rename(name) {
		if (this.readOnly) return this.emitState({}); // read-only: revert the field
		const trimmed = name.trim().slice(0, NAME_MAX);
		if (!trimmed || trimmed === this.model.state.meta.name) return this.emitState({});
		this.changes.commit(commands.renameDocument(trimmed));
		this.emitState({});
	}

}
