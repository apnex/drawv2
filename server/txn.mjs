/*
Txn — the one write.

  plan(model, ops)                        PURE. Reads a projection, writes nothing.
  commit(model, log, request, by, actor)  THE ONE WRITE. No I/O, no timers, no broadcast, no flush.
  undo(model, log, to?) / redo(model, log)

Every writer in the system — browser gesture, keyboard nudge, palette stamp, label edit, rename,
REST entity verb, CLI verb, undo, redo — is a caller that builds a request. There is no second
path. The cascade lives here and only here; so does the inverse.

The inverse is computed by the planner because the planner is the only place that holds the
pre-state at the moment each op is decided. Deriving it later is impossible: a forward `set` patch
does not carry the old values, and a forward `del` does not carry the entity.

Rejection safety is by PURITY, not rollback: plan() runs against a scratch projection, so a
rejected request has touched nothing and there is nothing to undo. That is the same guarantee the
old planMutation gave for one op, extended to N.

Provenance: this file replaces server/commit.mjs, whose header recorded the lineage of the
transaction seam — a prism state-engine core (same author), from which `commit` was lifted
verbatim when drawv2 stopped depending on that project. Its other primitives (a bounded graph
walk, an FSM stepper) had no consumer here and did not come across. The port-shaped combinator it
provided had exactly two consumers, each cancelling a different axis of its genericity; with one
transaction shape the ports were dead weight. The substitution seam it offered re-lands one layer
out, as the Store's injected {flushMs, writeDoc, now}.
*/

import { projection } from '../model/index.mjs';
import { applyOps, clone } from '../model/ops.mjs';
import { COMPOSITE, OPTIONAL } from '../model/shape.mjs';
import { groupAfterRemoval } from '../engine/index.mjs';
import { validateMutation, validateMetaPatch } from './validate.js';

export const MAX_OPS = 2000;              // per REQUEST
export const MAX_COLLECTION = 2000;       // per KIND, per diagram — a different cap
const LABEL = /^[a-z0-9 -]{0,32}$/;

// The inverse of a `set` restores the previous value of exactly the keys the patch touches. If the
// patch introduces a key the entity did not have, no `set` can express "remove it again" — so the
// whole prior entity is restored with a `put` instead.
function inverseOfSet(kind, before, patch) {
	const keys = Object.keys(patch);
	const introduces = keys.some((k) => !(k in before));
	if (introduces) return { op: 'put', kind, entity: clone(kind, before) };
	const restore = {};
	for (const k of keys) restore[k] = before[k];
	return { op: 'set', kind, id: before.id, patch: clone(kind, restore) };
}

// Only the keys that actually change survive into the op. Narrowing here is what makes a no-op
// transaction detectable (an empty op list) instead of a version bump for nothing.
function narrow(kind, before, patch) {
	const out = {};
	for (const [k, v] of Object.entries(patch)) {
		if (k === 'id') continue;
		const cur = before[k];
		const same = COMPOSITE[kind]?.has(k)
			? JSON.stringify(cur) === JSON.stringify(v)
			: cur === v;
		if (!same) out[k] = v;
	}
	return out;
}

export function plan(model, ops) {
	if (!Array.isArray(ops) || ops.length < 1 || ops.length > MAX_OPS) {
		return { ok: false, error: `request must carry 1..${MAX_OPS} ops`, at: -1 };
	}
	const proj = projection(model);
	const out = [];
	const inv = [];

	for (let i = 0; i < ops.length; i++) {
		const step = planOne(proj, ops[i]);
		if (!step.ok) return { ok: false, error: step.error, at: i };
		applyOps(proj, step.ops);              // advance the projection for op i+1
		out.push(...step.ops);
		inv.unshift(...step.inverse);          // pre-reversed: undo replays inv in order
	}
	return { ok: true, ops: out, inverse: inv };
}

function planOne(model, op) {
	if (op.op === 'meta') return planMeta(model, op);
	if (!['put', 'set', 'del'].includes(op.op)) return { ok: false, error: `unknown op '${op.op}'` };

	// validateMutation speaks the legacy {action, kind, entity} shape; it is the trust boundary and
	// is not being rewritten in this milestone.
	const entity = op.op === 'del' ? { id: op.id } : (op.op === 'set' ? { ...op.patch, id: op.id } : op.entity);
	const err = validateMutation(model, { action: op.op, kind: op.kind, entity });
	if (err) return { ok: false, error: err };

	if (op.op === 'put') return planPut(model, op);
	if (op.op === 'set') return planSet(model, op);
	return planDel(model, op);
}

function planMeta(model, op) {
	const patch = op.patch || {};
	// the server never trusts the wire: the same gate patchMeta ran, now inside the transaction
	const err = validateMetaPatch(patch);
	if (err) return { ok: false, error: err };
	const meta = model.state.meta;
	const ops = [];
	const inverse = [];
	const next = {};
	const prev = {};
	if (patch.name !== undefined && patch.name !== meta.name) { next.name = patch.name; prev.name = meta.name; }
	if (patch.slides?.url !== undefined && patch.slides.url !== meta.slides.url) {
		next.slides = { url: patch.slides.url };
		prev.slides = { url: meta.slides.url };
	}
	if (Object.keys(next).length) { ops.push({ op: 'meta', patch: next }); inverse.push({ op: 'meta', patch: prev }); }
	return { ok: true, ops, inverse };
}

// Order-insensitive structural equality. An entity arriving from the wire may carry the same
// fields in a different order than the stored one, and key order is not a change.
function same(a, b) {
	if (a === b) return true;
	if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
	if (Array.isArray(a) !== Array.isArray(b)) return false;
	const ka = Object.keys(a);
	if (ka.length !== Object.keys(b).length) return false;
	return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && same(a[k], b[k]));
}

function planPut(model, { kind, entity }) {
	const before = model.get(kind, entity.id);
	if (!before && model.all(kind).length >= MAX_COLLECTION) {
		return { ok: false, error: `${kind} collection limit reached` };
	}
	const ops = [{ op: 'put', kind, entity: clone(kind, entity) }];
	const inverse = before
		? [{ op: 'put', kind, entity: clone(kind, before) }]
		: [{ op: 'del', kind, id: entity.id }];

	// "a node belongs to at most one group" — the rule existed ONLY in the browser
	// (app/src/commands.js), so POST /groups admitted a node to two groups. It lives here now.
	if (kind === 'group' && Array.isArray(entity.members)) {
		for (const other of model.all('group')) {
			if (other.id === entity.id) continue;
			const kept = other.members.filter((m) => !entity.members.includes(m));
			if (kept.length === other.members.length) continue;
			const { remaining, dissolve } = groupAfterRemoval(other.members, (m) => entity.members.includes(m));
			if (dissolve) {
				ops.push({ op: 'del', kind: 'group', id: other.id });
				inverse.unshift({ op: 'put', kind: 'group', entity: clone('group', other) });
			} else {
				ops.push({ op: 'set', kind: 'group', id: other.id, patch: { members: remaining } });
				inverse.unshift({ op: 'set', kind: 'group', id: other.id, patch: { members: [...other.members] } });
			}
		}
	}
	// A put of an entity already present unchanged, with no group to steal from, changes nothing.
	// Narrow it away — the same no-op rule planSet and planDel follow (I6). This is what makes an
	// outbox replay free: a request the server already accepted costs a no-op ack, not a second
	// version bump and a second record for a document that did not move.
	if (before && ops.length === 1 && same(before, ops[0].entity)) return { ok: true, ops: [], inverse: [] };
	return { ok: true, ops, inverse };
}

function planSet(model, { kind, id, patch }) {
	const before = model.get(kind, id);
	if (!before) return { ok: false, error: `set on missing entity: ${id}` };
	const narrowed = narrow(kind, before, patch);
	if (!Object.keys(narrowed).length) return { ok: true, ops: [], inverse: [] };   // no-op
	return {
		ok: true,
		ops: [{ op: 'set', kind, id, patch: narrowed }],
		inverse: [inverseOfSet(kind, before, narrowed)],
	};
}

function planDel(model, { kind, id }) {
	const before = model.get(kind, id);
	if (!before) return { ok: true, ops: [], inverse: [] };   // already gone — accepted, no-op
	const ops = [];
	const inverse = [];

	const trimGroupsHolding = (memberId) => {
		for (const group of model.all('group')) {
			if (!group.members.includes(memberId)) continue;
			const { remaining, dissolve } = groupAfterRemoval(group.members, (m) => m === memberId);
			if (dissolve) {
				ops.push({ op: 'del', kind: 'group', id: group.id });
				inverse.unshift({ op: 'put', kind: 'group', entity: clone('group', group) });
			} else {
				ops.push({ op: 'set', kind: 'group', id: group.id, patch: { members: remaining } });
				inverse.unshift({ op: 'set', kind: 'group', id: group.id, patch: { members: [...group.members] } });
			}
		}
	};

	if (kind === 'node') {
		for (const link of model.linksOf(id)) {
			ops.push({ op: 'del', kind: 'link', id: link.id });
			inverse.unshift({ op: 'put', kind: 'link', entity: clone('link', link) });
		}
		trimGroupsHolding(id);
	}
	if (kind === 'waypoint') {
		for (const link of model.linksAt(id)) {
			if (link.src === id || link.dst === id) {
				ops.push({ op: 'del', kind: 'link', id: link.id });
				inverse.unshift({ op: 'put', kind: 'link', entity: clone('link', link) });
			} else {
				ops.push({ op: 'set', kind: 'link', id: link.id, patch: { via: link.via.filter((w) => w !== id) } });
				inverse.unshift({ op: 'set', kind: 'link', id: link.id, patch: { via: [...link.via] } });
			}
		}
		trimGroupsHolding(id);
	}
	ops.push({ op: 'del', kind, id });
	inverse.unshift({ op: 'put', kind, entity: clone(kind, before) });
	return { ok: true, ops, inverse };
}

// ---- the one write ----

export function commit(model, log, request, by = 'client', actor = null) {
	if (!request || typeof request !== 'object') return { ok: false, error: 'invalid request', version: log.version };
	if (request.label !== undefined && !LABEL.test(String(request.label))) {
		return { ok: false, error: 'invalid label', version: log.version };
	}
	if (request.expect != null && request.expect !== log.version) {
		return { ok: false, error: 'version conflict', version: log.version };
	}

	const planned = plan(model, request.ops);
	if (!planned.ok) return { ok: false, error: planned.error, at: planned.at, version: log.version };
	if (!planned.ops.length) return { ok: true, change: null, version: log.version };   // accepted no-op

	applyOps(model, planned.ops);                                    // the sole mutation point
	const from = log.version;
	const seq = ++log.version;
	stamp(model, log);                                               // D6: the document carries its own version
	const change = {
		seq, from, at: Date.now(), by, actor,
		label: request.label || '',
		ops: planned.ops,
		inverse: planned.inverse,
	};
	log.append(change);
	return { ok: true, change, version: log.version };
}

/*
D6 — the document carries its own version, and it is the log's.

Two counters that must agree is a defect waiting to happen, so there is one source and one mirror:
the log mints, the document is stamped from it here, at the ONE place a version can change. It is
stamped on undo and redo too, because those bump the version without appending a record — a
mirror that only tracked commits would drift the first time anyone pressed Ctrl+Z.

The mirror exists so a document is self-describing off-line: a file on disk, a GET response and a
Slides push all say which version they are, without the reader having to hold the log.
*/
function stamp(model, log) {
	model.state.meta.version = log.version;
}

// Undo reverses records down to (and including) `to`, as ONE transaction: one version bump, one
// broadcast. It appends no record — appending an inverse would truncate the redo tail it just
// created, which is why version cannot be the ring's length.
export function undo(model, log, to = null) {
	if (!log.canUndo()) return { ok: false, error: 'nothing to undo', version: log.version };
	// D21 — `to` names the OLDEST record to reverse, and it must name one that is currently
	// applied. Unvalidated, `undo {to: 0}` reverses the entire ring: the destructive verb would
	// take an unbounded argument from the wire. It is refused, not clamped, because a client that
	// sent a seq the ring no longer holds is working from a stale history and should be told.
	if (to != null) {
		if (!Number.isInteger(to)) return { ok: false, error: 'invalid undo target', version: log.version };
		const applied = log.records.slice(0, log.cursor);
		if (!applied.some((r) => r.seq === to)) {
			return { ok: false, error: `no applied change with seq ${to}`, version: log.version };
		}
	}
	const target = to == null ? log.records[log.cursor - 1].seq : to;
	const ops = [];
	while (log.cursor > 0 && log.records[log.cursor - 1].seq >= target) {
		ops.push(...log.records[log.cursor - 1].inverse);
		log.cursor--;
	}
	if (!ops.length) return { ok: false, error: 'nothing to undo', version: log.version };
	applyOps(model, ops);
	log.version++;
	stamp(model, log);
	return { ok: true, ops, version: log.version };
}

export function redo(model, log) {
	if (!log.canRedo()) return { ok: false, error: 'nothing to redo', version: log.version };
	const record = log.records[log.cursor];
	applyOps(model, record.ops);
	log.cursor++;
	log.version++;
	stamp(model, log);
	return { ok: true, ops: record.ops, version: log.version };
}
