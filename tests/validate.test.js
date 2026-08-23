import { test } from 'node:test';
import { STD } from '../kernel/index.mjs';
import assert from 'node:assert/strict';
import { validateSelectionIds, validateDoc, validateMutation } from '../server/validate.js';
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

const M = new Model();

/*
B110 -- geometry is enforced at the trust boundary, not by the browser's good manners.

Snapping lived only in app/src/snap.js, so it ran before a human's commit and never before an
agent's: 8 of 9 nodes in the first agent-drawn diagram were off-pitch, and a zone was off the
half-pitch offset that zones use. Nothing reported any of it.

The consequence is an index one, not an aesthetic one. cellOf is Math.round(v/pitch), so
cellOf(-270) and cellOf(-240) are both cell -4 -- two entities at different pixels sharing one cell
in the R13 occupancy index while looking distinct on screen.
*/
const put = (kind, entity) => validateMutation(M, { action: 'put', kind, entity });
const set = (kind, entity) => validateMutation(M, { action: 'set', kind, entity });

test('B110: a node off the pitch is refused, on the pitch is accepted', () => {
	const ok = { id: 'node-aa0001', name: 'n', type: 'host', x: 240, y: -120 };
	assert.equal(put('node', ok), null);
	for (const [x, y] of [[270, -120], [240, -150], [1, 0], [-30, 0]]) {
		assert.match(String(put('node', { ...ok, x, y })), /invalid value for node\.[xy]/,
			`(${x},${y}) must be refused`);
	}
});

test('B110: the refusal covers `set`, which is how a node MOVES', () => {
	// a put landing on-grid and a set walking it off would leave the rule half-enforced
	assert.equal(set('node', { id: 'node-aa0001', x: 300 }), null);
	assert.match(String(set('node', { id: 'node-aa0001', x: 301 })), /invalid value for node\.x/);
});

test('B110: a waypoint shares the NODE grid', () => {
	assert.equal(put('waypoint', { id: 'waypoint-aa0001', x: -120, y: 60 }), null);
	assert.match(String(put('waypoint', { id: 'waypoint-aa0001', x: -90, y: 60 })),
		/invalid value for waypoint\.x/,
		'the exact value the agent wrote live, and that the browser then snapped to -120');
});

test('B110: a zone sits on the HALF-pitch grid, because it bounds cells rather than sitting on one', () => {
	const ok = { id: 'zone-aa0001', name: 'z', x: -750, y: -390, w: 600, h: 420 };
	assert.equal(put('zone', ok), null);
	// -780 is ON the node grid and OFF the zone grid: the rule its author did not know existed
	assert.match(String(put('zone', { ...ok, x: -780 })), /invalid value for zone\.x/);
	assert.match(String(put('zone', { ...ok, w: 630 })), /invalid value for zone\.w/);
});

test('B110: the pitch is SOURCED from the kernel, so the grid cannot fork', () => {
	const off = STD.pitch / 2;
	assert.match(String(put('node', { id: 'node-aa0001', name: 'n', type: 'host', x: off, y: 0 })),
		/invalid value for node\.x/, `half a pitch (${off}) must never be a legal node position`);
});
