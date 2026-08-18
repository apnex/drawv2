import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from '../document/index.mjs';
import { Selection } from '../app/src/selection.js';

// R7 salvage — Selection is a PURE model concept: renderer-free (no mock needed) and auto-prunes
// against the model. The 'selected' visual reflection lives in the renderer (via subscribe()).

test('Selection constructs and operates with NO renderer (sovereign / testable in isolation)', () => {
	const m = new Model();
	const n = m.makeNode('router', { x: 0, y: 0 }); m.put('node', n);
	const sel = new Selection(m);                     // model only — no renderer arg, no mock
	sel.set([n.id]);
	assert.equal(sel.has(n.id), true);
	assert.deepEqual(sel.list(), [n.id]);
	sel.clear();
	assert.equal(sel.size(), 0);
});

test('Selection auto-prunes a deleted entity (no manual prune needed)', () => {
	const m = new Model();
	const n = m.makeNode('router', { x: 0, y: 0 }); m.put('node', n);
	const sel = new Selection(m);
	sel.set([n.id]);
	m.del('node', n.id);                              // delete → auto-prune drops it
	assert.equal(sel.has(n.id), false, 'deleted id auto-dropped from selection');
	assert.equal(sel.size(), 0);
});

test('Selection auto-prunes stale ids on document load', () => {
	const m = new Model();
	const n = m.makeNode('router', { x: 60, y: 0 }); m.put('node', n);
	const sel = new Selection(m);
	sel.set([n.id]);
	m.load({ meta: { id: '' }, nodes: [], waypoints: [], links: [], zones: [], groups: [] });
	assert.equal(sel.size(), 0, 'load drops ids absent from the new document');
});

test('subscribers fire on real changes; a live id survives an unrelated delete', () => {
	const m = new Model();
	const a = m.makeNode('router', { x: 0, y: 0 }); m.put('node', a);
	const b = m.makeNode('host', { x: 60, y: 0 });  m.put('node', b);
	const sel = new Selection(m);
	sel.set([a.id]);
	let fired = 0; sel.subscribe(() => { fired++; });
	m.del('node', b.id);                              // b NOT selected → no drop, no fire
	assert.equal(sel.has(a.id), true, 'selected id survives an unrelated delete');
	assert.equal(fired, 0, 'no subscriber fire when nothing dropped');
	m.del('node', a.id);                              // a IS selected → drop + fire
	assert.equal(sel.has(a.id), false);
	assert.equal(fired, 1, 'subscriber fires once on a real drop');
});

// ---- MS1: selection as persisted model-state (status) — round-trip + reconcile ----

test('Model round-trips selection through toJSON/load (model-state persistence)', () => {
	const m = new Model();
	const a = m.makeNode('router', { x: 0, y: 0 }); m.put('node', a);
	const b = m.makeNode('host', { x: 60, y: 0 });  m.put('node', b);
	const sel = new Selection(m);
	sel.set([a.id, b.id]);
	const json = m.toJSON();
	assert.deepEqual([...json.selection].sort(), [a.id, b.id].sort(), 'selection persisted in the doc');
	const m2 = new Model();
	const sel2 = new Selection(m2);
	m2.load(json);                                    // restore into a fresh model
	assert.ok(sel2.has(a.id) && sel2.has(b.id), 'selection restored on load');
	assert.equal(sel2.size(), 2);
});

test('Model.load tolerates a stale selection id (reconcile-to-live)', () => {
	const m = new Model();
	const a = m.makeNode('router', { x: 0, y: 0 }); m.put('node', a);
	m.load({ meta: { id: '' }, nodes: [{ id: a.id, type: 'router', x: 0, y: 0 }], waypoints: [], links: [], zones: [], groups: [], selection: [a.id, 'node-deadbe'] });
	assert.equal(m.state.selection.has(a.id), true, 'live id kept');
	assert.equal(m.state.selection.has('node-deadbe'), false, 'stale id dropped');
});

test('setSelection expands a grouped member to the whole group', () => {
	const m = new Model();
	const a = m.makeNode('router', { x: 0, y: 0 }); m.put('node', a);
	const b = m.makeNode('host', { x: 60, y: 0 });  m.put('node', b);
	const g = m.makeGroup([a.id, b.id]);            m.put('group', g);
	const sel = new Selection(m);
	sel.set([a.id]);                                  // selecting one member pulls in the group
	assert.ok(sel.has(a.id) && sel.has(b.id), 'group-as-one expansion');
});

test('selection preserves insertion order (link-chaining relies on it)', () => {
	const m = new Model();
	const a = m.makeNode('router', { x: 0, y: 0 });   m.put('node', a);
	const b = m.makeNode('host', { x: 60, y: 0 });    m.put('node', b);
	const c = m.makeNode('switch', { x: 120, y: 0 }); m.put('node', c);
	const sel = new Selection(m);
	sel.set([c.id, a.id, b.id]);                      // selection order, NOT creation order
	assert.deepEqual(sel.list(), [c.id, a.id, b.id]);
	const m2 = new Model(); const sel2 = new Selection(m2); m2.load(m.toJSON());
	assert.deepEqual(sel2.list(), [c.id, a.id, b.id], 'order preserved across persist/restore');
});

test('selection admits only selectable kinds — a group id cannot enter or persist', () => {
	const m = new Model();
	const a = m.makeNode('router', { x: 0, y: 0 }); m.put('node', a);
	const g = m.makeGroup([a.id]);                  m.put('group', g);
	const sel = new Selection(m);
	sel.add([g.id]);                                 // attempt to select the GROUP entity directly
	assert.equal(sel.has(g.id), false, 'group id refused (not a selectable kind)');
	assert.ok(!m.toJSON().selection.includes(g.id), 'never emitted to the persisted doc');
	// a hand-edited / corrupt doc.selection with a group id drops it on load (no whole-doc rejection)
	m.load({ meta: { id: '' }, nodes: [{ id: a.id, type: 'router', x: 0, y: 0 }], waypoints: [], links: [], zones: [], groups: [{ id: g.id, name: 'g', members: [a.id] }], selection: [a.id, g.id] });
	assert.equal(m.state.selection.has(g.id), false, 'group id dropped on load');
	assert.equal(m.state.selection.has(a.id), true, 'selectable id kept');
});
