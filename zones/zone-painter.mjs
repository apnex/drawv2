/*
THE ZONES PLUGIN'S PAINTER -- C-a (H19.29; dev/design/unification/CANVAS-PLUGINS.md, D1): how a zone is drawn on the page.

A zone is a rounded rect with its name on a pill in the top-left corner, in the zones layer, stacked by drawing order (F-d).
It was the renderer's own branch (app/src/renderer.js `draw`, `update`, `zoneLook`); it is the zones plugin's now, handed to
the page in its canvas part and called by the renderer with a kit -- `el`, `applyLook`, `pillWidth` and the layer it draws
into -- since a plugin imports no canvas code. The elements, their order and every attribute are what the renderer built:
the K8 DOM corpus holds that.
*/

import { STD, L_STD } from '../kernel/spec.mjs';
import { ZONE_EXT } from './zone-extent.mjs';
import { ZONE_PRESSES, ZONE_HANDLE_SPECS } from './zone-gestures.mjs';
import { ZONE_KEYS, ZONE_SIZE_STEP } from './zone-keys.mjs';
import { ZONE_DESCRIBE, ZONE_SELECT_ALL } from './zone-facts.mjs';
import { ZONE_LABELS } from './zone-labels.mjs';
import { ZONE_GRID } from './zone-grid.mjs';

const ZONE_R = L_STD.zone.r;   // the zone's corner radius (14)

// H15.9 -- every attribute that can change while the structure stays, in one call; create and update both apply it
const zoneLook = (entity, pillWidth) => ({
	rect: { x: entity.x, y: entity.y, width: entity.w, height: entity.h },
	label: { x: entity.x + STD.zoneDx, y: entity.y + STD.zoneDy, text: entity.name || '' },   // the spec owns the offset
	pill: { x: entity.x + 6, y: entity.y + 9, width: pillWidth(entity.name) },
});
const ZONE_PARTS = { rect: (g) => g.querySelector('.zone-rect'), label: (g) => g.querySelector('.label'), pill: (g) => g.querySelector('.label-pill') };

const ZONE_PAINTER = {
	kind: 'zone',
	layer: 'zones',
	stacked: true,
	// C-b: an inert backdrop, picked only with Shift held -- a plain press passes through it to the canvas (DESIGN U1)
	picks: [{ closest: 'g.zone', word: 'zone', modifier: 'shiftKey', clones: true }],   // D4: Ctrl+left clones it
	create(entity, { el, applyLook, pillWidth, layer }) {
		const g = el('g', { id: entity.id, class: 'zone' }, layer);
		el('rect', { class: 'zone-rect', rx: ZONE_R }, g);
		el('rect', { class: 'label-pill', rx: 4, height: STD.labelH }, g);
		el('text', { class: 'label zone-label', 'font-size': STD.fontSize }, g);
		applyLook(g, zoneLook(entity, pillWidth), ZONE_PARTS);
		return g;
	},
	update(entity, dom, { applyLook, pillWidth }) {
		applyLook(dom, zoneLook(entity, pillWidth), ZONE_PARTS);   // H15.9: the label offset is the spec's here as in create
	},
};

// C-c: a zone is placed on the half-offset grid, within its extent, its size its own box
const ZONE_PLACE = { kind: 'zone', layout: 'zone', ext: ZONE_EXT, size: (zone) => ({ w: zone.w, h: zone.h }) };

// the zones plugin's canvas part: what it brings to the page (C-a: its painter; C-b its pick, on the painter; C-c its place;
// C-d its press row over the shared box gesture, and its handles)
// C-e: and its keys -- `z` -- and its size step under the canvas's Shift+arrow
export const ZONES_CANVAS = { owner: 'zones', painters: [ZONE_PAINTER], places: [ZONE_PLACE], presses: ZONE_PRESSES, handles: ZONE_HANDLE_SPECS,
	keys: ZONE_KEYS, sizeStep: ZONE_SIZE_STEP, deleteRanks: { zone: 1 }, describe: ZONE_DESCRIBE, selectAll: ZONE_SELECT_ALL, labels: ZONE_LABELS,
	grids: [ZONE_GRID],   // C-e: and its grid, shown with Shift
	drawn: ['.zone'], tally: { rank: 2, word: 'zones', of: (model) => model.all('zone').length } };   // C-f: what it draws, for run mode; its count   // a zone is deleted after a group, before a link
