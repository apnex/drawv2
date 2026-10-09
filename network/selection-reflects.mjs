/*
WHAT A SELECTION LIGHTS BEYOND ITSELF, OF THE NETWORK'S -- C-e, step fourteen (H19.33; dev/design/unification/CANVAS-PLUGINS.md).
Each is a class and the ids it marks given the Model and the selection; the renderer marks and unmarks them (they were its own,
app/src/renderer.js `reflectPathSelection` and `reflectBlockers`).

A SELECTED PATH LIGHTS ITS OWN WAYPOINTS -- `on-selected-path` -- ends and bends alike. Selecting a link turns it green; its
waypoints kept the link colour, so a green line ran through blue rings to blue pads, the path and what it is made of disagreeing
about whether they are selected; a bend's ring sits ON the line, so a blue ring round a green path reads as a foreign object. A
separate class from `selected`: these waypoints are not themselves selected -- a delete of the selection must not take them, and
their own brackets stay off. Kept across a redraw, as the selected look is. Client-only: the SVG export receives no selection.

THE LINKS BLOCKING A SELECTED DOWN LINK -- `blocking` -- ruled 2026-09-30: "when I select a down/broken link that cannot be healed
due to another link occupying my preferred path, also highlight that blocking link in orange so I can see the path that is
blocking". The network says who blocks (`blockersOf`). Marked afresh at every reflection, which the network asks for after each
edit, since an edit can change who blocks whom (network/host.mjs).
*/

import { isLinkDown, blockersOf } from './network-queries.mjs';
import { bareAnchor } from '../devices/device-shapes.mjs';

export const NETWORK_REFLECTS = [
	{ cls: 'on-selected-path', keeps: true, of: (model, selected) => {
		const lit = new Set();
		for (const id of selected) {
			const link = model.get('link', id);
			if (!link) continue;
			for (const w of [link.src, link.dst, ...(link.via || [])]) if (bareAnchor(model, w)) lit.add(w);
		}
		return lit;
	} },
	{ cls: 'blocking', of: (model, selected) => {
		const blocking = new Set();
		for (const id of selected) {
			const link = model.get('link', id);
			if (link && isLinkDown(model, link)) for (const by of blockersOf(model, link)) blocking.add(by);
		}
		return blocking;
	} },
];
