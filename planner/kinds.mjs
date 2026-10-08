/*
THE PRODUCT'S KIND ROWS -- each of its kinds whole (three since S-e): its storage (model/shape.mjs), a check for every field, its
cross-entity check, and the most of it one document may hold (H17.22 N-a; ruled 2026-10-02, "Plugins bring their own
kinds").

A row is the one shape every kind takes, the product's and a plugin's alike (`composeKinds`, model/shape.mjs). The checks
were `FIELDS` in planner/validate.js and the cross-entity checks two hard-coded branches there (`kind === 'link'`,
`kind === 'group'`); they moved here, unchanged, so validation reads a row instead of naming a kind. The trust boundary is
the composition's code -- core and plugins alike -- guarded by `composeKinds`: every field has a check, a twice-claimed
kind and a missing referenced kind are refused.

PLANNER layer, not core, because the link's cross-entity check was network-layer code (model/referential.mjs) the core may
not import. A composition is `productKinds(...rows)`, below -- the network's rows in every production one; the planner and
the validator take no default since S-f (H18.16).

AMENDED 2026-10-04 (S-e, H18.15; G5, B280): three kinds -- node, zone and group. The link's row left for the network
(network/link-kind.mjs) with its cross-entity check and its invariant, so this module names no link; every production
composition is `productKinds(...NETWORK_ROWS)`, which brings it.
*/

import { NODE_EXT } from '../model/surface.mjs';
import { ZONE_ROWS } from '../zones/zone-kind.mjs';   // the zones plugin's kind, composed between the node and the group (O-b1)
import { CORE_ROWS, composeKinds } from '../model/shape.mjs';
import { NAME_MAX } from '../model/limits.mjs';
import { DEVICE_FIELDS } from '../devices/device-fields.mjs';   // a device's fields, composed onto the anchor (O-e2)
import { SPAWN_FIELDS } from '../engine/spawn-field.mjs';   // a spawner's, the simulation's (O-e2)
import { LAYOUTS, onLayout } from '../kernel/geometry.mjs';
import { STD } from '../kernel/spec.mjs';
import { collectionCap } from './policy.mjs';
import { GROUP_ROWS } from '../groups/group-kind.mjs';   // the groups plugin's kind, composed after the zones plugin's (O-c)

// a drawing order is a positive integer; the ceiling only keeps it an exact one (F-d)
const ORDER_MAX = Number.MAX_SAFE_INTEGER;
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
const CAP = collectionCap({ nodeExt: NODE_EXT, pitch: PITCH });

const str = (v, max) => typeof v === 'string' && v.length <= max;
const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
// an entity id of one kind: the kind, a dash, six hex digits -- what `ID.test(v) && v.startsWith(kind + '-')` was, per kind
const id = (v, kind) => typeof v === 'string' && new RegExp(`^${kind}-[0-9a-f]{6}$`).test(v);

// per-kind field validators; `full` requires every field, otherwise subset (for set)
const FIELDS = {
	node: {
		id: (v) => id(v, 'node'),
		name: (v) => str(v, NAME_MAX),
		x: (v) => num(v, -EXT.x, EXT.x) && onGrid('node', v),
		y: (v) => num(v, -EXT.y, EXT.y) && onGrid('node', v),
		order: (v) => int(v, 1, ORDER_MAX),   // the drawing order (F-d, model/order.mjs)
		// O-e2 (H19.21; O4): the ANCHOR's fields alone -- "The core holds only the anchor". A device's -- its type, frame,
		// footprint and content regions -- are the devices plugin's (devices/device-fields.mjs), with the rule that a device
		// stays a device; a spawner is the simulation's (engine/spawn-field.mjs); transit the network's (network/kinds.mjs).
		// `pinned` (B162) is retired: the network keeps no orphan beyond what its pipes hold (ruled 2026-09-29)
	},

};

/*
EACH KIND'S CROSS-ENTITY CHECK -- `(entity, access, patch, before)`, `entity` being the entity as it would stand after the op (a
`set` merged over what is stored), `patch` what the op itself carried, and `before` what was stored (null for a new one). The two rules are model/referential.mjs's,
shared with `validateDoc`; what each row adds is the part that was the mutation path's own -- a link is judged on the
`src`, `dst` and `via` it keeps, and a group only when the op names its members.
AMENDED 2026-10-04 (S-e): `access` is generic -- `has(kind, id)`, `get(kind, id)`, `all(kind)` (planner/validate.js); the
link's check is the network's row's now.
*/
// O-e2 (H19.21): the node's cross-field rule -- a device stays a device; device fields on a device, a spawner on a waypoint --
// left with the fields it judges, to the devices plugin and the simulation; the anchor's row brings none

// the core's one, whole (O-b1: the zone is the zones plugin's; O-c: the group the groups plugin's)
const PRODUCT_ROWS = CORE_ROWS.map((row) => ({ ...row, fields: FIELDS[row.kind], cap: CAP[row.kind] }));
/*
The product's composition, and a plugin's rows after its five: the one way a composition with a plugin's kinds is built --
the lab's, with the network's `pipe` (H17.22 N-c), and the product page's at promotion.
*/
// the shipped kinds in the order a document lists its collections: the node, the zones plugin's, the groups plugin's (O-b1, O-c)
const byKind = Object.fromEntries(PRODUCT_ROWS.map((r) => [r.kind, r]));
const SHIPPED = [byKind.node, ...ZONE_ROWS, ...GROUP_ROWS, DEVICE_FIELDS, SPAWN_FIELDS];   // and the fields composed on the anchor (O-e2)
export const productKinds = (...pluginRows) => composeKinds([...SHIPPED, ...pluginRows], pluginRows.length ? `the product with ${pluginRows.map((r) => r.kind).join(', ')}` : 'the product');
