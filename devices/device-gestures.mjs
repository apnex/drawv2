/*
THE DEVICES PLUGIN'S GESTURES -- C-d, step three (H19.32; dev/design/unification/CANVAS-PLUGINS.md, D2: rows for shared gestures).

The text box: with the text tool held, a left press anywhere opens the canvas's shared BOX gesture on the node grid, its preview
a frame over the cells the drag spans -- a click spans one -- and the release makes a text panel there, selects it, releases
the tool (one panel per arm) and opens the editor on its text. The row, the frame and the release were the canvas's
(app/src/recognize.js `tool`, app/src/input.js `GESTURES.textbox`, `frameSpan`); nothing a user sees changes.
*/

import { L_STD } from '../kernel/spec.mjs';
import { NODE_GRID } from '../kernel/geometry.mjs';
import { makeTextBox } from './make-node.mjs';

const NODE_R = L_STD.frame.ext;   // a device frame's half-extent (20)

/*
The frame two snapped points span -- a margin of a frame's half-extent around the cells -- with its origin and span counts.
H26.1 (SNAP-GRID.md appendix B): the two snapped corners are positions on the node grid; the origin is the least corner's point and
the counts the index differences plus one, and the frame is the block's `span(...).through` grown by the frame's margin, which stays.
*/
const frameSpan = (a, b) => {
	const p = NODE_GRID.nearest(a), q = NODE_GRID.nearest(b), { through } = NODE_GRID.span(p, q);
	return { x: through.x - NODE_R, y: through.y - NODE_R, w: through.w + 2 * NODE_R, h: through.h + 2 * NODE_R,
		origin: { x: through.x, y: through.y }, cols: Math.abs(q.col - p.col) + 1, rows: Math.abs(q.row - p.row) + 1 };
};

const TEXT_TOOL = {
	id: 'tool', input: ['left on canvas|node|waypoint|zone|link'], context: 'the text tool held', mutates: true, doc: 'place a text box',
	on: (e) => e.button === 0,
	when: (s) => !!s.tool,   // a held tool places on the next click, whatever is under it -- the text tool, today
	gesture: 'box',
	box: {
		place: 'node',
		preview: 'textbox-preview',
		frame: frameSpan,
		previewOnPress: false,   // the frame shows once the pointer moves, as it always has
		releases: [{ id: 'create-text', mutates: true, on: (e) => e.type === 'up', run: (host, f) => {
			const id = host.create('node', (model) => makeTextBox(model, f.origin, { cols: f.cols, rows: f.rows }));
			host.releaseTool();    // one box per arm -- re-tap 't' for another
			host.editFrame(id);    // the inline editor on its text region, over the new box's frame
		} }],
	},
};

export const DEVICE_PRESSES = [TEXT_TOOL];
