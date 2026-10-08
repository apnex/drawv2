/*
THE GROUPS PLUGIN'S RULES -- O-c (H19.20; dev/design/unification/KINDS-AS-PLUGINS.md): the group's planner tenant and the
policy it and the group's invariants ask. They were the planner's -- the tenant in planner/tenants.mjs, appended to every
composition until O-a put it on the group's row, and the threshold in planner/policy.mjs -- and are the plugin's now, beside
its row (groups/group-kind.mjs). Moved unchanged.

Rows in the shape the core runs -- `{ id, phase, trigger, run(ctx, emit) }` -- emitting ops only; the core applies them as
they go and writes their inverses (PL-2).
*/
import { ANCHOR_KINDS } from '../model/anchors.mjs';   // the bare anchor, asked in one place (F-b)

// A group after some members are removed: the survivors, and whether it must DISSOLVE
// (< 2 members ⇒ no longer a group). The single authority for the dissolve/trim threshold,
// shared by the delete cascade (client + server) and group-member stealing. `isRemoved` is a
// predicate over member ids so callers supply their own removed-set (a Set, a single id, …).
export function groupAfterRemoval(members, isRemoved) {
	const remaining = members.filter((m) => !isRemoved(m));
	return { remaining, dissolve: remaining.length < 2 };
}

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
	trigger: { deleted: [...ANCHOR_KINDS] },
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
	trigger: [{ created: ['group'] }, { changed: { kind: 'group', fields: ['members'] } }],
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
