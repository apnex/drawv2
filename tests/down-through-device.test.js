/*
B309 -- A DOWN LINK PINNED THROUGH A DEVICE IS DRAWN ALONG ITS INTENT, AS ONE PINNED THROUGH A WAYPOINT IS.

H1 ruled that a down link has no route and is drawn along its intent, saying so, so no reader takes its path for a live
link's. The intent was the Model's straight path -- src, each via, dst -- which accepted only a bare anchor as a via, and
answered null for any other: written when every pin was a waypoint. H19.10 (Z1) let a link be pinned through a device whose
transit is on, so a down link through one had no path at all -- REST and the CLI answered `path: null`, and the canvas drew
it from the same null. A via is any anchor now: the anchor's position is the intent, whether a device is composed on it.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model, KINDS } from './fixtures/composed.mjs';
import { readModel, linkReading } from '../network/read-model.mjs';

const nodes = [
	{ id: 'node-0a0001', name: 'a', type: 'host', shape: 'circle', x: 0, y: 0 },
	{ id: 'node-0a0002', name: 'r', type: 'router', shape: 'circle', x: 120, y: 0, transit: true },
	{ id: 'node-0a0003', name: 'b', type: 'host', shape: 'circle', x: 240, y: 0 },
	{ id: 'node-0a0004', name: 'w', x: 120, y: 120 },
];
const viaDevice = { id: 'link-0a0005', name: 'l1', src: 'node-0a0001', dst: 'node-0a0003', via: ['node-0a0002'] };
const viaBend = { id: 'link-0a0006', name: 'l2', src: 'node-0a0001', dst: 'node-0a0003', via: ['node-0a0004'] };
const board = () => { const m = new Model(); for (const n of nodes) m.put('node', n); m.put('link', viaDevice); m.put('link', viaBend); return m; };

test('B309: a down link pinned through a waypoint is drawn along its intent -- the state under test', () => {
	const m = board();
	assert.equal(m.isLinkDown(viaBend), true, 'no pipes: down');
	assert.deepEqual(m.pathOf(viaBend), [[0, 0], [120, 120], [240, 0]]);
});

test('B309: a down link pinned through a device is drawn along its intent, through the device', () => {
	const m = board();
	assert.equal(m.isLinkDown(viaDevice), true, 'no pipes: down');
	assert.deepEqual(m.pathOf(viaDevice), [[0, 0], [120, 0], [240, 0]], 'the canvas draws this path');
});

test('B309: and REST and the CLI read it so -- its intent, no route, down', () => {
	const m = readModel({ meta: { id: 'diagram-0a0000', name: 'd' }, nodes, zones: [], groups: [], links: [viaDevice], pipes: [] }, KINDS);
	assert.deepEqual(linkReading(m, m.get('link', viaDevice.id)), { path: [[0, 0], [120, 0], [240, 0]], route: null, down: true, blockers: [] });
});

test('B309: a via that is no anchor still leaves the link with no path -- a missing bend is as dangling as a missing end', () => {
	const m = board();
	assert.equal(m.straightPath({ ...viaDevice, via: ['node-0a00ff'] }), null);
});
