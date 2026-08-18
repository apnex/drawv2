/*
Input — pointer/keyboard state machine. Two-button gestures (docs/spec/SCOPE.md decision 2):
  click             select (Shift/Ctrl+click adds/toggles)
  left-drag node    create link (whole node is the source, crosshair ring)
  right-drag        move node/zone selection (snap on release)  [v1 convention]
  Ctrl+drag         clone selection subgraph (blue arming)      [draw.io / v1 lineage]
  Alt+right-click   delete entity under cursor (red arming)     [v1 chord, resurrected]
  drag empty        marquee select (passes through zones)
  Shift             the ZONE layer: zones are inert backdrop unless Shift is
                    held — Shift+click/drag selects/moves, Shift+drag on empty
                    canvas draws a zone (zone grid doubles as layer indicator)
  drag zone handle  resize selected zone (handles stay live once selected)
  drag link endpoint  re-plug: rewire that end of a selected link onto another node
  Shift mid-drag    ortho lock: constrain a move/clone to its dominant axis
  Shift at release  (link mode) chain wiring: continue the run from the target
  Space             set datum at cursor (readout goes relative); Shift+Space clears
  1-6 / Q           stamp hand: digit arms a node type (ghost at the snapped cell,
                    click stamps, Enter stamps at the ghost); Q pipettes the type
                    under the cursor (or clears); same digit / Esc / tile click drops;
                    click a DIFFERENT-type node to retype it in place (fast-replace)
  double-click/F2   edit label (Tab inside the editor renames the next entity)
  arrows            nudge selection one cell (coalesced undo)
  Shift+arrows      resize the lone selected zone, OR grow the lone selected node's span, one cell (NW-anchored, coalesced)
  Z                 wrap the selection in a fitted zone
  C                 close/open the selected multi-hop route (loops dst→src; toggles)
  L / Shift+L       link selected nodes: chain in selection order / star from the first
  Tab               toggle the numeric data-view overlay (every node's coords, link
                    lengths, zone dims — read-only, units follow the readout)
  Ctrl+D            duplicate the selection at the remembered pitch (last move/clone)
  Delete            delete selection      Ctrl+Z / Ctrl+Shift+Z|Ctrl+Y  undo / redo
  Ctrl+G / +Shift   group / ungroup       Ctrl+A                        select all
  Escape            cancel / clear / close overlay              ?       help overlay
*/

import { CANVAS, GAP, HALF, NODE_R, NODE_EXT, ZONE_EXT, snapNode, snapZone, resolveBox, pointInBox, dist } from './snap.js';
import { el, toCanvas, crosshair, previewRect, previewLine, previewPath } from './painter.js';
import { roundedPath, BEND_R } from '../../kernel/index.mjs';
import { newId, kindOf } from '../../document/index.mjs';
import { NODE_TYPES } from './palette.js';
import * as commands from './commands.js';

const DRAG_THRESHOLD = 4;   // canvas units before a press becomes a drag
const NUDGE_COALESCE_MS = 600;
const MIN_ZONE = GAP;       // one cell

// A1 — the node-frame rect spanning two snapped cell-centre points: the text-box draw preview + its
// footprint (anchor cell + span counts). a click (a===b) → a 1×1 frame; a drag → the spanned frame.
const frameSpan = (a, b) => {
	const x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y), x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
	return { x: x0 - NODE_R, y: y0 - NODE_R, w: (x1 - x0) + 2 * NODE_R, h: (y1 - y0) + 2 * NODE_R,
		anchor: { x: x0, y: y0 }, cols: Math.round((x1 - x0) / GAP) + 1, rows: Math.round((y1 - y0) / GAP) + 1 };
};
// a multi-cell node's footprint extent beyond its anchor in px (0 for a 1×1 node / waypoint) + helpers to
// hit-test / overlap a node by its whole FOOTPRINT (not just the anchor point) — span-awareness for the editor.
const spanExt = (n) => ({ sw: n.span ? (n.span.cols - 1) * GAP : 0, sh: n.span ? (n.span.rows - 1) * GAP : 0 });
const inFootprint = (n, pos, pad = 0) => { const { sw, sh } = spanExt(n); return pos.x >= n.x - pad && pos.x <= n.x + sw + pad && pos.y >= n.y - pad && pos.y <= n.y + sh + pad; };
const footprintHits = (n, box, pad = 0) => { const { sw, sh } = spanExt(n);   // node footprint rect ∩ a box (marquee)
	return n.x - pad <= box.x + box.w && n.x + sw + pad >= box.x && n.y - pad <= box.y + box.h && n.y + sh + pad >= box.y; };

export class Input {
	constructor({ svg, model, history, selection, renderer, labels, readout, palette, dataview }) {
		this.svg = svg;
		this.model = model;
		this.history = history;
		this.selection = selection;
		this.renderer = renderer;
		this.labels = labels;
		this.readout = readout || { setCursor() {}, setDrag() {}, setBox() {}, setLink() {}, setDatum() {}, clearTransient() {}, render() {} };
		this.palette = palette || { hand: null, setHand() {}, toggleHand() {}, trackHand() {}, hideHand() {} };
		this.dataview = dataview || { toggle() {} };
		this.lastPos = null;   // last pointer position in canvas coords (datum anchor)
		this.datumEl = null;   // datum marker on #snaplayer
		this.overlay = svg.querySelector('#overlay');
		this.snap = crosshair(svg.querySelector('#snaplayer'), CANVAS, GAP);
		this.mode = null; // null | pending | clone-pending | move | clone | link | zone | marquee | resize
		this.ctx = {};
		this.hovered = null;
		this.armed = null;     // { id, cls }
		this.lastNudge = null;  // { t, cmd } — arrow-nudge coalescing
		this.lastResize = null; // { t, cmd } — Shift+arrow zone-resize coalescing
		this.lastDelta = { x: GAP, y: 0 }; // remembered pitch for Ctrl+D duplicate
		this.readOnly = false; // Server-Locked: inspect + select only, no mutations
		this.textTool = false; // A1 — 't' held: drag draws a text box (mirrors Shift+drag-zone)
		this.help = document.getElementById('help');

		selection.subscribe(() => {
			// a coalescing burst never spans a selection change
			this.lastNudge = null;
			this.lastResize = null;
			this.refreshHandles();
			this.readout.render();
		});
		model.onChange((action, kind, entity) => {
			// zone resize handles + link endpoint handles track their entity's geometry
			if (kind === 'zone' || kind === 'link' || action === 'load') this.refreshHandles();
			// a gesture must not survive a document swap (chain mode has no held
			// button, so the header menu is reachable mid-gesture)
			if (action === 'load' && this.mode) this.cancelDrag();
			// hovered/armed state must die with its entity (chord delete, undo, load)
			if (action === 'del' || action === 'load') {
				if (this.hovered && (action === 'load' || entity.id === this.hovered)) {
					this.renderer.clearState(this.hovered, 'hover', 'linkband');
					this.hovered = null;
					this.disarm();
				}
				if (action === 'load' && this.labels.isOpen()) this.labels.close(false);
				if (action === 'load') {
					this.readout.setDatum(null);
					this.setDatumMarker(null);
					this.palette.setHand(null); // the hand never survives a document swap
					this.readout.setCursor(null);
				}
			}
		});

		svg.addEventListener('pointerleave', () => {
			this.readout.setCursor(null);
			this.palette.hideHand();
			this.lastPos = null; // keys must never act on a stale off-canvas position
		});
		svg.addEventListener('pointerdown', (e) => this.onDown(e));
		svg.addEventListener('pointermove', (e) => this.onMove(e));
		svg.addEventListener('pointerup', (e) => this.onUp(e));
		svg.addEventListener('pointercancel', (e) => this.cancelDrag(e));
		svg.addEventListener('pointerover', (e) => this.onHover(e, true));
		svg.addEventListener('pointerout', (e) => this.onHover(e, false));
		svg.addEventListener('dblclick', (e) => this.onDblClick(e));
		window.addEventListener('keydown', (e) => this.onKeyDown(e));
		window.addEventListener('keyup', (e) => this.onKeyUp(e));
		svg.addEventListener('contextmenu', (e) => e.preventDefault());
	}

	// ---- hit helpers ----
	hit(evt) {
		const target = evt.target;
		if (!target.closest) return { kind: 'canvas', id: null };
		if (target.classList && target.classList.contains('handle')) {
			// link endpoint handles carry data-end; zone corner handles carry data-corner
			if (target.dataset.end) return { kind: 'lhandle', end: target.dataset.end };
			return { kind: 'handle', id: target.dataset.corner };
		}
		const nodeG = target.closest('g.node:not(.ghost)');
		if (nodeG) return { kind: 'node', id: nodeG.id };
		const wpG = target.closest('g.waypoint');
		if (wpG) return { kind: 'waypoint', id: wpG.id };
		// zones live on the Shift layer: inert backdrop unless Shift is held,
		// so clicks and marquees pass through them to the canvas
		const zoneG = target.closest('g.zone');
		if (zoneG) return evt.shiftKey ? { kind: 'zone', id: zoneG.id } : { kind: 'canvas', id: null };
		if (target.classList && target.classList.contains('link')) return { kind: 'link', id: target.id };
		return { kind: 'canvas', id: null };
	}

	nodeAt(pos, slop = NODE_R + 4) {
		// footprint-aware: a multi-cell node is hittable across its WHOLE span, not just near its anchor
		// (1×1 → a ±slop box ≈ the old circular radius). Backs select / move / link-target / re-plug.
		return this.model.all('node').find((n) => inFootprint(n, pos, slop));
	}

	isGesturing() {
		return this.mode && this.mode !== 'pending' && this.mode !== 'clone-pending';
	}

	// ---- pointer down ----
	// Server-Locked: a server-side controller owns writes; the browser can still
	// look, select, marquee, toggle the data view — but not mutate
	setReadOnly(on) {
		if (this.readOnly === on) return;
		this.readOnly = on;
		this.palette.readOnly = on;
		if (on) {
			if (this.mode) this.cancelDrag();
			this.palette.setHand(null);
			this.disarm();
		}
	}

	onDown(evt) {
		// W5 — RUN mode: the diagram ACTS as UI. A click on a clickable region fires its action (the host
		// app wires it via the 'draw:action' event); every other gesture (select/drag/stamp) is suppressed.
		if (this.renderer.mode === 'run') {
			if (evt.button !== 0) return;
			const t = evt.target.closest && evt.target.closest('[data-action],[data-input]');
			if (t && t.dataset.action) {   // W5 — a button: fire its action
				evt.preventDefault();
				window.dispatchEvent(new CustomEvent('draw:action', { detail: { action: t.dataset.action, id: t.closest('.node') ? t.closest('.node').id : null } }));
			} else if (t && t.dataset.input !== undefined) {   // W6 — an input: edit its value inline
				evt.preventDefault();
				const node = t.closest('.node');
				if (node) this.labels.openContent(node.id, Number(t.dataset.idx), t);
			}
			return;
		}
		// A1 — text tool ('t' held): a drag draws a grid-snapped text box (mirrors Shift+drag-zone); a click
		// makes a 1×1. Intercepts before normal hit dispatch so it works anywhere on the canvas.
		if (this.textTool && evt.button === 0) {
			if (this.labels.isOpen()) this.labels.close(true);
			const pos = toCanvas(evt, this.svg);
			const p1 = snapNode(pos);
			this.mode = 'textbox';
			try { this.svg.setPointerCapture(evt.pointerId); } catch { /* synthetic events */ }
			this.ctx = { p1, rect: previewRect(this.overlay, 'textbox-preview') };
			this.ctx.rect.update(frameSpan(p1, p1));
			return;
		}
		if (this.labels.isOpen()) this.labels.close(true);
		this.palette.hideHand(); // ghost never rides along a gesture
		const pos = toCanvas(evt, this.svg);
		this.lastPos = pos;
		const hit = this.hit(evt);

		// read-only: left-click selects, left-drag marquees; nothing mutates
		if (this.readOnly) {
			if (evt.button !== 0) return;
			try { this.svg.setPointerCapture(evt.pointerId); } catch { /* synthetic events */ }
			if (hit.kind === 'node' || hit.kind === 'zone' || hit.kind === 'link') {
				this.beginPress(hit, pos, evt.shiftKey);
			} else {
				this.mode = 'marquee';
				this.ctx = { p1: pos, rect: previewRect(this.overlay, 'marquee') };
			}
			return;
		}
		// chain wiring leaves link mode live across releases: a press while
		// chaining is the start of the next release, never a cancel
		if (this.mode === 'link' && evt.button === 0) {
			try { this.svg.setPointerCapture(evt.pointerId); } catch { /* synthetic events */ }
			return;
		}
		if (evt.button === 2) {
			// Alt+right-click: surgical delete of the armed entity under the cursor
			if (evt.altKey) {
				if (!this.isGesturing() && hit.id && hit.kind !== 'handle') {
					this.disarm();
					this.history.commit(commands.deleteSelection(this.model, new Set([hit.id])));
					// selection auto-prunes on the delete's emits (selection.js)
				}
				return;
			}
			// right-press on a node/zone/waypoint: the move gesture (drag) or a plain select (click)
			if (hit.kind !== 'node' && hit.kind !== 'zone' && hit.kind !== 'waypoint') return;
			if (this.mode) this.cancelDrag(evt); // a second press never stacks on an active gesture
			try { this.svg.setPointerCapture(evt.pointerId); } catch { /* synthetic events */ }
			if (evt.ctrlKey) {
				// Ctrl turns the move-drag into a clone-drag, whichever button moves
				this.mode = 'clone-pending';
				this.ctx = { hit, start: pos, orthoReady: !evt.shiftKey };
				return;
			}
			// for zones Shift is the layer key, not selection-add
			this.beginPress(hit, pos, evt.shiftKey && hit.kind !== 'zone');
			this.ctx.orthoReady = !evt.shiftKey;
			return;
		}
		if (evt.button !== 0) return;
		if (this.mode) this.cancelDrag(evt); // a second press never stacks on an active gesture
		this.syncZoneGrid(evt);
		try { this.svg.setPointerCapture(evt.pointerId); } catch { /* synthetic events */ }

		if (hit.kind === 'handle') {
			const zoneId = this.selection.list().find((id) => kindOf(id) === 'zone');
			const zone = this.model.get('zone', zoneId);
			if (!zone) return;
			const corners = {
				nw: { x: zone.x + zone.w, y: zone.y + zone.h },
				ne: { x: zone.x, y: zone.y + zone.h },
				sw: { x: zone.x + zone.w, y: zone.y },
				se: { x: zone.x, y: zone.y }
			};
			this.mode = 'resize';
			this.ctx = { zone: zoneId, anchor: corners[hit.id], before: { x: zone.x, y: zone.y, w: zone.w, h: zone.h } };
			return;
		}

		// link endpoint handle: drag this end onto another node to rewire the link
		if (hit.kind === 'lhandle') {
			const linkId = this.selection.list().find((id) => kindOf(id) === 'link');
			const link = this.model.get('link', linkId);
			if (!link) return;
			const fixedId = hit.end === 'src' ? link.dst : link.src;
			const fixed = this.model.get('node', fixedId);
			if (!fixed) return;
			this.mode = 'replug';
			this.renderer.setState(linkId, 'replugging', true); // de-emphasize the real line while dragging
			this.ctx = {
				linkId, end: hit.end, fixedId, fixed,
				before: { src: link.src, dst: link.dst },
				line: previewLine(this.overlay), target: null
			};
			this.ctx.line.update(fixed, pos);
			return;
		}

		// Ctrl+press on an entity: clone gesture (drag) or selection toggle (click);
		// links can't anchor a clone but Ctrl+click still toggles them
		if (evt.ctrlKey && (hit.kind === 'node' || hit.kind === 'zone' || hit.kind === 'link')) {
			this.mode = 'clone-pending';
			this.ctx = { hit, start: pos, orthoReady: !evt.shiftKey };
			return;
		}

		if (hit.kind === 'node' || (hit.kind === 'waypoint' && this.waypointFree(hit.id))) {
			// a node, or a FREE waypoint, is a link source; release without a drag is a click-select
			const src = this.model.get(hit.kind, hit.id);
			// pointer capture swallows the boundary pointerout in link mode
			this.renderer.setState(src.id, 'hover', false);
			this.hovered = null;
			this.mode = 'link';
			this.ctx = { src, path: previewPath(this.overlay), target: null, start: pos, shift: evt.shiftKey, via: [], placed: [] };
			this.updateLinkPreview(pos);
			return;
		}
		if (hit.kind === 'waypoint') {
			// occupied waypoint (free ones started a link above): left-click SELECTS only — never moves.
			// Moving a waypoint is right-drag, like nodes (which never move on the left button).
			if (evt.shiftKey) this.selection.toggle(hit.id);
			else if (!this.selection.has(hit.id)) this.selection.set([hit.id]);
			this.focusId = hit.id;
			return;
		}
		if (hit.kind === 'zone' || hit.kind === 'link') {
			// for zones Shift is the layer key, not selection-add
			this.beginPress(hit, pos, evt.shiftKey && hit.kind !== 'zone');
			this.ctx.orthoReady = !evt.shiftKey;
			return;
		}
		// empty canvas
		if (evt.shiftKey) {
			const p1 = snapZone(pos);
			this.mode = 'zone';
			this.ctx = { p1, rect: previewRect(this.overlay, 'zone-rect preview') };
			this.ctx.rect.update(resolveBox(p1, p1));
		} else {
			this.mode = 'marquee';
			this.ctx = { p1: pos, rect: previewRect(this.overlay, 'marquee') };
		}
	}

	// a press on an entity: selection now, possibly a move-drag later
	beginPress(hit, pos, shift) {
		this.mode = 'pending';
		this.ctx = { hit, start: pos, shift };
		this.focusId = hit.id; // F2's deterministic target within group selections
		if (shift) {
			this.selection.toggle(hit.id);
		} else if (!this.selection.has(hit.id)) {
			this.selection.set([hit.id]);
		}
	}

	startMove(pos) {
		const moved = [];
		this.selection.list().forEach((id) => {
			const kind = kindOf(id);
			if (kind !== 'node' && kind !== 'zone' && kind !== 'waypoint') return;
			const entity = this.model.get(kind, id);
			if (entity) moved.push({ kind, id, before: { x: entity.x, y: entity.y } });
		});
		if (moved.length === 0) { this.mode = null; return; }
		const anchor = this.ctx.hit;
		this.mode = 'move';
		this.ctx = { ...this.ctx, moved, anchorKind: anchor.kind, anchorId: anchor.id };
	}

	/*
	Materialize a copy of a subgraph spanned by seedIds — nodes, selected zones,
	links between cloned nodes, fully-contained groups — putting every copy into
	the model at its ORIGINAL position. Returns { clones, idMap } (null if the
	seeds hold no node/zone). Shared by the clone DRAG and Ctrl+D duplicate.
	*/
	cloneClosure(seedIds) {
		const idMap = new Map();
		const clones = [];
		seedIds.forEach((id) => {
			const kind = kindOf(id);
			if (kind !== 'node' && kind !== 'zone') return;
			const src = this.model.get(kind, id);
			if (!src) return;
			const copy = { ...src, id: newId(kind, this.model.collection(kind)) };
			copy.name = this.model.nextName(kind === 'node' ? src.type : 'zone');
			idMap.set(id, copy.id);
			this.model.put(kind, copy);
			clones.push({ kind, entity: copy });
		});
		if (idMap.size === 0) return null;

		// links whose both endpoints were cloned
		this.model.all('link').forEach((link) => {
			if (idMap.has(link.src) && idMap.has(link.dst) && !idMap.has(link.id)) {
				const copy = { id: newId('link', this.model.collection('link')), src: idMap.get(link.src), dst: idMap.get(link.dst) };
				idMap.set(link.id, copy.id);
				this.model.put('link', copy);
				clones.push({ kind: 'link', entity: copy });
			}
		});
		// groups fully contained in the clone set
		this.model.all('group').forEach((group) => {
			if (group.members.length > 0 && group.members.every((m) => idMap.has(m))) {
				const copy = this.model.makeGroup(group.members.map((m) => idMap.get(m)));
				this.model.put('group', copy);
				clones.push({ kind: 'group', entity: copy });
			}
		});
		return { clones, idMap };
	}

	/*
	Clone (Ctrl+drag): materialize the subgraph copy, then drag the copies;
	commit puts the final state into history.
	*/
	startClone(pos) {
		const hit = this.ctx.hit;
		// links can't anchor a clone; the entity may also have died mid-press (undo)
		if (hit.kind === 'link' || !this.model.get(hit.kind, hit.id)) {
			this.mode = null;
			this.ctx = {};
			return;
		}
		if (!this.selection.has(hit.id)) this.selection.set([hit.id]);
		const result = this.cloneClosure(this.selection.list());
		if (!result) { this.mode = null; this.ctx = {}; return; }
		const { clones, idMap } = result;

		const moved = clones
			.filter((c) => c.kind === 'node' || c.kind === 'zone')
			.map((c) => ({ kind: c.kind, id: c.entity.id, before: { x: c.entity.x, y: c.entity.y } }));
		const anchorId = idMap.get(hit.id);
		this.mode = 'clone';
		this.ctx = { ...this.ctx, clones, moved, anchorKind: hit.kind, anchorId };
		this.selection.set(moved.map((m) => m.id));
	}

	/*
	Ctrl+D — duplicate the selected subgraph at the remembered pitch (the last
	committed move/clone delta this session, default one cell right). Clamps to
	the canvas; if both axes clamp to zero it refuses rather than overlap.
	*/
	duplicateSelection() {
		const seeds = this.selection.list().filter((id) => kindOf(id) === 'node' || kindOf(id) === 'zone');
		if (seeds.length === 0) return;
		// clamp the pitch against the ORIGINALS (clones start at the same spots)
		const refs = seeds.map((id) => {
			const kind = kindOf(id);
			const e = this.model.get(kind, id);
			return { kind, id, before: { x: e.x, y: e.y } };
		});
		const delta = this.clampDelta(refs, { ...this.lastDelta });
		const cells = (v) => this.readout.signed(v / GAP);
		if (delta.x === 0 && delta.y === 0) {
			this.readout.flash(`✗ no room Δ[${cells(this.lastDelta.x)}, ${cells(this.lastDelta.y)}]`);
			return;
		}
		const result = this.cloneClosure(seeds);
		if (!result) return;
		// shift the positioned clones by the pitch, then snapshot for history
		result.clones.forEach((c) => {
			if (c.kind === 'node' || c.kind === 'zone') {
				this.model.set(c.kind, c.entity.id, { x: c.entity.x + delta.x, y: c.entity.y + delta.y });
			}
		});
		const clones = result.clones
			.filter((c) => this.model.get(c.kind, c.entity.id))
			.map((c) => ({ kind: c.kind, entity: { ...this.model.get(c.kind, c.entity.id) } }));
		this.history.commit(commands.cloneEntities(clones));
		const placed = clones.filter((c) => c.kind === 'node' || c.kind === 'zone');
		this.selection.set(placed.map((c) => c.entity.id));
		this.afterHistory();
		this.lastDelta = delta; // tap-tap-tap repeats the same pitch
		this.readout.flash(`+${placed.length} cloned Δ[${cells(delta.x)}, ${cells(delta.y)}]`);
	}

	/*
	Z — wrap the selection in a fitted zone: the bounding box of the positioned
	entities, given a 30px margin and rounded OUT to the enclosing zone-grid
	rectangle (for pure-node selections the +30 already lands on the grid).
	*/
	wrapInZone() {
		const ids = this.selection.list();
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, boxed = 0;
		ids.forEach((id) => {
			const kind = kindOf(id);
			const e = this.model.get(kind, id);
			if (!e || e.x === undefined) return;
			minX = Math.min(minX, e.x); minY = Math.min(minY, e.y);
			maxX = Math.max(maxX, e.x + (e.w || 0)); maxY = Math.max(maxY, e.y + (e.h || 0));
			boxed++;
		});
		if (boxed === 0) return; // empty or link-only selection
		// snap-out to the zone grid (±HALF + k*GAP), then clamp to extents
		const floorZ = (v) => Math.floor((v - HALF) / GAP) * GAP + HALF;
		const ceilZ = (v) => Math.ceil((v - HALF) / GAP) * GAP + HALF;
		const x = Math.max(floorZ(minX - HALF), -ZONE_EXT.x);
		const y = Math.max(floorZ(minY - HALF), -ZONE_EXT.y);
		const x2 = Math.min(ceilZ(maxX + HALF), ZONE_EXT.x);
		const y2 = Math.min(ceilZ(maxY + HALF), ZONE_EXT.y);
		const box = { x, y, w: Math.max(x2 - x, GAP), h: Math.max(y2 - y, GAP) };
		const zone = this.model.makeZone(box);
		this.history.commit(commands.createEntity('zone', zone));
		this.selection.set([zone.id]);
		this.readout.flash(`zone ${this.readout.dims(box.w, box.h)}`);
	}

	/*
	C — close / open the lone selected route. A closed route loops dst → src as a rounded
	polygon (the router's close arg rounds the src/dst corners too). Only a multi-hop route
	(≥1 waypoint) can close — a plain 2-point link would just double back on itself. Toggles,
	as one undoable set on the link's `closed` flag.
	*/
	toggleClosePath() {
		const ids = this.selection.list();
		if (ids.length !== 1 || kindOf(ids[0]) !== 'link') return;
		const link = this.model.get('link', ids[0]);
		if (!link) return;
		if (!Array.isArray(link.via) || link.via.length < 1) {
			this.readout.flash('✗ close needs a multi-hop route');
			return;
		}
		const closed = !link.closed;
		this.history.commit({
			label: closed ? 'close path' : 'open path',
			entries: [{ op: 'set', kind: 'link', id: link.id, before: { closed: !!link.closed }, after: { closed } }]
		});
		this.readout.flash(closed ? 'path closed' : 'path open');
	}

	/*
	L / Shift+L — wire the selected nodes with no pointer travel. L chains them in
	selection order (n1-n2, n2-n3, ...); Shift+L stars the first-selected to every
	other. Existing pairs are skipped (no duplicate); the whole batch is one undo step.
	*/
	linkSelectedNodes(star) {
		const nodes = this.selection.selectedNodes(); // Set insertion order
		if (nodes.length < 2) return;
		const pairs = star
			? nodes.slice(1).map((n) => [nodes[0], n])
			: nodes.slice(0, -1).map((n, i) => [n, nodes[i + 1]]);
		const created = [];
		pairs.forEach(([a, b]) => {
			if (a === b || this.model.linkBetween(a, b)) return; // skip self + existing
			const link = this.model.makeLink(a, b);
			this.model.put('link', link); // put now so the next id can't collide
			created.push(link);
		});
		if (created.length === 0) return;
		// entities are already in the model; the command re-puts them idempotently
		this.history.commit({
			label: star ? 'star' : 'chain',
			entries: created.map((l) => ({ op: 'put', kind: 'link', entity: { ...l } }))
		});
		this.selection.set(created.map((l) => l.id));
		this.readout.flash(`+${created.length} link${created.length > 1 ? 's' : ''}`);
	}

	// ---- pointer move ----
	// a node already on this exact grid point (a stamp must never overlap) — engine occupancy index (R13)
	occupied(p) {
		return this.model.occupiedAt(p);
	}

	// stamp the held type at the snapped cell; refuses occupied cells
	stampAt(pos) {
		const type = this.palette.hand;
		if (!type) return false;
		const snapped = snapNode(pos);
		if (type === 'waypoint') {
			if (this.occupiedAny(snapped)) return false;
			const wp = this.model.makeWaypoint(snapped);
			this.history.commit(commands.createEntity('waypoint', wp));
			this.selection.set([wp.id]);
			this.focusId = wp.id;
			return true;
		}
		if (this.occupied(snapped)) return false;
		const node = this.model.makeNode(type, snapped);
		this.history.commit(commands.createEntity('node', node));
		this.selection.set([node.id]); // the hand stays armed; selection follows
		this.focusId = node.id;
		return true;
	}

	// a cell already holding a node OR a waypoint (a waypoint must not stack on either) — index (R13)
	occupiedAny(p) {
		return this.model.occupiedAnyAt(p);
	}

	// a waypoint with no link referencing it (endpoint or via) — free to become a link end / bend
	waypointFree(id) { return this.model.linksAt(id).length === 0; }

	// a valid link endpoint under the cursor: a node, or a FREE waypoint (occupied ones can't take a link)
	endpointAt(pos) {
		const n = this.nodeAt(pos);
		if (n) return n;
		return this.model.all('waypoint').find((w) => dist(w, pos) <= NODE_R && this.waypointFree(w.id)) || null;
	}

	// stamp-hand occupied check: a waypoint needs an empty cell (no node OR waypoint); a node only no node
	handBlocked(snapped) {
		if (!this.palette.hand) return false;
		return this.palette.hand === 'waypoint' ? this.occupiedAny(snapped) : this.occupied(snapped);
	}

	// 'w' when idle: drop a standalone waypoint at the snapped cursor cell (empty cells only)
	placeWaypoint() {
		if (!this.lastPos) return false;
		const snapped = snapNode(this.lastPos);
		if (this.occupiedAny(snapped)) return false;
		const wp = this.model.makeWaypoint(snapped);
		this.history.commit(commands.createEntity('waypoint', wp));
		this.selection.set([wp.id]);
		this.focusId = wp.id;
		return true;
	}

	// 'w' during a link draw: add the snapped cell to the in-progress route — a new waypoint on an
	// empty cell (materialised live so it renders; folded into the commit), or thread an existing one.
	dropRouteWaypoint() {
		if (!this.lastPos) return;
		const snapped = snapNode(this.lastPos);
		const existing = this.model.waypointAt(snapped);   // engine occupancy index (R13)
		if (existing) {
			if (existing.id === this.ctx.src.id) return;        // don't thread the source itself
			if (!this.waypointFree(existing.id)) return;        // occupied by another link
			if (!this.ctx.via.includes(existing.id)) this.ctx.via.push(existing.id);
		} else {
			if (this.occupied(snapped)) return;        // a node cell — refuse
			const wp = this.model.makeWaypoint(snapped);
			this.model.put('waypoint', wp);            // live (visible); committed on release
			this.ctx.via.push(wp.id);
			this.ctx.placed.push(wp);
		}
		this.updateLinkPreview(this.lastPos);
	}

	// the live route preview: a rounded polyline through src → threaded waypoints → cursor/target
	updateLinkPreview(pos) {
		const target = this.endpointAt(pos);
		const end = target ? { x: target.x, y: target.y } : snapNode(pos);
		const via = (this.ctx.via || []).map((id) => this.model.get('waypoint', id)).filter(Boolean);
		const pts = [[this.ctx.src.x, this.ctx.src.y], ...via.map((w) => [w.x, w.y]), [end.x, end.y]];
		this.ctx.path.update(roundedPath(pts, BEND_R));
	}

	// commit a finished route: the materialised waypoints + the link (with via) as ONE undo step
	commitRoute(ctx, dstId, via) {
		const link = { ...this.model.makeLink(ctx.src.id, dstId), ...(via && via.length ? { via: [...via] } : {}) };
		this.model.put('link', link);
		const entries = [
			...(ctx.placed || []).map((wp) => ({ op: 'put', kind: 'waypoint', entity: { ...wp } })),
			{ op: 'put', kind: 'link', entity: { ...link } }
		];
		this.history.commit({ label: via && via.length ? 'route' : 'link', entries });
		this.selection.set([link.id]);
	}

	// abandon an in-progress route: drop any waypoints placed during this draw
	cleanupRoute(ctx) {
		[...(ctx.placed || [])].reverse().forEach((wp) => this.model.del('waypoint', wp.id));
	}

	onMove(evt) {
		this.syncZoneGrid(evt);
		const pos = toCanvas(evt, this.svg);
		this.lastPos = pos;
		if (!this.mode) {
			const snapped = snapNode(pos);
			const blocked = this.handBlocked(snapped);
			this.palette.trackHand(snapped, blocked);
			this.readout.setCursor(snapped, this.palette.hand, blocked);
			return this.idleAffordance(evt);
		}

		if (this.mode === 'pending') {
			if (!this.readOnly && dist(pos, this.ctx.start) > DRAG_THRESHOLD && this.ctx.hit.kind !== 'link') {
				this.startMove(pos);
				// re-evaluate the layer indicator and render the first frame now
				// that the mode is 'move' (not on the next event)
				if (this.mode === 'move') {
					this.syncZoneGrid(evt);
					this.updateMove(pos, evt.shiftKey);
				}
			}
			return;
		}
		if (this.mode === 'clone-pending') {
			if (dist(pos, this.ctx.start) > DRAG_THRESHOLD) {
				this.startClone(pos);
				if (this.mode === 'clone') {
					this.syncZoneGrid(evt);
					this.updateMove(pos, evt.shiftKey);
				}
			}
			return;
		}
		if (this.mode === 'move' || this.mode === 'clone') {
			this.updateMove(pos, evt.shiftKey);
			return;
		}
		if (this.mode === 'link') {
			const target = this.endpointAt(pos);
			this.updateLinkPreview(pos);
			if (this.ctx.target && (!target || target.id !== this.ctx.target)) {
				this.renderer.setState(this.ctx.target, 'hover', false);
				this.ctx.target = null;
			}
			if (target && target.id !== this.ctx.src.id) {
				this.ctx.target = target.id;
				this.renderer.setState(target.id, 'hover', true);
			}
			this.readout.setLink(this.ctx.src.name || '?',
				(target && target.id !== this.ctx.src.id) ? (target.name || '?') : snapNode(pos));
			return;
		}
		if (this.mode === 'replug') {
			// the fixed end is anchored; the dragged end follows the cursor / hovered node
			const target = this.nodeAt(pos);
			this.ctx.line.update(this.ctx.fixed, target || pos);
			if (this.ctx.target && (!target || target.id !== this.ctx.target)) {
				this.renderer.setState(this.ctx.target, 'hover', false);
				this.ctx.target = null;
			}
			if (target && target.id !== this.ctx.fixedId) {
				this.ctx.target = target.id;
				this.renderer.setState(target.id, 'hover', true);
			}
			this.readout.setLink(this.ctx.fixed.name || '?',
				(target && target.id !== this.ctx.fixedId) ? (target.name || '?') : snapNode(pos));
			return;
		}
		if (this.mode === 'zone') {
			const box = resolveBox(this.ctx.p1, snapZone(pos));
			this.ctx.rect.update(box);
			this.readout.setBox(box);
			return;
		}
		if (this.mode === 'textbox') {
			const box = frameSpan(this.ctx.p1, snapNode(pos));
			this.ctx.rect.update(box);
			this.readout.setBox(box);
			return;
		}
		if (this.mode === 'marquee') {
			this.ctx.rect.update(resolveBox(this.ctx.p1, pos));
			return;
		}
		if (this.mode === 'resize') {
			const box = this.resizeBox(pos, this.ctx.anchor);
			this.model.set('zone', this.ctx.zone, box);
			this.readout.setBox(box);
		}
	}

	/*
	Live move/clone update — the single source of the rendered position.
	Ortho lock: Shift held constrains to the dominant axis (AutoCAD ORTHO).
	Press-time Shift belongs to press semantics (zone layer, selection-add):
	the lock arms only once Shift has been seen released during the drag.
	ctx.orthoActive records the flag of the LAST rendered frame; the commit
	must use it (never re-sample at release) so preview and commit agree even
	when Shift changes state while the pointer is stationary.
	*/
	updateMove(pos, shiftHeld) {
		if (!shiftHeld) this.ctx.orthoReady = true;
		const ortho = !!shiftHeld && !!this.ctx.orthoReady;
		this.ctx.orthoActive = ortho;
		const rawDelta = this.orthoDelta(
			{ x: pos.x - this.ctx.start.x, y: pos.y - this.ctx.start.y }, ortho);
		// clamp live: out-of-bounds coordinates must never reach the model
		const delta = this.clampDelta(this.ctx.moved, rawDelta);
		this.ctx.moved.forEach((m) => {
			this.model.set(m.kind, m.id, {
				x: m.before.x + delta.x,
				y: m.before.y + delta.y
			});
		});
		const anchor = this.ctx.moved.find((m) => m.id === this.ctx.anchorId) || this.ctx.moved[0];
		const raw = { x: anchor.before.x + delta.x, y: anchor.before.y + delta.y };
		const target = anchor.kind === 'zone' ? snapZone(raw) : snapNode(raw);   // node + waypoint → node grid
		this.snap.show(target);
		this.readout.setDrag(target, {
			x: (target.x - anchor.before.x) / GAP,
			y: (target.y - anchor.before.y) / GAP
		});
	}

	resizeBox(pos, anchor) {
		const corner = snapZone(pos); // already clamped to the canvas
		// enforce minimum one cell, pushing toward the canvas interior when the
		// anchor sits on an edge (a blind push would be clamped back to w/h = 0)
		if (Math.abs(corner.x - anchor.x) < MIN_ZONE) {
			const dir = corner.x >= anchor.x ? 1 : -1;
			corner.x = anchor.x + dir * MIN_ZONE;
			if (corner.x < -ZONE_EXT.x || corner.x > ZONE_EXT.x) corner.x = anchor.x - dir * MIN_ZONE;
		}
		if (Math.abs(corner.y - anchor.y) < MIN_ZONE) {
			const dir = corner.y >= anchor.y ? 1 : -1;
			corner.y = anchor.y + dir * MIN_ZONE;
			if (corner.y < -ZONE_EXT.y || corner.y > ZONE_EXT.y) corner.y = anchor.y - dir * MIN_ZONE;
		}
		const box = resolveBox(anchor, corner);
		return { x: box.x, y: box.y, w: box.w, h: box.h };
	}

	// crosshair cursor + ring emphasis when idle over a node: left-drag draws a link
	idleAffordance(evt) {
		const hit = this.hit(evt);
		if (hit.kind !== 'node') return;
		this.renderer.setState(hit.id, 'linkband', !evt.ctrlKey && !evt.altKey);
	}

	// ---- pointer up ----
	onUp(evt) {
		if (!this.mode) return;
		// only the left button drives link mode: a right-button release during a
		// chain (chord delete, stray right-click) must never commit a segment
		if (this.mode === 'link' && evt.button !== 0) return;
		const pos = toCanvas(evt, this.svg);
		const mode = this.mode;
		const ctx = this.ctx;
		this.mode = null;
		this.ctx = {};
		this.readout.clearTransient();
		this.refreshHover(pos);
		this.syncZoneGrid(evt); // gesture over: layer indicator follows Shift again

		if (mode === 'pending') return;
		if (mode === 'clone-pending') {
			// Ctrl+click without drag: toggle selection (draw.io behavior)
			if (this.model.get(ctx.hit.kind, ctx.hit.id)) {
				this.selection.toggle(ctx.hit.id);
				this.focusId = ctx.hit.id;
			}
			return;
		}
		if (mode === 'move') {
			this.snap.hide();
			// commit with the flag of the last RENDERED frame, never re-sampled:
			// Shift may have changed state since with the pointer stationary
			this.commitMove(ctx, pos, ctx.orthoActive);
			return;
		}
		if (mode === 'clone') {
			this.snap.hide();
			this.commitClone(ctx, pos, ctx.orthoActive);
			return;
		}
		if (mode === 'link') {
			ctx.path.remove();
			if (ctx.target) this.renderer.setState(ctx.target, 'hover', false);
			const target = this.endpointAt(pos);
			const srcAlive = this.model.endpointOf(ctx.src.id);
			const hasVia = !!(ctx.via && ctx.via.length);
			// a valid endpoint under the cursor: a node / free waypoint, distinct from src, not a via bend
			const validTarget = srcAlive && target && target.id !== ctx.src.id && !(ctx.via || []).includes(target.id);
			// resolve the destination: the endpoint under the cursor, ELSE end at the LAST dropped
			// waypoint — so releasing after `w` commits the route, terminating at that waypoint
			let dst = validTarget ? target.id : null;
			let via = [...(ctx.via || [])];
			if (!dst && via.length) dst = via.pop();
			if (dst && srcAlive && dst !== ctx.src.id && !this.model.linkBetween(ctx.src.id, dst)) {
				this.commitRoute(ctx, dst, via);     // placed waypoints + the link, one undo step
				if (validTarget && evt.shiftKey && !hasVia) { this.chainFrom(target, pos); return; } // chain only plain links
				return;
			}
			if (validTarget && evt.shiftKey && !hasVia) {
				// already-linked target: skip the duplicate but keep the chain run alive
				this.chainFrom(target, pos);
				return;
			}
			if (srcAlive && !hasVia && dist(pos, ctx.start) <= DRAG_THRESHOLD) {
				const hand = this.palette.hand;
				// fast-replace gate mirrors the stamp gate (plain click only) and
				// never fires on a chain anchor (that click ends the run, selecting)
				if (this.model.get('node', ctx.src.id) && hand && hand !== 'waypoint' && !ctx.chained
					&& !evt.shiftKey && !evt.ctrlKey && !evt.altKey && hand !== ctx.src.type) {
					// fast-replace: retype in place — id/name/links/position survive
					this.history.commit({
						label: 'retype',
						entries: [{ op: 'set', kind: 'node', id: ctx.src.id,
							before: { type: ctx.src.type }, after: { type: hand } }]
					});
					this.selection.set([ctx.src.id]);
					this.focusId = ctx.src.id;
					return;
				}
				// a no-drag press is still a click: select (mirrors beginPress semantics)
				this.focusId = ctx.src.id;
				if (ctx.shift) this.selection.toggle(ctx.src.id);
				else if (!this.selection.has(ctx.src.id)) this.selection.set([ctx.src.id]);
				return;
			}
			// invalid target, duplicate, or route released off a node: discard placed waypoints
			this.cleanupRoute(ctx);
			return;
		}
		if (mode === 'replug') {
			ctx.line.remove();
			if (ctx.target) this.renderer.setState(ctx.target, 'hover', false);
			this.renderer.setState(ctx.linkId, 'replugging', false);
			const link = this.model.get('link', ctx.linkId);
			const target = this.nodeAt(pos);
			if (link && target && target.id !== ctx.fixedId) {
				const newSrc = ctx.end === 'src' ? target.id : link.src;
				const newDst = ctx.end === 'dst' ? target.id : link.dst;
				const wasAt = ctx.end === 'src' ? ctx.before.src : ctx.before.dst;
				// commit only a genuine, non-duplicate retarget; else leave the link as-is
				if (target.id !== wasAt && !this.model.linkBetween(newSrc, newDst)) {
					this.history.commit({
						label: 'replug',
						entries: [{ op: 'set', kind: 'link', id: ctx.linkId,
							before: { src: ctx.before.src, dst: ctx.before.dst },
							after: { src: newSrc, dst: newDst } }]
					});
				}
			}
			this.refreshHandles(); // handles ride the (possibly new) endpoints
			return;
		}
		if (mode === 'zone') {
			ctx.rect.remove();
			const box = resolveBox(ctx.p1, snapZone(pos));
			if (box.w > 0 && box.h > 0) {
				const zone = this.model.makeZone(box);
				this.history.commit(commands.createEntity('zone', zone));
				this.selection.set([zone.id]);
			}
			return;
		}
		if (mode === 'textbox') {
			ctx.rect.remove();
			const f = frameSpan(ctx.p1, snapNode(pos));   // anchor + span counts (a click → 1×1)
			const tb = this.model.makeTextBox(f.anchor, { cols: f.cols, rows: f.rows });
			this.history.commit(commands.createEntity('node', tb));
			this.selection.set([tb.id]);
			this.textTool = false; this.svg.classList.remove('texttool');   // one box per arm — disarm, then re-tap 't' for another
			// open the inline editor on the text region, positioned over the new box's frame
			const frameEl = this.svg.ownerDocument.getElementById(tb.id);
			if (frameEl) this.labels.openContent(tb.id, 0, frameEl.querySelector('[data-layer="frame"]') || frameEl);
			return;
		}
		if (mode === 'marquee') {
			ctx.rect.remove();
			const box = resolveBox(ctx.p1, pos);
			if (box.w < DRAG_THRESHOLD && box.h < DRAG_THRESHOLD) {
				// a plain click with a held hand stamps at the snapped cell
				// (an occupied-cell refusal still consumes the click: it meant
				// "stamp", never "deselect")
				if (this.palette.hand && !evt.shiftKey && !evt.ctrlKey && !evt.altKey) {
					this.stampAt(pos);
					this.refreshHand(); // the cell is occupied now: feedback must say so
					return;
				}
				if (!evt.shiftKey) this.selection.clear();
				return;
			}
			// zones are not marquee-pickable (Shift layer); select them directly
			const picked = [];
			this.model.all('node').forEach((n) => { if (footprintHits(n, box)) picked.push(n.id); });   // span-aware: marquee over a box's body selects it
			this.model.all('waypoint').forEach((w) => { if (pointInBox(w, box)) picked.push(w.id); });
			// a link comes along when BOTH its endpoints (node or waypoint) are inside the box
			const inBox = new Set(picked);
			this.model.all('link').forEach((l) => {
				if (inBox.has(l.src) && inBox.has(l.dst)) picked.push(l.id);
			});
			evt.shiftKey ? this.selection.add(picked) : this.selection.set(picked);
			return;
		}
		if (mode === 'resize') {
			const after = this.resizeBox(pos, ctx.anchor);
			const before = ctx.before;
			this.model.set('zone', ctx.zone, { ...before });
			if (after.x === before.x && after.y === before.y && after.w === before.w && after.h === before.h) return;
			this.history.commit({
				label: 'resize',
				entries: [{ op: 'set', kind: 'zone', id: ctx.zone, before, after }]
			});
		}
	}

	// re-enter link mode from a node (chain wiring), with live readout
	chainFrom(node, pos) {
		this.mode = 'link';
		this.ctx = { src: node, path: previewPath(this.overlay), target: null, start: pos, shift: false, chained: true, via: [], placed: [] };
		this.updateLinkPreview(pos);
		this.readout.setLink(node.name || '?', snapNode(pos));
	}

	commitMove(ctx, pos, ortho) {
		ctx.moved = ctx.moved.filter((m) => this.model.get(m.kind, m.id));
		if (ctx.moved.length === 0) return;
		const delta = this.snappedDelta(ctx, pos, ortho);
		const moves = ctx.moved.map((m) => ({
			kind: m.kind, id: m.id,
			before: m.before,
			after: { x: m.before.x + delta.x, y: m.before.y + delta.y }
		}));
		// restore originals first so the command transition is exact (live drag mutated state)
		moves.forEach((m) => this.model.set(m.kind, m.id, { x: m.before.x, y: m.before.y }));
		if (delta.x === 0 && delta.y === 0) return;
		this.history.commit(commands.moveEntities(moves));
		this.lastDelta = delta; // the demonstrated pitch feeds Ctrl+D
	}

	commitClone(ctx, pos, ortho) {
		ctx.moved = ctx.moved.filter((m) => this.model.get(m.kind, m.id));
		const delta = ctx.moved.length ? this.snappedDelta(ctx, pos, ortho) : { x: 0, y: 0 };
		ctx.moved.forEach((m) => {
			this.model.set(m.kind, m.id, { x: m.before.x + delta.x, y: m.before.y + delta.y });
		});
		if (delta.x !== 0 || delta.y !== 0) this.lastDelta = delta; // pitch for Ctrl+D
		// entities now carry final positions; the command snapshots them as puts
		const clones = ctx.clones.filter((c) => this.model.get(c.kind, c.entity.id))
			.map((c) => ({ kind: c.kind, entity: { ...this.model.get(c.kind, c.entity.id) } }));
		this.history.commit(commands.cloneEntities(clones));
		// the commit re-puts the clones, rebuilding their DOM: re-apply selection visuals
		this.afterHistory();
	}

	// zero the minor axis of a delta when the ortho lock is engaged
	orthoDelta(delta, ortho) {
		if (!ortho) return delta;
		return Math.abs(delta.x) >= Math.abs(delta.y)
			? { x: delta.x, y: 0 }
			: { x: 0, y: delta.y };
	}

	snappedDelta(ctx, pos, ortho) {
		const anchor = ctx.moved.find((m) => m.id === ctx.anchorId) || ctx.moved[0];
		const rawDelta = this.orthoDelta({ x: pos.x - ctx.start.x, y: pos.y - ctx.start.y }, ortho);
		const anchorRaw = { x: anchor.before.x + rawDelta.x, y: anchor.before.y + rawDelta.y };
		const anchorSnapped = anchor.kind === 'zone' ? snapZone(anchorRaw) : snapNode(anchorRaw);
		return this.clampDelta(ctx.moved, { x: anchorSnapped.x - anchor.before.x, y: anchorSnapped.y - anchor.before.y });
	}

	// clamp a delta so every moved entity stays on the canvas
	clampDelta(moved, delta) {
		let minX = -Infinity, maxX = Infinity, minY = -Infinity, maxY = Infinity;
		moved.forEach((m) => {
			if (m.kind === 'node' || m.kind === 'waypoint') {
				// clamp the FOOTPRINT: the anchor stays ≥ -EXT and the far cell (anchor + span) stays ≤ +EXT
				const n = m.kind === 'node' ? this.model.get('node', m.id) : null;
				const { sw, sh } = n ? spanExt(n) : { sw: 0, sh: 0 };
				minX = Math.max(minX, -NODE_EXT.x - m.before.x); maxX = Math.min(maxX, NODE_EXT.x - sw - m.before.x);
				minY = Math.max(minY, -NODE_EXT.y - m.before.y); maxY = Math.min(maxY, NODE_EXT.y - sh - m.before.y);
			} else {
				const entity = this.model.get('zone', m.id);
				if (!entity) return;
				minX = Math.max(minX, -ZONE_EXT.x - m.before.x); maxX = Math.min(maxX, ZONE_EXT.x - entity.w - m.before.x);
				minY = Math.max(minY, -ZONE_EXT.y - m.before.y); maxY = Math.min(maxY, ZONE_EXT.y - entity.h - m.before.y);
			}
		});
		const clampAxis = (v, lo, hi) => {
			if (v < lo) return Math.ceil(lo / GAP) * GAP;
			if (v > hi) return Math.floor(hi / GAP) * GAP;
			return v;
		};
		return {
			x: clampAxis(delta.x, minX, maxX),
			y: clampAxis(delta.y, minY, maxY)
		};
	}

	cancelDrag(evt) {
		if (this.mode === 'move') {
			this.ctx.moved.forEach((m) => this.model.set(m.kind, m.id, { x: m.before.x, y: m.before.y }));
			this.snap.hide();
		}
		if (this.mode === 'clone') {
			// uncommitted clones vanish entirely
			[...this.ctx.clones].reverse().forEach((c) => this.model.del(c.kind, c.entity.id));
			this.selection.clear();
			this.snap.hide();
		}
		if (this.mode === 'link') {
			if (this.ctx.path) this.ctx.path.remove();
			if (this.ctx.target) this.renderer.setState(this.ctx.target, 'hover', false);
			this.cleanupRoute(this.ctx);
		}
		if (this.mode === 'replug') {
			// a cancelled re-plug is a no-op: drop the preview, restore the real line
			this.ctx.line.remove();
			if (this.ctx.target) this.renderer.setState(this.ctx.target, 'hover', false);
			this.renderer.setState(this.ctx.linkId, 'replugging', false);
		}
		if (this.mode === 'zone' || this.mode === 'marquee' || this.mode === 'textbox') this.ctx.rect.remove();
		if (this.mode === 'resize') {
			// a cancelled gesture is a no-op: restore the pre-drag geometry
			this.model.set('zone', this.ctx.zone, { ...this.ctx.before });
		}
		this.mode = null;
		this.ctx = {};
		this.readout.clearTransient();
		this.refreshHover(null);
		if (evt) this.syncZoneGrid(evt); // layer indicator follows Shift again
	}

	// ---- hover + arming ----
	onHover(evt, on) {
		if (this.isGesturing()) return;
		const hit = this.hit(evt);
		if (!hit.id || hit.kind === 'handle') return;
		this.renderer.setState(hit.id, 'hover', on);
		if (!on) this.renderer.setState(hit.id, 'linkband', false);
		this.hovered = on ? hit.id : (this.hovered === hit.id ? null : this.hovered);
		this.updateArming(evt);
	}

	refreshHover(pos) {
		if (!this.hovered) return this.disarm();
		const id = this.hovered;
		const ent = this.model.get(kindOf(id), id);
		// a node stays hovered anywhere within its FOOTPRINT; a waypoint stays within its radius
		const still = pos && ent && ent.x !== undefined && (kindOf(id) === 'node' ? inFootprint(ent, pos, NODE_R) : dist(ent, pos) <= NODE_R);
		if (!still) {
			this.renderer.clearState(id, 'hover', 'linkband');
			this.hovered = null;
		}
		this.disarm();
	}

	// Alt arms red (delete), Ctrl arms blue (clone) on the hovered entity
	updateArming(evt) {
		this.disarm();
		if (this.readOnly || !this.hovered || this.isGesturing()) return;
		const kind = kindOf(this.hovered);
		if (evt.altKey) {
			this.armed = { id: this.hovered, cls: 'armed' };
		} else if (evt.ctrlKey && (kind === 'node' || kind === 'zone')) {
			this.armed = { id: this.hovered, cls: 'armed-clone' };
		}
		if (this.armed) this.renderer.setState(this.armed.id, this.armed.cls, true);
	}

	disarm() {
		if (!this.armed) return;
		this.renderer.clearState(this.armed.id, 'armed', 'armed-clone');
		this.armed = null;
	}

	syncZoneGrid(evt) {
		// ortho-lock owns Shift mid-move/clone: no zone-grid flash during those drags
		const moving = this.mode === 'move' || this.mode === 'clone';
		this.svg.classList.toggle('zonegrid', !!evt.shiftKey && !moving);
	}

	// after a hand change at idle: ghost and readout reflect it immediately
	refreshHand() {
		if (this.mode || !this.lastPos) return;
		const snapped = snapNode(this.lastPos);
		const blocked = this.handBlocked(snapped);
		if (this.palette.hand) this.palette.trackHand(snapped, blocked);
		this.readout.setCursor(snapped, this.palette.hand, blocked);
	}

	// datum marker: a small diamond-cross on the snap layer (pointer-inert)
	setDatumMarker(pos) {
		if (this.datumEl) {
			this.datumEl.remove();
			this.datumEl = null;
		}
		if (!pos) return;
		this.datumEl = el('path', {
			class: 'datum',
			d: 'M 0 -8 L 8 0 L 0 8 L -8 0 Z M 0 -13 L 0 -8 M 0 8 L 0 13 M -13 0 L -8 0 M 8 0 L 13 0',
			transform: `translate(${pos.x},${pos.y})`
		}, this.svg.querySelector('#snaplayer'));
	}

	// ---- handles: zone corners (resize) and link endpoints (re-plug) ----
	refreshHandles() {
		this.overlay.querySelectorAll('.handle').forEach((h) => h.remove());
		const ids = this.selection.list();
		if (ids.length !== 1) return;
		const id = ids[0];
		const size = 12;

		if (kindOf(id) === 'link') {
			const link = this.model.get('link', id);
			const src = link && this.model.get('node', link.src);
			const dst = link && this.model.get('node', link.dst);
			if (!src || !dst) return;
			// sit each handle on the line, just outside its node (clear of the icon)
			const d = dist(src, dst) || 1;
			const off = Math.min(NODE_R + 6, d * 0.4);
			const ux = (dst.x - src.x) / d, uy = (dst.y - src.y) / d;
			const ends = {
				src: { x: src.x + ux * off, y: src.y + uy * off },
				dst: { x: dst.x - ux * off, y: dst.y - uy * off }
			};
			Object.entries(ends).forEach(([end, p]) => {
				const handle = el('rect', {
					class: 'handle', width: size, height: size,
					x: p.x - size / 2, y: p.y - size / 2, rx: 6
				}, this.overlay);
				handle.dataset.end = end;
			});
			return;
		}

		if (kindOf(id) !== 'zone') return;
		const zone = this.model.get('zone', id);
		if (!zone) return;
		const corners = {
			nw: { x: zone.x, y: zone.y },
			ne: { x: zone.x + zone.w, y: zone.y },
			sw: { x: zone.x, y: zone.y + zone.h },
			se: { x: zone.x + zone.w, y: zone.y + zone.h }
		};
		Object.entries(corners).forEach(([corner, p]) => {
			const handle = el('rect', {
				class: 'handle', width: size, height: size,
				x: p.x - size / 2, y: p.y - size / 2, rx: 2
			}, this.overlay);
			handle.dataset.corner = corner;
		});
	}

	// ---- label editing ----
	onDblClick(evt) {
		// hit GEOMETRICALLY: pointer capture (taken on every press) retargets the
		// browser-synthesized dblclick to the svg, so evt.target is useless here.
		// Icon hits beat label-strip hits; nearest wins; ties go to the topmost
		// (last-rendered) — the strip is wider than a grid cell, so first-match
		// would resolve to a NEIGHBOUR for nodes one cell apart
		const pos = toCanvas(evt, this.svg);
		if (this.readOnly) return; // no editing while Server-Locked
		// A1 — a TEXT BOX is hit by its whole FOOTPRINT (not just the anchor cell), so double-clicking ANYWHERE
		// on the box edits its text. (A plain node / panel still routes to the name-edit / icon test below.)
		const tbs = this.model.all('node').filter((n) => Array.isArray(n.content) && n.content.length === 1 && n.content[0].content === 'text'
			&& pos.x >= n.x - NODE_R && pos.x <= n.x + (n.span ? (n.span.cols - 1) * GAP : 0) + NODE_R
			&& pos.y >= n.y - NODE_R && pos.y <= n.y + (n.span ? (n.span.rows - 1) * GAP : 0) + NODE_R);
		const tb = tbs[tbs.length - 1]; // topmost (last-rendered)
		if (tb) {
			if (this.mode) this.cancelDrag(evt);
			this.selection.set([tb.id]);
			this.focusId = tb.id;
			const g = this.svg.ownerDocument.getElementById(tb.id);
			return this.labels.openContent(tb.id, 0, (g && g.querySelector('[data-layer="frame"]')) || g);
		}
		const nodes = this.model.all('node');
		const best = (cands) => cands.sort((p, q) => p.d - q.d || q.i - p.i)[0];
		const icon = best(nodes.map((n, i) => ({ n, d: dist(n, pos), i }))
			.filter((c) => c.d <= NODE_R + 4));
		const strip = icon ? null : best(nodes.map((n, i) => ({ n, d: Math.abs(pos.x - n.x), i }))
			.filter((c) => c.d <= 75 && pos.y - c.n.y >= NODE_R && pos.y - c.n.y <= NODE_R + 28));
		const node = (icon || strip) && (icon || strip).n;
		let target = node ? { kind: 'node', id: node.id } : null;
		if (!target) {
			const zones = this.model.all('zone').filter((z) =>
				pointInBox(pos, { x: z.x, y: z.y, w: z.w, h: z.h }));
			const zone = zones[zones.length - 1]; // topmost
			if (zone) target = { kind: 'zone', id: zone.id };
		}
		if (!target) return;
		if (this.readOnly) return; // no rename while Server-Locked
		if (this.mode) this.cancelDrag(evt);
		// rename implies selection: handles/readout/F2 follow the edited entity
		this.selection.set([target.id]);
		this.focusId = target.id;
		this.labels.open(target.kind, target.id);   // name edit (text boxes are handled by the footprint check above)
	}

	// ---- arrow nudge (coalesced into one undo step per burst) ----
	nudge(dx, dy) {
		const moved = [];
		this.selection.list().forEach((id) => {
			const kind = kindOf(id);
			if (kind !== 'node' && kind !== 'zone' && kind !== 'waypoint') return;
			const entity = this.model.get(kind, id);
			if (entity) moved.push({ kind, id, before: { x: entity.x, y: entity.y } });
		});
		if (moved.length === 0) return;
		const delta = this.clampDelta(moved, { x: dx * GAP, y: dy * GAP });
		if (delta.x === 0 && delta.y === 0) return;

		const now = Date.now();
		const top = this.history.stack[this.history.index - 1];
		const sameSet = this.lastNudge && top === this.lastNudge.cmd
			&& top.entries.length === moved.length
			&& moved.every((m) => top.entries.some((e) => e.id === m.id && e.kind === m.kind));
		if (sameSet && now - this.lastNudge.t < NUDGE_COALESCE_MS) {
			this.lastNudge.cmd.entries.forEach((entry) => {
				entry.after = { x: entry.after.x + delta.x, y: entry.after.y + delta.y };
				this.model.set(entry.kind, entry.id, entry.after);
			});
			this.lastNudge.t = now;
			return;
		}
		const cmd = commands.moveEntities(moved.map((m) => ({
			kind: m.kind, id: m.id, before: m.before,
			after: { x: m.before.x + delta.x, y: m.before.y + delta.y }
		})));
		this.history.commit(cmd);
		this.lastNudge = { t: now, cmd };
	}

	// ---- Shift+arrow: grow/shrink the lone selected zone one cell, NW-anchored ----
	resizeZoneByKey(dx, dy) {
		const ids = this.selection.list();
		if (ids.length !== 1 || kindOf(ids[0]) !== 'zone') return; // single-zone only
		const zone = this.model.get('zone', ids[0]);
		if (!zone) return;
		const before = { x: zone.x, y: zone.y, w: zone.w, h: zone.h };
		// NW corner fixed; minimum one cell; clamped to the canvas
		const w = Math.min(Math.max(zone.w + dx * GAP, GAP), ZONE_EXT.x - zone.x);
		const h = Math.min(Math.max(zone.h + dy * GAP, GAP), ZONE_EXT.y - zone.y);
		if (w === before.w && h === before.h) return;
		const after = { x: zone.x, y: zone.y, w, h };

		// coalesce a burst into one undo step (mirrors nudge)
		const now = Date.now();
		const top = this.history.stack[this.history.index - 1];
		const sameZone = this.lastResize && top === this.lastResize.cmd
			&& top.entries.length === 1 && top.entries[0].id === zone.id;
		if (sameZone && now - this.lastResize.t < NUDGE_COALESCE_MS) {
			top.entries[0].after = after; // before stays the original geometry
			this.model.set('zone', zone.id, after);
			this.lastResize.t = now;
			return;
		}
		const cmd = { label: 'resize', entries: [{ op: 'set', kind: 'zone', id: zone.id, before, after }] };
		this.history.commit(cmd);
		this.lastResize = { t: now, cmd };
	}

	// ---- Shift+arrow: grow/shrink the lone selected NODE's span one cell (anchor fixed, +col/+row) ----
	// The multi-cell authoring gesture (W1). Mirrors resizeZoneByKey: anchor (NW) fixed, min 1 cell, capped
	// at the validator's 64, coalesced into one undo step. content stays the glyph at the anchor cell.
	resizeNodeByKey(dx, dy) {
		const ids = this.selection.list();
		if (ids.length !== 1 || kindOf(ids[0]) !== 'node') return; // single-node only
		const node = this.model.get('node', ids[0]);
		if (!node) return;
		const cur = node.span || { cols: 1, rows: 1 };
		const before = { span: { cols: cur.cols, rows: cur.rows } };
		const cols = Math.min(Math.max(cur.cols + dx, 1), 64);
		const rows = Math.min(Math.max(cur.rows + dy, 1), 64);
		if (cols === cur.cols && rows === cur.rows) return;
		const after = { span: { cols, rows } };

		// coalesce a burst into one undo step (mirrors nudge / zone resize)
		const now = Date.now();
		const top = this.history.stack[this.history.index - 1];
		const sameNode = this.lastResize && top === this.lastResize.cmd
			&& top.entries.length === 1 && top.entries[0].id === node.id;
		if (sameNode && now - this.lastResize.t < NUDGE_COALESCE_MS) {
			top.entries[0].after = after; // before stays the original span
			this.model.set('node', node.id, after);
			this.lastResize.t = now;
			return;
		}
		const cmd = { label: 'resize', entries: [{ op: 'set', kind: 'node', id: node.id, before, after }] };
		this.history.commit(cmd);
		this.lastResize = { t: now, cmd };
	}

	// ---- help overlay ----
	toggleHelp(show) {
		if (!this.help) return;
		this.help.hidden = show === undefined ? !this.help.hidden : !show;
	}

	// ---- keyboard ----
	onKeyDown(evt) {
		// typing contexts (header menu, label editor) never reach canvas shortcuts
		const tag = evt.target.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

		if (evt.key === 'Shift') {
			if (this.mode === 'move' || this.mode === 'clone') {
				// re-render the drag NOW: the commit follows the last rendered frame
				if (this.lastPos) this.updateMove(this.lastPos, true);
			} else {
				this.svg.classList.add('zonegrid');
			}
		}
		if (evt.key === 'Alt') {
			evt.preventDefault(); // keep Firefox's menu bar out of the delete chord
			this.updateArming(evt);
		}
		if (evt.key === 'Control') this.updateArming(evt);

		// W4/W5 — interaction mode. 'e' toggles EDIT (shows the socket grid); 'r' toggles RUN (clickable
		// content regions act). Either key from its own mode returns to the clean VIEW.
		if ((evt.key === 'e' || evt.key === 'E') && !evt.ctrlKey && !evt.metaKey && !evt.altKey) {
			this.renderer.setMode(this.renderer.mode === 'edit' ? 'view' : 'edit');
			return;
		}
		if ((evt.key === 'r' || evt.key === 'R') && !evt.ctrlKey && !evt.metaKey && !evt.altKey) {
			this.renderer.setMode(this.renderer.mode === 'run' ? 'view' : 'run');
			return;
		}
		// A1 — tap 't' to ARM/disarm the text tool (a TOGGLE — you don't hold the key while you mouse;
		// auto-repeat ignored). Armed: a canvas drag draws a text box; drawing one (or Esc / re-tap) disarms.
		if ((evt.key === 't' || evt.key === 'T') && !evt.repeat && !evt.ctrlKey && !evt.metaKey && !evt.altKey) {
			this.textTool = !this.textTool;
			this.svg.classList.toggle('texttool', this.textTool);
			return;
		}
		// 's' — toggle the frame shape (circle <-> square) of the selected node(s)
		if ((evt.key === 's' || evt.key === 'S') && !evt.ctrlKey && !evt.metaKey && !evt.altKey) {
			if (this.readOnly) return;
			const cmd = commands.reshapeNodes(this.model, this.selection.list());
			if (cmd.entries.length) this.history.commit(cmd);
			return;
		}

		if (evt.key === 'Escape') {
			// priority: close help > cancel gesture > disarm text tool > clear hand > clear selection
			if (this.help && !this.help.hidden) return this.toggleHelp(false);
			if (this.mode) this.cancelDrag(evt);
			else if (this.textTool) { this.textTool = false; this.svg.classList.remove('texttool'); }
			else if (this.palette.hand) {
				this.palette.setHand(null);
				this.readout.setCursor(this.lastPos ? snapNode(this.lastPos) : null);
			} else this.selection.clear();
			return;
		}
		if (evt.key === '/' || evt.key === '?') {
			// the bare key toggles help — no Shift required
			evt.preventDefault(); // keep Firefox's quick-find out of it
			return this.toggleHelp();
		}
		// the open help overlay is keyboard-modal (Escape and ? handled above)
		if (this.help && !this.help.hidden) return;
		// Tab toggles the numeric data-view overlay — a read-only view, so it works
		// even mid-gesture (no model mutation). Claim it only when the canvas holds
		// focus: if a control is focused, let Tab/Shift+Tab traverse the toolbar
		if (evt.key === 'Tab') {
			const t = evt.target;
			const onControl = t && typeof t.closest === 'function'
				&& t.closest('button, a[href], select, input, textarea, [tabindex]');
			if (!onControl) {
				evt.preventDefault();
				this.dataview.toggle();
			}
			return;
		}
		// Server-Locked: Escape / help / Tab (handled above) stay; every mutation key
		// below is inert — the browser is read-only until control is reclaimed
		if (this.readOnly) return;
		// 'w' drops/threads a waypoint: during a link draw it adds a bend to the route (mouse stays
		// held — no button release); when idle it places a standalone waypoint. Handled BEFORE the
		// gesture guard below, since dropping a bend mid-draw is the whole point.
		if ((evt.key === 'w' || evt.key === 'W') && !evt.ctrlKey && !evt.metaKey && !evt.altKey) {
			if (this.mode === 'link') { evt.preventDefault(); this.dropRouteWaypoint(); return; }
			if (!this.mode) { evt.preventDefault(); this.placeWaypoint(); return; }
			return;
		}
		// no mutation shortcuts while a gesture is in flight: mid-drag the model holds
		// raw unsnapped coordinates, and history/delete would capture or corrupt them
		if (this.isGesturing()) return;

		if (evt.key === ' ') {
			// datum: a local origin for the readout (KiCad space-bar convention)
			evt.preventDefault();
			if (evt.shiftKey) {
				this.readout.setDatum(null);
				this.setDatumMarker(null);
				return;
			}
			if (!this.lastPos) return; // pointer off-canvas: nothing to anchor
			const datum = snapNode(this.lastPos);
			this.readout.setDatum(datum);
			this.setDatumMarker(datum);
			return;
		}
		// ---- stamp hand: digits arm a type, Q pipettes, Enter stamps at the ghost.
		// Idle-only (this.mode covers pending too): a held press owns the selection
		// and the pointer, so hand keys must not act under it ----
		if (!this.mode) {
			if (/^[1-7]$/.test(evt.key) && !evt.ctrlKey && !evt.metaKey && !evt.altKey) {
				this.palette.toggleHand(evt.key === '7' ? 'waypoint' : NODE_TYPES[Number(evt.key) - 1]);
				this.refreshHand();
				return;
			}
			if (evt.key === 'q' || evt.key === 'Q') {
				// pipette: pick the type under the cursor; empty cursor clears the hand
				const over = this.lastPos && this.nodeAt(this.lastPos);
				this.palette.setHand(over ? over.type : null);
				this.refreshHand();
				return;
			}
			if (evt.key === 'Enter' && this.palette.hand) {
				// mouseless chaining: stamp at the ghost, then re-evaluate the cell
				// (it is occupied now — the feedback must say so without a mouse move)
				evt.preventDefault();
				if (this.lastPos) {
					this.stampAt(this.lastPos);
					this.refreshHand();
				}
				return;
			}
		}
		if (evt.key.startsWith('Arrow')) {
			evt.preventDefault();
			const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[evt.key];
			if (!dir) return;
			// Shift+arrow resizes the lone selected zone OR grows the lone selected node's span; plain arrow
			// nudges. Both resize paths self-guard on the selection kind, so only the matching one acts.
			if (evt.shiftKey) { this.resizeZoneByKey(dir[0], dir[1]); this.resizeNodeByKey(dir[0], dir[1]); }
			else this.nudge(dir[0], dir[1]);
			return;
		}
		// Z wraps the selection in a fitted zone (bare key; Ctrl+Z is undo, below)
		if (evt.key.toLowerCase() === 'z' && !evt.ctrlKey && !evt.metaKey) {
			evt.preventDefault();
			this.wrapInZone();
			return;
		}
		// C closes/opens the selected multi-hop route (loops dst back to src)
		if (evt.key.toLowerCase() === 'c' && !evt.ctrlKey && !evt.metaKey && !evt.altKey) {
			evt.preventDefault();
			this.toggleClosePath();
			return;
		}
		// L chains the selected nodes; Shift+L stars from the first-selected
		if (evt.key.toLowerCase() === 'l' && !evt.ctrlKey && !evt.metaKey && !evt.altKey) {
			evt.preventDefault();
			this.linkSelectedNodes(evt.shiftKey);
			return;
		}
		if (evt.key === 'F2') {
			evt.preventDefault();
			// prefer the directly-clicked entity: group expansion makes single
			// selection impossible for grouped nodes
			const ids = this.selection.list().filter((id) => kindOf(id) !== 'link' && kindOf(id) !== 'group');
			const target = (this.focusId && ids.includes(this.focusId)) ? this.focusId
				: (ids.length === 1 ? ids[0] : null);
			if (target) this.labels.open(kindOf(target), target);
			return;
		}

		const meta = evt.ctrlKey || evt.metaKey;
		if (meta && evt.key.toLowerCase() === 'z') {
			evt.preventDefault();
			evt.shiftKey ? this.history.redo() : this.history.undo();
			this.afterHistory();
			return;
		}
		if (meta && evt.key.toLowerCase() === 'y') {
			evt.preventDefault();
			this.history.redo();
			this.afterHistory();
			return;
		}
		if (meta && evt.key.toLowerCase() === 'a') {
			evt.preventDefault();
			this.selection.set([
				...this.model.all('node').map((n) => n.id),
				...this.model.all('zone').map((z) => z.id),
				...this.model.all('link').map((l) => l.id)
			]);
			return;
		}
		if (meta && evt.key.toLowerCase() === 'd') {
			evt.preventDefault(); // claim the browser bookmark shortcut
			this.duplicateSelection();
			return;
		}
		if (meta && evt.key.toLowerCase() === 'g') {
			evt.preventDefault();
			if (evt.shiftKey) {
				const groups = new Set(this.selection.groupable()
					.map((id) => this.model.groupOf(id)).filter(Boolean).map((g) => g.id));
				this.history.commit(commands.ungroupAll(this.model, [...groups]));
			} else {
				this.history.commit(commands.createGroup(this.model, this.selection.groupable()));
			}
			return;
		}
		if ((evt.key === 'Delete' || evt.key === 'Backspace') && this.selection.size() > 0) {
			evt.preventDefault();
			this.history.commit(commands.deleteSelection(this.model, new Set(this.selection.list())));
			// selection auto-prunes on the delete's emits (selection.js)
		}
	}

	onKeyUp(evt) {
		if (evt.key === 'Shift') {
			this.svg.classList.remove('zonegrid');
			if ((this.mode === 'move' || this.mode === 'clone') && this.lastPos) {
				// re-render with the lock released: the commit follows the frame
				this.updateMove(this.lastPos, false);
			}
			// the zone layer just went inert: a hovered zone must drop its states
			if (this.hovered && kindOf(this.hovered) === 'zone') {
				this.renderer.clearState(this.hovered, 'hover');
				this.hovered = null;
				this.disarm();
			}
		}
		if (evt.key === 'Alt' || evt.key === 'Control') this.updateArming(evt);
	}

	afterHistory() {
		// selection auto-prunes on del emits (selection.js); render() re-applies 'selected' from the
		// renderer's selectedSet whenever undo/redo re-renders an entity — so no manual re-reflect here.
		this.refreshHand(); // undo/redo can change occupancy under a stationary cursor
	}
}
