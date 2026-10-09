/*
WHERE A DEVICE'S LABEL IS EDITED -- the devices plugin's. C-e, step eleven (H19.33; dev/design/unification/CANVAS-PLUGINS.md
section 3: "where its label edits").

  named     F2 renames a device -- and a waypoint, an anchor of the same kind, which the canvas names by its kind
  wordOf    what a Tab rename run advances through: the next device, or the next waypoint, never the one for the other
  labelAt   a device's name sits under it, centred; a waypoint says nothing here, and opens at the canvas's default
  content   a panel's regions -- `content`, the field only a device carries (C-e step twelve): a region's value and alignment,
            and the edit that sets one, a copy of the regions with that value changed, so the history entry and the live device
            share nothing (W6; it was app/src/commands.js `setContentValue`)
  edits     what a double-click edits, in rank with the other plugins': a TEXT BOX by its whole footprint, its text (A1) --
            rank 0, before anything; then a device by its icon, or by the strip beneath it where its name is drawn -- rank 1.
            Hit GEOMETRICALLY: pointer capture retargets the browser's double click to the svg, so what capture says is under
            it is useless here. An icon hit beats a strip hit; the nearest wins; a tie goes to the topmost (last-rendered) --
            the strip is wider than a cell, so the first match would be a NEIGHBOUR for devices one cell apart.
They were app/src/input.js `editUnderPointer` and `onRenameKey`'s filter, and app/src/labeledit.js `open`'s placement.
*/

import { L_STD } from '../kernel/spec.mjs';
import { isTypedEntity, typedNodes } from './device-shapes.mjs';
import { inFootprint } from './device-footprint.mjs';
import { drawnKind } from './anchor-words.mjs';

const NODE_R = L_STD.frame.ext;   // a device frame's half-extent (20)
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const isTextBox = (n) => Array.isArray(n.content) && n.content.length === 1 && n.content[0].content === 'text';
const best = (cands) => cands.sort((p, q) => p.d - q.d || q.i - p.i)[0];
const regions = (n) => (isTypedEntity('node', n) && Array.isArray(n.content) ? n.content : null);
// a copy of the regions, each region its own object and its cell its own array
const copied = (c) => c.map((r) => ({ ...r, ...(r.at ? { at: [...r.at] } : {}) }));

export const DEVICE_LABELS = {
	named: ['node'],
	// the word a Tab rename run groups by: a device runs to the next device, a waypoint to the next waypoint (F4)
	wordOf: (kind, e) => (kind === 'node' ? drawnKind(kind, e) : null),
	labelAt: (n) => (isTypedEntity('node', n) ? { x: n.x, y: n.y + NODE_R + 6, centred: true } : null),
	content: {
		valueOf: (n, idx) => { const r = regions(n)?.[idx]; return r ? { value: r.value || '', align: r.align || 'left' } : null; },
		edit: (n, idx, value) => { const after = copied(n.content); after[idx].value = value; return { label: 'edit', after: { content: after } }; },
	},
	edits: [
		{ rank: 0, find: (model, pos) => {
			const tb = model.all('node').filter((n) => isTextBox(n) && inFootprint(n, pos, NODE_R)).at(-1);   // topmost
			return tb ? { kind: 'node', id: tb.id, edits: 'frame' } : null;
		} },
		{ rank: 1, find: (model, pos) => {
			const nodes = typedNodes(model);
			const icon = best(nodes.map((n, i) => ({ n, d: dist(n, pos), i })).filter((c) => c.d <= NODE_R + 4));
			const strip = icon ? null : best(nodes.map((n, i) => ({ n, d: Math.abs(pos.x - n.x), i }))
				.filter((c) => c.d <= 75 && pos.y - c.n.y >= NODE_R && pos.y - c.n.y <= NODE_R + 28));
			const node = (icon || strip)?.n;
			return node ? { kind: 'node', id: node.id, edits: 'name' } : null;
		} },
	],
};
