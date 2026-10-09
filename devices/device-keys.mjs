/*
THE DEVICES PLUGIN'S KEYS -- C-e, step six (H19.33; dev/design/unification/CANVAS-PLUGINS.md; D5: a plugin's edits are data).

`s` flips each selected device between a circle and a square -- a waypoint has no shape, a link is no device -- as one edit
labelled `reshape`, through the host's generic `setAll`; nothing selected that is a device, nothing sent. It was
app/src/keymap.js `reshape`, app/src/input.js `onReshape` and app/src/commands.js `reshapeNodes`.
*/

import { hasDevice } from './device-fields.mjs';

const plain = (e) => !e.ctrlKey && !e.metaKey && !e.altKey;

const RESHAPE = {
	id: 'reshape', input: ['s'], mutates: true, doc: 'reshape the selected nodes',
	on: (e) => e.key.toLowerCase() === 's' && plain(e),
	run: (host) => {
		const flips = host.selected().filter((e) => e.kind === 'node' && hasDevice(e))
			.map((n) => ({ kind: 'node', id: n.id, after: { shape: (n.shape || 'circle') === 'square' ? 'circle' : 'square' } }));
		if (flips.length) host.setAll('reshape', flips);
	},
};

export const DEVICE_KEYS = [RESHAPE];
