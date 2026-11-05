/*
THE LAYOUT KIND -- the layouts plugin's (WD-b1, H19.45; dev/design/unification/WIDE-DEVICES.md section 12; WD6, WD7).

A diagram stored its two grids -- `node`, the device grid; `zone`, the zone grid -- as layout entities, and always held both, each
holding the product's values for its name (WD7).
RESTATED at H26.6's move 14 (dev/design/components/PAN-ZOOM.md section 3.4; PZ14, PZ20, PZ21; GR7): ONE stored grid -- the row of one
entity, `{ id: 'layout-000001', name: 'grid', pitch }`. The device lattice's origin is 0 and the zone lattice's half the pitch, always,
never stored (Q2), so a record carrying any other field is refused (`unknown field layout.<field>`, planner/validate.js); the pitch is an
even whole number (PZ20) held at 60 until move 15 brings the reaction that moves every anchor with it, PZ21's 60 to 120 opening then.
WD7's refusal and the second record are gone. The row declares the record (`always`), so every document a composition makes holds it by
construction and a document loaded without it is completed; deleting it is refused by the row's invariant. Not selectable, and not in the
one name namespace: the record is the diagram's grid, not something an author names.
*/

import { STD } from '../../kernel/spec.mjs';

const GRID_ID = 'layout-000001';   // the diagram's one grid record, schema 3's node record before it
// PZ21's range, held at the unit's 60 until move 15 opens it to 120 with the size change's reaction
const PITCH_MIN = STD.pitch, PITCH_MAX = STD.pitch;
const evenPitch = (v) => Number.isSafeInteger(v) && v % 2 === 0 && v >= PITCH_MIN && v <= PITCH_MAX;

// what every diagram holds when it is made: the grid of 60, the unit's size (PZ14)
const GRID_RECORD = Object.freeze({ id: GRID_ID, name: 'grid', pitch: PITCH_MIN });

const LAYOUT_ROW = {
	kind: 'layout',
	owner: 'layouts',
	collection: 'layouts',
	selectable: false,
	named: false,
	anchor: false,
	composite: [],
	optional: [],
	references: [],
	fields: {
		id: (v) => typeof v === 'string' && /^layout-[0-9a-f]{6}$/.test(v),   // the id grammar every row keeps (B104); the one id below
		name: (v) => v === 'grid',
		pitch: (v) => evenPitch(v),
	},
	// the one record: any other id is a second grid, which no diagram holds
	refers: (l) => (l.id === GRID_ID ? null : `${l.id}: a diagram holds one grid, ${GRID_ID} -- no other layout`),
	// every diagram holds its one grid: a missing one is a violation, so an edit deleting it is refused
	invariants: (model, report) => {
		if (!model.get('layout', GRID_ID)) report(`the diagram's grid (${GRID_ID}) is missing -- every diagram holds it`, 'layout-missing:grid');
	},
	always: [GRID_RECORD],
	cap: 1,
};

// the layouts plugin's rows, as the zones plugin's are ZONE_ROWS (plugins/zones/zone-kind.mjs)
export const LAYOUT_ROWS = [LAYOUT_ROW];
