/*
Renderer — reconciles model state into the SVG layers (zones → links → nodes), incrementally.
Same DOM shape + state-class interface the legacy renderer exposed (so input/selection/CSS port
unchanged), but every geometry NUMBER and glyph def comes from the KERNEL — no hardcoded sizes.
Draws nodes at their EXACT entity px (so live drag stays smooth); the committed positions are
always on-grid. The kernel's resolve()/renderScene() remain the headless/export authority.
*/

import { el, setAttrs } from './painter.js';
import { STD, L_STD, selBox, roundedPath, BEND_R, groupHull } from '../../kernel/index.mjs';
import { GLYPH_BB, TOKENS } from '../../kernel/theme.mjs';

const FE = L_STD.frame.ext;            // node frame half-extent (20)
const SOCKET = STD.socket;             // glyph box (26)
const LINK_W = STD.linkW;              // link/path stroke width (6)
const ZONE_R = L_STD.zone.r;           // zone corner radius (14)
const NODE_LABEL_Y = FE + 18;          // label baseline below the frame
const SELECT_BOX = selBox(L_STD);      // the kernel's selection brackets (±23)
const FIT = (glyph) => GLYPH_BB[glyph] || GLYPH_BB.host;   // unknown glyph → host fit-box (no crash)
// a node's multi-cell footprint (W1): px extent beyond a 1×1 frame (+x/+y from the anchor cell), and a
// cheap signature for change-detect. No span / 1×1 → {0,0} / null, so a 1×1 node renders byte-identically.
const spanPx = (e) => ({ sw: e.span ? (e.span.cols - 1) * STD.pitch : 0, sh: e.span ? (e.span.rows - 1) * STD.pitch : 0 });
const spanSig = (e) => (e.span && (e.span.cols > 1 || e.span.rows > 1)) ? `${e.span.cols}x${e.span.rows}` : null;
// W2 content regions: a node carries content (text/glyph in its socket grid). contentSig drives re-render
// on a content change; absent ⇒ no attr (plain node stays byte-identical). hexColor keeps SVG attrs safe.
const contentSig = (e) => (e.content && e.content.length) ? JSON.stringify(e.content) : null;
const hexColor = (c) => (typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c)) ? c : null;

// render ONE content region into a node's <g> (node-local px) — mirrors kernel/renderer.mjs
// renderContentRegion. Text via textContent (XSS-safe); multi-row wraps as a paragraph.
function contentDom(r, parent, idx = 0) {
	const P = STD.pitch, SE = L_STD.socket.ext, S = SOCKET;
	const [oc, or] = r.at || [0, 0], cols = r.cols || 1, rows = r.rows || 1;
	const x0 = oc * P - SE, y0 = or * P - SE, w = (cols - 1) * P + 2 * SE, h = (rows - 1) * P + 2 * SE;
	const cx = x0 + w / 2, cy = y0 + h / 2;
	// W5/W6 — an interactive region gets a transparent hit rect on top; CSS gives it pointer-events + cursor
	// ONLY in run mode, so view/edit clicks pass through to the node for normal gestures. A button (action →
	// fires draw:action) or an editable input (input → data-idx, opens the inline editor). Appended LAST.
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
	if (r.outline) el('rect', { class: 'content-box', x: x0, y: y0, width: w, height: h, rx: (typeof r.rx === 'number' ? r.rx : 3), fill: hexColor(r.bg) || '#0a0a0a', stroke: hexColor(r.accent) || TOKENS.port, 'stroke-width': 1.3 }, parent);
	const al = r.align || 'center', pad = 8, fill = hexColor(r.fill) || '#e6e9ee';
	const tx = al === 'left' ? x0 + pad : al === 'right' ? x0 + w - pad : x0 + w / 2;
	const anchor = al === 'left' ? 'start' : al === 'right' ? 'end' : 'middle';
	const mkText = (x, y, s) => { const t = el('text', { class: 'content-text', x, y, 'text-anchor': anchor, 'dominant-baseline': 'central', 'font-family': 'ui-monospace,monospace', 'font-size': 15, fill }, parent); t.textContent = s; };
	if (rows <= 1) { mkText(tx, cy, r.value == null ? '' : String(r.value)); addHit(); return; }
	const cpl = Math.max(1, Math.floor((w - 2 * pad) / 9)), lh = 18, words = String(r.value == null ? '' : r.value).split(/\s+/), lines = [];
	let curr = '';
	for (const wd of words) { const tt = curr ? curr + ' ' + wd : wd; if (tt.length > cpl && curr) { lines.push(curr); curr = wd; } else curr = tt; }
	if (curr) lines.push(curr);
	const yTop = cy - (lines.length - 1) * lh / 2;
	lines.forEach((ln, i) => mkText(tx, yTop + i * lh, ln));
	addHit();
}

// opaque backing sized to the text (15px monospace: ~9px/char, CJK wide ~15px)
function pillWidth(name) {
	const w = [...(name || '')].reduce((sum, ch) => sum + (ch.codePointAt(0) > 0x2e7f ? 15 : 9), 0);
	return w > 0 ? w + 8 : 0;
}

export class Renderer {
	constructor(model, svg) {
		this.model = model;
		this.svg = svg;
		// declared back→front to mirror the DOM layer order (region decorations behind the graph):
		// zones → groups → links → waypoints → nodes
		this.layers = {
			zones: svg.querySelector('#zones'),
			groups: svg.querySelector('#groups'),
			links: svg.querySelector('#links'),
			waypoints: svg.querySelector('#waypoints'),
			nodes: svg.querySelector('#nodes')
		};
		this.selectedSet = new Set();   // the renderer OWNS the 'selected' visual state (Selection is renderer-free)
		this.mode = 'view';             // W4/W5 — view | edit | run (client/session, ephemeral). edit shows the
		model.onChange((action, kind, entity) => this.handle(action, kind, entity));   // socket grid; run makes clickable regions act
	}

	// W4/W5 — set the interaction mode. edit shows editing aids (the per-cell socket grid on content panels);
	// run makes clickable content regions act (CSS-gated via the 'run-mode' class); view is clean + normal
	// editing gestures. Session/view state (ephemeral — not persisted). Re-renders content panels.
	setMode(mode) {
		this.mode = mode;
		this.svg.classList.toggle('edit-mode', mode === 'edit');
		this.svg.classList.toggle('run-mode', mode === 'run');
		this.model.all('node').forEach((n) => { if (n.content && n.content.length) this.render('node', n); });
		return this.mode;
	}

	// reflect the current selection onto entity DOM — the SINGLE owner of the 'selected' class.
	// Diffs against the last reflection so only the delta toggles; the set also lets render() re-apply
	// 'selected' when an entity gets fresh DOM (undo/redo/load re-render). Selection just calls this
	// (via subscribe) — it holds no renderer.
	reflectSelection(ids) {
		const next = new Set(ids);
		this.selectedSet.forEach((id) => { if (!next.has(id)) this.setState(id, 'selected', false); });
		next.forEach((id) => { if (!this.selectedSet.has(id)) this.setState(id, 'selected', true); });
		this.selectedSet = next;
	}

	handle(action, kind, entity) {
		if (action === 'load') return this.syncAll();
		if (action === 'put') this.render(kind, entity);
		if (action === 'set') this.update(kind, entity);
		if (action === 'del') this.remove(entity.id);
	}

	syncAll() {
		// a full re-render wipes all DOM → nothing is reflected as 'selected' anymore, so reset the
		// renderer's selection mirror here (don't trust it across a document swap). Selection's 'load'
		// observer re-reflects the survivors immediately after (it subscribes onChange after us); the
		// selection reconcile itself is owned by Model.load.
		this.selectedSet.clear();
		Object.values(this.layers).forEach((layer) => { layer.innerHTML = ''; });
		this.model.all('zone').forEach((z) => this.render('zone', z));
		this.model.all('group').forEach((g) => this.render('group', g));
		this.model.all('link').forEach((l) => this.render('link', l));
		this.model.all('waypoint').forEach((w) => this.render('waypoint', w));
		this.model.all('node').forEach((n) => this.render('node', n));
	}

	// the routed path of a link: src → its via-waypoint centres → dst, rounded at the kernel bend.
	// A link with no via is a 2-point path (straight) — visually identical to the old line. When
	// `closed`, the route loops dst → src as a rounded polygon (the router's close arg rounds the
	// src/dst corners too) — a multi-hop route turned into a ring.
	linkPath(entity) {
		const ep = (id) => this.model.endpointOf(id);   // endpoint = node OR waypoint
		const src = ep(entity.src), dst = ep(entity.dst);
		if (!src || !dst) return null;
		const via = (entity.via || []).map((id) => this.model.get('waypoint', id)).filter(Boolean);
		return roundedPath([[src.x, src.y], ...via.map((w) => [w.x, w.y]), [dst.x, dst.y]], BEND_R, !!entity.closed);
	}

	// group hull = the bbox of member node centres, padded to ±group.ext (the kernel spec).
	// null when no member resolves (avoids ±Infinity), matching the kernel's empty-group guard.
	groupBox(entity) {
		const members = entity.members.map((id) => this.model.endpointOf(id)).filter(Boolean)
			.map((m) => { const { sw, sh } = spanPx(m); return { x: m.x, y: m.y, w: sw, h: sh }; });   // span-aware footprint
		return groupHull(members, L_STD.group.ext);   // one authority shared with the kernel resolve (now footprint-aware)
	}

	render(kind, entity) {
		this.remove(entity.id);             // put is create-or-replace
		if (kind === 'node') {
			const g = el('g', { id: entity.id, class: 'node' }, this.layers.nodes);
			g.setAttribute('transform', `translate(${entity.x},${entity.y})`);
			const { sw, sh } = spanPx(entity), sig = spanSig(entity), csig = contentSig(entity);
			if (sig || csig) {   // a panel (content) or multi-cell node → a sized rounded-rect frame (same .frame styling)
				if (sig) g.setAttribute('data-span', sig);
				// a panel's corner FOLLOWS its shape (like a 1×1 node, toggled by 's'): circle → the circle radius
				// (frame.ext=20; a 1×1 panel == the circle, a row → a pill), square → the sharp frame radius (5)
				el('rect', { 'data-layer': 'frame', class: 'frame', x: -FE, y: -FE, width: 2 * FE + sw, height: 2 * FE + sh, rx: (csig && entity.shape !== 'square') ? L_STD.frame.ext : L_STD.frame.r }, g);
			} else {
				el('use', { 'data-layer': 'frame', href: `#m-${entity.shape || 'circle'}` }, g);
			}
			if (csig) {   // content node (W2): the content regions, + (W4) the per-cell socket grid only in edit mode
				g.setAttribute('data-content', csig);
				if (this.mode === 'edit') {   // edit mode shows the socket grid as an alignment aid; clean view/run hide it
					const gc = entity.span ? entity.span.cols : 1, gr = entity.span ? entity.span.rows : 1;
					for (let j = 0; j < gr; j++) for (let i = 0; i < gc; i++)
						el('rect', { class: 'socket', x: i * STD.pitch - SOCKET / 2, y: j * STD.pitch - SOCKET / 2, width: SOCKET, height: SOCKET }, g);
				}
				entity.content.forEach((r, i) => contentDom(r, g, i));
			} else {
				el('rect', { class: 'socket', x: -SOCKET / 2, y: -SOCKET / 2, width: SOCKET, height: SOCKET }, g);
				const [bx, by, bw, bh] = FIT(entity.type);
				const fit = el('svg', { x: -SOCKET / 2, y: -SOCKET / 2, width: SOCKET, height: SOCKET, viewBox: `${bx} ${by} ${bw} ${bh}`, preserveAspectRatio: 'xMidYMid meet' }, g);
				el('use', { 'data-layer': 'glyph', href: `#glyph-${entity.type}` }, fit);
			}
			el('path', { class: 'select-box', d: sig ? selBox(L_STD, sw, sh) : SELECT_BOX }, g);
			if (!csig) {   // a content node (text box / panel) is self-labelled by its content — no name sub-title
				const pw = pillWidth(entity.name);
				el('rect', { class: 'label-pill', rx: 4, x: sw / 2 - pw / 2, y: NODE_LABEL_Y - 13 + sh, width: pw, height: 17 }, g);
				el('text', { class: 'label', x: sw / 2, y: NODE_LABEL_Y + sh }, g).textContent = entity.name || '';
			}
		}
		if (kind === 'link') {
			const d = this.linkPath(entity);
			if (!d) return;
			el('path', { id: entity.id, class: 'link', 'stroke-width': LINK_W, fill: 'none', d }, this.layers.links);
		}
		if (kind === 'zone') {
			const g = el('g', { id: entity.id, class: 'zone' }, this.layers.zones);
			el('rect', { class: 'zone-rect', rx: ZONE_R, x: entity.x, y: entity.y, width: entity.w, height: entity.h }, g);
			el('rect', { class: 'label-pill', rx: 4, x: entity.x + 6, y: entity.y + 9, width: pillWidth(entity.name), height: 17 }, g);
			el('text', { class: 'label zone-label', x: entity.x + 10, y: entity.y + 22 }, g).textContent = entity.name || '';
		}
		if (kind === 'group') {
			const b = this.groupBox(entity);
			if (!b) return;                 // no resolvable members → no hull
			const g = el('g', { id: entity.id, class: 'group' }, this.layers.groups);
			el('rect', { class: 'group-hull', x: b.x, y: b.y, width: b.w, height: b.h, rx: L_STD.group.r, fill: 'none', stroke: TOKENS.group, 'stroke-width': 1.1 }, g);
		}
		if (kind === 'waypoint') {
			const g = el('g', { id: entity.id, class: 'waypoint' }, this.layers.waypoints);
			g.setAttribute('transform', `translate(${entity.x},${entity.y})`);
			el('circle', { class: 'wp-ring', r: FE, fill: 'none', stroke: TOKENS.waypoint, 'stroke-width': 1.6, 'stroke-opacity': 0.7 }, g);
			el('circle', { class: 'wp-dot', r: 2.2, fill: TOKENS.waypoint }, g);
			el('path', { class: 'select-box', d: SELECT_BOX }, g);   // brackets when selected (like a node)
		}
		// fresh DOM loses the 'selected' class — re-apply it if this entity is selected (undo/redo/load)
		if (this.selectedSet.has(entity.id)) this.setState(entity.id, 'selected', true);
	}

	update(kind, entity) {
		const dom = this.elementOf(entity.id);
		if (!dom) return this.render(kind, entity);
		if (kind === 'node') {
			// a footprint OR content change (resize, 1×1↔span, content set) → re-render (always correct); a
			// pure move keeps the fast path (frame/content/selBox are all local to the translate → only transform).
			const sig = spanSig(entity), csig = contentSig(entity);
			if ((dom.getAttribute('data-span') || null) !== sig || (dom.getAttribute('data-content') || null) !== csig) return this.render('node', entity);
			dom.setAttribute('transform', `translate(${entity.x},${entity.y})`);
			const glyph = csig ? null : dom.querySelector('[data-layer="glyph"]');
			if (glyph) {   // a plain node has the default type glyph; a content node has none (its regions own the glyphs)
				const glyphHref = `#glyph-${entity.type}`;
				if (glyph.getAttribute('href') !== glyphHref) {
					glyph.setAttribute('href', glyphHref);
					const [bx, by, bw, bh] = FIT(entity.type);
					glyph.parentNode.setAttribute('viewBox', `${bx} ${by} ${bw} ${bh}`);   // refit the socket box
				}
			}
			const frame = dom.querySelector('[data-layer="frame"]');
			if (frame.tagName.toLowerCase() === 'use') {   // 1×1 plain node: 's' swaps the circle/square frame def
				const frameHref = `#m-${entity.shape || 'circle'}`;
				if (frame.getAttribute('href') !== frameHref) frame.setAttribute('href', frameHref);
			} else {   // a panel/span rect: 's' swaps the corner rx (circle → round 20, square → sharp 5)
				const rx = (csig && entity.shape !== 'square') ? L_STD.frame.ext : L_STD.frame.r;
				if (Number(frame.getAttribute('rx')) !== rx) frame.setAttribute('rx', rx);
			}
			const label = dom.querySelector('.label');
			if (label && label.textContent !== entity.name) {
				label.textContent = entity.name || '';
				const pw = pillWidth(entity.name), sw = spanPx(entity).sw;
				setAttrs(dom.querySelector('.label-pill'), { x: sw / 2 - pw / 2, width: pw });
			}
			this.model.linksOf(entity.id).forEach((link) => this.update('link', link));
			const grp = this.model.groupOf(entity.id);
			if (grp) this.update('group', grp);   // the hull hugs its members → follow the move
		}
		if (kind === 'link') {
			const d = this.linkPath(entity);
			if (d) setAttrs(dom, { d });
		}
		if (kind === 'zone') {
			setAttrs(dom.querySelector('.zone-rect'), { x: entity.x, y: entity.y, width: entity.w, height: entity.h });
			const label = dom.querySelector('.label');
			setAttrs(label, { x: entity.x + 10, y: entity.y + 22 });
			if (label.textContent !== entity.name) label.textContent = entity.name || '';
			setAttrs(dom.querySelector('.label-pill'), { x: entity.x + 6, y: entity.y + 9, width: pillWidth(entity.name) });
		}
		if (kind === 'group') {
			const b = this.groupBox(entity);
			if (!b) return this.remove(entity.id);                 // shrank below a member → drop the hull
			const rect = dom.querySelector('.group-hull');
			if (rect) setAttrs(rect, { x: b.x, y: b.y, width: b.w, height: b.h });
			else this.render('group', entity);
		}
		if (kind === 'waypoint') {
			dom.setAttribute('transform', `translate(${entity.x},${entity.y})`);
			this.model.linksAt(entity.id).forEach((l) => this.update('link', l));   // endpoint + via links
			const grp = this.model.groupOf(entity.id);
			if (grp) this.update('group', grp);                                      // reflow a group it belongs to
		}
	}

	remove(id) {
		const dom = this.elementOf(id);
		if (dom) dom.remove();
	}

	elementOf(id) {
		return this.svg.ownerDocument.getElementById(id);
	}

	setState(id, cls, on) {
		const dom = this.elementOf(id);
		if (dom) dom.classList.toggle(cls, on);
	}

	clearState(id, ...classes) {
		const dom = this.elementOf(id);
		if (dom) classes.forEach((cls) => dom.classList.remove(cls));
	}
}
