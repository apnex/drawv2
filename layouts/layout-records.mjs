/*
A DIAGRAM'S LAYOUT RECORDS, READ LOUDLY (WD-b1, H19.45; WD8, dev/design/unification/WIDE-DEVICES.md section 13).

What the agent API's `GET /diagrams/<id>/layouts` serves (server/rest.js): the diagram's two layouts, in the table's order,
each a plain copy -- id, name, pitch, offset and extent. A diagram lacking one cannot be told apart from a broken one, so it
is an error naming the one missing, never the table's values or the kernel's names put in its place (finding 2: readers fail
loudly).
*/

import { LAYOUT_TABLE } from './layout-table.mjs';

// one layout record by its name -- the grid the canvas draws (layouts/layout-canvas.mjs) -- a plain copy, or an error naming it
export function layoutNamed(model, name) {
	const want = LAYOUT_TABLE.find((l) => l.name === name);
	if (!want) throw new Error(`no layout is named ${name}`);
	const l = model.get('layout', want.id);
	if (!l) throw new Error(`the ${want.name} layout (${want.id}) is missing -- every diagram holds its two layouts`);
	return { id: l.id, name: l.name, pitch: l.pitch, offset: l.offset, ext: { x: l.ext.x, y: l.ext.y } };
}

export function layoutRecords(model) {
	return LAYOUT_TABLE.map((want) => layoutNamed(model, want.name));
}

/*
H26.1 (dev/design/components/SNAP-GRID.md appendix B): an anchor as the agent API answers it -- a position on a layout's grid and
its point, carrying the layout's name, `{ layout, cx, cy, x, y }`, both representations so no consumer does arithmetic (B111). The
kernel's `anchorAt` and `nearestAnchor` built it, and the layout's name left the kernel with them; the REST door's `nearest` and
`anchors` routes shape what snap-grid answers through this one. Server-side placement (server/anchor.mjs) builds the node layout's
own, its part consuming the lattice alone.
*/
export function anchorOn(name, position, point) {
	return { layout: name, cx: position.col, cy: position.row, x: point.x, y: point.y };
}
