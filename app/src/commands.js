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
import { clone } from '../../document/ops.mjs';

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
		model.all('link').forEach((link) => {
			if (deletedLinks.has(link.id) || !Array.isArray(link.via)) return;
			const remaining = link.via.filter((w) => !deletedWaypoints.has(w));
			if (remaining.length !== link.via.length) {
				entries.push({ op: 'set', kind: 'link', id: link.id, after: { via: remaining } });
			}
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
		entries: clones.map((c) => ({ op: 'put', kind: c.kind, entity: c.entity }))
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
