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
import { anchorOf } from '../model/anchors.mjs';
import { orderOf } from '../model/stacking.mjs';   // the bare anchor, asked in one place (F-b)

const KEEP = 4;   // the tab, the authority, and a planner projection before and after, at most

/*
H17.22 N-b -- THE PIPES ARE READ FROM A SOURCE, `pipesOf(model)`. The network passes the model's own pipe entities
(network/network.mjs, N-d); a derivation over a plain list -- a drag judge's hypothetical board, a test -- passes the list.
*/
/*
F-d (H18.6; B259) -- A LINK'S AGE IS ITS STORED DRAWING ORDER: smaller is older, and a link without one is the oldest
(model/order.mjs). It was session state, `network/order.mjs`, noted as answers arrived, so a reload or another peer could
age links differently; it is the document's now, the same for every peer and after every reload, and undo restores it.
*/
export const ageIn = (model) => (id) => orderOf(model.get('link', id));

/*
`rankOf`, when given, overrides the model's ages -- for a derivation over a plain list, a drag judge's hypothetical board or a
test; the network passes none, so every model is aged by its own links.
*/
export function createNetworkView(pipesOf, rankOf = null, transit = null) {
	if (typeof pipesOf !== 'function') throw new Error('createNetworkView: pipes come from a source, (model) -> [{ a, b, laid }] (H17.22 N-b)');
	let recent = [];
	return {
		of(model) {
			const alive = (id) => !!anchorOf(model, id);
			const pipes = pipesOf(model).filter((p) => alive(p.a) && alive(p.b));
			const links = model.all('link');
			const rank = rankOf ?? ageIn(model);
			// the anchors no route may pass (TRANSIT.md section 12, TR-1): an input to every route, so a part of the key
			const blocked = transit ? transit.blockedIn(model) : [];
			// a ring is part of the key (F-f): closing a link changes its stops, so a board's derivation differs with it
			const key = `${pipes.map((p) => `${p.a}-${p.b}:${p.laid}`).join(',')}#${links.map((l) => `${l.id}:${l.src}>${l.dst}[${(l.via ?? []).join(',')}]${l.closed ? 'o' : ''}@${rank(l.id)}`).join(',')}#${blocked.join(',')}`;
			const hit = recent.find((r) => r.key === key);
			if (hit) return hit.view;
			const stops = new Set(blocked);
			const view = deriveNetwork(pipes, links, { rankOf: rank, passes: (id) => !stops.has(id) });
			recent = [{ key, view }, ...recent].slice(0, KEEP);
			return view;
		},
	};
}
