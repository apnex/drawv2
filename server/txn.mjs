/*
Txn — the one write.

  plan(model, ops)                        PURE. Reads a projection, writes nothing.
  commit(model, log, request, by, actor)  THE ONE WRITE. No I/O, no timers, no broadcast, no flush.
  undo(model, log, to?) / redo(model, log)

Every writer in the system — browser gesture, keyboard nudge, palette stamp, label edit, rename,
REST entity verb, CLI verb, undo, redo — is a caller that builds a request. There is no second
path. Every consequence of an edit is decided here -- by the tenants' reactions, which this core runs (PL-3) -- and so
is every inverse.

The inverse is computed by the planner because the planner is the only place that holds the
pre-state at the moment each op is decided. Deriving it later is impossible: a forward `set` patch
does not carry the old values, and a forward `del` does not carry the entity.

PL-2 (dev/design/planner/PLANNER-SYSTEM.md, PD-4) -- THE CORE WRITES EVERY INVERSE, in one place: `track` applies each
op to the projection and records its inverse from the state just before it (`inverseOf`). The per-op planners and the
passes return ops only. Each built its own inverse before -- the same rule hand-written in every planner, cascade and
pass -- and one that forgot would have committed an edit undo could not reverse.

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

import { projection } from '../model/model.mjs';
import { applyOps, clone } from '../model/ops.mjs';
import { COMPOSITE } from '../model/shape.mjs';   // OPTIONAL was imported here and never used (B86)
import { groupAfterRemoval, collectionCap } from '../engine/policy.mjs';
import { NODE_EXT, ZONE_EXT } from '../model/surface.mjs';
import { STD } from '../kernel/spec.mjs';
import { validateMutation, validateMetaPatch } from './validate.js';
import { violations } from '../model/invariants.mjs';
import { CLASSIC_LINKS, GROUPS } from './tenants.mjs';
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

/*
PL-2 -- the inverse of one op, read from the model as it stands just before the op is applied. A `put` over an entity
restores it, a `put` of a new one deletes it, a `set` restores what its patch touches (`inverseOfSet`), a `del` puts
the entity back, and `meta` restores the keys it changes. Null for an op that changes nothing it can see -- a `del` of
an absent entity, which no planner emits.
*/
function inverseOf(model, op) {
	if (op.op === 'meta') {
		const prev = {};
		for (const k of Object.keys(op.patch)) prev[k] = model.state.meta[k];
		return { op: 'meta', patch: prev };
	}
	const id = op.op === 'put' ? op.entity.id : op.id;
	const before = model.get(op.kind, id);
	if (op.op === 'set') return inverseOfSet(op.kind, before, op.patch);
	if (op.op === 'put') return before ? { op: 'put', kind: op.kind, entity: clone(op.kind, before) } : { op: 'del', kind: op.kind, id };
	return before ? { op: 'put', kind: op.kind, entity: clone(op.kind, before) } : null;
}

/*
PL-2 -- THE ONE PLACE AN OP REACHES THE PROJECTION. Each op is applied in turn and its inverse taken just before, so the
inverse list is the exact reverse of the ops whoever produced them: a requested op, a cascade, the stranded pass, the
sweep, the join. `out` and `inv` are the transaction's lists; `inv` is kept pre-reversed, since undo replays it in order.
*/
function track(proj, ops, out, inv) {
	for (const op of ops) {
		const back = inverseOf(proj, op);
		applyOps(proj, [op]);
		out.push(op);
		if (back) inv.unshift(back);
	}
}

/*
PL-3 -- THE PHASES, declared in order (PLANNER-SYSTEM.md section 6.2; PD-3). A request passes through three:

  1  the requested ops, each validated and narrowed here, in order
  2  REACTIONS, brought by tenants, in the phases below
  3  REFUSALS: the document rules, judged on the result (the backstop at the end of `plan`)

Two phases react to ONE OP, wherever it came from -- a request or another reaction:
  clear     before a delete applies: what cannot outlive the entity (a node's links, a waypoint's links, group members)
  follow    after a put applies: what it displaces (a group's stolen members)
Three react to THE TRANSACTION, once, after the requested ops:
  stranded  links that lost what they live by (the network's only)
  sweep     anchors the transaction orphaned
  join      two links left alone at an anchor, made one

The order is meaning -- today's sequence, held by the planner corpus -- so it is data a reader can see rather than the
order code happens to run in. Within one run of a phase, two reactions changing one entity is a fault (PD-3), thrown,
so a test meets it; never a silent winner.
*/
export const PHASES = ['clear', 'follow', 'stranded', 'sweep', 'join'];   // read by tools/reaction-table.mjs, which documents them
const PER_OP = new Set(['clear', 'follow']);

/*
A composition holds ONE link tenant (PD-2): production's classic one by default, or the network plugin's, passed as
`{ links }`; the product's group tenant is always there, after it. The four network hooks this file once asked
(`alsoReferenced`, `keepsOrphan`, `isStranded`, `joinsAt`) are conditions inside the network's own reactions now
(PR3), so the core asks a plugin nothing; a retired `network` option is refused rather than ignored.
*/
function composition({ links = CLASSIC_LINKS, network, ...rest } = {}, who) {
	if (network !== undefined) throw new Error(`${who}: the \`network\` option is retired -- the network plugs in as its link tenant, { links: network.links } (PL-3)`);
	const stray = Object.keys(rest);
	if (stray.length) throw new Error(`${who}: unknown option ${stray.join(', ')} -- a composition passes { links } (PL-3)`);
	const rows = Object.fromEntries(PHASES.map((p) => [p, []]));
	const ids = new Set();
	for (const tenant of [links, GROUPS]) {
		if (!tenant || typeof tenant.owner !== 'string' || !Array.isArray(tenant.reactions)) throw new Error(`${who}: a tenant is { owner, reactions } (PL-3)`);
		for (const r of tenant.reactions) {
			if (!r || !PHASES.includes(r.phase) || typeof r.run !== 'function') throw new Error(`${who}: ${tenant.owner}: a reaction is { id, phase, run } with a phase of ${PHASES.join(', ')}`);
			if (ids.has(r.id)) throw new Error(`${who}: two reactions are named ${r.id}`);
			ids.add(r.id);
			rows[r.phase].push({ ...r, owner: tenant.owner });
		}
	}
	return rows;
}

// the legacy {action, kind, entity} shape validateMutation speaks (it is the trust boundary, and is not rewritten here)
const asMutation = (op) => ({ action: op.op, kind: op.kind, entity: op.op === 'del' ? { id: op.id } : (op.op === 'set' ? { ...op.patch, id: op.id } : op.entity) });
const subjectOf = (op) => (op.op === 'meta' ? 'meta' : `${op.kind}:${op.op === 'put' ? op.entity.id : op.id}`);

export function plan(model, ops, options = {}) {
	const rows = composition(options, 'plan');
	if (!Array.isArray(ops) || ops.length < 1 || ops.length > MAX_OPS) {
		return { ok: false, error: `request must carry 1..${MAX_OPS} ops`, opIndex: -1 };
	}
	const proj = projection(model);
	const out = [];
	const inv = [];

	/*
	Run one phase. Each reaction EMITS ops, and each is applied at once through `apply`, so the next decision -- its own or
	the next reaction's -- reads the document as it now stands (B240). The ops a reaction emits directly are claimed for it;
	a second reaction claiming one of the same entities in this run of the phase is a fault (PD-3). What an emitted op sets
	off in turn -- a delete's own clear phase -- is a run of its own.
	*/
	const runPhase = (phase, ctx) => {
		const claimed = new Map();
		for (const r of rows[phase]) {
			if (r.on && !r.on(ctx.op, proj)) continue;
			r.run(ctx, (emitted) => {
				for (const op of emitted) {
					const subject = subjectOf(op);
					const holder = claimed.get(subject);
					if (holder && holder !== r.id) throw new Error(`plan: ${holder} and ${r.id} both change ${subject} in the ${phase} phase (PD-3)`);
					claimed.set(subject, r.id);
					apply(op);
				}
			});
		}
	};
	// one op to the projection: a delete of something present clears what depends on it first; a put is followed after
	const apply = (op) => {
		if (op.op === 'del') {
			if (!proj.get(op.kind, op.id)) return;   // already gone -- accepted, no-op
			runPhase('clear', { op, doc: proj });
		}
		track(proj, [op], out, inv);
		if (op.op === 'put') runPhase('follow', { op, doc: proj });
	};
	// what a put would set off, asked without applying anything -- whether an unchanged put still does something
	const follows = (op) => {
		let n = 0;
		for (const r of rows.follow) if (!r.on || r.on(op, proj)) r.run({ op, doc: proj }, (emitted) => { n += emitted.length; });
		return n > 0;
	};

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
		if (!step.op) continue;                                    // narrowed to nothing
		if (step.unchanged && !follows(step.op)) continue;         // an unchanged put that displaces nothing
		apply(step.op);
	}
	const ctx = { before: model, doc: proj, ops: out, refuses: (op) => validateMutation(proj, asMutation(op)) };
	for (const phase of PHASES) if (!PER_OP.has(phase)) runPhase(phase, ctx);

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
		// B271 -- by identity and measure, not sentence: a violation this transaction introduced, or made worse
		const before = new Map(violations(model, { groupAfterRemoval, facts: true }).map((v) => [v.key, v.measure]));
		const introduced = violations(proj, { groupAfterRemoval, facts: true }).filter((v) => !before.has(v.key) || v.measure > before.get(v.key));
		if (introduced.length) return { ok: false, error: introduced[0].sentence, opIndex: -1 };
	}
	return { ok: true, ops: out, inverse: inv };
}

/*
Phase 1 for one requested op: resolved, validated against the document as the ops before it left it, and narrowed to
what it changes. Answers the op to apply, or none; `unchanged` marks a put of an entity already present byte for byte.
*/
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
	handed, and everything below -- validation, the reactions, the inverse, the apply -- is untouched. A
	refusal keeps plan()'s contract, so the set is refused whole and names the op that failed.
	*/
	if (op.op === 'place') {
		const at = resolveAnchor(model, op.at || {});
		if (!at.ok) return { ok: false, error: at.error };
		op = { op: 'put', kind: op.kind, entity: { ...op.entity, x: at.x, y: at.y } };
	}

	if (!['put', 'set', 'del'].includes(op.op)) return { ok: false, error: `unknown op '${op.op}'` };
	const err = validateMutation(model, asMutation(op));
	if (err) return { ok: false, error: err };

	if (op.op === 'put') {
		const before = model.get(op.kind, op.entity.id);
		if (!before && model.all(op.kind).length >= MAX_COLLECTION[op.kind]) return { ok: false, error: `${op.kind} collection limit reached` };
		const put = { op: 'put', kind: op.kind, entity: clone(op.kind, op.entity) };
	// A put of an entity already present unchanged, with no group to steal from, changes nothing.
	// Narrow it away — the same no-op rule a set and a delete follow (I6). This is what makes an
	// outbox replay free: a request the server already accepted costs a no-op ack, not a second
	// version bump and a second record for a document that did not move.
		// -- unless it still displaces something (a group stealing members), which the core asks of the follow phase.
		return { ok: true, op: put, unchanged: !!before && same(before, put.entity) };
	}
	if (op.op === 'set') {
		const before = model.get(op.kind, op.id);
		if (!before) return { ok: false, error: `set on missing entity: ${op.id}` };
		const narrowed = narrow(op.kind, before, op.patch);
		return { ok: true, op: Object.keys(narrowed).length ? { op: 'set', kind: op.kind, id: op.id, patch: narrowed } : null };
	}
	return { ok: true, op: { op: 'del', kind: op.kind, id: op.id } };
}

function planMeta(model, op) {
	const patch = op.patch || {};
	// the server never trusts the wire: the same gate patchMeta ran, now inside the transaction
	const err = validateMetaPatch(patch);
	if (err) return { ok: false, error: err };
	const meta = model.state.meta;
	const next = {};
	if (patch.name !== undefined && patch.name !== meta.name) next.name = patch.name;
	return { ok: true, op: Object.keys(next).length ? { op: 'meta', patch: next } : null };
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

// ---- the one write ----

export function commit(model, log, request, by = 'client', actor = null, options = {}) {
	// a composition error is checked FIRST, so a refused request can never hide a half-plugged plugin
	composition(options, 'commit');
	if (!request || typeof request !== 'object') return { ok: false, error: 'invalid request', version: log.version };
	if (request.label !== undefined && !LABEL.test(String(request.label))) {
		return { ok: false, error: 'invalid label', version: log.version };
	}
	if (request.expect != null && request.expect !== log.version) {
		return { ok: false, error: 'version conflict', version: log.version };
	}

	const planned = plan(model, request.ops, options);
	if (!planned.ok) return { ok: false, error: planned.error, opIndex: planned.opIndex, version: log.version };
	if (!planned.ops.length) return { ok: true, change: null, version: log.version };   // accepted no-op
	/*
	B270 -- EVERY REFUSAL BEFORE THE APPLY. The caption limit (B220, below) was checked after the ops were applied and
	the version advanced, so a refusal left the edit in the document with no record. It is decided here, from the same
	planned ops, before anything is touched -- what the header's "rejection safety is by PURITY" requires.
	*/
	const beatIds = Number.isInteger(request.pace) && request.pace >= 0 ? planned.ops.filter((o) => o.op === 'put').map((o) => o.entity.id) : [];
	if (beatIds.length && request.caption !== undefined && String(request.caption).length > CAPTION_MAX) {
		return { ok: false, error: `caption is ${String(request.caption).length} characters; the limit is ${CAPTION_MAX}`, version: log.version };
	}

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
			// its length was checked before the apply (B270, above)
			if (request.caption !== undefined) {
				const caption = String(request.caption);
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
