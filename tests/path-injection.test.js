/*
Model takes its path resolver by injection -- the first pluggable interface the network incubator
forces into a product module.

WHY AN INTERFACE AND NOT A PATCH. `model.pathOf` is read by four canvas modules (the renderer, the
live preview in input.js, the overlay, and the movers). The lab needs links drawn along their ROUTE
over pipes rather than as a straight polyline through `via`. Patching `pathOf` in the lab's root
would work in one line and would be a fork wearing a patch: production code behaving differently
under the lab with no seam declaring it, which is exactly what G1 exists to stop.

So the seam is declared: a Model may be constructed with a `network` -- ONE object whose methods carry the
Model's own names (RULESET-AUDIT T1; it began as four separate hooks). The default is today's
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
// a complete network whose answers are production's, so each test overrides only the method it is about
const net = (over = {}) => ({ network: { pathOf: (l, m, straight) => straight(l), linksRoutedThrough: () => [], isLinkDown: () => false, blockersOf: () => [], ...over } });
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
	const m = seeded(net({ pathOf: (link, model) => { saw = { link, model }; return [[1, 2], [3, 4]]; } }));
	assert.deepEqual(m.pathOf(LINK), [[1, 2], [3, 4]]);
	assert.equal(saw.link, LINK, 'the resolver must be handed the link it is resolving');
	assert.equal(saw.model, m, 'and the model, so it can resolve anchors without reaching for a global');
});

test('the resolver can defer to the default, so an incubator can route some links and not others', () => {
	// the lab routes a link over pipes when pipes exist and falls back otherwise; the default must
	// be reachable from inside an injected resolver, or every resolver has to re-implement it
	const m = seeded(net({ pathOf: (link, model, fallback) => fallback(link) }));
	assert.deepEqual(m.pathOf(LINK), [[0, 0], [120, -60], [240, 0]]);
});

/*
The companion interface: WHICH LINKS a moved anchor affects.

Where a link runs now comes from the injected resolver, and which links depend on an anchor came from
the incidence index (links naming it as an end or a pin). Under routing those disagree: a link routed
through an anchor it does not name is drawn through it, yet moving the anchor did not redraw it -- the
director moved a centre anchor, watched its pipes follow, and the links stayed where they were until an
END was grabbed. One fact, two authorities, the B234-B236 family.

So the thing that knows the route also answers who depends on it: `network.linksRoutedThrough(anchorId, model)`.
Absent in production, where `linksRoutedThrough` is empty and the renderer redraws exactly what it
always has.
*/
test('production: linksRoutedThrough is empty, so nothing extra is redrawn', () => {
	assert.deepEqual(seeded().linksRoutedThrough('waypoint-00000c'), []);
});

test('an injected linksRoutedThrough answers which links a moved anchor affects', () => {
	let asked = null;
	const m = seeded(net({ linksRoutedThrough: (id, model) => { asked = { id, model }; return [LINK]; } }));
	assert.deepEqual(m.linksRoutedThrough('waypoint-00000c'), [LINK]);
	assert.equal(asked.id, 'waypoint-00000c');
	assert.equal(asked.model, m, 'handed the model, like pathOf, so it can read the routes');
});

/*
The third companion: WHETHER A LINK IS DOWN -- ruled 2026-09-25, "the link stays, keeps its name and
drawn route, shows as down, and comes back when a route returns".

The lab drew a down link as a plain straight line between its ends, which looked exactly like a new
direct connection -- the director read it as a pipe created on its own. Down is DERIVED state (no route
over the pipes), known only to whatever routes; so the router's owner answers it, beside the path and
the dependents. Absent in production, which has no notion of a route to lose.
*/
test('production: no link is ever down', () => {
	assert.equal(seeded().isLinkDown(LINK), false);
});

test('an injected isLinkDown answers, and is handed the link and the model', () => {
	let asked = null;
	const m = seeded(net({ isLinkDown: (link, model) => { asked = { link, model }; return true; } }));
	assert.equal(m.isLinkDown(LINK), true);
	assert.equal(asked.link, LINK);
	assert.equal(asked.model, m);
});

/*
The fourth companion: WHICH LINKS BLOCK a down link -- ruled 2026-09-30, "when I select a down/broken link that
cannot be healed due to another link occupying my preferred path, also highlight that blocking link in orange".
Who holds which pipe is the router's owner's to say, so it is injected; production has no pipes to hold.
*/
test('production: no link is ever blocked', () => {
	assert.deepEqual(seeded().blockersOf(LINK), []);
});

test('an injected blockersOf answers, and is handed the link and the model', () => {
	let asked = null;
	const m = seeded(net({ blockersOf: (link, model) => { asked = { link, model }; return ['link-000009']; } }));
	assert.deepEqual(m.blockersOf(LINK), ['link-000009']);
	assert.equal(asked.link, LINK);
	assert.equal(asked.model, m);
});
