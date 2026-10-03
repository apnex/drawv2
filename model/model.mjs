/*
Model — pure entity store for one diagram. No DOM, no layout knowledge.
Entities: node, link, zone, group (`docs/spec/API.md`). IDs are '<kind>-<6hex>' (graph lineage).
Mutations are primitive (put/set/del); cascade semantics live in commands.js so that
every committed change is capturable and undoable.

Ported verbatim from client/src/model.js — the document model + wire format stay stable
across the kernel migration; only render/geometry are re-platformed onto the kernel.
*/

// the kinds, their collections and which are selectable: a composition of kind rows (model/shape.mjs, H17.22 N-a), the
// product's five unless one is passed. The selectable list was re-exported here for planner/validate.js's id regex; the
// validator now reads the composition it is handed.
import { CORE_KINDS, SCHEMA } from './shape.mjs';
// B246: every query that answers links answers in one order on every peer -- ascending id (model/order.mjs)
import { byId } from './order.mjs';

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
	const scratch = new Model({ kinds: model.kinds });   // the same kinds, or a plugin's would not load into it
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
THE NETWORK INTERFACE -- one object the network plugin plugs in through (RULESET-AUDIT T1, F9).

The incubating network plugin (ruled 2026-09-28) needs the product to ask it seven questions: four the Model asks while
drawing, and three the planner asks while judging an edit. They began as seven separate hooks, added one at a time, and
nothing said they belonged together -- so a composition could pass some and forget others, drawing links along routes
while saying none was down. Declared as ONE object, a plugin is either composed whole or refused.

Each consumer names what it reads and checks only that; the plugin builds one object carrying all of it
(network/network.mjs), and the lab hands the same object to both. Absent -- `network` null -- is production, and every
answer is exactly what it always was.

A HALF-PLUGIN IS AN ERROR, never a quiet fall-back: a network missing a method its consumer reads throws at
construction, naming it, and so does an option under a retired hook name, which would otherwise be ignored.
*/
function requireNetwork(network, reads, who) {
	if (network == null) return null;
	const missing = reads.filter((name) => typeof network[name] !== 'function');
	if (missing.length) throw new Error(`${who}: the network does not provide ${missing.join(', ')} -- a network is composed whole or not at all (RULESET-AUDIT T1)`);
	return network;
}

// every option a consumer does not read is refused -- a retired hook name above all, which would leave the plugin half-composed
function refuseStrayOptions(rest, who) {
	const stray = Object.keys(rest);
	if (stray.length) throw new Error(`${who}: unknown option ${stray.join(', ')} -- the network plugs in as one object, { network } (RULESET-AUDIT T1)`);
}

/*
What the MODEL asks the network -- each under the Model's own method name, so `model.isLinkDown(link)` is answered by
`network.isLinkDown(link, model)`:

  pathOf(link, model, straight)   where a link is DRAWN. Production draws the straight polyline through `via`; the lab
                                  draws along the link's ROUTE over pipes. Rather than patch `pathOf` in the lab -- a
                                  fork wearing a patch, which G1 forbids -- the seam is declared here. Handed the
                                  default as `straight`, so it can route some links and defer the rest.
  linksRoutedThrough(id, model)   which links a moved anchor affects, from the same authority that draws them. Under
                                  routing a link is drawn through an anchor it does not name, and the incidence index
                                  never sees it -- the renderer left such a link standing when its anchor moved (the
                                  director's report, 2026-09-29).
  isLinkDown(link, model)         whether a link has no route, and so is drawn dotted and ready to heal (ruled
                                  2026-09-25; the look, 2026-09-29). Down is derived, so only the router can say it.
  blockersOf(link, model)         which links hold the way a down link would take -- pipes carry one link each (ruled
                                  2026-09-30), and selecting a blocked link highlights its blockers.
*/
/*
  declaresNoTransit(id, model)    whether the author declared this anchor's transit off -- what the transit ring marks
                                  (ruled 2026-09-28; TRANSIT.md section 12). Only a declaration draws the ring: a type
                                  that offers no choice declares nothing. Production has no transit: never.
  stopsAt(id, model)              whether what arrives at this anchor stops there -- declared off, or of a type that offers
                                  only off (B278). The ONE transit question the rules ask: the roles a waypoint takes, the
                                  toggle's cut and join, the planner's join refusal; the declaration above only draws the
                                  ring. Production has no transit: nothing stops.
*/
const MODEL_READS = ['pathOf', 'linksRoutedThrough', 'isLinkDown', 'blockersOf', 'declaresNoTransit', 'stopsAt'];

export class Model {
	constructor({ network = null, kinds = CORE_KINDS, ...rest } = {}) {
		refuseStrayOptions(rest, 'Model');
		// the kinds this model stores (H17.22 N-a): the product's five unless a composition brings its own (model/shape.mjs)
		if (!kinds || !Array.isArray(kinds.list) || typeof kinds.has !== 'function') throw new Error('Model: kinds is a composition -- composeKinds(rows) (model/shape.mjs)');
		this.kinds = kinds;
		// null in production, which draws, depends and never goes down exactly as it always has -- a test holds it byte for byte
		this.network = requireNetwork(network, MODEL_READS, 'Model');
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

	// ---- queries ----
	linksOf(nodeId) {
		if (this.index) return this.index.linksOf(nodeId);
		return this.all('link').filter((l) => l.src === nodeId || l.dst === nodeId).sort(byId);
	}

	// every link referencing this waypoint in ANY role — endpoint (src/dst) or via bend. A waypoint
	// belongs to at most one link (endpoint XOR via), so this is 0 or 1 links; used for occupancy
	// ("free" = empty), reflow on move, and the delete cascade.
	linksAt(waypointId) {
		if (this.index) return this.index.linksAt(waypointId);
		return this.all('link').filter((l) =>
			l.src === waypointId || l.dst === waypointId || (Array.isArray(l.via) && l.via.includes(waypointId))).sort(byId);
	}

	// a link endpoint resolves to a node OR a waypoint — the single authority for "is this a live
	// endpoint" (truthy = the entity, else undefined). Used by render/selection/group liveness.
	endpointOf(id) {
		return this.get('node', id) || this.get('waypoint', id);
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

	A route that cannot fully resolve returns null rather than a partial path — half a path renders
	as a line to nowhere. This was hand-rolled at four sites before it had a name, and two of them
	were wrong: the data view measured `dist(src, dst)` ignoring every bend, and re-plug handles were
	placed on the straight src→dst line (B29).
	*/
	pathOf(link) {
		if (!link) return null;
		if (this.network) return this.network.pathOf(link, this, (l) => this.straightPath(l));
		return this.straightPath(link);
	}

	// the links drawn THROUGH an anchor they do not name -- empty unless a network is plugged in
	linksRoutedThrough(id) {
		return this.network ? this.network.linksRoutedThrough(id, this) : [];
	}

	// whether a link has no route right now, and so is drawn as ready to heal -- never, without a network
	isLinkDown(link) {
		return !!(link && this.network && this.network.isLinkDown(link, this));
	}

	// the links holding the way a down link would take -- never any, without a network
	blockersOf(link) {
		return link && this.network ? this.network.blockersOf(link, this) : [];
	}

	// whether the author declared this anchor's transit off -- never, without a network
	declaresNoTransit(id) {
		return !!(this.network && this.network.declaresNoTransit(id, this));
	}

	// whether what arrives at this anchor stops there (B278) -- never, without a network
	stopsAt(id) {
		return !!(this.network && this.network.stopsAt(id, this));
	}

	// the DEFAULT path: src, then each via's centre, then dst -- the polyline production has always
	// drawn. Named so a network can defer to it (see MODEL_READS above the class).
	straightPath(link) {
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
	// B246: the lowest id among them, so every peer names the same one
	linkBetween(a, b) {
		if (this.index) return this.index.linkBetween(a, b);
		return this.linksBetween(a, b)[0];
	}

	// every link joining a and b (B80). One pair may hold a straight link and routed ones beside
	// it, and a caller deciding whether to author another has to see them all to tell.
	linksBetween(a, b) {
		if (this.index) return this.index.linksBetween(a, b);
		return this.all('link').filter((l) =>
			(l.src === a && l.dst === b) || (l.src === b && l.dst === a)).sort(byId);
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

	nextName(prefix) {
		// the NAMED kinds, one namespace (B187): a kind opts in by its row, and the product's five all do (N5)
		const taken = new Set(this.kinds.named.flatMap((k) => this.all(k).map((e) => e.name)));
		let n = 1;
		while (taken.has(`${prefix}-${n}`)) n++;
		return `${prefix}-${n}`;
	}

	// ---- entity factories ----
	makeNode(type, pos, shape = 'circle') {
		return {
			id: this.freshId('node'),
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
			id: this.freshId('node'),
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
		return { id: this.freshId('waypoint'), name: this.nextName('waypoint'), x: pos.x, y: pos.y };
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
		return this.kinds.has(k) && this.get(k, id) !== undefined;
	}

	// admissible into the selection: a SELECTABLE kind whose entity exists. The single admission rule
	// for set/add/toggle/load, so model-state never holds a non-selectable id — kept in lockstep with
	// the server's validateSelectionIds (else a group id would round-trip out of toJSON then get the
	// whole doc rejected on reload, defeating tolerate-stale).
	selectable(id) {
		return this.kinds.selectable.includes(kindOf(id)) && this.entityExists(id);
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
