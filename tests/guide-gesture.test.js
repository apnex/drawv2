/*
The `g` gesture -- an unpinned hop during a link drag -- in the product's own Input, driven through
the product's own harness.

INCUBATING (ruled 2026-09-28): `g` belongs to the network plugin being built lab-first. Input carries
the gesture, because the lab mounts the product's Input rather than forking it (G1); but the gesture
does nothing unless the composition hands Input a ROUTE HOOK, and production hands it none. So the
first test here is the one that matters most: in production, pressing `g` mid-drag changes nothing
at all -- the same commit, byte for byte, as a drag without it.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeInput, key, pointer, seedNodes } from './fixtures/client-harness.mjs';

// a pointer event over node `id` at (x, y), in the harness's shape
const over = (id, x, y) => pointer(x, y, {
	target: { tagName: 'g', classList: { contains: () => false }, dataset: {}, closest: (s) => (s.includes('node') ? { id } : null) },
});
const empty = (x, y) => pointer(x, y);

// drag from a to b, pressing `keys` at the listed points on the way
function drag(h, a, b, hops) {
	h.input.onDown(over(a.id, a.x, a.y));
	for (const [k, x, y] of hops) { h.input.onMove(empty(x, y)); h.input.onKeyDown(key(k)); }
	h.input.onMove(over(b.id, b.x, b.y));
	h.input.onUp(over(b.id, b.x, b.y));
}

test('PRODUCTION: with no route hook, `g` mid-drag changes nothing -- the commit is identical to no `g`', () => {
	const plain = makeInput();
	const withG = makeInput();
	try {
		const [a1, b1] = seedNodes(plain.model, [[0, 0], [360, 0]]);
		const [a2, b2] = seedNodes(withG.model, [[0, 0], [360, 0]]);
		drag(plain, a1, b1, []);
		drag(withG, a2, b2, [['g', 180, 120]]);
		const shape = (h) => ({ links: h.model.all('link').map((l) => ({ via: l.via ?? null })), waypoints: h.model.all('waypoint').length, commits: h.commits.length });
		assert.deepEqual(shape(withG), shape(plain), 'g must be inert in production: no anchor, no via, no extra commit');
	} finally { plain.restore(); withG.restore(); }
});

test('PRODUCTION: `g` does not claim the key, because it does nothing', () => {
	const h = makeInput();
	try {
		const [a] = seedNodes(h.model, [[0, 0]]);
		h.input.onDown(over(a.id, 0, 0));
		h.input.onMove(empty(180, 60));
		let prevented = 0;
		const e = key('g'); e.preventDefault = () => { prevented++; };
		h.input.onKeyDown(e);
		assert.equal(prevented, 0, 'a key the product does nothing with must stay the browser\'s');
	} finally { h.restore(); }
});

test('with a route hook, `g` drops an anchor the link passes but does NOT pin', () => {
	const calls = [];
	const h = makeInput({ routeHook: (r) => { calls.push(r); return { ok: true }; } });
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [360, 0]]);
		drag(h, a, b, [['g', 180, 120]]);
		const links = h.model.all('link');
		assert.equal(links.length, 1, 'the link commits');
		assert.equal(links[0].via, undefined, 'and pins nothing -- a guide is not in the link\'s intent');
		const guide = h.model.all('waypoint');
		assert.equal(guide.length, 1, 'the guide anchor itself is committed, so its pipes have somewhere to go');

		assert.equal(calls.length, 1, 'the hook is asked once, for the whole route');
		const r = calls[0];
		assert.deepEqual([r.src, r.dst], [a.id, b.id]);
		assert.deepEqual(r.pins, []);
		assert.deepEqual(r.guides, [guide[0].id]);
		assert.deepEqual(r.stops, [a.id, guide[0].id, b.id], 'every stop in drawn order, for its pipes');
	} finally { h.restore(); }
});

test('with a route hook, `w` still pins, and a mixed drag keeps each hop what it was', () => {
	const calls = [];
	const h = makeInput({ routeHook: (r) => { calls.push(r); return { ok: true }; } });
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [360, 0]]);
		drag(h, a, b, [['w', 120, 120], ['g', 240, 120]]);
		const link = h.model.all('link')[0];
		const r = calls[0];
		assert.equal(link.via.length, 1, 'the w hop is pinned');
		assert.deepEqual(r.pins, link.via, 'and only the w hop is a pin');
		assert.equal(r.guides.length, 1, 'the g hop is a guide');
		assert.equal(r.stops.length, 4, 'source, w, g, destination');
		assert.deepEqual([r.stops[1], r.stops[2]], [link.via[0], r.guides[0]], 'in the order they were drawn');
	} finally { h.restore(); }
});

test('a refusing route hook commits nothing, and the anchors the drag placed are cleaned up', () => {
	const h = makeInput({ routeHook: () => ({ ok: false, reason: 'test refusal' }) });
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [360, 0]]);
		drag(h, a, b, [['g', 180, 120]]);
		assert.equal(h.model.all('link').length, 0, 'a refused route is not committed');
		assert.equal(h.model.all('waypoint').length, 0, 'and the guide it placed does not linger');
		assert.equal(h.commits.length, 0);
	} finally { h.restore(); }
});

test('a refusal may name anchors to KEEP: those are committed, the rest are cleaned up, no link is made', () => {
	// the director's report: a refused g drag threw away the g anchor -- geometry placed deliberately.
	// The hook decides what survives; Input only honours it.
	let asked = null;
	const h = makeInput({ routeHook: (r) => { asked = r; return { ok: false, reason: 'test refusal', keep: r.guides }; } });
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [360, 0]]);
		drag(h, a, b, [['w', 120, 120], ['g', 240, 120]]);
		assert.deepEqual(asked.placed.length, 2, 'the hook is told which anchors this drag placed, so it can reason about what survives');
		assert.equal(h.model.all('link').length, 0, 'the link is still refused');
		const left = h.model.all('waypoint').map((w) => w.id);
		assert.deepEqual(left, asked.guides, 'the g anchor is kept, and the w anchor -- which existed only for the refused link -- is not');
		assert.equal(h.commits.length, 1, 'the kept anchor reaches the planner in exactly one commit');
		assert.deepEqual(h.commits[0].ops.map((o) => `${o.op}:${o.kind}`), ['put:waypoint']);
	} finally { h.restore(); }
});

/*
THE HOOK IS TOLD WHAT THE DRAG DID -- ruled 2026-09-30, "Each drag action does one thing": "the very next action
decides what it is - a "w", a "g", or a plain "mouse-up" on another anchor". Which keys were pressed decides
whether there is a link at all, and how the END was reached decides whether a pipe is laid into it: a key pressed
there lays one, a plain release does not. Only Input sees either, so it says both.
*/
test('the route hook is told which keys the drag pressed, and how its end was reached', () => {
	const calls = [];
	const h = makeInput({ routeHook: (r) => { calls.push(r); return { ok: true }; } });
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [360, 0]]);
		const [c, d] = seedNodes(h.model, [[0, 240], [360, 240]]);
		drag(h, a, b, []);                                        // plain: a link that lays no pipe
		drag(h, c, d, [['g', 180, 360]]);                         // g, then a plain release on d
		const plain = calls[0], guided = calls[1];
		assert.deepEqual([plain.pressed, plain.endPressed], [{ w: false, g: false }, false]);
		assert.deepEqual([guided.pressed, guided.endPressed], [{ w: false, g: true }, false], 'released plainly: no key at the end');
	} finally { h.restore(); }
});

test('g pressed ON a node threads the node, and ends the route there with g', () => {
	const calls = [];
	const h = makeInput({ routeHook: (r) => { calls.push(r); return { ok: false, keep: [] }; } });
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [360, 0]]);
		drag(h, a, b, [['g', 360, 0]]);                           // g on b itself, then release there
		assert.equal(calls.length, 1, 'the drag reaches the hook');
		assert.equal(calls[0].dst, b.id, 'it ends at b');
		assert.equal(calls[0].endPressed, 'g', 'reached with g, so a pipe is laid into it');
		assert.deepEqual(calls[0].stops, [a.id, b.id]);
	} finally { h.restore(); }
});

test('a plain drag between a pair already linked reaches the hook, so the lab can say why nothing is made', () => {
	const calls = [];
	const h = makeInput({ routeHook: (r) => { calls.push(r); return { ok: false, keep: [] }; } });
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [360, 0]]);
		h.model.put('link', { id: 'link-00000e', name: 'l', src: a.id, dst: b.id });
		drag(h, a, b, []);
		assert.equal(calls.length, 1, 'before this, Input dropped it without a word (B72) and the hook never heard');
	} finally { h.restore(); }
});

/*
w ON A NODE -- ruled 2026-09-30: "We have no way to construct a direct link between two anchors now - I guess we need to
enable the "w" key on the final anchor before we mouse up to activate pipes?" A node is never a pin, so it joins the
route and not `via`: released there, it is the destination, reached with w, and its pipe is laid with the link.
Only with a route hook -- the lab -- so production's `w` is unchanged.
*/
test('with a route hook, w pressed ON the destination node makes a direct link, reached with w', () => {
	const calls = [];
	const h = makeInput({ routeHook: (r) => { calls.push(r); return { ok: true }; } });
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [360, 0]]);
		drag(h, a, b, [['w', 360, 0]]);
		assert.equal(calls.length, 1);
		assert.deepEqual([calls[0].stops, calls[0].pins, calls[0].endPressed, calls[0].pressed.w], [[a.id, b.id], [], 'w', true],
			'a direct link, nothing pinned, its end reached with w');
	} finally { h.restore(); }
});

test('with a route hook, w on a node the drag continues past is a hop the link routes over, never a pin', () => {
	const calls = [];
	const h = makeInput({ routeHook: (r) => { calls.push(r); return { ok: true }; } });
	try {
		const [a, b, c] = seedNodes(h.model, [[0, 0], [360, 0], [360, 240]]);
		drag(h, a, c, [['w', 360, 0]]);
		assert.deepEqual([calls[0].stops, calls[0].pins], [[a.id, b.id, c.id], []], 'b is a stop, not a pin');
	} finally { h.restore(); }
});

test('PRODUCTION: w on a node still does nothing', () => {
	const h = makeInput();
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [360, 0]]);
		h.input.onDown(over(a.id, 0, 0));
		h.input.onMove(empty(360, 0));
		h.input.onKeyDown(key('w'));
		// mid-drag, the cursor moved on: had the node joined the route, the live preview would stop following the cursor
		// (MEASURED: it froze at the node) -- read from what is drawn, since tests assert at the boundary, not on Input's
		// internals (scan-writers)
		h.input.onMove(empty(360, 240));
		const live = h.drawn('#overlay', 'link-live')[0]?.attrs.d;
		assert.ok(live, 'a live preview is drawn');
		assert.equal(live, 'M0 0 L360 240', 'production\'s preview still runs straight from the source to the cursor');
		h.input.onMove(over(b.id, 360, 0));
		h.input.onUp(over(b.id, 360, 0));
		assert.equal(h.model.all('link').length, 1, 'the drag still makes its link');
		assert.equal(h.model.all('link')[0].via, undefined, 'and nothing is pinned on a node');
	} finally { h.restore(); }
});

/*
THE w THAT PLACED THE SOURCE -- ruled 2026-09-30: "When you press w, the anchor is "selected". So Yes if that same anchor
remains the sole selected anchor, and the next gesture is a drag. This eliminates the case where you click off the anchor
to unselect it - then the drag would follow normal link commit rules". Input sees every press, so the w counts only for
the very next press, and only if that press drags from the anchor while it is still the sole selection.
*/
const onWp = (id, x, y) => pointer(x, y, { target: { tagName: 'g', classList: { contains: () => false }, dataset: {}, closest: (s) => (s.includes('waypoint') ? { id } : null) } });
function dragFromWp(h, wp, b) {
	h.input.onDown(onWp(wp.id, wp.x, wp.y));
	h.input.onMove(over(b.id, b.x, b.y));
	h.input.onUp(over(b.id, b.x, b.y));
}

test('the w that placed the source counts when the next press drags from it, still the sole selection', () => {
	const calls = [];
	const h = makeInput({ routeHook: (r) => { calls.push(r); return { ok: true }; } });
	try {
		const [b] = seedNodes(h.model, [[360, 0]]);
		h.input.onMove(empty(0, 240)); h.input.onKeyDown(key('w'));        // w with nothing in hand places S
		const wp = h.model.all('waypoint')[0];
		assert.ok(wp, 'w placed an anchor');
		dragFromWp(h, wp, b);
		assert.equal(calls.length, 1);
		assert.equal(calls[0].srcKey, 'w', 'the w that placed S is the drag\'s first key');
	} finally { h.restore(); }
});

test('a click away between placing S and dragging from it clears that w', () => {
	const calls = [];
	const h = makeInput({ routeHook: (r) => { calls.push(r); return { ok: true }; } });
	try {
		const [b] = seedNodes(h.model, [[360, 0]]);
		h.input.onMove(empty(0, 240)); h.input.onKeyDown(key('w'));
		const wp = h.model.all('waypoint')[0];
		h.input.onDown(empty(600, 600)); h.input.onUp(empty(600, 600));   // click off it
		dragFromWp(h, wp, b);
		assert.equal(calls[0].srcKey, false, 'the drag follows the normal rules');
		// and selecting S again does not bring it back: S did not REMAIN the sole selection since the w
		h.input.onMove(empty(0, 480)); h.input.onKeyDown(key('w'));
		const s2 = h.model.all('waypoint').find((x) => x.y === 480);
		h.input.onDown(empty(600, 600)); h.input.onUp(empty(600, 600));
		h.selection.set([s2.id]);                                          // reselected, as a click on it would
		dragFromWp(h, s2, b);
		assert.equal(calls.at(-1).srcKey, false, 'reselected is not remained');
	} finally { h.restore(); }
});

test('the source w stops counting once that anchor is no longer the sole selection', () => {
	const calls = [];
	const h = makeInput({ routeHook: (r) => { calls.push(r); return { ok: true }; } });
	try {
		const [b] = seedNodes(h.model, [[360, 0]]);
		h.input.onMove(empty(0, 240)); h.input.onKeyDown(key('w'));
		const wp = h.model.all('waypoint')[0];
		h.selection.set([wp.id, b.id]);                                    // selection widened without a press
		dragFromWp(h, wp, b);
		assert.equal(calls[0].srcKey, false);
	} finally { h.restore(); }
});

test('the source w counts only for the anchor it placed', () => {
	const calls = [];
	const h = makeInput({ routeHook: (r) => { calls.push(r); return { ok: true }; } });
	try {
		const [b] = seedNodes(h.model, [[360, 0]]);
		h.model.put('waypoint', { id: 'waypoint-00000f', name: 't', x: 240, y: 240 });
		h.input.onMove(empty(0, 240)); h.input.onKeyDown(key('w'));
		h.selection.set(['waypoint-00000f']);                              // another anchor, now the sole selection
		dragFromWp(h, h.model.get('waypoint', 'waypoint-00000f'), b);
		assert.equal(calls[0].srcKey, false, 'the w placed a different anchor');
	} finally { h.restore(); }
});

/*
B261 -- `w` during a CHAINED link drag. A Shift-release chains the next link from the node it landed on (`chainFrom`),
and that drag's context had no `route`: `w` threw on the push, after putting the new waypoint on the tab's model and
before recording it for cleanup. Production composition, no plugin: this is the product's own `w`.
*/
test('B261: w during a chained link drag adds its bend, and the chained link commits with it', () => {
	const h = makeInput();
	try {
		const [a, b, c] = seedNodes(h.model, [[0, 0], [360, 0], [360, 360]]);
		h.input.onDown(over(a.id, a.x, a.y));
		h.input.onMove(over(b.id, b.x, b.y));
		h.input.onUp({ ...over(b.id, b.x, b.y), shiftKey: true });
		h.input.onMove(empty(480, 180));
		assert.doesNotThrow(() => h.input.onKeyDown(key('w')));
		h.input.onMove(over(c.id, c.x, c.y));
		h.input.onUp(over(c.id, c.x, c.y));
		const chained = h.model.all('link').find((l) => l.src === b.id && l.dst === c.id);
		assert.ok(chained, 'the chained link is made');
		assert.equal(chained.via?.length, 1, 'through the bend w dropped');
		assert.equal(h.model.all('waypoint').length, 1, 'and no stray waypoint is left behind');
	} finally { h.restore(); }
});
