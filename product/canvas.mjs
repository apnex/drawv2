/*
THE PRODUCT'S CANVAS -- the canvas parts production ships, in the order their kinds are drawn on a full render (C-a, H19.29;
dev/design/unification/CANVAS-PLUGINS.md). Each plugin hands the page a part -- its painters now, its picks, placements,
handles and rows as the later stages land -- and the page composes these, as the store composes `productKinds`
(product/kinds.mjs). The product page and the lab hand it to `composeCanvas`; a page composed without a plugin's part draws
none of its kinds.
*/

import { ZONES_CANVAS } from '../zones/zone-painter.mjs';
import { GROUPS_CANVAS } from '../groups/group-painter.mjs';

// back to front on a full render: zones, then group hulls, behind everything the renderer still draws itself
export const PRODUCT_CANVAS = [ZONES_CANVAS, GROUPS_CANVAS];
