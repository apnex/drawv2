/*
Model takes its path resolver by injection -- the first pluggable interface the network incubator
forces into a product module.

WHY AN INTERFACE AND NOT A PATCH. `model.pathOf` is read by four canvas modules (the renderer, the
live preview in input.js, the overlay, and the movers). The lab needs links drawn along their ROUTE
over pipes rather than as a straight polyline through `via`. Patching `pathOf` in the lab's root
would work in one line and would be a fork wearing a patch: production code behaving differently
under the lab with no seam declaring it, which is exactly what G1 exists to stop.

So the seam is declared: a Model may be constructed with a `resolvePath`. The default is today's
behaviour. Production constructs `new Model()` and must be unchanged BYTE FOR BYTE in what it draws
-- that is the property these tests exist to hold, and it is the one most likely to be broken
casually, by someone "improving" the default while wiring the lab.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from '../model/model.mjs';

const seeded = (opts) => {
	const m = opts === undefined ? new Model() : new Model(opts);
	m.put('node', { id: 'node-00000a', name: 'A', type: 'router', x: 0, y: 0, shape: 'circle' });
	m.put('node', { id: 'node-00000b', name: 'B', type: 'router', x: 240, y: 0, shape: 'circle' });
	m.put('waypoint', { id: 'waypoint-00000c', name: 'w', x: 120, y: -60 });
	return m;
};
const LINK = { id: 'link-00000d', name: 'l', src: 'node-00000a', dst: 'node-00000b', via: ['waypoint-00000c'] };

test('production is unchanged: new Model() still draws the straight polyline through via', () => {
	const m = seeded();
	assert.deepEqual(m.pathOf(LINK), [[0, 0], [120, -60], [240, 0]],
		'the default resolver must be exactly the behaviour production has always had');
});

test('a Model constructed with no options is identical to one constructed with an empty options object', () => {
	assert.deepEqual(seeded({}).pathOf(LINK), seeded().pathOf(LINK));
});

test('an injected resolver replaces the path, and receives the link and the model', () => {
	let saw = null;
	const m = seeded({ resolvePath: (link, model) => { saw = { link, model }; return [[1, 2], [3, 4]]; } });
	assert.deepEqual(m.pathOf(LINK), [[1, 2], [3, 4]]);
	assert.equal(saw.link, LINK, 'the resolver must be handed the link it is resolving');
	assert.equal(saw.model, m, 'and the model, so it can resolve anchors without reaching for a global');
});

test('the resolver can defer to the default, so an incubator can route some links and not others', () => {
	// the lab routes a link over pipes when pipes exist and falls back otherwise; the default must
	// be reachable from inside an injected resolver, or every resolver has to re-implement it
	const m = seeded({ resolvePath: (link, model, fallback) => fallback(link) });
	assert.deepEqual(m.pathOf(LINK), [[0, 0], [120, -60], [240, 0]]);
});
