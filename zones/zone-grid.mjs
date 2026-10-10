/*
THE ZONE GRID -- the zones plugin's. C-e, step thirteen (H19.33; dev/design/unification/CANVAS-PLUGINS.md section 3: "a plugin
may bring a grid layer and when it shows").

The HALF-OFFSET lattice a zone's corners sit on (+-pitch/2 + k*pitch), edge to edge of the zone extent, drawn into the page's
`#grid-zones` layer. Its dot keeps its own size: it marks a different lattice from the anchor grid, and reads as bigger on
purpose because it only appears while Shift is held -- Shift is the zone-layer key (DESIGN U1) -- and never while a move or a
clone is under way, when Shift locks the axis instead. The class it shows by is the stylesheet's (app/style.css `.zonegrid`).
It was app/src/snap.js `zonePoints`, app/src/compose-canvas.js `ZONE_GRID_DOT` and app/src/overlay.js `zoneGrid`.
*/

import { STD } from '../kernel/spec.mjs';
import { ZONE_EXT } from '../layouts/layout-table.mjs';   // WD-b1: the zone layout's extent, the layouts plugin's

const GAP = STD.pitch;

export const ZONE_GRID = {
	layer: 'grid-zones',
	points: () => {
		const points = [];
		for (let y = -ZONE_EXT.y; y <= ZONE_EXT.y; y += GAP) for (let x = -ZONE_EXT.x; x <= ZONE_EXT.x; x += GAP) points.push({ x, y });
		return points;
	},
	r: 5,
	shownWith: 'shiftKey',
	cls: 'zonegrid',
};
