/*
PICK — resolve a point, or an event, to the entity under it.

One duty: *what is there?* Nothing here decides what to DO about it — that is the recognizer's job
(docs/spec/INPUT.md §4) — and nothing here holds state. Two distinct questions live together because
they are the same question asked of two inputs:

  · from a DOM event   `hitOf(evt)`      — what did the pointer land on? (reads the rendered tree)
  · from a coordinate  `nodeAt(...)`     — what occupies this point? (reads the Model)

Span-awareness is the reason these are not one-liners. A multi-cell node is hittable across its WHOLE
footprint, not just near its origin cell, so every predicate goes through `spanExtent` rather than a
radius (B29's family of bugs was surfaces forgetting exactly this).

Lifted out of `input.js` at H6.2 with the bodies unchanged; `this.model` became a parameter. The
first of the three units INPUT.md §8 names.
*/

import { NODE_R, dist, spanExtent } from './snap.js';

// ---- footprint predicates: a node occupies a RECTANGLE, not a point ----

// is `pos` inside this node's footprint, padded by `pad`?
export const inFootprint = (n, pos, pad = 0) => {
	const { sw, sh } = spanExtent(n.span);
	return pos.x >= n.x - pad && pos.x <= n.x + sw + pad && pos.y >= n.y - pad && pos.y <= n.y + sh + pad;
};

// does this node's footprint overlap `box`? (the marquee test)
export const footprintHits = (n, box, pad = 0) => {
	const { sw, sh } = spanExtent(n.span);
	return n.x - pad <= box.x + box.w && n.x + sw + pad >= box.x && n.y - pad <= box.y + box.h && n.y + sh + pad >= box.y;
};

// ---- from a DOM event: what did the pointer land on? ----

/*
Zones are deliberately absent unless Shift is held. They are an inert backdrop on their own layer
(DESIGN U1), so a plain click or marquee passes THROUGH them to the canvas — which is what makes
marquee-select work inside a zone at all.
*/
export function hitOf(evt) {
	const target = evt.target;
	if (!target.closest) return { kind: 'canvas', id: null };
	if (target.classList && target.classList.contains('handle')) {
		// link endpoint handles carry data-end; zone corner handles carry data-corner
		if (target.dataset.end) return { kind: 'lhandle', end: target.dataset.end };
		return { kind: 'handle', id: target.dataset.corner };
	}
	const nodeG = target.closest('g.node:not(.ghost)');
	if (nodeG) return { kind: 'node', id: nodeG.id };
	const wpG = target.closest('g.waypoint');
	if (wpG) return { kind: 'waypoint', id: wpG.id };
	const zoneG = target.closest('g.zone');
	if (zoneG) return evt.shiftKey ? { kind: 'zone', id: zoneG.id } : { kind: 'canvas', id: null };
	if (target.classList && target.classList.contains('link')) return { kind: 'link', id: target.id };
	return { kind: 'canvas', id: null };
}

// ---- from a coordinate: what occupies this point? ----

// the node whose footprint contains `pos`. Backs select, move, link-target and re-plug.
export const nodeAt = (model, pos, slop = NODE_R + 4) =>
	model.all('node').find((n) => inFootprint(n, pos, slop));

// a waypoint belongs to at most one link; a FREE one can still take an endpoint
export const waypointFree = (model, id) => model.linksAt(id).length === 0;

// a valid link endpoint under the cursor: a node, or a free waypoint
export function endpointAt(model, pos) {
	const n = nodeAt(model, pos);
	if (n) return n;
	return model.all('waypoint').find((w) => dist(w, pos) <= NODE_R && waypointFree(model, w.id)) || null;
}

// cell occupancy (the engine's O(1) index, not a scan): a node rests here / anything rests here
export const occupiedAt = (model, p) => model.occupiedAt(p);
export const occupiedAnyAt = (model, p) => model.occupiedAnyAt(p);
