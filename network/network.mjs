/*
The network plugin, as ONE object -- step T1 of the ruleset audit (dev/design/unification/RULESET-AUDIT.md).

The product asks the network seven questions: the Model four while drawing (`pathOf`, `linksRoutedThrough`,
`isLinkDown`, `blockersOf`) and the planner three while judging an edit (`alsoReferenced`, `keepsOrphan`,
`isStranded`). Each is declared where it is asked -- model/model.mjs and server/txn.mjs -- and each consumer refuses a
network missing any method it reads. This builds the one object that answers all seven, so a composition passes it
whole: the lab hands the same object to its Model and to the planner.

Every answer reads the one derivation per board state (network/view.mjs, T2), except `isStranded`, which needs none:
a pinned link lives and dies with its pins (ruled 2026-09-30), so a link that lost a pin is deleted whatever ways remain.

`view` rides along for the one caller that is not a product consumer: the lab's sweep of pipes no link runs over.
*/
import { createNetworkView } from './view.mjs';
import { preferredRoute } from './pipes.mjs';
import { pipeResolver, pipeDependents, pipeLinkDown, pipeBlockers } from './resolve.mjs';
import { pipeAnchors, keepsOrphan } from './guide.mjs';

export function createNetwork(pipeSet, rankOf = () => 0, transit = null) {
	const view = createNetworkView(pipeSet, rankOf, transit);
	return {
		view,
		// the Model's four
		pathOf: pipeResolver(view),
		linksRoutedThrough: pipeDependents(view),
		isLinkDown: pipeLinkDown(view),
		blockersOf: pipeBlockers(view),
		// what the author declared about transit, from the session (TRANSIT.md section 12); a network without it declares nothing
		declaresNoTransit: (id) => !!transit?.declaredOff(id),
		/*
		Why transit keeps a down link from a way -- what a selected down link says (TR-1). `declared`: the anchors whose
		transit the author turned off, any ONE of which turned back on would give the link a way -- what the author can do.
		`types`: when none would, the anchors on the way it would otherwise take whose type never passes a route.
		*/
		transitBlocking(link, model) {
			const { pipes, passes } = view.of(model);
			const declared = (transit ? transit.blockedIn(model) : []).filter((id) => transit.declaredOff(id)
				&& preferredRoute(pipes, link, (x) => x === id || passes(x)));
			if (declared.length) return { declared, types: [] };
			const way = preferredRoute(pipes, link);
			return { declared: [], types: way ? way.slice(1, -1).filter((id) => !passes(id)) : [] };
		},
		// the planner's three -- each judged against the model the planner hands over, so only pipes that survive the edit count
		alsoReferenced: (model) => pipeAnchors(view, model),
		keepsOrphan,
		// a pinned link lives and dies with its pins (ruled 2026-09-30): the planner asks only about a link that lost one
		isStranded: () => true,
	};
}
