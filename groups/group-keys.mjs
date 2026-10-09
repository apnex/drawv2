/*
THE GROUPS PLUGIN'S KEYS -- C-e, step five (H19.33; dev/design/unification/CANVAS-PLUGINS.md; D5: a plugin's edits are data).

Ctrl+G groups the selected anchors -- at least two, or nothing -- and leaves the selection as it was; Ctrl+Shift+G removes every
group a selected anchor belongs to. Each hands its edit to the host's generic verbs (`put`, `remove`), asking the Model which
group gathers an anchor through `ask`. They were app/src/keymap.js `group` and `ungroup`, app/src/input.js `onGroupKey` and
`onUngroupKey`, app/src/commands.js `createGroup` and `ungroupAll`. The planner's `group-steal` takes a member from any other
group, as before.
*/

import { ANCHOR_KINDS } from '../model/anchors.mjs';
import { makeGroup } from './make-group.mjs';
import { groupOf } from './group-of.mjs';

const meta = (e) => e.ctrlKey || e.metaKey;
const isG = (e) => e.key.toLowerCase() === 'g';
// the selected anchors -- nodes and waypoints, the entities a group gathers
const anchorsSelected = (host) => host.selected().filter((e) => ANCHOR_KINDS.includes(e.kind) && e.x !== undefined).map((e) => e.id);

const GROUP = {
	id: 'group', input: ['Ctrl+G'], mutates: true, doc: 'group the selection',
	on: (e) => meta(e) && isG(e) && !e.shiftKey,
	run: (host) => {
		const members = anchorsSelected(host);
		if (members.length < 2) return;
		host.put('group', 'group', (model) => makeGroup(model, members));
	},
};

const UNGROUP = {
	id: 'ungroup', input: ['Ctrl+Shift+G'], mutates: true, doc: 'ungroup',
	on: (e) => meta(e) && isG(e) && e.shiftKey,
	run: (host) => {
		const ids = anchorsSelected(host);
		const groups = host.ask((model) => [...new Set(ids.map((id) => groupOf(model, id)).filter(Boolean).map((g) => g.id))]);
		host.remove('ungroup', groups.map((id) => ({ kind: 'group', id })));
	},
};

export const GROUP_KEYS = [GROUP, UNGROUP];
