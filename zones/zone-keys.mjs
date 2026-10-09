/*
THE ZONES PLUGIN'S KEYS -- C-e, step four (H19.33; dev/design/unification/CANVAS-PLUGINS.md; D5: a plugin's edits are data).

`z` wraps the selection in a zone: the bounds of the selected placed entities -- each by what its kind says its size is, so a
wide device is wrapped whole (B319) -- given a half-cell margin, rounded OUT to the zone grid (+-HALF + k*GAP) and clamped to the
canvas; the zone is made and selected through the host, and the readout says its size. Nothing selected that is placed (a link
alone), nothing made. The arithmetic was app/src/commands.js `wrapSelection` (B46), the key app/src/keymap.js `wrap`.

Shift+arrow on a lone zone grows it a cell, its NW corner fixed, at least a cell, clamped to the canvas -- the canvas's one
size-step row reads this (`sizeStep`), since a device answers the same key. It was `resizeZoneStep`.
*/

import { STD } from '../kernel/spec.mjs';
import { ZONE_EXT } from './zone-extent.mjs';
import { makeZone } from './make-zone.mjs';

const GAP = STD.pitch;
const HALF = GAP / 2;

const meta = (e) => e.ctrlKey || e.metaKey;

const WRAP = {
	id: 'wrap', input: ['z'], mutates: true, doc: 'wrap the selection in a zone',
	on: (e) => e.key.toLowerCase() === 'z' && !meta(e),
	run: (host) => {
		const b = host.selectionBounds();
		if (!b) return;   // empty, or links alone
		const floorZ = (v) => Math.floor((v - HALF) / GAP) * GAP + HALF;
		const ceilZ = (v) => Math.ceil((v - HALF) / GAP) * GAP + HALF;
		const x = Math.max(floorZ(b.x - HALF), -ZONE_EXT.x);
		const y = Math.max(floorZ(b.y - HALF), -ZONE_EXT.y);
		const x2 = Math.min(ceilZ(b.x2 + HALF), ZONE_EXT.x);
		const y2 = Math.min(ceilZ(b.y2 + HALF), ZONE_EXT.y);
		const box = { x, y, w: Math.max(x2 - x, GAP), h: Math.max(y2 - y, GAP) };
		host.create('zone', (model) => makeZone(model, box));
		host.flash(`zone ${host.dims(box.w, box.h)}`);
	},
};

export const ZONE_KEYS = [WRAP];

export const ZONE_SIZE_STEP = {
	kind: 'zone', label: 'resize', doc: 'resize the selected zone',
	step: (zone, dx, dy) => {
		const w = Math.min(Math.max(zone.w + dx * GAP, GAP), ZONE_EXT.x - zone.x);
		const h = Math.min(Math.max(zone.h + dy * GAP, GAP), ZONE_EXT.y - zone.y);
		return w === zone.w && h === zone.h ? null : { x: zone.x, y: zone.y, w, h };
	},
};
