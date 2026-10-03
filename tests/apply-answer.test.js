/*
B288 -- AN ANSWER THAT JOINS A SELECTED LINK CARRIES THE SELECTION to the link it joined into (app/src/changes.js
`applyAnswer`, the one step the lab's door and production's sync take to apply a planner's answer). Driven by the REAL
planner's join, which marks the link it deletes with what it joined into (`into`, TG-1b succession): if the join stops
saying so, this fails rather than the selection quietly emptying again.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from './fixtures/composed.mjs';   // the composition production runs (S-b)
import { plan } from './fixtures/composed.mjs';
import { Selection } from '../app/src/selection.js';
import { applyAnswer } from '../app/src/changes.js';

const P = 60;
function board() {
	const m = new Model();
	m.put('node', { id: 'node-00000a', name: 'A', type: 'router', x: -6 * P, y: 0, shape: 'circle' });
	m.put('node', { id: 'node-00000b', name: 'B', type: 'router', x: 6 * P, y: 0, shape: 'circle' });
	m.put('node', { id: 'node-00000e', name: 'E', x: 0, y: -2 * P });
	m.put('link', { id: 'link-00000a', name: 'a', src: 'node-00000a', dst: 'node-00000e', control: true });
	m.put('link', { id: 'link-00000b', name: 'b', src: 'node-00000e', dst: 'node-00000b' });
	return { m, sel: new Selection(m) };
}
const join = (m) => {
	const r = plan(m, [{ op: 'set', kind: 'link', id: 'link-00000b', patch: { control: true } }]);
	assert.equal(r.ok, true);
	assert.ok(r.ops.some((o) => o.op === 'del' && o.id === 'link-00000b' && o.into === 'link-00000a'), 'the planner joined b into a, and said so');
	return r.ops;
};

test('B288: a selected link a join absorbs hands its selection to the link it joined into', () => {
	const { m, sel } = board();
	sel.set(['link-00000b']);
	let told = 0;
	sel.subscribe(() => told++);
	applyAnswer(m, sel, join(m));
	assert.deepEqual(sel.list(), ['link-00000a'], 'the joined link is selected');
	assert.ok(told > 0, 'and the selection says it changed, so the canvas reflects it');
});

test('B288: the half that keeps its id keeps its selection, and nothing is added to a selection that held neither', () => {
	const kept = board();
	kept.sel.set(['link-00000a']);
	applyAnswer(kept.m, kept.sel, join(kept.m));
	assert.deepEqual(kept.sel.list(), ['link-00000a']);
	const none = board();
	none.sel.set(['node-00000a']);
	applyAnswer(none.m, none.sel, join(none.m));
	assert.deepEqual(none.sel.list(), ['node-00000a'], 'a selection that held neither half is left as it was');
});

test('B288: a link deleted by request, not joined, leaves the selection as the delete leaves it', () => {
	const { m, sel } = board();
	sel.set(['link-00000b']);
	applyAnswer(m, sel, [{ op: 'del', kind: 'link', id: 'link-00000b' }]);
	assert.deepEqual(sel.list(), [], 'nothing joined it, so nothing inherits it');
});
