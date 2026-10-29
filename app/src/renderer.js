/*
Renderer -- reconciles model state into the layers the plugins draw into (painters, then appearances), incrementally.
Every geometry NUMBER and glyph def comes from the KERNEL -- no hardcoded sizes. Draws nodes at their EXACT entity px (so live drag
stays smooth); the committed positions are always on-grid; server/svg.mjs drives this same Renderer, over a scene with no root, for
the SVG export (H2, H25.5, H26.4).

H26.4 (dev/design/components/VECTOR-SCENE.md section 5.1, D8, D9) -- THE SCENE IS vector-scene's. This part alone imports it, and
`openCanvasScene` opens draw's from the composition's declaration (product/canvas.mjs CANVAS_SCENE), on the page's root or on none for
the export; the canvas and the export use the scene it opens, a value.

H26.8 (dev/design/components/NATIVE-SHAPES.md section 3.2, NS2, NS5, NS13) -- THE RENDERER DESCRIBES. Each painter answers its
entity's shapes as ordered named parts, and each appearance its layers' shapes, `vector-scene`'s own; the renderer puts each part as
an item -- `''` the entity's own item, keyed by its id, any other a companion keyed `<id>/<part>` -- and keeps the description:
  1. a change of the entity, or one a `redraws` or `modal` names, describes it -- the painter's parts, or the composed `<g>` -- and
     keeps the description;
  2. the states (app/src/editing-states.js) and the marks the parts declare are applied to a copy, on the state target -- the shape
     bearing the entity's id within its own item -- and each part put under its key, placed by drawing order (F-d) as before;
  3. a part no longer answered is removed; an entity no longer drawn has every key removed and its marks dropped;
  4. a state or mark changed applies them again to the kept description and puts it, no painter called.
It answers no element: `ownShapeOf(id)` the own shape as last described, `drawerOf(id)` the painter or winning appearance, and
`markOf(id, name)` the value a mark holds -- data (GR8). The live shadow, the look applier, the fragments, the dirty marks and the
batching, the puts by serial, the finders, the states re-applied to fresh elements, the signatures and the element lookups went with
it (T3, T4); a state or a mark is shown while held, through a mode or a structural change (NS13).
*/

import { openScene } from '@apnex/vector-scene';
import { L_STD } from '../../kernel/spec.mjs';
import { selBox } from '../../kernel/renderer.mjs';
import { kindOf } from '../../model/model.mjs';
import { byDrawingOrder } from '../../model/stacking.mjs';   // the stacking (F-d)

const SELECT_BOX = selBox(L_STD);      // the kernel's selection brackets (+/-23)

// opaque backing sized to the text (15px monospace: ~9px/char, CJK wide ~15px)
function pillWidth(name) {
	const w = [...(name || '')].reduce((sum, ch) => sum + (ch.codePointAt(0) > 0x2e7f ? 15 : 9), 0);
	return w > 0 ? w + 8 : 0;
}

/*
C-a (H19.29; CANVAS-PLUGINS.md, D1) -- A CANVAS PART, a plugin's contribution to the page: `{ owner, painters }`. A painter is
`{ kind, layer, stacked, picks, run?, shapes(entity, kit) -> parts | null, redraws?, modal?, dependsOn?, shared?, touches? }` --
the kind it draws, the layer it draws into, whether that layer is stacked by drawing order (F-d), and its entity's shapes through the
kit the renderer hands it, since a plugin imports no canvas code. RESTATED H26.8: `shapes` answers `[[part, shape], ...]` in order,
`''` first, where `create` built elements and `update` refreshed them; a painter bringing `create` or `update`, or no `shapes`, is
refused (GR2). Checked when the canvas is built: a layer the page lacks, or a kind painted twice, is refused, naming the owner.
*/
const RETIRED = ['create', 'update'];
/*
D3 (C-a, step three) -- A PART MAY ALSO BRING APPEARANCES for a kind several plugins draw on, and ORDERS for such a kind: the
named layers its parts land in, back to front, and the competing appearances' ranks, highest first. An appearance is
`{ id, kind, state(entity, kit) -> derived state | null, composes, root?, rootAttrs?, addClass?, parts?, selectBox?, redraws? }`:
when its state is not null it applies, and either composes -- drawn alongside the others -- or competes, the highest-ranked alone
drawn, its root the element (`root: { layer, class }`). RESTATED H26.8: each of its `parts` answers `(entity, kit, state) -> shapes`,
and `look` and `structure`, a second statement of the same drawing, are refused. Checked when the canvas is built.
*/
const SESSION_LAYER = 'select';   // the canvas's own layer in an order: the selection brackets, session state, no pack (2026-09-22)

/*
H26.4 (VECTOR-SCENE.md section 5.1, D9) -- DRAW'S SCENE, opened from the composition's declaration: on the page's root, whose layers it
appends after the ground, or on none, for the export. Opened or refused loudly, naming each problem, as kernel/input-rules.mjs opens a
gesture session.
AMENDED H26.5 (dev/design/components/RELEASES-0.2.md sections 3.3, 4 and 8): from vector-scene 0.2.0 a scene opened on a root reads the
root's document's `elementsFromPoint` once as it opens, for `itemAt` -- the browser's on the page and in the lab, none on the test
harness's fake document, which opens as before; the export's, on no root, reads no document. Draw calls no `itemAt` until H26.8's
picks move, its picks reading a target by selector (D4); tests/vector-scene-move.test.js holds both.
*/
export function openCanvasScene(declaration, root = null) {
	const opened = openScene(root ? { ...declaration, root } : declaration);
	if (opened.ok) return opened.scene;
	throw new Error(`the canvas's scene refused its declaration: ${opened.problems.map((p) => `${p.pointer || '/'} ${p.problem}`).join(', ')}`);
}

// H26.4: a layer an entity may be drawn into -- one of the scene's own, never a foreign one, which its drawer writes itself
const drawsInto = (scene, name) => scene.layers.some((l) => l.name === name && !l.foreign);

function composeParts(parts, scene) {
	const appearances = new Map(), orders = new Map(), byId = new Map();
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
			const second = ['look', 'structure'].filter((k) => k in a);
			if (second.length) throw new Error(`Renderer: ${part.owner}'s appearance ${a.id} brings ${second.join(' and ')} -- its parts answer its shapes once (H26.8)`);
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
	// H26.8 (NS5): the marks each part declares, by name -- each `(parts, value) -> parts`, applied in the order declared
	const marks = new Map();
	for (const part of parts) for (const [name, fn] of Object.entries(part.marks ?? {})) {
		if (typeof fn !== 'function') throw new Error(`Renderer: ${part.owner}'s mark ${name} is not a function of the parts and the value`);
		if (marks.has(name)) throw new Error(`Renderer: the mark ${name} is declared by ${marks.get(name).owner} and by ${part.owner}`);
		marks.set(name, { fn, owner: part.owner });
	}
	return { painters: composePainters(parts, scene), appearances, orders, sizes, outlines, marks };
}
function composePainters(parts, scene) {
	const painters = new Map();
	for (const part of parts) {
		for (const p of part.painters ?? []) {
			const retired = RETIRED.filter((k) => k in (p ?? {}));
			if (retired.length) throw new Error(`Renderer: ${part.owner}'s painter for ${p?.kind} brings ${retired.join(' and ')} -- a painter answers its shapes (H26.8)`);
			if (typeof p?.shapes !== 'function') throw new Error(`Renderer: ${part.owner}'s painter for ${p?.kind} has no shapes`);
			if (!drawsInto(scene, p.layer)) throw new Error(`Renderer: ${part.owner}'s painter for ${p.kind} draws into #${p.layer}, which the page does not have`);
			if (painters.has(p.kind)) throw new Error(`Renderer: ${p.kind} is painted by ${painters.get(p.kind).owner} and by ${part.owner}`);
			painters.set(p.kind, { ...p, owner: part.owner });   // H26.4: its layer, the scene's, by name
		}
	}
	return painters;
}

// a description's shapes, copied, so what a state or a mark writes never reaches the kept description
const copyShape = (s) => ({ tag: s.tag, attrs: { ...s.attrs }, ...(s.children ? { children: s.children.map(copyShape) } : s.text !== undefined ? { text: s.text } : {}) });
const tokensOf = (value) => [...new Set(String(value ?? '').split(/\s+/).filter(Boolean))];
// the state target: the shape bearing the entity's id within its own item, at any depth (section 3.2)
function targetIn(shape, id) {
	if (shape.attrs?.id === id) return shape;
	for (const c of shape.children ?? []) { const t = targetIn(c, id); if (t) return t; }
	return null;
}
const sameValue = (a, b) => (a === b) || (a !== null && b !== null && typeof a === 'object' && typeof b === 'object' && JSON.stringify(a) === JSON.stringify(b));

export class Renderer {
	/*
	H26.4: `svg` is the page's root, whose classes the renderer still writes -- modes and labels, draw's own -- or none, for the export;
	`scene` is the one `openCanvasScene` opened. H26.8: `states`, the editing states the composition holds (app/src/editing-states.js),
	described onto each entity it draws while held -- none for the export, which draws no session. `foreign`, where the composition hands
	it (app/src/compose-canvas.js `foreignStates`), marks a state of an id this did not draw -- a pipe's line, which the network draws in
	its own layer under the pipe's id so the canvas's selection reaches it, until the pipes move makes the pipes a painted kind (F1).
	*/
	constructor(model, svg, { parts = [], scene = null, states = null, foreign = null } = {}) {
		if (!scene) throw new Error('Renderer: no scene to draw into -- the canvas opens one (openCanvasScene)');
		this.scene = scene;
		this.states = states;
		this.foreign = foreign;
		// C-a: the kinds a plugin paints, and those several plugins draw by appearances (D3), from the page's canvas parts
		({ painters: this.painters, appearances: this.appearances, orders: this.orders, sizes: this.sizes, outlines: this.outlines, marks: this.markDecls } = composeParts(parts, scene));
		/*
		H26.8: what the renderer has drawn, by entity -- its kind, its layer, what drew it, its description as ordered parts, the scene's key
		for each part and what each was last put as -- the entity each key belongs to, and the marks each entity's owners hold.
		*/
		this.drawn = new Map();
		this.keyOwners = new Map();
		this.marks = new Map();
		this.stackedAt = new Map();   // id -> the drawing order it was stacked by (F-d)
		this.model = model;
		this.svg = svg;
		this.labels = true;             // node and zone names, Tab-toggled; visible by default
		this.modeWatchers = [];         // who hears a mode change (watchMode)
		this.mode = 'view';             // W4/W5 -- view | edit | run (client/session, ephemeral). edit shows the
		model.onChange((action, kind, entity) => this.handle(action, kind, entity));   // socket grid; run makes clickable regions act
		states?.onChange((id, cls, on, changed) => this.restate(id, cls, on, changed));
	}

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

	// W4/W5 -- set the interaction mode. edit shows editing aids (the per-cell socket grid on content panels);
	// run makes clickable content regions act (CSS-gated via the 'run-mode' class); view is clean + normal
	// editing gestures. Session/view state (ephemeral -- not persisted). Re-renders content panels.
	setMode(mode) {
		this.mode = mode;
		this.svg?.classList.toggle('edit-mode', mode === 'edit');
		this.svg?.classList.toggle('run-mode', mode === 'run');
		// every node, not only the panels. Gating a plain node's socket on the mode is pointless if
		// switching mode never re-renders it -- the change would appear on the next unrelated edit.
		// R-c (H18.21): and every waypoint, since run mode draws the run picture's layers rather than hiding the rest by stylesheet
		// -- every entity of a kind drawn by appearances, whose parts may read the mode (D3); H26.8: and each painted kind that says
		// its drawing reads the mode (`modal`)
		for (const kind of this.appearances.keys()) if (this.model.kinds.has(kind)) this.model.all(kind).forEach((e) => this.render(kind, e));
		for (const p of this.painters.values()) if (p.modal && this.model.kinds.has(p.kind)) this.model.all(p.kind).forEach((e) => this.render(p.kind, e));
		// H12.8 -- the composition root starts or stops the movers, and the network's painter draws the run picture's pipes,
		// without the renderer knowing either exists. The renderer draws the document; movers and pipes are not its own.
		for (const fn of this.modeWatchers) fn(this.mode);
		return this.mode;
	}

	// hear every mode change -- `fn(mode)` (R-c: the movers and the network's painter both do)
	watchMode(fn) { this.modeWatchers.push(fn); }

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
			if (this.draws(kind)) this.remove(entity.id);   // B322: only what it drew
			this.redrawAfter(kind, entity);   // from the DELETED entity -- the model no longer knows what it touched (B218)
		}
		return undefined;
	}

	/*
	A load draws every entity afresh, and drops every mark its owners set: each sets it again on its next pass (NS13). The editing
	states stay as their owners hold them -- Input drops the hover and the arming on a load, and the selection keeps what survives it,
	now shown, where the renderer's mirror of the selection was cleared and the look lost (NS13, measured).
	*/
	syncAll() {
		for (const id of [...this.drawn.keys()]) this.remove(id);   // every item, and every mark with its entity
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
	re-render -- returns to its place rather than to the top, which is what B10 was. Described afresh, every part put before the
	first item an older one precedes; the newest, the common case, stops at the first look. Its marks are kept: a fresh description
	is the same entity, its owners still holding what they set (NS13).
	*/
	render(kind, entity) {
		if (!this.draws(kind)) return;     // B322: its element is another drawer's
		this.unput(entity.id);              // put is create-or-replace
		const d = this.describe(kind, entity);
		const layer = this.stackOf(kind, entity, d);
		if (layer) this.stackedAt.set(entity.id, entity.order);   // what it was placed by, so a later change of order restacks it
		if (d) {
			const rec = { id: entity.id, kind, layer: d.layer, drawer: d.drawer, parts: d.parts, keys: new Map(), put: new Map() };
			this.drawn.set(entity.id, rec);
			this.putFresh(rec, layer ? this.refFor(kind, entity, layer) : null);
		} else this.marks.delete(entity.id);   // nothing drawn for it: no longer drawn, its marks dropped
		if (this.painters.has(kind)) this.redrawAfter(kind, entity);
	}

	// the layer a drawn kind is stacked in, or null for one that is not stacked (a group's hull)
	stackOf(kind, entity, d = null) {
		const painter = this.painters.get(kind);
		if (painter) return painter.stacked ? painter.layer : null;   // C-a: a painted kind's own layer
		if (this.appearances.has(kind)) return d?.layer ?? this.drawn.get(entity.id)?.layer ?? null;   // D3: the layer its winner drew it into
		return null;
	}

	/*
	The item an entity goes before in its stacked layer: walked back from the top over the items of its kind's other entities (a
	companion's item names its entity too -- a link's click twin, B268), the first one drawn before it ending the walk -- or null, the
	layer's top.
	*/
	refFor(kind, entity, layer) {
		const items = this.scene.items(layer);
		let ref = null;
		for (let i = items.length - 1; i >= 0; i--) {
			const id = this.keyOwners.get(items[i].key);
			if (id === entity.id) continue;
			const other = id && this.model.get(kind, id);
			if (!other) continue;
			if (byDrawingOrder(other, entity) > 0) ref = items[i].key; else break;   // drawn after it, so it goes beneath
		}
		return ref;
	}

	// an entity whose drawing order changed, moved to its place: each part put again before the item it now goes beneath
	place(kind, entity) {
		const layer = this.stackOf(kind, entity);
		if (!layer) return;
		this.stackedAt.set(entity.id, entity.order);
		const rec = this.drawn.get(entity.id);
		if (!rec || rec.layer !== layer || !rec.parts.length) return;
		const before = this.refFor(kind, entity, layer);
		for (const [part, shape] of this.applied(rec)) this.putPart(rec, part, shape, { before });
	}

	// what the renderer draws -- by a painter, or by appearances; anything else -- the network's pipe, painted by the network -- it
	// neither draws nor removes (B322)
	draws(kind) { return this.painters.has(kind) || this.appearances.has(kind); }

	/*
	A change of an entity: described again and put part by part -- a part answered as before patched in place, one no longer answered
	removed, one newly answered put before the next part it keeps -- or moved to its place first when its drawing order changed (F-d),
	or removed when nothing is drawn for it any more. Then what its painter or appearances name to redraw, and whatever gathers it.
	*/
	update(kind, entity) {
		if (!this.drawn.has(entity.id)) return this.render(kind, entity);
		const layer = this.stackOf(kind, entity);
		// its drawing order changed -- the planner's order for a creation that came without one arrives as a set (F-d)
		if (layer && this.stackedAt.get(entity.id) !== entity.order) this.place(kind, entity);
		const painter = this.painters.get(kind);
		const d = this.describe(kind, entity);
		if (!d) this.remove(entity.id);
		else if (d.layer !== this.drawn.get(entity.id).layer) this.render(kind, entity);   // its winner draws it into another layer
		else this.patch(this.drawn.get(entity.id), d);
		if (painter) { this.redrawAfter(kind, entity); return undefined; }
		// D3: what its appearances name to redraw, and whatever gathers it
		for (const a of this.appearances.get(kind) ?? []) for (const [k, e] of a.redraws?.(entity, this.kit()) ?? []) this.update(k, e);
		this.refreshGatherer(entity.id);   // a hull hugs its members, follow the move
		return undefined;
	}

	/*
	C-a: what a painter or an appearance is handed, exactly (GR3): the model, the mode and the render options it implies, a part's
	size and outline for an item another part draws, the label pill's width -- and, for a painter declaring `shared`, what it shares
	across its kind's entities this call (rule P, the pipes move).
	*/
	kit(painter = null) {
		return { model: this.model, mode: this.mode, renderOpts: () => this.renderOpts(), sizeOf: (kind, entity) => this.sizes.get(kind)?.(entity) ?? { w: 0, h: 0 },
			// H24.6: an item's outline as the part drawing it declares it, or undefined -- the painter then takes its own default
			outlineOf: (kind, entity) => (entity ? this.outlines.get(kind)?.(entity) : undefined), pillWidth,
			...(typeof painter?.shared === 'function' ? { shared: painter.shared(this.model) } : {}) };
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

	/*
	An entity's description -- `{ layer, drawer, parts }`, or null when nothing is drawn for it: its painter's parts; or, for a kind
	drawn by appearances, one `<g>` -- its winner's root class then each composer's, the winner's root attributes, and each named layer
	of the order in turn, the winner's part then the composers', the canvas's selection brackets in its own (D3).
	*/
	describe(kind, entity) {
		const painter = this.painters.get(kind);
		if (painter) {
			const parts = painter.shapes(entity, this.kit(painter));
			return parts ? { layer: painter.layer, drawer: painter, parts } : null;
		}
		const c = this.compose(kind, entity);
		if (!c) return null;
		const kit = this.kit(), drawers = [c.winner, ...c.composers], w = c.winner;
		const attrs = { id: entity.id, class: [w.a.root.class(entity, kit, w.state), ...c.composers.map((x) => x.a.addClass).filter(Boolean)].join(' ') };
		for (const [k, v] of w.a.rootAttrs?.(entity) ?? []) attrs[k] = v;
		const children = [];
		for (const layer of this.orders.get(kind).layers) {
			if (layer === SESSION_LAYER) { children.push({ tag: 'path', attrs: { class: 'select-box', d: w.a.selectBox?.(entity) ?? SELECT_BOX } }); continue; }
			for (const x of drawers) children.push(...(x.a.parts?.[layer]?.(entity, kit, x.state) ?? []));
		}
		return { layer: w.a.layer, drawer: w.a, parts: [['', { tag: 'g', attrs, children }]] };
	}

	/*
	A record's parts as they are put: the description copied, the editing states its owners hold written on its state target after the
	description's own classes, in the order set (NS13), then each mark held, in the order the parts declare them (NS5).
	*/
	applied(rec) {
		let parts = rec.parts.map(([part, shape]) => [part, copyShape(shape)]);
		const held = this.states?.classesOf(rec.id) ?? [];
		if (held.length) {
			const own = parts.find(([part]) => part === '');
			const target = own && targetIn(own[1], rec.id);
			if (target) {
				const tokens = tokensOf(target.attrs.class);
				target.attrs.class = [...tokens, ...held.filter((c) => !tokens.includes(c))].join(' ');
			}
		}
		const marks = this.marks.get(rec.id);
		if (marks) for (const [name, { fn }] of this.markDecls) if (marks.has(name)) parts = fn(parts, marks.get(name));
		return parts;
	}

	// a part put under its key -- new, before `before` (or last), or put again where it stands, or moved by `place`
	putPart(rec, part, shape, place) {
		const key = part === '' ? rec.id : `${rec.id}/${part}`;
		const json = JSON.stringify(shape);
		const kept = rec.keys.has(part);
		if (kept && place === undefined && rec.put.get(part) === json) return;   // a put that changes nothing puts nothing
		this.scene.put(rec.layer, key, [shape], place);
		rec.keys.set(part, key); rec.put.set(part, json); this.keyOwners.set(key, rec.id);
	}

	// a record put for the first time: each part, in order, before `before` (or last in the layer)
	putFresh(rec, before) {
		for (const [part, shape] of this.applied(rec)) this.putPart(rec, part, shape, { before });
	}

	// a record put again from a new description: a part no longer answered removed; one answered as before put again where it stands;
	// one new put before the next part it keeps, or last
	patch(rec, d) {
		rec.parts = d.parts; rec.drawer = d.drawer;
		const now = this.applied(rec), answered = new Set(now.map(([part]) => part));
		for (const [part, key] of [...rec.keys]) {
			if (answered.has(part)) continue;
			this.scene.remove(rec.layer, key);
			rec.keys.delete(part); rec.put.delete(part); this.keyOwners.delete(key);
		}
		now.forEach(([part, shape], i) => {
			if (rec.keys.has(part)) return this.putPart(rec, part, shape);
			const next = now.slice(i + 1).find(([p]) => rec.keys.has(p));
			return this.putPart(rec, part, shape, { before: next ? rec.keys.get(next[0]) : null });
		});
	}

	// a record's state or marks changed: its kept description, the states and marks applied again, put -- no painter called
	reput(rec) {
		for (const [part, shape] of this.applied(rec)) if (rec.keys.has(part)) this.putPart(rec, part, shape);
	}

	/*
	A state asked: on an entity this draws, put again where its states changed; on any other id, every ask the composition's to mark
	where it is drawn (F1) -- a pipe's line, drawn afresh by the network, shows a state its owner asks again, as before the move (B1)
	*/
	restate(id, cls, on, changed) {
		const rec = this.drawn.get(id);
		if (rec) { if (changed) this.reput(rec); }
		else this.foreign?.setState(id, cls, on);
	}

	/*
	NS5 -- A MARK, held for an entity by the part that owns it: `value`, or null to drop it. The entity is put only when the value differs
	from the one it holds, so an owner sets its mark on every pass -- the reveal withholding each id each pass, the movers aiming each
	tower each frame -- and puts nothing while it stands. An id this does not draw holds none: its owner sets it again on its next pass.
	*/
	mark(id, name, value) {
		if (!this.markDecls.has(name)) throw new Error(`Renderer: no part declares the mark ${name}`);
		const rec = this.drawn.get(id);
		if (!rec) return;
		const held = this.marks.get(id) ?? new Map(), next = value ?? null;
		if (sameValue(held.get(name) ?? null, next)) return;
		if (next === null) held.delete(name); else held.set(name, next);
		if (held.size) this.marks.set(id, held); else this.marks.delete(id);
		this.reput(rec);
	}

	// the value a mark holds for an entity, or null -- dropped with the entity and on a load
	markOf(id, name) { return this.marks.get(id)?.get(name) ?? null; }

	// the entity's own shape as last described, data -- never an element (GR8); null for an id this does not draw
	ownShapeOf(id) {
		const own = this.drawn.get(id)?.parts.find(([part]) => part === '');
		return own ? copyShape(own[1]) : null;
	}

	// the painter or winning appearance that drew an entity, or null
	drawerOf(id) { return this.drawn.get(id)?.drawer ?? null; }

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

	// every item an entity drew taken from the scene -- a link's head, leg and click twin with its line (B268) -- its marks kept
	unput(id) {
		const rec = this.drawn.get(id);
		if (!rec) return;
		this.drawn.delete(id);
		for (const key of rec.keys.values()) { this.scene.remove(rec.layer, key); this.keyOwners.delete(key); }
	}

	// an entity no longer drawn: every item removed, and its marks dropped (section 3.2, rule 3)
	remove(id) {
		this.unput(id);
		this.marks.delete(id);
	}
}
