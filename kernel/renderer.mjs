// RENDERER -- the frame primitives both renderers draw with: which frame a node has and how heavy, the selection
// brackets, the content-region layout, and the page's shared defs. Sovereign: glyph defs, metrics, colours and the
// scene CSS come from theme.mjs (no client/ coupling).
//
// K11 (dev/design/h17/PLAN.md): the SVG SCENE -- a resolved scene emitted as one string, for the export door -- moved
// to kernel/svg-scene.mjs, in the export layer. That half draws waypoints and links, which is network appearance; this
// half is core, and the live canvas (app/src/renderer.js) imports only it.
import { STD, L_STD } from './spec.mjs';
import { GLYPH_DEFS, TOKENS } from './theme.mjs';

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
export const isPanel = (e) => !!(e && e.content && e.content.length);

/*
H15.18 -- how heavily a node's frame is drawn, DERIVED from what it is.

A text panel is a caption on the drawing rather than a component in it, so it carries a lighter
frame. Derived rather than styled by CSS because the EXPORT must match the canvas: a stylesheet rule
would thin the panel on screen and leave every saved diagram heavy, which is the disagreement class
this tree keeps paying for.

Units are the SVG user space the rest of the spec uses, not pixels -- so the weight stays
proportional to the drawing under zoom.
*/
export const frameWidth = (e, V = STD) => (isPanel(e) ? V.panelW : V.frameW);

// a panel's corner follows its shape ('s' swaps it): circle -> the frame extent reads as a pill,
// square -> the sharp frame radius. A plain node always takes the sharp radius.
export const frameRadius = (e, L = L_STD) =>
	(isPanel(e) && (e.frame || e.shape) !== 'square') ? L.frame.ext : L.frame.r;

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
export function contentLayout(r, V = STD, L = L_STD) {
	const P = V.pitch, SE = L.socket.ext;
	const [oc, orow] = r.at || [0, 0], cols = r.cols || 1, rows = r.rows || 1;
	const x0 = oc * P - SE, y0 = orow * P - SE, w = (cols - 1) * P + 2 * SE, h = (rows - 1) * P + 2 * SE;  // socket-grid union
	const cx = x0 + w / 2, cy = y0 + h / 2;
	const al = r.align || 'center', pad = 8;
	const tx = al === 'left' ? x0 + pad : al === 'right' ? x0 + w - pad : x0 + w / 2;
	const anchor = al === 'left' ? 'start' : al === 'right' ? 'end' : 'middle';
	const fill = hexColor(r.fill) || '#e6e9ee';
	const value = r.value == null ? '' : String(r.value);

	/*
	H15.18 -- the size is PER REGION, defaulting to the ruled one, and the WRAPPING follows it.

	The advance-per-character and the line height were literals tuned for size 15. They are ratios
	of the size now, so a smaller caption wraps at more characters and stacks more tightly rather
	than wrapping as though it were still 15 -- which would leave short lines and wide gaps.

	0.6 is the advance of ui-monospace as a fraction of its size; 1.2 is ordinary leading.
	*/
	const size = typeof r.size === 'number' ? r.size : V.fontSize;

	let lines;
	if (rows <= 1) lines = [{ text: value, y: cy }];
	else {
		const cpl = Math.max(1, Math.floor((w - 2 * pad) / (size * 0.6))), lh = size * 1.2;
		const wrapped = [];
		let curr = '';
		for (const wd of value.split(/\s+/)) {
			const t = curr ? curr + ' ' + wd : wd;
			if (t.length > cpl && curr) { wrapped.push(curr); curr = wd; } else curr = t;
		}
		if (curr) wrapped.push(curr);
		const yTop = cy - (wrapped.length - 1) * lh / 2;
		lines = wrapped.map((text, i) => ({ text, y: yTop + i * lh }));
	}
	return { x0, y0, w, h, cx, cy, cols, rows, tx, anchor, fill, lines, size };
}
// glyph defs + the variant's frame defs (shared once per page)
/*
H15.6 -- the arrowhead, defined once for both renderers.

`markerUnits="strokeWidth"` so the head scales with the line rather than needing its own number,
and `orient="auto"` so it follows the path's direction at the end it sits on -- which is what makes
ONE definition serve both ends: the start marker is the same shape, turned around by the path.

B226 -- THE FILL IS THE LINK TOKEN, not `context-stroke`.

`context-stroke` is the right idea and does not paint here: it resolved to the literal string in
`getComputedStyle` and rasterised to ZERO lit pixels, against 480 for the same marker with a
literal fill. So the head was referenced by both renderers, present in the defs, and invisible --
which is worse than absent, because every attribute check passed.

The cost of naming the colour is that a SELECTED link keeps a head in the base colour rather than
the selection colour. That is a small, visible wrongness rather than a total one, and it is the
trade until `context-stroke` is available.
*/
function arrowDefs() {
	const head = `<path d="M0 0 L6 3 L0 6 z" fill="${TOKENS.link}"/>`;
	return `<marker id="flow-end" viewBox="0 0 6 6" refX="5.4" refY="3" markerWidth="5" markerHeight="5" markerUnits="strokeWidth" orient="auto">${head}</marker>`
		+ `<marker id="flow-start" viewBox="0 0 6 6" refX="5.4" refY="3" markerWidth="5" markerHeight="5" markerUnits="strokeWidth" orient="auto-start-reverse">${head}</marker>`;
}

/*
B235 -- the shared frame defs carry the WEIGHT too.

They took it from the `.frame` stylesheet rule, which is gone: a CSS rule silently beat the derived
attribute a panel emitted, so the canvas drew 2.1 where the export drew 1. With one authority for
the weight, a def that omits it would draw hairline instead -- these are the plain 1x1 frames, and
they are the THIRD route a frame reaches the screen by, after the panel rect and the span rect.
*/
export function sharedDefs(V = STD, L = L_STD) {
	return `<svg width="0" height="0" style="position:absolute">${GLYPH_DEFS}
	  <defs>
	    <circle id="m-circle" class="frame" r="${L.frame.ext}" stroke-width="${V.frameW}"/>
	    <rect id="m-square" class="frame" x="${-L.frame.ext}" y="${-L.frame.ext}" width="${2 * L.frame.ext}" height="${2 * L.frame.ext}" rx="${L.frame.r}" stroke-width="${V.frameW}"/>
	    ${arrowDefs()}
	  </defs>
	</svg>`;
}
