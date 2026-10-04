/*
THE READ COMPOSITION -- a document as a Model that draws with the network (P4 R-a, H18.19; CONSUMERS-ROUTE.md section 5.1).

A reader -- the CLI's `combat` and `movers`, the SVG export, the format batch's dry run -- needs a Model that holds every kind
a document holds and answers where each link is drawn, whether it is down and what blocks it. It plans nothing, so it needs
no field checks: the core's storage rows and the network's rows are its kinds. Each Model gets a network of its own, because
the network keeps one derivation per board (network/view.mjs), and a network shared across documents would evict one
document's derivation for another's.

One function, so no reader composes the network by hand. A composition that PLANS -- the store, the lab -- composes the
checked kinds with `productKinds(...NETWORK_ROWS)` and gives each of its Models `readerNetwork()`, the same constructor.
*/

import { Model } from '../model/model.mjs';
import { CORE_ROWS, composeKinds } from '../model/shape.mjs';
import { NETWORK_ROWS } from './kinds.mjs';
import { createNetwork } from './network.mjs';
import { createTransit } from './transit.mjs';

// the kinds a reader's Model holds: the core's storage rows and the network's -- its link, its pipe and the transit field
const READ_KINDS = composeKinds([...CORE_ROWS, ...NETWORK_ROWS], 'a reader');

// a network for one Model: its routes, down links and blockers, with transit as the network rules it
export const readerNetwork = () => createNetwork(createTransit());

// a stored or wire document, as a Model that draws with the network
export function readModel(doc) {
	const model = new Model({ kinds: READ_KINDS, network: readerNetwork() });
	model.load(doc);
	return model;
}

/*
WHAT A READER IS TOLD ABOUT ONE LINK (P4 R-b, H18.20; ruled H1): where it is drawn, the anchors its route runs through,
whether it is down, and -- for a down link -- the links holding its way. A down link has no route: it is drawn along its
intent, as the lab draws it, and says so, so a caller never takes its path for a live link's (A5). One answer, read by REST
and through it by the CLI, so a door cannot tell an agent less than another.

  path      the points the link is drawn along: its route, or a down link's intent
  route     the anchor ids its route runs through, a ring's back to its start -- null when it is down
  down      whether it has no route right now
  blockers  the ids of the links holding the way it would take -- empty unless it is down and held
*/
export function linkReading(model, link) {
	const down = model.isLinkDown(link);
	const route = !down && model.network ? model.network.view.of(model).route(link.id) : null;
	return { path: model.pathOf(link), route, down, blockers: down ? model.blockersOf(link) : [] };
}

/*
HOW EACH LINK IS DRAWN, for a renderer handed data (P4 R-c, H18.21): the export's kernel imports no network, so the export door
reads every link here and hands the kernel, per link id, `{ through, down }` -- the anchors its route runs through, a ring's
without the return to its start since the drawing closes itself (as network/resolve.mjs draws it), or null for a down link,
which is drawn through its stops and marked down (H1).
*/
export function linesOf(model) {
	const out = new Map();
	for (const link of model.all('link')) {
		const { route, down } = linkReading(model, link);
		const through = route && link.closed && route.length > 2 && route[route.length - 1] === route[0] ? route.slice(0, -1) : route;
		out.set(link.id, { through, down });
	}
	return out;
}
