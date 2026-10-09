/*
WHAT THE NETWORK'S ITEMS COVER -- C-e, step three (H19.33; dev/design/unification/CANVAS-PLUGINS.md).

A waypoint covers its drawn radius: a press or a link's end grabs it there, and any waypoint will do -- a bend already carrying
a link is how a junction is drawn (B209, B211). A marquee box takes a waypoint whose place is inside it, and a link whose ends it
took both. What app/src/pick.js `endpointAt` and app/src/input.js `pickedIn` answered, moved unchanged.
*/

import { L_STD } from '../kernel/spec.mjs';
import { bareAnchors } from '../devices/device-shapes.mjs';

const NODE_R = L_STD.frame.ext;   // a waypoint's drawn radius (20)
const near = (w, pos) => Math.hypot(w.x - pos.x, w.y - pos.y) <= NODE_R;
const inBox = (p, box) => p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h;

export const NETWORK_POINTS = [
	{ word: 'waypoint', of: (model) => bareAnchors(model), grabs: near, under: near, within: inBox },
	{ word: 'link', of: (model) => model.all('link'), joins: (l, taken) => taken.has(l.src) && taken.has(l.dst) },
];
