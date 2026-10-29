/*
THE ZONES PLUGIN'S PAINTER -- C-a (H19.29; dev/design/unification/CANVAS-PLUGINS.md, D1): how a zone is drawn on the page.

A zone is a rounded rect with its name on a pill in the top-left corner, in the zones layer, stacked by drawing order (F-d).
It was the renderer's own branch (app/src/renderer.js `draw`, `update`, `zoneLook`); it is the zones plugin's now, handed to
the page in its canvas part and called by the renderer with a kit, since a plugin imports no canvas code. The elements, their order
and every attribute are what the renderer built: the K8 DOM corpus and the native record hold that.
RESTATED H26.8 (dev/design/components/NATIVE-SHAPES.md section 3.2, NS2; appendix B): it answers the zone's shapes, once, as
`vector-scene`'s shapes -- its own item, keyed by the zone's id -- where it built elements and updated them again through a look and
its finders (T5); the scene diffs one description against the last.
*/

import { STD, L_STD } from '../../kernel/spec.mjs';
import { nameLabel } from '../../kernel/renderer.mjs';   // H25.1: a name's label is the core's

// B338 (H21.8, N1): the zones plugin's colour roles over the core palette
export const ZONE_COLOURS = { zoneFill: 'blueGrey300', zoneStroke: 'blueGrey200' };
import { ZONE_EXT, ZONE_GRIDS } from '../layouts/layout-table.mjs';   // WD-b1: the zone layout's extent, the layouts plugin's; H26.1: its grids
import { ZONE_PRESSES, ZONE_HANDLE_SPECS } from './zone-gestures.mjs';
import { ZONE_KEYS, ZONE_SIZE_STEP } from './zone-keys.mjs';
import { ZONE_DESCRIBE, ZONE_SELECT_ALL } from './zone-facts.mjs';
import { ZONE_LABELS } from './zone-labels.mjs';

const ZONE_R = L_STD.zone.r;   // the zone's corner radius (14)

const ZONE_PAINTER = {
	kind: 'zone',
	layer: 'zones',
	stacked: true,
	// C-b: an inert backdrop, picked only with Shift held -- a plain press passes through it to the canvas (DESIGN U1)
	// H24.5: and pressed with the right button only -- Shift+right selects, moves and (with Ctrl) clones it, so Shift+left is
	// free to draw a new zone over it (zone-gestures.mjs `ZONE_DRAW`)
	picks: [{ closest: 'g.zone', word: 'zone', modifier: 'shiftKey', button: 'right', clones: true }],
	// the zone's rect and its label, the core's (H25.1), each attribute where its fresh draw wrote it; the spec owns the label's offset
	shapes(entity, { pillWidth }) {
		return [['', { tag: 'g', attrs: { id: entity.id, class: 'zone' }, children: [
			{ tag: 'rect', attrs: { class: 'zone-rect', rx: ZONE_R, x: entity.x, y: entity.y, width: entity.w, height: entity.h } },
			...nameLabel({ pill: { rx: 4, height: STD.labelH, x: entity.x + 6, y: entity.y + 9, width: pillWidth(entity.name) },
				text: { 'font-size': STD.fontSize, x: entity.x + STD.zoneDx, y: entity.y + STD.zoneDy }, cls: 'zone-label', name: entity.name || '' }),
		] }]];
	},
};

// C-c: a zone is placed on the half-offset grid, within its extent, its size its own box
// H26.1: carrying the zone grid bounded by that extent, which it snaps to (SNAP-GRID.md section 5)
const ZONE_PLACE = { kind: 'zone', layout: 'zone', ext: ZONE_EXT, grid: ZONE_GRIDS.bounded, size: (zone) => ({ w: zone.w, h: zone.h }) };

// the zones plugin's canvas part: what it brings to the page (C-a: its painter; C-b its pick, on the painter; C-c its place;
// C-d its press row over the shared box gesture, and its handles)
// C-e: and its keys -- `z` -- and its size step under the canvas's Shift+arrow
export const ZONES_CANVAS = { owner: 'zones', stylesheets: ['plugins/zones/zones.css'], painters: [ZONE_PAINTER], places: [ZONE_PLACE], presses: ZONE_PRESSES, handles: ZONE_HANDLE_SPECS,
	keys: ZONE_KEYS, sizeStep: ZONE_SIZE_STEP, deleteRanks: { zone: 1 }, describe: ZONE_DESCRIBE, selectAll: ZONE_SELECT_ALL, labels: ZONE_LABELS,
	drawn: ['.zone'], helpWords: { zone: 'a zone' }, tally: { rank: 2, word: 'zones', of: (model) => model.all('zone').length } };   // C-f: what it draws, for run mode; its count   // a zone is deleted after a group, before a link
