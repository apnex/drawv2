/*
A DEVICE'S SIZE STEP -- C-e, step four (H19.33; dev/design/unification/CANVAS-PLUGINS.md; D5).

Shift+arrow on a lone device grows its span a cell (W1): its origin fixed, at least a cell, capped at the validator's 64. The
canvas's one size-step row reads this (`sizeStep`), as it reads the zones plugin's. A waypoint has no size to step. It was
app/src/commands.js `resizeNodeStep`, with `resizeNodeSpan`.
*/

import { SPAN_MAX } from '../model/limits.mjs';
import { hasDevice } from './device-fields.mjs';

export const DEVICE_SIZE_STEP = {
	kind: 'node', label: 'resize', doc: 'grow the selected node',
	step: (node, dx, dy) => {
		if (!hasDevice(node)) return null;
		const cur = node.span || { cols: 1, rows: 1 };
		const cols = Math.min(Math.max(cur.cols + dx, 1), SPAN_MAX);
		const rows = Math.min(Math.max(cur.rows + dy, 1), SPAN_MAX);
		return cols === cur.cols && rows === cur.rows ? null : { span: { cols, rows } };
	},
};
