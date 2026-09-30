/*
Guided routes -- the whole-route check a `g` drag needs, for the incubating network plugin.

INCUBATING (ruled 2026-09-28). The lab hands this to the canvas as its route hook; production
constructs no hook, so the `g` key is inert there and nothing here can reach draw.apnex.io.

WHAT A GUIDE IS. `w` during a link drag drops an anchor and PINS the link to it: the anchor joins the
link's intent (its ends plus pinned vias, ruled 2026-09-26). `g` drops an anchor and lays a pipe to
it WITHOUT pinning. The link passes it only because the pipes run that way, which is the ruled
meaning of a routed stretch: a link crosses the points its route passes and connects only at its
ends and its pins. The difference shows later, when another link LANDS on the anchor -- a landing
cuts a link that pins the point and crosses one that merely passes it.

WHY THE CHECK IS WHOLE-ROUTE (the director's distinction, dev/design/unification/GUIDE-ANCHORS.md
section 4). A `w` drag needs no end-to-end check: every hop is pinned by hand, each leg lays a direct
pipe, and a direct pipe is by construction the fewest-pipes way between its two pins -- so the drawn
route IS the derived route, leg by leg. A guide is not in the intent, so whether the route actually
passes it is a property of the whole route over all the pipes, and cannot be known leg by leg.
A guide the fewest-pipes route would skip -- because a shorter way already exists -- is refused, with
the guide named, rather than committed as a link that silently ignores what the author drew.
CORRECTED 2026-09-30: no longer refused. The director ruled "Link runs the shorter way": the link is made on
the fewest-pipes way, the path drawn is kept as its alternate, and the notice names the guides it skips.

PURE. The check computes over a copy of the pipe list and returns the legs to lay; it lays nothing.
The caller lays them only after the planner accepts the link, so a refused link leaves no pipes.
*/

import { pipeKey, assignRoutes, preferredRoute, blockersOf } from './pipes.mjs';

/*
JUDGE A FINISHED DRAG -- ruled 2026-09-30, "Each drag action does one thing" (dev/DECISIONS.md).

The director: "A "left-click-drag" from a source anchor is an undefined intent - the very next action decides what
it is - a "w", a "g", or a plain "mouse-up" on another anchor. "w" pins a link, and determines it will also produce a
link, and dynamically route from that first w pin to either the next w, or the destination". So:

  any w          a LINK, pinned at each w anchor, routing between pins over the pipes
  g and no w     anchors and pipes by hand, and NO link
  neither        a LINK that lays no pipes -- "must use existing infra"

and a link with no free way is made DOWN ("Made, but down"), naming what holds its way.

`drag` is what Input saw: the ends, the stops in drawn order, which are pins (w) and which are guides (g), the
anchors the drag placed, which keys were pressed (`pressed`), and how the end was reached (`endPressed`: 'w', 'g',
or false for a release on an anchor with no key). Each key lays the pipe INTO its own stop, and the release lays the
final pipe whenever a key made a hop before it; only a drag that pressed no key lays no pipe (ruled 2026-09-30). A pipe touching a g anchor is laid BY HAND and outlives any link (GUIDE-ANCHORS T4); every
other pipe a w drag lays goes with its link (ruled 2026-09-27).

PURE: it lays nothing. The caller lays `legs` once the planner accepts what they belong to. The answer carries
`ok` (a link is made), `legs`, `keep` (anchors to keep when no link is made), `route` (null when made down), and
`notice`, the sentence the author sees -- absent when things went as drawn.
*/
export function judgeDrag(pipes, { src, dst, pins = [], guides = [], placed = [], stops, pressed = { w: false, g: false }, endPressed = false, srcKey = false }, { links = [], rankOf = () => 0 } = {}) {
	const guided = new Set(guides);
	/*
	The w that placed the source is the drag's first key (2026-09-30), and "A g in the drag cancels it": a drag's kind is
	decided by the keys pressed DURING it -- a w hop makes a link, g without one lays pipes only -- so the source w never
	turns a g drag into a link. It adds only the final pipe, with the link, when nothing else was pressed.
	*/
	const srcW = srcKey === 'w';
	const pipesOnly = !pressed.w && pressed.g;
	const legs = [];
	for (let i = 0; i < stops.length - 1; i++) {
		const a = stops[i], b = stops[i + 1];
		// the release lays the final pipe whenever a key made a hop before it -- with the link after w, by hand after g --
		// and only a drag that pressed no key lays none (2026-09-30: "If penultimate hop was a key (g or w) - final pipe
		// is laid. Direct links without a key lay no pipe.")
		if (a === b || (b === dst && !endPressed && stops.length === 2 && !srcW)) continue;
		const byHand = pipesOnly || guided.has(a) || guided.has(b) || (b === dst && endPressed === 'g');
		legs.push({ a, b, laid: byHand ? 'hand' : 'link' });
	}
	const seen = new Set(pipes.map((p) => pipeKey(p.a, p.b)));
	const fresh = legs.filter((l) => !seen.has(pipeKey(l.a, l.b)));
	const would = [...pipes, ...fresh];
	const pipes_ = (n) => `${n} pipe${n === 1 ? '' : 's'}`;
	const healed = (before, after) => links.filter((l) => !before.get(l.id) && after.get(l.id)).map((l) => l.id);

	if (pipesOnly) {
		const heals = healed(assignRoutes(pipes, links, { rankOf }), assignRoutes(would, links, { rankOf }));
		return { ok: false, legs, keep: placed, heals,
			notice: `${pipes_(fresh.length)} laid by hand -- g lays pipes, not links${heals.length ? `; ${heals.join(', ')} healed` : ''}` };
	}

	// a pair takes one unpinned link (B72); say so, rather than let the planner refuse it unexplained
	const twin = !pins.length && links.find((l) => !(l.via ?? []).length && ((l.src === src && l.dst === dst) || (l.src === dst && l.dst === src)));
	if (twin) return { ok: false, legs: [], keep: [], notice: `${twin.id} already joins these two, and a pair takes one unpinned link -- pin a bend with w to draw another` };

	// the drawn link is the NEWEST: it sorts after every link there, unranked ones included
	const drawn = { id: '\uffff drawn', src, dst, via: pins };
	const opts = { rankOf: (id) => (id === drawn.id ? Infinity : rankOf(id)) };
	const before = assignRoutes(pipes, links, opts);
	const after = assignRoutes(would, [...links, drawn], opts);
	const route = after.get(drawn.id) ?? null;
	const heals = healed(before, after);

	// ruled 2026-09-30: "a drag that would move an existing link is refused" -- the g geometry is still kept
	const moves = links.filter((l) => before.get(l.id) && JSON.stringify(before.get(l.id)) !== JSON.stringify(after.get(l.id))).map((l) => l.id);
	if (moves.length) {
		const kept = keptOnRefusal({ legs }, { guides, placed });
		return { ok: false, legs: kept.legs, keep: kept.keep, moves,
			notice: `refused: it would move ${moves.join(', ')}, which keeps its way -- the link is refused${kept.keep.length ? '; the g anchors and their pipes are kept' : ''}` };
	}
	/*
	MADE DOWN, with no sentence of its own: the new link is selected the moment it is made, and a selected down link
	already says why it is down (network/resolve.mjs `whyDown`). Two sentences for one fact would drift apart, so this
	returns the facts -- no route, and who holds its way -- and the one sentence stays where the author reads it.
	*/
	if (!route) return { ok: true, legs, route, heals, blockers: blockersOf(would, [...links, drawn], drawn.id, opts) };
	/*
	A g HOP THE LINK SKIPS does not refuse (2026-09-30, "Link runs the shorter way"): the link runs the fewest-pipes way,
	the path drawn is kept as its alternate, and the notice says why -- the way taken is SHORTER than the one drawn,
	EQUAL and picked by the router's fixed tie order, or LONGER because part of the way drawn is held.
	*/
	const skipped = guides.filter((g) => !route.includes(g));
	if (!skipped.length) return { ok: true, legs, route, heals };
	const asDrawn = legs.length, best = route.length - 1;
	const why = best < asDrawn ? `a shorter way (${pipes_(best)}, against the ${asDrawn} drawn)`
		: best === asDrawn ? `another way just as short (${pipes_(best)}), which the router's fixed tie order picks`
		: `another way (${pipes_(best)}), because part of the way drawn is held by another link`;
	return { ok: true, legs, route, heals, skipped, notice: `the link runs ${why}, not through ${skipped.join(', ')}; the g path drawn is kept as its alternate` };
}

/*
The anchors the pipes reference IN A GIVEN MODEL -- what the planner's orphan sweep must count.

Handed to `commit(..., { alsoReferenced })`, which asks it of the document before the edit and after.
A pipe references its anchors only while it SURVIVES in that model:

  - both of its ends exist there, since a pipe is its pair (SD7); and
  - it was laid by hand, or some link in that model still runs over it -- a pipe laid with a link goes
    once no link remains on it (ruled 2026-09-27).

The first version counted every pipe in the session, and that was wrong in a way the director found by
hand: delete a link built as a chain of `w` anchors, and its own pipes -- which are swept a moment later,
because they die with it -- were still standing when the planner judged the edit, and sheltered the very
pins that should have gone. Judged against the model the planner hands over, those pipes carry no link
after the delete, so they shelter nothing, and the pins are swept as the product always swept a deleted
link's bends.
*/
// whether an anchor exists in a model -- a pipe survives an edit only while both of its ends do (SD7)
const anchorIn = (model) => (id) => !!(model.get('node', id) || model.get('waypoint', id));

export function pipeAnchors(net, model) {
	// read from the network view, as drawing and the sweep are (RULESET-AUDIT T2): the pipes this model can see, and
	// the routes over them -- one derivation, so what shelters an anchor is what is drawn
	const view = net.of(model);
	const carried = new Set();
	for (const r of view.inUse()) for (let i = 0; i < r.length - 1; i++) carried.add(pipeKey(r[i], r[i + 1]));
	const ids = new Set();
	for (const { a, b, laid } of view.pipes) {
		if (laid !== 'hand' && !carried.has(pipeKey(a, b))) continue;
		ids.add(a); ids.add(b);
	}
	return ids;
}

/*
Whether a link that LOST A PIN is left with no way -- the network's `isStranded`, asked by the planner, ruled 2026-09-29.

Asked, for a w-chain S-P1-P2-P3-E with P2 deleted and no other way, the director chose "Delete the
whole link" over "Stay, shown down": the link goes, and with it its w anchors and the pipes laid with
it, while g anchors and hand pipes stay. With another way open it re-routes (ruled 2026-09-26).

Judged over the pipes that SURVIVE in the model the planner hands over -- both ends standing -- because
a pipe to an anchor the edit deletes is not a pipe. A pipe laid with some other link counts: routed over
it, this link would carry it, and the sweep keeps what a link carries. Sweeping only ever removes pipes,
so no route here means none after the sweep either.

The planner asks only about a link whose pin the edit deleted. Losing a route any other way -- the
g anchor it passed deleted, say -- leaves the link DOWN, drawn dotted and ready to heal.
*/
export function isStranded(pipes, link, model) {
	const alive = anchorIn(model);
	/*
	The PREFERRED route, ignoring who holds a pipe -- the proposer's reading, recorded 2026-09-30: a way another
	link holds is a way that is full, not a way that is gone, so the link stays (down, and blocked) and heals when
	the holder goes. Only pipes it may use count: a pipe laid with another link carries only that link.
	*/
	return !preferredRoute(pipes.filter(({ a, b }) => alive(a) && alive(b)), link);
}

/*
What a REFUSED drag keeps -- the director's report (2026-09-29): a refused `g` drag threw away the `g`
anchor and its pipes, geometry the author placed deliberately.

Refusal refuses the LINK. The `g` anchors survive, and so do the pipes laid by hand to them (T4: the
author chose that geometry), so the author keeps what they drew and can use it -- pin it with `w`, or
remove the pipe that won the route. What the drag placed for the link alone -- its `w` anchors -- goes
with the link, and so does any pipe that would end at one of them, since a pipe is its pair (SD7).

`placedKept` says which kept anchors are new: those reach the planner in the commit Input makes next,
and their pipes are laid once it accepts; if every kept anchor already existed, nothing is waiting.
*/
function keptOnRefusal(verdict, { guides = [], placed = [] }) {
	const guided = new Set(guides);
	const discarded = new Set(placed.filter((id) => !guided.has(id)));
	const legs = (verdict.legs ?? []).filter((l) => l.laid === 'hand' && !discarded.has(l.a) && !discarded.has(l.b));
	return { keep: guides, legs, placedKept: placed.filter((id) => guided.has(id)) };
}

/*
Which orphaned anchors the network model keeps beyond what references them: NONE -- ruled 2026-09-29.

The network's `keepsOrphan`, asked by the planner. Production keeps an orphaned anchor if the author pinned it
(B162) or it was a link's end (B216). The director ruled that in the network model "deliberate" means
HELD BY THE PIPES LAID WITH g, so anchors made with w go when their last link goes -- ends included, the
director confirming: "No - it goes just as ruled." A g anchor survives because its hand pipes reference
it, which reaches the sweep through `alsoReferenced`; nothing else needs to shelter anything.

The sweep reads only waypoints, so nodes are never orphans at all -- a KIND distinction. The director's
proposal, recorded and not yet built: "survives last link deleted" is a capability injected to an anchor,
carried by servers, hosts and routers and not by a bare anchor, which would unify how every anchor
behaves under one rule. When the device table lands (SD4), this function is where it reads that column.
*/
export const keepsOrphan = () => false;
