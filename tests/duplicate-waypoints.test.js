/*
B311 -- DUPLICATING A SELECTION THAT HOLDS A WAYPOINT, OR A LINK THROUGH A BEND, COPIES IT -- AND A REFUSAL IS NOT REPORTED AS A COPY.

Ctrl+D and the Ctrl-drag clone offset only the copies of devices and zones (`isTypedEntity(...) || kind === 'zone'`), a filter
from before waypoints were nodes (F-c): a waypoint's copy stayed on its original's cell, the planner refused the edit for two
anchors on one cell (B112), and nothing was copied -- while the readout said "+2 cloned". Measured: one waypoint duplicated
gave "+0 cloned" and no copy; two devices and a link through a bend gave "+2 cloned" and no copy. Every positioned copy moves by
the pitch now -- an anchor with or without a device, a zone -- the selection is the copies of what was selected, and a refused
edit says so.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeInput, seedNodes, pointer } from './fixtures/client-harness.mjs';
import { makeWaypoint } from '../devices/make-node.mjs';
import { makeLink } from '../network/link-queries.mjs';

const key = (k, mod = {}) => ({ key: k, code: '', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, repeat: false, target: { tagName: 'svg' }, preventDefault() {}, ...mod });
const flashes = (h) => h.calls.filter((c) => /flash/.test(c.name)).map((c) => c.args[0]);
const waypoint = (h, x, y) => { const w = makeWaypoint(h.model, { x, y }); h.model.put('node', w); return w; };
const bentLink = (h) => {
	const [a, b] = seedNodes(h.model, [[0, 0], [240, 0]]);
	const w = waypoint(h, 120, 120);
	const l = { ...makeLink(h.model, a.id, b.id), via: [w.id] };
	h.model.put('link', l);
	return { a, b, w, l };
};

test('B311: duplicating two devices copies them, offset by the pitch -- the state under test', () => {
	const h = makeInput();
	const ids = seedNodes(h.model, [[0, 0], [240, 0]]).map((n) => n.id);
	h.selection.set(ids);
	h.capture.onKeyDown(key('d', { ctrlKey: true }));
	assert.equal(h.model.all('node').length, 4);
	h.restore();
});

test('B311: duplicating a waypoint copies it onto another cell, and selects the copy', () => {
	const h = makeInput();
	const w = waypoint(h, 120, 120);
	h.selection.set([w.id]);
	h.capture.onKeyDown(key('d', { ctrlKey: true }));
	const nodes = h.model.all('node');
	assert.equal(nodes.length, 2, 'a copy was made');
	const copy = nodes.find((n) => n.id !== w.id);
	assert.notDeepEqual([copy.x, copy.y], [w.x, w.y], 'on another cell');
	assert.deepEqual(h.selection.list(), [copy.id], 'the copy is selected');
	h.restore();
});

test('B311: duplicating devices and a link through a bend copies all of it, the bend moving with the link', () => {
	const h = makeInput();
	const { a, b, w, l } = bentLink(h);
	h.selection.set([a.id, b.id, w.id, l.id]);
	h.capture.onKeyDown(key('d', { ctrlKey: true }));
	assert.equal(h.model.all('node').length, 6, 'two devices and a bend copied');
	assert.equal(h.model.all('link').length, 2, 'and the link');
	const copy = h.model.all('link').find((x) => x.id !== l.id);
	const bend = h.model.get('node', copy.via[0]);
	const src = h.model.get('node', copy.src);
	assert.deepEqual([bend.x - src.x, bend.y - src.y], [w.x - a.x, w.y - a.y], 'the copied bend keeps its place relative to the copied ends');
	assert.ok(flashes(h).at(-1).startsWith('+'), 'and the readout reports the copy');
	h.restore();
});

test('B311: a duplicate the planner refuses is reported as refused, not as a copy', () => {
	const h = makeInput();
	const ids = seedNodes(h.model, [[0, 0], [240, 0]]).map((n) => n.id);
	h.selection.set(ids);
	h.history.commit = () => [];   // the planner refuses it
	h.capture.onKeyDown(key('d', { ctrlKey: true }));
	assert.match(flashes(h).at(-1), /refused/, `said: ${flashes(h).at(-1)}`);
	h.restore();
});

// a press on an entity, as tests/input.test.js drives one: the target resolves to the node's group
const onEntity = (id, x, y, mod = {}) => pointer(x, y, {
	target: { tagName: 'g', classList: { contains: () => false }, dataset: {}, closest: (q) => (q.includes('node') ? { id } : null) },
	...mod,
});

test('B311: a Ctrl-drag clone copies devices and a link through a bend, the bend moving with the link', () => {
	const h = makeInput();
	const { a, b, w, l } = bentLink(h);
	h.selection.set([a.id, b.id, w.id, l.id]);
	h.capture.onDown(onEntity(a.id, 0, 0, { button: 2, ctrlKey: true }));
	h.capture.onMove(onEntity(a.id, 0, 240, { button: 2, ctrlKey: true }));
	h.capture.onUp(onEntity(a.id, 0, 240, { button: 2, ctrlKey: true }));
	assert.equal(h.model.all('link').length, 2, 'the link was copied');
	const copy = h.model.all('link').find((x) => x.id !== l.id);
	const bend = h.model.get('node', copy.via[0]), src = h.model.get('node', copy.src);
	assert.deepEqual([bend.x - src.x, bend.y - src.y], [w.x - a.x, w.y - a.y], 'the copied bend moved with the copied ends');
	assert.notDeepEqual([bend.x, bend.y], [w.x, w.y], 'off its original\'s cell');
	h.restore();
});
