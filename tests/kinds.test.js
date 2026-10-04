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
import { PRODUCT_KINDS, productKinds } from '../planner/kinds.mjs';
import { commit, plan } from '../planner/txn.mjs';
import { linkTenant } from '../network/link-reactions.mjs';
import { Log } from '../planner/log.mjs';
import { validateDoc, validateSelectionIds, validateEntity } from '../planner/validate.js';

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
// a plan names its link tenant since S-b (H18.12); these tests are about kinds, so a bare one serves
const BARE = linkTenant({ owner: 'bare links', keepsOrphan: () => false, says: {} });

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
	const m = new Model({ kinds: WITH_PROBE }), log = new Log(), opts = { kinds: WITH_PROBE, links: BARE };
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
	assert.equal(plan(product, [{ op: 'put', kind: 'probe', entity: { id: 'probe-00000b', at: NODE.id } }], { links: BARE }).error, 'unknown kind: probe');
	assert.throws(() => plan(new Model({ kinds: WITH_PROBE }), [{ op: 'put', kind: 'node', entity: NODE }], { links: BARE }),
		/plan: the model is composed with kinds node, link, zone, group, probe and the planner with node, link, zone, group/);
	assert.throws(() => plan(product, [{ op: 'put', kind: 'node', entity: NODE }], { kinds: WITH_PROBE, links: BARE }), /plan: the model is composed with kinds/);
	assert.throws(() => plan(product, [{ op: 'put', kind: 'node', entity: NODE }], { kinds: CORE_KINDS, links: BARE }), /kinds is a composition whose every row carries its checks/);
	// S-b: and no plan runs without a link tenant -- none is a default
	assert.throws(() => plan(product, [{ op: 'put', kind: 'node', entity: NODE }]), /plan: no link tenant/);
	assert.throws(() => commit(product, new Log(), { ops: [{ op: 'put', kind: 'node', entity: NODE }] }, 'x', 'x'), /commit: no link tenant/);
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

/*
S-a (H18.11; ruled 2026-10-03, G3) -- A PLUGIN CONTRIBUTES FIELDS TO A KIND IT DOES NOT OWN. The network brings `transit` to
the product's node: merged into the node's row when the composition is built, refused by a composition without it.
*/
const EXT = (fields = { colour: (v) => typeof v === 'string' }, extra = {}) => ({ kind: 'node', owner: 'a test plugin', extends: true, fields, optional: Object.keys(fields), ...extra });

test('S-a: an extension\'s fields join the kind it extends -- checked, optional, and owned by who brought them', () => {
	const k = composeKinds([...productRows(), EXT()], 't');
	assert.equal(typeof k.row('node').fields.colour, 'function');
	assert.ok(k.optional.node.has('colour'), 'optional: a document without the plugin is still valid with it');
	assert.equal(k.contributed('node', 'colour'), 'a test plugin');
	assert.equal(k.contributed('node', 'type'), null, 'the owner\'s own fields are not contributed');
	assert.deepEqual(k.list, PRODUCT_KINDS.list, 'an extension adds no kind');
	assert.equal(validateEntity('node', { ...NODE, colour: 'red' }, { kinds: k }), null);
	assert.match(validateEntity('node', { ...NODE, colour: 7 }, { kinds: k }), /invalid value for node\.colour/);
	assert.match(validateEntity('node', { ...NODE, colour: 'red' }), /unknown field node\.colour/, 'and a composition without it refuses the field');
});

test('S-a: an extension is refused when built -- each way it can be wrong, named', () => {
	const refused = (rows, re) => assert.throws(() => composeKinds(rows, 't'), re);
	refused([...productRows(), EXT({ type: () => true })], /field node\.type is claimed by the product and by a test plugin/);
	refused([...productRows(), EXT(), { ...EXT(), owner: 'another' }], /field node\.colour is claimed by a test plugin and by another/);
	refused([...productRows(), EXT(undefined, { kind: 'probe' })], /adds fields to probe, which this composition does not include/);
	refused([...productRows(), EXT(undefined, { optional: [] })], /must be optional/);
	refused([...productRows(), EXT({ colour: true })], /has no check/);
	refused([...productRows(), EXT({})], /adds no fields/);
	refused([...productRows(), EXT(undefined, { cap: 9 })], /unknown key cap/);
});

test('S-a: the network brings transit, and the product names none; a tenant reading a field it lacks is refused', async () => {
	const { NETWORK_ROWS } = await import('../network/kinds.mjs');
	const { createNetwork } = await import('../network/network.mjs');
	const { createTransit } = await import('../network/transit.mjs');
	const { plan } = await import('../planner/txn.mjs');
	assert.equal('transit' in PRODUCT_KINDS.row('node').fields, false, 'the product\'s node row names no transit');
	const net = productKinds(...NETWORK_ROWS);
	assert.equal(net.contributed('node', 'transit'), 'the network');
	const withPipesOnly = productKinds(NETWORK_ROWS.find((r) => r.kind === 'pipe'));
	const m = new Model({ kinds: withPipesOnly });
	assert.throws(() => plan(m, [{ op: 'del', kind: 'node', id: 'node-00000a' }], { links: createNetwork(createTransit()).links, kinds: withPipesOnly }), /needs the field node\.transit/);
});

test('S-b: undo and redo replay only over a model composed with their kinds -- a mismatch is refused by name', async () => {
	const { undo, redo } = await import('../planner/txn.mjs');
	const product = new Model(), log = new Log();
	assert.equal(commit(product, log, { ops: [{ op: 'put', kind: 'node', entity: NODE }] }, 'x', 'x', { links: BARE }).ok, true);
	assert.throws(() => undo(product, log, null, { kinds: WITH_PROBE }), /undo: the model is composed with kinds/);
	assert.throws(() => redo(product, log, { kinds: WITH_PROBE }), /redo: the model is composed with kinds/);
});
