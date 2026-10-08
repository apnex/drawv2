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

import { ZONES_CANVAS } from '../zones/zone-painter.mjs';
import { GROUPS_CANVAS } from '../groups/group-painter.mjs';
import { DEVICES_CANVAS } from '../devices/device-appearance.mjs';
import { NETWORK_CANVAS } from '../network/anchor-appearance.mjs';
import { SIMULATION_CANVAS } from '../engine/spawn-appearance.mjs';

const ANCHOR_ORDER = {
	owner: 'the product',
	orders: { node: { layers: ['frame', 'sockets', 'body', 'marks', 'transit', 'select', 'label'], ranks: ['device', 'marks'] } },
};

// painters back to front on a full render: zones, then group hulls, behind everything the renderer still draws itself
export const PRODUCT_CANVAS = [ANCHOR_ORDER, ZONES_CANVAS, GROUPS_CANVAS, DEVICES_CANVAS, NETWORK_CANVAS, SIMULATION_CANVAS];
