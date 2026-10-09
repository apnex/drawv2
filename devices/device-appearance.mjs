/*
THE DEVICES PLUGIN'S APPEARANCE -- C-a, step three (H19.29; D3, the appearance pipeline's composition half, ruled 2026-09-22).

A device composed on an anchor is drawn as its frame -- a circle or square, or a sized rect for a panel or a wide device --
its socket guides in edit mode, its glyph or its content regions, and its name on a pill below. It competes for the anchor
and outranks the network's marks (the product's ranks, product/canvas.mjs), so a device emits no endpoint pad: the rule, not
a branch. The network's transit ring composes over it. It was the renderer's own branch (app/src/renderer.js `draw`,
`update`, `nodeLook`, `contentDom`); the elements, their order and every attribute are what the renderer built -- the K8 DOM
corpus and tests/appearance.test.js hold that.
*/

import { STD, L_STD } from '../kernel/spec.mjs';
import { selBox, contentLayout, hexColor, isPanel, frameRadius, frameWidth, showsSockets } from '../kernel/renderer.mjs';
import { spanExtent } from '../kernel/geometry.mjs';
import { GLYPH_BB, TOKENS } from '../kernel/theme.mjs';
import { hasDevice } from './device-fields.mjs';
import { DEVICE_PRESSES } from './device-gestures.mjs';
import { DEVICE_HAND } from './device-hand.mjs';
import { DEVICE_POINTS } from './device-footprint.mjs';

const FE = L_STD.frame.ext;            // the frame's half-extent (20)
const SOCKET = STD.socket;             // the glyph box (26)
const NODE_LABEL_Y = FE + STD.labelDy; // the label baseline below the frame -- B236, the spec owns the offset
const SELECT_BOX = selBox(L_STD);      // the kernel's selection brackets (+-23)
const FIT = (glyph) => GLYPH_BB[glyph] || GLYPH_BB.host;   // an unknown glyph takes the host's fit box (no crash)
// a multi-cell footprint (W1) and a cheap signature of it; none, or 1x1, gives null, so a 1x1 device draws as one always did
const spanSig = (e) => (e.span && (e.span.cols > 1 || e.span.rows > 1)) ? `${e.span.cols}x${e.span.rows}` : null;
// content regions (W2): their signature drives a fresh render on a content change; none, no attribute
const contentSig = (e) => (isPanel(e) ? JSON.stringify(e.content) : null);   // one owner for 'is a panel'

// render ONE content region into a node's <g> (node-local px) — mirrors kernel/renderer.mjs
// renderContentRegion. Text via textContent (XSS-safe); multi-row wraps as a paragraph.
function contentDom(r, parent, idx, el) {
	// LAYOUT is the kernel's (contentLayout); EMISSION is ours. The two renderers have different
	// duties — live addressable elements here, a complete document there — but shared arithmetic was
	// a copy waiting to drift (B40).
	const { x0, y0, w, h, cx, cy, tx, anchor, fill, lines, size } = contentLayout(r);
	const S = SOCKET;
	// W5/W6 — an interactive region gets a transparent hit rect on top; CSS gives it pointer-events +
	// cursor ONLY in run mode, so view/edit clicks pass through to the node. Appended LAST.
	const addHit = () => {
		if (r.action && /^[a-z0-9-]+$/.test(r.action)) el('rect', { class: 'clickable', 'data-action': r.action, x: x0, y: y0, width: w, height: h, fill: 'transparent' }, parent);
		else if (r.input) el('rect', { class: 'clickable', 'data-input': '', 'data-idx': String(idx), x: x0, y: y0, width: w, height: h, fill: 'transparent' }, parent);
	};
	if (r.content === 'glyph') {
		const [bx, by, bw, bh] = FIT(r.glyph);
		const svg = el('svg', { x: cx - S / 2, y: cy - S / 2, width: S, height: S, viewBox: `${bx} ${by} ${bw} ${bh}`, preserveAspectRatio: 'xMidYMid meet' }, parent);
		el('use', { 'data-layer': 'glyph', href: `#glyph-${r.glyph}` }, svg);
		addHit(); return;
	}
	if (r.outline) el('rect', { class: 'content-box', x: x0, y: y0, width: w, height: h, rx: (typeof r.rx === 'number' ? r.rx : 3), fill: hexColor(r.bg) || TOKENS.contentBg, stroke: hexColor(r.accent) || TOKENS.port, 'stroke-width': 1.3 }, parent);
	for (const ln of lines) {
		const t = el('text', { class: 'content-text', x: tx, y: ln.y, 'text-anchor': anchor, 'dominant-baseline': 'central', 'font-family': 'ui-monospace,monospace', 'font-size': size, fill }, parent);
		t.textContent = ln.text;
	}
	addHit();
}

// H15.9 -- every attribute that can change while the structure stays, per part, in one call; create and update both apply it
const nodeLook = (entity, pillWidth) => {
	const csig = contentSig(entity), sig = spanSig(entity);
	const look = { root: { transform: `translate(${entity.x},${entity.y})` } };
	// a panel or span draws a sized rect, whose corner follows its shape; a plain node `<use>`s the circle or square def
	look.frame = (sig || csig) ? { rx: frameRadius(entity, L_STD), 'stroke-width': frameWidth(entity) } : { href: `#m-${entity.shape || 'circle'}` };
	if (!csig) {   // a content node is labelled by its content and its regions own the glyphs
		const [bx, by, bw, bh] = FIT(entity.type);
		const pw = pillWidth(entity.name), { sw } = spanExtent(entity.span);
		look.fit = { viewBox: `${bx} ${by} ${bw} ${bh}` };   // the glyph fitted to its own box (B205)
		look.glyph = { href: `#glyph-${entity.type}` };
		look.pill = { x: sw / 2 - pw / 2, width: pw };
		look.label = { x: sw / 2, text: entity.name || '' };
	}
	return look;
};
const NODE_PARTS = {
	frame: (g) => g.querySelector('[data-layer="frame"]'),
	glyph: (g) => g.querySelector('[data-layer="glyph"]'),
	fit: (g) => g.querySelector('[data-layer="glyph"]')?.parentNode ?? null,
	pill: (g) => g.querySelector('.label-pill'),
	label: (g) => g.querySelector('.label'),
};

const DEVICE = {
	id: 'device',
	kind: 'node',
	state: (entity) => (hasDevice(entity) ? 'device' : null),
	composes: false,
	root: { layer: 'nodes', class: () => 'node' },
	picks: [{ closest: 'g.node:not(.ghost)', word: 'node', clones: true }],   // C-b: a held tool's ghost is no device; D4: Ctrl+left clones it
	rootAttrs: (entity) => [['data-span', spanSig(entity)], ['data-content', contentSig(entity)]].filter(([, v]) => v),
	// what changes the structure -- a footprint or the content -- renders afresh; a move keeps the look's fast path
	structure: (entity) => `${spanSig(entity)}|${contentSig(entity)}`,
	parts: {
		frame(entity, g, { el }) {
			const { sw, sh } = spanExtent(entity.span);
			// a panel or wide device: a sized rect, its corner following its shape; a plain device <use>s the circle or square
			if (spanSig(entity) || contentSig(entity)) el('rect', { 'data-layer': 'frame', class: 'frame', x: -FE, y: -FE, width: 2 * FE + sw, height: 2 * FE + sh }, g);
			else el('use', { 'data-layer': 'frame' }, g);
		},
		// W4: the socket guides are an editing aid, shown only in edit mode -- one rule for a panel's grid and a device's square
		sockets(entity, g, { el, renderOpts }) {
			if (!showsSockets(renderOpts())) return;
			if (contentSig(entity)) {
				const gc = entity.span ? entity.span.cols : 1, gr = entity.span ? entity.span.rows : 1;
				for (let j = 0; j < gr; j++) for (let i = 0; i < gc; i++)
					el('rect', { class: 'socket', x: i * STD.pitch - SOCKET / 2, y: j * STD.pitch - SOCKET / 2, width: SOCKET, height: SOCKET }, g);
			} else {
				el('rect', { class: 'socket', x: -SOCKET / 2, y: -SOCKET / 2, width: SOCKET, height: SOCKET }, g);
			}
		},
		body(entity, g, { el }) {
			if (contentSig(entity)) { entity.content.forEach((r, i) => contentDom(r, g, i, el)); return; }
			const fit = el('svg', { x: -SOCKET / 2, y: -SOCKET / 2, width: SOCKET, height: SOCKET, preserveAspectRatio: 'xMidYMid meet' }, g);
			el('use', { 'data-layer': 'glyph' }, fit);
		},
		// a panel is labelled by its content: no name below it
		label(entity, g, { el }) {
			if (contentSig(entity)) return;
			const { sh } = spanExtent(entity.span);
			el('rect', { class: 'label-pill', rx: 4, y: NODE_LABEL_Y - 13 + sh, height: STD.labelH }, g);
			el('text', { class: 'label', y: NODE_LABEL_Y + sh, 'font-size': STD.fontSize }, g);
		},
	},
	selectBox: (entity) => { const { sw, sh } = spanExtent(entity.span); return spanSig(entity) ? selBox(L_STD, sw, sh) : SELECT_BOX; },
	look: (entity, { pillWidth }) => [nodeLook(entity, pillWidth), NODE_PARTS],
};

// the devices plugin's canvas part (C-a: the device's appearance on the anchor)
export const DEVICES_CANVAS = { owner: 'devices', appearances: [DEVICE], presses: DEVICE_PRESSES, hand: DEVICE_HAND, at: DEVICE_POINTS };   // C-d: the text box's row; C-e: its hand, what a device covers
