/*
A path resolver for the Model -- routes a link over pipes, for the incubating network plugin.

This is what the lab hands to `new Model({ resolvePath })`, the interface declared in
`model/model.mjs` so the incubator could change how links are drawn without patching a product
module (G1). Production constructs `new Model()` and never meets this.

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

import { routeLink } from './pipes.mjs';

/*
The ONE route computation everything here answers from, read from the pipe set on EVERY call.

Where a link is drawn, which anchors its drawing depends on, and whether it is down are three answers to
one question. Computed three ways they could disagree -- a link drawn along a route while called down --
which is the one-fact-two-authorities defect this programme exists to end. Read live rather than
captured, because pipes change with each edit and a snapshot would route over pipes that are gone.
*/
const routeOf = (pipeSet, link) => routeLink(pipeSet.list(), { src: link.src, dst: link.dst, via: link.via ?? [] });

/*
Build a resolver over a live pipe set -- what the lab hands to `new Model({ resolvePath })`.
*/
export function pipeResolver(pipeSet) {
	return (link, model, straight) => {
		const route = routeOf(pipeSet, link);
		if (!route) return straight(link);   // DOWN: drawn along its intent, and `pipeLinkDown` says so

		// ids to positions. An anchor the route names but the model cannot resolve means the pipe
		// set and the document disagree, and a half-drawn path would hide that -- so defer instead.
		const points = [];
		for (const id of route) {
			const at = model.endpointOf(id);
			if (!at) return straight(link);
			points.push([at.x, at.y]);
		}
		return points;
	};
}

/*
Which links are drawn THROUGH an anchor -- the companion the Model takes beside `resolvePath`.

Built from the same route as the resolver above, so the two cannot disagree: if this module draws a
link through an anchor, it also says so when that anchor moves. Before it existed the renderer asked
the incidence index, which knows only a link's ends and pins -- and a guided link, which routes through
an anchor it does not name, stayed put while its pipes followed the moved anchor.

Links the anchor already ENDS or PINS are included too; the renderer redraws those by its own index as
well, and redrawing a link twice in one change is harmless where missing one is the defect.
*/
export function pipeDependents(pipeSet) {
	return (anchorId, model) => model.all('link').filter((link) => {
		const route = routeOf(pipeSet, link);
		return !!route && route.includes(anchorId);
	});
}

/*
Whether a link is DOWN -- the third companion, handed to `new Model({ linkDown })`.

Down is exactly "no route", from the same route the resolver draws, so a link is drawn along a route
precisely when it is not down. It is not stored and nothing clears it: the moment a way returns, the
next read finds the route and the link is live again -- which is what "heals" means.
*/
export function pipeLinkDown(pipeSet) {
	return (link) => !routeOf(pipeSet, link);
}
