/*
THE DRAWN WORD FOR AN ANCHOR -- what the canvas, the situation and the network's keys call a node: `waypoint` for one with no
type (F4, ruled 2026-10-03), its kind otherwise. Derived from a stored entity through devices/device-shapes.mjs, never stored.
AMENDED 2026-10-08 (O-e1, H19.21): the devices plugin's, moved from model/ -- the drawn word is whether a device is composed.

A module apart from model/anchors.mjs because the planner loads that one and reads no drawn word; the scan of each entry's
exports (scan-layers L10) holds a module to what its closure uses (F-c, H18.5).
*/

import { ANCHOR_KINDS } from '../model/anchors.mjs';   // the anchor kinds, the core's
import { isBareEntity } from './device-shapes.mjs';

// the word for what an entity is DRAWN as: `waypoint` for a bare anchor, its kind otherwise
export const drawnKind = (kind, entity) => (isBareEntity(kind, entity) ? 'waypoint' : kind);

// whether a drawn word (`drawnKind`, a hit, a situation's selection) names an anchor: a node, typed or not
export const isAnchorWord = (word) => ANCHOR_KINDS.includes(word) || word === 'waypoint';
