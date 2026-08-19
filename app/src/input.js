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

import { Overlay } from './overlay.js';
import { RECOGNIZE, resolveRule } from './recognize.js';
import { resolveKey } from './keymap.js';
import { hitOf, nodeAt, endpointAt, occupiedAt, occupiedAnyAt, waypointFree, inFootprint, footprintHits } from './pick.js';
import { CANVAS, GAP, HALF, NODE_R, NODE_EXT, ZONE_EXT, spanExtent, orthoDelta, snappedDelta, clampDelta, resizeBox, snapNode, snapZone, resolveBox, pointInBox, dist } from './snap.js';
import { el, toCanvas, crosshair, previewRect, previewLine, previewPath } from './painter.js';
import { roundedPath, BEND_R } from '../../kernel/index.mjs';
import { newId, kindOf } from '../../model/index.mjs';
import { NODE_TYPES } from './palette.js';
import * as commands from './commands.js';

const DRAG_THRESHOLD = 4;   // canvas units before a press becomes a drag

// A1 — the node-frame rect spanning two snapped cell-centre points: the text-box draw preview + its
// footprint (origin cell + span counts). a click (a===b) → a 1×1 frame; a drag → the spanned frame.
const frameSpan = (a, b) => {
	const x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y), x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
	return { x: x0 - NODE_R, y: y0 - NODE_R, w: (x1 - x0) + 2 * NODE_R, h: (y1 - y0) + 2 * NODE_R,
		origin: { x: x0, y: y0 }, cols: Math.round((x1 - x0) / GAP) + 1, rows: Math.round((y1 - y0) / GAP) + 1 };
};

/*
GESTURES — one entry per mode, one uniform shape (INPUT.md §7).

	start(input, hit, pos, evt) → ctx

`start` is all H6.4 unifies. `update`, `commit` and `cancel` still dispatch through the switches in
onMove / dispatchUp / cancelDrag; folding those in is the same shape of work and is deliberately a
separate step, because rewriting four dispatchers in one commit would leave nothing to bisect if the
net went red.

The bodies are the branches they replace, moved not rewritten. `move` and `clone` delegate to the
existing startMove/startClone, which already had this shape — the design was latent in three of ten
modes and this finishes it rather than imposing it.
*/
const GESTURES = {
	move: {
		update: (i, pos, evt) => i.updateMove(pos, evt.shiftKey),
		commit: (i, ctx, pos) => {
			i.overlayUi.crosshair.hide();
			// commit with the flag of the last RENDERED frame, never re-sampled: Shift may have
			// changed state since, with the pointer stationary
			i.commitMove(ctx, pos, ctx.orthoActive);
		},
		cancel: (i, ctx) => {
			ctx.moved.forEach((m) => i.model.set(m.kind, m.id, { x: m.before.x, y: m.before.y }));
			i.overlayUi.crosshair.hide();
		}
	},

	clone: {
		update: (i, pos, evt) => i.updateMove(pos, evt.shiftKey),
		commit: (i, ctx, pos) => {
			i.overlayUi.crosshair.hide();
			i.commitClone(ctx, pos, ctx.orthoActive);
		},
		cancel: (i, ctx) => {
			[...ctx.clones].reverse().forEach((c) => i.model.del(c.kind, c.entity.id));   // uncommitted clones vanish entirely
			i.selection.clear();
			i.overlayUi.crosshair.hide();
		}
	},

	pending: {
		update: (i, pos, evt) => i.escalate(pos, evt, i.readOnly || i.ctx.hit.kind === 'link', (x, p) => x.startMove(p), 'move'),
		start: (i, hit, pos, evt) => {
			i.beginPress(hit, pos, evt.shiftKey && hit.kind !== 'zone');   // for zones Shift is the layer key, not selection-add
			i.ctx.orthoReady = !evt.shiftKey;
			return i.ctx;
		}
	},

	'clone-pending': {
		commit: (i, ctx) => {
			// Ctrl+click without drag: toggle selection (draw.io behavior)
			if (i.model.get(ctx.hit.kind, ctx.hit.id)) {
				i.selection.toggle(ctx.hit.id);
				i.focusId = ctx.hit.id;
			}
		},
		update: (i, pos, evt) => i.escalate(pos, evt, false, (x, p) => x.startClone(p), 'clone'),
		start: (i, hit, pos, evt) => ({ hit, start: pos, orthoReady: !evt.shiftKey })
	},

	resize: {
		commit: (i, ctx, pos) => {
			const after = resizeBox(pos, ctx.fixedCorner);
			const before = ctx.before;
			i.model.set('zone', ctx.zone, { ...before });   // rewind the live preview; history owns the real edit
			if (after.x === before.x && after.y === before.y && after.w === before.w && after.h === before.h) return;
			i.history.commit(commands.resizeZone(ctx.zone, after));
		},
		cancel: (i, ctx) => i.model.set('zone', ctx.zone, { ...ctx.before }),   // a cancelled gesture is a no-op
		update: (i, pos) => {
			const box = resizeBox(pos, i.ctx.fixedCorner);
			i.model.set('zone', i.ctx.zone, box);   // live preview writes the shared Model (B7)
			i.readout.setBox(box);
		},
		start: (i, hit) => {
			const zoneId = i.selection.list().find((id) => kindOf(id) === 'zone');
			const zone = i.model.get('zone', zoneId);
			if (!zone) return null;
			// the FIXED corner is the one OPPOSITE the grabbed handle
			const corners = {
				nw: { x: zone.x + zone.w, y: zone.y + zone.h }, ne: { x: zone.x, y: zone.y + zone.h },
				sw: { x: zone.x + zone.w, y: zone.y },          se: { x: zone.x, y: zone.y }
			};
			return { zone: zoneId, fixedCorner: corners[hit.id], before: { x: zone.x, y: zone.y, w: zone.w, h: zone.h } };
		}
	},

	replug: {
		commit: (i, ctx, pos) => {
			ctx.line.remove();
			if (ctx.target) i.renderer.setState(ctx.target, 'hover', false);
			i.renderer.setState(ctx.linkId, 'replugging', false);
			const link = i.model.get('link', ctx.linkId);
			const target = nodeAt(i.model, pos);
			if (link && target && target.id !== ctx.fixedId) {
				const newSrc = ctx.end === 'src' ? target.id : link.src;
				const newDst = ctx.end === 'dst' ? target.id : link.dst;
				const wasAt = ctx.end === 'src' ? ctx.before.src : ctx.before.dst;
				// commit only a genuine, non-duplicate retarget; else leave the link as-is
				if (target.id !== wasAt && !i.model.linkBetween(newSrc, newDst)) {
					i.history.commit(commands.replugLink(ctx.linkId, newSrc, newDst));
				}
			}
			i.overlayUi.handles();   // handles ride the (possibly new) endpoints
		},
		cancel: (i, ctx) => {
			// a cancelled re-plug is a no-op: drop the preview, restore the real line
			ctx.line.remove();
			if (ctx.target) i.renderer.setState(ctx.target, 'hover', false);
			i.renderer.setState(ctx.linkId, 'replugging', false);
		},
		update: (i, pos) => {
			// the fixed end is anchored; the dragged end follows the cursor / hovered node
			const target = nodeAt(i.model, pos);
			i.ctx.line.update(i.ctx.fixed, target || pos);
			i.retarget(target, i.ctx.fixedId);
			i.readout.setLink(i.ctx.fixed.name || '?', (target && target.id !== i.ctx.fixedId) ? (target.name || '?') : snapNode(pos));
		},
		start: (i, hit, pos) => {
			const linkId = i.selection.list().find((id) => kindOf(id) === 'link');
			const link = i.model.get('link', linkId);
			if (!link) return null;
			const fixedId = hit.end === 'src' ? link.dst : link.src;
			const fixed = i.model.endpointOf(fixedId);   // an anchor is a node OR a waypoint (B29)
			if (!fixed) return null;
			i.renderer.setState(linkId, 'replugging', true);   // de-emphasize the real line while dragging
			const ctx = { linkId, end: hit.end, fixedId, fixed, before: { src: link.src, dst: link.dst }, line: previewLine(i.overlay), target: null };
			ctx.line.update(fixed, pos);
			return ctx;
		}
	},

	link: {
		// only the LEFT button drives link mode: a right-button release during a chain (chord delete,
		// stray right-click) must never commit a segment. A precondition on the release, so it has to
		// run before the common teardown — hence its own slot rather than a line inside `commit`.
		ignoreUp: (evt) => evt.button !== 0,
		commit: (i, ctx, pos, evt) => {
			ctx.path.remove();
			if (ctx.target) i.renderer.setState(ctx.target, 'hover', false);
			const target = endpointAt(i.model, pos);
			const srcAlive = i.model.endpointOf(ctx.src.id);
			const hasVia = !!(ctx.via && ctx.via.length);
			// a valid endpoint under the cursor: a node / free waypoint, distinct from src, not a via bend
			const validTarget = srcAlive && target && target.id !== ctx.src.id && !(ctx.via || []).includes(target.id);
			// resolve the destination: the endpoint under the cursor, ELSE end at the LAST dropped
			// waypoint — so releasing after `w` commits the route, terminating at that waypoint
			let dst = validTarget ? target.id : null;
			const via = [...(ctx.via || [])];
			if (!dst && via.length) dst = via.pop();
			if (dst && srcAlive && dst !== ctx.src.id && !i.model.linkBetween(ctx.src.id, dst)) {
				i.commitRoute(ctx, dst, via);     // placed waypoints + the link, one undo step
				if (validTarget && evt.shiftKey && !hasVia) i.chainFrom(target, pos);   // chain only plain links
				return;
			}
			if (validTarget && evt.shiftKey && !hasVia) {
				i.chainFrom(target, pos);   // already-linked target: skip the duplicate but keep the chain run alive
				return;
			}
			if (srcAlive && !hasVia && dist(pos, ctx.start) <= DRAG_THRESHOLD) {
				const hand = i.palette.hand;
				// fast-replace gate mirrors the stamp gate (plain click only) and never fires on a
				// chain anchor (that click ends the run, selecting)
				if (i.model.get('node', ctx.src.id) && hand && hand !== 'waypoint' && !ctx.chained
					&& !evt.shiftKey && !evt.ctrlKey && !evt.altKey && hand !== ctx.src.type) {
					i.history.commit(commands.retypeNode(ctx.src.id, hand));
					i.selection.set([ctx.src.id]);
					i.focusId = ctx.src.id;
					return;
				}
				// a no-drag press is still a click: select (mirrors beginPress semantics)
				i.focusId = ctx.src.id;
				if (ctx.shift) i.selection.toggle(ctx.src.id);
				else if (!i.selection.has(ctx.src.id)) i.selection.set([ctx.src.id]);
				return;
			}
			i.cleanupRoute(ctx);   // invalid target, duplicate, or route released off a node: discard placed waypoints
		},
		cancel: (i, ctx) => {
			if (ctx.path) ctx.path.remove();
			if (ctx.target) i.renderer.setState(ctx.target, 'hover', false);
			i.cleanupRoute(ctx);
		},
		update: (i, pos) => {
			const target = endpointAt(i.model, pos);
			i.updateLinkPreview(pos);
			i.retarget(target, i.ctx.src.id);
			i.readout.setLink(i.ctx.src.name || '?', (target && target.id !== i.ctx.src.id) ? (target.name || '?') : snapNode(pos));
		},
		start: (i, hit, pos, evt) => {
			const src = i.model.get(hit.kind, hit.id);
			i.renderer.setState(src.id, 'hover', false);   // capture swallows the boundary pointerout
			i.overlayUi.clearHover();
			i.ctx = { src, path: previewPath(i.overlay), target: null, start: pos, shift: evt.shiftKey, via: [], placed: [] };
			i.updateLinkPreview(pos);
			return i.ctx;
		}
	},

	zone: {
		commit: (i, ctx, pos) => {
			ctx.rect.remove();
			const box = resolveBox(ctx.p1, snapZone(pos));
			if (box.w > 0 && box.h > 0) {
				const zone = i.model.makeZone(box);
				i.history.commit(commands.createEntity('zone', zone));
				i.selection.set([zone.id]);
			}
		},
		cancel: (i, ctx) => ctx.rect.remove(),
		update: (i, pos) => {
			const box = resolveBox(i.ctx.p1, snapZone(pos));
			i.ctx.rect.update(box);
			i.readout.setBox(box);
		},
		start: (i, hit, pos) => {
			const p1 = snapZone(pos);
			const ctx = { p1, rect: previewRect(i.overlay, 'zone-rect preview') };
			ctx.rect.update(resolveBox(p1, p1));
			return ctx;
		}
	},

	marquee: {
		commit: (i, ctx, pos, evt) => {
			ctx.rect.remove();
			const box = resolveBox(ctx.p1, pos);
			if (box.w < DRAG_THRESHOLD && box.h < DRAG_THRESHOLD) {
				// a plain click with a held hand stamps at the snapped cell (an occupied-cell refusal
				// still consumes the click: it meant "stamp", never "deselect")
				if (i.palette.hand && !evt.shiftKey && !evt.ctrlKey && !evt.altKey) {
					i.stampAt(pos);
					i.refreshHand();   // the cell is occupied now: feedback must say so
					return;
				}
				if (!evt.shiftKey) i.selection.clear();
				return;
			}
			// zones are not marquee-pickable (Shift layer); select them directly
			const picked = [];
			i.model.all('node').forEach((n) => { if (footprintHits(n, box)) picked.push(n.id); });   // span-aware
			i.model.all('waypoint').forEach((w) => { if (pointInBox(w, box)) picked.push(w.id); });
			// a link comes along when BOTH its endpoints (node or waypoint) are inside the box
			const inBox = new Set(picked);
			i.model.all('link').forEach((l) => { if (inBox.has(l.src) && inBox.has(l.dst)) picked.push(l.id); });
			evt.shiftKey ? i.selection.add(picked) : i.selection.set(picked);
		},
		cancel: (i, ctx) => ctx.rect.remove(),
		update: (i, pos) => i.ctx.rect.update(resolveBox(i.ctx.p1, pos)),
		start: (i, hit, pos) => ({ p1: pos, rect: previewRect(i.overlay, 'marquee') })
	},

	textbox: {
		commit: (i, ctx, pos) => {
			ctx.rect.remove();
			const f = frameSpan(ctx.p1, snapNode(pos));   // origin + span counts (a click → 1×1)
			const tb = i.model.makeTextBox(f.origin, { cols: f.cols, rows: f.rows });
			i.history.commit(commands.createEntity('node', tb));
			i.selection.set([tb.id]);
			i.textTool = false; i.svg.classList.remove('texttool');   // one box per arm — re-tap 't' for another
			// open the inline editor on the text region, positioned over the new box's frame
			const frameEl = i.svg.ownerDocument.getElementById(tb.id);
			if (frameEl) i.labels.openContent(tb.id, 0, frameEl.querySelector('[data-layer="frame"]') || frameEl);
		},
		cancel: (i, ctx) => ctx.rect.remove(),
		update: (i, pos) => {
			const box = frameSpan(i.ctx.p1, snapNode(pos));
			i.ctx.rect.update(box);
			i.readout.setBox(box);
		},
		start: (i, hit, pos) => {
			if (i.labels.isOpen()) i.labels.close(true);
			const p1 = snapNode(pos);
			return { p1, rect: previewRect(i.overlay, 'textbox-preview') };
		}
	},
};

export class Input {
	constructor({ svg, model, history, selection, renderer, labels, readout, palette, dataview }) {
		this.svg = svg;
		this.model = model;
		this.history = history;
		this.selection = selection;
		this.renderer = renderer;
		this.labels = labels;
		// A null object must be TOTAL or it is a trap: this one advertised that `readout` is optional
		// and then threw on `signed`/`dims`/`flash`, so Ctrl+D and the zone/box gestures were reachable
		// only with a real readout injected. Latent because main.js always passes one — found the first
		// time anything else constructed Input (the H2.1 harness). Keep in step with the call sites.
		this.readout = readout || { setCursor() {}, setDrag() {}, setBox() {}, setLink() {}, setDatum() {}, clearTransient() {}, render() {}, dims() { return ''; }, signed() { return ''; }, flash() {} };
		this.palette = palette || { hand: null, setHand() {}, toggleHand() {}, trackHand() {}, hideHand() {} };
		this.dataview = dataview || { toggle() {} };
		this.lastPos = null;   // last pointer position in canvas coords (datum anchor)
		this.overlay = svg.querySelector('#overlay');
		// H6.3 — transient feedback is overlay.js's: hovered, armed, the datum marker and the
		// crosshair moved with it. Input keeps only what a GESTURE needs (mode, ctx, lastPos).
		this.overlayUi = new Overlay({ svg, model, selection, renderer });
		this.mode = null; // null | pending | clone-pending | move | clone | link | zone | marquee | resize
		this.ctx = {};


		this.lastDelta = { x: GAP, y: 0 }; // remembered pitch for Ctrl+D duplicate
		this.readOnly = false; // Server-Locked: inspect + select only, no mutations
		// D12 — fires when an in-flight gesture ends, however it ends. Sync listens so inbound changes
		// deferred during the gesture replay at exactly the moment the preview stops moving (B19).
		this.onGestureEnd = () => {};
		this.textTool = false; // A1 — 't' held: drag draws a text box (mirrors Shift+drag-zone)
		this.help = document.getElementById('help');

		selection.subscribe(() => {
			// a coalescing burst never spans a selection change — the window now lives in Changes
			// (D11), so the seam moved there with it rather than being dropped
			this.history.flush();
			this.overlayUi.handles();
			this.readout.render();
		});
		model.onChange((action, kind, entity) => {
			// zone resize handles + link endpoint handles track their entity's geometry
			if (kind === 'zone' || kind === 'link' || action === 'load') this.overlayUi.handles();
			// a gesture must not survive a document swap (chain mode has no held
			// button, so the header menu is reachable mid-gesture)
			if (action === 'load' && this.mode) this.cancelDrag();
			// hovered/armed state must die with its entity (chord delete, undo, load)
			if (action === 'del' || action === 'load') {
				if (this.overlayUi.hovered && (action === 'load' || entity.id === this.overlayUi.hovered)) {
					this.renderer.clearState(this.overlayUi.hovered, 'hover', 'linkband');
			
					this.overlayUi.disarm();
				}
				if (action === 'load' && this.labels.isOpen()) this.labels.close(false);
				if (action === 'load') {
					this.readout.setDatum(null);
					this.overlayUi.datum(null);
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


	// a PREDICATE returns a boolean: this used to hand back `null` when idle, which is only
	// distinguishable from `false` at a call site that compares strictly — and D12's defer rule
	// is now such a caller (bindGestureDefer).
	isGesturing() {
		return !!this.mode && this.mode !== 'pending' && this.mode !== 'clone-pending';
	}

	// ---- pointer down ----
	// Server-Locked: a server-side controller owns writes; the browser can still
	// look, select, marquee, toggle the data view — but not mutate
	setReadOnly(on) {
		if (this.readOnly === on) return;
		this.readOnly = on;
		this.palette.readOnly = on;
		if (on) {
			// Every ARMED intent dies with the lock, not just the in-flight gesture. B42: `t` was
			// gated at the keypress but the text tool, once armed, outlived the lock and authored a
			// box on the next click — the branch sits above the read-only gate in onDown. Arming the
			// hand and arming the delete chord were already cleared here; the text tool was the one
			// held tool nobody added. That asymmetry is what H6's held-tool unification removes.
			if (this.mode) this.cancelDrag();
			this.palette.setHand(null);
			this.overlayUi.disarm();
			this.textTool = false;
			this.svg.classList.remove('texttool');
		}
	}

	/*
	One press → one rule → one gesture. The 167-line nest this replaces is now three things: a
	surface-mode guard, a live-gesture hook, and an ordered table (app/src/recognize.js).
	*/
	onDown(evt) {
		// W5 — RUN mode: the diagram ACTS as UI, and is not a gesture surface at all. A guard rather
		// than a rule, because it is a mode of the whole surface (INPUT.md §4).
		if (this.renderer.mode === 'run') return this.runModePress(evt);

		// chain wiring: the live gesture CONSUMES this press. Not a rule about starting one.
		if (this.mode === 'link' && evt.button === 0) { this.ctx.chained = false; return; }

		if (this.labels.isOpen()) this.labels.close(true);
		this.palette.hideHand();

		const hit = hitOf(evt);
		const pos = toCanvas(evt, this.svg);
		this.lastPos = pos;
		const rule = resolveRule(RECOGNIZE, hit, evt, this.ruleCtx());
		if (!rule) return;

		if (this.mode) this.cancelDrag(evt);   // a second press never stacks on an active gesture
		this.overlayUi.zoneGrid(evt.shiftKey, false);
		try { this.svg.setPointerCapture(evt.pointerId); } catch { /* synthetic events */ }

		if (rule.run) return this[rule.run](hit, evt, pos);
		const handler = GESTURES[rule.gesture];
		this.mode = rule.gesture;
		this.ctx = handler.start(this, hit, pos, evt) || {};
	}

	// what a rule predicate may ask about the world — never Input itself
	ruleCtx() {
		return {
			readOnly: this.readOnly,
			tool: this.textTool,
			waypointFree: (id) => waypointFree(this.model, id),
		};
	}

	runModePress(evt) {
		if (evt.button !== 0) return;
		const t = evt.target.closest && evt.target.closest('[data-action],[data-input]');
		if (t && t.dataset.action) {
			evt.preventDefault();
			window.dispatchEvent(new CustomEvent('draw:action', { detail: { action: t.dataset.action, id: t.closest('.node') ? t.closest('.node').id : null } }));
		} else if (t && t.dataset.input !== undefined && !this.readOnly) {
			// run mode straddles the gate: firing an action commits nothing and stays live while
			// locked; opening the inline editor authors a change and does not (B18).
			evt.preventDefault();
			const node = t.closest('.node');
			if (node) this.labels.openContent(node.id, Number(t.dataset.idx), t);
		}
	}

	deleteUnderCursor(hit) {
		if (this.isGesturing()) return;
		this.history.commit(commands.deleteSelection(this.model, [hit.id]));
		this.afterHistory();
	}


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
		const base = this.ctx.hit;
		this.mode = 'move';
		this.ctx = { ...this.ctx, moved, baseKind: base.kind, baseId: base.id };
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
		// One cloner for every placeable kind. A waypoint is `{id, x, y}` and nothing else
		// (server/validate.js FIELDS.waypoint), so it must NOT be given a name — stamping one on
		// would invent a field the server rejects, and the clone would apply locally then be refused
		// on the wire. Naming is therefore per-kind, not universal.
		const cloneEntity = (kind, src) => {
			const copy = { ...src, id: newId(kind, this.model.collection(kind)) };
			if (kind === 'node') copy.name = this.model.nextName(src.type);
			else if (kind === 'zone') copy.name = this.model.nextName('zone');
			idMap.set(src.id, copy.id);
			this.model.put(kind, copy);
			clones.push({ kind, entity: copy });
			return copy;
		};

		seedIds.forEach((id) => {
			const kind = kindOf(id);
			if (kind !== 'node' && kind !== 'zone' && kind !== 'waypoint') return;   // B30: waypoints are placeable and selectable
			const src = this.model.get(kind, id);
			if (src) cloneEntity(kind, src);
		});
		if (idMap.size === 0) return null;

		/*
		Links whose BOTH endpoints were cloned — carrying the route, not just the ends (B30).

		A link's `via` list and its `closed` flag are authored geometry: dropping them turns a
		multi-hop route into a straight line silently, which is loss of intent rather than a
		cosmetic difference. Any via waypoint not already in the clone set is pulled in here, because
		a cloned route needs its own bends — pointing the copy at the ORIGINAL waypoints would make
		two links share them, which the validator forbids outright (a waypoint belongs to at most one
		link, in at most one role).
		*/
		this.model.all('link').forEach((link) => {
			if (!idMap.has(link.src) || !idMap.has(link.dst) || idMap.has(link.id)) return;
			const via = Array.isArray(link.via) ? link.via : [];
			via.forEach((wid) => {
				if (idMap.has(wid)) return;
				const w = this.model.get('waypoint', wid);
				if (w) cloneEntity('waypoint', w);
			});
			const copy = { id: newId('link', this.model.collection('link')), src: idMap.get(link.src), dst: idMap.get(link.dst) };
			const mapped = via.map((wid) => idMap.get(wid)).filter(Boolean);
			if (mapped.length) copy.via = mapped;
			if (link.closed) copy.closed = true;
			idMap.set(link.id, copy.id);
			this.model.put('link', copy);
			clones.push({ kind: 'link', entity: copy });
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
		const baseId = idMap.get(hit.id);
		this.mode = 'clone';
		this.ctx = { ...this.ctx, clones, moved, baseKind: hit.kind, baseId };
		this.selection.set(moved.map((m) => m.id));
	}

	/*
	Ctrl+D — duplicate the selected subgraph at the remembered pitch (the last
	committed move/clone delta this session, default one cell right). Clamps to
	the canvas; if both axes clamp to zero it refuses rather than overlap.
	*/
	duplicateSelection() {
		const seeds = this.selection.list().filter((id) => ['node', 'zone', 'waypoint'].includes(kindOf(id)));   // B30
		if (seeds.length === 0) return;
		// clamp the pitch against the ORIGINALS (clones start at the same spots)
		const refs = seeds.map((id) => {
			const kind = kindOf(id);
			const e = this.model.get(kind, id);
			return { kind, id, before: { x: e.x, y: e.y } };
		});
		const delta = clampDelta(this.model, refs, { ...this.lastDelta });
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
		this.history.commit(commands.toggleClosed(link));
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
		this.history.commit(commands.linkNodes(created, star));
		this.selection.set(created.map((l) => l.id));
		this.readout.flash(`+${created.length} link${created.length > 1 ? 's' : ''}`);
	}

	// ---- pointer move ----
	// a node already on this exact grid point (a stamp must never overlap) — engine occupancy index (R13)

	// stamp the held type at the snapped cell; refuses occupied cells
	stampAt(pos) {
		const type = this.palette.hand;
		if (!type) return false;
		const snapped = snapNode(pos);
		if (type === 'waypoint') {
			if (occupiedAnyAt(this.model, snapped)) return false;
			const wp = this.model.makeWaypoint(snapped);
			this.history.commit(commands.createEntity('waypoint', wp));
			this.selection.set([wp.id]);
			this.focusId = wp.id;
			return true;
		}
		if (occupiedAt(this.model, snapped)) return false;
		const node = this.model.makeNode(type, snapped);
		this.history.commit(commands.createEntity('node', node));
		this.selection.set([node.id]); // the hand stays armed; selection follows
		this.focusId = node.id;
		return true;
	}

	// a cell already holding a node OR a waypoint (a waypoint must not stack on either) — index (R13)

	// a waypoint with no link referencing it (endpoint or via) — free to become a link end / bend

	// a valid link endpoint under the cursor: a node, or a FREE waypoint (occupied ones can't take a link)

	// stamp-hand occupied check: a waypoint needs an empty cell (no node OR waypoint); a node only no node
	handBlocked(snapped) {
		if (!this.palette.hand) return false;
		return this.palette.hand === 'waypoint' ? occupiedAnyAt(this.model, snapped) : occupiedAt(this.model, snapped);
	}

	// 'w' when idle: drop a standalone waypoint at the snapped cursor cell (empty cells only)
	placeWaypoint() {
		if (!this.lastPos) return false;
		const snapped = snapNode(this.lastPos);
		if (occupiedAnyAt(this.model, snapped)) return false;
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
			if (!waypointFree(this.model, existing.id)) return;        // occupied by another link
			if (!this.ctx.via.includes(existing.id)) this.ctx.via.push(existing.id);
		} else {
			if (occupiedAt(this.model, snapped)) return;        // a node cell — refuse
			const wp = this.model.makeWaypoint(snapped);
			this.model.put('waypoint', wp);            // live (visible); committed on release
			this.ctx.via.push(wp.id);
			this.ctx.placed.push(wp);
		}
		this.updateLinkPreview(this.lastPos);
	}

	// the live route preview: a rounded polyline through src → threaded waypoints → cursor/target
	updateLinkPreview(pos) {
		const target = endpointAt(this.model, pos);
		const end = target ? { x: target.x, y: target.y } : snapNode(pos);
		// the cursor is a free ANCHOR — pathOf resolves the rest of the route around it
		const path = this.model.pathOf({ src: this.ctx.src, via: this.ctx.via, dst: end });
		if (path) this.ctx.path.update(roundedPath(path, BEND_R));
	}

	// commit a finished route: the materialised waypoints + the link (with via) as ONE undo step
	commitRoute(ctx, dstId, via) {
		const link = { ...this.model.makeLink(ctx.src.id, dstId), ...(via && via.length ? { via: [...via] } : {}) };
		this.model.put('link', link);
		this.history.commit(commands.routeLink(ctx.placed, link));
		this.selection.set([link.id]);
	}

	// abandon an in-progress route: drop any waypoints placed during this draw
	cleanupRoute(ctx) {
		[...(ctx.placed || [])].reverse().forEach((wp) => this.model.del('waypoint', wp.id));
	}

	/*
	One move → the live gesture's own `update`. The mode switch this replaces was eight branches
	deep; each is now the entry that owns the rest of that gesture's lifecycle.
	*/
	onMove(evt) {
		const moving = this.mode === 'move' || this.mode === 'clone';
		this.overlayUi.zoneGrid(evt.shiftKey, moving);
		const pos = toCanvas(evt, this.svg);
		this.lastPos = pos;

		if (!this.mode) {
			// idle: the stamp ghost rides the snapped cell and the readout states the landing
			const snapped = snapNode(pos);
			const blocked = this.handBlocked(snapped);
			this.palette.trackHand(snapped, blocked);
			this.readout.setCursor(snapped, this.palette.hand, blocked);
			return this.idleAffordance(evt);
		}
		GESTURES[this.mode].update?.(this, pos, evt);
	}

	// pending → move / clone-pending → clone: the escalation, and the SECOND gate point. A press is
	// not yet a mutation (INPUT.md §4), so `press` is mutates:false and the drag is where the
	// read-only decision actually has to be made.
	// highlight the entity a drag would land on, and un-highlight the one it left. Identical in the
	// link and replug updates, so it lives once.
	retarget(target, excludeId) {
		if (this.ctx.target && (!target || target.id !== this.ctx.target)) {
			this.renderer.setState(this.ctx.target, 'hover', false);
			this.ctx.target = null;
		}
		if (target && target.id !== excludeId) {
			this.ctx.target = target.id;
			this.renderer.setState(target.id, 'hover', true);
		}
	}

	escalate(pos, evt, threshold, begin, become) {
		if (dist(pos, this.ctx.start) <= DRAG_THRESHOLD) return;
		if (threshold) return;
		begin(this, pos);
		if (this.mode === become) {
			// re-evaluate the layer indicator and render the first frame NOW, not on the next event
			this.overlayUi.zoneGrid(evt.shiftKey, true);
			this.updateMove(pos, evt.shiftKey);
		}
	}

	updateMove(pos, shiftHeld) {
		if (!shiftHeld) this.ctx.orthoReady = true;
		const ortho = !!shiftHeld && !!this.ctx.orthoReady;
		this.ctx.orthoActive = ortho;
		const rawDelta = orthoDelta(
			{ x: pos.x - this.ctx.start.x, y: pos.y - this.ctx.start.y }, ortho);
		// clamp live: out-of-bounds coordinates must never reach the model
		const delta = clampDelta(this.model, this.ctx.moved, rawDelta);
		this.ctx.moved.forEach((m) => {
			this.model.set(m.kind, m.id, {
				x: m.before.x + delta.x,
				y: m.before.y + delta.y
			});
		});
		const base = this.ctx.moved.find((m) => m.id === this.ctx.baseId) || this.ctx.moved[0];
		const raw = { x: base.before.x + delta.x, y: base.before.y + delta.y };
		const target = base.kind === 'zone' ? snapZone(raw) : snapNode(raw);   // node + waypoint → node grid
		this.overlayUi.crosshair.show(target);
		this.readout.setDrag(target, {
			x: (target.x - base.before.x) / GAP,
			y: (target.y - base.before.y) / GAP
		});
	}


	// crosshair cursor + ring emphasis when idle over a node: left-drag draws a link
	idleAffordance(evt) {
		const hit = hitOf(evt);
		if (hit.kind !== 'node') return;
		this.renderer.setState(hit.id, 'linkband', !evt.ctrlKey && !evt.altKey);
	}

	// ---- pointer up ----
	/*
	`onUp` returns early on almost every path — one per gesture mode — so a hook at the bottom fires
	for a marquee and nothing else. D12's release has to run however the gesture ended, so it is a
	wrapper rather than a line at the end, and it runs in a `finally`: a throwing commit handler must
	not strand the deferred queue forever, which would be a worse failure than the one it replaced.

	It fires AFTER dispatch, not before: a deferred remote change must land after this gesture's own
	commit, or the two arrive out of order.
	*/
	onUp(evt) {
		const wasGesturing = this.isGesturing();
		try { this.dispatchUp(evt); } finally { if (wasGesturing) this.onGestureEnd(); }
	}

	/*
	One release → the live gesture's own `commit`. The 168-line mode ladder this replaces ended with
	a trailing `onGestureEnd()` that only `resize` could reach, because every other branch returned
	early (B43). `onUp`'s `finally` is now the single owner of that hook, so it fires exactly once per
	gesture BY CONSTRUCTION rather than by fourteen branches each remembering to return.
	*/
	dispatchUp(evt) {
		if (!this.mode) return;
		const g = GESTURES[this.mode];
		if (g.ignoreUp?.(evt)) return;   // a release this gesture does not accept: stay live
		const pos = toCanvas(evt, this.svg);
		const ctx = this.ctx;
		this.mode = null;
		this.ctx = {};
		this.readout.clearTransient();
		this.overlayUi.refreshHover(pos);
		this.overlayUi.zoneGrid(evt.shiftKey, false);   // gesture over: the layer indicator follows Shift again
		g.commit?.(this, ctx, pos, evt);
	}

	chainFrom(node, pos) {
		this.mode = 'link';
		this.ctx = { src: node, path: previewPath(this.overlay), target: null, start: pos, shift: false, chained: true, via: [], placed: [] };
		this.updateLinkPreview(pos);
		this.readout.setLink(node.name || '?', snapNode(pos));
	}

	commitMove(ctx, pos, ortho) {
		ctx.moved = ctx.moved.filter((m) => this.model.get(m.kind, m.id));
		if (ctx.moved.length === 0) return;
		const delta = snappedDelta(this.model, ctx, pos, ortho);
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
		const delta = ctx.moved.length ? snappedDelta(this.model, ctx, pos, ortho) : { x: 0, y: 0 };
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


	// clamp a delta so every moved entity stays on the canvas

	// One abort → the live gesture's own `cancel`, then the same teardown a commit does. Reached by
	// pointercancel, Escape, and a document swap mid-gesture (a chain has no held button, so the
	// header menu is live during one).
	cancelDrag(evt) {
		GESTURES[this.mode]?.cancel?.(this, this.ctx);
		this.mode = null;
		this.ctx = {};
		this.readout.clearTransient();
		this.overlayUi.refreshHover(null);
		if (evt) this.overlayUi.zoneGrid(evt.shiftKey, false);
		this.onGestureEnd();
	}

	// ---- hover + arming ----


	// Alt arms red (delete), Ctrl arms blue (clone) on the hovered entity



	// after a hand change at idle: ghost and readout reflect it immediately
	refreshHand() {
		if (this.mode || !this.lastPos) return;
		const snapped = snapNode(this.lastPos);
		const blocked = this.handBlocked(snapped);
		if (this.palette.hand) this.palette.trackHand(snapped, blocked);
		this.readout.setCursor(snapped, this.palette.hand, blocked);
	}

	// datum marker: a small diamond-cross on the snap layer (pointer-inert)

	// ---- handles: zone corners (resize) and link endpoints (re-plug) ----

	// ---- label editing ----
	onDblClick(evt) {
		// hit GEOMETRICALLY: pointer capture (taken on every press) retargets the
		// browser-synthesized dblclick to the svg, so evt.target is useless here.
		// Icon hits beat label-strip hits; nearest wins; ties go to the topmost
		// (last-rendered) — the strip is wider than a grid cell, so first-match
		// would resolve to a NEIGHBOUR for nodes one cell apart
		const pos = toCanvas(evt, this.svg);
		if (this.readOnly) return; // no editing while Server-Locked
		// A1 — a TEXT BOX is hit by its whole FOOTPRINT (not just the origin cell), so double-clicking ANYWHERE
		// on the box edits its text. (A plain node / panel still routes to the name-edit / icon test below.)
		const tbs = this.model.all('node').filter((n) => Array.isArray(n.content) && n.content.length === 1 && n.content[0].content === 'text'
			&& inFootprint(n, pos, NODE_R));
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
		const delta = clampDelta(this.model, moved, { x: dx * GAP, y: dy * GAP });
		if (delta.x === 0 && delta.y === 0) return;

		/*
		D11 — a burst of arrow keys is ONE undo step, and the window that makes it one lives in
		`Changes` (client-side, label-keyed, 600ms). B14: this used to reach into
		`history.stack[history.index - 1]` to mutate the top of a local undo stack in place. That
		stack was deleted at CS3 when undo moved server-side, so the expression was
		`undefined[NaN]` and THREW — arrow-key nudge did nothing at all for two milestones. The
		replacement (`Changes.amend`) was written and tested at CS3; no call site was ever rewired.
		Each call reads the CURRENT position, so successive amends accumulate correctly.
		*/
		this.history.amend(commands.moveEntities(moved.map((m) => ({
			kind: m.kind, id: m.id,
			after: { x: m.before.x + delta.x, y: m.before.y + delta.y }
		}))));
	}

	// ---- Shift+arrow: grow/shrink the lone selected zone one cell, NW-anchored ----
	resizeZoneByKey(dx, dy) {
		const ids = this.selection.list();
		if (ids.length !== 1 || kindOf(ids[0]) !== 'zone') return; // single-zone only
		const zone = this.model.get('zone', ids[0]);
		if (!zone) return;
		// NW corner fixed; minimum one cell; clamped to the canvas
		const w = Math.min(Math.max(zone.w + dx * GAP, GAP), ZONE_EXT.x - zone.x);
		const h = Math.min(Math.max(zone.h + dy * GAP, GAP), ZONE_EXT.y - zone.y);
		if (w === zone.w && h === zone.h) return;

		// one undo step per burst — the window is in Changes, keyed on the 'resize' label (D11/B14)
		this.history.amend(commands.resizeZone(zone.id, { x: zone.x, y: zone.y, w, h }));
	}

	// ---- Shift+arrow: grow/shrink the lone selected NODE's span one cell (origin fixed, +col/+row) ----
	// The multi-cell authoring gesture (W1). Mirrors resizeZoneByKey: origin (NW) fixed, min 1 cell, capped
	// at the validator's 64, coalesced into one undo step. content stays the glyph at the origin cell.
	resizeNodeByKey(dx, dy) {
		const ids = this.selection.list();
		if (ids.length !== 1 || kindOf(ids[0]) !== 'node') return; // single-node only
		const node = this.model.get('node', ids[0]);
		if (!node) return;
		const cur = node.span || { cols: 1, rows: 1 };
		const cols = Math.min(Math.max(cur.cols + dx, 1), 64);
		const rows = Math.min(Math.max(cur.rows + dy, 1), 64);
		if (cols === cur.cols && rows === cur.rows) return;

		// one undo step per burst — same window, same label as the zone path (D11/B14)
		this.history.amend(commands.resizeNodeSpan(node.id, { cols, rows }));
	}

	// ---- help overlay ----
	toggleHelp(show) {
		if (!this.help) return;
		this.help.hidden = show === undefined ? !this.help.hidden : !show;
	}

	// ---- keyboard ----
	/*
	One keystroke → one entry → one handler. The 243-line ladder this replaces had three guards
	interleaved at different depths, so whether a key worked depended on which of them it happened to
	sit below (INPUT.md §4). Each entry now declares its own tolerances and the dispatcher applies
	them uniformly.
	*/
	onKeyDown(evt) {
		// typing contexts (header menu, label editor) never reach canvas shortcuts
		const tag = evt.target.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

		const rule = resolveKey(evt, {
			readOnly: this.readOnly,
			helpOpen: !!(this.help && !this.help.hidden),
			gesturing: this.isGesturing(),
		});
		if (rule) this[rule.run](evt);
	}

	// ---- key handlers. Bodies unchanged from the ladder; only their dispatch moved. ----

	onShiftDown(evt) {
		if (this.mode === 'move' || this.mode === 'clone') {
			// re-render the drag NOW: the commit follows the last rendered frame
			if (this.lastPos) this.updateMove(this.lastPos, true);
		} else {
			this.svg.classList.add('zonegrid');
		}
	}

	onArmingKey(evt) {
		if (evt.key === 'Alt') evt.preventDefault();   // keep Firefox's menu bar out of the delete chord
		this.overlayUi.arm(evt, { readOnly: this.readOnly, gesturing: this.isGesturing() });
	}

	// W4/W5 — 'e' toggles EDIT (shows the socket grid), 'r' toggles RUN (content regions act).
	// Either key from its own mode returns to the clean VIEW.
	onEditMode() { this.renderer.setMode(this.renderer.mode === 'edit' ? 'view' : 'edit'); }
	onRunMode() { this.renderer.setMode(this.renderer.mode === 'run' ? 'view' : 'run'); }

	onDataView(evt) {
		// claim Tab only when the canvas holds focus, so it can still traverse the toolbar
		const t = evt.target;
		if (t && typeof t.closest === 'function' && t.closest('button, a[href], select, input, textarea, [tabindex]')) return;
		evt.preventDefault();
		this.dataview.toggle();
	}

	onEscape(evt) {
		// priority: close help > cancel gesture > disarm the tool > clear hand > clear selection
		if (this.help && !this.help.hidden) return this.toggleHelp(false);
		if (this.mode) this.cancelDrag(evt);
		else if (this.textTool) { this.textTool = false; this.svg.classList.remove('texttool'); }
		else if (this.palette.hand) {
			this.palette.setHand(null);
			this.readout.setCursor(this.lastPos ? snapNode(this.lastPos) : null);
		} else this.selection.clear();
	}

	onHelpKey(evt) {
		evt.preventDefault();   // keep Firefox's quick-find out of it
		this.toggleHelp();
	}

	onSelectAll(evt) {
		evt.preventDefault();
		this.selection.set([
			...this.model.all('node').map((n) => n.id),
			...this.model.all('zone').map((z) => z.id),
			...this.model.all('link').map((l) => l.id)
		]);
	}

	onDatum(evt) {
		evt.preventDefault();
		if (evt.shiftKey) {
			this.readout.setDatum(null);
			this.overlayUi.datum(null);
			return;
		}
		if (!this.lastPos) return;   // pointer off-canvas: nothing to anchor
		const datum = snapNode(this.lastPos);
		this.readout.setDatum(datum);
		this.overlayUi.datum(datum);
	}

	// 'w' drops/threads a waypoint: mid-route it adds a bend (the button is still held), idle it
	// places a standalone one. The one mutating verb that belongs DURING a gesture.
	onWaypointKey(evt) {
		if (this.mode === 'link') { evt.preventDefault(); return this.dropRouteWaypoint(); }
		if (!this.mode) { evt.preventDefault(); this.placeWaypoint(); }
	}

	// A1 — tap to ARM/disarm the text tool. A toggle, not a held key; auto-repeat ignored.
	onTextTool() {
		this.textTool = !this.textTool;
		this.svg.classList.toggle('texttool', this.textTool);
	}

	onReshape() {
		const cmd = commands.reshapeNodes(this.model, this.selection.list());
		if (cmd.entries.length) this.history.commit(cmd);
	}

	// ---- the stamp hand. Idle-only: a held press owns the selection and the pointer. ----
	onHandDigit(evt) {
		if (this.mode) return;
		this.palette.toggleHand(evt.key === '7' ? 'waypoint' : NODE_TYPES[Number(evt.key) - 1]);
		this.refreshHand();
	}

	onPipette() {
		if (this.mode) return;
		const over = this.lastPos && nodeAt(this.model, this.lastPos);
		this.palette.setHand(over ? over.type : null);
		this.refreshHand();
	}

	onStampKey(evt) {
		if (this.mode || !this.palette.hand) return;
		// mouseless chaining: stamp at the ghost, then re-evaluate the cell — it is occupied now,
		// and the feedback must say so without a mouse move
		evt.preventDefault();
		if (this.lastPos) { this.stampAt(this.lastPos); this.refreshHand(); }
	}

	onArrowKey(evt) {
		evt.preventDefault();
		const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[evt.key];
		if (!dir) return;
		// Shift+arrow resizes the lone selected zone OR grows the lone selected node's span; plain
		// arrow nudges. Both resize paths self-guard on the selection kind, so only one acts.
		if (evt.shiftKey) { this.resizeZoneByKey(dir[0], dir[1]); this.resizeNodeByKey(dir[0], dir[1]); }
		else this.nudge(dir[0], dir[1]);
	}

	onWrapKey(evt) { evt.preventDefault(); this.wrapInZone(); }
	onCloseKey(evt) { evt.preventDefault(); this.toggleClosePath(); }
	onChainKey(evt) { evt.preventDefault(); this.linkSelectedNodes(evt.shiftKey); }

	onRenameKey(evt) {
		evt.preventDefault();
		// prefer the directly-clicked entity: group expansion makes single selection impossible
		// for grouped nodes
		const ids = this.selection.list().filter((id) => kindOf(id) !== 'link' && kindOf(id) !== 'group');
		const target = (this.focusId && ids.includes(this.focusId)) ? this.focusId : (ids.length === 1 ? ids[0] : null);
		if (target) this.labels.open(kindOf(target), target);
	}

	// D21 — reverse another writer's whole run in one action. Deliberately NOT Ctrl+Z: taking back N
	// changes you did not make is a different intent from stepping back one you did.
	onUndoRun(evt) { evt.preventDefault(); this.history.undoRun(); this.afterHistory(); }
	onUndoKey(evt) { evt.preventDefault(); evt.shiftKey ? this.history.redo() : this.history.undo(); this.afterHistory(); }
	onRedoKey(evt) { evt.preventDefault(); this.history.redo(); this.afterHistory(); }
	onDuplicate(evt) { evt.preventDefault(); this.duplicateSelection(); }   // claims the bookmark shortcut

	onGroupKey(evt) {
		evt.preventDefault();
		if (evt.shiftKey) {
			const groups = new Set(this.selection.groupable().map((id) => this.model.groupOf(id)).filter(Boolean).map((g) => g.id));
			this.history.commit(commands.ungroupAll(this.model, [...groups]));
		} else {
			this.history.commit(commands.createGroup(this.model, this.selection.groupable()));
		}
	}

	onDeleteKey(evt) {
		if (this.selection.size() === 0) return;
		evt.preventDefault();
		this.history.commit(commands.deleteSelection(this.model, new Set(this.selection.list())));
		// selection auto-prunes on the delete's emits (selection.js)
	}

	/*
	Event handlers stay HERE and delegate. INPUT.md §8 splits it that way: input owns the wiring to
	the DOM, overlay owns the state and the drawing. (Deleted twice during H6 by slices that ran to
	`onKeyUp` — the second time is why they now sit above the key handlers, out of the blast radius.)
	*/
	onHover(evt, on) {
		this.overlayUi.hover(hitOf(evt), on, evt, this.isGesturing());
		this.overlayUi.arm(evt, { readOnly: this.readOnly, gesturing: this.isGesturing() });
	}

	syncZoneGrid(evt) {
		this.overlayUi.zoneGrid(evt.shiftKey, this.mode === 'move' || this.mode === 'clone');
	}

	onKeyUp(evt) {
		if (evt.key === 'Shift') {
			this.svg.classList.remove('zonegrid');
			if ((this.mode === 'move' || this.mode === 'clone') && this.lastPos) {
				// re-render with the lock released: the commit follows the frame
				this.updateMove(this.lastPos, false);
			}
			// the zone layer just went inert: a hovered zone must drop its states
			if (this.overlayUi.hovered && kindOf(this.overlayUi.hovered) === 'zone') {
				this.renderer.clearState(this.overlayUi.hovered, 'hover');
		
				this.overlayUi.disarm();
			}
		}
		if (evt.key === 'Alt' || evt.key === 'Control') this.overlayUi.arm(evt, { readOnly: this.readOnly, gesturing: this.isGesturing() });
	}

	afterHistory() {
		// selection auto-prunes on del emits (selection.js); render() re-applies 'selected' from the
		// renderer's selectedSet whenever undo/redo re-renders an entity — so no manual re-reflect here.
		this.refreshHand(); // undo/redo can change occupancy under a stationary cursor
	}
}
