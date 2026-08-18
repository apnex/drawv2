/*
GR12 — a fanout failure can never fail the primary transaction.

This guardrail had no test. The try/catch was in the code and the claim was in the spec, and nothing
connected them: a refactor that hoisted the try outside the loop, or dropped it for an `await`, would
have shipped green. A guardrail nothing exercises is prose.

The hazard is specific. After CS3 the Hub is the ONLY channel by which a viewer learns anything, and
broadcast happens AFTER the transaction is applied, logged and flushed. So a dead socket at fanout
time can do two things it must never do: silence the OTHER viewers, and turn a committed write into
a 500 for the writer who already has their change on disk.
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hub } from '../server/hub.js';

// the narrow duck-typed Session the Hub speaks: { diagramId, send(cmd, body) }
function viewer(diagramId, { throws = false } = {}) {
	const got = [];
	return {
		diagramId, got,
		send(cmd, body) {
			if (throws) throw new Error('socket is gone');
			got.push({ cmd, body });
		},
	};
}

test('GR12: one dead socket cannot silence the other viewers', () => {
	const hub = new Hub();
	const before = viewer('diagram-aa0001');
	const dead = viewer('diagram-aa0001', { throws: true });
	const after = viewer('diagram-aa0001');
	[before, dead, after].forEach((v) => hub.add(v));

	hub.broadcast('diagram-aa0001', 'change', { seq: 1 });

	assert.equal(before.got.length, 1, 'the viewer ahead of the dead one got it');
	// the one that matters: iteration CONTINUED past the throw. A try/catch hoisted outside the
	// loop would leave this at 0 and every later viewer permanently blind.
	assert.equal(after.got.length, 1, 'and so did the viewer AFTER it');
});

test('GR12: a fanout failure never propagates to the caller — the write is already durable', () => {
	const hub = new Hub();
	hub.add(viewer('diagram-aa0001', { throws: true }));
	assert.doesNotThrow(() => hub.broadcast('diagram-aa0001', 'change', { seq: 1 }),
		'a committed, flushed transaction must not become a 500 because a socket died after it');
});

test('GR12: every session can be dead and broadcast still returns', () => {
	const hub = new Hub();
	for (let i = 0; i < 5; i++) hub.add(viewer('diagram-aa0001', { throws: true }));
	assert.doesNotThrow(() => hub.broadcast('diagram-aa0001', 'change', { seq: 1 }));
});

test('GR12: fanout is scoped to the diagram, and skips the originator', () => {
	const hub = new Hub();
	const origin = viewer('diagram-aa0001');
	const peer = viewer('diagram-aa0001');
	const elsewhere = viewer('diagram-bb0002');
	[origin, peer, elsewhere].forEach((v) => hub.add(v));

	hub.broadcast('diagram-aa0001', 'change', { seq: 1 }, origin);

	assert.equal(peer.got.length, 1);
	assert.equal(origin.got.length, 0, 'the originator already applied it locally');
	assert.equal(elsewhere.got.length, 0, 'another diagram hears nothing');
});

test('GR12: a removed session stops receiving — a closed socket is not a permanent throw source', () => {
	const hub = new Hub();
	const v = viewer('diagram-aa0001');
	hub.add(v);
	hub.remove(v);
	hub.broadcast('diagram-aa0001', 'change', { seq: 1 });
	assert.equal(v.got.length, 0);
});
