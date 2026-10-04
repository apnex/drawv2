/*
Validation — janitor-lite gate at the server boundary (prism L1Janitor lineage,
radically narrowed). The server never trusts the wire: every mutation and every
pushed document is validated for shape, ranges, and referential integrity.
*/

import { NAME_MAX, CAPTION_MAX } from '../model/limits.mjs';
// H17.22 N-a: every kind is a ROW -- its field checks, its cross-entity check and its cap travel with it (planner/kinds.mjs).
// Validation reads the composition it is handed, the product's when nothing else is passed (no links since S-e: a caller that
// validates links passes the network's composition, as the store does).
import { PRODUCT_KINDS } from './kinds.mjs';
import { SCHEMA } from '../model/shape.mjs';   // the document generation, one owner (H18.3)

// A principal is `user:<email>` or `code:<id>`, namespaced so the two kinds can never be
// confused for one another. Length-capped like every other free string the wire accepts.
/*
A principal is a durable IDENTITY. H9.4b: `code:` was here and is not a principal -- a connection
code is a CREDENTIAL that authenticates as an `agent:` identity, and conflating the two meant
revoking a code destroyed an owner, rotating one lost every grant, and a code could not be reused
across diagrams because the code WAS the grant. ACCESS.md's 2026-08-21 amendment rules the split.

The agent grammar is deliberately narrow, and narrowing later is the change you cannot make.
Lowercase only, because `agent:Planner` and `agent:planner` as distinct principals is a confusion
attack rather than a convenience -- the domain allowlist already case-folds for the same reason.
No colon, so the namespace prefix stays unambiguous. Sixty-three characters and a leading
alphanumeric, which is the DNS label shape and therefore already familiar to anyone naming one.
*/
const PRINCIPAL = /^(user:[^\s@]{1,64}@[^\s@]{1,190}|agent:[a-z0-9][a-z0-9-]{0,62})$/;
/*
`template` is a document-level kind alongside `diagram`, not an entity kind (H9.9).

A template is read from the image, never written to the store, and forks on first write. Putting it
in the ID GRAMMAR rather than tracking it beside the id is the whole design decision: `kindOf` is
`id.split('-')[0]`, so a template announces itself everywhere for free, and any path that does not
handle one is refused here rather than treating it as an ordinary diagram.

The alternative -- templates carrying `diagram-` ids, told apart by a lookup -- was measured and
rejected. It needed a branch in roughly fifteen store methods, and a path that FORGOT the branch
would have failed silently: `remove` deleting a file that lives in the image, `grant` handing out
access to something with no owner, `commit` writing where there is nowhere to write. Here, a
forgotten path fails loudly on an unknown kind, which is the difference that decided it.
*/
/*
H17.22 N-a -- THE ID GRAMMAR IS BUILT FROM THE ROWS (amending C3's pin of a literal, ruled 2026-10-02): an id is an
entity id when some composed kind's row accepts it, so a plugin's kind -- the network's `pipe`, whose id is its two
anchors' hex -- is an id exactly where it is composed. The document ids stay `DOCUMENT_ID`, below; together the two are
what this file's one literal, `/^(node|waypoint|link|zone|group|diagram|template)-[0-9a-f]{6}$/`, accepted.
*/
const isEntityId = (kinds, v) => typeof v === 'string' && kinds.list.some((k) => kinds.row(k).fields.id(v));
const isId = (kinds, v) => isEntityId(kinds, v) || DOCUMENT_ID.test(v || '');

/*
The DOCUMENT-level ids, exported, because more than one place needs to recognise one.

`server/app.js` matched deep links with its own copy of this pattern -- `/^\/d\/diagram-[0-9a-f]{6}$/`
-- and never learned about templates, so refreshing the browser on a template fell through to a file
lookup and answered 404. A restated grammar is a grammar that goes out of date somewhere, and this
one did so in the exact way H9.9 was careful to avoid everywhere else.
*/
export const DOCUMENT_ID = /^(diagram|template)-[0-9a-f]{6}$/;
// DERIVED from the composition's selectable rows, which used to be a list pinned to this file by a comment reading
// "MUST match planner/validate.js SELECTABLE" -- a comment doing a check's job (B86)
const isSelectableId = (kinds, v) => typeof v === 'string' && kinds.selectable.some((k) => kinds.row(k).fields.id(v));
const ACTIONS = ['put', 'set', 'del'];
const str = (v, max) => typeof v === 'string' && v.length <= max;

/*
OPTIONAL is IMPORTED, not restated (B86).

Fields that may be omitted even in a full (put / doc-load) validation: documents written before the
field existed must still load. Absent means the renderer's default (node.shape -> 'circle'); new
writes that include the field are still range-checked.

`model/shape.mjs` has claimed since it was written that it superseded "the OPTIONAL map in
planner/validate.js", and the map was still here and still the one consulted -- while `planner/txn.mjs`
imported the shape.mjs version and never used it, so the tree LOOKED single-sourced from every angle
except the one that mattered. The imported map also carries the three kinds this one omitted, which
the consuming loop already tolerated either way (`optional && optional.has(key)`).

/*
H9.4d: `grant()` needs this and must not carry its own copy.

Grants bypass `commit()` deliberately -- undo silently restoring access for a principal just
revoked would be a security failure -- so they also bypass every validator that runs on the commit
path, and `validateDoc` is the only thing that judged a grant principal. That was harmless while
nothing could write one. Exposing the administration surface makes it live: a malformed principal
would persist, and the diagram would then REFUSE TO LOAD at the next boot, because validateDoc
rejects on the way in. A write that bricks a document at some later restart is the worst shape a
defect can have, so the grammar is checked before the write, from the same regex.
*/
export function validPrincipal(s) {
	return typeof s === 'string' && PRINCIPAL.test(s);
}

export function validateEntity(kind, entity, { full = true, kinds = PRODUCT_KINDS } = {}) {
	const fields = typeof kind === 'string' && kinds.has(kind) ? kinds.row(kind).fields : null;
	if (!fields) return `unknown kind: ${kind}`;
	if (!entity || typeof entity !== 'object' || Array.isArray(entity)) return 'entity is not an object';
	if (!fields.id(entity.id)) return `invalid id for ${kind}: ${entity.id}`;
	for (const key of Object.keys(entity)) {
		// hasOwn: inherited names (__proto__, constructor, toString...) must not
		// resolve through the prototype chain — that both bypasses validation and crashes
		if (!Object.hasOwn(fields, key)) return `unknown field ${kind}.${key}`;
		if (!fields[key](entity[key])) return `invalid value for ${kind}.${key}`;
	}
	if (full) {
		const optional = kinds.optional[kind];
		for (const key of Object.keys(fields)) {
			if (!(key in entity) && !(optional && optional.has(key))) return `missing field ${kind}.${key}`;
		}
	}
	return null;
}

// mutation = { action: 'put'|'set'|'del', kind, entity }
export function validateMutation(model, mutation, kinds = PRODUCT_KINDS) {
	if (!mutation || typeof mutation !== 'object') return 'mutation is not an object';
	const { action, kind, entity } = mutation;
	if (!ACTIONS.includes(action)) return `unknown action: ${action}`;
	if (typeof kind !== 'string' || !kinds.has(kind)) return `unknown kind: ${kind}`;
	const row = kinds.row(kind);
	if (action === 'del') {
		// full id-format check: '__proto__' etc. must never reach the model
		return (entity && typeof entity === 'object' && row.fields.id(entity.id))
			? null : 'del requires a valid entity.id';
	}
	const err = validateEntity(kind, entity, { full: action === 'put', kinds });
	if (err) return err;

	/*
	Referential integrity, against the CURRENT model state and under a post-merge view for `set`.

	The rules themselves live in each kind's row -- the link's in `network/link-references.mjs` since S-e -- and are shared with `validateDoc`, which
	used to carry a second hand-written copy of all five (B83). What stays here is the part that is
	genuinely about MUTATION: merging the patch over the stored entity, so a `set` that touches only
	`via` is still checked against the `src` and `dst` it is keeping.
	*/
	if (!row.refers) return null;
	/*
	S-e (H18.15) -- ONE GENERIC ACCESS, naming no kind: whether an entity exists, the entity, and every entity of a kind. It
	carried four questions of the link's own (`hasNode`, `hasWaypoint`, `ownersOf`, `linkById`) and built the link's owners
	index; the link's row builds those from this, once per access (network/link-references.mjs `linkAccess`).
	*/
	const access = {
		has: (k, eid) => kinds.has(k) && !!model.get(k, eid),
		get: (k, eid) => (kinds.has(k) ? model.get(k, eid) : undefined),
		all: (k) => (kinds.has(k) ? model.all(k) : []),
	};
	// the kind's own cross-entity check (its row), judged on the entity as it would stand -- a `set` merged over what is
	// stored -- and told what the op carried; it was two hard-coded branches here, for the link and the group (N-a)
	const before = model.get(kind, entity.id) ?? null;
	// a `put` stands as it is put -- merging it over the stored entity would keep a field the put removed (F-c: a typed node
	// put without its type)
	return row.refers(action === 'put' ? entity : { ...(before ?? {}), ...entity }, access, entity, before);
}

// full document validation (push / load from disk)
/*
`doc`, not `model`, and the difference is the point -- H5.7/B95.

Two things in this system, and one spelling for each. A **Model** is the live object: indices,
selection, mutation methods, the thing the editor holds. A **doc** is the flat JSON that comes off
disk and goes over the wire, produced by `model.toJSON()` and consumed by `Model.load()`.

H5 renamed the substrate directory `document/` to `model/` because that one word was covering three
concepts -- the substrate, the browser global, and a persisted diagram -- and deliberately did NOT
rename `doc`, `docfile` or this function, because those name the serialized form specifically.

So this is not a leftover. Validation exists ONLY at the serialization boundary: a document arriving
from disk at boot, or a `create {doc}` arriving from the wire. Nothing validates a live Model, and a
`validateModel` would therefore name something that does not happen. Every call site takes `parse()`
output; a Model has never reached this function and should not.
*/
export function validateDoc(doc, { kinds = PRODUCT_KINDS } = {}) {
	if (!doc || typeof doc !== 'object') return 'doc is not an object';
	if (!doc.meta || typeof doc.meta !== 'object') return 'invalid meta';
	// a document is a diagram or a template; both validate identically, and which one it is comes
	// from the id rather than from where the caller happened to read it
	if (!DOCUMENT_ID.test(doc.meta.id || '')) {
		return 'invalid meta.id';
	}
	if (!str(doc.meta.name || '', NAME_MAX)) return 'invalid meta.name';
	for (const key of Object.keys(doc.meta)) {
		if (!['id', 'name', 'version', 'schema', 'owner', 'grants'].includes(key)) return `unknown meta key: ${key}`;
	}
	if ('schema' in doc.meta && doc.meta.schema !== SCHEMA) return `unsupported meta.schema: ${doc.meta.schema}`;
	if ('version' in doc.meta && !(Number.isInteger(doc.meta.version) && doc.meta.version >= 0)) return 'invalid meta.version';
	/*
	Authorization, validated as strictly as geometry -- ACCESS.md.

	A principal is namespaced so the two kinds cannot be confused: `user:<email>` for a Google
	identity from IAP, `agent:<name>` for an agent identity. An unprefixed string is refused rather
	than guessed at, because guessing is how a code becomes a user.

	`owner` may be empty, which means unowned -- the state of every diagram predating H9.
	*/
	if ('owner' in doc.meta && doc.meta.owner !== '' && !PRINCIPAL.test(doc.meta.owner || '')) {
		return 'invalid meta.owner';
	}
	if ('grants' in doc.meta) {
		const grants = doc.meta.grants;
		if (!grants || typeof grants !== 'object' || Array.isArray(grants)) return 'invalid meta.grants';
		for (const [principal, level] of Object.entries(grants)) {
			if (!PRINCIPAL.test(principal)) return `invalid grant principal: ${principal}`;
			if (level !== 'read' && level !== 'write') return `invalid grant level for ${principal}: ${level}`;
		}
	}


	const seen = new Set();
	for (const kind of kinds.list) {
		const key = kinds.collection[kind];
		const list = doc[key] || [];
		if (!Array.isArray(list)) return `${key} is not an array`;
		if (list.length > kinds.row(kind).cap) return `${key} exceeds entity limit`;
		for (const entity of list) {
			const err = validateEntity(kind, entity, { full: true, kinds });
			if (err) return err;
			if (seen.has(entity.id)) return `duplicate id: ${entity.id}`;
			seen.add(entity.id);
		}
	}
	/*
	Referential integrity within the document -- the SAME five rules the mutation path applies,
	from each kind's row (the link's `network/link-references.mjs` since S-e), reached through a lookup over these arrays instead of a Model.

	This block used to be a second hand-written implementation of all of them, with its own error
	vocabulary and its own complexity class (B83). Nothing forced the pair to agree, and a
	disagreement means a document the wire refuses can be loaded from disk, or the reverse.
	*/
	// the same generic access as the mutation path's (S-e), over these arrays: each kind indexed by id once
	const byKind = Object.fromEntries(kinds.list.map((k) => [k, new Map((doc[kinds.collection[k]] || []).map((e) => [e.id, e]))]));
	const access = {
		has: (k, eid) => !!byKind[k]?.has(eid),
		get: (k, eid) => byKind[k]?.get(eid),
		all: (k) => [...(byKind[k]?.values() ?? [])],
	};
	// each kind's own cross-entity check, from its row, in the order the composition lists its kinds (N-a)
	for (const kind of kinds.list) {
		const row = kinds.row(kind);
		if (!row.refers) continue;
		for (const entity of doc[kinds.collection[kind]] || []) {
			const err = row.refers(entity, access, entity, null);
			if (err) return `${err} (${entity.id})`;
		}
	}
	// model-state (status): shape-validate the persisted selection key if present. Tolerate-stale by
	// design — see validateSelectionIds. (MS1)
	if ('selection' in doc) {
		const err = validateSelectionIds(doc.selection, kinds);
		if (err) return err;
	}
	/*
	H14.4 -- the reveal, GATED rather than tolerated.

	Unlike the selection key above, a malformed reveal is refused. Selection is tolerate-stale
	because a dangling id there costs nothing -- the model reconciles it on load. A reveal drives
	what a viewer SEES, so a bad interval or a non-id in the list is a document that renders wrong
	rather than a document missing a highlight, and the two peers would disagree about which.

	A beat naming an entity that no longer exists is NOT malformed and passes here: that is a stale
	beat, and `model/reveal.mjs` answers by not revealing it. The shape is the contract; whether the
	entities still exist is the document's business and changes under the record all the time.
	*/
	if ('reveal' in doc && doc.reveal !== null) {
		const r = doc.reveal;
		if (!r || typeof r !== 'object' || Array.isArray(r)) return 'invalid reveal';
		if (!Number.isFinite(r.origin)) return 'invalid reveal.origin';
		if (!Array.isArray(r.beats)) return 'invalid reveal.beats';
		for (const key of Object.keys(r)) {
			if (!['origin', 'beats'].includes(key)) return `unknown reveal key: ${key}`;
		}
		for (const beat of r.beats) {
			if (!beat || typeof beat !== 'object' || Array.isArray(beat)) return 'invalid beat';
			for (const key of Object.keys(beat)) {
				if (!['interval', 'caption', 'ids'].includes(key)) return `unknown beat key: ${key}`;
			}
			if (!Number.isInteger(beat.interval) || beat.interval < 0) return 'invalid beat.interval';
			// B220 -- a caption is prose, not an identifier. NAME_MAX is 64, which refused a
			// 105-character narration the commit path had already accepted and stored.
			if ('caption' in beat && !str(beat.caption, CAPTION_MAX)) return 'invalid beat.caption';
			if (!Array.isArray(beat.ids)) return 'invalid beat.ids';
			for (const id of beat.ids) if (!isId(kinds, id || '')) return `invalid beat id: ${id}`;
		}
	}
	// the change log (store-owned) is TOLERATED, never gated: a malformed or truncated log costs
	// undo history, but rejecting the doc for it would make the whole diagram vanish on boot
	// (the store skips invalid docs at load). Log.from drops what it cannot read. Same rationale
	// as the selection key above.
	return null;
}

// model-state (status): the persisted selection is SHAPE-validated only — NEVER existence-checked.
// A selected entity may have been deleted (the common case); rejecting the doc for that would make
// the diagram vanish on boot (store skips invalid docs at load). Stale ids load, then reconcile
// away (Model.load filter + Model.del net). (MS1)
export function validateSelectionIds(ids, kinds = PRODUCT_KINDS) {
	if (!Array.isArray(ids)) return 'selection is not an array';
	if (ids.length > 10000) return 'selection exceeds limit';
	for (const sid of ids) {
		if (typeof sid !== 'string' || !isSelectableId(kinds, sid)) return `invalid selection id: ${sid}`;
	}
	return null;
}

// meta patch from the client: only `name` is writable
export function validateMetaPatch(patch) {
	if (!patch || typeof patch !== 'object') return 'patch is not an object';
	for (const key of Object.keys(patch)) {
		if (key === 'name') {
			if (!str(patch.name, NAME_MAX) || patch.name.trim() === '') return 'invalid name';
		} else {
			return `meta.${key} is not writable`;
		}
	}
	return null;
}
