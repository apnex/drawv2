/*
A DEVICE'S FIELDS, COMPOSED ONTO AN ANCHOR -- the devices plugin's (O-e2, H19.21; dev/design/unification/KINDS-AS-PLUGINS.md
section 16; O4). The director: "The core holds only the anchor", and an anchor carries no type. A device is what this plugin
composes onto one: its `type` (what it is), its `shape` (the outer frame), its `span` (a footprint of several cells -- read by
this plugin alone since WD-a, H19.44: a wide device is one anchor, and the occupancy index no longer reads it) and its `content`
regions. Added to the anchor's kind as the network adds `transit` (S-a): an EXTENSION, every field optional, since an anchor
with none of them is a waypoint. Moved from planner/kinds.mjs unchanged, checks and messages alike.

`hasDevice` is the one statement of whether a device is composed -- devices/device-shapes.mjs and the simulation's spawner
rule (engine/spawn-field.mjs) build on it.
*/

import { CONTENT_VALUE_MAX, SPAN_MAX, FONT_MIN, FONT_MAX } from '../model/limits.mjs';

// whether a device is composed on an anchor: it carries a type, which a bare anchor -- a waypoint -- never does
export const hasDevice = (entity) => !!entity && !!entity.type;

// the checks are LOCAL, as every row's are: the trust boundary is never delegated (model/shape.mjs, B110)
const str = (v, max) => typeof v === 'string' && v.length <= max;
const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const SHAPES = ['circle', 'square']; // the device's frame (outer shell), independent of `type`
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
	// H15.18 -- per-region text size, so one caption can differ from another. Absent is the ruled
	// default in kernel/spec.mjs. Bounded because it feeds layout arithmetic: a wild value asks the
	// wrapper for a line count nobody wanted.
	size: (v) => num(v, FONT_MIN, FONT_MAX),
	action: (v) => str(v, 32) && /^[a-z0-9-]+$/.test(v),   // W5 — a clickable button: a safe action identifier
	input: (v) => typeof v === 'boolean'   // W6 — an editable input region (type into it, in run mode)
};
const region = (r) => !!r && typeof r === 'object' && !Array.isArray(r)
	&& (r.content === 'text' || r.content === 'glyph')   // the region kind is required
	&& Object.keys(r).every((k) => Object.hasOwn(REGION, k) && REGION[k](r[k]));
const content = (v) => Array.isArray(v) && v.length <= 200 && v.every(region);

// the fields only a device carries: on a waypoint, each is refused by name
const DEVICE_ONLY = ['shape', 'span', 'content'];

export const DEVICE_FIELDS = {
	kind: 'node',
	owner: 'devices',
	extends: true,
	fields: {
		// what the device is: a lowercase word naming its look and what it offers (F-c: absent on a waypoint, P-10, F4)
		type: (v) => str(v, 32) && /^[a-z0-9-]+$/.test(v),
		shape: (v) => SHAPES.includes(v),
		span: (v) => dims(v),    // optional multi-cell footprint (W1); absent: 1x1
		content: (v) => content(v),   // optional content regions (W2); absent: the type glyph
	},
	optional: ['type', 'shape', 'span', 'content'],
	composite: ['span', 'content'],   // nested values, compared whole when an edit sets them (planner/txn.mjs `narrow`)
	/*
	F-c (H18.5) -- ONE ANCHOR, TWO SHAPES: a device composed on it, or none -- a waypoint (P-10). Whether a device is composed
	is fixed when the anchor is made, so a bend can never become a router or the reverse (FORMAT-BATCH.md section 4); `shape`,
	`span` and `content` are a device's alone. Relaxing the first belongs to B282's held half, a type as a composition of packs. It was the node row's rule, with the
	spawner's half; that half is the simulation's now (engine/spawn-field.mjs), and runs after this one, as it did.
	*/
	refers: (entity, access, patch, before) => {
		if (before && hasDevice(before) !== hasDevice(entity)) return `a node's type is fixed when it is made -- a waypoint stays a waypoint, and a typed node keeps a type: ${entity.id}`;
		if (hasDevice(entity)) return null;
		const wrong = DEVICE_ONLY.filter((f) => f in entity);
		if (wrong.length) return `a waypoint (a node with no type) has no ${wrong.join(', ')}: ${entity.id}`;
		return null;
	},
};
