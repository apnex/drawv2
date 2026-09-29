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

PURE. The check computes over a copy of the pipe list and returns the legs to lay; it lays nothing.
The caller lays them only after the planner accepts the link, so a refused link leaves no pipes.
*/

import { routeLink, pipeKey } from './pipes.mjs';

/*
Check a drawn route, and say which pipes it would lay.

`stops` is every anchor the author passed through, in drawn order, from source to destination --
pins and guides alike. `pins` is the subset the link will STORE. `guides` is the rest.

Each leg between consecutive stops lays a pipe. A leg touching a guide is laid BY HAND, so it
outlives the link (GUIDE-ANCHORS.md T4: the author chose that geometry, and a pipe that vanished when
a cheaper route appeared elsewhere would delete it, with no way back). Every other leg is laid WITH
THE LINK, and goes when no link remains on it (ruled 2026-09-27).
*/
export function checkGuidedRoute(pipes, { src, dst, pins = [], guides = [], stops }) {
	const guided = new Set(guides);
	const legs = [];
	for (let i = 0; i < stops.length - 1; i++) {
		const a = stops[i], b = stops[i + 1];
		if (a === b) continue;
		legs.push({ a, b, laid: guided.has(a) || guided.has(b) ? 'hand' : 'link' });
	}

	// the pipes as they WOULD be, without touching the caller's set
	const seen = new Set(pipes.map((p) => pipeKey(p.a, p.b)));
	const would = [...pipes, ...legs.filter((l) => !seen.has(pipeKey(l.a, l.b)))];

	const route = routeLink(would, { src, dst, via: pins });
	if (!route) return { ok: false, legs, reason: 'no route between the ends over the pipes' };

	/*
	SAY WHAT IS TRUE about why a guide is skipped. The drawn way is one pipe per leg; the fewest-pipes route
	can be SHORTER, or merely EQUAL and chosen by the router's fixed tie order (sorted ids, so two peers
	agree). The first version said "a shorter way already exists" in both cases -- the director met it on
	a tie, two pipes against two, which the author cannot fix by drawing a shorter guide route, because
	theirs was already as short as it gets.
	*/
	const missed = guides.filter((g) => !route.includes(g));
	if (missed.length) {
		const drawn = legs.length, best = route.length - 1;
		const pipes_ = (n) => `${n} pipe${n === 1 ? '' : 's'}`;
		const why = drawn === best
			? `another way is just as short (${pipes_(best)}) and wins the tie, which the router breaks in a fixed order`
			: `a shorter way exists (${pipes_(best)}, against the ${drawn} drawn)`;
		return { ok: false, legs, reason: `the route over the pipes does not pass ${missed.join(', ')}: ${why}` };
	}
	return { ok: true, legs, route };
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

export function pipeAnchors(pipes, model) {
	const alive = anchorIn(model);
	const carried = new Set();
	for (const r of routesOf(pipes, model.all('link'))) for (let i = 0; i < r.length - 1; i++) carried.add(pipeKey(r[i], r[i + 1]));
	const ids = new Set();
	for (const { a, b, laid } of pipes) {
		if (!alive(a) || !alive(b)) continue;
		if (laid !== 'hand' && !carried.has(pipeKey(a, b))) continue;
		ids.add(a); ids.add(b);
	}
	return ids;
}

/*
Whether a link that LOST A PIN is left with no way -- the planner's `isStranded`, ruled 2026-09-29.

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
	const surviving = pipes.filter(({ a, b }) => alive(a) && alive(b));
	return !routeLink(surviving, { src: link.src, dst: link.dst, via: link.via ?? [] });
}

/*
The route every link takes, for sweeping the pipes laid with links.

A link with no route is DOWN, and a down link keeps its own drawn legs so it can heal onto them --
the proposer reading recorded under the 2026-09-27 lifetime ruling. So a down link contributes the
legs of its intent (its ends and pins in order) rather than nothing; otherwise sweeping would remove
the very pipes it needs to come back.
*/
export function routesOf(pipes, links) {
	return links.map((l) => routeLink(pipes, { src: l.src, dst: l.dst, via: l.via ?? [] }) ?? [l.src, ...(l.via ?? []), l.dst]);
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
export function keptOnRefusal(verdict, { guides = [], placed = [] }) {
	const guided = new Set(guides);
	const discarded = new Set(placed.filter((id) => !guided.has(id)));
	const legs = (verdict.legs ?? []).filter((l) => l.laid === 'hand' && !discarded.has(l.a) && !discarded.has(l.b));
	return { keep: guides, legs, placedKept: placed.filter((id) => guided.has(id)) };
}

/*
Which orphaned anchors the network model keeps beyond what references them: NONE -- ruled 2026-09-29.

Handed to the planner as `keepsOrphan`. Production keeps an orphaned anchor if the author pinned it
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
