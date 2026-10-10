/*
THE PRODUCT'S COMPOSITION -- the kinds production ships, composed in one place (O-d, H19.22; KINDS-AS-PLUGINS.md; O1, O3, O4).

The core's anchor (model/shape.mjs), the zones plugin's kind, the groups plugin's, the fields the devices plugin and the
simulation compose onto the anchor, and a plugin's rows after them -- the network's link, pipe and transit field in every
production composition: `productKinds(...NETWORK_ROWS)`. In the order a document lists its collections: node, zone, group,
link, pipe. Built when a page or a server is composed, never registered at runtime (ruled 2026-10-02).

It was planner/kinds.mjs, where the product's rows and their checks lived (H17.22 N-a): each kind's row and checks are its
plugin's now, and the anchor's the core's, so the planner composes nothing and imports no plugin. The store, the product
page, the lab, the CLI's reader and the tools compose through here; the planner, the validator and the Model are handed
what they compose.

The ANCHOR's checks are here, composed onto the core's storage row (model/shape.mjs), as they were in the planner: they read
the grid (kernel/), and model/ and kernel/ import nothing from each other (C9). Every other kind's checks are its plugin's.
*/

import { CORE_ROWS, composeKinds } from '../model/shape.mjs';
import { NAME_MAX } from '../model/limits.mjs';
import { NODE_EXT, anchorCellsWithin } from '../model/surface.mjs';
import { LAYOUTS, onLayout } from '../kernel/geometry.mjs';
import { STD } from '../kernel/spec.mjs';
import { ZONE_ROWS } from '../zones/zone-kind.mjs';
import { LAYOUT_ROWS } from '../layouts/layout-kind.mjs';   // WD-b1: the layouts plugin's kind
import { GROUP_ROWS } from '../groups/group-kind.mjs';
import { DEVICE_FIELDS } from '../devices/device-fields.mjs';
import { SPAWN_FIELDS } from '../engine/spawn-field.mjs';


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
const EXT = NODE_EXT;                          // an anchor keeps a full margin cell

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

// the checks are LOCAL: the trust boundary is never delegated (B110) -- each plugin's row restates these for its own fields
const str = (v, max) => typeof v === 'string' && v.length <= max;
const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
// an entity id of one kind: the kind, a dash, six hex digits
const id = (v, kind) => typeof v === 'string' && new RegExp(`^${kind}-[0-9a-f]{6}$`).test(v);

// B113: one anchor to an anchor cell of the node extent -- the cell count the core's grid derives (model/surface.mjs)
const ANCHOR_CAP = anchorCellsWithin(NODE_EXT, PITCH);

const ANCHOR_FIELDS = {
	id: (v) => id(v, 'node'),
	name: (v) => str(v, NAME_MAX),
	x: (v) => num(v, -EXT.x, EXT.x) && onGrid('node', v),
	y: (v) => num(v, -EXT.y, EXT.y) && onGrid('node', v),
	order: (v) => int(v, 1, ORDER_MAX),   // the drawing order (F-d, model/order.mjs)
	// O-e2 (H19.21; O4): the ANCHOR's fields alone -- "The core holds only the anchor". A device's -- its type, frame,
	// footprint and content regions -- are the devices plugin's (devices/device-fields.mjs), with the rule that a device
	// stays a device; a spawner is the simulation's (engine/spawn-field.mjs); transit the network's (network/kinds.mjs).
	// `pinned` (B162) is retired: the network keeps no orphan beyond what its pipes hold (ruled 2026-09-29)
};

// the anchor's row, checked: the core's storage facts with its checks and its cap
const ANCHOR_ROWS = CORE_ROWS.map((row) => ({ ...row, fields: ANCHOR_FIELDS, cap: ANCHOR_CAP }));

// the shipped kinds and fields, in the order a document lists its collections, then a plugin's rows
// WD-b1: the layouts first -- a document lists its grids before what sits on them
const SHIPPED = [...LAYOUT_ROWS, ...ANCHOR_ROWS, ...ZONE_ROWS, ...GROUP_ROWS, DEVICE_FIELDS, SPAWN_FIELDS];
export const productKinds = (...pluginRows) => composeKinds([...SHIPPED, ...pluginRows], pluginRows.length ? `the product with ${pluginRows.filter((r) => !r.extends).map((r) => r.kind).join(', ')}` : 'the product');
