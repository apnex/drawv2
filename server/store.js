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
import { commit } from './commit.mjs';

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

/*
Legacy migration: docs written before the center-origin grid used top-left
coordinates (node points at 30 + k*60). A uniform translation of (-930, -510)
maps every legacy node-grid point exactly onto the new center grid (and zone
corners onto the zone grid), preserving relative layout; only entities in the
outermost right/bottom band clamp inward one cell.
*/
function migrateLegacy(doc) {
	if (doc.meta && doc.meta.grid === 'center') return doc;
	// NOTE: 930/510 here are the legacy top-left->center OFFSET (= hw-HALF), NOT the usable extent —
	// numerically equal to ZONE_EXT today but semantically distinct, so they stay literal (do not alias).
	const cx = (v) => v - 930;
	const cy = (v) => v - 510;
	const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
	(doc.nodes || []).forEach((n) => {
		n.x = clamp(cx(n.x), -NODE_EXT.x, NODE_EXT.x);
		n.y = clamp(cy(n.y), -NODE_EXT.y, NODE_EXT.y);
	});
	(doc.zones || []).forEach((z) => {
		z.x = clamp(cx(z.x), -ZONE_EXT.x, ZONE_EXT.x);
		z.y = clamp(cy(z.y), -ZONE_EXT.y, ZONE_EXT.y);
		if (z.x + z.w > ZONE_EXT.x) z.w = Math.max(60, ZONE_EXT.x - z.x);
		if (z.y + z.h > ZONE_EXT.y) z.h = Math.max(60, ZONE_EXT.y - z.y);
	});
	doc.meta = { ...(doc.meta || {}), grid: 'center' };
	console.log(`[ store ] migrated ${doc.meta.id} to the center-origin grid`);
	return doc;
}

// S1b: the mutation PLANNER — pure (reads the model, applies NOTHING). Runs the validateMutation gate,
// then computes the ordered op-list for the mutation + its server-side cascade (idempotent with the
// client's explicit cascade deltas). {ok:false,error} rejects BEFORE any write, so apply()-via-commit
// keeps the reject-writes-nothing guarantee without a rollback (atomicity by purity). load-consuming —
// this is what makes apply() a genuine 2nd consumer of prism.commit's load->mutate->validate->save.
function planMutation(model, mutation) {
	const err = validateMutation(model, mutation);
	if (err) return { ok: false, error: err };
	const { action, kind, entity } = mutation;
	const ops = [];
	const trimGroupsHolding = (memberId) => model.all('group').forEach((group) => {
		if (!group.members.includes(memberId)) return;
		const { remaining, dissolve } = groupAfterRemoval(group.members, (m) => m === memberId);
		if (dissolve) ops.push({ action: 'del', kind: 'group', id: group.id });
		else ops.push({ action: 'set', kind: 'group', id: group.id, patch: { members: remaining } });
	});
	if (action === 'put') {
		if (!model.get(kind, entity.id) && model.all(kind).length >= 2000) return { ok: false, error: `${kind} collection limit reached` };
		ops.push({ action: 'put', kind, entity: { ...entity, ...(entity.members ? { members: [...entity.members] } : {}) } });
	}
	if (action === 'set') {
		if (!model.get(kind, entity.id)) return { ok: false, error: `set on missing entity: ${entity.id}` };
		ops.push({ action: 'set', kind, id: entity.id, patch: { ...entity } });
	}
	if (action === 'del') {
		if (kind === 'node') {
			model.linksOf(entity.id).forEach((link) => ops.push({ action: 'del', kind: 'link', id: link.id }));
			trimGroupsHolding(entity.id);
		}
		if (kind === 'waypoint') {
			model.linksAt(entity.id).forEach((link) => {
				if (link.src === entity.id || link.dst === entity.id) ops.push({ action: 'del', kind: 'link', id: link.id });
				else ops.push({ action: 'set', kind: 'link', id: link.id, patch: { via: link.via.filter((w) => w !== entity.id) } });
			});
			trimGroupsHolding(entity.id);
		}
		ops.push({ action: 'del', kind, id: entity.id });
	}
	return { ok: true, ops };
}

// the SAVE seam: apply a planned op-list in order (the only write; each op emits -> onChange -> markDirty).
function applyOps(model, ops) {
	for (const op of ops) {
		if (op.action === 'put') model.put(op.kind, op.entity);
		else if (op.action === 'set') model.set(op.kind, op.id, op.patch);
		else if (op.action === 'del') model.del(op.kind, op.id);
	}
}

export class Store {
	constructor(dataDir) {
		this.dir = dataDir;
		this.diagrams = new Map(); // id -> { model, dirty, timer }
	}

	init() {
		fs.mkdirSync(this.dir, { recursive: true });
		// the data dir is shared with Google OAuth credential/token files:
		// only diagram-named json is ours to parse
		for (const file of fs.readdirSync(this.dir)) {
			if (!/^diagram-[0-9a-f]{6}\.json$/.test(file)) continue;
			try {
				const doc = migrateLegacy(JSON.parse(fs.readFileSync(path.join(this.dir, file), 'utf8')));
				const err = validateDoc(doc);
				if (err) {
					console.warn(`[ store ] skipping ${file}: ${err}`);
					continue;
				}
				if (this.diagrams.has(doc.meta.id)) {
					console.warn(`[ store ] skipping ${file}: duplicate id ${doc.meta.id}`);
					continue;
				}
				if (file !== `${doc.meta.id}.json`) {
					console.warn(`[ store ] ${file}: filename does not match meta.id ${doc.meta.id}`);
				}
				this.adopt(doc, file);
				this.markDirty(doc.meta.id);
			} catch (e) {
				console.warn(`[ store ] skipping ${file}: ${e.message}`);
			}
		}
		if (this.diagrams.size === 0) this.seed();
		console.log(`[ store ] ${this.diagrams.size} diagram(s) in ${this.dir}`);
	}

	// first boot (or last diagram deleted): the example topology, never an empty store
	seed() {
		const doc = seedDoc();
		const entry = this.adopt(doc);
		this.markDirty(doc.meta.id);
		return entry.model;
	}

	adopt(doc, file = null) {
		const model = new Model();
		model.load(doc);
		// disk docs get the same meta sanitation as pushed docs
		model.state.meta = cleanMeta(doc.meta.id, doc.meta);
		const entry = { model, dirty: false, timer: null, file: file || `${doc.meta.id}.json` };
		model.onChange(() => this.markDirty(doc.meta.id));
		this.diagrams.set(doc.meta.id, entry);
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
		const entry = { model, dirty: false, timer: null, file: `${id}.json` };
		model.onChange(() => this.markDirty(id));
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
	loadInto(model, id, doc) {
		model.load(doc);
		model.state.meta = cleanMeta(id, doc.meta);
		this.markDirty(id);
	}

	// S1b: apply() is the 2nd, LOAD-CONSUMING consumer of prism.commit (replace()'s load was vacuous).
	// mutate = planMutation (reads the model — gate + cascade — applies nothing); validate = the additive
	// slot, deliberately LIGHT (validateMutation is the gate; per-mutation validateDoc benchmarked at
	// ~2900x the incremental gate, so the O(N) whole-doc check stays at the replace/load boundary, never
	// the per-drag path); save = applyOps (the only write; emits drive markDirty). A rejected plan never
	// reaches save, so the live model is untouched — reject-writes-nothing, by purity, no rollback needed.
	apply(id, mutation) {
		const model = this.get(id);
		if (!model) return 'unknown diagram';
		const res = commit({
			load: () => model,
			validate: () => [],
			save: ({ model: m, ops }) => applyOps(m, ops),
		}, (m) => {
			const plan = planMutation(m, mutation);
			return plan.ok ? { ok: true, store: { model: m, ops: plan.ops } } : { ok: false, error: plan.error };
		});
		return res.ok ? null : (res.error || res.violations?.[0] || 'invalid');
	}

	// S1a: replace() is the FIRST cross-tenant consumer of prism.commit (after the arc engine) — the
	// load -> mutate -> validate -> atomic-save-or-reject transaction, programmed with draw's pure-VALUE
	// ports. mutate returns the migrated doc VALUE (never touches the live model); validate gates it;
	// save installs it ONLY on success — so a malformed push still cannot clobber the live diagram, and
	// the error order (validateDoc then id-check) is preserved. (Shape proof: replace's load is vacuous —
	// the load->mutate dependency is exercised by apply() in S1b.)
	replace(id, doc) {
		const model = this.get(id);
		if (!model) return 'unknown diagram';
		const res = commit({
			load: () => model,                              // existence anchor only; the value-shaped mutate ignores it
			validate: (next) => {
				const e = validateDoc(next);
				if (e) return [e];
				if (next.meta.id !== id) return ['doc.meta.id does not match diagram'];
				return [];
			},
			save: (next) => this.loadInto(model, id, next),
		}, () => {
			migrateLegacy(doc);   // a stale pre-upgrade tab may reconnect-push top-left coords (mutates the value)
			return { ok: true, store: doc };
		});
		return res.ok ? null : (res.violations?.[0] || res.error);
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
	markDirty(id) {
		const entry = this.diagrams.get(id);
		if (!entry) return;
		entry.dirty = true;
		if (entry.timer) return;
		entry.timer = setTimeout(() => {
			entry.timer = null;
			this.flush(id);
		}, FLUSH_MS);
		if (entry.timer.unref) entry.timer.unref();
	}

	flush(id) {
		const entry = this.diagrams.get(id);
		if (!entry || !entry.dirty) return;
		const file = path.join(this.dir, `${id}.json`);
		entry.file = `${id}.json`; // canonical from first flush onward
		const tmp = `${file}.tmp`;
		try {
			fs.writeFileSync(tmp, JSON.stringify(entry.model.toJSON(), null, '\t') + '\n');
			fs.renameSync(tmp, file);
			entry.dirty = false; // only after the write actually landed
		} catch (err) {
			console.error(`[ store ] flush failed for ${id}: ${err.message}`);
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
