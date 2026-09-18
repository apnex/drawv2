/*
Spectator mode -- the follow rule, driven without a browser.

The rule lives in `app/src/spectate.js` rather than in `main.js` precisely so this file can exist:
the composition root touches the DOM on import and exports nothing, so a decision written there is
one nobody can check. I wrote this rule in main.js first and verified it with a throwaway script,
which is a test that agrees with itself and then gets deleted.

The two cases that matter are the ones that would make the feature unusable rather than wrong: a
re-follow on every heartbeat, which would thrash the canvas, and a follow that interrupts a gesture.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeSpectator, followTarget } from '../app/src/spectate.js';

const A = (p, d) => ({ principal: p, diagram: d });

test('disarmed, a new lock is not followed', () => {
	const s = makeSpectator();
	assert.equal(followTarget(s, [A('agent:p', 'd1')], 'home'), null);
});

test('armed, a new lock is followed', () => {
	const s = makeSpectator(); s.armed = true;
	assert.equal(followTarget(s, [A('agent:p', 'd1')], 'home'), 'd1');
});

test('the SAME lock is not followed twice -- the agent list arrives on every heartbeat', () => {
	// without this the canvas would re-navigate several times a second while a lock is held
	const s = makeSpectator(); s.armed = true;
	assert.equal(followTarget(s, [A('agent:p', 'd1')], 'home'), 'd1');
	assert.equal(followTarget(s, [A('agent:p', 'd1')], 'd1'), null);
	assert.equal(followTarget(s, [A('agent:p', 'd1')], 'd1'), null);
});

test('newest lock wins when an agent holds several at once', () => {
	// locks are per diagram and one principal may hold many -- measured against Locks.acquire
	const s = makeSpectator(); s.armed = true;
	assert.equal(followTarget(s, [A('agent:p', 'd1')], 'home'), 'd1');
	assert.equal(followTarget(s, [A('agent:p', 'd1'), A('agent:p', 'd2')], 'd1'), 'd2');
	assert.equal(followTarget(s, [A('agent:p', 'd1'), A('agent:p', 'd2'), A('agent:q', 'd3')], 'd2'), 'd3');

	/*
	TWO locks appearing in ONE update, which is what actually distinguishes newest from oldest.
	Adding them one at a time never puts more than one entry in `fresh`, so the rule read the same
	either way -- a mutation making it follow the OLDEST passed the whole file until this existed.
	*/
	const t = makeSpectator(); t.armed = true;
	assert.equal(followTarget(t, [A('agent:p', 'first'), A('agent:q', 'second')], 'home'), 'second',
		'the last in the list is the newest lock, and wins');
});

test('a lock on the diagram already open is not followed', () => {
	const s = makeSpectator(); s.armed = true;
	assert.equal(followTarget(s, [A('agent:p', 'd1')], 'd1'), null);
});

test('a gesture defers the follow, and the lock is not owed later', () => {
	/*
	Deferred rather than queued. Arriving at a diagram three locks after the work moved on is worse
	than not arriving, and the alternative -- yanking the canvas mid-drag -- is the interruption
	B19/B71 already refuse for inbound changes.
	*/
	const s = makeSpectator(); s.armed = true;
	assert.equal(followTarget(s, [A('agent:p', 'd1')], 'home', true), null, 'deferred during the gesture');
	assert.equal(followTarget(s, [A('agent:p', 'd1')], 'home'), null, 'and not replayed afterwards');
});

test('a released lock, retaken, is followed again', () => {
	// an agent coming back to a diagram is new work; remembering it forever would stop following
	const s = makeSpectator(); s.armed = true;
	assert.equal(followTarget(s, [A('agent:p', 'd1')], 'home'), 'd1');
	assert.equal(followTarget(s, [], 'd1'), null);
	assert.equal(followTarget(s, [A('agent:p', 'd1')], 'home'), 'd1');
});

test('arming mid-session does not follow locks that were already held', () => {
	/*
	The state is seeded by the first call whether armed or not, so arming while an agent is already
	working does not immediately drag the operator somewhere they did not ask to go -- the next NEW
	lock is what they armed for.
	*/
	const s = makeSpectator();
	followTarget(s, [A('agent:p', 'd1')], 'home');
	s.armed = true;
	assert.equal(followTarget(s, [A('agent:p', 'd1')], 'home'), null, 'the standing lock is not fresh');
	assert.equal(followTarget(s, [A('agent:p', 'd1'), A('agent:p', 'd2')], 'home'), 'd2', 'the next one is');
});

test('a malformed agent list is inert rather than a throw', () => {
	const s = makeSpectator(); s.armed = true;
	assert.equal(followTarget(s, null, 'home'), null);
	assert.equal(followTarget(s, undefined, 'home'), null);
});
