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

import { assignRoutes, preferredRoute, blockersOf } from './pipes.mjs';

/*
The ONE route computation everything here answers from, read from the pipe set on EVERY call.

Where a link is drawn, which anchors its drawing depends on, whether it is down and what blocks it are four
answers to one question. Computed apart they could disagree -- a link drawn along a route while called down --
which is the one-fact-two-authorities defect this programme exists to end. Read live rather than captured,
because pipes change with each edit and a snapshot would route over pipes that are gone.

Since pipes carry one link each (ruled 2026-09-30), a link's route depends on every other link, so a link the
model holds is routed as part of the whole board (`assignRoutes`), with `rankOf` saying which links are older.
A link the model does not hold -- the live drag preview -- is routed alone, by the same rule of which pipes it
may use.
*/
const routeOf = (pipeSet, link, model, rankOf) => (link.id && model?.get('link', link.id)
	? assignRoutes(pipeSet.list(), model.all('link'), { rankOf }).get(link.id) ?? null
	: preferredRoute(pipeSet.list(), link));

/*
Build a resolver over a live pipe set -- what the lab hands to `new Model({ resolvePath })`.
*/
export function pipeResolver(pipeSet, rankOf) {
	return (link, model, straight) => {
		const route = routeOf(pipeSet, link, model, rankOf);
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

Built from the same routes as the resolver above, so the two cannot disagree: if this module draws a link
through an anchor, it also says so when that anchor moves. Before it existed the renderer asked the incidence
index, which knows only a link's ends and pins -- and a guided link, which routes through an anchor it does not
name, stayed put while its pipes followed the moved anchor.
*/
export function pipeDependents(pipeSet, rankOf) {
	return (anchorId, model) => {
		const routes = assignRoutes(pipeSet.list(), model.all('link'), { rankOf });
		return model.all('link').filter((link) => routes.get(link.id)?.includes(anchorId));
	};
}

/*
Whether a link is DOWN -- the third companion, handed to `new Model({ linkDown })`.

Down is exactly "no route", from the same routes the resolver draws, so a link is drawn along a route precisely
when it is not down. It is not stored and nothing clears it: the moment a way returns -- or the link holding it
goes -- the next read finds the route and the link is live again, which is what "heals" means.
*/
export function pipeLinkDown(pipeSet, rankOf) {
	return (link, model) => !routeOf(pipeSet, link, model, rankOf);
}

/*
Which links BLOCK a down link -- the fourth companion, handed to `new Model({ blockedBy })` (ruled 2026-09-30):
the links holding a pipe on the way it would take if nobody held anything. The renderer highlights them when
the down link is selected, so the author can see the path in the way.
*/
export function pipeBlockers(pipeSet, rankOf) {
	return (link, model) => (model?.get('link', link.id) ? blockersOf(pipeSet.list(), model.all('link'), link.id, { rankOf }) : []);
}

/*
What the notice says, read from the Model's own answers -- kept here so the lab's composition stays wiring.

`whyDown` explains a SELECTED down link: blocked by a named link, or with no way at all. `downSummary` is the
count after an edit. A down link is "ready to heal" either way: it comes back when a way returns or frees.
*/
export function whyDown(model, ids) {
	const down = ids.map((id) => model.get('link', id)).filter((l) => l && model.isLinkDown(l));
	if (down.length !== 1) return null;
	const by = model.blockersOf(down[0]);
	return by.length
		? `${down[0].id} is down: its way is held by ${by.join(', ')} -- a pipe carries one link, and the older link keeps it`
		: `${down[0].id} is down: no way over the pipes it may use -- it heals when one is laid`;
}

export function downSummary(model) {
	const n = model.all('link').filter((l) => model.isLinkDown(l)).length;
	return n ? ` -- ${n} link${n === 1 ? '' : 's'} down, ready to heal` : '';
}
