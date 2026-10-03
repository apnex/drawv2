/*
THE PRODUCT'S KIND ROWS -- each of its five kinds whole: its storage (model/shape.mjs), a check for every field, its
cross-entity check, and the most of it one document may hold (H17.22 N-a; ruled 2026-10-02, "Plugins bring their own
kinds").

A row is the one shape every kind takes, the product's and a plugin's alike (`composeKinds`, model/shape.mjs). The checks
were `FIELDS` in planner/validate.js and the cross-entity checks two hard-coded branches there (`kind === 'link'`,
`kind === 'group'`); they moved here, unchanged, so validation reads a row instead of naming a kind. The trust boundary is
the composition's code -- core and plugins alike -- guarded by `composeKinds`: every field has a check, a twice-claimed
kind and a missing referenced kind are refused.

PLANNER layer, not core, because the link's cross-entity check is network-layer code (model/referential.mjs) the core may
not import. `PRODUCT_KINDS` is what the planner and `validateDoc` take when nothing else is passed; a composition with a
plugin's kinds is `productKinds(...rows)`, below.
*/

import { NODE_EXT, ZONE_EXT } from '../model/surface.mjs';
import { CORE_ROWS, composeKinds } from '../model/shape.mjs';
import { linkReferential, groupReferential } from '../model/referential.mjs';
import { NAME_MAX, CONTENT_VALUE_MAX, SPAN_MAX, SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_MAX, SPAWN_SPEED_MAX, FONT_MIN, FONT_MAX } from '../model/limits.mjs';
import { LAYOUTS, onLayout } from '../kernel/geometry.mjs';
import { STD } from '../kernel/spec.mjs';
import { collectionCap } from './policy.mjs';
import { isTypedEntity } from '../model/anchors.mjs';   // the two shapes of node (F-c)

// a drawing order is a positive integer; the ceiling only keeps it an exact one (F-d)
const ORDER_MAX = Number.MAX_SAFE_INTEGER;
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

// B113: the cap has ONE owner. planner/policy.mjs already declares itself the authority for a
// threshold (B85), and this was stated twice at 2000 -- here and in txn.mjs -- which is one number
// too many the moment either becomes derived. Each row carries its own, from here.
const CAP = collectionCap({ nodeExt: NODE_EXT, zoneExt: ZONE_EXT, pitch: PITCH });

const str = (v, max) => typeof v === 'string' && v.length <= max;
const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
// an entity id of one kind: the kind, a dash, six hex digits -- what `ID.test(v) && v.startsWith(kind + '-')` was, per kind
const id = (v, kind) => typeof v === 'string' && new RegExp(`^${kind}-[0-9a-f]{6}$`).test(v);
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

/*
H12.5 -- a spawner's configuration, whole or absent.

`SINCE_FLOOR` rejects a stamp from before this system could have produced one, and the ceiling
rejects one implausibly far ahead. Both exist because `since` feeds arithmetic: `engine/movers.mjs`
derives the live window from it, and a wild value asks for a walk nobody wanted. A clock a little
fast is normal and tolerated; a clock wrong by years is a corrupt field.
*/
const SINCE_FLOOR = 1_600_000_000_000;                       // 2020-09, comfortably before this tree existed
const SINCE_CEIL = () => Date.now() + 86_400_000;            // a day ahead absorbs any sane clock skew
/*
B172 -- `kind` names a look, it does not carry one.

`colour` used to be a hex per spawner, which meant the appearance of every packet in the estate was
copied into each document that had one: three changes of mind proved that changing it meant
rewriting data. A kind resolves to a CSS class instead, so the stylesheet owns the look and one edit
reaches everything -- including spawners already armed, which a stored hex can never do.

It is the same shape the tree already uses for a node: `type` is stored, the glyph is resolved.
Per-kind appearance stays expressible, which is what creep types will need.
*/
const SPAWN_KINDS = ['packet'];
const SPAWN = {
	interval: (v) => num(v, SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_MAX),
	speed: (v) => num(v, 0.1, SPAWN_SPEED_MAX),          // CELLS per second
	kind: (v) => SPAWN_KINDS.includes(v),
	since: (v) => num(v, SINCE_FLOOR, SINCE_CEIL()),
};
const spawn = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
	&& Object.keys(SPAWN).every((k) => Object.hasOwn(v, k))            // whole, never partial
	&& Object.keys(v).every((k) => Object.hasOwn(SPAWN, k) && SPAWN[k](v[k]));

// per-kind field validators; `full` requires every field, otherwise subset (for set)
const FIELDS = {
	node: {
		id: (v) => id(v, 'node'),
		name: (v) => str(v, NAME_MAX),
		// optional since the format batch (F-c, H18.5): a node with no type is a bare anchor -- a waypoint (P-10, F4); whether it
		// has one is fixed when it is made (REFERS.node, below)
		type: (v) => str(v, 32) && /^[a-z0-9-]+$/.test(v),
		shape: (v) => SHAPES.includes(v),
		x: (v) => num(v, -EXT.x, EXT.x) && onGrid('node', v),
		y: (v) => num(v, -EXT.y, EXT.y) && onGrid('node', v),
		span: (v) => dims(v),    // optional multi-cell footprint (W1); absent ⇒ 1×1
		content: (v) => content(v),   // optional content regions (W2); absent ⇒ the type glyph
		order: (v) => int(v, 1, ORDER_MAX),   // the drawing order (F-d, model/order.mjs)
		// a WAYPOINT'S own fields -- a node with no type (F-c, H18.5); a typed node carries neither (REFERS.node). Its name is
		// every node's (B187: naming is schema-wide, and a waypoint was the gap)
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
		pinned: (v) => typeof v === 'boolean',   // retired at P3 with production's orphan rule (ruled 2026-10-03)
		/*
		H12.5 -- this endpoint EMITS movers along its link.

		Whole-object, with every key required: a spawner is either configured or absent, and there
		is no such thing as half of one. Accepting a partial would push a default into whoever read
		it next, and two readers would eventually choose differently.

		`since` is the shared phase -- an epoch instant, so every peer computes the SAME departure
		times from it rather than each starting its own animation when it happened to load. It is
		bounded rather than free: a stamp far outside living memory is a corrupt value, not a
		diagram somebody armed, and admitting it would let one bad field ask the simulation to walk
		an absurd window.

		Direction is deliberately NOT a field here -- see `model/shape.mjs`. It is read off which
		end of the link this waypoint occupies.
		*/
		spawn: (v) => spawn(v)
	},
	link: {
		id: (v) => id(v, 'link'),
		name: (v) => str(v, NAME_MAX),   // B187 -- naming is schema-wide, and a link was the other gap
		src: (v) => id(v, 'node'),   // an anchor: a node, typed or not (F-c)
		dst: (v) => id(v, 'node'),
		via: (v) => Array.isArray(v) && v.length <= 500 && v.every((m) => id(m, 'node')),   // waypoints only: model/referential.mjs
		closed: (v) => typeof v === 'boolean',            // a routed link looped dst → src (render-only)
		// H15.3 -- the author DECLARED a direction. Absent is undeclared and symmetric; `forward` means the
		// flow follows the stored order, `reverse` that it runs against it. See `facing` in model/invariants.mjs.
		// Was `flow`, a boolean, until the format batch (F1, ruled 2026-10-03): the CLI's words, stored as they are said.
		direction: (v) => v === 'forward' || v === 'reverse',
		// H15.15 -- a CONTROL-PLANE link carries no data-plane packets. Absent is an ordinary data
		// link, so every document written before this field reads exactly as it did.
		control: (v) => typeof v === 'boolean',
		order: (v) => int(v, 1, ORDER_MAX),   // the drawing order, and the link's age (F-d, B259)
	},
	zone: {
		id: (v) => id(v, 'zone'),
		name: (v) => str(v, NAME_MAX),
		// the zone grid is offset by half a pitch: a zone bounds CELLS, so its edges fall between them
		x: (v) => num(v, -ZEXT.x, ZEXT.x) && onGrid('zone', v),
		y: (v) => num(v, -ZEXT.y, ZEXT.y) && onGrid('zone', v),
		w: (v) => num(v, PITCH, 2 * ZEXT.x) && onGrid('node', v), // whole cells; minimum one — no degenerate zones
		h: (v) => num(v, PITCH, 2 * ZEXT.y) && onGrid('node', v),
		order: (v) => int(v, 1, ORDER_MAX)   // the drawing order (F-d)
	},
	group: {
		id: (v) => id(v, 'group'),
		name: (v) => str(v, NAME_MAX),
		members: (v) => Array.isArray(v) && v.length <= 500 && v.every((m) => id(m, 'node'))
	}
};

/*
EACH KIND'S CROSS-ENTITY CHECK -- `(entity, access, patch, before)`, `entity` being the entity as it would stand after the op (a
`set` merged over what is stored), `patch` what the op itself carried, and `before` what was stored (null for a new one). The two rules are model/referential.mjs's,
shared with `validateDoc`; what each row adds is the part that was the mutation path's own -- a link is judged on the
`src`, `dst` and `via` it keeps, and a group only when the op names its members.
*/
const WAYPOINT_ONLY = ['pinned', 'spawn'];
const TYPED_ONLY = ['shape', 'span', 'content'];
const REFERS = {
	/*
	F-c (H18.5) -- ONE NODE KIND, TWO SHAPES, told apart by `type`. A waypoint became a node with no type (P-10), and every
	rule that read "a waypoint" reads "a node with no type" -- so the line between them is held here, where the kind boundary
	held it before: whether a node has a type is fixed when it is made, so a bend can never become a router or the reverse
	(FORMAT-BATCH.md section 4); `pinned` and `spawn` are a waypoint's alone, and `shape`, `span` and `content` a typed
	node's alone -- exactly the fields each kind had. Relaxing the first belongs to B282's type-as-composition half.
	*/
	node: (entity, access, patch, before) => {
		if (before && isTypedEntity('node', before) !== isTypedEntity('node', entity)) return `a node's type is fixed when it is made -- a waypoint stays a waypoint, and a typed node keeps a type: ${entity.id}`;
		const typed = isTypedEntity('node', entity);
		const wrong = (typed ? WAYPOINT_ONLY : TYPED_ONLY).filter((f) => f in entity);
		if (wrong.length) return `${typed ? 'a typed node' : 'a waypoint (a node with no type)'} has no ${wrong.join(', ')}: ${entity.id}`;
		return null;
	},
	link: (entity, access) => linkReferential({ id: entity.id, src: entity.src, dst: entity.dst, via: entity.via ?? [] }, access),
	group: (entity, access, patch) => (patch.members ? groupReferential(entity, access) : null),
};

// the product's four, whole -- in the core's order, which is the order a document lists its collections
const PRODUCT_ROWS = CORE_ROWS.map((row) => ({ ...row, fields: FIELDS[row.kind], cap: CAP[row.kind], ...(REFERS[row.kind] ? { refers: REFERS[row.kind] } : {}) }));
/*
The product's composition, and a plugin's rows after its five: the one way a composition with a plugin's kinds is built --
the lab's, with the network's `pipe` (H17.22 N-c), and the product page's at promotion.
*/
export const productKinds = (...pluginRows) => composeKinds([...PRODUCT_ROWS, ...pluginRows], pluginRows.length ? `the product with ${pluginRows.map((r) => r.kind).join(', ')}` : 'the product');
export const PRODUCT_KINDS = productKinds();
