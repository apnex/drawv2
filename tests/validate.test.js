import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSelectionIds, validateDoc } from '../server/validate.js';
import { Model } from '../model/index.mjs';

// MS1: the persisted selection (model-state / status) is SHAPE-validated only — never
// existence-checked — so a deleted-but-selected id can't make the diagram vanish on boot.

test('validateSelectionIds is shape-only over selectable kinds', () => {
	assert.equal(validateSelectionIds([]), null);
	assert.equal(validateSelectionIds(['node-abc123', 'link-00ff99', 'zone-000000', 'waypoint-abcdef']), null);
	assert.match(validateSelectionIds('nope'), /array/);
	assert.match(validateSelectionIds(['group-abc123']), /invalid selection id/);   // group not selectable
	assert.match(validateSelectionIds(['__proto__']), /invalid selection id/);
	assert.match(validateSelectionIds([{}]), /invalid selection id/);
	assert.match(validateSelectionIds(new Array(10001).fill('node-abc123')), /exceeds limit/);
});

const baseDoc = (selection) => ({
	meta: { id: 'diagram-abc123', name: 'd' },
	nodes: [], waypoints: [], links: [], zones: [], groups: [], selection
});

test('validateDoc TOLERATES a dangling selection id (status must not invalidate config)', () => {
	assert.equal(validateDoc(baseDoc(['node-deadbe'])), null, 'a selection id with no entity does NOT reject the doc');
});

test('validateDoc rejects a malformed selection (shape)', () => {
	assert.match(validateDoc(baseDoc(['garbage'])), /invalid selection id/);
});

test('validateDoc still accepts a doc with no selection key (legacy)', () => {
	const doc = baseDoc(undefined); delete doc.selection;
	assert.equal(validateDoc(doc), null);
});

/*
B95/H5.8 -- `validateDoc` is named for the flat JSON, and that is a real distinction, not a leftover.

H5.7 renamed the substrate `document/` to `model/` and deliberately kept `doc`, `docfile` and
`validateDoc`, because a Model is the live object and a `doc` is the serialized form. The reasoning
sat in a closed backlog row, so the question recurred five milestones later and the answer had to be
re-derived from git history.

Prose in three places now says it. This asserts it, so the claim is a property of the code: a Model
is NOT a valid doc, and `toJSON()` is exactly the step that makes one. If those ever converge, the
name stops discriminating and this fails -- which is the only honest way to keep a naming decision
true rather than merely documented.
*/
test('B95: a Model is not a doc, and toJSON is the boundary between them', () => {
	const model = new Model();
	model.load({
		meta: { id: 'diagram-aa0001', name: 't', version: 0, schema: 1 },
		nodes: [], waypoints: [], links: [], zones: [], groups: [],
	});

	assert.equal(validateDoc(model.toJSON()), null, 'what toJSON produces IS a doc');
	assert.notEqual(validateDoc(model), null,
		'and the live Model is not one — if this ever passes, the two shapes have converged and '
		+ 'validateDoc has stopped naming anything specific');

	// the asymmetry that makes the vocabulary worth keeping: behaviour lives on one side only
	assert.equal(typeof model.put, 'function', 'a Model has methods');
	assert.equal(typeof model.toJSON().put, 'undefined', 'a doc has none — it is data on the wire');
});
