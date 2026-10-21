/*
THE ZONES PLUGIN'S KEYS -- C-e, step four (H19.33; dev/design/unification/CANVAS-PLUGINS.md; D5: a plugin's edits are data).

`z` wraps the selection in a zone: the bounds of the selected placed entities -- each by what its kind says its size is, so a
wide device is wrapped whole (B319) -- given a half-cell margin, rounded OUT to the zone grid (+-HALF + k*GAP) and clamped to the
canvas; the zone is made and selected through the host, and the readout says its size. Nothing selected that is placed (a link
alone), nothing made. The arithmetic was app/src/commands.js `wrapSelection` (B46), the key app/src/keymap.js `wrap`.

Shift+arrow on a lone zone grows it a cell, its NW corner fixed, at least a cell, clamped to the canvas -- the canvas's one
size-step row reads this (`sizeStep`), since a device answers the same key. It was `resizeZoneStep`.
*/

import { ZONE_EXT, ZONE_GRIDS } from '../layouts/layout-table.mjs';   // WD-b1: the zone layout's extent, the layouts plugin's; H26.1: its grids
import { makeZone } from './make-zone.mjs';

// H26.1 (SNAP-GRID.md section 5): the zone grid within the zone extent, and its declared pitch -- a zone's length step
const ZONE_GRID = ZONE_GRIDS.bounded, GAP = ZONE_GRID.declaration.pitch, HALF = GAP / 2;

const meta = (e) => e.ctrlKey || e.metaKey;

const WRAP = {
	id: 'wrap', input: ['z'], mutates: true, doc: 'wrap the selection in a zone',
	on: (e) => e.key.toLowerCase() === 'z' && !meta(e),
	run: (host) => {
		const b = host.selectionBounds();
		if (!b) return;   // empty, or links alone
		// H26.1 (SNAP-GRID.md appendix B, D10): rounded out to the zone grid and clamped to its extent, snap-grid's `enclosing` -- the
		// smallest block of the zone grid's positions whose span runs through the bounds grown by half a cell; the growth and the
		// one-cell minimum stay draw's. A selection's bounds are whole numbers -- its entities sit on the lattices, sized in whole
		// cells -- so the grown rect's edges are exact
		const block = ZONE_GRID.enclosing({ kind: 'rect', x: b.x - HALF, y: b.y - HALF, w: b.x2 - b.x + GAP, h: b.y2 - b.y + GAP });
		const from = ZONE_GRID.pointOf(block.from), to = ZONE_GRID.pointOf(block.to);
		const box = { x: from.x, y: from.y, w: Math.max(to.x - from.x, GAP), h: Math.max(to.y - from.y, GAP) };
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
