/*
THE PRODUCT'S CANVAS -- the canvas parts production ships (C-a, H19.29; dev/design/unification/CANVAS-PLUGINS.md, D1, D3).
Each plugin hands the page a part -- its painters and its appearances now, its picks, placements, handles and rows as the
later stages land -- and the page composes these, as the store composes `productKinds` (product/kinds.mjs). The product page
and the lab hand it to `composeCanvas`; a page composed without a plugin's part draws none of what that part brings.

THE ANCHOR'S ORDER is the product's to declare, since several plugins draw on one anchor (D3; the 2026-09-22 ruling):
  layers  the named layers an anchor's parts land in, back to front -- `select` is the canvas's own, the selection brackets
  ranks   the competing appearances, highest first: the device outranks the network's marks, so a device emits none
Named lists rather than integer priorities -- the ruling's own caution: "priority as a bare integer is where this shape rots".
*/

import { NODE_EXT } from '../model/surface.mjs';
import { spanExtent } from '../kernel/geometry.mjs';
import { ZONES_CANVAS } from '../zones/zone-painter.mjs';
import { GROUPS_CANVAS } from '../groups/group-painter.mjs';
import { DEVICES_CANVAS } from '../devices/device-appearance.mjs';
import { NETWORK_CANVAS } from '../network/canvas.mjs';
import { SIMULATION_CANVAS } from '../engine/spawn-appearance.mjs';

/*
C-c: THE ANCHOR'S PLACE, the product's to declare as the anchor is the core's: the node grid, within the node extent, its size beyond
one cell a wide device's span -- the one place the canvas reads a device's field for the anchor, until B282 makes a wide device
several anchors (O4, the recorded width exception).
*/
const ANCHOR_PLACE = { kind: 'node', layout: 'node', ext: NODE_EXT, size: (anchor) => { const { sw, sh } = spanExtent(anchor.span); return { w: sw, h: sh }; } };

const ANCHOR_ORDER = {
	owner: 'the product',
	orders: { node: { layers: ['frame', 'sockets', 'body', 'marks', 'transit', 'select', 'label'], ranks: ['device', 'marks'] } },
	places: [ANCHOR_PLACE],
};

// painters back to front on a full render: zones, group hulls, links -- and the anchors over them, by appearances
export const PRODUCT_CANVAS = [ANCHOR_ORDER, ZONES_CANVAS, GROUPS_CANVAS, DEVICES_CANVAS, NETWORK_CANVAS, SIMULATION_CANVAS];
