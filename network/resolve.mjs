/*
A path resolver for the Model -- routes a link over pipes, for the incubating network plugin.

This is what the lab hands to `new Model({ resolvePath })`, the interface declared in
`model/model.mjs` so the incubator could change how links are drawn without patching a product
module (G1). Production constructs `new Model()` and never meets this.

THE RULE, from the rulings rather than invented here:
  - a link's intent is its ends plus its pinned vias (2026-09-26)
  - between consecutive pins the route is the fewest pipes (SD9)
  - a leg with no route leaves the link DOWN, not partial (2026-09-25, "down, and heals")

TWO PLACES IT DEFERS TO THE STRAIGHT POLYLINE, and both are deliberate:
  - when there are NO PIPES at all. A board with no pipes is a board the author has not laid
    yet, and drawing every link as unroutable would make the lab useless until the first pipe.
    Deferring keeps the canvas meaningful while the pipe layer is empty.
  - when a link is DOWN. Production has no notion of a down link to draw, and inventing an
    appearance for it here would be designing in the wrong place. The straight line is honest --
    it shows the intent -- and how a down link LOOKS belongs with the appearance pipeline (H15.9).
*/

import { routeLink } from './pipes.mjs';

/*
Build a resolver over a live pipe set.

It reads the set on EVERY call rather than capturing its contents, because pipes change with each
edit and a resolver holding a snapshot would draw links along pipes that no longer exist -- a
second authority for the pipe set, which is the defect family this whole programme exists to end.
*/
export function pipeResolver(pipeSet) {
	return (link, model, straight) => {
		const pipes = pipeSet.list();
		if (!pipes.length) return straight(link);

		const route = routeLink(pipes, { src: link.src, dst: link.dst, via: link.via ?? [] });
		if (!route) return straight(link);

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
	return (anchorId, model) => {
		const pipes = pipeSet.list();
		if (!pipes.length) return [];
		return model.all('link').filter((link) => {
			const route = routeLink(pipes, { src: link.src, dst: link.dst, via: link.via ?? [] });
			return !!route && route.includes(anchorId);
		});
	};
}
