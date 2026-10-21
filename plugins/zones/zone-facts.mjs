/*
WHAT THE READOUT SAYS OF A ZONE, AND WHAT CTRL+A TAKES -- the zones plugin's. C-e, step ten (H19.33; dev/design/unification/CANVAS-PLUGINS.md section 3: "a kind's description ... whether select-all takes
it"). The selection line's words for this plugin's kind (`describe`), with the readout's formatters -- a place `pair`, its
offset from the datum `rel`, a size `dims` -- and the Model; and what Ctrl+A takes of it (`selectAll`), ranked so Ctrl+A selects
in the order it always has (devices, zones, links) and its help line names the kinds in that order.
A zone reads as its name, its place and its size. Ctrl+A takes every zone. They were app/src/readout.js `selectionText` and
app/src/input.js `onSelectAll`.
*/

export const ZONE_DESCRIBE = [{ kind: 'zone', line: (z, f) => `${z.name || 'zone'} ${f.pair(z.x, z.y)} ${f.dims(z.w, z.h)}${f.rel(z.x, z.y)}` }];
export const ZONE_SELECT_ALL = { word: 'zone', rank: 1, ids: (model) => model.all('zone').map((z) => z.id) };
