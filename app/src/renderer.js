/*
Renderer — reconciles model state into the SVG layers the plugins draw into (painters, then appearances), incrementally.
Same DOM shape + state-class interface the legacy renderer exposed (so input/selection/CSS port
unchanged), but every geometry NUMBER and glyph def comes from the KERNEL — no hardcoded sizes.
Draws nodes at their EXACT entity px (so live drag stays smooth); the committed positions are
always on-grid. The kernel's resolve()/renderScene() remain the headless/export authority.
*/

import { isLinkDown, blockersOf } from '../../network/network-queries.mjs';   // the network's questions over a Model (Q-a)
import { el, setAttrs } from './painter.js';
import { L_STD } from '../../kernel/spec.mjs';
import { selBox } from '../../kernel/renderer.mjs';
import { BARE_KIND } from '../../model/anchors.mjs';
import { kindOf } from '../../model/model.mjs';
import { bareAnchor } from '../../devices/device-shapes.mjs';
import { byDrawingOrder } from '../../model/stacking.mjs';   // the stacking (F-d)   // the bare anchor, asked in one place (F-b)

const SELECT_BOX = selBox(L_STD);      // the kernel's selection brackets (±23)




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

/*
C-a (H19.29; CANVAS-PLUGINS.md, D1) -- A CANVAS PART, a plugin's contribution to the page: `{ owner, painters }`. A painter is
`{ kind, layer, stacked, create(entity, kit) -> element, update(entity, element, kit) -> 'rerender' | undefined }` -- the
kind it draws, the id of the layer it draws into, whether that layer is stacked by drawing order (F-d), and how it builds and
refreshes its kind's elements through the kit the renderer hands it, since a plugin imports no canvas code. Checked when the
canvas is built: a painter missing a part, a layer the page lacks, or a kind painted twice is refused, naming the owner.
*/
const PAINTER_PARTS = ['create', 'update'];
/*
D3 (C-a, step three) -- A PART MAY ALSO BRING APPEARANCES for a kind several plugins draw on, and ORDERS for such a kind: the
named layers its parts land in, back to front, and the competing appearances' ranks, highest first. An appearance is
`{ id, kind, state(entity, kit) -> derived state | null, composes, root?, rootAttrs?, addClass?, parts?, structure?, look?,
selectBox?, redraws? }`: when its state is not null it applies, and either composes -- drawn alongside the others -- or competes,
the highest-ranked alone drawn, its root the element (`root: { layer, class }`). Checked when the canvas is built.
*/
const SESSION_LAYER = 'select';   // the canvas's own layer in an order: the selection brackets, session state, no pack (2026-09-22)
function composeParts(parts, svg) {
	const painters = new Map(), appearances = new Map(), orders = new Map(), byId = new Map();
	for (const part of parts) {
		if (!part || typeof part.owner !== 'string') throw new Error('Renderer: a canvas part is { owner, painters, appearances, orders }');
		for (const [kind, order] of Object.entries(part.orders ?? {})) {
			if (orders.has(kind)) throw new Error(`Renderer: the order for ${kind} is declared by ${orders.get(kind).owner} and by ${part.owner}`);
			orders.set(kind, { ...order, owner: part.owner });
		}
	}
	for (const part of parts) {
		for (const a of part.appearances ?? []) {
			if (byId.has(a.id)) throw new Error(`Renderer: appearance ${a.id} is brought by ${byId.get(a.id)} and by ${part.owner}`);
			byId.set(a.id, part.owner);
			const order = orders.get(a.kind);
			if (!order) throw new Error(`Renderer: ${part.owner}'s appearance ${a.id} is for ${a.kind}, for which no part orders appearances`);
			if (typeof a.state !== 'function') throw new Error(`Renderer: ${part.owner}'s appearance ${a.id} has no state`);
			const stray = Object.keys(a.parts ?? {}).filter((l) => !order.layers.includes(l) || l === SESSION_LAYER);
			if (stray.length) throw new Error(`Renderer: ${part.owner}'s appearance ${a.id} draws into layer ${stray.join(', ')}, which the order for ${a.kind} does not list`);
			if (!a.composes) {
				if (!a.root || typeof a.root.class !== 'function') throw new Error(`Renderer: ${part.owner}'s appearance ${a.id} competes and names no root`);
				if (!order.ranks.includes(a.id)) throw new Error(`Renderer: ${part.owner}'s appearance ${a.id} competes and the order for ${a.kind} does not rank it`);
				const layer = svg.querySelector(`#${a.root.layer}`);
				if (!layer) throw new Error(`Renderer: ${part.owner}'s appearance ${a.id} draws into #${a.root.layer}, which the page does not have`);
			}
			if (!appearances.has(a.kind)) appearances.set(a.kind, []);
			appearances.get(a.kind).push({ ...a, owner: part.owner, layerEl: a.composes ? null : svg.querySelector(`#${a.root.layer}`) });
		}
	}
	return { painters: composePainters(parts, svg), appearances, orders };
}
function composePainters(parts, svg) {
	const painters = new Map();
	for (const part of parts) {
		for (const p of part.painters ?? []) {
			const missing = PAINTER_PARTS.filter((k) => typeof p?.[k] !== 'function');
			if (missing.length) throw new Error(`Renderer: ${part.owner}'s painter for ${p?.kind} has no ${missing.join(', ')}`);
			const layer = svg.querySelector(`#${p.layer}`);
			if (!layer) throw new Error(`Renderer: ${part.owner}'s painter for ${p.kind} draws into #${p.layer}, which the page does not have`);
			if (painters.has(p.kind)) throw new Error(`Renderer: ${p.kind} is painted by ${painters.get(p.kind).owner} and by ${part.owner}`);
			painters.set(p.kind, { ...p, owner: part.owner, layerEl: layer });
		}
	}
	return painters;
}

export class Renderer {
	constructor(model, svg, { parts = [] } = {}) {
		// C-a: the kinds a plugin paints, and those several plugins draw by appearances (D3), from the page's canvas parts
		({ painters: this.painters, appearances: this.appearances, orders: this.orders } = composeParts(parts, svg));
		this.drawnSig = new Map();     // id -> the composition it was drawn by (D3), so an update knows when to render afresh
		this.drawnLayer = new Map();   // id -> the page layer its winning appearance drew it into
		this.stackedAt = new Map();   // id -> the drawing order it was stacked by (F-d)
		this.model = model;
		this.svg = svg;
		// declared back→front to mirror the DOM layer order (region decorations behind the graph): groups → links → waypoints →
		// nodes -- and behind them, each painter's own layer (C-a: the zones plugin's, the groups plugin's)
		// C-a: every layer an entity is drawn into is a painter's or an appearance's; the renderer keeps none of its own
		this.layers = {};
		this.selectedSet = new Set();   // the renderer OWNS the 'selected' visual state (Selection is renderer-free)
		this.labels = true;             // node and zone names, Tab-toggled; visible by default
		this.modeWatchers = [];         // who hears a mode change (watchMode)
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
		const node = this.svg.querySelector('#nodes').querySelector(`[id="${id}"]`);   // the devices plugin's layer
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
		// B315: every layer an entity may be drawn into -- the renderer's own, its painters', its appearances' roots
		const roots = [...this.painters.values()].map((p) => p.layerEl);
		for (const list of this.appearances.values()) for (const a of list) if (a.layerEl) roots.push(a.layerEl);
		for (const layer of new Set([...Object.values(this.layers), ...roots])) {
			const hit = layer?.querySelector?.(`[id="${id}"]`);
			if (hit?.getAttribute?.('id') === id) return hit;   // the entity's own element -- never a stand-in a layer offers
		}
		return null;
	}

	setMode(mode) {
		this.mode = mode;
		this.svg.classList.toggle('edit-mode', mode === 'edit');
		this.svg.classList.toggle('run-mode', mode === 'run');
		// every node, not only the panels. Gating a plain node's socket on the mode is pointless if
		// switching mode never re-renders it -- the change would appear on the next unrelated edit.
		// R-c (H18.21): and every waypoint, since run mode draws the run picture's layers rather than hiding the rest by stylesheet
		// -- every entity of a kind drawn by appearances, whose parts may read the mode (D3)
		for (const kind of this.appearances.keys()) if (this.model.kinds.has(kind)) this.model.all(kind).forEach((e) => this.render(kind, e));
		// H12.8 -- the composition root starts or stops the movers, and the network's painter draws the run picture's pipes,
		// without the renderer knowing either exists. The renderer draws the document; movers and pipes are not its own.
		for (const fn of this.modeWatchers) fn(this.mode);
		return this.mode;
	}

	// hear every mode change -- `fn(mode)` (R-c: the movers and the network's painter both do)
	watchMode(fn) { this.modeWatchers.push(fn); }

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
			if (link && isLinkDown(this.model, link)) for (const by of blockersOf(this.model, link)) blocking.add(by);
		}
		for (const path of this.svg.querySelector('#links').querySelectorAll('path.link')) path.classList.toggle('blocking', blocking.has(path.id));   // C-e moves this reflection to the network
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
				if (bareAnchor(this.model, w)) lit.add(w);
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
			this.redrawAfter(kind, entity);   // from the DELETED entity -- the model no longer knows what it touched (B218)
		}
	}

	syncAll() {
		// a full re-render wipes all DOM → nothing is reflected as 'selected' anymore, so reset the
		// renderer's selection mirror here (don't trust it across a document swap). Selection's 'load'
		// observer re-reflects the survivors immediately after (it subscribes onChange after us); the
		// selection reconcile itself is owned by Model.load.
		this.selectedSet.clear();
		Object.values(this.layers).forEach((layer) => { layer.innerHTML = ''; });
		for (const p of this.painters.values()) p.layerEl.innerHTML = '';
		for (const list of this.appearances.values()) for (const a of list) if (a.layerEl) a.layerEl.innerHTML = '';
		// each stacked kind in its drawing order, so every item lands on top of the ones before it (F-d)
		const inOrder = (list) => [...list].sort(byDrawingOrder);
		// C-a: the painted kinds first, in the order the canvas parts were composed -- the back of the page (the zones plugin's)
		for (const p of this.painters.values()) {
			if (!this.model.kinds.has(p.kind)) continue;
			const all = this.model.all(p.kind);
			(p.stacked ? inOrder(all) : all).forEach((e) => this.render(p.kind, e));
		}
		// D3: the kinds drawn by appearances, each in its drawing order -- every item lands in its winner's layer
		for (const kind of this.appearances.keys()) if (this.model.kinds.has(kind)) inOrder(this.model.all(kind)).forEach((e) => this.render(kind, e));
	}


	/*
	F-d (H18.6; B249, B10) -- DRAWN IN ITS PLACE, not on top. Each drawn kind's layer is stacked by the stored drawing order
	(model/order.mjs): newest on top for every peer, and an item put back -- by undo, by another writer's answer, by a
	re-render -- returns to its place rather than to the top, which is what B10 was. Drawn, then moved among its layer's
	items to the first place an older one precedes it; the newest, the common case, stops at the first look.
	*/
	render(kind, entity) {
		this.draw(kind, entity);
		this.place(kind, entity);
	}

	// the layer a drawn kind is stacked in, or null for one that is not stacked (a group's hull)
	stackOf(kind, entity) {
		const painter = this.painters.get(kind);
		if (painter) return painter.stacked ? painter.layerEl : null;   // C-a: a painted kind's own layer
		if (this.appearances.has(kind)) return this.drawnLayer.get(entity.id) ?? null;   // D3: the layer its winner drew it into
		return null;
	}

	place(kind, entity) {
		const layer = this.stackOf(kind, entity);
		if (!layer) return;
		this.stackedAt.set(entity.id, entity.order);   // what it was placed by, so a later change of order restacks it
		const painter = this.painters.get(kind);
		const own = [this.elementOf(entity.id), ...(painter?.companions?.(entity.id, layer) ?? [])].filter((e) => e && e.parentNode === layer);
		if (!own.length) return;
		const ownerOf = (c) => c.getAttribute('id') || painter?.ownerOf?.(c);   // a companion names its entity -- a link's click twin (B268)
		let ref = null;
		for (let i = layer.children.length - 1; i >= 0; i--) {
			const c = layer.children[i];
			const id = ownerOf(c);
			if (id === entity.id) continue;
			const other = id && this.model.get(kind, id);
			if (!other) continue;
			if (byDrawingOrder(other, entity) > 0) ref = c; else break;   // drawn after it, so it goes beneath
		}
		for (const e of own) layer.insertBefore(e, ref);
	}

	draw(kind, entity) {
		this.remove(entity.id);             // put is create-or-replace
		// C-a: a kind a plugin paints, its painter draws
		const painter = this.painters.get(kind);
		if (painter) { painter.create(entity, this.kit(painter)); this.reapplyStates(entity.id); this.redrawAfter(kind, entity); return; }   // B314: its session states too
		// D3: a kind several plugins draw on, composed from their appearances
		if (this.appearances.has(kind)) { this.drawComposed(kind, entity); this.reapplyStates(entity.id); return; }
		this.reapplyStates(entity.id);
	}


	update(kind, entity) {
		const dom = this.elementOf(entity.id);
		if (!dom) return this.render(kind, entity);
		// its drawing order changed -- the planner's order for a creation that came without one arrives as a set (F-d)
		if (this.stackedAt.get(entity.id) !== entity.order) this.place(kind, entity);
		// C-a: a kind a plugin paints, its painter refreshes -- or asks for a fresh render when its structure changed
		const painter = this.painters.get(kind);
		if (painter) {
			const asked = painter.update(entity, dom, this.kit(painter));
			if (asked === 'rerender') return this.render(kind, entity);
			if (asked === 'remove') this.remove(entity.id);
			this.redrawAfter(kind, entity);
			return;
		}
		// D3: a kind drawn by appearances -- a fresh render when its composition or structure changed, otherwise the looks; then
		// what its appearances name to redraw, and whatever gathers it
		if (this.appearances.has(kind)) {
			const c = this.compose(kind, entity);
			if (!c) this.remove(entity.id);
			else if (this.sigOf(c, entity) !== this.drawnSig.get(entity.id)) this.render(kind, entity);
			else for (const x of [c.winner, ...c.composers]) this.applyLookOf(x.a, entity, dom);
			for (const a of this.appearances.get(kind)) for (const [k, e] of a.redraws?.(entity, this.kit()) ?? []) this.update(k, e);
			this.refreshGatherer(entity.id);   // a hull hugs its members, follow the move
			return;
		}
	}

	// fresh DOM loses the session states: re-apply 'selected' if this entity is selected (undo/redo/load), and the highlight of
	// one lit by a selected path, since render() replaces the DOM -- for every drawn kind, a painted one too (B314)
	reapplyStates(id) {
		if (this.selectedSet.has(id)) this.setState(id, 'selected', true);
		if (this.pathLit?.has(id)) this.setState(id, 'on-selected-path', true);
	}

	// C-a: what a painter or an appearance is handed -- the canvas's element builder and look applier, the label pill's width, its
	// layer, the model, and the session the drawing may read (the mode, and the render options it implies)
	kit(painter = null) {
		return { el, setAttrs, applyLook, pillWidth, layer: painter?.layerEl ?? null, model: this.model, mode: this.mode, renderOpts: () => this.renderOpts() };
	}

	/*
	D3 -- THE COMPOSITION of a kind's appearances for one entity (the 2026-09-22 ruling): those whose state applies; of the
	competing ones, the highest-ranked alone (the order's `ranks`); every composing one with it. Null when nothing competes.
	*/
	compose(kind, entity) {
		const kit = this.kit(), ranks = this.orders.get(kind).ranks;
		const applying = this.appearances.get(kind).map((a) => ({ a, state: a.state(entity, kit) })).filter((x) => x.state != null);
		const composes = (x) => (typeof x.a.composes === 'function' ? x.a.composes(x.state) : !!x.a.composes);
		const winner = applying.filter((x) => !composes(x)).sort((p, q) => ranks.indexOf(p.a.id) - ranks.indexOf(q.a.id))[0];
		return winner ? { winner, composers: applying.filter(composes) } : null;
	}

	// what an entity was drawn by: its winner and state, the composers and theirs, and the winner's structure
	sigOf(c, entity) {
		return `${c.winner.a.id}:${c.winner.state}|${c.composers.map((x) => `${x.a.id}:${x.state}`).join(',')}|${c.winner.a.structure?.(entity) ?? ''}`;
	}

	applyLookOf(a, entity, dom) {
		if (!a.look) return;
		const [look, finders] = a.look(entity, this.kit());
		applyLook(dom, look, finders);
	}

	// D3: the root its winner names, in its layer, with the composers' classes; each named layer of the order in turn, the
	// winner's part then the composers'; the canvas's selection brackets in its own; then the looks
	drawComposed(kind, entity) {
		const c = this.compose(kind, entity);
		this.drawnSig.delete(entity.id); this.drawnLayer.delete(entity.id);
		if (!c) return;
		const kit = this.kit(), drawers = [c.winner, ...c.composers], w = c.winner;
		const cls = [w.a.root.class(entity, kit, w.state), ...c.composers.map((x) => x.a.addClass).filter(Boolean)].join(' ');
		const g = el('g', { id: entity.id, class: cls }, w.a.layerEl);
		for (const [k, v] of w.a.rootAttrs?.(entity) ?? []) g.setAttribute(k, v);
		for (const layer of this.orders.get(kind).layers) {
			if (layer === SESSION_LAYER) { el('path', { class: 'select-box', d: w.a.selectBox?.(entity) ?? SELECT_BOX }, g); continue; }
			for (const x of drawers) x.a.parts?.[layer]?.(entity, g, kit, x.state);
		}
		for (const x of drawers) this.applyLookOf(x.a, entity, g);
		this.drawnSig.set(entity.id, this.sigOf(c, entity));
		this.drawnLayer.set(entity.id, w.a.layerEl);
	}

	// C-a: what a painter names to draw afresh once its entity is created, changed or deleted -- a link's waypoints, whose roles it
	// changes (B218); called from all three, so no branch forgets
	redrawAfter(kind, entity) {
		const painter = this.painters.get(kind);
		for (const [k, e] of painter?.redraws?.(entity, this.kit(painter)) ?? []) this.render(k, e);
	}

	// C-a: the entity gathering this one -- a group its member -- redrawn when the member moves, asked of the core (`gathers`,
	// model/shape.mjs) so the renderer names no group
	refreshGatherer(id) {
		const gatherer = this.model.gathererOf(id);
		if (gatherer) this.update(kindOf(gatherer.id), gatherer);
	}

	remove(id) {
		const dom = this.elementOf(id);
		if (dom) dom.remove();
		for (const p of this.painters.values()) p.companions?.(id, p.layerEl).forEach((c) => c.remove());   // a link's click twin goes with it (B268)
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
