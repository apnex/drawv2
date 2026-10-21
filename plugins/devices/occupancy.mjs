/*
WHICH DEVICE, WHICH WAYPOINT, ON A CELL -- the devices plugin's (O-e1, H19.21; O4; B341, H21.8). Which anchor is on a cell is
the core's (`Model#occupiedAnyAt`, `model.index.anchorsAt`); whether that anchor is a device or a waypoint is this plugin's
question, asked of the core's cell-occupancy index when one is attached and by a scan otherwise.
*/

import { isTypedEntity, bareAnchor, bareAnchors, typedNodes } from './device-shapes.mjs';

// whether a device rests on the cell at grid point `p`
export function occupiedAt(model, p) {
	if (model.index) return model.index.anchorsAt(p).some((id) => isTypedEntity('node', model.endpointOf(id)));
	return typedNodes(model).some((n) => n.x === p.x && n.y === p.y);
}

// the waypoint on the cell at grid point `p`, or undefined
export function waypointAt(model, p) {
	if (model.index) {
		const ids = model.index.anchorsAt(p).filter((id) => bareAnchor(model, id));
		if (!ids.length) return undefined;
		if (ids.length === 1) return bareAnchor(model, ids[0]);
		const s = new Set(ids);
		return bareAnchors(model).find((w) => s.has(w.id));
	}
	return bareAnchors(model).find((w) => w.x === p.x && w.y === p.y);
}
