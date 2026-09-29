/*
The incubated path resolver -- network/resolve.mjs -- through the real Model interface.

Driven through `new Model({ resolvePath })` rather than by calling the resolver directly, because the
interface is the thing being proven: a resolver that works in isolation but receives the wrong
arguments from the Model would pass a direct test and fail in the lab.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from '../model/model.mjs';
import { createPipeSet } from '../network/pipeset.mjs';
import { pipeResolver } from '../network/resolve.mjs';

// A and B are far apart; the only pipes run A -> w -> B, around the straight line
function board(pipeSet) {
	const m = new Model({ resolvePath: pipeResolver(pipeSet) });
	m.put('node', { id: 'node-00000a', name: 'A', type: 'router', x: 0, y: 0, shape: 'circle' });
	m.put('node', { id: 'node-00000b', name: 'B', type: 'router', x: 240, y: 0, shape: 'circle' });
	m.put('waypoint', { id: 'waypoint-00000c', name: 'w', x: 120, y: 120 });
	return m;
}
const LINK = { id: 'link-00000d', name: 'l', src: 'node-00000a', dst: 'node-00000b' };

test('with pipes, an UNPINNED link is drawn along its route over them, not straight', () => {
	const s = createPipeSet();
	s.lay('node-00000a', 'waypoint-00000c');
	s.lay('waypoint-00000c', 'node-00000b');
	const path = board(s).pathOf(LINK);
	// the link has no via at all, yet it passes w -- because the only pipes go that way. This is
	// the property `g` depends on: an anchor can shape a route without being pinned in the link.
	assert.deepEqual(path, [[0, 0], [120, 120], [240, 0]]);
});

test('with NO pipes, the resolver defers to the straight polyline', () => {
	// an empty pipe layer is a board not yet laid, not a board of unroutable links
	assert.deepEqual(board(createPipeSet()).pathOf(LINK), [[0, 0], [240, 0]]);
});

test('a DOWN link (a leg with no route) defers rather than drawing half a path', () => {
	const s = createPipeSet();
	s.lay('node-00000a', 'waypoint-00000c');   // pipes from A reach w, and stop
	assert.deepEqual(board(s).pathOf(LINK), [[0, 0], [240, 0]],
		'a route that stops halfway is no route (2026-09-25, down and heals)');
});

test('the resolver reads the pipe set LIVE, so removing a pipe changes the drawn route', () => {
	// a resolver holding a snapshot would draw links along pipes that no longer exist -- a second
	// authority for the pipe set, which is the defect family this programme exists to end
	const s = createPipeSet();
	s.lay('node-00000a', 'waypoint-00000c');
	s.lay('waypoint-00000c', 'node-00000b');
	const m = board(s);
	assert.equal(m.pathOf(LINK).length, 3);
	s.remove('waypoint-00000c', 'node-00000b');
	assert.deepEqual(m.pathOf(LINK), [[0, 0], [240, 0]], 'with the route broken, the link is down and drawn straight');
});
