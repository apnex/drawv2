/*
THE LINK KIND -- the network plugin's own, beside `pipe` (S-e, H18.15; ruled 2026-10-03, G5; B280).

A link was the product's kind, with the product's other three, until P3 composed the network everywhere the product runs
(S-b). From here the network brings it: its row -- how it is stored, its field checks, its cross-entity check, its cap and
the document invariant it holds -- with the rules that act on it (network/link-rules.mjs, network/link-reactions.mjs), so
the product's own rows name no link and the core holds no link rule. A composition without the network has no links.

A link joins two anchors (`src`, `dst`, each a node, typed or not -- F-c), bending at waypoints in `via`; `closed` loops it
back from `dst` to `src` (a ring, F-f). `direction` and `control` are what the author declared (H15.3, H15.15; F1), and
`order` its drawing order and age (F-d). Its fields are what they were as the product's row: only the owner moved.
*/

import { NAME_MAX } from '../model/limits.mjs';
import { linkReferential, linkAccess } from './link-references.mjs';
import { straightCapacity, isStraight, pairKey } from './pair-capacity.mjs';

const ORDER_MAX = Number.MAX_SAFE_INTEGER;
// the checks are LOCAL, as every row's are: the trust boundary is never delegated (planner/kinds.mjs)
const str = (v, max) => typeof v === 'string' && v.length <= max;
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const id = (v, kind) => typeof v === 'string' && new RegExp(`^${kind}-[0-9a-f]{6}$`).test(v);

/*
B113 -- the most one document may hold. 2000, as it was among the product's unpositioned kinds (planner/policy.mjs): a link
has no anchor of its own, so no occupancy rule caps it first, and the number is still reachable.
*/
const LINK_CAP = 2000;

/*
B81 -- a pair carries as many straight links as `straightCapacity` allows (one; network/pair-capacity.mjs). Checked on the
RESULT of a transaction, as every document invariant is (model/invariants.mjs): a batch may pass through a state that breaks
it and end valid. Reported with its identity and its measure -- the excess -- so the planner's backstop refuses only an edit
that introduces or worsens it (B271), and a partial repair is accepted.
*/
function straightPairs(model, report) {
	const byPair = new Map();
	for (const link of model.all('link')) {
		if (!isStraight(link)) continue;
		// unordered: a link from a to b and one from b to a join the same pair
		const key = pairKey(link);
		const seen = byPair.get(key) || [];
		seen.push(link);
		byPair.set(key, seen);
	}
	for (const [key, links] of byPair) {
		const [a, b] = key.split('|');
		const cap = straightCapacity(model, a, b);
		if (links.length > cap) {
			report(`${links.length} straight links between ${a} and ${b}, which may carry ${cap}`, `straight-pair:${a}|${b}`, links.length - cap);   // the excess: worse if links grow or capacity shrinks
		}
	}
}

export const LINK_ROW = {
	kind: 'link', owner: 'the network', collection: 'links',
	selectable: true, named: true, anchor: false,
	composite: ['via'],
	// `order` (F-d, H18.6): optional, so a hand-made board still loads
	optional: ['via', 'closed', 'direction', 'control', 'order'],
	references: ['node'],
	fields: {
		id: (v) => id(v, 'link'),
		name: (v) => str(v, NAME_MAX),   // B187 -- naming is schema-wide, and a link was the other gap
		src: (v) => id(v, 'node'),   // an anchor: a node, typed or not (F-c)
		dst: (v) => id(v, 'node'),
		via: (v) => Array.isArray(v) && v.length <= 500 && v.every((m) => id(m, 'node')),   // waypoints only: network/link-references.mjs
		closed: (v) => typeof v === 'boolean',            // a routed link looped dst -> src
		// H15.3 -- the author DECLARED a direction. Absent is undeclared and symmetric; `forward` means the
		// flow follows the stored order, `reverse` that it runs against it. See `facing` in network/link-rules.mjs.
		// Was `flow`, a boolean, until the format batch (F1, ruled 2026-10-03): the CLI's words, stored as they are said.
		direction: (v) => v === 'forward' || v === 'reverse',
		// H15.15 -- a CONTROL-PLANE link carries no data-plane packets. Absent is an ordinary data
		// link, so every document written before this field reads exactly as it did.
		control: (v) => typeof v === 'boolean',
		order: (v) => int(v, 1, ORDER_MAX),   // the drawing order, and the link's age (F-d, B259)
	},
	// judged on the `src`, `dst` and `via` it keeps -- a `set` merged over what is stored (the planner's mutation path)
	refers: (entity, access) => linkReferential({ id: entity.id, src: entity.src, dst: entity.dst, via: entity.via ?? [], closed: !!entity.closed }, linkAccess(access)),
	invariants: straightPairs,
	// where a link is drawn, and whether it is down, are the network's answers: a Model holding links is given one (V-e, J2)
	drawnBy: ['pathOf', 'isLinkDown', 'blockersOf', 'linksRoutedThrough'],
	cap: LINK_CAP,
};
