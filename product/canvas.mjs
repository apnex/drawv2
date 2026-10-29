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

import { LAYOUTS_CANVAS } from '../plugins/layouts/layout-canvas.mjs';
import { ZONES_CANVAS } from '../plugins/zones/zone-painter.mjs';
import { GROUPS_CANVAS } from '../plugins/groups/group-painter.mjs';
import { DEVICES_CANVAS } from '../plugins/devices/device-appearance.mjs';
import { NETWORK_CANVAS } from '../plugins/network/canvas.mjs';
import { SIMULATION_CANVAS } from '../plugins/simulation/spawn-appearance.mjs';
import { TYPE_ROUTING } from '../plugins/devices/device-types.mjs';
import { composeRouting } from '../plugins/network/transit-offers.mjs';

// U4-1 (H21.3, B282): hand the network plugin its routing slice of the device type declarations at composition
composeRouting(TYPE_ROUTING);

/*
WD-b2 (H19.46): THE PRODUCT'S PART IS COMPOSITION -- the anchor's drawing order among the plugins' appearances and its rank in a
delete. The anchor's place and the anchor grid moved to the layouts plugin (plugins/layouts/layout-canvas.mjs), and a device's size to the
devices plugin (plugins/devices/device-footprint.mjs `DEVICE_SIZES`) -- a device owns its size (WD10).
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
lab/index.html and the gate checks they agree. Each part's sheet loads before the page's, as plugins/network/network.css always did.
H25.2 (B366, D3): the page's own sheet split in two -- its chrome (app/style.css) and the canvas (app/canvas.css), the canvas's
loaded last, where its rules stood -- and every sheet but the chrome's is what the export and the favicon take their look from,
applied to each element they draw and written as its attributes (server/svg-style.mjs, as D3 was amended: dev/DECISIONS.md H25-2),
the registries' colours written in -- what H24.8 (B361) asked of the export, view mode drawn, met by one statement of each look
rather than a copy held to it by a test.
*/
export const CHROME_STYLESHEETS = ['app/style.css'];

/*
H25.4 (B376): THE CANVAS'S LAYOUT -- the viewBox, whose rectangle is the canvas's ground, and the layers a page stacks, back to
front. Which part's layer lies over which is a fact of the composition, so it is declared here once: tools/canvas-layout.mjs writes
it into each page's `#container` between generated markers (the gate checks), the lab checks its page holds each layer
(lab/src/root.js), and the export stacks what it draws by it (server/svg.mjs) -- H24.8 (B361) found the published file stacking
its layers in another order than the page. A part's painter names the layer it draws into; one this does not hold is refused.
*/
export const CANVAS_VIEWBOX = '-960 -540 1920 1080';
// H26.4: the layer a plugin draws itself, by the part that draws it -- foreign in the scene below, and asked of it by a page without the
// page typing a plugin's kind (app/src/main.js). H26.8's pipes move (NATIVE-SHAPES.md section 4.6): the movers' alone, the network's
// pipes a painted kind, drawn by the renderer into a layer of the scene's own
export const FOREIGN_LAYERS = { simulation: 'movers' };
export const CANVAS_LAYERS = [
	'grid-nodes', 'grid-zones', 'snaplayer', 'zones',
	'pipes',                     // V-b (H18.26): the network's pipes, beneath the links that run over them
	'groups', 'links', 'waypoints', 'nodes',
	FOREIGN_LAYERS.simulation,   // H12.8: over the graph, so a packet is never hidden by the line it travels; in a layer of their own, so the renderer's reconcile never sees them -- derived presentation, not document entities
	'overlay',
];
/*
H26.4 (dev/design/components/VECTOR-SCENE.md section 5.1, D5, D9): THE CANVAS'S SCENE, declared once -- the layers above in order, each
written with its id, and the one a plugin draws itself foreign: the simulation's movers, whose drawer writes beneath the element the scene
answers for it (`layerElement`) -- the network's pipes were the second until H26.8's pipes move. Declared here, where the product composes the plugins, since the canvas
and the renderer may name no plugin's layer (tests/canvas-names-no-plugin.test.js) and consume no composition. The product page and the
lab hand it to composeCanvas, which opens it on their root through the renderer's `openCanvasScene`, the scene appending the layers after
the ground; the export opens it with no root (server/svg.mjs).
*/
const foreign = Object.values(FOREIGN_LAYERS);
export const CANVAS_SCENE = { layers: CANVAS_LAYERS.map((name) => ({ name, attrs: { id: name }, ...(foreign.includes(name) ? { foreign: true } : {}) })) };
export const PAGE_STYLESHEETS = ['app/tokens.css', 'kernel/primitives.css', ...PRODUCT_CANVAS.flatMap((p) => p.stylesheets ?? []), ...CHROME_STYLESHEETS, 'app/canvas.css'];
