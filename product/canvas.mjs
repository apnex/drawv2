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

import { LAYOUTS_CANVAS } from '../layouts/layout-canvas.mjs';
import { ZONES_CANVAS } from '../zones/zone-painter.mjs';
import { GROUPS_CANVAS } from '../groups/group-painter.mjs';
import { DEVICES_CANVAS } from '../devices/device-appearance.mjs';
import { NETWORK_CANVAS } from '../network/canvas.mjs';
import { SIMULATION_CANVAS } from '../engine/spawn-appearance.mjs';
import { TYPE_ROUTING } from '../devices/device-types.mjs';
import { composeRouting } from '../network/transit-offers.mjs';

// U4-1 (H21.3, B282): hand the network plugin its routing slice of the device type declarations at composition
composeRouting(TYPE_ROUTING);

/*
WD-b2 (H19.46): THE PRODUCT'S PART IS COMPOSITION -- the anchor's drawing order among the plugins' appearances and its rank in a
delete. The anchor's place and the anchor grid moved to the layouts plugin (layouts/layout-canvas.mjs), and a device's size to the
devices plugin (devices/device-footprint.mjs `DEVICE_SIZES`) -- a device owns its size (WD10).
*/
const ANCHOR_ORDER = {
	owner: 'the product',
	orders: { node: { layers: ['frame', 'sockets', 'body', 'marks', 'transit', 'select', 'label'], ranks: ['device', 'marks'] } },
	deleteRanks: { node: 4 },   // C-e: an anchor is deleted last; a kind no part ranks, 3
};

// painters back to front on a full render: zones, group hulls, links -- and the anchors over them, by appearances
export const PRODUCT_CANVAS = [ANCHOR_ORDER, LAYOUTS_CANVAS, ZONES_CANVAS, GROUPS_CANVAS, DEVICES_CANVAS, NETWORK_CANVAS, SIMULATION_CANVAS];

/*
H25.1 (B366, D1): THE STYLESHEETS A PAGE LOADS, in order -- the colour registry, the core's primitives, each composed part's own
sheet in the order the parts compose, then the page's chrome and the canvas's own. A plugin brings its look as it brings its
painters (its part's `stylesheets`), and a page lists exactly these: tools/stylesheets.mjs writes them into app/index.html and
lab/index.html and the gate checks they agree. Each part's sheet loads before the page's, as network/network.css always did.
H25.2 (B366, D3): the page's own sheet split in two -- its chrome (app/style.css) and the canvas (app/canvas.css), the canvas's
loaded last, where its rules stood -- and every sheet but the chrome's is what the export and the favicon take their look from,
applied to each element they draw and written as its attributes (server/svg-style.mjs, as D3 was amended: dev/DECISIONS.md H25-2),
the registries' colours written in -- what H24.8 (B361) asked of the export, view mode drawn, met by one statement of each look
rather than a copy held to it by a test.
*/
export const CHROME_STYLESHEETS = ['app/style.css'];
export const PAGE_STYLESHEETS = ['app/tokens.css', 'kernel/primitives.css', ...PRODUCT_CANVAS.flatMap((p) => p.stylesheets ?? []), ...CHROME_STYLESHEETS, 'app/canvas.css'];
