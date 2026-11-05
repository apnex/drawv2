// LATTICE GRIDS -- the device's unit as a lattice, and a coarser lattice through another's origin.
// H26.6's move 13 (dev/design/components/PAN-ZOOM.md section 3.9, GR16; appendix B, move 13, E16): moved from kernel/geometry.mjs,
// unchanged but for NODE_GRID's name, so the planner's entry, which loads kernel/geometry.mjs for `diagramLattices`, loads neither.
// H26.6's move 14 (appendix A, the third move 14 row): `latticeGrids`, which opened a lattice from the layout table's record form
// `{ pitch, offset, ext }`, deleted with the table; the grids part's tiers ask `coarserLattice` of the diagram's own lattice.
import { STD } from './spec.mjs';
import { openGrid } from '@apnex/snap-grid';   // the lattice part alone composes the component (tools/layers.mjs COMPONENTS)

/*
  UNIT_GRID             the device's unit, 60 -- `STD.pitch`, the size of a span's square, a socket's step, a content cell -- as a
                        lattice, asked only for a span from cell 0,0 (GR16): what a device measures, never where a position lies.
                        It was NODE_GRID, which every reader asked, a position's and a size's alike, until move 13 told them apart
  coarserLattice(lattice, every)
                        the unbounded square lattice `every` times `lattice`'s pitch through the same origin -- a tier of the dots
                        (PZ24), holding the points whose indices are both multiples of `every`; opened once per pitch and origin.
                        A declaration snap-grid refuses throws, naming every problem
*/
function openSquare(pitch, origin) {
	const opened = openGrid({ shape: 'square', pitch, origin });
	if (!opened.ok) throw new Error(`lattice-grids: the lattice of pitch ${pitch}, origin ${origin.x},${origin.y} is refused -- ${opened.problems.map((p) => `${p.problem} at ${p.pointer || '/'}`).join(', ')}`);
	return opened.grid;
}
export const UNIT_GRID = openSquare(STD.pitch, { x: 0, y: 0 });
const COARSER = new Map();   // `pitch|x|y` -> its lattice, opened once
export function coarserLattice(lattice, every) {
	const { pitch, origin } = lattice.declaration, key = `${pitch * every}|${origin.x}|${origin.y}`;
	if (!COARSER.has(key)) COARSER.set(key, openSquare(pitch * every, { x: origin.x, y: origin.y }));
	return COARSER.get(key);
}
