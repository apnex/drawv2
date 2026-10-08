/*
THE DEVICES PLUGIN'S FACTORIES -- O-e1 (H19.21; O4): a device, a text panel and a waypoint, what `Model#makeNode`,
`makeTextBox` and `makeWaypoint` made. A waypoint is an anchor with no device composed; a device and a panel are anchors a
device is composed on -- this plugin's to make, as the core holds only the anchor. The id, name and drawing order come from
the Model's kind-blind machinery, `freshId`, `nextName` and `nextOrder`, which the core keeps (O1). Moved unchanged.
*/

import { BARE_KIND } from '../model/anchors.mjs';   // the anchor's stored kind, the core's

// a device of this type at a cell: named by its type, newest on top (F-d); `shape` the outer frame, apart from the glyph
export function makeNode(model, type, pos, shape = 'circle') {
	return {
		id: model.freshId('node'),
		name: model.nextName(type),
		order: model.nextOrder('node'),   // newest on top (F-d)
		type,
		shape, // the outer frame (circle, square, ...): independent of the glyph `type`
		x: pos.x,
		y: pos.y
	};
}

// a text panel over `span` cells, its one region the whole panel
export function makeTextBox(model, pos, span = { cols: 1, rows: 1 }) {
	const cols = span.cols, rows = span.rows;
	return {
		id: model.freshId('node'),
		name: '',
		type: 'text',
		shape: 'circle',   // a panel's corner follows shape: 'circle' = rounded (rx=circle radius); 's' toggles to 'square'
		x: pos.x,
		y: pos.y,
		span: { cols, rows },
		content: [{ at: [0, 0], cols, rows, content: 'text', value: '', align: 'left' }]
	};
}

// a waypoint at a cell: an anchor with no device, named with the word people use (F4)
export function makeWaypoint(model, pos) {
	return { id: model.freshId(BARE_KIND), name: model.nextName('waypoint'), order: model.nextOrder(BARE_KIND), x: pos.x, y: pos.y };
}
