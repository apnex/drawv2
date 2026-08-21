/*
Store — owns every diagram: an in-memory Model per diagram id, persisted to
<dataDir>/<id>.json with a debounced flush (prism's metabolic pulse, repurposed
as a disk-write batcher). The store is the single mutation entry point on the
server; everything is validated before it touches a model.
*/

import fs from 'node:fs';
import path from 'node:path';
import { Model, newId, NODE_EXT, ZONE_EXT } from '../model/index.mjs';
import { seedDoc } from './seed.js';
import { validateMutation, validateDoc, validateMetaPatch, validateSelectionIds } from './validate.js';
import { groupAfterRemoval } from '../engine/index.mjs';
import { commit as txnCommit, undo as txnUndo, redo as txnRedo, plan } from './txn.mjs';
import { Log } from './log.mjs';
import { serialize, parse } from './docfile.mjs';
import { fsFiles } from './files.mjs';

const FLUSH_MS = 200;

// The store's own filename rule. ONE definition: the boot loader and the example seeder must agree
// on what counts as a diagram file, or a name one accepts and the other ignores becomes a file that
// exists but is never loaded. tools/migrate-version.mjs deliberately re-states it rather than
// importing it — a migration must select by the rule as it was, not as it may later become.
const FILE = /^diagram-[0-9a-f]{6}\.json$/;

// The document generation. `meta.grid` was accidentally serving this role — a doc without it was
// a pre-center-origin file — and dropping grid without a replacement would leave the format with
// no discriminator at all for the next migration (D8).
export const SCHEMA = 1;

// rebuild meta from whitelisted fields only — never persist junk keys
/*
Rebuild meta from an allowlist, so an unknown or hostile key cannot ride in on a document.

`trusted` says the document came off our own storage rather than off the wire, and it gates
authorization only. Without it, `create {doc:{meta:{owner:...}}}` would let a caller install
itself as owner of the diagram it is creating -- the keys validate, so nothing else would stop
it. Owner and grants are established by `setOwner` and `grant`, never by presenting a document
that claims them (ACCESS.md).
*/
function cleanMeta(id, meta = {}, trusted = false) {
	const slides = (meta.slides && typeof meta.slides === 'object') ? meta.slides : {};
	const str = (v) => typeof v === 'string' ? v.slice(0, 512) : '';
	const grants = {};
	if (trusted && meta.grants && typeof meta.grants === 'object' && !Array.isArray(meta.grants)) {
		for (const [principal, level] of Object.entries(meta.grants)) {
			if (level === 'read' || level === 'write') grants[str(principal)] = level;
		}
	}
	return {
		id,
		name: String(meta.name || 'untitled').slice(0, 64),
		version: Number.isInteger(meta.version) && meta.version >= 0 ? meta.version : 0,
		schema: SCHEMA,
		owner: trusted ? str(meta.owner) : '',
		grants,
		slides: { url: str(slides.url), presentationId: str(slides.presentationId), pageId: str(slides.pageId) }
	};
}




export class Store {
	/*
	`examplesDir` is INJECTED, never discovered. A store that went looking for a sibling directory
	would seed differently depending on where it was constructed from, which is the kind of
	implicit dependency that makes a test pass for a reason nobody chose. The composition root
	(server/server.js) decides; every other caller — including every test that is not about seeding
	— gets the single programmatic example and is unaffected by whatever ships in examples/.
	*/
	constructor(dataDir, { flushMs = FLUSH_MS, files = null, now = Date.now, examplesDir = null, authz = false } = {}) {
		/*
		Authorization is OFF unless asked for -- ACCESS.md.

		Filtering by grant is meaningless without an identity, and there is no identity unless IAP
		is configured, so a store that enforced unconditionally would make every local run empty.
		The dangerous combination is production WITHOUT it, and that is refused at boot in
		`server.js` rather than defaulted to here: a silent fallback to open is precisely the
		failure this whole milestone exists to prevent.
		*/
		this.authz = authz;
		this.dir = dataDir;
		this.flushMs = flushMs;
		this.now = now;
		this.examplesDir = examplesDir;
		// B55 -- the WHOLE persistence surface, injectable. Was `writeDoc` alone, which left boot's
		// list and read, and delete's three removals, reaching `fs` directly: a backend that is not
		// a filesystem could not be supplied at all. Four verbs over names, never paths.
		this.files = files || fsFiles(dataDir);
		this.diagrams = new Map(); // id -> { model, log, dirty, timer, file }
	}

	async init() {
		let candidates = 0;   // the backend created its own storage when it was constructed
		const failures = [];
		// the data dir is shared with Google OAuth credential/token files:
		// only diagram-named json is ours to parse
		for (const file of await this.files.list()) {
			if (!FILE.test(file)) continue;
			candidates++;
			try {
				const { doc, log } = parse(await this.files.read(file));
				const err = validateDoc(doc);
				if (err) {
					failures.push(`${file}: ${err}`);
					console.warn(`[ store ] skipping ${file}: ${err}`);
					continue;
				}
				if (this.diagrams.has(doc.meta.id)) {
					failures.push(`${file}: duplicate id ${doc.meta.id}`);
					console.warn(`[ store ] skipping ${file}: duplicate id ${doc.meta.id}`);
					continue;
				}
				if (file !== `${doc.meta.id}.json`) {
					console.warn(`[ store ] ${file}: filename does not match meta.id ${doc.meta.id}`);
				}
				// the doc's own version is the fallback: a file whose log block is absent or
				// unreadable still knows which version it is (CS5 stamps it into meta).
				this.install(doc.meta.id, doc, Log.from(log, doc.meta.version), file);
				// only the filename-canonicalisation case dirties on boot; a clean load rewrites nothing
				if (file !== `${doc.meta.id}.json`) this.markDirty(doc.meta.id);
			} catch (e) {
				failures.push(`${file}: ${e.message}`);
				console.warn(`[ store ] skipping ${file}: ${e.message}`);
			}
		}
		// D17/GR8: a data dir whose every candidate file failed is a broken deployment, not an empty
		// one. Seeding there fabricates a plausible, complete, WRONG store and answers /health 200.
		if (candidates > 0 && this.diagrams.size === 0) {
			for (const why of failures) console.error(`[ store ] ${why}`);
			throw new Error(`refusing to boot: ${candidates} diagram file(s) present, none loaded`);
		}
		if (this.diagrams.size === 0) this.seed();
		console.log(`[ store ] ${this.diagrams.size} diagram(s) in ${this.dir}`);
	}

	// first boot (or last diagram deleted): the example topology, never an empty store
	seed() {
		const fromExamples = this.#seedFromExamples();
		if (fromExamples) return fromExamples;
		const doc = seedDoc();
		const entry = this.install(doc.meta.id, doc);
		this.markDirty(doc.meta.id);   // a seeded doc has no file yet — this is a creation, not a reload
		return entry.model;
	}

	/*
	First boot with a corpus: copy examples/ into the data dir.

	The examples are tracked in git; the data dir is not (`.gitignore:4`), because the store
	REWRITES these files on every edit and a runtime directory under version control shows a diff
	every time anyone uses the app. On Cloud Run the data dir will be a mounted bucket, so the two
	were always different things — this only names the difference.

	TOLERATE-AND-DROP, and deliberately weaker than `init`'s rule: a malformed example is skipped
	with a warning rather than refusing the boot. `init` throws because a file it cannot read is
	the USER's data and losing it silently is unacceptable; an example is shipped content, and a
	bad one is a packaging bug that must not stop a first-time user from getting a working app.
	If NONE load, this returns null and the programmatic seed takes over — the store still never
	comes up empty.
	*/
	#seedFromExamples() {
		if (!this.examplesDir || !fs.existsSync(this.examplesDir)) return null;
		let first = null;
		for (const file of fs.readdirSync(this.examplesDir).filter((f) => FILE.test(f)).sort()) {
			try {
				const { doc } = parse(fs.readFileSync(path.join(this.examplesDir, file), 'utf8'));
				const err = validateDoc(doc);
				if (err) { console.warn(`[ store ] skipping example ${file}: ${err}`); continue; }
				if (this.diagrams.has(doc.meta.id)) continue;
				const entry = this.install(doc.meta.id, doc);
				this.markDirty(doc.meta.id);          // no file in the DATA dir yet — this is a creation
				first = first || entry.model;
			} catch (e) {
				console.warn(`[ store ] skipping example ${file}: ${e.message}`);
			}
		}
		if (first) console.log(`[ store ] seeded ${this.diagrams.size} example diagram(s) from ${this.examplesDir}`);
		return first;
	}

	// The ONE whole-document entry: boot and create-with-content. Not a commit — it installs a
	// document wholesale rather than deriving it from ops, so it is the single allow-listed
	// model.load caller (GR3) and it replaces the Log in the same call.
	install(id, doc, log = new Log(0), file = null) {
		const model = new Model();
		model.load(doc);
		// `file` means this document came off our own storage, which is the only source allowed to
		// carry authorization -- init() passes it, create() does not (ACCESS.md).
		model.state.meta = cleanMeta(id, doc.meta, Boolean(file));
		// B15 — a diagram READ FROM a file is durable at the version that file carries; one being
		// created has nothing on disk yet and is durable at nothing. `file` is the discriminator:
		// init() passes the filename it loaded, create() does not.
		const entry = { model, log, dirty: false, timer: null, file: file || `${id}.json`,
			flushedVersion: file ? log.version : 0 };
		this.diagrams.set(id, entry);
		return entry;
	}

	// Create a diagram, optionally WITH content. The content path is what a client uses when it
	// has drawn something before the server answered: `create {name, doc}`. The id is minted here
	// and `doc.meta.id` is ignored (I11) — a client cannot name, and therefore cannot target, an
	// existing diagram. That targeting was B2. Returns { ok, model } | { ok:false, error }.
	create(name, doc = null) {
		const taken = Object.fromEntries([...this.diagrams.keys()].map((k) => [k, true]));
		const id = newId('diagram', taken);
		if (!name) {
			// scan existing names: map size collides after deletes
			const names = new Set([...this.diagrams.values()].map((e) => e.model.state.meta.name));
			let n = 1;
			while (names.has(`diagram-${n}`)) n++;
			name = `diagram-${n}`;
		}
		if (doc !== null) {
			if (typeof doc !== 'object' || Array.isArray(doc)) return { ok: false, error: 'doc is not an object' };
			// Validate the document as it will be INSTALLED, not as it arrived: the minted id and
			// the server-side name are substituted first, so validation cannot pass on a value the
			// store then discards. Nothing is installed unless it passes (I1, by purity).
			const candidate = { ...doc, meta: { ...doc.meta, id, name } };
			const err = validateDoc(candidate);
			if (err) return { ok: false, error: err };
			/*
			B25 — version is minted by the LOG and is never carried in from the wire.

			Validated AS IT ARRIVED, then installed at 0. The order is the point: a MALFORMED version
			must still be rejected at the boundary (D17 — a document that cannot be told apart from a
			valid one is refused, never repaired silently), while a well-formed but client-chosen one
			is simply ignored (I11). Forcing 0 before validation would have collapsed those two into
			"silently accept anything", which is how a trust boundary stops being one.

			Without this, `create {doc:{meta:{version:999}}}` installed a model claiming 999 against a
			fresh Log at 0 — two different numbers for one document until the first commit re-stamped
			it, breaking D6's one-source-one-mirror contract.
			*/
			const entry = this.install(id, { ...candidate, meta: { ...candidate.meta, version: 0 } });
			this.markDirty(id);
			return { ok: true, model: entry.model };
		}
		const model = new Model();
		model.state.meta.id = id;
		model.state.meta.name = name;
		const entry = { model, log: new Log(0), dirty: false, timer: null, file: `${id}.json` };
		this.diagrams.set(id, entry);
		this.markDirty(id);
		return { ok: true, model };
	}

	get(id) {
		const entry = this.diagrams.get(id);
		return entry ? entry.model : null;
	}

	first() {
		const entry = this.diagrams.values().next().value;
		return entry ? entry.model : null;
	}

	/*
	The diagrams a principal may see, which with authorization off is all of them.

	Filtering here rather than at each call site is deliberate: `list` is the surface that tells a
	caller what exists, so a missed filter does not leak a document's contents but does leak that it
	exists and what it is called. One place to be right.
	*/
	list(principal = null) {
		const visible = this.authz
			? [...this.diagrams.values()].filter((e) => this.access(e.model.state.meta.id, principal))
			: [...this.diagrams.values()];
		return visible.map((e) => ({
			id: e.model.state.meta.id,
			name: e.model.state.meta.name,
			version: e.model.state.meta.version
		}));
	}

	async remove(id) {
		const entry = this.diagrams.get(id);
		if (!entry) return 'unknown diagram';
		if (entry.timer) {
			clearTimeout(entry.timer);
			entry.timer = null;
		}
		this.diagrams.delete(id);
		try {
			// the backend owns the temp artefact of its own write strategy, so this no longer
			// names a `.json.tmp` -- that was filesystem shape leaking into the caller (B55)
			await this.files.remove(entry.file);
			await this.files.remove(`${id}.json`);
		} catch (err) {
			console.warn(`[ store ] could not remove ${id}.json: ${err.message}`);
		}
		if (this.diagrams.size === 0) this.seed(); // the store never goes empty
		return null;
	}

	// ---- mutations (validated) ----
	// THE ONE WRITE. Every writer reaches the model through here.
	commit(id, request, by = 'client', actor = null) {
		const entry = this.diagrams.get(id);
		if (!entry) return { ok: false, error: 'unknown diagram' };
		const res = txnCommit(entry.model, entry.log, request, by, actor);
		if (res.ok && res.change) this.markDirty(id);
		return res;
	}

	undo(id, to = null) {
		const entry = this.diagrams.get(id);
		if (!entry) return { ok: false, error: 'unknown diagram' };
		const res = txnUndo(entry.model, entry.log, to);
		if (res.ok) this.markDirty(id);
		return res;
	}

	redo(id) {
		const entry = this.diagrams.get(id);
		if (!entry) return { ok: false, error: 'unknown diagram' };
		const res = txnRedo(entry.model, entry.log);
		if (res.ok) this.markDirty(id);
		return res;
	}

	patchMeta(id, patch) {
		const model = this.get(id);
		if (!model) return 'unknown diagram';
		const err = validateMetaPatch(patch);
		if (err) return err;
		if (patch.name) model.state.meta.name = patch.name.trim();
		if (patch.slides) Object.assign(model.state.meta.slides, patch.slides);
		this.markDirty(id);
		return null;
	}

	// model-state (status): set the authoritative selection (shape-validated; the Model expands-to-group,
	// reconciles-to-live, and admits only selectable kinds). The debounced flush persists it. (R2)
	setSelection(id, ids) {
		const model = this.get(id);
		if (!model) return 'unknown diagram';
		const err = validateSelectionIds(ids);
		if (err) return err;
		model.setSelection(ids);
		this.markDirty(id);
		return null;
	}

	/*
	The Slides binding: which deck and which slide this diagram's last successful push landed on.

	STATUS, not config — the server performed the push, so the server records where it went, and
	it is not a Change: it carries no user intent, must not be undoable, and must not bump the
	version. `slides.url` (what the user pasted) IS config and travels as a `meta` op; these two
	do not.

	It had no writer at all between CS3a and CS5 — `case 'meta'` was deleted when meta became an
	op, and the browser's `meta {slides:{presentationId,pageId}}` message was silently refused as
	an unknown cmd. A binding that never persists re-targets `pages[0]` on the next push after a
	restart, which is a wrong-slide overwrite, not a missing feature.
	*/
	bindSlides(id, presentationId, pageId) {
		const model = this.get(id);
		if (!model) return 'unknown diagram';
		const str = (v) => (typeof v === 'string' ? v.slice(0, 512) : '');
		Object.assign(model.state.meta.slides, { presentationId: str(presentationId), pageId: str(pageId) });
		this.markDirty(id);
		return null;
	}

	// ---- persistence ----
	// total flush failures across all diagrams — surfaced by GET /health and `draw status` so a
	// backend that is silently failing to persist is visible before the next restart loses work.
	/*
	Authorization -- ACCESS.md. Owner and grants, written the way `bindSlides` writes.

	These deliberately bypass `commit()`, and the reason is sharper than consistency with the
	Slides binding. `flush()` serializes the document AND the log, so a grant routed through a
	commit would be undoable -- and undo silently restoring access for a principal just revoked is
	a security failure rather than a usability quirk. Bypassing the transaction avoids it by
	construction instead of by a rule someone has to keep remembering.

	`access(id, principal)` is the single check every caller should ask, so the rule has one home.
	It is used here to gate granting itself: only an owner may change who else may reach a diagram.
	*/
	access(id, principal) {
		const model = this.get(id);
		if (!model || !principal) return null;
		const meta = model.state.meta;
		if (meta.owner && meta.owner === principal) return 'owner';
		const level = meta.grants?.[principal];
		return level === 'read' || level === 'write' ? level : null;
	}

	/*
	Claim every unowned diagram for a principal -- H9.10.

	The eleven diagrams already in the bucket predate ownership, so under a grant filter they would
	belong to nobody and be visible to nobody. Adoption is explicit and one-shot rather than a rule
	that unowned means public, because "visible to whoever asks" is not a default anyone should get
	by accident. Idempotent, since `setOwner` refuses a diagram that already has an owner.
	*/
	adopt(principal) {
		let claimed = 0;
		for (const id of this.diagrams.keys()) {
			if (this.setOwner(id, principal) === null) claimed++;
		}
		return claimed;
	}

	// an unowned diagram is claimable; an owned one is not, so ownership cannot be taken by asking
	setOwner(id, principal) {
		const model = this.get(id);
		if (!model) return 'unknown diagram';
		if (model.state.meta.owner) return 'already owned';
		model.state.meta.owner = principal;
		this.markDirty(id);
		return null;
	}

	grant(id, principal, level, by) {
		const model = this.get(id);
		if (!model) return 'unknown diagram';
		if (this.access(id, by) !== 'owner') return 'only the owner may grant';
		if (level !== 'read' && level !== 'write') return `invalid level: ${level}`;
		if (principal === model.state.meta.owner) return 'the owner already has full access';
		model.state.meta.grants = { ...model.state.meta.grants, [principal]: level };
		this.markDirty(id);
		return null;
	}

	revoke(id, principal, by) {
		const model = this.get(id);
		if (!model) return 'unknown diagram';
		if (this.access(id, by) !== 'owner') return 'only the owner may revoke';
		// absent is success: revoking twice must not be an error, or a retry becomes a failure
		const grants = { ...model.state.meta.grants };
		delete grants[principal];
		model.state.meta.grants = grants;
		this.markDirty(id);
		return null;
	}

	flushFailures() {
		let n = 0;
		for (const entry of this.diagrams.values()) n += entry.flushFailures || 0;
		return n;
	}

	markDirty(id) {
		const entry = this.diagrams.get(id);
		if (!entry) return;
		entry.dirty = true;
		if (entry.timer) return;
		// B59 -- flush() is async now, and this caller cannot await it: it is a timer, not a
		// request. An unhandled rejection here would reach server.js's last-resort net and be
		// reported as anonymous, so the catch is explicit and names the diagram it lost.
		entry.timer = setTimeout(() => {
			entry.timer = null;
			this.flush(id).catch((err) => console.error(`[ store ] background flush failed for ${id}: ${err.message}`));
		}, this.flushMs);
		if (entry.timer.unref) entry.timer.unref();
	}

	async flush(id) {
		const entry = this.diagrams.get(id);
		if (!entry || !entry.dirty) return;
		entry.file = `${id}.json`; // canonical from first flush onward
		try {
			await this.files.write(entry.file, serialize(entry.model.toJSON(), entry.log));
			entry.dirty = false; // only after the write actually landed
			// B15 — and so is the watermark. This is the ONLY place a version becomes durable, so
			// it is recorded here, from the log that was actually just written, rather than guessed
			// downstream from `dirty`.
			entry.flushedVersion = entry.log.version;
		} catch (err) {
			// B4: the entry is still dirty but markDirty already nulled the timer, so without an
			// explicit reschedule recovery waits for the next edit or SIGTERM. Retry, and COUNT —
			// a retry that repairs the mechanism silently leaves the failure unobservable.
			entry.flushFailures = (entry.flushFailures || 0) + 1;
			console.error(`[ store ] flush failed for ${id} (${entry.flushFailures}): ${err.message}`);
			if (!entry.timer) {
				entry.timer = setTimeout(() => { entry.timer = null; this.flush(id).catch((e) => console.error(`[ store ] retry flush failed for ${id}: ${e.message}`)); }, this.flushMs);
				if (entry.timer.unref) entry.timer.unref();
			}
		}

		/*
		GR9, checked OUTSIDE the write's try/catch — B20.

		The ring must never hold a seq above the watermark that describes it. This used to sit
		inside the try, so a breach took B4's recovery path: counted as `flushFailures`, logged as
		"flush failed", retried by a reschedule that returned immediately at the `!entry.dirty`
		guard above. A structural breach was therefore reported once, under the wrong name, and
		never re-checked — while `/health` stayed `degraded` forever on a counter that only rises.

		It is deliberately NOT a throw and NOT a refusal to write. The breach is in the log's
		accounting, not in the user's document, and refusing to persist would trade real work for
		a bookkeeping bug (I15 cuts the other way here: fabricating success is the sin, losing data
		to a counter is not the remedy). So: write the document, then report the breach as itself —
		its own counter, its own `/health` signal, its own greppable message, and re-checked on
		every subsequent write for as long as it is true.
		*/
		if (!entry.log.records.every((r) => r.seq <= entry.log.version)) {
			entry.invariantFailures = (entry.invariantFailures || 0) + 1;
			const bad = entry.log.records.filter((r) => r.seq > entry.log.version).map((r) => r.seq);
			console.error(`[ store ] GR9 log invariant breached for ${id} (${entry.invariantFailures}): seq ${bad.join(',')} exceeds version ${entry.log.version}`);
		}
	}

	/*
	The log for a diagram, and the version of it that is actually on disk — B15 / A3 `Air-Gap`.

	These exist because ten sites outside this class reached into `store.diagrams.get(id)` to read
	`.log` and `.dirty` directly, and then each re-derived the durability rule for itself. It was
	spelled three different ways at three sites — only one of which null-guarded — which is exactly
	why it was wrong in more than one place at once. A rule with no home gets re-remembered.

	`durableVersion` is the watermark `flush()` recorded, never a guess from `dirty`. `dirty` answers
	"is anything unwritten?"; the wire needs "how far can the client prune its outbox?" (D30), and
	`version - 1` answers that only when exactly one commit is outstanding.
	*/
	log(id) {
		return this.diagrams.get(id)?.log;
	}

	durableVersion(id) {
		const entry = this.diagrams.get(id);
		if (!entry) return 0;
		return entry.flushedVersion ?? 0;
	}

	// total GR9 invariant breaches across all diagrams — surfaced by GET /health SEPARATELY from
	// flushFailures. A breach means the log mis-minted a seq; a flush failure means the disk said no.
	// One is a bug in this process, the other is the environment: same symptom, opposite remedies.
	invariantFailures() {
		let n = 0;
		for (const entry of this.diagrams.values()) n += entry.invariantFailures || 0;
		return n;
	}

	async flushAll() {
		for (const id of this.diagrams.keys()) {
			const entry = this.diagrams.get(id);
			if (entry.timer) { clearTimeout(entry.timer); entry.timer = null; }
			await this.flush(id);
		}
	}
}
