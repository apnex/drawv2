// txn — the one write. These are the properties the old single-op planner could not express:
// a transaction spanning N ops, an inverse derived at plan time, a cascade that is ONE change,
// and a no-op that is accepted without becoming one.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from '../model/index.mjs';
import { plan, commit, undo, redo, MAX_OPS } from '../server/txn.mjs';
import { Log } from '../server/log.mjs';

// B112: an unpositioned fixture node gets a DISTINCT anchor derived from its id -- one
// anchor holds one occupant, so two fixtures defaulting to (0,0) is now a real violation.
const _at = (id) => (parseInt(id.slice(-4), 16) % 15 + 1) * 60;
const node = (id, x = null, extra = {}) => ({ id, name: id, type: 'host', shape: 'circle', x: x ?? _at(id), y: 0, ...extra });
const fresh = () => ({ m: new Model(), log: new Log(0) });
const put = (kind, entity) => ({ op: 'put', kind, entity });
// meta.rev is the legacy per-mutation counter; it still increments until CS5 and is not part of
// the document's identity. Compare the document, not the counter due to be deleted.
// meta.version is a property of the TRANSACTION, not of the document: undo bumps it rather than
// restoring it (D3), so a document-equality check must exclude it.
const shape = (mm) => { const d = mm.toJSON(); delete d.meta.version; return JSON.stringify(d); };

function seeded() {
	const { m, log } = fresh();
	commit(m, log, { ops: [
		put('node', node('node-aa0001', -120)),
		put('node', node('node-aa0002', 120)),
		put('link', { id: 'link-aa0003', src: 'node-aa0001', dst: 'node-aa0002' }),
	] }, 'server', 't');
	return { m, log };
}

// ---- I1: the planner is pure ----

test('plan: reads the model and writes NOTHING, even for a plan that would mutate', () => {
	const { m } = seeded();
	const snapshot = JSON.stringify(m.toJSON());
	const r = plan(m, [{ op: 'del', kind: 'node', id: 'node-aa0001' }]);
	assert.equal(r.ok, true);
	assert.ok(r.ops.length > 1, 'the plan carries the cascade');
	assert.equal(JSON.stringify(m.toJSON()), snapshot, 'the live model is untouched by planning');
});

test('plan: a rejected op leaves the model untouched and reports its index', () => {
	const { m } = seeded();
	const snapshot = JSON.stringify(m.toJSON());
	const r = plan(m, [
		put('node', node('node-aa0004', 240)),
		{ op: 'set', kind: 'node', id: 'node-aa0099', patch: { x: 0 } },   // missing
	]);
	assert.equal(r.ok, false);
	assert.equal(r.opIndex, 1, 'the failing op index is reported');
	assert.equal(JSON.stringify(m.toJSON()), snapshot);
});

// ---- I4: a cascade is ONE change ----

test('commit: a del-node cascade is ONE change, not one per op', () => {
	const { m, log } = seeded();
	const before = log.version;
	const r = commit(m, log, { label: 'delete', ops: [{ op: 'del', kind: 'node', id: 'node-aa0001' }] }, 'server', 't');
	assert.equal(r.ok, true);
	assert.equal(r.version, before + 1, 'exactly one version bump');
	assert.equal(log.records.length, 1 + 1, 'exactly one record appended');
	assert.equal(r.change.ops.length, 2, 'del link + del node in one change');
	assert.equal(m.all('link').length, 0, 'the link cascaded');
});

test('commit: a batch of N ops is ONE change', () => {
	const { m, log } = fresh();
	const r = commit(m, log, { ops: [
		put('node', node('node-bb0001', -60)),
		put('node', node('node-bb0002', 60)),
		put('link', { id: 'link-bb0003', src: 'node-bb0001', dst: 'node-bb0002' }),
	] }, 'server', 't');
	assert.equal(r.version, 1, 'one transaction, one version');
	assert.equal(r.change.ops.length, 3);
});

test('plan: op k is validated against the state left by op k-1', () => {
	const { m, log } = fresh();
	// the link would be invalid against the empty model; it is valid after the two puts
	const r = commit(m, log, { ops: [
		put('node', node('node-cc0001', -60)),
		put('node', node('node-cc0002', 60)),
		put('link', { id: 'link-cc0003', src: 'node-cc0001', dst: 'node-cc0002' }),
	] }, 'server', 't');
	assert.equal(r.ok, true, r.error);
});

// ---- I3: the inverse round-trips, per op kind ----

test('inverse: put/set/del each round-trip through undo', () => {
	const { m, log } = seeded();
	const original = shape(m);

	commit(m, log, { ops: [put('node', node('node-dd0001', 300))] }, 'server', 't');
	commit(m, log, { ops: [{ op: 'set', kind: 'node', id: 'node-aa0002', patch: { x: 240 } }] }, 'server', 't');
	commit(m, log, { ops: [{ op: 'del', kind: 'link', id: 'link-aa0003' }] }, 'server', 't');
	assert.notEqual(shape(m), original);

	undo(m, log); undo(m, log); undo(m, log);
	assert.equal(shape(m), original, 'three undos restore the exact original');
});

test('inverse: a set that INTRODUCES a key inverts as a whole-entity put', () => {
	const { m, log } = fresh();
	commit(m, log, { ops: [put('node', node('node-ee0001'))] }, 'server', 't');
	assert.equal(m.get('node', 'node-ee0001').span, undefined);
	const r = commit(m, log, { ops: [{ op: 'set', kind: 'node', id: 'node-ee0001', patch: { span: { cols: 3, rows: 2 } } }] }, 'server', 't');
	assert.equal(r.change.inverse[0].op, 'put', 'no set can express "remove this key again"');
	undo(m, log);
	assert.equal(m.get('node', 'node-ee0001').span, undefined, 'the key is gone again, not null');
});

test('inverse: a composite field is deep-copied, so undo is not aliased to the live entity', () => {
	const { m, log } = fresh();
	commit(m, log, { ops: [put('node', node('node-ff0001', 0, { span: { cols: 1, rows: 1 } }))] }, 'server', 't');
	const r = commit(m, log, { ops: [{ op: 'set', kind: 'node', id: 'node-ff0001', patch: { span: { cols: 4, rows: 4 } } }] }, 'server', 't');
	m.get('node', 'node-ff0001').span.cols = 99;            // mutate the live entity under the log
	assert.equal(r.change.inverse[0].patch.span.cols, 1, 'the stored inverse still holds the ORIGINAL value');
});

// ---- I6: a no-op is accepted and is not a change ----

test('commit: a value-identical set is accepted, appends nothing, bumps nothing', () => {
	const { m, log } = seeded();
	const before = log.version;
	const records = log.records.length;
	const r = commit(m, log, { ops: [{ op: 'set', kind: 'node', id: 'node-aa0002', patch: { x: 120 } }] }, 'server', 't');
	assert.equal(r.ok, true, 'accepted');
	assert.equal(r.change, null, 'but it is not a change');
	assert.equal(log.version, before);
	assert.equal(log.records.length, records);
});

test('commit: a set narrows to only the keys that actually change', () => {
	const { m, log } = seeded();
	const r = commit(m, log, { ops: [{ op: 'set', kind: 'node', id: 'node-aa0002', patch: { x: 120, y: 60 } }] }, 'server', 't');
	assert.deepEqual(Object.keys(r.change.ops[0].patch), ['y'], 'x was already 120');
});

// ---- the group member-steal: new server-side rule (B1) ----

test('group: a second group STEALS overlapping members, and undo restores both', () => {
	const { m, log } = fresh();
	for (const [id, x] of [['node-ab0001', -180], ['node-ab0002', -60], ['node-ab0003', 60], ['node-ab0004', 180]]) {
		commit(m, log, { ops: [put('node', node(id, x))] }, 'server', 't');
	}
	commit(m, log, { ops: [put('group', { id: 'group-ac0001', name: 'A', members: ['node-ab0001', 'node-ab0002', 'node-ab0003'] })] }, 'server', 't');
	const snapshot = shape(m);

	commit(m, log, { ops: [put('group', { id: 'group-ac0002', name: 'B', members: ['node-ab0002', 'node-ab0003', 'node-ab0004'] })] }, 'server', 't');
	const membership = m.all('group').flatMap((g) => g.members);
	assert.equal(new Set(membership).size, membership.length, 'no node belongs to two groups');

	undo(m, log);
	assert.equal(shape(m), snapshot, 'the steal inverts exactly');
});

// ---- caps ----

test('commit: the request cap rejects, and rejects before any write', () => {
	const { m, log } = fresh();
	const ops = Array.from({ length: MAX_OPS + 1 }, (_, i) => put('node', node(`node-${String(i).padStart(6, '0')}`)));
	const r = commit(m, log, { ops }, 'server', 't');
	assert.equal(r.ok, false);
	assert.match(r.error, /1\.\.2000 ops/);
	assert.equal(m.all('node').length, 0);
});

test('commit: an empty op list is rejected', () => {
	const { m, log } = fresh();
	assert.equal(commit(m, log, { ops: [] }, 'server', 't').ok, false);
});

// ---- undo / redo ----

test('undo/redo: version advances on both; undo appends no record', () => {
	const { m, log } = seeded();
	const records = log.records.length;
	const v = log.version;
	const u = undo(m, log);
	assert.equal(u.version, v + 1, 'undo bumps the version');
	assert.equal(log.records.length, records, 'and appends nothing');
	const r = redo(m, log);
	assert.equal(r.version, v + 2, 'redo bumps it again');
	assert.equal(log.records.length, records);
});

test('undo: a new change truncates the redo tail', () => {
	const { m, log } = seeded();
	undo(m, log);
	assert.equal(log.canRedo(), true);
	commit(m, log, { ops: [put('node', node('node-ad0001', 300))] }, 'server', 't');
	assert.equal(log.canRedo(), false, 'the tail is gone');
});

test('undo {to}: reverses a run of changes as ONE transaction', () => {
	const { m, log } = fresh();
	const snapshot = shape(m);
	for (const [id, x] of [['node-ae0001', -120], ['node-ae0002', 0], ['node-ae0003', 120]]) {
		commit(m, log, { ops: [put('node', node(id, x))] }, 'server', 't');
	}
	const v = log.version;
	const u = undo(m, log, 1);                       // back to before seq 1
	assert.equal(u.version, v + 1, 'one version bump for the whole run');
	assert.equal(shape(m), snapshot);
});

test('undo: nothing to undo is a clean refusal, not a throw', () => {
	const { m, log } = fresh();
	assert.equal(undo(m, log).ok, false);
	assert.equal(redo(m, log).ok, false);
});

// ---- expect / actor ----

test('commit: expect is a precondition — a stale one rejects and writes nothing', () => {
	const { m, log } = seeded();
	const n = m.all('node').length;
	const r = commit(m, log, { expect: log.version - 1, ops: [put('node', node('node-af0001', 300))] }, 'server', 't');
	assert.equal(r.ok, false);
	assert.equal(r.error, 'version conflict');
	assert.equal(m.all('node').length, n);
	assert.equal(commit(m, log, { expect: log.version, ops: [put('node', node('node-af0001', 300))] }, 'server', 't').ok, true);
});

test('commit: every change carries by + actor', () => {
	const { m, log } = fresh();
	const r = commit(m, log, { ops: [put('node', node('node-ba0001'))] }, 'server', 'agent-7');
	assert.equal(r.change.by, 'server');
	assert.equal(r.change.actor, 'agent-7');
	assert.equal(r.change.seq, r.version, 'seq is the version after the change');
});

/*
B81 -- one straight link per pair, enforced on what a transaction PRODUCES.

H10.9 put the rule at the two authoring sites in the client. `set` is a first-class op, so a
commit over either transport could clear a link's `via` and reach the forbidden state without
passing either guard. A rule enforced at call sites is a convention; this makes it a property of
the model, checked once in the planner.

The cascade ruling is (b): where deleting a waypoint would leave a link colliding, the link is
deleted with it. That matches the branch beside it, where a waypoint that is a link's ENDPOINT
already deletes the link rather than stripping it to a degenerate form.
*/
function pairWithBoth() {
	const { m, log } = seeded();                                    // node-aa0001 -- node-aa0002, straight
	commit(m, log, { ops: [
		put('waypoint', { id: 'waypoint-bb0001', x: 0, y: -60 }),
		put('link', { id: 'link-bb0002', src: 'node-aa0001', dst: 'node-aa0002', via: ['waypoint-bb0001'] }),
	] }, 'server', 't');
	return { m, log };
}

test('B81: deleting the only bend of a routed link deletes the link when a straight one exists', () => {
	const { m, log } = pairWithBoth();
	assert.equal(m.all('link').length, 2, 'a straight link and a routed one');

	const r = commit(m, log, { ops: [{ op: 'del', kind: 'waypoint', id: 'waypoint-bb0001' }] }, 'server', 't');
	assert.equal(r.ok, true, 'the waypoint deletion is NOT refused — that was the rejected alternative');
	assert.equal(m.get('waypoint', 'waypoint-bb0001'), undefined, 'the waypoint is gone');
	assert.equal(m.get('link', 'link-bb0002'), undefined,
		'and so is the link that would have been left as a straight duplicate');
	assert.ok(m.get('link', 'link-aa0003'), 'the ORIGINAL straight link survives — it outranks the route');
});

test('B81: with no straight link on the pair, the same deletion merely strips the bend', () => {
	const { m, log } = pairWithBoth();
	commit(m, log, { ops: [{ op: 'del', kind: 'link', id: 'link-aa0003' }] }, 'server', 't');

	commit(m, log, { ops: [{ op: 'del', kind: 'waypoint', id: 'waypoint-bb0001' }] }, 'server', 't');
	const survivor = m.get('link', 'link-bb0002');
	assert.ok(survivor, 'the link survives, because nothing collides with it');
	assert.deepEqual(survivor.via, [], 'stripped to straight, which is the unchanged behaviour');
});

test('B81: the deletion is ONE undoable step, and undo restores both', () => {
	const { m, log } = pairWithBoth();
	// content only: undo advances the version by design, so comparing whole documents would
	// compare the counter and not the restoration
	const content = () => { const d = m.toJSON(); delete d.meta; return JSON.stringify(d); };
	const before = content();
	const r = commit(m, log, { ops: [{ op: 'del', kind: 'waypoint', id: 'waypoint-bb0001' }] }, 'server', 't');
	assert.equal(m.all('link').length, 1, 'the link went with the waypoint');

	const back = undo(m, log, null);
	assert.equal(back.ok, true);
	assert.equal(content(), before,
		'ONE step back restores the waypoint AND the link deleted alongside it');
	assert.ok(r.version > 0, 'and it was a single version bump forward');
});

test('B81: a bare `set` clearing via is refused — the path no call-site guard covers', () => {
	const { m, log } = pairWithBoth();
	const r = commit(m, log, { ops: [
		{ op: 'set', kind: 'link', id: 'link-bb0002', patch: { via: [] } },
	] }, 'server', 't');
	assert.equal(r.ok, false, 'the invariant refuses it');
	assert.match(r.error, /straight links between/, 'and names what is wrong');
	assert.deepEqual(m.get('link', 'link-bb0002').via, ['waypoint-bb0001'], 'nothing was written');
});

test('B81: an already-broken document can still be repaired, not bricked', () => {
	// reached by loading, not by committing -- the state predates the rule, exactly as the GR5
	// corpus does. Refusing every write to it would make the repair itself impossible.
	const { m, log } = seeded();
	const doc = m.toJSON();
	doc.links.push({ id: 'link-cc0001', src: 'node-aa0001', dst: 'node-aa0002', name: 'dupe' });
	m.load(doc);
	assert.equal(m.all('link').length, 2, 'two straight links on one pair, loaded not committed');

	const move = commit(m, log, { ops: [
		{ op: 'set', kind: 'node', id: 'node-aa0001', patch: { x: -180 } },
	] }, 'server', 't');
	assert.equal(move.ok, true, 'an unrelated write is NOT refused for a pre-existing violation');

	const fix = commit(m, log, { ops: [{ op: 'del', kind: 'link', id: 'link-cc0001' }] }, 'server', 't');
	assert.equal(fix.ok, true, 'and the repair goes through');
	assert.equal(m.all('link').length, 1);
});

/*
B82/B85 -- group rules become properties of the document rather than repairs on one op kind.

`planPut` steals overlapping members, which is a remedy. `planSet` had no group handling at all,
so a `set` patching `members` walked past the remedy and produced a document the two peers read
differently: the client's index declares membership single-valued and answers last-write-wins,
the server has no index and answers first-in-order, and `groupOf` drives both selection expansion
and the renderer hull.

The threshold for "too few to be a group" is NOT restated in the invariant. `engine/policy.mjs`
owns it, `model/` and `engine/` are sovereign peers, so the rule is injected by the composition
point that already depends on both -- the same shape as `cellOf` into `attachRelations`.
*/
function twoGroups() {
	const { m, log } = fresh();
	commit(m, log, { ops: [
		...[0, 1, 2, 3].map((i) => put('node', node(`node-cc000${i}`, i * 60))),
		put('group', { id: 'group-dd0001', name: 'g1', members: ['node-cc0000', 'node-cc0001'] }),
		put('group', { id: 'group-dd0002', name: 'g2', members: ['node-cc0002', 'node-cc0003'] }),
	] }, 'server', 't');
	return { m, log };
}

test('B82: a `set` cannot put a node in two groups — the path planPut never covered', () => {
	const { m, log } = twoGroups();
	const r = commit(m, log, { ops: [
		{ op: 'set', kind: 'group', id: 'group-dd0002', patch: { members: ['node-cc0002', 'node-cc0003', 'node-cc0000'] } },
	] }, 'server', 't');
	assert.equal(r.ok, false, 'refused');
	assert.match(r.error, /member of both group-dd0001 and group-dd0002/, 'and names both groups');
	assert.deepEqual(m.get('group', 'group-dd0002').members, ['node-cc0002', 'node-cc0003'],
		'nothing was written');
});

test('B82: `put` still STEALS rather than refusing — the remedy is unchanged', () => {
	const { m, log } = twoGroups();
	const r = commit(m, log, { ops: [
		put('group', { id: 'group-dd0003', name: 'g3', members: ['node-cc0000', 'node-cc0002'] }),
	] }, 'server', 't');
	assert.equal(r.ok, true, 'a put is a remedy, not a violation — it takes the members');
	assert.equal(m.get('group', 'group-dd0001'), undefined, 'and dissolves what it emptied below two');
	assert.deepEqual(m.get('group', 'group-dd0003').members, ['node-cc0000', 'node-cc0002']);
});

test('B85: a group must hold at least two distinct members', () => {
	const { m, log } = twoGroups();
	const one = commit(m, log, { ops: [
		put('group', { id: 'group-dd0004', name: 'g4', members: ['node-cc0000'] }),
	] }, 'server', 't');
	assert.equal(one.ok, false, 'a one-member group is refused server-side, not only in the browser');
	assert.match(one.error, /too few to be a group/);

	const dup = commit(m, log, { ops: [
		put('group', { id: 'group-dd0005', name: 'g5', members: ['node-cc0000', 'node-cc0000'] }),
	] }, 'server', 't');
	assert.equal(dup.ok, false, 'and so is one that lists the same member twice');
	assert.match(dup.error, /lists the same member twice/);
});

test('B85: the threshold comes from policy, not from a number the invariant invented', async () => {
	const { violations } = await import('../model/invariants.mjs');
	const { m, log } = twoGroups();
	// a node in NO group, so the only thing wrong with the document is the size of this group.
	// My first version used a node that was already grouped, which tripped the exclusivity check
	// and made the assertion below pass for the wrong reason.
	commit(m, log, { ops: [put('node', node('node-cc0009', 420))] }, 'server', 't');
	const doc = m.toJSON();
	doc.groups.push({ id: 'group-dd0006', name: 'g6', members: ['node-cc0009'] });
	m.load(doc);

	assert.deepEqual(violations(m), [],
		'with no policy supplied the group checks are SKIPPED — never a threshold this file guessed');
	const never = () => false;
	assert.ok(violations(m, { groupAfterRemoval: (mem) => ({ remaining: mem, dissolve: mem.length < 2 }) })
		.some((v) => /too few/.test(v)), 'with the real shape of the rule it fires');
	assert.deepEqual(violations(m, { groupAfterRemoval: (mem) => ({ remaining: mem, dissolve: false }) })
		.filter((v) => /too few/.test(v)), [],
		'and a policy that dissolves nothing reports nothing — the invariant defers to it entirely');
	assert.equal(typeof never, 'function');
});

/*
B162 -- a waypoint that has lost every link self-destructs, in the same transaction.

The cascade already ran the other way: deleting a waypoint deletes a link that cannot survive it,
because "a link that cannot survive the operation does not limp on in a degenerate form". This is
the mirror, and it was missing -- removing one 65-point closed shape left 64 waypoints on the
canvas, each still rendering and each still holding its anchor.

THE ROLE IS DERIVED, never stored: in `via` a bend, at src/dst of an open link an endpoint, at
src/dst of a CLOSED link a bend again because a ring has no ends. Only `pinned` is written down,
because a waypoint placed deliberately with no link has no structure to read an intention off.
*/
test('B162: deleting a link takes its bends, and one undo puts them back', () => {
	const m = new Model();
	m.put('node', { id: 'node-aa0001', type: 'host', x: 0, y: 0, name: 'a' });
	m.put('node', { id: 'node-aa0002', type: 'host', x: 180, y: 0, name: 'b' });
	m.put('waypoint', { id: 'waypoint-aa0001', x: 60, y: 60 });
	m.put('waypoint', { id: 'waypoint-aa0002', x: 120, y: 60 });
	m.put('link', { id: 'link-aa0001', src: 'node-aa0001', dst: 'node-aa0002', via: ['waypoint-aa0001', 'waypoint-aa0002'] });

	const r = plan(m, [{ op: 'del', kind: 'link', id: 'link-aa0001' }]);
	assert.equal(r.ok, true);
	const gone = r.ops.filter((o) => o.kind === 'waypoint' && o.op === 'del').map((o) => o.id).sort();
	assert.deepEqual(gone, ['waypoint-aa0001', 'waypoint-aa0002'], 'both bends go with the link');
	// ONE undoable step: the inverse restores the waypoints as well as the link
	const back = r.inverse.filter((o) => o.kind === 'waypoint' && o.op === 'put').map((o) => o.entity.id).sort();
	assert.deepEqual(back, ['waypoint-aa0001', 'waypoint-aa0002'], 'and the undo brings them back');
});

test('B162: an ENDPOINT waypoint goes too -- nothing else may claim it', () => {
	const m = new Model();
	m.put('node', { id: 'node-aa0001', type: 'host', x: 0, y: 0, name: 'a' });
	m.put('waypoint', { id: 'waypoint-aa0003', x: 120, y: 0 });
	m.put('link', { id: 'link-aa0002', src: 'node-aa0001', dst: 'waypoint-aa0003' });
	// XOR occupancy means no other link may be using it, so an unattached endpoint is as dead as a
	// bend. The distinction matters for RENDERING, not for survival.
	const r = plan(m, [{ op: 'del', kind: 'link', id: 'link-aa0002' }]);
	assert.ok(r.ops.some((o) => o.kind === 'waypoint' && o.id === 'waypoint-aa0003'), 'the endpoint is swept');
});

/*
`pinned` is a BACKSTOP, and mutation is what established that -- the first version of this test
passed with the pin ignored entirely.

A waypoint placed deliberately outside any gesture was never referenced by a link, so the
transaction-scope rule already protects it: the sweep only removes what THIS transaction orphaned.
The pin is never consulted on that path.

Where it does the work is the state that should not arise: a pinned waypoint that somehow carries a
link. Threading is meant to clear the pin, and if that ever fails to happen the author's intent
still outranks the sweep. Asserting the reachable case is the difference between testing the flag
and testing the guard that happens to sit in front of it.
*/
test('B162: a lone waypoint is safe by SCOPE, not by the pin', () => {
	const m = new Model();
	m.put('waypoint', { id: 'waypoint-bb0001', x: 60, y: 60, pinned: true });
	m.put('node', { id: 'node-aa0001', type: 'host', x: 0, y: 0, name: 'a' });
	const r = plan(m, [{ op: 'put', kind: 'node', entity: { id: 'node-aa0002', type: 'host', x: 180, y: 0, name: 'b' } }]);
	assert.equal(r.ops.some((o) => o.kind === 'waypoint' && o.op === 'del'), false, 'a lone waypoint stays');

	// and it is the SCOPE rule doing it: an unpinned lone waypoint is equally safe
	const m2 = new Model();
	m2.put('waypoint', { id: 'waypoint-bb0002', x: 60, y: 60 });
	m2.put('node', { id: 'node-aa0001', type: 'host', x: 0, y: 0, name: 'a' });
	const r2 = plan(m2, [{ op: 'put', kind: 'node', entity: { id: 'node-aa0004', type: 'host', x: 180, y: 0, name: 'd' } }]);
	assert.equal(r2.ops.some((o) => o.kind === 'waypoint' && o.op === 'del'), false, 'pinned or not');
});

test('B162: the pin outranks the sweep when a linked waypoint loses its link', () => {
	const m = new Model();
	m.put('node', { id: 'node-aa0001', type: 'host', x: 0, y: 0, name: 'a' });
	m.put('waypoint', { id: 'waypoint-bb0003', x: 120, y: 0, pinned: true });
	m.put('link', { id: 'link-bb0001', src: 'node-aa0001', dst: 'waypoint-bb0003' });
	const r = plan(m, [{ op: 'del', kind: 'link', id: 'link-bb0001' }]);
	assert.equal(r.ops.some((o) => o.kind === 'waypoint' && o.id === 'waypoint-bb0003'), false,
		'the author said keep it, so the sweep leaves it');

	// the same shape without the pin IS swept, or the assertion above proves nothing
	const m2 = new Model();
	m2.put('node', { id: 'node-aa0001', type: 'host', x: 0, y: 0, name: 'a' });
	m2.put('waypoint', { id: 'waypoint-bb0004', x: 120, y: 0 });
	m2.put('link', { id: 'link-bb0002', src: 'node-aa0001', dst: 'waypoint-bb0004' });
	const r2 = plan(m2, [{ op: 'del', kind: 'link', id: 'link-bb0002' }]);
	assert.ok(r2.ops.some((o) => o.kind === 'waypoint' && o.id === 'waypoint-bb0004'), 'unpinned goes');
});

/*
ONLY WHAT THIS TRANSACTION ORPHANED, which is the rule the B81 invariant check already uses.

Sweeping every unreferenced waypoint would make an unrelated commit quietly delete debris its caller
never mentioned, and would put those deletions in its inverse -- so undoing "move a node" would
resurrect someone else's litter. The GR5 differential found this: the corpus contains documents with
pre-existing orphans, and every unrelated mutation diverged from the frozen oracle.
*/
test('B162: pre-existing debris is left alone -- a commit removes only what it orphaned', () => {
	const m = new Model();
	m.put('waypoint', { id: 'waypoint-cc0001', x: 60, y: 60 });          // already unreferenced
	m.put('node', { id: 'node-aa0001', type: 'host', x: 0, y: 0, name: 'a' });
	const r = plan(m, [{ op: 'set', kind: 'node', id: 'node-aa0001', patch: { x: 180 } }]);
	assert.equal(r.ops.some((o) => o.kind === 'waypoint' && o.op === 'del'), false,
		'moving a node does not sweep litter it did not create');
	assert.equal(r.inverse.some((o) => o.kind === 'waypoint'), false,
		'and its undo does not resurrect any');
});
