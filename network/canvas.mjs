/*
THE NETWORK'S CANVAS PART -- what the network brings to the page (C-a, H19.29; dev/design/unification/CANVAS-PLUGINS.md): its
link painter (network/link-painter.mjs) and its appearances on the anchor (network/anchor-appearance.mjs). Composed by the
product (product/canvas.mjs) with the other plugins' parts.
*/

import { LINK_PAINTERS } from './link-painter.mjs';
import { NETWORK_APPEARANCES } from './anchor-appearance.mjs';
import { LINK_PRESSES, LINK_HANDLE_SPECS } from './link-handles.mjs';
import { NETWORK_POINTS } from './anchor-points.mjs';
import { LINK_FOLLOWER } from './link-clone.mjs';
import { LINK_DESCRIBE, LINK_SELECT_ALL } from './link-facts.mjs';
import { NETWORK_REFLECTS } from './selection-reflects.mjs';

// C-d: and its link's end handles, with the press row that opens the shared handle gesture on one
// C-e: and what a waypoint and a link cover at a point and in a box
export const NETWORK_CANVAS = { owner: 'network', painters: LINK_PAINTERS, appearances: NETWORK_APPEARANCES, presses: LINK_PRESSES, handles: LINK_HANDLE_SPECS, at: NETWORK_POINTS,
	deleteRanks: { link: 2 },   // a link is deleted before the anchors it joins
	follows: [LINK_FOLLOWER],   // C-e: a link both of whose ends were cloned is cloned with them
	describe: LINK_DESCRIBE, selectAll: LINK_SELECT_ALL,   // C-e: how a link reads, and Ctrl+A
	reflects: NETWORK_REFLECTS,   // C-e: what a selected link lights -- its waypoints, its blockers
	// C-f: what it draws, and what a run-mode press aims at -- a waypoint, an endpoint to arm; and its count
	drawn: ['.link'], runTargets: ['.waypoint'], tally: { rank: 1, word: 'links', of: (model) => model.all('link').length } };
