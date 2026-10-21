/*
WHAT THE READOUT SAYS OF A DEVICE, AND WHAT CTRL+A TAKES -- the devices plugin's. C-e, step ten (H19.33; dev/design/unification/CANVAS-PLUGINS.md section 3: "a kind's description ... whether select-all takes
it"). The selection line's words for this plugin's kind (`describe`), with the readout's formatters -- a place `pair`, its
offset from the datum `rel`, a size `dims` -- and the Model; and what Ctrl+A takes of it (`selectAll`), ranked so Ctrl+A selects
in the order it always has (devices, zones, links) and its help line names the kinds in that order.
A device reads as its name and its place; a waypoint is no device, and reads as its id. Ctrl+A takes every device, and no
waypoint. They were app/src/readout.js `selectionText` and app/src/input.js `onSelectAll`.
*/

import { isTypedEntity, typedNodes } from './device-shapes.mjs';

export const DEVICE_DESCRIBE = [{ kind: 'node', line: (n, f) => (isTypedEntity('node', n) ? `${n.name || 'node'} ${f.pair(n.x, n.y)}${f.rel(n.x, n.y)}` : null) }];
export const DEVICE_SELECT_ALL = { word: 'node', rank: 0, ids: (model) => typedNodes(model).map((n) => n.id) };
