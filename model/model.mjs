/*
Model — pure entity store for one diagram. No DOM, no layout knowledge.
Entities: node, link, zone, group (`docs/spec/API.md`). IDs are '<kind>-<6hex>' (graph lineage).
Mutations are primitive (put/set/del); cascade semantics live in commands.js so that
every committed change is capturable and undoable.

Ported verbatim from client/src/model.js — the document model + wire format stay stable
across the kernel migration; only render/geometry are re-platformed onto the kernel.
*/

const KINDS = ['node', 'waypoint', 'link', 'zone', 'group'];
const KEY = { node: 'nodes', waypoint: 'waypoints', link: 'links', zone: 'zones', group: 'groups' };
// the selectable kinds: a group or a diagram is never selected directly. EXPORTED because
// server/validate.js builds its id regex from this list -- it used to carry its own copy, pinned
// to this line by a comment reading "MUST match server/validate.js SELECTABLE", which is a
// comment doing a check's job (B86).
export const SELECTABLE_KINDS = ['node', 'waypoint', 'link', 'zone'];
const SELECTABLE = new Set(SELECTABLE_KINDS);

/*
A throwaway Model carrying the same content as `model`, so a step can be decided against the state
left by the step before it WITHOUT touching the live one.

Both sides of the wire have this problem and it is the same problem. `server/txn.mjs` plans op k
against the state op k-1 left, which is how "a rejected request wrote nothing" holds by purity
rather than by rollback. `app/src/commands.js` allocates entity k against the entity k-1 it just
invented — ids, names, and the duplicate-link check all read the namespace, and all three go wrong
if that namespace cannot see the batch in flight.

It lived privately in the planner until a second, independent consumer appeared (B46). Two O(doc)
passes, paid at gesture rate on the client and per request on the server — never at pointer-move
rate, which is why the browser sends one request per command.
*/
export function projection(model) {
	const scratch = new Model();
	scratch.load(model.toJSON());
	return scratch;
}

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
			// `owner` and `grants` are AUTHORIZATION, and are server-recorded status:
			// written by the store, never by a client commit, so they leave no undo record (ACCESS.md).
			// An empty owner means unowned, which is what every diagram predating H9 is.
			meta: { id: '', name: 'untitled', version: 0, schema: 1, owner: '', grants: {} },
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

	// A Model is a VALUE CONTAINER. It used to advance meta.rev here, which made every render
	// signal a version bump — one drag was ~60 of them. Versioning is a property of a transaction,
	// so it is minted where transactions are (server/txn.mjs), not where changes are drawn.
	emit(action, kind, entity) {
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

	/*
	Resolve a link's ROUTE to a PATH — docs/spec/HIERARCHY.md §0, connection taxonomy.

	A route is an ordered list of ANCHORS and carries no coordinates (`src`, `via[]`, `dst`); a path
	is an ordered list of coordinates and carries no identity. This is the one place that crosses
	between them, and it lives here because `model/` owns the entities holding the coordinates —
	the kernel never sees a Model.

	Returns `[[x, y], …]`, the canonical PATH shape, NOT `{x,y}`. Entities are objects, paths are
	tuples: two shapes, one rule, so the value hands straight to the kernel's `roundedPath` with no
	conversion at any consumer. An anchor is a node OR a waypoint (`endpointOf`), and a `via` bend is
	always a waypoint entity.

	A route that cannot fully resolve returns null rather than a partial path — half a path renders
	as a line to nowhere. This was hand-rolled at four sites before it had a name, and two of them
	were wrong: the data view measured `dist(src, dst)` ignoring every bend, and re-plug handles were
	placed on the straight src→dst line (B29).
	*/
	pathOf(link) {
		if (!link) return null;
		// An anchor is an entity REFERENCE or a bare position. The kernel's resolveRoute already
		// admits both (an entity id, or a cell coord as a free anchor); admitting the same here is
		// what lets the LIVE link preview — whose final anchor is the cursor, not yet an entity —
		// use this one resolver instead of hand-rolling a fourth copy.
		const at = (ref) => (ref && typeof ref === 'object' ? ref : this.endpointOf(ref));
		const src = at(link.src), dst = at(link.dst);
		if (!src || !dst) return null;
		const path = [[src.x, src.y]];
		for (const id of link.via || []) {
			const w = this.get('waypoint', id);
			if (!w) return null;                    // a missing BEND is as dangling as a missing end
			path.push([w.x, w.y]);
		}
		path.push([dst.x, dst.y]);
		return path;
	}

	// whether a and b are connected at all. Since B72 a pair may carry several links, so this
	// returns AN endpoint-pair link and not THE one -- use linksBetween to reason about which.
	linkBetween(a, b) {
		if (this.index) return this.index.linkBetween(a, b);
		return this.all('link').find((l) =>
			(l.src === a && l.dst === b) || (l.src === b && l.dst === a));
	}

	// every link joining a and b (B80). One pair may hold a straight link and routed ones beside
	// it, and a caller deciding whether to author another has to see them all to tell.
	linksBetween(a, b) {
		if (this.index) return this.index.linksBetween(a, b);
		return this.all('link').filter((l) =>
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

	/*
	B187 -- the next free `<prefix>-<n>`, unique across EVERY named kind.

	The scan used to read nodes, zones and groups only. That was correct while those were the only
	kinds carrying a name; now that a waypoint and a link carry one too, omitting them would mint a
	duplicate the first time somebody named a waypoint `link-1`, and `resolveId` refuses an ambiguous
	name -- so the collision would surface as an unrelated verb suddenly failing.
	*/
	nextName(prefix) {
		// KINDS, not a second list: after B187 every kind is named, so "named kinds" and "kinds"
		// are the same set and a separate constant would be a twin waiting to drift.
		const taken = new Set(KINDS.flatMap((k) => this.all(k).map((e) => e.name)));
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
		// B187 -- a link is named like everything else. Minted from its two ends rather than from a
		// request for a named thing, so the name is generated.
		return { id: newId('link', this.collection('link')), name: this.nextName('link'), src, dst };
	}

	// a placeable ANCHOR — a cell-centre point a link's route can thread through and bend at
	makeWaypoint(pos) {
		// B187 -- named like every other entity. A waypoint is minted from a position rather than
		// from a request for a named thing, so the name is generated rather than asked for.
		return { id: newId('waypoint', this.collection('waypoint')), name: this.nextName('waypoint'), x: pos.x, y: pos.y };
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

	/*
	---- doc (de)serialization — the persisted JSON shape from docs/spec/API.md ----

	This method IS the boundary between the two nouns, which is why the distinction is worth stating
	here as well as at `validateDoc`. Above this line is a Model: live, indexed, with methods. Below
	it is a `doc`: flat JSON, no behaviour, the only form that reaches disk or the wire. `load()`
	crosses back the other way.

	H5.7 renamed the substrate `document/` to `model/` and kept `doc` deliberately (B41), so `doc`
	here is a chosen term rather than a survival. B95 records why that keeps having to be explained.
	*/
	toJSON() {
		const doc = { meta: { ...this.state.meta, grants: { ...this.state.meta.grants } } };
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
			// grants REPLACE rather than merge: a revoked principal must not survive a reload by
			// hiding in the previous state, which a spread of the old over the new would allow.
			// Slides Phase 1: `slides` is dropped rather than merged. A document written before the
			// purge still carries the key, and spreading `doc.meta` would carry it back into a model
			// the field no longer belongs to -- which is how it survived the first pass of this purge.
			const { slides: _retired, ...incoming } = doc.meta;
			this.state.meta = { ...this.state.meta, ...incoming, grants: { ...(doc.meta.grants || {}) } };
		}
		// model-state (status): restore the authoritative selection, reconciled to the config loaded
		// above (tolerate-stale: drop ids that aren't a live selectable entity). Before emit. (MS1)
		this.state.selection = new Set((doc.selection || []).filter((id) => this.selectable(id)));
		this.emit('load', 'model', null);
	}
}
