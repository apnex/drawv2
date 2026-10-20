/*
THE LAYOUTS PLUGIN'S CANVAS PART (WD-b2, H19.46; dev/design/unification/WIDE-DEVICES.md sections 5.1 and 12.4).

The two grids, drawn from the open diagram's layout records, and the anchor's place on the node layout. A record holds a grid's
geometry -- its pitch, the offset of its lattice and its extent -- so a grid's dots are read from it, lattice point by lattice
point within the extent (`points`, handed the Model; layouts/layout-records.mjs reads loudly). How a grid is shown is this
plugin's code, keyed by the layout's name: the page layer its dots go into, the dot, and -- for the zone grid, Shift being the
zone layer's key (DESIGN U1) -- the modifier and class that show it. The canvas draws a grid only where some part places a kind
on its lattice (app/src/snap.js `gridsOf`), so a page without the zones plugin draws no zone grid.

The anchor's place moved here from product/canvas.mjs, where it read a device's span for its size: it names the node layout and
takes its extent from the table (places keep the table while WD7 holds -- section 13, finding 5), and carries no size of its
own: its kind's parts size it -- a device's is the devices plugin's to declare (devices/device-footprint.mjs `DEVICE_SIZES`) --
and a waypoint, or every anchor on a page without the devices plugin, is one cell.

B200 -- THE NODE GRID'S DOT IS THE DOT A WAYPOINT HIGHLIGHTS: the kernel owns it as `gridDot`, and the waypoint renderer draws its
own circle at the same radius in a brighter fill, one layer up. The zone grid's dot keeps its own size: it marks a different
lattice, and reads as bigger on purpose because it shows only while Shift is held.
*/

import { gridDot, latticeGrids, nodeGridWithin } from '../kernel/geometry.mjs';
import { LAYOUT_TABLE } from './layout-table.mjs';
import { layoutNamed } from './layout-records.mjs';

/*
H26.1 (dev/design/components/SNAP-GRID.md appendix B): every point of a layout's lattice within its extent, row by row -- snap-grid's
positions in view, asked of the grid the diagram's record opens bounded by its extent (`latticeGrids`, which refuses a record it
cannot open, naming its problems), the region the extent, at a scale of one: no thinning, every position, by row then column.
*/
function latticePoints(record) {
	const { ext } = record;
	return latticeGrids(record).bounded.inView({ region: { kind: 'rect', x: -ext.x, y: -ext.y, w: 2 * ext.x, h: 2 * ext.y }, scale: 1 }).positions.map(({ point }) => ({ x: point.x, y: point.y }));
}

const grid = (layout, shown) => ({ layout, points: (model) => latticePoints(layoutNamed(model, layout)), ...shown });
const NODE_GRID = grid('node', { layer: 'grid-nodes', r: gridDot().radius });
const ZONE_GRID = grid('zone', { layer: 'grid-zones', r: 5, shownWith: 'shiftKey', cls: 'zonegrid' });

// its kind's parts size it -- the devices plugin a device, by its span; with no part answering, one cell (app/src/snap.js `placesOf`)
// H26.1: and it carries the node grid bounded by its extent, which it snaps to (`nodeGridWithin`, SNAP-GRID.md section 5)
const ANCHOR_EXT = LAYOUT_TABLE.find((l) => l.name === 'node').ext;
const ANCHOR_PLACE = { kind: 'node', layout: 'node', ext: ANCHOR_EXT, grid: nodeGridWithin(ANCHOR_EXT), sizedBy: 'parts' };

export const LAYOUTS_CANVAS = { owner: 'layouts', stylesheets: ['layouts/layouts.css'], places: [ANCHOR_PLACE], grids: [NODE_GRID, ZONE_GRID] };
