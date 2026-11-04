/*
H26.6's move 12 (dev/design/components/PAN-ZOOM.md section 3.8, "The occupancy index"; PZ26; 5.1 row 12) -- THE OCCUPANCY INDEX KEYED BY
THE DEVICE LATTICE THE COMPOSITION HANDS. engine/relations.mjs keyed a point's cell by the node grid's `nearest`, injected; now the
composition hands `deviceLattice(model)`, the diagram's device lattice, asked on each change -- a lattice other than the one the index was
built on builds it again, as a load does -- so a grid of another size keys every anchor by its own squares. At 60 every composition hands the node lattice
and no key moves (the record and gesture corpora unchanged); a lattice of 80 here stands in for the grid move 15 lets a diagram store.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Model } from './fixtures/composed.mjs';
import { attachRelations } from '../engine/store.mjs';
import { NODE_GRID, latticeGrids } from '../kernel/geometry.mjs';

const AT_80 = latticeGrids({ pitch: 80, offset: 0 }).unbounded;
const node = (id, x, y) => ({ id, name: id, type: 'host', x, y });

test('H26.6 move 12, PZ26: the index keys each anchor by the lattice the composition hands -- at 60 the node lattice, at 80 that one\'s squares', () => {
	const m = new Model();
	m.load({ nodes: [node('node-0a0001', 160, -80), node('node-0a0002', 120, 0)], links: [], zones: [], groups: [] });
	attachRelations(m, { deviceLattice: () => AT_80 });
	assert.deepEqual(m.index.anchorsAt({ x: 165, y: -70 }), ['node-0a0001'], 'a point near 160,-80 is in its square of 80');
	assert.equal(m.occupiedAnyAt({ x: 120, y: 0 }), true, '120,0 lies in square 2,0 of 80 -- 160,0 -- where the node at 120 is filed');
	assert.deepEqual(m.index.anchorsAt({ x: 160, y: 0 }), ['node-0a0002'], 'nearest 160,0 on the lattice of 80');
	const at60 = new Model();
	at60.load({ nodes: [node('node-0a0002', 120, 0)], links: [], zones: [], groups: [] });
	attachRelations(at60, { deviceLattice: () => NODE_GRID });
	assert.deepEqual([at60.index.anchorsAt({ x: 120, y: 0 }), at60.index.anchorsAt({ x: 160, y: 0 })], [['node-0a0002'], []], 'control: on the node lattice, 160,0 is cell 3,0, empty');
});

test('H26.6 move 12, PZ26: the index is built again when the composition hands another lattice -- the grid changed -- and on a load', () => {
	const m = new Model();
	m.load({ nodes: [node('node-0b0001', 120, 0)], links: [], zones: [], groups: [], layouts: [{ id: 'layout-000001', name: 'node', pitch: 60, offset: 0, ext: { x: 900, y: 480 } }] });
	attachRelations(m, { deviceLattice: (model) => (model.get('layout', 'layout-000001')?.pitch === 80 ? AT_80 : NODE_GRID) });
	assert.deepEqual(m.index.anchorsAt({ x: 160, y: 0 }), [], 'built at 60: 160,0 is an empty cell');
	m.put('node', node('node-0b0002', 600, 600));
	assert.deepEqual(m.index.anchorsAt({ x: 600, y: 600 }), ['node-0b0002'], 'an anchor\'s change applied, on the lattice it was built on');
	m.set('layout', 'layout-000001', { pitch: 80 });
	assert.deepEqual([m.index.anchorsAt({ x: 160, y: 0 }), m.index.anchorsAt({ x: 640, y: 640 })], [['node-0b0001'], ['node-0b0002']], 'the grid changed: built again, every anchor keyed by its square of 80');
	m.load({ nodes: [node('node-0b0003', 0, 0)], links: [], zones: [], groups: [], layouts: [{ id: 'layout-000001', name: 'node', pitch: 60, offset: 0, ext: { x: 900, y: 480 } }] });
	assert.deepEqual([m.index.anchorsAt({ x: 20, y: 0 }), m.index.anchorsAt({ x: 40, y: 0 })], [['node-0b0003'], []], 'a load builds it again, back on the node lattice');
	// and the engine names no kind for it: the composition decides what a grid is
	assert.doesNotMatch(fs.readFileSync(new URL('../engine/store.mjs', import.meta.url), 'utf8'), /'layout'/, 'engine/store.mjs names no layout kind');
});

test('H26.6 move 12, PZ26: each composition hands the device lattice -- the product\'s and the lab\'s -- and the engine imports no grid', () => {
	for (const f of ['app/src/compose-canvas.js', 'lab/src/root.js']) {
		assert.match(fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'), /attachRelations\(\w+, \{ deviceLattice: \(\) => NODE_GRID \}\)/, `${f} hands the device lattice`);
	}
	for (const f of ['engine/relations.mjs', 'engine/store.mjs']) {
		assert.doesNotMatch(fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'), /from '\.\.\/kernel\//, `${f} imports no kernel module`);
	}
});
