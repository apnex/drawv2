/*
THE LINK RULES -- how links meet, split and share a pair: the network's rules, read by its tenant's reactions
(model/link-reactions.mjs), its transit cut (network/transit.mjs), its drag judge (network/guide.mjs) and the canvas's own
previews until P5 deletes them (PL-6). Split out of model/invariants.mjs at S-b (H18.12): when the classic link tenant went,
the planner stopped loading them, and only the document invariant stayed the planner's. They move into `network/` with the
link kind at S-e (G5, K13b).
*/

import { straightCapacity, isStraight, pairKey } from './pair-capacity.mjs';
import { linkFacing, samePlane } from './roles.mjs';   // one statement of each, read by the roles and the collapse (V-a)
import { isLoop } from './link-references.mjs';   // the one link whose two ends are one anchor (B299)

/*
B72, ASKED -- the straight links holding a pair against this link: EMPTY when the pair has room for it. ONE HOME for
pair capacity (RULESET-AUDIT T4, F7).

The invariant below REPORTS a pair over its capacity; every place that must decide BEFORE a link exists asks this:
Input's release and replug gates, the network's `judgeDrag`, and the two cascades that strip a link's last bend
(planner/txn.mjs, app/src/commands.js). Before T4 those five each assumed a capacity of one in their own way, and only the
invariant read `straightCapacity` -- so configuring the limit would have changed what the planner accepts and nothing
else. tests/pair-capacity.test.js raises it in a copy of the tree and drives all six.

It answers WHO rather than yes or no, because the network's notice names the link already there ("link-000001 already
joins these two"); the gates and the cascades ask whether the answer is empty.

`among` is the links to judge against -- a caller that holds a narrower or a projected set passes it (the cascades
judge the document as their strip leaves it). A link never counts against itself, so a replug is judged on the
others. `model` is handed to the capacity, which will read the endpoints' kinds once it is configurable.
*/
export function pairHolders(link, among, model = null) {
	if (!isStraight(link)) return [];
	const key = pairKey(link);
	const holders = among.filter((l) => l.id !== link.id && isStraight(l) && pairKey(l) === key);
	const [a, b] = key.split('|');
	return holders.length < straightCapacity(model, a, b) ? [] : holders;
}

/*
B210 -- SPLIT a link at one of its bends, so that linking to a bend makes a junction.

A junction is a MEET: links converge at a point and are CONNECTED there. A link merely bending
through is not meeting anything, so two links crossing at one waypoint would be a crossing rather
than a junction -- a different thing, and one the grid cannot currently express at all.

Rather than admit that case and name it, the topology CHANGES when a junction forms: the link that
bends is cut in two, and both halves terminate at the waypoint. Three links now end there, which is
a meet by construction rather than by convention. "Two links bending through one point" therefore
cannot arise.

Returns the two halves' SHAPES, without ids -- minting those belongs to the caller, which knows the
collection. The original link is replaced rather than mutated into one half: both halves are new,
so nothing holds a stale reference to a route that no longer exists.

The `via` list divides at the split index and the remainder carries to each side, so a link with
several bends keeps the ones on either side of the cut.

REFUSES rather than guessing in two cases. A closed ring has no ends and cutting one is undefined.
A link whose `src` or `dst` is already the split waypoint would produce a self-link -- that state
cannot exist today, because `selfConflict` refuses a waypoint in two roles on one link, so this is
an assertion about the caller rather than a case to handle.
*/
/*
B213 -- COLLAPSE the inverse: two links meeting at a waypoint are a BEND, not a junction.

Ruled by the director: a junction cannot exist with one link in and one link out. That shape is a
path passing THROUGH the point, which is exactly what a bend is, so the document should say so --
`a->w` plus `w->b` becomes `a->b via [w]`.

THE SRC-SIDE ID WINS, meaning the link whose `dst` is the waypoint: it carries the route's original
start, so after a split it is the half that kept the original id. Rejoining therefore restores the
id the author drew, and split-then-collapse is a round trip rather than a churn of identities.

B222 CORRECTS WHAT THIS ONCE REQUIRED, and the superseded reasoning is kept because it reads as
sound. It said: two links both pointing away from a waypoint is a fan rather than a bend, so there
is no src side and nothing to collapse. That is true of DECLARED direction and false of stored
order, and until direction could be declared the code had no way to tell the two apart.

`src` and `dst` record which end the author dragged from. An undeclared link asserts nothing by
storing one end first, so `a->w` plus `w->b` and `w->a` plus `w->b` are the same drawing, and a rule
that collapses the first but not the second is reading an intention nobody expressed.

The consequence was not a wrong merge but a MISSING one, silently: a three-way junction that lost
the link happening to point inward left two outward links, no `inbound`, null, and no further
gesture could recover it -- nothing reverses a link's direction.

So the pair is ORIENTED rather than refused. Whichever link ends at the waypoint is treated as the
src side; if both do, or neither does, one is flipped to face through. Flipping is safe precisely
because the link is undeclared: reversing a symmetric link changes no meaning.

WHEN DIRECTION CAN BE DECLARED this function takes it as an input and the old paragraph comes back
into force for declared links -- two flows both arriving is a convergence and stays a junction. The
matrix is in `docs/spec/ATOMICS.md`. Until then every link is symmetric and only the count matters.

Returns the merged link, or null when the pair cannot describe a path through the point.
*/
/*
H15.3 -- which way a link faces AT a point, and the only direction any rule may read.

`src` and `dst` say which end the author dragged from; `direction` says what the author MEANT. Absent is
undeclared -- the default, and what every link written before this field carries. `forward` means the
flow follows the stored order, `reverse` that it runs against it. (Stored as `flow`, a boolean, until the
format batch renamed it, F1, 2026-10-03.)

Relative to the stored order rather than an end-name because the link already holds two ends. Naming one again would
be a second record of the same fact, free to disagree with `src` and `dst` after any edit that
changes them -- which is the exact shape of defect B222 was.

Returns `in`, `out`, or null. Null covers two different absences and deliberately does not
distinguish them: an undeclared link has no direction anywhere, and a declared link has none at a
point it merely threads. Both mean "this point imposes no direction", which is all a caller needs.

V-a (H18.25): this was `facing`, a twin of `linkFacing` restated while the two lived in `model/` and `kernel/`; both are
in `network/` now, so the collapse reads the one statement (network/roles.mjs).
*/

/*
Flipping carries `direction` with it. A flipped link stores its ends the other way round, so a
declaration expressed relative to that order must invert to mean the same thing -- which is what
makes the B222 orientation safe to keep once declarations exist.
*/
const flip = (l) => ({ ...l, src: l.dst, dst: l.src, ...(l.direction !== undefined ? { direction: l.direction === 'forward' ? 'reverse' : 'forward' } : {}), ...(l.via ? { via: [...l.via].reverse() } : {}) });

export function collapseAtWaypoint(inbound, outbound, waypointId) {
	if (!inbound || !outbound || inbound.id === outbound.id) return null;
	if (inbound.closed || outbound.closed) return null;
	// both must actually TERMINATE here -- a link merely threading the point as a via is not a
	// half of anything, and orienting it would invent an end it does not have
	const ends = (l) => l.src === waypointId || l.dst === waypointId;
	if (!ends(inbound) || !ends(outbound)) return null;
	// face them through the point: the src side ends at it, the dst side leaves it
	const a = inbound.dst === waypointId ? inbound : flip(inbound);
	const b = outbound.src === waypointId ? outbound : flip(outbound);
	if (a.src === b.dst) return null;                           // would be a self-link
	/*
	H15.3 -- THE MERGED LINK'S DECLARATION, decided by what the two halves declare rather than by
	whichever happened to keep its id.

	Both are now oriented to face through the point, so `facing` reads each half at the waypoint:
	the src side should be arriving and the dst side leaving. When both agree the flow passes
	through and the merged link carries it. When only one is declared the merged link inherits it,
	because an undeclared half asserts nothing and cannot contradict.

	Two halves that OPPOSE do not merge here at all -- that pair is a junction, not a bend, and
	the matrix in docs/spec/ATOMICS.md is where that is decided (H15.4). Until the matrix lands
	this cannot be reached: the planner only offers pairs it already believes are a bend.
	*/
	const fa = linkFacing(a, waypointId), fb = linkFacing(b, waypointId);
	if (fa && fb && fa === fb) return null;                     // both arriving or both leaving
	/*
	H15.15 -- A CONTROL LINK AND A DATA LINK DO NOT MERGE.

	A bend requires the planes to match as well as the directions, because a bend means flow passes
	through unchanged and these two carry different things. `samePlane` is the role derivation's own (network/roles.mjs),
	read here since V-a rather than restated -- one place implementing the matrix while another disagreed was B232.
	*/
	if (!samePlane(a, b)) return null;
	const direction = fa ? a.direction : (fb ? b.direction : undefined);
	const via = [...(a.via || []), waypointId, ...(b.via || [])];
	const merged = { ...a, src: a.src, dst: b.dst, via };
	if (direction !== undefined) merged.direction = direction; else delete merged.direction;
	return merged;
}

/*
A LINK'S DECLARATIONS -- the fields an author sets on a link that decide whether two links are compatible: its plane
(`control`) and its direction (`direction`). ONE list, read wherever that question is asked, so a new declaration -- a VLAN,
ruled and not yet built -- is added here once:

  `collapseAtWaypoint` above  compares them, each by its own rule, to decide a join
  `splitAtBend` below         carries them onto both halves of a cut (B284)
  the planner's join          treats an edit that changes one as a mutation that can make two links joinable (B285,
                              model/link-reactions.mjs)

tests/link-declarations.test.js holds the list to `collapseAtWaypoint`: every link field that can change its verdict is
on the list, and every field on the list can. Twice in one day the fields were written out by hand in a second place.
*/
export const LINK_DECLARATIONS = ['control', 'direction'];

/*
B284 -- A HALF KEEPS THE LINK'S DECLARATIONS, whatever cut made it. Each caller built the rest of a half itself, and two
lost them -- a control link came back from a cut as data (the director's report, 2026-10-02). A cut keeps the stored
order, so a direction reads the same on both halves. Only what the link declared is carried: an undeclared link stays
undeclared, with no field invented.
*/
export function splitAtBend(link, waypointId) {
	if (link.closed) return null;                       // a ring has no ends to cut toward
	if (link.src === waypointId || link.dst === waypointId) return null;   // would be a self-link
	const via = Array.isArray(link.via) ? link.via : [];
	const at = via.indexOf(waypointId);
	if (at === -1) return null;                         // not a bend of this link
	const declared = Object.fromEntries(LINK_DECLARATIONS.filter((k) => k in link).map((k) => [k, link[k]]));
	const half = (src, dst, v) => ({ ...declared, src, dst, ...(v.length ? { via: v } : {}) });
	return [half(link.src, waypointId, via.slice(0, at)), half(waypointId, link.dst, via.slice(at + 1))];
}

/*
H17-D10 -- A CUT'S NEW PIECE HAS AN ID DERIVED FROM THE CUT: from the link cut and the anchor it is cut at, the next free one
above on a clash. So every peer that plans the same edit on the same document mints the same piece -- the browser's preview
and the server's answer agree (PL-6). Transit's cut minted this way first (network/transit.mjs); since V-c (H18.27) the
junction cut does too, so the rule lives here, beside `splitAtBend`.
*/
const hexOf = (id) => id.slice(id.indexOf('-') + 1);
function pieceId(doc, from, at) {
	let n = (parseInt(hexOf(from), 16) ^ parseInt(hexOf(at), 16)) & 0xffffff;
	for (;;) {
		const id = `link-${n.toString(16).padStart(6, '0')}`;
		if (!doc.get('link', id)) return id;
		n = (n + 1) & 0xffffff;
	}
}

/*
B299 (ruled 2026-10-07) -- A RING OPENED AT ONE OF ITS STOPS, and a loop closed again: transit's answer for a ring, which has
no ends to cut toward. Opened at `at`, the ring's stops are turned to start there and the link becomes a LOOP that starts
and ends at it (network/link-references.mjs `isLoop`), running every leg of the ring, its closing leg among them, so it is
drawn where it was. Closed again, the loop becomes a ring through the same stops, starting at its end. Each is one put of
the link the author drew: its id, its order, its name and its declarations kept -- a direction reads the same, since the
stops keep their order round the ring. Null when there is nothing to do.
*/
export function openRingAt(link, at) {
	if (!link.closed) return null;
	const stops = [link.src, ...(Array.isArray(link.via) ? link.via : []), link.dst];
	const i = stops.indexOf(at);
	if (i === -1 || stops.length < 3) return null;
	const round = [...stops.slice(i), ...stops.slice(0, i)];   // `at` first, the rest in the ring's order
	const { closed: _c, ...rest } = link;
	return [{ op: 'put', kind: 'link', entity: { ...rest, src: at, via: round.slice(1), dst: at } }];
}
export function closeLoop(link) {
	if (!isLoop(link)) return null;
	return [{ op: 'put', kind: 'link', entity: { ...link, via: link.via.slice(0, -1), dst: link.via[link.via.length - 1], closed: true } }];
}

/*
A LINK CUT AT A BEND, as ops: the link re-ended at it -- keeping its id, its order and its declarations (B213, B284) -- and
its new piece, the newest, with a derived id. Null when it does not bend there. One shape for every cut: transit's and the
junction's.
*/
export function cutAtBend(doc, link, at) {
	const halves = splitAtBend(link, at);
	if (!halves) return null;
	const { via: _drop, ...rest } = link;
	const [first, second] = halves;
	const piece = { ...second, id: pieceId(doc, link.id, at), name: doc.nextName('link'), order: doc.nextOrder('link') };
	return [{ op: 'put', kind: 'link', entity: { ...rest, ...first } }, { op: 'put', kind: 'link', entity: piece }];
}
