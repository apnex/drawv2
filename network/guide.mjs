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
	if (!route) return { ok: false, reason: 'no route between the ends over the pipes' };

	const missed = guides.filter((g) => !route.includes(g));
	if (missed.length) {
		return { ok: false, reason: `the fewest-pipes route skips ${missed.join(', ')} -- a shorter way already exists, so a guide there would be ignored` };
	}
	return { ok: true, legs, route };
}

/*
Every anchor a pipe touches -- what the planner's orphan sweep must count as referenced.

Handed to `commit(..., { alsoReferenced })`. Without it the planner, which cannot see session pipes,
sweeps an anchor that pins one link and guides another the moment the pinning link is deleted, and
the guided route breaks (measured; tests/sweep-references.test.js).
*/
export function pipeAnchors(pipes, alive = null) {
	const ids = new Set();
	for (const { a, b } of pipes) {
		// a pipe references its anchors only while BOTH exist -- judged against the model the planner
		// hands the provider, so a pipe whose other end this very transaction deletes shelters nothing
		if (alive && (!alive(a) || !alive(b))) continue;
		ids.add(a); ids.add(b);
	}
	return ids;
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
