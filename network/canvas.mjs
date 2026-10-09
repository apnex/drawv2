/*
THE NETWORK'S CANVAS PART -- what the network brings to the page (C-a, H19.29; dev/design/unification/CANVAS-PLUGINS.md): its
link painter (network/link-painter.mjs) and its appearances on the anchor (network/anchor-appearance.mjs). Composed by the
product (product/canvas.mjs) with the other plugins' parts.
*/

import { LINK_PAINTERS } from './link-painter.mjs';
import { NETWORK_APPEARANCES } from './anchor-appearance.mjs';
import { LINK_PRESSES, LINK_HANDLE_SPECS } from './link-handles.mjs';
import { NETWORK_POINTS } from './anchor-points.mjs';

// C-d: and its link's end handles, with the press row that opens the shared handle gesture on one
// C-e: and what a waypoint and a link cover at a point and in a box
export const NETWORK_CANVAS = { owner: 'network', painters: LINK_PAINTERS, appearances: NETWORK_APPEARANCES, presses: LINK_PRESSES, handles: LINK_HANDLE_SPECS, at: NETWORK_POINTS,
	deleteRanks: { link: 2 } };   // a link is deleted before the anchors it joins
