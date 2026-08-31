/*
Validation — janitor-lite gate at the server boundary (prism L1Janitor lineage,
radically narrowed). The server never trusts the wire: every mutation and every
pushed document is validated for shape, ranges, and referential integrity.
*/

import { NODE_EXT, ZONE_EXT, SELECTABLE_KINDS } from '../model/index.mjs';
import { OPTIONAL } from '../model/shape.mjs';
import { linkReferential, groupReferential, waypointOwners } from '../model/referential.mjs';
import { NAME_MAX, CONTENT_VALUE_MAX, SPAN_MAX } from '../model/limits.mjs';
import { LAYOUTS, onLayout, STD } from '../kernel/index.mjs';
import { collectionCap } from '../engine/policy.mjs';

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
const ID = /^(node|waypoint|link|zone|group|diagram|template)-[0-9a-f]{6}$/;

/*
The DOCUMENT-level ids, exported, because more than one place needs to recognise one.

`server/app.js` matched deep links with its own copy of this pattern -- `/^\/d\/diagram-[0-9a-f]{6}$/`
-- and never learned about templates, so refreshing the browser on a template fell through to a file
lookup and answered 404. A restated grammar is a grammar that goes out of date somewhere, and this
one did so in the exact way H9.9 was careful to avoid everywhere else.
*/
export const DOCUMENT_ID = /^(diagram|template)-[0-9a-f]{6}$/;
// DERIVED from the model's list, which used to be pinned to this line by a comment reading
// "MUST match server/validate.js SELECTABLE" -- a comment doing a check's job (B86).
const SELECTABLE = new RegExp(`^(${SELECTABLE_KINDS.join('|')})-[0-9a-f]{6}$`);
const KINDS = ['node', 'waypoint', 'link', 'zone', 'group'];
const ACTIONS = ['put', 'set', 'del'];
const SHAPES = ['circle', 'square']; // the node frame (outer shell), independent of `type`
// center-origin coordinates: [0,0] is the canvas/slide center
/*
B113 -- the server bounds what the client clamps to, and until now it did not.

`validate` allowed a node anywhere inside the SURFACE half-extent (960 x 540) while `app/src/snap.js`
clamped one to NODE_EXT (900 x 480), so a hundred positions were legal to the server and unreachable
in the editor. Same family as B110: a limit the browser applied and the trust boundary did not, with
the agent door as the caller nobody bound. Nothing live sat outside the client clamp -- max |x| 840,
max |y| 480 across the estate -- so tightening costs nothing and removes the divergence.

Magnitudes sourced from the document substrate; the num() bound CHECKS below stay LOCAL (the trust
boundary is never delegated).
*/
const EXT = NODE_EXT;                          // nodes and waypoints keep a full margin cell
const ZEXT = ZONE_EXT;                         // zones reach within half a cell

/*
B110 -- geometry is a RULE, enforced here, not a courtesy the browser performs.

Snapping lived only in `app/src/snap.js`, so it ran before a human's commit and never before an
agent's. Every write through the agent door landed wherever it liked and nothing reported it: 8 of
9 nodes in the first agent-drawn diagram were off-pitch, and one zone was off the half-pitch offset
that zones use -- a rule its author did not know existed.

Not cosmetic, which is why it is at the trust boundary rather than in a linter. `engine/relations.mjs`
guarantees cell-equality is px-equality ONLY ON GRID OPERANDS, and `cellOf` is Math.round(v/pitch),
so `cellOf(-270)` and `cellOf(-240)` are both cell -4. Off-pitch entities collide in the R13
occupancy index while looking distinct on screen, and `atCell` then answers with the wrong one.

REFUSING rather than snapping, ruled 2026-08-23. Snapping would silently move an agent's work and
leave it believing it drew something it did not; a refusal says which op was wrong (B103) and
teaches the rule once. This is an engineer's tool, so the geometry is a constraint rather than an
aesthetic preference.

The PITCH is sourced, the CHECK is local -- the same split the surface extents already use. The
trust boundary is never delegated to the module that supplies the magnitude.
*/
// B111: the LAYOUT is sourced, the CHECK stays local -- the same split the surface extents use.
// This file restated the half-pitch offset when B110 landed, which made the kernel's silence about
// the zone grid into a second implementation of it rather than a gap.
const PITCH = STD.pitch;
const onGrid = (name, v) => onLayout(LAYOUTS[name], v);

// B113: the cap has ONE owner. engine/policy.mjs already declares itself the authority for a
// threshold (B85), and this was stated twice at 2000 -- here and in txn.mjs -- which is one number
// too many the moment either becomes derived.
const CAP = collectionCap({ nodeExt: NODE_EXT, zoneExt: ZONE_EXT, pitch: PITCH });

const str = (v, max) => typeof v === 'string' && v.length <= max;
const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const id = (v, kind) => typeof v === 'string' && ID.test(v) && v.startsWith(kind + '-');
// a node's multi-cell footprint: {cols,rows} positive integer cell counts (no extra keys). 64 ≫ the
// surface in cells (32×18) — a generous cap; the anchor x/y range-check keeps the node on-surface.
const dims = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
	&& int(v.cols, 1, SPAN_MAX) && int(v.rows, 1, SPAN_MAX)
	&& Object.keys(v).every((k) => k === 'cols' || k === 'rows');
// a node CONTENT region (W2): a text|glyph in a merged socket sub-grid. All free strings are constrained
// for SVG-attribute safety — colours hex-only, glyph [a-z0-9-], text length-capped (rendered escaped).
const color = (v) => typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v);
const REGION = {
	at: (v) => Array.isArray(v) && v.length === 2 && v.every((n) => int(n, 0, SPAN_MAX)),
	cols: (v) => int(v, 1, SPAN_MAX),
	rows: (v) => int(v, 1, SPAN_MAX),
	content: (v) => v === 'text' || v === 'glyph',
	value: (v) => str(v, CONTENT_VALUE_MAX),
	glyph: (v) => str(v, 32) && /^[a-z0-9-]+$/.test(v),
	align: (v) => v === 'left' || v === 'center' || v === 'right',
	outline: (v) => typeof v === 'boolean',
	bg: color, accent: color, fill: color,
	rx: (v) => num(v, 0, 30),
	action: (v) => str(v, 32) && /^[a-z0-9-]+$/.test(v),   // W5 — a clickable button: a safe action identifier
	input: (v) => typeof v === 'boolean'   // W6 — an editable input region (type into it, in run mode)
};
const region = (r) => !!r && typeof r === 'object' && !Array.isArray(r)
	&& (r.content === 'text' || r.content === 'glyph')   // the region kind is required
	&& Object.keys(r).every((k) => Object.hasOwn(REGION, k) && REGION[k](r[k]));
const content = (v) => Array.isArray(v) && v.length <= 200 && v.every(region);

// per-kind field validators; `full` requires every field, otherwise subset (for set)
const FIELDS = {
	node: {
		id: (v) => id(v, 'node'),
		name: (v) => str(v, NAME_MAX),
		type: (v) => str(v, 32) && /^[a-z0-9-]+$/.test(v),
		shape: (v) => SHAPES.includes(v),
		x: (v) => num(v, -EXT.x, EXT.x) && onGrid('node', v),
		y: (v) => num(v, -EXT.y, EXT.y) && onGrid('node', v),
		span: (v) => dims(v),    // optional multi-cell footprint (W1); absent ⇒ 1×1
		content: (v) => content(v)   // optional content regions (W2); absent ⇒ the type glyph
	},
	waypoint: {
		id: (v) => id(v, 'waypoint'),
		x: (v) => num(v, -EXT.x, EXT.x) && onGrid('node', v),   // a waypoint IS a node for placement
		y: (v) => num(v, -EXT.y, EXT.y) && onGrid('node', v),
		/*
		B162 -- INTENT, and the only thing about a waypoint worth storing.

		Its ROLE is derived and never written down: in a link's `via` it is a bend, at `src`/`dst`
		of an open link an endpoint, at `src`/`dst` of a CLOSED link a bend again because a ring has
		no ends, and referenced nowhere an orphan. A stored role would be a twin of the links, to be
		rewritten every time a path is closed and wrong the first time that is missed.

		What cannot be derived is a waypoint placed deliberately with no link at all -- there is no
		structure to read an intention off. `pinned` says the author meant it to exist, so the sweep
		leaves it alone. Threading a link through it clears the pin: from then on it is part of that
		link's shape and shares its fate.
		*/
		pinned: (v) => typeof v === 'boolean'
	},
	link: {
		id: (v) => id(v, 'link'),
		src: (v) => id(v, 'node') || id(v, 'waypoint'),   // endpoint = node OR waypoint
		dst: (v) => id(v, 'node') || id(v, 'waypoint'),
		via: (v) => Array.isArray(v) && v.length <= 500 && v.every((m) => id(m, 'waypoint')),
		closed: (v) => typeof v === 'boolean'             // a routed link looped dst → src (render-only)
	},
	zone: {
		id: (v) => id(v, 'zone'),
		name: (v) => str(v, NAME_MAX),
		// the zone grid is offset by half a pitch: a zone bounds CELLS, so its edges fall between them
		x: (v) => num(v, -ZEXT.x, ZEXT.x) && onGrid('zone', v),
		y: (v) => num(v, -ZEXT.y, ZEXT.y) && onGrid('zone', v),
		w: (v) => num(v, PITCH, 2 * ZEXT.x) && onGrid('node', v), // whole cells; minimum one — no degenerate zones
		h: (v) => num(v, PITCH, 2 * ZEXT.y) && onGrid('node', v)
	},
	group: {
		id: (v) => id(v, 'group'),
		name: (v) => str(v, NAME_MAX),
		members: (v) => Array.isArray(v) && v.length <= 500 && v.every((m) => id(m, 'node') || id(m, 'waypoint'))
	}
};

/*
OPTIONAL is IMPORTED, not restated (B86).

Fields that may be omitted even in a full (put / doc-load) validation: documents written before the
field existed must still load. Absent means the renderer's default (node.shape -> 'circle'); new
writes that include the field are still range-checked.

`model/shape.mjs` has claimed since it was written that it superseded "the OPTIONAL map in
server/validate.js", and the map was still here and still the one consulted -- while `server/txn.mjs`
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

export function validateEntity(kind, entity, { full = true } = {}) {
	const fields = Object.hasOwn(FIELDS, kind) ? FIELDS[kind] : null;
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
		const optional = OPTIONAL[kind];
		for (const key of Object.keys(fields)) {
			if (!(key in entity) && !(optional && optional.has(key))) return `missing field ${kind}.${key}`;
		}
	}
	return null;
}

// mutation = { action: 'put'|'set'|'del', kind, entity }
export function validateMutation(model, mutation) {
	if (!mutation || typeof mutation !== 'object') return 'mutation is not an object';
	const { action, kind, entity } = mutation;
	if (!ACTIONS.includes(action)) return `unknown action: ${action}`;
	if (!KINDS.includes(kind)) return `unknown kind: ${kind}`;
	if (action === 'del') {
		// full id-format check: '__proto__' etc. must never reach the model
		return (entity && typeof entity === 'object' && id(entity.id, kind))
			? null : 'del requires a valid entity.id';
	}
	const err = validateEntity(kind, entity, { full: action === 'put' });
	if (err) return err;

	/*
	Referential integrity, against the CURRENT model state and under a post-merge view for `set`.

	The rules themselves live in `model/referential.mjs` and are shared with `validateDoc`, which
	used to carry a second hand-written copy of all five (B83). What stays here is the part that is
	genuinely about MUTATION: merging the patch over the stored entity, so a `set` that touches only
	`via` is still checked against the `src` and `dst` it is keeping.
	*/
	const access = {
		hasNode: (eid) => !!model.get('node', eid),
		hasWaypoint: (eid) => !!model.get('waypoint', eid),
		// built ONCE per mutation. This was a rescan of every link for every waypoint, which is
		// O(waypoints x links) on each write for a predicate that does not change within the call.
		ownersOf: (() => {
			let owners = null;
			return (w) => (owners ??= waypointOwners(model.all('link'))).get(w) || [];
		})(),
	};
	if (kind === 'link') {
		const current = model.get('link', entity.id) || {};
		const merged = { id: entity.id, src: entity.src ?? current.src, dst: entity.dst ?? current.dst,
			via: entity.via ?? current.via ?? [] };
		const err = linkReferential(merged, access);
		if (err) return err;
	}
	if (kind === 'group' && entity.members) {
		const err = groupReferential(entity, access);
		if (err) return err;
	}
	return null;
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
export function validateDoc(doc) {
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
	if ('schema' in doc.meta && doc.meta.schema !== 1) return `unsupported meta.schema: ${doc.meta.schema}`;
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
	const collections = { node: 'nodes', waypoint: 'waypoints', link: 'links', zone: 'zones', group: 'groups' };
	for (const [kind, key] of Object.entries(collections)) {
		const list = doc[key] || [];
		if (!Array.isArray(list)) return `${key} is not an array`;
		if (list.length > CAP[kind]) return `${key} exceeds entity limit`;
		for (const entity of list) {
			const err = validateEntity(kind, entity, { full: true });
			if (err) return err;
			if (seen.has(entity.id)) return `duplicate id: ${entity.id}`;
			seen.add(entity.id);
		}
	}
	/*
	Referential integrity within the document -- the SAME five rules the mutation path applies,
	from `model/referential.mjs`, reached through a lookup over these arrays instead of a Model.

	This block used to be a second hand-written implementation of all of them, with its own error
	vocabulary and its own complexity class (B83). Nothing forced the pair to agree, and a
	disagreement means a document the wire refuses can be loaded from disk, or the reverse.
	*/
	const nodeIds = new Set((doc.nodes || []).map((n) => n.id));
	const waypointIds = new Set((doc.waypoints || []).map((w) => w.id));
	const owners = waypointOwners(doc.links || []);
	const access = {
		hasNode: (eid) => nodeIds.has(eid),
		hasWaypoint: (eid) => waypointIds.has(eid),
		ownersOf: (w) => owners.get(w) || [],
	};
	for (const link of doc.links || []) {
		const err = linkReferential(link, access);
		if (err) return `${err} (${link.id})`;
	}
	for (const group of doc.groups || []) {
		const err = groupReferential(group, access);
		if (err) return `${err} (${group.id})`;
	}
	// model-state (status): shape-validate the persisted selection key if present. Tolerate-stale by
	// design — see validateSelectionIds. (MS1)
	if ('selection' in doc) {
		const err = validateSelectionIds(doc.selection);
		if (err) return err;
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
export function validateSelectionIds(ids) {
	if (!Array.isArray(ids)) return 'selection is not an array';
	if (ids.length > 10000) return 'selection exceeds limit';
	for (const sid of ids) {
		if (typeof sid !== 'string' || !SELECTABLE.test(sid)) return `invalid selection id: ${sid}`;
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
