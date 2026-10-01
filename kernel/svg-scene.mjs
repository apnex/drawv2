/*
SVG SCENE -- a resolved scene (a flat list of px primitives, from kernel/engine.mjs `resolve`) emitted as one SVG string,
for a caller that is not the browser: the export door (server/svg.mjs). No layout decisions live here; the engine has
already placed everything.

K11 (dev/design/h17/PLAN.md): split from kernel/renderer.mjs, which keeps the frame primitives the live canvas shares.
This half draws waypoints and links, which is network appearance, so it sits in the export layer, which may read the
network layer; the core half may not. The live canvas builds addressable DOM instead (B28) and never imports this.
*/
import { STD, L_STD } from './spec.mjs';
import { bboxOf } from './geometry.mjs';
import { waypointLayers, linkAppearance } from './network-appearance.mjs';
import { roundedPath } from './router.mjs';
import { GLYPH_BB, TOKENS } from './theme.mjs';
import { isPanel, frameWidth, frameRadius, showsSockets, selBox, hexColor, contentLayout } from './renderer.mjs';

const escText = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

/*
B234 -- a NAME, drawn where the canvas draws it.

Empty or absent emits NOTHING rather than an empty `<text>`: an unnamed entity has no label, and a
blank element is a thing a reader has to rule out. Escaped, because a diagram is user content and a
bare `<` or `&` breaks the document.

The offsets come from the spec rather than from here, so the canvas and the export cannot disagree
about where a label sits -- which is exactly what they did while the export had no labels at all.
*/
const label = (name, x, y, opts = {}) =>
	(name ? TXT(x, y, String(name), { fill: TOKENS.label || '#e6e9ee', ...opts }) : '');

const TXT = (x, y, s, { anchor = 'middle', fill = '#e6e9ee', size = STD.fontSize } = {}) =>
	`<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="central" font-family="ui-monospace,monospace" font-size="${size}" fill="${fill}">${escText(s)}</text>`;

// a CONTENT region inside a node, in node-LOCAL px (origin cell centre = 0,0). A region occupies a merged
// sub-grid at offset `at` [col,row] sized cols×rows of the node's 26px socket grid, holding TEXT (align +
// optional outline/fill/radius; multi-row wraps as a paragraph) or a GLYPH. Ported from the settled mock
// (dev/design/widgets/render.mjs renderContent). label/input/button/pill are all text + optional outline/fill.
export function renderContentRegion(r, V = STD, L = L_STD, idx = 0) {
	const P = V.pitch, SE = L.socket.ext, S = V.socket;
	const { x0, y0, w, h, cx, cy, tx, anchor, fill, lines, size } = contentLayout(r, V, L);
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
	for (const ln of lines) out += TXT(tx, ln.y, ln.text, { anchor, fill, size });
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
	if (el.kind === 'zone') {
		const rect = `<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="${L.zone.r}" fill="${TOKENS.zoneFill}" fill-opacity="${TOKENS.zoneFillOp}" stroke="${TOKENS.zoneStroke}" stroke-opacity="${TOKENS.zoneStrokeOp}" stroke-width="1"/>`;
		// B234 -- the NAME, at the offsets the canvas uses, so the two pictures agree
		return rect + label(el.name, el.x + V.zoneDx, el.y + V.zoneDy, { anchor: 'start' });
	}
	if (el.kind === 'group') return `<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="${L.group.r}" fill="none" stroke="${TOKENS.group}" stroke-width="1.1"/>`;
	if (el.kind === 'path') {
		// H15.9 -- ONE derivation, serialised as given. The export and the canvas read the same
		// answer, so neither can carry a weight or a head the other does not.
		const attrs = Object.entries(linkAppearance(el, V.linkW)).map(([k, v]) => ` ${k}="${v}"`).join('');
		return `<path d="${roundedPath(el.pts, el.radius, el.closed)}" fill="none" stroke="${TOKENS.link}" stroke-linecap="round" stroke-linejoin="round"${attrs}/>`;
	}
	// a waypoint = a placed routing pivot: a node-sized (r = frame.ext = 20) ring in the link
	// colour with a centre dot. The rounded path (r=20) bends through its centre, so the bend is
	// inscribed in the ring — it reads as "the path turns here". Hollow, so the bend stays visible.
	/*
	A waypoint draws according to its ROLE, which the engine derived from the relations.

	A BEND is a light ring: the path turns here, and the thin outline keeps the turn visible through
	it. An ENDPOINT is a copper-trace pad -- a heavy ring in the link colour, near the weight of the
	path itself, because a line TERMINATES here rather than passing through. That is the same
	distinction the `junction` element below draws for a tie point on a trunk.

	The heavy ring's radius is pulled in by half its stroke, so its OUTER edge lands on the frame
	extent rather than half a stroke past it. Left at r=20 a 5px ring would reach 22.5 and an
	endpoint would visibly bulge past a bend, so closing a path would look like it resized its
	corners. The thin ring still straddles 20 and reaches 20.8; what matters is that the heavy one
	never exceeds it.

	An ENDPOINT is OPAQUE, filled with the canvas colour, so the path disappears behind it and reads
	as terminating ON the pad rather than running under it. That is the whole point of a pad. A BEND
	stays hollow: the path passes through it and must stay visible doing so.

	The fill is `TOKENS.panel`, which the theme already calls the "canvas / opaque-centre fill" and
	which the `junction` element below already uses for the same reason -- a tie point hides the
	wires beneath it.
	*/
	if (el.kind === 'waypoint') {
		/*
		B209 -- the layer LIST, not a branch per role. `waypointLayers` owns which sub-types draw
		what, so adding one is a change there rather than here and in the live renderer both. The
		class list is the roles, or `bend` when none apply -- a bend adds no layer, so the empty set
		still needs a name for the CSS to hang on.
		*/
		const roles = el.roles || [];
		const cls = roles.length ? roles.join(' ') : 'bend';
		const circles = waypointLayers(roles, L.frame.ext, el.links).map((l) => (l.fill === 'solid'
			? `<circle cx="${el.cx}" cy="${el.cy}" r="${l.radius}" fill="${TOKENS.waypoint}"/>`
			// a layer may carry its own stroke and dash -- the transit ring does -- and is drawn as it says
			: `<circle cx="${el.cx}" cy="${el.cy}" r="${l.radius}" fill="${l.fill}" stroke="${l.stroke ?? TOKENS.waypoint}" stroke-width="${l.width}" stroke-opacity="${l.opacity}"${l.dash ? ` stroke-dasharray="${l.dash}"` : ''}/>`)).join('');
		return `<g class="waypoint ${cls}">${circles}</g>`;
	}
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
		// H15.18 -- the frame WEIGHT is derived, so the export matches the canvas. Only emitted on
		// the rect path: a 1x1 plain node is a <use> of a shared def and takes the stylesheet weight.
		const frame = (sw || sh || panel)
			? `<rect class="frame" x="${-fe}" y="${-fe}" width="${2 * fe + sw}" height="${2 * fe + sh}" rx="${frameRadius(el, L)}" stroke-width="${frameWidth(el, V)}"/>`
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
		// B234 -- the NAME, below the frame, at the offset the canvas uses. Only on the plain path:
		// a PANEL's text is its content regions, and a name would be a second caption on the same box.
		return `<g class="node ${el.sel ? 'selected' : ''}" transform="translate(${el.cx},${el.cy})">
		  ${frame}
		  ${showsSockets(opts) ? `<rect class="socket" x="${-S / 2}" y="${-S / 2}" width="${S}" height="${S}" fill="none" stroke="${TOKENS.socket}" stroke-width="0.6" stroke-dasharray="2 2"/>` : ''}
		  <svg x="${-S / 2}" y="${-S / 2}" width="${S}" height="${S}" viewBox="${bx} ${by} ${bw} ${bh}" preserveAspectRatio="xMidYMid meet"><use href="#glyph-${el.glyph}"/></svg>
		  ${label(el.name, sw / 2, L.frame.ext + V.labelDy + sh)}
		  ${el.sel ? `<path class="select-box" style="display:block" d="${selBox(L, sw, sh)}"/>` : ''}
		</g>`;
	}
	return '';
}

// render ONE resolved element → SVG string. Exposed so an interactive host (the thin UI) can
// build per-entity DOM (wrap with `id` + state classes) instead of the whole-scene string.
export function renderElement(el, V = STD, L = L_STD, opts = {}) { return renderEl(el, V, L, opts); }

// the kind → draw-order rank (no longer exported: no host read it -- K12).
// Region decorations (zone fill, group hull) sit at the BACK; the graph (links, nodes) in front:
// zone → group → link/path → junction/waypoint (over the path) → ports → nodes.
const ORDER = { zone: 0, group: 1, path: 2, junction: 3, waypoint: 3, port: 4, node: 5 };

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
