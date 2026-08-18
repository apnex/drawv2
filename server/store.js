/*
Store — owns every diagram: an in-memory Model per diagram id, persisted to
<dataDir>/<id>.json with a debounced flush (prism's metabolic pulse, repurposed
as a disk-write batcher). The store is the single mutation entry point on the
server; everything is validated before it touches a model.
*/

import fs from 'node:fs';
import path from 'node:path';
import { Model, newId, NODE_EXT, ZONE_EXT } from '../document/index.mjs';
import { seedDoc } from './seed.js';
import { validateMutation, validateDoc, validateMetaPatch, validateSelectionIds } from './validate.js';
import { groupAfterRemoval } from '../engine/index.mjs';
import { commit as txnCommit, undo as txnUndo, redo as txnRedo, plan } from './txn.mjs';
import { Log } from './log.mjs';
import { serialize, parse } from './docfile.mjs';

const FLUSH_MS = 200;

// The document generation. `meta.grid` was accidentally serving this role — a doc without it was
// a pre-center-origin file — and dropping grid without a replacement would leave the format with
// no discriminator at all for the next migration (D8).
export const SCHEMA = 1;

// rebuild meta from whitelisted fields only — never persist junk keys
function cleanMeta(id, meta = {}) {
	const slides = (meta.slides && typeof meta.slides === 'object') ? meta.slides : {};
	const str = (v) => typeof v === 'string' ? v.slice(0, 512) : '';
	return {
		id,
		name: String(meta.name || 'untitled').slice(0, 64),
		version: Number.isInteger(meta.version) && meta.version >= 0 ? meta.version : 0,
		schema: SCHEMA,
		slides: { url: str(slides.url), presentationId: str(slides.presentationId), pageId: str(slides.pageId) }
	};
}




export class Store {
	constructor(dataDir, { flushMs = FLUSH_MS, writeDoc = null, now = Date.now } = {}) {
		this.dir = dataDir;
		this.flushMs = flushMs;
		this.now = now;
		// the single write-to-disk primitive, injectable so a test can fail it or observe it
		this.writeDoc = writeDoc || ((file, text) => {
			const tmp = `${file}.tmp`;
			fs.writeFileSync(tmp, text);
			fs.renameSync(tmp, file);
		});
		this.diagrams = new Map(); // id -> { model, log, dirty, timer, file }
	}

	init() {
		fs.mkdirSync(this.dir, { recursive: true });
		let candidates = 0;
		const failures = [];
		// the data dir is shared with Google OAuth credential/token files:
		// only diagram-named json is ours to parse
		for (const file of fs.readdirSync(this.dir)) {
			if (!/^diagram-[0-9a-f]{6}\.json$/.test(file)) continue;
			candidates++;
			try {
				const { doc, log } = parse(fs.readFileSync(path.join(this.dir, file), 'utf8'));
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
		const doc = seedDoc();
		const entry = this.install(doc.meta.id, doc);
		this.markDirty(doc.meta.id);   // a seeded doc has no file yet — this is a creation, not a reload
		return entry.model;
	}

	// The ONE whole-document entry: boot and create-with-content. Not a commit — it installs a
	// document wholesale rather than deriving it from ops, so it is the single allow-listed
	// model.load caller (GR3) and it replaces the Log in the same call.
	install(id, doc, log = new Log(0), file = null) {
		const model = new Model();
		model.load(doc);
		model.state.meta = cleanMeta(id, doc.meta);
		const entry = { model, log, dirty: false, timer: null, file: file || `${id}.json` };
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
			const entry = this.install(id, candidate);
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

	list() {
		return [...this.diagrams.values()].map((e) => ({
			id: e.model.state.meta.id,
			name: e.model.state.meta.name,
			version: e.model.state.meta.version
		}));
	}

	remove(id) {
		const entry = this.diagrams.get(id);
		if (!entry) return 'unknown diagram';
		if (entry.timer) {
			clearTimeout(entry.timer);
			entry.timer = null;
		}
		this.diagrams.delete(id);
		try {
			fs.rmSync(path.join(this.dir, entry.file), { force: true });
			fs.rmSync(path.join(this.dir, `${id}.json`), { force: true });
			fs.rmSync(path.join(this.dir, `${id}.json.tmp`), { force: true });
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
		entry.timer = setTimeout(() => {
			entry.timer = null;
			this.flush(id);
		}, this.flushMs);
		if (entry.timer.unref) entry.timer.unref();
	}

	flush(id) {
		const entry = this.diagrams.get(id);
		if (!entry || !entry.dirty) return;
		const file = path.join(this.dir, `${id}.json`);
		entry.file = `${id}.json`; // canonical from first flush onward
		const tmp = `${file}.tmp`;
		try {
			this.writeDoc(file, serialize(entry.model.toJSON(), entry.log));
			entry.dirty = false; // only after the write actually landed
			// GR9: the ring never holds a seq above the watermark that describes it
			if (!entry.log.records.every((r) => r.seq <= entry.log.version)) {
				throw new Error(`log invariant: a record seq exceeds version ${entry.log.version}`);
			}
		} catch (err) {
			// B4: the entry is still dirty but markDirty already nulled the timer, so without an
			// explicit reschedule recovery waits for the next edit or SIGTERM. Retry, and COUNT —
			// a retry that repairs the mechanism silently leaves the failure unobservable.
			entry.flushFailures = (entry.flushFailures || 0) + 1;
			console.error(`[ store ] flush failed for ${id} (${entry.flushFailures}): ${err.message}`);
			if (!entry.timer) {
				entry.timer = setTimeout(() => { entry.timer = null; this.flush(id); }, this.flushMs);
				if (entry.timer.unref) entry.timer.unref();
			}
		}
	}

	flushAll() {
		for (const id of this.diagrams.keys()) {
			const entry = this.diagrams.get(id);
			if (entry.timer) { clearTimeout(entry.timer); entry.timer = null; }
			this.flush(id);
		}
	}
}
