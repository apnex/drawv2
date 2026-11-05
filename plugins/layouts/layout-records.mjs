/*
A DIAGRAM'S LAYOUT RECORDS, READ LOUDLY (WD-b1, H19.45; WD8, dev/design/unification/WIDE-DEVICES.md section 13).

What the agent API's `GET /diagrams/<id>/layouts` serves (server/rest.js): the diagram's layouts, each a plain copy. A diagram lacking its
grid cannot be told apart from a broken one, so it is an error naming it, never a default put in its place (finding 2: readers fail
loudly).
RESTATED at H26.6's move 14 (dev/design/components/PAN-ZOOM.md section 3.4, "The agents' answers"): the one record, `{ id, name, pitch }`,
where it served the two, each with its offset and extent.
*/

import { diagramLattices } from '../../kernel/geometry.mjs';
import { LAYOUT_ROWS } from './layout-kind.mjs';

const GRID_ID = LAYOUT_ROWS[0].always[0].id;   // the row's one record, `layout-000001`

// the diagram's one grid record, a plain copy, or an error naming it
function gridRecord(model) {
	const l = model.get('layout', GRID_ID);
	if (!l) throw new Error(`the diagram's grid (${GRID_ID}) is missing -- every diagram holds it`);
	return { id: l.id, name: l.name, pitch: l.pitch };
}

/*
H26.6's move 13 (dev/design/components/PAN-ZOOM.md sections 3.4 and 3.9; PZ18) -- A DIAGRAM'S TWO LATTICES, from its model: its one grid
record opened by `diagramLattices`, `{ device, zone }`. What every place a plugin declares resolves its lattice by at the call
(plugins/layouts/layout-canvas.mjs, plugins/zones/zone-painter.mjs), what the dots are drawn on, and what the canvas's composition hands
the occupancy index.
*/
export function latticesOf(model) {
	return diagramLattices(gridRecord(model));
}

export function layoutRecords(model) {
	return [gridRecord(model)];
}
