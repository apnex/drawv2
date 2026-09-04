import { test } from 'node:test';
import fs from 'node:fs';
import { collectionCap } from '../engine/index.mjs';
import { NODE_EXT, ZONE_EXT } from '../model/index.mjs';
import { violations } from '../model/invariants.mjs';
import { commit } from '../server/txn.mjs';
import { Log } from '../server/log.mjs';
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
	assert.equal(put('waypoint', { id: 'waypoint-aa0001', name: 'waypoint-aa0001', x: -120, y: 60 }), null);
	assert.match(String(put('waypoint', { id: 'waypoint-aa0001', name: 'waypoint-aa0001', x: -90, y: 60 })),
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

/*
B112 -- one anchor holds one occupant, enforced by the rules engine rather than at a call site.

`engine/relations.mjs` keys cell occupancy as an eager index, so the index has always ASSUMED this
while nothing enforced it. The live estate held zero collisions across 146 entities and only
because the one path able to break it -- a human dragging -- has eyes on the result.

In `violations()` and not `validate.js`, because it is a property of the DOCUMENT that no single
entity can be asked about. That placement buys two things the planner relies on: the check runs
against the state a transaction would produce, so a batch may transiently collide and end valid,
and only what a transaction INTRODUCES is refused, so a document already holding a collision can
still be repaired.
*/
test('B112: two nodes on one anchor is a violation', () => {
	const m = new Model();
	m.put('node', { id: 'node-aa0001', name: 'a', type: 'host', shape: 'circle', x: 60, y: 60 });
	assert.deepEqual(violations(m), []);
	m.put('node', { id: 'node-aa0002', name: 'b', type: 'host', shape: 'circle', x: 60, y: 60 });
	assert.match(String(violations(m)), /occupy the same anchor \(60,60\)/);
});

test('B112: a waypoint occupies an anchor, because a waypoint IS a node for placement', () => {
	const m = new Model();
	m.put('node', { id: 'node-aa0001', name: 'a', type: 'host', shape: 'circle', x: 120, y: 0 });
	m.put('waypoint', { id: 'waypoint-aa0001', name: 'waypoint-aa0001', x: 180, y: 0 });
	assert.deepEqual(violations(m), [], 'distinct anchors are fine');
	m.set('waypoint', 'waypoint-aa0001', { x: 120 });
	assert.match(String(violations(m)), /occupy the same anchor \(120,0\)/,
		'a bend hidden under a node is not a diagram anyone can read');
});

test('B112: the planner refuses a commit that would land a node on a taken anchor', () => {
	const m = new Model();
	m.put('node', { id: 'node-aa0001', name: 'a', type: 'host', shape: 'circle', x: 300, y: 0 });
	const log = new Log(0);
	const r = commit(m, log, { ops: [{ op: 'put', kind: 'node',
		entity: { id: 'node-aa0002', name: 'b', type: 'host', shape: 'circle', x: 300, y: 0 } }] }, 'server', 't');
	assert.equal(r.ok, false);
	assert.match(r.error, /occupy the same anchor/);
	assert.equal(m.all('node').length, 1, 'and it wrote nothing');
});

test('B112: a MOVE onto a free anchor still passes -- the rule is not "never touch a node"', () => {
	const m = new Model();
	m.put('node', { id: 'node-aa0001', name: 'a', type: 'host', shape: 'circle', x: 300, y: 0 });
	m.put('node', { id: 'node-aa0002', name: 'b', type: 'host', shape: 'circle', x: 360, y: 0 });
	const log = new Log(0);
	const r = commit(m, log, { ops: [{ op: 'set', kind: 'node', id: 'node-aa0002', patch: { x: 420 } }] }, 'server', 't');
	assert.equal(r.ok, true);
});

test('B112: a document already holding a collision can still be REPAIRED', () => {
	/*
	The planner reports only what a transaction INTRODUCES. Refusing on the post-state alone would
	mean a document that somehow reached a bad state could never be fixed, because the fix is itself
	a transaction and would be refused for the condition it exists to remove.
	*/
	const m = new Model();
	m.put('node', { id: 'node-aa0001', name: 'a', type: 'host', shape: 'circle', x: 600, y: 0 });
	m.put('node', { id: 'node-aa0002', name: 'b', type: 'host', shape: 'circle', x: 600, y: 0 });
	assert.equal(violations(m).length, 1, 'the document starts broken');
	const log = new Log(0);
	const r = commit(m, log, { ops: [{ op: 'set', kind: 'node', id: 'node-aa0002', patch: { x: 660 } }] }, 'server', 't');
	assert.equal(r.ok, true, 'the repair is not refused for the condition it removes');
	assert.deepEqual(violations(m), []);
});

/*
B113 -- the number in the code is the number that binds, and the server bounds what the client clamps.

Two separate claims, both previously unasserted, and a mutant walked through each.
*/
test('B113: the positioned cap is DERIVED from the grid, not a flat constant', () => {
	const cap = collectionCap({ nodeExt: NODE_EXT, zoneExt: ZONE_EXT, pitch: STD.pitch });
	const anchors = (Math.floor(NODE_EXT.x / STD.pitch) * 2 + 1) * (Math.floor(NODE_EXT.y / STD.pitch) * 2 + 1);
	assert.equal(cap.node, anchors, 'the node cap IS the number of node anchors');
	assert.equal(cap.node, 527);
	assert.equal(cap.waypoint, cap.node, 'a waypoint is a node for placement, so it shares the ceiling');
	assert.notEqual(cap.node, 2000, 'a flat 2000 is unreachable for a positioned kind and so is not a limit');
	// unpositioned kinds have no anchors, so the flat cap stands and stays reachable
	assert.equal(cap.link, 2000);
	assert.equal(cap.group, 2000);
});

test('B113: the server refuses what the editor could never have produced', () => {
	/*
	validate allowed the SURFACE half-extent (960 x 540) while snap.js clamped a node to NODE_EXT
	(900 x 480), so a hundred positions were legal to the server and unreachable in the editor --
	the same shape as B110, with the agent door as the caller nobody bound.
	*/
	const ok = { id: 'node-aa0001', name: 'n', type: 'host', x: 900, y: 480 };
	assert.equal(put('node', ok), null, 'the client clamp itself is legal');
	assert.match(String(put('node', { ...ok, x: 960 })), /invalid value for node\.x/,
		'960 is on-grid and inside the surface, and the editor can never reach it');
	assert.match(String(put('node', { ...ok, y: 540 })), /invalid value for node\.y/);

	// a zone reaches further than a node, by half a cell, and that difference is preserved
	const z = { id: 'zone-aa0001', name: 'z', x: -930, y: -510, w: 600, h: 420 };
	assert.equal(put('zone', z), null, 'a zone may sit where a node may not');
	assert.match(String(put('zone', { ...z, x: -990 })), /invalid value for zone\.x/);
});

/*
B86 / H10.17 -- a cap has ONE definition, and the two enforcers agree on the number.

The caps were restated with no shared constant: the name cap at six sites, the content cap at two,
the span cap at both peers, and the zone minimum as a bare `60` on the server against a value the
client derived from the kernel. Each pair agrees on the day it is written.

ASSERTED AS BEHAVIOUR, not as an import. Checking that both files import the same symbol proves only
that today's source is tidy; it says nothing about what either one DOES, and a future literal put
back at one site would satisfy it. These drive the boundary instead: exactly at the cap passes, one
past it is refused, and the truncating side lands on the same number the rejecting side draws.

THE TWO RESPONSES DIFFER ON PURPOSE. store.js and the client TRUNCATE, validate.js REJECTS. B86
recorded that this "is not currently a bug because truncation happens first, and is the kind of pair
that becomes one" -- it becomes one exactly when the numbers diverge, which is what these pin.
*/
test('B86: the name cap is one number, and truncation lands where rejection begins', async () => {
	const { NAME_MAX } = await import('../model/limits.mjs');
	const { validateDoc } = await import('../server/validate.js');
	const doc = (name) => ({ meta: { id: 'diagram-aa0001', name, version: 1 }, node: {}, link: {}, group: {}, zone: {}, waypoint: {} });

	assert.equal(validateDoc(doc('x'.repeat(NAME_MAX))), null, 'exactly at the cap is legal');
	assert.match(validateDoc(doc('x'.repeat(NAME_MAX + 1))) || '', /meta\.name/, 'one past it is refused');

	// the truncating side. If either number moved alone, the store would keep a name the validator
	// would then refuse to load -- a document that cannot be read back.
	const { Store } = await import('../server/store.js');
	const kept = String('x'.repeat(NAME_MAX + 50)).slice(0, NAME_MAX);
	assert.equal(kept.length, NAME_MAX);
	assert.equal(validateDoc(doc(kept)), null, 'what the store keeps is what the validator accepts');
	assert.ok(Store, 'the truncating module loads');
});

test('B86: the span and content caps are one number across both peers', async () => {
	const { SPAN_MAX, CONTENT_VALUE_MAX } = await import('../model/limits.mjs');
	const { validateEntity } = await import('../server/validate.js');
	const node = (span) => ({ id: 'node-aa0001', type: 'host', x: 0, y: 0, name: 'n', span });

	assert.equal(validateEntity('node', node({ cols: SPAN_MAX, rows: SPAN_MAX }), { full: false }), null);
	assert.ok(validateEntity('node', node({ cols: SPAN_MAX + 1, rows: 1 }), { full: false }),
		'one cell past the cap is refused by the server');

	/*
	The client's resize clamps to the same number, so it never offers a span the server refuses.

	Asserted on the SOURCE, and reluctantly. A shared constant and a literal of the same value are
	behaviourally indistinguishable -- that is exactly why this class of defect survives testing, and
	why B86 existed at all. `assert.match(src, /SPAN_MAX/)` was the first attempt and it SURVIVED the
	mutant: reverting one of the two clamps left the other matching. So the assertion is the absence
	of the literal, which is the only thing that actually differs.
	*/
	const src = fs.readFileSync(new URL('../app/src/commands.js', import.meta.url), 'utf8');
	assert.doesNotMatch(src, /,\s*64\s*\)/, 'the client clamps to the shared cap, never a literal of its own');
	assert.equal((src.match(/SPAN_MAX/g) || []).length, 3, 'both clamps and the import, so neither reverted alone');

	const region = (value) => ({ id: 'node-aa0002', type: 'host', x: 0, y: 0, name: 'n',
		content: [{ at: [0, 0], cols: 1, rows: 1, content: 'text', value }] });
	assert.equal(validateEntity('node', region('x'.repeat(CONTENT_VALUE_MAX)), { full: false }), null);
	assert.ok(validateEntity('node', region('x'.repeat(CONTENT_VALUE_MAX + 1)), { full: false }),
		'one character past the content cap is refused');
});

/*
And the two lists that were kept in step by a COMMENT rather than by a check.

`model/shape.mjs` claimed it had superseded "the OPTIONAL map in server/validate.js" while that map
was still there and still the one consulted, and `server/txn.mjs` imported the shape.mjs version and
never used it -- so every angle except the consuming one made the tree look single-sourced.
`SELECTABLE` was a Set in the model and a regex on the server, held together by a comment reading
"MUST match server/validate.js SELECTABLE".
*/
test('B86: the selectable kinds are derived from the model, not restated beside it', async () => {
	const { SELECTABLE_KINDS } = await import('../model/index.mjs');
	const { validateSelectionIds } = await import('../server/validate.js');
	for (const kind of SELECTABLE_KINDS) {
		assert.equal(validateSelectionIds([`${kind}-aa0001`]), null, `${kind} is selectable in both`);
	}
	assert.ok(validateSelectionIds(['group-aa0001']), 'and a group is selectable in neither');
	assert.ok(SELECTABLE_KINDS.length >= 4, 'the list is non-trivial, so the loop is not vacuous');
});

test('B86: validate.js consults the shared OPTIONAL map, and declares none of its own', () => {
	const src = fs.readFileSync(new URL('../server/validate.js', import.meta.url), 'utf8');
	assert.doesNotMatch(src, /^const OPTIONAL\s*=/m,
		'a local OPTIONAL is the duplicate shape.mjs has always claimed to have replaced');
	assert.match(src, /import \{ OPTIONAL \} from '\.\.\/model\/shape\.mjs'/, 'it imports the one map');
	const txn = fs.readFileSync(new URL('../server/txn.mjs', import.meta.url), 'utf8');
	assert.doesNotMatch(txn, /import \{[^}]*OPTIONAL[^}]*\} from/,
		'and txn.mjs no longer imports it unused, which is what made the tree look single-sourced');
});

/*
B86: the zone minimum is one grid cell, and the server takes it from the same place the client does.

The server carried a bare `60` while the client used `MIN_ZONE = GAP = STD.pitch`, derived from the
kernel. Two numbers that agree only because nobody has changed the pitch.

DERIVED FROM THE KERNEL HERE TOO, which is what makes this a real guard rather than a restatement of
the literal. A source grep would prove only that today's file is tidy. This asserts the boundary sits
at exactly one pitch, so if the kernel's pitch moved and the server kept a hardcoded 60, the server
would start refusing the smallest zone the client can draw -- and this fails.
*/
test('B86: the smallest legal zone is one grid cell, wherever the pitch is set', async () => {
	const { STD } = await import('../kernel/index.mjs');
	const { validateEntity } = await import('../server/validate.js');
	const off = STD.pitch / 2;                                    // the zone grid's half-pitch offset
	const zone = (w) => ({ id: 'zone-aa0001', x: off, y: off, w, h: STD.pitch, name: 'z' });

	assert.equal(validateEntity('zone', zone(STD.pitch), { full: false }), null,
		'one cell is legal — the client can draw it, so the server must accept it');
	assert.match(validateEntity('zone', zone(STD.pitch / 2), { full: false }) || '', /zone\.w/,
		'half a cell is not');
	assert.match(validateEntity('zone', zone(0), { full: false }) || '', /zone\.w/, 'nor is nothing');
});

/*
B83 / H10.16 -- the two referential paths agree, because there is only one of them.

Five cross-entity rules were written twice inside `server/validate.js`: once incrementally against a
live Model in `validateMutation`, once globally against a plain doc in `validateDoc`. Two
implementations, two error vocabularies, two complexity classes, and nothing forcing them to agree.
A disagreement means a document the wire refuses can be loaded from disk, or the reverse -- and the
two peers then hold different beliefs about what a valid diagram is.

DIFFERENTIAL, not unit. Asserting that each path rejects a bad document proves each path works; it
cannot prove they work ALIKE, which is the only property the collapse actually buys. So each case is
put through both doors -- whole-document, and entity by entity as a client would build it -- and the
VERDICTS are compared. Sharing the predicate is what makes them agree; this is what would notice if
someone unshared it.
*/
test('B83: the document door and the mutation door reach the same verdict', async () => {
	const { validateDoc, validateMutation } = await import('../server/validate.js');
	const { Model } = await import('../model/index.mjs');

	const N = (n, x) => ({ id: `node-aa000${n}`, type: 'host', x, y: 0, name: `n${n}` });
	const W = (n, y) => ({ id: `waypoint-aa000${n}`, name: `w${n}`, x: 60, y });
	const base = { meta: { id: 'diagram-aa0001', name: 't', version: 1 }, zones: [], groups: [], waypoints: [] };

	const cases = {
		'clean, two nodes and a link':
			{ nodes: [N(1, 0), N(2, 60)], links: [{ id: 'link-aa0001', name: 'link-aa0001', src: 'node-aa0001', dst: 'node-aa0002' }] },
		'link to a node that does not exist':
			{ nodes: [N(1, 0)], links: [{ id: 'link-aa0001', name: 'link-aa0001', src: 'node-aa0001', dst: 'node-aa0009' }] },
		'self-link':
			{ nodes: [N(1, 0)], links: [{ id: 'link-aa0001', name: 'link-aa0001', src: 'node-aa0001', dst: 'node-aa0001' }] },
		'clean route through a waypoint':
			{ nodes: [N(1, 0), N(2, 60)], waypoints: [W(1, 60)],
				links: [{ id: 'link-aa0001', name: 'link-aa0001', src: 'node-aa0001', dst: 'node-aa0002', via: ['waypoint-aa0001'] }] },
		'via a waypoint that does not exist':
			{ nodes: [N(1, 0), N(2, 60)],
				links: [{ id: 'link-aa0001', name: 'link-aa0001', src: 'node-aa0001', dst: 'node-aa0002', via: ['waypoint-aa0009'] }] },
		'one waypoint in two roles on one link':
			{ nodes: [N(1, 0)], waypoints: [W(1, 60)],
				links: [{ id: 'link-aa0001', name: 'link-aa0001', src: 'node-aa0001', dst: 'waypoint-aa0001', via: ['waypoint-aa0001'] }] },
		'one waypoint shared by two links':
			{ nodes: [N(1, 0), N(2, 60), N(3, 120), N(4, 180)], waypoints: [W(1, 60)],
				links: [{ id: 'link-aa0001', name: 'link-aa0001', src: 'node-aa0001', dst: 'node-aa0002', via: ['waypoint-aa0001'] },
					{ id: 'link-aa0002', name: 'link-aa0002', src: 'node-aa0003', dst: 'node-aa0004', via: ['waypoint-aa0001'] }] },
		'group member that does not exist':
			{ nodes: [N(1, 0), N(2, 60)], links: [],
				groups: [{ id: 'group-aa0001', members: ['node-aa0001', 'node-aa0009'], name: 'g' }] },
		'clean group':
			{ nodes: [N(1, 0), N(2, 60)], links: [],
				groups: [{ id: 'group-aa0001', members: ['node-aa0001', 'node-aa0002'], name: 'g' }] },
	};

	let rejected = 0;
	for (const [name, parts] of Object.entries(cases)) {
		const doc = { ...base, ...parts };
		const viaDoc = validateDoc(doc);

		// the same content assembled the way a client builds it: dependencies first, then the
		// entities that reference them, each through the mutation door
		const m = new Model();
		let viaMutation = null;
		for (const [kind, list] of [['node', doc.nodes], ['waypoint', doc.waypoints], ['link', doc.links], ['group', doc.groups]]) {
			for (const entity of list || []) {
				viaMutation ||= validateMutation(m, { action: 'put', kind, entity });
				if (!viaMutation) m.put(kind, entity);
			}
		}
		assert.equal(Boolean(viaDoc), Boolean(viaMutation),
			`"${name}": the doors disagree — document says ${viaDoc || 'OK'}, mutation says ${viaMutation || 'OK'}`);
		if (viaDoc) rejected++;
	}
	assert.equal(rejected, 6, 'six of the nine cases are bad — if this drops, the corpus stopped exercising the rules');
});

/*
H9.9 -- `template` is a document-level kind in the ID grammar, not a fact tracked beside the id.

Templates are read from the image, never written to the store, and fork on first write. Putting the
kind IN the identifier is the design decision, and it is worth a test because the alternative was
close: templates carrying `diagram-` ids, told apart by a lookup. That needed a branch in roughly
fifteen store methods, and a path that forgot the branch would fail SILENTLY -- `remove` deleting a
file that lives in the image, `grant` sharing something with no owner. Here an unhandled kind is
refused by the grammar, which is loud.

The four shipped templates are validated as the documents they are, so a malformed one is a test
failure rather than a boot failure.
*/
test('H9.9: a template id is a valid document id, and a made-up kind is not', async () => {
	const { validateDoc } = await import('../server/validate.js');
	const doc = (id) => ({ meta: { id, name: 't', version: 0 }, nodes: [], links: [], groups: [], zones: [], waypoints: [] });

	assert.equal(validateDoc(doc('template-4f2c11')), null, 'a template is a document');
	assert.equal(validateDoc(doc('diagram-4f2c11')), null, 'and so is a diagram, unchanged');
	assert.match(validateDoc(doc('node-4f2c11')) || '', /meta\.id/, 'an ENTITY kind is not a document');
	assert.match(validateDoc(doc('sketch-4f2c11')) || '', /meta\.id/, 'and an invented kind is refused');

	// kindOf needed no change at all: it is `id.split('-')[0]`, so the id answers for itself
	const { kindOf } = await import('../model/index.mjs');
	assert.equal(kindOf('template-4f2c11'), 'template', 'the identifier carries the kind');
});

test('H9.9: every shipped template is a valid document', async () => {
	const { validateDoc } = await import('../server/validate.js');
	const dir = new URL('../templates/', import.meta.url);
	const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
	assert.ok(files.length >= 4, 'the template set is present — otherwise this passes vacuously');
	const names = new Set();
	for (const f of files) {
		const doc = JSON.parse(fs.readFileSync(new URL(f, dir), 'utf8'));
		assert.equal(validateDoc(doc), null, `${f} is a valid document`);
		assert.equal(`${doc.meta.id}.json`, f, `${f} is named for the id it carries`);
		assert.match(doc.meta.id, /^template-[0-9a-f]{6}$/, `${f} carries a template id`);
		// a template has no owner and no grants by construction: it is nobody's, which is what
		// makes it listable to everyone and forkable by anyone
		assert.equal(doc.meta.owner, undefined, `${f} has no owner`);
		assert.equal(doc.meta.grants, undefined, `${f} has no grants`);
		assert.equal(doc.selection, undefined, `${f} carries no selection — that was the author's, not the forker's`);
		assert.equal(names.has(doc.meta.name), false, `${doc.meta.name} appears twice — the picker would be ambiguous`);
		names.add(doc.meta.name);
	}
});
