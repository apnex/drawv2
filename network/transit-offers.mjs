/*
THE ROUTING PACK FAMILY -- which roles an anchor may take, and which values of `transit` it offers (TRANSIT.md section 5,
TR-6; ruled 2026-09-22, 2026-10-07, U4-1, SD5; H21.3, B282).

The network plugin defines its routing packs here:
  unrestricted  the bare anchor's pack: permits `endpoint`, `junction` and `bend`, and offers both `[true, false]` (2026-09-22)
  transit       a transiting device's pack: permits `endpoint` and `junction` (never `bend`), and offers `[true, false]`
  endpoint      an endpoint-only device's pack: permits `endpoint` alone, and offers `[false]`

Which device type takes which routing pack is declared once in `devices/device-types.mjs` and handed to `composeRouting` at
composition (`U4-1`), so no device type name appears in this module and a per-type permission table and a pack registry are
one lookup (`2026-09-22`).
*/
import { BARE_KIND } from '../model/anchors.mjs';
import { isBareEntity } from '../devices/device-shapes.mjs';
import { TYPE_ROUTING } from '../devices/device-types.mjs';

const BOTH = Object.freeze([true, false]), OFF = Object.freeze([false]);

const ROUTING_PACKS = Object.freeze({
	unrestricted: Object.freeze({ roles: Object.freeze(['endpoint', 'junction', 'bend']), offers: BOTH }),
	transit:      Object.freeze({ roles: Object.freeze(['endpoint', 'junction']),         offers: BOTH }),
	endpoint:     Object.freeze({ roles: Object.freeze(['endpoint']),                     offers: OFF }),
});

let composedRouting = { ...TYPE_ROUTING };
export function composeRouting(typeRouting = TYPE_ROUTING) {
	for (const [type, pack] of Object.entries(typeRouting)) {
		if (!ROUTING_PACKS[pack]) throw new Error(`composeRouting: ${type} names routing pack "${pack}", which the network does not have`);
	}
	composedRouting = { ...typeRouting };
}

/** The routing pack an anchor's composition includes: a bare anchor takes `unrestricted`. */
const routingPackOf = (entity) => (isBareEntity(BARE_KIND, entity) ? ROUTING_PACKS.unrestricted : ROUTING_PACKS[composedRouting[entity?.type]] ?? ROUTING_PACKS.endpoint);

/** The transit values a node's routing pack offers, its default first: a bare anchor offers both. */
export const transitOffersOf = (entity) => routingPackOf(entity).offers;

/** Whether a node's routing pack permits `junction` (and so offers transit). */
export const nodeOffersTransit = (entity) => !!entity && routingPackOf(entity).roles.includes('junction');

/** Whether a node's routing pack permits `bend` (2026-09-22, 2026-09-28, Z1, U4-1). */
export const nodePermitsBend = (entity) => !!entity && routingPackOf(entity).roles.includes('bend');
