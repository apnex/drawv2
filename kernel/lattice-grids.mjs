// LATTICE GRIDS -- a lattice opened from a layout record's form, and the device's unit as a lattice.
// H26.6's move 13 (dev/design/components/PAN-ZOOM.md section 3.9, GR16; appendix B, move 13, E16): moved from kernel/geometry.mjs,
// unchanged but for NODE_GRID's name, so the planner's entry, which loads kernel/geometry.mjs for `diagramLattices`, loads neither.
import { STD } from './spec.mjs';
import { openGrid } from '@apnex/snap-grid';   // the lattice part alone composes the component (tools/layers.mjs COMPONENTS)

/*
  latticeGrids(record)  a record of the layouts plugin's form, { pitch, offset, ext? }, opened into { bounded, unbounded }: the
                        grid bounded by the extent -- each axis from -ext to ext -- and the grid with no bounds; `bounded` is
                        null for a record with no extent. A record snap-grid refuses throws, naming every problem, so a bad
                        lattice fails where it is opened rather than answering wrongly later. The grids part's dots ask it for a
                        tier's lattice, `every` squares apart through a layout record's origin (plugins/layouts/layout-canvas.mjs)
  UNIT_GRID             the device's unit, 60 -- `STD.pitch`, the size of a span's square, a socket's step, a content cell -- as a
                        lattice, asked only for a span from cell 0,0 (GR16): what a device measures, never where a position lies.
                        It was NODE_GRID, which every reader asked, a position's and a size's alike, until move 13 told them apart
*/
export function latticeGrids({ pitch, offset, ext } = {}) {
	const lattice = { shape: 'square', pitch, origin: { x: offset, y: offset } };
	const open = (declaration) => {
		const opened = openGrid(declaration);
		if (!opened.ok) throw new Error(`latticeGrids: the lattice of pitch ${pitch}, offset ${offset}${ext ? `, extent ${ext.x} x ${ext.y}` : ''} is refused -- ${opened.problems.map((p) => `${p.problem} at ${p.pointer || '/'}`).join(', ')}`);
		return opened.grid;
	};
	return {
		bounded: ext === undefined ? null : open({ ...lattice, bounds: { min: { x: -ext?.x, y: -ext?.y }, max: { x: ext?.x, y: ext?.y } } }),
		unbounded: open(lattice),
	};
}
export const UNIT_GRID = latticeGrids({ pitch: STD.pitch, offset: 0 }).unbounded;
