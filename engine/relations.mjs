/*
Relations — draw's maintained reverse indices over the entity graph, kept in sync with a Model off its
onChange spine. After S2 this file is THIN CONFIG: the generic incremental-view MECHANISM (multimap +
snapshot-diff + fast-path) lives once in engine/ivm.mjs (maintainIndex); here we declare WHICH views
exist and inject draw's KEYING (linkRefs, cellsOf, keyOf). The three views the engine inlined separately
are now three maintainIndex instances:
  • link incidence   entityId -> Set<linkId>   (any role: src/dst/via)      — refsOf = linkRefs, kind 'set'
  • gathering        memberId -> gathererId     (an id is gathered by ≤1 entity) — refsOf = the row's `gathers` field, kind 'single'
                     (O-c: a group's membership, read from its row rather than named -- model/shape.mjs `gathers`)
  • cell occupancy   cellKey  -> Set<id>        (eager R13 index)             — refsOf = cellsOf, kind 'set', TWO instances

Pure maintenance — reads the Model only to resolve id→entity at query time, never mutates it. Backs the
Model query methods O(n)→O(1). The snapshot-diff (in maintainIndex) handles the hard case that emit('set')
delivers only the NEW entity. atCell/occupancy use the INJECTED cellOf, so cell-equality ≡ px-equality on
grid operands (the parity guarantee) and the engine imports no spatial-kernel module (sovereignty holds).
*/

import { maintainIndex } from './ivm.mjs';
import { byId } from '../model/order.mjs';   // B246: the one derivation order
import { ANCHOR_KINDS } from '../model/anchors.mjs';   // the bare anchor, asked in one place (F-b)
import { isBareEntity, bareAnchors, typedNodes } from '../devices/device-shapes.mjs';

// the entity ids a link occupies in the incidence index: src, dst, and every via waypoint.
const linkRefs = (l) => Array.isArray(l.via) ? [l.src, l.dst, ...l.via] : [l.src, l.dst];

export function makeRelations(model, { cellOf } = {}) {   // cellOf injected (composition root) — engine imports no kernel
	// cellOf is MANDATORY since R13 (occupancy keys every node/waypoint by cell) — fail fast at the
	// composition root rather than throw cryptically on the first node put / attach.
	if (!cellOf) throw new Error('makeRelations requires an injected { cellOf } (px→cell) — wire it at the composition root');

	// ---- draw's KEYING (the injected config the generic maintainIndex is parameterized by) ----
	const keyOf = (e) => cellOf(e.x) + ',' + cellOf(e.y);   // a single px POINT → its cell key (query points)
	// the cell key(s) an ENTITY occupies: a 1-cell node/waypoint → [its cell]; a multi-cell node (span =
	// {cols,rows} counts) → every covered cell (the anchor +x/+y). Span counts are plain data on the entity
	// and cellOf is the only spatial primitive used, so engine sovereignty holds (no kernel import). (W1)
	const cellsOf = (e) => {
		const c0 = cellOf(e.x), r0 = cellOf(e.y);
		const nc = (e.span && e.span.cols) || 1, nr = (e.span && e.span.rows) || 1;
		if (nc <= 1 && nr <= 1) return [c0 + ',' + r0];
		const keys = [];
		for (let i = 0; i < nc; i++) for (let j = 0; j < nr; j++) keys.push((c0 + i) + ',' + (r0 + j));
		return keys;
	};

	// ---- the maintained views (engine/ivm.mjs) — one per relation, keyed by the config above ----
	const incident = maintainIndex({ refsOf: linkRefs, kind: 'set' });            // entityId → Set<linkId>
	const kindOfId = (id) => id.slice(0, id.indexOf('-'));
	const member = maintainIndex({ refsOf: (e) => e[model.kinds.gathers[kindOfId(e.id)]], kind: 'single' });   // memberId → gathererId (re-ownership-guarded)
	const cellNode = maintainIndex({ refsOf: cellsOf, kind: 'set' });             // cellKey → Set<nodeId>
	const cellWaypoint = maintainIndex({ refsOf: cellsOf, kind: 'set' });         // cellKey → Set<waypointId>
	// a bare anchor's bucket or a node's; from F-c both are nodes, told apart by their entity (model/anchors.mjs)
	const occ = (kind, entity) => (isBareEntity(kind, entity) ? cellWaypoint : cellNode);

	return {
		// maintenance: apply ONE model change. link → incidence; a gathering kind → membership; node/waypoint → the
		// occupancy index (a position set moves the entity between cell buckets; incidence/membership are
		// untouched — a move never changes which links or gatherers reference an id).
		apply(action, kind, entity) {
			if (kind === 'link') {
				if (action === 'put') incident.put(entity);
				else if (action === 'set') incident.set(entity);
				else if (action === 'del') incident.del(entity.id);
			} else if (model.kinds.gathers[kind]) {
				if (action === 'put') member.put(entity);
				else if (action === 'set') member.set(entity);
				else if (action === 'del') member.del(entity.id);
			} else if (ANCHOR_KINDS.includes(kind)) {
				const o = occ(kind, entity);
				if (action === 'put') o.put(entity);
				else if (action === 'set') o.set(entity);
				else if (action === 'del') o.del(entity.id);
			}
		},
		// full (re)build from the Model's current state — initial attach + on 'load' (document swap).
		rebuild() {
			incident.clear(); member.clear(); cellNode.clear(); cellWaypoint.clear();
			// a model composed without the network has no links to index (S-e: the link is the network's kind)
			if (model.kinds.has('link')) model.all('link').forEach((l) => incident.put(l));
			for (const kind of Object.keys(model.kinds.gathers)) model.all(kind).forEach((e) => member.put(e));   // O-c: none, if no kind gathers
			typedNodes(model).forEach((n) => cellNode.put(n));
			bareAnchors(model).forEach((w) => cellWaypoint.put(w));
		},

		// ---- the query helpers — semantics AND ORDER mirror model/model.mjs exactly: ascending id (B246) ----
		linksOf(nodeId) {                                         // links where src/dst === nodeId
			const s = incident.get(nodeId); if (!s) return [];
			const out = []; s.forEach((lid) => { const l = model.get('link', lid); if (l && (l.src === nodeId || l.dst === nodeId)) out.push(l); });
			return out.sort(byId);
		},
		linksAt(waypointId) {                                     // links referencing waypointId in ANY role
			const s = incident.get(waypointId); if (!s) return [];
			const out = []; s.forEach((lid) => { const l = model.get('link', lid); if (l) out.push(l); });
			return out.sort(byId);
		},
		// AN endpoint-pair link between a and b, not THE one. The `(<=1)` this comment used to
		// claim stopped being true at B72, when a pair became able to carry a straight link and
		// routed ones beside it (B80). `incident` was never keyed on the pair, so nothing was
		// stored wrongly -- only described wrongly.
		linkBetween(a, b) {                                       // B246: the lowest id among them
			return this.linksBetween(a, b)[0];
		},
		linksBetween(a, b) {                                      // every link joining a and b
			const s = incident.get(a); if (!s) return [];
			const out = [];
			for (const lid of s) { const l = model.get('link', lid); if (l && ((l.src === a && l.dst === b) || (l.src === b && l.dst === a))) out.push(l); }
			return out.sort(byId);
		},
		gathererOf(id) {                                          // the entity whose gathered list includes id, else undefined (O-c)
			const gid = member.get(id);
			return gid ? model.get(kindOfId(gid), gid) : undefined;
		},

		// the logical grid cell an entity occupies — DERIVED on read via the injected cellOf, never stored
		// on the entity (the doc/wire format stays px-authoritative). Defined for the cell-placed kinds. (R5)
		atCell(id) {
			const e = model.endpointOf(id);
			return e ? [cellOf(e.x), cellOf(e.y)] : undefined;
		},

		// occupancy (R13) — the eager inverse of atCell. Takes a px POINT (snapNode'd grid px); converted
		// with the injected cellOf, so cell-equality ≡ px-equality on grid operands. occupiedAt = a node
		// rests on that cell; occupiedAnyAt = a node OR waypoint; waypointAt = a waypoint id there (the
		// O(1) single occupant is the universal case; the scan handles the degenerate co-occupancy stack
		// in collection order, matching the old all('waypoint').find).
		occupiedAt(p) { return cellNode.has(keyOf(p)); },
		occupiedAnyAt(p) { const k = keyOf(p); return cellNode.has(k) || cellWaypoint.has(k); },
		waypointAt(p) {
			const s = cellWaypoint.get(keyOf(p));
			if (!s || !s.size) return undefined;
			if (s.size === 1) return s.values().next().value;                       // O(1) — the real case
			for (const w of bareAnchors(model)) if (s.has(w.id)) return w.id;    // co-occupancy: old find() order
			return undefined;
		}
	};
}
