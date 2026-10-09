/*
THE DEVICES PLUGIN'S HAND -- C-e, step one (H19.33; dev/design/unification/CANVAS-PLUGINS.md; the director: the hand as one step).

What an author can hold to stamp: the device types, in the order the digits 1-6 pick them and the palette shows them. A held
type stamps a device on the node grid where no device stands; the pipette holds the type a device was stamped from; a click on
a device with another type held retypes it. The canvas holds the item and runs the keys and the release rules that read this
(app/src/input.js); the list, the stamp and the retype were the canvas's (app/src/tools.js `NODE_TYPES`, app/src/input.js
`stampAt`, `handBlocked`, `onPipette`, app/src/commands.js `retypeNode`). Nothing a user sees changes.
*/

import { makeNode } from './make-node.mjs';
import { occupiedAt } from './occupancy.mjs';
import { hasDevice } from './device-fields.mjs';

export const DEVICE_HAND = {
	items: ['host', 'server', 'loadbalancer', 'firewall', 'vxlan', 'router'],
	place: 'node',   // stamped on the anchor's grid (C-c)
	// a device stands on the cell: a held type does not stamp there
	blocked: (model, cell) => occupiedAt(model, cell),
	stamp: (model, item, cell) => ({ kind: 'node', entity: makeNode(model, item, cell) }),
	// the item an entity was stamped from -- a device's type; none for a waypoint
	itemOf: (entity) => (hasDevice(entity) ? entity.type : null),
	retype: (item) => ({ label: 'retype', kind: 'node', after: { type: item } }),
};
