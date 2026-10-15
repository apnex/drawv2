// RENDERER -- the frame primitives both renderers draw with: which frame a node has and how heavy, the selection
// brackets, the content-region layout, and the page's shared defs. Sovereign: glyph defs, metrics, colours and the
// scene CSS come from theme.mjs (no client/ coupling).
//
// K11 (dev/design/h17/PLAN.md): the SVG SCENE -- a resolved scene emitted as one string, for the export door -- moved
// to kernel/svg-scene.mjs, in the export layer. That half draws waypoints and links, which is network appearance; this
// half is core, and the live canvas (app/src/renderer.js) imports only it.
import { STD, L_STD } from './spec.mjs';

// selection corner-brackets (rounded, matching the group radius) — derived per variant.
// Exported so an interactive host can draw the SAME brackets (CSS-gated) without re-render.
// spanW/spanH extend the bracketed rect +x/+y (a multi-cell node); both 0 ⇒ the symmetric ±ext
// box — byte-identical to the pre-span path. The box spans the node's footprint, anchored top-left.
/*
The visual DECISIONS both renderers make, so neither restates them.

There are two renderers on purpose: this one emits strings for headless export, and
`app/src/renderer.js` reconciles DOM incrementally so a drag does not rebuild the scene. Their
EMISSION cannot reasonably be shared. Their RULES can, and until now were not -- the same three
judgements were written twice, and the socket one drifted: a panel obeyed the mode while a plain
node showed its socket always, in the editor and in every exported SVG.

`scan-twins` did not see it, and could not: it looks for shared ARITHMETIC, and the arithmetic here
was already shared -- `selBox`, `contentLayout`, `spanExtent` are all imported by the client. What
was duplicated is which element exists and when, which is structure rather than a formula.
*/
// sockets are an EDITING AID: absent from a clean export, present when the caller asks. The client
// asks by being in edit mode, the exporter by passing `sockets` -- one rule, two ways of saying yes.
export const showsSockets = (opts = {}) => !!opts.sockets;

export function selBox(L, spanW = 0, spanH = 0) {
	const r = L.selection.ext, arm = L.selection.arm, cr = L.selection.r;
	const lx = -r, ty = -r, rx = r + spanW, by = r + spanH;
	return `M${lx},${ty + arm} L${lx},${ty + cr} A${cr},${cr} 0 0 1 ${lx + cr},${ty} L${lx + arm},${ty}`
		+ ` M${rx - arm},${ty} L${rx - cr},${ty} A${cr},${cr} 0 0 1 ${rx},${ty + cr} L${rx},${ty + arm}`
		+ ` M${rx},${by - arm} L${rx},${by - cr} A${cr},${cr} 0 0 1 ${rx - cr},${by} L${rx - arm},${by}`
		+ ` M${lx + arm},${by} L${lx + cr},${by} A${cr},${cr} 0 0 1 ${lx},${by - cr} L${lx},${by - arm}`;
}

// ---- content rendering (W2) — the kernel now renders TEXT (reverses "kernel defers labels") ----
export const hexColor = (c) => (typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c)) ? c : null;   // SVG-attr safe; else default

/*
The LAYOUT of a content region — where its box sits, and where each line of text lands. B40.

Two renderers legitimately exist: this one produces a complete SVG document for a non-browser caller
(`GET /d/:id.svg`), and `app/src/renderer.js` maintains live, individually addressable elements for a
person editing. Two duties, both real — but they must not both own the ARITHMETIC, and they did. The
socket-grid union, the alignment mapping, the padding and the greedy wrap were byte-identical in
both, interleaved with the emission code that legitimately differs. That interleaving is why a
contiguous-window duplicate scan finds nothing here and only a set comparison surfaced it (B40, 30%).

Pure: no DOM, no strings — callers emit. A single-row region returns one line centred on the box, so
no caller re-implements the `rows <= 1` branch either.
*/
// glyph defs + the variant's frame defs (shared once per page)
/*
H15.6 -- the arrowhead WAS an SVG marker defined here, once for both renderers. RETIRED at H24.6 (B356): a marker sits at the
path's last point -- the anchor's centre, under the device -- cannot hold a size floor, and could not take the line's colour
(B226, `context-stroke` painting nothing). A head is a shape of its own now, worked out by network/link-head.mjs and drawn by the
network's link painter.
*/

/*
B235 -- the shared frame defs carry the WEIGHT too.

They took it from the `.frame` stylesheet rule, which is gone: a CSS rule silently beat the derived
attribute a panel emitted, so the canvas drew 2.1 where the export drew 1. With one authority for
the weight, a def that omits it would draw hairline instead -- these are the plain 1x1 frames, and
they are the THIRD route a frame reaches the screen by, after the panel rect and the span rect.
*/
export function sharedDefs(V = STD, L = L_STD, extraDefs = '') {
	return `<svg width="0" height="0" style="position:absolute">${extraDefs}
	  <defs>
	    <circle id="m-circle" class="frame" r="${L.frame.ext}" stroke-width="${V.frameW}"/>
	    <rect id="m-square" class="frame" x="${-L.frame.ext}" y="${-L.frame.ext}" width="${2 * L.frame.ext}" height="${2 * L.frame.ext}" rx="${L.frame.r}" stroke-width="${V.frameW}"/>
	  </defs>
	</svg>`;
}

/*
AN EVEN DASH -- a render primitive, beside the others here: a dash pattern that divides a closed shape exactly, so no short dash is left where it starts and ends (the
director, 2026-10-02: "target an approximate dash size - then have the helper slightly adjust to make it fit correctly").

The dash and gap are asked for in real units -- "a dash of length 4" -- and the count is the whole number of periods nearest
to fitting the length; the shape is then measured as exactly that many periods long (SVG `pathLength`), so the browser
stretches or squeezes each period slightly to fit. The radius and the stroke never change; only how the pattern is laid out.
For a closed shape only: an open path's length changes with every edit, and fitting would change its dashes with it.
Answers the SVG attributes, `dash` and `pathLength`, and `count`, how many dashes are drawn -- at least one.
*/
export function evenDash(length, dash, gap) {
	const period = dash + gap;
	const count = Math.max(1, Math.round(length / period));
	return { dash: `${dash} ${gap}`, pathLength: count * period, count };
}
