/*
THE DEVICES PLUGIN'S APPEARANCE -- C-a, step three (H19.29; D3, the appearance pipeline's composition half, ruled 2026-09-22).

A device composed on an anchor is drawn as its frame -- a circle or square, or a sized rect for a panel or a wide device --
its socket guides in edit mode, its glyph or its content regions, and its name on a pill below. It competes for the anchor
and outranks the network's marks (the product's ranks, product/canvas.mjs), so a device emits no endpoint pad: the rule, not
a branch. The network's transit ring composes over it. It was the renderer's own branch (app/src/renderer.js `draw`,
`update`, `nodeLook`, `contentDom`); the elements, their order and every attribute are what the renderer built -- the K8 DOM
corpus and tests/appearance.test.js hold that.
RESTATED H26.8 (dev/design/components/NATIVE-SHAPES.md section 3.2; appendix B): each of its parts answers its shapes, once, every
attribute where the fresh draw wrote it -- the frame's corner and weight or its def, the glyph's fit and def, the label's place and
name, and the root's place among its `rootAttrs` -- where it built elements and a `look` wrote those again through its finders, and a
`structure` signature asked for a fresh render (T5). The scene diffs one description against the last.
*/

import { bareAnchor, typedNodes } from './device-shapes.mjs';
import { makeWaypoint } from './make-node.mjs';
import { waypointAt } from './occupancy.mjs';
import { STD, L_STD } from '../../kernel/spec.mjs';
import { selBox, hexColor, showsSockets, nameLabel } from '../../kernel/renderer.mjs';
import { NODE_GRID } from '../../kernel/geometry.mjs';   // H26.1: the node grid's declared pitch, a socket's step
import { TOKENS } from '../../kernel/theme.mjs';
import { GLYPH_BB, DEFAULT_GLYPH_BB, GLYPH_DEFS, isPanel, frameRadius, frameWidth, contentLayout } from './device-types.mjs';
import { hasDevice } from './device-fields.mjs';
import { DEVICE_PRESSES } from './device-gestures.mjs';
import { DEVICE_HAND } from './device-hand.mjs';
import { DEVICE_POINTS, DEVICE_SIZES, DEVICE_OUTLINES, spanThrough } from './device-footprint.mjs';   // H26.1: what a span runs through, on the node grid
import { DEVICE_SIZE_STEP } from './device-size.mjs';
import { DEVICE_KEYS } from './device-keys.mjs';
import { DEVICE_DESCRIBE, DEVICE_SELECT_ALL } from './device-facts.mjs';
import { DEVICE_LABELS } from './device-labels.mjs';

const FE = L_STD.frame.ext;            // the frame's half-extent (20)
const PITCH = NODE_GRID.declaration.pitch;   // a socket's step in a device's own frame (stays draw's: positions in that frame)
const SOCKET = STD.socket;             // the glyph box (26)
const NODE_LABEL_Y = FE + STD.labelDy; // the label baseline below the frame -- B236, the spec owns the offset
const SELECT_BOX = selBox(L_STD);      // the kernel's selection brackets (+-23)
const FIT = (glyph) => GLYPH_BB[glyph] || DEFAULT_GLYPH_BB;   // an unknown glyph takes the default type's fit box (no crash)
// a multi-cell footprint (W1) and a cheap signature of it; none, or 1x1, gives null, so a 1x1 device draws as one always did
const spanSig = (e) => (e.span && (e.span.cols > 1 || e.span.rows > 1)) ? `${e.span.cols}x${e.span.rows}` : null;
// content regions (W2): their signature drives a fresh render on a content change; none, no attribute
const contentSig = (e) => (isPanel(e) ? JSON.stringify(e.content) : null);   // one owner for 'is a panel'

// ONE content region's shapes, in a node's own frame (node-local px). Its text is a shape's text, written by the scene as text
// (XSS-safe); a multi-row region wraps as a paragraph.
function contentShapes(r, idx) {
	// LAYOUT is the kernel's (contentLayout); EMISSION is ours. The two renderers have different
	// duties — live addressable elements here, a complete document there — but shared arithmetic was
	// a copy waiting to drift (B40).
	const { x0, y0, w, h, cx, cy, tx, anchor, fill, lines, size } = contentLayout(r);
	const S = SOCKET, out = [];
	// W5/W6 — an interactive region gets a transparent hit rect on top; CSS gives it pointer-events +
	// cursor ONLY in run mode, so view/edit clicks pass through to the node. Appended LAST.
	const hit = () => {
		if (r.action && /^[a-z0-9-]+$/.test(r.action)) out.push({ tag: 'rect', attrs: { class: 'clickable', 'data-action': r.action, x: x0, y: y0, width: w, height: h, fill: 'transparent' } });
		else if (r.input) out.push({ tag: 'rect', attrs: { class: 'clickable', 'data-input': '', 'data-idx': String(idx), x: x0, y: y0, width: w, height: h, fill: 'transparent' } });
		return out;
	};
	if (r.content === 'glyph') {
		const [bx, by, bw, bh] = FIT(r.glyph);
		out.push({ tag: 'svg', attrs: { x: cx - S / 2, y: cy - S / 2, width: S, height: S, viewBox: `${bx} ${by} ${bw} ${bh}`, preserveAspectRatio: 'xMidYMid meet' },
			children: [{ tag: 'use', attrs: { 'data-layer': 'glyph', href: `#glyph-${r.glyph}` } }] });
		return hit();
	}
	if (r.outline) out.push({ tag: 'rect', attrs: { class: 'content-box', x: x0, y: y0, width: w, height: h, rx: (typeof r.rx === 'number' ? r.rx : 3), fill: hexColor(r.bg) || TOKENS.contentBg, stroke: hexColor(r.accent) || TOKENS.port, 'stroke-width': 1.3 } });
	for (const ln of lines) {
		const text = ln.text == null ? '' : String(ln.text);
		out.push({ tag: 'text', attrs: { class: 'content-text', x: tx, y: ln.y, 'text-anchor': anchor, 'dominant-baseline': 'central', 'font-family': 'ui-monospace,monospace', 'font-size': size, fill }, ...(text ? { text } : {}) });
	}
	return hit();
}

const DEVICE = {
	id: 'device',
	kind: 'node',
	state: (entity) => (hasDevice(entity) ? 'device' : null),
	composes: false,
	root: { layer: 'nodes', class: () => 'node' },
	// C-b: a held tool's ghost is no device; D4: Ctrl+left clones it; C-f: idle under the pointer it shows the crosshair ring -- a
	// left drag draws a link from it
	picks: [{ closest: 'g.node:not(.ghost)', word: 'node', clones: true, idle: 'linkband' }],
	// its footprint and content, when either is more than one plain cell, then its place
	rootAttrs: (entity) => [['data-span', spanSig(entity)], ['data-content', contentSig(entity)], ['transform', `translate(${entity.x},${entity.y})`]].filter(([, v]) => v),
	parts: {
		frame(entity) {
			const { sw, sh } = spanThrough(entity.span);
			// a panel or wide device: a sized rect, its corner following its shape; a plain device <use>s the circle or square def
			if (spanSig(entity) || contentSig(entity)) return [{ tag: 'rect', attrs: { 'data-layer': 'frame', class: 'frame', x: -FE, y: -FE, width: 2 * FE + sw, height: 2 * FE + sh, rx: frameRadius(entity, L_STD), 'stroke-width': frameWidth(entity) } }];
			return [{ tag: 'use', attrs: { 'data-layer': 'frame', href: `#m-${entity.shape || 'circle'}` } }];
		},
		// W4: the socket guides are an editing aid, shown only in edit mode -- one rule for a panel's grid and a device's square
		sockets(entity, { renderOpts }) {
			if (!showsSockets(renderOpts())) return [];
			const socket = (x, y) => ({ tag: 'rect', attrs: { class: 'socket', x, y, width: SOCKET, height: SOCKET } });
			if (!contentSig(entity)) return [socket(-SOCKET / 2, -SOCKET / 2)];
			const gc = entity.span ? entity.span.cols : 1, gr = entity.span ? entity.span.rows : 1, out = [];
			for (let j = 0; j < gr; j++) for (let i = 0; i < gc; i++) out.push(socket(i * PITCH - SOCKET / 2, j * PITCH - SOCKET / 2));
			return out;
		},
		// a panel's regions own the glyphs; a device's glyph is fitted to its own box (B205)
		body(entity) {
			if (contentSig(entity)) return entity.content.flatMap((r, i) => contentShapes(r, i));
			const [bx, by, bw, bh] = FIT(entity.type);
			return [{ tag: 'svg', attrs: { x: -SOCKET / 2, y: -SOCKET / 2, width: SOCKET, height: SOCKET, preserveAspectRatio: 'xMidYMid meet', viewBox: `${bx} ${by} ${bw} ${bh}` },
				children: [{ tag: 'use', attrs: { 'data-layer': 'glyph', href: `#glyph-${entity.type}` } }] }];
		},
		// a panel is labelled by its content: no name below it
		label(entity, { pillWidth }) {
			if (contentSig(entity)) return [];
			const { sw, sh } = spanThrough(entity.span), pw = pillWidth(entity.name);
			return nameLabel({ pill: { rx: 4, y: NODE_LABEL_Y - 13 + sh, height: STD.labelH, x: sw / 2 - pw / 2, width: pw },
				text: { y: NODE_LABEL_Y + sh, 'font-size': STD.fontSize, x: sw / 2 }, name: entity.name || '' });   // H25.1: the core's label
		},
	},
	selectBox: (entity) => { const { sw, sh } = spanThrough(entity.span); return spanSig(entity) ? selBox(L_STD, sw, sh) : SELECT_BOX; },
};

// the devices plugin's canvas part (C-a: the device's appearance on the anchor)
// C-d: the text box's row; C-e: its hand, what a device covers, its size step under the canvas's Shift+arrow
export const DEVICES_CANVAS = { owner: 'devices', stylesheets: ['plugins/devices/devices.css'], defs: GLYPH_DEFS, bare: { make: makeWaypoint, at: waypointAt, of: bareAnchor }, appearances: [DEVICE], presses: DEVICE_PRESSES, hand: DEVICE_HAND, at: DEVICE_POINTS, sizeStep: DEVICE_SIZE_STEP, sizes: DEVICE_SIZES, outlines: DEVICE_OUTLINES,
	keys: DEVICE_KEYS, describe: DEVICE_DESCRIBE, selectAll: DEVICE_SELECT_ALL, labels: DEVICE_LABELS,
	drawn: ['.node'], tally: { rank: 0, word: 'nodes', of: (model) => typedNodes(model).length } };   // C-f: what it draws; its count   // C-e: its key, `s`; how it reads, Ctrl+A; where its label edits
