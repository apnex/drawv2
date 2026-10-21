/*
Anchor resolution -- turning a RELATIONSHIP into a position, server-side.

  resolveAnchor(model, at)   PURE. Reads a model, returns an anchor or a refusal.

Sovereign duty: choosing WHICH free anchor satisfies a relationship, and nothing else. The grid
itself belongs to `kernel/geometry.mjs` (`NODE_GRID`, `nodeGridWithin`; snap-grid answers where its
positions lie, H26.1), occupancy belongs to the model, and this composes the two rather than
restating either.

B189 -- why this exists at all.

The server already ANSWERED occupancy: `GET /diagrams/<id>/layouts/<layout>/anchors?free=1` filters
the grid and returns every free anchor. What it never did was SELECT one. Nearest-by-distance, the
outward walk for a direction, the zone-bounds filter and the midpoint between two nodes lived in
`cli/verbs.mjs` alone, which cost `place` two round trips -- fetch the whole free list, then run
arithmetic on it -- and put the rule somewhere a transaction could not reach.

That last part is what forced the move. A drafted set resolves op 2 against the document op 1 has
already changed, so resolution must happen inside `plan()`, which advances a projection between
ops. Resolving both ops client-side against one pre-draft snapshot picks the same anchor twice and
the server refuses the set for occupancy -- measured on the live estate:

    node-aa2222 and node-aa1111 occupy the same anchor (0,-60)

Placed in `server/` rather than `model/` deliberately: this needs `kernel/` for the grid, and
`model/` is a sovereign sibling of `kernel/` that imports it nowhere (`model/limits.mjs`).
*/

import { NODE_GRID, nodeGridWithin, anchorOn } from '../kernel/geometry.mjs';   // H26.1: the grids, and an anchor's one builder (F3)
import { NODE_EXT } from '../model/surface.mjs';
import { ANCHOR_KINDS } from '../model/anchors.mjs';   // the bare anchor, asked in one place (F-b)
import { typedNodes } from '../plugins/devices/device-shapes.mjs';

// The four directions a caller may ask for, as unit steps on the grid. Screen coordinates, so `up`
// is negative y -- the same mapping `cli/verbs.mjs` shipped, kept identical so moving the rule
// cannot silently change where a node lands. H26.1: each names the node grid's direction it steps in (snap-grid's `next`).
const DIRS = { right: '+x', left: '-x', up: '-y', down: '+y' };

// How far a direction walks before giving up, in cells. 16 was the CLI's limit and is retained;
// the grid's own extent bounds it in practice.
const DIR_STEPS = 16;

const fail = (error) => ({ ok: false, error });

// Occupancy is a resolved-coordinate question, matching `violations()` rather than cell indices --
// the two agree only while every entity is on-grid, and stating it in pixels does not depend on
// that holding. A waypoint counts because a waypoint IS a node for placement (B112).
function takenSet(model) {
	const taken = new Set();
	for (const kind of [...ANCHOR_KINDS]) {
		for (const e of model.all(kind)) taken.add(`${e.x},${e.y}`);
	}
	return taken;
}

// Every free anchor on the node grid. The node extent bounds it, which is the same rule the REST
// anchors route applies: an anchor outside it cannot hold a node anyway.
// H26.1 (SNAP-GRID.md appendix B): the node grid within its extent, its positions in view of the whole extent -- every one, by row
// then column -- each mapped back to the anchor it was by the lattice's `anchorOn`; which are free stays decided here. The placement
// part consumes the lattice alone (appendix B), so the name of the layout its anchors are on is stated here
const NODE_LAYOUT = 'node';
const NODE_PLACES = nodeGridWithin(NODE_EXT);
const NODE_EXTENT_VIEW = { region: { kind: 'rect', x: -NODE_EXT.x, y: -NODE_EXT.y, w: 2 * NODE_EXT.x, h: 2 * NODE_EXT.y }, scale: 1 };
function freeAnchors(model) {
	const taken = takenSet(model);
	return NODE_PLACES.inView(NODE_EXTENT_VIEW).positions
		.map(({ position }) => anchorOn(NODE_LAYOUT, NODE_PLACES, position))
		.filter((a) => !taken.has(`${a.x},${a.y}`));
}

// Squared distance, never a root. Two engines may return different last bits for the same segment
// under `Math.hypot` (B176), and a comparison does not need the root: ordering by d2 is ordering by
// d. The CLI used hypot here; dropping it is a correction carried across with the rule.
const d2 = (a, x, y) => (a.x - x) * (a.x - x) + (a.y - y) * (a.y - y);

function nearest(candidates, x, y) {
	let best = null, bestD = Infinity;
	for (const a of candidates) {
		const d = d2(a, x, y);
		if (d < bestD) { best = a; bestD = d; }
	}
	return best;
}

// A named reference resolves against nodes by name or id. `resolveId`'s refusal of an ambiguous
// name is the model's job at the trust boundary; here a miss is simply a refusal that names what
// was asked for, because an agent reading `ghost is not a node` can act on it.
function nodeNamed(model, ref) {
	return typedNodes(model).find((n) => n.name === ref || n.id === ref) || null;
}

/*
Resolve a relationship to an anchor.

  { near: <ref> }            the closest free anchor to that node
  { near: <ref>, dir: ... }  the first free anchor walking that way from it
  { between: [<a>, <b>] }    the closest free anchor to the midpoint of two nodes
  { inside: <zone> }         the closest free anchor to the zone's centre, within its bounds

Returns `{ ok: true, layout, cx, cy, x, y }` or `{ ok: false, error }`. Never throws on a bad
reference: a refusal is data, because this runs inside `plan()` where a throw would be a planner
bug rather than a rejected request.
*/
export function resolveAnchor(model, at = {}) {
	const free = freeAnchors(model);
	if (!free.length) return fail('the canvas is full: every anchor is occupied');

	if (at.inside !== undefined) {
		const zone = model.all('zone').find((z) => z.name === at.inside || z.id === at.inside);
		if (!zone) return fail(`${at.inside} is not a zone`);
		const within = free.filter((a) => a.x >= zone.x && a.x <= zone.x + zone.w
			&& a.y >= zone.y && a.y <= zone.y + zone.h);
		if (!within.length) return fail(`zone ${at.inside} has no free anchor`);
		const hit = nearest(within, zone.x + zone.w / 2, zone.y + zone.h / 2);
		return { ok: true, ...hit };
	}

	if (at.between !== undefined) {
		const [refA, refB] = at.between;
		const a = nodeNamed(model, refA);
		const b = nodeNamed(model, refB);
		if (!a) return fail(`${refA} is not a node`);
		if (!b) return fail(`${refB} is not a node`);
		const hit = nearest(free, (a.x + b.x) / 2, (a.y + b.y) / 2);
		return hit ? { ok: true, ...hit } : fail(`nothing free between ${refA} and ${refB}`);
	}

	if (at.near !== undefined) {
		const ref = nodeNamed(model, at.near);
		if (!ref) return fail(`${at.near} is not a node`);

		if (at.dir !== undefined) {
			const step = DIRS[at.dir];
			if (!step) return fail(`dir must be one of ${Object.keys(DIRS).join(', ')}`);
			const open = new Set(free.map((a) => `${a.x},${a.y}`));
			/*
			H26.1 (SNAP-GRID.md appendix B, section 6.3): the walk steps with `next` on the node grid from the reference's own position, the
			free set deciding as it did for every reference on the lattice -- which every stored node is, its fields validated on it. A
			reference off the lattice has no position, and the walk finds nothing, where adding pixels to it could round onto an anchor.
			*/
			let p = NODE_GRID.positionAt(ref);
			for (let n = 1; p && n <= DIR_STEPS; n++) {
				p = NODE_GRID.next(p, step);
				const point = p && NODE_GRID.pointOf(p);
				if (point && open.has(`${point.x},${point.y}`)) return { ok: true, ...free.find((a) => a.x === point.x && a.y === point.y) };
			}
			return fail(`nothing free to the ${at.dir} of ${at.near}`);
		}

		const hit = nearest(free, ref.x, ref.y);
		return { ok: true, ...hit };
	}

	return fail('an anchor relationship needs one of near, between or inside');
}
