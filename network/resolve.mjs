/*
A path resolver for the Model -- routes a link over pipes, for the incubating network plugin.

These are the Model's four methods of the network interface, composed into one object by
`network/network.mjs` and declared in `model/model.mjs` so the incubator could change how links are
drawn without patching a product module (G1). Production constructs `new Model()` and never meets this.

THE RULE, from the rulings rather than invented here:
  - a link's intent is its ends plus its pinned vias (2026-09-26)
  - between consecutive pins the route is the fewest pipes (SD9)
  - a leg with no route leaves the link DOWN, not partial (2026-09-25, "down, and heals")

A DOWN LINK is drawn along its intent -- straight between its ends, through any pins -- and LOOKS down:
dotted, "ready to heal", as the director described it (2026-09-29). This module says WHETHER a link is
down (`pipeLinkDown`); how down looks is the appearance pipeline's (kernel `linkAppearance`), which is
where the first version of this comment said it belonged when it drew a down link as a plain line.
That plain line read as a live link -- as a pipe created by itself, in the director's report.

NO PIPES IS NO ROUTE. There used to be a second exception: with no pipes at all, the resolver drew the
straight line as if the board were not yet laid. In the lab every link is laid with its pipes, so an
empty pipe layer is a board whose routes were REMOVED -- deleting the anchor the cross board ran through
takes its last four -- and the exception drew those lost links as live. Measured, and removed.
*/

import { isLinkDown, blockersOf } from './network-queries.mjs';   // the network's questions over a Model (Q-a)
import { preferredRoute } from './pipes.mjs';

/*
EVERY ANSWER HERE READS ONE DERIVATION: the network view (network/view.mjs), which works each board state out once
(RULESET-AUDIT T2). Where a link is drawn, which anchors its drawing depends on, whether it is down and what blocks it
are four answers to one question; before T2 each worked the board out afresh -- MEASURED 9 to 15 times per edit.
A link the model does not hold -- the live drag preview -- is routed alone, over the pipes that model can see.
*/
const held = (link, model) => !!(link.id && model?.get('link', link.id));
const routeOf = (net, link, model) => (held(link, model)
	? net.of(model).route(link.id)
	: preferredRoute(net.of(model).pipes, link, net.of(model).passes));

/*
F11 (RULESET-AUDIT) -- the LIVE PREVIEW through its stops, when it has no way over the pipes. The preview is a link the
model does not hold, whose stops may be nodes: the network's `w` on a node adds one (network/keys.mjs). The straight
polyline admits only waypoints as bends -- rightly, since a stored link's bends always are -- so a node stop made it
null and the preview froze where the node was pressed. Here every stop is an anchor, node or waypoint, or a position.
*/
function throughStops(link, model) {
	const at = (ref) => (ref && typeof ref === 'object' ? ref : model.endpointOf(ref));
	const points = [link.src, ...(link.via ?? []), link.dst].map(at);
	return points.every(Boolean) ? points.map((p) => [p.x, p.y]) : null;
}

/*
Build a resolver over the network view -- the network's `pathOf`.
*/
export function pipeResolver(net) {
	return (link, model, straight) => {
		const route = routeOf(net, link, model);
		if (!route) return straight(link) ?? (held(link, model) ? null : throughStops(link, model));   // DOWN: drawn along its intent, and `pipeLinkDown` says so

		// ids to positions. The view routes only over pipes whose ends the model holds, so every id resolves;
		// deferring when one does not is a guard, not a path.
		const points = [];
		// a ring's route returns to its start (F-f); the drawing closes itself, so the start is not drawn twice
		const ids = link.closed && route.length > 2 && route[route.length - 1] === route[0] ? route.slice(0, -1) : route;
		for (const id of ids) {
			const at = model.endpointOf(id);
			if (!at) return straight(link);
			points.push([at.x, at.y]);
		}
		return points;
	};
}

/*
Which links are drawn THROUGH an anchor -- the network's `linksRoutedThrough`, beside `pathOf`. The view answers ids;
the links are read from the model asking, so a caller never redraws a link object older than its own.
*/
export function pipeDependents(net) {
	return (anchorId, model) => net.of(model).through(anchorId).map((id) => model.get('link', id)).filter(Boolean);
}

/*
Whether a link is DOWN -- the network's `isLinkDown`. Down is exactly "no route", from
the same derivation the resolver draws from, so a link is drawn along a route precisely when it is not down. Nothing
is stored and nothing clears it: the moment a way returns -- or the link holding it goes -- the next board state is
worked out, the route is found, and the link is live again, which is what "heals" means.
*/
export function pipeLinkDown(net) {
	return (link, model) => !routeOf(net, link, model);
}

/*
Which links BLOCK a down link -- the network's `blockersOf` (ruled 2026-09-30).
*/
export function pipeBlockers(net) {
	return (link, model) => (model?.get('link', link.id) ? net.of(model).blockers(link.id) : []);
}

/*
What the notice says, read from the Model's own answers -- kept here so the lab's composition stays wiring.

`whyDown` explains a SELECTED down link: blocked by a named link, or with no way at all. `downSummary` is the
count after an edit. A down link is "ready to heal" either way: it comes back when a way returns or frees.
*/
export function whyDown(model, ids, network = null) {
	const down = ids.map((id) => model.get('link', id)).filter((l) => l && isLinkDown(model, l));
	if (down.length !== 1) return null;
	const by = blockersOf(model, down[0]);
	if (by.length) return `${down[0].id} is down: its way is held by ${by.join(', ')} -- a pipe carries one link, and the older link keeps it`;
	// its way would pass an anchor whose transit is off (TR-1): name what the author can turn back on, or else the device
	// whose type never passes a route
	const name = (id) => model.endpointOf(id)?.name || id;
	const { declared = [], types = [] } = network ? network.transitBlocking(down[0], model) : {};
	if (declared.length) return `${down[0].id} is down: its way passes ${declared.map(name).join(' or ')}, whose transit is off -- it heals when transit is turned back on`;
	if (types.length) return `${down[0].id} is down: its way passes ${types.map((id) => `${name(id)}, a ${model.endpointOf(id)?.type}`).join(', ')}, which never passes routes`;
	return `${down[0].id} is down: no way over the pipes it may use -- it heals when one is laid`;
}

export function downSummary(model) {
	const n = model.all('link').filter((l) => isLinkDown(model, l)).length;
	return n ? ` -- ${n} link${n === 1 ? '' : 's'} down, ready to heal` : '';
}
