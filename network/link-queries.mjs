/*
THE NETWORK'S LINK QUERIES -- which links meet an anchor, which join two, and a new link (K13d, H19.25; dev/design/h17/PLAN.md
K13d). They were the core Model's methods, the last place the core named a kind but the anchor; the link is the network's
kind (S-e, G5), so they are the network's, over any Model -- the page's, the server's, the planner's projection. Each answers
from the relations index when one is attached (engine/relations.mjs) and by a scan otherwise, ordered by id (B246), as the
Model did. Moved unchanged.
*/

import { byId } from '../model/order.mjs';   // B246: the one derivation order

// a Model composed without the network holds no links, and the scan says so rather than asking for a kind it does not hold
const links = (model) => (model.kinds?.has('link') === false ? [] : model.all('link'));

// every link ending at this anchor -- src or dst
export function linksOf(model, nodeId) {
	if (model.index) return model.index.linksOf(nodeId);
	return links(model).filter((l) => l.src === nodeId || l.dst === nodeId).sort(byId);
}

// every link referencing this anchor in ANY role -- an end or a bend; for a waypoint, the link it serves -- used for
// occupancy ("free" = none), reflow on a move, and the delete cascade
export function linksAt(model, waypointId) {
	if (model.index) return model.index.linksAt(waypointId);
	return links(model).filter((l) =>
		l.src === waypointId || l.dst === waypointId || (Array.isArray(l.via) && l.via.includes(waypointId))).sort(byId);
}

// whether a and b are joined at all: AN end-pair link, the lowest id among them (B246) -- since B72 a pair may carry several,
// so reason about which with `linksBetween`
export function linkBetween(model, a, b) {
	if (model.index) return model.index.linkBetween(a, b);
	return linksBetween(model, a, b)[0];
}

// every link joining a and b, either way (B80): a pair may hold a straight link and routed ones beside it
export function linksBetween(model, a, b) {
	if (model.index) return model.index.linksBetween(a, b);
	return links(model).filter((l) =>
		(l.src === a && l.dst === b) || (l.src === b && l.dst === a)).sort(byId);
}

// a new link between two anchors: named like everything else (B187), minted from its ends, newest on top (F-d)
export function makeLink(model, src, dst) {
	return { id: model.freshId('link'), name: model.nextName('link'), order: model.nextOrder('link'), src, dst };
}
