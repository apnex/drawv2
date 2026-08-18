/*
Commands — every committed user action is a command: a list of primitive entries
applied to the model, each invertible. History is a bounded undo/redo stack.

Entry ops:
  { op: 'put', kind, entity }                  do: put     undo: del
  { op: 'del', kind, entity }                  do: del     undo: put
  { op: 'set', kind, id, before, after }       do: set(after)  undo: set(before)
*/

import { groupAfterRemoval } from '../../engine/index.mjs';

// entities are cloned at every command boundary: the live store object must never
// alias a history entry, or later in-place model.set mutations rewrite history
function clone(entity) {
	const copy = { ...entity };
	if (copy.members) copy.members = [...copy.members];
	if (copy.via) copy.via = [...copy.via];
	if (copy.span) copy.span = { ...copy.span };   // node footprint — own object per history entry (W1)
	if (copy.content) copy.content = copy.content.map((r) => ({ ...r, ...(r.at ? { at: [...r.at] } : {}) }));   // content regions (W2)
	return copy;
}

function applyEntry(model, entry, forward) {
	if (entry.op === 'put') {
		forward ? model.put(entry.kind, clone(entry.entity)) : model.del(entry.kind, entry.entity.id);
	} else if (entry.op === 'del') {
		forward ? model.del(entry.kind, entry.entity.id) : model.put(entry.kind, clone(entry.entity));
	} else if (entry.op === 'set') {
		model.set(entry.kind, entry.id, forward ? entry.after : entry.before);
	}
}

export class History {
	constructor(model, limit = 100) {
		this.model = model;
		this.limit = limit;
		this.stack = [];
		this.index = 0; // entries below index are undoable
	}

	// apply a command and push it onto the stack
	commit(command) {
		if (!command || command.entries.length === 0) return;
		command.entries.forEach((entry) => applyEntry(this.model, entry, true));
		this.stack.length = this.index; // drop redo tail
		this.stack.push(command);
		if (this.stack.length > this.limit) this.stack.shift();
		this.index = this.stack.length;
	}

	canUndo() { return this.index > 0; }
	canRedo() { return this.index < this.stack.length; }

	// history never crosses a diagram boundary
	clear() {
		this.stack = [];
		this.index = 0;
	}

	undo() {
		if (!this.canUndo()) return;
		const command = this.stack[--this.index];
		[...command.entries].reverse().forEach((entry) => applyEntry(this.model, entry, false));
	}

	redo() {
		if (!this.canRedo()) return;
		const command = this.stack[this.index++];
		command.entries.forEach((entry) => applyEntry(this.model, entry, true));
	}
}

// ---- command builders ----

export function createEntity(kind, entity) {
	return { label: `create ${kind}`, entries: [{ op: 'put', kind, entity: clone(entity) }] };
}

// moves: [{ kind: 'node'|'zone', id, before: {x,y}, after: {x,y} }]
export function moveEntities(moves) {
	return {
		label: 'move',
		entries: moves.map((m) => ({
			op: 'set', kind: m.kind, id: m.id,
			before: { x: m.before.x, y: m.before.y },
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
				entries.push({ op: 'set', kind: 'link', id: link.id, before: { via: [...link.via] }, after: { via: remaining } });
			}
		});
	}

	// entry order matters: undo replays REVERSED, and the server validates
	// referentially — so dependents (groups, zones, links) are deleted first and
	// therefore restored LAST, after their nodes exist again
	model.all('group').forEach((group) => {
		const { remaining, dissolve } = groupAfterRemoval(group.members, (m) => deletedNodes.has(m) || deletedWaypoints.has(m));
		if (ids.has(group.id) || dissolve) {
			entries.push({ op: 'del', kind: 'group', entity: clone(group) });
		} else if (remaining.length < group.members.length) {
			entries.push({
				op: 'set', kind: 'group', id: group.id,
				before: { members: [...group.members] },
				after: { members: remaining }
			});
		}
	});
	ids.forEach((id) => {
		if (model.get('zone', id)) entries.push({ op: 'del', kind: 'zone', entity: clone(model.get('zone', id)) });
	});
	deletedLinks.forEach((id) => entries.push({ op: 'del', kind: 'link', entity: clone(model.get('link', id)) }));
	deletedNodes.forEach((id) => entries.push({ op: 'del', kind: 'node', entity: clone(model.get('node', id)) }));
	// waypoints last (leaf entities → restored FIRST on undo, before via-restore + link-restore)
	deletedWaypoints.forEach((id) => entries.push({ op: 'del', kind: 'waypoint', entity: clone(model.get('waypoint', id)) }));

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
			entries.push({ op: 'del', kind: 'group', entity: clone(group) });
		} else {
			entries.push({
				op: 'set', kind: 'group', id: group.id,
				before: { members: [...group.members] },
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
	return { label: 'edit', entries: [{ op: 'set', kind: 'node', id: nodeId, before: { content: before }, after: { content: after } }] };
}

// toggle each selected node's frame shape (circle <-> square) — one undoable command. Non-node ids and
// missing nodes are skipped (model.get returns undefined).
export function reshapeNodes(model, ids) {
	const entries = ids.map((id) => model.get('node', id)).filter(Boolean).map((n) => {
		const before = n.shape || 'circle';
		return { op: 'set', kind: 'node', id: n.id, before: { shape: before }, after: { shape: before === 'square' ? 'circle' : 'square' } };
	});
	return { label: 'reshape', entries };
}

export function renameEntity(kind, id, before, after) {
	return {
		label: 'rename',
		entries: [{ op: 'set', kind, id, before: { name: before }, after: { name: after } }]
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

export function ungroup(model, groupId) {
	return ungroupAll(model, [groupId]);
}

// one undoable command covering every group being dissolved
export function ungroupAll(model, groupIds) {
	const entries = [];
	groupIds.forEach((id) => {
		const group = model.get('group', id);
		if (group) entries.push({ op: 'del', kind: 'group', entity: clone(group) });
	});
	return { label: 'ungroup', entries };
}
