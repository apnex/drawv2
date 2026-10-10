/*
THE LAYOUT KIND -- the layouts plugin's (WD-b1, H19.45; dev/design/unification/WIDE-DEVICES.md section 12; WD6, WD7).

A diagram stores its two grids -- `node`, the device grid; `zone`, the zone grid -- as layout entities, and always holds both:
the row declares them (`always`), so every document a composition makes holds them by construction, and a document loaded
without them is completed. A layout holds the product's values for its name, and the id the table gives that name (WD7), so
changing one, adding a second of a name, or deleting one is refused -- the first two by the row's checks, the last by its
invariant, which the planner refuses when an edit would introduce it. Not selectable, and not in the one name namespace: a
layout's name says which grid it is, not what an author called it.
*/

import { LAYOUT_TABLE } from './layout-table.mjs';

const BY_NAME = new Map(LAYOUT_TABLE.map((l) => [l.name, l]));
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const sameExt = (a, b) => !!a && !!b && a.x === b.x && a.y === b.y;
const describe = (l) => `id ${l.id}, pitch ${l.pitch}, offset ${l.offset}, extent ${l.ext.x} x ${l.ext.y}`;

const LAYOUT_ROW = {
	kind: 'layout',
	owner: 'layouts',
	collection: 'layouts',
	selectable: false,
	named: false,
	anchor: false,
	composite: ['ext'],
	optional: [],
	references: [],
	fields: {
		id: (v) => typeof v === 'string' && /^layout-[0-9a-f]{6}$/.test(v),
		name: (v) => BY_NAME.has(v),
		pitch: (v) => num(v),
		offset: (v) => num(v),
		ext: (v) => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 2 && num(v.x) && num(v.y),
	},
	// WD7: a layout holds the product's values for its name until the infinite canvas lets a diagram vary them
	refers: (l) => {
		const want = BY_NAME.get(l.name);
		if (!want) return `${l.id}: no layout is named ${l.name}`;
		if (l.id === want.id && l.pitch === want.pitch && l.offset === want.offset && sameExt(l.ext, want.ext)) return null;
		return `${l.id}: the ${l.name} layout holds the product's values (${describe(want)}) -- a diagram may not vary its grids yet (WD7)`;
	},
	// every diagram holds its two layouts: a missing one is a violation, so an edit deleting one is refused
	invariants: (model, report) => {
		for (const l of LAYOUT_TABLE) if (!model.get('layout', l.id)) report(`the ${l.name} layout (${l.id}) is missing -- every diagram holds its two layouts`, `layout-missing:${l.name}`);
	},
	always: LAYOUT_TABLE,
	cap: LAYOUT_TABLE.length,
};

// the layouts plugin's rows, as the zones plugin's are ZONE_ROWS (zones/zone-kind.mjs)
export const LAYOUT_ROWS = [LAYOUT_ROW];
