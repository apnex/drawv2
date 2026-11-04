/*
Anchor resolution -- turning a RELATIONSHIP into a position, server-side.

  resolveAnchor(model, at)   PURE. Reads a model, returns an anchor or a refusal.

Sovereign duty: choosing WHICH free anchor satisfies a relationship, and nothing else. The grid
itself belongs to `kernel/geometry.mjs` (`NODE_GRID`; snap-grid answers where its positions lie,
H26.1), occupancy belongs to the model, and this composes the two rather than
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

import { NODE_GRID, anchorOn } from '../kernel/geometry.mjs';   // H26.1: the grid, and an anchor's one builder (F3)
import { COORD_BOUND } from '../model/limits.mjs';   // H26.6's move 12: PZ31's bound, which every candidate is kept within
import { ANCHOR_KINDS } from '../model/anchors.mjs';   // the bare anchor, asked in one place (F-b)
import { typedNodes } from '../plugins/devices/device-shapes.mjs';

// The four directions a caller may ask for, as unit steps on the grid. Screen coordinates, so `up`
// is negative y -- the same mapping `cli/verbs.mjs` shipped, kept identical so moving the rule
// cannot silently change where a node lands. H26.1: each names the node grid's direction it steps in (snap-grid's `next`).
const DIRS = { right: '+x', left: '-x', up: '-y', down: '+y' };

// How far a direction walks before giving up, in cells. 16 was the CLI's limit and is retained; RESTATED at H26.6's move 12: no
// extent bounds it now, only PZ31's bound and the 16 steps
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

/*
H26.6's move 12 (dev/design/components/PAN-ZOOM.md section 3.8, "Placement"; PZ9) -- THE NEAREST FREE POINT, BY RINGS. Placement walked
the old extent's 527 positions and kept the nearest free one; with no extent there is no list, so each relation searches outward from
its reference instead: ring `r` holds the node grid's positions `r` steps from the reference's nearest position, in Chebyshev distance,
each judged by its exact squared distance -- never a root (B176) -- the tie to the lesser `y`, then the lesser `x`, the order the old
list was walked in, so a placement whose answer lies inside the old frame answers as it did. It ends one of two ways:
  the sound stop    a point found at squared distance `d2` is nearer than any point of ring `r` or beyond once
                    `d2 < ((r - 1/2) * pitch)^2`, since the reference lies within half a pitch of its nearest position on each axis; on
                    equality ring `r` is still searched, a tie there perhaps winning on `y` -- compared as `4 * d2 < ((2r - 1) * pitch)^2`,
                    exact in binary64 at every coordinate within the bound
  the domain's end  once ring `r`'s columns lie either side of the domain and its rows likewise, ring `r` and every later ring lie
                    wholly beyond it, so the search refuses -- the domain PZ31's bound, and for `inside` the zone's interior within it
`placement-rings.mjs` measured the worst cases with 527 anchors packed nearest the reference: 13 rings in the open, 21 at the bound's
corner, 264 in a zone one square wide, and a full zone refused (tests/placement-rings.test.js).
*/
const PITCH = NODE_GRID.declaration.pitch;
const BOUND = { left: (x) => x < -COORD_BOUND, right: (x) => x > COORD_BOUND, above: (y) => y < -COORD_BOUND, below: (y) => y > COORD_BOUND };
// a zone's interior, strictly, kept within the bound
const interiorOf = (z) => ({
	left: (x) => x <= z.x || BOUND.left(x), right: (x) => x >= z.x + z.w || BOUND.right(x),
	above: (y) => y <= z.y || BOUND.above(y), below: (y) => y >= z.y + z.h || BOUND.below(y),
});
const admits = (domain, p) => !domain.left(p.x) && !domain.right(p.x) && !domain.above(p.y) && !domain.below(p.y);
const d2 = (p, x, y) => (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);

function nearestFree(ref, domain, taken) {
	const at = NODE_GRID.nearest(ref);
	let best = null;
	for (let ring = 0; ; ring++) {
		const reach = (2 * ring - 1) * PITCH;
		if (best && 4 * best.d2 < reach * reach) return best.position;
		const lo = NODE_GRID.pointOf({ col: at.col - ring, row: at.row - ring }), hi = NODE_GRID.pointOf({ col: at.col + ring, row: at.row + ring });
		if (domain.left(lo.x) && domain.right(hi.x) && domain.above(lo.y) && domain.below(hi.y)) return best ? best.position : null;
		for (let row = at.row - ring; row <= at.row + ring; row++) {
			// the ring's own positions: its first and last rows whole, every other row its two ends
			const whole = ring === 0 || row === at.row - ring || row === at.row + ring;
			for (let col = at.col - ring; col <= at.col + ring; col += whole ? 1 : 2 * ring) {
				const position = { col, row }, p = NODE_GRID.pointOf(position);
				if (!admits(domain, p) || taken.has(`${p.x},${p.y}`)) continue;
				const d = d2(p, ref.x, ref.y);
				if (!best || d < best.d2 || (d === best.d2 && (p.y < best.p.y || (p.y === best.p.y && p.x < best.p.x)))) best = { position, p, d2: d };
			}
		}
	}
}
// the placement part consumes the lattice alone (SNAP-GRID.md appendix B), so the name of the layout its anchors are on is stated here
const NODE_LAYOUT = 'node';
const anchorAt = (position) => ({ ok: true, ...anchorOn(NODE_LAYOUT, NODE_GRID, position) });

// A named reference resolves against nodes by name or id. `resolveId`'s refusal of an ambiguous
// name is the model's job at the trust boundary; here a miss is simply a refusal that names what
// was asked for, because an agent reading `ghost is not a node` can act on it.
function nodeNamed(model, ref) {
	return typedNodes(model).find((n) => n.name === ref || n.id === ref) || null;
}

/*
Resolve a relationship to an anchor.

  { near: <ref> }            the closest free anchor to that node
  { near: <ref>, dir: ... }  the first free anchor walking that way from it, at most 16 steps
  { between: [<a>, <b>] }    the closest free anchor to the midpoint of two nodes
  { inside: <zone> }         the closest free anchor to the zone's centre, strictly inside it

Every candidate lies within PZ31's bound (H26.6's move 12, dev/design/components/PAN-ZOOM.md section 3.8), found by the rings above where
the old extent's list was walked. Returns `{ ok: true, layout, cx, cy, x, y }` or `{ ok: false, error }`. Never throws on a bad
reference: a refusal is data, because this runs inside `plan()` where a throw would be a planner bug rather than a rejected request.
*/
export function resolveAnchor(model, at = {}) {
	const taken = takenSet(model);

	if (at.inside !== undefined) {
		const zone = model.all('zone').find((z) => z.name === at.inside || z.id === at.inside);
		if (!zone) return fail(`${at.inside} is not a zone`);
		const hit = nearestFree({ x: zone.x + zone.w / 2, y: zone.y + zone.h / 2 }, interiorOf(zone), taken);
		return hit ? anchorAt(hit) : fail(`zone ${at.inside} has no free anchor`);
	}

	if (at.between !== undefined) {
		const [refA, refB] = at.between;
		const a = nodeNamed(model, refA);
		const b = nodeNamed(model, refB);
		if (!a) return fail(`${refA} is not a node`);
		if (!b) return fail(`${refB} is not a node`);
		const hit = nearestFree({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, BOUND, taken);
		return hit ? anchorAt(hit) : fail(`nothing free between ${refA} and ${refB}`);
	}

	if (at.near !== undefined) {
		const ref = nodeNamed(model, at.near);
		if (!ref) return fail(`${at.near} is not a node`);

		if (at.dir !== undefined) {
			const step = DIRS[at.dir];
			if (!step) return fail(`dir must be one of ${Object.keys(DIRS).join(', ')}`);
			/*
			H26.1 (SNAP-GRID.md appendix B, section 6.3): the walk steps with `next` on the node grid from the reference's own position, the
			free set deciding as it did for every reference on the lattice -- which every stored node is, its fields validated on it. A
			reference off the lattice has no position, and the walk finds nothing, where adding pixels to it could round onto an anchor.
			RESTATED at H26.6's move 12: a step is free when nothing stands on it and it lies within PZ31's bound, where it was a member of
			the old extent's free list.
			*/
			let p = NODE_GRID.positionAt(ref);
			for (let n = 1; p && n <= DIR_STEPS; n++) {
				p = NODE_GRID.next(p, step);
				const point = p && NODE_GRID.pointOf(p);
				if (point && admits(BOUND, point) && !taken.has(`${point.x},${point.y}`)) return anchorAt(p);
			}
			return fail(`nothing free to the ${at.dir} of ${at.near}`);
		}

		const hit = nearestFree(ref, BOUND, taken);
		return hit ? anchorAt(hit) : fail(`nothing free near ${at.near}`);
	}

	return fail('an anchor relationship needs one of near, between or inside');
}
