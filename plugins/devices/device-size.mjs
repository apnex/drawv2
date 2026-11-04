/*
A DEVICE'S SIZE STEP -- C-e, step four (H19.33; dev/design/unification/CANVAS-PLUGINS.md; D5).

Shift+arrow on a lone device grows its span a cell (W1): its origin fixed, at least a cell, capped at the validator's 64.
AMENDED B27 (H20.4): no further than the surface's edge, and no smaller than its content -- a step the planner would refuse is none.
RESTATED at H26.6's move 11 (dev/design/components/PAN-ZOOM.md section 3.8, "The extents"): no edge -- up to the span cap and down to its
content alone, as the validator now holds it. The
canvas's one size-step row reads this (`sizeStep`), as it reads the zones plugin's. A waypoint has no size to step. It was
app/src/commands.js `resizeNodeStep`, with `resizeNodeSpan`.
*/

import { SPAN_MAX } from '../../model/limits.mjs';
import { hasDevice } from './device-fields.mjs';


export const DEVICE_SIZE_STEP = {
	kind: 'node', label: 'resize', doc: 'grow the selected node',
	step: (node, dx, dy) => {
		if (!hasDevice(node)) return null;
		const cur = node.span || { cols: 1, rows: 1 };
		// B27 (H20.4): down to the content -- no step meets the rule; up to the span cap, the surface's edge gone at move 11
		const least = (node.content ?? []).reduce((m, r) => ({ cols: Math.max(m.cols, (r.at?.[0] ?? 0) + (r.cols ?? 1)), rows: Math.max(m.rows, (r.at?.[1] ?? 0) + (r.rows ?? 1)) }), { cols: 1, rows: 1 });
		const most = { cols: SPAN_MAX, rows: SPAN_MAX };
		const cols = Math.min(Math.max(cur.cols + dx, least.cols), most.cols);
		const rows = Math.min(Math.max(cur.rows + dy, least.rows), most.rows);
		return cols === cur.cols && rows === cur.rows ? null : { span: { cols, rows } };
	},
};
