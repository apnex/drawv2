/*
H17.22 N-a -- A COMPOSITION BRINGS ITS KINDS, every kind a row of one shape (ruled 2026-10-02, "Plugins bring their own
kinds"; B273, B279).

What is held here: the row mechanism's refusals, made when a composition is built (model/shape.mjs `composeKinds`); a
Model and the planner composed with a plugin's kind store, validate, cap and cross-check it as they do the product's
five, and the product refuses it; a model and a planner composed differently are refused by name; and an anchor's
6-hex part is unique across both anchor kinds (N2). That production is unchanged is the rest of the suite: every
corpus and every existing test ran before and after.

The plugin kind here is a test's own, `probe`, so this stage proves the mechanism and not the network's pipe (N-b).
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeKinds, CORE_KINDS } from '../model/shape.mjs';
import { Model } from '../model/model.mjs';
import { PRODUCT_KINDS } from '../planner/kinds.mjs';
import { commit, plan } from '../planner/txn.mjs';
import { Log } from '../planner/log.mjs';
import { validateDoc, validateSelectionIds } from '../planner/validate.js';

// a plugin's kind: a probe sits at a node, is selectable, unnamed, and one document holds at most three
const PROBE = {
	kind: 'probe', owner: 'a test plugin', collection: 'probes', selectable: true, named: false, anchor: false,
	composite: [], optional: [], references: ['node'],
	fields: { id: (v) => typeof v === 'string' && /^probe-[0-9a-f]{6}$/.test(v), at: (v) => typeof v === 'string' },
	refers: (e, access) => (access.has('node', e.at) ? null : `probe at a node that does not exist: ${e.at}`),
	cap: 3,
};
const productRows = () => PRODUCT_KINDS.list.map((k) => PRODUCT_KINDS.row(k));
const WITH_PROBE = composeKinds([...productRows(), PROBE], 'a test composition');
const NODE = { id: 'node-00000a', name: 'A', type: 'router', x: 0, y: 0, shape: 'circle' };

test('N-a: a composition lists its kinds and what each opts into', () => {
	assert.deepEqual(WITH_PROBE.list, ['node', 'link', 'zone', 'group', 'probe']);   // four since F-c: a waypoint is a node with no type
	assert.deepEqual(WITH_PROBE.selectable, ['node', 'link', 'zone', 'probe']);
	assert.deepEqual(WITH_PROBE.named, ['node', 'link', 'zone', 'group'], 'a probe opts out of names (N5)');
	assert.deepEqual(WITH_PROBE.anchors, ['node']);
	assert.equal(WITH_PROBE.checked, true);
	assert.equal(CORE_KINDS.checked, false, 'the core holds storage only; the checks are the planner\'s');
	assert.deepEqual(CORE_KINDS.list, PRODUCT_KINDS.list);
});

test('N-a: a composition is refused when built -- each way a row can be wrong, named', () => {
	const refused = (rows, re) => assert.throws(() => composeKinds(rows, 't'), re);
	refused([...productRows(), { ...PROBE, kind: 'node', collection: 'more' }], /kind node is claimed by the product and by a test plugin/);
	refused([...productRows(), { ...PROBE, references: ['node', 'pipe'] }], /kind probe references pipe, which this composition does not include/);
	refused([...productRows(), { ...PROBE, fields: { ...PROBE.fields, at: true } }], /kind probe: field at has no check/);
	refused([...productRows(), { ...PROBE, fields: { at: PROBE.fields.at } }], /kind probe: no check for its id/);
	refused([...productRows(), { ...PROBE, optional: ['where'] }], /kind probe: optional names where, which it has no check for/);
	refused([...productRows(), { ...PROBE, named: true }], /kind probe is named but has no check for a name/);
	refused([...productRows(), { ...PROBE, composite: ['at'] }], /kind probe: nested fields are copied by the core's table only/);
	refused([...productRows(), { ...PROBE, collection: 'nodes' }], /kinds node and probe are both stored under nodes/);
	refused([...productRows(), { ...PROBE, kind: 'diagram' }], /diagram is a document id/);
	refused([...productRows(), { ...PROBE, colour: 'red' }], /kind probe: unknown row key colour/);
	refused([], /a composition is a list of kind rows/);
});

test('N-a: a Model composed with a plugin kind stores, round-trips and selects it; one without refuses it, naming it', () => {
	const m = new Model({ kinds: WITH_PROBE });
	m.put('node', NODE);
	m.put('probe', { id: 'probe-00000b', at: NODE.id });
	assert.deepEqual(m.toJSON().probes, [{ id: 'probe-00000b', at: NODE.id }]);
	const again = new Model({ kinds: WITH_PROBE });
	again.load(m.toJSON());
	assert.deepEqual(again.all('probe'), [{ id: 'probe-00000b', at: NODE.id }]);
	again.setSelection(['probe-00000b']);
	assert.deepEqual([...again.state.selection], ['probe-00000b'], 'a selectable plugin kind joins the selection');
	assert.equal(m.nextName('probe'), 'probe-1', 'an unnamed kind takes no part in the namespace');
	assert.throws(() => new Model().put('probe', { id: 'probe-00000b', at: NODE.id }), /Model: probe is not a kind this model was composed with \(node, link, zone, group\)/);
	assert.throws(() => new Model({ kinds: { list: ['node'] } }), /Model: kinds is a composition/);
});

test('N-a: the planner composed with the plugin kind validates it by its row -- fields, cross-entity check, cap', () => {
	const m = new Model({ kinds: WITH_PROBE }), log = new Log(), opts = { kinds: WITH_PROBE };
	const put = (entity) => ({ op: 'put', kind: 'probe', entity });
	assert.equal(commit(m, log, { ops: [{ op: 'put', kind: 'node', entity: NODE }] }, 'test', 'test', opts).ok, true);
	assert.equal(commit(m, log, { ops: [put({ id: 'probe-00000b', at: NODE.id })] }, 'test', 'test', opts).ok, true);
	assert.equal(commit(m, log, { ops: [put({ id: 'probe-00000c', at: 'node-0000ff' })] }, 'test', 'test', opts).error, 'probe at a node that does not exist: node-0000ff');
	assert.equal(commit(m, log, { ops: [put({ id: 'probe-00000c', at: NODE.id, colour: 'red' })] }, 'test', 'test', opts).error, 'unknown field probe.colour');
	assert.equal(commit(m, log, { ops: [put({ id: 'probe-0000zz', at: NODE.id })] }, 'test', 'test', opts).error, 'invalid id for probe: probe-0000zz');
	assert.equal(commit(m, log, { ops: [{ op: 'set', kind: 'probe', id: 'probe-00000b', patch: { at: 'node-0000ff' } }] }, 'test', 'test', opts).error,
		'probe at a node that does not exist: node-0000ff', 'a set is judged on the entity as it would stand');
	assert.equal(commit(m, log, { ops: [put({ id: 'probe-00000c', at: NODE.id }), put({ id: 'probe-00000d', at: NODE.id })] }, 'test', 'test', opts).ok, true);
	assert.equal(commit(m, log, { ops: [put({ id: 'probe-00000e', at: NODE.id })] }, 'test', 'test', opts).error, 'probe collection limit reached', 'its cap is its row\'s');
});

test('N-a: the product\'s planner refuses the plugin kind, and a model and planner composed differently are refused by name', () => {
	const product = new Model();
	assert.equal(plan(product, [{ op: 'put', kind: 'probe', entity: { id: 'probe-00000b', at: NODE.id } }]).error, 'unknown kind: probe');
	assert.throws(() => plan(new Model({ kinds: WITH_PROBE }), [{ op: 'put', kind: 'node', entity: NODE }]),
		/plan: the model is composed with kinds node, link, zone, group, probe and the planner with node, link, zone, group/);
	assert.throws(() => plan(product, [{ op: 'put', kind: 'node', entity: NODE }], { kinds: WITH_PROBE }), /plan: the model is composed with kinds/);
	assert.throws(() => plan(product, [{ op: 'put', kind: 'node', entity: NODE }], { kinds: CORE_KINDS }), /kinds is a composition whose every row carries its checks/);
});

test('N-a: a document with the plugin kind validates against its composition, and not against the product\'s', () => {
	const doc = { meta: { id: 'diagram-00000a', name: 'd', version: 0, schema: 2 }, nodes: [NODE], probes: [{ id: 'probe-00000b', at: NODE.id }],
		reveal: { origin: 1, beats: [{ interval: 0, ids: ['probe-00000b', NODE.id] }] }, selection: ['probe-00000b'] };
	assert.equal(validateDoc(doc, { kinds: WITH_PROBE }), null);
	assert.equal(validateDoc({ ...doc, probes: [{ id: 'probe-00000b', at: 'node-0000ff' }] }, { kinds: WITH_PROBE }), 'probe at a node that does not exist: node-0000ff (probe-00000b)');
	assert.equal(validateDoc({ ...doc, probes: Array.from({ length: 4 }, (_, i) => ({ id: `probe-00000${i}`, at: NODE.id })) }, { kinds: WITH_PROBE }), 'probes exceeds entity limit');
	assert.equal(validateDoc(doc), 'invalid selection id: probe-00000b', 'the product selects no probe');
	assert.equal(validateDoc({ ...doc, selection: [] }), 'invalid beat id: probe-00000b', 'and its grammar has no probe ids');
	assert.equal(validateSelectionIds(['probe-00000b']), 'invalid selection id: probe-00000b');
	assert.equal(validateSelectionIds(['probe-00000b'], WITH_PROBE), null);
});

// F-c (H18.5): one anchor kind now, so N2's uniqueness is the node collection's own; held still, by the minting path
test('N-a (N2): an anchor\'s 6-hex part is unique across both anchor kinds, and other kinds are free to repeat it', () => {
	const m = new Model();
	m.put('node', { ...NODE, id: 'node-111111' });
	const draws = [0x111111, 0x111111, 0x222222], real = Math.random;
	const drawing = (fn) => { const seq = [...draws]; Math.random = () => (seq.shift() ?? 0x333333) / 0xffffff; try { return fn(); } finally { Math.random = real; } };
	assert.equal(drawing(() => m.freshId('node')), 'node-222222', 'and so does a node');
	assert.equal(drawing(() => m.freshId('zone')), 'zone-111111', 'a zone is no anchor: its own collection is all it avoids');
	assert.equal(drawing(() => m.makeWaypoint({ x: 0, y: 0 }).id), 'node-222222', 'a waypoint skips the hex a node holds: the Model mints anchors through it');
});
