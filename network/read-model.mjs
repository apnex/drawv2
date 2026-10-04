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
