/*
Model — pure entity store for one diagram. No DOM, no layout knowledge.
Entities: node, link, zone, group (docs/spec/SCOPE.md). IDs are '<kind>-<6hex>' (graph lineage).
Mutations are primitive (put/set/del); cascade semantics live in commands.js so that
every committed change is capturable and undoable.

Ported verbatim from client/src/model.js — the document model + wire format stay stable
across the kernel migration; only render/geometry are re-platformed onto the kernel.
*/

const KINDS = ['node', 'waypoint', 'link', 'zone', 'group'];
const KEY = { node: 'nodes', waypoint: 'waypoints', link: 'links', zone: 'zones', group: 'groups' };
const SELECTABLE = new Set(['node', 'waypoint', 'link', 'zone']);   // selectable kinds — MUST match server/validate.js SELECTABLE (a group/diagram is never selected directly)

export function newId(kind, taken = {}) {
	let id;
	do {
		const hex = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
		id = `${kind}-${hex}`;
	} while (taken[id]);
	return id;
}

// the kind of an entity id ('node-ab12cd' → 'node'). The single authority for kind-from-id;
// derive-only — never stamped onto an entity (a stored field would fail the server's unknown-field gate).
export const kindOf = (id) => id.split('-')[0];

export class Model {
	constructor() {
		this.state = {
			meta: { id: '', name: 'untitled', rev: 0, grid: 'center', slides: { url: '', presentationId: '', pageId: '' } },
			nodes: {},
			waypoints: {},
			links: {},
			zones: {},
			groups: {},
			selection: new Set()   // model-state (status): the authoritative selected-id set (MS1). NOT a KIND — round-trips as doc.selection, never via the KINDS loops.
		};
		this.subs = [];
		this.index = null; // optional maintained-relations index (engine attachRelations); null → query methods scan
	}

	onChange(fn) {
		this.subs.push(fn);
	}

	emit(action, kind, entity) {
		if (action !== 'load') this.state.meta.rev++;
		this.subs.forEach((fn) => fn(action, kind, entity));
	}

	collection(kind) {
		return this.state[KEY[kind]];
	}

	get(kind, id) {
		// own-property only: '__proto__'/'constructor' must never resolve
		const collection = this.collection(kind);
		return Object.hasOwn(collection, id) ? collection[id] : undefined;
	}

	all(kind) {
		return Object.values(this.collection(kind));
	}

	put(kind, entity) {
		this.collection(kind)[entity.id] = entity;
		this.emit('put', kind, entity);
		return entity.id;
	}

	set(kind, id, patch) {
		const entity = this.get(kind, id);
		if (!entity) return;
		Object.assign(entity, patch);
		this.emit('set', kind, entity);
		return entity;
	}

	del(kind, id) {
		const entity = this.get(kind, id);
		if (!entity) return;
		delete this.collection(kind)[id];
		this.emit('del', kind, entity);
		// reconcile model-state to config: drop the gone id from the authoritative selection. AFTER
		// emit (so a client Selection observer wins change-detection); idempotent — on the server this
		// is the sole reconcile net (no Selection there). (MS1)
		this.state.selection.delete(id);
		return entity;
	}

	// ---- queries ----
	linksOf(nodeId) {
		if (this.index) return this.index.linksOf(nodeId);
		return this.all('link').filter((l) => l.src === nodeId || l.dst === nodeId);
	}

	// every link referencing this waypoint in ANY role — endpoint (src/dst) or via bend. A waypoint
	// belongs to at most one link (endpoint XOR via), so this is 0 or 1 links; used for occupancy
	// ("free" = empty), reflow on move, and the delete cascade.
	linksAt(waypointId) {
		if (this.index) return this.index.linksAt(waypointId);
		return this.all('link').filter((l) =>
			l.src === waypointId || l.dst === waypointId || (Array.isArray(l.via) && l.via.includes(waypointId)));
	}

	// a link endpoint resolves to a node OR a waypoint — the single authority for "is this a live
	// endpoint" (truthy = the entity, else undefined). Used by render/selection/group liveness.
	endpointOf(id) {
		return this.get('node', id) || this.get('waypoint', id);
	}

	linkBetween(a, b) {
		if (this.index) return this.index.linkBetween(a, b);
		return this.all('link').find((l) =>
			(l.src === a && l.dst === b) || (l.src === b && l.dst === a));
	}

	groupOf(nodeId) {
		if (this.index) return this.index.groupOf(nodeId);
		return this.all('group').find((g) => g.members.includes(nodeId));
	}

	// occupancy by grid CELL — `p` is a snapped grid-px point. occupiedAt = a node rests on p's cell;
	// occupiedAnyAt = a node OR waypoint; waypointAt = the waypoint entity there. The index path keys
	// by cell (engine cellOf); the scan-fallback (server / detached rollback, index === null) uses
	// px-equality. The two agree only when BOTH p AND the stored entity are grid-aligned — true for all
	// in-app data (every gesture snaps); off-grid coords exist only in hand-edited/legacy wire docs.
	// Keeps doc.js free of any kernel import.
	occupiedAt(p) {
		if (this.index) return this.index.occupiedAt(p);
		return this.all('node').some((n) => n.x === p.x && n.y === p.y);
	}

	occupiedAnyAt(p) {
		if (this.index) return this.index.occupiedAnyAt(p);
		return this.all('node').some((n) => n.x === p.x && n.y === p.y)
			|| this.all('waypoint').some((w) => w.x === p.x && w.y === p.y);
	}

	waypointAt(p) {
		if (this.index) { const id = this.index.waypointAt(p); return id ? this.get('waypoint', id) : undefined; }
		return this.all('waypoint').find((w) => w.x === p.x && w.y === p.y);
	}

	nextName(prefix) {
		const taken = new Set([
			...this.all('node').map((n) => n.name),
			...this.all('zone').map((z) => z.name),
			...this.all('group').map((g) => g.name)
		]);
		let n = 1;
		while (taken.has(`${prefix}-${n}`)) n++;
		return `${prefix}-${n}`;
	}

	// ---- entity factories ----
	makeNode(type, pos, shape = 'circle') {
		return {
			id: newId('node', this.collection('node')),
			name: this.nextName(type),
			type,
			shape, // the outer frame (circle, square, …): independent of the glyph `type`
			x: pos.x,
			y: pos.y
		};
	}

	// a TEXT BOX (authoring A1): a node whose content is a single text region filling its footprint. No new
	// kind — it's a node with span + content (W1/W2 render it). type 'text' is a sentinel (unused while
	// content is present); name empty (the text IS its content). Authored on-canvas via hold-t + drag.
	makeTextBox(pos, span = { cols: 1, rows: 1 }) {
		const cols = span.cols, rows = span.rows;
		return {
			id: newId('node', this.collection('node')),
			name: '',
			type: 'text',
			shape: 'circle',   // a panel's corner follows shape: 'circle' = rounded (rx=circle radius); 's' toggles to 'square'
			x: pos.x,
			y: pos.y,
			span: { cols, rows },
			content: [{ at: [0, 0], cols, rows, content: 'text', value: '', align: 'left' }]
		};
	}

	makeLink(src, dst) {
		return { id: newId('link', this.collection('link')), src, dst };
	}

	// a routing pivot — a placeable cell-centre anchor a link's route threads through
	makeWaypoint(pos) {
		return { id: newId('waypoint', this.collection('waypoint')), x: pos.x, y: pos.y };
	}

	makeZone(box) {
		return {
			id: newId('zone', this.collection('zone')),
			name: this.nextName('zone'),
			x: box.x,
			y: box.y,
			w: box.w,
			h: box.h
		};
	}

	makeGroup(members) {
		return {
			id: newId('group', this.collection('group')),
			name: this.nextName('group'),
			members: [...members]
		};
	}

	// ---- selection (model-state / status, MS1) — single-sourced here so client + server agree ----
	// does the entity for this id exist? kind is inferred from the id; safe for ids of unknown kind.
	entityExists(id) {
		const k = kindOf(id);
		return KEY[k] !== undefined && this.get(k, id) !== undefined;
	}

	// admissible into the selection: a SELECTABLE kind whose entity exists. The single admission rule
	// for set/add/toggle/load, so model-state never holds a non-selectable id — kept in lockstep with
	// the server's validateSelectionIds (else a group id would round-trip out of toJSON then get the
	// whole doc rejected on reload, defeating tolerate-stale).
	selectable(id) {
		return SELECTABLE.has(kindOf(id)) && this.entityExists(id);
	}

	// expand to the group-as-one rule: a grouped node/waypoint pulls in its whole group.
	expandSelection(ids) {
		const out = new Set();
		ids.forEach((id) => {
			out.add(id);
			if (this.endpointOf(id)) {
				const group = this.groupOf(id);
				if (group) group.members.forEach((m) => out.add(m));
			}
		});
		return out;
	}

	// set the authoritative selection: expand-to-group, then admit only selectable-live ids — the single
	// admission rule (with add/toggle/load) so a non-selectable id can never reach toJSON. (The
	// server-side select path that reuses this lands in R2.)
	setSelection(ids) {
		this.state.selection = new Set([...this.expandSelection(ids)].filter((id) => this.selectable(id)));
	}

	// ---- document (de)serialization — the persisted JSON shape from docs/spec/SCOPE.md ----
	toJSON() {
		const doc = { meta: { ...this.state.meta, slides: { ...this.state.meta.slides } } };
		KINDS.forEach((kind) => {
			doc[KEY[kind]] = this.all(kind).map((e) => ({ ...e }));
		});
		doc.selection = [...this.state.selection];   // model-state (status): authoritative selection (MS1)
		return doc;
	}

	load(doc) {
		KINDS.forEach((kind) => {
			this.state[KEY[kind]] = {};
			(doc[KEY[kind]] || []).forEach((e) => {
				this.collection(kind)[e.id] = { ...e };
			});
		});
		if (doc.meta) {
			this.state.meta = { ...this.state.meta, ...doc.meta, slides: { ...this.state.meta.slides, ...(doc.meta.slides || {}) } };
			// the grid marker mirrors the DOCUMENT: a legacy doc must not inherit
			// 'center' from the defaults, or the server cannot detect it on push
			this.state.meta.grid = doc.meta.grid;
		}
		// model-state (status): restore the authoritative selection, reconciled to the config loaded
		// above (tolerate-stale: drop ids that aren't a live selectable entity). Before emit. (MS1)
		this.state.selection = new Set((doc.selection || []).filter((id) => this.selectable(id)));
		this.emit('load', 'model', null);
	}
}
