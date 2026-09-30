/*
The network plugin, as ONE object -- step T1 of the ruleset audit (dev/design/unification/RULESET-AUDIT.md).

The product asks the network seven questions: the Model four while drawing (`pathOf`, `linksRoutedThrough`,
`isLinkDown`, `blockersOf`) and the planner three while judging an edit (`alsoReferenced`, `keepsOrphan`,
`isStranded`). Each is declared where it is asked -- model/model.mjs and server/txn.mjs -- and each consumer refuses a
network missing any method it reads. This builds the one object that answers all seven, so a composition passes it
whole: the lab hands the same object to its Model and to the planner.

Every answer reads the one derivation per board state (network/view.mjs, T2), except `isStranded`, which by the
proposer's reading ignores who holds a pipe (network/guide.mjs) and so asks the pipes directly.

`view` rides along for the one caller that is not a product consumer: the lab's sweep of pipes no link runs over.
*/
import { createNetworkView } from './view.mjs';
import { pipeResolver, pipeDependents, pipeLinkDown, pipeBlockers } from './resolve.mjs';
import { pipeAnchors, isStranded, keepsOrphan } from './guide.mjs';

export function createNetwork(pipeSet, rankOf = () => 0) {
	const view = createNetworkView(pipeSet, rankOf);
	return {
		view,
		// the Model's four
		pathOf: pipeResolver(view),
		linksRoutedThrough: pipeDependents(view),
		isLinkDown: pipeLinkDown(view),
		blockersOf: pipeBlockers(view),
		// the planner's three -- each judged against the model the planner hands over, so only pipes that survive the edit count
		alsoReferenced: (model) => pipeAnchors(view, model),
		keepsOrphan,
		isStranded: (link, model) => isStranded(pipeSet.list(), link, model),
	};
}
