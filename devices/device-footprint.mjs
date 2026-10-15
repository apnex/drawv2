/*
WHAT A DEVICE COVERS -- C-e, step three (H19.33; dev/design/unification/CANVAS-PLUGINS.md).

A device occupies a RECTANGLE, not a point: a multi-cell device is hittable across its whole span, so every test goes through
`spanExtent` rather than a radius (B29's family of bugs was surfaces forgetting exactly this). The two predicates moved here
from app/src/pick.js unchanged, with the devices plugin's coordinate picks: what a press or a link's end grabs (the frame and a
little more), what keeps a hover after a gesture (the frame), what a marquee box takes (a footprint overlapping it).
*/

import { L_STD } from '../kernel/spec.mjs';
import { spanExtent } from '../kernel/geometry.mjs';
import { typedNodes } from './device-shapes.mjs';
import { hasDevice } from './device-fields.mjs';
import { isPanel } from './device-types.mjs';   // H24.6: a panel draws a rectangle, as a wide device does

const NODE_R = L_STD.frame.ext;   // a device frame's half-extent (20)

// is `pos` inside this device's footprint, padded by `pad`?
export const inFootprint = (n, pos, pad = 0) => {
	const { sw, sh } = spanExtent(n.span);
	return pos.x >= n.x - pad && pos.x <= n.x + sw + pad && pos.y >= n.y - pad && pos.y <= n.y + sh + pad;
};

// does this device's footprint overlap `box`? (the marquee test)
const footprintHits = (n, box, pad = 0) => {
	const { sw, sh } = spanExtent(n.span);
	return n.x - pad <= box.x + box.w && n.x + sw + pad >= box.x && n.y - pad <= box.y + box.h && n.y + sh + pad >= box.y;
};

/*
WD-b2 (H19.46) -- A DEVICE'S SIZE, for its place: the extent of its span beyond its own cell, from the cell's centre, as the
anchor's place read it from product/canvas.mjs until the layouts plugin took the place. A node with no span -- a device of one
cell, or a waypoint -- answers nothing, and the canvas reads one cell (app/src/snap.js `placesOf`).
*/
/*
H24.6 (B356) -- A DEVICE'S OUTLINE, for a link's head to touch (docs/spec/ATOMICS.md "Arrowheads"). What the device draws: a
wide device or a panel a rectangle from its first cell across its span, a plain device its circle or square. A node the devices
plugin does not draw -- a waypoint -- answers nothing, and the link painter takes the network's own anchor ring.
*/
export const DEVICE_OUTLINES = {
	node: (n) => {
		if (!hasDevice(n)) return undefined;
		const spanned = !!n.span && (n.span.cols > 1 || n.span.rows > 1);
		if (spanned || isPanel(n)) {
			const { sw, sh } = spanExtent(n.span);
			return { form: 'rect', x0: -NODE_R, y0: -NODE_R, x1: sw + NODE_R, y1: sh + NODE_R };
		}
		return n.shape === 'square' ? { form: 'rect', x0: -NODE_R, y0: -NODE_R, x1: NODE_R, y1: NODE_R } : { form: 'circle', r: NODE_R };
	},
};

export const DEVICE_SIZES = {
	node: (n) => {
		if (!n.span) return undefined;
		const { sw, sh } = spanExtent(n.span);
		return { w: sw, h: sh };
	},
};

export const DEVICE_POINTS = [{
	word: 'node',
	of: (model) => typedNodes(model),
	grabs: (n, pos) => inFootprint(n, pos, NODE_R + 4),   // a press, a link's end, a pipette: the frame and a little more
	under: (n, pos) => inFootprint(n, pos, NODE_R),       // a hover outlasting a gesture: the frame
	within: (n, box) => footprintHits(n, box),            // a marquee: a footprint overlapping the box
}];
