/*
Validation — janitor-lite gate at the server boundary (prism L1Janitor lineage,
radically narrowed). The server never trusts the wire: every mutation and every
pushed document is validated for shape, ranges, and referential integrity.
*/

import { SURFACE } from '../model/index.mjs';

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
const ID = /^(node|waypoint|link|zone|group|diagram)-[0-9a-f]{6}$/;
const SELECTABLE = /^(node|waypoint|link|zone)-[0-9a-f]{6}$/;   // selectable kinds (group/diagram excluded)
const KINDS = ['node', 'waypoint', 'link', 'zone', 'group'];
const ACTIONS = ['put', 'set', 'del'];
const SHAPES = ['circle', 'square']; // the node frame (outer shell), independent of `type`
// center-origin coordinates: [0,0] is the canvas/slide center
const EXT = { x: SURFACE.hw, y: SURFACE.hh };   // magnitude sourced from the document substrate; the num() bound CHECKS below stay LOCAL (trust boundary, never delegated)

const str = (v, max) => typeof v === 'string' && v.length <= max;
const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const id = (v, kind) => typeof v === 'string' && ID.test(v) && v.startsWith(kind + '-');
// a node's multi-cell footprint: {cols,rows} positive integer cell counts (no extra keys). 64 ≫ the
// surface in cells (32×18) — a generous cap; the anchor x/y range-check keeps the node on-surface.
const dims = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
	&& int(v.cols, 1, 64) && int(v.rows, 1, 64)
	&& Object.keys(v).every((k) => k === 'cols' || k === 'rows');
// a node CONTENT region (W2): a text|glyph in a merged socket sub-grid. All free strings are constrained
// for SVG-attribute safety — colours hex-only, glyph [a-z0-9-], text length-capped (rendered escaped).
const color = (v) => typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v);
const REGION = {
	at: (v) => Array.isArray(v) && v.length === 2 && v.every((n) => int(n, 0, 64)),
	cols: (v) => int(v, 1, 64),
	rows: (v) => int(v, 1, 64),
	content: (v) => v === 'text' || v === 'glyph',
	value: (v) => str(v, 256),
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
		name: (v) => str(v, 64),
		type: (v) => str(v, 32) && /^[a-z0-9-]+$/.test(v),
		shape: (v) => SHAPES.includes(v),
		x: (v) => num(v, -EXT.x, EXT.x),
		y: (v) => num(v, -EXT.y, EXT.y),
		span: (v) => dims(v),    // optional multi-cell footprint (W1); absent ⇒ 1×1
		content: (v) => content(v)   // optional content regions (W2); absent ⇒ the type glyph
	},
	waypoint: {
		id: (v) => id(v, 'waypoint'),
		x: (v) => num(v, -EXT.x, EXT.x),
		y: (v) => num(v, -EXT.y, EXT.y)
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
		name: (v) => str(v, 64),
		x: (v) => num(v, -EXT.x, EXT.x),
		y: (v) => num(v, -EXT.y, EXT.y),
		w: (v) => num(v, 60, 2 * EXT.x), // minimum one grid cell — no degenerate zones
		h: (v) => num(v, 60, 2 * EXT.y)
	},
	group: {
		id: (v) => id(v, 'group'),
		name: (v) => str(v, 64),
		members: (v) => Array.isArray(v) && v.length <= 500 && v.every((m) => id(m, 'node') || id(m, 'waypoint'))
	}
};

// fields that may be omitted even in a full (put / doc-load) validation: documents
// written before the field existed must still load. Absent → the renderer's default
// (node.shape → 'circle'). New writes that include the field are still range-checked.
const OPTIONAL = { node: new Set(['shape', 'span', 'content']), link: new Set(['via', 'closed']) };

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

	// referential integrity against current model state (post-merge view for set)
	if (kind === 'link') {
		const current = model.get('link', entity.id) || {};
		const src = entity.src ?? current.src;
		const dst = entity.dst ?? current.dst;
		const ep = (eid) => model.get('node', eid) || model.get('waypoint', eid);
		if (!ep(src)) return `link src does not exist: ${src}`;
		if (!ep(dst)) return `link dst does not exist: ${dst}`;
		if (src === dst) return 'link src and dst are the same endpoint';
		const via = entity.via ?? current.via ?? [];
		for (const w of via) if (!model.get('waypoint', w)) return `link via waypoint does not exist: ${w}`;
		// XOR occupancy: every waypoint this link touches (endpoint or via) must belong to no OTHER
		// link, and to one role within this link — a waypoint participates in at most one link.
		const refs = [src, dst, ...via].filter((eid) => model.get('waypoint', eid));
		if (new Set(refs).size !== refs.length) return 'link uses a waypoint in two roles';
		for (const w of refs) {
			for (const other of model.all('link')) {
				if (other.id === entity.id) continue;
				if (other.src === w || other.dst === w || (Array.isArray(other.via) && other.via.includes(w))) {
					return `waypoint already in use by another link: ${w}`;
				}
			}
		}
	}
	if (kind === 'group' && entity.members) {
		for (const m of entity.members) {
			if (!model.get('node', m) && !model.get('waypoint', m)) return `group member does not exist: ${m}`;
		}
	}
	return null;
}

// full document validation (push / load from disk)
export function validateDoc(doc) {
	if (!doc || typeof doc !== 'object') return 'doc is not an object';
	if (!doc.meta || typeof doc.meta !== 'object') return 'invalid meta';
	if (!ID.test(doc.meta.id || '') || !doc.meta.id.startsWith('diagram-')) {
		return 'invalid meta.id';
	}
	if (!str(doc.meta.name || '', 64)) return 'invalid meta.name';
	for (const key of Object.keys(doc.meta)) {
		if (!['id', 'name', 'version', 'schema', 'owner', 'grants', 'slides'].includes(key)) return `unknown meta key: ${key}`;
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

	if ('slides' in doc.meta) {
		const slides = doc.meta.slides;
		if (!slides || typeof slides !== 'object' || Array.isArray(slides)) return 'invalid meta.slides';
		for (const key of Object.keys(slides)) {
			if (!['url', 'presentationId', 'pageId'].includes(key)) return `unknown slides key: ${key}`;
			if (!str(slides[key] || '', 512)) return `invalid slides.${key}`;
		}
	}

	const seen = new Set();
	const collections = { node: 'nodes', waypoint: 'waypoints', link: 'links', zone: 'zones', group: 'groups' };
	for (const [kind, key] of Object.entries(collections)) {
		const list = doc[key] || [];
		if (!Array.isArray(list)) return `${key} is not an array`;
		if (list.length > 2000) return `${key} exceeds entity limit`;
		for (const entity of list) {
			const err = validateEntity(kind, entity, { full: true });
			if (err) return err;
			if (seen.has(entity.id)) return `duplicate id: ${entity.id}`;
			seen.add(entity.id);
		}
	}
	// referential integrity within the document
	const nodeIds = new Set((doc.nodes || []).map((n) => n.id));
	const waypointIds = new Set((doc.waypoints || []).map((w) => w.id));
	const isEndpoint = (eid) => nodeIds.has(eid) || waypointIds.has(eid);
	const wpUse = new Map();   // waypoint id → # of links referencing it (must be ≤ 1, any role)
	for (const link of doc.links || []) {
		if (!isEndpoint(link.src) || !isEndpoint(link.dst)) return `link ${link.id} references missing endpoint`;
		if (link.src === link.dst) return `link ${link.id} is a self-link`;
		const refs = [];
		if (waypointIds.has(link.src)) refs.push(link.src);
		if (waypointIds.has(link.dst)) refs.push(link.dst);
		for (const w of link.via || []) { if (!waypointIds.has(w)) return `link ${link.id} references missing waypoint ${w}`; refs.push(w); }
		if (new Set(refs).size !== refs.length) return `link ${link.id} uses a waypoint in two roles`;
		for (const w of refs) wpUse.set(w, (wpUse.get(w) || 0) + 1);
	}
	for (const [w, n] of wpUse) if (n > 1) return `waypoint ${w} is used by ${n} links (max 1)`;
	for (const group of doc.groups || []) {
		for (const m of group.members) {
			if (!nodeIds.has(m) && !waypointIds.has(m)) return `group ${group.id} references missing member ${m}`;
		}
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

// meta patch from the client: only name and slides binding are writable
export function validateMetaPatch(patch) {
	if (!patch || typeof patch !== 'object') return 'patch is not an object';
	for (const key of Object.keys(patch)) {
		if (key === 'name') {
			if (!str(patch.name, 64) || patch.name.trim() === '') return 'invalid name';
		} else if (key === 'slides') {
			if (!patch.slides || typeof patch.slides !== 'object') return 'invalid slides';
			for (const k of Object.keys(patch.slides)) {
				if (!['url', 'presentationId', 'pageId'].includes(k)) return `unknown slides field: ${k}`;
				if (!str(patch.slides[k], 512)) return `invalid slides.${k}`;
			}
		} else {
			return `meta.${key} is not writable`;
		}
	}
	return null;
}
