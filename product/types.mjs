/*
THE PRODUCT'S TYPE COMPOSITION -- handing each plugin its slice of the device type declarations (U4-1, U4-3; H21.3, B282).

`devices/device-types.mjs` declares each device type once (`DEVICE_TYPES`). This module reads that declaration and hands each
plugin its slice at composition (`U4-1`), where `composeRouting` (`network/transit-offers.mjs`) and `composeBehaviour`
(`engine/kinds.mjs`) verify every pack name against the packs they own.
*/

import { DEVICE_TYPES, TYPE_ROUTING, TYPE_BEHAVIOUR, typesFrom } from '../devices/device-types.mjs';
import { composeRouting } from '../network/transit-offers.mjs';
import { composeBehaviour } from '../engine/kinds.mjs';
import { productKinds } from './kinds.mjs';
import { NETWORK_ROWS } from '../network/kinds.mjs';

// B332 (H21.8): the full product composition of kinds, including the network's rows and tenant
export const COMPOSED_KINDS = productKinds(...NETWORK_ROWS);

export function composeProductTypes(table = DEVICE_TYPES) {
	const slices = typesFrom(table);
	composeRouting(slices.routing);
	composeBehaviour(slices.behaviour);
	return slices;
}

composeRouting(TYPE_ROUTING);
composeBehaviour(TYPE_BEHAVIOUR);
