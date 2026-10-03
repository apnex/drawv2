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
import { groupAfterRemoval } from './policy.mjs';
import { validateMutation, validateMetaPatch } from './validate.js';
import { PRODUCT_KINDS } from './kinds.mjs';   // H17.22 N-a: the kinds a composition brings, each a whole row
import { violations } from '../model/invariants.mjs';
import { nextOrder } from '../model/order.mjs';   // a creation without a drawing order is given one (F-d)
import { GROUPS } from './tenants.mjs';
import { BEATS, wallClock } from './edges.mjs';

export const MAX_OPS = 2000;              // per REQUEST
// B113: the collection cap is per KIND, per diagram -- a different enforcement POINT from validateDoc, deliberately, but
// no longer a different NUMBER: both read the kind's row (`cap`), which planner/policy.mjs sources (H17.22 N-a).
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
function narrow(kind, before, patch, kinds) {
	const out = {};
	for (const [k, v] of Object.entries(patch)) {
		if (k === 'id') continue;
		const cur = before[k];
		const same = kinds.composite[kind]?.has(k)
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
// `covered`: the op's inverse is already in `inv` whole -- a drawing order given right after the put it completes, which
// the put's own inverse (a delete, or the item as it was) undoes with it (F-d)
function track(proj, ops, out, inv, changes, covered = false) {
	for (const op of ops) {
		changes.note(op);   // before it applies, so the change set holds the entity as it stood (TG-1)
		changes.absorbed(op);
		const back = covered ? null : inverseOf(proj, op);
		applyOps(proj, [op]);
		out.push(op);
		if (back) inv.unshift(back);
	}
}

/*
TG-1 (H17.28; `dev/design/planner/PLANNER-SYSTEM.md` section 14.2) -- THE CHANGE SET: every entity the transaction touched,
as it stood before the transaction and as it stands now, and which of its fields differ -- however each op was written, a
set or a whole-entity put, and whoever emitted it, the request or a reaction. Noted by `track`, the one place an op reaches
the projection, so nothing applied is missed. `before` is a copy taken the first time an entity is touched; `after` is read
from the projection when asked, so it is always current. An entity created and deleted again, or put back unchanged, is no
change. Handed to every phase as `changes`; the reactions read it from TG-3.
*/
const sameValue = (x, y) => JSON.stringify(x) === JSON.stringify(y);
function changeSet(proj) {
	const seen = new Map();   // `kind:id` -> { kind, id, before }
	const fieldsOf = (before, after) => {
		if (!before || !after) return new Set(Object.keys(before ?? after ?? {}));
		return new Set([...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => !sameValue(before[k], after[k])));
	};
	return {
		note(op) {
			if (op.op === 'meta') return;
			const id = op.op === 'put' ? op.entity.id : op.id;
			const key = `${op.kind}:${id}`;
			if (seen.has(key)) return;
			const was = proj.get(op.kind, id);
			seen.set(key, { kind: op.kind, id, before: was ? structuredClone(was) : null, into: null });
		},
		// SUCCESSION (TG-1b): an op that deletes an entity may name what it was absorbed into -- the join's `into`
		absorbed(op) { if (op.op === 'del' && op.into) seen.get(`${op.kind}:${op.id}`).into = op.into; },
		// every change, as { kind, id, before, after, fields, into? }; `before` or `after` null for an entity created or deleted,
		// and `into` what a deleted entity was absorbed into, when the op that deleted it said so
		list() {
			const out = [];
			for (const { kind, id, before, into } of seen.values()) {
				const now = proj.get(kind, id);
				const after = now ? structuredClone(now) : null;
				if (!before && !after) continue;
				const fields = fieldsOf(before, after);
				if (before && after && !fields.size) continue;
				out.push({ kind, id, before, after, fields, ...(into && !after ? { into } : {}) });
			}
			return out;
		},
	};
}

/*
TG-2 (H17.28; PLANNER-SYSTEM.md section 14.3; TG-D1 ruled 2026-10-02) -- A REACTION'S TRIGGER, as data: what it listens to.
One clause, or a list of them, any of which matching suffices:

  { deleted: [kinds] }                    an entity of one of these kinds deleted
  { created: [kinds] }                    one created
  { changed: { kind, fields: [fields] } } one of these fields of an entity of that kind changed

A per-op reaction (`clear`, `follow`) is called for an op its trigger matches: a delete matches `deleted`; a put or set of
an entity this transaction created matches `created`, and of one it did not, `changed` -- by the fields the op names. It
replaces the predicate `on` each reaction carried (retired; a reaction still naming one is refused, as is one with no
trigger). The transaction phases' reactions declare theirs too; they are called by it from TG-3.
*/
const TRIGGER_KEYS = ['deleted', 'created', 'changed'];
function validTrigger(trigger) {
	const clauses = [].concat(trigger ?? []);
	if (!clauses.length) return false;
	return clauses.every((c) => c && typeof c === 'object' && Object.keys(c).length && Object.keys(c).every((k) => TRIGGER_KEYS.includes(k))
		&& (c.deleted === undefined || (Array.isArray(c.deleted) && c.deleted.length))
		&& (c.created === undefined || (Array.isArray(c.created) && c.created.length))
		&& (c.changed === undefined || (typeof c.changed.kind === 'string' && Array.isArray(c.changed.fields) && c.changed.fields.length)));
}
/*
TG-3 -- whether a transaction-phase reaction's trigger matches a change in the change set: an entity deleted (`before`
only), created (`after` only), or changed in one of the named fields.
*/
function changeMatches(trigger, change) {
	return [].concat(trigger).some((c) => (!change.after && c.deleted?.includes(change.kind))
		|| (!change.before && c.created?.includes(change.kind))
		|| (change.before && change.after && c.changed?.kind === change.kind && c.changed.fields.some((f) => change.fields.has(f))));
}
// whether a per-op reaction's trigger matches this op; `created` says whether the transaction created the op's entity
function opMatches(trigger, op, created) {
	const named = op.op === 'put' ? Object.keys(op.entity) : op.op === 'set' ? Object.keys(op.patch) : [];
	return [].concat(trigger).some((c) => (op.op === 'del' && c.deleted?.includes(op.kind))
		|| (op.op !== 'del' && created && c.created?.includes(op.kind))
		|| (op.op !== 'del' && !created && c.changed?.kind === op.kind && c.changed.fields.some((f) => named.includes(f))));
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
export const PHASES = ['clear', 'follow', 'reshape', 'stranded', 'sweep', 'join'];   // read by tools/reaction-table.mjs, which documents them
const PER_OP = new Set(['clear', 'follow']);

/*
A composition holds ONE link tenant (PD-2): production's classic one by default, or the network plugin's, passed as
`{ links }`; the product's group tenant is always there, after it. The four network hooks this file once asked
(`alsoReferenced`, `keepsOrphan`, `isStranded`, `joinsAt`) are conditions inside the network's own reactions now
(PR3), so the core asks a plugin nothing; a retired `network` option is refused rather than ignored.
*/
/*
PL-4 -- THE EDGES are passed in too (PLANNER-SYSTEM.md section 6.4):
  place      resolves a `place` op's relationship to an anchor, `(model, at) -> { ok, x, y } | { ok: false, error }`.
             The server's store passes `server/anchor.mjs` (K3); a composition with none refuses a `place` op.
  now        the clock, for the record's time and a beat's origin; `wallClock` (planner/edges.mjs) if none is given.
  extensions the record extensions run around each commit; production's, BEATS, if none are given.
*/
/*
H17.22 N-a -- THE KINDS are passed in too: `kinds`, a composition of whole rows (model/shape.mjs `composeKinds`), the
product's five (planner/kinds.mjs) if none are given. Every row must carry its checks, and the model planned against must
be composed with the same kinds -- a model holding a kind the planner cannot validate, or the reverse, is a half-composed
plugin, refused by name rather than met as an `unknown kind` later.
*/
function composition({ links = null, place = null, now = wallClock, extensions = [BEATS], kinds = PRODUCT_KINDS, network, ...rest } = {}, who) {
	if (network !== undefined) throw new Error(`${who}: the \`network\` option is retired -- the network plugs in as its link tenant, { links: network.links } (PL-3)`);
	const stray = Object.keys(rest);
	if (stray.length) throw new Error(`${who}: unknown option ${stray.join(', ')} -- a composition passes { links, place, now, extensions, kinds } (PL-4, N-a)`);
	if (!kinds || !Array.isArray(kinds.list) || !kinds.checked) throw new Error(`${who}: kinds is a composition whose every row carries its checks -- composeKinds(rows) (model/shape.mjs, N-a)`);
	if (place !== null && typeof place !== 'function') throw new Error(`${who}: place is a resolver, (model, at) -> anchor (PL-4)`);
	if (typeof now !== 'function') throw new Error(`${who}: now is a clock, () -> milliseconds (PL-4)`);
	for (const x of extensions) if (!x || typeof x.field !== 'string' || typeof x.refuse !== 'function' || typeof x.next !== 'function') throw new Error(`${who}: a record extension is { id, field, refuse, next } (PL-4)`);
	const rows = Object.fromEntries(PHASES.map((p) => [p, []]));
	const ids = new Set();
	const refusals = [];
	/*
	S-b (H18.12) -- NO DEFAULT LINK TENANT. A plan names the link tenant it runs: the network's, the only one since the classic
	tenant was deleted (SERVER-COMPOSES-NETWORK.md). So no path plans links by a rule nobody chose. Undo and redo plan nothing
	-- they replay stored inverses -- and take none.
	*/
	const plans = who === 'plan' || who === 'commit';
	if (plans && links === null) throw new Error(`${who}: no link tenant -- a composition passes the network's, { links: network.links } (S-b)`);
	for (const tenant of [...(links ? [links] : []), GROUPS]) {
		if (!tenant || typeof tenant.owner !== 'string' || !Array.isArray(tenant.reactions)) throw new Error(`${who}: a tenant is { owner, reactions } (PL-3)`);
		/*
		F-e (H18.7) -- A TENANT'S REFUSALS: rules the tenant holds on the result, as data like its reactions -- an id, a
		trigger, a doc and `refuse({ before, doc, matches }) -> error | null`, judged once the phases have run, before the
		document rules. The network's first: a transit value a node's type does not offer. A refusal changes nothing; it
		names why the transaction is refused.
		*/
		for (const r of tenant.refusals ?? []) {
			if (!r || typeof r.refuse !== 'function' || !validTrigger(r.trigger)) throw new Error(`${who}: ${tenant.owner}: a refusal is { id, trigger, doc, refuse } (F-e)`);
			if (ids.has(r.id)) throw new Error(`${who}: two reactions are named ${r.id}`);
			ids.add(r.id);
			refusals.push({ ...r, owner: tenant.owner });
		}
		// a tenant names the kinds its reactions read -- the network's pipes -- and a composition without one is half-composed (N-d)
		const lacking = (tenant.kinds ?? []).filter((k) => !kinds.has(k));
		if (lacking.length) throw new Error(`${who}: ${tenant.owner} needs the kind ${lacking.join(', ')}, which this composition does not include (H17.22 N-d)`);
		// and the fields it reads on another owner's kind -- the network's `transit` on a node (S-a)
		for (const [k, names] of Object.entries(tenant.fields ?? {})) {
			const missing = names.filter((f) => !kinds.row(k)?.fields?.[f]);
			if (missing.length) throw new Error(`${who}: ${tenant.owner} needs the field ${missing.map((f) => `${k}.${f}`).join(', ')}, which this composition does not include (S-a)`);
		}
		for (const r of tenant.reactions) {
			if (!r || !PHASES.includes(r.phase) || typeof r.run !== 'function') throw new Error(`${who}: ${tenant.owner}: a reaction is { id, phase, trigger, run } with a phase of ${PHASES.join(', ')}`);
			if (r.on !== undefined) throw new Error(`${who}: ${tenant.owner}: ${r.id} carries \`on\`, retired by TG-2 -- a reaction declares its trigger as data (H17.28)`);
			if (!validTrigger(r.trigger)) throw new Error(`${who}: ${tenant.owner}: ${r.id} declares no trigger -- { deleted: [kinds] }, { created: [kinds] } or { changed: { kind, fields } }, or a list of them (TG-2)`);
			if (ids.has(r.id)) throw new Error(`${who}: two reactions are named ${r.id}`);
			ids.add(r.id);
			rows[r.phase].push({ ...r, owner: tenant.owner });
		}
	}
	/*
	TG-4 -- THE DISPATCH INDEX: for each phase, which reactions listen to each kind, built once with the composition. A
	change is offered only to the reactions listening to its kind, in their declared order, so an edit's cost follows the
	kinds it touched, not the number of reactions composed.
	*/
	const kindsOf = (trigger) => new Set([].concat(trigger).flatMap((c) => [...(c.deleted ?? []), ...(c.created ?? []), ...(c.changed ? [c.changed.kind] : [])]));
	const listening = Object.fromEntries(PHASES.map((p) => [p, new Map()]));
	for (const p of PHASES) for (const r of rows[p]) for (const k of kindsOf(r.trigger)) {
		if (!listening[p].has(k)) listening[p].set(k, []);
		listening[p].get(k).push(r);
	}
	// the reactions of a phase listening to any of these kinds, in declared order
	const listeners = (phase, kinds) => {
		const hear = new Set(kinds.flatMap((k) => listening[phase].get(k) ?? []));
		return rows[phase].filter((r) => hear.has(r));
	};
	return { rows, listeners, place, now, extensions, kinds, refusals };
}

// the model must be composed with the planner's kinds, in the same order (N-a)
function sameKinds(model, kinds, who) {
	const held = model.kinds?.list ?? [];
	if (held.join() !== kinds.list.join()) throw new Error(`${who}: the model is composed with kinds ${held.join(', ')} and the planner with ${kinds.list.join(', ')} -- a composition passes one set of kinds to both (N-a)`);
}

// the legacy {action, kind, entity} shape validateMutation speaks (it is the trust boundary, and is not rewritten here)
const asMutation = (op) => ({ action: op.op, kind: op.kind, entity: op.op === 'del' ? { id: op.id } : (op.op === 'set' ? { ...op.patch, id: op.id } : op.entity) });
const subjectOf = (op) => (op.op === 'meta' ? 'meta' : `${op.kind}:${op.op === 'put' ? op.entity.id : op.id}`);

export function plan(model, ops, options = {}) {
	const { rows, listeners, place, kinds, refusals } = composition(options, 'plan');
	const called = [];   // the reactions this plan called, in order (TG-4) -- what an edit cost
	sameKinds(model, kinds, 'plan');
	if (!Array.isArray(ops) || ops.length < 1 || ops.length > MAX_OPS) {
		return { ok: false, error: `request must carry 1..${MAX_OPS} ops`, opIndex: -1 };
	}
	const proj = projection(model);
	const out = [];
	const inv = [];
	const changes = changeSet(proj);   // TG-1
	// whether this transaction created the entity an op names: not there before it began
	const isCreated = (op) => op.op !== 'del' && !model.get(op.kind, op.op === 'put' ? op.entity.id : op.id);

	/*
	Run one phase. Each reaction EMITS ops, and each is applied at once through `apply`, so the next decision -- its own or
	the next reaction's -- reads the document as it now stands (B240). The ops a reaction emits directly are claimed for it;
	a second reaction claiming one of the same entities in this run of the phase is a fault (PD-3). What an emitted op sets
	off in turn -- a delete's own clear phase -- is a run of its own.
	*/
	const runPhase = (phase, ctx) => {
		const claimed = new Map();
		// offered only to the reactions listening to a kind this op or this transaction touched (TG-4)
		const touchedKinds = ctx.op ? [ctx.op.kind] : [...new Set(changes.list().map((c) => c.kind))];
		for (const r of listeners(phase, touchedKinds)) {
			let call = ctx;
			if (ctx.op) { if (!opMatches(r.trigger, ctx.op, isCreated(ctx.op))) continue; }   // a per-op reaction, by its trigger (TG-2)
			else {
				// a transaction-phase reaction: called only if its trigger hears a change, and handed what it heard (TG-3) -- read
				// when it is called, so it hears what the reactions before it in the phase did
				const matches = changes.list().filter((c) => changeMatches(r.trigger, c));
				if (!matches.length) continue;
				call = { ...ctx, matches };
			}
			called.push(r.id);
			r.run(call, (emitted) => {
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
	const apply = (op, covered = false) => {
		if (op.op === 'del') {
			if (!proj.get(op.kind, op.id)) return;   // already gone -- accepted, no-op
			runPhase('clear', { op, doc: proj, changes });
		}
		track(proj, [op], out, inv, changes, covered);
		if (op.op === 'put') runPhase('follow', { op, doc: proj, changes });
	};
	// what a put would set off, asked without applying anything -- whether an unchanged put still does something
	const follows = (op) => {
		let n = 0;
		for (const r of listeners('follow', [op.kind])) if (opMatches(r.trigger, op, isCreated(op))) r.run({ op, doc: proj, changes }, (emitted) => { n += emitted.length; });
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
		const step = planOne(proj, ops[i], place, kinds);
		if (!step.ok) return { ok: false, error: step.error, opIndex: i };
		if (!step.op) continue;                                    // narrowed to nothing
		if (step.unchanged && !follows(step.op)) continue;         // an unchanged put that displaces nothing
		apply(step.op);
		if (step.then) apply(step.then, true);                     // its drawing order, when it came without -- undone with the put (F-d)
	}
	const ctx = { before: model, doc: proj, ops: out, changes, refuses: (op) => validateMutation(proj, asMutation(op), kinds) };
	for (const phase of PHASES) if (!PER_OP.has(phase)) runPhase(phase, ctx);
	// the tenants' refusals, on the result, each handed the changes its trigger hears (F-e)
	for (const r of refusals) {
		const matches = changes.list().filter((c) => changeMatches(r.trigger, c));
		if (!matches.length) continue;
		called.push(r.id);
		const why = r.refuse({ before: model, doc: proj, matches });
		if (why) return { ok: false, error: why, opIndex: -1 };
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
		// B271 -- by identity and measure, not sentence: a violation this transaction introduced, or made worse
		const before = new Map(violations(model, { groupAfterRemoval, facts: true }).map((v) => [v.key, v.measure]));
		const introduced = violations(proj, { groupAfterRemoval, facts: true }).filter((v) => !before.has(v.key) || v.measure > before.get(v.key));
		if (introduced.length) return { ok: false, error: introduced[0].sentence, opIndex: -1 };
	}
	return { ok: true, ops: out, inverse: inv, called };
}

/*
Phase 1 for one requested op: resolved, validated against the document as the ops before it left it, and narrowed to
what it changes. Answers the op to apply, or none; `unchanged` marks a put of an entity already present byte for byte.
*/
function planOne(model, op, place, kinds) {
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
		if (!place) return { ok: false, error: 'this composition resolves no placement: a place op needs a resolver (PL-4)' };
		const at = place(model, op.at || {});
		if (!at.ok) return { ok: false, error: at.error };
		op = { op: 'put', kind: op.kind, entity: { ...op.entity, x: at.x, y: at.y } };
	}

	if (!['put', 'set', 'del'].includes(op.op)) return { ok: false, error: `unknown op '${op.op}'` };
	const err = validateMutation(model, asMutation(op), kinds);
	if (err) return { ok: false, error: err };

	if (op.op === 'put') {
		const before = model.get(op.kind, op.entity.id);
		if (!before && model.all(op.kind).length >= kinds.row(op.kind).cap) return { ok: false, error: `${op.kind} collection limit reached` };
		const put = { op: 'put', kind: op.kind, entity: clone(op.kind, op.entity) };
		/*
		F-d (H18.6) -- AN ITEM KEEPS ITS DRAWING ORDER, and a creation without one is given one. A tab's factories stamp
		it (model/order.mjs); an agent's or the CLI's creation arrives without, and the planner gives it one above the
		highest of its kind in the document as this transaction has it, so it is drawn newest and is the youngest link. A
		put that replaces an item and omits it keeps the item's own -- a whole-entity put clearing a field must not move
		the item in the stack. Only for a kind whose row checks an `order`.

		As a SET after the put, never by rewriting it: the put the caller sent comes back as it was sent, so a tab knows
		its own echo, and the order arrives as a derived op on one field -- which lands under a drag without pulling the
		dragged item back (tests/b242-reconcile.test.js C4; rewriting the put did exactly that).
		*/
		let order;
		if (put.entity.order === undefined && kinds.row(op.kind).fields.order) {
			if (before?.order !== undefined) order = before.order;
			else if (!before) order = nextOrder(model, op.kind);
		}
		// a put that changes nothing once the item's own order is carried is no change, as it was before orders (I6)
		if (order !== undefined && before && same(before, { ...put.entity, order })) return { ok: true, op: put, unchanged: true };
		if (order !== undefined) return { ok: true, op: put, unchanged: false, then: { op: 'set', kind: op.kind, id: put.entity.id, patch: { order } } };
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
		const narrowed = narrow(op.kind, before, op.patch, kinds);
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
	const { now, extensions } = composition(options, 'commit');
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
	B270 -- EVERY REFUSAL BEFORE THE APPLY. A record extension's refusal (the caption limit, B220) was checked after the
	ops were applied and the version advanced, so a refusal left the edit in the document with no record. It is decided
	here, from the same planned ops, before anything is touched -- what the header's "rejection safety is by PURITY"
	requires.
	*/
	for (const x of extensions) {
		const error = x.refuse(request, planned);
		if (error) return { ok: false, error, version: log.version };
	}

	applyOps(model, planned.ops);                                    // the sole mutation point
	const from = log.version;
	const seq = ++log.version;
	stamp(model, log);                                               // D6: the document carries its own version
	/*
	PL-4 -- the record extensions (planner/edges.mjs): each answers its field's next value, which the core writes on the
	document's state and records with the value before, so undo and redo move it with the ops. Captured before and after
	and recorded only when it changed, so an ordinary commit's record is byte-identical to what it was before beats
	existed.
	*/
	const extended = [];
	for (const x of extensions) {
		const before = model.state[x.field] ? structuredClone(model.state[x.field]) : null;
		const next = x.next(model.state, request, planned, now);
		if (next !== undefined) model.state[x.field] = next;
		const after = model.state[x.field] ? structuredClone(model.state[x.field]) : null;
		if ((before !== null || after !== null) && JSON.stringify(before) !== JSON.stringify(after)) extended.push([x.field, after, before]);
	}

	const change = {
		seq, from, at: now(), by, actor,
		label: request.label || '',
		ops: planned.ops,
		inverse: planned.inverse,
	};
	// carried beside the ops rather than inside them: an extension's field is not a mutation of an entity, and applyOps is
	// the single writer for those
	for (const [field, after, before] of extended) {
		change[field] = after;
		change[`${field}Inverse`] = before;
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
export function undo(model, log, to = null, options = {}) {
	const { extensions, kinds } = composition(options, 'undo');
	sameKinds(model, kinds, 'undo');   // replays inverses of the kinds it was composed with (S-b)
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
	H14.7 -- an extension's field (the reveal) is reversed along with the ops, to the state before the OLDEST record in
	this run. Walking outward, the last inverse seen is the earliest one, which is why it is assigned rather than
	accumulated: undoing three beats at once restores what stood before all three, not what stood before the last.

	An absent entry means no record touched the field, and must not be mistaken for `null`, which means it was set to
	nothing.
	*/
	const restore = new Map();
	while (log.cursor > 0 && log.records[log.cursor - 1].seq >= target) {
		const rec = log.records[log.cursor - 1];
		ops.push(...rec.inverse);
		for (const { field } of extensions) if (`${field}Inverse` in rec) restore.set(field, rec[`${field}Inverse`]);
		log.cursor--;
	}
	if (!ops.length) return { ok: false, error: 'nothing to undo', version: log.version };
	applyOps(model, ops);
	for (const [field, to] of restore) model.state[field] = to ? structuredClone(to) : null;
	log.version++;
	stamp(model, log);
	return { ok: true, ops, version: log.version };
}

export function redo(model, log, options = {}) {
	const { extensions, kinds } = composition(options, 'redo');
	sameKinds(model, kinds, 'redo');
	if (!log.canRedo()) return { ok: false, error: 'nothing to redo', version: log.version };
	const record = log.records[log.cursor];
	applyOps(model, record.ops);
	// H14.7 -- and each extension's field forward again, or redoing a beat would restore its entities while leaving them
	// permanently hidden by the record undo had already rolled back
	for (const { field } of extensions) if (field in record) model.state[field] = record[field] ? structuredClone(record[field]) : null;
	log.cursor++;
	log.version++;
	stamp(model, log);
	return { ok: true, ops: record.ops, version: log.version };
}
