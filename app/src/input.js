/*
Input — pointer/keyboard state machine. Two-button gestures (`dev/DECISIONS.md` decision 2):
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
import { RECOGNIZE, DOUBLE_CLICKS } from './recognize.js';
import { KEYMAP, KEY_RELEASES } from './keymap.js';
import { composeRules, resolveInput } from '../../kernel/input-rules.mjs';
import { nodeAt, endpointAt, occupiedAt, occupiedAnyAt, inFootprint, footprintHits } from './pick.js';
import { CANVAS, GAP, HALF, NODE_R, NODE_EXT, ZONE_EXT, spanExtent, orthoDelta, snappedDelta, clampDelta, resizeBox, snapNode, snapZone, resolveBox, pointInBox, dist, zoneCorners, OPPOSITE_CORNER } from './snap.js';
import { el, crosshair, previewRect, previewLine, previewPath, isShown, setShown, layerOf } from './painter.js';
import { emitToHost } from './capture.js';
import { initialInputState, track } from './input-state.js';
import { DRAG_THRESHOLD, dragging, releaseTrigger } from './triggers.js';
import { roundedPath, BEND_R } from '../../kernel/index.mjs';
import { newId, kindOf } from '../../model/index.mjs';
import { splitAtBend, pairHolders } from '../../model/invariants.mjs';
import { NODE_TYPES } from './palette.js';
import * as commands from './commands.js';
import { situationOf, inReadView, onEndpoint, onOpenGround } from '../../engine/index.mjs';

// run mode's presses as rows of the Rules engine -- see `runModePress` for what each means and why they live here
export const RUN_PRESSES = [
	{ id: 'toggle-spawn', mutates: true,  prevent: false, on: (e) => e.button === 0 && !!e.region?.waypoint, when: (s) => inReadView(s) && onEndpoint(s), run: 'toggleSpawnHere' },
	{ id: 'place-tower',  mutates: true,  prevent: false, on: (e) => e.button === 0 && !!e.region && !e.region.control && !e.region.overWaypoint && !e.region.entity,
		when: (s) => inReadView(s) && onOpenGround(s), run: 'placeTowerHere' },
	{ id: 'fire-action',  mutates: false, prevent: false, on: (e) => e.button === 0 && !!e.region?.action, run: 'fireActionHere' },
	{ id: 'open-input',   mutates: true,  prevent: false, on: (e) => e.button === 0 && !!e.region && e.region.input !== null && !e.region.action, run: 'openInputHere' },
];

const ARROW = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

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
		/*
		B203 -- a LEFT drag never moves a waypoint. Left is the link button on a waypoint, and the
		gesture it must not turn into is a move.

		Two rules produce this gesture: `r-press` on the right button and `press` on the left. The
		left one is the click-to-select path shared with every other kind, so a waypoint cannot
		simply leave it -- dropping out of `press` would take selection with it. What is suppressed
		is the ESCALATION: the press still selects, the drag just never becomes a move.

		`link` claims a left drag on a waypoint, as it does on a node -- B211 removed the FREE
		condition so a junction can be started from a bend. Before that, a waypoint carrying a link
		fell through to here, and the escalation turned the link button into the move button for
		exactly the waypoints that are part of a route. That was the defect the director reported.
		*/
		update: (i, pos, evt) => i.escalate(pos, evt,
			i.readOnly || i.ctx.hit.kind === 'link' || (i.ctx.hit.kind === 'waypoint' && i.ctx.leftPress),
			(x, p) => x.startMove(p), 'move'),
		start: (i, hit, pos, evt) => {
			i.beginPress(hit, pos, evt.shiftKey && hit.kind !== 'zone');   // for zones Shift is the layer key, not selection-add
			i.ctx.orthoReady = !evt.shiftKey;
			i.ctx.leftPress = evt.button === 0;   // which button opened this press; only the left one is barred above
			return i.ctx;
		}
	},

	'clone-pending': {
		commit: (i, ctx) => {
			// Ctrl+click without drag: toggle selection (draw.io behavior)
			if (i.model.get(ctx.hit.kind, ctx.hit.id)) {
				i.selection.toggle(ctx.hit.id);
				i.labels.setFocus(ctx.hit.id);
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
			const fixedCorner = zoneCorners(zone)[OPPOSITE_CORNER[hit.id]];
			return { zone: zoneId, fixedCorner, before: { x: zone.x, y: zone.y, w: zone.w, h: zone.h } };
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
				// commit a genuine retarget. A routed link may join a pair that already has links;
				// a straight one only a pair with room for it (B72, B80) -- the one predicate (RULESET-AUDIT T4)
				const admitted = !pairHolders({ ...link, src: newSrc, dst: newDst }, i.model.linksBetween(newSrc, newDst), i.model).length;
				if (target.id !== wasAt && admitted) {
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
			const hasVia = !!((ctx.route ?? ctx.via)?.length);   // a guided link is no more a plain link than a pinned one
			// a valid endpoint under the cursor: a node / free waypoint, distinct from src, not a via bend
			const validTarget = srcAlive && target && target.id !== ctx.src.id && !(ctx.route ?? ctx.via ?? []).includes(target.id);
			// resolve the destination: the endpoint under the cursor, ELSE end at the LAST dropped
			// waypoint — so releasing after `w` commits the route, terminating at that waypoint
			let dst = validTarget ? target.id : null;
			/*
			`route` is every stop drawn, pins and guides, in order; `via` is the pins alone, which is what the
			link stores. Released on empty ground, the link ends at the LAST STOP -- pin or guide alike, since
			a link cannot end without ending somewhere and its end is always a termination. With no plugin
			every stop is a pin, `route` equals `via`, and this is exactly the old `dst = via.pop()`.
			*/
			const route = [...(ctx.route ?? ctx.via ?? [])];
			const via = [...(ctx.via || [])];
			if (!dst && route.length) {
				dst = route.pop();
				const k = via.indexOf(dst);
				if (k !== -1) via.splice(k, 1);
			}
			/*
			B72 -- a ROUTED link may duplicate an existing pair; a straight one may not.

			The permission is grounded in the route, not in the pair. Two links carrying different
			bends fan out and are both visible, which is the whole point of placing a waypoint
			between two nodes. A second STRAIGHT link renders exactly on top of the first: allowing
			it would trade the silent discard this row was filed for against a silent duplicate,
			which is not an improvement.

			The design end state is up to N parallel connections bounded by the column span
			(`dev/design/walk/FINDINGS.md`, rung `3-parallel3`); that is H10.7 and needs spacing this
			does not attempt. This is the editor rule only.
			*/
			// B80: the refusal is about STRAIGHT links colliding, so it must ask whether a straight
			// one already exists -- not whether anything does. Keying it on `linkBetween` meant a
			// direct link became impossible the moment a routed one was drawn, which made the
			// order a person happened to draw in decide what they could have.
			// judged on every stop DRAWN, pins and guides: with no drag judge they are the same, and with one the judge
			// decides by pins itself (network/guide.mjs) -- the one predicate either way (RULESET-AUDIT T4)
			const admitted = !pairHolders({ src: ctx.src.id, dst, via: route }, i.model.linksBetween(ctx.src.id, dst), i.model).length;
			// with a drag judge (the lab's network plugin) a duplicate reaches it too, so the author is told why nothing is made
			if (dst && srcAlive && dst !== ctx.src.id && (admitted || (i.judgeDrag && !evt.shiftKey))) {
				/*
				A plugin's drag judge sees the whole drawn route before anything commits, and may refuse it. A
				refusal commits nothing and removes the anchors this drag placed, exactly as a cancelled drag does.
				No judge, no question: production commits as it always has.
				*/
				if (i.judgeDrag) {
					/*
					The RECORD of the drag, as it happened -- what it means is the judge's (network/grammar.mjs reads its
					facts from this). `release` says whether it was released ON an anchor or ended at the last stop a key
					made; `route` and `pins` are as the drag leaves them, the destination taken off.
					*/
					const verdict = i.judgeDrag({ src: ctx.src.id, dst, pins: via, route, placed: ctx.placed.map((w) => w.id),
						steps: ctx.steps, release: validTarget ? 'anchor' : 'stop', srcKey: ctx.srcKey ?? false });
					if (!verdict?.ok) {
						/*
						A refusal may name anchors to KEEP. The link is refused; anchors the hook names survive
						and reach the planner in one commit; everything else this drag placed is cleaned up, as a
						cancelled drag's is. The director's report: a refused `g` drag threw away the `g` anchor,
						geometry placed deliberately. Input does not decide what survives -- the hook does, from
						what it knows about the gesture; Input only honours the list.
						*/
						const keep = new Set(verdict?.keep ?? []);
						const kept = ctx.placed.filter((w) => keep.has(w.id));
						i.cleanupRoute({ placed: ctx.placed.filter((w) => !keep.has(w.id)) });
						if (kept.length) i.history.commit(commands.keepAnchors(kept.map((w) => i.model.get('waypoint', w.id) ?? w)));
						return;
					}
				}
				i.commitRoute(ctx, dst, via);     // placed waypoints + the link, one undo step
				if (validTarget && evt.shiftKey && !hasVia) i.chainFrom(target, pos);   // chain only plain links
				return;
			}
			if (validTarget && evt.shiftKey && !hasVia) {
				i.chainFrom(target, pos);   // already-linked target: skip the duplicate but keep the chain run alive
				return;
			}
			// a CLICK (triggers.js: it never travelled past the threshold) AT the drag's own start. For a press the second half
			// follows from the first; a chained run is ended by a press elsewhere, and only one on its anchor selects it
			if (srcAlive && !hasVia && evt.trigger === 'click' && dist(pos, ctx.start) <= DRAG_THRESHOLD) {
				const hand = i.palette.hand;
				// fast-replace gate mirrors the stamp gate (plain click only) and never fires on a
				// chain anchor (that click ends the run, selecting)
				if (i.model.get('node', ctx.src.id) && hand && hand !== 'waypoint' && !i.state.chained
					&& !evt.shiftKey && !evt.ctrlKey && !evt.altKey && hand !== ctx.src.type) {
					i.history.commit(commands.retypeNode(ctx.src.id, hand));
					i.selection.set([ctx.src.id]);
					i.labels.setFocus(ctx.src.id);
					return;
				}
				// a no-drag press is still a click: select (mirrors beginPress semantics)
				i.labels.setFocus(ctx.src.id);
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
			const sole = i.selection.list();
			const srcKey = i.state.armed.source === src.id && sole.length === 1 && sole[0] === src.id ? 'w' : false;
			i.ctx = i.linkDrag(src, pos, { shift: evt.shiftKey, srcKey });
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
			if (evt.trigger === 'click') {   // one rule for click and drag (triggers.js), no longer the box's size
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
			i.palette.setTextTool(false);   // one box per arm — re-tap 't' for another
			// open the inline editor on the text region, positioned over the new box's frame
			i.labels.openFrame(tb.id);
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
	/*
	`host` is the surface that owns GLOBAL key events and receives outbound host actions — `window` in
	the browser. Injected rather than reached for (B45): Input is the class H6 exists to decompose, and
	a module that grabs its own collaborators cannot be composed differently or tested without a global.
	`help` arrives the same way; main.js already had that element, and resolving it twice meant two
	owners of one node.
	*/
	constructor({ svg, model, history, selection, renderer, labels, readout, palette, host, help, snap, now, plugins = [] }) {
		this.svg = svg;
		/*
		The route hook -- how the incubating network plugin (ruled 2026-09-28) sees a finished link drag
		before it commits. The lab passes one; production passes none, and then `g` is inert and every
		drag commits exactly as it always has (tests/guide-gesture.test.js holds that byte for byte).
		The hook is asked once per drag, for the WHOLE route: a guide is not in the link's intent, so
		whether the route passes it is a property of the whole route, not of any one leg.
		*/
		/*
		PLUGINS -- what a composition adds to the product's Input (dev/RULES.md section 11). A plugin brings its own key
		rows, owned by it and composed beside the product's, and may judge a finished link drag. Production passes none.

		Each run a plugin's row names is handed `pluginHost`, ONE generic verb -- add a stop to the drag, pinned or not --
		rather than this Input: a plugin acts through what the product declares, never through its internals. A plugin
		with anything else on it is refused, and so is a second judge: two judges of one drag would need a precedence.
		*/
		for (const p of plugins) {
			const stray = Object.keys(p).filter((k) => !['owner', 'keys', 'judgeDrag'].includes(k));
			if (typeof p.owner !== 'string' || stray.length) throw new Error(`Input: a plugin is { owner, keys, judgeDrag }${stray.length ? ` -- not ${stray.join(', ')}` : ' and names its owner'}`);
		}
		const judges = plugins.filter((p) => p.judgeDrag);
		if (judges.length > 1) throw new Error(`Input: two plugins judge the link drag (${judges.map((p) => p.owner).join(', ')}) -- one may`);
		this.judgeDrag = judges[0]?.judgeDrag ?? null;
		// the key table: the product's rows and each plugin's, through the Rules engine
		this.keyRules = composeRules({ owner: 'product', rules: KEYMAP }, ...plugins.map((p) => ({ owner: p.owner, rules: p.keys ?? [] })));
		this.pluginHost = { addStop: (step) => this.addStop(step) };
		// the pointer's tables on the same engine (stage 4): which gesture a press starts, a double click, a key release
		this.pressRules = composeRules({ owner: 'product', rules: RECOGNIZE });
		this.doubleRules = composeRules({ owner: 'product', rules: DOUBLE_CLICKS });
		this.releaseRules = composeRules({ owner: 'product', rules: KEY_RELEASES });
		this.runRules = composeRules({ owner: 'product', rules: RUN_PRESSES });
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
		// TOTAL, per the note above: `textTool`, `setTextTool`, `holding` and `releaseTools` joined the
		// palette's surface at H6.13 and belong here too, or `bare` construction throws on the first `t`.
		this.palette = palette || { hand: null, textTool: false, setHand() {}, toggleHand() {}, trackHand() {},
			hideHand() {}, setTextTool() {}, holding() { return false; }, releaseTools() {} };
		/*
		H12.4/H12.7 -- the agreed instant, injected as a FUNCTION rather than reached for.

		Input does not own a clock and must not know that one is negotiated with the server. It is
		handed `now` and asks it; the seam that makes the offset shared lives in `app/src/clock.js`
		and is wired by the composition root. Defaulting to the local clock keeps bare construction
		total, exactly as the readout and palette null objects above do -- a default that throws is
		a trap, and this tree has already paid for one.
		*/
		this.now = typeof now === 'function' ? now : () => Date.now();
		// L1: what the input has done, as one value -- the pointer, the armed `w`, a chain (app/src/input-state.js)
		this.state = initialInputState();
		this.overlay = layerOf(svg, 'overlay');
		// H6.3 — transient feedback is overlay.js's: hovered, armed, the datum marker and the
		// crosshair moved with it. Input keeps only what a GESTURE needs (mode, ctx, and the input state).
		this.overlayUi = new Overlay({ svg, model, selection, renderer, snap });
		this.mode = null; // null | pending | clone-pending | move | clone | link | zone | marquee | resize
		this.ctx = {};


		this.lastDelta = { x: GAP, y: 0 }; // remembered pitch for Ctrl+D duplicate
		this.readOnly = false; // Server-Locked: inspect + select only, no mutations
		// D12 — fires when an in-flight gesture ends, however it ends. Sync listens so inbound changes
		// deferred during the gesture replay at exactly the moment the preview stops moving (B19).
		this.onGestureEnd = () => {};
		this.help = help;

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

		// the DOM listeners are capture's (app/src/capture.js, L0): this receives input events, never DOM events
		this.host = host;
	}

	// the pointer left the canvas: keys must never act on a stale off-canvas position
	leave() {
		this.readout.setCursor(null);
		this.palette.hideHand();
		this.state = track(this.state, { type: 'leave' });
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
			this.palette.releaseTools();   // B42 — every armed tool, not a list someone has to maintain
			this.overlayUi.disarm();
		}
	}

	/*
	One press → one rule → one gesture. The 167-line nest this replaces is now three things: a
	surface-mode guard, a live-gesture hook, and an ordered table (app/src/recognize.js).
	*/
	press(evt) {
		// L1 first: every press moves the pointer, hands the armed `w` over, and ends a chain (app/src/input-state.js)
		this.state = track(this.state, evt);
		// W5 — RUN mode: the diagram ACTS as UI, and is not a gesture surface at all. A guard rather
		// than a rule, because it is a mode of the whole surface (INPUT.md §4).
		if (this.renderer.mode === 'run') return this.runModePress(evt);

		// chain wiring: the live gesture CONSUMES this press. Not a rule about starting one.
		if (this.mode === 'link' && evt.button === 0) return;   // the press already ended the chain (input state)

		if (this.labels.isOpen()) this.labels.close(true);
		this.palette.hideHand();

		/*
		THE w THAT PLACED THE SOURCE -- ruled 2026-09-30: it counts as the drag's first key "if that same anchor remains
		the sole selected anchor, and the next gesture is a drag". Every press consumes it -- the input state hands it from
		`armed.placed` to `armed.source` -- and the link drag's start keeps it only if it begins on that anchor while it is
		still the sole selection.
		*/
		const hit = evt.on;
		const pos = evt.at;
		// the ONE row this press means (Rules engine): read-only is the engine's guard, and a held tool is the situation's
		const { rule } = resolveInput(this.pressRules, evt, this.situation(), { readOnly: this.readOnly });
		if (!rule) return;

		if (this.mode) this.cancelDrag(evt);   // a second press never stacks on an active gesture
		this.overlayUi.zoneGrid(evt.shiftKey, false);
		evt.capture = true;   // capture takes the pointer once this returns (app/src/capture.js)

		if (rule.run) return this[rule.run](hit, evt, pos);
		const handler = GESTURES[rule.gesture];
		this.mode = rule.gesture;
		this.ctx = handler.start(this, hit, pos, evt) || {};
	}


	/*
	H12.7 -- the situation this surface is in, as a VALUE.

	Everything transient is gathered here and nothing downstream reaches back for more. That is what
	lets a decision be a predicate rather than a walk through `this`: `engine/situation.mjs` owns the
	description, the rule reads it, and neither can see a DOM.
	*/
	situation(targetId = null, gesture = null) {
		return situationOf({
			get: (kind, id) => this.model.get(kind, id),
			linksTouching: (id) => this.model.linksAt?.(id) || [],
		}, {
			mode: this.renderer.mode,
			readOnly: this.readOnly,
			targetId,
			selection: this.selection.list(),
			tool: !!this.palette.textTool,
			...(gesture ? { gesture, step: this.stepUnderPointer() } : {}),
		}, this.now());
	}

	/*
	RUN MODE -- the diagram acting as UI (W5): a press means what the situation says, through the Rules engine (stage 4).

	  toggle-spawn   in read view, on an endpoint waypoint: arm or disarm it. The PILOT rule -- the same click selects that
	                 waypoint in author view, which is B163 stated as a feature
	  place-tower    in read view, on open ground: place a tower, where the cell is free. The SECOND rule, the same shape --
	                 two instances are what made a pattern of it. Placement is intent and rides the document; a tower
	                 FIRING is derived by every peer from the board and the clock, so it never travels
	  fire-action    on a `data-action` region: hand the host `draw:action` (W5). It commits nothing, so it stays live on a
	                 locked client -- run mode straddles the gate
	  open-input     on a `data-input` region: open the inline editor. It authors, so a locked client does not (B18)

	Each authoring row is refused on a locked client by the engine's guard; each handler claims the press only on the path
	that acts. Defined here, beside their handlers, because they ask the situation's own terms (engine/situation.mjs),
	which the canvas tables cannot import until the situation leaves the simulation layer (cut K5).
	*/
	runModePress(evt) {
		const { rule } = resolveInput(this.runRules, evt, this.situation(evt.region?.waypoint ?? null), { readOnly: this.readOnly });
		if (rule) this[rule.run](evt);
	}

	toggleSpawnHere(evt) {
		evt.claimed = true;
		const wp = evt.region.waypoint;
		const cmd = commands.toggleSpawn(this.model, wp, this.situation(wp).at);
		if (cmd) { this.history.commit(cmd); this.afterHistory(); }
	}

	placeTowerHere(evt) {
		const snapped = snapNode(evt.at);
		if (occupiedAnyAt(this.model, snapped)) return;   // a taken cell places nothing
		evt.claimed = true;
		const node = this.model.makeNode('loadbalancer', snapped);
		this.history.commit(commands.createEntity('node', node));
		this.afterHistory();
	}

	fireActionHere(evt) {
		evt.claimed = true;
		emitToHost(this.host, 'draw:action', { action: evt.region.action, id: evt.region.node });
	}

	openInputHere(evt) {
		evt.claimed = true;
		if (evt.region.node) this.labels.openRegion(evt.region.node, evt.region.input);
	}


	deleteUnderCursor(hit) {
		if (this.isGesturing()) return;
		// B258: `deleteSelection` takes a Set -- an Array threw on `ids.has` whenever the board held a link
		this.history.commit(commands.deleteSelection(this.model, new Set([hit.id])));
		this.afterHistory();
	}


	beginPress(hit, pos, shift) {
		this.mode = 'pending';
		this.ctx = { hit, start: pos, shift };
		this.labels.setFocus(hit.id); // F2's deterministic target within group selections
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
		const result = commands.cloneSubgraph(this.model, this.selection.list());
		if (!result) { this.mode = null; this.ctx = {}; return; }
		const { clones, idMap } = result;

		// the clones come back inert. A drag has to SHOW them, so they go into the live model here —
		// I-IN5, live preview writes the shared Model. Ctrl+D never materialises them at all.
		clones.forEach((c) => this.model.put(c.kind, c.entity));

		const moved = clones
			.filter((c) => c.kind === 'node' || c.kind === 'zone')
			.map((c) => ({ kind: c.kind, id: c.entity.id, before: { x: c.entity.x, y: c.entity.y } }));
		this.mode = 'clone';
		this.ctx = { ...this.ctx, clones, moved, baseKind: hit.kind, baseId: idMap.get(hit.id) };
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
		const result = commands.cloneSubgraph(this.model, seeds);
		if (!result) return;

		// the clones are inert objects, so the pitch is applied to them directly. This used to put
		// them live, model.set each one, then read every position back out — three steps to do what
		// the commit does anyway.
		result.clones.forEach((c) => {
			if (c.kind === 'node' || c.kind === 'zone') { c.entity.x += delta.x; c.entity.y += delta.y; }
		});
		this.history.commit(commands.cloneEntities(result.clones));
		const placed = result.clones.filter((c) => c.kind === 'node' || c.kind === 'zone');
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
	// Z — wrap the selection in a fitted zone. The box arithmetic is commands.wrapSelection's (B46);
	// what stays is the consequence: select the new zone and say what was made.
	wrapInZone() {
		const cmd = commands.wrapSelection(this.model, this.selection.list());
		if (!cmd.entries.length) return;   // empty or link-only selection
		const zone = cmd.entries[0].entity;
		this.history.commit(cmd);
		this.selection.set([zone.id]);
		this.readout.flash(`zone ${this.readout.dims(zone.w, zone.h)}`);
	}

	/*
	C — close / open the lone selected route. A closed route loops dst → src as a rounded
	polygon (the router's close arg rounds the src/dst corners too). Only a multi-hop route
	(≥1 waypoint) can close — a plain 2-point link would just double back on itself. Toggles,
	as one undoable set on the link's `closed` flag.
	*/
	// reached only through the `close` row -- ONE link with a bend is selected -- so it asks nothing (dev/RULES.md section 11)
	toggleClosePath() {
		const link = this.model.get('link', this.selection.list()[0]);
		const closed = !link.closed;
		this.history.commit(commands.toggleClosed(link));
		this.readout.flash(closed ? 'path closed' : 'path open');
	}

	/*
	H15.6 -- F cycles the selected link's declared direction.

	Single selection only, and a link. The same shape as `toggleClosePath` above, for the same
	reason: a declaration is a statement about ONE path, and applying it to a multi-selection would
	have to guess whether the author meant each link's own stored order or some shared direction --
	and those differ the moment two links are stored facing opposite ways.
	*/
	cycleLinkFlow() {
		const ids = this.selection.list();
		if (ids.length !== 1 || kindOf(ids[0]) !== 'link') return;
		const link = this.model.get('link', ids[0]);
		if (!link) return;
		const cmd = commands.cycleFlow(link);
		this.history.commit(cmd);
		/*
		B227 -- SAY THE WHOLE RELATION, not just what changed.

		`flow reverse` names the step and leaves the author to work out what it now means, which on
		a link whose stored order they never chose is a puzzle rather than feedback. The endpoints
		with an arrow between them says the RESULT, and the arrow is the same fact the canvas draws
		-- so the readout and the picture cannot disagree.

		`<->` for undeclared, because a symmetric link is not a link with no relationship; it is one
		that carries flow both ways as far as anything here is concerned.
		*/
		// B229 -- no flash. The SELECTION line carries the relation persistently, so a receipt that
		// vanishes after 1200ms would say the same thing worse: the author would have to remember
		// it, or press again to see where they are in the cycle.
		this.readout.render();
	}

	/*
	H15.15 -- K toggles the selected link between the control plane and the data plane.

	Single selection only, the same shape as `f` and `toggleClosePath` above: a plane is a statement
	about ONE link, and a multi-selection would have to guess whether the author meant to set them
	all control or to flip each independently.
	*/
	toggleLinkPlane() {
		const ids = this.selection.list();
		if (ids.length !== 1 || kindOf(ids[0]) !== 'link') return;
		const link = this.model.get('link', ids[0]);
		if (!link) return;
		this.history.commit(commands.toggleControl(link));
		this.readout.render();   // the selection line carries the plane, as it carries the direction
	}

	// L / Shift+L — the wiring itself is commands.linkNodes'; what stays is selecting the result
	// and saying how many landed.
	linkSelectedNodes(star) {
		const nodes = this.selection.selectedNodes(); // Set insertion order
		if (nodes.length < 2) return;
		const cmd = commands.linkNodes(this.model, nodes, star);
		if (!cmd.entries.length) return;
		this.history.commit(cmd);
		const ids = cmd.entries.map((e) => e.entity.id);
		this.selection.set(ids);
		this.readout.flash(`+${ids.length} link${ids.length > 1 ? 's' : ''}`);
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
			this.labels.setFocus(wp.id);
			return true;
		}
		if (occupiedAt(this.model, snapped)) return false;
		const node = this.model.makeNode(type, snapped);
		this.history.commit(commands.createEntity('node', node));
		this.selection.set([node.id]); // the hand stays armed; selection follows
		this.labels.setFocus(node.id);
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
		if (!this.state.pointer.at) return false;
		const snapped = snapNode(this.state.pointer.at);
		if (occupiedAnyAt(this.model, snapped)) return false;
		/*
		B162: placed deliberately, with no link -- so it carries `pinned`.

		Every other waypoint is part of a path and its role is derived from the links: a bend in
		`via`, an endpoint at `src`/`dst`, a bend again on a closed ring because a ring has no ends.
		This one has no link to read an intention off, and the orphan sweep would take it. `pinned`
		is the only fact about a waypoint worth storing, and it means exactly "the author meant this
		to exist". Threading a link through it clears it -- from then on it shares the link's fate.
		*/
		const wp = { ...this.model.makeWaypoint(snapped), pinned: true };
		this.history.commit(commands.createEntity('waypoint', wp));
		this.state = track(this.state, { type: 'armed', id: wp.id });   // may count as the next drag's first key (see press)
		this.selection.set([wp.id]);
		this.labels.setFocus(wp.id);
		return true;
	}

	/*
	A link drag's context -- ONE shape, whichever way the drag began (B261: a chained drag lacked `route`, and `w` threw).

	`via` is what the link will STORE, its pins; `route` is every stop in drawn order, pinned or not, for the preview
	and a drag judge; `placed` holds the waypoints the drag put on the tab, committed on release or cleaned up. `steps`
	is the drag as it happened: each key that acted, and the stop it made -- what a plugin reads to know how its stops
	came to be, instead of flags set along the way. With no plugin every stop is a pin, so `route` is `via`.
	*/
	linkDrag(src, pos, { shift = false, srcKey = false } = {}) {
		return { src, path: previewPath(this.overlay), target: null, start: pos, shift, srcKey,
			via: [], route: [], placed: [], steps: [] };
	}

	/*
	A DRAG STEP -- the one verb a key uses to add a stop to the link being drawn: the product's `w`, and a plugin's
	keys through `pluginHost` (network/keys.mjs). What the step MEANS is not decided here; this places or threads an
	anchor and records which key made it.

	  key     the key that made the step, recorded in `steps`
	  pin     whether the stop joins `via` -- the link connects there -- or only the route it passes
	  nodes   whether a node may be the stop; a pin never is one, since a pin is always a waypoint

	An EXISTING anchor at the step is threaded; an empty cell gets a new waypoint, live so it renders, committed on
	release; a cell a node occupies is refused.
	*/
	addStop({ key, pin, nodes = false }) {
		if (!this.state.pointer.at) return;
		const ctx = this.ctx;
		const snapped = snapNode(this.state.pointer.at);
		const existing = this.model.waypointAt(snapped) ?? (nodes ? nodeAt(this.model, this.state.pointer.at) : null);   // occupancy index (R13)
		if (existing && pin) {
			if (existing.id === ctx.src.id) return;        // don't thread the source itself
			/*
			B210 -- an OCCUPIED waypoint may be threaded, and that is how a junction is made. Nothing splits here: the
			waypoint joins `via` like any other and the route carries on, so several bends in one drag still work. The
			split is computed on RELEASE, in commitRoute, because until the button comes up there is no link to make a
			junction with.

			B162 -- threading a PINNED waypoint clears the pin. The pin means "the author placed this deliberately, with no
			link". Once a link runs through it, it is part of that link's shape and should go when the link goes; leaving
			the pin would strand it on the canvas forever, the debris the sweep exists to prevent. A stop that is not a pin
			leaves the flag alone: the link does not become that anchor's structure.
			*/
			if (existing.pinned) this.model.set('waypoint', existing.id, { pinned: false });
			if (!ctx.via.includes(existing.id)) { ctx.via.push(existing.id); ctx.route.push(existing.id); }
		} else if (existing) {
			if (existing.id === ctx.src.id || ctx.route.includes(existing.id)) return;
			ctx.route.push(existing.id);
		} else {
			if (occupiedAt(this.model, snapped)) return;        // a node cell -- refuse
			const wp = this.model.makeWaypoint(snapped);
			this.model.put('waypoint', wp);            // live (visible); committed on release
			if (pin) ctx.via.push(wp.id);
			ctx.route.push(wp.id);
			ctx.placed.push(wp);
		}
		ctx.steps.push({ key, stop: existing ? existing.id : ctx.route[ctx.route.length - 1] });
		this.updateLinkPreview(this.state.pointer.at);
	}

	// the live route preview: a rounded polyline through src → threaded waypoints → cursor/target
	updateLinkPreview(pos) {
		const target = endpointAt(this.model, pos);
		const end = target ? { x: target.x, y: target.y } : snapNode(pos);
		// the cursor is a free ANCHOR — pathOf resolves the rest of the route around it
		// through every stop drawn so far, guides included, so the author sees the route they are drawing
		const path = this.model.pathOf({ src: this.ctx.src, via: this.ctx.route ?? this.ctx.via, dst: end });
		if (path) this.ctx.path.update(roundedPath(path, BEND_R));
	}

	/*
	Commit a finished route: the materialised waypoints + the link (with via) as ONE undo step.

	No eager put. This one made a single link, so it never had the batch-allocation problem the clone
	and chain paths had — it was writing the link live a line before `history.commit` re-put it
	through `applyOps` anyway. Verified redundant by removing it against a real route gesture (H6.11).
	*/
	commitRoute(ctx, dstId, via) {
		const link = { ...this.model.makeLink(ctx.src.id, dstId), ...(via && via.length ? { via: [...via] } : {}) };
		this.history.commit(commands.routeLink(ctx.placed, link, this.splitsFor(link)));
		this.selection.set([link.id]);
	}

	/*
	B210 -- every existing link this new one turns into a junction, and how it divides.

	A junction is terminations only, so a link that BENT through a waypoint the new route also
	touches has to be cut there: both halves then terminate at it, and the meet is structural
	rather than asserted. Only waypoints this link actually touches are considered, and only links
	that were already bending through one of them -- a link merely terminating there is already
	part of the meet and needs no change.

	Both halves get NEW ids. The original is replaced rather than edited into one half, so nothing
	is left holding a route that no longer describes what is on screen.
	*/
	splitsFor(link) {
		/*
		B213 -- every existing link this new one cuts, and how each divides.

		A junction is terminations only, so a link that BENT through a waypoint the new route ENDS
		at has to be cut there. Only the new link's ends are considered: threading a bend leaves it
		a bend (B211).

		THE SRC HALF KEEPS THE ORIGINAL ID. `splitAtBend` returns [src-half, dst-half], so the piece
		carrying the route's original `src` is index 0 and inherits the identity. That is what makes
		the collapse deterministic -- rejoining the pair restores the id the author drew rather than
		minting a third.

		PIECES ARE RE-CUT, not the original. Both ends of the new link may be bends of the SAME link:
		`a->b via [w1,w2]` dragged from w1 to w2 must cut twice, and the second cut applies to
		whichever PIECE now carries w2 -- which after the first cut is the dst half, not the one that
		kept the id. Cutting the dead original twice produced four links describing a route that no
		longer existed; a `seen` guard against that skipped the second cut instead, leaving the far
		end a bend, which is what the director saw.
		*/
		const ends = [link.src, link.dst];
		const originals = new Map();     // original id -> { original, pieces: [] }

		for (const w of ends) {
			if (!this.model.get('waypoint', w)) continue;
			for (const other of this.model.linksAt?.(w) || []) {
				if (other.id === link.id) continue;
				const g = originals.get(other.id) || { original: other, pieces: [other] };
				originals.set(other.id, g);
				// the piece that currently bends through w is the one to cut
				const i = g.pieces.findIndex((p) => (p.via || []).includes(w));
				if (i === -1) continue;
				const halves = splitAtBend(g.pieces[i], w);
				if (!halves) continue;
				g.pieces.splice(i, 1, ...halves);
			}
		}

		const out = [];
		for (const { original, pieces } of originals.values()) {
			if (pieces.length < 2) continue;                       // nothing was cut
			// index 0 is the src end of the original route, wherever the cuts fell
			const halves = pieces.map((p, i) => (i === 0
				? { ...this.model.makeLink(p.src, p.dst), ...p, id: original.id }
				: { ...this.model.makeLink(p.src, p.dst), ...p, id: newId('link', this.model.collection('link')) }));
			out.push({ original, halves });
		}
		return out;
	}

	// abandon an in-progress route: drop any waypoints placed during this draw
	cleanupRoute(ctx) {
		[...(ctx.placed || [])].reverse().forEach((wp) => this.model.del('waypoint', wp.id));
	}

	/*
	One move → the live gesture's own `update`. The mode switch this replaces was eight branches
	deep; each is now the entry that owns the rest of that gesture's lifecycle.
	*/
	move(evt) {
		this.state = track(this.state, evt);
		const moving = this.mode === 'move' || this.mode === 'clone';
		this.overlayUi.zoneGrid(evt.shiftKey, moving);
		const pos = evt.at;

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
		if (!dragging(this.state)) return;   // not a drag yet: the one rule (triggers.js)
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
		const hit = evt.on;
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
	release(evt) {
		const wasGesturing = this.isGesturing();
		evt.trigger = releaseTrigger(this.state);   // L2: a click or a drop, from the press the input state tracked
		try { this.dispatchUp(evt); } finally {
			this.state = track(this.state, evt);   // the press is over
			if (wasGesturing) this.onGestureEnd();
		}
	}

	/*
	One release → the live gesture's own `commit`. The 168-line mode ladder this replaces ended with
	a trailing `onGestureEnd()` that only `resize` could reach, because every other branch returned
	early (B43). `onUp`'s `finally` is now the single owner of that hook, so it fires exactly once per
	gesture BY CONSTRUCTION rather than by fourteen branches each remembering to return. (`onUp` is `release` since
	stage 1 of the gesture system: capture hands it an input event.)
	*/
	dispatchUp(evt) {
		if (!this.mode) return;
		const g = GESTURES[this.mode];
		if (g.ignoreUp?.(evt)) return;   // a release this gesture does not accept: stay live
		const pos = evt.at;
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
		this.state = track(this.state, { type: 'chained', at: pos });   // a chain began this drag, not a press (input state)
		this.ctx = this.linkDrag(node, pos);   // B261: the same drag context as any other
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
		if (evt && evt.type === 'cancel') this.state = track(this.state, evt);   // the browser took the pointer: no press
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
		if (this.mode || !this.state.pointer.at) return;
		const snapped = snapNode(this.state.pointer.at);
		const blocked = this.handBlocked(snapped);
		if (this.palette.hand) this.palette.trackHand(snapped, blocked);
		this.readout.setCursor(snapped, this.palette.hand, blocked);
	}

	// datum marker: a small diamond-cross on the snap layer (pointer-inert)

	// ---- handles: zone corners (resize) and link endpoints (re-plug) ----

	// ---- label editing ----
	double(evt) {
		const { rule } = resolveInput(this.doubleRules, evt, this.situation(), { readOnly: this.readOnly });
		if (rule) this[rule.run](evt);
	}

	// the `edit-label` binding: a locked client never reaches here -- the engine's guard refuses it (app/src/recognize.js)
	editUnderPointer(evt) {
		// hit GEOMETRICALLY: pointer capture (taken on every press) retargets the
		// browser-synthesized dblclick to the svg, so what capture says is under it is useless here.
		// Icon hits beat label-strip hits; nearest wins; ties go to the topmost
		// (last-rendered) — the strip is wider than a grid cell, so first-match
		// would resolve to a NEIGHBOUR for nodes one cell apart
		const pos = evt.at;
		// A1 — a TEXT BOX is hit by its whole FOOTPRINT (not just the origin cell), so double-clicking ANYWHERE
		// on the box edits its text. (A plain node / panel still routes to the name-edit / icon test below.)
		const tbs = this.model.all('node').filter((n) => Array.isArray(n.content) && n.content.length === 1 && n.content[0].content === 'text'
			&& inFootprint(n, pos, NODE_R));
		const tb = tbs[tbs.length - 1]; // topmost (last-rendered)
		if (tb) {
			if (this.mode) this.cancelDrag(evt);
			this.selection.set([tb.id]);
			this.labels.setFocus(tb.id);
			return this.labels.openFrame(tb.id);
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
		if (this.mode) this.cancelDrag(evt);
		// rename implies selection: handles/readout/F2 follow the edited entity
		this.selection.set([target.id]);
		this.labels.setFocus(target.id);
		this.labels.open(target.kind, target.id);   // name edit (text boxes are handled by the footprint check above)
	}




	// ---- help overlay ----
	toggleHelp(show) {
		if (!this.help) return;
		setShown(this.help, show === undefined ? !isShown(this.help) : show);
	}

	// ---- keyboard ----
	/*
	One keystroke → one entry → one handler. The 243-line ladder this replaces had three guards
	interleaved at different depths, so whether a key worked depended on which of them it happened to
	sit below (INPUT.md §4). Each entry now declares its own tolerances and the dispatcher applies
	them uniformly.
	*/
	keyDown(evt) {
		// typing contexts (header menu, label editor) never reach here: capture keeps them (app/src/capture.js)
		// the Rules engine finds the ONE row this key means in this situation (dev/RULES.md section 11)
		const { rule, claimed } = resolveInput(this.keyRules, evt, this.situation(null, this.mode), {
			readOnly: this.readOnly,
			helpOpen: !!(this.help && isShown(this.help)),
			gesturing: this.isGesturing(),
		});
		if (claimed) evt.claimed = true;   // B47 — bind a key and you own it
		if (!rule) return;
		if (typeof rule.run === 'function') rule.run(this.pluginHost, evt);   // a plugin's row acts through the host
		else this[rule.run](evt);
	}

	/*
	What the pointer is over during a gesture, as the situation's `step` -- a word, never an element.

	The order is production's own for a `w` mid-drag (`addStop`): a waypoint at the snapped cell first, then a
	node under the pointer. A node's footprint runs between grid points with a margin under half the pitch, so a pointer
	over a node always snaps to a cell that node occupies -- the cell where production's `w` already refuses -- and
	calling that step 'node' changes nothing production does (tests/rules-acceptance.test.js holds the geometry).
	*/
	stepUnderPointer() {
		if (!this.state.pointer.at) return null;
		if (this.model.waypointAt(snapNode(this.state.pointer.at))) return 'waypoint';
		return nodeAt(this.model, this.state.pointer.at) ? 'node' : 'ground';
	}

	// ---- key handlers. Bodies unchanged from the ladder; only their dispatch moved. ----

	onShiftDown(evt) {
		if (this.mode === 'move' || this.mode === 'clone') {
			// re-render the drag NOW: the commit follows the last rendered frame
			if (this.state.pointer.at) this.updateMove(this.state.pointer.at, true);
		} else {
			this.overlayUi.zoneGrid(true, false);
		}
	}

	onArmingKey(evt) {
		if (evt.key === 'Alt') evt.claimed = true;   // keep Firefox's menu bar out of the delete chord
		this.overlayUi.arm(evt, { readOnly: this.readOnly, gesturing: this.isGesturing() });
	}

	// W4/W5 — 'e' toggles EDIT (shows the socket grid), 'r' toggles RUN (content regions act).
	// Either key from its own mode returns to the clean VIEW.
	onEditMode() { this.renderer.setMode(this.renderer.mode === 'edit' ? 'view' : 'edit'); }
	onRunMode() { this.renderer.setMode(this.renderer.mode === 'run' ? 'view' : 'run'); }

	// Tab shows or hides names. It used to toggle a numeric overlay of every coordinate, which was
	// deleted rather than rebound: it was never properly useful, and carrying it forward would have
	// meant keeping an X-ray nobody read to avoid admitting that.
	onLabels(evt) {
		// claim Tab only when the canvas holds focus, so it can still traverse the toolbar. B47
		// records this as a deliberate opt-out from the dispatcher's default claim, and changing
		// the verb behind the key is no reason to change what the key does to focus.
		if (evt.onControl) return;
		evt.claimed = true;
		this.renderer.toggleLabels();
	}

	onEscape(evt) {
		// priority: close help > cancel gesture > disarm the tool > clear hand > clear selection
		if (this.help && isShown(this.help)) return this.toggleHelp(false);
		if (this.mode) this.cancelDrag(evt);
		else if (this.palette.textTool) this.palette.setTextTool(false);
		else if (this.palette.hand) {
			this.palette.setHand(null);
			this.readout.setCursor(this.state.pointer.at ? snapNode(this.state.pointer.at) : null);
		} else this.selection.clear();
	}

	onHelpKey() {
		  // keep Firefox's quick-find out of it
		this.toggleHelp();
	}

	onSelectAll() {
		this.selection.set([
			...this.model.all('node').map((n) => n.id),
			...this.model.all('zone').map((z) => z.id),
			...this.model.all('link').map((l) => l.id)
		]);
	}

	onDatum() {
		if (!this.state.pointer.at) return;   // pointer off-canvas: nothing to anchor
		const datum = snapNode(this.state.pointer.at);
		this.readout.setDatum(datum);
		this.overlayUi.datum(datum);
	}

	onDatumClear() {
		this.readout.setDatum(null);
		this.overlayUi.datum(null);
	}

	// 'w' drops/threads a waypoint: mid-route it adds a bend (the button is still held), idle it
	// places a standalone one. The one mutating verb that belongs DURING a gesture.
	onWaypointKey(evt) {
		if (this.mode === 'link') { evt.claimed = true; return this.addStop({ key: 'w', pin: true }); }
		if (!this.mode) { evt.claimed = true; this.placeWaypoint(); }
	}

	// A1 — tap to ARM/disarm the text tool. A toggle, not a held key; auto-repeat ignored.
	onTextTool() {
		this.palette.setTextTool(!this.palette.textTool);
	}

	onReshape() {
		const cmd = commands.reshapeNodes(this.model, this.selection.list());
		if (cmd.entries.length) this.history.commit(cmd);
	}

	// ---- the stamp hand, and mid-drag chaining. ----
	onHandDigit(evt) {
		// B146: no `7` branch. The waypoint left the palette because it is a routing anchor rather
		// than a node type, and `w` already places one in both states.
		const type = NODE_TYPES[Number(evt.key) - 1];
		if (!type) return;
		// B147: mid-link-drag a digit CREATES that node and carries the run through it
		if (this.mode === 'link') { evt.claimed = true; return this.chainThroughNode(type); }
		if (this.mode) return;
		this.palette.toggleHand(type);
		this.refreshHand();
	}

	/*
	B147 -- place a node mid-drag, end the segment on it, and carry the run on from it.

	A link run could already chain, but only through nodes that ALREADY existed: `chainFrom` restarts
	link mode from whatever the release landed on. So drawing `client -> firewall -> lb -> server`
	was four placements and three separate drags, when the shape is one continuous gesture.

	Deliberately NOT what `w` does. A waypoint threads into the SAME link as a bend -- it is a shape
	in one connection. A node TERMINATES the segment and starts another, because a device is a thing
	the path goes through rather than a corner it turns.

	Per-segment commit, matching `chainFrom` on Shift-release rather than inventing a second
	transaction shape: each hop is its own undo step, which is also what a person expects when they
	undo halfway along a run they are still drawing.
	*/
	chainThroughNode(type) {
		if (!this.state.pointer.at) return;
		const snapped = snapNode(this.state.pointer.at);
		// the same refusal `addStop` makes, for the same reason: a taken cell is taken
		if (occupiedAt(this.model, snapped)) return;
		// the source can die mid-gesture (a peer deleting it), and committing onto a corpse would
		// write a link to nothing
		if (!this.model.endpointOf(this.ctx.src.id)) return;

		const node = this.model.makeNode(type, snapped);
		this.model.put('node', node);          // live, so the preview and the next segment can see it
		const via = [...(this.ctx.via || [])];
		const link = { ...this.model.makeLink(this.ctx.src.id, node.id), ...(via.length ? { via } : {}) };
		/*
		`chainHop`, not `routeLink` -- the kinds are named rather than assumed.

		`routeLink` maps everything in `placed` to `kind: 'waypoint'`, which is correct for a route
		and wrong for a hop, because a hop lands on a NODE. Passing the node through that list built
		a `put/waypoint` carrying a node's fields: the browser applied it locally and the server
		answered `commit rejected - invalid`. B87's shape exactly -- an entry whose kind and payload
		disagree, accepted by the optimistic apply and refused at the boundary.
		*/
		this.history.commit(commands.chainHop(this.ctx.placed, node, link));
		/*
		Retire THIS hop's preview before starting the next one.

		`chainFrom` replaces `this.ctx` with a fresh `previewPath`, so the one being replaced has to
		be taken out of the overlay first or it is simply orphaned there -- the link `commit` handler
		calls `ctx.path.remove()` for exactly this reason before it chains, and this path did not.

		Two symptoms, one cause, both reported from the editor. `.link-live` is `stroke-dasharray:
		10 8`, so each abandoned preview stayed on screen as a dashed line back to the node the run
		had already left. And the overlay sits ABOVE every render layer, so those leftovers read as
		links drawn on top of the glyphs -- which is what made a z-order defect out of a leak.
		*/
		this.ctx.path.remove();
		this.chainFrom(node, this.state.pointer.at);
	}

	onPipette() {
		if (this.mode) return;
		const over = this.state.pointer.at && nodeAt(this.model, this.state.pointer.at);
		this.palette.setHand(over ? over.type : null);
		this.refreshHand();
	}

	onStampKey(evt) {
		if (this.mode || !this.palette.hand) return;
		// mouseless chaining: stamp at the ghost, then re-evaluate the cell — it is occupied now,
		// and the feedback must say so without a mouse move
		evt.claimed = true;
		if (this.state.pointer.at) { this.stampAt(this.state.pointer.at); this.refreshHand(); }
	}

	/*
	D11 — a burst of arrow keys is ONE undo step, and the window that makes it one lives in `Changes`
	(client-side, label-keyed, 600ms). B14: this used to reach into `history.stack[history.index - 1]`
	to mutate the top of a local undo stack in place. That stack was deleted at CS3 when undo moved
	server-side, so the expression was `undefined[NaN]` and THREW — arrow-key nudge did nothing at all
	for two milestones. Each amend reads the CURRENT position, so successive ones accumulate.
	*/
	onArrowKey(evt) {
		const dir = ARROW[evt.key];
		if (dir) this.history.amend(commands.nudgeSelection(this.model, this.selection.list(), dir[0], dir[1]));
	}

	// Shift+arrow. Both resize paths self-guard on the selection kind, so exactly one of them acts:
	// a lone zone grows by a cell, a lone node grows its span by a cell, anything else is a no-op.
	onResizeStep(evt) {
		const dir = ARROW[evt.key];
		if (!dir) return;
		const ids = this.selection.list();
		// both builders self-guard on the selection kind, so exactly one of them yields entries
		this.history.amend(commands.resizeZoneStep(this.model, ids, dir[0], dir[1]));
		this.history.amend(commands.resizeNodeStep(this.model, ids, dir[0], dir[1]));
	}

	onWrapKey() { this.wrapInZone(); }
	onCloseKey() { this.toggleClosePath(); }
	onCloseRefused() { this.readout.flash('✗ close needs a multi-hop route'); }   // the `close-refused` row: ONE link, no bend
	onFlowKey() { this.cycleLinkFlow(); }
	onPlaneKey() { this.toggleLinkPlane(); }
	onChainKey() { this.linkSelectedNodes(false); }
	onStarKey()  { this.linkSelectedNodes(true); }

	onRenameKey() {
		this.labels.openFocused(this.selection.list().filter((id) => kindOf(id) !== 'link' && kindOf(id) !== 'group'));
	}

	// D21 — reverse another writer's whole run in one action. Deliberately NOT Ctrl+Z: taking back N
	// changes you did not make is a different intent from stepping back one you did.
	onUndoRun() { this.history.undoRun(); this.afterHistory(); }
	onUndoKey() { this.history.undo(); this.afterHistory(); }
	onRedoKey() { this.history.redo(); this.afterHistory(); }
	onDuplicate() { this.duplicateSelection(); }   // claims the bookmark shortcut

	onGroupKey() {
		this.history.commit(commands.createGroup(this.model, this.selection.groupable()));
	}

	onUngroupKey() {
		const groups = new Set(this.selection.groupable().map((id) => this.model.groupOf(id)).filter(Boolean).map((g) => g.id));
		this.history.commit(commands.ungroupAll(this.model, [...groups]));
	}

	onDeleteKey(evt) {
		if (this.selection.size() === 0) return;
		evt.claimed = true;
		this.history.commit(commands.deleteSelection(this.model, new Set(this.selection.list())));
		// selection auto-prunes on the delete's emits (selection.js)
	}

	/*
	Hover and key-up stay HERE and delegate to the overlay, which owns the state and the drawing. The DOM wiring is
	capture's since stage 1 of the gesture system (app/src/capture.js): these receive input events. (Deleted twice
	during H6 by slices that ran to `onKeyUp` — the second time is why they sit above the key handlers.)
	*/
	hover(evt, on) {
		this.overlayUi.hover(evt.on, on, evt, this.isGesturing());
		this.overlayUi.arm(evt, { readOnly: this.readOnly, gesturing: this.isGesturing() });
	}

	syncZoneGrid(evt) {
		this.overlayUi.zoneGrid(evt.shiftKey, this.mode === 'move' || this.mode === 'clone');
	}

	// a key release: the ONE row it means (app/src/keymap.js KEY_RELEASES), through the same engine as a key press
	keyUp(evt) {
		const { rule } = resolveInput(this.releaseRules, evt, this.situation(null, this.mode), {
			readOnly: this.readOnly, helpOpen: !!(this.help && isShown(this.help)), gesturing: this.isGesturing(),
		});
		if (rule) this[rule.run](evt);
	}

	// Shift released: the zone grid goes, a move redraws with the axis lock off, and a hovered zone drops its states
	onShiftUp() {
		this.overlayUi.zoneGrid(false, false);
		if ((this.mode === 'move' || this.mode === 'clone') && this.state.pointer.at) {
			// re-render with the lock released: the commit follows the frame
			this.updateMove(this.state.pointer.at, false);
		}
		// the zone layer just went inert: a hovered zone must drop its states
		if (this.overlayUi.hovered && kindOf(this.overlayUi.hovered) === 'zone') {
			this.renderer.clearState(this.overlayUi.hovered, 'hover');
			this.overlayUi.disarm();
		}
	}

	// Alt or Control released: the armed affordance follows what is still held
	onArmingUp(evt) {
		this.overlayUi.arm(evt, { readOnly: this.readOnly, gesturing: this.isGesturing() });
	}

	afterHistory() {
		// selection auto-prunes on del emits (selection.js); render() re-applies 'selected' from the
		// renderer's selectedSet whenever undo/redo re-renders an entity — so no manual re-reflect here.
		this.refreshHand(); // undo/redo can change occupancy under a stationary cursor
	}
}
