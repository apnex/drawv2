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
