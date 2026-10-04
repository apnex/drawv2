// txn — the one write. These are the properties the old single-op planner could not express:
// a transaction spanning N ops, an inverse derived at plan time, a cascade that is ONE change,
// and a no-op that is accepted without becoming one.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from './fixtures/composed.mjs';   // the composition production runs (S-b)
import { plan, commit, undo, redo } from './fixtures/composed.mjs';
import { MAX_OPS } from '../planner/txn.mjs';
import { Log } from '../planner/log.mjs';
import { validateDoc } from './fixtures/composed.mjs';   // the network's kinds, as the store validates (S-e)

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
		put('link', { id: 'link-aa0003', name: 'link-aa0003', src: 'node-aa0001', dst: 'node-aa0002' }),
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
		put('link', { id: 'link-bb0003', name: 'link-bb0003', src: 'node-bb0001', dst: 'node-bb0002' }),
	] }, 'server', 't');
	assert.equal(r.version, 1, 'one transaction, one version');
	// three puts, each followed by the drawing order the planner gives a creation without one (F-d)
	assert.equal(r.change.ops.filter((o) => o.op === 'put').length, 3);
	assert.equal(r.change.ops.length, 6);
});

test('plan: op k is validated against the state left by op k-1', () => {
	const { m, log } = fresh();
	// the link would be invalid against the empty model; it is valid after the two puts
	const r = commit(m, log, { ops: [
		put('node', node('node-cc0001', -60)),
		put('node', node('node-cc0002', 60)),
		put('link', { id: 'link-cc0003', name: 'link-cc0003', src: 'node-cc0001', dst: 'node-cc0002' }),
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
		put('node', { id: 'node-eb0001', name: 'node-eb0001', x: 0, y: -60 }),
		put('link', { id: 'link-bb0002', name: 'link-bb0002', src: 'node-aa0001', dst: 'node-aa0002', via: ['node-eb0001'] }),
	] }, 'server', 't');
	return { m, log };
}

test('B81: deleting the only bend of a routed link deletes the link when a straight one exists', () => {
	const { m, log } = pairWithBoth();
	assert.equal(m.all('link').length, 2, 'a straight link and a routed one');

	const r = commit(m, log, { ops: [{ op: 'del', kind: 'node', id: 'node-eb0001' }] }, 'server', 't');
	assert.equal(r.ok, true, 'the waypoint deletion is NOT refused — that was the rejected alternative');
	assert.equal(m.get('node', 'node-eb0001'), undefined, 'the waypoint is gone');
	assert.equal(m.get('link', 'link-bb0002'), undefined,
		'and so is the link that would have been left as a straight duplicate');
	assert.ok(m.get('link', 'link-aa0003'), 'the ORIGINAL straight link survives — it outranks the route');
});

/*
AMENDED 2026-10-03 (S-b, H18.12): with no straight link on the pair, the classic tenant stripped the bend and kept the link.
Production runs the network's tenant now, and a pinned link lives and dies with its pins (ruled 2026-09-30; P-7 for the
estate): deleting its only bend deletes it whole, collision or none.
*/
test('B81, P-7: with no straight link on the pair, deleting the bend deletes the pinned link too -- it lives and dies with its pins', () => {
	const { m, log } = pairWithBoth();
	commit(m, log, { ops: [{ op: 'del', kind: 'link', id: 'link-aa0003' }] }, 'server', 't');

	commit(m, log, { ops: [{ op: 'del', kind: 'node', id: 'node-eb0001' }] }, 'server', 't');
	assert.equal(m.get('link', 'link-bb0002'), undefined, 'the pinned link goes with its pin (P-7)');
});

test('B81: the deletion is ONE undoable step, and undo restores both', () => {
	const { m, log } = pairWithBoth();
	// content only: undo advances the version by design, so comparing whole documents would
	// compare the counter and not the restoration
	// and each collection as a set: undo puts back content, and which order a collection lists it in is not content -- the
	// link's pipes, laid by link-legs since S-c, come back in the reverse of the order they went (drawn items carry `order`)
	const content = () => { const d = m.toJSON(); delete d.meta; for (const k of Object.keys(d)) if (Array.isArray(d[k])) d[k] = [...d[k]].sort((a, b) => String(a.id ?? a).localeCompare(String(b.id ?? b))); return JSON.stringify(d); };
	const before = content();
	const r = commit(m, log, { ops: [{ op: 'del', kind: 'node', id: 'node-eb0001' }] }, 'server', 't');
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
	assert.deepEqual(m.get('link', 'link-bb0002').via, ['node-eb0001'], 'nothing was written');
});

test('B81: an already-broken document can still be repaired, not bricked', () => {
	// reached by loading, not by committing -- the state predates the rule, exactly as the GR5
	// corpus does. Refusing every write to it would make the repair itself impossible.
	const { m, log } = seeded();
	const doc = m.toJSON();
	doc.links.push({ id: 'link-cc0001', name: 'link-cc0001', src: 'node-aa0001', dst: 'node-aa0002', name: 'dupe' });
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

The threshold for "too few to be a group" is NOT restated in the invariant. `planner/policy.mjs`
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
	m.put('node', { id: 'node-ea0001', name: 'node-ea0001', x: 60, y: 60 });
	m.put('node', { id: 'node-ea0002', name: 'node-ea0002', x: 120, y: 60 });
	m.put('link', { id: 'link-aa0001', name: 'link-aa0001', src: 'node-aa0001', dst: 'node-aa0002', via: ['node-ea0001', 'node-ea0002'] });

	const r = plan(m, [{ op: 'del', kind: 'link', id: 'link-aa0001' }]);
	assert.equal(r.ok, true);
	const gone = r.ops.filter((o) => o.kind === 'node' && o.op === 'del').map((o) => o.id).sort();
	assert.deepEqual(gone, ['node-ea0001', 'node-ea0002'], 'both bends go with the link');
	// ONE undoable step: the inverse restores the waypoints as well as the link
	const back = r.inverse.filter((o) => o.kind === 'node' && o.op === 'put').map((o) => o.entity.id).sort();
	assert.deepEqual(back, ['node-ea0001', 'node-ea0002'], 'and the undo brings them back');
});

/*
B216 -- an ENDPOINT waypoint SURVIVES losing its link, and falls back to a plain anchor.

This test asserted the opposite, on the reasoning that XOR occupancy meant no other link could
claim it so an unattached endpoint was "as dead as a bend". XOR occupancy is gone -- a waypoint may
now carry several links -- and the director ruled the distinction the other way: deleting a link
must no more remove the waypoint it terminated at than it removes the node at the other end.

The sweep's own reasoning was only ever about bends: a bend exists to shape a path, so with no path
it is debris that still renders and still holds its anchor. An endpoint is a place the author put
something.

What it becomes is a plain anchor. `waypointRoles` returns the empty set for a waypoint with no
links, so it draws as anchor plus dot with no sub-type layer -- which needed no change, because the
roles were already derived from the links rather than remembered.
*/
/*
AMENDED 2026-10-03 (S-b, H18.12): B216 kept an endpoint waypoint when its link went. Production runs the network's tenant now,
under which "deliberate" means held by the pipes laid with g, and a waypoint made with w goes with its last link, ends
included (ruled 2026-09-29, "No - it goes just as ruled"; PU40). A bend goes too, as it always did.
*/
test('B216 retired (2026-09-29): an endpoint waypoint goes with its last link, as a bend does; a node stays', async () => {
	const m = new Model();
	m.put('node', { id: 'node-aa0001', type: 'host', x: 0, y: 0, name: 'a' });
	m.put('node', { id: 'node-ea0003', name: 'node-ea0003', x: 120, y: 0 });
	m.put('link', { id: 'link-aa0002', name: 'link-aa0002', src: 'node-aa0001', dst: 'node-ea0003' });

	const r = plan(m, [{ op: 'del', kind: 'link', id: 'link-aa0002' }]);
	assert.ok(r.ops.some((o) => o.kind === 'node' && o.id === 'node-ea0003' && o.op === 'del'), 'the waypoint a link ended at goes with it');
	assert.equal(r.ops.some((o) => o.kind === 'node' && o.id === 'node-aa0001' && o.op === 'del'), false, 'the node stays: only a waypoint is swept');

	const m2 = new Model();
	m2.put('node', { id: 'node-aa0001', type: 'host', x: 0, y: 0, name: 'a' });
	m2.put('node', { id: 'node-aa0002', type: 'host', x: 240, y: 0, name: 'b' });
	m2.put('node', { id: 'node-ea0003', name: 'node-ea0003', x: 120, y: 0 });
	m2.put('link', { id: 'link-aa0002', name: 'link-aa0002', src: 'node-aa0001', dst: 'node-aa0002', via: ['node-ea0003'] });
	const r2 = plan(m2, [{ op: 'del', kind: 'link', id: 'link-aa0002' }]);
	assert.ok(r2.ops.some((o) => o.kind === 'node' && o.id === 'node-ea0003' && o.op === 'del'), 'a bend goes with its link');
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
	m.put('node', { id: 'node-eb0001', name: 'node-eb0001', x: 60, y: 60, pinned: true });
	m.put('node', { id: 'node-aa0001', type: 'host', x: 0, y: 0, name: 'a' });
	const r = plan(m, [{ op: 'put', kind: 'node', entity: { id: 'node-aa0002', type: 'host', x: 180, y: 0, name: 'b' } }]);
	assert.equal(r.ops.some((o) => o.kind === 'node' && o.op === 'del'), false, 'a lone waypoint stays');

	// and it is the SCOPE rule doing it: an unpinned lone waypoint is equally safe
	const m2 = new Model();
	m2.put('node', { id: 'node-eb0002', name: 'node-eb0002', x: 60, y: 60 });
	m2.put('node', { id: 'node-aa0001', type: 'host', x: 0, y: 0, name: 'a' });
	const r2 = plan(m2, [{ op: 'put', kind: 'node', entity: { id: 'node-aa0004', type: 'host', x: 180, y: 0, name: 'd' } }]);
	assert.equal(r2.ops.some((o) => o.kind === 'node' && o.op === 'del'), false, 'pinned or not');
});

/*
AMENDED 2026-10-03 (S-b, H18.12): the classic tenant let `pinned` outrank the sweep. Production runs the network's tenant, which
keeps no orphan beyond what its pipes hold (ruled 2026-09-29), and `pinned` is retired (P-5 corrected; dropped from stored
documents at S-d): a pinned bend goes with its link like any other.
*/
test('B162 retired (P-5): a pinned bend goes with its link -- the pin no longer outranks the sweep', () => {
	const m = new Model();
	m.put('node', { id: 'node-aa0001', type: 'host', x: 0, y: 0, name: 'a' });
	m.put('node', { id: 'node-aa0002', type: 'host', x: 240, y: 0, name: 'b' });
	m.put('node', { id: 'node-eb0003', name: 'node-eb0003', x: 120, y: 0, pinned: true });
	m.put('link', { id: 'link-bb0001', name: 'link-bb0001', src: 'node-aa0001', dst: 'node-aa0002', via: ['node-eb0003'] });
	const r = plan(m, [{ op: 'del', kind: 'link', id: 'link-bb0001' }]);
	assert.ok(r.ops.some((o) => o.kind === 'node' && o.id === 'node-eb0003' && o.op === 'del'));
});

/*
B217: the collapse reacts to LOSING a link, never to gaining one.

B215's scope was "any waypoint at the end of any link this transaction touched", and creating a
link touches one. So drawing two links that met at a waypoint collapsed them into a bend the moment
the second was made -- a two-link terminus could not be built at all, and deleting all the links
from an endpoint appeared to delete the endpoint, because there had never been two links to lose.

The whole suite passed throughout. It was found by the director trying to do it, and by a repro
whose own SEED silently collapsed before the test began -- which is why the first assertion here is
on the setup rather than on the behaviour.
*/
test('B217: two links meeting at a waypoint survive being drawn', () => {
	const { m, log } = fresh();
	commit(m, log, { ops: [
		put('node', node('node-aa0001', -120)), put('node', node('node-aa0002', 120)),
		put('node', { id: 'node-ea0001', name: 'w', x: 0, y: 0 }),
		put('link', { id: 'link-aa0001', name: 'l1', src: 'node-aa0001', dst: 'node-ea0001' }),
		put('link', { id: 'link-aa0002', name: 'l2', src: 'node-ea0001', dst: 'node-aa0002' }),
	] }, 'server', 't');

	assert.equal(m.all('link').length, 2,
		'creating two links at one waypoint must NOT collapse them -- a collapse reacts to a shape being left behind');

	// removing one leaves the terminus; removing the last takes it (AMENDED 2026-10-03, S-b: ruled 2026-09-29, PU40)
	commit(m, log, { ops: [{ op: 'del', kind: 'link', id: 'link-aa0001' }] }, 'server', 't');
	assert.equal(m.all('node').filter((n) => !n.type).length, 1, 'the terminus survives losing one link');
	commit(m, log, { ops: [{ op: 'del', kind: 'link', id: 'link-aa0002' }] }, 'server', 't');
	assert.equal(m.all('link').length, 0);
	assert.equal(m.all('node').filter((n) => !n.type).length, 0, 'and goes with its last one, ends included (ruled 2026-09-29)');
});

test('B217: a collapse still fires when a junction LOSES a link', () => {
	const { m, log } = fresh();
	commit(m, log, { ops: [
		put('node', node('node-aa0001', -120)), put('node', node('node-aa0002', 120)), put('node', node('node-aa0003', 240)),
		put('node', { id: 'node-ea0001', name: 'w', x: 0, y: 0 }),
		put('link', { id: 'link-aa0001', name: 'l1', src: 'node-aa0001', dst: 'node-ea0001' }),
		put('link', { id: 'link-aa0002', name: 'l2', src: 'node-ea0001', dst: 'node-aa0002' }),
		put('link', { id: 'link-aa0003', name: 'l3', src: 'node-aa0003', dst: 'node-ea0001' }),
	] }, 'server', 't');
	assert.equal(m.all('link').length, 3, 'precondition: a three-way junction, built without collapsing');

	commit(m, log, { ops: [{ op: 'del', kind: 'link', id: 'link-aa0003' }] }, 'server', 't');
	const links = m.all('link');
	assert.equal(links.length, 1, 'one in and one out is a bend, so they rejoin');
	assert.equal(links[0].id, 'link-aa0001', 'and the inbound id survives');
	assert.deepEqual(links[0].via, ['node-ea0001']);
});

/*
B222: an UNDECLARED link has no direction, so a collapse may read only the COUNT.

`src` and `dst` record which end the author happened to drag from. Nothing more. The planner read
that stored order as though it were meant -- `inbound` by `l.dst === w`, `outbound` by `l.src === w`
-- so a waypoint whose two survivors both stored `w` as their `src` found no inbound, returned null,
and silently declined to collapse.

The state it left was UNREACHABLE. No operation reverses a link's direction, so every further
gesture re-entered the same branch and declined again. A live diagram sat at three outward links
across twenty commits.

The director's experiment is the falsifier, and it is exact: hold topology, counts and waypoint
identical, vary ONLY the direction of the drag. One order collapsed and the other did not, which no
explanation but stored order survives.

Two links at a waypoint, both stored outward -- geometrically a bend, and it must rejoin as one.
*/
test('B222: two links stored in the SAME direction still collapse -- order is not direction', () => {
	const { m, log } = fresh();
	commit(m, log, { ops: [
		put('node', node('node-bb0001', -120)), put('node', node('node-bb0002', 120)), put('node', node('node-bb0003', 240)),
		put('node', { id: 'node-eb0001', name: 'w', x: 0, y: 0 }),
		// every link stores the WAYPOINT as its src -- the shape a junction is left in when the
		// link that happened to point inward is the one deleted
		put('link', { id: 'link-bb0001', name: 'l1', src: 'node-eb0001', dst: 'node-bb0001' }),
		put('link', { id: 'link-bb0002', name: 'l2', src: 'node-eb0001', dst: 'node-bb0002' }),
		put('link', { id: 'link-bb0003', name: 'l3', src: 'node-eb0001', dst: 'node-bb0003' }),
	] }, 'server', 't');
	assert.equal(m.all('link').length, 3, 'precondition: three links, every one stored outward');

	commit(m, log, { ops: [{ op: 'del', kind: 'link', id: 'link-bb0003' }] }, 'server', 't');
	const links = m.all('link');
	assert.equal(links.length, 1, 'two undeclared links at a waypoint are a bend whatever their stored order');
	assert.equal(links[0].via.length, 1, 'and the waypoint survives as the bend between them');
	assert.deepEqual(links[0].via, ['node-eb0001']);
	const ends = [links[0].src, links[0].dst].sort();
	assert.deepEqual(ends, ['node-bb0001', 'node-bb0002'], 'the merged link spans what the two survivors reached');
});

/*
B220: what the commit door accepts, the boot door must load.

A beat caption was written with a bare `String(request.caption)` and no length test, while
`validateDoc` checked the stored file against NAME_MAX -- 64, a limit meant for identifiers like
`spine-1`. So a 105-character narration was accepted, persisted, and served all session, then
REFUSED when the server next read the file. The diagram vanished from its owner's list with nothing
said, and the only trace was one skip line in a boot log. Three diagrams were in that state.

Two defects, and the second is the one that matters. A caption is prose and deserves its own limit
-- that part is a number. The doors DISAGREEING is the property: any value the write path admits
must survive a restart, whatever the limit happens to be.

Asserted as a round trip rather than against 256, so changing the limit cannot reintroduce the
divergence. If a future edit loosens one door, the other fails here.
*/
test('B220: a caption the commit accepts survives a reload', async () => {
	const { validateDoc } = await import('./fixtures/composed.mjs');
	const { CAPTION_MAX } = await import('../model/limits.mjs');

	const withCaption = (caption) => {
		const { m, log } = fresh();
		commit(m, log, { ops: [put('node', node('node-aa0001', -120))] }, 'server', 't');
		const r = commit(m, log, { ops: [put('node', node('node-aa0002', 120))], pace: 350, caption }, 'server', 't');
		// `fresh()` mints no document id, and validateDoc checks meta before it reaches the reveal --
		// without this the round trip fails on the fixture rather than on the caption
		const doc = m.toJSON();
		doc.meta.id = 'diagram-aa0001';
		doc.meta.name = 'round-trip';
		return { ok: r.ok, error: r.error, doc };
	};

	/*
	THE ROUND TRIP. At the limit exactly: the commit must accept it AND the document must reload.
	This is the assertion the defect violated -- it passed the first half and failed the second.
	*/
	const atLimit = withCaption('x'.repeat(CAPTION_MAX));
	assert.equal(atLimit.ok, true, `a caption of exactly ${CAPTION_MAX} must commit`);
	assert.equal(validateDoc(atLimit.doc), null,
		'and the document it produced must LOAD -- a value one door accepts and the other refuses loses the diagram');

	// the real caption that exposed this, 105 characters of ordinary prose
	const real = withCaption('Optus Target State Architecture: Hybrid Multi-Tenant NCC Core with Centralized Security & On-Prem Transit');
	assert.equal(real.ok, true, 'a 105-character narration is not an unreasonable caption');
	assert.equal(validateDoc(real.doc), null, 'and it must reload');

	/*
	Past the limit it is REFUSED AT THE COMMIT, not truncated. A silently shortened caption is a
	narration the author did not write, and they find out by reading it back later.
	*/
	const over = withCaption('x'.repeat(CAPTION_MAX + 1));
	assert.equal(over.ok, false, 'past the limit the commit must refuse');
	assert.match(over.error, /caption is \d+ characters/, 'and say what was wrong with it');
});

/*
H15.3: a declared direction survives the commit, the reload, and a flip.

B220's lesson, applied before the defect rather than after: what the commit door accepts, the boot
door must load. A new optional field is exactly where those two drift, because the write path and
`validateDoc` are separate lists that nothing forces to agree.

The flip case is the one worth guarding. `collapseAtWaypoint` may reverse a link's storage to face
a pair through a point (B222), and a declaration is expressed RELATIVE to that storage -- so if the
flip did not invert `flow`, a collapse would silently reverse what the author declared.
*/
test('H15.3: a declared flow round-trips, and a collapse that flips preserves its meaning', async () => {
	const { m, log } = fresh();
	// the kernel twin -- the model's own `facing` is internal, and these two are held to agree in
	// tests/validate.test.js, so either spelling reads the same declaration
	const { linkFacing: facing } = await import('../network/roles.mjs');
	const { validateDoc } = await import('./fixtures/composed.mjs');
	// `fresh()` mints no document id, and validateDoc checks meta first -- without this the round
	// trip would fail on the fixture rather than on the field under test
	const loadable = () => { const d = m.toJSON(); d.meta.id = 'diagram-cc0001'; d.meta.name = 'flow'; return d; };

	commit(m, log, { ops: [
		put('node', node('node-cc0001', -120)), put('node', node('node-cc0002', 120)), put('node', node('node-cc0003', 240)),
		put('node', { id: 'node-ec0001', name: 'w', x: 0, y: 0 }),
		// all three stored OUTWARD from the waypoint, so a collapse must flip one of them. Three
		// DISTINCT far ends -- a repeated endpoint pair is refused as a duplicate, which would
		// leave the fixture with two links and collapse it before the test began (the B217 trap).
		// A PASS-THROUGH, declared. Both store the waypoint as `src`, so both need flipping -- but
		// cc0001 declares flow AGAINST its storage, meaning it arrives at the waypoint, while
		// cc0002 declares flow WITH its storage, meaning it leaves. One in, one out: a bend.
		// (Both declared the same way would be two flows leaving one point, which is a divergence
		// and stays a junction -- that case is the matrix's, H15.4.)
		put('link', { id: 'link-cc0001', name: 'l1', src: 'node-ec0001', dst: 'node-cc0001', direction: 'reverse' }),
		put('link', { id: 'link-cc0002', name: 'l2', src: 'node-ec0001', dst: 'node-cc0002', direction: 'forward' }),
		put('link', { id: 'link-cc0003', name: 'l3', src: 'node-ec0001', dst: 'node-cc0003' }),
	] }, 'server', 't');

	assert.equal(m.all('link').length, 3, 'precondition: three links, every one stored outward');
	// SNAPSHOT, not a live reference. `m.get` hands back the model's own object, so holding it
	// across the collapse compares a value to itself -- the aliasing form of a vacuous test, and
	// the same trap as B217 where a fixture was rewritten before the assertions ran.
	const before = { ...m.get('link', 'link-cc0001') };
	assert.equal(before.direction, 'reverse', 'the commit door accepted a declared flow');
	assert.equal(facing(before, 'node-ec0001'), 'in', 'and it means: arriving at the waypoint');
	assert.equal(facing(before, 'node-cc0001'), 'out', 'having left node-cc0001');

	// what the write accepted, the boot must load -- the B220 round trip
	assert.equal(validateDoc(loadable()), null, 'a document carrying `flow` must reload');

	// now force a collapse that has to flip one half
	commit(m, log, { ops: [{ op: 'del', kind: 'link', id: 'link-cc0003' }] }, 'server', 't');
	const merged = m.all('link').find((l) => (l.via || []).includes('node-ec0001'));
	assert.ok(merged, 'precondition: the two survivors collapsed to a bend');

	/*
	THE MEANING MUST SURVIVE THE STORAGE CHANGE. Whichever way the merged link is now stored, the
	flow still has to arrive where the author said it arrives.
	*/
	assert.equal(facing(merged, 'node-cc0001'), facing(before, 'node-cc0001'),
		'a flip must invert `flow` too, or the collapse silently reverses what the author declared');
	assert.equal(facing(merged, 'node-cc0002'), 'in', 'and the merged path still ends where the flow was going');
	assert.equal(validateDoc(loadable()), null, 'and the merged document still loads');
});


/*
H16 -- a write the author did not request must leave a document the store will load.

The collapse and the orphan sweep are DERIVED writes: the planner computes them, and they reached the
document checked only by `violations()`. The referential rules live outside it by design, so a derived
write could commit a document `validateDoc` refuses -- and the store skips a refused file at its next
boot, which loses the whole diagram rather than one link. Every test below asserts the property that
matters, `loadsAtBoot`, rather than a hypothesised cause of its absence.
*/
const wpAt = (id, x, y = 120) => ({ id, name: id, x, y });
const delOp = (kind, id) => ({ op: 'del', kind, id });
const linkPut = (id, src, dst, extra = {}) => put('link', { id, name: id, src, dst, ...extra });
// the document the store would write, checked the way the store checks it when it next boots
const loadsAtBoot = (mm) => {
	const d = mm.toJSON();
	d.meta = { ...d.meta, id: 'diagram-aa0000', name: 'd' };
	return validateDoc(d);
};

test('B239: a collapse whose merge would name a waypoint twice is not taken', () => {
	/*
	AMENDED 2026-10-04 (V-c, H18.27): the board is loaded rather than committed. Its link-aa0001 ends at w10, which
	link-aa0002 bends through, and since V-c a link MADE ending on a bend cuts the link there (junction-cut, B243) -- so
	committed in one edit the board would be cut before the delete under test. Such a board still exists wherever it was
	stored before the rule, and the collapse guard must hold on it.
	*/
	const { m, log } = fresh();
	for (const e of [node('node-aa0002', 300), node('node-aa0003', 600), wpAt('node-aa0010', 120), wpAt('node-aa0011', 240)]) m.put('node', e);
	for (const [id, src, dst, extra] of [['link-aa0001', 'node-aa0010', 'node-aa0011'], ['link-aa0002', 'node-aa0011', 'node-aa0002', { via: ['node-aa0010'] }],
		['link-aa0003', 'node-aa0003', 'node-aa0011']]) m.put('link', { id, name: id, src, dst, ...(extra ?? {}) });
	assert.equal(loadsAtBoot(m), null, 'precondition: the seed is a document the store loads');

	commit(m, log, { ops: [delOp('link', 'link-aa0003')] }, 'server', 't');
	assert.equal(m.get('link', 'link-aa0003'), undefined, 'the requested delete happened');
	assert.equal(loadsAtBoot(m), null,
		'merging these two would give x->y via [w, x], naming x twice -- the store would skip the whole diagram');
	assert.equal(m.all('link').length, 2, 'so the two links stay as a two-link terminus, which is legal (B217)');
});

test('B239: a collapse whose merge would duplicate a link bending through the same waypoint is not taken', () => {
	const { m, log } = fresh();
	commit(m, log, { ops: [
		put('node', node('node-aa0001', 0)), put('node', node('node-aa0002', 480)), put('node', node('node-aa0003', 600)),
		put('node', wpAt('node-aa0010', 120)), put('node', wpAt('node-aa0011', 240)),
		linkPut('link-aa0001', 'node-aa0001', 'node-aa0011', { via: ['node-aa0010'] }),
		linkPut('link-aa0002', 'node-aa0011', 'node-aa0002'),
		linkPut('link-aa0003', 'node-aa0003', 'node-aa0011'),
		linkPut('link-aa0004', 'node-aa0001', 'node-aa0002', { via: ['node-aa0010'] }),
	] }, 'server', 't');
	assert.equal(loadsAtBoot(m), null, 'precondition: the seed is a document the store loads');

	commit(m, log, { ops: [delOp('link', 'link-aa0003')] }, 'server', 't');
	assert.equal(m.get('link', 'link-aa0003'), undefined, 'the requested delete happened');
	assert.equal(loadsAtBoot(m), null,
		'the merge would bend a second node-1/node-2 link through the waypoint the first already bends through');
	assert.ok(m.get('link', 'link-aa0002'), 'the half that would have been absorbed is still there');
});

test('B239: the guard judges each merge against the document the EARLIER merge left', () => {
	// Two touched waypoints whose merges would EACH produce an n1->n2 link bending at the shared w13.
	// Either one alone is legal; the second is illegal only because the first has already happened.
	// A guard that reads the document as the transaction started -- or as it stood before the loop --
	// takes both, and the store refuses the result (H16 review: mutants M3 and M17 survived without this).
	const { m, log } = fresh();
	const seeded = commit(m, log, { ops: [
		put('node', node('node-aa0001', 0)), put('node', node('node-aa0002', 600)), put('node', node('node-aa0003', 300, { y: 240 })),
		put('node', wpAt('node-aa0011', 180)), put('node', wpAt('node-aa0012', 180, 240)),
		put('node', wpAt('node-aa0013', 420)),
		linkPut('link-aa0001', 'node-aa0001', 'node-aa0011'),
		linkPut('link-aa0002', 'node-aa0011', 'node-aa0002', { via: ['node-aa0013'] }),
		linkPut('link-aa0003', 'node-aa0001', 'node-aa0012'),
		linkPut('link-aa0004', 'node-aa0012', 'node-aa0002', { via: ['node-aa0013'] }),
		linkPut('link-aa0005', 'node-aa0003', 'node-aa0011'),
		linkPut('link-aa0006', 'node-aa0003', 'node-aa0012'),
	] }, 'server', 't');
	assert.ok(seeded.ok !== false, 'precondition: the seed commits');
	assert.equal(m.all('link').length, 6, 'precondition: all six links exist');
	assert.equal(loadsAtBoot(m), null, 'precondition: the seed is a document the store loads');

	commit(m, log, { ops: [delOp('link', 'link-aa0005'), delOp('link', 'link-aa0006')] }, 'server', 't');
	assert.equal(loadsAtBoot(m), null, 'the second merge would duplicate the first through w13 -- the store would skip the diagram');
	assert.equal(m.all('link').length, 3, 'exactly ONE of the two merges is taken; the other waypoint stays a two-link terminus');
});

test('B239: a merge that passes the referential rules is still taken', () => {
	// the foil: the guard must refuse only what the rules refuse, or it would quietly switch the
	// collapse off and every B215 test above would still pass on a document that never rejoins
	const { m, log } = fresh();
	commit(m, log, { ops: [
		put('node', node('node-aa0001', 0)), put('node', node('node-aa0002', 480)), put('node', node('node-aa0003', 600)),
		put('node', wpAt('node-aa0011', 240)),
		linkPut('link-aa0001', 'node-aa0001', 'node-aa0011'),
		linkPut('link-aa0002', 'node-aa0011', 'node-aa0002'),
		linkPut('link-aa0003', 'node-aa0003', 'node-aa0011'),
	] }, 'server', 't');
	commit(m, log, { ops: [delOp('link', 'link-aa0003')] }, 'server', 't');
	assert.equal(m.all('link').length, 1, 'a legal merge still rejoins the two links into one');
	assert.equal(loadsAtBoot(m), null);
});


/*
B240 -- collapses in ONE transaction compose against the document as each one leaves it.

Deleting the one link that made two neighbouring waypoints junctions leaves BOTH one-in one-out, so
both collapse. Each merge used to read its pair from the projection as it stood before ANY merge, and
all of them were applied at the end -- so the second merge rewrote a link the first had already
deleted, the set landed on nothing, and the far node was left with no link. The transaction reported
success and the document validated: the loss was visible only as a node nobody connected.
*/
function twoJunctions(extra = {}) {
	const { m, log } = fresh();
	commit(m, log, { ops: [
		put('node', node('node-aa0001', 0)), put('node', node('node-aa0002', 600)),
		put('node', wpAt('node-aa0011', 180)), put('node', wpAt('node-aa0012', 360)),
		put('node', wpAt('node-aa0013', 300, 240)),
		linkPut('link-aa0001', 'node-aa0001', 'node-aa0011', extra.a || {}),
		linkPut('link-aa0002', 'node-aa0011', 'node-aa0012'),
		linkPut('link-aa0003', extra.cSrc || 'node-aa0012', extra.cDst || 'node-aa0002', extra.c || {}),
		// the parallel route: deleting it is what leaves both waypoints one-in one-out. Its STORED
		// orientation decides which waypoint the planner visits first, so tests can flip it.
		extra.flipParallel
			? linkPut('link-aa0009', 'node-aa0012', 'node-aa0011', { via: ['node-aa0013'] })
			: linkPut('link-aa0009', 'node-aa0011', 'node-aa0012', { via: ['node-aa0013'] }),
	] }, 'server', 't');
	assert.equal(m.all('link').length, 4, 'precondition: the seed committed all four links');
	return { m, log };
}

test('B240: two collapses that share a link rejoin the chain end to end, and lose nothing', () => {
	const { m, log } = twoJunctions();
	assert.equal(loadsAtBoot(m), null, 'precondition: the seed is a document the store loads');
	const before = new Set(m.all('link').map((l) => JSON.stringify(l)));

	commit(m, log, { ops: [delOp('link', 'link-aa0009')] }, 'server', 't');
	const links = m.all('link');
	assert.equal(links.length, 1, 'both waypoints are left one-in one-out, so the chain rejoins into ONE link');
	assert.equal(links[0].src, 'node-aa0001');
	assert.equal(links[0].dst, 'node-aa0002', 'the far node is still connected -- no link was silently lost');
	assert.deepEqual(links[0].via, ['node-aa0011', 'node-aa0012']);
	assert.equal(loadsAtBoot(m), null);

	undo(m, log);
	// compared as a SET: undo restores content, and collection order is a separate matter (the map's D43)
	assert.deepEqual(new Set(m.all('link').map((l) => JSON.stringify(l))), before, 'one undo restores every link exactly');
});

test('B240: a declared convergence is judged against the link the earlier collapse produced', async () => {
	// node-1 -> w1 declared, w1 - w2 undeclared, node-2 -> w2 declared. Each waypoint alone is a bend,
	// so the planner merges whichever it visits FIRST -- and that merge turns the other into two
	// declared arrivals, a convergence the matrix calls a junction, which must not collapse. Read
	// stale, the second waypoint paired against the pre-merge undeclared link and merged the
	// convergence away. Which waypoint merges follows the deleted link's stored order, so the
	// property is asserted in BOTH orientations rather than naming the survivor (H16 review).
	const { linkFacing } = await import('../network/roles.mjs');
	for (const flipParallel of [false, true]) {
		const { m, log } = twoJunctions({ flipParallel, a: { direction: 'forward' }, cSrc: 'node-aa0002', cDst: 'node-aa0012', c: { direction: 'forward' } });
		assert.equal(loadsAtBoot(m), null, 'precondition: the seed is a document the store loads');

		commit(m, log, { ops: [delOp('link', 'link-aa0009')] }, 'server', 't');
		const links = m.all('link');
		assert.equal(links.length, 2, `exactly one waypoint merges (flipped: ${flipParallel})`);
		for (const n of ['node-aa0001', 'node-aa0002']) {
			assert.ok(links.some((l) => l.src === n || l.dst === n), `${n} keeps its link (flipped: ${flipParallel})`);
		}
		const ends = (l) => [l.src, l.dst].filter((e) => { const n = m.get('node', e); return n && !n.type; });   // the waypoints (F-c)
		const meet = ends(links[0]).filter((e) => ends(links[1]).includes(e));
		assert.equal(meet.length, 1, `the two survivors meet at one waypoint (flipped: ${flipParallel})`);
		for (const l of links) {
			assert.equal(linkFacing(l, meet[0]), 'in', `and both ARRIVE there -- a convergence, not a bend (flipped: ${flipParallel})`);
		}
		assert.equal(loadsAtBoot(m), null);
	}
});


/*
B241 -- the orphan sweep keeps group membership true, exactly as a requested delete does.

A waypoint can be a group member. Deleting one ON REQUEST trims it from its group, or dissolves a
group it leaves below two members. The sweep deletes a bend nobody named and never touched groups,
so the group went on listing a waypoint that no longer existed -- invisible to `violations()`, which
counts listed members, and refused by `validateDoc` when the store next booted.
*/
// CONTENT, not order: undo re-creates a deleted entity at the END of its collection, so a byte-for-byte
// compare fails whenever what was deleted was not last -- the reality map's D43, a separate defect this
// block does not claim to fix. Each collection is compared as a set; a group's member list keeps its order.
const contentOf = (mm) => {
	const d = mm.toJSON();
	delete d.meta.version;
	for (const k of Object.keys(d)) if (k !== 'selection' && Array.isArray(d[k])) d[k] = d[k].map((e) => JSON.stringify(e)).sort();
	return JSON.stringify(d);
};

function groupedBend(members) {
	const { m, log } = fresh();
	commit(m, log, { ops: [
		put('node', node('node-aa0001', 0)), put('node', node('node-aa0002', 600)),
		put('node', node('node-aa0003', 120, { y: 240 })), put('node', node('node-aa0004', 240, { y: 240 })),
		put('node', wpAt('node-aa0011', 300)),
		linkPut('link-aa0001', 'node-aa0001', 'node-aa0002', { via: ['node-aa0011'] }),
		put('group', { id: 'group-aa0001', name: 'g', members }),
	] }, 'server', 't');
	// without these, a refused seed would leave an empty document on which the dissolve and re-route
	// tests pass with the defect present -- their bend is "swept" because it never existed (H16 review)
	assert.ok(m.get('node', 'node-aa0011'), 'precondition: the grouped bend exists');
	assert.deepEqual(m.get('group', 'group-aa0001')?.members, members, 'precondition: the group holds it');
	return { m, log };
}

test('B241: sweeping a grouped bend dissolves a group it leaves below two members', () => {
	const { m, log } = groupedBend(['node-aa0011', 'node-aa0003']);
	assert.equal(loadsAtBoot(m), null, 'precondition: the seed is a document the store loads');
	const before = contentOf(m);

	commit(m, log, { ops: [delOp('link', 'link-aa0001')] }, 'server', 't');
	assert.equal(m.get('node', 'node-aa0011'), undefined, 'precondition: the bend was swept');
	assert.equal(m.get('group', 'group-aa0001'), undefined, 'a group left with one member dissolves, as it would on a requested delete');
	assert.equal(loadsAtBoot(m), null, 'the committed document is one the store will load');

	undo(m, log);
	assert.equal(contentOf(m), before, 'one undo restores the link, the bend and the group');
});

test('B241: sweeping a grouped bend trims it from a group that keeps two members', () => {
	const { m, log } = groupedBend(['node-aa0011', 'node-aa0003', 'node-aa0004']);
	commit(m, log, { ops: [delOp('link', 'link-aa0001')] }, 'server', 't');
	assert.deepEqual(m.get('group', 'group-aa0001')?.members, ['node-aa0003', 'node-aa0004']);
	assert.equal(loadsAtBoot(m), null);
});

test('B241: two swept bends in one group compose, member by member', () => {
	// both bends leave in one transaction: trimmed one at a time against the group as the previous
	// trim left it, or the second trim would restore the first -- the B240 shape, one layer over
	const { m, log } = fresh();
	commit(m, log, { ops: [
		put('node', node('node-aa0001', 0)), put('node', node('node-aa0002', 600)),
		put('node', node('node-aa0003', 120, { y: 240 })), put('node', node('node-aa0004', 240, { y: 240 })),
		put('node', wpAt('node-aa0011', 240)), put('node', wpAt('node-aa0012', 360)),
		linkPut('link-aa0001', 'node-aa0001', 'node-aa0002', { via: ['node-aa0011', 'node-aa0012'] }),
		put('group', { id: 'group-aa0001', name: 'g', members: ['node-aa0011', 'node-aa0012', 'node-aa0003', 'node-aa0004'] }),
	] }, 'server', 't');
	const before = contentOf(m);
	commit(m, log, { ops: [delOp('link', 'link-aa0001')] }, 'server', 't');
	assert.deepEqual(m.get('group', 'group-aa0001')?.members, ['node-aa0003', 'node-aa0004']);
	assert.equal(loadsAtBoot(m), null);
	undo(m, log);
	assert.equal(contentOf(m), before, 'and one undo restores both bends and the whole membership');
});


test('B241: a re-route that drops a grouped bend reaches the same sweep, and keeps the group true', () => {
	// not a delete at all: `set via []` straightens the link, the bend becomes debris, and the sweep
	// takes it. The reality map found six request shapes that reach the sweep; the fix lives in the
	// sweep itself rather than at any one of them, and this is the one that deletes nothing by name.
	const { m, log } = groupedBend(['node-aa0011', 'node-aa0003']);
	// AMENDED 2026-10-03 (S-c): the link's pipes were laid with it, and a straightened link still runs over them -- a route is
	// derived from the pipes (2026-09-26) -- so the bend stays carried. The re-route takes the bend's pipes up with it, which
	// leaves the bend debris exactly as before.
	const bendPipes = m.all('pipe').filter((p) => p.a === 'node-aa0011' || p.b === 'node-aa0011').map((p) => ({ op: 'del', kind: 'pipe', id: p.id }));
	assert.ok(bendPipes.length > 0, 'precondition: the link was laid with its legs');
	commit(m, log, { ops: [{ op: 'set', kind: 'link', id: 'link-aa0001', patch: { via: [] } }, ...bendPipes] }, 'server', 't');
	assert.equal(m.get('node', 'node-aa0011'), undefined, 'precondition: the bend was swept');
	assert.equal(m.get('group', 'group-aa0001'), undefined, 'and its group, left with one member, dissolved');
	assert.equal(loadsAtBoot(m), null);
});

/*
B269 -- A JOIN IS A REACTION TO A LINK LEAVING A WAYPOINT, not to a link being replaced there. The collapse fired at
every waypoint a deleted link ended at, where exactly two links then remained -- so splitting a link (del it, put its two
halves, as a junction split does) joined the OTHER end's two-link terminus, though nothing left it: two links before,
two after. Found by the director in the lab, cutting a link at a second non-transiting pin.
*/
test('B269: splitting a link does not join a two-link terminus at its other end', () => {
	const m = new Model(); const log = new Log();   // the server's planner works on a plain Model
	const P = 60, nd = (id, x, y) => ({ op: 'put', kind: 'node', entity: { id, name: id, type: 'router', x: x * P, y: y * P, shape: 'circle' } });
	const wp = (id, x, y) => ({ op: 'put', kind: 'node', entity: { id, name: id, x: x * P, y: y * P } });
	const lk = (id, s, d, via) => ({ op: 'put', kind: 'link', entity: { id, name: id, src: s, dst: d, ...(via ? { via } : {}) } });
	assert.equal(commit(m, log, { label: 'setup', ops: [nd('node-00000a', -6, 0), nd('node-00000f', 6, 0), wp('node-00000e', 0, 0), wp('node-e0000b', 3, -2),
		lk('link-00000c', 'node-00000a', 'node-00000e'), lk('link-00000d', 'node-00000e', 'node-00000f', ['node-e0000b'])] }, 'x', 'x').ok, true);
	const r = commit(m, log, { label: 'split', ops: [{ op: 'del', kind: 'link', id: 'link-00000d' },
		lk('link-00000d', 'node-00000e', 'node-e0000b'), lk('link-0000ee', 'node-e0000b', 'node-00000f')] }, 'x', 'x');
	assert.equal(r.ok, true);
	assert.deepEqual(m.all('link').map((l) => `${l.src}>${l.dst}`).sort(),
		['node-00000a>node-00000e', 'node-e0000b>node-00000f', 'node-00000e>node-e0000b'].sort(), 'three links: E keeps its two');
});

test('B269: a link that really leaves a waypoint still joins the two left there, as ruled', () => {
	const m = new Model(); const log = new Log();   // the server's planner works on a plain Model
	const P = 60, nd = (id, x, y) => ({ op: 'put', kind: 'node', entity: { id, name: id, type: 'router', x: x * P, y: y * P, shape: 'circle' } });
	const wp = (id, x, y) => ({ op: 'put', kind: 'node', entity: { id, name: id, x: x * P, y: y * P } });
	const lk = (id, s, d) => ({ op: 'put', kind: 'link', entity: { id, name: id, src: s, dst: d } });
	commit(m, log, { label: 'setup', ops: [nd('node-00000a', -6, 0), nd('node-00000b', 6, 0), nd('node-00000c', 0, -4), wp('node-00000e', 0, 0),
		lk('link-00000a', 'node-00000a', 'node-00000e'), lk('link-00000b', 'node-00000e', 'node-00000b'), lk('link-00000c', 'node-00000c', 'node-00000e')] }, 'x', 'x');
	assert.equal(commit(m, log, { label: 'del', ops: [{ op: 'del', kind: 'link', id: 'link-00000c' }] }, 'x', 'x').ok, true);
	assert.equal(m.all('link').length, 1, 'three became two at E, so the two join into one');
});

/*
B285 -- TWO LINKS AT A JUNCTION JOIN WHEN AN EDIT MAKES THEM COMPATIBLE (ruled 2026-10-02): a change of plane or direction
is a mutation after which two links remain, compatible, so they join -- as when a link leaves. Drawing a second link to a
terminus still never joins (B214), and an edit that leaves them incompatible, or touches nothing that decides, joins nothing.
*/
test('B285: two links at a junction join when an edit to one makes their planes match, and only then', () => {
	const P = 60, nd = (id, x, y) => ({ op: 'put', kind: 'node', entity: { id, name: id, type: 'router', x: x * P, y: y * P, shape: 'circle' } });
	const wp = (id, x, y) => ({ op: 'put', kind: 'node', entity: { id, name: id, x: x * P, y: y * P } });
	const lk = (id, s, d, extra = {}) => ({ op: 'put', kind: 'link', entity: { id, name: id, src: s, dst: d, ...extra } });
	const board = () => {
		const m = new Model(); const log = new Log();
		assert.equal(commit(m, log, { label: 'setup', ops: [nd('node-00000a', -6, 0), nd('node-00000b', 6, 0), wp('node-00000e', 0, -2),
			lk('link-00000a', 'node-00000a', 'node-00000e', { control: true }), lk('link-00000b', 'node-00000e', 'node-00000b')] }, 'x', 'x').ok, true);
		assert.equal(m.all('link').length, 2, 'a control link and a data link meeting at E: drawn, so never joined');
		return { m, log };
	};
	const set = (patch, id = 'link-00000b') => ({ label: 'plane', ops: [{ op: 'set', kind: 'link', id, patch }] });
	const { m, log } = board();
	assert.equal(commit(m, log, set({ name: 'renamed' }), 'x', 'x').ok, true);
	assert.equal(m.all('link').length, 2, 'a rename decides nothing: still two');
	assert.equal(commit(m, log, set({ control: true }), 'x', 'x').ok, true);
	assert.deepEqual(m.all('link').map((l) => [l.id, l.src, l.dst, l.via, l.control]), [['link-00000a', 'node-00000a', 'node-00000b', ['node-00000e'], true]], 'now both control: one link, bending at E');
	const other = board();
	assert.equal(commit(other.m, other.log, set({ control: false }, 'link-00000a'), 'x', 'x').ok, true);
	assert.equal(other.m.all('link').length, 1, 'or the other way: both data');
	// B286 -- a direction CLEARED is a declaration changed too, though `f` writes it as a whole-entity put
	const cleared = board();
	assert.equal(commit(cleared.m, cleared.log, { label: 'dirs', ops: [{ op: 'set', kind: 'link', id: 'link-00000a', patch: { control: false, direction: 'forward' } }, { op: 'set', kind: 'link', id: 'link-00000b', patch: { direction: 'reverse' } }] }, 'x', 'x').ok, true);
	assert.equal(cleared.m.all('link').length, 2, 'both arriving: incompatible');
	const { direction: _f, ...undirected } = cleared.m.get('link', 'link-00000b');
	assert.equal(commit(cleared.m, cleared.log, { label: 'flow cleared', ops: [{ op: 'put', kind: 'link', entity: undirected }] }, 'x', 'x').ok, true);
	assert.equal(cleared.m.all('link').length, 1, 'one direction cleared, a put: an undeclared link opposes nothing, so they join');
	const same = board();
	assert.equal(commit(same.m, same.log, { label: 'noop', ops: [{ op: 'put', kind: 'link', entity: { ...same.m.get('link', 'link-00000b'), name: 'renamed' } }] }, 'x', 'x').ok, true);
	assert.equal(same.m.all('link').length, 2, 'a put that changes no declaration decides nothing');
	const opposed = board();
	assert.equal(commit(opposed.m, opposed.log, { label: 'dirs', ops: [{ op: 'set', kind: 'link', id: 'link-00000a', patch: { control: false, direction: 'forward' } }, { op: 'set', kind: 'link', id: 'link-00000b', patch: { direction: 'reverse' } }] }, 'x', 'x').ok, true);
	assert.equal(opposed.m.all('link').length, 2, 'planes match but both arrive at E: incompatible, still two');
});

/*
B270 -- A REFUSED COMMIT TOUCHES NOTHING. The caption check (B220) came after the ops were applied and the version
advanced, so a refusal left the edit in the document, the version moved and no record written -- the document and its
log disagreeing, and undo blind to the change. The header promises rejection safety by purity.
*/
test('B270: a commit refused for its caption leaves the document, the version and the log exactly as they were', () => {
	const m = new Model(); const log = new Log();
	const nd = { op: 'put', kind: 'node', entity: { id: 'node-00000a', name: 'a', type: 'router', x: 0, y: 0, shape: 'circle' } };
	const r = commit(m, log, { ops: [nd], label: 'add', pace: 500, caption: 'x'.repeat(5000) }, 'x', 'x');
	assert.equal(r.ok, false);
	assert.match(r.error, /caption is 5000 characters/);
	assert.equal(m.all('node').length, 0, 'the edit is not in the document');
	assert.equal(log.version, 0, 'the version did not move');
	assert.equal(r.version, 0, 'and the refusal says so');
	assert.equal(undo(m, log).ok, false, 'there is nothing to undo, because nothing happened');
});

/*
B271 -- A PARTIAL REPAIR IS A REPAIR. The backstop compared violation sentences, which embed counts, so three straight
links on one pair could not lose one ("2 straight links" read as new) while losing two at once was accepted. A
transaction is refused for a violation it introduces or worsens -- the same subject, measured.
*/
test('B271: deleting one of three straight links on a pair is accepted, and adding a fourth is still refused', () => {
	const board = () => {
		const m = new Model();
		m.put('node', { id: 'node-00000a', name: 'a', type: 'router', x: 0, y: 0, shape: 'circle' });
		m.put('node', { id: 'node-00000b', name: 'b', type: 'router', x: 360, y: 0, shape: 'circle' });
		for (const i of [1, 2, 3]) m.put('link', { id: `link-00000${i}`, name: `l${i}`, src: 'node-00000a', dst: 'node-00000b' });
		return m;
	};
	const m = board();
	assert.equal(commit(m, new Log(), { ops: [{ op: 'del', kind: 'link', id: 'link-000001' }], label: 'del' }, 'x', 'x').ok, true, 'three to two is a repair');
	const worse = commit(board(), new Log(), { ops: [{ op: 'put', kind: 'link', entity: { id: 'link-000004', name: 'l4', src: 'node-00000b', dst: 'node-00000a' } }], label: 'add' }, 'x', 'x');
	assert.equal(worse.ok, false, 'three to four is worse, and refused');
	assert.match(worse.error, /4 straight links/);
});

/*
PL-2 -- THE CORE WRITES EVERY INVERSE (dev/design/planner/PLANNER-SYSTEM.md, PD-4). One function computes an op's
inverse and one applies ops to the projection while recording it; the per-op planners and the passes return ops only.
Held structurally, because the failure it prevents is a NEW pass that builds its own inverse -- or forgets to -- and
the corpus cannot see a pass that does not exist yet.
*/
test('PL-2: the planner writes inverses in one place, and applies ops to its projection in one place', async () => {
	const src = (await import('node:fs')).readFileSync(new URL('../planner/txn.mjs', import.meta.url), 'utf8');
	const plannerPart = src.slice(0, src.indexOf('// ---- the one write ----'));
	assert.equal((plannerPart.match(/inv\.unshift\(/g) || []).length, 1, 'only `track` records an inverse');
	assert.equal((plannerPart.match(/applyOps\(/g) || []).length, 1, 'only `track` advances the projection');
	assert.equal((plannerPart.match(/inverseOf\(/g) || []).length, 2, '`inverseOf` is defined once and called once, by `track`');
	assert.doesNotMatch(plannerPart, /inverse:\s*\[/, 'no planner returns an inverse list');
});

/*
PL-3 -- REACTIONS AND PHASES (dev/design/planner/PLANNER-SYSTEM.md section 6.2). What follows from an edit is declared by
TENANTS as reactions, run by a core that knows no entity rules. Held here: PL1, the core names no kind; PL4, phases run
in declared order and two reactions changing one entity in a phase is a fault (PD-3); acceptance test 5, a new
reaction lands with no edit to the core; and PD-2, a composition holds one link tenant. PL3 and PL5 are structural --
a reaction has only `emit`, so it can neither write an inverse nor refuse -- and PL-2's test above holds the first.
*/
test('PL1: the planner core names no entity kind -- the kinds are the tenants\'', async () => {
	const src = (await import('node:fs')).readFileSync(new URL('../planner/txn.mjs', import.meta.url), 'utf8');
	const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
	for (const kind of ['node', 'link', 'waypoint', 'group', 'zone']) {
		assert.doesNotMatch(code, new RegExp(`['"\`]${kind}['"\`]`), `the core's code names the kind '${kind}'`);
	}
});

{
	const pl3 = async () => {
		const { plan: p } = await import('./fixtures/composed.mjs');
		// the network's link tenant, the one production composes since S-b, as the base a test tenant extends
		const { NETWORK } = await import('./fixtures/composed.mjs');
		const CLASSIC_LINKS = NETWORK.links;
		const m = new Model();
		m.put('node', { id: 'node-00000a', name: 'a', type: 'router', x: 0, y: 0, shape: 'circle' });
		m.put('node', { id: 'node-00000b', name: 'b', type: 'router', x: 240, y: 0, shape: 'circle' });
		m.put('link', { id: 'link-000001', name: 'l', src: 'node-00000a', dst: 'node-00000b' });
		return { p, CLASSIC_LINKS, m };
	};
	const del = [{ op: 'del', kind: 'node', id: 'node-00000a' }];

	test('acceptance 5: a new reaction lands in a tenant with no edit to the core, and runs in its phase', async () => {
		const { p, CLASSIC_LINKS, m } = await pl3();
		const seen = [];
		const tagged = { id: 'note-renames', phase: 'sweep', trigger: { deleted: ['node'] }, run: ({ doc }, emit) => { seen.push(doc.all('node').length); emit([{ op: 'set', kind: 'node', id: 'node-00000b', patch: { name: 'alone' } }]); } };
		const r = p(m, del, { links: { owner: 'with a note', reactions: [...CLASSIC_LINKS.reactions, tagged] } });
		assert.equal(r.ok, true);
		assert.deepEqual(seen, [1], 'it ran once, in the sweep, after the requested delete and its cascade');
		assert.deepEqual(r.ops.at(-1), { op: 'set', kind: 'node', id: 'node-00000b', patch: { name: 'alone' } });
		assert.deepEqual(r.inverse[0], { op: 'set', kind: 'node', id: 'node-00000b', patch: { name: 'b' } }, 'and the core wrote its inverse');
	});

	test('PL4: phases run in the declared order, whatever order the tenant lists its reactions in', async () => {
		const { p, m } = await pl3();
		const order = [];
		const row = (phase) => ({ id: `r-${phase}`, phase, trigger: { deleted: ['node'] }, run: () => order.push(phase) });
		p(m, del, { links: { owner: 'shuffled', reactions: ['join', 'sweep', 'clear', 'stranded'].map(row) } });
		assert.deepEqual(order, ['clear', 'stranded', 'sweep', 'join']);
	});

	test('PL4 / PD-3: two reactions changing one entity in one phase is a fault, thrown, never a silent winner', async () => {
		const { p, CLASSIC_LINKS, m } = await pl3();
		const rival = { id: 'rival-cascade', phase: 'clear', trigger: { deleted: ['node'] }, run: (_, emit) => emit([{ op: 'set', kind: 'link', id: 'link-000001', patch: { name: 'x' } }]) };
		assert.throws(() => p(m, del, { links: { owner: 'rivals', reactions: [...CLASSIC_LINKS.reactions, rival] } }), /node-links and rival-cascade both change link:link-000001 in the clear phase/);
	});

	test('PD-2: a composition holds ONE link tenant -- a second is not a slot the planner has', async () => {
		const { p, CLASSIC_LINKS, m } = await pl3();
		assert.throws(() => p(m, del, { links: CLASSIC_LINKS, links2: CLASSIC_LINKS }), /unknown option links2/);
	});
}

/*
PL-4 -- THE EDGES (dev/design/planner/PLANNER-SYSTEM.md section 6.4). Placement and the clock are passed in, and beats are
a record extension around the core (planner/edges.mjs): the core reads no clock, resolves no anchor, and names no reveal.
*/
test('PL-4: the planner core reads no clock, resolves no anchor and names no reveal', async () => {
	const src = (await import('node:fs')).readFileSync(new URL('../planner/txn.mjs', import.meta.url), 'utf8');
	const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
	assert.doesNotMatch(code, /Date\.now|new Date|performance\.now/, 'no clock is read');
	assert.doesNotMatch(code, /anchor\.mjs|resolveAnchor/, 'placement is handed in');
	assert.doesNotMatch(code, /reveal|caption|pace/, 'beats are an extension');
});

test('PL-4: the clock passed in stamps the record and starts a beat, and undo and redo move the beat with the ops', async () => {
	const m = new Model(); const log = new Log();
	const nd = (i) => ({ op: 'put', kind: 'node', entity: { id: `node-00000${i}`, name: `n${i}`, type: 'router', x: i * 120, y: 0, shape: 'circle' } });
	const r = commit(m, log, { ops: [nd(1)], label: 'beat', pace: 500, caption: 'one' }, 'x', 'x', { now: () => 1234 });
	assert.equal(r.ok, true);
	assert.equal(r.change.at, 1234, 'the record\'s time is the clock\'s');
	assert.deepEqual(m.state.reveal, { origin: 1234, beats: [{ interval: 500, ids: ['node-000001'], caption: 'one' }] });
	assert.deepEqual(r.change.reveal, m.state.reveal);
	assert.equal(r.change.revealInverse, null);
	// still playing at 1500 (one id at 500ms runs to 1734), so the next beat joins the schedule
	commit(m, log, { ops: [nd(2)], label: 'beat', pace: 500 }, 'x', 'x', { now: () => 1500 });
	assert.equal(m.state.reveal.beats.length, 2);
	assert.equal(undo(m, log).ok, true);
	assert.equal(m.state.reveal.beats.length, 1, 'undo takes the second beat with its node');
	assert.equal(redo(m, log).ok, true);
	assert.equal(m.state.reveal.beats.length, 2, 'and redo brings it back');
	const plainLog = new Log(); const plain = commit(new Model(), plainLog, { ops: [nd(3)], label: 'add' }, 'x', 'x', { now: () => 7 });
	assert.equal('reveal' in plain.change, false, 'an ordinary commit\'s record carries no reveal');
});

test('PL-4: the store hands the planner its own clock and its placement', async () => {
	const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path');
	const { Store } = await import('../server/store.js');
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pl4-'));
	try {
		const store = new Store(dir, { now: () => 4242, authz: false });
		await store.init();
		const id = store.create('pl4').model.state.meta.id;
		const r = store.commit(id, { label: 'place', ops: [
			{ op: 'put', kind: 'node', entity: { id: 'node-00000a', name: 'lb-1', type: 'router', x: 0, y: 0, shape: 'circle' } },
			{ op: 'place', kind: 'node', entity: { id: 'node-00000b', name: 'web', type: 'server', shape: 'circle' }, at: { near: 'lb-1', dir: 'right' } }] });
		assert.equal(r.ok, true, r.error);
		assert.equal(r.change.at, 4242, 'the record is stamped by the store\'s clock');
		const placed = r.change.ops.find((o) => o.op === 'put' && o.entity.id === 'node-00000b').entity;   // each put is followed by its order (F-d)
		assert.deepEqual([placed.x, placed.y], [60, 0], 'and the place op resolved through the store\'s placement');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

/*
B272 -- A BEAT REVEALS WHAT IT CREATED, NOTHING ELSE. The beats extension revealed every entity a paced commit put, so a
beat that only renamed an entity already on screen withheld it until its turn -- what its own comment said must not
happen. Only ids absent before the commit join the schedule.
*/
test('B272: a paced commit reveals only the entities it created', () => {
	const m = new Model(); const log = new Log();
	const nd = (id, name, x) => ({ op: 'put', kind: 'node', entity: { id, name, type: 'router', x, y: 0, shape: 'circle' } });
	commit(m, log, { label: 'add', ops: [nd('node-00000a', 'a', 0)] }, 'x', 'x');
	const rename = commit(m, log, { label: 'rename', pace: 500, ops: [nd('node-00000a', 'renamed', 0)] }, 'x', 'x', { now: () => 1000 });
	assert.equal(rename.ok, true);
	assert.equal(m.state.reveal ?? null, null, 'a beat that only renames reveals nothing, so nothing on screen is withheld');
	assert.equal('reveal' in rename.change, false);
	const both = commit(m, log, { label: 'both', pace: 500, ops: [nd('node-00000a', 'again', 0), nd('node-00000b', 'b', 120)] }, 'x', 'x', { now: () => 2000 });
	assert.deepEqual(both.change.reveal.beats.map((b) => b.ids), [['node-00000b']], 'only the node it created');
});

/*
PL-5 -- ONE KIND TABLE (model/shape.mjs; ruled 2026-10-01: one table now, injection at promotion's format batch, B273).
Every list of the kinds in the planner and the server reads it; the id grammar is the one literal kept, pinned by C3,
and it must agree with the table. The thresholds keep their own authority (planner/policy.mjs) but cover the same kinds.
*/
test('PL-5: the kind table is the one list of kinds, and what still states them agrees with it', async () => {
	const { CORE_KINDS } = await import('../model/shape.mjs');
	const { list: KINDS, collection: COLLECTION, selectable: SELECTABLE_KINDS, optional: OPTIONAL, composite: COMPOSITE } = CORE_KINDS;
	const { collectionCap } = await import('../planner/policy.mjs');
	// three since S-e (H18.15): the link is the network's kind (network/link-kind.mjs), composed by composing the network
	assert.deepEqual(KINDS, ['node', 'zone', 'group']);
	const { LINK_ROW } = await import('../network/link-kind.mjs');
	assert.equal(LINK_ROW.kind, 'link');
	assert.equal(LINK_ROW.owner, 'the network');
	for (const table of [COLLECTION, COMPOSITE, OPTIONAL]) assert.deepEqual(Object.keys(table), KINDS);
	assert.deepEqual(SELECTABLE_KINDS, ['node', 'zone'], 'a group is never selected directly');
	assert.deepEqual(Object.keys(collectionCap({ nodeExt: { x: 60, y: 60 }, zoneExt: { x: 60, y: 60 }, pitch: 60 })).sort(), [...KINDS].sort());
	// H17.22 N-a: the id grammar is built from the rows -- the product composes exactly the table's kinds, each row
	// accepting its own kind's id and no other's
	const PRODUCT_KINDS = (await import('../planner/kinds.mjs')).productKinds();
	assert.deepEqual(PRODUCT_KINDS.list, KINDS, 'the product composes exactly the table\'s kinds');
	for (const k of KINDS) for (const other of KINDS) assert.equal(PRODUCT_KINDS.row(k).fields.id(`${other}-00aa11`), k === other, `${k} accepts ${other} ids: ${k === other}`);
	// a Model's collections are the table's, in its order
	const m = new Model();
	assert.deepEqual(Object.keys(m.toJSON()).filter((k) => Object.values(COLLECTION).includes(k)), KINDS.map((k) => COLLECTION[k]));
});
