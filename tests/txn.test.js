// txn — the one write. These are the properties the old single-op planner could not express:
// a transaction spanning N ops, an inverse derived at plan time, a cascade that is ONE change,
// and a no-op that is accepted without becoming one.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from '../model/index.mjs';
import { plan, commit, undo, redo, MAX_OPS } from '../server/txn.mjs';
import { Log } from '../server/log.mjs';

const node = (id, x = 0, extra = {}) => ({ id, name: id, type: 'host', shape: 'circle', x, y: 0, ...extra });
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
		{ op: 'set', kind: 'node', id: 'node-aa0099', patch: { x: 1 } },   // missing
	]);
	assert.equal(r.ok, false);
	assert.equal(r.at, 1, 'the failing op index is reported');
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
