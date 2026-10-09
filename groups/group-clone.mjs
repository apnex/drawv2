/*
WHAT FOLLOWS A CLONE, OF THE GROUPS PLUGIN'S -- C-e, step eight (H19.33; dev/design/unification/CANVAS-PLUGINS.md; D5).

A group ALL of whose members were cloned is cloned over the copies. It ranks 2, after the network's link (rank 1), so a member
the link pulled in -- a bend -- counts as cloned. It was the group pass of app/src/commands.js `cloneSubgraph`.
*/

import { makeGroup } from './make-group.mjs';

export const GROUP_FOLLOWER = {
	rank: 2,
	follow: ({ model, scratch, idMap, add }) => {
		for (const group of model.all('group')) {
			if (group.members.length > 0 && group.members.every((m) => idMap.has(m))) add('group', makeGroup(scratch, group.members.map((m) => idMap.get(m))));
		}
	},
};
