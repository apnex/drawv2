/*
A DEVICE'S SIZE STEP -- C-e, step four (H19.33; dev/design/unification/CANVAS-PLUGINS.md; D5).

Shift+arrow on a lone device grows its span a cell (W1): its origin fixed, at least a cell, capped at the validator's 64.
AMENDED B27 (H20.4): no further than the surface's edge, and no smaller than its content -- a step the planner would refuse is none. The
canvas's one size-step row reads this (`sizeStep`), as it reads the zones plugin's. A waypoint has no size to step. It was
app/src/commands.js `resizeNodeStep`, with `resizeNodeSpan`.
*/

import { SPAN_MAX } from '../model/limits.mjs';
import { NODE_EXT } from '../model/surface.mjs';   // B27: a span grows to the surface's edge
import { NODE_GRID } from '../kernel/geometry.mjs';
import { hasDevice } from './device-fields.mjs';

// H26.1 (SNAP-GRID.md appendix B): the cells to the surface's edge are counted in positions -- the column (or row) of the node grid's
// position at the extent's corner, less the device's own, plus one; the step and the span cap stay
const EDGE = NODE_GRID.nearest(NODE_EXT);

export const DEVICE_SIZE_STEP = {
	kind: 'node', label: 'resize', doc: 'grow the selected node',
	step: (node, dx, dy) => {
		if (!hasDevice(node)) return null;
		const cur = node.span || { cols: 1, rows: 1 };
		// B27 (H20.4): up to the surface's edge and down to the content, as the zone's step stops at the edge -- no step meets the rule
		const least = (node.content ?? []).reduce((m, r) => ({ cols: Math.max(m.cols, (r.at?.[0] ?? 0) + (r.cols ?? 1)), rows: Math.max(m.rows, (r.at?.[1] ?? 0) + (r.rows ?? 1)) }), { cols: 1, rows: 1 });
		const at = NODE_GRID.nearest(node);
		const most = { cols: Math.min(SPAN_MAX, EDGE.col - at.col + 1), rows: Math.min(SPAN_MAX, EDGE.row - at.row + 1) };
		const cols = Math.min(Math.max(cur.cols + dx, least.cols), most.cols);
		const rows = Math.min(Math.max(cur.rows + dy, least.rows), most.rows);
		return cols === cur.cols && rows === cur.rows ? null : { span: { cols, rows } };
	},
};
