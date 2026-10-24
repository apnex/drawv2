/*
Renderer -- reconciles model state into the SVG layers the plugins draw into (painters, then appearances), incrementally.
Same DOM shape + state-class interface the legacy renderer exposed (so input/selection/CSS port
unchanged), but every geometry NUMBER and glyph def comes from the KERNEL -- no hardcoded sizes.
Draws nodes at their EXACT entity px (so live drag stays smooth); the committed positions are
always on-grid; server/svg.mjs drives this same Renderer, over a scene with no root, for the SVG export (H2, H25.5, H26.4).

H26.4 (dev/design/components/VECTOR-SCENE.md section 5.1, D8, D9) -- THE SCENE IS vector-scene's. This part alone imports it, and
`openCanvasScene` opens draw's from the composition's declaration (product/canvas.mjs CANVAS_SCENE), on the page's root or on none for
the export; the canvas and the export use the scene it opens, a value. The painters, the appearances, the reveal and the towers are
translated through the live shadow (app/src/shadow.js): each entity is drawn into a fragment of shadow nodes, every change to one
marks its entity, and each top-level node is an item of the scene -- keyed by the entity's id for its own element, by the id and a
serial for a companion -- put at the end of the renderer's call, or at once for a change made outside one. Draw's drawing order,
composition, reflections and states stay here, unchanged. H26.8 retires the shadow, when each painter describes its item directly.
*/

import { openScene } from '@apnex/vector-scene';
import { shadowKit, describe } from './shadow.js';
import { L_STD } from '../../kernel/spec.mjs';
import { selBox } from '../../kernel/renderer.mjs';
import { kindOf } from '../../model/model.mjs';
import { byDrawingOrder } from '../../model/stacking.mjs';   // the stacking (F-d)   // the bare anchor, asked in one place (F-b)

const SELECT_BOX = selBox(L_STD);      // the kernel's selection brackets (+/-23)




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

/*
H26.4 (VECTOR-SCENE.md section 5.1, D9) -- DRAW'S SCENE, opened from the composition's declaration: on the page's root, whose layers it
appends after the ground, or on none, for the export. Opened or refused loudly, naming each problem, as kernel/input-rules.mjs opens a
gesture session.
*/
export function openCanvasScene(declaration, root = null) {
	const opened = openScene(root ? { ...declaration, root } : declaration);
	if (opened.ok) return opened.scene;
	throw new Error(`the canvas's scene refused its declaration: ${opened.problems.map((p) => `${p.pointer || '/'} ${p.problem}`).join(', ')}`);
}

// H26.4: a layer an entity may be drawn into -- one of the scene's own, never a foreign one, which its drawer writes itself
const drawsInto = (scene, name) => scene.layers.some((l) => l.name === name && !l.foreign);

function composeParts(parts, scene) {
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
			if (a.composes !== true) {
				if (!a.root || typeof a.root.class !== 'function') throw new Error(`Renderer: ${part.owner}'s appearance ${a.id} competes and names no root`);
				if (!order.ranks.includes(a.id)) throw new Error(`Renderer: ${part.owner}'s appearance ${a.id} competes and the order for ${a.kind} does not rank it`);
				if (!drawsInto(scene, a.root.layer)) throw new Error(`Renderer: ${part.owner}'s appearance ${a.id} draws into #${a.root.layer}, which the page does not have`);
			}
			if (!appearances.has(a.kind)) appearances.set(a.kind, []);
			appearances.get(a.kind).push({ ...a, owner: part.owner, layer: a.composes === true ? null : a.root.layer });   // H26.4: the scene's layer, by name
		}
	}
	const sizes = new Map();
	for (const part of parts) for (const [k, fn] of Object.entries(part.sizes ?? {})) if (typeof fn === 'function') sizes.set(k, fn);
	// H24.6: what a part says the outline of an item it draws is -- the devices plugin a device's -- for a link's head to touch
	const outlines = new Map();
	for (const part of parts) for (const [k, fn] of Object.entries(part.outlines ?? {})) if (typeof fn === 'function') outlines.set(k, fn);
	return { painters: composePainters(parts, scene), appearances, orders, sizes, outlines };
}
function composePainters(parts, scene) {
	const painters = new Map();
	for (const part of parts) {
		for (const p of part.painters ?? []) {
			const missing = PAINTER_PARTS.filter((k) => typeof p?.[k] !== 'function');
			if (missing.length) throw new Error(`Renderer: ${part.owner}'s painter for ${p?.kind} has no ${missing.join(', ')}`);
			if (!drawsInto(scene, p.layer)) throw new Error(`Renderer: ${part.owner}'s painter for ${p.kind} draws into #${p.layer}, which the page does not have`);
			if (painters.has(p.kind)) throw new Error(`Renderer: ${p.kind} is painted by ${painters.get(p.kind).owner} and by ${part.owner}`);
			painters.set(p.kind, { ...p, owner: part.owner });   // H26.4: its layer, the scene's, by name
		}
	}
	return painters;
}

export class Renderer {
	/*
	H26.4: `svg` is the page's root, whose classes the renderer still writes -- modes and labels, draw's own -- or none, for the export;
	`scene` is the one `openCanvasScene` opened; `platform` the page's measure and settle (`{ lengthOf, settle }`, app/src/painter.js),
	which the export and the harness do not hand, so the reveal's trace runs where it ran, on the page alone (D12). `foreign`, where the
	composition hands it (app/src/compose-canvas.js `foreignStates`), marks the states of an id this did not draw -- a pipe's line, which the
	network draws in its own layer under the pipe's id so the canvas's selection reaches it -- as today's renderer marked whatever element the
	page's getElementById found (F1).
	*/
	constructor(model, svg, { parts = [], scene = null, platform = {}, foreign = null } = {}) {
		if (!scene) throw new Error('Renderer: no scene to draw into -- the canvas opens one (openCanvasScene)');
		this.scene = scene;
		this.foreign = foreign;
		// C-a: the kinds a plugin paints, and those several plugins draw by appearances (D3), from the page's canvas parts
		({ painters: this.painters, appearances: this.appearances, orders: this.orders, sizes: this.sizes, outlines: this.outlines } = composeParts(parts, scene));
		/*
		H26.4 (section 5.1): what the renderer has drawn, by entity -- its layer, its fragment of shadow nodes, the scene's key for each of
		its top-level nodes, and whether it is still drawn -- the entity each key belongs to, the entities whose nodes changed since they
		were last put, and how deep in its own calls the renderer is: at the outermost call's end, or at once outside one, they are put.
		*/
		this.drawn = new Map();
		this.keyOwners = new Map();
		this.dirty = new Set();
		this.depth = 0;
		this.serial = 0;
		this.shadow = shadowKit({ platform,
			onDirty: (rec) => { this.dirty.add(rec); if (this.depth === 0) this.flush(); },
			onSettle: () => this.flush() });   // D12: the trace's forced layout -- its entity put at once, then the page's style settled
		this.el = (tag, attrs = {}, parent = null) => this.shadow.make(tag, attrs, parent);
		this.setAttrs = (node, attrs) => { for (const k in attrs) node.setAttribute(k, attrs[k]); return node; };
		this.drawnSig = new Map();     // id -> the composition it was drawn by (D3), so an update knows when to render afresh
		this.drawnLayer = new Map();   // id -> the page layer its winning appearance drew it into
		this.stackedAt = new Map();   // id -> the drawing order it was stacked by (F-d)
		this.model = model;
		this.svg = svg;
		// C-a: every layer an entity is drawn into is a painter's or an appearance's; the renderer keeps none of its own -- H26.4: each
		// a layer of the scene, named
		this.selectedSet = new Set();   // the renderer OWNS the 'selected' visual state (Selection is renderer-free)
		// C-e: what a selection lights beyond itself, each part's -- a class, and the ids it marks (the network's: a selected link's
		// waypoints, a down link's blockers) -- and the ids each class marks now
		this.reflects = parts.flatMap((p) => (p.reflects ?? []).map((r) => {
			if (typeof r.cls !== 'string' || typeof r.of !== 'function') throw new Error(`Renderer: ${p.owner}'s selection reflection names no class or no marks`);
			return { ...r, owner: p.owner };
		}));
		this.marked = new Map();
		this.labels = true;             // node and zone names, Tab-toggled; visible by default
		this.modeWatchers = [];         // who hears a mode change (watchMode)
		this.mode = 'view';             // W4/W5 -- view | edit | run (client/session, ephemeral). edit shows the
		model.onChange((action, kind, entity) => this.handle(action, kind, entity));   // socket grid; run makes clickable regions act
	}

	// W4/W5 -- set the interaction mode. edit shows editing aids (the per-cell socket grid on content panels);
	// run makes clickable content regions act (CSS-gated via the 'run-mode' class); view is clean + normal
	// editing gestures. Session/view state (ephemeral -- not persisted). Re-renders content panels.
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
		this.svg?.classList.toggle('labels-off', !this.labels);
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
		const node = this.drawn.get(id)?.layer === 'nodes' ? this.elementOf(id) : null;   // the devices plugin's layer; H26.4: its shadow node
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
		// B315: the entity's own element in whichever layer it is drawn into, never a stand-in a layer offers -- H26.4: its shadow node
		return this.elementOf(id);
	}

	setMode(mode) {
		this.mode = mode;
		this.svg?.classList.toggle('edit-mode', mode === 'edit');
		this.svg?.classList.toggle('run-mode', mode === 'run');
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

	// reflect the current selection onto entity DOM -- the SINGLE owner of the 'selected' class.
	// Diffs against the last reflection so only the delta toggles; the set also lets render() re-apply
	// 'selected' when an entity gets fresh DOM (undo/redo/load re-render). Selection just calls this
	// (via subscribe) -- it holds no renderer.
	/*
	H26.4 (section 5.1): A RENDERER CALL'S CHANGES PUT ONCE, AT ITS END -- the outermost call's, so a render inside a handle puts with
	it -- and a change outside one at once. Nothing runs between a painter's write and the end of the call, no event and no frame, so
	nothing can see the difference (section 6.2).
	*/
	batch(fn) {
		this.depth++;
		try { return fn(); } finally { if (--this.depth === 0) this.flush(); }
	}

	// the entities whose nodes changed, put -- all of them, or those of one layer but one entity (`place`)
	flush(except = null, layer = null) {
		for (const rec of [...this.dirty]) {
			if (rec === except || (layer !== null && rec.layer !== layer)) continue;
			this.dirty.delete(rec);
			this.putOf(rec);
		}
	}

	/*
	An entity's top-level nodes brought to its items: each node gone, its item removed; each kept, put again -- the scene writes only
	what its description differs by, and moves it when `before` is given; each new, put before the item of the next node the entity
	keeps, or last in the layer, as the platform appends -- or before `before`, where `place` stacks it. Its own element is keyed by the
	entity's id, a companion by the id and a serial (section 5.1).
	*/
	putOf(rec, before) {
		if (!rec.live) return;
		const nodes = rec.frag.children;
		for (const [node, key] of rec.keys) {
			if (nodes.includes(node)) continue;
			this.scene.remove(rec.layer, key);
			rec.keys.delete(node); this.keyOwners.delete(key);
		}
		nodes.forEach((node, i) => {
			const shapes = describe([node]);
			if (rec.keys.has(node)) return this.scene.put(rec.layer, rec.keys.get(node), shapes, before === undefined ? undefined : { before });
			const key = node.attrs.id === rec.id && ![...rec.keys.values()].includes(rec.id) ? rec.id : `${rec.id}/${++this.serial}`;
			const next = nodes.slice(i + 1).find((n) => rec.keys.has(n));
			this.scene.put(rec.layer, key, shapes, { before: before !== undefined ? before : next ? rec.keys.get(next) : null });
			rec.keys.set(node, key); this.keyOwners.set(key, rec.id);
			return undefined;
		});
	}

	reflectSelection(ids) { return this.batch(() => this.reflectSelectionNow(ids)); }
	reflectSelectionNow(ids) {
		const next = new Set(ids);
		this.selectedSet.forEach((id) => { if (!next.has(id)) this.setState(id, 'selected', false); });
		next.forEach((id) => { if (!this.selectedSet.has(id)) this.setState(id, 'selected', true); });
		this.selectedSet = next;
		this.reflectParts();
	}

	// C-e: each part's reflection marked -- what it marked before and marks no longer, unmarked; what it marks, marked, again
	// each time, so an element drawn afresh since is marked too
	reflectParts() {
		for (const r of this.reflects) {
			const next = r.of(this.model, this.selectedSet);
			const prev = this.marked.get(r.cls) ?? new Set();
			prev.forEach((id) => { if (!next.has(id)) this.setState(id, r.cls, false); });
			next.forEach((id) => this.setState(id, r.cls, true));
			this.marked.set(r.cls, next);
		}
	}

	handle(action, kind, entity) { return this.batch(() => this.handleNow(action, kind, entity)); }
	handleNow(action, kind, entity) {
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
			if (this.draws(kind)) this.remove(entity.id);   // B322: only what it drew
			this.redrawAfter(kind, entity);   // from the DELETED entity -- the model no longer knows what it touched (B218)
		}
	}

	syncAll() { return this.batch(() => this.syncAllNow()); }
	syncAllNow() {
		// a full re-render wipes all DOM -> nothing is reflected as 'selected' anymore, so reset the
		// renderer's selection mirror here (don't trust it across a document swap). Selection's 'load'
		// observer re-reflects the survivors immediately after (it subscribes onChange after us); the
		// selection reconcile itself is owned by Model.load.
		this.selectedSet.clear();
		for (const id of [...this.drawn.keys()]) this.remove(id);   // H26.4: every item the renderer put, removed from the scene
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
		return this.batch(() => {
			this.draw(kind, entity);
			this.place(kind, entity);
		});
	}

	// the layer a drawn kind is stacked in, or null for one that is not stacked (a group's hull)
	stackOf(kind, entity) {
		const painter = this.painters.get(kind);
		if (painter) return painter.stacked ? painter.layer : null;   // C-a: a painted kind's own layer
		if (this.appearances.has(kind)) return this.drawnLayer.get(entity.id) ?? null;   // D3: the layer its winner drew it into
		return null;
	}

	/*
	H26.4 (section 5.1): every other entity's pending changes in the layer put first, so its items stand as the layer's elements stood;
	the item the entity goes before found from the layer's items, walked as its elements were; and the entity put once, each of its
	items with that `before` -- as `insertBefore` moved each element, whether or not it stood there (VS6, a:F5, a:F10).
	*/
	place(kind, entity) {
		const layer = this.stackOf(kind, entity);
		if (!layer) return;
		this.stackedAt.set(entity.id, entity.order);   // what it was placed by, so a later change of order restacks it
		const rec = this.drawn.get(entity.id);
		if (!rec || rec.layer !== layer || !rec.frag.children.length) return;
		this.flush(rec, layer);
		this.dirty.delete(rec);
		const items = this.scene.items(layer);
		let ref = null;
		for (let i = items.length - 1; i >= 0; i--) {
			const id = this.keyOwners.get(items[i].key);   // a companion's item names its entity too -- a link's click twin (B268)
			if (id === entity.id) continue;
			const other = id && this.model.get(kind, id);
			if (!other) continue;
			if (byDrawingOrder(other, entity) > 0) ref = items[i].key; else break;   // drawn after it, so it goes beneath
		}
		this.putOf(rec, ref);
	}

	// what the renderer draws -- by a painter, or by appearances; anything else -- the network's pipe, painted by the network -- it
	// neither draws nor removes (B322)
	draws(kind) { return this.painters.has(kind) || this.appearances.has(kind); }

	draw(kind, entity) {
		if (!this.draws(kind)) return;     // B322: its element is another drawer's
		this.remove(entity.id);             // put is create-or-replace
		// C-a: a kind a plugin paints, its painter draws
		const painter = this.painters.get(kind);
		if (painter) { painter.create(entity, this.kit(painter, this.fragmentFor(painter.layer, entity.id))); this.reapplyStates(entity.id); this.redrawAfter(kind, entity); return; }   // B314: its session states too
		// D3: a kind several plugins draw on, composed from their appearances
		this.drawComposed(kind, entity); this.reapplyStates(entity.id);
	}


	update(kind, entity) { return this.batch(() => this.updateNow(kind, entity)); }
	updateNow(kind, entity) {
		const dom = this.elementOf(entity.id);
		if (!dom) return this.render(kind, entity);
		// its drawing order changed -- the planner's order for a creation that came without one arrives as a set (F-d)
		if (this.stackedAt.get(entity.id) !== entity.order) this.place(kind, entity);
		// C-a: a kind a plugin paints, its painter refreshes -- or asks for a fresh render when its structure changed
		const painter = this.painters.get(kind);
		if (painter) {
			const asked = painter.update(entity, dom, this.kit(painter, this.drawn.get(entity.id).frag));
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

	// fresh DOM loses the session states: re-apply 'selected' if this entity is selected (undo/redo/load), and a reflection that
	// keeps -- a waypoint lit by a selected path -- since render() replaces the DOM -- for every drawn kind, a painted one too (B314)
	reapplyStates(id) {
		if (this.selectedSet.has(id)) this.setState(id, 'selected', true);
		for (const r of this.reflects) if (r.keeps && this.marked.get(r.cls)?.has(id)) this.setState(id, r.cls, true);   // a lit path's waypoint (C-e)
	}

	// H26.4: an entity's fragment, made for the layer it is drawn into and kept by its id -- what its painter or winner draws into
	fragmentFor(layer, id) {
		const rec = { id, layer, frag: null, keys: new Map(), live: true };
		rec.frag = this.shadow.fragment(rec);
		this.drawn.set(id, rec);
		return rec.frag;
	}

	// C-a: what a painter or an appearance is handed -- the canvas's element builder and look applier, the label pill's width, its
	// layer, the model, and the session the drawing may read (the mode, and the render options it implies). H26.4: the builder makes
	// shadow nodes, and a painter's layer is its entity's fragment, holding that entity's top-level nodes
	kit(painter = null, frag = null) {
		return { el: this.el, setAttrs: this.setAttrs, applyLook, pillWidth, layer: painter ? frag : null, model: this.model, mode: this.mode, renderOpts: () => this.renderOpts(), sizeOf: (kind, entity) => this.sizes.get(kind)?.(entity) ?? { w: 0, h: 0 },
			// H24.6: an item's outline as the part drawing it declares it, or undefined -- the painter then takes its own default
			outlineOf: (kind, entity) => (entity ? this.outlines.get(kind)?.(entity) : undefined) };
	}

	/*
	D3 -- THE COMPOSITION of a kind's appearances for one entity (the 2026-09-22 ruling): those whose state applies; of the
	competing ones, the highest-ranked alone (the order's `ranks`); every composing one with it. Null when nothing competes.
	*/
	compose(kind, entity) {
		const kit = this.kit(), ranks = this.orders.get(kind).ranks;
		const applying = this.appearances.get(kind).map((a) => ({ a, state: a.state(entity, kit) })).filter((x) => x.state != null);
		const composes = (x) => (typeof x.a.composes === 'function' ? x.a.composes(x.state) : !!x.a.composes);
		const ranked = applying.filter((x) => x.a.composes !== true).sort((p, q) => ranks.indexOf(p.a.id) - ranks.indexOf(q.a.id));
		const winner = ranked[0];
		return winner ? { winner, composers: applying.filter((x) => x !== winner && composes(x)) } : null;
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
		const g = this.el('g', { id: entity.id, class: cls }, this.fragmentFor(w.a.layer, entity.id));
		for (const [k, v] of w.a.rootAttrs?.(entity) ?? []) g.setAttribute(k, v);
		for (const layer of this.orders.get(kind).layers) {
			if (layer === SESSION_LAYER) { this.el('path', { class: 'select-box', d: w.a.selectBox?.(entity) ?? SELECT_BOX }, g); continue; }
			for (const x of drawers) x.a.parts?.[layer]?.(entity, g, kit, x.state);
		}
		for (const x of drawers) this.applyLookOf(x.a, entity, g);
		this.drawnSig.set(entity.id, this.sigOf(c, entity));
		this.drawnLayer.set(entity.id, w.a.layer);
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

	// H26.4: an entity leaves the scene with every item it drew -- a link's head, leg and click twin with its line (B268)
	remove(id) {
		const rec = this.drawn.get(id);
		if (!rec) return;
		this.drawn.delete(id); this.dirty.delete(rec); rec.live = false;
		for (const key of rec.keys.values()) { this.scene.remove(rec.layer, key); this.keyOwners.delete(key); }
	}

	// H26.4: the entity's own shadow node, where the page's document was asked for its id
	elementOf(id) {
		return this.drawn.get(id)?.frag.children.find((n) => n.attrs.id === id) ?? null;
	}

	// a state of an entity this drew is a class on its own shadow node; of any other id, the composition's to mark where it is drawn (F1)
	setState(id, cls, on) {
		this.batch(() => { const dom = this.elementOf(id); if (dom) dom.classList.toggle(cls, on); else this.foreign?.setState(id, cls, on); });
	}

	clearState(id, ...classes) {
		this.batch(() => { const dom = this.elementOf(id); if (dom) classes.forEach((cls) => dom.classList.remove(cls)); else this.foreign?.clearState(id, classes); });
	}
}
