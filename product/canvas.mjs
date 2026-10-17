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
import { ZONE_TOKENS } from '../zones/zone-painter.mjs';
import { GROUP_TOKENS } from '../groups/group-painter.mjs';
import { NETWORK_TOKENS, downStroke } from '../network/appearance.mjs';
import { TOKENS } from '../kernel/theme.mjs';

export const LINK_COLOURS = { up: NETWORK_TOKENS.link, down: downStroke() };

/*
B330 (H22.5): the standalone CSS rules for the elements the plugins' painters and appearances emit into a downloaded SVG.
H24.8 (B361): each rule says what the page's stylesheet says for the same element (app/style.css, network/network.css), resolved
to its colour -- a name on its baseline point in an opaque pill, in the page's font; a link's ends and corners as the page leaves
them. Its own copy once centred names on that point and made their pills see-through, and the browser test
`H24.8 (B361): the published SVG draws what view mode draws` now holds every drawn element to the page's look.
*/
export const EXPORT_CSS = `
.zone .zone-rect { fill:${ZONE_TOKENS.zoneFill}; fill-opacity:${ZONE_TOKENS.zoneFillOp}; stroke:${ZONE_TOKENS.zoneStroke}; stroke-opacity:${ZONE_TOKENS.zoneStrokeOp}; stroke-width:1; }
.label { font-family:monospace; fill:${TOKENS.label}; text-anchor:middle; }
.label.zone-label { text-anchor:start; }
.label-pill { fill:${TOKENS.panel}; }
.group .group-hull { fill:none; stroke:${GROUP_TOKENS.group}; stroke-width:1.1; }
.link { fill:none; stroke:${NETWORK_TOKENS.link}; }
.link[data-down] { stroke:${downStroke()}; }
.link-hit { display:none; }
`;
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
sheet in the order the parts compose, then the page's own (chrome and canvas). A plugin brings its look as it brings its painters
(its part's `stylesheets`), and a page lists exactly these: tools/stylesheets.mjs writes them into app/index.html and
lab/index.html and the gate checks they agree. Each part's sheet loads before the page's, as network/network.css always did.
*/
export const PAGE_STYLESHEETS = ['app/tokens.css', 'kernel/primitives.css', ...PRODUCT_CANVAS.flatMap((p) => p.stylesheets ?? []), 'app/style.css'];
