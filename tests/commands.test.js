// Commands — the request builders.
//
// These used to test History: apply a command, replay its inverses, assert the model came back.
// Undo moved to the server (see tests/txn.test.js for the inverse round-trip and tests/undo.test.js
// for undo across writers), so what is left to test here is the FORWARD INTENT each builder
// produces, and the cascade closure they keep as a local projection.
//
// The closure is deliberately still here: a disconnected browser must not build a document whose
// links dangle. The server re-derives the same cascade idempotently over these explicit ops.

// RESTATED at C-e step five (H19.33; D5): `createGroup` and `ungroupAll` left the builders -- the groups plugin's keys make the
// group and hand it to `putEntity`, and name the groups for `deleteEntities` -- so these tests hold the generic builders with
// the edits the plugin makes, and the at-least-two rule through the plugin's own row
import { makeGroup } from '../groups/make-group.mjs';
import { GROUP_KEYS } from '../groups/group-keys.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from './fixtures/composed.mjs';   // the network's kinds, the link among them (S-e)
import { createEntity, moveEntities, deleteSelection, putEntity, deleteEntities,
	setContentValue, reshapeNodes, renameEntity } from '../app/src/commands.js';
import { applyOps } from '../model/ops.mjs';
import { Changes } from '../app/src/changes.js';
import { plan as planComposed } from './fixtures/composed.mjs';   // the planner production runs (V-d)

// B112: an unpositioned fixture node gets a DISTINCT anchor derived from its id -- one
// anchor holds one occupant, so two fixtures defaulting to (0,0) is now a real violation.
const _at = (id) => (parseInt(id.slice(-4), 16) % 15 + 1) * 60;
const node = (id, x = null, extra = {}) => ({ id, name: id, type: 'host', shape: 'circle', x: x ?? _at(id), y: 0, ...extra });

function seeded() {
	const m = new Model();
	['node-aa0001', 'node-aa0002', 'node-aa0003'].forEach((id, i) => m.put('node', node(id, i * 60)));
	m.put('link', { id: 'link-aa0004', name: 'link-aa0004', src: 'node-aa0001', dst: 'node-aa0002' });
	return m;
}

// what Changes does with a command, so a builder can be exercised end-to-end -- previewing with the planner, composed as the
// product page composes it (V-d, H18.28; PL-6): a builder sends intent, and the tab shows the planner's consequences
function apply(model, command) {
	const changes = new Changes(model, { preview: (m, ops) => planComposed(m, ops) });
	const sent = [];
	changes.onCommit((r) => sent.push(r));
	changes.commit(command);
	return sent[0] || null;
}

test('every builder emits forward intent only — no entry carries `before`', () => {
	const m = seeded();
	const commands = [
		createEntity('node', node('node-ab0001')),
		moveEntities([{ kind: 'node', id: 'node-aa0001', before: { x: 0, y: 0 }, after: { x: 60, y: 60 } }]),
		deleteSelection(m, new Set(['node-aa0001'])),
		putEntity('group', 'group', makeGroup(m, ['node-aa0001', 'node-aa0002'])),
		reshapeNodes(m, ['node-aa0001']),
		renameEntity('node', 'node-aa0001', 'old', 'new'),
		deleteEntities('ungroup', m, []),
	];
	for (const c of commands) {
		for (const e of c.entries) {
			assert.equal('before' in e, false, `${c.label}: the server derives the inverse`);
		}
	}
});

test('createEntity puts the entity', () => {
	const m = new Model();
	const req = apply(m, createEntity('node', node('node-ba0001')));
	assert.equal(req.label, 'create node');
	assert.deepEqual(req.ops, [{ op: 'put', kind: 'node', entity: node('node-ba0001') }]);
	assert.ok(m.get('node', 'node-ba0001'), 'and it is applied locally');
});

test('moveEntities carries only the destination', () => {
	const m = seeded();
	const req = apply(m, moveEntities([{ kind: 'node', id: 'node-aa0001', before: { x: 0, y: 0 }, after: { x: 120, y: 60 } }]));
	assert.deepEqual(req.ops, [{ op: 'set', kind: 'node', id: 'node-aa0001', patch: { x: 120, y: 60 } }]);
	assert.equal(m.get('node', 'node-aa0001').x, 120);
});

// AMENDED 2026-10-04 (V-d, H18.28; PL-6): the cascade is the planner's, previewed -- the request is the author's delete alone
test('deleteSelection sends the delete asked for, and the preview shows the cascade', () => {
	const m = seeded();
	const req = apply(m, deleteSelection(m, new Set(['node-aa0001'])));
	assert.deepEqual(req.ops, [{ op: 'del', kind: 'node', id: 'node-aa0001' }], 'intent only: what the author deleted');
	assert.equal(m.get('node', 'node-aa0001'), undefined);
	assert.equal(m.get('link', 'link-aa0004'), undefined, 'the link went with its endpoint, in the preview');
	assert.ok(req.applied.some((o) => o.op === 'del' && o.kind === 'link'), 'which the tab applied, and the answer is held to');
});

test('deleteSelection shrinks a group, and dissolves it below two members', () => {
	const m = seeded();
	m.put('group', { id: 'group-ca0001', name: 'g', members: ['node-aa0001', 'node-aa0002', 'node-aa0003'] });
	apply(m, deleteSelection(m, new Set(['node-aa0003'])));
	assert.deepEqual(m.get('group', 'group-ca0001').members, ['node-aa0001', 'node-aa0002'], 'shrunk');

	apply(m, deleteSelection(m, new Set(['node-aa0002'])));
	assert.equal(m.get('group', 'group-ca0001'), undefined, 'dissolved below two');
});

// AMENDED 2026-10-04 (V-d): under the network's rules a pinned link lives and dies with its pins (P-7, 2026-09-30) -- the
// browser's strip was the classic rule; the preview shows the planner's
test('deleting a via-waypoint deletes the link pinned at it (P-7)', () => {
	const m = seeded();
	m.put('node', { id: 'node-da0001', name: 'node-da0001', x: 60, y: 60 });
	m.set('link', 'link-aa0004', { via: ['node-da0001'] });
	apply(m, deleteSelection(m, new Set(['node-da0001'])));
	assert.equal(m.get('node', 'node-da0001'), undefined);
	assert.equal(m.get('link', 'link-aa0004'), undefined, 'the link pinned at it goes with it');
});

test('deleting a waypoint ENDPOINT deletes the link rather than stripping it', () => {
	const m = seeded();
	m.put('node', { id: 'node-ea0001', name: 'node-ea0001', x: 60, y: 60 });
	m.put('link', { id: 'link-ea0002', name: 'link-ea0002', src: 'node-aa0001', dst: 'node-ea0001' });
	apply(m, deleteSelection(m, new Set(['node-ea0001'])));
	assert.equal(m.get('link', 'link-ea0002'), undefined);
});

// AMENDED 2026-10-04 (V-d): the steal is the planner's group-steal, previewed; a new group is sent alone
test('a new group steals members, through the planner\'s rule', () => {
	const m = seeded();
	m.put('group', { id: 'group-fa0001', name: 'a', members: ['node-aa0001', 'node-aa0002', 'node-aa0003'] });
	const req = apply(m, putEntity('group', 'group', makeGroup(m, ['node-aa0002', 'node-aa0003'])));
	assert.deepEqual(req.ops.map((o) => `${o.op}/${o.kind}`), ['put/group'], 'intent only');
	const membership = m.all('group').flatMap((g) => g.members);
	assert.equal(new Set(membership).size, membership.length, 'no node in two groups');
});

test('Ctrl+G requires at least two endpoints', () => {
	const m = seeded();
	const group = GROUP_KEYS.find((r) => r.id === 'group');
	const put = [];
	const host = (ids) => ({ selected: () => ids.map((id) => ({ ...m.get('node', id), id, kind: 'node' })), put: (...a) => put.push(a) });
	group.run(host(['node-aa0001']));
	group.run(host([]));
	assert.equal(put.length, 0, 'one endpoint, or none, makes no group');
	group.run(host(['node-aa0001', 'node-aa0002']));
	assert.equal(put.length, 1, 'two make one -- the control');
});

// AMENDED 2026-10-04 (V-d): the fixture ids are hex -- `ga`, `ha`, `ia` are not, and the preview refuses them as the server would
test('setContentValue writes one region and does not alias the live array', () => {
	const m = new Model();
	m.put('node', node('node-c10001', 0, { content: [{ at: [0, 0], content: 'text', value: 'old' }] }));
	const req = apply(m, setContentValue(m, 'node-c10001', 0, 'new'));
	assert.equal(m.get('node', 'node-c10001').content[0].value, 'new');
	req.ops[0].patch.content[0].value = 'tampered';
	assert.equal(m.get('node', 'node-c10001').content[0].value, 'new', 'the op does not alias the model');
});

test('reshapeNodes toggles circle<->square and skips non-nodes', () => {
	const m = seeded();
	m.put('node', node('node-c20001', 240, { shape: 'square' }));
	const req = apply(m, reshapeNodes(m, ['node-aa0001', 'node-c20001', 'link-aa0004', 'node-nope']));
	assert.equal(req.ops.length, 2, 'only the two real nodes');
	assert.equal(m.get('node', 'node-aa0001').shape, 'square');
	assert.equal(m.get('node', 'node-c20001').shape, 'circle');
});

test('removing named groups is one command', () => {
	const m = seeded();
	m.put('group', { id: 'group-c30001', name: 'a', members: ['node-aa0001', 'node-aa0002'] });
	m.put('group', { id: 'group-c30002', name: 'b', members: ['node-aa0002', 'node-aa0003'] });
	apply(m, deleteEntities('ungroup', m, [{ kind: 'group', id: 'group-c30001' }, { kind: 'group', id: 'group-c30002' }]));
	assert.equal(m.all('group').length, 0);
});

/*
B87 -- every entry a builder emits must survive the conversion Changes performs on it.

`commands.js:6` documents a `del` entry as `{ op, kind, entity }` and `changes.js:24` reads
`entry.entity.id`, so an entry carrying `id` instead throws before any op reaches the wire. The
B81 cascade emitted exactly that and shipped, because the tests above assert over `entries`
directly and the one that converts them never reached this branch.

Driven through `apply`, which is the REAL `Changes`. Reimplementing `toOp` here was my first
attempt and would have been worthless: a copy of the converter can agree with a broken builder.
*/
test('B87: the B81 cascade entry survives the real Changes — it threw, and shipped', () => {
	const m = seeded();                                            // node-aa0001 -- node-aa0002 straight
	m.put('node', { id: 'node-aa0005', name: 'node-aa0005', x: 30, y: -40 });
	m.put('link', { id: 'link-aa0006', name: 'link-aa0006', src: 'node-aa0001', dst: 'node-aa0002', via: ['node-aa0005'] });

	// AMENDED 2026-10-04 (V-d): the browser's B81 strip is deleted; the pin's link goes by the planner (P-7), previewed
	const cmd = deleteSelection(m, new Set(['node-aa0005']));
	assert.ok(cmd.entries.every((e) => e.op !== 'del' || e.entity), 'every del carries its entity, as commands.js:6 requires');
	const sent = apply(m, cmd);
	assert.ok(sent, 'the command converted and committed rather than throwing');
	assert.ok(sent.applied.some((o) => o.op === 'del' && o.kind === 'link' && o.id === 'link-aa0006'),
		'and the preview deleted the link that bent through the pin (P-7)');
	assert.equal(m.get('link', 'link-aa0006'), undefined);
});

test('B87: every del entry a builder emits carries an entity, across every branch here', () => {
	const cases = () => {
		const m = seeded();
		m.put('node', { id: 'node-aa0005', name: 'node-aa0005', x: 30, y: -40 });
		m.put('link', { id: 'link-aa0006', name: 'link-aa0006', src: 'node-aa0001', dst: 'node-aa0002', via: ['node-aa0005'] });
		m.put('group', { id: 'group-aa0007', name: 'g', members: ['node-aa0002', 'node-aa0003'] });
		return m;
	};
	for (const [what, build] of [
		['waypoint whose strip would collide', (m) => deleteSelection(m, new Set(['node-aa0005']))],
		['node carrying links away', (m) => deleteSelection(m, new Set(['node-aa0001']))],
		['group emptied below two', (m) => deleteSelection(m, new Set(['node-aa0002']))],
		// CORRECTED at C-e step five: this case named a NODE as the group to remove, so it emitted nothing and held nothing
		['ungroup', (m) => deleteEntities('ungroup', m, [{ kind: 'group', id: 'group-aa0007' }])],
	]) {
		const m = cases();
		const cmd = build(m);
		for (const e of (cmd?.entries || [])) {
			if (e.op !== 'del') continue;
			assert.ok(e.entity && e.entity.id, `${what}: a ${e.kind} del with no entity`);
		}
		assert.doesNotThrow(() => apply(m, cmd), `${what}: the whole command converts`);
	}
});

/*
H15.6: cycling a link's declared direction, which has THREE states rather than two.

`flow` is absent (undeclared, symmetric), true (follows the stored order) or false (against it).
A toggle cannot express that, so the gesture cycles: undeclared -> forward -> reverse -> undeclared.

The last step is the one worth guarding. Returning to undeclared must REMOVE the key rather than
write some third value, because absent is what every document written before this field carries and
what `facing` reads as "no direction". A link left holding `flow: null` would be a fourth state the
model does not have.
*/
test('H15.6: cycling direction walks undeclared, forward, reverse, and back to absent', async () => {
	const { cycleDirection } = await import('../app/src/commands.js');
	const { linkFacing } = await import('../network/roles.mjs');

	const undeclared = { id: 'link-aa0001', src: 'node-aa0001', dst: 'node-aa0002' };
	const first = cycleDirection(undeclared);
	assert.equal(first.entries.length, 1, 'one entry -- a declaration is a single set');
	assert.equal(first.entries[0].after.direction, 'forward', 'undeclared becomes forward');

	const forward = { ...undeclared, direction: 'forward' };
	assert.equal(cycleDirection(forward).entries[0].after.direction, 'reverse', 'forward becomes reverse');
	assert.equal(linkFacing(forward, 'node-aa0002'), 'in', 'forward arrives at the stored dst');

	const reverse = { ...undeclared, direction: 'reverse' };
	const back = cycleDirection(reverse);
	assert.equal(linkFacing(reverse, 'node-aa0001'), 'in', 'reverse arrives at the stored src');

	/*
	THE KEY MUST GO, not be blanked. `model/shape.mjs` lists `flow` as OPTIONAL, and the set-inverse
	rule turns a patch that removes a key into a whole-entity put -- so undoing the last step of the
	cycle restores a link byte-identical to the one that had never been declared.
	*/
	assert.equal(back.entries[0].op, 'put', 'clearing is a whole-entity put -- a set cannot express an absence');
	assert.ok(!('direction' in back.entries[0].entity), 'and the entity it puts simply has no flow key');

	// and the labels say which way, because a cycle with a silent step is a cycle you lose your place in
	assert.notEqual(first.label, back.label, 'each step names what it did');

	/*
	B227 -- the READOUT says the relation, and the bar is the same fact the canvas draws.

	Asserted here rather than in the browser because the mapping is arithmetic: whatever
	`linkMarker` puts on the path, the readout's bar must agree with. A picture saying one thing
	and a readout saying another is the shape this register is full of.
	*/
	const bar = (l) => (l.direction === undefined ? '<->' : (l.direction === 'forward' ? '>>>' : '<<<'));
	const { linkMarker } = await import('../network/appearance.mjs');
	for (const l of [undeclared, forward, reverse]) {
		const head = linkMarker(l);
		const expect = head === 'end' ? '>>>' : head === 'start' ? '<<<' : '<->';
		assert.equal(bar(l), expect, 'the readout bar and the drawn head must be the same reading of `flow`');
	}

	/*
	AND THE CLEARED LINK MUST SURVIVE THE VALIDATOR, which is where the first version of this
	failed. `after: { flow: undefined }` sets an OWN PROPERTY holding undefined -- invisible to
	JSON.stringify, visible to `'direction' in link`, and refused by a schema asking typeof === boolean.

	So the clear was rejected in memory and silently repaired by a reload, which is B220's shape:
	two doors disagreeing with a restart hiding the evidence. The entry must therefore produce an
	entity the validator accepts, not merely one that looks right when printed.
	*/
	const { applyOps } = await import('../model/ops.mjs');
	const { validateEntity } = await import('./fixtures/composed.mjs');   // the network's kinds (S-e)
	const m = new Model();
	const seeded = { id: 'link-aa0001', name: 'l', src: 'node-aa0001', dst: 'node-aa0002', direction: 'reverse' };
	m.put('link', seeded);
	// cycle the REAL stored link, so the entry carries every field the validator will demand
	const clear = cycleDirection(m.get('link', 'link-aa0001'));
	applyOps(m, clear.entries.map((e) => (e.op === 'put' ? e : { op: e.op, kind: e.kind, id: e.id, patch: e.after })));
	const cleared = m.get('link', 'link-aa0001');
	assert.equal(validateEntity('link', cleared), null, 'a cleared link must pass the door it will be committed through');
	assert.equal(linkFacing(cleared, 'node-aa0002'), null, 'and read as undeclared, which is the point of clearing it');
});
