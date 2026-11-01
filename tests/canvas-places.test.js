/*
C-c (H19.31; dev/design/unification/CANVAS-PLUGINS.md, D1) -- WHICH KINDS ARE PLACED ON THE GRID, AND HOW, IS DECLARED BY THE
PART THAT BRINGS THEM.

Moving, duplicating, cloning and nudging asked "is it an anchor or a zone?" in product code (`[...ANCHOR_KINDS, 'zone']`,
`kind !== 'zone'`), and the clamp that keeps a moved selection on the surface branched the same way -- an anchor's footprint
from its device's span against the node extent, a zone's box against the zone extent. A canvas part declares its placed kinds
now -- `places: [{ kind, layout, ext, size(entity) -> { w, h } }]` -- and the canvas reads them: the zones plugin places the
zone on the half-offset grid within its extent; the product places the anchor on the node grid, its size a wide device's span
until B282 makes it several anchors (O4, the recorded width exception). Nothing a user sees changes.

AMENDED WD-b2 (H19.46): the layouts plugin places the anchor (plugins/layouts/layout-canvas.mjs) and the devices plugin sizes it -- a device
owns its size (WD10); a place declares its size's source (tests/layouts-canvas.test.js). The width exception ended at WD-a: a wide
device is one anchor (WD1).
AMENDED H26.8's grid move (dev/design/components/NATIVE-SHAPES.md section 3.2, "A place carries its grid alone"; 4.9): a place is
`{ kind, layout, grid, size | sizedBy }`, its extent its grid's `bounds`; the `ext` it kept beside the grid, and their check, deleted.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Model } from './fixtures/composed.mjs';
import { placesOf } from '../app/src/snap.js';
import { nudgeSelection } from '../app/src/commands.js';
import { PRODUCT_CANVAS } from '../product/canvas.mjs';
import { ZONE_EXT, ZONE_GRIDS } from '../plugins/layouts/layout-table.mjs';
import { NODE_GRID, nodeGridWithin } from '../kernel/geometry.mjs';
import { openGrid } from '@apnex/snap-grid';   // H26.8's grid move: a grid bounded off centre, which no product place carries

const code = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const PLACES = placesOf(PRODUCT_CANVAS);
const board = () => {
	const m = new Model();
	m.put('node', { id: 'node-0d0001', name: 'w', x: 0, y: 0 });
	m.put('zone', { id: 'zone-0d0002', name: 'z', x: 30, y: 30, w: 120, h: 60 });
	return m;
};
const moved = (cmd) => Object.fromEntries((cmd.entries ?? []).map((e) => [e.id, e.after]));

test('C-c: nudging moves a waypoint and a zone by a cell -- the state under test', () => {
	const m = board();
	const got = moved(nudgeSelection(m, ['node-0d0001', 'zone-0d0002'], 1, 0, PLACES));
	assert.equal(got['node-0d0001'].x, 60);
	assert.equal(got['zone-0d0002'].x, 90);
});

test('C-c: the places are the parts\' -- the zones plugin places the zone, the product the anchor', () => {
	assert.deepEqual([...PLACES.keys()].sort(), ['node', 'zone']);
	assert.equal(PLACES.get('zone').owner, 'zones');
	assert.equal(PLACES.get('zone').layout, 'zone');
	assert.equal(PLACES.get('node').layout, 'node');
});

test('C-c: without the zones plugin a zone is not placed -- nudging it moves nothing', () => {
	const m = board();
	const without = placesOf(PRODUCT_CANVAS.filter((p) => p.owner !== 'zones'));
	assert.deepEqual(moved(nudgeSelection(m, ['zone-0d0002'], 1, 0, without)), {});
});

test('C-c: a zone at the edge of its extent is held there by its own size', () => {
	const m = board();
	m.set('zone', 'zone-0d0002', { x: ZONE_EXT.x - 120 });
	assert.deepEqual(moved(nudgeSelection(m, ['zone-0d0002'], 1, 0, PLACES)), {}, 'its far edge is at the extent: no room');
});

test('C-c: the canvas names no list of placed kinds', () => {
	assert.doesNotMatch(code('app/src/input.js'), /ANCHOR_KINDS\.includes\(kind\) \|\| kind === 'zone'|!ANCHOR_KINDS\.includes\(kind\) && kind !== 'zone'/);
	assert.doesNotMatch(code('app/src/commands.js'), /!ANCHOR_KINDS\.includes\(kind\) && kind !== 'zone'/);
	const snap = code('app/src/snap.js');
	const clamp = snap.slice(snap.indexOf('export function clampDelta'), snap.indexOf('export function snappedDelta'));
	assert.doesNotMatch(clamp, /ANCHOR_KINDS|'zone'|ZONE_EXT|NODE_EXT|span/, 'the clamp reads each kind\'s declared place');
	// H26.8's grid move: and its extent is the bounds of the grid the place carries -- no `ext` beside it
	assert.match(clamp, /place\.grid\.declaration\.bounds/, 'the clamp reads the place\'s grid\'s bounds');
	assert.doesNotMatch(clamp, /\.ext\b/, 'and no extent of its own');
});

// RESTATED at H26.1 (SNAP-GRID.md section 5, appendix B): a place keeps its layout and extent and carries its grid, bounded by that
// extent -- a place carrying none, or one bounded otherwise, is refused, naming its owner; the kernel's layout names are gone.
// RESTATED at H26.8's grid move (NATIVE-SHAPES.md section 3.2, 4.9): a place carries its grid alone, its extent the grid's bounds -- one
// carrying no grid, or a grid with no bounds, is refused, naming its owner; the extent beside it, and its check, are gone
const grid1 = nodeGridWithin({ x: 1, y: 1 });
test('C-c: a malformed place is refused when the places are composed, naming its owner', () => {
	assert.throws(() => placesOf([{ owner: 'p', places: [{ kind: 'x', layout: 'nowhere', size: () => ({ w: 0, h: 0 }) }] }]), /place: p's place for x carries no bounded grid/);
	assert.throws(() => placesOf([{ owner: 'p', places: [{ kind: 'x', layout: 'node', grid: NODE_GRID, size: () => ({ w: 0, h: 0 }) }] }]), /place: p's place for x carries no bounded grid/, 'a grid with no bounds is no place\'s');
	assert.equal(placesOf([{ owner: 'p', places: [{ kind: 'x', layout: 'node', grid: grid1, size: () => ({ w: 0, h: 0 }) }] }]).get('x').owner, 'p', 'control: a place carrying a bounded grid');
	assert.throws(() => placesOf([...PRODUCT_CANVAS, { owner: 'p', places: [{ kind: 'zone', layout: 'zone', grid: grid1, size: () => ({ w: 0, h: 0 }) }] }]), /place: zone is placed by zones and by p/);
	// RESTATED at WD-b2 (H19.46): a place declares its size's source -- its own size, or its kind's parts -- and one declaring neither is refused, naming it
	assert.throws(() => placesOf([{ owner: 'p', places: [{ kind: 'x', layout: 'node', grid: grid1 }] }]), /place: x has no size -- p's place declares neither its own size nor that its kind's parts size it/);
});

// H26.8's grid move (NATIVE-SHAPES.md section 3.2, 4.9): the extent a drag is held in is the bounds of the grid the place carries, and
// nothing else: a place on a grid bounded off centre -- -60,-120 to 180,60, each edge its own -- holds its kind at each edge, so the clamp
// reads the bounds' min and max, never an extent mirrored about the origin; and the product's places carry no `ext` at all
test('H26.8: a place\'s extent is its grid\'s bounds -- a drag is held at each edge, and no place keeps an extent beside its grid', async () => {
	const { clampDelta } = await import('../app/src/snap.js');
	const opened = openGrid({ shape: 'square', pitch: 60, origin: { x: 0, y: 0 }, bounds: { min: { x: -60, y: -120 }, max: { x: 180, y: 60 } } });
	assert.ok(opened.ok, 'control: snap-grid opens the off-centre grid');
	const places = placesOf([{ owner: 'p', places: [{ kind: 'node', layout: 'node', grid: opened.grid, size: () => ({ w: 0, h: 0 }) }] }]);
	const m = board();
	const moved = [{ kind: 'node', id: 'node-0d0001', before: { x: 0, y: 0 } }];
	assert.ok(m.get('node', 'node-0d0001'), 'control: the moved anchor is on the board');
	assert.deepEqual(clampDelta(m, moved, { x: 600, y: -600 }, places), { x: 180, y: -120 }, 'held at the grid\'s max x and min y');
	assert.deepEqual(clampDelta(m, moved, { x: -600, y: 600 }, places), { x: -60, y: 60 }, 'and at its min x and max y');
	assert.deepEqual(clampDelta(m, moved, { x: 120, y: -60 }, places), { x: 120, y: -60 }, 'and free within them');
	for (const [kind, p] of PLACES) assert.equal('ext' in p, false, `${kind}: its place carries no extent of its own`);
	assert.deepEqual(PLACES.get('zone').grid.declaration.bounds, { min: { x: -ZONE_EXT.x, y: -ZONE_EXT.y }, max: { x: ZONE_EXT.x, y: ZONE_EXT.y } }, 'the zone\'s grid bounded by the zone layout\'s extent');
});

test('H26.1: each placed kind carries the grid its extent bounds -- the anchor the node grid\'s, the zone the zone grid\'s', () => {
	assert.deepEqual(PLACES.get('node').grid.declaration, { shape: 'square', pitch: 60, origin: { x: 0, y: 0 }, bounds: { min: { x: -900, y: -480 }, max: { x: 900, y: 480 } } });
	assert.deepEqual(PLACES.get('zone').grid.declaration, { shape: 'square', pitch: 60, origin: { x: 30, y: 30 }, bounds: { min: { x: -930, y: -510 }, max: { x: 930, y: 510 } } });
	assert.equal(PLACES.get('zone').grid, ZONE_GRIDS.bounded, 'the zone\'s, opened once by the layouts plugin');
});

test('C-c: a dragged zone snaps on its own half-offset grid, not the node grid', async () => {
	const { snappedDelta } = await import('../app/src/snap.js');
	const m = board();
	const ctx = { moved: [{ kind: 'zone', id: 'zone-0d0002', before: { x: 30, y: 30 } }], baseId: 'zone-0d0002', start: { x: 30, y: 30 } };
	assert.equal(snappedDelta(m, ctx, { x: 95, y: 30 }, false, PLACES).x, 60, 'to 90, the zone grid\'s cell -- the node grid would give 120');
});
