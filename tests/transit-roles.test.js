/*
B277 -- A WAYPOINT WHOSE TRANSIT IS OFF IS AN ENDPOINT, at any link count: never a bend, never a junction.

Transit off means what arrives stops (TRANSIT.md section 4, TR-5; the director, 2026-10-02: "transit:false is suppose to
disable bends AND junctions, and ONLY PERMIT endpoints"). The role derivation never read transit, so three links ending
at a non-transiting waypoint, or two differing in plane or direction, derived `junction` and drew its ring. One ring for
every count, the endpoint ring, as the director ruled the same day ("Same endpoint ring").

The other half is that nothing changes where transit is on or undeclared -- which is every anchor production has.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waypointRoles, waypointRolesIn } from '../kernel/network-roles.mjs';
import { waypointLayers } from '../kernel/network-appearance.mjs';

const W = 'node-e00001';
const L = (n, src, dst, extra = {}) => ({ id: `link-00000${n}`, src, dst, via: [], ...extra });
const SHAPES = {
	'no links': [],
	'one link': [L(1, 'node-000001', W)],
	'two plain links': [L(1, 'node-000001', W), L(2, W, 'node-000002')],
	'two, control with data': [L(1, 'node-000001', W, { control: true }), L(2, W, 'node-000002')],
	'two, both arriving': [L(1, 'node-000001', W, { direction: 'forward' }), L(2, 'node-000002', W, { direction: 'forward' })],
	'three links': [L(1, 'node-000001', W), L(2, W, 'node-000002'), L(3, W, 'node-000003')],
	'four links': [L(1, 'node-000001', W), L(2, W, 'node-000002'), L(3, W, 'node-000003'), L(4, 'node-000004', W)],
};
// what each shape is with transit on: today's matrix, which B277 must leave exactly as it was
const TRANSITING = {
	'no links': [], 'one link': ['endpoint'], 'two plain links': ['endpoint'], 'two, control with data': ['junction'],
	'two, both arriving': ['junction'], 'three links': ['junction'], 'four links': ['junction'],
};

test('B277: with transit off, a waypoint any links end at is an endpoint -- never a junction', () => {
	for (const [shape, links] of Object.entries(SHAPES)) {
		assert.deepEqual(waypointRoles(W, links, { transit: false }), links.length ? ['endpoint'] : [], shape);
	}
});

test('B277: with transit on or undeclared, every role is as it was', () => {
	for (const [shape, links] of Object.entries(SHAPES)) {
		assert.deepEqual(waypointRoles(W, links), TRANSITING[shape], `${shape}, undeclared`);
		assert.deepEqual(waypointRoles(W, links, { transit: true }), TRANSITING[shape], `${shape}, on`);
	}
});

test('B277: a link threaded through a non-transiting waypoint makes it no bend role either -- it has none', () => {
	assert.deepEqual(waypointRoles(W, [{ id: 'link-000001', src: 'node-000001', dst: 'node-000002', via: [W] }], { transit: false }), []);
});

test('B277: drawn, three links at a non-transiting waypoint take the endpoint ring and the transit ring, and no junction ring', () => {
	const links = SHAPES['three links'];
	const drawn = waypointLayers(waypointRoles(W, links, { transit: false }), 10, links, { transit: false }).map((l) => l.cls);
	assert.deepEqual(drawn, ['wp-anchor', 'wp-ring', 'wp-transit', 'wp-dot']);
});

test('B277: the roles in a model read its links and whether it declares transit off, so every reader asks one question', () => {
	const links = SHAPES['three links'];
	const model = (off) => ({ linksAt: (id) => (id === W ? links : []), stopsAt: (id) => off && id === W });
	assert.deepEqual(waypointRolesIn(model(true), W), ['endpoint']);
	assert.deepEqual(waypointRolesIn(model(false), W), ['junction']);
	assert.deepEqual(waypointRolesIn({ linksAt: () => links }, W), ['junction'], 'a model with no network declares nothing');
	assert.deepEqual(waypointRolesIn({}, W), [], 'and one with no incidence index has no links');
});

test('B278: the roles ask whether what arrives stops there, not whether the author declared it', () => {
	const links = SHAPES['three links'];
	const at = (stops, declared) => ({ linksAt: () => links, stopsAt: () => stops, declaresNoTransit: () => declared });
	assert.deepEqual(waypointRolesIn(at(true, false), W), ['endpoint'], 'stops by its type, declaring nothing: an endpoint');
	assert.deepEqual(waypointRolesIn(at(false, true), W), ['junction'], 'the declaration alone decides no role');
});

/*
F-e (H18.7; B277): transit is STORED on the anchor, so the export -- which composes no network -- reads it from the document
and draws the roles and the ring the canvas draws. Before, the export could not know an anchor's transit and drew a junction
where the canvas drew endpoints.
*/
test('F-e: the export and the canvas give a waypoint whose transit is off the same roles, and both draw its ring', async () => {
	const { Model } = await import('../model/model.mjs');
	const { createNetworkSession } = await import('../network/session.mjs');
	const { productKinds } = await import('../planner/kinds.mjs');
	const { PIPE_ROW } = await import('../network/pipe-kind.mjs');
	const { docToSchema } = await import('../kernel/adapt.mjs');
	const { resolve } = await import('../kernel/engine.mjs');
	const { svgDocument } = await import('../server/svg.mjs');
	const s = createNetworkSession();
	const m = new Model({ network: s.network, kinds: productKinds(PIPE_ROW) });
	m.put('node', { id: W, name: 'w', x: 0, y: 0, transit: false });
	[['node-00000a', -120, 0], ['node-00000b', 120, 0], ['node-00000c', 0, 120]].forEach(([id, x, y], i) => {
		m.put('node', { id, name: id, type: 'router', x, y });
		m.put('link', { id: `link-00000${i + 1}`, name: `l${i}`, src: id, dst: W });
	});
	const canvas = waypointRolesIn(m, W);
	assert.deepEqual(canvas, ['endpoint'], 'three links end there and transit is off: endpoints, never a junction');
	const exported = resolve(docToSchema(m.toJSON())).scene.find((e) => e.id === W).roles;
	assert.deepEqual(exported, canvas, 'the export reads the stored field and agrees');
	const body = svgDocument(m.toJSON()).split('</defs>').pop();
	assert.match(body, new RegExp(`<g id="${W}"><g class="waypoint endpoint">[^]*?stroke-dasharray`), 'and draws the transit ring the canvas draws');
	m.put('node', { id: W, name: 'w', x: 0, y: 0 });   // back on: the default, nothing stored
	assert.deepEqual(resolve(docToSchema(m.toJSON())).scene.find((e) => e.id === W).roles, ['junction']);
});

test('F-e: transit survives a reload -- stored in the document, written by the store and read back at boot', async () => {
	const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path');
	const { Store } = await import('../server/store.js');
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fe-'));
	try {
		const store = new Store(dir, { flushMs: 3_600_000, authz: false });
		await store.init();
		const id = store.create('fe').model.state.meta.id;
		assert.equal(store.commit(id, { label: 'transit', ops: [{ op: 'put', kind: 'node', entity: { id: W, name: 'w', x: 0, y: 0 } }, { op: 'set', kind: 'node', id: W, patch: { transit: false } }] }).ok, true);
		await store.flush(id);
		const again = new Store(dir, { flushMs: 3_600_000, authz: false });
		await again.init();
		assert.equal(again.get(id).get('node', W).transit, false, 'the setting is the document\'s, not a tab\'s');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
