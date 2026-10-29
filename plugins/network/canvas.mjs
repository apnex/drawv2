/*
THE NETWORK'S CANVAS PART -- what the network brings to the page (C-a, H19.29; dev/design/unification/CANVAS-PLUGINS.md): its
link painter (plugins/network/link-painter.mjs) and its appearances on the anchor (plugins/network/anchor-appearance.mjs). Composed by the
product (product/canvas.mjs) with the other plugins' parts. H26.8's pipes move (dev/design/components/NATIVE-SHAPES.md section 4.6): and
its pipe painter (plugins/network/pipe-painter.mjs), the pipes a painted kind where the network drew them itself.
*/

import { LINK_PAINTERS } from './link-painter.mjs';
import { PIPE_PAINTERS } from './pipe-painter.mjs';
import { NETWORK_APPEARANCES } from './anchor-appearance.mjs';
import { LINK_PRESSES, LINK_HANDLE_SPECS } from './link-handles.mjs';
import { NETWORK_POINTS } from './anchor-points.mjs';
import { LINK_FOLLOWER } from './link-clone.mjs';
import { LINK_DESCRIBE, LINK_SELECT_ALL } from './link-facts.mjs';
import { NETWORK_REFLECTS } from './selection-reflects.mjs';
import { pathOf } from './network-queries.mjs';
import { linksBetween, makeLink } from './link-queries.mjs';
import { pairHolders } from './link-rules.mjs';
import { waypointRolesIn } from './roles.mjs';

// C-d: and its link's end handles, with the press row that opens the shared handle gesture on one
// C-e: and what a waypoint and a link cover at a point and in a box
export const NETWORK_CANVAS = { owner: 'network', stylesheets: ['plugins/network/tokens.css', 'plugins/network/network.css'], painters: [...LINK_PAINTERS, ...PIPE_PAINTERS], appearances: NETWORK_APPEARANCES, presses: LINK_PRESSES, handles: LINK_HANDLE_SPECS, at: NETWORK_POINTS,
	deleteRanks: { link: 2 },   // a link is deleted before the anchors it joins
	follows: [LINK_FOLLOWER],   // C-e: a link both of whose ends were cloned is cloned with them
	describe: LINK_DESCRIBE, selectAll: LINK_SELECT_ALL,   // C-e: how a link reads, and Ctrl+A
	reflects: NETWORK_REFLECTS,   // C-e: what a selected link lights -- its waypoints, its blockers
	// C-f: what it draws, and what a run-mode press aims at -- a waypoint, an endpoint to arm; and its count
	drawn: ['.link'], runTargets: ['.waypoint'], helpWords: { link: 'a link' },
	linkDrag: { pathOf, makeLink, rolesOf: waypointRolesIn, admitted: (model, src, dst, via) => !pairHolders({ src, dst, via }, linksBetween(model, src, dst), model).length },
	tally: { rank: 1, word: 'links', of: (model) => model.all('link').length } };
