/*
H13.1 — the placement rule, and the claim that only placement travels.

The second rule on the situation surface, and the reason it is worth a file: one instance is a
design, two are a pattern. The pilot rule showed the shape could express "in read view, on an
endpoint"; this shows the same shape expresses "in read view, on nothing" with no new mechanism.

The load-bearing property is narrower than "a tower appears". It is that placement is the ONLY thing
peers exchange. A tower firing is derived by everyone from the board and the clock, so it is never
sent; a tower being placed cannot be derived from anything, so it rides the document machinery that
already orders and broadcasts edits. If a placement did not produce an ordinary committable entry,
a third client would arrive at a different battle.

Tested at the predicate and command level, following tests/spawn-rule.test.js. Synthesising a
pointer event has cost this tree two rounds and proved nothing either time -- the synthetic event
failed silently and the "finding" was the probe, not the code (B170).
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from '../model/index.mjs';
import { situationOf, inReadView, onOpenGround, onEndpoint, worldOf } from '../engine/index.mjs';
import { createEntity } from '../app/src/commands.js';
import { validateEntity } from '../server/validate.js';
import { applyOps } from '../model/ops.mjs';
import { TOWERS } from '../engine/kinds.mjs';

const NOW = 1_700_000_000_000;
const WP_A = 'waypoint-aaaaaa', WP_B = 'waypoint-bbbbbb', LINK = 'link-cccccc';

function doc() {
	const m = new Model();
	m.put('waypoint', { id: WP_A, name: WP_A, x: 0, y: 0 });
	m.put('waypoint', { id: WP_B, name: WP_B, x: 200, y: 0 });
	m.put('link', { id: LINK, name: LINK, src: WP_A, dst: WP_B });
	return m;
}

const sit = (m, id, mode) => situationOf({
	get: (kind, i) => m.get(kind, i),
	linksTouching: (i) => m.all('link').filter((l) => l.src === i || l.dst === i || (l.via || []).includes(i)),
}, { mode, targetId: id }, NOW);

// the rule itself, stated once here exactly as `input.js` states it
const placeable = (s) => inReadView(s) && onOpenGround(s);

test('H13.1: open ground in read view is placeable; the same ground in author view is not', () => {
	const m = doc();
	assert.equal(placeable(sit(m, null, 'run')), true, 'read view, nothing under the press');
	assert.equal(placeable(sit(m, null, 'edit')), false, 'author view keeps its own meaning for empty ground');
	assert.equal(placeable(sit(m, null, 'view')), false);
});

test('H13.1: the two rules are mutually exclusive -- a press cannot both arm and place', () => {
	/*
	They sit in the same handler, so an overlap would make the earlier one win silently and the later
	one look broken only sometimes. Endpoint and open-ground are complements by construction, but
	"by construction" is exactly the kind of claim that stops being true when a field is added.
	*/
	const m = doc();
	for (const target of [null, WP_A, WP_B, LINK]) {
		const s = sit(m, target, 'run');
		assert.equal(
			onEndpoint(s) && onOpenGround(s), false,
			`${target || 'open ground'} satisfies both rules -- one press, two meanings`,
		);
	}
});

test('H13.1: a press on an entity is not open ground, whatever the entity is', () => {
	const m = doc();
	assert.equal(onOpenGround(sit(m, WP_A, 'run')), false, 'a waypoint');
	assert.equal(onOpenGround(sit(m, LINK, 'run')), false, 'a link');
	m.put('node', { id: 'node-dddddd', type: 'loadbalancer', x: 120, y: 0 });
	assert.equal(onOpenGround(sit(m, 'node-dddddd', 'run')), false, 'a tower already placed');
});

test('H13.1: an id that names nothing is open ground, not a phantom target', () => {
	// a stale id from a removed entity must read as "nothing there" rather than as a target, or a
	// press after someone else's delete would arm a waypoint that no longer exists
	const m = doc();
	assert.equal(onOpenGround(sit(m, 'node-eeeeee', 'run')), true);
});

test('H13.1: placement produces an ordinary committable entry -- this is what travels', () => {
	/*
	The whole parity claim rests on this being unremarkable. Placement must be the same kind of edit
	as drawing a node, because that machinery already orders, broadcasts and replays. Anything
	bespoke here would be a second channel, and a second channel is the thing the design refuses.
	*/
	const m = doc();
	const node = m.makeNode('loadbalancer', { x: 120, y: 0 });
	const cmd = createEntity('node', node);
	assert.equal(cmd.entries.length, 1);
	assert.equal(cmd.entries[0].op, 'put', 'a put, exactly like any other node');
	assert.equal(cmd.entries[0].kind, 'node');
	assert.equal(cmd.entries[0].entity.type, 'loadbalancer');
	const bad = validateEntity('node', cmd.entries[0].entity);
	assert.equal(bad, null, `the server must accept it: ${bad}`);
});

test('H13.1: a peer given only the placement op derives the same tower', () => {
	/*
	The live-delta path, and named carefully. A JOINING client receives the document as a snapshot;
	this is what happens to a peer already connected when a placement arrives. It carries the op and
	nothing about the tower's stats, which is the property worth pinning -- range, beam and damage
	come from the kind table on the receiving side.
	*/
	const author = doc();
	const node = author.makeNode('loadbalancer', { x: 120, y: 0 });
	const cmd = createEntity('node', node);

	const peer = doc();
	applyOps(peer, cmd.entries);

	author.put('node', node);
	const a = worldOf(author).towers;
	const b = worldOf(peer).towers;
	assert.equal(b.length, 1, 'the peer has a tower it was never told the stats of');
	assert.deepEqual(b.map((t) => [t.id, t.x, t.y, t.range, t.beam, t.cooldown, t.damage]),
		a.map((t) => [t.id, t.x, t.y, t.range, t.beam, t.cooldown, t.damage]));
});

test('H13.1: the placed kind is one the tower table actually knows', () => {
	// placing a type with no entry would put a node on the board that silently never fires
	assert.ok(TOWERS.loadbalancer, 'loadbalancer is the ruled tower kind');
	const m = doc();
	m.put('node', { id: 'node-ffffff', type: 'loadbalancer', x: 120, y: 0 });
	assert.equal(worldOf(m).towers.length, 1, 'and worldOf recognises what placement creates');
});
