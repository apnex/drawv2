/*
THE DEVICES PLUGIN'S GESTURES -- C-d, step three (H19.32; dev/design/unification/CANVAS-PLUGINS.md, D2: rows for shared gestures).

The text box: with the text tool held, a left press anywhere opens the canvas's shared BOX gesture on the node grid, its preview
a frame over the cells the drag spans -- a click spans one -- and the release makes a text panel there, selects it, releases
the tool (one panel per arm) and opens the editor on its text. The row, the frame and the release were the canvas's
(app/src/recognize.js `tool`, app/src/input.js `GESTURES.textbox`, `frameSpan`); nothing a user sees changes.
*/

import { STD, L_STD } from '../kernel/spec.mjs';
import { makeTextBox } from './make-node.mjs';

const NODE_R = L_STD.frame.ext;   // a device frame's half-extent (20)
const GAP = STD.pitch;

// the frame two snapped points span -- a margin of a frame's half-extent around the cells -- with its origin and span counts
const frameSpan = (a, b) => {
	const x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y), x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
	return { x: x0 - NODE_R, y: y0 - NODE_R, w: (x1 - x0) + 2 * NODE_R, h: (y1 - y0) + 2 * NODE_R,
		origin: { x: x0, y: y0 }, cols: Math.round((x1 - x0) / GAP) + 1, rows: Math.round((y1 - y0) / GAP) + 1 };
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
