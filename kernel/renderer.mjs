// RENDERER — resolved geometry (a flat scene = list of px primitives) → SVG. No layout
// decisions live here; the engine has already placed everything. Sovereign: glyph defs, glyph
// metrics, colours and the scene CSS all come from theme.mjs (no client/ coupling).
import { STD, L_STD } from './spec.mjs';
import { bboxOf } from './geometry.mjs';
import { roundedPath } from './router.mjs';
import { GLYPH_DEFS, GLYPH_BB, TOKENS } from './theme.mjs';

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
const escText = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
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

	let lines;
	if (rows <= 1) lines = [{ text: value, y: cy }];
	else {
		const cpl = Math.max(1, Math.floor((w - 2 * pad) / 9)), lh = 18;
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
	return { x0, y0, w, h, cx, cy, cols, rows, tx, anchor, fill, lines };
}
const TXT = (x, y, s, { anchor = 'middle', fill = '#e6e9ee', size = 15 } = {}) =>
	`<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="central" font-family="ui-monospace,monospace" font-size="${size}" fill="${fill}">${escText(s)}</text>`;

// a CONTENT region inside a node, in node-LOCAL px (origin cell centre = 0,0). A region occupies a merged
// sub-grid at offset `at` [col,row] sized cols×rows of the node's 26px socket grid, holding TEXT (align +
// optional outline/fill/radius; multi-row wraps as a paragraph) or a GLYPH. Ported from the settled mock
// (design/widgets/render.mjs renderContent). label/input/button/pill are all text + optional outline/fill.
export function renderContentRegion(r, V = STD, L = L_STD, idx = 0) {
	const P = V.pitch, SE = L.socket.ext, S = V.socket;
	const { x0, y0, w, h, cx, cy, tx, anchor, fill, lines } = contentLayout(r, V, L);
	// W5/W6 — an interactive region gets a transparent hit rect on top, CSS-gated to capture only in run
	// mode: a button (action → data-action, fires draw:action) or an editable input (input → data-input +
	// the region index, opens the inline editor). action sanitized for the attribute.
	const hit = (r.action && /^[a-z0-9-]+$/.test(r.action))
		? `<rect class="clickable" data-action="${r.action}" x="${x0}" y="${y0}" width="${w}" height="${h}" fill="transparent"/>`
		: r.input ? `<rect class="clickable" data-input="" data-idx="${idx}" x="${x0}" y="${y0}" width="${w}" height="${h}" fill="transparent"/>` : '';
	if (r.content === 'glyph') {
		const [bx, by, bw, bh] = GLYPH_BB[r.glyph] || GLYPH_BB.host;
		return `<svg x="${cx - S / 2}" y="${cy - S / 2}" width="${S}" height="${S}" viewBox="${bx} ${by} ${bw} ${bh}" preserveAspectRatio="xMidYMid meet"><use href="#glyph-${r.glyph}"/></svg>` + hit;
	}
	// text: optional outline (box ON the socket border, never beyond); lines arrive already placed
	let out = '';
	if (r.outline) out += `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="${typeof r.rx === 'number' ? r.rx : 3}" fill="${hexColor(r.bg) || '#0a0a0a'}" stroke="${hexColor(r.accent) || TOKENS.port}" stroke-width="1.3"/>`;
	for (const ln of lines) out += TXT(tx, ln.y, ln.text, { anchor, fill });
	return out + hit;
}

// the per-cell 26px socket grid for a panel interior (node-local px; origin cell = 0,0). An alignment
// aid that shows where content regions snap. Interim: always-on for content panels; W4 (edit mode) will
// gate it (show while editing, hide in the clean view).
function socketGridSvg(cols, rows, V) {
	const P = V.pitch, S = V.socket; let s = '';
	for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++)
		s += `<rect class="socket" x="${i * P - S / 2}" y="${j * P - S / 2}" width="${S}" height="${S}" fill="none" stroke="${TOKENS.socket}" stroke-width="0.6" stroke-dasharray="2 2"/>`;
	return s;
}

function renderEl(el, V, L, opts = {}) {
	if (el.kind === 'zone') return `<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="${L.zone.r}" fill="${TOKENS.zoneFill}" fill-opacity="${TOKENS.zoneFillOp}" stroke="${TOKENS.zoneStroke}" stroke-opacity="${TOKENS.zoneStrokeOp}" stroke-width="1"/>`;
	if (el.kind === 'group') return `<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="${L.group.r}" fill="none" stroke="${TOKENS.group}" stroke-width="1.1"/>`;
	if (el.kind === 'path') return `<path d="${roundedPath(el.pts, el.radius, el.close)}" fill="none" stroke="${TOKENS.link}" stroke-width="${V.linkW}" stroke-linecap="round" stroke-linejoin="round"/>`;
	// a waypoint = a placed routing pivot: a node-sized (r = frame.ext = 20) ring in the link
	// colour with a centre dot. The rounded path (r=20) bends through its centre, so the bend is
	// inscribed in the ring — it reads as "the path turns here". Hollow, so the bend stays visible.
	if (el.kind === 'waypoint') { const r = L.frame.ext; return `<g class="waypoint"><circle cx="${el.cx}" cy="${el.cy}" r="${r}" fill="none" stroke="${TOKENS.waypoint}" stroke-width="1.6" stroke-opacity="0.7"/><circle cx="${el.cx}" cy="${el.cy}" r="2.2" fill="${TOKENS.waypoint}"/></g>`; }
	// a junction = a deliberate connection pad (a copper-trace tie point): says "these lines are
	// connected", vs links that merely cross. Opaque centre so wires meet its edges cleanly.
	if (el.kind === 'junction') { const s = 10; return `<rect x="${el.cx - s / 2}" y="${el.cy - s / 2}" width="${s}" height="${s}" rx="1.5" fill="${TOKENS.panel}" stroke="${TOKENS.junction}" stroke-width="2.6"/>`; }
	if (el.kind === 'port') {
		if (el.style === 'circle') return `<circle class="frame" cx="${el.cx}" cy="${el.cy}" r="${el.size / 2}"/>`;
		if (el.style === 'entity') return `<circle cx="${el.cx}" cy="${el.cy}" r="${el.size / 2}" fill="${TOKENS.panel}" stroke="${TOKENS.port}" stroke-width="2"/>`;
		return `<rect x="${el.cx - el.size / 2}" y="${el.cy - el.size / 2}" width="${el.size}" height="${el.size}" rx="1.5" fill="${TOKENS.panel}" stroke="${TOKENS.port}" stroke-width="2.4"/>`;
	}
	if (el.kind === 'node') {
		const [bx, by, bw, bh] = GLYPH_BB[el.glyph] || GLYPH_BB.host, S = V.socket;  // unknown glyph → fit box of `host`; the (missing) <use> renders empty, no crash
		const sw = el.spanW || 0, sh = el.spanH || 0, fe = L.frame.ext;
		const panel = isPanel(el);
		// 1×1 plain → the fixed frame def (<use>); a panel or multi-cell footprint → a sized rect (same .frame class).
		// A panel's rx FOLLOWS shape, like a 1×1 node: 'circle' → fe (round; 1×1 == the circle, row → pill), 'square' → fr.
		const frame = (sw || sh || panel)
			? `<rect class="frame" x="${-fe}" y="${-fe}" width="${2 * fe + sw}" height="${2 * fe + sh}" rx="${frameRadius(el, L)}"/>`
			: `<use href="#m-${el.frame}"/>`;
		if (panel) {
			// a content node (W2): frame + content regions (text/glyph in the socket grid); the regions ARE
			// the content, so no default socket/glyph. content absent ⇒ the path below (byte-identical to W1).
			const gc = sw / V.pitch + 1, gr = sh / V.pitch + 1;
			return `<g class="node ${el.sel ? 'selected' : ''}" transform="translate(${el.cx},${el.cy})">
		  ${frame}
		  ${showsSockets(opts) ? socketGridSvg(gc, gr, V) : ''}
		  ${el.content.map((r, i) => renderContentRegion(r, V, L, i)).join('')}
		  ${el.sel ? `<path class="select-box" style="display:block" d="${selBox(L, sw, sh)}"/>` : ''}
		</g>`;
		}
		return `<g class="node ${el.sel ? 'selected' : ''}" transform="translate(${el.cx},${el.cy})">
		  ${frame}
		  ${showsSockets(opts) ? `<rect class="socket" x="${-S / 2}" y="${-S / 2}" width="${S}" height="${S}" fill="none" stroke="${TOKENS.socket}" stroke-width="0.6" stroke-dasharray="2 2"/>` : ''}
		  <svg x="${-S / 2}" y="${-S / 2}" width="${S}" height="${S}" viewBox="${bx} ${by} ${bw} ${bh}" preserveAspectRatio="xMidYMid meet"><use href="#glyph-${el.glyph}"/></svg>
		  ${el.sel ? `<path class="select-box" style="display:block" d="${selBox(L, sw, sh)}"/>` : ''}
		</g>`;
	}
	return '';
}

// render ONE resolved element → SVG string. Exposed so an interactive host (the thin UI) can
// build per-entity DOM (wrap with `id` + state classes) instead of the whole-scene string.
export function renderElement(el, V = STD, L = L_STD, opts = {}) { return renderEl(el, V, L, opts); }

// the kind → draw-order rank, exported so a host can order its own per-entity DOM consistently.
// Region decorations (zone fill, group hull) sit at the BACK; the graph (links, nodes) in front:
// zone → group → link/path → junction/waypoint (over the path) → ports → nodes.
export const DRAW_ORDER = { zone: 0, group: 1, path: 2, junction: 3, waypoint: 3, port: 4, node: 5 };

const ORDER = DRAW_ORDER;

/*
The root carries `xmlns`. Inside an HTML page a browser INFERS the SVG namespace, so the editor
worked without it for as long as the kernel's output was only ever injected into a page. Served
standalone as image/svg+xml the document is parsed as XML, which has no implicit namespace — the
browser then shows a parse failure instead of the diagram. The attribute costs nothing and makes
the output a valid SVG document rather than a fragment that happens to work in one context.
*/
/*
Every element that has a source id is wrapped in `<g id="…">`.

`resolve()` already carries the entity id onto each scene element "so an interactive host can map
scene → DOM" — but the string renderer dropped it, so an exported file had no way back to the model.
Emitting it costs one wrapper and makes a download traceable: you can find a node in the file, diff
two exports meaningfully, or script against one. Classes stay on the inner elements, so the CSS is
untouched.
*/
const tagged = (el, svg) => (el.id ? `<g id="${el.id}">${svg}</g>` : svg);

export function renderScene(elements, V = STD, L = L_STD, pad = 18, opts = {}) {
	let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
	const ext = (x, y) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); };
	for (const el of elements) {
		const b = bboxOf(el, L);
		if (b) { ext(b.x, b.y); ext(b.x + b.w, b.y + b.h); }
		else if (el.kind === 'path') for (const [x, y] of el.pts) ext(x, y);
	}
	const vbX = minX - pad, vbY = minY - pad, vbW = (maxX - minX) + 2 * pad, vbH = (maxY - minY) + 2 * pad;
	const sorted = [...elements].sort((a, b) => ORDER[a.kind] - ORDER[b.kind]);
	return `<svg xmlns="http://www.w3.org/2000/svg" class="scene" viewBox="${vbX} ${vbY} ${vbW} ${vbH}">
	  <rect x="${vbX}" y="${vbY}" width="${vbW}" height="${vbH}" fill="${TOKENS.panel}"/>
	  ${sorted.map((el) => tagged(el, renderEl(el, V, L, opts))).join('')}
	</svg>`;
}

// glyph defs + the variant's frame defs (shared once per page)
export function sharedDefs(V = STD, L = L_STD) {
	return `<svg width="0" height="0" style="position:absolute">${GLYPH_DEFS}
	  <defs>
	    <circle id="m-circle" class="frame" r="${L.frame.ext}"/>
	    <rect id="m-square" class="frame" x="${-L.frame.ext}" y="${-L.frame.ext}" width="${2 * L.frame.ext}" height="${2 * L.frame.ext}" rx="${L.frame.r}"/>
	  </defs>
	</svg>`;
}
