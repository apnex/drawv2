/*
Anchor resolution -- turning a RELATIONSHIP into a position, server-side.

  resolveAnchor(model, at)   PURE. Reads a model, returns an anchor or a refusal.

Sovereign duty: choosing WHICH free anchor satisfies a relationship, and nothing else. The grid
itself belongs to `kernel/geometry.mjs` (`LAYOUTS`, `anchorAt`), occupancy belongs to the model,
and this composes the two rather than restating either.

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

import { LAYOUTS, anchorAt } from '../kernel/index.mjs';
import { NODE_EXT } from '../model/index.mjs';

// The four directions a caller may ask for, as unit steps on the grid. Screen coordinates, so `up`
// is negative y -- the same mapping `cli/verbs.mjs` shipped, kept identical so moving the rule
// cannot silently change where a node lands.
const DIRS = { right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1] };

// How far a direction walks before giving up, in cells. 16 was the CLI's limit and is retained;
// the grid's own extent bounds it in practice.
const DIR_STEPS = 16;

const fail = (error) => ({ ok: false, error });

// Occupancy is a resolved-coordinate question, matching `violations()` rather than cell indices --
// the two agree only while every entity is on-grid, and stating it in pixels does not depend on
// that holding. A waypoint counts because a waypoint IS a node for placement (B112).
function takenSet(model) {
	const taken = new Set();
	for (const kind of ['node', 'waypoint']) {
		for (const e of model.all(kind)) taken.add(`${e.x},${e.y}`);
	}
	return taken;
}

// Every free anchor on the node grid. The node extent bounds it, which is the same rule the REST
// anchors route applies: an anchor outside it cannot hold a node anyway.
function freeAnchors(model) {
	const L = LAYOUTS.node;
	const taken = takenSet(model);
	const out = [];
	const cxMax = Math.floor(NODE_EXT.x / 60), cyMax = Math.floor(NODE_EXT.y / 60);
	for (let cy = -cyMax; cy <= cyMax; cy++) {
		for (let cx = -cxMax; cx <= cxMax; cx++) {
			const a = anchorAt(L, cx, cy);
			if (!taken.has(`${a.x},${a.y}`)) out.push(a);
		}
	}
	return out;
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
	return model.all('node').find((n) => n.name === ref || n.id === ref) || null;
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
			const [dx, dy] = step;
			const open = new Set(free.map((a) => `${a.x},${a.y}`));
			for (let n = 1; n <= DIR_STEPS; n++) {
				const x = ref.x + dx * 60 * n, y = ref.y + dy * 60 * n;
				if (open.has(`${x},${y}`)) return { ok: true, ...free.find((a) => a.x === x && a.y === y) };
			}
			return fail(`nothing free to the ${at.dir} of ${at.near}`);
		}

		const hit = nearest(free, ref.x, ref.y);
		return { ok: true, ...hit };
	}

	return fail('an anchor relationship needs one of near, between or inside');
}
