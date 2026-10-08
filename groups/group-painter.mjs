/*
THE GROUPS PLUGIN'S PAINTER -- C-a (H19.29; dev/design/unification/CANVAS-PLUGINS.md, D1): how a group is drawn on the page.

A group is a hull -- a rounded rect around its members' footprints, padded by the spec -- in the groups layer, behind the
links. It is not stacked by drawing order: a group carries none. It was the renderer's own branch (app/src/renderer.js `draw`,
`update`, `groupBox`, `groupLook`); it is the groups plugin's now, handed to the page in its canvas part. The renderer redraws
a group when a member moves by asking the core which entity gathers the member (`Model#gathererOf`), so it names no group.
The elements and every attribute are what the renderer built: the K8 DOM corpus holds that.
*/

import { L_STD } from '../kernel/spec.mjs';
import { TOKENS } from '../kernel/theme.mjs';
import { groupHull, spanExtent } from '../kernel/geometry.mjs';

// the hull: the box around its members' span-aware footprints, padded to the group's extent -- null when no member resolves,
// matching the kernel's empty-group guard; one authority shared with the export (kernel/geometry.mjs `groupHull`)
function groupBox(entity, model) {
	const members = entity.members.map((id) => model.endpointOf(id)).filter(Boolean)
		.map((m) => { const { sw, sh } = spanExtent(m.span); return { x: m.x, y: m.y, w: sw, h: sh }; });
	return groupHull(members, L_STD.group.ext);
}
const groupLook = (box) => ({ hull: { x: box.x, y: box.y, width: box.w, height: box.h } });
const GROUP_PARTS = { hull: (g) => g.querySelector('.group-hull') };

const GROUP_PAINTER = {
	kind: 'group',
	layer: 'groups',
	stacked: false,
	create(entity, { el, applyLook, layer, model }) {
		const box = groupBox(entity, model);
		if (!box) return null;   // no resolvable members, no hull
		const g = el('g', { id: entity.id, class: 'group' }, layer);
		el('rect', { class: 'group-hull', rx: L_STD.group.r, fill: 'none', stroke: TOKENS.group, 'stroke-width': 1.1 }, g);
		applyLook(g, groupLook(box), GROUP_PARTS);
		return g;
	},
	update(entity, dom, { applyLook, model }) {
		const box = groupBox(entity, model);
		if (!box) return 'remove';   // shrank below a member: drop the hull
		if (!dom.querySelector('.group-hull')) return 'rerender';
		applyLook(dom, groupLook(box), GROUP_PARTS);
		return undefined;
	},
};

// the groups plugin's canvas part (C-a: its painter)
export const GROUPS_CANVAS = { owner: 'groups', painters: [GROUP_PAINTER] };
