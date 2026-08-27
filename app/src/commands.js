/*
Commands — request builders. Every committed user action becomes a command: a label and a list of
entries describing the FORWARD intent. app/src/changes.js applies them locally and submits them.

  { op: 'put', kind, entity }        create or replace
  { op: 'del', kind, entity }        remove (the entity rides along for the local apply)
  { op: 'set', kind, id, after }     change these fields

No entry carries `before` any more. The inverse is derived server-side by the planner, which is the
only place that holds the pre-state at the moment each op is decided — so computing it here was
both duplicated and, for anything the server cascades, incomplete.

The cascade closures below survive on purpose. They are a LOCAL PROJECTION: a disconnected browser
must not build a document whose links dangle, and the server's planner re-derives the same cascade
idempotently over the explicit ops (an already-deleted link yields no further op). What went is the
inverse-building, not the closure.
*/

import { groupAfterRemoval } from '../../engine/index.mjs';
import { clone } from '../../model/ops.mjs';
import { kindOf, newId, projection } from '../../model/index.mjs';
import { isStraight, pairKey } from '../../model/invariants.mjs';
import { GAP, HALF, ZONE_EXT, clampDelta } from './snap.js';
import { SPAN_MAX } from '../../model/limits.mjs';

// entities are cloned at every command boundary: the live store object must never
// alias a history entry, or later in-place model.set mutations rewrite history
// ---- command builders ----

export function createEntity(kind, entity) {
	return { label: `create ${kind}`, entries: [{ op: 'put', kind, entity: clone(kind, entity) }] };
}

// moves: [{ kind: 'node'|'zone', id, after: {x,y} }]
export function moveEntities(moves) {
	return {
		label: 'move',
		entries: moves.map((m) => ({
			op: 'set', kind: m.kind, id: m.id,
			after: { x: m.after.x, y: m.after.y }
		}))
	};
}

/*
Delete a mixed selection. Computes the full closure so undo restores everything:
 - selected nodes, zones, links
 - links touching a deleted node (cascade)
 - groups: deleted members removed; group dissolves below 2 members
*/
export function deleteSelection(model, ids) {
	const entries = [];
	const deletedNodes = new Set();
	const deletedLinks = new Set();
	const deletedWaypoints = new Set();

	ids.forEach((id) => {
		if (model.get('node', id)) deletedNodes.add(id);
		if (model.get('waypoint', id)) deletedWaypoints.add(id);
	});

	// cascade: links touching a deleted node OR a deleted waypoint-ENDPOINT, plus selected links
	// (a deleted waypoint used only as a via bend is handled by the via-strip below)
	model.all('link').forEach((link) => {
		if (ids.has(link.id) || deletedNodes.has(link.src) || deletedNodes.has(link.dst)
			|| deletedWaypoints.has(link.src) || deletedWaypoints.has(link.dst)) {
			deletedLinks.add(link.id);
		}
	});

	// strip deleted waypoints from SURVIVING links' via FIRST, so the doc never references a
	// missing waypoint (links being deleted carry their via away). On undo (reversed) the via is
	// restored LAST — after the waypoint is put back (waypoint dels are last → restored first).
	if (deletedWaypoints.size) {
		/*
		B81, mirroring server/txn.mjs: a strip that would leave a link STRAIGHT is a deletion
		instead when the pair already carries a straight link, because only one may exist. This is
		a local projection of the server's rule, like the rest of this cascade -- the server is
		authoritative and its planner refuses the state outright, so a client that guessed wrong
		would see its optimistic view corrected rather than a wrong document persisted.
		*/
		const straightPairs = new Set();
		model.all('link').forEach((l) => {
			if (deletedLinks.has(l.id) || !isStraight(l)) return;
			straightPairs.add(pairKey(l));
		});
		model.all('link').forEach((link) => {
			if (deletedLinks.has(link.id) || !Array.isArray(link.via)) return;
			const remaining = link.via.filter((w) => !deletedWaypoints.has(w));
			if (remaining.length === link.via.length) return;
			if (remaining.length === 0 && straightPairs.has(pairKey(link))) {
				entries.push({ op: 'del', kind: 'link', entity: clone('link', link) });
				return;
			}
			if (remaining.length === 0) straightPairs.add(pairKey(link));
			entries.push({ op: 'set', kind: 'link', id: link.id, after: { via: remaining } });
		});
	}

	// entry order matters: undo replays REVERSED, and the server validates
	// referentially — so dependents (groups, zones, links) are deleted first and
	// therefore restored LAST, after their nodes exist again
	model.all('group').forEach((group) => {
		const { remaining, dissolve } = groupAfterRemoval(group.members, (m) => deletedNodes.has(m) || deletedWaypoints.has(m));
		if (ids.has(group.id) || dissolve) {
			entries.push({ op: 'del', kind: 'group', entity: clone('group', group) });
		} else if (remaining.length < group.members.length) {
			entries.push({
				op: 'set', kind: 'group', id: group.id,
				after: { members: remaining }
			});
		}
	});
	ids.forEach((id) => {
		if (model.get('zone', id)) entries.push({ op: 'del', kind: 'zone', entity: clone('zone', model.get('zone', id)) });
	});
	deletedLinks.forEach((id) => entries.push({ op: 'del', kind: 'link', entity: clone('link', model.get('link', id)) }));
	deletedNodes.forEach((id) => entries.push({ op: 'del', kind: 'node', entity: clone('node', model.get('node', id)) }));
	// waypoints last (leaf entities → restored FIRST on undo, before via-restore + link-restore)
	deletedWaypoints.forEach((id) => entries.push({ op: 'del', kind: 'waypoint', entity: clone('waypoint', model.get('waypoint', id)) }));

	return { label: 'delete', entries };
}

export function createGroup(model, memberIds) {
	// a node belongs to at most one group: steal members from existing groups
	const entries = [];
	const members = memberIds.filter((id) => model.endpointOf(id));
	if (members.length < 2) return { label: 'group', entries: [] };

	model.all('group').forEach((group) => {
		const { remaining, dissolve } = groupAfterRemoval(group.members, (m) => members.includes(m));
		if (remaining.length === group.members.length) return;
		if (dissolve) {
			entries.push({ op: 'del', kind: 'group', entity: clone('group', group) });
		} else {
			entries.push({
				op: 'set', kind: 'group', id: group.id,
				after: { members: remaining }
			});
		}
	});

	entries.push({ op: 'put', kind: 'group', entity: model.makeGroup(members) });
	return { label: 'group', entries };
}

// W6 — live input editing: write a new value into a node's content region (idx). Deep-copies the whole
// content array (regions are objects in an array) so before/after are independent history snapshots.
export function setContentValue(model, nodeId, idx, value) {
	const node = model.get('node', nodeId);
	if (!node || !Array.isArray(node.content) || !node.content[idx]) return { label: 'edit', entries: [] };
	const dup = (c) => c.map((r) => ({ ...r, ...(r.at ? { at: [...r.at] } : {}) }));
	const before = dup(node.content);
	const after = dup(node.content);
	after[idx].value = value;
	return { label: 'edit', entries: [{ op: 'set', kind: 'node', id: nodeId, after: { content: after } }] };
}

// toggle each selected node's frame shape (circle <-> square) — one undoable command. Non-node ids and
// missing nodes are skipped (model.get returns undefined).
export function reshapeNodes(model, ids) {
	const entries = ids.map((id) => model.get('node', id)).filter(Boolean).map((n) => {
		const before = n.shape || 'circle';
		return { op: 'set', kind: 'node', id: n.id, after: { shape: before === 'square' ? 'circle' : 'square' } };
	});
	return { label: 'reshape', entries };
}

export function renameEntity(kind, id, before, after) {
	return {
		label: 'rename',
		entries: [{ op: 'set', kind, id, after: { name: after } }]
	};
}

// clone a subgraph: entries are puts of already-materialized clone entities
// (built by input.js during the drag); commit re-applies them idempotently
export function cloneEntities(clones) {
	return {
		label: 'clone',
		entries: clones.map((c) => ({ op: 'put', kind: c.kind, entity: clone(c.kind, c.entity) }))
	};
}

// one undoable command covering every group being dissolved
export function ungroupAll(model, groupIds) {
	const entries = [];
	groupIds.forEach((id) => {
		const group = model.get('group', id);
		if (group) entries.push({ op: 'del', kind: 'group', entity: clone('group', group) });
	});
	return { label: 'ungroup', entries };
}

// ---- H6.2 Tier B: the last six, previously built by hand inside input.js (B44) ----
// They lived there because each is a one-liner at its call site. That is exactly why they drifted:
// four carried a dead `before` and two aliased the live store through a shallow spread, both against
// rules stated at the top of THIS file. A builder cannot disagree with its own module.

// drag a zone corner: the committed geometry (the live preview already wrote it; history owns the edit)
export function resizeZone(id, after) {
	return { label: 'resize', entries: [{ op: 'set', kind: 'zone', id, after: { x: after.x, y: after.y, w: after.w, h: after.h } }] };
}

// Shift+arrow: grow/shrink the lone selected node's span one cell (W1). Same 'resize' label as the
// zone path on purpose — one coalescing window covers a burst of either (D11).
export function resizeNodeSpan(id, span) {
	return { label: 'resize', entries: [{ op: 'set', kind: 'node', id, after: { span: { cols: span.cols, rows: span.rows } } }] };
}

// re-plug: rewire one end of a link onto another node
export function replugLink(id, src, dst) {
	return { label: 'replug', entries: [{ op: 'set', kind: 'link', id, after: { src, dst } }] };
}

// fast-replace: retype a node in place — id/name/links/position survive
export function retypeNode(id, type) {
	return { label: 'retype', entries: [{ op: 'set', kind: 'node', id, after: { type } }] };
}

// C — close/open a multi-hop route. The label states which way it went, so undo reads correctly.
export function toggleClosed(link) {
	const closed = !link.closed;
	return { label: closed ? 'close path' : 'open path', entries: [{ op: 'set', kind: 'link', id: link.id, after: { closed } }] };
}

/*
L / Shift+L — wire the selected nodes with no pointer travel. L chains them in selection order;
Shift+L stars the first to every other. Existing pairs are skipped.

Built against a projection, and the duplicate check is why. `input.js` had to put each new link into
the LIVE model as it went, because `linkBetween` is what skips an existing pair and it reads the
model — so a selection like [a, b, a] would author a-b twice if the first were not already there.
That is a second, independent reason for the same eager put the clone path needed, and the same
scratch removes it.
*/
export function linkNodes(model, nodeIds, star) {
	const scratch = projection(model);
	const pairs = star
		? nodeIds.slice(1).map((n) => [nodeIds[0], n])
		: nodeIds.slice(0, -1).map((n, i) => [n, nodeIds[i + 1]]);
	const created = [];
	pairs.forEach(([a, b]) => {
		if (a === b || scratch.linkBetween(a, b)) return;   // skip self + existing, INCLUDING this batch
		const link = scratch.makeLink(a, b);
		scratch.put('link', link);
		created.push(link);
	});
	return { label: star ? 'star' : 'chain', entries: created.map((l) => ({ op: 'put', kind: 'link', entity: clone('link', l) })) };
}

// a finished route: the materialised waypoints AND the link as one undo step, waypoints first so the
// link never references a bend that does not exist yet.
export function routeLink(placed, link) {
	return {
		label: isStraight(link) ? 'link' : 'route',
		entries: [
			...(placed || []).map((wp) => ({ op: 'put', kind: 'waypoint', entity: clone('waypoint', wp) })),
			{ op: 'put', kind: 'link', entity: clone('link', link) }
		]
	};
}

/*
One hop of a chained link run -- B147.

`routeLink` above maps everything in `placed` to `kind: 'waypoint'`, which is right for what it was
built for and wrong for a hop: a hop lands on a NODE. Passing the node through that list produced a
`put/waypoint` carrying a node's fields, which the browser applied happily and the server refused
with `commit rejected - invalid` -- caught by the director in the editor, not by any test here.

So the kinds are named rather than assumed. The waypoints threaded into this segment, the node the
segment lands on, and the link, as ONE entry list: undoing a chain should step back one hop, not
unpick a node from its link.
*/
export function chainHop(waypoints, node, link) {
	return {
		label: 'chain',
		entries: [
			...(waypoints || []).map((wp) => ({ op: 'put', kind: 'waypoint', entity: clone('waypoint', wp) })),
			{ op: 'put', kind: 'node', entity: clone('node', node) },
			{ op: 'put', kind: 'link', entity: clone('link', link) },
		],
	};
}

// ---- document metadata. `meta` is a single record, so these patch it rather than an entity. ----
// Both were written out by hand in sync.js — the second copy is why this
// exists as a builder rather than a third literal.

export function renameDocument(name) {
	return { label: 'rename', entries: [{ op: 'meta', patch: { name } }] };
}


/*
---- H6.9 / B46: builders that COMPUTE, not just shape ----

These four were written inside input.js, where they read as gesture code because a key press is what
triggers them. None of them touches `mode`, `ctx` or an event: each takes the model and a selection
and answers "what change does this intent produce". That is this module's sentence, so they belong
here — the same argument as B44, in the form GR16 cannot see, because they called a builder rather
than writing a `{label, entries}` literal.

They self-guard and return EMPTY ENTRIES when there is nothing to do, following `createGroup` and
`reshapeNodes`. `Changes.commit` and `Changes.amend` both no-op on an empty command, so a caller
never needs a guard of its own — which is what lets the call sites collapse to one line.
*/

// Z — fit a zone around the selection: the bounding box, snapped OUT to the zone grid (±HALF + k·GAP)
// and clamped to the canvas. Link-only or empty selections produce nothing.
export function wrapSelection(model, ids) {
	let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, boxed = 0;
	ids.forEach((id) => {
		const e = model.get(kindOf(id), id);
		if (!e || e.x === undefined) return;
		minX = Math.min(minX, e.x); minY = Math.min(minY, e.y);
		maxX = Math.max(maxX, e.x + (e.w || 0)); maxY = Math.max(maxY, e.y + (e.h || 0));
		boxed++;
	});
	if (boxed === 0) return { label: 'create zone', entries: [] };
	const floorZ = (v) => Math.floor((v - HALF) / GAP) * GAP + HALF;
	const ceilZ = (v) => Math.ceil((v - HALF) / GAP) * GAP + HALF;
	const x = Math.max(floorZ(minX - HALF), -ZONE_EXT.x);
	const y = Math.max(floorZ(minY - HALF), -ZONE_EXT.y);
	const x2 = Math.min(ceilZ(maxX + HALF), ZONE_EXT.x);
	const y2 = Math.min(ceilZ(maxY + HALF), ZONE_EXT.y);
	return createEntity('zone', model.makeZone({ x, y, w: Math.max(x2 - x, GAP), h: Math.max(y2 - y, GAP) }));
}

// arrow keys — shift the movable part of the selection one cell, clamped so nothing leaves the canvas
export function nudgeSelection(model, ids, dx, dy) {
	const moved = [];
	ids.forEach((id) => {
		const kind = kindOf(id);
		if (kind !== 'node' && kind !== 'zone' && kind !== 'waypoint') return;
		const e = model.get(kind, id);
		if (e) moved.push({ kind, id, before: { x: e.x, y: e.y } });
	});
	if (moved.length === 0) return { label: 'move', entries: [] };
	const delta = clampDelta(model, moved, { x: dx * GAP, y: dy * GAP });
	if (delta.x === 0 && delta.y === 0) return { label: 'move', entries: [] };
	return moveEntities(moved.map((m) => ({
		kind: m.kind, id: m.id, after: { x: m.before.x + delta.x, y: m.before.y + delta.y },
	})));
}

// Shift+arrow on a LONE zone — NW corner fixed, minimum one cell, clamped to the canvas
export function resizeZoneStep(model, ids, dx, dy) {
	const none = { label: 'resize', entries: [] };
	if (ids.length !== 1 || kindOf(ids[0]) !== 'zone') return none;
	const zone = model.get('zone', ids[0]);
	if (!zone) return none;
	const w = Math.min(Math.max(zone.w + dx * GAP, GAP), ZONE_EXT.x - zone.x);
	const h = Math.min(Math.max(zone.h + dy * GAP, GAP), ZONE_EXT.y - zone.y);
	if (w === zone.w && h === zone.h) return none;
	return resizeZone(zone.id, { x: zone.x, y: zone.y, w, h });
}

// Shift+arrow on a LONE node — grow its span one cell (W1). Origin fixed, capped at the validator's 64.
export function resizeNodeStep(model, ids, dx, dy) {
	const none = { label: 'resize', entries: [] };
	if (ids.length !== 1 || kindOf(ids[0]) !== 'node') return none;
	const node = model.get('node', ids[0]);
	if (!node) return none;
	const cur = node.span || { cols: 1, rows: 1 };
	const cols = Math.min(Math.max(cur.cols + dx, 1), SPAN_MAX);
	const rows = Math.min(Math.max(cur.rows + dy, 1), SPAN_MAX);
	if (cols === cur.cols && rows === cur.rows) return none;
	return resizeNodeSpan(node.id, { cols, rows });
}

/*
Clone a subgraph — the closure, computed against a PROJECTION so nothing real is touched.

This was `input.js#cloneClosure`, where it had to `put` each copy into the live model as it went.
That put was doing allocation, not authoring: `newId` reads the collection, `nextName` rebuilds its
set from the model, and both go wrong for sibling k if k-1 is not there yet. Proven by removing the
puts and cloning three hosts — `[host-4, host-4, host-4]`. A scratch projection gives the batch a
namespace that already contains itself, which is the same trick `server/txn.mjs` plans with.

What comes back is inert: plain entities in no model at all. MATERIALISING them is the caller's
decision and the two callers differ, which is exactly why it does not belong in here. A clone DRAG
puts them live so they render under the pointer (INPUT.md I-IN5 — live preview writes the shared
Model); Ctrl+D never shows them and goes straight to a commit.
*/
export function cloneSubgraph(model, seedIds) {
	const scratch = projection(model);       // allocate against a namespace that includes the batch
	const idMap = new Map();
	const clones = [];

	// One cloner per placeable kind. A waypoint is `{id, x, y}` and nothing else
	// (server/validate.js FIELDS.waypoint), so it must NOT be given a name — inventing a field the
	// server rejects makes the clone apply locally and then be refused on the wire.
	const cloneEntity = (kind, src) => {
		const copy = { ...src, id: newId(kind, scratch.collection(kind)) };
		if (kind === 'node') copy.name = scratch.nextName(src.type);
		else if (kind === 'zone') copy.name = scratch.nextName('zone');
		idMap.set(src.id, copy.id);
		scratch.put(kind, copy);             // the THROWAWAY, so sibling k+1 can see it
		clones.push({ kind, entity: copy });
		return copy;
	};

	seedIds.forEach((id) => {
		const kind = kindOf(id);
		if (kind !== 'node' && kind !== 'zone' && kind !== 'waypoint') return;   // B30: waypoints are placeable
		const src = model.get(kind, id);
		if (src) cloneEntity(kind, src);
	});
	if (idMap.size === 0) return null;

	/*
	Links whose BOTH endpoints were cloned — carrying the route, not just the ends (B30).

	A link's `via` list and its `closed` flag are authored geometry: dropping them turns a multi-hop
	route into a straight line silently, which is loss of intent rather than a cosmetic difference.
	Any via waypoint not already in the clone set is pulled in here, because a cloned route needs its
	OWN bends — pointing the copy at the originals would make two links share them, which the
	validator forbids outright (a waypoint belongs to at most one link, in at most one role).
	*/
	model.all('link').forEach((link) => {
		if (!idMap.has(link.src) || !idMap.has(link.dst) || idMap.has(link.id)) return;
		const via = Array.isArray(link.via) ? link.via : [];
		via.forEach((wid) => {
			if (idMap.has(wid)) return;
			const w = model.get('waypoint', wid);
			if (w) cloneEntity('waypoint', w);
		});
		const copy = { id: newId('link', scratch.collection('link')), src: idMap.get(link.src), dst: idMap.get(link.dst) };
		const mapped = via.map((wid) => idMap.get(wid)).filter(Boolean);
		if (mapped.length) copy.via = mapped;
		if (link.closed) copy.closed = true;
		idMap.set(link.id, copy.id);
		scratch.put('link', copy);
		clones.push({ kind: 'link', entity: copy });
	});

	// groups fully contained in the clone set
	model.all('group').forEach((group) => {
		if (group.members.length > 0 && group.members.every((m) => idMap.has(m))) {
			const copy = scratch.makeGroup(group.members.map((m) => idMap.get(m)));
			scratch.put('group', copy);
			clones.push({ kind: 'group', entity: copy });
		}
	});
	return { clones, idMap };
}
