/*
THE GROUPS PLUGIN'S KIND -- O-c (H19.20; dev/design/unification/KINDS-AS-PLUGINS.md; O1, O3).

A group is a named set of nodes, selected together and never alone. It was the core's kind -- its storage facts in
model/shape.mjs, its checks, its cross-entity check and its invariants in planner/kinds.mjs, its rules and policy in the
planner, its factory and lookup on the Model -- and is this plugin's now, whole. The product composes it after the node and
the zones plugin's kind (product/kinds.mjs `productKinds`), so a document lists its collections as it always has. Its fields
are what they were as the product's row: only the owner moved.

`gathers: 'members'` is the one thing the core does for a group, and it does it for any kind that opts in (model/shape.mjs):
the entity listing an id is found (`Model#gathererOf`), and selecting the id selects the whole list -- the 2026-10-02
ruling's "a group's membership is stated in those terms, not by naming kinds".
*/

import { NAME_MAX } from '../model/limits.mjs';
import { GROUPS, groupAfterRemoval } from './group-rules.mjs';

// the checks are LOCAL, as every row's are: the trust boundary is never delegated (model/shape.mjs, B110, B113)
const str = (v, max) => typeof v === 'string' && v.length <= max;
const id = (v, kind) => typeof v === 'string' && new RegExp(`^${kind}-[0-9a-f]{6}$`).test(v);

// B113: 2000, as it was among the product's unpositioned kinds (planner/policy.mjs) -- a group has no anchor of its own
const GROUP_CAP = 2000;

/*
O-a (H19.18; KINDS-AS-PLUGINS.md) -- THE GROUP'S INVARIANTS, ITS OWN. They were the core's (model/invariants.mjs) and the policy
was injected by each caller; the row asks the policy itself (groups/group-rules.mjs since O-c), so no caller can run them without it. Moved whole,
reported in the order they were: B82, then B85, then the link's straight pairs, then occupancy.
*/
function groupInvariants(model, report) {
	/*
	B82 -- no entity is a member of two groups.

	The rule already existed, in `planPut`, as a repair: putting a group STEALS overlapping members
	from any other. But a repair attached to one op kind is not a property of the document, and
	`planSet` has no group handling at all, so a `set` patching `members` walked past it. The
	document that results does not merely look wrong, it MEANS different things to the two peers:
	the client's relational index declares membership single-valued and answers last-write-wins,
	while the server has no index and falls back to a first-match scan. `groupOf` drives selection
	expansion and the renderer hull, so a click selects one thing in the browser and another on the
	server, and neither is wrong by its own reading.
	*/
	const owner = new Map();
	for (const g of model.all('group')) {
		for (const m of new Set(g.members || [])) {
			const held = owner.get(m);
			if (held && held !== g.id) report(`${m} is a member of both ${held} and ${g.id}`, `two-groups:${m}`);
			else owner.set(m, g.id);
		}
	}
	/*
	B85 -- a group holds at least two distinct members.

	The threshold is NOT restated here: `groupAfterRemoval` (groups/group-rules.mjs) is the single authority for it, and asking whether a group would
	dissolve with NOTHING removed is the same question as whether it is under the minimum, phrased in the vocabulary that
	owns the number. It was injected into model/invariants.mjs by each caller, and skipped when one passed none; the row
	asks the policy itself since O-a, so no caller runs the group's invariants without it.
	*/
	for (const g of model.all('group')) {
		const members = g.members || [];
		const distinct = [...new Set(members)];
		if (distinct.length !== members.length) report(`${g.id} lists the same member twice`, `repeated-member:${g.id}`);
		if (groupAfterRemoval(distinct, () => false).dissolve) {
			report(`${g.id} holds ${distinct.length} member(s), too few to be a group`, `too-few:${g.id}`);
		}
	}
}

const GROUP_ROW = {
	kind: 'group',
	owner: 'groups',
	collection: 'groups',
	selectable: false,   // a group is selected through its members, never directly
	named: true,
	anchor: false,
	composite: ['members'],
	optional: [],
	references: ['node'],
	gathers: 'members',
	fields: {
		id: (v) => id(v, 'group'),
		name: (v) => str(v, NAME_MAX),
		members: (v) => Array.isArray(v) && v.length <= 500 && v.every((m) => id(m, 'node'))
	},
	// a group's members must exist -- nodes, typed or not; a group of groups does not (B83). It was model/referential.mjs's,
	// beside the link's rules; those left for the network at S-e, and the check needs only the generic access
	refers: (entity, access, patch) => {
		if (!patch.members) return null;
		for (const m of Array.isArray(entity.members) ? entity.members : []) if (!access.has('node', m)) return `group member does not exist: ${m}`;
		return null;
	},
	invariants: groupInvariants,
	tenant: GROUPS,
	cap: GROUP_CAP,
};

// the groups plugin's rows, as the network's are NETWORK_ROWS (network/kinds.mjs)
export const GROUP_ROWS = [GROUP_ROW];
