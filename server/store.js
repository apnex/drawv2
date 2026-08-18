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

// rebuild meta from whitelisted fields only — never persist junk keys
function cleanMeta(id, meta = {}) {
	const slides = (meta.slides && typeof meta.slides === 'object') ? meta.slides : {};
	const str = (v) => typeof v === 'string' ? v.slice(0, 512) : '';
	return {
		id,
		name: String(meta.name || 'untitled').slice(0, 64),
		rev: Number.isFinite(meta.rev) ? meta.rev : 0,
		grid: 'center',
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
				this.install(doc.meta.id, doc, Log.from(log), file);
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

	create(name) {
		const taken = Object.fromEntries([...this.diagrams.keys()].map((k) => [k, true]));
		const id = newId('diagram', taken);
		const model = new Model();
		model.state.meta.id = id;
		if (!name) {
			// scan existing names: map size collides after deletes
			const names = new Set([...this.diagrams.values()].map((e) => e.model.state.meta.name));
			let n = 1;
			while (names.has(`diagram-${n}`)) n++;
			name = `diagram-${n}`;
		}
		model.state.meta.name = name;
		const entry = { model, log: new Log(0), dirty: false, timer: null, file: `${id}.json` };
		this.diagrams.set(id, entry);
		this.markDirty(id);
		return model;
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
			rev: e.model.state.meta.rev
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
	// install a whole validated doc into a live model — the SAVE seam shared by replace() (and, from S1a,
	// the prism.commit save port). Runs only AFTER validation, so a rejected push never clobbers the live diagram.

	// S1b: apply() is the 2nd, LOAD-CONSUMING consumer of prism.commit (replace()'s load was vacuous).
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

	// ADAPTER, dies at CS3 with its caller. Preserves the old single-mutation contract and its
	// error strings so the 183 existing tests are the adapter-fidelity control.
	apply(id, mutation) {
		if (!this.get(id)) return 'unknown diagram';
		const { action, kind, entity } = mutation || {};
		const op = action === 'put' ? { op: 'put', kind, entity }
			: action === 'set' ? { op: 'set', kind, id: entity?.id, patch: entity }
			: action === 'del' ? { op: 'del', kind, id: entity?.id }
			: { op: String(action) };
		const res = this.commit(id, { ops: [op] }, 'server');
		return res.ok ? null : (res.error || 'invalid');
	}

	// S1a: replace() is the FIRST cross-tenant consumer of prism.commit (after the arc engine) — the
	// load -> mutate -> validate -> atomic-save-or-reject transaction, programmed with draw's pure-VALUE
	// ports. mutate returns the migrated doc VALUE (never touches the live model); validate gates it;
	// save installs it ONLY on success — so a malformed push still cannot clobber the live diagram, and
	// the error order (validateDoc then id-check) is preserved. (Shape proof: replace's load is vacuous —
	// the load->mutate dependency is exercised by apply() in S1b.)
	// ADAPTER, dies at CS4 with `push`. Validates the whole document, then installs it — the same
	// reject-writes-nothing order as before (validateDoc, then the id check), by purity: install()
	// is not reached unless both pass. The Log survives the replacement: a whole-document push is
	// not a change and must not destroy the diagram's history.
	replace(id, doc) {
		const entry = this.diagrams.get(id);
		if (!entry) return 'unknown diagram';
		const err = validateDoc(doc);
		if (err) return err;
		if (doc.meta.id !== id) return 'doc.meta.id does not match diagram';
		this.install(id, doc, entry.log, entry.file);
		this.markDirty(id);
		return null;
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
