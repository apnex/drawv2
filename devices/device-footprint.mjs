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

export const DEVICE_POINTS = [{
	word: 'node',
	of: (model) => typedNodes(model),
	grabs: (n, pos) => inFootprint(n, pos, NODE_R + 4),   // a press, a link's end, a pipette: the frame and a little more
	under: (n, pos) => inFootprint(n, pos, NODE_R),       // a hover outlasting a gesture: the frame
	within: (n, box) => footprintHits(n, box),            // a marquee: a footprint overlapping the box
}];
