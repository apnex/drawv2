/*
Model — pure entity store for one diagram. No DOM, no layout knowledge.
Entities: whatever kinds the Model is composed with -- the node the core's, zone the zones plugin's, group the groups
plugin's, link and pipe the network's (`docs/spec/API.md`). IDs are '<kind>-<6hex>' (graph lineage).
Mutations are primitive (put/set/del); cascade semantics live in commands.js so that
every committed change is capturable and undoable.

Ported verbatim from client/src/model.js — the document model + wire format stay stable
across the kernel migration; only render/geometry are re-platformed onto the kernel.
*/

// the kinds, their collections and which are selectable: a composition of kind rows (model/shape.mjs, H17.22 N-a), the
// core's three unless one is passed (no links since S-e). The selectable list was re-exported here for planner/validate.js's id regex; the
// validator now reads the composition it is handed.
import { CORE_KINDS, SCHEMA } from './shape.mjs';
// B246: every query that answers links answers in one order on every peer -- ascending id (model/order.mjs)
import { byId, nextOrder } from './order.mjs';
import { BARE_KIND, anchorOf } from './anchors.mjs';   // the anchor's stored kind, and resolving one (O-e1: whether a device is composed is devices/device-shapes.mjs's)

/*
A throwaway Model carrying the same content as `model`, so a step can be decided against the state
left by the step before it WITHOUT touching the live one.

Both sides of the wire have this problem and it is the same problem. `planner/txn.mjs` plans op k
against the state op k-1 left, which is how "a rejected request wrote nothing" holds by purity
rather than by rollback. `app/src/commands.js` allocates entity k against the entity k-1 it just
invented — ids, names, and the duplicate-link check all read the namespace, and all three go wrong
if that namespace cannot see the batch in flight.

It lived privately in the planner until a second, independent consumer appeared (B46). Two O(doc)
passes, paid at gesture rate on the client and per request on the server — never at pointer-move
rate, which is why the browser sends one request per command.
*/
export function projection(model) {
	const scratch = new Model({ kinds: model.kinds, attached: model.attached });   // the same kinds and attachments (J2), or a plugin's would not load into it
	scratch.load(model.toJSON());
	return scratch;
}

// `taken` is the ids already in use, as an object keyed by id or as a predicate -- the Model's `freshId` asks one
export function newId(kind, taken = {}) {
	const used = typeof taken === 'function' ? taken : (id) => taken[id];
	let id;
	do {
		const hex = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
		id = `${kind}-${hex}`;
	} while (used(id));
	return id;
}

// the kind of an entity id ('node-ab12cd' → 'node'). The single authority for kind-from-id;
// derive-only — never stamped onto an entity (a stored field would fail the server's unknown-field gate).
export const kindOf = (id) => id.split('-')[0];

/*
A HALF-COMPOSED MODEL IS AN ERROR, never a quiet fall-back: an option the Model does not read -- a retired one above all --
is refused, naming it. A network is checked whole where it is read (network/network-queries.mjs `networkOf`, Q-a).
*/
// every option a consumer does not read is refused -- a retired hook name above all, which would leave the plugin half-composed
function refuseStrayOptions(rest, who) {
	const stray = Object.keys(rest);
	if (stray.length) throw new Error(`${who}: unknown option ${stray.join(', ')} -- a plugin attaches as { attached: { ${stray.join(', ')} } } (Q-a, H19.27)`);
}

/*
Q-a (H19.27; dev/design/unification/PLUGIN-QUERIES.md, Q1 ruled A): the Model asked a plugin named the network six questions
under its own method names -- where a link is drawn, whether it is down, what blocks it, which links pass through an anchor,
whether an anchor declares its transit off, whether what arrives stops there. They are the network's functions over a Model
now (network/network-queries.mjs), with the straight path a down link is drawn along; the Model holds what a plugin attaches
to it and reads none of it.
*/

export class Model {
	constructor({ attached = {}, kinds = CORE_KINDS, ...rest } = {}) {
		refuseStrayOptions(rest, 'Model');
		// the kinds this model stores (H17.22 N-a): the core's three unless a composition brings its own (model/shape.mjs) --
		// so no links without the network's rows (S-e)
		if (!kinds || !Array.isArray(kinds.list) || typeof kinds.has !== 'function') throw new Error('Model: kinds is a composition -- composeKinds(rows) (model/shape.mjs)');
		this.kinds = kinds;
		/*
		Q-a (H19.27) -- WHAT A PLUGIN ATTACHES TO THIS MODEL, held and never read: the network's instance, one per Model since it
		keeps one derivation per board (network/read-model.mjs). The network's functions read their own (network/network-queries.mjs).
		*/
		if (!attached || typeof attached !== 'object' || Array.isArray(attached)) throw new Error('Model: attached is an object, a plugin\'s name to what it attaches');
		this.attached = Object.freeze({ ...attached });
		/*
		V-e (H18.29; ruled J2) -- A KIND THE NETWORK DRAWS NEEDS THE NETWORK: a Model holding one draws it by no fallback.
		AMENDED Q-a (H19.27): a row names the attachment its kind needs (`needs`, model/shape.mjs) -- the network's link needs the
		network -- and a Model composed with the kind and without the attachment is refused. The core names no plugin; it reads
		the rows.
		*/
		for (const kind of kinds.list) {
			const missing = (kinds.row(kind).needs ?? []).filter((name) => !this.attached[name]);
			if (missing.length) throw new Error(`Model: kind ${kind} needs ${missing.join(', ')} attached -- { attached: { ${missing.join(', ')} } }`);
		}
		this.state = {
			// `owner` and `grants` are AUTHORIZATION, and are server-recorded status:
			// written by the store, never by a client commit, so they leave no undo record (ACCESS.md).
			// An empty owner means unowned, which is what every diagram predating H9 is.
			meta: { id: '', name: 'untitled', version: 0, schema: SCHEMA, owner: '', grants: {} },
			...Object.fromEntries(kinds.list.map((k) => [kinds.collection[k], {}])),   // one collection per kind composed
			selection: new Set(),  // model-state (status): the authoritative selected-id set (MS1). NOT a KIND — round-trips as doc.selection, never via the KINDS loops.
			/*
			H14.4 -- the reveal, when the document carries one. Null is the normal case and means
			"everything is visible", so every document that predates beats is already correct.

			Config rather than status, unlike selection: a beat is created BY a commit and undone
			with it, so it must survive a write and travel in the snapshot. Held opaque here --
			`model/reveal.mjs` owns what it means, and this only has to not lose it.
			*/
			reveal: null
		};
		this.subs = [];
		this.index = null; // optional maintained-relations index (engine attachRelations); null → query methods scan
	}

	onChange(fn) {
		this.subs.push(fn);
	}

	// A Model is a VALUE CONTAINER. It used to advance meta.rev here, which made every render
	// signal a version bump — one drag was ~60 of them. Versioning is a property of a transaction,
	// so it is minted where transactions are (planner/txn.mjs), not where changes are drawn.
	emit(action, kind, entity) {
		this.subs.forEach((fn) => fn(action, kind, entity));
	}

	// a kind this model was not composed with is refused, named -- never an undefined collection read as empty
	collection(kind) {
		if (!this.kinds.has(kind)) throw new Error(`Model: ${kind} is not a kind this model was composed with (${this.kinds.list.join(', ')})`);
		return this.state[this.kinds.collection[kind]];
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

	// a link endpoint resolves to a node OR a waypoint — the single authority for "is this a live
	// endpoint" (truthy = the entity, else undefined). Used by render/selection/group liveness.
	endpointOf(id) {
		return anchorOf(this, id);
	}

	/*
	Resolve a link's ROUTE to a PATH — dev/HIERARCHY.md §0, connection taxonomy.

	A route is an ordered list of ANCHORS and carries no coordinates (`src`, `via[]`, `dst`); a path
	is an ordered list of coordinates and carries no identity. This is the one place that crosses
	between them, and it lives here because `model/` owns the entities holding the coordinates —
	the kernel never sees a Model.

	Returns `[[x, y], …]`, the canonical PATH shape, NOT `{x,y}`. Entities are objects, paths are
	tuples: two shapes, one rule, so the value hands straight to the kernel's `roundedPath` with no
	conversion at any consumer. An anchor is a node OR a waypoint (`endpointOf`), and a `via` bend is
	always a waypoint entity.

	/*
	O-c (H19.20) -- THE ENTITY THAT GATHERS AN ID: of the kinds whose row gathers a list field (model/shape.mjs `gathers`), the
	one listing `id`, else undefined. It was `groupOf`, which named the group; the group asks it now (groups/group-of.mjs).
	The index answers when attached, keyed as the group's membership was; the scan, in the composition's order and each
	kind's id order, otherwise.
	*/
	gathererOf(id) {
		if (this.index) return this.index.gathererOf(id);
		for (const [kind, field] of Object.entries(this.kinds.gathers)) {
			const found = this.all(kind).find((e) => (e[field] || []).includes(id));
			if (found) return found;
		}
		return undefined;
	}

	// occupancy by grid CELL — `p` is a snapped grid-px point. occupiedAt = a node rests on p's cell;
	// occupiedAnyAt = a node OR waypoint; waypointAt = the waypoint entity there. The index path keys
	// by cell (engine cellOf); the scan-fallback (server / detached rollback, index === null) uses
	// px-equality. The two agree only when BOTH p AND the stored entity are grid-aligned — true for all
	// in-app data (every gesture snaps); off-grid coords exist only in hand-edited/legacy wire docs.
	// Keeps doc.js free of any kernel import.
	// O-e1 (H19.21): which anchor is on a cell is the core's; which DEVICE or which WAYPOINT is the devices plugin's
	// (devices/occupancy.mjs `occupiedAt`, `waypointAt`), over this and the index
	occupiedAnyAt(p) {
		if (this.index) return this.index.occupiedAnyAt(p);
		return this.all(BARE_KIND).some((n) => n.x === p.x && n.y === p.y);   // every anchor, a device composed on it or not
	}

	/*
	B187 -- the next free `<prefix>-<n>`, unique across EVERY named kind.

	The scan used to read nodes, zones and groups only. That was correct while those were the only
	kinds carrying a name; now that a waypoint and a link carry one too, omitting them would mint a
	duplicate the first time somebody named a waypoint `link-1`, and `resolveId` refuses an ambiguous
	name -- so the collision would surface as an unrelated verb suddenly failing.
	*/
	/*
	A FRESH ID for a new entity of `kind` (H17.22 N-a; N2). An anchor's 6-hex part is unique across EVERY anchor kind, not
	only its own: a pipe's id is made of its two anchors' hex, so `node-abc123` beside `waypoint-abc123` would let one pipe
	id name two pairs. It is also the first step of the waypoint kind's retirement (B282), when `waypoint-<hex>` becomes
	`node-<hex>` and must collide with nothing.
	*/
	freshId(kind) {
		const shared = this.kinds.anchors.includes(kind) ? this.kinds.anchors : [kind];
		const hex = (id) => id.slice(kind.length + 1);
		return newId(kind, (id) => shared.some((k) => this.get(k, `${k}-${hex(id)}`)));
	}

	// the drawing order a new item of this kind takes: one above the highest (F-d, model/order.mjs)
	nextOrder(kind) {
		return nextOrder(this, kind);
	}

	nextName(prefix) {
		// the NAMED kinds, one namespace (B187): a kind opts in by its row, and the product's kinds and the link all do (N5)
		const taken = new Set(this.kinds.named.flatMap((k) => this.all(k).map((e) => e.name)));
		let n = 1;
		while (taken.has(`${prefix}-${n}`)) n++;
		return `${prefix}-${n}`;
	}

	// a placeable ANCHOR — a cell-centre point a link's route can thread through and bend at
	// ---- selection (model-state / status, MS1) — single-sourced here so client + server agree ----
	// does the entity for this id exist? kind is inferred from the id; safe for ids of unknown kind.
	entityExists(id) {
		const k = kindOf(id);
		return this.kinds.has(k) && this.get(k, id) !== undefined;
	}

	// admissible into the selection: a SELECTABLE kind whose entity exists. The single admission rule
	// for set/add/toggle/load, so model-state never holds a non-selectable id — kept in lockstep with
	// the server's validateSelectionIds (else a group id would round-trip out of toJSON then get the
	// whole doc rejected on reload, defeating tolerate-stale).
	selectable(id) {
		return this.kinds.selectable.includes(kindOf(id)) && this.entityExists(id);
	}

	// expand to the gathered-as-one rule: an anchor a gathering kind lists pulls in that whole list -- a grouped node or
	// waypoint its whole group (O-c: the row declares it, model/shape.mjs `gathers`; the Model names no group)
	expandSelection(ids) {
		const out = new Set();
		ids.forEach((id) => {
			out.add(id);
			if (this.endpointOf(id)) {
				const gatherer = this.gathererOf(id);
				if (gatherer) gatherer[this.kinds.gathers[kindOf(gatherer.id)]].forEach((m) => out.add(m));
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
		this.kinds.list.forEach((kind) => {
			doc[this.kinds.collection[kind]] = this.all(kind).map((e) => ({ ...e }));
		});
		doc.selection = [...this.state.selection];   // model-state (status): authoritative selection (MS1)
		// omitted entirely when absent: a document with no beat must not grow a null key, or every
		// stored diagram gains a field the moment this ships
		if (this.state.reveal) doc.reveal = structuredClone(this.state.reveal);
		return doc;
	}

	load(doc) {
		this.kinds.list.forEach((kind) => {
			this.state[this.kinds.collection[kind]] = {};
			(doc[this.kinds.collection[kind]] || []).forEach((e) => {
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
		// H14.4 -- the reveal travels with the document, opaque to the model. Not reconciled against
		// live ids the way selection is: a beat naming an entity that has since gone is a STALE
		// beat, which `model/reveal.mjs` simply does not reveal, and silently rewriting the record
		// would destroy the author's stated order to hide a fact worth seeing.
		this.state.reveal = doc.reveal ? structuredClone(doc.reveal) : null;
		this.emit('load', 'model', null);
	}
}
