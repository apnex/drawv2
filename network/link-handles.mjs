/*
THE NETWORK'S LINK HANDLES -- C-d, step two (H19.32; dev/design/unification/CANVAS-PLUGINS.md, D2: rows for shared gestures).

A lone selected link shows a handle at each end, on the route's OWN first and last segments rather than a straight line between
the ends (B29), so the handles never float off the path they grab. Dragging one RETARGETS that end: the shared handle gesture
draws a preview line from the fixed end to the pointer or the device under it, and on release this plugin judges it -- a
genuine retarget, onto a device that is neither the fixed end nor where it already was, and a pair with room (B72, B80) --
and its release row re-plugs the link. They were the canvas's (app/src/overlay.js, app/src/recognize.js `replug`,
app/src/releases.js `REPLUG_RELEASES`, app/src/input.js `GESTURES.replug`, `replugTo`); nothing a user sees changes -- the
gesture corpus's re-plug scenarios hold that.
*/

import { L_STD } from '../kernel/spec.mjs';
import { pathOf } from './network-queries.mjs';
import { linksBetween } from './link-queries.mjs';
import { pairHolders } from './link-rules.mjs';

const NODE_R = L_STD.frame.ext;   // a device frame's half-extent (20): a handle sits just clear of it

// a point along a segment, just clear of the anchor it starts at
const along = (from, to) => {
	const d = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
	const off = Math.min(NODE_R + 6, d * 0.4);
	return { x: from[0] + (to[0] - from[0]) / d * off, y: from[1] + (to[1] - from[1]) / d * off };
};

const LINK_HANDLES = {
	kind: 'link',
	word: 'lhandle',   // what a press on one is called -- a link's end handle
	key: 'end',        // the dataset key a handle carries: src or dst
	rx: 6,
	points: (link, model) => {
		const path = pathOf(model, link);
		return path ? { src: along(path[0], path[1]), dst: along(path[path.length - 1], path[path.length - 2]) } : null;
	},
	preview: 'retarget',
	targets: ['node'],          // what a dragged end lands on: a device, by the word its pick names (C-e) -- not a waypoint
	dragState: 'replugging',   // the real line de-emphasized while its end is dragged
	start: (link, end) => ({ end, fixedId: end === 'src' ? link.dst : link.src, before: { src: link.src, dst: link.dst } }),
	// what the release found: a genuine retarget -- onto a device, not the fixed end, not where it already was -- and whether the
	// pair has room; a routed link may join a pair that already has links, a straight one only a pair with room (B72, B80)
	released: (ctx, target, model) => {
		const link = model.get('link', ctx.id);
		const retargets = !!(link && target && target.id !== ctx.fixedId && target.id !== ctx.before[ctx.end]);
		const src = retargets && ctx.end === 'src' ? target.id : link?.src;
		const dst = retargets && ctx.end === 'dst' ? target.id : link?.dst;
		const admitted = retargets && !pairHolders({ ...link, src, dst }, linksBetween(model, src, dst), model).length;
		return { retargets, admitted, after: { src, dst } };
	},
	releases: [{ id: 'replug', mutates: true, on: (e) => e.type === 'up', when: (r) => r.retargets && r.admitted, run: (host, d) => host.set('replug', 'link', d.id, d.after) }],
};

// a press on an end handle opens the shared handle gesture
const LINK_REPLUG = {
	id: 'replug', input: ['left on lhandle'], context: 'a link selected', mutates: true, doc: 're-plug the link onto another node',
	on: (e) => e.button === 0 && e.on.kind === LINK_HANDLES.word,
	when: (s) => !s.tool,
	gesture: 'handle',
};

export const LINK_PRESSES = [LINK_REPLUG];
export const LINK_HANDLE_SPECS = [LINK_HANDLES];
