/*
One derivation per board state -- the network view, step T2 of the ruleset audit
(dev/design/unification/RULESET-AUDIT.md).

Every consumer that asks about links over pipes -- drawing, down, blockers, a moved anchor's dependents, the sweep,
the planner's reference check, the notices -- reads the one derivation this returns for the board it is asked about.
Before this, each computed its own: MEASURED 9 to 15 whole-board route assignments per edit, in two orders, and the
two orders disagreeing deleted pipes a link was drawn on (B257).

THE KEY IS EVERYTHING THE ANSWER DEPENDS ON: the pipes whose both ends exist in the model asked, and each link's ends,
pins and age. Nothing is invalidated by hand, so no change can be missed -- a stale answer would need a change the key
does not see, and the key is built from every input `deriveNetwork` reads. Two models holding the same board (the tab
and the planner's authority, after a commit) produce the same key and share one derivation.

READ ONLY PIPES THE MODEL CAN SEE. A pipe to an anchor the model lacks -- in the set until the next prune -- is no way,
so a link is never drawn along a route while its down state says otherwise (RULESET-AUDIT F10).

Session-scoped, like the pipe set: a few recent derivations are kept, so the tab, the authority and the planner's
projection of one edit do not evict each other.
*/
import { deriveNetwork } from './pipes.mjs';

const KEEP = 4;   // the tab, the authority, and a planner projection before and after, at most

export function createNetworkView(pipeSet, rankOf = () => 0) {
	let recent = [];
	return {
		of(model) {
			const alive = (id) => !!(model.get('node', id) || model.get('waypoint', id));
			const pipes = pipeSet.list().filter((p) => alive(p.a) && alive(p.b));
			const links = model.all('link');
			const key = `${pipes.map((p) => `${p.a}-${p.b}:${p.laid}`).join(',')}#${links.map((l) => `${l.id}:${l.src}>${l.dst}[${(l.via ?? []).join(',')}]@${rankOf(l.id)}`).join(',')}`;
			const hit = recent.find((r) => r.key === key);
			if (hit) return hit.view;
			const view = deriveNetwork(pipes, links, { rankOf });
			recent = [{ key, view }, ...recent].slice(0, KEEP);
			return view;
		},
	};
}
