/*
THE DRAWN WORD FOR AN ANCHOR -- what the canvas, the situation and the network's keys call a node: `waypoint` for one with no
type (F4, ruled 2026-10-03), its kind otherwise. Derived from a stored entity through model/anchors.mjs, never stored.

A module apart from model/anchors.mjs because the planner loads that one and reads no drawn word; the scan of each entry's
exports (scan-layers L10) holds a module to what its closure uses (F-c, H18.5).
*/

import { ANCHOR_KINDS, isBareEntity } from './anchors.mjs';

// the word for what an entity is DRAWN as: `waypoint` for a bare anchor, its kind otherwise
export const drawnKind = (kind, entity) => (isBareEntity(kind, entity) ? 'waypoint' : kind);

// whether a drawn word (`drawnKind`, a hit, a situation's selection) names an anchor: a node, typed or not
export const isAnchorWord = (word) => ANCHOR_KINDS.includes(word) || word === 'waypoint';
