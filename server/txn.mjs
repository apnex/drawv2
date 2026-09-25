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
import { COMPOSITE } from '../model/shape.mjs';   // OPTIONAL was imported here and never used (B86)
import { groupAfterRemoval, collectionCap } from '../engine/index.mjs';
import { NODE_EXT, ZONE_EXT } from '../model/index.mjs';
import { STD } from '../kernel/index.mjs';
import { validateMutation, validateMetaPatch } from './validate.js';
import { violations, isStraight, pairKey, collapseAtWaypoint } from '../model/invariants.mjs';
import { CAPTION_MAX } from '../model/limits.mjs';
import { resolveAnchor } from './anchor.mjs';

export const MAX_OPS = 2000;              // per REQUEST
// B113: per KIND, per diagram -- a different enforcement POINT from validateDoc, deliberately, but
// no longer a different NUMBER. Both source engine/policy.mjs, which is the authority for it.
const MAX_COLLECTION = collectionCap({ nodeExt: NODE_EXT, zoneExt: ZONE_EXT, pitch: STD.pitch });
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
		return { ok: false, error: `request must carry 1..${MAX_OPS} ops`, opIndex: -1 };
	}
	const proj = projection(model);
	const out = [];
	const inv = [];

	/*
	B103 -- `opIndex`, not `at`. This file already used `at` for a Change's wall-clock timestamp
	twelve lines below, and `at` is a region offset array over in commands.js. Three meanings for
	one name in one codebase is a search that cannot be resolved by reading the hit. The rejection
	index is the only one of the three no client had seen, so it is the one that could still move.
	-1 means the request was refused as a whole rather than at a particular op.
	*/
	for (let i = 0; i < ops.length; i++) {
		const step = planOne(proj, ops[i]);
		if (!step.ok) return { ok: false, error: step.error, opIndex: i };
		applyOps(proj, step.ops);              // advance the projection for op i+1
		out.push(...step.ops);
		inv.unshift(...step.inverse);          // pre-reversed: undo replays inv in order
	}
	/*
	B162 -- a waypoint that has lost every link self-destructs, in the same transaction.

	The cascade already runs the other way: deleting a waypoint deletes a link that cannot survive
	it, because "a link that cannot survive the operation does not limp on in a degenerate form".
	This is the mirror. A waypoint exists to be part of a path; with no path it is debris that still
	renders and still holds its anchor, so a removed shape used to leave its bends scattered on the
	canvas -- 64 of them, from one deleted ring.

	ON THE RESULT, not per op, for the same reason the invariant check below is: a batch may
	transiently orphan and end valid. Deleting one link while re-routing another through the same
	bends is legal and a per-op sweep would eat them in between.

	IN THIS TRANSACTION, so the inverse restores waypoint and link together and one undo puts the
	shape back whole.

	THE ROLE IS DERIVED, never stored. In a link's `via` it is a bend; at `src`/`dst` of an open
	link an endpoint; at `src`/`dst` of a CLOSED link a bend again, because a ring has no ends; and
	referenced nowhere, an orphan. Only `pinned` is written down, because a waypoint placed
	deliberately with no link has no structure to read an intention off.
	*/
	const refs = (m) => {
		const set = new Set();
		for (const l of m.all('link')) {
			set.add(l.src);
			set.add(l.dst);
			for (const w of Array.isArray(l.via) ? l.via : []) set.add(w);
		}
		return set;
	};
	/*
	B216 -- only a BEND is swept. A waypoint an author TERMINATED a link at survives losing it.

	The sweep was written for bends and its reasoning is theirs: a bend exists to shape a path, so
	with no path it is debris that still renders and still holds its anchor -- 64 of them left over
	from one deleted ring. An endpoint is not that. It is a place the author put something, the same
	way a node is, and deleting a link must no more remove it than it removes the node at the other
	end.

	`refs` cannot tell them apart -- it folds src, dst and via into one set -- so the role is read
	separately from the state BEFORE the transaction. A waypoint threaded as a bend and nothing else
	is swept; one anything terminated at is kept, and becomes a bare anchor the author can reuse or
	delete deliberately.
	*/
	const wasBendOnly = (m) => {
		const bend = new Set();
		const terminal = new Set();
		for (const l of m.all('link')) {
			terminal.add(l.src);
			terminal.add(l.dst);
			for (const w of Array.isArray(l.via) ? l.via : []) bend.add(w);
		}
		for (const id of terminal) bend.delete(id);
		return bend;
	};
	/*
	ONLY WHAT THIS TRANSACTION ORPHANED, which is the same rule the invariant check below uses and
	for the same reason. Sweeping every unreferenced waypoint would make an unrelated commit quietly
	delete debris the caller never mentioned, and would put those deletions in its inverse -- so an
	undo of "move a node" would resurrect somebody else's litter. A document that reached a messy
	state stays repairable on its own terms.

	Found by the GR5 differential: the frozen oracle and the modern planner diverged on random
	mutations that touched no link at all, because the corpus contains documents with pre-existing
	orphans. That divergence was the design telling me the scope was wrong.
	*/
	const wasReferenced = refs(model);
	const nowReferenced = refs(proj);
	const sweepable = wasBendOnly(model);
	const debris = proj.all('waypoint').filter((w) => !nowReferenced.has(w.id) && !w.pinned
		&& wasReferenced.has(w.id)                       // it arrived unreferenced; not ours to remove
		&& sweepable.has(w.id));                          // B216 -- it was a terminus, not debris
	/*
	B241 -- a swept waypoint leaves its group exactly as a requested delete's does: trimmed, or the
	group dissolved when it falls below two.

	ONE AT A TIME, applied to the projection as each goes. Two swept bends in one group must trim
	against the membership the previous trim left, or the second would restore the first -- the
	stale-read shape B240 removed from the collapse. Applied, too, so the invariant check below sees
	the state that will actually be stored rather than one still carrying the debris.
	*/
	for (const w of debris) {
		const step = [], undoStep = [];
		trimGroupsHolding(proj, w.id, step, undoStep);
		step.push({ op: 'del', kind: 'waypoint', id: w.id });
		undoStep.unshift({ op: 'put', kind: 'waypoint', entity: clone('waypoint', w) });
		out.push(...step);
		inv.unshift(...undoStep);
		applyOps(proj, step);
	}

	/*
	B215 -- a waypoint left with one link IN and one OUT is a BEND, so rejoin them.

	A junction cannot exist with two links; that shape is a path passing through the point. Deleting
	a link from a three-way junction leaves exactly it, and without this the waypoint stays a
	junction -- the document remembering a gesture rather than describing what is on screen.

	HERE, not in the client's delete command, which is where it was first written and wrong. Undo
	and redo are computed server-side and never run a client command, so an undone split stayed
	split; and the CLI and REST doors write through this planner without touching `commands.js` at
	all. One rule, one place, every door.

	THE INBOUND LINK'S ID SURVIVES. It is the half that kept the original id when the link was
	split, so split-then-delete is a round trip back to the route the author drew rather than a
	churn of identities.

	ONLY WAYPOINTS THIS TRANSACTION TOUCHED, the same scope rule the sweep above uses and for the
	same reason: collapsing a pre-existing two-link waypoint would rewrite a shape the caller never
	mentioned and put that rewrite in its inverse.
	*/
	/*
	ON LOSING A LINK, not on gaining one. The scope was "any waypoint at the end of any link this
	transaction touched", which included CREATING one -- so drawing two links that met at a
	waypoint collapsed them into a bend the moment the second was made, and the author could never
	build a two-link terminus at all.

	A collapse is a reaction to a shape being LEFT BEHIND. Only a removal can leave one.
	*/
	const touched = new Set();
	for (const op of out) {
		if (op.kind !== 'link' || op.op !== 'del') continue;
		const e = op.entity || model.get('link', op.id);
		if (!e) continue;
		for (const end of [e.src, e.dst]) if (proj.get('waypoint', end)) touched.add(end);
	}
	for (const w of touched) {
		const at = proj.all('link').filter((l) => l.src === w || l.dst === w || (l.via || []).includes(w));
		if (at.length !== 2) continue;
		/*
		B222 -- PICK A PAIR, do not demand a stored orientation.

		This chose `inbound` by `l.dst === w` and `outbound` by `l.src === w`, so two links that both
		stored `w` as their src found no inbound and the collapse silently declined. Stored order is
		which end the author dragged from; for an undeclared link it means nothing, and reading it
		here made a bend's survival depend on a gesture several steps earlier.

		The src side is the link that ENDS at the waypoint, preferred so the original id survives a
		split-then-collapse round trip (B213). When neither ends here, `collapseAtWaypoint` orients
		them; when both do, the other is flipped. Order within the pair is all that is decided here.
		*/
		const src = at.find((l) => l.dst === w) || at[0];
		const other = at.find((l) => l !== src);
		const merged = other ? collapseAtWaypoint(src, other, w) : null;
		if (!merged) continue;
		const inbound = src, outbound = other;
		// `patch`, not `after` -- `after` is the COMMAND vocabulary and applyOps reads `patch`. The
		// first version used the command spelling, so the del landed and the merge silently did not.
		// SRC travels in the patch too. It never changed while the pair had to arrive stored in the
		// right order, so writing only dst and via was sufficient; now that the src side may be
		// flipped to face through the point, omitting it left the merged link still ending at the
		// waypoint it was supposed to absorb.
		// FLOW travels with SRC, for the same reason. A declaration is expressed relative to the
		// stored order, so a flip that inverts `flow` in the merged object but does not write it
		// leaves the document declaring the opposite of what the author meant -- silently, since
		// every other field looks right. Omitted only when the link was undeclared.
		const patch = { src: merged.src, dst: merged.dst, via: merged.via,
			...(typeof merged.flow === 'boolean' ? { flow: merged.flow } : {}) };
		/*
		B239 -- a merge is TAKEN only if the link it produces passes the rules a requested write does.

		The merged link is built from two valid halves, and that is not enough. Joining x->w to
		w->y via [x] names x twice, and joining two halves can produce an endpoint pair another link
		already bends through at a shared waypoint. The referential rules refuse both, and they are
		deliberately outside `violations()` -- which was this write's only check. So the collapse
		committed documents that `validateDoc` refuses, and the store skips a refused file at its next
		boot: the whole diagram lost, from a delete the author made legally.

		The SAME check a requested set receives, rather than a second copy of the rules, run against
		the document with the absorbed half already gone. Declining is safe: two links left meeting at
		the waypoint is a two-link terminus, which is a legal state (B217) and exactly what the author
		would have had without the collapse.
		*/
		const trial = projection(proj);
		applyOps(trial, [{ op: 'del', kind: 'link', id: outbound.id }]);
		if (validateMutation(trial, { action: 'set', kind: 'link', entity: { ...patch, id: inbound.id } })) continue;
		/*
		`inverseOfSet` rather than a hand-rolled patch, because it already solves the case that bit
		here: a collapse INTRODUCES `via` on a link that had none, and restoring it with
		`patch: { via: [] }` leaves an empty array where there was no key. An undone collapse must
		be byte-identical to what stood before it, or a document drifts a little on every undo --
		so when a patch introduces a key, the inverse is a `put` of the whole prior entity.

		Taken BEFORE the merge is applied: `inbound` and `outbound` are the projection's live
		entities, and applying the set rewrites `inbound` in place.
		*/
		inv.unshift(inverseOfSet('link', inbound, patch),
			{ op: 'put', kind: 'link', entity: clone('link', outbound) });
		/*
		B240 -- APPLIED AS IT IS DECIDED, so the next merge reads the document this one left.

		The merges used to be collected and applied once, after the loop. Every merge after the first
		therefore read its pair as the links stood before ANY merge. Delete the one link that made two
		neighbouring waypoints junctions and both collapse: the second then rewrote a link the first had
		already deleted, the set landed on nothing, and the far node was left with no link -- while the
		transaction reported success and the document validated. Declared flow was judged against the
		same stale links, so a convergence the matrix calls a junction was merged away.

		This is the shape the planner already uses between requested ops: advance the projection, then
		read it. The set of waypoints to consider is still fixed before the loop, so a merge's own
		delete never becomes a trigger -- a valid merge carries both halves' references and cannot
		leave a new candidate behind.
		*/
		const step = [{ op: 'del', kind: 'link', id: outbound.id },
			{ op: 'set', kind: 'link', id: inbound.id, patch }];
		out.push(...step);
		applyOps(proj, step);
	}

	/*
	B81 -- the document invariants, checked once against the state this transaction would produce.

	On the RESULT rather than per op, because a batch may transiently violate and end valid:
	deleting a straight link and clearing another link's route in the same transaction is legal,
	and a per-op check would refuse a state that never becomes durable.

	A backstop, not the primary mechanism. The waypoint cascade already removes a link that would
	be left colliding, so a well-formed operation never arrives here failing. What arrives here is
	the path nobody thought about -- `set` clearing a `via` directly, which reaches no cascade and
	no authoring guard, and which is the reason the rule could not stay at the call sites.
	*/
	const after = violations(proj, { groupAfterRemoval });
	if (after.length) {
		/*
		Only what this transaction INTRODUCES. Refusing on the post-state alone would mean a
		document that somehow reached a bad state could never be repaired, because the repair is
		itself a transaction and would be refused for the condition it exists to remove. Found by
		the GR5 corpus, whose generator predates the rule and produces such documents freely --
		a case I would not have thought of, and a lockout rather than a mere inconvenience.
		*/
		const before = new Set(violations(model, { groupAfterRemoval }));
		const introduced = after.filter((v) => !before.has(v));
		if (introduced.length) return { ok: false, error: introduced[0], opIndex: -1 };
	}
	return { ok: true, ops: out, inverse: inv };
}

function planOne(model, op) {
	if (op.op === 'meta') return planMeta(model, op);

	/*
	B189/W9 -- a `place` op names a RELATIONSHIP and is resolved here, against the projection this
	planner already advances between ops.

	That is the whole reason resolution is server-side. A drafted set resolves op 2 against the
	document op 1 has already changed; resolving both client-side against one pre-draft snapshot
	picks the same anchor twice and the set is refused for occupancy. Measured before this existed:
	`node-aa2222 and node-aa1111 occupy the same anchor (0,-60)`.

	Additive by construction: resolution rewrites the op into exactly the `put` it would have been
	handed, and everything below -- validation, planPut, the inverse, applyOps -- is untouched. A
	refusal keeps plan()'s contract, so the set is refused whole and names the op that failed.
	*/
	if (op.op === 'place') {
		const at = resolveAnchor(model, op.at || {});
		if (!at.ok) return { ok: false, error: at.error };
		op = { op: 'put', kind: op.kind, entity: { ...op.entity, x: at.x, y: at.y } };
	}

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
	if (!before && model.all(kind).length >= MAX_COLLECTION[kind]) {
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

/*
A group loses a member: trimmed, or dissolved when it falls below two. The ops and their inverses are
appended to the caller's lists, read against `model` as it stands.

ONE FUNCTION FOR EVERY PATH THAT REMOVES A MEMBER (B241). It lived as a closure inside `planDel`, so a
requested delete maintained membership and the orphan sweep -- the other path that deletes a
waypoint -- did not. The sweep left a group listing a waypoint that no longer existed, which
`violations()` cannot see and `validateDoc` refuses at the next boot. Two paths holding one duty is
how one of them forgets it.
*/
function trimGroupsHolding(model, memberId, ops, inverse) {
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
}

function planDel(model, { kind, id }) {
	const before = model.get(kind, id);
	if (!before) return { ok: true, ops: [], inverse: [] };   // already gone — accepted, no-op
	const ops = [];
	const inverse = [];

	if (kind === 'node') {
		for (const link of model.linksOf(id)) {
			ops.push({ op: 'del', kind: 'link', id: link.id });
			inverse.unshift({ op: 'put', kind: 'link', entity: clone('link', link) });
		}
		trimGroupsHolding(model, id, ops, inverse);
	}
	if (kind === 'waypoint') {
		/*
		B81: stripping a waypoint can leave a link STRAIGHT, and a pair carries only one straight
		link. Where the strip would produce a colliding duplicate the link is deleted with the
		waypoint instead, in the same undoable step.

		That matches the branch below it: a waypoint that is a link's ENDPOINT already deletes the
		link rather than stripping it, on the same principle -- a link that cannot survive the
		operation does not limp on in a degenerate form. Refusing the waypoint deletion outright
		was the alternative and was rejected: being told you may not delete a waypoint because of
		a link you were not thinking about is a worse answer than removing the link that could
		not exist.

		An EXISTING straight link outranks one that would be created by this strip, so the route
		yields to the direct link rather than the reverse.
		*/
		const dying = new Set();
		const stripped = [];
		for (const link of model.linksAt(id)) {
			if (link.src === id || link.dst === id) dying.add(link.id);
			else stripped.push(link);
		}
		const straightPairs = new Set();
		for (const l of model.all('link')) {
			if (dying.has(l.id) || !isStraight(l)) continue;
			straightPairs.add(pairKey(l));
		}

		for (const link of model.linksAt(id)) {
			if (dying.has(link.id)) {
				ops.push({ op: 'del', kind: 'link', id: link.id });
				inverse.unshift({ op: 'put', kind: 'link', entity: clone('link', link) });
			}
		}
		for (const link of stripped) {
			const remaining = link.via.filter((w) => w !== id);
			if (remaining.length === 0 && straightPairs.has(pairKey(link))) {
				ops.push({ op: 'del', kind: 'link', id: link.id });
				inverse.unshift({ op: 'put', kind: 'link', entity: clone('link', link) });
				continue;
			}
			if (remaining.length === 0) straightPairs.add(pairKey(link));
			ops.push({ op: 'set', kind: 'link', id: link.id, patch: { via: remaining } });
			inverse.unshift({ op: 'set', kind: 'link', id: link.id, patch: { via: [...link.via] } });
		}
		trimGroupsHolding(model, id, ops, inverse);
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
	if (!planned.ok) return { ok: false, error: planned.error, opIndex: planned.opIndex, version: log.version };
	if (!planned.ops.length) return { ok: true, change: null, version: log.version };   // accepted no-op

	applyOps(model, planned.ops);                                    // the sole mutation point
	const from = log.version;
	const seq = ++log.version;
	stamp(model, log);                                               // D6: the document carries its own version
	/*
	H14.4/H14.7 -- a `pace` makes this commit a BEAT, and the record is built here because here is
	the only place that knows which ids it produced.

	An intent op names a relationship and the id is minted while resolving it (B189), so a client
	assembling this would be guessing at the very ids the beat exists to order. `planned.ops` is
	the resolved list, in the order it applied, which is exactly the order to reveal in.

	Only CREATED entities are revealed. A beat that renames something would otherwise hide an entity
	already on screen, and a rename that made a node vanish reads as a deletion.

	The reveal INVERTS like anything else (ruled 2026-09-04). It is captured before and after, and
	the inverse restores the previous record -- so undoing a beat takes its reveal with it and
	undoing past an earlier beat restores THAT one, rather than leaving the document holding a
	record that describes a commit already reversed.
	*/
	const revealBefore = model.state.reveal ? structuredClone(model.state.reveal) : null;
	if (Number.isInteger(request.pace) && request.pace >= 0) {
		const ids = planned.ops.filter((o) => o.op === 'put').map((o) => o.entity.id);
		if (ids.length) {
			const beat = { interval: request.pace, ids };
			/*
			B220 -- REFUSED here, not truncated and not stored unchecked.

			This was `String(request.caption)` with no length test, while `validateDoc` checked the
			stored file against a limit at boot. So a long caption was accepted, persisted, served
			all session, and then refused when the server next read the file -- the diagram vanished
			from its owner's list with nothing said, and the only trace was a skip line in the boot
			log. A document the system produced could not be reloaded by the system.

			Refusing is right rather than truncating: a caption silently shortened is a narration the
			author did not write, and they would find out by reading it later. The limit is stated
			once in `model/limits.mjs` and both doors read it, which is the property that was missing
			-- not the value of the limit.
			*/
			if (request.caption !== undefined) {
				const caption = String(request.caption);
				if (caption.length > CAPTION_MAX) {
					return { ok: false, error: `caption is ${caption.length} characters; the limit is ${CAPTION_MAX}` };
				}
				if (caption) beat.caption = caption;
			}
			/*
			B193 -- a beat joins a schedule that is still playing, and STARTS one that has drained.

			The origin was stamped once and never moved, so a beat committed after the queue finished
			inherited a window that had already closed and never unfurled. The caption still showed,
			being held until replaced, so the narration read correctly while nothing paced -- which
			is why it survived being watched.

			An agent narrating across a pause is the use case rather than an edge, so the test is
			whether the existing schedule has ENDED, not whether one exists. A drained reveal is
			replaced rather than appended to: carrying expired beats forward would leave the record
			describing unfurls nobody can ever see, and they have already played.
			*/
			const prev = model.state.reveal;
			const playing = prev && Date.now() < prev.origin
				+ prev.beats.reduce((a, b) => a + (b.ids?.length || 0) * (b.interval || 0), 0);
			model.state.reveal = playing
				? { ...prev, beats: [...prev.beats, beat] }
				: { origin: Date.now(), beats: [beat] };
		}
	}
	const revealAfter = model.state.reveal ? structuredClone(model.state.reveal) : null;

	const change = {
		seq, from, at: Date.now(), by, actor,
		label: request.label || '',
		ops: planned.ops,
		inverse: planned.inverse,
	};
	// carried beside the ops rather than inside them: a reveal is not a mutation of an entity, and
	// applyOps is the single writer for those. Only recorded when it actually changed, so an
	// ordinary commit's record is byte-identical to what it was before beats existed.
	if (revealBefore !== null || revealAfter !== null) {
		if (JSON.stringify(revealBefore) !== JSON.stringify(revealAfter)) {
			change.reveal = revealAfter;
			change.revealInverse = revealBefore;
		}
	}
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
every write says which version it is, without the reader having to hold the log.
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
	/*
	H14.7 -- the reveal is reversed along with the ops, to the state before the OLDEST record in
	this run. Walking outward, the last `revealInverse` seen is the earliest one, which is why it
	is assigned rather than accumulated: undoing three beats at once restores what stood before all
	three, not what stood before the last of them.

	`undefined` means this record never touched the reveal, and must not be mistaken for `null`,
	which means it set the reveal to nothing.
	*/
	let revealTo;
	while (log.cursor > 0 && log.records[log.cursor - 1].seq >= target) {
		const rec = log.records[log.cursor - 1];
		ops.push(...rec.inverse);
		if ('revealInverse' in rec) revealTo = rec.revealInverse;
		log.cursor--;
	}
	if (!ops.length) return { ok: false, error: 'nothing to undo', version: log.version };
	applyOps(model, ops);
	if (revealTo !== undefined) model.state.reveal = revealTo ? structuredClone(revealTo) : null;
	log.version++;
	stamp(model, log);
	return { ok: true, ops, version: log.version };
}

export function redo(model, log) {
	if (!log.canRedo()) return { ok: false, error: 'nothing to redo', version: log.version };
	const record = log.records[log.cursor];
	applyOps(model, record.ops);
	// H14.7 -- and the reveal forward again, or redoing a beat would restore its entities while
	// leaving them permanently hidden by the record undo had already rolled back.
	if ('reveal' in record) model.state.reveal = record.reveal ? structuredClone(record.reveal) : null;
	log.cursor++;
	log.version++;
	stamp(model, log);
	return { ok: true, ops: record.ops, version: log.version };
}
