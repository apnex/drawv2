/*
THE PRODUCT'S TENANTS of the planner (PL-3, dev/design/planner/PLANNER-SYSTEM.md section 6.2): GROUPS, which every
composition holds, and CLASSIC_LINKS, production's link tenant until promotion deletes it (PROMOTION.md).

Rows in the shape the core runs -- `{ id, phase, on, run(ctx, emit) }` -- emitting ops only; the core applies them as
they go and writes their inverses (PL-2).
*/
import { groupAfterRemoval } from '../engine/policy.mjs';
import { linkTenant } from '../model/link-reactions.mjs';

/*
Production's link tenant: the shared link reactions with production's conditions -- no stranded pass (a link that
loses a pin keeps the rest of its intent), only links reference anchors, and B162 and B216: an orphaned anchor
survives if its author pinned it or a link ended at it. A composition holds it or the network's, never both (PD-2).
*/
export const CLASSIC_LINKS = linkTenant({
	owner: 'classic links',
	keepsOrphan: (w, { wasBendOnly }) => !!w.pinned || !wasBendOnly,
	says: { sweep: 'only links reference an anchor, and a pinned anchor or a link\'s end is kept (B216)', join: 'at any waypoint' },
});

/*
A group loses a member: trimmed, or dissolved when it falls below two -- a reaction in the `clear` phase, so it runs
before ANY delete of a node or waypoint applies, whoever emitted it: a request, the waypoint cascade or the sweep.

ONE FUNCTION FOR EVERY PATH THAT REMOVES A MEMBER (B241). It lived as a closure inside `planDel`, so a
requested delete maintained membership and the orphan sweep -- the other path that deletes a
waypoint -- did not. The sweep left a group listing a waypoint that no longer existed, which
`violations()` cannot see and `validateDoc` refuses at the next boot. Two paths holding one duty is
how one of them forgets it.
*/
const GROUP_TRIM = {
	id: 'group-trim',
	phase: 'clear',
	doc: 'deleting a node or waypoint takes it out of its group, dissolving the group below two members -- whoever emitted the delete (B241)',
	on: (op) => op.kind === 'node' || op.kind === 'waypoint',
	run: ({ op, doc }, emit) => {
		const ops = [];
		for (const group of doc.all('group')) {
			if (!group.members.includes(op.id)) continue;
			const { remaining, dissolve } = groupAfterRemoval(group.members, (m) => m === op.id);
			ops.push(dissolve ? { op: 'del', kind: 'group', id: group.id } : { op: 'set', kind: 'group', id: group.id, patch: { members: remaining } });
		}
		emit(ops);
	},
};

/*
"A node belongs to at most one group" -- the rule existed ONLY in the browser (app/src/commands.js), so POST /groups
admitted a node to two groups. A group PUT steals its members from every other group: trimmed, or dissolved below two.
In the `follow` phase, after the put applies; the put group itself is skipped.
*/
const GROUP_STEAL = {
	id: 'group-steal',
	phase: 'follow',
	doc: 'putting a group takes its members from every other group, dissolving one left below two: a node belongs to one group',
	on: (op) => op.kind === 'group' && Array.isArray(op.entity.members),
	run: ({ op, doc }, emit) => {
		const { entity } = op;
		const ops = [];
		for (const other of doc.all('group')) {
			if (other.id === entity.id) continue;
			const kept = other.members.filter((m) => !entity.members.includes(m));
			if (kept.length === other.members.length) continue;
			const { remaining, dissolve } = groupAfterRemoval(other.members, (m) => entity.members.includes(m));
			ops.push(dissolve ? { op: 'del', kind: 'group', id: other.id } : { op: 'set', kind: 'group', id: other.id, patch: { members: remaining } });
		}
		emit(ops);
	},
};

export const GROUPS = { owner: 'groups', reactions: [GROUP_TRIM, GROUP_STEAL] };
