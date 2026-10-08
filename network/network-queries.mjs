/*
THE NETWORK'S QUESTIONS OVER A MODEL -- Q-a (H19.27; dev/design/unification/PLUGIN-QUERIES.md, Q1 ruled A).

Where a link is drawn, which links pass through an anchor, whether a link is down and what holds its way, whether an anchor
declares its transit off, and whether what arrives there stops. The core Model asked them of the network under its own method
names, a privilege of one named plugin (B280's history; K13d); they are the network's functions now, over any Model -- the
page's, the server's, the planner's projection -- as the link queries are (network/link-queries.mjs).

Each reads the network the Model was given (`attached.network`) and gives, when none is attached, exactly the answer a Model
with no network gave: no path, nothing routed through, never down, no blockers, no declaration, nothing stops. So no caller
asks with an optional call -- at H19.25 three such calls answered "no links" once a method left the Model, instead of failing.
*/

const QUESTIONS = ['pathOf', 'linksRoutedThrough', 'isLinkDown', 'blockersOf', 'declaresNoTransit', 'stopsAt'];
const whole = new WeakSet();

// the network attached to this Model, checked whole once -- or null when none is attached
export function networkOf(model) {
	const network = model.attached?.network ?? null;
	if (network && !whole.has(network)) {
		const missing = QUESTIONS.filter((name) => typeof network[name] !== 'function');
		if (missing.length) throw new Error(`networkOf: the network does not provide ${missing.join(', ')} -- a network is composed whole or not at all (RULESET-AUDIT T1)`);
		whole.add(network);
	}
	return network;
}

// the straight path: src, then each via's centre, then dst -- the polyline production drew until the network did. Since
// V-e (J2) it is no default: it is what the network draws a DOWN link along, handed to it by `pathOf` (MODEL_READS above)
export function straightPath(model, link) {
	if (!link) return null;
	// An anchor is an entity REFERENCE or a bare position. The kernel's resolveRoute already
	// admits both (an entity id, or a cell coord as a free anchor); admitting the same here is
	// what lets the LIVE link preview — whose final anchor is the cursor, not yet an entity —
	// use this one resolver instead of hand-rolling a fourth copy.
	const at = (ref) => (ref && typeof ref === 'object' ? ref : model.endpointOf(ref));
	const src = at(link.src), dst = at(link.dst);
	if (!src || !dst) return null;
	const path = [[src.x, src.y]];
	/*
	B309 -- a via is ANY anchor: a waypoint, or a device the link is pinned through (H19.10, Z1). This accepted a bare
	anchor alone, written when every pin was one, so a down link pinned through a device had no path -- drawn from null on
	the canvas, `path: null` to REST and the CLI -- against H1's "drawn along its intent".
	*/
	for (const id of link.via || []) {
		const w = model.endpointOf(id);
		if (!w) return null;                    // a missing BEND is as dangling as a missing end
		path.push([w.x, w.y]);
	}
	path.push([dst.x, dst.y]);
	return path;
}

// where a link is DRAWN: along its route when the network has one, along its intent (`straightPath`) when it is down
export function pathOf(model, link) {
	const network = networkOf(model);
	return network ? network.pathOf(link, model, (l) => straightPath(model, l)) : null;
}

// the links drawn THROUGH an anchor they do not name -- empty without a network
export function linksRoutedThrough(model, id) {
	const network = networkOf(model);
	return network ? network.linksRoutedThrough(id, model) : [];
}

// whether a link has no route right now, and so is drawn as ready to heal -- never, without a network
export function isLinkDown(model, link) {
	const network = networkOf(model);
	return !!(link && network && network.isLinkDown(link, model));
}

// the links holding the way a down link would take -- never any, without a network
export function blockersOf(model, link) {
	const network = networkOf(model);
	return link && network ? network.blockersOf(link, model) : [];
}

// whether the author declared this anchor's transit off -- never, without a network
export function declaresNoTransit(model, id) {
	const network = networkOf(model);
	return !!(network && network.declaresNoTransit(id, model));
}

// whether what arrives at this anchor stops there (B278) -- never, without a network
export function stopsAt(model, id) {
	const network = networkOf(model);
	return !!(network && network.stopsAt(id, model));
}
