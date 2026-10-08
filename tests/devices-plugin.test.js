/*
O-e1 (H19.21; dev/design/unification/KINDS-AS-PLUGINS.md section 16; O4) -- WHETHER A DEVICE IS COMPOSED ON AN ANCHOR IS THE
DEVICES PLUGIN'S QUESTION, NOT THE CORE'S.

The director (O4): "The core holds only the anchor", and an anchor carries no type. The core answered, by reading `type`,
whether an anchor is a device or a waypoint (model/anchors.mjs), named it by its drawn word (model/anchor-words.mjs), made
devices, text panels and waypoints (`Model#makeNode`, `makeTextBox`, `makeWaypoint`) and said which device or waypoint is on a
cell (`occupiedAt`, `waypointAt`). Those are the devices plugin's now (devices/); the core keeps the anchor: its stored kind,
resolving a reference to one, and which anchor is on a cell (`occupiedAnyAt`). Nothing a user sees changes.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Model, KINDS } from './fixtures/composed.mjs';
import { attachRelations } from '../engine/store.mjs';
import { cellOf } from '../kernel/geometry.mjs';
import * as coreAnchors from '../model/anchors.mjs';

const code = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const devices = async () => ({ ...(await import('../devices/device-shapes.mjs')), ...(await import('../devices/make-node.mjs')),
	...(await import('../devices/occupancy.mjs')), ...(await import('../devices/anchor-words.mjs')) });
const board = (indexed) => {
	const m = new Model();
	if (indexed) attachRelations(m, { cellOf });
	m.put('node', { id: 'node-0e0001', name: 'r', type: 'router', shape: 'circle', x: 0, y: 0 });
	m.put('node', { id: 'node-0e0002', name: 'w', x: 60, y: 0 });
	return m;
};

test('O-e1: an anchor resolves whether or not a device is composed on it, and either occupies its cell -- the state under test', () => {
	const m = board(false);
	assert.equal(m.endpointOf('node-0e0001').name, 'r');
	assert.equal(m.endpointOf('node-0e0002').name, 'w');
	assert.equal(m.occupiedAnyAt({ x: 0, y: 0 }), true);
	assert.equal(m.occupiedAnyAt({ x: 60, y: 0 }), true);
	assert.equal(m.occupiedAnyAt({ x: 120, y: 0 }), false);
});

test('O-e1: the core\'s anchor module holds the anchor alone -- its stored kind, the anchor kinds, and resolving one', () => {
	assert.deepEqual(Object.keys(coreAnchors).sort(), ['ANCHOR_KINDS', 'BARE_KIND', 'anchorOf']);
	for (const f of ['model/anchors.mjs', 'model/model.mjs', 'model/invariants.mjs', 'model/shape.mjs']) {
		assert.doesNotMatch(code(f), /isTypedEntity|isBareEntity|typedNodes|bareAnchors?\b|drawnKind|makeNode|makeTextBox|makeWaypoint/, `${f} asks a device question`);
	}
	assert.doesNotMatch(code('model/model.mjs'), /\.type\b/, 'the core Model reads no type');
	assert.equal(fs.existsSync(new URL('../model/anchor-words.mjs', import.meta.url)), false, 'the drawn word left the core');
	const m = board(false);
	for (const name of ['makeNode', 'makeTextBox', 'makeWaypoint', 'occupiedAt', 'waypointAt']) assert.equal(typeof m[name], 'undefined', `the Model has no ${name}`);
});

test('O-e1: the devices plugin makes devices, panels and waypoints as the Model did', async () => {
	const { makeNode, makeTextBox, makeWaypoint } = await devices();
	const m = board(false);
	const strip = (e) => ({ ...e, id: e.id.replace(/[0-9a-f]{6}$/, 'x') });
	assert.deepEqual(strip(makeNode(m, 'router', { x: 120, y: 0 })), { id: 'node-x', name: 'router-1', order: 1, type: 'router', shape: 'circle', x: 120, y: 0 });
	assert.deepEqual(strip(makeNode(m, 'host', { x: 120, y: 0 }, 'square')).shape, 'square');
	assert.deepEqual(strip(makeWaypoint(m, { x: 180, y: 0 })), { id: 'node-x', name: 'waypoint-1', order: 1, x: 180, y: 0 });
	assert.deepEqual(strip(makeTextBox(m, { x: 0, y: 60 }, { cols: 3, rows: 1 })), { id: 'node-x', name: '', type: 'text', shape: 'circle', x: 0, y: 60,
		span: { cols: 3, rows: 1 }, content: [{ at: [0, 0], cols: 3, rows: 1, content: 'text', value: '', align: 'left' }] });
});

test('O-e1: the devices plugin says which device or waypoint is on a cell -- from the index and from the scan alike', async () => {
	const { occupiedAt, waypointAt, isTypedEntity, isBareEntity, drawnKind } = await devices();
	for (const indexed of [true, false]) {
		const m = board(indexed);
		assert.equal(!!m.index, indexed);
		assert.equal(occupiedAt(m, { x: 0, y: 0 }), true, 'a device on its cell');
		assert.equal(occupiedAt(m, { x: 60, y: 0 }), false, 'a waypoint is no device');
		assert.equal(waypointAt(m, { x: 60, y: 0 })?.id, 'node-0e0002');
		assert.equal(waypointAt(m, { x: 0, y: 0 }), undefined);
	}
	const m = board(false);
	assert.equal(isTypedEntity('node', m.get('node', 'node-0e0001')), true);
	assert.equal(isBareEntity('node', m.get('node', 'node-0e0002')), true);
	assert.equal(drawnKind('node', m.get('node', 'node-0e0002')), 'waypoint');
	assert.equal(drawnKind('node', m.get('node', 'node-0e0001')), 'node');
});
