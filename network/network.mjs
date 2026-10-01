/*
The network plugin, as ONE object -- step T1 of the ruleset audit (dev/design/unification/RULESET-AUDIT.md).

The Model asks the network four questions while drawing (`pathOf`, `linksRoutedThrough`, `isLinkDown`, `blockersOf`),
declared in model/model.mjs, which refuses a network missing any. The planner asks it NOTHING (PL-3): the network brings
its own LINK TENANT, `links`, the reactions the planner runs when an edit touches links -- the waypoint and node
cascades it shares with production, and its own stranded pass, sweep and join, each with the network's conditions
inside (they were four hooks, `alsoReferenced`, `keepsOrphan`, `isStranded` and `joinsAt`, until PL-3). The lab hands
this one object to its Model, and its `links` to the planner.

Every answer reads the one derivation per board state (network/view.mjs, T2), except the stranded pass, which needs
none: a pinned link lives and dies with its pins (ruled 2026-09-30), so a link that lost a pin is deleted whatever ways
remain.

`view` rides along for the one caller that is not a product consumer: the lab's sweep of pipes no link runs over.
*/
import { createNetworkView } from './view.mjs';
import { preferredRoute } from './pipes.mjs';
import { pipeResolver, pipeDependents, pipeLinkDown, pipeBlockers } from './resolve.mjs';
import { pipeAnchors, keepsOrphan } from './guide.mjs';
import { linkTenant } from '../model/link-reactions.mjs';

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
		/*
		The network's LINK TENANT (PL-3, PD-2), in place of production's classic one. Each condition is judged against
		the model the planner hands over, so only pipes that survive the edit count.
		*/
		links: linkTenant({
			owner: 'network links',
			// a pinned link lives and dies with its pins (ruled 2026-09-30)
			stranded: true,
			// pipes reference anchors too, and nothing deliberate is kept beyond them (ruled 2026-09-29)
			alsoReferenced: (model) => pipeAnchors(view, model),
			keepsOrphan,
			// two links left at a waypoint join only where what arrives may pass on -- not where transit is off (TR-5)
			joinsAt: (waypointId, model) => !(transit && transit.blockedIn(model).includes(waypointId)),
			says: { sweep: 'the pipes that survive the edit reference anchors too, and nothing else is kept (ruled 2026-09-29)', join: 'only where the waypoint\'s transit is on (TR-5)' },
		}),
	};
}
