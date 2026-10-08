/*
THE NETWORK'S APPEARANCES ON AN ANCHOR -- C-a, step three (H19.29; D3, the appearance pipeline's composition half).

Two, as the 2026-09-22 ruling resolves them:
  marks     the endpoint pad, the junction rings and the centre dot a waypoint draws for the roles the links give it (and its
            transit ring when it declares transit off, between the rings and the dot); offered for every anchor and
            competing, outranked by the device -- so a device emits none, "not emitted rather than drawn underneath"
  transit   the transit ring over a DEVICE declaring transit off -- composing over whatever won
The marks also carry the network's redraws: an anchor's change redraws the links naming it and those routed through it.
Both were the renderer's own branches (app/src/renderer.js `draw`, `update`, `layerCircle`); the elements are what it built --
the K8 DOM corpus holds that. The layer list itself is the network's, shared with the SVG export (network/appearance.mjs).
*/

import { L_STD } from '../kernel/spec.mjs';
import { TOKENS } from '../kernel/theme.mjs';
import { hasDevice } from '../devices/device-fields.mjs';
import { waypointLayers } from './appearance.mjs';
import { waypointRolesIn } from './roles.mjs';
import { declaresNoTransit, linksRoutedThrough } from './network-queries.mjs';
import { linksAt } from './link-queries.mjs';

const FE = L_STD.frame.ext;   // the frame's half-extent (20), which the rings are sized from

// one layer of the kernel's waypoint rings, as a circle -- a layer may carry its own stroke and dash, as the transit ring
// does, and is drawn as it says; the canvas and the export draw the same list the same way
function layerCircle(l, g, el) {
	el('circle', l.fill === 'solid'
		? { class: l.cls, r: l.radius, fill: TOKENS.waypoint }
		: { class: l.cls, r: l.radius, fill: l.fill, stroke: l.stroke ?? TOKENS.waypoint, 'stroke-width': l.width, 'stroke-opacity': l.opacity, ...(l.dash ? { 'stroke-dasharray': l.dash } : {}), ...(l.pathLength ? { pathLength: l.pathLength } : {}) }, g);   // a fitted dash (evenDash)
}

const MARKS = {
	id: 'marks',
	kind: 'node',
	// its roles -- a bend has none -- read from the links meeting it and whether what arrives stops (B277)
	state: (entity, { model }) => { const roles = waypointRolesIn(model, entity.id); return roles.length ? roles.join(' ') : 'bend'; },
	composes: false,
	root: { layer: 'waypoints', class: (entity, kit, state) => `waypoint ${state}` },
	picks: [{ closest: 'g.waypoint', word: 'waypoint' }],   // C-b: hit by the word people use (F4)
	parts: {
		marks(entity, g, { el, model, mode }, state) {
			const roles = state === 'bend' ? [] : state.split(' ');
			// whether it declares transit off, from the network, since the lab holds that choice in its session (TRANSIT.md, TR-7)
			const anchor = { transit: declaresNoTransit(model, entity.id) ? false : undefined };
			// in run mode, the run picture -- what the download draws too, decided in one place (RUN_PICTURE, R-c)
			for (const l of waypointLayers(roles, FE, linksAt(model, entity.id), anchor, { run: mode === 'run' })) layerCircle(l, g, el);
		},
	},
	look: (entity) => [{ root: { transform: `translate(${entity.x},${entity.y})` } }, {}],
	// an anchor's change: every link naming it, end or bend (B312), and the links drawn through it
	redraws: (entity, { model }) => [...linksAt(model, entity.id), ...linksRoutedThrough(model, entity.id)].map((l) => ['link', l]),
};

const TRANSIT = {
	id: 'transit',
	kind: 'node',
	// a waypoint's ring is among its marks; over a device it composes on its own (TRANSIT.md section 12, X1)
	state: (entity, { model }) => (hasDevice(entity) && declaresNoTransit(model, entity.id) ? 'off' : null),
	composes: true,
	parts: {
		transit(entity, g, { el }) {
			layerCircle(waypointLayers([], FE, null, { transit: false }).find((l) => l.cls === 'wp-transit'), g, el);
		},
	},
};

// the network's appearances on the anchor, composed into its canvas part (network/canvas.mjs) with its link painter
export const NETWORK_APPEARANCES = [MARKS, TRANSIT];
