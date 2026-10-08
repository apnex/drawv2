/*
WHICH DEVICE, WHICH WAYPOINT, ON A CELL -- the devices plugin's (O-e1, H19.21; O4). Which anchor is on a cell is the core's
(`Model#occupiedAnyAt`); whether it is a device or a waypoint is this plugin's question, asked of the index when one is
attached (keyed by cell, engine/relations.mjs) and by a scan otherwise -- px-equality, as `Model#occupiedAnyAt` scans.
What `Model#occupiedAt` and `Model#waypointAt` answered, moved unchanged.
*/

import { bareAnchor, bareAnchors, typedNodes } from './device-shapes.mjs';

// whether a device rests on the cell at grid point `p`
export function occupiedAt(model, p) {
	if (model.index) return model.index.occupiedAt(p);
	return typedNodes(model).some((n) => n.x === p.x && n.y === p.y);
}

// the waypoint on the cell at grid point `p`, or undefined
export function waypointAt(model, p) {
	if (model.index) { const id = model.index.waypointAt(p); return id ? bareAnchor(model, id) : undefined; }
	return bareAnchors(model).find((w) => w.x === p.x && w.y === p.y);
}
