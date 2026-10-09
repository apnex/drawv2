/*
WHAT THE READOUT SAYS OF A LINK, AND WHAT CTRL+A TAKES -- the network's. C-e, step ten (H19.33; dev/design/unification/CANVAS-PLUGINS.md section 3: "a kind's description ... whether select-all takes
it"). The selection line's words for this plugin's kind (`describe`), with the readout's formatters -- a place `pair`, its
offset from the datum `rel`, a size `dims` -- and the Model; and what Ctrl+A takes of it (`selectAll`), ranked so Ctrl+A selects
in the order it always has (devices, zones, links) and its help line names the kinds in that order.
A link reads as its two ends -- an anchor is a node or a waypoint (B29); a waypoint has no name, so it reads as its place -- with
its DECLARED DIRECTION between them, persistent state rather than a receipt (B229): `<->` for undeclared, a symmetric link carrying
flow both ways; and its PLANE, said when it is the control plane, a data link being the ordinary case (H15.15). Ctrl+A takes every
link. They were app/src/readout.js `selectionText` and app/src/input.js `onSelectAll`.
*/

import { linkMarker } from './appearance.mjs';

export const LINK_DESCRIBE = [{
	kind: 'link',
	line: (l, f) => {
		const nameOf = (id) => { const e = f.model.endpointOf(id); return e ? (e.name || f.pair(e.x, e.y)) : '?'; };
		const head = linkMarker(l);
		const bar = head === 'end' ? '>>>' : head === 'start' ? '<<<' : '<->';
		return `${nameOf(l.src)} ${bar} ${nameOf(l.dst)}${l.control ? ' [control]' : ''}`;
	},
}];
export const LINK_SELECT_ALL = { word: 'link', rank: 2, ids: (model) => model.all('link').map((l) => l.id) };
