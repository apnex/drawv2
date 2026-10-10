/*
THE DEVICES PLUGIN'S HAND -- C-e, step one (H19.33; dev/design/unification/CANVAS-PLUGINS.md; the director: the hand as one step).

What an author can hold to stamp: the device types, in the order the digits 1-6 pick them and the palette shows them. A held
type stamps a device on the node grid where the canvas lets a placing gesture place (WD5: no item under the pointer, one
anchor to a point); the pipette holds the type a device was stamped from; a click on
a device with another type held retypes it. The canvas holds the item and runs the keys and the release rules that read this
(app/src/input.js); the list, the stamp and the retype were the canvas's (app/src/tools.js `NODE_TYPES`, app/src/input.js
`stampAt`, `handBlocked`, `onPipette`, app/src/commands.js `retypeNode`). Nothing a user sees changes.

C-e, step two: and how an item looks before it is stamped -- its PREVIEW, which the stamp ghost and the palette's tiles draw: the
frame, and the glyph FITTED to its own box in a socket-sized box, from the numbers the device's appearance draws with
(`GLYPH_BB`, `STD.socket`). The ghost drew the glyph unfitted, at the art's own extent -- 85-115% of the device it stamped (B318);
the palette had built its tiles from the same numbers since B205.
*/

import { makeNode } from './make-node.mjs';
import { hasDevice } from './device-fields.mjs';
import { STD } from '../kernel/spec.mjs';
import { GLYPH_BB } from '../kernel/theme.mjs';

export const DEVICE_HAND = {
	items: ['host', 'server', 'loadbalancer', 'firewall', 'vxlan', 'router'],
	place: 'node',   // stamped on the anchor's grid (C-c)
	stamp: (model, item, cell) => ({ kind: 'node', entity: makeNode(model, item, cell) }),
	// the item an entity was stamped from -- a device's type; none for a waypoint
	itemOf: (entity) => (hasDevice(entity) ? entity.type : null),
	retype: (item) => ({ label: 'retype', kind: 'node', after: { type: item } }),
	// what the item looks like, as elements to build: the frame, and the glyph fitted to its box (B205, B318)
	preview: (item) => {
		const [bx, by, bw, bh] = GLYPH_BB[item] || GLYPH_BB.host;
		const S = STD.socket;
		return [
			{ tag: 'use', attrs: { 'data-layer': 'frame', href: '#m-circle' } },
			{ tag: 'svg', attrs: { x: -S / 2, y: -S / 2, width: S, height: S, viewBox: `${bx} ${by} ${bw} ${bh}`, preserveAspectRatio: 'xMidYMid meet' },
				children: [{ tag: 'use', attrs: { 'data-layer': 'glyph', href: `#glyph-${item}` } }] },
		];
	},
};
