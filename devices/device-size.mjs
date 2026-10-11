/*
A DEVICE'S SIZE STEP -- C-e, step four (H19.33; dev/design/unification/CANVAS-PLUGINS.md; D5).

Shift+arrow on a lone device grows its span a cell (W1): its origin fixed, at least a cell, capped at the validator's 64.
AMENDED B27 (H20.4): no further than the surface's edge, and no smaller than its content -- a step the planner would refuse is none. The
canvas's one size-step row reads this (`sizeStep`), as it reads the zones plugin's. A waypoint has no size to step. It was
app/src/commands.js `resizeNodeStep`, with `resizeNodeSpan`.
*/

import { SPAN_MAX } from '../model/limits.mjs';
import { NODE_EXT } from '../model/surface.mjs';   // B27: a span grows to the surface's edge
import { STD } from '../kernel/spec.mjs';
import { hasDevice } from './device-fields.mjs';

export const DEVICE_SIZE_STEP = {
	kind: 'node', label: 'resize', doc: 'grow the selected node',
	step: (node, dx, dy) => {
		if (!hasDevice(node)) return null;
		const cur = node.span || { cols: 1, rows: 1 };
		// B27 (H20.4): up to the surface's edge and down to the content, as the zone's step stops at the edge -- no step meets the rule
		const least = (node.content ?? []).reduce((m, r) => ({ cols: Math.max(m.cols, (r.at?.[0] ?? 0) + (r.cols ?? 1)), rows: Math.max(m.rows, (r.at?.[1] ?? 0) + (r.rows ?? 1)) }), { cols: 1, rows: 1 });
		const most = { cols: Math.min(SPAN_MAX, Math.floor((NODE_EXT.x - node.x) / STD.pitch) + 1), rows: Math.min(SPAN_MAX, Math.floor((NODE_EXT.y - node.y) / STD.pitch) + 1) };
		const cols = Math.min(Math.max(cur.cols + dx, least.cols), most.cols);
		const rows = Math.min(Math.max(cur.rows + dy, least.rows), most.rows);
		return cols === cur.cols && rows === cur.rows ? null : { span: { cols, rows } };
	},
};
