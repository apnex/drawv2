/*
TRANSIT OFFERS -- which values of `transit` a node's type offers: the network plugin's CAPABILITY table (TRANSIT.md section 5,
TR-6), configuration the plugin brings rather than a fixed fact of a type (the director, 2026-10-07: "loadbalancer can offer
transit too - its configurable and we havent configured them yet").

A bare anchor, a router, a firewall and a vxlan offer both, and pass by default; a load balancer, a server and a host offer
only off. A type the table does not name -- a text box, a panel -- is no routing device, and offers only off too.

H19.10 (B301; dev/design/unification/DEVICE-JUNCTIONS.md) -- its own module, so the transit rules (network/transit.mjs) and
the link's references (network/link-references.mjs) both read it without one importing the other: whether a node may be
PASSED -- pinned, a junction -- is decided here by what its type offers, not by whether it has a type (ruled 2026-10-07, "A
device is an endpoint or a junction, by what the network plugin gives it").
*/
import { isBareEntity, BARE_KIND } from '../model/anchors.mjs';   // the bare anchor, asked in one place (F-b)

const BOTH = [true, false], OFF = [false];
const OFFERS = { router: BOTH, firewall: BOTH, vxlan: BOTH, loadbalancer: OFF, server: OFF, host: OFF };

/** The transit values a node's type offers, its default first: a bare anchor offers both. */
export const transitOffersOf = (entity) => (isBareEntity(BARE_KIND, entity) ? BOTH : OFFERS[entity.type] ?? OFF);

/** Whether a node's type offers transit -- whether a link may pass it, pinned through it as a junction. */
export const nodeOffersTransit = (entity) => !!entity && transitOffersOf(entity).includes(true);
