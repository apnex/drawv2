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

const W = 'waypoint-000001';
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
