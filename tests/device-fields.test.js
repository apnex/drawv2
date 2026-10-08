/*
O-e2 (H19.21; dev/design/unification/KINDS-AS-PLUGINS.md section 16; O4) -- A DEVICE'S FIELDS ARE COMPOSED ONTO THE ANCHOR BY
THE DEVICES PLUGIN, A SPAWNER'S BY THE SIMULATION.

The director (O4): "The core holds only the anchor", and an anchor carries no type. The node's row held the anchor's facts
and the device's -- type, shape, span, content -- and the spawner's, with one cross-field rule over all of them. The anchor's
row holds id, name, x, y and order now; the devices plugin adds the device's fields with their rules, the simulation adds
`spawn` with its rule, as the network adds `transit` (S-a). For that, an extension may declare its nested fields and bring
a cross-field rule, run after the owner's and in the order the composition lists the extensions. Every message a writer
meets is unchanged, and nothing stored changes.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Model, KINDS, validateMutation, plan } from './fixtures/composed.mjs';
import { composeKinds, CORE_ROWS } from '../model/shape.mjs';
import { validateEntity, validateDoc } from '../planner/validate.js';

const code = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const plugin = async () => ({ ...(await import('../devices/device-fields.mjs')), ...(await import('../engine/spawn-field.mjs')) });
const device = { id: 'node-0d0001', name: 'r', type: 'router', shape: 'circle', x: 0, y: 0 };
const waypoint = { id: 'node-0d0002', name: 'w', x: 60, y: 0 };
const spawner = { interval: 1000, speed: 1, kind: 'packet', since: 1_700_000_000_000 };   // within model/limits.mjs
const put = (entity) => ({ action: 'put', kind: 'node', entity });

test('O-e2: a writer meets the same refusals -- a device stays a device, a waypoint carries no device field, a device no spawner', () => {
	const m = new Model(); m.put('node', device); m.put('node', waypoint);
	assert.equal(validateMutation(m, put({ ...device, id: 'node-0d0003', x: 120, span: { cols: 2, rows: 1 } })), null, 'a wide device');
	assert.equal(validateMutation(m, put({ ...waypoint, id: 'node-0d0004', x: 180, spawn: spawner })), null, 'a spawning waypoint');
	assert.equal(validateMutation(m, { action: 'set', kind: 'node', entity: { id: waypoint.id, type: 'router' } }),
		'a node\'s type is fixed when it is made -- a waypoint stays a waypoint, and a typed node keeps a type: node-0d0002');
	assert.equal(validateMutation(m, put({ ...waypoint, id: 'node-0d0005', x: 240, shape: 'square', span: { cols: 1, rows: 1 } })),
		'a waypoint (a node with no type) has no shape, span: node-0d0005');
	assert.equal(validateMutation(m, put({ ...device, id: 'node-0d0006', x: 300, spawn: spawner })), 'a typed node has no spawn: node-0d0006');
});

test('O-e2: production\'s node is the anchor\'s row with the devices plugin\'s, the simulation\'s and the network\'s fields composed on', async () => {
	const { DEVICE_FIELDS } = await plugin();
	for (const f of ['type', 'shape', 'span', 'content']) assert.equal(KINDS.contributed('node', f), 'devices', `${f} is the devices plugin's`);
	assert.equal(KINDS.contributed('node', 'spawn'), 'the simulation');
	assert.equal(KINDS.contributed('node', 'transit'), 'the network');
	for (const f of ['id', 'name', 'x', 'y', 'order']) assert.equal(KINDS.contributed('node', f), null, `${f} is the anchor's own`);
	assert.deepEqual([...KINDS.composite.node].sort(), ['content', 'span'], 'the nested fields, declared by the plugin that brings them');
	assert.deepEqual(DEVICE_FIELDS.composite, ['span', 'content']);
	// RESTATED at O-d (H19.22): the anchor's checks are composed by the product (product/kinds.mjs), the planner's no more
	const checks = code('product/kinds.mjs').split('\n').filter((l) => !/^import /.test(l)).join('\n');   // it imports the plugins it composes
	assert.doesNotMatch(checks, /\b(shape|span|content|spawn|SPAWN|SHAPES)\b|type:/, 'the anchor\'s checks name no device or spawner field');
	assert.deepEqual(CORE_ROWS[0].optional, ['order'], 'the core\'s anchor row: order alone is optional');
	assert.deepEqual(CORE_ROWS[0].composite, [], 'and nests nothing');
});

// a test anchor row: the anchor's own fields, checked
const ANCHOR = { ...CORE_ROWS[0], fields: { id: (v) => /^node-[0-9a-f]{6}$/.test(v), name: (v) => typeof v === 'string', x: Number.isFinite, y: Number.isFinite, order: Number.isInteger } };

test('O-e2: an anchor composed without the devices plugin refuses a device field by name, and without the simulation a spawner', async () => {
	const { DEVICE_FIELDS, SPAWN_FIELDS } = await plugin();
	const bare = composeKinds([ANCHOR], 'the anchor alone');
	assert.equal(validateEntity('node', waypoint, { kinds: bare }), null, 'a waypoint is an anchor');
	for (const f of ['type', 'shape', 'span', 'content', 'spawn']) {
		assert.equal(validateEntity('node', { ...waypoint, [f]: 'x' }, { kinds: bare }), `unknown field node.${f}`);
	}
	const devices = composeKinds([ANCHOR, DEVICE_FIELDS], 'the anchor and the devices plugin');
	assert.equal(validateEntity('node', device, { kinds: devices }), null, 'with the devices plugin, a device');
	assert.equal(validateEntity('node', { ...waypoint, spawn: spawner }, { kinds: devices }), 'unknown field node.spawn', 'but no spawner');
	const both = composeKinds([ANCHOR, DEVICE_FIELDS, SPAWN_FIELDS], 'the anchor, devices and the simulation');
	assert.equal(validateEntity('node', { ...waypoint, spawn: spawner }, { kinds: both }), null);
	const doc = (nodes) => ({ meta: { id: 'diagram-0d0000', name: 'd', version: 0, schema: 2 }, nodes, selection: [] });
	assert.match(validateDoc(doc([{ ...device, spawn: spawner }]), { kinds: both }) ?? '', /^a typed node has no spawn: node-0d0001/, 'the simulation\'s rule runs on a document too');
});

test('O-e2: an extension\'s nested fields and its cross-field rule are checked when the composition is built', async () => {
	const { DEVICE_FIELDS } = await plugin();
	assert.throws(() => composeKinds([ANCHOR, { ...DEVICE_FIELDS, composite: ['span', 'colour'] }], 't'), /devices's composite field colour for node is not one of its fields/);
	assert.throws(() => composeKinds([ANCHOR, { ...DEVICE_FIELDS, refers: 'no' }], 't'), /devices's rule for node is a function/);
	const ruled = composeKinds([{ ...ANCHOR, refers: () => 'the owner speaks first' }, DEVICE_FIELDS], 't');
	assert.equal(ruled.row('node').refers({ ...waypoint, shape: 'square' }, null, {}, null), 'the owner speaks first', 'the owner\'s rule runs before an extension\'s');
});

test('O-e2: an edit that sets a device\'s nested field to what it holds is no change -- the plugin\'s declaration keeps it so', () => {
	const m = new Model();
	const panel = { id: 'node-0d0007', name: '', type: 'text', shape: 'circle', x: 0, y: 60, span: { cols: 2, rows: 1 },
		content: [{ at: [0, 0], cols: 2, rows: 1, content: 'text', value: 'hi', align: 'left' }] };
	m.put('node', panel);
	const r = plan(m, [{ op: 'set', kind: 'node', id: panel.id, patch: { content: structuredClone(panel.content), span: { cols: 2, rows: 1 } } }]);
	assert.equal(r.ok, true);
	assert.deepEqual(r.ops, [], 'equal regions and footprint, compared whole: nothing to write, no version, no undo entry');
	const moved = plan(m, [{ op: 'set', kind: 'node', id: panel.id, patch: { span: { cols: 3, rows: 1 }, content: [{ ...panel.content[0], cols: 3 }] } }]);
	assert.equal(moved.ops.length, 1, 'a real change is still one');
});
