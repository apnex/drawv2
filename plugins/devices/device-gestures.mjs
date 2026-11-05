/*
THE DEVICES PLUGIN'S GESTURES -- C-d, step three (H19.32; dev/design/unification/CANVAS-PLUGINS.md, D2: rows for shared gestures).

The text box: with the text tool held, a left press anywhere opens the canvas's shared BOX gesture on the node grid, its preview
a frame over the cells the drag spans -- a click spans one -- and the release makes a text panel there, selects it, releases
the tool (one panel per arm) and opens the editor on its text. The row, the frame and the release were the canvas's
(app/src/recognize.js `tool`, app/src/input.js `GESTURES.textbox`, `frameSpan`); nothing a user sees changes.
*/

import { STD, L_STD } from '../../kernel/spec.mjs';
import { UNIT_GRID } from '../../kernel/lattice-grids.mjs';   // H26.6's move 13 (PZ32, GR16): the unit, asked for a span from cell 0,0
import { makeTextBox } from './make-node.mjs';

const NODE_R = L_STD.frame.ext;   // a device frame's half-extent (20)

/*
The frame two snapped points span -- a margin of a frame's half-extent around the cells -- with its origin and span counts.
H26.1 (SNAP-GRID.md appendix B): the two snapped corners are positions on the node grid; the origin is the least corner's point and
the counts the index differences plus one, and the frame is the block's `span(...).through` grown by the frame's margin, which stays.
RESTATED at H26.6's move 13 (dev/design/components/PAN-ZOOM.md section 3.8, "The text tool"; PZ32) -- SPLIT: the two corners arrive
snapped to the diagram's device lattice (the shared box gesture snaps them on the anchor's place), so the anchor, the lesser corner, lies
on the grid; the span counts are `1 + round(d / 60)` on each axis, `d` the distance between them, a half toward the greater, and the frame
is a span of that many squares of the unit from cell 0,0, so a text box's size is in the unit, a device's, whatever the grid -- identical
to the old frame at 60 over 21,609 corner pairs (`textbox-frame.mjs`).
*/
// F6 (H26.1's verification): a point not a finite number, or past snap-grid's domain -- which no snapped pointer is -- gives a frame of
// NaN, as the old arithmetic's NaN did
const DOMAIN = 2 ** 50;   // 2^50, snap-grid's domain (SG1): a lattice places no position past it
const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && Math.abs(p.x) <= DOMAIN && Math.abs(p.y) <= DOMAIN;
const UNIT = STD.pitch;   // a device's unit, 60 (PZ18)
const frameSpan = (a, b) => {
	if (!finite(a) || !finite(b)) return { x: NaN, y: NaN, w: NaN, h: NaN, origin: { x: NaN, y: NaN }, cols: NaN, rows: NaN };
	const origin = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) };
	const cols = 1 + Math.round(Math.abs(b.x - a.x) / UNIT), rows = 1 + Math.round(Math.abs(b.y - a.y) / UNIT);
	const { w, h } = UNIT_GRID.span({ col: 0, row: 0 }, { col: cols - 1, row: rows - 1 }).through;
	return { x: origin.x - NODE_R, y: origin.y - NODE_R, w: w + 2 * NODE_R, h: h + 2 * NODE_R, origin, cols, rows };
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
