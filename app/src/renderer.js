/*
Renderer — reconciles model state into the SVG layers (zones → links → nodes), incrementally.
Same DOM shape + state-class interface the legacy renderer exposed (so input/selection/CSS port
unchanged), but every geometry NUMBER and glyph def comes from the KERNEL — no hardcoded sizes.
Draws nodes at their EXACT entity px (so live drag stays smooth); the committed positions are
always on-grid. The kernel's resolve()/renderScene() remain the headless/export authority.
*/

import { el, setAttrs } from './painter.js';
import { waypointRoles } from '../../kernel/network-roles.mjs';
import { waypointLayers, linkAppearance, APPEARANCE_KEYS } from '../../kernel/network-appearance.mjs';
import { groupHull, spanExtent } from '../../kernel/geometry.mjs';
import { STD, L_STD, BEND_R } from '../../kernel/spec.mjs';
import { selBox, contentLayout, hexColor, isPanel, frameRadius, frameWidth, showsSockets } from '../../kernel/renderer.mjs';
import { roundedPath } from '../../kernel/router.mjs';
import { GLYPH_BB, TOKENS } from '../../kernel/theme.mjs';

const FE = L_STD.frame.ext;            // node frame half-extent (20)
const SOCKET = STD.socket;             // glyph box (26)
const LINK_W = STD.linkW;              // link/path stroke width (6)
const ZONE_R = L_STD.zone.r;           // zone corner radius (14)
const NODE_LABEL_Y = FE + STD.labelDy; // label baseline below the frame -- B236, the spec owns the offset
const SELECT_BOX = selBox(L_STD);      // the kernel's selection brackets (±23)
const FIT = (glyph) => GLYPH_BB[glyph] || GLYPH_BB.host;   // unknown glyph → host fit-box (no crash)
// a node's multi-cell footprint (W1): px extent beyond a 1×1 frame (+x/+y from the origin cell), and a
// cheap signature for change-detect. No span / 1×1 → {0,0} / null, so a 1×1 node renders byte-identically.
const spanSig = (e) => (e.span && (e.span.cols > 1 || e.span.rows > 1)) ? `${e.span.cols}x${e.span.rows}` : null;
// W2 content regions: a node carries content (text/glyph in its socket grid). contentSig drives re-render
// on a content change; absent ⇒ no attr (plain node stays byte-identical). hexColor keeps SVG attrs safe.
const contentSig = (e) => (isPanel(e) ? JSON.stringify(e.content) : null);   // one owner for 'is a panel'

/*
B268 -- A LINK'S CLICK AREA, apart from how it looks. The browser hit-tests a stroke's dashes and not its gaps, so a down
link (dotted) or a control link (dashed) was selected only where a click landed on a dot -- measured, 10 of 29 clicks.
Each link therefore has an invisible twin drawn just after it: the same path and the same width and caps, never dashed,
never seen, taking the click for the link (`app/src/pick.js` reads its `data-link`). The click area is exactly the link's
own outline, gaps filled -- no wider -- and the visible link is untouched.
*/
const hitOf = (d, look) => ({ d, fill: 'none', stroke: 'transparent', 'stroke-width': look['stroke-width'],
	...(look['stroke-linecap'] ? { 'stroke-linecap': look['stroke-linecap'] } : {}) });

// one layer of the kernel's waypoint rings, as a circle -- a layer may carry its own stroke and dash, as the transit ring
// does, and is drawn as it says; the canvas and the export draw the same list the same way
function layerCircle(l, g) {
	el('circle', l.fill === 'solid'
		? { class: l.cls, r: l.radius, fill: TOKENS.waypoint }
		: { class: l.cls, r: l.radius, fill: l.fill, stroke: l.stroke ?? TOKENS.waypoint, 'stroke-width': l.width, 'stroke-opacity': l.opacity, ...(l.dash ? { 'stroke-dasharray': l.dash } : {}) }, g);
}

// render ONE content region into a node's <g> (node-local px) — mirrors kernel/renderer.mjs
// renderContentRegion. Text via textContent (XSS-safe); multi-row wraps as a paragraph.
function contentDom(r, parent, idx = 0) {
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

// opaque backing sized to the text (15px monospace: ~9px/char, CJK wide ~15px)
/*
H15.9 -- THE APPEARANCE PIPELINE, for every kind (docs/spec/ATOMICS.md). Each look answers, in ONE call, every attribute
of an entity's drawing that can change while its STRUCTURE stays -- per part, as attributes, with `text` for a label's
content. Create builds the structure and applies the look; update checks the structure and applies the same look. So a
fact cannot be wired into one branch and not the other (B218, B228, B230): there is one place it is decided, and both
branches emit it. What changes the structure -- a span, content, a waypoint's roles -- re-renders instead.

Links have had this since H15.9's first rung (`linkAppearance`, with `APPEARANCE_KEYS` for its optional keys). A waypoint's
rings stay a LIST of layers (`waypointLayers`): it draws several circles rather than one element, so its roles re-render.
tests/appearance.test.js holds the property for every kind: an update equals a fresh render, in two separate documents.
*/
const nodeLook = (entity) => {
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
const zoneLook = (entity) => ({
	rect: { x: entity.x, y: entity.y, width: entity.w, height: entity.h },
	label: { x: entity.x + STD.zoneDx, y: entity.y + STD.zoneDy, text: entity.name || '' },   // the spec owns the offset
	pill: { x: entity.x + 6, y: entity.y + 9, width: pillWidth(entity.name) },
});
const ZONE_PARTS = { rect: (g) => g.querySelector('.zone-rect'), label: (g) => g.querySelector('.label'), pill: (g) => g.querySelector('.label-pill') };
const groupLook = (box) => ({ hull: { x: box.x, y: box.y, width: box.w, height: box.h } });
const GROUP_PARTS = { hull: (g) => g.querySelector('.group-hull') };
const waypointLook = (entity) => ({ root: { transform: `translate(${entity.x},${entity.y})` } });

// emit a look onto an element: each part found by its finder, each attribute set, `text` as the element's content
function applyLook(dom, look, parts = {}) {
	for (const [part, attrs] of Object.entries(look)) {
		const target = part === 'root' ? dom : parts[part]?.(dom);
		if (!target) continue;
		for (const [k, v] of Object.entries(attrs)) {
			if (k === 'text') { if (target.textContent !== v) target.textContent = v; }
			else target.setAttribute(k, v);
		}
	}
}

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
		this.labels = true;             // node and zone names, Tab-toggled; visible by default
		this.mode = 'view';             // W4/W5 — view | edit | run (client/session, ephemeral). edit shows the
		model.onChange((action, kind, entity) => this.handle(action, kind, entity));   // socket grid; run makes clickable regions act
	}

	// W4/W5 — set the interaction mode. edit shows editing aids (the per-cell socket grid on content panels);
	// run makes clickable content regions act (CSS-gated via the 'run-mode' class); view is clean + normal
	// editing gestures. Session/view state (ephemeral — not persisted). Re-renders content panels.
	/*
	Labels on or off, Tab-toggled. Visible by default, so a fresh session shows names.

	A class rather than a re-render: the elements stay and CSS hides them, which makes the toggle
	instant on a large diagram and keeps the export unaffected -- a rendered SVG always carries its
	labels, because a diagram nobody can read is not a diagram.

	Not persisted, deliberately. The mode toggles are session state and this is one; a diagram that
	opens with its names missing because of a keystroke from last week is a puzzle, not a setting.
	*/
	toggleLabels() {
		this.labels = !this.labels;
		this.svg.classList.toggle('labels-off', !this.labels);
		return this.labels;
	}

	// what this renderer would pass a headless renderer, so both answer the same predicates
	renderOpts() {
		return { sockets: this.mode === 'edit' };
	}

	/*
	H13.2 -- the glyph element of a node, for whoever needs to orient it.

	Exposed here because the renderer OWNS node DOM and nothing else should be reaching into it.
	`app/src/movers.js` first did this with `document.getElementById`, which `scan-writers` refused
	under B45: a DOM global welds a module to the one page it happens to run in, and the presentation
	layer had no business knowing how a node is assembled.

	Scoped to the nodes layer rather than the document, so it cannot accidentally match a template,
	a legend, or an off-canvas copy of the same id.
	*/
	glyphOf(id) {
		const node = this.layers.nodes.querySelector(`[id="${id}"]`);
		return node ? node.querySelector('[data-layer="glyph"]') : null;
	}

	/*
	H14.4 -- the element carrying an entity, for whoever needs to mark it rather than draw it.

	Exposed for the same reason as `glyphOf` above and under the same rule (B45): the renderer owns
	entity DOM, and `app/src/reveal.js` marking an unrevealed entity has no business knowing which
	layer a kind lives in or how the element is assembled. Searched across every layer because a
	reveal names ids without regard to kind -- a beat may withhold a link as readily as a node.
	*/
	byId(id) {
		for (const layer of Object.values(this.layers)) {
			const hit = layer?.querySelector?.(`[id="${id}"]`);
			if (hit) return hit;
		}
		return null;
	}

	setMode(mode) {
		this.mode = mode;
		this.svg.classList.toggle('edit-mode', mode === 'edit');
		this.svg.classList.toggle('run-mode', mode === 'run');
		// every node, not only the panels. Gating a plain node's socket on the mode is pointless if
		// switching mode never re-renders it -- the change would appear on the next unrelated edit.
		this.model.all('node').forEach((n) => this.render('node', n));
		// H12.8 -- one hook, so the composition root can start or stop the movers without the
		// renderer knowing they exist. The renderer draws the document; movers are not in it.
		this.onMode?.(this.mode);
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
		this.reflectPathSelection();
		this.reflectBlockers();
	}

	/*
	The links BLOCKING a selected down link are highlighted -- ruled 2026-09-30: "when I select a down/broken link
	that cannot be healed due to another link occupying my preferred path, also highlight that blocking link in
	orange so I can see the path that is blocking".

	The model says who blocks (`blockersOf`, empty in production, which has no pipes). Every link path is visited so
	a highlight left from an earlier selection -- or an earlier board -- is removed, not stranded: the half B218 and
	B228 each got wrong once. Called again after an edit, since an edit can change who blocks whom.
	*/
	reflectBlockers() {
		const blocking = new Set();
		for (const id of this.selectedSet) {
			const link = this.model.get('link', id);
			if (link && this.model.isLinkDown(link)) for (const by of this.model.blockersOf(link)) blocking.add(by);
		}
		for (const path of this.layers.links.querySelectorAll('path.link')) path.classList.toggle('blocking', blocking.has(path.id));
	}

	/*
	A selected path highlights its own ANCHORS, not just its line.

	Selecting a link turns it green; its waypoints kept the link colour, so a green line ran through
	blue rings and terminated on blue pads -- the path and the thing it is made of disagreeing about
	whether they are selected.

	BOTH roles, not endpoints alone. A bend's hollow ring sits ON the line, so a blue ring around a
	green path reads as a foreign object rather than part of it. The whole path highlights or none
	of it does.

	A separate class from `selected`: these waypoints are not themselves selected -- deleting the
	selection must not delete them, and their own brackets must stay off. This says "the path you
	have selected passes through me".

	Client-only, deliberately. The SVG export never receives a selection (`svg.mjs` calls
	`docToSchema(doc)` with no `opts.selected`), because a downloaded picture should not carry
	somebody's transient highlight.
	*/
	reflectPathSelection() {
		const lit = new Set();
		for (const id of this.selectedSet) {
			const link = this.model.get('link', id);
			if (!link) continue;
			for (const w of [link.src, link.dst, ...(link.via || [])]) {
				if (this.model.get('waypoint', w)) lit.add(w);
			}
		}
		this.pathLit?.forEach((id) => { if (!lit.has(id)) this.setState(id, 'on-selected-path', false); });
		lit.forEach((id) => this.setState(id, 'on-selected-path', true));
		this.pathLit = lit;
	}

	handle(action, kind, entity) {
		if (action === 'load') return this.syncAll();
		if (action === 'put') this.render(kind, entity);
		if (action === 'set') this.update(kind, entity);
		/*
		B218 -- a deleted LINK re-derives the waypoints it touched.

		A waypoint's role is derived from the links at it, and `remove` only dropped the DOM node.
		So deleting a link left its endpoint drawing the pad it last had: the document was right and
		the canvas was a frame behind it. `refreshWaypointsOf` already exists for exactly this and
		was wired to create and update but not to delete.

		AFTER the removal, so the derivation sees a model the link has left. The deleted entity is
		the only record of which waypoints it touched -- they cannot be found from the model once it
		is gone.
		*/
		if (action === 'del') {
			this.remove(entity.id);
			if (kind === 'link') this.refreshWaypointsOf(entity);
		}
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
	// route → path → curve. `pathOf` resolves the anchors (document); `roundedPath` bends it (kernel).
	linkPath(entity) {
		const path = this.model.pathOf(entity);
		return path && roundedPath(path, BEND_R, !!entity.closed);
	}

	/*
	How a link looks: the ONE derivation (H15.9), fed the derived state the link itself does not carry --
	whether it is DOWN, which only the model's router knows (always false in production). Create and
	update both call this, rather than each passing the state to `linkAppearance`: two call sites
	assembling the same arguments is exactly how B228 shipped, one of them forgetting what the other set.
	*/
	linkAppearanceOf(entity) {
		return linkAppearance(entity, LINK_W, { down: this.model.isLinkDown(entity) });
	}

	// group hull = the bbox of member node centres, padded to ±group.ext (the kernel spec).
	// null when no member resolves (avoids ±Infinity), matching the kernel's empty-group guard.
	groupBox(entity) {
		const members = entity.members.map((id) => this.model.endpointOf(id)).filter(Boolean)
			.map((m) => { const { sw, sh } = spanExtent(m.span); return { x: m.x, y: m.y, w: sw, h: sh }; });   // span-aware footprint
		return groupHull(members, L_STD.group.ext);   // one authority shared with the kernel resolve (now footprint-aware)
	}

	render(kind, entity) {
		this.remove(entity.id);             // put is create-or-replace
		if (kind === 'node') {
			const g = el('g', { id: entity.id, class: 'node' }, this.layers.nodes);
			const { sw, sh } = spanExtent(entity.span), sig = spanSig(entity), csig = contentSig(entity);
			if (sig || csig) {   // a panel (content) or multi-cell node → a sized rounded-rect frame (same .frame styling)
				if (sig) g.setAttribute('data-span', sig);
				// a panel's corner FOLLOWS its shape (like a 1×1 node, toggled by 's'): circle → the circle radius
				// (frame.ext=20; a 1×1 panel == the circle, a row → a pill), square → the sharp frame radius (5)
				el('rect', { 'data-layer': 'frame', class: 'frame', x: -FE, y: -FE, width: 2 * FE + sw, height: 2 * FE + sh }, g);
			} else {
				el('use', { 'data-layer': 'frame' }, g);
			}
			if (csig) {   // content node (W2): the content regions, + (W4) the per-cell socket grid only in edit mode
				g.setAttribute('data-content', csig);
				if (showsSockets(this.renderOpts())) {   // one rule; the client says yes by being in edit mode
					const gc = entity.span ? entity.span.cols : 1, gr = entity.span ? entity.span.rows : 1;
					for (let j = 0; j < gr; j++) for (let i = 0; i < gc; i++)
						el('rect', { class: 'socket', x: i * STD.pitch - SOCKET / 2, y: j * STD.pitch - SOCKET / 2, width: SOCKET, height: SOCKET }, g);
				}
				entity.content.forEach((r, i) => contentDom(r, g, i));
			} else {
				// W4: a plain node's socket is an editing aid too, and was the one that never obeyed the
				// mode. A panel's grid appeared on `e` while every node kept its dashed square on in
				// view and run -- the same cue meaning "you may align to this" was permanent on one
				// kind and toggled on the other.
				if (showsSockets(this.renderOpts())) {
					el('rect', { class: 'socket', x: -SOCKET / 2, y: -SOCKET / 2, width: SOCKET, height: SOCKET }, g);
				}
				const fit = el('svg', { x: -SOCKET / 2, y: -SOCKET / 2, width: SOCKET, height: SOCKET, preserveAspectRatio: 'xMidYMid meet' }, g);
				el('use', { 'data-layer': 'glyph' }, fit);
			}
			// a node declaring transit off shows the same ring an anchor does, at its anchor point (TRANSIT.md section 12, X1)
			if (this.model.declaresNoTransit(entity.id)) layerCircle(waypointLayers([], FE, null, { transit: false }).find((l) => l.cls === 'wp-transit'), g);
			el('path', { class: 'select-box', d: sig ? selBox(L_STD, sw, sh) : SELECT_BOX }, g);
			if (!csig) {   // a content node (text box / panel) is self-labelled by its content — no name sub-title
				el('rect', { class: 'label-pill', rx: 4, y: NODE_LABEL_Y - 13 + sh, height: STD.labelH }, g);
				el('text', { class: 'label', y: NODE_LABEL_Y + sh, 'font-size': STD.fontSize }, g);
			}
			applyLook(g, nodeLook(entity), NODE_PARTS);   // H15.9: what can change, from the one derivation update uses too
		}
		if (kind === 'link') {
			const d = this.linkPath(entity);
			if (!d) return;
			// H15.9 -- ONE derivation, emitted as given. The marker, the weight and the dash were
			// three calls assembled by hand here and again in `update`, which is how B228 shipped.
			el('path', { id: entity.id, class: 'link', fill: 'none', d, ...this.linkAppearanceOf(entity) }, this.layers.links);
			el('path', { class: 'link-hit', 'data-link': entity.id, ...hitOf(d, this.linkAppearanceOf(entity)) }, this.layers.links);   // its click area (B268)
			this.refreshWaypointsOf(entity);
		}
		if (kind === 'zone') {
			const g = el('g', { id: entity.id, class: 'zone' }, this.layers.zones);
			el('rect', { class: 'zone-rect', rx: ZONE_R }, g);
			el('rect', { class: 'label-pill', rx: 4, height: STD.labelH }, g);
			el('text', { class: 'label zone-label', 'font-size': STD.fontSize }, g);
			applyLook(g, zoneLook(entity), ZONE_PARTS);
		}
		if (kind === 'group') {
			const b = this.groupBox(entity);
			if (!b) return;                 // no resolvable members → no hull
			const g = el('g', { id: entity.id, class: 'group' }, this.layers.groups);
			el('rect', { class: 'group-hull', rx: L_STD.group.r, fill: 'none', stroke: TOKENS.group, 'stroke-width': 1.1 }, g);
			applyLook(g, groupLook(b), GROUP_PARTS);
		}
		if (kind === 'waypoint') {
			/*
			The role comes from the KERNEL's rule, not from a second copy of it here.

			The live editor and the SVG export are deliberately separate renderers (B28): one keeps
			addressable DOM for a person editing, the other produces a finished document. What must
			NOT differ is the rule for what a waypoint IS -- and it did, because the role landed in
			`resolve()`, which only the export walks. The canvas kept drawing every waypoint as a
			bend while the download drew endpoints correctly, so checking the export said it worked.

			`linksAt` is the engine's maintained incidence index, so this is O(1) and re-derives on
			every render -- closing a path with `c` changes the drawing with nothing stored.
			*/
			// B166 -- model links go straight to the kernel. This used to map src/dst/closed into
			// from/to/close inline, and the situation needed the same mapping, which is what turned
			// a four-word detail into a twin. Unifying the vocabulary removed both copies.
			const roles = waypointRoles(entity.id, this.model.linksAt?.(entity.id) || []);
			// the numbers are the kernel's, shared with the SVG export; this only emits them
			/*
			B209 -- walk the kernel's layer list. Which sub-type draws what lives in
			`waypointLayers`, so the canvas and the SVG export cannot disagree and a new sub-type is
			one change rather than two.
			*/
			const armed = entity.spawn ? ' spawning' : '';
			const cls = roles.length ? roles.join(' ') : 'bend';
			const g = el('g', { id: entity.id, class: `waypoint ${cls}${armed}` }, this.layers.waypoints);
			applyLook(g, waypointLook(entity));
			// the anchor as drawn: whether it declares transit off comes from the network (the Model's `declaresNoTransit`),
			// since the lab holds that choice in its session until promotion stores it (TRANSIT.md section 12, TR-7)
			const anchor = { transit: this.model.declaresNoTransit(entity.id) ? false : undefined };
			for (const l of waypointLayers(roles, FE, this.model.linksAt?.(entity.id) || [], anchor)) layerCircle(l, g);
			el('path', { class: 'select-box', d: SELECT_BOX }, g);   // brackets when selected (like a node)
		}
		// fresh DOM loses the 'selected' class — re-apply it if this entity is selected (undo/redo/load)
		if (this.selectedSet.has(entity.id)) this.setState(entity.id, 'selected', true);
		// and the same for a waypoint lit by a selected path -- render() replaces the DOM, so a
		// re-render during a live selection would drop the highlight without this
		if (this.pathLit?.has(entity.id)) this.setState(entity.id, 'on-selected-path', true);
	}

	/*
	A link change can change what its WAYPOINTS are.

	A waypoint's role is derived from the links touching it, so creating, re-routing or closing a
	link makes its terminals and bends draw differently. Only the link's own path was being updated,
	so a waypoint kept whatever ring it was first drawn with.

	Invisible on a fresh load, because every link already exists and the initial render is correct.
	It only showed while AUTHORING -- place a waypoint, link to it, and nothing redrew it. Called from render,
	update AND delete. A NEW link is what turns a lone waypoint into an endpoint, and fixing only
	the update path left that case broken; B218 was the mirror -- a DELETED link leaves its endpoint
	drawing a pad for a link that is gone.

	Re-rendered rather than patched: the role decides fill, radius, stroke width and class together,
	and setting those four from here would be a second copy of the drawing.
	*/
	/*
	Redraw the links drawn THROUGH an anchor that does not appear in them -- a routed link passing it.

	The branches above redraw the links the incidence index names (ends and pins). Under a plugged-in
	network a link can also run through an anchor it does not name, and moving that anchor must
	redraw it too, or the pipes follow the anchor and the link stays behind -- the director's report. The
	model answers from the same authority that draws the path (the network's `linksRoutedThrough`, beside `pathOf`).
	In production it answers nothing, so nothing extra is redrawn.
	*/
	refreshRoutedThrough(anchorId) {
		for (const link of this.model.linksRoutedThrough?.(anchorId) ?? []) this.update('link', link);
	}

	refreshWaypointsOf(link) {
		for (const id of [link.src, link.dst, ...(link.via || [])]) {
			const w = this.model.get('waypoint', id);
			if (w) this.render('waypoint', w);
		}
	}

	update(kind, entity) {
		const dom = this.elementOf(entity.id);
		if (!dom) return this.render(kind, entity);
		if (kind === 'node') {
			// a footprint OR content change (resize, 1×1↔span, content set) → re-render (always correct); a
			// pure move keeps the fast path (frame/content/selBox are all local to the translate → only transform).
			const sig = spanSig(entity), csig = contentSig(entity);
			if ((dom.getAttribute('data-span') || null) !== sig || (dom.getAttribute('data-content') || null) !== csig) return this.render('node', entity);
			// H15.9: the move, the glyph and its fit box, the frame's def or corner, the label and its pill -- the one look
			applyLook(dom, nodeLook(entity), NODE_PARTS);
			this.model.linksOf(entity.id).forEach((link) => this.update('link', link));
			this.refreshRoutedThrough(entity.id);
			const grp = this.model.groupOf(entity.id);
			if (grp) this.update('group', grp);   // the hull hugs its members → follow the move
		}
		if (kind === 'link') {
			const d = this.linkPath(entity);
			if (d) setAttrs(dom, { d });
			/*
			B228 -- THE MARKER IS PART OF THE LINK, so an update must re-derive it.

			`render` set it and `update` set only `d`, so the first press of `f` drew an arrow and
			every press afterwards changed the document and nothing else: the element already
			existed, so it never went back through `render`.

			Set-or-remove rather than set-if-present. Clearing a declaration has to REMOVE the
			attribute, and an update that only ever adds would strand the last head on a link the
			author has since made symmetric.

			B218 was this shape one branch over -- create and update refreshed a waypoint's role and
			delete did not. A rule wired into one branch of `handle` is wired into none of the others.
			*/
			/*
			H15.9 -- the SAME derivation create uses, applied as set-or-remove over the declared
			key set. B228 was an update that set some of these and forgot others; there is now no
			list to forget, because `APPEARANCE_KEYS` is what the derivation itself declares.
			*/
			const want = this.linkAppearanceOf(entity);
			for (const attr of APPEARANCE_KEYS) {
				if (attr in want) dom.setAttribute(attr, want[attr]);
				else dom.removeAttribute(attr);
			}
			const twin = this.hitTwinOf(entity.id);
			if (twin) setAttrs(twin, hitOf(dom.getAttribute('d'), want));
			this.refreshWaypointsOf(entity);
		}
		if (kind === 'zone') {
			applyLook(dom, zoneLook(entity), ZONE_PARTS);   // H15.9: the label offset is the spec's here as in create
		}
		if (kind === 'group') {
			const b = this.groupBox(entity);
			if (!b) return this.remove(entity.id);                 // shrank below a member → drop the hull
			if (dom.querySelector('.group-hull')) applyLook(dom, groupLook(b), GROUP_PARTS);
			else this.render('group', entity);
		}
		if (kind === 'waypoint') {
			applyLook(dom, waypointLook(entity));
			this.model.linksAt(entity.id).forEach((l) => this.update('link', l));   // endpoint + via links
			this.refreshRoutedThrough(entity.id);
			const grp = this.model.groupOf(entity.id);
			if (grp) this.update('group', grp);                                      // reflow a group it belongs to
		}
	}

	remove(id) {
		const dom = this.elementOf(id);
		if (dom) dom.remove();
		this.hitTwinOf(id)?.remove();   // a link's click area goes with it (B268)
	}

	// a link's invisible hit twin, found by the link it stands for (B268)
	hitTwinOf(id) {
		return [...this.layers.links.querySelectorAll('.link-hit')].find((t) => t.getAttribute('data-link') === id) ?? null;
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
