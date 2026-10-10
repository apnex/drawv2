/*
C-c (H19.31; dev/design/unification/CANVAS-PLUGINS.md, D1) -- WHICH KINDS ARE PLACED ON THE GRID, AND HOW, IS DECLARED BY THE
PART THAT BRINGS THEM.

Moving, duplicating, cloning and nudging asked "is it an anchor or a zone?" in product code (`[...ANCHOR_KINDS, 'zone']`,
`kind !== 'zone'`), and the clamp that keeps a moved selection on the surface branched the same way -- an anchor's footprint
from its device's span against the node extent, a zone's box against the zone extent. A canvas part declares its placed kinds
now -- `places: [{ kind, layout, ext, size(entity) -> { w, h } }]` -- and the canvas reads them: the zones plugin places the
zone on the half-offset grid within its extent; the product places the anchor on the node grid, its size a wide device's span
until B282 makes it several anchors (O4, the recorded width exception). Nothing a user sees changes.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Model } from './fixtures/composed.mjs';
import { placesOf } from '../app/src/snap.js';
import { nudgeSelection } from '../app/src/commands.js';
import { PRODUCT_CANVAS } from '../product/canvas.mjs';
import { ZONE_EXT } from '../layouts/layout-table.mjs';

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
});

test('C-c: a malformed place is refused when the places are composed, naming its owner', () => {
	assert.throws(() => placesOf([{ owner: 'p', places: [{ kind: 'x', layout: 'nowhere', ext: { x: 1, y: 1 }, size: () => ({ w: 0, h: 0 }) }] }]), /place: p's place for x names layout nowhere, which the kernel does not have/);
	assert.throws(() => placesOf([...PRODUCT_CANVAS, { owner: 'p', places: [{ kind: 'zone', layout: 'zone', ext: { x: 1, y: 1 }, size: () => ({ w: 0, h: 0 }) }] }]), /place: zone is placed by zones and by p/);
	// RESTATED at WD-b2 (H19.46): a place declares its size's source -- its own size, or its kind's parts -- and one declaring neither is refused, naming it
	assert.throws(() => placesOf([{ owner: 'p', places: [{ kind: 'x', layout: 'node', ext: { x: 1, y: 1 } }] }]), /place: x has no size -- p's place declares neither its own size nor that its kind's parts size it/);
});

test('C-c: a dragged zone snaps on its own half-offset grid, not the node grid', async () => {
	const { snappedDelta } = await import('../app/src/snap.js');
	const m = board();
	const ctx = { moved: [{ kind: 'zone', id: 'zone-0d0002', before: { x: 30, y: 30 } }], baseId: 'zone-0d0002', start: { x: 30, y: 30 } };
	assert.equal(snappedDelta(m, ctx, { x: 95, y: 30 }, false, PLACES).x, 60, 'to 90, the zone grid\'s cell -- the node grid would give 120');
});
